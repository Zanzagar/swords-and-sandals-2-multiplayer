/**
 * WHERE A PROP'S ART LANDS ON THE CANVAS — the matrix `tools/arena/main.js`'s
 * `paintProp` draws every arena prop through, lifted out of that file so the
 * suite can reach it.
 *
 * ► **UNTIL 2026-09-23 THE PAINTER GOT TWO THINGS WRONG, AND BOTH WERE FOUND BY
 *   AN INVESTIGATOR RE-DRAWING THE STAGE IN NODE, NOT BY THIS SUITE.**
 *
 *   1. **It used the pack's TWIPS translations as pixels.** `tools/extract-props.mjs`
 *      leaves a placement's `tx`/`ty` in twips — "A consumer must divide by 20"
 *      — and `paintLayerOperation` always did; `paintPropOperation` did not.
 *      Every prop that had reached it before 2026-09-22 carried a zero
 *      translation, so it hid until the spell props: the lightning bolt
 *      (`-1330, -6880` twips) was painted about 6,800 pixels below the canvas
 *      and never seen, and the fireball's explosion (`30, 174`) floated a
 *      figure height over its victim.
 *   2. **It flipped the art vertically.** It scaled by `(k, -k)` — "arena y is
 *      UP and canvas y is DOWN" — but a prop's paths are the SWF's own, and
 *      SWF y is DOWN like the canvas's. The figure is pre-flipped before it
 *      meets that `-k` (`extracted-figure.js`); no prop ever was. So the arena
 *      rocks stood on their heads with their shadows above them, the explosion
 *      burst downwards, and — because the arrow's art points UP and the build
 *      turns it with `_rotation` — every snipe flew tail first.
 *
 * The seam is two pure functions in `src/render/props.js`: the ORIGIN matrix
 * (where the prop's registration point goes, and how it is scaled, turned and
 * mirrored) and the PLACEMENT matrix (one operation's own transform, in
 * pixels). The painter composes them; these tests compose them the same way.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  boltOpsFor, fireballOpsFor, arrowOpsFor, boulderOpsFor, propOpsFor, propOriginMatrix, propPackFrom,
  propPlacementMatrix, spellEffectDrawAt
} from "../src/render/index.js";

/** A canvas projection with round numbers: arena x 0 at canvas 100, feet at 500, 2 px a unit. */
const VIEW = Object.freeze({
  scale: 2,
  toX: (x) => 100 + 2 * x,
  toY: (y, lift = 0) => 500 - 2 * (200 - y) - 2 * lift
});

/** `outer` then `inner`, as canvas's `transform()` composes them. */
function compose(outer, inner) {
  return [
    outer[0] * inner[0] + outer[2] * inner[1],
    outer[1] * inner[0] + outer[3] * inner[1],
    outer[0] * inner[2] + outer[2] * inner[3],
    outer[1] * inner[2] + outer[3] * inner[3],
    outer[0] * inner[4] + outer[2] * inner[5] + outer[4],
    outer[1] * inner[4] + outer[3] * inner[5] + outer[5]
  ];
}

const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/* ------------------------------------------------------------------ *
 * The two matrices, on numbers worked by hand                         *
 * ------------------------------------------------------------------ */

test("a placement's translation is TWIPS: 20 of them are one pixel of the prop's own art", () => {
  assert.deepEqual(propPlacementMatrix([1, 0, 0, 1, 200, -400]), [1, 0, 0, 1, 10, -20]);
  // The bolt's own placement, off the pack: -1330, -6880 twips.
  assert.deepEqual(propPlacementMatrix([1, 0, 0, 1, -1330, -6880]), [1, 0, 0, 1, -66.5, -344]);
  // The scale and skew terms are already unit-free and pass through untouched.
  assert.deepEqual(propPlacementMatrix([0.5, 0.25, -0.25, 0.5, 0, 0]), [0.5, 0.25, -0.25, 0.5, 0, 0]);
  assert.equal(propPlacementMatrix(null), null);
});

test("the origin goes where the view puts the arena point, scaled by size times the view's scale", () => {
  // x 10 -> 100 + 20; depth 200, lift 50 -> 500 - 100; k = 1.5 * 2.
  assert.deepEqual(propOriginMatrix(VIEW, { x: 10, y: 200, lift: 50, size: 1.5 }), [3, 0, 0, 3, 120, 400]);
});

test("SWF art is y-DOWN like the canvas, so a point below the registration is drawn BELOW it", () => {
  const origin = propOriginMatrix(VIEW, { x: 0, y: 200, lift: 0, size: 1 });
  const [, below] = apply(origin, [0, 10]);
  assert.equal(below, 520, "10 px under the registration point, at 2 px a unit: not 480");
});

test("`mirrored` is a negative `_xscale`: x flips, y does not", () => {
  const m = propOriginMatrix(VIEW, { x: 0, y: 200, lift: 0, size: 1, mirrored: true });
  assert.deepEqual(m, [-2, 0, 0, 2, 100, 500]);
});

test("rotation is Flash's `_rotation`, clockwise on screen: art pointing UP turned 90 points RIGHT", () => {
  // The arrow's art points up (`bullet`, frame 5: the head is at y -28, the
  // fletching at +28), and a right-facing snipe is `_rotation = 90`
  // (`+0x7498`). Its head must lead.
  const m = propOriginMatrix(VIEW, { x: 0, y: 200, lift: 0, size: 1, rotation: Math.PI / 2 });
  const [hx, hy] = apply(m, [0, -28]);
  assert.ok(Math.abs(hx - (100 + 56)) < 1e-9, `the head is 56 px to the right, got ${hx}`);
  assert.ok(Math.abs(hy - 500) < 1e-9);
  const [tx] = apply(m, [0, 28]);
  assert.ok(tx < 100, "and the fletching trails");
});

/* ------------------------------------------------------------------ *
 * The build's own art, when this machine has extracted it             *
 * ------------------------------------------------------------------ */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

function readRealProps() {
  const at = path.join(REPO_ROOT, "assets", "props", "props.json");
  return fs.existsSync(at) ? propPackFrom(JSON.parse(fs.readFileSync(at, "utf8"))) : null;
}

const REAL_PROPS = readRealProps();

/** The absence is anchored on a TRACKED file, so a broken `REPO_ROOT` fails by name. */
function assertRealPackPathIsDerivable() {
  const anchor = path.join(REPO_ROOT, "tools", "extract-props.mjs");
  assert.ok(fs.existsSync(anchor), `${anchor} is not there, so REPO_ROOT is wrong`);
}

/** Every point of every operation, through origin then placement, as the painter draws it. */
function canvasBox(ops, origin) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const op of ops) {
    const m = compose(origin, propPlacementMatrix(op.matrix));
    const numbers = (op.d.match(/-?[\d.]+(?:e-?\d+)?/gi) ?? []).map(Number);
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      const [x, y] = apply(m, [numbers[index], numbers[index + 1]]);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  return { x0, y0, x1, y1 };
}

const UNIT_VIEW = Object.freeze({ scale: 1, toX: (x) => 640 + x, toY: (y, lift = 0) => 600 - (200 - y) - lift });
const DEPS = Object.freeze({
  frontY: 200, rankStride: 97, figureScaleFor: () => 1, rankOfDepth: () => 0
});

test("the lightning bolt strikes its victim: its foot is at the victim's feet, over the victim's x", () => {
  assertRealPackPathIsDerivable();
  if (!REAL_PROPS) return;
  // `_x: defender._x, _y: 50`, fighters at 200: the bolt's origin is 150 up.
  const drawn = spellEffectDrawAt({ x: 250, y: 200, endsWithClip: "lightning" }, 0, DEPS);
  const origin = propOriginMatrix(UNIT_VIEW, drawn);
  const feet = UNIT_VIEW.toY(200, 0);
  for (const frame of [1, 2]) {
    const box = canvasBox(boltOpsFor(REAL_PROPS, frame, 0), origin);
    assert.ok(box.y1 <= feet && box.y1 > feet - 10,
      `frame ${frame}: the bolt ends ${feet - box.y1} units above the feet (7.1 measured), not off the canvas`);
    // The head of the build's gladiator at `_yscale` 100: its 222.65-pixel
    // `standing` clip, drawn 1:1 (~~150~~, the authored figure, until 2026-09-23).
    assert.ok(box.y0 < UNIT_VIEW.toY(200, 222.65), `frame ${frame}: and it comes down from above the head`);
    const centre = (box.x0 + box.x1) / 2;
    assert.ok(Math.abs(centre - UNIT_VIEW.toX(250)) < 10, `frame ${frame}: centred on the victim, got ${centre}`);
  }
});

test("the fireball's explosion bursts ON its victim's body, not a figure height over it", () => {
  assertRealPackPathIsDerivable();
  if (!REAL_PROPS) return;
  // The explosion plays where the ball stopped: at the snipe's launch height,
  // `_yscale * 1.5 + 5` arena units — 155 at `_yscale` 100 — against the
  // build's 222.65-unit figure. ~~155/230 of a 150-unit figure, about 101
  // units up, against a 150-unit head~~ until 2026-09-23.
  const origin = propOriginMatrix(UNIT_VIEW, { x: 250, y: 200, lift: 155, size: 1 });
  const head = UNIT_VIEW.toY(200, 222.65);
  const feet = UNIT_VIEW.toY(200, 0);
  for (const age of [0, 9, 15]) {
    const box = canvasBox(fireballOpsFor(REAL_PROPS, 4, age), origin);
    const middle = (box.y0 + box.y1) / 2;
    assert.ok(middle > head && middle < feet,
      `age ${age}: the burst is centred at ${middle}, which must be between head ${head} and feet ${feet}`);
  }
});

test("the arena's rocks stand on their shadows, not under them", () => {
  assertRealPackPathIsDerivable();
  if (!REAL_PROPS) return;
  const ops = propOpsFor(REAL_PROPS, { linkage: "rockMC", frame: 1 });
  const origin = propOriginMatrix(UNIT_VIEW, { x: 2160, y: 210, lift: 0, size: 1 });
  const shadow = canvasBox(ops.filter((op) => op.fill === "#000000"), origin);
  const body = canvasBox(ops.filter((op) => op.fill === "#cccccc"), origin);
  assert.ok(shadow.y1 > body.y1, "the black shadow reaches lower than the grey body");
  assert.ok(body.y0 < shadow.y0, "and the body rises above it");
});

test("a right-facing snipe's arrow flies HEAD first", () => {
  assertRealPackPathIsDerivable();
  if (!REAL_PROPS) return;
  const ops = arrowOpsFor(REAL_PROPS, 5);
  const origin = propOriginMatrix(UNIT_VIEW, { x: 0, y: 200, lift: 100, size: 1, rotation: Math.PI / 2 });
  // The narrow white wedge at y -28..-20 is the head; the vanes are at +13..+28.
  const head = canvasBox(ops.filter((op) => op.fill === "#ffffff"), origin);
  const tail = canvasBox(ops.filter((op) => op.fill === "#660000"), origin);
  assert.ok(head.x0 > UNIT_VIEW.toX(0) && tail.x1 < UNIT_VIEW.toX(0),
    `head at ${head.x0}..${head.x1}, nock at ${tail.x0}..${tail.x1}, origin ${UNIT_VIEW.toX(0)}`);
});

test("molten death's boulder is read from the pack when it is there, and null tells the shell to author one", () => {
  // `tools/extract-props.mjs` has taken `boulder_combat` (sprite 33) since
  // 2026-09-23; a pack extracted before that answers null and the arena draws
  // its plain AUTHORED rock. A pack that carries it is read through the same
  // walk as every other prop.
  assert.equal(boulderOpsFor(null, 1), null);
  const fake = propPackFrom({
    props: { boulder_combat: { frames: [[{ shape: 5, matrix: [1, 0, 0, 1, 0, 0] }]] } },
    shapes: { 5: { bounds: {}, paths: [{ d: "M0 0L10 0L10 10Z", fill: "#553322" }] } }
  });
  const ops = boulderOpsFor(fake, 1);
  assert.ok(Array.isArray(ops));
  assert.equal(ops[0].fill, "#553322");
  if (REAL_PROPS) {
    assert.equal(boulderOpsFor(REAL_PROPS, 1) === null, !REAL_PROPS.props.boulder_combat,
      "the reader answers null exactly when this machine's pack predates the boulder");
  }
});
