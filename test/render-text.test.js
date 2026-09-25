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
  approximationMarksOf,
  fieldLayoutOptionsFor,
  fieldOpsFor,
  fieldTextFor,
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
  assert.deepEqual(notdef[0].approximated, ["glyph-missing"],
    "a LIST of reasons, even when there is one of them — see `marksOf` in text.js");
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
  for (const op of ops) assert.deepEqual(op.approximated, ["advance-from-outline"]);
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

test("A FIELD THAT DOES NOT WRAP IS STILL ALIGNED IN ITS OWN BOX", () => {
  // ► **THE NO-OP.** `fieldLayoutOptionsFor` gives a non-wrapping field
  //   `maxWidth: Infinity`, and `layoutText` used to align inside
  //   `Number.isFinite(maxWidth) ? maxWidth : widest` — the widest LINE, so the
  //   slack was zero and `center` and `right` landed exactly where `left` does.
  //   Re-derived from `assets/text/text.json` on 2026-09-14: 108 of the build's
  //   256 fields (81 of the 101 centred, 27 of the 30 right) do not set both
  //   `wordWrap` and `multiline` and were aligned by nothing at all.
  //
  //   The numbers here are checkable in the head. The box is 4000 twips = 200px,
  //   the gutter takes 2 off each side, so the inner box is 196. One 'A' is
  //   12000 glyph units at a 20.48px em = 12px. Left puts the pen at the gutter,
  //   2; centre at 2 + (196 - 12) / 2 = 94; right at 2 + 184 = 186. An emitted
  //   matrix translates in TWIPS, so those are 40, 1880 and 3720.
  const fieldWith = (align) => ({
    5: {
      id: 5, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 },
      font: 7, fontHeight: 409.6, colour: "#ffffff", alpha: 1, align,
      leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
      multiline: false, wordWrap: false, password: false, border: false,
      readOnly: true, html: false, maxLength: null, variable: "v", text: "A"
    }
  });
  const penTwipsFor = (align) => {
    const pack = syntheticPack({ fields: fieldWith(align) });
    const options = fieldLayoutOptionsFor(pack, 5);
    // The wrap width is still infinite — this field must never break a line —
    // and the ALIGN width is the box. Two jobs, two numbers.
    assert.equal(options.maxWidth, Infinity, `${align}: a non-wrapping field must still never wrap`);
    assert.equal(options.alignWidth, 196, `${align}: the box less both gutters`);
    const ops = fieldOpsFor(pack, 5);
    assert.equal(ops.length, 1);
    return ops[0].matrix[4];
  };
  assert.equal(penTwipsFor("left"), 40);
  assert.equal(penTwipsFor("center"), 1880);
  assert.equal(penTwipsFor("right"), 3720);
});

test("a field that DOES wrap aligns in the same box it breaks at", () => {
  // The other half of the split: when the two widths coincide, nothing changed.
  // Four 'A's at 12px in a 46px inner box break 3 + 1, and each line is centred
  // in 46 — the first by (46 - 36) / 2 = 5, the second by (46 - 12) / 2 = 17,
  // both offset by the 2px gutter.
  const pack = syntheticPack({
    fields: {
      5: {
        id: 5, bounds: { xMin: 0, xMax: 1000, yMin: 0, yMax: 2000 },
        font: 7, fontHeight: 409.6, colour: "#ffffff", alpha: 1, align: "center",
        leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
        multiline: true, wordWrap: true, password: false, border: false,
        readOnly: true, html: false, maxLength: null, variable: "v", text: "AAAA"
      }
    }
  });
  const options = fieldLayoutOptionsFor(pack, 5);
  assert.equal(options.maxWidth, 46);
  assert.equal(options.alignWidth, 46, "the same number by two names, which is the case that always worked");
  const layout = layoutText(pack, options);
  assert.deepEqual(layout.lines.map((line) => line.text), ["AAA", "A"]);
  assert.deepEqual(layout.lines.map((line) => line.x), [2 + 5, 2 + 17]);
  assert.equal(layout.overflowing, 0);
});

test("A LINE WIDER THAN ITS BOX KEEPS THE NEGATIVE SLACK, and the choice is counted", () => {
  // ► **AN ASSUMPTION, PINNED SO THAT CHANGING IT IS A DECISION.** Once a
  //   non-wrapping field is aligned in its own box, its line can be wider than
  //   that box, and `DefineEditText` carries an align field and no overflow
  //   rule — nothing in the bytes settles what the player does, and the oracle
  //   is read-only on this route. Taken as: centre means centre, so an
  //   over-long line spills at both ends. The alternative is `Math.max(0, …)`
  //   on the slack, which would make an overflowing line left-aligned.
  //   Measured over the real pack with its own placeholder text: 0 of 272 lines
  //   overflow, so nothing but this test exercises the arm — which is exactly
  //   why it is here rather than left to a screenshot nobody has taken.
  const pack = syntheticPack({
    fields: {
      5: {
        id: 5, bounds: { xMin: 0, xMax: 800, yMin: 0, yMax: 1000 },
        font: 7, fontHeight: 409.6, colour: "#ffffff", alpha: 1, align: "center",
        leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
        multiline: false, wordWrap: false, password: false, border: false,
        readOnly: true, html: false, maxLength: null, variable: "v", text: "AAA"
      }
    }
  });
  // A 40px box, 36 of it inner; three 'A's are 36 wide... so make them overflow
  // by asking for four: 48 in a 36 box, 12 over, 6 of it off each end.
  const options = fieldLayoutOptionsFor(pack, 5, { text: "AAAA" });
  assert.equal(options.alignWidth, 36);
  const layout = layoutText(pack, options);
  assert.equal(layout.lines.length, 1, "it does not wrap: that is what makes overflow possible");
  assert.equal(layout.lines[0].width, 48);
  assert.equal(layout.lines[0].x, 2 + (36 - 48) / 2, "the pen starts 4px LEFT of the field's own left edge");
  assert.equal(layout.overflowing, 1, "► and the count says the assumption was reached");
  assert.equal(layout.box, 36);
});

test("A CENTRED FIELD'S MARGINS COME OFF THE ALIGNMENT BOX, not just the wrap width", () => {
  // ► **THE HALF OF `alignWidth: inner` THAT NOTHING COULD FALSIFY.** `inner` is
  //   `width - gutter * 2 - leftMargin - rightMargin`, and an adversarial
  //   verifier measured on 2026-09-14 that replacing it with
  //   `Math.max(0, width - gutter * 2)` — a different alignment box for any
  //   field with margins — left the whole 1712-test suite green. It could,
  //   because all 256 fields in the build declare both margins zero and every
  //   synthetic field in this file set them to zero as well; the one test that
  //   used a margin asserted `maxWidth` and never `alignWidth`. So the margin
  //   term was evidence-free in BOTH directions: no input could falsify it and
  //   no assertion pinned it.
  //
  //   Checkable in the head. The box is 4000 twips = 200 px, the gutter takes 2
  //   off each side, a 40-twip left margin takes 2 more and a 60-twip right
  //   margin 3, so the alignment box is 200 - 4 - 2 - 3 = 191 and the pen
  //   origin is 0 + 2 + 2 = 4. One 'A' advances 12 px. Centred:
  //   4 + (191 - 12) / 2 = 93.5 px = 1870 twips. Right: 4 + 179 = 183 px =
  //   3660 twips. Under the margin-free box of 196 the same two numbers would
  //   be 96 px and 188 px — 1920 and 3760 twips — so this test is exactly the
  //   mutation the verifier ran, pinned by value.
  const fieldWith = (align) => ({
    5: {
      id: 5, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 },
      font: 7, fontHeight: 409.6, colour: "#ffffff", alpha: 1, align,
      leftMargin: 40, rightMargin: 60, indent: 0, leading: 0,
      multiline: false, wordWrap: false, password: false, border: false,
      readOnly: true, html: false, maxLength: null, variable: "v", text: "A"
    }
  });
  for (const align of ["left", "center", "right"]) {
    const options = fieldLayoutOptionsFor(syntheticPack({ fields: fieldWith(align) }), 5);
    assert.equal(options.alignWidth, 191, `${align}: both gutters AND both margins come off the box`);
    assert.notEqual(options.alignWidth, 200 - FIELD_GUTTER_PX * 2,
      `${align}: ► the margin-free box is a DIFFERENT number, which is what makes this assertion worth making`);
    assert.equal(options.x, 4, `${align}: the pen origin is the gutter plus the LEFT margin only`);
    assert.equal(options.maxWidth, Infinity, `${align}: and it still must never wrap`);
  }

  const penTwipsFor = (align) => {
    const pack = syntheticPack({ fields: fieldWith(align) });
    const ops = fieldOpsFor(pack, 5);
    assert.equal(ops.length, 1);
    return ops[0].matrix[4];
  };
  assert.equal(penTwipsFor("left"), 80, "the gutter plus the left margin, in twips");
  assert.equal(penTwipsFor("center"), 1870, "► 1920 if the right margin is not taken off the box");
  assert.equal(penTwipsFor("right"), 3660, "► 3760 if the right margin is not taken off the box");

  // An independent statement of the same claim: a right-aligned line's far edge
  // is the far edge of the alignment box, which is the field's own right edge
  // less the gutter and the right margin — 200 - 2 - 3 = 195. Derived from the
  // field's tag, not from the numbers above.
  const pack = syntheticPack({ fields: fieldWith("right") });
  const options = fieldLayoutOptionsFor(pack, 5);
  const line = layoutText(pack, options).lines[0];
  assert.equal(line.x + line.width, 195);
  assert.equal(line.x + line.width, options.x + options.alignWidth);
});

test("fieldTextFor HANDS BACK THE INVOICE fieldOpsFor cannot carry, off one layout pass", () => {
  // ► **AN ARRAY CANNOT CARRY A COUNT.** `layoutText` reports `overflowing` —
  //   how many lines came out wider than the box they were aligned in, which is
  //   a condition that did not EXIST until a non-wrapping field started being
  //   aligned in its own box. Every caller on the screen route reached the ops
  //   through `fieldOpsFor`, which returns an array and dropped the number, so
  //   the one thing the alignment fix newly made possible was the one thing
  //   nothing downstream could count.
  const pack = syntheticPack({
    fields: {
      5: {
        id: 5, bounds: { xMin: 0, xMax: 800, yMin: 0, yMax: 1000 },
        font: 7, fontHeight: 409.6, colour: "#ffffff", alpha: 1, align: "center",
        leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
        multiline: false, wordWrap: false, password: false, border: false,
        readOnly: true, html: false, maxLength: null, variable: "v", text: "A"
      }
    }
  });
  // The placeholder fits: one 'A' is 12px in a 36px box.
  const fits = fieldTextFor(pack, 5);
  assert.equal(fits.overflowing, 0, "► a zero that an input can move, which is what makes the 1 below evidence");
  assert.equal(fits.box, 36);
  assert.equal(fits.lines, 1);
  assert.equal(fits.width, 12);

  // A bound value four glyphs long is 48px in the same 36px box.
  const spills = fieldTextFor(pack, 5, { text: "AAAA" });
  assert.equal(spills.overflowing, 1, "► the line is wider than the box it was centred in");
  assert.equal(spills.width, 48);
  assert.ok(spills.width > spills.box, "which is what overflowing MEANS, derived a second way");
  assert.equal(spills.ops[0].matrix[4], (2 + (36 - 48) / 2) * TWIPS_PER_PIXEL,
    "and the pen really is left of the field's own left edge");

  // The shallow view is the same operations and nothing else — so a caller that
  // does not want the invoice pays nothing, and a caller that does is not
  // laying the field out twice to get it.
  assert.deepEqual(fieldOpsFor(pack, 5, { text: "AAAA" }), spills.ops);
  assert.equal(fieldOpsFor(pack, 5, { text: "AAAA" }).length, 4);

  // The one place the two disagree, stated rather than left to be discovered: a
  // field that lays out and inks nothing is an ANSWER here and an absence there.
  const blank = fieldTextFor(pack, 5, { text: "   " });
  assert.deepEqual(blank.ops, [], "three spaces advance and draw nothing");
  assert.equal(blank.overflowing, 0);
  assert.equal(fieldOpsFor(pack, 5, { text: "   " }), null);
  // And both are total on rubbish, the way every reader in this module is.
  assert.equal(fieldTextFor(pack, 999), null);
  assert.equal(fieldTextFor(null, 5), null);
});

test("approximationMarksOf IS THE ONE READER, because this tree emits BOTH shapes under that key", () => {
  // ► **ONE KEY, TWO TYPES, IN ONE ARRAY.** `text.js` puts a frozen LIST on an
  //   operation; `emitDrawable` in `src/render/screen.js` and `emitPropOps`
  //   in `src/render/props.js` copy
  //   the extractor's STRING through untouched, and `screenWithTextFor` merges
  //   both into one paint order — measured 2026-09-14 over the 26 screens: 274
  //   marked operations, 209 strings and 65 lists. Whichever shape a reader
  //   guesses, it is silently wrong about the other half of the same array, and
  //   a silent wrong count is this project's most expensive defect. So there is
  //   one reader and it takes both.
  assert.deepEqual(approximationMarksOf("gradient"), ["gradient"], "the shape screen.js and props.js emit");
  assert.deepEqual(approximationMarksOf(["html-markup-stripped"]), ["html-markup-stripped"], "the shape text.js emits");
  assert.deepEqual(approximationMarksOf(["glyph-missing", "html-markup-stripped"]), ["glyph-missing", "html-markup-stripped"],
    "order is precedence, most specific first");
  assert.deepEqual(approximationMarksOf(["a", "a"]), ["a"], "a field and its glyph naming the same kind is ONE reason");
  // Total on everything else: a hand-edited pack must not be able to put a
  // number or an object into a tally, and an absent key is no marks, not a throw.
  for (const rubbish of [undefined, null, 0, 42, "", {}, [], [1, {}, null], true]) {
    assert.deepEqual(approximationMarksOf(rubbish), [], `approximationMarksOf(${JSON.stringify(rubbish) ?? "undefined"})`);
  }
  assert.equal(Object.isFrozen(approximationMarksOf("gradient")), true);
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
  for (const op of ops) assert.deepEqual(op.approximated, ["html-markup-stripped"]);
});

test("TWO REASONS ON ONE OPERATION, AND NEITHER OF THEM IS LOST", () => {
  // ► **THE DEFECT THIS REPLACES.** `fieldOpsFor` used to stamp
  //   `approximated: op.approximated ?? field.approximated`, so a hollow
  //   `.notdef` box inside one of the build's five HTML fields kept
  //   `glyph-missing` and dropped `html-markup-stripped` on the floor. An
  //   approximation that overwrites another approximation is the same defect as
  //   one that is never counted, wearing a hat. `src/render/screen-text.js`
  //   found it from the outside, could not fix it, and named this as the cause.
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
  // "中" is not in the synthetic font, so this field draws one real glyph and
  // one box: the collision, in two operations.
  const ops = fieldOpsFor(pack, 5, { text: "A中" });
  assert.equal(ops.length, 2);
  assert.deepEqual(ops[0].approximated, ["html-markup-stripped"], "the letter carries the field's reason");
  assert.deepEqual(ops[1].approximated, ["glyph-missing", "html-markup-stripped"],
    "► and the BOX carries both — its own reason first, then the field's");
  assert.equal(ops[1].notdef, true);
  // ORDER IS PRECEDENCE: `marks[0]` is what the old single slot held, so a
  // reader that only looks at the first reason sees what it always saw.
  assert.equal(ops[1].approximated[0], "glyph-missing");
});

test("a field and its glyph naming the SAME reason is one reason, not two", () => {
  // A count of "how many kinds is this operation approximate in" must not go up
  // because two levels agreed. `screenTextFor` counts one operation once per
  // kind, and a duplicate here would show up there as a doubled ops count.
  const pack = syntheticPack({
    font: { glyphs: [
      { code: 65, char: "A", path: "M0 -10000L10000 -10000L10000 0L0 0Z", empty: false, failed: false, advance: 12000, ink: null, approximated: "html-markup-stripped" }
    ], kerning: [] },
    fields: {
      5: {
        id: 5, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 },
        font: 7, fontHeight: 409.6, colour: "#ffffff", alpha: 1, align: "left",
        leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
        multiline: false, wordWrap: false, password: false, border: false,
        readOnly: true, html: true, maxLength: null, variable: "v",
        text: "A", approximated: "html-markup-stripped"
      }
    }
  });
  assert.deepEqual(fieldOpsFor(pack, 5)[0].approximated, ["html-markup-stripped"]);
});

test("a STATIC RUN's own approximation reaches its operations, which it never used to", () => {
  // ► **UNEXERCISED BY THE REAL PACK AND SAID SO OUT LOUD: 0 of the build's 180
  //   statics carry `approximated`.** `tools/extract-text.mjs` tallies the field
  //   on a static (`for (const item of statics) if (item.approximated)`), so the
  //   shape is the extractor's and not this test's invention — and before this
  //   change the mark would have reached no operation at all, which is the same
  //   hole `fieldOpsFor` had. Synthetic, because untested code that looks tested
  //   is this project's house defect.
  const pack = syntheticPack({
    statics: {
      3: {
        id: 3, bounds: { xMin: 0, xMax: 2000, yMin: 0, yMax: 500 }, matrix: [1, 0, 0, 1, 0, 0],
        text: "A?", unresolved: 1, approximated: "text-from-glyph-table",
        records: [{
          font: 7, fontInherited: false, height: 409.6, colour: "#ffffff", alpha: 1, x: 0, y: 0,
          glyphs: [[1, 240], [99, 300]]
        }]
      }
    }
  });
  const ops = staticTextOpsFor(pack, 3);
  assert.equal(ops.length, 2);
  assert.deepEqual(ops[0].approximated, ["text-from-glyph-table"], "the drawn letter carries the run's reason");
  assert.deepEqual(ops[1].approximated, ["glyph-missing", "text-from-glyph-table"], "and the box carries both");
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
  assert.deepEqual(ops[0].approximated, ["glyph-missing"]);
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

test("THE REAL-PACK HALF OF THIS FILE IS ANCHORED: a broken path FAILS here rather than skipping seven tests", () => {
  // ► **AN `fs.existsSync` GUARD ON ITS OWN CANNOT TELL "no licensed copy here"
  //   FROM "REPO_ROOT IS WRONG".** Seven tests below are gated on `havePack`,
  //   and if the derivation of `PACK_PATH` ever breaks they do not fail — they
  //   quietly skip, and a skip reads as a clone with no game rather than as a
  //   defect. This project has already paid for that exact shape once, in
  //   `test/extraction-honesty.test.js`, which ran `assert.equal(null, null)`
  //   and reported a pass. So the ANCHOR is a TRACKED file on the same derived
  //   root: if `tools/extract-text.mjs` is not where `REPO_ROOT` says it is,
  //   the root is wrong, and this test fails by name instead of seven others
  //   going quiet. Measured by mutation 2026-09-14: pointing `REPO_ROOT` one
  //   directory too deep turns this red and the other seven to `skipped`, which
  //   is precisely the difference between a finding and a shrug.
  const anchorAt = path.join(REPO_ROOT, "tools", "extract-text.mjs");
  assert.ok(fs.existsSync(anchorAt),
    `${anchorAt} is not there, so REPO_ROOT is wrong and the absence of ${PACK_PATH} would mean nothing`);
  assert.equal(skip === false, havePack,
    `the seven real-pack tests below run exactly when ${PACK_PATH} is present, and that is the ONLY reason they may skip`);
});

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

test("THE BUILD'S OWN CENTRED FIELD LANDS IN THE MIDDLE OF ITS BOX, NOT AT ITS LEFT EDGE", { skip }, () => {
  // ► **FIELD 1619 IS THE ONE THE SCREEN VIEWER CAUGHT.** It is `createchar`'s
  //   strength readout: `align: "center"`, `wordWrap: false`, `multiline:
  //   false`, and it drew on top of its own label because alignment had no box
  //   to spend. Every number below comes out of the field's own tag:
  //
  //     bounds  -40..899 twips  ->  -2..44.95 px, a 46.95 px box
  //     inner   46.95 - 2 * 2   ->  42.95 px once both gutters are off
  //     "6"     11100 units at a 14px em (280 twips) -> 7.588 px
  //     centred (42.95 - 7.588) / 2 = 17.681 px from the left of the inner box
  //
  //   The pen was at 0 in the field's own space and is now at 17.681, which an
  //   emitted matrix carries in TWIPS: 353.621. In stage space, with the
  //   placement `createchar` gives it (tx 1285 twips = 64.25 px), the digit's
  //   INK moves from 64.65 px to 82.33 — clear of the label that ends at 72.
  const pack = realPack();
  const field = pack.fields[1619];
  assert.equal(field.align, "center", "the tag says centre, and that is what makes this a defect rather than a taste");
  assert.equal(field.wordWrap, false);
  assert.equal(field.multiline, false);

  const options = fieldLayoutOptionsFor(pack, 1619);
  assert.equal(options.maxWidth, Infinity, "it must still never wrap");
  assert.equal(options.alignWidth, 42.95);
  const ops = fieldOpsFor(pack, 1619);
  assert.equal(ops.length, 1, "one digit");
  assert.equal(ops[0].matrix[4], 353.621, "the pen, in twips — 0 before this was fixed");
  assert.ok(ops[0].matrix[4] > 0, "and not the left edge, which is where every centred field used to draw");

  // A field-space claim needs a stage-space check or it is just arithmetic
  // about itself: the ink, pushed through the field box the way the screen
  // places it, must sit inside the right half of that box.
  const ink = inkOfOps(ops);
  assert.ok(ink.xMin > 17 && ink.xMax < 26, `ink at ${ink.xMin.toFixed(2)}..${ink.xMax.toFixed(2)} in the field's own space`);
});

test("EVERY CENTRED AND RIGHT-ALIGNED FIELD IN THE BUILD NOW SPENDS ITS SLACK", { skip }, () => {
  // ► The census behind the 108. Re-derived here from the pack rather than
  //   quoted: a field is affected when it declares centre or right AND does not
  //   set both `wordWrap` and `multiline`, and the check is that each one now
  //   draws its first glyph somewhere other than the left gutter — unless its
  //   text fills the box exactly, which none of them does.
  const pack = realPack();
  let centre = 0;
  let right = 0;
  let left = 0;
  let affectedCentre = 0;
  let affectedRight = 0;
  let affected = 0;
  let movedOffTheLeftEdge = 0;
  let drew = 0;
  let margins = 0;
  for (const [id, field] of Object.entries(pack.fields)) {
    if (field.align === "center") centre += 1;
    if (field.align === "right") right += 1;
    if (field.align === "left") left += 1;
    if ((field.leftMargin ?? 0) !== 0 || (field.rightMargin ?? 0) !== 0) margins += 1;
    const aligned = field.align === "center" || field.align === "right";
    if (!aligned || (field.wordWrap && field.multiline)) continue;
    affected += 1;
    if (field.align === "center") affectedCentre += 1;
    else affectedRight += 1;
    const options = fieldLayoutOptionsFor(pack, id);
    const ops = fieldOpsFor(pack, id);
    if (!ops) continue;
    drew += 1;
    const layout = layoutText(pack, options);
    // Its own pen, in its own space: the gutter plus whatever alignment spent.
    if (layout.lines[0].x > options.x) movedOffTheLeftEdge += 1;
  }
  // ► **THE CENSUS IN FULL, BECAUSE THE SHORT FORM IS ALREADY WRONG SOMEWHERE
  //   ELSE.** The wave brief this fix came from said "108 of 256 — 101 centre,
  //   30 right", which drops the intermediate 131 and invites the next reader to
  //   check 101 + 30 against 108, decide the census is garbled, and re-derive it
  //   badly. Every step is asserted here, against the pack, so the garbled form
  //   cannot be copied back in from a handoff without turning something red.
  assert.equal(Object.keys(pack.fields).length, 256, "every edit field in the build");
  assert.equal(left + centre + right, 256, "► and alignment partitions them: there is no fourth value");
  assert.equal(left, 125, "left-aligned, which were never affected");
  assert.equal(centre, 101, "the build's centred fields");
  assert.equal(right, 30, "and its right-aligned ones");
  assert.equal(centre + right, 131, "► 131 — the number the one-line summary dropped");
  assert.equal(affected, 108, "► the 108: centred or right, and not wrapping — a SUBSET of the 131");
  assert.equal(affectedCentre, 81, "81 of the 101 centred");
  assert.equal(affectedRight, 27, "and 27 of the 30 right");
  assert.equal(affectedCentre + affectedRight, affected, "which is where the 108 comes from");
  assert.equal(drew, 77, "of which this many draw anything at all with the pack's own placeholder text");
  assert.equal(movedOffTheLeftEdge, 77, "► and every one of them is now somewhere other than the left gutter");
  // The other half of `alignWidth: inner`, stated as the measurement it is:
  // nothing in the build exercises the margin term, which is why the synthetic
  // test above has to.
  assert.equal(margins, 0,
    "► no field in the build declares a margin, so the margin term of `alignWidth` is pinned by " +
    "`A CENTRED FIELD'S MARGINS COME OFF THE ALIGNMENT BOX` and by nothing on this pack");
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
