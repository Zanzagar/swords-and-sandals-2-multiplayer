/**
 * WHERE A SPELL'S OWN CLIP IS DRAWN, AND FOR HOW LONG — the arithmetic, so the
 * shell only paints.
 *
 * `tools/arena/main.js` cannot be tested and says so in its own words: it gave
 * up six live defects in three days and every one was found by screenshotting.
 * So every DECISION about a spell effect is made here, under the suite, the way
 * `projectile.js`'s `projectileDrawAt` makes the arrow's.
 *
 * ## The bolt, from the build
 *
 * The bolt phase (`sprite:862[overlay]/frame:52/DoAction@0x240c7f`) attaches
 * the clip ONCE, when the cast begins, and removes it when the victim's hurt
 * clip reports back:
 *
 * ```text
 *   bolt = arena.gladiators.attachMovie("lightning_bolt_combat",
 *            "lightning_bolt_combat", getNextHighestDepth(),
 *            { _x: defender._x, _y: 50 })                          +0x852a
 *   bolt.gotoAndStop(lightning_frame)                               +0x85c2
 *   ...
 *   if (defender.struck == true) bolt.removeMovieClip()             +0x85ed
 * ```
 *
 * So three facts, each the build's:
 *
 * - **WHERE: the victim's own x, and `_y` 50** in `arena.gladiators`, the
 *   object both fighters are attached to at `_y` 200. The bolt's origin is
 *   therefore **150 arena units above the victim's** — about two thirds of the
 *   way up the build's gladiator (its 222.65-pixel clip at `physical_size`,
 *   191.5 units at strength 9). ~~"which is exactly one figure height"~~ was
 *   true only of the AUTHORED 150-unit figure the arena drew until 2026-09-23;
 *   the 150 itself was always the build's and does not move. The build is 1v1
 *   and its victim always stands at 200; above 1v1 this keeps the 150 and puts
 *   it over the victim's own rank, which is the one authored step here and is
 *   named at `liftFor`.
 * - **WHICH: the frame the resolver chose**, 1 for a lightning bolt and 2 for a
 *   frightning one (`SS2_BOLT_SPELLS[...].boltFrame`), carried on the command.
 * - **HOW LONG: until the victim's `lightning` clip ends — VERIFIED
 *   2026-09-22.** ~~half of that is an ASSUMPTION~~: the removal is gated on
 *   `defender.struck` (`+0x85db`), nothing in the bolt arm writes it `true`,
 *   and the fighter clip's own frame 2003 — the last frame of the `lightning`
 *   run (1989-2003) — does: `this.struck = true; Stop` at `@0x3a55b9`. The
 *   duration is the victim TIMELINE's, read rather than restated, so the bolt
 *   and the figure end together — see `effectLifetimeMs`.
 * - **ON A DEFEAT THE BUILD NEVER REMOVES IT, and this engine does.** `death()`
 *   deletes the phase handler before the gate can see frame 2003, so the arm's
 *   only `removeMovieClip()` never runs and the bolt stays on screen until the
 *   arena itself goes. `effectLifetimeMs` ends it with the victim's death clip
 *   instead: SHORTER than the build, and the one place this file knowingly
 *   draws less than the build draws.
 *
 * And one fact about the CLIP: its child, sprite 10, has no `Stop` and loops
 * twelve frames of flicker for as long as the bolt is up. `ageFrames` is that
 * clock, at the build's 30 fps.
 */

import { timelineFor } from "./timeline.js";

export class SpellEffectError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/** `_y` the build attaches the bolt at, in `arena.gladiators` — `+0x853b`. */
const BOLT_ATTACH_Y = 50;
/**
 * `_y` both vanilla fighters are constructed at in that same object — map,
 * "Battle entry" step 5, and `SS2_ARENA.frontY`. Restated rather than imported,
 * as `projectile.js` restates the build's launch formulas (~~"its figure
 * height"~~, which it no longer holds): this module does not import the rule
 * set.
 */
const FIGHTER_Y = 200;
/** The build's frame rate, which is the child's clock. */
const FRAMES_PER_SECOND = 30;

/**
 * The height, in arena units, a spell effect is drawn above its victim.
 *
 * ► **150, THE BUILD'S TWO LITERALS**, `_y` 50 for the bolt and 200 for the
 *   fighters, both in `arena.gladiators`. ~~"AND IT IS ONE FIGURE HEIGHT
 *   EXACTLY"~~ — of the authored figure, not the build's (see the header); the
 *   number is unaffected, and nothing here reads a figure height.
 * ► ~~**THE ONE AUTHORED STEP IN THIS FILE.**~~ **ONE OF TWO.** The build is
 *   1v1 and its victim always stands at 200. Above 1v1 a victim can stand in
 *   another rank, and this keeps the 150 over the victim's OWN depth rather
 *   than pinning the bolt to the front rank's sky, where it would strike
 *   nobody. The second (2026-09-23): `spellEffectDrawAt` and `boulderDrawAt`
 *   multiply the lift by that rank's depth scale, the scale the victim and the
 *   art are both drawn at, so the strike still ends at a back-rank victim's feet.
 */
function liftFor() {
  return FIGHTER_Y - BOLT_ATTACH_Y;
}

/**
 * Where, how big and how old a spell effect is `elapsedMs` after it was
 * attached — and whether it has been removed.
 *
 * @param {object} record   one `scene.effects` entry
 * @param {number} elapsedMs
 * @param {object} deps     `frontY`, `rankStride`, `figureScaleFor`,
 *   `rankOfDepth`, injected exactly as `projectileDrawAt` takes them
 * @returns {{x, y, lift, rotation, size, ageFrames, lifetimeMs, done}}
 */
export function spellEffectDrawAt(
  record, elapsedMs, { frontY, rankStride, figureScaleFor, rankOfDepth } = {}, { lifetimeMs: handed = null } = {}
) {
  if (typeof figureScaleFor !== "function" || typeof rankOfDepth !== "function") {
    throw new SpellEffectError(
      "spellEffectDrawAt needs figureScaleFor and rankOfDepth injected; this module does not import the painter."
    );
  }
  // A null depth draws at the front rank, for the reason `projectileDrawAt`
  // gives: a rule set with no second axis puts every gladiator there.
  const depth = Number.isFinite(record?.y) ? record.y : frontY;
  const size = figureScaleFor({
    yscale: 100,
    rank: rankOfDepth(depth, 0, { frontY, rankStride }),
    slotIndex: 0
  });
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  // ► **THE LIFETIME IS HANDED IN WHEN THE CALLER KNOWS IT**, and a painter
  //   that stamped one at intake with `effectLifetimeMs` must pass it back, so
  //   the frame that draws the bolt and the prune that removes it read ONE
  //   number. Without it, the clip the command names is the fallback.
  const lifetimeMs = Number.isFinite(handed) && handed > 0
    ? handed
    : timelineFor(record?.endsWithClip ?? null, { role: "target" }).durationMs;
  return Object.freeze({
    x: record?.x,
    y: depth,
    // ► **AT THE VICTIM'S RANK SCALE, since 2026-09-23** — the scale its art is
    //   drawn at and its victim is drawn at. ~~`liftFor()` alone~~ ended the
    //   strike above a back-rank victim's feet. The 150 is the build's; the
    //   depth scale is ours (the build has one rank), and it is the arrow's
    //   rule (`drawnLiftAt` in `projectile.js`).
    lift: liftFor() * size,
    rotation: 0,
    size,
    // Zero-based, like `arrowTrailOpsFor`'s age: a duration, not an index.
    ageFrames: Math.floor((elapsed * FRAMES_PER_SECOND) / 1000),
    lifetimeMs,
    done: elapsed >= lifetimeMs
  });
}

/* ------------------------------------------------------------------ */
/* Molten death: the boulders                                          */
/* ------------------------------------------------------------------ */

/**
 * WHERE ONE BOULDER IS `elapsedMs` AFTER THE CAST, and whether it is still
 * falling — so the shell only paints.
 *
 * The closure, `+0x882f`, runs once a frame from the frame after the attach:
 *
 * ```text
 *   if (!(this._y > 150)) this._y += this.yspeed
 *   if (this._y > 150 && this.bounced != true) { bounced = true; gotoAndStop(4); ...ingress }
 * ```
 *
 * So after `f` invocations the rock is at `_y = y0 + min(f, landingFrame) *
 * yspeed` — DISCRETE steps, as the build draws it, and no step after the one
 * that crossed the line. It therefore rests somewhere in `(150, 150 + yspeed]`,
 * not on 150.
 *
 * ► **LIFT IS `200 - _y`**, for the bolt's reason: `_y` is in
 *   `arena.gladiators`, where both vanilla fighters stand at 200, and lift is
 *   arena units above the victim's own line. Above 1v1 it is kept over the
 *   victim's own rank — the one authored step, as for the bolt.
 *
 * `fallMs` is the landing, which is what holds the action (the fireball's
 * flight rule: the rocks are work in progress until they are down).
 *
 * ► **HOW LONG THE LANDING STAYS IS HANDED IN — `landedFrames` — AND IS NEVER
 *   DECIDED HERE.** ~~A fixed 15 frames of authored rubble~~ was the first cut,
 *   and a Codex review (2026-09-23) was right that it had no evidence behind
 *   it. The caller asks `boulderLandedFramesFor(pack)` in `props.js`, which says
 *   what the pack can: 0 when there is no extracted rock to land (the rock goes
 *   as it lands), `Infinity` when frame 4 is a still drawing nothing removes,
 *   and a frame count otherwise. `landedAgeFrames` is the landing's own clock,
 *   0 on the landing frame.
 *
 * @param {object} record   one `scene.effects` entry whose `effect` is `boulder_combat`
 * @param {number} elapsedMs
 * @param {object} deps     `frontY`, `rankStride`, `figureScaleFor`, `rankOfDepth`
 * @param {object} [options]
 * @param {number} [options.landedFrames=0] frames the landing is shown for; `Infinity` for ever
 * @returns {{x, y, lift, rotation, size, stage, clipFrame, ageFrames, landedAgeFrames,
 *   fallMs, lifetimeMs, done}}
 */
export function boulderDrawAt(
  record, elapsedMs, { frontY, rankStride, figureScaleFor, rankOfDepth } = {}, { landedFrames = 0 } = {}
) {
  if (typeof figureScaleFor !== "function" || typeof rankOfDepth !== "function") {
    throw new SpellEffectError(
      "boulderDrawAt needs figureScaleFor and rankOfDepth injected; this module does not import the painter."
    );
  }
  const fall = record?.fall;
  if (!fall || !Number.isFinite(fall.y0) || !Number.isFinite(fall.ySpeed) || !Number.isFinite(fall.landingFrame)) {
    throw new SpellEffectError("boulderDrawAt needs a record carrying its fall: y0, ySpeed and landingFrame.");
  }
  const depth = Number.isFinite(record?.y) ? record.y : frontY;
  const scale = Number.isFinite(fall.scale) ? fall.scale / 100 : 1;
  const depthScale = figureScaleFor({ yscale: 100, rank: rankOfDepth(depth, 0, { frontY, rankStride }), slotIndex: 0 });
  const size = depthScale * scale;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const frame = Math.floor((elapsed * FRAMES_PER_SECOND) / 1000);
  const steps = Math.min(frame, fall.landingFrame);
  const buildY = fall.y0 + steps * fall.ySpeed;
  const landed = frame >= fall.landingFrame;
  const fallMs = (fall.landingFrame * 1000) / FRAMES_PER_SECOND;
  const shown = landedFrames === Infinity || (Number.isFinite(landedFrames) && landedFrames > 0) ? landedFrames : 0;
  const lifetimeMs = ((fall.landingFrame + shown) * 1000) / FRAMES_PER_SECOND;
  const done = elapsed >= lifetimeMs;
  return Object.freeze({
    x: record.x,
    y: depth,
    // The build's `_y`, at the victim's rank scale — the bolt's rule, above.
    // NOT times the rock's own `scale`: that sizes its art, not where it is.
    lift: (FIGHTER_Y - buildY) * depthScale,
    rotation: 0,
    size,
    stage: done ? "gone" : landed ? "landed" : "falling",
    // `Stop` on frame 1 while it falls, `gotoAndStop(4)` from the landing on.
    clipFrame: landed ? 4 : 1,
    ageFrames: frame,
    landedAgeFrames: landed ? frame - fall.landingFrame : 0,
    fallMs,
    lifetimeMs,
    done
  });
}

/**
 * THE AUTHORED ROCK'S OUTLINE, for a shell with no extracted `boulder_combat`
 * — which is every shell today (`boulderOpsFor` answers null).
 *
 * ► **AUTHORED, AND IT SAYS SO BY BEING A PLAIN POLYGON.** Nothing here is the
 *   build's drawing: sprite 33's shapes are not in any pack. The radius is a
 *   choice — 34 arena units at `_xscale` 100, so a full-size rock is nearly
 *   half a gladiator's height and the build's 50..100 draw spans half to all
 *   of that (24 was tried first and read as pebbles on the headless stage) —
 *   and the lumps are a fixed nine-point wobble turned by the
 *   boulder's own index, so ten rocks do not look stamped from one mould and
 *   the same rock looks the same on every frame.
 *
 * Points are in the prop's own space, y-DOWN like every SWF prop, around the
 * registration point.
 *
 * @param {number} index the boulder's own number, 1..N
 * @returns {Array<[number, number]>}
 */
export function boulderOutline(index) {
  const LUMPS = [1, 0.82, 0.95, 0.78, 1.04, 0.86, 0.97, 0.8, 0.92];
  const radius = 34;
  const turn = ((Number.isFinite(index) ? index : 0) * 0.7) % (2 * Math.PI);
  return LUMPS.map((lump, point) => {
    const angle = turn + (point / LUMPS.length) * 2 * Math.PI;
    return [radius * lump * Math.cos(angle), radius * lump * Math.sin(angle)];
  });
}

/**
 * How long a spell clip stays attached, given the timelines its batch started.
 *
 * ► **THE VICTIM'S LAST CLIP IN THE BATCH, READ FROM THE SAME DECISION THE SHELL
 *   MAKES — and the first cut read the wrong one, which a Codex adversarial
 *   review found on 2026-09-22.** The build removes the bolt when
 *   `defender.struck` goes true (`+0x85db`), which this engine takes to be the
 *   end of the victim's clip (see the header). On a cast the victim survives,
 *   that is its `lightning` clip. On a cast that KILLS it, the batch
 *   also carries the victim's death clip, and `timelinesForStep` keeps the last
 *   clip per combatant — `slain`, 1,200 ms against `lightning`'s 480 — so a
 *   bolt bound to `lightning` vanished 720 ms before its victim finished dying.
 *   *(Corrected 2026-09-23: `timelinesForStep` no longer keeps only the last
 *   clip — it queues the death BEHIND the reaction as `then`, so both play,
 *   and this sums the chain.)*
 *
 *   So this asks `timelinesForStep`'s own `started` map what the victim is
 *   actually playing. The bolt and the figure it strikes end together by
 *   construction rather than by two readings happening to agree.
 *
 *   *(What the BUILD does with a bolt over a dying victim is now read, and it is
 *   longer than this: `death()` deletes the phase handler, the arm's only
 *   `removeMovieClip()` (`+0x85fd`) never runs, and the bolt stays up until the
 *   arena is torn down. Binding it to the victim's death clip is a deliberate
 *   narrowing — this engine has no "until the arena goes" to bind it to.)*
 *
 * @param {object} record   one `scene.effects` entry
 * @param {Map} started     `timelinesForStep(commands).started` for the SAME batch
 */
export function effectLifetimeMs(record, started) {
  const entry = started instanceof Map ? started.get(record?.targetId) : null;
  // ► **THE WHOLE CHAIN, since 2026-09-23**: a lethal cast queues the victim's
  //   death BEHIND its reaction (`then`, see `timelinesForStep`) instead of
  //   replacing it, so "the victim's clips" are the reaction and the death in
  //   turn, and the bolt stays up across both — as it stayed up across the
  //   death alone before.
  let played = 0;
  for (let link = entry; link; link = link.then) {
    const duration = link.timeline?.durationMs;
    if (Number.isFinite(duration) && duration > 0) played += duration;
  }
  if (played > 0) return played;
  return timelineFor(record?.endsWithClip ?? null, { role: "target" }).durationMs;
}
