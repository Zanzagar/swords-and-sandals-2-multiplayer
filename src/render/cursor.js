/**
 * "Which action animations have finished, and which has this surface given up
 * on?" — the decision, separated from the clock that asks it.
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

import { abandonReasonFor } from "./timeline.js";

export class CursorError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
  }
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
