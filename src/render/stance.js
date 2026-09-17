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
 * function at `+0x27a6` — opens like this:
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
 * glow effect group, so a charged gladiator stands there glowing. The two
 * levels are two DIFFERENT glows, not one at two frames: outer radius 4.2742 at
 * `scale` 1 for `psyche_charging` against 2.5208 for `psyche_charging2`.
 *
 * ► **IT RUNS ABOUT FOUR TIMES A TURN, NOT ONCE — corrected by a verifier.**
 *   This header said "once per completed TURN". There are three call sites, all
 *   in the same block: `+0x317e` at TOP LEVEL of the frame script, so every
 *   time the overlay enters `heroactions`; `+0x3638` inside `nextphase`'s
 *   `battle_action < 3` arm, so on every phase advance; and `+0x365f` at the
 *   `battle_action == 3` turn end. `battle_action` is a PHASE selector, not a
 *   turn counter. Nothing here changes — more re-application only strengthens
 *   the case for deriving the pose fresh — but the sentence would mislead
 *   anyone reasoning about when the build re-reads state.
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
 * The moment the resolver resets the counter — `phaseTransitionEffects` on any
 * other decision, or `damagecharacter` when a blow lands — the next frame draws
 * `Standing` again, with nothing to invalidate and no state of its own to go
 * stale.
 *
 * ► **AND THAT APPROXIMATES THE BUILD RATHER THAN REPRODUCING IT.** This header
 *   claimed the stronger thing and a verifier broke it. **The build parks a
 *   figure on the LAST FRAME of whatever it just played and does not restore
 *   the stance when the clip ends** — 86 of the fighter clip's frame scripts
 *   end in `this.struck = true; Stop` and only 7 spans self-loop — and the pose
 *   comes back only at the next `changeCombatants`, which `nextphase` gates on
 *   `demand_move >= 60` enter-frames, about two seconds at 30 fps. This engine
 *   deletes the expired timeline at `durationMs` and draws the idle on the very
 *   next frame, so **it returns to the glowing stance sooner than the build
 *   does, by the remainder of the phase.**
 *
 *   **The same gap is much bigger than the stance**, and is the honest thing to
 *   take from it: action-end hold applies to EVERY action this engine plays,
 *   not only to charged ones, and this engine has no concept of it. The charge
 *   is merely the case where the difference is visible as a glow arriving
 *   early. Named in the handoff as its own piece of work.
 *
 * ► **AND THE BUILD HAS TWO HELD FRAMES PER CHARGE LEVEL, NOT ONE.** The
 *   `psyche_up` ACTION runs 1609-1617 straight on into `psyche_charging` and
 *   stops at **1626**, its last frame (see `clip-sequences.js`); the next
 *   `changeCombatants` then re-asserts `gotoAndStop("psyche_charging")` =
 *   **1618**, its first. So the same charged state is drawn two different ways
 *   depending on when you look, and this module draws the second. It is the one
 *   that persists, and the one a resting gladiator is in for all but the first
 *   moment after his own charge.
 *
 * ► **AND IT MOVES NO HASH, which is the reason it may read combat state at
 *   all** — but the load-bearing fact is stronger than "this module is
 *   downstream", which is what this line used to say. **All 21 files in
 *   `src/render/` import only `./` siblings: it is a zero-edge cut**, and
 *   nothing under `src/team/`, `src/golden/`, `src/adapter/` or `src/campaign/`
 *   imports anything from it. That survives arbitrary future edits here, and it
 *   would stop holding the first time ANY file in this directory adds a `../`
 *   import — which is the thing to watch, rather than this module's own
 *   imports.
 *
 * ## Two places this engine goes past the build, deliberately
 *
 * ► **BYSTANDERS GET THE STANCE.** `changeCombatants` poses `attacker` and
 *   `defender`, because the build has exactly two gladiators. This poses every
 *   combatant from its own counter, so in a 2v2 all four are posed including
 *   the pair that is neither. That is an EXTRAPOLATION, not a measurement, and
 *   it is the same generalisation the whole team seam makes.
 *
 * ► **A SPENT CHARGE STILL GLOWS, AND THAT RESTS ON AN UNSETTLED CANDIDATE.** A
 *   non-lethal discharge leaves the counter at 2, so a gladiator who has just
 *   FIRED stands in `psyche_charging`. That is faithful to the build as the map
 *   reads it — `+0x6738` writes 1 and `+0x6761` adds one a tick later — but
 *   **where the counter lands after a discharge is a STATIC CANDIDATE awaiting
 *   a `-TraceWindow phase` capture**, recorded at `test/ss2-psyche-up.test.js`.
 *   If that capture ever says 1, this stance drops to `Standing` after a
 *   discharge instead. **So the pose is a visual discriminator for an open
 *   measurement question** — which is a reason to want the capture, not a
 *   reason to hedge the code.
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
  // ► **A CORPSE HAS NO IDLE, AND THIS GUARD IS BELT-AND-BRACES.** The shell's
  //   draw loop branches on `!combatant.alive` to the death pose BEFORE it asks
  //   for an idle, so today this is unreachable — a verifier established that
  //   by feeding a hand-forged dead-and-charged combatant straight in and
  //   getting `psyche_charging` back. **One call site is not a contract.** A
  //   second caller that forgot the death branch would leave a glowing corpse
  //   braced for a blow it will never throw, which is a wrong picture with no
  //   error; and this module claims to own the WHOLE idle decision, so the
  //   dead are part of it.
  const stance = combatant?.alive === false ? null : stanceLabelFor(combatant);
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
  // The looping idle's own phase.
  //
  // ► **NON-FINITE AND NEGATIVE ARE BOTH NORMALISED, and this used to handle
  //   only the first.** A verifier measured `now = -500` giving `at = -0.347`,
  //   because `%` in JavaScript keeps the sign of the dividend — while the
  //   comment here advertised that a bad `now` was normalised. `poseAt` clamps
  //   a negative `at` to 0, so nothing drew wrongly; what was wrong was the
  //   promise. Unreachable from the shell, whose `now` is
  //   `performance.now()` — which is the reason to fix the guard rather than
  //   trust the caller, since the next caller may not be that one.
  const elapsed = Number.isFinite(now) && now > 0 ? now : 0;
  return Object.freeze({
    label: "Standing",
    timeline,
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
