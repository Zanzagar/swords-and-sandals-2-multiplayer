/**
 * Properties of the embedded-font parser.
 *
 * Two halves, deliberately:
 *
 *   1. Hand-built buffers, which run anywhere and pin the FORMAT — including
 *      the branches the shipped build never exercises, so they are not merely
 *      assumed to work.
 *   2. Oracle-gated measurements against the installed build, which pin the
 *      CENSUS. Every number in them was re-derived by this file rather than
 *      copied from a brief; where the two disagreed, the brief lost.
 *
 * ► **The whole point of the counting assertions is that a glyph this parser
 *   cannot read must be VISIBLE.** The house defect on this project is an
 *   approximation nobody counted: the arena walls were invisible for months
 *   because a parser emitted an empty path and reported zero failures. So the
 *   tests below never assert "the good ones are good" alone — they assert that
 *   `parsed + failed` reconciles to the declared total, and that a failed glyph
 *   carries `path: null` while a legitimately empty one carries `path: ""`.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  FONT3_UNITS_PER_EM,
  FONT_TAG,
  FontParseError,
  buildCodeIndex,
  indexFonts,
  kerningBetween,
  parseFont3,
  parseFontAlignZones,
  parseFontName,
  parseGlyphShape
} from "../tools/swf-fonts.mjs";

// ---------------------------------------------------------------------------
// A bit writer, so the format tests state bytes rather than hexdumps.
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
    this.writeUB(bits, value < 0 ? value + (1 << bits) : value);
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

  toBuffer() {
    this.align();
    return Buffer.from(this.bytes);
  }
}

/**
 * A GLYPH SHAPE: the fillBits/lineBits nibbles, then one contour per entry.
 * Every contour sets fillStyle0 = 1, which is what all 1009 non-empty glyphs in
 * the shipped build do.
 */
function encodeGlyph(contours) {
  const writer = new BitWriter();
  writer.writeUB(4, 1); // fillBits — the implicit table has one entry.
  writer.writeUB(4, 0); // lineBits — glyphs carry no strokes.
  for (const contour of contours) {
    writer.writeBit(0);
    writer.writeUB(5, 0x01 | 0x02); // StateMoveTo + StateFillStyle0
    writer.writeUB(5, 16);
    writer.writeSB(16, contour.start[0]);
    writer.writeSB(16, contour.start[1]);
    writer.writeUB(1, 1); // fillStyle0 = 1
    for (const point of contour.lines) {
      writer.writeBit(1); // an edge
      writer.writeBit(1); // straight
      writer.writeUB(4, 16 - 2);
      writer.writeBit(1); // general line: both deltas present
      writer.writeSB(16, point.dx);
      writer.writeSB(16, point.dy);
    }
  }
  writer.writeBit(0);
  writer.writeUB(5, 0); // EndShapeRecord
  return writer.toBuffer();
}

/** A DefineFont3 tag BODY, exactly as walkTags would hand one over. */
function encodeFont3({ id, name, hasLayout, wideOffsets = false, wideCodes = true, glyphs, layout }) {
  const head = new BitWriter();
  head.writeUI16(id);
  head.writeUI8((hasLayout ? 0x80 : 0) | (wideOffsets ? 0x08 : 0) | (wideCodes ? 0x04 : 0));
  head.writeUI8(1); // language
  const nameBytes = Buffer.from(`${name}\0`, "utf8");
  head.writeUI8(nameBytes.length);
  for (const byte of nameBytes) head.writeUI8(byte);
  head.writeUI16(glyphs.length);

  const offsetWidth = wideOffsets ? 4 : 2;
  const tableSize = (glyphs.length + 1) * offsetWidth;
  const shapes = glyphs.map((glyph) => glyph.shape);
  const offsets = [];
  let running = tableSize;
  for (const shape of shapes) {
    offsets.push(running);
    running += shape.length;
  }
  offsets.push(running); // CodeTableOffset

  const table = new BitWriter();
  for (const offset of offsets) {
    if (wideOffsets) {
      table.writeUI16(offset & 0xffff);
      table.writeUI16((offset >>> 16) & 0xffff);
    } else {
      table.writeUI16(offset);
    }
  }

  const codes = new BitWriter();
  for (const glyph of glyphs) codes.writeUI16(glyph.code);

  const tail = new BitWriter();
  if (hasLayout) {
    tail.writeSI16(layout.ascent);
    tail.writeSI16(layout.descent);
    tail.writeSI16(layout.leading);
    for (const advance of layout.advances) tail.writeSI16(advance);
    for (let index = 0; index < glyphs.length; index += 1) {
      tail.writeUB(5, 0); // an all-zero bounds RECT, which is what the build writes
      tail.align();
    }
    tail.writeUI16(layout.kerning.length);
    for (const pair of layout.kerning) {
      if (wideCodes) {
        tail.writeUI16(pair.left);
        tail.writeUI16(pair.right);
      } else {
        tail.writeUI8(pair.left);
        tail.writeUI8(pair.right);
      }
      tail.writeSI16(pair.adjustment);
    }
  }

  return Buffer.concat([head.toBuffer(), table.toBuffer(), ...shapes, codes.toBuffer(), tail.toBuffer()]);
}

/** A square contour that closes on itself, as a real glyph's outer does. */
function squareGlyph(size) {
  return encodeGlyph([{
    start: [0, 0],
    lines: [{ dx: size, dy: 0 }, { dx: 0, dy: size }, { dx: -size, dy: 0 }, { dx: 0, dy: -size }]
  }]);
}

// ---------------------------------------------------------------------------
// The glyph shape reader — the piece parseShape cannot do.
// ---------------------------------------------------------------------------

test("a glyph shape is read from the fillBits nibble, with no id and no bounds", () => {
  const shape = parseGlyphShape(squareGlyph(100), 0, squareGlyph(100).length);
  assert.equal(shape.fillBits, 1);
  assert.equal(shape.lineBits, 0);
  assert.equal(shape.edgeCount, 4);
  assert.equal(shape.contours.length, 1);
  assert.equal(shape.path, "M0 0L100 0L100 100L0 100L0 0Z");
  assert.equal(shape.openContours, 0);
  assert.equal(shape.empty, false);
});

test("a contour that does not close is COUNTED, never silently closed", () => {
  // ► This is the assertion that separates this parser from the one that drew
  //   a fan of wedges across the gladiator's chest. The parser does not stitch,
  //   because the shipped glyphs need no stitching — but if that ever stops
  //   being true the caller is told rather than handed a plausible shape.
  const bytes = encodeGlyph([{ start: [0, 0], lines: [{ dx: 50, dy: 0 }, { dx: 0, dy: 50 }] }]);
  const shape = parseGlyphShape(bytes, 0, bytes.length);
  assert.equal(shape.openContours, 1);
  assert.equal(shape.path, "M0 0L50 0L50 50Z");
});

test("a glyph with no edges is empty rather than failed, and says so", () => {
  const writer = new BitWriter();
  writer.writeUB(4, 1);
  writer.writeUB(4, 0);
  writer.writeBit(0);
  writer.writeUB(5, 0);
  const bytes = writer.toBuffer();
  const shape = parseGlyphShape(bytes, 0, bytes.length);
  assert.equal(shape.empty, true);
  assert.equal(shape.edgeCount, 0);
  // An empty STRING, not null: the glyph draws nothing on purpose. parseFont3
  // reserves null for a glyph it could not read at all.
  assert.equal(shape.path, "");
});

test("a quadratic edge becomes a Q with its absolute control point", () => {
  const writer = new BitWriter();
  writer.writeUB(4, 1);
  writer.writeUB(4, 0);
  writer.writeBit(0);
  writer.writeUB(5, 0x01 | 0x02);
  writer.writeUB(5, 16);
  writer.writeSB(16, 10);
  writer.writeSB(16, 20);
  writer.writeUB(1, 1);
  writer.writeBit(1); // edge
  writer.writeBit(0); // curved
  writer.writeUB(4, 16 - 2);
  writer.writeSB(16, 5);   // control delta x
  writer.writeSB(16, 30);  // control delta y
  writer.writeSB(16, 5);   // anchor delta x
  writer.writeSB(16, -30); // anchor delta y
  writer.writeBit(0);
  writer.writeUB(5, 0);
  const bytes = writer.toBuffer();
  const shape = parseGlyphShape(bytes, 0, bytes.length);
  // Control is pen + control delta; the anchor is pen + control + anchor delta.
  assert.equal(shape.path, "M10 20Q15 50 20 20Z");
  assert.equal(shape.contours[0].edges[0].kind, "quadratic");
});

test("StateNewStyles inside a glyph is refused by name, not read as edge data", () => {
  // A glyph's style table is implicit and single-entry, so there is nothing to
  // replace. Reading it anyway desynchronises every bit that follows, which is
  // how a parser produces a well-formed path out of nonsense.
  const writer = new BitWriter();
  writer.writeUB(4, 1);
  writer.writeUB(4, 0);
  writer.writeBit(0);
  writer.writeUB(5, 0x10);
  const bytes = writer.toBuffer();
  assert.throws(() => parseGlyphShape(bytes, 0, bytes.length), FontParseError);
});

// ---------------------------------------------------------------------------
// DefineFont3.
// ---------------------------------------------------------------------------

test("a DefineFont3 yields outlines, the code table and the metrics together", () => {
  const body = encodeFont3({
    id: 900,
    name: "Test Face",
    hasLayout: true,
    glyphs: [
      { code: 0x41, shape: squareGlyph(100) },
      { code: 0x42, shape: squareGlyph(200) }
    ],
    layout: { ascent: 1000, descent: 250, leading: 40, advances: [110, 220], kerning: [{ left: 0x41, right: 0x42, adjustment: -30 }] }
  });
  const font = parseFont3(body, 0, body.length, FONT_TAG.DEFINE_FONT3);
  assert.equal(font.id, 900);
  // The trailing NUL the exporter counts inside FontNameLen is stripped, and
  // the raw form is kept so the two are never confused.
  assert.equal(font.name, "Test Face");
  assert.equal(font.rawName, "Test Face\0");
  assert.equal(font.glyphCount, 2);
  assert.deepEqual(font.codeTable, [0x41, 0x42]);
  assert.equal(font.glyphs[0].char, "A");
  assert.equal(font.glyphs[1].path, "M0 0L200 0L200 200L0 200L0 0Z");
  assert.deepEqual(font.advances, [110, 220]);
  assert.equal(font.ascent, 1000);
  assert.equal(font.descent, 250);
  assert.equal(font.leading, 40);
  assert.equal(font.unitsPerEm, FONT3_UNITS_PER_EM);
  assert.deepEqual(font.kerning, [{ left: 0x41, right: 0x42, adjustment: -30 }]);
  // Nothing in the body went unaccounted for.
  assert.equal(font.slackBytes, 0);
  assert.equal(font.failures.length, 0);
});

test("a font with HasLayout = 0 returns NULL metrics, never zeros", () => {
  // ► THE FONT 1510 CASE, and the reason this parser exists in this shape.
  //   Reading the layout tail of such a font yields plausible integers out of
  //   the NEXT tag's body. A zero advance is a measurement; a null is an
  //   absence, and a renderer can only tell the difference if we keep it.
  const body = encodeFont3({
    id: 901,
    name: "No Layout",
    hasLayout: false,
    glyphs: [{ code: 0x41, shape: squareGlyph(100) }]
  });
  const font = parseFont3(body, 0, body.length, FONT_TAG.DEFINE_FONT3);
  assert.equal(font.flags.hasLayout, false);
  assert.equal(font.advances, null);
  assert.equal(font.ascent, null);
  assert.equal(font.descent, null);
  assert.equal(font.leading, null);
  assert.equal(font.kerning, null);
  assert.equal(font.bounds, null);
  // And the tag still reconciles: no layout means the tag ends at the code table.
  assert.equal(font.slackBytes, 0);
  assert.equal(font.glyphs[0].path, "M0 0L100 0L100 100L0 100L0 0Z");
});

test("kerningBetween returns null for a font that cannot answer, 0 for no pair", () => {
  const withLayout = parseFont3(...bodyAndRange(encodeFont3({
    id: 902, name: "K", hasLayout: true,
    glyphs: [{ code: 0x41, shape: squareGlyph(10) }, { code: 0x42, shape: squareGlyph(10) }],
    layout: { ascent: 1, descent: 1, leading: 0, advances: [1, 1], kerning: [{ left: 0x41, right: 0x42, adjustment: -7 }] }
  })), FONT_TAG.DEFINE_FONT3);
  const without = parseFont3(...bodyAndRange(encodeFont3({
    id: 903, name: "K", hasLayout: false, glyphs: [{ code: 0x41, shape: squareGlyph(10) }]
  })), FONT_TAG.DEFINE_FONT3);
  assert.equal(kerningBetween(withLayout, 0x41, 0x42), -7);
  assert.equal(kerningBetween(withLayout, 0x42, 0x41), 0);
  // Not 0 — "this font has no kerning table at all" is a different fact.
  assert.equal(kerningBetween(without, 0x41, 0x42), null);
});

test("wide offsets are read as 32-bit, so a large font does not fold at 64 KB", () => {
  const body = encodeFont3({
    id: 904, name: "Wide", hasLayout: false, wideOffsets: true,
    glyphs: [{ code: 0x41, shape: squareGlyph(100) }, { code: 0x42, shape: squareGlyph(300) }]
  });
  const font = parseFont3(body, 0, body.length, FONT_TAG.DEFINE_FONT3);
  assert.equal(font.flags.wideOffsets, true);
  assert.equal(font.glyphCount, 2);
  assert.equal(font.glyphs[1].path, "M0 0L300 0L300 300L0 300L0 0Z");
  assert.equal(font.slackBytes, 0);
});

test("a glyph whose offsets leave the tag is COUNTED and carries a null path", () => {
  // The reconciliation property the whole file is built around: a glyph this
  // parser cannot read must be in `failures` AND still occupy its own index,
  // because the code table is positional and dropping one re-letters the rest.
  const body = encodeFont3({
    id: 905, name: "Broken", hasLayout: false,
    glyphs: [{ code: 0x41, shape: squareGlyph(100) }, { code: 0x42, shape: squareGlyph(100) }]
  });
  // Corrupt offset[0] specifically: it is glyph 0's START and nothing else's
  // end, so exactly one glyph is destroyed and the survivor proves the code
  // table did not shift underneath it.
  const corrupt = Buffer.from(body);
  const offsetTableStart = 2 + 1 + 1 + 1 + Buffer.from("Broken\0").length + 2;
  corrupt.writeUInt16LE(0xfff0, offsetTableStart);
  const font = parseFont3(corrupt, 0, corrupt.length, FONT_TAG.DEFINE_FONT3);
  assert.equal(font.glyphs.length, 2, "the failed glyph keeps its index");
  assert.equal(font.failures.length, 1);
  assert.equal(font.glyphs[0].failed, true);
  // null, not "" — "could not read" must not wear the face of "draws nothing".
  assert.equal(font.glyphs[0].path, null);
  assert.equal(font.glyphs[0].code, 0x41);
  assert.match(font.failures[0].message, /outside the tag body/);
  // The survivor still reads, still at its own index, still with its own code.
  assert.equal(font.glyphs[1].failed, false);
  assert.equal(font.glyphs[1].code, 0x42);
  assert.equal(font.glyphs[1].path, "M0 0L100 0L100 100L0 100L0 0Z");
});

test("parseFont3 refuses DefineFont, DefineFont2 and DefineFont4 by name", () => {
  const body = encodeFont3({ id: 906, name: "X", hasLayout: false, glyphs: [{ code: 0x41, shape: squareGlyph(10) }] });
  for (const tagCode of [FONT_TAG.DEFINE_FONT, FONT_TAG.DEFINE_FONT2, FONT_TAG.DEFINE_FONT4]) {
    assert.throws(() => parseFont3(body, 0, body.length, tagCode), FontParseError);
  }
});

test("a zero-glyph font returns empty tables rather than reading the next tag", () => {
  const writer = new BitWriter();
  writer.writeUI16(907);
  writer.writeUI8(0);
  writer.writeUI8(1);
  writer.writeUI8(1);
  writer.writeUI8(0);
  writer.writeUI16(0);
  const body = writer.toBuffer();
  const font = parseFont3(body, 0, body.length, FONT_TAG.DEFINE_FONT3);
  assert.equal(font.glyphCount, 0);
  assert.deepEqual(font.glyphs, []);
  assert.deepEqual(font.codeTable, []);
  assert.equal(font.failures.length, 0);
});

test("buildCodeIndex maps a character code back to its glyph index", () => {
  const body = encodeFont3({
    id: 908, name: "Idx", hasLayout: false,
    glyphs: [{ code: 0x20, shape: squareGlyph(1) }, { code: 0x41, shape: squareGlyph(2) }]
  });
  const font = parseFont3(body, 0, body.length, FONT_TAG.DEFINE_FONT3);
  const index = buildCodeIndex(font);
  assert.equal(index.get(0x41), 1);
  assert.equal(index.get(0x20), 0);
  assert.equal(index.get(0x5a), undefined);
});

test("DefineFontName yields the name AND the copyright string", () => {
  const bytes = Buffer.concat([
    Buffer.from([0x8c, 0x03]),
    Buffer.from("Some Face\0Copyright 1990-1993 Someone Inc.\0", "latin1")
  ]);
  const parsed = parseFontName(bytes, 0, bytes.length);
  assert.equal(parsed.id, 908);
  assert.equal(parsed.name, "Some Face");
  // The licence line is the point of reading this tag at all.
  assert.equal(parsed.copyright, "Copyright 1990-1993 Someone Inc.");
});

test("a zone table is read as one record per glyph, with its float16 coordinates", () => {
  const bytes = Buffer.from([
    0x8d, 0x03,       // font id 909
    0x40,             // CSMTableHint = 1
    0x02,             // NumZoneData — two entries, four bytes each
    0x00, 0x3c,       // entry 0 coordinate: 1.0 as float16
    0x00, 0x44,       // entry 0 range:      4.0 as float16
    0x00, 0x42,       // entry 1 coordinate: 3.0 as float16
    0x00, 0x40,       // entry 1 range:      2.0 as float16
    0x03              // ZoneMask: X and Y
  ]);
  const parsed = parseFontAlignZones(bytes, 0, bytes.length);
  assert.equal(parsed.id, 909);
  assert.equal(parsed.csmTableHint, 1);
  assert.equal(parsed.zones.length, 1);
  assert.equal(parsed.zones[0].data.length, 2);
  assert.equal(parsed.zones[0].data[0].coordinate, 1);
  assert.equal(parsed.zones[0].data[0].range, 4);
  assert.equal(parsed.zones[0].data[1].coordinate, 3);
  assert.equal(parsed.zones[0].data[1].range, 2);
  assert.equal(parsed.zones[0].hasX, true);
  assert.equal(parsed.zones[0].hasY, true);
  assert.equal(parsed.slackBytes, 0);
});

/** Spread helper: a body Buffer as the (buffer, start, end) triple. */
function bodyAndRange(body) {
  return [body, 0, body.length];
}

// ---------------------------------------------------------------------------
// The census, against the installed build. Every number re-derived here.
// ---------------------------------------------------------------------------

const ORACLE =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";
const haveOracle = fs.existsSync(ORACLE);
const oracleSkip = haveOracle ? false : "no installed build on this machine";

test("the build holds exactly nine DefineFont3 fonts, at the ids measured",
  { skip: oracleSkip }, () => {
    const { fonts, totals } = indexFonts(fs.readFileSync(ORACLE));
    assert.deepEqual([...fonts.keys()].sort((a, b) => a - b),
      [53, 118, 754, 1510, 1519, 1523, 1526, 2120, 2132]);
    assert.equal(totals.fonts, 9);
    // And nothing else claims to be a font: zero DefineFont/2/4, zero FontInfo.
    assert.equal(totals.unsupportedFontTags, 0,
      "an unsupported font tag would mean glyphs this parser reports nothing about");
  });

test("EVERY glyph in the build is parsed or COUNTED — 1027, none silently absent",
  { skip: oracleSkip }, () => {
    // ► The reconciliation. Not "the good ones are good": the declared total,
    //   the parsed total and the failure list must add up, or a glyph went
    //   missing the way the arena walls did.
    const { fonts, totals } = indexFonts(fs.readFileSync(ORACLE));
    let declared = 0;
    let emitted = 0;
    let failed = 0;
    for (const font of fonts.values()) {
      declared += font.glyphCount;
      for (const glyph of font.glyphs) {
        if (glyph.failed) failed += 1; else emitted += 1;
      }
    }
    assert.equal(declared, 1027);
    assert.equal(emitted + failed, declared, "a glyph was neither emitted nor counted as a failure");
    assert.equal(failed, 0, "no glyph in this build fails to parse; a non-zero here is a real finding");
    assert.equal(totals.glyphs, 1027);
    assert.equal(totals.glyphFailures, 0);
  });

test("every non-empty glyph carries real path data, and the empty ones are space and nbsp",
  { skip: oracleSkip }, () => {
    const { fonts, totals } = indexFonts(fs.readFileSync(ORACLE));
    // 18 empty glyphs: two per font across nine fonts, and both are genuinely
    // blank characters rather than parse casualties.
    assert.equal(totals.emptyGlyphs, 18);
    const emptyCodes = new Set();
    for (const font of fonts.values()) {
      for (const glyph of font.glyphs) {
        if (glyph.empty) {
          emptyCodes.add(glyph.code);
          continue;
        }
        assert.ok(glyph.path.length > 0, `font ${font.id} glyph ${glyph.index} emitted an empty path`);
        assert.ok(glyph.path.startsWith("M") && glyph.path.endsWith("Z"),
          `font ${font.id} glyph ${glyph.index} is not a closed subpath`);
        assert.ok(glyph.edgeCount > 0);
      }
    }
    assert.deepEqual([...emptyCodes].sort((a, b) => a - b), [0x20, 0xa0]);
  });

test("all 2509 glyph contours close on themselves, so nothing needs stitching",
  { skip: oracleSkip }, () => {
    // ► This is the measurement that licenses the parser's decision NOT to
    //   stitch. If a future build breaks it, `openContours` goes non-zero and
    //   this test goes red rather than a renderer drawing wedges.
    const { fonts, totals } = indexFonts(fs.readFileSync(ORACLE));
    let contours = 0;
    for (const font of fonts.values()) {
      for (const glyph of font.glyphs) contours += glyph.contours.length;
    }
    assert.equal(contours, 2509);
    assert.equal(totals.openContours, 0);
  });

test("every glyph fills exactly its offset-table slot — zero slack bytes anywhere",
  { skip: oracleSkip }, () => {
    // Slack would mean this parser stopped early and the remaining bits went
    // unread, which is precisely how a truncated outline looks like a clean one.
    const { fonts } = indexFonts(fs.readFileSync(ORACLE));
    for (const font of fonts.values()) {
      assert.equal(font.slackBytes, 0, `font ${font.id} left ${font.slackBytes} bytes of its tag unread`);
      for (const glyph of font.glyphs) {
        assert.equal(glyph.slackBytes, 0,
          `font ${font.id} glyph ${glyph.index} left ${glyph.slackBytes} bytes unread`);
      }
    }
  });

test("font 1510 alone has NO layout, and its absence is null rather than zero",
  { skip: oracleSkip }, () => {
    // ► The finding that outranked the brief. "Avalon Quest" 1510 ends at its
    //   code table. Reading its layout tail anyway produces ascent 4735 and
    //   11776 kerning pairs, and runs 71161 bytes past the end of the tag.
    const { fonts, totals } = indexFonts(fs.readFileSync(ORACLE));
    assert.equal(totals.fontsWithoutLayout, 1);
    const orphan = fonts.get(1510);
    assert.equal(orphan.flags.hasLayout, false);
    assert.equal(orphan.advances, null);
    assert.equal(orphan.ascent, null);
    assert.equal(orphan.kerning, null);
    assert.equal(orphan.glyphCount, 114, "it still has all its outlines; only the metrics are absent");
    for (const [id, font] of fonts) {
      if (id === 1510) continue;
      assert.equal(font.flags.hasLayout, true, `font ${id} unexpectedly lost its layout`);
      assert.equal(font.advances.length, font.glyphCount, `font ${id} advance table does not cover its glyphs`);
    }
  });

test("the metrics of the laid-out fonts are the measured ones, in 20480-per-em units",
  { skip: oracleSkip }, () => {
    const { fonts } = indexFonts(fs.readFileSync(ORACLE));
    // Re-derived off the oracle, not copied. Goudy repeats across four ids
    // because the build embeds the same face four times at different points.
    const expected = new Map([
      [53, { ascent: 19720, descent: 4840, leading: 4080, kerning: 558, glyphs: 114 }],
      [118, { ascent: 19720, descent: 4840, leading: 4080, kerning: 558, glyphs: 114 }],
      [754, { ascent: 18540, descent: 4340, leading: 2400, kerning: 909, glyphs: 115 }],
      [1519, { ascent: 17080, descent: 8180, leading: 4780, kerning: 0, glyphs: 114 }],
      [1523, { ascent: 16440, descent: 4160, leading: 120, kerning: 0, glyphs: 114 }],
      [1526, { ascent: 16440, descent: 4160, leading: 120, kerning: 0, glyphs: 114 }],
      [2120, { ascent: 19720, descent: 4840, leading: 4080, kerning: 558, glyphs: 114 }],
      [2132, { ascent: 19720, descent: 4840, leading: 4080, kerning: 558, glyphs: 114 }]
    ]);
    for (const [id, want] of expected) {
      const font = fonts.get(id);
      assert.deepEqual({
        ascent: font.ascent, descent: font.descent, leading: font.leading,
        kerning: font.kerning.length, glyphs: font.glyphCount
      }, want, `font ${id} metrics`);
      assert.equal(font.unitsPerEm, 20480);
    }
    // Mini 7's ascent plus descent lands within 1% of one em, which is the
    // shape a real font has and the check that the unit is not twips.
    const mini = fonts.get(1523);
    assert.ok(Math.abs((mini.ascent + mini.descent) / mini.unitsPerEm - 1) < 0.01,
      "ascent + descent should be about one em; if it is 20x out the unit is wrong");
  });

test("EVERY embedded font names a rights holder, and there are FOUR of them",
  { skip: oracleSkip }, () => {
    // ► THE LICENCE BOUNDARY, pinned as data. A brief on this route named only
    //   Bitstream and Monotype. SWFTE International and Joe Gillespie are in
    //   the build too, and this test exists so that stays impossible to miss.
    const { fonts, names } = indexFonts(fs.readFileSync(ORACLE));
    assert.equal(names.size, 9);
    for (const font of fonts.values()) {
      assert.ok(typeof font.copyright === "string" && font.copyright.length > 0,
        `font ${font.id} has no DefineFontName: its rights holder would be unrecorded`);
    }
    assert.equal(fonts.get(53).displayName, "Goudy Handtooled BT");
    assert.match(fonts.get(53).copyright, /Bitstream Inc/);
    assert.match(fonts.get(754).copyright, /The Monotype Corporation/);
    assert.match(fonts.get(1510).copyright, /SWFTE International/);
    assert.match(fonts.get(1523).copyright, /Joe Gillespie/);
    const holders = new Set([...fonts.values()].map((font) => font.displayName));
    assert.deepEqual([...holders].sort(), ["Arial", "Avalon Quest", "Goudy Handtooled BT", "Mini 7"]);
  });

test("the align-zone tables corroborate the glyph counts from an independent tag",
  { skip: oracleSkip }, () => {
    // DefineFontAlignZones carries one record per glyph and reads nothing from
    // the font's own header, so agreement is corroboration and not restatement.
    const { fonts, alignZones, failures } = indexFonts(fs.readFileSync(ORACLE));
    assert.equal(alignZones.size, 9);
    for (const font of fonts.values()) {
      const zones = alignZones.get(font.id);
      assert.ok(zones, `font ${font.id} has no align zone table`);
      assert.equal(zones.zones.length, font.glyphCount, `font ${font.id} zone count`);
      assert.equal(zones.slackBytes, 0);
    }
    assert.deepEqual(failures, [], "no font-level failure was recorded against this build");
  });

test("the 423 CSMTextSettings tags are counted rather than ignored",
  { skip: oracleSkip }, () => {
    // They carry renderer hints, not outlines, so they change nothing here —
    // but an unread tag reported as nothing is the defect this project keeps
    // finding, so the number is surfaced.
    const { totals } = indexFonts(fs.readFileSync(ORACLE));
    assert.equal(totals.csmTextSettings, 423);
  });
