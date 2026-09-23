/**
 * The arena's `?items=` kits (`tools/arena/roster.js`, 2026-09-23): the demo
 * roster's slots are EMPTY (the build's marker, 1) unless a kit is asked for,
 * so the roster every existing test and tool builds is unchanged.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_ITEM_KITS, demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";

const build = (items) => demoSide("red", 2, { ss2Combatant, ss2BattleValues, ...(items ? { items } : {}) });
const slots = (member) => [1, 2, 3, 4, 5, 6].map((n) => member.vanilla[`inventory${n}`]);

test("no kit is the roster as it always was: six empty slots", () => {
  assert.deepEqual(demoItemsFrom(null), []);
  assert.deepEqual(demoItemsFrom(""), []);
  for (const member of build().members) assert.deepEqual(slots(member), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(build([]).members.map(slots), build().members.map(slots));
});

test("a kit fills the six slots in order, for every member", () => {
  const items = demoItemsFrom("tricks");
  assert.deepEqual(items, [...DEMO_ITEM_KITS.tricks]);
  for (const member of build(items).members) assert.deepEqual(slots(member), items);
});

test("kits and ids mix, and only the first six are kept", () => {
  assert.deepEqual(demoItemsFrom("42,blasts"), [42, 34, 35, 30, 31, 32]);
  assert.deepEqual(demoItemsFrom("43"), [43]);
});

test("a typo is refused loudly, and 1 (the EMPTY marker) is not an item", () => {
  assert.throws(() => demoItemsFrom("buff"), /neither a kit/);
  assert.throws(() => demoItemsFrom("1"), /EMPTY marker/);
  assert.throws(() => demoItemsFrom("4.5"), /neither a kit/);
});

/**
 * ► **EVERY KIT THROUGH THE HOST THE ARENA USES — added 2026-09-23, because two
 *   of the four could not be built at all.** `buffs` and `crowd` died in
 *   `createVanillaBattleHost` with "no battle-map section cites"
 *   `backup_shoulderguard`: the tests above only ever looked at the roster's
 *   slots, and every spell test built its battle with `createTeamBattle`
 *   directly. The fix is in `src/adapter/vanilla-fields.js` (the backups are
 *   cited) and `ss2TimedBuffDeclarations` (the invented tick clock left the
 *   bag); `test/ss2-host-spell-resources.test.js` has the per-spell cases.
 *
 * The arena's own 2v2 (`demoSide`, both sides carrying the kit), arena built,
 * seed 7, each turn the rule set's AI suggestion (`suggestAction`, as the
 * arena's spectator seats use) — for 60 actions or until the bout settles.
 *
 * **THE CAST LISTS ARE MEASURED, NOT DERIVED** (2026-09-23, on 5322ce4 plus
 * this fix; `buffs` and `crowd` had no earlier output to measure, because they
 * threw). They pin the AI's choices, so a change to `chooseAiAction` or to the
 * offer that moves them is a real change to what the arena shows: re-measure
 * and say why, never refresh one to make this pass.
 */
const KIT_BOUTS = Object.freeze({
  buffs: {
    actions: 39,
    result: "elimination",
    casts: [
      "cast-boundless-energy", "cast-boundless-energy", "cast-boundless-energy", "cast-boundless-energy",
      "cast-swiftsandals", "cast-swiftsandals", "cast-swiftsandals", "cast-swiftsandals",
      "cast-colossus", "cast-colossus", "cast-colossus",
      "cast-bloodlust", "cast-bloodlust", "cast-bloodlust",
      "cast-rejuvinate", "cast-rejuvinate", "cast-regenerate", "cast-colossus"
    ]
  },
  blasts: { actions: 2, result: "elimination", casts: ["cast-death-from-above", "cast-death-from-above"] },
  tricks: {
    actions: 60,
    result: null,
    casts: [
      "cast-command", "cast-weaken-armour", "cast-weaken-armour", "cast-ghost-strike", "cast-weaken-armour",
      "cast-whirlwind", "cast-command", "cast-whirlwind", "cast-weaken-armour", "cast-gale", "cast-ghost-strike",
      "cast-gale", "cast-ghost-strike", "cast-command"
    ]
  },
  crowd: {
    actions: 60,
    result: null,
    casts: [
      "cast-adulation", "cast-adulation", "cast-adulation", "cast-adulation",
      "cast-little-fat-kid", "cast-little-fat-kid", "cast-little-fat-kid",
      "drink-potion", "drink-potion", "cast-rejuvinate", "cast-little-fat-kid", "drink-potion"
    ]
  }
});

const isCast = (type) => type.startsWith("cast-") || type.startsWith("drink-") || type === "wincrowd";

for (const kit of Object.keys(DEMO_ITEM_KITS)) {
  test(`the ${kit} kit builds through createVanillaBattleHost and its AI plays 60 actions, or to a result, without error`, () => {
    const items = demoItemsFrom(kit);
    const host = createVanillaBattleHost({
      teams: [
        demoSide("red", 2, { ss2Combatant, ss2BattleValues, items }),
        demoSide("blue", 2, { ss2Combatant, ss2BattleValues, items })
      ],
      rules: ss2TeamRules,
      bindings: SS2_STATIC_MAP_BINDINGS,
      seed: 7
    });
    host.constructArena();
    const taken = [];
    for (let actions = 0; actions < 60 && !host.battle.result; actions += 1) {
      const suggestion = host.suggestAction();
      taken.push(suggestion.type);
      host.submit({ actorId: host.currentCombatantId(), ...suggestion });
    }
    const expected = KIT_BOUTS[kit];
    assert.equal(host.steps.length, expected.actions, "every action went through the host's own pipeline");
    assert.equal(host.battle.result?.reason ?? null, expected.result);
    assert.deepEqual(taken.filter(isCast), expected.casts, "what the AI cast, in order");
  });
}
