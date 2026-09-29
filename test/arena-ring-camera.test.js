/**
 * THE CAMERA FRAMES A PERSON'S RING, AND THE RING IS DRAWN AT ONE SIZE (ring3 slice "camera"; the owner's
 * decision 6, `docs/design/battle-ui.md#decided-hud-2026-09-24`): "on a PERSON's turn only, the camera eases to
 * also frame the acting fighter's ring (buttons, items row, rank arrows) with a margin, and every lit target while
 * a reach preview shows; the ring is drawn at a FIXED on-screen size, capped at what the build shows at zoom 80,
 * instead of growing with the survivors' close-up. AI and spectate turns stay byte-identical — the close-up and
 * 1v1 untouched." Amended by D3 (`#decided-inframe-hud-2026-09-24`): in a team bout every camera keeps the
 * fighters above the in-frame HUD and every rank off the painted wall.
 *
 * Seams under test: `ringPlacementFor` (how big the ring is drawn) and `ringFramingFor` (what of the ring and the
 * lit targets a camera must keep on the stage), both in `tools/arena/ring-layout.js`; the camera's own seam,
 * `stepFramedCamera`'s `framing`, is `test/render-camera-ring.test.js`'s. The shell's wiring is read as text.
 *
 * Expected numbers are literals worked by hand from the build's own constants (the arena origin 319.95 / 166.75,
 * the team front line `293.48 + 0.4 z`, `flipoverlay(80)` = 160 at `+0x109d`..`+0x1180`), never recomputed the way
 * the code computes them. The bouts come off a REAL host.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  SS2_ARENA_SCREEN_LAYERS,
  SS2_ARENA_WALL_BASE,
  SS2_CLOSE_UP,
  SS2_RING_FRAMING,
  actorSpanFor,
  arenaToStage,
  inkDepthAt,
  layerPlacementFor,
  stageFitFor,
  stageProjectorFor,
  stepFramedCamera
} from "../src/render/arena-backdrop.js";
import {
  fighterBoxFor,
  ringButtonsAt,
  ringButtonsInside,
  ringFramingFor,
  ringItemButtonsAt,
  ringLabelAt,
  ringLabelBoxOf,
  ringLabelSizeFor,
  ringMoveButtonsAt,
  ringPlacementFor,
  ringReachNumberAt,
  ringSwapButtonAt,
  ringTargetRingAt
} from "../tools/arena/ring-layout.js";
import { RING_VERB_LABELS, ringModelFor } from "../tools/arena/ring.js";
import { ringButtonArt, ringWordBoxesOf } from "../tools/arena/ring-art.js";
import { actionButtonPackFrom } from "../src/render/action-buttons.js";
import { textPackFrom } from "../src/render/text.js";
import { ringReachFor } from "../tools/arena/ring-preview.js";
import { ringBoundsFor, combatHudArtFor } from "../tools/arena/combat-hud.js";
import { combatPanelLayoutFor } from "../src/render/combat-panel.js";
import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { SS2_ARENA, ss2BattleValues, ss2Combatant, ss2PhysicalSize, ss2TeamRules } from "../src/team/ss2-rules.js";
import { resourceValue } from "../src/team/resources.js";
import { rngJournal } from "../src/team/resolver.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { ss2ColossusYscaleAfter } from "../src/common/ss2-figure.js";
import { figureScaleFor } from "../src/render/figure.js";
import { rankOfDepth } from "../src/render/arena-shell.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const round = (value) => Math.round(value * 1000) / 1000;
const placed = (placement) => [placement.x, placement.y, placement.unit].map(round);
function stageView(camera, width = 640, height = 420) {
  const fit = stageFitFor({ width, height });
  return { view: stageProjectorFor(camera, fit), fit };
}

/* ------------------------------------------------------------------ */
/* 1. The ring's size: fixed in a team bout, the build's own in a 1v1  */
/* ------------------------------------------------------------------ */

test("A TEAM BOUT'S RING IS DRAWN AT ONE SIZE, the build's own at its tightest band: 0.8 x 160% = 1.28 stage px per overlay px, whatever the camera is doing", () => {
  const actor = { x: -100, y: 200 };
  const team = (zoomscale, maxscale = zoomscale) => ({ zoomscale, maxscale, gladiatorsX: 0, team: true });
  // Zoom 43 (a fitted team zoom): the build's table has no arm, and the team generalisation drew the 30 arm's
  // 0.96. Fixed, it is 1.28. The centre does not move: 319.95 - 100 * 0.43; the team front line
  // 293.48 + 0.4 * 43 = 310.68, the overlay 180 * 0.43 above it.
  const at43 = ringPlacementFor({ actor, foe: null, camera: team(43), ...stageView(team(43)), teamBout: true });
  assert.deepEqual(placed(at43), [276.95, 233.28, 1.28]);
  assert.equal(at43.source, "fixed");
  // Zoom 79, where the 70 arm drew 1.4 — past the cap — and 100, the survivors' close-up: 1.28 both.
  assert.equal(round(ringPlacementFor({ actor, foe: null, camera: team(79), ...stageView(team(79)), teamBout: true }).unit), 1.28);
  assert.equal(round(ringPlacementFor({ actor, foe: null, camera: team(100), ...stageView(team(100)), teamBout: true }).unit), 1.28);
  // While the zoom eases (42 on its way to 80) the build's ring is 0.42 x 1.6 = 0.672; fixed, it is not.
  assert.equal(round(ringPlacementFor({ actor, foe: null, camera: team(42, 80), ...stageView(team(42, 80)), teamBout: true }).unit), 1.28);
  // A team whittled to a pair frames on the pair's line (`team` false on the camera) and is still a team bout:
  // the close-up at 100 on a pair camera, 1.28.
  const pair = { zoomscale: 100, maxscale: 100, gladiatorsX: 0, team: false };
  assert.equal(round(ringPlacementFor({ actor, foe: null, camera: pair, ...stageView(pair), teamBout: true }).unit), 1.28);
  // A canvas twice the stage doubles it, as it doubles everything on the stage.
  assert.deepEqual(placed(ringPlacementFor({ actor, foe: null, camera: team(43), ...stageView(team(43), 1280, 840), teamBout: true })),
    [553.9, 466.56, 2.56]);
});

test("A 1v1 IS THE BUILD'S OWN RING, and the fitted view keeps its authored 1.2: the fixed size is a team bout's on the build's stage only", () => {
  const actor = { x: -250, y: 200 };
  const foe = { x: 250, y: 200 };
  const pair = (zoomscale, maxscale = zoomscale) => ({ zoomscale, maxscale, gladiatorsX: 0, team: false });
  // The build's own numbers, as S3 pinned them: zoom 50, flipoverlay 240 -> 1.2; easing at 42 toward 80 -> 0.672.
  assert.deepEqual(placed(ringPlacementFor({ actor, foe, camera: pair(50), ...stageView(pair(50)), teamBout: false })), [194.95, 176.75, 1.2]);
  assert.equal(round(ringPlacementFor({ actor, foe, camera: pair(42, 80), ...stageView(pair(42, 80)) }).unit), 0.672, "no teamBout: a 1v1");
  // The fitted view has no camera: S2's authored 1.2 stage px per overlay px, a team bout or not.
  const fit = stageFitFor({ width: 1280, height: 840 });
  const view = { scale: 0.7, toX: (x) => 640 + x * 0.7, toY: (y, lift) => 500 - (200 - y) - lift * 0.7 };
  const fitted = ringPlacementFor({ actor, foe: null, camera: null, view, fit, teamBout: true });
  assert.deepEqual([...placed(fitted), fitted.source], [465, 374, 2.4, "authored"]);
});

/* ------------------------------------------------------------------ */
/* 2. What the camera must keep on the stage: `ringFramingFor`         */
/* ------------------------------------------------------------------ */

/** The shape `ringModelFor` returns, only what the layout reads: the stance, two walks in their slots, both rank arrows. */
const WALKS_AND_ARROWS = {
  stance: { frame: "closerange_warrior", range: "close", weapon: "warrior", facing: "right" },
  slots: ["optionA", "optionB", "optionC", "optionG", "optionD", "optionE", "optionF", "optionH"].map((slot, index) => {
    const verb = slot === "optionB" ? "walkleft" : slot === "optionE" ? "walkright" : null;
    return { key: String(index + 1), slot, verb, action: verb ? { type: verb } : null };
  }),
  moves: [
    { key: "ArrowUp", move: "rank-back", place: "above-head", verb: "rank_back", action: { type: "rank-back" } },
    { key: "ArrowDown", move: "rank-front", place: "below-feet", verb: "rank_front", action: { type: "rank-front" } }
  ]
};
const TEAM_AT_50 = Object.freeze({ zoomscale: 50, maxscale: 50, gladiatorsX: 0, crowdY: -150, team: true, teamWeight: 1 });
const box = ({ x0, x1, y0, y1 }) => [x0, x1, y0, y1].map((value) => Math.round(value * 1e4) / 1e4);
const sorted = (boxes) => boxes.map(box).sort((a, b) => a[0] - b[0] || a[2] - b[2]);

test("THE RING THE CAMERA FRAMES is the ring `paintRing` lays out at that camera — its buttons, the rank arrows off the drawn head and name, each key label where it stands, the words the eight paint — in STAGE px", () => {
  // Worked by hand at a team camera, zoom 50, pan 0, on the 640x420 stage (1 canvas px a stage px). The actor at
  // (-100, 200), drawn at size 0.86: at 319.95 - 50 = 269.95, his feet on the team line 293.48 + 0.4 * 50 = 313.48,
  // the ring 180 * 0.5 above them (223.48), 1.28 canvas px an overlay px.
  // optionB (-64.2, -8.1) at 0.8 -> (187.774, 213.112), r 18 * 0.8 * 1.28 = 18.432; optionE (66.1, -8.1) -> 354.558.
  // The arrows: gap (31.5 - 28.8) * 1.28 = 3.456 off his head 313.48 - 220 * 0.5 * 0.86 = 218.88 (up to 196.992),
  // and off the bottom of his name, 313.48 + 22 * 0.5 + max(10, 7.5) / 2 = 329.48 (down to 351.368).
  // Each walk's key label (30 px wide as stated here, 11 px tall at round(0.62 r), gap 3.6864) on its outer side.
  // One word, stated relative to the ring's centre, rides with it.
  const words = [{ slot: "optionB", verb: "walkleft", word: "label", x0: -90, x1: -75, y0: -35, y1: -28 }];
  const framing = ringFramingFor({
    model: WALKS_AND_ARROWS, actor: { x: -100, y: 200, size: 0.86 }, fit: stageFitFor({ width: 640, height: 420 }),
    words, labelWidth: () => 30
  });
  assert.deepEqual(sorted(framing(TEAM_AT_50)), sorted([
    { x0: 169.342, x1: 206.206, y0: 194.68, y1: 231.544 }, // optionB
    { x0: 336.126, x1: 372.99, y0: 194.68, y1: 231.544 }, // optionE
    { x0: 251.518, x1: 288.382, y0: 178.56, y1: 215.424 }, // step back, over the head
    { x0: 251.518, x1: 288.382, y0: 332.936, y1: 369.8 }, // step forward, under the name
    { x0: 135.6556, x1: 165.6556, y0: 207.612, y1: 218.612 }, // "2 Walk", right-aligned 3.6864 left of optionB
    { x0: 376.6764, x1: 406.6764, y0: 207.612, y1: 218.612 }, // optionE's, left-aligned to its right
    { x0: 179.95, x1: 194.95, y0: 188.48, y1: 195.48 } // the word
  ]));
  // A pan moves every box by the pan and nothing else: the camera's contract with a framing.
  const panned = framing({ ...TEAM_AT_50, gladiatorsX: 40 });
  assert.deepEqual(sorted(panned), sorted(framing(TEAM_AT_50).map((one) => ({ ...one, x0: one.x0 + 40, x1: one.x1 + 40 }))));
});

test("A LIT TARGET is framed whole: his drawn box, his number over his head where the page would draw it unclamped, and the gold ring on the sand round his feet", () => {
  // Worked by hand, the same camera. A lit foe at (200, 200), size 0.86: feet at (419.95, 313.48); his box
  // +-55 * 0.43 = 23.65 wide, 220 * 0.43 = 94.6 tall; his number a 9 px disc 4 px over it (centre 205.88); his
  // ring rx 70 * 0.43 = 30.1, ry 0.3 rx = 9.03, stroked max(2, 0.07 rx) = 2.107 wide, half of it outside.
  const framing = ringFramingFor({
    model: { stance: WALKS_AND_ARROWS.stance, slots: [] }, actor: { x: -100, y: 200, size: 0.86 },
    lit: [{ x: 200, y: 200, size: 0.86 }], fit: stageFitFor({ width: 640, height: 420 })
  });
  assert.deepEqual(sorted(framing(TEAM_AT_50)), sorted([
    { x0: 396.3, x1: 443.6, y0: 218.88, y1: 313.48 },
    { x0: 410.95, x1: 428.95, y0: 196.88, y1: 214.88 },
    { x0: 388.7965, x1: 451.1035, y0: 303.3965, y1: 323.5635 }
  ]));
});

test("WHAT IS FRAMED WITH WHAT IT DRAWS ROUND IT, AND WHAT IS NOT: a greyed jump and its word stand off the stage inert (decision 9), a greyed button has no label to frame, a label a neighbour blocks is framed where it goes, and an item place with its letter's room", () => {
  // Worked by hand, the zoom-50 camera above (centre (269.95, 223.48), 1.28 a px, 30 px labels). A greyed jump in
  // optionA and a word stated on it; a taunt greyed in optionC (-64.2, 23.4) -> (187.774, 253.432); a swing in
  // optionG (-53.5, 53.4) -> (201.47, 291.832); the swap at (-93.4, 40.4) and 0.6, its disc 18.25 of its own px in:
  // (-82.45, 51.35) * 1.28 -> (164.414, 289.208), r 18 * 0.6 * 1.28 = 13.824, its label 9 px tall, 3 off it; and
  // an item in inventory_button1: the row at (0, -80) and 0.6, the place (-38, 0) and its disc 18.25 in:
  // (0.6 * -19.75, -80 + 0.6 * 18.25) * 1.28 -> (254.782, 135.096), r 13.824, its letter's room 3 + 9 above it.
  const model = {
    stance: WALKS_AND_ARROWS.stance,
    slots: ["optionA", "optionB", "optionC", "optionG", "optionD", "optionE", "optionF", "optionH"].map((slot, index) => {
      const key = String(index + 1);
      if (slot === "optionA") return { key, slot, verb: "jumpleft", action: null, reason: { code: "not-built", words: "Not built yet" } };
      if (slot === "optionC") return { key, slot, verb: "taunt", action: null, reason: { code: "other-rank", words: "Another rank" } };
      if (slot === "optionG") return { key, slot, verb: "power_attack", action: { type: "power-attack" } };
      return { key, slot, verb: null, action: null };
    }),
    swap: { key: "9", slot: "swap_inventory", verb: "swap_weapons", usingBow: false, action: { type: "swap-weapons" } },
    items: [{ key: "Q", slot: "inventory_button1", itemId: 7, action: { type: "cast-fireball" } }]
  };
  const words = [{ slot: "optionA", verb: "jumpleft", word: "label", x0: -70, x1: -40, y0: -70, y1: -60 }];
  const framing = ringFramingFor({
    model, actor: { x: -100, y: 200, size: 0.86 }, fit: stageFitFor({ width: 640, height: 420 }), words, labelWidth: () => 30
  });
  assert.deepEqual(sorted(framing(TEAM_AT_50)), sorted([
    { x0: 169.342, x1: 206.206, y0: 235, y1: 271.864 }, // the greyed taunt: its disc, no label
    { x0: 183.038, x1: 219.902, y0: 273.4, y1: 310.264 }, // optionG
    { x0: 186.47, x1: 216.47, y0: 313.9504, y1: 324.9504 }, // its label UNDER it: the swap stands on its outer side
    { x0: 150.59, x1: 178.238, y0: 275.384, y1: 303.032 }, // the swap
    { x0: 117.59, x1: 147.59, y0: 284.708, y1: 293.708 }, // its label, 3 px off its outer side
    { x0: 240.958, x1: 268.606, y0: 109.272, y1: 148.92 }, // the item place, its letter's room over it
    { x0: 239.782, x1: 269.782, y0: 109.272, y1: 118.272 } // its letter, above it
  ]));
});

test("THE FRAMED ROW IS THE ROW THE PAGE DRAWS: lifted over a word the eight paint under it (decision 7), by the ring's own gap", () => {
  // Worked by hand, the zoom-50 camera. The item place in inventory_button1 stands at (254.782, 135.096), r 13.824,
  // its foot at 148.92. A word stated 75..68 over the ring's centre and 20..5 left of it stands at y 148.48..155.48,
  // x 249.95..264.95 — in the place's column, its top 0.44 over the place's foot. The row rises until the place's
  // foot is the ring's gap, (31.5 - 28.8) * 1.28 = 3.456, over the word: by 0.44 + 3.456 = 3.896, to y 131.2.
  // (The step-back arrow's place, off the head at 218.88, asks nothing: the row's foot is far above it.)
  const model = {
    stance: WALKS_AND_ARROWS.stance,
    slots: [],
    items: [{ key: "Q", slot: "inventory_button1", itemId: 7, action: { type: "cast-fireball" } }]
  };
  const words = [{ slot: "optionD", verb: "bombardright", word: "label", x0: -20, x1: -5, y0: -75, y1: -68 }];
  const framing = ringFramingFor({ model, actor: { x: -100, y: 200, size: 0.86 }, fit: stageFitFor({ width: 640, height: 420 }), words, labelWidth: () => 30 });
  assert.deepEqual(sorted(framing(TEAM_AT_50)), sorted([
    { x0: 240.958, x1: 268.606, y0: 105.376, y1: 145.024 }, // the place, lifted 3.896, its letter's room over it
    { x0: 239.782, x1: 269.782, y0: 105.376, y1: 114.376 }, // its letter
    { x0: 249.95, x1: 264.95, y0: 148.48, y1: 155.48 } // the word
  ]));
});

test("A LIT FOE'S NUMBER IS FRAMED WHERE IT WOULD STAND, not where the page would clamp it onto the stage", () => {
  // Worked by hand: the pair's camera at 100 (a whittled team), a lit foe at (100, 6) — the back rank, depth
  // 6 + 194 * 0.5 = 103, feet at 166.75 + 103 = 269.75 — as big as a colossus (1.5): his head at 269.75 - 330 =
  // -60.25, his number's centre 13 over it at -73.25, above the stage's top. The camera must bring it down.
  const pair = { zoomscale: 100, maxscale: 100, gladiatorsX: 0, crowdY: -100, team: false, teamWeight: 0 };
  const framing = ringFramingFor({
    model: { stance: WALKS_AND_ARROWS.stance, slots: [] }, actor: { x: -100, y: 200, size: 0.86 },
    lit: [{ x: 100, y: 6, size: 1.5 }], fit: stageFitFor({ width: 640, height: 420 })
  });
  assert.deepEqual(sorted(framing(pair)), sorted([
    { x0: 337.45, x1: 502.45, y0: -60.25, y1: 269.75 },
    { x0: 410.95, x1: 428.95, y0: -82.25, y1: -64.25 },
    // rx 70 * 1.5 = 105, ry 31.5, stroked max(2, 7.35) wide.
    { x0: 311.275, x1: 528.625, y0: 234.575, y1: 304.925 }
  ]));
});

test("IN STAGE px ON ANY CANVAS: a canvas twice the stage frames the same ring, but for the page's own canvas-px floors (the name's 10 px, the label's round)", () => {
  // At 1280x840 every canvas length doubles and is halved back — except what the page floors in CANVAS px: the
  // name is max(10, 1.0 * 15) = 15 canvas px (7.5 stage) where it was 10 stage, so the step-forward arrow stands
  // 313.48 + 11 + 3.75 + 21.888 = 350.118; the label is round(0.62 * 36.864) = 23 canvas px (11.5 stage) tall.
  const framing = ringFramingFor({
    model: WALKS_AND_ARROWS, actor: { x: -100, y: 200, size: 0.86 }, fit: stageFitFor({ width: 1280, height: 840 }),
    labelWidth: () => 60
  });
  const boxes = sorted(framing(TEAM_AT_50));
  assert.deepEqual(boxes.find(([x0, , y0]) => x0 === 251.518 && y0 > 300), [251.518, 288.382, 331.686, 368.55]);
  assert.deepEqual(boxes.find(([x0]) => x0 === 135.6556), [135.6556, 165.6556, 207.362, 218.862]);
});

/* ------------------------------------------------------------------ */
/* 3. The shell's wiring (read as text: `tools/arena/main.js` cannot be imported by node)   */
/* ------------------------------------------------------------------ */

const rawShell = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
/** The shell with comments and strings blanked, so a pin matches code and never a sentence about it. */
const shell = rawShell
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
function bodyOf(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is not defined in tools/arena/main.js`);
  // Past the parameter list first: a destructured parameter (`{ dashed = false }`) has braces of its own.
  let parens = 0;
  let close = source.indexOf("(", start);
  for (; close < source.length; close += 1) {
    if (source[close] === "(") parens += 1;
    else if (source[close] === ")") { parens -= 1; if (parens === 0) break; }
  }
  let depth = 0;
  for (let index = source.indexOf("{", close); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") { depth -= 1; if (depth === 0) return source.slice(start, index + 1); }
  }
  throw new Error(`${name}'s braces do not balance`);
}
const functionBody = (name) => bodyOf(shell, name);

test("THE SHELL HANDS THE CAMERA THE PERSON'S RING, every frame, before the view is built — and nothing on an AI or spectated turn, in a 1v1, or in the fitted view", () => {
  const step = functionBody("stepCamera");
  assert.match(step, /cameraFrame = stepFramedCamera\(cameraFrame, placedActors\(now\), \{\s*result: host\?\.battle\?\.result \?\? null,\s*hudTop: hudFrame\?\.cameraHudTop \?\? null,\s*framing: ringFramingNow\(now\)\s*\}\);/);
  assert.match(step, /camera = cameraFrame\.camera;/);
  const now = functionBody("ringFramingNow");
  // A person's turn is the ring on the stage (`ringShown`: a person's seat is due and the arena is ready for it); the
  // build's stage only (the fitted view has no camera to move); a team bout only (the camera ignores a pair's too).
  assert.match(now, /if \(!ringShown\(\) \|\| !arenaScreenAvailable\(\) \|\| !teamBout\(\)\) return null;/);
  assert.match(now, /const byId = combatantsById\(\);\s*const actor = ringAnchorOf\(ringView\.actorId, now, byId\);\s*if \(!actor\) return null;/,
    "the wire read once a frame; no framing for a fighter who is not placed");
  assert.match(now, /const reach = ringReachFor\(ringView\.model, ringReachShown, \{ legal: ringView\.legal \}\);/, "the lit foes: the reach the page draws this frame");
  assert.match(now, /const lit = \(reach\?\.lit \?\? \[\]\)\.map\(\(one\) => ringAnchorOf\(one\.foeId, now, byId\)\)\.filter\(Boolean\);/);
  assert.match(now, /return ringFramingFor\(\{\s*model: ringView\.model,\s*actor,\s*lit,\s*fit,\s*layout: ringButtonPack\?\.layout \?\? null,\s*rowLayout: ringButtonPack\?\.inventory\?\.layout \?\? null,\s*words: ringFrameWords\(fit\),\s*labelWidth: ringFrameLabelWidth\s*\}\);/);
  assert.match(now, /const fit = stageFitFor\(\{ width: canvas\.width, height: canvas\.height \}\);/, "the frame's own fit: the canvas is sized before the camera steps");
  // Where a fighter is drawn when nothing of his is playing — which is when the ring is up — and at what size, as
  // `renderStage` sizes him.
  const anchor = functionBody("ringAnchorOf");
  assert.match(anchor, /const actor = scene\.actors\[combatantId\];\s*const combatant = byId\.get\(combatantId\);/);
  assert.match(anchor, /size: figureScaleFor\(\{\s*yscale: drawnYscaleOf\(combatantId, now\),\s*rank: rankOf\(actor\.y, combatant\.slotIndex\),\s*slotIndex: combatant\.slotIndex\s*\}\)/);
  assert.match(anchor, /return \{ x: actor\.x, y: actor\.y, size:/);
});

test("THE RING'S SIZE AND WHAT THE FRAMING MEASURES are the ring `paintRing` draws: a team bout's fixed size, the eight's words at it, the key labels in the page's font and words", () => {
  const paint = functionBody("paintRing");
  assert.match(paint, /const placement = ringPlacementFor\(\{\s*actor: ringOrigins\.actor,\s*foe: ringOrigins\.foe,\s*camera: arenaScreenAvailable\(\) \? camera : null,\s*view,\s*fit,\s*teamBout: teamBout\(\)\s*\}\);/);
  // A team bout is the camera's own: more than two PLACED fighters, as `placedActors` filters them.
  assert.match(functionBody("teamBout"), /scene\.drawOrder\.filter\(\(combatantId\) => \{\s*const actor = scene\.actors\[combatantId\];\s*return actor && actor\.placed !== false && Number\.isFinite\(actor\.x\);\s*\}\)\.length > 2/);
  // The eight's words at the fixed size, off the ring's centre — built as `paintRing` builds its art, kept while
  // nothing they depend on changes.
  const words = functionBody("ringFrameWords");
  assert.match(words, /const art = \{\s*pack: ringButtonPack,\s*facing: ringView\.model\.stance\?\.facing \?\? "",\s*psyche: resourceValue\(actor, "", 1\),\s*ammo: resourceValue\(actor, "", 0\),\s*textPack\s*\};/,
    "paintRing's art, the pointer aside: the words stand where they stand on either background");
  assert.match(words, /const unit = fit\.scale \* RING_TEAM_STAGE_SCALE;/);
  assert.match(words, /ringWordBoxesOf\(ringButtonArt\(ringButtonsAt\(ringView\.model, \{ centerX: 0, centerY: 0, unit, layout: ringButtonPack\?\.layout \?\? null \}\), art\)\)/);
  // Each key label measured as `paintRing` measures it: its font, and its words — letter for an item, else key
  // and short verb — the same expression in both places.
  const label = 'const label = button.verb === "item" ? button.key : `${button.key} ${RING_VERB_LABELS[button.verb]?.short ?? button.verb}`;';
  assert.ok(bodyOf(rawShell, "paintRing").includes(label), "paintRing's label");
  const measure = bodyOf(rawShell, "ringFrameLabelWidth");
  assert.ok(measure.includes(label), "the framing measures the same words");
  assert.ok(measure.includes("context.font = `600 ${px}px ui-sans-serif, system-ui, sans-serif`;"), "in paintRing's font");
  assert.ok(bodyOf(rawShell, "paintRing").includes("context.font = `600 ${px}px ui-sans-serif, system-ui, sans-serif`;"));
  // The gold ring a lit foe is framed with is the one the page paints.
  const target = functionBody("paintTargetRing");
  assert.match(target, /const ring = ringTargetRingAt\(\{ footX: view\.toX\(origin\.x\), footY: view\.toY\(origin\.y, 0\), size: origin\.size \?\? 1, scale: view\.scale \}\);/);
  assert.match(target, /context\.ellipse\(ring\.x, ring\.y, ring\.rx, ring\.ry, 0, 0, Math\.PI \* 2\);/);
  assert.match(target, /context\.lineWidth = ring\.lineWidth;/);
});

/* ------------------------------------------------------------------ */
/* 4. Acceptance, over whole seeded bouts, frame by frame               */
/* ------------------------------------------------------------------ */

/** The camera module before this slice (76b9ca9, c2b5751's). It imports nothing, so it loads on its own. */
async function baseCameraModule() {
  let source;
  try {
    source = execFileSync("git", ["show", "76b9ca9:src/render/arena-backdrop.js"], { cwd: REPO_ROOT, encoding: "utf8" });
  } catch (error) {
    throw new Error(`the sweep needs read-only git history (commit 76b9ca9) at ${REPO_ROOT}: ${error.message}`, { cause: error });
  }
  assert.ok(!/^import /m.test(source));
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}
const deps = { ss2Combatant, ss2BattleValues };
function demoHost({ perSide, seed, kit = "" }) {
  const items = demoItemsFrom(kit);
  return createVanillaBattleHost({
    teams: [demoSide("red", perSide, { ...deps, items, seed }), demoSide("blue", perSide, { ...deps, items, seed })],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed
  });
}
/** The bout played bare — the rule set's own AI, nothing read off the host but what plays it: each action and the hash after it. */
function bareRun(bout) {
  const host = demoHost(bout);
  const trail = [];
  for (let taken = 0; !host.battle.result && taken < 4000; taken += 1) {
    const due = host.currentCombatantId();
    const action = { ...host.suggestAction(due), actorId: due };
    host.submit(action);
    trail.push(JSON.stringify([action, host.hash(), rngJournal(host.battle).length]));
  }
  return trail;
}
function yscaleOf(host, id) {
  const record = host.combatant(id);
  const built = ss2PhysicalSize(record);
  return resourceValue(record, "spell_colossus", 0) > 0 ? ss2ColossusYscaleAfter(built, 100)
    : resourceValue(record, "spell_little_fat_kid", 0) > 0 ? 50 : built;
}
const everyoneOf = (host) => host.wire().teams.flatMap((team) => team.combatants);
/** Every placed fighter as `placedActors()` hands him to the camera, at rest. */
function rosterOf(host) {
  return everyoneOf(host).filter((c) => Number.isFinite(c.x)).map((c) => {
    const placement = host.layout.placementFor(c.id);
    return {
      id: c.id, x: c.x, y: c.y, yscale: yscaleOf(host, c.id), ...actorSpanFor({ x: c.x, y: c.y }, null),
      side: placement?.side ?? null, teamId: placement?.teamId ?? null, alive: c.alive !== false, drawing: false
    };
  });
}
/** The same roster while the last action is DRAWN: each mover's span from where he was to where he is going. */
function drawnRoster(roster, was) {
  return roster.map((actor) => {
    const before = was?.find((one) => one.id === actor.id);
    if (!before || (before.x === actor.x && before.y === actor.y)) return actor;
    return { ...actor, xMin: Math.min(before.x, actor.x), xMax: Math.max(before.x, actor.x), yMin: Math.min(before.y, actor.y), yMax: Math.max(before.y, actor.y), drawing: true };
  });
}
function hudTopOf(host) {
  const layout = combatPanelLayoutFor({
    sides: host.wire().teams.map((team) => ({ teamId: team.id, ids: [...team.combatants].sort((a, b) => a.slotIndex - b.slotIndex).map((c) => c.id) })),
    pack: combatHudArtFor(undefined).pack
  });
  return layout.mode === "team" && Number.isFinite(layout.hudTop) ? layout.hudTop : null;
}
/** Where the page draws a fighter at rest and how big (`ringAnchorOf`: `figureScaleFor` of his drawn size and rank). */
const anchorOf = (host, c) => ({ x: c.x, y: c.y, size: figureScaleFor({
  yscale: yscaleOf(host, c.id), rank: rankOfDepth(c.y, c.slotIndex, { frontY: 200, rankStride: SS2_ARENA.rankStride }), slotIndex: c.slotIndex
}) });
/** A key label's width, stated (node has no canvas): 0.6 em a character of the words `paintRing` draws. */
const labelWidth = (button, px) => (button.verb === "item" ? button.key : `${button.key} ${RING_VERB_LABELS[button.verb]?.short ?? button.verb}`).length * px * 0.6;

/** How near the foot of the LOWEST of the six arenas' painted walls any framed depth stands (the painter's way). */
function wallClearance(camera, framed) {
  const crowd = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "crowd");
  let worst = Infinity;
  for (const wall of SS2_ARENA_WALL_BASE) {
    const foot = layerPlacementFor(crowd, { crowdY: -200 + Math.ceil(camera.zoomscale) }).y + wall.crowdY;
    for (const actor of framed) {
      for (const y of [actor.y, actor.yMin, actor.yMax].filter(Number.isFinite)) worst = Math.min(worst, arenaToStage(camera, { x: 0, y }).y - foot);
    }
  }
  return worst;
}
/** How far under the camera's HUD the lowest ink of any framed fighter lies (negative: above it). */
function inkUnderHud(camera, framed) {
  if (!Number.isFinite(camera.hudTop)) return -Infinity;
  let worst = -Infinity;
  for (const actor of framed) {
    const size = Math.abs(actor.yscale) / 100;
    const depth = Math.max(actor.y, actor.yMax ?? actor.y);
    worst = Math.max(worst, arenaToStage(camera, { x: 0, y: depth }).y + inkDepthAt(camera.zoomscale / 100, Math.min(size, camera.inkSize ?? size)) - camera.hudTop);
  }
  return worst;
}
/** Each framed fighter's fit margin (105 units either side of his span) off the visible stage, left and right. */
const marginsOff = (camera, framed) => framed.map((actor) => [
  SS2_CLOSE_UP.visible.left - arenaToStage(camera, { x: (actor.xMin ?? actor.x) - 105 }).x,
  arenaToStage(camera, { x: (actor.xMax ?? actor.x) + 105 }).x - SS2_CLOSE_UP.visible.right
]);
/** The ring `paintRing` draws at a camera — `ringPlacementFor` (`teamBout`: the fixed size, or the build's), the four builders — and kept on the stage. */
function pageRing(model, actor, camera, fit, { teamBout, packs = null, art = null }) {
  const view = stageProjectorFor(camera, fit);
  const stage = ringBoundsFor(fit, { barred: true });
  const placement = ringPlacementFor({ actor, camera, view, fit, teamBout });
  const head = fighterBoxFor({ footX: view.toX(actor.x), footY: view.toY(actor.y, 0), pxPerUnit: view.scale, size: actor.size }).y0;
  const below = view.toY(actor.y, -22) + Math.max(10, view.scale * 15) * 0.5;
  const layout = packs?.pack?.layout ?? null;
  const at = { centerX: placement.x, centerY: placement.y, unit: placement.unit, layout };
  const bounds = { top: stage.y, bottom: stage.y + stage.height };
  // With the player's packs, as `paintRing` does it: the eight drawn first, the row kept clear of their words.
  const eight = packs ? ringButtonArt(ringButtonsAt(model, at), art) : ringButtonsAt(model, at);
  const words = packs ? ringWordBoxesOf(eight) : [];
  const raw = [
    ...eight,
    ...ringItemButtonsAt(model, { ...at, rowLayout: packs?.pack?.inventory?.layout ?? null, head, bounds, words }),
    ...ringSwapButtonAt(model, at),
    ...ringMoveButtonsAt(model, { ...at, head, feet: below, bounds })
  ];
  return { raw, inside: ringButtonsInside(raw, stage, { fighterX: placement.x }), placement, words };
}
/** A greyed jump or charge (decision 9): drawn inert, and let stand off the stage (`ringUnderLabels`). */
const UNDER_LABELS = /^(jump|charge)(left|right)$/;
/** Walks drawn on the far side of the fighter they move (S4's gap): the centre on or past his. */
function wrongSideWalks(model, ring) {
  let wrong = 0;
  for (const move of model.moves.filter((one) => one.move === "walk-left" || one.move === "walk-right")) {
    const walk = ring.inside.find((button) => button.slot === (move.place === "slot" ? move.slot : move.move));
    if (walk && (move.move === "walk-left" ? -1 : 1) * (walk.x - ring.placement.x) <= 0) wrong += 1;
  }
  return wrong;
}

test("ACCEPTANCE, whole seeded team bouts frame by frame as the page steps them, every turn a person's or (play=red) blue's the AI's: the ring and every lit target framed with the margin at the ring's one size, needing no squeeze onto the stage (no walk on the wrong side: S4's gap closed); the fighters never framed worse, the HUD band and every arena's wall never worse than the fighters' camera; and every frame with no framing on or easing out the camera before this slice, to the byte", async (t) => {
  const base = await baseCameraModule();
  const fit = stageFitFor({ width: 640, height: 420 });
  const { visible } = SS2_CLOSE_UP;
  const { margin } = SS2_RING_FRAMING;
  const tally = { bouts: 0, turns: 0, aiTurns: 0, hovered: 0, settled: 0, unsettled: 0, identical: 0, identicalAi: 0, framedFrames: 0, zoomedOut: 0,
    panned: 0, s4Before: 0, s4After: 0, walks: 0, squeezedBefore: 0, frames: 0, litFramed: 0, labels: 0 };
  // `?play=` absent (every seat a person's, the arena's default) and `?play=red` (blue the AI's: its turns have no ring).
  for (const [perSide, kit, seed, play] of [[2, "", 1, null], [2, "tricks", 2, "red"], [3, "", 1, null], [3, "tricks", 1, null],
    [3, "buffs", 2, "red"], [3, "crowd", 1, null], [3, "blasts", 2, null]]) {
    const host = demoHost({ perSide, seed, kit });
    const bout = `${perSide}v${perSide} ${kit || "plain"} seed ${seed}${play ? ` play=${play}` : ""}`;
    const trail = [];
    let now = null;
    let before = null;
    let was = null;
    // Whether the action being drawn is an AI seat's.
    let aiDrawn = false;
    const step = (roster, options, where) => {
      now = stepFramedCamera(now, roster, options);
      before = base.stepFramedCamera(before, roster, { result: options.result, hudTop: options.hudTop });
      tally.frames += 1;
      const own = now.person ? now.person.base : now.camera;
      const drawn = now.camera;
      assert.ok(drawn.zoomscale <= own.zoomscale + 1e-9, `${where}: zoomed in past the fighters' camera`);
      assert.ok(inkUnderHud(drawn, now.framed) <= Math.max(0, inkUnderHud(own, now.framed)) + 1e-9, `${where}: ink under the HUD`);
      assert.ok(wallClearance(drawn, now.framed) >= Math.min(SS2_CLOSE_UP.wallMargin, wallClearance(own, now.framed)) - 1e-9, `${where}: nearer a wall`);
      const drawnOff = marginsOff(drawn, now.framed);
      marginsOff(own, now.framed).forEach(([left, right], index) => {
        assert.ok(drawnOff[index][0] <= Math.max(0, left) + 1e-9 && drawnOff[index][1] <= Math.max(0, right) + 1e-9,
          `${where}: ${now.framed[index].id} framed worse than the fighters' camera frames him`);
      });
      if (now.person) tally.framedFrames += 1;
      else {
        assert.equal(JSON.stringify(now), JSON.stringify(before), `${where}: no framing, the camera before this slice`);
        tally.identical += 1;
        if (aiDrawn) tally.identicalAi += 1;
      }
    };
    for (let taken = 0; !host.battle.result; taken += 1) {
      assert.ok(taken < 4000, `${bout} finished`);
      const roster = rosterOf(host);
      const hudTop = hudTopOf(host);
      const result = host.battle.result ?? null;
      const where = `${bout} turn ${taken}`;
      // The last action drawn, then the fighters at rest: no framing (the ring is not up while anything plays).
      for (let frame = 0; frame < 36; frame += 1) step(drawnRoster(roster, was), { result, hudTop }, `${where} drawn ${frame}`);
      for (let frame = 0; frame < 12; frame += 1) step(roster, { result, hudTop }, `${where} rest ${frame}`);
      was = roster;
      const everyone = everyoneOf(host);
      const actorId = host.currentCombatantId();
      const actor = anchorOf(host, everyone.find((c) => c.id === actorId));
      const legal = host.legalActions();
      const model = ringModelFor({ actorId, combatants: everyone, legal, previous: null, menuFor: (id) => host.unavailableActions(actorId, id) });
      const person = play === null || everyone.find((c) => c.id === actorId).teamId === play;
      if (!person) tally.aiTurns += 1;
      if (person && model.stance) {
        tally.turns += 1;
        // S4, BEFORE: the fighters' camera as it was, the ring at the build's own size, squeezed onto the stage.
        const was4 = pageRing(model, actor, before.camera, fit, { teamBout: false });
        if (was4.inside !== was4.raw) tally.squeezedBefore += 1;
        tally.s4Before += wrongSideWalks(model, was4);
        // The ring up, then (where one exists) a reach preview hovered: the first verb that lights anybody.
        const reach = [...model.slots, ...(model.items ?? [])].map((entry) => entry.action && ringReachFor(model, entry.action, { legal }))
          .find((one) => one && one.lit.length > 0) ?? null;
        const phases = [[]];
        if (reach) phases.push(reach.lit.map((one) => anchorOf(host, everyone.find((c) => c.id === one.foeId))));
        for (const lit of phases) {
          const framing = ringFramingFor({ model, actor, lit, fit, labelWidth });
          let last = null;
          for (let frame = 0; frame < 75; frame += 1) {
            last = now;
            step(roster, { result, hudTop, framing }, `${where} ${lit.length ? "hover" : "ring"} ${frame}`);
          }
          if (lit.length) tally.hovered += 1;
          const own = now.person.base;
          const lastOwn = last.person ? last.person.base : last.camera;
          if (Math.abs(own.zoomscale - lastOwn.zoomscale) + Math.abs(own.gladiatorsX - lastOwn.gladiatorsX) > 1e-3) { tally.unsettled += 1; continue; }
          tally.settled += 1;
          if (now.camera.zoomscale < own.zoomscale) tally.zoomedOut += 1;
          if (now.camera.gladiatorsX !== own.gladiatorsX) tally.panned += 1;
          // Everything framed, the margin in: the fighters' camera's pan never quite stops (it nears the dead zone by
          // a sixteenth a frame), and the framing trails it by a hair.
          for (const box of framing(now.camera)) {
            const off = Math.max(visible.left + margin - box.x0, box.x1 - (visible.right - margin), visible.top + margin - box.y0, box.y1 - (visible.bottom - margin));
            assert.ok(off <= 0.01, `${where}: a framed box ${off.toFixed(3)}px inside the margin — ${JSON.stringify(box)}`);
          }
          // Checked apart from the framing's own boxes, with the page's geometry: each key label where it stands,
          // and each lit foe — his box, his number unclamped, his gold ring — on the stage, the margin in.
          const inside = (box, what) => {
            const off = Math.max(visible.left + margin - box.x0, box.x1 - (visible.right - margin), visible.top + margin - box.y0, box.y1 - (visible.bottom - margin));
            assert.ok(off <= 0.01, `${where}: ${what} ${off.toFixed(3)}px inside the margin`);
          };
          const view = stageProjectorFor(now.camera, fit);
          for (const foe of lit) {
            const footX = view.toX(foe.x);
            const footY = view.toY(foe.y, 0);
            const body = fighterBoxFor({ footX, footY, pxPerUnit: view.scale, size: foe.size });
            const number = ringReachNumberAt(body, { scale: fit.scale, stage: null });
            const gold = ringTargetRingAt({ footX, footY, size: foe.size, scale: view.scale });
            inside(body, "a lit foe's body");
            inside({ x0: number.x - number.r, x1: number.x + number.r, y0: number.y - number.r, y1: number.y + number.r }, "a lit foe's number");
            inside({ x0: gold.x - gold.rx - gold.lineWidth / 2, x1: gold.x + gold.rx + gold.lineWidth / 2, y0: gold.y - gold.ry - gold.lineWidth / 2, y1: gold.y + gold.ry + gold.lineWidth / 2 }, "a lit foe's ring");
            tally.litFramed += 1;
          }
          // The page's own ring at this camera: one size, and nothing to squeeze — every walk on its side (S4).
          const ring = pageRing(model, actor, now.camera, fit, { teamBout: true });
          // Every button the page draws — but a greyed jump or charge, inert off the stage if it must be — with an
          // item place's letter over it.
          for (const button of ring.inside.filter((one) => !UNDER_LABELS.test(one.verb) || !one.reason)) {
            inside({ x0: button.x - button.r, x1: button.x + button.r, y0: button.y - button.r - (button.labelRoom ?? 0), y1: button.y + button.r }, `${button.slot}`);
          }
          for (const button of ring.inside.filter((one) => !one.move && !one.reason)) {
            const { px, gap } = ringLabelSizeFor(button.r);
            const size = { width: labelWidth(button, px), height: px, gap };
            inside(ringLabelBoxOf(ringLabelAt(button, ring.inside, size), size), `${button.slot}'s key label`);
            tally.labels += 1;
          }
          assert.ok(Math.abs(ring.placement.unit - fit.scale * 1.28) < 1e-12, `${where}: the ring's size ${ring.placement.unit}`);
          assert.equal(ring.inside, ring.raw, `${where}: the ring needed squeezing onto the stage`);
          tally.walks += model.moves.filter((one) => one.move === "walk-left" || one.move === "walk-right").length;
          tally.s4After += wrongSideWalks(model, ring);
        }
      }
      const due = host.currentCombatantId();
      aiDrawn = !(play === null || everyone.find((c) => c.id === due).teamId === play);
      const action = { ...host.suggestAction(due), actorId: due };
      host.submit(action);
      trail.push(JSON.stringify([action, host.hash(), rngJournal(host.battle).length]));
    }
    // Presentation only: reading every ring, reach and camera moved no action, no hash and no random draw.
    assert.deepEqual(trail, bareRun({ perSide, seed, kit }), `${bout}: the action and hash sequence`);
    tally.bouts += 1;
  }
  t.diagnostic(JSON.stringify(tally));
  assert.equal(tally.s4After, 0, "no walk on the wrong side of its fighter once the camera frames the ring");
  // The sweep reached what it is about: rings the old camera squeezed (and walks it put on the wrong side), reach
  // previews, frames the framing moved, and frames it had released back to the camera before this slice.
  assert.ok(tally.squeezedBefore > 100 && tally.s4Before > 0 && tally.hovered > 50 && tally.zoomedOut > 50 && tally.panned > 50
    && tally.aiTurns > 50 && tally.identicalAi > 1000 && tally.identical > 10000 && tally.unsettled * 20 < tally.settled
    && tally.litFramed > 200 && tally.labels > 1000, JSON.stringify(tally));
});

const ICONS_AT = new URL("../assets/icons/icons.json", import.meta.url);
const TEXT_AT = new URL("../assets/text/text.json", import.meta.url);

test("ON THE PLAYER'S OWN PACKS (gated): the framing is built as the page builds it — the pack's measured slots, the build's words on the eight (BOMBARD over the archer's) — and at the settled camera every word the page paints, and its whole ring, stand on the stage with the margin", (t) => {
  if (!fs.existsSync(ICONS_AT) || !fs.existsSync(TEXT_AT)) {
    t.skip("no extracted icons or text pack in this tree (a fresh clone draws no build word): run node tools/extract-icons.mjs and node tools/extract-text.mjs");
    return;
  }
  const packs = { pack: actionButtonPackFrom(JSON.parse(fs.readFileSync(ICONS_AT, "utf8"))), textPack: textPackFrom(JSON.parse(fs.readFileSync(TEXT_AT, "utf8"))) };
  if (!packs.pack?.layout) {
    t.skip("the icons pack predates its buttons section: run node tools/extract-icons.mjs");
    return;
  }
  const fit = stageFitFor({ width: 640, height: 420 });
  const { visible } = SS2_CLOSE_UP;
  const { margin } = SS2_RING_FRAMING;
  const tally = { turns: 0, settled: 0, words: 0, bombards: 0 };
  for (const [perSide, kit, seed] of [[3, "", 1], [3, "tricks", 1]]) {
    const host = demoHost({ perSide, seed, kit });
    const trail = [];
    let now = null;
    for (let taken = 0; !host.battle.result; taken += 1) {
      assert.ok(taken < 4000);
      const roster = rosterOf(host);
      const hudTop = hudTopOf(host);
      const result = host.battle.result ?? null;
      for (let frame = 0; frame < 48; frame += 1) now = stepFramedCamera(now, roster, { result, hudTop });
      const everyone = everyoneOf(host);
      const actorId = host.currentCombatantId();
      const actor = anchorOf(host, everyone.find((c) => c.id === actorId));
      const model = ringModelFor({ actorId, combatants: everyone, legal: host.legalActions(), previous: null, menuFor: (id) => host.unavailableActions(actorId, id) });
      if (model.stance) {
        tally.turns += 1;
        // `ringFrameWords`: the eight's art at the ring's one size, off its centre.
        const record = host.combatant(actorId);
        const art = { pack: packs.pack, facing: model.stance?.facing ?? "right", psyche: resourceValue(record, "psyche_up", 1), ammo: resourceValue(record, "ammo_left", 0), textPack: packs.textPack };
        const words = ringWordBoxesOf(ringButtonArt(ringButtonsAt(model, { centerX: 0, centerY: 0, unit: fit.scale * 1.28, layout: packs.pack.layout }), art));
        const framing = ringFramingFor({ model, actor, fit, layout: packs.pack.layout, rowLayout: packs.pack.inventory?.layout ?? null, words, labelWidth });
        let last = null;
        for (let frame = 0; frame < 75; frame += 1) { last = now; now = stepFramedCamera(now, roster, { result, hudTop, framing }); }
        const own = now.person.base;
        const lastOwn = last.person ? last.person.base : last.camera;
        if (Math.abs(own.zoomscale - lastOwn.zoomscale) + Math.abs(own.gladiatorsX - lastOwn.gladiatorsX) <= 1e-3) {
          tally.settled += 1;
          const ring = pageRing(model, actor, now.camera, fit, { teamBout: true, packs, art });
          assert.equal(ring.inside, ring.raw, `turn ${taken}: the ring needed squeezing onto the stage`);
          for (const button of ring.inside.filter((one) => !UNDER_LABELS.test(one.verb) || !one.reason)) {
            const off = Math.max(visible.left + margin - (button.x - button.r), button.x + button.r - (visible.right - margin),
              visible.top + margin - (button.y - button.r - (button.labelRoom ?? 0)), button.y + button.r - (visible.bottom - margin));
            assert.ok(off <= 0.01, `turn ${taken}: ${button.slot} ${off.toFixed(3)}px inside the margin`);
          }
          for (const word of ring.words) {
            const off = Math.max(visible.left + margin - word.x0, word.x1 - (visible.right - margin), visible.top + margin - word.y0, word.y1 - (visible.bottom - margin));
            assert.ok(off <= 0.01, `turn ${taken}: ${word.slot}'s ${word.word} ${off.toFixed(3)}px inside the margin`);
            tally.words += 1;
            if (/^bombard/.test(word.verb)) tally.bombards += 1;
          }
        }
      }
      const due = host.currentCombatantId();
      const action = { ...host.suggestAction(due), actorId: due };
      host.submit(action);
      trail.push(JSON.stringify([action, host.hash(), rngJournal(host.battle).length]));
    }
    assert.deepEqual(trail, bareRun({ perSide, seed, kit }), `${perSide}v${perSide} ${kit || "plain"} seed ${seed}: the action and hash sequence`);
  }
  t.diagnostic(JSON.stringify(tally));
  assert.ok(tally.settled > 100 && tally.words > 100 && tally.bombards > 5, JSON.stringify(tally));
});
