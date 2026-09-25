/**
 * The morph-shape parser, against SYNTHETIC morphs built in this file.
 *
 * ► **Nothing here comes from the licensed build**, for the reason
 *   `test/swf-shapes.test.js` gives: a fixture of real morph bytes would put
 *   extracted art in the repository. `MorphWriter` assembles the
 *   specification's own encoding, so the parser is checked against the FORMAT.
 *
 * What the real build contributes is numbers, quoted and not stored: all 44 of
 * its morphs are tag 46, all 44 parse, 0 failures, 8,720 edges — and the
 * commonest fills are `#cc0000`, `#b10101` and `#ff0000`, which is blood.
 *
 * ## AND THE GRADIENT AND BITMAP TESTS BELOW HAVE NO RUNTIME EVIDENCE AT ALL
 *
 * Re-measured against the oracle while writing them: those 44 morphs carry 97
 * fills and **every single one is SOLID — zero gradient fills, zero bitmap
 * fills.** So `readMorphFillStyle`'s gradient and bitmap branches are DEAD
 * against the shipped build and cannot be checked against it. Everything
 * asserted about them below is asserted about the FORMAT, from bytes built in
 * this file, and no claim is made that the build ever takes those branches.
 *
 * ► **THE BYTE COUNT IS CHECKED EVEN WHERE NO ASSERTION NAMES IT.**
 *   `morphBytesWithFills` computes the header's offset to `EndEdges` from the
 *   real lengths of the bytes it wrote, and `parseMorphShape` refuses a parse
 *   whose start edge stream does not end exactly there. A style reader that
 *   consumed the wrong number of bytes therefore fails these tests with a
 *   `MorphParseError` — either that offset disagreeing, or the line style
 *   array read out of the wrong bytes and running past the end of the tag —
 *   rather than returning plausible nonsense. Both were observed while
 *   checking these tests go red against the pre-repair parser.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  MorphParseError,
  morphColourAt,
  morphShapeAt,
  morphToPaths,
  parseMorphShape,
  ratioOf
} from "../tools/swf-morph-shapes.mjs";

class MorphWriter {
  constructor() {
    this.bytes = [];
    this.current = 0;
    this.bitCount = 0;
  }

  bit(value) {
    this.current = (this.current << 1) | (value ? 1 : 0);
    this.bitCount += 1;
    if (this.bitCount === 8) {
      this.bytes.push(this.current & 0xff);
      this.current = 0;
      this.bitCount = 0;
    }
    return this;
  }

  ub(value, bits) {
    for (let index = bits - 1; index >= 0; index -= 1) this.bit((value >>> index) & 1);
    return this;
  }

  sb(value, bits) {
    return this.ub(value < 0 ? (1 << bits) + value : value, bits);
  }

  align() {
    while (this.bitCount !== 0) this.bit(0);
    return this;
  }

  u8(value) {
    this.align();
    this.bytes.push(value & 0xff);
    return this;
  }

  u16(value) {
    this.align();
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff);
    return this;
  }

  u32(value) {
    this.align();
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
    return this;
  }

  rect() {
    this.align();
    return this.ub(0, 5).align();
  }

  rgba(r, g, b, a) {
    return this.u8(r).u8(g).u8(b).u8(a);
  }

  /**
   * A MATRIX, as a fill style carries one.
   *
   * Scale and skew are 16.16 fixed point; the translation is TWIPS. The bit
   * widths here are fixed and generous rather than minimal, because the parser
   * must read whatever width the field declares and pinning one width would
   * test only that width.
   */
  matrix({ a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0 } = {}) {
    this.align();
    this.bit(1).ub(30, 5).sb(Math.round(a * 65536), 30).sb(Math.round(d * 65536), 30);
    // RotateSkew0 then RotateSkew1 on the wire, which are `b` then `c`.
    this.bit(1).ub(30, 5).sb(Math.round(b * 65536), 30).sb(Math.round(c * 65536), 30);
    this.ub(20, 5).sb(tx, 20).sb(ty, 20);
    return this.align();
  }

  /** An edge stream: fill/line bit widths, a move, a fill index, then edges. */
  edges(list, { fillIndex = 1 } = {}) {
    this.ub(1, 4).ub(0, 4); // fillBits 1, lineBits 0
    this.bit(0).ub(0b00101, 5); // StateMoveTo | StateFillStyle1
    this.ub(10, 5).sb(list[0].fromX, 10).sb(list[0].fromY, 10);
    this.ub(fillIndex, 1);
    for (const edge of list) {
      this.bit(1); // an edge
      if (edge.control) {
        this.bit(0).ub(10 - 2, 4);
        this.sb(edge.control[0] - edge.fromX, 10).sb(edge.control[1] - edge.fromY, 10);
        this.sb(edge.toX - edge.control[0], 10).sb(edge.toY - edge.control[1], 10);
      } else {
        this.bit(1).ub(10 - 2, 4).bit(1);
        this.sb(edge.toX - edge.fromX, 10).sb(edge.toY - edge.fromY, 10);
      }
    }
    this.bit(0).ub(0, 5); // EndShapeRecord
    return this;
  }

  buffer() {
    this.align();
    return Buffer.from(this.bytes);
  }
}

/**
 * A square that morphs into a bigger square, with the FILL STYLE ARRAY written
 * by the caller — so a gradient or a bitmap fill can be assembled byte by byte
 * without a second copy of the header.
 *
 * The edge streams are built first so the header's offset to `EndEdges` is
 * MEASURED rather than guessed, which is what makes every test below a
 * byte-count check on whatever style reader ran.
 */
function morphBytesWithFills(writeFills, { startEdges, endEdges } = {}) {
  const square = (size) => [
    { fromX: 0, fromY: 0, toX: size, toY: 0 },
    { fromX: size, fromY: 0, toX: size, toY: size },
    { fromX: size, fromY: size, toX: 0, toY: size },
    { fromX: 0, fromY: size, toX: 0, toY: 0 }
  ];
  const start = startEdges ?? square(100);
  const end = endEdges ?? square(200);

  const startStream = new MorphWriter().edges(start).buffer();
  const endStream = new MorphWriter().edges(end).buffer();

  const styles = new MorphWriter();
  writeFills(styles);
  styles.u8(0); // no line styles
  const stylesBytes = styles.buffer();

  const head = new MorphWriter();
  head.u16(77);
  head.rect(); // StartBounds
  head.rect(); // EndBounds
  head.u32(stylesBytes.length + startStream.length); // Offset, from after this field
  return Buffer.concat([head.buffer(), stylesBytes, startStream, endStream]);
}

/** The same morph with one SOLID fill going red to blue. */
function morphBytes({ startEdges, endEdges, fill = [[0xcc, 0, 0, 0xff], [0, 0, 0xcc, 0xff]] } = {}) {
  return morphBytesWithFills((styles) => {
    styles.u8(1); // one fill style
    styles.u8(0x00); // solid
    styles.rgba(...fill[0]);
    styles.rgba(...fill[1]);
  }, { startEdges, endEdges });
}

/** One GRADIENT fill style, start and end, as a MORPHFILLSTYLE. */
function gradientBytes({ type = 0x10, spread = 0, interpolation = 0, stops, focal } = {}) {
  const list = stops ?? [
    { startRatio: 0, start: [0, 0, 0, 0xff], endRatio: 0, end: [0, 0, 0, 0xff] },
    { startRatio: 128, start: [0xcc, 0, 0, 0xff], endRatio: 32, end: [0, 0, 0xcc, 0xff] },
    { startRatio: 255, start: [0xff, 0xff, 0xff, 0x00], endRatio: 255, end: [0xff, 0xff, 0xff, 0xff] }
  ];
  return morphBytesWithFills((styles) => {
    styles.u8(1);
    styles.u8(type);
    styles.matrix({ a: 2, b: 0, c: 0, d: 2, tx: 100, ty: 200 });
    styles.matrix({ a: 4, b: 0.5, c: -0.25, d: 4, tx: 300, ty: 400 });
    styles.u8((spread << 6) | (interpolation << 4) | list.length);
    for (const stop of list) {
      styles.u8(stop.startRatio).rgba(...stop.start);
      styles.u8(stop.endRatio).rgba(...stop.end);
    }
    if (type === 0x13) {
      // FIXED8 twice: start then end. `u16` writes the low byte first, so a
      // negative focal point round-trips through two's complement.
      styles.u16(Math.round((focal?.[0] ?? 0) * 256));
      styles.u16(Math.round((focal?.[1] ?? 0) * 256));
    }
  });
}

/** One BITMAP fill style, start and end, as a MORPHFILLSTYLE. */
function bitmapBytes({ type = 0x40, bitmapId = 2101 } = {}) {
  return morphBytesWithFills((styles) => {
    styles.u8(1);
    styles.u8(type);
    styles.u16(bitmapId);
    styles.matrix({ a: 2, b: 0, c: 0, d: 2, tx: 100, ty: 200 });
    styles.matrix({ a: 4, b: 0.5, c: -0.25, d: 4, tx: 300, ty: 400 });
  });
}

test("a morph holds TWO shapes, and its header offset is a check the styles were read right", () => {
  const bytes = morphBytes();
  const morph = parseMorphShape(bytes, 0, bytes.length, 46);
  assert.equal(morph.id, 77);
  assert.equal(morph.version, 1);
  assert.equal(morph.fills.length, 1);
  assert.equal(morph.fills[0].kind, "solid");
  assert.deepEqual(morph.startEdges.length, morph.endEdges.length);
  assert.equal(morph.startEdges.length, 4);
});

test("a misread style array is CAUGHT by the offset rather than producing plausible nonsense", () => {
  // Corrupt the fill count so the style array is read as two styles. The edge
  // stream then starts in the wrong place and the header's offset disagrees.
  const bytes = morphBytes();
  const broken = Buffer.from(bytes);
  // The fill count is the first byte after the header: id(2) + two empty RECTs
  // (1 byte each) + offset(4) = 8.
  broken[8] = 2;
  assert.throws(() => parseMorphShape(broken, 0, broken.length, 46), (error) => {
    assert.ok(error instanceof MorphParseError);
    assert.match(error.message, /offset|misread|past the end/);
    return true;
  });
});

test("a STRAIGHT edge pairs with a CURVED one, which is why every edge is a quadratic", () => {
  // The specification pairs edges by ORDER and allows a line to morph into a
  // curve. Interpolating position-by-position as though both were lines is the
  // failure this promotion prevents.
  const straight = [
    { fromX: 0, fromY: 0, toX: 100, toY: 0 },
    { fromX: 100, fromY: 0, toX: 100, toY: 100 },
    { fromX: 100, fromY: 100, toX: 0, toY: 100 },
    { fromX: 0, fromY: 100, toX: 0, toY: 0 }
  ];
  const curved = straight.map((edge) => ({ ...edge, control: [edge.fromX + 40, edge.fromY - 40] }));
  const bytes = morphBytes({ startEdges: straight, endEdges: curved });
  const morph = parseMorphShape(bytes, 0, bytes.length, 46);

  // A straight edge's control point is its MIDPOINT, which leaves it straight.
  assert.deepEqual(morph.startEdges[0].control, [50, 0]);
  assert.equal(morph.startEdges[0].straight, true);
  assert.equal(morph.endEdges[0].straight, false);

  // Halfway, the control has moved half the way to the curve's.
  const middle = morphShapeAt(morph, 0.5);
  assert.deepEqual(middle.edges[0].control, [(50 + 40) / 2, (0 + -40) / 2]);
  assert.equal(middle.edges[0].straight, false, "a pair that curves at either end is drawn as a curve");

  // And a pair straight at BOTH ends stays a straight segment.
  const plain = parseMorphShape(morphBytes(), 0, morphBytes().length, 46);
  assert.equal(morphShapeAt(plain, 0.5).edges[0].straight, true);
});

test("positions and colours interpolate, and the ends are exactly the ends", () => {
  const bytes = morphBytes();
  const morph = parseMorphShape(bytes, 0, bytes.length, 46);

  assert.deepEqual(morphShapeAt(morph, 0).edges[0].to, [100, 0]);
  assert.deepEqual(morphShapeAt(morph, 1).edges[0].to, [200, 0]);
  assert.deepEqual(morphShapeAt(morph, 0.5).edges[0].to, [150, 0]);

  assert.deepEqual(morphShapeAt(morph, 0).fills[0].colour, { red: 0xcc, green: 0, blue: 0, alpha: 255 });
  assert.deepEqual(morphShapeAt(morph, 1).fills[0].colour, { red: 0, green: 0, blue: 0xcc, alpha: 255 });
  assert.deepEqual(morphShapeAt(morph, 0.5).fills[0].colour, { red: 102, green: 0, blue: 102, alpha: 255 });
});

test("a ratio outside 0..1 clamps rather than extrapolating the shape into nonsense", () => {
  const bytes = morphBytes();
  const morph = parseMorphShape(bytes, 0, bytes.length, 46);
  assert.deepEqual(morphShapeAt(morph, 2).edges[0].to, [200, 0]);
  assert.deepEqual(morphShapeAt(morph, -1).edges[0].to, [100, 0]);
  assert.deepEqual(morphShapeAt(morph, Number.NaN).edges[0].to, [100, 0]);
});

test("the wire's ratio is 0..65535 and `ratioOf` is the only place that knows it", () => {
  // `PlaceObject2` carries the ratio as a UI16. Passing one convention where
  // the other was meant would freeze every morph at its start frame.
  assert.equal(ratioOf(0), 0);
  assert.equal(ratioOf(65535), 1);
  assert.equal(Math.round(ratioOf(32768) * 100) / 100, 0.5);
  assert.equal(ratioOf(undefined), 0);
  assert.equal(ratioOf(99999), 1);
});

test("paths come out CLOSED, so the blood does not get the wedges the body had", () => {
  const bytes = morphBytes();
  const morph = parseMorphShape(bytes, 0, bytes.length, 46);
  const paths = morphToPaths(morphShapeAt(morph, 0));
  assert.equal(paths.length, 1);
  assert.equal(paths[0].d, "M0 0L5 0L5 5L0 5L0 0Z");
  assert.equal(paths[0].fill, "#cc0000");
  assert.equal(paths[0].fillRule, "evenodd");
});

test("DefineMorphShape2's line style is REFUSED BY NAME, not written blind", () => {
  // All 44 morphs in the shipped build are tag 46. A version-2 line style has
  // never been checked against real bytes, so guessing at it would be a parser
  // that is wrong later, somewhere else.
  const styles = new MorphWriter();
  styles.u8(0); // no fill styles
  styles.u8(1); // one line style
  styles.u16(20).u16(40).u16(0); // start width, end width, flags
  const body = Buffer.concat([
    new MorphWriter().u16(9).rect().rect().rect().rect().u8(0).u32(0).buffer(),
    styles.buffer()
  ]);
  assert.throws(() => parseMorphShape(body, 0, body.length, 84), /MORPHLINESTYLE2|not supported/);
});

test("morphColourAt is total, because a missing style must not crash a drawing", () => {
  assert.equal(morphColourAt(null, 0.5), null);
  assert.equal(morphColourAt({ start: null, end: null }, 0.5), null);
});

/* ------------------------------------------------------------------ */
/* THE TWO DEAD BRANCHES: gradient and bitmap morph fills.            */
/*                                                                    */
/* Both were repaired in `tools/swf-shapes.mjs` for STATIC shapes and  */
/* left unrepaired here, so the same art would have been lost twice by */
/* two different files. Neither branch is reachable in the shipped     */
/* build — 97 fills, all solid — so every buffer below is hand-built   */
/* and nothing here is evidence about the oracle.                     */
/* ------------------------------------------------------------------ */

test("a morph BITMAP fill keeps its id, BOTH matrices and its repeat flag", () => {
  // ► **IT USED TO RETURN `{ kind: "bitmap", bitmapId }` AND NOTHING ELSE, and
  //   `morphToPaths` turned that into `fill: "none"` with no id at all.** A
  //   bitmap fill is an image PLUS the transform that places it in the shape's
  //   space; with the transform skipped there is nothing a renderer could draw,
  //   which is how the arena wall went missing out of static shapes.
  const bytes = bitmapBytes({ bitmapId: 2101 });
  const morph = parseMorphShape(bytes, 0, bytes.length, 46);
  assert.equal(morph.fills.length, 1);
  assert.equal(morph.fills[0].kind, "bitmap");
  assert.equal(morph.fills[0].bitmapId, 2101);
  assert.deepEqual(morph.fills[0].startMatrix, { a: 2, b: 0, c: 0, d: 2, tx: 100, ty: 200 });
  assert.deepEqual(morph.fills[0].endMatrix, { a: 4, b: 0.5, c: -0.25, d: 4, tx: 300, ty: 400 });

  // And the matrix INTERPOLATES, because a morph moves its fill as well as its
  // outline. tx/ty stay in TWIPS: a consumer divides by 20, and the `d` data
  // beside them is already in pixels.
  assert.deepEqual(morphShapeAt(morph, 0).fills[0].matrix, { a: 2, b: 0, c: 0, d: 2, tx: 100, ty: 200 });
  assert.deepEqual(morphShapeAt(morph, 0.5).fills[0].matrix, { a: 3, b: 0.25, c: -0.125, d: 3, tx: 200, ty: 300 });
  assert.deepEqual(morphShapeAt(morph, 1).fills[0].matrix, { a: 4, b: 0.5, c: -0.25, d: 4, tx: 300, ty: 400 });
});

test("the bitmap fill TYPE says tile-or-clip and smoothed-or-not, and both used to be dropped", () => {
  // 0x40/0x42 TILE and 0x41/0x43 clip to ONE copy. A renderer that ignored
  // `repeat` would draw a single copy on an otherwise bare region, which reads
  // as a missing asset rather than as a wrong flag.
  function flagsOf(type) {
    const bytes = bitmapBytes({ type });
    const style = parseMorphShape(bytes, 0, bytes.length, 46).fills[0];
    assert.equal(style.kind, "bitmap", "every 0x40..0x43 is a bitmap fill");
    return { repeat: style.repeat, smoothed: style.smoothed };
  }
  assert.deepEqual(flagsOf(0x40), { repeat: true, smoothed: true });
  assert.deepEqual(flagsOf(0x41), { repeat: false, smoothed: true });
  assert.deepEqual(flagsOf(0x42), { repeat: true, smoothed: false });
  assert.deepEqual(flagsOf(0x43), { repeat: false, smoothed: false });
});

test("a morph gradient's STOP RATIOS interpolate — every one of them used to be zero", () => {
  // ► **THIS IS A WRONG-COLOUR BUG, not an approximation.** Every stop was
  //   emitted with `ratio: 0` unconditionally, so the whole ramp piled onto the
  //   left edge and the region painted as its LAST stop. Nothing counted it,
  //   because from the outside it is still a gradient with stops.
  const bytes = gradientBytes();
  const morph = parseMorphShape(bytes, 0, bytes.length, 46);
  assert.deepEqual(morph.fills[0].stops.map((stop) => stop.startRatio), [0, 128, 255]);
  assert.deepEqual(morph.fills[0].stops.map((stop) => stop.endRatio), [0, 32, 255]);

  function ratiosAt(ratio) {
    const stops = morphShapeAt(morph, ratio).fills[0].stops;
    assert.equal(stops.length, 3, "a stop must not go missing on the way through");
    return stops.map((stop) => stop.ratio);
  }
  assert.deepEqual(ratiosAt(0), [0, 128, 255]);
  assert.deepEqual(ratiosAt(1), [0, 32, 255]);
  assert.deepEqual(ratiosAt(0.5), [0, 80, 255]);
  // The colours interpolate alongside, and the middle stop is the one that
  // moves in BOTH — a reader that lerped only one of the two is caught here.
  assert.deepEqual(morphShapeAt(morph, 0.5).fills[0].stops[1].colour, { red: 102, green: 0, blue: 102, alpha: 255 });
});

test("a morph gradient's MATRIX is read and interpolated, not skipped past", () => {
  const bytes = gradientBytes();
  const morph = parseMorphShape(bytes, 0, bytes.length, 46);
  assert.deepEqual(morph.fills[0].startMatrix, { a: 2, b: 0, c: 0, d: 2, tx: 100, ty: 200 });
  assert.deepEqual(morph.fills[0].endMatrix, { a: 4, b: 0.5, c: -0.25, d: 4, tx: 300, ty: 400 });
  assert.deepEqual(morphShapeAt(morph, 0.5).fills[0].matrix, { a: 3, b: 0.25, c: -0.125, d: 3, tx: 200, ty: 300 });
  // `b` and `c` are RotateSkew0 and RotateSkew1 in that order on the wire. A
  // reader that fills them in left-to-right transposes every rotation, and
  // -0.25 landing in `b` rather than `c` is what that looks like from here.
  assert.equal(morph.fills[0].endMatrix.b, 0.5);
  assert.equal(morph.fills[0].endMatrix.c, -0.25);
});

test("spread and interpolation live in the top nibble of the count byte and used to be masked away", () => {
  // ► `& 0x0f` took the stop count and threw the rest of the byte away with no
  //   record, so a REFLECTED, linear-RGB ramp would have been drawn padded and
  //   in sRGB with nothing anywhere saying it had been changed.
  const bytes = gradientBytes({ spread: 1, interpolation: 1 });
  const style = parseMorphShape(bytes, 0, bytes.length, 46).fills[0];
  assert.equal(style.spread, 1, "1 is REFLECT, and it is not canvas's default");
  assert.equal(style.interpolation, 1, "1 is linear RGB, and it is not canvas's default");
  assert.equal(style.stops.length, 3, "the count still comes out of the low nibble");
  assert.equal(style.gradientType, "linear");
  assert.equal(style.focal, false);

  const radial = gradientBytes({ type: 0x12 });
  assert.equal(parseMorphShape(radial, 0, radial.length, 46).fills[0].gradientType, "radial");
});

test("a FOCAL gradient's point is SIGNED, interpolates, and its four extra bytes are accounted for", () => {
  // ► **PARSING AT ALL IS HALF THE ASSERTION HERE.** Measured by running this
  //   buffer through the pre-repair parser: with the two FIXED8s unread,
  //   everything after them shifts four bytes, the LINE style array is read out
  //   of the focal point's own bytes, and `readColour` runs past the end of the
  //   tag — `MorphParseError: morph header ran past the end of its tag`. So the
  //   byte count is checked by this test even though nothing below names it.
  //
  // ► `tools/swf-shapes.mjs` reads the same field UNSIGNED, which turns -0.5
  //   into 255.5. That divergence is deliberate and is NOT fixed here: that
  //   file belongs to another seam, and this is where it is written down.
  const bytes = gradientBytes({ type: 0x13, focal: [-0.5, 0.5] });
  const morph = parseMorphShape(bytes, 0, bytes.length, 46);
  assert.equal(morph.fills[0].focal, true);
  assert.equal(morph.fills[0].gradientType, "radial");
  assert.equal(morph.fills[0].startFocalPoint, -0.5);
  assert.equal(morph.fills[0].endFocalPoint, 0.5);
  assert.equal(morphShapeAt(morph, 0).fills[0].focalPoint, -0.5);
  assert.equal(morphShapeAt(morph, 0.5).fills[0].focalPoint, 0);
  assert.equal(morphShapeAt(morph, 1).fills[0].focalPoint, 0.5);
});

test("morphToPaths hands on the REAL gradient beside the flat fallback, and still counts it", () => {
  const bytes = gradientBytes({ spread: 2, interpolation: 1 });
  const morph = parseMorphShape(bytes, 0, bytes.length, 46);
  const paths = morphToPaths(morphShapeAt(morph, 0));
  assert.equal(paths.length, 1);
  // The geometry is the same square the solid test gets: a fill this parser
  // cannot paint exactly must never cost the SHAPE as well as the paint.
  assert.equal(paths[0].d, "M0 0L5 0L5 5L0 5L0 0Z");
  // The flat fallback is still stop[0] and is still wrong in both directions —
  // a ramp that starts transparent draws nothing, one that fades to transparent
  // draws opaque — so `approximated` must survive BESIDE the real gradient.
  assert.equal(paths[0].fill, "#000000");
  assert.equal(paths[0].approximated, "gradient");
  assert.equal(paths[0].gradient.type, "linear");
  assert.equal(paths[0].gradient.spread, 2);
  assert.equal(paths[0].gradient.interpolation, 1);
  assert.deepEqual(paths[0].gradient.matrix, { a: 2, b: 0, c: 0, d: 2, tx: 100, ty: 200 });
  // ► `ratio / 255`, NEVER "evenly spaced". Three stops evenly spaced would be
  //   0, 0.5, 1; this ramp's middle stop is at 128/255, and real ramps start
  //   late or end early and rely on PAD.
  assert.deepEqual(paths[0].gradient.stops.map((stop) => stop.offset), [0, 128 / 255, 1]);
  assert.deepEqual(paths[0].gradient.stops.map((stop) => stop.fill), ["#000000", "#cc0000", "#ffffff"]);
  assert.deepEqual(paths[0].gradient.stops.map((stop) => stop.opacity), [1, 1, 0]);
});

test("morphToPaths hands on the REAL bitmap, with the id and matrix it used to drop", () => {
  const bytes = bitmapBytes({ bitmapId: 2101, type: 0x41 });
  const morph = parseMorphShape(bytes, 0, bytes.length, 46);
  const paths = morphToPaths(morphShapeAt(morph, 1));
  assert.equal(paths.length, 1);
  assert.equal(paths[0].d, "M0 0L10 0L10 10L0 10L0 0Z", "the END square, in pixels, not a dropped shape");
  assert.equal(paths[0].fill, "none", "a caller that cannot draw an image still gets a paint it can refuse");
  assert.equal(paths[0].approximated, "bitmap");
  assert.deepEqual(paths[0].bitmap, {
    id: 2101,
    matrix: { a: 4, b: 0.5, c: -0.25, d: 4, tx: 300, ty: 400 },
    repeat: false
  });
});

test("an approximated path carries what it approximated, so a counter and a renderer agree", () => {
  // THE RULE: an approximation that is not counted is indistinguishable from a
  // correct read. The converse bites too — `approximated: "bitmap"` with no
  // bitmap told a counter something and told a renderer nothing it could act
  // on, so there was no way back to the picture from the tally.
  const cases = [
    { bytes: morphBytes(), kind: null },
    { bytes: gradientBytes(), kind: "gradient" },
    { bytes: bitmapBytes(), kind: "bitmap" }
  ];
  for (const { bytes, kind } of cases) {
    const morph = parseMorphShape(bytes, 0, bytes.length, 46);
    const [path] = morphToPaths(morphShapeAt(morph, 0.5));
    assert.equal(path.approximated, kind);
    assert.ok(path.d.length > 0, "no fill kind may emit a silently empty path");
    assert.equal("gradient" in path, kind === "gradient");
    assert.equal("bitmap" in path, kind === "bitmap");
  }
});
