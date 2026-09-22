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
 *   therefore **150 arena units above the victim's**, which is exactly one
 *   figure height. The build is 1v1 and its victim always stands at 200; above
 *   1v1 this keeps the 150 and puts it over the victim's own rank, which is
 *   the one authored step here and is named at `liftFor`.
 * - **WHICH: the frame the resolver chose**, 1 for a lightning bolt and 2 for a
 *   frightning one (`SS2_BOLT_SPELLS[...].boltFrame`), carried on the command.
 * - **HOW LONG: until the victim's clip ends — and half of that is an
 *   ASSUMPTION, named here.** The removal is gated on `defender.struck`
 *   (`+0x85db`), and nothing inside the bolt arm ever writes it `true`: the
 *   other half of the handshake is outside the arm. This engine takes it to be
 *   the end of the victim's clip, which is what `src/adapter/action-gate.js`
 *   already assumes for every phase; **which fighter-clip frame actually sets
 *   it has not been read** (it is a ranked derivation). The duration is the
 *   victim TIMELINE's, read rather than restated, so the bolt and the figure
 *   end together — see `effectLifetimeMs`.
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
 * as `projectile.js` restates its figure height: this module does not import
 * the rule set.
 */
const FIGHTER_Y = 200;
/** The build's frame rate, which is the child's clock. */
const FRAMES_PER_SECOND = 30;

/**
 * The height, in arena units, a spell effect is drawn above its victim.
 *
 * ► **150, AND IT IS ONE FIGURE HEIGHT EXACTLY.** The build's two literals,
 *   `_y` 50 for the bolt and 200 for the fighters, both in `arena.gladiators`.
 * ► **THE ONE AUTHORED STEP IN THIS FILE.** The build is 1v1 and its victim
 *   always stands at 200. Above 1v1 a victim can stand in another rank, and
 *   this keeps the 150 over the victim's OWN depth rather than pinning the bolt
 *   to the front rank's sky, where it would strike nobody.
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
    lift: liftFor(),
    rotation: 0,
    size,
    // Zero-based, like `arrowTrailOpsFor`'s age: a duration, not an index.
    ageFrames: Math.floor((elapsed * FRAMES_PER_SECOND) / 1000),
    lifetimeMs,
    done: elapsed >= lifetimeMs
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
 *
 *   So this asks `timelinesForStep`'s own `started` map what the victim is
 *   actually playing. The bolt and the figure it strikes end together by
 *   construction rather than by two readings happening to agree.
 *
 *   *(What the BUILD does with a bolt over a dying victim is not settled here.
 *   `death()` ends the phase machine's work before `nextphase` can run, so the
 *   bolt may well stay up until the arena is torn down. Binding it to the
 *   victim's final animation is the longest this engine can honestly show
 *   without claiming more than the bytes have been read to say.)*
 *
 * @param {object} record   one `scene.effects` entry
 * @param {Map} started     `timelinesForStep(commands).started` for the SAME batch
 */
export function effectLifetimeMs(record, started) {
  const entry = started instanceof Map ? started.get(record?.targetId) : null;
  const played = entry?.timeline?.durationMs;
  if (Number.isFinite(played) && played > 0) return played;
  return timelineFor(record?.endsWithClip ?? null, { role: "target" }).durationMs;
}
