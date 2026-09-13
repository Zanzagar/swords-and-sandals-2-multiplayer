/**
 * "Which action animations BEGIN, which have finished, and which has this
 * surface given up on?" — the decisions, separated from the clock that asks
 * them.
 *
 * ► The first clause was added 2026-09-11, with movement. Starting a timeline
 *   used to be four obvious lines in the shell, and then it stopped being
 *   obvious: a travelling gait has to be paired with the `move-clip` from its
 *   OWN step, and getting that pairing wrong is invisible on a screenshot.
 *   Same lesson as the paragraph below, applied before it cost anything this
 *   time rather than after.
 *
 * WHY IT IS NOT IN THE SHELL. It was, for exactly one screenshot. The browser
 * arena's first spectated bout submitted ONE action and then froze on "waiting
 * for the arena" forever, and the reason it was hard to diagnose is that the
 * logic lived in a `requestAnimationFrame` callback where the suite could not
 * reach it. So the decision moved here, where a test can drive it with a fake
 * clock and prove a whole bout completes, and the shell kept only the clock.
 *
 * THE RULE IT ENCODES, which is the part that was wrong:
 *
 * - a token is finished when EVERY timeline started under it has run its
 *   scheduled duration. A token with no timelines at all is finished
 *   immediately — **an action can bind commands that start no clip**, and the
 *   first version treated "no timeline" as "still running" by omission, so such
 *   a token could never be reported and the gate never reopened;
 * - a token is abandoned when the longest-overdue timeline under it is past the
 *   surface's own grace period (`abandonReasonFor`). That is a HOST POLICY
 *   decision — part 4 of the acknowledgement seam — and `src/adapter/action-gate.js`
 *   deliberately refuses to make it.
 *
 * Pure: it holds no clock, no battle and no host. It is told the time.
 */

import { abandonReasonFor, timelineFor } from "./timeline.js";

export class CursorError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * Which timelines one drained batch of presentation commands starts.
 *
 * Pure, and it holds no clock: the caller stamps `startedAt` when it actually
 * begins playing them, because a frame that arrives late must not make a
 * timeline look overdue before it has drawn once.
 *
 * TWO PAIRINGS IT MAKES, both of which are wrong-able in silence:
 *
 * - **a travelling gait is paired with the `move-clip` from its OWN batch**,
 *   never with the scene's latest `motion`. The scene keeps the last step an
 *   actor took; reading it here would let a later step retarget a gait that is
 *   still in flight, and the figure would slide to a destination its own
 *   animation was never about;
 * - **only a travelling schedule gets a motion at all.** A figure that both
 *   moved and was hurt in one batch plays `hurt3` — which does not travel — so
 *   pairing by combatant alone would drag it across the arena on a flinch.
 *
 * `notices` names what a surface should say out loud rather than swallow: an
 * unrecognised label, and a travelling gait with no step to travel along.
 *
 * @param {Iterable<object>} commands one drained batch
 * @returns {{started: Map<string, {timeline: object, token: number|null, motion: object|null}>,
 *   notices: Array<{combatantId: string, label: string, reason: string}>}}
 */
export function timelinesForStep(commands) {
  if (!commands || typeof commands[Symbol.iterator] !== "function") {
    throw new CursorError("timelinesForStep needs an iterable of presentation commands.");
  }
  const batch = [...commands];
  const stepped = new Map();
  const depthStepped = new Map();
  for (const command of batch) {
    if (command.kind === "move-clip") stepped.set(command.combatantId, { from: command.from, to: command.to });
    // ► **THE SECOND AXIS NEEDS ITS OWN SLOT, and the first version of the
    //   lane-change tween failed because it did not have one.** The obvious
    //   fix — "start a timeline from the depth move" — yields an entry whose
    //   `motion` is null, so the figure still teleports AND the travel notice
    //   below fires a false complaint about a missing `move-clip`.
    if (command.kind === "move-clip-depth") {
      depthStepped.set(command.combatantId, { from: command.fromY, to: command.toY });
    }
  }

  const started = new Map();
  const notices = [];

  // ► **A LANE CHANGE STARTS ITS OWN TIMELINE, because nothing else will.**
  //   The cursor starts timelines from `clip-goto`, and a rank change emits
  //   none on purpose: the build has no sidestep phase, so the binding table
  //   answers "nothing plays" rather than naming a clip
  //   (`presentation.js`, the depth case). That is the right answer for a
  //   CLIP and the wrong one for MOTION — the figure still has to get there.
  //
  //   So the authored `movement:sidestep` schedule is started here, from the
  //   command itself, and it carries no `token`: a lane change is not gated on
  //   an animation the surface has to report back, because there is no
  //   animation to report.
  for (const [combatantId, depthMotion] of depthStepped) {
    started.set(combatantId, {
      timeline: timelineFor("sidestep", { role: "actor" }),
      token: null,
      motion: null,
      depthMotion
    });
  }

  for (const command of batch) {
    if (command.kind !== "clip-goto") continue;
    const timeline = timelineFor(command.label, { role: command.role });
    const motion = timeline.travel ? (stepped.get(command.combatantId) ?? null) : null;
    started.set(command.combatantId, {
      timeline,
      token: command.actionToken ?? null,
      motion,
      // A clip-goto never carries depth motion, but the entry shape is one
      // shape: a consumer must not have to ask which kind of entry it has.
      depthMotion: depthStepped.get(command.combatantId) ?? null
    });
    if (!timeline.recognised) {
      notices.push({
        combatantId: command.combatantId,
        label: command.label,
        reason: `no timeline for "${command.label}" (${command.labelProvenance}) — playing a fallback`
      });
    }
    if (timeline.travel && motion === null) {
      notices.push({
        combatantId: command.combatantId,
        label: command.label,
        reason: `"${command.label}" is a travelling gait with no move-clip — the figure will step in place`
      });
    }
  }
  return Object.freeze({ started, notices: Object.freeze(notices) });
}

/**
 * @param {Array<number>} pendingTokens tokens the gate is waiting on, in order
 * @param {Map<string, {timeline: object, startedAt: number, token: number|null}>} playing
 *   the timelines currently running, keyed by combatant id
 * @param {number} now the surface's clock
 * @returns {{finished: number[], expired: string[], abandon: {token: number, reason: string}|null}}
 *   `expired` names the combatants whose timelines have run out, so the caller
 *   can stop posing them; `abandon` is at most one token, because giving up is
 *   a decision and doing several at once hides which one ran out.
 */
export function animationCursor(pendingTokens, playing, now) {
  if (!Array.isArray(pendingTokens)) {
    throw new CursorError("animationCursor needs the pending token list.");
  }
  if (!playing || typeof playing.entries !== "function") {
    throw new CursorError("animationCursor needs the map of running timelines.");
  }
  if (!Number.isFinite(now)) {
    throw new CursorError("animationCursor needs the current time in milliseconds.");
  }

  const running = new Set();
  const expired = [];
  let abandon = null;
  let worstOverrun = -Infinity;

  for (const [combatantId, entry] of playing.entries()) {
    const elapsed = now - entry.startedAt;
    if (elapsed < entry.timeline.durationMs) {
      if (entry.token !== null && entry.token !== undefined) running.add(entry.token);
      continue;
    }
    expired.push(combatantId);
    const reason = abandonReasonFor(entry.timeline, elapsed);
    // A timeline can only be "overdue" if the surface never reported it, which
    // for this surface means the clock outran the grace period. Keep the worst.
    if (reason && entry.token !== null && entry.token !== undefined) {
      const overrun = elapsed - entry.timeline.durationMs;
      if (overrun > worstOverrun) {
        worstOverrun = overrun;
        abandon = { token: entry.token, reason };
      }
    }
  }

  // The correction: a token nothing is still running is FINISHED, including a
  // token that never had a timeline at all.
  const finished = pendingTokens.filter((token) => !running.has(token));
  return Object.freeze({
    finished: Object.freeze(finished),
    expired: Object.freeze(expired),
    abandon: abandon ? Object.freeze(abandon) : null
  });
}
