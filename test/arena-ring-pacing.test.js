/**
 * THE AI'S PACE WHEN A PERSON PLAYS (slice S8 of `docs/design/battle-ui.md`,
 * the owner's decision 8: "AI turns at normal speed, a hold-to-speed-up key
 * and 'skip to my turn'"). `tools/arena/ring-pacing.js` decides it; the shell
 * runs its animation clock through it.
 *
 * Pacing is PRESENTATION ONLY: it changes how fast the arena's clock runs
 * while an AI seat's action is drawn, never which step the engine takes or
 * when. What is pinned:
 *
 * 1. the clock — with nothing asked it IS the page's clock; held Shift runs it
 *    at 4x, and "skip to my turn" as fast as one second of the arena per drawn
 *    frame, and only while an AI seat's action is being drawn;
 * 2. the skip's life — offered only between a person's turns, over at the next
 *    one; the key — Shift, held, let go, or lost with the window's focus;
 * 3. whole bouts on the page's own frame loop through the ENFORCING animation
 *    gate: the same state-hash sequence at every speed and with skipping, no
 *    animation ever abandoned, and the AI's turns really drawn faster;
 * 4. the shell's wiring, read as text.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  RING_PACE_HELD_RATE, RING_PACE_KEY, RING_PACE_MAX_FRAME_MS, RING_PACE_SKIP_RATE, RING_PACE_START,
  ringPaceApplies, ringPaceFrame, ringPaceKeyed, ringPaceNow, ringPaceSkipPressed, ringPaceSubmitted, ringPaceView
} from "../tools/arena/ring-pacing.js";
import { seatControllersFrom, seatFrameFor, seatTurnFor, withSeatControllers } from "../tools/arena/seats.js";
import { ringEntries, ringKeyCommand, ringModelFor } from "../tools/arena/ring.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { isCampaignSettled } from "../src/team/index.js";
import {
  ANIMATION_TIMEOUT_MS, animationCursor, applyCommands, emptyScene, reactionDelaysFor, timelineFor, timelinesForStep
} from "../src/render/index.js";

/** `seatTurnFor`'s answer, as far as the pace reads it. */
const AI_TURN = Object.freeze({ actorId: "blue-1", ai: true });
const PERSON_TURN = Object.freeze({ actorId: "red-1", ai: false });

/* ------------------------------------------------------------------ */
/* 1. The clock                                                        */
/* ------------------------------------------------------------------ */

test("with nothing asked, the arena's clock IS the page's clock, frame for frame — a stalled frame included", () => {
  let pace = RING_PACE_START;
  for (const wallMs of [1000, 1016.7, 1033.4, 5033.4, 5050]) {
    const frame = ringPaceFrame(pace, { wallMs, applies: true, open: true, turn: AI_TURN, ready: false });
    pace = frame.pace;
    assert.equal(frame.nowMs, wallMs);
    assert.equal(frame.rate, 1);
    assert.equal(ringPaceNow(pace, wallMs + 3), wallMs + 3, "and between frames too");
  }
});

/** Frames of the clock in a row, each `{wallMs, ...state}`; returns every frame's `[nowMs, rate]` and the pace after. */
function run(pace, frames) {
  const seen = [];
  for (const frame of frames) {
    const next = ringPaceFrame(pace, { applies: true, open: true, turn: AI_TURN, ready: false, ...frame });
    pace = next.pace;
    seen.push([next.nowMs, next.rate]);
  }
  return { pace, seen };
}

test("Shift held draws the AI's action at 4x, and the person's own at 1x whatever is held", () => {
  assert.equal(RING_PACE_KEY, "Shift");
  const held = ringPaceKeyed(RING_PACE_START, { type: "keydown", key: "Shift" });
  // An AI seat's step is being drawn, on 16 ms frames: 64 ms of the arena each.
  const ai = run(ringPaceSubmitted(held, { ai: true }), [{ wallMs: 1000 }, { wallMs: 1016 }, { wallMs: 1032 }]);
  assert.deepEqual(ai.seen, [[1000, 4], [1064, 4], [1128, 4]], "the first frame has no interval to scale");
  // The person's own step, Shift still held: the page's pace, the offset kept.
  const person = run(ringPaceSubmitted(ai.pace, { ai: false }), [{ wallMs: 1048 }, { wallMs: 1064 }]);
  assert.deepEqual(person.seen, [[1144, 1], [1160, 1]]);
  assert.equal(ringPaceNow(person.pace, 1070), 1166, "between frames the clock keeps the offset");
  // Let go, and the next AI step is drawn at the page's pace.
  const free = run(ringPaceSubmitted(ringPaceKeyed(person.pace, { type: "keyup", key: "Shift" }), { ai: true }), [{ wallMs: 1080 }]);
  assert.deepEqual(free.seen, [[1176, 1]]);
});

test("Shift held speeds nothing but an AI seat's drawing: a person's turn, the loading frame, spectating and the decided bout run at 1x", () => {
  const held = ringPaceKeyed(ringPaceSubmitted(RING_PACE_START, { ai: true }), { type: "keydown", key: "Shift" });
  const rateAt = (state) => run(held, [{ wallMs: 0 }, { wallMs: 16, ...state }]).seen[1];
  // The drawing the AI's step left is done: whose turn it is decides.
  assert.deepEqual(rateAt({ ready: true, turn: PERSON_TURN }), [16, 1], "a person's turn, ready: his own pace");
  assert.deepEqual(rateAt({ ready: true, turn: AI_TURN }), [64, 4], "an AI seat about to move is the AI's turn");
  assert.deepEqual(rateAt({ ready: true, turn: null }), [16, 1], "decided and drawn: the celebration at the page's pace");
  // Still being drawn: the AI's step, whoever is next — the deciding blow included.
  assert.deepEqual(rateAt({ ready: false, turn: PERSON_TURN }), [64, 4]);
  assert.deepEqual(rateAt({ ready: false, turn: null }), [64, 4], "the AI's deciding blow");
  // Not in this bout, or not yet.
  assert.deepEqual(rateAt({ applies: false }), [16, 1], "spectating, or every seat by hand: no pace");
  assert.deepEqual(rateAt({ open: false }), [16, 1], "the loading frame: nothing is drawn yet");
});

test("a frame never draws more than one second of the arena beyond its own length — the gate's 4 s grace can never be outrun by the pace", () => {
  assert.equal(RING_PACE_HELD_RATE, 4);
  assert.equal(RING_PACE_MAX_FRAME_MS, 1000);
  const held = ringPaceKeyed(ringPaceSubmitted(RING_PACE_START, { ai: true }), { type: "keydown", key: "Shift" });
  const second = (wallMs) => run(held, [{ wallMs: 0 }, { wallMs }]).seen[1];
  assert.deepEqual(second(250), [1000, 4], "4 x 250 is exactly the cap");
  assert.deepEqual(second(400), [1000, 4], "4 x 400 would be 1600: capped");
  assert.deepEqual(second(2000), [2000, 4], "a frame already past the cap gets nothing added — the page's own stall, as at 1x");
});

/* ------------------------------------------------------------------ */
/* 2. "Skip to my turn"                                                */
/* ------------------------------------------------------------------ */

test("skip to my turn: the AI's drawing as fast as a frame may go, until a person's turn is ready — then it is over", () => {
  assert.equal(RING_PACE_SKIP_RATE, 64);
  const between = { applies: true, turn: AI_TURN, ready: false };
  const skipping = ringPaceSkipPressed(ringPaceSubmitted(RING_PACE_START, { ai: true }), between);
  assert.equal(skipping.skipping, true);
  // 64 x 10 ms is 640 ms of the arena; 64 x 16 would be 1,024: the cap.
  const fast = run(skipping, [{ wallMs: 0 }, { wallMs: 10 }, { wallMs: 26 }]);
  assert.deepEqual(fast.seen, [[0, 64], [640, 64], [1640, 64]]);
  // Held Shift as well changes nothing: the skip is the faster.
  const both = run(ringPaceKeyed(skipping, { type: "keydown", key: "Shift" }), [{ wallMs: 0 }, { wallMs: 10 }]);
  assert.deepEqual(both.seen, [[0, 64], [640, 64]]);
  // A person's own step, drawn while the skip stands, is drawn at his pace — the skip pressed AFTER he
  // acted (~~pressed before and left standing by his step~~: his step spends it since Codex's review of
  // S8, pass 1; the test below).
  const pressedAfter = ringPaceSkipPressed(ringPaceSubmitted(fast.pace, { ai: false }), between);
  const own = run(pressedAfter, [{ wallMs: 42 }]);
  assert.deepEqual(own.seen, [[1656, 1]]);
  assert.equal(own.pace.skipping, true, "still skipping: the AI's turns after it are what it skips");
  // His turn, ready: the skip is spent, and the AI's next step is drawn at 1x.
  const mine = run(ringPaceSubmitted(fast.pace, { ai: true }), [{ wallMs: 42, turn: PERSON_TURN, ready: true }]);
  assert.deepEqual(mine.seen, [[1656, 1]]);
  assert.equal(mine.pace.skipping, false);
  assert.deepEqual(run(ringPaceSubmitted(mine.pace, { ai: true }), [{ wallMs: 58 }]).seen, [[1672, 1]], "not sticky");
  // A bout decided and drawn has no turn to skip to: over too.
  assert.equal(run(fast.pace, [{ wallMs: 42, turn: null, ready: true }]).pace.skipping, false);
  assert.equal(run(fast.pace, [{ wallMs: 42, turn: null, ready: false }]).pace.skipping, true, "the deciding blow is still the AI's to skip");
});

test("the skip is offered only between a person's turns, in a bout a person plays against the AI; pressed again it stops", () => {
  const press = (state) => ringPaceSkipPressed(RING_PACE_START, { applies: true, turn: AI_TURN, ready: false, ...state }).skipping;
  assert.equal(press({}), true, "an AI seat's turn");
  assert.equal(press({ turn: PERSON_TURN, ready: false }), true, "a person's own step still drawn: the AI's turns may follow it");
  assert.equal(press({ turn: PERSON_TURN, ready: true }), false, "a person's turn, ready: nothing to skip");
  assert.equal(press({ turn: null }), false, "the bout is decided");
  assert.equal(press({ applies: false }), false, "spectating, or every seat by hand");
  const on = ringPaceSkipPressed(RING_PACE_START, { applies: true, turn: AI_TURN, ready: false });
  assert.equal(ringPaceSkipPressed(on, { applies: true, turn: AI_TURN, ready: false }).skipping, false);
});

test("Shift is held until it is let go or the window loses the focus; no other key touches it", () => {
  const held = ringPaceKeyed(RING_PACE_START, { type: "keydown", key: "Shift" });
  assert.equal(held.held, true);
  assert.equal(ringPaceKeyed(held, { type: "keydown", key: "Shift" }).held, true, "its repeats keep it held");
  for (const key of [" ", "Enter", "1", "q", "ArrowLeft", "Tab", "Control"]) {
    assert.equal(ringPaceKeyed(held, { type: "keyup", key }).held, true, `${JSON.stringify(key)} up`);
    assert.equal(ringPaceKeyed(RING_PACE_START, { type: "keydown", key }).held, false, `${JSON.stringify(key)} down`);
  }
  assert.equal(ringPaceKeyed(held, { type: "keyup", key: "Shift" }).held, false);
  assert.equal(ringPaceKeyed(held, { type: "blur" }).held, false, "a keyup the page never sees must not leave the AI racing");
});

test("the pace applies where a person plays against the AI — and nowhere else", () => {
  const teams = (size) => ["red", "blue"].map((id) => ({
    id, members: Array.from({ length: size }, (unused, index) => ({ id: `${id}-${index + 1}`, controller: "local" }))
  }));
  const applies = (query, size = 2) => ringPaceApplies(seatControllersFrom(new URLSearchParams(query), teams(size)));
  assert.equal(applies("play=red"), true);
  assert.equal(applies("play=red-1"), true, "the AI plays his side's other fighter, and blue");
  assert.equal(applies("play=blue-2", 1 + 2), true);
  assert.equal(applies("play=red,blue"), false, "a person plays every seat: no AI turn to pace");
  assert.equal(applies("spectate=1"), false, "spectating is drawn exactly as it was");
  assert.equal(applies(""), false, "every seat by hand");
});

test("what the strip shows: the row between a person's turns, the skip pressed or not, and what the pace is doing", () => {
  const between = { applies: true, turn: AI_TURN, ready: false };
  assert.deepEqual(ringPaceView(RING_PACE_START, between), { offered: true, skipping: false, held: false, state: "" });
  const held = ringPaceKeyed(RING_PACE_START, { type: "keydown", key: "Shift" });
  assert.deepEqual(ringPaceView(held, between), { offered: true, skipping: false, held: true, state: "Shift held: the AI's turns at 4×." });
  const skipping = ringPaceSkipPressed(held, between);
  assert.deepEqual(ringPaceView(skipping, between), { offered: true, skipping: true, held: true, state: "Skipping to your turn…" });
  // A person's turn, ready: no row, and a skip still standing reads as spent before the next frame spends it.
  assert.deepEqual(ringPaceView(skipping, { applies: true, turn: PERSON_TURN, ready: true }),
    { offered: false, skipping: false, held: true, state: "" });
  assert.deepEqual(ringPaceView(held, { applies: false, turn: AI_TURN, ready: false }),
    { offered: false, skipping: false, held: true, state: "" }, "no pace in this bout: no row, whatever is held");
});

/**
 * CODEX REVIEW OF S8, PASS 1, FINDING 1 (reproduced here before the fix): the
 * cap kept the pace from ADDING a jump, but a stall after the pace had drawn
 * ahead still overran by the lead. The real 1,200 ms sidestep, frames at 0,
 * 200 and 4,700 ms: at the page's pace it is reported at 4,700; with Shift held
 * the arena stood at 800 and then 5,300 — 4,100 ms past its end, past the
 * gate's 4,000 ms grace — and the same token was ABANDONED.
 */
function drainedOnce(walls, { hold = () => false, skip = false } = {}) {
  const timeline = timelineFor("sidestep", { role: "actor" });
  let pace = RING_PACE_START;
  const playing = new Map();
  const nows = [];
  let outcome = null;
  walls.forEach((wallMs, index) => {
    pace = ringPaceKeyed(pace, { type: hold(index) ? "keydown" : "keyup", key: "Shift" });
    // Frame 0: an AI seat about to move; after it, its step drawn with the person next.
    const frame = ringPaceFrame(pace, { wallMs, applies: true, open: true, turn: index === 0 ? AI_TURN : PERSON_TURN, ready: index === 0 });
    pace = frame.pace;
    nows.push(frame.nowMs);
    if (index === 0) {
      // The AI seat's step, submitted in this frame: stamped on the arena's clock.
      pace = ringPaceSubmitted(pace, { ai: true });
      if (skip) pace = ringPaceSkipPressed(pace, { applies: true, turn: PERSON_TURN, ready: false });
      playing.set("blue-1", { timeline, token: 1, startedAt: ringPaceNow(pace, wallMs) });
      return;
    }
    if (outcome) return;
    const cursor = animationCursor([1], playing, frame.nowMs);
    if (cursor.abandon) outcome = "abandoned";
    else if (cursor.finished.includes(1)) outcome = "reported";
  });
  return { nows, outcome };
}

test("CODEX S8 pass 1: a stall after the pace drew ahead abandons nothing the page's own pace would have reported", () => {
  assert.equal(timelineFor("sidestep", { role: "actor" }).durationMs, 1200);
  assert.equal(ANIMATION_TIMEOUT_MS, 4000);
  const walls = [0, 200, 4700];
  assert.deepEqual(drainedOnce(walls), { nows: [0, 200, 4700], outcome: "reported" }, "the page's own pace: 3,500 past its end");
  // Held: 600 ms drawn ahead by 200; the stall gives that lead back, so the arena stands where the page's pace would.
  assert.deepEqual(drainedOnce(walls, { hold: () => true }), { nows: [0, 800, 4700], outcome: "reported" });
  assert.deepEqual(drainedOnce(walls, { hold: (index) => index < 2 }), { nows: [0, 800, 4700], outcome: "reported" },
    "let go before the stall: the same");
  // Skipping: 64 x 200 is capped at a second, 800 ahead; given back the same way.
  assert.deepEqual(drainedOnce(walls, { skip: true }), { nows: [0, 1000, 4700], outcome: "reported" });
  // At the page's pace a stall 4,000+ past the end is abandoned — the pace changes nothing there either.
  assert.deepEqual(drainedOnce([0, 200, 5300]), { nows: [0, 200, 5300], outcome: "abandoned" });
  assert.deepEqual(drainedOnce([0, 200, 5300], { hold: () => true }), { nows: [0, 800, 5300], outcome: "abandoned" });
});

test("a stall shorter than the lead the pace drew since the step began still draws one second — never backwards, never more", () => {
  const skipping = ringPaceSkipPressed(ringPaceSubmitted(RING_PACE_START, { ai: true }), { applies: true, turn: AI_TURN, ready: false });
  // 16 ms frames skipping: 1,000 of the arena each, 984 ahead each; then a 2,000 ms stall: 2,952 ahead
  // (~~the clock stood still~~ — a second, the cap, since Codex's review of S8, pass 2: the rule is one
  // the clock between frames can follow without ever passing the next frame; the test after this one).
  const fast = run(skipping, [{ wallMs: 0 }, { wallMs: 16 }, { wallMs: 32 }, { wallMs: 48 }, { wallMs: 2048 }, { wallMs: 2064 }]);
  assert.deepEqual(fast.seen, [[0, 64], [1000, 64], [2000, 64], [3000, 64], [4000, 64], [5000, 64]]);
  // A new step starts a new lead: a stall right after it is the page's own.
  const fresh = run(ringPaceSubmitted(fast.pace, { ai: true }), [{ wallMs: 7064 }]);
  assert.deepEqual(fresh.seen, [[10000, 64]]);
});

/**
 * CODEX REVIEW OF S8, PASS 2 (reproduced here before the fix): the clock
 * BETWEEN frames — a resize's render, a click's step — kept the whole offset
 * while the next frame gave the lead back, so a read during a stall landed
 * seconds after the frame that followed it: skipping, frames at 0, 16, 32 and
 * 48 ms, `ringPaceNow` at 2,047 gave 4,999 and the frame at 2,048 gave 3,000.
 * A render at 4,999 fires the cues and stamps the blood of a time the arena
 * then goes back from.
 */
test("CODEX S8 pass 2: no read between two frames is later than the next frame, or earlier than the last — through a stall too", () => {
  const skipping = ringPaceSkipPressed(ringPaceSubmitted(RING_PACE_START, { ai: true }), { applies: true, turn: AI_TURN, ready: false });
  const before = run(skipping, [{ wallMs: 0 }, { wallMs: 16 }, { wallMs: 32 }, { wallMs: 48 }]);
  assert.deepEqual(before.seen.at(-1), [3000, 64]);
  const reads = [100, 1047, 1048, 1049, 1500, 2047].map((wallMs) => ringPaceNow(before.pace, wallMs));
  // To 1,048 the page's pace from 3,000; past a second, a second at least and the lead given back.
  assert.deepEqual(reads, [3052, 3999, 4000, 4000, 4000, 4000]);
  const next = run(before.pace, [{ wallMs: 2048 }]).seen[0];
  assert.deepEqual(next, [4000, 64]);
  for (const read of reads) assert.ok(read >= 3000 && read <= next[0], `${read} lies between the frames`);
  // A step stamped between frames starts its lead from what it was stamped with.
  // Stamped at 4,000 at 2,047: one page's millisecond later, at the page's own pace, it is at 4,001.
  const stamped = ringPaceSubmitted(before.pace, { ai: true, wallMs: 2047 });
  assert.equal(ringPaceNow(stamped, 2047), 4000);
  assert.deepEqual(run(stamped, [{ wallMs: 2048 }]).seen, [[4001, 64]]);
});

/**
 * CODEX REVIEW OF S8, PASS 1, FINDING 2 (reproduced here before the fix): the
 * skip was spent only by a FRAME that began on the person's ready turn. The
 * drain opens his turn in the middle of a frame, and a person who acts before
 * the next one never lets a frame see it: the skip stood, and every AI turn
 * after his was drawn at 64x.
 */
test("CODEX S8 pass 1: the skip is spent by the person's own step, even when no frame saw his turn ready", () => {
  const between = { applies: true, turn: AI_TURN, ready: false };
  const skipping = ringPaceSkipPressed(ringPaceSubmitted(RING_PACE_START, { ai: true }), between);
  const acted = ringPaceSubmitted(skipping, { ai: false });
  assert.equal(acted.skipping, false);
  assert.deepEqual(run(ringPaceSubmitted(acted, { ai: true }), [{ wallMs: 0 }, { wallMs: 16 }]).seen, [[0, 1], [16, 1]],
    "the AI's turns after his are drawn at their own pace");
  assert.equal(ringPaceSubmitted(skipping, { ai: true }).skipping, true, "an AI seat's step does not spend it");
});

/* ------------------------------------------------------------------ */
/* 3. Whole bouts at every pace                                        */
/* ------------------------------------------------------------------ */

const deps = { ss2Combatant, ss2BattleValues };
const ATTACKS = ["power_attack", "normal_attack", "quick_attack", "bash_attack", "sniperight", "snipeleft", "bombardright", "bombardleft"];

/**
 * A PERSON AT THE RING, by one fixed policy that never looks at the clock:
 * a swing or a shot by its key; else a spell at the selected foe by its
 * letter; else the walk toward him in its slot by its arrow; else the first
 * button that acts, in the strip's order.
 */
function personChoice(host, selection) {
  const actorId = host.currentCombatantId();
  const model = ringModelFor({
    actorId,
    combatants: host.wire().teams.flatMap((team) => team.combatants),
    legal: host.legalActions(),
    previous: selection.get(actorId) ?? null,
    menuFor: (targetId) => host.unavailableActions(actorId, targetId)
  });
  selection.set(actorId, model.selectedId);
  const key = (name) => ringKeyCommand(model, { key: name, focus: "stage" });
  const attack = model.slots.find((slot) => slot.action && ATTACKS.includes(slot.verb));
  if (attack) return key(attack.key).action;
  const spell = model.items.find((item) => item.action?.type.startsWith("cast-") && item.action.targetId === model.selectedId);
  if (spell) return key(spell.key.toLowerCase()).action;
  const toward = model.moves.find((move) => move.place === "slot" && move.action
    && move.move === (model.stance?.facing === "left" ? "walk-left" : "walk-right"));
  if (toward) return key(toward.key).action;
  return ringEntries(model)[0].action;
}

/**
 * ONE BOUT ON THE PAGE'S OWN FRAME LOOP (`frame` in `tools/arena/main.js`),
 * through the ENFORCING animation gate, with the arena's clock run through
 * the pace: each frame the pace steps first, from whose turn it is and the
 * gate as the frame finds them; then the drain on the arena's clock
 * (`drainFinishedAnimations`: queued links handed on, expired ones dropped,
 * a timed-out one ABANDONED, finished tokens reported); then an AI seat moves
 * if the gate is open (`aiTurnStep`), or the person does, through the ring.
 * A step's clips are stamped with the arena's clock (`beginStep`), a victim's
 * at impact (`reactionDelaysFor`). The page's frames are `frames` ms long, in
 * turn — 16 (62.5 frames a second) unless a test asks for a slower or an
 * uneven page — so every time is a whole millisecond and no pace is decided
 * by rounding.
 *
 * `hand` is the person at the keyboard: each frame it may hold or let go of
 * Shift and press "skip to my turn", seeing only what the page shows. He acts
 * once his turn has been ready for `think` frames: 0 is the moment the drain
 * opens it, before any frame begins on it (Codex review of S8, pass 1: the
 * first version of this loop only ever did that, so no frame ever began on a
 * person's ready turn and the skip's spending was never reached).
 *
 * Besides what it returns, it counts three things the pace must never do:
 * draw at the skip's rate when the person has not pressed Skip since his
 * last step (`fastUnarmed`); abandon an animation a stall would NOT have
 * abandoned at the page's own pace from the same wall-clock start
 * (`abandonedWorse`) — each clip's wall-clock start is kept beside it; and
 * run its clock backwards, frame to frame or through a read between two
 * frames (`clockBackwards`; Codex review of S8, pass 2). The person's click
 * lands BETWEEN frames, 5 ms after the one that opened his turn, and his
 * step is stamped on the clock between frames, as `beginStep` stamps it.
 */
function pacedBout({ perSide, seed, kit = "", query = "play=red", hand = () => ({}), frames = [16], think = 0 }) {
  const items = demoItemsFrom(kit);
  const teams = [demoSide("red", perSide, { ...deps, items, seed }), demoSide("blue", perSide, { ...deps, items, seed })];
  const seats = seatControllersFrom(new URLSearchParams(query), teams);
  const host = createVanillaBattleHost({
    teams: withSeatControllers(teams, seats), rules: ss2TeamRules, bindings: SS2_STATIC_MAP_BINDINGS, seed, awaitAnimations: true
  });
  const applies = ringPaceApplies(seats);
  let scene = applyCommands(emptyScene(), host.constructArena().commands);
  const playing = new Map();
  let pendingTokens = [];
  let pace = RING_PACE_START;
  const selection = new Map();
  const seen = {
    steps: [], hashes: [host.hash()], abandoned: 0, frames: 0, aiDrawn: 0, personDrawn: 0,
    fastAtPersonTurn: 0, skipsLeftStanding: 0, waits: [], lastPersonFrame: null, rates: new Map(),
    fastUnarmed: 0, abandonedWorse: 0, skipPresses: 0, clockBackwards: 0
  };
  let lastNow = -Infinity;
  let armed = false;
  let readyFrames = 0;
  /** Per token and fighter: the wall-clock start of the clip chain and its whole length. */
  const wallClips = new Map();
  let wallMs = -frames[frames.length - 1];
  for (let frame = 0; ; frame += 1) {
    assert.ok(frame < 400000, `${perSide}v${perSide} seed ${seed}: never finished`);
    wallMs += frames[(frame + frames.length - 1) % frames.length];
    const ready = host.readyForNextAction().ready;
    const turn = seatTurnFor(host.battle, seats, { ready });
    const view = ringPaceView(pace, { applies, turn, ready });
    const act = hand({ frame, view, pace, pressed: () => seen.skipPresses > 0 });
    for (const event of act.keys ?? []) pace = ringPaceKeyed(pace, event);
    if (act.skip) {
      const before = pace.skipping;
      pace = ringPaceSkipPressed(pace, { applies, turn, ready });
      if (!before && pace.skipping) { armed = true; seen.skipPresses += 1; }
      if (before && !pace.skipping) armed = false;
    }
    if (!ready) seen[pace.aiStep ? "aiDrawn" : "personDrawn"] += 1;
    // A read between the last frame and this one — a resize's render — then the frame itself.
    const between = frame === 0 ? -Infinity : ringPaceNow(pace, wallMs - 1);
    const step = ringPaceFrame(pace, { wallMs, applies, open: true, turn, ready });
    pace = step.pace;
    const now = step.nowMs;
    if (between < lastNow || between > now || now < lastNow) seen.clockBackwards += 1;
    lastNow = now;
    seen.frames += 1;
    seen.rates.set(step.rate, (seen.rates.get(step.rate) ?? 0) + 1);
    if (step.rate === RING_PACE_SKIP_RATE && !armed) seen.fastUnarmed += 1;
    if (turn && !turn.ai && ready) {
      if (step.rate !== 1) seen.fastAtPersonTurn += 1;
      if (pace.skipping) seen.skipsLeftStanding += 1;
    }

    const cursor = animationCursor(pendingTokens, playing, now);
    for (const { combatantId, entry } of cursor.advanced) playing.set(combatantId, entry);
    for (const combatantId of cursor.expired) playing.delete(combatantId);
    if (cursor.abandon) {
      seen.abandoned += 1;
      const wallOverrun = Math.max(...[...wallClips].filter(([key]) => key.startsWith(`${cursor.abandon.token}:`))
        .map(([, clip]) => wallMs - clip.startedAt - clip.lengthMs));
      if (!(wallOverrun > ANIMATION_TIMEOUT_MS)) seen.abandonedWorse += 1;
      host.abandonActionAnimation(cursor.abandon.token, cursor.abandon.reason);
      pendingTokens = pendingTokens.filter((token) => token !== cursor.abandon.token);
    }
    for (const token of cursor.finished) host.reportActionAnimation(token);
    pendingTokens = pendingTokens.filter((token) => !cursor.finished.includes(token));
    if (host.battle.result && pendingTokens.length === 0) break;

    const seat = seatFrameFor(host.battle, seats, { ready: host.readyForNextAction().ready });
    let action = null;
    const personReady = Boolean(seat.turn && !seat.turn.ai && seat.turn.ready);
    readyFrames = personReady ? readyFrames + 1 : 0;
    if (seat.autoplay) action = { ...host.suggestAction(seat.turn.actorId), actorId: seat.turn.actorId };
    else if (personReady && readyFrames > think) {
      action = personChoice(host, selection);
      if (seen.lastPersonFrame !== null) seen.waits.push(frame - seen.lastPersonFrame);
      seen.lastPersonFrame = frame;
    }
    if (!action) continue;
    const submitted = host.submit(action);
    scene = applyCommands(scene, submitted.commands);
    const { started } = timelinesForStep(submitted.commands);
    const delays = reactionDelaysFor(submitted.commands);
    // An AI seat moves inside the frame; a person's click lands between frames.
    const submittedAt = seat.autoplay ? wallMs : wallMs + 5;
    pace = ringPaceSubmitted(pace, { ai: seat.autoplay, wallMs: submittedAt });
    const at = ringPaceNow(pace, submittedAt);
    if (at < lastNow) seen.clockBackwards += 1;
    for (const [combatantId, entry] of started) {
      entry.startedAt = at + (delays.get(combatantId) ?? 0);
      playing.set(combatantId, entry);
      let lengthMs = 0;
      for (let link = entry; link; link = link.then) lengthMs += link.timeline.durationMs;
      wallClips.set(`${entry.token}:${combatantId}`, { startedAt: submittedAt + (delays.get(combatantId) ?? 0), lengthMs });
    }
    pendingTokens = [...new Set([...pendingTokens, ...submitted.actionTokens])];
    if (!seat.autoplay) armed = false;
    seen.steps.push(`${action.actorId} ${action.type} ${action.targetId ?? "-"} ${action.itemId ?? "-"}`);
    seen.hashes.push(submitted.hash);
  }
  host.acknowledgeResultAnimations({
    deaths: host.awaitingDeathAnimations(), arenaLabel: scene.arenaLabel, completionToken: scene.completionToken
  });
  assert.equal(isCampaignSettled(host.battle), true, "the bout settles");
  return { ...seen, gate: host.actionAnimationState(), result: { ...host.battle.result } };
}

/** The hands: nobody touches anything; Shift held throughout; flicked; skip pressed whenever offered; and mixes. */
const HANDS = {
  none: () => ({}),
  held: ({ frame }) => (frame === 0 ? { keys: [{ type: "keydown", key: "Shift" }] } : {}),
  flicked: ({ frame }) => (frame % 5 === 0 ? { keys: [{ type: frame % 10 === 0 ? "keydown" : "keyup", key: "Shift" }] }
    : frame % 37 === 0 ? { keys: [{ type: "blur" }] } : {}),
  skip: ({ view }) => (view.offered && !view.skipping ? { skip: true } : {}),
  // Codex review of S8, pass 1: pressed ONCE, it must be spent by the person's next turn.
  "skip once": ({ view, pressed }) => (view.offered && !view.skipping && !pressed() ? { skip: true } : {}),
  "skip, changing its mind": ({ frame, view }) => (view.offered && frame % 13 === 0 ? { skip: true } : {}),
  "skip and held": ({ frame, view }) => ({
    keys: frame === 0 ? [{ type: "keydown", key: "Shift" }] : [],
    skip: view.offered && !view.skipping
  })
};

test("THE ACCEPTANCE: the same state-hash sequence at every pace and with skipping, no animation abandoned, and the AI drawn faster", (t) => {
  const tally = [];
  for (const [perSide, kit, seed, query] of [
    [1, "", 1, "play=red"], [2, "tricks", 2, "play=red"], [3, "", 3, "play=red"],
    [3, "tricks", 1, "play=red"], [2, "", 4, "play=red-1"], [1, "tricks", 5, "play=blue"]
  ]) {
    const label = `${perSide}v${perSide} ${kit || "plain"} seed ${seed} ${query}`;
    const runs = Object.fromEntries(Object.entries(HANDS).map(([name, hand]) => [name, pacedBout({ perSide, seed, kit, query, hand })]));
    const base = runs.none;
    assert.ok(base.steps.length > 10 && base.waits.length > 0, `${label}: a real bout, with a person's turns`);
    for (const [name, run] of Object.entries(runs)) {
      assert.deepEqual(run.hashes, base.hashes, `${label}, ${name}: the same state-hash sequence`);
      assert.deepEqual(run.steps, base.steps, `${label}, ${name}: the same steps`);
      assert.deepEqual(run.result, base.result, `${label}, ${name}`);
      assert.deepEqual(run.gate, base.gate, `${label}, ${name}: every action reported, the same tokens`);
      assert.equal(run.abandoned, 0, `${label}, ${name}: no animation abandoned`);
      assert.equal(run.fastAtPersonTurn, 0, `${label}, ${name}: a person's turn is never drawn fast`);
      assert.equal(run.skipsLeftStanding, 0, `${label}, ${name}: the skip is spent at a person's turn`);
      assert.equal(run.personDrawn, base.personDrawn, `${label}, ${name}: the person's own actions drawn at his pace`);
      assert.equal(run.fastUnarmed, 0, `${label}, ${name}: never at the skip's rate unless Skip was pressed since his last step`);
      assert.equal(run.clockBackwards, 0, `${label}, ${name}: the arena's clock never runs backwards`);
    }
    assert.equal(runs["skip once"].skipPresses, 1, `${label}: pressed once`);
    assert.deepEqual(base.gate.abandoned, []);
    assert.deepEqual([...base.rates.keys()], [1], `${label}: nothing asked, nothing faster`);
    // Faster, as asked: the AI's drawing in frames.
    const { none, held, skip } = runs;
    assert.ok(held.aiDrawn * 3 < none.aiDrawn, `${label}: held ${held.aiDrawn} vs ${none.aiDrawn}`);
    assert.ok(skip.aiDrawn * 8 < none.aiDrawn, `${label}: skip ${skip.aiDrawn} vs ${none.aiDrawn}`);
    const sum = (list) => list.reduce((total, value) => total + value, 0);
    tally.push({
      label, steps: base.steps.length, personTurns: base.waits.length + 1,
      aiFrames: Object.fromEntries(Object.entries(runs).map(([name, run]) => [name, run.aiDrawn])),
      personFrames: base.personDrawn, waited: { none: sum(none.waits), held: sum(held.waits), skip: sum(skip.waits) }
    });
  }
  t.diagnostic(JSON.stringify(tally));
});

test("a person who thinks before he acts: every frame on his ready turn at his pace, and the skip spent there", () => {
  for (const [perSide, kit, seed] of [[3, "", 3], [2, "tricks", 2]]) {
    const label = `${perSide}v${perSide} ${kit || "plain"} seed ${seed}`;
    const base = pacedBout({ perSide, seed, kit });
    let personReadyFrames = 0;
    for (const name of ["none", "held", "skip", "skip once"]) {
      const run = pacedBout({ perSide, seed, kit, hand: HANDS[name], think: 3 });
      assert.deepEqual(run.hashes, base.hashes, `${label}, thinking, ${name}`);
      assert.deepEqual(run.gate, base.gate, `${label}, thinking, ${name}`);
      assert.equal(run.fastAtPersonTurn + run.skipsLeftStanding + run.fastUnarmed + run.abandoned + run.clockBackwards, 0, `${label}, thinking, ${name}`);
      personReadyFrames += run.rates.get(1);
    }
    assert.ok(personReadyFrames > 0);
  }
});

test("a slow page and an uneven one: the same hashes as at 62.5 frames a second, and the skip still abandons nothing", (t) => {
  const tally = [];
  for (const [perSide, kit, seed] of [[3, "tricks", 2], [2, "", 6]]) {
    const label = `${perSide}v${perSide} ${kit || "plain"} seed ${seed}`;
    const base = pacedBout({ perSide, seed, kit });
    // 96 ms frames: 64 x 96 would be 6.1 s of the arena in one frame, past the gate's 4 s grace, uncapped.
    // Uneven: a 250 ms hitch among 16s and a 7 — at 4x exactly the cap.
    for (const [page, frames] of [["slow", [96]], ["uneven", [16, 16, 16, 250, 7]]]) {
      for (const name of ["none", "held", "skip"]) {
        const run = pacedBout({ perSide, seed, kit, hand: HANDS[name], frames });
        assert.deepEqual(run.hashes, base.hashes, `${label}, ${page} page, ${name}`);
        assert.deepEqual(run.gate, base.gate, `${label}, ${page} page, ${name}: every action reported`);
        assert.equal(run.abandoned, 0, `${label}, ${page} page, ${name}: nothing abandoned`);
        assert.equal(run.fastAtPersonTurn + run.skipsLeftStanding + run.clockBackwards, 0, `${label}, ${page} page, ${name}`);
        tally.push(`${label} ${page} ${name}: ${run.aiDrawn} AI frames, rates ${JSON.stringify([...run.rates])}`);
      }
    }
  }
  t.diagnostic(tally.join("; "));
});

test("CODEX S8 pass 1: a page that stalls for 4.6 s every second — the same hashes, and no abandon the page's own pace would not make", (t) => {
  // Sixty 16 ms frames, then a 4,600 ms stall: at the page's own pace any clip within 600 ms of its end is
  // abandoned by it. Under the pace the abandons may fall elsewhere — the steps start at other wall times —
  // but each must be one the stall makes at the page's pace from that clip's own wall-clock start.
  const frames = [...Array.from({ length: 60 }, () => 16), 4600];
  const tally = [];
  for (const [perSide, kit, seed] of [[3, "tricks", 1], [2, "", 4], [1, "tricks", 5]]) {
    const label = `${perSide}v${perSide} ${kit || "plain"} seed ${seed}`;
    const base = pacedBout({ perSide, seed, kit });
    for (const name of ["none", "held", "flicked", "skip", "skip once", "skip and held"]) {
      const run = pacedBout({ perSide, seed, kit, hand: HANDS[name], frames });
      assert.deepEqual(run.hashes, base.hashes, `${label}, stalling, ${name}: the same state-hash sequence`);
      assert.deepEqual(run.steps, base.steps, `${label}, stalling, ${name}`);
      assert.equal(run.abandonedWorse, 0, `${label}, stalling, ${name}: ${run.abandoned} abandoned, each one the page's pace makes`);
      assert.equal(run.fastUnarmed + run.fastAtPersonTurn + run.skipsLeftStanding + run.clockBackwards, 0, `${label}, stalling, ${name}`);
      tally.push(`${label} ${name}: ${run.abandoned} abandoned`);
    }
  }
  // Found, not stated: the stall does abandon, at the page's own pace too.
  assert.ok(tally.some((line) => / none: [1-9]/.test(line)), tally.join("; "));
  t.diagnostic(tally.join("; "));
});

/* ------------------------------------------------------------------ */
/* 4. The shell's wiring, read as text                                 */
/* ------------------------------------------------------------------ */

/*
 * `tools/arena/main.js` cannot be imported by node, so — as the other ring tests do — the lines that
 * hand the pace to the page are pinned as text: comments out and strings blanked, so prose cannot match.
 */
const raw = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../tools/arena/index.html", import.meta.url), "utf8");
function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
}
const code = codeOnly(raw);
function functionBody(name) {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is not defined in tools/arena/main.js`);
  let depth = 0;
  for (let index = code.indexOf("{", start); index < code.length; index += 1) {
    if (code[index] === "{") depth += 1;
    else if (code[index] === "}") { depth -= 1; if (depth === 0) return code.slice(start, index + 1); }
  }
  throw new Error(`${name}'s braces do not balance`);
}

test("the shell: every frame's clock is the pace's, stepped FIRST, from the turn and the gate as the frame finds them", () => {
  const frame = functionBody("frame");
  assert.match(frame, /^function frame\(wallNow\) \{\s*try \{\s*const now = pacedNow\(wallNow\);\s*if \(!assetGateOpen && !openArena\(now\)\) \{/,
    "the arena's clock for this frame, before anything reads it — inside the try, so a throw cannot stop the loop");
  assert.match(frame, /settleIfReady\(\);\s*render\(now\);\s*renderRingPace\(\);/, "the strip's AI row follows the frame");
  const paced = functionBody("pacedNow");
  assert.match(paced, /const ready = host\.readyForNextAction\(\)\.ready;\s*const step = ringPaceFrame\(ringPace, \{\s*wallMs: wallNow, applies: ringPaceOn, open: assetGateOpen, turn: seatTurnFor\(host\.battle, seats, \{ ready \}\), ready\s*\}\);\s*ringPace = step\.pace;\s*return step\.nowMs;/);
  assert.match(code, /const ringPaceOn = ringPaceApplies\(seats\);/);
  assert.match(code, /let ringPace = RING_PACE_START;/);
  assert.match(functionBody("arenaNow"), /return ringPaceNow\(ringPace, performance\.now\(\)\);/);
});

test("the shell: every step is stamped on the arena's clock, and marked the AI's only where an AI seat moves", () => {
  const begin = functionBody("beginStep");
  assert.match(begin, /^function beginStep\(step, byAi = false\) \{\s*ringPace = ringPaceSubmitted\(ringPace, \{ ai: byAi, wallMs: performance\.now\(\) \}\);/,
    "marked, with when — a click lands between frames (Codex review of S8, pass 2)");
  assert.equal((begin.match(/arenaNow\(\)/g) ?? []).length, 10, "a fireball's three, an arrow's three, a boulder, a bolt, the clips and the first draw: the arena's clock");
  assert.match(begin, /render\(arenaNow\(\)\);\s*\}$/, "the step's own first draw too");
  assert.match(functionBody("aiTurnStep"), /beginStep\(step, true\);/);
  for (const name of ["actFromRing", "renderControls"]) {
    assert.match(functionBody(name), /beginStep\(step\);/, `${name}: a person's step`);
  }
  assert.deepEqual(code.match(/beginStep\(step(, true)?\);/g), ["beginStep(step);", "beginStep(step);", "beginStep(step, true);"],
    "three submits, one of them the AI's");
  assert.match(functionBody("noteArenaSoundStep"), /const now = arenaNow\(\);/);
  assert.match(functionBody("spawnPopups"), /const now = arenaNow\(\);/);
  assert.match(code, /function drawnYscaleOf\(combatantId, now = arenaNow\(\), extraPending = \[\]\)/);
  assert.match(functionBody("bodiesBesides"), /drawnYscaleOf\(id, arenaNow\(\), extraPending\)/);
  assert.match(code, /window\.addEventListener\("", \(\) => render\(arenaNow\(\)\)\);/, "a resize draws the arena's time");
  // What still reads the page's clock, each for its reason: the asset gate (the arena is not drawn yet),
  // the filter probe's two (a wall-clock measurement), `render`'s default (pinned by the asset-gate test;
  // every caller passes a time), one sound settle (pinned by the sound-wiring test), and the pace itself —
  // its clock between frames, and when a step was submitted.
  assert.equal((code.match(/performance\.now\(\)/g) ?? []).length, 7);
  assert.equal((functionBody("probeCanvasFilter").match(/performance\.now\(\)/g) ?? []).length, 2);
  assert.match(code, /clock: \(\) => performance\.now\(\),/);
  assert.match(begin, /settleEntrySounds\(combatantId, playing\.get\(combatantId\), performance\.now\(\)\);/);
  // And the skip is the clock, never a jump over the engine.
  assert.equal((code.match(/runAiTurns/g) ?? []).length, 0);
});

test("the shell: Shift held and let go, the window's focus lost, and the skip button — each into the pace, then the row redrawn", () => {
  assert.match(code, /for \(const type of \["", ""\]\) \{\s*window\.addEventListener\(type, \(event\) => \{\s*ringPace = ringPaceKeyed\(ringPace, \{ type, key: event\.key \}\);\s*renderRingPace\(\);\s*\}\);\s*\}/);
  assert.match(code, /window\.addEventListener\("", \(\) => \{\s*ringPace = ringPaceKeyed\(ringPace, \{ type: "" \}\);\s*renderRingPace\(\);\s*\}\);/);
  assert.match(raw, /for \(const type of \["keydown", "keyup"\]\)/);
  assert.match(raw, /ringPaceKeyed\(ringPace, \{ type: "blur" \}\)/);
  assert.match(code, /el\(""\)\?\.addEventListener\("", \(\) => \{\s*const before = ringPace;\s*ringPace = ringPaceSkipPressed\(ringPace, ringPaceState\(\)\);/);
  assert.match(raw, /el\("ring-skip"\)\?\.addEventListener\("click"/);
  assert.match(code, /if \(ringPace === before\) return;\s*announce\(ringPace\.skipping/, "the press, on or off, is announced");
  const state = functionBody("ringPaceState");
  assert.match(state, /const ready = host\.readyForNextAction\(\)\.ready;\s*return \{ applies: ringPaceOn && assetGateOpen, turn: seatTurnFor\(host\.battle, seats, \{ ready \}\), ready \};/);
  const row = functionBody("renderRingPace");
  assert.match(row, /const view = ringPaceView\(ringPace, ringPaceState\(\)\);/);
  assert.match(row, /row\.hidden = !view\.offered;/);
  assert.match(row, /if \(!view\.offered && skip && document\.activeElement === skip\) \{\s*if \(ringFocusWanted\?\.row === ""\) ringFocusWanted = null;\s*canvas\.focus\(\);\s*\}/,
    "Skip focused when his turn comes: the focus goes to the stage, not onto one of his actions");
  assert.ok(row.indexOf("canvas.focus();") < row.indexOf("skip.disabled = !view.offered;"), "moved before the button is disabled under it");
  assert.match(row, /skip\.disabled = !view\.offered;/);
  assert.match(row, /skip\.setAttribute\("", String\(view\.skipping\)\);/);
  // Redrawn with the strip, BEFORE the focus it took is given back — so a skip button about to vanish is disabled first.
  const strip = functionBody("renderRingStrip");
  assert.ok(strip.indexOf("ringFocusWanted = {") < strip.indexOf("renderRingPace();"));
  assert.ok(strip.indexOf("renderRingPace();") < strip.indexOf("if (!view) {"));
});

test("the page: the strip's AI row carries the key, the skip button and the pace's words; the stage's name says so", () => {
  assert.match(page, /<div class="ring-row" id="ring-pace" role="group" aria-label="The AI's turns" hidden>/);
  assert.match(page, /<button type="button" id="ring-skip" aria-pressed="false" disabled>Skip to my turn<\/button>/);
  assert.match(page, new RegExp(`Hold <kbd>${RING_PACE_KEY}</kbd> to draw the AI's turns at ${RING_PACE_HELD_RATE}×`));
  // Its words are not a live region: the skip's press is announced once, in the strip's own (`announce`).
  assert.match(page, /<span class="ring-pace-state" id="ring-pace-state"><\/span>/);
  assert.match(page, /#ring-skip\[aria-pressed="true"\]/);
  assert.match(page, /\.ring-row\[hidden\] \{ display: none; \}/, "a row's own display:flex would otherwise beat `hidden`");
  assert.match(page, new RegExp(`While the AI plays, hold ${RING_PACE_KEY} to speed it up, or press Skip to my turn under the stage\\.`));
  // The row is the strip's LAST, so its hiding when his turn is ready moves nothing of his.
  assert.ok(page.indexOf('id="ring-status"') < page.indexOf('id="ring-pace"') && page.indexOf('id="ring-pace"') < page.indexOf('id="ring-descriptions"'));
  assert.match(raw, /`The AI's pace — Shift held draws its turns at \$\{RING_PACE_HELD_RATE\}×/, "the provenance panel names it, at the module's rate");
});
