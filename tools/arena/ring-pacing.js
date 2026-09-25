/**
 * THE AI'S PACE WHEN A PERSON PLAYS (slice S8 of `docs/design/battle-ui.md`,
 * "The in-battle actions: DECIDED", the owner's decision 8: "AI turns: normal
 * speed, a hold-to-speed-up key and 'skip to my turn'").
 *
 * ► **PACING IS THE ARENA'S CLOCK, AND NOTHING ELSE.** The shell draws every
 *   animation, arrow, pop-up and crowd change against one clock, and the
 *   animation gate opens when the drawing on that clock is done
 *   (`animationCursor`); an AI seat moves only through that gate
 *   (`aiTurnStep`). So running the clock faster draws the AI's turns faster
 *   and changes nothing else: every step the engine takes, in the order it
 *   takes it, and every report the gate is given, are the same at any speed.
 *   No engine step is skipped — "skip to my turn" is the fastest clock, not
 *   a jump.
 *
 * The clock is the page's own (`performance.now()`, the frame's timestamp)
 * plus an OFFSET: each frame adds what the pace asked for beyond the wall time
 * that passed, and a stalled page takes back what the pace drew ahead since
 * the step on screen began (`ringPaceFrame`). With nothing asked the offset
 * stays 0 and the arena's clock IS the page's clock, to the bit. It never
 * runs backwards.
 */

import { ControllerKind } from "../../src/team/controllers.js";
import { SeatMode } from "./seats.js";

/**
 * ► **THE KEY IS SHIFT, HELD (AUTHORED; the brief offered Space or Shift).**
 *   Space is the key that PRESSES a focused button — the strip's buttons, the
 *   "confirm every move" box — and the strip gives the focus back to a ring
 *   button on the person's next turn (`ringFocusWanted`), so a Space still
 *   held when that turn arrives would press it on release: an action sent by
 *   accident. Shift presses nothing on its own, anywhere on the page.
 */
export const RING_PACE_KEY = "Shift";

/** Held Shift: the AI's turns at four times the page's pace (AUTHORED). */
export const RING_PACE_HELD_RATE = 4;

/**
 * "Skip to my turn": the AI's turns at 64 times the page's pace — at 60 frames
 * a second, as much as `RING_PACE_MAX_FRAME_MS` lets a frame draw (AUTHORED).
 * Every step is still drawn, one frame at least, and the gate still waits for
 * each: a fast-forward, never a jump over the engine.
 */
export const RING_PACE_SKIP_RATE = 64;

/**
 * ► **NO FRAME DRAWS MORE THAN ONE SECOND OF THE ARENA — beyond its own
 *   length, which the page's pace already draws.** The gate gives up on an
 *   animation that ran `ANIMATION_TIMEOUT_MS` (4 s) past its end without being
 *   seen to end (`abandonReasonFor`), and a frame that jumped the clock past
 *   that would ABANDON an action the arena had simply drawn quickly: a
 *   different record in the gate. An animation's end can only be overrun by
 *   one frame's advance, so capping what the pace ADDS keeps every frame at
 *   max(its own length, 1 s). A frame already longer than the cap — a stalled
 *   or hidden tab — gets nothing added, and more: see `ringPaceFrame`.
 */
export const RING_PACE_MAX_FRAME_MS = 1000;

/**
 * Before the first frame: no offset, nothing held, nothing skipped, and no
 * step drawn yet.
 */
export const RING_PACE_START = Object.freeze({
  wallMs: null, offsetMs: 0, held: false, skipping: false, aiStep: false, stepOffsetMs: 0
});

/**
 * WHETHER THE PACE APPLIES TO THIS BOUT: a person plays (`?play=`) and the AI
 * plays at least one seat. Spectating (`?spectate=1`) and every seat by hand
 * are drawn exactly as they were — no key, no skip.
 *
 * @param {{mode: string, controllers: Record<string, string>}} seats `seatControllersFrom`'s answer
 */
export function ringPaceApplies(seats) {
  if (seats?.mode !== SeatMode.PLAY) return false;
  return Object.values(seats.controllers ?? {}).some((controller) => controller === ControllerKind.AI);
}

/** A person's turn with the arena ready for it, or a bout decided and drawn: nothing left to skip to. */
function personReadyOrDone({ turn, ready }) {
  return ready === true && (!turn || turn.ai !== true);
}

/** Whether "skip to my turn" can be pressed: between a person's turns in a bout a person plays against the AI. */
function skipOffered({ applies, turn, ready }) {
  return applies === true && Boolean(turn) && !personReadyOrDone({ turn, ready });
}

/**
 * "SKIP TO MY TURN", pressed: on when it is offered, off when it is pressed
 * again; not offered, it changes nothing. It stands until the next person's
 * turn is ready (`ringPaceFrame`).
 *
 * @param {{applies: boolean, turn: object|null, ready: boolean}} state as it stands now
 */
export function ringPaceSkipPressed(pace, state) {
  if (!skipOffered(state)) return pace;
  return Object.freeze({ ...pace, skipping: !pace.skipping });
}

/**
 * THE KEY: Shift down holds the pace, Shift up lets it go, and the window
 * losing the focus lets it go too — a keyup the page never sees must not
 * leave the AI racing. Any other key changes nothing.
 *
 * @param {{type: "keydown"|"keyup"|"blur", key?: string}} event
 */
export function ringPaceKeyed(pace, { type, key } = {}) {
  let held = pace.held;
  if (type === "blur") held = false;
  else if (key === RING_PACE_KEY && type === "keydown") held = true;
  else if (key === RING_PACE_KEY && type === "keyup") held = false;
  return held === pace.held ? pace : Object.freeze({ ...pace, held });
}

/**
 * A STEP WAS SUBMITTED, and whose it was: `ai` for an AI seat's (`aiTurnStep`),
 * false for a person's. While the gate is shut, the drawing on screen is this
 * step's, and only an AI seat's is drawn faster. The offset its clips are
 * stamped with is kept (`stepOffsetMs`): what the pace draws ahead from here
 * is this step's lead, which a stall gives back (`ringPaceFrame`). `wallMs`
 * is when it was submitted, on the page's clock — between frames, a click;
 * left out, the last frame's — and the offset kept is the one `ringPaceNow`
 * stamps its clips with then.
 *
 * ► **A PERSON'S STEP SPENDS THE SKIP (Codex review of S8, pass 1).** It was
 *   spent only by a frame that BEGAN on his ready turn — but the drain opens
 *   his turn in the middle of a frame, and a person who acts before the next
 *   one never lets a frame see it, so the skip stood and every AI turn after
 *   his was drawn at 64x. His turn came either way; his step says so.
 */
export function ringPaceSubmitted(pace, { ai = false, wallMs = pace.wallMs } = {}) {
  const byAi = ai === true;
  const stepOffsetMs = Number.isFinite(wallMs) ? ringPaceNow(pace, wallMs) - wallMs : pace.offsetMs;
  return Object.freeze({ ...pace, aiStep: byAi, stepOffsetMs, skipping: byAi && pace.skipping });
}

/**
 * THE RATE the arena's clock runs at this frame: faster only while an AI
 * seat's action is being drawn — the gate shut on an AI seat's step, or open
 * with an AI seat about to move — in a bout a person plays against the AI,
 * once the arena is on screen, and only when he asked.
 */
function paceRate(pace, { applies, open, turn, ready }) {
  if (!applies || !open) return 1;
  const aiShowing = ready ? turn?.ai === true : pace.aiStep === true;
  if (!aiShowing) return 1;
  if (pace.skipping) return RING_PACE_SKIP_RATE;
  if (pace.held) return RING_PACE_HELD_RATE;
  return 1;
}

/**
 * HOW FAR THE ARENA'S CLOCK MOVES in `delta` ms of the page's, at `rate`: the
 * rate's advance, but no more than a second — or, on a page that stalled for
 * longer, `delta` less the lead the pace drew since the step on screen began,
 * if that is more. So a frame under a second draws at least its own length
 * (rate >= 1) and at most a second; a longer one gives back the lead but
 * still draws a second. Non-decreasing in both `delta` and `rate`, which is
 * what lets the clock between frames (`ringPaceNow`, at rate 1) never pass
 * the frame after it. At rate 1 with no lead it is `delta`, exactly.
 */
function advanceOf(pace, delta, rate) {
  const lead = Math.max(0, pace.offsetMs - pace.stepOffsetMs);
  return Math.min(delta * rate, Math.max(delta - lead, RING_PACE_MAX_FRAME_MS));
}

/**
 * ONE FRAME OF THE ARENA'S CLOCK: the pace after it, the arena's time for this
 * frame (`nowMs`) and the rate it ran at.
 *
 * ► **A STALLED PAGE GIVES BACK THE LEAD (Codex review of S8, pass 1).** The
 *   cap kept the pace from ADDING a long jump, but a stall after the pace had
 *   drawn ahead still overran by that lead: the real 1,200 ms sidestep, frames
 *   at 0, 200 and 4,700 ms, is reported at the page's pace (4,700, 3,500 past
 *   its end) and was ABANDONED with Shift held (800, then 5,300: 4,100 past,
 *   over the 4,000 grace). So a frame longer than the cap advances the arena
 *   by its length LESS what the pace drew ahead since the step on screen
 *   began (`stepOffsetMs`), ~~never below nothing~~ **never below a second
 *   (the cap)**: the arena then stands where the page's own pace would have
 *   it, or a second on from where it was — no abandon either way. A stall can
 *   abandon under the pace only what it would abandon at the page's own pace.
 *
 * ► **AND THE CLOCK BETWEEN FRAMES FOLLOWS THE SAME RULE (Codex review of S8,
 *   pass 2).** It kept the whole offset while the frame after it gave the
 *   lead back, so a read during a stall — a resize's render — landed seconds
 *   after that frame (4,999, then 3,000), and the arena went back from cues
 *   fired and blood stamped. The give-back never lets a frame stand still
 *   now (the "never below nothing" of pass 1 was a step down at the cap no
 *   clock between frames could follow), and `ringPaceNow` is this rule at
 *   rate 1: never later than the next frame, never earlier than the last.
 *
 * @param {object} pace the pace before this frame (`RING_PACE_START` at first)
 * @param {{wallMs: number, applies: boolean, open: boolean, turn: object|null, ready: boolean}} frame
 *   the page's clock at this frame (`wallMs`); whether the pace applies to
 *   this bout (`ringPaceApplies`); whether the arena is on screen (the asset
 *   gate); whose turn it is (`seatTurnFor`) and whether the animation gate is
 *   open — as they stand when the frame begins
 */
export function ringPaceFrame(pace, { wallMs, applies = false, open = false, turn = null, ready = false }) {
  // The skip is spent the moment a person's turn is ready (or nobody's is left).
  const skipping = pace.skipping && !personReadyOrDone({ turn, ready });
  const rate = paceRate({ ...pace, skipping }, { applies, open, turn, ready });
  const delta = pace.wallMs === null ? 0 : Math.max(0, wallMs - pace.wallMs);
  // At rate 1, and with no lead, the advance is `delta` itself and the offset does not move.
  const offsetMs = pace.offsetMs + (advanceOf(pace, delta, rate) - delta);
  return Object.freeze({ pace: Object.freeze({ ...pace, wallMs, offsetMs, skipping }), nowMs: wallMs + offsetMs, rate });
}

/**
 * THE ARENA'S CLOCK BETWEEN FRAMES — a click's step is stamped with it, a
 * resize draws with it: the last frame's clock run on at the page's pace, by
 * the frame's own rule (`advanceOf` at rate 1), so it never passes the frame
 * that follows whatever that frame's rate. Within a second of the last frame,
 * and on a page nobody paced, it is the page's clock plus the offset, exactly.
 */
export function ringPaceNow(pace, wallMs) {
  if (pace.wallMs === null) return wallMs + pace.offsetMs;
  const delta = Math.max(0, wallMs - pace.wallMs);
  return wallMs + pace.offsetMs + (advanceOf(pace, delta, 1) - delta);
}

/**
 * WHAT THE STRIP SHOWS OF THE PACE (its "AI" row, `renderRingPace`): the row
 * and its skip button only while the skip is offered — between a person's
 * turns — the button pressed while the skip stands, and a word on what the
 * pace is doing. The key itself is written on the row, in the page.
 *
 * A skip spent by a person's turn reads as spent at once, before the next
 * frame clears it.
 */
export function ringPaceView(pace, { applies = false, turn = null, ready = false } = {}) {
  const offered = skipOffered({ applies, turn, ready });
  const skipping = offered && pace.skipping === true;
  const held = pace.held === true;
  const state = !offered ? "" : skipping ? "Skipping to your turn…" : held ? `${RING_PACE_KEY} held: the AI's turns at ${RING_PACE_HELD_RATE}×.` : "";
  return Object.freeze({ offered, skipping, held, state });
}
