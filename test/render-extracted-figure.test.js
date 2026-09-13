/**
 * The extracted rig: which clip a family plays, and where its limbs land.
 *
 * ► **The pack here is SYNTHETIC and tiny, for the same reason
 *   `test/swf-shapes.test.js` builds its own bytes.** A fixture of real
 *   `animations.json` would put extracted art — the POSE half of it — in the
 *   repository, which is the one thing `assets/` exists to prevent. What is
 *   pinned is the CONTRACT: the coordinate transform, the label join, and the
 *   fallback.
 *
 * What the real build contributes is numbers, quoted and not stored: 101
 * animations, 61 shapes, a `standing` clip 222.65 pixels tall. Reproduce them
 * with `node tools/extract-figure.mjs --report`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ExtractedFigureError,
  animationFor,
  figurePackFrom,
  hasExtractedArt,
  paintExtractedFigure,
  poseIndexAt
} from "../src/render/extracted-figure.js";
import { clipLabelsFor, directionalLabel } from "../src/render/clip-labels.js";
import { ATTACHMENTS, composeInClipSpace, loadoutFrom } from "../src/render/extracted-figure.js";

/** A square shape one pixel on a side, so a matrix is the only thing moving it. */
const SHAPES = Object.freeze({
  1: { bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, paths: [{ d: "M0 0L1 0L1 1L0 1L0 0Z", fill: "#804020", fillOpacity: 1, fillRule: "evenodd", stroke: "#000000", strokeOpacity: 1, strokeWidth: 2 }] },
  2: { bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, paths: [{ d: "M0 0L1 0L1 1L0 1L0 0Z", fill: "#ffffff", fillOpacity: 1 }] }
});

/**
 * `standing` is 100 clip pixels tall with its feet at y 0 and its head at
 * y -100, which is the build's own sign convention: y runs DOWN.
 */
function packOf(extra = {}) {
  return figurePackFrom(SHAPES, {
    standing: {
      label: "Standing", firstFrame: 2, lastFrame: 3,
      bounds: { xMin: -20, xMax: 20, yMin: -100, yMax: 0 },
      poses: [
        [{ shape: 1, limb: "torso", depth: [23, 1], matrix: [1, 0, 0, 1, 0, -1000] }],
        [{ shape: 1, limb: "torso", depth: [23, 1], matrix: [1, 0, 0, 1, 0, -1200] }]
      ]
    },
    ...extra
  });
}

const anim = (poses, bounds = { xMin: -20, xMax: 20, yMin: -100, yMax: 0 }) =>
  ({ label: "x", firstFrame: 1, lastFrame: poses.length, bounds, poses });

test("a pack without a `standing` animation is refused, because it is the size datum", () => {
  assert.throws(() => figurePackFrom(SHAPES, {}), (error) => {
    assert.ok(error instanceof ExtractedFigureError);
    assert.match(error.message, /standing/);
    return true;
  });
  assert.throws(() => figurePackFrom(null, { standing: anim([[]]) }), /shapes\.json/);
  assert.throws(() => figurePackFrom(SHAPES, null), /animations\.json/);
  assert.throws(
    () => figurePackFrom(SHAPES, { standing: anim([[]], { xMin: 0, xMax: 1, yMin: 5, yMax: 5 }) }),
    /no height/
  );
});

test("no pack means no operations — the caller falls back, it does not crash", () => {
  assert.equal(hasExtractedArt(null), false);
  assert.equal(hasExtractedArt({}), false);
  assert.equal(animationFor(null, { family: "standing" }), null);
  assert.deepEqual(paintExtractedFigure(null, { family: "standing" }), []);
  assert.ok(hasExtractedArt(packOf()));
});

test("a family the pack has no clip for returns NOTHING, which is an answer", () => {
  const pack = packOf();
  assert.equal(animationFor(pack, { family: "unknown", label: "nonsense" }), null);
  assert.deepEqual(paintExtractedFigure(pack, { family: "unknown", label: "nonsense" }), []);
  // `ranged` is a real family with real clips — the pack simply has neither.
  assert.ok(clipLabelsFor("ranged").length > 0);
  assert.equal(animationFor(pack, { family: "ranged", label: "bombard" }), null);
});

test("the ENGINE'S OWN label wins when it belongs to the family — twelve attacks are not one", () => {
  const pack = packOf({ attack1: anim([[]]), attack3: anim([[]]), attack7: anim([[]]) });
  assert.equal(animationFor(pack, { family: "attack", label: "attack3" }).label, "attack3");
  assert.equal(animationFor(pack, { family: "attack", label: "attack7" }).label, "attack7");
  // A label the pack lacks falls back through the family, in order.
  assert.equal(animationFor(pack, { family: "attack", label: "attack9" }).label, "attack1");
});

test("`taunt` is an attack AND a death variant, and membership keeps them apart", () => {
  // ► The collision is the build's own and `timeline.js` resolves it by ROLE.
  //   A bare "is this label in the pack?" would draw the ATTACKING taunt for a
  //   gladiator dying of one; requiring the label to belong to the family this
  //   timeline resolved to makes that impossible.
  const pack = packOf({ taunt: anim([[]]), deathtaunt: anim([[]]), death1: anim([[]]) });
  assert.equal(animationFor(pack, { family: "taunt", label: "taunt" }).label, "taunt");
  const dying = animationFor(pack, { family: "death:taunt", label: "taunt" });
  assert.notEqual(dying.label, "taunt", "a death must never resolve to the attack clip");
  assert.ok(clipLabelsFor("death:taunt").includes(dying.label));
});

test("a walk AWAY from the way you face is StepBack, which the build animates separately", () => {
  // The build has no `walkleft`/`walkright` clips — it has forward and back,
  // relative to the gladiator. Vanilla never retreats, so this never arose.
  assert.equal(directionalLabel("movement:walk", "walkright", "right"), "stepforward");
  assert.equal(directionalLabel("movement:walk", "walkleft", "right"), "stepback");
  assert.equal(directionalLabel("movement:walk", "walkleft", "left"), "stepforward");
  assert.equal(directionalLabel("movement:walk", "walkright", "left"), "stepback");
  // Non-directional families are untouched.
  assert.equal(directionalLabel("attack", "attack1", "left"), "attack1");
  assert.equal(directionalLabel("unknown", "x", "left"), null);

  const pack = packOf({ stepforward: anim([[]]), stepback: anim([[]]) });
  assert.equal(animationFor(pack, { family: "movement:walk", label: "walkleft", facing: "right" }).label, "stepback");
  assert.equal(animationFor(pack, { family: "movement:walk", label: "walkleft", facing: "left" }).label, "stepforward");
});

test("the LAST pose is reachable and the wrap is not", () => {
  // `at` of exactly 1 is the end of an action, not the start of a new loop. A
  // bare modulo shows pose 0 there, which reads as a twitch on every swing.
  assert.equal(poseIndexAt(31, 0), 0);
  assert.equal(poseIndexAt(31, 0.5), 15);
  assert.equal(poseIndexAt(31, 1), 30);
  assert.equal(poseIndexAt(31, 1.5), 30, "past the end clamps rather than wrapping");
  assert.equal(poseIndexAt(31, -1), 0);
  assert.equal(poseIndexAt(31, Number.NaN), 0);
  assert.equal(poseIndexAt(0, 0.5), 0);
});

test("clip space becomes arena space: y FLIPS, twips become pixels, feet land on the ground", () => {
  // The datum: `standing` is 100 clip pixels tall, so a 150-unit gladiator is
  // scaled by 1.5. Its feet are at clip y 0 and its head at clip y -100.
  const pack = packOf();
  const [op] = paintExtractedFigure(pack, { family: "standing", label: "Standing", at: 0, height: 1 });
  assert.equal(op.kind, "path");
  const [a, b, c, d, e, f] = op.matrix;

  const scale = 150 / 100;
  assert.equal(a, scale, "x scales by the arena-height ratio");
  assert.equal(d, -scale, "and y is NEGATED, because arena y runs UP and clip y runs DOWN");
  assert.equal(b, 0);
  assert.equal(c, 0);

  // tx 0 twips is clip x 0, which is 0.345 right of the reference midline... in
  // this synthetic pack the midline is exactly 0, so it stays 0.
  assert.equal(e, 0);
  // ty -1000 twips is clip y -50, fifty pixels ABOVE the feet, so in arena
  // units it is +50 * 1.5 UP from the ground.
  assert.equal(f, 75);
});

test("a limb at the ground datum lands at arena y ZERO, not wherever the clip's origin is", () => {
  const pack = figurePackFrom(SHAPES, {
    standing: {
      label: "Standing",
      // A clip whose feet are at y 40 rather than 0 — the origin is NOT the
      // ground, and a renderer that assumed it was would float the figure.
      bounds: { xMin: 0, xMax: 10, yMin: -60, yMax: 40 },
      poses: [[{ shape: 1, limb: "foot", depth: [17], matrix: [1, 0, 0, 1, 0, 800] }]]
    }
  });
  const [op] = paintExtractedFigure(pack, { family: "standing", label: "Standing", at: 0, height: 1 });
  // 800 twips is clip y 40, which IS the ground, so it must come out at 0.
  assert.equal(op.matrix[5], 0);
});

test("a taller gladiator scales the whole rig through the MATRIX, and the stroke is not pre-scaled", () => {
  const pack = packOf();
  const [normal] = paintExtractedFigure(pack, { family: "standing", label: "Standing", at: 0, height: 1 });
  const [tall] = paintExtractedFigure(pack, { family: "standing", label: "Standing", at: 0, height: 1.2 });
  assert.equal(tall.matrix[0] / normal.matrix[0], 1.2);
  assert.equal(tall.matrix[5] / normal.matrix[5], 1.2);

  // ► **THIS TEST USED TO ASSERT `2 * (150 / 100)` AND THAT WAS THE BUG.** The
  //   matrix already carries the clip-to-arena scale and the shell sets
  //   `lineWidth` AFTER applying it, so pre-scaling here applied it twice —
  //   drawing every outline at 67.4% of its width on the real pack, with the
  //   error growing quadratically in `height`. The width stays in the SHAPE's
  //   own pixels and the composed transform does the rest.
  assert.equal(normal.strokeWidth, 2, "shape pixels, unscaled");
  assert.equal(tall.strokeWidth, 2, "and height changes the MATRIX, not this");
});

test("a colour transform tints the fill, which is how a frozen gladiator goes blue", () => {
  // Measured on the shipped build: 4,544 placements carry one, and they are the
  // condition tints. A renderer that ignored them draws a frozen gladiator
  // identical to a standing one.
  const pack = packOf({
    frozen: anim([[{ shape: 1, limb: "torso", depth: [23], matrix: [1, 0, 0, 1, 0, 0], colour: [0, 0, 2, 1, 0, 0, 100, 0] }]])
  });
  const [op] = paintExtractedFigure(pack, { family: "condition:frozen", label: "frozen", at: 0, height: 1 });
  // #804020 -> red 0x80*0 + 0 = 0, green 0x40*0 + 0 = 0, blue 0x20*2 + 100 = 164.
  assert.equal(op.fill, "#0000a4");
  // Untinted paths are untouched.
  const [plain] = paintExtractedFigure(pack, { family: "standing", label: "Standing", at: 0, height: 1 });
  assert.equal(plain.fill, "#804020");
});

test("fade becomes alpha, so a dying gladiator can dissolve", () => {
  const pack = packOf();
  const [op] = paintExtractedFigure(pack, { family: "standing", label: "Standing", at: 0, height: 1, fade: 0.25 });
  assert.equal(op.alpha, 0.75);
});

test("every operation carries the LIMB it belongs to, so a caller need not guess from geometry", () => {
  const pack = packOf();
  const ops = paintExtractedFigure(pack, { family: "standing", label: "Standing", at: 0, height: 1 });
  assert.ok(ops.length > 0);
  for (const op of ops) assert.equal(op.limb, "torso");
});

test("a BROKEN animation falls back whole, rather than drawing a gladiator short a limb", () => {
  // ► The first version skipped the bad placement and returned the rest, which
  //   is non-empty — so the caller never fell back and drew a figure with a
  //   limb missing. Rejecting the animation atomically is what makes the
  //   authored fallback actually happen.
  const pack = packOf({
    rest: anim([[
      { shape: 1, limb: "torso", depth: [23], matrix: [1, 0, 0, 1, 0, 0] },
      { shape: 999, limb: "ghost", depth: [1], matrix: [1, 0, 0, 1, 0, 0] }
    ]])
  });
  assert.equal(animationFor(pack, { family: "rest", label: "rest" }), null);
  assert.deepEqual(paintExtractedFigure(pack, { family: "rest", label: "rest" }), []);
});

test("a placement with no matrix is REFUSED, because throwing here freezes the arena", () => {
  // `frame()` calls `render()` and a throw used to stop the loop for good —
  // the same failure `cursor.js` was extracted for. Both halves are fixed: the
  // pack is rejected here, and the shell schedules its next frame in a
  // `finally` regardless.
  for (const bad of [undefined, [1, 0, 0, 1], [1, 0, 0, 1, 0, Number.NaN], "1,0,0,1,0,0"]) {
    const pack = packOf({ rest: anim([[{ shape: 1, limb: "torso", depth: [23], matrix: bad }]]) });
    assert.equal(animationFor(pack, { family: "rest", label: "rest" }), null, `matrix ${JSON.stringify(bad)}`);
    assert.doesNotThrow(() => paintExtractedFigure(pack, { family: "rest", label: "rest" }));
  }
});

test("dying of a taunt plays the build's OWN deathtaunt, which its frame order settles", () => {
  // `deathtaunt` is frames 1083-1116, inside the contiguous death block that
  // runs 585-1116; the attacking `taunt` is away at 1482-1511. The build files
  // it with the deaths, so the mapping is derived rather than guessed.
  const pack = packOf({ deathtaunt: anim([[]]), death1: anim([[]]), taunt: anim([[]]) });
  assert.equal(animationFor(pack, { family: "death:taunt", label: "taunt" }).label, "deathtaunt");
  assert.equal(clipLabelsFor("death:taunt")[0], "deathtaunt");
  // And a pack without it still dies, rather than refusing to.
  const thin = packOf({ death1: anim([[]]) });
  assert.equal(animationFor(thin, { family: "death:taunt", label: "taunt" }).label, "death1");
});

test("the four UNMAPPED death variants fall back to a death, and that is recorded not hidden", () => {
  // `slain`, `yield`, `arrow` and `grievous` name no clip in the build and
  // nothing says which they would be. They get a death animation; the loss is
  // that it is always the same one, and inventing the mapping is the move this
  // project forbids.
  const pack = packOf({ death1: anim([[]]), deathtaunt: anim([[]]) });
  for (const variant of ["slain", "yield", "arrow", "grievous"]) {
    const chosen = animationFor(pack, { family: `death:${variant}`, label: variant });
    assert.equal(chosen.label, "death1", `death:${variant}`);
    assert.ok(clipLabelsFor(`death:${variant}`).length > 1, "an unmapped variant offers the whole set");
  }
});

test("a pose that references only KNOWN shapes draws every one of them", () => {
  const pack = packOf({
    rest: anim([[
      { shape: 2, limb: "shield", depth: [35], matrix: [1, 0, 0, 1, 0, 0] },
      { shape: 1, limb: "torso", depth: [23], matrix: [1, 0, 0, 1, 0, 0] }
    ]])
  });
  const ops = paintExtractedFigure(pack, { family: "rest", label: "rest", at: 0, height: 1 });
  assert.deepEqual(ops.map((op) => op.limb), ["shield", "torso"], "in the pose's own paint order");
});


test("a loadout reads BOTH resource shapes, because the roster's and the projection's differ", () => {
  // ► **THIS IS THE BUG I SHIPPED FOR ONE COMMIT.** `loadoutFrom` read
  //   `resources[field]` as a number. That is true of the objects `demoSide`
  //   builds and FALSE of everything `host.combatant()` returns, which wraps
  //   every resource as `{value, min, max}`. `Number.isFinite({value: 2})` is
  //   false, so every slot was silently skipped and the arena drew a naked
  //   gladiator while my node check — run against the ROSTER — passed.
  //
  //   **Testing against the wrong shape is the same failure as testing against
  //   your own model.** Both shapes are pinned here.
  const projected = { resources: { helmet: { value: 2, min: 0, max: null }, breastplate: { value: 3, min: 0, max: null } } };
  assert.deepEqual(loadoutFrom(projected), { helmet: 2, breastplate: 3 });

  const roster = { resources: { helmet: 2, breastplate: 3 } };
  assert.deepEqual(loadoutFrom(roster), { helmet: 2, breastplate: 3 });

  // A flat combatant with no `resources` wrapper at all.
  assert.deepEqual(loadoutFrom({ helmet: 5 }), { helmet: 5 });

  // Absent is not zero: a slot the projection does not carry must not become
  // piece 0, which is a real shield in this build.
  assert.equal(loadoutFrom({}), null);
  assert.equal(loadoutFrom(null), null);
  assert.equal(loadoutFrom({ resources: { helmet: { value: null } } }), null);
});

test("the attachment table is the BUILD'S, and the shield's offset is the only one", () => {
  // Disassembled from `updatecharacter` at `0x40bf76`. Fifteen pieces attach at
  // the limb's own origin; the shield alone carries an init object.
  assert.equal(ATTACHMENTS.length, 16);
  const withOffset = ATTACHMENTS.filter((a) => a.offset);
  assert.equal(withOffset.length, 1);
  assert.equal(withOffset[0].slot, "shield");
  assert.deepEqual(withOffset[0].offset, { x: 0, y: 50 });
  assert.equal(withOffset[0].limb, "Rlowerarm", "NOT the empty depth-35 `shield` sprite");

  // Helmet and hair share a depth, which is what makes a helmet replace hair.
  const head = ATTACHMENTS.filter((a) => a.limb === "head");
  const helmet = head.find((a) => a.slot === "helmet");
  const hair = head.find((a) => a.slot === "hair");
  assert.equal(helmet.depth, hair.depth, "the build gives them the same depth");
});

test("an attached piece composes limb x piece in CLIP space, offset included", () => {
  const identity = [1, 0, 0, 1, 0, 0];
  // A limb translated 100 twips right, a piece at the limb's origin.
  assert.deepEqual(composeInClipSpace([1, 0, 0, 1, 100, 0], identity), [1, 0, 0, 1, 100, 0]);
  // The offset moves the PIECE inside the limb, so it adds before the limb's
  // own translation — and with a rotated limb it rotates with it.
  assert.deepEqual(composeInClipSpace([1, 0, 0, 1, 100, 0], identity, { x: 0, y: 50 }), [1, 0, 0, 1, 100, 50]);
  // A quarter-turn limb: the shield's +50 in y becomes -50 in x.
  const turned = composeInClipSpace([0, 1, -1, 0, 0, 0], identity, { x: 0, y: 50 });
  assert.deepEqual([turned[4], turned[5]], [-50, 0]);
});
