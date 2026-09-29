/**
 * THE REACH PREVIEW — decision 1 of `docs/design/battle-ui.md#decided-hud-2026-09-24`
 * ("multiple enemies means TARGET PICKING, not area attacks"), built 2026-09-28
 * (ring3, slice "reach"): hovering or focusing a spell or bombard lights EVERY
 * foe it can reach with a numbered gold ring (1–3, left to right) and dims the
 * rest; the hover text names the target ("Fireball → Nym · click another lit foe
 * to change"); one click still fires at the SELECTED foe (the who-first decision
 * stands).
 *
 * Seams: `ringReachFor`, `ringReachAfter`, `ringReachShownFor` and
 * `ringPreviewFor`'s `reach` (`tools/arena/ring-preview.js`), over REAL arena
 * turns off a real host — and, read as text, the few lines of
 * `tools/arena/main.js` that hand them to the page.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { rngJournal } from "../src/team/resolver.js";
import { resourceValue } from "../src/team/resources.js";
import { SS2_ARENA, ss2BattleValues, ss2Combatant, ss2PhysicalSize, ss2TeamRules } from "../src/team/ss2-rules.js";
import { ss2ColossusYscaleAfter } from "../src/common/ss2-figure.js";
import { actorSpanFor, stageFitFor, stageProjectorFor, stepFramedCamera } from "../src/render/arena-backdrop.js";
import { rankOfDepth } from "../src/render/arena-shell.js";
import { combatPanelLayoutFor } from "../src/render/combat-panel.js";
import { figureScaleFor } from "../src/render/figure.js";
import { combatHudArtFor, ringBoundsFor } from "../tools/arena/combat-hud.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { ringActionLabel, ringClickCommand, ringEntries, ringModelFor, ringSameAction, ringShownFor } from "../tools/arena/ring.js";
import { RING_REACH_DIM, ringPreviewFor, ringReachAfter, ringReachFade, ringReachFor, ringReachShownFor } from "../tools/arena/ring-preview.js";
import {
  fighterBoxFor,
  foeAt,
  ringButtonsAt,
  ringButtonsInside,
  ringItemButtonsAt,
  ringMoveButtonsAt,
  ringPlacementFor,
  ringReachNumberAt,
  ringReachNumberHit,
  ringSlotAt,
  ringSwapButtonAt
} from "../tools/arena/ring-layout.js";

const deps = { ss2Combatant, ss2BattleValues };
/** The arena's demo bout, headless: the roster and rule set `tools/arena/main.js` builds. */
function demoHost({ perSide = 3, seed = 1, kit = "" } = {}) {
  const items = demoItemsFrom(kit);
  return createVanillaBattleHost({
    teams: [demoSide("red", perSide, { ...deps, items, seed }), demoSide("blue", perSide, { ...deps, items, seed })],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed
  });
}
/** Plays the rule set's own AI for `turns` submissions. */
function played(host, turns) {
  for (let taken = 0; taken < turns; taken += 1) {
    const due = host.currentCombatantId();
    host.submit({ ...host.suggestAction(due), actorId: due });
  }
  return host;
}
/** Whoever is due, his ring with `previous` selected (the shell's own call), the offer and where everyone stands. */
function turnOf(host, previous = null) {
  const actorId = host.currentCombatantId();
  const everyone = host.wire().teams.flatMap((team) => team.combatants);
  const legal = host.legalActions();
  const model = ringModelFor({ actorId, combatants: everyone, legal, previous, menuFor: (id) => host.unavailableActions(actorId, id) });
  const xOf = (id) => everyone.find((combatant) => combatant.id === id)?.x;
  return { actorId, everyone, legal, model, xOf };
}

/* ------------------------------------------------------------------ */
/* 1. What a spell or a shot reaches, on real arena turns              */
/* ------------------------------------------------------------------ */

test("A SPELL'S REACH, ON A REAL ARENA TURN: pointing at Gale lights every foe the engine offers it against, numbered 1-3 left to right, the selected one marked, and dims nobody else", () => {
  // 3v3 `tricks`, seed 1, the opening: red-1 (Ruk) is due with blue-1 (Cidra) selected — the nearest in
  // his own rank — and Gale on E (`inventory_button1`), aimed at her. The engine offers `cast-gale` at
  // blue-1, blue-2 and blue-3 (a scratch probe of `host.legalActions()`; spells take no range and no lane
  // test), who stand at x 250 (Cidra), 380 (Nym) and 510 (Orso): left to right, 1, 2, 3.
  const { model, legal, xOf } = turnOf(demoHost({ kit: "tricks" }));
  assert.equal(model.actorId, "red-1");
  assert.equal(model.selectedId, "blue-1");
  const gale = model.items.find((item) => item.key === "E");
  assert.equal(gale.words, "Gale");
  assert.deepEqual({ type: gale.action.type, targetId: gale.action.targetId }, { type: "cast-gale", targetId: "blue-1" });
  const reach = ringReachFor(model, gale.action, { legal, xOf });
  assert.ok(reach, "a foe spell has a reach");
  assert.deepEqual(reach.lit.map(({ foeId, number, selected }) => ({ foeId, number, selected })), [
    { foeId: "blue-1", number: 1, selected: true },
    { foeId: "blue-2", number: 2, selected: false },
    { foeId: "blue-3", number: 3, selected: false }
  ]);
  assert.deepEqual([...reach.dim], [], "every living foe is in reach of the spell: nobody is dimmed");
  assert.equal(reach.type, "cast-gale");
});

test("A SHOT'S REACH, ON A REAL ARENA TURN: the bombard lights all three foes; the snipe only the two with a clean line, and dims the one a body screens — whether he is selected or not", () => {
  // 3v3 plain, seed 1, eight AI submissions in: red-2 (Vasso, the demo archer) is due on the long bow
  // frame facing right, blue-2 (Nym) selected. Foes: blue-1 Cidra at x 126, blue-2 Nym at 380, blue-3
  // Orso at 434. The engine offers `bombard` at all three (a lob clears every body) and `snipe` at
  // blue-2 and blue-3 only — blue-1's flat line is blocked (`ss2ShotBlocked`; a scratch probe of
  // `host.legalActions()`).
  const host = played(demoHost({ kit: "" }), 8);
  const { model, legal, xOf } = turnOf(host);
  assert.equal(model.actorId, "red-2");
  assert.equal(model.selectedId, "blue-2");
  assert.equal(model.stance.frame, "longrange_archer");
  const bombard = model.slots.find((slot) => slot.verb === "bombardright");
  const snipe = model.slots.find((slot) => slot.verb === "sniperight");
  const shape = (reach) => reach.lit.map(({ foeId, number, selected }) => [foeId, number, selected]);
  const lob = ringReachFor(model, bombard.action, { legal, xOf });
  assert.deepEqual(shape(lob), [["blue-1", 1, false], ["blue-2", 2, true], ["blue-3", 3, false]]);
  assert.deepEqual([...lob.dim], []);
  const flat = ringReachFor(model, snipe.action, { legal, xOf });
  assert.deepEqual(shape(flat), [["blue-2", 1, true], ["blue-3", 2, false]]);
  assert.deepEqual([...flat.dim], ["blue-1"], "the screened foe is dimmed");

  // Cidra selected: the snipe slot is GREYED (`body-blocks`, S9) and sends nothing — but pointing at it
  // still lights the two foes a snipe can reach, so the player sees whom to pick; Cidra, selected, is dimmed.
  const screened = turnOf(host, "blue-1");
  assert.equal(screened.model.selectedId, "blue-1");
  const greyed = screened.model.slots.find((slot) => slot.verb === "sniperight");
  assert.equal(greyed.action, null);
  assert.equal(greyed.reason.code, "body-blocks");
  const shown = ringShownFor(screened.model, greyed.slot);
  const reach = ringReachFor(screened.model, shown, { legal: screened.legal, xOf: screened.xOf });
  assert.ok(reach, "a greyed snipe still has a reach");
  assert.deepEqual(shape(reach), [["blue-2", 1, false], ["blue-3", 2, false]]);
  assert.deepEqual([...reach.dim], ["blue-1"]);
  assert.equal(reach.action, null, "a greyed button sends nothing, so its reach carries no action");
  assert.equal(reach.type, "snipe");
  // A greyed entry that is not this ring's own — its button aimed elsewhere, another button, another reason — is nobody's.
  const other = (change) => ringReachFor(screened.model, { ...shown, ...change }, { legal: screened.legal, xOf: screened.xOf });
  assert.equal(other({ withheld: { ...shown.withheld, targetId: "blue-3" } }), null);
  assert.equal(other({ slot: "optionC" }), null);
  assert.equal(other({ reason: { ...shown.reason, code: "in-reach" } }), null);
});

test("ONLY A SPELL OR A SHOT AT A FOE HAS A REACH, AND ONLY WITH A FOE TO PICK: not a swing, a taunt, a spell the caster casts on himself, a walk; not in a 1v1; not a verb the offer holds at nobody", () => {
  // 3v3 `tricks`, seed 2, one AI submission in: red-1 is on the CLOSE warrior frame against blue-1 — the
  // swings are his, at blue-1 alone (melee takes reach and the lane), and Teleport (R) is aimed at himself.
  const close = turnOf(played(demoHost({ kit: "tricks", seed: 2 }), 1));
  assert.equal(close.model.actorId, "red-1");
  assert.equal(close.model.stance.frame, "closerange_warrior");
  const none = (action, why) => assert.equal(ringReachFor(close.model, action, { legal: close.legal, xOf: close.xOf }), null, why);
  const swings = close.model.slots.filter((slot) => slot.action && /_attack$/.test(slot.verb));
  assert.ok(swings.length >= 3, "the three swings are on the ring");
  for (const swing of swings) none(swing.action, `${swing.verb}: a swing picks no target from afar`);
  const teleport = close.model.items.find((item) => item.words === "Teleport");
  assert.equal(teleport.action.targetId, "red-1");
  none(teleport.action, "a spell the caster casts on himself reaches no foe");
  for (const move of close.model.moves.filter((one) => one.action)) none(move.action, `${move.move}: a move reaches nobody`);
  // The same bout's LONG frame (tricks seed 1): the taunt at blue-1 is a foe-targeted verb, and still no reach.
  const far = turnOf(demoHost({ kit: "tricks" }));
  const taunt = far.model.slots.find((slot) => slot.verb === "taunt" && slot.action);
  assert.ok(taunt, "the taunt is on the long frame");
  assert.equal(ringReachFor(far.model, taunt.action, { legal: far.legal, xOf: far.xOf }), null, "the taunt picks no target from afar");

  // A 1v1 (`blasts`, seed 1, the opening): Fireball at the only foe — nothing to pick, so no preview.
  const duel = turnOf(demoHost({ perSide: 1, kit: "blasts" }));
  const fireball = duel.model.items.find((item) => item.words === "Fireball");
  assert.equal(fireball.action.targetId, "blue-1");
  assert.deepEqual([...duel.model.foeIds], ["blue-1"]);
  assert.equal(ringReachFor(duel.model, fireball.action, { legal: duel.legal, xOf: duel.xOf }), null, "one foe: no target to pick");

  // A spell the offer holds at NOBODY lights nobody — and is no preview (a hand-made empty offer against the real ring).
  const gale = far.model.items.find((item) => item.words === "Gale");
  assert.equal(ringReachFor(far.model, gale.action, { legal: [], xOf: far.xOf }), null, "nothing reachable: no preview");
  assert.equal(ringReachFor(far.model, null, { legal: far.legal }), null, "nothing shown");
  assert.equal(ringReachFor(null, gale.action, { legal: far.legal }), null, "no ring");
});

test("THE NUMBERS FOLLOW WHERE THE FOES ARE DRAWN, left to right — not the order the ring lists them; a tie, or a foe with no drawn x, keeps the stage's order (Tab's)", () => {
  const { model, legal } = turnOf(demoHost({ kit: "tricks" }));
  const gale = model.items.find((item) => item.words === "Gale").action;
  assert.deepEqual([...model.foeIds], ["blue-1", "blue-2", "blue-3"], "the stage's order: x 250, 380, 510");
  const numbers = (drawn) => ringReachFor(model, gale, { legal, xOf: (id) => drawn[id] }).lit.map(({ foeId, number }) => `${number}:${foeId}`);
  // Drawn right to left (hand-made canvas x): Orso 1, Nym 2, Cidra 3.
  assert.deepEqual(numbers({ "blue-1": 600, "blue-2": 410, "blue-3": 90 }), ["1:blue-3", "2:blue-2", "3:blue-1"]);
  // A tie keeps the stage's order: Cidra and Orso both at 300 — Cidra first.
  assert.deepEqual(numbers({ "blue-1": 300, "blue-2": 120, "blue-3": 300 }), ["1:blue-2", "2:blue-1", "3:blue-3"]);
  // Not drawn this frame: after the drawn ones, in the stage's order.
  assert.deepEqual(numbers({ "blue-2": 500 }), ["1:blue-2", "2:blue-1", "3:blue-3"]);
  assert.deepEqual(ringReachFor(model, gale, { legal }).lit.map(({ foeId }) => foeId), ["blue-1", "blue-2", "blue-3"], "no drawn x at all: the stage's order");
});

test("A VERB IS ITS TYPE, ITS ITEM AND ITS SPELL KIND — the fields host.submit matches an offer on: an offer of the same type with another kind or item lights nobody", () => {
  const { model, xOf } = turnOf(demoHost({ kit: "tricks" }));
  const gale = model.items.find((item) => item.words === "Gale").action;
  const at = (targetId, extra = {}) => ({ type: "cast-gale", targetId, ...extra });
  // Hand-made offers against the real ring: blue-2's gale carries a spell kind, blue-3's an item id.
  const reach = ringReachFor(model, gale, { legal: [at("blue-1"), at("blue-2", { spellKind: "other" }), at("blue-3", { itemId: 9 })], xOf });
  assert.deepEqual(reach.lit.map(({ foeId }) => foeId), ["blue-1"]);
  assert.deepEqual([...reach.dim], ["blue-2", "blue-3"]);
  // Another spell's offer lights nobody for Gale.
  const whirl = ringReachFor(model, gale, { legal: [at("blue-1"), { type: "cast-whirlwind", targetId: "blue-2" }], xOf });
  assert.deepEqual(whirl.lit.map(({ foeId }) => foeId), ["blue-1"]);
  // An offer at someone who is not a living foe of the actor — his ally, himself — is nobody to light.
  const odd = ringReachFor(model, gale, { legal: [at("blue-1"), at("red-2"), at("red-1")], xOf });
  assert.deepEqual(odd.lit.map(({ foeId }) => foeId), ["blue-1"]);
  assert.deepEqual([...odd.dim], ["blue-2", "blue-3"]);
});

/* ------------------------------------------------------------------ */
/* 2. The hover text names the target                                  */
/* ------------------------------------------------------------------ */

test("THE HOVER TEXT NAMES THE TARGET, in the decision's words — \"Fireball → Nym · click another lit foe to change\" — then the engine's preview; with no other foe lit, no hint; with no reach, S7's words unchanged", () => {
  // 3v3 `blasts`, seed 1, the opening, Nym (blue-2) selected: red-1's Fireball is aimed at her, and the
  // engine previews it (`host.previewAction`, a scratch probe): cannot miss, 80–160 damage, 12 stamina.
  const host = demoHost({ kit: "blasts" });
  const { model, legal, xOf } = turnOf(host, "blue-2");
  const nameOf = (id) => host.combatant(id)?.name ?? id;
  const fireball = model.items.find((item) => item.words === "Fireball").action;
  assert.deepEqual({ type: fireball.type, targetId: fireball.targetId }, { type: "cast-fireball", targetId: "blue-2" });
  const reach = ringReachFor(model, fireball, { legal, xOf });
  assert.equal(reach.lit.length, 3);
  // The decision's own example, word for word, when there is nothing to preview.
  assert.equal(ringPreviewFor(model, fireball, null, { nameOf, reach }).text, "Fireball → Nym · click another lit foe to change");
  const shown = ringPreviewFor(model, fireball, host.previewAction(fireball), { nameOf, reach });
  assert.equal(shown.text, "Fireball → Nym: cannot miss · 80–160 damage · costs 12 stamina · click another lit foe to change");
  assert.equal(shown.label, "Fireball → Nym");
  // S7's words when there is no reach to show (a 1v1, a swing, anything else): unchanged.
  assert.equal(ringPreviewFor(model, fireball, host.previewAction(fireball), { nameOf }).text,
    "Fireball at Nym: cannot miss · 80–160 damage · costs 12 stamina");
  // A reach that is ANOTHER action's (a stale one) does not reword this one.
  const lightning = model.items.find((item) => item.words === "Lightning Bolt").action;
  assert.equal(ringPreviewFor(model, lightning, null, { nameOf, reach }).text, "Lightning Bolt at Nym");

  // The archer's shots, 3v3 plain seed 1 eight in, Nym selected (the engine's previews, a scratch probe).
  const archer = played(demoHost({ kit: "" }), 8);
  const bow = turnOf(archer);
  const archerName = (id) => archer.combatant(id)?.name ?? id;
  const bombard = bow.model.slots.find((slot) => slot.verb === "bombardright").action;
  assert.equal(ringPreviewFor(bow.model, bombard, archer.previewAction(bombard), { nameOf: archerName, reach: ringReachFor(bow.model, bombard, bow) }).text,
    "Bombard → Nym: 73% to hit · 12–24 damage · costs 10 stamina · click another lit foe to change");
  const snipe = bow.model.slots.find((slot) => slot.verb === "sniperight").action;
  assert.equal(ringPreviewFor(bow.model, snipe, archer.previewAction(snipe), { nameOf: archerName, reach: ringReachFor(bow.model, snipe, bow) }).text,
    "Snipe → Nym: 99% to hit · 12 damage · costs 10 stamina · click another lit foe to change");
  // Only Nym in reach (a hand-made offer against the real ring): no other lit foe to click — no hint.
  const alone = ringReachFor(bow.model, snipe, { legal: [{ type: "snipe", targetId: "blue-2" }], xOf: bow.xOf });
  assert.deepEqual(alone.lit.map(({ foeId }) => foeId), ["blue-2"]);
  assert.equal(ringPreviewFor(bow.model, snipe, archer.previewAction(snipe), { nameOf: archerName, reach: alone }).text,
    "Snipe → Nym: 99% to hit · 12 damage · costs 10 stamina");
});

/* ------------------------------------------------------------------ */
/* 3. Clicking another lit foe selects him, and the preview stays      */
/* ------------------------------------------------------------------ */

test("CLICK ANOTHER LIT FOE: he is selected, the preview STAYS — the same foes lit, the spell now aimed at him, its words naming him — and one click on the spell fires at him", () => {
  // 3v3 `blasts`, seed 1, the opening: red-1 (Ruk) with Cidra (blue-1) selected; Fireball on R.
  const host = demoHost({ kit: "blasts" });
  const nameOf = (id) => host.combatant(id)?.name ?? id;
  const turn = "0:0";
  const first = turnOf(host);
  assert.equal(first.model.selectedId, "blue-1");
  const fireball = first.model.items.find((item) => item.words === "Fireball");
  // The pointer on the Fireball: its verb is the one previewed.
  let state = ringReachAfter(null, { turn, shown: fireball.action, model: first.model, legal: first.legal });
  assert.deepEqual({ ...state }, { turn, type: "cast-fireball", itemId: null, spellKind: null });
  // It leaves the button for the sand, then a foe: nothing is shown, and the preview is KEPT.
  assert.equal(ringReachAfter(state, { turn, shown: null, model: first.model, legal: first.legal }), state);
  assert.equal(ringReachShownFor(first.model, state, { turn }), fireball.action, "still the Fireball at Cidra");
  // A click on Nym, who is lit: the shell selects him and builds his ring (`selectRingFoe` -> `renderControls`).
  const second = turnOf(host, "blue-2");
  assert.equal(second.model.selectedId, "blue-2");
  const shown = ringReachShownFor(second.model, state, { turn });
  const aimed = second.model.items.find((item) => item.words === "Fireball").action;
  assert.equal(shown, aimed, "the preview stays: the new ring's own Fireball, aimed at Nym");
  assert.deepEqual({ type: shown.type, targetId: shown.targetId }, { type: "cast-fireball", targetId: "blue-2" });
  const reach = ringReachFor(second.model, shown, { legal: second.legal, xOf: second.xOf });
  assert.deepEqual(reach.lit.map(({ foeId, number, selected }) => [foeId, number, selected]),
    [["blue-1", 1, false], ["blue-2", 2, true], ["blue-3", 3, false]], "the same foes lit; Nym now the selected one");
  assert.equal(ringPreviewFor(second.model, shown, host.previewAction(shown), { nameOf, reach }).text,
    "Fireball → Nym: cannot miss · 80–160 damage · costs 12 stamina · click another lit foe to change");
  // One click on the Fireball's place (R) fires at the SELECTED foe — Nym — and it is on offer.
  const command = ringClickCommand(second.model, "R", { confirm: false });
  assert.equal(command.kind, "act");
  assert.deepEqual({ ...command.action }, { type: "cast-fireball", targetId: "blue-2", actorId: "red-1" });
  assert.ok(second.legal.some((option) => option.type === "cast-fireball" && option.targetId === "blue-2"));

  // On its way to a foe the pointer crosses other buttons of the ring (from the items row to a foe on the right,
  // straight through optionD's column): one that is not a spell or shot with a reach HIDES the preview while it
  // is on it — its own words show, no foe is lit — and KEEPS it: back on nothing, the preview is up again.
  const walk = second.model.moves.find((move) => move.action);
  const crossing = ringReachAfter(state, { turn, shown: walk.action, model: second.model, legal: second.legal });
  assert.equal(crossing, state, "a button crossed on the way keeps the preview");
  assert.equal(ringReachFor(second.model, walk.action, { legal: second.legal, xOf: second.xOf }), null, "and lights nobody while it is pointed at");
  assert.equal(ringReachShownFor(second.model, ringReachAfter(crossing, { turn, shown: null, model: second.model, legal: second.legal }), { turn }), aimed, "back on nothing: up again");
  // The next turn drops it.
  assert.equal(ringReachAfter(state, { turn: "0:1", shown: null, model: second.model, legal: second.legal }), null, "another turn");
  assert.equal(ringReachAfter(state, { turn: "0:1", shown: walk.action, model: second.model, legal: second.legal }), null, "another turn, whatever is pointed at");
  assert.equal(ringReachShownFor(second.model, state, { turn: "0:1" }), null, "a standing preview is its own turn's");
  assert.equal(ringReachShownFor(second.model, null, { turn }), null);
  // Another spell with a reach replaces it.
  const bolt = second.model.items.find((item) => item.words === "Lightning Bolt").action;
  assert.equal(ringReachAfter(state, { turn, shown: bolt, model: second.model, legal: second.legal }).type, "cast-lightning-bolt");
});

test("CLICK A FOE THE SNIPE CANNOT REACH: he is selected and the preview stays — his snipe GREYED (a body in the line), the two it can reach still lit, him dimmed", () => {
  // 3v3 plain, seed 1, eight in: red-2 (Vasso) on the long bow frame, Nym selected; snipe at Nym and Orso only.
  const host = played(demoHost({ kit: "" }), 8);
  const turn = "archer";
  const first = turnOf(host);
  const snipe = first.model.slots.find((slot) => slot.verb === "sniperight");
  const state = ringReachAfter(null, { turn, shown: snipe.action, model: first.model, legal: first.legal });
  assert.equal(state.type, "snipe");
  const second = turnOf(host, "blue-1");
  const shown = ringReachShownFor(second.model, state, { turn });
  assert.equal(shown.reason?.code, "body-blocks", "on Cidra's ring the snipe is the greyed one");
  assert.equal(shown.slot, "optionF");
  const reach = ringReachFor(second.model, shown, { legal: second.legal, xOf: second.xOf });
  assert.deepEqual(reach.lit.map(({ foeId }) => foeId), ["blue-2", "blue-3"]);
  assert.deepEqual([...reach.dim], ["blue-1"]);
  // Pointing at the greyed snipe keeps it the verb previewed; clicking it sends nothing (S9).
  assert.deepEqual({ ...ringReachAfter(state, { turn, shown, model: second.model, legal: second.legal }) }, { ...state });
  assert.equal(ringClickCommand(second.model, "optionF").kind, "ignore");

  // A spell or shot that lights NOBODY is no preview to switch to: the bombard's preview standing, the pointer
  // crossing a snipe the offer holds at nobody (a hand-made offer with no snipe) keeps it; one it reaches replaces it.
  const bombard = first.model.slots.find((slot) => slot.verb === "bombardright");
  const lob = ringReachAfter(null, { turn, shown: bombard.action, model: first.model, legal: first.legal });
  assert.equal(lob.type, "bombard");
  const noSnipes = first.legal.filter((option) => option.type !== "snipe");
  assert.equal(ringReachAfter(lob, { turn, shown: snipe.action, model: first.model, legal: noSnipes }), lob, "a snipe reaching nobody keeps the bombard's");
  assert.equal(ringReachAfter(lob, { turn, shown: snipe.action, model: first.model, legal: first.legal }).type, "snipe", "a snipe reaching somebody replaces it");
});

/* ------------------------------------------------------------------ */
/* 4. The look: the dim, and where a number stands                     */
/* ------------------------------------------------------------------ */

test("A FOE OUT OF REACH IS DIMMED THROUGH THE PAINTERS' OWN FADE: 0.45 of what he showed is left — a standing foe drawn at 0.45, one already fading at 0.45 of his own", () => {
  // `fade` 0 is opaque, 1 gone (`src/render/timeline.js`); the painters draw at `1 - fade`. Worked by hand:
  assert.equal(ringReachFade(0), 0.55, "a standing foe: 1 - 1 x 0.45");
  assert.ok(Math.abs(ringReachFade(0.2) - 0.64) < 1e-12, "a foe at fade 0.2: 1 - 0.8 x 0.45");
  assert.equal(ringReachFade(1), 1, "one already gone stays gone");
  assert.equal(ringReachFade(undefined), 0.55, "no fade is none");
  assert.equal(RING_REACH_DIM, 0.45);
});

test("A LIT FOE'S NUMBER STANDS OVER HIS HEAD — a disc centred on his drawn box, its gap above the box's top, at the stage fit's size, kept on the visible stage", () => {
  const stage = { x: 0, y: 0, width: 1280, height: 794 };
  // A fighter drawn from x 100 to 160, his head at y 200, the stage fit at 2 canvas px a stage px: the disc,
  // 9 stage px, is 18 canvas px; its gap, 4, is 8; its figure, 12, is 24 — so it stands at (130, 200 - 8 - 18).
  assert.deepEqual({ ...ringReachNumberAt({ x0: 100, x1: 160, y0: 200, y1: 420 }, { scale: 2, stage }) }, { x: 130, y: 174, r: 18, px: 24 });
  // A head at the stage's top: the disc stays on it, its top on the stage's.
  assert.deepEqual({ ...ringReachNumberAt({ x0: 100, x1: 160, y0: 10, y1: 230 }, { scale: 2, stage }) }, { x: 130, y: 18, r: 18, px: 24 });
  // Half off the stage's left: the disc slides onto it.
  assert.equal(ringReachNumberAt({ x0: -40, x1: 20, y0: 200, y1: 420 }, { scale: 2, stage }).x, 18);
  // And its right, at the fit of a 640-wide canvas.
  const small = ringReachNumberAt({ x0: 600, x1: 700, y0: 100, y1: 300 }, { scale: 1, stage: { x: 0, y: 0, width: 640, height: 397 } });
  assert.deepEqual({ ...small }, { x: 631, y: 100 - 4 - 9, r: 9, px: 12 });
});

test("A LIT FOE'S NUMBER IS HIS TO CLICK — it stands over his head, OUTSIDE his box: a point on the disc, rim included, is that foe; two discs touching, the nearer; off every disc, nobody", () => {
  // Found on this slice's self-review: the number is what a player clicks ("click the 2"), and a click there hit
  // no foe's box — the bare stage, which puts the preview away. Hand-placed discs, canvas px.
  const numbers = [{ foeId: "blue-1", x: 100, y: 100, r: 10 }, { foeId: "blue-2", x: 115, y: 100, r: 10 }];
  assert.equal(ringReachNumberHit(numbers, 100, 100), "blue-1", "its centre");
  assert.equal(ringReachNumberHit(numbers, 100, 90), "blue-1", "its rim");
  assert.equal(ringReachNumberHit(numbers, 108, 100), "blue-2", "where they overlap: the nearer, 7 px off against 8");
  // ...the nearer even when it is the FIRST listed (a mutation keeping the last disc hit survived the line above).
  assert.equal(ringReachNumberHit(numbers, 106, 100), "blue-1", "6 px off against 9");
  assert.equal(ringReachNumberHit(numbers, 100, 89.9), null, "just off the rim");
  assert.equal(ringReachNumberHit(numbers, 300, 300), null);
  assert.equal(ringReachNumberHit([], 100, 100), null, "no preview, no numbers");
  assert.equal(ringReachNumberHit(null, 100, 100), null);
});

/* ------------------------------------------------------------------ */
/* 5. The shell's wiring, read as TEXT (main.js cannot be imported)    */
/* ------------------------------------------------------------------ */

const raw = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
/** Comments out, strings blanked, so a word in prose cannot match. */
const code = raw
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
function functionBody(name) {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is not defined in tools/arena/main.js`);
  let depth = 0;
  // The body's brace is the one after the parameter list's `)` — a destructured parameter has braces of its own.
  for (let index = code.indexOf(") {", start) + 2; index < code.length; index += 1) {
    if (code[index] === "{") depth += 1;
    else if (code[index] === "}") { depth -= 1; if (depth === 0) return code.slice(start, index + 1); }
  }
  throw new Error(`${name}'s braces do not balance`);
}
const at = (body, text) => {
  const index = body.indexOf(text);
  assert.ok(index >= 0, `the shell has \`${text}\``);
  return index;
};

test("THE SHELL: the ring on screen keeps the offer it was built from; the preview line and the stage show what the pointer or the focus is on, else the reach preview left standing — which a click on a foe, Tab or a rebuild never drops, and a click on the bare stage puts away", () => {
  const controls = functionBody("renderControls");
  const view = controls.slice(at(controls, "ringView = {"), controls.indexOf("};", at(controls, "ringView = {")));
  assert.match(view, /legal: panel\.buttons\.map\(\(\{ action \}\) => action\)/, "the offer the ring was built from, for its reach");
  const preview = functionBody("renderRingPreview");
  // What the pointer or the focus is on (S7, S9) — then the reach preview it sets, keeps or drops.
  assert.match(preview, /const live = view\s*\? ringPreviewShown\(\{ strip: ringStripState, stageHover: ringHover \? ringShownFor\(view\.model, ringHover\) : null, pending \}\)\s*: null;/);
  assert.match(preview, /if \(view\) ringReach = ringReachAfter\(ringReach, \{ turn: view\.turnKey, shown: live\.action, model: view\.model, legal: view\.legal \}\);/);
  assert.match(preview, /ringReachShown = view \? live\.action \?\? ringReachShownFor\(view\.model, ringReach, \{ turn: view\.turnKey \}\) : null;/);
  // The line says what is shown — the standing preview included (its words name its target).
  assert.ok(at(preview, "const shown = ringReachShown;") < at(preview, "const line = shown ? ringShownTextOf(shown) : null;"));
  // (A template literal is blanked whole in `code`: read the raw source.) "Chosen — " is the live choice's alone.
  assert.ok(raw.includes('? `${live.chosen ? "Chosen — " : ""}${line}`'));
  // Set there, and put away by one thing only: a click on the bare stage. A click on a foe, Tab, a rebuild —
  // none of them drops the preview.
  assert.equal([...code.matchAll(/(?<!let )\bringReach = /g)].length, 2, "renderRingPreview's, and the bare stage's click");
  assert.equal([...code.matchAll(/(?<!let )\bringReachShown = /g)].length, 1);
  assert.match(code, /let ringReach = null;\s*let ringReachShown = null;/);
  // The canvas click still selects a foe by what was drawn (S2) — a lit foe's NUMBER too, which stands over his
  // head, outside his box, and is painted over the fighters (so it is tested first) — and the ring is built again
  // for him; on NO foe (and no button: that returned above) it puts a standing preview away.
  assert.match(code, /const foeId = ringReachNumberHit\(ringReachNumbers, point\.x, point\.y\) \?\? foeAt\(fighterBoxes, point\.x, point\.y, ringView\.model\.foeIds\);\s*if \(foeId\) selectRingFoe\(foeId\);\s*else if \(ringReach\) \{\s*ringReach = null;\s*renderRingPreview\(\);\s*\}/);
  // The pointer over a number is over his foe (the cursor says so), and where the numbers were drawn is re-made
  // each frame and forgotten with the ring's buttons when the ring is built again.
  assert.match(code, /const foeId = point && !slot \? ringReachNumberHit\(ringReachNumbers, point\.x, point\.y\) \?\? foeAt\(fighterBoxes, point\.x, point\.y, ringView\.model\.foeIds\) : null;/);
  assert.match(code, /let ringReachNumbers = \[\];/);
  assert.match(controls, /ringButtons = \[\];\s*ringReachNumbers = \[\];/);
  const numbers = functionBody("paintReachNumbers");
  assert.ok(at(numbers, "ringReachNumbers = [];") < at(numbers, "if (!ringShown()) return;"), "forgotten before anything else, so no frame keeps an old one");
  assert.match(numbers, /ringReachNumbers\.push\(\{ foeId, x: disc\.x, y: disc\.y, r: disc\.r \}\);/);
  assert.equal([...code.matchAll(/(?<!let )\bringReachNumbers = /g)].length, 2, "paintReachNumbers' and renderControls'");
  // Every preview's words are the reach's: the target named, the hint (`ringPreviewFor`'s `reach`).
  assert.match(functionBody("ringPreviewTextOf"), /reach: ringReachFor\(view\.model, action, \{ legal: view\.legal \}\)/);
});

test("THE SHELL: the stage lights every foe in reach — a gold ring on the sand, dashed but for the selected one's — dims every other through the painters' fade and his plate, and numbers them over their heads after the HUD, before the ring", () => {
  const stage = functionBody("renderStage");
  const reach = at(stage, "const reach = ringShown() ? ringReachFor(ringView.model, ringReachShown, { legal: ringView.legal }) : null;");
  const loop = at(stage, "for (const combatantId of paintOrder) {");
  assert.ok(reach < loop, "asked once a frame, before any fighter is drawn");
  // The selected foe keeps S2's ring; every other lit foe gets it dashed — both under his shadow.
  const selectedRing = at(stage, "if (ringShown() && combatantId === ringView.model.selectedId) paintTargetRing(view, origin);");
  const litRing = at(stage, "else if (reach?.lit.some((one) => one.foeId === combatantId)) paintTargetRing(view, origin, { dashed: true });");
  const shadow = at(stage, "drawOps(paintShadow(figure, shownPose), view, origin);");
  assert.ok(selectedRing < litRing && litRing < shadow);
  // The dim: shadow, body, face and the authored figure alike, through `fade`.
  assert.match(stage, /const dimmed = reach\?\.dim\.includes\(combatantId\) \?\? false;/);
  assert.match(stage, /const shownPose = dimmed \? \{ \.\.\.pose, fade: ringReachFade\(pose\.fade\) \} : pose;/);
  assert.match(stage, /fade: shownPose\.fade,/);
  assert.match(stage, /paintFigure\(figure, shownPose\)/);
  assert.doesNotMatch(stage, /paintShadow\(figure, pose\)|fade: pose\.fade,|paintFigure\(figure, pose\)/, "nothing drawn at the undimmed pose");
  assert.match(stage, /context\.globalAlpha = plate\.alpha;\s*if \(dimmed\) context\.globalAlpha \*= RING_REACH_DIM;/, "his plate with him");
  // The numbers: after the HUD, before the ring (D2/D4's order kept), off this frame's drawn boxes.
  const hud = at(stage, "paintCombatHud(fit);");
  const numbers = at(stage, "paintReachNumbers(drawnBoxes, fit);");
  const ring = at(stage, "paintRing(view, fit);");
  assert.ok(hud < numbers && numbers < ring);
  const paint = functionBody("paintReachNumbers");
  assert.match(paint, /ringReachFor\(ringView\.model, ringReachShown, \{ legal: ringView\.legal, xOf: \(id\) => drawnX\.get\(id\) \}\)/, "numbered by where each is drawn");
  assert.match(paint, /const drawnX = new Map\(boxes\.map\(\(box\) => \[box\.id, \(box\.x0 \+ box\.x1\) \/ 2\]\)\);/);
  assert.match(paint, /ringReachNumberAt\(box, \{ scale: fit\.scale, stage \}\)/);
  assert.match(paint, /const stage = ringBoundsFor\(fit, \{ barred: arenaScreenAvailable\(\) \}\);/, "on the stage the ring keeps to (D4)");
  assert.match(functionBody("paintTargetRing"), /if \(dashed\) context\.setLineDash\(/);
});

/* ------------------------------------------------------------------ */
/* 6. Acceptance, over whole seeded bouts                              */
/* ------------------------------------------------------------------ */

/** The `_yscale` a fighter is drawn at, his colossus or little-fat-kid spell applied (S5's reading). */
function yscaleOf(host, id) {
  const record = host.combatant(id);
  const built = ss2PhysicalSize(record);
  return resourceValue(record, "spell_colossus", 0) > 0 ? ss2ColossusYscaleAfter(built, 100)
    : resourceValue(record, "spell_little_fat_kid", 0) > 0 ? 50 : built;
}
/**
 * WHERE THE PAGE DRAWS EVERY FIGHTER THIS TURN, in the arena's own camera on a 640 x 420 canvas, run until it
 * settles as `stepCamera` runs it (the in-frame HUD's top from the layout a pack-less page draws): each one's
 * drawn box (`fighterBoxFor`, as `renderStage` records it for a click), in the page's paint order — back to
 * front — and the ring the page draws for `model`, kept on the stage (`paintRing`'s composition, no pack).
 */
function drawnTurn(host, everyone) {
  const layout = combatPanelLayoutFor({
    sides: host.wire().teams.map((team) => ({ teamId: team.id, ids: [...team.combatants].sort((a, b) => a.slotIndex - b.slotIndex).map((c) => c.id) })),
    pack: combatHudArtFor(undefined).pack
  });
  const hudTop = layout.mode === "team" && Number.isFinite(layout.hudTop) ? layout.hudTop : null;
  const placed = everyone.filter((c) => Number.isFinite(c.x));
  const roster = placed.map((c) => {
    const placement = host.layout.placementFor(c.id);
    return {
      id: c.id, x: c.x, y: c.y, yscale: yscaleOf(host, c.id), ...actorSpanFor({ x: c.x, y: c.y }, null),
      side: placement?.side ?? null, teamId: placement?.teamId ?? null, alive: c.alive !== false, drawing: false
    };
  });
  let frame = null;
  for (let step = 0; step < 300; step += 1) frame = stepFramedCamera(frame, roster, { result: host.battle.result ?? null, hudTop });
  const camera = frame.camera;
  const fit = stageFitFor({ width: 640, height: 420 });
  const view = stageProjectorFor(camera, fit);
  const sizeOf = (c) => figureScaleFor({
    yscale: yscaleOf(host, c.id),
    rank: rankOfDepth(c.y, c.slotIndex, { frontY: 200, rankStride: SS2_ARENA.rankStride }),
    slotIndex: c.slotIndex
  });
  const boxes = [...placed].sort((left, right) => left.y - right.y || (left.id < right.id ? -1 : 1))
    .map((c) => ({ id: c.id, ...fighterBoxFor({ footX: view.toX(c.x), footY: view.toY(c.y, 0), pxPerUnit: view.scale, size: sizeOf(c) }) }));
  const stage = ringBoundsFor(fit, { barred: true });
  const ringOf = (model) => {
    const actor = everyone.find((c) => c.id === model.actorId);
    const placement = ringPlacementFor({ actor, foe: everyone.find((c) => c.id === model.selectedId), camera, view, fit });
    const head = boxes.find((box) => box.id === actor.id).y0;
    const below = view.toY(actor.y, -22) + Math.max(10, view.scale * 15) * 0.5;
    const at = { centerX: placement.x, centerY: placement.y, unit: placement.unit, layout: null };
    const bounds = { top: stage.y, bottom: stage.y + stage.height };
    return ringButtonsInside([
      ...ringButtonsAt(model, at),
      ...ringItemButtonsAt(model, { ...at, rowLayout: null, head, bounds, words: [] }),
      ...ringSwapButtonAt(model, at),
      ...ringMoveButtonsAt(model, { ...at, head, feet: below, bounds })
    ], stage, { fighterX: placement.x });
  };
  return { boxes, drawnX: new Map(boxes.map((box) => [box.id, (box.x0 + box.x1) / 2])), ringOf, fit, stage };
}
/** Whom the page's click at (x, y) selects, in its own order: a ring button takes it; else a lit foe's number; else a foe's box. */
function clickedFoe(x, y, { boxes, buttons, numbers, foeIds }) {
  if (ringSlotAt(buttons, x, y) !== null) return null;
  return ringReachNumberHit(numbers, x, y) ?? foeAt(boxes, x, y, foeIds);
}
/** A point in `foeId`'s drawn box where the page's click lands on HIM: no ring button, no number, no foe drawn in front. */
function clickPointOn(foeId, page) {
  const box = page.boxes.find((one) => one.id === foeId);
  for (let row = 1; row < 10; row += 1) {
    for (let column = 1; column < 10; column += 1) {
      const x = box.x0 + ((box.x1 - box.x0) * column) / 10;
      const y = box.y0 + ((box.y1 - box.y0) * row) / 10;
      if (clickedFoe(x, y, page) === foeId) return { x, y };
    }
  }
  return null;
}
/** The foes the ENGINE offers `sent`'s verb against, read afresh off the host — the spec, not the code under test. */
function offeredAt(host, sent, livingFoes) {
  const same = (option) => JSON.stringify([option.type, option.itemId ?? null, option.spellKind ?? null])
    === JSON.stringify([sent.type, sent.itemId ?? null, sent.spellKind ?? null]);
  return new Set(host.legalActions().filter(same).map((option) => option.targetId).filter((id) => livingFoes.includes(id)));
}
/** The decision's verbs, worded apart from the code: a spell (`cast-…`) at a foe, or a bombard or snipe at one. */
const hasReach = (sent, livingFoes) => Boolean(sent) && livingFoes.includes(sent.targetId)
  && (sent.type.startsWith("cast-") || sent.type === "bombard" || sent.type === "snipe");

test("ACCEPTANCE, over whole seeded bouts with every foe selected in turn: every spell and shot on screen lights EXACTLY the foes the engine offers it against, numbered left to right where the page draws them, and dims the rest; nothing else lights anyone; a click where the page drew another lit foe selects him, the preview stays re-aimed at him, and one click fires at him — and reading it all moves no state", (t) => {
  const tally = {
    bouts: 0, turns: 0, selections: 0, entries: 0, reach: 0, byVerb: {}, lit: {}, dimmed: 0, turnsTwoLit: 0,
    clicked: 0, clickedNumber: 0, numberUnderRing: 0, unclickable: 0, greyedReach: 0, words: 0, crossed: 0
  };
  for (const [perSide, kit, seed] of [[3, "tricks", 1], [3, "tricks", 2], [3, "blasts", 1], [3, "blasts", 2], [3, "crowd", 1],
    [3, "", 1], [3, "", 2], [2, "tricks", 1], [2, "", 1], [2, "blasts", 2]]) {
    const host = demoHost({ perSide, seed, kit });
    const bout = `${perSide}v${perSide} ${kit || "plain"} seed ${seed}`;
    for (let taken = 0; !host.battle.result; taken += 1) {
      assert.ok(taken < 4000, `${bout} finished`);
      const actorId = host.currentCombatantId();
      const everyone = host.wire().teams.flatMap((team) => team.combatants);
      const actor = everyone.find((c) => c.id === actorId);
      const livingFoes = everyone.filter((c) => c.alive !== false && c.teamId !== actor.teamId).map((c) => c.id);
      const legal = host.legalActions();
      const before = host.hash();
      const draws = rngJournal(host.battle).length;
      const drawn = drawnTurn(host, everyone);
      const xOf = (id) => drawn.drawnX.get(id);
      const nameOf = (id) => host.combatant(id)?.name ?? id;
      const turn = `${host.battle.turnNumber}:${host.battle.turnCursor}`;
      const bySelected = new Map();
      const modelAt = (foeId) => {
        if (!bySelected.has(foeId)) {
          bySelected.set(foeId, ringModelFor({ actorId, combatants: everyone, legal, previous: foeId, menuFor: (id) => host.unavailableActions(actorId, id) }));
        }
        return bySelected.get(foeId);
      };
      let twoLit = false;
      for (const foeId of livingFoes) {
        const model = modelAt(foeId);
        if (!model.stance) continue;
        tally.selections += 1;
        const buttons = drawn.ringOf(model);
        for (const entry of ringEntries(model, { greyed: true })) {
          tally.entries += 1;
          const shown = entry.action ?? entry;
          const sent = entry.action ?? entry.withheld;
          const reach = ringReachFor(model, shown, { legal, xOf });
          const offered = sent ? offeredAt(host, sent, livingFoes) : new Set();
          const expected = hasReach(sent, livingFoes) && livingFoes.length >= 2 && offered.size > 0;
          const label = `${bout} turn ${taken} ${actorId}→${foeId} ${entry.place}:${entry.slot}:${sent?.type}`;
          if (!expected) {
            assert.equal(reach, null, `${label}: no reach`);
            continue;
          }
          assert.ok(reach, `${label}: a reach`);
          tally.reach += 1;
          tally.byVerb[sent.type] = (tally.byVerb[sent.type] ?? 0) + 1;
          if (!entry.action) tally.greyedReach += 1;
          // EXACTLY the engine's offer; every other living foe dimmed.
          assert.deepEqual(reach.lit.map((one) => one.foeId).sort(), [...offered].sort(), `${label}: lit`);
          assert.deepEqual([...reach.dim].sort(), livingFoes.filter((id) => !offered.has(id)).sort(), `${label}: dimmed`);
          tally.lit[reach.lit.length] = (tally.lit[reach.lit.length] ?? 0) + 1;
          tally.dimmed += reach.dim.length;
          if (reach.lit.length >= 2) twoLit = true;
          // Numbered 1..n left to right where the page drew them.
          assert.deepEqual(reach.lit.map((one) => one.number), reach.lit.map((_, index) => index + 1));
          for (let index = 1; index < reach.lit.length; index += 1) {
            assert.ok(xOf(reach.lit[index - 1].foeId) <= xOf(reach.lit[index].foeId), `${label}: left to right`);
          }
          for (const one of reach.lit) assert.equal(one.selected, one.foeId === model.selectedId);
          // The words name the target, and say how to change it while another foe is lit.
          if (entry.action) {
            const text = ringPreviewFor(model, entry.action, host.previewAction(entry.action), { nameOf, reach }).text;
            const words = ringActionLabel({ ...entry.action, targetId: null }, { verb: entry.verb, words: entry.words });
            assert.ok(text.startsWith(`${words} → ${nameOf(entry.action.targetId)}`), `${label}: ${text}`);
            assert.equal(text.endsWith(" · click another lit foe to change"), reach.lit.length >= 2, `${label}: ${text}`);
            tally.words += 1;
          }
          // A click where the page drew each OTHER lit foe: he is selected, the preview stays, one click fires at him.
          const state = ringReachAfter(null, { turn, shown, model, legal });
          assert.ok(state, `${label}: pointing at it previews it`);
          // On its way to a foe the pointer may cross any other button the page drew: every one that lights
          // nobody keeps the preview (and shows only its own words while it is on it).
          let crossed = state;
          for (const button of buttons) {
            const on = ringShownFor(model, button.slot);
            if (!on || ringReachFor(model, on, { legal, xOf })) continue;
            crossed = ringReachAfter(crossed, { turn, shown: on, model, legal });
            tally.crossed += 1;
          }
          assert.equal(crossed, state, `${label}: the buttons crossed on the way keep the preview`);
          // The numbers the page draws for this preview, where it draws them (`paintReachNumbers`).
          const numbers = reach.lit.map(({ foeId: id }) => {
            const disc = ringReachNumberAt(drawn.boxes.find((box) => box.id === id), { scale: drawn.fit.scale, stage: drawn.stage });
            return { foeId: id, x: disc.x, y: disc.y, r: disc.r };
          });
          const page = { boxes: drawn.boxes, buttons, numbers, foeIds: model.foeIds };
          for (const { foeId: other } of reach.lit.filter((one) => !one.selected)) {
            // Clicked on his body, and on his number — each where the page drew it, taken in the page's order.
            const point = clickPointOn(other, page);
            const disc = numbers.find((number) => number.foeId === other);
            const onNumber = clickedFoe(disc.x, disc.y, page);
            if (onNumber === other) tally.clickedNumber += 1;
            else {
              assert.ok(ringSlotAt(buttons, disc.x, disc.y) !== null, `${label}: ${other}'s number, clicked, is his unless a ring button is over it`);
              tally.numberUnderRing += 1;
            }
            if (!point) {
              tally.unclickable += 1;
              if (onNumber !== other) continue;
            }
            const next = modelAt(other);
            assert.equal(next.selectedId, other, `${label}: the click selects ${other}`);
            // The pointer is on a foe: nothing is shown, and the preview stays.
            const kept = ringReachAfter(state, { turn, shown: null, model: next, legal });
            assert.equal(kept, state, `${label}: the preview stays`);
            const again = ringReachShownFor(next, kept, { turn });
            assert.ok(again && !again.reason, `${label}: on ${other}'s ring the verb acts`);
            assert.deepEqual([again.type, again.targetId], [sent.type, other], `${label}: re-aimed at ${other}`);
            const reachAgain = ringReachFor(next, again, { legal, xOf });
            assert.deepEqual(reachAgain.lit.map((one) => [one.foeId, one.number]), reach.lit.map((one) => [one.foeId, one.number]), `${label}: the same foes lit`);
            assert.ok(reachAgain.lit.find((one) => one.foeId === other).selected);
            // One click on the verb's own button fires at him — an offered action.
            const button = ringEntries(next).find((one) => ringSameAction(one.action, again));
            const command = ringClickCommand(next, button.slot, { confirm: false });
            assert.equal(command.kind, "act");
            assert.ok(ringSameAction(command.action, again) && command.action.targetId === other);
            assert.ok(legal.some((option) => option.type === again.type && option.targetId === other
              && (option.itemId ?? null) === (again.itemId ?? null) && (option.spellKind ?? null) === (again.spellKind ?? null)), `${label}: on offer`);
            tally.clicked += 1;
          }
        }
      }
      if (twoLit) tally.turnsTwoLit += 1;
      // ► Asking changed nothing: the state and the random draws are where they were.
      assert.equal(host.hash(), before, `${bout} turn ${taken}: the preview moved the state`);
      assert.equal(rngJournal(host.battle).length, draws, `${bout} turn ${taken}: the preview drew randomness`);
      tally.turns += 1;
      host.submit({ ...host.suggestAction(actorId), actorId });
    }
    tally.bouts += 1;
  }
  assert.equal(tally.bouts, 10);
  for (const verb of ["bombard", "snipe", "cast-gale", "cast-fireball", "cast-lightning-bolt", "cast-little-fat-kid"]) {
    assert.ok(tally.byVerb[verb] > 0, `${verb} was reached: ${JSON.stringify(tally.byVerb)}`);
  }
  assert.ok(tally.turnsTwoLit > 0 && tally.clicked > 0 && tally.dimmed > 0 && tally.greyedReach > 0, JSON.stringify(tally));
  t.diagnostic(JSON.stringify(tally));
});

test("ACCEPTANCE: a spectated bout's hashes, draws and actions are the same with every reach preview — every fighter, every foe, every button, the words and the standing preview — asked on every turn", () => {
  for (const [perSide, kit, seed] of [[3, "tricks", 3], [3, "blasts", 4], [3, "", 5], [2, "crowd", 6], [1, "blasts", 7]]) {
    const run = (withPreviews) => {
      const host = demoHost({ perSide, seed, kit });
      const hashes = [host.hash()];
      const actions = [];
      while (!host.battle.result) {
        const actorId = host.currentCombatantId();
        if (withPreviews) {
          const draws = rngJournal(host.battle).length;
          const { everyone, legal, xOf } = turnOf(host);
          const nameOf = (id) => host.combatant(id)?.name ?? id;
          let state = null;
          for (const foeId of everyone.filter((c) => c.alive !== false && c.teamId !== host.combatant(actorId).teamId).map((c) => c.id)) {
            const model = ringModelFor({ actorId, combatants: everyone, legal, previous: foeId, menuFor: (id) => host.unavailableActions(actorId, id) });
            for (const entry of ringEntries(model, { greyed: true })) {
              const shown = entry.action ?? entry;
              const reach = ringReachFor(model, shown, { legal, xOf });
              if (entry.action) ringPreviewFor(model, entry.action, host.previewAction(entry.action), { nameOf, reach });
              state = ringReachAfter(state, { turn: "t", shown, model, legal });
              ringReachShownFor(model, ringReachAfter(state, { turn: "t", shown: null, model, legal }), { turn: "t" });
            }
          }
          assert.equal(host.hash(), hashes[hashes.length - 1], "previewing moved the state");
          assert.equal(rngJournal(host.battle).length, draws, "previewing drew randomness");
        }
        const action = { ...host.suggestAction(actorId), actorId };
        actions.push(JSON.stringify(action));
        host.submit(action);
        hashes.push(host.hash());
        assert.ok(hashes.length < 4000, "finished");
      }
      return { hashes, actions, draws: rngJournal(host.battle).length };
    };
    const plain = run(false);
    assert.deepEqual(run(true), plain, `${perSide}v${perSide} ${kit || "plain"} seed ${seed}`);
    assert.ok(plain.hashes.length > 3, `${perSide}v${perSide} ${kit || "plain"} seed ${seed}: ${plain.hashes.length} hashes`);
  }
});
