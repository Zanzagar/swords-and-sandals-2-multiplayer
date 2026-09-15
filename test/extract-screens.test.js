/**
 * THE SCREEN EXTRACTOR, and the two things it has to get right.
 *
 * ► **THE FIRST IS THE ROOT.** Every other extractor in this repository reads a
 *   `DefineSprite`. A screen is a moment on the ROOT timeline, which no tag
 *   defines, so `rootTimeline()` fabricates the record `resolveTimeline` wants.
 *   If that fabrication is wrong the whole pack is wrong and nothing else in
 *   the suite would notice, because nothing else reads the root.
 *
 * ► **THE SECOND IS THE ACCOUNTING**, and it is the one that has actually cost
 *   this project months. The arena's walls were invisible because a thing the
 *   build draws was dropped and the report said zero failures. This pack can
 *   fail the same way in five new places — a button with no UP record, a clip
 *   whose frame 1 is empty, a text character, a sprite mask, a placement with
 *   `alphaMultiplier` 0 — and every one of them looks exactly like a read that
 *   went nowhere. So the load-bearing tests below are not "the geometry is
 *   right". They are:
 *
 *     · every object either produced a drawable or SAYS WHY, and the ones that
 *       cannot say why are counted on their own and raised as failures;
 *     · `unresolved.length` equals the sum of `unresolvedByKind`, on every
 *       screen, so a list and its own count cannot drift;
 *     · the manifest's tallies are a RECOUNT of the data, not a copy of it.
 *
 * ► **AND THE PACK FOUND SOMETHING THE COMMITTED RECORD HAS BACKWARDS**, which
 *   is pinned here so it cannot quietly revert: character 643 — declared in
 *   `tools/extract-props.mjs` as the arena's `backdrop`, "EXACTLY THE STAGE" —
 *   is placed once, on root frame 1, at depth 1, with `alphaMultiplier` 0, and
 *   is never moved or replaced on any of the 270 frames. **The build draws it
 *   on no screen at all.**
 *
 * The synthetic tests run against buffers built here, so a clone with no
 * licensed copy still executes them. The ones that need the real build skip
 * themselves by name.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import crypto from "node:crypto";

import {
  ExtractScreensError,
  buildManifest,
  extractScreens,
  indexFonts,
  parseArguments,
  parseButtonRecords,
  parseEditText,
  parseStaticText,
  readRect,
  rootTimeline,
  roundMatrix,
  stageRect,
  summaryLines,
  ORACLE_SHA256
} from "../tools/extract-screens.mjs";
import { TAG, indexCharacters, resolveTimeline } from "../tools/swf-display-list.mjs";
// ► **THE READER, IMPORTED BY THE PRODUCER'S TEST ON PURPOSE.** A filter record
//   written in a spelling `src/render/filters.js` does not know is worth
//   nothing, and a test that only checks the extractor against itself cannot
//   see that. This is the one import here that crosses from `tools/` into
//   `src/`, and it is what makes the seam test below a check rather than a
//   restatement.
import { applyColourMatrix, canvasFilterFor, summariseFilterUse } from "../src/render/filters.js";

/* ---------------------------------------------------------------- */
/* A SWF writer, only as wide as these tests need                    */
/* ---------------------------------------------------------------- */

class Writer {
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

  /** A RECT whose field width is measured, which is what the format does. */
  rect(xMin, xMax, yMin, yMax) {
    this.align();
    const needed = Math.max(1, ...[xMin, xMax, yMin, yMax].map((value) => {
      let bits = 1;
      while (value < -(2 ** (bits - 1)) || value > 2 ** (bits - 1) - 1) bits += 1;
      return bits;
    }));
    this.ub(needed, 5);
    this.sb(xMin, needed).sb(xMax, needed).sb(yMin, needed).sb(yMax, needed);
    return this.align();
  }

  /** A MATRIX with a translation only, which is all these fixtures need. */
  matrix(tx = 0, ty = 0) {
    this.align();
    this.bit(0).bit(0);
    const needed = Math.max(1, ...[tx, ty].map((value) => {
      let bits = 1;
      while (value < -(2 ** (bits - 1)) || value > 2 ** (bits - 1) - 1) bits += 1;
      return bits;
    }));
    this.ub(needed, 5).sb(tx, needed).sb(ty, needed);
    return this.align();
  }

  /** A CXFORMWITHALPHA. Add flag first on the wire, multiply block first after. */
  colourTransform(multiply) {
    this.align();
    this.bit(0).bit(1).ub(10, 4);
    for (const value of multiply) this.sb(Math.round(value * 256), 10);
    return this.align();
  }

  buffer() {
    this.align();
    return Buffer.from(this.bytes);
  }
}

function tag(code, body) {
  const writer = new Writer();
  const bytes = Buffer.isBuffer(body) ? body : body.buffer();
  if (bytes.length >= 0x3f) writer.u16((code << 6) | 0x3f).u32(bytes.length);
  else writer.u16((code << 6) | bytes.length);
  return writer.raw(bytes).buffer();
}

function swf(tags, { width = 12800, height = 8400 } = {}) {
  const header = new Writer();
  header.raw(Buffer.from("FWS", "latin1")).u8(6).u32(0);
  header.rect(0, width, 0, height);
  header.u16(24 << 8).u16(1);
  return Buffer.concat([header.buffer(), ...tags, tag(TAG.END, Buffer.alloc(0))]);
}

function place2({ depth, characterId, tx = 0, ty = 0, name, alpha, move = false }) {
  const writer = new Writer();
  let flags = 0;
  if (move) flags |= 0x01;
  if (characterId !== undefined) flags |= 0x02;
  flags |= 0x04;
  if (alpha !== undefined) flags |= 0x08;
  if (name !== undefined) flags |= 0x20;
  writer.u8(flags).u16(depth);
  if (characterId !== undefined) writer.u16(characterId);
  writer.matrix(tx, ty);
  if (alpha !== undefined) writer.colourTransform([1, 1, 1, alpha]);
  if (name !== undefined) writer.string(name);
  return tag(TAG.PLACE_OBJECT2, writer);
}

const showFrame = () => tag(TAG.SHOW_FRAME, Buffer.alloc(0));
const frameLabel = (name) => tag(TAG.FRAME_LABEL, new Writer().string(name));

function defineSprite(id, frameCount, innerTags) {
  const writer = new Writer();
  writer.u16(id).u16(frameCount).raw(Buffer.concat([...innerTags, tag(TAG.END, Buffer.alloc(0))]));
  return tag(TAG.DEFINE_SPRITE, writer);
}

/** DefineShape3 holding one solid fill and one 200-twip square. */
function defineSquare(id) {
  const writer = new Writer();
  writer.u16(id).ub(0, 5).align();
  writer.u8(1).u8(0x00).u8(0x11).u8(0x22).u8(0x33).u8(0xff);
  writer.u8(0);
  writer.ub(1, 4).ub(0, 4);
  writer.bit(0).ub(0b00101, 5);
  writer.ub(10, 5).sb(0, 10).sb(0, 10);
  writer.ub(1, 1);
  const edge = (dx, dy) => {
    writer.bit(1).bit(1).ub(10 - 2, 4);
    writer.bit(1).sb(dx, 10).sb(dy, 10);
  };
  edge(200, 0);
  edge(0, 200);
  edge(-200, 0);
  edge(0, -200);
  writer.bit(0).ub(0, 5);
  return tag(TAG.DEFINE_SHAPE3, writer);
}

/**
 * A `DefineButton2` whose records carry exactly the optional blocks named.
 *
 * The filter list and the blend mode are written in the WIRE order —
 * FILTERLIST, then BlendMode — because that is the order the parser has to
 * assume, and a fixture written in flag order would agree with a parser that
 * had it backwards.
 */
function defineButton2(id, records) {
  const writer = new Writer();
  writer.u16(id).u8(0).u16(0);
  for (const record of records) {
    let flags = record.states & 0x0f;
    if (record.filters) flags |= 0x10;
    if (record.blendMode !== undefined) flags |= 0x20;
    writer.u8(flags).u16(record.characterId).u16(record.depth);
    writer.matrix(record.tx ?? 0, record.ty ?? 0);
    writer.colourTransform([1, 1, 1, record.alpha ?? 1]);
    // `filters: true` is the original spelling and writes ONE all-zero Blur —
    // enough to prove the cursor lands after the list, which is what the test
    // that uses it is about. An ARRAY of filter bodies writes those instead,
    // for the tests that read the records back out.
    if (Array.isArray(record.filters)) writer.raw(filterList(record.filters));
    else if (record.filters) writer.u8(1).u8(1).raw(Buffer.alloc(9));
    if (record.blendMode !== undefined) writer.u8(record.blendMode);
  }
  writer.u8(0);
  return tag(TAG.DEFINE_BUTTON2, writer);
}

/* ---------------------------------------------------------------- */
/* FILTERS on the wire                                               */
/* ---------------------------------------------------------------- */

/**
 * One Blur filter body, id first.
 *
 * ► **`passes` IS THE TOP FIVE BITS of the ninth byte, not the byte.** A
 *   fixture that wrote the count as a plain byte would agree with a parser that
 *   had the same bug, which is how `skipFilterList`'s gradient arm stayed four
 *   bytes wrong through a green suite.
 */
function blurFilter({ blurX = 4, blurY = 4, passes = 1 } = {}) {
  const writer = new Writer();
  writer.u8(1);
  writer.u32(Math.round(blurX * 65536));
  writer.u32(Math.round(blurY * 65536));
  writer.u8((passes & 0x1f) << 3);
  return writer.buffer();
}

/** One Glow filter body: RGBA, two 16.16 blurs, an 8.8 strength, flags. */
function glowFilter({ colour = [255, 0, 0, 255], blurX = 5, blurY = 5, strength = 2, inner = false, passes = 1 } = {}) {
  const writer = new Writer();
  writer.u8(2);
  for (const channel of colour) writer.u8(channel);
  writer.u32(Math.round(blurX * 65536));
  writer.u32(Math.round(blurY * 65536));
  writer.u16(Math.round(strength * 256));
  // Inner, Knockout, CompositeSource, then Passes UB[5]. CompositeSource is
  // set because 881 of the build's 884 shadows and glows set it.
  writer.u8((inner ? 0x80 : 0) | 0x20 | (passes & 0x1f));
  return writer.buffer();
}

/**
 * One DropShadow filter body: RGBA, two blurs, an ANGLE and a DISTANCE, an 8.8
 * strength and flags — 23 bytes, and the angle/distance pair sits BETWEEN the
 * blurs and the strength rather than after it.
 */
function dropShadowFilter({ colour = [0, 0, 255, 255], blurX = 4, blurY = 4, angle = Math.PI / 4, distance = 8, strength = 1, passes = 1 } = {}) {
  const writer = new Writer();
  writer.u8(0);
  for (const channel of colour) writer.u8(channel);
  writer.u32(Math.round(blurX * 65536));
  writer.u32(Math.round(blurY * 65536));
  writer.u32(Math.round(angle * 65536));
  writer.u32(Math.round(distance * 65536));
  writer.u16(Math.round(strength * 256));
  writer.u8(0x20 | (passes & 0x1f));
  return writer.buffer();
}

/** One ColorMatrix filter body: twenty 32-bit floats, four rows of five. */
function colourMatrixFilter(cells) {
  const writer = new Writer();
  writer.u8(6);
  const floats = Buffer.alloc(80);
  for (let index = 0; index < 20; index += 1) floats.writeFloatLE(cells[index], index * 4);
  return writer.raw(floats).buffer();
}

/** A FILTERLIST: a count byte and the bodies. An EMPTY list is legal and real. */
function filterList(filters) {
  return Buffer.concat([Buffer.from([filters.length]), ...filters]);
}

/**
 * A `PlaceObject3`, which is the ONLY tag that can carry a filter list.
 *
 * The optional blocks are written in the WIRE order — className, character,
 * matrix, colour transform, ratio, name, clipDepth, FILTERLIST, BlendMode — and
 * not in flag order, because the two differ and the difference is the trap
 * `parsePlaceObject` documents.
 */
function place3({ depth, characterId, tx = 0, ty = 0, name, filters, blendMode, move = false }) {
  const writer = new Writer();
  let flags = 0;
  if (move) flags |= 0x01;
  if (characterId !== undefined) flags |= 0x02;
  flags |= 0x04;
  if (name !== undefined) flags |= 0x20;
  let flags2 = 0;
  if (filters !== undefined) flags2 |= 0x01;
  if (blendMode !== undefined) flags2 |= 0x02;
  writer.u8(flags).u8(flags2).u16(depth);
  if (characterId !== undefined) writer.u16(characterId);
  writer.matrix(tx, ty);
  if (name !== undefined) writer.string(name);
  if (filters !== undefined) writer.raw(filterList(filters));
  if (blendMode !== undefined) writer.u8(blendMode);
  return tag(TAG.PLACE_OBJECT3, writer);
}

function defineEditText(id, options) {
  const writer = new Writer();
  writer.u16(id).rect(0, options.width ?? 2000, 0, options.height ?? 400);
  let first = 0;
  let second = 0;
  if (options.initialText !== undefined) first |= 0x80;
  if (options.colour) first |= 0x04;
  if (options.maxLength !== undefined) first |= 0x02;
  if (options.fontId !== undefined) first |= 0x01;
  if (options.layout) second |= 0x20;
  writer.u8(first).u8(second);
  if (options.fontId !== undefined) writer.u16(options.fontId);
  if (options.fontId !== undefined) writer.u16(options.fontHeight ?? 240);
  if (options.colour) {
    writer.u8(options.colour[0]).u8(options.colour[1]).u8(options.colour[2]).u8(options.colour[3]);
  }
  if (options.maxLength !== undefined) writer.u16(options.maxLength);
  if (options.layout) writer.u8(options.layout.align).u16(1).u16(2).u16(3).u16(0xfffc);
  writer.string(options.variableName ?? "");
  if (options.initialText !== undefined) writer.string(options.initialText);
  return tag(TAG.DEFINE_EDIT_TEXT, writer);
}

/** A `DefineFont2` whose code table is where its own offset table says. */
function defineFont2(id, name, codes) {
  const writer = new Writer();
  writer.u16(id).u8(0x04).u8(0); // WideCodes, no layout, no wide offsets
  const nameBytes = Buffer.from(name, "utf8");
  writer.u8(nameBytes.length).raw(nameBytes);
  writer.u16(codes.length);
  // OffsetTable (one U16 per glyph) + CodeTableOffset (one more U16), then the
  // glyph shapes — here one empty byte each — then the codes. Every offset
  // counts from the FIRST BYTE OF THE OFFSET TABLE, which is the trap.
  const offsetTableBytes = (codes.length + 1) * 2;
  for (let index = 0; index < codes.length; index += 1) {
    writer.u16(offsetTableBytes + index);
  }
  writer.u16(offsetTableBytes + codes.length);
  for (let index = 0; index < codes.length; index += 1) writer.u8(0);
  for (const code of codes) writer.u16(code);
  return tag(48, writer);
}

/** A `DefineText2` with one style record per run and its glyphs after it. */
function defineText2(id, runs, { glyphBits = 6, advanceBits = 12 } = {}) {
  const writer = new Writer();
  writer.u16(id).rect(0, 2000, 0, 400).matrix(0, 0);
  writer.u8(glyphBits).u8(advanceBits);
  for (const run of runs) {
    let flags = 0x80;
    if (run.fontId !== undefined) flags |= 0x08;
    if (run.colour) flags |= 0x04;
    if (run.xOffset !== undefined) flags |= 0x01;
    if (run.yOffset !== undefined) flags |= 0x02;
    writer.u8(flags);
    if (run.fontId !== undefined) writer.u16(run.fontId);
    if (run.colour) writer.u8(run.colour[0]).u8(run.colour[1]).u8(run.colour[2]).u8(run.colour[3]);
    if (run.xOffset !== undefined) writer.u16(run.xOffset & 0xffff);
    if (run.yOffset !== undefined) writer.u16(run.yOffset & 0xffff);
    if (run.fontId !== undefined) writer.u16(run.height ?? 240);
    writer.u8(run.glyphs.length);
    for (const glyph of run.glyphs) {
      writer.ub(glyph.index, glyphBits).sb(glyph.advance, advanceBits);
    }
    writer.align();
  }
  writer.u8(0);
  return tag(TAG.DEFINE_TEXT2, writer);
}

/**
 * The one character in a buffer with the given id, as `indexCharacters` sees
 * it — which is the record every parser in the tool under test takes.
 *
 * A function declaration, not an arrow: `ss2-assertion-quality.test.js` finds a
 * helper body by looking for the next brace before the next newline, so a
 * multi-line arrow reads as bodyless and its callers are reported as asserting
 * nothing.
 */
function characterIn(buffer, id) {
  const { characters } = indexCharacters(buffer);
  const character = characters.get(id);
  assert.ok(character, `the fixture must define character ${id}`);
  return character;
}

/** Every kind tallied in `unresolvedByKind`, summed. */
function tallyOf(byKind) {
  return Object.values(byKind ?? {}).reduce((sum, count) => sum + count, 0);
}

/* ---------------------------------------------------------------- */
/* The root timeline as a pseudo-sprite                              */
/* ---------------------------------------------------------------- */

test("the root is dressed as a sprite with an id no real character can carry", () => {
  const buffer = swf([showFrame(), showFrame()]);
  const root = rootTimeline(buffer);
  // ► Character ids are UNSIGNED on the wire, so -1 cannot collide with one.
  //   An id of 0 could, and a pseudo-sprite that shadows a real character is a
  //   bug that surfaces as the wrong art rather than as an error.
  assert.equal(root.id, -1);
  assert.equal(root.kind, "sprite");
  // ► `frames: 0` makes `resolveTimeline`'s trailing-frame guard a no-op, so
  //   the ShowFrame tags alone decide the frame count. A declared count here
  //   would append a phantom final frame.
  assert.equal(root.frames, 0);
  assert.equal(resolveTimeline(buffer, root).frames.length, 2);
});

test("a root display list is CUMULATIVE, so a later label inherits earlier placements", () => {
  const buffer = swf([
    defineSquare(7),
    place2({ depth: 1, characterId: 7, name: "chrome" }),
    showFrame(),
    showFrame(),
    frameLabel("second_screen"),
    place2({ depth: 9, characterId: 7, tx: 400 }),
    showFrame()
  ]);
  const resolved = resolveTimeline(buffer, rootTimeline(buffer));
  assert.equal(resolved.labels.length, 1);
  assert.equal(resolved.labels[0].frame, 3);
  const screen = resolved.frames[2];
  // Depth 1 was placed on frame 1 and never removed: the screen two frames
  // later still has it, which is the whole reason a snapshot AT the label is
  // the right thing to take.
  assert.deepEqual(screen.map((entry) => entry.depth), [1, 9]);
  assert.equal(screen[0].name, "chrome");
});

test("the stage comes off the file header's own RECT, in pixels", () => {
  const buffer = swf([showFrame()], { width: 12800, height: 8400 });
  assert.deepEqual(stageRect(buffer), {
    xMin: 0, xMax: 640, yMin: 0, yMax: 420, width: 640, height: 420
  });
  // And the RECT reader itself works in twips, which is what the header holds.
  assert.deepEqual(readRect(buffer, 8).rect, { xMin: 0, xMax: 12800, yMin: 0, yMax: 8400 });
});

/* ---------------------------------------------------------------- */
/* The three parsers this file adds                                  */
/* ---------------------------------------------------------------- */

test("a button's records are read to the terminator, past a filter list and a blend mode", () => {
  const buffer = swf([
    defineSquare(7),
    defineButton2(20, [
      { states: 0x01, characterId: 7, depth: 2, tx: 100, filters: true, blendMode: 3 },
      { states: 0x0e, characterId: 7, depth: 1, tx: -40 }
    ])
  ]);
  const records = parseButtonRecords(buffer, characterIn(buffer, 20));
  assert.equal(records.length, 2);
  // ► If the filter list were skipped by a guessed length, the blend mode byte
  //   would be read as the next record's flags and this would come back with
  //   one record or with nonsense depths.
  assert.deepEqual(records.map((record) => record.depth), [2, 1]);
  assert.deepEqual(records.map((record) => record.states), [0x01, 0x0e]);
  assert.equal(records[0].matrix.tx, 100);
  assert.equal(records[1].matrix.tx, -40);
  assert.equal(records[0].hasFilters, true);
});

test("a button record list with no terminator is refused by name rather than returned short", () => {
  // A DefineButton2 body that stops mid-list: id, the three DefineButton2
  // header bytes, then one record's flags and nothing else.
  const truncated = new Writer().u16(21).u8(0).u16(0).u8(0x01).buffer();
  const buffer = swf([tag(TAG.DEFINE_BUTTON2, truncated)]);
  assert.throws(
    () => parseButtonRecords(buffer, characterIn(buffer, 21)),
    ExtractScreensError,
    "a short read must throw, because an empty button is indistinguishable from a hit area"
  );
  assert.throws(() => parseButtonRecords(buffer, characterIn(buffer, 21)), /ran past the end of its tag/);
});

test("an edit text's HasFont selects two fields separated by a third, and the variable proves it", () => {
  const buffer = swf([
    defineEditText(30, {
      fontId: 53, fontHeight: 260, colour: [1, 2, 3, 255], maxLength: 12,
      layout: { align: 1 }, variableName: "_root.goldamount", initialText: "0 gold"
    })
  ]);
  const field = parseEditText(buffer, characterIn(buffer, 30));
  assert.equal(field.fontId, 53);
  assert.equal(field.fontHeight, 260);
  assert.deepEqual(field.colour, { red: 1, green: 2, blue: 3, alpha: 255 });
  assert.equal(field.maxLength, 12);
  assert.equal(field.align, 1);
  // ► **THE LEADING IS SIGNED**, and a negative one read unsigned becomes
  //   65532 — a line spacing no layout survives.
  assert.equal(field.leading, -4);
  // ► The variable name is the tell: every field above it is positional, so a
  //   flag read in the wrong place makes this plausible garbage, not an error.
  assert.equal(field.variableName, "_root.goldamount");
  assert.equal(field.initialText, "0 gold");
});

test("an edit text with no font still reads its variable, because the height is skipped too", () => {
  const buffer = swf([defineEditText(31, { variableName: "combatlog", initialText: "" })]);
  const field = parseEditText(buffer, characterIn(buffer, 31));
  assert.equal(field.hasFont, false);
  assert.equal(field.fontId, undefined);
  assert.equal(field.variableName, "combatlog");
  assert.equal(field.initialText, "");
});

test("a font's code table is found from the OFFSET TABLE's own start, not the tag's", () => {
  const buffer = swf([defineFont2(53, "Avalon Quest", [0x68, 0x69, 0x21])]);
  const { fonts, undecodable } = indexFonts(buffer);
  assert.equal(undecodable.size, 0);
  const font = fonts.get(53);
  assert.ok(font, "the fixture's font must be indexed");
  assert.equal(font.name, "Avalon Quest");
  assert.equal(font.glyphCount, 3);
  // Measuring the code table from the tag body instead would land inside the
  // glyph shapes, where every byte is a valid character code and the words come
  // out as noise rather than as an error.
  assert.deepEqual(font.codes, [0x68, 0x69, 0x21]);
});

test("static text glyphs decode through the code table, and the advance is SIGNED", () => {
  const buffer = swf([
    defineFont2(53, "Avalon Quest", [0x68, 0x69]),
    defineText2(40, [{
      fontId: 53, colour: [255, 255, 255, 255], xOffset: 20, height: 280,
      glyphs: [{ index: 0, advance: 140 }, { index: 1, advance: -30 }]
    }])
  ]);
  const { fonts } = indexFonts(buffer);
  const text = parseStaticText(buffer, characterIn(buffer, 40), fonts);
  assert.equal(text.glyphs, 2);
  assert.equal(text.undecoded, 0);
  assert.equal(text.text, "hi");
  // ► An advance read unsigned turns -30 into 4066 and flings the next letter
  //   two hundred pixels right — which still lays out as "a line of text".
  assert.deepEqual(text.runs[0].advances, [140, -30]);
  assert.equal(text.runs[0].fontId, 53);
});

test("static text with no font table is COUNTED as undecoded rather than reported as words", () => {
  const buffer = swf([
    defineFont2(53, "Avalon Quest", [0x68, 0x69]),
    defineText2(41, [{ fontId: 53, glyphs: [{ index: 0, advance: 10 }, { index: 1, advance: 10 }] }])
  ]);
  const text = parseStaticText(buffer, characterIn(buffer, 41));
  assert.equal(text.glyphs, 2);
  // The whole point: an unread glyph is a number, never an empty string that a
  // reader would take for "this caption is blank".
  assert.equal(text.undecoded, 2);
  assert.equal(text.text, undefined);
  assert.deepEqual(text.runs[0].indices, [0, 1]);
});

test("a run that restarts the pen with a new yOffset starts a new line", () => {
  const buffer = swf([
    defineFont2(53, "Avalon Quest", [0x68, 0x69]),
    defineText2(42, [
      { fontId: 53, xOffset: 0, glyphs: [{ index: 0, advance: 10 }] },
      { fontId: 53, yOffset: 300, glyphs: [{ index: 1, advance: 10 }] }
    ])
  ]);
  const { fonts } = indexFonts(buffer);
  const text = parseStaticText(buffer, characterIn(buffer, 42), fonts);
  // ► Without this the character sheet's label column reads
  //   "hairstylestubbleshoulderguard": the format has no newline glyph, only a
  //   fresh pen position.
  assert.equal(text.text, "h\ni");
  assert.equal(text.runs.length, 2);
});

/* ---------------------------------------------------------------- */
/* The conventions every pack here shares                            */
/* ---------------------------------------------------------------- */

test("a matrix reaches JSON with its translation still in TWIPS and no negative zero", () => {
  const rounded = roundMatrix({ a: 1.0399872, b: 0, c: -0, d: 1, tx: 6314, ty: -0 });
  assert.deepEqual(rounded, [1.03999, 0, 0, 1, 6314, 0]);
  // ► `-0` survives JSON as `-0` and compares unequal under `Object.is`, which
  //   is how a byte-identical re-extraction looks like a changed one.
  assert.equal(Object.is(rounded[2], -0), false);
  assert.equal(Object.is(rounded[5], -0), false);
  // ► And 6314 stays 6314: dividing here is what inflated three rows of the
  //   committed arena size table by a factor of twenty.
  assert.equal(rounded[4], 6314);
});

test("--out names a directory, --report is a flag, and an unknown option is refused", () => {
  assert.equal(parseArguments([]).out.endsWith("assets/screens"), true);
  assert.equal(parseArguments(["--out", "/tmp/screens"]).out, "/tmp/screens");
  assert.equal(parseArguments(["--report"]).report, true);
  assert.equal(parseArguments(["/some/build.swf"]).file, "/some/build.swf");
  assert.throws(() => parseArguments(["--out"]), ExtractScreensError);
  assert.throws(() => parseArguments(["--out", "--report"]), ExtractScreensError);
  assert.throws(() => parseArguments(["--nonsense"]), /Unknown option/);
});

/* ---------------------------------------------------------------- */
/* THE ACCOUNTING — the tests the defect class needs                 */
/* ---------------------------------------------------------------- */

test("a build whose root has no FrameLabel is REFUSED, never written out as zero screens", () => {
  const buffer = swf([defineSquare(7), place2({ depth: 1, characterId: 7 }), showFrame()]);
  // ► An empty pack with a clean report is exactly the shape of the defect this
  //   whole file is arranged against, so the tool must refuse rather than write
  //   `{"screens":{}}` and exit zero.
  assert.throws(() => extractScreens(buffer), ExtractScreensError);
  assert.throws(() => extractScreens(buffer), /no FrameLabel tags/);
});

test("a screen whose objects all fail to resolve SAYS SO, loudly and in the failures", () => {
  const buffer = swf([
    defineEditText(30, { variableName: "name", initialText: "Maximus" }),
    frameLabel("all_text"),
    place2({ depth: 1, characterId: 30 }),
    showFrame()
  ]);
  const { screens, failures } = extractScreens(buffer);
  const screen = screens.all_text;
  assert.equal(screen.counts.drawables, 0);
  assert.equal(screen.resolvedNothing, true);
  assert.match(screen.note, /NONE of them resolved/);
  assert.equal(failures.some((failure) => failure.kind === "screen-resolved-nothing"), true);
  // And the text is not lost: its box and its variable are still exported.
  assert.equal(screen.textFields.length, 1);
  assert.equal(screen.textFields[0].variableName, "name");
});

test("the unresolved roster and the unresolved tally are written by one call and cannot drift", () => {
  const buffer = swf([
    defineSquare(7),
    defineEditText(30, { variableName: "gold", initialText: "0" }),
    defineButton2(20, [{ states: 0x08, characterId: 7, depth: 1 }]),
    frameLabel("mixed"),
    place2({ depth: 1, characterId: 7 }),
    place2({ depth: 2, characterId: 30 }),
    place2({ depth: 3, characterId: 20 }),
    showFrame()
  ]);
  const screen = extractScreens(buffer).screens.mixed;
  // ► The first version of this tool kept text in `textFields` and everything
  //   else in `unresolved`, so a screen carrying 26 unreadable text characters
  //   printed `unresolved: 0` beside `unresolvedByKind: {text: 26}`. A count
  //   that disagrees with its own list BY DESIGN is the defect
  //   `test/extraction-honesty.test.js` exists for, arriving one file later.
  assert.equal(screen.unresolved.length, tallyOf(screen.counts.unresolvedByKind));
  assert.equal(screen.counts.unresolved, screen.unresolved.length);
  assert.deepEqual(
    [...new Set(screen.unresolved.map((entry) => entry.kind))].sort(),
    ["button-hit-area-only", "text-edit"]
  );
  // The square still draws, so this screen is not "resolved nothing".
  assert.equal(screen.counts.drawables, 1);
  assert.equal(screen.resolvedNothing, false);
});

test("every object that drew nothing carries a reason, and a reasonless one is a failure", () => {
  const buffer = swf([
    defineSquare(7),
    defineSprite(50, 1, [showFrame()]),
    defineEditText(30, { variableName: "gold", initialText: "0" }),
    defineButton2(20, [{ states: 0x08, characterId: 7, depth: 1 }]),
    frameLabel("silent"),
    place2({ depth: 1, characterId: 7 }),
    place2({ depth: 2, characterId: 50, name: "rain" }),
    place2({ depth: 3, characterId: 30 }),
    place2({ depth: 4, characterId: 20 }),
    showFrame()
  ]);
  const { screens, failures } = extractScreens(buffer);
  const screen = screens.silent;
  assert.equal(screen.counts.objectsDrawingNothing, 3);
  // ► Each of the three is a LEGITIMATE empty, and each looks exactly like a
  //   silent drop. Naming which is the only thing that tells them apart.
  const reasons = new Map(screen.objectsDrawingNothing.map((object) => [object.depth, object.because]));
  assert.match(reasons.get(2), /frame 1 of this 1-frame clip places nothing/);
  assert.match(reasons.get(3), /text character is never drawn/);
  assert.match(reasons.get(4), /none is UP/);
  assert.equal(screen.counts.objectsDrawingNothingUnexplained, 0);
  assert.equal(failures.some((failure) => failure.kind === "object-drew-nothing"), false);
});

test("the manifest RECOUNTS the approximations from the shapes instead of copying a tally", () => {
  // A hand-built extraction whose screen claims nothing is approximated while
  // its own shape carries a gradient and a bitmap. The manifest must contradict
  // the screen, because `assets/props/manifest.json` once said `failures: 0`
  // beside eleven approximated regions and nothing noticed for months.
  const extraction = {
    screens: {
      liar: {
        labelFrame: 1, firstFrame: 1, lastFrame: 1,
        counts: { objects: 1, drawables: 1, distinctShapes: 1, unresolvedByKind: { "text-static": 2 } },
        approximations: { gradientPaths: 0, bitmapPaths: 0 },
        objectsDrawingNothing: [], rangeVariance: null, resolvedNothing: false
      }
    },
    shapes: {
      7: { character: 7, bounds: {}, paths: [
        { d: "M0 0L1 0Z", approximated: "gradient" },
        { d: "M0 0L1 0Z", approximated: "bitmap" },
        { d: "M0 0L1 0Z", approximated: null }
      ] }
    },
    fonts: {},
    failures: [],
    totals: { screens: 1, shapes: 1 }
  };
  const manifest = buildManifest(extraction, { source: "fixture.swf", sha256: "abc" });
  assert.deepEqual(manifest.approximationsByPath, { gradient: 1, bitmap: 1 });
  assert.equal(manifest.totals.shapePaths, 3);
  // The per-USE block still reports what the screen claimed, and the two are
  // labelled differently so a reader is never asked to guess which they have.
  assert.deepEqual(manifest.approximationsByUse, { gradientPaths: 0, bitmapPaths: 0 });
  assert.deepEqual(manifest.unresolvedByKind, { "text-static": 2 });
});

/* ---------------------------------------------------------------- */
/* FILTERS: the list, not the boolean                                */
/* ---------------------------------------------------------------- */

/**
 * A greyscale colour matrix in FLASH's own coefficients, which are not CSS's.
 *
 * Used because it is unmistakably NOT the identity — an identity matrix is
 * counted as a no-op by `canvasFilterFor` and would make the deferral tests
 * below pass for the wrong reason.
 */
const GREYSCALE_CELLS = Object.freeze([
  0.3086, 0.6094, 0.082, 0, 0,
  0.3086, 0.6094, 0.082, 0, 0,
  0.3086, 0.6094, 0.082, 0, 0,
  0, 0, 0, 1, 0
]);

/** Whether `path` starts with `prefix`, which is how a filter reaches a leaf. */
function startsWith(path, prefix) {
  if (prefix.length === 0 || prefix.length > path.length) return false;
  for (let index = 0; index < prefix.length; index += 1) {
    if (path[index] !== prefix[index]) return false;
  }
  return true;
}

/**
 * One screen carrying every filter site this tool can reach: a top-level
 * `PlaceObject3` with TWO filters, a nested sprite whose own inner placement
 * carries a colour matrix, and a button whose UP record carries a glow.
 */
function filteredScreen() {
  return swf([
    defineSquare(7),
    defineSprite(50, 1, [
      place3({ depth: 9, characterId: 7, filters: [colourMatrixFilter(GREYSCALE_CELLS)] }),
      showFrame()
    ]),
    defineButton2(20, [
      // ► TWO filters on ONE record, deliberately: a tally that counted RECORDS
      //   rather than FILTERS would read 1 here and survive undetected, which
      //   is the exact mistake `approximations.filters` has been making since
      //   this tool was written. Caught by mutation on the first pass of this
      //   test, when the record carried one filter and both numbers were 1.
      {
        states: 0x01, characterId: 7, depth: 4,
        filters: [glowFilter({ colour: [0, 255, 0, 255] }), dropShadowFilter()]
      },
      { states: 0x0e, characterId: 7, depth: 5, filters: [blurFilter({ blurX: 9, blurY: 9, passes: 2 })] }
    ]),
    frameLabel("effects"),
    place3({ depth: 1, characterId: 7, filters: [glowFilter(), blurFilter()] }),
    place2({ depth: 2, characterId: 50 }),
    place2({ depth: 3, characterId: 20 }),
    showFrame()
  ]);
}

test("a filtered placement carries its TYPED RECORDS, and a boolean is not a report", () => {
  const screen = extractScreens(filteredScreen()).screens.effects;

  // ► **THE ROSTER USED TO SAY `filters: true`.** That told a reader THAT a
  //   placement was filtered and nothing else, which is why nothing in this
  //   tree could apply one.
  const object = screen.objects.find((entry) => entry.depth === 1);
  assert.equal(Array.isArray(object.filters), true, "the roster carries the LIST, not a boolean");
  assert.deepEqual(object.filters.map((filter) => filter.type), ["glow", "blur"]);
  assert.equal(object.filters[0].colour.red, 255);
  assert.equal(object.filters[0].strength, 2);
  assert.equal(object.filters[1].passes, 1);

  // And `filteredPlacements` — the roster `src/render/screen.js` reads — the
  // same, at every nesting level.
  const top = screen.filteredPlacements.find((entry) => entry.path.length === 1);
  assert.deepEqual(top.path, [1]);
  assert.deepEqual(top.filters.map((filter) => filter.type), ["glow", "blur"]);
  const nested = screen.filteredPlacements.find((entry) => entry.path.length === 2);
  assert.deepEqual(nested.path, [2, 9], "a filter inside a sprite keeps the path that reaches it");
  assert.equal(nested.filters.length, 1);
  assert.equal(nested.filters[0].type, "colourMatrix");
  assert.equal(nested.filters[0].matrix.length, 20);
  // Float32 on the wire, so compare at the precision the format actually has.
  assert.equal(Math.round(nested.filters[0].matrix[1] * 1e4) / 1e4, 0.6094);

  // ► **THE TWO NUMBERS THAT ARE NOT THE SAME NUMBER.** `filters` counts
  //   PLACEMENTS and `filterRecords` counts FILTERS; the top-level placement
  //   carries two, so a `filterRecords` computed as `filters.length` reads 2
  //   here and must read 3.
  assert.equal(screen.approximations.filters, 2, "two PLACEMENTS carry a filter list");
  assert.equal(screen.approximations.filterRecords, 3, "carrying THREE filters between them");
  assert.notEqual(screen.approximations.filters, screen.approximations.filterRecords);
  assert.equal(screen.approximations.filterListEmpty, 0);
  assert.equal(screen.approximations.filterListUnread, 0);

  // The tally is a recount of the two rosters, and the button's own two are
  // in it — this is the only place the button's filters are counted at all.
  assert.deepEqual(screen.counts.filtersByType, { glow: 2, blur: 1, colourMatrix: 1, dropShadow: 1 });
});

test("an EMPTY filter list is a declared list carrying nothing, and says which it is", () => {
  const buffer = swf([
    defineSquare(7),
    frameLabel("bare"),
    place3({ depth: 1, characterId: 7, filters: [] }),
    showFrame()
  ]);
  const screen = extractScreens(buffer).screens.bare;
  // ► FIVE OF THESE ARE ON THE WIRE and one is reached by a screen. The flag is
  //   set, so `hasFilters` is true and this placement is counted in `filters` —
  //   but there is nothing to apply, and a reader that subtracts
  //   `filterListEmpty` gets the honest denominator instead of chasing a filter
  //   that was never there.
  assert.deepEqual(screen.objects[0].filters, []);
  assert.deepEqual(screen.filteredPlacements[0].filters, []);
  assert.equal(screen.approximations.filters, 1);
  assert.equal(screen.approximations.filterRecords, 0);
  assert.equal(screen.approximations.filterListEmpty, 1);
  assert.deepEqual(screen.counts.filtersByType, {});
});

test("a BUTTONRECORD's filter list is DECODED, and it is not in filteredPlacements", () => {
  const buffer = filteredScreen();
  // The parser first: the list is read, not stepped over, and the record that
  // follows it still lands on the right depth.
  const records = parseButtonRecords(buffer, characterIn(buffer, 20));
  assert.deepEqual(records.map((record) => record.depth), [4, 5]);
  assert.equal(records[0].filters[0].type, "glow");
  assert.equal(records[0].filters[0].colour.green, 255);
  assert.equal(records[1].filters[0].type, "blur");
  assert.equal(records[1].filters[0].blurX, 9);
  assert.equal(records[1].filters[0].passes, 2, "passes is the TOP five bits of the ninth byte");

  const screen = extractScreens(buffer).screens.effects;
  // ► **`nestedSprites` WALKS SPRITES AND NEVER BUTTONS**, so a filter on a
  //   BUTTONRECORD reaches `filteredPlacements` in no form at all. Measured on
  //   the build: 34 of its 704 button records are filtered, 13 of them UP, and
  //   the 26 screens reach 5. They get their own roster rather than being
  //   merged into one whose paths a different producer writes.
  assert.equal(screen.filteredPlacements.some((entry) => entry.path[0] === 3), false,
    "the button's own depth appears in no filteredPlacements entry");
  assert.equal(screen.filteredButtonRecords.length, 1, "only the UP record is ever drawn");
  const [entry] = screen.filteredButtonRecords;
  assert.deepEqual(entry.path, [3, 4], "the button's depth, then the record's");
  assert.equal(entry.button, 20);
  assert.deepEqual(entry.filters.map((filter) => filter.type), ["glow", "dropShadow"]);
  assert.equal(entry.filters[1].distance, 8, "the drop shadow's distance, from between the blurs and the strength");
  // ► ONE roster entry carrying TWO filters, so a count of RECORDS reads 1 and
  //   a count of FILTERS reads 2. The first version of this assertion could not
  //   tell them apart and a mutation walked straight through it.
  assert.equal(screen.filteredButtonRecords.length, 1);
  assert.equal(screen.approximations.filtersInButtonRecords, 2);

  // ► **THE PATH REACHES REAL OPERATIONS *WHEN THE RECORD PLACES A SHAPE*.**
  //   ~~"which is the only thing that makes the roster worth writing"~~ —
  //   struck 2026-09-14, because this fixture places a SQUARE and the build
  //   never does. Measured on the oracle: all 13 filtered UP records in the
  //   file place a `DefineText`, so this assertion's evidence is the INVERSE of
  //   the build's and could not have caught it. The oracle test
  //   "the five filtered button records on this build sit over TEXT…" below is
  //   the one that covers the real case; this one covers the other branch of
  //   `leaf`, which is worth keeping precisely because nothing on the build
  //   exercises it.
  assert.equal(entry.leaf, "shape", "this fixture's UP record places a shape, which the build's never do");
  const covered = screen.drawables.filter((drawable) => startsWith(drawable.path, entry.path));
  assert.equal(covered.length, 1, "the UP record's square is under its own filter");
  assert.equal(covered[0].via, "button 20");
  assert.equal(screen.approximations.buttonRecordsFiltered, 1, "ONE record…");
  assert.equal(screen.approximations.filtersInButtonRecords, 2, "…carrying TWO filters");
  assert.equal(screen.approximations.buttonRecordsFilteredOverText, 0,
    "and none of them over text, which is what makes this fixture unrepresentative");
});

test("a filtered UP record over TEXT reaches no drawable, and the pack says so by name", () => {
  // ► **THE BUILD'S ONLY REAL CASE, WHICH THE FIXTURE ABOVE INVERTS.** The town
  //   square's five menu glows are filtered UP records placing `DefineText`,
  //   and text lands in `screen.staticText`, never in `screen.drawables`. A
  //   consumer prefix-matching `drawables` — which is what `src/render/screen.js`
  //   does with `filteredPlacements` — reaches zero of them. So the roster
  //   names the leaf kind, and the count names the miss.
  const buffer = swf([
    defineFont2(40, "Sans", [0x41]),
    defineText2(41, [{ fontId: 40, colour: [0, 0, 0, 255], glyphs: [{ index: 0, advance: 100 }] }]),
    defineButton2(21, [
      { states: 0x01, characterId: 41, depth: 6, filters: [glowFilter()] }
    ]),
    frameLabel("menu"),
    place2({ depth: 7, characterId: 21 }),
    showFrame()
  ]);
  const screen = extractScreens(buffer).screens.menu;

  assert.equal(screen.filteredButtonRecords.length, 1);
  const [entry] = screen.filteredButtonRecords;
  assert.deepEqual(entry.path, [7, 6]);
  assert.equal(entry.leaf, "text", "the roster says which table to look in");
  assert.equal(screen.approximations.buttonRecordsFilteredOverText, 1);

  // The two halves of the claim, measured rather than assumed:
  assert.equal(screen.drawables.filter((drawable) => startsWith(drawable.path, entry.path)).length, 0,
    "a prefix match against drawables reaches NOTHING");
  const text = screen.staticText.filter((item) => item.path.join("/") === entry.path.join("/"));
  assert.equal(text.length, 1, "and an EXACT match against staticText reaches exactly one");
  assert.equal(text[0].text, "A", "the glyph the record's filter is glowing");
});

test("a BUTTONRECORD declaring an EMPTY filter list is rostered, not dropped by a bare continue", () => {
  // ► **THE PLACEMENT PATH CALLED THIS EVIDENCE AND THE BUTTON PATH THREW IT
  //   AWAY.** `if (!Array.isArray(record.filters) || record.filters.length === 0)
  //   continue;` fired before any counter, so an empty list appeared in no
  //   roster and in no tally — while `filterListEmpty` records the identical
  //   fact for a `PlaceObject3`. Two paths, one fact, opposite treatment.
  //   Measured 0 on the build (34 filtered records, none empty), so this is
  //   latent; it is exactly the shape of the omissions this project has paid
  //   for, which is why it is pinned rather than argued away.
  const buffer = swf([
    defineSquare(7),
    defineButton2(22, [{ states: 0x01, characterId: 7, depth: 4, filters: [] }]),
    frameLabel("bare"),
    place2({ depth: 2, characterId: 22 }),
    showFrame()
  ]);
  const screen = extractScreens(buffer).screens.bare;

  assert.equal(screen.filteredButtonRecords.length, 1, "the record is ON the roster, carrying nothing");
  assert.deepEqual(screen.filteredButtonRecords[0].filters, []);
  assert.equal(screen.approximations.buttonRecordsFiltered, 1);
  assert.equal(screen.approximations.filtersInButtonRecords, 0, "no filters, because there are none");
  assert.equal(screen.approximations.filterListEmptyInButtonRecords, 1, "and the drop is counted by name");
  // The same spelling the placement path uses for the same fact, which is the
  // half of this that is not about counting.
  assert.equal(screen.counts.filtersByType.glow, undefined);
  assert.deepEqual(screen.counts.filtersByType, {});
});

test("a filtered placement INSIDE a button's sprite reaches filteredPlacements", () => {
  // ► **THE HOLE THAT READ AS AN ABSENCE OF FILTERS.** `nestedSprites` walks
  //   the ROOT display list; a button's records are expanded in the button arm,
  //   so a filtered `PlaceObject3` inside a sprite an UP record places was in
  //   NEITHER roster and in NO count. 49 UP records across the build place a
  //   sprite and 0 of them hold a filtered placement — a number that only means
  //   something once a walk exists to produce it.
  const buffer = swf([
    defineSquare(7),
    defineSprite(51, 1, [
      place3({ depth: 11, characterId: 7, filters: [blurFilter({ blurX: 6, blurY: 6 })] }),
      showFrame()
    ]),
    defineButton2(23, [{ states: 0x01, characterId: 51, depth: 8 }]),
    frameLabel("deep"),
    place2({ depth: 5, characterId: 23 }),
    showFrame()
  ]);
  const screen = extractScreens(buffer).screens.deep;

  assert.equal(screen.approximations.filtersInButtonSubtrees, 1);
  assert.equal(screen.approximations.filters, 1, "and it is counted in the roster's own total");
  assert.equal(screen.approximations.filterRecords, 1);
  assert.equal(screen.filteredButtonRecords.length, 0, "the RECORD carries no list; the placement under it does");
  const [placement] = screen.filteredPlacements;
  // ► The path is the button's depth, the record's depth, then the placement's
  //   — which is exactly what `flattenFrame` gives the leaf, so the prefix
  //   match reaches it. Asserted rather than assumed: this is the whole reason
  //   these go in `filteredPlacements` instead of a third roster.
  assert.deepEqual(placement.path, [5, 8, 11]);
  assert.equal(placement.filters[0].type, "blur");
  const covered = screen.drawables.filter((drawable) => startsWith(drawable.path, placement.path));
  assert.equal(covered.length, 1, "and the operation it covers is really there");
  assert.equal(covered[0].via, "button 23");
});

test("THE SEAM: what this extractor writes is what src/render/filters.js reads", () => {
  // ► **A PRODUCER AND A READER DISAGREEING AT A SEAM IS THIS PROJECT'S MOST
  //   REPEATED DEFECT**, and a filter record is the easiest place yet to invent
  //   a second spelling — the eight-number colour transform array and the named
  //   object already cost this tree one. So the records go out in
  //   `parseFilterList`'s own shape and this test hands them, through JSON,
  //   straight to the module that has to consume them.
  const raw = extractScreens(filteredScreen()).screens.effects;
  const screen = JSON.parse(JSON.stringify(raw));

  const top = screen.filteredPlacements.find((entry) => entry.path.length === 1);
  const glowAndBlur = canvasFilterFor(top.filters);
  assert.equal(glowAndBlur.counts.refused, 0, "neither a glow nor a blur may be refused by name");
  assert.equal(glowAndBlur.counts.applied, 2);
  assert.match(glowAndBlur.filter, /^drop-shadow\(/, "the glow becomes a CSS drop-shadow");
  assert.match(glowAndBlur.filter, /blur\(1\.118\d*px\)/,
    "and the blur's sigma is the box/Gaussian bridge over blurX 4, one pass");
  assert.match(glowAndBlur.filter, /rgba\(255, 0, 0, 1\)/, "the glow's own colour, not black");

  const nested = screen.filteredPlacements.find((entry) => entry.path.length === 2);
  const matrix = canvasFilterFor(nested.filters);
  // A colour matrix is DEFERRED, not refused: CSS has no arbitrary matrix, so
  // it goes to `applyColourMatrix` per fill and comes back whole here.
  assert.equal(matrix.filter, null);
  assert.equal(matrix.counts.deferred, 1);
  assert.equal(matrix.counts.refused, 0);
  assert.equal(matrix.colourMatrices[0].length, 20);
  const grey = applyColourMatrix("#ff0000", matrix.colourMatrices[0], 1);
  assert.equal(grey.applied, true);
  assert.equal(grey.fill, "#4f4f4f", "Flash's 0.3086 red coefficient, not CSS's 0.2126");

  // And the button's record reaches the same reader with no second shape.
  const button = canvasFilterFor(screen.filteredButtonRecords[0].filters);
  assert.equal(button.counts.applied, 2, "a glow and a drop shadow, both expressible");
  assert.match(button.filter, /rgba\(0, 255, 0, 1\)/);

  // The whole screen through the summariser, which is the line a human reads.
  const summary = summariseFilterUse([glowAndBlur, matrix, button]);
  assert.equal(summary.total, 5, "two on the placement, one nested, two on the button record");
  assert.equal(summary.applied, 4);
  assert.equal(summary.deferred, 1, "the colour matrix, which no CSS filter can express");
  assert.equal(summary.refused, 0);
  assert.deepEqual(summary.refusedByReason, {});
});

test("the manifest RECOUNTS the filters from the rosters instead of summing a tally", () => {
  // The screen's own `counts.filtersByType` lies and its `filteredPlacements`
  // tells the truth. A manifest that summed the tally would repeat the lie,
  // which is the defect `test/extraction-honesty.test.js` exists for.
  const extraction = {
    screens: {
      liar: {
        labelFrame: 1, firstFrame: 1, lastFrame: 1,
        counts: { objects: 1, drawables: 0, distinctShapes: 0, unresolvedByKind: {}, filtersByType: { glow: 99 } },
        approximations: { filters: 1, filterRecords: 2, filtersInButtonRecords: 1 },
        filteredPlacements: [{ character: 7, path: [1], filters: [{ type: "glow" }, { type: "blur" }] }],
        filteredButtonRecords: [{ character: 7, path: [2, 3], button: 20, filters: [{ type: "dropShadow" }] }],
        objectsDrawingNothing: [], rangeVariance: null, resolvedNothing: false
      }
    },
    shapes: {}, fonts: {}, failures: [], totals: { screens: 1, shapes: 0 }
  };
  const manifest = buildManifest(extraction, { source: "fixture.swf", sha256: "abc" });
  assert.deepEqual(manifest.filtersByType, { glow: 1, blur: 1, dropShadow: 1 },
    "recounted from the two rosters, so the screen's own 99 glows cannot launder through");
  // The per-USE block still reports what the screen claimed, labelled as such.
  assert.equal(manifest.approximationsByUse.filterRecords, 2);
  assert.equal(manifest.approximationsByUse.filtersInButtonRecords, 1);
});

test("a filter record with no type is counted as unknown rather than dropped", () => {
  // `parseFilterList` throws on an id it cannot name, so this should be
  // unreachable — which is exactly why it is pinned. A bucket that silently
  // drops what it cannot classify is a `catch { continue; }` wearing a tally's
  // clothes, and this project has paid for that one twice.
  const extraction = {
    screens: {
      odd: {
        labelFrame: 1, firstFrame: 1, lastFrame: 1,
        counts: { unresolvedByKind: {} }, approximations: {},
        filteredPlacements: [{ character: 7, path: [1], filters: [{ blurX: 4 }, { type: "glow" }] }],
        filteredButtonRecords: [],
        objectsDrawingNothing: [], rangeVariance: null, resolvedNothing: false
      }
    },
    shapes: {}, fonts: {}, failures: [], totals: { screens: 1, shapes: 0 }
  };
  const manifest = buildManifest(extraction, { source: "fixture.swf", sha256: "abc" });
  assert.deepEqual(manifest.filtersByType, { unknown: 1, glow: 1 });
});


/* ---------------------------------------------------------------- */
/* Against the installed build                                       */
/* ---------------------------------------------------------------- */

const ORACLE =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";
const haveOracle = fs.existsSync(ORACLE);
const skip = haveOracle ? false : "no installed build on this machine";

test("THE ANCHOR: the numbers below are attributed to ONE build, and this is it", { skip }, () => {
  // ► **AN `fs.existsSync` GUARD IS NOT A GUARD.** Every pinned number under
  //   this heading — 270 frames, 136 characters, 243 placements, 271 filters,
  //   276 typed records, 214 CSS strings — is a measurement OF A PARTICULAR
  //   FILE. "A path that exists" and "the file those numbers describe" are
  //   different facts, and a check that cannot tell them apart would either
  //   skip on a machine that has a build, or re-pin silently against a
  //   different one. So the existence guard is anchored on CONTENT, the way
  //   `ss2-divergence-corpus.test.js` anchors `CAPTURES_DIR` on the committed
  //   README rather than on the directory being there.
  //
  //   `extract-screens.mjs` itself PRINTS a note on a mismatch and extracts
  //   anyway, which is right for a tool someone runs against their own copy.
  //   It is not right for a test whose assertions are quoted as evidence about
  //   the oracle, so here it is a failure with a name on it.
  const digest = crypto.createHash("sha256").update(fs.readFileSync(ORACLE)).digest("hex");
  assert.equal(digest, ORACLE_SHA256,
    `the installed build is ${digest.slice(0, 16)}…, not the oracle every number in this file was measured against`);
});

/** The oracle, read once and shared by the tests below. */
function oracleBuffer() {
  return fs.readFileSync(ORACLE);
}

test("the oracle's root carries 270 frames and 26 screens at their measured labels", { skip }, () => {
  const buffer = oracleBuffer();
  const resolved = resolveTimeline(buffer, rootTimeline(buffer));
  assert.equal(resolved.frames.length, 270);
  // Pinned by name and frame, because every offset this pack exports is
  // relative to one of them and a drift here is a silently wrong screen.
  assert.deepEqual(resolved.labels, [
    { frame: 10, name: "splash" }, { frame: 35, name: "new_or_continue" },
    { frame: 54, name: "credits" }, { frame: 60, name: "help" },
    { frame: 65, name: "createchar" }, { frame: 73, name: "createboss" },
    { frame: 79, name: "showfig" }, { frame: 84, name: "load_saved_gladiators" },
    { frame: 89, name: "delete_gladiator" }, { frame: 96, name: "daybreak" },
    { frame: 114, name: "dungeon" }, { frame: 150, name: "townsquare" },
    { frame: 160, name: "special_event" }, { frame: 165, name: "special_event_result" },
    { frame: 170, name: "armoury" }, { frame: 179, name: "weaponshop" },
    { frame: 187, name: "magicshop" }, { frame: 195, name: "church" },
    { frame: 203, name: "foyer" }, { frame: 214, name: "arena_intro" },
    { frame: 221, name: "arena" }, { frame: 227, name: "levelup" },
    { frame: 235, name: "gameover" }, { frame: 242, name: "bugs" },
    { frame: 252, name: "gameover_demo" }, { frame: 263, name: "enter_highscore" }
  ]);
});

test("the screens are reachable only BY CHARACTER ID: four of 136 carry an export name", { skip }, () => {
  const buffer = oracleBuffer();
  const { characters, names } = indexCharacters(buffer);
  const { screens } = extractScreens(buffer);
  const placed = new Set();
  for (const screen of Object.values(screens)) {
    for (const object of screen.objects) placed.add(object.character);
  }
  assert.equal(placed.size, 136);
  assert.ok(characters.size > 136, "the file defines far more characters than the screens place");
  const exported = [...placed].filter((id) => names.has(id)).map((id) => `${id} ${names.get(id)}`).sort();
  // ► This is why the tool takes characters off the root rather than out of
  //   `ExportAssets`: the shops, the town and the dungeon have no linkage name
  //   at all, and a pattern over the 502 exports would extract none of them.
  assert.deepEqual(exported, ["486 helmet14", "492 inventory_overlay", "566 weapon49", "945 shield12"]);
});

test("character 643 is placed with alphaMultiplier 0 — the build draws no backdrop", { skip }, () => {
  const buffer = oracleBuffer();
  const resolved = resolveTimeline(buffer, rootTimeline(buffer));
  // ► **PINNED BECAUSE THE COMMITTED RECORD HAS IT BACKWARDS.**
  //   `tools/extract-props.mjs` declares 643 as the arena's `backdrop` and
  //   calls it "EXACTLY THE STAGE... the sky and ground the whole fight happens
  //   against". One PlaceObject2 on frame 1 carries a CXFORMWITHALPHA whose
  //   alpha multiply term is zero, and nothing on any of the 270 frames moves
  //   or replaces depth 1. That extractor reads the CLIP, which is real; what
  //   it cannot see is the root PLACEMENT, which is transparent.
  for (let frame = 1; frame <= 270; frame += 1) {
    const entry = resolved.frames[frame - 1].find((candidate) => candidate.depth === 1);
    assert.ok(entry, `depth 1 must be live on frame ${frame}`);
    assert.equal(entry.characterId, 643);
    assert.equal(entry.colourTransform.alphaMultiplier, 0,
      `frame ${frame}: character 643 is transparent on every frame of the build`);
  }
  // And the pack carries that transform out, so a renderer cannot miss it.
  const { screens } = extractScreens(buffer);
  const backdrop = screens.arena.objects.find((object) => object.depth === 1);
  assert.equal(backdrop.character, 643);
  assert.equal(backdrop.colour.alphaMultiplier, 0);
});

test("across all 26 screens, no object drew nothing without saying why", { skip }, () => {
  const { screens, failures } = extractScreens(oracleBuffer());
  assert.equal(Object.keys(screens).length, 26);
  for (const screen of Object.values(screens)) {
    assert.equal(screen.counts.objectsDrawingNothingUnexplained, 0,
      `${screen.name} has an object that produced no drawable and no reason`);
    for (const object of screen.objectsDrawingNothing) {
      assert.equal(typeof object.because, "string",
        `${screen.name} depth ${object.depth} must say WHY it drew nothing`);
      assert.ok(object.because.length > 0);
    }
  }
  assert.equal(failures.filter((failure) => failure.kind === "object-drew-nothing").length, 0);
});

test("no screen in the build resolves to nothing, and every one is named if it does", { skip }, () => {
  const { screens } = extractScreens(oracleBuffer());
  const empty = Object.values(screens).filter((screen) => screen.resolvedNothing);
  assert.deepEqual(empty.map((screen) => screen.name), [],
    "a screen with no drawables would need a note and a failure, not a quiet empty entry");
  for (const screen of Object.values(screens)) {
    assert.ok(screen.counts.drawables > 0, `${screen.name} must resolve to at least one drawable`);
  }
});

test("on every screen the unresolved roster equals its own tally", { skip }, () => {
  const { screens } = extractScreens(oracleBuffer());
  let total = 0;
  for (const screen of Object.values(screens)) {
    assert.equal(screen.unresolved.length, tallyOf(screen.counts.unresolvedByKind),
      `${screen.name}: the list and the count disagree`);
    total += screen.unresolved.length;
  }
  assert.ok(total > 0, "the build's screens carry text and hit areas; a zero here means nothing was counted");
});

test("every drawable names a shape that exists, and no shape ships an empty path", { skip }, () => {
  const { screens, shapes } = extractScreens(oracleBuffer());
  let drawables = 0;
  for (const screen of Object.values(screens)) {
    for (const drawable of screen.drawables) {
      drawables += 1;
      assert.ok(shapes[drawable.shape], `${screen.name} draws shape ${drawable.shape}, which is not in the table`);
      assert.equal(Array.isArray(drawable.path), true);
      assert.ok(drawable.path.length > 0, "a drawable must be traceable to the depth that placed it");
      if (drawable.clip) assert.ok(shapes[drawable.clip.shape], "a clip must name a shape in the table");
    }
  }
  assert.ok(drawables > 0, "the 26 screens must resolve to drawables");
  for (const [key, shape] of Object.entries(shapes)) {
    assert.ok(shape.paths.length > 0, `shape ${key} has no paths at all`);
    for (const entry of shape.paths) {
      // ► **NEVER A SILENTLY-EMPTY PATH.** A `d` of "" renders as nothing and
      //   reports as a success, which is exactly how the arena's walls stayed
      //   invisible. An approximated fill still has geometry; what it lacks is
      //   the paint, and that is what `approximated` says.
      assert.ok(entry.d.length > 0, `shape ${key} has a path with no geometry`);
      // ► **A STROKE IS LEGITIMATELY UNFILLED**, and the first version of this
      //   assertion forgot that and went red on shape 56 — eight solid fills
      //   and one 2px black outline. So the rule is: an unpainted path is
      //   either a STROKE, which paints along its edge, or an APPROXIMATION,
      //   which says what it could not paint. What must never exist is a third
      //   kind: geometry with no paint and no explanation, which is what the
      //   arena's walls were for months.
      if (entry.fill === "none") {
        const isStroke = entry.stroke !== null && entry.strokeWidth >= 0 && entry.fillRule === null;
        assert.ok(isStroke || (entry.approximated !== null && entry.approximated !== undefined),
          `shape ${key} has an unpainted path that is neither a stroke nor a declared approximation`);
      }
    }
  }
});

test("the manifest's tallies are a recount of the data, not a copy of it", { skip }, () => {
  const buffer = oracleBuffer();
  const extraction = extractScreens(buffer);
  const manifest = buildManifest(extraction, { source: "oracle.swf", sha256: "x" });
  let paths = 0;
  const byPath = {};
  for (const shape of Object.values(extraction.shapes)) {
    for (const entry of shape.paths) {
      paths += 1;
      if (entry.approximated) byPath[entry.approximated] = (byPath[entry.approximated] ?? 0) + 1;
    }
  }
  assert.equal(manifest.totals.shapePaths, paths);
  assert.deepEqual(manifest.approximationsByPath, byPath);
  assert.ok(paths > 0, "a zero path count would make every assertion above vacuous");
  const byUse = {};
  for (const screen of Object.values(extraction.screens)) {
    for (const [kind, count] of Object.entries(screen.approximations)) {
      byUse[kind] = (byUse[kind] ?? 0) + count;
    }
  }
  assert.deepEqual(manifest.approximationsByUse, byUse);
});

test("the rain draws nothing on the arena screen, and the data says which frame carries it", { skip }, () => {
  const { screens } = extractScreens(oracleBuffer());
  const arena = screens.arena;
  const rain = arena.objects.find((object) => object.instanceName === "rain");
  assert.ok(rain, "root frame 221 places a clip named rain");
  assert.equal(rain.character, 1816);
  assert.equal(rain.drawables, 0);
  const silent = arena.objectsDrawingNothing.find((object) => object.character === 1816);
  assert.ok(silent, "the rain must appear in objectsDrawingNothing rather than vanishing");
  // ► `extract-props.mjs` records that frames 1-9 of the weather place nothing
  //   and 10-17 carry it, so a `framesWanted: 1` read emits an empty prop. This
  //   is the same empty, named rather than assumed.
  assert.match(silent.because, /frame 1 of this 17-frame clip places nothing/);
  assert.equal(arena.counts.objectsDrawingNothingUnexplained, 0);
});

test("the screens carry their own words, decoded through the fonts' code tables", { skip }, () => {
  const { screens, fonts } = extractScreens(oracleBuffer());
  assert.ok(Object.keys(fonts).length > 0, "the build sets its static text in real fonts");
  const wordsOf = (name) => screens[name].staticText.map((entry) => entry.text).filter(Boolean).join(" | ");
  // ► The town square's five buildings, straight off the glyph indices. Without
  //   the code table these are "9 glyphs", "11 glyphs", "15 glyphs" and the
  //   pack cannot say what a single button on the screen does.
  assert.equal(wordsOf("townsquare"), "Armoury | Weaponsmith | Enter the Arena | Magic Shop | Church");
  assert.equal(wordsOf("splash").startsWith("play | how to | quit game"), true);
  let glyphs = 0;
  let undecoded = 0;
  for (const screen of Object.values(screens)) {
    glyphs += screen.approximations.staticTextGlyphs;
    undecoded += screen.approximations.staticTextGlyphsUndecoded;
  }
  assert.ok(glyphs > 1000, `the screens carry ${glyphs} static glyphs`);
  // The words are known; the LETTERFORMS are not extracted, and `staticTextGlyphs`
  // is the honest size of that remaining gap.
  assert.equal(undecoded, 0);
});

test("the 26 screens ask for 276 filters, and every one of them is now written out", { skip }, () => {
  const buffer = oracleBuffer();
  const extraction = extractScreens(buffer);
  const { screens } = extraction;

  // ► **243 PLACEMENTS AND 271 FILTERS ARE NOT THE SAME NUMBER**, which is the
  //   whole reason `filterRecords` exists beside `filters`. Counted per USE, so
  //   the chrome's own glow is counted on each of the 26 screens that inherit
  //   it — that is the number a renderer is asked for, not the number of
  //   distinct tags in the file.
  let placements = 0;
  let records = 0;
  let carried = 0;
  let buttonRecords = 0;
  let buttonFilters = 0;
  for (const screen of Object.values(screens)) {
    placements += screen.filteredPlacements.length;
    for (const entry of screen.filteredPlacements) {
      // ► THE ASSERTION THAT WOULD HAVE FAILED BEFORE THIS CHANGE: every
      //   filtered placement carries its typed records. The pack used to carry
      //   `{character, path}` and nothing else, so `filtersUnread` was the only
      //   honest reading available and there was none of it either.
      assert.equal(Array.isArray(entry.filters), true,
        `${screen.name} ${entry.path.join("/")} must carry its filter list, not just its path`);
      records += entry.filters.length;
      if (entry.filters.length > 0) carried += 1;
      for (const filter of entry.filters) {
        assert.equal(typeof filter.type, "string", "every record names its own kind");
      }
    }
    buttonRecords += screen.filteredButtonRecords.length;
    for (const entry of screen.filteredButtonRecords) buttonFilters += entry.filters.length;
  }
  assert.equal(placements, 243, "243 placements across the 26 screens carry a FILTERLIST");
  assert.equal(records, 271, "and 271 filters sit on them — 28 more than the placement count");
  assert.equal(carried, 242, "one of the 243 declares a list and carries nothing");
  assert.equal(buttonRecords, 5, "five UP button records carry one too, which no roster reached before");
  assert.equal(buttonFilters, 5);

  const manifest = buildManifest(extraction, { source: "oracle", sha256: "unused" });
  assert.equal(manifest.approximationsByUse.filters, 243);
  assert.equal(manifest.approximationsByUse.filterRecords, 271);
  assert.equal(manifest.approximationsByUse.filterListEmpty, 1);
  assert.equal(manifest.approximationsByUse.filterListUnread, 0,
    "no placement claims a filter list it does not carry; `hasFilters` and `filters` come off one flag");
  assert.equal(manifest.approximationsByUse.filtersInButtonRecords, 5);
  // ► **WHAT THE BUILD ACTUALLY ASKS FOR**, which decides what a renderer has
  //   to be able to express: `src/render/filters.js` emits CSS for the glows,
  //   blurs and shadows, defers all 57 colour matrices to `applyColourMatrix`,
  //   and refuses both bevels BY NAME. Nothing here is a kind it has never met.
  assert.deepEqual(manifest.filtersByType,
    { dropShadow: 16, glow: 145, bevel: 2, blur: 56, colourMatrix: 57 });
  assert.equal(
    Object.values(manifest.filtersByType).reduce((sum, count) => sum + count, 0),
    records + buttonFilters,
    "the type table and the two rosters are counted from the same records and cannot drift"
  );
});

test("the five filtered button records on this build sit over TEXT and reach no drawable", { skip }, () => {
  // ► **THE ROSTER'S ONLY LIVE CASE, AND IT IS THE ONE THE SYNTHETIC FIXTURE
  //   INVERTS.** The header used to claim a reader matching the roster's paths
  //   by prefix "reaches the same operations with no second convention". The
  //   path convention half is true; the operations half is not, on this build:
  //   every filtered UP record in the file places a `DefineText`, so a prefix
  //   match against `drawables` finds zero and an EXACT match against
  //   `staticText` finds one per entry. The five are the town square's menu
  //   glows. Nothing in `src/` reads `filteredButtonRecords` yet — that is a
  //   gap, not a defect in this file — but it will read it knowing which table
  //   the path leads to.
  const buffer = oracleBuffer();
  const { screens } = extractScreens(buffer);

  const rostered = [];
  for (const screen of Object.values(screens)) {
    for (const entry of screen.filteredButtonRecords) rostered.push({ screen, entry });
  }
  assert.equal(rostered.length, 5, "five, all on the town square");
  assert.deepEqual([...new Set(rostered.map(({ screen }) => screen.name))], ["townsquare"]);

  const words = [];
  for (const { screen, entry } of rostered) {
    const covered = screen.drawables.filter((drawable) => startsWith(drawable.path, entry.path));
    assert.equal(covered.length, 0,
      `${entry.path.join("/")} must reach no drawable: this build's filtered UP records place text`);
    const text = screen.staticText.filter((item) => item.path.join("/") === entry.path.join("/"));
    assert.equal(text.length, 1, `${entry.path.join("/")} must be EXACTLY one static text entry`);
    assert.equal(entry.leaf, "text");
    assert.deepEqual(entry.filters.map((filter) => filter.type), ["glow"]);
    words.push(text[0].text);
  }
  // ► The words themselves, because "5 records over text" and "the five
  //   buildings the player clicks" are not obviously the same claim, and the
  //   second is the one that says what is lost by not applying them.
  assert.deepEqual(words, ["Armoury", "Weaponsmith", "Enter the Arena", "Magic Shop", "Church"]);

  // ► **AND IT IS NOT A PROPERTY OF THE FIVE THE SCREENS REACH.** Counted
  //   straight off the button table: all 13 filtered UP records in the whole
  //   file place a text character, so no screen this tool could ever extract
  //   would put one of these over an operation. A count that CAN vary — the
  //   file holds 158 buttons and 704 records, 104 of whose UP records place a
  //   shape and 49 a sprite; it is only the FILTERED ones that are all text.
  const { characters } = indexCharacters(buffer);
  const kinds = {};
  let filteredUp = 0;
  for (const character of characters.values()) {
    if (character.kind !== "button") continue;
    for (const record of parseButtonRecords(buffer, character)) {
      if ((record.states & 0x01) === 0 || !record.hasFilters) continue;
      filteredUp += 1;
      const kind = characters.get(record.characterId)?.kind ?? "missing";
      kinds[kind] = (kinds[kind] ?? 0) + 1;
    }
  }
  assert.equal(filteredUp, 13);
  assert.deepEqual(kinds, { text: 13 });

  const manifest = buildManifest(extractScreens(buffer), { source: "oracle", sha256: "unused" });
  assert.equal(manifest.approximationsByUse.buttonRecordsFiltered, 5, "RECORDS");
  assert.equal(manifest.approximationsByUse.filtersInButtonRecords, 5, "FILTERS — equal here by coincidence");
  assert.equal(manifest.approximationsByUse.buttonRecordsFilteredOverText, 5);
  assert.equal(manifest.approximationsByUse.filterListEmptyInButtonRecords, 0,
    "no button record on this build declares a list carrying nothing");
  assert.equal(manifest.approximationsByUse.filterListUnreadInButtonRecords, 0);
});

test("no filtered placement hides inside a button's sprite, and a WALK says so", { skip }, () => {
  // ► **0 THAT A WALK PRODUCED, NOT 0 THAT NO WALK PRODUCED.** Until
  //   2026-09-14 `nestedSprites` never entered a button, so a filtered
  //   `PlaceObject3` inside a sprite an UP record places was in neither roster
  //   and in no tally, and the resulting silence read as "no filters there".
  //   This pins the number AND the fact that something looked.
  const buffer = oracleBuffer();
  const { screens } = extractScreens(buffer);
  let subtrees = 0;
  let unreadable = 0;
  for (const screen of Object.values(screens)) {
    subtrees += screen.approximations.filtersInButtonSubtrees;
    unreadable += screen.approximations.buttonSubtreesUnreadable;
  }
  assert.equal(subtrees, 0);
  // ► **AN HONEST INVOICE LINE, NOT A CHECK.** `buttonSubtreesUnreadable` can
  //   only move if `resolveTimeline` throws on a sprite `indexCharacters`
  //   already indexed, and nothing in this build or any fixture here can make
  //   that happen — the same standing as `filterListUnread`. It is asserted so
  //   that the day it does move, this line names the catch instead of the
  //   subtree count quietly dropping. Do not read it as coverage.
  assert.equal(unreadable, 0, "and no subtree was skipped because its timeline would not resolve");

  // The walk is not vacuous: the build really does put sprites under UP
  // records, and this is how many. A number that could have been 0 — and if it
  // ever is, the assertion above stops meaning anything and this one says why.
  const { characters } = indexCharacters(buffer);
  let spritesUnderUp = 0;
  for (const character of characters.values()) {
    if (character.kind !== "button") continue;
    for (const record of parseButtonRecords(buffer, character)) {
      if ((record.states & 0x01) === 0) continue;
      if (characters.get(record.characterId)?.kind === "sprite") spritesUnderUp += 1;
    }
  }
  assert.equal(spritesUnderUp, 49, "49 UP records across the file place a sprite for the walk to search");
});

test("the summary line says which unit every filter number is in", { skip }, () => {
  // ► **THE LINE A HUMAN READS, AND IT USED TO MIX UNITS.** It printed
  //   "(on 243 placements + 5 in button records)": the left number counts
  //   PLACEMENTS, the right counts FILTERS, and on this build the button roster
  //   holds 5 records carrying 5 filters — so the two readings coincided and
  //   nothing, test or reader, could tell them apart. The build cannot
  //   distinguish them, so a fixture must; both are asserted here.
  const extraction = extractScreens(oracleBuffer());
  const manifest = buildManifest(extraction, { source: "oracle", sha256: "unused" });
  const line = summaryLines(extraction, manifest, { out: "/tmp/x" })
    .find((text) => text.includes("filters in all"));
  assert.equal(
    line,
    "  276 filters in all: 271 on 243 filtered placements, 5 on 5 filtered button records " +
    "(5 of those over TEXT, reaching no drawable)"
  );

  // ► And the same line over a manifest where the two DIVERGE, which is the
  //   only way to prove the words track the numbers rather than sitting beside
  //   them. Nothing on the oracle can make records and filters differ in the
  //   button roster, so the input that can is invented here and said to be.
  const invented = summaryLines(
    { screens: {}, totals: { screens: 0, distinctCharacters: 0, shapes: 0, failures: 0 }, failures: [] },
    {
      totals: { shapePaths: 0 },
      approximationsByPath: {}, unresolvedByKind: {},
      filtersByType: { glow: 9 },
      approximationsByUse: {
        filters: 4, filterRecords: 7,
        filtersInButtonRecords: 2, buttonRecordsFiltered: 1, buttonRecordsFilteredOverText: 0
      }
    },
    { out: "/tmp/x" }
  ).find((text) => text.includes("filters in all"));
  assert.equal(
    invented,
    "  9 filters in all: 7 on 4 filtered placements, 2 on 1 filtered button records " +
    "(0 of those over TEXT, reaching no drawable)"
  );
});

test("THE SEAM, ON THE ORACLE: 214 of the build's screen filters become CSS", { skip }, () => {
  // ► **THE NUMBER THAT MADE THIS TRACK WORTH RUNNING.** Before this change no
  //   filter in the pack could be applied at all, because the pack carried none
  //   of their parameters; `src/render/screen.js` counted 9,423 of the 13,638
  //   operations as sitting under a FILTERLIST nothing applies. These records
  //   go straight into the reader with no second spelling.
  const { screens } = extractScreens(oracleBuffer());
  const results = [];
  for (const screen of Object.values(screens)) {
    for (const entry of screen.filteredPlacements) results.push(canvasFilterFor(entry.filters));
    for (const entry of screen.filteredButtonRecords) results.push(canvasFilterFor(entry.filters));
  }
  const summary = summariseFilterUse(results);
  assert.equal(summary.total, 276);
  assert.equal(summary.applied, 214, "glows, blurs and drop shadows, as a ctx.filter string");
  assert.equal(summary.deferred, 57, "every colour matrix, to applyColourMatrix per fill");
  assert.equal(summary.noOp, 3, "measured to draw nothing: Blur(0,0) and strength 0");
  assert.equal(summary.refused, 2, "both bevels, refused BY NAME and not nearest-matched");
  assert.deepEqual(summary.refusedByReason, { "bevel:filterHasNoCanvasEquivalent": 2 });
  assert.equal(
    summary.applied + summary.deferred + summary.noOp + summary.refused, summary.total,
    "nothing falls between the four buckets, which is the only way a drop stays visible"
  );
  // ► And 213 of the 248 rostered sites really do produce a string — 208 of the
  //   243 placements plus all 5 button records. A count that CAN vary: it was 0
  //   before this change, because there was nothing in the pack to parse.
  assert.equal(results.filter((result) => result.filter !== null).length, 213);
  assert.equal(results.length, 248, "243 placements and 5 button records");
});

test("two of the 26 frame ranges are not still, and the church removes itself at the end", { skip }, () => {
  const { screens } = extractScreens(oracleBuffer());
  const moving = Object.values(screens)
    .filter((screen) => screen.rangeVariance.frames > 0)
    .map((screen) => screen.name)
    .sort();
  // ► Taking one frame per screen is an approximation exactly twice, and a tool
  //   that assumed stillness would have been silently wrong on both.
  assert.deepEqual(moving, ["church", "splash"]);
  assert.deepEqual(screens.church.rangeVariance.depthsRemoved, [59]);
  assert.equal(screens.church.rangeVariance.firstDifferingFrame, 202);
  assert.deepEqual(screens.splash.rangeVariance.depthsAdded, []);
  assert.deepEqual(screens.splash.rangeVariance.depthsRemoved, []);
  assert.equal(screens.splash.rangeVariance.firstDifferingFrame, 11);
});
