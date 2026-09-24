/**
 * THE DEMO ROSTER'S LOOKS (`tools/arena/roster.js`, 2026-09-24): every demo
 * gladiator gets a look from `randomise_gladiator`'s own rule
 * (`generatedSs2Look`), drawn from a stream seeded by the bout's seed and the
 * slot — the repository's seeded generator, never `Math.random` — and carried
 * BESIDE the combatant, never in it.
 *
 * The owner's report that started it: "Even the bosses right now are all just
 * default grey humans." The champions' looks are tested in
 * `test/arena-champions.test.js`; the arithmetic in
 * `test/render-appearance.test.js`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_LOOK_DEFAULT_SEED, demoItemsFrom, demoLookFor, demoSide } from "../tools/arena/roster.js";
import { SS2_LOOK_LIMITS, featuresForSkin } from "../src/render/appearance.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";

const deps = { ss2Combatant, ss2BattleValues };
const lookOf = (member) => ({ ...member.appearance });
const LOOK_FIELDS = ["skincolor", "haircolor", "hairstyle", "facehairstyle", "features"];

test("every demo gladiator has a look inside the build's own generation ranges, with features derived from skin", () => {
  for (const seed of [1, 2, 7, 12, 99]) {
    for (const side of ["red", "blue"]) {
      for (const member of demoSide(side, 3, { ...deps, seed }).members) {
        const look = member.appearance;
        assert.ok(Object.isFrozen(look), `${member.id} seed ${seed}`);
        assert.ok(look.skincolor >= 1 && look.skincolor <= SS2_LOOK_LIMITS.skincolormax);
        assert.ok(look.haircolor >= 1 && look.haircolor <= SS2_LOOK_LIMITS.colormax);
        assert.ok(look.facehairstyle >= 1 && look.facehairstyle <= SS2_LOOK_LIMITS.facehairstylemax);
        assert.ok(look.hairstyle >= 0 && look.hairstyle <= SS2_LOOK_LIMITS.hairstylemax);
        assert.equal(look.features, featuresForSkin(look.skincolor));
      }
    }
  }
});

test("a look is fixed by the bout's seed and the slot: replayable, and the same slot at any team size", () => {
  const first = demoSide("red", 3, { ...deps, seed: 7 }).members.map(lookOf);
  assert.deepEqual(demoSide("red", 3, { ...deps, seed: 7 }).members.map(lookOf), first, "the same bout looks the same");
  assert.deepEqual(demoSide("red", 1, { ...deps, seed: 7 }).members.map(lookOf), first.slice(0, 1),
    "red-1 in a 1v1 is red-1 in a 3v3");
  assert.deepEqual(demoSide("red", 3, { ...deps }).members.map(lookOf),
    demoSide("red", 3, { ...deps, seed: DEMO_LOOK_DEFAULT_SEED }).members.map(lookOf),
    "no seed is the arena's own default seed");
  // A kit changes the fight, not the look.
  assert.deepEqual(demoSide("red", 3, { ...deps, seed: 7, items: demoItemsFrom("blasts") }).members.map(lookOf), first);
  const other = demoSide("red", 3, { ...deps, seed: 8 }).members.map(lookOf);
  assert.notDeepEqual(other, first, "another seed is another line-up");
});

test("the two sides never look identical, over the first 500 seeds", () => {
  for (let seed = 1; seed <= 500; seed += 1) {
    const red = demoSide("red", 3, { ...deps, seed }).members.map(lookOf);
    const blue = demoSide("blue", 3, { ...deps, seed }).members.map(lookOf);
    assert.notDeepEqual(red, blue, `seed ${seed}`);
    for (let slot = 0; slot < 3; slot += 1) {
      assert.notDeepEqual(red[slot], blue[slot], `seed ${seed} slot ${slot + 1}: two identical gladiators`);
    }
  }
});

test("the villain branch's helmet rule reaches the roster: slot 1 wears helmet 2, so no hair under it", () => {
  for (const seed of [1, 7, 31]) {
    const [first, second, third] = demoSide("red", 3, { ...deps, seed }).members;
    assert.equal(first.vanilla.helmet, 2);
    assert.equal(first.appearance.hairstyle, 0, "+0x2aac: helmet > 1 -> hairstyle 0");
    assert.equal(second.vanilla.helmet, 1);
    assert.ok(second.appearance.hairstyle >= 1, "helmet 1 is not above 1");
    assert.equal(third.vanilla.helmet, 0);
    assert.ok(third.appearance.hairstyle >= 1);
  }
  assert.equal(demoLookFor("red", 0, 7, { helmet: 2 }).hairstyle, 0);
  assert.deepEqual({ ...demoLookFor("red", 0, 7, { helmet: 2 }), hairstyle: null },
    { ...demoLookFor("red", 0, 7), hairstyle: null }, "and the rule moves nothing else");
});

test("the look is NOT in the battle: not on the mirror, not a resource, and a bout with it is the bout without it", () => {
  for (const member of demoSide("blue", 3, { ...deps, seed: 7 }).members) {
    for (const field of LOOK_FIELDS) {
      assert.equal(field in member.vanilla, false, `${member.id}.vanilla.${field}`);
      assert.equal(field in member.resources, false, `${member.id}.resources.${field}`);
    }
  }
  const withoutLook = (side) => ({ ...side, members: side.members.map(({ appearance, ...member }) => member) });
  const play = (teams, seed) => {
    const host = createVanillaBattleHost({ teams, rules: ss2TeamRules, bindings: SS2_STATIC_MAP_BINDINGS, seed });
    const hashes = [host.hash()];
    for (let turn = 0; turn < 60 && !host.battle.result; turn += 1) {
      host.submit({ actorId: host.currentCombatantId(), ...host.suggestAction() });
      hashes.push(host.hash());
    }
    return hashes;
  };
  for (const seed of [3, 7]) {
    const teams = [demoSide("red", 3, { ...deps, seed }), demoSide("blue", 3, { ...deps, seed })];
    const played = play(teams, seed);
    assert.ok(played.length > 10, "the bout actually runs");
    assert.deepEqual(play(teams.map(withoutLook), seed), played, `seed ${seed}: the look moves no hash`);
  }
});
