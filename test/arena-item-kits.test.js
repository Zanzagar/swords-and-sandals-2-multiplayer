/**
 * The arena's `?items=` kits (`tools/arena/roster.js`, 2026-09-23): the demo
 * roster's slots are EMPTY (the build's marker, 1) unless a kit is asked for,
 * so the roster every existing test and tool builds is unchanged.
 *
 * ► **A KIT FIGHTER IS NOT THE PLAIN ROSTER WITH ITEMS ANY MORE (2026-09-23).**
 *   The owner watched `?items=blasts` and saw "guys dying immediately after one
 *   hit". Every kit now brings a level-4 magicka and — given the bout's seed —
 *   an opener that alternates by seed parity; a kit holding a DAMAGE spell also
 *   brings `battlevalues`' own pools. With no kit, not one byte of the roster
 *   moves; the first tests pin that.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DEMO_DAMAGE_SPELL_IDS, DEMO_ITEM_KITS, demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import {
  SS2_BOLT_SPELLS, SS2_DEATH_FROM_ABOVE, SS2_FIREBALL_SPELLS, Ss2ActionType, ss2BattleValues, ss2Combatant, ss2TeamRules
} from "../src/team/ss2-rules.js";
import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";

const deps = { ss2Combatant, ss2BattleValues };
const build = (items) => demoSide("red", 2, { ...deps, ...(items ? { items } : {}) });
const slots = (member) => [1, 2, 3, 4, 5, 6].map((n) => member.vanilla[`inventory${n}`]);

/** The arena's own host (`tools/arena/main.js`): both sides carry the kit, and the seed reaches the roster. */
function arenaHost({ items, perSide = 2, seed = 7 }) {
  return createVanillaBattleHost({
    teams: [demoSide("red", perSide, { ...deps, items, seed }), demoSide("blue", perSide, { ...deps, items, seed })],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed,
    awaitAnimations: true
  });
}

/**
 * sha256 of `JSON.stringify` of all six no-kit sides (red and blue at 1, 2 and
 * 3 a side), MEASURED at 3f386d7 before kits learned pools, magicka or a seed.
 * It is a literal on purpose: every other test in the suite that builds the
 * demo roster without a kit relies on this not moving.
 */
const PLAIN_ROSTER_SHA256 = "a529ec13e796d44e6a6b2cffa74c109b92883850b869fdd4014268d24e5da689";
const plainRosterHash = (extra) => {
  const sides = [];
  for (const size of [1, 2, 3]) for (const side of ["red", "blue"]) sides.push(demoSide(side, size, { ...deps, ...extra }));
  return crypto.createHash("sha256").update(JSON.stringify(sides)).digest("hex");
};

test("no kit is the roster as it always was: six empty slots", () => {
  assert.deepEqual(demoItemsFrom(null), []);
  assert.deepEqual(demoItemsFrom(""), []);
  for (const member of build().members) assert.deepEqual(slots(member), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(build([]).members.map(slots), build().members.map(slots));
});

test("no kit is the roster as it always was, byte for byte, whatever the seed", () => {
  assert.equal(plainRosterHash({}), PLAIN_ROSTER_SHA256);
  assert.equal(plainRosterHash({ items: [] }), PLAIN_ROSTER_SHA256);
  // The seed only ever moves a KIT bout's opener.
  assert.equal(plainRosterHash({ items: [], seed: 8 }), PLAIN_ROSTER_SHA256);
  assert.equal(plainRosterHash({ seed: 7 }), PLAIN_ROSTER_SHA256);
});

/**
 * ► **ITEM 49 IS ITS OWN KIT, AND NO OTHER KIT HOLDS IT.** The AI casts death
 *   from above on possession — ladder arm 7, before every other spell the kit
 *   holds (`docs/integration/ss2-battle-map.md`, the ladder table's
 *   `| **7** | **49** | **cast_death_from_above** | **NONE** |` row) — and its
 *   400-800 kills any demo gladiator from full. So a kit holding it showed
 *   nothing else.
 */
test("blasts is the two level-4 damage spells; 49 stands alone in doom; no other kit holds it", () => {
  // Lightning bolt and fireball: the only damage spells the build's generator
  // hands a magicka-12 opponent (battle map, `randomise_gladiator`'s pool).
  assert.deepEqual([...DEMO_ITEM_KITS.blasts], [34, 30]);
  assert.deepEqual([...DEMO_ITEM_KITS.doom], [49]);
  assert.deepEqual(demoItemsFrom("doom"), [49]);
  for (const [name, kit] of Object.entries(DEMO_ITEM_KITS)) {
    if (name !== "doom") assert.equal(kit.includes(49), false, `${name} holds 49`);
  }
  // The four kits the arena already had are otherwise untouched.
  assert.deepEqual([...DEMO_ITEM_KITS.buffs], [42, 41, 40, 45, 46, 43]);
  assert.deepEqual([...DEMO_ITEM_KITS.tricks], [38, 48, 39, 37, 36, 44]);
  assert.deepEqual([...DEMO_ITEM_KITS.crowd], [47, 33, 43, 5, 7, 9]);
});

/**
 * The pools, worked by hand from `battlevalues`' formulas — never read back
 * out of `ss2BattleValues`:
 *
 *   hitpointsmax = herolevel * 10 + vitality * 20 = 4 * 10 + 5 * 20 = 140
 *   <piece>_defence = round(id * dval), dval breastplate 16, helmet 10,
 *     shinguard 6, greaves 3, shoulderguard 8, gauntlet 5, boot 2, shield 12
 *   armourclass_max = the sum of the eight
 *
 * Slot 1 (breastplate 3, helmet 2, shield 2): 48+20+6+6+8+5+4+24 = 121.
 * Slot 2 (breastplate 2, helmet 1, shield 0): 32+10+6+6+8+5+4+0  = 71.
 * Slot 3 (breastplate 1, helmet 0, shield 0): 16+0+6+6+8+5+4+0   = 45.
 * The other five pieces are the template's: shinguard 1, greaves 2,
 * shoulderguard 1, gauntlet 1, boot 2.
 */
test("a DAMAGE-kit fighter carries battlevalues' own pools and a level-4 magicka, and nothing else moves", () => {
  const items = demoItemsFrom("blasts");
  const kit = demoSide("red", 3, { ...deps, items }).members;
  const plain = demoSide("red", 3, deps).members;
  const armour = [121, 71, 45];
  const breastplate = [48, 32, 16];
  const helmet = [20, 10, 0];
  const shield = [24, 0, 0];
  kit.forEach((member, index) => {
    const { vanilla } = member;
    assert.equal(vanilla.hitpointsmax, 140, `${member.id} hitpointsmax`);
    assert.equal(vanilla.hitpoints, 140, `${member.id} enters at full health`);
    assert.equal(vanilla.armourclass_max, armour[index], `${member.id} armourclass_max`);
    assert.equal(vanilla.armourclass, armour[index], `${member.id} enters fully armoured`);
    assert.deepEqual(
      [vanilla.breastplate_defence, vanilla.helmet_defence, vanilla.shield_defence],
      [breastplate[index], helmet[index], shield[index]],
      `${member.id} priced pieces`
    );
    assert.deepEqual(
      [vanilla.shinguard_defence, vanilla.greaves_defence, vanilla.shoulderguard_defence, vanilla.gauntlet_defence, vanilla.boot_defence],
      [6, 6, 8, 5, 4],
      `${member.id} the template's pieces`
    );
    assert.equal(vanilla.magicka, 12, `${member.id} magicka`);
    // The bag is cut from the same record, so the fight sees what the mirror says.
    assert.equal(member.resources.armourclass, armour[index]);
    assert.equal(member.resources.armourclass_max, armour[index]);

    // EVERYTHING ELSE is the plain roster's: damage, stamina, reach, speed.
    const moved = Object.keys({ ...vanilla, ...plain[index].vanilla })
      .filter((field) => vanilla[field] !== plain[index].vanilla[field])
      .sort();
    // (`blasts` fills two slots; the other four stay the empty marker.)
    assert.deepEqual(moved, [
      "armourclass", "armourclass_max", "boot_defence", "breastplate_defence", "gauntlet_defence",
      "greaves_defence", "helmet_defence", "hitpoints", "hitpointsmax",
      "inventory1", "inventory2",
      "magicka", "shield_defence", "shinguard_defence", "shoulderguard_defence"
    ], `${member.id}: only the kit, the pools and magicka differ from the plain roster`);
  });
  // And the host the arena builds enters them at those pools.
  const host = arenaHost({ items, perSide: 3 });
  for (const [index, id] of ["red-1", "red-2", "red-3"].entries()) {
    const fighter = host.combatant(id);
    assert.deepEqual([fighter.health, fighter.maxHealth], [140, 140], id);
    assert.equal(fighter.resources.armourclass.value, armour[index], id);
    assert.equal(fighter.stats.magicka, 12, id);
  }
});

/**
 * ► **THE POOLS ARE FOR DAMAGE KITS ONLY (main session, 2026-09-23).** Measured
 *   over 25 seeds, the bigger pool left `buffs`, `tricks` and `crowd` exactly as
 *   watchable as before and 2-5x longer (tricks 3v3: 202 -> 997 actions), so
 *   those keep the plain roster's stated 46 hitpoints and 38 armour. They still
 *   get the magicka, so their casts are paid for.
 *
 *   A damage kit is one that holds any damage spell, and the list is checked
 *   against the ENGINE'S damage spells rather than written as a range: 33,
 *   inside 30-35, is little fat kid, which `crowd` holds.
 */
test("a damage kit is one holding a damage spell, and that list is the engine's", () => {
  const engine = [
    ...Object.values(SS2_BOLT_SPELLS).map((spell) => spell.itemId),
    ...Object.values(SS2_FIREBALL_SPELLS).map((spell) => spell.itemId),
    SS2_DEATH_FROM_ABOVE.itemId
  ].sort((a, b) => a - b);
  assert.deepEqual([...DEMO_DAMAGE_SPELL_IDS].sort((a, b) => a - b), engine);
  assert.equal(DEMO_DAMAGE_SPELL_IDS.includes(33), false, "33 is little fat kid");
});

test("buffs, tricks and crowd fighters keep the plain roster's pools, and differ only by the kit and the magicka", () => {
  const plain = demoSide("red", 3, deps).members;
  for (const name of ["buffs", "tricks", "crowd"]) {
    const kit = demoSide("red", 3, { ...deps, items: demoItemsFrom(name) }).members;
    kit.forEach((member, index) => {
      assert.deepEqual(
        [member.vanilla.hitpoints, member.vanilla.hitpointsmax, member.vanilla.armourclass, member.vanilla.armourclass_max],
        [46, 46, 38, 38],
        `${name} ${member.id}: the roster's stated pools`
      );
      assert.equal(member.vanilla.magicka, 12, `${name} ${member.id} magicka`);
      const moved = Object.keys({ ...member.vanilla, ...plain[index].vanilla })
        .filter((field) => member.vanilla[field] !== plain[index].vanilla[field])
        .sort();
      assert.deepEqual(moved, [
        "inventory1", "inventory2", "inventory3", "inventory4", "inventory5", "inventory6", "magicka"
      ], `${name} ${member.id}`);
    });
  }
  // A mixed request holding one damage spell is a damage kit.
  assert.equal(demoSide("red", 1, { ...deps, items: [42, 34] }).members[0].vanilla.hitpointsmax, 140);
  assert.equal(demoSide("red", 1, { ...deps, items: [42, 33] }).members[0].vanilla.hitpointsmax, 46);
});

/**
 * `staminacost = round(magicka)` on every cast arm (map, the `staminacost`
 * table), then `nextphase`'s regeneration, `1 + round(stamina / 3)`:
 * 120 - 12 + 1 + round(5 / 3) = 111. On the plain roster's magicka 0 the same
 * cast GAINED stamina — a spell nobody could see cost anything.
 */
test("a kit fighter's cast costs round(magicka) = 12 stamina, so a cast is visibly paid for", () => {
  const host = arenaHost({ items: [44], perSide: 1 });
  const before = host.battle.teams[0].combatants[0].resources.staminaleft.value;
  assert.equal(before, 120);
  host.submit({ actorId: "red-1", type: Ss2ActionType.CAST_WEAKEN_ARMOUR, targetId: "blue-1" });
  assert.equal(host.battle.teams[0].combatants[0].resources.staminaleft.value, 111);
});

/**
 * ► **RED ALWAYS OPENED, SO A ONE-SHOT KIT WAS A RED WIN ON EVERY SEED.** The
 *   roster gives red the +1 speed and `ss2InitiativeOrder` lets the side with
 *   the fastest head open. In a kit bout the +1 goes to BLUE on an even seed,
 *   so the opener alternates; the plain roster, and a kit built with no seed,
 *   keep red's +1.
 */
test("a kit bout's opener alternates by seed parity; the plain roster's never does", () => {
  const speeds = (side, extra) => demoSide(side, 3, { ...deps, ...extra }).members.map((member) => member.vanilla.speed);
  const items = demoItemsFrom("buffs");
  assert.deepEqual(speeds("red", { items, seed: 7 }), [7, 6, 5]);
  assert.deepEqual(speeds("blue", { items, seed: 7 }), [6, 5, 4]);
  assert.deepEqual(speeds("red", { items, seed: 8 }), [6, 5, 4]);
  assert.deepEqual(speeds("blue", { items, seed: 8 }), [7, 6, 5]);
  assert.deepEqual(speeds("red", { items }), [7, 6, 5], "no seed, no flip");
  assert.deepEqual(speeds("blue", { seed: 8 }), [6, 5, 4], "no kit, no flip");

  assert.equal(arenaHost({ items, seed: 7 }).currentCombatantId(), "red-1");
  assert.equal(arenaHost({ items, seed: 8 }).currentCombatantId(), "blue-1");
  assert.equal(arenaHost({ items: [], seed: 8 }).currentCombatantId(), "red-1");
});

test("the shell hands the bout's seed to both demo sides, or the parity opener never happens", () => {
  // `main.js` cannot be imported by node, so its call sites are read as TEXT,
  // as `test/arena-champions.test.js` does.
  const shell = fs.readFileSync(fileURLToPath(new URL("../tools/arena/main.js", import.meta.url)), "utf8");
  for (const side of ["red", "blue"]) {
    assert.match(
      shell,
      new RegExp(`demoSide\\("${side}", perSide, \\{[^}]*\\bitems: request\\.items, seed \\}\\)`),
      `${side}'s demoSide call passes the seed`
    );
  }
});

/**
 * ► **DOOM ENDS THE BOUT, AND SAYS SO.** Measured on this roster: the opener
 *   casts death from above (400-800) on its first turn and it kills a
 *   140-hitpoint, 121-armour gladiator from full; each of its side does the
 *   same, so the side that opens wins without the other acting. That is the
 *   build's ladder, not a defect — which is why 49 is a kit of its own.
 */
test("doom ends the bout: every cast is a kill from full, and the opener's side wins untouched", () => {
  for (const [seed, winner] of [[7, "red"], [8, "blue"]]) {
    const host = arenaHost({ items: demoItemsFrom("doom"), seed });
    const taken = [];
    while (!host.battle.result && taken.length < 10) {
      const actorId = host.currentCombatantId();
      const action = host.suggestAction(actorId);
      taken.push(`${actorId} ${action.type}`);
      const step = host.submit({ ...action, actorId });
      for (const token of step.actionTokens) host.reportActionAnimation(token);
    }
    assert.deepEqual(taken, [`${winner}-1 cast-death-from-above`, `${winner}-2 cast-death-from-above`], `seed ${seed}`);
    assert.equal(host.battle.result?.winnerTeamId, winner, `seed ${seed}`);
  }
});

test("a kit fills the six slots in order, for every member", () => {
  const items = demoItemsFrom("tricks");
  assert.deepEqual(items, [...DEMO_ITEM_KITS.tricks]);
  for (const member of build(items).members) assert.deepEqual(slots(member), items);
});

test("kits and ids mix, and only the first six are kept", () => {
  assert.deepEqual(demoItemsFrom("42,blasts"), [42, 34, 30]);
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
 *
 * ► **RE-PINNED 2026-09-23 FOR THE ROSTER, NOT THE ENGINE** (`demoSide`):
 *   every kit fighter casts at magicka 12, a DAMAGE kit's fighters also take
 *   `battlevalues`' pools, and `blasts` is now 34 and 30. Seed 7 is odd, so the
 *   seed-parity opener moves none of these. Attributed by applying the magicka
 *   alone to the previous roster, this same loop. One line per pin:
 *   - buffs: UNMOVED — magicka 12 changes nothing here.
 *   - blasts: MOVED — the kit is new (was 2 actions, elimination, death from
 *     above x2, with 49 in it).
 *   - tricks: ~~MOVED by magicka alone — 22 casts either way, diverging at the
 *     14th (was … teleport, whirlwind, wincrowd, gale, wincrowd, command,
 *     wincrowd x3).~~ **UNMOVED once the owner's own-rank taunt rule is in
 *     (main session, at merge): the 22-cast move was measured without it; with
 *     it, magicka 12 leaves the taunt rule's 48-action pin exactly as it is.**
 *   - crowd: MOVED by magicka alone — two more potions at the end (was 12
 *     casts, ending … rejuvenate, little fat kid, potion).
 *   - doom: NEW — the old `blasts` pin exactly, now that 49 stands alone.
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
  // Each fighter opens with its lightning bolt (priced at its mean, 150, above
  // the fireball's 120), and neither 2v2 pool (261, 211) can die of 100-200.
  blasts: {
    actions: 37,
    result: "elimination",
    casts: [
      "cast-lightning-bolt", "cast-lightning-bolt", "cast-lightning-bolt", "cast-lightning-bolt",
      "cast-fireball", "cast-fireball"
    ]
  },
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
  //   **Unmoved by the roster's magicka 12 once the taunt rule is in**
  //   (main session, measured at merge on 2690559 + taunt + kits): the kits
  //   patch's own re-pin (22 casts, diverging at the 14th) was measured
  //   without the taunt rule, and the combination is exactly this list.
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
      "drink-potion", "drink-potion", "cast-rejuvinate", "cast-little-fat-kid", "drink-potion", "drink-potion",
      "drink-potion"
    ]
  },
  doom: { actions: 2, result: "elimination", casts: ["cast-death-from-above", "cast-death-from-above"] }
});

const isCast = (type) => type.startsWith("cast-") || type.startsWith("drink-") || type === "wincrowd";

for (const kit of Object.keys(DEMO_ITEM_KITS)) {
  test(`the ${kit} kit builds through createVanillaBattleHost and its AI plays 60 actions, or to a result, without error`, () => {
    const items = demoItemsFrom(kit);
    const host = createVanillaBattleHost({
      teams: [
        demoSide("red", 2, { ss2Combatant, ss2BattleValues, items, seed: 7 }),
        demoSide("blue", 2, { ss2Combatant, ss2BattleValues, items, seed: 7 })
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
