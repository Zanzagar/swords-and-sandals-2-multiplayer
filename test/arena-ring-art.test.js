/**
 * THE RING IN THE BUILD'S OWN ART, WHERE THE BUILD PUTS IT (slice S3 of
 * `docs/design/battle-ui.md`): the overlay's placement under the camera's
 * zoom, the slots at the pack's measured positions, and — through the drawing
 * API — the 860 frame every verb's slot draws, its hover background, and the
 * authored buttons a clone with no icons pack keeps.
 *
 * ► **THE EXPECTED NUMBERS ARE LITERALS, WORKED BY HAND.** The placement's
 *   from the camera's own projection (`arenaToStage`: the arena origin
 *   319.95 / 166.75, `gladiators` scaled by the zoom) and the build's
 *   `flipoverlay` table as the action dump reads it (sprite 2249 frame 1 body
 *   0x6e4221, `+0x109d`..`+0x1250`); the icon frames from the battle map's
 *   "The icon each slot shows" and the controller frames' `gotoAndStop`s. None
 *   is recomputed the way the code computes it.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { stageFitFor, stageProjectorFor } from "../src/render/arena-backdrop.js";
import { actionButtonPackFrom } from "../src/render/action-buttons.js";
import { textPackFrom } from "../src/render/text.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { ringModelFor } from "../tools/arena/ring.js";
import { ringButtonArt } from "../tools/arena/ring-art.js";
import { ringButtonsAt, ringPlacementFor } from "../tools/arena/ring-layout.js";

/** A 1v1 camera (`team` false: the build's own pivot about the arena origin). */
const pairCamera = (zoomscale, maxscale = zoomscale, gladiatorsX = 0) => ({ zoomscale, maxscale, gladiatorsX, team: false });
/** The stage view for a camera on a canvas, exactly as `tools/arena/main.js` builds it. */
function stageView(camera, width = 640, height = 420) {
  const fit = stageFitFor({ width, height });
  return { view: stageProjectorFor(camera, fit), fit };
}
const round = (value) => Math.round(value * 1000) / 1000;
const placed = (placement) => [placement.x, placement.y, placement.unit].map(round);

/* ------------------------------------------------------------------ */
/* 1. Where the overlay stands, and how big it is drawn                */
/* ------------------------------------------------------------------ */

test("the ring stands on the actor, 180 above his feet, one overlay pixel being flipoverlay% of an arena unit at the zoom", () => {
  const actor = { x: -250, y: 200 };
  const foe = { x: 250, y: 200 };
  // zoom 50: x = 319.95 - 250 * 0.5; y = 166.75 + (200 - 180) * 0.5; flipoverlay(50) = 240, so 0.5 * 2.4.
  const at50 = pairCamera(50);
  assert.deepEqual(placed(ringPlacementFor({ actor, foe, camera: at50, ...stageView(at50) })), [194.95, 176.75, 1.2]);
  // zoom 80: flipoverlay 160, so 0.8 * 1.6.
  const at80 = pairCamera(80);
  assert.deepEqual(placed(ringPlacementFor({ actor, foe, camera: at80, ...stageView(at80) })), [119.95, 182.75, 1.28]);
  // A canvas twice the stage doubles every number; the pan moves x only.
  assert.deepEqual(placed(ringPlacementFor({ actor, foe, camera: at50, ...stageView(at50, 1280, 840) })), [389.9, 353.5, 2.4]);
  const panned = pairCamera(50, 50, 10);
  assert.deepEqual(placed(ringPlacementFor({ actor, foe, camera: panned, ...stageView(panned) })), [204.95, 176.75, 1.2]);
});

test("while the camera eases, the fighters are drawn at the CURRENT zoom and flipoverlay follows the TARGET, as the build keys it", () => {
  const actor = { x: -250, y: 200 };
  // Easing in toward 80 at 42: the build scales `gladiators` to the zoom it has reached and picks
  // flipoverlay from `maxscale` (80 -> 160), so the ring is 0.42 * 1.6 overlay-to-stage, not 1.28.
  const easing = pairCamera(42, 80);
  assert.deepEqual(placed(ringPlacementFor({ actor, foe: null, camera: easing, ...stageView(easing) })), [214.95, 175.15, 0.672]);
});

test("the fitted view has no build camera to cancel: the authored 1.2 stage pixels per overlay pixel", () => {
  const actor = { x: -250, y: 200 };
  const fit = stageFitFor({ width: 1280, height: 840 });
  // Any projection: the fitted view is `viewportFor`'s, and only its toX/toY place the centre.
  const view = { scale: 0.7, toX: (x) => 640 + x * 0.7, toY: (y, lift) => 500 - (200 - y) - lift * 0.7 };
  const placement = ringPlacementFor({ actor, foe: null, camera: null, view, fit });
  assert.deepEqual(placed(placement), [465, 374, 2.4]);
  assert.equal(placement.source, "authored");
});

test("A TEAM CAMERA'S FITTED ZOOM, which no arm of the build's table matches, draws the ring the size the build draws it at the band below", () => {
  // `flipoverlay` has arms for maxscale < 20, 20, 30, 50, 60, 70 and 80 only; a 1v1's target is always one
  // of the bands, but a team camera pulls back to FIT (`targetZoomFor`) and can target any integer. There
  // the build would keep a stale value; the arena keeps the on-screen size of the band at or below.
  const actor = { x: -100, y: 200 };
  const team = (zoom) => ({ zoomscale: zoom, maxscale: zoom, gladiatorsX: 0, team: true });
  // 43 sits between the 30 and 50 arms: the 30 arm's size, 320% at 30 = 0.96 stage px per overlay px.
  // The team framing: front line 293.48 + 0.4 * 43 = 310.68, the ring 180 * 0.43 above it.
  const at43 = ringPlacementFor({ actor, foe: null, camera: team(43), ...stageView(team(43)) });
  assert.deepEqual(placed(at43), [276.95, 233.28, 0.96]);
  assert.equal(at43.source, "team");
  // 79, below the 80 arm: the 70 arm's 200% at 70 = 1.4. Past 80 (none is written): the 80 arm's 1.28.
  assert.equal(round(ringPlacementFor({ actor, foe: null, camera: team(79), ...stageView(team(79)) }).unit), 1.4);
  assert.equal(round(ringPlacementFor({ actor, foe: null, camera: team(100), ...stageView(team(100)) }).unit), 1.28);
  // A band the table does write is the build's own number, in a team fight too.
  const at50 = ringPlacementFor({ actor, foe: null, camera: team(50), ...stageView(team(50)) });
  assert.deepEqual([round(at50.unit), at50.source], [1.2, "build"]);
});

test("AT 1,600 APART the build closes up on its own copy of the hero; no pack holds that copy, so the ring stays on the actor and says so", () => {
  // `gDistance < 1600` keeps the overlay on the hero (`+0x0efe`/`+0x0f08`); at 1,600 or more it moves to
  // the midpoint at 600% and shows `overlay.hero` (sprite 711) — art no extracted pack carries.
  const at20 = pairCamera(20);
  const edge = ringPlacementFor({ actor: { x: -800, y: 200 }, foe: { x: 800, y: 200 }, camera: at20, ...stageView(at20) });
  // On the actor: 319.95 - 800 * 0.2; 166.75 + 20 * 0.2; flipoverlay(20) = 500, not the close-up's 600.
  assert.deepEqual(placed(edge), [159.95, 170.75, 1]);
  assert.equal(edge.buildClosesUp, true);
  const inside = ringPlacementFor({ actor: { x: -800, y: 200 }, foe: { x: 799, y: 200 }, camera: at20, ...stageView(at20) });
  assert.equal(inside.buildClosesUp, false, "1,599 apart is not a close-up");
  assert.equal(ringPlacementFor({ actor: { x: 0, y: 200 }, foe: null, camera: at20, ...stageView(at20) }).buildClosesUp, false);
});

/* ------------------------------------------------------------------ */
/* 2. Where each button stands on the ring                             */
/* ------------------------------------------------------------------ */

/** A model with the given slots filled — the shape `ringModelFor` returns, what the layout and art read. */
function modelWith(stanceFrame, facing, filled) {
  const order = ["optionA", "optionB", "optionC", "optionG", "optionD", "optionE", "optionF", "optionH"];
  return {
    stance: { frame: stanceFrame, range: stanceFrame.startsWith("close") ? "close" : "long", weapon: stanceFrame.endsWith("archer") ? "archer" : "warrior", facing },
    slots: order.map((slot, index) => ({
      key: String(index + 1),
      slot,
      verb: filled[slot] ?? null,
      action: filled[slot] ? { type: filled[slot] } : null
    }))
  };
}

test("A PACK'S MEASURED LAYOUT places each slot where the controller RESTS; a slot it does not place keeps the relayed position", () => {
  // `buttons.layout` as tools/extract-icons.mjs writes it: per controller the frame it rests on, per
  // slot runs of frames with a matrix (tx/ty in twips). Here optionB is moved on purpose, to be seen.
  const layout = {
    controllers: { closerange_warrior: { frame: 13, restsAt: 19 } },
    tracks: {
      // The controller's own frame (13) and its resting frame (19) in different runs: the RESTING one counts.
      optionB: [
        { from: 1, to: 3, matrix: [1, 0, 0, 1, 0, 0] },
        { from: 4, to: 18, matrix: [0.8, 0, 0, 0.8, -2000, 0] },
        { from: 19, to: 37, matrix: [0.75, 0, 0, 0.75, -1400, -200] }
      ]
    }
  };
  const model = modelWith("closerange_warrior", "right", { optionB: "walkleft", optionF: "quick_attack" });
  const buttons = ringButtonsAt(model, { centerX: 100, centerY: 200, unit: 2, layout });
  const row = ({ slot, x, y, r, scale }) => [slot, x, y, r, scale].map((value) => (typeof value === "number" ? round(value) : value));
  assert.deepEqual(buttons.map(row), [
    // (-1400, -200) twips = (-70, -10) px at scale 0.75: 100 - 140, 200 - 20, radius 18 * 0.75 * 2.
    ["optionB", -40, 180, 27, 1.5],
    // No run for optionF: the relayed (66.1, 23.4) at 0.8.
    ["optionF", 232.2, 246.8, 28.8, 1.6]
  ]);
  // No layout, or a stance the layout does not rest: the relayed table throughout.
  const relayed = ringButtonsAt(model, { centerX: 100, centerY: 200, unit: 2, layout: null });
  assert.deepEqual(relayed.map(row)[0], ["optionB", -28.4, 183.8, 28.8, 1.6]);
  const otherStance = modelWith("longrange_warrior", "right", { optionB: "walkleft" });
  assert.deepEqual(ringButtonsAt(otherStance, { centerX: 100, centerY: 200, unit: 2, layout }).map(row)[0], ["optionB", -28.4, 183.8, 28.8, 1.6]);
});

test("FLIPOVERLAY FLIPS NOTHING: facing left, every slot stands where it stands facing right — only its verb and frame change", () => {
  const right = ringButtonsAt(modelWith("closerange_warrior", "right", { optionA: "jumpleft", optionD: "power_attack" }), { centerX: 0, centerY: 0, unit: 1 });
  const left = ringButtonsAt(modelWith("closerange_warrior", "left", { optionA: "power_attack", optionD: "jumpright" }), { centerX: 0, centerY: 0, unit: 1 });
  assert.deepEqual(left.map(({ slot, x, y }) => [slot, x, y]), right.map(({ slot, x, y }) => [slot, x, y]));
  assert.deepEqual(left.map(({ slot, x }) => [slot, Math.sign(x)]), [["optionA", -1], ["optionD", 1]], "A stays in the left column");
});

/* ------------------------------------------------------------------ */
/* 3. What each button draws                                           */
/* ------------------------------------------------------------------ */

const square = (fill) => ({ bounds: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 }, paths: [{ d: "M0 0L10 0L10 10L0 10Z", fill, fillOpacity: 1 }] });
const place = (kind, character, extra = {}) => ({ kind, character, matrix: [1, 0, 0, 1, 0, 0], ...extra });
/** 826's two frames, up and over, as colours no icon uses. */
const UP = "#403020";
const OVER = "#f0c040";
/** Frame N's icon is one shape whose fill SAYS N: `#0000NN` in hex. */
const iconFill = (frame) => `#0000${frame.toString(16).padStart(2, "0")}`;

/**
 * An icons pack shaped as `tools/extract-icons.mjs` writes it: 860 with its
 * `battlebutton` (826) on every frame and on frames 2..41 one icon whose fill
 * names the frame; frame 1 is the background alone, as the build's is, and a
 * `blank` frame is too — marked, as the extractor marks the real pack's
 * 31..41, a duplicate of frame 1.
 */
function iconsPack({ blank = [] } = {}) {
  const shapes = { 824: square(UP), 825: square(OVER) };
  const frames = Array.from({ length: 41 }, (unused, index) => {
    const frame = index + 1;
    const background = place("clip", 826, { name: "battlebutton", frameCount: 2 });
    if (frame === 1 || blank.includes(frame)) return [background];
    shapes[2000 + frame] = square(iconFill(frame));
    return [background, place("shape", 2000 + frame)];
  });
  return {
    shapes,
    texts: {},
    buttons: {
      button: 860,
      clips: { 860: { character: 860, frames, duplicateOf: Object.fromEntries(blank.map((frame) => [frame, 1])) } },
      nested: { 826: { character: 826, instances: ["battlebutton"], frames: [[place("shape", 824)], [place("shape", 825)]] } }
    }
  };
}
/** The 860 frame a drawn button's icon comes from, read back off its fill; the background's state beside it. */
function drawnFrame(button) {
  const fills = button.ops.filter((op) => op.kind === "path").map((op) => op.fill);
  const icon = fills.find((fill) => fill.startsWith("#0000"));
  return { background: fills[0] === UP ? "up" : fills[0] === OVER ? "over" : fills[0], frame: icon ? parseInt(icon.slice(5), 16) : null };
}

/**
 * EVERY SLOT OF EVERY STANCE, BOTH FACINGS: the verb the controller wires there and the 860 frame it
 * sends that slot to. Verbs from the battle map's "Buttons wired per controller frame"; frames from its
 * "The icon each slot shows" (power 2/13, taunt 18/19, wincrowd 29/30, shove 16/10, bash 24/21, the
 * moves 6/7/8/9 and rest 11 either way, psyche 26 at a fresh counter) and the controller frames'
 * `gotoAndStop`s for the rest (normal 3/14, quick 4/15, charge 12/17, bombard 25/22, snipe 23/20).
 */
const BUILD_ICONS = {
  longrange_warrior: {
    right: { optionA: ["jumpleft", 7], optionB: ["walkleft", 6], optionC: ["taunt", 18], optionD: ["jumpright", 8], optionE: ["walkright", 9], optionF: ["chargeright", 12], optionG: ["wincrowd", 29], optionH: ["psyche_up", 26] },
    left: { optionA: ["jumpleft", 7], optionB: ["walkleft", 6], optionC: ["chargeleft", 17], optionD: ["jumpright", 8], optionE: ["walkright", 9], optionF: ["taunt", 19], optionG: ["psyche_up", 26], optionH: ["wincrowd", 30] }
  },
  closerange_warrior: {
    right: { optionA: ["jumpleft", 7], optionB: ["walkleft", 6], optionC: ["shove", 16], optionD: ["power_attack", 2], optionE: ["normal_attack", 3], optionF: ["quick_attack", 4], optionG: ["wincrowd", 29], optionH: ["psyche_up", 26] },
    left: { optionA: ["power_attack", 13], optionB: ["normal_attack", 14], optionC: ["quick_attack", 15], optionD: ["jumpright", 8], optionE: ["walkright", 9], optionF: ["shove", 10], optionG: ["psyche_up", 26], optionH: ["wincrowd", 30] }
  },
  longrange_archer: {
    right: { optionA: ["jumpleft", 7], optionB: ["walkleft", 6], optionC: ["rest", 11], optionD: ["bombardright", 25], optionE: ["walkright", 9], optionF: ["sniperight", 23], optionG: ["wincrowd", 29], optionH: ["psyche_up", 26] },
    left: { optionA: ["bombardleft", 22], optionB: ["walkleft", 6], optionC: ["snipeleft", 20], optionD: ["jumpright", 8], optionE: ["walkright", 9], optionF: ["rest", 11], optionG: ["psyche_up", 26], optionH: ["wincrowd", 30] }
  },
  closerange_archer: {
    right: { optionA: ["jumpleft", 7], optionB: ["walkleft", 6], optionC: ["shove", 16], optionD: ["jumpright", 8], optionE: ["bash_attack", 24], optionF: ["taunt", 18], optionG: ["wincrowd", 29], optionH: ["psyche_up", 26] },
    left: { optionA: ["jumpleft", 7], optionB: ["bash_attack", 21], optionC: ["taunt", 19], optionD: ["jumpright", 8], optionE: ["walkright", 9], optionF: ["shove", 10], optionG: ["psyche_up", 26], optionH: ["wincrowd", 30] }
  }
};

test("EVERY VERB'S SLOT DRAWS THE BUILD'S FRAME FOR THAT VERB, on all four stances and both facings, over the up background", () => {
  const pack = actionButtonPackFrom(iconsPack());
  let drawn = 0;
  for (const [stance, facings] of Object.entries(BUILD_ICONS)) {
    for (const [facing, slots] of Object.entries(facings)) {
      const model = modelWith(stance, facing, Object.fromEntries(Object.entries(slots).map(([slot, [verb]]) => [slot, verb])));
      const buttons = ringButtonArt(ringButtonsAt(model, { centerX: 0, centerY: 0, unit: 1 }), { pack, facing: model.stance.facing });
      assert.equal(buttons.length, 8);
      for (const button of buttons) {
        const [verb, frame] = slots[button.slot];
        assert.equal(button.verb, verb);
        assert.deepEqual(drawnFrame(button), { background: "up", frame }, `${stance} facing ${facing}: ${button.slot} ${verb}`);
        assert.equal(button.source, "build");
        drawn += 1;
      }
    }
  }
  assert.equal(drawn, 64);
});

test("HOVER SWAPS THE BACKGROUND TO ITS OVER FRAME — the overlay's onRollOver — on that button only, and keeps the icon", () => {
  const pack = actionButtonPackFrom(iconsPack());
  const model = modelWith("closerange_warrior", "right", { optionB: "walkleft", optionD: "power_attack", optionE: "normal_attack" });
  const buttons = ringButtonArt(ringButtonsAt(model, { centerX: 0, centerY: 0, unit: 1 }), { pack, facing: "right", hoverSlot: "optionD" });
  assert.deepEqual(buttons.map((button) => [button.slot, button.state, drawnFrame(button).background, drawnFrame(button).frame]), [
    ["optionB", "normal", "up", 6],
    ["optionD", "hover", "over", 2],
    ["optionE", "normal", "up", 3]
  ]);
});

test("THE PSYCHE SLOT FOLLOWS THE ACTOR'S COUNTER, 26 / 27 / 28, in whichever slot the stance puts it", () => {
  const pack = actionButtonPackFrom(iconsPack());
  const frameAt = (facing, slot, psyche) => {
    const model = modelWith("longrange_warrior", facing, { [slot]: "psyche_up" });
    return drawnFrame(ringButtonArt(ringButtonsAt(model, { centerX: 0, centerY: 0, unit: 1 }), { pack, facing, psyche })[0]).frame;
  };
  assert.deepEqual([1, 2, 3].map((counter) => frameAt("right", "optionH", counter)), [26, 27, 28]);
  assert.deepEqual([1, 2, 3].map((counter) => frameAt("left", "optionG", counter)), [26, 27, 28]);
});

test("A PACK-LESS RUN FALLS BACK: with no icons pack, or one extracted before the buttons, every button is S2's authored one", () => {
  const model = modelWith("closerange_warrior", "left", { optionA: "power_attack", optionE: "walkright", optionH: "wincrowd" });
  const placedButtons = ringButtonsAt(model, { centerX: 0, centerY: 0, unit: 1 });
  const noButtons = actionButtonPackFrom({ shapes: {}, icons: { inventory_buttons: { character: 116, frames: [[place("shape", 1)]] } } });
  for (const pack of [null, noButtons]) {
    const buttons = ringButtonArt(placedButtons, { pack, facing: "left", hoverSlot: "optionE" });
    assert.deepEqual(buttons.map((button) => button.source), ["authored", "authored", "authored"]);
    for (const button of buttons) {
      // The authored button: a bronze disc of radius 18 (its path starts at (18, 0)) and a stroked glyph.
      assert.ok(button.ops.every((op) => op.authored === true), button.slot);
      const disc = button.ops.find((op) => op.button === "disc");
      assert.match(disc.d, /^M18\.000 0\.000/);
      assert.ok(button.ops.some((op) => op.button === "glyph"), button.slot);
    }
    // The fallback's own hover look — the gold halo — under the pointer, and only there.
    assert.deepEqual(buttons.map((button) => button.ops.some((op) => op.button === "halo")), [false, true, false]);
  }
});

test("THE BOW'S AND THE SWINGS' BUTTONS carry the actor's arrows and the build's word, at the button's own scale", () => {
  const raw = iconsPack();
  const clip = raw.buttons.clips[860];
  const glow = [{ type: "glow", colour: { red: 153, green: 0, blue: 0, alpha: 255 }, blurX: 2, blurY: 2, strength: 10, inner: false, knockout: false, compositeSource: true, passes: 1 }];
  // 860 frame 25 (bombard, facing right): its word (852) and its `ammo_left` field (855), as the real pack places them.
  clip.frames[24] = [...clip.frames[24], place("text", 852, { filters: glow }), place("text", 855, { name: "ammo_left", filters: glow })];
  raw.texts = { 855: { kind: "edit-text", bounds: { xMin: 0, xMax: 20, yMin: 0, yMax: 10 }, fontHeight: 12, colour: { red: 255, green: 255, blue: 0 } } };
  const pack = actionButtonPackFrom(raw);
  const textPack = textPackFrom({
    fonts: { 7: { id: 7, glyphs: [{ code: 32, char: " ", path: "", empty: true, advance: 10000 }, { code: 66, char: "B", path: "M0 -10000L10000 -10000L10000 0L0 0Z", empty: false, advance: 12000 }] } },
    statics: { 852: { id: 852, matrix: [1, 0, 0, 1, 0, 0], text: "B", records: [{ font: 7, height: 409.6, colour: "#ffffff", alpha: 1, x: 0, y: 200, glyphs: [[1, 300]] }] } }
  });
  const model = modelWith("longrange_archer", "right", { optionD: "bombardright" });
  const drawAt = (unit) => ringButtonArt(ringButtonsAt(model, { centerX: 0, centerY: 0, unit }), { pack, facing: "right", ammo: 7, textPack })[0];
  const bombard = drawAt(2);
  assert.deepEqual(drawnFrame(bombard), { background: "up", frame: 25 });
  assert.deepEqual(bombard.ops.filter((op) => op.kind === "text").map((op) => op.text), ["7"], "the actor's ammo_left");
  const word = bombard.ops.find((op) => op.button === "label");
  assert.ok(word, "the build's word, in its own glyphs");
  // The glow is built for the button as drawn: 0.8 * unit device pixels per button pixel.
  assert.notEqual(word.group.filter, drawAt(1).ops.find((op) => op.button === "label").group.filter);
  // No text pack, no ammo: neither is guessed at.
  const bare = ringButtonArt(ringButtonsAt(model, { centerX: 0, centerY: 0, unit: 2 }), { pack, facing: "right" })[0];
  assert.equal(bare.ops.filter((op) => op.kind === "text" || op.button === "label").length, 0);
});

test("A PACK THAT CANNOT DRAW ONE VERB draws that button authored and the rest from the build", () => {
  // 860 frame 13 (power attack, facing left) blank: the pack calls it a copy of frame 1, the background alone.
  const pack = actionButtonPackFrom(iconsPack({ blank: [13] }));
  const model = modelWith("closerange_warrior", "left", { optionA: "power_attack", optionB: "normal_attack" });
  const buttons = ringButtonArt(ringButtonsAt(model, { centerX: 0, centerY: 0, unit: 1 }), { pack, facing: "left" });
  assert.deepEqual(buttons.map((button) => [button.slot, button.source]), [["optionA", "authored"], ["optionB", "build"]]);
  assert.deepEqual(drawnFrame(buttons[1]), { background: "up", frame: 14 });
});

test("A PACK MISSING PART OF ONE BUTTON — its icon's shape, its icon's clip, or its background — draws that button authored, never a partial build button", () => {
  // Codex review pass 2 (S3): a frame whose icon the pack does not hold was drawn as the background alone and
  // reported as the build's. Each case below removes one thing a populated frame places and keeps the rest.
  const model = modelWith("closerange_warrior", "left", { optionA: "power_attack", optionB: "normal_attack", optionC: "quick_attack" });
  const sources = (raw, hoverSlot = null) => ringButtonArt(ringButtonsAt(model, { centerX: 0, centerY: 0, unit: 1 }), { pack: actionButtonPackFrom(raw), facing: "left", hoverSlot })
    .map((button) => [button.slot, button.source]);

  // Frame 13's icon SHAPE is gone from the pack; its placement is still on the frame.
  const noShape = iconsPack();
  delete noShape.shapes[2013];
  assert.deepEqual(sources(noShape), [["optionA", "authored"], ["optionB", "build"], ["optionC", "build"]]);

  // Frame 14's icon is a CLIP the pack does not hold (not the background).
  const noClip = iconsPack();
  noClip.buttons.clips[860].frames[13] = [place("clip", 826, { name: "battlebutton", frameCount: 2 }), place("clip", 3014)];
  assert.deepEqual(sources(noClip), [["optionA", "build"], ["optionB", "authored"], ["optionC", "build"]]);

  // The background (826) is gone: no button is whole, so every one is authored — hovered or not.
  const noBackground = iconsPack();
  delete noBackground.buttons.nested[826];
  assert.deepEqual(sources(noBackground, "optionB"), [["optionA", "authored"], ["optionB", "authored"], ["optionC", "authored"]]);

  // A missing TEXT pack is not a missing part: the icon is whole, the word is simply not drawn (counted upstream).
  const worded = iconsPack();
  worded.buttons.clips[860].frames[12] = [...worded.buttons.clips[860].frames[12], place("text", 829)];
  assert.deepEqual(sources(worded), [["optionA", "build"], ["optionB", "build"], ["optionC", "build"]]);
});

/** The arena's demo bout, headless: the roster and rule set `tools/arena/main.js` builds. */
function demoHost({ perSide, seed, kit }) {
  const deps = { ss2Combatant, ss2BattleValues };
  const items = demoItemsFrom(kit);
  return createVanillaBattleHost({
    teams: [demoSide("red", perSide, { ...deps, items, seed }), demoSide("blue", perSide, { ...deps, items, seed })],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed
  });
}

/** The frame a verb in a slot must draw: the table's, or the shared taunt|rest slot's other verb. */
function expectedFrame(stance, facing, slot, verb) {
  const [tableVerb, frame] = BUILD_ICONS[stance][facing][slot];
  if (verb === tableVerb) return frame;
  const shared = stance.startsWith("longrange") && slot === (facing === "right" ? "optionC" : "optionF");
  if (shared && verb === "taunt") return facing === "right" ? 18 : 19;
  if (shared && verb === "rest") return 11;
  return `no ${verb} in ${stance} ${facing} ${slot}`;
}

test("OVER WHOLE BOUTS, every button the ring draws for whoever is due is the build's frame for its verb, slot and facing", () => {
  const pack = actionButtonPackFrom(iconsPack());
  const seen = new Set();
  let drawn = 0;
  // 2v2 joined 1v1 and 3v3 on 2026-09-24: since 7c9cabb a closed-on archer
  // backs away or puts the bow away instead of standing on the close-range
  // bow frame, and in 1v1/3v3 over these seeds nobody reached that frame
  // facing right any more (7 of 8 stances drawn). The ring was not wrong;
  // the sample no longer covered it.
  for (const perSide of [1, 2, 3]) {
    for (const kit of ["", "tricks"]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const host = demoHost({ perSide, seed, kit });
        for (let taken = 0; !host.battle.result && taken < 1500; taken += 1) {
          const actorId = host.currentCombatantId();
          const model = ringModelFor({
            actorId,
            combatants: host.wire().teams.flatMap((team) => team.combatants),
            legal: host.legalActions(),
            menuFor: (targetId) => host.unavailableActions(actorId, targetId)
          });
          const buttons = ringButtonArt(ringButtonsAt(model, { centerX: 0, centerY: 0, unit: 1 }), { pack, facing: model.stance.facing });
          for (const button of buttons) {
            const wanted = expectedFrame(model.stance.frame, model.stance.facing, button.slot, button.verb);
            assert.deepEqual(drawnFrame(button), { background: "up", frame: wanted },
              `${perSide}v${perSide} ${kit || "plain"} seed ${seed} turn ${taken}: ${model.stance.frame} ${model.stance.facing} ${button.slot} ${button.verb}`);
            seen.add(`${model.stance.frame} ${model.stance.facing} ${button.verb}`);
            drawn += 1;
          }
          host.submit({ ...host.suggestAction(actorId), actorId });
        }
        assert.ok(host.battle.result, `${perSide}v${perSide} ${kit || "plain"} seed ${seed} finished`);
      }
    }
  }
  // All four stances in both facings were drawn, with the swings, the bash and the bow's shots.
  const stances = new Set([...seen].map((entry) => entry.split(" ").slice(0, 2).join(" ")));
  assert.equal(stances.size, 8, [...stances].sort().join("; "));
  for (const needed of ["power_attack", "normal_attack", "quick_attack", "bash_attack", "bombardright", "bombardleft", "sniperight", "snipeleft", "taunt", "rest"]) {
    assert.ok([...seen].some((entry) => entry.endsWith(` ${needed}`)), `${needed} was never drawn: ${[...seen].sort().join("; ")}`);
  }
  assert.ok(drawn > 1000, `${drawn} buttons drawn`);
});

/* ------------------------------------------------------------------ */
/* 4. The shell paints what these return (read as text)                */
/* ------------------------------------------------------------------ */

/**
 * `tools/arena/main.js` cannot be imported by node, so — as
 * `test/arena-ring-wiring.test.js` does for S2 — the few lines that hand the
 * ring's placement and art to the canvas are pinned as text, comments and
 * strings blanked first.
 */
function shellCode() {
  const raw = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
}
function functionBody(code, name) {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is not defined in tools/arena/main.js`);
  let depth = 0;
  for (let index = code.indexOf("{", start); index < code.length; index += 1) {
    if (code[index] === "{") depth += 1;
    else if (code[index] === "}") { depth -= 1; if (depth === 0) return code.slice(start, index + 1); }
  }
  throw new Error(`${name}'s braces do not balance`);
}

test("the shell places the ring with the build's camera only in the stage view, at the pack's slot positions, in the pack's art", () => {
  const code = shellCode();
  const paint = functionBody(code, "paintRing");
  assert.match(paint, /ringPlacementFor\(\{[^}]*camera: arenaScreenAvailable\(\) \? camera : null,[^}]*\}\)/,
    "the build's camera in the stage view; the fitted view has none");
  assert.match(paint, /ringButtonsAt\(ringView\.model, \{[^}]*centerX: placement\.x,[^}]*centerY: placement\.y,[^}]*unit: placement\.unit,[^}]*layout: ringButtonPack\?\.layout \?\? null[^}]*\}\)/);
  assert.match(paint, /ringButtonArt\(buttons, \{[^}]*pack: ringButtonPack,[^}]*facing: ringView\.model\.stance\?\.facing[^}]*hoverSlot: ringHover,[^}]*\}\)/);
  assert.match(paint, /psyche: resourceValue\(actor, "", 1\)/, "the actor's own psyche counter");
  // The bow frames' count and the attack and bow words reach the art only through these two.
  assert.match(paint, /ringButtonArt\(buttons, \{[^}]*ammo: resourceValue\(actor, "", 0\),[^}]*\}\)/, "the actor's own arrows");
  assert.match(paint, /ringButtonArt\(buttons, \{[^}]*\btextPack\s*\}\)/, "the page's text pack, for the build's glyphs");
  assert.match(paint, /const actor = host\.combatant\(ringView\.actorId\);/, "the counters are the ACTING fighter's");
  // The blanking above hides WHICH resource each reads; the raw source says it (psyche_up and ammo_left
  // are the build's own `_root.game.hero` fields, `src/render/action-buttons.js`).
  const raw = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
  const rawPaint = raw.slice(raw.indexOf("function paintRing("), raw.indexOf("function paintRingButton("));
  assert.ok(rawPaint.includes('psyche: resourceValue(actor, "psyche_up", 1),'), "the psyche counter is psyche_up");
  assert.ok(rawPaint.includes('ammo: resourceValue(actor, "ammo_left", 0),'), "the arrows are ammo_left");
  assert.match(paint, /ringButtons = buttons;/, "the click is tested against what was drawn");
  assert.match(functionBody(code, "renderStage"), /paintRing\(view, fit\);/);
  assert.match(functionBody(code, "useIconPack"), /ringButtonPack = actionButtonPackFrom\(data\);/, "the buttons come from the same icons pack");
  const button = functionBody(code, "paintRingButton");
  assert.match(button, /paintGroupRuns\(paths, \{ translationDivisor: TWIPS_PER_PIXEL, filtersScaled: true \}, paintLayerOperation\)/,
    "twips translations, and the glows built at the button's own scale");
});
