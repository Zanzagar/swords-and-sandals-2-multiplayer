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
  // ► **MOVED 2026-09-23, by two engine fixes, each on its own** (measured with
  //   each reverted by exact inverse; with BOTH reverted this is the old list
  //   again, and so is every action hash of 384 seeded 2v2/3v3 bouts):
  //   - facing prefers the gladiator's own rank (a rank change re-faces from
  //     the new one), turns a swinger to his target, and re-derives after a
  //     kill (`ss2FacingEffects`, `ss2SwingTurn`, `ss2FacingsAfterKills`) —
  //     alone, it appends `cast-whirlwind`, `cast-command` to the old 14;
  //   - the whirlwind's gate no longer reaches across ranks, and the AI whirls
  //     at the nearest foe in its OWN rank (`ss2PsycheDischargeInRange`) —
  //     alone, 13 casts, diverging at the second whirlwind: … command, gale,
  //     gale, ghost, command, teleport, command.
  //   Was: command, weaken x2, ghost, weaken, whirlwind, command, whirlwind,
  //   weaken, gale, ghost, gale, ghost, command.
  // ► **MOVED AGAIN 2026-09-23 BY THE OWNER'S TAUNT RULE, ON TOP OF THE
  //   FACING CHANGE ABOVE (main session, at merge):** with both in, the bout
  //   is 60 actions, no result, and the 13 casts below. With the taunt rule
  //   reverted, HEAD's committed 22-cast list returns, so the taunt rule is
  //   the whole of this move. The taunt implementer's note that follows was
  //   measured on a base WITHOUT the facing change, and its "34 actions, blue
  //   by elimination" is ~~current~~ superseded by the combination:
  // ► ~~**MOVED 2026-09-23 BY THE OWNER'S TAUNT RULE, and by nothing else**:~~
  //   ~~`actions: 60, result: null`~~. A taunt now names only a foe in the
  //   taunter's own rank. At action 10 the red archer (rank y 103) used to
  //   taunt blue-1 in rank 200, 66 units away, and did so five times before
  //   blue-1 changed rank; it now rests on those turns and the bout settles at
  //   34 actions, blue by elimination. The cast list is unchanged, in order.
  //   Proven the only cause by reverting the rule — the offer's
  //   `ss2SameLane` test and `ss2TauntValue`'s, BOTH (either one alone still
  //   moves this, because the AI prices a cross-rank taunt at 0 through the
  //   second) — and watching 60/null return with every other change in place.
  // ► **AND MOVED A THIRD TIME 2026-09-23, BY THE APPROACH FIX THE TAUNT RULE
  //   EXPOSED** (`chooseAiAction`'s walk arm now steps toward the nearest foe
  //   in its OWN rank when it has one; see `test/ss2-rank-join.test.js`, "THE
  //   WALK GOES TOWARD A FOE IN ITS OWN RANK"). ~~60 actions, no result, 13
  //   casts~~ → **48 actions, red by elimination, the 16 casts below.** The
  //   first divergence is action 9: blue-1 at (-190, 200) walked LEFT toward
  //   red-2 one rank back and now walks RIGHT toward red-1 in its own rank.
  //   With the walk fix reverted by exact inverse, 60/null and the 13 casts
  //   (command, weaken x2, ghost, weaken, whirlwind, command, gale, weaken,
  //   ghost, gale, ghost, command) return.
  tricks: {
    actions: 48,
    result: "elimination",
    casts: [
      "cast-command", "cast-weaken-armour", "cast-weaken-armour", "cast-ghost-strike", "cast-weaken-armour",
      "cast-whirlwind", "cast-command", "cast-gale", "cast-weaken-armour", "cast-whirlwind", "cast-gale",
      "cast-ghost-strike", "cast-command", "cast-whirlwind", "cast-teleport", "cast-ghost-strike"
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
