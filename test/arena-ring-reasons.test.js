/**
 * WHY A BUTTON IS GREYED (slice S9 of `docs/design/battle-ui.md`; the owner's
 * Q6: "HIDDEN where the original hides them (stance, level); GREYED with a
 * hover reason where the team rules forbid them (other rank, out of reach,
 * blocked)").
 *
 * The engine answers, per button of the ring measured to the selected foe,
 * whether it is on offer and — when it is not — one reason code with a hide or
 * grey flag (`host.unavailableActions`, `SS2_UNAVAILABLE_REASONS`). The ring
 * shows a GREY one where it stands, dimmed, with the engine's words for the
 * reason, and it can never act; a HIDE one is not drawn at all. Jump and
 * charge stay hidden whatever the engine flags them (the owner's Q8).
 *
 * The staged turns are REAL hosts at a named seed and turn; the reasons and
 * their words are the engine's, written here as literals read off the engine's
 * table so a change to either is caught.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { SS2_UNAVAILABLE_REASONS, ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { ringGreyTextFor, ringShownText } from "../tools/arena/ring-preview.js";
import { ringButtonsAt, ringButtonsInside, ringItemButtonsAt, ringMoveButtonsAt, ringSlotAt, ringSwapButtonAt } from "../tools/arena/ring-layout.js";
import { ringButtonArt } from "../tools/arena/ring-art.js";
import { actionButtonPackFrom } from "../src/render/action-buttons.js";
import { ringActionFor, ringClickCommand, ringEntries, ringGreyFor, ringKeyCommand, ringModelFor, ringShownFor } from "../tools/arena/ring.js";

const deps = { ss2Combatant, ss2BattleValues };

/** The arena's demo bout, headless, after `turns` of the rule set's own AI. */
function stagedHost({ perSide, seed, kit = "", turns = 0 }) {
  const items = demoItemsFrom(kit);
  const host = createVanillaBattleHost({
    teams: [demoSide("red", perSide, { ...deps, items, seed }), demoSide("blue", perSide, { ...deps, items, seed })],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed
  });
  for (let taken = 0; taken < turns; taken += 1) {
    const actorId = host.currentCombatantId();
    host.submit({ ...host.suggestAction(actorId), actorId });
  }
  return host;
}

/** The ring for whoever is due with `selected` chosen — the shell's own call. */
function modelOf(host, selected = null) {
  const actorId = host.currentCombatantId();
  return ringModelFor({
    actorId,
    combatants: host.wire().teams.flatMap((team) => team.combatants),
    legal: host.legalActions(),
    previous: selected,
    menuFor: (targetId) => host.unavailableActions(actorId, targetId)
  });
}

/** A slot as one line: `key slot verb`, then `acts` or the grey code, or `-` for nothing drawn. */
const slotLine = (slot) => `${slot.key} ${slot.slot} ${slot.verb ?? "-"}${slot.action ? " acts" : slot.reason ? ` grey:${slot.reason.code}` : ""}`;

/* ------------------------------------------------------------------ */
/* 1. The model: what is greyed, what is hidden                        */
/* ------------------------------------------------------------------ */

test("2v2 seed 1, the opening, red-1 with blue-2 (a rank back) selected: the taunt is GREYED in its slot with the engine's words, and sends nothing", () => {
  const host = stagedHost({ perSide: 2, seed: 1 });
  const model = modelOf(host, "blue-2");
  assert.equal(model.actorId, "red-1");
  assert.equal(model.selectedId, "blue-2");
  // `longrange_warrior` facing right: A jumpleft, B walkleft, C taunt|rest (taunt: he is rested), D jumpright,
  // E walkright, F chargeright, G wincrowd, H psyche_up. The engine offers the taunt only at blue-1, in red-1's
  // own rank (`other-rank`, grey); the jumps and the charge are not built (`not-built`, flagged grey by the
  // engine, HIDDEN by the owner's Q8); psyche up needs level 7 (`level`, hide).
  assert.deepEqual(model.slots.map(slotLine), [
    "1 optionA -",
    "2 optionB walkleft acts",
    "3 optionC taunt grey:other-rank",
    "4 optionG wincrowd acts",
    "5 optionD -",
    "6 optionE walkright acts",
    "7 optionF -",
    "8 optionH -"
  ]);
  const taunt = model.slots.find((slot) => slot.slot === "optionC");
  assert.equal(taunt.action, null, "a greyed button sends nothing");
  assert.deepEqual(taunt.reason, { code: "other-rank", words: "That foe is in another rank; you can only reach your own." });
  assert.deepEqual(taunt.withheld, { type: "taunt", targetId: "blue-2", actorId: "red-1" });
});

/** A move as one line: `move place slot`, then `acts` or the grey code. */
const moveLine = (move) => `${move.move} ${move.place} ${move.slot ?? "-"} ${move.action ? "acts" : move.reason ? `grey:${move.reason.code}` : "?"}`;

test("2v2 seed 1, 8 AI turns in, red-1 with blue-2 selected: blue-1 in reach puts the TURN on the close frame, so the walk toward him and the taunt are greyed `in-reach`, and there is no rank forward", () => {
  const host = stagedHost({ perSide: 2, seed: 1, turns: 8 });
  const model = modelOf(host, "blue-2");
  assert.equal(model.actorId, "red-1");
  // blue-2 is 354 away, so the RING is the long frame; blue-1, 86 away in red-1's own rank, puts the turn
  // on the close frame, which offers only the retreat and no taunt (the engine's `in-reach`).
  assert.deepEqual(model.stance, { frame: "longrange_warrior", range: "long", weapon: "warrior", facing: "right" });
  assert.deepEqual(model.slots.map(slotLine), [
    "1 optionA -",
    "2 optionB walkleft acts",
    "3 optionC taunt grey:in-reach",
    "4 optionG wincrowd acts",
    "5 optionD -",
    "6 optionE walkright grey:in-reach",
    "7 optionF -",
    "8 optionH -"
  ]);
  // The moves: the retreat in its slot, the walk toward him GREYED in its slot (its arrow key is that
  // button's), the step back above the head, and the step forward GREYED below the feet — red-1 is in
  // the front rank (`no-rank`).
  assert.deepEqual(model.moves.map(moveLine), [
    "walk-left slot optionB acts",
    "walk-right slot optionE grey:in-reach",
    "rank-back above-head - acts",
    "rank-front below-feet - grey:no-rank"
  ]);
  const forward = model.moves.find((move) => move.move === "rank-front");
  assert.equal(forward.action, null);
  assert.equal(forward.key, "ArrowDown");
  assert.equal(forward.verb, "rank_front");
  assert.deepEqual(forward.reason, { code: "no-rank", words: "There is no rank that way." });
  assert.deepEqual(forward.withheld, { type: "rank-front", targetId: "red-1", actorId: "red-1" });
  assert.deepEqual(model.moves.find((move) => move.move === "walk-right").reason,
    { code: "in-reach", words: "A foe is within reach, so this turn is fought at close range." });
});

test("a 1v1 is a duel from the first turn: both rank arrows are greyed `duel` on every turn — the rank arrows are authored, and the build has none", () => {
  const host = stagedHost({ perSide: 1, seed: 7 });
  const model = modelOf(host);
  assert.deepEqual(model.moves.filter((move) => move.move.startsWith("rank")).map(moveLine), [
    "rank-back above-head - grey:duel",
    "rank-front below-feet - grey:duel"
  ]);
  assert.equal(model.moves.find((move) => move.move === "rank-back").reason.words, "Two left standing: you may only close the gap.");
});

test("?items=10: an item the engine has no verb for keeps its place on the row GREYED `not-built`; the empty places stay hidden", () => {
  // 10 is `inventory_buttons` frame 10 (the swap's bow) and no item of the build's table; the engine resolves no
  // verb for it (`not-built`, grey). demoItemsFrom puts it in slot 1, which the row draws third from the left (E).
  const host = stagedHost({ perSide: 1, seed: 7, kit: "10" });
  const model = modelOf(host);
  const line = (item) => `${item.key} ${item.slot} ${item.itemId ?? "-"} ${item.action ? "acts" : item.reason ? `grey:${item.reason.code}` : "-"}`;
  assert.deepEqual(model.items.map(line), [
    "Q inventory_button5 - -",
    "W inventory_button4 - -",
    "E inventory_button1 10 grey:not-built",
    "R inventory_button2 - -",
    "T inventory_button3 - -",
    "Y inventory_button6 - -"
  ]);
  const ten = model.items.find((item) => item.key === "E");
  assert.equal(ten.verb, "item", "drawn as an item");
  assert.equal(ten.action, null);
  assert.deepEqual(ten.reason, { code: "not-built", words: "Not built yet." });
});

/* ------------------------------------------------------------------ */
/* 2. A greyed button can never act                                    */
/* ------------------------------------------------------------------ */

test("a greyed button's key, arrow or letter sends NOTHING — with or without confirm every move — and names the button and its reason, so the shell can say why", () => {
  const host = stagedHost({ perSide: 2, seed: 1, turns: 8 });
  const model = modelOf(host, "blue-2");
  const said = (command) => command && `${command.kind}:${command.why}:${command.entry?.slot}:${command.entry?.reason?.code}`;
  for (const confirm of [false, true]) {
    assert.equal(said(ringKeyCommand(model, { key: "3", focus: "stage", confirm })), "ignore:greyed:optionC:in-reach", `3, confirm ${confirm}`);
    assert.equal(said(ringKeyCommand(model, { key: "6", focus: "control", confirm })), "ignore:greyed:optionE:in-reach", `6, confirm ${confirm}`);
    assert.equal(said(ringKeyCommand(model, { key: "ArrowRight", focus: "stage", confirm })), "ignore:greyed:optionE:in-reach", `→, confirm ${confirm}`);
    assert.equal(said(ringKeyCommand(model, { key: "ArrowDown", focus: "stage", confirm })), "ignore:greyed:rank-front:no-rank", `↓, confirm ${confirm}`);
  }
  // Held, modified or typed: as for any other key of the ring.
  assert.equal(ringKeyCommand(model, { key: "3", focus: "stage", repeat: true }), null);
  assert.equal(ringKeyCommand(model, { key: "3", focus: "text" }), null);
  assert.equal(ringKeyCommand(model, { key: "3", focus: "stage", ctrlKey: true }), null);
  assert.equal(said(ringKeyCommand(model, { key: "ArrowDown", focus: "stage", repeat: true })), "ignore:repeat:undefined:undefined");
  // Neither a key, a slot's name nor a move's name reaches an action through a greyed button.
  for (const name of ["3", "optionC", "6", "optionE", "ArrowRight", "walk-right", "ArrowDown", "rank-front"]) {
    assert.equal(ringActionFor(model, name), null, name);
  }
  // A hidden slot is neither: nothing to act on and nothing to explain.
  assert.equal(ringKeyCommand(model, { key: "1", focus: "stage" }), null, "optionA holds the hidden jump");
  assert.equal(ringGreyFor(model, "optionA"), null);
  // The acting buttons still act.
  assert.equal(ringKeyCommand(model, { key: "2", focus: "stage" })?.kind, "act");
  assert.equal(ringKeyCommand(model, { key: "ArrowUp", focus: "stage", confirm: true })?.kind, "choose");
});

test("the greyed item's letter sends nothing and names it", () => {
  const model = modelOf(stagedHost({ perSide: 1, seed: 7, kit: "10" }));
  const command = ringKeyCommand(model, { key: "e", focus: "stage" });
  assert.equal(command?.kind, "ignore");
  assert.equal(command.why, "greyed");
  assert.equal(command.entry.slot, "inventory_button1");
  assert.equal(command.entry.reason.code, "not-built");
  assert.equal(ringActionFor(model, "E"), null);
  assert.equal(ringKeyCommand(model, { key: "q", focus: "stage" }), null, "an empty place is hidden, and its letter the browser's");
});

/* ------------------------------------------------------------------ */
/* 3. What a greyed button says                                        */
/* ------------------------------------------------------------------ */

test("a greyed button says what it is, at whom, and why not, in the engine's own words", () => {
  const nameOf = (id) => ({ "red-1": "Ruk", "blue-1": "Nym", "blue-2": "Cidra" })[id] ?? id;
  const model = modelOf(stagedHost({ perSide: 2, seed: 1, turns: 8 }), "blue-2");
  const text = (name) => ringGreyTextFor(ringGreyFor(model, name), { nameOf });
  assert.equal(text("optionC"), "Taunt at Cidra — not now: A foe is within reach, so this turn is fought at close range.");
  assert.equal(text("ArrowRight"), "Walk right — not now: A foe is within reach, so this turn is fought at close range.");
  assert.equal(text("rank-front"), "Step forward a rank — not now: There is no rank that way.");
  const other = modelOf(stagedHost({ perSide: 2, seed: 1 }), "blue-2");
  assert.equal(ringGreyTextFor(ringGreyFor(other, "3"), { nameOf }),
    "Taunt at Cidra — not now: That foe is in another rank; you can only reach your own.");
  const ten = modelOf(stagedHost({ perSide: 1, seed: 7, kit: "10" }));
  assert.equal(ringGreyTextFor(ringGreyFor(ten, "E"), { nameOf }), "Item #10 — not now: Not built yet.");
  assert.equal(ringGreyTextFor(null, { nameOf }), null);
});

/* ------------------------------------------------------------------ */
/* 4. Where a greyed button stands, and how it looks                   */
/* ------------------------------------------------------------------ */

test("a greyed button is DRAWN where it stands — its slot, its rank arrow's place, its place on the row — carrying its reason; an acting one carries none", () => {
  const model = modelOf(stagedHost({ perSide: 2, seed: 1, turns: 8 }), "blue-2");
  const at = { centerX: 100, centerY: 200, unit: 1 };
  const slots = ringButtonsAt(model, at);
  assert.deepEqual(slots.map((button) => `${button.slot} ${button.verb} ${button.reason?.code ?? "acts"}`), [
    "optionB walkleft acts",
    "optionC taunt in-reach",
    "optionG wincrowd acts",
    "optionE walkright in-reach"
  ]);
  // optionC is at (-64.2, 23.4) of the overlay, 0.8 scale: the fallback radius 18 * 0.8.
  const taunt = slots.find((button) => button.slot === "optionC");
  assert.deepEqual([taunt.x, taunt.y, taunt.r].map((value) => Math.round(value * 10) / 10), [35.8, 223.4, 14.4]);
  // The rank arrows: back above the head (acts), forward below the feet (greyed).
  const moves = ringMoveButtonsAt(model, { ...at, head: 120, feet: 300 });
  assert.deepEqual(moves.map((button) => `${button.move} ${button.place} ${button.reason?.code ?? "acts"}`), [
    "rank-back above-head acts",
    "rank-front below-feet no-rank"
  ]);
  const forward = moves.find((button) => button.move === "rank-front");
  assert.ok(forward.y - forward.r > 300, "below the feet");
  // The row: the greyed item has its place.
  const ten = modelOf(stagedHost({ perSide: 1, seed: 7, kit: "10" }));
  const row = ringItemButtonsAt(ten, { ...at, head: 120 });
  assert.deepEqual(row.map((button) => `${button.slot} ${button.itemId} ${button.reason?.code ?? "acts"}`), ["inventory_button1 10 not-built"]);
});

/** An icons pack with the ring's button (860) at every frame, its icon filled #cc0000, over an 826 background. */
function iconsPack() {
  const square = (fill) => ({ bounds: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 }, paths: [{ d: "M-10 -10L10 -10L10 10L-10 10Z", fill, fillRule: "nonzero" }] });
  const place = (kind, character, extra = {}) => ({ kind, character, depth: 1, matrix: [1, 0, 0, 1, 0, 0], ...extra });
  const frames = Array.from({ length: 41 }, (unused, index) => (index === 0
    ? [place("clip", 826, { name: "battlebutton", frameCount: 2 })]
    : [place("clip", 826, { name: "battlebutton", frameCount: 2 }), place("shape", 3000)]));
  return {
    shapes: { 824: square("#403020"), 825: square("#f0c040"), 3000: square("#cc0000") },
    texts: {},
    buttons: {
      button: 860,
      clips: { 860: { character: 860, frames, duplicateOf: {} } },
      nested: { 826: { character: 826, instances: ["battlebutton"], frames: [[place("shape", 824)], [place("shape", 825)]] } }
    }
  };
}

test("a greyed button is DIMMED — the build's own art through the build's greyscale at 0.55, or the authored disabled disc — and never lights up under the pointer", () => {
  const model = modelOf(stagedHost({ perSide: 2, seed: 1, turns: 8 }), "blue-2");
  const buttons = ringButtonsAt(model, { centerX: 0, centerY: 0, unit: 1 });
  const pack = actionButtonPackFrom(iconsPack());
  // The pointer on the greyed taunt: no rollover.
  const art = ringButtonArt(buttons, { pack, facing: "right", hoverSlot: "optionC" });
  const bySlot = Object.fromEntries(art.map((button) => [button.slot, button]));
  assert.equal(bySlot.optionC.state, "disabled");
  assert.equal(bySlot.optionE.state, "disabled");
  assert.equal(bySlot.optionB.state, "normal");
  assert.equal(bySlot.optionC.source, "build");
  // #cc0000 through Flash's greyscale (0.3086 * 204 = 63 on every channel) and the up background, never the
  // over one: #403020 greys to 0.3086*64 + 0.6094*48 + 0.082*32 = 19.75 + 29.25 + 2.62 = 51.63, so #343434.
  const fills = (button) => button.ops.filter((op) => op.kind === "path").map((op) => op.fill);
  assert.deepEqual(fills(bySlot.optionC), ["#343434", "#3f3f3f"]);
  assert.ok(bySlot.optionC.ops.every((op) => Math.abs(op.fillOpacity - 0.55) < 1e-9));
  assert.deepEqual(fills(bySlot.optionB), ["#403020", "#cc0000"], "an acting button keeps its colours");
  // Without a pack: the authored disabled disc, no halo even under the pointer.
  const bare = Object.fromEntries(ringButtonArt(buttons, { pack: null, facing: "right", hoverSlot: "optionC" }).map((button) => [button.slot, button]));
  const disc = (button) => button.ops.find((op) => op.button === "disc");
  assert.equal(disc(bare.optionC).fill, "#221c14");
  assert.equal(disc(bare.optionB).fill, "#33291d");
  assert.equal(bare.optionC.ops.some((op) => op.button === "halo"), false);
});

/* ------------------------------------------------------------------ */
/* 5. The strip lists them, in their places                            */
/* ------------------------------------------------------------------ */

test("the strip's order with the greyed buttons in their places — asked for; what sends, previews or confirms never sees them", () => {
  const model = modelOf(stagedHost({ perSide: 2, seed: 1, turns: 8 }), "blue-2");
  const line = (entry) => `${entry.place} ${entry.key ?? "-"} ${entry.slot ?? "-"} ${entry.action ? "acts" : `grey:${entry.reason.code}`}`;
  assert.deepEqual(ringEntries(model, { greyed: true }).map(line), [
    "slot 2 optionB acts",
    "slot 3 optionC grey:in-reach",
    "slot 4 optionG acts",
    "slot 6 optionE grey:in-reach",
    "move ArrowUp rank-back acts",
    "move ArrowDown rank-front grey:no-rank"
  ]);
  assert.deepEqual(ringEntries(model).map(line), ["slot 2 optionB acts", "slot 4 optionG acts", "move ArrowUp rank-back acts"]);
  // The greyed item, between the swap and the list, as the row is drawn.
  const ten = modelOf(stagedHost({ perSide: 1, seed: 7, kit: "10" }));
  const items = ringEntries(ten, { greyed: true }).filter((entry) => entry.place === "item");
  assert.deepEqual(items.map(line), ["item E inventory_button1 grey:not-built"]);
  assert.equal(items[0].words, "Item #10");
});

/* ------------------------------------------------------------------ */
/* 6. A click, and what a pointer on a drawn button shows              */
/* ------------------------------------------------------------------ */

test("a CLICK on a drawn button, named as `ringSlotAt` names it: an acting one acts (or, with confirm on, chooses); a greyed one says why and sends nothing; a hidden one is nothing", () => {
  const model = modelOf(stagedHost({ perSide: 2, seed: 1, turns: 8 }), "blue-2");
  const said = (command) => command && `${command.kind}:${command.why ?? "-"}:${command.entry?.slot ?? "-"}:${command.entry?.reason?.code ?? "-"}`;
  const left = { type: "walk-left", targetId: "red-1", actorId: "red-1" };
  for (const confirm of [false, true]) {
    // optionB holds the retreat, which acts: the very command a key press makes.
    assert.deepEqual(ringClickCommand(model, "optionB", { confirm }), { kind: confirm ? "choose" : "act", action: left });
    // The greyed taunt, the greyed walk toward him in its slot, and the greyed step forward below the feet.
    assert.equal(said(ringClickCommand(model, "optionC", { confirm })), "ignore:greyed:optionC:in-reach");
    assert.equal(said(ringClickCommand(model, "optionE", { confirm })), "ignore:greyed:optionE:in-reach");
    assert.equal(said(ringClickCommand(model, "rank-front", { confirm })), "ignore:greyed:rank-front:no-rank");
  }
  // Hidden (a jump) or nothing under the pointer: nothing at all.
  assert.equal(ringClickCommand(model, "optionA"), null);
  assert.equal(ringClickCommand(model, null), null);
  // The key route is the same road: a digit on the greyed taunt says the same.
  assert.deepEqual(ringKeyCommand(model, { key: "3", focus: "stage" }), ringClickCommand(model, "optionC"));
});

test("WHAT A POINTER ON A DRAWN BUTTON SHOWS (`ringShownFor`): an acting button's own action, a greyed one's entry — and the words for either (`ringShownText`)", () => {
  const nameOf = (id) => ({ "red-1": "Ruk", "blue-1": "Nym", "blue-2": "Cidra" })[id] ?? id;
  const model = modelOf(stagedHost({ perSide: 2, seed: 1, turns: 8 }), "blue-2");
  assert.equal(ringShownFor(model, "optionB"), ringActionFor(model, "optionB"), "the slot's own action, not a copy");
  assert.equal(ringShownFor(model, "rank-back"), ringActionFor(model, "rank-back"));
  const greyTaunt = ringShownFor(model, "optionC");
  assert.equal(greyTaunt.action, null);
  assert.deepEqual(greyTaunt.reason, { code: "in-reach", words: "A foe is within reach, so this turn is fought at close range." });
  assert.equal(ringShownFor(model, "rank-front").reason.code, "no-rank");
  assert.equal(ringShownFor(model, "optionA"), null, "a hidden jump shows nothing");
  assert.equal(ringShownFor(model, null), null);
  // The words: a greyed button's reason; an action's own preview words, whatever the caller previews it with.
  const previewTextOf = (action) => `PREVIEW ${action.type}`;
  assert.equal(ringShownText(greyTaunt, previewTextOf, { nameOf }),
    "Taunt at Cidra — not now: A foe is within reach, so this turn is fought at close range.");
  assert.equal(ringShownText(ringShownFor(model, "optionB"), previewTextOf, { nameOf }), "PREVIEW walk-left");
  assert.equal(ringShownText(null, previewTextOf, { nameOf }), null);
  assert.equal(ringShownText(ringShownFor(model, "optionB"), () => null, { nameOf }), null, "no preview, no words");
});

/* ------------------------------------------------------------------ */
/* 8. THE ACCEPTANCE: every grey code says its words; no hide renders  */
/* ------------------------------------------------------------------ */

/** Everything drawn for a model, as `paintRing` gathers it, on a 640 x 420 stage. */
function drawnButtons(model) {
  const at = { centerX: 320, centerY: 210, unit: 1.2 };
  const bounds = { top: 0, bottom: 420 };
  return ringButtonsInside([
    ...ringButtonsAt(model, at),
    ...ringItemButtonsAt(model, { ...at, head: 140, bounds }),
    ...ringSwapButtonAt(model, at),
    ...ringMoveButtonsAt(model, { ...at, head: 140, feet: 330, bounds })
  ], { x: 0, y: 0, width: 640, height: 420 }, { fighterX: at.centerX });
}
/** The name a drawn button carries for one engine menu entry: its slot, the row's place, the swap, or the move. */
const placeOf = (entry) => (entry.group === "inventory" ? entry.slot.replace("inventory", "inventory_button")
  : entry.group === "rank" ? entry.type : entry.slot);
const JUMP_OR_CHARGE = /^(jump|charge)(left|right)$/;
const GREY_CODES = Object.values(SS2_UNAVAILABLE_REASONS).filter((reason) => reason.display === "grey").map((reason) => reason.code);
const HIDE_CODES = Object.values(SS2_UNAVAILABLE_REASONS).filter((reason) => reason.display === "hide").map((reason) => reason.code);

test("EVERY CODE IN THE ENGINE'S TABLE: a grey one shows its button greyed with the engine's words; a hide one renders nothing — staged on the step-forward arrow, whose own reason no bout can make `rank-full`", () => {
  // The engine's table has ~~19 codes: 9 grey, 10 hide~~ **20 codes: 9 grey, 11 hide** (`SS2_UNAVAILABLE_REASONS`)
  // — `no-arrows` (hide, the build's own rule) joined in 39da762, after this slice's base; re-pinned at merge.
  assert.deepEqual([GREY_CODES.length, HIDE_CODES.length], [9, 11]);
  // 2v2 seed 1, 8 AI turns in: red-1's step forward is withheld (`no-rank`). Its entry is re-stamped with each
  // code in turn — as the engine stamps one, with that code's display — so every code reaches the ring.
  const host = stagedHost({ perSide: 2, seed: 1, turns: 8 });
  const actorId = host.currentCombatantId();
  const real = host.unavailableActions(actorId, "blue-2");
  const withCode = (code) => ringModelFor({
    actorId,
    combatants: host.wire().teams.flatMap((team) => team.combatants),
    legal: host.legalActions(),
    previous: "blue-2",
    menuFor: () => ({
      ...real,
      ring: real.ring.map((entry) => (entry.group === "rank" && entry.type === "rank-front"
        ? { ...entry, reason: code, display: SS2_UNAVAILABLE_REASONS[code].display }
        : entry))
    })
  });
  for (const code of GREY_CODES) {
    const model = withCode(code);
    const arrow = drawnButtons(model).filter((button) => button.slot === "rank-front");
    assert.equal(arrow.length, 1, `${code}: drawn`);
    assert.equal(arrow[0].reason.code, code);
    assert.equal(ringShownText(ringShownFor(model, "rank-front"), () => "a preview"),
      `Step forward a rank — not now: ${SS2_UNAVAILABLE_REASONS[code].says}`, code);
    assert.equal(ringClickCommand(model, "rank-front").why, "greyed", code);
    assert.equal(ringEntries(model, { greyed: true }).filter((entry) => entry.slot === "rank-front").length, 1, `${code}: listed`);
  }
  for (const code of HIDE_CODES) {
    const model = withCode(code);
    assert.equal(drawnButtons(model).filter((button) => button.slot === "rank-front").length, 0, `${code}: drawn`);
    assert.equal(ringShownFor(model, "rank-front"), null, code);
    assert.equal(ringEntries(model, { greyed: true }).filter((entry) => entry.slot === "rank-front").length, 0, `${code}: listed`);
    assert.deepEqual(ringKeyCommand(model, { key: "ArrowDown", focus: "stage" }), { kind: "ignore", why: "not-offered", move: "rank-front" }, code);
  }
});

test("ACCEPTANCE, over whole bouts with every foe selected in turn: every button the engine withholds for a GREY code is drawn once, greyed, where it stands, says the engine's words under the pointer, sends nothing when clicked and is listed once; every HIDE code — and jump and charge — renders nothing", (t) => {
  const grey = {};
  const hidden = {};
  const drawnHidden = {};
  const tally = { bouts: 0, selections: 0, entries: 0 };
  for (const perSide of [1, 2, 3]) {
    for (const kit of ["", "tricks", "buffs", "10"]) {
      for (const seed of [1, 2]) {
        const host = stagedHost({ perSide, seed, kit });
        for (let taken = 0; !host.battle.result; taken += 1) {
          assert.ok(taken < 1500, "finished");
          const actorId = host.currentCombatantId();
          const nameOf = (id) => host.combatant(id)?.name ?? id;
          for (const foeId of modelOf(host).foeIds) {
            const model = modelOf(host, foeId);
            const menu = host.unavailableActions(actorId, foeId);
            const buttons = drawnButtons(model);
            const listed = ringEntries(model, { greyed: true }).filter((entry) => entry.reason);
            const where = `${perSide}v${perSide} ${kit || "plain"} seed ${seed} turn ${taken}: ${actorId} vs ${foeId}`;
            for (const entry of menu.ring) {
              if (entry.available) continue;
              tally.entries += 1;
              const place = placeOf(entry);
              const at = buttons.filter((button) => button.slot === place);
              if (entry.display === "grey" && !JUMP_OR_CHARGE.test(entry.verb)) {
                grey[entry.reason] = (grey[entry.reason] ?? 0) + 1;
                const says = SS2_UNAVAILABLE_REASONS[entry.reason].says;
                assert.equal(at.length, 1, `${where}: ${place} (${entry.reason}) drawn ${at.length} times`);
                assert.equal(at[0].reason?.code, entry.reason, `${where}: ${place} greyed for the engine's reason`);
                const [art] = ringButtonArt(at, { pack: null, hoverSlot: place });
                assert.equal(art.state, "disabled", `${where}: ${place} dimmed, even under the pointer`);
                const hit = ringSlotAt(buttons, at[0].x, at[0].y);
                assert.equal(hit, place, `${where}: the pointer on ${place} is on it`);
                const text = ringShownText(ringShownFor(model, hit), () => "a preview", { nameOf });
                assert.ok(text?.endsWith(` — not now: ${says}`), `${where}: ${place} says "${text}"`);
                assert.equal(ringActionFor(model, hit), null, `${where}: ${place} sends`);
                assert.equal(ringClickCommand(model, hit, { confirm: taken % 2 === 0 })?.why, "greyed", `${where}: a click on ${place}`);
                assert.equal(listed.filter((one) => one.slot === place && one.reason.code === entry.reason).length, 1, `${where}: ${place} listed once`);
              } else {
                const code = JUMP_OR_CHARGE.test(entry.verb) ? `${entry.reason} (${entry.verb.replace(/(left|right)$/, "")})` : entry.reason;
                hidden[code] = (hidden[code] ?? 0) + 1;
                if (at.length > 0) drawnHidden[code] = (drawnHidden[code] ?? 0) + 1;
                assert.equal(at.length, 0, `${where}: ${place} withheld for ${entry.reason} (${entry.display}) is drawn`);
                assert.equal(listed.filter((one) => one.slot === place).length, 0, `${where}: ${place} withheld for ${entry.reason} is listed`);
              }
            }
            tally.selections += 1;
          }
          host.submit({ ...host.suggestAction(actorId), actorId });
        }
        tally.bouts += 1;
      }
    }
  }
  // Every team rule the bouts can reach, and the engine's own `not-built` (the `?items=10` kit), was shown.
  // `rank-full` is the offer's gate no bout reaches (the engine's docblock); it and the engine's other two are
  // staged above. Jump and charge were HIDDEN every time the engine flagged them `not-built`.
  for (const code of ["other-rank", "in-reach", "body-blocks", "duel", "no-rank", "not-built"]) {
    assert.ok((grey[code] ?? 0) > 0, `${code} never shown: ${JSON.stringify(grey)}`);
  }
  for (const code of ["slot-empty", "no-secondary", "level", "bow-drawn", "no-ammo", "not-built (jump)", "not-built (charge)"]) {
    assert.ok((hidden[code] ?? 0) > 0, `${code} never hidden: ${JSON.stringify(hidden)}`);
  }
  assert.deepEqual(drawnHidden, {});
  assert.equal(tally.bouts, 24);
  t.diagnostic(JSON.stringify({ ...tally, grey, hidden }));
});

/* ------------------------------------------------------------------ */
/* 7. The shell draws, says and lists them (read as TEXT)              */
/* ------------------------------------------------------------------ */

/**
 * `tools/arena/main.js` cannot be imported by node, so — as the other ring tests do — the lines that
 * hand the greyed buttons to the canvas, the pointer, the keys, the live region and the strip are
 * pinned as text, comments and strings blanked first (`raw` keeps the strings, for the few pins on them).
 */
const raw = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../tools/arena/index.html", import.meta.url), "utf8");
const code = raw
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
function functionBody(name) {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is not defined in tools/arena/main.js`);
  let depth = 0;
  for (let index = code.indexOf(") {", start) + 2; index < code.length; index += 1) {
    if (code[index] === "{") depth += 1;
    else if (code[index] === "}") { depth -= 1; if (depth === 0) return code.slice(start, index + 1); }
  }
  throw new Error(`${name}'s braces do not balance`);
}

test("THE SHELL, ON THE STAGE: a greyed button is drawn with the rest and carries no key label; the pointer on it shows why, not a preview, under a not-allowed cursor; a click on it goes the key's road", () => {
  const paint = functionBody("paintRing");
  assert.match(paint, /if \(button\.move\) continue;\s*if \(button\.reason\) continue;/,
    "a greyed button carries no key label: its key only says why, which the pointer and the strip say too");
  // The caption and the preview line both show what the button under the pointer stands for.
  assert.match(functionBody("paintRingCaption"), /text: ringShownTextOf\(ringShownFor\(view\.model, button\.slot\)\)/);
  const preview = functionBody("renderRingPreview");
  assert.match(preview, /stageHover: ringHover \? ringShownFor\(view\.model, ringHover\) : null/);
  assert.match(preview, /const line = shown \? ringShownTextOf\(shown\) : null;/);
  assert.match(functionBody("ringShownTextOf"), /return ringShownText\(shown, ringPreviewTextOf, \{ nameOf: /);
  // The click: one command, the key's (`ringClickCommand`), run where every command runs.
  assert.match(code, /if \(slot\) \{\s*runRingCommand\(ringClickCommand\(ringView\.model, slot, \{ confirm: ringConfirm \}\)\);\s*return;\s*\}/);
  assert.ok(raw.includes('canvas.style.cursor = slot ? (ringGreyFor(ringView.model, slot) ? "not-allowed" : "pointer") : foeId ? "pointer" : "";'));
  // A greyed press — a click or a key — is said in the live region, in the words the pointer shows.
  assert.match(functionBody("runRingCommand"), /else if \(command\.why === ""\) announce\(ringShownTextOf\(command\.entry\)\);/);
  assert.ok(raw.includes('else if (command.why === "greyed") announce(ringShownTextOf(command.entry));'));
  // Still one sender, reached only by an act.
  assert.equal([...code.matchAll(/actFromRing\(/g)].length, 2, "the definition and one call");
  assert.equal((code.match(/host\.submit\(/g) ?? []).length, 3);
});

test("THE SHELL, IN THE STRIP: every greyed button is listed in its place — a real button, aria-disabled so the keyboard still reaches it, its reason its accessible description, and a press on it says why and sends nothing", () => {
  const strip = functionBody("renderRingStrip");
  // The factory for a greyed one.
  const grey = strip.slice(strip.indexOf("const greyButton = (entry, { keys = [] } = {}) => {"));
  assert.ok(grey.length > 0, "a greyButton factory");
  const body = grey.slice(0, grey.indexOf("\n  };") + 5);
  assert.match(body, /button\.setAttribute\("", ""\);/);
  assert.ok(raw.includes('button.setAttribute("aria-disabled", "true");'), "aria-disabled, not disabled: focusable, and said to be unavailable");
  assert.doesNotMatch(body, /button\.disabled = /, "never the disabled property, which takes it out of the keyboard's reach");
  assert.doesNotMatch(body, /pressRing\(/, "it presses nothing");
  assert.match(body, /addEventListener\("", \(\) => runRingCommand\(ringClickCommand\(model, entry\.slot, \{ confirm: ringConfirm \}\), \{ from: "" \}\)\)/);
  assert.match(body, /button\.append\(document\.createTextNode\(ringGreyLabelFor\(entry, \{ nameOf \}\)\)\);/);
  assert.match(body, /description\.textContent = ringShownTextOf\(entry\) \?\? "";/);
  assert.match(body, /button\.setAttribute\("", description\.id\);/);
  assert.match(body, /ringStripState = ringStripPreviewAfter\(ringStripState, \{ type, action: entry \}\);/, "its focus and hover drive the preview line");
  // Where they are listed: the ring row takes each greyed slot and greyed move in its place, the items row each greyed item.
  assert.match(strip, /model\.slots\.filter\(\(slot\) => slot\.action \|\| slot\.reason\)\.map\(\(slot\) => slot\.action\s*\? actionButton\(slot\.action, \{ verb: slot\.verb, keys: slotKeys\(slot\) \}\)\s*: greyButton\(ringGreyFor\(model, slot\.slot\), \{ keys: slotKeys\(slot\) \}\)\)/);
  assert.match(strip, /\.\.\.unslotted\.map\(\(move\) => move\.action\s*\? actionButton\(move\.action, \{ verb: move\.verb, keys: \[move\.key\] \}\)\s*: greyButton\(ringGreyFor\(model, move\.move\), \{ keys: \[move\.key\] \}\)\)/);
  assert.match(strip, /model\.items\.filter\(\(item\) => item\.action \|\| item\.reason\)\.map\(\(item\) => item\.action\s*\? actionButton\(item\.action, \{ words: item\.words, keys: \[item\.key\] \}\)\s*: greyButton\(ringGreyFor\(model, item\.slot\), \{ keys: \[item\.key\] \}\)\)/);
  // The turn's announcement counts what acts on the ring, and says how many are greyed.
  assert.ok(raw.includes("`${filled.length + unslotted.filter((move) => move.action).length} on the ring"));
  assert.ok(raw.includes('${greyed.length > 0 ? `, ${greyed.length} greyed` : ""}'));
  assert.match(strip, /const greyed = ringEntries\(model, \{ greyed: true \}\)\.filter\(\(entry\) => entry\.reason\);/);
  // A strip rebuilt under the focus hands it back to a greyed button it was on, but falls back only to one that acts.
  assert.ok(raw.includes('const enabled = (row) => [...(el(row)?.querySelectorAll(\'button:not(:disabled):not([aria-disabled="true"])\') ?? [])];'));
  // The page: the greyed look in the strip, and the stage's own name says what a dimmed button is.
  assert.match(page, /\.ring-row button\[aria-disabled="true"\] \{[^}]*opacity:[^}]*cursor: not-allowed;[^}]*\}/);
  assert.match(page, /<canvas[^>]*aria-label="[^"]*A dimmed button is not on offer now[^"]*"/);
  // The provenance panel names the greyed look as authored.
  assert.match(functionBody("ringProvenance"), /""/);
  assert.ok(raw.includes("A dimmed button is one the team rules forbid this turn"));
});
