/**
 * THE WALKS AT THE STAGE'S EDGES (ring2, slice "edge"; the owner's Q5 in
 * `docs/design/battle-ui.md`: walk left and right "on the side they move
 * toward"). S4 kept the ring on the stage by moving the WHOLE set, which at a
 * stage edge carried a walk across the fighter it moves: a write-nothing
 * verifier found, under the arena's settled camera, a walk-left drawn at
 * canvas x 116.2 for a fighter drawn at 53 (3v3 tricks seed 1 turn 9, red-2,
 * 1280x840).
 *
 * Seams under test: `ringButtonsInside` (`tools/arena/ring-layout.js`), with
 * `ringButtonsAt`, `ringItemButtonsAt`, `ringSwapButtonAt` and
 * `ringMoveButtonsAt` building its input; `ringLabelAt` and `ringLabelBoxOf`,
 * which keep a key label on the stage and off the labels before it (Codex
 * review, pass 1); and, read as text, the lines of `tools/arena/main.js` that
 * hand them the fighter's drawn centre, the stage and those labels.
 *
 * Expected positions are literals worked by hand from the inputs each test
 * states; the bouts come off a REAL host, never a mock.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { SS2_ARENA, ss2BattleValues, ss2Combatant, ss2PhysicalSize, ss2TeamRules } from "../src/team/ss2-rules.js";
import { resourceValue } from "../src/team/resources.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { ringActionFor, ringModelFor } from "../tools/arena/ring.js";
import {
  fighterBoxFor,
  ringButtonsAt,
  ringButtonsInside,
  ringItemButtonsAt,
  ringLabelAt,
  ringLabelBoxOf,
  ringLabelSizeFor,
  ringMoveButtonsAt,
  ringPlacementFor,
  ringSlotAt,
  ringSwapButtonAt
} from "../tools/arena/ring-layout.js";
import { actorSpanFor, stageClipRectFor, stageFitFor, stageProjectorFor, stepFramedCamera } from "../src/render/arena-backdrop.js";
import { rankOfDepth } from "../src/render/arena-shell.js";
import { figureScaleFor } from "../src/render/figure.js";
import { ss2ColossusYscaleAfter } from "../src/common/ss2-figure.js";

const round = (value) => Math.round(value * 100) / 100;
const b = (slot, verb, x, y, r, extra = {}) => ({ slot, verb, x, y, r, ...extra });
const at = (buttons) => buttons.map(({ slot, x, y }) => [slot, round(x), round(y)]);

test("THE VERIFIER'S WORST CASE: the walk-left beside the ring stays LEFT of the fighter it moves, flush with the stage's edge, while the rest of the ring moves on", () => {
  // 3v3 tricks seed 1, turn 9, red-2 with blue-3 selected (the verifier's own policy got there; its
  // inputs replayed and dumped): closerange_warrior facing left, drawn at canvas x 52.96 on a
  // 1280x840 canvas (stage 0..1280), unit 1.92, the relayed table. On offer: walkright in optionE,
  // wincrowd in optionH, the swap, walk-left BESIDE optionB (which holds nothing here), both rank
  // arrows. Unmoved, the swap's left edge is at -105.34 - 20.74 = -126.08, so the ring must move
  // right by 126.08 — which took the walk-left from -9.82 to 116.26, 63.3 px right of him.
  const stage = { x: 0, y: 0, width: 1280, height: 840 };
  const raw = [
    b("optionE", "walkright", 179.87, 511.09, 27.65),
    b("optionH", "wincrowd", 158.56, 629.17, 27.65),
    b("swap_inventory", "swap_weapons", -105.34, 625.23, 20.74),
    b("walk-left", "walkleft", -9.82, 511.09, 27.65, { move: "walk-left" }),
    b("rank-back", "rank_back", 52.96, 481.01, 27.65, { move: "rank-back" }),
    b("rank-front", "rank_front", 52.96, 629.11, 27.65, { move: "rank-front" })
  ];
  const inside = ringButtonsInside(raw, stage, { fighterX: 52.96 });
  assert.deepEqual(at(inside), [
    // every other button by the ring's own 126.08
    ["optionE", 305.95, 511.09],
    ["optionH", 284.64, 629.17],
    ["swap_inventory", 20.74, 625.23],
    // his side of him, as far from him as the stage allows: its radius in from the edge. The
    // whole disc cannot be on his side — he is drawn 52.96 from the edge, under a diameter.
    ["walk-left", 27.65, 511.09],
    ["rank-back", 179.04, 481.01],
    ["rank-front", 179.04, 629.11]
  ]);
});

test("a walk kept on its side that would land on another button: the rest of the ring moves on past it, by the least that clears it", () => {
  // Worked by hand, 640x420 stage. A beside walk-left one pitch in from optionB, which holds a swing;
  // the fighter drawn at x 60. The ring's left edge is at -60, so it moves right by 60: the walk to
  // 80, 20 right of him. Kept on his side it stands at 60 - 20 = 40 — where optionB, moved to 20,
  // would cover it. So everything but the walk moves on until optionB clears it by the two radii:
  // 40 + 40 = 80, another 60.
  const stage = { x: 0, y: 0, width: 640, height: 420 };
  const inside = ringButtonsInside([
    b("optionB", "normal_attack", -40, 200, 20),
    b("walk-left", "walkleft", 20, 200, 20, { move: "walk-left" }),
    b("optionE", "walkright", 120, 200, 20)
  ], stage, { fighterX: 60 });
  assert.deepEqual(at(inside), [["optionB", 80, 200], ["walk-left", 40, 200], ["optionE", 240, 200]]);
});

test("the same at the RIGHT edge of a pillarboxed stage; and a fighter drawn within one radius of the edge has no place on the stage on his side, so his walk stands flush with it", () => {
  // Worked by hand. The stage is 640 wide from x 100 (a canvas wider than the stage's 640:420), so
  // its right edge is 740. optionF's right edge is at 810: the ring moves LEFT by 70.
  const stage = { x: 100, y: 0, width: 640, height: 420 };
  const ring = [
    b("optionB", "walkleft", 570, 200, 20),
    b("optionE", "walkright", 760, 200, 20),
    b("optionF", "quick_attack", 790, 245, 20)
  ];
  // Drawn at 690, his walk-right would move to 690 — onto his centre. Kept on his side: 690 + 20 =
  // 710. optionF, 45 lower, is out of its reach (40): nothing else moves on.
  assert.deepEqual(at(ringButtonsInside(ring, stage, { fighterX: 690 })), [["optionB", 500, 200], ["optionE", 710, 200], ["optionF", 720, 245]]);
  // Drawn at 730, ten from the edge: a disc of radius 20 on the stage has its centre at 720 at most,
  // left of him whatever is done. It stands there, flush with the edge — as far to his right as
  // the stage allows — and the stage wins: no button leaves it.
  assert.deepEqual(at(ringButtonsInside(ring, stage, { fighterX: 730 })), [["optionB", 500, 200], ["optionE", 720, 200], ["optionF", 720, 245]]);
});

test("only the ring's SIDEWAYS move is held back: a ring moved only up or down keeps every walk where the ring puts it, and one that moves AWAY from the fighter goes with it", () => {
  const stage = { x: 0, y: 0, width: 640, height: 420 };
  // Off the top by 10: down by 10, nothing sideways. The walk-left's disc here reaches past his centre
  // (hand-made: the build's own places never do), and a move down is not the ring's to correct.
  const down = ringButtonsInside([b("optionB", "walkleft", 300, 10, 20), b("optionE", "walkright", 400, 100, 20)], stage, { fighterX: 310 });
  assert.deepEqual(at(down), [["optionB", 300, 20], ["optionE", 400, 110]]);
  // Off the left edge by 30: right by 30, which carries the walk-right further right of him — his side.
  const right = ringButtonsInside([b("optionB", "walkleft", -10, 200, 20), b("optionE", "walkright", 140, 200, 20)], stage, { fighterX: 65 });
  assert.deepEqual(at(right), [["optionB", 20, 200], ["optionE", 170, 200]]);
});

/* ------------------------------------------------------------------ */
/* The arena's own bouts, under the arena's own camera                 */
/* ------------------------------------------------------------------ */

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
/** The `_yscale` a fighter is built at, his colossus or little-fat-kid spell applied (S5's reading). */
function yscaleOf(host, id) {
  const record = host.combatant(id);
  const built = ss2PhysicalSize(record);
  return resourceValue(record, "spell_colossus", 0) > 0 ? ss2ColossusYscaleAfter(built, 100)
    : resourceValue(record, "spell_little_fat_kid", 0) > 0 ? 50 : built;
}
/**
 * THE ARENA'S OWN GEOMETRY for whoever is due, as `tools/arena/main.js` draws it: its camera —
 * `stepFramedCamera`, fed every placed fighter as `placedActors()` feeds it, nobody mid-clip, run
 * until it settles — on a 640x420 stage, and every button `paintRing` gathers (the eight, the items
 * row, the swap, the moves), kept on the stage with the acting fighter's DRAWN centre.
 */
function arenaCamera(host) {
  const roster = host.wire().teams.flatMap((team) => team.combatants).filter((c) => Number.isFinite(c.x)).map((c) => {
    const placement = host.layout.placementFor(c.id);
    return {
      id: c.id, x: c.x, y: c.y, yscale: yscaleOf(host, c.id), ...actorSpanFor({ x: c.x, y: c.y }, null),
      side: placement?.side ?? null, teamId: placement?.teamId ?? null, alive: c.alive !== false, drawing: false
    };
  });
  let frame = null;
  for (let step = 0; step < 300; step += 1) frame = stepFramedCamera(frame, roster, { result: host.battle.result ?? null });
  return frame.camera;
}
function arenaButtons(host, model, camera = arenaCamera(host)) {
  const everyone = host.wire().teams.flatMap((team) => team.combatants);
  const fit = stageFitFor({ width: 640, height: 420 });
  const view = stageProjectorFor(camera, fit);
  const stage = stageClipRectFor(fit);
  const actor = everyone.find((c) => c.id === model.actorId);
  const placement = ringPlacementFor({ actor, foe: everyone.find((c) => c.id === model.selectedId), camera, view, fit });
  const size = figureScaleFor({
    yscale: yscaleOf(host, actor.id),
    rank: rankOfDepth(actor.y, actor.slotIndex, { frontY: 200, rankStride: SS2_ARENA.rankStride }),
    slotIndex: actor.slotIndex
  });
  const box = fighterBoxFor({ footX: view.toX(actor.x), footY: view.toY(actor.y, 0), pxPerUnit: view.scale, size });
  const below = view.toY(actor.y, -22) + Math.max(10, view.scale * 15) * 0.5;
  const at = { centerX: placement.x, centerY: placement.y, unit: placement.unit };
  const bounds = { top: stage.y, bottom: stage.y + stage.height };
  const raw = [
    ...ringButtonsAt(model, at),
    ...ringItemButtonsAt(model, { ...at, head: box.y0, bounds }),
    ...ringSwapButtonAt(model, at),
    ...ringMoveButtonsAt(model, { ...at, head: box.y0, feet: below, bounds })
  ];
  const buttons = ringButtonsInside(raw, stage, { fighterX: placement.x });
  // What S4's rule — every button by the same amount — drew instead: a walk this slice holds differs.
  const whole = ringButtonsInside(raw, stage);
  const held = new Set(buttons.filter((button, index) => Math.abs(button.x - whole[index].x) > 1e-6).map((button) => button.slot));
  return { buttons, stage, fighterX: placement.x, held };
}
/** Plays the rule set's own AI for `turns` submissions. */
function played(host, turns) {
  for (let taken = 0; taken < turns; taken += 1) {
    const due = host.currentCombatantId();
    host.submit({ ...host.suggestAction(due), actorId: due });
  }
  return host;
}

test("THE ARENA'S OWN CASE: 2v2 tricks seed 3, red-2 drawn 19.16 px from the stage's left edge — his walk-left stands left of him, flush with the edge, and a click on it walks him left", () => {
  // Reached by the rule set's own AI (18 submissions), nobody down yet, so the arena's camera is the
  // build's own. His ring is pushed right by the swap at its lower left; unkept, his walk-left in
  // optionB was drawn at 27.89, 8.73 px RIGHT of him (a scratch replay of this turn, base 2ba96c3).
  const host = played(demoHost({ perSide: 2, seed: 3, kit: "tricks" }), 18);
  const model = modelOf(host, "blue-1");
  assert.equal(model.actorId, "red-2");
  assert.ok(model.swap, "the swap is on offer: it is what pushes the ring");
  const { buttons, stage, fighterX } = arenaButtons(host, model);
  assert.equal(round(fighterX), 19.16);
  const walk = buttons.find((button) => button.slot === "optionB");
  assert.equal(walk.verb, "walkleft");
  // Under a diameter from the edge, his whole disc cannot be on his side; its centre is, as far left as the stage allows.
  assert.equal(round(walk.r), 13.82);
  assert.equal(round(walk.x), 13.82);
  assert.equal(walk.x - walk.r, stage.x);
  assert.deepEqual(ringActionFor(model, ringSlotAt(buttons, walk.x, walk.y)), { type: "walk-left", targetId: "red-2", actorId: "red-2" });
});

test("CODEX PASS 1: the walk held flush with the edge keeps its key label on the stage — ~~under it~~ over it (S9), slid onto the stage, clear of every button", () => {
  // The same turn. Held at x 13.82 (its radius), optionB's label on the ring's outer side would end at
  // 13.82 - 13.82 - 3 = -3: wholly off the stage, "2 Walk" and all (Codex, pass 1; before this slice it
  // ended at 11.07, its digit already cut). ~~Nothing is drawn under it — optionG and the swap are 57 px
  // lower — so it goes there: y 221.61 + 13.82 + 3 + 4.5 = 242.94~~ — S9 draws the taunt red-2 may not
  // throw at blue-1 (another rank, `other-rank`) GREYED in optionC, 30.24 px under it, and a label under
  // the walk would cross it. So it goes over it: y 221.61 - 13.82 - 3 - 4.5 = 200.29, centred, slid
  // right until its left end is on the stage's (x 15 for a label 30 px wide, about what "2 Walk"
  // measures at 9 px).
  const host = played(demoHost({ perSide: 2, seed: 3, kit: "tricks" }), 18);
  const model = modelOf(host, "blue-1");
  const { buttons, stage } = arenaButtons(host, model);
  const walk = buttons.find((button) => button.slot === "optionB");
  const { px, gap } = ringLabelSizeFor(walk.r);
  assert.deepEqual([px, gap], [9, 3]);
  const taunt = buttons.find((button) => button.slot === "optionC");
  assert.deepEqual([taunt.verb, taunt.reason?.code, round(taunt.y - walk.y)], ["taunt", "other-rank", 30.24], "S9: the greyed taunt under it");
  const label = ringLabelAt(walk, buttons, { width: 30, height: px, gap }, { stage });
  assert.deepEqual([label.align, round(label.x), round(label.y)], ["center", 15, 200.29]);
  const box = { x0: label.x - 15, x1: label.x + 15, y0: label.y - px / 2, y1: label.y + px / 2 };
  assert.ok(box.x0 >= stage.x && box.x1 <= stage.x + stage.width && box.y0 >= stage.y && box.y1 <= stage.y + stage.height, JSON.stringify(box));
  for (const other of buttons) {
    const nx = Math.min(Math.max(other.x, box.x0), box.x1);
    const ny = Math.min(Math.max(other.y, box.y0), box.y1);
    assert.ok(Math.hypot(other.x - nx, other.y - ny) >= other.r, `the label crosses ${other.slot}`);
  }
});

test("CODEX PASS 1, what bringing labels on stage risks: a place on a label already drawn this frame is passed over like one across a button — and with none free on the stage, the label keeps the place it had", () => {
  // Worked by hand. A lone button flush with the stage's left edge (r 10 at (10, 0)), a label 20 x 8,
  // gap 3, on a stage from (0, -40). Its outer side (right-aligned at 10 - 10 - 3 = -3) is off the
  // stage; under it, centred and slid onto the stage, is (10, 0 + 10 + 3 + 4 = 17), its box x 0..20,
  // y 13..21; above it (10, -17), y -21..-13. A label drawn before it this frame on either place
  // takes it.
  const lone = { slot: "a", x: 10, y: 0, r: 10, side: "left" };
  const size = { width: 20, height: 8, gap: 3 };
  const stage = { x: 0, y: -40, width: 640, height: 400 };
  const drawnUnder = ringLabelBoxOf({ x: 12, y: 27, align: "center" }, size);
  assert.deepEqual({ ...drawnUnder }, { x0: 2, x1: 22, y0: 23, y1: 31 });
  assert.deepEqual({ ...ringLabelAt(lone, [lone], size, { stage }) }, { x: 10, y: 17, align: "center" }, "free: under it");
  assert.deepEqual({ ...ringLabelAt(lone, [lone], size, { stage, taken: [drawnUnder] }) }, { x: 10, y: 17, align: "center" },
    "a label clear of it by a pixel does not count");
  const onIt = ringLabelBoxOf({ x: 12, y: 20, align: "center" }, size);
  assert.deepEqual({ ...ringLabelAt(lone, [lone], size, { stage, taken: [onIt] }) }, { x: 10, y: -17, align: "center" }, "taken: above it");
  // Both taken: no place both on the stage and free, and the outer side — where S2 put it — is kept.
  const overIt = ringLabelBoxOf({ x: 12, y: -18, align: "center" }, size);
  assert.deepEqual({ ...ringLabelAt(lone, [lone], size, { stage, taken: [onIt, overIt] }) }, { x: -3, y: 0, align: "right" });
  // And a label ON another is worse than one past the edge — both would be unreadable. A button 5
  // above the stage's foot (r 10 at (100, 395), stage 0..400): its outer side (right-aligned at 87,
  // y 391..399) is on the stage but on a label drawn before it; over it (y 374..382) runs across a
  // button at (100, 372); under it, y 408..416, is past the foot, and free. Under it, then — not
  // back to the outer side, which the first clear place would be.
  const low = { slot: "b", x: 100, y: 395, r: 10, side: "left" };
  const blocker = { slot: "c", x: 100, y: 372, r: 6, side: "left" };
  const beside = ringLabelBoxOf({ x: 80, y: 394, align: "right" }, size);
  assert.deepEqual({ ...ringLabelAt(low, [low, blocker], size, { stage: { x: 0, y: 0, width: 640, height: 400 }, taken: [beside] }) },
    { x: 100, y: 412, align: "center" });
});

test("ACCEPTANCE, over whole bouts with every foe selected in turn, under the arena's own camera: every walk on offer stands on the side it moves toward — its centre wherever the stage has room for it, its whole disc wherever there is room for that, else flush with the stage's edge on his side — every button stays on the stage, clear of every other, and a walk's key label stays on it too", (t) => {
  const tally = { selections: 0, walks: 0, wholeDisc: 0, centreOnly: 0, noRoom: 0, teamCamera: 0, walkLabels: 0 };
  const EPS = 1e-9;
  for (const perSide of [1, 2, 3]) {
    for (const kit of ["", "tricks"]) {
      for (const seed of [1, 2, 3, 4]) {
        const host = demoHost({ perSide, seed, kit });
        for (let taken = 0; !host.battle.result && taken < 1500; taken += 1) {
          const actorId = host.currentCombatantId();
          const camera = arenaCamera(host);
          if (camera.team) tally.teamCamera += 1;
          for (const foeId of modelOf(host).foeIds) {
            const model = modelOf(host, foeId);
            const { buttons, stage, fighterX, held } = arenaButtons(host, model, camera);
            const where = `${perSide}v${perSide} ${kit || "plain"} seed ${seed} turn ${taken}: ${actorId} vs ${foeId}`;
            for (const move of model.moves.filter((candidate) => candidate.move === "walk-left" || candidate.move === "walk-right")) {
              const walk = buttons.find((button) => button.slot === (move.place === "slot" ? move.slot : move.move));
              const toward = move.move === "walk-left" ? -1 : 1;
              const past = toward * (walk.x - fighterX);
              const room = toward < 0 ? fighterX - stage.x : stage.x + stage.width - fighterX;
              const edge = toward < 0 ? walk.x - walk.r - stage.x : stage.x + stage.width - walk.x - walk.r;
              const said = `${where}: ${move.move} (${move.place}) at ${walk.x.toFixed(2)}, r ${walk.r.toFixed(2)}, for a fighter drawn at ${fighterX.toFixed(2)}`;
              if (room >= 2 * walk.r) {
                assert.ok(past >= walk.r - EPS, `${said}: its disc crosses him`);
                tally.wholeDisc += 1;
              } else {
                // No room for the whole disc on his side: it is as far to his side as the stage allows.
                assert.ok(Math.abs(edge) < 1e-6, `${said}: not flush with the stage's edge on his side`);
                if (room > walk.r) {
                  assert.ok(past > 0, `${said}: its centre is not on his side`);
                  tally.centreOnly += 1;
                } else tally.noRoom += 1;
              }
              tally.walks += 1;
            }
            for (const button of buttons) {
              assert.ok(button.x - button.r >= stage.x - EPS && button.x + button.r <= stage.x + stage.width + EPS
                && button.y - button.r - (button.labelRoom ?? 0) >= stage.y - EPS && button.y + button.r <= stage.y + stage.height + EPS,
              `${where}: ${button.slot} at (${button.x.toFixed(1)}, ${button.y.toFixed(1)}) r ${button.r.toFixed(1)} leaves the stage`);
            }
            for (const a of buttons) {
              for (const b of buttons) {
                if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r - EPS, `${where}: ${a.slot} overlaps ${b.slot}`);
              }
            }
            // The key labels, placed as `paintRing` places them — in draw order, each handed the stage
            // and the labels before it — at a stated width (node has no canvas to measure with: a
            // letter 0.6 em, a slot's "2 Walk" or "3 Taunt" 0.55 em a character, 7 characters): a
            // walk this slice holds at the edge keeps its label on the stage (Codex, pass 1); none
            // crosses a button; no two overlap. (A label with no free place on the stage keeps its
            // old one, past the edge, as before this slice: a column within a label's width of the
            // edge but not moved, e.g. 3v3 tricks seed 1 turn 104, red-2's optionE.) S9: a GREYED button
            // carries no label either, as `paintRing` draws none for it — ~~every button but a move~~ —
            // but it is drawn, so no label may cross it.
            const labelled = [];
            for (const button of buttons.filter((candidate) => !candidate.move && !candidate.reason)) {
              const { px, gap } = ringLabelSizeFor(button.r);
              const size = { width: button.verb === "item" ? px * 0.6 : px * 0.55 * 7, height: px, gap };
              const box = ringLabelBoxOf(ringLabelAt(button, buttons, size, { stage, taken: labelled }), size);
              if (held.has(button.slot) && (button.verb === "walkleft" || button.verb === "walkright")) {
                assert.ok(box.x0 >= stage.x - EPS && box.x1 <= stage.x + stage.width + EPS && box.y0 >= stage.y - EPS && box.y1 <= stage.y + stage.height + EPS,
                  `${where}: ${button.slot}'s label ${JSON.stringify(box)} leaves the stage`);
                tally.walkLabels += 1;
              }
              for (const other of buttons) {
                if (other === button) continue;
                const nx = Math.min(Math.max(other.x, box.x0), box.x1);
                const ny = Math.min(Math.max(other.y, box.y0), box.y1);
                assert.ok(Math.hypot(other.x - nx, other.y - ny) >= other.r - EPS, `${where}: ${button.slot}'s label crosses ${other.slot}`);
              }
              for (const other of labelled) {
                assert.ok(box.x1 <= other.x0 + EPS || other.x1 <= box.x0 + EPS || box.y1 <= other.y0 + EPS || other.y1 <= box.y0 + EPS,
                  `${where}: ${button.slot}'s label overlaps another`);
              }
              labelled.push(box);
            }
            tally.selections += 1;
          }
          host.submit({ ...host.suggestAction(actorId), actorId });
        }
        assert.ok(host.battle.result, `${perSide}v${perSide} ${kit || "plain"} seed ${seed} finished`);
      }
    }
  }
  // The sweep reached the cases it is about: walks at an edge with room for their centre only, and fighters
  // drawn so near the edge that no place on the stage is on their side.
  assert.ok(tally.centreOnly > 0 && tally.noRoom > 0 && tally.wholeDisc > tally.centreOnly && tally.teamCamera > 0 && tally.walkLabels > 0, JSON.stringify(tally));
  t.diagnostic(JSON.stringify(tally));
});

/* ------------------------------------------------------------------ */
/* The shell hands it the fighter's drawn centre (read as text)        */
/* ------------------------------------------------------------------ */

/**
 * `tools/arena/main.js` cannot be imported by node, so — as the other ring tests do — the line that
 * keeps the ring on the stage is pinned as text, comments and strings blanked first.
 */
const shell = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8")
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

test("the shell keeps the ring on the stage with the acting fighter's DRAWN centre — the ring's own, where he was drawn this frame", () => {
  const paint = functionBody("paintRing");
  assert.match(paint, /const placement = ringPlacementFor\(\{\s*actor: ringOrigins\.actor,/, "the ring stands on where he was drawn");
  assert.match(paint, /const buttons = ringButtonsInside\(\[[\s\S]*?\], stage, \{ fighterX: placement\.x \}\);/);
  // CODEX PASS 1: each key label kept on the same stage.
  assert.match(paint, /const at = ringLabelAt\(button, drawn, size, \{ stage, taken: labelled \}\);\s*labelled\.push\(ringLabelBoxOf\(at, size\)\);/,
    "and clear of every label drawn before it this frame");
});
