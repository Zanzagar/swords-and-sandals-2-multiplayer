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
 *   7,215 of those 7,246 are the SKY — its day/night colouring IS this
 *         transform, swept across 200 frames, and not a ColorMatrix
 *       0 of the 7,246 land on a fill the arithmetic cannot express
 * ```
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
 */

import {
  applyColourTransform,
  applyColourTransformAlpha,
  colourTransformFrom
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
    gradientAlphaOffsetApproximated: 0
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
 * ONE frame of one prop, expanded to one operation per path of each placement's
 * shape, with the invoice filled in as it goes.
 *
 * Shared by `propOpsFor` and `propInvoiceFor` so that the counts and the
 * operations can never describe two different walks.
 */
function emitPropOps(pack, { linkage, frame = 1 } = {}, invoice) {
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
      ops.push(Object.freeze({
        kind: "path",
        d: path.d,
        matrix: placement.matrix,
        ...(clip ? { clip } : {}),
        // ► **THE PLACEMENT'S COLOUR TRANSFORM, FOLDED IN.** `applyColourTransform`
        //   returns its input untouched for `null`, for `"none"` and for
        //   anything that is not `#rrggbb`, so the four lines below are also
        //   the plain copy they used to be whenever there is nothing to apply.
        fill: applyColourTransform(path.fill ?? null, colour),
        fillRule: path.fillRule ?? "evenodd",
        fillOpacity: applyColourTransformAlpha(path.fillOpacity ?? 1, colour),
        stroke: applyColourTransform(path.stroke ?? null, colour),
        strokeWidth: path.strokeWidth ?? 0,
        strokeOpacity: applyColourTransformAlpha(path.strokeOpacity ?? 1, colour),
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
 * ► **NOR THE `lighten` COMPOSITE.** Every one of sprite 48's seven
 *   placements sets blend mode 5, and `emitPropOps` emits `matrix`, `clip`,
 *   `colour` and the path's own paint — no blend mode at all, for any prop. So
 *   the puff draws as ordinary source-over alpha, which is a DIMMER puff over a
 *   light backdrop and a wrong one over a dark sky. Named rather than left for
 *   a screenshot to find, because it is the same class of silent omission that
 *   left the arena walls invisible: the datum exists upstream, nothing here
 *   reads it, and no count says so.
 *
 * @param {object} pack        from `propPackFrom`
 * @param {number} ageFrames   frames since the puff was attached; 0 is newest
 */
export function arrowTrailOpsFor(pack, ageFrames) {
  const age = Number.isFinite(ageFrames) ? Math.max(0, Math.trunc(ageFrames)) : 0;
  return propOpsFor(pack, { linkage: "bullet_trail", frame: age + 1 });
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
