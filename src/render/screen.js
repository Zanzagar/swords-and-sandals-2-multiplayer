/**
 * THE TWENTY-SIX SCREENS, DRAWN — the splash, the town, the shops, the church,
 * the dungeon, the level-up and the arena, out of the pack
 * `tools/extract-screens.mjs` writes and onto the same 640 x 420 stage
 * `arena-backdrop.js` already defines.
 *
 * ## Why this file exists at all
 *
 * `assets/screens/` has been written and read by NOTHING. A pack no renderer
 * consumes is indistinguishable from a pack that is wrong, which is the same
 * argument `extraction-honesty.test.js` makes about an uncounted
 * approximation: the only thing that proves an extraction describes the build
 * is something drawing it.
 *
 * ## THE PACK IS AN ARGUMENT, NEVER A TABLE IN THIS FILE
 *
 * Identical arrangement to `props.js`, `sound.js` and `extracted-figure.js`,
 * and for the identical reason: this repository ships no SS2 asset, so a clone
 * with no licensed copy gets `null` from every function here and the caller
 * falls back to its own authored art. Every reader below is TOTAL — a missing,
 * truncated or hand-edited pack returns null or an empty list and never throws.
 * The fallback is the supported path, not an error path.
 *
 * ## UNITS, AND THIS SEAM HAS COST THIS PROJECT THREE DEFECTS
 *
 * ► **A placement matrix is `[a, b, c, d, tx, ty]` with `tx`/`ty` in TWIPS**
 *   (20 per pixel) and **everything the matrix acts on in PIXELS** — the path
 *   `d` data, a text run's box, its font height, its advances. That is not two
 *   conventions fighting; it is one. Inside `context.transform(a, b, c, d,
 *   tx / 20, ty / 20)` the space is pixels, so every number that lives inside
 *   that transform is in pixels and only the translation is not.
 *
 *   `tools/arena/main.js` already divides `matrix[4]`/`matrix[5]` by 20 for
 *   every operation `props.js` hands it, and the operations below are the same
 *   shape, so they need no new painter code. **A text entry's `box`,
 *   `fontHeight`, `x`, `y` and `advances` are converted to pixels HERE** — the
 *   pack states them in twips — precisely so that a caller never has to hold
 *   two units for one object.
 *
 * ## STAGE SPACE, AND WHY A SCREEN NEEDS NO PLACEMENT
 *
 * The extractor flattens the ROOT display list, so a drawable's matrix is
 * already composed from the root down to the leaf. A screen therefore sits on
 * the stage at the identity — `SCREEN_STAGE_PLACEMENT` — and the only thing
 * between these operations and a canvas is `stageFitFor` from
 * `arena-backdrop.js`, which letterboxes the 640 x 420 stage into whatever the
 * surface is. `SS2_STAGE` is imported rather than restated for the same
 * reason: a second copy of the stage is a second thing to get wrong.
 *
 * ## WHAT A SCREEN IS
 *
 * A moment on the root timeline, taken AT its FrameLabel. The root never clears
 * its display list, so each screen is the chrome placed at frame 1 plus its own
 * objects. Measured on this pack: all 26 screens carry depth 1 (character 643),
 * depth 438 (character 1531, `fiz_info_panel`) and depth 1193 (character 646).
 * `SCREEN_CHROME` names them and `splitScreenChrome` separates them, because a
 * caller compositing a screen over a live arena wants the border and the UI bar
 * and not a second backdrop.
 *
 * ► **AND DEPTH 1 DRAWS NOTHING ON ANY OF THE 26.** Its placement carries
 *   `alphaMultiplier = 0`, measured on all 26 screens in this pack, so the
 *   operation below resolves to `fillOpacity: 0` and the painter puts no
 *   pixels down. **That is the build's behaviour and not a bug to fix here** —
 *   `extract-screens.mjs` documents the byte offsets — but it is also exactly
 *   what a blank screen looks like, so it is counted as `invisibleOps` rather
 *   than left for somebody to rediscover. Note that
 *   `SS2_ARENA_SCREEN_LAYERS` in `arena-backdrop.js` still declares character
 *   643 as the arena's `backdrop` layer; the two readings disagree and the
 *   root placement is the one that has the transparency in it.
 *
 * ## WHAT THIS MODULE CANNOT DRAW, COUNTED BY KIND
 *
 * **An approximation that is not counted is indistinguishable from a correct
 * read**, and dropping the extractor's tallies at this seam is the defect that
 * has now recurred six times on this project. So `screenFor` is the primary
 * entry point and it returns the counts BESIDE the operations, in one record,
 * where a caller cannot take the picture without the invoice:
 *
 *   `unresolvedByKind`  the extractor's own three kinds, carried through
 *                       unchanged — `text-static`, `text-edit` and
 *                       `button-hit-area-only`. Measured across the 26 screens:
 *                       70, 117 and 18, summing to the 205 the manifest states.
 *   `text`              the 187 text placements the drawing half cannot show,
 *                       WITH their words, boxes, fonts and colours, so a
 *                       surface that has a face can set them. Not path
 *                       operations: no glyph outlines are in this pack.
 *   `approximations`    recomputed at THIS seam from the operations actually
 *                       emitted, not copied from the manifest — a tally that
 *                       merely echoes another tally checks nothing.
 *   `approximations.fromPack`  the extractor's own block, verbatim, so its
 *                       numbers and this file's can be compared rather than
 *                       conflated.
 *   `blankets`          **THE COUNT THAT POINTS THE OTHER WAY.** Everything
 *                       above counts what was NOT drawn; this is the roster of
 *                       operations that were drawn OVER EVERYTHING ELSE. Seven
 *                       across the 26 screens, and five of them are a nested
 *                       sprite frozen at frame 1 with its curtain down —
 *                       `townsquare` emits 1638 operations, paints nearly all
 *                       of them, and op 1632 is an opaque black rectangle the
 *                       size of the stage. The invoice read clean for a week.
 *                       See `stageBlanketsOf`.
 *
 * ~~The loudest of those numbers: **9423 of the 13638 path operations across
 * the 26 screens sit under a placement carrying a FILTERLIST that nothing
 * applies** — 69%. Drop shadows and glows are missing everywhere and the
 * picture is otherwise right, which is exactly the kind of wrongness that
 * reads as finished.~~ **SUPERSEDED 2026-09-15 — see FILTER GROUPS below.**
 * 9423 is still the right number and it is still reported, under the name it
 * deserves (`opsUnderFilterGroup`); what changed is that this module now hands
 * a painter the filters themselves, so "nothing applies" stopped being a
 * property of this file and became a property of whatever draws it.
 *
 * ## FILTER GROUPS — THE PART OF A FILTER THAT IS NOT A PROPERTY OF A LEAF
 *
 * ► **FLASH RASTERISES A FILTERED GROUP AND FILTERS THE COMPOSITE.** So a
 *   filter belongs to a SUBTREE, never to the paths inside it, and the obvious
 *   implementation — stamp the filter string onto each operation and let the
 *   painter set `ctx.filter` per operation — is not a rough version of the
 *   right picture, it is a different picture that looks plausible. Measured on
 *   this pack: `townsquare`'s placement at path `[59,1]` covers **1523 of its
 *   1638 operations**. Blurring 1523 paths one at a time blurs 1523 internal
 *   seams that do not exist in the build's own rasterisation. That is why the
 *   record carries `filterGroups` and why nothing here writes a filter string
 *   onto an operation.
 *
 * ► **AND UNTIL 2026-09-15 THIS FILE READ ONLY `entry.path` OFF
 *   `filteredPlacements` AND THREW `entry.filters` AWAY.** Its output was
 *   therefore invariant under those typed filter records being correct,
 *   garbage or absent — the synthetic fixture in `test/render-screen.test.js`
 *   had no `filters` key at all and every assertion stayed green. A count that
 *   cannot vary with the data it describes is not a reading of the data.
 *
 * ### WHAT A GROUP CARRIES, AND THE THREE DECISIONS IN IT
 *
 * 1. **A GROUP NAMES ITS OPERATIONS BY A HALF-OPEN RANGE `[opFirst, opEnd)`
 *    INTO `ops`, WITH ITS `path` BESIDE IT AS THE AUTHORITY.** The alternative
 *    was a list of indices, or the path alone with the painter re-matching
 *    every frame. **The cost of the range is that it is an index into an array
 *    and an index can go stale; what pays for it is that it is DERIVED, in
 *    this same call, from the very `ops` array it indexes** — `ops` is frozen
 *    before it leaves, and both are rebuilt by every `screenFor` call, so the
 *    range cannot drift from the operations the way a cached one could. What
 *    it CANNOT survive is a caller that re-sorts or filters `ops` itself;
 *    `splitScreenChrome` does exactly that, and a caller compositing the two
 *    halves separately must re-match on `path` rather than reuse the range.
 *    Measured on this pack: all 135 groups that reach an operation are
 *    CONTIGUOUS in `ops` — the extractor emits drawables in path order, so a
 *    subtree is a run — and `contiguous` on each group says so rather than
 *    being assumed. When it is false the range still BRACKETS the group and
 *    the painter must re-match; `filterGroupsNotContiguous` counts it.
 *
 * 2. **NESTING COMPOSES UP THE TREE. IT DOES NOT PICK A WINNER, AND THAT IS A
 *    DIFFERENT ANSWER FROM `blendFor` TWENTY LINES AWAY.** A blend mode is a
 *    compositing operator for one draw, so the innermost is the one actually
 *    compositing the leaf and the outer one is not a second chance to blend.
 *    A filter is a rasterise-then-transform, and the outer group's filter
 *    applies to the RESULT of the inner one, so neither wins. **Measured
 *    before choosing, because a rule chosen on unreachable data is a rule
 *    nobody has tested: 5395 of the 13638 operations across the 26 screens sit
 *    under exactly TWO filtered ancestors — 40% — and none under three.** The
 *    case that settles it is `townsquare` again: `[59,1]` is a COLOUR MATRIX
 *    over 1523 operations and `[59,1,3]`, `[59,1,8]`, `[59,1,317]` and
 *    `[59,1,319]` are blurs nested inside it. "Innermost wins" would silently
 *    drop the town's entire colour grade from 1523 operations while leaving
 *    four small blurs in place, and the picture would look finished. So each
 *    group carries `parent` and `children` and the painter walks the tree.
 *
 * 3. **`filter` IS THE SCALE-1 STRING AND `filters` IS THE RECORD. A PAINTER
 *    DRAWING THE STAGE AT ANY OTHER SCALE MUST RECOMPUTE.** `ctx.filter`
 *    lengths are NOT scaled by `ctx.setTransform` (see `filters.js`, where the
 *    `scale` parameter and the fact that it is a hypothesis are both stated),
 *    and `stageFitFor` letterboxes this 640 x 420 stage into whatever the
 *    surface is, so the scale is almost never 1. Baking one scale in here
 *    would ship every blur at the wrong width. The BUCKETS —
 *    `applied` / `deferred` / `noOps` / `refused` — are scale-INVARIANT
 *    (`scale` only multiplies lengths, and every classification in
 *    `canvasFilterFor` is made before the factor is applied), so only the
 *    string has to be rebuilt. That invariance is pinned by a test rather than
 *    left as a reading.
 *
 * ### WHAT A PAINTER HAS TO DO WITH THEM
 *
 * Draw `ops` in order. On reaching `group.opFirst` for a group with no parent,
 * rasterise that group's whole range to an offscreen — recursing into each
 * child at ITS `opFirst`, filtering the child's offscreen and compositing it
 * in — then apply the group's own `filter` to the finished offscreen and
 * composite it onto the stage, and resume at `group.opEnd`. Operations in no
 * group's range are drawn straight. **`colourMatrices` on a group is NOT in
 * `filter`**: it is deferred to `applyColourMatrix`, and a painter that only
 * reads `filter` draws `townsquare`'s 1523-operation group ungraded while
 * reporting that it applied the filters. Measured: 57 of the 248 groups carry
 * a colour matrix and **31 of those 57 produce no filter string at all**, so a
 * painter that skips null-`filter` groups skips 31 groups entirely — and
 * `opsWithDeferredColourMatrix` (8850 operations) is larger than
 * `opsWithCanvasFilter` (6440), which is the opposite of what "drop shadows
 * and glows are missing" led this project to expect.
 *
 * ► **NOTHING IS STAMPED ON AN OPERATION, DELIBERATELY.** A `filterGroup`
 *   index on each op would make the per-operation `ctx.filter` loop the
 *   easiest thing to write, and that loop is the wrong picture. The only mark
 *   an operation carries is the boolean `filtered`, which answers "is this
 *   inside something" and cannot be mistaken for "here is how to draw it".
 *
 * ### THE 108 GROUPS THAT REACH NO OPERATION AT ALL — 44% OF THE ROSTER
 *
 * ► **107 of them are GLOWS ON TEXT, and the 108th is a placement whose filter
 *   list is EMPTY.** Re-derived 2026-09-15 against this pack: of the 243
 *   filtered placements on the 26 screens, 108 cover zero operations, and
 *   every one of the 108 resolves to `text-edit` (92) or `text-static` (16)
 *   entries in that screen's own `unresolved` list. `screen.js` emits no text,
 *   so a glow on a text field reaches no drawable here. Characters 1527 and
 *   1528 — the two on every screen's `fiz_info_panel`, and 52 of the 243
 *   placements are one of them — are the same pair `props.js` records under
 *   `effects.own.dropped` on the arena's `panel`, one glow each with no shape
 *   in the pack to put it on. `text.js` names them: two `DefineEditText`
 *   children of sprite 1531, `soundvar` and `tooltips_text`. **Three modules
 *   have now met the same two characters from three directions**, which is
 *   worth more than any one of them saying it.
 *   **This is not a defect in this file and it is not this file's to fix**
 *   (`screen-text.js` is the join), **but it is this file's to COUNT**, or the
 *   invoice cannot tell "no filters here" from "filters that reach nothing I
 *   emit". `filterGroupsReachingNothing` and its by-kind breakdown are that
 *   count, with `filterGroups` as the denominator. **The roster totals: 248
 *   groups, 135 reaching an operation, 113 reaching none** — 92 `text-edit`
 *   and 21 `text-static`, the extra five being the button records below.
 *
 * ► **AND THE FIVE `filteredButtonRecords` ARE IN THE ROSTER TOO.** All five
 *   are on `townsquare`, all five have `leaf: "text"`, and all five reach zero
 *   operations. They are a SECOND source of filters in the pack, and a roster
 *   built only from `filteredPlacements` would have left them invisible rather
 *   than counted — which is the defect this whole file is arranged against.
 *   `source` on each group says which list it came from.
 *
 * ## COLOUR TRANSFORMS ARE APPLIED HERE, AND THAT IS DELIBERATE
 *
 * 287 of the 780 drawables carry one. Flash computes
 * `clamp(channel * multiplier + offset)`, which is affine per channel, so it
 * folds exactly into a flat fill's colour and opacity and into each gradient
 * stop's — and folding it here means the existing painter draws a screen with
 * no new code at all. Two cases do NOT fold and are counted:
 *
 * - a BITMAP fill has no colour in the operation to fold into, so only the
 *   alpha survives, into `fillOpacity`. Measured on this pack: **0 bitmap
 *   fills sit under an RGB colour transform**, so nothing is currently lost —
 *   `bitmapColourTransformDropped` is the count that would say so if that
 *   changed. ► **RE-MEASURED 2026-09-14 WITH THE DENOMINATOR, because "0" with
 *   no denominator does not say whether the counter is silent or dead:** 29
 *   bitmap paths across the 26 screens, 8 of them under a colour transform,
 *   and all 8 under the SAME transform `[1,1,1,0.19921875,0,0,0,0]` — shape
 *   718 on splash, new_or_continue, credits, help, gameover, bugs,
 *   gameover_demo and enter_highscore. So the counter is DEAD on real data,
 *   not merely quiet, and `touchesRgb` never returns true outside a synthetic
 *   fixture. See its own comment below for which half of it was pinned by
 *   nothing at all until `test/render-screen.test.js`'s `tintPack` landed.
 * - a non-zero `alphaOffset` on a gradient whose stops differ in opacity is
 *   not equivalent to transforming the stops, because a canvas ramp
 *   interpolates between them. Measured: **no drawable on any of the 26
 *   screens has a non-zero `alphaOffset` at all**, so every gradient here
 *   folds exactly. `gradientAlphaOffsetApproximated` counts the other case.
 *
 * ► **AND THE RGB HALF OF THE GRADIENT FOLD IS UNREACHABLE ON THIS PACK, which
 *   is a stronger statement than "it folds exactly" and was not being made.**
 *   Measured 2026-09-14: 21 gradient paths sit under a colour transform,
 *   carrying 107 stops between them, and **all 107 are under ALPHA-ONLY
 *   transforms** — four distinct ones, every RGB multiplier 1 and every RGB
 *   offset 0. So `transformGradient`'s `fill: applyColourTransform(...)` is
 *   held at the identity by every screen in the build. Deleting that call
 *   outright left `test/render-screen.test.js` at 36 pass / 0 fail and left
 *   the sha256 of all 13638 operations and their tallies across the 26 screens
 *   BYTE-IDENTICAL. **A digest over data that cannot vary is not evidence** —
 *   which is a statement about how the 2026-09-14 fold was argued, not about
 *   gradients, and the same question is worth asking of every count in this
 *   file. `tintPack` in the test file now reaches the case the build does not.
 *
 * ## THIS FILE'S COLOUR TRANSFORM WAS A DUPLICATE. THERE IS NOW ONE.
 *
 * ► **FOLDED ONTO `src/render/filters.js` 2026-09-14.** The RGB half is
 *   `applyColourTransform`, the alpha half is `applyColourTransformAlpha`, and
 *   this file's own `channelOf` and its private `transformFill` /
 *   `transformOpacity` wrappers are gone. The import at the top of this file
 *   had been sitting here UNUSED since filters.js landed: the two
 *   implementations were written in the same session by sibling agents,
 *   neither importing the other, exactly as happened to `indexFonts` and
 *   `parseEditText` in `tools/extract-screens.mjs`, whose header records it.
 *   An import of a thing a file never calls is what that looks like afterwards.
 *
 * ► **THE FOLD WAS MEASURED TO MOVE NOTHING, and measurement is the only
 *   thing that licenses a quiet fold.** Every value this module hands to the
 *   transform was run through both implementations on the real pack: 27786
 *   fill sites across the 26 screens, of which **1023 are hex fills sitting
 *   under a colour transform**, and 27786 alpha sites. **0 differ.** The whole
 *   emitted operation list — fills, stops, opacities, matrices, counts —
 *   digests identically before and after. A fold argued from reading rather
 *   than counted is the fold that moves a pixel.
 *
 *   ► **AND HERE IS WHAT THAT DIGEST IS BLIND TO, WRITTEN AT THE CLAIM RATHER
 *     THAN UNDER IT. A digest over data that cannot vary is not evidence.**
 *     Re-measured 2026-09-14: only **693 of those 1023** sit under a transform
 *     that moves red, green or blue at all. The other **330 are under
 *     ALPHA-ONLY transforms** — 223 flat fills and strokes, plus **every one of
 *     the 107 transformed gradient stops** — and for each of them both
 *     implementations return the input unchanged, under either rounder, by
 *     construction. The same split runs through the alpha half: 1274 of the
 *     1955 opacity comparisons are under `alphaMultiplier === 1,
 *     alphaOffset === 0`.
 *
 *     So the digest genuinely proves the fold moved nothing THAT THIS PACK CAN
 *     REACH, and proves nothing at all about the lines the pack holds at the
 *     identity — which is how `transformGradient`'s stop-fill transform came to
 *     be pinned by no assertion in the suite. **A count of values compared is
 *     not a count of values that could have differed**, and the same question
 *     is worth putting to every tally in this file. The rewritten real-pack
 *     test now asserts the split, and `tintPack` covers what the pack cannot.
 *
 * ► **THE DISAGREEMENT THIS REPLACES, KEPT BECAUSE IT IS THE EVIDENCE.** The
 *   two did once disagree, because filters.js ROUNDED: **69 of those 1023 hex
 *   fills came out ONE UNIT apart.** `#ffffff` under multiplier 0.30078125
 *   with blueOffset 36 is `#4c4c70` floored and `#4d4d71` rounded. Re-measured
 *   2026-09-14 against the same pack: still 69, still those values, and they
 *   fall on 13 of the 26 screens with 43 of them on `dungeon` alone.
 *   `test/render-screen.test.js` now pins the 69, the 1023 and that hex
 *   against the real pack, so a silent return to rounding turns the suite red
 *   instead of shifting every tinted screen by one unit.
 *
 * ► **FLOOR WON, AND THE WIRE SETTLED IT RATHER THAN TASTE.**
 *   `readColourTransform` in `tools/swf-display-list.mjs` reads the multiply
 *   term as `readSB(bits) / 256`, so it is SIGNED 8.8 fixed point and the
 *   player computes `(channel * multTerm) >> 8` — an ARITHMETIC shift, which
 *   rounds toward NEGATIVE INFINITY. `Math.floor` reproduces that; `Math.round`
 *   does not; `Math.trunc` parts company the moment a multiplier goes negative,
 *   which the signed field permits. **On THIS pack the trunc/floor distinction
 *   is latent and not exercised** — measured, every RGB multiplier is one of
 *   0, 0.30078125, 0.5078125, 0.55859375 or 1, and no multiplier anywhere is
 *   negative, so trunc and floor agree on all 1023. Worth knowing before
 *   someone "simplifies" floor back to trunc on the evidence of a green suite.
 *
 * ► **THE ALPHA HALF IS FLOATING POINT ON PURPOSE, and that survived the
 *   fold.** `applyColourTransformAlpha` multiplies in 0..1 and divides the
 *   offset by 255 rather than reconstructing a byte and truncating it, which
 *   is right HERE for a reason that is a property of this pack rather than of
 *   the wire: `shapeToPaths` has already rounded every opacity to three
 *   decimals before it reaches `assets/screens/screens.json`, so the number
 *   this module holds is not the build's alpha byte and cannot be turned back
 *   into one. Truncating it would be false precision dressed as fidelity. The
 *   unit hazard that arithmetic carries — a 0..1 opacity against a 0..255
 *   offset — is the same class of error as mixing twips and pixels, and both
 *   are named in this header.
 *
 * ► **WHAT DELIBERATELY DID NOT FOLD.** `touchesRgb` below has no counterpart
 *   in filters.js. `colourTransformApplies` there answers "would this change
 *   THIS fill"; the question `bitmapColourTransformDropped` has to ask is
 *   "does this transform carry colour a raster has nowhere to put", which is a
 *   property of the transform alone and has no fill in it.
 *
 * ► **AND THE FOLD FIXED A LATENT DEFECT NOBODY HAD HIT.** A colour transform
 *   exists in this tree in TWO shapes — the named object
 *   (`redMultiplier` … `alphaOffset`) that `tools/extract-props.mjs` and this
 *   screens pack write, and the eight-number ARRAY that
 *   `tools/extract-figure.mjs` writes. The deleted `transformFill` read the
 *   named fields off whatever it was given, so an array-shaped transform read
 *   as all-undefined, fell through `numberOr` to the identity, and was
 *   DROPPED IN SILENCE — no tint and no tally, this project's standing defect
 *   wearing a new hat. `colourTransformFrom` accepts both shapes. Measured:
 *   this pack carries 0 array-shaped transforms, so nothing was ever actually
 *   lost; the hole was real and unexercised.
 *
 * ## A SCREEN IS ONE FRAME, AND TWO OF THE TWENTY-SIX MOVE
 *
 * The pack holds the label frame only. `stillness` carries the extractor's
 * measurement of whether the rest of that label's range agrees: `splash`
 * differs on 24 of its frames (the UI bar shifts 10 twips at frame 11) and
 * `church` on 1 (depth 59, the church itself, is removed at frame 202). The
 * other 24 are identical throughout. A renderer that assumed stillness would
 * be silently wrong twice, so the number travels with the picture.
 */

import { SS2_STAGE } from "./arena-backdrop.js";
import {
  applyColourTransform,
  applyColourTransformAlpha,
  canvasFilterFor,
  colourTransformFrom,
  glowAmplificationFor,
} from "./filters.js";

/** Never thrown by a reader. Exported so a caller can name the type it isn't getting. */
export class ScreenError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

const TWIPS_PER_PIXEL = 20;

/**
 * Where a screen sits on the stage: nowhere, at scale 1.
 *
 * The extractor composes every matrix from the root down, so the operations are
 * already in stage space. This constant exists so a caller can hand
 * `{ ops, placement: SCREEN_STAGE_PLACEMENT }` to the same layer painter
 * `arenaScreenLayersFor` feeds, rather than writing a second painter that
 * happens to skip a translate — which is how two paint paths drift.
 */
export const SCREEN_STAGE_PLACEMENT = Object.freeze({ x: 0, y: 0, scale: 1 });

/**
 * WHAT COUNTS AS AN OPERATION THAT BLANKETS THE STAGE, and every number here
 * is a judgement call rather than a fact about the build.
 *
 * ► `coverage` — the fraction of the 640 x 420 stage the operation's FILL must
 *   cover. ~~**0.95 is chosen, and the choice is the whole design.** Measured
 *   on this pack across all 26 screens, with the opacity test held at every
 *   value from 0.2 to 0.99: `coverage` 0.99 and 0.95 both give **7 blankets on
 *   6 screens**, 0.90 and 0.80 give **16 on 12**, and 0.50 gives **17 on 13**.
 *   The cliff between 0.95 and 0.90 is one shape — character 1498, the
 *   parchment backdrop on 13 screens — which rasterises to **91.8%** of the
 *   stage. So 0.95 draws the line at "covers the stage" and excludes "is a
 *   large backdrop with a margin round it", and moving it to 0.90 more than
 *   doubles the count with that one shape.~~
 *
 *   **RE-MEASURED 2026-09-14 AND THE GRID ABOVE WAS TAKEN AT ONE OPACITY, NOT
 *   AT EVERY ONE — the sentence "held at every value from 0.2 to 0.99" is the
 *   part that is wrong, and it is what made the cliff look like a property of
 *   `coverage` alone.** The whole grid, `coverage` down the side and `opacity`
 *   across, blankets/screens:
 *
 *       opacity ->     0.2      0.5      0.9     0.95     0.99
 *       cov 0.99      7 / 6    7 / 6    7 / 6    7 / 6    7 / 6
 *       cov 0.95      7 / 6    7 / 6    7 / 6    7 / 6    7 / 6   <- shipped
 *       cov 0.90     20 / 16  20 / 16  16 / 12   7 / 6    7 / 6
 *       cov 0.80     20 / 16  20 / 16  16 / 12   7 / 6    7 / 6
 *       cov 0.50     21 / 17  21 / 17  17 / 13   8 / 7    8 / 7
 *
 *   **At the SHIPPED opacity of 0.95 there is no cliff at all between 0.99 and
 *   0.80: `coverage` may be moved anywhere in that range and the answer stays
 *   7 on 6.** The "16 on 12" and "17 on 13" readings are the opacity-0.9
 *   column. The shape that produces them is character 1498, the parchment
 *   backdrop on 13 screens, and it is NOT excluded by coverage at the shipped
 *   thresholds: its effective alpha is 0.94921875 (243/256) on 9 of those
 *   screens and 0.80078125 on the other 4, so **the opacity test rejects all
 *   13 of them before the raster is reached**, and its bounding box covers
 *   0.9479 of the stage, so the box pre-filter would reject it too. Its fill
 *   rasterises to **92.04%**, not the 91.8% stated here until now (64 x 42
 *   grid, re-derived twice: by this module with both thresholds lowered, and
 *   by a scanline rasteriser written independently in scratch — the two agree
 *   to four decimals).
 *
 *   So the honest statement about this threshold is the opposite of the one
 *   that stood here: **on this pack `coverage` is nearly inert on its own and
 *   the pair is what draws the line.** What 0.95 buys, against a lower value,
 *   is the single operation shape 667 picks up at 0.50 (the arena's floor,
 *   73.81%). Anybody changing it should change the grid, not one axis of it.
 *
 * ► `opacity` — the effective alpha below which an operation does not hide
 *   what is beneath it. ~~**AND THIS HALF OF THE PREDICATE IS DEAD ON THE REAL
 *   PACK, which is a stronger statement than "0.95 is a sensible number" and
 *   is the statement worth making.** Measured: every one of the 7 operations
 *   that passes the coverage test is at effective alpha EXACTLY 1.0, and the
 *   grid above shows the count is identical at every opacity from 0.2 to 0.99.
 *   The next value down that any large operation on this pack takes is
 *   0.94921875 (243/256, the parchment), and it is excluded by COVERAGE, not
 *   by opacity. So the opacity test discriminates nothing here and only
 *   `test/render-screen.test.js`'s synthetic packs reach it.~~
 *
 *   **THAT IS BACKWARDS, AND IT IS THE MOST EXPENSIVE SENTENCE THIS FILE HAS
 *   CARRIED. THE OPACITY TEST IS THE ONLY THING KEEPING 34 STAGE-COVERING
 *   OPERATIONS OUT OF THE ROSTER.** Re-derived 2026-09-14 by sweeping the
 *   threshold DOWNWARDS, which the original sweep never did:
 *
 *       opacity 0.2 … 0.99   ->   7 blankets on 6 screens
 *       opacity 0.19921875   ->  15 blankets on 11 screens
 *       opacity 0            ->  41 blankets on 26 screens
 *
 *   The 8 that appear at 0.19921875 are character 718, a bitmap under the
 *   colour transform `[1,1,1,0.19921875,0,0,0,0]` on splash, new_or_continue,
 *   credits, help, gameover, bugs, gameover_demo and enter_highscore — the
 *   same 8 the `bitmapColourTransformDropped` note above names. The 26 that
 *   appear at 0 are character 642, the depth-1 chrome backdrop, `#66ff99`,
 *   `M640 0L640 420L0 420L0 0L640 0Z` at identity — the stage exactly, on
 *   every screen, at `alphaMultiplier 0`. Both cover 100% of the stage by the
 *   raster; only their alpha keeps them out.
 *
 *   **The old claim was not a lie, it was a sweep that could not vary.** Its
 *   range started at 0.2 and the highest alpha among the 34 is 0.19921875 —
 *   0.00078125 below the bottom of the range. A grid that begins just above
 *   the population it would have found reports "identical at every value" and
 *   means "I did not look where the answer changes". That is this project's
 *   own standing question — *what could this measurement have come out as?* —
 *   asked of a threshold and answered wrongly, inside a file whose header is
 *   about exactly that failure.
 *
 *   The test that now pins it is real-pack and needs no raster:
 *   `test/render-screen.test.js`'s "the opacity half of the predicate is what
 *   keeps 34 full-stage rectangles out of the roster" walks the 41 axis-aligned
 *   rectangles whose box covers the stage — for a rectangle the box IS the
 *   fill — and asserts that the 7 opaque ones are all counted and the 34 faint
 *   ones are all rejected. Delete the opacity line below and it goes red.
 *
 * ► `samplesX` / `samplesY` — a 64 x 42 grid over the stage, one sample per 10
 *   stage pixels. Coarse on purpose: this is a "does it cover the stage"
 *   question and not an area measurement. ~~The whole pass costs **3.5 ms warm
 *   for all 26 screens** — `screenFor` over the 26 measures 14.5 ms with it
 *   stubbed out and 18.0 ms with it~~ — **re-derived 2026-09-14, best of 15
 *   warm runs, twice: 14.68 and 14.93 ms with the pass stubbed out, 19.80 and
 *   20.10 ms with it, so the pass costs 5.1 ms rather than 3.5.** The stubbed
 *   half reproduces exactly and the other half does not, which is the half
 *   worth saying: the machine is comparable and the pass has grown since that
 *   line was written. (Not by the `inkAfter` walk below — that was A/B'd on
 *   its own at 0.1 ms, inside the noise.) And almost none of the 5.1 ms is the
 *   raster:
 *
 *   Of the 13638 operations, **12421 pass the opacity test, 42 have a bounding
 *   box big enough to be flattened, and 7 cover the stage** — re-derived
 *   2026-09-14, all four numbers unchanged. **So the raster rejects 35 of the
 *   42 the box admits, and a box-only implementation would report 42 blankets
 *   instead of 7.** The 35, by character, with the fill coverage an
 *   independent scanline rasteriser measures for each:
 *
 *       645 x 26   the ornamental border, on every screen        0.000
 *      1555 x  5   createchar, createboss, load_saved_gladiators,
 *                  delete_gladiator, church                      0.053 – 0.060
 *      2114 x  4   arena_intro, four black ops at one depth      0.043 – 0.060
 *
 *   **Nothing the box admits sits anywhere near the line: it is 7 at 1.000 and
 *   35 at or below 0.060**, so within this population the threshold could be
 *   anything from 0.07 to 1.0 and the roster would not move. The border is the
 *   case the raster was written for — box IS the stage, fill is a ring — and
 *   that disagreement between a box and a fill is the reason there is a raster
 *   here at all rather than a box test.
 */
export const STAGE_BLANKET = Object.freeze({
  coverage: 0.95,
  opacity: 0.95,
  samplesX: 64,
  samplesY: 42
});

/**
 * The three root depths every one of the 26 screens inherits from frame 1.
 *
 * Measured on this pack rather than assumed: 26 of 26 screens carry all three.
 * (`extract-screens.mjs` counts depth 438 on 261 of the 270 root FRAMES — a
 * different population, and the nine frames it is absent from are not label
 * frames.)
 */
export const SCREEN_CHROME = Object.freeze([
  Object.freeze({
    depth: 1, character: 643, what: "backdrop",
    // ► The one that will be reported as a bug by whoever draws a screen first.
    drawnByTheBuild: false,
    note: "placed with alphaMultiplier 0 at root frame 1 and never replaced — the build draws it on no screen"
  }),
  Object.freeze({
    depth: 438, character: 1531, what: "fiz_info_panel",
    drawnByTheBuild: true,
    note: "the bottom UI bar; it carries live edit-text this pack cannot set"
  }),
  Object.freeze({
    depth: 1193, character: 646, what: "border",
    drawnByTheBuild: true,
    note: "the ornamental frame, painted over everything"
  })
]);

/** Just the depths, for a caller filtering operations. */
export const SCREEN_CHROME_DEPTHS = Object.freeze(SCREEN_CHROME.map((piece) => piece.depth));

/**
 * A pack from `assets/screens/screens.json`, or null.
 *
 * Total rather than throwing, for the reason every reader in `props.js` is: a
 * partial or absent extraction must leave the game running on its own art, and
 * a stack trace where a shop should be is a worse outcome than a plain shop.
 */
export function screenPackFrom(data) {
  if (!data || typeof data !== "object") return null;
  const screens = data.screens;
  const shapes = data.shapes;
  if (!screens || typeof screens !== "object" || Array.isArray(screens)) return null;
  if (!shapes || typeof shapes !== "object" || Array.isArray(shapes)) return null;
  return Object.freeze({
    screens: Object.freeze(screens),
    shapes: Object.freeze(shapes),
    fonts: Object.freeze(data.fonts && typeof data.fonts === "object" ? data.fonts : {})
  });
}

/** Whether a pack holds any screen at all. */
export function hasExtractedScreens(pack) {
  return Boolean(pack && pack.screens && Object.keys(pack.screens).length > 0);
}

/**
 * The screens this pack holds, in the order the ROOT TIMELINE reaches them.
 *
 * Sorted by label frame rather than trusting JSON key order: the build's own
 * running order is the useful one (a menu walks it), and an object's key order
 * is a property of how the file was written, not of the game.
 */
export function screenNames(pack) {
  if (!hasExtractedScreens(pack)) return Object.freeze([]);
  const names = Object.keys(pack.screens);
  names.sort((left, right) => {
    const a = frameOf(pack.screens[left]);
    const b = frameOf(pack.screens[right]);
    if (a !== b) return a - b;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return Object.freeze(names);
}

/**
 * A screen's label frame, or Infinity so an entry with no frame sorts last
 * rather than colliding with frame 0 and reordering the real ones.
 *
 * A function declaration rather than an arrow because
 * `ss2-assertion-quality.test.js` finds a helper's body by looking for the next
 * brace before the next newline; the convention is kept in src/ too so the two
 * halves of the project read the same way.
 */
function frameOf(screen) {
  const frame = screen?.labelFrame;
  return Number.isFinite(frame) ? frame : Infinity;
}

/**
 * ONE SCREEN: its draw operations, its undrawn text, and the tally of what
 * neither half could show. This is the entry point; `screenOpsFor` is the
 * picture without the invoice and exists only for a caller that has already
 * read one of these.
 *
 * Returns null when the pack is absent or holds no such screen — a caller
 * checks `screenNames` rather than guessing.
 */
export function screenFor(pack, name) {
  if (!hasExtractedScreens(pack)) return null;
  if (typeof name !== "string") return null;
  const screen = pack.screens[name];
  if (!screen || typeof screen !== "object") return null;

  const approximations = {
    // Emitted, and putting no pixel down — see `drawsAnything`, which is not
    // the same test as `fillOpacity === 0`.
    invisibleOps: 0,
    // ── FILTERS. **`filtersNotApplied` USED TO BE ALL FIVE OF THESE ADDED
    //    TOGETHER**, which is why it counted 9423 and read as a defect in this
    //    file rather than a job for the painter. ~~"Emitted, and a FILTERLIST
    //    on the placement is stepped over, not applied."~~ Superseded
    //    2026-09-15: applied, deferred, refused, no-op and UNREACHABLE are
    //    five different facts and a caller that cannot tell them apart cannot
    //    tell a missing glow from a glow on a word this module never draws.
    //
    //    Operations under at least one filter group. THE DENOMINATOR for the
    //    four below; 9423 of 13638 across the 26 screens, the number the old
    //    `filtersNotApplied` was reporting.
    opsUnderFilterGroup: 0,
    // Under a group whose filters produced a canvas `ctx.filter` string. A
    // painter that composites groups changes these pixels.
    opsWithCanvasFilter: 0,
    // Under a group carrying a colour matrix, which is NOT in that string and
    // is deferred to `applyColourMatrix`. A painter reading `filter` alone
    // draws these ungraded while believing it applied the filters.
    opsWithDeferredColourMatrix: 0,
    // Under a group at least one of whose filters was REFUSED by name — an
    // inner glow or a bevel, which canvas cannot express. These lose something
    // even when the group paints.
    opsUnderRefusedFilter: 0,
    // Under a group where EVERY filter reaching the operation was a no-op or
    // an empty list — a `Blur(0,0)` or a zero-strength glow. Nothing is lost
    // here: the build draws nothing for these either. Counted separately
    // precisely so that the number below is not read as a loss when it is not.
    opsUnderNoOpFilterOnly: 0,
    // **REDEFINED 2026-09-15, AND THE NAME IS NOW EARNED:** operations under a
    // filter group that hands a painter NOTHING — no filter string and no
    // colour matrix, because everything reaching them was refused, a no-op, or
    // an empty list. `tools/screens/main.js` prints this row and its sentence
    // ("sit under a FILTERLIST nothing applies") stays true of the narrower
    // set. ► **SUBTRACT `opsUnderNoOpFilterOnly` AND WHAT IS LEFT IS THE
    //   SILENT LOSS** — operations under a filter that canvas refused with
    //   nothing else to fall back on. Measured on this pack: 24 and 24, so the
    //   difference is ZERO and every operation this module can hand nothing
    //   for is one where the build had nothing to hand. The three groups are
    //   `magicshop [64,10,12]` (11 ops), `enter_highscore [364,12]` (11) and
    //   `levelup [406,2]` (2), all zero-strength glows. **The bare zero would
    //   be indistinguishable from a dead counter**, which is why it is stated
    //   as a difference between two live numbers and not asserted on its own.
    filtersNotApplied: 0,
    // ── THE GROUPS THEMSELVES. `filterGroups` is the denominator for every
    //    group-level count under it.
    filterGroups: 0,
    filterGroupsFromPlacements: 0,
    filterGroupsFromButtonRecords: 0,
    filterGroupsReachingOps: 0,
    // **44% OF THE ROSTER ON THIS PACK, AND ALL OF IT TEXT.** A group whose
    // path covers no operation this module emits. Counted BY NAME below rather
    // than as a bare total, because "no filters on this screen" and "filters
    // that reach nothing I emit" are opposite findings with the same zero.
    filterGroupsReachingNothing: 0,
    filterGroupsReachingNothingByKind: null,
    // Groups with a filtered ancestor. Flash filters innermost-first and feeds
    // each result into the next, so these do NOT pick a winner — see the
    // header, and see `blendFor`, which faces the same question and answers it
    // the other way for a reason.
    filterGroupsNested: 0,
    // Groups at a path another group already holds. **The one arrangement in
    // which `ownOpCount` is wrong** — see `filterGroupsOf`, where the
    // subtraction is. Zero on this pack, and counted rather than assumed.
    filterGroupsSharingAPath: 0,
    // Groups whose operations are NOT a contiguous run in `ops`, so
    // `[opFirst, opEnd)` brackets them rather than naming them and a painter
    // must re-match on `path`. Zero on this pack; a real number, not an
    // assumption, because the range is what a painter would otherwise trust.
    filterGroupsNotContiguous: 0,
    // The filter RECORDS across those groups, summed from `canvasFilterFor`'s
    // own buckets rather than recounted here.
    filtersTotal: 0,
    filtersApplied: 0,
    filtersDeferredToColourMatrix: 0,
    filtersNoOp: 0,
    filtersRefused: 0,
    filtersRefusedByReason: null,
    // Emitted, and the blend mode is carried on the operation but applied by
    // nothing — the leaf drawables in this pack carry no blend mode of their
    // own, so it is joined from the placement that owns them.
    blendModesNotApplied: 0,
    // Emitted, and needs `assets/bitmaps/` to draw anything at all.
    bitmapOps: 0,
    // Emitted with the real gradient beside a flat first-stop fallback.
    gradientOps: 0,
    // Emitted from a morph baked at one ratio rather than interpolated.
    bakedMorphOps: 0,
    // Emitted from a DefineButton2's UP records only: no over, down or hit.
    buttonUpStateOps: 0,
    // NOT emitted, and each one is a word or a picture missing from the screen.
    textNotDrawn: 0,
    buttonHitAreaOnly: 0,
    shapesMissing: 0,
    shapesWithNoPaths: 0,
    pathsWithoutGeometry: 0,
    clipsUnresolved: 0,
    // The two colour-transform cases that do not fold into an operation.
    bitmapColourTransformDropped: 0,
    gradientAlphaOffsetApproximated: 0,
    // Emitted, drawn, and hiding almost everything emitted before it: **one
    // operation whose FILL covers at least `STAGE_BLANKET.coverage` (0.95) of
    // the stage at an effective alpha of at least `STAGE_BLANKET.opacity`
    // (0.95).** Stated here because this is where a reader meets the number,
    // and the two thresholds are what it means. **PER OPERATION, never
    // cumulative** — four operations that tile the stage between them are
    // counted zero times, and `arena_intro` has exactly that. See
    // `stageBlanketsOf` for both, and for why this is the number that answers
    // "1698 of townsquare's 1704 merged operations painted and the canvas is
    // 99% black" — 1704 is `screenWithTextFor`'s merge of these 1638 shape
    // operations with 66 glyph operations, a different denominator from the
    // 1638 this module counts, and the two get quoted in the same sentence.
    blanketsTheStage: 0,
    // A candidate for that count whose geometry this file could not flatten,
    // so it was NOT measured and is NOT in `blanketsTheStage`. An uncounted
    // swallow is the same defect as an uncounted approximation.
    blanketGeometryUnparsed: 0,
    // Frames inside this label's own range that differ from the snapshot.
    framesNotStill: Number.isFinite(screen.rangeVariance?.frames) ? screen.rangeVariance.frames : 0,
    // The extractor's own block, verbatim. Kept SEPARATE from the numbers above
    // rather than merged: two tallies that agree are evidence, and one tally
    // copied twice is not.
    fromPack: Object.freeze({ ...(screen.approximations ?? {}) })
  };

  const drawables = Array.isArray(screen.drawables) ? screen.drawables : [];
  // ► **THE DRAFTS ARE BUILT BEFORE THE OPERATIONS AND THE GROUPS AFTER THEM**,
  //   because the boolean `filtered` on an operation needs only the paths and
  //   the group's `[opFirst, opEnd)` needs the operations that carry them. One
  //   pass over the pack's two filter lists, read once.
  const filterDrafts = filterGroupDraftsOf(screen);
  const filtered = filterDrafts.map((draft) => draft.path);
  const blended = blendPrefixesOf(screen.blendedPlacements);

  const ops = [];
  for (const drawable of drawables) {
    emitDrawable(pack, drawable, filtered, blended, approximations, ops);
  }
  const filterGroups = filterGroupsOf(filterDrafts, ops, screen, approximations);

  const text = textOf(pack, screen, approximations);
  const unresolvedByKind = kindsOf(screen);
  approximations.buttonHitAreaOnly = unresolvedByKind["button-hit-area-only"] ?? 0;
  const blankets = stageBlanketsOf(ops, approximations);

  return Object.freeze({
    name: typeof screen.name === "string" ? screen.name : name,
    labelFrame: Number.isFinite(screen.labelFrame) ? screen.labelFrame : null,
    firstFrame: Number.isFinite(screen.firstFrame) ? screen.firstFrame : null,
    lastFrame: Number.isFinite(screen.lastFrame) ? screen.lastFrame : null,
    stage: SS2_STAGE,
    placement: SCREEN_STAGE_PLACEMENT,
    ops: Object.freeze(ops),
    // ► **THE FILTERED SUBTREES, WHICH ARE WHAT A FILTER IS.** Each one names
    //   the operations it owns, what `canvasFilterFor` made of its filter list,
    //   and where it sits in the nesting. See the header for what a painter
    //   does with them and for why nothing is stamped on an operation. Shaped
    //   so that `summariseFilterUse(record.filterGroups)` from `filters.js`
    //   works on it directly — each group carries that function's `counts`,
    //   `refused` and `applied` — rather than a second tally kept here that
    //   can drift away from the first while both stay green.
    filterGroups,
    // Every operation that, on its own, covers the stage and hides what was
    // painted before it. Usually empty; when it is not, it is the first thing
    // a person looking at a black rectangle needs. See `stageBlanketsOf`.
    blankets,
    text,
    unresolvedByKind: Object.freeze(unresolvedByKind),
    // The extractor's own roster of what it could not draw, untouched, so a
    // person chasing one of the counts above has the character id and the path.
    unresolved: Object.freeze(Array.isArray(screen.unresolved) ? [...screen.unresolved] : []),
    objects: Object.freeze(Array.isArray(screen.objects) ? [...screen.objects] : []),
    approximations: Object.freeze(approximations),
    stillness: Object.freeze({
      differingFrames: approximations.framesNotStill,
      firstDifferingFrame: screen.rangeVariance?.firstDifferingFrame ?? null,
      depthsAdded: Object.freeze([...(screen.rangeVariance?.depthsAdded ?? [])]),
      depthsRemoved: Object.freeze([...(screen.rangeVariance?.depthsRemoved ?? [])])
    }),
    counts: Object.freeze({
      objects: Array.isArray(screen.objects) ? screen.objects.length : 0,
      drawables: drawables.length,
      ops: ops.length,
      text: text.length,
      unresolved: Array.isArray(screen.unresolved) ? screen.unresolved.length : 0,
      distinctShapes: new Set(ops.map((op) => op.shape)).size
    })
  });
}

/**
 * The draw operations alone, in paint order, in stage space — or null.
 *
 * ► **THIS THROWS THE COUNTS AWAY AND THAT IS THE WHOLE RISK OF USING IT.** The
 *   defect this programme exists to stamp out is an approximation that reaches
 *   a screen without reaching a tally, and it has recurred six times, every
 *   time at a seam exactly like this one. Use `screenFor` and read
 *   `approximations` and `text`; reach for this only once something else in the
 *   call chain is already reporting them.
 */
export function screenOpsFor(pack, name) {
  const record = screenFor(pack, name);
  return record && record.ops.length > 0 ? record.ops : null;
}

/**
 * A screen's operations split into the chrome every screen shares and the body
 * that is its own.
 *
 * The split is by ROOT DEPTH, which is what the operations carry, because a
 * caller drawing a screen over a live arena wants the border and the UI bar
 * without a second copy of the scenery underneath them. Paint order is
 * preserved inside each half; `chrome` is NOT all-behind or all-in-front —
 * depth 1 is behind everything and depths 438 and 1193 are over everything, so
 * a caller that needs both sides reads `depth` rather than concatenating.
 */
export function splitScreenChrome(record) {
  const ops = record?.ops ?? [];
  const chromeDepths = new Set(SCREEN_CHROME_DEPTHS);
  return Object.freeze({
    chrome: Object.freeze(ops.filter((op) => chromeDepths.has(op.depth))),
    body: Object.freeze(ops.filter((op) => !chromeDepths.has(op.depth)))
  });
}

/* ------------------------------------------------------------------ */
/* Drawables                                                           */
/* ------------------------------------------------------------------ */

/**
 * One flattened placement, expanded to one operation per path of its shape.
 *
 * Every reason a path is NOT emitted increments a counter before `continue`.
 * **Never emit a silently-empty path and never skip one silently** is the rule
 * the arena's invisible walls were found by breaking.
 */
function emitDrawable(pack, drawable, filtered, blended, approximations, ops) {
  if (!drawable || typeof drawable !== "object") return;
  const path = Array.isArray(drawable.path) ? drawable.path : [];
  const shape = pack.shapes[drawable.shape];
  if (!shape) {
    approximations.shapesMissing += 1;
    return;
  }
  if (!Array.isArray(shape.paths) || shape.paths.length === 0) {
    approximations.shapesWithNoPaths += 1;
    return;
  }
  // ► **NORMALISED ONCE PER PLACEMENT, NOT ONCE PER FILL** — same argument as
  //   the clip below. `colourTransformFrom` allocates and freezes an
  //   eight-number array, a shape is many paths sharing one transform, and
  //   `applyColourTransform` takes that array straight through without
  //   re-normalising. Measured on the real pack: 780 conversions here against
  //   the 55572 that handing `drawable.colour` to each call would do — 27786
  //   fill sites and 27786 alpha sites. It also accepts the eight-number ARRAY
  //   shape `tools/extract-figure.mjs` writes, which the private implementation
  //   this replaces read as the identity and dropped in silence.
  const colour = colourTransformFrom(drawable.colour ?? null);
  const under = { filtered: matchesPrefix(path, filtered), blendMode: blendFor(path, blended) };
  // ► **THE CLIP IS RESOLVED ONCE PER PLACEMENT, NOT ONCE PER PATH** — same as
  //   `propOpsFor`. A shape is many paths sharing one cutter, and building it
  //   per path hands the surface N identical regions to set and clear.
  const clip = clipFor(pack, drawable.clip, approximations);
  const via = typeof drawable.via === "string" ? drawable.via : null;
  if (via && via.startsWith("button ")) approximations.buttonUpStateOps += shape.paths.length;
  if (via && via.startsWith("morph ")) approximations.bakedMorphOps += shape.paths.length;

  for (const entry of shape.paths) {
    if (typeof entry?.d !== "string" || entry.d.length === 0) {
      approximations.pathsWithoutGeometry += 1;
      continue;
    }
    const fillOpacity = applyColourTransformAlpha(numberOr(entry.fillOpacity, 1), colour);
    const fill = applyColourTransform(entry.fill ?? null, colour);
    const stroke = applyColourTransform(entry.stroke ?? null, colour);
    const strokeWidth = numberOr(entry.strokeWidth, 0);
    const strokeOpacity = applyColourTransformAlpha(numberOr(entry.strokeOpacity, 1), colour);
    // ► **THE DENOMINATOR, NOT THE VERDICT.** This says the operation is inside
    //   a filtered subtree; what that subtree can and cannot be drawn as is
    //   settled per GROUP, after every operation exists, by `filterGroupsOf`.
    if (under.filtered) approximations.opsUnderFilterGroup += 1;
    if (under.blendMode !== null) approximations.blendModesNotApplied += 1;
    if (entry.bitmap) {
      approximations.bitmapOps += 1;
      if (touchesRgb(colour)) approximations.bitmapColourTransformDropped += 1;
    }
    let gradient = null;
    if (entry.gradient) {
      approximations.gradientOps += 1;
      gradient = transformGradient(entry.gradient, colour, approximations);
    }
    // ► **"INVISIBLE" IS NOT "fillOpacity === 0", AND THE FIRST VERSION OF THIS
    //   LINE SAID IT WAS.** A stroke-only path carries `fill: "none"` at full
    //   opacity and draws; a gradient's alpha lives in its STOPS and not in
    //   `fillOpacity` at all, because that is where the painter reads it. Both
    //   readings were wrong in the same direction the counts on this project
    //   are always wrong — quietly, by naming something after the one field the
    //   author happened to be looking at. Measured after the fix: 182 of the
    //   13638 operations across the 26 screens put no pixels down, against 171
    //   under the fillOpacity-only reading.
    if (!drawsAnything({ fill, fillOpacity, gradient, bitmap: entry.bitmap, stroke, strokeWidth, strokeOpacity })) {
      approximations.invisibleOps += 1;
    }
    ops.push(Object.freeze({
      kind: "path",
      d: entry.d,
      matrix: drawable.matrix,
      ...(clip ? { clip } : {}),
      fill,
      fillRule: entry.fillRule ?? "evenodd",
      fillOpacity,
      stroke,
      strokeWidth,
      strokeOpacity,
      ...(entry.bitmap ? { bitmap: entry.bitmap } : {}),
      ...(gradient ? { gradient } : {}),
      // ► **CARRIED FROM THE PACK AS A STRING, AND THE OTHER HALF OF THE
      //   MERGED STREAM CARRIES AN ARRAY.** The extractor writes one word here
      //   — re-derived over the 26 screens: 209 marked operations, `gradient`
      //   x180 and `bitmap` x29, and not one of them anything but a string.
      //   `screen-text.js`'s `screenWithTextFor` then merges these with the
      //   text operations, whose `approximated` is a frozen ARRAY (65 of them,
      //   all `html-markup-stripped`), into ONE paint order. So a caller
      //   walking the merged list for marks meets both shapes in one array:
      //   `typeof op.approximated === "string"` skips 65, and
      //   `op.approximated.includes(...)` reads a string as characters and
      //   matches substrings. **Nothing in the repository walks it that way
      //   today, which is why this is a comment and not a change** — the shape
      //   is the extractor's and converting it here would put this module's
      //   output out of step with the pack it is quoting. Whoever unifies them
      //   should do it at the seam that invented the second shape.
      ...(entry.approximated ? { approximated: entry.approximated } : {}),
      // The trail back into the pack. `depth` is the ROOT depth that put this
      // on the screen, which is what `splitScreenChrome` filters on and what a
      // person cross-references against the object list.
      shape: drawable.shape,
      depth: path.length > 0 ? path[0] : null,
      path: Object.freeze([...path]),
      ...(via ? { via } : {}),
      // Carried, applied by nothing, and counted above. Dropping them would be
      // the exact seam failure this file's header is about.
      ...(under.blendMode !== null ? { blendMode: under.blendMode } : {}),
      ...(under.filtered ? { filtered: true } : {})
    }));
  }
}

/**
 * Whether an operation would put any pixel down.
 *
 * ► **A GRADIENT'S ALPHA IS IN ITS STOPS, NOT IN `fillOpacity`.**
 *   `paintGradientFill` in `tools/arena/main.js` sets `globalAlpha = 1` and
 *   builds the ramp from each stop's own opacity, which is why
 *   `transformGradient` folds the colour transform into the stops. The
 *   operation's `fillOpacity` carries the same factor for the flat first-stop
 *   fallback beside it — **a consumer that multiplies BOTH darkens twice**, and
 *   that is the one hazard in this file's output.
 */
function drawsAnything({ fill, fillOpacity, gradient, bitmap, stroke, strokeWidth, strokeOpacity }) {
  const drawsStroke = typeof stroke === "string" && stroke !== "none" && strokeWidth > 0 && strokeOpacity > 0;
  if (drawsStroke) return true;
  if (gradient) return (gradient.stops ?? []).some((stop) => numberOr(stop?.opacity, 1) > 0);
  if (bitmap) return fillOpacity > 0;
  return typeof fill === "string" && fill !== "none" && fillOpacity > 0;
}

/** A cutter, all of its loops joined, or null with the reason counted. */
function clipFor(pack, clip, approximations) {
  if (!clip || typeof clip !== "object") return null;
  const cutter = pack.shapes[clip.shape];
  const loops = Array.isArray(cutter?.paths)
    ? cutter.paths.map((entry) => entry?.d).filter((d) => typeof d === "string" && d.length > 0)
    : [];
  if (loops.length === 0) {
    // A placement that says it is clipped and whose cutter will not resolve is
    // being drawn UNCLIPPED — larger than it should be, over things it should
    // not cover. Silence here is the mask equivalent of the invisible walls.
    approximations.clipsUnresolved += 1;
    return null;
  }
  // Every loop, because a mask with a hole is still one region and keeping only
  // the first would clip to the outline.
  return Object.freeze({ matrix: clip.matrix, d: loops.join("") });
}

/* ------------------------------------------------------------------ */
/* Operations that blanket the stage                                   */
/* ------------------------------------------------------------------ */

/**
 * EVERY OPERATION THAT, ON ITS OWN, COVERS THE STAGE AND HIDES WHAT WAS
 * PAINTED BEFORE IT.
 *
 * ## Why this exists
 *
 * `townsquare` emits 1638 path operations, paints almost all of them, and the
 * page reading its own canvas back measured **439266 opaque pixels of which
 * 435374 are `#000000` — 99.1%**. Every tally in this file said the screen was
 * fine, because every tally in this file counts what was NOT drawn. Nothing
 * counted the operation that was drawn *over everything else*. The invoice
 * could report a perfect screen and the picture be a black rectangle, and it
 * did, for a week.
 *
 * ► **THIS IS NOT AN APPROXIMATION COUNT AND IT IS IN THE APPROXIMATION BLOCK
 *   ANYWAY.** A blanket is a real operation, drawn exactly as the pack states
 *   it; nothing here is approximating anything. It sits beside the
 *   approximations because it answers the same question they do — *why does
 *   this not look like the game* — and because a caller that reads the invoice
 *   and not this number can still be looking at a black rectangle. Some of
 *   these are correct: `dungeon`'s backdrop JPEG blankets the stage because a
 *   backdrop is supposed to. **The count says "one operation decides what you
 *   see"; it does not say "bug".** `opsBefore` is what separates the two.
 *
 * ## What the entries are for
 *
 * Measured on this pack, the seven blankets fall into two kinds and the
 * discriminator is `opsBefore` — the number of operations emitted BEFORE this
 * one, all of which it covers:
 *
 * - `dungeon` op 3 of 75 (a bitmap) and `gameover` op 5 of 18 (a bitmap) —
 *   backdrops. They blanket the stage and then the screen is drawn on top.
 * - `splash` op 284 of 290, `new_or_continue` op 284 of 290, `daybreak` op 1606
 *   of 1612, `dungeon` op 69 of 75, `townsquare` op 1632 of 1638 — **curtains.
 *   Every one of them is shape 647, `#000000` at opacity 1, covering 100% of
 *   the stage, emitted second-from-last with only the border painted after it.**
 *
 * ► **AND THE FIVE CURTAINS ARE TWO SPRITES FROZEN AT FRAME 1, WHICH IS THE
 *   THING A FIX WOULD ACT ON.** Root depth 428 on `townsquare`, 185 on `splash`
 *   and `new_or_continue` is **character 1525, a sprite the pack states as 168
 *   frames**; root depth 408 on `daybreak` and `dungeon` is **character 1772,
 *   `day_night`, 127 frames**. `tools/extract-screens.mjs` flattens a nested
 *   sprite at its frame 1, and frame 1 of both of these is one opaque black
 *   rectangle — a fade-in and a night overlay, each caught with the curtain
 *   down. The character ids are on `screen.objects` beside the depth each entry
 *   below carries, so the join is a lookup and not a search.
 *
 * ## CURTAIN, OR THE PAGE'S OWN BLACK GROUND? THE NUMBER THAT STARTED THIS
 * CANNOT TELL THEM APART, AND THESE ENTRIES CAN
 *
 * The 99.1% reading above came from `tools/screens/main.js?probe=1` counting
 * its own canvas back. **That canvas is painted `#000000` across the stage
 * before a single operation is drawn** (the viewer calls it the stage's own
 * ground), so "439266 opaque pixels, 435374 of them black" is exactly what a
 * run in which EVERY operation drew nothing would also report. The probe
 * cannot separate "a curtain was painted over the screen" from "nothing was
 * painted and you are looking at the page". It is one of the two alternatives
 * it was quoted to decide between.
 *
 * **The pack can decide it, and the record already carries the reading, which
 * is why this section is here rather than a browser task.** For `townsquare`:
 *
 * - `counts.ops` 1638 and `approximations.invisibleOps` 6 — **1632 operations
 *   put ink down.** A stage that is black because nothing drew would have
 *   those two numbers equal. This is the half that rules out "empty".
 * - the blanket entry: `fill: "#000000"`, `opacity: 1`, `coverage: 1`,
 *   `opsBefore: 1632`. **Opaque black ink over the whole stage is drawn, so
 *   whatever the page's ground is, it is not what you are seeing.** This is
 *   the half that rules out "the ground".
 * - `opsAfter: 5` and `inkAfter: 3` — what is painted over the curtain
 *   afterwards, and how much of it puts ink down. **None of the three is in
 *   this roster, and that is a bound and not a shrug: an operation that
 *   repainted the stage over the curtain would be a blanket itself**, so each
 *   covers less than `STAGE_BLANKET.coverage` of it. (They are two buttons and
 *   the ornamental border.)
 *
 * ► **AND THE GAP THAT LEAVES, NAMED RATHER THAN ROUNDED OFF. This pass is
 *   PER-OPERATION and never cumulative**, so N operations that jointly cover
 *   the stage are counted zero times. That case is in this pack and is not
 *   hypothetical: `arena_intro` paints four opaque black operations of
 *   character 2114 at one depth, each with the stage for a bounding box,
 *   covering 0.043 to 0.060 of it individually and **0.081 as a union** — no
 *   blanket, correctly, but a pack in which four such operations tiled the
 *   stage would read as clean here. A union raster is what would close it, and
 *   it is not written because the per-operation pass costs 3.5 ms and a union
 *   over 13638 operations does not.
 *
 * ► **What NO reading of the pack can settle: what colour the page under the
 *   canvas is.** That is a fact about `tools/screens/main.js` and its CSS, not
 *   about the build. The browser-side measurement that WOULD settle it is the
 *   same probe with the ground fill removed, or filled with a colour no
 *   operation uses — then "every opaque pixel is `#000000`" is a statement
 *   about ink. Until someone runs that, the 99.1% is corroboration for a
 *   conclusion this roster reaches on its own, and should be quoted that way.
 *
 * ## What it cannot see, named rather than left to be discovered
 *
 * - **A BITMAP'S OWN ALPHA.** `assets/bitmaps/` is not read here, so a raster
 *   at `fillOpacity: 1` is taken to be opaque even if the image is mostly
 *   transparent. Both bitmap blankets on this pack are backdrops and really are
 *   opaque, but that is a measurement of two files and not a property of the
 *   format. Entries carry `bitmap: true` so a caller can discount them.
 * - **FILTERS.** Nothing applies the FILTERLIST (9423 of 13638 operations sit
 *   under one, `filtersNotApplied`), so a blur that would soften a blanket's
 *   edge, or an alpha filter that would make it transparent, is not modelled.
 *   Entries carry `filtered: true`.
 * - **BLEND MODES**, for the same reason: a MULTIPLY blanket over white is
 *   invisible and this counts it. Entries carry `blendMode`.
 * - **STROKES.** The coverage test is over the FILL region only, so a stroke
 *   wide enough to cover the stage is not counted. No operation on this pack is.
 * - **GEOMETRY THIS FILE CANNOT FLATTEN.** `flattenToEdges` understands the
 *   `M`/`L`/`Q`/`Z` the extractor writes and nothing else; anything else
 *   increments `blanketGeometryUnparsed` and is left out of the count rather
 *   than guessed at. Measured: the 4915 shape paths in this pack use exactly
 *   `L`, `M`, `Q` and `Z`, so that counter is at 0 — which is a fact about the
 *   pack, not a guarantee, and is why it is a counter and not an assumption.
 */
function stageBlanketsOf(ops, approximations) {
  // ► **ONE `blanketOpacityOf` PER OPERATION, READ TWICE.** The loop below
  //   needs each operation's own alpha, and every entry it emits needs to know
  //   how much ink is painted AFTER it — see "curtain, or the page's own black
  //   ground?" above, which is the question that number answers. Both come off
  //   this one pass: a suffix count, so an entry's `inkAfter` is a subtraction
  //   rather than a second walk, and a pack with many blankets does not become
  //   quadratic. **Measured rather than assumed, best of 12 over the 26
  //   screens, twice: 21.89 ms before this and 21.62 ms after, 20.28 and
  //   20.19 on the second pair — the same number.** The call per operation was
  //   already being made; only where its result is kept has changed.
  const opacities = ops.map((op) => blanketOpacityOf(op));
  const inkFrom = new Array(ops.length + 1).fill(0);
  for (let index = ops.length - 1; index >= 0; index -= 1) {
    inkFrom[index] = inkFrom[index + 1] + (opacities[index] > 0 ? 1 : 0);
  }

  const out = [];
  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    const opacity = opacities[index];
    if (opacity < STAGE_BLANKET.opacity) continue;
    // ► **THE BOUNDING BOX IS THE CHEAP FILTER AND IT OVERSTATES ON PURPOSE.**
    //   It counts a quadratic's CONTROL point as a corner and ignores the fill
    //   rule, so the box is never smaller than the shape — which is the safe
    //   direction for a pre-filter: it can waste a flatten, it cannot drop a
    //   blanket. Measured on this pack: 101 of 13638 operations have a box that
    //   big, 42 of them survive the opacity test above and are flattened, and
    //   **26 of those 42 are the ornamental border** — box the whole stage,
    //   fill a RING. It is rejected by the raster on every screen.
    if (bboxStageCoverage(op.d, op.matrix) < STAGE_BLANKET.coverage) continue;
    const edges = flattenToEdges(op.d, op.matrix);
    if (edges === null) {
      approximations.blanketGeometryUnparsed += 1;
      continue;
    }
    let covered = coverageOf(edges);
    if (op.clip) {
      // A clipped operation paints the INTERSECTION, so a full-stage rectangle
      // cut down to a button is not a blanket. The cutter's own loops are
      // joined into one `d` by `clipFor`, which is why one flatten does it.
      const cutter = flattenToEdges(op.clip.d, op.clip.matrix);
      if (cutter === null) {
        approximations.blanketGeometryUnparsed += 1;
        continue;
      }
      covered = coverageOf(edges, cutter);
    }
    if (covered < STAGE_BLANKET.coverage) continue;
    out.push(Object.freeze({
      index,
      // Operations emitted before this one. **An UPPER BOUND on what it hides**
      // — an operation painted entirely off-stage is counted here and is not
      // actually covered. It is the number that separates a backdrop (3 of 75)
      // from a curtain (1632 of 1638), which is all it is asked to do.
      opsBefore: index,
      // And what is painted over it afterwards, which is what decides whether
      // this operation is the last word on the stage. `inkAfter` counts FILL
      // ink only — a stroke-only operation is not counted, for the same reason
      // the coverage test is over the fill region — and neither number says
      // how much of the stage those operations cover. The bound that does:
      // anything in this roster is listed here too, so an operation after this
      // one that is NOT in the roster covers less than `STAGE_BLANKET.coverage`
      // on its own. Measured on `townsquare`: 5 and 3, two buttons and the
      // ornamental border, over a curtain that covers the whole stage.
      opsAfter: ops.length - 1 - index,
      inkAfter: inkFrom[index + 1],
      coverage: covered,
      opacity,
      shape: op.shape,
      depth: op.depth,
      path: op.path,
      fill: op.fill,
      bitmap: Boolean(op.bitmap),
      gradient: Boolean(op.gradient),
      clipped: Boolean(op.clip),
      filtered: op.filtered === true,
      blendMode: op.blendMode ?? null,
      ...(op.via ? { via: op.via } : {})
    }));
  }
  approximations.blanketsTheStage = out.length;
  return Object.freeze(out);
}

/**
 * How opaque an operation is where it paints, in 0..1.
 *
 * ► **THE THREE FILLS KEEP THEIR ALPHA IN THREE DIFFERENT PLACES, AND READING
 *   ONLY `fillOpacity` IS THE MISTAKE `invisibleOps` ALREADY MADE ONCE** — its
 *   own comment above records that the first version of it counted 171 where
 *   the right answer was 182. A gradient's alpha is in its STOPS, because
 *   `paintGradientFill` sets `globalAlpha = 1` and builds the ramp from them; a
 *   bitmap has no colour in the operation at all and only `fillOpacity`
 *   survives; a flat fill of `"none"` paints nothing whatever its opacity says.
 *
 * The gradient case takes the MINIMUM stop opacity rather than the average or
 * the first, because a ramp that goes transparent anywhere does not hide what
 * is under it there — and "hides what is under it" is the only thing this
 * number is for. A stroke is deliberately not considered: see the header.
 */
function blanketOpacityOf(op) {
  if (op.gradient) {
    const stops = Array.isArray(op.gradient.stops) ? op.gradient.stops : [];
    if (stops.length === 0) return 0;
    return Math.min(...stops.map((stop) => numberOr(stop?.opacity, 1)));
  }
  if (op.bitmap) return numberOr(op.fillOpacity, 1);
  if (typeof op.fill !== "string" || op.fill === "none") return 0;
  return numberOr(op.fillOpacity, 1);
}

/**
 * The fraction of the stage the operation's BOUNDING BOX covers — the cheap
 * filter, deliberately an over-estimate.
 *
 * ► **THE BOX IS TAKEN IN PATH SPACE AND ITS FOUR CORNERS ARE TRANSFORMED,
 *   WHICH IS NOT THE SAME BOX AND IS ALWAYS THE LARGER ONE.** A matrix is
 *   affine, so the image of the path-space box is a parallelogram containing
 *   the image of every point on the path, and the axis-aligned box of that
 *   parallelogram's four corners contains the parallelogram. Under a rotation
 *   it is strictly larger than the box of the transformed points. That is the
 *   safe direction for a filter that must never drop a blanket, and it is what
 *   buys the memo below: the expensive half depends on the `d` string alone.
 *
 * Units, the seam this file has lost three defects to: **the translation is
 * divided by 20 and the geometry is not.**
 */
function bboxStageCoverage(d, matrix) {
  const box = pathBoxOf(d);
  if (box === null) return 0;
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const [cornerX, cornerY] of [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]]) {
    const x = matrix[0] * cornerX + matrix[2] * cornerY + matrix[4] / TWIPS_PER_PIXEL;
    const y = matrix[1] * cornerX + matrix[3] * cornerY + matrix[5] / TWIPS_PER_PIXEL;
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  const left = Math.max(0, xMin);
  const top = Math.max(0, yMin);
  const right = Math.min(SS2_STAGE.width, xMax);
  const bottom = Math.min(SS2_STAGE.height, yMax);
  if (right <= left || bottom <= top) return 0;
  return ((right - left) * (bottom - top)) / (SS2_STAGE.width * SS2_STAGE.height);
}

/**
 * The memo behind that, keyed on the `d` string itself.
 *
 * ► **IT IS HERE BECAUSE THE FIRST VERSION MADE `screenFor` 3.4x SLOWER AND
 *   THE COMMENT SAID IT COST 4 ms.** Measured warm over all 26 screens:
 *   `screenFor` is 14.5 ms with the blanket pass stubbed out and was 49.6 ms
 *   with it, and 42.5 ms of that was this function — a full number scan of
 *   every one of the 13638 operations' `d`, 4.15 MB of text, to reject all but
 *   101 of them. The pack holds **4863 distinct `d` strings behind those 13638
 *   operations**, 1.49 MB, because a shape is placed on several screens and
 *   the pack shares the string, so the scan runs 2.8x more often than it has
 *   any reason to.
 *
 * A `Map` on a string rather than a `WeakMap` on the path object, because the
 * operation carries the string and not the object it came from. The cap is the
 * price of that: a process that reads pack after pack would otherwise hold
 * every one of them. **Overflow is not an error and not an approximation** —
 * the box is recomputed and the answer is identical, which is the only reason a
 * silent cap is acceptable here at all.
 */
const PATH_BOX_MEMO = new Map();
const PATH_BOX_MEMO_LIMIT = 20000;

function pathBoxOf(d) {
  const memo = PATH_BOX_MEMO.get(d);
  if (memo !== undefined) return memo;
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    const x = numbers[index];
    const y = numbers[index + 1];
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  // A quadratic's CONTROL point is counted as a corner, which only ever makes
  // the box larger — the same over-estimate `visibleBoxOf` in
  // `test/render-screen.test.js` makes, and for the same reason.
  const box = Number.isFinite(xMin) ? Object.freeze([xMin, yMin, xMax, yMax]) : null;
  if (PATH_BOX_MEMO.size < PATH_BOX_MEMO_LIMIT) PATH_BOX_MEMO.set(d, box);
  return box;
}

/**
 * A `d` string as a flat list of `[x1, y1, x2, y2]` edges in STAGE space, or
 * NULL if it holds a command this cannot flatten.
 *
 * ► **NULL RATHER THAN A PARTIAL ANSWER, AND THE CALLER COUNTS IT.** A path
 *   flattened with one command silently dropped would come back with a smaller
 *   region and quietly fail the coverage test, which is the uncounted-swallow
 *   defect wearing yet another hat. The extractor writes `M`, `L`, `Q` and `Z`
 *   and `shapeToPaths` has no other emitter, so this is the whole language
 *   today; a new one must announce itself rather than shrink a shape.
 *
 * Quadratics are subdivided into 8 segments. That is a coverage test on a
 * 10-pixel grid, not a renderer: the error is bounded by the curve's deviation
 * from its chords and is far below one sample at that resolution.
 */
function flattenToEdges(d, matrix) {
  if (/[^MLQZmlqz\s\d.,\-]/.test(d)) return null;
  const edges = [];
  const at = (x, y) => [
    matrix[0] * x + matrix[2] * y + matrix[4] / TWIPS_PER_PIXEL,
    matrix[1] * x + matrix[3] * y + matrix[5] / TWIPS_PER_PIXEL
  ];
  let startX = 0, startY = 0, x = 0, y = 0;
  let penX = 0, penY = 0, down = false;
  const lineTo = (toX, toY) => {
    const [px, py] = at(toX, toY);
    if (down) edges.push([penX, penY, px, py]);
    penX = px;
    penY = py;
    down = true;
  };
  // A subpath is always closed before it is measured: an unclosed one has no
  // inside, and the extractor's fills are closed regions whether or not the `d`
  // ends in `Z`.
  const closeSubpath = () => {
    if (!down) return;
    const [px, py] = at(startX, startY);
    edges.push([penX, penY, px, py]);
    penX = px;
    penY = py;
  };
  const commands = d.matchAll(/([MLQZmlqz])([^MLQZmlqz]*)/g);
  for (const [, letter, tail] of commands) {
    const command = letter.toUpperCase();
    const numbers = (tail.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (command === "Z") {
      closeSubpath();
      x = startX;
      y = startY;
      down = false;
      continue;
    }
    if (command === "M") {
      for (let index = 0; index + 1 < numbers.length; index += 2) {
        if (index === 0) {
          closeSubpath();
          startX = numbers[index];
          startY = numbers[index + 1];
          x = startX;
          y = startY;
          const [px, py] = at(x, y);
          penX = px;
          penY = py;
          down = true;
        } else {
          // An `M` with extra pairs is an implicit `L`, per SVG.
          x = numbers[index];
          y = numbers[index + 1];
          lineTo(x, y);
        }
      }
      continue;
    }
    if (command === "L") {
      for (let index = 0; index + 1 < numbers.length; index += 2) {
        x = numbers[index];
        y = numbers[index + 1];
        lineTo(x, y);
      }
      continue;
    }
    for (let index = 0; index + 3 < numbers.length; index += 4) {
      const controlX = numbers[index];
      const controlY = numbers[index + 1];
      const endX = numbers[index + 2];
      const endY = numbers[index + 3];
      for (let step = 1; step <= 8; step += 1) {
        const t = step / 8;
        const s = 1 - t;
        lineTo(s * s * x + 2 * s * t * controlX + t * t * endX, s * s * y + 2 * s * t * controlY + t * t * endY);
      }
      x = endX;
      y = endY;
    }
  }
  closeSubpath();
  return edges;
}

/**
 * The fraction of the stage inside `edges` — and inside `cutter` too, when the
 * operation is clipped.
 *
 * A scanline even-odd test on `STAGE_BLANKET.samplesX` x `samplesY` points.
 * **Even-odd because every path in this pack carries `fillRule: "evenodd"`** —
 * measured, 13638 of 13638 — which is also why the ornamental border, whose
 * bounding box is the whole stage and whose fill is a ring, correctly fails
 * this test on all 26 screens while passing the bounding-box filter on all 26.
 * That disagreement is the reason the raster is here at all.
 */
function coverageOf(edges, cutter) {
  const { samplesX, samplesY } = STAGE_BLANKET;
  let inside = 0;
  for (let row = 0; row < samplesY; row += 1) {
    const y = ((row + 0.5) * SS2_STAGE.height) / samplesY;
    const crossings = crossingsAt(edges, y);
    if (crossings.length === 0) continue;
    if (!cutter) {
      inside += spanCount(crossings);
      continue;
    }
    const cut = crossingsAt(cutter, y);
    if (cut.length === 0) continue;
    inside += spanCount(crossings, cut);
  }
  return inside / (samplesX * samplesY);
}

/**
 * How many of a row's samples fall inside the crossings, and inside the cutter
 * too when the operation is clipped.
 *
 * ► **A SPAN WALK WAS WRITTEN HERE FIRST AND WAS DELETED AFTER BEING
 *   MEASURED.** It filled between crossing pairs instead of testing each of the
 *   64 samples against every crossing, to kill what looked like the cost of the
 *   ornamental border — an ornament crosses a scanline many times and it is
 *   flattened on all 26 screens. Warm over the 26 screens: **23.1 ms with
 *   spans, 23.5 ms with this, both reporting 7 blankets.** The 35 ms the pass
 *   really cost was the bounding-box scan, which `pathBoxOf` now memoises; the
 *   sampling was never the problem. What the span version did have was two
 *   half-open helpers converting an x back into a column index, which is a bug
 *   surface bought with nothing. **The optimisation that is not measured is the
 *   one that adds the defect.**
 */
function spanCount(crossings, cut) {
  const { samplesX } = STAGE_BLANKET;
  let count = 0;
  for (let column = 0; column < samplesX; column += 1) {
    const x = ((column + 0.5) * SS2_STAGE.width) / samplesX;
    if (!isInside(crossings, x)) continue;
    if (cut && !isInside(cut, x)) continue;
    count += 1;
  }
  return count;
}

/**
 * Where a horizontal line at `y` crosses the edge list, sorted left to right.
 *
 * ► **`<=` ON BOTH ENDS, so a vertex sitting exactly on the scanline is
 *   counted once rather than twice or not at all.** A half-open rule is the
 *   standard fix for the degenerate case: at a vertex shared by two edges
 *   exactly one of them straddles the line, whichever way the rule points.
 *
 * ► **THIS LINE IS THE ONE THING IN `stageBlanketsOf` THAT NO TEST PINS, AND
 *   IT IS SAID HERE RATHER THAN DISCOVERED LATER.** Measured by mutation
 *   2026-09-14, 20 one-line breakages of this feature against
 *   `test/render-screen.test.js`: 18 turn it red and **the two survivors are
 *   both this line** — `<` on both ends, and the MIXED `(y1 <= y) === (y2 <
 *   y)`.
 *
 *   The first survivor is not a defect: a rule consistent with itself is
 *   correct whichever end it is open at, so that mutation is an equivalent
 *   implementation and killing it would mean over-fitting the test to this
 *   spelling. **The second one IS a defect and survives anyway**, which is the
 *   part worth knowing. A mixed rule makes a horizontal edge lying exactly on
 *   a scanline straddle it, and `(y - y1) / (y2 - y1)` is then `0 / 0`, so a
 *   NaN goes into the crossing list. A fixture was built to catch it — a
 *   rectangle from y = 5 to y = 415, both of them sample-row centres — and
 *   **both spellings still answered 0.976**, because the NaN sorts and
 *   compares its way to the same parity. It was not added, because a test that
 *   passes under the bug is worse than no test.
 *
 *   An earlier version of this comment asserted the opposite — that `<=`
 *   mattered because shape 647's edges land on sample rows. They do not: rows
 *   are sampled at their CENTRES, y = 5, 15 … 415, and that rectangle's edges
 *   are at 0 and 420. **The real pack has never reached the degenerate case at
 *   all.** The claim was written from reading rather than from running, which
 *   is the failure this file's header is about, committed inside the fix for
 *   it.
 */
function crossingsAt(edges, y) {
  const xs = [];
  for (const [x1, y1, x2, y2] of edges) {
    if ((y1 <= y) === (y2 <= y)) continue;
    xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
  }
  xs.sort((left, right) => left - right);
  return xs;
}

function isInside(crossings, x) {
  let count = 0;
  for (const crossing of crossings) {
    if (crossing >= x) break;
    count += 1;
  }
  return count % 2 === 1;
}

/* ------------------------------------------------------------------ */
/* Colour transforms                                                   */
/* ------------------------------------------------------------------ */

/**
 * Whether a normalised transform carries COLOUR — red, green or blue moved at
 * all — as opposed to moving only alpha.
 *
 * ► **NOT THE SAME QUESTION AS `colourTransformApplies` IN `filters.js`, and
 *   that is why this one is still here after the fold.** That one asks "would
 *   this transform change THIS fill", which needs a fill to answer. The
 *   question `bitmapColourTransformDropped` has to ask is "does this transform
 *   carry colour a raster has nowhere to put", and there is no fill in it: a
 *   bitmap's op reports `fill: "none"` precisely so the raster is not painted
 *   over, so the fill-shaped question answers no for every bitmap and would
 *   count nothing forever. An approximation counted by a predicate that cannot
 *   fire is the six-times-repeated defect on this project in its purest form.
 *
 * Takes the eight-number array `colourTransformFrom` returns, so it reads both
 * pack shapes rather than only the named-object one.
 *
 * ► **BOTH HALVES ARE DEAD ON THE REAL PACK AND ONLY ONE OF THEM WAS PINNED
 *   ANYWHERE.** Measured 2026-09-14: all 8 bitmap paths that sit under a
 *   colour transform are under the same alpha-only one, so this returns false
 *   every time it is called on real data. Deleting the three OFFSET checks —
 *   `colour[4]`, `colour[5]`, `colour[6]` — left the whole test file green;
 *   deleting the three MULTIPLIER checks did not, because `market`'s
 *   `HALF_RED` bitmap fixture covers them.
 *
 *   The offset half is not dead because offsets are rare: 133 of the 287
 *   tinted drawables on this pack carry one. It is dead because the
 *   combination `identity multipliers WITH a non-zero offset` occurs ZERO
 *   times here, so the multiplier half happens to subsume it. That is a fact
 *   about this build, not about the format, and it is exactly the kind of fact
 *   that turns into a silent hole when the pack changes. **KEPT AND NOW
 *   EXERCISED** — `tintPack` in `test/render-screen.test.js` puts a bitmap
 *   under identity multipliers and offsets 17/0/-9, which is the only shape of
 *   transform for which these three checks are the thing that answers. An
 *   offset really does carry colour a raster cannot take: `#000000` under
 *   redOffset 17 is `#110000`.
 */
function touchesRgb(colour) {
  if (!colour) return false;
  return colour[0] !== 1 || colour[1] !== 1 || colour[2] !== 1
    || colour[4] !== 0 || colour[5] !== 0 || colour[6] !== 0;
}

/**
 * A gradient with the transform folded into every stop.
 *
 * ► **EXACT FOR A MULTIPLIER, APPROXIMATE FOR AN ALPHA OFFSET, and the
 *   difference is the canvas ramp.** Transforming the stops and letting the
 *   ramp interpolate is the same picture as transforming the interpolated
 *   result whenever the transform is linear in the interpolated quantity — true
 *   of the colour channels, and true of alpha under a pure multiplier even if
 *   the implementation interpolates premultiplied. An alpha OFFSET added to
 *   stops of differing opacity is not, so it is counted. Measured on this
 *   pack: no drawable on any of the 26 screens carries a non-zero alphaOffset,
 *   so the count is currently zero and exists to notice if that stops being
 *   true.
 */
function transformGradient(gradient, colour, approximations) {
  if (!colour) return gradient;
  const stops = Array.isArray(gradient.stops) ? gradient.stops : [];
  if (stops.length === 0) return gradient;
  if (colour[7] !== 0) {
    const opacities = new Set(stops.map((stop) => numberOr(stop.opacity, 1)));
    if (opacities.size > 1) approximations.gradientAlphaOffsetApproximated += 1;
  }
  return Object.freeze({
    ...gradient,
    stops: Object.freeze(stops.map((stop) => Object.freeze({
      ...stop,
      fill: applyColourTransform(stop.fill, colour),
      opacity: applyColourTransformAlpha(numberOr(stop.opacity, 1), colour)
    })))
  });
}

/* ------------------------------------------------------------------ */
/* Text — counted, carried, and not drawn                              */
/* ------------------------------------------------------------------ */

/**
 * The screen's text placements, joined to the extractor's `unresolved` roster
 * so each one carries the KIND it was counted under.
 *
 * ► **THE WORDS ARE KNOWN AND THE LETTERFORMS ARE NOT — IN *THIS* PACK.**
 *   `assets/screens/screens.json` carries no glyph outlines, so these are not
 *   path operations and must never be dropped into `ops` as though they were.
 *   What they are is everything a surface with a face needs: the string, the
 *   box in pixels, the font's id, name and weight, the colour, the alignment.
 *   187 of them across the 26 screens.
 *
 * ► **AND A SIBLING SHIPPED THE OTHER HALF IN THE SAME SESSION.**
 *   `tools/extract-text.mjs` writes `assets/text/` and `src/render/text.js`
 *   exports `textOpsFor`/`staticTextOpsFor`. These entries are the input that
 *   module wants, so the join is a caller's two lines and not a rewrite here —
 *   deliberately NOT imported, because a pack this file cannot see must not
 *   become a dependency a clone without it trips over. When that join is made,
 *   `textNotDrawn` stops being the whole story and whoever makes it should say
 *   what the new count is.
 *
 * ► **AND THE GEOMETRY IS CONVERTED TO PIXELS HERE.** The pack states a text
 *   box, a font height and a run's advances in TWIPS; `matrix` stays in the
 *   operation convention with a twips translation. Inside that matrix the space
 *   is pixels, which is where the box lives, so converting at this seam is what
 *   stops a caller holding two units for one object.
 */
function textOf(pack, screen, approximations) {
  const kinds = new Map();
  for (const entry of Array.isArray(screen.unresolved) ? screen.unresolved : []) {
    if (!Array.isArray(entry.path)) continue;
    kinds.set(entry.path.join("/"), entry);
  }
  const out = [];
  for (const field of Array.isArray(screen.textFields) ? screen.textFields : []) {
    out.push(editTextOf(pack, field, kinds));
  }
  for (const text of Array.isArray(screen.staticText) ? screen.staticText : []) {
    out.push(staticTextOf(pack, text, kinds));
  }
  // Paint order, so a caller setting text walks it in the same order it walked
  // the operations rather than editing two orders into agreement by hand.
  out.sort((left, right) => comparePath(left.path, right.path));
  approximations.textNotDrawn = out.length;
  return Object.freeze(out.map((entry) => Object.freeze(entry)));
}

function editTextOf(pack, field, kinds) {
  const path = Array.isArray(field.path) ? field.path : [];
  const detail = kinds.get(path.join("/"));
  return {
    kind: "text-edit",
    character: field.id ?? null,
    path: Object.freeze([...path]),
    depth: path.length > 0 ? path[0] : null,
    matrix: field.matrix,
    box: boxOf(field.bounds),
    text: typeof field.initialText === "string" ? field.initialText : "",
    // The name the build's ActionScript writes to. A surface showing live
    // values binds on this rather than on the initial string, which is a
    // placeholder the author happened to leave in the file.
    variableName: typeof field.variableName === "string" ? field.variableName : null,
    font: fontOf(pack, field.fontId),
    fontHeight: pixels(field.fontHeight),
    colour: hexOf(field.colour),
    opacity: opacityOf(field.colour),
    align: alignOf(field.align),
    leading: pixels(field.leading),
    leftMargin: pixels(field.leftMargin),
    rightMargin: pixels(field.rightMargin),
    indent: pixels(field.indent),
    multiline: field.multiline === true,
    wordWrap: field.wordWrap === true,
    readOnly: field.readOnly === true,
    why: detail?.detail ?? "an edit-text field: this pack carries no glyph outlines"
  };
}

function staticTextOf(pack, text, kinds) {
  const path = Array.isArray(text.path) ? text.path : [];
  const detail = kinds.get(path.join("/"));
  const runs = (Array.isArray(text.runs) ? text.runs : []).map((run) => Object.freeze({
    text: typeof run.text === "string" ? run.text : "",
    font: fontOf(pack, run.fontId),
    height: pixels(run.height),
    x: pixels(run.xOffset),
    y: pixels(run.yOffset),
    colour: hexOf(run.colour),
    opacity: opacityOf(run.colour),
    glyphs: numberOr(run.glyphs, 0),
    advances: Object.freeze((Array.isArray(run.advances) ? run.advances : []).map(pixels))
  }));
  return {
    kind: "text-static",
    character: text.id ?? null,
    path: Object.freeze([...path]),
    depth: path.length > 0 ? path[0] : null,
    matrix: text.matrix,
    box: boxOf(text.bounds),
    text: typeof text.text === "string" ? text.text : "",
    glyphs: numberOr(text.glyphs, 0),
    // ► Glyphs whose index reached no code table: the WORDS are not known
    //   either, and this is the number that says so. Zero on every screen of
    //   this pack, which is a measurement and not a guarantee.
    undecoded: numberOr(text.undecoded, 0),
    runs: Object.freeze(runs),
    why: detail?.detail ?? "a static-text character: this pack carries no glyph outlines"
  };
}

/** A font's identity, so a surface can choose a substitute face deliberately. */
function fontOf(pack, id) {
  if (id === null || id === undefined) return null;
  const font = pack.fonts?.[id] ?? pack.fonts?.[String(id)];
  if (!font) return Object.freeze({ id, name: null, bold: false, italic: false });
  return Object.freeze({
    id,
    name: typeof font.name === "string" ? font.name : null,
    bold: font.bold === true,
    italic: font.italic === true
  });
}

/** A twips RECT as a pixel box, with a width and height a layout can use. */
function boxOf(bounds) {
  if (!bounds || typeof bounds !== "object") return null;
  const xMin = pixels(bounds.xMin);
  const xMax = pixels(bounds.xMax);
  const yMin = pixels(bounds.yMin);
  const yMax = pixels(bounds.yMax);
  return Object.freeze({ x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin });
}

function hexOf(colour) {
  if (!colour || typeof colour !== "object") return null;
  return "#" + hex2(clampByte(colour.red)) + hex2(clampByte(colour.green)) + hex2(clampByte(colour.blue));
}

function opacityOf(colour) {
  if (!colour || typeof colour !== "object" || colour.alpha === undefined) return 1;
  return clampByte(colour.alpha) / 255;
}

/** Two lower-case hex digits, so `#0a0b0c` never comes back as `#a b c`. */
function hex2(value) {
  return value.toString(16).padStart(2, "0");
}

function clampByte(value) {
  const out = Math.round(numberOr(value, 0));
  return out < 0 ? 0 : out > 255 ? 255 : out;
}

/** The build's own alignment codes, named rather than passed through as digits. */
function alignOf(align) {
  if (align === 0) return "left";
  if (align === 1) return "right";
  if (align === 2) return "center";
  if (align === 3) return "justify";
  return null;
}

/* ------------------------------------------------------------------ */
/* Small shared readers                                                */
/* ------------------------------------------------------------------ */

/** The extractor's three unresolved kinds, recounted from its own roster. */
function kindsOf(screen) {
  const byKind = {};
  for (const entry of Array.isArray(screen.unresolved) ? screen.unresolved : []) {
    const kind = typeof entry?.kind === "string" ? entry.kind : "unknown";
    byKind[kind] = (byKind[kind] ?? 0) + 1;
  }
  return byKind;
}

/**
 * ~~The nesting paths of every placement carrying a FILTERLIST on this
 * screen.~~ **REPLACED 2026-09-15 BY `filterGroupDraftsOf`, AND THE DELETED
 * VERSION IS THE BUG.** `prefixesOf` read `entry.path` and dropped
 * `entry.filters` on the floor, so everything this module said about filters
 * was invariant under those records being correct, garbage or absent. The
 * fixture in `test/render-screen.test.js` carried a `filteredPlacements` entry
 * with NO `filters` key for months and nothing went red.
 *
 * A draft is one filtered subtree before its operations are known: the path it
 * owns, the filters themselves, and which of the pack's TWO filter lists it
 * came from. Sorted by `comparePath`, which puts an ancestor before its
 * descendants and otherwise follows the extractor's own drawable order, so a
 * group's parent is always earlier in the array than the group.
 *
 * Total, like every reader here: an entry with no usable `path` is skipped and
 * a missing `filters` becomes an empty list, which `canvasFilterFor` reports as
 * a group that applies nothing rather than throwing.
 */
function filterGroupDraftsOf(screen) {
  const drafts = [];
  collectFilterDrafts(drafts, screen?.filteredPlacements, "placement");
  // ► **THE SECOND LIST, AND LEAVING IT OUT WOULD HAVE BEEN INVISIBLE.** Five
  //   records, every one on `townsquare`, every one `leaf: "text"`, every one
  //   reaching zero operations here. A roster that omitted them would have
  //   been right about the picture and silent about the omission.
  collectFilterDrafts(drafts, screen?.filteredButtonRecords, "buttonRecord");
  drafts.sort((left, right) => comparePath(left.path, right.path));
  return drafts;
}

/** One of the pack's filter lists, appended to the drafts. */
function collectFilterDrafts(drafts, entries, source) {
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!Array.isArray(entry?.path)) continue;
    drafts.push({
      path: Object.freeze([...entry.path]),
      character: Number.isFinite(entry.character) ? entry.character : null,
      leaf: typeof entry.leaf === "string" ? entry.leaf : null,
      button: Number.isFinite(entry.button) ? entry.button : null,
      filters: Object.freeze(Array.isArray(entry.filters) ? [...entry.filters] : []),
      source
    });
  }
}

/**
 * THE FILTERED SUBTREES OF ONE SCREEN, each with the operations it owns, what
 * canvas can make of its filters, and where it sits in the nesting.
 *
 * ► **THE THREE DECISIONS IN HERE ARE IN THIS FILE'S HEADER, UNDER "FILTER
 *   GROUPS"** — why the operations are named by a half-open RANGE and what
 *   that costs, why nesting COMPOSES instead of picking a winner (which is the
 *   opposite of `blendFor` below, on purpose), and why `filter` is the scale-1
 *   string while `filters` is carried verbatim beside it. They are decisions
 *   rather than readings and they belong where a reader meets the output.
 *
 * Every count this fills in has a denominator, and the one that matters most
 * is `filterGroupsReachingNothing`: 108 of the 243 placements on this pack
 * cover no operation at all, and a roster that simply did not mention them
 * would read exactly like a build with no such filters.
 */
function filterGroupsOf(drafts, ops, screen, approximations) {
  const unresolved = Array.isArray(screen?.unresolved) ? screen.unresolved : [];
  const groups = [];
  const refusedByReason = {};
  const reachingNothingByKind = {};

  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index];
    // Scale 1. A painter drawing the stage at any other scale rebuilds the
    // string from `filters`; the buckets below do not move with scale.
    const built = canvasFilterFor(draft.filters);

    // The operations this subtree owns, found ONCE, over the array the range
    // will index. `first`/`last` bracket them and `count` is exact, so a run
    // that is not contiguous is reported rather than mis-stated.
    let first = -1;
    let last = -1;
    let count = 0;
    for (let at = 0; at < ops.length; at += 1) {
      if (!isPrefix(ops[at].path, draft.path)) continue;
      if (first < 0) first = at;
      last = at;
      count += 1;
    }
    const opFirst = first < 0 ? 0 : first;
    const opEnd = first < 0 ? 0 : last + 1;
    const contiguous = opEnd - opFirst === count;

    // The INNERMOST filtered ancestor: the longest path that is a strict
    // prefix of this one. Drafts are sorted ancestor-first, so it is always an
    // index already in `groups`.
    let parent = null;
    for (let other = 0; other < groups.length; other += 1) {
      const candidate = groups[other];
      if (candidate.path.length >= draft.path.length) continue;
      if (!isPrefix(draft.path, candidate.path)) continue;
      if (parent === null || candidate.path.length > groups[parent].path.length) parent = other;
    }

    // What the subtree covers that this module does NOT emit. For the 113
    // groups that reach no operation this is the whole answer — they are text
    // — and for the rest it is the part of the group a painter will not see.
    const kinds = new Set();
    let unresolvedUnder = 0;
    for (const entry of unresolved) {
      if (!Array.isArray(entry?.path) || !isPrefix(entry.path, draft.path)) continue;
      unresolvedUnder += 1;
      kinds.add(typeof entry.kind === "string" ? entry.kind : "unknown");
    }

    groups.push({
      index,
      path: draft.path,
      character: draft.character,
      source: draft.source,
      ...(draft.leaf !== null ? { leaf: draft.leaf } : {}),
      ...(draft.button !== null ? { button: draft.button } : {}),
      // The records as the pack states them, so a painter can rebuild the
      // string at its own scale — see decision 3 in the header.
      filters: draft.filters,
      filter: built.filter,
      // ► **THE AMPLIFIED PLAN TRAVELS BESIDE THE STRING, NEVER INSTEAD OF IT.**
      //   `null` for all but a saturating glow list, and a painter that does not
      //   know the field keeps drawing exactly what it drew before. See
      //   `glowAmplificationFor` for what it describes and why it declines.
      amplify: glowAmplificationFor(draft.filters, { scale: 1 }),
      applied: built.applied,
      deferred: built.deferred,
      noOps: built.noOps,
      refused: built.refused,
      colourMatrices: built.colourMatrices,
      counts: built.counts,
      parent,
      children: [],
      opFirst,
      opEnd,
      opCount: count,
      contiguous,
      // Filled in below, once every group exists.
      ownOpCount: count,
      unresolvedUnder,
      unresolvedKinds: Object.freeze([...kinds].sort())
    });

    for (const entry of built.refused) {
      const key = `${entry.type ?? "unknown"}:${entry.reason}`;
      refusedByReason[key] = (refusedByReason[key] ?? 0) + 1;
    }
  }

  // Children, and the operations a group draws ITSELF. Siblings cannot
  // overlap — neither path is a prefix of the other — and every child's
  // operations are inside its parent's, so subtracting each child's count once
  // is exact rather than an estimate.
  //
  // ► **UNLESS TWO GROUPS SHARE A PATH, WHICH IS THE ONE WAY `ownOpCount` CAN
  //   LIE.** Two placements at the same path are siblings by the rule above —
  //   neither is a STRICT prefix of the other — so both would be subtracted
  //   from a common parent and the same operations taken out twice. Measured
  //   2026-09-15: **0 shared paths across the 248 groups**, counting
  //   `filteredPlacements` and `filteredButtonRecords` together. That is a
  //   property of this extraction and not of the format, so it is COUNTED
  //   rather than assumed, and `ownOpCount` is exact exactly when
  //   `filterGroupsSharingAPath` is 0.
  const seenPaths = new Set();
  for (const group of groups) {
    const key = group.path.join(",");
    if (seenPaths.has(key)) approximations.filterGroupsSharingAPath += 1;
    seenPaths.add(key);
    if (group.parent === null) continue;
    groups[group.parent].children.push(group.index);
    groups[group.parent].ownOpCount -= group.opCount;
  }

  // The op-level five facts. Recomputed from the groups over the operations,
  // not accumulated while emitting: an operation under two groups is ONE
  // operation in each of these counts, and incrementing per (op, group) pair
  // would inflate every one of them by 40% on this pack.
  for (const op of ops) {
    let underAny = false;
    let string = false;
    let matrix = false;
    let refused = false;
    for (const group of groups) {
      if (!isPrefix(op.path, group.path)) continue;
      underAny = true;
      if (group.filter !== null) string = true;
      if (group.colourMatrices.length > 0) matrix = true;
      if (group.refused.length > 0) refused = true;
    }
    if (!underAny) continue;
    if (string) approximations.opsWithCanvasFilter += 1;
    if (matrix) approximations.opsWithDeferredColourMatrix += 1;
    if (refused) approximations.opsUnderRefusedFilter += 1;
    if (!string && !matrix) approximations.filtersNotApplied += 1;
    if (!string && !matrix && !refused) approximations.opsUnderNoOpFilterOnly += 1;
  }

  approximations.filterGroups = groups.length;
  for (const group of groups) {
    if (group.source === "placement") approximations.filterGroupsFromPlacements += 1;
    if (group.source === "buttonRecord") approximations.filterGroupsFromButtonRecords += 1;
    if (group.opCount > 0) approximations.filterGroupsReachingOps += 1;
    else {
      approximations.filterGroupsReachingNothing += 1;
      const key = group.unresolvedKinds.length > 0 ? group.unresolvedKinds.join("+") : "nothing-in-the-pack";
      reachingNothingByKind[key] = (reachingNothingByKind[key] ?? 0) + 1;
    }
    if (group.parent !== null) approximations.filterGroupsNested += 1;
    if (group.opCount > 0 && !group.contiguous) approximations.filterGroupsNotContiguous += 1;
    approximations.filtersTotal += group.counts.total;
    approximations.filtersApplied += group.counts.applied;
    approximations.filtersDeferredToColourMatrix += group.counts.deferred;
    approximations.filtersNoOp += group.counts.noOp;
    approximations.filtersRefused += group.counts.refused;
  }
  approximations.filterGroupsReachingNothingByKind = Object.freeze(reachingNothingByKind);
  approximations.filtersRefusedByReason = Object.freeze(refusedByReason);

  for (const group of groups) {
    group.children = Object.freeze(group.children);
    Object.freeze(group);
  }
  return Object.freeze(groups);
}

/** The same for blend modes, keeping the mode itself. */
function blendPrefixesOf(placements) {
  const out = [];
  for (const entry of Array.isArray(placements) ? placements : []) {
    if (Array.isArray(entry?.path) && Number.isFinite(entry.blendMode)) {
      out.push({ path: entry.path, blendMode: entry.blendMode });
    }
  }
  return out;
}

/**
 * Whether a leaf sits UNDER one of those placements.
 *
 * By path prefix rather than by top depth: a filter on a nested clip affects
 * everything inside it and nothing beside it, and matching on depth alone would
 * mark a whole screen filtered because one of its buttons glows.
 */
function matchesPrefix(path, prefixes) {
  for (const prefix of prefixes) {
    if (isPrefix(path, prefix)) return true;
  }
  return false;
}

function blendFor(path, placements) {
  // The INNERMOST blend wins, which is the one actually compositing this leaf.
  let found = null;
  let depth = -1;
  for (const entry of placements) {
    if (isPrefix(path, entry.path) && entry.path.length > depth) {
      found = entry.blendMode;
      depth = entry.path.length;
    }
  }
  return found;
}

function isPrefix(path, prefix) {
  if (prefix.length > path.length) return false;
  for (let index = 0; index < prefix.length; index += 1) {
    if (path[index] !== prefix[index]) return false;
  }
  return true;
}

function comparePath(left, right) {
  const shortest = Math.min(left.length, right.length);
  for (let index = 0; index < shortest; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

function pixels(twips) {
  return numberOr(twips, 0) / TWIPS_PER_PIXEL;
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
