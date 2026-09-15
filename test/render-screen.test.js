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
 *
 * ► **AND A REAL-PACK ASSERTION IS ONLY AS STRONG AS THE RANGE THE PACK CAN
 *   TAKE. This file got that wrong once and the correction is the shape of
 *   half the work below.** `assert.equal(checked, 1023)` read as a coverage
 *   number; measured 2026-09-14, 330 of those 1023 sit under ALPHA-ONLY colour
 *   transforms and compare an untransformed value against an untransformed
 *   recomputation, which cannot discriminate anything under any rounder. All
 *   107 of the pack's transformed gradient stops are in that 330, which is why
 *   deleting the stop-fill transform from `screen.js` altogether left this
 *   file at 36 pass / 0 fail and the real pack's operation digest
 *   byte-identical.
 *
 *   The rule that follows: **whenever a count or a digest is offered as
 *   evidence, ask what values it can actually take.** Where the answer is
 *   "one", the case belongs in a synthetic fixture that says out loud that the
 *   build does not contain it — `tintPack` below — and the real-pack assertion
 *   should state its own reach rather than its own size.
 */

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canvasFilterFor } from "../src/render/filters.js";
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
  splitScreenChrome,
  STAGE_BLANKET
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

test("THE REAL-PACK HALF OF THIS FILE IS ANCHORED: a broken path FAILS here rather than emptying twelve tests", () => {
  // ► **AN `fs.existsSync` GUARD CANNOT TELL "no licensed copy here" FROM
  //   "REPO_ROOT IS WRONG".** Twelve tests below open with `if (!REAL_SCREENS)`
  //   and assert the absence instead of skipping, which keeps the suite's skip
  //   count still — but the absence they assert is `readRealJson` returning
  //   null, and that is what a broken derivation of REPO_ROOT returns too. Then
  //   twelve tests quietly become `assert.equal(null, null)` and report a pass.
  //   `test/extraction-honesty.test.js` did exactly that on this project once.
  //
  //   So the ANCHOR is a TRACKED file on the same derived root, the way
  //   `test/render-text.test.js` anchors its pack path: if `src/render/screen.js`
  //   is not where REPO_ROOT says it is, the root is wrong and this test fails
  //   by name instead of twelve others going silent.
  const anchorAt = path.join(REPO_ROOT, "src", "render", "screen.js");
  assert.ok(fs.existsSync(anchorAt),
    `${anchorAt} is not there, so REPO_ROOT is wrong and the absence of assets/screens/screens.json would mean nothing`);
  assert.equal(REAL_SCREENS === null, !fs.existsSync(path.join(REPO_ROOT, "assets", "screens", "screens.json")),
    "the real-pack tests run exactly when the extracted pack is present, and that is the ONLY reason they may assert an absence");
  assert.equal(REAL_MANIFEST === null, !fs.existsSync(path.join(REPO_ROOT, "assets", "screens", "manifest.json")),
    "and the manifest half is gated on its own file, not on the pack's");
});

/**
 * The stage-space box of everything a screen actually paints.
 *
 * Coordinates are pulled out of the `d` string with a number regexp and pushed
 * through the operation's matrix exactly as `tools/arena/main.js` does —
 * **translation divided by 20, geometry not** — which is the point: this helper
 * is a stand-in for the painter, so a units error at the seam shows up here.
 * A quadratic's control point is counted as a corner, which only ever makes the
 * box larger and cannot manufacture a pass for a screen drawn off-stage.
 */
function visibleBoxOf(ops) {
  const box = { xMin: Infinity, yMin: Infinity, xMax: -Infinity, yMax: -Infinity, points: 0 };
  for (const op of ops) {
    const stroked = typeof op.stroke === "string" && op.strokeWidth > 0 && op.strokeOpacity > 0;
    if (op.fillOpacity === 0 && !stroked) continue;
    const m = op.matrix;
    const numbers = (op.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      const x = m[0] * numbers[index] + m[2] * numbers[index + 1] + m[4] / 20;
      const y = m[1] * numbers[index] + m[3] * numbers[index + 1] + m[5] / 20;
      if (x < box.xMin) box.xMin = x;
      if (x > box.xMax) box.xMax = x;
      if (y < box.yMin) box.yMin = y;
      if (y > box.yMax) box.yMax = y;
      box.points += 1;
    }
  }
  return box;
}

/**
 * Whether an operation puts FILL ink down — the test's own reading of the
 * question `blanketOpacityOf` answers with a number.
 *
 * Written out rather than imported because the module's version is not
 * exported and, more to the point, an assertion that calls the code it is
 * checking checks nothing. The three places alpha hides are the reason this is
 * not `op.fillOpacity > 0`: a gradient keeps it in its STOPS, a bitmap has no
 * colour in the operation at all, and `fill: "none"` paints nothing whatever
 * the opacity says — which is why a stroke-only path is not ink here even
 * though it draws.
 */
function opPutsFillInkDown(op) {
  if (op.gradient) {
    const stops = Array.isArray(op.gradient.stops) ? op.gradient.stops : [];
    return stops.length > 0 && stops.every((stop) => (typeof stop?.opacity === "number" ? stop.opacity : 1) > 0);
  }
  if (op.bitmap) return op.fillOpacity > 0;
  if (typeof op.fill !== "string" || op.fill === "none") return false;
  return op.fillOpacity > 0;
}

/**
 * The effective alpha of an operation where it paints, 0..1 — this file's own
 * reading of `blanketOpacityOf`, and the numeric form of the predicate above.
 */
function blanketAlphaOf(op) {
  if (op.gradient) {
    const stops = Array.isArray(op.gradient.stops) ? op.gradient.stops : [];
    if (stops.length === 0) return 0;
    return Math.min(...stops.map((stop) => (typeof stop?.opacity === "number" ? stop.opacity : 1)));
  }
  if (op.bitmap) return typeof op.fillOpacity === "number" ? op.fillOpacity : 1;
  if (typeof op.fill !== "string" || op.fill === "none") return 0;
  return typeof op.fillOpacity === "number" ? op.fillOpacity : 1;
}

/**
 * The fraction of the stage an operation's BOX covers, clipped to the stage.
 *
 * The module transforms the four corners of the path-space box; this transforms
 * every coordinate in the `d` and takes the box of those. The module's is never
 * the smaller of the two, so this route could have admitted FEWER operations
 * than the module's pre-filter — measured over the 26 screens, it admits
 * exactly the same 42, which is worth knowing and is not a tautology.
 */
function stageBoxCoverageOf(op) {
  const box = visibleBoxOf([op]);
  if (!Number.isFinite(box.xMin)) return 0;
  const left = Math.max(0, box.xMin);
  const top = Math.max(0, box.yMin);
  const right = Math.min(SS2_STAGE.width, box.xMax);
  const bottom = Math.min(SS2_STAGE.height, box.yMax);
  if (right <= left || bottom <= top) return 0;
  return ((right - left) * (bottom - top)) / (SS2_STAGE.width * SS2_STAGE.height);
}

/**
 * The fraction of the stage an operation covers WHEN ITS FILL AND ITS BOX ARE
 * THE SAME REGION, or null when they are not and only a raster could say.
 *
 * ► **THE ONE CASE A TEST CAN DECIDE WITHOUT REIMPLEMENTING THE RASTER.** An
 *   axis-aligned rectangle under a matrix with no rotation or skew fills its
 *   own bounding box exactly: no curve to flatten, no second subpath for
 *   even-odd to punch a hole with, no rotation to make the box larger than the
 *   shape. Everything else returns null and is left to the module — which is
 *   the honest line, because a test that reimplements the scanline sampler and
 *   agrees with it has checked that two copies of one idea agree.
 *
 * Units, the seam this project has lost three defects to: the translation is
 * divided by 20 and the geometry is not.
 */
function stageRectangleCoverageOf(op) {
  if (op.matrix[1] !== 0 || op.matrix[2] !== 0) return null;
  if (/[QqCcAaSsTt]/.test(op.d)) return null;
  if ((op.d.match(/[Mm]/g) ?? []).length !== 1) return null;
  const numbers = (op.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const points = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) points.push([numbers[index], numbers[index + 1]]);
  if (points.length === 5 && points[0][0] === points[4][0] && points[0][1] === points[4][1]) points.pop();
  if (points.length !== 4) return null;
  const xs = [...new Set(points.map((point) => point[0]))];
  const ys = [...new Set(points.map((point) => point[1]))];
  if (xs.length !== 2 || ys.length !== 2) return null;
  const m = op.matrix;
  const [x1, x2] = xs.map((x) => m[0] * x + m[4] / 20).sort((a, b) => a - b);
  const [y1, y2] = ys.map((y) => m[3] * y + m[5] / 20).sort((a, b) => a - b);
  const left = Math.max(0, x1);
  const top = Math.max(0, y1);
  const right = Math.min(SS2_STAGE.width, x2);
  const bottom = Math.min(SS2_STAGE.height, y2);
  if (right <= left || bottom <= top) return 0;
  return ((right - left) * (bottom - top)) / (SS2_STAGE.width * SS2_STAGE.height);
}

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

/* ------------------------------------------------------------------ */
/* FILTERS, in the shape `tools/swf-display-list.mjs` decodes them      */
/* ------------------------------------------------------------------ */

/**
 * ► **EVERY FIELD BELOW IS THE ORACLE'S OWN, COPIED OUT OF
 *   `assets/screens/screens.json` RATHER THAN INVENTED**, so the strings these
 *   produce are the strings the build produces. `GLOW_ORANGE` is `splash`'s
 *   character 1509 at [52,1]; `INNER_BEVEL` is the bevel beside it on the same
 *   list — one of the 54 in the build, all inner, all refused. `BLUR_4`'s
 *   radii are `townsquare`'s [3] and `GLOW_ZERO` is the strength-0 shape that
 *   277 of the build's 853 glows share with it.
 */
const GLOW_ORANGE = {
  type: "glow", filterId: 2, colour: { red: 255, green: 153, blue: 0, alpha: 255 },
  blurX: 5, blurY: 5, strength: 10, inner: false, knockout: false, compositeSource: true, passes: 1
};
const INNER_BEVEL = {
  type: "bevel", filterId: 3,
  highlightColour: { red: 255, green: 255, blue: 255, alpha: 255 },
  shadowColour: { red: 0, green: 0, blue: 0, alpha: 255 },
  blurX: 0, blurY: 0, angle: 0.7853851318359375, distance: 4, strength: 1,
  inner: true, knockout: false, compositeSource: true, onTop: false, passes: 2
};
const BLUR_4 = { type: "blur", filterId: 1, blurX: 4, blurY: 4, passes: 1 };
const GLOW_ZERO = {
  type: "glow", filterId: 2, colour: { red: 255, green: 255, blue: 255, alpha: 255 },
  blurX: 6, blurY: 6, strength: 0, inner: false, knockout: false, compositeSource: true, passes: 1
};
/** A greyscale matrix in FLASH's coefficients, which is why no CSS shorthand fits it. */
const MATRIX_GREY = {
  type: "colourMatrix", filterId: 6,
  matrix: [
    0.3086, 0.6094, 0.082, 0, 0,
    0.3086, 0.6094, 0.082, 0, 0,
    0.3086, 0.6094, 0.082, 0, 0,
    0, 0, 0, 1, 0
  ]
};

const ALPHA_ZERO = { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 0, redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0 };
const BLUE_102 = { redMultiplier: 0, greenMultiplier: 0, blueMultiplier: 0, alphaMultiplier: 1, redOffset: 0, greenOffset: 0, blueOffset: 102, alphaOffset: 0 };
const HALF_RED = { redMultiplier: 0.5, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0 };
const HALF_ALPHA = { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 0.5, redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0 };
const ALPHA_OFFSET = { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: -64 };

/* ------------------------------------------------------------------ */
/* A SECOND PACK, for the two cases neither `market` NOR the real       */
/* extraction can reach                                                 */
/* ------------------------------------------------------------------ */

/**
 * ► **THE REAL PACK CANNOT EXERCISE GRADIENT-STOP TINTING AT ALL, AND UNTIL
 *   2026-09-14 NOTHING IN THIS SUITE COULD EITHER.** Measured over all 26
 *   screens by walking `assets/screens/screens.json` directly: 107 gradient
 *   stops sit under a colour transform and **all 107 of those transforms are
 *   ALPHA-ONLY** — every RGB multiplier 1, every RGB offset 0, across the four
 *   distinct transforms involved (`[1,1,1,0.94921875,…]`, `[1,1,1,0,…]`,
 *   `[1,1,1,0.80078125,…]`, `[1,1,1,0.4609375,…]`) on 21 gradient paths. So
 *   `transformGradient`'s `fill: applyColourTransform(stop.fill, colour)` is
 *   a line the whole real pack holds at the identity.
 *
 *   Measured by mutation on 2026-09-14, before this block existed: deleting
 *   that transform outright — `fill: stop.fill` — left this file at **36 pass
 *   / 0 fail** and left the sha256 of every operation and every tally across
 *   all 26 real screens **byte-identical** (`eaf4c165…`, 13638 ops). **A digest
 *   over data that cannot vary is not evidence**, and that is the general
 *   lesson rather than a detail about gradients.
 *
 *   `market`'s own gradients are under `HALF_ALPHA` and `ALPHA_OFFSET`, which
 *   are alpha-only too, which is why the stop-fill assertion further down —
 *   `["#9c2b00", "#ffcc83"]` — survived that mutation as well: it asserts the
 *   UNTRANSFORMED values and cannot tell a working transform from a deleted
 *   one.
 *
 * ► **AND THE SAME IS TRUE OF THE BITMAP COUNTER'S OFFSET HALF.** 29 bitmap
 *   paths across the 26 screens, 8 of them under a colour transform, and all 8
 *   under the SAME alpha-only transform `[1,1,1,0.19921875,0,0,0,0]` (shape
 *   718 on splash, new_or_continue, credits, help, gameover, bugs,
 *   gameover_demo and enter_highscore). `bitmapColourTransformDropped` is
 *   therefore 0 on real data and `touchesRgb` never returns true on it.
 *   `market`'s `HALF_RED` bitmap pins the MULTIPLIER half; nothing pinned the
 *   OFFSET half, and deleting `colour[4] !== 0 || colour[5] !== 0 ||
 *   colour[6] !== 0` left the file 36 pass / 0 fail.
 *
 *   The offset half is not dead because offsets are rare — 133 of the 287
 *   tinted drawables carry one. It is dead because **no transform on this pack
 *   has identity multipliers AND a non-zero offset**: measured, the five
 *   combinations that occur are mult+offset (123), alpha-only (123),
 *   mult+alpha (26), mult+offset+alpha (10) and mult-only (5), and
 *   `rgbMult=false, rgbOff=true` occurs ZERO times. So the multiplier half
 *   subsumes the offset half on this build and only this build.
 *
 * These four drawables are the missing cases and nothing else. They are a
 * SEPARATE pack rather than four more rows in `market` so that every count
 * `market` pins keeps meaning what it meant.
 */
const RGB_MULT_AND_OFFSET = { redMultiplier: 0.5, greenMultiplier: 0.25, blueMultiplier: 1, alphaMultiplier: 0.5, redOffset: 0, greenOffset: 8, blueOffset: -40, alphaOffset: 0 };
const RGB_OFFSET_ONLY = { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 17, greenOffset: 0, blueOffset: -9, alphaOffset: 0 };
const ALPHA_ONLY_075 = { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 0.75, redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0 };

function tintPack() {
  return {
    screens: {
      forge: {
        name: "forge",
        labelFrame: 100, firstFrame: 100, lastFrame: 100,
        objects: [
          { depth: 2, character: 12, kind: "shape", matrix: [1, 0, 0, 1, 0, 0], drawables: 1 },
          { depth: 3, character: 12, kind: "shape", matrix: [1, 0, 0, 1, 0, 0], drawables: 1 },
          { depth: 4, character: 13, kind: "shape", matrix: [1, 0, 0, 1, 0, 0], drawables: 1 },
          { depth: 5, character: 13, kind: "shape", matrix: [1, 0, 0, 1, 0, 0], drawables: 1 }
        ],
        drawables: [
          // The case the real pack has none of: a gradient under a transform
          // that moves RED, GREEN and BLUE. Both stops are chosen so the
          // rounder is visible — 255 * 0.5 is 127.5 — and so that one channel
          // clamps at the bottom.
          { shape: 12, path: [2, 1], matrix: [1, 0, 0, 1, 0, 0], colour: RGB_MULT_AND_OFFSET },
          // The case the real pack has 107 stops of, beside it, so a transform
          // that fired when it should not also turns this red.
          { shape: 12, path: [3, 1], matrix: [1, 0, 0, 1, 0, 0], colour: ALPHA_ONLY_075 },
          // A bitmap under IDENTITY multipliers and non-zero offsets: the only
          // shape of transform for which `touchesRgb`'s offset half is the
          // thing that answers.
          { shape: 13, path: [4, 1], matrix: [1, 0, 0, 1, 0, 0], colour: RGB_OFFSET_ONLY },
          // And a bitmap under alpha alone, so a `touchesRgb` that always
          // returned true would be caught by the same assertion.
          { shape: 13, path: [5, 1], matrix: [1, 0, 0, 1, 0, 0], colour: ALPHA_ONLY_075 }
        ],
        unresolved: [], textFields: [], staticText: [],
        multiFrameSprites: [], filteredPlacements: [], blendedPlacements: [],
        rangeVariance: { frames: 0, firstDifferingFrame: null, depthsAdded: [], depthsRemoved: [] },
        approximations: {},
        counts: { objects: 4, drawables: 4 },
        resolvedNothing: false
      }
    },
    shapes: SHAPES,
    fonts: {}
  };
}

function forgeOf() {
  return screenFor(screenPackFrom(tintPack()), "forge");
}

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
        // ► **THIS ENTRY USED TO BE `{ character: 60, path: [7, 2] }` AND
        //   CARRIED NO `filters` KEY AT ALL, WHICH IS THE BUG IT HID.**
        //   `screen.js` read only `entry.path`, so everything the module said
        //   about filters was invariant under these records being right, wrong
        //   or absent — and this fixture proved it by being absent and green.
        //   The five below are chosen to reach every arm of `canvasFilterFor`
        //   that the real pack reaches, plus the two it does not.
        filteredPlacements: [
          // One string and one REFUSAL on the same list, over the single
          // stroke-only operation at [7,2,1]. The real pack has exactly this
          // shape twice (`splash` and `new_or_continue` at [52,1]).
          { character: 60, path: [7, 2], filters: [GLOW_ORANGE, INNER_BEVEL] },
          // ► **NESTING, BESIDE THE BLEND MODES ON THE SAME TWO PATHS.** The
          //   outer group is a COLOUR MATRIX over three operations and the
          //   inner is a BLUR over one of them — `townsquare`'s [59,1] and
          //   [59,1,8] in miniature. The blend modes at [9] and [9,4] answer
          //   "innermost wins"; these two must NOT, and having both on one
          //   pair of paths is what makes a rule copied from the wrong
          //   neighbour fail here.
          { character: 70, path: [9], filters: [MATRIX_GREY] },
          { character: 71, path: [9, 4], filters: [BLUR_4] },
          // A glow at strength 0: `canvasFilterFor` calls it a no-op, and
          // nothing is lost because the build draws nothing for it either.
          // The real pack has three of these, over 24 operations.
          { character: 72, path: [19], filters: [GLOW_ZERO] },
          // An EMPTY filter list. The oracle holds five.
          { character: 73, path: [16], filters: [] }
        ],
        // The pack's SECOND filter list, which a roster built from
        // `filteredPlacements` alone would leave invisible. [45] is the static
        // text, so this one reaches no operation at all — the same position
        // all five of the real pack's button records are in.
        filteredButtonRecords: [
          { character: 74, path: [45], button: 777, leaf: "text", filters: [GLOW_ORANGE] }
        ],
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
/* Operations that blanket the stage                                   */
/* ------------------------------------------------------------------ */

/**
 * A PACK BUILT ENTIRELY OUT OF THE WAYS SOMETHING CAN LOOK LIKE A CURTAIN.
 *
 * ► **THE REAL PACK HAS SEVEN BLANKETS AND ONLY THREE OF THE FIVE REJECTION
 *   REASONS, WHICH IS WHY THIS EXISTS.** Measured across all 26 real screens:
 *   a full-stage ring occurs (the border, 26 times), a full-stage operation at
 *   zero opacity occurs (character 642, 26 times) and a part-transparent
 *   full-stage bitmap occurs (character 718, 8 times) — but **no full-stage
 *   operation is ever cut down by a clip, none is drawn off-stage, none is
 *   stroke-only, no gradient covering the stage has a transparent stop, and no
 *   path in the pack uses a command `flattenToEdges` cannot read.** Every one
 *   of those is a way for `stageBlanketsOf` to be wrong in the direction that
 *   over-counts, and the build cannot tell us about any of them.
 *
 * ► **AND THE ROTATED ONE IS NOT DECORATION.** `bboxStageCoverage` takes the
 *   path-space box and transforms its FOUR CORNERS, which is a different box
 *   from the one you get by transforming the points — and under `b = c = 0`,
 *   which is every matrix in the real pack that matters here, the two are
 *   identical. A 90-degree rotation is the only thing in this file that can
 *   tell a correct corner transform from one that quietly drops `b` and `c`.
 */
const STAGE_SHAPES = Object.freeze({
  // Exactly the 640 x 420 stage.
  20: { character: 20, paths: [{ d: "M0 0L640 0L640 420L0 420Z", fill: "#000000", fillOpacity: 1, fillRule: "evenodd", approximated: null, stroke: null, strokeWidth: 0 }] },
  // A RING: one path, two subpaths, even-odd. Its BOX is bigger than the stage
  // and its FILL is a 10-pixel frame. This is the ornamental border's shape and
  // it is the single case a box-only implementation gets wrong 26 times.
  21: { character: 21, paths: [{ d: "M-20 -20L660 -20L660 440L-20 440ZM10 10L630 10L630 410L10 410Z", fill: "#000000", fillOpacity: 1, fillRule: "evenodd", approximated: null, stroke: null, strokeWidth: 0 }] },
  // A full-stage gradient whose SECOND STOP IS TRANSPARENT. `fillOpacity` is 1,
  // so anything reading only that field calls this a curtain.
  22: { character: 22, paths: [{
    d: "M0 0L640 0L640 420L0 420Z", fill: "#9c2b00", fillOpacity: 1, fillRule: "evenodd", approximated: "gradient",
    gradient: { type: "linear", focal: false, focalPoint: 0, spread: 0, interpolation: 0, matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      stops: [{ offset: 0, fill: "#9c2b00", opacity: 1 }, { offset: 1, fill: "#ffcc83", opacity: 0 }] },
    stroke: null, strokeWidth: 0 }] },
  // The same gradient with both stops opaque, so the gradient branch is not
  // merely "the thing that always says no".
  23: { character: 23, paths: [{
    d: "M0 0L640 0L640 420L0 420Z", fill: "#9c2b00", fillOpacity: 1, fillRule: "evenodd", approximated: "gradient",
    gradient: { type: "linear", focal: false, focalPoint: 0, spread: 0, interpolation: 0, matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      stops: [{ offset: 0, fill: "#9c2b00", opacity: 1 }, { offset: 1, fill: "#ffcc83", opacity: 1 }] },
    stroke: null, strokeWidth: 0 }] },
  // A full-stage raster. `fill` is "none" — the operation has no colour in it
  // at all — so a flat-fill reading calls this invisible and skips it.
  24: { character: 24, paths: [{ d: "M0 0L640 0L640 420L0 420Z", fill: "none", fillOpacity: 1, fillRule: "evenodd", approximated: "bitmap",
    bitmap: { id: 99, matrix: { a: 20, b: 0, c: 0, d: 20, tx: 0, ty: 0 }, repeat: false }, stroke: null, strokeWidth: 0 }] },
  // A CUBIC. `shapeToPaths` emits no such command today; this is what a future
  // one must not be able to shrink a shape with.
  25: { character: 25, paths: [{ d: "M0 0C0 0 640 0 640 420Z", fill: "#000000", fillOpacity: 1, fillRule: "evenodd", approximated: null, stroke: null, strokeWidth: 0 }] },
  // Stroke-only, and a CLOSED LOOP round the whole stage rather than a
  // diagonal line — because a diagonal encloses nothing, so the raster rejects
  // it whatever the opacity reader says, and a test that cannot tell the two
  // apart is not testing the opacity reader. `fill: "none"` at fillOpacity 1
  // is the invisibility trap `STROKE_ONLY` above is named for; here it is the
  // trap at stage size.
  26: { character: 26, paths: [{ d: "M0 0L640 0L640 420L0 420Z", fill: "none", fillOpacity: 1, fillRule: "evenodd", approximated: null, stroke: "#ffffff", strokeWidth: 500, strokeOpacity: 1 }] },
  // A 20 x 20 cutter.
  27: { character: 27, paths: [{ d: "M0 0L20 0L20 20L0 20Z", fill: "#ffffff", fillOpacity: 1, fillRule: "evenodd", approximated: null, stroke: null, strokeWidth: 0 }] },
  // 420 wide and 640 tall — the stage turned on its side, so it covers only
  // when the rotation in its matrix is actually applied.
  28: { character: 28, paths: [{ d: "M0 0L420 0L420 640L0 640Z", fill: "#123456", fillOpacity: 1, fillRule: "evenodd", approximated: null, stroke: null, strokeWidth: 0 }] },
  // A square turned 45 degrees. The quarter-turn above is covered by the two
  // DIAGONAL corners of the path-space box on their own; this one is not —
  // rotate its box's diagonal pair and you get a zero-width strip. It is the
  // only shape here that needs all four corners transformed.
  29: { character: 29, paths: [{ d: "M-520 -520L520 -520L520 520L-520 520Z", fill: "#654321", fillOpacity: 1, fillRule: "evenodd", approximated: null, stroke: null, strokeWidth: 0 }] },
  // A rectangle whose TOP EDGE IS A QUADRATIC bulging up off the stage. Its
  // straight-line chord runs at y = 60, so the top 55 pixels are outside the
  // chord and inside the curve: flattened properly it covers 97.5% of the
  // stage, and flattened as a chord it covers 86% and is not a blanket. It is
  // the only shape here whose answer depends on the curve subdivision at all.
  31: { character: 31, paths: [{ d: "M0 420L0 60Q320 -140 640 60L640 420Z", fill: "#204060", fillOpacity: 1, fillRule: "evenodd", approximated: null, stroke: null, strokeWidth: 0 }] }
});

const FIFTH_ALPHA = { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 0.2, redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0 };

function curtainPack() {
  return {
    screens: {
      curtain: {
        name: "curtain",
        labelFrame: 1, firstFrame: 1, lastFrame: 1,
        objects: [],
        drawables: [
          // 0 — the curtain: opaque, black, the whole stage.
          { shape: 20, path: [10, 1], matrix: [1, 0, 0, 1, 0, 0] },
          // 1 — the same shape at alphaMultiplier 0. This is character 643 on
          //     all 26 real screens and it must never be a blanket.
          { shape: 20, path: [11, 1], matrix: [1, 0, 0, 1, 0, 0], colour: ALPHA_ZERO },
          // 2 — the ring.
          { shape: 21, path: [12, 1], matrix: [1, 0, 0, 1, 0, 0] },
          // 3 — gradient with a transparent stop.
          { shape: 22, path: [13, 1], matrix: [1, 0, 0, 1, 0, 0] },
          // 4 — gradient, both stops opaque: A BLANKET.
          { shape: 23, path: [14, 1], matrix: [1, 0, 0, 1, 0, 0] },
          // 5 — raster at full opacity: A BLANKET.
          { shape: 24, path: [15, 1], matrix: [1, 0, 0, 1, 0, 0] },
          // 6 — the same raster at a fifth of the alpha.
          { shape: 24, path: [16, 1], matrix: [1, 0, 0, 1, 0, 0], colour: FIFTH_ALPHA },
          // 7 — the curtain CUT DOWN to 20 x 20.
          { shape: 20, path: [17, 1], matrix: [1, 0, 0, 1, 0, 0], clip: { shape: 27, matrix: [1, 0, 0, 1, 0, 0] } },
          // 8 — geometry this file cannot flatten.
          { shape: 25, path: [18, 1], matrix: [1, 0, 0, 1, 0, 0] },
          // 9 — stroke only.
          { shape: 26, path: [19, 1], matrix: [1, 0, 0, 1, 0, 0] },
          // 10 — the curtain translated a full stage width to the right.
          { shape: 20, path: [20, 1], matrix: [1, 0, 0, 1, 12800, 0] },
          // 11 — the stage on its side, rotated a quarter turn onto it:
          //      (x, y) -> (640 - y, x). A BLANKET, and the only one whose
          //      matrix has anything in `b` or `c`.
          { shape: 28, path: [21, 1], matrix: [0, 1, -1, 0, 12800, 0] },
          // 12 — the same trick at 45 degrees, centred on the stage. A BLANKET.
          { shape: 29, path: [22, 1], matrix: [Math.SQRT1_2, Math.SQRT1_2, -Math.SQRT1_2, Math.SQRT1_2, 6400, 4200] },
          // 13 — covers the stage only because its top edge CURVES off it.
          //      A BLANKET, at 97.5% rather than 100%.
          { shape: 31, path: [23, 1], matrix: [1, 0, 0, 1, 0, 0] }
        ],
        unresolved: [], textFields: [], staticText: [],
        multiFrameSprites: [], filteredPlacements: [], blendedPlacements: [],
        rangeVariance: { frames: 0, firstDifferingFrame: null, depthsAdded: [], depthsRemoved: [] },
        approximations: {},
        counts: { objects: 0, drawables: 14 },
        resolvedNothing: false
      }
    },
    shapes: STAGE_SHAPES,
    fonts: {}
  };
}

function curtainOf() {
  return screenFor(screenPackFrom(curtainPack()), "curtain");
}

test("a blanket is counted by what it COVERS and what it HIDES, not by its bounding box", () => {
  const record = curtainOf();
  assert.equal(record.ops.length, 14, "one operation per drawable, so an index below is a drawable index");

  // ► **THE COUNT, AND THE FIVE REJECTIONS THAT ARE THE WHOLE POINT OF IT.**
  //   Four of the twelve cover the stage opaquely. Every other one of the
  //   twelve is a way to look like a curtain without being one, and each is
  //   named beside its index so a change to this number says WHICH case moved.
  assert.deepEqual(record.blankets.map((entry) => entry.index), [0, 4, 5, 11, 12, 13],
    "the rect, the opaque gradient, the raster, two rotations and the curved one — and nothing else");
  assert.equal(record.approximations.blanketsTheStage, 6, "and the tally agrees with the roster");

  // ► **AN UNPARSEABLE CANDIDATE IS COUNTED, NOT SWALLOWED.** It is a full-stage
  //   black cubic: it passes the opacity test and the box test and then cannot
  //   be measured, which without this counter is indistinguishable from a
  //   correct "no".
  assert.equal(record.approximations.blanketGeometryUnparsed, 1, "the cubic at index 8");
  assert.equal(record.blankets.some((entry) => entry.index === 8), false,
    "and it is NOT in the roster: not measured is not the same as measured and rejected");
});

test("each rejected candidate is rejected for its OWN reason, checked one at a time", () => {
  const pack = curtainPack();
  // A drawable on its own screen, so a rejection cannot hide behind another
  // drawable's acceptance — the failure mode where four cases share one number.
  const alone = (index) => {
    const one = curtainPack();
    one.screens.curtain.drawables = [pack.screens.curtain.drawables[index]];
    return screenFor(screenPackFrom(one), "curtain");
  };
  assert.equal(alone(0).approximations.blanketsTheStage, 1, "the control: this one really does cover the stage");
  assert.equal(alone(1).approximations.blanketsTheStage, 0, "alphaMultiplier 0 — character 643 on all 26 real screens");
  assert.equal(alone(2).approximations.blanketsTheStage, 0, "a RING: box bigger than the stage, fill a 10-pixel frame");
  assert.equal(alone(3).approximations.blanketsTheStage, 0, "a gradient whose alpha is in a STOP and not in `fillOpacity`");
  assert.equal(alone(4).approximations.blanketsTheStage, 1, "and the opaque gradient is not rejected with it");
  assert.equal(alone(5).approximations.blanketsTheStage, 1, "a raster: `fill` is \"none\" and it still covers everything");
  assert.equal(alone(6).approximations.blanketsTheStage, 0, "the same raster at alpha 0.2");
  assert.equal(alone(7).approximations.blanketsTheStage, 0, "clipped to 20 x 20 out of 640 x 420");
  assert.equal(alone(8).approximations.blanketsTheStage, 0, "a command this file cannot flatten is never counted as covering");
  assert.equal(alone(9).approximations.blanketsTheStage, 0, "stroke-only: the coverage test is over the FILL region");
  assert.equal(alone(10).approximations.blanketsTheStage, 0, "translated a whole stage width off to the right");
  assert.equal(alone(11).approximations.blanketsTheStage, 1, "and a quarter turn still covers the stage");
  assert.equal(alone(12).approximations.blanketsTheStage, 1, "so does 45 degrees, which needs all four corners of the box");
  assert.equal(alone(13).approximations.blanketsTheStage, 1, "and one that covers only because its top edge CURVES off the stage");
  assert.equal(alone(13).blankets[0].coverage < 1, true,
    "► and it is 97.5%, not 100% — the only entry here whose coverage is neither 0 nor 1");

  // ► **THE RING IS THE ASSERTION THAT PROVES THERE IS A RASTER HERE AT ALL.**
  //   Its bounding box is 680 x 460 against a 640 x 420 stage — 100% by box —
  //   and its fill covers a tenth of that. A box-only implementation passes
  //   every other line in this test and fails this one.
  const ring = STAGE_SHAPES[21].paths[0].d;
  const numbers = ring.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const xs = numbers.filter((_, index) => index % 2 === 0);
  const ys = numbers.filter((_, index) => index % 2 === 1);
  assert.equal(Math.min(...xs) <= 0 && Math.max(...xs) >= SS2_STAGE.width, true, "its box spans the stage horizontally");
  assert.equal(Math.min(...ys) <= 0 && Math.max(...ys) >= SS2_STAGE.height, true, "and vertically");
});

test("a blanket entry carries what a FIX would act on, not just a tally", () => {
  const record = curtainOf();
  const curtain = record.blankets[0];
  assert.equal(curtain.index, 0);
  assert.equal(curtain.opsBefore, 0, "nothing was painted before it, so it hides nothing — a backdrop, not a curtain");

  // ► **AND WHAT IS PAINTED OVER IT AFTERWARDS, which is the half that decides
  //   whether a black stage is this operation or the page's own ground.** See
  //   `stageBlanketsOf`'s "curtain, or the page's own black ground?". `inkAfter`
  //   counts FILL ink, so the three of the thirteen that put none down are
  //   excluded by NAME here rather than by a number nobody can decompose: index
  //   1 is the same shape at alphaMultiplier 0, index 3 is the gradient with a
  //   transparent stop, and index 9 is the stroke-only loop — whose `fill` is
  //   "none" at fillOpacity 1, so it DOES draw and is deliberately not ink by
  //   this reading.
  assert.equal(curtain.opsAfter, 13, "thirteen operations are painted over it");
  assert.equal(curtain.inkAfter, 10, "ten of them put fill ink down");
  assert.deepEqual(record.ops.map((op, index) => (opPutsFillInkDown(op) ? null : index)).filter((index) => index !== null),
    [1, 3, 9], "and the three that do not are NAMED, by this file's own reading of the operation — 13 minus 3 is 10");
  assert.equal(record.blankets.at(-1).opsAfter, 0, "the last operation on the stage has nothing over it at all");
  assert.equal(record.blankets.at(-1).inkAfter, 0, "so neither number is a constant");
  assert.equal(curtain.shape, 20, "the shape id, so the pack can be opened at it");
  assert.equal(curtain.depth, 10, "the ROOT depth, which is what `screen.objects` is keyed by");
  assert.deepEqual([...curtain.path], [10, 1], "and the whole nesting path");
  assert.equal(curtain.fill, "#000000");
  assert.equal(curtain.opacity, 1);
  assert.equal(curtain.coverage, 1, "the raster, not the box");
  assert.equal(curtain.bitmap, false);
  assert.equal(curtain.gradient, false);
  assert.equal(curtain.clipped, false);

  const raster = record.blankets.find((entry) => entry.index === 5);
  assert.equal(raster.bitmap, true,
    "► a raster's own per-pixel alpha is NOT read here, so a caller discounting bitmaps needs this flag");
  assert.equal(raster.fill, "none", "and it has no colour in the operation at all");

  const gradient = record.blankets.find((entry) => entry.index === 4);
  assert.equal(gradient.gradient, true);
  assert.equal(gradient.opacity, 1, "the MINIMUM stop opacity, because a ramp that goes clear anywhere hides nothing there");

  assert.equal(Object.isFrozen(record.blankets), true);
  assert.equal(Object.isFrozen(record.blankets[0]), true);
});

test("`opsBefore` is what separates a backdrop from a curtain", () => {
  // ► Same twelve drawables, curtain moved to the END. The count does not
  //   move; `opsBefore` does, and that is the number a person reading an
  //   invoice needs. A count alone cannot tell `dungeon`'s backdrop (op 3 of
  //   75) from `townsquare`'s curtain (op 1632 of 1638).
  const moved = curtainPack();
  const drawables = moved.screens.curtain.drawables;
  drawables.push(drawables.shift());
  const record = screenFor(screenPackFrom(moved), "curtain");
  assert.equal(record.approximations.blanketsTheStage, 6, "the same six cover the stage wherever they are painted");
  const curtain = record.blankets.find((entry) => entry.shape === 20 && !entry.clipped);
  assert.equal(curtain.opsBefore, 13, "and now it is painted last, over all thirteen of them");
  assert.equal(curtainOf().blankets[0].opsBefore, 0, "against 0 before the move — so this is not a constant");
});

test("a screen with nothing over it has an empty roster and a zero tally — and the same pack with a curtain has one", () => {
  const record = marketOf();
  assert.deepEqual(record.blankets, [], "`market`'s shapes are 10 to 40 units across on a 640 x 420 stage");
  assert.equal(record.approximations.blanketsTheStage, 0);
  assert.equal(record.approximations.blanketGeometryUnparsed, 0);
  assert.equal(forgeOf().approximations.blanketsTheStage, 0, "and `forge`'s are smaller still");

  // ► **THE CONTROL, ADDED 2026-09-14 BECAUSE THE THREE LINES ABOVE WERE
  //   SATISFIED BY DELETING THE FEATURE.** A wave-2 verifier stubbed
  //   `stageBlanketsOf` to `return Object.freeze([])` and this test stayed
  //   green — an empty roster is what a stub returns. **A test that asserts an
  //   absence needs the presence beside it or it is a test of nothing.** So:
  //   the same pack, the same twenty operations, with ONE full-stage black
  //   rectangle appended, and the roster must come back holding exactly that
  //   one. Under the stub this is 0 and red.
  const withCurtain = rawPack();
  withCurtain.shapes = { ...withCurtain.shapes, 20: STAGE_SHAPES[20] };
  withCurtain.screens.market.drawables.push({ shape: 20, path: [1200, 1], matrix: [1, 0, 0, 1, 0, 0] });
  const covered = screenFor(screenPackFrom(withCurtain), "market");
  assert.equal(covered.ops.length, record.ops.length + 1, "one operation more than the screen that has no curtain");
  assert.equal(covered.approximations.blanketsTheStage, 1);
  assert.equal(covered.blankets[0].index, record.ops.length, "and it is the appended one, not something that was there all along");
  assert.equal(covered.blankets[0].fill, "#000000");
  assert.equal(covered.blankets[0].opsBefore, record.ops.length, "painted over every one of them");
  assert.equal(covered.blankets[0].opsAfter, 0, "with nothing over it");
});

test("STAGE_BLANKET states its own thresholds and they are the ones used", () => {
  // ► **A THRESHOLD NAMED IN A COMMENT AND HARD-CODED IN THE LOOP IS TWO
  //   THRESHOLDS.** This builds a rect covering exactly the stated coverage
  //   either side of the line and asserts the line is where the constant says.
  assert.equal(STAGE_BLANKET.coverage, 0.95);
  assert.equal(STAGE_BLANKET.opacity, 0.95);
  const widthFor = (fraction) => SS2_STAGE.width * fraction;
  const rectPack = (fraction, opacity) => ({
    screens: { one: {
      name: "one", labelFrame: 1, drawables: [{ shape: 30, path: [1], matrix: [1, 0, 0, 1, 0, 0] }],
      unresolved: [], textFields: [], staticText: [], multiFrameSprites: [],
      filteredPlacements: [], blendedPlacements: [], approximations: {}
    } },
    shapes: { 30: { character: 30, paths: [{
      d: `M0 0L${widthFor(fraction)} 0L${widthFor(fraction)} 420L0 420Z`,
      fill: "#000000", fillOpacity: opacity, fillRule: "evenodd", approximated: null, stroke: null, strokeWidth: 0 }] } },
    fonts: {}
  });
  const blanketsIn = (fraction, opacity) =>
    screenFor(screenPackFrom(rectPack(fraction, opacity)), "one").approximations.blanketsTheStage;
  assert.equal(blanketsIn(1, 1), 1, "the whole stage at full opacity");
  assert.equal(blanketsIn(0.99, 1), 1, "99% of the width is still a blanket");
  assert.equal(blanketsIn(0.9, 1), 0, "90% is not — the parchment backdrop on 13 real screens rasterises to 92.04%");
  assert.equal(blanketsIn(1, 0.96), 1, "opacity 0.96 hides what is under it");
  assert.equal(blanketsIn(1, 0.9), 0, "opacity 0.9 does not");
  // ► ~~**AND THE OPACITY HALF OF THE PREDICATE IS DEAD ON THE REAL PACK.**
  //   Every operation there that passes the coverage test is at opacity exactly
  //   1, and the next value down any large operation takes is 0.94921875 —
  //   which is excluded by COVERAGE, not by opacity. These two lines are the
  //   only place in this repository where the opacity threshold decides
  //   anything.~~
  //
  //   **EVERY CLAUSE OF THAT IS WRONG, RE-MEASURED 2026-09-14, AND THE TEST
  //   BELOW IS THE CORRECTION.** The opacity test is the only thing keeping 34
  //   stage-covering operations out of the roster: 26 copies of character 642
  //   at alphaMultiplier 0 and 8 of character 718 at 0.19921875. The parchment
  //   is excluded by opacity FIRST — the module tests alpha before it tests the
  //   box, and 0.94921875 < 0.95 — and by the box second, at 0.9479. The
  //   sweep that produced "dead" ran the threshold from 0.2 to 0.99, and
  //   0.19921875 is 0.00078125 below the bottom of that range: a grid that
  //   starts just above the population it would have found. **Ask what a
  //   measurement could have come out as** — this one could not have come out
  //   any other way.
});

test("the opacity half of the predicate is what keeps 34 full-stage rectangles out of the roster", () => {
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  // ► **A REAL-PACK TEST FOR A PREDICATE THAT WAS DOCUMENTED AS DEAD, AND IT
  //   NEEDS NO RASTER AT ALL.** For an AXIS-ALIGNED RECTANGLE under an
  //   axis-aligned matrix, the bounding box IS the filled region — there is no
  //   third thing for a scanline to discover. So this file can decide, on its
  //   own arithmetic, which operations cover the stage, and then check the
  //   module against every one of them in both directions: the opaque ones must
  //   all be counted, the faint ones must all be rejected.
  //
  //   Teeth, measured: deleting `if (opacity < STAGE_BLANKET.opacity) continue;`
  //   from `stageBlanketsOf` turns this red at 34 rejected-and-counted;
  //   stubbing the raster out turns it red at 0 counted.
  const pack = screenPackFrom(REAL_SCREENS);
  let rectangles = 0;
  let covering = 0;
  const opaque = new Map();
  const faint = new Map();
  let opaqueCounted = 0;
  let faintCounted = 0;
  for (const name of screenNames(pack)) {
    const record = screenFor(pack, name);
    const countedHere = new Set(record.blankets.map((entry) => entry.index));
    record.ops.forEach((op, index) => {
      const covered = stageRectangleCoverageOf(op);
      if (covered === null) return;
      rectangles += 1;
      if (covered < STAGE_BLANKET.coverage) return;
      covering += 1;
      const alpha = blanketAlphaOf(op);
      const into = alpha >= STAGE_BLANKET.opacity ? opaque : faint;
      into.set(op.shape, (into.get(op.shape) ?? 0) + 1);
      if (!countedHere.has(index)) return;
      if (alpha >= STAGE_BLANKET.opacity) opaqueCounted += 1;
      else faintCounted += 1;
    });
  }

  assert.equal(rectangles, 419, "axis-aligned rectangles across the 26 screens — the population this reasoning is valid over");
  assert.equal(covering, 41, "of which 41 cover the stage, so the box alone would report 41 blankets");
  // Sorted by CHARACTER and not by count: two of these tie at 1, and a sort on
  // the count would then be pinning the order screens happen to be walked in.
  assert.deepEqual([...opaque.entries()].sort((a, b) => a[0] - b[0]), [[647, 5], [1774, 1], [2285, 1]],
    "seven of the 41 are opaque: the five curtains and the two bitmap backdrops");
  assert.deepEqual([...faint.entries()].sort((a, b) => a[0] - b[0]), [[642, 26], [718, 8]],
    "and 34 are not — the chrome backdrop at alphaMultiplier 0, and a bitmap under a 0.19921875 alpha transform");
  assert.equal(opaqueCounted, 7, "every opaque one is in the roster");
  assert.equal(faintCounted, 0, "and not one of the 34 faint ones is — which is the whole of what the opacity test does here");

  // ► **THE VALUE THAT MAKES THE SWEEP'S RANGE THE FINDING.** 0.19921875 is
  //   0.00078125 below the 0.2 the old sweep started at. If this ever reads a
  //   different number, the "dead predicate" story is worth re-running rather
  //   than re-believing.
  const alphas = new Set();
  for (const name of screenNames(pack)) {
    for (const op of screenFor(pack, name).ops) {
      const covered = stageRectangleCoverageOf(op);
      if (covered === null || covered < STAGE_BLANKET.coverage) continue;
      const alpha = blanketAlphaOf(op);
      if (alpha < STAGE_BLANKET.opacity) alphas.add(alpha);
    }
  }
  assert.deepEqual([...alphas].sort((a, b) => a - b), [0, 0.19921875],
    "the two alphas the rejected 34 take, and the larger one is what a sweep from 0.2 could not see");
});

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
  //
  // ► **THE `fill` ASSERTION BELOW CANNOT FAIL, AND IT IS KEPT ANYWAY WITH THE
  //   REASON ON IT.** `HALF_ALPHA` moves alpha alone, so the two stop fills
  //   come back exactly as they went in: this line pins that an alpha-only
  //   transform does NOT touch the colour bytes, which is a real property, and
  //   it says nothing whatever about whether the RGB half works. Measured by
  //   mutation 2026-09-14: deleting `applyColourTransform` from
  //   `transformGradient` entirely leaves this test green. The test directly
  //   below is the one that goes red.
  const record = marketOf();
  const op = record.ops.find((op) => op.depth === 7 && op.gradient);
  assert.deepEqual(op.gradient.stops.map((stop) => stop.opacity), [0.5, 0.25]);
  assert.deepEqual(op.gradient.stops.map((stop) => stop.fill), ["#9c2b00", "#ffcc83"]);
  assert.equal(op.gradient.type, "linear", "and the rest of the gradient is carried through");
  assert.equal(op.gradient.matrix.tx, 3310);
});

test("a gradient stop under an RGB transform is TINTED — the case the real pack cannot reach", () => {
  // ► **THE LINE THIS PINS WAS PINNED BY NOTHING.** `transformGradient` does
  //   `fill: applyColourTransform(stop.fill, colour)`; deleting that call and
  //   writing `fill: stop.fill` left this file at 36 pass / 0 fail AND left the
  //   digest of every operation and tally across all 26 real screens
  //   byte-identical, because all 107 of the real pack's transformed gradient
  //   stops are under alpha-only transforms. See `tintPack` above for the
  //   measurement. Every value below was computed by hand from the wire's own
  //   arithmetic and then checked against the module, not read off it.
  //
  //   `#9c2b00` under (x0.5, x0.25 +8, x1 -40):
  //     red   floor(156 * 0.5)  = 78  + 0   =  78 = 0x4e
  //     green floor(43 * 0.25)  = 10  + 8   =  18 = 0x12   (10.75 floors to 10)
  //     blue  floor(0 * 1)      = 0   - 40  = -40 -> 0     (clamped at the bottom)
  //   `#ffcc83` under the same:
  //     red   floor(255 * 0.5)  = 127 + 0   = 127 = 0x7f   (127.5: ROUNDING gives 0x80)
  //     green floor(204 * 0.25) = 51  + 8   =  59 = 0x3b
  //     blue  floor(131 * 1)    = 131 - 40  =  91 = 0x5b
  const record = forgeOf();
  const tinted = record.ops.find((op) => op.depth === 2);
  assert.deepEqual(tinted.gradient.stops.map((stop) => stop.fill), ["#4e1200", "#7f3b5b"],
    "if these read #9c2b00 / #ffcc83 the stop-fill transform has been dropped");
  // The alpha half of the same transform, into the stops and not into fillOpacity.
  assert.deepEqual(tinted.gradient.stops.map((stop) => stop.opacity), [0.5, 0.25]);
  // ► **AND THE FLAT FALLBACK BESIDE IT GETS THE SAME TREATMENT.** The
  //   operation carries the transformed first-stop colour as `fill` for a
  //   painter with no gradient support; if the two disagreed, a surface
  //   switching between them would change colour.
  assert.equal(tinted.fill, "#4e1200", "the flat fallback is the transformed first stop, not the raw one");

  // ► **AND THE SAME ASSERTION IN THE OTHER DIRECTION**, so a transform that
  //   fired when it should not is caught too: `ALPHA_ONLY_075` must leave the
  //   colour bytes exactly alone while moving both opacities.
  const untinted = record.ops.find((op) => op.depth === 3);
  assert.deepEqual(untinted.gradient.stops.map((stop) => stop.fill), ["#9c2b00", "#ffcc83"]);
  assert.deepEqual(untinted.gradient.stops.map((stop) => stop.opacity), [0.75, 0.375]);
});

test("touchesRgb answers on OFFSETS as well as multipliers, which no pack in this tree exercises", () => {
  // ► **HALF OF `touchesRgb` WAS DEAD.** Reducing its body to the three
  //   multiplier checks left this file at 36 pass / 0 fail. `market`'s
  //   `HALF_RED` bitmap pins the multiplier half; the offset half answered for
  //   nothing, because no transform on the real pack — and none in `market` —
  //   has identity multipliers together with a non-zero RGB offset. Measured:
  //   the combination `rgbMult=false, rgbOff=true` occurs 0 times across the
  //   26 screens' 287 tinted drawables.
  //
  //   This is not a reason to delete the offset half. The predicate answers
  //   "does this transform carry colour a raster has nowhere to put", and an
  //   offset carries colour: `#000000` under redOffset 17 is `#110000`, which
  //   a bitmap op reporting `fill: "none"` genuinely loses. The half that was
  //   unexercised is now exercised, HERE, where the fixture says out loud that
  //   the build does not contain the case.
  const record = forgeOf();
  assert.equal(record.approximations.bitmapOps, 2, "two bitmap paths, both under a transform");
  assert.equal(record.approximations.bitmapColourTransformDropped, 1,
    "the OFFSET-ONLY transform is colour a raster cannot take; the alpha-only one is not");
  // Both keep `fill: "none"` — the raster is not painted over either way, so
  // the count is the only thing that distinguishes them.
  assert.deepEqual(record.ops.filter((op) => op.bitmap).map((op) => op.fill), ["none", "none"]);
  // And the alpha half still lands on the bitmap, which is the part that DOES
  // survive: 1 under the offset-only transform, 0.75 under the alpha-only one.
  assert.deepEqual(record.ops.filter((op) => op.bitmap).map((op) => op.fillOpacity), [1, 0.75]);
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
  // ► **THIS ASSERTION USED TO READ `filtersNotApplied, 1`.** The count is now
  //   `opsUnderFilterGroup`, which is the population — operations inside a
  //   filtered subtree — and `filtersNotApplied` has been narrowed to the ones
  //   a painter is handed nothing for. Six of the fixture's 26 operations.
  assert.equal(record.approximations.opsUnderFilterGroup, 6);
  assert.equal(record.ops.length, 26, "and 26 is the denominator, so the 6 is not the whole screen");
  const filtered = record.ops.filter((op) => op.filtered === true);
  assert.deepEqual(filtered.map((op) => op.path),
    [[7, 2, 1], [9, 4, 1], [9, 5], [9, 5], [16, 1], [19, 1]],
    "by path, not by count: a prefix match that spread to a sibling would keep the count and change this list");
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

test("gradientOps is counted, which until 2026-09-14 no assertion in this file checked", () => {
  // ► **A TALLY NOTHING CHECKED.** Found by mutation: changing
  //   `approximations.gradientOps += 1` to `+= 0` in `screen.js` left this
  //   file and `render-filters.test.js` entirely green. `gradientOps` is the
  //   count of operations emitted with a real gradient beside a flat
  //   first-stop fallback — the thing a painter without gradient support
  //   silently draws wrong — and it was reaching manifests unverified. The
  //   sibling counters around it (`bitmapOps`, `bakedMorphOps`,
  //   `buttonUpStateOps`, `clipsUnresolved`, `invisibleOps`) were all pinned;
  //   this one was skipped.
  const record = marketOf();
  assert.equal(record.approximations.gradientOps, 3,
    "shape 12 twice and shape 15 once: three gradient PATHS, one operation each");
  assert.equal(record.ops.filter((op) => op.gradient).length, 3,
    "and the count is the operations, recomputed here rather than trusted");
  assert.equal(record.approximations.fromPack.gradientPaths, 3,
    "the extractor's own number agrees — kept separate, not merged");
  assert.equal(forgeOf().approximations.gradientOps, 2, "and it is not a constant");
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
  assert.equal(record.approximations.opsUnderFilterGroup, 6,
    "this file counts OPERATIONS under one — a different population, kept separate");
  assert.equal(record.approximations.filterGroups, 6,
    "and GROUPS is a third population again: five placements plus one button record, against the extractor's one");
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
  // ► **TWO TOOLS READING THE SAME BYTES, AND THEY AGREE TO THE HUNDREDTH.**
  //   `SS2_ARENA_SCREEN_LAYERS` was derived by hand off root frame 221's
  //   placement matrices for `arena-backdrop.js`; the numbers below come out of
  //   `extract-screens.mjs`'s flattener, which was written separately and knows
  //   nothing about that table. Every STAGE-space layer matches. The
  //   arena-space ones — the sand, the crowd — are inside the arena clip and
  //   are not root placements at all, so they are correctly absent here.
  let checked = 0;
  for (const layer of SS2_ARENA_SCREEN_LAYERS) {
    if (layer.space !== "stage") continue;
    const object = record.objects.find((candidate) => candidate.depth === layer.depth);
    assert.notEqual(object, undefined,
      `root frame 221 has no depth ${layer.depth} for the ${layer.prop} layer`);
    assert.equal(object.character, layer.character, `${layer.prop} is a different character`);
    assertClose(object.matrix[4] / 20, layer.x, `${layer.prop} x`);
    assertClose(object.matrix[5] / 20, layer.y, `${layer.prop} y`);
    // The sky is the one scaled layer and the table rounds it: 1.04 against the
    // wire's 1.03998, which is a readability choice and not a disagreement.
    assert.equal(Math.abs(object.matrix[0] - layer.scale) < 0.0001, true,
      `${layer.prop} scale ${object.matrix[0]} against the declared ${layer.scale}`);
    checked += 1;
  }
  assert.equal(checked, 5, "five stage-space layers were compared, not zero");
  assert.equal(record.counts.ops > 0, true, "and it resolves to a picture");
});

test("the real pack: every screen paints visible geometry across the stage", () => {
  // ► **WHAT THIS CATCHES: art that does not land on the stage at all**, and a
  //   screen whose placements all resolve to nothing visible. Verified by
  //   injecting a stray offset into every operation's translation, which turns
  //   this red.
  //
  // ► **WHAT IT DOES NOT CATCH, AND SAYING SO IS THE POINT.** A uniform x20 or
  //   /20 at this module's seam is INVISIBLE here, measured: `visibleBoxOf`
  //   divides the translation by 20 exactly as the painter does, so a scaling
  //   error in the module and the division in the helper cancel. The units are
  //   pinned by the synthetic "UNITS:" test above, which compares the array
  //   itself. Overstating this one would be the same failure it exists to
  //   notice.
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  const pack = screenPackFrom(REAL_SCREENS);
  const names = screenNames(pack);
  assert.equal(names.length > 0, true, "otherwise the loop below asserts nothing");
  for (const name of names) {
    const box = visibleBoxOf(screenFor(pack, name).ops);
    assert.equal(box.points > 0, true, `${name} drew no visible geometry at all`);
    assert.equal(box.xMin < SS2_STAGE.width / 2 && box.xMax > SS2_STAGE.width / 2, true,
      `${name} spans x ${box.xMin.toFixed(1)}..${box.xMax.toFixed(1)}, which does not straddle the stage centre`);
    assert.equal(box.yMin < SS2_STAGE.height / 2 && box.yMax > SS2_STAGE.height / 2, true,
      `${name} spans y ${box.yMin.toFixed(1)}..${box.yMax.toFixed(1)}, which does not straddle the stage centre`);
  }
});

/* ------------------------------------------------------------------ */
/* The tint, pinned by VALUE                                           */
/* ------------------------------------------------------------------ */

/**
 * The anchor placement: `daybreak` depth 3, the only use of shape 1681 on that
 * screen, one white path under a 0.30078125 multiplier with a blue offset of
 * 36. Chosen because it is the boundary case — floor and round disagree on it —
 * and because "exactly one placement, exactly one path" makes it locatable
 * without an op index that the next extractor pass would shift.
 */
const ANCHOR_SHAPE = 1681;

/**
 * Every operation of a real screen beside the pack entry that produced it.
 *
 * `emitDrawable` walks drawables in order and each shape's paths in order,
 * emits one operation per path that has geometry, and skips a drawable whose
 * shape is missing or pathless. Replaying that walk is what lets the
 * assertions below name a SOURCE fill and a transform instead of an op index,
 * and the `joined.length === ops.length` check at each call site is what keeps
 * the replay honest: a walk that drifted would stop lining up and say so
 * rather than compare the wrong pairs quietly.
 *
 * A function declaration rather than an arrow, for the reason `readRealJson`
 * gives: `ss2-assertion-quality.test.js` finds a helper's body by looking for
 * the next brace before the next newline.
 */
function joinOpsToPack(raw, record, name) {
  const joined = [];
  for (const drawable of raw.screens[name].drawables ?? []) {
    const shape = raw.shapes[drawable.shape];
    if (!shape || !Array.isArray(shape.paths) || shape.paths.length === 0) continue;
    for (const entry of shape.paths) {
      if (typeof entry.d !== "string" || entry.d.length === 0) continue;
      joined.push({ entry, colour: drawable.colour ?? null, op: record.ops[joined.length] });
    }
  }
  return joined;
}

/** `clamp(channel * multiplier + offset)` per channel under a chosen rounder. */
function channelwise(fill, colour, rounder) {
  const byte = (index) => Number.parseInt(fill.slice(1 + index * 2, 3 + index * 2), 16);
  const multipliers = [colour.redMultiplier, colour.greenMultiplier, colour.blueMultiplier];
  const offsets = [colour.redOffset, colour.greenOffset, colour.blueOffset];
  const one = (index) => clampByte(rounder(byte(index) * finite(multipliers[index], 1)) + finite(offsets[index], 0));
  return "#" + [0, 1, 2].map((index) => one(index).toString(16).padStart(2, "0")).join("");
}

/** 0..255, so a clamp bug in the module cannot hide behind a clamp bug here. */
function clampByte(value) {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

test("the real pack: one tinted fill pinned by VALUE, against the PLAYER's arithmetic", () => {
  // ► **THE TINT HAD NEVER BEEN PINNED BY VALUE, AND THAT IS HOW THE
  //   ROUND/FLOOR CHANGE WENT THROUGH UNNOTICED.** Every colour assertion in
  //   this file compared the module against a recomputation that shared its
  //   arithmetic, so both halves moved together and the suite stayed green
  //   while every tinted screen shifted by one unit. This one does not
  //   recompute: it states the bytes, and it states them against the PLAYER's
  //   own operation rather than against this renderer's.
  //
  //   `0.30078125` is not a decimal anybody chose. It is `77 / 256` — the
  //   CXFORMWITHALPHA multiply term is 8.8 FIXED POINT, `readColourTransform`
  //   in `tools/swf-display-list.mjs` divides the signed byte pair by 256, and
  //   the player computes `(channel * 77) >> 8`. A right-shift rounds toward
  //   negative infinity, which is `Math.floor` and is not `Math.round`.
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  const pack = screenPackFrom(REAL_SCREENS);
  const record = screenFor(pack, "daybreak");

  const placements = REAL_SCREENS.screens.daybreak.drawables.filter((d) => d.shape === ANCHOR_SHAPE);
  assert.equal(placements.length, 1, "the anchor is only an anchor while exactly one placement uses that shape");
  const colour = placements[0].colour;
  const source = REAL_SCREENS.shapes[ANCHOR_SHAPE].paths;
  assert.equal(source.length, 1, "and while that shape is a single path");
  assert.equal(source[0].fill, "#ffffff", "the untinted fill this pins the transform of");
  assert.equal(colour.redMultiplier, 77 / 256, "the wire's 8.8 multiply term is 77");
  assert.equal(colour.blueOffset, 36, "and the blue channel carries an offset, so the three bytes differ");

  const ops = record.ops.filter((op) => op.shape === ANCHOR_SHAPE);
  assert.equal(ops.length, 1, "otherwise the pin below is ambiguous");
  assert.equal(ops[0].fill, "#4c4c70", "daybreak depth 3: white under 77/256 with a blue offset of 36");
  assert.equal(ops[0].depth, 3, "and it is the placement this anchor names");

  // The player's own arithmetic, in the player's own integers. 76, not 77.
  assert.equal((255 * 77) >> 8, 0x4c, "the arithmetic shift the renderer has to reproduce");
  assert.equal(((255 * 77) >> 8) + 36, 0x70);
  // ► **AND THE PIN IS ON THE BOUNDARY, not merely somewhere the two agree.**
  //   Without this the assertion above would survive a change back to rounding
  //   on any fill whose channels happen not to land on a fraction.
  assert.equal(Math.round(255 * (77 / 256)), 0x4d, "rounding moves this channel");
  assert.notEqual(ops[0].fill, "#4d4d71", "which is what a rounding implementation emits here");

  // ► **THE ALPHA HALF, ALSO BY VALUE, AND ON A TRANSFORM THAT MOVES ONLY
  //   ALPHA.** Shape 1751 sits under `alphaMultiplier` 179/256 with the RGB
  //   half at the identity, so it pins two things at once: that the opacity
  //   lands, and that an alpha-only transform leaves the colour BYTES alone
  //   rather than round-tripping them through the hex writer.
  const alphaOnly = record.ops.filter((op) => op.shape === 1751);
  assert.equal(alphaOnly.length, 3, "three paths share that placement");
  assert.deepEqual(alphaOnly.map((op) => op.fillOpacity), [179 / 256, 179 / 256, 179 / 256]);
  assert.deepEqual(alphaOnly.map((op) => op.fill), ["#990066", "#3366ff", "#66cc33"]);
});

/**
 * Whether a transform on the real pack can change a COLOUR at all, as opposed
 * to moving only alpha.
 *
 * The same question `touchesRgb` asks inside `screen.js`, restated here from
 * the pack's own named fields rather than imported: a test that borrowed the
 * module's predicate to decide what the module should be doing would be
 * grading its own homework.
 *
 * A function declaration rather than an arrow, for the reason `readRealJson`
 * gives.
 */
function transformMovesColour(colour) {
  return finite(colour.redMultiplier, 1) !== 1 || finite(colour.greenMultiplier, 1) !== 1 ||
    finite(colour.blueMultiplier, 1) !== 1 || finite(colour.redOffset, 0) !== 0 ||
    finite(colour.greenOffset, 0) !== 0 || finite(colour.blueOffset, 0) !== 0;
}

/** Whether a transform on the real pack can change an OPACITY at all. */
function transformMovesAlpha(colour) {
  return finite(colour.alphaMultiplier, 1) !== 1 || finite(colour.alphaOffset, 0) !== 0;
}

test("the real pack: every tinted value FLOORS, and rounding would move 69 of the 693 that CAN move", () => {
  // ► **THE MEASUREMENT THAT SETTLED FLOOR vs ROUND, KEPT AS AN ASSERTION.**
  //   `src/render/screen.js` carried its own colour transform until the two
  //   were folded; the two differed only in the rounder, and **69 of the hex
  //   values that sit under a colour transform on these 26 screens came out
  //   one unit apart**. Re-deriving 0 against floor would be self-confirming
  //   on its own — a rounding module compared against a rounding
  //   recomputation also scores 0 — so the load is carried by the SECOND
  //   count: the module must disagree with a rounding implementation on
  //   exactly 69. Both numbers move if the arithmetic does.
  //
  // ► **AND THE 1023 THIS USED TO ASSERT WAS NOT A COVERAGE NUMBER, WHICH IS
  //   WHY IT IS NOW FOUR NUMBERS.** `assert.equal(checked, 1023)` read as
  //   though 1023 values had been put at risk. Measured 2026-09-14 by walking
  //   the pack directly: **330 of those 1023 sit under an ALPHA-ONLY
  //   transform** — every RGB multiplier 1, every RGB offset 0 — so for each
  //   of them the module returns its input and `channelwise` recomputes its
  //   input, under EITHER rounder. They cannot discriminate anything, ever,
  //   and they were being counted beside the 693 that can. 107 of the 330 are
  //   gradient stops (ALL of the pack's transformed stops; see `tintPack`
  //   above) and 223 are flat fills and strokes.
  //
  //   **A count of things checked is not a count of things that could have
  //   failed**, and the same trap is in the alpha half below: 1274 of the 1955
  //   opacity comparisons are under `alphaMultiplier === 1, alphaOffset === 0`
  //   and are equally incapable of failing. Both splits are now asserted, so
  //   the invoice states its own reach.
  //
  // ► **AND THE INVOICE.** `passedThrough` counts what could not be compared:
  //   a fill under a transform that is not a hex colour has nothing to fold
  //   into, which is a real limit of this seam and not a gap in the test. An
  //   approximation that is not counted is indistinguishable from a correct
  //   read.
  //
  // ► **AND THREE THINGS THIS CANNOT CATCH, MEASURED BY MUTATION RATHER THAN
  //   GUESSED, because a test whose reach is overstated is the same defect as
  //   a tally that is.** Swapping `Math.floor` for `Math.trunc` in
  //   `filters.js` leaves every test here GREEN: every RGB multiplier on this
  //   pack is one of 0, 0.30078125, 0.5078125, 0.55859375 or 1 and none is
  //   negative, so the two functions never part company on real data. Dropping
  //   the `/ 255` that converts the wire's alpha offset into this renderer's
  //   0..1 units also leaves `alphaMismatch` at 0, because every `alphaOffset`
  //   on all 26 screens is zero. And deleting the colour transform from
  //   `transformGradient`'s stop fills moves NOTHING here, because the 107
  //   stops are all alpha-only. All three are held by SYNTHETIC fixtures above
  //   — `ALPHA_OFFSET` catches the second and `tintPack` catches the third —
  //   and by nothing on the real pack. The real pack cannot exercise a case
  //   the build does not contain, and saying so is the point.
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  const pack = screenPackFrom(REAL_SCREENS);
  let checkedUnderRgb = 0;
  let checkedUnderAlphaOnly = 0;
  let stopsChecked = 0;
  let stopsUnderRgb = 0;
  let flooredMismatch = 0;
  let roundedMismatch = 0;
  let roundedMismatchUnderAlphaOnly = 0;
  let passedThrough = 0;
  let alphaMoving = 0;
  let alphaIdentity = 0;
  let alphaMismatch = 0;
  for (const name of screenNames(pack)) {
    const record = screenFor(pack, name);
    const joined = joinOpsToPack(REAL_SCREENS, record, name);
    assert.equal(joined.length, record.ops.length, `${name}: the replay of the emission walk drifted`);
    for (const { entry, colour, op } of joined) {
      if (!colour) continue;
      const movesColour = transformMovesColour(colour);
      const movesAlpha = transformMovesAlpha(colour);
      const sourceStops = entry.gradient?.stops ?? [];
      const outStops = op.gradient?.stops ?? [];
      const pairs = [[entry.fill, op.fill, false], [entry.stroke, op.stroke, false]];
      const alphas = [[finite(entry.fillOpacity, 1), op.fillOpacity], [finite(entry.strokeOpacity, 1), op.strokeOpacity]];
      for (const [index, stop] of sourceStops.entries()) {
        pairs.push([stop.fill, outStops[index]?.fill, true]);
        alphas.push([finite(stop.opacity, 1), outStops[index]?.opacity]);
      }
      for (const [source, out, isStop] of pairs) {
        if (typeof source === "string" && source.length === 7 && source[0] === "#") {
          if (movesColour) checkedUnderRgb += 1; else checkedUnderAlphaOnly += 1;
          if (isStop) {
            stopsChecked += 1;
            if (movesColour) stopsUnderRgb += 1;
          }
          if (out !== channelwise(source, colour, Math.floor)) flooredMismatch += 1;
          if (out !== channelwise(source, colour, Math.round)) {
            roundedMismatch += 1;
            if (!movesColour) roundedMismatchUnderAlphaOnly += 1;
          }
        } else if (source !== null && source !== undefined) {
          passedThrough += 1;
          assert.equal(out, source, "a fill with no colour in it must survive a transform untouched");
        }
      }
      for (const [source, out] of alphas) {
        if (movesAlpha) alphaMoving += 1; else alphaIdentity += 1;
        const want = source * finite(colour.alphaMultiplier, 1) + finite(colour.alphaOffset, 0) / 255;
        alphaMismatch += out === Math.max(0, Math.min(1, want)) ? 0 : 1;
      }
    }
  }
  // ► **THE POPULATION THAT COULD HAVE FAILED**, stated first and separately
  //   from the population that was merely looked at.
  assert.equal(checkedUnderRgb, 693,
    "hex values under a transform that moves red, green or blue — the only ones that can discriminate");
  assert.equal(checkedUnderAlphaOnly, 330,
    "and the ones that cannot: an alpha-only transform returns its input under either rounder");
  assert.equal(checkedUnderRgb + checkedUnderAlphaOnly, 1023,
    "the population this measurement has always been quoted over, now split by what it can prove");

  // ► **THE STRUCTURAL FACT THAT MADE THE GRADIENT HOLE INVISIBLE, ASSERTED
  //   RATHER THAN LEFT IN A COMMENT.** If a future extraction ever puts a
  //   gradient stop under an RGB transform, this line goes red and whoever
  //   sees it learns that the real pack has started covering a case only
  //   `tintPack` used to reach.
  assert.equal(stopsChecked, 107, "every transformed gradient stop on the 26 screens");
  assert.equal(stopsUnderRgb, 0,
    "and not one of them is under a transform that moves colour, so no assertion over this pack can pin stop tinting");

  assert.equal(flooredMismatch, 0, "the module must agree with the arithmetic shift on every one of them");
  assert.equal(roundedMismatch, 69,
    "the module must DISAGREE with a rounding implementation on exactly these — if this reads 0 the module is rounding");
  assert.equal(roundedMismatchUnderAlphaOnly, 0,
    "and all 69 fall in the 693, which is what makes them attributable rather than a bare total");
  assert.equal(passedThrough, 164, "fills under a transform with no colour to fold into: all of them `none`");

  assert.equal(alphaMoving, 681, "opacity comparisons under a transform that actually moves alpha");
  assert.equal(alphaIdentity, 1274, "and the ones that cannot fail: alphaMultiplier 1 with alphaOffset 0");
  assert.equal(alphaMoving + alphaIdentity, 1955, "the alpha half was compared too, rather than assumed");
  assert.equal(alphaMismatch, 0, "the alpha half stays floating point: 0..1 opacity, offset divided by 255");
});

/**
 * THE SEVEN, AND THE CLAIM THIS TEST EXISTS TO BREAK.
 *
 * ► **THE SESSION THAT COMMISSIONED THIS COUNT NAMED SIX BLACK SCREENS BY
 *   THEIR `nestedSpriteFrame1` COUNT, AND THAT NUMBER IS NOT THE ONE.**
 *   `tools/extract-screens.mjs` line 1119 sets it to `nested.multiFrame.length`
 *   — the number of DISTINCT multi-frame sprite characters on the screen, not
 *   a number of operations and not a number of curtains. Re-derived from
 *   `assets/screens/manifest.json`: it is non-zero on **20 of the 26 screens**,
 *   and the six named (townsquare 9, daybreak 8, special_event 8,
 *   special_event_result 8, magicshop 8, arena_intro 8) are simply its six
 *   largest values. `armoury`, `weaponshop`, `foyer`, `church`, `levelup` and
 *   `arena` all carry 6 or 7 and none of them has a curtain.
 *
 *   The two sets are not each other in EITHER direction, which is what the
 *   assertions below pin: 15 screens carry a frozen sprite and no blanket, and
 *   `gameover` carries a blanket with `nestedSpriteFrame1` at 0.
 *
 * ► **WHAT IS TRUE IS THE ROOT CAUSE, FOR FIVE OF THE SEVEN.** Every curtain is
 *   character 647, `#000000` at opacity 1, covering 100% of the stage, and each
 *   sits under a root sprite the pack states as multi-frame: **character 1525
 *   (168 frames)** at depth 185 on `splash` and `new_or_continue` and depth 428
 *   on `townsquare`, and **character 1772, `day_night` (127 frames)** at depth
 *   408 on `daybreak` and `dungeon`. Flattened at frame 1, a fade-in and a
 *   night overlay are both a closed black curtain. The other two blankets are
 *   BACKDROPS — `dungeon` op 3 of 75 and `gameover` op 5 of 18, both rasters —
 *   and they are correct.
 */
test("the real pack: seven operations cover the stage, and the tally is not `nestedSpriteFrame1`", () => {
  if (!REAL_SCREENS || !REAL_MANIFEST) {
    assert.equal(REAL_SCREENS === null || REAL_MANIFEST === null, true, "no extraction on this machine");
    return;
  }
  const pack = screenPackFrom(REAL_SCREENS);
  const names = screenNames(pack);
  let blankets = 0;
  let unparsed = 0;
  const withBlanket = [];
  const withFrozenSprite = [];
  const coverages = new Set();
  const alphas = new Set();
  for (const name of names) {
    const record = screenFor(pack, name);
    blankets += record.approximations.blanketsTheStage;
    unparsed += record.approximations.blanketGeometryUnparsed;
    for (const entry of record.blankets) {
      coverages.add(entry.coverage);
      alphas.add(entry.opacity);
    }
    if (record.approximations.blanketsTheStage > 0) withBlanket.push(name);
    // The extractor's own number, read from the pack rather than recomputed
    // here, so the two tallies stay independent.
    if ((REAL_MANIFEST.screens[name].approximations?.nestedSpriteFrame1 ?? 0) > 0) withFrozenSprite.push(name);
  }
  assert.equal(names.length, 26);
  assert.equal(blankets, 7, "seven operations across the 26 screens cover the stage opaquely");
  assert.deepEqual(withBlanket,
    ["splash", "new_or_continue", "daybreak", "dungeon", "townsquare", "gameover"],
    "on six screens, in root-timeline order");
  assert.equal(unparsed, 0,
    "and nothing was skipped unmeasured — the pack's 4915 shape paths use only M, L, Q and Z");

  // ► **IS 6-AND-20 A PARTITION WORTH DEFENDING? THE MARGIN SAYS YES, AND THE
  //   MARGIN IS THE ANSWER RATHER THAN THE COUNT.** Every one of the seven
  //   covers the stage ENTIRELY and is at alpha exactly 1 — nothing in the
  //   roster is near either threshold. The other side of the line is in "the
  //   raster rejects 35 of the 42 operations the box admits": the nearest
  //   thing to a blanket that is NOT one covers 0.060 of the stage. So the
  //   coverage threshold could be anything from 0.07 to 1.0 and this partition
  //   would not move by one screen. **It is the pair of thresholds that draws
  //   it, not either one** — see `STAGE_BLANKET`, whose grid used to say
  //   otherwise.
  assert.deepEqual([...coverages], [1], "all seven cover the whole stage, not 0.95 of it");
  assert.deepEqual([...alphas], [1], "and all seven are opaque, not 0.95 opaque");

  // ► **THE PREMISE THIS BREAKS, ASSERTED IN BOTH DIRECTIONS.**
  assert.equal(withFrozenSprite.length, 20, "`nestedSpriteFrame1` is non-zero on 20 of the 26 screens");
  assert.equal(withFrozenSprite.filter((name) => !withBlanket.includes(name)).length, 15,
    "15 screens have a sprite frozen at frame 1 and nothing covering the stage");
  assert.deepEqual(withBlanket.filter((name) => !withFrozenSprite.includes(name)), ["gameover"],
    "and one screen has a blanket with no frozen sprite at all — its backdrop is simply a full-stage JPEG");
});

test("the real pack: `townsquare`'s curtain is one operation, and it is named", () => {
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  const record = screenFor(screenPackFrom(REAL_SCREENS), "townsquare");
  assert.equal(record.ops.length, 1638);
  assert.equal(record.blankets.length, 1, "one operation, out of 1638, is why the canvas reads 99.1% #000000");
  const curtain = record.blankets[0];
  assert.equal(curtain.index, 1632, "second from last: only the ornamental border is painted after it");
  assert.equal(curtain.opsBefore, 1632, "and it covers every one of the 1632 painted before it");

  // ► **THE FOUR NUMBERS THAT TELL A CURTAIN FROM THE PAGE'S OWN BLACK
  //   GROUND, which the browser probe that started this cannot do.**
  //   `tools/screens/main.js` fills the canvas `#000000` before it draws
  //   anything, so "439266 opaque pixels, 435374 of them black" is also what a
  //   run that drew NOTHING would report. These are the reading that settles
  //   it, and they are all in the record: 1632 of the 1638 operations put ink
  //   down (so the stage is not empty), an opaque black fill covers all of it
  //   (so the ground is not what is showing), and of the five operations after
  //   it three put ink down and none is in this roster — so none of them
  //   repaints the stage. See `stageBlanketsOf`'s own section on it.
  assert.equal(record.approximations.invisibleOps, 6,
    "6 of the 1638 draw nothing, so 1632 put ink down — a black stage that was simply EMPTY would have these two equal");
  assert.equal(curtain.opsAfter, 5);
  assert.equal(curtain.inkAfter, 3, "two buttons and the border; the other two are at fillOpacity 0");
  assert.equal(record.blankets.filter((entry) => entry.index > curtain.index).length, 0,
    "and nothing after it covers the stage, so the curtain is the last word on it");
  assert.equal(curtain.shape, 647);
  assert.equal(curtain.depth, 428);
  assert.equal(curtain.fill, "#000000");
  assert.equal(curtain.opacity, 1);
  assert.equal(curtain.coverage, 1);
  assert.equal(curtain.bitmap, false, "a flat fill, not a raster — there is nothing to look up in assets/bitmaps/");

  // ► **THE JOIN A FIX WOULD MAKE, MADE HERE SO THE CLAIM IS NOT PROSE.** The
  //   entry's `depth` is a root depth, and `screen.objects` is the root display
  //   list, so the character and its frame count are one lookup away.
  const object = record.objects.find((entry) => entry.depth === curtain.depth);
  assert.equal(object.character, 1525);
  assert.equal(object.kind, "sprite");
  assert.equal(object.declaredFrames, 168,
    "168 frames, rendered at frame 1 — `flattenFrame` has no playhead to read and frame 1 is the closed curtain");

  // And the same character is the curtain on two more screens, at a different
  // root depth, which is what makes it a sprite and not a townsquare accident.
  for (const [name, depth] of [["splash", 185], ["new_or_continue", 185]]) {
    const other = screenFor(screenPackFrom(REAL_SCREENS), name);
    assert.equal(other.blankets[0].depth, depth);
    assert.equal(other.objects.find((entry) => entry.depth === depth).character, 1525);
  }
});

test("the real pack: the raster rejects 35 of the 42 operations the box admits, and 26 of them are the border", () => {
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  // ► **THIS TEST USED TO ASSERT ONLY `counted === 0` UNDER A COMMENT SAYING IT
  //   "PROVES THE RASTER IS DOING WORK", AND IT PROVED NOTHING.** A wave-2
  //   verifier stubbed `stageBlanketsOf` to `return Object.freeze([])` — the
  //   feature deleted, the API kept — and this test stayed GREEN, because a
  //   raster that counts nothing also counts the border nothing. **An assertion
  //   that something is ABSENT passes when the thing that would find it is
  //   gone.** Re-derived here before rewriting: under that stub, 7 other tests
  //   in this file go red and this one and "a screen with nothing over it"
  //   stayed green.
  //
  //   ► And its arithmetic was wrong as well: it said a box-only implementation
  //     "would report 33 blankets instead of 7". ~~33~~ **42.** 33 is 26 + 7,
  //     done in somebody's head; the measured population is 42, because nine
  //     more operations have a stage-sized box, survive the opacity test and
  //     are thrown out by the raster. `src/render/screen.js` said 42 in its own
  //     header the whole time.
  //
  //   So the test now walks BOTH sides on one sweep and pins both: what a box
  //   test alone would admit (computed here, from each operation's own `d` and
  //   matrix, every coordinate pushed through the matrix rather than the box's
  //   four corners), and what the module's raster actually returns. It goes red
  //   when the raster stops working (moduleCounts falls to 0) and when it
  //   over-fires (a box-only implementation counts 42 and the border 26).
  const pack = screenPackFrom(REAL_SCREENS);
  let spanningBox = 0;
  let borderCounted = 0;
  let boxAdmits = 0;
  let moduleCounts = 0;
  const rejectedByShape = new Map();
  for (const name of screenNames(pack)) {
    const record = screenFor(pack, name);
    const countedHere = new Set(record.blankets.map((entry) => entry.index));
    moduleCounts += record.blankets.length;
    record.ops.forEach((op, index) => {
      if (op.shape === 645) {
        const box = visibleBoxOf([op]);
        if (box.xMin <= 0 && box.yMin <= 0 && box.xMax >= SS2_STAGE.width && box.yMax >= SS2_STAGE.height) spanningBox += 1;
        if (countedHere.has(index)) borderCounted += 1;
      }
      // What a box-only `stageBlanketsOf` would admit: the module's two
      // published thresholds, with the FILL region never looked at. Note the
      // border is NOT the only thing this catches, which is the point — the
      // 0.95 here admits a box a little smaller than the stage too.
      if (blanketAlphaOf(op) < STAGE_BLANKET.opacity) return;
      if (stageBoxCoverageOf(op) < STAGE_BLANKET.coverage) return;
      boxAdmits += 1;
      if (countedHere.has(index)) return;
      rejectedByShape.set(op.shape, (rejectedByShape.get(op.shape) ?? 0) + 1);
    });
  }

  assert.equal(spanningBox, 26, "character 645 is the border, and its box is bigger than the stage on every screen");
  assert.equal(borderCounted, 0, "and it is a frame: it covers the edge and not the middle");

  // ► **THE THREE LINES THAT GIVE THE TWO ABOVE THEIR TEETH.** Without them
  //   every assertion in this test is satisfied by a raster that does nothing.
  assert.equal(boxAdmits, 42, "a box-only implementation would report 42 blankets");
  assert.equal(moduleCounts, 7, "the raster reports 7 — so it is neither absent nor a box test");
  assert.deepEqual([...rejectedByShape.entries()].sort((a, b) => a[0] - b[0]), [[645, 26], [1555, 5], [2114, 4]],
    "the 35 it rejects, by character: the border on 26 screens; a black shape on 5 whose box is all but the stage and whose "
    + "fill is 6% of it; and arena_intro's four black shapes at one depth, 4% to 6% each and 8% as a union");
});


/* ------------------------------------------------------------------ */
/* FILTER GROUPS                                                       */
/* ------------------------------------------------------------------ */

/**
 * ► **THE DEFECT THESE TESTS EXIST FOR: UNTIL 2026-09-15 `screen.js` READ
 *   `entry.path` OFF `filteredPlacements` AND THREW `entry.filters` AWAY.**
 *   Every number the module reported about filters was therefore invariant
 *   under those typed records being right, wrong or absent — and the fixture
 *   in this file proved it, because its one filtered placement carried no
 *   `filters` key at all and the suite was green. **A tally that cannot vary
 *   with the data it describes is not a reading of the data**, which is the
 *   same argument this file already makes about gradient-stop tinting eight
 *   hundred lines up.
 *
 * ► **AND THE OBVIOUS FIX WOULD HAVE BEEN WORSE THAN THE GAP.** Flash
 *   rasterises a filtered group and filters the COMPOSITE. Stamping the filter
 *   string onto each leaf and letting a painter set `ctx.filter` per operation
 *   blurs `townsquare`'s 1523 paths one at a time, along 1523 internal seams
 *   the build does not have — a different picture that looks plausible, which
 *   is the worst kind this project produces. So what is pinned below is the
 *   GROUP: its range, its nesting, and the fact that no operation carries a
 *   filter at all.
 */

/** `market`'s groups, in the order `screenFor` emits them. */
function marketGroups() {
  return marketOf().filterGroups;
}

/** Which operations actually sit under a path, recomputed in the test. */
function opsUnderPath(record, prefix) {
  const out = [];
  record.ops.forEach((op, index) => {
    if (prefix.length > op.path.length) return;
    for (let at = 0; at < prefix.length; at += 1) if (op.path[at] !== prefix[at]) return;
    out.push(index);
  });
  return out;
}

test("a filter group is a SUBTREE: it carries what canvas made of the filters, and names the ops it owns", () => {
  const record = marketOf();
  const groups = record.filterGroups;
  assert.equal(groups.length, 6, "five placements and one button record");

  const glow = groups.find((group) => group.path.join() === "7,2");
  // ► **BY VALUE, and the value is the build's own.** `GLOW_ORANGE` is copied
  //   out of `splash`'s character 1509. If `canvasFilterFor` ever stopped
  //   doubling sigma for `drop-shadow`'s third length — the hazard its own
  //   header names — this string would read 1.4142px and this assertion, not
  //   a screenshot, is what says so.
  assert.equal(glow.filter, "drop-shadow(0px 0px 2.8284px rgba(255, 153, 0, 1))");
  assert.deepEqual(glow.refused.map((entry) => `${entry.type}:${entry.reason}`),
    ["bevel:filterHasNoCanvasEquivalent"],
    "the inner bevel beside it is REFUSED BY NAME — canvas has no bevel and no inset drop-shadow");
  assert.deepEqual(glow.counts, { total: 2, applied: 1, deferred: 0, noOp: 0, refused: 1, approximated: 1 },
    "one list, two filters, and the two land in different buckets");
  assert.deepEqual([...glow.path], [7, 2]);
  assert.equal(glow.character, 60, "the trail back into the pack");
  assert.equal(glow.source, "placement");

  // The range, against the operations recomputed here rather than against
  // itself. `assert.equal(X, X)` is the shape this project has been bitten by.
  assert.deepEqual(opsUnderPath(record, [7, 2]), [8]);
  assert.equal(glow.opFirst, 8);
  assert.equal(glow.opEnd, 9);
  assert.equal(glow.opCount, 1);
  assert.equal(glow.ownOpCount, 1, "nothing is nested inside it");
  assert.equal(glow.contiguous, true);
  assert.deepEqual(record.ops.slice(glow.opFirst, glow.opEnd).map((op) => op.path), [[7, 2, 1]],
    "and the range resolves to the operation the path names, which is the only thing the range is for");
});

test("the 1523-operation case in miniature: a group covers three ops and OWNS two of them", () => {
  // `townsquare`'s [59,1] covers 1523 of 1638 and has four blur groups inside
  // it. This is that arrangement at a size a person can read.
  const record = marketOf();
  const outer = record.filterGroups.find((group) => group.path.join() === "9");
  const inner = record.filterGroups.find((group) => group.path.join() === "9,4");

  assert.deepEqual(opsUnderPath(record, [9]), [10, 11, 12]);
  assert.deepEqual(opsUnderPath(record, [9, 4]), [10]);
  assert.equal(outer.opCount, 3);
  assert.equal(inner.opCount, 1);
  assert.equal(outer.ownOpCount, 2,
    "the operations the painter draws STRAIGHT into the outer offscreen — the third arrives already filtered");
  assert.equal(inner.ownOpCount, 1);
  assert.equal(outer.opFirst <= inner.opFirst && inner.opEnd <= outer.opEnd, true,
    "a child's range is INSIDE its parent's, which is what lets a painter walk the parent and recurse at the child");

  // ► **A COLOUR MATRIX IS NOT IN THE FILTER STRING, AND THAT IS THE TRAP.**
  //   `canvasFilterFor` defers it to `applyColourMatrix`; a painter that reads
  //   `filter` alone finds null here, draws nothing special, and reports that
  //   it applied the filters. On the real pack that is 1523 operations of
  //   `townsquare` drawn ungraded.
  assert.equal(outer.filter, null);
  assert.equal(outer.colourMatrices.length, 1);
  assert.deepEqual(outer.deferred.map((entry) => entry.reason), ["applyColourMatrixToTheFill"]);
  assert.equal(inner.filter, "blur(1.118px)", "and the inner one IS a string: 4/2 radii, averaged, over sqrt(3) per pass");
});

test("NESTING COMPOSES; the BLEND MODE on the same two paths picks a winner. Both rules, one fixture", () => {
  // ► **THE TWO QUESTIONS LOOK IDENTICAL AND HAVE OPPOSITE ANSWERS.** A blend
  //   mode is the compositing operator for one draw, so the innermost is the
  //   one actually compositing the leaf — `blendFor` says so and is right. A
  //   filter is a rasterise-then-transform, and the outer group's filter
  //   applies to the RESULT of the inner one, so neither wins. The fixture
  //   puts a blend mode and a filter on the SAME two paths, [9] and [9,4], so
  //   a rule copied from the neighbouring function fails here instead of
  //   passing everywhere.
  const record = marketOf();
  const outer = record.filterGroups.find((group) => group.path.join() === "9");
  const inner = record.filterGroups.find((group) => group.path.join() === "9,4");

  assert.equal(inner.parent, outer.index, "the filter tree keeps BOTH");
  assert.deepEqual([...outer.children], [inner.index]);
  assert.equal(outer.parent, null);
  assert.deepEqual([...inner.children], []);
  assert.equal(record.approximations.filterGroupsNested, 1);

  const leaf = record.ops[inner.opFirst];
  assert.deepEqual([...leaf.path], [9, 4, 1]);
  assert.equal(leaf.blendMode, 9, "ONE blend mode reaches the leaf, and it is the inner one");
  assert.equal(record.filterGroups.filter((group) => opsUnderPath(record, [...group.path]).includes(inner.opFirst)).length, 2,
    "and TWO filter groups reach the same leaf, which is the whole difference between the two rules");
});

test("NOTHING is stamped on an operation: the only mark is the boolean that cannot be mistaken for a recipe", () => {
  // ► **A `filterGroup` INDEX ON EACH OP WOULD MAKE THE WRONG PAINTER THE
  //   EASY ONE TO WRITE** — `for (op of ops) { ctx.filter = groups[op.group].filter; draw(op); }`
  //   is four words long and blurs 1523 seams that do not exist. The refusal
  //   is the design, so it is asserted rather than left to habit.
  const record = marketOf();
  for (const op of record.ops) {
    for (const key of ["filter", "filters", "filterGroup", "filterGroups", "colourMatrices", "refused", "deferred"]) {
      assert.equal(key in op, false, `operation at ${op.path.join(",")} carries \`${key}\``);
    }
    if ("filtered" in op) assert.equal(op.filtered, true, "and the one mark it does carry is a bare true");
  }
});

test("the five facts `filtersNotApplied` used to add together, each with its denominator", () => {
  // ► **IT MEANT "NOT APPLIED" AND SOME NOW ARE.** Applied, deferred, refused,
  //   no-op and unreachable are five different facts, and the single number
  //   that used to stand for all five reported 9423 on the real pack — which
  //   read as a defect in this module rather than as a job for a painter.
  const a = marketOf().approximations;

  assert.equal(a.opsUnderFilterGroup, 6, "the denominator: operations inside a filtered subtree, out of 26");
  assert.equal(a.opsWithCanvasFilter, 2, "[7,2,1] under the glow and [9,4,1] under the blur");
  assert.equal(a.opsWithDeferredColourMatrix, 3, "all three under [9], including the one that is also blurred");
  assert.equal(a.opsUnderRefusedFilter, 1, "the bevel reaches exactly one operation");
  assert.equal(a.opsUnderNoOpFilterOnly, 2, "the strength-0 glow at [19] and the EMPTY filter list at [16]");
  assert.equal(a.filtersNotApplied, 2, "operations a painter is handed nothing for");
  // ► **THE SUBTRACTION IS THE FINDING, NOT EITHER NUMBER.** What is left when
  //   the harmless no-ops come out is the SILENT loss: an operation under a
  //   filter canvas refused with nothing else to fall back on. Zero here and
  //   zero on the real pack — and a bare zero would be indistinguishable from
  //   a dead counter, which is why it is stated as a difference between two
  //   counters that are both demonstrably alive.
  assert.equal(a.filtersNotApplied - a.opsUnderNoOpFilterOnly, 0);
  // ► **THEY OVERLAP, SO THEY DO NOT PARTITION — and each operation is still
  //   counted ONCE in each.** [9,4,1] is under the blur AND under the outer
  //   colour matrix, so it is in two of the four; incrementing per (op, group)
  //   pair instead of per operation would count it twice in ONE of them and
  //   inflate the real pack's figures by 40%, the fraction of its operations
  //   that sit under two filtered ancestors.
  assert.equal(a.opsWithCanvasFilter + a.opsWithDeferredColourMatrix
    + a.opsUnderRefusedFilter + a.opsUnderNoOpFilterOnly, 8,
    "eight category memberships across six operations: the excess IS the overlap");
  const record = marketOf();
  const both = record.filterGroups.filter((group) => opsUnderPath(record, [...group.path]).includes(10));
  assert.deepEqual(both.map((group) => group.path.join()), ["9", "9,4"],
    "and this is the operation in two of them, named rather than inferred from the arithmetic");
  assert.equal(a.opsWithDeferredColourMatrix <= a.opsUnderFilterGroup, true,
    "while no single category can exceed the population it is drawn from");

  assert.equal(a.filterGroups, 6, "the group denominator");
  assert.equal(a.filterGroupsFromPlacements, 5);
  assert.equal(a.filterGroupsFromButtonRecords, 1);
  assert.equal(a.filterGroupsReachingOps, 5);
  assert.equal(a.filterGroupsReachingNothing, 1);
  assert.deepEqual(a.filterGroupsReachingNothingByKind, { "text-static": 1 },
    "BY NAME: 'no filters on this screen' and 'filters that reach nothing I emit' are opposite findings with the same zero");
  assert.equal(a.filterGroupsNotContiguous, 0);

  assert.deepEqual(
    [a.filtersTotal, a.filtersApplied, a.filtersDeferredToColourMatrix, a.filtersNoOp, a.filtersRefused],
    [6, 3, 1, 1, 1],
    "the filter RECORDS, summed from canvasFilterFor's own buckets rather than recounted");
  assert.equal(a.filtersApplied + a.filtersDeferredToColourMatrix + a.filtersNoOp + a.filtersRefused, a.filtersTotal,
    "and those four DO partition, which is the property that would break if a branch stopped counting");
  assert.deepEqual(a.filtersRefusedByReason, { "bevel:filterHasNoCanvasEquivalent": 1 });
});

test("the pack's SECOND filter list is in the roster, reaching nothing, and saying so", () => {
  // ► **A ROSTER BUILT FROM `filteredPlacements` ALONE WOULD HAVE BEEN RIGHT
  //   ABOUT THE PICTURE AND SILENT ABOUT THE OMISSION**, which is this
  //   project's standing defect. The real pack holds five of these, all on
  //   `townsquare`, all `leaf: "text"`, all reaching zero operations.
  const group = marketGroups().find((entry) => entry.source === "buttonRecord");
  assert.deepEqual([...group.path], [45]);
  assert.equal(group.button, 777);
  assert.equal(group.leaf, "text");
  assert.equal(group.opCount, 0, "it reaches no shape operation");
  assert.equal(group.filter, "drop-shadow(0px 0px 2.8284px rgba(255, 153, 0, 1))",
    "and its filter is real, which is exactly why a roster that dropped it would be lying");
  assert.deepEqual([...group.unresolvedKinds], ["text-static"],
    "what it DOES reach, by name, out of this screen's own unresolved list");
  assert.equal(group.unresolvedUnder, 1);
});

test("`filter` is the SCALE-1 string; the buckets do not move with scale and `filters` is the record", () => {
  // ► **`ctx.filter` LENGTHS ARE NOT SCALED BY `ctx.setTransform`** (see
  //   `filters.js`, which states that this is a hypothesis and why), and
  //   `stageFitFor` letterboxes the 640x420 stage into whatever the surface
  //   is, so the scale is almost never 1. Baking one in here would ship every
  //   blur at the wrong width on every screen. The group therefore carries the
  //   pack's own records and a painter rebuilds the string.
  const group = marketGroups().find((entry) => entry.path.join() === "9,4");
  assert.deepEqual([...group.filters], [BLUR_4], "the pack's record, verbatim, not a re-spelling of it");

  const doubled = canvasFilterFor(group.filters, { scale: 2 });
  assert.equal(group.filter, "blur(1.118px)");
  assert.equal(doubled.filter, "blur(2.2361px)", "twice the length, which is the whole reason the record travels");
  assert.deepEqual(doubled.counts, group.counts,
    "and the BUCKETS are scale-invariant — every classification is made before the factor is applied");

  const bevelled = marketGroups().find((entry) => entry.path.join() === "7,2");
  assert.deepEqual(canvasFilterFor(bevelled.filters, { scale: 2 }).counts, bevelled.counts,
    "a refusal at scale 1 is a refusal at scale 2: no scale makes canvas grow a bevel");
});

/**
 * A PACK WHOSE DRAWABLES ARE OUT OF PATH ORDER, which the real extractor's
 * never are.
 *
 * ► **`filterGroupsNotContiguous` IS ZERO ON THE REAL PACK, AND A COUNTER THAT
 *   IS ONLY EVER ZERO IS INDISTINGUISHABLE FROM A DEAD ONE.** All 135 groups
 *   that reach an operation there are a contiguous run in `ops`, because
 *   `tools/extract-screens.mjs` emits drawables in path order — measured
 *   2026-09-15, 0 adjacent pairs out of order across the 26 screens. That is a
 *   property of the extractor and not a guarantee of the format, and the range
 *   on a group is what a painter would otherwise trust blindly. So the case is
 *   reached here instead.
 */
function interleavedPack() {
  return {
    screens: {
      split: {
        name: "split",
        labelFrame: 1, firstFrame: 1, lastFrame: 1,
        objects: [],
        drawables: [
          { shape: 11, path: [5, 1], matrix: [1, 0, 0, 1, 0, 0] },
          { shape: 11, path: [6, 1], matrix: [1, 0, 0, 1, 0, 0] },
          { shape: 11, path: [5, 2], matrix: [1, 0, 0, 1, 0, 0] }
        ],
        unresolved: [], textFields: [], staticText: [],
        multiFrameSprites: [],
        filteredPlacements: [{ character: 80, path: [5], filters: [BLUR_4] }],
        blendedPlacements: [],
        rangeVariance: { frames: 0, firstDifferingFrame: null, depthsAdded: [], depthsRemoved: [] },
        approximations: {},
        counts: { objects: 0, drawables: 3 },
        resolvedNothing: false
      }
    },
    shapes: SHAPES,
    fonts: {}
  };
}

test("a group whose operations are NOT a run is REPORTED, not mis-stated by its range", () => {
  const record = screenFor(screenPackFrom(interleavedPack()), "split");
  assert.equal(record.ops.length, 3);
  const group = record.filterGroups[0];

  assert.deepEqual(opsUnderPath(record, [5]), [0, 2], "operation 1 is at [6,1] and is NOT in the group");
  assert.equal(group.opCount, 2, "the count is exact");
  assert.equal(group.contiguous, false);
  assert.equal(record.approximations.filterGroupsNotContiguous, 1);
  assert.equal(group.opFirst, 0);
  assert.equal(group.opEnd, 3, "the range BRACKETS the group rather than naming it");
  assert.equal(group.opEnd - group.opFirst > group.opCount, true,
    "which is precisely the statement `contiguous: false` is making, and a painter must re-match on `path`");
  // ► And the bracket is a real bracket: nothing in the group is outside it,
  //   so a painter that re-matches inside the range still finds everything.
  for (const index of opsUnderPath(record, [5])) {
    assert.equal(index >= group.opFirst && index < group.opEnd, true, `operation ${index} is outside its own group's range`);
  }
  assert.equal(record.approximations.opsUnderFilterGroup, 2, "and the op-level count is not fooled by the interleaving");
});

/**
 * THE REAL PACK'S FILTER GROUPS, AND THE NUMBER THAT SETTLES WHETHER THIS
 * MODULE IS READING THE RECORDS AT ALL.
 *
 * ► **EVERY COUNT BELOW COULD HAVE TAKEN A DIFFERENT VALUE, AND THE PREVIOUS
 *   IMPLEMENTATION PROVES IT: it produced NO filter string, NO bucket and NO
 *   group, because it read `entry.path` and dropped `entry.filters`.** The
 *   assertions that matter most are the ones tied to
 *   `assets/screens/manifest.json`, which a DIFFERENT pass of the extractor
 *   wrote from the SWF and which knows nothing about `canvasFilterFor`: its
 *   `filtersByType` block and this module's four buckets have to recompose
 *   into each other, and there is no way for one to be derived from the other.
 */
test("the real pack: 248 filter groups, and the four buckets recompose to the manifest's own census", () => {
  if (!REAL_SCREENS || !REAL_MANIFEST) {
    assert.equal(REAL_SCREENS === null || REAL_MANIFEST === null, true, "no extraction on this machine");
    return;
  }
  const pack = screenPackFrom(REAL_SCREENS);
  const names = screenNames(pack);
  const total = {
    filterGroups: 0, filterGroupsFromPlacements: 0, filterGroupsFromButtonRecords: 0,
    filterGroupsReachingOps: 0, filterGroupsReachingNothing: 0,
    filterGroupsNested: 0, filterGroupsNotContiguous: 0,
    filtersTotal: 0, filtersApplied: 0, filtersDeferredToColourMatrix: 0,
    filtersNoOp: 0, filtersRefused: 0,
    opsUnderFilterGroup: 0, opsWithCanvasFilter: 0, opsWithDeferredColourMatrix: 0,
    opsUnderRefusedFilter: 0, opsUnderNoOpFilterOnly: 0, filtersNotApplied: 0
  };
  const reachingNothingByKind = {};
  const refusedByReason = {};
  const strings = new Set();
  let ops = 0;
  for (const name of names) {
    const record = screenFor(pack, name);
    ops += record.ops.length;
    for (const key of Object.keys(total)) total[key] += record.approximations[key];
    for (const [kind, count] of Object.entries(record.approximations.filterGroupsReachingNothingByKind)) {
      reachingNothingByKind[kind] = (reachingNothingByKind[kind] ?? 0) + count;
    }
    for (const [reason, count] of Object.entries(record.approximations.filtersRefusedByReason)) {
      refusedByReason[reason] = (refusedByReason[reason] ?? 0) + count;
    }
    for (const group of record.filterGroups) if (group.filter !== null) strings.add(group.filter);
  }
  assert.equal(names.length, 26);
  assert.equal(ops, 13638);

  // ── THE ROSTER, against the manifest's independently written counts.
  const manifestPlacements = Object.values(REAL_MANIFEST.screens)
    .reduce((sum, screen) => sum + (screen.approximations?.filters ?? 0), 0);
  const manifestButtonRecords = Object.values(REAL_MANIFEST.screens)
    .reduce((sum, screen) => sum + (screen.approximations?.filtersInButtonRecords ?? 0), 0);
  assert.equal(manifestPlacements, 243, "the manifest's own count of placements carrying a filter list");
  assert.equal(manifestButtonRecords, 5, "and of filtered records inside buttons — its second list");
  assert.equal(total.filterGroupsFromPlacements, manifestPlacements, "one group per filtered placement, no more and no fewer");
  assert.equal(total.filterGroupsFromButtonRecords, manifestButtonRecords);
  assert.equal(total.filterGroups, 248);

  // ── THE BUCKETS. `filtersByType` is the extractor's census of the FILTER
  //    RECORDS; the four buckets are `canvasFilterFor`'s verdicts on the same
  //    records. Neither is computed from the other.
  const byType = REAL_MANIFEST.filtersByType;
  assert.deepEqual(byType, { dropShadow: 16, glow: 145, bevel: 2, blur: 56, colourMatrix: 57 });
  assert.equal(total.filtersTotal, Object.values(byType).reduce((sum, count) => sum + count, 0),
    "276 filter records, reached from two different directions");
  assert.equal(total.filtersRefused, byType.bevel,
    "► EVERY REFUSAL ON THESE SCREENS IS A BEVEL — canvas has no bevel, and there is no nearest match on offer");
  assert.deepEqual(refusedByReason, { "bevel:filterHasNoCanvasEquivalent": 2 });
  assert.equal(total.filtersDeferredToColourMatrix, byType.colourMatrix,
    "and every colour matrix is deferred to `applyColourMatrix`, not smuggled into the string as a CSS shorthand");
  assert.equal(total.filtersApplied + total.filtersNoOp, byType.dropShadow + byType.glow + byType.blur,
    "the shadow-shaped and blur-shaped records either produce a string or are named as no-ops; none goes missing");
  assert.equal(total.filtersApplied, 214);
  assert.equal(total.filtersNoOp, 3, "three zero-strength glows — the build has 208 of them, three of which are here");

  // ── THE STRINGS. 20 distinct ones across 248 groups, which is the count that
  //    would read 0 under the implementation this replaces.
  assert.equal(strings.size, 20);
  assert.equal([...strings].every((filter) => /^(blur|drop-shadow)\(/.test(filter)), true,
    "and each is built from the two CSS functions filters.js will emit, never a `saturate()` fitted to a matrix");

  // ── WHAT REACHES AN OPERATION AND WHAT DOES NOT.
  assert.equal(total.filterGroupsReachingOps, 135);
  assert.equal(total.filterGroupsReachingNothing, 113, "45% of the roster: 108 placements plus all 5 button records");
  assert.deepEqual(reachingNothingByKind, { "text-edit": 92, "text-static": 21 },
    "► AND ALL 113 ARE TEXT. `screen.js` emits no text, so a glow on a field reaches no drawable here — "
    + "`screen-text.js` is the join. Counted BY NAME because 'no filters here' and 'filters that reach "
    + "nothing I emit' are opposite findings with the same zero");
  assert.equal(total.filterGroupsReachingOps + total.filterGroupsReachingNothing, total.filterGroups,
    "and the two halves partition the roster, so a group cannot fall out of both");

  // ── THE OPERATION-LEVEL FIVE.
  assert.equal(total.opsUnderFilterGroup, 9423,
    "► THE NUMBER THE OLD `filtersNotApplied` REPORTED, unchanged and renamed: 69% of 13638");
  assert.equal(total.opsWithCanvasFilter, 6440);
  assert.equal(total.opsWithDeferredColourMatrix, 8850,
    "more operations are waiting on a colour matrix than on a filter string, which is the opposite of what "
    + "'drop shadows and glows are missing' suggested");
  assert.equal(total.opsUnderRefusedFilter, 2, "the two bevels reach one operation each");
  assert.equal(total.filtersNotApplied, 24, "operations a painter is handed nothing at all for");
  assert.equal(total.opsUnderNoOpFilterOnly, 24);
  assert.equal(total.filtersNotApplied - total.opsUnderNoOpFilterOnly, 0,
    "► AND THE DIFFERENCE IS THE SILENT LOSS: every one of the 24 is a zero-strength glow, which the build "
    + "draws nothing for either. A bare zero here would not be worth reading; a difference between two live "
    + "counters is");

  // ── CONTIGUITY, with its denominator.
  assert.equal(total.filterGroupsNotContiguous, 0);
  assert.equal(total.filterGroupsReachingOps, 135,
    "and 135 is the population that could have been non-contiguous, so the zero above is a finding about the "
    + "extractor's drawable order rather than a counter nobody incremented");
});

test("the real pack: nesting is COMMON — 40% of operations sit under two filtered ancestors", () => {
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  // ► **THE RULE FOR NESTED FILTERS WAS CHOSEN AFTER MEASURING HOW OFTEN IT
  //   FIRES, because a rule chosen on unreachable data is a rule nobody has
  //   tested.** It fires constantly. Had this come back `{0: …, 1: …}` the
  //   honest write-up would have been "this never happens on this build".
  const pack = screenPackFrom(REAL_SCREENS);
  const ancestors = {};
  let nested = 0;
  let groups = 0;
  for (const name of screenNames(pack)) {
    const record = screenFor(pack, name);
    nested += record.approximations.filterGroupsNested;
    groups += record.approximations.filterGroups;
    for (const op of record.ops) {
      const count = record.filterGroups.filter((group) => {
        if (group.path.length > op.path.length) return false;
        return group.path.every((step, at) => op.path[at] === step);
      }).length;
      ancestors[count] = (ancestors[count] ?? 0) + 1;
    }
  }
  assert.deepEqual(ancestors, { 0: 4215, 1: 4028, 2: 5395 },
    "recomputed here from the paths, not read off the groups' own bookkeeping");
  assert.equal(ancestors[2] / (ancestors[0] + ancestors[1] + ancestors[2]) > 0.39, true, "40% of 13638");
  assert.equal(3 in ancestors, false, "and nothing on this build is three deep, which is worth knowing before writing for it");
  assert.equal(nested, 67, "67 of the 248 groups have a filtered ancestor");
  assert.equal(groups, 248);
});

test("the real pack: the 1523-operation group is a COLOUR MATRIX with four blurs nested inside it", () => {
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  // ► **THIS IS THE CASE THAT RULES OUT BOTH EASY ANSWERS.** Stamping the
  //   filter onto each leaf would blur 1523 paths individually along seams the
  //   build does not have. "Innermost wins", which is the right answer for a
  //   blend mode twenty lines away in `screen.js`, would drop this colour
  //   matrix from all 1523 and leave four small blurs standing — the town
  //   drawn at full daylight with four blurred props in it, and it would look
  //   finished.
  const record = screenFor(screenPackFrom(REAL_SCREENS), "townsquare");
  assert.equal(record.ops.length, 1638);
  const big = record.filterGroups.find((group) => group.path.join() === "59,1");
  assert.equal(big.opCount, 1523, "93% of the screen, in ONE group");
  assert.equal(big.filter, null, "and it produces NO canvas filter string at all");
  assert.equal(big.colourMatrices.length, 1);
  assert.deepEqual(big.colourMatrices[0].slice(0, 5), [0.48145002126693726, 0.4570499658584595, 0.061500001698732376, 0, -75],
    "a Flash-coefficient grade with a -75 offset on every colour row: this is the town's whole mood");
  assert.equal(big.contiguous, true);
  assert.equal(big.opFirst, 3);
  assert.equal(big.opEnd, 1526);
  assert.deepEqual(opsUnderPath(record, [59, 1]).length, 1523, "recomputed from the paths, against the range");
  assert.equal(record.ops.slice(big.opFirst, big.opEnd).length, 1523);

  assert.deepEqual(big.children.map((index) => record.filterGroups[index].path.join()),
    ["59,1,3", "59,1,8", "59,1,317", "59,1,319"]);
  assert.deepEqual(big.children.map((index) => record.filterGroups[index].opCount), [8, 308, 207, 421]);
  assert.equal(big.ownOpCount, 579, "1523 less the 944 that arrive already filtered by a child");
  assert.equal(big.ownOpCount + big.children.reduce((sum, index) => sum + record.filterGroups[index].opCount, 0), big.opCount,
    "and the parts add up, which is what would break if a child were counted twice or missed");
  for (const index of big.children) {
    const child = record.filterGroups[index];
    assert.equal(child.parent, big.index);
    assert.equal(child.opFirst >= big.opFirst && child.opEnd <= big.opEnd, true,
      `child ${child.path.join(",")} is not inside its parent's range`);
  }

  // A ONE-OPERATION GROUP on the same screen, so the mapping is pinned at both
  // ends of the 1-to-1523 range rather than only at the loud end.
  const small = record.filterGroups.find((group) => group.path.join() === "3,55");
  assert.equal(small.opCount, 1);
  assert.equal(small.opEnd - small.opFirst, 1);
  assert.equal(small.filter, "blur(3.1623px)");
  assert.equal(small.colourMatrices.length, 1, "a blur AND a matrix on one list: the string is not the whole story");
  assert.deepEqual([...record.ops[small.opFirst].path], [3, 55, 1]);
});

test("the real pack: the two bevels are refused BY NAME, and their groups still paint the glow beside them", () => {
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  // ► **A REFUSAL IS NOT A FAILURE TO PAINT.** Both bevels sit on a list with
  //   a glow, so the group has a string and the operation is drawn — with one
  //   filter of its two missing, which is a fact only `refused` carries.
  const pack = screenPackFrom(REAL_SCREENS);
  const found = [];
  for (const name of screenNames(pack)) {
    for (const group of screenFor(pack, name).filterGroups) {
      if (group.refused.length > 0) found.push({ name, path: group.path.join(), group });
    }
  }
  assert.deepEqual(found.map((entry) => `${entry.name} [${entry.path}]`), ["splash [52,1]", "new_or_continue [52,1]"]);
  for (const entry of found) {
    assert.deepEqual(entry.group.refused.map((record) => record.type), ["bevel"]);
    assert.deepEqual(entry.group.refused.map((record) => record.nearest), [null],
      "and NO nearest match is offered, because a nearest-match bevel is the silent-approximation defect");
    assert.equal(entry.group.filter, "drop-shadow(0px 0px 2.8284px rgba(255, 153, 0, 1))",
      "the glow on the same list still paints");
    assert.equal(entry.group.opCount, 1);
    assert.deepEqual(entry.group.counts, { total: 2, applied: 1, deferred: 0, noOp: 0, refused: 1, approximated: 1 });
  }
});

test("the real pack: every group's range agrees with a fresh prefix match, on all 248", () => {
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  // ► **THE INVARIANT THE RANGE LIVES OR DIES BY.** `[opFirst, opEnd)` is an
  //   index into an array, and the argument for it is that it is derived, in
  //   the same call, from the very `ops` it indexes. This checks that claim on
  //   every group on every screen rather than on the one that was easy to
  //   read, and it is what would go red if `ops` were ever reordered after the
  //   groups were built.
  const pack = screenPackFrom(REAL_SCREENS);
  let checked = 0;
  let contiguous = 0;
  const sizes = {};
  for (const name of screenNames(pack)) {
    const record = screenFor(pack, name);
    for (const group of record.filterGroups) {
      const indices = opsUnderPath(record, [...group.path]);
      assert.equal(group.opCount, indices.length, `${name} [${group.path.join(",")}] count`);
      sizes[group.opCount] = (sizes[group.opCount] ?? 0) + 1;
      if (indices.length === 0) {
        assert.equal(group.opFirst, group.opEnd, `${name} [${group.path.join(",")}] should name an empty range`);
      } else {
        assert.equal(group.opFirst, indices[0]);
        assert.equal(group.opEnd, indices[indices.length - 1] + 1);
        if (group.contiguous) {
          assert.deepEqual(record.ops.slice(group.opFirst, group.opEnd).map((op) => op.path.join(",")),
            indices.map((index) => record.ops[index].path.join(",")),
            `${name} [${group.path.join(",")}] claims contiguity it does not have`);
          contiguous += 1;
        }
      }
      checked += 1;
    }
  }
  assert.equal(checked, 248);
  assert.equal(contiguous, 135, "every group that reaches an operation is a contiguous run, and all 135 were checked");
  // ► **THE DISTRIBUTION, because "135 groups" says nothing about whether the
  //   hard case is in there.** It is bimodal: 113 reach nothing, 81 reach ten
  //   or fewer, and five reach 1523 apiece.
  assert.deepEqual(sizes, {
    0: 113, 1: 29, 2: 26, 3: 26, 4: 1, 6: 10, 8: 5, 11: 2, 21: 5,
    157: 4, 173: 6, 207: 5, 308: 5, 421: 5, 467: 1, 1523: 5
  });
});

/**
 * TWO GROUPS AT ONE PATH — the only arrangement in which `ownOpCount` lies.
 *
 * ► **ZERO ON THE REAL PACK, WHICH IS WHY IT NEEDS A FIXTURE.** Two placements
 *   at the same path are SIBLINGS under the parent rule (neither is a strict
 *   prefix of the other), so both are subtracted from their common parent and
 *   the same operations come out twice — here, an `ownOpCount` of -1 for one
 *   operation. The module does not pretend otherwise and does not clamp it:
 *   clamping would turn a visible wrong number into an invisible one.
 *   `filterGroupsSharingAPath` is the count that says the subtraction can be
 *   trusted, and a counter that is only ever zero is a counter nobody has run.
 */
function twinnedPack() {
  return {
    screens: {
      twin: {
        name: "twin",
        labelFrame: 1, firstFrame: 1, lastFrame: 1,
        objects: [],
        drawables: [{ shape: 11, path: [5, 1], matrix: [1, 0, 0, 1, 0, 0] }],
        unresolved: [], textFields: [], staticText: [],
        multiFrameSprites: [],
        filteredPlacements: [
          { character: 90, path: [5], filters: [BLUR_4] },
          { character: 91, path: [5, 1], filters: [GLOW_ORANGE] },
          { character: 92, path: [5, 1], filters: [BLUR_4] }
        ],
        blendedPlacements: [],
        rangeVariance: { frames: 0, firstDifferingFrame: null, depthsAdded: [], depthsRemoved: [] },
        approximations: {},
        counts: { objects: 0, drawables: 1 },
        resolvedNothing: false
      }
    },
    shapes: SHAPES,
    fonts: {}
  };
}

test("two groups at one path are COUNTED, because that is the case `ownOpCount` cannot survive", () => {
  const record = screenFor(screenPackFrom(twinnedPack()), "twin");
  assert.equal(record.approximations.filterGroupsSharingAPath, 1, "three groups, two of them at [5,1]");
  const root = record.filterGroups.find((group) => group.path.join() === "5");
  const twins = record.filterGroups.filter((group) => group.path.join() === "5,1");
  assert.equal(twins.length, 2);
  assert.deepEqual(twins.map((group) => group.parent), [root.index, root.index], "siblings, not a chain");
  assert.equal(root.opCount, 1);
  assert.equal(root.ownOpCount, -1,
    "one operation taken out twice — REPORTED rather than clamped, so the counter above is what a reader checks first");
  assert.equal(marketOf().approximations.filterGroupsSharingAPath, 0,
    "and it is 0 where the paths are distinct, so it is not simply always non-zero");
});

test("the real pack: no two groups share a path, so every `ownOpCount` on it is exact", () => {
  if (!REAL_SCREENS) {
    assert.equal(REAL_SCREENS, null, "no extraction on this machine");
    return;
  }
  const pack = screenPackFrom(REAL_SCREENS);
  let shared = 0;
  let groups = 0;
  let negative = 0;
  for (const name of screenNames(pack)) {
    const record = screenFor(pack, name);
    shared += record.approximations.filterGroupsSharingAPath;
    groups += record.filterGroups.length;
    for (const group of record.filterGroups) if (group.ownOpCount < 0) negative += 1;
  }
  assert.equal(groups, 248, "the denominator the zero below is drawn from");
  assert.equal(shared, 0);
  assert.equal(negative, 0, "which is the consequence, checked independently of the counter that predicts it");
});
