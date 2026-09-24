/**
 * WHEN a running animation's blood fires — at the DRAWN pose the build calls
 * `bounceitem` on, in the run the build actually plays.
 *
 * `clip-effects.js` holds WHAT a call spawns and which of the fighter clip's
 * frames call it (`tools/extract-clip-effects.mjs`). This module is the step
 * past it, and the blood's twin of `sound-timing.js`: it turns those clip
 * frames into poses of the animation the figure is DRAWN from, and says which
 * of them the drawn pose has reached.
 *
 * ## The rule
 *
 * ```text
 *   drawn     = animationFor(pack, {family, label, facing})   the PAINTER's own call
 *   run       = drawn.playsSequence ?? [drawn]                 hurt8 -> [hurt8, hurt9]
 *   poseIndex = sum(poses of the run's earlier members) + (clipFrame - member.firstFrame)
 *   poseCount = the drawn animation's own pose count
 *   fires     when poseIndexAt(poseCount, at) >= poseIndex
 * ```
 *
 * ► **THE DRAWN ANIMATION, NOT THE ENGINE'S LABEL, AND NOT THE CLIP THAT CARRIES
 *   THE LABEL'S NAME.** ~~`effectsForAnimation(clipEffects,
 *   figurePack.animations[entry.timeline.label])`~~ in the shell until
 *   2026-09-24, which went wrong two ways:
 *
 *   - **a continuation's own blood never fired.** `hurt8` is drawn as the
 *     34-pose run `hurt8` -> `hurt9`; its un-joined 16 poses end at clip frame
 *     1265, so `hurt9`'s two calls (1266, 1277) were outside it. And an entry
 *     clip's call past its first pose would have been timed against the entry's
 *     own count rather than the run's — `p / 16` of the schedule for a pose the
 *     drawing shows at `p / 34`. No entry clip of a run carries such a call in
 *     the shipped build (hurt8's is on its pose 0), so that half never showed.
 *   - **no death ever bled.** A death's timeline carries the engine's variant
 *     (`slain`, `yield`, `arrow`, `grievous`, `taunt`), which is not a clip
 *     label; the drawing resolves it to `death1` or `deathtaunt`
 *     (`clip-labels.js`), and `death1` calls `bounceitem` on its first frame.
 *     `animations["slain"]` is undefined, so the shell found no blood at all.
 *
 *   Resolving through `animationFor` with the painter's own family, label and
 *   facing makes both impossible: the blood is the drawn clip's, pose for pose.
 *
 * ► **A MEMBER THAT REPEATS THROWS AGAIN.** `burning` plays `flame_repeat`
 *   twice, so a call inside it is two calls, one per pass — which is why the
 *   run is walked member by member rather than by one clip-frame window.
 */

import { effectsForAnimation } from "./clip-effects.js";
import { animationFor, poseIndexAt } from "./extracted-figure.js";

const NO_BLOOD = Object.freeze({ label: null, poseCount: 1, effects: Object.freeze([]) });

/**
 * EVERY `bounceitem` call one timeline's DRAWN animation makes, each at the
 * pose of that animation it is made on.
 *
 * Returns `{label, poseCount, effects}`, where each effect is
 * `{poseIndex, clipFrame, prop, count}` and `effects` is in pose order.
 * Total: no table, no pack, or nothing drawable is a plan with no effects —
 * a bout without blood, never a broken one.
 */
export function bloodPlanFor(table, pack, { family, label = null, facing = "right" } = {}) {
  if (!table) return NO_BLOOD;
  const drawn = animationFor(pack, { family, label, facing });
  if (!drawn) return NO_BLOOD;
  const { animation } = drawn;
  const members = Array.isArray(animation.playsSequence)
    ? animation.playsSequence.map((member) => pack.animations[member])
    : [animation];
  const poseCount = animation.poses.length;
  const effects = [];
  let base = 0;
  for (const member of members) {
    for (const effect of effectsForAnimation(table, member)) {
      effects.push(Object.freeze({
        poseIndex: base + effect.poseIndex,
        clipFrame: member.firstFrame + effect.poseIndex,
        prop: effect.prop,
        count: effect.count
      }));
    }
    base += member.poses.length;
  }
  return Object.freeze({
    label: drawn.label,
    poseCount,
    effects: Object.freeze(effects)
  });
}

/**
 * The seed ONE call's spray is drawn with (`spawnDrops`): the entry's own seed,
 * told apart per call.
 *
 * ► **THE BUILD DRAWS FRESH RANDOM NUMBERS ON EVERY CALL, so no two of its
 *   sprays are alike.** This engine may not take a sample (`dropRandom` says
 *   why), and seeding every call of an entry with the entry's action token made
 *   a `hurt8` run's three calls one spray three times — and a killing blow's
 *   hurt and the death queued behind it, which carry ONE token (`cursor.js`),
 *   one spray twice. So the call's own clip frame and pose go in beside it.
 *
 * Distinct for every (entry seed, clip frame, pose) with a clip frame below
 * 4096 and a pose below 128 — the fighter clip ends at 2222 and its longest
 * clip, `death6`, is 71 poses. Past either bound two calls may merely spray
 * alike. Deterministic, so a replay of a bout draws the same drops.
 */
export function bloodSeedFor(entrySeed, effect) {
  const base = Number.isFinite(entrySeed) ? Math.trunc(entrySeed) : 0;
  const clipFrame = Number.isInteger(effect?.clipFrame) ? effect.clipFrame : 0;
  const poseIndex = Number.isInteger(effect?.poseIndex) ? effect.poseIndex : 0;
  return (base * 4096 + clipFrame) * 128 + poseIndex;
}

/**
 * The calls that fire NOW, given how far through its schedule the timeline is.
 *
 * `at` is the SAME progress the figure is posed with this draw, and the drawn
 * pose is `poseIndexAt(poseCount, at)` — the painter's own arithmetic — so a
 * spray starts on the frame the figure is showing, not a frame computed beside
 * it. `fired` is how many of the plan's calls are already handled: the shell's
 * one piece of state per timeline, because calls fire in pose order and a draw
 * loop only moves forward. Two calls on one frame are two calls.
 *
 * `at` below zero is a clip that has not begun — a victim waiting for its
 * impact — and nothing is due.
 *
 * ► **NO STALENESS CUT, UNLIKE THE SOUNDS.** A sound heard late is noise; a
 *   spray that starts late is still a spray, and it falls from where the figure
 *   is drawn. This is what the shell did before the plan existed.
 *
 * @returns {{due: object[], fired: number}}
 */
export function dueBloodEffects(plan, { at, fired = 0 } = {}) {
  const effects = Array.isArray(plan?.effects) ? plan.effects : [];
  const start = Number.isInteger(fired) && fired > 0 ? Math.min(fired, effects.length) : 0;
  if (start >= effects.length || !Number.isFinite(at) || at < 0) return { due: [], fired: start };
  const drawn = poseIndexAt(plan.poseCount, at);
  const due = [];
  let next = start;
  while (next < effects.length && effects[next].poseIndex <= drawn) {
    due.push(effects[next]);
    next += 1;
  }
  return { due, fired: next };
}
