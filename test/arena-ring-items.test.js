/**
 * THE ITEMS ROW ON THE RING (slice S5 of `docs/design/battle-ui.md`, "The
 * in-battle actions: DECIDED", item 1: "its six-slot items row above the head
 * for spells and potions"). The build's row is `inventory_overlay` (sprite
 * 492), attached to the overlay at (0, -80) and scaled 60 (overlay frame 1
 * body 0x2378d2, `+0x02fe`..`+0x0365`): six `inventory_buttons` (116), each
 * sent to the item or spell id its slot holds (492 frame 1 body 0x50e55,
 * `+0x0132`), empty ones hidden (`+0x02c4`).
 *
 * Seams under test: `ringModelFor`'s `items` and `offRing`, `ringActionFor`,
 * `ringKeyCommand` and `ringActionLabel` (`tools/arena/ring.js`);
 * `ringItemButtonsAt`, `ringSlotAt` and `ringLabelAt`
 * (`tools/arena/ring-layout.js`); `ringButtonArt` (`tools/arena/ring-art.js`);
 * and, read as text, the lines of `tools/arena/main.js` that hand them to the
 * page.
 *
 * The engine is not mocked where its answer matters: the offer and the menu
 * come off a REAL host. Expected values are literals: the turns were read off
 * the demo bouts named in each test, the positions worked by hand from the
 * row's table.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { SS2_ARENA, ss2BattleValues, ss2Combatant, ss2PhysicalSize, ss2TeamRules } from "../src/team/ss2-rules.js";
import { resourceValue } from "../src/team/resources.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { ringActionFor, ringActionLabel, ringKeyCommand, ringModelFor } from "../tools/arena/ring.js";
import {
  fighterBoxFor,
  ringButtonsAt,
  ringButtonsInside,
  ringItemButtonsAt,
  ringLabelAt,
  ringLabelSizeFor,
  ringMoveButtonsAt,
  ringPlacementFor,
  ringSlotAt,
  ringSwapButtonAt
} from "../tools/arena/ring-layout.js";
import { cameraFor, cameraStep, stageClipRectFor, stageFitFor, stageProjectorFor } from "../src/render/arena-backdrop.js";
import { rankOfDepth } from "../src/render/arena-shell.js";
import { figureScaleFor } from "../src/render/figure.js";
import { ss2ColossusYscaleAfter } from "../src/common/ss2-figure.js";
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
/** An action as one line, `type -> target`. */
const line = (action) => `${action.type}${action.itemId != null ? `#${action.itemId}` : ""} -> ${action.targetId}`;
/** The row's filled buttons as `key slot action` lines. */
const rowLines = (model) => model.items.filter((item) => item.action).map((item) => `${item.key} ${item.slot} ${line(item.action)}`);

/* ------------------------------------------------------------------ */
/* 1. What the row holds                                               */
/* ------------------------------------------------------------------ */

test("the `tricks` kit at the 3v3 opening: six spells on the row, keys Q-Y left to right, the foe spells at the SELECTED foe, the teleport at the caster — and none of them listed", () => {
  // 3v3 tricks seed 3, turn 0: red-1 holds gale (38), teleport (48), command (39), whirlwind (37), ghost
  // strike (36) and weaken armour (44) in slots 1-6. The row's left-to-right order is slots 5, 4, 1, 2, 3, 6.
  const model = modelOf(demoHost({ perSide: 3, seed: 3, kit: "tricks" }));
  assert.equal(model.selectedId, "blue-1");
  assert.deepEqual(rowLines(model), [
    "Q inventory_button5 cast-ghost-strike -> blue-1",
    "W inventory_button4 cast-whirlwind -> blue-1",
    "E inventory_button1 cast-gale -> blue-1",
    "R inventory_button2 cast-teleport -> red-1",
    "T inventory_button3 cast-command -> blue-1",
    "Y inventory_button6 cast-weaken-armour -> blue-1"
  ]);
  assert.deepEqual(model.offRing.map((entry) => line(entry.action)), ["rest -> red-1"], "no spell is left in the list");
});

test("a foe spell follows the SELECTION: select blue-3 and every foe spell on the row is aimed at him; the caster's own stays his", () => {
  const model = modelOf(demoHost({ perSide: 3, seed: 3, kit: "tricks" }), "blue-3");
  assert.equal(model.selectedId, "blue-3");
  assert.deepEqual(rowLines(model), [
    "Q inventory_button5 cast-ghost-strike -> blue-3",
    "W inventory_button4 cast-whirlwind -> blue-3",
    "E inventory_button1 cast-gale -> blue-3",
    "R inventory_button2 cast-teleport -> red-1",
    "T inventory_button3 cast-command -> blue-3",
    "Y inventory_button6 cast-weaken-armour -> blue-3"
  ]);
});

test("POTIONS: each place sends ITS OWN potion (the offer's `itemId` is the slot's), at the drinker; every place carries the build's own name for its item", () => {
  // 1v1 crowd seed 2, turn 0: blue-1 (an even seed opens with blue) holds adulation (47), little fat kid
  // (33), rejuvenate (43) and potions 5, 7 and 9 in slots 1-6.
  const model = modelOf(demoHost({ perSide: 1, seed: 2, kit: "crowd" }));
  assert.equal(model.actorId, "blue-1");
  assert.deepEqual(rowLines(model), [
    "Q inventory_button5 drink-potion#7 -> blue-1",
    "W inventory_button4 drink-potion#5 -> blue-1",
    "E inventory_button1 cast-adulation -> blue-1",
    "R inventory_button2 cast-little-fat-kid -> red-1",
    "T inventory_button3 cast-rejuvinate -> blue-1",
    "Y inventory_button6 drink-potion#9 -> blue-1"
  ]);
  assert.deepEqual(model.items.map((item) => [item.key, item.itemId, item.words]), [
    ["Q", 7, "Maximum stamina vial"],
    ["W", 5, "Maximum health potion"],
    ["E", 47, "Adulation"],
    ["R", 33, "Little Fat Kid"],
    ["T", 43, "Rejuvinate"],
    ["Y", 9, "Maximum armour oil"]
  ]);
  assert.deepEqual(model.items[0].action, { type: "drink-potion", targetId: "blue-1", itemId: 7, actorId: "blue-1" });
  assert.ok(model.items.every((item) => item.verb === "item"));
  assert.deepEqual(model.offRing.map((entry) => line(entry.action)), ["rest -> blue-1"]);
});

test("an EMPTY slot is an empty place — nothing drawn, keyed or sent — and the six places keep their keys whatever the kit fills", () => {
  // 1v1 blasts seed 1, turn 0: red-1 holds a lightning bolt (34) and a fireball (30) in slots 1 and 2,
  // which stand third and fourth from the left: E and R. Slots 3-6 hold the empty marker, 1.
  const model = modelOf(demoHost({ perSide: 1, seed: 1, kit: "blasts" }));
  assert.equal(model.actorId, "red-1");
  assert.deepEqual(rowLines(model), [
    "E inventory_button1 cast-lightning-bolt -> blue-1",
    "R inventory_button2 cast-fireball -> blue-1"
  ]);
  assert.deepEqual(model.items.map((item) => item.key), ["Q", "W", "E", "R", "T", "Y"]);
  for (const empty of model.items.filter((item) => !["E", "R"].includes(item.key))) {
    assert.deepEqual({ ...empty, key: null, slot: null, inventory: null }, { key: null, slot: null, inventory: null, itemId: null, verb: null, words: null, action: null });
  }
  assert.deepEqual(model.items.map((item) => item.inventory), ["inventory5", "inventory4", "inventory1", "inventory2", "inventory3", "inventory6"]);
});

test("no menu, no row: six empty places, and every spell and potion stays listed", () => {
  const host = demoHost({ perSide: 1, seed: 2, kit: "crowd" });
  const model = ringModelFor({
    actorId: host.currentCombatantId(), combatants: host.wire().teams.flatMap((team) => team.combatants), legal: host.legalActions(), menuFor: () => null
  });
  assert.equal(model.items.length, 6);
  assert.ok(model.items.every((item) => item.action === null && item.itemId === null));
  assert.deepEqual(model.offRing.map((entry) => line(entry.action)), host.legalActions().map(line));
});

/* ------------------------------------------------------------------ */
/* 2. What a key or a click sends, and what the strip says             */
/* ------------------------------------------------------------------ */

test("Q W E R T Y press the row's places left to right, by key or by the build's instance name — one press, never while typing, never with Ctrl/Alt/Meta", () => {
  const model = modelOf(demoHost({ perSide: 3, seed: 3, kit: "tricks" }));
  const gale = { type: "cast-gale", targetId: "blue-1", actorId: "red-1" };
  assert.deepEqual(ringActionFor(model, "E"), gale);
  assert.deepEqual(ringActionFor(model, "inventory_button1"), gale, "what a click on the drawn button names");
  assert.equal(ringActionFor(model, "E"), model.items[2].action, "the model's own action, not a copy");
  assert.deepEqual(ringKeyCommand(model, { key: "e", focus: "stage" }), { kind: "act", action: gale });
  assert.deepEqual(ringKeyCommand(model, { key: "E", focus: "stage" }), { kind: "act", action: gale }, "Caps Lock or Shift: the same key");
  assert.deepEqual(ringKeyCommand(model, { key: "e", focus: "control" }), { kind: "act", action: gale }, "from a strip button too");
  assert.deepEqual(ringKeyCommand(model, { key: "r", focus: "stage" }), { kind: "act", action: { type: "cast-teleport", targetId: "red-1", actorId: "red-1" } });
  assert.equal(ringKeyCommand(model, { key: "e", focus: "stage", repeat: true }), null, "a held E casts once");
  assert.equal(ringKeyCommand(model, { key: "e", focus: "text" }), null, "typing an E types it");
  for (const modifier of ["ctrlKey", "altKey", "metaKey"]) {
    assert.equal(ringKeyCommand(model, { key: "e", focus: "stage", [modifier]: true }), null, modifier);
  }
  assert.equal(ringKeyCommand(model, { key: "u", focus: "stage" }), null, "U is nothing");
  assert.equal(ringKeyCommand(null, { key: "e", focus: "stage" }), null, "no ring, no item");
});

test("an empty place's key is the browser's; so is its instance name", () => {
  const model = modelOf(demoHost({ perSide: 1, seed: 1, kit: "blasts" }));
  for (const key of ["q", "w", "t", "y"]) assert.equal(ringKeyCommand(model, { key, focus: "stage" }), null, key);
  assert.equal(ringActionFor(model, "Q"), null);
  assert.equal(ringActionFor(model, "inventory_button5"), null);
  assert.deepEqual(ringActionFor(model, "R"), { type: "cast-fireball", targetId: "blue-1", actorId: "red-1" });
});

test("the strip's words: the build's own name for the item, then the foe it is aimed at — a potion's id is not repeated after its name", () => {
  const nameOf = (id) => ({ "blue-1": "Nym", "red-1": "Ruk" })[id] ?? id;
  const tricks = modelOf(demoHost({ perSide: 3, seed: 3, kit: "tricks" }));
  const said = (item) => ringActionLabel(item.action, { words: item.words, nameOf });
  assert.deepEqual(tricks.items.map(said), ["Ghost Strike at Nym", "Whirlwind at Nym", "Gale at Nym", "Teleport", "Command at Nym", "Weaken Armour at Nym"]);
  const crowd = modelOf(demoHost({ perSide: 1, seed: 2, kit: "crowd" }));
  assert.deepEqual(crowd.items.map(said), ["Maximum stamina vial", "Maximum health potion", "Adulation", "Little Fat Kid at Ruk", "Rejuvinate", "Maximum armour oil"]);
  // Without the words, as S2 said it.
  assert.equal(ringActionLabel({ type: "drink-potion", targetId: "red-1", actorId: "red-1", itemId: 5 }), "Drink potion #5");
});

test("TWO OF ONE ITEM ARE TWO PLACES, as in the build, sending the one action the engine offers — and the engine spends the FIRST slot holding it, whichever was pressed", () => {
  // `items=5,5`, 1v1 seed 1: red-1 holds two maximum health potions, in slots 1 and 2 (E and R).
  const host = demoHost({ perSide: 1, seed: 1, kit: "5,5" });
  const model = modelOf(host);
  assert.deepEqual(rowLines(model), ["E inventory_button1 drink-potion#5 -> red-1", "R inventory_button2 drink-potion#5 -> red-1"]);
  assert.deepEqual(model.items[2].action, model.items[3].action);
  assert.equal(host.legalActions().filter((option) => option.type === "drink-potion").length, 1, "the engine offers it once");
  assert.ok(!model.offRing.some((entry) => entry.action.type === "drink-potion"));
  // The action names no slot, so the engine takes the first holding the id (`ss2InventorySlotHolding`,
  // `check_inventory`'s order) — where the build's own button empties the slot pressed (`+0x0626`).
  host.submit(ringKeyCommand(model, { key: "r", focus: "stage" }).action);
  const red = host.combatant("red-1");
  assert.deepEqual([resourceValue(red, "inventory1"), resourceValue(red, "inventory2")], [1, 5]);
});

/* ------------------------------------------------------------------ */
/* 3. Where the row stands                                             */
/* ------------------------------------------------------------------ */

/** A model with every place of the row filled, on the close warrior frame. */
function fullRow({ frame = "closerange_warrior" } = {}) {
  const ids = { inventory_button1: 38, inventory_button2: 48, inventory_button3: 39, inventory_button4: 37, inventory_button5: 36, inventory_button6: 44 };
  const order = ["inventory_button5", "inventory_button4", "inventory_button1", "inventory_button2", "inventory_button3", "inventory_button6"];
  return {
    stance: { frame, range: "close", weapon: "warrior", facing: "right" },
    slots: [],
    moves: [],
    swap: null,
    items: order.map((slot, index) => ({
      key: "QWERTY"[index], slot, inventory: slot.replace("_button", ""), itemId: ids[slot], verb: "item", words: "", action: { type: "cast-gale" }
    }))
  };
}
const near = (actual, expected) => Math.abs(actual - expected) < 1e-9;

test("THE BUILD'S PLACE: 492 at (0, -80) of the overlay at 60%, each of its six where it rests, each disc where 116 centres its background", () => {
  // Worked by hand. At rest (492 frame 5) the six stand at x -38, 4, 46, -80, -122, 88 (slots 1-6), y 0;
  // 116 centres its disc at (18.25, 18.25), so slot 5's disc is at 0.6 x (-122 + 18.25) = -62.25 and
  // -80 + 0.6 x 18.25 = -69.05 overlay px; slot 4's at -37.05, slot 1's -11.85, slot 2's 13.35, slot
  // 3's 38.55, slot 6's 63.75. At centre (300, 200) and 2 canvas px per overlay px: x 175.5, 225.9,
  // 276.3, 326.7, 377.1, 427.5, all at y 61.9; the radius is the ring's rule, 18 at the row's 0.6 — 21.6.
  // The head is far below, so the step-back arrow's place (y 165.8, top 137) is clear of the row.
  const buttons = ringItemButtonsAt(fullRow(), { centerX: 300, centerY: 200, unit: 2, head: 200 });
  assert.deepEqual(buttons.map((button) => [button.key, button.slot, button.verb, button.itemId, button.side]), [
    ["Q", "inventory_button5", "item", 36, "top"],
    ["W", "inventory_button4", "item", 37, "top"],
    ["E", "inventory_button1", "item", 38, "top"],
    ["R", "inventory_button2", "item", 48, "top"],
    ["T", "inventory_button3", "item", 39, "top"],
    ["Y", "inventory_button6", "item", 44, "top"]
  ]);
  const xs = [175.5, 225.9, 276.3, 326.7, 377.1, 427.5];
  buttons.forEach((button, index) => {
    assert.ok(near(button.x, xs[index]) && near(button.y, 61.9), `${button.key} at (${button.x}, ${button.y})`);
    assert.ok(near(button.r, 21.6) && near(button.scale, 1.2), `${button.key} r ${button.r} scale ${button.scale}`);
  });
  assert.equal(ringSlotAt(buttons, 276.3, 61.9), "inventory_button1", "a click on E names the slot ringActionFor takes");
  assert.equal(ringSlotAt(buttons, 276.3, 61.9 - 21.7), null);
  // An empty place draws nothing.
  const blasts = fullRow();
  blasts.items = blasts.items.map((item) => (["E", "R"].includes(item.key) ? item : { ...item, itemId: null, verb: null, action: null }));
  assert.deepEqual(ringItemButtonsAt(blasts, { centerX: 300, centerY: 200, unit: 2, head: 200 }).map((button) => button.key), ["E", "R"]);
  assert.deepEqual(ringItemButtonsAt({ ...fullRow(), items: [] }, { centerX: 300, centerY: 200, unit: 2, head: 200 }), []);
});

test("THE LETTERS STAY ON THE STAGE: a row at the top of it is moved down, with the whole ring, far enough for the letters over it", () => {
  // The labels are S2's size: px = max(9, round(0.62 r)), gap = max(3, 0.2 r). At unit 2 a place has
  // r 21.6: px 13, gap 4.32, so 17.32 px of room above its disc. A row whose discs just touch the top of
  // the stage (61.9 - 21.6 = 40.3) is moved down that far, to 79.22; the eight below it move with it.
  assert.deepEqual({ ...ringLabelSizeFor(21.6) }, { px: 13, gap: 4.32 });
  assert.deepEqual({ ...ringLabelSizeFor(10) }, { px: 9, gap: 3 }, "never smaller than S2's floor");
  const at = { centerX: 300, centerY: 200, unit: 2 };
  const eightSlots = ["optionA", "optionD"].map((slot, index) => ({ key: String(index + 1), slot, verb: "power_attack", action: { type: "power-attack" } }));
  const model = { ...fullRow(), slots: eightSlots };
  const row = ringItemButtonsAt(model, { ...at, head: 1000 });
  assert.ok(row.every((button) => near(button.labelRoom, 17.32)), "each place carries the room its letter needs");
  const stage = { x: 0, y: 40.3, width: 640, height: 400 };
  const eight = ringButtonsAt(model, at);
  const inside = ringButtonsInside([...eight, ...row], stage);
  assert.ok(inside.filter((button) => button.verb === "item").every((button) => near(button.y, 79.22)), String(inside.at(-1).y));
  assert.ok(near(inside[0].y, eight[0].y + 17.32), "the ring moves with it, keeping its shape");
  // Its letter, placed as the page places it, now clears the top of the stage.
  const e = inside.find((button) => button.key === "E");
  const { px, gap } = ringLabelSizeFor(e.r);
  const label = ringLabelAt(e, inside, { width: px * 0.6, height: px, gap });
  assert.ok(label.y - px / 2 >= stage.y - 1e-9, `the letter's top at ${label.y - px / 2}`);
  // A button with no letter over it keeps S4's rule: its disc alone.
  const bare = ringButtonsInside(eight, { ...stage, y: eight[0].y - eight[0].r });
  assert.equal(bare, eight, "already inside: the same array");
});

test("at rest the row clears the eight and the swap, at the ring's fullest: optionA and optionD are its nearest, 32.26 overlay px from Q and Y against 25.2 of radii", () => {
  const eightSlots = ["optionA", "optionB", "optionC", "optionG", "optionD", "optionE", "optionF", "optionH"]
    .map((slot, index) => ({ key: String(index + 1), slot, verb: "power_attack", action: { type: "power-attack" } }));
  const model = { ...fullRow(), slots: eightSlots, swap: { key: "9", slot: "swap_inventory", verb: "swap_weapons", usingBow: false, words: "", action: { type: "swap-weapons" } } };
  const at = { centerX: 0, centerY: 0, unit: 1 };
  const row = ringItemButtonsAt(model, { ...at, head: 1000 });
  const others = [...ringButtonsAt(model, at), ...ringSwapButtonAt(model, at)];
  assert.equal(others.length, 9);
  let nearest = null;
  for (const place of row) {
    for (const other of others) {
      const apart = Math.hypot(place.x - other.x, place.y - other.y);
      assert.ok(apart > place.r + other.r, `${place.key} overlaps ${other.slot}`);
      if (!nearest || apart < nearest.apart) nearest = { apart, pair: `${place.key}-${other.slot}` };
    }
  }
  assert.ok(Math.abs(nearest.apart - 32.26) < 0.01, JSON.stringify(nearest));
  assert.ok(["Q-optionA", "Y-optionD"].includes(nearest.pair), nearest.pair);
});

test("from a pack's measured layout, each place is its track's matrix at 492's RESTING frame (5), not where the row starts its slide", () => {
  // Frame 1 stacks the six at -340 twips; frame 5 is where 492 stops. A synthetic track puts slot 1 at
  // (-800, 20) twips there: (-40, 1) px, so its disc is at 0.6 x (-40 + 18.25) = -13.05 and
  // -80 + 0.6 x (1 + 18.25) = -68.45 overlay px. A place the pack has no track for keeps the table's.
  const rowLayout = {
    tracks: {
      inventory_button1: [
        { from: 1, to: 1, matrix: [1, 0, 0, 1, -340, 0] },
        { from: 5, to: 5, matrix: [1, 0, 0, 1, -800, 20] }
      ]
    }
  };
  const buttons = ringItemButtonsAt(fullRow(), { centerX: 0, centerY: 0, unit: 1, rowLayout, head: 1000 });
  const e = buttons.find((button) => button.key === "E");
  assert.ok(near(e.x, -13.05) && near(e.y, -68.45), `(${e.x}, ${e.y})`);
  const q = buttons.find((button) => button.key === "Q");
  assert.ok(near(q.x, -62.25) && near(q.y, -69.05), `the table's slot 5: (${q.x}, ${q.y})`);
});

test("THE OWNER'S LAYOUT: the row sits ABOVE the step-back arrow — moved up, the whole row as one, only as far as clears the arrow's place by the ring's own gap", () => {
  // The step-back arrow stands at head - gap - r, r = 18 x 0.8 = 14.4 and gap 31.5 - 28.8 = 2.7 overlay px
  // (S4). At unit 2: r 28.8, gap 5.4. The row's bottom at the build's place is 61.9 + 21.6 = 83.5.
  const at = { centerX: 300, centerY: 200, unit: 2 };
  const rowY = (head, bounds = null) => {
    const ys = [...new Set(ringItemButtonsAt(fullRow(), { ...at, head, bounds }).map((button) => Math.round(button.y * 1e9) / 1e9))];
    assert.equal(ys.length, 1, "one row, one height");
    return ys[0];
  };
  // Head 200: the arrow at 165.8, its top 137, clear of the row's 83.5 — the build's place stands.
  assert.ok(near(rowY(200), 61.9));
  // Head 150: arrow 115.8, top 87; the row's bottom must be at most 87 - 5.4 = 81.6, so it rises 1.9.
  assert.ok(near(rowY(150), 60.0), String(rowY(150)));
  // Head 120: arrow 85.8, top 57; the bottom at most 51.6, so the row is at 30.
  assert.ok(near(rowY(120), 30.0), String(rowY(120)));
  // The arrow kept on the stage (S4 clamps it to the top plus its radius): head 40 would put it at 5.8,
  // the stage keeps it at 28.8, its top at 0 — and the row stands above THAT place, at -5.4 - 21.6 = -27.
  assert.ok(near(rowY(40, { top: 0, bottom: 400 }), -27), String(rowY(40, { top: 0, bottom: 400 })));
  // No head to stand off (nothing drawn for the actor yet): the build's place.
  assert.ok(near(rowY(undefined), 61.9), String(rowY(undefined)));
  // The row clears the arrow S4 actually draws by exactly the gap.
  const model = { ...fullRow(), moves: [{ move: "rank-back", key: "ArrowUp", verb: "rank_back", place: "above-head", slot: null, action: { type: "rank-back" } }] };
  const [arrow] = ringMoveButtonsAt(model, { ...at, head: 120, feet: 400 });
  const row = ringItemButtonsAt(model, { ...at, head: 120 });
  for (const button of row) assert.ok(near(arrow.y - arrow.r - (button.y + button.r), 5.4), button.key);
});

/* ------------------------------------------------------------------ */
/* 4. What each place draws                                            */
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

test("THE BUILD'S OWN BUTTON: each place draws 116 at its ITEM's frame — the id is the frame — over the up background, the over frame under the pointer, its disc centred at (18.25, 18.25)", () => {
  const at = { centerX: 300, centerY: 200, unit: 2, head: 400 };
  const drawn = ringButtonArt(ringItemButtonsAt(fullRow(), at), { pack: stripPack() });
  // Q..Y hold 36, 37, 38, 48, 39, 44: frames 0x24, 0x25, 0x26, 0x30, 0x27, 0x2c.
  assert.deepEqual(drawn.map((button) => [button.key, button.source, fills(button)]), [
    ["Q", "build", [UP, "#000024"]],
    ["W", "build", [UP, "#000025"]],
    ["E", "build", [UP, "#000026"]],
    ["R", "build", [UP, "#000030"]],
    ["T", "build", [UP, "#000027"]],
    ["Y", "build", [UP, "#00002c"]]
  ]);
  assert.ok(drawn.every((button) => button.centre.x === 18.25 && button.centre.y === 18.25));
  const hovered = ringButtonArt(ringItemButtonsAt(fullRow(), at), { pack: stripPack(), hoverSlot: "inventory_button1" });
  assert.deepEqual(hovered.map((button) => [button.key, button.state, fills(button)[0]]).filter(([, state]) => state === "hover"), [["E", "hover", OVER]]);
  // Without the pack: the authored disc with a spell's glyph, centred on its own origin.
  const bare = ringButtonArt(ringItemButtonsAt(fullRow(), at), { pack: null });
  assert.ok(bare.every((button) => button.source === "authored" && button.centre.x === 0 && button.ops.some((op) => op.button === "glyph")));
});

test("A PLACE'S KEY LABEL GOES ABOVE IT — the row's outer side is up, and its neighbours stand too close for a label beside — else under it", () => {
  // Worked by hand at unit 1: E's disc is at (-11.85, -69.05), r 10.8. A label 8 x 9 px with a gap of 3
  // goes above, centred: y -69.05 - 10.8 - 3 - 4.5 = -87.35.
  const row = ringItemButtonsAt(fullRow(), { centerX: 0, centerY: 0, unit: 1, head: 1000 });
  const e = row.find((button) => button.key === "E");
  const size = { width: 8, height: 9, gap: 3 };
  const above = ringLabelAt(e, row, size);
  assert.deepEqual([above.align, Math.round(above.x * 100) / 100, Math.round(above.y * 100) / 100], ["center", -11.85, -87.35]);
  // Something drawn right above it: the label goes under the button instead (-69.05 + 10.8 + 3 + 4.5 = -50.75).
  const blocker = { slot: "x", x: -11.85, y: -95, r: 6, side: "left" };
  const under = ringLabelAt(e, [...row, blocker], size);
  assert.deepEqual([under.align, Math.round(under.y * 100) / 100], ["center", -50.75]);
  // Beside it would have run into W or R: 25.2 apart against 21.6 of radii leaves 3.6 px.
  const w = row.find((button) => button.key === "W");
  assert.ok(Math.hypot(e.x - w.x, e.y - w.y) - e.r - w.r < size.width + size.gap);
});

/* ------------------------------------------------------------------ */
/* 5. Acceptance: every spell and potion on offer, over whole bouts    */
/* ------------------------------------------------------------------ */

/** The four fields `actionIsLegal` compares, as one string. */
const identity = (action) => JSON.stringify([action.type, action.targetId, action.spellKind ?? null, action.itemId ?? null]);
const isItem = (action) => action.type === "drink-potion" || action.type.startsWith("cast-");

/**
 * THE ARENA'S OWN GEOMETRY for whoever is due, as `paintRing` places the ring (S6's helper in
 * `test/arena-ring-swap.test.js`, plus the items row): the camera fed every placed fighter as
 * `{x, side}` and run until it settles, the 640x420 stage, the head at the height the page draws him
 * (`figureScaleFor` of his `_yscale` and his rank's depth: the built size, or — where the page's
 * `drawnYscaleOf` settles once the cast has played — a colossus's fixed point, 150, and a little fat
 * kid's victim's 50), and the eight, the row, the swap and the moves kept inside the stage.
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
  const record = host.combatant(actor.id);
  const built = ss2PhysicalSize(record);
  const yscale = resourceValue(record, "spell_colossus", 0) > 0 ? ss2ColossusYscaleAfter(built, 100)
    : resourceValue(record, "spell_little_fat_kid", 0) > 0 ? 50 : built;
  const size = figureScaleFor({
    yscale,
    rank: rankOfDepth(actor.y, actor.slotIndex, { frontY: 200, rankStride: SS2_ARENA.rankStride }),
    slotIndex: actor.slotIndex
  });
  const box = fighterBoxFor({ footX: view.toX(actor.x), footY: view.toY(actor.y, 0), pxPerUnit: view.scale, size });
  const below = view.toY(actor.y, -22) + Math.max(10, view.scale * 15) * 0.5;
  const at = { centerX: placement.x, centerY: placement.y, unit: placement.unit };
  const bounds = { top: stage.y, bottom: stage.y + stage.height };
  const buttons = ringButtonsInside([
    ...ringButtonsAt(model, at),
    ...ringItemButtonsAt(model, { ...at, head: box.y0, bounds }),
    ...ringSwapButtonAt(model, at),
    ...ringMoveButtonsAt(model, { ...at, head: box.y0, feet: below, bounds })
  ], stage);
  const lifted = ringItemButtonsAt(model, { ...at, head: box.y0, bounds })[0]?.y !== ringItemButtonsAt(model, at)[0]?.y;
  return { buttons, stage, lifted };
}

test("ACCEPTANCE, over whole bouts with every foe selected in turn, under the arena's own camera: every spell and potion the engine offers is on the row for its target — the selected foe or the caster — drawn once, inside the stage, clear of every other button and above the step-back arrow, and sent by its click and by its key", (t) => {
  const tally = { bouts: 0, turns: 0, selections: 0, rowShown: 0, placesDrawn: 0, atFoe: 0, atSelf: 0, potions: 0, lifted: 0, belowArrowChecked: 0 };
  const EPS = 1e-9;
  for (const perSide of [1, 3]) {
    for (const kit of ["tricks", "crowd", "buffs", "blasts"]) {
      for (const seed of [1, 2, 3]) {
        const host = demoHost({ perSide, seed, kit });
        for (let taken = 0; !host.battle.result && taken < 1500; taken += 1) {
          const actorId = host.currentCombatantId();
          const offer = host.legalActions();
          const offered = new Set(offer.filter(isItem).map(identity));
          const reached = new Set();
          for (const foeId of modelOf(host).foeIds) {
            const model = modelOf(host, foeId);
            const where = `${perSide}v${perSide} ${kit} seed ${seed} turn ${taken}: ${actorId} vs ${foeId}`;
            const { buttons, stage, lifted } = arenaButtons(host, model);
            const row = model.items.filter((item) => item.action);
            // Every item offered at THIS foe or at the caster is on the row; none is left in the list.
            for (const option of offer.filter((candidate) => isItem(candidate) && (candidate.targetId === foeId || candidate.targetId === actorId))) {
              assert.ok(row.some((item) => identity(item.action) === identity(option)), `${where}: ${identity(option)} is not on the row`);
            }
            assert.ok(!model.offRing.some((entry) => isItem(entry.action)), `${where}: an item is listed`);
            for (const item of row) {
              const { action } = item;
              assert.ok(offered.has(identity(action)), `${where}: ${item.key} sends ${identity(action)}, which is not on offer`);
              assert.equal(action.actorId, actorId);
              assert.ok(action.targetId === foeId || action.targetId === actorId, `${where}: ${item.key} is aimed at ${action.targetId}`);
              tally[action.targetId === actorId ? "atSelf" : "atFoe"] += 1;
              if (action.type === "drink-potion") tally.potions += 1;
              reached.add(identity(action));
              const drawn = buttons.filter((button) => button.slot === item.slot);
              assert.equal(drawn.length, 1, `${where}: ${item.key} drawn ${drawn.length} times`);
              const [button] = drawn;
              assert.ok(button.x - button.r >= stage.x - EPS && button.x + button.r <= stage.x + stage.width + EPS
                && button.y - button.r >= stage.y - EPS && button.y + button.r <= stage.y + stage.height + EPS,
              `${where}: ${item.key} at (${button.x.toFixed(1)}, ${button.y.toFixed(1)}) leaves the stage`);
              for (const other of buttons) {
                if (other !== button) assert.ok(Math.hypot(other.x - button.x, other.y - button.y) >= other.r + button.r - EPS, `${where}: ${other.slot} overlaps ${item.key}`);
              }
              assert.deepEqual(ringActionFor(model, ringSlotAt(buttons, button.x, button.y)), action, `${where}: a click on ${item.key}`);
              assert.deepEqual(ringKeyCommand(model, { key: item.key.toLowerCase(), focus: "stage" }), { kind: "act", action }, `${where}: key ${item.key}`);
              // Its letter over it, as the page places it (S2's size, one letter about 0.6 em wide): on the
              // stage, and across no button.
              const { px, gap } = ringLabelSizeFor(button.r);
              const label = ringLabelAt(button, buttons, { width: px * 0.6, height: px, gap });
              assert.ok(label.y < button.y && label.y - px / 2 >= stage.y - EPS, `${where}: ${item.key}'s letter at ${label.y.toFixed(1)} is not over it on the stage`);
              for (const other of buttons) {
                const nx = Math.min(Math.max(other.x, label.x - px * 0.3), label.x + px * 0.3);
                const ny = Math.min(Math.max(other.y, label.y - px / 2), label.y + px / 2);
                assert.ok(Math.hypot(other.x - nx, other.y - ny) >= other.r - EPS, `${where}: ${item.key}'s letter crosses ${other.slot}`);
              }
              // The owner's layout: over the step-back arrow wherever it is drawn.
              const arrow = buttons.find((other) => other.slot === "rank-back");
              if (arrow) {
                assert.ok(button.y + button.r <= arrow.y - arrow.r + EPS, `${where}: ${item.key} is not above the step-back arrow`);
                tally.belowArrowChecked += 1;
              }
              tally.placesDrawn += 1;
            }
            // Every other button is inside the stage too: the row does not push the moves off it.
            for (const button of buttons) {
              assert.ok(button.y - button.r >= stage.y - EPS && button.y + button.r <= stage.y + stage.height + EPS, `${where}: ${button.slot} leaves the stage`);
            }
            if (row.length > 0) tally.rowShown += 1;
            if (row.length > 0 && lifted) tally.lifted += 1;
            tally.selections += 1;
          }
          // Every spell and potion on offer is on SOME selection's row.
          assert.deepEqual([...reached].sort(), [...offered].sort(), `${perSide}v${perSide} ${kit} seed ${seed} turn ${taken}: an offered item is on no row`);
          tally.turns += 1;
          host.submit({ ...host.suggestAction(actorId), actorId });
        }
        assert.ok(host.battle.result, `${perSide}v${perSide} ${kit} seed ${seed} finished`);
        tally.bouts += 1;
      }
    }
  }
  // Both places were reached: the build's own, and above a giant's step-back arrow (a colossus's head).
  assert.ok(tally.atFoe > 0 && tally.atSelf > 0 && tally.potions > 0 && tally.belowArrowChecked > 0 && tally.lifted > 0
    && tally.lifted < tally.rowShown, JSON.stringify(tally));
  t.diagnostic(JSON.stringify(tally));
});

/* ------------------------------------------------------------------ */
/* 6. The shell hands it to the page (read as text)                    */
/* ------------------------------------------------------------------ */

/**
 * `tools/arena/main.js` cannot be imported by node, so — as the other ring
 * tests do — the lines that hand the row to the canvas, the click, the keys and
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

test("the shell draws the row with the ring — from the pack's row layout, off the actor's drawn head, kept on the stage with the rest — and clicks what it drew", () => {
  const paint = functionBody("paintRing");
  assert.match(paint, /const buttons = ringButtonsInside\(\[\s*\.\.\.ringButtonsAt\([\s\S]*?\}\),\s*\.\.\.ringItemButtonsAt\(ringView\.model, \{[^}]*centerX: placement\.x,[^}]*centerY: placement\.y,[^}]*unit: placement\.unit,[^}]*layout: ringButtonPack\?\.layout \?\? null,[^}]*rowLayout: ringButtonPack\?\.inventory\?\.layout \?\? null,[^}]*head: ringOrigins\.actor\.head,[^}]*bounds: \{ top: stage\.y, bottom: stage\.y \+ stage\.height \}[^}]*\}\),\s*\.\.\.ringSwapButtonAt\(/,
    "the row after the eight, inside the stage fit, off the head the step-back arrow stands off");
  assert.match(paint, /ringButtons = buttons;/, "a click is tested against the row too");
  // A place's label is its letter alone: the build's own name is the strip's.
  assert.match(paint, /const label = button\.verb === "" \? button\.key : /);
  assert.ok(rawShell.includes('const label = button.verb === "item" ? button.key : '));
  assert.match(paint, /const \{ px, gap \} = ringLabelSizeFor\(button\.r\);/, "the letters are the size the stage fit keeps room for");
  // S7: the click presses through the confirm gate (`pressRing`), ~~`actFromRing` directly~~.
  assert.match(shell, /pressRing\(ringActionFor\(ringView\.model, slot\)\)/, "one route to the engine, as before");
  assert.equal((shell.match(/host\.submit\(/g) ?? []).length, 3);
});

test("the strip carries the row: an Items row of real buttons with their letters and the build's names; the status, the announcement, the note and the stage's name say Q-Y", () => {
  const strip = functionBody("renderRingStrip");
  assert.match(strip, /const itemRow = el\(""\);/);
  assert.ok(rawShell.includes('const itemRow = el("ring-items");'));
  assert.match(strip, /itemRow\.replaceChildren\(\.\.\.\(items\.length > 0\s*\? \[heading\(""\), \.\.\.items\.map\(\(item\) => actionButton\(item\.action, \{ words: item\.words, keys: \[item\.key\] \}\)\)\]\s*: \[\]\)\);/);
  assert.match(strip, /const items = model\.items\.filter\(\(item\) => item\.action\);/);
  assert.ok(rawShell.includes('${items.length > 0 ? `, ${items.map((item) => item.key).join(" ")} your items` : ""}'), "the status line names the letters on offer");
  assert.ok(rawShell.includes('${items.length > 0 ? `, ${items.length} item${items.length === 1 ? "" : "s"} over your head` : ""}'), "the announcement counts them");
  // A strip rebuilt under the keyboard focus hands it back to the row too, when it is the first with a button.
  assert.ok(rawShell.includes('?? enabled("ring-slots")[0] ?? enabled("ring-items")[0] ?? enabled("ring-target")[0] ?? enabled("ring-off")[0];'));
  // The idle strip empties the row as it empties the others.
  assert.match(strip, /if \(!view\) \{[\s\S]*?itemRow\.replaceChildren\(\);[\s\S]*?return;\s*\}/);
  assert.match(rawPage, /<div class="ring-row" id="ring-items" role="group" aria-label="Items and spells"><\/div>/);
  assert.match(rawPage, /aria-label="[^"]*\bQ to Y use your items and spells[^"]*"/, "the stage's own name tells a screen reader what the letters do");
  assert.ok(rawShell.includes('${ring.items.some((item) => item.action) ? ", Q–Y your items" : ""}'), "the turn's note says so");
});
