/**
 * SWF text characters -> glyph runs and field definitions. Structure only.
 *
 * ## The "436 text characters" is a BUCKET, and its two halves share nothing
 *
 * `indexCharacters` in `tools/swf-display-list.mjs` files tags 11, 33 and 37
 * under one `kind: "text"`. Measured on the oracle, that bucket is:
 *
 * ```text
 *   256  DefineEditText  (tag 37)   a runtime-filled BOX
 *   180  DefineText      (tag 11)   a baked GLYPH-INDEX RUN
 *     0  DefineText2     (tag 33)
 *   ---
 *   436
 * ```
 *
 * ► **Reading that 436 as a tag count, or as one format, is the trap.** The two
 *   halves need completely different machinery. A `DefineText` holds no
 *   characters at all — it holds indices INTO A FONT'S GLYPH TABLE, each with
 *   its own advance baked in at export time, so it renders without consulting
 *   the font's metrics and its content is unreadable until you have the font's
 *   code table. A `DefineEditText` holds no glyphs at all — it is a rectangle,
 *   a font reference, a variable name and an optional initial string, and the
 *   player fills it at runtime from that variable.
 *
 * `DefineText2` (tag 33) is parsed here — its only difference is an RGBA colour
 * rather than RGB — but the build contains none, so that branch is exercised by
 * this module's tests against a hand-built buffer and by nothing else. Said out
 * loud because untested code that looks tested is this project's house defect.
 *
 * ## No font substitution is needed anywhere in this build, and that is measured
 *
 * All 256 `DefineEditText` set `UseOutlines = 1` and all 256 carry a `HasFont`
 * font id; zero use `HasFontClass`. All 180 `DefineText` draw from the same
 * embedded set. The union of fonts the two halves reference is exactly the nine
 * `DefineFont3` ids in the file — so every glyph the game can draw is in the
 * build and nothing falls back to a device font.
 *
 * ## Units, because three are in play at once
 *
 * - `bounds` and a text record's `xOffset`/`yOffset` are **TWIPS** (20/pixel).
 * - `textHeight` and a field's `fontHeight` are **TWIPS**, and are the em size.
 * - a glyph entry's `advance` is in **TWIPS** too, already scaled to
 *   `textHeight` by the exporter — it is NOT in the 20480-per-em glyph units
 *   that `tools/swf-fonts.mjs` returns outlines in. Scaling an advance by
 *   `textHeight / 20480` a second time is the mistake this line exists to stop.
 *
 * ## THE LICENCE NOTE THAT TRAVELS WITH THIS FILE
 *
 * Resolving a `DefineText` to a readable string requires the embedded fonts'
 * code tables, and those fonts are **commercially licensed** — Bitstream,
 * Monotype, SWFTE International and Joe Gillespie all appear in
 * `DefineFontName`. Reading them to learn what a screen says is measurement.
 * Emitting them as font files is redistribution. Nothing in this module or in
 * `tools/swf-fonts.mjs` writes either one; see that file's header.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TAG, tagStreamStart, walkTags } from "./swf-display-list.mjs";
import { indexFonts } from "./swf-fonts.mjs";

export class TextParseError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

export const TEXT_TAG = Object.freeze({
  DEFINE_TEXT: 11,
  DEFINE_TEXT2: 33,
  DEFINE_EDIT_TEXT: 37
});

/** Alignment, as `DefineEditText`'s layout byte encodes it. */
const ALIGNMENT = Object.freeze(["left", "right", "center", "justify"]);

/** A bit-level cursor. Glyph entries and RECTs are not byte-aligned. */
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
    if (this.byte >= this.end) throw new TextParseError("text record ran past the end of its tag.");
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

  readSB(bits) {
    if (bits === 0) return 0;
    const raw = this.readUB(bits);
    const sign = 1 << (bits - 1);
    return (raw & sign) ? raw - (1 << bits) : raw;
  }

  readUI8() {
    this.align();
    if (this.byte >= this.end) throw new TextParseError("text record ran past the end of its tag.");
    return this.buffer[this.byte++];
  }

  peekUI8() {
    this.align();
    if (this.byte >= this.end) throw new TextParseError("text record ran past the end of its tag.");
    return this.buffer[this.byte];
  }

  readUI16() {
    this.align();
    if (this.byte + 2 > this.end) throw new TextParseError("text record ran past the end of its tag.");
    const value = this.buffer.readUInt16LE(this.byte);
    this.byte += 2;
    return value;
  }

  readSI16() {
    this.align();
    if (this.byte + 2 > this.end) throw new TextParseError("text record ran past the end of its tag.");
    const value = this.buffer.readInt16LE(this.byte);
    this.byte += 2;
    return value;
  }

  readRect() {
    this.align();
    const bits = this.readUB(5);
    const rect = {
      xMin: this.readSB(bits), xMax: this.readSB(bits),
      yMin: this.readSB(bits), yMax: this.readSB(bits)
    };
    this.align();
    return rect;
  }

  /**
   * MATRIX. `a`/`d`/`b`/`c` are 16.16 fixed point; `tx`/`ty` are TWIPS and are
   * left as twips, matching `tools/swf-display-list.mjs` rather than quietly
   * disagreeing with it by a factor of twenty.
   */
  readMatrix() {
    this.align();
    const matrix = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    if (this.readBit()) {
      const bits = this.readUB(5);
      matrix.a = this.readSB(bits) / 65536;
      matrix.d = this.readSB(bits) / 65536;
    }
    if (this.readBit()) {
      const bits = this.readUB(5);
      matrix.b = this.readSB(bits) / 65536;
      matrix.c = this.readSB(bits) / 65536;
    }
    const bits = this.readUB(5);
    matrix.tx = this.readSB(bits);
    matrix.ty = this.readSB(bits);
    this.align();
    return matrix;
  }

  /** NUL-terminated UTF-8. SWF 6+ strings are UTF-8; this build is version 8. */
  readString() {
    this.align();
    const from = this.byte;
    while (this.byte < this.end && this.buffer[this.byte] !== 0) this.byte += 1;
    const value = this.buffer.toString("utf8", from, this.byte);
    this.byte += 1;
    return value;
  }
}

/**
 * A `DefineText` (11) or `DefineText2` (33): static text as glyph-index runs.
 *
 * `start`/`end` are the tag BODY, exactly as `walkTags` yields them.
 *
 * ► **A record with `hasFont = 0` INHERITS the preceding record's font, height
 *   and colour**, and 26 of this build's 206 text records do exactly that. A
 *   reader that treats a missing font as "no font" loses the glyph table for
 *   those runs and cannot resolve a single character in them — which shows up
 *   as an empty string rather than as an error, so it is counted here instead:
 *   `records[].font` carries the INHERITED id and `records[].fontInherited`
 *   says it was not written on the wire.
 */
export function parseText(buffer, start, end, tagCode) {
  if (tagCode !== TEXT_TAG.DEFINE_TEXT && tagCode !== TEXT_TAG.DEFINE_TEXT2) {
    throw new TextParseError(
      `parseText reads DefineText (${TEXT_TAG.DEFINE_TEXT}) and DefineText2 (${TEXT_TAG.DEFINE_TEXT2}); tag ${tagCode} is neither.`
    );
  }
  const withAlpha = tagCode === TEXT_TAG.DEFINE_TEXT2;
  const reader = new BitReader(buffer, start, end);
  const id = reader.readUI16();
  const bounds = reader.readRect();
  const matrix = reader.readMatrix();
  const glyphBits = reader.readUI8();
  const advanceBits = reader.readUI8();

  const records = [];
  let font = null;
  let textHeight = null;
  let colour = null;
  let glyphEntries = 0;

  for (;;) {
    // The record separator is a whole zero BYTE, not a zero bit field: peek it
    // before consuming any bits, or a legitimate record whose flags happen to
    // start with zeros is mistaken for the terminator.
    if (reader.peekUI8() === 0) {
      reader.readUI8();
      break;
    }
    reader.readBit();  // TextRecordType, always 1 here — the peek above proved it.
    reader.readUB(3);  // StyleFlagsReserved.
    const hasFont = reader.readBit() === 1;
    const hasColour = reader.readBit() === 1;
    const hasYOffset = reader.readBit() === 1;
    const hasXOffset = reader.readBit() === 1;

    if (hasFont) font = reader.readUI16();
    if (hasColour) {
      colour = {
        red: reader.readUI8(), green: reader.readUI8(), blue: reader.readUI8(),
        alpha: withAlpha ? reader.readUI8() : 255
      };
    }
    // Offsets are in this order on the wire — X then Y — regardless of the flag
    // order above, which reads Y first. Swapping them shifts every run.
    const xOffset = hasXOffset ? reader.readSI16() : null;
    const yOffset = hasYOffset ? reader.readSI16() : null;
    if (hasFont) textHeight = reader.readUI16();

    const count = reader.readUI8();
    const glyphs = [];
    for (let index = 0; index < count; index += 1) {
      glyphs.push({ index: reader.readUB(glyphBits), advance: reader.readSB(advanceBits) });
    }
    reader.align();

    records.push({
      font, fontInherited: !hasFont && font !== null,
      textHeight, colour,
      xOffset, yOffset,
      glyphs
    });
    glyphEntries += glyphs.length;
  }

  reader.align();
  return {
    id, tagCode, kind: "static",
    bounds, matrix, glyphBits, advanceBits,
    records, glyphEntries,
    // Bytes of the tag body nothing above accounted for. Non-zero is a finding.
    slackBytes: end - reader.byte
  };
}

/**
 * A `DefineEditText` (37): a runtime-filled field.
 *
 * The two flag bytes are the whole format's hinge, so they are spelled out
 * rather than masked inline at four call sites:
 *
 * ```text
 *   byte 1  80 HasText   40 WordWrap  20 Multiline  10 Password
 *           08 ReadOnly  04 HasTextColor  02 HasMaxLength  01 HasFont
 *   byte 2  80 HasFontClass  40 AutoSize  20 HasLayout  10 NoSelect
 *           08 Border    04 WasStatic  02 HTML  01 UseOutlines
 * ```
 *
 * ► `HasFont` and `HasFontClass` are MUTUALLY EXCLUSIVE in the spec but are two
 *   independent bits on the wire, and `FontHeight` follows whichever appeared.
 *   This build sets `HasFont` on all 256 and `HasFontClass` on none; a tag
 *   setting both is refused by name rather than read into a desynchronised
 *   cursor.
 */
export function parseEditText(buffer, start, end) {
  const reader = new BitReader(buffer, start, end);
  const id = reader.readUI16();
  const bounds = reader.readRect();
  const first = reader.readUI8();
  const second = reader.readUI8();

  const flags = {
    hasText: Boolean(first & 0x80),
    wordWrap: Boolean(first & 0x40),
    multiline: Boolean(first & 0x20),
    password: Boolean(first & 0x10),
    readOnly: Boolean(first & 0x08),
    hasTextColour: Boolean(first & 0x04),
    hasMaxLength: Boolean(first & 0x02),
    hasFont: Boolean(first & 0x01),
    hasFontClass: Boolean(second & 0x80),
    autoSize: Boolean(second & 0x40),
    hasLayout: Boolean(second & 0x20),
    noSelect: Boolean(second & 0x10),
    border: Boolean(second & 0x08),
    wasStatic: Boolean(second & 0x04),
    html: Boolean(second & 0x02),
    useOutlines: Boolean(second & 0x01)
  };

  if (flags.hasFont && flags.hasFontClass) {
    throw new TextParseError(
      `DefineEditText ${id} sets both HasFont and HasFontClass, which the format does not define an order for.`
    );
  }

  const font = flags.hasFont ? reader.readUI16() : null;
  const fontClass = flags.hasFontClass ? reader.readString() : null;
  const fontHeight = (flags.hasFont || flags.hasFontClass) ? reader.readUI16() : null;
  const colour = flags.hasTextColour
    ? { red: reader.readUI8(), green: reader.readUI8(), blue: reader.readUI8(), alpha: reader.readUI8() }
    : null;
  const maxLength = flags.hasMaxLength ? reader.readUI16() : null;

  let layout = null;
  if (flags.hasLayout) {
    const align = reader.readUI8();
    layout = {
      align: ALIGNMENT[align] ?? `unknown(${align})`,
      leftMargin: reader.readUI16(),
      rightMargin: reader.readUI16(),
      indent: reader.readUI16(),
      // Leading is SIGNED here and unsigned nowhere. A negative leading read as
      // unsigned becomes ~65000 twips of line spacing.
      leading: reader.readSI16()
    };
  }

  const variableName = reader.readString();
  const initialText = flags.hasText ? reader.readString() : null;

  return {
    id, tagCode: TEXT_TAG.DEFINE_EDIT_TEXT, kind: "field",
    bounds, flags, font, fontClass, fontHeight, colour, maxLength, layout,
    // An empty variable name is legal and means the field is not bound to a
    // variable. Kept as "" rather than folded to null, so "unbound" and
    // "bound to a variable whose name I failed to read" stay distinguishable.
    variableName, initialText,
    slackBytes: end - reader.byte
  };
}

/**
 * A static text's glyph runs resolved to characters, via the fonts' code tables.
 *
 * Returns `{ text, resolved, unresolved, missingFonts }`. **An index this
 * cannot resolve becomes U+FFFD in `text` AND increments `unresolved`** — it is
 * never dropped, because a silently shortened string is indistinguishable from
 * a correct one and that is the exact failure this project keeps finding.
 *
 * `fonts` is the `fonts` Map from `indexFonts`.
 */
export function textToString(text, fonts) {
  const pieces = [];
  let resolved = 0;
  let unresolved = 0;
  const missingFonts = new Set();

  for (const record of text.records) {
    const font = record.font === null ? null : fonts.get(record.font);
    if (!font) {
      if (record.font !== null) missingFonts.add(record.font);
      for (let index = 0; index < record.glyphs.length; index += 1) {
        pieces.push("�");
        unresolved += 1;
      }
      continue;
    }
    for (const entry of record.glyphs) {
      const glyph = font.glyphs[entry.index];
      if (!glyph) {
        pieces.push("�");
        unresolved += 1;
        continue;
      }
      pieces.push(glyph.char);
      resolved += 1;
    }
  }

  return { text: pieces.join(""), resolved, unresolved, missingFonts: [...missingFonts] };
}

/**
 * Every text character in the file, both halves, with failures COUNTED.
 *
 * Sprites are recursed into: the build defines text inside them, and the 436
 * that `indexCharacters` reports is only reachable by descending.
 */
export function indexText(buffer, { maxDepth = 8 } = {}) {
  const statics = new Map();
  const fields = new Map();
  const failures = [];

  const walk = (start, end, depth) => {
    for (const { code, bodyStart, bodyEnd } of walkTags(buffer, start, end)) {
      if (code === TAG.DEFINE_SPRITE) {
        if (depth < maxDepth) walk(bodyStart + 4, bodyEnd, depth + 1);
        continue;
      }
      const isStatic = code === TEXT_TAG.DEFINE_TEXT || code === TEXT_TAG.DEFINE_TEXT2;
      if (!isStatic && code !== TEXT_TAG.DEFINE_EDIT_TEXT) continue;
      const id = bodyEnd - bodyStart >= 2 ? buffer.readUInt16LE(bodyStart) : null;
      try {
        if (isStatic) {
          const parsed = parseText(buffer, bodyStart, bodyEnd, code);
          statics.set(parsed.id, parsed);
        } else {
          const parsed = parseEditText(buffer, bodyStart, bodyEnd);
          fields.set(parsed.id, parsed);
        }
      } catch (error) {
        failures.push({ id, tagCode: code, message: error.message });
      }
    }
  };

  walk(tagStreamStart(buffer), buffer.length, 0);

  let glyphEntries = 0;
  let records = 0;
  let slackBytes = 0;
  const fontsReferenced = new Set();
  for (const text of statics.values()) {
    glyphEntries += text.glyphEntries;
    records += text.records.length;
    slackBytes += text.slackBytes;
    for (const record of text.records) if (record.font !== null) fontsReferenced.add(record.font);
  }
  let useOutlines = 0;
  let withFont = 0;
  let withFontClass = 0;
  let html = 0;
  let withInitialText = 0;
  for (const field of fields.values()) {
    if (field.flags.useOutlines) useOutlines += 1;
    if (field.flags.hasFont) withFont += 1;
    if (field.flags.hasFontClass) withFontClass += 1;
    if (field.flags.html) html += 1;
    if (field.initialText !== null) withInitialText += 1;
    slackBytes += field.slackBytes;
    if (field.font !== null) fontsReferenced.add(field.font);
  }

  return {
    statics, fields, failures,
    totals: {
      statics: statics.size,
      fields: fields.size,
      bucket: statics.size + fields.size,
      records, glyphEntries,
      failures: failures.length,
      slackBytes,
      useOutlines, withFont, withFontClass, html, withInitialText,
      fontsReferenced: [...fontsReferenced].sort((a, b) => a - b)
    }
  };
}

// ---------------------------------------------------------------------------
// CLI. Reports; writes NOTHING.
// ---------------------------------------------------------------------------

export function parseArguments(argv) {
  const options = { file: null, strings: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--file") {
      index += 1;
      if (index >= argv.length) throw new TextParseError("--file needs a path.");
      options.file = argv[index];
    } else if (argument === "--strings") {
      options.strings = true;
    } else {
      throw new TextParseError(`unrecognised argument ${argument}`);
    }
  }
  if (!options.file) throw new TextParseError("--file is required.");
  return options;
}

function main(argv) {
  const options = parseArguments(argv);
  const buffer = fs.readFileSync(options.file);
  const { statics, fields, failures, totals } = indexText(buffer);
  const { fonts } = indexFonts(buffer);

  const lines = [
    `  ${totals.statics} DefineText + ${totals.fields} DefineEditText = ${totals.bucket} in the "text" bucket`,
    `  ${totals.records} text records, ${totals.glyphEntries} glyph entries, ` +
      `${totals.failures} FAILED, ${totals.slackBytes} slack bytes`,
    `  fields: ${totals.useOutlines} useOutlines, ${totals.withFont} hasFont, ` +
      `${totals.withFontClass} hasFontClass, ${totals.html} html, ${totals.withInitialText} with initial text`,
    `  fonts referenced: ${totals.fontsReferenced.join(", ")}`
  ];

  if (options.strings) {
    let unresolved = 0;
    for (const text of [...statics.values()].sort((a, b) => a.id - b.id)) {
      const read = textToString(text, fonts);
      unresolved += read.unresolved;
      lines.push(`   ${String(text.id).padStart(5)}  ${JSON.stringify(read.text)}`);
    }
    lines.push(`  ${unresolved} glyph entries could NOT be resolved to a character`);
  }
  for (const failure of failures.slice(0, 20)) lines.push(`  ! ${failure.id}: ${failure.message}`);
  process.stdout.write(`${lines.join("\n")}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
