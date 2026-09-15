/**
 * THE JOIN — twenty-six screens of words, and the five things that make the
 * join more than a for-loop.
 *
 * *(“twenty-five” and “four” when this was written. The screen count was always
 * wrong — `THE 187 PLACEMENTS` three hundred lines below asserts 26 and has
 * since it was committed — and the fifth hazard was found by an adversarial
 * verifier reading the committed module. Corrected AT the claim, because a
 * count in a header is a claim like any other.)*
 *
 * `screen.js` returns 187 text placements it cannot draw; `text.js` can draw a
 * static run or an edit field; `screen-text.js` is the seam between them. Four
 * hazards live at that seam, every one of them measured against the two real
 * packs while the module was written, and every one of them SILENT when got
 * wrong — a screen still appears, with words on it, in the wrong place or
 * saying the wrong thing. So the tests below pin:
 *
 *   1. that a static run is drawn at the screen placement composed WITH the
 *      character's own text matrix, because `staticTextOpsFor`'s own `matrix`
 *      option REPLACES that matrix rather than composing with it — 22 of the 70
 *      static placements move by up to 68.9 px on the real pack;
 *   2. that a field's value comes from the TEXT pack or the caller and never
 *      from the screen placement, whose `initialText` for the five HTML fields
 *      is raw `<p align="left">` markup;
 *   3. that `html-markup-stripped` is counted per PLACEMENT, because four of
 *      the five such fields draw nothing and an operations-only tally reports
 *      one approximation where there are five;
 *   4. ~~that a placement under a FILTERLIST is marked and counted — 108 of
 *      187;~~ **that a placement under a filter CARRIES ITS GLOW — 113 of 187,
 *      and 112 of the 113 hand a painter a real `drop-shadow(...)`.** Two
 *      things were wrong with the struck line and both were invisible: the
 *      fixture's `filteredPlacements` entries carried a path and NO `filters`
 *      key, so every assertion about filters here was invariant under the
 *      records being right, wrong or absent; and 108 was the count from
 *      `filteredPlacements` alone, missing the pack's second filter list
 *      entirely. The glow is emitted ONCE PER FIELD and on no glyph — a field
 *      is up to 630 glyph operations and per-glyph would halo every letter —
 *      which the tests assert from both ends;
 *   5. that a mark `text.js` stamps and this module has NO NAME FOR is still
 *      counted, under `text.js`'s name for it, and reported in
 *      `unrosteredApproximations` rather than dropped — the tally used to be
 *      keyed on the string literal `"html-markup-stripped"` and on nothing
 *      else, so the 114 glyph-level approximations in the real pack's font 1510
 *      could reach an operation and no number at all.
 *
 * ► **THE SYNTHETIC PACKS BELOW ARE THE CONTRACT AND THEY HAVE TO BE
 *   SYNTHETIC.** `assets/` is gitignored and `test/asset-attestation.test.js`
 *   fails if anything under it becomes tracked, so a fixture of the real
 *   screens would put extracted art in the repository. Their numbers are chosen
 *   so the arithmetic is legible in the head: a font height of 409.6 twips is a
 *   20.48 px em, which makes the glyph-unit scale exactly 0.001.
 *
 * ► **THE REAL PACKS ARE USED WHEN THE MACHINE HAS THEM, and their absence is
 *   ASSERTED rather than skipped** — the arrangement `test/render-screen.test.js`
 *   uses, so a fresh clone runs the same number of tests with the same skip
 *   count and nothing hides behind a skip. (`test/render-text.test.js` takes the
 *   other route and marks its real-pack tests `{ skip }`; that moves the suite's
 *   skip count on a clone, which is why this file does not copy it.)
 */

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCREEN_TEXT_APPROXIMATION_KINDS,
  SCREEN_TEXT_UNDRAWN_KINDS,
  ScreenTextError,
  composeTextMatrix,
  hasJoinableText,
  joinableScreenNames,
  placementTextFor,
  screenTextFor,
  screenTextOpsFor,
  screenWithTextFor
} from "../src/render/screen-text.js";
import { canvasFilterFor } from "../src/render/filters.js";
import { screenFor, screenNames, screenPackFrom } from "../src/render/screen.js";
import {
  TEXT_UNITS_PER_EM,
  TWIPS_PER_PIXEL,
  approximationMarksOf,
  fontFor,
  staticTextOpsFor,
  textPackFrom
} from "../src/render/text.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * The player's own extracted packs, or null on a clone with no licensed copy.
 *
 * A function declaration rather than an arrow: `ss2-assertion-quality.test.js`
 * finds a helper's body by looking for the next brace before the next newline,
 * so a multi-line arrow reads as bodyless and every test calling it is reported
 * as asserting nothing.
 *
 * ► **ANCHORED, BECAUSE AN UNANCHORED `fs.existsSync` IS A SILENT PASS.** Until
 *   2026-09-15 this read `fs.existsSync(at) ? … : null` and nothing checked that
 *   `REPO_ROOT` pointed anywhere real. A verifier broke it by changing the
 *   `new URL("..")` above to `new URL("../..")`: all **thirteen** real-pack
 *   tests in this file turned into `assert.equal(null, null)`, the suite
 *   reported them as passes, and **no counter moved** — a broken path derivation
 *   was indistinguishable from a fresh clone. The anchor is a file git TRACKS,
 *   so it is present in every clone including one with no `assets/` at all:
 *   if it is missing, `REPO_ROOT` is wrong and that is a FAILURE, while a
 *   missing pack beside a present anchor is the honest fresh-clone case.
 *   Same pattern as `assertRealPackPathIsDerivable` in `render-props.test.js`
 *   and as the raw-trace archive check AGENTS.md describes.
 */
function readRealJson(relative) {
  const anchor = path.join(REPO_ROOT, "tools", "extract-screens.mjs");
  assert.ok(fs.existsSync(anchor),
    `${anchor} is not there, so REPO_ROOT is wrong and every "no extraction on this machine" ` +
    "guard below would be a broken path derivation reading as a fresh clone");
  const at = path.join(REPO_ROOT, relative);
  return fs.existsSync(at) ? JSON.parse(fs.readFileSync(at, "utf8")) : null;
}

const REAL_SCREENS = readRealJson("assets/screens/screens.json");
const REAL_TEXT = readRealJson("assets/text/text.json");

/* ------------------------------------------------------------------ */
/* Synthetic packs, in the shape the two extractors write              */
/* ------------------------------------------------------------------ */

/** A 10000 x 10000 glyph-unit box: at a 20.48 px em it is exactly 10 px square. */
const GLYPH_BOX = "M0 -10000L10000 -10000L10000 0L0 0Z";

function syntheticFont(overrides = {}) {
  return {
    id: 7,
    name: "Test",
    hasLayout: true,
    unitsPerEm: TEXT_UNITS_PER_EM,
    ascent: 16000,
    descent: 4000,
    leading: 1000,
    glyphCount: 4,
    glyphs: [
      { code: 32, char: " ", path: "", empty: true, advance: 10000 },
      { code: 65, char: "A", path: GLYPH_BOX, empty: false, advance: 12000 },
      { code: 66, char: "B", path: GLYPH_BOX, empty: false, advance: 8000 },
      { code: 10, char: "\n", path: "", empty: true, advance: 0 }
    ],
    kerning: [],
    ...overrides
  };
}

/**
 * The text half.
 *
 * `300` carries a NON-IDENTITY own matrix, which is the whole point: it is what
 * `staticTextOpsFor`'s `matrix` option would silently throw away. `301` carries
 * an identity one so the two cases can be told apart, and `302` names a glyph
 * index its font cannot answer for.
 */
function syntheticTextPack(overrides = {}) {
  return textPackFrom({
    unitsPerEm: TEXT_UNITS_PER_EM,
    fonts: { 7: syntheticFont(), 8: syntheticFont({ id: 8, hasLayout: false, ascent: null, descent: null }) },
    statics: {
      300: { id: 300, matrix: [1, 0, 0, 1, 1000, 0], bounds: { xMin: 1500, xMax: 2000, yMin: 0, yMax: 500 },
        records: [{ font: 7, height: 2048, x: 500, y: 400, colour: "#ffffff", alpha: 1, glyphs: [[1, 240], [1, 240]] }] },
      301: { id: 301, matrix: [1, 0, 0, 1, 0, 0], bounds: { xMin: 0, xMax: 500, yMin: 0, yMax: 500 },
        records: [{ font: 7, height: 2048, x: 0, y: 400, colour: "#ff0000", alpha: 1, glyphs: [[2, 200]] }] },
      302: { id: 302, matrix: [1, 0, 0, 1, 0, 0], bounds: { xMin: 0, xMax: 500, yMin: 0, yMax: 500 },
        records: [{ font: 7, height: 2048, x: 0, y: 400, colour: "#ffffff", alpha: 1, glyphs: [[99, 200]] }] },
      303: { id: 303, matrix: [1, 0, 0, 1, 0, 0], bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
        records: [{ font: 7, height: 2048, x: 0, y: 400, colour: "#ffffff", alpha: 1, glyphs: [[0, 200]] }] },
      ...(overrides.statics ?? {})
    },
    fields: {
      400: field400(),
      // Markup in the file, nothing left once stripped: the four-of-five case.
      401: { id: 401, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, font: 7, fontHeight: 409.6,
        colour: "#ffffff", alpha: 1, align: "left", leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
        multiline: false, wordWrap: false, password: false, readOnly: true, html: true,
        variable: "blank_html", text: "", approximated: "html-markup-stripped" },
      // Markup in the file with words left: the one-of-five case.
      402: { id: 402, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, font: 7, fontHeight: 409.6,
        colour: "#ffffff", alpha: 1, align: "left", leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
        multiline: false, wordWrap: false, password: false, readOnly: true, html: true,
        variable: "loud_html", text: "AB", approximated: "html-markup-stripped" },
      // A blank placeholder and a variable name: a hole where a live value goes.
      403: { id: 403, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, font: 7, fontHeight: 409.6,
        colour: "#ffffff", alpha: 1, align: "left", leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
        multiline: false, wordWrap: false, password: false, readOnly: true, html: false,
        variable: "_root.strength", text: "" },
      // A blank placeholder and NO variable name: empty, not unknown.
      404: { id: 404, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, font: 7, fontHeight: 409.6,
        colour: "#ffffff", alpha: 1, align: "left", leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
        multiline: false, wordWrap: false, password: false, readOnly: true, html: false,
        variable: "", text: "   " },
      // Font 8 has no layout block: its line height is approximated from the size.
      405: { id: 405, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, font: 8, fontHeight: 409.6,
        colour: "#ffffff", alpha: 1, align: "left", leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
        multiline: false, wordWrap: false, password: false, readOnly: true, html: false,
        variable: "no_layout", text: "A\nB" },
      ...(overrides.fields ?? {})
    },
    placements: {}
  });
}

function field400() {
  return {
    id: 400, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, font: 7, fontHeight: 409.6,
    colour: "#ffffff", alpha: 1, align: "left", leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
    multiline: false, wordWrap: false, password: false, readOnly: true, html: false,
    // TWO letters, deliberately: with one, a tally that counted PLACEMENTS
    // where it should count OPERATIONS would agree by accident, and a mutation
    // run found exactly that.
    variable: "about_fight_text", text: "AB"
  };
}

/**
 * The same pack with font 7's two inked glyphs carrying GLYPH-LEVEL
 * approximation marks, which is what the real pack's font 1510 looks like: 112
 * of its 114 glyphs are `advance-from-outline` and 2 are
 * `advance-from-sibling-font`, per `assets/text/manifest.json`'s own
 * `approximated.byKind`.
 *
 * Synthetic rather than real for the reason every fixture here is, and because
 * the real pack cannot exercise this at all: measured, the ONLY static on the
 * 26 screens that names font 1510 is 1511, whose single glyph is empty, so not
 * one of those 114 marks reaches an operation on this build. The hole was
 * LATENT, and a latent hole needs a pack that opens it.
 */
function approximatedGlyphTextPack() {
  const base = syntheticTextPack();
  const font = syntheticFont({
    glyphs: [
      { code: 32, char: " ", path: "", empty: true, advance: 10000 },
      { code: 65, char: "A", path: GLYPH_BOX, empty: false, advance: 12000, approximated: "advance-from-outline" },
      { code: 66, char: "B", path: GLYPH_BOX, empty: false, advance: 8000, approximated: "advance-from-sibling-font" },
      { code: 10, char: "\n", path: "", empty: true, advance: 0 }
    ]
  });
  return textPackFrom({
    unitsPerEm: base.unitsPerEm,
    fonts: { ...base.fonts, 7: font },
    statics: base.statics,
    fields: base.fields,
    placements: base.placements
  });
}

/**
 * A glow in the shape `tools/extract-screens.mjs` writes one, with the numbers
 * chosen so the canvas string can be checked by hand: `blurSigma(4, 1)` is
 * `sqrt(15/12)` = 1.118033988…, `drop-shadow`'s third length is TWICE that
 * (`filters.js`'s own note: CSS takes a box-shadow radius there and `blur()`
 * takes a standard deviation), and `canvasFilterFor` rounds to four decimals —
 * so this filter is exactly `drop-shadow(0px 0px 2.2361px rgba(0, 0, 0, 1))`
 * and the test below asserts that literal rather than recomputing it.
 */
const SYNTHETIC_GLOW = Object.freeze({
  type: "glow", filterId: 2, colour: { red: 0, green: 0, blue: 0, alpha: 255 },
  blurX: 4, blurY: 4, strength: 1, inner: false, knockout: false, compositeSource: true, passes: 1
});
const SYNTHETIC_GLOW_STRING = "drop-shadow(0px 0px 2.2361px rgba(0, 0, 0, 1))";

const SYNTHETIC_SHAPE = {
  character: 10,
  paths: [{ d: "M0 0L10 0L10 10L0 10Z", fill: "#ff0000", fillOpacity: 1, fillRule: "evenodd", stroke: null, strokeWidth: 0 }]
};

/**
 * The screens half: three shapes and five text placements whose paths
 * INTERLEAVE, so paint order is a real question rather than "text last".
 */
function syntheticScreensRaw() {
  return {
    screens: {
      forum: {
        name: "forum", labelFrame: 30, firstFrame: 30, lastFrame: 34,
        objects: [],
        drawables: [
          { shape: 10, path: [3], matrix: [1, 0, 0, 1, 0, 0] },
          { shape: 10, path: [50, 1], matrix: [1, 0, 0, 1, 0, 0] },
          { shape: 10, path: [60], matrix: [1, 0, 0, 1, 0, 0] }
        ],
        unresolved: [
          { kind: "text-static", character: 300, path: [45], detail: "2 glyphs reading \"AA\"" },
          { kind: "text-static", character: 301, path: [46], detail: "1 glyph reading \"B\"" },
          { kind: "text-edit", character: 400, path: [55, 2], detail: "variable about_fight_text" },
          { kind: "text-edit", character: 401, path: [56], detail: "variable blank_html" },
          { kind: "text-edit", character: 403, path: [57], detail: "variable _root.strength" },
          { kind: "text-edit", character: 404, path: [61], detail: "no variable at all" }
        ],
        staticText: [
          { id: 300, bounds: { xMin: 1500, xMax: 2000, yMin: 0, yMax: 500 }, matrix: [1, 0, 0, 1, 2000, 3000],
            glyphs: 2, undecoded: 0, text: "AA", runs: [], path: [45] },
          { id: 301, bounds: { xMin: 0, xMax: 500, yMin: 0, yMax: 500 }, matrix: [1, 0, 0, 1, 2000, 3000],
            glyphs: 1, undecoded: 0, text: "B", runs: [], path: [46] }
        ],
        textFields: [
          { id: 400, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, fontId: 7, fontHeight: 409.6,
            colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: 0, leading: 0,
            leftMargin: 0, rightMargin: 0, indent: 0, variableName: "about_fight_text",
            initialText: "AB", multiline: false, wordWrap: false, readOnly: true,
            path: [55, 2], matrix: [1, 0, 0, 1, 1000, 2000] },
          { id: 401, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, fontId: 7, fontHeight: 409.6,
            colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: 0, leading: 0,
            leftMargin: 0, rightMargin: 0, indent: 0, variableName: "blank_html",
            // ► The screens pack keeps the RAW MARKUP. Drawing this string is
            //   the second hazard this file exists to pin.
            initialText: "<p align=\"left\"></p>", multiline: false, wordWrap: false, readOnly: true,
            path: [56], matrix: [1, 0, 0, 1, 0, 0] },
          { id: 403, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, fontId: 7, fontHeight: 409.6,
            colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: 0, leading: 0,
            leftMargin: 0, rightMargin: 0, indent: 0, variableName: "_root.strength",
            initialText: "", multiline: false, wordWrap: false, readOnly: true,
            path: [57], matrix: [1, 0, 0, 1, 0, 0] },
          // Blank AND nameless: empty, which is not the same as unknown.
          { id: 404, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, fontId: 7, fontHeight: 409.6,
            colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: 0, leading: 0,
            leftMargin: 0, rightMargin: 0, indent: 0, variableName: "",
            initialText: "   ", multiline: false, wordWrap: false, readOnly: true,
            path: [61], matrix: [1, 0, 0, 1, 0, 0] }
        ],
        // [55] covers the field at [55, 2]; [45, 9, 9] is LONGER than the
        // static's path at [45] and must not match it.
        //
        // ► **THE `filters` LIST IS THE HALF THAT WAS MISSING UNTIL
        //   2026-09-15, AND ITS ABSENCE MADE EVERY FILTER ASSERTION IN THIS
        //   FILE VACUOUS.** Both entries carried a path and nothing else, so
        //   the module's filter output was invariant under the records being
        //   right, wrong or absent — the same defect `render-screen.test.js`
        //   found in its own fixture on the same day. A real glow here is what
        //   gives `filtersCarried` and `placement.filter` an input.
        //   `SYNTHETIC_GLOW` is deliberately the same shape the extractor
        //   writes, and 98's records stay absent so the two cases can be told
        //   apart by something other than the path.
        filteredPlacements: [
          { character: 99, path: [55], filters: [SYNTHETIC_GLOW] },
          { character: 98, path: [45, 9, 9], filters: [SYNTHETIC_GLOW] }
        ],
        blendedPlacements: [],
        rangeVariance: { frames: 0, firstDifferingFrame: null, depthsAdded: [], depthsRemoved: [] },
        approximations: {},
        counts: { objects: 0, drawables: 3 }
      }
    },
    shapes: { 10: SYNTHETIC_SHAPE },
    fonts: { 7: { id: 7, name: "Test", glyphCount: 4, bold: false, italic: false } }
  };
}

function syntheticScreens() {
  return screenPackFrom(syntheticScreensRaw());
}

/** The synthetic screens pack with its filter list replaced wholesale. */
function packWithFilters(filteredPlacements) {
  const raw = syntheticScreensRaw();
  raw.screens.forum.filteredPlacements = filteredPlacements;
  return screenPackFrom(raw);
}

/** A point pushed through a matrix, in TWIPS throughout — the composition's own space. */
function applyTwips(matrix, x, y) {
  return [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
}

/** The stage-space ink box of a list of operations: path in pixels, translation in twips. */
function inkOf(ops) {
  const box = { xMin: Infinity, yMin: Infinity, xMax: -Infinity, yMax: -Infinity, points: 0 };
  for (const op of ops) {
    const m = op.matrix;
    const numbers = (op.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      const x = m[0] * numbers[index] + m[2] * numbers[index + 1] + m[4] / TWIPS_PER_PIXEL;
      const y = m[1] * numbers[index] + m[3] * numbers[index + 1] + m[5] / TWIPS_PER_PIXEL;
      box.xMin = Math.min(box.xMin, x);
      box.xMax = Math.max(box.xMax, x);
      box.yMin = Math.min(box.yMin, y);
      box.yMax = Math.max(box.yMax, y);
      box.points += 1;
    }
  }
  return box;
}

/** Lexicographic on a chain of depths, shorter first — `screen.js`'s own order. */
function comparePath(left, right) {
  const shortest = Math.min(left.length, right.length);
  for (let index = 0; index < shortest; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

/* ------------------------------------------------------------------ */
/* The fresh-clone path, which is the supported one                    */
/* ------------------------------------------------------------------ */

test("neither pack, or half a pack, means null — never a screen with no words on it", () => {
  // ► **A CLONE WITH NO LICENSED COPY MUST GET null AND FALL BACK TO ITS OWN
  //   ART.** Half a join is worse than none: screens with no text would draw a
  //   shop whose prices are missing, and nothing would say so.
  const screens = syntheticScreens();
  const text = syntheticTextPack();
  for (const [s, t] of [[null, null], [screens, null], [null, text], [screens, undefined], [{}, text], [screens, {}]]) {
    assert.equal(hasJoinableText(s, t), false, "half a join is not joinable");
    assert.deepEqual(joinableScreenNames(s, t), [], "and it names no screens");
    assert.equal(screenTextFor(s, t, "forum"), null, "and asks for none");
    assert.equal(screenTextOpsFor(s, t, "forum"), null);
  }
  // The atom is asked the same question separately, because it has only ONE
  // pack to judge: a screens pack it never sees cannot make it return null, and
  // an earlier version of this test asserted that it did — which passed only
  // because the loop above happened to pair every unusable text pack with an
  // unusable screens one.
  const placement = { kind: "text-static", character: 300, path: [45] };
  for (const unusable of [null, undefined, {}, { fonts: {} }, { fonts: { 7: { id: 7, glyphs: [] } } }, "text", 7]) {
    assert.equal(placementTextFor(unusable, placement), null, `${JSON.stringify(unusable)} is not a text pack`);
  }
  assert.equal(placementTextFor(text, null), null, "and a placement that is not one is null too");
  assert.equal(placementTextFor(text, placement).drawn, true, "while a real pack draws it with no screens pack in sight");
  assert.equal(hasJoinableText(screens, text), true, "and both halves together ARE joinable");
  assert.deepEqual(joinableScreenNames(screens, text), ["forum"]);
  assert.equal(screenTextFor(screens, text, "no_such_screen"), null, "a screen the pack lacks is null, not an empty picture");
  assert.equal(screenTextFor(screens, text, 17), null, "and a name that is not a string is too");
  assert.equal(new ScreenTextError("x") instanceof Error, true, "the error type exists and is never thrown");
});

test("screens without the text pack still DRAW, and say the words are still missing", () => {
  // The other asymmetry: a player who extracted the screens and not the fonts
  // gets the shapes, and `textStillNotDrawn` stays at the full count rather
  // than quietly reading zero.
  const merged = screenWithTextFor(syntheticScreens(), null, "forum");
  assert.equal(merged.textPresent, false, "there is no text half");
  assert.equal(merged.text, null);
  assert.equal(merged.counts.shapeOps, 3, "the three shapes still draw");
  assert.equal(merged.counts.glyphOps, 0);
  assert.equal(merged.counts.textPlacements, 6);
  assert.equal(merged.counts.textDrawn, 0);
  assert.equal(merged.counts.textStillNotDrawn, 6, "all six placements are still missing and the count says so");
  assert.equal(screenWithTextFor(null, null, "forum"), null, "and with no screens at all it is null");
});

/* ------------------------------------------------------------------ */
/* The matrix composition — the defect this module exists for          */
/* ------------------------------------------------------------------ */

test("composeTextMatrix is outer-over-inner, checked by pushing points through both ways", () => {
  // Not a restatement of the formula: the property is that composing then
  // transforming equals transforming twice, which a wrong term breaks.
  const outer = [0, 1, -1, 0, 100, 200];
  const inner = [2, 0, 0, 2, 300, 400];
  const composed = composeTextMatrix(outer, inner);
  assert.deepEqual([...composed], [0, 2, -2, 0, -300, 500], "the 90-degree outer, doubled inner, worked by hand");
  for (const [x, y] of [[0, 0], [20, 0], [0, 20], [-7, 13], [1000, -250]]) {
    assert.deepEqual(applyTwips(composed, x, y), applyTwips(outer, ...applyTwips(inner, x, y)),
      `composing and transforming must equal transforming twice at (${x}, ${y})`);
  }
});

test("composeTextMatrix is total: rubbish on either side reads as the identity", () => {
  const real = [2, 0, 0, 2, 40, 80];
  for (const rubbish of [null, undefined, [], [1, 2, 3], "matrix", 7, [1, 0, 0, 1, NaN, 0], { a: 1 }]) {
    assert.deepEqual([...composeTextMatrix(real, rubbish)], real, "an unusable inner leaves the outer alone");
    assert.deepEqual([...composeTextMatrix(rubbish, real)], real, "and an unusable outer leaves the inner alone");
  }
  assert.equal(Object.isFrozen(composeTextMatrix(real, real)), true, "and the result is frozen");
});

test("A STATIC IS DRAWN AT THE PLACEMENT COMPOSED WITH ITS OWN TEXT MATRIX, NOT AT THE PLACEMENT", () => {
  // ► **THIS IS THE DEFECT THE MODULE EXISTS TO PREVENT.**
  //   `staticTextOpsFor(pack, id, { matrix })` REPLACES the character's own
  //   matrix with the one passed in. Static 300's own matrix translates by 1000
  //   twips, the screen places it at 2000, and its first record's pen starts at
  //   500 — so the first glyph belongs at 2000 + 1000 + 500 = 3500 twips, and a
  //   join that forwards the placement matrix raw puts it at 2500. Fifty pixels
  //   left, on the screen, legible, wrong.
  const record = screenTextFor(syntheticScreens(), syntheticTextPack(), "forum");
  const composed = record.placements.find((entry) => entry.character === 300);
  assert.deepEqual([...composed.matrix], [1, 0, 0, 1, 3000, 3000], "placement 2000 composed with the character's own 1000");
  assert.equal(composed.ops.length, 2, "two glyphs");
  assert.deepEqual([...composed.ops[0].matrix], [1, 0, 0, 1, 3500, 3400], "first glyph: 2000 + 1000 + pen 500");
  assert.deepEqual([...composed.ops[1].matrix], [1, 0, 0, 1, 3740, 3400], "second: one 240-twip advance later");
  assert.equal(composed.ops[0].d, "M0 -50L50 -50L50 0L0 0Z", "and the outline is in PIXELS at the record's own scale");

  // The identity-matrix sibling proves the composition is not a constant: same
  // placement, no own matrix, so the pen starts 1000 twips further left.
  const plain = record.placements.find((entry) => entry.character === 301);
  assert.deepEqual([...plain.matrix], [1, 0, 0, 1, 2000, 3000]);
  assert.deepEqual([...plain.ops[0].matrix], [1, 0, 0, 1, 2000, 3400], "no own matrix, so no extra 1000");
  assert.equal(plain.ops[0].fill, "#ff0000", "and the record's own colour survives the join");
});

/* ------------------------------------------------------------------ */
/* A field's value comes from outside the file                         */
/* ------------------------------------------------------------------ */

test("a field draws the TEXT pack's stripped value, never the screen pack's raw markup", () => {
  // ► Hazard 2. `screens.json` keeps `initialText` verbatim — for field 401
  //   that is the literal string `<p align="left"></p>` — and `text.json`
  //   carries what is left once the markup is gone. Drawing the screen pack's
  //   copy paints the tags.
  const raw = syntheticScreensRaw();
  const placement = screenFor(screenPackFrom(raw), "forum").text.find((entry) => entry.character === 401);
  assert.equal(placement.text, "<p align=\"left\"></p>", "the screen pack really does carry the markup");

  const resolved = placementTextFor(syntheticTextPack(), placement);
  assert.equal(resolved.value, "", "and the join draws the stripped value instead");
  assert.equal(resolved.ops.length, 0, "which is nothing at all");
  assert.equal(resolved.drawn, false);
});

test("a live value binds on the VARIABLE NAME, by function, object or Map", () => {
  const screens = syntheticScreens();
  const text = syntheticTextPack();
  const expected = { 400: "AB", 403: "" };

  for (const values of [
    { "_root.strength": "AB" },
    new Map([["_root.strength", "AB"]]),
    (placement) => (placement.variableName === "_root.strength" ? "AB" : undefined)
  ]) {
    const record = screenTextFor(screens, text, "forum", { values });
    const bound = record.placements.find((entry) => entry.character === 403);
    assert.equal(bound.value, "AB", `bound through ${values.constructor.name}`);
    assert.equal(bound.valueSource, "bound");
    assert.equal(bound.ops.length, 2, "and the two letters draw");
    assert.equal(bound.ops.map((op) => op.glyph.char).join(""), "AB");
    assert.equal(bound.undrawn, null, "so it is no longer a hole");
    // Everything else keeps the file's own placeholder.
    const untouched = record.placements.find((entry) => entry.character === 400);
    assert.equal(untouched.value, expected[400]);
    assert.equal(untouched.valueSource, "placeholder");
  }
});

test("the character id is the fallback key, for the sixty placements with no variable name", () => {
  const record = screenTextFor(syntheticScreens(), syntheticTextPack(), "forum", { values: { 403: "BB" } });
  const bound = record.placements.find((entry) => entry.character === 403);
  assert.equal(bound.value, "BB", "keyed by the character id when the name is not in the table");
  assert.equal(bound.valueSource, "bound");

  const byName = screenTextFor(syntheticScreens(), syntheticTextPack(), "forum",
    { values: { 403: "BB", "_root.strength": "AA" } });
  assert.equal(byName.placements.find((entry) => entry.character === 403).value, "AA",
    "and the build's own variable name wins when both are given");
});

test("SUPPLIED-AND-EMPTY AND NOBODY-TOLD-ME ARE DIFFERENT NUMBERS", () => {
  // ► Collapsing these is how a screen full of missing values reads as
  //   finished. `undefined` falls through to the placeholder and is counted as
  //   a value this renderer does not have; `""` is a caller saying the field is
  //   empty right now and stops the search.
  const screens = syntheticScreens();
  const text = syntheticTextPack();

  const nothing = screenTextFor(screens, text, "forum");
  assert.equal(nothing.undrawnByKind["value-unknown"], 2,
    "403 and 401 both have a variable name, a blank placeholder and nobody to fill them");
  assert.equal(nothing.undrawnByKind["nothing-to-draw"], 1,
    "404 has no variable name at all, so its three spaces are EMPTY rather than unknown");

  const blanked = screenTextFor(screens, text, "forum", { values: { "_root.strength": "" } });
  assert.equal(blanked.undrawnByKind["value-unknown"], 1, "deliberately blanked is not unknown");
  assert.equal(blanked.undrawnByKind["nothing-to-draw"], 2);
  assert.equal(blanked.placements.find((entry) => entry.character === 403).valueSource, "bound");

  const undef = screenTextFor(screens, text, "forum", { values: { "_root.strength": undefined } });
  assert.equal(undef.undrawnByKind["value-unknown"], 2, "and undefined falls through rather than counting as blank");
  assert.equal(undef.placements.find((entry) => entry.character === 403).valueSource, "placeholder");
});

test("a field's own box, gutter and ascent put the first glyph where the build does", () => {
  // The units seam, in numbers a reader can check: a 409.6-twip font height is
  // a 20.48 px em, the font's 16000-unit ascent is 16 px at that size, the
  // gutter is 2 px, so the first baseline is 18 px down and the pen 2 px in.
  // The placement translates by 1000/2000 twips, so the glyph lands at
  // 2 * 20 + 1000 = 1040 and 18 * 20 + 2000 = 2360.
  const record = screenTextFor(syntheticScreens(), syntheticTextPack(), "forum");
  const field = record.placements.find((entry) => entry.character === 400);
  assert.equal(field.ops.length, 2);
  assert.deepEqual([...field.ops[0].matrix], [1, 0, 0, 1, 1040, 2360]);
  // The 'A' advances 12000 glyph units, which is 12 px at a 20.48 px em, so the
  // 'B' starts 240 twips further along and nothing about the baseline moves.
  assert.deepEqual([...field.ops[1].matrix], [1, 0, 0, 1, 1280, 2360]);
  assert.equal(field.ops[0].d, "M0 -10L10 -10L10 0L0 0Z", "and a 10000-unit box is 10 px at a 20.48 px em");
  assert.equal(field.ops[0].fillRule, "nonzero", "glyph contours wind against their counters");

  const wider = screenTextFor(syntheticScreens(), syntheticTextPack(), "forum", { gutter: 7 });
  assert.deepEqual([...wider.placements.find((entry) => entry.character === 400).ops[0].matrix],
    [1, 0, 0, 1, 1140, 2460], "and the gutter reaches the layout: five more pixels each way");
});

/* ------------------------------------------------------------------ */
/* The invoice                                                         */
/* ------------------------------------------------------------------ */

test("drawn plus undrawn is every placement, and the tallies carry exactly the declared kinds", () => {
  const record = screenTextFor(syntheticScreens(), syntheticTextPack(), "forum");
  assert.equal(record.counts.placements, 6, "the screen has six text placements");
  assert.equal(record.counts.placements, screenFor(syntheticScreens(), "forum").text.length,
    "which is the same number `screen.js` counts as textNotDrawn");
  assert.equal(record.counts.drawn + record.counts.undrawn, record.counts.placements,
    "► a caller cannot take the picture without the invoice");
  assert.equal(record.counts.drawn, 3);
  assert.equal(record.counts.undrawn, 3);
  assert.equal(record.counts.statics + record.counts.fields, record.counts.placements);
  assert.equal(record.counts.ops, record.placements.reduce((sum, entry) => sum + entry.ops.length, 0),
    "and the operation count is the placements' own, not a second opinion");
  assert.deepEqual(Object.keys(record.undrawnByKind), [...SCREEN_TEXT_UNDRAWN_KINDS],
    "the undrawn tally has exactly the declared kinds — no silent extra bucket");
  assert.deepEqual(Object.keys(record.approximations), [...SCREEN_TEXT_APPROXIMATION_KINDS]);
  assert.equal(Object.values(record.undrawnByKind).reduce((sum, count) => sum + count, 0), record.counts.undrawn,
    "and every undrawn placement is under one of them");
});

test("A PLACEMENT'S APPROXIMATION IS COUNTED EVEN WHEN IT DRAWS NOTHING", () => {
  // ► Hazard 3, and the most expensive shape of error on this project. Four of
  //   the real pack's five HTML fields strip to nothing, so their
  //   `html-markup-stripped` mark reaches no operation. A tally computed from
  //   operations reports one approximation where there are five.
  const text = syntheticTextPack();
  const raw = syntheticScreensRaw();
  // Place the LOUD html field (402, "AB") beside the blank one already there.
  raw.screens.forum.textFields.push({
    id: 402, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, fontId: 7, fontHeight: 409.6,
    colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: 0, leading: 0,
    leftMargin: 0, rightMargin: 0, indent: 0, variableName: "loud_html",
    initialText: "<p align=\"center\">AB</p>", multiline: false, wordWrap: false, readOnly: true,
    path: [58], matrix: [1, 0, 0, 1, 0, 0]
  });
  const record = screenTextFor(screenPackFrom(raw), text, "forum");
  assert.equal(record.approximations.htmlMarkupStripped, 2, "BOTH html fields are counted");
  assert.equal(record.approximations.htmlMarkupStrippedOps, 2, "though only one of them emits operations");
  const blank = record.placements.find((entry) => entry.character === 401);
  assert.equal(blank.drawn, false);
  assert.deepEqual([...blank.approximated], ["html-markup-stripped"],
    "► the mark is on the placement, which is the only place it can be");
  const loud = record.placements.find((entry) => entry.character === 402);
  assert.equal(loud.ops.every((op) => [...op.approximated].includes("html-markup-stripped")), true,
    "and on every operation it did emit, so a surface cannot draw one without it");
});

test("a glyph index the font cannot answer for draws a box and is counted", () => {
  const raw = syntheticScreensRaw();
  raw.screens.forum.staticText.push({
    id: 302, bounds: { xMin: 0, xMax: 500, yMin: 0, yMax: 500 }, matrix: [1, 0, 0, 1, 0, 0],
    glyphs: 1, undecoded: 0, text: "?", runs: [], path: [47]
  });
  const record = screenTextFor(screenPackFrom(raw), syntheticTextPack(), "forum");
  const broken = record.placements.find((entry) => entry.character === 302);
  assert.equal(broken.drawn, true, "it draws — as a hollow box, which is information");
  assert.equal(broken.notdef, 1);
  assert.equal(broken.ops[0].notdef, true);
  assert.deepEqual([...broken.ops[0].approximated], ["glyph-missing"]);
  assert.deepEqual([...broken.approximated], ["glyphsNotdef"]);
  assert.equal(record.approximations.glyphsNotdef, 1, "and it reaches the screen's tally");
  // ► **THE FLAG AND THE MARK ARE THE SAME FINDING AND MUST AGREE.**
  //   `text.js` sets `notdef: true` and `approximated: "glyph-missing"` in the
  //   same two branches; the roster's `glyphsNotdef` is projected from the
  //   MARK, so if either ever stops implying the other this is the assertion
  //   that says so rather than a number quietly halving.
  assert.equal(record.approximations.glyphsNotdef, record.placements.reduce((sum, one) => sum + one.notdef, 0));
  assert.equal(record.approximatedOpsByKind["glyph-missing"], 1);
  assert.equal(record.approximatedByKind.glyphsNotdef, 1, "one PLACEMENT drew a box; the roster key counts BOXES");
  assert.equal(record.approximatedOpsByKind.glyphsNotdef, undefined,
    "► and the placement-level mark does NOT spread onto its operations, which would count the box twice");
});

test("a font with no layout block, and a newline in a single-line field, both reach the tally", () => {
  const raw = syntheticScreensRaw();
  raw.screens.forum.textFields.push({
    id: 405, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, fontId: 8, fontHeight: 409.6,
    colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: 0, leading: 0,
    leftMargin: 0, rightMargin: 0, indent: 0, variableName: "no_layout",
    initialText: "A\nB", multiline: false, wordWrap: false, readOnly: true,
    path: [59], matrix: [1, 0, 0, 1, 0, 0]
  });
  const record = screenTextFor(screenPackFrom(raw), syntheticTextPack(), "forum");
  const entry = record.placements.find((entry) => entry.character === 405);
  assert.equal(entry.drawn, true, "it still draws — the caller is told, the screen is not blank");
  assert.deepEqual([...entry.approximated].sort(), ["lineHeightFromSize", "newlineCollapsed", "placeholderDrawn"]);
  assert.equal(record.approximations.lineHeightFromSize, 1);
  assert.equal(record.approximations.newlineCollapsed, 1);
});

test("a character the text pack has never heard of is counted, not skipped", () => {
  const raw = syntheticScreensRaw();
  raw.screens.forum.staticText.push({
    id: 9999, bounds: null, matrix: [1, 0, 0, 1, 0, 0], glyphs: 3, undecoded: 0, text: "gone", runs: [], path: [48]
  });
  raw.screens.forum.textFields.push({
    id: 9998, bounds: null, fontId: 7, fontHeight: 409.6, colour: null, align: 0, leading: 0,
    leftMargin: 0, rightMargin: 0, indent: 0, variableName: null, initialText: "x",
    multiline: false, wordWrap: false, readOnly: true, path: [49], matrix: [1, 0, 0, 1, 0, 0]
  });
  const record = screenTextFor(screenPackFrom(raw), syntheticTextPack(), "forum");
  assert.equal(record.undrawnByKind["character-missing"], 2, "both halves report an absent character");
  assert.equal(record.counts.drawn + record.counts.undrawn, record.counts.placements);
});

test("a field whose font has no glyphs is font-missing, told apart from a missing character", () => {
  const text = syntheticTextPack();
  const hollow = textPackFrom({
    unitsPerEm: TEXT_UNITS_PER_EM,
    fonts: { 7: syntheticFont(), 9: { id: 9, name: "Hollow", glyphs: [] } },
    statics: {}, fields: { 400: { ...field400(), font: 9 } }, placements: {}
  });
  const placement = screenFor(syntheticScreens(), "forum").text.find((entry) => entry.character === 400);
  assert.equal(placementTextFor(hollow, placement).undrawn, "font-missing");
  assert.equal(placementTextFor(text, placement).undrawn, null, "and the real font draws it");
});

test("A GLYPH-LEVEL APPROXIMATION REACHES THE TALLY UNDER text.js's OWN NAME FOR IT", () => {
  // ► Hazard 5. `text.js` stamps a glyph's `approximated` onto every operation
  //   it draws from that glyph (`opsFromLayout` and `staticTextOpsFor` both do
  //   it). `SCREEN_TEXT_APPROXIMATION_KINDS` has no key for either glyph kind
  //   and never will — the roster is fixed so a viewer's layout does not move
  //   — so the open tally is the only thing standing between 114 marked glyphs
  //   and a screen that reports zero approximations while drawing them.
  const record = screenTextFor(syntheticScreens(), approximatedGlyphTextPack(), "forum");

  // static 300 draws "AA", static 301 draws "B", field 400 draws "AB".
  assert.equal(record.approximatedOpsByKind["advance-from-outline"], 3, "three operations came off an outline-derived advance");
  assert.equal(record.approximatedOpsByKind["advance-from-sibling-font"], 2);
  assert.equal(record.approximatedByKind["advance-from-outline"], 2, "and two placements drew one");
  assert.equal(record.approximatedByKind["advance-from-sibling-font"], 2);
  assert.equal(record.approximatedOpsByKind["advance-from-outline"] + record.approximatedOpsByKind["advance-from-sibling-font"],
    record.counts.ops, "every operation this screen drew is marked, and every mark is counted");

  // ► **AND THE ROSTER IS UNCHANGED**, which is the whole design: a kind it
  //   has no key for is NAMED rather than squeezed into a key that means
  //   something else.
  assert.deepEqual(Object.keys(record.approximations), [...SCREEN_TEXT_APPROXIMATION_KINDS]);
  assert.deepEqual([...record.unrosteredApproximations], ["advance-from-outline", "advance-from-sibling-font"],
    "► the two kinds this module has no name for are reported BY NAME");
  assert.equal(record.counts.drawn + record.counts.undrawn, record.counts.placements);

  // The pack WITHOUT the marks reports none of it, so the assertions above are
  // reading the glyphs and not a constant.
  const plain = screenTextFor(syntheticScreens(), syntheticTextPack(), "forum");
  assert.deepEqual([...plain.unrosteredApproximations], [], "the unmarked pack has nothing unrostered");
  assert.equal(plain.approximatedOpsByKind["advance-from-outline"], undefined,
    "and a kind that did not occur is ABSENT from the open tally, not a zero");
});

test("A FIELD KIND THIS MODULE HAS NEVER SEEN IS COUNTED AND NAMED, not folded into the html count", () => {
  // ► Hazard 5 again, at the field level. `finish` pushes whatever string
  //   `field.approximated` holds onto the placement; the tally used to
  //   increment a key only for the literal "html-markup-stripped". On this pack
  //   all five field marks are that kind, so the hole is invisible TODAY and
  //   opens the moment a re-extraction adds a sixth.
  const text = syntheticTextPack({
    fields: {
      406: { id: 406, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, font: 7, fontHeight: 409.6,
        colour: "#ffffff", alpha: 1, align: "left", leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
        multiline: false, wordWrap: false, password: false, readOnly: true, html: true,
        variable: "sixth_kind", text: "AB", approximated: "entities-not-decoded" }
    }
  });
  const raw = syntheticScreensRaw();
  raw.screens.forum.textFields.push({
    id: 406, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, fontId: 7, fontHeight: 409.6,
    colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: 0, leading: 0,
    leftMargin: 0, rightMargin: 0, indent: 0, variableName: "sixth_kind",
    initialText: "A&amp;B", multiline: false, wordWrap: false, readOnly: true,
    path: [62], matrix: [1, 0, 0, 1, 0, 0]
  });
  const record = screenTextFor(screenPackFrom(raw), text, "forum");
  const entry = record.placements.find((one) => one.character === 406);
  assert.equal(entry.drawn, true, "it draws — the caller is told, the screen is not blank");
  assert.equal(entry.approximated.includes("entities-not-decoded"), true, "the mark is on the placement");
  assert.equal(record.approximatedByKind["entities-not-decoded"], 1, "► and it reaches a NUMBER, which is the point");
  assert.equal(record.approximatedOpsByKind["entities-not-decoded"], 2, "on both operations the field emitted");
  assert.equal(record.unrosteredApproximations.includes("entities-not-decoded"), true,
    "► and is named, so a reader knows the roster is not showing it");
  assert.equal(record.approximations.htmlMarkupStripped, 1,
    "► and is NOT quietly added to the html count — only field 401 is an html field here");
  assert.equal(record.approximations.htmlMarkupStrippedOps, 0, "which draws nothing");
  assert.equal(record.approximatedOpsByKind["html-markup-stripped"], undefined,
    "► a kind that affected NO operation is absent from the open tally; the roster reads the absence as the zero it is");
  // The open tally is sorted by kind, so a reader diffing two runs of the same
  // screen sees a changed COUNT rather than a reordered object. Insertion order
  // here would be filtersCarried, placeholderDrawn, html-markup-stripped,
  // entities-not-decoded, which is deliberately not the sorted one.
  assert.deepEqual(Object.keys(record.approximatedByKind),
    ["entities-not-decoded", "filtersCarried", "html-markup-stripped", "placeholderDrawn"]);
});

test("A FIELD DECLARING TWO REASONS LOSES NEITHER — the same shape question, one level up", () => {
  // ► **THE LAST `typeof … approximated` IN `src/` WAS HERE.** `fieldPlacement`
  //   read the field's own mark with `typeof field.approximated === "string"`,
  //   which is a SECOND reader of the key whose two shapes cost this wave a
  //   finding. `tools/extract-text.mjs` writes a string today, so this is the
  //   latent form rather than the live one — and latent is exactly what the
  //   operation-level version was until `text.js` grew a list. One reader now
  //   (`approximationMarksOf`), so both shapes count the same.
  const withMarks = (approximated) => {
    const text = syntheticTextPack({
      fields: {
        407: { id: 407, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, font: 7, fontHeight: 409.6,
          colour: "#ffffff", alpha: 1, align: "left", leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
          multiline: false, wordWrap: false, password: false, readOnly: true, html: true,
          variable: "two_reasons", text: "AB", approximated }
      }
    });
    const raw = syntheticScreensRaw();
    raw.screens.forum.textFields.push({
      id: 407, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, fontId: 7, fontHeight: 409.6,
      colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: 0, leading: 0,
      leftMargin: 0, rightMargin: 0, indent: 0, variableName: "two_reasons",
      initialText: "A&amp;B", multiline: false, wordWrap: false, readOnly: true,
      path: [63], matrix: [1, 0, 0, 1, 0, 0]
    });
    const record = screenTextFor(screenPackFrom(raw), text, "forum");
    return { record, entry: record.placements.find((one) => one.character === 407) };
  };

  // The shape the extractor writes today: unchanged behaviour.
  const one = withMarks("html-markup-stripped");
  assert.deepEqual([...one.entry.approximated], ["html-markup-stripped", "placeholderDrawn"],
    "the field's own reason, then the fact that what drew was the placeholder");
  assert.equal(one.record.approximations.htmlMarkupStripped, 2, "field 401 and this one");

  // The shape it could write tomorrow: BOTH reasons reach a number.
  const two = withMarks(["html-markup-stripped", "entities-not-decoded"]);
  assert.deepEqual([...two.entry.approximated], ["html-markup-stripped", "entities-not-decoded", "placeholderDrawn"],
    "► order is precedence, and neither of the field's reasons is dropped");
  assert.equal(two.record.approximatedByKind["entities-not-decoded"], 1, "► the second reason reaches a NUMBER");
  assert.equal(two.record.approximatedOpsByKind["entities-not-decoded"], 2, "on both operations the field emitted");
  assert.equal(two.record.approximations.htmlMarkupStripped, 2, "and the first one still does");
  assert.equal(two.record.unrosteredApproximations.includes("entities-not-decoded"), true);

  // And rubbish in that slot is no marks, never a throw and never a mark called
  // "42" — the same totality every other reader of pack data here has.
  const rubbish = withMarks(42);
  assert.deepEqual([...rubbish.entry.approximated], ["placeholderDrawn"],
    "no mark from the field, and the placement's own reasons untouched");
  assert.equal(rubbish.record.approximatedByKind["42"], undefined);
});

test("THE TWO MARKS COLLIDE ON ONE OPERATION, and BOTH survive it", () => {
  // ► ~~`fieldOpsFor` stamps `op.approximated ?? field.approximated`, so an
  //   operation already marked `glyph-missing` never receives its field's
  //   `html-markup-stripped`.~~ **FIXED AT THE CAUSE 2026-09-14: an operation's
  //   `approximated` is a LIST and the box below carries both reasons.** This
  //   test is kept and inverted rather than deleted, because it is the one
  //   place either reading can be checked against the other: the derived count
  //   (from the PLACEMENT, which is what this module does) and the direct count
  //   (filtering the operations) must now agree. They agreed before by luck —
  //   0 notdef operations across the real build's 187 placements — and the
  //   luck is what this case removes.
  const raw = syntheticScreensRaw();
  raw.screens.forum.textFields.push({
    id: 402, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, fontId: 7, fontHeight: 409.6,
    colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: 0, leading: 0,
    leftMargin: 0, rightMargin: 0, indent: 0, variableName: "loud_html",
    initialText: "<p align=\"center\">AB</p>", multiline: false, wordWrap: false, readOnly: true,
    path: [58], matrix: [1, 0, 0, 1, 0, 0]
  });
  // "Z" is not in the synthetic font, so the field draws one real glyph and one
  // hollow box — the collision, in two operations.
  const record = screenTextFor(screenPackFrom(raw), syntheticTextPack(), "forum", { values: { loud_html: "AZ" } });
  const loud = record.placements.find((one) => one.character === 402);
  assert.equal(loud.ops.length, 2);
  assert.equal(loud.notdef, 1);
  assert.deepEqual(loud.ops.map((op) => [...op.approximated]),
    [["html-markup-stripped"], ["glyph-missing", "html-markup-stripped"]],
    "► TWO reasons on the box, its own first: it says glyph-missing AND html-markup-stripped");
  assert.equal(record.ops.filter((op) => [...(op.approximated ?? [])].includes("html-markup-stripped")).length, 2,
    "► an ops-only filter for the field's mark now sees BOTH — it used to see one");
  assert.equal(record.approximations.htmlMarkupStrippedOps, 2,
    "► and the derived tally, taken from the PLACEMENT the field marked, agrees with it");
  assert.equal(record.approximatedOpsByKind["html-markup-stripped"], 2);
  assert.equal(record.approximatedOpsByKind["glyph-missing"], 1, "and the box is still counted as a box");
  assert.equal(record.approximations.glyphsNotdef, 1);
  assert.equal(record.approximations.htmlMarkupStripped, 2, "both html fields are counted as placements");
});

test("screenTextOpsFor hands back the picture with no invoice, and null when there is none", () => {
  const screens = syntheticScreens();
  const text = syntheticTextPack();
  const ops = screenTextOpsFor(screens, text, "forum");
  assert.equal(ops.length, screenTextFor(screens, text, "forum").counts.ops);
  const nothing = textPackFrom({ unitsPerEm: TEXT_UNITS_PER_EM, fonts: { 7: syntheticFont() }, statics: {}, fields: {}, placements: {} });
  assert.equal(screenTextOpsFor(screens, nothing, "forum"), null, "nothing drawn is null, not an empty array");
});

/* ------------------------------------------------------------------ */
/* Filters, and paint order                                            */
/* ------------------------------------------------------------------ */

test("A TEXT PLACEMENT UNDER A FILTERLIST CARRIES ITS GLOW, matched by path PREFIX", () => {
  // ► Hazard 4, and it is no longer only a count. `screen.js` marks its own
  //   operations `filtered` and says nothing about the text placements it hands
  //   over; this module reads its `filterGroups` roster, which carries the
  //   filter RECORDS. Matching is by prefix, not by root depth: a filter on a
  //   nested clip affects everything inside it and nothing beside it. The pack
  //   also carries a prefix LONGER than a placement's own path, which must not
  //   match — without that case the length guard could return either answer
  //   with every other test still green.
  const record = screenTextFor(syntheticScreens(), syntheticTextPack(), "forum");
  const under = record.placements.find((entry) => entry.character === 400);
  assert.deepEqual([...under.path], [55, 2]);
  assert.equal(under.approximated.includes("filtersCarried"), true, "[55] is a prefix of [55, 2]");
  assert.equal(under.approximated.includes("filtersNotApplied"), false,
    "► and the OLD mark is gone, because the glow is no longer dropped");
  assert.equal(under.ops.every((op) => op.filtered === true), true, "and the mark rides on every operation");

  // ► **THE GLOW IS ON THE FIELD, ONCE.** The literal is computed in
  //   `SYNTHETIC_GLOW`'s own comment from the SWF's blur radius, and it is a
  //   string that could have come out of this module a dozen wrong ways —
  //   sigma instead of twice sigma, the wrong colour, the stage scale baked in.
  assert.equal(under.filter, SYNTHETIC_GLOW_STRING);
  assert.equal(under.filterStages.length, 1, "one filtered subtree over this field");
  assert.deepEqual([...under.filterStages[0].path], [55]);
  assert.equal(under.filterStages[0].filter, SYNTHETIC_GLOW_STRING);
  assert.deepEqual([...under.filterStages[0].filters], [SYNTHETIC_GLOW],
    "► and the RECORDS travel too, because `filter` is the scale-1 string and a painter rebuilds it");
  assert.equal(under.filterStages[0].ownsThisFieldAlone, true,
    "[55] holds this one field and no shape, so rasterising the field IS rasterising the group");

  // ► **AND ON NOT ONE GLYPH.** A `ctx.filter` per operation is four words of
  //   painter and the wrong picture: `under` is two letters here and 630 on the
  //   build's `help`, and per-glyph would halo each letter separately.
  for (const op of under.ops) {
    for (const key of ["filter", "filters", "filterStages", "filterGroup", "colourMatrices", "refused", "deferred"]) {
      assert.equal(key in op, false, `no operation may carry ${key} — see FILTERS ON WORDS in screen-text.js`);
    }
  }

  const beside = record.placements.find((entry) => entry.character === 300);
  assert.deepEqual([...beside.path], [45]);
  assert.equal(beside.approximated.includes("filtersCarried"), false,
    "[45, 9, 9] is longer than [45] and is not a prefix of it");
  assert.equal(beside.filter, null, "so it carries no filter at all");
  assert.deepEqual([...beside.filterStages], []);
  assert.equal(beside.ops.some((op) => op.filtered === true), false);

  assert.equal(record.approximations.filtersCarried, 1, "ONE placement");
  assert.equal(record.approximations.filtersCarriedOps, 2, "carrying TWO operations — the two counts are not the same number");
  assert.equal(record.approximations.filtersNotApplied, 0, "and nothing was dropped");
  assert.equal(record.approximations.filtersNotAppliedOps, 0);
  assert.equal(record.counts.underAFilter, 1, "the denominator all four filter numbers are read against");
  assert.equal(record.counts.underAFilterOps, 2);

  // The group roster: one entry, naming the operations it covers.
  assert.equal(record.counts.filterGroups, 1);
  assert.equal(record.counts.filterGroupsCarrying, 1);
  assert.equal(record.counts.filterGroupsWiderThanOneField, 0);
  const group = record.filterGroups[0];
  assert.deepEqual([...group.path], [55]);
  assert.deepEqual([...group.placements], [record.placements.indexOf(under)]);
  assert.equal(group.shapeOpCount, 0, "`screen.js` puts no shape under [55]");
  assert.equal(group.opEnd - group.opFirst, 2);
  assert.equal(group.opCount, 2);
  assert.equal(group.contiguous, true);
  assert.deepEqual(record.ops.slice(group.opFirst, group.opEnd), [...under.ops],
    "► the RANGE really indexes this record's own `ops`, which is the only way a painter can use it");
});

test("THE FIXTURE'S FILTER RECORDS ARE LOAD-BEARING — strip them and the glow goes, not just a number", () => {
  // ► **THE MUTATION THAT WAS GREEN FOR MONTHS.** Until 2026-09-15 the
  //   `filteredPlacements` entries in this file carried a `path` and no
  //   `filters` at all, and every filter assertion here passed anyway, because
  //   the module read the path and threw the records away. This test is the
  //   guard against that returning: with the records removed the group is still
  //   FOUND — the placement is still marked filtered, still counted — and
  //   nothing is carried. A module that went back to reading paths alone would
  //   turn the previous test red; a module that stopped finding groups at all
  //   would turn this one red.
  const raw = syntheticScreensRaw();
  raw.screens.forum.filteredPlacements = [{ character: 99, path: [55] }];
  const record = screenTextFor(screenPackFrom(raw), syntheticTextPack(), "forum");
  const under = record.placements.find((entry) => entry.character === 400);
  assert.equal(under.filter, null, "no records, no string");
  assert.equal(under.filterStages.length, 1, "but the subtree is still there and still named");
  assert.deepEqual([...under.filterStages[0].filters], []);
  assert.equal(record.approximations.filtersCarried, 0);
  assert.equal(record.approximations.filtersNotApplied, 1, "► and THIS is what the old number meant");
  assert.equal(record.approximations.filtersNotAppliedOps, 2);
  assert.equal(record.counts.underAFilter, 1, "the denominator does not move — the same placement is under the same filter");
  assert.equal(record.counts.underANoOpFilterOnly, 0,
    "an EMPTY list is a hole, not a filter measured to draw nothing — the difference is the silent loss");
});

test("CARRIED, DEFERRED AND REFUSED ARE THREE DIFFERENT ANSWERS, and all three are counted", () => {
  // ► Every one of the three is ZERO on the real build except `filtersCarried`,
  //   and a zero nothing can disturb is not a counter. These are the inputs
  //   that reach them: an INNER glow (canvas `drop-shadow` has no inset form,
  //   3 of them in the oracle), a COLOUR MATRIX (deferred to
  //   `applyColourMatrix`, 636 in the oracle and 0 on text), and a
  //   ZERO-STRENGTH glow (208 in the oracle), which is measured to draw nothing
  //   and so is a no-op rather than a loss.
  const inner = { ...SYNTHETIC_GLOW, inner: true };
  const matrix = { type: "colourMatrix", matrix: [0.5, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 1, 0] };
  const dead = { ...SYNTHETIC_GLOW, strength: 0 };

  const refusedRecord = screenTextFor(packWithFilters([{ character: 99, path: [55], filters: [inner] }]),
    syntheticTextPack(), "forum");
  assert.equal(refusedRecord.approximations.filtersRefused, 1);
  assert.equal(refusedRecord.approximations.filtersRefusedOps, 2);
  assert.equal(refusedRecord.approximations.filtersCarried, 0, "an inner glow is not a carried glow");
  assert.equal(refusedRecord.approximations.filtersNotApplied, 1, "and the field is left without it");
  assert.deepEqual([...refusedRecord.filterGroups[0].refused].map((entry) => entry.reason),
    ["innerShadowHasNoCanvasFilter"], "named by `canvasFilterFor`, not renamed here");

  const matrixRecord = screenTextFor(packWithFilters([{ character: 99, path: [55], filters: [matrix] }]),
    syntheticTextPack(), "forum");
  assert.equal(matrixRecord.approximations.filtersDeferredToColourMatrix, 1);
  assert.equal(matrixRecord.approximations.filtersDeferredToColourMatrixOps, 2);
  assert.equal(matrixRecord.approximations.filtersCarried, 0,
    "► a colour matrix is NOT in `filter`, and a painter reading `filter` alone must be told");
  assert.equal(matrixRecord.placements.find((entry) => entry.character === 400).filter, null);
  assert.equal(matrixRecord.approximations.filtersNotApplied, 0, "but it IS carried — on `colourMatrices`");
  assert.equal(matrixRecord.filterGroups[0].colourMatrices.length, 1);

  const deadRecord = screenTextFor(packWithFilters([{ character: 99, path: [55], filters: [dead] }]),
    syntheticTextPack(), "forum");
  assert.equal(deadRecord.approximations.filtersNotApplied, 1, "nothing was handed over");
  assert.equal(deadRecord.counts.underANoOpFilterOnly, 1,
    "► and nothing NEEDED to be: `canvasFilterFor` measured that this glow draws no pixels");
  assert.equal(deadRecord.approximations.filtersRefused, 0, "which is not the same as canvas being unable to");

  // All four marks on ONE placement at once, because they are four questions
  // and not a partition — a sum of them would be 4 where there is 1 placement.
  const both = screenTextFor(packWithFilters([{ character: 99, path: [55], filters: [SYNTHETIC_GLOW, inner, matrix] }]),
    syntheticTextPack(), "forum");
  assert.equal(both.approximations.filtersCarried, 1);
  assert.equal(both.approximations.filtersRefused, 1);
  assert.equal(both.approximations.filtersDeferredToColourMatrix, 1);
  assert.equal(both.approximations.filtersNotApplied, 0);
  assert.equal(both.counts.underAFilter, 1, "► ONE placement, three marks — the denominator is not their sum");
});

test("A GROUP WIDER THAN THE FIELD IS NAMED, because a per-field rasterise would be the wrong picture", () => {
  // ► ZERO on the real build — all 113 of its text groups sit exactly on the
  //   field they filter — so the counter needs a pack that opens the case. Two
  //   shapes of "wider": a group over TWO fields, and a group over a field AND
  //   a shape operation. In both, Flash rasterises everything under the group
  //   and filters the composite, so `placement.filter` must go null and the
  //   painter must walk `record.filterGroups` instead.
  const raw = syntheticScreensRaw();
  // A second field under [55], beside the one at [55, 2].
  raw.screens.forum.textFields.push({
    id: 402, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, fontId: 7, fontHeight: 409.6,
    colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: 0, leading: 0,
    leftMargin: 0, rightMargin: 0, indent: 0, variableName: "loud_html",
    initialText: "<p>AB</p>", multiline: false, wordWrap: false, readOnly: true,
    path: [55, 4], matrix: [1, 0, 0, 1, 0, 0]
  });
  raw.screens.forum.unresolved.push({ kind: "text-edit", character: 402, path: [55, 4], detail: "second field under [55]" });
  raw.screens.forum.filteredPlacements = [{ character: 99, path: [55], filters: [SYNTHETIC_GLOW] }];
  const twoFields = screenTextFor(screenPackFrom(raw), syntheticTextPack(), "forum");
  assert.equal(twoFields.approximations.filtersOnAWiderGroup, 2, "BOTH fields are under it");
  assert.equal(twoFields.approximations.filtersOnAWiderGroupOps, 4);
  assert.equal(twoFields.counts.filterGroupsWiderThanOneField, 1, "and it is ONE group — a different question");
  for (const character of [400, 402]) {
    assert.equal(twoFields.placements.find((entry) => entry.character === character).filter, null,
      "► the per-field shortcut is refused, because this field is not the whole of the group");
  }
  assert.equal(twoFields.filterGroups[0].filter, SYNTHETIC_GLOW_STRING,
    "the group still carries the glow — it is the painter's unit now, not the field");
  assert.deepEqual([...twoFields.filterGroups[0].placements].length, 2);
  assert.equal(twoFields.approximations.filtersCarried, 2, "and both fields are still counted as carrying it");

  // A group over a field and a SHAPE: [50] holds the shape at [50, 1].
  const mixed = syntheticScreensRaw();
  mixed.screens.forum.textFields.push({
    id: 404, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, fontId: 7, fontHeight: 409.6,
    colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: 0, leading: 0,
    leftMargin: 0, rightMargin: 0, indent: 0, variableName: "beside_a_shape",
    initialText: "AB", multiline: false, wordWrap: false, readOnly: true,
    path: [50, 2], matrix: [1, 0, 0, 1, 0, 0]
  });
  mixed.screens.forum.unresolved.push({ kind: "text-edit", character: 404, path: [50, 2], detail: "a field beside a shape" });
  mixed.screens.forum.filteredPlacements = [{ character: 95, path: [50], filters: [SYNTHETIC_GLOW] }];
  const record = screenTextFor(screenPackFrom(mixed), syntheticTextPack(), "forum",
    { values: { beside_a_shape: "AB" } });
  const field = record.placements.find((entry) => entry.character === 404);
  assert.equal(field.filterStages[0].ownsThisFieldAlone, false,
    "► one text placement, but a SHAPE under the same group — the field is not the whole composite");
  assert.equal(field.filter, null);
  assert.equal(record.approximations.filtersOnAWiderGroup, 1);
  assert.equal(record.filterGroups[0].shapeOpCount, 1,
    "and `screen.js`'s own count of the shapes under it is what says so");
  assert.equal(screenFor(screenPackFrom(mixed), "forum").filterGroups.find((g) => g.path.join() === "50").opCount, 1,
    "cross-checked against screen.js directly, so this is not this module quoting itself");
});

test("THE CROSS-MODULE CONTRACT: screen.js supplies the roster, and losing it must be LOUD", () => {
  // ► **THE DEPENDENCY THIS FILE ACQUIRED ON 2026-09-15, PINNED FROM BOTH
  //   ENDS.** Everything above reads `screenFor(...).filterGroups`. If that
  //   ever stops being an array — an older `screen.js`, a revert, a stub — this
  //   module reports zero filters on every screen and looks entirely correct,
  //   which is the failure this project keeps paying for. So the contract is
  //   asserted directly rather than inferred from a count that would read the
  //   same either way.
  assert.equal(Array.isArray(screenFor(syntheticScreens(), "forum").filterGroups), true,
    "screen.js must hand over a filter roster");
  assert.equal(screenTextFor(syntheticScreens(), syntheticTextPack(), "forum").filterGroupsPresent, true);
  // ► **AND `placementTextFor` IS TOTAL WITHOUT ONE**, which is the branch a
  //   caller driving the atom on its own takes. It is reachable here and is NOT
  //   reachable through `screenTextFor`, so `filterGroupsPresent` is a flag for
  //   a runtime consumer and this is the assertion with teeth.
  const placement = { kind: "text-static", character: 300, path: [45], matrix: [1, 0, 0, 1, 0, 0] };
  for (const groups of [undefined, null, [], "filters", 7, [{}], [{ path: null }], [{ path: [] }]]) {
    const resolved = placementTextFor(syntheticTextPack(), placement, { filterGroups: groups });
    assert.equal(resolved.filter, null, `${JSON.stringify(groups)} is not a filter group`);
    assert.deepEqual([...resolved.filterStages], [], "and produces no stage rather than throwing");
    assert.equal(resolved.approximated.includes("filtersNotApplied"), false,
      "► an absent group is NOT a dropped filter, and counting it as one invents an approximation");
  }
  // A group that IS one, handed straight to the atom with no screen in sight.
  const lit = placementTextFor(syntheticTextPack(), placement, {
    filterGroups: [{ path: [45], filters: [SYNTHETIC_GLOW], source: "placement", character: 99 }]
  });
  assert.equal(lit.filter, SYNTHETIC_GLOW_STRING, "the atom builds the string itself, from `filters`");
  assert.equal(lit.filterStages[0].ownsThisFieldAlone, true,
    "and with nothing measured it falls back to path EQUALITY, which is exact for a display-list leaf");
  assert.equal(lit.approximated.includes("filtersCarried"), true);
});

test("a filter entry with no path at all filters NOTHING, rather than the whole screen", () => {
  // ► An empty prefix is vacuously a prefix of everything. A hand-edited or
  //   truncated pack with one `filteredPlacements` entry missing its path would
  //   otherwise mark every word on the screen filtered and inflate the tally by
  //   the screen's whole text count — an approximation invented rather than
  //   observed, which is the same class of error as one dropped.
  const raw = syntheticScreensRaw();
  raw.screens.forum.filteredPlacements = [{ character: 97, path: [] }];
  const record = screenTextFor(screenPackFrom(raw), syntheticTextPack(), "forum");
  assert.equal(record.approximations.filtersNotApplied, 0);
  assert.equal(record.approximations.filtersNotAppliedOps, 0);
  assert.equal(record.placements.every((entry) => entry.approximated.length === 0 || !entry.approximated.includes("filtersNotApplied")), true);
});

test("PAINT ORDER IS THE WHOLE PATH, so words interleave with shapes rather than sitting on top", () => {
  // Derived rather than assumed: a placement carries `path`, its chain of
  // depths from the root, and `depth` is only `path[0]`. Sorting by depth alone
  // would put both statics ([45], [46]) and the field ([55, 2]) in one bucket
  // per root depth and lose their order against the shapes at [50, 1] and [60].
  const merged = screenWithTextFor(syntheticScreens(), syntheticTextPack(), "forum");
  const order = merged.ops.map((op) => `${op.path.join("/")}:${op.source === "text" ? "word" : "shape"}`);
  assert.deepEqual(order, [
    "3:shape",
    "45:word", "45:word",
    "46:word",
    "50/1:shape",
    "55/2:word", "55/2:word",
    "60:shape"
  ], "a word at depth 45 paints over the shape at 3 and under the shape at 50");

  // And the shape half comes back in exactly the order `screen.js` emitted it.
  const shapes = merged.ops.filter((op) => op.source !== "text");
  assert.deepEqual(shapes, [...merged.screen.ops], "the sort never permutes the shape operations");
  for (let index = 1; index < merged.ops.length; index += 1) {
    assert.equal(comparePath(merged.ops[index - 1].path, merged.ops[index].path) <= 0, true,
      "and the merged list is non-decreasing in path order throughout");
  }
  assert.equal(merged.counts.ops, merged.counts.shapeOps + merged.counts.glyphOps);
  assert.equal(merged.counts.textStillNotDrawn, 3,
    "► and screen.js's textNotDrawn of 6 has become 3, which is the number its header asked for");
});

test("A PATH PAINTS BEFORE EVERY PATH IT IS A PREFIX OF — the tiebreak, which nothing pinned", () => {
  // ► **`comparePath`'s LAST LINE WAS UNREACHABLE BY EVERY ASSERTION IN THIS
  //   FILE.** Mutating `return a.length - b.length` to `return 0` left all 31
  //   tests green, because NO pair of paths on the 26 real screens is a strict
  //   prefix of another — measured, 0 such pairs among the 13612 adjacent
  //   operation pairs and 0 among the distinct paths. The behaviour is stated
  //   in the function's own docstring and in `screen.js`'s, and this module
  //   already fixed the identical construct in `underAnyPrefix` after a
  //   mutation run deleted a redundant guard with the suite still green. So it
  //   is pinned here rather than argued about: the module's own header says a
  //   hand-edited pack whose drawables are out of order must come out painted
  //   in the right order, and that is exactly the pack this test builds.
  //
  //   The order has to be WRONG in the concatenation for the tiebreak to show:
  //   `screenWithTextFor` puts the shape operations first, so a SHAPE at [50,1]
  //   under a WORD at [50] is the one arrangement a stable sort alone cannot
  //   repair. The synthetic screen already has that shape.
  const raw = syntheticScreensRaw();
  raw.screens.forum.textFields.push({
    id: 400, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, fontId: 7, fontHeight: 409.6,
    colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: 0, leading: 0,
    leftMargin: 0, rightMargin: 0, indent: 0, variableName: "about_fight_text",
    initialText: "AB", multiline: false, wordWrap: false, readOnly: true,
    path: [50], matrix: [1, 0, 0, 1, 0, 0]
  });
  const merged = screenWithTextFor(screenPackFrom(raw), syntheticTextPack(), "forum");
  const order = merged.ops.map((op) => op.path.join("/"));
  assert.deepEqual(order, ["3", "45", "45", "46", "50", "50", "50/1", "55/2", "55/2", "60"],
    "► the two glyphs at [50] paint UNDER the shape at [50, 1], which is what a chain of depths means");
  assert.equal(order.indexOf("50") < order.indexOf("50/1"), true);
  assert.equal(merged.ops[order.indexOf("50")].source, "text", "and the shorter path is the word");
  assert.equal(merged.ops[order.indexOf("50/1")].source, undefined, "and the longer is the shape");
  // The concatenation the sort was handed, so the assertion above is testing
  // the comparator and not the order the two halves happened to arrive in.
  assert.equal(merged.screen.ops.map((op) => op.path.join("/")).indexOf("50/1"), 1,
    "the shape at [50, 1] was second in the shape half, ahead of every glyph operation");
});

test("every operation carries the trail back to the placement that put it there", () => {
  const record = screenTextFor(syntheticScreens(), syntheticTextPack(), "forum");
  for (const placement of record.placements) {
    for (const op of placement.ops) {
      assert.equal(op.source, "text", "so a merged list can tell a word from a shape");
      assert.equal(op.character, placement.character);
      assert.equal(op.textKind, placement.kind);
      assert.deepEqual([...op.path], [...placement.path]);
      assert.equal(op.depth, placement.path[0]);
      assert.equal(Object.isFrozen(op), true);
    }
  }
  assert.equal(Object.isFrozen(record.ops), true);
  assert.equal(Object.isFrozen(record.placements), true);
});

/* ------------------------------------------------------------------ */
/* The real packs                                                      */
/* ------------------------------------------------------------------ */

test("THE 187 PLACEMENTS: 70 static, 117 edit, and every one of them resolves", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  const screens = screenPackFrom(REAL_SCREENS);
  const text = textPackFrom(REAL_TEXT);
  const names = joinableScreenNames(screens, text);
  assert.equal(names.length, 26);

  const totals = { placements: 0, statics: 0, fields: 0, drawn: 0, undrawn: 0, ops: 0 };
  const undrawn = {};
  for (const kind of SCREEN_TEXT_UNDRAWN_KINDS) undrawn[kind] = 0;
  for (const name of names) {
    const record = screenTextFor(screens, text, name);
    for (const key of Object.keys(totals)) totals[key] += record.counts[key];
    for (const kind of SCREEN_TEXT_UNDRAWN_KINDS) undrawn[kind] += record.undrawnByKind[kind];
    assert.equal(record.counts.placements, screenFor(screens, name).text.length, `${name}: the same placements screen.js counts`);
  }
  assert.equal(totals.placements, 187);
  assert.equal(totals.statics, 70);
  assert.equal(totals.fields, 117);
  // ► **EVERY CHARACTER RESOLVES IN THE TEXT PACK.** Two extractors run over
  //   the same SWF in different sessions, and not one of the 187 ids the
  //   screens pack names is absent from the text pack's 180 statics and 256
  //   fields. If that ever stops being true the count is the finding.
  assert.equal(undrawn["character-missing"], 0);
  assert.equal(undrawn["font-missing"], 0);
  assert.equal(totals.drawn, 159, "159 of the 187 draw straight out of the two packs");
  assert.equal(undrawn["value-unknown"], 23, "23 are fields waiting on a value the build's ActionScript writes");
  assert.equal(undrawn["nothing-to-draw"], 5, "and 5 have nothing inked to show");
  assert.equal(totals.drawn + totals.undrawn, totals.placements);
  assert.equal(totals.ops, 2236, "2236 glyph operations across the 26 screens");
});

test("THE JOIN REPRODUCES THE WORDS — 70 static runs, letter for letter, across two packs", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  // ► **THIS IS A CROSS-PACK CHECK AND NOT A ROUND TRIP.** `screens.json`
  //   decodes a static's glyph indices into a STRING and carries no outlines;
  //   `text.json` carries the outlines and its static records have no decoded
  //   string at all. So reading the characters back off the drawn operations
  //   and comparing them with the screens pack's words tests the two
  //   extractions against each other, through the font's code table.
  const screens = screenPackFrom(REAL_SCREENS);
  const text = textPackFrom(REAL_TEXT);
  let checked = 0;
  for (const name of joinableScreenNames(screens, text)) {
    for (const placement of screenTextFor(screens, text, name).placements) {
      if (placement.kind !== "text-static") continue;
      const drawn = placement.ops.map((op) => op.glyph.char ?? "�").join("");
      // A space and a line break advance and ink nothing, so they are the only
      // characters the drawn string is allowed to be missing.
      assert.equal(drawn, placement.value.replace(/\s/g, ""), `${name}: static ${placement.character}`);
      checked += 1;
    }
  }
  assert.equal(checked, 70);
});

test("THE TWENTY-TWO SHIFTED STATICS: dropping a character's own matrix moves it up to 68.9 px", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  // ► The real-pack size of the defect the synthetic test above pins the shape
  //   of. Measured here rather than quoted: how many static placements sit on a
  //   character with a non-identity own matrix, and how far the words move if
  //   the join forwards the placement matrix raw.
  const screens = screenPackFrom(REAL_SCREENS);
  const text = textPackFrom(REAL_TEXT);
  let shifted = 0;
  let worst = 0;
  let worstInked = 0;
  for (const name of joinableScreenNames(screens, text)) {
    // The RAW placements, whose `matrix` has not yet been composed with
    // anything, beside the joined ones, whose `matrix` has.
    const raw = screenFor(screens, name).text;
    const joined = screenTextFor(screens, text, name).placements;
    for (let index = 0; index < raw.length; index += 1) {
      if (raw[index].kind !== "text-static") continue;
      assert.equal(joined[index].character, raw[index].character, "the two lists are in the same order");
      const composed = composeTextMatrix(raw[index].matrix, REAL_TEXT.statics[raw[index].character]?.matrix);
      assert.deepEqual([...joined[index].matrix], [...composed], "and the join really is composing them");
      // The displacement a raw forward would cause, which is NOT simply the
      // character's own offset: the placement's LINEAR part scales it. Static
      // 1511 on `splash` is a 62.95 px offset under a 1.49997 scale.
      const distance = Math.hypot(composed[4] - raw[index].matrix[4], composed[5] - raw[index].matrix[5]) / TWIPS_PER_PIXEL;
      if (distance > 0) shifted += 1;
      worst = Math.max(worst, distance);
      if (joined[index].drawn) worstInked = Math.max(worstInked, distance);
    }
  }
  assert.equal(shifted, 22, "22 of the 70 static placements move");
  assert.equal(Math.round(worst * 100) / 100, 94.42, "the worst of them by 94.42 px");
  assert.equal(Math.round(worstInked * 100) / 100, 68.9, "and 68.9 px among the runs that put ink down");
});

test("THE INK LANDS INSIDE THE BOX THE SCREENS PACK DECLARES — the composition, checked against a third number", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  // The screens pack states each placement's bounding box in pixels, written by
  // a pass that draws nothing. Pushing the drawn glyphs through their own
  // matrices and asking whether they land inside that box, pushed through the
  // placement matrix, is therefore an INDEPENDENT check on the composition —
  // and the one that fails loudly if the outer matrix stops composing.
  const screens = screenPackFrom(REAL_SCREENS);
  const text = textPackFrom(REAL_TEXT);
  let inside = 0;
  let outside = 0;
  for (const name of joinableScreenNames(screens, text)) {
    for (const placement of screenTextFor(screens, text, name).placements) {
      if (placement.kind !== "text-static" || !placement.drawn || !placement.box) continue;
      const ink = inkOf(placement.ops);
      // ► The box is stated in the character's own POST-text-matrix space —
      //   measured: static 1503's bounds start at 2383 twips and its records'
      //   pen, once its own 1012-twip matrix is applied, at 2392 — so the box
      //   is pushed through the PLACEMENT alone while the glyphs have already
      //   been through the composition. Undoing the composition here is what
      //   makes this a check and not a tautology.
      const m = placement.matrix;
      const own = REAL_TEXT.statics[placement.character]?.matrix ?? [1, 0, 0, 1, 0, 0];
      const outer = [m[0], m[1], m[2], m[3], m[4] - own[4], m[5] - own[5]];
      const xs = [];
      const ys = [];
      for (const x of [placement.box.x, placement.box.x + placement.box.width]) {
        for (const y of [placement.box.y, placement.box.y + placement.box.height]) {
          xs.push(outer[0] * x + outer[2] * y + outer[4] / TWIPS_PER_PIXEL);
          ys.push(outer[1] * x + outer[3] * y + outer[5] / TWIPS_PER_PIXEL);
        }
      }
      const slack = 0.75;
      const fits = ink.xMin >= Math.min(...xs) - slack && ink.xMax <= Math.max(...xs) + slack
        && ink.yMin >= Math.min(...ys) - slack && ink.yMax <= Math.max(...ys) + slack;
      if (fits) inside += 1; else outside += 1;
    }
  }
  assert.equal(outside, 0, "every drawn static run's ink is inside the box its own pack declares");
  assert.equal(inside, 68, "and 68 of the 70 draw ink at all");
});

test("THE UNITS: 186 of the 187 boxes land on the stage as TWIPS, and 2 as pixels", () => {
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  // ► The seam `screen.js`'s header says has cost this project three defects,
  //   settled by measurement rather than by reading either header: a placement
  //   matrix's translation is in TWIPS and everything it acts on is in PIXELS.
  //   Read the other way round, 185 of the 187 boxes leave the 640 x 420 stage.
  const screens = screenPackFrom(REAL_SCREENS);
  const stage = screenFor(screens, "splash").stage;
  let asTwips = 0;
  let asPixels = 0;
  for (const name of screenNames(screens)) {
    for (const placement of screenFor(screens, name).text) {
      const m = placement.matrix;
      let twips = true;
      let pixels = true;
      for (const x of [placement.box.x, placement.box.x + placement.box.width]) {
        for (const y of [placement.box.y, placement.box.y + placement.box.height]) {
          const tx = m[0] * x + m[2] * y + m[4] / TWIPS_PER_PIXEL;
          const ty = m[1] * x + m[3] * y + m[5] / TWIPS_PER_PIXEL;
          if (tx < -40 || tx > stage.width + 40 || ty < -40 || ty > stage.height + 40) twips = false;
          const px = m[0] * x + m[2] * y + m[4];
          const py = m[1] * x + m[3] * y + m[5];
          if (px < -40 || px > stage.width + 40 || py < -40 || py > stage.height + 40) pixels = false;
        }
      }
      if (twips) asTwips += 1;
      if (pixels) asPixels += 1;
    }
  }
  assert.equal(asTwips, 186, "the one that misses is error_message, parked below the stage on purpose");
  assert.equal(asPixels, 2);
});

test("THE FIVE HTML FIELDS, of which FOUR draw nothing at all", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  const screens = screenPackFrom(REAL_SCREENS);
  const text = textPackFrom(REAL_TEXT);
  let placements = 0;
  let ops = 0;
  let drew = 0;
  let filtered = 0;
  let filteredOps = 0;
  let placeholders = 0;
  for (const name of joinableScreenNames(screens, text)) {
    const record = screenTextFor(screens, text, name);
    placements += record.approximations.htmlMarkupStripped;
    ops += record.approximations.htmlMarkupStrippedOps;
    filtered += record.counts.underAFilter;
    filteredOps += record.counts.underAFilterOps;
    placeholders += record.approximations.placeholderDrawn;
    for (const entry of record.placements) {
      if (entry.approximated.includes("html-markup-stripped") && entry.drawn) drew += 1;
    }
  }
  assert.equal(placements, 5, "five fields carry real markup");
  assert.equal(drew, 1, "► and only ONE of them emits an operation");
  assert.equal(ops, 65, "so an operations-only tally would report 1 approximation where there are 5");
  assert.equal(filtered, 113, "► 113 of the 187 placements sit under a filter, where this file said 108 until 2026-09-15");
  assert.equal(filteredOps, 1689, "and 1689 of the 2236 glyph operations — a different question, and a different number");
  assert.equal(placeholders, 91, "and 91 draw the author's placeholder rather than a live value");
});

test("THE OPEN TALLY ON THE REAL PACKS, and the 114 GLYPH MARKS THAT REACH NOTHING", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  const screens = screenPackFrom(REAL_SCREENS);
  const text = textPackFrom(REAL_TEXT);

  // ► **THE FINDING THAT MADE HAZARD 5 INVISIBLE, MEASURED RATHER THAN
  //   ASSUMED.** Font 1510 is the one font in this build with no layout block,
  //   and the extractor had to derive every one of its advances — 112 from the
  //   glyph outline, 2 from a sibling font. `text.js` stamps a glyph's mark
  //   onto every operation it draws from that glyph, so those 114 marks are one
  //   placement away from an operation. They do not reach one HERE, and this is
  //   why: exactly ONE static in the whole pack names font 1510, and its single
  //   glyph is empty.
  const font = fontFor(text, 1510);
  const glyphKinds = {};
  for (const glyph of font.glyphs) glyphKinds[glyph.approximated ?? "(none)"] = (glyphKinds[glyph.approximated ?? "(none)"] ?? 0) + 1;
  assert.deepEqual(glyphKinds, { "advance-from-outline": 112, "advance-from-sibling-font": 2 },
    "every one of font 1510's 114 glyphs carries an approximated advance");
  const on1510 = Object.entries(text.statics)
    .filter(([, item]) => (item.records ?? []).some((record) => record.font === 1510))
    .map(([id]) => Number(id));
  assert.deepEqual(on1510, [1511], "and one static names it");
  assert.equal((staticTextOpsFor(text, 1511) ?? []).length, 0, "► which draws NOTHING — its one glyph is empty");

  const byKind = {};
  const opsByKind = {};
  const unrostered = new Set();
  let notdef = 0;
  for (const name of joinableScreenNames(screens, text)) {
    const record = screenTextFor(screens, text, name);
    for (const [kind, count] of Object.entries(record.approximatedByKind)) byKind[kind] = (byKind[kind] ?? 0) + count;
    for (const [kind, count] of Object.entries(record.approximatedOpsByKind)) opsByKind[kind] = (opsByKind[kind] ?? 0) + count;
    for (const kind of record.unrosteredApproximations) unrostered.add(kind);
    for (const placement of record.placements) notdef += placement.notdef;

    // THE PROJECTION, on every screen: each roster key is copied out of the
    // open tally, so a roster that disagreed with it would be a second opinion.
    assert.equal(record.approximations.filtersNotApplied, record.approximatedByKind.filtersNotApplied ?? 0, name);
    assert.equal(record.approximations.filtersNotAppliedOps, record.approximatedOpsByKind.filtersNotApplied ?? 0, name);
    assert.equal(record.approximations.filtersCarried, record.approximatedByKind.filtersCarried ?? 0, name);
    assert.equal(record.approximations.filtersCarriedOps, record.approximatedOpsByKind.filtersCarried ?? 0, name);
    assert.equal(record.approximations.filtersRefused, record.approximatedByKind.filtersRefused ?? 0, name);
    assert.equal(record.approximations.filtersDeferredToColourMatrix,
      record.approximatedByKind.filtersDeferredToColourMatrix ?? 0, name);
    assert.equal(record.approximations.filtersOnAWiderGroup, record.approximatedByKind.filtersOnAWiderGroup ?? 0, name);
    assert.equal(record.approximations.htmlMarkupStripped, record.approximatedByKind["html-markup-stripped"] ?? 0, name);
    assert.equal(record.approximations.htmlMarkupStrippedOps, record.approximatedOpsByKind["html-markup-stripped"] ?? 0, name);
    assert.equal(record.approximations.placeholderDrawn, record.approximatedByKind.placeholderDrawn ?? 0, name);
    assert.equal(record.approximations.glyphsNotdef, record.approximatedOpsByKind["glyph-missing"] ?? 0, name);
    assert.equal(record.approximations.lineHeightFromSize, record.approximatedByKind.lineHeightFromSize ?? 0, name);
    assert.equal(record.approximations.newlineCollapsed, record.approximatedByKind.newlineCollapsed ?? 0, name);
  }

  assert.deepEqual(byKind, { filtersCarried: 112, filtersNotApplied: 1, placeholderDrawn: 91, "html-markup-stripped": 5 },
    "four kinds occur across the 26 screens, and these are the placements each affects");
  assert.deepEqual(opsByKind, { filtersCarried: 1680, filtersNotApplied: 9, placeholderDrawn: 689, "html-markup-stripped": 65 },
    "and these are the operations — 689 of the 2236 glyphs are the author's placeholder, a number nothing reported before");
  assert.equal(notdef, 0, "0 notdef operations across the 187 placements, so the two marks have never yet collided here");
  assert.deepEqual([...unrostered], [],
    "► NOTHING is unrostered on this extraction — a measurement of ONE pack, not a property of the format: "
    + "font 1510's 114 marks are one non-empty placement away from landing here");
});

test("splash says \"play\", in the build's own letterforms, at the build's own place", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  // One screen, one word, one place: character 1503 on `splash`, placed at
  // 3777 twips with its own text matrix adding 1012 and its record's pen
  // another 1380 — so the 'p' belongs at 6169 twips, which is 308.45 px.
  const record = screenTextFor(screenPackFrom(REAL_SCREENS), textPackFrom(REAL_TEXT), "splash");
  const play = record.placements.find((entry) => entry.character === 1503);
  assert.equal(play.kind, "text-static");
  assert.equal(play.value, "play");
  assert.deepEqual([...play.path], [45]);
  assert.deepEqual([...play.matrix], [1, 0, 0, 1, 4789, 5923], "3777 from the screen, 1012 from the character");
  assert.equal(play.ops.map((op) => op.glyph.char).join(""), "play");
  assert.deepEqual([...play.ops[0].matrix], [1, 0, 0, 1, 6169, 6203], "the 'p' at 308.45 px, 310.15 px");
  assert.deepEqual([...play.ops[3].matrix], [1, 0, 0, 1, 6521, 6203], "and the 'y' three baked advances later");
  assert.equal(play.ops[0].fill, "#ffffff");
  assert.equal(play.ops[0].glyph.font, 53, "GoudyHandtooled BT, the build's display face");
});

test("the arena's UI bar reads \"sound:ON\" and \"tooltips:off\", where the build puts them", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  // The two `DefineEditText` children of sprite 1531 that `text.js`'s header
  // says were "dropped by extract-props.mjs as an unsupported character and
  // reported honestly as a failure". They are on all 26 screens; this is the
  // arena's copy, joined through the screen that places it.
  const record = screenTextFor(screenPackFrom(REAL_SCREENS), textPackFrom(REAL_TEXT), "arena");
  const sound = record.placements.find((entry) => entry.character === 1527);
  assert.deepEqual([...sound.path], [438, 5], "inside the fiz_info_panel at root depth 438");
  assert.equal(sound.ops.map((op) => op.glyph.char).join(""), "sound:ON");
  assert.deepEqual([...sound.ops[0].matrix], [0.99974, 0, 0, 1, 1810, 8240.547]);
  const tooltips = record.placements.find((entry) => entry.character === 1528);
  assert.equal(tooltips.ops.map((op) => op.glyph.char).join(""), "tooltips:off");
  assert.equal(record.counts.placements, 3, "the arena carries three text placements");
});

test("THE ARENA UI BAR NOW GLOWS — one soft edge around the words, not one around each letter", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  // ► **THE TWO CHARACTERS THREE MODULES HAVE NOW MET FROM THREE DIRECTIONS.**
  //   `props.js` records 1527 and 1528 under `effects.own.dropped` on the
  //   arena's `panel` — a glow each, with no shape in the props pack to put it
  //   on. `screen.js` counts them among the 113 filter groups that reach no
  //   shape operation. They are `DefineEditText` children of sprite 1531, they
  //   are on all 26 screens, and their glow reaches a drawable HERE or nowhere.
  const record = screenTextFor(screenPackFrom(REAL_SCREENS), textPackFrom(REAL_TEXT), "arena");
  const sound = record.placements.find((entry) => entry.character === 1527);
  const tooltips = record.placements.find((entry) => entry.character === 1528);
  assert.deepEqual([...sound.path], [438, 5], "inside the fiz_info_panel at root depth 438");
  assert.deepEqual([...tooltips.path], [438, 6]);

  // The literal, not a recomputation: this is the build's own glow — blurX and
  // blurY of 1.5 at one pass, so `blurSigma` is sqrt((2.25-1)/12) = 0.322749…,
  // and `drop-shadow`'s third length is TWICE that. A module that handed sigma
  // straight to `drop-shadow` would write 0.3227px here and draw the bar at
  // half the intended width; one that forgot the alpha would write rgba(...,0).
  const GLOW = "drop-shadow(0px 0px 0.6455px rgba(0, 0, 0, 1))";
  assert.equal(sound.filter, GLOW, "a tight black glow, which is what makes the readout legible on the backdrop");
  assert.equal(tooltips.filter, GLOW);
  assert.equal(sound.approximated.includes("filtersCarried"), true);
  assert.equal(sound.approximated.includes("filtersNotApplied"), false,
    "► it used to be this mark and nothing else, on all 52 copies of this pair");

  // ► **ONCE PER FIELD.** `sound:ON` is 8 glyph operations and `tooltips:off`
  //   is 12. A `ctx.filter` per operation would draw 20 haloes where the build
  //   draws two, and each would sit around ONE letter.
  assert.equal(sound.ops.map((op) => op.glyph.char).join(""), "sound:ON");
  assert.equal(sound.ops.length, 8);
  assert.equal(tooltips.ops.map((op) => op.glyph.char).join(""), "tooltips:off");
  assert.equal(tooltips.ops.length, 12);
  assert.equal(record.counts.filterGroups, 3, "three groups on the arena, one per placement");
  for (const group of record.filterGroups) {
    assert.equal(group.placements.length, 1, "each sits on exactly one field");
    assert.equal(group.shapeOpCount, 0, "and on no shape at all — which is why screen.js could not draw it");
    assert.equal(group.ownsOneFieldAlone, true);
  }

  // THE PAINTER'S UNIT, checked the way a painter would use it.
  const soundGroup = record.filterGroups.find((group) => group.character === 1527);
  assert.deepEqual(record.ops.slice(soundGroup.opFirst, soundGroup.opEnd), [...sound.ops],
    "the range names exactly this field's eight operations in this record's own `ops`");
});

test("EVERY GLOW ON EVERY WORD IN THE BUILD REACHES THE PAINTER — 112 of 113, and the 113th is EMPTY", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  const screens = screenPackFrom(REAL_SCREENS);
  const text = textPackFrom(REAL_TEXT);
  const strings = {};
  const totals = { underAFilter: 0, underAFilterOps: 0, carried: 0, carriedOps: 0, notApplied: 0, notAppliedOps: 0,
    refused: 0, deferred: 0, wider: 0, groups: 0, noPath: 0, noOpOnly: 0 };
  let glyphsUnderAGlow = 0;
  let widest = { glyphs: -1 };
  for (const name of joinableScreenNames(screens, text)) {
    const record = screenTextFor(screens, text, name);
    totals.underAFilter += record.counts.underAFilter;
    totals.underAFilterOps += record.counts.underAFilterOps;
    totals.carried += record.approximations.filtersCarried;
    totals.carriedOps += record.approximations.filtersCarriedOps;
    totals.notApplied += record.approximations.filtersNotApplied;
    totals.notAppliedOps += record.approximations.filtersNotAppliedOps;
    totals.refused += record.approximations.filtersRefused;
    totals.deferred += record.approximations.filtersDeferredToColourMatrix;
    totals.wider += record.approximations.filtersOnAWiderGroup;
    totals.groups += record.counts.filterGroups;
    totals.noPath += record.counts.filterGroupsWithNoPath;
    totals.noOpOnly += record.counts.underANoOpFilterOnly;
    for (const placement of record.placements) {
      if (placement.filterStages.length === 0) continue;
      glyphsUnderAGlow += placement.ops.length;
      strings[String(placement.filter)] = (strings[String(placement.filter)] ?? 0) + 1;
      if (placement.ops.length > widest.glyphs) {
        widest = { glyphs: placement.ops.length, character: placement.character, name };
      }
    }
  }

  // ► **THE DENOMINATOR FIRST.** 113 of the 187 placements and 1689 of the 2236
  //   glyph operations, which is the population every number below is a part of.
  assert.equal(totals.underAFilter, 113);
  assert.equal(totals.underAFilterOps, 1689);
  assert.equal(totals.groups, 113, "one group per filtered field on this build");
  assert.equal(totals.carried, 112, "► 112 of the 113 hand the painter a canvas filter string");
  assert.equal(totals.carriedOps, 1680);
  assert.equal(totals.notApplied, 1, "and exactly one does not");
  assert.equal(totals.notAppliedOps, 9);
  assert.equal(totals.carried + totals.notApplied, totals.underAFilter,
    "carried and not-applied partition the 113 — the other three marks overlap them and each other");
  assert.equal(totals.carriedOps + totals.notAppliedOps, totals.underAFilterOps);
  assert.equal(totals.noOpOnly, 0,
    "► and the one that got nothing is a REAL hole, not a filter measured to draw nothing: its `filters` list is empty");
  assert.equal(totals.refused, 0, "canvas can express every filter this build puts on a word");
  assert.equal(totals.deferred, 0, "and not one of them is a colour matrix");
  assert.equal(totals.wider, 0, "and not one group covers anything but the field it sits on");
  assert.equal(totals.noPath, 0, "no filter entry in the pack has lost its path");

  // ► **THE FIVE GLOWS, BY STRING AND BY COUNT.** Every one of these could have
  //   come out a dozen other ways — sigma rather than twice sigma, a stage scale
  //   baked in, the strength lost, the colour byte-swapped — so the literals are
  //   the assertion and the counts say which words wear which.
  assert.deepEqual(strings, {
    // 1527 and 1528 on all 26 screens: the arena UI bar's two readouts.
    "drop-shadow(0px 0px 0.6455px rgba(0, 0, 0, 1))": 52,
    // The house glow, on 43 different characters.
    "drop-shadow(0px 0px 1px rgba(0, 0, 0, 1))": 52,
    // `townsquare`'s five button labels — and these five reached NOTHING until
    // this module stopped reading `filteredPlacements` alone.
    "drop-shadow(0px 0px 2.2361px rgba(102, 0, 0, 1))": 5,
    // "emperor's reign" in midnight blue, on `splash` and `new_or_continue` —
    // ONE character on TWO screens, which is why the count is 2 and not 1.
    "drop-shadow(0px 0px 1.3165px rgba(0, 0, 51, 1))": 2,
    // The widest glow in the build's text, and it is two letters: character
    // 2123, the word "vs" on `arena_intro`.
    "drop-shadow(0px 0px 4.5826px rgba(0, 0, 0, 1))": 1,
    // `gameover_demo`'s 2292, whose filter list is empty.
    null: 1
  });

  // ► **WHAT A PER-GLYPH MISTAKE WOULD COST, IN THE BUILD'S OWN NUMBERS.**
  //   1689 glyph operations sit under those 113 fields. Setting `ctx.filter`
  //   per operation draws 1689 haloes where the build draws 113 — and the
  //   worst single case is `help`'s tooltip prose, one static run of 630
  //   letters that would come back with 630 separate dark outlines.
  assert.equal(glyphsUnderAGlow, 1689);
  assert.equal(widest.glyphs, 630);
  assert.equal(widest.character, 1542);
  assert.equal(widest.name, "help");
  assert.equal(Math.round(glyphsUnderAGlow / totals.underAFilter), 15,
    "15 glyph operations per filtered field on average — so per-glyph is 15x the haloes, not a rounding error");

  // ► **AND THE ONE THAT GETS NOTHING IS NAMED, against the pack on disk.** A
  //   `filtersNotApplied` of 1 is only evidence if it can be said WHICH one; a
  //   bare 1 is what a dead counter that fires once also looks like.
  const orphan = screenTextFor(screens, text, "gameover_demo").placements
    .filter((placement) => placement.approximated.includes("filtersNotApplied"));
  assert.equal(orphan.length, 1);
  assert.equal(orphan[0].character, 2292);
  assert.equal(orphan[0].ops.length, 9, "nine glyphs drawing flat");
  assert.deepEqual([...orphan[0].filterStages[0].filters], [],
    "► because the pack says its filter list is EMPTY — not refused, not a no-op, empty");
  const onDisk = (REAL_SCREENS.screens.gameover_demo.filteredPlacements ?? [])
    .find((entry) => entry.character === 2292);
  assert.deepEqual(onDisk.filters, [], "which is what `assets/screens/screens.json` holds for [357]");
  assert.deepEqual(onDisk.path, [357]);
});

test("THE 113 ARE RECONCILED AGAINST THE PACK'S OWN TWO FILTER ARRAYS, and 5 of them are the ones that were missed", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  // ► **COUNTED FROM THE RAW JSON, NOT FROM `screen.js` AND NOT FROM THIS
  //   MODULE.** The 108-to-113 correction is the whole of this change's effect
  //   on the invoice, so it is checked against the arrays on disk: a module
  //   that quoted `screen.js` back at itself would agree with anything.
  const screens = screenPackFrom(REAL_SCREENS);
  const text = textPackFrom(REAL_TEXT);
  let fromPlacements = 0;
  let fromButtonRecords = 0;
  let placementEntries = 0;
  let buttonRecordEntries = 0;
  const mine = { placement: 0, buttonRecord: 0 };
  for (const name of joinableScreenNames(screens, text)) {
    const entry = REAL_SCREENS.screens[name];
    const record = screenTextFor(screens, text, name);
    const textPaths = new Set(record.placements.map((placement) => placement.path.join(",")));
    for (const filtered of entry.filteredPlacements ?? []) {
      placementEntries += 1;
      if (textPaths.has((filtered.path ?? []).join(","))) fromPlacements += 1;
    }
    for (const filtered of entry.filteredButtonRecords ?? []) {
      buttonRecordEntries += 1;
      if (textPaths.has((filtered.path ?? []).join(","))) fromButtonRecords += 1;
    }
    for (const group of record.filterGroups) mine[group.source] += 1;
  }
  assert.equal(placementEntries, 243, "the pack's first filter list");
  assert.equal(buttonRecordEntries, 5, "and its SECOND, which this module could not see until 2026-09-15");
  assert.equal(fromPlacements, 108, "► 108 — the number this file's header claimed for years, and it was a SUBSET");
  assert.equal(fromButtonRecords, 5, "► and the five it never counted: townsquare's button labels");
  assert.equal(fromPlacements + fromButtonRecords, 113);
  assert.deepEqual(mine, { placement: 108, buttonRecord: 5 },
    "and the module's own roster attributes them to the same two lists");

  // The five, by character and by the glow they carry — a dark red that nothing
  // in this tree had ever produced a string for.
  const townsquare = screenTextFor(screens, text, "townsquare");
  const buttons = townsquare.filterGroups.filter((group) => group.source === "buttonRecord");
  assert.deepEqual(buttons.map((group) => group.character), [1789, 1793, 1797, 1801, 1805]);
  assert.deepEqual([...new Set(buttons.map((group) => group.filter))],
    ["drop-shadow(0px 0px 2.2361px rgba(102, 0, 0, 1))"]);
  assert.deepEqual(buttons.map((group) => group.path.join(",")),
    ["59,353,1", "59,355,1", "59,357,1", "59,359,1", "59,361,1"]);
});

test("THE STRING IS CANVASFILTERFOR'S, DERIVED A THIRD TIME FROM THE PACK ON DISK", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  // ► **ONE TRANSLATOR, AND THE CHECK THAT IT IS.** `canvasFilterFor` is the
  //   only thing in this tree that turns a SWF filter list into a `ctx.filter`
  //   string; `screen.js` calls it for its groups and `screen-text.js` calls it
  //   again for its stages. This rebuilds every one of the 113 from the RAW
  //   JSON'S OWN `filters` array and requires all three to agree — so a second
  //   translator written here, or a string copied and then adjusted, is red.
  const screens = screenPackFrom(REAL_SCREENS);
  const text = textPackFrom(REAL_TEXT);
  let checked = 0;
  let scaled = 0;
  for (const name of joinableScreenNames(screens, text)) {
    const entry = REAL_SCREENS.screens[name];
    const raw = new Map();
    for (const list of [entry.filteredPlacements ?? [], entry.filteredButtonRecords ?? []]) {
      for (const filtered of list) raw.set((filtered.path ?? []).join(","), filtered.filters ?? []);
    }
    const fromScreen = new Map();
    for (const group of screenFor(screens, name).filterGroups) fromScreen.set(group.path.join(","), group.filter);
    for (const placement of screenTextFor(screens, text, name).placements) {
      for (const stage of placement.filterStages) {
        const key = stage.path.join(",");
        assert.equal(stage.filter, canvasFilterFor(raw.get(key)).filter, `${name} ${key}: the pack's own records`);
        assert.equal(stage.filter, fromScreen.get(key), `${name} ${key}: and screen.js's derivation`);
        checked += 1;
        // ► **AND IT IS THE SCALE-1 STRING.** `stageFitFor` letterboxes the
        //   640x420 stage, so the scale is almost never 1; a painter rebuilds
        //   from `stage.filters`. This asserts the records are ENOUGH to do it:
        //   at scale 2 every length doubles and the emitted string changes.
        if (stage.filter !== null) {
          const twice = canvasFilterFor(stage.filters, { scale: 2 }).filter;
          assert.notEqual(twice, stage.filter, `${name} ${key}: a scaled rebuild must differ from the scale-1 string`);
          scaled += 1;
        }
      }
    }
  }
  assert.equal(checked, 113, "every filtered field on the build, not a sample");
  assert.equal(scaled, 112, "and every one that produced a string can be rebuilt at another scale");
});

test("NOT ONE OF THE 2236 GLYPH OPERATIONS CARRIES A FILTER, on any of the 26 screens", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  // ► **THE ABSENCE IS THE DESIGN, and it is asserted rather than left to
  //   habit — the same assertion `render-screen.test.js` makes about shape
  //   operations.** `for (const op of ops) { ctx.filter = op.filter; draw(op) }`
  //   is the easiest painter to write and the wrong picture; the only way to
  //   stop it being written is for there to be nothing on the operation to
  //   write it from. The mark an operation DOES carry is the boolean `filtered`,
  //   which answers "is this inside something" and cannot be mistaken for
  //   "here is how to draw it".
  const screens = screenPackFrom(REAL_SCREENS);
  const text = textPackFrom(REAL_TEXT);
  let operations = 0;
  let marked = 0;
  for (const name of joinableScreenNames(screens, text)) {
    const record = screenTextFor(screens, text, name);
    for (const op of record.ops) {
      operations += 1;
      if (op.filtered === true) marked += 1;
      for (const key of ["filter", "filters", "filterStages", "filterGroup", "colourMatrices", "refused", "deferred"]) {
        assert.equal(key in op, false, `${name}: an operation carries ${key}`);
      }
    }
    // And the range on each group really does name operations in THIS array,
    // which is the only thing that makes the roster usable.
    for (const group of record.filterGroups) {
      const union = group.placements.flatMap((index) => [...record.placements[index].ops]);
      assert.deepEqual(record.ops.slice(group.opFirst, group.opEnd), union, `${name} ${group.path.join(",")}`);
      assert.equal(group.contiguous, true);
    }
  }
  assert.equal(operations, 2236);
  assert.equal(marked, 1689, "► 1689 operations know they are inside a filter and none of them knows which one");
});

test("binding _root.strength turns a hole on levelup into eight drawn glyphs", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  // The end of the whole join: `levelup` carries eight `_root.*` fields the
  // build's ActionScript fills at runtime, all of them blank in the file.
  const screens = screenPackFrom(REAL_SCREENS);
  const text = textPackFrom(REAL_TEXT);
  const before = screenTextFor(screens, text, "levelup");
  assert.equal(before.undrawnByKind["value-unknown"], 10, "ten holes waiting on live values");
  assert.equal(before.placements.find((entry) => entry.character === 2256).variableName, "_root.strength");

  const after = screenTextFor(screens, text, "levelup", { values: { "_root.strength": "27" } });
  assert.equal(after.undrawnByKind["value-unknown"], 9, "one fewer hole");
  const strength = after.placements.find((entry) => entry.character === 2256);
  assert.equal(strength.valueSource, "bound");
  assert.equal(strength.ops.map((op) => op.glyph.char).join(""), "27");
  assert.equal(after.counts.bound, 1);
  assert.equal(after.counts.drawn, before.counts.drawn + 1);
  assert.equal(after.counts.drawn + after.counts.undrawn, after.counts.placements);
});

test("every screen's merged picture is in path order and keeps its shape operations intact", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  const screens = screenPackFrom(REAL_SCREENS);
  const text = textPackFrom(REAL_TEXT);
  let shapeOps = 0;
  let glyphOps = 0;
  for (const name of joinableScreenNames(screens, text)) {
    const merged = screenWithTextFor(screens, text, name);
    shapeOps += merged.counts.shapeOps;
    glyphOps += merged.counts.glyphOps;
    assert.deepEqual(merged.ops.filter((op) => op.source !== "text"), [...merged.screen.ops],
      `${name}: the sort never permutes the shape operations`);
    for (let index = 1; index < merged.ops.length; index += 1) {
      assert.equal(comparePath(merged.ops[index - 1].path, merged.ops[index].path) <= 0, true,
        `${name}: operation ${index} is out of paint order`);
    }
  }
  assert.equal(shapeOps, 13638, "the 13638 path operations screen.js's header states");
  assert.equal(glyphOps, 2236);
});

test("ONE MERGED ARRAY, TWO SHAPES OF `approximated`, AND ONE READER THAT TAKES BOTH", () => {
  // ► **THIS IS THE PRODUCER/READER SEAM MISMATCH THE LAST FIX CREATED WHILE
  //   CURING ONE.** `text.js` now puts a frozen LIST on each glyph operation;
  //   `emitDrawable` in `src/render/screen.js` still copies the extractor's
  //   STRING onto each
  //   shape operation. `screenWithTextFor` concatenates the two, so ONE array
  //   carries both types under one key — and whichever shape a reader guesses,
  //   it counts nothing for the other half and says nothing about it. That is
  //   the exact failure mode the tally in this module exists to catch.
  //
  //   Pinned synthetically as well as on the pack, because the synthetic case is
  //   the CONTRACT: one screen, one shape operation marked `"gradient"` as a
  //   string, one glyph operation marked `["html-markup-stripped"]` as a list,
  //   in one paint order.
  const raw = syntheticScreensRaw();
  raw.shapes = {
    10: {
      character: 10,
      paths: [{ d: "M0 0L10 0L10 10L0 10Z", fill: "#ff0000", fillOpacity: 1, fillRule: "evenodd",
        stroke: null, strokeWidth: 0, approximated: "gradient" }]
    }
  };
  // Field 402 is the HTML field with words left in it, so it DRAWS and its
  // `html-markup-stripped` reaches an operation as a list.
  raw.screens.forum.textFields.push({
    id: 402, bounds: { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 }, fontId: 7, fontHeight: 409.6,
    colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: 0, leading: 0,
    leftMargin: 0, rightMargin: 0, indent: 0, variableName: "loud_html",
    initialText: "<p align=\"left\">AB</p>", multiline: false, wordWrap: false, readOnly: true,
    path: [58], matrix: [1, 0, 0, 1, 0, 0]
  });
  raw.screens.forum.unresolved.push({ kind: "text-edit", character: 402, path: [58], detail: "variable loud_html" });

  const merged = screenWithTextFor(screenPackFrom(raw), syntheticTextPack(), "forum");
  const marked = merged.ops.filter((op) => op.approximated !== undefined && op.approximated !== null);
  const strings = marked.filter((op) => typeof op.approximated === "string");
  const lists = marked.filter((op) => Array.isArray(op.approximated));
  assert.equal(strings.length, 3, "three shape operations, each carrying the extractor's string");
  assert.equal(lists.length, 2, "two glyph operations, each carrying text.js's list");
  assert.equal(strings.length + lists.length, marked.length, "► and there is no third shape in the array");

  // ► THE TWO GUESSES A READER WOULD MAKE, AND WHAT EACH ONE COSTS. Neither is
  //   written anywhere in src/ any more; they are here so the size of the trap
  //   is a number rather than a warning.
  const ifStringOnly = marked.filter((op) => typeof op.approximated === "string").length;
  const ifArrayOnly = marked.filter((op) => Array.isArray(op.approximated)).length;
  assert.equal(marked.length - ifStringOnly, 2, "a `typeof === \"string\"` reader silently drops the glyph marks");
  assert.equal(marked.length - ifArrayOnly, 3, "an `Array.isArray` reader silently drops the shape marks");

  // ► THE INVARIANT, which is what `src/` actually relies on: the one reader
  //   returns at least one mark for every marked operation, whichever half it
  //   came from. This survives the proper repair — `screen.js` and `props.js`
  //   emitting lists too — which is why it, and not the 3/2 split above, is what
  //   the real-pack test below asserts.
  for (const op of marked) {
    const marks = approximationMarksOf(op.approximated);
    assert.ok(marks.length > 0,
      `a marked operation at path [${op.path}] read as NO marks: ${JSON.stringify(op.approximated)}`);
    assert.ok(marks.every((mark) => typeof mark === "string" && mark.length > 0));
  }
  assert.deepEqual(approximationMarksOf(strings[0].approximated), ["gradient"]);
  assert.deepEqual(approximationMarksOf(lists[0].approximated), ["html-markup-stripped"]);
});

test("EVERY MARK ON EVERY MERGED OPERATION IN THE BUILD IS READABLE — 274 of them, in two shapes", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  const screens = screenPackFrom(REAL_SCREENS);
  const text = textPackFrom(REAL_TEXT);
  let marked = 0;
  let readable = 0;
  let strings = 0;
  let lists = 0;
  const byKind = {};
  for (const name of joinableScreenNames(screens, text)) {
    for (const op of screenWithTextFor(screens, text, name).ops) {
      if (op.approximated === undefined || op.approximated === null) continue;
      marked += 1;
      if (typeof op.approximated === "string") strings += 1;
      else if (Array.isArray(op.approximated)) lists += 1;
      else assert.fail(`${name}: an operation carries a ${typeof op.approximated} under \`approximated\``);
      const marks = approximationMarksOf(op.approximated);
      if (marks.length > 0) readable += 1;
      for (const mark of marks) byKind[mark] = (byKind[mark] ?? 0) + 1;
    }
  }
  // ► **THE TOTAL IS THE ASSERTION; THE SPLIT IS THE DIAGNOSIS.** 274 marked
  //   operations, and every one of them readable by the one reader. Today the
  //   split is 209 strings (`gradient` x180, `bitmap` x29, from
  //   `emitDrawable` in `src/render/screen.js`) and 65 lists
  //   (`html-markup-stripped`, from
  //   `src/render/text.js`) — but the RIGHT repair is for `screen.js` and
  //   `props.js` to emit lists as well, which would make it 0 / 274 and must not
  //   turn this red. So the split is asserted only as "both halves add up", and
  //   what is pinned is that no mark is lost.
  assert.equal(marked, 274, "operations carrying a mark across the 26 screens");
  assert.equal(readable, marked, "► and every one of them read as at least one mark");
  assert.equal(strings + lists, marked, "no third shape under that key");
  assert.deepEqual(byKind, { gradient: 180, bitmap: 29, "html-markup-stripped": 65 },
    "the kinds, whichever shape they arrived in");
});

test("AN OVERFLOWING CENTRED FIELD IS COUNTED BY NAME — the condition the alignment fix created", () => {
  // ► **BEFORE THE FIX THIS COULD NOT HAPPEN; AFTER IT, NOTHING COUNTED IT.** A
  //   non-wrapping field used to be aligned in a box exactly as wide as its own
  //   longest line, so the slack could never be negative and a field could not
  //   draw outside its own box. Aligning it in the field's box made that
  //   possible — and `layoutText`'s `overflowing` was unreachable from the only
  //   route that draws a screen, because `fieldOpsFor` returns an array and an
  //   array cannot carry a count. `fieldTextFor` carries it and this tally
  //   counts it.
  const raw = syntheticScreensRaw();
  // A 40px box — 36 of it inner — centred, holding a one-glyph placeholder.
  raw.screens.forum.textFields.push({
    id: 406, bounds: { xMin: 0, xMax: 800, yMin: 0, yMax: 1000 }, fontId: 7, fontHeight: 409.6,
    colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: 1, leading: 0,
    leftMargin: 0, rightMargin: 0, indent: 0, variableName: "strength",
    initialText: "A", multiline: false, wordWrap: false, readOnly: true,
    path: [62], matrix: [1, 0, 0, 1, 2000, 0]
  });
  raw.screens.forum.unresolved.push({ kind: "text-edit", character: 406, path: [62], detail: "variable strength" });
  const screens = screenPackFrom(raw);
  const text = syntheticTextPack({
    fields: {
      406: { id: 406, bounds: { xMin: 0, xMax: 800, yMin: 0, yMax: 1000 }, font: 7, fontHeight: 409.6,
        colour: "#ffffff", alpha: 1, align: "center", leftMargin: 0, rightMargin: 0, indent: 0, leading: 0,
        multiline: false, wordWrap: false, password: false, readOnly: true, html: false,
        variable: "strength", text: "A" }
    }
  });

  // The placeholder fits, so the counter is at zero — the value it has to be
  // able to LEAVE for the assertion below to be evidence.
  const fits = screenTextFor(screens, text, "forum");
  assert.equal(fits.approximations.fieldOverflows, 0);
  assert.equal(fits.placements.find((entry) => entry.character === 406).overflowing, 0);

  // A bound value of four glyphs is 48px in a 36px box.
  const spills = screenTextFor(screens, text, "forum", { values: { strength: "AAAA" } });
  const placement = spills.placements.find((entry) => entry.character === 406);
  assert.equal(spills.approximations.fieldOverflows, 1, "► one PLACEMENT overflows");
  assert.equal(placement.overflowing, 1, "► carrying one overflowing LINE");
  assert.ok(placement.approximated.includes("fieldOverflows"),
    `the placement's own marks are ${JSON.stringify(placement.approximated)}`);
  assert.equal(spills.approximatedByKind.fieldOverflows, 1, "and the OPEN tally has it under the same name");
  assert.deepEqual(spills.unrosteredApproximations, [],
    "► rostered, not hot: a kind added on purpose must not read as one nobody has thought about");
  assert.ok(SCREEN_TEXT_APPROXIMATION_KINDS.includes("fieldOverflows"));

  // ► AND THE THING THE NUMBER IS ABOUT: the ink really does leave the box. The
  //   field sits at stage x = 100px (2000 twips) and is 40px wide, so its box is
  //   100..140; the centred 48px line starts 6px left of the box's own left edge.
  const ink = inkOf(placement.ops);
  assert.ok(ink.xMin < 100, `the first glyph is at ${ink.xMin.toFixed(2)}, left of the field box at 100`);
  assert.ok(ink.xMax > 140 - 2, `and the last runs to ${ink.xMax.toFixed(2)}, past the box's right edge at 140`);
});

test("THE BUILD'S OWN FIELD 1619 SPILLS THE MOMENT A REAL VALUE IS BOUND TO IT", () => {
  if (!REAL_SCREENS || !REAL_TEXT) {
    assert.equal(REAL_SCREENS === null || REAL_TEXT === null, true, "no extraction on this machine");
    return;
  }
  // ► **WHAT MAKES THE ZERO ABOVE NON-VACUOUS.** With the pack's own placeholder
  //   text not one of the 272 laid-out lines overflows, so `fieldOverflows` is 0
  //   on all 26 screens — and a counter that no input can move is not a check.
  //   The input that moves it is the thing a screen is FOR. `createchar`'s field
  //   1619 is the strength readout: a 42.95px box whose placeholder is "6".
  const screens = screenPackFrom(REAL_SCREENS);
  const text = textPackFrom(REAL_TEXT);
  let asShipped = 0;
  for (const name of joinableScreenNames(screens, text)) {
    asShipped += screenTextFor(screens, text, name).approximations.fieldOverflows;
  }
  assert.equal(asShipped, 0, "every field in the build fits its own box with its own placeholder");

  const bound = screenTextFor(screens, text, "createchar", {
    values: (base) => (base.kind === "text-edit" ? "888888888888" : undefined)
  });
  assert.ok(bound.approximations.fieldOverflows > 0,
    "► binding a twelve-digit value to createchar's fields must reach the counter");
  const placement = bound.placements.find((entry) => entry.character === 1619);
  assert.equal(placement.overflowing, 1);
  assert.ok(placement.approximated.includes("fieldOverflows"));
  assert.equal(bound.approximatedByKind.fieldOverflows, bound.approximations.fieldOverflows,
    "the roster key is a projection of the open tally, not a second count");

  // The field's box starts 62.25px into the stage and its ink now starts left of
  // that — across the "strength" label, which is the defect the alignment fix
  // was made to cure, arriving from the other end.
  const boxLeftPx = text.fields[1619].bounds.xMin / TWIPS_PER_PIXEL + 64.25;
  const ink = inkOf(placement.ops);
  assert.ok(ink.xMin < boxLeftPx,
    `ink starts at ${ink.xMin.toFixed(2)}px, the box at ${boxLeftPx.toFixed(2)}px`);
});
