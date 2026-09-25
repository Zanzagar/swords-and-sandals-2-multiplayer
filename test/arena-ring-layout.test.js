/**
 * WHERE THE RING IS DRAWN AND WHAT A CLICK HITS (`tools/arena/ring-layout.js`,
 * slice S2): the eight buttons around the acting fighter at the build's slot
 * positions, the authored scale they are drawn at, and which button or foe a
 * point on the canvas lands on.
 *
 * The expected positions are worked by hand from `SS2_OVERLAY_SLOTS` (the
 * relayed probe of overlay frame 4) and written as literals, so a change to
 * the arithmetic cannot agree with itself.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { ss2FlipOverlayFor } from "../src/render/action-buttons.js";
import { RING_STAGE_SCALE, fighterBoxFor, foeAt, ringButtonsAt, ringSlotAt } from "../tools/arena/ring-layout.js";

/** A model with slots B and F filled — the shape `ringModelFor` returns, only what the layout reads. */
const model = {
  slots: [
    { key: "1", slot: "optionA", verb: null, action: null },
    { key: "2", slot: "optionB", verb: "walkleft", action: { type: "walk-left" } },
    { key: "3", slot: "optionC", verb: null, action: null },
    { key: "4", slot: "optionG", verb: null, action: null },
    { key: "5", slot: "optionD", verb: null, action: null },
    { key: "6", slot: "optionE", verb: null, action: null },
    { key: "7", slot: "optionF", verb: "quick_attack", action: { type: "quick-attack" } },
    { key: "8", slot: "optionH", verb: null, action: null }
  ]
};

test("only the filled slots are drawn, each at its slot's position times the unit, with the fallback radius scaled the same way", () => {
  const buttons = ringButtonsAt(model, { centerX: 100, centerY: 200, unit: 2 });
  // optionB (-64.2, -8.1) and optionF (66.1, 23.4), both at scale 0.8; the fallback radius is 18.
  assert.deepEqual(buttons.map(({ key, slot, verb, x, y, r }) => [key, slot, verb, round(x), round(y), round(r)]), [
    ["2", "optionB", "walkleft", -28.4, 183.8, 28.8],
    ["7", "optionF", "quick_attack", 232.2, 246.8, 28.8]
  ]);
  assert.equal(buttons[0].side, "left");
  assert.equal(buttons[1].side, "right");
});

test("a click inside a drawn button hits it; on its rim it still does; outside, or where an empty slot would be, nothing", () => {
  const buttons = ringButtonsAt(model, { centerX: 100, centerY: 200, unit: 2 });
  assert.equal(ringSlotAt(buttons, -28.4, 183.8), "optionB");
  const [walk] = buttons;
  assert.equal(ringSlotAt(buttons, walk.x + walk.r, walk.y), "optionB", "the rim counts");
  assert.equal(ringSlotAt(buttons, walk.x + walk.r + 0.2, walk.y), null);
  assert.equal(ringSlotAt(buttons, 232.2, 246.8 - 20), "optionF");
  // optionA would be at (100 - 107, 200 - 76): empty, so not a button.
  assert.equal(ringSlotAt(buttons, -7, 124), null);
  assert.equal(ringSlotAt([], 0, 0), null);
});

test("the authored on-stage scale lies inside the build's own: flipoverlay x maxscale over every zoom combatscale writes", () => {
  // `combatscale` writes maxscale 80/70/60/50/30/20/15 (action-buttons.js, `ss2FlipOverlayFor`); the
  // overlay is drawn at flipoverlay% inside `gladiators`, which is drawn at the zoom — so one overlay
  // pixel is flipoverlay * maxscale / 10000 stage pixels once the zoom has settled.
  const onStage = [80, 70, 60, 50, 30, 20, 15].map((maxscale) => (ss2FlipOverlayFor(maxscale) * maxscale) / 10000);
  assert.deepEqual(onStage, [1.28, 1.4, 1.32, 1.2, 0.96, 1, 0.9]);
  assert.ok(RING_STAGE_SCALE >= Math.min(...onStage) && RING_STAGE_SCALE <= Math.max(...onStage), String(RING_STAGE_SCALE));
});

test("a fighter's box stands on his feet, a clip's height tall at his size", () => {
  // The fighter clip's origin is the soles and its head is at -220 clip pixels, one arena unit each.
  const box = fighterBoxFor({ footX: 400, footY: 300, pxPerUnit: 0.5, size: 1.2 });
  assert.deepEqual([box.x0, box.x1, box.y0, box.y1].map(round), [367, 433, 168, 300]);
});

test("a click on overlapping fighters takes the one drawn last, which is the one in front", () => {
  const boxes = [
    { id: "blue-3", x0: 0, x1: 100, y0: 0, y1: 100 },
    { id: "blue-1", x0: 50, x1: 150, y0: 20, y1: 120 },
    { id: "red-1", x0: 300, x1: 400, y0: 0, y1: 100 }
  ];
  assert.equal(foeAt(boxes, 75, 50, ["blue-1", "blue-3"]), "blue-1");
  assert.equal(foeAt(boxes, 25, 50, ["blue-1", "blue-3"]), "blue-3");
  assert.equal(foeAt(boxes, 350, 50, ["blue-1", "blue-3"]), null, "not a foe");
  assert.equal(foeAt(boxes, 200, 50, ["blue-1", "blue-3"]), null, "nobody");
  // A foe behind an ally is still his: the ally in front is not a foe and takes nothing.
  const behind = [{ id: "blue-1", x0: 0, x1: 100, y0: 0, y1: 100 }, { id: "red-2", x0: 0, x1: 100, y0: 0, y1: 100 }];
  assert.equal(foeAt(behind, 50, 50, ["blue-1"]), "blue-1");
});

function round(value) {
  return Math.round(value * 10) / 10;
}
