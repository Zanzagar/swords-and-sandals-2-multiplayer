/**
 * THE BUILD'S OWN CHAMPIONS, built from the build's own DNA.
 *
 * WHY THIS FILE EXISTS. `ss2Combatant` applied the shop's purchase gate to
 * every record that states a weapon id, and so refused seven of the eighteen
 * champion literals in `unleash_hell` — among them two of the three that walk
 * in with the bow drawn. A champion's weapon is never BOUGHT: `unleash_hell`
 * writes a literal `charDNA` onto a fresh `game.champion`, and `initcharacter`
 * decodes it field by field with no gate of any kind. The gate lives in the
 * weapon shop's `onRelease` and reads `_root.game.hero` (`sprite:1961/frame:1`
 * `DoAction@0x6110ce` `+0x05e7` snapshots `hero.speed`, `+0x0929`-`+0x0941`
 * compares it before `buyweapon`). Found by the 2026-09-23 bow-villain audit,
 * finding F5, confirmed by a refuter.
 *
 * THE DNA VALUES were transcribed from the measurement oracle's action dump,
 * out of `unleash_hell(which_boss)` — `root/frame:35` `DoAction@0x3f8539`,
 * `DefineFunction2` at `+0x1812`, where `which_boss` is `register:3` — each
 * from the literal its branch pushes beside `"charDNA"` (the branch guarded by
 * `Push register:3, <n>; Equals2`). **Only the numeric fields these tests
 * decode are carried, keyed by DNA index.** The literal itself also holds the
 * champion's name, and the repository ships no text of the build's own: a
 * clone must still need its own licensed copy. Champions are therefore named
 * here only by `which_boss`.
 *
 * THE INDICES are `initcharacter`'s own (`DoAction@0x40bf76`, `+0x0592`): one
 * `whichcharacter.<field> = ToNumber(characterDNA[<n>])` per field, the
 * `Push register:3, "<field>"` offset given beside each below. They agree with
 * `docs/integration/ss2-champion-dna.md` §1, and were re-read off the dump
 * rather than copied from it.
 *
 * EVERY EXPECTED NUMBER comes from the build's weapon rows and `battlevalues`'
 * formulas, cited at the row. None is read back out of the engine: a champion
 * whose derived value drifted would fail here, not re-pin itself.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction,
  chooseAiAction,
  combatantById,
  createTeamBattle,
  currentCombatant,
  legalActions
} from "../src/team/index.js";
import { TeamRuleSetError } from "../src/team/rule-set.js";
import { ss2ChampionFromDna } from "../src/team/ss2-champion-dna.js";
import {
  createSs2TeamRules,
  ss2ActiveDamagePair,
  ss2Combatant,
  ss2InBowMode,
  ss2Reach,
  Ss2ActionType
} from "../src/team/ss2-rules.js";

/**
 * `initcharacter`'s decode, from the shared module (`src/team/ss2-champion-dna.js`,
 * moved out of this file 2026-09-23 when the browser arena began building
 * champions too). It refuses every index that is missing or not a number, by
 * name, so a field dropped from a table below fails here rather than reaching
 * `ss2Combatant` as `undefined` and being defaulted. Its index map is held
 * against the doc's table in `test/ss2-champion-dna-decode.test.js`.
 */
const decode = ss2ChampionFromDna;

/**
 * The three champions whose literal carries `equipped_weapon` 2 at index 49.
 *
 * Expected numbers, from `battlevalues` (`DoAction@0x3fa9dc`):
 *   physical_size          = 80 + round(strength / 1.5)            +0x30f1
 *   weapon_range           = physical_size + weapon[5] * 44         +0x3190
 *   secondary_weapon_range = physical_size + secondary[5] * 44      +0x32aa
 *   min/max_damage         = round(strength * 2) + weapon[3]/[4]    +0x3356, +0x3386
 *   secondary pair         = round(strength * 1) + secondary[3]/[4] +0x33b6, +0x33e6
 *   shield_defence         = round(shield * 12)                     +0x35f7, dval +0x30e4
 * and each weapon row is the `Array(type, name, weight, min, max, range)` the
 * same block builds (arguments read in AVM1 pop order).
 */
const CHAMPIONS = Object.freeze([
  {
    whichBoss: 2,
    at: "+0x1987",
    dna: Object.freeze({
      6: 4, 7: 11, 8: 5, 9: 103, 10: 4, 11: 5, 12: 6, 13: 2, 14: 0,
      16: 1, 17: 12, 18: 9, 19: 4, 20: 5, 21: 6, 22: 6, 23: 5, 24: 7,
      32: 0, 33: 0, 34: 38, 35: 3, 36: 38, 37: 0, 38: 0, 39: 0, 40: 2,
      45: 64, 46: 1, 47: 5, 48: 10, 49: 2
    }),
    // strength 1 -> physical_size 81. weapon2 (+0x3e40): min 4, max 16, range 1.
    // weapon64 (+0x4869): min 7, max 49, range 100. shield 0.
    melee: { min_damage: 6, max_damage: 18 },
    weaponRange: 125,
    bow: { min_damage: 8, max_damage: 50 },
    bowRange: 4481,
    shieldDefence: 0,
    shopRefuses: null
  },
  {
    whichBoss: 4,
    at: "+0x1a8d",
    dna: Object.freeze({
      6: 6, 7: 6, 8: 6, 9: 105, 10: 6, 11: 6, 12: 6, 13: 8, 14: 7,
      16: 3, 17: 16, 18: 10, 19: 10, 20: 10, 21: 12, 22: 13, 23: 10, 24: 14,
      32: 0, 33: 0, 34: 48, 35: 48, 36: 40, 37: 38, 38: 0, 39: 0, 40: 2,
      45: 68, 46: 2, 47: 2, 48: 12, 49: 2
    }),
    // strength 3 -> physical_size 82. weapon8 (+0x3f36): min 10, max 100, range 2.
    // weapon68 (+0x4915): min 11, max 121, range 100. shield 7.
    melee: { min_damage: 16, max_damage: 106 },
    weaponRange: 170,
    bow: { min_damage: 14, max_damage: 124 },
    bowRange: 4482,
    shieldDefence: 84,
    // weapon 8 is slashing band position 8: the shop demands speed 24, he has 16.
    shopRefuses: /weapon 8, which the shop gates at speed >= 24/
  },
  {
    whichBoss: 16,
    at: "+0x20b1",
    dna: Object.freeze({
      6: 25, 7: 25, 8: 25, 9: 116, 10: 25, 11: 25, 12: 25, 13: 20, 14: 25,
      16: 55, 17: 30, 18: 40, 19: 40, 20: 40, 21: 30, 22: 20, 23: 20, 24: 48,
      32: 2, 33: 3, 34: 47, 35: 47, 36: 47, 37: 47, 38: 39, 39: 48, 40: 6,
      45: 79, 46: 3, 47: 3, 48: 5, 49: 2
    }),
    // strength 55 -> physical_size 117. weapon20 (+0x4122): min 26, max 676, range 3.
    // weapon79 (+0x4aee): min 22, max 484, range 100. shield 25.
    melee: { min_damage: 136, max_damage: 786 },
    weaponRange: 249,
    bow: { min_damage: 77, max_damage: 539 },
    bowRange: 4517,
    shieldDefence: 300,
    // weapon 20 is slashing band position 20: the shop demands speed 60, he has 30.
    shopRefuses: /weapon 20, which the shop gates at speed >= 60/
  }
]);

/** An ordinary created gladiator to stand opposite, with a weapon the shop sells him. */
const HERO = { strength: 5, speed: 5, attack: 5, defence: 5, vitality: 3, stamina: 4, magicka: 1, charisma: 3, herolevel: 3, weapon: 1 };

function arena(champion) {
  return createTeamBattle({
    seed: 1,
    rules: createSs2TeamRules(),
    teams: [
      { id: "hero", name: "hero", combatants: [ss2Combatant(HERO, { id: "hero-1", name: "hero", controller: "local" })] },
      { id: "champion", name: "champion", combatants: [champion] }
    ]
  });
}

test("the build's three bow-drawn champions construct from their own unleash_hell DNA", () => {
  for (const { whichBoss, at, dna, melee, weaponRange, bowRange, shieldDefence } of CHAMPIONS) {
    const label = `which_boss ${whichBoss} (${at})`;
    const record = decode(dna);
    assert.equal(record.equipped_weapon, 2, `${label}: index 49 carries the bow`);

    const champion = ss2Combatant(record, {
      id: `boss-${whichBoss}`, name: `boss-${whichBoss}`, controller: "ai", weaponFrom: "unleash_hell"
    });
    const bag = champion.resources;
    assert.deepEqual({ min_damage: bag.min_damage, max_damage: bag.max_damage }, melee, `${label}: the melee pair`);
    assert.equal(bag.weapon_range, weaponRange, `${label}: the melee reach`);
    assert.equal(bag.secondary_weapon_range, bowRange, `${label}: the bow's reach`);
    assert.equal(bag.shield_defence, shieldDefence, `${label}: the sheathed shield rating`);
    assert.equal(bag.equipped_weapon, 2, `${label}: the DNA's weapon slot survives construction`);

    // And the rule set's own construction gate takes him too.
    const inBattle = combatantById(arena(champion), `boss-${whichBoss}`);
    assert.equal(inBattle.resources.equipped_weapon.value, 2, `${label}: enters the battle as constructed`);
  }
});

test("a record that says nothing about its weapon is still held to the shop's gate", () => {
  // The default is unchanged: what the owner imported on 2026-09-10 for a
  // CONSTRUCTED gladiator still binds every caller that does not state where
  // its weapon came from.
  let refused = 0;
  for (const { whichBoss, dna, shopRefuses } of CHAMPIONS) {
    const record = decode(dna);
    if (shopRefuses === null) {
      assert.ok(ss2Combatant(record, { id: `boss-${whichBoss}` }), `which_boss ${whichBoss} passes the gate outright`);
      continue;
    }
    refused += 1;
    assert.throws(
      () => ss2Combatant(record, { id: `boss-${whichBoss}` }),
      (error) => error instanceof TeamRuleSetError && shopRefuses.test(error.message),
      `which_boss ${whichBoss}: no weaponFrom means a shop purchase, and the shop would not have sold it`
    );
    assert.throws(
      () => ss2Combatant(record, { id: `boss-${whichBoss}`, weaponFrom: "shop" }),
      (error) => error instanceof TeamRuleSetError && shopRefuses.test(error.message),
      `which_boss ${whichBoss}: weaponFrom "shop" is the default, stated`
    );
  }
  assert.equal(refused, 2, "the sweep found both champions the gate refuses");

  // A route the engine has not traced is refused, not treated as exempt: a typo
  // must not be a way past the gate.
  assert.throws(
    () => ss2Combatant(decode(CHAMPIONS[1].dna), { id: "boss-4", weaponFrom: "unleash-hell" }),
    (error) => error instanceof TeamRuleSetError && /weaponFrom/.test(error.message) && /unleash-hell/.test(error.message)
  );
});

test("weaponFrom unleash_hell lifts the stat demand only, and a ranged PRIMARY is still refused", () => {
  // `buyweapon` never puts ids 61-80 in the primary slot, and no unleash_hell
  // literal does either (their index-13 ids are 0, 24, 2, 46, 8, 27, 2, 203,
  // 204, 206, 55, 37, 207, 33, 14, 210, 20, 220). The refusal also protects
  // every distance check from a weapon_range in the thousands, which has
  // nothing to do with how the weapon was acquired.
  const record = { ...decode(CHAMPIONS[1].dna), weapon: 68 };
  assert.throws(
    () => ss2Combatant(record, { id: "boss-4", weaponFrom: "unleash_hell" }),
    (error) => error instanceof TeamRuleSetError && /ranged band/.test(error.message)
  );
});

/**
 * ► **DECIDED BY THE OWNER 2026-09-23 (HANDOFF.md living head): NORMALISED.**
 *   ~~OPEN, AND THE OWNER'S~~ — these three champions enter as proper archers
 *   under the engine's single bow flag, `equipped_weapon`, and the build's
 *   split state below is a named divergence, not reproduced. The expectations
 *   did not move: they already pinned the engine's reading, which is now the
 *   decided one. The arena builds its champions the same way
 *   (`championSide`, `tools/arena/roster.js`).
 *
 *   **What the build does: a champion enters the arena with
 *   `equipped_weapon` 2 and `using_bow` never written.** Nothing on the way to
 *   the fight writes the villain's `using_bow` (the only writers in the build
 *   are root frame 221 `+0x059e`, on the HERO, and the swap arm `+0x4dce` /
 *   `+0x4ecb`), so the build holds a split state this engine cannot represent:
 *   - the BUILD draws the bow and runs the archer AI (both keyed on
 *     `equipped_weapon`; bow-villain audit F3, confirmed by a refuter, not
 *     re-read here), but `battlevalues` keys on `using_bow`: `+0x3416` jumps
 *     past the bow block when it is falsy, so it keeps the MELEE pair and
 *     melee `weapon_range`, and `+0x35e2` tests `== true`, so the shield still
 *     counts. Its first swap then DRAWS, because the swap arm tests the same
 *     `== true` (`+0x4da4`) and falls into the draw branch;
 *   - THIS ENGINE decides bow mode from `equipped_weapon` alone
 *     (`ss2InBowMode`), so the same champion fights with the bow pair and bow
 *     reach from turn one, and its first swap sheathes.
 *
 * This test pins the ENGINE, not the build, and the engine's reading is the
 * owner's decision: the named divergence lives here, beside its evidence.
 */
test("NORMALISED (owner, 2026-09-23): a champion with the bow drawn and using_bow unwritten fights as an archer here, and not in the build", () => {
  for (const { whichBoss, dna, melee, weaponRange, bow, bowRange } of CHAMPIONS) {
    const label = `which_boss ${whichBoss}`;
    const champion = ss2Combatant(decode(dna), { id: `boss-${whichBoss}`, controller: "ai", weaponFrom: "unleash_hell" });
    const inBattle = combatantById(arena(champion), `boss-${whichBoss}`);

    assert.equal(ss2InBowMode(inBattle), true, `${label}: the engine reads the bow as drawn`);
    assert.deepEqual(ss2ActiveDamagePair(inBattle), bow, `${label}: ENGINE fights with the bow pair (the build: ${melee.min_damage}-${melee.max_damage})`);
    assert.equal(ss2Reach(inBattle), bowRange, `${label}: ENGINE reaches with the bow (the build's weapon_range: ${weaponRange})`);
  }
});

/**
 * Two of the TEN champions whose literal carries 0 at index 45 — which_boss 0,
 * 1, 3, 5, 7, 8, 10, 12, 13 and 18 (`secondary_weapon`, `initcharacter`
 * `+0x0a01`). Transcribed from the same `unleash_hell` literals as `CHAMPIONS`,
 * by the same rule: numeric fields only, keyed by DNA index.
 *
 * Expected numbers, from `battlevalues` and weapon row 0 (`[5]` = 1):
 *   secondary_weapon_range = physical_size + 1 * 44                 +0x32aa
 * which_boss 1: strength 6  -> physical_size 84 -> 128.
 * which_boss 3: strength 17 -> physical_size 91 -> 135.
 */
const NO_SECOND_WEAPON = Object.freeze([
  {
    whichBoss: 1,
    at: "+0x1904",
    dna: Object.freeze({
      6: 1, 7: 1, 8: 1, 9: 102, 10: 2, 11: 4, 12: 1, 13: 24, 14: 0,
      16: 6, 17: 3, 18: 1, 19: 3, 20: 3, 21: 2, 22: 5, 23: 1, 24: 5,
      32: 1, 33: 4, 34: 6, 35: 1, 36: 0, 37: 0, 38: 0, 39: 0, 40: 1,
      45: 0, 46: 0, 47: 0, 48: 5, 49: 1
    }),
    pricedReach: 128
  },
  {
    whichBoss: 3,
    at: "+0x1a0a",
    dna: Object.freeze({
      6: 10, 7: 11, 8: 1, 9: 104, 10: 10, 11: 10, 12: 10, 13: 46, 14: 0,
      16: 17, 17: 3, 18: 9, 19: 2, 20: 7, 21: 3, 22: 9, 23: 17, 24: 10,
      32: 1, 33: 3, 34: 7, 35: 1, 36: 6, 37: 0, 38: 0, 39: 0, 40: 2,
      45: 0, 46: 1, 47: 1, 48: 5, 49: 1
    }),
    pricedReach: 135
  }
]);

/**
 * ► **A 0 IN THE SECONDARY SLOT IS NO WEAPON, AND IT USED TO BE A BOW.** The
 *   build's every swap gate asks `secondary_weapon == 0` — the hero's button
 *   (`sprite:862/frame:1/DoAction@0x2378cc` `+0x0e4a`-`+0x0e89`) and the
 *   villain's swap roll (`DoAction@0x23f835` `+0x0f14`-`+0x0f27`) — while
 *   `battlevalues` prices the slot off weapon row 0 regardless, so the champion
 *   carries a reach. The engine offered the swap on the reach, the AI drew
 *   row 0 at range, and a mirror bout of either champion below ran to 400
 *   actions of taunts with no winner (measured 2026-09-23, seed 1).
 */
test("a champion whose secondary slot holds 0 is never offered the swap, and a mirror bout of him settles", () => {
  for (const { whichBoss, at, dna, pricedReach } of NO_SECOND_WEAPON) {
    const label = `which_boss ${whichBoss} (${at})`;
    const record = decode(dna);
    assert.equal(record.secondary_weapon, 0, `${label}: index 45 is 0`);
    const build = (id) => ss2Combatant(record, { id, name: id, controller: "ai", weaponFrom: "unleash_hell" });
    const battle = createTeamBattle({
      seed: 1,
      rules: createSs2TeamRules(),
      teams: [
        { id: "red", name: "red", combatants: [build("red-1")] },
        { id: "blue", name: "blue", combatants: [build("blue-1")] }
      ]
    });
    // The premise: the slot is priced, so only the id can say "no bow".
    assert.equal(
      combatantById(battle, "red-1").resources.secondary_weapon_range.value,
      pricedReach,
      `${label}: battlevalues prices row 0 as a reach`
    );

    let actions = 0;
    while (!battle.result && actions < 400) {
      const actor = currentCombatant(battle);
      assert.ok(
        !legalActions(battle, actor.id).some((option) => option.type === Ss2ActionType.SWAP_WEAPONS),
        `${label}: ${actor.id} is offered a swap to a weapon it does not have, at action ${actions}`
      );
      applyAction(battle, { actorId: actor.id, ...chooseAiAction(battle) });
      actions += 1;
    }
    assert.notEqual(battle.result, null, `${label}: the mirror bout settles inside 400 actions`);
    for (const id of ["red-1", "blue-1"]) {
      assert.equal(combatantById(battle, id).resources.equipped_weapon.value, 1, `${label}: ${id} never drew`);
    }
  }
});
