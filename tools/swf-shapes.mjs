/**
 * SWF shape records -> SVG path data. Structure only; no art is reproduced here.
 *
 * This is the parser half of asset extraction, kept separate from the tool that
 * writes files so it can be tested under `node --test` without touching a
 * licensed build. It takes bytes and returns geometry.
 *
 * ## Why vector rather than sprite sheets
 *
 * Measured on the shipped build: the fighter clip reaches **70 shapes, 44
 * sprites and ZERO bitmaps**, for 25 KB of shape payload. The art is vector, so
 * the honest extraction is path data rather than rasterised frames — it scales
 * with the arena's viewport, which already zooms to fit the roster.
 *
 * ## The formats, and what this does with each
 *
 * `DefineShape` (2), `DefineShape2` (22), `DefineShape3` (32) and
 * `DefineShape4` (83) differ in three ways that matter here: how a style count
 * is encoded, whether fills carry alpha, and whether the header has extra
 * fields. Everything else is the same SHAPERECORD stream.
 *
 * Twips are the SWF's unit — 20 to the pixel — and are converted on the way out
 * so nothing downstream has to remember.
 */

export class ShapeParseError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

const TWIPS_PER_PIXEL = 20;

/** A bit-level cursor. SWF shape records are not byte-aligned. */
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
    if (this.byte >= this.end) throw new ShapeParseError("shape record ran past the end of its tag.");
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

  /** Signed, two's complement in `bits` bits — the SWF's own SB encoding. */
  readSB(bits) {
    if (bits === 0) return 0;
    const raw = this.readUB(bits);
    const sign = 1 << (bits - 1);
    return (raw & sign) ? raw - (1 << bits) : raw;
  }

  readUI8() {
    this.align();
    if (this.byte >= this.end) throw new ShapeParseError("shape header ran past the end of its tag.");
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

  /** RECT: a 5-bit width then four signed fields of that width, in twips. */
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

  skipRect() {
    this.readRect();
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

function readColour(reader, withAlpha) {
  const red = reader.readUI8();
  const green = reader.readUI8();
  const blue = reader.readUI8();
  const alpha = withAlpha ? reader.readUI8() : 255;
  return { red, green, blue, alpha };
}

/**
 * A fill style. Gradients and bitmap fills are RECOGNISED but not resolved:
 * they report their kind and are drawn by the caller as a flat approximation,
 * which is honest about what was read rather than silently dropping the shape.
 */
function readFillStyle(reader, withAlpha) {
  const type = reader.readUI8();
  if (type === 0x00) return { kind: "solid", colour: readColour(reader, withAlpha) };
  if (type === 0x10 || type === 0x12 || type === 0x13) {
    reader.skipMatrix();
    // GRADIENT: spread/interpolation/count packed into one byte.
    const count = reader.readUI8() & 0x0f;
    const stops = [];
    for (let index = 0; index < count; index += 1) {
      const ratio = reader.readUI8();
      stops.push({ ratio, colour: readColour(reader, withAlpha) });
    }
    if (type === 0x13) reader.readUI16();
    return { kind: "gradient", stops };
  }
  if (type === 0x40 || type === 0x41 || type === 0x42 || type === 0x43) {
    const bitmapId = reader.readUI16();
    reader.skipMatrix();
    return { kind: "bitmap", bitmapId };
  }
  throw new ShapeParseError(`unknown fill style type 0x${type.toString(16)}.`);
}

function readLineStyle(reader, withAlpha, shapeVersion) {
  const width = reader.readUI16();
  if (shapeVersion < 4) return { width, colour: readColour(reader, withAlpha) };
  // LINESTYLE2 carries caps/joins and may replace its colour with a fill.
  const flags = reader.readUI16();
  const hasFill = (flags & 0x0008) !== 0;
  if ((flags & 0x0030) === 0x0020) reader.readUI16(); // miter limit
  if (hasFill) return { width, fill: readFillStyle(reader, withAlpha) };
  return { width, colour: readColour(reader, withAlpha) };
}

function readStyleArray(reader, read, shapeVersion) {
  let count = reader.readUI8();
  if (count === 0xff && shapeVersion > 1) count = reader.readUI16();
  const styles = [];
  for (let index = 0; index < count; index += 1) styles.push(read());
  return styles;
}

const round = (value) => Math.round(value * 100) / 100;

/**
 * One shape, as EDGES carrying the fill on each side of them.
 *
 * ► **SWF EDGES ARE NOT PATHS, and the first version of this parser got that
 *   HALF right, which is worse than getting it wrong.** A shape is one stream
 *   of edges, each declaring a fill on its LEFT (`fillStyle1`) and/or its RIGHT
 *   (`fillStyle0`). Edges sharing a fill are not contiguous and may be
 *   traversed in either direction.
 *
 *   The old code grouped them by fill and emitted each contiguous RUN as its
 *   own subpath, with a comment claiming that "reproduces the filled regions
 *   without needing to reconstruct winding order". **It does not, and the
 *   failure is invisible in the data and obvious on screen.** An open subpath
 *   that is filled gets closed by the renderer with a straight chord from its
 *   end back to its start, so the torso came out as 127 open runs and a fan of
 *   hard black and white WEDGES across the gladiator's chest.
 *
 *   **Nothing caught it for a session and no test could have**: the paths
 *   parsed, the counts were right, 824 of 824 shapes "survived", and the `d`
 *   strings were well-formed. It took rendering the figure and looking at it.
 *
 * So this returns edges, and `shapeToPaths` STITCHES them into closed loops:
 * an edge whose fill is on the right is reversed, edges are chained end-to-start
 * until the loop closes, and each loop is emitted as one subpath ending in `Z`.
 *
 * Coordinates are absolute TWIPS here and become pixels on the way out.
 */
export function parseShape(buffer, start, end, tagCode) {
  const shapeVersion = tagCode === 2 ? 1 : tagCode === 22 ? 2 : tagCode === 32 ? 3 : 4;
  const withAlpha = shapeVersion >= 3;
  const reader = new BitReader(buffer, start, end);

  const id = reader.readUI16();
  // The declaring RECT, kept rather than skipped: a caller composing this shape
  // into a scene needs a viewBox, and recovering one from relative path data
  // means re-walking every edge. It is in TWIPS, like every other coordinate on
  // the wire, and unlike the path data this parser emits in pixels.
  const bounds = reader.readRect();
  if (shapeVersion === 4) {
    reader.skipRect(); // DefineShape4's edge bounds, which include stroke width.
    reader.readUI8();
  }

  let fills = readStyleArray(reader, () => readFillStyle(reader, withAlpha), shapeVersion);
  let lines = readStyleArray(reader, () => readLineStyle(reader, withAlpha, shapeVersion), shapeVersion);

  let fillBits = reader.readUB(4);
  let lineBits = reader.readUB(4);

  // Style arrays can be REPLACED mid-shape by StateNewStyles, and an edge's
  // style indices refer to whichever generation was current when it was read.
  // So each edge records its generation and resolves against that one.
  const generations = [{ fills, lines }];
  let generation = 0;

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
      if (flags === 0) break; // EndShapeRecord
      if (flags & 0x01) {
        // StateMoveTo
        const bits = reader.readUB(5);
        x = reader.readSB(bits);
        y = reader.readSB(bits);
      }
      if (flags & 0x02) fill0 = reader.readUB(fillBits);
      if (flags & 0x04) fill1 = reader.readUB(fillBits);
      if (flags & 0x08) line = reader.readUB(lineBits);
      if (flags & 0x10) {
        // StateNewStyles: the style arrays are REPLACED mid-shape, and the
        // index widths change with them. Missing this desynchronises every
        // subsequent record.
        reader.align();
        fills = readStyleArray(reader, () => readFillStyle(reader, withAlpha), shapeVersion);
        lines = readStyleArray(reader, () => readLineStyle(reader, withAlpha, shapeVersion), shapeVersion);
        fillBits = reader.readUB(4);
        lineBits = reader.readUB(4);
        fill0 = 0;
        fill1 = 0;
        line = 0;
        generations.push({ fills, lines });
        generation = generations.length - 1;
      }
      continue;
    }

    const startX = x;
    const startY = y;
    const straight = reader.readBit();
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
    edges.push({ from: [startX, startY], to: [x, y], control, fill0, fill1, line, generation });
  }

  return { id, version: shapeVersion, bounds, fills: generations[0].fills, lines: generations[0].lines, generations, edges };
}

/** `#rrggbb` plus a separate alpha, which SVG wants as its own attribute. */
export function cssColour(colour) {
  if (!colour) return { fill: "none", opacity: 1 };
  const hex = (value) => value.toString(16).padStart(2, "0");
  return {
    fill: `#${hex(colour.red)}${hex(colour.green)}${hex(colour.blue)}`,
    opacity: Math.round((colour.alpha / 255) * 1000) / 1000
  };
}

/** An edge walked backwards. A quadratic's control point is unchanged by it. */
function reverseEdge(edge) {
  return { ...edge, from: edge.to, to: edge.from };
}

/**
 * Chain edges end-to-start into closed loops.
 *
 * ► **The endpoints are EXACT.** SWF edge coordinates are integer twips and
 *   consecutive edges share them bit for bit, so the join is a dictionary
 *   lookup rather than a distance test. A tolerance here would silently weld
 *   two regions that merely pass close to each other.
 *
 * An edge set that does not close — which a malformed or truncated shape can
 * produce — still yields its chain, emitted as an open subpath. Dropping it
 * would lose geometry that IS in the file.
 */
function stitch(edges) {
  const key = (point) => `${point[0]},${point[1]}`;
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
      const candidates = byStart.get(key(current.to));
      current = candidates?.find((candidate) => !used.has(candidate));
    }
    if (loop.length > 0) loops.push(loop);
  }
  return loops;
}

/** A chain of edges as one SVG subpath, in pixels, closed when it closes. */
function loopToPath(loop, { close }) {
  const px = (value) => round(value / TWIPS_PER_PIXEL);
  const parts = [`M${px(loop[0].from[0])} ${px(loop[0].from[1])}`];
  for (const edge of loop) {
    if (edge.control) {
      parts.push(`Q${px(edge.control[0])} ${px(edge.control[1])} ${px(edge.to[0])} ${px(edge.to[1])}`);
    } else {
      parts.push(`L${px(edge.to[0])} ${px(edge.to[1])}`);
    }
  }
  if (close) parts.push("Z");
  return parts.join("");
}

/**
 * A shape as SVG path elements: one per FILLED REGION, plus one per stroke run.
 *
 * A gradient is flattened to its FIRST stop and reported as such rather than
 * resolved: a gradient needs a `<defs>` entry and a transform this parser
 * deliberately skips, and a flat approximation that says it is one is better
 * than a shape that silently vanishes. Measured on the shipped build, the
 * fighter clip reaches no bitmap fills at all.
 */
export function shapeToPaths(shape) {
  const paths = [];
  const generations = shape.generations ?? [{ fills: shape.fills, lines: shape.lines }];

  // FILLS. Every edge with this style on its LEFT as written, and every edge
  // with it on its RIGHT reversed, so the whole boundary runs one way round.
  for (let generation = 0; generation < generations.length; generation += 1) {
    const styles = generations[generation].fills;
    for (let index = 1; index <= styles.length; index += 1) {
      const owned = [];
      for (const edge of shape.edges) {
        if (edge.generation !== generation) continue;
        // ► **An edge with the SAME fill on both sides is INTERIOR to that
        //   region and is not part of its boundary.** Style state persists
        //   across shape records, so a run that sets only `fillStyle0` keeps
        //   whatever `fillStyle1` the previous run left — which makes this
        //   common rather than exotic. Taking such an edge both ways round
        //   walks it twice and derails the stitch.
        if (edge.fill0 === edge.fill1) continue;
        if (edge.fill1 === index) owned.push(edge);
        else if (edge.fill0 === index) owned.push(reverseEdge(edge));
      }
      if (owned.length === 0) continue;

      const style = styles[index - 1];
      let paint = { fill: "none", opacity: 1, approximated: null };
      if (style?.kind === "solid") paint = { ...cssColour(style.colour), approximated: null };
      else if (style?.kind === "gradient") paint = { ...cssColour(style.stops[0]?.colour), approximated: "gradient" };
      else if (style?.kind === "bitmap") paint = { fill: "none", opacity: 1, approximated: "bitmap" };

      // Every loop of one fill in ONE element: a region with a hole needs both
      // rings under a single `fill-rule`, and separate elements cannot express
      // the hole at all.
      const d = stitch(owned).map((loop) => loopToPath(loop, { close: true })).join("");
      paths.push({
        d,
        fill: paint.fill,
        fillOpacity: paint.opacity,
        fillRule: "evenodd",
        approximated: paint.approximated,
        stroke: null,
        strokeWidth: 0
      });
    }
  }

  // STROKES. A stroke is drawn ALONG an edge and is not a region, so these are
  // chained but never closed, and never given a fill.
  for (let generation = 0; generation < generations.length; generation += 1) {
    const styles = generations[generation].lines;
    for (let index = 1; index <= styles.length; index += 1) {
      const owned = shape.edges.filter((edge) => edge.generation === generation && edge.line === index);
      if (owned.length === 0) continue;
      const style = styles[index - 1];
      const colour = style?.colour ? cssColour(style.colour) : null;
      const d = stitch(owned).map((loop) => loopToPath(loop, { close: false })).join("");
      paths.push({
        d,
        fill: "none",
        fillOpacity: 1,
        fillRule: null,
        approximated: style?.fill ? "line-fill" : null,
        stroke: colour ? colour.fill : "#000000",
        strokeOpacity: colour ? colour.opacity : 1,
        strokeWidth: round((style?.width ?? 0) / TWIPS_PER_PIXEL)
      });
    }
  }

  return paths;
}
