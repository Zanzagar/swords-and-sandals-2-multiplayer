/**
 * WHAT A GLADIATOR HOLDS WHEN NOTHING IS PLAYING.
 *
 * Every other module in this directory answers "what does this ACTION look
 * like". This one answers the question between actions, and until 2026-09-16
 * nobody had asked it: the browser shell hard-coded `timelineFor("Standing")`
 * at its draw site, which is both the right answer for almost every gladiator
 * and a decision living where the suite cannot reach it — the failure
 * `sound.js`'s header names ("a number only the shell can see is a number the
 * suite cannot reach").
 *
 * ## The build's own answer
 *
 * `changeCombatants` — overlay frame 52, `DoAction@0x240c7f`, the anonymous
 * function at `+0x27a6` — runs once per completed TURN and opens like this:
 *
 * ```text
 *   attacker.gotoAndPlay("Standing")                             +0x27db
 *   defender.gotoAndPlay("Standing")                             +0x27ef
 *   if (game_attacker.psyche_up == 2)
 *       attacker.gotoAndStop("psyche_charging")                  +0x281e
 *   if (game_attacker.psyche_up == 3)
 *       attacker.gotoAndStop("psyche_charging2")                 +0x284d
 *   if (game_defender.psyche_up == 2)
 *       defender.gotoAndStop("psyche_charging")                  +0x287c
 *   if (game_defender.psyche_up == 3)
 *       defender.gotoAndStop("psyche_charging2")                 +0x28ab
 * ```
 *
 * So the resting pose is `Standing` **unless** the gladiator is holding a
 * psych-up charge, and then it is one HELD FRAME of the matching charging clip.
 * The counter values line up with what `psyche_up` already does here: the
 * counter reads 2 after one press and 3 after two, and at 3 the next press
 * discharges. **The stance is the visible form of the resource** — and with the
 * extracted pack it is visibly so, because both charging clips carry the cyan
 * glow effect group, so a charged gladiator stands there glowing.
 *
 * ## Why it is not a clip-goto command
 *
 * A stance is not a performance. Nothing dispatches it as an action, no
 * acknowledgement is owed for it, and it must survive every action the
 * gladiator takes in between — so a `clip-goto` on the presentation stream
 * would be the wrong shape twice over: the stream carries no time (see
 * `timeline.js`) and its commands are consumed and finished.
 *
 * **It is derived at the draw site instead, from the projection, every frame.**
 * That makes it automatically persistent and automatically correct: the moment
 * the resolver resets the counter — `phaseTransitionEffects` on any other
 * decision, or `damagecharacter`'s defender reset when a blow lands — the next
 * frame draws `Standing` again, with nothing to invalidate and no state of its
 * own to go stale. The build re-applies the stance once a turn for exactly the
 * same reason and gets the same result more laboriously.
 *
 * ► **AND IT MOVES NO HASH, which is the reason it may read combat state at
 *   all.** This module is downstream of `toTeamWireState` and imported by
 *   nothing the resolver or `src/golden/` touches. It reads a resource; it
 *   writes nothing anywhere.
 */

import { clipLabelsFor } from "./clip-labels.js";
import { timelineFor } from "./timeline.js";

export class StanceError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/** The resource whose value the build reads to pick a stance. */
export const STANCE_RESOURCE = "psyche_up";

/**
 * COUNTER VALUE -> the label the build holds, straight off the four sites.
 *
 * A map rather than a pair of `if`s because the build's own shape is a lookup:
 * two exact equality tests against two constants, with no range and no
 * fallthrough. **1 is deliberately absent** — a gladiator at the floor is not
 * charged and stands normally — and so is anything above 3, because the counter
 * never gets there: at 3 the next press discharges and writes it back.
 */
export const STANCE_CLIPS = Object.freeze(new Map([
  [2, Object.freeze({ label: "psyche_charging", family: "stance:psyche" })],
  [3, Object.freeze({ label: "psyche_charging2", family: "stance:psyche2" })]
]));

/**
 * The build's own clip label this combatant holds between actions, or null for
 * the ordinary idle.
 *
 * ► **AN ABSENT COUNTER IS NOT A ZERO.** `psyche_up` has no entry in
 *   `SS2_RESOURCE_DEFAULTS` — deliberately, because a defaulted name moves all
 *   23 golden replay hashes — so a combatant carries the resource only when its
 *   record states one. `undefined` must therefore read as "not charged" and not
 *   as an error, or every golden's gladiator would throw on being drawn.
 */
export function stanceLabelFor(combatant) {
  const value = combatant?.resources?.[STANCE_RESOURCE]?.value;
  if (!Number.isFinite(value)) return null;
  return STANCE_CLIPS.get(value)?.label ?? null;
}

/**
 * THE WHOLE IDLE DECISION, so that a surface has none left to make.
 *
 * Returns `{ label, timeline, at }` — the schedule to draw and how far through
 * it — for a combatant with no action running. The shell used to compute this
 * inline in two lines, one of which was `timelineFor("Standing")` and the other
 * a clock; both are here now, and the branch between them is the thing worth
 * having in a module a test can call.
 *
 * ► **`now` IS AN ARGUMENT AND NOT A `Date.now()`.** The idle breathes on a
 *   clock, and a module that read the clock itself could not be tested for
 *   where in the cycle it is. The caller already has the frame's timestamp.
 *
 * ► **A STANCE HOLDS AT 0 AND THAT IS THE `gotoAndStop`.** `poseIndexAt` maps
 *   `at` 0 to pose 0, which is the first frame of `psyche_charging` — frame
 *   1618, exactly where the build's playhead stops. Running the clock over it
 *   would animate a pose the build freezes, and with the extracted pack that
 *   would play the charge's nine frames as a loop.
 *
 * @param {object} combatant one combatant out of `toTeamWireState`
 * @param {{now?: number}} options the frame's timestamp, in milliseconds
 * @returns {{label: string, timeline: object, at: number}}
 */
export function idleFrameFor(combatant, { now = 0 } = {}) {
  const stance = stanceLabelFor(combatant);
  if (stance !== null) {
    const timeline = timelineFor(stance, { role: "actor" });
    if (!timeline.recognised) {
      // Unreachable while `clip-labels.js` and `timeline.js` agree, and loud
      // rather than silent if they ever stop: an unrecognised label draws the
      // `unknown` schedule, which would put a charged gladiator into a pose
      // nothing chose while looking like an ordinary idle.
      throw new StanceError(
        `\`${stance}\` is a stance label with no timeline family, so a charged gladiator would rest in the ` +
        "`unknown` schedule. `timeline.js`'s `familyOf` and `clip-labels.js` have come apart."
      );
    }
    return Object.freeze({ label: stance, timeline, at: 0 });
  }
  const timeline = timelineFor("Standing", { role: "actor" });
  const elapsed = Number.isFinite(now) ? now : 0;
  return Object.freeze({
    label: "Standing",
    timeline,
    // The looping idle's own phase. Modulo of a non-finite `now` is NaN, which
    // `poseAt` clamps to 0 — but a surface that passed one would then breathe
    // in place forever with nothing saying why, so it is normalised here.
    at: (elapsed / timeline.durationMs) % 1
  });
}

/** Every label this module can hold, for a consumer checking coverage. */
export function allStanceLabels() {
  return [...STANCE_CLIPS.values()].map((entry) => entry.label);
}

/**
 * The families a stance draws through, so `sound.js` can keep them silent and
 * a coverage check can find them.
 *
 * A PREFIX test rather than a list, and that is the one place this module
 * generalises past the build: a second stance — the build has none, but a
 * poison or a bloodlust one is an obvious thing to want — would otherwise have
 * to be added in two places, and the one that got forgotten would be the sound.
 */
export function isStanceFamily(family) {
  return typeof family === "string" && family.startsWith("stance:");
}

/**
 * Does every stance label really resolve through its declared family?
 *
 * `animationFor` requires the label to be a MEMBER of the family it is asked
 * for — membership is the guard that stops a dying gladiator drawing the
 * attacking `taunt` — so a stance whose family does not list its own label
 * silently falls back to authored art on a machine that has the pack. That is
 * a wrong picture with no error, which is why it is checkable here and checked
 * in the suite.
 */
export function stanceFamiliesCover() {
  return [...STANCE_CLIPS.values()].every((entry) => clipLabelsFor(entry.family).includes(entry.label));
}
