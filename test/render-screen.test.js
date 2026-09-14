/**
 * THE TWENTY-SIX SCREENS AS DRAW OPERATIONS — the reading of
 * `assets/screens/screens.json`, not the contents of one person's install.
 *
 * ► **THE PACK HERE IS SYNTHETIC, AND IT HAS TO BE.** `assets/` is gitignored
 *   and `test/asset-attestation.test.js` fails if anything under it is tracked,
 *   so a fixture of the real screens would put extracted art in the repository —
 *   the one thing that arrangement exists to prevent. What is pinned below is
 *   the CONTRACT: the units at the seam, the colour-transform arithmetic, the
 *   paint order, and above all the TALLY, because an approximation that is not
 *   counted is indistinguishable from a correct read and this project has lost
 *   six defects to exactly that.
 *
 * ► **The real pack is used when the machine running the tests has one**, at
 *   the bottom of the file, and it asserts against
 *   `assets/screens/manifest.json` — which a DIFFERENT pass of the extractor
 *   wrote — rather than against a number typed in here. On a fresh clone those
 *   tests assert the absence instead of skipping, so the suite's skip count
 *   does not move.
 */

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCREEN_CHROME,
  SCREEN_CHROME_DEPTHS,
  SCREEN_STAGE_PLACEMENT,
  ScreenError,
  hasExtractedScreens,
  screenFor,
  screenNames,
  screenOpsFor,
  screenPackFrom,
  splitScreenChrome
} from "../src/render/screen.js";
import { SS2_ARENA_SCREEN_LAYERS, SS2_STAGE, stageFitFor } from "../src/render/arena-backdrop.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * The player's own extracted pack, or null on a clone with no licensed copy.
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
const REAL_MANIFEST = readRealJson("assets/screens/manifest.json");

/** Floating point: a box width is a difference of two divisions, not a literal. */
function assertClose(actual, expected, what) {
  assert.equal(Math.abs(actual - expected) < 1e-9, true, `${what}: ${actual} is not ${expected}`);
}

/* ------------------------------------------------------------------ */
/* A pack in the shape the extractor writes                            */
/* ------------------------------------------------------------------ */

/** A flat two-path shape, so a colour transform has two colours to move. */
const FLAT = {
  character: 10,
  bounds: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
  paths: [
    { d: "M0 0L10 0L10 10L0 10Z", fill: "#ff0000", fillOpacity: 1, fillRule: "evenodd", approximated: null, stroke: null, strokeWidth: 0 },
    { d: "M2 2L4 2L4 4L2 4Z", fill: "#eaeaea", fillOpacity: 1, fillRule: "evenodd", approximated: null, stroke: null, strokeWidth: 0 }
  ]
};

/** `fill: "none"` at FULL opacity and a real stroke — the invisibility trap. */
const STROKE_ONLY = {
  character: 11,
  paths: [
    { d: "M0 0L20 20", fill: "none", fillOpacity: 1, fillRule: "evenodd", approximated: null, stroke: "#112233", strokeWidth: 2, strokeOpacity: 1 }
  ]
};

function gradientShape(character, opacities) {
  return {
    character,
    paths: [{
      d: "M0 0L30 30L0 30Z",
      fill: "#9c2b00",
      fillOpacity: 1,
      fillRule: "evenodd",
      approximated: "gradient",
      gradient: {
        type: "linear", focal: false, focalPoint: 0, spread: 0, interpolation: 0,
        matrix: { a: 0.1953125, b: 0, c: 0, d: 0.1953125, tx: 3310, ty: 3530 },
        stops: [
          { offset: 0, fill: "#9c2b00", opacity: opacities[0] },
          { offset: 1, fill: "#ffcc83", opacity: opacities[1] }
        ]
      },
      stroke: null, strokeWidth: 0
    }]
  };
}

const SHAPES = Object.freeze({
  10: FLAT,
  11: STROKE_ONLY,
  12: gradientShape(12, [1, 0.5]),
  13: {
    character: 13,
    paths: [{
      d: "M0 0L40 0L40 40L0 40Z", fill: "none", fillOpacity: 1, fillRule: "evenodd",
      approximated: "bitmap",
      bitmap: { id: 99, matrix: { a: 20, b: 0, c: 0, d: 20, tx: 0, ty: 0 }, repeat: false },
      stroke: null, strokeWidth: 0
    }]
  },
  // A cutter with a HOLE: two loops, and keeping only the first would clip to
  // the outline instead of the ring.
  14: {
    character: 14,
    paths: [
      { d: "M0 0L5 0L5 5L0 5Z", fill: "#ffffff", fillOpacity: 1, fillRule: "evenodd", approximated: null, stroke: null, strokeWidth: 0 },
      { d: "M1 1L2 1L2 2L1 2Z", fill: "#ffffff", fillOpacity: 1, fillRule: "evenodd", approximated: null, stroke: null, strokeWidth: 0 }
    ]
  },
  15: gradientShape(15, [0, 0]),
  16: { character: 16, paths: [{ d: "", fill: "#123456", fillOpacity: 1, fillRule: "evenodd", approximated: null, stroke: null, strokeWidth: 0 }] },
  17: { character: 17, paths: [] }
});

const ALPHA_ZERO = { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 0, redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0 };
const BLUE_102 = { redMultiplier: 0, greenMultiplier: 0, blueMultiplier: 0, alphaMultiplier: 1, redOffset: 0, greenOffset: 0, blueOffset: 102, alphaOffset: 0 };
const HALF_RED = { redMultiplier: 0.5, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0 };
const HALF_ALPHA = { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 0.5, redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0 };
const ALPHA_OFFSET = { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: -64 };

/**
 * `market` exercises every branch; `gate` exists only so that ordering can be
 * tested, and it is declared SECOND while labelling an EARLIER frame.
 */
function rawPack() {
  return {
    screens: {
      market: {
        name: "market",
        labelFrame: 30, firstFrame: 30, lastFrame: 34,
        objects: [
          { depth: 1, character: 643, kind: "sprite", matrix: [1, 0, 0, 1, 0, 0], drawables: 2 },
          // A SHAPE placed straight on the root, so its path is ONE element
          // long — shorter than the filter prefix below. Without it the
          // prefix guard `prefix.length > path.length` is never exercised and
          // could return either answer with every test still green.
          { depth: 3, character: 10, kind: "shape", matrix: [1, 0, 0, 1, 0, 0], drawables: 2 },
          { depth: 5, character: 800, kind: "sprite", matrix: [2, 0, 0, 2, 100, 200], drawables: 2 },
          { depth: 7, character: 801, kind: "sprite", matrix: [1, 0, 0, 1, 0, 0], drawables: 2 },
          { depth: 438, character: 1531, kind: "sprite", instanceName: "fiz_info_panel", matrix: [1, 0, 0, 1, 0, 0], drawables: 2 },
          { depth: 1193, character: 646, kind: "sprite", matrix: [1, 0, 0, 1, 0, 0], drawables: 2 }
        ],
        drawables: [
          { shape: 10, path: [1, 1], matrix: [1, 0, 0, 1, 0, 0], colour: ALPHA_ZERO },
          { shape: 10, path: [3], matrix: [1, 0, 0, 1, 0, 0] },
          { shape: 10, path: [5, 1], matrix: [2, 0, 0, 2, 100, 200], colour: BLUE_102 },
          { shape: 10, path: [6, 1], matrix: [1, 0, 0, 1, 0, 0], colour: HALF_RED },
          { shape: 11, path: [7, 2, 1], matrix: [1, 0, 0, 1, 0, 0] },
          { shape: 12, path: [7, 3, 1], matrix: [1, 0, 0, 1, 0, 0], colour: HALF_ALPHA },
          { shape: 13, path: [9, 4, 1], matrix: [1, 0, 0, 1, 0, 0], colour: HALF_RED },
          { shape: 10, path: [9, 5], matrix: [1, 0, 0, 1, 0, 0] },
          { shape: 10, path: [11, 1], matrix: [1, 0, 0, 1, 0, 0], clip: { shape: 14, matrix: [1, 0, 0, 1, 10, 20] } },
          { shape: 10, path: [12, 1], matrix: [1, 0, 0, 1, 0, 0], clip: { shape: 404, matrix: [1, 0, 0, 1, 0, 0] } },
          { shape: 999, path: [13, 1], matrix: [1, 0, 0, 1, 0, 0] },
          { shape: 17, path: [14, 1], matrix: [1, 0, 0, 1, 0, 0] },
          { shape: 16, path: [15, 1], matrix: [1, 0, 0, 1, 0, 0] },
          { shape: 15, path: [16, 1], matrix: [1, 0, 0, 1, 0, 0] },
          { shape: 10, path: [17, 1, 1], matrix: [1, 0, 0, 1, 0, 0], via: "button 500" },
          { shape: 11, path: [18, 1], matrix: [1, 0, 0, 1, 0, 0], via: "morph 600" },
          { shape: 12, path: [19, 1], matrix: [1, 0, 0, 1, 0, 0], colour: ALPHA_OFFSET },
          { shape: 10, path: [438, 1], matrix: [1, 0, 0, 1, 0, 0] },
          { shape: 10, path: [1193, 1], matrix: [1, 0, 0, 1, 0, 0] }
        ],
        unresolved: [
          { kind: "text-static", character: 1503, path: [45], matrix: [1, 0, 0, 1, 3777, 5923], detail: "4 glyphs reading \"play\" — the WORDS are known, the letterforms are not" },
          { kind: "text-edit", character: 1524, path: [184], matrix: [1, 0, 0, 1, 9139, 7594], detail: "variable fizVersionTXT" },
          { kind: "button-hit-area-only", character: 777, path: [20], matrix: [1, 0, 0, 1, 0, 0], detail: "3 records, none of them UP" }
        ],
        textFields: [{
          id: 1524, bounds: { xMin: -40, xMax: 3460, yMin: -40, yMax: 242 },
          fontId: 1523, fontHeight: 200, colour: { red: 0, green: 0, blue: 0, alpha: 255 },
          align: 1, leading: 40, leftMargin: 0, rightMargin: 0, indent: 0,
          variableName: "fizVersionTXT", initialText: "version",
          multiline: false, wordWrap: false, readOnly: true,
          path: [184], matrix: [1, 0, 0, 1, 9139, 7594]
        }],
        staticText: [{
          id: 1503, bounds: { xMin: 2383, xMax: 3041, yMin: 22, yMax: 346 },
          matrix: [1, 0, 0, 1, 3777, 5923], glyphs: 4, undecoded: 0, text: "play",
          runs: [{
            fontId: 53, colour: { red: 255, green: 255, blue: 255, alpha: 255 },
            xOffset: 1380, yOffset: 280, height: 280, glyphs: 4,
            advances: [146, 76, 130, 130], text: "play"
          }],
          path: [45]
        }],
        multiFrameSprites: [{ character: 703, frames: 13 }],
        filteredPlacements: [{ character: 60, path: [7, 2] }],
        blendedPlacements: [
          { character: 70, path: [9], blendMode: 3 },
          { character: 71, path: [9, 4], blendMode: 9 }
        ],
        rangeVariance: { frames: 3, firstDifferingFrame: 32, depthsAdded: [], depthsRemoved: [7] },
        approximations: {
          nestedSpriteFrame1: 1, buttonUpState: 1, buttonNoUpState: 1, filters: 1, blendModes: 2,
          gradientPaths: 3, bitmapPaths: 1, invisibleDrawables: 1,
          staticTextGlyphs: 4, staticTextGlyphsUndecoded: 0, bakedMorphs: 1
        },
        counts: { objects: 6, drawables: 19 },
        resolvedNothing: false
      },
      gate: {
        name: "gate",
        labelFrame: 10, firstFrame: 10, lastFrame: 12,
        objects: [{ depth: 1, character: 643, kind: "sprite", matrix: [1, 0, 0, 1, 0, 0], drawables: 2 }],
        drawables: [{ shape: 10, path: [1, 1], matrix: [1, 0, 0, 1, 0, 0] }],
        unresolved: [], textFields: [], staticText: [],
        multiFrameSprites: [], filteredPlacements: [], blendedPlacements: [],
        rangeVariance: { frames: 0, firstDifferingFrame: null, depthsAdded: [], depthsRemoved: [] },
        approximations: { nestedSpriteFrame1: 0, filters: 0 },
        counts: { objects: 1, drawables: 1 },
        resolvedNothing: false
      }
    },
    shapes: SHAPES,
    fonts: {
      53: { id: 53, name: "GoudyHandtooled BT", glyphCount: 114, bold: true, italic: false },
      1523: { id: 1523, name: "Mini 7", glyphCount: 114, bold: false, italic: false }
    }
  };
}

function marketOf() {
  return screenFor(screenPackFrom(rawPack()), "market");
}

/* ------------------------------------------------------------------ */
/* Running with no pack, which is how a fresh clone runs               */
/* ------------------------------------------------------------------ */

test("no pack means no screens, not a crash — the fresh-clone path", () => {
  // ► **THE FALLBACK IS THE SUPPORTED PATH, not an error path.** This
  //   repository ships no SS2 asset, so someone who has not run the extractor
  //   must get a game drawing its own art rather than a stack trace where a
  //   shop should be. Same arrangement as `props.js` and `sound.js`.
  for (const absent of [null, undefined, {}, { screens: null }, { screens: {}, shapes: null }, { shapes: {} }, "nonsense", 7, []]) {
    const pack = screenPackFrom(absent);
    assert.equal(hasExtractedScreens(pack), false, `${JSON.stringify(absent)} is not a pack`);
    assert.deepEqual(screenNames(pack), [], "and it names no screens");
    assert.equal(screenFor(pack, "splash"), null, "and asking for one gets null rather than throwing");
    assert.equal(screenOpsFor(pack, "splash"), null);
    assert.deepEqual(splitScreenChrome(screenFor(pack, "splash")), { chrome: [], body: [] });
  }
});

test("a well-formed pack that holds no such screen is null, not an empty picture", () => {
  const pack = screenPackFrom(rawPack());
  assert.equal(hasExtractedScreens(pack), true);
  assert.equal(screenFor(pack, "no_such_screen"), null);
  assert.equal(screenFor(pack, 7), null, "a non-string name is refused rather than coerced");
  assert.equal(screenOpsFor(pack, "no_such_screen"), null);
  // Arrays are objects and `screens` being one would make every name a miss;
  // refusing the pack outright says so instead of returning 26 nulls.
  assert.equal(screenPackFrom({ screens: [], shapes: {} }), null);
});

test("ScreenError is exported so a caller can name the type it is not getting", () => {
  const error = new ScreenError("nothing throws this");
  assert.equal(error instanceof Error, true);
  assert.equal(error.name, "ScreenError");
});

/* ------------------------------------------------------------------ */
/* Order, space and units                                              */
/* ------------------------------------------------------------------ */

test("screens come back in the ROOT TIMELINE's order, not the JSON's key order", () => {
  // `market` is declared first and labels frame 30; `gate` is declared second
  // and labels frame 10. Key order is a property of how the file was written.
  const pack = screenPackFrom(rawPack());
  assert.deepEqual(screenNames(pack), ["gate", "market"]);
});

test("a screen sits on the stage at the identity, because the pack is already composed", () => {
  const record = marketOf();
  assert.deepEqual(record.placement, SCREEN_STAGE_PLACEMENT);
  assert.deepEqual(record.placement, { x: 0, y: 0, scale: 1 });
  // The stage is arena-backdrop's, not a second copy — a second stage is a
  // second thing to get wrong, and `stageFitFor` letterboxes THIS one.
  assert.equal(record.stage, SS2_STAGE);
  const fit = stageFitFor({ width: 1280, height: 840 });
  assert.equal(fit.scale, 2, "a 2x surface fits the 640x420 stage at scale 2");
});

test("UNITS: the matrix translation stays in TWIPS and the path data stays in PIXELS", () => {
  // ► **THIS SEAM HAS COST THIS PROJECT THREE DEFECTS.** `tools/arena/main.js`
  //   divides `matrix[4]`/`matrix[5]` by 20 for every operation it paints, so
  //   converting here would put the picture twenty times too close to the
  //   origin — the exact shape of the blood-drop and shield defects already
  //   recorded in `projectile.js` and `clip-effects.js`.
  const record = marketOf();
  const moved = record.ops.find((op) => op.depth === 5);
  assert.deepEqual(moved.matrix, [2, 0, 0, 2, 100, 200], "twips, untouched");
  assert.equal(moved.matrix[4] / 20, 5, "which is 5 pixels once the painter divides");
  assert.equal(moved.d, "M0 0L10 0L10 10L0 10Z", "and the geometry is the shape's own pixels");
});

test("paint order is the pack's order, and every operation carries its trail back", () => {
  // ► **THE PACK'S SEQUENCE IS THE ANSWER, NOT A SORT OF IT.** `flattenFrame`
  //   emits a button's expanded leaves and a nested clip's children in the
  //   order they are composited, which a re-sort by depth would destroy — the
  //   leaves inside one placement all share its root depth. So this asserts
  //   the expansion of the pack's own list, in order, rather than sortedness.
  const raw = rawPack();
  const record = marketOf();
  const expected = [];
  for (const drawable of raw.screens.market.drawables) {
    const shape = raw.shapes[drawable.shape];
    for (const entry of shape?.paths ?? []) {
      if (typeof entry.d === "string" && entry.d.length > 0) expected.push(drawable.path[0]);
    }
  }
  assert.deepEqual(record.ops.map((op) => op.depth), expected);
  const first = record.ops[0];
  assert.equal(first.kind, "path");
  assert.equal(first.depth, 1);
  assert.deepEqual(first.path, [1, 1], "the full nesting trail, for tracing a pixel back to the pack");
  assert.equal(first.shape, 10, "and the character id of the shape it came from");
  const button = record.ops.find((op) => op.via === "button 500");
  assert.deepEqual(button.path, [17, 1, 1], "a button's leaves keep the depth that placed the button");
});

/* ------------------------------------------------------------------ */
/* Colour transforms                                                   */
/* ------------------------------------------------------------------ */

test("a colour transform is folded into the fill, so the existing painter needs no new code", () => {
  const record = marketOf();
  const tinted = record.ops.filter((op) => op.depth === 5);
  // multiplier 0 on every channel plus a blue offset of 102 (0x66) collapses
  // two different greys to one blue, which is what the build's splash does.
  assert.deepEqual(tinted.map((op) => op.fill), ["#000066", "#000066"]);
  assert.equal(tinted[0].fillOpacity, 1, "the alpha half of that transform is the identity");
});

test("the channel arithmetic TRUNCATES, because an 8.8 multiply term is shifted not rounded", () => {
  // `255 * 128 >> 8` is 127, so half of #ff0000 is #7f0000. Rounding would give
  // #800000 and would be wrong on every channel that lands on a half.
  const record = marketOf();
  const halved = record.ops.filter((op) => op.depth === 6);
  assert.deepEqual(halved.map((op) => op.fill), ["#7f0000", "#75eaea"]);
});

test("the alpha half folds into fillOpacity and strokeOpacity", () => {
  const record = marketOf();
  const gradient = record.ops.find((op) => op.depth === 7 && op.gradient);
  assert.equal(gradient.fillOpacity, 0.5);
  const invisible = record.ops.filter((op) => op.depth === 1);
  assert.deepEqual(invisible.map((op) => op.fillOpacity), [0, 0]);
});

test("a gradient's transform goes into its STOPS, which is where the painter reads alpha", () => {
  // `paintGradientFill` in `tools/arena/main.js` sets `globalAlpha = 1` and
  // builds the ramp from each stop's own opacity. A reader that folded the
  // transform only into `fillOpacity` would draw the gradient at full strength.
  const record = marketOf();
  const op = record.ops.find((op) => op.depth === 7 && op.gradient);
  assert.deepEqual(op.gradient.stops.map((stop) => stop.opacity), [0.5, 0.25]);
  assert.deepEqual(op.gradient.stops.map((stop) => stop.fill), ["#9c2b00", "#ffcc83"]);
  assert.equal(op.gradient.type, "linear", "and the rest of the gradient is carried through");
  assert.equal(op.gradient.matrix.tx, 3310);
});

test("an alphaOffset across stops of differing opacity is COUNTED, not pretended exact", () => {
  // Transforming stops and letting a ramp interpolate is the same picture as
  // transforming the result only while the transform is linear in what is being
  // interpolated. A multiplier is; an offset added to unequal alphas is not.
  const record = marketOf();
  assert.equal(record.approximations.gradientAlphaOffsetApproximated, 1);
  const op = record.ops.find((candidate) => candidate.depth === 19);
  assertClose(op.gradient.stops[0].opacity, 1 - 64 / 255, "first stop");
  assertClose(op.gradient.stops[1].opacity, 0.5 - 64 / 255, "second stop");
});

test("a bitmap fill keeps its raster and loses only the RGB half, which is counted", () => {
  // ► **`fill: "none"` MUST SURVIVE.** Rewriting it to a colour is how the
  //   arena's stone walls became flat squares — the defect
  //   `extraction-honesty.test.js` was written for.
  const record = marketOf();
  const op = record.ops.find((candidate) => candidate.bitmap);
  assert.equal(op.fill, "none");
  assert.equal(op.bitmap.id, 99);
  assert.equal(op.approximated, "bitmap", "the extractor's own marker is carried, not consumed");
  assert.equal(record.approximations.bitmapColourTransformDropped, 1,
    "a bitmap under an RGB transform has nowhere to put the colour, and says so");
});

/* ------------------------------------------------------------------ */
/* Counting what cannot be drawn                                       */
/* ------------------------------------------------------------------ */

test("INVISIBLE is not the same test as fillOpacity zero, and the first version said it was", () => {
  // A stroke-only path carries `fill: "none"` at full opacity and DRAWS; a
  // gradient whose stops are all transparent carries `fillOpacity: 1` and does
  // NOT. Measured on the real pack, the difference between the two readings is
  // 182 operations against 171.
  const record = marketOf();
  const stroked = record.ops.find((op) => op.stroke === "#112233");
  assert.equal(stroked.fillOpacity, 1, "a stroke-only path is at full fill opacity by construction");
  assert.equal(stroked.strokeWidth, 2);
  // depth 1 contributes 2 (alphaMultiplier 0) and depth 16 contributes 1 (a
  // gradient with two transparent stops). The stroke-only path is in neither.
  assert.equal(record.approximations.invisibleOps, 3);
});

test("every reason an operation is NOT emitted increments a counter first", () => {
  // **Never emit a silently-empty path and never skip one silently.** The
  // arena's invisible walls were found by breaking exactly this rule.
  const record = marketOf();
  assert.equal(record.approximations.shapesMissing, 1, "shape 999 is not in the table");
  assert.equal(record.approximations.shapesWithNoPaths, 1, "shape 17 parsed to nothing");
  assert.equal(record.approximations.pathsWithoutGeometry, 1, "shape 16 has an empty `d`");
  for (const op of record.ops) {
    assert.equal(typeof op.d === "string" && op.d.length > 0, true, "no operation carries empty geometry");
  }
  assert.equal(record.ops.some((op) => op.shape === 999 || op.shape === 16 || op.shape === 17), false);
});

test("filters are counted per OPERATION and matched by path PREFIX, not by root depth", () => {
  // A filter on a nested clip affects what is inside it and nothing beside it.
  // Matching on the root depth would mark a whole screen filtered because one
  // of its buttons glows, which is a count that lies in the safe-looking
  // direction.
  const record = marketOf();
  assert.equal(record.approximations.filtersNotApplied, 1);
  const filtered = record.ops.filter((op) => op.filtered === true);
  assert.equal(filtered.length, 1);
  assert.deepEqual(filtered[0].path, [7, 2, 1]);
  const sibling = record.ops.find((op) => op.depth === 7 && op.gradient);
  assert.equal(sibling.filtered, undefined, "the sibling at [7,3,1] is not under the filter");
  // ► A placement SHORTER than the prefix is not inside it, and a guard that
  //   got that backwards would mark a bare root shape filtered while every
  //   other assertion in this file stayed green.
  const shallow = record.ops.filter((op) => op.depth === 3);
  assert.equal(shallow.length, 2);
  assert.equal(shallow.every((op) => op.filtered === undefined && op.blendMode === undefined), true,
    "a one-element path is not under a two-element prefix");
});

test("a blend mode is carried on the operation, applied by nothing, and the INNERMOST wins", () => {
  const record = marketOf();
  const inner = record.ops.find((op) => op.bitmap);
  assert.equal(inner.blendMode, 9, "the placement at [9,4] is inside the one at [9]");
  const outer = record.ops.filter((op) => op.depth === 9 && !op.bitmap);
  assert.deepEqual(outer.map((op) => op.blendMode), [3, 3]);
  assert.equal(record.approximations.blendModesNotApplied, 3);
});

test("a cutter keeps every loop, and one that will not resolve is counted rather than dropped", () => {
  const record = marketOf();
  const clipped = record.ops.filter((op) => op.depth === 11);
  assert.equal(clipped.length, 2);
  // Both loops, because a mask with a hole is one region; the first alone would
  // clip to the outline and quietly enlarge whatever it cuts.
  assert.equal(clipped[0].clip.d, "M0 0L5 0L5 5L0 5ZM1 1L2 1L2 2L1 2Z");
  assert.deepEqual(clipped[0].clip.matrix, [1, 0, 0, 1, 10, 20]);
  assert.equal(clipped[0].clip, clipped[1].clip, "resolved once per placement, not once per path");
  const unclipped = record.ops.filter((op) => op.depth === 12);
  assert.equal(unclipped.every((op) => op.clip === undefined), true,
    "a cutter that will not resolve means these are drawn UNCLIPPED");
  assert.equal(record.approximations.clipsUnresolved, 1, "and that is the count saying so");
});

test("button and morph approximations are counted in OPERATIONS, keyed off the pack's `via`", () => {
  const record = marketOf();
  assert.equal(record.approximations.buttonUpStateOps, 2, "the UP records only: no over, down or hit");
  assert.equal(record.approximations.bakedMorphOps, 1, "a morph baked at one ratio, not interpolated");
  assert.equal(record.ops.find((op) => op.via === "morph 600").via, "morph 600");
});

test("the extractor's own tally is carried BESIDE this file's, never merged into it", () => {
  // Two tallies that agree are evidence. One tally copied twice is not, and a
  // manifest echoing the data it describes is the defect
  // `extraction-honesty.test.js` exists for.
  const record = marketOf();
  assert.equal(record.approximations.fromPack.bakedMorphs, 1);
  assert.equal(record.approximations.fromPack.staticTextGlyphs, 4);
  assert.equal(record.approximations.fromPack.filters, 1,
    "the extractor counted PLACEMENTS with a filter list");
  assert.equal(record.approximations.filtersNotApplied, 1,
    "this file counts OPERATIONS under one — a different population, kept separate");
});

test("the three unresolved kinds reach the caller unchanged", () => {
  const record = marketOf();
  assert.deepEqual(record.unresolvedByKind, { "text-static": 1, "text-edit": 1, "button-hit-area-only": 1 });
  assert.equal(record.approximations.buttonHitAreaOnly, 1);
  assert.equal(record.counts.unresolved, 3);
  assert.equal(record.unresolved[0].character, 1503, "with the character id, so it can be gone and looked at");
});

test("a screen is ONE FRAME, and how far that is a lie travels with the picture", () => {
  const record = marketOf();
  assert.equal(record.labelFrame, 30);
  assert.deepEqual(record.stillness, {
    differingFrames: 3, firstDifferingFrame: 32, depthsAdded: [], depthsRemoved: [7]
  });
  assert.equal(record.approximations.framesNotStill, 3);
  const still = screenFor(screenPackFrom(rawPack()), "gate");
  assert.equal(still.stillness.differingFrames, 0);
});

/* ------------------------------------------------------------------ */
/* Text: carried, counted, and not drawn                               */
/* ------------------------------------------------------------------ */

test("text becomes NO path operations, because this pack carries no glyph outlines", () => {
  const record = marketOf();
  assert.equal(record.ops.some((op) => op.depth === 45 || op.depth === 184), false);
  assert.equal(record.approximations.textNotDrawn, record.text.length);
  assert.equal(record.approximations.textNotDrawn, 2);
});

test("text carries the WORDS, the box in pixels, and the face to set them in", () => {
  // ► The words ARE known — `tools/swf-text.mjs` decodes them — and only the
  //   letterforms are missing. Handing a surface the string, the box, the
  //   colour and the font's real name is the difference between a screen with
  //   blank buttons and one somebody can read.
  const record = marketOf();
  const [caption, field] = record.text;
  assert.equal(caption.kind, "text-static");
  assert.equal(caption.text, "play");
  assert.equal("font" in caption, false,
    "a static text character has NO one font — its runs may each declare a different one");
  assertClose(caption.box.x, 119.15, "box x");
  assertClose(caption.box.width, 32.9, "box width");
  assert.deepEqual(caption.matrix, [1, 0, 0, 1, 3777, 5923], "the matrix stays in the twips convention");
  const run = caption.runs[0];
  assert.equal(run.font.name, "GoudyHandtooled BT");
  assert.equal(run.font.bold, true);
  assert.equal(run.height, 14, "280 twips is a 14 pixel face");
  assert.deepEqual(run.advances, [7.3, 3.8, 6.5, 6.5]);
  assert.equal(run.colour, "#ffffff");
  assert.equal(field.kind, "text-edit");
  assert.equal(field.variableName, "fizVersionTXT", "what the build's ActionScript writes to");
  assert.equal(field.text, "version");
  assert.equal(field.fontHeight, 10);
  assert.equal(field.font.name, "Mini 7");
  assert.equal(field.align, "right", "align 1 is RIGHT in the build's own codes");
  assertClose(field.box.height, 14.1, "field box height");
});

test("text comes back in paint order, so one walk serves the picture and the words", () => {
  const record = marketOf();
  assert.deepEqual(record.text.map((entry) => entry.depth), [45, 184]);
  assert.equal(record.text[0].why.includes("play"), true,
    "and each entry says WHY it is not a drawing, in the extractor's own words");
});

/* ------------------------------------------------------------------ */
/* The record, the shortcut, and the chrome                            */
/* ------------------------------------------------------------------ */

test("counts agree with the lists they describe", () => {
  const record = marketOf();
  assert.equal(record.counts.ops, record.ops.length);
  assert.equal(record.counts.text, record.text.length);
  assert.equal(record.counts.drawables, 19);
  assert.equal(record.counts.objects, 6);
  assert.equal(record.counts.ops, 26, "19 placements, three of which resolve to nothing and say so");
  assert.equal(record.counts.distinctShapes, new Set(record.ops.map((op) => op.shape)).size);
});

test("screenOpsFor is the same operations and nothing else", () => {
  const pack = screenPackFrom(rawPack());
  const record = screenFor(pack, "market");
  assert.deepEqual(screenOpsFor(pack, "market"), record.ops);
  // It exists for a caller already reporting the counts; the record is the
  // entry point precisely so the invoice cannot be dropped by accident.
  assert.equal(Object.isFrozen(record.ops), true);
  assert.equal(Object.isFrozen(record.approximations), true);
});

test("the chrome splits off by root depth, and it is not all in front or all behind", () => {
  const record = marketOf();
  const { chrome, body } = splitScreenChrome(record);
  assert.deepEqual(chrome.map((op) => op.depth), [1, 1, 438, 438, 1193, 1193]);
  assert.equal(body.length, record.ops.length - chrome.length);
  assert.equal(body.some((op) => SCREEN_CHROME_DEPTHS.includes(op.depth)), false);
  // Depth 1 is behind everything and 438/1193 are over everything, so a caller
  // that needs both sides reads `depth` rather than concatenating the halves.
  assert.deepEqual(SCREEN_CHROME_DEPTHS, [1, 438, 1193]);
  assert.equal(SCREEN_CHROME.find((piece) => piece.depth === 1).drawnByTheBuild, false);
});

/* ------------------------------------------------------------------ */
/* The player's own pack, when this machine has one                    */
/* ------------------------------------------------------------------ */

test("the real pack: every screen draws something, and the drawable counts match the manifest", () => {
  if (!REAL_SCREENS || !REAL_MANIFEST) {
    assert.equal(REAL_SCREENS === null || REAL_MANIFEST === null, true, "no extraction on this machine");
    return;
  }
  const pack = screenPackFrom(REAL_SCREENS);
  const names = screenNames(pack);
  assert.equal(names.length, REAL_MANIFEST.totals.screens);
  assert.equal(names.length > 0, true, "a pack with no screen at all would pass every check below vacuously");
  for (const name of names) {
    const record = screenFor(pack, name);
    assert.equal(record.counts.drawables, REAL_MANIFEST.screens[name].drawables,
      `${name}: this file and the manifest disagree about how many placements resolved`);
    assert.equal(record.counts.ops > 0, true, `${name} resolved to no operations at all`);
    assert.equal(record.labelFrame, REAL_MANIFEST.screens[name].labelFrame);
  }
});

test("the real pack: the unresolved tally survives the seam intact", () => {
  // ► **THIS IS THE DEFECT THIS WHOLE PROGRAMME EXISTS TO STAMP OUT.** Six
  //   times a count has been dropped between an extractor and a renderer, and
  //   every time the picture looked finished. The manifest was written by a
  //   different pass of a different tool, so this is two readings compared and
  //   not one echoed.
  if (!REAL_SCREENS || !REAL_MANIFEST) {
    assert.equal(REAL_SCREENS === null || REAL_MANIFEST === null, true, "no extraction on this machine");
    return;
  }
  const pack = screenPackFrom(REAL_SCREENS);
  const summed = {};
  let text = 0;
  for (const name of screenNames(pack)) {
    const record = screenFor(pack, name);
    for (const [kind, count] of Object.entries(record.unresolvedByKind)) {
      summed[kind] = (summed[kind] ?? 0) + count;
    }
    text += record.counts.text;
    assert.deepEqual(record.unresolvedByKind, REAL_MANIFEST.screens[name].unresolved,
      `${name}: the per-screen kinds disagree with the manifest`);
  }
  assert.deepEqual(summed, REAL_MANIFEST.unresolvedByKind);
  assert.equal(text, (summed["text-static"] ?? 0) + (summed["text-edit"] ?? 0),
    "every text-kind unresolved entry reaches the caller as a text placement it can still set");
});

test("the real pack: the operation count recomputes from the shape table", () => {
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  const pack = screenPackFrom(REAL_SCREENS);
  let fromModule = 0;
  let fromData = 0;
  for (const name of screenNames(pack)) {
    fromModule += screenFor(pack, name).counts.ops;
    for (const drawable of REAL_SCREENS.screens[name].drawables) {
      const shape = REAL_SCREENS.shapes[drawable.shape];
      for (const entry of shape?.paths ?? []) {
        if (typeof entry.d === "string" && entry.d.length > 0) fromData += 1;
      }
    }
  }
  assert.equal(fromModule, fromData, "an operation was invented or lost between the pack and the caller");
  assert.equal(fromData > 0, true, "and the recomputation engaged with the data rather than counting nothing");
});

test("the real pack: all 26 screens carry the same chrome, and depth 1 draws nothing on any of them", () => {
  // ► The headline finding of `tools/extract-screens.mjs`, re-derived here from
  //   the pack rather than quoted: the root places character 643 once at frame
  //   1 with `alphaMultiplier = 0` and never replaces it. Note that
  //   `SS2_ARENA_SCREEN_LAYERS` still declares 643 as the arena's `backdrop`
  //   layer — the two readings of the same character disagree, and the root
  //   placement is the one with the transparency in it.
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  const pack = screenPackFrom(REAL_SCREENS);
  const names = screenNames(pack);
  assert.equal(names.length > 0, true, "otherwise the loop below asserts nothing");
  let invisibleBackdrops = 0;
  for (const name of names) {
    const record = screenFor(pack, name);
    const depths = new Set(record.objects.map((object) => object.depth));
    for (const piece of SCREEN_CHROME) {
      assert.equal(depths.has(piece.depth), true, `${name} is missing chrome depth ${piece.depth}`);
      const object = record.objects.find((candidate) => candidate.depth === piece.depth);
      assert.equal(object.character, piece.character, `${name} depth ${piece.depth} is a different character`);
    }
    const backdrop = splitScreenChrome(record).chrome.filter((op) => op.depth === 1);
    assert.equal(backdrop.length > 0, true, `${name} has no depth-1 operation to check`);
    if (backdrop.every((op) => op.fillOpacity === 0)) invisibleBackdrops += 1;
  }
  assert.equal(invisibleBackdrops, names.length,
    "the build draws character 643 on no screen, and a renderer that 'fixes' that is inventing art");
});

test("the real pack: the arena is the screen at root frame 221", () => {
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  const record = screenFor(screenPackFrom(REAL_SCREENS), "arena");
  assert.equal(record.labelFrame, 221);
  const depths = new Set(record.objects.map((object) => object.depth));
  // Every STAGE-space layer `arena-backdrop.js` declares is a root depth on
  // this screen; the arena-space ones (the sand, the crowd) are inside the
  // arena clip and are not root placements at all.
  for (const layer of SS2_ARENA_SCREEN_LAYERS) {
    if (layer.space !== "stage") continue;
    assert.equal(depths.has(layer.depth), true,
      `root frame 221 has no depth ${layer.depth} for the ${layer.prop} layer`);
  }
  assert.equal(record.counts.ops > 0, true, "and it resolves to a picture");
});
