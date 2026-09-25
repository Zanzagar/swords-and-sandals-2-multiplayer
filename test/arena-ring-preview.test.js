/**
 * THE RING'S PREVIEWS AND THE CONFIRM SETTING (slice S7 of
 * `docs/design/battle-ui.md`, "The in-battle actions: DECIDED", items 4 and 9):
 * hovering or focusing a ring, swap or items button shows its verb and its
 * hit chance — `host.previewAction(action)`'s, never a number of the UI's own;
 * the strip shows the selected target's odds; and an optional "confirm every
 * move" setting (default OFF, remembered per browser) makes a press CHOOSE and
 * only Confirm or Enter act.
 *
 * The engine is not mocked where its answer matters: every preview is read
 * off a REAL host, and the acceptance plays whole seeded bouts.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { ringActionFor, ringConfirmCommand, ringKeyCommand, ringModelFor, ringPendingFor, ringPendingKept, ringPressCommand } from "../tools/arena/ring.js";
import { ringCaptionAt, ringCaptionLines } from "../tools/arena/ring-layout.js";
import {
  RING_CONFIRM_KEY, RING_STRIP_IDLE, ringConfirmSettingFrom, ringConfirmSettingSave, ringOddsFor, ringPreviewFor, ringPreviewShown, ringStripPreviewAfter
} from "../tools/arena/ring-preview.js";

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
/** The rule set's own AI takes `count` turns. */
function advance(host, count) {
  for (let taken = 0; taken < count; taken += 1) {
    const actorId = host.currentCombatantId();
    host.submit({ ...host.suggestAction(actorId), actorId });
  }
  return host;
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
const nameOfIn = (host) => (id) => host.combatant(id)?.name ?? id;

/* ------------------------------------------------------------------ */
/* 1. What a hover shows                                               */
/* ------------------------------------------------------------------ */

test("hovering a swing shows its verb and the engine's own hit chance, damage and stamina", () => {
  // 1v1, seed 7, after six AI turns: Ruk (red-1) is close to Cidra (blue-1), on the close warrior frame.
  const host = advance(demoHost({ perSide: 1, seed: 7 }), 6);
  const model = modelOf(host);
  const nameOf = nameOfIn(host);
  const power = model.slots.find((slot) => slot.verb === "power_attack").action;
  const quick = model.slots.find((slot) => slot.verb === "quick_attack").action;
  assert.equal(ringPreviewFor(model, power, host.previewAction(power), { nameOf }).text,
    "Power attack at Cidra: 40% to hit · 17 damage · costs 10 stamina");
  assert.equal(ringPreviewFor(model, quick, host.previewAction(quick), { nameOf }).text,
    "Quick attack at Cidra: 80% to hit · 12 damage · costs 4 stamina");
});

test("a range of damage reads low–high, a walk says what it costs, and a rest what it gives back", () => {
  const close = advance(demoHost({ perSide: 1, seed: 7 }), 6);
  const closeModel = modelOf(close);
  const normal = closeModel.slots.find((slot) => slot.verb === "normal_attack").action;
  assert.equal(ringPreviewFor(closeModel, normal, close.previewAction(normal), { nameOf: nameOfIn(close) }).text,
    "Normal attack at Cidra: 61% to hit · 12–17 damage · costs 7 stamina");
  // The 1v1 opening, seed 1: the walk in its slot, and the rest the long frame lists beside the taunt.
  const open = demoHost({ perSide: 1, seed: 1 });
  const model = modelOf(open);
  const walk = model.slots.find((slot) => slot.verb === "walkleft").action;
  const rest = model.offRing.find((entry) => entry.action.type === "rest").action;
  assert.equal(ringPreviewFor(model, walk, open.previewAction(walk)).text, "Walk left: costs 6 stamina");
  // The words are the strip's for the button's VERB, not the engine token's ("Wincrowd").
  const crowd = model.slots.find((slot) => slot.verb === "wincrowd").action;
  assert.equal(ringPreviewFor(model, crowd, open.previewAction(crowd)).text, "Win the crowd: costs 3 stamina");
  // `energy` -75: the rest's `staminacost` is `0 - round(stamina * 15)`, so it GIVES 75.
  assert.equal(ringPreviewFor(model, rest, open.previewAction(rest)).text, "Rest: gains 75 stamina");
});

test("the items row previews in the build's own names: a bolt cannot miss, a ghost strike rolls, a whirlwind out of range is wasted", () => {
  const blasts = demoHost({ perSide: 1, seed: 1, kit: "blasts" });
  const blastModel = modelOf(blasts);
  const bolt = blastModel.items.find((item) => item.words === "Lightning Bolt").action;
  assert.equal(ringPreviewFor(blastModel, bolt, blasts.previewAction(bolt), { nameOf: nameOfIn(blasts) }).text,
    "Lightning Bolt at Cidra: cannot miss · 100–200 damage · costs 12 stamina");
  const tricks = demoHost({ perSide: 1, seed: 1, kit: "tricks" });
  const model = modelOf(tricks);
  const text = (words) => {
    const action = model.items.find((item) => item.words === words).action;
    return ringPreviewFor(model, action, tricks.previewAction(action), { nameOf: nameOfIn(tricks) }).text;
  };
  assert.equal(text("Ghost Strike"), "Ghost Strike at Cidra: 40% to hit · 17 damage · costs 12 stamina");
  // `outOfRange`: the range gate will waste it — it costs and decides nothing, so no damage is promised.
  assert.equal(text("Whirlwind"), "Whirlwind at Cidra: out of range: wasted · costs 12 stamina");
});

test("a potion and rejuvenate say what they restore, and a potion that would restore nothing says 0", () => {
  const host = demoHost({ perSide: 1, seed: 1, kit: "crowd" });
  const model = modelOf(host);
  const text = (words) => {
    const action = model.items.find((item) => item.words === words).action;
    return ringPreviewFor(model, action, host.previewAction(action)).text;
  };
  assert.equal(text("Maximum stamina vial"), "Maximum stamina vial: restores 20 stamina");
  // Ruk is at full health: the potion's `restores.amount` is 0, and the button says so.
  assert.equal(text("Maximum health potion"), "Maximum health potion: restores 0 health");
  // Rejuvenate fills all three pools; only the one not already full is named.
  assert.equal(text("Rejuvinate"), "Rejuvinate: restores 20 stamina · costs 12 stamina");
});

test("a blow from behind says so, as the engine adds its back-attack bonus", () => {
  // 3v3, seed 1, after 31 AI turns: Vasso (red-2), bow drawn, bombards Ruk's foe blue-1 from behind.
  const host = advance(demoHost({ perSide: 3, seed: 1 }), 31);
  const model = modelOf(host, "blue-1");
  assert.equal(model.selectedId, "blue-1");
  const bombard = model.slots.find((slot) => slot.verb === "bombardright").action;
  const preview = host.previewAction(bombard);
  assert.equal(preview.backAttack, true);
  assert.equal(ringPreviewFor(model, bombard, preview, { nameOf: nameOfIn(host) }).text,
    `Bombard at ${host.combatant("blue-1").name}: 73% to hit · 12–24 damage from behind · costs 10 stamina`);
});

test("a condition's own turn says the damage is his, and a rejuvenate with nothing to fill says so", () => {
  // No seeded bout reaches a condition's turn without the `?enchant=` demo, so the preview is the
  // SHAPE `ss2PreviewAction` gives one (`condition`, and `damage` the tick on the actor himself),
  // on a real model entry: a forced phase is the whole offer, listed off the ring.
  const combatants = [{ id: "red-1", teamId: "red", x: 0, y: 200, alive: true }, { id: "blue-1", teamId: "blue", x: 300, y: 200, alive: true }];
  const burning = { type: "burning-phase", targetId: "red-1" };
  const model = ringModelFor({ actorId: "red-1", combatants, legal: [burning], menuFor: () => null });
  const action = model.offRing[0].action;
  assert.equal(ringPreviewFor(model, action, { type: "burning-phase", targetId: "red-1", kind: "self", chance: null,
    damage: { min: 3, max: 3 }, energy: 0, crowdToll: 0, condition: "burning" }).text, "Burning phase: takes 3 damage");
  const rejuvinate = { type: "cast-rejuvinate", targetId: "red-1" };
  const full = ringModelFor({ actorId: "red-1", combatants, legal: [rejuvinate], menuFor: () => null });
  assert.equal(ringPreviewFor(full, full.offRing[0].action, { type: "cast-rejuvinate", targetId: "red-1", kind: "heal",
    chance: null, damage: null, energy: 12, crowdToll: 0, restores: { hitpoints: 0, staminaleft: 0, armourclass: 0 } }).text,
  "Cast rejuvinate: restores nothing · costs 12 stamina");
});

test("an action nobody can press previews nothing, and a missing preview leaves the words alone", () => {
  const host = advance(demoHost({ perSide: 1, seed: 7 }), 6);
  const model = modelOf(host);
  const power = model.slots.find((slot) => slot.verb === "power_attack").action;
  // At another fighter, or by another actor: not on this ring, so no button says it.
  assert.equal(ringPreviewFor(model, { ...power, targetId: "red-1" }, host.previewAction(power)), null);
  assert.equal(ringPreviewFor(model, { ...power, actorId: "blue-1" }, host.previewAction(power)), null);
  assert.equal(ringPreviewFor(model, null, null), null);
  const bare = ringPreviewFor(model, power, null, { nameOf: nameOfIn(host) });
  assert.equal(bare.text, "Power attack at Cidra");
  assert.equal(bare.chance, null);
});

/* ------------------------------------------------------------------ */
/* 2. The selected target's odds, in the strip                         */
/* ------------------------------------------------------------------ */

test("the strip's odds are every roll to hit the SELECTED foe on screen, the engine's chance for each", () => {
  const close = advance(demoHost({ perSide: 1, seed: 7 }), 6);
  const closeModel = modelOf(close);
  // The shove takes no hit roll (`chance` null): it is not odds.
  assert.equal(ringOddsFor(closeModel, (action) => close.previewAction(action), { nameOf: nameOfIn(close) }).text,
    "Odds on Cidra: Power 40% · Normal 61% · Quick 80%");
  const long = demoHost({ perSide: 1, seed: 7 });
  assert.equal(ringOddsFor(modelOf(long), (action) => long.previewAction(action), { nameOf: nameOfIn(long) }).text,
    "Odds on Cidra: Taunt 40%");
  // The items row's rolls count too, in the build's names; a whirlwind out of range rolls nothing.
  const tricks = demoHost({ perSide: 1, seed: 1, kit: "tricks" });
  const odds = ringOddsFor(modelOf(tricks), (action) => tricks.previewAction(action), { nameOf: nameOfIn(tricks) });
  assert.equal(odds.text, "Odds on Cidra: Taunt 40% · Ghost Strike 40%");
  assert.deepEqual(odds.odds.map(({ key, words, chance }) => [key, words, chance]), [["3", "Taunt", 40], ["Q", "Ghost Strike", 40]]);
  assert.equal(odds.foeId, "blue-1");
});

test("two places of one spell are one roll in the odds, and a foe with no roll on offer is said plainly", () => {
  // `items=36,36`: a ghost strike in slots 1 and 2 — two places on the row (E and R), one action.
  const twice = demoHost({ perSide: 1, seed: 1, kit: "36,36" });
  const model = modelOf(twice);
  assert.deepEqual(model.items.filter((item) => item.action).map((item) => item.key), ["E", "R"]);
  const odds = ringOddsFor(model, (action) => twice.previewAction(action), { nameOf: nameOfIn(twice) });
  assert.equal(odds.text, "Odds on Cidra: Taunt 40% · Ghost Strike 40%");
  assert.deepEqual(odds.odds.map((one) => one.key), ["3", "E"]);
  // A model whose selected foe nothing on screen rolls at: the words say so rather than going blank.
  const combatants = [{ id: "red-1", teamId: "red", x: 0, y: 200, alive: true }, { id: "blue-1", teamId: "blue", x: 300, y: 200, alive: true }];
  // What is aimed at the ACTOR is never odds on the foe, whatever its preview says; nor is a roll the
  // range gate will waste (the engine gives such a preview no chance today — this holds if it ever did).
  const quiet = ringModelFor({
    actorId: "red-1", combatants, menuFor: () => null,
    legal: [{ type: "rest", targetId: "red-1" }, { type: "cast-whirlwind", targetId: "blue-1" }]
  });
  const loud = (action) => ({ chance: 50, outOfRange: action.type === "cast-whirlwind" });
  assert.equal(ringOddsFor(quiet, loud, { nameOf: () => "Cidra" }).text, "No roll to hit Cidra on offer.");
  const alone = ringModelFor({ actorId: "red-1", combatants: combatants.slice(0, 1), legal: [], menuFor: () => null });
  assert.equal(ringOddsFor(alone, () => null).text, "No foe to roll against.");
});

/* ------------------------------------------------------------------ */
/* 3. "Confirm every move": remembered per browser, default OFF        */
/* ------------------------------------------------------------------ */

/** A `localStorage` stand-in: a Map behind the two calls the setting makes. */
function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

test("the setting is OFF until a person turns it on, and remembered per browser under its own key", () => {
  assert.equal(RING_CONFIRM_KEY, "arena.ring.confirm");
  assert.equal(ringConfirmSettingFrom(() => memoryStorage()), false, "nothing stored: off");
  assert.equal(ringConfirmSettingFrom(() => memoryStorage({ "arena.ring.confirm": "1" })), true);
  assert.equal(ringConfirmSettingFrom(() => memoryStorage({ "arena.ring.confirm": "0" })), false);
  assert.equal(ringConfirmSettingFrom(() => memoryStorage({ "arena.ring.confirm": "yes" })), false, "only what the page writes turns it on");
  assert.equal(ringConfirmSettingFrom(() => memoryStorage({ "arena.volume": "1" })), false, "another setting's key is not this one");
  const storage = memoryStorage();
  assert.equal(ringConfirmSettingSave(() => storage, true), true);
  assert.equal(storage.map.get("arena.ring.confirm"), "1");
  assert.equal(ringConfirmSettingFrom(() => storage), true);
  assert.equal(ringConfirmSettingSave(() => storage, false), true);
  assert.equal(storage.map.get("arena.ring.confirm"), "0");
  assert.equal(ringConfirmSettingFrom(() => storage), false);
});

test("storage that throws or is missing leaves the setting OFF and the page running", () => {
  const throwing = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("QuotaExceededError"); } };
  // `window.localStorage` itself can throw (a sandboxed frame, blocked site data): the getter is called inside the guard.
  const blocked = () => { throw new Error("SecurityError: access is denied"); };
  for (const storageOf of [blocked, () => throwing, () => null, () => undefined, null]) {
    assert.equal(ringConfirmSettingFrom(storageOf), false);
    assert.equal(ringConfirmSettingSave(storageOf, true), false, "not remembered, and said so");
  }
});

/* ------------------------------------------------------------------ */
/* 4. With the setting on, a press CHOOSES and only Confirm acts       */
/* ------------------------------------------------------------------ */

test("a press acts with the setting off, as the owner's one click does, and only CHOOSES with it on", () => {
  const host = advance(demoHost({ perSide: 1, seed: 7 }), 6);
  const model = modelOf(host);
  const power = ringActionFor(model, "optionD");
  assert.equal(power.type, "power-attack");
  assert.deepEqual(ringPressCommand(power, { confirm: false }), { kind: "act", action: power });
  assert.deepEqual(ringPressCommand(power, { confirm: true }), { kind: "choose", action: power });
  assert.deepEqual(ringPressCommand(power), { kind: "act", action: power }, "the default is OFF");
  assert.equal(ringPressCommand(null, { confirm: true }), null, "an empty slot presses nothing");
});

test("with the setting on, every key that would act only chooses — digits, 9, the items' letters and the arrows", () => {
  const host = demoHost({ perSide: 1, seed: 1, kit: "tricks" });
  const model = modelOf(host);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "q", "W", "E", "r", "T", "y", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
  let acted = 0;
  for (const key of keys) {
    const off = ringKeyCommand(model, { key, focus: "stage" });
    const on = ringKeyCommand(model, { key, focus: "stage", confirm: true });
    if (off?.kind === "act") {
      acted += 1;
      assert.deepEqual(on, { kind: "choose", action: off.action }, `${key} chooses what it would have sent`);
    } else {
      assert.deepEqual(on, off, `${key} does what it did (nothing to send)`);
    }
    // From a strip button too.
    assert.notEqual(ringKeyCommand(model, { key, focus: "control", confirm: true })?.kind, "act", `${key} from a control`);
  }
  assert.ok(acted >= 8, `the opening offers walks, the taunt, the crowd and the spells: ${acted}`);
});

test("Enter from the stage confirms the chosen action — the model's own — and nothing else sends", () => {
  const host = demoHost({ perSide: 1, seed: 1, kit: "tricks" });
  const model = modelOf(host);
  const taunt = ringActionFor(model, "3");
  assert.equal(taunt.type, "taunt");
  const enter = (options) => ringKeyCommand(model, { key: "Enter", focus: "stage", confirm: true, ...options });
  assert.deepEqual(enter({ pending: taunt }), { kind: "act", action: taunt });
  assert.equal(enter({ pending: { ...taunt } }).action, taunt, "what is sent is the offered option on screen, not the copy handed in");
  assert.deepEqual(enter({ pending: null }), { kind: "ignore", why: "nothing-chosen" }, "nothing chosen: said, not sent");
  assert.deepEqual(enter({ pending: { ...taunt, targetId: "red-1" } }), { kind: "ignore", why: "nothing-chosen" },
    "a choice no longer on screen is no choice");
  // A held Enter confirms once: its repeats send nothing — and since Codex's pass 1 they are swallowed
  // (~~left to the browser, `null`~~), so they cannot press a focused Confirm either.
  assert.deepEqual(enter({ pending: taunt, repeat: true }), { kind: "ignore", why: "repeat" }, "a held Enter confirms once");
  assert.equal(enter({ pending: taunt, focus: "control" }), null, "on a button, Enter is the browser's: it presses that button");
  assert.equal(enter({ pending: taunt, focus: "text" }), null);
  assert.equal(enter({ pending: taunt, ctrlKey: true }), null);
  assert.equal(enter({ pending: taunt, confirm: false }), null, "with the setting off Enter is not the ring's");
  assert.deepEqual(ringConfirmCommand(model, taunt), { kind: "act", action: taunt }, "the strip's Confirm");
  assert.equal(ringConfirmCommand(model, { ...taunt, type: "power-attack" }), null);
  assert.equal(ringConfirmCommand(model, null), null);
});

test("Esc takes a choice back, from the stage or a strip button; with none it does what it did", () => {
  const host = demoHost({ perSide: 1, seed: 1 });
  const model = modelOf(host);
  const walk = ringActionFor(model, "ArrowRight");
  const esc = (options) => ringKeyCommand(model, { key: "Escape", confirm: true, ...options });
  assert.deepEqual(esc({ focus: "stage", pending: walk }), { kind: "back" });
  assert.deepEqual(esc({ focus: "control", pending: walk }), { kind: "back" });
  assert.equal(esc({ focus: "text", pending: walk }), null);
  assert.deepEqual(esc({ focus: "stage", pending: null }), { kind: "focus-strip" });
  assert.equal(esc({ focus: "control", pending: null }), null);
  assert.deepEqual(esc({ focus: "stage", pending: walk, confirm: false }), { kind: "focus-strip" }, "setting off: as S2");
});

test("a choice lasts while its turn does and its button is on screen: a potion survives a new target, a swing at the old one does not", () => {
  const host = demoHost({ perSide: 3, seed: 1, kit: "crowd" });
  const first = modelOf(host);
  assert.ok(first.foeIds.length > 1);
  const turn = host.battle.turnNumber;
  const potion = first.items.find((item) => item.action?.type === "drink-potion").action;
  const taunt = first.slots.find((slot) => slot.action?.targetId === first.selectedId && slot.action.type === "taunt").action;
  const other = modelOf(host, first.foeIds.find((id) => id !== first.selectedId));
  assert.equal(ringPendingFor(first, { turn, action: taunt }, { turn }), taunt);
  assert.equal(ringPendingFor(other, { turn, action: potion }, { turn }), ringActionFor(other, other.items.find((item) => item.action?.type === "drink-potion").slot));
  assert.equal(ringPendingFor(other, { turn, action: taunt }, { turn }), null, "the taunt at the old target is not on this ring");
  assert.equal(ringPendingFor(first, { turn, action: taunt }, { turn: turn + 1 }), null, "a new turn starts with nothing chosen");
  assert.equal(ringPendingFor(first, null, { turn }), null);
});

/* ------------------------------------------------------------------ */
/* 5. Where the hover's words stand on the stage                       */
/* ------------------------------------------------------------------ */

test("the hover's caption stands under the button, over it near the stage's foot, and always on the stage", () => {
  const stage = { x: 0, y: 0, width: 640, height: 420 };
  const size = { width: 180, height: 22, gap: 6 };
  // Under: centred on the button, its top the gap below the disc.
  assert.deepEqual(ringCaptionAt({ x: 300, y: 200, r: 20 }, size, stage), { x0: 210, y0: 226, width: 180, height: 22, x: 300, y: 237 });
  // Near the foot there is no room under it (390 + 20 + 6 + 22 = 438 > 420): over it.
  assert.deepEqual(ringCaptionAt({ x: 300, y: 390, r: 20 }, size, stage), { x0: 210, y0: 342, width: 180, height: 22, x: 300, y: 353 });
  // At the sides it slides onto the stage, the words with it.
  assert.deepEqual(ringCaptionAt({ x: 40, y: 200, r: 20 }, size, stage), { x0: 0, y0: 226, width: 180, height: 22, x: 90, y: 237 });
  assert.deepEqual(ringCaptionAt({ x: 630, y: 200, r: 20 }, size, stage), { x0: 460, y0: 226, width: 180, height: 22, x: 550, y: 237 });
  // A stage offset from the canvas's corner (the fitted view letterboxes it).
  assert.deepEqual(ringCaptionAt({ x: 60, y: 100, r: 10 }, size, { x: 50, y: 30, width: 300, height: 200 }),
    { x0: 50, y0: 116, width: 180, height: 22, x: 140, y: 127 });
  // Wider than the stage: its left edge on the stage's. No room under or over: kept on the stage anyway.
  assert.equal(ringCaptionAt({ x: 300, y: 200, r: 20 }, { width: 700, height: 22, gap: 6 }, stage).x0, 0);
  const squeezed = ringCaptionAt({ x: 300, y: 20, r: 10 }, size, { x: 0, y: 0, width: 640, height: 40 });
  assert.ok(squeezed.y0 >= 0 && squeezed.y0 + squeezed.height <= 40, JSON.stringify(squeezed));
});

/* ------------------------------------------------------------------ */
/* 6. The shell's wiring, read as TEXT (main.js cannot be imported)    */
/* ------------------------------------------------------------------ */

const raw = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../tools/arena/index.html", import.meta.url), "utf8");
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

test("WIRING: every press goes through the confirm gate, and only runRingCommand's act sends", () => {
  // The one sender is called from exactly one place: an "act" command.
  const callers = [...code.matchAll(/actFromRing\(/g)].length;
  assert.equal(callers, 2, "the definition and one call");
  assert.match(functionBody("runRingCommand"), /if \(command\.kind === ""\) actFromRing\(command\.action\);/);
  // A click on the stage, a strip button: pressRing, which asks ringPressCommand with the setting.
  assert.match(functionBody("pressRing"), /ringPressCommand\(action, \{ confirm: ringConfirm \}\)/);
  // S9: the canvas click is the key's own command, run here (`ringClickCommand`: a press, or a greyed
  // button's "why"); ~~`pressRing(ringActionFor(ringView.model, slot))`~~.
  assert.match(code, /runRingCommand\(ringClickCommand\(ringView\.model, slot, \{ confirm: ringConfirm \}\)\)/, "the canvas click");
  assert.match(functionBody("pressRing"), /runRingCommand\(ringPressCommand\(action, \{ confirm: ringConfirm \}\), \{ from \}\);/);
  assert.match(functionBody("renderRingStrip"), /addEventListener\("", \(\) => pressRing\(action, \{ from: "" \}\)\)/, "a strip button");
  // A key: ringKeyCommand is told the setting and the standing choice, and its command is run.
  assert.match(code, /const command = ringKeyCommand\(ringView\.model, \{ \.\.\.pressed, confirm: ringConfirm, pending: ringPendingAction\(\) \}\);/);
  // The strip's Confirm: ringConfirmCommand with the standing choice, nothing else.
  assert.match(code, /runRingCommand\(ringConfirmCommand\(ringView\.model, ringPendingAction\(\)\)\)/);
  // A choice is dropped once anything is sent.
  assert.match(functionBody("actFromRing"), /ringPending = null;[\s\S]*host\.submit\(action\)/);
  // The choice standing is the model's, checked against this very turn.
  assert.match(functionBody("ringPendingAction"), /ringPendingFor\(view\.model, ringPending, \{ turn: view\.turnKey \}\)/);
  assert.match(functionBody("ringPendingAction"), /if \(!view \|\| !ringConfirm\) return null;/);
});

test("WIRING: previews are host.previewAction's, and the setting is read and saved only through the guarded helpers", () => {
  assert.match(functionBody("ringPreviewOf"), /host\.previewAction\(action\)/);
  assert.match(functionBody("ringPreviewTextOf"), /ringPreviewFor\(view\.model, action, ringPreviewOf\(action\),/);
  assert.match(functionBody("renderRingStrip"), /ringOddsFor\(model, ringPreviewOf,/);
  // No engine question but these: the preview asks nothing else of the host.
  assert.equal([...code.matchAll(/host\.previewAction\(/g)].length, 1);
  assert.match(code, /let ringConfirm = ringConfirmSettingFrom\(\(\) => window\.localStorage\);/);
  assert.match(code, /ringConfirmSettingSave\(\(\) => window\.localStorage, ringConfirm\)/);
  // Every other touch of localStorage is the volume's, each inside its own try.
  const touches = raw.split("\n").filter((line) => line.includes("window.localStorage"));
  assert.equal(touches.length, 4);
  for (const line of touches) assert.ok(/try \{[^}]*window\.localStorage\.|\(\) => window\.localStorage\b/.test(line), line.trim());
});

test("WIRING: the page carries the toggle — unchecked — the preview line and Confirm and Back, in the strip", () => {
  const toggle = /<input[^>]*id="ring-confirm"[^>]*>/.exec(page)?.[0];
  assert.ok(toggle, "the toggle is on the page");
  assert.match(toggle, /type="checkbox"/);
  assert.doesNotMatch(toggle, /\bchecked\b/, "OFF by default: the page does not check it; the stored setting may");
  for (const id of ["ring-preview", "ring-preview-text", "ring-confirm-go", "ring-confirm-back", "ring-confirm"]) {
    assert.ok(page.indexOf(`id="${id}"`) > page.indexOf('id="ring-strip"') && page.indexOf(`id="${id}"`) < page.indexOf('id="ring-status"'), `#${id} is in the strip`);
  }
  assert.match(/<button[^>]*id="ring-confirm-go"[^>]*>/.exec(page)[0], /aria-keyshortcuts="Enter"/);
  assert.match(/<button[^>]*id="ring-confirm-back"[^>]*>/.exec(page)[0], /aria-keyshortcuts="Escape"/);
  // The preview line is first in the strip, so its fixed height never scrolls it away.
  assert.ok(page.indexOf('id="ring-preview"') < page.indexOf('id="ring-target"'));
});

/* ------------------------------------------------------------------ */
/* 7. Codex review of S7, pass 1: two sequences the first build missed */
/* ------------------------------------------------------------------ */

test("CODEX PASS 1: a HELD Enter never confirms — its repeats are the ring's and do nothing, wherever the focus is", () => {
  // The sequence: Enter on a strip action presses it (the browser's click) and chooses; the focus moves
  // to Confirm; the key's auto-repeats would press Confirm natively unless the ring swallows them.
  const host = demoHost({ perSide: 1, seed: 1 });
  const model = modelOf(host);
  const taunt = ringActionFor(model, "3");
  for (const focus of ["control", "stage", "adjust"]) {
    for (const pending of [taunt, null]) {
      assert.deepEqual(ringKeyCommand(model, { key: "Enter", repeat: true, focus, confirm: true, pending }), { kind: "ignore", why: "repeat" },
        `a repeat from ${focus}, ${pending ? "a choice standing" : "nothing chosen"}: kept from the page, sends nothing`);
    }
  }
  assert.equal(ringKeyCommand(model, { key: "Enter", repeat: true, focus: "text", confirm: true, pending: taunt }), null, "typing is the field's");
  assert.equal(ringKeyCommand(model, { key: "Enter", repeat: true, focus: "control", confirm: false, pending: null }), null,
    "with the setting off Enter is not the ring's at all (S2)");
  // A FRESH Enter on a button stays the browser's: it presses that button (Confirm, once the focus is there).
  assert.equal(ringKeyCommand(model, { key: "Enter", focus: "control", confirm: true, pending: taunt }), null);
});

test("CODEX PASS 1: a choice a new target's ring does not show is DROPPED, not hidden — switching back does not bring it back", () => {
  const host = demoHost({ perSide: 3, seed: 1, kit: "crowd" });
  const turn = "t";
  const atA = modelOf(host);
  const a = atA.selectedId;
  const b = atA.foeIds.find((id) => id !== a);
  const taunt = atA.slots.find((slot) => slot.action?.type === "taunt" && slot.action.targetId === a).action;
  const potion = atA.items.find((item) => item.action?.type === "drink-potion").action;
  // What the shell keeps across each rebuild: A (chosen) -> B -> A.
  let kept = ringPendingKept(atA, { turn, action: taunt }, { turn });
  assert.equal(kept.action, taunt, "on A's ring it stands");
  kept = ringPendingKept(modelOf(host, b), kept, { turn });
  assert.equal(kept, null, "B's ring does not show it: dropped");
  kept = ringPendingKept(modelOf(host, a), kept, { turn });
  assert.equal(kept, null, "back on A it is not resurrected: choose again");
  // A potion is on every foe's ring: it survives the round trip.
  let drink = { turn, action: potion };
  for (const foeId of [b, a]) drink = ringPendingKept(modelOf(host, foeId), drink, { turn });
  const back = modelOf(host, a);
  assert.equal(ringPendingFor(back, drink, { turn }), ringActionFor(back, atA.items.find((item) => item.action === potion).slot));
  assert.equal(ringPendingKept(atA, { turn, action: potion }, { turn: "another" }), null, "and a new turn drops it");
});

test("CODEX PASS 1: the shell drops a choice on every rebuild that does not show it, and keeps from the page every key the ring answers", () => {
  const controls = functionBody("renderControls");
  assert.match(controls, /ringPending = ringPendingKept\(ring, ringPending, \{ turn: ringView\.turnKey \}\);/,
    "each person's ring, as it is built, keeps only a choice it shows");
  assert.ok(controls.indexOf("ringPendingKept(") > controls.indexOf("ringView = {"), "after the ring on screen is the new one");
  // An "ignore" — a held Enter's repeat among them — is still a command: the page's default is prevented.
  const keydown = code.slice(code.indexOf("const command = ringKeyCommand(ringView.model, {"));
  assert.match(keydown, /^[^\n]*\n\s*if \(!command\) return;\s*event\.preventDefault\(\);/);
});

/* ------------------------------------------------------------------ */
/* 8. Codex review of S7, pass 2: a caption wider than the stage       */
/* ------------------------------------------------------------------ */

test("CODEX PASS 2: a caption wider than the stage wraps — at its ' · ' breaks first, then between words — and every edge stays on the stage", () => {
  const text = "Lightning Bolt at Cidra: cannot miss · 100–200 damage · costs 12 stamina";
  const measure = (line) => line.length; // one pixel a character: the widths below are counted by hand
  assert.deepEqual(ringCaptionLines(text, { maxWidth: 1000, measure }), [text], "room enough: one line");
  assert.deepEqual(ringCaptionLines(text, { maxWidth: 40, measure }),
    ["Lightning Bolt at Cidra: cannot miss", "100–200 damage · costs 12 stamina"]);
  assert.deepEqual(ringCaptionLines(text, { maxWidth: 20, measure }),
    ["Lightning Bolt at", "Cidra: cannot miss", "100–200 damage", "costs 12 stamina"]);
  // A part too wide alone starts on the last line when its first word fits there, with the part's seam.
  assert.deepEqual(ringCaptionLines("ab · cd ef gh", { maxWidth: 7, measure }), ["ab · cd", "ef gh"]);
  // A word wider than the room keeps a line to itself rather than vanishing.
  assert.deepEqual(ringCaptionLines("Rest: gains 75 stamina", { maxWidth: 4, measure }), ["Rest:", "gains", "75", "stamina"]);
  // Nothing is lost: the lines hold every word, in order.
  assert.equal(ringCaptionLines(text, { maxWidth: 20, measure }).join(" ").replaceAll(" · ", " "), text.replaceAll(" · ", " "));
  // The box: never wider than the stage, and every edge on it — even for a caption measured wider.
  const stage = { x: 10, y: 0, width: 320, height: 420 };
  const box = ringCaptionAt({ x: 100, y: 200, r: 20 }, { width: 450, height: 22, gap: 6 }, stage);
  assert.equal(box.width, 320);
  assert.equal(box.x0, 10);
  assert.ok(box.x0 >= stage.x && box.x0 + box.width <= stage.x + stage.width, JSON.stringify(box));
  assert.ok(box.y0 >= stage.y && box.y0 + box.height <= stage.y + stage.height, JSON.stringify(box));
});

test("CODEX PASS 2: the shell wraps the caption to the stage before placing it, and draws every line", () => {
  const caption = functionBody("paintRingCaption");
  assert.match(caption, /const lines = ringCaptionLines\(text, \{ maxWidth: stage\.width - pad \* 2, measure: \(line\) => context\.measureText\(line\)\.width \}\);/);
  assert.match(caption, /ringCaptionAt\(button, \{ width: [^}]*, height: lines\.length \* lineHeight \+ pad, gap \}, stage\)/);
  assert.match(caption, /lines\.forEach\(\(line, index\) => context\.fillText\(line, box\.x, /);
});

/* ------------------------------------------------------------------ */
/* 9. Codex review of S7, pass 3: focus and hover are two things       */
/* ------------------------------------------------------------------ */

test("CODEX PASS 3: the preview line follows the pointer, and falls back to the FOCUSED button when the pointer leaves", () => {
  const x = { type: "power-attack", targetId: "blue-1", actorId: "red-1" };
  const y = { type: "quick-attack", targetId: "blue-1", actorId: "red-1" };
  const run = (events) => events.reduce((state, [type, action]) => ringStripPreviewAfter(state, { type, action }), RING_STRIP_IDLE);
  // Focus X, point at X, point away: X's preview stays — the first build lost it.
  assert.equal(ringPreviewShown({ strip: run([["focus", x], ["enter", x], ["leave", x]]) }).action, x);
  // Focus X, point at Y: Y; point away from Y: X again.
  assert.equal(ringPreviewShown({ strip: run([["focus", x], ["enter", y]]) }).action, y);
  assert.equal(ringPreviewShown({ strip: run([["focus", x], ["enter", y], ["leave", y]]) }).action, x);
  // A late leave or blur of a button that is no longer the one pointed at or focused changes nothing.
  assert.equal(ringPreviewShown({ strip: run([["enter", x], ["enter", y], ["leave", x]]) }).action, y);
  assert.equal(ringPreviewShown({ strip: run([["focus", x], ["focus", y], ["blur", x]]) }).action, y);
  // Blurring the focused button while the pointer is on another keeps the pointer's.
  assert.equal(ringPreviewShown({ strip: run([["focus", x], ["enter", y], ["blur", x]]) }).action, y);
  assert.deepEqual(run([["focus", x], ["blur", x], ["enter", y], ["leave", y]]), RING_STRIP_IDLE);
});

test("CODEX PASS 3: what the line shows — the pointer (strip, then stage), else the focus, else the choice — and whether it is the choice", () => {
  const x = { type: "power-attack", targetId: "blue-1", actorId: "red-1" };
  const y = { type: "quick-attack", targetId: "blue-1", actorId: "red-1" };
  const z = { type: "walk-left", targetId: "red-1", actorId: "red-1" };
  const strip = (focus, hover) => ({ focus, hover });
  assert.deepEqual(ringPreviewShown({ strip: strip(x, y), stageHover: z, pending: null }), { action: y, chosen: false });
  assert.deepEqual(ringPreviewShown({ strip: strip(x, null), stageHover: z, pending: null }), { action: z, chosen: false });
  assert.deepEqual(ringPreviewShown({ strip: strip(x, null), stageHover: null, pending: z }), { action: x, chosen: false });
  assert.deepEqual(ringPreviewShown({ strip: RING_STRIP_IDLE, stageHover: null, pending: z }), { action: z, chosen: true });
  assert.deepEqual(ringPreviewShown({ strip: strip(null, { ...z }), pending: z }), { action: { ...z }, chosen: true }, "the same action, pointed at");
  assert.deepEqual(ringPreviewShown({ strip: RING_STRIP_IDLE }), { action: null, chosen: false });
});

test("CODEX PASS 3: the shell keeps focus and pointer apart, and every strip button carries its OWN preview as its description", () => {
  const strip = functionBody("renderRingStrip");
  for (const [event, type] of [["focus", "focus"], ["blur", "blur"], ["pointerenter", "enter"], ["pointerleave", "leave"]]) {
    assert.ok(raw.includes(`button.addEventListener("${event}", stripPreview("${type}"));`), `${event} -> ${type}`);
  }
  assert.match(strip, /ringStripState = ringStripPreviewAfter\(ringStripState, \{ type, action \}\);/);
  assert.match(strip, /ringStripState = RING_STRIP_IDLE;/, "a rebuild forgets the old buttons");
  // S9: the stage's hover is what the button stands for — its action, or a greyed button's entry
  // (`ringShownFor`); ~~`ringActionFor(view.model, ringHover)`~~.
  assert.match(functionBody("renderRingPreview"), /ringPreviewShown\(\{ strip: ringStripState, stageHover: ringHover \? ringShownFor\(view\.model, ringHover\) : null, pending \}\)/);
  // Each button's description is its own preview, not the shared line another button's hover rewrites.
  assert.ok(!raw.includes('setAttribute("aria-describedby", "ring-preview-text")'));
  assert.match(strip, /description\.textContent = ringPreviewTextOf\(action\) \?\? "";/);
  assert.match(strip, /button\.setAttribute\("", description\.id\);/);
  assert.match(page, /<div[^>]*id="ring-descriptions"[^>]*hidden|<div[^>]*hidden[^>]*id="ring-descriptions"/, "the descriptions are in the page, unseen");
});

test("after a choice made anywhere but the stage, the focus goes to Confirm, so the next Enter confirms instead of pressing what had the focus", () => {
  // Found on self-review before Codex pass 4: "5" pressed while a strip button had the focus chose the
  // power attack, and the next Enter pressed the focused strip button — choosing IT — not Confirm.
  const choose = functionBody("chooseRingAction");
  assert.match(choose, /if \(from === "" \|\| ringFocusKind\(document\.activeElement, \{ stage: canvas \}\) !== ""\) el\(""\)\?\.focus\(\);/);
  assert.ok(raw.includes('if (from === "strip" || ringFocusKind(document.activeElement, { stage: canvas }) !== "stage") el("ring-confirm-go")?.focus();'));
});

/* ------------------------------------------------------------------ */
/* 10. Codex review of S7, pass 4: the plain fallback list             */
/* ------------------------------------------------------------------ */

test("CODEX PASS 4: with no ring to draw (no menu, or one that throws), the plain list honours 'confirm every move' too", () => {
  const controls = functionBody("renderControls");
  const fallback = controls.slice(controls.indexOf("panel.buttons.map(({ action, enabled }) =>"));
  assert.ok(fallback.length > 0);
  // A click is a press like any other: it acts only when ringPressCommand says so, and with the setting on it chooses.
  assert.match(fallback, /const command = ringPressCommand\(action, \{ confirm: ringConfirm \}\);/);
  assert.match(fallback, /if \(command\?\.kind === ""\) sendPlain\(action\);/);
  // The one submit of the plain list lives in sendPlain, reached from an "act" or from the list's own Confirm.
  const send = functionBody("sendPlain");
  assert.match(send, /host\.submit\(\{ \.\.\.action, actorId \}\)/);
  assert.doesNotMatch(fallback, /host\.submit\(/, "no click submits directly");
  assert.match(controls, /plainConfirm\.addEventListener\("", \(\) => \{\s*if \(plainChoice\) sendPlain\(plainChoice\);/);
  assert.match(fallback, /else if \(command\?\.kind === ""\) \{\s*plainChoice = action;/, "a choice is only held");
  assert.match(fallback, /\.\.\.\(ringConfirm \? \[plainConfirm\] : \[\]\)/, "its Confirm is shown only with the setting on");
});
