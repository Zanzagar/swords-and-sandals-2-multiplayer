/**
 * THE BUILD'S OWN GAUGES IN THE FRAME — `src/render/combat-panel.js`: the
 * drive, the layout (the build's 1v1 panel, and D2's team clusters), the ops
 * from the player's own pack and the authored fallback.
 *
 * Everything but the last section runs on synthetic data, so a clone with no
 * licensed copy executes it. The last test reads the player's own icons and
 * text packs; it skips only in a tree with no icons pack at all, and a pack
 * extracted before the `gauges` section existed takes the FALLBACK there
 * rather than adding a skip.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CombatPanelError,
  SS2_COMBAT_PANEL,
  SS2_FALLBACK_ART,
  SS2_GAUGE_DRIVE,
  combatPanelFallbackOpsFor,
  combatPanelInvoiceFor,
  combatPanelLayoutFor,
  combatPanelOpsFor,
  combatPanelPackFrom,
  gaugeDriveFor
} from "../src/render/combat-panel.js";
import { IDENTITY, compose, glowGroupFor, matrixOf } from "../src/render/pack-ops.js";
import { textPackFrom } from "../src/render/text.js";

/* ------------------------------------------------------------------ */
/* 0. The helpers every icon-pack reader shares (src/render/pack-ops.js) */
/* ------------------------------------------------------------------ */

test("the shared matrix helpers: compose is outer-then-inner with twips translations, and matrixOf refuses junk", () => {
  // Worked by hand: outer [2, 1, 3, 4, 100, 200] (a skew, so every term shows), inner [5, 6, 7, 8, 10, 20].
  //   a = 2*5 + 3*6 = 28   b = 1*5 + 4*6 = 29   c = 2*7 + 3*8 = 38   d = 1*7 + 4*8 = 39
  //   tx = 2*10 + 3*20 + 100 = 180   ty = 1*10 + 4*20 + 200 = 290
  assert.deepEqual(compose([2, 1, 3, 4, 100, 200], [5, 6, 7, 8, 10, 20]), [28, 29, 38, 39, 180, 290]);
  assert.deepEqual(compose(IDENTITY, [1, 0, 0, 1, 7, 9]), [1, 0, 0, 1, 7, 9]);
  assert.deepEqual(matrixOf([1, 0, 0, 1, 20, 40, "extra"]), [1, 0, 0, 1, 20, 40]);
  for (const junk of [null, [1, 0, 0, 1, 20], [1, 0, 0, 1, 20, Number.NaN], [1, 0, 0, 1, "20", 40], "matrix"]) {
    assert.equal(matrixOf(junk), null, JSON.stringify(junk));
  }
  assert.equal(glowGroupFor([], 1), null);
  assert.equal(glowGroupFor(null, 1), null);
  const group = glowGroupFor([{ type: "glow", colour: { red: 0, green: 0, blue: 0, alpha: 255 }, blurX: 2, blurY: 2, strength: 10,
    inner: false, knockout: false, compositeSource: true, passes: 1 }], 2);
  assert.ok(group && (group.filter || group.amplify), "a saturating glow is a group the painter composites");
});

/* ------------------------------------------------------------------ */
/* 1. The drive: the six clip-actions' own arithmetic                  */
/* ------------------------------------------------------------------ */

test("THE DRIVE IS THE BUILD'S: pct = round(v / max * 100), _y = round(-30 + (101 - pct) * 0.7), and 'v / max'", () => {
  // Worked by hand from the bytes (hero_potion, body 0x2264d1 +0x00a3..+0x013b):
  // Y(100) = round(-29.3) = -29, Y(50) = round(5.7) = 6, Y(0) = round(40.7) = 41.
  assert.deepEqual(gaugeDriveFor(100, 100), { pct: 100, y: -29, text: "100 / 100", authored: null });
  assert.deepEqual(gaugeDriveFor(50, 100), { pct: 50, y: 6, text: "50 / 100", authored: null });
  assert.deepEqual(gaugeDriveFor(0, 100), { pct: 0, y: 41, text: "0 / 100", authored: null });
  // pct rounds first: 2 / 3 -> 66.67 -> 67 -> round(-30 + 34 * 0.7 = -6.2) = -6.
  assert.deepEqual(gaugeDriveFor(2, 3), { pct: 67, y: -6, text: "2 / 3", authored: null });
  // A half-pixel lands where Math.round puts it: pct 96 -> -30 + 3.5 = -26.5 -> -26 (towards +inf).
  assert.equal(gaugeDriveFor(96, 100).y, -26);
  // An integer y always: the liquid never sits on a half pixel.
  for (let value = 0; value <= 120; value += 1) {
    assert.ok(Number.isInteger(gaugeDriveFor(value, 97).y), `value ${value}`);
  }
});

test("OVER AND UNDER RANGE ARE NOT CLAMPED — the build lets the mask crop them", () => {
  // 110 / 100: pct 110, round(-30 - 6.3) = -36, above full; the vial's mask crops it.
  assert.deepEqual(gaugeDriveFor(110, 100), { pct: 110, y: -36, text: "110 / 100", authored: null });
  // -5 / 100: pct -5, round(-30 + 74.2) = 44, below empty.
  assert.deepEqual(gaugeDriveFor(-5, 100), { pct: -5, y: 44, text: "-5 / 100", authored: null });
});

test("A MAX OF 0 AND A MISSING READING are not the build's arithmetic: drawn EMPTY, and said so", () => {
  // The build would divide by zero and hand `_y` a non-finite number; what the
  // player then does was never measured, so the stand-in is named, not guessed.
  const zero = gaugeDriveFor(5, 0);
  assert.equal(zero.pct, null);
  assert.equal(zero.y, 41, "the empty position, Y(0)");
  assert.equal(zero.text, "5 / 0", "the number is still what the build would print");
  assert.match(zero.authored, /max of 0/);
  assert.equal(gaugeDriveFor(0, 0).y, 41);
  assert.equal(gaugeDriveFor(-3, 0).y, 41);
  for (const [value, max] of [[null, 100], [100, null], [Number.NaN, 100], [100, Infinity], [undefined, undefined], ["50", 100]]) {
    const drive = gaugeDriveFor(value, max);
    assert.deepEqual([drive.pct, drive.y, drive.text], [null, 41, null], `${value} / ${max}`);
    assert.match(drive.authored, /no reading/);
  }
});

/* ------------------------------------------------------------------ */
/* 2. The layout: the build's 1v1 panel, and D2's team clusters        */
/* ------------------------------------------------------------------ */

const near = (actual, expected, label, tolerance = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} against ${expected}`);
const sides = (red, blue) => [
  { teamId: "red", ids: Array.from({ length: red }, (unused, index) => `red-${index + 1}`) },
  { teamId: "blue", ids: Array.from({ length: blue }, (unused, index) => `blue-${index + 1}`) }
];
/** A cluster's box in stage px, rounded to 0.01 for the message. */
const boxOf = (cluster) => cluster.box;

test("A 1v1 IS THE BUILD'S OWN PANEL AT THE BUILD'S OWN PLACE: both clusters at scale 1, local + (-0.05, 288.75)", () => {
  // The stage boxes, measured from the bytes (751's placements, shape bounds,
  // and the attach {_x:-320,_y:122} into `arena` at (319.95, 166.75)): the
  // banners end at 404.10; the hero's banner spans x 0.00..215.00, the
  // villain's 422.90..637.90. The TOP is the art's, not the layout's: with no
  // pack it is the fallback's vial rim, 302.90 (the build's own glass, 299.30,
  // is pinned against the real pack below). ~~This test pinned 299.30 here,
  // for a layout that had seen no art at all (verify:gauges-r3).~~
  const layout = combatPanelLayoutFor({ sides: sides(1, 1) });
  assert.equal(layout.mode, "pair");
  assert.equal(layout.scale, 1);
  near(layout.hudTop, 302.90, "hudTop: the fallback's");
  assert.deepEqual(layout.clusters.map((cluster) => [cluster.id, cluster.teamId, cluster.side, cluster.slot]),
    [["red-1", "red", "hero", 1], ["blue-1", "blue", "villain", 1]]);
  for (const cluster of layout.clusters) {
    assert.equal(cluster.scale, 1);
    const [a, b, c, d, tx, ty] = cluster.matrix;
    assert.deepEqual([a, b, c, d], [1, 0, 0, 1]);
    near(tx, -0.05, `${cluster.side} tx`);
    near(ty, 288.75, `${cluster.side} ty`);
  }
  const [hero, villain] = layout.clusters.map(boxOf);
  for (const [box, xMin, xMax] of [[hero, 0, 215], [villain, 422.9, 637.9]]) {
    near(box.xMin, xMin, "xMin");
    near(box.xMax, xMax, "xMax");
    near(box.yMin, 302.90, "yMin: the fallback's top");
    near(box.yMax, 404.10, "yMax");
  }
});

test("A TEAM BOUT: one cluster each, scaled by s = min(1, 316 / (N x 215)), bottom-anchored at 404.10, red from the left, blue from the right", () => {
  for (const [red, blue, n] of [[2, 2, 2], [3, 3, 3], [2, 1, 2], [1, 3, 3], [3, 2, 3]]) {
    const layout = combatPanelLayoutFor({ sides: sides(red, blue) });
    const s = Math.min(1, 316 / (n * 215));
    assert.equal(layout.mode, "team", `${red}v${blue}`);
    near(layout.scale, s, `${red}v${blue} scale`, 1e-9);
    // The highest ink with no pack, the fallback's vial rim at 14.15 panel px
    // (~~10.55, the build's glass, typed~~), below the banner bottom's 115.35.
    near(layout.hudTop, 404.10 - s * (115.35 - 14.15), `${red}v${blue} hudTop`);
    const reds = layout.clusters.filter((cluster) => cluster.teamId === "red");
    const blues = layout.clusters.filter((cluster) => cluster.teamId === "blue");
    assert.deepEqual(reds.map((cluster) => cluster.slot), Array.from({ length: red }, (unused, index) => index + 1));
    assert.deepEqual(blues.map((cluster) => cluster.slot), Array.from({ length: blue }, (unused, index) => index + 1));
    assert.ok(reds.every((cluster) => cluster.side === "hero") && blues.every((cluster) => cluster.side === "villain"));
    // Slot 1 is leftmost on red and RIGHTMOST on blue, each at the build's own edge.
    near(reds[0].box.xMin, 0, "red slot 1 at the build's left edge");
    near(blues[0].box.xMax, 637.9, "blue slot 1 at the build's right edge");
    for (let index = 1; index < reds.length; index += 1) assert.ok(reds[index].box.xMin > reds[index - 1].box.xMin);
    for (let index = 1; index < blues.length; index += 1) assert.ok(blues[index].box.xMax < blues[index - 1].box.xMax);
    for (const cluster of layout.clusters) {
      near(cluster.scale, s, "every cluster at the one scale", 1e-9);
      near(cluster.box.yMax, 404.10, `${cluster.id} bottom-anchored`);
      near(cluster.box.yMin, layout.hudTop, `${cluster.id} top`);
      near(cluster.box.xMax - cluster.box.xMin, 215 * s, `${cluster.id} width`);
      assert.ok(cluster.box.xMin >= -0.01 && cluster.box.xMax <= 640.01, `${cluster.id} inside the stage`);
    }
    // No two clusters overlap.
    const boxes = layout.clusters.map(boxOf).sort((left, right) => left.xMin - right.xMin);
    for (let index = 1; index < boxes.length; index += 1) {
      assert.ok(boxes[index].xMin >= boxes[index - 1].xMax - 1e-9, `${red}v${blue}: cluster ${index} overlaps ${index - 1}`);
    }
  }
});

test("hudTop, per size, with NO pack — the fallback's: 302.90 for a pair, ~329.73 at two a side, ~354.52 at three", () => {
  // ~~299.30 / 327.08 / 352.76~~: the build's glass, typed, and reported
  // whatever art was drawn (verify:gauges-r3). Those are now pinned against
  // the real pack, laid out with it (the last test in this file).
  near(combatPanelLayoutFor({ sides: sides(1, 1) }).hudTop, 302.90, "1v1");
  near(combatPanelLayoutFor({ sides: sides(2, 2) }).hudTop, 329.73, "2v2");
  near(combatPanelLayoutFor({ sides: sides(3, 3) }).hudTop, 354.52, "3v3");
  near(combatPanelLayoutFor({ sides: sides(2, 3) }).hudTop, 354.52, "2v3 takes the larger side");
  // Nobody to draw: no clusters and no top.
  const empty = combatPanelLayoutFor({ sides: [] });
  assert.deepEqual([empty.clusters.length, empty.hudTop], [0, null]);
});

/**
 * THE TOP OF ONE OP'S INK, in stage px — this file's own reading of how
 * `tools/arena/main.js` paints the op contract, written apart from the
 * module's (the verifier's reading, `verify:gauges-r3`):
 *
 * - a path paints when it has a fill, a gradient, a bitmap or a stroke
 *   (`paintLayerOperation`); its ink is its EXACT geometry — a quadratic's
 *   own extremum, not its control point — grown by half its stroke under the
 *   op's matrix (`lineJoin = "round"`, so the pen reaches `w / 2` every way),
 *   and cut to its clip's box when it has one;
 * - a page-font word is its em box plus half its outline (`paintPopup`:
 *   `textBaseline = "middle"`, `lineWidth = max(1, size / 7)`);
 * - a glyph under a glow is grown by a generous 3 px (every glow here is
 *   blur 2, whose support is 1 px — `SS2_MEASURED_GLOW_EXTENTS`).
 */
function pathTopOf(d, m) {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const yOf = (x, y) => m[1] * x + m[3] * y + m[5] / TWIPS;
  let top = Infinity;
  let index = 0;
  let command = null;
  let from = null;
  let start = null;
  const next = () => Number(tokens[index++]);
  while (index < tokens.length) {
    if (/[A-Za-z]/.test(tokens[index])) {
      command = tokens[index++];
      if (command === "Z") { from = start; continue; }
    }
    if (command === "M" || command === "L") {
      const point = [next(), next()];
      if (command === "M") start = point;
      from = point;
      top = Math.min(top, yOf(...point));
    } else if (command === "Q") {
      const control = [next(), next()];
      const end = [next(), next()];
      const [y0, y1, y2] = [yOf(...from), yOf(...control), yOf(...end)];
      const denominator = y0 - 2 * y1 + y2;
      const t = denominator === 0 ? -1 : (y0 - y1) / denominator;
      if (t > 0 && t < 1) top = Math.min(top, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t * t * y2);
      top = Math.min(top, y2);
      from = end;
    } else {
      throw new Error(`this file's reader does not know "${command}" in ${d.slice(0, 40)}`);
    }
  }
  return top;
}
function inkTopOf(op) {
  if (op.kind === "text") return op.y - op.size / 2 - Math.max(1, op.size / 7) / 2;
  const paints = (op.fill && op.fill !== "none") || op.gradient || op.bitmap || (op.stroke && op.strokeWidth > 0);
  if (!paints) return Infinity;
  const [, b, , d] = op.matrix;
  let top = pathTopOf(op.d, op.matrix) - (op.stroke && op.strokeWidth > 0 ? (op.strokeWidth / 2) * Math.hypot(b, d) : 0);
  if (op.group) top -= 3;
  if (op.clip) top = Math.max(top, pathTopOf(op.clip.d, op.clip.matrix));
  return top;
}
const hudInkTopOf = (ops) => Math.min(...ops.map(inkTopOf));

test("hudTop IS THE INK THE FALLBACK DRAWS — acting or not, fallen or not, at 1v1, 2v2 and 3v3 — not a typed box (verify:gauges-r3)", () => {
  // Worked by hand from the fallback's own vial (`VESSELS.vial`): its top edge
  // at y -31, under a 3 px rim reaching 1.5 above it, in a gauge placed at
  // ty 933 twips (46.65): 14.15 panel px. A pair: 288.75 + 14.15 = 302.90.
  // A team: bottom-anchored at 404.10, so 404.10 - s x (115.35 - 14.15):
  // s = 316/430 -> 329.73, s = 316/645 -> 354.52. The verifier measured the
  // fallback's ink 3.600 / 2.646 / 1.764 px BELOW the typed 299.30 / 327.08 / 352.76.
  for (const [n, expected] of [[1, 302.90], [2, 329.73], [3, 354.52]]) {
    const layout = combatPanelLayoutFor({ sides: sides(n, n) });
    for (const acting of [null, "red-1", `blue-${n}`]) {
      for (const alive of [true, false]) {
        const ops = layout.clusters.flatMap((cluster) => combatPanelFallbackOpsFor(cluster, row({
          id: cluster.id, acting: cluster.id === acting, alive,
          health: readingOf(100, 100), energy: readingOf(0, 60), armour: readingOf(7, 20)
        })));
        const label = `${n}v${n}, ${acting ?? "nobody"} acting${alive ? "" : ", fallen"}`;
        near(layout.hudTop, hudInkTopOf(ops), `${label}: hudTop against the ink`, 1e-9);
        near(layout.hudTop, expected, `${label}: hudTop worked by hand`);
        assert.ok(ops.some((op) => op.role === "rim" && Math.abs(inkTopOf(op) - layout.hudTop) <= 1e-9), `${label}: the vial's rim sets it`);
      }
    }
  }
});

test("the layout takes red and blue in either order, and refuses a third side by name", () => {
  const swapped = combatPanelLayoutFor({ sides: [...sides(1, 2)].reverse() });
  assert.deepEqual(swapped.clusters.map((cluster) => [cluster.id, cluster.side]),
    [["red-1", "hero"], ["blue-1", "villain"], ["blue-2", "villain"]]);
  assert.throws(() => combatPanelLayoutFor({ sides: [...sides(1, 1), { teamId: "green", ids: ["g"] }] }), CombatPanelError);
  // Two sides both claiming red would drop one from the HUD without a word.
  assert.throws(() => combatPanelLayoutFor({ sides: [...sides(1, 1), { teamId: "red", ids: ["r2"] }] }), CombatPanelError);
});

/* ------------------------------------------------------------------ */
/* 3. The pack, and one cluster's ops from it                          */
/* ------------------------------------------------------------------ */

const TWIPS = 20;
const square = (fill) => ({ bounds: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 }, paths: [{ d: "M0 0L10 0L10 10L0 10Z", fill, fillOpacity: 1 }] });
const glow = (red, green, blue) => [{ type: "glow", colour: { red, green, blue, alpha: 255 }, blurX: 2, blurY: 2, strength: 10,
  inner: false, knockout: false, compositeSource: true, passes: 1 }];
const bevel = [{ type: "bevel", highlightColour: { red: 255, green: 255, blue: 255, alpha: 255 }, shadowColour: { red: 160, green: 96, blue: 1, alpha: 255 },
  blurX: 0, blurY: 0, angle: 0.785, distance: -6, strength: 1, inner: true, knockout: false, compositeSource: true, onTop: false, passes: 1 }];
const entry = (character, placements) => ({ character, frames: [placements], declaredFrames: 1, effectGroups: [] });
const shapeAt = (character, tx = 0, ty = 0, extra = {}) => ({ kind: "shape", character, matrix: [1, 0, 0, 1, tx, ty], ...extra });
const textAt = (character, tx, ty, filters) => ({ kind: "text", character, matrix: [1, 0, 0, 1, tx, ty], filters });
const liquidAt = (character, tx, ty, mask) => ({ kind: "clip", character, matrix: [1, 0, 0, 1, tx, ty], name: "blood_health",
  frameCount: 1, mask: { shape: mask, matrix: [1, 0, 0, 1, 0, 0] } });

/**
 * A `gauges` section in the extractor's own shape, with squares for art: the
 * same entries, names, masks and REST matrices the build has (733/742 hold
 * blood_health at (-484, -531) twips, 749 at (-494, -561)).
 */
function syntheticIcons() {
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
      nested: {
        729: entry(729, [shapeAt(728)]), 738: entry(738, [shapeAt(737)]), 745: entry(745, [shapeAt(744)])
      },
      // 751's ten placements as the extractor names them (a CLEAN extraction: no problems, no disagreements).
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

/** One gauge placement of 751, in the extractor's shape. */
function gaugeRow(side, reading, instance, depth, character, matrix) {
  return { kind: "gauge", side, reading, instance, depth, character, matrix };
}

const readingOf = (value, max, shown = true) => ({ value, max, percent: max > 0 ? Math.round(value / max * 100) : 0, shown });
const row = (overrides = {}) => ({
  id: "red-1", name: "Maximus", teamId: "red", colour: "#e0584f", acting: false, alive: true,
  health: readingOf(50, 100), energy: readingOf(30, 60), armour: readingOf(10, 20), ...overrides
});
/** A pair laid out for the art it will be drawn with: `pack`, or (none) the fallback. */
const pairLayout = (pack = null) => combatPanelLayoutFor({ sides: sides(1, 1), pack });
const heroCluster = (pack = null) => pairLayout(pack).clusters[0];
const villainCluster = (pack = null) => pairLayout(pack).clusters[1];
const fillsOf = (ops) => ops.filter((op) => op.kind === "path").map((op) => op.fill);

test("THE PACK READER IS TOTAL: no section, a stale pack or a hollow entry is no pack, and the caller draws the fallback", () => {
  const raw = syntheticIcons();
  assert.ok(combatPanelPackFrom(raw));
  for (const rubbish of [null, undefined, 42, "icons", {}, { shapes: {} }]) assert.equal(combatPanelPackFrom(rubbish), null);
  const { gauges, ...stale } = raw;
  assert.equal(combatPanelPackFrom(stale), null, "a pack extracted before the gauges section");
  const without = (mutate) => { const copy = structuredClone(raw); mutate(copy.gauges); return combatPanelPackFrom(copy); };
  assert.equal(without((g) => { delete g.clips[749]; }), null, "a gauge sprite missing");
  assert.equal(without((g) => { delete g.clips[52]; }), null, "the banner missing");
  assert.equal(without((g) => { delete g.nested[738]; }), null, "a liquid missing");
  assert.equal(without((g) => { g.clips[733].frames[0][1].name = "something_else"; }), null, "no blood_health to drive");
  assert.equal(without((g) => { g.clips[733].frames[0].push(g.clips[733].frames[0][1]); }), null, "two blood_health: which one moves?");
  // CODEX PASS 1: a pack that is present but not WHOLE drew a gauge without its art — a liquid with no
  // cutter spills over the vial, an empty frame draws nothing — and the fallback never ran. No pack, instead.
  const hollow = (mutate) => { const copy = structuredClone(raw); mutate(copy); return combatPanelPackFrom(copy); };
  assert.equal(hollow((copy) => { delete copy.shapes[727]; }), null, "a cutter the pack does not hold: the liquid would spill");
  assert.equal(hollow((copy) => { copy.shapes[743].paths = []; }), null, "a cutter with no path");
  assert.equal(hollow((copy) => { delete copy.shapes[728]; }), null, "a liquid shape the pack does not hold");
  assert.equal(hollow((copy) => { delete copy.shapes[51]; }), null, "a banner shape the pack does not hold");
  assert.equal(hollow((copy) => { copy.gauges.nested[745].frames = [[]]; }), null, "an empty liquid frame");
  assert.equal(hollow((copy) => { copy.gauges.clips[52].frames = [[]]; }), null, "an empty banner frame");
  assert.equal(hollow((copy) => { copy.gauges.clips[742].frames[0][1].matrix = [1, 0, 0, 1, "x", 0]; }), null, "a liquid with no usable matrix");
  assert.equal(hollow((copy) => { copy.gauges.clips[742].frames[0][1].mask.matrix = null; }), null, "a cutter with no usable matrix");
  // CODEX PASS 2: and a liquid with no cutter AT ALL — the mask key gone, or null — is not whole either.
  assert.equal(hollow((copy) => { delete copy.gauges.clips[733].frames[0][1].mask; }), null, "a liquid with no mask");
  assert.equal(hollow((copy) => { copy.gauges.clips[749].frames[0][0].mask = null; }), null, "a liquid whose mask is null");
  assert.equal(hollow((copy) => { delete copy.texts[747]; }), null, "a number field the pack cannot place");
  assert.equal(hollow((copy) => { copy.gauges.clips[733].frames[0].push({ kind: "clip", character: 999, matrix: [1, 0, 0, 1, 0, 0] }); }), null,
    "a child this reader cannot draw");
});

test("CODEX PASS 5 (a): THE PACK READER REQUIRES THE WHOLE COMPOSITION — a placement gone, or a name record gone, is no pack", () => {
  // Pass 5 found the reader checked only the placements STILL PRESENT: a health
  // vial stripped to its liquid, or a pack with herotext's record deleted, was
  // accepted and drew a gauge with no glass, label or number, or a nameless
  // banner, and never the fallback.
  const raw = syntheticIcons();
  const broken = (mutate) => { const copy = structuredClone(raw); mutate(copy); return combatPanelPackFrom(copy); };
  assert.equal(broken((copy) => {
    copy.gauges.clips[733].frames[0] = copy.gauges.clips[733].frames[0].filter((placement) => placement.name === "blood_health");
  }), null, "Codex's own case: the health vial with nothing left but its liquid");
  // Every placement of every gauge sprite, one at a time: each shell, the liquid, the number, the label.
  for (const id of [733, 742, 749]) {
    raw.gauges.clips[id].frames[0].forEach((placement, index) => {
      assert.equal(broken((copy) => { copy.gauges.clips[id].frames[0].splice(index, 1); }), null,
        `${id} without its ${placement.kind} ${placement.character}`);
    });
  }
  // The name records: with no text pack the name is drawn from them, so without one the banner is silently nameless.
  assert.equal(broken((copy) => { delete copy.texts[734]; }), null, "herotext's record deleted");
  assert.equal(broken((copy) => { delete copy.texts[735]; }), null, "villaintext's record deleted");
  assert.equal(broken((copy) => { copy.texts[735].bounds = null; }), null, "a name record with no box to place it in");
  // And every REFERENCE is the build's: the right cutter, the right field, a label that is a label.
  assert.equal(broken((copy) => { copy.gauges.clips[733].frames[0][1].mask.shape = 736; }), null, "the health liquid under the energy vial's cutter");
  assert.equal(broken((copy) => { copy.gauges.clips[733].frames[0][3].character = 747; }), null, "the health number in the armour's field");
  assert.equal(broken((copy) => { copy.texts[732].kind = "edit-text"; }), null, "a label record that is not a static text (it would draw as a number)");
  assert.equal(broken((copy) => { copy.shapes[731] = square("#ffffff"); copy.gauges.clips[733].frames[0][3].kind = "shape"; }), null,
    "the number placed as a SHAPE of its id (a pack whose ids collide): the right id, the wrong kind of placement");
  // Nothing more than the composition either: an extra glass would draw twice.
  assert.equal(broken((copy) => { copy.gauges.clips[742].frames[0].push(shapeAt(739)); }), null, "an extra placement");
  assert.equal(broken((copy) => { copy.gauges.nested[729].frames[0].push(shapeAt(730)); }), null, "a liquid holding more than its one shape");
  assert.equal(broken((copy) => { copy.texts[734].kind = "static-text"; }), null, "a name record that is not a field");
  // The fixture itself is whole: every refusal above is the mutation's, not the fixture's.
  assert.ok(combatPanelPackFrom(raw));
});

test("CODEX PASS 5 (b): A FAILED OR INCOMPATIBLE EXTRACTION IS NO PACK — its problems, a split or other drive, another layout", () => {
  // Pass 5 found the reader ignored what the extraction itself recorded: a
  // section with `problems: ["drive incompatible"]` and `drive: null` was
  // accepted, and drawn with this module's hand-cited drive and coordinates
  // as though they were that build's. Each half is pinned on its own here.
  const raw = syntheticIcons();
  const broken = (mutate) => { const copy = structuredClone(raw); mutate(copy.gauges); return combatPanelPackFrom(copy); };
  // What the extraction said about itself.
  assert.equal(broken((g) => { g.problems = ["drive incompatible"]; }), null, "a problem the extraction recorded");
  assert.equal(broken((g) => { delete g.problems; }), null, "a section that cannot say it extracted cleanly");
  assert.equal(broken((g) => { g.disagreements = ["base: hero_potion=-30 villain_potion=-31"]; }), null, "the gauges disagree");
  // The drive: the one this module applies (SS2_GAUGE_DRIVE), or no pack.
  assert.equal(broken((g) => { g.drive = null; }), null, "no drive derived");
  assert.equal(broken((g) => { g.drive.step = 0.75; }), null, "another drive");
  assert.equal(broken((g) => { g.drive.offset = 1; }), null, "a drive with a constant this module does not apply");
  // The attach: the panel where SS2_COMBAT_PANEL.origin says.
  assert.equal(broken((g) => { g.attach = null; }), null, "no attach derived");
  assert.equal(broken((g) => { g.attach.origin.y = 290; }), null, "the panel attached lower");
  assert.equal(broken((g) => { g.attach.origin.x = 0; }), null, "the panel attached to the right");
  // The placements: every one of 751's ten as SS2_COMBAT_PANEL cites it — each cited field moved, one at a time.
  raw.gauges.placements.forEach((placement, index) => {
    for (const key of ["depth", "character", "matrix", "instance", "variable", "align"].filter((name) => name in placement)) {
      assert.equal(broken((g) => {
        const row = g.placements[index];
        row[key] = key === "matrix" ? [...row.matrix.slice(0, 5), row.matrix[5] + TWIPS] : typeof row[key] === "number" ? row[key] + 1 : `${row[key]}_other`;
      }), null, `the ${placement.side} ${placement.reading ?? placement.kind} with another ${key}`);
    }
  });
  assert.equal(broken((g) => { g.placements = g.placements.filter((row) => !(row.side === "hero" && row.reading === "armour")); }), null,
    "a gauge placement missing");
  assert.equal(broken((g) => { g.placements.push({ ...g.placements[1] }); }), null, "a second hero banner");
  assert.equal(broken((g) => { g.placements.find((row) => row.instance === "hero_stamina_potion").reading = "health"; }), null,
    "the hero's energy gauge read as his health");
  assert.ok(combatPanelPackFrom(raw), "the fixture itself is a clean extraction");
});

/** A square's twin raised by `lift` px — its path AND its bounds, as an extraction would write both. */
const raisedSquare = (fill, lift) => ({ bounds: { xMin: 0, xMax: 10, yMin: -lift, yMax: 10 - lift },
  paths: [{ d: `M0 ${-lift}L10 ${-lift}L10 ${10 - lift}L0 ${10 - lift}Z`, fill, fillOpacity: 1 }] });

test("hudTop IS THE INK THE PACK DRAWS, AND FOLLOWS ITS ART — laid out with the pack, acting or not, at 1v1, 2v2 and 3v3 (verify:gauges-r3)", () => {
  // The synthetic pack with its glass (730 in the health vial, 739 in the
  // energy vial) raised 40 px, so the glass is the art's highest ink, as the
  // build's is: -40 under the gauge's 46.65 = 6.65 panel px; a pair's top is
  // 288.75 + 6.65 = 295.40, and a team's 404.10 - s x (115.35 - 6.65).
  const raw = syntheticIcons();
  raw.shapes[730] = raisedSquare("#dddddd", 40);
  raw.shapes[739] = raisedSquare("#dddddd", 40);
  const pack = combatPanelPackFrom(raw);
  assert.ok(pack);
  const inkOfLayout = (layout, source, acting) => hudInkTopOf(layout.clusters.flatMap((cluster) =>
    combatPanelOpsFor(source, null, cluster, row({ id: cluster.id, acting: cluster.id === acting }))));
  for (const [n, expected] of [[1, 295.40], [2, 404.10 - (316 / 430) * 108.7], [3, 404.10 - (316 / 645) * 108.7]]) {
    const layout = combatPanelLayoutFor({ sides: sides(n, n), pack });
    for (const acting of [null, "red-1", `blue-${n}`]) {
      near(layout.hudTop, inkOfLayout(layout, pack, acting), `${n}v${n}, ${acting ?? "nobody"} acting: hudTop against the ink`, 1e-9);
      near(layout.hudTop, expected, `${n}v${n}: hudTop worked by hand`);
    }
  }
  // The verifier's own move (decouple.mjs): the glass's PATHS 6 px higher and
  // its bounds untouched. The ink moves, so the top must — it stayed at the
  // typed 299.30 before.
  const moved = structuredClone(raw);
  for (const id of [730, 739]) moved.shapes[id].paths[0].d = "M0 -46L10 -46L10 -36L0 -36Z";
  const movedPack = combatPanelPackFrom(moved);
  const movedLayout = combatPanelLayoutFor({ sides: sides(1, 1), pack: movedPack });
  near(movedLayout.hudTop, 295.40 - 6, "the glass 6 px higher, the top 6 px higher");
  near(movedLayout.hudTop, inkOfLayout(movedLayout, movedPack, null), "and still the ink", 1e-9);
  // With nothing raised, the synthetic art's highest ink is a WORD: the
  // villain's ARMOUR number in the page font — field 747 at ty -300 twips
  // (-15) inside 749, placed at 923 twips (46.15), so its box (-2..21.15)
  // centres at -15 + 9.575 + 46.15 = 40.725, and a 14 px em box reaches 7
  // above that plus half its 2 px outline: 32.725 panel px, so 321.475.
  // (Worked first as the health number, 45.475 — wrong: the armour's field
  // sits 12.25 px higher in its sprite.)
  const plain = combatPanelPackFrom(syntheticIcons());
  const plainLayout = combatPanelLayoutFor({ sides: sides(1, 1), pack: plain });
  near(plainLayout.hudTop, 321.475, "the villain armour number's em box", 1e-9);
  near(plainLayout.hudTop, inkOfLayout(plainLayout, plain, null), "and the ink", 1e-9);
  // A path that paints nothing — no fill, no stroke — is no ink, however high it sits.
  const unpainted = structuredClone(raw);
  unpainted.shapes[730].paths.push({ d: "M0 -300L10 -300L10 -290L0 -290Z", fill: "none", fillOpacity: 1 });
  near(combatPanelLayoutFor({ sides: sides(1, 1), pack: combatPanelPackFrom(unpainted) }).hudTop, 295.40, "an unpainted path is not the top");
  // The same sides with no pack are the FALLBACK's top: the art decides, not a constant.
  near(combatPanelLayoutFor({ sides: sides(1, 1) }).hudTop, 302.90, "no pack: the fallback's vial rim");
  // EACH SIDE IS MEASURED: with the armour's shell (746) the highest art, the
  // villain's armour gauge (ty 923 twips) stands 0.55 px higher than the
  // hero's (934), so the two clusters' tops differ and hudTop is the villain's:
  // 288.75 + 46.15 - 60 = 274.90.
  const shield = structuredClone(raw);
  shield.shapes[746] = raisedSquare("#795520", 60);
  const shieldPack = combatPanelPackFrom(shield);
  const shieldLayout = combatPanelLayoutFor({ sides: sides(1, 1), pack: shieldPack });
  near(shieldLayout.clusters[0].box.yMin - shieldLayout.clusters[1].box.yMin, 0.55, "the hero's top 0.55 px under the villain's");
  near(shieldLayout.hudTop, 274.90, "the villain's shield");
  near(shieldLayout.hudTop, inkOfLayout(shieldLayout, shieldPack, null), "and the ink", 1e-9);
});

test("A CUT SHAPE REACHES ITS CUTTER'S TOP: the liquid over its max fills the cutter, so the top counts the cutter at every reading", () => {
  // The health vial's cutter (727) raised 60 px above the rest of the art:
  // -60 under the gauge's 46.65 = -13.35 panel px, so a pair's top is
  // 288.75 - 13.35 = 275.40. The liquid is drawn only inside it.
  const raw = syntheticIcons();
  raw.shapes[727] = raisedSquare("#000000", 60);
  const pack = combatPanelPackFrom(raw);
  const layout = combatPanelLayoutFor({ sides: sides(1, 1), pack });
  near(layout.hudTop, 275.40, "the cutter's top, worked by hand");
  const inkAt = (health) => hudInkTopOf(layout.clusters.flatMap((cluster) => combatPanelOpsFor(pack, null, cluster, row({ id: cluster.id, health }))));
  // 150 / 100: Y = round(-30 + (101 - 150) x 0.7) = -64, the liquid's square at
  // -17.35..-7.35 panel px, cut at the cutter's -13.35: the ink IS the top.
  near(inkAt(readingOf(150, 100)), layout.hudTop, "a liquid over its max fills its cutter", 1e-9);
  // Half full, the liquid sits far below — and the top does not follow it
  // down: the camera's line stays put as the blows land.
  assert.ok(inkAt(readingOf(50, 100)) > layout.hudTop + 10, "the drained liquid is below the line, the line is where it was");
});

test("ART WHOSE TOP CANNOT BE MEASURED IS NO PACK — the caller takes the fallback, rather than the layout throwing", () => {
  // The layout measures the pack's own paths, in the vocabulary the extractor
  // writes (absolute M, L, Q, Z). A path in any other cannot be measured, so
  // its top — and hudTop — would be a guess.
  const broken = (mutate) => { const copy = syntheticIcons(); mutate(copy); return combatPanelPackFrom(copy); };
  assert.equal(broken((copy) => { copy.shapes[730].paths[0].d = "M0 0C3 -40 7 -40 10 0Z"; }), null, "a cubic in the glass");
  assert.equal(broken((copy) => { copy.shapes[51].paths[0].d = "M0 0l10 0l0 10z"; }), null, "relative commands in the banner");
  assert.equal(broken((copy) => { copy.shapes[726].paths[0].d = "M0 0L10 0L10"; }), null, "a shell path cut short");
  // (A LIQUID's own path is never measured: it is always cut, so it reaches
  // its cutter's top and no higher — the cutter is what is measured.)
  assert.equal(broken((copy) => { copy.shapes[727].paths[0].d = "M0 0A5 5 0 0 1 10 0Z"; }), null, "an arc in a cutter");
  // A QUADRATIC's top is its own extremum, not its end points: a dome of a
  // glass, ends at 0 and control at -80, peaks at -40 (under 46.65: 6.65).
  const dome = combatPanelPackFrom((() => { const copy = syntheticIcons(); copy.shapes[730].paths[0].d = "M0 0Q5 -80 10 0Z"; return copy; })());
  near(combatPanelLayoutFor({ sides: sides(1, 1), pack: dome }).hudTop, 288.75 + 46.65 - 40, "the dome's peak");
  // And a quadratic that ENDS at the top, with nothing after it but the close:
  // from (10, 0) under (10, -20) to (5, -60) has no turning point, so -60 is
  // its end point alone — 288.75 + 46.65 - 60 = 275.40.
  const spire = combatPanelPackFrom((() => { const copy = syntheticIcons(); copy.shapes[730].paths[0].d = "M0 0L10 0Q10 -20 5 -60Z"; return copy; })());
  near(combatPanelLayoutFor({ sides: sides(1, 1), pack: spire }).hudTop, 275.40, "the spire's tip, a quadratic's end point");
  // And a layout with no pack at all still works: the fallback's top.
  near(combatPanelLayoutFor({ sides: sides(1, 1), pack: null }).hudTop, 302.90, "no pack");
});

test("A CLUSTER LAID OUT FOR OTHER ART IS REFUSED BY NAME — or hudTop would describe art that is not drawn", () => {
  // The two arts' tops differ (the build's glass reaches higher than the
  // fallback's vial), so a layout made without the pack and drawn with it
  // reports a top below the ink it paints — silently, and to the camera.
  const pack = combatPanelPackFrom(syntheticIcons());
  const forFallback = combatPanelLayoutFor({ sides: sides(2, 2) }).clusters[0];
  const forPack = combatPanelLayoutFor({ sides: sides(2, 2), pack }).clusters[0];
  assert.throws(() => combatPanelOpsFor(pack, null, forFallback, row()), CombatPanelError, "the pack's ops on a fallback layout");
  assert.throws(() => combatPanelInvoiceFor(pack, null, forFallback, row()), CombatPanelError, "and its invoice");
  assert.throws(() => combatPanelFallbackOpsFor(forPack, row()), CombatPanelError, "the fallback's ops on a pack layout");
  // Each on its own layout draws.
  assert.ok(combatPanelOpsFor(pack, null, forPack, row()).length > 0);
  assert.ok(combatPanelFallbackOpsFor(forFallback, row()).length > 0);
  // No pack at all is still no ops (the caller's cue to draw the fallback), not a refusal.
  assert.equal(combatPanelOpsFor(null, null, forFallback, row()), null);
});

test("THE LIQUID MOVES BY THE BUILD'S DRIVE, NOT THE PACK'S REST POSE — and the cutter stays put", () => {
  const pack = combatPanelPackFrom(syntheticIcons());
  const liquidOf = (reading, which = "health", colour = "#cc0000") => {
    const ops = combatPanelOpsFor(pack, null, heroCluster(pack), row({ [which]: reading }));
    const found = ops.filter((op) => op.kind === "path" && op.fill === colour);
    assert.equal(found.length, 1, `${which}: one liquid op`);
    return found[0];
  };
  // hero_potion at (2035, 933) twips in the panel; the panel at (-0.05, 288.75)
  // on the stage = (-1, 5775) twips; blood_health's own x is -484 at rest and
  // never written. Its y is the DRIVE's, in whole pixels.
  for (const [value, max, y] of [[100, 100, -29], [50, 100, 6], [0, 100, 41], [110, 100, -36], [-5, 100, 44], [7, 0, 41]]) {
    const liquid = liquidOf(readingOf(value, max));
    assert.deepEqual(liquid.matrix.slice(0, 4), [1, 0, 0, 1]);
    near(liquid.matrix[4], -1 + 2035 - 484, `${value}/${max} tx`, 1e-6);
    near(liquid.matrix[5], 5775 + 933 + y * TWIPS, `${value}/${max} ty`, 1e-6);
    // The cutter: 727 at identity inside 733, so at the gauge's own origin — whatever the reading.
    assert.deepEqual(liquid.clip.matrix.map((value) => Math.round(value * 1e6) / 1e6), [1, 0, 0, 1, -1 + 2035, 5775 + 933]);
    assert.equal(liquid.clip.d, "M0 0L10 0L10 10L0 10Z", "the cutter's own path, resolved");
  }
  // The rest pose is never drawn: (-531 twips) is not a whole pixel.
  assert.notEqual(liquidOf(readingOf(100, 100)).matrix[5], 5775 + 933 - 531);
  // The armour gauge: 749 at (3410, 934), blood_health at x -494.
  const armour = liquidOf(readingOf(15, 20), "armour", "#808080");
  near(armour.matrix[4], -1 + 3410 - 494, "armour tx", 1e-6);
  near(armour.matrix[5], 5775 + 934 + gaugeDriveFor(15, 20).y * TWIPS, "armour ty", 1e-6);
});

test("the villain's cluster is the build's villain placements, and a team cluster is the same art scaled into its slot", () => {
  const pack = combatPanelPackFrom(syntheticIcons());
  const villainLiquid = combatPanelOpsFor(pack, null, villainCluster(pack), row({ health: readingOf(50, 100) }))
    .find((op) => op.fill === "#cc0000");
  near(villainLiquid.matrix[4], -1 + 10700 - 484, "villain_potion tx", 1e-6);
  near(villainLiquid.matrix[5], 5775 + 933 + 6 * TWIPS, "villain_potion ty", 1e-6);
  // 3v3: the slot-2 red cluster is the hero art at s, moved by the layout's matrix.
  const layout = combatPanelLayoutFor({ sides: sides(3, 3), pack });
  const cluster = layout.clusters[1];
  const [s, , , , tx, ty] = cluster.matrix;
  const liquid = combatPanelOpsFor(pack, null, cluster, row({ health: readingOf(50, 100) })).find((op) => op.fill === "#cc0000");
  assert.deepEqual(liquid.matrix.slice(0, 4).map((value) => Math.round(value * 1e9) / 1e9), [s, 0, 0, s].map((value) => Math.round(value * 1e9) / 1e9));
  near(liquid.matrix[4], tx * TWIPS + s * (2035 - 484), "scaled tx", 1e-6);
  near(liquid.matrix[5], ty * TWIPS + s * (933 + 6 * TWIPS), "scaled ty", 1e-6);
  near(liquid.clip.matrix[5], ty * TWIPS + s * 933, "the cutter scaled with it", 1e-6);
});

test("PAINT ORDER IS THE BUILD'S DEPTH ORDER: banner, name, then the gauges, each gauge's own layers in order", () => {
  const pack = combatPanelPackFrom(syntheticIcons());
  // Hero: banner d7, herotext d18, hero_potion d19, hero_stamina d38, hero_armour d47.
  assert.deepEqual(fillsOf(combatPanelOpsFor(pack, null, heroCluster(pack), row())),
    ["#ffcc00", "#ffffff", "#cc0000", "#dddddd", "#ffffff", "#0000cc", "#dddddd", "#808080", "#795520"]);
  // Villain: banner d1, villain_potion d9, villaintext d28, stamina d29, armour d55.
  const villainOps = combatPanelOpsFor(pack, null, villainCluster(pack), row({ id: "blue-1", teamId: "blue", colour: "#4c8fe0" }));
  assert.deepEqual(villainOps.map((op) => op.panel), [
    "banner", "health", "health", "health", "health", "health", "name", "energy", "energy", "energy", "energy", "energy",
    "armour", "armour", "armour", "armour"]);
});

test("THE ARMOUR GAUGE HIDES WHEN THE READING SAYS SO (armourclass <= 0); health and energy never do", () => {
  const pack = combatPanelPackFrom(syntheticIcons());
  const hidden = combatPanelOpsFor(pack, null, heroCluster(pack), row({ armour: readingOf(0, 20, false) }));
  assert.equal(hidden.filter((op) => op.panel === "armour").length, 0);
  assert.ok(hidden.some((op) => op.panel === "health") && hidden.some((op) => op.panel === "energy"));
  const shown = combatPanelOpsFor(pack, null, heroCluster(pack), row({ armour: readingOf(5, 20) }));
  assert.ok(shown.filter((op) => op.panel === "armour").length > 0);
});

test("WITH NO TEXT PACK the words are the page font's, at the build's own boxes, in the build's colours — and the name in his team's", () => {
  const pack = combatPanelPackFrom(syntheticIcons());
  const words = combatPanelOpsFor(pack, null, heroCluster(pack), row()).filter((op) => op.kind === "text");
  const byRole = Object.fromEntries(words.map((op) => [`${op.panel}:${op.role}`, op]));
  // The name: herotext's box (66.9..347.35 at -59.95) is LEFT-aligned, so the
  // word starts at its inner left edge (6.95 + the 2 px gutter), on the stage.
  const name = byRole["name:name"];
  assert.equal(name.text, "Maximus");
  assert.equal(name.fill, "#e0584f", "his team's colour");
  assert.equal(name.align, "left");
  near(name.x, -0.05 + 6.95 + 2, "name x");
  near(name.y, 288.75 + 85.2 + (18.8 - 2) / 2, "name y");
  // The health number: 731's box centre inside 733, inside the panel: (0, 6.825) + (101.75, 46.65).
  const health = byRole["health:number"];
  assert.equal(health.text, "50 / 100");
  assert.equal(health.fill, "#ffffff");
  near(health.x, -0.05 + 101.75 + (-38.8 + (79.6 - 2) / 2), "number x");
  near(health.y, 288.75 + 46.65 - 2.75 + (21.15 - 2) / 2, "number y");
  assert.equal(health.size, 14);
  assert.equal(byRole["armour:number"].fill, "#ffff00", "747 is yellow");
  assert.deepEqual(["health", "energy", "armour"].map((gauge) => byRole[`${gauge}:label`].text), ["HEALTH", "ENERGY", "ARMOUR"]);
  assert.deepEqual(["health", "energy", "armour"].map((gauge) => byRole[`${gauge}:label`].fill), ["#ffcc00", "#66ffff", "#ffff00"]);
  // The villain's name is RIGHT-aligned at villaintext's inner right edge.
  const villainName = combatPanelOpsFor(pack, null, villainCluster(pack), row({ name: "Brutus", colour: "#4c8fe0" }))
    .find((op) => op.kind === "text" && op.panel === "name");
  assert.deepEqual([villainName.align, villainName.fill], ["right", "#4c8fe0"]);
  near(villainName.x, -0.05 + 282.6 + 347.35 - 2, "villain name x");
  // No name, no word — and nothing counted as drawn in the page font.
  const nameless = { ...row({ name: "" }), health: readingOf(1, 2) };
  assert.equal(combatPanelOpsFor(pack, null, heroCluster(pack), nameless).filter((op) => op.panel === "name").length, 0);
  assert.equal(combatPanelInvoiceFor(pack, null, heroCluster(pack), nameless).wordsInPageFont, 6, "three numbers and three labels");
});

test("A TEXT PACK THAT CANNOT DRAW A WORD falls back to the page font for it — never a silently missing number or name", () => {
  const pack = combatPanelPackFrom(syntheticIcons());
  // Fields and statics present, but their fonts are not: no glyphs can come of them.
  const fontless = textPackFrom({ fonts: {}, fields: { 731: { id: 731, font: 118, bounds: { xMin: -40, xMax: 1592, yMin: -40, yMax: 423 }, fontHeight: 280 },
    734: { id: 734, font: 53, bounds: { xMin: 1338, xMax: 6947, yMin: -40, yMax: 376 }, fontHeight: 280 } },
  statics: { 732: { records: [{ font: 118, height: 200, x: 360, y: 200, glyphs: [[0, 100]] }] } } });
  const words = combatPanelOpsFor(pack, fontless, heroCluster(pack), row()).filter((op) => op.kind === "text");
  assert.deepEqual(words.filter((op) => op.panel === "health").map((op) => [op.role, op.text]), [["number", "50 / 100"], ["label", "HEALTH"]]);
  assert.deepEqual(words.filter((op) => op.panel === "name").map((op) => op.text), ["Maximus"]);
});

test("A FALLEN FIGHTER'S CLUSTER IS DRAWN AT 0.4, and the acting fighter's carries the ring's gold", () => {
  const pack = combatPanelPackFrom(syntheticIcons());
  const standing = combatPanelOpsFor(pack, null, heroCluster(pack), row());
  const fallen = combatPanelOpsFor(pack, null, heroCluster(pack), row({ alive: false }));
  assert.equal(fallen.length, standing.length);
  fallen.forEach((op, index) => {
    const was = standing[index];
    if (op.kind === "text") near(op.alpha, 0.4 * (was.alpha ?? 1), `word ${index}`, 1e-9);
    else near(op.fillOpacity, 0.4 * was.fillOpacity, `op ${index}`, 1e-9);
  });
  assert.equal(standing.filter((op) => op.panel === "acting").length, 0);
  const acting = combatPanelOpsFor(pack, null, heroCluster(pack), row({ acting: true }));
  const marks = acting.filter((op) => op.panel === "acting");
  assert.ok(marks.length > 0 && marks.some((op) => op.stroke === "#f2c14e"), "the target ring's gold (tools/arena/main.js paintTargetRing)");
  assert.ok(marks.every((op) => op.authored === true));
});

/* ------------------------------------------------------------------ */
/* 4. The authored fallback: same layout, same drive, no SS2 art       */
/* ------------------------------------------------------------------ */

test("THE FALLBACK IS AUTHORED: every path is this module's own M/L/Q/Z, inside its cluster, and nothing is borrowed", () => {
  for (const layout of [pairLayout(), combatPanelLayoutFor({ sides: sides(3, 2) })]) {
    for (const cluster of layout.clusters) {
      const ops = combatPanelFallbackOpsFor(cluster, row({ acting: true, name: "Maximus" }));
      assert.ok(ops.length > 0);
      for (const op of ops) {
        assert.ok(op.kind === "path" || op.kind === "text", op.kind);
        if (op.kind !== "path") continue;
        assert.equal(op.authored, true, `${op.panel} is authored`);
        assert.match(op.d, /^M[-\d. MLQZ]*$/, "M/L/Q/Z only — the vocabulary the extracted shapes use");
        // Inside the cluster's box, control points included (the mark is inset; strokes are thin).
        const m = op.matrix;
        const numbers = op.d.match(/-?\d+(\.\d+)?/g).map(Number);
        for (let index = 0; index + 1 < numbers.length; index += 2) {
          const x = m[0] * numbers[index] + m[2] * numbers[index + 1] + m[4] / TWIPS;
          const y = m[1] * numbers[index] + m[3] * numbers[index + 1] + m[5] / TWIPS;
          if (op.panel === "health" || op.panel === "energy" || op.panel === "armour") {
            // A liquid rect runs past its vial on purpose: the cutter is what crops it.
            if (op.role === "liquid") continue;
          }
          assert.ok(x >= cluster.box.xMin - 0.01 && x <= cluster.box.xMax + 0.01 && y >= cluster.box.yMin - 0.01 && y <= cluster.box.yMax + 0.01,
            `${cluster.id} ${op.panel}/${op.role}: (${x}, ${y}) outside ${JSON.stringify(cluster.box)}`);
        }
      }
    }
  }
});

test("THE FALLBACK HAS THE SAME DRIVE: its liquid moves where the build's does, under a cutter that stays put", () => {
  for (const [value, max, y] of [[100, 100, -29], [50, 100, 6], [0, 100, 41], [110, 100, -36]]) {
    const ops = combatPanelFallbackOpsFor(heroCluster(), row({ health: readingOf(value, max) }));
    const liquids = ops.filter((op) => op.panel === "health" && op.role === "liquid");
    assert.ok(liquids.length > 0);
    for (const liquid of liquids) {
      near(liquid.matrix[4], -1 + 2035 - 484, `${value}/${max} tx: 733's rest x`, 1e-6);
      near(liquid.matrix[5], 5775 + 933 + y * TWIPS, `${value}/${max} ty`, 1e-6);
      assert.deepEqual(liquid.clip.matrix.map((part) => Math.round(part * 1e6) / 1e6), [1, 0, 0, 1, -1 + 2035, 5775 + 933]);
      assert.match(liquid.clip.d, /^M[-\d. MLQZ]*$/);
    }
  }
  const armour = combatPanelFallbackOpsFor(heroCluster(), row({ armour: readingOf(15, 20) }))
    .find((op) => op.panel === "armour" && op.role === "liquid");
  near(armour.matrix[4], -1 + 3410 - 494, "749's rest x", 1e-6);
  near(armour.matrix[5], 5775 + 934 + gaugeDriveFor(15, 20).y * TWIPS, "armour ty", 1e-6);
});

test("THE FALLBACK SAYS WHAT THE PACK SAYS: the numbers, the words, the name in his colour, armour hidden at 0, the fallen faded", () => {
  const ops = combatPanelFallbackOpsFor(heroCluster(), row());
  const byRole = Object.fromEntries(ops.filter((op) => op.kind === "text").map((op) => [`${op.panel}:${op.role}`, op]));
  assert.deepEqual(["health", "energy", "armour"].map((gauge) => byRole[`${gauge}:number`].text), ["50 / 100", "30 / 60", "10 / 20"]);
  assert.deepEqual(["health", "energy", "armour"].map((gauge) => byRole[`${gauge}:label`].text), ["HEALTH", "ENERGY", "ARMOUR"]);
  assert.deepEqual([byRole["name:name"].text, byRole["name:name"].fill, byRole["name:name"].align], ["Maximus", "#e0584f", "left"]);
  // The same boxes the pack's page-font stand-ins use: the number at 731's box centre.
  near(byRole["health:number"].x, -0.05 + 101.75 + (-38.8 + (79.6 - 2) / 2), "number x");
  near(byRole["health:number"].y, 288.75 + 46.65 - 2.75 + (21.15 - 2) / 2, "number y");
  near(byRole["name:name"].x, -0.05 + 6.95 + 2, "name x");
  const hidden = combatPanelFallbackOpsFor(heroCluster(), row({ armour: readingOf(0, 20, false) }));
  assert.equal(hidden.filter((op) => op.panel === "armour").length, 0);
  const fallen = combatPanelFallbackOpsFor(heroCluster(), row({ alive: false }));
  for (const op of fallen) {
    if (op.kind === "text") assert.ok(op.alpha <= 0.4 + 1e-9, `${op.panel} word at ${op.alpha}`);
    else assert.ok(op.fillOpacity <= 0.4 + 1e-9 && op.strokeOpacity <= 0.4 + 1e-9, `${op.panel}/${op.role}`);
  }
  assert.equal(ops.filter((op) => op.panel === "acting").length, 0);
  assert.ok(combatPanelFallbackOpsFor(heroCluster(), row({ acting: true })).some((op) => op.panel === "acting" && op.stroke === "#f2c14e"));
  // A team cluster is the same drawing, scaled: its words shrink with it.
  const small = combatPanelFallbackOpsFor(combatPanelLayoutFor({ sides: sides(3, 3) }).clusters[0], row());
  near(small.find((op) => op.role === "number").size, 14 * 316 / (3 * 215), "a 14 px number at s");
});

/* ------------------------------------------------------------------ */
/* 5. The player's own packs, any vintage                              */
/* ------------------------------------------------------------------ */

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets");
const ICONS_AT = path.join(ASSETS, "icons", "icons.json");
const TEXT_AT = path.join(ASSETS, "text", "text.json");
const MODULE_AT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "render", "combat-panel.js");

/** Ink box of path ops' anchor points (control points included), in stage px. */
function inkOf(ops) {
  const box = { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity };
  for (const op of ops) {
    const numbers = (op.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      const x = op.matrix[0] * numbers[index] + op.matrix[2] * numbers[index + 1] + op.matrix[4] / TWIPS;
      const y = op.matrix[1] * numbers[index] + op.matrix[3] * numbers[index + 1] + op.matrix[5] / TWIPS;
      box.xMin = Math.min(box.xMin, x); box.xMax = Math.max(box.xMax, x);
      box.yMin = Math.min(box.yMin, y); box.yMax = Math.max(box.yMax, y);
    }
  }
  return box;
}

test("THE REAL PACKS, ANY VINTAGE: the build's own gauges where the build draws them — or, on a stale pack, the fallback", (t) => {
  if (!fs.existsSync(ICONS_AT)) {
    t.skip("no extracted icons pack in this tree (a fresh clone): run node tools/extract-icons.mjs");
    return;
  }
  const raw = JSON.parse(fs.readFileSync(ICONS_AT, "utf8"));
  const text = fs.existsSync(TEXT_AT) ? textPackFrom(JSON.parse(fs.readFileSync(TEXT_AT, "utf8"))) : null;
  const pack = combatPanelPackFrom(raw);
  const layout = combatPanelLayoutFor({ sides: sides(1, 1) });
  if (!raw.gauges) {
    // A pack extracted before 2026-09-24: no section, so no pack, and the authored cluster draws — never a skip.
    assert.equal(pack, null);
    for (const cluster of layout.clusters) assert.ok(combatPanelFallbackOpsFor(cluster, row()).length > 0);
    return;
  }
  assert.ok(pack, "a pack with the gauges section reads");
  const section = raw.gauges;

  // 1. The hand-cited tables are the pack's: the drive, and every placement.
  assert.deepEqual({ ...SS2_GAUGE_DRIVE }, section.drive);
  near(SS2_COMBAT_PANEL.origin.x, section.attach.origin.x, "origin x", 1e-6);
  near(SS2_COMBAT_PANEL.origin.y, section.attach.origin.y, "origin y", 1e-6);
  for (const [side, def] of Object.entries(SS2_COMBAT_PANEL.clusters)) {
    const rows = section.placements.filter((placement) => placement.side === side);
    const banner = rows.find((placement) => placement.kind === "banner");
    const name = rows.find((placement) => placement.kind === "name");
    assert.deepEqual([def.banner.depth, def.banner.character, [...def.banner.matrix]], [banner.depth, banner.character, banner.matrix], `${side} banner`);
    assert.deepEqual([def.name.depth, def.name.character, def.name.align, [...def.name.matrix]], [name.depth, name.character, name.align, name.matrix], `${side} name`);
    for (const [reading, gauge] of Object.entries(def.gauges)) {
      const placement = rows.find((candidate) => candidate.reading === reading);
      assert.deepEqual([gauge.depth, gauge.character, gauge.instance, [...gauge.matrix]], [placement.depth, placement.character, placement.instance, placement.matrix], `${side} ${reading}`);
    }
    // 2. The cluster's box, from the pack's own shape bounds: the banner's x span and bottom, the glass top.
    const [ba, , , bd, btx, bty] = banner.matrix;
    const bannerShape = raw.shapes[pack.clips[52].frames[0][0].character].bounds;
    const xs = [bannerShape.xMin, bannerShape.xMax].map((x) => ba * x + btx / TWIPS);
    near(def.box.xMin, Math.min(...xs), `${side} box xMin`);
    near(def.box.xMax, Math.max(...xs), `${side} box xMax`);
    near(def.box.yMax, bd * bannerShape.yMax + bty / TWIPS, `${side} box yMax`);
  }
  // 2b. THE TOP IS THE ART'S: laid out WITH the pack, hudTop is the build's
  // highest unmasked ink, read here off the pack's own shape BOUNDS (the
  // module measures the drawn PATHS: two readings, one answer) — the vial
  // glass, 730/739, top -36.1 under the gauge's 46.65 = 10.55 panel px, so
  // 299.30 for a pair and 404.10 - s x (115.35 - 10.55) for a team.
  let glassTop = Infinity;
  for (const gauge of Object.values(SS2_COMBAT_PANEL.clusters.hero.gauges)) {
    for (const placement of pack.clips[gauge.character].frames[0]) {
      if (placement.kind !== "shape" || placement.mask) continue;
      glassTop = Math.min(glassTop, raw.shapes[placement.character].bounds.yMin + placement.matrix[5] / TWIPS + gauge.matrix[5] / TWIPS);
    }
  }
  near(glassTop, 10.55, "the build's highest unmasked ink, from the bounds");
  // And it IS the ink the module emits: every size, acting or not, in the
  // build's glyphs and in the page font, at every kind of reading.
  const readings = {
    typical: () => row(),
    full: () => row({ health: readingOf(100, 100), energy: readingOf(60, 60), armour: readingOf(20, 20) }),
    overMax: () => row({ health: readingOf(150, 100), energy: readingOf(90, 60), armour: readingOf(30, 20) }),
    empty: () => row({ health: readingOf(0, 100), energy: readingOf(0, 60), armour: readingOf(0, 20, false) }),
    fallen: () => row({ alive: false, health: readingOf(0, 100) })
  };
  for (const [n, expected] of [[1, 299.30], [2, 327.08], [3, 352.76]]) {
    const laidOut = combatPanelLayoutFor({ sides: sides(n, n), pack });
    near(laidOut.hudTop, 404.10 - laidOut.scale * (115.35 - glassTop), `${n}v${n}: the glass, from the bounds`);
    near(laidOut.hudTop, expected, `${n}v${n}: hudTop worked by hand`);
    for (const [name, make] of Object.entries(readings)) {
      for (const acting of [null, "red-1"]) {
        for (const glyphs of [text, null]) {
          const ops = laidOut.clusters.flatMap((cluster) =>
            combatPanelOpsFor(pack, glyphs, cluster, { ...make(), id: cluster.id, acting: cluster.id === acting }, { stageScale: 1 }));
          near(laidOut.hudTop, hudInkTopOf(ops), `${n}v${n} ${name}, ${acting ?? "nobody"} acting, ${glyphs ? "glyphs" : "page font"}: hudTop against the ink`, 1e-9);
        }
      }
    }
  }

  // 3. The fallback stands where the pack draws: its boxes are the pack's own.
  for (const [gauge, look] of Object.entries(SS2_FALLBACK_ART.gauges)) {
    const sprite = pack.clips[SS2_COMBAT_PANEL.clusters.hero.gauges[gauge].character].frames[0];
    const texts = sprite.filter((placement) => placement.kind === "text");
    const number = texts.find((placement) => raw.texts[placement.character].kind === "edit-text");
    const label = texts.find((placement) => raw.texts[placement.character].kind === "static-text");
    assert.deepEqual([...look.number], number.matrix, `${gauge} number placement`);
    assert.deepEqual(SS2_FALLBACK_ART.numberBox, raw.texts[number.character].bounds, `${gauge} number box`);
    assert.deepEqual([...look.label.matrix], label.matrix, `${gauge} label placement`);
    assert.deepEqual({ ...look.label.bounds }, raw.texts[label.character].bounds, `${gauge} label box`);
    const liquid = sprite.find((placement) => placement.name === "blood_health");
    assert.equal(look.liquid.restX, liquid.matrix[4], `${gauge} rest x`);
    const liquidShape = raw.shapes[pack.nested[liquid.character].frames[0][0].character].bounds;
    assert.deepEqual([look.liquid.xMin, look.liquid.xMax, look.liquid.yMin, look.liquid.yMax],
      [liquidShape.xMin, liquidShape.xMax, liquidShape.yMin, liquidShape.yMax], `${gauge} liquid extents`);
  }
  assert.deepEqual({ ...SS2_FALLBACK_ART.nameBox }, raw.texts[734].bounds);
  assert.deepEqual({ ...SS2_FALLBACK_ART.nameBox }, raw.texts[735].bounds);

  // 4. THE REAL OPS: the liquid under the build's own cutter, moved by the drive.
  const packLayout = combatPanelLayoutFor({ sides: sides(1, 1), pack });
  const hero = packLayout.clusters[0];
  const reading = row({ health: readingOf(50, 100), energy: readingOf(59, 60), armour: readingOf(3, 12) });
  const ops = combatPanelOpsFor(pack, text, hero, reading, { stageScale: 2 });
  const cutterPath = (id) => raw.shapes[id].paths.map((cut) => cut.d).join("");
  const healthLiquid = ops.filter((op) => op.panel === "health" && op.clip);
  assert.ok(healthLiquid.length > 0 && healthLiquid.every((op) => op.clip.d === cutterPath(727)), "728 under 727's own path");
  const liquidInk = inkOf(healthLiquid);
  near(liquidInk.yMin, 288.75 + 46.65 + 6 + raw.shapes[728].bounds.yMin, "the liquid's top at Y(50) = 6", 0.06);
  const armourLiquid = ops.filter((op) => op.panel === "armour" && op.clip);
  assert.ok(armourLiquid.every((op) => op.clip.d === cutterPath(743)));
  // The glyphs: the numbers the build prints, in its own font, under its black glow; the name in his colour.
  const spelled = (panel, role) => ops.filter((op) => op.panel === panel && op.role === role && op.glyph).map((op) => op.glyph.char).join("");
  if (text) {
    assert.equal(spelled("health", "number"), "50/100", "\"50 / 100\" (the spaces ink nothing)");
    assert.equal(spelled("energy", "number"), "59/60");
    assert.equal(spelled("armour", "number"), "3/12");
    assert.equal(spelled("health", "label"), "HEALTH");
    assert.equal(spelled("energy", "label"), "ENERGY");
    assert.equal(spelled("armour", "label"), "ARMOUR");
    assert.equal(spelled("name", "name"), "Maximus");
    assert.ok(ops.filter((op) => op.panel === "name" && op.glyph).every((op) => op.fill === "#e0584f" && op.group),
      "the name in his team's colour, under the build's glow");
    assert.ok(ops.filter((op) => op.role === "number" && op.glyph).every((op) => op.group && (op.group.filter || op.group.amplify)));
    const invoice = combatPanelInvoiceFor(pack, text, hero, reading);
    assert.equal(invoice.wordsInPageFont, 0);
    assert.equal(invoice.bevelsDrawnPlain, 1, "the banner's bevel, counted");
    assert.deepEqual([invoice.shapesMissing, invoice.cuttersMissing, invoice.unsupported], [0, 0, 0], "the whole cluster is the build's");
  }
  // The villain's liquid: 733 at (535, 46.65).
  const villainInk = inkOf(combatPanelOpsFor(pack, text, packLayout.clusters[1], row({ health: readingOf(100, 100) }))
    .filter((op) => op.panel === "health" && op.clip));
  near(villainInk.yMin, 288.75 + 46.65 - 29 + raw.shapes[728].bounds.yMin, "villain at Y(100) = -29", 0.06);

  // 5. NO SS2 ART IN SOURCE: not one of the panel's path strings is in this module or its fallback.
  const source = fs.readFileSync(MODULE_AT, "utf8");
  const panelShapes = new Set();
  for (const entry of [...Object.values(pack.clips), ...Object.values(pack.nested)]) {
    for (const placement of entry.frames[0]) {
      if (placement.kind === "shape") panelShapes.add(placement.character);
      if (placement.mask) panelShapes.add(placement.mask.shape);
    }
  }
  assert.ok(panelShapes.size >= 11, `the panel's own shapes: ${[...panelShapes]}`);
  const fallbackPaths = new Set(layout.clusters.flatMap((cluster) =>
    combatPanelFallbackOpsFor(cluster, row({ acting: true })).filter((op) => op.kind === "path").map((op) => op.d)));
  for (const id of panelShapes) {
    for (const drawn of raw.shapes[id].paths) {
      assert.equal(source.includes(drawn.d), false, `shape ${id}'s path is in src/render/combat-panel.js`);
      assert.equal(fallbackPaths.has(drawn.d), false, `shape ${id}'s path is a fallback op`);
    }
  }
});
