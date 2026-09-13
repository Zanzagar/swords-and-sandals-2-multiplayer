/**
 * The SWF shape parser, against SYNTHETIC shapes built in this file.
 *
 * ► **Nothing here comes from the licensed build, and that is deliberate.** A
 *   test that embedded real shape bytes would put extracted art in the
 *   repository, which is the one thing `assets/` exists to prevent. These bytes
 *   are assembled by `ShapeWriter` below from the SWF specification's own
 *   encoding, so the parser is checked against the FORMAT rather than against
 *   one file's contents.
 *
 * What the real build contributes is a single number, quoted and not stored:
 * all 824 of its shapes parse with zero failures. That is reproduced by running
 * the extractor, never by committing a fixture.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { parseShape, shapeToPaths, cssColour, ShapeParseError } from "../tools/swf-shapes.mjs";

/** Assembles the bit-level encoding the parser has to survive. */
class ShapeWriter {
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

  /** An all-zero RECT: five bits of width, then four zero fields. */
  rect() {
    this.align();
    return this.ub(0, 5).align();
  }

  buffer() {
    this.align();
    return Buffer.from(this.bytes);
  }
}

/** DefineShape3 (alpha-bearing) holding one solid fill and one square. */
function squareShape({ id = 7, colour = { red: 0x11, green: 0x22, blue: 0x33, alpha: 0xff } } = {}) {
  const writer = new ShapeWriter();
  writer.u16(id);
  writer.rect();
  // FILLSTYLEARRAY: one solid RGBA fill.
  writer.u8(1).u8(0x00).u8(colour.red).u8(colour.green).u8(colour.blue).u8(colour.alpha);
  writer.u8(0); // no line styles
  writer.ub(1, 4).ub(0, 4); // fillBits = 1, lineBits = 0

  // StateMoveTo + StateFillStyle1, then four straight edges, then end.
  writer.bit(0).ub(0b00101, 5);
  writer.ub(10, 5).sb(0, 10).sb(0, 10);  // move to 0,0
  writer.ub(1, 1);                        // fillStyle1 = 1
  const edge = (dx, dy) => {
    writer.bit(1).bit(1).ub(10 - 2, 4);
    writer.bit(1).sb(dx, 10).sb(dy, 10);  // general line
  };
  edge(200, 0);
  edge(0, 200);
  edge(-200, 0);
  edge(0, -200);
  writer.bit(0).ub(0, 5);                 // EndShapeRecord
  return writer.buffer();
}

test("a solid-filled square becomes one SVG path in pixels, not twips", () => {
  const bytes = squareShape();
  const shape = parseShape(bytes, 0, bytes.length, 32);

  assert.equal(shape.id, 7);
  assert.equal(shape.version, 3);
  assert.equal(shape.fills.length, 1);
  assert.equal(shape.fills[0].kind, "solid");

  const paths = shapeToPaths(shape);
  assert.equal(paths.length, 1);
  // 200 twips is 10 pixels. A parser that forgot the conversion would say 200.
  assert.equal(paths[0].d, "M0 0l10 0l0 10l-10 0l0 -10");
  assert.equal(paths[0].fill, "#112233");
  assert.equal(paths[0].fillOpacity, 1);
  assert.equal(paths[0].approximated, null);
});

test("alpha survives on a shape version that carries it, and is absent on one that does not", () => {
  const translucent = squareShape({ colour: { red: 0, green: 0, blue: 0, alpha: 128 } });
  const shape = parseShape(translucent, 0, translucent.length, 32);
  assert.equal(shapeToPaths(shape)[0].fillOpacity, 0.502);

  // DefineShape (version 1) fills are RGB with no alpha byte. Reading one as
  // RGBA desynchronises every record after it, which is why the version drives
  // the read rather than a guess.
  const writer = new ShapeWriter();
  writer.u16(9);
  writer.rect();
  writer.u8(1).u8(0x00).u8(0xff).u8(0x00).u8(0x00); // solid RGB, no alpha
  writer.u8(0);
  writer.ub(1, 4).ub(0, 4);
  writer.bit(0).ub(0b00101, 5);
  writer.ub(6, 5).sb(0, 6).sb(0, 6);
  writer.ub(1, 1);
  writer.bit(1).bit(1).ub(8 - 2, 4).bit(1).sb(20, 8).sb(0, 8);
  writer.bit(0).ub(0, 5);
  const bytes = writer.buffer();
  const plain = parseShape(bytes, 0, bytes.length, 2);
  assert.equal(plain.version, 1);
  assert.equal(shapeToPaths(plain)[0].fill, "#ff0000");
  assert.equal(shapeToPaths(plain)[0].fillOpacity, 1);
});

test("a curved edge becomes a quadratic, with the control point relative", () => {
  const writer = new ShapeWriter();
  writer.u16(3);
  writer.rect();
  writer.u8(1).u8(0x00).u8(0).u8(0).u8(0).u8(0xff);
  writer.u8(0);
  writer.ub(1, 4).ub(0, 4);
  writer.bit(0).ub(0b00101, 5);
  writer.ub(10, 5).sb(0, 10).sb(0, 10);
  writer.ub(1, 1);
  // CurvedEdge: control (20,40) then anchor (60,0) — both deltas.
  writer.bit(1).bit(0).ub(10 - 2, 4);
  writer.sb(20, 10).sb(40, 10).sb(60, 10).sb(0, 10);
  writer.bit(0).ub(0, 5);
  const bytes = writer.buffer();
  const paths = shapeToPaths(parseShape(bytes, 0, bytes.length, 32));
  // The anchor is relative to the CONTROL point, so the end is control+anchor.
  assert.equal(paths[0].d, "M0 0q1 2 4 2");
});

test("a gradient is flattened to its first stop and SAYS it was approximated", () => {
  // A shape that silently vanished would be worse than one drawn flat, and a
  // flat one that does not admit it is worse than both.
  const writer = new ShapeWriter();
  writer.u16(4);
  writer.rect();
  writer.u8(1).u8(0x10);            // one LINEAR gradient fill
  // MATRIX, identity: hasScale=0, hasRotate=0, then a 5-bit translate width of
  // zero and no translate fields. The first version of this test wrote two
  // 5-bit runs instead, which is not the MATRIX encoding and desynchronised
  // everything after it — the parser was right and the fixture was wrong.
  writer.align();
  writer.bit(0).bit(0).ub(0, 5).align();
  writer.u8(2);                     // two stops
  writer.u8(0).u8(0x10).u8(0x20).u8(0x30).u8(0xff);
  writer.u8(255).u8(0x90).u8(0xa0).u8(0xb0).u8(0xff);
  writer.u8(0);
  writer.ub(1, 4).ub(0, 4);
  writer.bit(0).ub(0b00101, 5);
  writer.ub(8, 5).sb(0, 8).sb(0, 8);
  writer.ub(1, 1);
  writer.bit(1).bit(1).ub(8 - 2, 4).bit(1).sb(20, 8).sb(20, 8);
  writer.bit(0).ub(0, 5);
  const bytes = writer.buffer();
  const shape = parseShape(bytes, 0, bytes.length, 32);
  assert.equal(shape.fills[0].kind, "gradient");
  assert.equal(shape.fills[0].stops.length, 2);

  const paths = shapeToPaths(shape);
  assert.equal(paths[0].fill, "#102030", "the first stop");
  assert.equal(paths[0].approximated, "gradient", "and it admits the approximation");
});

test("a truncated shape throws by name rather than returning half a figure", () => {
  const bytes = squareShape().subarray(0, 8);
  assert.throws(
    () => parseShape(bytes, 0, bytes.length, 32),
    (error) => error instanceof ShapeParseError
  );
});

test("cssColour is total, because a missing style must not crash a drawing", () => {
  assert.deepEqual(cssColour(null), { fill: "none", opacity: 1 });
  assert.deepEqual(
    cssColour({ red: 255, green: 255, blue: 255, alpha: 255 }),
    { fill: "#ffffff", opacity: 1 }
  );
  assert.deepEqual(
    cssColour({ red: 0, green: 0, blue: 0, alpha: 0 }),
    { fill: "#000000", opacity: 0 }
  );
});
