/**
 * SWF embedded fonts -> glyph outlines, code table, metrics and kerning.
 * Structure only; no typeface is reproduced here and none is written to disk.
 *
 * ## ⚠ THE TYPEFACES IN THIS BUILD ARE COMMERCIALLY LICENSED. READ THIS FIRST.
 *
 * Every one of the nine embedded fonts carries a `DefineFontName` tag (88)
 * naming a rights holder. Measured off the oracle, these are the exact strings
 * on the wire:
 *
 * ```text
 *   id   53  "Goudy Handtooled BT"  Copyright 1990-1993 Bitstream Inc.
 *   id  118  "Goudy Handtooled BT"  Copyright 1990-1993 Bitstream Inc.
 *   id  754  "Arial"                (c) 2017 The Monotype Corporation
 *   id 1510  "Avalon Quest"         Copyright (c) 1986-1993 SWFTE International
 *   id 1519  "Avalon Quest"         Copyright (c) 1986-1993 SWFTE International
 *   id 1523  "Mini 7"               MINI 7 (c) 2001 Joe Gillespie
 *   id 1526  "Mini 7"               MINI 7 (c) 2001 Joe Gillespie
 *   id 2120  "Goudy Handtooled BT"  Copyright 1990-1993 Bitstream Inc.
 *   id 2132  "Goudy Handtooled BT"  Copyright 1990-1993 Bitstream Inc.
 * ```
 *
 * ► **That is FOUR rights holders, not two.** A brief circulated on this route
 *   named only Bitstream and Monotype; SWFTE International and Joe Gillespie
 *   are also in the build and are just as much someone's property.
 *
 * So this module **reads bytes and returns geometry, and there is deliberately
 * no extractor next to it.** Nothing here writes a `.ttf`, a `.woff`, a `.otf`
 * or a glyph dump into `assets/` or anywhere else. Reconstituting an installed
 * typeface from a licensed build is a different act from measuring one, and
 * whether this project ever takes that step is the main session's call, not a
 * parser's. The repo ships no SS2 asset; a font is an asset.
 *
 * What this IS for: knowing what the build's own text says and how it is laid
 * out, so a reimplemented screen can be checked against the shipped one.
 *
 * ## Why `parseShape` cannot be pointed at a glyph
 *
 * A GLYPH SHAPE is not a `DefineShape`. It has **no character id, no bounds
 * RECT and no style arrays** — it begins directly at the `fillBits`/`lineBits`
 * nibble pair, and its style indices address an implicit single-entry table.
 * `tools/swf-shapes.mjs` opens by reading a UI16 id and a RECT, so aiming it at
 * a glyph consumes four-plus bytes of outline as a header and desynchronises
 * every bit after it. Hence a second, smaller shape reader here.
 *
 * ## Measured on the oracle before a line of this was written
 *
 * All 1027 glyphs across the nine fonts, re-derived by this module's own tests:
 *
 * - `fillBits` is **1** and `lineBits` is **0** in every glyph. No strokes.
 * - **Zero** `StateNewStyles` records. The implicit table is never replaced.
 * - Every non-empty glyph sets `fillStyle0 = 1` and never `fillStyle1`.
 * - **All 2509 contours close** — last point equals first, exactly, with no
 *   stitching. So a glyph is emitted as its literal contours and filled
 *   `nonzero`, and the wedge defect that `shapeToPaths` exists to prevent
 *   cannot arise here. Counters wind opposite to their outers, which is what
 *   makes `nonzero` cut the hole (Mini 7 'o': outer +90230400, inner -36481600).
 * - Every glyph ends exactly on its offset-table slot boundary: **0 slack
 *   bytes** across the whole file.
 *
 * ## THE ONE THAT BREAKS THE PATTERN, and it is why `advances` can be null
 *
 * ► **Font 1510 ("Avalon Quest") has `FontFlagsHasLayout = 0`.** It carries
 *   glyph outlines and a code table and then the tag ENDS. No ascent, no
 *   descent, no leading, no advance table, no bounds, no kerning.
 *
 *   Reading the layout tail anyway — which is what a parser that assumes the
 *   common case does — yields `ascent 4735, descent 1143, leading 0, kerning
 *   11776` and runs **71161 bytes past the end of the tag**. Those numbers are
 *   not flagged by anything: they are plausible-looking integers read out of
 *   the next tag's body. That is the house defect in its purest form, so this
 *   module returns `null` for every layout field of such a font and sets
 *   `flags.hasLayout` false. **Never zero. A zero advance is a measurement; a
 *   null is an absence.**
 *
 *   It costs the build nothing: font 1510 is referenced by exactly one
 *   `DefineText` and by **no** `DefineEditText`, and a static text carries its
 *   own advance baked into every glyph entry. Nothing in the build ever needed
 *   1510's advance table, which is presumably why the exporter dropped it.
 *
 * ## Units
 *
 * `DefineFont3` glyph coordinates are in a space **20x** that of `DefineFont2`,
 * whose em square is 1024 — so **20480 units per em**, and advances, ascent,
 * descent, leading and kerning are all in those same units. They are NOT twips
 * and NOT pixels; mixing the three has cost this project two defects already.
 * Cross-check on the oracle: Mini 7 ascent 16440 + descent 4160 = 20600, within
 * 0.6% of one em, which is the shape a real font has.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TAG, tagStreamStart, walkTags } from "./swf-display-list.mjs";

export class FontParseError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/** Tag codes this module reads or refuses BY NAME. Silence is the defect. */
export const FONT_TAG = Object.freeze({
  DEFINE_FONT: 10,
  DEFINE_FONT_INFO: 13,
  DEFINE_FONT2: 48,
  DEFINE_FONT_INFO2: 62,
  DEFINE_FONT_ALIGN_ZONES: 73,
  CSM_TEXT_SETTINGS: 74,
  DEFINE_FONT3: 75,
  DEFINE_FONT_NAME: 88,
  DEFINE_FONT4: 91
});

/**
 * `DefineFont3` glyph units per em: 1024 (the `DefineFont2` em) times 20.
 * Exported because a caller scaling a glyph to a `TextHeight` needs it and the
 * number is otherwise a magic constant copied around.
 */
export const FONT3_UNITS_PER_EM = 20480;

/** A bit-level cursor. Glyph shapes and RECTs are not byte-aligned. */
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
    if (this.byte >= this.end) throw new FontParseError("font record ran past the end of its tag.");
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

  /** Signed two's complement in `bits` bits — the SWF's SB encoding. */
  readSB(bits) {
    if (bits === 0) return 0;
    const raw = this.readUB(bits);
    const sign = 1 << (bits - 1);
    return (raw & sign) ? raw - (1 << bits) : raw;
  }

  readUI8() {
    this.align();
    if (this.byte >= this.end) throw new FontParseError("font record ran past the end of its tag.");
    return this.buffer[this.byte++];
  }

  readUI16() {
    this.align();
    if (this.byte + 2 > this.end) throw new FontParseError("font record ran past the end of its tag.");
    const value = this.buffer.readUInt16LE(this.byte);
    this.byte += 2;
    return value;
  }

  readSI16() {
    this.align();
    if (this.byte + 2 > this.end) throw new FontParseError("font record ran past the end of its tag.");
    const value = this.buffer.readInt16LE(this.byte);
    this.byte += 2;
    return value;
  }

  readUI32() {
    this.align();
    if (this.byte + 4 > this.end) throw new FontParseError("font record ran past the end of its tag.");
    const value = this.buffer.readUInt32LE(this.byte);
    this.byte += 4;
    return value;
  }

  /** RECT: a 5-bit width then four signed fields of that width. Byte-aligned. */
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
}

/**
 * One GLYPH SHAPE, as literal closed contours plus its SVG `d`.
 *
 * ► **This does NOT stitch, and that is a measurement, not an assumption.**
 *   `shapeToPaths` in `tools/swf-shapes.mjs` has to reassemble loops because a
 *   `DefineShape`'s edges are emitted in fill order rather than contour order,
 *   and the session that skipped that step drew a fan of wedges across the
 *   gladiator's chest. Glyph outlines are not built that way: this module's
 *   tests re-derive, from the oracle, that all 2509 contours in all 1027 glyphs
 *   already close on themselves. If that ever stops holding, `openContours`
 *   below is non-zero and the caller is told — it is never quietly closed.
 *
 * Coordinates stay in raw glyph units; scaling is the caller's, because the
 * caller is the one that knows the `TextHeight` it is laying out at.
 */
export function parseGlyphShape(buffer, start, end) {
  const reader = new BitReader(buffer, start, end);
  const fillBits = reader.readUB(4);
  const lineBits = reader.readUB(4);

  const contours = [];
  let current = null;
  let x = 0;
  let y = 0;
  let fill0 = 0;
  let fill1 = 0;
  let line = 0;
  let edgeCount = 0;
  let newStyleRecords = 0;

  for (;;) {
    const isEdge = reader.readBit();
    if (!isEdge) {
      const flags = reader.readUB(5);
      if (flags === 0) break; // EndShapeRecord
      if (flags & 0x01) {
        // StateMoveTo starts a new contour. A glyph's holes arrive this way.
        const bits = reader.readUB(5);
        x = reader.readSB(bits);
        y = reader.readSB(bits);
        current = { start: [x, y], edges: [], fill0, fill1, line };
        contours.push(current);
      }
      if (flags & 0x02) {
        fill0 = reader.readUB(fillBits);
        if (current) current.fill0 = fill0;
      }
      if (flags & 0x04) {
        fill1 = reader.readUB(fillBits);
        if (current) current.fill1 = fill1;
      }
      if (flags & 0x08) {
        line = reader.readUB(lineBits);
        if (current) current.line = line;
      }
      if (flags & 0x10) {
        // StateNewStyles is ILLEGAL inside a glyph — there is no style array to
        // replace. Refusing by name beats desynchronising every following bit,
        // which is what reading it as edge data would do. Measured: zero of the
        // build's 1027 glyphs contains one.
        throw new FontParseError(
          "glyph shape carries StateNewStyles, which a glyph's implicit single-entry style table cannot express."
        );
      }
      continue;
    }

    if (!current) {
      // An edge before any StateMoveTo starts at the origin, per the shape
      // record's own initial pen position. Recorded rather than dropped.
      current = { start: [x, y], edges: [], fill0, fill1, line };
      contours.push(current);
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
      current.edges.push({ kind: "line", to: [x, y] });
    } else {
      const cx = reader.readSB(bits);
      const cy = reader.readSB(bits);
      const ax = reader.readSB(bits);
      const ay = reader.readSB(bits);
      const control = [x + cx, y + cy];
      x += cx + ax;
      y += cy + ay;
      current.edges.push({ kind: "quadratic", control, to: [x, y] });
    }
    edgeCount += 1;
  }

  reader.align();

  let openContours = 0;
  const parts = [];
  for (const contour of contours) {
    if (contour.edges.length === 0) continue; // A bare move draws nothing.
    const last = contour.edges[contour.edges.length - 1].to;
    if (last[0] !== contour.start[0] || last[1] !== contour.start[1]) openContours += 1;
    parts.push(`M${contour.start[0]} ${contour.start[1]}`);
    for (const edge of contour.edges) {
      parts.push(edge.kind === "line"
        ? `L${edge.to[0]} ${edge.to[1]}`
        : `Q${edge.control[0]} ${edge.control[1]} ${edge.to[0]} ${edge.to[1]}`);
    }
    parts.push("Z");
  }

  return {
    contours,
    edgeCount,
    openContours,
    fillBits,
    lineBits,
    newStyleRecords,
    // Empty ONLY when the glyph genuinely has no edges — space and nbsp do. A
    // glyph this module failed on gets `path: null` from parseFont3 instead, so
    // "drew nothing on purpose" and "could not be read" never wear the same face.
    path: parts.join(""),
    empty: edgeCount === 0,
    endByte: reader.byte
  };
}

/** The bit flags byte of a `DefineFont3`, spread out so no caller re-masks it. */
function readFontFlags(raw) {
  return {
    hasLayout: Boolean(raw & 0x80),
    shiftJIS: Boolean(raw & 0x40),
    smallText: Boolean(raw & 0x20),
    ansi: Boolean(raw & 0x10),
    wideOffsets: Boolean(raw & 0x08),
    wideCodes: Boolean(raw & 0x04),
    italic: Boolean(raw & 0x02),
    bold: Boolean(raw & 0x01)
  };
}

/**
 * A `DefineFont3` (tag 75) tag body: outlines, code table and — WHEN PRESENT —
 * metrics and kerning.
 *
 * `start`/`end` are the tag BODY, exactly as `walkTags` yields them.
 *
 * Every glyph that fails is counted in `failures` AND left in `glyphs` at its
 * own index carrying `failed: true, path: null`, because the code table is
 * positional: dropping a bad glyph would silently re-letter every glyph after
 * it, which reads as success and renders as gibberish.
 */
export function parseFont3(buffer, start, end, tagCode = FONT_TAG.DEFINE_FONT3) {
  if (tagCode !== FONT_TAG.DEFINE_FONT3) {
    // Named refusal. DefineFont (10), DefineFont2 (48) and DefineFont4 (91) are
    // different records; the shipped build holds zero of each, and writing them
    // speculatively against a case that cannot occur here is how untested code
    // gets mistaken for tested code.
    throw new FontParseError(
      `parseFont3 reads DefineFont3 (tag ${FONT_TAG.DEFINE_FONT3}) only; tag ${tagCode} needs its own reader.`
    );
  }
  if (end - start < 5) throw new FontParseError("DefineFont3 body is too short to hold a header.");

  const reader = new BitReader(buffer, start, end);
  const id = reader.readUI16();
  const flags = readFontFlags(reader.readUI8());
  const language = reader.readUI8();
  const nameLength = reader.readUI8();
  if (reader.byte + nameLength > end) {
    throw new FontParseError(`DefineFont3 ${id} declares a ${nameLength}-byte name that overruns the tag.`);
  }
  const rawName = buffer.toString("utf8", reader.byte, reader.byte + nameLength);
  reader.byte += nameLength;
  // The exporter counts a terminating NUL inside FontNameLen — "Mini 7\0" is 7
  // bytes. Stripping it here stops every downstream comparison and filename
  // carrying an invisible character.
  const name = rawName.replace(/\0+$/, "");

  const glyphCount = reader.readUI16();
  const offsetTableStart = reader.byte;
  const offsetWidth = flags.wideOffsets ? 4 : 2;

  if (glyphCount === 0) {
    // A legal, if useless, font. Returning empty tables beats reading the next
    // tag's bytes as an offset table.
    return {
      id, tagCode, name, rawName, language, flags,
      unitsPerEm: FONT3_UNITS_PER_EM,
      glyphCount: 0, glyphs: [], codeTable: [],
      ascent: null, descent: null, leading: null,
      advances: null, bounds: null, kerning: null,
      failures: [], slackBytes: end - reader.byte,
      openContours: 0, emptyGlyphs: 0
    };
  }

  if (offsetTableStart + (glyphCount + 1) * offsetWidth > end) {
    throw new FontParseError(
      `DefineFont3 ${id} declares ${glyphCount} glyphs whose offset table overruns the tag.`
    );
  }

  // Offsets are measured from the FIRST BYTE OF THE OFFSET TABLE, not from the
  // tag body. Measured on the oracle: offset[0] is 230 in an 8-bit-offset font
  // with 114 glyphs, which is exactly (114 + 1) * 2 — the table's own size.
  const offsetAt = (index) => (flags.wideOffsets
    ? buffer.readUInt32LE(offsetTableStart + index * 4)
    : buffer.readUInt16LE(offsetTableStart + index * 2));
  const codeTableOffset = offsetAt(glyphCount);
  const codeTableStart = offsetTableStart + codeTableOffset;
  if (codeTableStart + glyphCount * 2 > end) {
    throw new FontParseError(`DefineFont3 ${id} points its code table past the end of the tag.`);
  }

  const failures = [];
  const glyphs = [];
  let openContours = 0;
  let emptyGlyphs = 0;

  for (let index = 0; index < glyphCount; index += 1) {
    // DefineFont3's code table is UI16 regardless of FontFlagsWideCodes; the
    // flag is set on all nine fonts here anyway, so both readings agree and the
    // spec's own rule is the one followed.
    const code = buffer.readUInt16LE(codeTableStart + index * 2);
    const glyphStart = offsetTableStart + offsetAt(index);
    const glyphEnd = offsetTableStart + (index + 1 < glyphCount ? offsetAt(index + 1) : codeTableOffset);
    const base = { index, code, char: String.fromCodePoint(code), start: glyphStart, end: glyphEnd };

    if (glyphStart < offsetTableStart || glyphEnd > end || glyphEnd < glyphStart) {
      failures.push({ font: id, glyph: index, code, message: "glyph offsets fall outside the tag body." });
      glyphs.push({ ...base, failed: true, path: null, contours: [], edgeCount: 0, empty: false });
      continue;
    }
    try {
      const shape = parseGlyphShape(buffer, glyphStart, glyphEnd);
      openContours += shape.openContours;
      if (shape.empty) emptyGlyphs += 1;
      glyphs.push({
        ...base,
        failed: false,
        path: shape.path,
        contours: shape.contours,
        edgeCount: shape.edgeCount,
        openContours: shape.openContours,
        empty: shape.empty,
        // Slack means this glyph did not fill its offset-table slot. Measured
        // zero across the build; surfaced rather than assumed so a future build
        // that pads differently says so instead of looking clean.
        slackBytes: glyphEnd - shape.endByte
      });
    } catch (error) {
      failures.push({ font: id, glyph: index, code, message: error.message });
      glyphs.push({ ...base, failed: true, path: null, contours: [], edgeCount: 0, empty: false });
    }
  }

  let ascent = null;
  let descent = null;
  let leading = null;
  let advances = null;
  let bounds = null;
  let kerning = null;
  let cursor = codeTableStart + glyphCount * 2;

  if (flags.hasLayout) {
    const layout = new BitReader(buffer, cursor, end);
    ascent = layout.readSI16();
    descent = layout.readSI16();
    leading = layout.readSI16();
    advances = [];
    for (let index = 0; index < glyphCount; index += 1) advances.push(layout.readSI16());
    bounds = [];
    for (let index = 0; index < glyphCount; index += 1) bounds.push(layout.readRect());
    const kerningCount = layout.readUI16();
    kerning = [];
    for (let index = 0; index < kerningCount; index += 1) {
      const left = flags.wideCodes ? layout.readUI16() : layout.readUI8();
      const right = flags.wideCodes ? layout.readUI16() : layout.readUI8();
      kerning.push({ left, right, adjustment: layout.readSI16() });
    }
    layout.align();
    cursor = layout.byte;
  }
  // ► When hasLayout is false these stay NULL, never zero. See the header: font
  //   1510 is such a font, and filling zeros here would have handed a renderer
  //   114 zero-width glyphs that it would lay out silently on top of each other.

  return {
    id,
    tagCode,
    name,
    rawName,
    language,
    flags,
    unitsPerEm: FONT3_UNITS_PER_EM,
    glyphCount,
    glyphs,
    codeTable: glyphs.map((glyph) => glyph.code),
    ascent,
    descent,
    leading,
    advances,
    bounds,
    kerning,
    failures,
    openContours,
    emptyGlyphs,
    // Bytes of the tag body nothing above accounted for. Non-zero is a finding.
    slackBytes: end - cursor
  };
}

/**
 * `DefineFontName` (tag 88): the display name and the COPYRIGHT string.
 *
 * Parsed and surfaced deliberately. This is the tag that says whose typeface
 * this is, and a pipeline that reads glyph outlines while dropping the licence
 * line attached to them is choosing not to know.
 */
export function parseFontName(buffer, start, end) {
  if (end - start < 2) throw new FontParseError("DefineFontName body is too short to hold a font id.");
  const id = buffer.readUInt16LE(start);
  let cursor = start + 2;
  const readString = () => {
    const from = cursor;
    while (cursor < end && buffer[cursor] !== 0) cursor += 1;
    const value = buffer.toString("utf8", from, cursor);
    cursor += 1;
    return value;
  };
  const name = readString();
  const copyright = readString();
  return { id, name, copyright };
}

/** Half-precision float, the only place a SWF uses one. Align zones need it. */
function readFloat16(buffer, offset) {
  const raw = buffer.readUInt16LE(offset);
  const sign = (raw & 0x8000) ? -1 : 1;
  const exponent = (raw >>> 10) & 0x1f;
  const fraction = raw & 0x03ff;
  if (exponent === 0) return sign * fraction * 2 ** -24;
  if (exponent === 0x1f) return fraction === 0 ? sign * Infinity : NaN;
  return sign * (1 + fraction / 1024) * 2 ** (exponent - 15);
}

/**
 * `DefineFontAlignZones` (tag 73): the CSM hinting zones, one record per glyph.
 *
 * Not needed to draw a glyph — but there are nine of these in the build, one
 * per font, and an unread tag is an uncounted one. It doubles as the only
 * INDEPENDENT check on a font's glyph count: the zone table has exactly
 * `glyphCount` records and nothing in it comes from the font's own header, so
 * agreement between the two is real corroboration rather than a restatement.
 */
export function parseFontAlignZones(buffer, start, end) {
  if (end - start < 3) throw new FontParseError("DefineFontAlignZones body is too short.");
  const id = buffer.readUInt16LE(start);
  const csmTableHint = buffer[start + 2] >>> 6;
  let cursor = start + 3;
  const zones = [];
  while (cursor < end) {
    const zoneDataCount = buffer[cursor];
    cursor += 1;
    if (cursor + zoneDataCount * 4 + 1 > end) {
      throw new FontParseError(`DefineFontAlignZones ${id} declares a zone record that overruns the tag.`);
    }
    const data = [];
    for (let index = 0; index < zoneDataCount; index += 1) {
      data.push({
        coordinate: readFloat16(buffer, cursor),
        range: readFloat16(buffer, cursor + 2)
      });
      cursor += 4;
    }
    const mask = buffer[cursor];
    cursor += 1;
    zones.push({ data, hasX: Boolean(mask & 0x01), hasY: Boolean(mask & 0x02) });
  }
  return { id, csmTableHint, zones, slackBytes: end - cursor };
}

/** A glyph lookup by character code, built once per font rather than per call. */
export function buildCodeIndex(font) {
  const index = new Map();
  for (const glyph of font.glyphs) if (!index.has(glyph.code)) index.set(glyph.code, glyph.index);
  return index;
}

/**
 * The kerning adjustment between two character CODES, or 0 when there is none.
 *
 * Returns `null` — not 0 — for a font with no layout, so a caller can tell "no
 * pair kerns" apart from "this font cannot answer the question".
 */
export function kerningBetween(font, leftCode, rightCode) {
  if (!font.kerning) return null;
  for (const pair of font.kerning) {
    if (pair.left === leftCode && pair.right === rightCode) return pair.adjustment;
  }
  return 0;
}

/**
 * Every embedded font in the file, with its name tag, its align zones, and an
 * explicit tally of the font formats found that this module does NOT read.
 *
 * Sprites are recursed into: nothing forbids a font tag inside a `DefineSprite`
 * even though all nine in this build sit at the top level, and a reader that
 * only looks at depth 0 would report a clean zero for a build that nests one.
 */
export function indexFonts(buffer, { maxDepth = 8 } = {}) {
  const fonts = new Map();
  const names = new Map();
  const alignZones = new Map();
  const failures = [];
  const unsupported = [];
  let csmTextSettings = 0;

  const UNREADABLE = new Map([
    [FONT_TAG.DEFINE_FONT, "DefineFont"],
    [FONT_TAG.DEFINE_FONT_INFO, "DefineFontInfo"],
    [FONT_TAG.DEFINE_FONT2, "DefineFont2"],
    [FONT_TAG.DEFINE_FONT_INFO2, "DefineFontInfo2"],
    [FONT_TAG.DEFINE_FONT4, "DefineFont4"]
  ]);

  const walk = (start, end, depth) => {
    for (const { code, bodyStart, bodyEnd } of walkTags(buffer, start, end)) {
      if (code === TAG.DEFINE_SPRITE) {
        if (depth < maxDepth) walk(bodyStart + 4, bodyEnd, depth + 1);
        continue;
      }
      if (code === FONT_TAG.DEFINE_FONT3) {
        try {
          const font = parseFont3(buffer, bodyStart, bodyEnd, code);
          fonts.set(font.id, font);
          for (const failure of font.failures) failures.push(failure);
        } catch (error) {
          const id = bodyEnd - bodyStart >= 2 ? buffer.readUInt16LE(bodyStart) : null;
          failures.push({ font: id, glyph: null, code: null, message: error.message });
        }
      } else if (code === FONT_TAG.DEFINE_FONT_NAME) {
        try {
          const parsed = parseFontName(buffer, bodyStart, bodyEnd);
          names.set(parsed.id, parsed);
        } catch (error) {
          failures.push({ font: null, glyph: null, code: null, message: error.message });
        }
      } else if (code === FONT_TAG.DEFINE_FONT_ALIGN_ZONES) {
        try {
          const parsed = parseFontAlignZones(buffer, bodyStart, bodyEnd);
          alignZones.set(parsed.id, parsed);
        } catch (error) {
          failures.push({ font: null, glyph: null, code: null, message: error.message });
        }
      } else if (code === FONT_TAG.CSM_TEXT_SETTINGS) {
        // Renderer hints — anti-alias mode, thickness, sharpness. They change
        // nothing about the outlines, so they are COUNTED and not parsed, which
        // is a different statement from being ignored.
        csmTextSettings += 1;
      } else if (UNREADABLE.has(code)) {
        unsupported.push({
          tagCode: code,
          tagName: UNREADABLE.get(code),
          id: bodyEnd - bodyStart >= 2 ? buffer.readUInt16LE(bodyStart) : null,
          reason: "not DefineFont3; this module reads tag 75 only."
        });
      }
    }
  };

  walk(tagStreamStart(buffer), buffer.length, 0);

  // Attach the licence-bearing name to its font, and say so when one is missing
  // rather than leaving a font whose rights holder is simply unrecorded.
  for (const font of fonts.values()) {
    const named = names.get(font.id);
    font.displayName = named ? named.name : null;
    font.copyright = named ? named.copyright : null;
    if (!named) {
      failures.push({
        font: font.id, glyph: null, code: null,
        message: "no DefineFontName tag: this font's rights holder is unrecorded in the build."
      });
    }
    const zones = alignZones.get(font.id);
    font.alignZoneCount = zones ? zones.zones.length : null;
    if (zones && zones.zones.length !== font.glyphCount) {
      failures.push({
        font: font.id, glyph: null, code: null,
        message: `align zone table holds ${zones.zones.length} records for ${font.glyphCount} glyphs.`
      });
    }
  }

  let glyphs = 0;
  let glyphFailures = 0;
  let emptyGlyphs = 0;
  let openContours = 0;
  let withoutLayout = 0;
  for (const font of fonts.values()) {
    glyphs += font.glyphCount;
    glyphFailures += font.glyphs.filter((glyph) => glyph.failed).length;
    emptyGlyphs += font.emptyGlyphs;
    openContours += font.openContours;
    if (!font.flags.hasLayout) withoutLayout += 1;
  }

  return {
    fonts,
    names,
    alignZones,
    unsupported,
    failures,
    totals: {
      fonts: fonts.size,
      glyphs,
      glyphFailures,
      emptyGlyphs,
      openContours,
      fontsWithoutLayout: withoutLayout,
      csmTextSettings,
      unsupportedFontTags: unsupported.length
    }
  };
}

// ---------------------------------------------------------------------------
// CLI. Reports; writes NOTHING. See the licence note at the top of this file.
// ---------------------------------------------------------------------------

export function parseArguments(argv) {
  const options = { file: null, glyphs: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--file") {
      index += 1;
      if (index >= argv.length) throw new FontParseError("--file needs a path.");
      options.file = argv[index];
    } else if (argument === "--glyphs") {
      options.glyphs = true;
    } else {
      throw new FontParseError(`unrecognised argument ${argument}`);
    }
  }
  if (!options.file) throw new FontParseError("--file is required.");
  return options;
}

function main(argv) {
  const options = parseArguments(argv);
  const buffer = fs.readFileSync(options.file);
  const { fonts, totals, failures, unsupported } = indexFonts(buffer);

  const lines = [
    "THESE TYPEFACES ARE COMMERCIALLY LICENSED. This tool reports and writes NOTHING.",
    ""
  ];
  for (const font of [...fonts.values()].sort((a, b) => a.id - b.id)) {
    const metrics = font.flags.hasLayout
      ? `asc ${font.ascent} desc ${font.descent} lead ${font.leading} kern ${font.kerning.length}`
      : "NO LAYOUT: no ascent/descent/advances/kerning in this tag";
    lines.push(
      `  ${String(font.id).padStart(4)} ${String(font.name).padEnd(20)} ` +
      `${String(font.glyphCount).padStart(4)} glyphs  ${metrics}`
    );
    lines.push(`       ${font.copyright ?? "NO DefineFontName — rights holder unrecorded"}`);
    if (options.glyphs) {
      for (const glyph of font.glyphs) {
        lines.push(`       #${String(glyph.index).padStart(3)} U+${glyph.code.toString(16).padStart(4, "0")} ` +
          `${glyph.failed ? "FAILED" : `${glyph.edgeCount} edges`}`);
      }
    }
  }
  lines.push("");
  lines.push(`  ${totals.fonts} fonts, ${totals.glyphs} glyphs, ${totals.glyphFailures} FAILED, ` +
    `${totals.emptyGlyphs} empty, ${totals.openContours} open contours, ` +
    `${totals.fontsWithoutLayout} without layout, ${totals.csmTextSettings} CSMTextSettings counted`);
  for (const entry of unsupported) lines.push(`  ! unsupported ${entry.tagName} id ${entry.id}`);
  for (const failure of failures.slice(0, 20)) lines.push(`  ! font ${failure.font}: ${failure.message}`);
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
