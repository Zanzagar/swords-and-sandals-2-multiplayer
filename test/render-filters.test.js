/**
 * WHAT THE BUILD DOES TO COLOUR, under test — `src/render/filters.js`.
 *
 * ► **THERE IS NO FIXTURE AND THERE MUST NOT BE.** This repository ships no SS2
 *   asset and `test/asset-attestation.test.js` fails if anything under
 *   `assets/` is tracked, so every record below is built here in the shape
 *   `parseFilterList` emits. What is under test is the module's reading of that
 *   shape, not one person's install.
 *
 * ## The census these tests were written against
 *
 * Counted 2026-09-14 by walking EVERY tag of the oracle (sha256 `77cb545c…`),
 * recursing into every `DefineSprite` and decoding every `PlaceObject3` with
 * `tools/swf-display-list.mjs`. 29,966 placement tags, 1,522 `PlaceObject3`,
 * **1,894 filter records**:
 *
 * ```text
 *   glow 853   colourMatrix 636   blur 320   bevel 54   dropShadow 31
 *   gradientGlow 0     convolution 0     gradientBevel 0
 *   blend mode ids present: 3 (x3), 5 (x1), 13 (x5), 14 (x3) — and no others
 * ```
 *
 * Running `canvasFilterFor` over all 1,894 of them partitions them
 * **867 applied / 624 deferred / 346 no-op / 57 refused**, which sums to 1,894.
 * The 57 refusals are 54 bevels and 3 inner glows; the 346 no-ops are 126
 * `Blur(0,0)`, 208 zero-strength glows and 12 identity matrices. Those five
 * numbers are the reason the shapes below look the way they do, and the
 * partition itself is asserted as an invariant rather than as a snapshot.
 *
 * ► **THE TESTS PIN BEHAVIOUR, NOT THE CENSUS.** The counts above are evidence
 *   for why each arm exists; a test that asserted "624" would go red the day
 *   someone points the tools at a modded build, which is a legitimate thing to
 *   do here. What must never change is that every record lands in exactly one
 *   bucket and that nothing is dropped unnamed.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  IDENTITY_COLOUR_TRANSFORM,
  SWF_BLEND_MODES,
  applyColourMatrix,
  applyColourTransform,
  applyColourTransformAlpha,
  blendModeFor,
  blurSigma,
  canvasFilterFor,
  colourMatrixFilterString,
  colourMatrixFrom,
  colourMatrixIsFillExact,
  colourTransformApplies,
  colourTransformFrom,
  isIdentityColourMatrix,
  isIdentityColourTransform,
  summariseFilterUse
} from "../src/render/filters.js";

/** The identity colour matrix, as `parseFilterList` would hand it over. */
const IDENTITY_CELLS = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/**
 * Flash's own greyscale matrix — `0.3086 / 0.6094 / 0.0820`. It occurs 6 times
 * in the build and is NOT CSS `grayscale()`, which uses Rec.709
 * `0.2126 / 0.7152 / 0.0722`. That difference is why this module refuses to
 * emit a CSS shorthand for a colour matrix.
 */
const GREYSCALE_CELLS = [
  0.3086, 0.6094, 0.082, 0, 0,
  0.3086, 0.6094, 0.082, 0, 0,
  0.3086, 0.6094, 0.082, 0, 0,
  0, 0, 0, 1, 0
];

/** A blur in the shape `parseFilterList` emits for filter id 1. */
function blurRecord(blurX, blurY = blurX, passes = 1) {
  return { type: "blur", filterId: 1, blurX, blurY, passes };
}

/** A glow (id 2) in the shape `parseFilterList` emits, flags included. */
function glowRecord(overrides = {}) {
  return {
    type: "glow", filterId: 2,
    colour: { red: 255, green: 0, blue: 0, alpha: 255 },
    blurX: 8, blurY: 8, strength: 1,
    inner: false, knockout: false, compositeSource: true, passes: 1,
    ...overrides
  };
}

/** A drop shadow (id 0). Every one in the build sits at `angle` pi/4. */
function shadowRecord(overrides = {}) {
  return {
    type: "dropShadow", filterId: 0,
    colour: { red: 0, green: 0, blue: 0, alpha: 255 },
    blurX: 8, blurY: 8, strength: 1, angle: Math.PI / 4, distance: 8,
    inner: false, knockout: false, compositeSource: true, passes: 1,
    ...overrides
  };
}

/**
 * THE HONESTY INVARIANT, and it is the reason this module has four buckets.
 *
 * Every record handed in must land in exactly one of applied / deferred /
 * no-op / refused, and the four must sum to the number of records. A record
 * that silently vanishes is the defect this whole programme exists to catch —
 * an approximation that is not counted is indistinguishable from a correct
 * read — and it would otherwise show up only as a picture that looks slightly
 * wrong months later.
 */
function assertPartitions(result, records) {
  const { counts } = result;
  assert.equal(counts.total, records.length, "every record must be accounted for");
  assert.equal(
    counts.applied + counts.deferred + counts.noOp + counts.refused,
    counts.total,
    "the four buckets must partition the records, not overlap or leak"
  );
  assert.equal(result.applied.length, counts.applied);
  assert.equal(result.deferred.length, counts.deferred);
  assert.equal(result.noOps.length, counts.noOp);
  assert.equal(result.refused.length, counts.refused);
}

/** Pull the numeric lengths out of one `drop-shadow(...)` or `blur(...)` part. */
function lengthsIn(part) {
  return [...part.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
}

// ---------------------------------------------------------------------------
// Colour transforms — the shared version of `extracted-figure.js`'s `tint`.
// ---------------------------------------------------------------------------

test("a colour transform is accepted in BOTH shapes this tree already writes", () => {
  // `tools/extract-figure.mjs` packColour writes the eight-number array;
  // `tools/extract-props.mjs` writes `swf-display-list.mjs`'s named object. A
  // reader that took only one would silently drop every tint on the other pack.
  const asArray = colourTransformFrom([0.5, 0.5, 0.5, 1, 10, 20, 30, 0]);
  const asObject = colourTransformFrom({
    redMultiplier: 0.5, greenMultiplier: 0.5, blueMultiplier: 0.5, alphaMultiplier: 1,
    redOffset: 10, greenOffset: 20, blueOffset: 30, alphaOffset: 0
  });
  assert.deepEqual([...asArray], [0.5, 0.5, 0.5, 1, 10, 20, 30, 0]);
  assert.deepEqual([...asObject], [...asArray]);
});

test("an identity transform collapses to null, so 'carries a tint' keeps meaning something", () => {
  // `composeColourTransform` ALWAYS returns an object, so `extract-props.mjs`
  // stamps an identity transform on every placement it writes. Without this
  // collapse, "does this placement carry a tint" answers yes 100% of the time.
  assert.equal(colourTransformFrom({
    redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1,
    redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0
  }), null);
  assert.equal(colourTransformFrom([...IDENTITY_COLOUR_TRANSFORM]), null);
  assert.ok(isIdentityColourTransform([...IDENTITY_COLOUR_TRANSFORM]));
});

test("a malformed transform is null rather than a partly-applied one", () => {
  assert.equal(colourTransformFrom(null), null);
  assert.equal(colourTransformFrom([1, 1, 1]), null);
  assert.equal(colourTransformFrom("0.5"), null);
  // A missing field falls back to the identity for that channel, not to zero,
  // which would multiply the colour away to black.
  assert.deepEqual([...colourTransformFrom({ redMultiplier: 0.5 })], [0.5, 1, 1, 1, 0, 0, 0, 0]);
});

test("channel * multiplier + offset, clamped — on a worked example", () => {
  // 0x80 = 128. 128 * 0.5 + 10 = 74 = 0x4a. 128 * 2 + 0 = 256, clamped to 255.
  // 128 * 1 - 200 = -72, clamped to 0.
  //
  // ► **NOT ONE CHANNEL HERE LANDS ON A FRACTION, so this line cannot tell
  //   floor from round and never could.** 128 * 0.5 is exactly 64, 128 * 2 is
  //   exactly 256, 128 * 1 is exactly 128. Measured 2026-09-14 by mutation:
  //   swapping `Math.floor` for `Math.round` in `channelOf` leaves ALL 38
  //   tests in this file green. The whole suite catches it — but only in
  //   `test/render-screen.test.js`, in a module that merely CALLS this one.
  //   The test below is the missing pin in the file that owns the arithmetic.
  assert.equal(applyColourTransform("#808080", [0.5, 2, 1, 1, 10, 0, -200, 0]), "#4aff00");
});

test("the multiply term FLOORS, pinned on a channel that lands on a half", () => {
  // ► **THE ARITHMETIC THIS MODULE OWNS, PINNED WHERE IT IS OWNED.** After the
  //   2026-09-14 fold `filters.js` holds the only copy of the colour transform
  //   in this tree, and until this test the only assertion that could tell
  //   floor from round lived in `render-screen.test.js`. A module whose most
  //   dangerous property is pinned exclusively by one of its consumers is one
  //   refactor away from being unpinned.
  //
  //   `readColourTransform` reads the multiply term as `readSB(bits) / 256` —
  //   signed 8.8 fixed point — and the player computes `(channel * term) >> 8`,
  //   an arithmetic shift, which rounds toward negative infinity. 255 * 0.5 is
  //   127.5: the shift gives 127 and `Math.round` gives 128. Measured on the
  //   real screens pack, that one-unit difference falls on 69 of the 1023
  //   tinted values.
  assert.equal(applyColourTransform("#ff0000", [0.5, 1, 1, 1, 0, 0, 0, 0]), "#7f0000",
    "if this reads #800000 the module is rounding");
  assert.equal(Math.round(255 * 0.5), 128, "and rounding really would move this channel");
  assert.equal((255 * 128) >> 8, 0x7f, "the player's own integers, for comparison");
  // ► **AND THE FLOOR IS ON THE PRODUCT, NOT ON THE SUM — but the two orders
  //   are INDISTINGUISHABLE ON ANY WIRE DATA, and saying so is the point.**
  //   For a whole-number offset `floor(p) + k` and `floor(p + k)` are equal for
  //   every p, and `readColourTransform` reads every offset with `readSB`, so
  //   nothing off the bytes can tell them apart. Only a COMPOSED fractional
  //   offset can, and this build writes none — measured below. The order is
  //   still pinned, because the player's `(channel * term) >> 8` shifts before
  //   it adds, and a test that can only fire on a case the build does not
  //   contain is worth exactly one line and no more.
  //   `floor(255 * 0.5) + 0.75` is 127.75 -> 127; `floor(255 * 0.5 + 0.75)` is 128.
  assert.equal(applyColourTransform("#ff0000", [0.5, 1, 1, 1, 0.75, 0, 0, 0]), "#7f0000",
    "the floor falls on the product; flooring the sum instead gives #800000");
});

test("a FRACTIONAL offset still produces a colour, not a nine-character string", () => {
  // ► **A DEFECT FOUND 2026-09-14 AND FIXED IN `channelOf`, with the fix worth
  //   exactly nothing on any pack this tree currently writes — which is why it
  //   needs a test and not a measurement.** Every offset that comes off the
  //   wire is a whole number: `readColourTransform` reads it with `readSB`.
  //   But `composeColourTransform` computes a composed offset as
  //   `parentMultiplier * childOffset + parentOffset`, and this build's
  //   multipliers are eighths and 77/256s, so a nested placement can produce a
  //   fractional one. Before the fix the fraction survived the clamp and
  //   reached `hex2`, where `(128.5).toString(16)` is `"80.8"` and the whole
  //   return value was `"#80.88080"`.
  //
  //   Counted across every pack in this tree before fixing it — screens 341
  //   named plus 10 arrays, props 3,345, animations 4,544, icons 131 — **0
  //   fractional offsets**, so no pixel has ever been wrong. A digest over any
  //   of those packs is constant under this defect BY CONSTRUCTION, which is
  //   the same reason a digest could not see the gradient-stop hole.
  for (const offset of [0.5, 1.25, -0.5, 1 / 3]) {
    const out = applyColourTransform("#808080", [1, 1, 1, 1, offset, 0, 0, 0]);
    assert.equal(out.length, 7, `offset ${offset} must still yield #rrggbb, got ${out}`);
    assert.equal(/^#[0-9a-f]{6}$/.test(out), true, `offset ${offset} produced ${out}`);
  }
  // And the floor is the rule, so half a unit of offset moves nothing.
  assert.equal(applyColourTransform("#808080", [1, 1, 1, 1, 0.5, 0, 0, 0]), "#808080");
  assert.equal(applyColourTransform("#808080", [1, 1, 1, 1, 1.5, 0, 0, 0]), "#818080");
});

test("a THREE-DIGIT hex is refused instead of becoming a different colour", () => {
  // ► THE DEFECT THIS LINE PREVENTS, measured: `extracted-figure.js`'s private
  //   `tint` tests only `hex[0] === "#"` and then parses the rest as one
  //   integer, so `#abc` becomes 0x000abc and comes back `#ffffff` under the
  //   build's own brightening transforms — a silently wrong colour. Across
  //   40,956 differential pairs (every one of the oracle's 3,413 non-identity
  //   transforms against a dozen fills) the two agree on every `#rrggbb` and
  //   differ ONLY here.
  assert.equal(applyColourTransform("#abc", [2, 2, 2, 1, 100, 100, 100, 0]), "#abc");
  assert.equal(applyColourTransform("#zzzzzz", [2, 2, 2, 1, 0, 0, 0, 0]), "#zzzzzz");
  assert.equal(applyColourTransform("none", [2, 2, 2, 1, 0, 0, 0, 0]), "none");
});

test("a hex LONGER than seven characters is refused too, which nothing pinned", () => {
  // ► **`parseHexColour`'s docstring says STRICTLY SEVEN CHARACTERS and only
  //   the SHORT case was tested.** Found 2026-09-14 by mutation: relaxing
  //   `hex.length !== 7` to `hex.length < 7` left every test in this file and
  //   in `render-screen.test.js` green. The reader's loop takes exactly six
  //   digits from index 1, so under that relaxation `#aabbccdd` — the
  //   eight-digit `#rrggbbaa` spelling, which is a real thing a producer can
  //   emit — parses as `aabbcc`, gets tinted, and comes back as a DIFFERENT
  //   colour with its alpha silently gone. That is the same defect the
  //   three-digit case above is about, pointing the other way, and the
  //   assertion for it did not exist.
  //
  //   No pack in this tree writes one today: `tools/swf-shapes.mjs` zero-pads
  //   every channel and emits `#rrggbb` only. "The producer happens not to do
  //   that" is the reason nobody has been bitten, not a reason for a reader to
  //   be wrong if it ever does.
  const tint = [2, 2, 2, 1, 0, 0, 0, 0];
  assert.equal(applyColourTransform("#aabbccdd", tint), "#aabbccdd", "returned unchanged, not parsed as #aabbcc");
  assert.equal(applyColourTransform("#1234567", tint), "#1234567");
  assert.equal(colourTransformApplies("#aabbccdd", tint), false,
    "and it is reported as a tint that did NOT land, so a caller can count it");
});

test("a tint that could not be applied is DISTINGUISHABLE from no tint at all", () => {
  // A tint on a bitmap or gradient fill is a real approximation; a placement
  // with no tint is not. A caller that cannot tell them apart reports the first
  // as the second, which is how the arena walls stayed invisible for months.
  const tint = [0.5, 0.5, 0.5, 1, 0, 0, 0, 0];
  assert.ok(colourTransformApplies("#112233", tint));
  assert.equal(colourTransformApplies("none", tint), false);
  assert.equal(colourTransformApplies("#112233", null), false);
});

test("the ALPHA OFFSET is divided by 255 and the multiplier is not", () => {
  // The renderer's opacity is 0..1; the wire's offset is in 0..255 colour
  // space. This seam is the same class as twips-versus-pixels and this
  // repository has lost three defects to that one.
  assert.equal(applyColourTransformAlpha(1, [1, 1, 1, 0.5, 0, 0, 0, 0]), 0.5);
  assert.equal(applyColourTransformAlpha(0, [1, 1, 1, 1, 0, 0, 0, 51]), 0.2);
  assert.equal(applyColourTransformAlpha(1, [1, 1, 1, 1, 0, 0, 0, 255]), 1);
  assert.equal(applyColourTransformAlpha(1, [1, 1, 1, 1, 0, 0, 0, -255]), 0);
  assert.equal(applyColourTransformAlpha(0.4, null), 0.4);
});

// ---------------------------------------------------------------------------
// Colour matrices — 636 in the build, 208 of them on the sky.
// ---------------------------------------------------------------------------

test("a colour matrix is twenty finite cells or nothing", () => {
  assert.equal(colourMatrixFrom([1, 2, 3]), null);
  assert.equal(colourMatrixFrom([...IDENTITY_CELLS.slice(0, 19), Number.NaN]), null);
  // The whole filter record is accepted too, because that is what the caller
  // has in hand after `parseFilterList`.
  assert.deepEqual([...colourMatrixFrom({ type: "colourMatrix", matrix: IDENTITY_CELLS })], IDENTITY_CELLS);
  assert.ok(isIdentityColourMatrix(IDENTITY_CELLS));
});

test("the matrix multiplies 0..255 channels and its fifth column is a 0..255 offset", () => {
  // Flash greyscale on pure red: 0.3086 * 255 = 78.693, which rounds to 79 =
  // 0x4f on all three channels. CSS `grayscale(1)` would give 0x36, which is
  // why no shorthand is emitted for this.
  const result = applyColourMatrix("#ff0000", GREYSCALE_CELLS, 1);
  assert.equal(result.fill, "#4f4f4f");
  assert.ok(result.applied);
  assert.equal(result.approximated, null);
});

test("an offset really is in colour space and really is clamped", () => {
  const brighten = [1, 0, 0, 0, 60, 0, 1, 0, 0, 60, 0, 0, 1, 0, 60, 0, 0, 0, 1, 0];
  // 0x10 = 16; 16 + 60 = 76 = 0x4c. 0xf0 = 240; 240 + 60 = 300, clamped to 255.
  assert.equal(applyColourMatrix("#1010f0", brighten, 1).fill, "#4c4cff");
});

test("the alpha COLUMN feeds the colour rows, in 0..255 and not in 0..1", () => {
  // Column 4 (cells 3, 8, 13) is alpha's contribution to red, green and blue.
  // Measured: no matrix in the build uses it — but a reader that scaled alpha
  // as 0..1 here would be 255x wrong the first time one did.
  const alphaIntoRed = [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0];
  assert.equal(applyColourMatrix("#000000", alphaIntoRed, 1).fill, "#ff0000");
  assert.equal(applyColourMatrix("#000000", alphaIntoRed, 0.2).fill, "#330000");
});

test("a matrix whose alpha row is plain is EXACT per fill; one that paints the empty box is not", () => {
  // A real filter runs over the clip's transparent pixels too. If the alpha row
  // is anything but (0,0,0,1,0) the empty area acquires alpha and the filter
  // fills the whole bounding box — which nothing drawing per-fill can express.
  // Measured: all 636 matrices in the build have the plain row, so per-fill
  // application is exact for every one of them.
  assert.ok(colourMatrixIsFillExact(GREYSCALE_CELLS));
  const paintsTheBox = [...GREYSCALE_CELLS.slice(0, 19), 128];
  assert.equal(colourMatrixIsFillExact(paintsTheBox), false);
  assert.equal(applyColourMatrix("#ff0000", paintsTheBox, 1).approximated, "colourMatrixAlphaRow");

  // ► **ALL FIVE CELLS OF THAT ROW, because only the fifth was pinned.** Found
  //   2026-09-14 by mutation: deleting the `cells[15]` term from the predicate
  //   left every test in this file green, and the same is true of 16, 17 and
  //   18 — the assertion above perturbs the OFFSET at 19 and nothing else. A
  //   predicate whose five terms are covered by one is four unexercised
  //   branches wearing a passing test.
  //
  //   Each of the four is a different way for output alpha to stop being input
  //   alpha: 15, 16 and 17 make it depend on RED, GREEN and BLUE, and 18 scales
  //   it. Measured on the oracle, all 636 of the build's matrices have the
  //   plain row, so NONE of these four is reachable from this build — which is
  //   exactly why they need a synthetic fixture rather than a census.
  for (const [index, value, what] of [[15, 0.5, "red feeds alpha"], [16, 0.5, "green feeds alpha"],
    [17, 0.5, "blue feeds alpha"], [18, 0.5, "alpha is scaled"]]) {
    const perturbed = [...GREYSCALE_CELLS];
    perturbed[index] = value;
    assert.equal(colourMatrixIsFillExact(perturbed), false, `cell ${index}: ${what}`);
    assert.equal(applyColourMatrix("#ff0000", perturbed, 1).approximated, "colourMatrixAlphaRow",
      `cell ${index} must be reported as an approximation, not applied silently`);
  }
  // And the tolerance is a tolerance, not a hole: float noise still reads exact.
  const noisy = [...GREYSCALE_CELLS];
  noisy[18] = 1 + 1e-9;
  assert.ok(colourMatrixIsFillExact(noisy), "1e-9 is inside the 1e-6 tolerance and must stay exact");
});

test("a colour matrix on a NON-SOLID fill is reported by name, not quietly skipped", () => {
  for (const fill of ["none", "#abc", null]) {
    const result = applyColourMatrix(fill, GREYSCALE_CELLS, 0.75);
    assert.equal(result.applied, false, `${fill} cannot be matrixed`);
    assert.equal(result.approximated, "colourMatrixOnNonSolidFill");
    assert.equal(result.fill, fill, "the fill comes back untouched rather than mangled");
    assert.equal(result.fillOpacity, 0.75);
  }
});

test("no colour matrix gets a CSS shorthand, and the identity gets no filter at all", () => {
  // CSS has no arbitrary colour matrix; `filter: url(#id)` needs a DOM this
  // layer does not have. Checked against brightness/invert/saturate/grayscale
  // over all 636 in the build: ZERO matches. A detector here would be
  // budgeting for nothing.
  assert.deepEqual({ ...colourMatrixFilterString(IDENTITY_CELLS) }, { filter: null, refused: null });
  const refusal = colourMatrixFilterString(GREYSCALE_CELLS);
  assert.equal(refusal.filter, null);
  assert.equal(refusal.refused, "colourMatrixHasNoCanvasFilter");
  assert.equal(colourMatrixFilterString([1, 2]).refused, "notAColourMatrix");
});

// ---------------------------------------------------------------------------
// Blend modes — twelve placements, four distinct ids, all four expressible.
// ---------------------------------------------------------------------------

test("the four blend modes this build actually uses map exactly", () => {
  // Measured on the oracle: ids 3, 5, 13 and 14 and no others, 12 placements.
  const wanted = { 3: "multiply", 5: "lighten", 13: "overlay", 14: "hard-light" };
  for (const [id, composite] of Object.entries(wanted)) {
    const mapped = blendModeFor(Number(id));
    assert.equal(mapped.composite, composite, `id ${id}`);
    assert.ok(mapped.exact, `id ${id} is exact, not a near miss`);
    assert.equal(mapped.refused, null);
  }
  assert.equal(SWF_BLEND_MODES[14], "hardlight");
});

test("no blend mode and id 0 both mean plain source-over", () => {
  assert.equal(blendModeFor(null).composite, "source-over");
  assert.equal(blendModeFor(undefined).composite, "source-over");
  assert.equal(blendModeFor(0).composite, "source-over");
  assert.equal(blendModeFor(1).composite, "source-over");
});

test("a mode canvas cannot express is REFUSED BY NAME rather than nearest-matched", () => {
  // ► The defect this prevents: `erase` quietly becoming `destination-out`
  //   looks right until the clip is not its own buffer, and then it erases the
  //   whole arena. The near miss is REPORTED so a caller can take it knowingly.
  const erase = blendModeFor(12);
  assert.equal(erase.name, "erase");
  assert.equal(erase.composite, null);
  assert.equal(erase.refused, "blendModeNeedsAGroupBuffer");
  assert.equal(erase.nearest, "destination-out");
  for (const id of [2, 9, 10, 11]) {
    assert.equal(blendModeFor(id).composite, null, `id ${id} must not get a composite`);
    assert.ok(blendModeFor(id).refused, `id ${id} must name its refusal`);
  }
});

test("an UNKNOWN blend mode id refuses instead of falling through to source-over", () => {
  // A silent fallback to normal is the same shape as a silently-empty path: it
  // renders, it looks plausible, and nothing says a mode was lost.
  const unknown = blendModeFor(99);
  assert.equal(unknown.composite, null);
  assert.equal(unknown.refused, "unknownBlendMode");
  assert.equal(unknown.name, null);
});

// ---------------------------------------------------------------------------
// The filter list as a canvas filter string.
// ---------------------------------------------------------------------------

test("sigma is the box-blur variance identity, and passes change it", () => {
  // n box blurs of width d have variance n(d^2-1)/12.
  assert.equal(blurSigma(11, 1), Math.sqrt(10));
  assert.equal(blurSigma(11, 2), Math.sqrt(20));
  assert.equal(blurSigma(1, 1), 0);
  assert.equal(blurSigma(0, 1), 0);
  // A width below one box has no variance to give, and must not go imaginary.
  assert.equal(blurSigma(0.5, 1), 0);
  assert.equal(blurSigma(Number.NaN, Number.NaN), 0);
});

test("blur() takes SIGMA and drop-shadow() takes TWICE it", () => {
  // ► THE DEFECT THIS NAMES: the CSS filter spec defines `blur(R)` with R as a
  //   standard deviation, but `drop-shadow`'s third length as a box-shadow blur
  //   radius, which is 2x the standard deviation. Handing sigma to both — the
  //   obvious move — draws every glow and shadow at half its width.
  const blurred = canvasFilterFor([blurRecord(16)]);
  const glowed = canvasFilterFor([glowRecord({ blurX: 16, blurY: 16, distance: 0, angle: 0 })]);
  const sigma = lengthsIn(blurred.filter)[0];
  const shadowRadius = lengthsIn(glowed.filter)[2];
  assert.ok(sigma > 0, "a 16-pixel box blur has a real sigma");
  // Compared with a tolerance, and the tolerance is NAMED rather than nudged
  // until green: the emitter rounds every length to four decimals
  // INDEPENDENTLY, so `2 * sigma` is rounded from the doubled value and not
  // doubled from the rounded one. The first draft of this test asserted exact
  // equality and went red at 9.2195 against 9.2196 — a formatting artefact,
  // not a wrong radius. What is under test is the RELATIONSHIP.
  assert.ok(Math.abs(shadowRadius - 2 * sigma) <= 2e-4, `${shadowRadius} is not twice ${sigma}`);
});

test("a drop shadow's distance and angle become dx and dy", () => {
  // Every one of the build's 31 shadows sits at pi/4, so dx and dy are equal
  // and are distance/sqrt(2) — not distance.
  const result = canvasFilterFor([shadowRecord({ distance: 8, angle: Math.PI / 4, blurX: 0, blurY: 0 })]);
  const [dx, dy] = lengthsIn(result.filter);
  assert.ok(Math.abs(dx - 8 / Math.SQRT2) < 1e-3, `dx was ${dx}`);
  assert.ok(Math.abs(dy - dx) < 1e-6, "pi/4 makes dx and dy equal");
});

test("scale multiplies every length in the string, because ctx.filter ignores the transform", () => {
  const plain = canvasFilterFor([shadowRecord({ distance: 8, blurX: 16, blurY: 16 })]);
  const doubled = canvasFilterFor([shadowRecord({ distance: 8, blurX: 16, blurY: 16 })], { scale: 2 });
  const before = lengthsIn(plain.filter);
  const after = lengthsIn(doubled.filter);
  assert.equal(before.length, 3);
  for (let index = 0; index < before.length; index += 1) {
    assert.ok(Math.abs(after[index] - 2 * before[index]) < 1e-3, `length ${index} did not double`);
  }
});

test("Blur(0,0) is a COUNTED no-op rather than blur(0px)", () => {
  // 126 of the build's 320 blurs are Blur(0,0). Emitting `blur(0px)` would be
  // honest and would still force a filtered compositing path for no pixels; a
  // silent drop would be neither. So it is dropped AND counted.
  const result = canvasFilterFor([blurRecord(0, 0)]);
  assert.equal(result.filter, null);
  assert.deepEqual(result.noOps.map((entry) => entry.reason), ["zeroRadius"]);
  assertPartitions(result, [blurRecord(0, 0)]);
});

test("a zero-strength glow is a COUNTED no-op", () => {
  // Measured: 208 of the build's 853 glows carry strength 0, which is an
  // invisible glow. Strength multiplies the glow's alpha, so zero means gone.
  const records = [glowRecord({ strength: 0 })];
  const result = canvasFilterFor(records);
  assert.equal(result.filter, null);
  assert.deepEqual(result.noOps.map((entry) => entry.reason), ["zeroStrength"]);
  assertPartitions(result, records);
});

test("strength is folded into the shadow's alpha and SAID to be an approximation", () => {
  // Flash re-multiplies the filtered alpha and clamps; a CSS colour can only
  // scale its own alpha. 277 of the build's glows are at strength 10, which
  // saturate to opaque here, and all 31 of its shadows are below 1.
  const weak = canvasFilterFor([shadowRecord({ strength: 0.25, blurX: 0, blurY: 0, distance: 0, angle: 0 })]);
  assert.match(weak.filter, /rgba\(0, 0, 0, 0\.25\)/);
  assert.equal(weak.applied[0].approximated, "shadowStrengthAsAlpha");
  const strong = canvasFilterFor([glowRecord({ strength: 10, blurX: 0, blurY: 0 })]);
  assert.match(strong.filter, /rgba\(255, 0, 0, 1\)/, "strength 10 saturates rather than exceeding 1");
});

test("an isotropic blur and an anisotropic one are approximated under DIFFERENT names", () => {
  // CSS blur is isotropic, so a blur whose two radii differ loses the
  // difference. Only 2 filters in the build are anisotropic, which is exactly
  // the kind of rarity that gets lost inside a single "approximated" flag.
  assert.equal(canvasFilterFor([blurRecord(16, 16)]).applied[0].approximated, "boxBlurAsGaussian");
  assert.equal(canvasFilterFor([blurRecord(16, 4)]).applied[0].approximated, "anisotropicBlur");
});

test("an INNER glow is refused by name, because CSS drop-shadow has no inset", () => {
  // 3 inner glows in the build, plus 54 inner bevels refused separately below.
  const records = [glowRecord({ inner: true })];
  const result = canvasFilterFor(records);
  assert.equal(result.filter, null);
  assert.deepEqual(result.refused.map((entry) => entry.reason), ["innerShadowHasNoCanvasFilter"]);
  assertPartitions(result, records);
});

test("knockout and a suppressed source are refused, not drawn as an ordinary shadow", () => {
  // Zero of each in the build — so this arm has never been exercised against
  // the oracle and is a named refusal rather than a guess at what they look like.
  for (const overrides of [{ knockout: true }, { compositeSource: false }]) {
    const result = canvasFilterFor([glowRecord(overrides)]);
    assert.equal(result.filter, null);
    assert.equal(result.refused[0].reason, "knockoutHidesTheSource");
  }
});

test("a bevel is refused by name — the only refused filter this build contains", () => {
  // 54 bevels, all of them inner, across 3 sprites. Canvas has no bevel and no
  // combination of its filters is one.
  const records = [{ type: "bevel", filterId: 3, blurX: 4, blurY: 4, strength: 1, inner: true }];
  const result = canvasFilterFor(records);
  assert.equal(result.filter, null);
  assert.deepEqual(result.refused.map((entry) => entry.type), ["bevel"]);
  assert.equal(result.refused[0].reason, "filterHasNoCanvasEquivalent");
  assertPartitions(result, records);
});

test("the three filters this build does NOT contain get a refusal, never a mapper", () => {
  // gradientGlow, convolution and gradientBevel occur ZERO times in the oracle.
  // Writing arithmetic for them would be the "zero focal gradients" mistake
  // with different nouns; refusing them by name costs one branch and keeps the
  // mapper total, so an unknown record can never silently become no filter.
  const records = [
    { type: "gradientGlow", filterId: 4 },
    { type: "convolution", filterId: 5 },
    { type: "gradientBevel", filterId: 7 },
    { notAFilter: true }
  ];
  const result = canvasFilterFor(records);
  assert.equal(result.filter, null);
  assert.deepEqual(
    result.refused.map((entry) => entry.reason),
    ["filterHasNoCanvasEquivalent", "filterHasNoCanvasEquivalent", "filterHasNoCanvasEquivalent", "notAFilterRecord"]
  );
  assertPartitions(result, records);
});

test("a colour matrix is DEFERRED and handed back whole, not refused and lost", () => {
  // "Refused as a filter string" and "cannot be drawn at all" are different
  // facts. The matrix goes to `applyColourMatrix`, so it must survive the trip.
  const records = [{ type: "colourMatrix", filterId: 6, matrix: GREYSCALE_CELLS }];
  const result = canvasFilterFor(records);
  assert.equal(result.filter, null);
  assert.equal(result.refused.length, 0);
  assert.deepEqual(result.deferred.map((entry) => entry.reason), ["applyColourMatrixToTheFill"]);
  assert.deepEqual([...result.colourMatrices[0]], GREYSCALE_CELLS);
  assertPartitions(result, records);
});

test("an IDENTITY colour matrix is a no-op and is not deferred to the fill", () => {
  // 12 of the build's 636 are the identity. Deferring them would make every
  // fill take the matrix path to come back unchanged.
  const records = [{ type: "colourMatrix", filterId: 6, matrix: IDENTITY_CELLS }];
  const result = canvasFilterFor(records);
  assert.equal(result.colourMatrices.length, 0);
  assert.deepEqual(result.noOps.map((entry) => entry.reason), ["identityMatrix"]);
  assertPartitions(result, records);
});

test("a malformed colour matrix is refused rather than applied as garbage", () => {
  const records = [{ type: "colourMatrix", filterId: 6, matrix: [1, 2, 3] }];
  const result = canvasFilterFor(records);
  assert.deepEqual(result.refused.map((entry) => entry.reason), ["malformedColourMatrix"]);
  assertPartitions(result, records);
});

test("a MIXED list partitions every record into exactly one bucket", () => {
  // The shape the sky actually has: blurs, glows and colour matrices together,
  // with no-ops and a refusal among them. This is the invariant the census
  // rests on — over all 1,894 records in the oracle it partitions
  // 867 / 624 / 346 / 57, which sums to 1,894.
  const records = [
    blurRecord(11), blurRecord(0, 0),
    glowRecord({ strength: 10 }), glowRecord({ strength: 0 }), glowRecord({ inner: true }),
    shadowRecord(),
    { type: "colourMatrix", filterId: 6, matrix: GREYSCALE_CELLS },
    { type: "colourMatrix", filterId: 6, matrix: IDENTITY_CELLS },
    { type: "bevel", filterId: 3 }
  ];
  const result = canvasFilterFor(records);
  assertPartitions(result, records);
  assert.equal(result.counts.applied, 3, "one blur, one glow and one shadow reach the string");
  assert.equal(result.counts.deferred, 1);
  assert.equal(result.counts.noOp, 3);
  assert.equal(result.counts.refused, 2);
  assert.equal(result.filter.split(") ").length, 3, "three filter functions in the string");

  // ► **`approximated` EQUALS `applied` IDENTICALLY, AND THAT IS AN INVARIANT
  //   OF THIS MAPPER RATHER THAN A COINCIDENCE OF THIS FIXTURE.** Found
  //   2026-09-14 by mutation: computing `approximated` as a bare
  //   `applied.length` left the whole suite green, because no branch in
  //   `canvasFilterFor` pushes `exact: true` — every CSS blur is a Gaussian
  //   standing in for box blurs and every drop-shadow carries that plus the
  //   sigma-to-radius doubling. Asserting the identity is the honest version
  //   of that fact: if someone adds a genuinely exact filter the line goes red
  //   and the header paragraph claiming otherwise gets rewritten, instead of
  //   quietly outliving the code.
  assert.equal(result.counts.approximated, result.counts.applied,
    "every filter this mapper can express is an approximation; none is exact");
  assert.equal(result.applied.every((entry) => entry.exact === false), true);
  assert.equal(result.applied.every((entry) => typeof entry.approximated === "string"), true,
    "and each names WHICH approximation, which is the part that discriminates");
});

test("a zero or negative scale falls back to 1 rather than emitting blur(-5px)", () => {
  // ► **UNPINNED UNTIL 2026-09-14.** Found by mutation: relaxing the guard
  //   from `Number.isFinite(scale) && scale > 0` to `Number.isFinite(scale)`
  //   left the whole suite green. A negative scale would produce
  //   `blur(-5.5px)` and negative shadow offsets — a filter string a browser
  //   drops on the floor, silently, which is exactly the failure mode this
  //   module's four buckets exist to make impossible. Nothing in this tree
  //   passes a negative scale today; `stageFitFor` returns a positive one.
  const records = [blurRecord(11), shadowRecord()];
  const reference = canvasFilterFor(records, { scale: 1 });
  for (const scale of [0, -1, -2.5, Number.NaN, undefined, "2"]) {
    assert.equal(canvasFilterFor(records, { scale }).filter, reference.filter,
      `scale ${String(scale)} must fall back to 1`);
  }
  assert.equal(/-\d/.test(canvasFilterFor(records, { scale: -2 }).filter), false,
    "and no length in the string is negative");
  // The guard is a guard, not a cap: a real scale still multiplies.
  assert.notEqual(canvasFilterFor(records, { scale: 2 }).filter, reference.filter);
});

test("no filters at all is an empty result, not a thrown error or a bogus string", () => {
  // A missing or truncated pack must leave the arena playable, which is the
  // arrangement `props.js` and `sound.js` already have.
  for (const input of [null, undefined, [], "filters", 7]) {
    const result = canvasFilterFor(input);
    assert.equal(result.filter, null, `${input} yields no filter string`);
    assert.equal(result.counts.total, 0);
  }
});

test("the summary adds up and buckets refusals and approximations BY NAME", () => {
  // A manifest that prints one "approximated" total cannot be read: 54 bevels
  // and 3 inner glows are different problems. `extraction-honesty.test.js`
  // recomputes a manifest's tallies from the pack's own data, so the totals a
  // human reads have to come from these same records.
  const first = canvasFilterFor([blurRecord(11), { type: "bevel", filterId: 3 }]);
  const second = canvasFilterFor([glowRecord({ inner: true }), glowRecord({ strength: 2 }), blurRecord(0, 0)]);
  const summary = summariseFilterUse([first, second]);
  assert.equal(summary.total, 5);
  assert.equal(summary.applied, 2);
  assert.equal(summary.refused, 2);
  assert.equal(summary.noOp, 1);
  assert.equal(summary.approximated, 2);
  assert.deepEqual(summary.refusedByReason, {
    "bevel:filterHasNoCanvasEquivalent": 1,
    "glow:innerShadowHasNoCanvasFilter": 1
  });
  assert.deepEqual(summary.approximatedByKind, { boxBlurAsGaussian: 1, shadowStrengthAsAlpha: 1 });
});

test("the summary ignores junk instead of inventing totals from it", () => {
  const summary = summariseFilterUse([null, { counts: null }, canvasFilterFor([blurRecord(11)])]);
  assert.equal(summary.total, 1);
  assert.equal(summary.applied, 1);
  assert.equal(summariseFilterUse("not a list").total, 0);
});

test("every result is frozen, so a caller cannot edit a count into agreeing with itself", () => {
  // The counts are evidence. A consumer that could push a refusal out of the
  // list would be doing exactly what this programme exists to prevent.
  const result = canvasFilterFor([blurRecord(11), { type: "bevel", filterId: 3 }]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.counts));
  assert.ok(Object.isFrozen(result.refused));
  assert.ok(Object.isFrozen(applyColourMatrix("#ff0000", GREYSCALE_CELLS, 1)));
  assert.ok(Object.isFrozen(blendModeFor(3)));
});
