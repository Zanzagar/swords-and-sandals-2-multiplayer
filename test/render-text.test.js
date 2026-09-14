/**
 * TEXT AS DRAW OPERATIONS, and the seam that has cost this project three
 * defects.
 *
 * ► **THE UNIT SEAM IS THE LOAD-BEARING TEST IN THIS FILE.** A glyph outline is
 *   in GLYPH UNITS (20480 per em), a field's box is in TWIPS (20 per pixel), the
 *   API speaks PIXELS, and an emitted operation carries a PIXEL path with a
 *   TWIPS translation. Four spaces, and the only reason the arena draws is that
 *   every conversion happens exactly once. So the tests below pin the arithmetic
 *   with numbers a reader can check in their head — a size of 20.48px makes the
 *   glyph-unit scale exactly 0.001 — rather than round-tripping the module
 *   through itself.
 *
 * ► **AND THE SECOND ONE IS A CROSS-CHECK AGAINST THE BUILD'S OWN NUMBERS.**
 *   Each of the 180 `DefineText` characters carries a bounds RECT the Flash
 *   exporter wrote, which nothing in this pipeline derives. Laying the run out
 *   from its glyph indices and advances and asking whether the ink lands inside
 *   that rectangle is therefore an INDEPENDENT check on the layout, not a
 *   restatement of it. 178 of the 179 runs that draw anything land inside it to
 *   half a pixel.
 *
 * Everything that can run on a synthetic pack does, so a clone with no licensed
 * copy still executes it. The ones that need the extracted pack say so by name.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FIELD_GUTTER_PX,
  TEXT_UNITS_PER_EM,
  TWIPS_PER_PIXEL,
  fieldLayoutOptionsFor,
  fieldOpsFor,
  fieldsPlacedIn,
  fontFor,
  fontIdsIn,
  hasExtractedText,
  layoutText,
  lineMetricsFor,
  scaleGlyphPath,
  staticTextOpsFor,
  textOpsFor,
  textPackFrom
} from "../src/render/text.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * A pack with one font whose numbers are chosen so the arithmetic is legible:
 * at `size` 20.48 the glyph-unit scale is exactly 0.001, so a 10000-unit box is
 * ten pixels and a 12000-unit advance is twelve.
 */
function syntheticPack(overrides = {}) {
  const box = "M0 -10000L10000 -10000L10000 0L0 0Z";
  const font = {
    id: 7,
    name: "Test",
    displayName: "Test",
    copyright: "none",
    hasLayout: true,
    unitsPerEm: TEXT_UNITS_PER_EM,
    ascent: 16000,
    descent: 4000,
    leading: 1000,
    emptyLayoutBounds: 0,
    glyphCount: 3,
    glyphs: [
      { code: 32, char: " ", path: "", empty: true, failed: false, advance: 10000, ink: null },
      { code: 65, char: "A", path: box, empty: false, failed: false, advance: 12000, ink: { xMin: 0, xMax: 10000, yMin: -10000, yMax: 0 } },
      { code: 66, char: "B", path: box, empty: false, failed: false, advance: 8000, ink: { xMin: 0, xMax: 10000, yMin: -10000, yMax: 0 } }
    ],
    kerning: [[65, 66, -2000]],
    ...(overrides.font ?? {})
  };
  return textPackFrom({
    unitsPerEm: TEXT_UNITS_PER_EM,
    fonts: { 7: font },
    statics: overrides.statics ?? {},
    fields: overrides.fields ?? {},
    placements: overrides.placements ?? {}
  });
}

/** The pixel-space ink box of a list of operations, matrix included. */
function inkOfOps(ops) {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const op of ops) {
    const numbers = (op.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const m = op.matrix;
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      const x = numbers[index];
      const y = numbers[index + 1];
      const px = m[0] * x + m[2] * y + m[4] / TWIPS_PER_PIXEL;
      const py = m[1] * x + m[3] * y + m[5] / TWIPS_PER_PIXEL;
      xMin = Math.min(xMin, px);
      xMax = Math.max(xMax, px);
      yMin = Math.min(yMin, py);
      yMax = Math.max(yMax, py);
    }
  }
  return { xMin, xMax, yMin, yMax };
}

/* ---------------------------------------------------------------- */
/* Total readers                                                     */
/* ---------------------------------------------------------------- */

test("a missing, truncated or hand-edited pack returns null and never throws", () => {
  // ► The arena must stay playable on a clone with no licensed copy. This is the
  //   identical arrangement `propPackFrom` and `bindingsFrom` already have, and
  //   the fallback is the supported way to run, not an error path.
  for (const rubbish of [null, undefined, 42, "text", [], {}, { fonts: null }, { fonts: 3 }]) {
    assert.equal(textPackFrom(rubbish), null, `textPackFrom(${JSON.stringify(rubbish)})`);
  }
  const empty = textPackFrom({ fonts: {} });
  assert.equal(hasExtractedText(empty), false);
  assert.equal(hasExtractedText(null), false);
  assert.deepEqual(fontIdsIn(null), []);
  assert.equal(fontFor(null, 7), null);
  assert.equal(layoutText(null, { font: 7, text: "A" }), null);
  assert.equal(textOpsFor(null, { font: 7, text: "A" }), null);
  assert.equal(staticTextOpsFor(null, 1), null);
  assert.equal(fieldOpsFor(null, 1), null);
  assert.equal(fieldLayoutOptionsFor(null, 1), null);
  assert.deepEqual(fieldsPlacedIn(null, 1531), []);
});

test("a pack with a font that has no glyphs holds nothing drawable", () => {
  // ► It must return NULL rather than a sentence of `.notdef` boxes. Every one
  //   of those boxes would be honestly marked missing — and the caller would
  //   still have lost the null that sends it back to its own authored art.
  const pack = textPackFrom({ fonts: { 7: { id: 7, glyphs: [] } } });
  assert.equal(hasExtractedText(pack), false);
  assert.deepEqual(fontIdsIn(pack), [7], "the id is still listed; it just cannot answer");
  assert.equal(fontFor(pack, 7), null);
  assert.equal(layoutText(pack, { font: 7, size: 12, text: "A" }), null);
  assert.equal(textOpsFor(pack, { font: 7, size: 12, text: "A" }), null);
});

test("a font is reachable by number or by the string key JSON gave it", () => {
  const pack = syntheticPack();
  assert.equal(fontFor(pack, 7).id, 7);
  assert.equal(fontFor(pack, "7").id, 7);
  assert.equal(fontFor(pack, 9), null);
  assert.deepEqual(fontIdsIn(pack), [7]);
});

/* ---------------------------------------------------------------- */
/* The unit seam                                                     */
/* ---------------------------------------------------------------- */

test("THE PATH IS PIXELS AND THE MATRIX TRANSLATION IS TWIPS", () => {
  // ► `paintArenaLayer` in tools/arena/main.js does
  //   `context.transform(m[0], m[1], m[2], m[3], m[4] / 20, m[5] / 20)` and then
  //   draws `d` unscaled. These operations are shaped to go straight into it.
  const pack = syntheticPack();
  const ops = textOpsFor(pack, { font: 7, size: 20.48, text: "A", x: 10, y: 20, colour: "#ff0000" });
  assert.equal(ops.length, 1);
  const [op] = ops;
  // 10000 glyph units at 20.48px/em is exactly ten pixels.
  assert.equal(op.d, "M0 -10L10 -10L10 0L0 0Z");
  // x 10px and y 20px, in twips.
  assert.deepEqual(op.matrix, [1, 0, 0, 1, 200, 400]);
  assert.equal(op.fill, "#ff0000");
  assert.equal(op.kind, "path");
  // Glyph contours wind opposite to their counters, so a glyph fills under
  // NONZERO. The shape packs use evenodd and this one deliberately does not.
  assert.equal(op.fillRule, "nonzero");
  assert.deepEqual(op.glyph, { font: 7, index: 1, code: 65, char: "A" });
});

test("scaling a glyph path touches every number and no command", () => {
  assert.equal(scaleGlyphPath("M100 -200L300 -200Z", 0.01), "M1 -2L3 -2Z");
  assert.equal(scaleGlyphPath("M0 0Q50 -100 100 0Z", 0.02), "M0 0Q1 -2 2 0Z");
  // A negative number is its own separator and must stay one.
  assert.equal(scaleGlyphPath("M-40 -40L40 40Z", 0.5), "M-20 -20L20 20Z");
  assert.equal(scaleGlyphPath("", 2), "");
  assert.equal(scaleGlyphPath(null, 2), "");
});

test("an advance and a kerning pair both land in the pen position", () => {
  const pack = syntheticPack();
  const layout = layoutText(pack, { font: 7, size: 20.48, text: "AB", x: 0, y: 0 });
  assert.equal(layout.lines.length, 1);
  const [first, second] = layout.lines[0].glyphs;
  assert.equal(first.x, 0);
  assert.equal(first.advance, 12, "12000 units at 0.001 per unit");
  // 12 across, then 2 back for the AB kerning pair.
  assert.equal(second.kerning, -2);
  assert.equal(second.x, 10);
  assert.equal(layout.lines[0].width, 18, "10 to the B's origin plus its own 8 of advance");

  const unkerned = layoutText(pack, { font: 7, size: 20.48, text: "AB", kerning: false });
  assert.equal(unkerned.lines[0].glyphs[1].x, 12);
  assert.equal(unkerned.lines[0].glyphs[1].kerning, 0);
});

test("a space advances the pen and draws nothing, and that is not an approximation", () => {
  const pack = syntheticPack();
  const layout = layoutText(pack, { font: 7, size: 20.48, text: "A A" });
  assert.equal(layout.lines[0].glyphs.length, 3);
  assert.equal(layout.lines[0].glyphs[1].empty, true);
  assert.equal(layout.approximated.total, 0, "an empty glyph is a measurement, not a shortfall");
  const ops = textOpsFor(pack, { font: 7, size: 20.48, text: "A A" });
  assert.equal(ops.length, 2, "two boxes; the space contributes no operation");
  for (const op of ops) assert.ok(op.d.length > 0, "never emit a silently-empty path");
});

test("the line box comes from the font's own ascent, descent and leading", () => {
  const pack = syntheticPack();
  const metrics = lineMetricsFor(fontFor(pack, 7), 20.48);
  assert.equal(metrics.ascent, 16);
  assert.equal(metrics.descent, 4);
  assert.equal(metrics.leading, 1);
  assert.equal(metrics.lineHeight, 21);
  assert.equal(metrics.approximated, null);
});

test("A FONT WITH NO LAYOUT BLOCK CANNOT ANSWER FOR ITS LINE HEIGHT, and says so", () => {
  // ► Font 1510 in the real build is such a font. Substituting zero would stack
  //   every line on the one before it and nothing would report why.
  const pack = syntheticPack({ font: { hasLayout: false, ascent: null, descent: null, leading: null, kerning: null } });
  const metrics = lineMetricsFor(fontFor(pack, 7), 20);
  assert.equal(metrics.lineHeight, 20);
  assert.equal(metrics.approximated, "line-height-from-size");

  const layout = layoutText(pack, { font: 7, size: 20, text: "AB" });
  assert.equal(layout.approximated.byKind["line-height-from-size"], 1);
  assert.equal(layout.approximated.total, 1);
  // With no kerning table the pair must not be kerned, and must not throw.
  assert.equal(layout.lines[0].glyphs[1].kerning, 0);
});

/* ---------------------------------------------------------------- */
/* What could not be drawn exactly                                   */
/* ---------------------------------------------------------------- */

test("A MISSING GLYPH IS DRAWN AS A BOX, COUNTED, AND MARKED ON THE OPERATION", () => {
  // ► Emitting nothing would make "this character is not in the font" look
  //   exactly like a space. An approximation that is not counted is
  //   indistinguishable from a correct read, and this is that rule at the last
  //   seam before the canvas.
  const pack = syntheticPack();
  const layout = layoutText(pack, { font: 7, size: 20.48, text: "A中B" });
  assert.equal(layout.missing, 1);
  assert.equal(layout.approximated.byKind["glyph-missing"], 1);
  assert.equal(layout.lines[0].glyphs[1].missing, true);
  // The unknown character still advances, by the font's own space, so the rest
  // of the line does not slide left over it.
  assert.equal(layout.lines[0].glyphs[1].advance, 10);

  const ops = textOpsFor(pack, { font: 7, size: 20.48, text: "A中B" });
  const notdef = ops.filter((op) => op.notdef);
  assert.equal(notdef.length, 1);
  assert.equal(notdef[0].approximated, "glyph-missing");
  assert.equal(notdef[0].fill, null, "a hollow box, so it reads as a hole rather than a letter");
  assert.ok(notdef[0].strokeWidth > 0, "and it is actually visible");
  assert.equal(notdef[0].glyph.index, -1);
  assert.equal(notdef[0].glyph.char, "中");
  for (const op of ops) assert.ok(op.d.length > 0, "no operation may carry an empty path");
});

test("a glyph whose advance the pack derived carries that mark onto every operation", () => {
  // ► The real pack marks all 112 of font 1510's outline-derived advances. The
  //   mark has to survive the layout or a surface draws an approximation with
  //   nothing attached — which is precisely how the arena's walls went missing.
  const pack = syntheticPack({
    font: {
      hasLayout: false, ascent: null, descent: null, leading: null, kerning: null,
      glyphs: [
        { code: 32, char: " ", path: "", empty: true, failed: false, advance: 10000, ink: null, approximated: "advance-from-sibling-font" },
        { code: 65, char: "A", path: "M0 -10000L10000 -10000L10000 0L0 0Z", empty: false, failed: false, advance: 12000, ink: null, approximated: "advance-from-outline" }
      ]
    }
  });
  const layout = layoutText(pack, { font: 7, size: 20.48, text: "A A" });
  assert.equal(layout.approximated.byKind["advance-from-outline"], 2);
  assert.equal(layout.approximated.byKind["advance-from-sibling-font"], 1);
  const ops = textOpsFor(pack, { font: 7, size: 20.48, text: "A A" });
  for (const op of ops) assert.equal(op.approximated, "advance-from-outline");
});

/* ---------------------------------------------------------------- */
/* Wrapping and alignment                                            */
/* ---------------------------------------------------------------- */

test("word wrap breaks at spaces and never opens a line with the space that broke it", () => {
  // ► The first version carried the breaking space to the next line, where the
  //   trailing trim then emptied it — a blank line in the middle of a paragraph
  //   that has none.
  const pack = syntheticPack({ font: { glyphs: [
    { code: 32, char: " ", path: "", empty: true, failed: false, advance: 10000, ink: null },
    { code: 65, char: "A", path: "M0 -10000L10000 -10000L10000 0L0 0Z", empty: false, failed: false, advance: 10000, ink: null }
  ], kerning: [] } });
  const layout = layoutText(pack, { font: 7, size: 20.48, text: "AA AA AA", maxWidth: 25 });
  assert.deepEqual(layout.lines.map((line) => line.text), ["AA", "AA", "AA"]);
  for (const line of layout.lines) assert.ok(line.width <= 25, `line ${line.text} is ${line.width} wide`);
  // The lines step down by the font's own line box, not by the glyph height.
  assert.equal(layout.lines[1].y - layout.lines[0].y, layout.lineHeight);
});

test("a word wider than the box breaks mid-word rather than running past the edge", () => {
  const pack = syntheticPack({ font: { glyphs: [
    { code: 32, char: " ", path: "", empty: true, failed: false, advance: 10000, ink: null },
    { code: 65, char: "A", path: "M0 -10000L10000 -10000L10000 0L0 0Z", empty: false, failed: false, advance: 10000, ink: null }
  ], kerning: [] } });
  const layout = layoutText(pack, { font: 7, size: 20.48, text: "AAAA", maxWidth: 25 });
  assert.deepEqual(layout.lines.map((line) => line.text), ["AA", "AA"]);
});

test("an explicit line break splits a multiline field and is flattened in a single-line one", () => {
  const pack = syntheticPack();
  const multi = layoutText(pack, { font: 7, size: 20.48, text: "A\rB\nA\r\nB" });
  assert.equal(multi.lines.length, 4);
  assert.equal(multi.approximated.total, 0);

  const single = layoutText(pack, { font: 7, size: 20.48, text: "A\rB", multiline: false });
  assert.equal(single.lines.length, 1);
  assert.equal(single.lines[0].text, "A B", "the break becomes a space, so the words do not run together");
  assert.equal(single.approximated.byKind["newline-in-single-line-field"], 1);
});

test("a FIRST-LINE indent moves that line and narrows only its own wrap limit", () => {
  // ► Every one of this build's 256 fields sets indent to zero, so this is the
  //   only place the arm runs. It is implemented rather than dropped because the
  //   pack carries the number: a field whose indent quietly did nothing would be
  //   an approximation that nothing counted.
  const pack = syntheticPack({ font: { glyphs: [
    { code: 32, char: " ", path: "", empty: true, failed: false, advance: 10000, ink: null },
    { code: 65, char: "A", path: "M0 -10000L10000 -10000L10000 0L0 0Z", empty: false, failed: false, advance: 10000, ink: null }
  ], kerning: [] } });
  // Three 10-wide glyphs in a 30-wide box: exactly one line, with no indent.
  const plain = layoutText(pack, { font: 7, size: 20.48, text: "AAA", x: 0, maxWidth: 30 });
  assert.deepEqual(plain.lines.map((line) => line.text), ["AAA"]);
  assert.equal(plain.lines[0].x, 0);

  // Ten of indent leaves the first line twenty, so the third glyph wraps.
  const indented = layoutText(pack, { font: 7, size: 20.48, text: "AAA", x: 0, maxWidth: 30, indent: 10 });
  assert.deepEqual(indented.lines.map((line) => line.text), ["AA", "A"]);
  assert.equal(indented.lines[0].x, 10, "the first line starts in by the indent");
  assert.equal(indented.lines[1].x, 0, "and the second does not");

  // And it narrows the box the first line is aligned in, rather than sliding a
  // centred line off the right edge.
  const centred = layoutText(pack, { font: 7, size: 20.48, text: "A", x: 0, maxWidth: 100, indent: 20, align: "center" });
  assert.equal(centred.lines[0].x, 20 + (100 - 20 - 10) / 2);
});

test("alignment spends the slack inside maxWidth, and left is the default", () => {
  const pack = syntheticPack();
  const options = { font: 7, size: 20.48, text: "A", x: 0, maxWidth: 100 };
  // One 'A' is 12 wide: 88 of slack.
  assert.equal(layoutText(pack, options).lines[0].x, 0);
  assert.equal(layoutText(pack, { ...options, align: "center" }).lines[0].x, 44);
  assert.equal(layoutText(pack, { ...options, align: "right" }).lines[0].x, 88);
  // With no maxWidth there is no box to align in, so every alignment is left.
  assert.equal(layoutText(pack, { font: 7, size: 20.48, text: "A", align: "right" }).lines[0].x, 0);
});

/* ---------------------------------------------------------------- */
/* Fields                                                            */
/* ---------------------------------------------------------------- */

test("a field's box, size and margins are read in TWIPS and laid out in pixels", () => {
  const pack = syntheticPack({
    fields: {
      5: {
        id: 5, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 },
        font: 7, fontHeight: 409.6, colour: "#00ff00", alpha: 1, align: "left",
        leftMargin: 20, rightMargin: 0, indent: 0, leading: 40,
        multiline: true, wordWrap: true, password: false, border: false,
        readOnly: true, html: false, maxLength: null, variable: "x", text: "A"
      }
    }
  });
  const options = fieldLayoutOptionsFor(pack, 5);
  assert.equal(options.size, 20.48, "409.6 twips is a 20.48px em");
  assert.equal(options.x, FIELD_GUTTER_PX + 1, "the 2px gutter plus a 20-twip left margin");
  assert.equal(options.y, FIELD_GUTTER_PX + 16, "the gutter, then down by the font's 16px ascent");
  assert.equal(options.maxWidth, 200 - FIELD_GUTTER_PX * 2 - 1, "the box less both gutters and the margin");
  assert.equal(options.indent, 0, "twips to pixels, and every field in the build declares zero");
  assert.equal(options.lineHeight, 21 + 2, "the font's line box plus the field's own 40 twips of leading");
  assert.equal(options.colour, "#00ff00");
  assert.equal(options.text, "A", "the field's own initial text when the caller supplies none");

  const overridden = fieldLayoutOptionsFor(pack, 5, { text: "AB" });
  assert.equal(overridden.text, "AB");
  const wider = fieldLayoutOptionsFor(pack, 5, { gutter: 0 });
  assert.equal(wider.x, 1, "the gutter is an option, because nothing here has measured it against the player");
});

test("a field renders inside its own box, and a password field renders bullets", () => {
  const pack = syntheticPack({
    fields: {
      5: {
        id: 5, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 },
        font: 7, fontHeight: 409.6, colour: "#00ff00", alpha: 1, align: "left",
        leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
        multiline: false, wordWrap: false, password: true, border: false,
        readOnly: false, html: false, maxLength: null, variable: "pw", text: "AB"
      }
    }
  });
  // ► The build has ZERO password fields, so this branch is exercised here and
  //   by nothing else. Said out loud: untested code that looks tested is this
  //   project's house defect, and a future password field rendered in clear
  //   would be a real one.
  const options = fieldLayoutOptionsFor(pack, 5);
  assert.equal(options.mask, true);
  const layout = layoutText(pack, options);
  assert.equal(layout.lines[0].text, "••", "two bullets, not the two letters");
  assert.equal(layout.missing, 2, "and this synthetic font has no bullet glyph, so both are counted");
  const ops = fieldOpsFor(pack, 5);
  assert.equal(ops.length, 2);
  for (const op of ops) assert.equal(op.notdef, true);
});

test("an HTML field carries its approximation onto every operation it draws", () => {
  const pack = syntheticPack({
    fields: {
      5: {
        id: 5, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 },
        font: 7, fontHeight: 409.6, colour: "#ffffff", alpha: 1, align: "left",
        leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
        multiline: false, wordWrap: false, password: false, border: false,
        readOnly: true, html: true, maxLength: null, variable: "v",
        text: "AB", markup: "<b>AB</b>", approximated: "html-markup-stripped"
      }
    }
  });
  const ops = fieldOpsFor(pack, 5);
  assert.equal(ops.length, 2);
  for (const op of ops) assert.equal(op.approximated, "html-markup-stripped");
});

test("an outer matrix composes on the outside, with its translation still in twips", () => {
  const pack = syntheticPack();
  const ops = textOpsFor(pack, { font: 7, size: 20.48, text: "A", x: 1, y: 2, matrix: [2, 0, 0, 2, 100, 200] });
  // The pen is 1px, 2px = 20, 40 twips; doubled and offset by the placement.
  assert.deepEqual(ops[0].matrix, [2, 0, 0, 2, 140, 280]);
  assert.equal(ops[0].d, "M0 -10L10 -10L10 0L0 0Z", "the path is untouched; the matrix does the placing");
});

test("fieldsPlacedIn answers from the pack rather than from a table of ids in the module", () => {
  const pack = syntheticPack({
    fields: { 11: { id: 11 }, 12: { id: 12 } },
    statics: { 13: { id: 13 } },
    placements: {
      11: [{ owner: 1531, frame: 1, depth: 5, name: "soundvar", matrix: [1, 0, 0, 1, 20, 40] }],
      12: [{ owner: 1531, frame: 1, depth: 6, name: "tips", matrix: null }],
      13: [{ owner: null, frame: 221, depth: 9, name: null, matrix: null }]
    }
  });
  const inBar = fieldsPlacedIn(pack, 1531);
  assert.deepEqual(inBar.map((entry) => entry.id), [11, 12]);
  assert.equal(inBar[0].name, "soundvar");
  assert.equal(inBar[0].kind, "field");
  assert.deepEqual(inBar[0].matrix, [1, 0, 0, 1, 20, 40]);
  assert.deepEqual(fieldsPlacedIn(pack, 999), []);
});

/* ---------------------------------------------------------------- */
/* Static runs                                                       */
/* ---------------------------------------------------------------- */

test("a static run uses its OWN baked advances and continues a record with no offset", () => {
  // ► 26 of the build's 206 records inherit their font and carry no x offset.
  //   Treating a null offset as zero restarts every continuation at the left
  //   edge, which looks like a layout bug rather than a reading one.
  const pack = syntheticPack({
    statics: {
      3: {
        id: 3, bounds: { xMin: 0, xMax: 2000, yMin: 0, yMax: 500 }, matrix: [1, 0, 0, 1, 0, 0],
        text: "AAA", unresolved: 0,
        records: [
          { font: 7, fontInherited: false, height: 409.6, colour: "#ffffff", alpha: 1, x: 100, y: 200, glyphs: [[1, 300]] },
          { font: 7, fontInherited: true, height: 409.6, colour: "#ffffff", alpha: 1, x: null, y: null, glyphs: [[1, 300], [1, 300]] }
        ]
      }
    }
  });
  const ops = staticTextOpsFor(pack, 3);
  assert.equal(ops.length, 3);
  // Twips, straight from the record: 100, then +300 per baked advance.
  assert.deepEqual(ops.map((op) => op.matrix[4]), [100, 400, 700]);
  assert.deepEqual(ops.map((op) => op.matrix[5]), [200, 200, 200]);
  // 409.6 twips of height is a 20.48px em, so the box is ten pixels again.
  assert.equal(ops[0].d, "M0 -10L10 -10L10 0L0 0Z");
  assert.equal(ops[0].fill, "#ffffff");
  assert.equal(staticTextOpsFor(pack, 99), null);
});

test("a static run whose glyph index the font cannot answer for draws a box, not nothing", () => {
  const pack = syntheticPack({
    statics: {
      3: {
        id: 3, bounds: { xMin: 0, xMax: 2000, yMin: 0, yMax: 500 }, matrix: [1, 0, 0, 1, 0, 0],
        text: "?", unresolved: 1,
        records: [{ font: 7, fontInherited: false, height: 409.6, colour: "#ffffff", alpha: 1, x: 0, y: 0, glyphs: [[99, 300]] }]
      }
    }
  });
  const ops = staticTextOpsFor(pack, 3);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].approximated, "glyph-missing");
  assert.ok(ops[0].d.length > 0, "a box, drawn, rather than a silent gap in the sentence");
});

/* ---------------------------------------------------------------- */
/* Against the pack this machine has actually extracted              */
/* ---------------------------------------------------------------- */

const PACK_PATH = path.join(REPO_ROOT, "assets", "text", "text.json");
const havePack = fs.existsSync(PACK_PATH);
const skip = havePack ? false : "no extracted text pack on this machine";

/** The extracted pack, parsed fresh per test. */
function realPack() {
  return textPackFrom(JSON.parse(fs.readFileSync(PACK_PATH, "utf8")));
}

test("every glyph in the build uses only M, L, Q and Z — which is what makes scaling safe", { skip }, () => {
  // ► `scaleGlyphPath` substitutes every number in the string. That is safe only
  //   because this grammar has no arc flags, no exponents and no repeat counts —
  //   every number is a coordinate. Re-derived here over all 1027 glyphs rather
  //   than asserted in a comment.
  const pack = realPack();
  let glyphs = 0;
  let coordinates = 0;
  for (const font of Object.values(pack.fonts)) {
    for (const glyph of font.glyphs) {
      glyphs += 1;
      if (!glyph.path) {
        assert.ok(glyph.empty || glyph.failed, `font ${font.id} glyph ${glyph.code} has no path and no reason`);
        continue;
      }
      const commands = glyph.path.replace(/-?\d+(?:\.\d+)?/g, "").replace(/\s+/g, "");
      assert.match(commands, /^[MLQZ]+$/, `font ${font.id} glyph ${glyph.code} uses ${commands.slice(0, 20)}`);
      coordinates += (glyph.path.match(/-?\d+(?:\.\d+)?/g) ?? []).length;
    }
  }
  assert.equal(glyphs, 1027);
  assert.ok(coordinates > 100000, `only ${coordinates} coordinates — the pack looks truncated`);
});

test("A GLYPH FILLS UNDER NONZERO because its counters wind the other way", { skip }, () => {
  // ► Re-derived, not relayed: Mini 7's 'o' is an outer loop and a hole, and the
  //   two signed areas must have opposite signs or the hole fills in.
  const pack = realPack();
  const glyph = pack.fonts[1523].glyphs.find((entry) => entry.char === "o");
  const loops = glyph.path.split("Z").filter((piece) => piece.length > 0);
  assert.equal(loops.length, 2, "an 'o' is two contours");
  const areas = loops.map((loop) => {
    const numbers = (loop.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    let area = 0;
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      const next = (index + 2) % numbers.length;
      area += numbers[index] * numbers[next + 1] - numbers[next] * numbers[index + 1];
    }
    return area / 2;
  });
  assert.ok(areas[0] * areas[1] < 0, `the two loops wind the same way: ${JSON.stringify(areas)}`);

  const ops = textOpsFor(pack, { font: 1523, size: 20, text: "o" });
  assert.equal(ops[0].fillRule, "nonzero");
});

test("THE BUILD'S OWN BOUNDS AGREE WITH WHERE THIS MODULE DRAWS EVERY STATIC RUN", { skip }, () => {
  // ► The independent check. Each DefineText carries a bounds RECT the Flash
  //   exporter wrote and nothing in this pipeline derives; laying the run out
  //   from its glyph indices and asking whether the ink lands inside it is a
  //   second opinion rather than a restatement.
  const pack = realPack();
  const raw = JSON.parse(fs.readFileSync(PACK_PATH, "utf8"));
  let drawn = 0;
  let inside = 0;
  let blank = 0;
  let worstLeft = 0;
  const offenders = [];
  for (const [id, item] of Object.entries(raw.statics)) {
    const ops = staticTextOpsFor(pack, id);
    if (!ops) { blank += 1; continue; }
    drawn += 1;
    const ink = inkOfOps(ops);
    const box = {
      xMin: item.bounds.xMin / TWIPS_PER_PIXEL, xMax: item.bounds.xMax / TWIPS_PER_PIXEL,
      yMin: item.bounds.yMin / TWIPS_PER_PIXEL, yMax: item.bounds.yMax / TWIPS_PER_PIXEL
    };
    const overflow = Math.max(box.xMin - ink.xMin, ink.xMax - box.xMax, box.yMin - ink.yMin, ink.yMax - box.yMax);
    if (overflow <= 1) inside += 1;
    else offenders.push(`${id} ${JSON.stringify(item.text.slice(0, 12))} overflows by ${overflow.toFixed(2)}px`);
    worstLeft = Math.max(worstLeft, Math.abs(ink.xMin - box.xMin));
  }
  assert.equal(drawn, 179);
  assert.equal(blank, 1, "static 1511 is a single space and draws nothing, which is correct");
  assert.deepEqual(offenders, [], "a run drawn outside the box the exporter measured for it");
  assert.equal(inside, drawn);
  assert.ok(worstLeft < 1, `the worst left-edge disagreement is ${worstLeft.toFixed(3)}px`);
});

test("the arena's UI bar can be drawn: two fields, their text, and where they sit", { skip }, () => {
  // ► This is the thing that was missing. `arena-backdrop.js` claims the
  //   renderer draws the bar's live text; nothing did, and `extract-props.mjs`
  //   honestly reported both children as unsupported and dropped them.
  const pack = realPack();
  const inBar = fieldsPlacedIn(pack, 1531);
  assert.deepEqual(inBar.map((entry) => entry.id), [1527, 1528]);

  const ops = fieldOpsFor(pack, 1527, { matrix: inBar[0].matrix });
  assert.ok(Array.isArray(ops) && ops.length >= 8, `"sound:ON" is eight drawable glyphs, got ${ops?.length}`);
  for (const op of ops) {
    assert.equal(op.fill, "#ffffff", "the field's own colour, read from its tag");
    assert.ok(op.d.length > 0, "no operation may carry an empty path");
    assert.equal(op.approximated, undefined, "nothing about this field is approximated");
  }
  // The bar is placed at stage (-0.5, 401) and the field 91px into it, so the
  // text lands on the bar rather than somewhere off the stage.
  const ink = inkOfOps(ops);
  assert.ok(ink.xMin > 90 && ink.xMax < 160, `x ${ink.xMin.toFixed(1)}..${ink.xMax.toFixed(1)}`);
  assert.ok(ink.yMin > 0 && ink.yMax < 20, `y ${ink.yMin.toFixed(1)}..${ink.yMax.toFixed(1)}`);
});

test("a string the game never baked still lays out, in the game's own font", { skip }, () => {
  // The point of the pack: not only redrawing the 180 runs the build shipped,
  // but drawing THIS renderer's own numbers in the build's type.
  const pack = realPack();
  const layout = layoutText(pack, { font: 1526, size: 10, text: "HEALTH 120/140", x: 0, y: 0 });
  assert.equal(layout.missing, 0, "every character of a health readout is in Mini 7");
  assert.equal(layout.approximated.total, 0);
  assert.ok(layout.width > 60 && layout.width < 140, `measured ${layout.width.toFixed(1)}px at a 10px em`);
  const ops = textOpsFor(pack, { font: 1526, size: 10, text: "HEALTH 120/140", colour: "#ffcc00" });
  assert.equal(ops.length, 13, "fourteen characters less the one space");
  for (const op of ops) assert.equal(op.fill, "#ffcc00");
});
