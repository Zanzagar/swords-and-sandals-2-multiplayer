/**
 * The wardrobe extractor's linkage-name rule and its guards.
 *
 * The extraction itself needs a licensed build — `node tools/extract-wardrobe.mjs
 * --report` measures it and writes nothing. What is under the suite is the part
 * that decides WHICH exported symbols are wardrobe and what they mean, because
 * that rule is the whole join between the item tables and the art.
 *
 * What the real build contributes is numbers, quoted and not stored: 387
 * wardrobe pieces across 12 slots, 401 distinct shapes, 0 failures — 89 weapons
 * (ids 0..220), 40 helmets (1..120), 40 hair (1..40), 25 each of the six body
 * armour slots (2..26), 25 shields (0..25), 24 facehair (1..24), 19 features.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  WARDROBE_SLOTS,
  WardrobeError,
  parseArguments,
  splitLinkageName
} from "../tools/extract-wardrobe.mjs";

test("a linkage name is a slot and an ID, and the ID is the item row's own", () => {
  // This is the join the item tables were thought to be missing: `weapon12` is
  // the art for weapon row 12. 89 weapon symbols against ~90 weapon rows.
  assert.deepEqual(splitLinkageName("helmet3"), { slot: "helmet", id: 3 });
  assert.deepEqual(splitLinkageName("weapon220"), { slot: "weapon", id: 220 });
  assert.deepEqual(splitLinkageName("shield0"), { slot: "shield", id: 0 });
  assert.deepEqual(splitLinkageName("facehair24"), { slot: "facehair", id: 24 });
});

test("the suffix carries the meaning, so a name without one is NOT a wardrobe piece", () => {
  // ► `helmetx` is not helmet anything. Reading it as a helmet would invent an
  //   item, and the export table holds 502 symbols of which only 387 are
  //   wardrobe — the other 115 must not be swept in by a loose match.
  assert.equal(splitLinkageName("helmet"), null, "a bare slot name is a family, not a piece");
  assert.equal(splitLinkageName("helmetx"), null);
  assert.equal(splitLinkageName("3helmet"), null, "the number is a SUFFIX");
  assert.equal(splitLinkageName("myhelmet3"), null, "and the slot is anchored at the start");
  assert.equal(splitLinkageName("hero_battle"), null);
  assert.equal(splitLinkageName(""), null);
  assert.equal(splitLinkageName(null), null);
  assert.equal(splitLinkageName(42), null);
});

test("a name whose prefix is not one of the build's OWN slots is refused", () => {
  // ► **`realweapon` is in the dressing code's constant pool and is NOT a slot.**
  //   It names a variable inside `updatecharacter`, not a linkage family, and
  //   no symbol is exported under it. The slot list is derived from the EXPORT
  //   TABLE and only cross-checked against the pool, which is why this is
  //   caught rather than believed.
  assert.equal(splitLinkageName("realweapon1"), null);
  assert.equal(splitLinkageName("bareskin1"), null, "bareskin is a TINT target, not an attachable");
  assert.equal(splitLinkageName("torso1"), null, "a limb is where a piece goes, not a piece");
  assert.equal(splitLinkageName("sparks1"), null);
});

test("the slot list is the build's twelve, and every one is lower case and anchored", () => {
  assert.equal(WARDROBE_SLOTS.length, 12);
  for (const slot of ["helmet", "breastplate", "shoulderguard", "gauntlet", "greaves",
    "shinguard", "boot", "shield", "weapon", "hair", "facehair", "features"]) {
    assert.ok(WARDROBE_SLOTS.includes(slot), `${slot} must be a wardrobe slot`);
    assert.deepEqual(splitLinkageName(`${slot}7`), { slot, id: 7 });
  }
  // The eight the ENGINE already models are a subset: `src/render/figure.js`'s
  // ARMOUR_SLOTS. The four extra — weapon, hair, facehair, features — are
  // appearance the engine has never had a slot for.
  for (const armour of ["boot", "shinguard", "greaves", "breastplate", "gauntlet", "shoulderguard", "helmet", "shield"]) {
    assert.ok(WARDROBE_SLOTS.includes(armour), `${armour} is one of the engine's eight`);
  }
});

test("an unknown flag THROWS rather than running a different job and reporting it as this one", () => {
  assert.equal(parseArguments(["--report"]).report, true);
  assert.equal(parseArguments(["/some/build.swf"]).file, "/some/build.swf");
  assert.throws(() => parseArguments(["--slots", "helmet"]), (error) => {
    assert.ok(error instanceof WardrobeError);
    assert.match(error.message, /Unknown flag "--slots"/);
    return true;
  });
  assert.throws(() => parseArguments(["--out"]), /--out needs a directory path/);
  assert.throws(() => parseArguments(["a.swf", "b.swf"]), /Unexpected argument/);
});
