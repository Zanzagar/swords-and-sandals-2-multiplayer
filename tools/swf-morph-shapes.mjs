/**
 * SWF morph shapes -> SVG path data at a given ratio. Structure only; no art.
 *
 * `tools/swf-shapes.mjs` reads a `DefineShape` and cannot read a morph: a morph
 * is a different record holding TWO shapes and an interpolation ratio, and the
 * fighter clip reaches 34 of them. Those 34 are the EFFECTS — blood, the charge
 * guard, the potions, the heart — every one of them on an effect depth and not
 * one on the rig, which is why the body extracted correctly without this.
 *
 * ## Measured before building, and it removes half the format
 *
 * **All 44 morphs in the shipped build are tag 46, `DefineMorphShape` version
 * 1. There is not one `DefineMorphShape2` (tag 84) in the file.** So the
 * version-2 additions — `StartEdgeBounds`, `EndEdgeBounds`, the scaling-stroke
 * flags byte, and `MORPHLINESTYLE2` — are parsed where they are cheap and
 * REFUSED BY NAME where they are not, rather than written speculatively against
 * a case this build cannot produce.
 *
 * The header was verified by hand on morph 1105 before a line was written:
 *
 * ```text
 *   51 04                    id 1105
 *   68 f3 dc cb ec f0 45 00  StartBounds  (nbits 13 -> 8 bytes)
 *   68 be 9c 17 e7 70 b5 80  EndBounds
 *   9e 00 00 00              Offset 158, to EndEdges
 *   01                       one fill style
 *   00                       type 0x00, solid
 *   cc 00 00 ff              StartColor  — red
 *   cc 00 00 ff              EndColor    — the same red
 * ```
 *
 * A solid red morph on an effect depth. It is blood.
 *
 * ## THE PART THAT IS NOT OBVIOUS: the two edge streams are PAIRED, not aligned
 *
 * `StartEdges` and `EndEdges` are two `SHAPE` records — no style array, just
 * `NumFillBits`/`NumLineBits` and then records. The specification pairs their
 * EDGES one for one, and the pairing is by ORDER, not by position: edge `n` of
 * the start morphs into edge `n` of the end.
 *
 * ► **A straight edge may be paired with a CURVED one.** That is legal and the
 *   build does it. So interpolating position-by-position fails; every edge is
 *   promoted to a quadratic first — a line's control point is its midpoint,
 *   which leaves the line unchanged — and then control and anchor are each
 *   lerped. A reader that lerped a line against a curve as though both were
 *   lines would produce a shape that is subtly wrong only while morphing, which
 *   is the hardest kind of wrong to see.
 *
 * ► **AND THE STYLE-CHANGE RECORDS ARE NOT PAIRED.** Only the EDGES correspond.
 *   The end stream carries its own move-tos and its own fill indices, and they
 *   need not match the start's. So the fill assignment is taken from the START
 *   stream alone, which is what a player does.
 */

export class MorphParseError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

const TWIPS_PER_PIXEL = 20;

/** A bit cursor. Shape records are not byte-aligned. */
class BitReader {
  constructor(buffer, start, end) {
    this.buffer = buffer;
    this.byte = start;
    this.end = end;
    this.bit = 0;
  }

  align() {
    if (this.bit !== 0) {
      this.bit = 0;
      this.byte += 1;
    }
  }

  readBit() {
    if (this.byte >= this.end) throw new MorphParseError("morph record ran past the end of its tag.");
    const value = (this.buffer[this.byte] >>> (7 - this.bit)) & 1;
    this.bit += 1;
    if (this.bit === 8) {
      this.bit = 0;
      this.byte += 1;
    }
    return value;
  }

  readUB(bits) {
    let value = 0;
    for (let index = 0; index < bits; index += 1) value = (value << 1) | this.readBit();
    return value >>> 0;
  }

  readSB(bits) {
    if (bits === 0) return 0;
    const raw = this.readUB(bits);
    const sign = 1 << (bits - 1);
    return (raw & sign) ? raw - (1 << bits) : raw;
  }

  readUI8() {
    this.align();
    if (this.byte >= this.end) throw new MorphParseError("morph header ran past the end of its tag.");
    return this.buffer[this.byte++];
  }

  readUI16() {
    this.align();
    const value = this.buffer.readUInt16LE(this.byte);
    this.byte += 2;
    return value;
  }

  readUI32() {
    this.align();
    const value = this.buffer.readUInt32LE(this.byte);
    this.byte += 4;
    return value;
  }

  readRect() {
    this.align();
    const bits = this.readUB(5);
    const xMin = this.readSB(bits);
    const xMax = this.readSB(bits);
    const yMin = this.readSB(bits);
    const yMax = this.readSB(bits);
    this.align();
    return { xMin, xMax, yMin, yMax };
  }

  skipMatrix() {
    this.align();
    if (this.readBit()) {
      const bits = this.readUB(5);
      this.readSB(bits);
      this.readSB(bits);
    }
    if (this.readBit()) {
      const bits = this.readUB(5);
      this.readSB(bits);
      this.readSB(bits);
    }
    const translateBits = this.readUB(5);
    this.readSB(translateBits);
    this.readSB(translateBits);
    this.align();
  }
}

/** A morph colour is always RGBA — there is no alpha-less morph record. */
function readColour(reader) {
  return { red: reader.readUI8(), green: reader.readUI8(), blue: reader.readUI8(), alpha: reader.readUI8() };
}

/** A MORPHFILLSTYLE: every field twice, start and end. */
function readMorphFillStyle(reader) {
  const type = reader.readUI8();
  if (type === 0x00) {
    return { kind: "solid", start: readColour(reader), end: readColour(reader) };
  }
  if (type === 0x10 || type === 0x12 || type === 0x13) {
    reader.skipMatrix(); // start gradient matrix
    reader.skipMatrix(); // end gradient matrix
    const count = reader.readUI8() & 0x0f;
    const stops = [];
    for (let index = 0; index < count; index += 1) {
      // A MORPHGRADRECORD is start ratio + colour THEN end ratio + colour.
      reader.readUI8();
      const start = readColour(reader);
      reader.readUI8();
      const end = readColour(reader);
      stops.push({ start, end });
    }
    return { kind: "gradient", stops };
  }
  if (type === 0x40 || type === 0x41 || type === 0x42 || type === 0x43) {
    const bitmapId = reader.readUI16();
    reader.skipMatrix();
    reader.skipMatrix();
    return { kind: "bitmap", bitmapId };
  }
  throw new MorphParseError(`unknown morph fill style type 0x${type.toString(16)}.`);
}

function readMorphLineStyle(reader, version) {
  const startWidth = reader.readUI16();
  const endWidth = reader.readUI16();
  if (version < 2) {
    return { startWidth, endWidth, start: readColour(reader), end: readColour(reader) };
  }
  // MORPHLINESTYLE2. Not reachable in the shipped build — all 44 morphs are
  // version 1 — so this refuses rather than guessing at a record it has never
  // been able to check against real bytes.
  throw new MorphParseError(
    "MORPHLINESTYLE2 (DefineMorphShape2) is not supported: the shipped build contains no tag 84, " +
    "so this path has never been exercised against real bytes and will not be written blind."
  );
}

function readStyleArray(reader, read) {
  let count = reader.readUI8();
  if (count === 0xff) count = reader.readUI16();
  const styles = [];
  for (let index = 0; index < count; index += 1) styles.push(read());
  return styles;
}

/**
 * One edge stream as absolute EDGES, ignoring the style-change records except
 * for the fill indices they set.
 *
 * A `StateNewStyles` record is illegal inside a morph's edge stream — there is
 * one style array for both ends — and is refused rather than skipped, because
 * skipping it would desynchronise every record after it.
 */
function readEdges(reader, { allowStyleIndices }) {
  let fillBits = reader.readUB(4);
  let lineBits = reader.readUB(4);
  const edges = [];
  let x = 0;
  let y = 0;
  let fill0 = 0;
  let fill1 = 0;
  let line = 0;

  for (;;) {
    const isEdge = reader.readBit();
    if (!isEdge) {
      const flags = reader.readUB(5);
      if (flags === 0) break;
      if (flags & 0x01) {
        const bits = reader.readUB(5);
        x = reader.readSB(bits);
        y = reader.readSB(bits);
      }
      if (flags & 0x02) fill0 = reader.readUB(fillBits);
      if (flags & 0x04) fill1 = reader.readUB(fillBits);
      if (flags & 0x08) line = reader.readUB(lineBits);
      if (flags & 0x10) {
        throw new MorphParseError("a morph edge stream may not declare new styles.");
      }
      continue;
    }
    const fromX = x;
    const fromY = y;
    // `readBit` yields 0/1; a boolean here so the flag compares as one and
    // survives JSON without becoming a number a caller has to remember about.
    const straight = reader.readBit() === 1;
    const bits = reader.readUB(4) + 2;
    let control = null;
    if (straight) {
      let dx = 0;
      let dy = 0;
      if (reader.readBit()) {
        dx = reader.readSB(bits);
        dy = reader.readSB(bits);
      } else if (reader.readBit()) {
        dy = reader.readSB(bits);
      } else {
        dx = reader.readSB(bits);
      }
      x += dx;
      y += dy;
    } else {
      const cx = reader.readSB(bits);
      const cy = reader.readSB(bits);
      const ax = reader.readSB(bits);
      const ay = reader.readSB(bits);
      control = [x + cx, y + cy];
      x += cx + ax;
      y += cy + ay;
    }
    // ► **PROMOTED TO A QUADRATIC HERE, not at interpolation time.** A straight
    //   edge is a curve whose control point is its midpoint, which leaves the
    //   line exactly where it was — and it makes a line and a curve
    //   interpolable, which the specification requires them to be.
    edges.push({
      from: [fromX, fromY],
      to: [x, y],
      control: control ?? [(fromX + x) / 2, (fromY + y) / 2],
      straight,
      fill0: allowStyleIndices ? fill0 : 0,
      fill1: allowStyleIndices ? fill1 : 0,
      line: allowStyleIndices ? line : 0
    });
  }
  return edges;
}

/**
 * A `DefineMorphShape` (46) or `DefineMorphShape2` (84).
 *
 * Returns both edge streams and the paired styles. Nothing is interpolated
 * here: a morph is a definition, and the ratio belongs to the PLACEMENT.
 */
export function parseMorphShape(buffer, start, end, tagCode) {
  const version = tagCode === 84 ? 2 : 1;
  const reader = new BitReader(buffer, start, end);

  const id = reader.readUI16();
  const startBounds = reader.readRect();
  const endBounds = reader.readRect();
  if (version === 2) {
    reader.readRect(); // StartEdgeBounds
    reader.readRect(); // EndEdgeBounds
    reader.readUI8(); // reserved + scaling-stroke flags
  }
  // Offset to EndEdges, measured from the byte AFTER this field. Read and kept
  // as a CHECK rather than used to seek: walking the start stream and landing
  // exactly there is what proves the style arrays were read correctly.
  const offset = reader.readUI32();
  const endEdgesAt = reader.byte + offset;

  const fills = readStyleArray(reader, () => readMorphFillStyle(reader));
  const lines = readStyleArray(reader, () => readMorphLineStyle(reader, version));

  const startEdges = readEdges(reader, { allowStyleIndices: true });
  reader.align();
  if (offset !== 0 && reader.byte !== endEdgesAt) {
    throw new MorphParseError(
      `morph ${id}: the start edge stream ended at ${reader.byte} but the header's offset says ` +
      `EndEdges begins at ${endEdgesAt}. The style arrays were misread.`
    );
  }
  // The END stream's own style-change records are NOT paired with the start's,
  // so its indices are discarded: the fill of edge `n` is the start's.
  const endEdges = readEdges(new BitReader(buffer, endEdgesAt, end), { allowStyleIndices: false });

  if (startEdges.length !== endEdges.length) {
    throw new MorphParseError(
      `morph ${id}: ${startEdges.length} start edges against ${endEdges.length} end edges. ` +
      "The specification pairs them one for one, so one of the streams was misread."
    );
  }

  return { id, version, startBounds, endBounds, fills, lines, startEdges, endEdges };
}

const lerp = (from, to, ratio) => from + (to - from) * ratio;

/** A morph colour pair at a ratio, as the byte-valued colour a caller expects. */
export function morphColourAt(style, ratio) {
  if (!style?.start || !style?.end) return null;
  const channel = (name) => Math.round(lerp(style.start[name], style.end[name], ratio));
  return { red: channel("red"), green: channel("green"), blue: channel("blue"), alpha: channel("alpha") };
}

/**
 * The morph at `ratio`, as a shape whose shape is the SAME structure
 * `tools/swf-shapes.mjs` returns — so a caller already handling shapes needs no
 * second code path.
 *
 * ► **The ratio on the wire is 0..65535, not 0..1.** `PlaceObject2` carries it
 *   as a `UI16`, and this takes the NORMALISED value so a caller cannot pass
 *   one convention where the other was meant. `ratioOf` converts.
 */
export function morphShapeAt(morph, ratio) {
  const clamped = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const edges = morph.startEdges.map((startEdge, index) => {
    const endEdge = morph.endEdges[index];
    return {
      from: [lerp(startEdge.from[0], endEdge.from[0], clamped), lerp(startEdge.from[1], endEdge.from[1], clamped)],
      to: [lerp(startEdge.to[0], endEdge.to[0], clamped), lerp(startEdge.to[1], endEdge.to[1], clamped)],
      control: [
        lerp(startEdge.control[0], endEdge.control[0], clamped),
        lerp(startEdge.control[1], endEdge.control[1], clamped)
      ],
      // A pair that is straight at BOTH ends stays a straight segment; a pair
      // where either end curves is emitted as a quadratic throughout.
      straight: startEdge.straight && endEdge.straight,
      fill0: startEdge.fill0,
      fill1: startEdge.fill1,
      line: startEdge.line
    };
  });
  const bounds = {
    xMin: lerp(morph.startBounds.xMin, morph.endBounds.xMin, clamped),
    xMax: lerp(morph.startBounds.xMax, morph.endBounds.xMax, clamped),
    yMin: lerp(morph.startBounds.yMin, morph.endBounds.yMin, clamped),
    yMax: lerp(morph.startBounds.yMax, morph.endBounds.yMax, clamped)
  };
  const fills = morph.fills.map((style) => {
    if (style.kind === "solid") return { kind: "solid", colour: morphColourAt(style, clamped) };
    if (style.kind === "gradient") {
      return { kind: "gradient", stops: style.stops.map((stop) => ({ ratio: 0, colour: morphColourAt(stop, clamped) })) };
    }
    return { kind: "bitmap", bitmapId: style.bitmapId };
  });
  const lines = morph.lines.map((style) => ({
    width: lerp(style.startWidth, style.endWidth, clamped),
    colour: morphColourAt(style, clamped)
  }));
  return { id: morph.id, version: morph.version, bounds, fills, lines, edges };
}

/** `PlaceObject2`'s 16-bit ratio as the 0..1 this module takes. */
export function ratioOf(placementRatio) {
  if (!Number.isFinite(placementRatio)) return 0;
  return Math.min(1, Math.max(0, placementRatio / 65535));
}

const round = (value) => Math.round(value * 100) / 100;

function reverseEdge(edge) {
  return { ...edge, from: edge.to, to: edge.from };
}

/** Chain edges end-to-start into loops. Same rule as `tools/swf-shapes.mjs`. */
function stitch(edges) {
  const key = (point) => `${Math.round(point[0])},${Math.round(point[1])}`;
  const byStart = new Map();
  for (const edge of edges) {
    const at = key(edge.from);
    if (!byStart.has(at)) byStart.set(at, []);
    byStart.get(at).push(edge);
  }
  const used = new Set();
  const loops = [];
  for (const edge of edges) {
    if (used.has(edge)) continue;
    const loop = [];
    let current = edge;
    while (current && !used.has(current)) {
      used.add(current);
      loop.push(current);
      current = byStart.get(key(current.to))?.find((candidate) => !used.has(candidate));
    }
    if (loop.length > 0) loops.push(loop);
  }
  return loops;
}

function loopToPath(loop, { close }) {
  const px = (value) => round(value / TWIPS_PER_PIXEL);
  const parts = [`M${px(loop[0].from[0])} ${px(loop[0].from[1])}`];
  for (const edge of loop) {
    if (edge.straight) parts.push(`L${px(edge.to[0])} ${px(edge.to[1])}`);
    else parts.push(`Q${px(edge.control[0])} ${px(edge.control[1])} ${px(edge.to[0])} ${px(edge.to[1])}`);
  }
  if (close) parts.push("Z");
  return parts.join("");
}

function cssColour(colour) {
  if (!colour) return { fill: "none", opacity: 1 };
  const hex = (value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
  return {
    fill: `#${hex(colour.red)}${hex(colour.green)}${hex(colour.blue)}`,
    opacity: Math.round((colour.alpha / 255) * 1000) / 1000
  };
}

/**
 * A morph at a ratio as SVG path elements, in the same shape
 * `tools/swf-shapes.mjs`'s `shapeToPaths` returns.
 *
 * ► **The stitching is the same rule and that is deliberate**, including the
 *   part that matters: an edge with the SAME fill on both sides is INTERIOR and
 *   contributes no boundary, and a `fillStyle0` edge is reversed so the whole
 *   boundary runs one way. Emitting open subpaths and letting the renderer close
 *   them with a chord is the defect that put black wedges across the
 *   gladiator's chest, and a second parser repeating it would put them on the
 *   blood.
 */
export function morphToPaths(shape) {
  const paths = [];
  for (let index = 1; index <= shape.fills.length; index += 1) {
    const owned = [];
    for (const edge of shape.edges) {
      if (edge.fill0 === edge.fill1) continue;
      if (edge.fill1 === index) owned.push(edge);
      else if (edge.fill0 === index) owned.push(reverseEdge(edge));
    }
    if (owned.length === 0) continue;
    const style = shape.fills[index - 1];
    let paint = { fill: "none", opacity: 1, approximated: null };
    if (style?.kind === "solid") paint = { ...cssColour(style.colour), approximated: null };
    else if (style?.kind === "gradient") paint = { ...cssColour(style.stops[0]?.colour), approximated: "gradient" };
    else if (style?.kind === "bitmap") paint = { fill: "none", opacity: 1, approximated: "bitmap" };
    paths.push({
      d: stitch(owned).map((loop) => loopToPath(loop, { close: true })).join(""),
      fill: paint.fill,
      fillOpacity: paint.opacity,
      fillRule: "evenodd",
      approximated: paint.approximated,
      stroke: null,
      strokeWidth: 0
    });
  }
  for (let index = 1; index <= shape.lines.length; index += 1) {
    const owned = shape.edges.filter((edge) => edge.line === index);
    if (owned.length === 0) continue;
    const style = shape.lines[index - 1];
    const colour = cssColour(style.colour);
    paths.push({
      d: stitch(owned).map((loop) => loopToPath(loop, { close: false })).join(""),
      fill: "none",
      fillOpacity: 1,
      fillRule: null,
      approximated: null,
      stroke: colour.fill,
      strokeOpacity: colour.opacity,
      strokeWidth: round(style.width / TWIPS_PER_PIXEL)
    });
  }
  return paths;
}
