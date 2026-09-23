/**
 * THE BUILD'S OWN COMBAT PROPS, drawn — the arrow, its trail, and whatever else
 * `tools/extract-props.mjs` has pulled out of the player's install.
 *
 * ## Same shape as `extracted-figure.js`, and deliberately so
 *
 * A pack is an ARGUMENT, never a table in the file: this repository ships no SS2
 * asset, so a player who has not run the extractor gets `null` from every
 * function here and the caller falls back to its own authored art. That is the
 * identical arrangement `sound.js` and `extracted-figure.js` already have, and
 * the fallback is not an error path — it is the supported way to run the arena
 * without a licensed copy.
 *
 * ## What a prop's FRAME means, and why this module refuses to decide
 *
 * ~~A prop clip is a lookup, not an animation~~ — **SOME ARE A LOOKUP AND SOME
 * ARE A CLOCK, AND GENERALISING FROM THE ARROW DREW NO TRAIL AT ALL FOR 14 OF
 * THE 20 BOWS.** `bullet` really is a lookup: the build reaches its frames with
 * `gotoAndStop(secondary_weapon - 60)`. `bullet_trail` is a CLOCK, and the
 * sentence above is what let `arrowTrailOpsFor` push a weapon index into it —
 * see that function for the bytes and for what it cost. **Which frame a caller
 * wants is still the caller's business** — `src/adapter/presentation.js`
 * derives the ARROW's from the weapon table and stamps it on the command — and
 * this module only reports what is on the frame it is handed. What it can do,
 * and now does, is make each convenience wrapper NAME the quantity its own
 * clip's frame is, so the two cannot be swapped by a reader in a hurry.
 *
 * ► **AND WHAT IS ON THEM IS NOT WHAT THE `gotoAndStop` IMPLIES.** `bullet`
 *   declares fifty frames and holds **five distinct arrows**: frames 1-5, and
 *   every frame from 6 to 50 repeating the fifth. So bows 61-65 have their own
 *   art and 66-80 share one. A caller asking for frame 17 gets a real answer
 *   and it is the same drawing frame 6 gave.
 *
 * ## THE PLACEMENT'S COLOUR TRANSFORM IS APPLIED HERE — since 2026-09-14
 *
 * ► **UNTIL THAT DATE THIS FILE READ `matrix` AND `clip` OFF A PLACEMENT AND
 *   WALKED PAST `colour`,** so every prop drew at its authored colour and full
 *   alpha. It is the same shape of defect as the bitmap fill above: the data
 *   was in the pack, nobody read it, and no count said so. The visible cost was
 *   an arena UI bar rendering as a blank white strip and an arrow trail whose
 *   last puff drew SOLID instead of invisible.
 *
 * Measured on this repository's own `assets/props/props.json`, with
 * `colourTransformFrom` deciding what counts as non-identity so the tally is
 * the renderer's own opinion and not a second one:
 *
 * ```text
 *   3,345 placements    2,330 under a NON-IDENTITY transform   (1,015 identity)
 *   8,682 operations    7,246 under one
 *   7,215 of those 7,246 are the SKY — ~~its day/night colouring IS this
 *         transform, swept across 200 frames, and not a ColorMatrix~~
 *       0 of the 7,246 land on a fill the arithmetic cannot express
 * ```
 *
 * ► **THAT STRUCK LINE WAS WRONG, AND IT IS THE WHOLE REASON FOR THE SECTION
 *   BELOW.** The transform is real and is applied; it is not what makes the sky
 *   go dark. Measured 2026-09-15 on the regenerated pack: `sky` carries **362
 *   enclosing effect groups over its 3,202 placements, 150 colour matrices
 *   among them, 148 of those non-identity**, and until that date nothing in
 *   this file read one. The backdrop gradient of frame 1 is `#2d2dfd`→`#5fbefe`
 *   after the transform and **`#440037`→`#79689f` after the group's matrix**;
 *   frame 200's is `#000030`. The transform moves the sky by a few units and
 *   the matrix moves it from blue to maroon to black. `HANDOFF.md`'s living
 *   head had it right — *"the sky's day/night colouring IS a ColorMatrix"* —
 *   and this header contradicted it for a day.
 *
 * ► **MOST PLACEMENTS IN THIS PACK ARE TINTED, WHICH IS THE OPPOSITE OF THE
 *   SCREENS PACK AND OF WHAT THE BRIEF FOR THIS WORK ASSUMED.** 70% of them,
 *   because the sky alone is 3,202 placements sweeping a gradient through dusk.
 *   `colourTransformFrom` still collapses the identity to `null` — it has to,
 *   or "does this placement carry a tint" answers yes for all 3,345 — but the
 *   *reason* to normalise here is not that the pack is mostly identity. It is
 *   not.
 *
 * ► **AND THE RGB HALF OF THE GRADIENT FOLD IS REACHABLE ON THIS PACK, WHICH IT
 *   IS NOT ON THE SCREENS ONE.** `screen.js`'s header records that all 107 of
 *   its transformed gradient stops sit under ALPHA-ONLY transforms, so deleting
 *   its stop-fill transform moved nothing and no digest noticed. Here, 885
 *   gradient operations sit under a transform and **70 of their stops are under
 *   a transform that moves red, green or blue** — `sky` frame 88 fills shape
 *   1679 with a `#2d2dfd`→`#5fbefe` ramp under multiplier 0.91015625 and offset
 *   23, which is `#3f3ffd`→`#6dc3fe` once folded. The test file pins those two
 *   hex values against the real pack, so the line that is dead over there is
 *   alive over here.
 *
 * ► **FLOOR VERSUS ROUND IS NOT LATENT ON THIS PACK EITHER.** The 7,246 tinted
 *   operations carry 7,246 `#rrggbb` sites — 6,663 fills and 583 strokes —
 *   4,575 of which sit under a transform that moves colour at all, and
 *   **3,888 of those come out a unit apart if the arithmetic rounds**, against
 *   69 of 1023 on the screens pack. `applyColourTransform` in `filters.js`
 *   floors because the player computes `(channel * multTerm) >> 8`; this file
 *   calls it rather than growing a fourth copy, and the test pins `sky` frame 1
 *   at `#4c4c70` — `#4d4d71` rounded — so a return to rounding turns the suite
 *   red rather than shifting the whole sky by one unit.
 *
 * ► **AND THE STROKE LINE IS THE ONE THIS PACK CANNOT REACH.** All 4,575 of
 *   those colour-moving sites are FILLS: **0 of the 583 tinted strokes sits
 *   under a transform that moves red, green or blue**, so deleting the stroke's
 *   `applyColourTransform` would leave every assertion against the real pack
 *   green. `tintPack` in `test/render-props.test.js` is what stands under it —
 *   the same hole the screens pack has at gradient stops, in a different field.
 *
 * ## THE ENCLOSING GROUP'S FILTERS — read here since 2026-09-15
 *
 * A placement in this pack may sit inside a filtered SPRITE, and the pack says
 * so: `inheritedEffects` on the placement holds indices, OUTERMOST FIRST, into
 * its prop's own `effectGroups`. **`emitPropOps` read none of it until that
 * date** — the same shape of hole as `colour` above and as the bitmap fill
 * before that, and again with no count saying so.
 *
 * ```text
 *   3,345 placements    3,209 inside an effect group      (136 inside none)
 *     363 groups        362 on `sky`, 1 on `bullet_trail`
 *     570 filter records on them: 212 glow, 208 blur, 150 colourMatrix
 *       1 blend mode: `bullet_trail`'s `lighten`
 * ```
 *
 * ► **A FILTER ON A GROUP IS A FILTER OF THE COMPOSITE, so this module folds
 *   exactly one of the three kinds and REFUSES to fold the other two.** Flash
 *   rasterises the group and filters the result. Stamping a blur onto each leaf
 *   blurs every path separately, which is a different picture that looks
 *   plausible — the defect this project keeps paying for. So:
 *
 *   - **Colour matrices ARE folded, into every fill, stroke and gradient stop,
 *     because per-fill application is EXACT.** The proof is
 *     `colourMatrixIsFillExact`'s docstring in `filters.js`: a matrix is
 *     affine, alpha-over is a convex combination, so `M(blend(a,b))` equals
 *     `blend(M(a),M(b))` — with the one exception of a matrix whose alpha row
 *     is not `(0,0,0,1,0)`, which paints the group's empty area too. **All 150
 *     of this pack's group matrices have the plain alpha row** (`mExact` 150 of
 *     150, measured by walking `effectGroups` and calling that predicate), so
 *     the fold is exact for every one of them — and `groupMatrixNotFillExact`
 *     counts the case anyway, because that is a fact about THIS BUILD and not
 *     about the format.
 *   - **Blurs and glows are NOT folded.** They ride on the op as a frozen
 *     GROUP RECORD for a painter that can composite to a buffer, and
 *     `groupFilterOps` counts how many operations are waiting on one.
 *   - **Blend modes are not folded either**, for the same reason, and ride on
 *     the same record as `composite`.
 *
 * ► **AND THIS PACK IS NOT THE CATASTROPHE THE SCREENS PACK IS — MEASURED, NOT
 *   ASSUMED.** Per FRAME (which is the unit a painter draws), **486 of the 745
 *   group instances cover exactly ONE operation**, and the largest covers 56.
 *   A group over one drawable IS its own composite, so for those 486 per-leaf
 *   and per-group coincide EXACTLY and a painter that simply set `ctx.filter`
 *   around the single path would be right. The 259 that do not coincide are
 *   `sky`'s moon (56 ops), its stars (23) and its cloud bank (12) — and they
 *   are exactly the groups carrying glows rather than matrices, so the half
 *   this module folds is the half where the distinction does not arise.
 *   Reproduce by counting ops under each `inheritedEffects` index per frame;
 *   the distribution is `{1:486, 4:7, 12:102, 23:61, 56:89}`.
 *
 * ► **THE GRADIENT FOLD IS THE ONE APPROXIMATION IN IT, AND IT IS LARGE.** A
 *   matrix folded into the stops is exact only while no stop SATURATES: canvas
 *   interpolates the ramp and then would clamp, this clamps at the stops and
 *   then interpolates. Measured on the real pack: **3,137 of the 3,694 folded
 *   stops have at least one channel outside 0..255 before clamping**, over 993
 *   gradient operations. That is counted as `groupMatrixGradientOps` — the
 *   whole population, not the saturating subset, because detecting saturation
 *   needs `applyColourMatrix` to report that it clamped and this module refuses
 *   to grow a second copy of that arithmetic to find out. **Not folding is the
 *   worse answer**: it is the sky's entire day/night cycle.
 *
 * ► **THE GROUP'S OWN MATRIX IS NOT IN THE PACK** — `tools/extract-props.mjs`
 *   counts 362 of them in `notCarried.effectGroupMatrix` — so a blur radius
 *   here is in the group's own space and a painter must scale it by the STAGE
 *   scale. That is what `canvasFilterFor`'s `scale` option is for, and
 *   `propEffectGroupsFor` takes it and passes it straight through.
 *
 * ► **WHAT STILL REACHES NOTHING: the arena UI bar's two own glows.**
 *   `panel` carries `notCarried.unsupportedDrawableFilters: 2` — characters
 *   1527 and 1528, glows on TEXT FIELDS, whose drawables the extractor skips
 *   because a text field is not a shape. There is no shape in the pack for a
 *   glow to sit on, so no renderer can draw them from this pack at all. What it
 *   would take: `screen-text.js` emits those fields, so the two would have to
 *   be joined to a TEXT operation rather than a path one, and the pack would
 *   have to carry the filter against the field instead of dropping it with the
 *   drawable. `propEffectsUnreachable` reports them rather than letting a zero
 *   elsewhere read as "nothing lost".
 *
 * ## THE INVOICE IS A SECOND FUNCTION, NOT A SECOND RETURN VALUE
 *
 * `propOpsFor` returns a flat frozen array and callers index it, so the two
 * cases the fold cannot express have nowhere to ride home. They go through
 * `propInvoiceFor`, which runs **the same walk** — one private `emitPropOps`,
 * so there is no second traversal to drift out of step with the first — and
 * returns only the counts. Rejected alternatives, named so nobody re-litigates
 * them silently:
 *
 * - *A sink in the options bag.* `arena-backdrop.js` INJECTS `propOpsFor` as a
 *   `(pack, { linkage, frame })` function and that seam is not this module's to
 *   widen; a sink would also have to be threaded through it to be reachable.
 * - *A richer return shape.* `{ ops, invoice }` breaks every caller that
 *   indexes the result, which is most of them.
 *
 * The cost is honest and stated: asking for both walks the frame twice. The
 * invoice is a diagnostic — a manifest line, a test — and nothing on the
 * per-frame paint path asks for it.
 *
 * ► **THE GROUP RECORD IS THE EXCEPTION, AND IT RIDES ON THE OP RATHER THAN
 *   BESIDE IT.** `op.group` is a FROZEN RECORD, INTERNED — every operation
 *   under one group holds the same object, so `op.group !== previous` is all a
 *   painter needs to know where to flush a buffer, and it needs no second call
 *   and no second argument threaded through `arenaScreenLayersFor`'s injected
 *   seam. Rejected: *an id plus a lookup table*, which would have made the
 *   painter call a second function with the same `{linkage, frame}` and be
 *   silently wrong the moment the two arguments drifted apart.
 *   `propEffectGroupsFor` still exists for a caller that wants the table
 *   WITHOUT the operations — a manifest line, a test — and runs the same walk.
 *
 * ► **THE RECORD DELIBERATELY DOES NOT CARRY ITS COLOUR MATRICES.** They are
 *   already folded into the fills by the time the record is frozen, and handing
 *   them back as well is an invitation to apply them twice. `filter` is the
 *   blur/glow string and NOTHING in it is a colour matrix —
 *   `colourMatrixFilterString` refuses every one of them, so there is no route
 *   by which one could be in there. What the record carries instead is
 *   `colourMatricesFolded`, a count.
 */

import {
  applyColourMatrix,
  applyColourTransform,
  applyColourTransformAlpha,
  blendModeFor,
  canvasFilterFor,
  colourMatrixIsFillExact,
  colourTransformFrom,
  glowAmplificationFor,
} from "./filters.js";

export class PropsError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * A drawable pack from the JSON `tools/extract-props.mjs` writes, or null.
 *
 * **Total rather than throwing**, for the reason `bindingsFrom` is: a missing,
 * truncated or hand-edited pack must leave the arena playable and drawing its
 * authored art, never broken. The arena is the thing a person looks at, and a
 * stack trace where an arrow should be is a worse outcome than a plain one.
 */
export function propPackFrom(data) {
  if (!data || typeof data !== "object") return null;
  const props = data.props;
  const shapes = data.shapes;
  if (!props || typeof props !== "object" || !shapes || typeof shapes !== "object") return null;
  return Object.freeze({ props: Object.freeze(props), shapes: Object.freeze(shapes) });
}

/** Whether a pack holds anything drawable at all. */
export function hasExtractedProps(pack) {
  return Boolean(pack && pack.props && Object.keys(pack.props).length > 0);
}

/**
 * How many frames a prop has, or 0 — so a caller can clamp its own index
 * rather than discovering the end by getting nothing back.
 */
export function propFrameCount(pack, linkage) {
  const prop = pack?.props?.[linkage];
  return Array.isArray(prop?.frames) ? prop.frames.length : 0;
}

/**
 * A fresh, MUTABLE invoice. Every field starts at zero and only ever goes up.
 *
 * ► **THE DENOMINATORS ARE HERE ON PURPOSE.** `screen.js` reports its two
 *   approximation counts as bare zeros, and its own header records what that
 *   cost: a zero with no denominator does not say whether the counter is quiet
 *   or DEAD, and both of these are dead on the real pack. Measured 2026-09-14
 *   on `assets/props/props.json`: **41 bitmap path operations, 0 of them under
 *   a colour transform of any kind**, and **0 of the 3,345 placements carries a
 *   non-zero `alphaOffset` at all**. So `bitmapColourTransformDropped` and
 *   `gradientAlphaOffsetApproximated` cannot fire on this build's props, and
 *   `bitmapOps`/`gradientOps`/`tintedOps` beside them are what says so out loud
 *   instead of letting two zeros read as "nothing was lost". The synthetic
 *   packs in `test/render-props.test.js` reach both, because a counter this
 *   pack cannot exercise is a counter nothing pins.
 */
function emptyInvoice() {
  return {
    // Denominators, so every zero below can be read.
    placements: 0,
    tintedPlacements: 0,
    ops: 0,
    tintedOps: 0,
    bitmapOps: 0,
    gradientOps: 0,
    // Nothing was drawn for these, and each one used to be a silent `continue`.
    shapesMissing: 0,
    shapesWithNoPaths: 0,
    clipsUnresolved: 0,
    // The two colour-transform cases that do not fold into an operation. Same
    // names as `screen.js` uses, deliberately: they are the same two facts and
    // a manifest that joins the two packs should not have to translate.
    bitmapColourTransformDropped: 0,
    gradientAlphaOffsetApproximated: 0,

    /* THE ENCLOSING GROUPS. Denominators first, for the reason above. -------- */

    // Populations. `groupedOps` is the denominator every count below it is read
    // against; `ops` is the denominator IT is read against.
    effectGroups: 0,
    groupedPlacements: 0,
    groupedOps: 0,
    // A chain deeper than one needs a STACK of buffers, not one buffer. Every
    // one of this pack's 3,209 chains has length 1 and every group path has
    // length 1, so this is 0 on the real pack and the synthetic pack in
    // `test/render-props.test.js` is the only thing that can move it.
    nestedGroupPlacements: 0,
    // A group index a placement names and the prop does not hold, counted ONCE
    // per distinct index per frame — the same population `effectGroups` above
    // it counts, so the two are read against each other. Was a silent skip for
    // as long as this file ignored the field entirely.
    groupsUnresolved: 0,

    // What `canvasFilterFor` says a renderer can do with the groups' filters,
    // summed over the DISTINCT groups this frame reaches. Its verdicts, not a
    // second opinion — the same arrangement `tools/extract-props.mjs` uses so
    // that "the pack carries it" and "the renderer can draw it" cannot drift.
    groupFilters: 0,
    groupFiltersApplied: 0,
    groupFiltersDeferred: 0,
    groupFiltersNoOp: 0,
    groupFiltersRefused: 0,
    groupBlendModes: 0,
    groupBlendModesRefused: 0,

    // ► **THE ONE NUMBER THAT SAYS WHAT IS STILL NOT DRAWN.** Operations under
    //   a group whose blur or glow this module CANNOT fold and hands to the
    //   painter instead. It is not a loss while a painter composites them and
    //   it is a total loss while none does, so it is counted either way and the
    //   arena's log prints it against `groupedOps`.
    groupFilterOps: 0,

    // What the colour-matrix fold reached. `groupMatrixOps` is the denominator
    // and the four below it partition it exactly.
    groupMatrixOps: 0,
    groupMatrixSolidOps: 0,
    groupMatrixGradientOps: 0,
    groupMatrixDroppedOps: 0,
    groupMatrixStrokeOps: 0,
    // Dead on this build and kept for the reason the two above it are: **all
    // 150 group matrices here have the plain alpha row**, so per-fill is exact
    // for every one and this cannot fire. A matrix that painted the group's
    // empty area would, and nothing but the synthetic pack can show it.
    groupMatrixNotFillExact: 0,
    // The matrix was folded although its own group ALSO blurs or glows, so this
    // module has chosen an order the filter list may not state. Exact for a
    // matrix with no offset, and near-exact otherwise away from an alpha edge,
    // because a blur's weights sum to 1 and carry an affine map straight
    // through. 148 of `sky`'s frames reach this through `cloud_patterns`, whose
    // list really is `[blur, colourMatrix]`.
    groupMatrixFoldedUnderAFilter: 0
  };
}

/**
 * Whether a normalised transform carries COLOUR — red, green or blue moved at
 * all — as opposed to moving only alpha.
 *
 * ► **NOT `colourTransformApplies` FROM `filters.js`, AND THE DIFFERENCE IS THE
 *   WHOLE POINT OF THE COUNT.** That one asks "would this change THIS fill",
 *   which needs a fill; a bitmap operation reports `fill: null` precisely so
 *   the raster is not painted over, so the fill-shaped question answers no for
 *   every bitmap and `bitmapColourTransformDropped` would count nothing
 *   forever. **An approximation counted by a predicate that cannot fire is this
 *   project's six-times-repeated defect in its purest form.**
 *
 * ► **THIS IS A COPY OF `touchesRgb` IN `screen.js` AND IT SHOULD NOT BE.** The
 *   one durable home is `filters.js`, which already owns the arithmetic these
 *   two files share; neither that file nor `screen.js` was this session's to
 *   edit, and writing a second copy of a five-line predicate beat leaving the
 *   count unpinned. **Fold the two the next time `filters.js` is open.** The
 *   arithmetic itself is NOT duplicated — `applyColourTransform` and
 *   `applyColourTransformAlpha` are imported — which is the part that went
 *   wrong when three copies of it appeared in one evening and two rounded.
 */
function touchesRgb(colour) {
  if (!colour) return false;
  return colour[0] !== 1 || colour[1] !== 1 || colour[2] !== 1
    || colour[4] !== 0 || colour[5] !== 0 || colour[6] !== 0;
}

/**
 * A gradient with the placement's transform folded into every stop.
 *
 * ► **EXACT FOR A MULTIPLIER, APPROXIMATE FOR AN ALPHA OFFSET, and the canvas
 *   ramp is the difference.** Transforming the stops and letting the ramp
 *   interpolate is the same picture as transforming the interpolated result
 *   whenever the transform is linear in the interpolated quantity — true of the
 *   three colour channels, and true of alpha under a pure multiplier. An alpha
 *   OFFSET added to stops of DIFFERING opacity is not, so it is counted.
 *
 * ► **AND THE ALPHA GOES INTO THE STOPS BECAUSE THAT IS WHERE THE PAINTER READS
 *   IT.** `paintGradientFill` in `tools/arena/main.js` builds the ramp from
 *   each stop's own opacity and never consults `fillOpacity`, so a gradient
 *   whose alpha was folded only into `fillOpacity` would draw at full strength.
 *   `fillOpacity` is transformed as well, for the flat first-stop fallback a
 *   surface without gradient support uses.
 *
 * Structurally a copy of `transformGradient` in `screen.js`, which is private
 * to that file; see `touchesRgb` above for why there are two and what to do
 * about it.
 */
function transformGradient(gradient, colour, invoice) {
  if (!colour) return gradient;
  const stops = Array.isArray(gradient.stops) ? gradient.stops : [];
  if (stops.length === 0) return gradient;
  if (colour[7] !== 0) {
    const opacities = new Set(stops.map((stop) => (Number.isFinite(stop.opacity) ? stop.opacity : 1)));
    if (opacities.size > 1) invoice.gradientAlphaOffsetApproximated += 1;
  }
  return Object.freeze({
    ...gradient,
    stops: Object.freeze(stops.map((stop) => Object.freeze({
      ...stop,
      fill: applyColourTransform(stop.fill, colour),
      opacity: applyColourTransformAlpha(Number.isFinite(stop.opacity) ? stop.opacity : 1, colour)
    })))
  });
}

/**
 * The chain of colour matrices for a placement inside NO group — one shared
 * frozen empty array rather than a fresh `[]` per placement, because this pack
 * walks 3,345 of them per full sweep.
 */
const EMPTY_MATRICES = Object.freeze([]);

/**
 * ONE enclosing group, resolved once per frame, as the frozen record every
 * operation under it will SHARE.
 *
 * ► **INTERNED, AND THE IDENTITY IS THE POINT.** A painter walks the flat op
 *   array and flushes its buffer when `op.group` stops being the same OBJECT.
 *   Building a fresh record per operation would make that comparison always
 *   true and every group a group of one — which is the per-leaf picture the
 *   module header refuses, arrived at by accident instead of on purpose.
 *
 * ► **MUTABLE UNTIL THE WALK ENDS.** `ops` and `placements` are denominators and
 *   cannot be known until the last placement has been seen, so the record is
 *   filled in as the walk runs and frozen by `emitPropOps` before it returns.
 *   Nothing outside this file ever sees an unfrozen one.
 *
 * Returns `{ record, matrices, fillExact, filtered }` — the matrices kept OUT
 * of the record deliberately; see the module header.
 */
function effectGroupEntryFor(prop, id, cache, scale, invoice, records) {
  if (cache.has(id)) return cache.get(id);
  const group = Array.isArray(prop.effectGroups) ? prop.effectGroups[id] : undefined;
  if (!group || typeof group !== "object") {
    // A placement that says it is inside a group whose record is not in the
    // pack draws UNFILTERED, which is the same class of silence as an
    // unresolved clip cutter and is counted the same way. Once per distinct
    // index per frame, because the `null` goes in the cache beside it.
    invoice.groupsUnresolved += 1;
    cache.set(id, null);
    return null;
  }
  const built = canvasFilterFor(group.filters ?? [], { scale });
  const blend = group.blendMode === undefined || group.blendMode === null
    ? null
    : blendModeFor(group.blendMode);
  invoice.effectGroups += 1;
  invoice.groupFilters += built.counts.total;
  invoice.groupFiltersApplied += built.counts.applied;
  invoice.groupFiltersDeferred += built.counts.deferred;
  invoice.groupFiltersNoOp += built.counts.noOp;
  invoice.groupFiltersRefused += built.counts.refused;
  // `normal` is what a group with no blend mode already does, so counting it
  // would make "this group blends" true for every group that mentions the
  // field at all — the identity-transform mistake in a second field.
  const blends = Boolean(blend) && (blend.refused !== null || blend.composite !== "source-over");
  if (blends) {
    invoice.groupBlendModes += 1;
    if (blend.refused) invoice.groupBlendModesRefused += 1;
  }
  const entry = {
    record: {
      id,
      // The group's own display path, as the pack states it — so a reader can
      // find the group in the same frame's placements without re-deriving
      // which level it was on.
      path: Object.freeze([...(Array.isArray(group.path) ? group.path : [])]),
      character: Number.isFinite(group.character) ? group.character : null,
      // The next group OUT, as the same kind of record, or null. A painter that
      // walks this composites the outermost buffer last.
      enclosedBy: null,
      // The blur/glow string only. Never a colour matrix — see the header.
      filter: built.filter,
      // ► **THE AMPLIFIED PLAN TRAVELS BESIDE THE STRING, NEVER INSTEAD OF IT.**
      //   `null` for all but a saturating glow list, and a painter that does not
      //   know the field keeps drawing exactly what it drew before. See
      //   `glowAmplificationFor` for what it describes and why it declines.
      amplify: glowAmplificationFor(group.filters ?? [], { scale }),
      composite: blends && !blend.refused ? blend.composite : null,
      blendModeRefused: blend?.refused ?? null,
      colourMatricesFolded: built.colourMatrices.length,
      // Denominators, filled in by the walk.
      ops: 0,
      placements: 0,
      counts: built.counts
    },
    matrices: built.colourMatrices,
    // Computed ONCE per group rather than once per operation: it is a property
    // of the matrices and a `sky` frame has 56 operations under one of them.
    fillExact: built.colourMatrices.every((matrix) => colourMatrixIsFillExact(matrix)),
    filtered: built.filter !== null
  };
  cache.set(id, entry);
  // First appearance order, which is the order the operations themselves come
  // out in, so a reader of the table and a reader of the ops see one sequence.
  records.push(entry.record);
  return entry;
}

/**
 * A fill and its opacity with every matrix in a chain applied, innermost first.
 *
 * Returns `applied: false` and the INPUT untouched when the fill is not
 * something `applyColourMatrix` can transform — a bitmap-only path, `"none"`,
 * a missing fill. The caller counts that; it must not read as a correct fold.
 */
function foldColourMatrices(fill, opacity, matrices) {
  let currentFill = fill;
  let currentOpacity = opacity;
  for (const matrix of matrices) {
    const result = applyColourMatrix(currentFill, matrix, currentOpacity);
    if (!result.applied) return { fill, fillOpacity: opacity, applied: false };
    currentFill = result.fill;
    currentOpacity = result.fillOpacity;
  }
  return { fill: currentFill, fillOpacity: currentOpacity, applied: matrices.length > 0 };
}

/**
 * A gradient with the group's colour matrices folded into every stop.
 *
 * Structurally `transformGradient` one field over, and exact for the same
 * reason — the ramp interpolates linearly and an affine map commutes with a
 * convex combination — **with one difference that is not small: this one
 * CLAMPS at the stops.** See the module header for the 3,137-of-3,694
 * measurement and for why folding anyway is the better of the two answers.
 */
function gradientUnderColourMatrices(gradient, matrices) {
  const stops = Array.isArray(gradient.stops) ? gradient.stops : [];
  if (stops.length === 0 || matrices.length === 0) return gradient;
  return Object.freeze({
    ...gradient,
    stops: Object.freeze(stops.map((stop) => {
      const folded = foldColourMatrices(stop.fill, Number.isFinite(stop.opacity) ? stop.opacity : 1, matrices);
      return Object.freeze({ ...stop, fill: folded.fill, opacity: folded.fillOpacity });
    }))
  });
}

/**
 * ONE frame of one prop, expanded to one operation per path of each placement's
 * shape, with the invoice filled in as it goes.
 *
 * Shared by `propOpsFor`, `propInvoiceFor` and `propEffectGroupsFor` so that
 * the counts, the operations and the group table can never describe three
 * different walks.
 *
 * @param {object[]} [collected]  when given, the frame's DISTINCT group records
 *                                are pushed into it in first-appearance order
 */
function emitPropOps(pack, { linkage, frame = 1, scale = 1 } = {}, invoice, collected = null) {
  const ops = [];
  if (!hasExtractedProps(pack)) return ops;
  const prop = pack.props[linkage];
  if (!prop || !Array.isArray(prop.frames) || prop.frames.length === 0) return ops;

  // ► **CLAMPED, AND THE CLAMP IS THE BUILD'S BEHAVIOUR RATHER THAN A GUARD.**
  //   `gotoAndStop` past the end of a clip leaves the playhead where it is; a
  //   renderer with no playhead has to choose, and the last frame is what the
  //   build would already be showing. It matters less than it looks: every
  //   frame of `bullet` from 6 to 50 is the same drawing anyway.
  const index = Number.isFinite(frame) ? Math.min(prop.frames.length, Math.max(1, Math.trunc(frame))) : 1;
  const placements = prop.frames[index - 1];
  if (!Array.isArray(placements) || placements.length === 0) return ops;

  // ► **ONE `canvasFilterFor` PER GROUP PER FRAME, NOT ONE PER OPERATION.**
  //   Same argument as the colour transform and the clip below it, and bigger:
  //   `sky` frame 200 has 70 operations under 4 groups, so the cache turns 70
  //   filter builds into 4. The cache is per CALL, which is per frame, so a
  //   record can never be shared between two frames that happen to name the
  //   same group index — the records carry per-frame denominators.
  const groupCache = new Map();
  const records = [];

  for (const placement of placements) {
    invoice.placements += 1;
    // ► **NORMALISED ONCE PER PLACEMENT, NOT ONCE PER PATH** — same argument as
    //   the clip below, and `screen.js` states it with its own measurement.
    //   `colourTransformFrom` allocates and freezes an eight-number array, a
    //   shape is many paths sharing one transform, and the two appliers take
    //   that array straight through without re-normalising. Measured on the
    //   real pack: 3,345 conversions here against the 34,728 that handing
    //   `placement.colour` to each of the four call sites would do.
    //
    // ► **BEFORE the shape lookup, so `tintedPlacements` counts the same
    //   population `placements` does.** A placement naming a shape the pack
    //   does not hold is still a placement and still carries a transform; if
    //   this sat under the lookup the two numbers would quietly be over
    //   different denominators.
    //
    //   It reads BOTH shapes a colour transform exists in here: the named
    //   object (`redMultiplier` … `alphaOffset`) that `tools/extract-props.mjs`
    //   writes on EVERY placement, and the eight-number array
    //   `tools/extract-figure.mjs` writes only when it is not the identity.
    const colour = colourTransformFrom(placement.colour ?? null);
    if (colour) invoice.tintedPlacements += 1;

    // ► **THE ENCLOSING GROUPS, RESOLVED ONCE PER PLACEMENT.** `inheritedEffects`
    //   is OUTERMOST FIRST — `inheritedEffectsFor` in `tools/extract-props.mjs`
    //   states that as a guarantee to this reader — so the matrices have to be
    //   applied in REVERSE: the innermost group filters its own composite
    //   before the group enclosing it filters the result.
    const chain = Array.isArray(placement.inheritedEffects) ? placement.inheritedEffects : [];
    let group = null;
    let matrices = EMPTY_MATRICES;
    let fillExact = true;
    let filtered = false;
    if (chain.length > 0) {
      invoice.groupedPlacements += 1;
      if (chain.length > 1) invoice.nestedGroupPlacements += 1;
      const folded = [];
      let inner = null;
      for (let depth = chain.length - 1; depth >= 0; depth -= 1) {
        const entry = effectGroupEntryFor(prop, chain[depth], groupCache, scale, invoice, records);
        if (!entry) continue;
        entry.record.placements += 1;
        // Inner-to-outer, so the record built on the previous turn of this loop
        // is the one this group ENCLOSES.
        if (inner) inner.enclosedBy = entry.record;
        if (group === null) group = entry.record;
        inner = entry.record;
        folded.push(...entry.matrices);
        if (!entry.fillExact) fillExact = false;
        if (entry.filtered) filtered = true;
      }
      matrices = folded;
    }

    const shape = pack.shapes[placement.shape];
    if (!shape) {
      invoice.shapesMissing += 1;
      continue;
    }
    if (!Array.isArray(shape.paths)) {
      invoice.shapesWithNoPaths += 1;
      continue;
    }
    // ► **THE CLIP IS RESOLVED ONCE PER PLACEMENT, NOT ONCE PER PATH.** A
    //   shape is many paths and they share one cutter; building it per path
    //   would hand the surface N identical clip regions to set and clear.
    let clip = null;
    if (placement.clip) {
      const cutter = pack.shapes[placement.clip.shape];
      if (cutter && Array.isArray(cutter.paths) && cutter.paths.length > 0) {
        clip = Object.freeze({
          matrix: placement.clip.matrix,
          // Every loop of the cutter, because a mask with a hole is still one
          // region and dropping the extra loops would clip to the outline.
          d: cutter.paths.map((cut) => cut.d).join("")
        });
      } else {
        // A placement that says it is clipped and whose cutter will not resolve
        // draws UNCLIPPED — larger than it should be, over things it should not
        // cover. Silence here is the mask equivalent of the invisible walls.
        invoice.clipsUnresolved += 1;
      }
    }
    for (const path of shape.paths) {
      invoice.ops += 1;
      if (colour) invoice.tintedOps += 1;
      if (path.bitmap) {
        invoice.bitmapOps += 1;
        // ► **WHAT IS DROPPED IS THE RASTER'S OWN PIXELS, AND SAYING IT LOOSELY
        //   MADE THE COUNT LOOK WRONG.** ~~The operation carries no colour for
        //   it to fold into.~~ It may: `shapeToPaths` can report a raster path
        //   that ALSO carries a fallback `#rrggbb`, and that fill is
        //   transformed four lines below like any other. What no arithmetic
        //   here can reach is the BITMAP, so on a bitmap operation the RGB half
        //   of the transform never lands on the thing the painter actually
        //   draws — and that is the drop, whatever the fallback fill got. Only
        //   the alpha half survives for the raster, into `fillOpacity`.
        //
        //   All 7 bitmap-bearing paths in this build's shape table carry
        //   `fill: "none"`, so on the real pack the two readings coincide and
        //   nothing could tell them apart; `tintPack` in the test file holds
        //   one of each shape on purpose.
        if (touchesRgb(colour)) invoice.bitmapColourTransformDropped += 1;
      }
      let gradient = null;
      if (path.gradient) {
        invoice.gradientOps += 1;
        gradient = transformGradient(path.gradient, colour, invoice);
      }

      // ► **THE PLACEMENT'S TRANSFORM FIRST, THEN THE GROUP'S MATRIX, AND THE
      //   ORDER IS THE BUILD'S.** Flash applies a placement's colour transform
      //   to the leaf, rasterises the group, and filters THAT. So the transform
      //   is folded here and the matrix on top of it; reversing the two
      //   produces a plausible picture and the wrong one.
      let fill = applyColourTransform(path.fill ?? null, colour);
      let fillOpacity = applyColourTransformAlpha(path.fillOpacity ?? 1, colour);
      let stroke = applyColourTransform(path.stroke ?? null, colour);
      let strokeOpacity = applyColourTransformAlpha(path.strokeOpacity ?? 1, colour);
      if (group) {
        invoice.groupedOps += 1;
        // ► **EVERY RECORD IN THE CHAIN, NOT JUST THE INNERMOST.** An outer
        //   group's composite CONTAINS these operations too, so an `ops` that
        //   counted only the innermost would hand a painter a denominator of
        //   zero for the outer buffer it is being asked to build — while
        //   `placements` beside it said otherwise. Every chain in the real pack
        //   is one deep, so only the synthetic pack can tell the two apart.
        for (let record = group; record; record = record.enclosedBy) record.ops += 1;
        if (filtered) invoice.groupFilterOps += 1;
      }
      if (matrices.length > 0) {
        invoice.groupMatrixOps += 1;
        if (!fillExact) invoice.groupMatrixNotFillExact += 1;
        if (filtered) invoice.groupMatrixFoldedUnderAFilter += 1;
        if (gradient) {
          // ► **THE STOPS, BECAUSE THAT IS WHERE THE PAINTER READS THE RAMP.**
          //   `paintGradientFill` in `tools/arena/main.js` builds from each
          //   stop's own colour and never consults `fill`, so a matrix folded
          //   only into `fill` would leave the sky's whole backdrop untouched —
          //   993 of this pack's 1,690 matrix-covered operations are gradients.
          //   The flat fallback is folded as well, for a surface with no
          //   gradient support.
          invoice.groupMatrixGradientOps += 1;
          gradient = gradientUnderColourMatrices(gradient, matrices);
          const flat = foldColourMatrices(fill, fillOpacity, matrices);
          fill = flat.fill;
          fillOpacity = flat.fillOpacity;
        } else {
          const folded = foldColourMatrices(fill, fillOpacity, matrices);
          if (folded.applied) {
            invoice.groupMatrixSolidOps += 1;
            fill = folded.fill;
            fillOpacity = folded.fillOpacity;
          } else {
            // ► **NO FILL FOR THE MATRIX TO LAND ON, WHICH IS NOT THE SAME AS
            //   NO MATRIX.** A bitmap-only path or a `"none"` fill: the group's
            //   colour matrix is simply lost for that operation, exactly as the
            //   RGB half of the colour transform is lost on a raster. **0 of
            //   this pack's 1,690 matrix-covered operations is one**, so the
            //   synthetic pack in the test file is the only thing that can move
            //   this — a zero here with no denominator beside it would say
            //   nothing at all.
            invoice.groupMatrixDroppedOps += 1;
          }
        }
        const foldedStroke = foldColourMatrices(stroke, strokeOpacity, matrices);
        if (foldedStroke.applied) {
          // Dead on the real pack for the same reason the colour transform's
          // stroke line is: **0 of its 1,690 matrix-covered operations carries
          // a stroke at all.** `tintPack` is what stands under this line.
          invoice.groupMatrixStrokeOps += 1;
          stroke = foldedStroke.fill;
          strokeOpacity = foldedStroke.fillOpacity;
        }
      }

      ops.push(Object.freeze({
        kind: "path",
        d: path.d,
        matrix: placement.matrix,
        ...(clip ? { clip } : {}),
        // ► **THE PLACEMENT'S COLOUR TRANSFORM, FOLDED IN.** `applyColourTransform`
        //   returns its input untouched for `null`, for `"none"` and for
        //   anything that is not `#rrggbb`, so the four lines below are also
        //   the plain copy they used to be whenever there is nothing to apply.
        fill,
        fillRule: path.fillRule ?? "evenodd",
        fillOpacity,
        stroke,
        strokeWidth: path.strokeWidth ?? 0,
        strokeOpacity,
        // ► **THE ENCLOSING GROUP, AS THE SHARED FROZEN RECORD.** Absent when
        //   the placement is inside none, so a painter can branch on presence
        //   and `op.group !== previous` is where it flushes its buffer. The
        //   colour matrices are already in the four fields above; what is left
        //   on the record is the blur, the glow and the blend mode, which no
        //   per-operation arithmetic can express.
        ...(group ? { group } : {}),
        // ► **THE BITMAP FILL, AND DROPPING IT HERE MADE THE ARENA WALLS
        //   INVISIBLE.** `shapeToPaths` has always reported
        //   `approximated: "bitmap"` on a raster fill, and this reader copied
        //   named fields one at a time and never copied that — so a shape
        //   filled with the arena's stone wall arrived as `fill: "none"` with
        //   no trace of what was lost, and the extractor counted zero failures.
        //   **An approximation that is not carried is indistinguishable from a
        //   correct read.** `colour` was the NEXT field this same reader walked
        //   past; see the module header.
        ...(path.bitmap ? { bitmap: path.bitmap } : {}),
        ...(gradient ? { gradient } : {}),
        ...(path.approximated ? { approximated: path.approximated } : {})
      }));
    }
  }
  // ► **FROZEN LAST, because the denominators on them are not known until
  //   here.** Every operation emitted above already holds the record by
  //   reference, so freezing now is the same object those operations point at
  //   and not a copy they would have missed.
  for (const record of records) Object.freeze(record);
  if (collected) for (const record of records) collected.push(record);
  return ops;
}

/**
 * The draw operations for one frame of one prop, in the prop's OWN local
 * space, or null when there is nothing to draw.
 *
 * The shape is the one `paintFigure` and `paintExtractedFigure` already emit —
 * `{ kind: "path", d, matrix, fill, ... }` — so a surface that can draw a
 * gladiator can draw an arrow with no new code.
 *
 * ► **A FLAT FROZEN ARRAY OR NULL, AND THAT SHAPE IS AN INJECTED SEAM'S
 *   CONTRACT.** ~~`tools/arena/main.js` pairs operations back to placements by
 *   counting, and `probeColourTransform` there reads `ops[0]`.~~ **BOTH OF
 *   THOSE WERE DELETED WITH THE DOUBLE-APPLYING SHIM ON 2026-09-14 AND THIS
 *   SENTENCE OUTLIVED THEM**, which is the failure this repository keeps paying
 *   for: a struck reason is history, a stale one is a lie the next reader
 *   believes. `grep -rn 'probeColourTransform' src tools` and
 *   `grep -rn 'ops\[0\]' src tools` now find nothing but this comment.
 *
 *   The surviving reason is stronger than the one that was here:
 *   `arena-backdrop.js` takes this function as an ARGUMENT
 *   (`arenaScreenLayersFor(pack, propOpsFor, camera, dressing)`) and every
 *   caller iterates what comes back, so a `{ ops, invoice }` record would break
 *   an INJECTED SEAM rather than one file. The counts live in
 *   `propInvoiceFor`.
 *
 * ► **AN OPERATION MAY NOW CARRY `group`, AND THAT IS WHY IT DOES.** The
 *   enclosing group's blur, glow and blend mode cannot be folded into a path —
 *   Flash filters the COMPOSITE — so they ride as a shared frozen record on
 *   each operation under them, inside the same flat array. A painter flushes
 *   its buffer where `op.group` stops being the same object; a painter that
 *   ignores the field draws exactly what it drew before, which is what every
 *   caller in this tree does today. The group's colour MATRICES are not on the
 *   record: they are already in `fill`, `stroke` and the gradient stops.
 *
 * @param {object} pack     from `propPackFrom`
 * @param {object} options
 * @param {string} options.linkage  the build's own export name
 * @param {number} options.frame    1-BASED, as `gotoAndStop` indexes it
 */
export function propOpsFor(pack, options = {}) {
  const ops = emitPropOps(pack, options, emptyInvoice());
  return ops.length > 0 ? Object.freeze(ops) : null;
}

/**
 * WHAT ONE FRAME'S WORTH OF OPERATIONS COULD NOT CARRY, counted by name.
 *
 * Same arguments as `propOpsFor` and the same walk; see the module header for
 * why this is a second function rather than a second return value, and
 * `emptyInvoice` for what each field means and which of them are dead on the
 * real pack.
 *
 * Per FRAME, like everything else here — a caller wanting a whole pack's
 * invoice sums across `propFrameCount`, because which frame is being drawn is
 * the caller's business in this module and this is not the exception.
 */
export function propInvoiceFor(pack, options = {}) {
  const invoice = emptyInvoice();
  emitPropOps(pack, options, invoice);
  return Object.freeze(invoice);
}

/**
 * THE ENCLOSING EFFECT GROUPS ONE FRAME REACHES, in first-appearance order.
 *
 * The same records `propOpsFor` stamps on its operations, built by the same
 * private walk. ► **EQUAL, NOT IDENTICAL — a separate call is a separate walk,
 * so `propEffectGroupsFor(...)[0] === propOpsFor(...)[0].group` is FALSE.** The
 * identity that matters is WITHIN one array: every operation under one group
 * holds one object, which is what lets a painter flush on `!==`. This sentence
 * asserted the other thing for as long as it took to run it.
 *
 * The table exists for a caller that wants to know what a frame is asking of a
 * painter WITHOUT walking its operations: a manifest line, a log line, a test.
 *
 * Each record:
 *
 * ```text
 *   id                    index into the prop's own `effectGroups`
 *   path, character       where the group sits in the build's display list
 *   enclosedBy            the next group OUT, or null
 *   filter                the canvas filter string for its blurs and glows,
 *                         or null — NEVER a colour matrix
 *   composite             `globalCompositeOperation` for its blend mode, or null
 *   blendModeRefused      why canvas cannot express it, or null
 *   colourMatricesFolded  how many matrices `propOpsFor` has ALREADY applied
 *   ops, placements       what sits under it IN THIS FRAME — the denominators
 *   counts                `canvasFilterFor`'s own applied/deferred/noOp/refused
 * ```
 *
 * ► **`scale` IS THE STAGE SCALE AND IT CHANGES THE STRING, NOT THE BUCKETS.**
 *   `ctx.filter` lengths are not scaled by `ctx.setTransform`, so a painter
 *   drawing the stage at 2x must ask for 2 or every blur is half the size.
 *   Nothing else in this module's output moves with it — a colour matrix has no
 *   length in it — so an operation's fills are identical at every scale.
 *
 * ► **`propOpsFor` TAKES IT TOO, AND THAT IS THE ROUTE THROUGH THE INJECTED
 *   SEAM.** `arenaScreenLayersFor(pack, propOpsFor, …)` decides the frame
 *   itself, so a painter cannot call this function for the matching frame
 *   without re-deriving one — but it CAN inject
 *   `(pack, options) => propOpsFor(pack, { ...options, scale: fit.scale })`,
 *   and the records stamped on the operations then carry radii in canvas
 *   pixels. That is why the option lives on both and not only here.
 *
 * @param {object} pack     from `propPackFrom`
 * @param {object} options  `{ linkage, frame, scale }`, as `propOpsFor` takes
 */
export function propEffectGroupsFor(pack, options = {}) {
  const groups = [];
  emitPropOps(pack, options, emptyInvoice(), groups);
  return Object.freeze(groups);
}

/**
 * THE EFFECTS THAT NEVER REACH THIS MODULE AT ALL, per pack.
 *
 * ► **THE ARENA UI BAR'S TWO GLOWS, AND NO RENDERER CAN DRAW THEM FROM THIS
 *   PACK.** `tools/extract-props.mjs` skips a drawable it cannot turn into
 *   paths — a TEXT FIELD is the case that occurs — and records what it dropped
 *   with it under `effects.own.dropped`. On this build that is characters 1527
 *   and 1528 on `panel`, one glow each: there is no shape in the pack for the
 *   glow to sit on, so every count in `propInvoiceFor` is honestly zero and
 *   honestly silent about them. **What it would take** is the join
 *   `screen-text.js` already is on the screens side — the filter carried
 *   against the text FIELD and applied to a text operation — plus an extractor
 *   that does not drop the filter with the drawable.
 *
 * ► **PER PACK, NOT PER FRAME, ON PURPOSE.** It is a property of the extraction
 *   and does not vary with which frame is being drawn, so putting it in the
 *   per-frame invoice would make any roll-up multiply it by the frame count.
 *
 * Returns `{ props, placements, filters, byType }`, all zero on a pack with no
 * effect data — which is also what a pack written before 2026-09-14 looks like.
 */
export function propEffectsUnreachable(pack) {
  const out = { props: 0, placements: 0, filters: 0, byType: {} };
  for (const prop of Object.values(pack?.props ?? {})) {
    const dropped = prop?.effects?.own?.dropped;
    if (!dropped || !Number.isFinite(dropped.filters) || dropped.filters <= 0) continue;
    out.props += 1;
    out.placements += Number.isFinite(dropped.placements) ? dropped.placements : 0;
    out.filters += dropped.filters;
    for (const [type, count] of Object.entries(dropped.filtersByType ?? {})) {
      out.byType[type] = (out.byType[type] ?? 0) + count;
    }
  }
  return Object.freeze({ ...out, byType: Object.freeze(out.byType) });
}

/**
 * The arrow for a shot, or null.
 *
 * A convenience over `propOpsFor` that names the two facts a caller would
 * otherwise have to know: the linkage is `bullet`, and a null `artFrame` — a
 * secondary slot holding something the shop would never have sold — falls back
 * to the FIRST arrow rather than to nothing. **An arrow that exists and is the
 * wrong one of five is a better answer than no arrow**, and the five differ
 * only in drawing.
 *
 * ► **THE FRAME IS THE WEAPON HERE AND IT IS THE CLOCK NEXT DOOR.** That is
 *   not a house style, it is two different `gotoAndStop`s in the build; the
 *   parameter names are the only place a caller can see the difference, so they
 *   are spelled apart on purpose. See `arrowTrailOpsFor`.
 *
 * ► **AND NOTHING THIS FUNCTION RETURNS IS TINTED, SO A TEST OVER IT SAYS
 *   NOTHING ABOUT THE COLOUR TRANSFORM.** Measured on this repository's own
 *   `assets/props/props.json` 2026-09-14: `bullet` holds **50 placements, 0 of
 *   them under a non-identity transform**, across 294 operations. So
 *   `emitPropOps`'s whole fold is a no-op on every arrow, and a reader that
 *   walked past `colour` — which is exactly what this file did until that date
 *   — returns byte-identical operations here. **A sweep over the arrow would
 *   have reported the defect fixed while it was still live**, which is why it
 *   is named here rather than left for the next person to re-measure. The
 *   varying evidence is `bullet_trail` (7 of 7 placements tinted), `panel`
 *   (3 of 4) and `sky` (2,320 of 3,202); the cases NONE of those reach are in
 *   `tintPack`, in this module's test file.
 */
export function arrowOpsFor(pack, artFrame) {
  return propOpsFor(pack, { linkage: "bullet", frame: Number.isFinite(artFrame) ? artFrame : 1 });
}

/**
 * ONE PUFF of the arrow's trail, at an AGE, or null.
 *
 * ► **THE AGE OF THE PUFF, NOT THE WEAPON — AND READING IT AS THE WEAPON DREW
 *   NO TRAIL AT ALL FOR 14 OF THE 20 BOWS.** ~~Same fallback rule as
 *   `arrowOpsFor`.~~ That single sentence WAS the defect: it asserted the two
 *   clips are indexed alike, so this function passed `secondary_weapon - 60`
 *   (1..20 across bows 61..80) into a SEVEN-frame clip. `emitPropOps` clamps,
 *   so bows 67-80 all landed on frame 7, whose placement carries
 *   `alphaMultiplier: 0`. While this file walked past `colour` those puffs drew
 *   SOLID and looked fine; the day the fold reached `fillOpacity` they stopped
 *   putting down a pixel. **The regression was the fix arriving on top of an
 *   older wrong index, and the comment is what hid it.**
 *
 * ► **THE BYTES, re-derived on the oracle for this fix rather than carried
 *   from the map.** `bullet.onEnterFrame` (`+0x7177`) attaches a `bullet_trail`
 *   every third frame, and at `+0x7249`..`+0x7276` it pushes
 *   `game_attacker.secondary_weapon`, subtracts 60, pushes argc 1, does
 *   `GetVariable "bullet_trail"` — the clip `attachMovie` just returned — then
 *   **`GetMember "bullet"`** and only then `CallMethod "gotoAndStop"`. The
 *   receiver is `trail.bullet`: a CHILD named `bullet` INSIDE the attached
 *   puff, not the puff. So the weapon picks the arrow drawing carried in the
 *   puff, and seven slots were never addressing twenty bows.
 *
 * ► **AND THE DISPLAY LIST SAYS THE SAME THING WITH NO INTERPRETER, which is
 *   the stronger evidence of the two.** Sprite 48 has seven frames; every one
 *   places character 47 — which IS the `bullet` export — at depth 1 under the
 *   instance name `bullet`, identity matrix, blend mode 5 (`lighten`), with
 *   `alphaMultiplier` running **0.69921875, 0.58203125, 0.46484375, 0.3515625,
 *   0.234375, 0.1171875, 0**. One drawing, seven alphas, monotone to nothing:
 *   a TIME fade. Frame 7 then carries a `DoAction` of
 *   `this.removeMovieClip(); _parent.removeMovieClip(); stop();` — **the puff
 *   DELETES ITSELF at the end of the ramp**, so the seven frames are its whole
 *   life rather than a lookup with fourteen dark entries.
 *
 * So the parameter is `ageFrames`: how many frames this puff has been alive,
 * **0 on the frame it was attached**, which is why it is deliberately NOT
 * 1-based like `arrowOpsFor`'s. An age is a duration and a frame is an index;
 * spelling them differently is the only guard standing between the next caller
 * and the bug above, because both quantities are small positive integers and
 * either one produces a plausible-looking puff.
 *
 * ► **PAST THE LAST FRAME THE CLAMP IS THE BUILD'S OWN ANSWER, for once
 *   exactly.** An older puff clamps to frame 7 and comes back at alpha 0; in
 *   the build it has already removed itself. Invisible both ways — the clamp
 *   and the runtime AGREE here rather than merely failing to disagree, which is
 *   more than `emitPropOps`'s clamp can claim on `bullet`.
 *
 * ► **WHAT THIS CANNOT HAND YOU IS THE OTHER FOUR ARROWS.** The pack flattens
 *   the nested `bullet` child at ITS frame 1, so all seven of `bullet_trail`'s
 *   frames place ONE shape — the same shape `bullet` frame 1 places, which is
 *   bow 61's. A puff behind bow 65's arrow therefore draws bow 61's. Carrying
 *   that lookup is `tools/extract-props.mjs`'s to do and not this module's to
 *   invent: there is nothing in the pack for this function to read.
 *
 * ► ~~**NOR THE `lighten` COMPOSITE.** Every one of sprite 48's seven
 *   placements sets blend mode 5, and `emitPropOps` emits `matrix`, `clip`,
 *   `colour` and the path's own paint — no blend mode at all, for any prop.~~
 *   **— HALF FIXED ON 2026-09-15, AND THE HALF THAT IS LEFT IS NOT THIS
 *   MODULE'S.** The blend mode is not on the placement at all: it is on the
 *   ENCLOSING GROUP, the single entry in `bullet_trail`'s `effectGroups`
 *   (`{path: [1], character: 47, blendMode: 5}`), and every one of its seven
 *   frames' placements points at it. `propOpsFor` now hands that group's record
 *   to the painter on each operation as `group.composite === "lighten"` —
 *   `blendModeFor` calls it EXACT — so the datum reaches the draw call.
 *   **Until a painter sets `globalCompositeOperation` from it the puff still
 *   draws source-over**, which is a dimmer puff over a light backdrop and a
 *   wrong one over a dark sky; the difference from the struck sentence is that
 *   the loss is now counted (`groupBlendModes`) and reachable rather than
 *   absent.
 *
 * @param {object} pack        from `propPackFrom`
 * @param {number} ageFrames   frames since the puff was attached; 0 is newest
 */
export function arrowTrailOpsFor(pack, ageFrames) {
  const age = Number.isFinite(ageFrames) ? Math.max(0, Math.trunc(ageFrames)) : 0;
  return propOpsFor(pack, { linkage: "bullet_trail", frame: age + 1 });
}

/**
 * THE BOLT A CAST ATTACHES AT ITS VICTIM, at the spell's frame and at its age.
 *
 * `lightning_bolt_combat` (character 12) is two frames and the frame IS the
 * spell: `bolt.gotoAndStop(lightning_frame)` (`+0x85c2`) picks 1 for a
 * lightning bolt and 2 for a frightning one, which adds shape 11 over the same
 * child. The child, sprite 10, is twelve frames of flicker with NO `Stop`, so
 * it LOOPS for as long as the bolt is attached — a clock, not a lookup, and
 * `tools/extract-props.mjs` carries it as `clock.framesByParent` precisely
 * because freezing it on frame 1 would draw a still picture of an animation.
 *
 * ► **TWO QUANTITIES OF DIFFERENT KINDS, and the signature keeps them apart the
 *   way `arrowOpsFor`/`arrowTrailOpsFor` do.** `boltFrame` is 1-based because
 *   `gotoAndStop` indexes it; `ageFrames` is ZERO-based because it is a
 *   duration, and it WRAPS because the child has no `Stop`.
 *
 * ► **A PACK WITH NO CLOCK STILL DRAWS THE BOLT**, frozen on the child's first
 *   frame, which is what `frames` has always held. An older extraction loses
 *   the flicker and keeps the bolt.
 *
 * The clock frame is drawn through the SAME walk as every other prop, by
 * handing `propOpsFor` a view of this prop whose one frame is the clock frame.
 * Its placements index this prop's own `effectGroups`, so the glow the child
 * carries survives the substitution unchanged.
 *
 * @param {object} pack        from `propPackFrom`
 * @param {number} boltFrame   1 lightning, 2 frightning — 1-BASED
 * @param {number} ageFrames   frames since the bolt was attached — ZERO-BASED
 * @param {object} [options]
 * @param {number} [options.scale=1] the scale the ops will be DRAWN at, so the
 *   child's glow is built at that width. **The bolt is the first arena prop
 *   whose group carries a filter**, and a canvas filter is in device pixels,
 *   untouched by the transform — see `tools/arena/main.js`'s `paintProp`.
 */
export function boltOpsFor(pack, boltFrame, ageFrames, { scale = 1 } = {}) {
  const linkage = "lightning_bolt_combat";
  if (!hasExtractedProps(pack)) return null;
  const prop = pack.props[linkage];
  if (!prop || !Array.isArray(prop.frames) || prop.frames.length === 0) return null;
  // Clamped the way `emitPropOps` clamps: `gotoAndStop` past the end leaves the
  // playhead on the last frame.
  const frame = Number.isFinite(boltFrame)
    ? Math.min(prop.frames.length, Math.max(1, Math.trunc(boltFrame)))
    : 1;
  const ages = prop.clock?.framesByParent?.[frame - 1];
  if (!Array.isArray(ages) || ages.length === 0) return propOpsFor(pack, { linkage, frame, scale });
  const age = Number.isFinite(ageFrames) ? Math.max(0, Math.trunc(ageFrames)) : 0;
  const view = Object.freeze({
    props: Object.freeze({ ...pack.props, [linkage]: Object.freeze({ ...prop, frames: [ages[age % ages.length]] }) }),
    shapes: pack.shapes
  });
  return propOpsFor(view, { linkage, frame: 1, scale });
}

/**
 * THE FIREBALL, in flight or exploding — `fireball_combat`, or null.
 *
 * ► **NOT IN ANY PACK EXTRACTED BEFORE 2026-09-22, and null is the answer for
 *   that**, so a shell draws its authored fallback exactly as it does for an
 *   arrow on a machine with no extraction. `tools/extract-props.mjs` must take
 *   it before this can draw the build's art.
 *
 * Two quantities, kept apart the way `boltOpsFor` keeps them:
 *
 * - `clipFrame`, 1-BASED as `gotoAndStop` indexes it: **1 in flight for all
 *   three spells** (`gotondStop` at `+0x9276` never applies `fireball_frame`),
 *   and **4 from impact** (`bullet.gotoAndStop(4)`, `+0x91cd`);
 * - `ageFrames`, ZERO-BASED: the explosion child's clock on frame 4. It is
 *   **CLAMPED, never wrapped** — unlike the bolt's flicker, the explosion's last
 *   frame runs `_parent.removeMovieClip()`, so it plays once and the whole clip
 *   goes. The caller stops asking once `fireballDrawAt` says `done`.
 *
 * Read through `clock.framesByParent` when the pack carries one for the
 * explosion's child, as `boltOpsFor` reads the bolt's, and through the frame's
 * own flattened placements otherwise.
 */
export function fireballOpsFor(pack, clipFrame, ageFrames, { scale = 1 } = {}) {
  return clampedClockOpsFor(pack, "fireball_combat", clipFrame, ageFrames, scale);
}

/**
 * A prop at a 1-based `clipFrame` and a zero-based clock age that is CLAMPED at
 * the clock's last frame — the fireball's explosion and the boulder's landing
 * — or null when the pack does not hold the prop. Lifted out of
 * `fireballOpsFor` unchanged when the boulder became the second reader.
 */
function clampedClockOpsFor(pack, linkage, clipFrame, ageFrames, scale) {
  if (!hasExtractedProps(pack)) return null;
  const prop = pack.props[linkage];
  if (!prop || !Array.isArray(prop.frames) || prop.frames.length === 0) return null;
  const frame = Number.isFinite(clipFrame)
    ? Math.min(prop.frames.length, Math.max(1, Math.trunc(clipFrame)))
    : 1;
  const ages = prop.clock?.framesByParent?.[frame - 1];
  if (!Array.isArray(ages) || ages.length === 0) return propOpsFor(pack, { linkage, frame, scale });
  const age = Number.isFinite(ageFrames) ? Math.max(0, Math.trunc(ageFrames)) : 0;
  const view = Object.freeze({
    props: Object.freeze({
      ...pack.props,
      [linkage]: Object.freeze({ ...prop, frames: [ages[Math.min(age, ages.length - 1)]] })
    }),
    shapes: pack.shapes
  });
  return propOpsFor(view, { linkage, frame: 1, scale });
}

/**
 * MOLTEN DEATH'S BOULDER, at a frame of `boulder_combat` and the landing's age
 * — or null when the pack does not hold it.
 *
 * ► **A PACK EXTRACTED BEFORE 2026-09-23 DOES NOT, and null is the answer for
 *   that**: `tools/extract-props.mjs` took `boulder_combat` (sprite 33) on that
 *   date, so a pack has it only once the player re-extracts. Until then a shell
 *   draws its plain AUTHORED rock and no landing at all.
 *
 * Two quantities, kept apart the way `fireballOpsFor` keeps them:
 *
 * - `clipFrame`, 1-BASED as `gotoAndStop` indexes it: **1 while it falls** (the
 *   clip's own `Stop`, `DoAction@0xcb53`) and **4 from the landing**
 *   (`gotoAndStop(4)`, `+0x88c0`, and the `Stop` at `DoAction@0xcb6d`);
 * - `ageFrames`, ZERO-BASED: the landing clock's age when the extractor found
 *   an animated sprite on frame 4 (`clock.discoveredOn`), **CLAMPED** at its
 *   last frame. How long the landing is shown at all is
 *   `boulderLandedFramesFor`'s question, not this one's.
 */
export function boulderOpsFor(pack, clipFrame, ageFrames = 0, { scale = 1 } = {}) {
  return clampedClockOpsFor(pack, "boulder_combat", clipFrame, ageFrames, scale);
}

/**
 * HOW LONG THE BUILD SHOWS A LANDED BOULDER, in frames — ~~**UNREAD**~~ **READ
 * 2026-09-23 by the main session: 22.** The re-extracted pack's
 * `clockDiscovery` for `boulder_combat` names the child on frame 4: character
 * **27** — the fireball's explosion clip — and the dump of every action block
 * shows sprite 27's only frame script is on its frame 23,
 * `_parent.removeMovieClip()` (`sprite:27/frame:23/DoAction@0xb819`). A frame
 * script runs on entering its frame, before that frame is drawn, so a landed
 * rock shows the explosion's frames 1-22 and is gone on the 23rd — exactly the
 * "plays once, without its last frame" rule `boulderLandedFramesFor` applies
 * to an animated landing. **So no override is set: the pack rule IS the build's
 * answer for the real pack** (pinned against `assets/props/props.json` in
 * test/render-boulders.test.js), and an override would wrongly give the
 * authored, pack-less rock a landing it has no art for.
 *
 * `null` means "the pack rule stands"; set a number only if a build is found
 * whose landing child the rule misreads. What IS read (the main session, 2026-09-23,
 * and `SS2_DEATH_FROM_ABOVE`): the arm never removes a boulder, and sprite 33's
 * own frame scripts are a `Stop` on frame 1 and a `Stop` on frame 4 and nothing
 * else. So the ONLY thing that can end a landing is a CHILD placed on frame 4 —
 * and whether it does (`_parent.removeMovieClip()` on its last frame, as the
 * fireball's explosion does), holds (`Stop`), or loops is in that child's
 * actions, which the extractor does not read. Set this from that reading.
 */
export const BOULDER_LANDED_FRAMES = null;

/**
 * How many frames a boulder's landing is shown for, from what the PACK can say
 * — the number `boulderDrawAt`'s `landedFrames` wants.
 *
 * - **No `boulder_combat` in the pack: 0.** The shell's rock is authored, and
 *   an authored LANDING would be invented; the rock goes as it lands.
 * - **`BOULDER_LANDED_FRAMES`, once somebody has read it.**
 * - **A still frame 4 — no animated sprite found there: `Infinity`.** Nothing
 *   the build is known to run can remove it, so it stays as long as the arena.
 * - **An animated landing: ONE PASS of its clock, less the last frame —
 *   INTERIM, AND A PRECEDENT RATHER THAN A READING.** `fireball_combat` has
 *   the same layout (four frames, a `Stop` on 1 and 4, an animated child on 4)
 *   and its child removes its parent on its LAST frame, whose script runs
 *   before that frame is drawn — so `SS2_FIREBALL` shows `explosionFrames - 1`.
 *   Whether the boulder's child does the same is unread.
 */
export function boulderLandedFramesFor(pack) {
  if (!hasExtractedProps(pack)) return 0;
  const prop = pack.props.boulder_combat;
  if (!prop || !Array.isArray(prop.frames) || prop.frames.length === 0) return 0;
  if (BOULDER_LANDED_FRAMES === Infinity || Number.isFinite(BOULDER_LANDED_FRAMES)) return BOULDER_LANDED_FRAMES;
  const landing = prop.clock?.framesByParent?.[3];
  if (Array.isArray(landing) && landing.length > 0) return Math.max(1, landing.length - 1);
  return Infinity;
}

/** A prop's placement translations are TWIPS: `tools/extract-props.mjs`, `roundMatrix`. */
const TWIPS_PER_PIXEL = 20;

/**
 * ONE OPERATION'S OWN TRANSFORM, in the prop's own pixels — or null.
 *
 * ► **THE TRANSLATION IS DIVIDED BY 20, AND THE ARENA'S PROP PAINTER DID NOT
 *   DO THAT UNTIL 2026-09-23.** `tools/extract-props.mjs` keeps `tx`/`ty` in
 *   twips — "A consumer must divide by 20" — and `paintLayerOperation` always
 *   has; `paintPropOperation` passed them through as pixels. Every prop that
 *   reached it before the spell props had a zero translation, so it hid until
 *   the lightning bolt (`-1330, -6880` twips) was painted roughly 6,800 pixels
 *   below the canvas and never seen, and the fireball's explosion (`30, 174`)
 *   floated a figure height over its victim.
 *
 * The four scale/skew terms are unit-free and pass straight through.
 */
export function propPlacementMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 6) return null;
  return [matrix[0], matrix[1], matrix[2], matrix[3], matrix[4] / TWIPS_PER_PIXEL, matrix[5] / TWIPS_PER_PIXEL];
}

/**
 * WHERE A PROP'S REGISTRATION POINT GOES ON A CANVAS, and how it is scaled,
 * turned and mirrored — the matrix a painter sets before drawing each
 * operation through `propPlacementMatrix`.
 *
 * `translate(toX(x), toY(y, lift))`, then `rotate(rotation)`, then
 * `scale(±k, k)` with `k = size * view.scale` — Flash's own order for a clip:
 * `_xscale`/`_yscale` first, `_rotation` over it, then `_x`/`_y`.
 *
 * ► **NO VERTICAL FLIP, AND THE PAINTER HAD ONE UNTIL 2026-09-23.** It scaled
 *   by `(k, -k)` because "arena y is UP and canvas y is DOWN" — true of an
 *   arena POINT, which `view.toY` already converts, and false of the ART: a
 *   prop's paths are the SWF's own, and SWF y is down exactly like the
 *   canvas's. The figure is pre-flipped before it meets its `-k`
 *   (`extracted-figure.js`); no prop ever was. So the arena's two rocks stood
 *   on their heads with their shadows over them, the fireball's burst went
 *   down, and — the arrow's art points UP and `_rotation` lays it flat — every
 *   snipe flew tail first.
 *
 * `rotation` is radians CLOCKWISE on screen, Flash's `_rotation` convention
 * (`projectile.js`, `rotationAt`). `mirrored` is a negative `_xscale`.
 *
 * @param {object} view  `{ toX, toY, scale }`, the shell's projection
 * @param {object} at    `{ x, y, lift, size, rotation, mirrored }`
 * @returns {number[]} `[a, b, c, d, e, f]`, as canvas's `transform()` takes it
 */
export function propOriginMatrix(view, { x, y, lift = 0, size = 1, rotation = 0, mirrored = false } = {}) {
  const k = size * view.scale;
  const sx = mirrored ? -k : k;
  const cos = rotation ? Math.cos(rotation) : 1;
  const sin = rotation ? Math.sin(rotation) : 0;
  // `+ 0` folds the `-0` an unrotated or mirrored prop would otherwise carry.
  return [cos * sx + 0, sin * sx + 0, -sin * k + 0, cos * k + 0, view.toX(x), view.toY(y, lift)];
}

/**
 * THE ARENA'S OWN SCENERY, at the coordinates the build states.
 *
 * ► **ROOT FRAME 221 IS A CONSTRUCTION SCRIPT *AND* A DISPLAY LIST, and this is
 *   what the SCRIPT half builds.** ~~The arena screen's display list is
 *   EMPTY~~ — it is not, and that sentence was a wrong reading of
 *   `resolveTimeline`'s return shape that reached three files. The frame holds
 *   six objects (see `arena-backdrop.js`); the 488 instructions of
 *   `attachMovie` are the other half, and the only scenery among THEM is two
 *   `rockMC` instances:
 *
 *   ```text
 *     _root.arena.gladiators.attachMovie("rockMC", "rockLeft",  200)
 *     _root.arena.gladiators.attachMovie("rockMC", "rockRight", 201)
 *     rockLeft._x  = -2160   rockRight._x = 2160   both _y = 210
 *     arena.gladiators is at (0, 0)
 *   ```
 *
 * ► **AND THE COORDINATES NEED NO CONVERSION, unlike the blood.** These are
 *   attached to `arena.gladiators`, the same object the fighters are attached
 *   to at `_x = ±250` — which is where `SS2_ARENA.frontX` came from. So they
 *   are arena units already. The drops looked like this and were NOT, because
 *   `bounceitem` attaches to the fighter CLIP instead; the difference is which
 *   object the `attachMovie` is called on, and it is worth checking rather than
 *   assuming.
 *
 * ► **THEY MARK THE EDGE OF THE WALKABLE GROUND.** `SS2_ARENA.clamp` is ±2100,
 *   derived from `nextphase` step 1 long before anybody looked at the scenery,
 *   and the rocks stand sixty units outside it. Two independent readings of the
 *   build agreeing about where the arena stops.
 *
 * `_y` 210 against the fighters' 200 puts them ten units nearer the viewer,
 * which is a depth cue and is why they are returned with a `y` rather than
 * assumed level.
 */
export const SS2_ARENA_SCENERY = Object.freeze([
  Object.freeze({ linkage: "rockMC", instance: "rockLeft", x: -2160, y: 210, depth: 200 }),
  Object.freeze({ linkage: "rockMC", instance: "rockRight", x: 2160, y: 210, depth: 201 })
]);

/**
 * The scenery a surface can actually draw, each with its ops resolved, or an
 * empty list when the props have not been extracted.
 *
 * Returns the DECLARED entries filtered to the drawable ones rather than
 * throwing, for the reason every reader here does: a partial extraction must
 * leave a playable arena, and a missing rock is a missing rock.
 *
 * ► **AND LIKE `arrowOpsFor`, NOTHING THIS RETURNS IS TINTED.** `rockMC` is
 *   **1 placement, 0 of them under a non-identity transform**, resolving to 5
 *   operations — the same 5 for each of the two rocks, since they differ only
 *   in `x`. So `emitPropOps`'s colour fold is a no-op on the whole of this
 *   function's output and a check over the scenery could never distinguish the
 *   fold from its absence. Stated here because a number that cannot vary is not
 *   evidence, and this repository has now shipped that mistake six times.
 */
export function arenaSceneryFor(pack) {
  if (!hasExtractedProps(pack)) return [];
  const out = [];
  for (const piece of SS2_ARENA_SCENERY) {
    const ops = propOpsFor(pack, { linkage: piece.linkage, frame: 1 });
    if (!ops) continue;
    out.push(Object.freeze({ ...piece, ops }));
  }
  return Object.freeze(out);
}
