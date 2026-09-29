/**
 * THE IN-FRAME TEAM HUD'S WIRING DECISIONS (wave 3, `tools/arena/combat-hud.js`):
 * what `tools/arena/main.js` asks before it paints the build's own gauges in
 * the stage — which readings a cluster shows while a blow is still in the air
 * (D6), what the camera is handed (D3), where the ring may stand (D4), how
 * much of the fitted view the band takes, which art is drawn and why, and the
 * line that says so. Every decision is here, pure, so the shell only paints.
 *
 * The HUD model rows are `teamHudFor`'s (`tools/arena/team-hud.js`); the
 * layout and ops are `src/render/combat-panel.js`'s, under
 * `test/render-combat-panel.test.js`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { combatPanelFallbackOpsFor, combatPanelLayoutFor, combatPanelOpsFor, combatPanelPackFrom } from "../src/render/combat-panel.js";
import { inkDepthAt, stageClipRectFor, stageFitFor } from "../src/render/arena-backdrop.js";
import { ringButtonsInside } from "../tools/arena/ring-layout.js";
import { rankOfDepth, viewportFor } from "../src/render/arena-shell.js";
import { figureScaleFor } from "../src/render/figure.js";
import { SS2_FIGURE_HEIGHT } from "../src/render/painter.js";
import { textPackFrom } from "../src/render/text.js";
import { ARENA_VISUAL_PACKS, assetGateReport } from "../tools/arena/asset-gate.js";
import {
  cameraYscaleFor,
  combatHudArtFor,
  combatHudFrameFor,
  combatHudInvoiceFor,
  combatHudProvenanceFor,
  createCombatHudOps,
  fittedViewFor,
  gaugeHoldFor,
  heldHudFor,
  ringBoundsFor
} from "../tools/arena/combat-hud.js";

const reading = (value, max, shown = true) => Object.freeze({ value, max, percent: max > 0 ? Math.round((value / max) * 100) : 0, shown });
/** One `teamHudFor` row, as the model builds it. */
const row = (id, overrides = {}) => Object.freeze({
  id, name: id.toUpperCase(), teamId: id.split("-")[0], colour: id.startsWith("red") ? "#e0584f" : "#4c8fe0",
  acting: false, alive: true, seat: null, you: false,
  health: reading(100, 100), energy: reading(60, 60), armour: reading(10, 20), conditions: Object.freeze([]),
  ...overrides
});
/** A `teamHudFor` result holding these rows, red then blue. */
const hudOf = (...rows) => Object.freeze({
  actingId: null,
  teams: Object.freeze(["red", "blue"].map((teamId) => Object.freeze({
    teamId, name: teamId, colour: "#000", standing: 0, rows: Object.freeze(rows.filter((one) => one.teamId === teamId))
  })))
});
const rowsOf = (hud) => new Map(hud.teams.flatMap((team) => team.rows).map((one) => [one.id, one]));
/** A pop-up as `spawnPopups` in `tools/arena/main.js` records it: the popup and when it starts. */
const popupOn = (combatantId, startedAt) => ({ popup: { combatantId, kind: "damage" }, startedAt, maxscale: 80 });

test("D6: A GAUGE DOES NOT DRAIN BEFORE THE BLOW LANDS — each fighter's readings hold at their pre-step values until his first pop-up of the step starts", () => {
  // red-1 swings (his energy 60 -> 50, no pop-up on him); blue-1 is hit (80 -> 55), his damage
  // pop-up starting with his hurt clip at 1400 and a second one (a status splat) at 1500.
  const before = hudOf(row("red-1"), row("blue-1", { health: reading(80, 80) }));
  const after = hudOf(row("red-1", { energy: reading(50, 60) }), row("blue-1", { health: reading(55, 80) }));
  const hold = gaugeHoldFor({ before, after, popups: [popupOn("blue-1", 1500), popupOn("blue-1", 1400)], tokens: [7] });

  const at = (now, pendingTokens) => rowsOf(heldHudFor(after, hold, { now, pendingTokens }));
  // The step has just been submitted: the wire already holds the blow, the screen does not yet.
  let shown = at(1000, [7]);
  assert.deepEqual(shown.get("blue-1").health, reading(80, 80), "the victim's vial is still full while the swing plays");
  assert.deepEqual(shown.get("red-1").energy, reading(60, 60), "and the attacker's energy has not been spent on screen");
  // His FIRST pop-up starts (1400, not the 1500 one): his gauge drains with it.
  shown = at(1400, [7]);
  assert.deepEqual(shown.get("blue-1").health, reading(55, 80), "the vial drains when the first pop-up on him starts");
  assert.deepEqual(shown.get("red-1").energy, reading(60, 60), "a pop-up on someone else releases nobody else");
  // No pop-up concerns the attacker: his reading waits for the step to settle — every token reported.
  shown = at(1600, [7]);
  assert.deepEqual(shown.get("red-1").energy, reading(60, 60), "still unsettled: still held");
  shown = at(1600, []);
  assert.deepEqual(shown.get("red-1").energy, reading(50, 60), "the step settled: the wire's reading");
  assert.deepEqual(shown.get("blue-1").health, reading(55, 80));
});

test("D6: the step settles when EVERY token it carried is reported, a step with none has settled already, and a settle releases a pop-up still to come", () => {
  const before = hudOf(row("red-1"), row("blue-1"));
  const after = hudOf(row("red-1", { energy: reading(40, 60) }), row("blue-1", { health: reading(70, 100) }));
  const two = gaugeHoldFor({ before, after, popups: [popupOn("blue-1", 5000)], tokens: [3, 4] });
  assert.deepEqual(rowsOf(heldHudFor(after, two, { now: 100, pendingTokens: [4] })).get("red-1").energy, reading(60, 60),
    "one of two tokens reported is not a settled step");
  const settled = rowsOf(heldHudFor(after, two, { now: 100, pendingTokens: [9] }));
  assert.deepEqual(settled.get("red-1").energy, reading(40, 60), "both reported: settled");
  // The pop-up is no gate (nothing in the build waits on one); a gauge never lags past its step.
  assert.deepEqual(settled.get("blue-1").health, reading(70, 100), "settled before his pop-up: released with the step");
  const none = gaugeHoldFor({ before, after, popups: [], tokens: [] });
  assert.deepEqual(rowsOf(heldHudFor(after, none, { now: 0, pendingTokens: [1, 2] })).get("red-1").energy, reading(40, 60),
    "a step that carried no token has nothing to wait for");
});

test("D6: a fall is held with the blow — the cluster does not fade before the killing pop-up — and what did not change, or has no row before, is not held", () => {
  const before = hudOf(row("red-1"), row("blue-1", { health: reading(12, 100) }), row("blue-2"));
  const after = hudOf(
    row("red-1", { energy: reading(55, 60), acting: false }),
    row("blue-1", { health: reading(0, 100), alive: false }),
    row("blue-2", { acting: true }),
    row("blue-3", { health: reading(1, 100) })
  );
  const hold = gaugeHoldFor({ before, after, popups: [popupOn("blue-1", 900)], tokens: [1] });
  const early = rowsOf(heldHudFor(after, hold, { now: 800, pendingTokens: [1] }));
  assert.equal(early.get("blue-1").alive, true, "not faded before the blow lands");
  assert.deepEqual(early.get("blue-1").health, reading(12, 100));
  assert.equal(early.get("blue-2").acting, true, "whose turn it is is the wire's, as the side panel and the strip say");
  assert.deepEqual(early.get("blue-3").health, reading(1, 100), "a fighter with no row before is shown as the wire has him");
  const late = rowsOf(heldHudFor(after, hold, { now: 900, pendingTokens: [1] }));
  assert.equal(late.get("blue-1").alive, false, "faded with the killing pop-up");
  assert.deepEqual(Object.keys(hold.fighters).sort(), ["blue-1", "red-1"], "only the fighters the step changed are held");
  // No hold at all (the bout's first frame): the wire as it is.
  assert.equal(heldHudFor(after, null, { now: 0, pendingTokens: [1] }), after);
});

/* ------------------------------------------------------------------ */
/* The pack a test draws with: the extractor's own shape, squares for art */
/* ------------------------------------------------------------------ */

/**
 * A clean `gauges` section in `tools/extract-icons.mjs`'s shape — the same
 * entries, names, masks, rest matrices and placements as the build's, with
 * squares for art (`syntheticIcons` in `test/render-combat-panel.test.js`,
 * copied: that file exports nothing). `combatPanelPackFrom` accepts it.
 */
function syntheticIcons() {
  const square = (fill) => ({ bounds: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 }, paths: [{ d: "M0 0L10 0L10 10L0 10Z", fill, fillOpacity: 1 }] });
  const glow = (red, green, blue) => [{ type: "glow", colour: { red, green, blue, alpha: 255 }, blurX: 2, blurY: 2, strength: 10,
    inner: false, knockout: false, compositeSource: true, passes: 1 }];
  const bevel = [{ type: "bevel", highlightColour: { red: 255, green: 255, blue: 255, alpha: 255 }, shadowColour: { red: 160, green: 96, blue: 1, alpha: 255 },
    blurX: 0, blurY: 0, angle: 0.785, distance: -6, strength: 1, inner: true, knockout: false, compositeSource: true, onTop: false, passes: 1 }];
  const entry = (character, placements) => ({ character, frames: [placements], declaredFrames: 1, effectGroups: [] });
  const shapeAt = (character) => ({ kind: "shape", character, matrix: [1, 0, 0, 1, 0, 0] });
  const textAt = (character, tx, ty, filters) => ({ kind: "text", character, matrix: [1, 0, 0, 1, tx, ty], filters });
  const liquidAt = (character, tx, ty, mask) => ({ kind: "clip", character, matrix: [1, 0, 0, 1, tx, ty], name: "blood_health",
    frameCount: 1, mask: { shape: mask, matrix: [1, 0, 0, 1, 0, 0] } });
  const gaugeRow = (side, readingName, instance, depth, character, matrix) => ({ kind: "gauge", side, reading: readingName, instance, depth, character, matrix });
  const shapes = {};
  for (const [id, fill] of [[51, "#ffcc00"], [726, "#ffffff"], [727, "#000000"], [728, "#cc0000"], [730, "#dddddd"],
    [736, "#000000"], [737, "#0000cc"], [739, "#dddddd"], [743, "#000099"], [744, "#808080"], [746, "#795520"]]) {
    shapes[id] = square(fill);
  }
  const field = (id, xMin, xMax, colour, align = "center") => ({ id, kind: "edit-text", bounds: { xMin, xMax, yMin: -2, yMax: 21.15 },
    fontId: 118, fontHeight: 14, colour, align });
  const label = (id, xMin, xMax) => ({ id, kind: "static-text", bounds: { xMin, xMax, yMin: 0.45, yMax: 12.4 }, colour: null });
  const white = { red: 255, green: 255, blue: 255, alpha: 255 };
  return {
    icons: {}, nested: {},
    shapes,
    texts: {
      731: field(731, -2, 79.6, white), 740: field(740, -2, 79.6, white),
      747: field(747, -2, 79.6, { red: 255, green: 255, blue: 0, alpha: 255 }),
      732: label(732, 17.7, 66.4), 741: label(741, 18.35, 65.75), 748: label(748, 15.6, 68.55),
      734: { ...field(734, 66.9, 347.35, white, "left"), fontId: 53, bounds: { xMin: 66.9, xMax: 347.35, yMin: -2, yMax: 18.8 } },
      735: { ...field(735, 66.9, 347.35, white, "right"), fontId: 53, bounds: { xMin: 66.9, xMax: 347.35, yMin: -2, yMax: 18.8 } }
    },
    gauges: {
      clips: {
        52: entry(52, [shapeAt(51)]),
        733: entry(733, [shapeAt(726), liquidAt(729, -484, -531, 727), shapeAt(730),
          textAt(731, -776, -55, glow(0, 0, 0)), textAt(732, -781, 510, glow(153, 0, 0))]),
        742: entry(742, [shapeAt(726), liquidAt(738, -484, -531, 736), shapeAt(739),
          textAt(740, -776, -75, glow(0, 0, 0)), textAt(741, -789, 516, glow(0, 0, 102))]),
        749: entry(749, [liquidAt(745, -494, -561, 743), shapeAt(746),
          textAt(747, -786, -300, glow(0, 0, 0)), textAt(748, -781, 520, glow(51, 51, 51))])
      },
      nested: { 729: entry(729, [shapeAt(728)]), 738: entry(738, [shapeAt(737)]), 745: entry(745, [shapeAt(744)]) },
      placements: [
        { kind: "banner", side: "villain", depth: 1, character: 52, matrix: [-1.99998, 0, 0, 1.99998, 7019, 1925], filters: bevel },
        { kind: "banner", side: "hero", depth: 7, character: 52, matrix: [-1.99998, 0, 0, 1.99998, -1439, 1925], filters: bevel },
        gaugeRow("villain", "health", "villain_potion", 9, 733, [1, 0, 0, 1, 10700, 933]),
        { kind: "name", side: "hero", variable: "herotext", align: "left", depth: 18, character: 734, matrix: [1, 0, 0, 1, -1199, 1704], filters: glow(0, 0, 0) },
        gaugeRow("hero", "health", "hero_potion", 19, 733, [1, 0, 0, 1, 2035, 933]),
        { kind: "name", side: "villain", variable: "villaintext", align: "right", depth: 28, character: 735, matrix: [1, 0, 0, 1, 5652, 1704], filters: glow(0, 0, 0) },
        gaugeRow("villain", "energy", "villain_stamina_potion", 29, 742, [1, 0, 0, 1, 12054, 933]),
        gaugeRow("hero", "energy", "hero_stamina_potion", 38, 742, [1, 0, 0, 1, 704, 933]),
        gaugeRow("hero", "armour", "hero_armour", 47, 749, [1, 0, 0, 1, 3410, 934]),
        gaugeRow("villain", "armour", "villain_armour", 55, 749, [1, 0, 0, 1, 9478, 923])
      ],
      attach: { linkage: "combat_panel", target: "_root.arena", depth: 200000, init: { _x: -320, _y: 122 },
        parentPlacement: { depth: 59, name: "arena", matrix: [1, 0, 0, 1, 6399, 3335], frames: [221, 226] }, origin: { x: -0.05, y: 288.75 } },
      drive: { base: -30, full: 101, step: 0.7, percentScale: 100, rounding: "round", separator: " / " },
      disagreements: [],
      problems: []
    }
  };
}

/** `n` red and `m` blue fighters, slot order, as `teamHudFor` rows. */
const bout = (n, m) => hudOf(
  ...Array.from({ length: n }, (_, index) => row(`red-${index + 1}`)),
  ...Array.from({ length: m }, (_, index) => row(`blue-${index + 1}`))
);
const near = (actual, expected, message, epsilon = 0.005) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} against ${expected}`);

test("D3: THE CAMERA IS HANDED hudTop IN A TEAM BOUT ONLY — a 1v1 is the build's own panel under the build's own camera", () => {
  // The fallback's worked tops (gauges report, verify:gauges-r3): 302.90 a pair, 329.73 at two a side, 354.52 at three.
  const pair = combatHudFrameFor({ hud: bout(1, 1), pack: null });
  assert.equal(pair.layout.mode, "pair");
  near(pair.layout.hudTop, 302.90, "the pair's panel still has a top");
  assert.equal(pair.cameraHudTop, null, "but the build's own camera never reads it");
  for (const [n, m, top] of [[2, 2, 329.73], [3, 3, 354.52], [1, 2, 329.73], [3, 1, 354.52]]) {
    const frame = combatHudFrameFor({ hud: bout(n, m), pack: null });
    assert.equal(frame.layout.mode, "team", `${n}v${m}: either side with two or more is a team bout`);
    near(frame.cameraHudTop, top, `${n}v${m}: the camera stands to the band's top`);
    assert.equal(frame.cameraHudTop, frame.layout.hudTop);
  }
});

test("D2: one cluster per fighter, each handed HIS row — red from the left in slot order, blue from the right — laid out with the art it will be drawn with", () => {
  const hud = hudOf(row("red-1", { name: "Vasso" }), row("red-2", { name: "Nym" }), row("blue-1", { name: "Brutus" }), row("blue-2", { name: "Crixus" }));
  const frame = combatHudFrameFor({ hud, pack: null });
  assert.deepEqual(frame.clusters.map(({ cluster, reading: shown }) => [cluster.id, cluster.side, cluster.slot, shown.name]),
    [["red-1", "hero", 1, "Vasso"], ["red-2", "hero", 2, "Nym"], ["blue-1", "villain", 1, "Brutus"], ["blue-2", "villain", 2, "Crixus"]]);
  const [red1, red2, blue1, blue2] = frame.clusters.map(({ cluster }) => cluster);
  assert.ok(red1.box.xMin < red2.box.xMin && blue2.box.xMax < blue1.box.xMax, "slot 1 at each side's own edge");
  // The build's glass reaches 3.6 px higher than the fallback's vial (a pair: 299.30 against 302.90): the
  // top the camera is handed must be that of the art the clusters are drawn with.
  const pack = combatPanelPackFromSynthetic();
  const drawn = combatHudFrameFor({ hud, pack });
  const sides = [{ teamId: "red", ids: ["red-1", "red-2"] }, { teamId: "blue", ids: ["blue-1", "blue-2"] }];
  assert.equal(drawn.cameraHudTop, combatPanelLayoutFor({ sides, pack }).hudTop, "laid out with the pack");
  assert.notEqual(drawn.cameraHudTop, frame.cameraHudTop, "and the pack's top is not the fallback's");
});

/** The synthetic pack, read by the renderer's own reader. */
function combatPanelPackFromSynthetic() {
  const pack = combatPanelPackFrom(syntheticIcons());
  assert.ok(pack, "the synthetic section is a pack the renderer accepts");
  return pack;
}

test("THE CAMERA IS FED THE SIZE ON SCREEN (the camera verifiers' caller-feed defect): the larger of the scene's _yscale and the drawn one, while a rescale is pending", () => {
  // The scene jumps to a colossus's post-cast or post-expiry size at once; the figure keeps drawing
  // the old size (`figureYscaleAt`), and a growth OVERSHOOTS on screen: 100 -> 175 -> 138 -> ... -> 150.
  assert.equal(cameraYscaleFor(86, 86), 86, "nothing pending: the one size");
  assert.equal(cameraYscaleFor(150, 100), 150, "a growth cast, not yet drawn: the size he is growing to");
  assert.equal(cameraYscaleFor(150, 175), 175, "the growth's overshoot, drawn past the scene's 150");
  assert.equal(cameraYscaleFor(100, 150), 150, "an expiry the scene has taken and the figure has not: still drawn at 150");
  assert.equal(cameraYscaleFor(50, 86), 86, "a little fat kid's victim before his clip shrinks him");
  for (const drawn of [null, undefined, Number.NaN]) assert.equal(cameraYscaleFor(86, drawn), 86, `no drawn size (${drawn}): the scene's`);
});

test("D4: THE RING STANDS ON THE VISIBLE STAGE ABOVE THE UI BAR — stage y 1..398 (SS2_CLOSE_UP.visible), not the whole 0..420 the frame is clipped to", () => {
  // A 640x420 canvas: the stage at scale 1. The border and the UI bar leave x 0..639, y 1..398 visible.
  const flat = stageFitFor({ width: 640, height: 420 });
  assert.deepEqual({ ...ringBoundsFor(flat, { barred: true }) }, { x: 0, y: 1, width: 639, height: 397 });
  // Letterboxed (the arena's own 870x688): scale 1.359375, 58.53125 of bar above — worked by hand:
  // top 58.53125 + 1.359375, bottom 58.53125 + 398 x 1.359375, right 639 x 1.359375.
  const tall = stageFitFor({ width: 870, height: 688 });
  const bounds = ringBoundsFor(tall, { barred: true });
  near(bounds.x, 0, "left", 1e-9);
  near(bounds.y, 59.890625, "top", 1e-9);
  near(bounds.x + bounds.width, 868.640625, "right", 1e-9);
  near(bounds.y + bounds.height, 599.5625, "bottom: the UI bar's top", 1e-9);
  // Never outside the rectangle the frame is clipped to (whole device pixels, `stageClipRectFor`).
  const clip = stageClipRectFor(tall);
  assert.ok(bounds.x >= clip.x && bounds.y >= clip.y && bounds.x + bounds.width <= clip.x + clip.width &&
    bounds.y + bounds.height <= clip.y + clip.height, "inside the clip");
  // A small canvas whose letterbox falls on a fractional pixel: the clip is snapped to 11, and the
  // visible stage's top (10.6 + 1 x 0.3 = 10.9) would stand above it — the clip wins.
  const small = stageFitFor({ width: 192, height: 147.2 });
  near(small.offsetY, 10.6, "the letterbox", 1e-9);
  assert.equal(stageClipRectFor(small).y, 11);
  near(ringBoundsFor(small, { barred: true }).y, 11, "never above the clip", 1e-9);
  // The FITTED view draws no bar and no border: its ring keeps the whole clipped stage, as before.
  assert.deepEqual({ ...ringBoundsFor(tall, { barred: false }) }, { ...clip });
  // The pre-existing defect it closes (wave 1): at pair zooms >= 84 the rank-front arrow sat UNDER the
  // bar. A button reaching stage y 415 is kept at 0..420 and brought above the bar at 1..398.
  const arrow = [{ x: 320, y: 405, r: 10 }];
  assert.equal(ringButtonsInside(arrow, stageClipRectFor(flat))[0].y, 405, "the old bounds let it sit under the bar");
  assert.equal(ringButtonsInside(arrow, ringBoundsFor(flat, { barred: true }))[0].y, 388, "the visible stage lifts it clear: 398 - 10");
});

test("THE FITTED VIEW RESERVES THE BAND IT DRAWS, INSIDE THE STAGE IT IS CLIPPED TO: the letterbox adds no layout, the band stays clear — in a 1v1 too — and no HUD is what it was", () => {
  const team = combatHudFrameFor({ hud: bout(3, 3), pack: null });
  const actors = [{ x: -450, y: 200 }, { x: -300, y: 103 }, { x: -150, y: 6 }, { x: 150, y: 6 }, { x: 300, y: 103 }, { x: 450, y: 200 }];
  const viewAt = (width, height, frame = team, clipped = true) =>
    fittedViewFor({ width, height, fit: stageFitFor({ width, height }), frame, actors, frontY: 200, clipped });
  // The stage's own canvas: the band's top is its top on the stage (354.52), and every fighter's feet
  // and ink stand above it — `viewportFor`'s own reserve arithmetic, over the canvas above the band.
  const own = viewAt(640, 420);
  near(own.floor, team.cameraHudTop, "laid out down to the band's top", 1e-9);
  near(own.toY(200, 0), own.ground, "the front rank's feet on its ground", 1e-9);
  assert.ok(own.ground + inkDepthAt(own.scale, 1.5) <= own.floor, "a colossus's shadow and plate above the band");

  // CODEX PASS 1 (reproduced): the frame is clipped to the LETTERBOXED stage, and this view was laid out
  // from the canvas's top. On a 640x600 canvas the stage runs 90..510, the band's top is at 90 + 354.52,
  // and the old composition — `viewportFor` over the whole canvas, reserving everything under the band —
  // stood the back rank's crown above the clipped top: highest crown 58.78 against 90.
  const tall = stageFitFor({ width: 640, height: 600 });
  const band = tall.offsetY + tall.scale * team.cameraHudTop;
  const old = viewportFor({ width: 640, height: 600, frontY: 200, actors, reserveBottom: 600 - band });
  const crownOf = (view) => Math.min(...actors.map((one) => view.toY(one.y, SS2_FIGURE_HEIGHT * figureScaleFor({
    yscale: 86, rank: rankOfDepth(one.y, 0, { frontY: 200, rankStride: 97 }), slotIndex: 0 }))));
  const oldView = { toY: (y, lift) => old.ground - (200 - y) * old.scale * 1.7 - lift * old.scale };
  near(crownOf(oldView), 58.78, "the old composition's highest crown");
  // Laid out inside the stage it is clipped to, the letterboxed canvas draws what the stage's own draws, 90 lower.
  const shifted = viewAt(640, 600);
  assert.equal(shifted.scale, own.scale, "the letterbox adds no layout");
  for (const one of actors) {
    for (const lift of [0, 100, 222.65]) near(shifted.toY(one.y, lift), 90 + own.toY(one.y, lift), `y ${one.y} lift ${lift}`, 1e-9);
    near(shifted.toX(one.x), own.toX(one.x), `x ${one.x}`, 1e-9);
  }
  near(shifted.horizon, 90 + own.horizon, "the horizon too", 1e-9);
  near(crownOf(shifted), 90 + crownOf(own), "its crowns are the stage's own");
  assert.ok(crownOf(shifted) > crownOf(oldView) + 19, "20 px lower than the old composition put them");
  // `?clip=0` draws the whole canvas: then the whole canvas above the band is the layout.
  const unclipped = viewAt(640, 600, team, false);
  near(unclipped.floor, band, "unclipped: the canvas above the band", 1e-9);
  near(unclipped.toY(200, 0), old.ground, "which is the old composition", 1e-9);

  // RE-PINNED 2026-09-25 (the wave-3 verifier): a 1v1 used to be exempt here because its STAGE camera
  // is the build's own (cameraHudTop null) — but the fitted view has no build camera, and the 1v1
  // clusters are drawn all the same, over the fighters' legs (-73 px at 640x420). It reserves its band.
  // Mutation: key fittedViewFor on frame.cameraHudTop again -> red.
  const pair = combatHudFrameFor({ hud: bout(1, 1), pack: null });
  assert.equal(pair.cameraHudTop, null, "the stage camera still ignores a 1v1's band");
  const duel = [{ x: -250, y: 200 }, { x: 250, y: 200 }];
  const duelView = fittedViewFor({ width: 640, height: 420, fit: stageFitFor({ width: 640, height: 420 }), frame: pair, actors: duel, frontY: 200 });
  near(duelView.floor, pair.layout.hudTop, "a 1v1's fitted view is laid out down to its band's top", 1e-9);
  assert.ok(duelView.ground + inkDepthAt(duelView.scale, 1.5) <= duelView.floor, "its fighters' ink above the band");

  // No HUD this frame: the fitted view before the HUD, to the number.
  for (const [width, height] of [[640, 420], [640, 600], [1000, 420]]) {
    const plain = viewportFor({ width, height, frontY: 200, actors });
    for (const frame of [null]) {
      const view = viewAt(width, height, frame);
      assert.deepEqual([view.scale, view.horizon], [plain.scale, plain.horizon], `${width}x${height}: unchanged`);
      near(view.toY(103, 50), plain.horizon + (height - plain.horizon) * 0.62 - 97 * plain.scale * 1.7 - 50 * plain.scale, "toY as it was", 1e-9);
      near(view.toX(-300), width / 2 - 300 * plain.scale, "toX as it was", 1e-9);
    }
  }
});

test("CODEX PASS 2: IN A TEAM BOUT THE FITTED VIEW FITS EVERY FIGHTER BETWEEN THE STAGE'S TOP AND THE BAND — the back ranks' crowns too, which viewportFor alone does not fit", () => {
  // Reproduced: at the stage's own 640x420 a 3v3's back rank stood its crown at 34.26 before the HUD and
  // at -11.32 once the band was reserved — `viewportFor`'s vertical bound fits the FRONT rank's crown only.
  const rosters = {
    "2v2": [{ x: -300, y: 200 }, { x: -150, y: 103 }, { x: 150, y: 103 }, { x: 300, y: 200 }],
    "3v3": [{ x: -450, y: 200 }, { x: -300, y: 103 }, { x: -150, y: 6 }, { x: 150, y: 6 }, { x: 300, y: 103 }, { x: 450, y: 200 }],
    "3v3, a colossus at the back": [{ x: -450, y: 200 }, { x: -300, y: 103 }, { x: -150, y: 6, yscale: 150 }, { x: 150, y: 6 }, { x: 300, y: 103 }, { x: 450, y: 200 }]
  };
  const sizeOf = (one) => figureScaleFor({ yscale: one.yscale ?? 86, rank: rankOfDepth(one.y, 0, { frontY: 200, rankStride: 97 }), slotIndex: 0 });
  const crownOf = (view, actors) => Math.min(...actors.map((one) => view.toY(one.y, SS2_FIGURE_HEIGHT * sizeOf(one))));
  const before = viewportFor({ width: 640, height: 420, frontY: 200, actors: rosters["3v3"].map((one) => ({ ...one, yscale: 86 })) });
  near(before.ground - 194 * before.scale * 1.7 - SS2_FIGURE_HEIGHT * sizeOf({ y: 6 }) * before.scale, 34.26, "before the HUD: the back crown inside");
  let fitted = 0;
  for (const [label, roster] of Object.entries(rosters)) {
    const actors = roster.map((one) => ({ ...one, yscale: one.yscale ?? 86 }));
    const frame = combatHudFrameFor({ hud: label === "2v2" ? bout(2, 2) : bout(3, 3), pack: null });
    for (const [width, height] of [[640, 420], [640, 600], [800, 420], [1000, 420], [640, 800]]) {
      const fit = stageFitFor({ width, height });
      const clip = stageClipRectFor(fit);
      const band = fit.offsetY + fit.scale * frame.cameraHudTop;
      const view = fittedViewFor({ width, height, fit, frame, actors, frontY: 200, rankStride: 97 });
      const where = `${label} on ${width}x${height}`;
      assert.ok(crownOf(view, actors) >= clip.y - 1e-9, `${where}: every crown on the stage (${crownOf(view, actors)} against ${clip.y})`);
      assert.ok(view.ground + inkDepthAt(view.scale, 1.5) <= band + 1e-9, `${where}: the front rank's ink above the band`);
      near(view.toX(0), width / 2, `${where}: centred on the canvas, whatever width the scale was fitted to`, 1e-9);
      for (const one of actors) {
        const x = view.toX(one.x);
        assert.ok(x >= 0 && x <= width, `${where}: x ${one.x} on the canvas`);
      }
      const unfitted = viewportFor({ width, height: clip.height, frontY: 200, actors, reserveBottom: clip.y + clip.height - band });
      assert.ok(view.scale <= unfitted.scale + 1e-12, `${where}: it only ever pulls back`);
      if (view.scale < unfitted.scale - 1e-9) {
        fitted += 1;
        assert.ok(crownOf(view, actors) - clip.y < 0.5, `${where}: pulled back no further than the highest crown needs (${crownOf(view, actors) - clip.y} px spare)`);
      }
    }
  }
  assert.ok(fitted >= 5, `the fit had to pull back in the cases that crop (${fitted})`);
});

test("CODEX PASS 3: THE FITTED VIEW'S CROWN FIT IS ONLY AS GOOD AS THE SIZE IT IS HANDED — the size on screen (cameraYscaleFor), not the scene's, while a rescale is pending", () => {
  // Codex's case: 640x420, a 3v3 spanning x +-600, a back-ranker whose colossus has expired in the scene
  // (86) while his clip still draws him at 150. Fitted to the scene's size, his drawn crown leaves the stage.
  const frame = combatHudFrameFor({ hud: bout(3, 3), pack: null });
  const fit = stageFitFor({ width: 640, height: 420 });
  const roster = [{ x: -600, y: 200 }, { x: -300, y: 103 }, { x: -150, y: 6 }, { x: 150, y: 6 }, { x: 300, y: 103 }, { x: 600, y: 200 }];
  const scene = roster.map((one) => ({ ...one, yscale: 86 }));
  const drawnSize = (one) => (one.x === -150 ? 150 : 86);
  const crownDrawn = (view) => Math.min(...roster.map((one) => view.toY(one.y, SS2_FIGURE_HEIGHT * figureScaleFor({
    yscale: drawnSize(one), rank: rankOfDepth(one.y, 0, { frontY: 200, rankStride: 97 }), slotIndex: 0 }))));
  const byScene = fittedViewFor({ width: 640, height: 420, fit, frame, actors: scene, frontY: 200, rankStride: 97 });
  assert.ok(crownDrawn(byScene) < -5, `fitted to the scene's size, the drawn colossus's crown is cropped (${crownDrawn(byScene)})`);
  const shown = scene.map((one) => ({ ...one, yscale: cameraYscaleFor(one.yscale, drawnSize(one)) }));
  const byScreen = fittedViewFor({ width: 640, height: 420, fit, frame, actors: shown, frontY: 200, rankStride: 97 });
  assert.ok(crownDrawn(byScreen) >= 0, `fitted to the size on screen, it is on the stage (${crownDrawn(byScreen)})`);
});

test("WHICH ART, AND WHY: the build's own gauges from a pack the renderer accepts; otherwise the authored fallback, and the log says which case it is", () => {
  const raw = syntheticIcons();
  const build = combatHudArtFor(raw);
  assert.equal(build.state, "build");
  assert.ok(build.pack && build.pack.clips, "the renderer's own pack");
  assert.equal(build.log.warn, false);
  assert.match(build.log.message, /^gauges: the build's own combat_panel from your install/);

  // A clone: no icons pack at all. The supported case — the plain fallback, not a warning.
  const none = combatHudArtFor(null);
  assert.deepEqual([none.state, none.pack, none.log.warn], ["none", null, false]);
  assert.match(none.log.message, /^gauges: no icons pack — the authored gauges are drawn/);

  // A pack extracted before the gauges section: stale, and the remedy is named.
  const { gauges, ...before } = raw;
  const stale = combatHudArtFor(before);
  assert.deepEqual([stale.state, stale.pack, stale.log.warn], ["stale", null, true]);
  assert.match(stale.log.message, /extracted before its gauges section[^]*run `node tools\/extract-all\.mjs`/);

  // A section the renderer refuses (here: the extraction recorded a problem) is not drawn as the build's.
  const refused = combatHudArtFor({ ...raw, gauges: { ...raw.gauges, problems: ["drive incompatible"] } });
  assert.deepEqual([refused.state, refused.pack, refused.log.warn], ["refused", null, true]);
  assert.match(refused.log.message, /gauges section is not the build this page draws[^]*`node tools\/extract-all\.mjs`/);

  // Never applied: the asset gate skipped the icons pack (late, or its fetch failed).
  const unused = combatHudArtFor(undefined);
  assert.deepEqual([unused.state, unused.pack, unused.log.warn], ["unused", null, true]);
  assert.match(unused.log.message, /not used this bout/);
});

test("THE INVOICE: what the build's art could not carry, summed over every cluster on the stage — the fallback has none", () => {
  const pack = combatPanelPackFromSynthetic();
  const art = combatHudArtFor(syntheticIcons());
  const hud = hudOf(row("red-1"), row("red-2"), row("blue-1"), row("blue-2", { armour: reading(0, 20, false) }));
  const frame = combatHudFrameFor({ hud, pack });
  // Worked: each banner's inner bevel is drawn plain (4 clusters); with no text pack every word is the
  // page font's — his name, 3 numbers and 3 labels, 7 a cluster — but blue-2's armour is hidden
  // (armourclass 0, as the build hides it): its number and label are not drawn, 5 words there.
  assert.deepEqual({ ...combatHudInvoiceFor(art, null, frame) }, {
    bevelsDrawnPlain: 4, wordsInPageFont: 7 + 7 + 7 + 5, glowsUnderFade: 0, shapesMissing: 0,
    cuttersMissing: 0, unsupported: 0, gaugesHidden: 1, drivesAuthored: 0
  });
  assert.equal(combatHudInvoiceFor(combatHudArtFor(null), null, combatHudFrameFor({ hud, pack: null })), null);
});

test("\"WHAT YOU ARE LOOKING AT\": the gauges' line says whose art it is, what of it is not the build's, and — for the fallback — why", () => {
  const art = combatHudArtFor(syntheticIcons());
  const frame = combatHudFrameFor({ hud: bout(2, 2), pack: art.pack });
  const [subject, body] = combatHudProvenanceFor({ art, invoice: combatHudInvoiceFor(art, null, frame), open: true });
  assert.equal(subject, "The gauges in the frame");
  assert.match(body, /^are the build's own combat_panel, from your install's icons/);
  assert.match(body, /the banners' inner bevel, drawn plain \(4\)/, "the invoice's counts, by name");
  assert.match(body, /28 words in the page font/);
  assert.match(body, /a gauge drains when the pop-up of the blow that drains it starts/, "D6 is authored, and said");
  // With the text pack's glyphs for every word, the page font is not mentioned.
  const glyphs = combatHudProvenanceFor({ art, invoice: { ...combatHudInvoiceFor(art, null, frame), wordsInPageFont: 0 }, open: true })[1];
  assert.doesNotMatch(glyphs, /page font/);

  for (const [icons, reason] of [
    [null, /there is no extracted icons pack/],
    [{ faces: {} }, /your icons pack predates its gauges section: run `node tools\/extract-all\.mjs`/],
    [undefined, /the icons pack was not used this bout/]
  ]) {
    const fallback = combatHudArtFor(icons);
    const line = combatHudProvenanceFor({ art: fallback, invoice: null, open: true })[1];
    assert.match(line, /^are authored stand-ins/, `${fallback.state}: the fallback says it is authored`);
    assert.match(line, reason, `${fallback.state}: and why`);
  }
  assert.match(combatHudProvenanceFor({ art, invoice: null, open: false })[1], /^are not drawn yet/, "before the asset gate opens");
});

test("THE OPS A CLUSTER IS PAINTED WITH: the pack's when there is one, the fallback's otherwise — built once and kept while nothing they depend on changes", () => {
  // Building a cluster's ops costs milliseconds (measured with the real packs: ~5 ms a frame for a
  // pair, ~12 for 3v3, in node), and the gauges change only when a reading does.
  const art = combatHudArtFor(syntheticIcons());
  const hud = bout(1, 1);
  const { cluster, reading: shown } = combatHudFrameFor({ hud, pack: art.pack }).clusters[0];
  const opsFor = createCombatHudOps();
  const first = opsFor({ art, textPack: null, cluster, reading: shown, stageScale: 1.5 });
  assert.deepEqual(first, combatPanelOpsFor(art.pack, null, cluster, shown, { stageScale: 1.5 }), "the pack's own ops");
  assert.equal(opsFor({ art, textPack: null, cluster, reading: { ...shown }, stageScale: 1.5 }), first, "the same reading again: the same ops, not rebuilt");
  const hit = opsFor({ art, textPack: null, cluster, reading: { ...shown, health: reading(40, 100) }, stageScale: 1.5 });
  assert.notEqual(hit, first, "a reading that changed is drawn anew");
  assert.notDeepEqual(hit, first);
  // Each of these changes ONE thing from the call before it, and each is drawn anew.
  const scaled = opsFor({ art, textPack: null, cluster, reading: { ...shown, health: reading(40, 100) }, stageScale: 2 });
  assert.notEqual(scaled, hit, "a new stage scale builds the glows at the width they are drawn");
  const acting = opsFor({ art, textPack: null, cluster, reading: { ...shown, health: reading(40, 100), acting: true }, stageScale: 2 });
  assert.notEqual(acting, scaled, "the acting mark comes and goes");
  const glyphs = [..."0123456789 /"].map((char) => ({ code: char.codePointAt(0), path: char === " " ? null : "M0 0L400 0L400 600L0 600Z", empty: char === " ", advance: 500 }));
  const textPack = textPackFrom({ fonts: { 118: { id: 118, glyphs, ascent: 800, descent: 200 } },
    fields: { 731: { id: 731, font: 118, bounds: { xMin: -40, xMax: 1592, yMin: -40, yMax: 423 }, fontHeight: 280 } }, statics: {} });
  const lettered = opsFor({ art, textPack, cluster, reading: { ...shown, health: reading(40, 100), acting: true }, stageScale: 2 });
  assert.notEqual(lettered, acting, "another text pack is other glyphs");
  const again = combatHudArtFor(syntheticIcons());
  assert.notEqual(opsFor({ art: again, textPack, cluster, reading: { ...shown, health: reading(40, 100), acting: true }, stageScale: 2 }), lettered,
    "another pack is other art, whatever it measures");
  // With the text pack's glyphs, the health number is the build's glyphs under its glow — built at the scale drawn.
  const drawnAt = (stageScale) => opsFor({ art, textPack, cluster, reading: shown, stageScale });
  assert.ok(drawnAt(1.5).some((op) => op.panel === "health" && op.role === "number" && op.kind === "path" && op.group), "the number's glyphs, glowing");
  assert.deepEqual(drawnAt(1.5), combatPanelOpsFor(art.pack, textPack, cluster, shown, { stageScale: 1.5 }));
  assert.notDeepEqual(drawnAt(1.5), drawnAt(1), "the glow's width follows the stage scale");

  // The fallback, laid out for itself.
  const plain = combatHudArtFor(null);
  const fallback = combatHudFrameFor({ hud, pack: null }).clusters[0];
  const drawn = opsFor({ art: plain, textPack: null, cluster: fallback.cluster, reading: fallback.reading, stageScale: 1.5 });
  assert.deepEqual(drawn, combatPanelFallbackOpsFor(fallback.cluster, fallback.reading));
  assert.ok(drawn.filter((op) => op.kind === "path").every((op) => op.authored === true), "every path authored");
});

test("THE ASSET GATE NAMES THE GAUGES: a late icons pack is said to cost them, with everything else it carries", () => {
  const icons = ARENA_VISUAL_PACKS.find((pack) => pack.name === "icons");
  assert.match(icons.label, /\bthe gauges\b/, "the icons pack's label names the gauges");
  assert.match(icons.label, /\bthe face\b[^]*\bthe pop-ups\b[^]*\bthe ring's buttons\b/, "and still names what else it carries");
  const late = assetGateReport({
    open: true, reason: "timeout", elapsedMs: 8000, settledCount: 7, total: 8, late: ["icons"], errors: {},
    outcomes: Object.fromEntries(ARENA_VISUAL_PACKS.map((pack) => [pack.name, pack.name === "icons" ? "late" : "loaded"]))
  });
  assert.match(late[0].message, /LATE, and not used this bout: icons \([^)]*the gauges[^)]*\)/);
});
