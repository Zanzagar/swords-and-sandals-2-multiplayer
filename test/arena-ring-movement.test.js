/**
 * MOVEMENT ON THE RING (slice S4 of `docs/design/battle-ui.md`, "The in-battle
 * actions: DECIDED", the owner's Q5): the walks in the build's own slots on the
 * side they move toward, the AUTHORED rank arrows — step back above the head,
 * step forward below the feet — and the arrow keys, which do the same.
 *
 * Seams under test: `ringModelFor`'s `moves` and `offRing`, `ringActionFor`,
 * `ringKeyCommand` and `ringFocusKind` (`tools/arena/ring.js`);
 * `ringMoveButtonsAt` and `ringSlotAt` (`tools/arena/ring-layout.js`);
 * `ringButtonArt` (`tools/arena/ring-art.js`); and, read as text, the lines of
 * `tools/arena/main.js` that hand them to the page.
 *
 * The engine is not mocked where its answer matters: the offer and the stance
 * come off a REAL host. The expected slots come from `SS2_BUTTON_WIRING`
 * (`src/render/action-buttons.js`), transcribed from the action dump apart from
 * the engine's own copy; the expected positions are literals worked by hand.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { SS2_BUTTON_WIRING, SS2_OVERLAY_SLOTS, actionButtonPackFrom } from "../src/render/action-buttons.js";
import { cameraFor, cameraStep, stageClipRectFor, stageFitFor, stageProjectorFor } from "../src/render/arena-backdrop.js";
import { ringActionFor, ringFocusKind, ringKeyCommand, ringModelFor } from "../tools/arena/ring.js";
import { fighterBoxFor, ringButtonsAt, ringButtonsInside, ringMoveButtonsAt, ringPlacementFor, ringSlotAt } from "../tools/arena/ring-layout.js";
import { ringButtonArt } from "../tools/arena/ring-art.js";

const deps = { ss2Combatant, ss2BattleValues };
/** The arena's demo bout, headless: the same roster and rule set `tools/arena/main.js` builds. */
function demoHost({ perSide = 1, seed = 7, kit = "" } = {}) {
  const items = demoItemsFrom(kit);
  return createVanillaBattleHost({
    teams: [demoSide("red", perSide, { ...deps, items, seed }), demoSide("blue", perSide, { ...deps, items, seed })],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed
  });
}
/** The model for whoever is due, read off the host exactly as the shell reads it. */
function modelOf(host, previous = null) {
  const actorId = host.currentCombatantId();
  return ringModelFor({
    actorId,
    combatants: host.wire().teams.flatMap((team) => team.combatants),
    legal: host.legalActions(),
    previous,
    menuFor: (targetId) => host.unavailableActions(actorId, targetId)
  });
}
/** An action as one line, `type -> target`. */
const line = (action) => `${action.type}${action.itemId != null ? `#${action.itemId}` : ""} -> ${action.targetId}`;
/** A model's moves as `move key place slot` lines. */
const moveLines = (model) => model.moves.map((move) => `${move.move} ${move.key} ${move.place} ${move.slot ?? "-"}`);

/* ------------------------------------------------------------------ */
/* 1. Which moves are on the ring, and where                           */
/* ------------------------------------------------------------------ */

test("the 3v3 opening: both walks in the build's own slots, the rank change BACK above the head, and none of them listed", () => {
  const model = modelOf(demoHost({ perSide: 3, seed: 3 }));
  // red-1 is offered walk-left, walk-right, a taunt at blue-1, rank-back, wincrowd and rest (S2's own
  // reading of this turn). `longrange_warrior` facing right wires walkleft at optionB and walkright at
  // optionE (SS2_BUTTON_WIRING), so those two stay in their slots; the rank verb has no build slot.
  assert.deepEqual(moveLines(model), [
    "walk-left ArrowLeft slot optionB",
    "walk-right ArrowRight slot optionE",
    "rank-back ArrowUp above-head -"
  ]);
  assert.deepEqual(model.moves[2].action, { type: "rank-back", targetId: "red-1", actorId: "red-1" });
  assert.equal(model.moves[0].action, model.slots.find((slot) => slot.slot === "optionB").action, "one action, not a copy");
  assert.deepEqual(model.offRing.map((entry) => line(entry.action)), ["rest -> red-1"]);
});

/** Plays the rule set's own AI until turn `turnNumber` is due to `actorId`, or fails. */
function advanceTo(host, turnNumber, actorId) {
  for (let taken = 0; taken < 400 && !host.battle.result; taken += 1) {
    if (host.battle.turnNumber === turnNumber && host.currentCombatantId() === actorId) return host;
    const due = host.currentCombatantId();
    host.submit({ ...host.suggestAction(due), actorId: due });
  }
  assert.fail(`the bout never reached turn ${turnNumber} for ${actorId}`);
}

test("A WALK THE STANCE DOES NOT WIRE — toward a foe inside reach — stands BESIDE the build's walk slot on its side, and its slot keeps its own verb", () => {
  // 3v3 plain seed 2, turn 20: blue-2 with red-3 selected, close, facing right. `closerange_warrior`
  // facing right wires walkleft at optionB and NO walkright: optionE is normal_attack
  // (SS2_BUTTON_WIRING). He stands at x 1 between red-2 (x -84) and red-3 (x 86), both 85 away in
  // his own rank; the engine's nearest foe breaks the tie by id, so red-2 on his LEFT is the one he
  // retreats from, and walk-right is offered — AND the normal attack at red-3, so optionE cannot
  // hold both.
  const host = advanceTo(demoHost({ perSide: 3, seed: 2 }), 20, "blue-2");
  const model = modelOf(host, "red-3");
  assert.deepEqual(model.stance, { frame: "closerange_warrior", range: "close", weapon: "warrior", facing: "right" });
  assert.equal(model.slots.find((slot) => slot.slot === "optionE").verb, "normal_attack");
  const walk = model.moves.find((move) => move.move === "walk-right");
  assert.deepEqual([walk.key, walk.place, walk.slot, walk.verb], ["ArrowRight", "beside", null, "walkright"]);
  assert.deepEqual(walk.action, { type: "walk-right", targetId: "blue-2", actorId: "blue-2" });
  assert.ok(!model.offRing.some((entry) => entry.action.type === "walk-right"), "on the ring, so not listed");
});

test("a stance that wires a walk the engine WITHHOLDS shows it nowhere: not in its slot, not beside, not listed", () => {
  // The same turn: the stance wires walkleft at optionB, and the engine withholds it (the retreat is
  // to the right). Neither rank arrow is withheld here, so both stand, and nothing is listed: ~~the swap
  // is only listed~~ — S6 put the swap on the ring's ninth button (`model.swap`).
  const model = modelOf(advanceTo(demoHost({ perSide: 3, seed: 2 }), 20, "blue-2"), "red-3");
  assert.equal(model.slots.find((slot) => slot.slot === "optionB").verb, null);
  assert.deepEqual(model.moves.map((move) => `${move.move} ${move.place}`),
    ["walk-right beside", "rank-back above-head", "rank-front below-feet"]);
  assert.deepEqual(model.offRing.map((entry) => line(entry.action)), []);
  assert.deepEqual(model.swap.action, { type: "swap-weapons", targetId: "blue-2", actorId: "blue-2" });
});

test("with no ring — the engine has no menu to ask — no move is placed, and every offered move is listed", () => {
  const host = demoHost({ perSide: 3, seed: 3 });
  const actorId = host.currentCombatantId();
  const model = ringModelFor({
    actorId, combatants: host.wire().teams.flatMap((team) => team.combatants), legal: host.legalActions(), menuFor: () => null
  });
  assert.deepEqual(model.moves, []);
  assert.deepEqual(model.offRing.map((entry) => line(entry.action)), host.legalActions().map(line));
});

/* ------------------------------------------------------------------ */
/* 2. What a click, a key and an arrow send                            */
/* ------------------------------------------------------------------ */

test("a move is sent by its arrow key or its name wherever it stands; a withheld one sends nothing", () => {
  const model = modelOf(advanceTo(demoHost({ perSide: 3, seed: 2 }), 20, "blue-2"), "red-3");
  const self = (type) => ({ type, targetId: "blue-2", actorId: "blue-2" });
  assert.deepEqual(ringActionFor(model, "ArrowRight"), self("walk-right"), "beside the ring");
  assert.deepEqual(ringActionFor(model, "walk-right"), self("walk-right"));
  assert.deepEqual(ringActionFor(model, "ArrowUp"), self("rank-back"));
  assert.deepEqual(ringActionFor(model, "rank-back"), self("rank-back"));
  assert.deepEqual(ringActionFor(model, "ArrowDown"), self("rank-front"));
  assert.deepEqual(ringActionFor(model, "rank-front"), self("rank-front"));
  assert.equal(ringActionFor(model, "ArrowLeft"), null, "walk-left is withheld");
  assert.equal(ringActionFor(model, "walk-left"), null);
  // A walk IN its slot is the slot's own action, by the digit, the slot, the arrow and the name.
  const opening = modelOf(demoHost({ perSide: 3, seed: 3 }));
  const left = { type: "walk-left", targetId: "red-1", actorId: "red-1" };
  for (const id of ["2", "optionB", "ArrowLeft", "walk-left"]) assert.deepEqual(ringActionFor(opening, id), left, id);
  assert.equal(ringActionFor(opening, "ArrowDown"), null, "the front rank has no rank in front of it");
});

test("the arrow keys move from the stage or a strip button: one press, one move; a withheld move or a held key is swallowed, not sent", () => {
  const model = modelOf(advanceTo(demoHost({ perSide: 3, seed: 2 }), 20, "blue-2"), "red-3");
  const self = (type) => ({ kind: "act", action: { type, targetId: "blue-2", actorId: "blue-2" } });
  for (const focus of ["stage", "control"]) {
    assert.deepEqual(ringKeyCommand(model, { key: "ArrowRight", focus }), self("walk-right"), focus);
    assert.deepEqual(ringKeyCommand(model, { key: "ArrowUp", focus }), self("rank-back"), focus);
    assert.deepEqual(ringKeyCommand(model, { key: "ArrowDown", focus }), self("rank-front"), focus);
  }
  // Withheld: the key is the ring's (the page must not scroll under the fight), and nothing is sent.
  assert.deepEqual(ringKeyCommand(model, { key: "ArrowLeft", focus: "stage" }), { kind: "ignore", why: "not-offered", move: "walk-left" });
  assert.deepEqual(ringKeyCommand(model, { key: "ArrowUp", focus: "stage", repeat: true }), { kind: "ignore", why: "repeat", move: "rank-back" },
    "holding an arrow moves once");
  // A field that types, a slider or a radio keeps its arrows; a modified arrow is the browser's.
  for (const focus of ["text", "adjust"]) assert.equal(ringKeyCommand(model, { key: "ArrowUp", focus }), null, focus);
  for (const modifier of ["shiftKey", "ctrlKey", "altKey", "metaKey"]) {
    assert.equal(ringKeyCommand(model, { key: "ArrowUp", focus: "stage", [modifier]: true }), null, modifier);
  }
});

test("CODEX PASS 1: an arrow the ring took and is still HELD stays the ring's after the turn it moved has gone — its repeats never reach the page", () => {
  // The press moves the person; the turn goes to the AI and there is no ring (no model). The key is
  // still down, so the browser keeps sending repeats: each is swallowed, not scrolled, and not sent.
  const held = new Set(["ArrowUp"]);
  assert.deepEqual(ringKeyCommand(null, { key: "ArrowUp", repeat: true, held, focus: "stage" }), { kind: "ignore", why: "repeat", move: "rank-back" });
  assert.deepEqual(ringKeyCommand(null, { key: "ArrowUp", repeat: true, held, focus: "control" }), { kind: "ignore", why: "repeat", move: "rank-back" });
  // Anything else with no ring is the browser's: a fresh press, a key the ring did not take, a digit,
  // or a held arrow in a field or a slider.
  assert.equal(ringKeyCommand(null, { key: "ArrowUp", repeat: false, held, focus: "stage" }), null, "a fresh press with no ring");
  assert.equal(ringKeyCommand(null, { key: "ArrowDown", repeat: true, held, focus: "stage" }), null, "not the held key");
  assert.equal(ringKeyCommand(null, { key: "ArrowUp", repeat: true, held: new Set(), focus: "stage" }), null, "nothing held");
  assert.equal(ringKeyCommand(null, { key: "ArrowUp", repeat: true, focus: "stage" }), null, "no hold given");
  assert.equal(ringKeyCommand(null, { key: "5", repeat: true, held: new Set(["5"]), focus: "stage" }), null, "a digit");
  for (const focus of ["text", "adjust"]) assert.equal(ringKeyCommand(null, { key: "ArrowUp", repeat: true, held, focus }), null, focus);
});

test("a slider or a radio button is where the arrows ADJUST: the digits still press the ring there, and Tab and Esc stay the browser's", () => {
  const stage = { tagName: "CANVAS" };
  assert.equal(ringFocusKind({ tagName: "INPUT", type: "range" }, { stage }), "adjust");
  assert.equal(ringFocusKind({ tagName: "INPUT", type: "radio" }, { stage }), "adjust");
  assert.equal(ringFocusKind({ tagName: "INPUT", type: "checkbox" }, { stage }), "control");
  assert.equal(ringFocusKind({ tagName: "BUTTON" }, { stage }), "control");
  const model = modelOf(demoHost({ perSide: 3, seed: 3 }));
  assert.deepEqual(ringKeyCommand(model, { key: "2", focus: "adjust" }),
    { kind: "act", action: { type: "walk-left", targetId: "red-1", actorId: "red-1" } });
  assert.equal(ringKeyCommand(model, { key: "Tab", focus: "adjust" }), null);
  assert.equal(ringKeyCommand(model, { key: "Escape", focus: "adjust" }), null);
});

/* ------------------------------------------------------------------ */
/* 3. Where the moves stand                                            */
/* ------------------------------------------------------------------ */

/** A model with the given moves — the shape `ringModelFor` returns, only what the layout reads. */
function movesModel(moves, frame = "closerange_warrior") {
  return {
    stance: { frame, range: "close", weapon: "warrior", facing: "right" },
    slots: [],
    moves: moves.map(([move, place, slot = null]) => ({
      move,
      key: { "walk-left": "ArrowLeft", "walk-right": "ArrowRight", "rank-back": "ArrowUp", "rank-front": "ArrowDown" }[move],
      verb: { "walk-left": "walkleft", "walk-right": "walkright", "rank-back": "rank_back", "rank-front": "rank_front" }[move],
      place,
      slot,
      action: { type: move }
    }))
  };
}
const round = (value) => Math.round(value * 10) / 10;
const row = ({ slot, verb, key, x, y, r }) => [slot, verb, key, round(x), round(y), round(r)];

test("THE MOVES' PLACES, worked by hand: a walk beside its side's walk slot, one pitch in; back above the head; forward below the feet", () => {
  // The relayed slots (SS2_OVERLAY_SLOTS): optionB (-64.2, -8.1) and optionE (66.1, -8.1), both at scale 0.8.
  // The ring's tightest pitch is B-C and E-F, 31.5 (A-B is 31.76, D-E 31.89), so a walk beside B stands at
  // x -32.7 and beside E at 34.6; its radius is the slots' own, 18 * 0.8. The gap the ring leaves between
  // two buttons, 31.5 - 2 * 14.4 = 2.7, is the gap between the head or the feet and a rank arrow.
  const model = movesModel([["walk-left", "beside"], ["walk-right", "beside"], ["rank-back", "above-head"], ["rank-front", "below-feet"]]);
  const buttons = ringMoveButtonsAt(model, { centerX: 100, centerY: 200, unit: 2, head: 150, feet: 320 });
  assert.deepEqual(buttons.map(row), [
    // 100 + 2 * -32.7, 200 + 2 * -8.1, 2 * 14.4
    ["walk-left", "walkleft", "ArrowLeft", 34.6, 183.8, 28.8],
    // 100 + 2 * 34.6
    ["walk-right", "walkright", "ArrowRight", 169.2, 183.8, 28.8],
    // 150 - 2 * 2.7 - 28.8
    ["rank-back", "rank_back", "ArrowUp", 100, 115.8, 28.8],
    // 320 + 2 * 2.7 + 28.8
    ["rank-front", "rank_front", "ArrowDown", 100, 354.2, 28.8]
  ]);
  assert.deepEqual(buttons.map((button) => button.side), ["left", "right", "centre", "centre"]);
});

test("a walk IN its slot is the slot's button, drawn by ringButtonsAt, and gets no second one", () => {
  const model = movesModel([["walk-left", "slot", "optionB"], ["rank-back", "above-head"]]);
  assert.deepEqual(ringMoveButtonsAt(model, { centerX: 0, centerY: 0, unit: 1, head: -40, feet: 180 }).map((button) => button.slot), ["rank-back"]);
  assert.deepEqual(ringMoveButtonsAt({ ...model, moves: [] }, { centerX: 0, centerY: 0, unit: 1, head: -40, feet: 180 }), []);
});

test("a rank arrow that would leave the canvas stays on it, whatever the fighter's size", () => {
  const model = movesModel([["rank-back", "above-head"], ["rank-front", "below-feet"]]);
  const buttons = ringMoveButtonsAt(model, { centerX: 100, centerY: 200, unit: 2, head: 40, feet: 380, bounds: { top: 0, bottom: 400 } });
  // Unclamped they would stand at 5.8 and 414.2; each is held a radius inside the edge.
  assert.deepEqual(buttons.map((button) => round(button.y)), [28.8, 371.2]);
});

test("a click on a move's button hits that move, and sends it; a hover names it", () => {
  const host = advanceTo(demoHost({ perSide: 3, seed: 2 }), 20, "blue-2");
  const model = modelOf(host, "red-3");
  const buttons = [
    ...ringButtonsAt(model, { centerX: 300, centerY: 200, unit: 1.2 }),
    ...ringMoveButtonsAt(model, { centerX: 300, centerY: 200, unit: 1.2, head: 190, feet: 330 })
  ];
  for (const move of model.moves) {
    const button = buttons.find((candidate) => candidate.slot === move.move);
    assert.ok(button, `${move.move} is drawn`);
    const hit = ringSlotAt(buttons, button.x, button.y);
    assert.equal(hit, move.move);
    assert.deepEqual(ringActionFor(model, hit), move.action);
  }
});

test("CODEX PASS 2: a ring that would leave the stage is moved back onto it WHOLE — every button by the same amount, so nothing overlaps that did not before", () => {
  const stage = { x: 0, y: 10, width: 640, height: 420 };
  const b = (slot, x, y, r) => ({ slot, x, y, r });
  // The left column off the stage's left edge by 22.29 + 17.28 px: everything moves right by 39.57.
  const moved = ringButtonsInside([b("optionB", -22.29, 160.52, 17.28), b("optionE", 134.07, 160.52, 17.28), b("rank-back", 54.75, 100, 17.28)], stage);
  assert.deepEqual(moved.map(({ slot, x, y }) => [slot, round(x), round(y)]), [["optionB", 17.3, 160.5], ["optionE", 173.6, 160.5], ["rank-back", 94.3, 100]]);
  // Off the right edge and off the top: back by the overshoot on each axis.
  const corner = ringButtonsInside([b("optionD", 630, 15, 12), b("optionH", 600, 60, 12)], stage);
  assert.deepEqual(corner.map(({ x, y }) => [round(x), round(y)]), [[628, 22], [598, 67]]);
  // Already inside: the very same buttons.
  const inside = [b("optionA", 100, 100, 10)];
  assert.equal(ringButtonsInside(inside, stage), inside);
  assert.deepEqual(ringButtonsInside([], stage), []);
});

test("CODEX PASS 2, the arena's own case: 3v3 plain seed 1, red-3 at the stage's left edge — his walk-left is on the stage, and a click on it walks him", () => {
  const host = demoHost({ perSide: 3, seed: 1 });
  for (let step = 0; step < 4; step += 1) {
    const due = host.currentCombatantId();
    host.submit({ ...host.suggestAction(due), actorId: due });
  }
  const model = modelOf(host);
  assert.equal(model.actorId, "red-3");
  const { buttons, stage, camera } = arenaButtons(host, model);
  // The team camera settles at 52; unmoved, optionB (his walk-left) was centred at x -22.29, radius 17.28.
  assert.equal(camera.maxscale, 52);
  const walk = buttons.find((button) => button.slot === "optionB");
  assert.equal(walk.verb, "walkleft");
  assert.ok(walk.x - walk.r >= stage.x - 1e-9, `walk-left's left edge at ${walk.x - walk.r}`);
  assert.deepEqual(ringActionFor(model, ringSlotAt(buttons, walk.x, walk.y)), { type: "walk-left", targetId: "red-3", actorId: "red-3" });
});

/* ------------------------------------------------------------------ */
/* 4. The premise, and the acceptance over whole bouts                 */
/* ------------------------------------------------------------------ */

test("THE PREMISE: the build wires every walk in one slot, on the side it moves toward — walkleft at optionB, walkright at optionE", () => {
  const seen = { walkleft: new Set(), walkright: new Set() };
  let wired = 0;
  for (const record of Object.values(SS2_BUTTON_WIRING)) {
    for (const facing of ["right", "left"]) {
      for (const [slot, wires] of Object.entries(record[facing])) {
        for (const one of wires) if (seen[one.verb]) { seen[one.verb].add(slot); wired += 1; }
      }
    }
  }
  assert.deepEqual([...seen.walkleft], ["optionB"]);
  assert.deepEqual([...seen.walkright], ["optionE"]);
  // Six of the eight stance-and-facing rows wire each walk: the close frames wire only the retreat.
  assert.equal(wired, 12);
  assert.ok(SS2_OVERLAY_SLOTS.optionB.x < 0 && SS2_OVERLAY_SLOTS.optionE.x > 0, "left of the fighter, and right of him");
});

/** The four moves' identities, for comparing with the offer. */
const MOVE_TYPES = ["walk-left", "walk-right", "rank-back", "rank-front"];
const ARROW = { "walk-left": "ArrowLeft", "walk-right": "ArrowRight", "rank-back": "ArrowUp", "rank-front": "ArrowDown" };
/**
 * THE ARENA'S OWN GEOMETRY for whoever is due: its camera fed every placed fighter as `{x, side}`, as
 * `placedActors()` in `tools/arena/main.js` feeds it, run until it settles; the 640x420 stage and its
 * clip; and the ring's buttons for `model`, placed as `paintRing` places them — the acting fighter's
 * drawn head and the bottom of his name, then everything kept inside the stage.
 */
function arenaButtons(host, model) {
  const everyone = host.wire().teams.flatMap((team) => team.combatants);
  const xs = everyone.filter((c) => Number.isFinite(c.x)).map((c) => ({ x: c.x, side: host.layout.placementFor(c.id)?.side ?? null }));
  let camera = cameraFor(xs);
  for (let step = 0; step < 300; step += 1) camera = cameraStep(camera, xs);
  const fit = stageFitFor({ width: 640, height: 420 });
  const view = stageProjectorFor(camera, fit);
  const stage = stageClipRectFor(fit);
  const actor = everyone.find((c) => c.id === model.actorId);
  const placement = ringPlacementFor({ actor, foe: everyone.find((c) => c.id === model.selectedId), camera, view, fit });
  const box = fighterBoxFor({ footX: view.toX(actor.x), footY: view.toY(actor.y, 0), pxPerUnit: view.scale });
  const below = view.toY(actor.y, -22) + Math.max(10, view.scale * 15) * 0.5;
  const at = { centerX: placement.x, centerY: placement.y, unit: placement.unit };
  const buttons = ringButtonsInside([
    ...ringButtonsAt(model, at),
    ...ringMoveButtonsAt(model, { ...at, head: box.y0, feet: below, bounds: { top: stage.y, bottom: stage.y + stage.height } })
  ], stage);
  return { buttons, stage, camera };
}

test("ACCEPTANCE, over whole bouts with every foe selected in turn, under the arena's own camera: every walk and rank change the engine offers is drawn once, inside the stage, and sent by its click and its arrow; none it withholds is drawn, clicked or keyed; no two buttons overlap", (t) => {
  const tally = { turns: 0, selections: 0, offered: 0, withheld: 0, teamCamera: 0 };
  const placed = new Map();
  for (const perSide of [1, 2, 3]) {
    for (const kit of ["", "tricks"]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const host = demoHost({ perSide, seed, kit });
        for (let taken = 0; !host.battle.result && taken < 1500; taken += 1) {
          const actorId = host.currentCombatantId();
          const offer = host.legalActions();
          const first = modelOf(host);
          for (const foeId of first.foeIds) {
            const model = modelOf(host, foeId);
            const { buttons, stage, camera } = arenaButtons(host, model);
            if (camera.team) tally.teamCamera += 1;
            const where = `${perSide}v${perSide} ${kit || "plain"} seed ${seed} turn ${taken}: ${actorId} vs ${foeId}`;
            // A button moved onto the stage has its edge ON the stage's edge, to rounding.
            const EPS = 1e-9;
            for (const button of buttons) {
              assert.ok(button.x - button.r >= stage.x - EPS && button.x + button.r <= stage.x + stage.width + EPS
                && button.y - button.r >= stage.y - EPS && button.y + button.r <= stage.y + stage.height + EPS,
              `${where}: ${button.slot} at (${button.x.toFixed(1)}, ${button.y.toFixed(1)}) r ${button.r.toFixed(1)} leaves the stage`);
            }
            for (const type of MOVE_TYPES) {
              const option = offer.find((candidate) => candidate.type === type);
              // What the ring would send for this move, by each route a person has.
              const drawn = buttons.filter((button) => ringActionFor(model, button.slot)?.type === type);
              const keyed = ringKeyCommand(model, { key: ARROW[type], focus: "stage" });
              if (option) {
                tally.offered += 1;
                assert.equal(drawn.length, 1, `${where}: offered ${type} is drawn ${drawn.length} times`);
                const hit = ringSlotAt(buttons, drawn[0].x, drawn[0].y);
                assert.deepEqual(ringActionFor(model, hit), { ...option, actorId }, `${where}: a click on ${type}`);
                assert.deepEqual(keyed, { kind: "act", action: { ...option, actorId } }, `${where}: ${ARROW[type]}`);
                assert.ok(!model.offRing.some((entry) => entry.action.type === type), `${where}: ${type} also listed`);
                const move = model.moves.find((candidate) => candidate.move === type);
                placed.set(`${type} ${move.place}`, (placed.get(`${type} ${move.place}`) ?? 0) + 1);
              } else {
                tally.withheld += 1;
                assert.equal(drawn.length, 0, `${where}: withheld ${type} is drawn`);
                assert.equal(ringActionFor(model, type), null, `${where}: withheld ${type} can be sent`);
                assert.deepEqual(keyed, { kind: "ignore", why: "not-offered", move: type }, `${where}: ${ARROW[type]} on a withheld move`);
              }
            }
            for (const a of buttons) {
              for (const b of buttons) {
                if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r, `${where}: ${a.slot} overlaps ${b.slot}`);
              }
            }
            tally.selections += 1;
          }
          tally.turns += 1;
          host.submit({ ...host.suggestAction(actorId), actorId });
        }
        assert.ok(host.battle.result, `${perSide}v${perSide} ${kit || "plain"} seed ${seed} finished`);
      }
    }
  }
  // Every place a move can stand was reached: both walks in their slots and beside, and both rank arrows.
  for (const needed of ["walk-left slot", "walk-right slot", "walk-left beside", "walk-right beside", "rank-back above-head", "rank-front below-feet"]) {
    assert.ok((placed.get(needed) ?? 0) > 0, `${needed} never happened: ${JSON.stringify([...placed])}`);
  }
  assert.ok(tally.withheld > 0 && tally.offered > tally.selections && tally.teamCamera > 0, JSON.stringify(tally));
  t.diagnostic(JSON.stringify({ ...tally, placed: Object.fromEntries([...placed].sort()) }));
});

/* ------------------------------------------------------------------ */
/* 5. What the moves draw                                              */
/* ------------------------------------------------------------------ */

/**
 * An icons pack shaped as `tools/extract-icons.mjs` writes it, reduced to what a move reads: 860 with its
 * `battlebutton` (826) on every frame, and on frames 2..41 one icon whose fill NAMES the frame.
 */
function iconsPack() {
  const square = (fill) => ({ bounds: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 }, paths: [{ d: "M0 0L10 0L10 10L0 10Z", fill, fillOpacity: 1 }] });
  const place = (kind, character, extra = {}) => ({ kind, character, matrix: [1, 0, 0, 1, 0, 0], ...extra });
  const shapes = { 824: square("#403020"), 825: square("#f0c040") };
  const frames = Array.from({ length: 41 }, (unused, index) => {
    const frame = index + 1;
    const background = place("clip", 826, { name: "battlebutton", frameCount: 2 });
    if (frame === 1) return [background];
    shapes[2000 + frame] = square(`#0000${frame.toString(16).padStart(2, "0")}`);
    return [background, place("shape", 2000 + frame)];
  });
  return {
    shapes,
    texts: {},
    buttons: {
      button: 860,
      clips: { 860: { character: 860, frames } },
      nested: { 826: { character: 826, instances: ["battlebutton"], frames: [[place("shape", 824)], [place("shape", 825)]] } }
    }
  };
}
/** The 860 frame a drawn button's icon comes from, read back off its fill. */
const iconFrame = (button) => {
  const icon = button.ops.filter((op) => op.kind === "path").map((op) => op.fill).find((fill) => fill.startsWith("#0000"));
  return icon ? parseInt(icon.slice(5), 16) : null;
};
/** Which way an authored chevron points: its middle vertex above its ends is "up". */
const chevron = (button) => {
  const glyph = button.ops.find((op) => op.button === "glyph");
  const ys = [...glyph.d.matchAll(/[ML]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)].map((match) => Number(match[2]));
  assert.equal(ys.length, 3, glyph.d);
  return ys[1] < ys[0] && ys[1] < ys[2] ? "up" : ys[1] > ys[0] && ys[1] > ys[2] ? "down" : "neither";
};

test("A WALK BESIDE THE RING draws the build's own walk icon (6 left, 9 right); the rank arrows are the authored chevrons, back pointing up and forward down", () => {
  const pack = actionButtonPackFrom(iconsPack());
  const model = movesModel([["walk-left", "beside"], ["walk-right", "beside"], ["rank-back", "above-head"], ["rank-front", "below-feet"]]);
  const placedButtons = ringMoveButtonsAt(model, { centerX: 0, centerY: 0, unit: 1, head: -40, feet: 180 });
  const drawn = ringButtonArt(placedButtons, { pack, facing: "right", hoverSlot: "rank-back" });
  assert.deepEqual(drawn.map((button) => [button.slot, button.source, button.state]), [
    ["walk-left", "build", "normal"],
    ["walk-right", "build", "normal"],
    ["rank-back", "authored", "hover"],
    ["rank-front", "authored", "normal"]
  ]);
  assert.deepEqual(drawn.slice(0, 2).map(iconFrame), [6, 9]);
  assert.deepEqual(drawn.slice(2).map(chevron), ["up", "down"]);
  assert.ok(drawn[2].ops.some((op) => op.button === "halo"), "the hovered arrow takes the fallback's hover look");
  // Without a pack every move is the authored button, the walks' glyph pointing their own way.
  const bare = ringButtonArt(placedButtons, { pack: null, facing: "right" });
  assert.deepEqual(bare.map((button) => button.source), ["authored", "authored", "authored", "authored"]);
});

/* ------------------------------------------------------------------ */
/* 6. The shell hands them to the page (read as text)                  */
/* ------------------------------------------------------------------ */

/**
 * `tools/arena/main.js` cannot be imported by node, so — as
 * `test/arena-ring-wiring.test.js` and `test/arena-ring-art.test.js` do — the
 * few lines that hand the moves to the canvas, the keys and the strip are
 * pinned as text, comments and strings blanked first.
 */
const rawShell = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
const rawPage = fs.readFileSync(new URL("../tools/arena/index.html", import.meta.url), "utf8");
const shell = rawShell
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
function functionBody(name) {
  const start = shell.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is not defined in tools/arena/main.js`);
  let depth = 0;
  for (let index = shell.indexOf("{", start); index < shell.length; index += 1) {
    if (shell[index] === "{") depth += 1;
    else if (shell[index] === "}") { depth -= 1; if (depth === 0) return shell.slice(start, index + 1); }
  }
  throw new Error(`${name}'s braces do not balance`);
}

test("the shell draws the moves with the ring, off the acting fighter's DRAWN head and what is drawn under his feet, and clicks what it drew", () => {
  const stage = functionBody("renderStage");
  // The acting fighter's head is his click box's top; under his feet is his name, whose bottom is
  // what the forward arrow clears.
  assert.match(stage, /const nameY = view\.toY\(origin\.y, -22\);/);
  assert.match(stage, /context\.fillText\(combatant\.name, view\.toX\(origin\.x\), nameY\);/, "the name is drawn where the ring reads it");
  assert.match(stage, /ringOrigins\.actor = \{ x: origin\.x, y: origin\.y, head: box\.y0, below: nameY \+ namePx \* 0\.5 \};/);
  const paint = functionBody("paintRing");
  assert.match(paint, /ringMoveButtonsAt\(ringView\.model, \{[^}]*centerX: placement\.x,[^}]*centerY: placement\.y,[^}]*unit: placement\.unit,[^}]*layout: ringButtonPack\?\.layout \?\? null,[^}]*head: ringOrigins\.actor\.head,[^}]*feet: ringOrigins\.actor\.below,[^}]*bounds: \{ top: stage\.y, bottom: stage\.y \+ stage\.height \}/);
  // CODEX PASS 2: the whole ring, moves included, kept on the visible stage — the rectangle the frame is clipped to.
  assert.match(paint, /const stage = stageClipRectFor\(fit\);/);
  assert.match(paint, /const buttons = ringButtonsInside\(\[\s*\.\.\.ringButtonsAt\(/, "the eight first, all kept on the stage");
  assert.match(paint, /\.\.\.ringMoveButtonsAt\([\s\S]*?\}\)\s*\], stage\);/);
  assert.match(paint, /ringButtons = buttons;/, "the click is tested against every button drawn, the moves included");
  assert.match(paint, /if \(button\.move\) continue;/, "a move carries no key label on the stage: its arrow is its glyph");
});

test("the keys: an arrow the ring swallows is kept from the page and sends nothing, and one it took stays its own until it is let go", () => {
  const keydown = shell.slice(shell.indexOf("const command = ringKeyCommand(ringView.model, {"));
  assert.match(keydown, /if \(!command\) return;\s*event\.preventDefault\(\);/);
  assert.match(keydown, /else if \(command\.kind === ""\) \{[^}]*announce\(/, "a withheld move is said, not sent");
  const handler = keydown.slice(0, keydown.indexOf("\n});"));
  assert.equal((handler.match(/actFromRing\(/g) ?? []).length, 1, "only an act acts");
  assert.ok(rawShell.includes('else if (command.kind === "ignore") {'));
  assert.match(rawPage, /aria-label="[^"]*arrow keys[^"]*"/i, "the stage's own name tells a screen reader the arrows move");
  // CODEX PASS 1: with no ring on screen, a held arrow's repeats still go to the ring's key rule, which
  // swallows them only while the ring's press is held; a key the ring took is let go on keyup or blur.
  const listener = shell.slice(shell.indexOf('window.addEventListener("", (event) => {\n  const pressed = {'));
  assert.match(listener, /if \(!ringView\) \{\s*if \(ringKeyCommand\(null, pressed\)\) event\.preventDefault\(\);\s*return;\s*\}/);
  assert.match(listener, /held: ringHeldKeys/);
  assert.match(listener, /event\.preventDefault\(\);\s*if \(RING_KEY_GLYPHS\[event\.key\]\) ringHeldKeys\.add\(event\.key\);/,
    "an arrow the ring took is held from here");
  assert.match(shell, /window\.addEventListener\("", \(event\) => ringHeldKeys\.delete\(event\.key\)\);/);
  assert.match(shell, /window\.addEventListener\("", \(\) => ringHeldKeys\.clear\(\)\);/);
  assert.ok(rawShell.includes('window.addEventListener("keyup", (event) => ringHeldKeys.delete(event.key));'));
  assert.ok(rawShell.includes('window.addEventListener("blur", () => ringHeldKeys.clear());'));
});

test("the strip lists every move on the ring once, with its arrow key: a walk in its slot carries its digit and its arrow", () => {
  const strip = functionBody("renderRingStrip");
  assert.match(strip, /model\.moves\.filter\(\(move\) => move\.place !== ""\)/, "moves no slot holds, after the eight");
  assert.match(strip, /model\.moves\.find\(\(move\) => move\.slot === slot\.slot\)\?\.key/, "a walk in its slot takes its arrow too");
  assert.match(strip, /slotRow\.replaceChildren\([\s\S]*?\.\.\.unslotted\.map\(\(move\) => actionButton\(move\.action, \{ verb: move\.verb, keys: \[move\.key\] \}\)\)\)/,
    "each move no slot holds is a strip button with its arrow, in the ring row");
  assert.match(strip, /hint\.textContent = RING_KEY_GLYPHS\[key\] \?\? key;/, "an arrow is written as the arrow");
  assert.match(strip, /button\.setAttribute\("", keys\.join\(""\)\);/);
  assert.ok(rawShell.includes('button.setAttribute("aria-keyshortcuts", keys.join(" "));'), "every key the button answers to, for a screen reader");
  assert.ok(rawShell.includes("`${filled.length + unslotted.length} on the ring"), "a turn's announcement counts the moves on the ring");
  assert.ok(rawShell.includes('model.moves.filter((move) => move.place !== "slot")'));
});
