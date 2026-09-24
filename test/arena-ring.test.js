/**
 * THE RING'S MODEL (`tools/arena/ring.js`, slice S2 of `docs/design/battle-ui.md`,
 * "The in-battle actions: DECIDED"): who is selected, which stance the ring
 * shows, which verb sits in which of the eight slots, what is left off the
 * ring, and the exact action a click or a key sends.
 *
 * The engine is not mocked where its answer matters: the stance and the slots
 * are read off a REAL host (`host.unavailableActions`), and the expected
 * layouts are taken from `src/render/action-buttons.js`'s table, which was
 * transcribed from the action dump independently of the engine's own copy.
 * Only the who-first selection runs on synthetic fighters, because it needs
 * geometry no opening formation has (a nearer foe in another rank).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { SS2_BUTTON_WIRING } from "../src/render/action-buttons.js";
import { RING_VERB_LABELS, ringActionFor, ringActionLabel, ringFocusKind, ringKeyCommand, ringModelFor, ringNextFoe } from "../tools/arena/ring.js";

/** A fighter as `host.wire()` projects one: the fields the ring reads. */
const fighter = (id, teamId, x, y, alive = true) => ({ id, teamId, x, y, alive });
/** No engine menu: the selection rule does not read one. */
const noMenu = () => null;

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
/** A model's eight slots as `key slot verb` lines, empty slots as `-`. */
const slotLines = (model) => model.slots.map((slot) => `${slot.key} ${slot.slot} ${slot.verb ?? "-"}`);

/* ------------------------------------------------------------------ */
/* 1. Who first                                                        */
/* ------------------------------------------------------------------ */

test("with nothing selected yet, the nearest foe IN THE ACTOR'S OWN RANK is selected, though another is nearer", () => {
  const combatants = [
    fighter("red-1", "red", 0, 200),
    fighter("blue-1", "blue", 100, 103), // one rank back: 139 away
    fighter("blue-2", "blue", 400, 200) //  the actor's own rank: 400 away
  ];
  const model = ringModelFor({ actorId: "red-1", combatants, legal: [], previous: null, menuFor: noMenu });
  assert.equal(model.selectedId, "blue-2");
  assert.equal(model.selectedBy, "own-rank");
});

test("a selection persists between turns while it is still a living foe, even when another is nearer", () => {
  const combatants = [
    fighter("red-1", "red", 0, 200),
    fighter("blue-1", "blue", 150, 200),
    fighter("blue-2", "blue", 900, 200)
  ];
  const model = ringModelFor({ actorId: "red-1", combatants, legal: [], previous: "blue-2", menuFor: noMenu });
  assert.equal(model.selectedId, "blue-2");
  assert.equal(model.selectedBy, "kept");
});

test("a selection that is no longer valid — dead, an ally, or nobody — falls back to who-first", () => {
  const combatants = [
    fighter("red-1", "red", 0, 200),
    fighter("red-2", "red", -100, 200),
    fighter("blue-1", "blue", 150, 200),
    fighter("blue-2", "blue", 60, 200, false) // nearest, and dead
  ];
  for (const previous of ["blue-2", "red-2", "red-1", "blue-9", null]) {
    const model = ringModelFor({ actorId: "red-1", combatants, legal: [], previous, menuFor: noMenu });
    assert.equal(model.selectedId, "blue-1", `previous ${previous}`);
    assert.equal(model.selectedBy, "own-rank", `previous ${previous}`);
  }
});

test("with no foe in the actor's own rank, the nearest foe in any rank", () => {
  const combatants = [
    fighter("red-1", "red", 0, 103),
    fighter("blue-1", "blue", 500, 200),
    fighter("blue-2", "blue", 300, 6)
  ];
  const model = ringModelFor({ actorId: "red-1", combatants, legal: [], previous: null, menuFor: noMenu });
  assert.equal(model.selectedId, "blue-2");
  assert.equal(model.selectedBy, "nearest");
});

test("two foes equally near: the lower id, the tie-break the engine's own nearestFoe uses", () => {
  const combatants = [
    fighter("red-1", "red", 0, 200),
    fighter("blue-2", "blue", -300, 200),
    fighter("blue-1", "blue", 300, 200)
  ];
  const model = ringModelFor({ actorId: "red-1", combatants, legal: [], previous: null, menuFor: noMenu });
  assert.equal(model.selectedId, "blue-1");
});

/* ------------------------------------------------------------------ */
/* 2. The stance and the eight slots, from the engine                  */
/* ------------------------------------------------------------------ */

test("the 1v1 opening: the long-range warrior frame facing right, keys 1-4 down the left column and 5-8 down the right", () => {
  const host = demoHost({ perSide: 1, seed: 7 });
  const model = modelOf(host);
  assert.equal(model.actorId, "red-1");
  assert.equal(model.selectedId, "blue-1");
  assert.deepEqual(model.stance, { frame: "longrange_warrior", range: "long", weapon: "warrior", facing: "right" });
  // `longrange_warrior` facing right in `SS2_BUTTON_WIRING` (action-buttons.js): A jumpleft, B walkleft,
  // C taunt|rest, D jumpright, E walkright, F chargeright, G wincrowd, H psyche_up. The jumps and the
  // charge are not built and psyche up needs level 7, so those four slots are EMPTY: in S2 a slot shows
  // only what the engine offers.
  assert.deepEqual(slotLines(model), [
    "1 optionA -",
    "2 optionB walkleft",
    "3 optionC taunt",
    "4 optionG wincrowd",
    "5 optionD -",
    "6 optionE walkright",
    "7 optionF -",
    "8 optionH -"
  ]);
});

/** Plays the rule set's own AI until `wanted(model)` holds for whoever is due, or fails. */
function advanceUntil(host, wanted, limit = 400) {
  for (let taken = 0; taken < limit && !host.battle.result; taken += 1) {
    const model = modelOf(host);
    if (wanted(model)) return model;
    const actorId = host.currentCombatantId();
    host.submit({ ...host.suggestAction(actorId), actorId });
  }
  assert.fail("the bout never reached the wanted turn");
}

test("closed on, red faces right on the close-range warrior frame: the three swings on keys 5-7, and the key sends the offer", () => {
  const host = demoHost({ perSide: 1, seed: 7 });
  const model = advanceUntil(host, (candidate) => candidate.actorId === "red-1" && candidate.stance.range === "close");
  assert.deepEqual(model.stance, { frame: "closerange_warrior", range: "close", weapon: "warrior", facing: "right" });
  // `closerange_warrior` facing right: A jumpleft, B walkleft, C shove, D power, E normal, F quick,
  // G wincrowd, H psyche_up — only the retreat walk is offered in reach, and no rest (the owner's Q7).
  assert.deepEqual(slotLines(model), [
    "1 optionA -",
    "2 optionB walkleft",
    "3 optionC shove",
    "4 optionG wincrowd",
    "5 optionD power_attack",
    "6 optionE normal_attack",
    "7 optionF quick_attack",
    "8 optionH -"
  ]);
  assert.deepEqual(model.slots[4].action, { type: "power-attack", targetId: "blue-1", actorId: "red-1" });
  assert.deepEqual(model.slots[1].action, { type: "walk-left", targetId: "red-1", actorId: "red-1" });
});

test("blue faces LEFT on the same frame, and the build moves the swings to the left column", () => {
  const host = demoHost({ perSide: 1, seed: 7 });
  const model = advanceUntil(host, (candidate) => candidate.actorId === "blue-1" && candidate.stance.range === "close");
  assert.deepEqual(model.stance, { frame: "closerange_warrior", range: "close", weapon: "warrior", facing: "left" });
  // `closerange_warrior` facing left: A power, B normal, C quick, D jumpright, E walkright, F shove,
  // G psyche_up, H wincrowd.
  assert.deepEqual(slotLines(model), [
    "1 optionA power_attack",
    "2 optionB normal_attack",
    "3 optionC quick_attack",
    "4 optionG -",
    "5 optionD -",
    "6 optionE walkright",
    "7 optionF shove",
    "8 optionH wincrowd"
  ]);
});

/* ------------------------------------------------------------------ */
/* 3. What no slot shows                                               */
/* ------------------------------------------------------------------ */

/** An action as one line, `type -> target`. */
const line = (action) => `${action.type}${action.itemId != null ? `#${action.itemId}` : ""} -> ${action.targetId}`;

test("off the ring: every action the engine offers against the selected foe or the actor that no slot holds", () => {
  const host = demoHost({ perSide: 3, seed: 3 });
  const model = modelOf(host);
  // The 3v3 opening offers red-1 walk-left, walk-right, a taunt at blue-1, rank-back, wincrowd and
  // rest. The long frame holds the two walks, the taunt (he is rested) and wincrowd; the rank verb
  // has no slot until S4, and the rest shares the taunt's slot and loses it above half stamina.
  assert.deepEqual(slotLines(model).filter((text) => !text.endsWith(" -")),
    ["2 optionB walkleft", "3 optionC taunt", "4 optionG wincrowd", "6 optionE walkright"]);
  assert.deepEqual(model.offRing.map((entry) => line(entry.action)), ["rank-back -> red-1", "rest -> red-1"]);
  assert.deepEqual(model.offRing[1].action, { type: "rest", targetId: "red-1", actorId: "red-1" });
});

test("an action aimed at ANOTHER foe is left for that foe's selection, never listed against this one", () => {
  const host = demoHost({ perSide: 3, seed: 3, kit: "tricks" });
  const first = modelOf(host);
  assert.equal(first.selectedId, "blue-1");
  const spells = (model) => model.offRing.map((entry) => line(entry.action)).filter((text) => text.startsWith("cast-"));
  assert.deepEqual(spells(first), [
    "cast-whirlwind -> blue-1", "cast-ghost-strike -> blue-1", "cast-gale -> blue-1", "cast-command -> blue-1",
    "cast-teleport -> red-1", "cast-weaken-armour -> blue-1"
  ]);
  const switched = modelOf(host, "blue-3");
  assert.equal(switched.selectedId, "blue-3");
  assert.deepEqual(spells(switched), [
    "cast-whirlwind -> blue-3", "cast-ghost-strike -> blue-3", "cast-gale -> blue-3", "cast-command -> blue-3",
    "cast-teleport -> red-1", "cast-weaken-armour -> blue-3"
  ]);
});

/* ------------------------------------------------------------------ */
/* 4. What a click sends, and Tab                                      */
/* ------------------------------------------------------------------ */

test("a slot sends exactly the action it holds — by key or by the build's slot name — and an empty slot sends nothing", () => {
  const host = demoHost({ perSide: 1, seed: 7 });
  const model = advanceUntil(host, (candidate) => candidate.actorId === "red-1" && candidate.stance.range === "close");
  const power = { type: "power-attack", targetId: "blue-1", actorId: "red-1" };
  assert.deepEqual(ringActionFor(model, "5"), power);
  assert.deepEqual(ringActionFor(model, "optionD"), power);
  assert.deepEqual(ringActionFor(model, "7"), { type: "quick-attack", targetId: "blue-1", actorId: "red-1" });
  for (const nothing of ["1", "optionA", "8", "9", "0", "", null, "optionZ"]) {
    assert.equal(ringActionFor(model, nothing), null, String(nothing));
  }
});

test("Tab steps through the foes left to right across the stage, Shift+Tab back, both wrapping", () => {
  const combatants = [
    fighter("red-1", "red", -600, 200),
    fighter("blue-1", "blue", 500, 200),
    fighter("blue-2", "blue", 100, 200),
    fighter("blue-3", "blue", 300, 103),
    fighter("blue-4", "blue", 300, 200, false)
  ];
  const model = ringModelFor({ actorId: "red-1", combatants, legal: [], previous: "blue-3", menuFor: noMenu });
  assert.deepEqual(model.foeIds, ["blue-2", "blue-3", "blue-1"]);
  assert.equal(ringNextFoe(model, 1), "blue-1");
  assert.equal(ringNextFoe(model, -1), "blue-2");
  const last = ringModelFor({ actorId: "red-1", combatants, legal: [], previous: "blue-1", menuFor: noMenu });
  assert.equal(ringNextFoe(last, 1), "blue-2", "past the rightmost, back to the leftmost");
  const first = ringModelFor({ actorId: "red-1", combatants, legal: [], previous: "blue-2", menuFor: noMenu });
  assert.equal(ringNextFoe(first, -1), "blue-1", "before the leftmost, round to the rightmost");
});

test("foes level on the stage: the front rank first, then the id", () => {
  const combatants = [
    fighter("red-1", "red", -600, 200),
    fighter("blue-3", "blue", 300, 6),
    fighter("blue-2", "blue", 300, 200),
    fighter("blue-1", "blue", 300, 103),
    fighter("blue-4", "blue", 300, 200)
  ];
  const model = ringModelFor({ actorId: "red-1", combatants, legal: [], previous: null, menuFor: noMenu });
  assert.deepEqual(model.foeIds, ["blue-2", "blue-4", "blue-1", "blue-3"]);
});

/* ------------------------------------------------------------------ */
/* 5. The keyboard                                                     */
/* ------------------------------------------------------------------ */

test("keys 1-8 press the slots from anywhere but a text field; a held, modified or empty key presses nothing", () => {
  const host = demoHost({ perSide: 1, seed: 7 });
  const model = advanceUntil(host, (candidate) => candidate.actorId === "red-1" && candidate.stance.range === "close");
  const power = { kind: "act", action: { type: "power-attack", targetId: "blue-1", actorId: "red-1" } };
  assert.deepEqual(ringKeyCommand(model, { key: "5", focus: "stage" }), power);
  assert.deepEqual(ringKeyCommand(model, { key: "5", focus: "control" }), power, "a focused strip button does not swallow a digit");
  assert.equal(ringKeyCommand(model, { key: "5", focus: "text" }), null);
  for (const modifier of ["ctrlKey", "altKey", "metaKey"]) {
    assert.equal(ringKeyCommand(model, { key: "5", focus: "stage", [modifier]: true }), null, modifier);
  }
  assert.equal(ringKeyCommand(model, { key: "5", focus: "stage", repeat: true }), null, "holding a key acts once");
  assert.equal(ringKeyCommand(model, { key: "1", focus: "stage" }), null, "slot 1 is empty");
  for (const other of ["9", "0", "a", "Enter", " "]) assert.equal(ringKeyCommand(model, { key: other, focus: "stage" }), null, other);
});

test("Tab and Shift+Tab switch the target from the stage; inside a control Tab moves focus, and Esc leaves the stage for the strip", () => {
  const host = demoHost({ perSide: 3, seed: 3 });
  const model = modelOf(host);
  assert.deepEqual(model.foeIds, ["blue-1", "blue-2", "blue-3"]);
  assert.deepEqual(ringKeyCommand(model, { key: "Tab", focus: "stage" }), { kind: "select", foeId: "blue-2" });
  assert.deepEqual(ringKeyCommand(model, { key: "Tab", shiftKey: true, focus: "stage" }), { kind: "select", foeId: "blue-3" });
  assert.deepEqual(ringKeyCommand(model, { key: "Tab", focus: "stage", repeat: true }), { kind: "select", foeId: "blue-2" },
    "a held Tab keeps stepping");
  assert.equal(ringKeyCommand(model, { key: "Tab", focus: "control" }), null, "no keyboard trap: Tab leaves a control as usual");
  assert.equal(ringKeyCommand(model, { key: "Tab", focus: "text" }), null);
  assert.deepEqual(ringKeyCommand(model, { key: "Escape", focus: "stage" }), { kind: "focus-strip" });
  assert.equal(ringKeyCommand(model, { key: "Escape", focus: "control" }), null);
});

test("where the focus is, for the keys: the page and the stage are the stage; a button or a slider a control; a field that types is text", () => {
  const stage = { tagName: "CANVAS" };
  const at = (element) => ringFocusKind(element, { stage });
  assert.equal(at(null), "stage");
  assert.equal(at({ tagName: "BODY" }), "stage");
  assert.equal(at({ tagName: "HTML" }), "stage");
  assert.equal(at(stage), "stage");
  assert.equal(at({ tagName: "CANVAS" }), "control", "only THE stage's canvas is the stage");
  assert.equal(at({ tagName: "BUTTON" }), "control");
  assert.equal(at({ tagName: "INPUT", type: "range" }), "control");
  assert.equal(at({ tagName: "INPUT", type: "text" }), "text");
  assert.equal(at({ tagName: "INPUT", type: "search" }), "text");
  assert.equal(at({ tagName: "TEXTAREA" }), "text");
  assert.equal(at({ tagName: "SELECT" }), "text", "a select takes typed letters and arrow keys");
  assert.equal(at({ tagName: "DIV", isContentEditable: true }), "text");
});

test("with one foe there is nothing to switch to, so Tab is the browser's again", () => {
  const model = modelOf(demoHost({ perSide: 1, seed: 7 }));
  assert.deepEqual(model.foeIds, ["blue-1"]);
  assert.equal(ringKeyCommand(model, { key: "Tab", focus: "stage" }), null);
});

/* ------------------------------------------------------------------ */
/* 6. What a button says                                               */
/* ------------------------------------------------------------------ */

test("every verb the build wires on its four frames and the engine builds has a short label for the ring and a long one", () => {
  const wired = new Set();
  for (const record of Object.values(SS2_BUTTON_WIRING)) {
    for (const facing of ["right", "left"]) {
      for (const wires of Object.values(record[facing])) for (const one of wires) wired.add(one.verb);
    }
  }
  // Jump and charge are wired and not built (the owner's Q8 keeps them hidden).
  const built = [...wired].filter((verb) => !/^(jump|charge)/.test(verb)).sort();
  assert.equal(built.length, 15);
  for (const verb of built) {
    const label = RING_VERB_LABELS[verb];
    assert.ok(label, `${verb} has a label`);
    assert.ok(label.short.length > 0 && label.short.length <= 7, `${verb}: "${label.short}" fits beside a button`);
    assert.ok(label.long.length >= label.short.length, `${verb}: the long label`);
  }
});

test("a button's accessible name: the verb, and the foe it is aimed at by name", () => {
  const nameOf = (id) => ({ "blue-1": "Nym", "red-1": "Ruk" })[id] ?? id;
  const actor = "red-1";
  const said = (action, verb = null) => ringActionLabel({ ...action, actorId: actor }, { verb, nameOf });
  assert.equal(said({ type: "power-attack", targetId: "blue-1" }, "power_attack"), "Power attack at Nym");
  assert.equal(said({ type: "walk-left", targetId: "red-1" }, "walkleft"), "Walk left");
  assert.equal(said({ type: "bombard", targetId: "blue-1" }, "bombardleft"), "Bombard at Nym");
  // Off the ring there is no slot verb; the engine's own token is worded.
  assert.equal(said({ type: "rest", targetId: "red-1" }), "Rest");
  assert.equal(said({ type: "walk-right", targetId: "red-1" }), "Walk right");
  assert.equal(said({ type: "rank-back", targetId: "red-1" }), "Step back a rank");
  assert.equal(said({ type: "rank-front", targetId: "red-1" }), "Step forward a rank");
  assert.equal(said({ type: "swap-weapons", targetId: "red-1" }), "Swap weapons");
  assert.equal(said({ type: "cast-gale", targetId: "blue-1" }), "Cast gale at Nym");
  assert.equal(said({ type: "cast-teleport", targetId: "red-1" }), "Cast teleport");
  assert.equal(said({ type: "drink-potion", targetId: "red-1", itemId: 5 }), "Drink potion #5");
  assert.equal(said({ type: "taunt", targetId: "blue-1" }), "Taunt at Nym");
});

/* ------------------------------------------------------------------ */
/* 7. Nothing unreachable, over real bouts                             */
/* ------------------------------------------------------------------ */

test("without the engine's menu the ring holds nothing and every offered action is still listed", () => {
  const host = demoHost({ perSide: 1, seed: 7 });
  const actorId = host.currentCombatantId();
  const model = ringModelFor({
    actorId, combatants: host.wire().teams.flatMap((team) => team.combatants), legal: host.legalActions(), menuFor: noMenu
  });
  assert.equal(model.stance, null);
  assert.ok(model.slots.every((slot) => slot.verb === null && slot.action === null));
  assert.deepEqual(model.offRing.map((entry) => line(entry.action)), host.legalActions().map(line));
});

test("a menu that throws is no ring, and says why — the shell draws the raw list and logs it", () => {
  const host = demoHost({ perSide: 1, seed: 7 });
  const actorId = host.currentCombatantId();
  const model = ringModelFor({
    actorId,
    combatants: host.wire().teams.flatMap((team) => team.combatants),
    legal: host.legalActions(),
    menuFor: () => { throw new Error("no such foe"); }
  });
  assert.equal(model.stance, null);
  assert.equal(model.menuError, "no such foe");
  assert.equal(model.selectedId, "blue-1", "the selection does not depend on the menu");
  assert.deepEqual(model.offRing.map((entry) => line(entry.action)), host.legalActions().map(line));
});

test("an actor who is not on the field selects nobody and lists what he is offered", () => {
  const combatants = [fighter("red-1", "red", 0, 200), fighter("blue-1", "blue", 300, 200)];
  const legal = [{ type: "rest", targetId: "red-9" }];
  const model = ringModelFor({ actorId: "red-9", combatants, legal, menuFor: () => assert.fail("no menu without a selection") });
  assert.equal(model.selectedId, null);
  assert.deepEqual(model.foeIds, []);
  assert.equal(model.stance, null);
  assert.deepEqual(model.offRing.map((entry) => entry.action), [{ type: "rest", targetId: "red-9", actorId: "red-9" }]);
});

/** The four fields `actionIsLegal` compares, as one string. */
const identity = (action) => JSON.stringify([action.type, action.targetId, action.spellKind ?? null, action.itemId ?? null]);

test("over whole bouts, with every foe selected in turn: each slot holds what the build wires there, nothing is offered twice, and the offer is covered exactly", () => {
  let turns = 0;
  let selections = 0;
  for (const perSide of [1, 3]) {
    for (const kit of ["", "tricks"]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const host = demoHost({ perSide, seed, kit });
        for (let taken = 0; !host.battle.result && taken < 1500; taken += 1) {
          const actorId = host.currentCombatantId();
          const offer = host.legalActions().map(identity);
          const reached = new Set();
          const first = modelOf(host);
          for (const foeId of first.foeIds) {
            const model = modelOf(host, foeId);
            assert.equal(model.selectedId, foeId);
            const shown = [...model.slots.filter((slot) => slot.action).map((slot) => slot.action), ...model.offRing.map((entry) => entry.action)];
            const ids = shown.map(identity);
            assert.equal(new Set(ids).size, ids.length, `${actorId} vs ${foeId}: an action listed twice`);
            for (const action of shown) {
              assert.equal(action.actorId, actorId);
              assert.ok(offer.includes(identity(action)), `${actorId} vs ${foeId}: ${identity(action)} is not on offer`);
              reached.add(identity(action));
            }
            // The build's own table, transcribed from the action dump apart from the engine's copy.
            const wiring = SS2_BUTTON_WIRING[model.stance.frame][model.stance.facing];
            for (const slot of model.slots.filter((candidate) => candidate.verb)) {
              assert.ok(wiring[slot.slot].some((one) => one.verb === slot.verb),
                `${model.stance.frame} ${model.stance.facing} ${slot.slot} does not wire ${slot.verb}`);
            }
            selections += 1;
          }
          assert.deepEqual([...reached].sort(), [...offer].sort(), `${actorId}, turn ${taken}: some offered action is on no foe's ring or list`);
          turns += 1;
          host.submit({ ...host.suggestAction(actorId), actorId });
        }
        assert.ok(host.battle.result, `${perSide}v${perSide} ${kit || "plain"} seed ${seed} finished`);
      }
    }
  }
  assert.ok(turns > 500 && selections > turns, `${turns} turns, ${selections} selections`);
});
