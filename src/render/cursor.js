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
import {
  fireballFlight, flightDurationMs, projectileFlight, ProjectileKind, PROJECTILE_FRAME_MS
} from "./projectile.js";

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
    if (command.kind === "move-clip") {
      stepped.set(command.combatantId, {
        from: command.from,
        to: command.to,
        ...(command.pushed === true ? { pushed: true } : {}),
        ...(command.teleported === true ? { teleported: true } : {}),
        ...(Number.isFinite(command.blink) ? { blink: command.blink } : {})
      });
    }
    // ► **THE SECOND AXIS NEEDS ITS OWN SLOT, and the first version of the
    //   lane-change tween failed because it did not have one.** The obvious
    //   fix — "start a timeline from the depth move" — yields an entry whose
    //   `motion` is null, so the figure still teleports AND the travel notice
    //   below fires a false complaint about a missing `move-clip`.
    if (command.kind === "move-clip-depth") {
      depthStepped.set(command.combatantId, {
        depthMotion: { from: command.fromY, to: command.toY },
        actionToken: command.actionToken ?? null
      });
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
  //   command itself.
  //
  // ► **IT CARRIES ITS ACTION'S TOKEN, and until 2026-09-23 it carried none.**
  //   The reasoning was "there is no animation to report" — but a token is how
  //   the GATE knows the action is still on screen, not a promise that a clip
  //   will report. Tokenless, the slide finished nothing and held nothing, so
  //   the gate reopened one frame into a 1,200 ms slide: the next blow went in
  //   17 ms later, replaced the sidestep, and the figure snapped a whole lane
  //   in one frame (`engine-vs-screen` F2, confirmed by its refuter: 9 slides
  //   cut in 16 default bouts). The command's own `actionToken` is the one
  //   every other timeline of the action carries.
  //
  // ► **AND IT CARRIES THE BATCH'S x STEP**, so joining an occupied lane slides
  //   sideways on the same 1,200 ms as the depth change instead of jumping to
  //   the destination x on the first frame (`engine-vs-screen` F5).
  for (const [combatantId, { depthMotion, actionToken }] of depthStepped) {
    started.set(combatantId, {
      timeline: timelineFor("sidestep", { role: "actor" }),
      token: actionToken,
      motion: stepped.get(combatantId) ?? null,
      depthMotion
    });
  }

  for (const command of batch) {
    if (command.kind !== "clip-goto") continue;
    const timeline = timelineFor(command.label, { role: command.role });
    // ► **A DEATH QUEUES BEHIND WHAT ITS BATCH STARTED** (added 2026-09-23).
    //   Until then the last clip-goto won, so a lethal blow or spell dropped its
    //   victim's reaction — hurt, burning, lightning, taunted, knockback — and
    //   only the death played (`engine-vs-screen` F4, measured on every lethal
    //   action of every kit). The death is the reaction's `then`, under the
    //   same action token, so the gate stays shut across both and
    //   `animationCursor` hands the painter the death when the reaction ends.
    //
    //   **AUTHORED, and named:** for a single-hit kill the build dispatches the
    //   reaction and the death within one frame (`defender_hurt` calls
    //   `damagecharacter` at `+0x211e`, then `gotoAndPlay(animstate)` at
    //   `+0x2120`), so this shows a reaction the build does not hold on screen.
    //   It is here so a kill reads as a blow landing and then a fall. No number
    //   and no hash moves.
    //
    //   Behind a lane change's sidestep too: a figure that steps back a rank
    //   and is defeated in the same action (the crowd ending a bout) slid and
    //   then died, where the death used to replace the slide and jump it a
    //   lane in one frame. Everything in `started` was started by THIS batch.
    //
    //   Only a death queues; any other second clip for the same figure still
    //   replaces the first, exactly as before.
    if (command.role === "defeated" && started.has(command.combatantId)) {
      let tail = started.get(command.combatantId);
      while (tail.then) tail = tail.then;
      tail.then = { timeline, token: command.actionToken ?? null, motion: null, depthMotion: null };
      if (!timeline.recognised) {
        notices.push({
          combatantId: command.combatantId,
          label: command.label,
          reason: `no timeline for "${command.label}" (${command.labelProvenance}) — playing a fallback`
        });
      }
      continue;
    }
    // ► **A PUSH IS PAIRED WITH WHATEVER THE VICTIM PLAYS**, where a walk is
    //   paired only with a travelling gait. The rule below exists so a figure
    //   that moved AND flinched in one batch is not dragged across the arena on
    //   `hurt3` — and a pushed victim's move is not its own gait at all, it is
    //   `knockback(defender, force)` tweening `_x` while the victim plays its
    //   knockback clip. Added 2026-09-22 with `displacementOf` in
    //   `presentation.js`.
    const step = stepped.get(command.combatantId) ?? null;
    // ► **AND A TELEPORT IS PAIRED WITH THE CASTER'S OWN CLIP**, which does not
    //   travel either (added 2026-09-22 with `cast_teleport`). Paired so the
    //   figure can be HELD at `from` while `Cast2` plays: left unpaired, the
    //   painter draws the scene's resting x — already the destination — and
    //   the caster blinks away before it has cast. See `figureXAt`.
    // ► **AND A BLINK IS PAIRED WITH THE CASTER'S SWING** (added 2026-09-23
    //   with the ghost strike's): the figure stands beside its victim for the
    //   whole of `attack9`-`attack12`, which does not travel either.
    const motion = timeline.travel || step?.pushed === true || step?.teleported === true || Number.isFinite(step?.blink)
      ? step
      : null;
    started.set(command.combatantId, {
      timeline,
      token: command.actionToken ?? null,
      motion,
      // A clip-goto never carries depth motion, but the entry shape is one
      // shape: a consumer must not have to ask which kind of entry it has.
      depthMotion: depthStepped.get(command.combatantId)?.depthMotion ?? null
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
 * @param {object} [options]
 * @param {Iterable<{token: number|null, startedAt: number, durationMs: number}>}
 *   [options.projectiles] arrows still in the air
 * @returns {{finished: number[], expired: string[],
 *   advanced: Array<{combatantId: string, entry: object}>, abandon: {token: number, reason: string}|null}}
 *   `expired` names the combatants whose timelines have run out, so the caller
 *   can stop posing them; `advanced` hands over the queued link (`then`) a
 *   combatant is now playing, with its own `startedAt`, to replace its entry
 *   — a caller that ignores it keeps the finished link on its last pose until
 *   the chain ends, and is never stalled; `abandon` is at most one token,
 *   because giving up is a decision and doing several at once hides which one
 *   ran out.
 */
export function animationCursor(pendingTokens, playing, now, { projectiles = [] } = {}) {
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
  const advanced = [];
  let abandon = null;
  let worstOverrun = -Infinity;

  for (const [combatantId, queued] of playing.entries()) {
    // ► **A QUEUED `then` PLAYS WHEN ITS PREDECESSOR ENDS** (added 2026-09-23
    //   with the death queued behind a lethal blow's reaction; see
    //   `timelinesForStep`). Walked here rather than when the frame noticed, so
    //   a late frame lands in the right link and each link starts exactly where
    //   the last one ended. The caller is handed the link now playing in
    //   `advanced`, to pose and to sound, and the chain is only EXPIRED — and
    //   its token only finished — when its last link has played.
    let entry = queued;
    let startedAt = queued.startedAt;
    while (entry.then && now - startedAt >= entry.timeline.durationMs) {
      startedAt += entry.timeline.durationMs;
      entry = entry.then;
    }
    if (entry !== queued) advanced.push(Object.freeze({ combatantId, entry: { ...entry, startedAt } }));
    const elapsed = now - startedAt;
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

  // ► **AN ARROW IN THE AIR IS WORK IN PROGRESS, AND THAT IS THE BUILD'S OWN
  //   RULE (added 2026-09-13).** Vanilla will not complete a ranged phase while
  //   the bullet is still flying: `bullet_in_air != true` sits on the
  //   phase-completion guard (`+0x3829`) beside ~~`attacker.struck` and~~
  //   `grounded` **— and `attacker.struck` is NOT on it** *(corrected
  //   2026-09-22 by a write-nothing verifier sweeping every `"struck"`
  //   reference in `DoAction@0x240c7f`: the lowest is `+0x3871`, a WRITE,
  //   `attacker.struck = null`, so nothing in the block reads `struck` before
  //   `+0x3829`. The `bullet_in_air` and `grounded` terms are NOT re-verified
  //   by that correction — its dumps start at `+0x3842`)*. So a long bombard
  //   takes a long turn there, and this gate is given the same fact.
  //
  //   **Deliberately NOT folded into `playing`**, which is keyed by combatant
  //   and is what the painter poses: an arrow is nobody's figure, exactly as
  //   `scene.projectiles` is nobody's actor. It is also NOT subject to the
  //   abandon grace above — a projectile's duration is arithmetic this engine
  //   computed rather than a timeline a surface has to report back, so it
  //   cannot fail to arrive and there is nothing to give up on.
  for (const shot of projectiles) {
    if (!shot || shot.token === null || shot.token === undefined) continue;
    if (now - shot.startedAt < shot.durationMs) running.add(shot.token);
  }

  // The correction: a token nothing is still running is FINISHED, including a
  // token that never had a timeline at all.
  const finished = pendingTokens.filter((token) => !running.has(token));
  return Object.freeze({
    finished: Object.freeze(finished),
    expired: Object.freeze(expired),
    advanced: Object.freeze(advanced),
    abandon: abandon ? Object.freeze(abandon) : null
  });
}

/**
 * HOW LONG EACH COMBATANT'S REACTION WAITS, for one drained batch — the
 * victim of a fireball or an ARROW reacts when it LANDS, not when it is loosed.
 *
 * ► **ADDED 2026-09-22 WITH THE FIREBALLS, ~~AND THE ARROW HAS NO EQUIVALENT~~
 *   — THE ARROW HAS IT SINCE 2026-09-23 (below).**
 *   A batch starts every timeline at once: `timelinesForStep` pairs clips with
 *   motions and names no start time, and the shell stamps one clock on all of
 *   them. That is right for a bolt, whose ingress runs in the cast's own
 *   straight-line run (`+0x85af`), and wrong for a fireball, whose ingress runs
 *   on the frame the bullet is first past the victim (`+0x91c1`) — up to 84
 *   frames, 2.8 s, later. So the victim's clip was a flinch at an explosion
 *   that had not happened yet.
 *
 *   **Kept OUT of `timelinesForStep`**, as a second question about the same
 *   batch, so that function's pairing rules and every test pinning its entry
 *   shape are untouched. A surface starts each entry `delay` ms after its batch
 *   clock and treats it as absent until then; `animationCursor` already counts
 *   an entry whose `startedAt` is still ahead of `now` as running, so the gate
 *   stays shut from the cast to the end of the reaction with no gap.
 *
 *   ~~**The arrow is deliberately NOT given this.** Its `checkattackroll` is also
 *   called from the impact test (`+0x6d29`), so the same argument applies, but
 *   adopting it would change a shipped presentation that nothing asked to
 *   change. It is one line here when somebody does.~~
 *
 * ► **ADOPTED 2026-09-23 (main session's decision), because the fight pop-ups
 *   made the early reaction VISIBLE**: a number and a flinch, or BLOCK, over a
 *   victim the arrow had not reached. The claim was re-derived from the
 *   overlay frame-52 disassembly (body 0x240c85) before this was written. The
 *   ranged arm's `attacker.struck == null` guard (`+0x6bf0`) jumps to
 *   `+0x6c97` on every tick after the first, and the first tick falls through
 *   to it, so the impact test runs EVERY tick of the phase:
 *   `bullet._y > 160 || (bullet._x > defender._x && attacker.gladiator_dir ==
 *   "right") || (bullet._x < defender._x && gladiator_dir == "left")`
 *   (`+0x6c97`..`+0x6d24`). Only when it holds does `checkattackroll()` run
 *   (`+0x6d29`) — then `bullet_in_air = false` (`+0x6d39`) and the bullet is
 *   removed (`+0x6d41`). The bullet itself is attached later in the same arm,
 *   when the shooter's clip sets `fired` (`+0x6d59`..`+0x6dbe`). So the hit
 *   roll, `defender_hurt`/`defender_blocked`, the victim's clip and its pop-up
 *   all happen on the frame the arrow ARRIVES, hit and miss alike.
 *   **The delay is the DRAWN flight's**: `projectileFlight` from the command's
 *   own `from`, `to`, `sequence` and `targetSize` — the same four inputs
 *   `tools/arena/main.js` flies the arrow with (its yscales and bodies shape
 *   the arc, never `flightFrames`) — so the victim reacts on the frame the
 *   drawn arrow reaches the drawn body (`stopShortFor`). The build's own test
 *   fires as the bullet passes the defender's CENTRE, `targetSize` further on:
 *   a few frames the drawing does not show, named rather than reproduced.
 *
 * ► **EVERY clip the batch starts for the victim waits, the death included**:
 *   on a killing fireball or arrow the victim's last clip is its death, and it
 *   dies at impact too.
 *
 * ► **AND A MOLTEN DEATH'S VICTIM WAITS FOR THE ROCKS — added 2026-09-23.**
 *   Its ingress runs inside each boulder's own `onEnterFrame` on the frame
 *   that boulder lands (`+0x88e5`), so until then nothing has happened to the
 *   victim. Before 2026-09-23 the death began at the cast, beside the caster's
 *   `Cast2`, with not one rock in the sky.
 *   - **When the batch starts a REACTION for the victim — `burning`, which
 *     every shower does — the victim waits for the FIRST landing**, where the
 *     build's burn starts; on a kill its death is queued behind that reaction
 *     (`timelinesForStep`'s `then`) and follows it.
 *   - **When its only clip is a death, it waits for the landing of the rock
 *     that killed it** — the one `presentation.js` marks `lethal`.
 *   ~~The victim waits for the killing rock and, when none killed, for the
 *   first~~ — **the first cut, written while a kill's last clip REPLACED the
 *   reaction.** Once the death was queued behind it (2026-09-23), delaying the
 *   whole chain to the killing rock started the BURN late, at the kill.
 *   ► **ONE DELAY, AND THE BUILD HAS MORE.** Every landing restarts the burn
 *     (`gotoAndPlay("burning")` per ingress), so a survivor burns from the
 *     first landing to its last plus one cycle; this starts the one timeline
 *     at the first landing and does not restart it.
 *
 * @param {Iterable<object>} commands one drained batch
 * @returns {Map<string, number>} combatant id -> delay in ms; absent means 0
 */
export function reactionDelaysFor(commands) {
  if (!commands || typeof commands[Symbol.iterator] !== "function") {
    throw new CursorError("reactionDelaysFor needs an iterable of presentation commands.");
  }
  const delays = new Map();
  // Per victim: the first landing frame, and the lethal one if any rock killed.
  const showers = new Map();
  // Who the batch starts a REACTION for — a `target` clip — as opposed to only
  // a death. See the header: the chain waits for whatever its first link is.
  const reacting = new Set();
  for (const command of commands) {
    if (command?.kind === "clip-goto" && command.role === "target") reacting.add(command.combatantId);
    if (command?.kind === "attach-effect" && command.effect === "boulder_combat") {
      const frame = command.fall?.landingFrame;
      // Total, like the fireball below: a rock with no landing delays nothing.
      if (!Number.isFinite(frame) || frame < 0 || command.targetId == null) continue;
      const shower = showers.get(command.targetId) ?? { first: Infinity, lethal: null };
      shower.first = Math.min(shower.first, frame);
      if (command.lethal === true) shower.lethal = frame;
      showers.set(command.targetId, shower);
      continue;
    }
    if (command?.kind !== "fire-projectile") continue;
    // ► **AN ARROW: the drawn flight's own length** (added 2026-09-23; see the
    //   header). Total like the fireball: an arrow that cannot be flown delays
    //   nothing, and its victim reacts at the loose as it did before.
    if (command.projectile === ProjectileKind.BOMBARD || command.projectile === ProjectileKind.SNIPE) {
      if (!Number.isFinite(command.from?.x) || !Number.isFinite(command.to?.x) || command.targetId == null) continue;
      const arrow = projectileFlight({
        kind: command.projectile,
        from: command.from,
        to: command.to,
        sequence: command.sequence,
        targetSize: command.targetSize
      });
      delays.set(command.targetId, flightDurationMs(arrow));
      continue;
    }
    if (command.projectile !== "fireball") continue;
    // Total rather than throwing, like the rest of the presentation path: a
    // shot this function cannot fly delays nothing and plays as a bolt would.
    if (!Number.isFinite(command.from?.x) || !Number.isFinite(command.to?.x)) continue;
    if (!Number.isFinite(command.xVelocity) || command.xVelocity <= 0) continue;
    const flight = fireballFlight({
      from: command.from,
      to: command.to,
      gladiatorDir: command.gladiatorDir,
      xVelocity: command.xVelocity
    });
    delays.set(command.targetId, flightDurationMs(flight));
  }
  for (const [targetId, shower] of showers) {
    const landing = reacting.has(targetId) ? shower.first : (shower.lethal ?? shower.first);
    delays.set(targetId, landing * PROJECTILE_FRAME_MS);
  }
  return delays;
}
