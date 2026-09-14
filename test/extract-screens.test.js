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
  stageRect
} from "../tools/extract-screens.mjs";
import { TAG, indexCharacters, resolveTimeline } from "../tools/swf-display-list.mjs";

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
    if (record.filters) writer.u8(1).u8(1).raw(Buffer.alloc(9)); // one Blur filter
    if (record.blendMode !== undefined) writer.u8(record.blendMode);
  }
  writer.u8(0);
  return tag(TAG.DEFINE_BUTTON2, writer);
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
/* Against the installed build                                       */
/* ---------------------------------------------------------------- */

const ORACLE =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";
const haveOracle = fs.existsSync(ORACLE);
const skip = haveOracle ? false : "no installed build on this machine";

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
