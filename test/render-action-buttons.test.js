/**
 * THE ACTION BUTTONS: what each one means, where the ring sits, and the draw
 * operations for one button — from the player's pack, or authored.
 *
 * ► **THE TABLE UNDER TEST WAS TRANSCRIBED, SO THE TESTS THAT MATTER COMPARE
 *   IT WITH SOMETHING ELSE.** `SS2_BUTTON_WIRING` was read off the action
 *   dump; `deriveOptionWiring` in `tools/extract-icons.mjs` reads the same
 *   facts off the build itself on every extraction and writes them into the
 *   pack. Section 6 compares the two once a pack carries `buttons` — and until
 *   then SKIPS BY NAME, because a fresh clone and a pack extracted before
 *   2026-09-24 both lack it. Sections 1–5 pin the transcription's shape and the
 *   painter's behaviour on SYNTHETIC packs, which a clone with no licensed copy
 *   still runs.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ACTION_BUTTON_STATES,
  ActionButtonError,
  FALLBACK_BUTTON_RADIUS,
  SS2_ACTION_BUTTON,
  SS2_AUTHORED_ONLY_VERBS,
  SS2_BUTTON_ART,
  SS2_BUTTON_STRAYS,
  SS2_BUTTON_WIRING,
  SS2_GREYSCALE_MATRIX,
  SS2_OPTION_SLOTS,
  SS2_OVERLAY_SLOTS,
  SS2_SELECTED_BUTTON_FRAMES,
  SS2_STRIP,
  actionButtonArtFor,
  actionButtonFallbackOpsFor,
  actionButtonInvoiceFor,
  actionButtonOps,
  actionButtonOpsFor,
  actionButtonPackFrom,
  actionButtonVerbFor,
  hasActionButtonArt,
  overlaySlotPosition,
  psycheButtonFrame,
  ss2FlipOverlayFor,
  ss2OverlayPlacement,
  unselectedButtonFrames
} from "../src/render/action-buttons.js";
import { applyColourMatrix } from "../src/render/filters.js";
import { Ss2ActionType } from "../src/team/ss2-rules.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/* ------------------------------------------------------------------ */
/* 1. The wiring table and what is derived from it                     */
/* ------------------------------------------------------------------ */

const OFFSET = /^\+0x[0-9a-f]{4}$/;

test("every controller wires all eight slots in both facings, and every frame carries its own offset", () => {
  assert.deepEqual(Object.keys(SS2_BUTTON_WIRING),
    ["longrange_warrior", "closerange_warrior", "longrange_archer", "closerange_archer"]);
  assert.deepEqual(Object.values(SS2_BUTTON_WIRING).map((record) => record.frame), [5, 13, 20, 28]);
  let gotos = 0;
  let handlers = 0;
  for (const [label, record] of Object.entries(SS2_BUTTON_WIRING)) {
    assert.match(record.facingTest, OFFSET);
    assert.match(record.leftFrom, OFFSET);
    for (const facing of ["right", "left"]) {
      assert.deepEqual(Object.keys(record[facing]).sort(), SS2_OPTION_SLOTS, `${label} ${facing}`);
      for (const [slot, wires] of Object.entries(record[facing])) {
        assert.ok(wires.length >= 1, `${label} ${facing} ${slot}`);
        for (const wire of wires) {
          assert.equal(wire.frames.length, wire.gotoAt.length, `${label} ${facing} ${slot} ${wire.verb}`);
          for (const at of [...wire.gotoAt, wire.releaseAt]) assert.match(at, OFFSET);
          // Inside the arm the facing test puts it in.
          const inLeft = (at) => parseInt(at.slice(3), 16) >= parseInt(record.leftFrom.slice(3), 16);
          assert.equal(inLeft(wire.releaseAt), facing === "left", `${label} ${facing} ${slot} handler`);
          for (const at of wire.gotoAt) assert.equal(inLeft(at), facing === "left", `${label} ${facing} ${slot} ${at}`);
          gotos += wire.frames.length;
          handlers += 1;
        }
      }
    }
  }
  // 84 gotoAndStops in the four blocks, one of which is the stray.
  assert.equal(gotos + SS2_BUTTON_STRAYS.length, 84);
  assert.equal(handlers, 68);
});

test("THE VERBS PER SLOT ARE THE BATTLE MAP'S TABLE, slot for slot and facing for facing", () => {
  // docs/integration/ss2-battle-map.md, "Buttons wired per controller frame" —
  // a table written BEFORE this module, by a different reading of the bytes.
  const map = {
    longrange_warrior: {
      right: ["jumpleft", "walkleft", "taunt/rest", "jumpright", "walkright", "chargeright", "wincrowd", "psyche_up"],
      left: ["jumpleft", "walkleft", "chargeleft", "jumpright", "walkright", "taunt/rest", "psyche_up", "wincrowd"]
    },
    closerange_warrior: {
      right: ["jumpleft", "walkleft", "shove", "power_attack", "normal_attack", "quick_attack", "wincrowd", "psyche_up"],
      left: ["power_attack", "normal_attack", "quick_attack", "jumpright", "walkright", "shove", "psyche_up", "wincrowd"]
    },
    longrange_archer: {
      right: ["jumpleft", "walkleft", "taunt/rest", "bombardright", "walkright", "sniperight", "wincrowd", "psyche_up"],
      left: ["bombardleft", "walkleft", "snipeleft", "jumpright", "walkright", "taunt/rest", "psyche_up", "wincrowd"]
    },
    closerange_archer: {
      right: ["jumpleft", "walkleft", "shove", "jumpright", "bash_attack", "taunt", "wincrowd", "psyche_up"],
      left: ["jumpleft", "bash_attack", "taunt", "jumpright", "walkright", "shove", "psyche_up", "wincrowd"]
    }
  };
  for (const [label, facings] of Object.entries(map)) {
    for (const [facing, verbs] of Object.entries(facings)) {
      const ours = SS2_OPTION_SLOTS.map((slot) => SS2_BUTTON_WIRING[label][facing][slot].map((wire) => wire.verb).join("/"));
      assert.deepEqual(ours, verbs, `${label} facing ${facing}`);
    }
  }
});

test("THE ICON TABLE: one frame per verb per facing, and the frames a verb takes when the hero turns", () => {
  const frames = (verb, facing) => Object.keys(SS2_BUTTON_ART[verb][facing]).map(Number);
  const expected = {
    power_attack: [[2], [13]], normal_attack: [[3], [14]], quick_attack: [[4], [15]],
    shove: [[16], [10]], bash_attack: [[24], [21]], taunt: [[18], [19]], wincrowd: [[29], [30]],
    walkleft: [[6], [6]], walkright: [[9], [9]], jumpleft: [[7], [7]], jumpright: [[8], [8]], rest: [[11], [11]],
    chargeright: [[12], []], chargeleft: [[], [17]],
    bombardright: [[25], []], bombardleft: [[], [22]], sniperight: [[23], []], snipeleft: [[], [20]],
    psyche_up: [[26, 27, 28], [26, 27, 28]]
  };
  assert.deepEqual(Object.keys(SS2_BUTTON_ART).sort(), Object.keys(expected).sort());
  for (const [verb, [right, left]] of Object.entries(expected)) {
    assert.deepEqual(frames(verb, "right"), right, `${verb} facing right`);
    assert.deepEqual(frames(verb, "left"), left, `${verb} facing left`);
  }
  // Every frame names every site that selects it.
  assert.deepEqual(SS2_BUTTON_ART.power_attack.right[2], [{ controller: "closerange_warrior", slot: "optionD", at: "+0x0822" }]);
  assert.equal(SS2_BUTTON_ART.wincrowd.left[30].length, 4, "one per controller");
  assert.deepEqual(SS2_SELECTED_BUTTON_FRAMES, [2, 3, 4, ...Array.from({ length: 25 }, (unused, index) => index + 6)]);
  assert.deepEqual(unselectedButtonFrames(41), [1, 5, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41]);
  assert.equal(SS2_ACTION_BUTTON.declaredFramesReported, 41);
});

test("the typo is kept: frame 28 goes to `optionHG`, so that psyche button has only two frames", () => {
  assert.deepEqual(SS2_BUTTON_STRAYS.map((stray) => [stray.controller, stray.facing, stray.target, stray.frame, stray.at]),
    [["closerange_warrior", "right", "optionHG", 28, "+0x0923"]]);
  assert.deepEqual(SS2_BUTTON_WIRING.closerange_warrior.right.optionH[0].frames, [26, 27]);
  assert.deepEqual(SS2_BUTTON_WIRING.closerange_warrior.left.optionG[0].frames, [26, 27, 28]);
});

test("the guards the pairing cannot see are on the rows: stamina for taunt/rest, ammo for the shots, level for the hides", () => {
  const warrior = SS2_BUTTON_WIRING.longrange_warrior;
  assert.deepEqual(warrior.right.optionC.map((wire) => [wire.verb, wire.when.test]), [["taunt", "+0x0c3d"], ["rest", "+0x0c3d"]]);
  assert.match(warrior.right.optionC[0].when.rule, />= 50/);
  assert.match(warrior.right.optionC[1].when.rule, /< 50/);
  assert.equal(SS2_BUTTON_WIRING.closerange_archer.right.optionF[0].when, undefined, "no stamina test on the close archer");
  const archer = SS2_BUTTON_WIRING.longrange_archer;
  for (const wire of [archer.right.optionD[0], archer.right.optionF[0], archer.left.optionA[0], archer.left.optionC[0]]) {
    assert.match(wire.when.rule, /ammo_left > 0/);
  }
  // `visible` is kept apart from `_visible`: the defect that hides nothing.
  assert.deepEqual(archer.hides.right.filter((row) => row.property === "visible").map((row) => row.slot), ["optionD", "optionF"]);
  assert.deepEqual(archer.hides.left.filter((row) => row.property === "visible").map((row) => row.slot), ["optionA", "optionC"]);
  // Psyche is hidden at EVERY level on an archer, below 7 on a warrior.
  assert.equal(archer.hides.right.find((row) => row.slot === "optionH").rule, "always");
  assert.equal(warrior.hides.right.find((row) => row.slot === "optionH").rule, "herolevel < 7");
});

test("the psyche frame follows the build's three tests, and a counter none of them matches keeps the last frame", () => {
  assert.equal(psycheButtonFrame(1), 26, "the floor: a fresh gladiator");
  assert.equal(psycheButtonFrame(0), 26);
  assert.equal(psycheButtonFrame(undefined), 26);
  assert.equal(psycheButtonFrame(2), 27);
  assert.equal(psycheButtonFrame(3), 28);
  assert.equal(psycheButtonFrame(4), 28, "!(c < 3)");
  assert.equal(psycheButtonFrame(2.5), null);
});

/* ------------------------------------------------------------------ */
/* 2. Verbs, art, and the engine's own action types                    */
/* ------------------------------------------------------------------ */

test("every engine CHOICE maps to a verb with art, to `item` or to an authored verb; only the forced phases map to nothing", () => {
  const withArt = new Set([...Object.keys(SS2_BUTTON_ART), "swap_weapons", "item"]);
  const unmapped = [];
  for (const type of Object.values(Ss2ActionType)) {
    const verb = actionButtonVerbFor(type, { facing: "right" });
    if (verb === null) { unmapped.push(type); continue; }
    assert.ok(withArt.has(verb) || SS2_AUTHORED_ONLY_VERBS.includes(verb), `${type} -> ${verb}`);
  }
  // Every CHOICE has some look: the build's, the strip's by item id, or the
  // authored one. What is left are the five forced phases the engine runs on a
  // fighter's turn without asking — a taunted run and four status ticks —
  // which no button offers. A verb added to the engine without a button, or a
  // new forced phase, fails here by name.
  assert.deepEqual(unmapped.sort(), ["burning-phase", "frozen-phase", "life-stolen-phase", "poisoned-phase", "taunted-phase"],
    `unmapped: ${unmapped.join(", ")}`);
  assert.equal(actionButtonVerbFor(Ss2ActionType.BOMBARD, { facing: "left" }), "bombardleft");
  assert.equal(actionButtonVerbFor(Ss2ActionType.SNIPE, { facing: "right" }), "sniperight");
  assert.equal(actionButtonVerbFor(Ss2ActionType.WALK_LEFT, { facing: "right" }), "walkleft",
    "a walk is absolute, whatever the facing");
  assert.equal(actionButtonVerbFor(Ss2ActionType.RANK_BACK), "rank_back");
  assert.equal(actionButtonVerbFor(Ss2ActionType.DRINK_POTION), "item");
  assert.equal(actionButtonVerbFor(Ss2ActionType.CAST_LIGHTNING_BOLT), "item");
  assert.equal(actionButtonVerbFor("no-such-action"), null);
});

test("the art for a verb: its facing's own frame, else the other facing's with `extrapolated`, and the strip for swap and items", () => {
  assert.deepEqual(actionButtonArtFor("power_attack", { facing: "left" }), { clip: "button", frame: 13, wired: true, extrapolated: false });
  assert.deepEqual(actionButtonArtFor("chargeright", { facing: "left" }), { clip: "button", frame: 12, wired: false, extrapolated: true });
  assert.deepEqual(actionButtonArtFor("psyche_up", { psyche: 2 }), { clip: "button", frame: 27, wired: true, extrapolated: false });
  assert.deepEqual(actionButtonArtFor("swap_weapons", { usingBow: true }), { clip: "strip", frame: 10, wired: true, extrapolated: false });
  assert.deepEqual(actionButtonArtFor("swap_weapons"), { clip: "strip", frame: 11, wired: true, extrapolated: false });
  assert.deepEqual(actionButtonArtFor("item", { itemId: 34 }), { clip: "strip", frame: 34, wired: true, extrapolated: false });
  assert.equal(actionButtonArtFor("item", { itemId: 1 }), null, "frame 1 is the empty slot the build hides");
  assert.equal(actionButtonArtFor("item"), null);
  for (const verb of SS2_AUTHORED_ONLY_VERBS) assert.equal(actionButtonArtFor(verb), null);
  assert.equal(SS2_STRIP.character, 116);
});

/* ------------------------------------------------------------------ */
/* 3. Where the ring sits                                              */
/* ------------------------------------------------------------------ */

test("the overlay stands on the fighter, 180 above his feet, at a scale that cancels the camera", () => {
  assert.deepEqual(
    [15, 20, 30, 50, 60, 70, 80].map(ss2FlipOverlayFor),
    [600, 500, 320, 240, 220, 200, 160]);
  assert.equal(ss2FlipOverlayFor(40), null, "no arm matches: the variable keeps its last value");
  assert.equal(ss2FlipOverlayFor(Number.NaN), null);
  const near = ss2OverlayPlacement({ actorX: 300, actorY: 200, foeX: 900, maxscale: 80 });
  assert.deepEqual({ ...near }, { x: 300, y: 20, scalePercent: 160, closeUp: false, showsOwnHero: false });
  const kept = ss2OverlayPlacement({ actorX: 300, actorY: 200, foeX: 900, maxscale: 40, previousScale: 220 });
  assert.equal(kept.scalePercent, 220);
});

test("AT 1600 APART THE RING MOVES TO THE MIDPOINT, grows to 600 and shows its own copy of the hero", () => {
  const edge = ss2OverlayPlacement({ actorX: 0, actorY: 200, foeX: 1600, maxscale: 20 });
  assert.equal(edge.closeUp, true, "`gDistance < 1600` fails at exactly 1600");
  assert.equal(edge.x, 800);
  assert.equal(edge.scalePercent, 600, "closeUp overrides maxscale's 500");
  assert.equal(edge.showsOwnHero, true);
  const fromRight = ss2OverlayPlacement({ actorX: 2000, actorY: 200, foeX: -100, maxscale: 15 });
  assert.equal(fromRight.x, 950, "the midpoint from either side");
  const inside = ss2OverlayPlacement({ actorX: 0, actorY: 200, foeX: 1599, maxscale: 20 });
  assert.equal(inside.closeUp, false);
  assert.equal(inside.x, 0);
  assert.throws(() => ss2OverlayPlacement({ actorX: 0, actorY: Number.NaN, foeX: 1 }), ActionButtonError);
});

test("a slot's position comes from the pack's measured layout when it has one, and says which it used", () => {
  const relayed = overlaySlotPosition("optionB");
  assert.deepEqual({ ...relayed }, { x: -64.2, y: -8.1, scale: 0.8, source: "relayed" });
  const layout = { tracks: { optionB: [{ from: 4, to: 12, matrix: [0.8, 0, 0, 0.8, -1284, -162] }] } };
  assert.deepEqual({ ...overlaySlotPosition("optionB", { layout, frame: 12 }) }, { x: -64.2, y: -8.1, scale: 0.8, source: "pack" });
  assert.equal(overlaySlotPosition("optionB", { layout, frame: 2 }).source, "relayed", "no run covers frame 2");
  assert.equal(overlaySlotPosition("nowhere"), null);
  assert.equal(overlaySlotPosition("toString"), null, "an inherited name is not a slot");
  assert.deepEqual(Object.keys(SS2_OVERLAY_SLOTS), [...SS2_OPTION_SLOTS.slice(0, 3), "optionG", "optionD", "optionE", "optionF", "optionH", "swap_inventory"]);
});

/* ------------------------------------------------------------------ */
/* 4. Drawing, on a synthetic pack                                     */
/* ------------------------------------------------------------------ */

const square = (fill) => ({ bounds: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 }, paths: [{ d: "M0 0L10 0L10 10L0 10Z", fill, fillOpacity: 1 }] });
const placed = (kind, character, extra = {}) => ({ kind, character, matrix: [1, 0, 0, 1, 0, 0], ...extra });
const BACKGROUND = placed("clip", 826, { name: "battlebutton", frameCount: 2 });

/**
 * A pack shaped like `tools/extract-icons.mjs` writes it: 860 with its
 * background on every frame and an icon on the frames the table selects, the
 * bow frame 25 carrying an `ammo_left` field, 116 with its own background and
 * a greyed swap frame, and 12..29 blank the way the real strip's are.
 */
function syntheticPack({ withButtons = true } = {}) {
  const buttonFrames = Array.from({ length: 41 }, (unused, index) => {
    const frame = index + 1;
    if (frame === 1) return [BACKGROUND];
    const icon = placed("shape", 1000 + frame, frame === 3 ? { colour: [1, 1, 1, 0.5, 0, 0, 0, 0] } : {});
    const row = [BACKGROUND, icon];
    if (frame === 25) row.push(placed("text", 855, { name: "ammo_left", matrix: [1, 0, 0, 1, 200, 100] }));
    if (frame === 4) row.push(placed("text", 856));
    return row;
  });
  const shapes = { 900: square("#403020"), 901: square("#f0c040"), 56: square("#202020"), 57: square("#606060"), 1046: square("#ff0000") };
  for (let frame = 2; frame <= 41; frame += 1) shapes[1000 + frame] = square("#00cc00");
  shapes[1002] = square("#cc0000");
  const strip = Array.from({ length: 49 }, (unused, index) => {
    const frame = index + 1;
    const background = placed("clip", 58, { name: "battlebutton", frameCount: 2 });
    if (frame === 10) return [{ ...background, filters: [{ type: "colourMatrix", matrix: [...SS2_GREYSCALE_MATRIX] }] }, placed("shape", 1046)];
    if (frame === 1 || (frame >= 12 && frame <= 29)) return [background];
    return [background, placed("shape", 1046)];
  });
  const duplicateOf = Object.fromEntries(Array.from({ length: 18 }, (unused, index) => [index + 12, 1]));
  return {
    icons: { inventory_buttons: { character: 116, frames: strip, duplicateOf } },
    nested: { 58: { character: 58, instances: ["battlebutton"], frames: [[placed("shape", 56)], [placed("shape", 57)]] } },
    shapes,
    texts: { 855: { kind: "edit-text", bounds: { xMin: 0, xMax: 20, yMin: 0, yMax: 10 }, fontHeight: 11, colour: { red: 255, green: 255, blue: 0 } } },
    ...(withButtons ? {
      buttons: {
        button: 860,
        clips: { 860: { character: 860, frames: buttonFrames, duplicateOf: {} } },
        nested: { 826: { character: 826, instances: ["battlebutton"], frames: [[placed("shape", 900)], [placed("shape", 901)]] } }
      }
    } : {})
  };
}

const fillsOf = (ops) => ops.filter((op) => op.kind === "path").map((op) => op.fill);

test("a button is its background at the STATE's frame under the verb's icon at the FACING's frame", () => {
  const pack = actionButtonPackFrom(syntheticPack());
  assert.deepEqual(fillsOf(actionButtonOpsFor(pack, "power_attack", { facing: "right" })), ["#403020", "#cc0000"],
    "826 frame 1 (up), then 860 frame 2");
  assert.deepEqual(fillsOf(actionButtonOpsFor(pack, "power_attack", { facing: "right", state: "hover" })), ["#f0c040", "#cc0000"],
    "826 frame 2 (over) on hover — the overlay's onRollOver");
  const left = actionButtonOpsFor(pack, "power_attack", { facing: "left" });
  assert.equal(left.length, 2);
  assert.ok(left.every((op) => op.kind === "path" && Array.isArray(op.matrix) && op.matrix.length === 6));
  assert.equal(actionButtonInvoiceFor(pack, "power_attack", { facing: "left" }).frame, 13);
});

test("DISABLED IS AUTHORED: the build's own greyscale over the whole button, at reduced alpha", () => {
  const pack = actionButtonPackFrom(syntheticPack());
  const ops = actionButtonOpsFor(pack, "power_attack", { state: "disabled" });
  const grey = applyColourMatrix("#cc0000", SS2_GREYSCALE_MATRIX, 1).fill;
  assert.equal(ops[1].fill, grey, "the red icon folded through Flash's 0.3086/0.6094/0.082");
  assert.ok(ops.every((op) => op.fillOpacity < 1), "and faded");
  assert.ok(ops.every((op) => op.group && op.group === ops[0].group), "one group over the whole button");
  assert.notDeepEqual(fillsOf(ops), fillsOf(actionButtonOpsFor(pack, "power_attack")));
});

test("a placement's colour transform and a clip's own filter reach the ops", () => {
  const pack = actionButtonPackFrom(syntheticPack());
  const normal = actionButtonOpsFor(pack, "normal_attack", { facing: "right" });
  assert.equal(normal[1].fillOpacity, 0.5, "frame 3's icon carries an alpha multiplier of 0.5");
  // 116 frame 10: its background is greyed by its OWN filter — the swap
  // button's normal look — and the icon beside it is not.
  const swap = actionButtonOpsFor(pack, "swap_weapons", { usingBow: true });
  assert.equal(swap[0].fill, applyColourMatrix("#202020", SS2_GREYSCALE_MATRIX, 1).fill);
  assert.ok(swap[0].group, "the background's own filter is a group of what it holds");
  assert.equal(swap[1].group, undefined);
  assert.equal(swap[1].fill, "#ff0000");
});

test("THE BOW FRAMES CARRY THE AMMO COUNT, and a text that is not the ammo is counted, never guessed at", () => {
  const pack = actionButtonPackFrom(syntheticPack());
  const ops = actionButtonOpsFor(pack, "bombardright", { facing: "right", ammo: 7 });
  const text = ops.find((op) => op.kind === "text");
  assert.equal(text.text, "7");
  assert.equal(text.fill, "#ffff00", "the field's own colour");
  assert.equal(text.x, 20, "the box centre (10) plus the placement's 200 twips");
  assert.equal(text.y, 10);
  assert.equal(actionButtonInvoiceFor(pack, "bombardright", { ammo: 7 }).textsNotDrawn, 0);
  const dim = actionButtonOpsFor(pack, "bombardright", { ammo: 7, state: "disabled" }).find((op) => op.kind === "text");
  assert.equal(dim.fill, applyColourMatrix("#ffff00", SS2_GREYSCALE_MATRIX, 1).fill, "greyed like the shapes");
  assert.ok(Math.abs(dim.alpha - 0.55) < 0.01, `faded ONCE, not twice: ${dim.alpha}`);
  assert.equal(actionButtonOpsFor(pack, "bombardright").filter((op) => op.kind === "text").length, 0, "no ammo, no number");
  assert.equal(actionButtonInvoiceFor(pack, "bombardright").textsNotDrawn, 1);
  assert.equal(actionButtonInvoiceFor(pack, "quick_attack").textsNotDrawn, 1, "frame 4's other field");
});

test("a pack that cannot draw a verb returns NULL, and the caller draws the fallback — never a blank button", () => {
  const pack = actionButtonPackFrom(syntheticPack());
  assert.equal(actionButtonOpsFor(pack, "rank_back"), null, "team play's own verb: no build art");
  assert.equal(actionButtonOpsFor(pack, "item", { itemId: 20 }), null, "116 frames 12..29 are the empty slot's copies");
  assert.ok(actionButtonOpsFor(pack, "item", { itemId: 34 }));
  assert.equal(hasActionButtonArt(pack, "item", { itemId: 20 }), false);
  assert.equal(hasActionButtonArt(pack, "item", { itemId: 5 }), true);
  // A pack extracted before the buttons section: the strip still draws.
  const old = actionButtonPackFrom(syntheticPack({ withButtons: false }));
  assert.equal(old.button, null);
  assert.equal(actionButtonOpsFor(old, "power_attack"), null);
  assert.ok(actionButtonOpsFor(old, "swap_weapons"));
  assert.equal(actionButtonOps(old, "power_attack").source, "authored");
  assert.equal(actionButtonOps(old, "swap_weapons").source, "build");
  // A background the pack does not hold: drawn without it, and COUNTED.
  const raw = syntheticPack();
  delete raw.buttons.nested[826];
  const orphan = actionButtonPackFrom(raw);
  assert.deepEqual(fillsOf(actionButtonOpsFor(orphan, "power_attack")), ["#cc0000"]);
  assert.equal(actionButtonInvoiceFor(orphan, "power_attack").missingChildren, 1);
  for (const junk of [null, 7, {}, { shapes: {} }, { shapes: {}, buttons: { button: 860, clips: {} } }]) {
    assert.equal(actionButtonPackFrom(junk), null, JSON.stringify(junk));
  }
  assert.throws(() => actionButtonOpsFor(pack, "power_attack", { state: "pressed" }), ActionButtonError);
});

/* ------------------------------------------------------------------ */
/* 5. The authored fallback                                            */
/* ------------------------------------------------------------------ */

const EVERY_VERB = [...Object.keys(SS2_BUTTON_ART), "swap_weapons", "item", ...SS2_AUTHORED_ONLY_VERBS];

test("THE FALLBACK: a round button with a glyph for every verb, in every state, inside its own radius", () => {
  for (const verb of EVERY_VERB) {
    for (const state of ACTION_BUTTON_STATES) {
      const ops = actionButtonFallbackOpsFor(verb, { state, facing: "left", psyche: 3, itemId: 31 });
      const parts = ops.map((op) => op.button);
      assert.ok(parts.includes("disc") && parts.includes("glyph"), `${verb} ${state}: ${parts}`);
      assert.equal(parts.includes("halo"), state === "hover", `${verb} ${state}`);
      for (const op of ops) {
        assert.equal(op.kind, "path");
        assert.deepEqual(op.matrix, [1, 0, 0, 1, 0, 0]);
        assert.equal(op.authored, true);
        assert.match(op.d, /^M[-\d. MLQZ]*$/, "M/L/Q/Z only — the extracted shapes' own vocabulary");
        // The halo is the widest thing drawn, radius r + 3, and a quadratic
        // arc's CONTROL points sit at radius / cos(pi / 8) — off the curve.
        const numbers = op.d.match(/-?\d+(\.\d+)?/g).map(Number);
        const reach = (FALLBACK_BUTTON_RADIUS + 3) / Math.cos(Math.PI / 8) + 0.01;
        assert.ok(numbers.every((value) => Math.abs(value) <= reach), `${verb} ${op.button} stays on the button`);
      }
    }
  }
  assert.equal(actionButtonFallbackOpsFor("psyche_up", { psyche: 2 }).filter((op) => op.button === "pip").length, 2);
  assert.deepEqual(actionButtonFallbackOpsFor("no-such-verb").map((op) => op.button), ["disc"],
    "an unknown verb is still a button, never an invisible slot");
  assert.throws(() => actionButtonFallbackOpsFor("rest", { state: "pressed" }), ActionButtonError);
});

test("a glyph that points at the foe turns with the fighter; an absolute move does not", () => {
  const glyph = (verb, facing) => actionButtonFallbackOpsFor(verb, { facing }).find((op) => op.button === "glyph").d;
  assert.notEqual(glyph("power_attack", "left"), glyph("power_attack", "right"));
  assert.equal(glyph("walkleft", "left"), glyph("walkleft", "right"));
  assert.notEqual(glyph("walkleft", "right"), glyph("walkright", "right"), "and left is the mirror of right");
  assert.equal(glyph("bombardleft", "right"), glyph("bombardleft", "left"), "a handed verb keeps its own hand");
});

test("the fallback's radius fits the tightest slot pitch the relayed layout has", () => {
  const pitch = Math.abs(SS2_OVERLAY_SLOTS.optionC.y - SS2_OVERLAY_SLOTS.optionB.y) / SS2_OVERLAY_SLOTS.optionB.scale;
  assert.ok(2 * FALLBACK_BUTTON_RADIUS + 2 < pitch, `diameter plus rims ${2 * FALLBACK_BUTTON_RADIUS + 2} against ${pitch}`);
});

/* ------------------------------------------------------------------ */
/* 6. The player's own pack                                            */
/* ------------------------------------------------------------------ */

const ICONS_AT = path.join(REPO_ROOT, "assets", "icons", "icons.json");

function realIcons(t) {
  if (!fs.existsSync(ICONS_AT)) {
    t.skip("no extracted icons pack in this tree (a fresh clone): run node tools/extract-icons.mjs");
    return null;
  }
  return JSON.parse(fs.readFileSync(ICONS_AT, "utf8"));
}

test("THE REAL PACK, ANY VINTAGE: the strip draws the swap button and every item the build has art for", (t) => {
  const raw = realIcons(t);
  if (!raw) return;
  const pack = actionButtonPackFrom(raw);
  assert.ok(pack && pack.strip, "icons.inventory_buttons is in every pack since the icons extractor");
  for (const usingBow of [true, false]) {
    const ops = actionButtonOpsFor(pack, "swap_weapons", { usingBow });
    assert.ok(ops && ops.length > 0, `swap frame ${usingBow ? 10 : 11}`);
    assert.ok(ops.some((op) => op.group), "frames 10 and 11 grey their background with the build's own matrix");
  }
  const drawn = [];
  for (let itemId = 2; itemId <= pack.strip.frames.length; itemId += 1) {
    if (hasActionButtonArt(pack, "item", { itemId })) drawn.push(itemId);
  }
  assert.deepEqual(drawn, [...Array.from({ length: 10 }, (unused, index) => index + 2), ...Array.from({ length: 20 }, (unused, index) => index + 30)],
    "2..11 and 30..49 carry art; 12..29 are the empty slot's copies");
  for (const state of ACTION_BUTTON_STATES) {
    const ops = actionButtonOpsFor(pack, "item", { itemId: 34, state });
    assert.ok(ops.every((op) => typeof op.d === "string" && op.matrix.length === 6), state);
  }
  assert.notDeepEqual(fillsOf(actionButtonOpsFor(pack, "item", { itemId: 34, state: "hover" })),
    fillsOf(actionButtonOpsFor(pack, "item", { itemId: 34 })), "58's over frame differs from its up frame");
});

function buttonsPack(t) {
  const raw = realIcons(t);
  if (!raw) return null;
  if (!raw.buttons) {
    t.skip("this icons pack predates the buttons section (2026-09-24): re-run node tools/extract-icons.mjs");
    return null;
  }
  return raw;
}

test("THE REAL PACK'S WIRING IS THIS TABLE: every slot, frame, verb and offset, derived from the build", (t) => {
  const raw = buttonsPack(t);
  if (!raw) return;
  const strip = (wires) => wires.map(({ verb, frames, gotoAt, releaseAt }) => ({ verb, frames: [...frames], gotoAt: [...gotoAt], releaseAt }));
  for (const [label, ours] of Object.entries(SS2_BUTTON_WIRING)) {
    const theirs = raw.buttons.wiring[label];
    assert.ok(theirs && !theirs.problem, `${label}: ${theirs?.problem}`);
    assert.equal(theirs.frame, ours.frame);
    assert.deepEqual(theirs.facingSplit, { test: ours.facingTest, leftFrom: ours.leftFrom }, label);
    for (const facing of ["right", "left"]) {
      for (const slot of SS2_OPTION_SLOTS) {
        assert.deepEqual(theirs[facing].slots[slot], strip(ours[facing][slot]), `${label} ${facing} ${slot}`);
      }
      assert.deepEqual(theirs[facing].hides.map((row) => [row.slot, row.property, row.at]),
        ours.hides[facing].map((row) => [row.slot, row.property, row.at]), `${label} ${facing} hides`);
      assert.deepEqual(theirs[facing].unpaired, [], `${label} ${facing}`);
    }
    const strays = [...theirs.common.strays, ...theirs.right.strays, ...theirs.left.strays];
    assert.deepEqual(strays.map((stray) => [stray.target, stray.frame, stray.at]),
      SS2_BUTTON_STRAYS.filter((stray) => stray.controller === label).map((stray) => [stray.target, stray.frame, stray.at]));
  }
});

test("THE REAL PACK'S BUTTON: 860 at the slots, 826 up/over behind it, and art on every frame the table selects", (t) => {
  const raw = buttonsPack(t);
  if (!raw) return;
  assert.equal(raw.buttons.button, SS2_ACTION_BUTTON.character);
  const button = raw.buttons.clips[SS2_ACTION_BUTTON.character];
  assert.equal(button.declaredFrames, SS2_ACTION_BUTTON.declaredFramesReported, "the relayed frame count, measured");
  const background = raw.buttons.nested[SS2_ACTION_BUTTON.background.character];
  assert.ok(background, "826 is extracted into the buttons section");
  assert.deepEqual(background.instances, [SS2_ACTION_BUTTON.background.instance]);
  assert.equal(background.declaredFrames, 2);
  const pack = actionButtonPackFrom(raw);
  for (const [verb, art] of Object.entries(SS2_BUTTON_ART)) {
    for (const facing of ["right", "left"]) {
      for (const frame of Object.keys(art[facing]).map(Number)) {
        const psyche = verb === "psyche_up" ? frame - 25 : 1;
        assert.ok(hasActionButtonArt(pack, verb, { facing, psyche }), `${verb} facing ${facing}: 860 frame ${frame} has no icon`);
        const invoice = actionButtonInvoiceFor(pack, verb, { facing, psyche, ammo: 30 });
        assert.equal(invoice.missingChildren, 0, `${verb} ${facing}`);
      }
    }
  }
  // The four bow frames carry `ammo_left`; no other frame does.
  const withAmmo = button.frames
    .map((placements, index) => [index + 1, placements.some((placement) => placement.name === SS2_ACTION_BUTTON.ammoField)])
    .filter(([, has]) => has).map(([frame]) => frame);
  assert.deepEqual(withAmmo, [...SS2_ACTION_BUTTON.ammoFrames]);
  // The rollover, from the bytes.
  const handlers = raw.buttons.handlers.handlers;
  const over = handlers.find((row) => row.event === "onRollOver" && row.slots.includes("optionA"));
  const out = handlers.find((row) => row.event === "onRollOut" && row.slots.includes("optionA"));
  assert.deepEqual([over.battlebutton, out.battlebutton, over.slots.length], [2, 1, 8]);
  assert.deepEqual(raw.buttons.handlers.swap.gotos.map((row) => [row.frame, row.at]), [[10, "+0x0ec8"], [11, "+0x0ee4"]]);
  assert.equal(handlers.find((row) => row.event === "onRelease" && row.slots.includes("swap_inventory")).verb, "swap_weapons");
});

test("THE REAL PACK'S LAYOUT: each controller rests where the relayed table puts the slots", (t) => {
  const raw = buttonsPack(t);
  if (!raw) return;
  const layout = raw.buttons.layout;
  for (const label of Object.keys(SS2_BUTTON_WIRING)) {
    const rest = layout.controllers[label];
    assert.ok(Number.isInteger(rest.restsAt), `${label} rests on a stop()`);
    for (const slot of [...SS2_OPTION_SLOTS, "swap_inventory"]) {
      const measured = overlaySlotPosition(slot, { layout, frame: rest.restsAt });
      const relayed = SS2_OVERLAY_SLOTS[slot];
      assert.equal(measured.source, "pack", `${label} ${slot} is placed at frame ${rest.restsAt}`);
      assert.ok(Math.abs(measured.x - relayed.x) < 0.06 && Math.abs(measured.y - relayed.y) < 0.06,
        `${label} ${slot}: measured (${measured.x}, ${measured.y}) against relayed (${relayed.x}, ${relayed.y})`);
      assert.ok(Math.abs(measured.scale - relayed.scale) < 0.002, `${label} ${slot} scale ${measured.scale}`);
      assert.equal(rest.slots[slot].depth, relayed.depth);
    }
  }
});
