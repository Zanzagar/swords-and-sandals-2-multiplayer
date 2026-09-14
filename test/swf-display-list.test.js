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
  FILTER_TYPES,
  IDENTITY_COLOUR_TRANSFORM,
  IDENTITY_MATRIX,
  TAG,
  buttonStateDisplayList,
  composeColourTransform,
  composeMatrix,
  deriveAnimations,
  flattenFrame,
  indexCharacters,
  parseButton,
  parseFilterList,
  parsePlaceObject,
  readColourTransform,
  readFrameLabels,
  readMatrix,
  resolveTimeline,
  skipFilterList,
  summariseDrawables,
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

  /** A signed 16.16 FIXED: a filter's blur, angle or distance. */
  fixed(value) {
    return this.u32(Math.round(value * 65536));
  }

  /** A signed 8.8 FIXED8: a filter's strength, and nothing else. */
  fixed8(value) {
    return this.u16(Math.round(value * 256));
  }

  /** An IEEE 32-bit float: every number inside a colour or convolution matrix. */
  float(value) {
    this.align();
    const bytes = Buffer.alloc(4);
    bytes.writeFloatLE(value);
    for (const byte of bytes) this.bytes.push(byte);
    return this;
  }

  rgba({ red = 0, green = 0, blue = 0, alpha = 255 } = {}) {
    return this.u8(red).u8(green).u8(blue).u8(alpha);
  }

  /**
   * ONE filter, field for field.
   *
   * ► **This used to write ZEROES of the right length**, which proved that a
   *   cursor stepper stepped the right distance and could not have caught a
   *   decoder reading the right number of bytes from the wrong offsets. Every
   *   field below is distinct and none is zero, so a transposed read fails.
   */
  filter({
    id,
    colour = { red: 10, green: 20, blue: 30, alpha: 200 },
    highlight = { red: 255, green: 255, blue: 255, alpha: 255 },
    shadow = { red: 160, green: 96, blue: 1, alpha: 255 },
    blurX = 5.5, blurY = 6.25, angle = 0.75, distance = -6, strength = 1.5,
    flags = 0x21, colours = 2, matrixX = 2, matrixY = 3, matrix = null
  }) {
    this.u8(id);
    if (id === 0) {
      this.rgba(colour).fixed(blurX).fixed(blurY).fixed(angle).fixed(distance).fixed8(strength).u8(flags);
    } else if (id === 1) {
      this.fixed(blurX).fixed(blurY).u8(flags);
    } else if (id === 2) {
      this.rgba(colour).fixed(blurX).fixed(blurY).fixed8(strength).u8(flags);
    } else if (id === 3) {
      // Highlight FIRST — see the parser's own note and the 54 bevels that
      // measure it. A writer that emitted the spec's table order would agree
      // with a reader that read it, and both would be wrong together.
      this.rgba(highlight).rgba(shadow)
        .fixed(blurX).fixed(blurY).fixed(angle).fixed(distance).fixed8(strength).u8(flags);
    } else if (id === 4 || id === 7) {
      // The RGBAs are a block and the ratios are a SEPARATE block after them.
      this.u8(colours);
      for (let stop = 0; stop < colours; stop += 1) {
        this.rgba({ red: stop + 1, green: stop + 2, blue: stop + 3, alpha: 255 });
      }
      for (let stop = 0; stop < colours; stop += 1) this.u8(stop * 17 + 1);
      this.fixed(blurX).fixed(blurY).fixed(angle).fixed(distance).fixed8(strength).u8(flags);
    } else if (id === 5) {
      const cells = matrix ?? Array.from({ length: matrixX * matrixY }, (value, index) => index + 1);
      this.u8(matrixX).u8(matrixY).float(2.5).float(-0.5);
      for (const cell of cells) this.float(cell);
      this.rgba(colour).u8(flags);
    } else if (id === 6) {
      const cells = matrix ?? Array.from({ length: 20 }, (value, index) => (index + 1) / 8);
      for (const cell of cells) this.float(cell);
    } else throw new Error(`test writer has no filter ${id}`);
    return this;
  }

  /** A FILTERLIST: a count, then that many filters. */
  filterList(filters) {
    this.align();
    this.u8(filters.length);
    for (const filter of filters) this.filter(filter);
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

/** A `DefineEditText`: the indexer reads its id and nothing else. */
function defineText(id) {
  const writer = new SwfWriter();
  writer.u16(id).rect(0, 100, 0, 40).u16(0);
  return tag(TAG.DEFINE_EDIT_TEXT, writer);
}

/**
 * One BUTTONRECORD.
 *
 * The state bits are the LOW four, and `ButtonHasFilterList` (0x10) and
 * `ButtonHasBlendMode` (0x20) exist only in a `DefineButton2` — which is also
 * the only tag whose record carries a colour transform.
 */
function buttonRecord(writer, record, withColourTransform) {
  let flags = 0;
  if (record.up) flags |= 0x01;
  if (record.over) flags |= 0x02;
  if (record.down) flags |= 0x04;
  if (record.hitTest) flags |= 0x08;
  if (withColourTransform && record.filters) flags |= 0x10;
  if (withColourTransform && record.blendMode !== undefined) flags |= 0x20;
  writer.u8(flags).u16(record.characterId).u16(record.depth).matrix(record.matrix ?? {});
  if (withColourTransform) {
    // Present even when identity: a reader that skips it reads the NEXT
    // record's flag byte out of the middle of this one.
    writer.colourTransform(record.colourTransform ?? {});
    if (record.filters) writer.filterList(record.filters);
    if (record.blendMode !== undefined) writer.u8(record.blendMode);
  }
  return writer;
}

function defineButton2(id, records, { trackAsMenu = false, actionOffset = 0 } = {}) {
  const writer = new SwfWriter();
  // ReservedFlags UB[7] then TrackAsMenu UB[1]: the flag is the LOW bit.
  writer.u16(id).u8(trackAsMenu ? 1 : 0).u16(actionOffset);
  for (const record of records) buttonRecord(writer, record, true);
  writer.u8(0); // CharacterEndFlag, which is the same byte as an empty record.
  return tag(TAG.DEFINE_BUTTON2, writer);
}

function defineButton(id, records) {
  const writer = new SwfWriter();
  writer.u16(id);
  for (const record of records) buttonRecord(writer, record, false);
  writer.u8(0);
  return tag(TAG.DEFINE_BUTTON, writer);
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

// ---------------------------------------------------------------------------
// FILTERS: decoded, not stepped over.
// ---------------------------------------------------------------------------

test("a filter list DECODES, and every field lands where the specification puts it", () => {
  // The trap this replaces: the old fixture wrote ZEROES of the right length,
  // so a decoder reading the right COUNT of bytes from the wrong OFFSETS would
  // have passed. Every value below is distinct and none is zero.
  const bytes = new SwfWriter().filterList([
    { id: 0, colour: { red: 1, green: 2, blue: 3, alpha: 4 }, blurX: 5.5, blurY: 6.25, angle: 0.75, distance: -6, strength: 1.5, flags: 0xa3 },
    { id: 1, blurX: 8, blurY: 9.5, flags: 0x10 },
    { id: 2, colour: { red: 7, green: 8, blue: 9, alpha: 10 }, blurX: 2, blurY: 3, strength: 0.5, flags: 0x21 },
    { id: 6, matrix: Array.from({ length: 20 }, (value, index) => index - 9.5) }
  ]).toBuffer();
  const { filters, next } = parseFilterList(bytes, 0, bytes.length);
  assert.equal(next, bytes.length, "the list must end exactly where the bytes do");
  assert.deepEqual(filters.map((filter) => filter.type), ["dropShadow", "blur", "glow", "colourMatrix"]);

  const shadow = filters[0];
  assert.deepEqual(shadow.colour, { red: 1, green: 2, blue: 3, alpha: 4 });
  assert.equal(shadow.blurX, 5.5);
  assert.equal(shadow.blurY, 6.25);
  assert.equal(shadow.angle, 0.75);
  assert.equal(shadow.distance, -6, "distance is SIGNED 16.16 — the build's bevels use -6");
  assert.equal(shadow.strength, 1.5);
  // 0xa3 is 1010 0011: inner, no knockout, composite source, three passes.
  assert.equal(shadow.inner, true);
  assert.equal(shadow.knockout, false);
  assert.equal(shadow.compositeSource, true);
  assert.equal(shadow.passes, 3);

  assert.equal(filters[2].strength, 0.5, "strength is 8.8, not 16.16");
  assert.deepEqual(filters[2].colour, { red: 7, green: 8, blue: 9, alpha: 10 });
  assert.deepEqual(
    filters[3].matrix,
    Array.from({ length: 20 }, (value, index) => index - 9.5),
    "twenty little-endian floats, in order, negatives included"
  );
});

test("a blur's passes are the TOP five bits of its last byte, not the byte", () => {
  // Measured on the shipped build: 314 blurs carry 0x08 and 6 carry 0x10 —
  // one pass and two. Reading the byte itself would report 8 and 16.
  const bytes = new SwfWriter().filterList([{ id: 1, blurX: 4, blurY: 4, flags: 0x08 }]).toBuffer();
  const { filters } = parseFilterList(bytes, 0, bytes.length);
  assert.equal(filters[0].passes, 1, "0x08 is one pass; the byte's value is 8");
  const two = new SwfWriter().filterList([{ id: 1, blurX: 4, blurY: 4, flags: 0x10 }]).toBuffer();
  assert.equal(parseFilterList(two, 0, two.length).filters[0].passes, 2);
});

test("a bevel's FIRST colour is the highlight, which is the opposite of the spec's field table", () => {
  // ► Measured on the shipped build, and the only reason this is asserted this
  //   way round: in all 54 of its bevels the first RGBA is 255,255,255,255 and
  //   the second is dark (160,96,1 / 0,0,0 / 102,0,0) — Flash's own default
  //   pairing of a white highlight against a dark shadow, 54 times out of 54.
  //   The specification's table lists ShadowColor first. A reader that trusts
  //   the table swaps every bevel and still draws a plausible bevel.
  const bytes = new SwfWriter().filterList([{
    id: 3,
    highlight: { red: 255, green: 255, blue: 255, alpha: 255 },
    shadow: { red: 160, green: 96, blue: 1, alpha: 255 },
    blurX: 0, blurY: 0, angle: 0.7853851318359375, distance: -6, strength: 1, flags: 0xa1
  }]).toBuffer();
  const [bevel] = parseFilterList(bytes, 0, bytes.length).filters;
  assert.equal(bevel.type, "bevel");
  assert.deepEqual(bevel.highlightColour, { red: 255, green: 255, blue: 255, alpha: 255 });
  assert.deepEqual(bevel.shadowColour, { red: 160, green: 96, blue: 1, alpha: 255 });
  assert.equal(bevel.distance, -6);
  // 0xa1 is 1010 0001: inner, no knockout, composite source, not on top, one pass.
  assert.equal(bevel.inner, true);
  assert.equal(bevel.onTop, false);
  assert.equal(bevel.passes, 1);
  // ► **OnTop MUST be set here or the next assertion cannot fail.** With
  //   OnTop clear, `flags & 0x0f` and `flags & 0x1f` give the same number, so a
  //   reader that took five bits would agree with one that took four. 0xb3 is
  //   1011 0011: inner, composite source, ON TOP, and three passes.
  const onTop = new SwfWriter().filterList([{ id: 3, flags: 0xb3 }]).toBuffer();
  const [wide] = parseFilterList(onTop, 0, onTop.length).filters;
  assert.equal(wide.onTop, true);
  assert.equal(wide.passes, 3, "a bevel's passes are FOUR bits, because OnTop takes the fifth");
});

test("a GRADIENT filter's trailing block is NINETEEN bytes, and the committed parser said 23", () => {
  // ► **THE DEFECT THIS TEST EXISTS FOR.** `skipFilterList` stepped
  //   `1 + colours * 5 + 23` and the fixture that covered it wrote 23 zero
  //   bytes, so parser and test agreed and the suite was green. The shipped
  //   build has ZERO gradient filters, so no capture and no census could ever
  //   have caught it — only a fixture written from the FIELD LIST rather than
  //   from the parser.
  //
  //   The size is derived, not asserted: a gradient glow is a DROP SHADOW with
  //   its RGBA replaced by NumColors plus five bytes per stop. So the two
  //   lengths must differ by exactly `1 + 5n - 4`, which a parser that is
  //   wrong about the gradient tail alone cannot satisfy.
  const stops = 3;
  const shadowOnly = new SwfWriter().filterList([{ id: 0 }]).toBuffer();
  // 0xb5 is 1011 0101: inner, no knockout, composite source, ON TOP, five
  // passes. OnTop is set on purpose — with it clear, four bits of passes and
  // five give the same number and the width would go unconstrained — and the
  // byte is one no neighbour in this fixture carries, so a flags byte read
  // four along cannot happen to agree with it.
  const gradientOnly = new SwfWriter().filterList([{ id: 4, colours: stops, flags: 0xb5 }]).toBuffer();
  assert.equal(
    gradientOnly.length - shadowOnly.length,
    1 + stops * 5 - 4,
    "a gradient glow is a drop shadow whose RGBA became a gradient"
  );
  assert.equal(parseFilterList(gradientOnly, 0, gradientOnly.length).next, gradientOnly.length);
  assert.equal(skipFilterList(gradientOnly, 0, gradientOnly.length), gradientOnly.length);

  const { filters } = parseFilterList(gradientOnly, 0, gradientOnly.length);
  assert.equal(filters[0].type, "gradientGlow");
  assert.equal(filters[0].gradient.length, stops);
  // The RGBAs are one block and the ratios are ANOTHER after it, not
  // interleaved — which is the other way to be wrong about this record.
  assert.deepEqual(filters[0].gradient.map((stop) => stop.ratio), [1, 18, 35]);
  assert.deepEqual(filters[0].gradient[2].colour, { red: 3, green: 4, blue: 5, alpha: 255 });
  // The FLAGS byte is the last of the nineteen, so it is the field an off-by-
  // four lands past — which is how the 23 above survived being noticed.
  assert.equal(filters[0].passes, 5);
  assert.equal(filters[0].inner, true);
  assert.equal(filters[0].knockout, false);
  assert.equal(filters[0].compositeSource, true);
  assert.equal(filters[0].onTop, true);
  assert.equal(filters[0].strength, 1.5, "and the strength is the two bytes before it");
  assert.equal(filters[0].distance, -6);
  assert.equal(filters[0].measured, false, "no gradient filter exists in the shipped build");
});

test("a blend mode after a GRADIENT filter proves the step, because a wrong size reads the wrong byte", () => {
  // This is the shape that caught the 23: FILTERLIST sits before BlendMode, so
  // four bytes too many made the blend mode land inside the next field. With
  // distinctive trailing values, an off-by-four cannot look like a pass.
  const body = place3({
    depth: 4, characterId: 11, matrix: {},
    filters: [{ id: 7, colours: 2 }],
    blendMode: 9, bitmapCache: true, visible: false
  });
  const bytes = body.toBuffer();
  const placement = parsePlaceObject(bytes, 0, bytes.length, TAG.PLACE_OBJECT3);
  assert.equal(placement.filters[0].type, "gradientBevel");
  assert.equal(placement.blendMode, 9);
  assert.equal(placement.bitmapCache, true);
  assert.equal(placement.visible, false, "the last field can only be right if every step before it was");
});

test("a convolution filter's length follows its own matrix, and its floats come back in order", () => {
  const bytes = new SwfWriter().filterList([{ id: 5, matrixX: 2, matrixY: 3 }]).toBuffer();
  const { filters, next } = parseFilterList(bytes, 0, bytes.length);
  assert.equal(next, bytes.length);
  assert.equal(filters[0].type, "convolution");
  assert.equal(filters[0].matrixX, 2);
  assert.equal(filters[0].matrixY, 3);
  assert.deepEqual(filters[0].matrix, [1, 2, 3, 4, 5, 6], "six cells, because the matrix is 2 by 3");
  assert.equal(filters[0].divisor, 2.5);
  assert.equal(filters[0].bias, -0.5);
  assert.equal(filters[0].measured, false, "no convolution filter exists in the shipped build either");
});

test("parseFilterList and skipFilterList agree on the byte after ALL EIGHT filter kinds", () => {
  // The size table and the decoder are two statements of the same fact, and
  // this is the only thing stopping them drifting apart again.
  const every = [
    { id: 0 }, { id: 1 }, { id: 2 }, { id: 3 },
    { id: 4, colours: 4 }, { id: 5, matrixX: 3, matrixY: 3 }, { id: 6 }, { id: 7, colours: 1 }
  ];
  const bytes = new SwfWriter().filterList(every).toBuffer();
  const parsed = parseFilterList(bytes, 0, bytes.length);
  assert.equal(parsed.filters.length, 8);
  assert.equal(parsed.next, skipFilterList(bytes, 0, bytes.length));
  assert.equal(parsed.next, bytes.length);
  assert.deepEqual(parsed.filters.map((filter) => filter.filterId), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(
    parsed.filters.map((filter) => filter.type),
    [0, 1, 2, 3, 4, 5, 6, 7].map((id) => FILTER_TYPES[id])
  );
});

test("parseFilterList refuses an unknown id and a truncated filter BY NAME, never reading zeroes", () => {
  const unknown = Buffer.from([1, 99]);
  assert.throws(() => parseFilterList(unknown, 0, unknown.length), /Unknown SWF filter id 99/);
  // A colour matrix needs 80 bytes and has 8. A decoder without a bounds check
  // reads `undefined` bytes as zeroes and returns a filter that looks parsed.
  const truncated = Buffer.concat([Buffer.from([1, 6]), Buffer.alloc(8)]);
  assert.throws(() => parseFilterList(truncated, 0, truncated.length), (error) => {
    assert.ok(error instanceof DisplayListError);
    assert.match(error.message, /colourMatrix/);
    return true;
  });
  const empty = Buffer.alloc(0);
  assert.throws(() => parseFilterList(empty, 0, 0), /ran past the end/);
});

// ---------------------------------------------------------------------------
// EFFECTS REACHING A DRAWABLE, which is the half that was missing.
// ---------------------------------------------------------------------------

/** The keys every drawable must carry, whatever else it is. */
function assertCarriesEffectKeys(drawable, what) {
  assert.ok("blendMode" in drawable, `${what} must carry blendMode`);
  assert.ok("hasFilters" in drawable, `${what} must carry hasFilters`);
  assert.ok("filters" in drawable, `${what} must carry filters`);
  assert.ok("ancestorEffects" in drawable, `${what} must carry ancestorEffects`);
}

test("a filter on a placement REACHES the drawable — the key used not to exist at all", () => {
  // Measured on the shipped build: 1,507 placements carry a filter list and
  // every one of them reached no caller in any form, because `flattenFrame`'s
  // drawable literal had no `hasFilters` and no `filters`.
  const buffer = swf([
    defineShape(1),
    defineSprite(80, 1, [
      tag(TAG.PLACE_OBJECT3, place3({ depth: 5, characterId: 1, matrix: { tx: 10 }, filters: [{ id: 6 }], blendMode: 3 })),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(80));
  assert.equal(frames[0][0].hasFilters, true, "resolveTimeline already carried the flag");
  const [drawable] = flattenFrame(buffer, characters, frames[0]);
  assertCarriesEffectKeys(drawable, "a shape drawable");
  assert.equal(drawable.hasFilters, true);
  assert.equal(drawable.filters.length, 1);
  assert.equal(drawable.filters[0].type, "colourMatrix");
  assert.equal(drawable.blendMode, 3);
  assert.equal(drawable.ancestorEffects, null, "nothing encloses it");
});

test("a filter or blend mode on a SPRITE reaches its leaves as ancestorEffects", () => {
  // ► **The recursion dropped both fields entirely.** Measured on the shipped
  //   build: ELEVEN of its twelve blend modes are on sprite placements, and
  //   208 colour matrices sit on placements inside the sprite the root names
  //   `sky` — so almost every effect in the file died at this seam.
  const buffer = swf([
    defineShape(1),
    defineSprite(81, 1, [tag(TAG.PLACE_OBJECT2, place2({ depth: 2, characterId: 1, matrix: { tx: 4 } })), showFrame()]),
    defineSprite(82, 1, [
      tag(TAG.PLACE_OBJECT3, place3({ depth: 7, characterId: 81, matrix: { tx: 100 }, filters: [{ id: 2 }], blendMode: 13 })),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(82));
  const [leaf] = flattenFrame(buffer, characters, frames[0]);
  assert.equal(leaf.characterId, 1, "the leaf is the shape, two levels down");
  assert.equal(leaf.blendMode, undefined, "the leaf's OWN placement has no blend mode");
  assert.ok("blendMode" in leaf, "the KEY is there on every drawable even so — that is the fix");
  assert.equal(leaf.hasFilters, false, "and no filters of its own");
  assert.equal(leaf.ancestorEffects.length, 1, "but it is inside one filtered group");
  assert.equal(leaf.ancestorEffects[0].blendMode, 13);
  assert.equal(leaf.ancestorEffects[0].characterId, 81);
  assert.deepEqual(leaf.ancestorEffects[0].path, [7]);
  assert.equal(leaf.ancestorEffects[0].filters[0].type, "glow");
  assert.equal(leaf.matrix.tx, 104, "and the matrix still composes, which it always did");
});

test("an ancestor chain is FROZEN, so one drawable cannot rewrite another's", () => {
  // The chain is shared between every leaf under the same group: copying it
  // per drawable would be the alternative, and a caller that pushed onto a
  // shared array would corrupt siblings silently.
  const buffer = swf([
    defineShape(1),
    defineSprite(83, 1, [
      tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 1, matrix: {} })),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 2, characterId: 1, matrix: {} })),
      showFrame()
    ]),
    defineSprite(84, 1, [
      tag(TAG.PLACE_OBJECT3, place3({ depth: 3, characterId: 83, matrix: {}, filters: [{ id: 1 }] })),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(84));
  const drawables = flattenFrame(buffer, characters, frames[0]);
  assert.equal(drawables.length, 2);
  assert.equal(drawables[0].ancestorEffects, drawables[1].ancestorEffects, "siblings share one chain");
  assert.throws(() => drawables[0].ancestorEffects.push({}), TypeError);
});

test("a mask, a morph and a missing character all carry the effect keys too", () => {
  // A drawable that reports an unsupported character is still a drawable, and
  // a caller counting filters must not have to special-case three kinds.
  const buffer = swf([
    defineShape(1), defineMorph(2),
    defineSprite(85, 1, [
      tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 1, matrix: {}, clipDepth: 3 })),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 2, characterId: 2, matrix: {} })),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 9, characterId: 4242, matrix: {} })),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(85));
  const drawables = flattenFrame(buffer, characters, frames[0]);
  assert.deepEqual(drawables.map((drawable) => drawable.unsupported), ["mask", "morph", "missing"]);
  assertCarriesEffectKeys(drawables[0], "a mask");
  assertCarriesEffectKeys(drawables[1], "a morph");
  assertCarriesEffectKeys(drawables[2], "a missing character");
});

test("a sprite frame that does not exist is REPORTED, not silently dropped", () => {
  // ► This was `continue` — a placement that vanished with nothing said. The
  //   shipped build has five sprites with ZERO frames (2303-2307) and places
  //   none of them, so the oracle never exercised it; an uncounted absence is
  //   the defect this module exists to refuse, whether or not one build hits it.
  const buffer = swf([
    defineShape(1),
    defineSprite(86, 1, [tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 1, matrix: {} })), showFrame()]),
    defineSprite(87, 1, [tag(TAG.PLACE_OBJECT2, place2({ depth: 4, characterId: 86, matrix: { tx: 7 } })), showFrame()])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(87));
  const drawables = flattenFrame(buffer, characters, frames[0], { spriteFrames: { 86: 9 } });
  assert.equal(drawables.length, 1, "the placement must still appear");
  assert.equal(drawables[0].unsupported, "spriteFrame");
  assert.equal(drawables[0].spriteFrame, 9);
  assert.equal(drawables[0].characterId, 86);
  assert.equal(drawables[0].matrix.tx, 7, "with the composed matrix intact, like every other report");
});

// ---------------------------------------------------------------------------
// BUTTONS: 158 characters that were a wall.
// ---------------------------------------------------------------------------

test("a DefineButton2 parses to its records, its states, its filters and its blend mode", () => {
  // Measured on the shipped build: 158 DefineButton2 characters hold 704
  // records — 425 shapes, 146 texts, 133 sprites — of which 34 carry a filter
  // list and NONE carries a blend mode.
  const buffer = swf([
    defineShape(1), defineShape(2),
    defineButton2(90, [
      { characterId: 1, depth: 1, matrix: { tx: 10 }, up: true, over: true },
      { characterId: 2, depth: 3, matrix: { tx: 20 }, down: true, hitTest: true, filters: [{ id: 2 }], blendMode: 5 }
    ], { trackAsMenu: true })
  ]);
  const { characters } = indexCharacters(buffer);
  assert.equal(characters.get(90).kind, "button");
  const button = parseButton(buffer, characters.get(90));
  assert.equal(button.id, 90);
  assert.equal(button.trackAsMenu, true, "TrackAsMenu is the LOW bit of the flags byte");
  assert.equal(button.records.length, 2);
  assert.deepEqual(button.stateCounts, { up: 1, over: 1, down: 1, hitTest: 1 });
  assert.equal(button.records[0].matrix.tx, 10);
  assert.equal(button.records[0].hasFilters, false);
  assert.equal(button.records[1].depth, 3);
  assert.equal(button.records[1].hasFilters, true);
  assert.equal(button.records[1].filters[0].type, "glow");
  assert.equal(button.records[1].blendMode, 5, "the blend mode follows the filter list here too");
  assert.equal(button.records[1].down, true);
  assert.equal(button.records[1].up, false);
});

test("a DefineButton2 record's COLOUR TRANSFORM is mandatory, and skipping it desynchronises the next record", () => {
  // The trap: BUTTONRECORD and BUTTONRECORD2 differ by a CXFORMWITHALPHA that
  // is present even when it is identity. A reader that skips it reads the next
  // record's flag byte out of the colour transform.
  const buffer = swf([
    defineShape(1), defineShape(2),
    defineButton2(91, [
      { characterId: 1, depth: 1, matrix: {}, up: true, colourTransform: { multiply: [0.5, 0.5, 0.5, 0.25] } },
      { characterId: 2, depth: 2, matrix: {}, up: true }
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const button = parseButton(buffer, characters.get(91));
  assert.equal(button.records.length, 2, "the second record is only findable past the first's colour transform");
  assert.equal(button.records[0].colourTransform.alphaMultiplier, 0.25);
  assert.equal(button.records[1].characterId, 2);
  assert.equal(button.records[1].colourTransform.alphaMultiplier, 1);
});

test("a DefineButton (tag 7) record has NO colour transform, and assuming one loses the record", () => {
  // The shipped build has ZERO tag-7 buttons — all 158 are tag 34 — so this
  // arm is the format being right rather than this extraction being fixed.
  const buffer = swf([
    defineShape(1),
    defineButton(92, [{ characterId: 1, depth: 6, matrix: { tx: 30 }, up: true, hitTest: true }])
  ]);
  const { characters } = indexCharacters(buffer);
  assert.equal(characters.get(92).kind, "button");
  const button = parseButton(buffer, characters.get(92));
  assert.equal(button.tagCode, TAG.DEFINE_BUTTON);
  assert.equal(button.records.length, 1);
  assert.equal(button.records[0].matrix.tx, 30);
  assert.equal(button.records[0].hitTest, true);
  assert.deepEqual(button.records[0].colourTransform, IDENTITY_COLOUR_TRANSFORM);
});

test("parseButton refuses a character that is not a button, and one that is not a character", () => {
  const buffer = swf([defineShape(1)]);
  const { characters } = indexCharacters(buffer);
  assert.throws(() => parseButton(buffer, characters.get(1)), (error) => {
    assert.ok(error instanceof DisplayListError);
    assert.match(error.message, /not a DefineButton/);
    return true;
  });
  assert.throws(() => parseButton(buffer, null), /indexCharacters/);
  assert.throws(() => parseButton(buffer, { id: 5, kind: "button" }), /indexCharacters/);
});

test("a button record list ends at a ZERO byte, and a list with no terminator throws by name", () => {
  // A record whose state bits are all clear IS the terminator: the two are the
  // same byte, and a reader that treats zero as a record runs off the tag.
  const truncated = new SwfWriter();
  truncated.u16(93).u8(0).u16(0);
  truncated.u8(0x01).u16(1).u16(1).matrix({}).colourTransform({});
  const buffer = swf([defineShape(1), tag(TAG.DEFINE_BUTTON2, truncated)]);
  const { characters } = indexCharacters(buffer);
  assert.throws(() => parseButton(buffer, characters.get(93)), (error) => {
    assert.ok(error instanceof DisplayListError);
    assert.match(error.message, /before the record terminator/);
    return true;
  });
});

test("a button record whose MATRIX runs past the tag throws instead of reading the next tag", () => {
  // A MATRIX is a bit field with no length of its own: nothing inside it says
  // where it stops, so a malformed record walks into whatever bytes follow and
  // comes back looking parsed. Here the translate width is 31 bits — 0x3e is
  // `0 0 11111 0` — and the tag ends one byte later.
  const runaway = new SwfWriter();
  runaway.u16(109).u8(0).u16(0).u8(0x01).u16(1).u16(1).u8(0x3e);
  const buffer = swf([defineShape(1), tag(TAG.DEFINE_BUTTON2, runaway)]);
  const { characters } = indexCharacters(buffer);
  assert.throws(() => parseButton(buffer, characters.get(109)), (error) => {
    assert.ok(error instanceof DisplayListError);
    assert.match(error.message, /matrix ran past the end/);
    return true;
  });
});

test("buttonStateDisplayList picks ONE state, sorts by depth, and refuses a state that is not one", () => {
  const buffer = swf([
    defineShape(1), defineShape(2), defineShape(3),
    defineButton2(94, [
      { characterId: 1, depth: 9, matrix: {}, up: true },
      { characterId: 2, depth: 2, matrix: {}, up: true, over: true },
      { characterId: 3, depth: 1, matrix: {}, hitTest: true }
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const button = parseButton(buffer, characters.get(94));
  assert.deepEqual(buttonStateDisplayList(button, "up").map((entry) => entry.depth), [2, 9], "depth is paint order");
  assert.deepEqual(buttonStateDisplayList(button, "over").map((entry) => entry.characterId), [2]);
  assert.deepEqual(buttonStateDisplayList(button, "hitTest").map((entry) => entry.characterId), [3]);
  assert.equal(buttonStateDisplayList(button).length, 2, "up is the default");
  assert.throws(() => buttonStateDisplayList(button, "rollover"), /Unknown button state/);
  assert.throws(() => buttonStateDisplayList(null), /parseButton/);
  // An INHERITED key is not a state. A truth test on the bit table would find
  // `BUTTON_STATE_BITS.constructor` — a function — and then `record.constructor`
  // truthy on every record, drawing all three of them.
  assert.throws(() => buttonStateDisplayList(button, "constructor"), /Unknown button state/);
  assert.throws(
    () => flattenFrame(Buffer.alloc(0), new Map(), [], { buttonState: "toString" }),
    /Unknown button state/
  );
});

test("a button placement reports WHAT IS INSIDE IT, counted by kind, and stays unsupported by default", () => {
  // ► Measured on the shipped build: **27 of its 436 text characters appear
  //   ONLY inside DefineButton2 records** and on no timeline anywhere, so they
  //   were invisible to every census this repository can run. A dead end that
  //   says nothing about what is behind it is the same defect as a dropped
  //   field wearing a label.
  const buffer = swf([
    defineShape(1), defineShape(2), defineText(3),
    defineButton2(95, [
      { characterId: 1, depth: 1, matrix: {}, up: true },
      { characterId: 2, depth: 2, matrix: {}, up: true, over: true },
      { characterId: 3, depth: 3, matrix: {}, up: true },
      { characterId: 999, depth: 4, matrix: {}, hitTest: true }
    ]),
    defineSprite(96, 1, [tag(TAG.PLACE_OBJECT2, place2({ depth: 8, characterId: 95, matrix: { tx: 50 } })), showFrame()])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(96));
  const [drawable] = flattenFrame(buffer, characters, frames[0]);
  assert.equal(drawable.unsupported, "button", "the default answer is unchanged");
  assert.equal(drawable.kind, "button");
  assert.equal(drawable.matrix.tx, 50);
  assert.equal(drawable.button.records, 4);
  assert.deepEqual(drawable.button.contents, { shape: 2, text: 1, missing: 1 });
  assert.deepEqual(drawable.button.states, { up: 3, over: 1, down: 0, hitTest: 1 });
  assert.deepEqual(drawable.button.characterIds, [1, 2, 3, 999]);
  assert.equal(drawable.buttonError, null);
});

test("resolveButtons draws the UP state, and it is OFF by default so no pinned extraction moves", () => {
  // Off by default for the same reason `resolveMasks` is: `extract-figure` and
  // `extract-wardrobe` skip anything carrying an `unsupported`, so resolving
  // buttons globally would add geometry to two extractions that are pinned by
  // tests and by a preview the owner has looked at.
  const buffer = swf([
    defineShape(1), defineShape(2),
    defineButton2(97, [
      { characterId: 1, depth: 2, matrix: { tx: 3 }, up: true },
      { characterId: 2, depth: 1, matrix: { tx: 5 }, down: true }
    ]),
    defineSprite(98, 1, [tag(TAG.PLACE_OBJECT2, place2({ depth: 8, characterId: 97, matrix: { tx: 100 } })), showFrame()])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(98));

  const closed = flattenFrame(buffer, characters, frames[0]);
  assert.equal(closed.length, 1);
  assert.equal(closed[0].unsupported, "button");

  const opened = flattenFrame(buffer, characters, frames[0], { resolveButtons: true });
  assert.equal(opened.length, 1, "only the UP record is drawn; the DOWN record is not");
  assert.equal(opened[0].characterId, 1);
  assert.equal(opened[0].unsupported, null);
  assert.equal(opened[0].matrix.tx, 103, "the record's matrix composes under the button's");
  assert.deepEqual(opened[0].path, [8, 2], "the chain runs through the button's own depth");

  const down = flattenFrame(buffer, characters, frames[0], { resolveButtons: true, buttonState: "down" });
  assert.deepEqual(down.map((drawable) => drawable.characterId), [2]);
  assert.throws(
    () => flattenFrame(buffer, characters, frames[0], { buttonState: "wiggle" }),
    /Unknown button state/
  );
});

test("a button state with NO records is REPORTED, never returned as an empty flatten", () => {
  // ► Measured on the shipped build: **32 of its 158 buttons are hit-test only
  //   — one shape, no up, no over, no down.** A flatten that drew nothing for
  //   them would be a zero meaning "empty" that is indistinguishable from a
  //   zero meaning "unread", which is the failure this whole module is built
  //   against. On the root timeline that is 168 placements across 270 frames.
  const buffer = swf([
    defineShape(1),
    defineButton2(99, [{ characterId: 1, depth: 1, matrix: {}, hitTest: true }]),
    defineSprite(100, 1, [tag(TAG.PLACE_OBJECT2, place2({ depth: 4, characterId: 99, matrix: {} })), showFrame()])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(100));
  const drawables = flattenFrame(buffer, characters, frames[0], { resolveButtons: true });
  assert.equal(drawables.length, 1, "the button must still appear");
  assert.equal(drawables[0].unsupported, "buttonState");
  assert.equal(drawables[0].buttonState, "up");
  assert.equal(drawables[0].button.states.hitTest, 1);
  assert.equal(
    flattenFrame(buffer, characters, frames[0], { resolveButtons: true, buttonState: "hitTest" })[0].unsupported,
    null,
    "the same button DOES resolve in the state it actually has"
  );
});

test("an unreadable button is COUNTED on the drawable rather than taking the frame with it", () => {
  const broken = new SwfWriter();
  broken.u16(101).u8(0).u16(0).u8(0x01).u16(1); // a record that stops mid-way
  const buffer = swf([
    defineShape(1), tag(TAG.DEFINE_BUTTON2, broken),
    defineSprite(102, 1, [tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 101, matrix: {} })), showFrame()])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(102));
  for (const options of [{}, { resolveButtons: true }]) {
    const [drawable] = flattenFrame(buffer, characters, frames[0], options);
    assert.equal(drawable.unsupported, "button");
    assert.equal(drawable.button, null);
    assert.match(drawable.buttonError, /ran past the end|too short/);
  }
});

test("a button that contains itself throws by name rather than recursing until the stack dies", () => {
  const buffer = swf([
    defineButton2(103, [{ characterId: 103, depth: 1, matrix: {}, up: true }]),
    defineSprite(104, 1, [tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 103, matrix: {} })), showFrame()])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(104));
  assert.throws(() => flattenFrame(buffer, characters, frames[0], { resolveButtons: true }), (error) => {
    assert.ok(error instanceof DisplayListError);
    assert.match(error.message, /Button 103 contains itself/);
    return true;
  });
});

// ---------------------------------------------------------------------------
// COUNTING, which is the half a manifest reads.
// ---------------------------------------------------------------------------

test("summariseDrawables counts placements AND distinct characters, and a group once each", () => {
  // ► "Zero failures" was reported by an extractor whose fill data had died at
  //   a seam, and the arena's walls were invisible for months behind it. A
  //   total alone cannot tell "12 placements of 3 morphs" from "12 placements
  //   of 12 morphs", and counting an enclosing filter once per leaf turns one
  //   colour matrix into hundreds.
  const buffer = swf([
    defineShape(1), defineMorph(2),
    defineSprite(105, 1, [
      tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 1, matrix: {} })),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 2, characterId: 1, matrix: {} })),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 3, characterId: 2, matrix: {} })),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 4, characterId: 2, matrix: {} })),
      showFrame()
    ]),
    defineSprite(106, 1, [
      tag(TAG.PLACE_OBJECT3, place3({ depth: 1, characterId: 105, matrix: {}, filters: [{ id: 6 }], blendMode: 3 })),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(106));
  const summary = summariseDrawables(flattenFrame(buffer, characters, frames[0]));
  assert.equal(summary.drawables, 4);
  assert.deepEqual(summary.byKind, { shape: 2, morph: 2 });
  assert.deepEqual(summary.unsupported.morph, { placements: 2, characters: [2] },
    "two placements of ONE morph, which a single total could not say");
  assert.equal(summary.insideEffects, 4, "every leaf is inside the filtered group");
  assert.equal(summary.ancestorGroups, 1, "and the group is ONE group, not one per leaf");
  assert.deepEqual(summary.ancestorFiltersByType, { colourMatrix: 1 });
  assert.deepEqual(summary.ancestorBlendModes, { 3: 1 });
  assert.equal(summary.withFilters, 0, "no LEAF carries a filter of its own");
});

test("summariseDrawables counts what is inside every button it was handed", () => {
  const buffer = swf([
    defineShape(1), defineText(2),
    defineButton2(107, [
      { characterId: 1, depth: 1, matrix: {}, up: true },
      { characterId: 2, depth: 2, matrix: {}, up: true }
    ]),
    defineSprite(108, 1, [
      tag(TAG.PLACE_OBJECT2, place2({ depth: 1, characterId: 107, matrix: {} })),
      tag(TAG.PLACE_OBJECT2, place2({ depth: 2, characterId: 107, matrix: { tx: 40 } })),
      showFrame()
    ])
  ]);
  const { characters } = indexCharacters(buffer);
  const { frames } = resolveTimeline(buffer, characters.get(108));
  const summary = summariseDrawables(flattenFrame(buffer, characters, frames[0]));
  assert.equal(summary.buttons.placements, 2);
  assert.equal(summary.buttons.records, 4, "two placements of a two-record button");
  assert.deepEqual(summary.buttons.contents, { shape: 2, text: 2 });
  assert.equal(summary.buttons.failures, 0);
  assert.equal(summary.buttons.emptyStates, 0);
  assert.deepEqual(summary.unsupported.button, { placements: 2, characters: [107] });
});
