/**
 * JUMP AND CHARGE, SHOWN GREYED "NOT BUILT YET" — the owner's decision 9 of
 * `docs/design/battle-ui.md#decided-hud-2026-09-24` (2026-09-24, reversing the
 * ring's Q8 "stay hidden"), built 2026-09-28 (slice "jumpcharge").
 *
 * The engine already flags every jump and charge the build's controller frames
 * wire `not-built` — a GREY code in `SS2_UNAVAILABLE_REASONS`, "Not built yet."
 * — and S9 draws a grey code; the ring hid these four anyway
 * (`RING_HIDDEN_VERBS`, gone). Shown, each is greyed exactly as every other
 * grey code: drawn once in its slot, the engine's words under the pointer and
 * in the strip, nothing sent by a click or a key, listed once among the greyed.
 *
 * ► **AND NOTHING ELSE ON THE RING MOVES** — every other entry of the model,
 *   every other button and its place, and every key label. Drawn, the greyed
 *   jumps stand right over the two walks (optionA, optionD) and a charge under
 *   one (optionC, optionF), where a walk's label at the stage's side went; so a
 *   key label is placed as if they were not there, and they are painted under
 *   every label (`ringLabelAt`, `ringPaintOrder`).
 *
 * Seams: `ringModelFor`, `ringEntries`, `ringGreyFor`, `ringClickCommand`,
 * `ringKeyCommand`, `ringActionFor`, `ringShownFor` and `RING_VERB_LABELS`
 * (`tools/arena/ring.js`); `ringGreyTextFor`, `ringGreyLabelFor`,
 * `ringShownText` (`tools/arena/ring-preview.js`); `ringButtonsAt`,
 * `ringButtonsInside`, `ringLabelAt`, `ringPaintOrder`, `ringSlotAt`
 * (`tools/arena/ring-layout.js`); `ringButtonArt` (`tools/arena/ring-art.js`);
 * and, read as text, `paintRing` in `tools/arena/main.js`. The bouts come off a
 * REAL host, never a mock; the expected words and places are literals.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { SS2_BUTTON_WIRING, actionButtonPackFrom } from "../src/render/action-buttons.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { RING_VERB_LABELS, ringActionFor, ringClickCommand, ringEntries, ringGreyFor, ringKeyCommand, ringModelFor, ringShownFor } from "../tools/arena/ring.js";
import { ringGreyLabelFor, ringGreyTextFor, ringShownText } from "../tools/arena/ring-preview.js";
import {
  ringButtonsAt,
  ringButtonsInside,
  ringItemButtonsAt,
  ringLabelAt,
  ringLabelBoxOf,
  ringLabelSizeFor,
  ringMoveButtonsAt,
  ringPaintOrder,
  ringSlotAt,
  ringSwapButtonAt,
  ringUnderLabels
} from "../tools/arena/ring-layout.js";
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
/** Plays the rule set's own AI for `turns` submissions. */
function played(host, turns) {
  for (let taken = 0; taken < turns; taken += 1) {
    const due = host.currentCombatantId();
    host.submit({ ...host.suggestAction(due), actorId: due });
  }
  return host;
}
/** The ring for whoever is due with `previous` selected, read off the host exactly as the shell reads it. */
function modelOf(host, previous = null, menuOf = (menu) => menu) {
  const actorId = host.currentCombatantId();
  return ringModelFor({
    actorId,
    combatants: host.wire().teams.flatMap((team) => team.combatants),
    legal: host.legalActions(),
    previous,
    menuFor: (targetId) => menuOf(host.unavailableActions(actorId, targetId))
  });
}
const JUMP_OR_CHARGE = /^(jump|charge)(left|right)$/;
/** A slot as one line: `key slot verb`, then `acts`, or the grey code, or nothing when nothing is drawn. */
const slotLine = (slot) => `${slot.key} ${slot.slot} ${slot.verb ?? "-"}${slot.action ? " acts" : slot.reason ? ` grey:${slot.reason.code}` : ""}`;

/* ------------------------------------------------------------------ */
/* 1. What they say                                                    */
/* ------------------------------------------------------------------ */

test("every verb the build's four controller frames wire — jump and charge now among them — has a stage label of seven letters at most and a long one", () => {
  const wired = new Set();
  for (const record of Object.values(SS2_BUTTON_WIRING)) {
    for (const facing of ["right", "left"]) for (const wires of Object.values(record[facing])) for (const one of wires) wired.add(one.verb);
  }
  // The 15 the engine builds (test/arena-ring.test.js holds those) and the four it does not.
  assert.deepEqual([...wired].filter((verb) => JUMP_OR_CHARGE.test(verb)).sort(), ["chargeleft", "chargeright", "jumpleft", "jumpright"]);
  assert.equal(wired.size, 19);
  for (const verb of wired) {
    const label = RING_VERB_LABELS[verb];
    assert.ok(label, `${verb} has a label`);
    assert.ok(label.short.length > 0 && label.short.length <= 7, `${verb}: "${label.short}" fits beside a button`);
    assert.ok(label.long.length >= label.short.length, `${verb}: the long label`);
  }
});

test("A GREYED JUMP OR CHARGE SAYS WHAT IT IS AND WHY NOT, in the engine's words: \"Jump left — not now: Not built yet.\" — aimed at nobody, as the build's jump is", () => {
  // 1v1 seed 7: red-1 opens on the long warrior frame facing right (A jumpleft, D jumpright, F chargeright);
  // blue-1, next, faces left on it (A jumpleft, C chargeleft, D jumpright).
  const host = demoHost({ perSide: 1, seed: 7 });
  const right = modelOf(host);
  const left = modelOf(played(host, 1));
  assert.deepEqual([right.actorId, right.stance.frame, right.stance.facing], ["red-1", "longrange_warrior", "right"]);
  assert.deepEqual([left.actorId, left.stance.frame, left.stance.facing], ["blue-1", "longrange_warrior", "left"]);
  const says = (model, name) => ringGreyTextFor(ringGreyFor(model, name), { nameOf: (id) => `<${id}>` });
  assert.equal(says(right, "optionA"), "Jump left — not now: Not built yet.");
  assert.equal(says(right, "5"), "Jump right — not now: Not built yet.", "by its key, as the strip and the live region name it");
  assert.equal(says(right, "optionF"), "Charge right — not now: Not built yet.");
  assert.equal(says(left, "optionC"), "Charge left — not now: Not built yet.");
  assert.equal(says(left, "optionA"), "Jump left — not now: Not built yet.");
  // The strip's button text: the long label alone.
  assert.equal(ringGreyLabelFor(ringGreyFor(right, "optionF")), "Charge right");
});

/* ------------------------------------------------------------------ */
/* 2. A key label does not give way to them                            */
/* ------------------------------------------------------------------ */

/** Hides every jump and charge the engine greys — what the ring drew before decision 9 (`RING_HIDDEN_VERBS`). */
const hideJumpAndCharge = (menu) => ({
  ...menu,
  ring: menu.ring.map((entry) => (JUMP_OR_CHARGE.test(entry.verb ?? "") && entry.display === "grey" ? { ...entry, display: "hide" } : entry))
});

test("A KEY LABEL MAY CROSS A GREYED JUMP OR CHARGE, so it stands where it stood before they were shown — but it still gives way to every other button, greyed or not, and to a jump that acts", () => {
  // Worked by hand. A walk at (20, 100), r 10, in the ring's left column, on a stage from (0, 0); a label 30 x 9,
  // gap 3. Its outer side (right-aligned at 20 - 10 - 3 = 7, x -23..7) is off the stage. Under it (centred, x 5..35,
  // y 113..122) runs across a greyed taunt at (20, 130), r 10: the nearest point, (20, 122), is 8 from its centre.
  // Over it (x 5..35, y 78..87) runs across whatever stands at (32, 70), r 10: the nearest point, (32, 78), is 8
  // from its centre.
  const stage = { x: 0, y: 0, width: 640, height: 400 };
  const size = { width: 30, height: 9, gap: 3 };
  const walk = { slot: "optionB", verb: "walkleft", x: 20, y: 100, r: 10, side: "left" };
  const under = { slot: "optionC", verb: "taunt", x: 20, y: 130, r: 10, side: "left", reason: { code: "other-rank", words: "…" } };
  const over = (button) => ({ x: 32, y: 70, r: 10, side: "left", ...button });
  const placed = (above) => ({ ...ringLabelAt(walk, [above, walk, under], size, { stage }) });
  const notBuilt = { code: "not-built", words: "Not built yet." };
  // Nothing over it — the ring before decision 9: over it, centred, on the stage.
  assert.deepEqual({ ...ringLabelAt(walk, [walk, under], size, { stage }) }, { x: 20, y: 82.5, align: "center" });
  // A greyed jump, or a greyed charge, there: the same place, across it.
  assert.deepEqual(placed(over({ slot: "optionA", verb: "jumpleft", reason: notBuilt })), { x: 20, y: 82.5, align: "center" });
  assert.deepEqual(placed(over({ slot: "optionD", verb: "jumpright", reason: notBuilt })), { x: 20, y: 82.5, align: "center" });
  assert.deepEqual(placed(over({ slot: "optionC", verb: "chargeleft", reason: notBuilt })), { x: 20, y: 82.5, align: "center" });
  assert.deepEqual(placed(over({ slot: "optionF", verb: "chargeright", reason: notBuilt })), { x: 20, y: 82.5, align: "center" });
  // Anything else there keeps the label off itself, as S2-S9 decided — so, with no clear place on the stage, the
  // label keeps its outer side: a swing that acts; a taunt greyed for a team rule; the ITEM the engine has not
  // built (`?items=10`), whose code is the jump's but which is no jump or charge; and a jump that ACTS (none does
  // yet: the day one is built, it is a button like any other).
  assert.deepEqual(placed(over({ slot: "optionA", verb: "power_attack" })), { x: 7, y: 100, align: "right" });
  assert.deepEqual(placed(over({ slot: "optionA", verb: "taunt", reason: { code: "other-rank", words: "…" } })), { x: 7, y: 100, align: "right" });
  assert.deepEqual(placed(over({ slot: "inventory_button1", verb: "item", itemId: 10, reason: notBuilt })), { x: 7, y: 100, align: "right" });
  assert.deepEqual(placed(over({ slot: "optionA", verb: "jumpleft" })), { x: 7, y: 100, align: "right" });
});

test("THE SAME ON A REAL RING: red-1's opening ring near the stage's left edge — his walk's label goes over it, across the greyed jump, exactly where it went with the jump hidden, not off the stage", () => {
  // 1v1 seed 7, red-1's opening (long warrior, facing right), the eight drawn round (80, 200) at unit 1 from the
  // relayed table. optionB (walk left) at (80 - 64.2, 200 - 8.1) = (15.8, 191.9), r 18 * 0.8 = 14.4; its label
  // 9 px, gap 3 (`ringLabelSizeFor`), taken 30 wide. Outer side: ends at 15.8 - 14.4 - 3 = -1.6, off the stage.
  // Under it, centred at y 191.9 + 14.4 + 3 + 4.5 = 213.8 (box y 209.3..218.3, x 0.8..30.8), it crosses the taunt
  // in optionC at (15.8, 223.4), 5.1 away. Over it, at y 191.9 - 14.4 - 3 - 4.5 = 170 (box y 165.5..174.5), it
  // crosses the greyed jump in optionA at (80 - 53.5, 200 - 38) = (26.5, 162), 3.5 away — and nothing else.
  const host = demoHost({ perSide: 1, seed: 7 });
  const at = { centerX: 80, centerY: 200, unit: 1 };
  const stage = { x: 0, y: 0, width: 640, height: 420 };
  const shown = ringButtonsAt(modelOf(host), at);
  const before = ringButtonsAt(modelOf(host, null, hideJumpAndCharge), at);
  const lines = (buttons) => buttons.map((button) => `${button.slot} ${button.verb} ${button.reason?.code ?? "acts"}`);
  assert.deepEqual(lines(before), ["optionB walkleft acts", "optionC taunt acts", "optionG wincrowd acts", "optionE walkright acts"]);
  assert.deepEqual(lines(shown), [
    "optionA jumpleft not-built", "optionB walkleft acts", "optionC taunt acts", "optionG wincrowd acts",
    "optionD jumpright not-built", "optionE walkright acts", "optionF chargeright not-built"
  ]);
  const walk = shown.find((button) => button.slot === "optionB");
  const jump = shown.find((button) => button.slot === "optionA");
  const round = (value) => Math.round(value * 100) / 100;
  assert.deepEqual([walk.x, walk.y, walk.r, jump.x, jump.y].map(round), [15.8, 191.9, 14.4, 26.5, 162]);
  const { px, gap } = ringLabelSizeFor(walk.r);
  const size = { width: 30, height: px, gap };
  const label = ringLabelAt(walk, shown, size, { stage });
  assert.deepEqual([label.align, round(label.x), round(label.y)], ["center", 15.8, 170]);
  assert.deepEqual({ ...label }, { ...ringLabelAt(before.find((button) => button.slot === "optionB"), before, size, { stage }) },
    "where it stood with the jump hidden");
});

/* ------------------------------------------------------------------ */
/* 3. Painted under every label                                        */
/* ------------------------------------------------------------------ */

test("THE PAINT ORDER: the greyed jumps and charge first, then every other button in its own order — so a label that crosses one is drawn over it, and nothing else is painted in a new order", () => {
  // The same ring as above. `paintRing` paints each button and then its label, in this order: optionF's charge,
  // painted after optionE's walk, would have covered the walk's label where it crosses it.
  const host = demoHost({ perSide: 1, seed: 7 });
  const at = { centerX: 80, centerY: 200, unit: 1 };
  const drawn = ringButtonArt(ringButtonsAt(modelOf(host), at), { pack: null, facing: "right" });
  const before = ringButtonArt(ringButtonsAt(modelOf(host, null, hideJumpAndCharge), at), { pack: null, facing: "right" });
  const painted = ringPaintOrder(drawn);
  assert.deepEqual(drawn.map((button) => button.slot), ["optionA", "optionB", "optionC", "optionG", "optionD", "optionE", "optionF"]);
  assert.deepEqual(painted.map((button) => button.slot), ["optionA", "optionD", "optionF", "optionB", "optionC", "optionG", "optionE"]);
  assert.deepEqual(painted.filter((button) => !JUMP_OR_CHARGE.test(button.verb)).map((button) => ({ ...button })),
    before.map((button) => ({ ...button })), "every other button as it was drawn with them hidden, in the same order");
  assert.ok(painted.every((button, index) => button === drawn.find((one) => one.slot === painted[index].slot)), "the same buttons, only reordered");
  // With none to put first, the order is the buttons' own.
  assert.deepEqual(ringPaintOrder(before).map((button) => button.slot), before.map((button) => button.slot));
  assert.deepEqual(ringPaintOrder(null), []);
});

/**
 * `tools/arena/main.js` cannot be imported by node, so — as the other ring tests do — `paintRing` is pinned as
 * text, comments and strings blanked first.
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

test("THE SHELL paints the ring in `ringPaintOrder` — each button, then its label, as before — and places every label against every drawn button, so a greyed jump or charge lies under the labels", () => {
  const paint = functionBody("paintRing");
  assert.match(paint, /for \(const button of ringPaintOrder\(drawn\)\) \{\s*paintRingButton\(button\);\s*if \(button\.move\) continue;\s*if \(button\.reason\) continue;/);
  assert.equal((paint.match(/paintRingButton\(/g) ?? []).length, 1, "one place paints the buttons");
  assert.match(paint, /const at = ringLabelAt\(button, drawn, size, \{ stage, taken: labelled \}\);/, "every label still sees every button");
});

test("THE PROVENANCE PANEL says what a dimmed button is now: one the team rules forbid, or one the engine has not built — the jumps and charges", () => {
  const raw = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
  // Its string pieces joined, as the page joins them.
  const provenance = raw.slice(raw.indexOf("function ringProvenance("), raw.indexOf("function renderProvenance("))
    .replace(/"\s*\+\s*"/g, "");
  // ~~"A dimmed button is one the team rules forbid this turn: the engine's reason, …"~~ — true of every dimmed
  // button but the `?items=10` item until 2026-09-28, when decision 9 dimmed the jumps and the charges on nearly
  // every turn, which no team rule forbids.
  assert.ok(provenance.includes("A dimmed button is one the team rules forbid this turn, or one the engine has not built yet — " +
    "the jumps and charges the build wires, and an item it has no spell or potion for: the engine's reason, in its own words, shows when you "),
  provenance.slice(provenance.indexOf("A dimmed"), provenance.indexOf("A dimmed") + 260));
});

/* ------------------------------------------------------------------ */
/* 4. The build's own icon, dimmed                                     */
/* ------------------------------------------------------------------ */

/** An icons pack whose ring button (860) draws a different colour at each frame, over an 826 background. */
function framedPack() {
  const square = (fill) => ({ bounds: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 }, paths: [{ d: "M-10 -10L10 -10L10 10L-10 10Z", fill, fillRule: "nonzero" }] });
  const place = (kind, character, extra = {}) => ({ kind, character, depth: 1, matrix: [1, 0, 0, 1, 0, 0], ...extra });
  const background = place("clip", 826, { name: "battlebutton", frameCount: 2 });
  // Frame N (1-based) shows shape 3000 + N, filled red 6N: #RR0000 with RR = 6N in hex.
  const frames = Array.from({ length: 41 }, (unused, index) => (index === 0 ? [background] : [background, place("shape", 3001 + index)]));
  const shapes = { 824: square("#403020"), 825: square("#f0c040") };
  for (let frame = 2; frame <= 41; frame += 1) shapes[3000 + frame] = square(`#${(6 * frame).toString(16).padStart(2, "0")}0000`);
  return {
    shapes,
    texts: {},
    buttons: {
      button: 860,
      clips: { 860: { character: 860, frames, duplicateOf: {} } },
      nested: { 826: { character: 826, instances: ["battlebutton"], frames: [[place("shape", 824)], [place("shape", 825)]] } }
    }
  };
}

test("THE BUILD'S OWN ICON, DIMMED: each greyed jump and charge draws its own frame of the build's button — 7 jump left, 8 jump right, 12 charge right, 17 charge left — through the build's greyscale at 0.55, and never takes the rollover", () => {
  // Frames from `SS2_BUTTON_WIRING` (the action dump's `gotoAndStop`s): optionA 7, optionD 8, optionF 12 facing
  // right, optionC 17 facing left. In this pack frame N is red 6N, and Flash's greyscale takes red at 0.3086,
  // rounded (as test/arena-ring-reasons.test.js works #cc0000 to #3f3f3f): 7 -> 42 -> 12.96 -> #0d0d0d;
  // 8 -> 48 -> 14.81 -> #0f0f0f; 12 -> 72 -> 22.22 -> #161616; 17 -> 102 -> 31.48 -> #1f1f1f.
  const host = demoHost({ perSide: 1, seed: 7 });
  const pack = actionButtonPackFrom(framedPack());
  const at = { centerX: 320, centerY: 210, unit: 1.2 };
  const iconOf = (model, facing, slot) => {
    const buttons = ringButtonsAt(model, at);
    const [art] = ringButtonArt(buttons.filter((button) => button.slot === slot), { pack, facing, hoverSlot: slot });
    const fills = art.ops.filter((op) => op.kind === "path").map((op) => op.fill);
    return { state: art.state, source: art.source, icon: fills.at(-1), alpha: art.ops.every((op) => Math.abs(op.fillOpacity - 0.55) < 1e-9) };
  };
  const right = modelOf(host);
  assert.deepEqual(iconOf(right, "right", "optionA"), { state: "disabled", source: "build", icon: "#0d0d0d", alpha: true });
  assert.deepEqual(iconOf(right, "right", "optionD"), { state: "disabled", source: "build", icon: "#0f0f0f", alpha: true });
  assert.deepEqual(iconOf(right, "right", "optionF"), { state: "disabled", source: "build", icon: "#161616", alpha: true });
  const left = modelOf(played(host, 1));
  assert.deepEqual(iconOf(left, "left", "optionC"), { state: "disabled", source: "build", icon: "#1f1f1f", alpha: true });
  // An acting walk beside them keeps its colour: frame 6, red 36, #240000.
  const [walk] = ringButtonArt(ringButtonsAt(right, at).filter((button) => button.slot === "optionB"), { pack, facing: "right" });
  assert.equal(walk.ops.filter((op) => op.kind === "path").at(-1).fill, "#240000");
});

/* ------------------------------------------------------------------ */
/* 5. ACCEPTANCE: whole bouts, every stance and facing that wires them */
/* ------------------------------------------------------------------ */

/** Every (controller frame, facing, slot, verb) the build wires a jump or a charge to — from the build's table. */
const WIRED = new Set(Object.entries(SS2_BUTTON_WIRING).flatMap(([frame, record]) => ["right", "left"].flatMap((facing) =>
  Object.entries(record[facing]).flatMap(([slot, wires]) => wires.filter((one) => JUMP_OR_CHARGE.test(one.verb)).map((one) => `${frame} ${facing} ${slot} ${one.verb}`)))));

/** Everything drawn for a model, as `paintRing` gathers it, on a 640 x 420 stage round (320, 210) at unit 1.2. */
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
/** The key labels as `paintRing` places them, in paint order, at a stated width (node has no canvas to measure). */
function labelsOf(buttons) {
  const stage = { x: 0, y: 0, width: 640, height: 420 };
  const labelled = [];
  const out = {};
  for (const button of ringPaintOrder(buttons)) {
    if (button.move || button.reason) continue;
    const { px, gap } = ringLabelSizeFor(button.r);
    const size = { width: button.verb === "item" ? px * 0.6 : px * 0.55 * 7, height: px, gap };
    const at = ringLabelAt(button, buttons, size, { stage, taken: labelled });
    labelled.push(ringLabelBoxOf(at, size));
    out[button.slot] = { ...at };
  }
  return out;
}
/** A model with its jumps and charges emptied, as the ring was before decision 9. */
const blanked = (model) => ({
  ...model,
  slots: model.slots.map((slot) => (JUMP_OR_CHARGE.test(slot.verb ?? "") && !slot.action ? { ...slot, verb: null, reason: null, withheld: null } : slot))
});
const plain = (value) => JSON.parse(JSON.stringify(value));

test("ACCEPTANCE, over whole bouts with every foe selected in turn — every stance and facing the build wires a jump or charge on: each is greyed `not-built` in its slot, drawn once, dimmed, says \"… — not now: Not built yet.\" under the pointer, sends nothing by a click or its key, and is listed once; every other entry of the ring, every other button and every key label is exactly as it was with them hidden; and the bout's actions and state hashes are those of the same bout never read", (t) => {
  const reached = {};
  const tally = { bouts: 0, selections: 0, shown: 0, hiddenByForcedPhase: 0 };
  for (const perSide of [1, 2, 3]) {
    for (const kit of ["", "tricks", "buffs", "10"]) {
      for (const seed of [1, 2]) {
        const host = demoHost({ perSide, seed, kit });
        const sequence = [host.hash()];
        for (let taken = 0; !host.battle.result; taken += 1) {
          assert.ok(taken < 1500, "finished");
          const actorId = host.currentCombatantId();
          const nameOf = (id) => host.combatant(id)?.name ?? id;
          const start = host.hash();
          for (const foeId of modelOf(host).foeIds) {
            const model = modelOf(host, foeId);
            const before = modelOf(host, foeId, hideJumpAndCharge);
            const where = `${perSide}v${perSide} ${kit || "plain"} seed ${seed} turn ${taken}: ${actorId} vs ${foeId}`;
            // THE MODEL: only the jumps and charges differ.
            assert.deepEqual(plain(blanked(model)), plain(before), `${where}: the rest of the model`);
            const buttons = drawnButtons(model);
            const old = drawnButtons(before);
            const greyed = ringEntries(model, { greyed: true }).filter((entry) => entry.reason);
            for (const slot of model.slots.filter((candidate) => JUMP_OR_CHARGE.test(candidate.verb ?? ""))) {
              const said = `${where}: ${slot.slot} ${slot.verb}`;
              reached[`${model.stance.frame} ${model.stance.facing} ${slot.slot} ${slot.verb}`] = true;
              // Where the build's own controller frame wires it (the action dump's table, not the engine's copy).
              assert.ok(SS2_BUTTON_WIRING[model.stance.frame][model.stance.facing][slot.slot].some((one) => one.verb === slot.verb), `${said}: wired there`);
              assert.equal(slot.action, null, `${said}: acts`);
              assert.deepEqual(slot.reason, { code: "not-built", words: "Not built yet." }, said);
              assert.deepEqual(slot.withheld, { type: null, targetId: null, actorId }, said);
              const at = buttons.filter((button) => button.slot === slot.slot);
              assert.equal(at.length, 1, `${said}: drawn ${at.length} times`);
              assert.equal(at[0].verb, slot.verb);
              assert.equal(ringUnderLabels(at[0]), true, `${said}: under the labels`);
              const [art] = ringButtonArt(at, { pack: null, hoverSlot: slot.slot });
              assert.equal(art.state, "disabled", `${said}: dimmed, even under the pointer`);
              const hit = ringSlotAt(buttons, at[0].x, at[0].y);
              assert.equal(hit, slot.slot, `${said}: the pointer on it is on it`);
              assert.equal(ringShownText(ringShownFor(model, hit), () => "a preview", { nameOf }),
                `${RING_VERB_LABELS[slot.verb].long} — not now: Not built yet.`, said);
              for (const confirm of [false, true]) {
                for (const command of [ringClickCommand(model, hit, { confirm }), ringKeyCommand(model, { key: slot.key, focus: "stage", confirm })]) {
                  assert.deepEqual([command?.kind, command?.why, command?.entry?.slot, command?.entry?.reason?.code],
                    ["ignore", "greyed", slot.slot, "not-built"], `${said}: pressed, confirm ${confirm}`);
                }
              }
              assert.equal(ringActionFor(model, hit), null, `${said}: sends`);
              assert.equal(ringActionFor(model, slot.key), null, `${said}: its key sends`);
              assert.equal(greyed.filter((entry) => entry.slot === slot.slot).length, 1, `${said}: listed once`);
              tally.shown += 1;
            }
            // A jump or charge under a forced phase is hidden with every slot, and not drawn.
            for (const entry of host.unavailableActions(actorId, foeId).ring) {
              if (!JUMP_OR_CHARGE.test(entry.verb ?? "") || entry.display !== "hide") continue;
              assert.equal(buttons.filter((button) => button.slot === entry.slot).length, 0, `${where}: ${entry.slot} hidden (${entry.reason}) is drawn`);
              tally.hiddenByForcedPhase += 1;
            }
            // EVERYTHING ELSE: each other button as it was, in its order; the strip's entries; every key label.
            assert.deepEqual(plain(buttons.filter((button) => !JUMP_OR_CHARGE.test(button.verb))), plain(old), `${where}: the other buttons`);
            assert.deepEqual(plain(ringEntries(model)), plain(ringEntries(before)), `${where}: what acts`);
            assert.deepEqual(plain(greyed.filter((entry) => !JUMP_OR_CHARGE.test(entry.verb ?? ""))),
              plain(ringEntries(before, { greyed: true }).filter((entry) => entry.reason)), `${where}: the other greyed entries`);
            assert.deepEqual(labelsOf(buttons), labelsOf(old), `${where}: the key labels`);
            tally.selections += 1;
          }
          // PRESENTATION ONLY: reading every ring and pressing every greyed jump and charge moved nothing.
          assert.equal(host.hash(), start, `${perSide}v${perSide} ${kit || "plain"} seed ${seed} turn ${taken}: the state moved`);
          const action = { ...host.suggestAction(actorId), actorId };
          host.submit(action);
          sequence.push(`${action.actorId} ${action.type} ${action.targetId ?? "-"} ${host.hash()}`);
        }
        // The same bout, never read: the same actions, the same hashes.
        const bare = demoHost({ perSide, seed, kit });
        const replay = [bare.hash()];
        while (!bare.battle.result) {
          const action = { ...bare.suggestAction(bare.currentCombatantId()), actorId: bare.currentCombatantId() };
          bare.submit(action);
          replay.push(`${action.actorId} ${action.type} ${action.targetId ?? "-"} ${bare.hash()}`);
        }
        assert.deepEqual(sequence, replay, `${perSide}v${perSide} ${kit || "plain"} seed ${seed}: the engine's sequence`);
        tally.bouts += 1;
      }
    }
  }
  // Every stance and facing the build wires a jump or a charge on was reached — the build's 14.
  assert.equal(WIRED.size, 14);
  assert.deepEqual(Object.keys(reached).sort(), [...WIRED].sort());
  assert.ok(tally.hiddenByForcedPhase > 0, JSON.stringify(tally));
  assert.equal(tally.bouts, 24);
  t.diagnostic(JSON.stringify(tally));
});

test("a greyed jump or charge never shifts the rest of the ring on the stage (the fitted view, a write-nothing verifier's finding)", () => {
  // 2026-09-28: `ringButtonsInside` took its shift from EVERY button, the greyed
  // jumps included, so in the fitted view (no extracted arena) a back-ranker's
  // optionA/optionD, sticking out above the stage, pushed every acting button
  // down ~10 px in 730 of 23,652 rings: a click where "walk left" stood hit
  // nothing. The greyed jumps now move with whatever shift the rest needs and
  // never cause one; they may stand partly off the stage, inert.
  const stage = { x: 0, y: 0, width: 640, height: 420 };
  const acting = [
    { slot: "optionB", verb: "walkleft", x: 34.86, y: 42.71, r: 14, action: { type: "walk-left" } },
    { slot: "optionE", verb: "walkright", x: 191.22, y: 42.71, r: 14, action: { type: "walk-right" } }
  ];
  const greyed = { slot: "optionA", verb: "jumpleft", x: 60, y: 3.55, r: 14, action: null, reason: { code: "not-built", words: "Not built yet." } };
  const placed = ringButtonsInside([...acting, greyed], stage);
  assert.deepEqual(placed.filter((b) => b.action).map((b) => [b.slot, b.x, b.y]), acting.map((b) => [b.slot, b.x, b.y]),
    "the acting buttons stand exactly where they would without the greyed jump");
  assert.equal(placed.find((b) => b.slot === "optionA").y, greyed.y, "and the greyed jump is not moved either");
  // When the acting buttons themselves need a shift, the greyed jump moves with them.
  const low = acting.map((b) => ({ ...b, y: 5 }));
  const moved = ringButtonsInside([...low, greyed], stage);
  const shift = moved.find((b) => b.slot === "optionB").y - 5;
  assert.ok(shift > 0, "the acting buttons are brought onto the stage");
  assert.equal(moved.find((b) => b.slot === "optionA").y, greyed.y + shift, "the greyed jump moves by the same amount");
});
