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
  ENCHANTMENT_FIELDS,
  ExtractedFigureError,
  animationFor,
  clipToArenaScale,
  figureEffectGroupsFor,
  figureInvoiceFor,
  figurePackFrom,
  hasExtractedArt,
  paintExtractedFigure,
  poseIndexAt,
  weaponEnchantmentFor
} from "../src/render/extracted-figure.js";
import { SHADOW_RADIUS_PER_SIGMA, canvasFilterFor } from "../src/render/filters.js";
import { UNMAPPED_CLIP_LABELS, allUnmappedLabels, clipLabelsFor, directionalLabel } from "../src/render/clip-labels.js";
import { ATTACHMENTS, attachmentsFor, composeInClipSpace, loadoutFrom } from "../src/render/extracted-figure.js";
import nodeFs from "node:fs";
import nodePath from "node:path";
import { fileURLToPath as toPath } from "node:url";

/**
 * The player's own EXTRACTED packs, or null on a clone with no licensed copy.
 *
 * Named `REAL_*` because this file already has a synthetic `SHAPES` fixture a
 * few lines below, and the two must never be confused: one is three hand-built
 * shapes that prove the algebra, the other is 351 shapes out of the build that
 * prove the algebra was pointed at the right thing.
 */
function readRealPack(relative) {
  const at = nodePath.join(toPath(new URL("..", import.meta.url)), relative);
  return nodeFs.existsSync(at) ? JSON.parse(nodeFs.readFileSync(at, "utf8")) : null;
}
const REAL_SHAPES = readRealPack("assets/figure/shapes.json");
const REAL_ANIMATIONS = readRealPack("assets/figure/animations.json");
const REAL_WARDROBE = readRealPack("assets/figure/wardrobe.json");

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
      ],
      // The LIMB matrices, which is what an attached piece is positioned by.
      // Without these the dressing loop cannot run at all — which is exactly
      // how it went untested.
      limbs: [
        { torso: [1, 0, 0, 1, 0, -1000], head: [1, 0, 0, 1, 0, -1800], Rlowerarm: [1, 0, 0, 1, 200, -1400] },
        { torso: [1, 0, 0, 1, 0, -1200], head: [1, 0, 0, 1, 0, -1900], Rlowerarm: [1, 0, 0, 1, 200, -1500] }
      ]
    },
    ...extra
  });
}

/** A minimal wardrobe: one square piece per slot asked for, at the limb origin. */
function wardrobeOf(slots) {
  const pieces = {};
  for (const [slot, ids] of Object.entries(slots)) {
    pieces[slot] = {};
    for (const id of ids) {
      pieces[slot][id] = {
        linkage: `${slot}${id}`, character: 9000 + id, frames: 1,
        placements: [{ shape: 2, matrix: [1, 0, 0, 1, 0, 0] }]
      };
    }
  }
  return { pieces, shapes: SHAPES };
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

test("the attachment table is the BUILD'S, and it is no longer SHORT", () => {
  // ► **THIS ASSERTION USED TO READ `ATTACHMENTS.length === 16` AND THAT
  //   CERTIFIED AN INCOMPLETE TABLE AS COMPLETE.** `updatecharacter` makes
  //   TWENTY attachMovie calls; the table had sixteen rows. The four missing
  //   were eyes, mouth and both weapon slots — so **89 of the 387 extracted
  //   wardrobe pieces, the entire weapon slot, were indexed by nothing** and
  //   every gladiator was faceless. A pinned count is only as good as the
  //   derivation behind it, and this one had none.
  //
  //   Eyes and mouth are NOT here: they take a fixed linkage (`eyes1`,
  //   `mouth1`) out of `assets/icons/`, not a wardrobe slot keyed by item id,
  //   so they are a different mechanism and are tracked separately rather than
  //   forced into this table to make a number come out right.
  assert.equal(ATTACHMENTS.length, 18, "16 wardrobe rows + the two weapon slots");

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

test("A BOW DRAWN MEANS NO SHIELD, and the primary weapon is put away", () => {
  // ► `updatecharacter` branches on `equipped_weapon`: `+0x0fa5` tests it,
  //   `+0x0fb7` jumps past the whole melee block on anything else, and the
  //   shield attach at `+0x1026` is INSIDE that block. The `== 2` branch at
  //   `+0x1051` attaches `secondary_weapon` and no shield at all.
  const melee = attachmentsFor({ equipped_weapon: 1 }).map((a) => a.field);
  const ranged = attachmentsFor({ equipped_weapon: 2 }).map((a) => a.field);

  assert.ok(melee.includes("shield"), "a melee gladiator carries his shield");
  assert.ok(melee.includes("weapon"), "and his primary weapon");
  assert.ok(!melee.includes("secondary_weapon"), "and not the bow at the same time");

  assert.ok(!ranged.includes("shield"), "AN ARCHER HAS NO SHIELD — this engine gave him one");
  assert.ok(!ranged.includes("weapon"), "nor his primary weapon");
  assert.ok(ranged.includes("secondary_weapon"), "he holds the bow");

  // Everything that is not weapon-dependent applies in both.
  const always = ATTACHMENTS.filter((a) => a.whenEquipped === undefined).map((a) => a.slot);
  for (const slot of always) {
    assert.ok(attachmentsFor({ equipped_weapon: 1 }).some((a) => a.slot === slot), `${slot} in melee`);
    assert.ok(attachmentsFor({ equipped_weapon: 2 }).some((a) => a.slot === slot), `${slot} at range`);
  }
});

test("an ABSENT equipped_weapon is melee, because that is what the build starts everyone in", () => {
  // Root frame 221 constructs both fighters in melee, so treating absence as 1
  // is the build's own default rather than a guess — but the absence is real
  // and is NOT written back onto the combatant as a fabricated 1.
  assert.deepEqual(attachmentsFor({}).map((a) => a.field), attachmentsFor({ equipped_weapon: 1 }).map((a) => a.field));
  assert.deepEqual(attachmentsFor(null).map((a) => a.field), attachmentsFor({ equipped_weapon: 1 }).map((a) => a.field));
  assert.equal(loadoutFrom({ resources: { helmet: 3 } }).equipped_weapon, undefined,
    "absent stays absent on the loadout");
});

test("THE WEAPON ATTACHES INTO A NESTED CLIP, and that clip is not at the origin", () => {
  // ► Measured on the oracle: char 703 (`weapon0`) places char 702 named
  //   `realweapon` at tx = ty = -70 TWIPS. The build attaches the weapon into
  //   `weapon.realweapon`, so assuming the nested target were identity would
  //   put every weapon 3.5 pixels out — small enough to read as a drawing
  //   style and never as a bug.
  for (const row of ATTACHMENTS.filter((a) => a.slot === "weapon")) {
    assert.equal(row.limb, "weapon");
    assert.equal(row.depth, 0, "attached at depth 0 of realweapon");
    assert.ok(row.nested, "the weapon has a nested target");
    assert.equal(row.nested.name, "realweapon");
    assert.deepEqual(row.nested.matrix, [1, 0, 0, 1, -70, -70]);
  }
  // And composing through it actually moves the piece, which is the whole point.
  const identity = [1, 0, 0, 1, 0, 0];
  const throughNested = composeInClipSpace(composeInClipSpace(identity, [1, 0, 0, 1, -70, -70]), identity);
  assert.deepEqual(throughNested, [1, 0, 0, 1, -70, -70]);
});

test("an attached piece composes limb x piece in CLIP space, offset included", () => {
  const identity = [1, 0, 0, 1, 0, 0];
  // A limb translated 100 twips right, a piece at the limb's origin.
  assert.deepEqual(composeInClipSpace([1, 0, 0, 1, 100, 0], identity), [1, 0, 0, 1, 100, 0]);
  // ► **THE OFFSET IS IN ACTIONSCRIPT PIXELS AND EVERYTHING ELSE IS IN TWIPS.**
  //   `_x`/`_y` are MovieClip properties in local pixels, so `_y: 50` is 1000
  //   twips. Adding it raw was a factor of twenty out, and this test asserted
  //   the raw version alongside the code that produced it.
  assert.deepEqual(composeInClipSpace([1, 0, 0, 1, 100, 0], identity, { x: 0, y: 50 }), [1, 0, 0, 1, 100, 1000]);
  // A quarter-turn limb: the shield's +50px in y becomes -1000 twips in x.
  const turned = composeInClipSpace([0, 1, -1, 0, 0, 0], identity, { x: 0, y: 50 });
  assert.deepEqual([turned[4], turned[5]], [-1000, 0]);
});


/* ------------------------------------------------------------------ */
/* DRESSING — added 2026-09-13 after a mutation audit found the loop    */
/* was never executed by any test at all.                               */
/* ------------------------------------------------------------------ */

/**
 * ► **TWO MUTATIONS SURVIVED THE SUITE AND BOTH WERE HERE.** A 20-agent audit
 *   broke one line at a time and ran the suite: 15 of 17 applied mutations went
 *   red, and the two that did not were "drop the ground datum for attached
 *   pieces" and "let hair draw through a helmet".
 *
 *   One agent instrumented it and proved the cause rather than guessing:
 *   `paintExtractedFigure` is called NINE times across the whole suite and
 *   every one of them passes no wardrobe, no loadout and no limbs — so the
 *   entire dressing block was dead code as far as the tests were concerned.
 *
 *   **And the test that LOOKED like coverage was not.** "the attachment table
 *   is the BUILD'S" asserts `helmet.depth === hair.depth` on the data table —
 *   the fact the suppression rule is DERIVED from, never the suppression
 *   itself — so it passes unchanged with the rule deleted.
 */
test("an attached piece lands on the SAME ground datum as the body it hangs off", () => {
  // The mutation that survived: dropping `- pack.groundY` from the attachment
  // matrix. Every piece would then be displaced by groundY * scale — gear
  // floating above or sunk below the gladiator — with the suite green.
  const pack = figurePackFrom(SHAPES, {
    standing: {
      label: "Standing",
      // Feet at clip y 40, NOT at the origin, so a dropped datum shows.
      bounds: { xMin: 0, xMax: 10, yMin: -60, yMax: 40 },
      poses: [[{ shape: 1, limb: "torso", depth: [23], matrix: [1, 0, 0, 1, 0, 800] }]],
      limbs: [{ torso: [1, 0, 0, 1, 0, 800] }]
    }
  });
  const ops = paintExtractedFigure(pack, {
    family: "standing", label: "Standing", at: 0, height: 1,
    wardrobe: wardrobeOf({ breastplate: [3] }), loadout: { breastplate: 3 }
  });
  const body = ops.find((op) => !op.slot);
  const piece = ops.find((op) => op.slot === "breastplate");
  assert.ok(body && piece, "the pose must contain both a body op and an attached one");
  // 800 twips is clip y 40, which IS the ground, so both land at arena y 0.
  assert.equal(body.matrix[5], 0);
  assert.equal(piece.matrix[5], 0, "the piece shares the body's datum, not the clip's origin");
});

test("a HELMET suppresses the hair, which is behaviour and not a fact about the table", () => {
  const pack = packOf();
  const wardrobe = wardrobeOf({ helmet: [3], hair: [4] });
  const slots = (loadout) => paintExtractedFigure(pack, {
    family: "standing", label: "Standing", at: 0, height: 1, wardrobe, loadout
  }).filter((op) => op.slot).map((op) => op.slot);

  assert.deepEqual(slots({ hairstyle: 4 }), ["hair"], "hair alone draws");
  assert.deepEqual(slots({ helmet: 3 }), ["helmet"], "a helmet alone draws");
  assert.deepEqual(slots({ hairstyle: 4, helmet: 3 }), ["helmet"],
    "and together the helmet REPLACES the hair — they share depth 5 in the build");
});

test("the dressing loop actually RUNS, which is the assertion that was missing", () => {
  // A positive control for the two above: if this ever returns no attached ops,
  // the tests beside it are passing vacuously again.
  const pack = packOf();
  const ops = paintExtractedFigure(pack, {
    family: "standing", label: "Standing", at: 0, height: 1,
    wardrobe: wardrobeOf({ breastplate: [3], shield: [5] }),
    loadout: { breastplate: 3, shield: 5 }
  });
  const attached = ops.filter((op) => op.slot);
  assert.equal(attached.length, 2, "one op per piece, since each test piece is one path");
  assert.deepEqual(attached.map((op) => op.slot).sort(), ["breastplate", "shield"]);
  assert.equal(attached.find((op) => op.slot === "shield").limb, "Rlowerarm");
});

test("the shield's 50-twip offset moves it, and moves it on the LIMB's axis", () => {
  const pack = packOf();
  const wardrobe = wardrobeOf({ shield: [5], gauntlet: [2] });
  const ops = paintExtractedFigure(pack, {
    family: "standing", label: "Standing", at: 0, height: 1, wardrobe,
    loadout: { shield: 5, gauntlet: 2 }
  });
  const shield = ops.find((op) => op.slot === "shield");
  const gauntlet = ops.find((op) => op.slot === "gauntlet");
  // Both hang off Rlowerarm at [1,0,0,1,200,-1400]; only the shield is offset.
  assert.equal(shield.limb, "Rlowerarm");
  assert.equal(gauntlet.limb, "Rlowerarm");
  const scale = 150 / 100;
  // ► **THIS ASSERTED 2.5 AND THAT WAS THE BUG.** `attachMovie`'s init object
  //   sets `_x`/`_y`, which are ActionScript MovieClip properties in local
  //   PIXELS; the matrices are in TWIPS. Adding them directly was a factor of
  //   twenty out, and the test pinned the wrong answer with the code.
  //
  //   The build's own numbers settle it: the same routine sets
  //   `head.eyes._y = -14` and the head shape is 55 pixels tall. As pixels that
  //   is a quarter of the head — an eye placement. As twips it is 0.7 pixels,
  //   which nobody would write.
  assert.equal(Math.round((gauntlet.matrix[5] - shield.matrix[5]) * 1000) / 1000, 50 * scale);
});

test("a malformed wardrobe is SKIPPED, because throwing here aborts the render loop forever", () => {
  // ► The shell catches a throw from `render()` and schedules another frame
  //   against the SAME bad data, so an exception here does not fall back — it
  //   aborts the draw every frame while the bout carries on underneath.
  const pack = packOf();
  const broken = {
    shapes: SHAPES,
    pieces: {
      breastplate: { 3: { linkage: "breastplate3", placements: [{ shape: 2 }] } },
      helmet: { 2: { linkage: "helmet2", placements: [{ shape: 2, matrix: [1, 0, 0, 1, Number.NaN, 0] }] } },
      boot: { 4: { linkage: "boot4", placements: [{ shape: 2, matrix: [1, 0, 0, 1] }] } },
      shield: { 5: { linkage: "shield5", placements: [{ shape: 2, matrix: [1, 0, 0, 1, 0, 0] }] } }
    }
  };
  const loadout = { breastplate: 3, helmet: 2, boot: 4, shield: 5 };
  let ops;
  assert.doesNotThrow(() => {
    ops = paintExtractedFigure(pack, { family: "standing", label: "Standing", at: 0, height: 1, wardrobe: broken, loadout });
  });
  // The three malformed pieces are skipped; the good one and the BODY survive.
  assert.deepEqual(ops.filter((op) => op.slot).map((op) => op.slot), ["shield"]);
  assert.ok(ops.some((op) => !op.slot), "the body is still drawn");
});

test("a piece paints with ITS LIMB, not after all of the body", () => {
  // ► The first version appended every attachment after every body part, in
  //   table order, and never read `attachment.depth`. `attachMovie` puts a
  //   piece INSIDE a limb clip, so it paints at that limb's place in the rig.
  //   Appending them all at the end lets a breastplate cover the head.
  const pack = packOf();
  const ops = paintExtractedFigure(pack, {
    family: "standing", label: "Standing", at: 0, height: 1,
    wardrobe: wardrobeOf({ breastplate: [3] }), loadout: { breastplate: 3 }
  });
  const torsoAt = ops.findIndex((op) => !op.slot && op.limb === "torso");
  const armourAt = ops.findIndex((op) => op.slot === "breastplate");
  assert.ok(torsoAt >= 0 && armourAt >= 0);
  assert.ok(armourAt > torsoAt, "the breastplate paints over its own torso");
  // And every body op carries the rig depth the merge sorts on.
  assert.ok(ops.filter((op) => !op.slot).every((op) => Number.isFinite(op.rigDepth)));
});

test("a loadout slot the wardrobe has no piece for is skipped, not drawn as nothing", () => {
  // The six body-armour families start at id 2, so `1` means UNEQUIPPED in the
  // build's own encoding — and the demo roster uses it.
  const pack = packOf();
  const ops = paintExtractedFigure(pack, {
    family: "standing", label: "Standing", at: 0, height: 1,
    wardrobe: wardrobeOf({ breastplate: [3] }),
    loadout: { breastplate: 3, gauntlet: 1, shinguard: 1 }
  });
  assert.deepEqual(ops.filter((op) => op.slot).map((op) => op.slot), ["breastplate"]);
});

test("every hurt, death and attack the CLIP has is a label the engine can reach", () => {
  // ► **`hurt8` WAS MISSING FOR THE `block` REASON**: the build binds it no
  //   sound, and that got written down as the animation not existing. Deaths
  //   were 13 of 13 and attacks 12 of 12, so it was the only hole — and it
  //   survived the `block` correction made earlier the same day, because fixing
  //   one instance of a habit does not fix the habit.
  //
  //   The numbers are the build's, quoted not stored: the fighter clip carries
  //   `hurt1`-`hurt12` and `hurt20`, `death1`-`death7`, `death21`-`death23`,
  //   `deathspike`, `deathtaunt`, `death_poisoned`, and `attack1`-`attack12`.
  const hurts = clipLabelsFor("hurt");
  for (let n = 1; n <= 12; n += 1) {
    assert.ok(hurts.includes(`hurt${n}`), `hurt${n} is in the clip and must be reachable`);
  }
  assert.ok(hurts.includes("hurt20"));
  assert.equal(hurts.length, 13);

  const attacks = clipLabelsFor("attack");
  for (let n = 1; n <= 12; n += 1) assert.ok(attacks.includes(`attack${n}`));
  assert.equal(attacks.length, 12);

  const deaths = clipLabelsFor("death:unknown");
  assert.equal(deaths.length, 13);
});

test("EVERY one of the fighter's labels is either played or declared unplayed", () => {
  // ► **THIS TEST EXISTS BECAUSE OF `hurt8`.** One label went missing from the
  //   hurt family because the build binds it no sound, and nothing noticed —
  //   the same conflation corrected for `block` hours earlier. Fixing one
  //   instance of a habit does not fix the habit; this closes it.
  //
  //   Measured on the shipped build: the fighter clip carries 101 labels, 73
  //   reachable by a family and 28 declared unplayed with a reason. A label
  //   that is in neither set is a SILENT DROP, which is what this catches.
  //
  //   **The split moved 60/41 -> 73/28 on 2026-09-14** when the thirteen
  //   `defend` clips stopped being declared unbuilt and became a family: the
  //   build's own `defender_blocked()` names which one answers which attack,
  //   so the mapping never needed the capture the old note asked for.
  //
  //   **And 73/28 -> 76/25 on 2026-09-16**, when `psyche_up`, `psyche_up2` and
  //   `psyche_up3` became the `psyche` family. Three handoffs had recorded them
  //   as blocked on an owner decision about "what those spells ARE";
  //   `psyche_up` is not a spell but a vanilla ACTION the battle map specifies
  //   in 31 places, and building the verb is what made the clips reachable.
  //
  //   **And 76/25 -> 77/24 later the same day, over `knockback`.** This file
  //   had it in `supersededBySibling`: "`knockback` the LABEL is a separate
  //   6-frame clip from `knockback_mov` and `shove`, which are what the family
  //   actually plays." **Backwards.** `damagecharacter` calls
  //   `gotoAndPlay("knockback")` at `+0x1b4f` and `+0x1bc0` and NOTHING
  //   dispatches `knockback_mov` — it is reached only by running off the end of
  //   `knockback`, which has no terminating action of its own. So this engine
  //   had been drawing the second half of a knockback and never the first.
  //
  //   ~~The four `continuations` stay declared unplayed and the word now means
  //   UNDISPATCHED: `clip-sequences.js` plays all four, as the tail of a run.~~
  //   **AND 77/24 -> 79/22 LATER THE SAME DAY, over the two `psyche_charging*`
  //   clips, which are not undispatched either.** `changeCombatants` names both
  //   with `gotoAndStop` — `+0x281e` and `+0x284d` for the attacker, `+0x287c`
  //   and `+0x28ab` for the defender — to hold a charged gladiator in the
  //   charged pose instead of `Standing`. They are the `stance:psyche*`
  //   families now. **Two labels are left in `continuations`, and they are the
  //   only two of the six run members that nothing anywhere names.**
  const families = [
    "standing", "rest", "block", "defend",
    "movement:walk", "movement:run", "movement:charge", "movement:jump", "movement:sidestep",
    "attack", "hurt", "knockback", "taunt", "taunted", "ranged", "psyche",
    "stance:psyche", "stance:psyche2", "celebrate", "cast", "magic:lightning", "drink",
    "rejuvinate", "colossus", "little_fat_kid", "wincrowd", "wincrowd:2", "wincrowd:4", "wincrowd:5",
    "condition:burning", "condition:frozen", "condition:poisoned", "condition:life_stolen",
    "death:unknown"
  ];
  const mapped = new Set(families.flatMap((family) => clipLabelsFor(family)));
  const declared = new Set(allUnmappedLabels());

  // Nothing may be in both: a label is played or it is not.
  const both = [...mapped].filter((label) => declared.has(label));
  assert.deepEqual(both, [], "a label cannot be both played and declared unplayed");

  // **79/22 -> 80/21 on 2026-09-17**, when the victory celebration was built:
  // overlay frames 65 and 77 dispatch `celebrate1`, so it stopped being an
  // `unbuiltOutcome`. `celebrate1a` stays declared — it is reached by running
  // on, exactly as the charging clips were before the stance.
  // **80/21 -> 82/19 on 2026-09-22**, when the bolt verbs got their family:
  // `Cast2` (`+0x8515`) and `lightning` (`damage_method`, `+0x858f`) are
  // dispatched by a verb this engine resolves. ~~`cast1` stays declared; no verb
  // dispatches it.~~ **82/19 -> 83/18 later the same day**, when `cast_gale`
  // was built: it dispatches `Cast1` (`+0x7b30`), which joined the `cast`
  // family behind `cast2`. **83/18 -> 84/17 later still**, when `drink_potion`
  // got its verb: the potion phase dispatches it (`+0x57c6`) and it is the
  // `drink` family now. **84/17 -> 87/14 later still**, when the last three
  // spell clips got families after their verbs: `Rejuvinate` (`+0x8ded`),
  // `Colossus` (`+0x806f`) and the victim's `little_fat_kid` (`+0x82a2`).
  // That empties `unbuiltSpells` and `unknown` both. **87/14 -> 93/8 later
  // still**, when `cast_adulation` began dispatching `wincrowd1` (`+0x7732`):
  // all six `wincrowd` clips got families at once, because the `wincrowd`
  // phase reaches every one (`+0x50de`). They had been filed as bout-end
  // celebrations; they are an in-bout action's, and only the two yields are
  // left in `unbuiltOutcome`.
  assert.equal(mapped.size, 93);
  assert.equal(declared.size, 8);
  assert.deepEqual([...UNMAPPED_CLIP_LABELS.unbuiltSpells], [], "every spell clip on the fighter is played");
  assert.deepEqual([...UNMAPPED_CLIP_LABELS.unknown], [], "and no label is left unclassified");
  assert.deepEqual([...UNMAPPED_CLIP_LABELS.unbuiltOutcome], ["yield1", "yield2"], "only the bout's outcome is unbuilt");
  assert.equal(mapped.size + declared.size, 101, "the fighter clip's own label count");

  // ► **THE ENTRY IS FIRST IN ITS FAMILY, and the order is what `animationFor`
  //   falls through.** `knockback` ahead of `knockback_mov` is the whole
  //   correction: put the continuation first and the engine draws the tail of
  //   the performance and calls it the performance.
  assert.equal(clipLabelsFor("knockback")[0], "knockback",
    "the build dispatches `knockback`; `knockback_mov` is what it runs on into");
  assert.deepEqual([...UNMAPPED_CLIP_LABELS.supersededBySibling], [],
    "the one entry in this bucket was there backwards and is retracted");

  // ► **THE DEFENCE SYSTEM IS BUILT, and this used to assert the opposite.**
  //   All thirteen `defend` clips are now PLAYED — `defender_blocked()` picks
  //   which one by `attack_direction`, exactly as `defender_hurt` picks a
  //   `hurt`. The old assertion here required them to be in `unbuiltDefence`,
  //   which is what a correct pin looks like right up until the thing is built.
  for (let n = 1; n <= 12; n += 1) assert.ok(mapped.has(`defend${n}`), `defend${n} must play`);
  assert.ok(mapped.has("defend20"));
  const defence = UNMAPPED_CLIP_LABELS.unbuiltDefence;
  assert.deepEqual([...defence], ["roll", "fumble1"],
    "only the two nothing dispatches are still declared unplayed");
});

test("AN ATTACHED WEAPON LANDS WHERE THE RIG'S OWN WEAPON ART DOES", () => {
  // ► **THE GLADIATOR WAS NEVER WEAPONLESS, AND THAT IS THE FINDING.** The rig
  //   draws char 701 — `weapon0`'s own art, a 9.45 x 26.4px gold object — at
  //   the `weapon` limb, rig depth 39, in every pose. Attaching an equipped
  //   weapon puts a bigger drawing at the SAME place: `updatecharacter` targets
  //   `weapon.realweapon`, which is a child of that same limb.
  //
  //   So the test is not "is there a weapon" but "does the attached one land
  //   where the rig's does". Measured on the standing pose, the two centres
  //   agree on y to within 1% of the figure's height; they differ on x exactly
  //   as two shapes of different size rotated about one origin must.
  //
  //   **This retired a ranked bug that four screenshots had called an absence.**
  //   The weapon limb is rotated about 101 degrees in Standing, so the sword
  //   lies across the hips — which is the BUILD'S pose, not a transform error,
  //   and at 1000px the whole figure is 45 pixels tall so a 73-unit sword is
  //   twenty. A render too small to show the thing is not evidence of absence.
  const pack = REAL_SHAPES && REAL_ANIMATIONS ? figurePackFrom(REAL_SHAPES, REAL_ANIMATIONS) : null;
  if (!pack || !REAL_WARDROBE) {
    assert.equal(pack === null || REAL_WARDROBE === null, true, "no extraction on this machine");
    return;
  }
  const paint = (loadout) => paintExtractedFigure(pack, {
    family: "standing", label: "Standing", facing: "right", at: 0,
    height: 150, wardrobe: REAL_WARDROBE, loadout
  });
  const centre = (ops, pick) => {
    let y0 = Infinity;
    let y1 = -Infinity;
    let seen = 0;
    for (const op of ops) {
      if (!pick(op)) continue;
      const numbers = (op.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      for (let index = 0; index + 1 < numbers.length; index += 2) {
        const y = op.matrix[1] * numbers[index] + op.matrix[3] * numbers[index + 1] + op.matrix[5];
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      seen += 1;
    }
    return seen > 0 ? { centre: (y0 + y1) / 2, ops: seen } : null;
  };

  const armed = paint({ weapon: 1, equipped_weapon: 1 });
  const rigWeapon = centre(armed, (op) => op.rigDepth === 39);
  const attached = centre(armed, (op) => op.slot === "weapon");
  assert.ok(rigWeapon, "the rig draws its own weapon art at depth 39 in every pose");
  assert.ok(attached, "and an equipped weapon is attached at the same limb");

  const figure = centre(armed, () => true);
  const drift = Math.abs(rigWeapon.centre - attached.centre) / Math.abs(figure.centre * 2);
  assert.ok(drift < 0.05,
    `the attached weapon is ${(drift * 100).toFixed(1)}% of the figure's height away from the rig's own `
    + "weapon art — it should share the limb, so this is a transform error");
});

/* ------------------------------------------------------------------ */
/* EFFECT GROUPS AND THE WEAPON ENCHANTMENT — added 2026-09-15.         */
/*                                                                      */
/* ► **READ THIS BEFORE TRUSTING ANY NUMBER BELOW.** The four labels     */
/*   that carry every one of this build's effect groups — `psyche_up`,   */
/*   `psyche_up2`, `psyche_charging`, `psyche_charging2` — are ALL       */
/*   declared unplayed (`unbuiltSpells` and `continuations`), so         */
/*   `animationFor` cannot reach one and `paintExtractedFigure` on the   */
/*   real pack, as the engine stands, emits ZERO group records. The      */
/*   tests that exercise the real glow records therefore mount           */
/*   `psyche_up2` UNDER A REACHABLE LABEL: the filter payloads are the   */
/*   build's own bytes, the dispatch is the test's. A test that only     */
/*   painted a reachable family would assert against a population of     */
/*   nought and stay green with the whole feature deleted.               */
/* ------------------------------------------------------------------ */

const REAL_ENCHANTMENTS = readRealPack("assets/figure/enchantments.json");

/** Three paths on one shape, so "how many ops sit under one group" can vary. */
const GLOW_SHAPES = Object.freeze({
  1: SHAPES[1],
  2: SHAPES[2],
  7: {
    bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    paths: [
      { d: "M0 0L1 0L1 1Z", fill: "#111111" },
      { d: "M0 0L0 1L1 1Z", fill: "#222222" },
      { d: "M0 0L1 1L0 1Z", fill: "#333333" }
    ]
  }
});

/** One glow, in the shape `parseFilterList` emits and `canvasFilterFor` reads. */
const aGlow = (blur, strength = 2, colour = { red: 0, green: 255, blue: 255, alpha: 255 }) => ({
  type: "glow", colour, blurX: blur, blurY: blur, strength,
  inner: false, knockout: false, compositeSource: true, passes: 1
});

/**
 * A pack whose `standing` clip is one pose of `shape` under `effects`, with a
 * `weapon` limb so the enchantment half can be reached as well.
 */
function glowPackOf({
  groups = [], effects = null, own = null, shape = 7, limbScale = 1,
  enchantments = null, placements = 1, rigWeapon = false
} = {}) {
  const pose = [];
  for (let n = 0; n < placements; n += 1) {
    pose.push({
      shape, limb: "torso", depth: [23, 1, 1], matrix: [1, 0, 0, 1, 0, -1000 - n],
      ...(effects ? { effects } : {}),
      ...(own ?? {})
    });
  }
  // ► **THE RIG'S OWN WEAPON ART, WHICH THIS FIXTURE DID NOT HAVE — AND ITS
  //   ABSENCE IS WHY THE SCOPE TEST BELOW COULD NOT FAIL.** In the real pack
  //   every pose carries `{limb: "weapon", depth: [39, 1, 1]}`, shape 701,
  //   INSIDE the `realweapon` placement that wears the glow. A fixture without
  //   one cannot tell "the glow covers the attachment only" from "the glow
  //   covers the whole weapon limb", which are different pictures — so the
  //   assertion passed under both and proved nothing about either.
  if (rigWeapon) {
    pose.push({ shape, limb: "weapon", depth: [39, 1, 1], matrix: [1, 0, 0, 1, 200, -1400] });
  }
  return figurePackFrom(GLOW_SHAPES, {
    standing: {
      label: "Standing", firstFrame: 1, lastFrame: 1,
      bounds: { xMin: -20, xMax: 20, yMin: -100, yMax: 0 },
      effectGroups: groups,
      poses: [pose],
      limbs: [{
        torso: [1, 0, 0, 1, 0, -1000],
        weapon: [limbScale, 0, 0, limbScale, 200, -1400]
      }]
    }
  }, enchantments);
}

const paintGlow = (pack, options = {}) =>
  paintExtractedFigure(pack, { family: "standing", label: "Standing", at: 0, height: 1, ...options });

test("ALL TWELVE EFFECT GROUPS REACH A GLADIATOR NOW, and two of them only via a run", () => {
  // ► **THIS TEST WAS "THE FOUR CLIPS ... ARE UNREACHABLE — say it, do not
  //   discover it", AND IT DID ITS JOB ON 2026-09-16.** It pinned all four
  //   carriers as declared-unplayed so that BUILDING the psyche family would
  //   turn it red and force this paragraph to be rewritten rather than quietly
  //   outlived. The family was built; it went red; this is the rewrite.
  //
  //   What changed: `Ss2ActionType.PSYCHE_UP` resolves, `legalActions` offers
  //   it on every controller frame, and `clip-labels.js` carries a `psyche`
  //   family — so `psyche_up` and `psyche_up2` are now DISPATCHED and the glow
  //   this module carries reaches a real gladiator.
  //
  // ► ~~**THE OTHER TWO ARE STILL UNREACHABLE AND THAT IS A DESIGN, NOT A GAP.**
  //   This engine dispatches ONE animation per action and has no concept of a
  //   sequence.~~ **HALF RIGHT, AND THE WRONG HALF WAS LOAD-BEARING —
  //   CORRECTED LATER THE SAME DAY.** The engine having no sequence was true;
  //   the BUILD having none was never checked, and it is false. Export 1241
  //   carries no terminating action between 1609 and 1625, so
  //   `gotoAndPlay("psyche_up")` runs to the `Stop` at 1626 and plays
  //   `psyche_charging` as the second half of one performance.
  //
  //   **The evidence this paragraph offered was the wrong evidence too.** "No
  //   `StartSound` binding" is true of 21 of the 101 labels and of only four
  //   continuations; `block`, `standing` and `taunted` are silent and continue
  //   nothing, while `hurt8` and `knockback` are silent ENTRY points whose
  //   sound fires on the continuation. Silence never said where the playhead
  //   stops. `tools/clip-sequences.mjs` reads that from the frame actions.
  //
  //   **So all twelve groups reach a gladiator** — the two that used to be
  //   stranded by running on, and, since the stance landed hours later, by
  //   being HELD as well: a gladiator carrying a charge stands in
  //   `psyche_charging` and glows while he does it. That second route is why
  //   both labels stopped being declared undispatched.
  //
  //   **Measured from the pack rather than asserted: 12 group entries, 10 on
  //   the two clips dispatched directly (1 on `psyche_up`, 9 on `psyche_up2`)
  //   and 2 on the continuations that their runs now carry.**
  const declared = new Set(allUnmappedLabels());
  for (const label of ["psyche_up", "psyche_up2"]) {
    assert.equal(declared.has(label), false,
      `${label} is still declared unplayed, but the psyche family dispatches it`);
  }
  // ► ~~`psyche_charging*` must stay declared unplayed, because nothing
  //   dispatches them.~~ **REFUTED BY A VERIFIER, THEN BUILT.**
  //   `changeCombatants` dispatches both with `gotoAndStop` to hold a charged
  //   gladiator's resting pose, so they are the `stance:psyche*` families and
  //   this assertion is now its own inverse.
  for (const label of ["psyche_charging", "psyche_charging2"]) {
    assert.equal(declared.has(label), false,
      `${label} is the charged stance now, so it must not be declared unplayed`);
  }
  if (!REAL_ANIMATIONS) return;
  // And they really are the only carriers, recomputed from the pack.
  const carriers = Object.entries(REAL_ANIMATIONS)
    .filter(([, animation]) => Array.isArray(animation?.effectGroups) && animation.effectGroups.length > 0)
    .map(([label]) => label)
    .sort();
  assert.deepEqual(carriers, ["psyche_charging", "psyche_charging2", "psyche_up", "psyche_up2"]);
  // ► **THE ASSERTION THAT COULD HAVE VARIED.** "The family is built" is
  //   satisfied by a family that dispatches nothing useful; this counts the
  //   groups that a dispatched clip actually carries, so a future change that
  //   keeps the family and loses the art fails here.
  const groupsOn = (label) => REAL_ANIMATIONS[label].effectGroups.length;
  const dispatched = groupsOn("psyche_up") + groupsOn("psyche_up2");
  const viaRun = groupsOn("psyche_charging") + groupsOn("psyche_charging2");
  assert.equal(dispatched, 10, "the dispatched psyche clips no longer carry ten effect groups");
  assert.equal(viaRun, 2, "the continuations no longer carry two effect groups");
  assert.equal(dispatched + viaRun, 12, "the pack's effect-group total moved");

  // ► **AND THE COUNT THAT COULD NOT HAVE VARIED BEFORE: what the ENGINE
  //   reaches, not what the JSON holds.** Every assertion above reads
  //   `animations.json` directly, so all of them stayed green on the day the
  //   engine was cutting two of these clips off — the test measured the art and
  //   not the reach. This walks the two run entries the way the renderer does.
  const pack = REAL_SHAPES ? figurePackFrom(REAL_SHAPES, REAL_ANIMATIONS) : null;
  if (!pack) return;
  const reached = new Set();
  for (const label of ["psyche_up", "psyche_up2", "psyche_up3"]) {
    const { animation } = animationFor(pack, { family: "psyche", label });
    for (const pose of animation.poses) {
      for (const placement of pose) {
        for (const id of placement.effects ?? []) reached.add(JSON.stringify(animation.effectGroups[id]));
      }
    }
  }
  // 12 table entries, 10 of them DISTINCT records — the pack repeats the
  // blur-22 entry across `psyche_up`, `psyche_charging` and `psyche_up2`, which
  // `tools/extract-figure.mjs` records in its own invoice as 12 vs 10.
  assert.equal(reached.size, 10, "every distinct effect record in the pack is drawn on some frame");
});

test("a pack with NO effect groups and NO enchantments emits the operations it always did", () => {
  // ► **THE ARENA DRAWS A GLADIATOR ON EVERY FRAME, so a regression here is the
  //   whole screen.** `group` is spread LAST and only when there is one, so an
  //   operation from a pack without effects is byte-identical — key ORDER
  //   included, which `JSON.stringify` is sensitive to and `deepEqual` is not.
  const pack = packOf();
  const ops = paintExtractedFigure(pack, {
    family: "standing", label: "Standing", at: 0, height: 1,
    wardrobe: wardrobeOf({ breastplate: [3] }), loadout: { breastplate: 3 }
  });
  assert.ok(ops.length > 0);
  assert.equal(ops.some((op) => "group" in op), false, "nothing carries a group");
  const body = ops.find((op) => !op.slot);
  const piece = ops.find((op) => op.slot === "breastplate");
  assert.deepEqual(Object.keys(body), [
    "kind", "d", "matrix", "limb", "rigDepth", "fill", "fillOpacity", "fillRule",
    "stroke", "strokeOpacity", "strokeWidth", "alpha"
  ]);
  assert.deepEqual(Object.keys(piece), [
    "kind", "d", "matrix", "limb", "slot", "sortKey", "fill", "fillOpacity",
    "fillRule", "stroke", "strokeOpacity", "strokeWidth", "alpha"
  ]);
});

test("`group` is ADDITIVE, which is how a reader turns the whole effect OFF", () => {
  // The same pose painted with and without the `effects` index: strip `group`
  // and the two are identical, so a painter that ignores the field draws
  // exactly what it drew before the field existed. That is the off switch —
  // there is no option, because an option would be a second thing to get wrong.
  const groups = [{ path: [43], character: 1195, filters: [aGlow(22, 2.69921875)] }];
  const withGroup = paintGlow(glowPackOf({ groups, effects: [0] }));
  const without = paintGlow(glowPackOf({ groups }));
  assert.equal(withGroup.length, 3);
  assert.equal(withGroup.every((op) => op.group), true);
  assert.equal(without.some((op) => "group" in op), false);
  const stripped = withGroup.map((op) => {
    const { group, ...rest } = op;
    return rest;
  });
  assert.equal(JSON.stringify(stripped), JSON.stringify(without.map((op) => ({ ...op }))));
});

test("ONE FROZEN RECORD PER GROUP PER PAINT — interned, because identity is the flush test", () => {
  // ► `groupRunsOf` in `tools/arena/main.js` flushes its buffer on
  //   `op.group !== previous` and says in its own docstring that the test is
  //   OBJECT IDENTITY and not `group.id`. A fresh record per operation would
  //   make that always true and every group a group of one.
  // ► **TWO PLACEMENTS, NOT ONE, AND THE FIRST VERSION OF THIS TEST HAD ONE.**
  //   A single placement resolves its group ONCE, so every operation under it
  //   shares a record whether or not anything is cached — the assertion passed
  //   with the cache deleted. Measured by mutation: `cache.set` removed, suite
  //   still green. **The real pack cannot exercise this either** — all 30 of
  //   its grouped placements are one per pose — so this synthetic pose is the
  //   only thing in the tree standing under `op.group !== previous`.
  const groups = [{ path: [43], character: 1195, filters: [aGlow(22)] }];
  const ops = paintGlow(glowPackOf({ groups, effects: [0], placements: 2 }));
  assert.equal(ops.length, 6, "two placements of a three-path shape");
  const [first] = ops;
  assert.ok(first.group);
  assert.equal(ops.every((op) => op.group === first.group), true,
    "ONE object across BOTH placements — a per-placement record makes every group a group of one");
  assert.equal(Object.isFrozen(first.group), true);
  assert.equal(Object.isFrozen(first.group.path), true);
  // The denominators are filled in by the walk and are right at the end of it.
  assert.equal(first.group.ops, 6);
  assert.equal(first.group.placements, 2);
  assert.deepEqual([...first.group.path], [43]);
  assert.equal(first.group.character, 1195);
  assert.equal(first.group.enclosedBy, null);
  // A SEPARATE call is a separate walk, so the records are equal and not
  // identical — the same caveat `propEffectGroupsFor` carries.
  const table = figureEffectGroupsFor(glowPackOf({ groups, effects: [0], placements: 2 }), {
    family: "standing", label: "Standing", at: 0, height: 1
  });
  assert.equal(table.length, 1, "TWO placements, ONE record in the table");
  assert.notEqual(table[0], first.group);
  assert.equal(table[0].filter, first.group.filter);
});

test("the record's FILTER is `canvasFilterFor`'s verdict, recomputed here from the pack", () => {
  // ► **THE POINT IS THAT THE PACK AND THE RENDERER CANNOT DRIFT.** If this
  //   module ever grew its own filter table, this assertion is what would catch
  //   it — the expected string is built by the same function the extractor's
  //   invoice uses, from the pack's own filter records, at the same scale.
  if (!REAL_SHAPES || !REAL_ANIMATIONS) return;
  const source = REAL_ANIMATIONS.psyche_up2;
  assert.ok(Array.isArray(source?.effectGroups) && source.effectGroups.length === 9,
    "psyche_up2 carries nine group records — the psych-up PULSE");
  const pack = figurePackFrom(REAL_SHAPES, { ...REAL_ANIMATIONS, standing: source });
  const clipToArena = clipToArenaScale(pack, 1);
  const seen = [];
  for (let pose = 0; pose < source.poses.length; pose += 1) {
    const at = (pose + 0.5) / source.poses.length;
    const [record] = figureEffectGroupsFor(pack, { family: "standing", label: "Standing", at, height: 1 });
    assert.ok(record, `pose ${pose} sits inside a group`);
    const index = source.poses[pose].find((p) => Array.isArray(p.effects))?.effects[0];
    const expected = canvasFilterFor(source.effectGroups[index].filters, { scale: clipToArena });
    assert.equal(record.filter, expected.filter, `pose ${pose}`);
    assert.deepEqual(record.counts, expected.counts);
    seen.push(record.filter);
  }
  // ► **AND THE TWEEN IS WHAT MAKES THIS EVIDENCE.** Nine poses, nine DISTINCT
  //   filter strings: the outer `#00ffff` glow sweeps blurX 22 -> 14.5 while
  //   its strength dips through 0.9766 and climbs back. A reader that collapsed
  //   the table by path would emit one string nine times and still be green
  //   against a single-pose assertion.
  assert.equal(new Set(seen).size, 9, "nine poses, nine glows — the pulse");
  assert.match(seen[0], /rgba\(0, 255, 255, 1\)/);
  assert.match(seen[5], /rgba\(0, 255, 255, 0\.9766\)/, "strength 0.9765625 is the dip");
});

test("EVERY GLOW IN BOTH PACKS HAS `inner: false` — the blur SIZE is the convention, not the flag", () => {
  // ► **A BRIEF FOR this work asserted the opposite and nearly shipped twelve
  //   INVERTED glows.** `canvasFilterFor` REFUSES an inner glow by name
  //   (`innerShadowHasNoCanvasFilter`), so a pack that really carried one would
  //   show up as `groupFiltersRefused`, not as a wrong picture — but the reading
  //   that "inner"/"outer" names the SWF flag is what has to be killed, and the
  //   bytes are what kills it.
  for (const [where, filters] of [
    ["figure", Object.values(REAL_ANIMATIONS ?? {}).flatMap((a) => (a.effectGroups ?? []).flatMap((g) => g.filters ?? []))],
    ["enchantments", (REAL_ENCHANTMENTS?.art?.frames ?? []).flatMap((f) => f.filters ?? [])]
  ]) {
    if (filters.length === 0) continue;
    assert.equal(filters.every((f) => f.inner === false), true, `${where}: every glow is an OUTER glow`);
    assert.equal(filters.every((f) => f.type === "glow"), true, `${where}: glows only — no colour matrix to fold`);
  }
});

test("the filter's SCALE composes the clip-to-arena factor, which only this module knows", () => {
  // ► A group's blur radius is in the FIGHTER CLIP's pixels; an operation's
  //   matrix is in arena units. The two must be in one space or a painter
  //   draws a correctly placed shape with a wrongly sized glow. `height`
  //   changes the first factor, the `scale` option the second, and both land.
  const groups = [{ path: [43], character: 1195, filters: [aGlow(22)] }];
  const radius = (options) => {
    const [op] = paintGlow(glowPackOf({ groups, effects: [0] }), options);
    return Number(op.group.filter.match(/([\d.]+)px rgba/)[1]);
  };
  const base = radius({});
  assert.ok(base > 0);
  // The pack is 100 clip pixels tall and UNIT is 150, so height 1 is 1.5.
  // `canvasFilterFor` prints at most four decimals, so the comparison is made
  // at the precision the STRING actually carries rather than at float exactness.
  // ► **`SHADOW_RADIUS_PER_SIGMA`, NOT 2 — it halved on 2026-09-15.** This read
  //   `2 * blurSigmaOf(22) * 1.5` until a render said that Chrome blurs
  //   `drop-shadow(0 0 R)` by exactly as much as `blur(R)`, so the radius is a
  //   standard deviation and doubling it doubled every glow in the build. What
  //   this test is actually about — that the clip-to-arena factor and the
  //   canvas scale both reach the radius — is untouched, and the three
  //   assertions below it are the ones carrying that.
  assert.equal(base, Math.round(SHADOW_RADIUS_PER_SIGMA * blurSigmaOf(22) * 1.5 * 10000) / 10000);
  // Tolerance 1e-3 and not 1e-9: the string carries four decimals, so doubling
  // a printed radius cannot be exact and asserting that it is would be pinning
  // the formatter rather than the arithmetic.
  assert.ok(Math.abs(radius({ height: 2 }) - 2 * base) < 1e-3, "twice as tall, twice the glow");
  assert.ok(Math.abs(radius({ scale: 2 }) - 2 * base) < 1e-3, "twice the canvas scale, twice the glow");
  assert.equal(radius({ scale: 0 }), base, "a non-positive scale falls back to 1");
});

/** `blurSigma`'s arithmetic, restated here so the test does not import the answer. */
function blurSigmaOf(width) {
  return Math.sqrt(Math.max(0, width * width - 1) / 12);
}

test("an `effects` index the table does not hold draws UNFILTERED and is COUNTED", () => {
  // The silent version of this is the defect this whole programme exists to
  // refuse: the placement says it is inside a group, the group is not there,
  // and the shape draws bare with nothing saying so.
  const pack = glowPackOf({ groups: [{ path: [43], character: 1195, filters: [aGlow(22)] }], effects: [4] });
  const ops = paintGlow(pack);
  assert.equal(ops.length, 3);
  assert.equal(ops.some((op) => "group" in op), false, "it draws, and it draws unfiltered");
  const invoice = figureInvoiceFor(pack, { family: "standing", label: "Standing", at: 0, height: 1 });
  assert.equal(invoice.groupsUnresolved, 1, "counted ONCE per distinct index per paint");
  assert.equal(invoice.inheritedPlacements, 1, "and the placement is still in the denominator");
  assert.equal(invoice.groupedOps, 0);
});

test("a NESTED chain composites innermost-first and every record counts the ops", () => {
  // ► Dead on the real pack — all 30 chains are one deep — so this synthetic
  //   pack is the only thing that can tell `enclosedBy` from `null`, and
  //   `groupRunsOf` composites only the innermost record.
  const groups = [
    { path: [43], character: 1195, filters: [aGlow(22)] },
    { path: [43, 1], character: 1196, filters: [aGlow(6)] }
  ];
  const pack = glowPackOf({ groups, effects: [0, 1] });   // OUTERMOST FIRST
  const [op] = paintGlow(pack);
  assert.equal(op.group.id, 1, "the innermost group is the one on the operation");
  assert.equal(op.group.enclosedBy.id, 0, "and it names the one outside it");
  assert.equal(op.group.enclosedBy.enclosedBy, null);
  // Both buffers contain these operations, so both denominators are 3.
  assert.equal(op.group.ops, 3);
  assert.equal(op.group.enclosedBy.ops, 3);
  const invoice = figureInvoiceFor(pack, { family: "standing", label: "Standing", at: 0, height: 1 });
  assert.equal(invoice.nestedGroupPlacements, 1);
  assert.equal(invoice.effectGroups, 2);
  assert.equal(invoice.groupsBelowTopLevel, 1, "the inner group's path is two deep — its space is not the clip's");
});

test("a placement's OWN filter is a group of one placement — dead on this build, carried anyway", () => {
  // ► **0 of this build's 37,077 placements carries `filters` or `blendMode`**,
  //   so nothing but this pack reaches the branch. It is carried rather than
  //   counted because a filter on ONE leaf IS per-leaf — there is no composite
  //   to get wrong — and a field this reader walked past would be the sixth
  //   instance of the standing defect.
  if (REAL_ANIMATIONS) {
    let own = 0;
    let placements = 0;
    for (const animation of Object.values(REAL_ANIMATIONS)) {
      for (const pose of animation.poses ?? []) {
        for (const p of pose) {
          placements += 1;
          if (p.filters || p.blendMode !== undefined) own += 1;
        }
      }
    }
    assert.equal(placements, 37077, "the denominator, recomputed");
    assert.equal(own, 0, "and the numerator — so only the synthetic pack below reaches this");
  }
  const pack = glowPackOf({
    groups: [{ path: [43], character: 1195, filters: [aGlow(22)] }],
    effects: [0],
    own: { filters: [aGlow(4)], blendMode: 5 }
  });
  const [op] = paintGlow(pack);
  assert.equal(op.group.id, null, "a placement's own group is not an index into any table");
  assert.deepEqual([...op.group.path], [23, 1, 1], "its path is the depth chain that reached it");
  assert.equal(op.group.composite, "lighten", "blend mode 5, through `blendModeFor`");
  assert.equal(op.group.enclosedBy.id, 0, "and the inherited group encloses it");
  const invoice = figureInvoiceFor(pack, { family: "standing", label: "Standing", at: 0, height: 1 });
  assert.equal(invoice.ownEffectPlacements, 1);
  assert.equal(invoice.groupBlendModes, 1);
  assert.equal(invoice.groupBlendModesRefused, 0);
});

test("a COLOUR MATRIX on a group is DEFERRED and counted, never silently dropped", () => {
  // ► **This module folds no colour matrix, and `props.js` does.** The field is
  //   named `colourMatricesDeferred` for exactly that reason. 0 of this build's
  //   24 figure filters and 0 of its 24 enchantment filters is one, so the
  //   synthetic pack is the only witness — and a zero with no denominator would
  //   say nothing at all.
  const matrix = [0.5, 0, 0, 0, 10, 0, 0.5, 0, 0, 10, 0, 0, 0.5, 0, 10, 0, 0, 0, 1, 0];
  const pack = glowPackOf({
    groups: [{ path: [43], character: 1195, filters: [aGlow(22), { type: "colourMatrix", matrix }] }],
    effects: [0]
  });
  const [op] = paintGlow(pack);
  assert.equal(op.group.colourMatricesDeferred, 1);
  assert.equal(op.fill, "#111111", "the fill is UNTOUCHED — deferred means not applied");
  assert.ok(op.group.filter, "and the glow beside it still reaches the painter");
  const invoice = figureInvoiceFor(pack, { family: "standing", label: "Standing", at: 0, height: 1 });
  assert.equal(invoice.groupColourMatrices, 1);
  assert.equal(invoice.groupColourMatrixOps, 3, "every operation under it, so the loss has a size");
  assert.equal(invoice.groupFiltersDeferred, 1);
});

/* ---- THE WEAPON ENCHANTMENT --------------------------------------- */

test("THE TWELVE CELLS COME OUT OF THE PACK, and the closed form is not written here", () => {
  if (!REAL_ENCHANTMENTS) return;
  const pack = figurePackFrom(SHAPES, { standing: anim([[]]) }, REAL_ENCHANTMENTS);
  const ladder = pack.enchantments;
  assert.ok(ladder, "the real pack parses");
  assert.equal(ladder.cells, 12);
  assert.equal(ladder.frames, 13);
  assert.equal(ladder.belowType, 2);
  assert.equal(ladder.bareFrame, 1);
  assert.equal(ladder.inner.instance, "realweapon");

  const frames = new Set();
  for (let type = 0; type <= 7; type += 1) {
    for (let potency = 0; potency <= 4; potency += 1) {
      const loadout = {
        weapon: 1, equipped_weapon: 1,
        weapon_enchantment_type: type, weapon_enchantment_potency: potency
      };
      const answer = weaponEnchantmentFor(pack, loadout);
      if (type < 2) {
        // ► `enchant_type < 2 -> gotoAndStop(1)`, and the arm FALLS THROUGH to
        //   four tests it cannot pass, so frame 1 is where it stays.
        assert.equal(answer.reason, "bare", `type ${type} potency ${potency}`);
        assert.equal(answer.frame, 1);
        assert.equal(answer.filters, null, "frame 1 is the bare blade");
      } else if (type <= 5 && potency >= 1 && potency <= 3) {
        assert.equal(answer.reason, "cell", `type ${type} potency ${potency}`);
        // The frame is READ, and only then checked against the closed form the
        // pack itself fitted — so this file is not a second witness to it.
        assert.equal(answer.frame, 3 * (type - 2) + potency + 1);
        assert.equal(answer.filters.length, 2, "two glows per enchanted frame");
        frames.add(answer.frame);
      } else {
        // ► **NO TRAILING DEFAULT: `gotoAndStop` is called ZERO times.**
        assert.equal(answer.reason, "noOp", `type ${type} potency ${potency}`);
        assert.equal(answer.frame, null, "a no-op has no frame, because the build sets none");
        assert.equal(answer.filters, null);
      }
    }
  }
  assert.equal(frames.size, 12, "twelve cells, twelve distinct frames");
});

test("OUT OF DOMAIN LEAVES THE ART BARE — a no-op, and NOT frame 1", () => {
  // ► `itemglow` calls `gotoAndStop` zero times for a type of 9 or a potency of
  //   0, so the clip KEEPS ITS CURRENT FRAME. A stateless renderer has no
  //   current frame, so "keep what you had" is "add nothing to this paint" —
  //   and the operations must therefore be identical to the unenchanted ones,
  //   which is stronger than merely having no group.
  if (!REAL_ENCHANTMENTS) return;
  const wardrobe = wardrobeOf({ weapon: [1] });
  const pack = glowPackOf({ enchantments: REAL_ENCHANTMENTS });
  const paint = (extra) => paintGlow(pack, {
    wardrobe, loadout: { weapon: 1, equipped_weapon: 1, ...extra }
  });
  const bare = paint({});
  for (const [name, extra] of [
    ["type 9", { weapon_enchantment_type: 9, weapon_enchantment_potency: 2 }],
    ["potency 0", { weapon_enchantment_type: 3, weapon_enchantment_potency: 0 }],
    ["potency 4", { weapon_enchantment_type: 3, weapon_enchantment_potency: 4 }],
    ["type NaN", { weapon_enchantment_type: Number.NaN, weapon_enchantment_potency: 2 }],
    ["type 0 — the BARE cell, a real gotoAndStop(1)", { weapon_enchantment_type: 0, weapon_enchantment_potency: 0 }],
    ["absent", {}]
  ]) {
    assert.equal(JSON.stringify(paint(extra)), JSON.stringify(bare), name);
    assert.equal(paint(extra).some((op) => "group" in op), false, name);
  }
  // And the reasons stay DISTINCT even though the picture is the same, because
  // "the build chose frame 1" and "the build chose nothing" are different facts.
  const reasonOf = (extra) => weaponEnchantmentFor(pack, { weapon: 1, equipped_weapon: 1, ...extra }).reason;
  assert.equal(reasonOf({ weapon_enchantment_type: 0, weapon_enchantment_potency: 0 }), "bare");
  assert.equal(reasonOf({ weapon_enchantment_type: 9, weapon_enchantment_potency: 2 }), "noOp");
  assert.equal(reasonOf({}), "absent");
  assert.equal(weaponEnchantmentFor(pack, { weapon: 1, equipped_weapon: 3 }).reason, "noSlot");
  assert.equal(weaponEnchantmentFor(glowPackOf({}), { weapon: 1, equipped_weapon: 1 }).reason, "noPack");
});

test("THE GLOW READS THE EQUIPPED SLOT'S OWN PAIR — which is NOT `activeEnchantment`'s rule", () => {
  // ► **THE ONE THAT IS EASY TO GET BACKWARDS.** `damagecharacter` gates the
  //   PROC on `weapon_enchantment_potency` for both slots, because that test is
  //   hoisted out of the `equipped_weapon` branch; `skincharacter` passes the
  //   equipped slot's OWN pair to `itemglow`. Reusing the proc's rule for the
  //   art draws the wrong glow the moment a bow is up and the two potencies
  //   differ — which is exactly the case constructed here.
  if (!REAL_ENCHANTMENTS) return;
  const pack = glowPackOf({ enchantments: REAL_ENCHANTMENTS });
  const loadout = {
    weapon: 1, secondary_weapon: 62, equipped_weapon: 2,
    weapon_enchantment_type: 2, weapon_enchantment_potency: 1,
    secondary_weapon_enchantment_type: 5, secondary_weapon_enchantment_potency: 3
  };
  const answer = weaponEnchantmentFor(pack, loadout);
  assert.equal(answer.whenEquipped, 2, "the BOW's row is the one that attaches");
  assert.equal(answer.type, 5);
  assert.equal(answer.potency, 3, "the SECONDARY potency, not the primary one");
  assert.equal(answer.frame, 13);
  // `activeEnchantment`'s rule would pair type 5 with the PRIMARY potency 1 and
  // land on frame 11 — a real cell, a real glow, and the wrong one.
  assert.notEqual(answer.frame, 3 * (5 - 2) + 1 + 1);
  // And melee reads the melee pair, so the two rows are genuinely different.
  const melee = weaponEnchantmentFor(pack, { ...loadout, equipped_weapon: 1 });
  assert.equal(melee.whenEquipped, 1);
  assert.deepEqual([melee.type, melee.potency, melee.frame], [2, 1, 2]);
});

test("THE GLOW COVERS THE WHOLE WEAPON LIMB — the rig's own art AND the attached blade", () => {
  // ► **THIS TEST ASSERTED THE OPPOSITE UNTIL 2026-09-15, AND ITS FIXTURE COULD
  //   NOT TELL THE TWO APART.** It was titled "AND ON NOTHING ELSE" and checked
  //   that no body operation glowed — but `glowPackOf` built a pose whose only
  //   body placement was on `torso`, so the real discriminating input, a
  //   placement on the WEAPON limb, was absent. Both the wrong scope and the
  //   right one passed it.
  //
  //   The build: char 703 `weapon0` is the glow SHELL; its depth-1 placement of
  //   char 702 `realweapon` WEARS the filter; and inside `realweapon` sit BOTH
  //   char 701 (the rig's own weapon art, `limb: "weapon"`, depth `[39, 1, 1]`
  //   on all 2,216 such placements in the real pack) and whatever
  //   `attachMovie("weapon" + id, …)` puts there. **So the glow encloses both**,
  //   and the faithful scope is their union — exactly `op.limb === "weapon"`.
  if (!REAL_ENCHANTMENTS) return;
  const pack = glowPackOf({ enchantments: REAL_ENCHANTMENTS, rigWeapon: true });
  const ops = paintGlow(pack, {
    wardrobe: wardrobeOf({ weapon: [1], breastplate: [3] }),
    loadout: {
      weapon: 1, breastplate: 3, equipped_weapon: 1,
      weapon_enchantment_type: 3, weapon_enchantment_potency: 2
    }
  });
  const glowing = ops.filter((op) => op.group);
  assert.ok(glowing.length > 0);
  // BOTH sides of the union are present — this is the assertion the old fixture
  // could not make, and it is what fails if the scope narrows back.
  assert.equal(glowing.some((op) => op.slot === "weapon"), true, "the attached blade glows");
  assert.equal(glowing.some((op) => !op.slot && op.limb === "weapon"), true,
    "and so does the rig's own weapon art, which is INSIDE `realweapon`");
  assert.deepEqual([...new Set(glowing.map((op) => op.limb))], ["weapon"],
    "and nothing outside the weapon limb glows");
  assert.equal(ops.filter((op) => !op.slot && op.limb !== "weapon").some((op) => "group" in op), false,
    "the rest of the BODY does not glow");
  assert.equal(ops.find((op) => op.slot === "breastplate").group, undefined, "nor does the armour");
  // ► **ONE RECORD OVER BOTH, NOT TWO EQUAL ONES.** `groupRunsOf` flushes on
  //   object identity, so two records would composite one glow through two
  //   buffers — a different picture from one buffer over the whole limb.
  assert.equal(new Set(glowing.map((op) => op.group)).size, 1, "one interned record over the union");
  const indices = ops.map((op, at) => (op.group ? at : -1)).filter((at) => at >= 0);
  assert.equal(indices.every((at, n) => n === 0 || at === indices[n - 1] + 1), true,
    "and the run is CONTIGUOUS through the wardrobe merge, so it is ONE buffer");
  // Interned, and the record names where the filter actually sits in the build.
  const [first] = glowing;
  assert.equal(glowing.every((op) => op.group === first.group), true);
  assert.equal(first.group.id, 6, "frost, medium — the ladder's frame 6");
  assert.equal(first.group.character, 702, "the character `realweapon` places");
  assert.deepEqual([...first.group.path], [1]);
  assert.match(first.group.filter, /rgba\(0, 204, 255, 1\)/, "frost is #00ccff over #000099");
  assert.match(first.group.filter, /rgba\(0, 0, 153, 1\)/);
});

test("the weapon LIMB'S OWN SCALE is part of the glow's radius", () => {
  // ► The glow lives in the glow shell's space and `limbs.weapon` is what maps
  //   that into the clip's, so the radius passes through it. On the real rig
  //   the correction is under 1.4% — small enough that assuming it away would
  //   never have been caught, which is why it is composed instead of assumed.
  if (!REAL_ENCHANTMENTS) return;
  const radius = (limbScale) => {
    const ops = paintGlow(glowPackOf({ enchantments: REAL_ENCHANTMENTS, limbScale }), {
      wardrobe: wardrobeOf({ weapon: [1] }),
      loadout: { weapon: 1, equipped_weapon: 1, weapon_enchantment_type: 3, weapon_enchantment_potency: 2 }
    });
    return Number(ops.find((op) => op.slot === "weapon").group.filter.match(/([\d.]+)px rgba/)[1]);
  };
  const base = radius(1);
  assert.ok(base > 0);
  assert.ok(Math.abs(radius(2) - 2 * base) < 1e-3, "a limb at twice the scale wears twice the glow");
  // A degenerate limb would size the glow by zero; it is counted, not guessed.
  const degenerate = figureInvoiceFor(glowPackOf({ enchantments: REAL_ENCHANTMENTS, limbScale: 0 }), {
    family: "standing", label: "Standing", at: 0, height: 1,
    wardrobe: wardrobeOf({ weapon: [1] }),
    loadout: { weapon: 1, equipped_weapon: 1, weapon_enchantment_type: 3, weapon_enchantment_potency: 2 }
  });
  assert.equal(degenerate.enchantmentLimbScaleDegenerate, 1);
});

test("`loadoutFrom` carries the four enchantment fields, in BOTH combatant shapes", () => {
  // ► A PROJECTED resource is `{value, min, max}` and a ROSTER one is a plain
  //   number; this file has already shipped a defect for testing only one.
  const projected = {
    resources: {
      weapon: { value: 1, min: 0, max: 99 },
      equipped_weapon: { value: 2, min: 1, max: 2 },
      weapon_enchantment_type: { value: 2, min: 0, max: 5 },
      weapon_enchantment_potency: { value: 1, min: 0, max: 3 },
      secondary_weapon_enchantment_type: { value: 5, min: 0, max: 5 },
      secondary_weapon_enchantment_potency: { value: 3, min: 0, max: 3 }
    }
  };
  const roster = {
    weapon: 1, equipped_weapon: 2,
    weapon_enchantment_type: 2, weapon_enchantment_potency: 1,
    secondary_weapon_enchantment_type: 5, secondary_weapon_enchantment_potency: 3
  };
  for (const [shape, combatant] of [["projected", projected], ["roster", roster]]) {
    const loadout = loadoutFrom(combatant);
    for (const field of ENCHANTMENT_FIELDS) {
      assert.ok(Number.isFinite(loadout[field]), `${shape}: ${field} travels`);
    }
    assert.equal(loadout.weapon_enchantment_potency, 1, shape);
    assert.equal(loadout.secondary_weapon_enchantment_potency, 3, shape);
  }
  // ABSENT STAYS ABSENT — a `0` would claim the build's enchantment 0.
  const bare = loadoutFrom({ resources: { helmet: 3 } });
  for (const field of ENCHANTMENT_FIELDS) assert.equal(field in bare, false, `${field} is absent, not 0`);
});

test("THE INVOICE HAS A DENOMINATOR FOR EVERY ZERO, and the reasons partition the slots", () => {
  if (!REAL_ENCHANTMENTS) return;
  const wardrobe = wardrobeOf({ weapon: [1], breastplate: [3] });
  const invoiceOf = (loadout) => figureInvoiceFor(
    glowPackOf({ enchantments: REAL_ENCHANTMENTS }),
    { family: "standing", label: "Standing", at: 0, height: 1, wardrobe, loadout }
  );
  const enchanted = invoiceOf({
    weapon: 1, breastplate: 3, equipped_weapon: 1,
    weapon_enchantment_type: 3, weapon_enchantment_potency: 2
  });
  // Denominators first, and they are the populations the counts are read over.
  assert.equal(enchanted.placements, 1);
  assert.equal(enchanted.ops, 3);
  assert.equal(enchanted.attachedPlacements, 2, "two pieces, one placement each");
  assert.equal(enchanted.attachedOps, 2);
  assert.equal(enchanted.enchantmentLadder, 1, "a ladder was loaded");
  // The five reasons partition `enchantmentSlots` EXACTLY.
  for (const loadout of [
    { weapon: 1, equipped_weapon: 1, weapon_enchantment_type: 3, weapon_enchantment_potency: 2 },
    { weapon: 1, equipped_weapon: 1, weapon_enchantment_type: 0, weapon_enchantment_potency: 0 },
    { weapon: 1, equipped_weapon: 1, weapon_enchantment_type: 9, weapon_enchantment_potency: 2 },
    { weapon: 1, equipped_weapon: 1 },
    { weapon: 1, equipped_weapon: 3 },
    { breastplate: 3 }
  ]) {
    const invoice = invoiceOf(loadout);
    assert.equal(
      invoice.enchantmentCell + invoice.enchantmentBare + invoice.enchantmentNoOp
      + invoice.enchantmentAbsent + invoice.enchantmentNoPack,
      invoice.enchantmentSlots,
      `the reasons partition the slots for ${JSON.stringify(loadout)}`
    );
    assert.ok(invoice.enchantmentOps <= invoice.attachedOps);
  }
  assert.equal(invoiceOf({ weapon: 1, equipped_weapon: 3 }).enchantmentSlots, 0, "no weapon row, no slot");
  // And a pack with NO ladder reports `noPack` rather than a silent zero.
  const noPack = figureInvoiceFor(glowPackOf({}), {
    family: "standing", label: "Standing", at: 0, height: 1, wardrobe,
    loadout: { weapon: 1, equipped_weapon: 1, weapon_enchantment_type: 3, weapon_enchantment_potency: 2 }
  });
  assert.equal(noPack.enchantmentLadder, 0);
  assert.equal(noPack.enchantmentSlots, 1);
  assert.equal(noPack.enchantmentNoPack, 1);
});

test("a malformed or absent enchantments pack still dresses a gladiator", () => {
  // Same contract as the wardrobe: a second extractor the player did not run
  // must cost the glow and nothing else.
  for (const broken of [null, undefined, {}, { selector: { matched: false } },
    { selector: { matched: true, cells: [] }, art: { frames: [] } },
    { selector: { matched: true, cells: [{ type: 2, potency: 1, frame: 2 }] } }]) {
    const pack = figurePackFrom(SHAPES, { standing: anim([[{ shape: 1, limb: "torso", depth: [23], matrix: [1, 0, 0, 1, 0, 0] }]]) }, broken);
    assert.equal(pack.enchantments, null, JSON.stringify(broken));
    assert.equal(paintExtractedFigure(pack, { family: "standing", label: "Standing", at: 0 }).length, 1);
  }
});

test("a run of grouped operations stays CONTIGUOUS through the wardrobe merge", () => {
  // ► `groupRunsOf` opens one offscreen per RUN, so a group broken into three
  //   runs is three buffers and three composites of one third of a picture
  //   each. The merge only ever inserts before the first operation of a new
  //   depth, and every op under one group shares a depth — so this holds by
  //   construction, and here is the assertion that says so.
  if (!REAL_ENCHANTMENTS) return;
  const ops = paintGlow(
    glowPackOf({
      groups: [{ path: [43], character: 1195, filters: [aGlow(22)] }],
      effects: [0],
      enchantments: REAL_ENCHANTMENTS
    }),
    {
      wardrobe: wardrobeOf({ weapon: [1], breastplate: [3] }),
      loadout: {
        weapon: 1, breastplate: 3, equipped_weapon: 1,
        weapon_enchantment_type: 3, weapon_enchantment_potency: 2
      }
    }
  );
  const runs = [];
  let previous;
  for (const op of ops) {
    const group = op.group ?? null;
    if (runs.length === 0 || group !== previous) runs.push({ group, ops: 0 });
    runs[runs.length - 1].ops += 1;
    previous = group;
  }
  const grouped = runs.filter((run) => run.group);
  assert.equal(grouped.length, 2, "the body's glow and the weapon's, one run each");
  const seen = new Set(grouped.map((run) => run.group));
  assert.equal(seen.size, 2, "no group is split across two runs");
  for (const run of grouped) assert.equal(run.ops, run.group.ops, "the run IS the group's own denominator");
});
