/**
 * THE JOIN — twenty-five screens of words, and the four things that make the
 * join more than a for-loop.
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
 *   4. that a placement under a FILTERLIST is marked and counted — 108 of 187.
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
import { screenFor, screenNames, screenPackFrom } from "../src/render/screen.js";
import { TEXT_UNITS_PER_EM, TWIPS_PER_PIXEL, textPackFrom } from "../src/render/text.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * The player's own extracted packs, or null on a clone with no licensed copy.
 *
 * A function declaration rather than an arrow: `ss2-assertion-quality.test.js`
 * finds a helper's body by looking for the next brace before the next newline,
 * so a multi-line arrow reads as bodyless and every test calling it is reported
 * as asserting nothing.
 */
function readRealJson(relative) {
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
        filteredPlacements: [{ character: 99, path: [55] }, { character: 98, path: [45, 9, 9] }],
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
  assert.equal(loud.ops.every((op) => op.approximated === "html-markup-stripped"), true,
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
  assert.equal(broken.ops[0].approximated, "glyph-missing");
  assert.deepEqual([...broken.approximated], ["glyphsNotdef"]);
  assert.equal(record.approximations.glyphsNotdef, 1, "and it reaches the screen's tally");
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

test("A TEXT PLACEMENT UNDER A FILTERLIST IS MARKED AND COUNTED, matched by path PREFIX", () => {
  // ► Hazard 4. `screen.js` marks its own operations `filtered` and says
  //   nothing about the text placements it hands over, so this module re-reads
  //   `filteredPlacements` itself. Matching is by prefix, not by root depth: a
  //   filter on a nested clip affects everything inside it and nothing beside
  //   it. The pack below also carries a prefix LONGER than a placement's own
  //   path, which must not match — without that case the length guard could
  //   return either answer with every other test still green.
  const record = screenTextFor(syntheticScreens(), syntheticTextPack(), "forum");
  const under = record.placements.find((entry) => entry.character === 400);
  assert.deepEqual([...under.path], [55, 2]);
  assert.equal(under.approximated.includes("filtersNotApplied"), true, "[55] is a prefix of [55, 2]");
  assert.equal(under.ops.every((op) => op.filtered === true), true, "and the mark rides on every operation");

  const beside = record.placements.find((entry) => entry.character === 300);
  assert.deepEqual([...beside.path], [45]);
  assert.equal(beside.approximated.includes("filtersNotApplied"), false,
    "[45, 9, 9] is longer than [45] and is not a prefix of it");
  assert.equal(beside.ops.some((op) => op.filtered === true), false);

  assert.equal(record.approximations.filtersNotApplied, 1, "ONE placement");
  assert.equal(record.approximations.filtersNotAppliedOps, 2, "carrying TWO operations — the two counts are not the same number");
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
    filtered += record.approximations.filtersNotApplied;
    filteredOps += record.approximations.filtersNotAppliedOps;
    placeholders += record.approximations.placeholderDrawn;
    for (const entry of record.placements) {
      if (entry.approximated.includes("html-markup-stripped") && entry.drawn) drew += 1;
    }
  }
  assert.equal(placements, 5, "five fields carry real markup");
  assert.equal(drew, 1, "► and only ONE of them emits an operation");
  assert.equal(ops, 65, "so an operations-only tally would report 1 approximation where there are 5");
  assert.equal(filtered, 108, "108 of the 187 placements sit under a FILTERLIST nothing applies");
  assert.equal(filteredOps, 1643, "and 1643 of the 2236 glyph operations — a different question, and a different number");
  assert.equal(placeholders, 91, "and 91 draw the author's placeholder rather than a live value");
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
