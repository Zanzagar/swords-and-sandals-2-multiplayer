/**
 * The SWF display-list resolver, against SYNTHETIC timelines built in this file.
 *
 * ► **Nothing here comes from the licensed build, for the same reason
 *   `test/swf-shapes.test.js` builds its own shape bytes.** A fixture of real
 *   `PlaceObject` tags would put extracted art — the POSE half of it — in the
 *   repository, which is the one thing `assets/` exists to prevent. `SwfWriter`
 *   below assembles the specification's own encoding, so the parser is checked
 *   against the FORMAT rather than against one file's contents.
 *
 * What the real build contributes is numbers, quoted and not stored: clip 1241
 * resolves to 101 animations, 2,222 poses, 37,077 placements and 61 shapes with
 * zero parse failures. Reproduce that with `node tools/extract-figure.mjs
 * --report`, never by committing a fixture.
 *
 * The tests are written against the traps rather than against the happy path,
 * because every one of these mistakes produces a figure that still LOOKS like a
 * figure: a transposed rotation is a plausible pose, a replace that inherits
 * the old matrix is a limb that failed to move, and a dropped morph is a
 * missing splash of blood nobody notices.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DisplayListError,
  IDENTITY_COLOUR_TRANSFORM,
  IDENTITY_MATRIX,
  TAG,
  composeColourTransform,
  composeMatrix,
  deriveAnimations,
  flattenFrame,
  indexCharacters,
  parsePlaceObject,
  readColourTransform,
  readFrameLabels,
  readMatrix,
  resolveTimeline,
  skipFilterList,
  tagStreamStart,
  walkTags
} from "../tools/swf-display-list.mjs";

/** Assembles the bit- and byte-level encoding the parser has to survive. */
class SwfWriter {
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

  string(value) {
    this.align();
    for (const byte of Buffer.from(value, "utf8")) this.bytes.push(byte);
    this.bytes.push(0);
    return this;
  }

  raw(bytes) {
    this.align();
    for (const byte of bytes) this.bytes.push(byte);
    return this;
  }

  /** A RECT wide enough for its fields, which is what the format actually does. */
  rect(xMin, xMax, yMin, yMax) {
    this.align();
    const needed = Math.max(1, ...[xMin, xMax, yMin, yMax].map((value) => {
      let bits = 1;
      while (value < -(2 ** (bits - 1)) || value > 2 ** (bits - 1) - 1) bits += 1;
      return bits;
    }));
    this.ub(needed, 5);
    this.sb(xMin, needed).sb(xMax, needed).sb(yMin, needed).sb(yMax, needed);
    this.align();
    return this;
  }

  /**
   * A MATRIX. `b` is RotateSkew0 and `c` is RotateSkew1 — written in that
   * order because that is the order on the wire, which is the trap the
   * parser's own comment names.
   */
  matrix({ a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0 } = {}) {
    this.align();
    const fixed = (value) => Math.round(value * 65536);
    const width = (...values) => Math.max(1, ...values.map((value) => {
      let bits = 1;
      while (value < -(2 ** (bits - 1)) || value > 2 ** (bits - 1) - 1) bits += 1;
      return bits;
    }));
    const hasScale = a !== 1 || d !== 1;
    this.bit(hasScale ? 1 : 0);
    if (hasScale) {
      const bits = width(fixed(a), fixed(d));
      this.ub(bits, 5).sb(fixed(a), bits).sb(fixed(d), bits);
    }
    const hasRotate = b !== 0 || c !== 0;
    this.bit(hasRotate ? 1 : 0);
    if (hasRotate) {
      const bits = width(fixed(b), fixed(c));
      this.ub(bits, 5).sb(fixed(b), bits).sb(fixed(c), bits);
    }
    const translateBits = width(tx, ty);
    this.ub(translateBits, 5).sb(tx, translateBits).sb(ty, translateBits);
    this.align();
    return this;
  }

  /** A CXFORMWITHALPHA. Add flag first on the wire, multiply block first after it. */
  colourTransform({ multiply = null, add = null, bits = 9 } = {}) {
    this.align();
    this.bit(add ? 1 : 0);
    this.bit(multiply ? 1 : 0);
    this.ub(bits, 4);
    if (multiply) for (const value of multiply) this.sb(Math.round(value * 256), bits);
    if (add) for (const value of add) this.sb(value, bits);
    this.align();
    return this;
  }

  /**
   * A FILTERLIST. Only the two filters these tests need are emitted; the point
   * is the LENGTH, because the field after a filter list is the blend mode.
   */
  filterList(filters) {
    this.align();
    this.u8(filters.length);
    for (const filter of filters) {
      this.u8(filter.id);
      if (filter.id === 1) this.raw(Buffer.alloc(9));       // Blur: 9 bytes
      else if (filter.id === 6) this.raw(Buffer.alloc(80)); // ColorMatrix: twenty floats
      else if (filter.id === 4) {
        // GradientGlow: a colour count, then 5 bytes each, then 23.
        this.u8(filter.colours);
        this.raw(Buffer.alloc(filter.colours * 5 + 23));
      } else throw new Error(`test writer has no filter ${filter.id}`);
    }
    return this;
  }

  toBuffer() {
    this.align();
    return Buffer.from(this.bytes);
  }
}

/** One tag: a 10-bit code and a length that grows to 32 bits past 62 bytes. */
function tag(code, body) {
  const writer = new SwfWriter();
  const bytes = Buffer.isBuffer(body) ? body : body.toBuffer();
  if (bytes.length >= 0x3f) {
    writer.u16((code << 6) | 0x3f);
    writer.u32(bytes.length);
  } else {
    writer.u16((code << 6) | bytes.length);
  }
  writer.raw(bytes);
  return writer.toBuffer();
}

/** A whole FWS file around a tag stream, with a RECT wide enough to matter. */
function swf(tags) {
  const header = new SwfWriter();
  header.raw(Buffer.from("FWS", "latin1"));
  header.u8(6);
  header.u32(0); // File length; nothing here reads it.
  header.rect(0, 11000, 0, 8000);
  header.u16(24 << 8); // Frame rate, 8.8 fixed.
  header.u16(1);
  return Buffer.concat([header.toBuffer(), ...tags, tag(TAG.END, Buffer.alloc(0))]);
}

/**
 * A `PlaceObject3` body, written field by field in the specification's own
 * order — which is NOT the flag order: FILTERLIST comes before BlendMode.
 */
function place3({ depth, characterId, matrix, name, clipDepth, className, filters, blendMode, bitmapCache, visible, move = false, hasImage = false }) {
  const writer = new SwfWriter();
  let flags = 0;
  let flags2 = 0;
  if (move) flags |= 0x01;
  if (characterId !== undefined) flags |= 0x02;
  if (matrix) flags |= 0x04;
  if (name !== undefined) flags |= 0x20;
  if (clipDepth !== undefined) flags |= 0x40;
  if (filters) flags2 |= 0x01;
  if (blendMode !== undefined) flags2 |= 0x02;
  if (bitmapCache !== undefined) flags2 |= 0x04;
  if (className !== undefined && !hasImage) flags2 |= 0x08;
  if (hasImage) flags2 |= 0x10;
  if (visible !== undefined) flags2 |= 0x20;
  writer.u8(flags).u8(flags2).u16(depth);
  if (className !== undefined) writer.string(className);
  if (characterId !== undefined) writer.u16(characterId);
  if (matrix) writer.matrix(matrix);
  if (name !== undefined) writer.string(name);
  if (clipDepth !== undefined) writer.u16(clipDepth);
  if (filters) writer.filterList(filters);
  if (blendMode !== undefined) writer.u8(blendMode);
  if (bitmapCache !== undefined) writer.u8(bitmapCache ? 1 : 0);
  if (visible !== undefined) writer.u8(visible ? 1 : 0);
  return writer;
}

/** A `PlaceObject2` body, written field by field in the specification's order. */
function place2({ depth, characterId, matrix, colourTransform, ratio, name, clipDepth, move = false }) {
  const writer = new SwfWriter();
  let flags = 0;
  if (move) flags |= 0x01;
  if (characterId !== undefined) flags |= 0x02;
  if (matrix) flags |= 0x04;
  if (colourTransform) flags |= 0x08;
  if (ratio !== undefined) flags |= 0x10;
  if (name !== undefined) flags |= 0x20;
  if (clipDepth !== undefined) flags |= 0x40;
  writer.u8(flags);
  writer.u16(depth);
  if (characterId !== undefined) writer.u16(characterId);
  if (matrix) writer.matrix(matrix);
  if (colourTransform) writer.colourTransform(colourTransform);
  if (ratio !== undefined) writer.u16(ratio);
  if (name !== undefined) writer.string(name);
  if (clipDepth !== undefined) writer.u16(clipDepth);
  return writer;
}

/** The smallest `DefineShape` the indexer needs: it only reads the id. */
function defineShape(id) {
  const writer = new SwfWriter();
  writer.u16(id).rect(0, 100, 0, 100).u8(0).u8(0).u8(0);
  return tag(TAG.DEFINE_SHAPE, writer);
}

function defineMorph(id) {
  const writer = new SwfWriter();
  writer.u16(id).raw(Buffer.alloc(8));
  return tag(TAG.DEFINE_MORPH_SHAPE, writer);
}

function defineSprite(id, frameCount, innerTags) {
  const writer = new SwfWriter();
  writer.u16(id).u16(frameCount).raw(Buffer.concat([...innerTags, tag(TAG.END, Buffer.alloc(0))]));
  return tag(TAG.DEFINE_SPRITE, writer);
}

const showFrame = () => tag(TAG.SHOW_FRAME, Buffer.alloc(0));
const frameLabel = (name) => tag(TAG.FRAME_LABEL, new SwfWriter().string(name));

test("the tag stream starts past a RECT whose width is a bit field, not a constant", () => {
  const buffer = swf([defineShape(1)]);
  const start = tagStreamStart(buffer);
  const tags = [...walkTags(buffer, start, buffer.length)];
  assert.equal(tags.length, 1);
  assert.equal(tags[0].code, TAG.DEFINE_SHAPE);
});

test("a compressed SWF is refused BY NAME rather than parsed as garbage", () => {
  const buffer = swf([defineShape(1)]);
  for (const signature of ["CWS", "ZWS"]) {
    const compressed = Buffer.from(buffer);
    compressed.write(signature, 0, "latin1");
    assert.throws(() => tagStreamStart(compressed), (error) => {
      assert.ok(error instanceof DisplayListError);
      assert.match(error.message, new RegExp(signature));
      return true;
    });
  }
  const notSwf = Buffer.from(buffer);
  notSwf.write("ZIP", 0, "latin1");
  assert.throws(() => tagStreamStart(notSwf), /Not a SWF/);
});

test("a tag longer than 62 bytes uses the 32-bit length form and still walks", () => {
  const long = Buffer.alloc(500, 7);
  const buffer = swf([tag(TAG.DO_ACTION, long), defineShape(9)]);
  const codes = [...walkTags(buffer, tagStreamStart(buffer), buffer.length)].map((entry) => entry.code);
  assert.deepEqual(codes, [TAG.DO_ACTION, TAG.DEFINE_SHAPE]);
});

test("characters are indexed by KIND, and sprites are recursed into", () => {
  const buffer = swf([
    defineShape(10),
    defineMorph(11),
    defineSprite(20, 1, [tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 10, matrix: {} })), showFrame()]),
    // A shape defined INSIDE a sprite is still a shape. The build nests almost
    // everything, including the fighter's own limbs.
    defineSprite(21, 1, [defineShape(12), showFrame()]),
    tag(TAG.EXPORT_ASSETS, new SwfWriter().u16(1).u16(20).string("hero_battle"))
  ]);
  const { characters } = indexCharacters(buffer);
  assert.equal(characters.get(10).kind, "shape");
  assert.equal(characters.get(11).kind, "morph");
  assert.equal(characters.get(20).kind, "sprite");
  assert.equal(characters.get(20).frames, 1);
  assert.equal(characters.get(20).exportName, "hero_battle");
  assert.equal(characters.get(12).kind, "shape", "a shape nested inside a sprite must still be indexed");
});

test("PlaceObject (tag 4) has NO flag byte, and reading one desynchronises the tag", () => {
  // The trap: tag 26 is everywhere and tag 4 is rare, so the reflex is to treat
  // the first byte as flags. Here that first byte is the LOW HALF OF THE
  // CHARACTER ID, and everything after it would land in the wrong place.
  const body = new SwfWriter().u16(0x1234).u16(5).matrix({ tx: 40, ty: -60 });
  const placement = parsePlaceObject(body.toBuffer(), 0, body.toBuffer().length, TAG.PLACE_OBJECT);
  assert.equal(placement.characterId, 0x1234);
  assert.equal(placement.depth, 5);
  assert.equal(placement.matrix.tx, 40);
  assert.equal(placement.matrix.ty, -60);
  assert.equal(placement.move, false);
  assert.equal(placement.colourTransform, undefined, "no bytes remain, so there is no colour transform");
});

test("PlaceObject3's second flag byte carries a class name that shifts every later field", () => {
  const body = place3({ depth: 9, className: "Sprite77", characterId: 1241, matrix: { tx: 12, ty: 34 }, name: "torso", blendMode: 3 });
  const bytes = body.toBuffer();
  const placement = parsePlaceObject(bytes, 0, bytes.length, TAG.PLACE_OBJECT3);
  assert.equal(placement.className, "Sprite77");
  assert.equal(placement.characterId, 1241);
  assert.equal(placement.depth, 9);
  assert.equal(placement.name, "torso");
  assert.equal(placement.blendMode, 3);
});

test("ClassName is ALSO present on HasImage plus HasCharacter, with no HasClassName bit", () => {
  // The specification's condition is an OR, and reading it as one bit makes the
  // first two bytes of the class name into the character id. The shipped build
  // sets HasImage on none of its 1,522 PlaceObject3 tags, so this is the format
  // being right rather than this extraction being fixed.
  const body = place3({ depth: 3, className: "A", characterId: 7, hasImage: true, matrix: { tx: 5 } });
  const bytes = body.toBuffer();
  const placement = parsePlaceObject(bytes, 0, bytes.length, TAG.PLACE_OBJECT3);
  assert.equal(placement.className, "A");
  assert.equal(placement.characterId, 7, "reading the class name as the id would give 65 — 'A'");
  assert.equal(placement.matrix.tx, 5);
});

test("FILTERLIST sits BEFORE BlendMode, so a blend mode read at the wrong cursor is the filter count", () => {
  // Measured on the shipped build: 1,507 of its 1,522 PlaceObject3 tags carry a
  // filter list and THREE carry a filter list and a blend mode, so the first
  // version of this parser was wrong in three live places.
  const body = place3({
    depth: 2, characterId: 8, matrix: {},
    filters: [{ id: 1 }, { id: 6 }, { id: 4, colours: 3 }],
    blendMode: 9, bitmapCache: true, visible: false
  });
  const bytes = body.toBuffer();
  const placement = parsePlaceObject(bytes, 0, bytes.length, TAG.PLACE_OBJECT3);
  assert.equal(placement.hasFilters, true);
  assert.equal(placement.blendMode, 9, "a cursor left at the filter list would read the count, 3");
  assert.equal(placement.bitmapCache, true);
  assert.equal(placement.visible, false);
});

test("every filter's length is known, and an unknown filter id throws rather than guessing", () => {
  const list = new SwfWriter().filterList([{ id: 1 }, { id: 6 }, { id: 4, colours: 2 }]).toBuffer();
  assert.equal(skipFilterList(list, 0, list.length), list.length);
  const unknown = Buffer.from([1, 99]);
  assert.throws(() => skipFilterList(unknown, 0, unknown.length), /Unknown SWF filter id 99/);
  const truncated = Buffer.from([4]);
  assert.throws(() => skipFilterList(truncated, 0, truncated.length), /ran past the end/);
});

test("a matrix's b and c are RotateSkew0 and RotateSkew1 — a transposed read is a plausible pose", () => {
  // Distinct values, so a reader that swapped them would still produce a valid
  // matrix and a figure that merely leans the wrong way.
  const writer = new SwfWriter().matrix({ a: 0.5, b: 0.25, c: -0.75, d: 2, tx: 7, ty: -9 });
  const bytes = writer.toBuffer();
  const { matrix, next } = readMatrix(bytes, 0);
  assert.equal(matrix.a, 0.5);
  assert.equal(matrix.b, 0.25);
  assert.equal(matrix.c, -0.75);
  assert.equal(matrix.d, 2);
  assert.equal(matrix.tx, 7);
  assert.equal(matrix.ty, -9);
  assert.equal(next, bytes.length);
});

test("composeMatrix applies the parent AFTER the child, so a nested limb lands where the build puts it", () => {
  // A quarter turn, then a translation in the PARENT's space.
  const parent = { a: 0, b: 1, c: -1, d: 0, tx: 100, ty: 200 };
  const child = { a: 1, b: 0, c: 0, d: 1, tx: 10, ty: 0 };
  const composed = composeMatrix(parent, child);
  assert.deepEqual(
    [composed.a, composed.b, composed.c, composed.d, composed.tx, composed.ty],
    [0, 1, -1, 0, 100, 210],
    "the child's +10 in x must come out as +10 in y after the parent's rotation"
  );
  assert.deepEqual(composeMatrix(IDENTITY_MATRIX, child), child);
});

test("a colour transform reads the ADD flag first and stores the MULTIPLY block first", () => {
  const writer = new SwfWriter().colourTransform({ multiply: [0.5, 1, 1, 0.25], add: [10, -20, 0, 5] });
  const bytes = writer.toBuffer();
  const { colourTransform } = readColourTransform(bytes, 0, true);
  assert.equal(colourTransform.redMultiplier, 0.5);
  assert.equal(colourTransform.alphaMultiplier, 0.25);
  assert.equal(colourTransform.redOffset, 10);
  assert.equal(colourTransform.greenOffset, -20);
  assert.equal(colourTransform.alphaOffset, 5);
});

test("a CXFORM without alpha reads three channels, not four", () => {
  const writer = new SwfWriter().colourTransform({ multiply: [0.5, 0.5, 0.5] });
  const bytes = writer.toBuffer();
  const { colourTransform } = readColourTransform(bytes, 0, false);
  assert.equal(colourTransform.blueMultiplier, 0.5);
  assert.equal(colourTransform.alphaMultiplier, 1, "alpha is absent, so it stays identity");
});

test("composeColourTransform nests multipliers and carries the child's offset through the parent's scale", () => {
  const parent = { ...IDENTITY_COLOUR_TRANSFORM, redMultiplier: 0.5, redOffset: 8 };
  const child = { ...IDENTITY_COLOUR_TRANSFORM, redMultiplier: 0.5, redOffset: 40 };
  const composed = composeColourTransform(parent, child);
  assert.equal(composed.redMultiplier, 0.25);
  assert.equal(composed.redOffset, 0.5 * 40 + 8);
});

test("a REPLACE swaps the character and KEEPS the instance — an omitted matrix is the old one", () => {
  // ► **The first version of this module had this backwards AND its test
  //   asserted the backwards version**, so the two agreed and the suite was
  //   green. Codex's adversarial review raised it; Ruffle's `movie_clip.rs`
  //   settles it — `prev_child.replace_with(context, id)` and THEN
  //   `apply_place_object`, which sets only the fields the tag carries.
  //   Measured on the shipped build: 144 of its 201 replaces carry no matrix,
  //   and correcting the rule moves 55 placements across 7 sprites (clip 1241
  //   is NOT one of them, so the fighter's own extraction is unchanged).
  const buffer = swf([
    defineShape(1),
    defineShape(2),
    defineSprite(30, 3, [
      tag(TAG.PLACE_OBJECT2, place2({ depth: 4, characterId: 1, matrix: { tx: 100, ty: 200 }, name: "torso" })),
      showFrame(),
      // A move: no character, no matrix. Matrix and name must survive.
      tag(TAG.PLACE_OBJECT2, place2({ depth: 4, move: true, ratio: 7 })),
      showFrame(),
      // A replace: move AND a character, no matrix. The character changes and
      // NOTHING else does.
      tag(TAG.PLACE_OBJECT2, place2({ depth: 4, move: true, characterId: 2 })),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(30));
  assert.equal(frames.length, 3);

  assert.equal(frames[0][0].characterId, 1);
  assert.equal(frames[0][0].matrix.tx, 100);
  assert.equal(frames[0][0].name, "torso");

  assert.equal(frames[1][0].characterId, 1, "a move keeps the character that is there");
  assert.equal(frames[1][0].matrix.tx, 100, "a move with no matrix keeps the one it had");
  assert.equal(frames[1][0].ratio, 7);

  assert.equal(frames[2][0].characterId, 2, "the character IS swapped");
  assert.equal(frames[2][0].matrix.tx, 100, "and an omitted matrix is the instance's, not identity");
  assert.equal(frames[2][0].name, "torso", "an omitted name is the instance's too");
  assert.equal(frames[2][0].ratio, 7);
});

test("a replace against an EMPTY depth has nothing to inherit, so it is a fresh placement", () => {
  const buffer = swf([
    defineShape(1),
    defineSprite(35, 1, [
      tag(TAG.PLACE_OBJECT2, place2({ depth: 4, move: true, characterId: 1 })),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(35));
  assert.equal(frames[0][0].characterId, 1);
  assert.deepEqual(frames[0][0].matrix, IDENTITY_MATRIX);
  assert.deepEqual(frames[0][0].colourTransform, IDENTITY_COLOUR_TRANSFORM);
});

test("a PLAIN place is a new instance, so it does NOT inherit from whatever was at the depth", () => {
  const buffer = swf([
    defineShape(1),
    defineShape(2),
    defineSprite(36, 2, [
      tag(TAG.PLACE_OBJECT2, place2({ depth: 4, characterId: 1, matrix: { tx: 100 }, name: "torso" })),
      showFrame(),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 4, characterId: 2 })),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(36));
  assert.equal(frames[1][0].characterId, 2);
  assert.deepEqual(frames[1][0].matrix, IDENTITY_MATRIX, "a place, unlike a replace, starts clean");
  assert.equal(frames[1][0].name, undefined);
});

test("RemoveObject and RemoveObject2 both clear a depth", () => {
  const removeObject = new SwfWriter().u16(1).u16(4);
  const buffer = swf([
    defineShape(1),
    defineShape(2),
    defineSprite(31, 3, [
      tag(TAG.PLACE_OBJECT2, place2({ depth: 4, characterId: 1, matrix: {} })),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 6, characterId: 2, matrix: {} })),
      showFrame(),
      tag(TAG.REMOVE_OBJECT2, new SwfWriter().u16(6)),
      showFrame(),
      tag(TAG.REMOVE_OBJECT, removeObject),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(31));
  assert.deepEqual(frames.map((entries) => entries.map((entry) => entry.depth)), [[4, 6], [4], []]);
});

test("a move against an EMPTY depth is a no-op, not a crash and not a ghost", () => {
  const buffer = swf([
    defineSprite(32, 1, [tag(TAG.PLACE_OBJECT2, place2({ depth: 9, move: true, matrix: { tx: 5 } })), showFrame()])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(32));
  assert.deepEqual(frames[0], []);
});

test("a display list is the ACCUMULATION of every frame before it, and `frames` only limits the snapshot", () => {
  const buffer = swf([
    defineShape(1),
    defineSprite(33, 4, [
      tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 1, matrix: { tx: 10 } })),
      showFrame(),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 1, move: true, matrix: { tx: 20 } })),
      showFrame(),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 1, move: true, matrix: { tx: 30 } })),
      showFrame(),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 1, move: true, matrix: { tx: 40 } })),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(33), { frames: [3] });
  assert.equal(frames.length, 4);
  assert.equal(frames[0], null);
  assert.equal(frames[1], null);
  assert.equal(frames[3], null);
  assert.equal(frames[2][0].matrix.tx, 30, "frame 3 cannot be reached by starting at frame 3");
});

test("a label owns every frame up to the one before the next label", () => {
  const buffer = swf([
    defineSprite(34, 10, [
      frameLabel("Standing"), showFrame(), showFrame(), showFrame(),
      frameLabel("StepForward"), showFrame(), showFrame(),
      frameLabel("Attack1"), showFrame(), showFrame(), showFrame(), showFrame(), showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const sprite = characters.get(34);
  assert.deepEqual(readFrameLabels(buffer, sprite), [
    { frame: 1, name: "Standing" },
    { frame: 4, name: "StepForward" },
    { frame: 6, name: "Attack1" }
  ]);
  assert.deepEqual(deriveAnimations(buffer, sprite), [
    { name: "Standing", firstFrame: 1, lastFrame: 3, frameCount: 3 },
    { name: "StepForward", firstFrame: 4, lastFrame: 5, frameCount: 2 },
    { name: "Attack1", firstFrame: 6, lastFrame: 10, frameCount: 5 }
  ]);
});

test("flattening composes a nested sprite's matrix and records the depth chain that reached the shape", () => {
  // The fighter's own shape: a named limb whose character is a wrapper sprite
  // holding the shape at an offset of its own.
  const buffer = swf([
    defineShape(1),
    defineSprite(40, 1, [tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 1, matrix: { tx: 10, ty: 20 } })), showFrame()]),
    defineSprite(41, 1, [
      tag(TAG.PLACE_OBJECT2, place2({ depth: 23, characterId: 40, matrix: { tx: 100, ty: 200 }, name: "torso" })),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(41));
  const drawables = flattenFrame(buffer, characters, frames[0]);
  assert.equal(drawables.length, 1);
  assert.equal(drawables[0].characterId, 1);
  assert.equal(drawables[0].kind, "shape");
  assert.equal(drawables[0].unsupported, null);
  assert.equal(drawables[0].matrix.tx, 110);
  assert.equal(drawables[0].matrix.ty, 220);
  assert.deepEqual(drawables[0].path, [23, 1], "the chain says which limb the shape belongs to");
});

test("a morph shape is REPORTED as unsupported with its matrix intact, never silently dropped", () => {
  // Measured on the shipped build: 34 of the fighter clip's 148 reachable
  // characters are morphs, all of them on effect depths. A flattener that
  // treated every placed character as a shape would lose all 34 in silence.
  const buffer = swf([
    defineMorph(50),
    defineSprite(51, 1, [
      tag(TAG.PLACE_OBJECT2, place2({ depth: 43, characterId: 50, matrix: { tx: 60 }, ratio: 32768 })),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(51));
  const drawables = flattenFrame(buffer, characters, frames[0]);
  assert.equal(drawables.length, 1);
  assert.equal(drawables[0].unsupported, "morph");
  assert.equal(drawables[0].matrix.tx, 60);
  assert.equal(drawables[0].ratio, 32768);
});

test("a placement of a character the file never defines is reported as missing, not skipped", () => {
  const buffer = swf([
    defineSprite(52, 1, [tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 9999, matrix: {} })), showFrame()])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(52));
  const drawables = flattenFrame(buffer, characters, frames[0]);
  assert.equal(drawables[0].unsupported, "missing");
  assert.equal(drawables[0].characterId, 9999);
});

test("a mask is reported as a mask, and what it covers is stamped rather than exported as clean geometry", () => {
  // Ruffle's own test is `child.clip_depth() > 0 && child.allow_as_mask()`. The
  // quiet failure is not dropping the mask; it is keeping what the mask COVERS
  // and reporting it as correctly resolved, which exports more geometry than
  // the build ever draws.
  const buffer = swf([
    defineShape(1), defineShape(2), defineShape(3),
    defineSprite(53, 1, [
      tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 1, matrix: {}, clipDepth: 5 })),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 2, characterId: 2, matrix: {} })),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 9, characterId: 3, matrix: {} })),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(53));
  const drawables = flattenFrame(buffer, characters, frames[0]);
  assert.deepEqual(drawables.map((entry) => entry.characterId), [1, 2, 3]);
  assert.equal(drawables[0].unsupported, "mask");
  assert.equal(drawables[0].clipDepth, 5);
  assert.equal(drawables[1].unsupported, "masked", "depth 2 is inside 1..5, so it is covered");
  assert.equal(drawables[1].maskedBy, 1);
  assert.equal(drawables[2].unsupported, null, "depth 9 is past the clipDepth and is ordinary");
  assert.equal(drawables[2].maskedBy, null);
});

test("a clipDepth of ZERO is not a mask — it is an ordinary drawable", () => {
  // The trap: `clipDepth !== undefined` treats 0 as a mask and drops the shape.
  // `clip_depth() > 0` is the condition in Ruffle's `render_children`.
  const buffer = swf([
    defineShape(1),
    defineSprite(54, 1, [
      tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 1, matrix: {}, clipDepth: 0 })),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(54));
  const drawables = flattenFrame(buffer, characters, frames[0]);
  assert.equal(drawables.length, 1);
  assert.equal(drawables[0].kind, "shape");
  assert.equal(drawables[0].unsupported, null);
});

test("nested sprites hold at frame 1, and `spriteFrames` is how a caller picks another", () => {
  // The shipped build's `weapon` is sprite 703: 13 frames, labelled `flame`,
  // `frost`, `poison`, `wraith`, and a frame-1 `stop()`. Which one is showing is
  // an ActionScript decision, so it is the caller's to make explicitly.
  const buffer = swf([
    defineShape(1),
    defineShape(2),
    defineSprite(60, 2, [
      tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 1, matrix: {} })),
      showFrame(),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 1, move: true, characterId: 2 })),
      showFrame()
    ]),
    defineSprite(61, 1, [tag(TAG.PLACE_OBJECT2, place2({ depth: 39, characterId: 60, matrix: {}, name: "weapon" })), showFrame()])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(61));
  assert.equal(flattenFrame(buffer, characters, frames[0])[0].characterId, 1);
  assert.equal(flattenFrame(buffer, characters, frames[0], { spriteFrames: { 60: 2 } })[0].characterId, 2);
});

test("a sprite that contains itself throws by name rather than recursing until the stack dies", () => {
  const buffer = swf([
    defineSprite(70, 1, [tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 70, matrix: {} })), showFrame()])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(70));
  assert.throws(() => flattenFrame(buffer, characters, frames[0]), (error) => {
    assert.ok(error instanceof DisplayListError);
    assert.match(error.message, /contains itself/);
    return true;
  });
});

test("resolveTimeline refuses anything that is not a sprite from indexCharacters", () => {
  assert.throws(() => resolveTimeline(Buffer.alloc(0), null), /indexCharacters/);
  assert.throws(() => resolveTimeline(Buffer.alloc(0), { kind: "sprite" }), /indexCharacters/);
});
