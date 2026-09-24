/**
 * THE WEAPON SWAP ON THE RING (slice S6 of `docs/design/battle-ui.md`, "The
 * in-battle actions: DECIDED", item 1: "the build's ninth button (weapon
 * swap)"). The build's swap button, `swap_inventory` — an instance of
 * `inventory_buttons` (116) at depth 101 of the overlay's frame 1 — stands at
 * the ring's lower left, shows the weapon it swaps TO, and sends
 * `getphase("swap_weapons")` (overlay frame 1 body 0x2378d2, `+0x1067`).
 *
 * Seams under test: `ringModelFor`'s `swap` and `offRing`, `ringActionFor`
 * and `ringKeyCommand` (`tools/arena/ring.js`); `ringSwapButtonAt`,
 * `ringSlotAt` and `ringLabelAt` (`tools/arena/ring-layout.js`);
 * `ringButtonArt` (`tools/arena/ring-art.js`); and, read as text, the lines of
 * `tools/arena/main.js` that hand them to the page.
 *
 * The engine is not mocked where its answer matters: the offer and the stance
 * come off a REAL host. Expected values are literals: the turns were read off
 * the demo bouts named in each test, the positions worked by hand from
 * `SS2_OVERLAY_SLOTS` and 116's background placement.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2InBowMode, ss2TeamRules } from "../src/team/ss2-rules.js";
import { resourceValue } from "../src/team/resources.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { seatControllersFrom, seatTurnFor, withSeatControllers } from "../tools/arena/seats.js";
import { RING_VERB_LABELS, ringActionFor, ringActionLabel, ringKeyCommand, ringModelFor } from "../tools/arena/ring.js";
import {
  fighterBoxFor,
  ringButtonsAt,
  ringButtonsInside,
  ringLabelAt,
  ringMoveButtonsAt,
  ringPlacementFor,
  ringSlotAt,
  ringSwapButtonAt
} from "../tools/arena/ring-layout.js";
import { cameraFor, cameraStep, stageClipRectFor, stageFitFor, stageProjectorFor } from "../src/render/arena-backdrop.js";
import { ringButtonArt } from "../tools/arena/ring-art.js";
import { actionButtonPackFrom } from "../src/render/action-buttons.js";

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
/** Plays the rule set's own AI until turn `turnNumber` is due to `actorId`, or fails. */
function advanceTo(host, turnNumber, actorId) {
  for (let taken = 0; taken < 400 && !host.battle.result; taken += 1) {
    if (host.battle.turnNumber === turnNumber && host.currentCombatantId() === actorId) return host;
    const due = host.currentCombatantId();
    host.submit({ ...host.suggestAction(due), actorId: due });
  }
  assert.fail(`the bout never reached turn ${turnNumber} for ${actorId}`);
}
/** An action as one line, `type -> target`. */
const line = (action) => `${action.type}${action.itemId != null ? `#${action.itemId}` : ""} -> ${action.targetId}`;

/* ------------------------------------------------------------------ */
/* 1. Shown when the engine offers it, and nowhere else                */
/* ------------------------------------------------------------------ */

test("an archer with his sword in hand: the swap is the ring's ninth button, key 9, offering the BOW — and it is not listed", () => {
  // 3v3 plain seed 3, turn 1: red-2 is the roster's archer (`secondary_weapon` 61), sword in hand, five
  // arrows; the engine offers him walk-left, walk-right, a taunt at blue-2, both rank changes, wincrowd,
  // swap-weapons and rest.
  const model = modelOf(advanceTo(demoHost({ perSide: 3, seed: 3 }), 1, "red-2"));
  assert.equal(model.stance.weapon, "warrior");
  assert.deepEqual(model.swap, {
    key: "9",
    slot: "swap_inventory",
    verb: "swap_weapons",
    usingBow: false,
    words: "Switch to ranged weapon",
    action: { type: "swap-weapons", targetId: "red-2", actorId: "red-2" }
  });
  assert.ok(!model.offRing.some((entry) => entry.action.type === "swap-weapons"), "on the ring, so not listed");
  assert.deepEqual(model.offRing.map((entry) => line(entry.action)), ["rest -> red-2"]);
});

test("the swap is sent by key 9 and by its slot's name, exactly as offered — one press, never from a field that types", () => {
  const model = modelOf(advanceTo(demoHost({ perSide: 3, seed: 3 }), 1, "red-2"));
  const sent = { type: "swap-weapons", targetId: "red-2", actorId: "red-2" };
  assert.deepEqual(ringKeyCommand(model, { key: "9", focus: "stage" }), { kind: "act", action: sent });
  assert.deepEqual(ringKeyCommand(model, { key: "9", focus: "control" }), { kind: "act", action: sent }, "from a strip button too");
  assert.equal(ringKeyCommand(model, { key: "9", focus: "stage" }).action, model.swap.action, "the model's own action, not a copy");
  assert.deepEqual(ringActionFor(model, "9"), sent);
  assert.deepEqual(ringActionFor(model, "swap_inventory"), sent, "what a click on the drawn button names");
  assert.equal(ringKeyCommand(model, { key: "9", focus: "stage", repeat: true }), null, "a held 9 swaps once");
  assert.equal(ringKeyCommand(model, { key: "9", focus: "text" }), null);
  assert.equal(ringKeyCommand(model, { key: "9", focus: "stage", ctrlKey: true }), null, "Ctrl+9 is the browser's");
  assert.equal(ringKeyCommand(model, { key: "0", focus: "stage" }), null, "0 is nothing");
});

test("NO SECOND WEAPON, NO BUTTON: the engine withholds the swap (`no-secondary`, a hide) and the ring has none — no key, no list entry", () => {
  // The same bout's first turn is red-1's: no `secondary_weapon`, so no swap on offer.
  const host = demoHost({ perSide: 3, seed: 3 });
  assert.equal(host.currentCombatantId(), "red-1");
  const model = modelOf(host);
  assert.equal(model.swap, null);
  assert.equal(ringActionFor(model, "9"), null);
  assert.equal(ringActionFor(model, "swap_inventory"), null);
  assert.equal(ringKeyCommand(model, { key: "9", focus: "stage" }), null, "the browser keeps a 9 that swaps nothing");
  assert.ok(!model.offRing.some((entry) => entry.action.type === "swap-weapons"));
  // The engine's own reason, which is why the button is HIDDEN rather than greyed (the owner's Q6).
  const entry = host.unavailableActions("red-1", model.selectedId).ring.find((candidate) => candidate.group === "swap");
  assert.deepEqual([entry.available, entry.reason, entry.display], [false, "no-secondary", "hide"]);
});

test("the bow drawn: the button offers the SWORD; out of arrows, the forced swap is the ring's only button", () => {
  // Same bout, turn 2: red-2 drew his bow on turn 1 and has five arrows.
  const host = advanceTo(demoHost({ perSide: 3, seed: 3 }), 2, "red-2");
  const drawn = modelOf(host);
  assert.equal(drawn.stance.weapon, "archer");
  assert.deepEqual([drawn.swap.usingBow, drawn.swap.words, drawn.swap.key], [true, "Switch to melee weapon", "9"]);
  // Turn 7: the fifth arrow is gone, and the build's first forced phase (`ammo_left <= 0 && using_bow`)
  // is the WHOLE offer — no slot, no move, nothing listed; the swap is what a person presses.
  advanceTo(host, 7, "red-2");
  assert.deepEqual(host.legalActions(), [{ type: "swap-weapons", targetId: "red-2" }]);
  const forced = modelOf(host);
  assert.deepEqual([forced.slots.filter((slot) => slot.action).length, forced.moves.length, forced.offRing.length], [0, 0, 0]);
  assert.deepEqual(forced.swap.action, { type: "swap-weapons", targetId: "red-2", actorId: "red-2" });
  assert.equal(forced.swap.usingBow, true);
});

test("with no ring — the engine has no menu to ask — the swap is not placed, and it is listed like every other offer", () => {
  const host = advanceTo(demoHost({ perSide: 3, seed: 3 }), 1, "red-2");
  const model = ringModelFor({
    actorId: "red-2", combatants: host.wire().teams.flatMap((team) => team.combatants), legal: host.legalActions(), menuFor: () => null
  });
  assert.equal(model.swap, null);
  assert.equal(ringActionFor(model, "9"), null);
  assert.deepEqual(model.offRing.map((entry) => line(entry.action)), host.legalActions().map(line));
});

test("its words: the build's own rollover text in the strip and its accessible name, `9 Swap` beside it on the stage", () => {
  const model = modelOf(advanceTo(demoHost({ perSide: 3, seed: 3 }), 1, "red-2"));
  assert.equal(ringActionLabel(model.swap.action, { words: model.swap.words }), "Switch to ranged weapon");
  assert.equal(ringActionLabel(model.swap.action), "Swap weapons", "without the words, the token worded as before");
  assert.equal(RING_VERB_LABELS.swap_weapons.short, "Swap");
});

/* ------------------------------------------------------------------ */
/* 2. Where it stands, and what a click hits                           */
/* ------------------------------------------------------------------ */

/** A model with every slot filled and the swap on offer — the ring at its fullest. */
function fullRing({ frame = "closerange_warrior", usingBow = false } = {}) {
  const slots = ["optionA", "optionB", "optionC", "optionG", "optionD", "optionE", "optionF", "optionH"]
    .map((slot, index) => ({ key: String(index + 1), slot, verb: "power_attack", action: { type: "power-attack" } }));
  return {
    stance: { frame, range: "close", weapon: usingBow ? "archer" : "warrior", facing: "right" },
    slots,
    moves: [],
    swap: { key: "9", slot: "swap_inventory", verb: "swap_weapons", usingBow, words: "", action: { type: "swap-weapons" } }
  };
}

test("THE BUILD'S PLACE: the swap stands at `swap_inventory`, its disc centred where 116 centres its background", () => {
  // Worked by hand. The relayed slot is (-93.4, 40.4) at scale 0.6 (SS2_OVERLAY_SLOTS); 116 places its
  // background at (18.25, 18.25) of its own pixels, 0.6 of that is 10.95, so the disc's centre is
  // (-82.45, 51.35) overlay px. At (300, 200) and 2 canvas px per overlay px: (135.1, 302.7); radius the
  // fallback's 18 at the slot's 0.6, times 2 = 21.6.
  const [button] = ringSwapButtonAt(fullRing(), { centerX: 300, centerY: 200, unit: 2 });
  assert.deepEqual(Object.keys(button).sort(), ["key", "r", "scale", "side", "slot", "usingBow", "verb", "x", "y"]);
  assert.deepEqual([button.key, button.slot, button.verb, button.usingBow, button.side], ["9", "swap_inventory", "swap_weapons", false, "left"]);
  assert.ok(Math.abs(button.x - 135.1) < 1e-9 && Math.abs(button.y - 302.7) < 1e-9, `(${button.x}, ${button.y})`);
  assert.ok(Math.abs(button.r - 21.6) < 1e-9 && Math.abs(button.scale - 1.2) < 1e-9);
  assert.equal(ringSlotAt([button], 135.1, 302.7), "swap_inventory", "a click on it names the slot ringActionFor takes");
  assert.equal(ringSlotAt([button], 135.1 + 21.7, 302.7), null);
  // From a pack's measured layout (the real pack's matrix, 0.59999 and -1868/807 twips), at the frame the stance rests on.
  const layout = {
    controllers: { closerange_warrior: { restsAt: 19 } },
    tracks: { swap_inventory: [{ from: 1, to: 51, matrix: [0.59999, 0, 0, 0.59999, -1868, 807] }] }
  };
  const [measured] = ringSwapButtonAt(fullRing(), { centerX: 0, centerY: 0, unit: 1, layout });
  assert.ok(Math.abs(measured.x - (-93.4 + 18.25 * 0.59999)) < 1e-9 && Math.abs(measured.y - (40.35 + 18.25 * 0.59999)) < 1e-9,
    `(${measured.x}, ${measured.y})`);
  // No swap on offer, no button.
  assert.deepEqual(ringSwapButtonAt({ ...fullRing(), swap: null }, { centerX: 300, centerY: 200, unit: 2 }), []);
});

test("the swap overlaps none of the eight, at the ring's fullest", () => {
  const model = fullRing();
  const at = { centerX: 0, centerY: 0, unit: 1 };
  const [swap] = ringSwapButtonAt(model, at);
  const eight = ringButtonsAt(model, at);
  assert.equal(eight.length, 8);
  for (const button of eight) {
    const gap = Math.hypot(button.x - swap.x, button.y - swap.y) - button.r - swap.r;
    assert.ok(gap > 0, `${button.slot} overlaps the swap by ${-gap}`);
  }
  // The nearest is optionG, (-53.5, 53.4) at radius 14.4: 29.02 apart against 25.2 of radii.
  const nearest = eight.reduce((best, button) => (Math.hypot(button.x - swap.x, button.y - swap.y) < Math.hypot(best.x - swap.x, best.y - swap.y) ? button : best));
  assert.equal(nearest.slot, "optionG");
});

/**
 * THE ARENA'S OWN GEOMETRY for whoever is due, as `paintRing` places the ring (S4's helper in
 * `test/arena-ring-movement.test.js`, plus the swap): the camera fed every placed fighter as `{x, side}`
 * and run until it settles, the 640x420 stage, and the eight, the swap and the moves kept inside it.
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
    ...ringSwapButtonAt(model, at),
    ...ringMoveButtonsAt(model, { ...at, head: box.y0, feet: below, bounds: { top: stage.y, bottom: stage.y + stage.height } })
  ], stage);
  return { buttons, stage };
}

test("ACCEPTANCE, over whole bouts with every foe selected in turn, under the arena's own camera: an offered swap is drawn once, inside the stage, clear of every other button, and sent by its click and by 9; a withheld one — which the engine always calls a hide — is drawn, clicked and keyed by nothing", (t) => {
  const tally = { turns: 0, selections: 0, shown: 0, hidden: 0, bowDrawn: 0, meleeInHand: 0, forced: 0, noArrowsMeleeInHand: 0 };
  const reasons = new Map();
  const EPS = 1e-9;
  for (const perSide of [1, 2, 3]) {
    for (const kit of ["", "tricks"]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const host = demoHost({ perSide, seed, kit });
        for (let taken = 0; !host.battle.result && taken < 1500; taken += 1) {
          const actorId = host.currentCombatantId();
          const offer = host.legalActions();
          const option = offer.find((candidate) => candidate.type === "swap-weapons");
          for (const foeId of modelOf(host).foeIds) {
            const model = modelOf(host, foeId);
            const { buttons, stage } = arenaButtons(host, model);
            const where = `${perSide}v${perSide} ${kit || "plain"} seed ${seed} turn ${taken}: ${actorId} vs ${foeId}`;
            const drawn = buttons.filter((button) => button.slot === "swap_inventory");
            const keyed = ringKeyCommand(model, { key: "9", focus: "stage" });
            assert.ok(!model.offRing.some((entry) => entry.action.type === "swap-weapons"), `${where}: the swap is listed`);
            if (option) {
              tally.shown += 1;
              const sent = { ...option, actorId };
              assert.equal(option.targetId, actorId, `${where}: the swap is the actor's own`);
              assert.equal(drawn.length, 1, `${where}: an offered swap is drawn ${drawn.length} times`);
              const [button] = drawn;
              assert.ok(button.x - button.r >= stage.x - EPS && button.x + button.r <= stage.x + stage.width + EPS
                && button.y - button.r >= stage.y - EPS && button.y + button.r <= stage.y + stage.height + EPS,
              `${where}: the swap at (${button.x.toFixed(1)}, ${button.y.toFixed(1)}) leaves the stage`);
              for (const other of buttons) {
                if (other !== button) assert.ok(Math.hypot(other.x - button.x, other.y - button.y) >= other.r + button.r, `${where}: ${other.slot} overlaps the swap`);
              }
              assert.deepEqual(ringActionFor(model, ringSlotAt(buttons, button.x, button.y)), sent, `${where}: a click on the swap`);
              assert.deepEqual(keyed, { kind: "act", action: sent }, `${where}: key 9`);
              // The button offers the weapon NOT in hand, by the engine's own bow mode.
              assert.equal(model.swap.usingBow, model.stance.weapon === "archer");
              tally[model.swap.usingBow ? "bowDrawn" : "meleeInHand"] += 1;
              if (offer.length === 1) tally.forced += 1;
              // The build HIDES its button here — `ammo_left <= 0 && secondary_weapon != 0` (overlay frame 1
              // body 0x2378d2 +0x0e0a..+0x0e5f) — and the engine offers the swap; the ring shows what the
              // engine offers. Counted, not asserted: see "S6, built" in docs/design/battle-ui.md.
              if (!model.swap.usingBow && resourceValue(host.combatant(actorId), "ammo_left", 0) <= 0) tally.noArrowsMeleeInHand += 1;
            } else {
              tally.hidden += 1;
              assert.equal(model.swap, null, `${where}: a withheld swap is on the ring`);
              assert.equal(drawn.length, 0, `${where}: a withheld swap is drawn`);
              assert.equal(ringActionFor(model, "swap_inventory"), null);
              assert.equal(keyed, null, `${where}: 9 on a withheld swap`);
              // The owner's Q6: hidden where the build hides it. The engine says why, and it is a hide.
              const entry = host.unavailableActions(actorId, foeId).ring.find((candidate) => candidate.group === "swap");
              assert.equal(entry.display, "hide", `${where}: withheld as ${entry.reason}, which is not a hide`);
              reasons.set(entry.reason, (reasons.get(entry.reason) ?? 0) + 1);
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
  // Both sides of every question were reached: shown and hidden, the sword offered and the bow, the forced swap.
  assert.ok(tally.shown > 0 && tally.hidden > 0 && tally.bowDrawn > 0 && tally.meleeInHand > 0 && tally.forced > 0, JSON.stringify(tally));
  assert.ok((reasons.get("no-secondary") ?? 0) > 0, JSON.stringify([...reasons]));
  t.diagnostic(JSON.stringify({ ...tally, hiddenBecause: Object.fromEntries([...reasons].sort()) }));
});

test("?play=red, whole bouts: a person presses 9, the engine takes the swap as offered and the weapon in hand changes — both ways — and every bout finishes", (t) => {
  const tally = { bouts: 0, presses: 0, toBow: 0, toSword: 0, personTurns: 0 };
  for (const kit of ["", "tricks"]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const items = demoItemsFrom(kit);
      const teams = [demoSide("red", 3, { ...deps, items, seed }), demoSide("blue", 3, { ...deps, items, seed })];
      const seats = seatControllersFrom(new URLSearchParams("play=red"), teams);
      const host = createVanillaBattleHost({ teams: withSeatControllers(teams, seats), rules: ss2TeamRules, bindings: SS2_STATIC_MAP_BINDINGS, seed });
      for (let taken = 0; !host.battle.result; taken += 1) {
        assert.ok(taken < 4000, `${kit || "plain"} seed ${seed} never finished`);
        const turn = seatTurnFor(host.battle, seats, { ready: true });
        if (turn.ai) {
          host.submit({ ...host.suggestAction(turn.actorId), actorId: turn.actorId });
          continue;
        }
        const model = modelOf(host);
        tally.personTurns += 1;
        // Every third person turn with the swap on the ring presses 9; otherwise the first filled slot, a
        // move by its arrow, or the first listed — whatever the ring shows.
        let action = null;
        if (model.swap && (tally.personTurns % 3 === 0 || host.legalActions().length === 1)) {
          const before = ss2InBowMode(host.combatant(turn.actorId));
          assert.equal(model.swap.usingBow, before, "the button offers the weapon not in hand");
          action = ringKeyCommand(model, { key: "9", focus: "stage" }).action;
          assert.deepEqual(host.legalActions().filter((option) => option.type === "swap-weapons"), [{ type: action.type, targetId: action.targetId }]);
          host.submit(action);
          assert.equal(ss2InBowMode(host.combatant(turn.actorId)), !before, `${turn.actorId}: 9 swapped nothing`);
          tally.presses += 1;
          tally[before ? "toSword" : "toBow"] += 1;
          continue;
        }
        const slot = model.slots.find((candidate) => candidate.action);
        action = slot ? ringKeyCommand(model, { key: slot.key, focus: "stage" }).action
          : model.moves[0]?.action ?? model.offRing[0]?.action ?? model.swap?.action;
        assert.ok(action, `${turn.actorId}: the ring shows nothing`);
        host.submit(action);
      }
      tally.bouts += 1;
    }
  }
  assert.ok(tally.toBow > 0 && tally.toSword > 0, JSON.stringify(tally));
  t.diagnostic(JSON.stringify(tally));
});

/* ------------------------------------------------------------------ */
/* 3. What it draws                                                    */
/* ------------------------------------------------------------------ */

const square = (fill) => ({ bounds: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 }, paths: [{ d: "M0 0L10 0L10 10L0 10Z", fill, fillOpacity: 1 }] });
const UP = "#403020";
const OVER = "#f0c040";
/** An icons pack with only the strip, shaped as the extractor writes it: 116's background (58) at (365, 365) twips on every frame, as the real pack's is, and on frames 2..49 a shape whose fill names the frame. */
function stripPack() {
  const shapes = { 56: square(UP), 57: square(OVER) };
  const frames = Array.from({ length: 49 }, (unused, index) => {
    const frame = index + 1;
    const background = { kind: "clip", character: 58, matrix: [1, 0, 0, 1, 365, 365], name: "battlebutton", frameCount: 2 };
    if (frame === 1) return [background];
    shapes[3000 + frame] = square(`#0000${frame.toString(16).padStart(2, "0")}`);
    return [background, { kind: "shape", character: 3000 + frame, matrix: [1, 0, 0, 1, 0, 0] }];
  });
  return actionButtonPackFrom({
    shapes,
    icons: { inventory_buttons: { character: 116, frames } },
    nested: { 58: { character: 58, instances: ["battlebutton"], frames: [[{ kind: "shape", character: 56, matrix: [1, 0, 0, 1, 0, 0] }], [{ kind: "shape", character: 57, matrix: [1, 0, 0, 1, 0, 0] }]] } }
  });
}
const fills = (button) => button.ops.filter((op) => op.kind === "path").map((op) => op.fill);

test("THE BUILD'S OWN BUTTON: the sword in hand offers the bow (116 frame 10), the bow drawn offers the sword (frame 11), the over frame under the pointer", () => {
  const pack = stripPack();
  const at = { centerX: 300, centerY: 200, unit: 2 };
  const [melee] = ringButtonArt(ringSwapButtonAt(fullRing({ usingBow: false }), at), { pack });
  assert.deepEqual([melee.source, fills(melee)], ["build", [UP, "#00000a"]]);
  const [bow] = ringButtonArt(ringSwapButtonAt(fullRing({ usingBow: true }), at), { pack });
  assert.deepEqual([bow.source, fills(bow)], ["build", [UP, "#00000b"]]);
  const [hovered] = ringButtonArt(ringSwapButtonAt(fullRing(), at), { pack, hoverSlot: "swap_inventory" });
  assert.deepEqual([hovered.state, fills(hovered)[0]], ["hover", OVER]);
  // The ops are in 116's own pixels, whose disc is centred at (18.25, 18.25): the painter is told so,
  // and draws that point on the button's centre.
  assert.deepEqual(melee.centre, { x: 18.25, y: 18.25 });
  // Without the pack the authored disc is drawn, centred on its own origin.
  const [bare] = ringButtonArt(ringSwapButtonAt(fullRing(), at), { pack: null });
  assert.deepEqual([bare.source, bare.centre], ["authored", { x: 0, y: 0 }]);
  assert.ok(bare.ops.some((op) => op.button === "glyph"), "the authored swap glyph");
});

/* ------------------------------------------------------------------ */
/* 4. Its label, and the label it would have covered                   */
/* ------------------------------------------------------------------ */

test("THE LABELS MAKE ROOM: optionG's key label would run across the swap, so it goes under its button; the swap's own goes outboard", () => {
  // Worked by hand at unit 1, a label 38 x 9 px, a gap of 3. optionG is (-53.5, 53.4), radius 14.4: its
  // label on the ring's outer side ends at x -70.9 and spans y 48.9-57.9, and the swap's disc (-82.45,
  // 51.35) lies inside that box. Under optionG instead: centred at y 53.4 + 14.4 + 3 + 4.5 = 75.3, clear
  // of everything. The swap's own label ends at -82.45 - 10.8 - 3 = -96.25, level with its disc.
  const at = { centerX: 0, centerY: 0, unit: 1 };
  const model = fullRing();
  const buttons = [...ringButtonsAt(model, at), ...ringSwapButtonAt(model, at)];
  const size = { width: 38, height: 9, gap: 3 };
  const place = (slot) => {
    const label = ringLabelAt(buttons.find((button) => button.slot === slot), buttons, size);
    return [label.align, Math.round(label.x * 100) / 100, Math.round(label.y * 100) / 100];
  };
  assert.deepEqual(place("optionG"), ["center", -53.5, 75.3]);
  assert.deepEqual(place("swap_inventory"), ["right", -96.25, 51.35]);
  assert.deepEqual(place("optionC"), ["right", -81.6, 23.4], "a label with room keeps the outer side");
  assert.deepEqual(place("optionH"), ["left", 72.4, 53.4], "the right column's go right");
  // Below is tried before above: a button whose outer side alone is blocked puts its label under it
  // (at 10 + 3 + 4 = 17), and above only when below is blocked too.
  const lone = { slot: "a", x: 0, y: 0, r: 10, side: "left" };
  const leftOf = { slot: "b", x: -30, y: 0, r: 10, side: "left" };
  const under = { slot: "c", x: 0, y: 30, r: 10, side: "left" };
  const small = { width: 20, height: 8, gap: 3 };
  assert.deepEqual({ ...ringLabelAt(lone, [lone, leftOf], small) }, { x: 0, y: 17, align: "center" });
  assert.deepEqual({ ...ringLabelAt(lone, [lone, leftOf, under], small) }, { x: 0, y: -17, align: "center" });
  const over = { slot: "d", x: 0, y: -30, r: 10, side: "left" };
  assert.deepEqual({ ...ringLabelAt(lone, [lone, leftOf, under, over], small) }, { x: -13, y: 0, align: "right" },
    "boxed in on every side, the label keeps S2's outer place");
  // With no swap on offer, optionG's label is where S2 put it.
  const eight = ringButtonsAt(model, at);
  const alone = ringLabelAt(eight.find((button) => button.slot === "optionG"), eight, size);
  assert.deepEqual([alone.align, Math.round(alone.x * 100) / 100, alone.y], ["right", -70.9, 53.4]);
});

/* ------------------------------------------------------------------ */
/* 5. The shell hands it to the page (read as text)                    */
/* ------------------------------------------------------------------ */

/**
 * `tools/arena/main.js` cannot be imported by node, so — as the other ring
 * tests do — the lines that hand the swap to the canvas, the click, the key and
 * the strip are pinned as text, comments and strings blanked first.
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

test("the shell draws the swap with the ring, kept on the stage with it, clicks what it drew, and centres 116's disc on the button", () => {
  const paint = functionBody("paintRing");
  assert.match(paint, /const buttons = ringButtonsInside\(\[\s*\.\.\.ringButtonsAt\([\s\S]*?\}\),\s*\.\.\.ringSwapButtonAt\(ringView\.model, \{[^}]*centerX: placement\.x,[^}]*centerY: placement\.y,[^}]*unit: placement\.unit,[^}]*layout: ringButtonPack\?\.layout \?\? null[^}]*\}\),\s*\.\.\.ringMoveButtonsAt\(/,
    "the swap after the eight (the build's depth 101 is over them) and inside the stage fit");
  assert.match(paint, /ringButtons = buttons;/, "a click is tested against the swap too");
  assert.match(paint, /ringLabelAt\(button, drawn, \{ width: context\.measureText\(label\)\.width, height: [^,]+, gap \}\)/,
    "every key label is placed clear of the other buttons, from its measured width");
  const button = functionBody("paintRingButton");
  assert.match(button, /context\.scale\(button\.scale, button\.scale\);\s*context\.translate\(-button\.centre\.x, -button\.centre\.y\);/,
    "the ops are drawn with the disc's centre, not the clip's corner, on the button");
  // One route to the engine still: the click names the slot, and actFromRing re-asks whose turn it is —
  // through the confirm gate since S7 (`pressRing`), ~~`actFromRing` directly~~.
  assert.match(shell, /pressRing\(ringActionFor\(ringView\.model, slot\)\)/);
  assert.equal((shell.match(/host\.submit\(/g) ?? []).length, 3);
});

test("the strip carries the swap: a real button in the ring row with key 9 and the build's own words; the status and the stage's name say 9", () => {
  const strip = functionBody("renderRingStrip");
  assert.match(strip, /if \(model\.swap\) \{\s*slotRow\.append\(actionButton\(model\.swap\.action, \{ words: model\.swap\.words, keys: \[model\.swap\.key\] \}\)\);\s*\}/);
  assert.ok(rawShell.includes('(model.swap ? `, ${model.swap.key} ${model.swap.words.toLowerCase()}` : "")'),
    "the status line names the key and what it does this turn");
  assert.ok(rawShell.includes('${model.swap ? " and the weapon swap" : ""}'), "the turn's announcement counts it");
  assert.match(strip, /button\.append\(document\.createTextNode\(ringActionLabel\(action, \{ verb, words, nameOf \}\)\)\);/);
  assert.match(rawPage, /aria-label="[^"]*\b9 swaps weapons[^"]*"/, "the stage's own name tells a screen reader what 9 does");
});
