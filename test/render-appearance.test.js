/**
 * A gladiator's LOOK: `begincolouring`'s table in the player's 8.8 arithmetic,
 * the skin-derived features, which rig placements are `bareskin`, and
 * `randomise_gladiator`'s rule for a new look (`src/render/appearance.js`).
 *
 * ► **THE SYNTHETIC HALF PINS THE ARITHMETIC; THE REAL-PACK HALF IS THE
 *   EVIDENCE.** The table is transcribed from the build's code, so a test that
 *   read it back would only confirm the transcription agrees with itself. The
 *   independent witness is the build's own ART: the `features` pieces are
 *   PRE-COLOURED to match the skin they are derived from, so the 8.8 tint of
 *   the body greys either reproduces their fills or it does not. That half
 *   runs only where the player has extracted their own pack, and returns
 *   silently on a clone, as every real-pack check in
 *   `test/render-extracted-figure.test.js` does. No fill, DNA or art is
 *   stored in this file.
 */
import assert from "node:assert/strict";
import nodeFs from "node:fs";
import nodePath from "node:path";
import test from "node:test";
import { fileURLToPath as toPath } from "node:url";

import {
  BARESKIN_LIMBS,
  SS2_LOOK_COLOURS,
  SS2_LOOK_LIMITS,
  colourTransformForLook,
  featuresForSkin,
  generatedSs2Look,
  isBareskinPlacement,
  lookPaintFor,
  multiplierFromPercent,
  ss2LookFrom
} from "../src/render/appearance.js";
import { figurePackFrom, paintExtractedFigure } from "../src/render/extracted-figure.js";
import { applyColourTransform } from "../src/render/filters.js";

function readRealPack(relative) {
  const at = nodePath.join(toPath(new URL("..", import.meta.url)), relative);
  return nodeFs.existsSync(at) ? JSON.parse(nodeFs.readFileSync(at, "utf8")) : null;
}
const REAL_SHAPES = readRealPack("assets/figure/shapes.json");
const REAL_ANIMATIONS = readRealPack("assets/figure/animations.json");
const REAL_WARDROBE = readRealPack("assets/figure/wardrobe.json");

/* ───────────────────────────── the arithmetic ─────────────────────────────── */

test("a setTransform percent is the player's 8.8 multiplier, truncated", () => {
  assert.equal(multiplierFromPercent(85), 217 / 256, "85% is 217/256, not 0.85");
  assert.equal(multiplierFromPercent(100), 1, "100% is exactly one");
  assert.equal(multiplierFromPercent(255), 652 / 256);
  assert.equal(multiplierFromPercent(122), 312 / 256);
  assert.equal(multiplierFromPercent(0), 0);
  assert.equal(multiplierFromPercent(Number.NaN), null);
});

test("the tint floors the PRODUCT of the 8.8 multiplier, which is not float p/100", () => {
  // 204 * 217 >> 8 = 172 (0xac); 204 * 0.85 = 173.4 would floor to 173 (0xad).
  const skin5 = colourTransformForLook(5);
  assert.deepEqual([...skin5], [0, 217 / 256, 268 / 256, 1, 0, 0, 0, 0]);
  assert.equal(applyColourTransform("#cccccc", skin5), "#00acd5");
  const float = [0, 0.85, 1.05, 1, 0, 0, 0, 0];
  assert.equal(applyColourTransform("#cccccc", float), "#00add6", "the model the build's art rules out");
  // A channel over 255 clamps; a zero multiplier zeroes; black stays black.
  assert.equal(applyColourTransform("#ffffff", colourTransformForLook(18)), "#ffffff");
  assert.equal(applyColourTransform("#000000", colourTransformForLook(1)), "#000000");
});

test("the table has a row for 1..22 and 24 and none for 23, and every row carries its features", () => {
  const keys = Object.keys(SS2_LOOK_COLOURS).map(Number).sort((a, b) => a - b);
  assert.deepEqual(keys, [...Array.from({ length: 22 }, (unused, index) => index + 1), 24]);
  for (const [index, row] of Object.entries(SS2_LOOK_COLOURS)) {
    for (const channel of ["ra", "ga", "ba", "aa"]) {
      assert.ok(Number.isInteger(row[channel]) && row[channel] >= 0, `row ${index} ${channel}`);
    }
    assert.ok(Number.isInteger(row.features), `row ${index} features`);
    assert.match(row.at, /^\+0x[0-9a-f]{4}$/, `row ${index} cites its offset`);
  }
  // Only row 24 is not fully opaque-neutral in alpha.
  assert.deepEqual(Object.entries(SS2_LOOK_COLOURS).filter(([, row]) => row.aa !== 100).map(([key]) => key), ["24"]);
});

test("an index with no branch gets no transform — not identity, not a guess", () => {
  for (const index of [23, 0, 25, -1, 5.5, Number.NaN, null, undefined, "5"]) {
    assert.equal(colourTransformForLook(index), null, String(index));
  }
});

/* ─────────────────────────── features from skin ───────────────────────────── */

test("features are the skin row's, and the DNA's only when the skin matches no branch", () => {
  const expected = {
    1: 1, 2: 1, 3: 1, 4: 6, 5: 7, 6: 9, 7: 8, 8: 10, 9: 11, 10: 12, 11: 13, 12: 14, 13: 15,
    14: 16, 15: 17, 16: 18, 17: 19, 18: 20, 19: 20, 20: 20, 21: 25, 22: 22, 24: 24
  };
  for (const [skin, features] of Object.entries(expected)) {
    assert.equal(featuresForSkin(Number(skin), 99), features, `skin ${skin}`);
  }
  assert.equal(featuresForSkin(23, 99), 99, "no branch: the DNA's own value stands");
  assert.equal(featuresForSkin(null, 3), 3);
  assert.equal(featuresForSkin(23, null), null);
});

test("ss2LookFrom normalises the five fields and DERIVES features, overriding the DNA's", () => {
  const look = ss2LookFrom({ skincolor: 11, haircolor: 21, features: 23, hairstyle: 16, facehairstyle: 16 });
  assert.deepEqual({ ...look }, { skincolor: 11, haircolor: 21, hairstyle: 16, facehairstyle: 16, features: 13 });
  assert.ok(Object.isFrozen(look));
  const junk = ss2LookFrom({ skincolor: null, haircolor: Number.NaN, features: 6 });
  assert.deepEqual({ ...junk }, { skincolor: null, haircolor: null, hairstyle: null, facehairstyle: null, features: 6 });
  assert.equal(ss2LookFrom(null), null);
});

test("lookPaintFor is two transforms and three ids, and null for no look", () => {
  assert.equal(lookPaintFor(null), null);
  const paint = lookPaintFor(ss2LookFrom({ skincolor: 5, haircolor: 23, hairstyle: 2, facehairstyle: 0 }));
  assert.deepEqual([...paint.skin], [...colourTransformForLook(5)]);
  assert.equal(paint.hair, null, "hair index 23 has no branch");
  assert.equal(paint.hairstyle, 2);
  assert.equal(paint.facehairstyle, 0);
  assert.equal(paint.features, 7);
});

/* ─────────────────────────────── bareskin ────────────────────────────────── */

test("a bareskin placement is depth 1 inside one of the ten tinted limbs — never a foot, the head's defaults or the weapon", () => {
  assert.equal(BARESKIN_LIMBS.length, 10);
  assert.ok(!BARESKIN_LIMBS.includes("Lfoot") && !BARESKIN_LIMBS.includes("Rfoot"), "initcolour tints no foot");
  assert.equal(isBareskinPlacement({ limb: "head", depth: [25, 1, 1] }), true);
  assert.equal(isBareskinPlacement({ limb: "torso", depth: [23, 1, 1] }), true);
  assert.equal(isBareskinPlacement({ limb: "Rlowerleg", depth: [13, 1, 1] }), true);
  assert.equal(isBareskinPlacement({ limb: "head", depth: [25, 3, 1] }), false, "the transparent default facehair");
  assert.equal(isBareskinPlacement({ limb: "head", depth: [25, 7, 1] }), false, "the transparent default features");
  assert.equal(isBareskinPlacement({ limb: "Lfoot", depth: [17, 1] }), false, "the foot has no bareskin child");
  assert.equal(isBareskinPlacement({ limb: "weapon", depth: [39, 1, 1] }), false);
  assert.equal(isBareskinPlacement({ limb: "head", depth: [25] }), false);
  assert.equal(isBareskinPlacement({ limb: "head" }), false);
  assert.equal(isBareskinPlacement(null), false);
});

/* ─────────────────────────── a generated look ────────────────────────────── */

test("a generated look is randomise_gladiator's four draws, in its order, from the caller's stream", () => {
  const asked = [];
  const answers = [4, 9, 0, 23];
  const look = generatedSs2Look((upperExclusive) => {
    asked.push(upperExclusive);
    return answers[asked.length - 1];
  });
  assert.deepEqual(asked, [
    SS2_LOOK_LIMITS.skincolormax, SS2_LOOK_LIMITS.hairstylemax, SS2_LOOK_LIMITS.colormax, SS2_LOOK_LIMITS.facehairstylemax
  ]);
  assert.deepEqual(asked, [18, 40, 21, 24], "global_DNA_settings' own maxima");
  assert.deepEqual({ ...look }, { skincolor: 5, haircolor: 1, hairstyle: 10, facehairstyle: 24, features: 7 });
  assert.throws(() => generatedSs2Look(null), /seeded RandomNumber/);
});

test("the villain branch's helmet rule: a helmet above 1 leaves him bald, and it changes nothing else", () => {
  const draws = () => { let n = 0; return () => [2, 7, 3, 5][n++]; };
  const bare = generatedSs2Look(draws());
  assert.equal(bare.hairstyle, 8);
  assert.equal(generatedSs2Look(draws(), { helmet: 2 }).hairstyle, 0, "+0x2aac");
  assert.equal(generatedSs2Look(draws(), { helmet: 1 }).hairstyle, 8, "helmet 1 is not above 1");
  assert.equal(generatedSs2Look(draws(), { helmet: 0 }).hairstyle, 8);
  const helmeted = generatedSs2Look(draws(), { helmet: 9 });
  assert.deepEqual({ ...helmeted, hairstyle: 8 }, { ...bare });
});

/* ───────────────── the evidence: the player's own pack ───────────────────── */

test("REAL PACK: the pre-coloured features art is the 8.8 tint of the body greys, and float p/100 is not", () => {
  if (!REAL_WARDROBE || !REAL_SHAPES) return;
  // The two body greys, measured rather than assumed: the grey fills most of
  // the six bareskin shapes carry (the head has no `#eaeaea`; the torso's
  // darker greys are its own detail).
  const tally = new Map();
  for (const id of bareskinShapeIds()) {
    for (const fill of new Set(REAL_SHAPES[id].paths.map((path) => path.fill))) tally.set(fill, (tally.get(fill) ?? 0) + 1);
  }
  const greys = [...tally].filter(([fill, count]) => count >= 4 && /^#([0-9a-f]{2})\1\1$/.test(fill) && fill !== "#000000")
    .map(([fill]) => fill);
  assert.deepEqual(greys.sort(), ["#cccccc", "#eaeaea"], "the body greys the bareskin shapes carry");

  const floatTint = (grey, row) => applyColourTransform(grey, [row.ra / 100, row.ga / 100, row.ba / 100, 1, 0, 0, 0, 0]);
  let decided = 0;
  let matched = 0;
  for (const [skin, row] of Object.entries(SS2_LOOK_COLOURS)) {
    const piece = REAL_WARDROBE.pieces?.features?.[row.features];
    if (!piece) continue;
    const art = new Set();
    for (const placement of piece.placements) {
      for (const path of REAL_WARDROBE.shapes[placement.shape]?.paths ?? []) art.add(path.fill);
    }
    for (const grey of greys) {
      const exact = applyColourTransform(grey, colourTransformForLook(Number(skin)));
      const float = floatTint(grey, row);
      if (art.has(exact)) matched += 1;
      if (exact === float || (!art.has(exact) && !art.has(float))) continue;
      decided += 1;
      assert.ok(art.has(exact) && !art.has(float),
        `skin ${skin} on ${grey}: the art holds ${art.has(float) ? float : "neither"}, the 8.8 tint is ${exact}`);
    }
  }
  assert.ok(decided >= 8, `the art must decide between the two models on several fills (decided ${decided})`);
  assert.ok(matched >= 15, `and the 8.8 tint must land on the art repeatedly (matched ${matched})`);
});

/** The six bareskin shapes, by the rule — so the rule itself is what is measured. */
function bareskinShapeIds() {
  const ids = new Set();
  for (const animation of Object.values(REAL_ANIMATIONS ?? {})) {
    for (const pose of animation.poses ?? []) {
      for (const placement of pose) if (isBareskinPlacement(placement)) ids.add(placement.shape);
    }
  }
  return ids;
}

test("REAL PACK: the bareskin rule picks exactly the SWF's six named bareskin children, in every pose", () => {
  if (!REAL_ANIMATIONS || !REAL_SHAPES) return;
  // The SWF's instance table names `bareskin` at depth 1 of sprites 677, 680,
  // 685, 688, 697 and 700, holding sprites 676, 679, 684, 687, 690 and 699,
  // whose shapes are these six. The rule reads only limb names and depths.
  assert.deepEqual([...bareskinShapeIds()].sort((a, b) => a - b), [675, 678, 683, 686, 689, 698]);
  const limbs = new Set();
  let feet = 0;
  for (const animation of Object.values(REAL_ANIMATIONS)) {
    for (const pose of animation.poses ?? []) {
      for (const placement of pose) {
        if (isBareskinPlacement(placement)) limbs.add(placement.limb);
        else {
          assert.ok(![675, 678, 683, 686, 689, 698].includes(placement.shape),
            `shape ${placement.shape} outside a bareskin placement (${placement.limb} ${placement.depth})`);
        }
        if (placement.limb === "Lfoot" || placement.limb === "Rfoot") feet += 1;
      }
    }
  }
  assert.deepEqual([...limbs].sort(), [...BARESKIN_LIMBS].sort(), "all ten limbs are reached");
  assert.ok(feet > 0, "the feet are drawn, and are never bareskin");
});

test("REAL PACK: a painted look tints every bareskin op and no foot, and attaches the derived features", () => {
  if (!REAL_ANIMATIONS || !REAL_SHAPES || !REAL_WARDROBE) return;
  const pack = figurePackFrom(REAL_SHAPES, REAL_ANIMATIONS);
  const options = { family: "standing", label: "Standing", facing: "right", at: 0, wardrobe: REAL_WARDROBE, loadout: { helmet: 0 } };
  const grey = paintExtractedFigure(pack, options);
  const look = ss2LookFrom({ skincolor: 5, haircolor: 13, hairstyle: 2, facehairstyle: 3, features: 1 });
  const tinted = paintExtractedFigure(pack, { ...options, appearance: look });
  const body = (ops) => ops.filter((op) => !op.slot);
  assert.equal(body(tinted).length, body(grey).length, "the look adds no body op");
  const skin = colourTransformForLook(5);
  body(grey).forEach((op, index) => {
    const after = body(tinted)[index];
    if (op.limb === "Lfoot" || op.limb === "Rfoot" || op.limb === "weapon") {
      assert.equal(after.fill, op.fill, `${op.limb} is never tinted`);
    }
  });
  const torsoFills = body(tinted).filter((op) => op.limb === "torso").map((op) => op.fill);
  assert.ok(torsoFills.includes(applyColourTransform("#cccccc", skin)), "the torso's grey takes the skin");
  assert.ok(!torsoFills.includes("#cccccc"));
  const slots = tinted.filter((op) => op.slot).map((op) => op.slot);
  assert.ok(slots.includes("features"), "features 7, derived from skin 5 and not the DNA's 1");
  assert.ok(slots.includes("hair") && slots.includes("facehair"), "helmet 0 keeps the hair");
});
