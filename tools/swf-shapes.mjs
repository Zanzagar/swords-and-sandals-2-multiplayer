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
 * One shape's edges, as SVG subpaths grouped by the fill that owns them.
 *
 * ► **SWF EDGES ARE NOT PATHS, and this is the part that trips every naive
 *   reader.** A shape is a single stream of edges, each of which may declare a
 *   fill on its LEFT (`fillStyle1`) and/or its RIGHT (`fillStyle0`). Edges
 *   sharing a fill are not contiguous and may be traversed in either direction.
 *   Grouping by fill and emitting each run as its own subpath — with an
 *   explicit `M` whenever the pen jumps — reproduces the filled regions without
 *   needing to reconstruct winding order.
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

  const runs = [];
  let current = null;
  let x = 0;
  let y = 0;
  let fill0 = 0;
  let fill1 = 0;
  let line = 0;
  let penDown = false;

  const flush = () => {
    if (current && current.d.length > 0) runs.push(current);
    current = null;
  };
  const begin = () => {
    flush();
    current = { fill0, fill1, line, d: [] };
    penDown = false;
  };

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
        penDown = false;
      }
      if (flags & 0x02) fill0 = reader.readUB(fillBits);
      if (flags & 0x04) fill1 = reader.readUB(fillBits);
      if (flags & 0x08) line = reader.readUB(lineBits);
      if (flags & 0x10) {
        // StateNewStyles: the style arrays are REPLACED mid-shape, and the
        // index widths change with them. Missing this desynchronises every
        // subsequent record.
        flush();
        reader.align();
        fills = readStyleArray(reader, () => readFillStyle(reader, withAlpha), shapeVersion);
        lines = readStyleArray(reader, () => readLineStyle(reader, withAlpha, shapeVersion), shapeVersion);
        fillBits = reader.readUB(4);
        lineBits = reader.readUB(4);
        fill0 = 0;
        fill1 = 0;
        line = 0;
      }
      begin();
      continue;
    }

    if (!current) begin();
    if (!penDown) {
      current.d.push(`M${round(x / TWIPS_PER_PIXEL)} ${round(y / TWIPS_PER_PIXEL)}`);
      penDown = true;
    }

    const straight = reader.readBit();
    const bits = reader.readUB(4) + 2;
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
      current.d.push(`l${round(dx / TWIPS_PER_PIXEL)} ${round(dy / TWIPS_PER_PIXEL)}`);
    } else {
      const cx = reader.readSB(bits);
      const cy = reader.readSB(bits);
      const ax = reader.readSB(bits);
      const ay = reader.readSB(bits);
      x += cx + ax;
      y += cy + ay;
      current.d.push(
        `q${round(cx / TWIPS_PER_PIXEL)} ${round(cy / TWIPS_PER_PIXEL)} ` +
        `${round((cx + ax) / TWIPS_PER_PIXEL)} ${round((cy + ay) / TWIPS_PER_PIXEL)}`
      );
    }
  }
  flush();

  return { id, version: shapeVersion, bounds, fills, lines, runs };
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

/**
 * A shape as SVG path elements.
 *
 * A gradient is flattened to its FIRST stop and reported as such rather than
 * resolved: a gradient needs a `<defs>` entry and a transform this parser
 * deliberately skips, and a flat approximation that says it is one is better
 * than a shape that silently vanishes. Measured on the shipped build, the
 * fighter clip reaches no bitmap fills at all.
 */
export function shapeToPaths(shape) {
  const paths = [];
  for (const run of shape.runs) {
    if (run.d.length === 0) continue;
    const index = run.fill1 || run.fill0;
    const style = index > 0 ? shape.fills[index - 1] : null;
    let paint = { fill: "none", opacity: 1, approximated: null };
    if (style?.kind === "solid") {
      paint = { ...cssColour(style.colour), approximated: null };
    } else if (style?.kind === "gradient") {
      paint = { ...cssColour(style.stops[0]?.colour), approximated: "gradient" };
    } else if (style?.kind === "bitmap") {
      paint = { fill: "none", opacity: 1, approximated: "bitmap" };
    }
    const strokeStyle = run.line > 0 ? shape.lines[run.line - 1] : null;
    const stroke = strokeStyle?.colour ? cssColour(strokeStyle.colour) : null;
    paths.push({
      d: run.d.join(""),
      fill: paint.fill,
      fillOpacity: paint.opacity,
      approximated: paint.approximated,
      stroke: stroke ? stroke.fill : null,
      strokeWidth: strokeStyle ? round(strokeStyle.width / TWIPS_PER_PIXEL) : 0
    });
  }
  return paths;
}
