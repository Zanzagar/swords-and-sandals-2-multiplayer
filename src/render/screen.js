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
 *
 * The loudest of those numbers: **9423 of the 13638 path operations across the
 * 26 screens sit under a placement carrying a FILTERLIST that nothing applies**
 * — 69%. Drop shadows and glows are missing everywhere and the picture is
 * otherwise right, which is exactly the kind of wrongness that reads as
 * finished.
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
 *   changed.
 * - a non-zero `alphaOffset` on a gradient whose stops differ in opacity is
 *   not equivalent to transforming the stops, because a canvas ramp
 *   interpolates between them. Measured: **no drawable on any of the 26
 *   screens has a non-zero `alphaOffset` at all**, so every gradient here
 *   folds exactly. `gradientAlphaOffsetApproximated` counts the other case.
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
    // Emitted, and a FILTERLIST on the placement is stepped over, not applied.
    filtersNotApplied: 0,
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
    // Frames inside this label's own range that differ from the snapshot.
    framesNotStill: Number.isFinite(screen.rangeVariance?.frames) ? screen.rangeVariance.frames : 0,
    // The extractor's own block, verbatim. Kept SEPARATE from the numbers above
    // rather than merged: two tallies that agree are evidence, and one tally
    // copied twice is not.
    fromPack: Object.freeze({ ...(screen.approximations ?? {}) })
  };

  const drawables = Array.isArray(screen.drawables) ? screen.drawables : [];
  const filtered = prefixesOf(screen.filteredPlacements);
  const blended = blendPrefixesOf(screen.blendedPlacements);

  const ops = [];
  for (const drawable of drawables) {
    emitDrawable(pack, drawable, filtered, blended, approximations, ops);
  }

  const text = textOf(pack, screen, approximations);
  const unresolvedByKind = kindsOf(screen);
  approximations.buttonHitAreaOnly = unresolvedByKind["button-hit-area-only"] ?? 0;

  return Object.freeze({
    name: typeof screen.name === "string" ? screen.name : name,
    labelFrame: Number.isFinite(screen.labelFrame) ? screen.labelFrame : null,
    firstFrame: Number.isFinite(screen.firstFrame) ? screen.firstFrame : null,
    lastFrame: Number.isFinite(screen.lastFrame) ? screen.lastFrame : null,
    stage: SS2_STAGE,
    placement: SCREEN_STAGE_PLACEMENT,
    ops: Object.freeze(ops),
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
  const colour = drawable.colour ?? null;
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
    const fillOpacity = transformOpacity(numberOr(entry.fillOpacity, 1), colour);
    const fill = transformFill(entry.fill ?? null, colour);
    const stroke = transformFill(entry.stroke ?? null, colour);
    const strokeWidth = numberOr(entry.strokeWidth, 0);
    const strokeOpacity = transformOpacity(numberOr(entry.strokeOpacity, 1), colour);
    if (under.filtered) approximations.filtersNotApplied += 1;
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
/* Colour transforms                                                   */
/* ------------------------------------------------------------------ */

/**
 * `clamp(value * multiplier + offset)` on one 0..255 channel — Flash's own
 * formula, which is affine and therefore folds into a stop or a flat fill
 * exactly rather than needing a compositing pass.
 *
 * ► **TRUNCATED, NOT ROUNDED, AND THAT IS THE BUILD'S ARITHMETIC.** A
 *   CXFORMWITHALPHA multiply term is 8.8 fixed point and the player computes
 *   `(channel * multTerm) >> 8`, which truncates. `0.5` on `#ff0000` is
 *   `255 * 128 >> 8 = 127`, so `#7f0000` and not `#800000`. Every multiplier on
 *   these 26 screens is in 0..1 so trunc and floor agree here; `Math.trunc` is
 *   written because the wire term is SIGNED and the two would part company if a
 *   negative one ever arrived.
 *
 * ► **The ALPHA half is deliberately NOT done this way** — see
 *   `transformOpacity`. `shapeToPaths` rounds an opacity to three decimals
 *   before it reaches this pack, so reconstructing a byte to truncate would be
 *   false precision dressed as fidelity.
 */
function channelOf(value, multiplier, offset) {
  const out = Math.trunc(value * numberOr(multiplier, 1)) + numberOr(offset, 0);
  return out < 0 ? 0 : out > 255 ? 255 : out;
}

/** Whether a transform touches red, green or blue at all. */
function touchesRgb(colour) {
  if (!colour) return false;
  return numberOr(colour.redMultiplier, 1) !== 1
    || numberOr(colour.greenMultiplier, 1) !== 1
    || numberOr(colour.blueMultiplier, 1) !== 1
    || numberOr(colour.redOffset, 0) !== 0
    || numberOr(colour.greenOffset, 0) !== 0
    || numberOr(colour.blueOffset, 0) !== 0;
}

/**
 * A `#rrggbb` fill with the transform folded in.
 *
 * `"none"` and anything that is not a six-digit hex comes back UNCHANGED: a
 * bitmap fill is reported as `fill: "none"` with the raster beside it, and
 * rewriting that to a colour would hide the bitmap behind a flat square — the
 * failure mode `propOpsFor`'s header records.
 */
function transformFill(fill, colour) {
  if (typeof fill !== "string" || fill.length !== 7 || fill[0] !== "#") return fill;
  if (!colour || !touchesRgb(colour)) return fill;
  const red = Number.parseInt(fill.slice(1, 3), 16);
  const green = Number.parseInt(fill.slice(3, 5), 16);
  const blue = Number.parseInt(fill.slice(5, 7), 16);
  if (!Number.isFinite(red) || !Number.isFinite(green) || !Number.isFinite(blue)) return fill;
  return "#"
    + hex2(channelOf(red, colour.redMultiplier, colour.redOffset))
    + hex2(channelOf(green, colour.greenMultiplier, colour.greenOffset))
    + hex2(channelOf(blue, colour.blueMultiplier, colour.blueOffset));
}

function hex2(value) {
  return value.toString(16).padStart(2, "0");
}

/**
 * An opacity in 0..1 with the alpha half of the transform folded in.
 *
 * The offset is in the wire's 0..255 units and the opacity is in 0..1, which is
 * the conversion a reader writing `opacity * multiplier + offset` would get
 * wrong by a factor of 255 and would never see, because every alphaOffset on
 * these 26 screens is zero.
 *
 * Floating point rather than the integer truncation `channelOf` uses, because
 * the opacity reaching this pack has already been rounded to three decimals by
 * `shapeToPaths` — it is not the build's alpha byte and cannot be turned back
 * into one.
 */
function transformOpacity(opacity, colour) {
  if (!colour) return opacity;
  const out = opacity * numberOr(colour.alphaMultiplier, 1) + numberOr(colour.alphaOffset, 0) / 255;
  return out < 0 ? 0 : out > 1 ? 1 : out;
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
  if (numberOr(colour.alphaOffset, 0) !== 0) {
    const opacities = new Set(stops.map((stop) => numberOr(stop.opacity, 1)));
    if (opacities.size > 1) approximations.gradientAlphaOffsetApproximated += 1;
  }
  return Object.freeze({
    ...gradient,
    stops: Object.freeze(stops.map((stop) => Object.freeze({
      ...stop,
      fill: transformFill(stop.fill, colour),
      opacity: transformOpacity(numberOr(stop.opacity, 1), colour)
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
 * ► **THE WORDS ARE KNOWN AND THE LETTERFORMS ARE NOT.** This pack carries no
 *   glyph outlines — `tools/swf-fonts.mjs` has them and nothing writes them to
 *   `assets/` yet — so these are not path operations and must never be dropped
 *   into `ops` as though they were. What they are is everything a surface with
 *   a substitute face needs: the string, the box, the font's name and weight,
 *   the colour, the alignment. 187 of them across the 26 screens.
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

/** The nesting paths of every placement carrying a FILTERLIST on this screen. */
function prefixesOf(placements) {
  const out = [];
  for (const entry of Array.isArray(placements) ? placements : []) {
    if (Array.isArray(entry?.path)) out.push(entry.path);
  }
  return out;
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
