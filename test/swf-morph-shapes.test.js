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

/** A square that morphs into a bigger square, one solid fill going red to blue. */
function morphBytes({ startEdges, endEdges, fill = [[0xcc, 0, 0, 0xff], [0, 0, 0xcc, 0xff]] } = {}) {
  const square = (size) => [
    { fromX: 0, fromY: 0, toX: size, toY: 0 },
    { fromX: size, fromY: 0, toX: size, toY: size },
    { fromX: size, fromY: size, toX: 0, toY: size },
    { fromX: 0, fromY: size, toX: 0, toY: 0 }
  ];
  const start = startEdges ?? square(100);
  const end = endEdges ?? square(200);

  // The edge streams first, so the header's offset can be measured not guessed.
  const startStream = new MorphWriter().edges(start).buffer();
  const endStream = new MorphWriter().edges(end).buffer();

  const styles = new MorphWriter();
  styles.u8(1); // one fill style
  styles.u8(0x00); // solid
  styles.rgba(...fill[0]);
  styles.rgba(...fill[1]);
  styles.u8(0); // no line styles
  const stylesBytes = styles.buffer();

  const head = new MorphWriter();
  head.u16(77);
  head.rect(); // StartBounds
  head.rect(); // EndBounds
  head.u32(stylesBytes.length + startStream.length); // Offset, from after this field
  return Buffer.concat([head.buffer(), stylesBytes, startStream, endStream]);
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
