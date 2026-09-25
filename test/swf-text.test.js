/**
 * Properties of the text parser — both halves of the "text" bucket.
 *
 * `indexCharacters` files tags 11, 33 and 37 under one `kind: "text"`, and the
 * 436 it reports for this build is **256 DefineEditText + 180 DefineText + 0
 * DefineText2**. The two halves share no machinery, so they are tested apart
 * and then reconciled against that single bucket total.
 *
 * As in `test/swf-fonts.test.js`: hand-built buffers pin the FORMAT (including
 * the `DefineText2` branch the shipped build never exercises, so it is not
 * merely assumed to work), and oracle-gated tests pin the CENSUS from numbers
 * this file re-derived rather than inherited.
 *
 * ► **The strongest assertion in this file is the round trip.** Resolving all
 *   4061 glyph entries through the embedded fonts' code tables yields readable
 *   English. Nothing else would: a wrong offset table, a wrong glyph-bit width,
 *   a dropped font inheritance or an off-by-one code table all produce a string
 *   that parses cleanly and reads as noise. Counts alone cannot catch any of
 *   them, which is exactly how the arena walls stayed invisible for months.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { indexFonts } from "../tools/swf-fonts.mjs";
import {
  TEXT_TAG,
  TextParseError,
  indexText,
  parseEditText,
  parseText,
  textToString
} from "../tools/swf-text.mjs";

// ---------------------------------------------------------------------------
// A bit writer, so the format tests state records rather than hexdumps.
// ---------------------------------------------------------------------------

class BitWriter {
  constructor() {
    this.bytes = [];
    this.current = 0;
    this.bit = 0;
  }

  writeBit(value) {
    if (value) this.current |= 1 << (7 - this.bit);
    this.bit += 1;
    if (this.bit === 8) {
      this.bytes.push(this.current);
      this.current = 0;
      this.bit = 0;
    }
  }

  writeUB(bits, value) {
    for (let index = bits - 1; index >= 0; index -= 1) this.writeBit((value >>> index) & 1);
  }

  writeSB(bits, value) {
    this.writeUB(bits, value < 0 ? value + 2 ** bits : value);
  }

  align() {
    while (this.bit !== 0) this.writeBit(0);
  }

  writeUI8(value) {
    this.align();
    this.bytes.push(value & 0xff);
  }

  writeUI16(value) {
    this.writeUI8(value & 0xff);
    this.bytes.push((value >>> 8) & 0xff);
  }

  writeSI16(value) {
    this.writeUI16(value < 0 ? value + 0x10000 : value);
  }

  writeString(value) {
    this.align();
    for (const byte of Buffer.from(value, "utf8")) this.bytes.push(byte);
    this.bytes.push(0);
  }

  writeRect(rect) {
    this.align();
    this.writeUB(5, 16);
    this.writeSB(16, rect.xMin);
    this.writeSB(16, rect.xMax);
    this.writeSB(16, rect.yMin);
    this.writeSB(16, rect.yMax);
    this.align();
  }

  /** An identity MATRIX with a translation, which is the shape the build uses. */
  writeMatrix(tx, ty) {
    this.align();
    this.writeBit(0); // no scale
    this.writeBit(0); // no rotate/skew
    this.writeUB(5, 16);
    this.writeSB(16, tx);
    this.writeSB(16, ty);
    this.align();
  }

  toBuffer() {
    this.align();
    return Buffer.from(this.bytes);
  }
}

/** A DefineText / DefineText2 tag BODY, exactly as walkTags would yield one. */
function encodeText({ id, tagCode, glyphBits = 8, advanceBits = 12, records }) {
  const writer = new BitWriter();
  writer.writeUI16(id);
  writer.writeRect({ xMin: 0, xMax: 2000, yMin: 0, yMax: 400 });
  writer.writeMatrix(20, 40);
  writer.writeUI8(glyphBits);
  writer.writeUI8(advanceBits);
  for (const record of records) {
    writer.writeBit(1);
    writer.writeUB(3, 0);
    writer.writeBit(record.font === undefined ? 0 : 1);
    writer.writeBit(record.colour === undefined ? 0 : 1);
    writer.writeBit(record.yOffset === undefined ? 0 : 1);
    writer.writeBit(record.xOffset === undefined ? 0 : 1);
    if (record.font !== undefined) writer.writeUI16(record.font);
    if (record.colour !== undefined) {
      writer.writeUI8(record.colour.red);
      writer.writeUI8(record.colour.green);
      writer.writeUI8(record.colour.blue);
      if (tagCode === TEXT_TAG.DEFINE_TEXT2) writer.writeUI8(record.colour.alpha);
    }
    // X before Y on the wire, whichever order the flags were read in.
    if (record.xOffset !== undefined) writer.writeSI16(record.xOffset);
    if (record.yOffset !== undefined) writer.writeSI16(record.yOffset);
    if (record.font !== undefined) writer.writeUI16(record.textHeight);
    writer.writeUI8(record.glyphs.length);
    for (const glyph of record.glyphs) {
      writer.writeUB(glyphBits, glyph.index);
      writer.writeSB(advanceBits, glyph.advance);
    }
    writer.align();
  }
  writer.writeUI8(0); // the end-of-records byte
  return writer.toBuffer();
}

/** A DefineEditText tag BODY. */
function encodeEditText(field) {
  const writer = new BitWriter();
  writer.writeUI16(field.id);
  writer.writeRect(field.bounds ?? { xMin: 0, xMax: 1000, yMin: 0, yMax: 300 });
  const flags = field.flags;
  writer.writeUI8(
    (flags.hasText ? 0x80 : 0) | (flags.wordWrap ? 0x40 : 0) | (flags.multiline ? 0x20 : 0) |
    (flags.password ? 0x10 : 0) | (flags.readOnly ? 0x08 : 0) | (flags.hasTextColour ? 0x04 : 0) |
    (flags.hasMaxLength ? 0x02 : 0) | (flags.hasFont ? 0x01 : 0)
  );
  writer.writeUI8(
    (flags.hasFontClass ? 0x80 : 0) | (flags.autoSize ? 0x40 : 0) | (flags.hasLayout ? 0x20 : 0) |
    (flags.noSelect ? 0x10 : 0) | (flags.border ? 0x08 : 0) | (flags.wasStatic ? 0x04 : 0) |
    (flags.html ? 0x02 : 0) | (flags.useOutlines ? 0x01 : 0)
  );
  if (flags.hasFont) writer.writeUI16(field.font);
  if (flags.hasFontClass) writer.writeString(field.fontClass);
  if (flags.hasFont || flags.hasFontClass) writer.writeUI16(field.fontHeight);
  if (flags.hasTextColour) {
    writer.writeUI8(field.colour.red);
    writer.writeUI8(field.colour.green);
    writer.writeUI8(field.colour.blue);
    writer.writeUI8(field.colour.alpha);
  }
  if (flags.hasMaxLength) writer.writeUI16(field.maxLength);
  if (flags.hasLayout) {
    writer.writeUI8(field.layout.align);
    writer.writeUI16(field.layout.leftMargin);
    writer.writeUI16(field.layout.rightMargin);
    writer.writeUI16(field.layout.indent);
    writer.writeSI16(field.layout.leading);
  }
  writer.writeString(field.variableName);
  if (flags.hasText) writer.writeString(field.initialText);
  return writer.toBuffer();
}

// ---------------------------------------------------------------------------
// DefineText — the baked glyph-index run.
// ---------------------------------------------------------------------------

test("a static text yields glyph indices with their baked advances", () => {
  const body = encodeText({
    id: 700, tagCode: TEXT_TAG.DEFINE_TEXT,
    records: [{
      font: 53, textHeight: 240, colour: { red: 255, green: 0, blue: 0 },
      xOffset: 12, yOffset: -34,
      glyphs: [{ index: 4, advance: 120 }, { index: 9, advance: -60 }]
    }]
  });
  const text = parseText(body, 0, body.length, TEXT_TAG.DEFINE_TEXT);
  assert.equal(text.id, 700);
  assert.equal(text.kind, "static");
  assert.equal(text.records.length, 1);
  assert.equal(text.records[0].font, 53);
  assert.equal(text.records[0].textHeight, 240);
  assert.equal(text.records[0].xOffset, 12);
  // A NEGATIVE y offset, which is why the field is read signed.
  assert.equal(text.records[0].yOffset, -34);
  assert.deepEqual(text.records[0].colour, { red: 255, green: 0, blue: 0, alpha: 255 });
  assert.deepEqual(text.records[0].glyphs, [{ index: 4, advance: 120 }, { index: 9, advance: -60 }]);
  assert.equal(text.glyphEntries, 2);
  assert.equal(text.slackBytes, 0);
});

test("a record without a font INHERITS the previous one and is marked inherited", () => {
  // ► 26 of the build's 206 text records do this. A reader that treats a
  //   missing font as "no font" silently loses the glyph table for those runs
  //   and resolves them to an empty string rather than to an error.
  const body = encodeText({
    id: 701, tagCode: TEXT_TAG.DEFINE_TEXT,
    records: [
      { font: 118, textHeight: 200, glyphs: [{ index: 1, advance: 10 }] },
      { xOffset: 400, glyphs: [{ index: 2, advance: 20 }] }
    ]
  });
  const text = parseText(body, 0, body.length, TEXT_TAG.DEFINE_TEXT);
  assert.equal(text.records[0].fontInherited, false);
  assert.equal(text.records[1].font, 118, "the second record must carry the inherited font id");
  assert.equal(text.records[1].fontInherited, true);
  assert.equal(text.records[1].textHeight, 200, "height is inherited with the font");
  assert.equal(text.records[1].xOffset, 400);
  assert.equal(text.glyphEntries, 2);
  assert.equal(text.slackBytes, 0);
});

test("a record with every optional flag off is read, not mistaken for the terminator", () => {
  // The end of the record list is a whole ZERO BYTE. A record's own first byte
  // always has bit 7 set, so peeking a byte is safe — but reading bits first
  // and testing them is not, and this is the case that would expose it.
  const body = encodeText({
    id: 702, tagCode: TEXT_TAG.DEFINE_TEXT,
    records: [{ glyphs: [{ index: 3, advance: 7 }] }]
  });
  const text = parseText(body, 0, body.length, TEXT_TAG.DEFINE_TEXT);
  assert.equal(text.records.length, 1);
  assert.equal(text.records[0].font, null);
  assert.equal(text.records[0].fontInherited, false);
  assert.deepEqual(text.records[0].glyphs, [{ index: 3, advance: 7 }]);
  assert.equal(text.slackBytes, 0);
});

test("DefineText2 reads an RGBA colour where DefineText reads RGB", () => {
  // ► The shipped build holds ZERO DefineText2 tags, so this branch is
  //   exercised here and nowhere else. Saying that out loud is the point:
  //   untested code that looks tested is this project's house defect.
  const body = encodeText({
    id: 703, tagCode: TEXT_TAG.DEFINE_TEXT2,
    records: [{
      font: 53, textHeight: 200,
      colour: { red: 1, green: 2, blue: 3, alpha: 128 },
      glyphs: [{ index: 0, advance: 1 }]
    }]
  });
  const text = parseText(body, 0, body.length, TEXT_TAG.DEFINE_TEXT2);
  assert.deepEqual(text.records[0].colour, { red: 1, green: 2, blue: 3, alpha: 128 });
  assert.equal(text.tagCode, TEXT_TAG.DEFINE_TEXT2);
  assert.equal(text.slackBytes, 0);
});

test("wide glyph bits are honoured, so a font past 255 glyphs does not wrap", () => {
  const body = encodeText({
    id: 704, tagCode: TEXT_TAG.DEFINE_TEXT, glyphBits: 11, advanceBits: 16,
    records: [{ font: 53, textHeight: 200, glyphs: [{ index: 1500, advance: -20000 }] }]
  });
  const text = parseText(body, 0, body.length, TEXT_TAG.DEFINE_TEXT);
  assert.equal(text.glyphBits, 11);
  assert.deepEqual(text.records[0].glyphs, [{ index: 1500, advance: -20000 }]);
});

test("parseText refuses a DefineEditText tag rather than reading it as glyph runs", () => {
  const body = encodeText({ id: 705, tagCode: TEXT_TAG.DEFINE_TEXT, records: [] });
  assert.throws(() => parseText(body, 0, body.length, TEXT_TAG.DEFINE_EDIT_TEXT), TextParseError);
});

// ---------------------------------------------------------------------------
// DefineEditText — the runtime-filled box.
// ---------------------------------------------------------------------------

test("an edit text yields its flags, font, colour, layout and variable binding", () => {
  const body = encodeEditText({
    id: 800,
    flags: {
      hasText: true, wordWrap: true, multiline: true, readOnly: true,
      hasTextColour: true, hasMaxLength: true, hasFont: true,
      hasLayout: true, border: true, useOutlines: true
    },
    font: 118, fontHeight: 680,
    colour: { red: 255, green: 255, blue: 255, alpha: 255 },
    maxLength: 32,
    layout: { align: 2, leftMargin: 10, rightMargin: 20, indent: 5, leading: -40 },
    variableName: "bonus", initialText: "0"
  });
  const field = parseEditText(body, 0, body.length);
  assert.equal(field.id, 800);
  assert.equal(field.kind, "field");
  assert.equal(field.font, 118);
  assert.equal(field.fontHeight, 680);
  assert.equal(field.maxLength, 32);
  assert.equal(field.variableName, "bonus");
  assert.equal(field.initialText, "0");
  assert.equal(field.layout.align, "center");
  // Leading is SIGNED. Read unsigned, -40 becomes 65496 twips of line spacing.
  assert.equal(field.layout.leading, -40);
  assert.equal(field.flags.useOutlines, true);
  assert.equal(field.flags.multiline, true);
  assert.equal(field.flags.border, true);
  assert.equal(field.flags.html, false);
  assert.deepEqual(field.colour, { red: 255, green: 255, blue: 255, alpha: 255 });
  assert.equal(field.slackBytes, 0);
});

test("an unbound field keeps its empty variable name rather than folding it to null", () => {
  // 76 of the build's 256 fields are unbound. "" and null must stay distinct:
  // one means "not bound to a variable", the other would mean "not read".
  const body = encodeEditText({
    id: 801,
    flags: { hasFont: true, useOutlines: true },
    font: 53, fontHeight: 240,
    variableName: ""
  });
  const field = parseEditText(body, 0, body.length);
  assert.equal(field.variableName, "");
  assert.notEqual(field.variableName, null);
  assert.equal(field.initialText, null, "no HasText means no initial string at all");
  assert.equal(field.layout, null);
  assert.equal(field.colour, null);
  assert.equal(field.maxLength, null);
  assert.equal(field.slackBytes, 0);
});

test("a field setting both HasFont and HasFontClass is refused by name", () => {
  // The two are mutually exclusive in the format but are independent bits on
  // the wire, and FontHeight follows whichever appeared. Guessing desynchronises
  // the rest of the tag, which then parses cleanly into nonsense.
  const body = encodeEditText({
    id: 802,
    flags: { hasFont: true, hasFontClass: true, useOutlines: true },
    font: 53, fontClass: "Arial", fontHeight: 240, variableName: "x"
  });
  assert.throws(() => parseEditText(body, 0, body.length), TextParseError);
});

test("a field using a font CLASS rather than an id still yields its height", () => {
  // Zero of the build's 256 fields do this, so this branch is exercised here
  // and nowhere else.
  const body = encodeEditText({
    id: 803,
    flags: { hasFontClass: true, useOutlines: true },
    fontClass: "MyFont", fontHeight: 400, variableName: "y"
  });
  const field = parseEditText(body, 0, body.length);
  assert.equal(field.font, null);
  assert.equal(field.fontClass, "MyFont");
  assert.equal(field.fontHeight, 400);
  assert.equal(field.slackBytes, 0);
});

// ---------------------------------------------------------------------------
// Resolving glyph runs to characters.
// ---------------------------------------------------------------------------

test("an unresolvable glyph index becomes U+FFFD and is COUNTED, never dropped", () => {
  // ► A silently shortened string is indistinguishable from a correct one.
  const body = encodeText({
    id: 706, tagCode: TEXT_TAG.DEFINE_TEXT,
    records: [{ font: 999, textHeight: 200, glyphs: [{ index: 0, advance: 1 }, { index: 1, advance: 1 }] }]
  });
  const text = parseText(body, 0, body.length, TEXT_TAG.DEFINE_TEXT);
  const read = textToString(text, new Map());
  assert.equal(read.text, "��");
  assert.equal(read.unresolved, 2);
  assert.equal(read.resolved, 0);
  assert.deepEqual(read.missingFonts, [999]);
  assert.equal(read.text.length, 2, "the string must stay the length of the glyph run");
});

test("a glyph index past the end of a present font is counted too", () => {
  const body = encodeText({
    id: 707, tagCode: TEXT_TAG.DEFINE_TEXT,
    records: [{ font: 1, textHeight: 200, glyphs: [{ index: 0, advance: 1 }, { index: 77, advance: 1 }] }]
  });
  const text = parseText(body, 0, body.length, TEXT_TAG.DEFINE_TEXT);
  const fonts = new Map([[1, { glyphs: [{ index: 0, code: 0x41, char: "A" }] }]]);
  const read = textToString(text, fonts);
  assert.equal(read.text, "A�");
  assert.equal(read.resolved, 1);
  assert.equal(read.unresolved, 1);
  // The font was present, so it is not a MISSING font — a different diagnosis.
  assert.deepEqual(read.missingFonts, []);
});

// ---------------------------------------------------------------------------
// The census, against the installed build. Every number re-derived here.
// ---------------------------------------------------------------------------

const ORACLE =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";
const haveOracle = fs.existsSync(ORACLE);
const oracleSkip = haveOracle ? false : "no installed build on this machine";

test("the 436-character text bucket splits 256 fields / 180 statics / 0 DefineText2",
  { skip: oracleSkip }, () => {
    // ► The bucket is the trap: 436 is a SUM across two formats that share no
    //   machinery, not a tag count. Pinning the split is what keeps it honest.
    const { totals, failures } = indexText(fs.readFileSync(ORACLE));
    assert.equal(totals.fields, 256);
    assert.equal(totals.statics, 180);
    assert.equal(totals.bucket, 436);
    assert.deepEqual(failures, [], "a text character that failed to parse is a real finding");
    assert.equal(totals.failures, 0);
  });

test("EVERY text tag is read to its last byte — zero slack across all 436",
  { skip: oracleSkip }, () => {
    // Slack means the parser stopped early and the rest went unread, which is
    // how a truncated read passes for a complete one.
    const { statics, fields } = indexText(fs.readFileSync(ORACLE));
    for (const text of statics.values()) {
      assert.equal(text.slackBytes, 0, `DefineText ${text.id} left ${text.slackBytes} bytes unread`);
    }
    for (const field of fields.values()) {
      assert.equal(field.slackBytes, 0, `DefineEditText ${field.id} left ${field.slackBytes} bytes unread`);
    }
  });

test("the static texts hold 206 records and 4061 glyph entries, 26 records inheriting a font",
  { skip: oracleSkip }, () => {
    const { statics, totals } = indexText(fs.readFileSync(ORACLE));
    assert.equal(totals.records, 206);
    assert.equal(totals.glyphEntries, 4061);
    let inherited = 0;
    let fontless = 0;
    for (const text of statics.values()) {
      for (const record of text.records) {
        if (record.fontInherited) inherited += 1;
        if (record.font === null) fontless += 1;
      }
    }
    assert.equal(inherited, 26);
    // Not one record in the build opens without a font, so every glyph run is
    // resolvable. A non-zero here would be runs nothing can letter.
    assert.equal(fontless, 0);
  });

test("ALL 4061 glyph entries resolve to a character — zero unresolved",
  { skip: oracleSkip }, () => {
    // ► THE ROUND TRIP, and the only assertion here that could catch an
    //   off-by-one in the offset table, the code table or the glyph-bit width.
    //   Counts cannot: a wrong table produces exactly as many characters.
    const buffer = fs.readFileSync(ORACLE);
    const { statics } = indexText(buffer);
    const { fonts } = indexFonts(buffer);
    let resolved = 0;
    let unresolved = 0;
    for (const text of statics.values()) {
      const read = textToString(text, fonts);
      resolved += read.resolved;
      unresolved += read.unresolved;
      assert.deepEqual(read.missingFonts, [], `DefineText ${text.id} references a font not in the build`);
    }
    assert.equal(unresolved, 0);
    assert.equal(resolved, 4061);
  });

test("the resolved strings are the build's own English, at the ids measured",
  { skip: oracleSkip }, () => {
    // Structural checks pass on gibberish. These do not. Every string below was
    // read off the oracle by this parser and eyeballed before being pinned.
    const buffer = fs.readFileSync(ORACLE);
    const { statics } = indexText(buffer);
    const { fonts } = indexFonts(buffer);
    const read = (id) => textToString(statics.get(id), fonts).text;
    assert.equal(read(124), "HEALTH");
    assert.equal(read(128), "STAMINA");
    assert.equal(read(132), "ARMOUR");
    assert.equal(read(2290), "Error");
    assert.equal(read(1255), "Level:");
    assert.equal(read(1266), "Hitpoints:");
    assert.equal(read(822), "MISS!");
    // The game's own character-tampering screen, which AGENTS.md warns that
    // skipping the prologue trips. This is its text, in the build.
    assert.match(read(2289), /character tampering/);
    assert.equal(read(764), "And so it was that your days as a gladiator came to an end.");
  });

test("all 256 fields use embedded outlines, so NO font substitution is needed",
  { skip: oracleSkip }, () => {
    const { fields, totals } = indexText(fs.readFileSync(ORACLE));
    assert.equal(totals.useOutlines, 256);
    assert.equal(totals.withFont, 256, "every field names an embedded font id");
    assert.equal(totals.withFontClass, 0, "a font CLASS would be resolved at runtime, not from the build");
    for (const field of fields.values()) {
      assert.equal(field.flags.useOutlines, true, `field ${field.id} would fall back to a device font`);
      assert.ok(field.font !== null && field.fontHeight > 0, `field ${field.id} has no usable font reference`);
    }
  });

test("every font the text half references is one of the nine embedded in the build",
  { skip: oracleSkip }, () => {
    // ► The claim that no substitution is needed, checked from the other side:
    //   the set of ids the text tags ask for, against the set the build defines.
    const buffer = fs.readFileSync(ORACLE);
    const { totals } = indexText(buffer);
    const { fonts } = indexFonts(buffer);
    assert.deepEqual(totals.fontsReferenced, [53, 118, 754, 1510, 1519, 1523, 1526, 2120, 2132]);
    assert.deepEqual(totals.fontsReferenced, [...fonts.keys()].sort((a, b) => a - b),
      "the referenced set and the embedded set must be the same nine ids");
  });

test("the field half's own flag census is the measured one",
  { skip: oracleSkip }, () => {
    const { fields, totals } = indexText(fs.readFileSync(ORACLE));
    assert.equal(totals.html, 5);
    assert.equal(totals.withInitialText, 146);
    const count = (predicate) => [...fields.values()].filter(predicate).length;
    assert.equal(count((field) => field.variableName === ""), 76);
    assert.equal(count((field) => field.flags.readOnly), 243);
    assert.equal(count((field) => field.flags.multiline), 55);
    assert.equal(count((field) => field.flags.border), 12);
    assert.equal(count((field) => field.layout !== null), 256);
    assert.equal(count((field) => field.colour !== null), 256);
    // WasStatic marks a field the authoring tool converted from static text.
    // None here, so every field is a field by intent.
    assert.equal(count((field) => field.flags.wasStatic), 0);
  });

test("a known field carries the binding and metrics measured off the build",
  { skip: oracleSkip }, () => {
    const { fields } = indexText(fs.readFileSync(ORACLE));
    const bonus = fields.get(152);
    assert.equal(bonus.font, 118);
    assert.equal(bonus.fontHeight, 680);
    assert.equal(bonus.variableName, "bonus");
    assert.equal(bonus.initialText, "0");
    assert.equal(bonus.layout.align, "center");
    assert.deepEqual(bonus.colour, { red: 255, green: 255, blue: 255, alpha: 255 });
    // fontHeight is TWIPS and is the em size: 680 twips is 34 pixels.
    assert.equal(bonus.fontHeight / 20, 34);
  });
