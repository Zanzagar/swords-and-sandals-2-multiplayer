/**
 * THE ARENA SCREEN — the six things root frame 221 puts on the stage, where
 * they go, and the camera the build wrote for them.
 *
 * ## What this is, and why it is not part of `props.js`
 *
 * `props.js` draws things that stand IN the arena — an arrow, a rock, a spray
 * of blood — each at a coordinate the resolver hands it. This file is the
 * arena ITSELF: a fixed stage, a layer order, and the mapping from arena units
 * to stage pixels that every one of those coordinates is expressed in. It is
 * the datum the rest of the renderer has been implying.
 *
 * ## THE MAPPING IS 1:1, and it is measured rather than chosen
 *
 * Root frame 221 places six objects. Read off the oracle (`77cb545c…`) by
 * resolving the ROOT timeline — a pseudo-sprite spanning `tagStreamStart` to
 * the end of the file — and taking `frames[220]`:
 *
 * ```text
 *   depth     char  instance          at (stage px)      scale
 *       1      643  (unnamed)         (   0.00,   0.00)   1.00   the backdrop
 *       3     1729  sky               ( 315.70, 216.85)   1.04   sky + clouds
 *      59     2249  arena             ( 319.95, 166.75)   1.00   sand + crowd
 *      80     1816  rain              (-310.35, -66.35)   1.00   weather
 *     438     1531  fiz_info_panel    (  -0.50, 401.00)   1.00   the UI bar
 *    1193      646  (unnamed)         ( -25.55, -33.00)   1.00   the border
 * ```
 *
 * The backdrop measures **640 x 420 px — the declared stage, to the pixel** —
 * and is placed unscaled at the origin. `arena` is placed UNSCALED. Its
 * `gladiators` child is created at `(0, 0)` of it and the fighters are
 * constructed at `_x = ±250`, `_y = 200` inside that. So:
 *
 * ```text
 *   one arena unit       = one stage pixel
 *   the arena origin     = (319.95, 166.75) on stage
 *   THE GROUND LINE      = 166.75 + 200      = 366.75
 *   a fighter at _x ±250 = stage x 69.95 and 569.95
 * ```
 *
 * ► **THREE ROWS OF THE COMMITTED SIZE TABLE WERE OUT BY A FACTOR OF TWENTY,
 *   AND THE CAUSE IS A UNITS SEAM THIS REPOSITORY DOCUMENTS ELSEWHERE.** A
 *   matrix out of `tools/swf-display-list.mjs` carries `tx`/`ty` in TWIPS
 *   (`readMatrix`'s own docstring says so, and `composeMatrix` keeps them
 *   there because composing in twips is exact); `shapeToPaths` and every `px()`
 *   helper emit PIXELS. Compose a pixel bound with a twips translation and the
 *   offset — not the size — inflates twentyfold, so the error is invisible on
 *   anything placed at the origin and enormous on anything that is not.
 *   Measured here, against what `docs/integration/ss2-battle-map.md` carried:
 *
 * ```text
 *                    committed            measured        placed at
 *     char  643    640 x  420 px       640 x 420 px       (0, 0)        RIGHT
 *     char 1729   8417 x 1032 px       640 x 211 px       offset        WRONG
 *     char 2249  24177 x 2489 px      1363 x 422 px       offset        WRONG
 *     char 1531   1919 x  210 px       641 x  27 px       offset        WRONG
 *     char  646    732 x  505 px       732 x 505 px       ~origin       RIGHT
 * ```
 *
 *   The two that were right are the two whose contents sit at the origin. **A
 *   table that is correct wherever the bug cannot bite reads as a table that
 *   was checked.**
 *
 * ## THE CAMERA: the build has one, it is LIVE, and reading it cost a retraction
 *
 * `sprite:2249/frame:1/DoAction@0x6e421b` defines `getfightdistance`,
 * `combatCamera` and `combatscale`, and installs two anonymous handlers —
 * `crowd.onEnterFrame` (`+0x0d54`) and `gladiators.onEnterFrame` (`+0x0e68`).
 *
 * ► **`combatscale` IS THE CAMERA AND IT RUNS EVERY FRAME.**
 *   `gladiators.onEnterFrame` calls `getfightdistance()` and then, guarded on
 *   `_global.phasecomplete != false`, calls `combatscale()` at `+0x0e98`. The
 *   name resolves because the handler's closure carries sprite 2249's own
 *   timeline on its scope chain, which is where `combatscale` is defined.
 *   **So the shipped arena PANS and ZOOMS.**
 *
 * ► **`combatCamera` IS THE DEAD ONE, AND IT IS DEAD IN THE MOST LITERAL WAY:
 *   ITS BODY IS `return;`.** Decoded from the `DefineFunction2` header at
 *   `+0x048a` — payload 20, name `combatCamera`, 0 params, 9 registers, flags
 *   `0x016a`, CodeSize 476 — the body starts at file `0x6e46c2` (`+0x04a1`) and
 *   its first five bytes are `96 01 00 03 3e`: **`Push undefined; Return`.** The
 *   470 bytes after it — the `midway_focus` move, two registers stored and
 *   never read, a `localToGlobal` whose result is discarded, `maxscale = 1500 −
 *   midwaypoint` clamped to `[15, 100]`, and a Tween on `whichcharacter._x` —
 *   are unreachable. It is still CALLED, live, from `nextphase`
 *   (`sprite:862[overlay]/frame:52` `+0x31af`), and it does nothing.
 *
 * ► **THIS FILE FIRST SAID THE EXACT OPPOSITE, AND THE RETRACTION IS THE POINT.**
 *   The first version of this comment stated that `combatCamera` was the live
 *   camera and `combatscale` was dead code, and concluded that "the shipped
 *   arena is a FIXED camera" and that the repository's standing claim that the
 *   arena pans was wrong. **Every part of that was backwards.** Two failures
 *   produced it, both mine and both avoidable:
 *
 *   1. **I read `Push undefined; Return` at the top of my own disassembly and
 *      explained it away** as the tail of the preceding function. It was the
 *      whole function. The evidence that settles the question was the first two
 *      lines of the dump, and I wrote a reason for it not to count.
 *   2. **I searched for `combatscale`'s call sites, was told there were five
 *      references, and read two.** The live call is the third. A count that
 *      does not match the number of things you looked at is the cheapest
 *      possible tell, and it was printed.
 *
 *   **Eighth instance of this project's signature failure**, and the first
 *   where the refuted claim was mine and fresh rather than inherited. It was
 *   caught by a six-agent wave aimed at questions rather than at confirming the
 *   premise — two independent investigators broke it by different routes within
 *   twenty minutes, and the header, the constants and the call sites above were
 *   then re-derived here rather than relayed.
 *
 * ## SO THIS IS A REPRODUCTION, NOT A DIVERGENCE
 *
 * Every constant below is read off `combatscale` (`+0x0693`..`+0x0ad8`) and
 * none is chosen here. The build pans `gladiators._x` to keep the fight's
 * midpoint inside a dead zone of stage x 300..340, eases by a sixteenth of the
 * overshoot a frame, bands a zoom target on the separation, eases
 * `_global.zoomscale` toward it by a fifth with a snap inside ±4, and applies
 * it as `gladiators._xscale = _yscale = ceil(zoomscale)`.
 *
 * ► **`maxscale` AND `zoomscale` LIVE ON `_global`, NOT ON THE ARENA.**
 *   `combatscale`'s flags `0x016a` preload `_root` into register 1 and
 *   `_global` into register 2, so every `register:2, "maxscale"` in the
 *   disassembly is `_global.maxscale`. The map calls it `arena.maxscale`; that
 *   is a naming error, harmless to the arithmetic and worth not repeating.
 *
 * ► **AND THE BOUT OPENS AT A ZOOM OF FIVE.** `_global.zoomscale = 5` at
 *   `+0x0c7c`, on the arena clip's own frame 1 — so the arena does not open
 *   framed, it RUSHES IN, easing 5 → 20 → 32 → 42 → … → 80 and snapping, about
 *   sixteen frames at 30fps. That is the build's opening shot and it is
 *   reproduced. (The first version of this file asserted that `zoomscale` was
 *   never initialised anywhere in the build and "repaired" it by opening
 *   settled — a repair for a defect the build does not have, and it would have
 *   thrown the opening shot away.)
 *
 * ► **WHAT IS STILL OURS IS THE GENERALISATION TO MORE THAN TWO GLADIATORS**,
 *   and it is named at `midwaypointFor`. Vanilla has one pair, so "half the
 *   separation" and "half the spread of everybody on the field" are the same
 *   number and the bytes cannot distinguish them. With six on the field they
 *   are not, and the camera has to frame all six.
 *
 * ► **ONE MORE DEAD LIMB, RECORDED BECAUSE IT LOOKS LIKE A FEATURE.**
 *   `crowd.onEnterFrame` moves `crowd._x` to track
 *   `arena.gladiators.camPoint.x` against the same 300..340 dead zone, with a
 *   wrap at −600/200. **`camPoint` is never assigned anywhere in the build** —
 *   the string occurs exactly once in 7,586,504 bytes, at `0x6e4430`, as one
 *   constant-pool entry read four times inside that handler. So both tests
 *   compare against `undefined`, both are false, and the crowd's HORIZONTAL
 *   parallax never fires. Its vertical one does, from `combatscale`. Not
 *   reproduced, because reproducing it would be inventing the `camPoint` the
 *   build forgot to write.
 *
 * ## HOW MUCH OF THE STAGE THE BUILD'S BANDS ACTUALLY USE, measured
 *
 * The bands were written for a fight where the two gladiators ARE the picture.
 * Given to a spread of six they are conservative — everything stays on stage
 * with room to spare, which is the safe direction to be wrong in, but it is
 * not free:
 *
 * ```text
 *   spread   mp    zoom   drawn width   of a 640px stage
 *      130    65     80      104 px          16%     two fighters at reach
 *      500   250     50      250 px          39%     a vanilla 1v1 opening
 *     1020   510     30      306 px          48%     a 3v3 opening
 * ```
 *
 * **That is a tuning question, it is the owner's, and it is deliberately not
 * pre-empted here.** The alternative is choosing our own band boundaries, which
 * is the invention this whole file exists to avoid; if the frame reads as too
 * empty when somebody looks at it, the lever is `SS2_CAMERA.bands` and the
 * change should be recorded as authored rather than folded in as derived.
 */

/** No pack, or a pack with nothing this file can draw, is not an error. */
export class ArenaBackdropError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * The SWF's declared stage. Every coordinate in this file is in these units,
 * and a surface fits this rectangle into its canvas rather than scaling the
 * arena to its roster.
 */
export const SS2_STAGE = Object.freeze({ width: 640, height: 420 });

/**
 * Where `_root.arena` sits on that stage, measured off root frame 221's
 * placement matrix: `tx` 6399 twips, `ty` 3335 twips.
 *
 * **Not rounded to (320, 167).** The build's own number is 319.95 / 166.75 and
 * a renderer that rounds it is a quarter-pixel out at every zoom level for no
 * gain; the table in the map rounds for readability and this does not.
 */
export const SS2_ARENA_ORIGIN = Object.freeze({ x: 319.95, y: 166.75 });

/**
 * The stage y a gladiator's feet rest on AT FULL ZOOM — the arena origin plus
 * the `_y = 200` both vanilla fighters are constructed at, which is
 * `SS2_ARENA.frontY`.
 *
 * **This is the number a previous session called "the unknown that would put
 * gladiators in the sky if guessed", and it was never unknown**: it is the
 * front rank's own datum, which this engine has shipped since position landed.
 *
 * ► **AND IT IS NOT A CONSTANT ONCE THE CAMERA MOVES.** `combatscale` scales
 *   `gladiators` and NOTHING ELSE — the sand is a sibling of `gladiators`
 *   inside the arena clip, not a parent of it — so zooming out does not shrink
 *   the ground, it walks the fighters UP the ground toward the horizon. Use
 *   `groundLineAt(camera)`; this constant is the `zoomscale === 100` case and
 *   is exported because it is the number the map and the handoffs quote.
 */
export const SS2_GROUND_LINE = SS2_ARENA_ORIGIN.y + 200;

/**
 * HOW STRONGLY A RANK READS AS DEPTH — **1, because the build's own `_y` IS
 * this axis and the sand is painted for its range.**
 *
 * ► **THIS REPLACES AN AUTHORED 1.7 AND THE REASON IS THE ART.**
 *   `tools/arena/main.js`'s `toY` carries an unnamed `* 1.7` on the depth term,
 *   chosen against the authored gradient bowl it draws, where the "ground" is a
 *   rectangle from the horizon down and any factor lands on it. **The build's
 *   sand is not a rectangle.** Measured: the arena clip's ground art (char 673)
 *   spans local y −56.75..256.2, and the three ranks at stride 97 sit at local
 *   y 200, 103 and 6 — all comfortably on it at factor 1. At 1.7 they sit at
 *   200, 35.1 and **−129.8**, which is above the top of the painted sand: the
 *   back rank would stand in the crowd.
 *
 *   So the factor is not a taste that survived the art change. `1.7` remains in
 *   the authored-bowl path in the shell, where it is still correct and where a
 *   clone with no extraction still runs.
 */
export const RANK_DEPTH_FACTOR = 1;

/**
 * THE SIX OBJECTS OF ROOT FRAME 221, in the build's own depth order.
 *
 * `space` is the load-bearing field and it is the thing a renderer gets wrong:
 *
 * - **`stage`** — placed on the ROOT, so the camera does not touch it. The
 *   backdrop, the sky, the rain, the UI bar and the border are all painted at
 *   fixed stage coordinates however far the arena has panned or zoomed.
 * - **`arena`** — placed inside `_root.arena`, whose `gladiators` child is what
 *   `combatscale` pans and scales. Everything that is part of the FIGHT lives
 *   here: the sand, the crowd, the rocks, the fighters, the arrows.
 *
 * ► **Getting that split wrong is the same class of error as the blood-versus-
 *   rocks trap already recorded in `props.js`**: which object something is
 *   attached to decides its coordinate space, and both look like a coordinate
 *   until the camera moves.
 *
 * `prop` is the key in an extracted pack. An entry whose prop is absent is
 * skipped, never faked — a clone with a partial extraction gets a partial arena
 * and a whole stack trace is a worse outcome than a missing rain layer.
 */
export const SS2_ARENA_SCREEN_LAYERS = Object.freeze([
  Object.freeze({
    order: 1, depth: 1, character: 643, instance: null, prop: "backdrop",
    space: "stage", behindFighters: true, x: 0, y: 0, scale: 1,
    note: "640 x 420 — the declared stage to the pixel; the sky and ground the fight happens against"
  }),
  Object.freeze({
    order: 2, depth: 3, character: 1729, instance: "sky", prop: "sky",
    space: "stage", behindFighters: true, x: 315.7, y: 216.85, scale: 1.04,
    // ► 200 frames, and they are a LOOKUP: `_root.sky.gotoAndStop(time_of_day)`
    //   with `_global.time_of_day = 1 + random(23)`, followed immediately by
    //   `cacheAsBitmap = true` — which a clip that played could not be. They
    //   resolve to six distinct skies.
    frameFrom: "timeOfDay",
    note: "the sky and its clouds; the ONE object on this frame that is not unscaled"
  }),
  Object.freeze({
    // ► **INSIDE the arena clip, at ITS depth 1** — so its placement is in
    //   arena-local units and `arenaOffset` is what turns it into a stage
    //   coordinate. The arena clip is placed UNSCALED, so nothing else changes.
    order: 3, depth: 1, character: 673, instance: "sand", prop: "sand",
    space: "arena", behindFighters: true, x: -323.95, y: -56.75, scale: 1,
    // `sand.gotoAndStop(current_arena)` (`+0x0d0f`) — SIX grounds, not one.
    frameFrom: "arena",
    note: "the ground, arena-local y -56.75..256.2 — the range that set RANK_DEPTH_FACTOR"
  }),
  Object.freeze({
    // ► **THE ONE THING ON THIS SCREEN THE CAMERA MOVES BESIDES THE FIGHTERS.**
    //   `combatscale` ends `crowd._y = -200 + ceil(zoomscale)` (`+0x0ab1`), so
    //   the stands RISE as the camera pulls back. `y` here is the placement the
    //   timeline gives it; `cameraY` says the camera overwrites it, and note
    //   that the two disagree by 10.5 units — **the build's first camera frame
    //   moves the crowd whether or not the fight has started.**
    order: 4, depth: 3, character: 2112, instance: "crowd", prop: "crowd",
    space: "arena", behindFighters: true, cameraY: true, x: 1.05, y: -110.5, scale: 1,
    // `crowd.gotoAndStop(current_arena)` (`+0x0c99`) — the SAME index as the
    // sand, so one choice dresses both and they cannot disagree.
    frameFrom: "arena",
    note: "eight tiled stands; the one piece of scenery the camera moves"
  }),
  Object.freeze({
    order: 6, depth: 80, character: 1816, instance: "rain", prop: "rain",
    space: "stage", behindFighters: false, x: -310.35, y: -66.35, scale: 1,
    // ► **FRAMES 1-9 DRAW NOTHING; 10-17 CARRY THE WEATHER.** So frame 1 is
    //   "dry", and the default below lands there deliberately — a clear arena
    //   is the resting state, not a failed read. Ask for 10..17 to make it
    //   rain.
    frameFrom: "weather",
    note: "weather; frames 1-9 are empty and that is the clip at rest"
  }),
  Object.freeze({
    order: 7, depth: 438, character: 1531, instance: "fiz_info_panel", prop: "panel",
    space: "stage", behindFighters: false, x: -0.5, y: 401, scale: 1,
    note: "the bottom UI bar, 641 x 27, and it carries live text this renderer draws itself"
  }),
  Object.freeze({
    order: 8, depth: 1193, character: 646, instance: null, prop: "border",
    space: "stage", behindFighters: false, x: -25.55, y: -33, scale: 1,
    note: "the ornamental frame, 732 x 505 — larger than the stage on every side, and painted over everything"
  })
]);

/**
 * Where the fighters, the rocks, the arrows and the blood are painted, in the
 * same `order` the layers use — **`order` 5, between the crowd and the rain.**
 *
 * A number rather than a comment because the split is the thing a renderer gets
 * wrong: the border and the UI bar must paint OVER a gladiator, and the sand
 * and the crowd must paint UNDER one. Drawing all six layers first and the
 * fighters last looks right until an arrow flies over the frame.
 */
export const SS2_GLADIATORS_ORDER = 5;

/**
 * The arena clip's own origin as an offset a caller adds to an `arena`-space
 * layer. Named so that the two spaces are never mixed by accident.
 */
export const SS2_ARENA_OFFSET = SS2_ARENA_ORIGIN;

/**
 * THE CAMERA'S CONSTANTS, every one read off `combatscale`.
 *
 * The offsets are into `sprite:2249/frame:1/DoAction@0x6e421b`.
 */
export const SS2_CAMERA = Object.freeze({
  /**
   * The focus is kept between these two STAGE x positions, easing by
   * `1 / panEase` of the overshoot a frame (`+0x07b1`, `+0x07f2`).
   *
   * It straddles the arena origin: 300..340 is 320 ± 20, so "centred" for this
   * camera means the midpoint of the fight sits on the arena's own origin.
   */
  deadZoneLeft: 300,
  deadZoneRight: 340,
  /** `+0x0730` — stored into register 4 and divided by at `+0x07e2`/`+0x082b`. */
  panEase: 16,
  /** `+0x0723` — stored into register 5 and divided by at `+0x09cd`/`+0x0a1a`. */
  zoomEase: 5,
  /** `+0x0a3e`/`+0x0a60` — inside ±4 of the target, snap to it and stop easing. */
  zoomSnap: 4,
  /**
   * The zoom bands, in the build's own order, applied in that order with the
   * LAST match winning — which is what makes the 70 and 60 arms dead. See the
   * header. `test` is written as the bytes test it, not as the band it looks
   * like.
   */
  bands: Object.freeze([
    Object.freeze({ scale: 80, min: null, max: 240, site: "+0x083c" }), // midwaypoint < 240
    Object.freeze({ scale: 70, min: 240, max: 300, site: "+0x085e" }), // > 240 && !(> 300)  DEAD
    Object.freeze({ scale: 60, min: 300, max: 400, site: "+0x0898" }), // > 300 && !(> 400)  DEAD
    Object.freeze({ scale: 50, min: 200, max: 400, site: "+0x08d2" }), // > 200 && !(> 400)  eats both, and part of 80
    Object.freeze({ scale: 30, min: 400, max: 700, site: "+0x090c" }),
    Object.freeze({ scale: 20, min: 700, max: 1500, site: "+0x0946" }),
    Object.freeze({ scale: 15, min: 1500, max: null, site: "+0x097c" })
  ]),
  /**
   * `crowd._y = -200 + ceil(zoomscale)` (`+0x0ab1`). The crowd RISES as the
   * camera pulls back, which is the one parallax the build actually runs.
   */
  crowdBaseY: -200,
  /**
   * `_global.zoomscale = 5` (`+0x0c7c`), on the arena clip's own frame 1.
   *
   * ► **THE ARENA OPENS AT A TWENTIETH OF ITS SIZE AND RUSHES IN.** Five is not
   *   a floor or a sentinel — it is the first frame's zoom, and the ease then
   *   takes about sixteen frames to reach the target. Opening settled instead
   *   would be smoother, would look deliberate, and would delete the build's
   *   own establishing shot.
   */
  zoomStart: 5,
  /**
   * The floor the fit clamp will not go below — the build's own smallest band.
   * A roster wide enough to need less than this is one the arena cannot frame
   * at all, and drawing it at 15 with the flanks off the edge is a better
   * answer than drawing six specks.
   */
  zoomMinimum: 15
});

/**
 * Every placed actor as `{x, side}`, from either shape a caller may hand in.
 *
 * A bare number is an actor with NO side, which is how the one-dimensional
 * callers and the tests express "just these positions".
 */
function actorsFrom(input) {
  const out = [];
  for (const entry of input ?? []) {
    if (Number.isFinite(entry)) out.push({ x: entry, side: null });
    else if (entry && Number.isFinite(entry.x)) out.push({ x: entry.x, side: entry.side ?? null });
  }
  return out;
}

/**
 * `midwaypoint`, the single number the build's zoom bands key on.
 *
 * `getfightdistance` sets it at `+0x0467`: `Math.round(fightdistance / 2)`,
 * where `fightdistance` is the build's own EUCLIDEAN distance between THE HERO
 * AND THE VILLAIN. So it is half the separation of **the two gladiators who are
 * fighting each other** — not half the width of the scene.
 *
 * ► **AND CONFLATING THOSE TWO WAS A REAL DEFECT, FOUND BY LOOKING AT IT.**
 *   The first version of this function took the SPREAD of every placed actor,
 *   on the reasoning that vanilla has one pair so the bytes cannot distinguish
 *   the two readings. True, and it picked the wrong one. Measured at the
 *   default 3v3 with `rankStride` 97:
 *
 * ```text
 *                 spread   midwaypoint   zoom   stage used   figure height
 *     1v1            500          250      50         55%         75 px
 *     2v2            760          380      50         76%         75 px
 *     3v3           1020          510      30         58%         45 px
 * ```
 *
 *   **The 3v3 was both smaller AND using less of the screen than the 2v2**,
 *   which is not perspective, it is a band cliff: crossing `midwaypoint` 400
 *   drops the zoom from 50 to 30, a 40% shrink for a 34% wider fight. The
 *   spread at a 3v3 opening is dominated by the outermost ALLIES, who are not
 *   fighting anybody — so the camera was pulling back to frame a formation
 *   while the fight happened in the middle of it. The owner saw it immediately:
 *   *"the zoom appears to be way too far out"*.
 *
 * ► **SO THIS IS THE CLOSEST ENGAGEMENT, which IS the build's meaning.** The
 *   minimum separation over opposing pairs: at one pair it is exactly
 *   `fightdistance`, and at six it is "how close is the closest fight", which
 *   is the question the bands were calibrated against. **Keeping everybody on
 *   stage is a separate job and is done separately**, by `fitZoomFor` — because
 *   a camera has two duties and giving one number both of them is what went
 *   wrong here.
 *
 * @param {Array<number|{x:number, side:*}>} input  every PLACED actor
 */
export function midwaypointFor(input) {
  const placed = actorsFrom(input);
  if (placed.length < 2) return 0;
  const sides = new Set(placed.map((actor) => actor.side).filter((side) => side !== null));
  if (sides.size < 2) {
    // No sides to oppose — the whole field is the fight, which is also the
    // vanilla case and reduces to `fightdistance / 2` at two actors.
    const xs = placed.map((actor) => actor.x);
    return Math.round((Math.max(...xs) - Math.min(...xs)) / 2);
  }
  let closest = Infinity;
  for (const actor of placed) {
    for (const other of placed) {
      if (other.side === actor.side) continue;
      closest = Math.min(closest, Math.abs(actor.x - other.x));
    }
  }
  return Number.isFinite(closest) ? Math.round(closest / 2) : 0;
}

/**
 * A gladiator's own half-width in arena units, for the fit below.
 *
 * AUTHORED, and it is the same figure `viewportFor` has carried since the
 * arena was first drawn: about 105 units of reach and body either side of where
 * a gladiator stands. It is a margin, not a measurement — being ten units out
 * moves the fit by under two percent.
 */
export const FIGURE_HALF_WIDTH = 105;

/**
 * THE ZOOM AT WHICH EVERY PLACED ACTOR STILL FITS THE STAGE.
 *
 * ► **THIS IS OURS, AND IT IS THE HALF OF THE CAMERA VANILLA NEVER NEEDED.**
 *   Two gladiators who start 500 apart and only close never threaten the edge
 *   of a 640px stage, so the build's bands never had to care. Six do: a 3v3
 *   opens 1020 wide and the rank verbs can spread it further.
 *
 * It is a CEILING, never a floor — `cameraStep` takes the smaller of this and
 * the band, so it can only ever pull the camera BACK. That ordering is what
 * keeps the build's own 1v1 byte-for-byte unchanged: at two gladiators this
 * number is ~90 and the band is 50, so the band wins and nothing here applies.
 */
export function fitZoomFor(input) {
  const placed = actorsFrom(input);
  if (placed.length === 0) return SS2_CAMERA.bands[0].scale;
  const xs = placed.map((actor) => actor.x);
  const needed = (Math.max(...xs) - Math.min(...xs)) + FIGURE_HALF_WIDTH * 2;
  if (needed <= 0) return SS2_CAMERA.bands[0].scale;
  // Floored, not rounded: rounding up is the direction that puts a shoulder
  // off the edge, and the whole point of this number is that it does not.
  return Math.max(SS2_CAMERA.zoomMinimum, Math.floor((SS2_STAGE.width / needed) * 100));
}

/**
 * Where the camera is looking, in ARENA units.
 *
 * The build writes `midway_focus._x = leftmost._x + midwaypoint` in both
 * `combatCamera` (`+0x0501` / `+0x052e`) and `combatscale` (`+0x06ee` /
 * `+0x0721`) — the leftmost of the two, never the hero specifically.
 *
 * ► **AND IT IS NOT QUITE THE MIDPOINT IN THE BUILD, WHICH IS REPRODUCED.**
 *   `midwaypoint` is half the EUCLIDEAN distance, so two gladiators at
 *   different `_y` put the focus slightly RIGHT of the true x-midpoint. Here
 *   `midwaypointFor` takes the x-spread, so the focus IS the midpoint — the
 *   divergence is the same one named above and is stated in both places rather
 *   than in neither.
 */
export function focusXFor(input) {
  const placed = actorsFrom(input).map((actor) => actor.x);
  if (placed.length === 0) return 0;
  // ► **THE FOCUS IS THE MIDDLE OF EVERYBODY, NOT THE MIDDLE OF THE CLOSEST
  //   FIGHT**, and that is deliberate now that the two differ. The zoom's job
  //   is to follow the drama; the focus's job is to keep the scene centred, and
  //   pointing the camera at one duel would slide the rest of the roster off
  //   the opposite edge. At vanilla's single pair the two are the same point.
  return (Math.min(...placed) + Math.max(...placed)) / 2;
}

/**
 * The zoom the camera is easing TOWARD, from the separation.
 *
 * Applied in the build's order with the last match winning, which is the build's
 * own semantics for a run of `if`s. See `SS2_CAMERA.bands`.
 */
export function zoomTargetFor(midwaypoint) {
  if (!Number.isFinite(midwaypoint)) return SS2_CAMERA.bands[0].scale;
  let scale = SS2_CAMERA.bands[0].scale;
  for (const band of SS2_CAMERA.bands) {
    const overMin = band.min === null ? true : midwaypoint > band.min;
    const underMax = band.max === null ? true : !(midwaypoint > band.max);
    // The first band is the only one written as a strict `<`, at `+0x083c`.
    const matches = band.min === null ? midwaypoint < band.max : overMin && underMax;
    if (matches) scale = band.scale;
  }
  return scale;
}

/**
 * One frame of the zoom ease — `+0x0994`..`+0x0a7c`.
 *
 * `Math.round` is the build's, and it is why this converges rather than
 * crawling: a gap of 1 to 4 rounds to 0 or 1 and the snap below catches the
 * rest.
 *
 * A non-finite input takes the target. That is a GUARD here and not a model of
 * anything — the build initialises `_global.zoomscale` to 5 and never leaves it
 * undefined. It exists so a caller that has not seeded a camera draws an arena
 * rather than a blank canvas.
 */
export function easeZoom(zoomscale, target) {
  if (!Number.isFinite(zoomscale)) return target;
  let next = zoomscale;
  if (next > target) next -= Math.round((next - target) / SS2_CAMERA.zoomEase);
  if (next < target) next += Math.round((target - next) / SS2_CAMERA.zoomEase);
  // The snap is written as a two-sided test rather than an `abs`, so it is
  // written that way here: it fires on the frame the ease lands inside ±4.
  if (next > target - SS2_CAMERA.zoomSnap && next < target + SS2_CAMERA.zoomSnap) next = target;
  return next;
}

/**
 * One frame of the pan — `+0x07a9`..`+0x082d`.
 *
 * The build tests the focus's STAGE x, which it gets by calling
 * `gladiators.localToGlobal` on the focus point. That composition is done by
 * the caller here and handed in, because doing it inside would need this pure
 * module to know the whole display tree.
 *
 * Returns the NEW `gladiators._x`, in arena units.
 */
export function panStep(gladiatorsX, focusStageX) {
  if (!Number.isFinite(focusStageX)) return gladiatorsX;
  let next = gladiatorsX;
  if (focusStageX < SS2_CAMERA.deadZoneLeft) {
    next += (SS2_CAMERA.deadZoneLeft - focusStageX) / SS2_CAMERA.panEase;
  }
  if (focusStageX > SS2_CAMERA.deadZoneRight) {
    next -= (focusStageX - SS2_CAMERA.deadZoneRight) / SS2_CAMERA.panEase;
  }
  return next;
}

/**
 * The camera's opening state for a set of actors — the build's own first frame.
 *
 * ► **IT OPENS AT `zoomscale` 5 AND RUSHES IN**, because `_global.zoomscale = 5`
 *   is what the arena clip's frame 1 sets (`+0x0c7c`) and `combatscale` then
 *   eases toward the band target by a fifth a frame. `gladiators._x` opens at 0
 *   because root frame 221 sets it there explicitly (`+0x04ad` / `+0x04ce`).
 *
 *   **An earlier version of this function opened SETTLED**, on the mistaken
 *   ground that the build never initialised `zoomscale` at all. It does, and
 *   the value it chooses is the establishing shot.
 */
export function cameraFor(xs) {
  const midwaypoint = midwaypointFor(xs);
  return Object.freeze({
    midwaypoint,
    focusX: focusXFor(xs),
    zoomscale: SS2_CAMERA.zoomStart,
    maxscale: targetZoomFor(midwaypoint, xs),
    gladiatorsX: 0,
    crowdY: SS2_CAMERA.crowdBaseY + Math.ceil(SS2_CAMERA.zoomStart)
  });
}

/**
 * The zoom the camera is easing toward: **the build's band, pulled back only as
 * far as fitting everybody requires.**
 *
 * ► **THE `min` IS THE WHOLE DESIGN.** The band is the build's own drama and it
 *   wins whenever it can; the fit can only ever OVERRIDE IT DOWNWARD, never
 *   raise it. So a vanilla 1v1 — where the fit is around 90 and the band is 50
 *   — is exactly what it was before this function existed, and a 3v3 that would
 *   have its flanks off the edge gets pulled back by the smallest amount that
 *   puts them on.
 */
export function targetZoomFor(midwaypoint, input) {
  return Math.min(zoomTargetFor(midwaypoint), fitZoomFor(input));
}

/**
 * One frame of the camera, in the build's own order: focus, then pan, then
 * zoom target, then zoom ease, then the crowd.
 *
 * **Order matters and is the build's.** `combatscale` pans against the focus's
 * stage position computed at the OLD zoom, then re-targets the zoom — so a
 * frame that both pans and zooms lags the zoom by one frame. Reproducing that
 * costs nothing and inventing a "corrected" order would be a change nobody
 * asked for.
 *
 * @param {object}   camera  the previous frame's camera, from `cameraFor`
 * @param {number[]} xs      arena x of every placed actor
 */
export function cameraStep(camera, xs) {
  const midwaypoint = midwaypointFor(xs);
  const focusX = focusXFor(xs);
  const zoom = camera.zoomscale;
  // `localToGlobal` on the focus: the arena's own origin, plus the pan, plus
  // the focus scaled by the zoom the gladiators layer is CURRENTLY at.
  const focusStageX = SS2_ARENA_ORIGIN.x + camera.gladiatorsX + focusX * (zoom / 100);
  const gladiatorsX = panStep(camera.gladiatorsX, focusStageX);
  const maxscale = targetZoomFor(midwaypoint, xs);
  const zoomscale = easeZoom(zoom, maxscale);
  return Object.freeze({
    midwaypoint,
    focusX,
    zoomscale,
    maxscale,
    gladiatorsX,
    crowdY: SS2_CAMERA.crowdBaseY + Math.ceil(zoomscale)
  });
}

/**
 * ARENA UNITS -> STAGE PIXELS, for a camera.
 *
 * This is the whole of the projection, and it is the build's own display tree
 * written out: the arena sits at its origin, `gladiators` is panned inside it
 * and scaled by the zoom, and a fighter's `(_x, _y)` is a point in that child.
 *
 * ```text
 *   stage x = originX + gladiatorsX + arenaX * zoom/100
 *   stage y = originY + (arenaY * RANK_DEPTH_FACTOR - lift) * zoom/100
 * ```
 *
 * ► **THE ZOOM IS ON BOTH TERMS BECAUSE IT IS ON THE CLIP.** The build sets
 *   `gladiators._xscale = _yscale`, so a zoom-out does not merely narrow the
 *   arena — it lifts the fighters up the sand, which is what a 2D camera
 *   pulling back looks like when the ground is a painting rather than a plane.
 *   A projection that pinned the ground line would slide every fighter off the
 *   sand the moment the camera moved.
 *
 * ► **DEPTH AND HEIGHT BOTH LAND ON STAGE y, AND THE BUILD HAS ONLY ONE OF
 *   THEM.** Vanilla spends `_y` on the jump arc and has no second rank to be
 *   behind, so this engine's depth axis borrows the same number. The signs are
 *   opposite and that is the point: arena `y` grows DOWNWARD (Flash's own
 *   convention, and why the front rank is 200 and the back rank is 6), while
 *   `lift` is a height above the ground and grows UPWARD.
 */
export function arenaToStage(camera, { x = 0, y = 200, lift = 0 } = {}) {
  const zoom = (camera?.zoomscale ?? 100) / 100;
  const pan = camera?.gladiatorsX ?? 0;
  return {
    x: SS2_ARENA_ORIGIN.x + pan + x * zoom,
    y: SS2_ARENA_ORIGIN.y + (y * RANK_DEPTH_FACTOR - lift) * zoom
  };
}

/**
 * Where a gladiator's feet rest at this camera — `arenaToStage` at the front
 * rank, named because it is the number every other layer is judged against.
 */
export function groundLineAt(camera) {
  return arenaToStage(camera, { x: 0, y: 200, lift: 0 }).y;
}

/**
 * THE STAGE FITTED INTO A CANVAS — letterboxed, never stretched.
 *
 * The build's stage has a fixed 640:420 aspect and its border art overhangs
 * every edge; stretching it to a canvas of another shape would distort the
 * gladiators with it. So the stage is scaled uniformly to fit and centred, and
 * the canvas outside it is the surface's own business.
 *
 * ► **THIS IS WHAT "THE BACKDROP SETS THE SCALE" MEANS IN CODE** — the owner's
 *   decision, 2026-09-13. Nothing is fitted to the roster any more: a 1v1 and a
 *   3v3 get the same frame, and what differs is how far the camera has pulled
 *   back inside it.
 */
export function stageFitFor({ width, height }) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : SS2_STAGE.width;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : SS2_STAGE.height;
  const scale = Math.min(safeWidth / SS2_STAGE.width, safeHeight / SS2_STAGE.height);
  return Object.freeze({
    scale,
    offsetX: (safeWidth - SS2_STAGE.width * scale) / 2,
    offsetY: (safeHeight - SS2_STAGE.height * scale) / 2
  });
}

/**
 * ARENA UNITS -> CANVAS PIXELS, as the two closures every drawing site in the
 * shell already calls.
 *
 * ► **THIS EXISTS SO THE SHELL HOLDS NO ARITHMETIC, and that is not tidiness.**
 *   `tools/arena/main.js` cannot be imported by node, so anything computed
 *   there is unreachable by the suite — and the file has given up five live
 *   defects in a day, every one a decision rather than a drawing. `toX`/`toY`
 *   were the last arithmetic left in it; they are composed here instead, out of
 *   `arenaToStage` and `stageFitFor`, both of which are pinned above.
 *
 * `scale` is arena units per canvas pixel and keeps its existing meaning at
 * every call site — line widths, font sizes and the figure's own `k = size *
 * view.scale` all stay correct, because a zoomed-out arena genuinely wants
 * thinner lines and smaller names.
 */
export function stageProjectorFor(camera, fit) {
  const zoom = (camera?.zoomscale ?? 100) / 100;
  return Object.freeze({
    scale: fit.scale * zoom,
    // The horizon is only read by the shell's AUTHORED bowl, which is not drawn
    // when there is extracted art. It is reported anyway, as the arena's own
    // origin in canvas space, so a caller that mixes the two gets a horizon on
    // the sand's own top edge rather than `undefined`.
    horizon: fit.offsetY + SS2_ARENA_ORIGIN.y * fit.scale,
    toX: (x) => fit.offsetX + arenaToStage(camera, { x, y: 200, lift: 0 }).x * fit.scale,
    toY: (y, lift = 0) => fit.offsetY + arenaToStage(camera, { x: 0, y, lift }).y * fit.scale
  });
}

/**
 * WHICH ARENA, WHICH SKY AND WHAT WEATHER — the build's own three dressing
 * choices, and their defaults.
 *
 * ► **THE GAME HAS SIX ARENAS AND THIS REPOSITORY HAD ONE.** `sand` and `crowd`
 *   are both `gotoAndStop(current_arena)` (`+0x0d0f`, `+0x0c99`) over six
 *   frames, and the same index dresses both — so a choice of arena changes the
 *   ground and the stands together and they cannot disagree. Taking frame 1 of
 *   each, as the first version of the extractor did, shipped one sixth of what
 *   was measured and called it "the arena".
 *
 * ► **AND THE SKY IS A CLOCK RUNNING 1..200, NOT A DIE ROLL.**
 *   `_root.sky.gotoAndStop(time_of_day)`; `_global.time_of_day = 1 +
 *   random(23)` is only where it STARTS. `day_night_cycle` runs on a 1500ms
 *   `setInterval` and, while a battle is on, increments it toward 200 and
 *   re-seeks the sky every tick — so **the sky moves while you fight**, and a
 *   new day resets it to 25. All 200 frames are reachable.
 *
 *   **This one nearly cost the night sky.** Reading the bound as 1..23 made
 *   every masked frame (112..200) look unreachable, and "the masks are not a
 *   defect" was one sentence from being written down. They are the night, and
 *   they carry the moon's glow.
 *
 * Defaults are arena 1, hour 1 and dry. **Dry is frame 1 of `rain`, which draws
 * nothing** — the clip's first nine frames are empty, so the resting state is a
 * clear sky rather than a missing layer.
 */
export const SS2_ARENA_DRESSING = Object.freeze({ arena: 1, timeOfDay: 1, weather: 1 });

/** Which frame of a layer's clip this dressing selects. */
export function frameForLayer(layer, dressing = SS2_ARENA_DRESSING) {
  if (!layer?.frameFrom) return 1;
  const wanted = dressing?.[layer.frameFrom];
  return Number.isFinite(wanted) && wanted >= 1 ? Math.trunc(wanted) : 1;
}

/**
 * WHERE A LAYER GOES ON THE STAGE, which is the whole of the `space` field
 * cashed out.
 *
 * A `stage` layer is placed on the root and its own coordinates ARE stage
 * coordinates. An `arena` layer is placed inside the arena clip, so its
 * coordinates are arena-local and the clip's origin is added — and because the
 * arena clip itself is placed UNSCALED, nothing else has to happen.
 *
 * ► **AND THE CAMERA TOUCHES EXACTLY ONE OF THEM.** `combatscale` scales
 *   `gladiators`, which is neither of these — it is the runtime-built child
 *   that holds the rocks and the fighters. The only piece of scenery it moves
 *   is the crowd's `_y`. So a pan or a zoom leaves the sand, the sky, the
 *   backdrop, the rain, the panel and the border exactly where they are.
 */
export function layerPlacementFor(layer, camera) {
  if (layer.space !== "arena") {
    return { x: layer.x, y: layer.y, scale: layer.scale };
  }
  const y = layer.cameraY && Number.isFinite(camera?.crowdY) ? camera.crowdY : layer.y;
  return { x: SS2_ARENA_OFFSET.x + layer.x, y: SS2_ARENA_OFFSET.y + y, scale: layer.scale };
}

/**
 * The layers a surface can actually draw, each with its ops resolved and its
 * stage placement worked out for this camera.
 *
 * Total rather than throwing, for the reason every reader in `props.js` is: a
 * clone with no extraction, or a partial one, must leave a playable arena. An
 * empty list is the honest answer and the caller falls back to its own art.
 *
 * `propOpsFor` is injected rather than imported so this module stays a pure
 * description of the arena and the pack format lives in exactly one file.
 */
export function arenaScreenLayersFor(pack, propOpsFor, camera = null, dressing = {}) {
  if (!pack || typeof propOpsFor !== "function") return Object.freeze([]);
  const chosen = { ...SS2_ARENA_DRESSING, ...dressing };
  const out = [];
  for (const layer of SS2_ARENA_SCREEN_LAYERS) {
    let ops = null;
    try {
      ops = propOpsFor(pack, { linkage: layer.prop, frame: frameForLayer(layer, chosen) });
    } catch {
      // A pack that throws on one linkage must not take the others with it.
      ops = null;
    }
    if (!ops || ops.length === 0) continue;
    out.push(Object.freeze({
      ...layer,
      ops,
      frame: frameForLayer(layer, chosen),
      placement: Object.freeze(layerPlacementFor(layer, camera))
    }));
  }
  // Sorted rather than trusted: the declaration above is already in order, and
  // a reordering edit there must not silently become a paint-order change.
  return Object.freeze(out.sort((left, right) => left.order - right.order));
}

/**
 * The layers that paint UNDER the fighters and the ones that paint OVER them.
 *
 * ► **THE SPLIT IS THE THING A RENDERER GETS WRONG.** Painting all the scenery
 *   and then all the bodies reads as correct on a still and is wrong the moment
 *   an arrow crosses the ornamental border, or a gladiator walks over the UI
 *   bar. The build's own depths say which side of the fighters each layer is
 *   on, and `SS2_GLADIATORS_ORDER` is where they sit in that order.
 */
export function splitArenaScreen(layers) {
  const all = layers ?? [];
  return {
    behind: Object.freeze(all.filter((layer) => layer.order < SS2_GLADIATORS_ORDER)),
    inFront: Object.freeze(all.filter((layer) => layer.order > SS2_GLADIATORS_ORDER))
  };
}

/** Whether a pack holds enough of the arena screen to be worth drawing. */
export function hasArenaScreen(pack, propOpsFor) {
  return arenaScreenLayersFor(pack, propOpsFor).length > 0;
}
