/**
 * THE BUILD'S CROWD ECONOMY — one `crowd_interest` per bout, modelled.
 *
 * Re-derived 2026-09-22 from the oracle's byte dumps (`all-actions.txt`,
 * `DoAction@0x240c7f`, base `0x240c85`, unless another block is named):
 *
 * ```text
 *   sprite:751[combat_panel] crowd_bar clip-action:0            +0x011f-+0x0158
 *     _global.crowd_interest = _root.game.hero.herolevel + _root.game.villain.herolevel
 *   nextphase (+0x3193; r3 = _global)                            +0x3541-+0x35b4
 *     crowd_interest = crowd_interest + crowd_action
 *     if (crowd_interest < 1) crowd_interest = 1
 *     else if (crowd_interest > 100) crowd_interest = 100
 *     crowd_action = 0
 *   death() deletes nextphase                                    +0x1e99-+0x204f
 *   sprite:2249/frame:88 (the victory frame)                     +0x078c-+0x07ff
 *     hero.goldpieces += round(villain.character_xp * (100 + crowd_interest) / 100)
 *     if (hero.herolevel == 1) hero.goldpieces = 2500           +0x0867-+0x08b8
 * ```
 *
 * `crowd_action` is written by the phase ARMS of `attacker.onEnterFrame`
 * (`+0x36ae`; r3 = `_global`) and by four helpers; the arm's own write re-runs
 * every tick and lands last, so an arm with a top write adds its constant and
 * only `normal_attack`, `bash_attack` and the level-3 `psyche_up` press add
 * what the damage path left. See `src/team/ss2-crowd.js` for the table.
 *
 * OWNER'S DECISIONS (2026-09-22): ONE crowd per battle across every side,
 * opening at the SUM of every combatant's `herolevel` (the build's, exactly,
 * in 1v1); every completed phase of anyone adds its delta, clamped 1..100; and
 * it scales the purse of every member of the winning side.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, lastResolvedAction, legalActions, toTeamWireState
} from "../src/team/index.js";
import {
  SS2_ADULATION, SS2_BOLT_INGRESS, SS2_COMMAND, SS2_DEATH_FROM_ABOVE, SS2_FACING_LEFT, SS2_FIREBALL_INGRESS,
  SS2_GHOST_STRIKE, SS2_REJUVENATE, SS2_STAT_SPELLS, SS2_TELEPORT, SS2_TIMED_BUFFS, SS2_WEAKEN_ARMOUR, SS2_WHIRLWIND,
  Ss2ActionType, VANILLA_PHASE_LABEL, ss2BattleValues, ss2Combatant, ss2TeamRules
} from "../src/team/ss2-rules.js";
import {
  createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS, vanillaWritesForResolvedAction, WriteSource, WriteTarget
} from "../src/adapter/index.js";
import { demoSide } from "../tools/arena/roster.js";
import { restAnywhere } from "./ss2-rest-anywhere.js";
import {
  SS2_CROWD_ACTION, SS2_CROWD_INTEREST, SS2_EMPERORS_GIFT, ss2CrowdInterestOf, ss2CrowdStep, ss2TeamVictoryPurses,
  ss2VictoryPurse
} from "../src/team/ss2-crowd.js";

/** A healthy level-5 gladiator: 170 hitpoints, nobody dies to one blow. */
const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

/** Make `id` face left (true) or right (false). */
function face(battle, id, left) {
  const combatant = combatantById(battle, id);
  combatant.status = combatant.status.filter((token) => token !== SS2_FACING_LEFT);
  if (left) combatant.status.push(SS2_FACING_LEFT);
}

/** A 1v1, hero at 0 facing right, foe `gap` to its right facing left, the hero to act. */
function duel({ hero = {}, foe = {}, gap = 100, seed = 3, rules = ss2TeamRules } = {}) {
  const battle = createTeamBattle({
    seed,
    rules,
    teams: [
      { id: "red", combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller: "local" })] },
      { id: "blue", combatants: [ss2Combatant(fields(foe), { id: "foe", name: "foe", controller: "local" })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: 0, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: gap, y: 200 });
  face(battle, "hero", false);
  face(battle, "foe", true);
  assert.equal(currentCombatant(battle).id, "hero", "the hero must open for these tests to mean anything");
  return battle;
}

const crowd = (battle) => ss2CrowdInterestOf(toTeamWireState(battle));
const act = (battle, type, targetId = "foe", actorId = "hero", extra = {}) =>
  applyAction(battle, { actorId, type, targetId, ...extra });

/**
 * The hero's one action and what it did to the crowd. `build(seed)` stages the
 * bout; the foe carries vitality 30 (650 hitpoints) unless the staging says
 * otherwise, so nothing here kills by accident.
 */
function resolveOnce(build, seed, type, targetId = "foe", extra = {}) {
  const battle = build(seed);
  const before = crowd(battle);
  act(battle, type, targetId, "hero", extra);
  const resolution = lastResolvedAction(battle);
  return {
    battle,
    before,
    delta: crowd(battle) - before,
    event: resolution.events.find((entry) => entry.type === type),
    killed: resolution.knockouts.length > 0
  };
}

/** The first seed in 1..limit whose resolution satisfies `predicate`, resolved. */
function resolveWhere(build, type, predicate, { targetId = "foe", limit = 600 } = {}) {
  for (let seed = 1; seed <= limit; seed += 1) {
    const outcome = resolveOnce(build, seed, type, targetId);
    if (predicate(outcome.event, outcome)) return outcome;
  }
  throw new Error(`no seed in 1..${limit} produced the ${type} outcome under test`);
}

const hit = (event) => event.hit === true;
const knockedBack = (event) => Number.isFinite(event.knockback?.force);
const tough = { vitality: 30 };

/* ------------------------------------------------------------------ *
 * The opening                                                         *
 * ------------------------------------------------------------------ */

test("the crowd opens at the SUM of both fighters' herolevel, on the battle, not on either fighter", () => {
  const battle = duel({ hero: { herolevel: 5 }, foe: { herolevel: 7 } });
  // crowd_bar clip-action:0 +0x011f-+0x0158: hero.herolevel + villain.herolevel, Add2.
  assert.equal(crowd(battle), 12);
  assert.deepEqual(toTeamWireState(battle).battleResources, {
    [SS2_CROWD_INTEREST.resource]: { value: 12, min: null, max: null }
  });
  for (const id of ["hero", "foe"]) {
    assert.equal(Object.hasOwn(combatantById(battle, id).resources, "crowd_interest"), false, `${id} holds no copy`);
  }
});

test("above 1v1 it opens at the sum of EVERY combatant's level — one crowd, both sides", () => {
  const levels = { red: [5, 9, 3], blue: [4, 12, 1] };
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: Object.entries(levels).map(([id, list]) => ({
      id,
      combatants: list.map((herolevel, i) =>
        ss2Combatant(fields({ herolevel }), { id: `${id}-${i + 1}`, name: `${id}-${i + 1}`, controller: "local" }))
    }))
  });
  assert.equal(crowd(battle), 34);
});

test("the opening is UNCLAMPED until the first completed phase, as the build leaves it", () => {
  // Six level-30s: 180, which no nextphase has clamped yet.
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: ["red", "blue"].map((id) => ({
      id,
      combatants: [1, 2, 3].map((i) =>
        ss2Combatant(fields({ herolevel: 30 }), { id: `${id}-${i}`, name: `${id}-${i}`, controller: "local" }))
    }))
  });
  assert.equal(crowd(battle), 180);
  const actorId = currentCombatant(battle).id;
  act(battle, Ss2ActionType.REST, actorId, actorId);
  // rest's arm writes -2 (+0x5150): 180 - 2 = 178, then `> 100` sets 100 (+0x3580-+0x35a3).
  assert.equal(crowd(battle), 100);
});

test("a battle where somebody has no herolevel has no crowd, rather than an invented one", () => {
  const bare = (id) => ({
    id, name: id, controller: "local",
    stats: { strength: 9, agility: 20, attack: 8, defense: 5, vitality: 6, stamina: 6, magicka: 7 },
    maxHealth: 170,
    resources: { staminaleft: 100, staminamax: 100, min_damage: 20, max_damage: 26 }
  });
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [{ id: "red", combatants: [bare("hero")] }, { id: "blue", combatants: [bare("foe")] }]
  });
  assert.equal(Object.hasOwn(toTeamWireState(battle), "battleResources"), false);
  assert.equal(crowd(battle), null);
  const opener = currentCombatant(battle).id;
  act(battle, Ss2ActionType.REST, opener, opener);
  assert.equal(lastResolvedAction(battle).effects.some((effect) => effect.kind === "battle-resource"), false,
    "and no phase writes one");
});

/* ------------------------------------------------------------------ *
 * nextphase step 10: add, clamp, and a kill adds nothing              *
 * ------------------------------------------------------------------ */

test("a completed phase adds its delta and nextphase clamps to 1..100, floor first", () => {
  // Two level-1s open at 2. Rest adds -2 (+0x5150): 0, and `< 1` sets 1 (+0x356e).
  // 500 apart: in reach no voluntary rest is offered since 2026-09-24.
  const low = duel({ hero: { herolevel: 1 }, foe: { herolevel: 1, ...tough }, gap: 500 });
  assert.equal(crowd(low), 2);
  act(low, Ss2ActionType.REST, "hero");
  assert.equal(crowd(low), 1);
  // 50 + 49 = 99; a power attack adds 2 whatever it rolls (+0x6029): 101, and `> 100` sets 100 (+0x3597).
  const high = duel({ hero: { herolevel: 50 }, foe: { herolevel: 49, ...tough } });
  assert.equal(crowd(high), 99);
  act(high, Ss2ActionType.POWER_ATTACK);
  assert.equal(crowd(high), 100);
});

test("the step is ONE battle-resource effect, after the buffs and before the psyche reset, as nextphase orders it", () => {
  // 500 apart: in reach no voluntary rest is offered since 2026-09-24.
  const battle = duel({ hero: { psyche_up: 2, herolevel: 9 }, foe: tough, gap: 500 });
  act(battle, Ss2ActionType.REST, "hero");
  const effects = lastResolvedAction(battle).effects;
  const crowdAt = effects.findIndex((effect) => effect.kind === "battle-resource");
  const psycheAt = effects.findIndex((effect) => effect.resource === "psyche_up");
  assert.deepEqual(effects[crowdAt], { kind: "battle-resource", resource: "crowd_interest", to: 12 });
  assert.equal(effects.filter((effect) => effect.kind === "battle-resource").length, 1);
  assert.ok(psycheAt > crowdAt, "+0x3541 (the crowd) runs before +0x35c7 (the psyche reset)");
});

test("the phase that KILLS adds nothing: death() deletes nextphase before it can read crowd_action", () => {
  const build = (seed) => {
    const battle = duel({ seed, foe: { herolevel: 5 } });
    combatantById(battle, "foe").health = 1;
    return battle;
  };
  const kill = resolveWhere(build, Ss2ActionType.POWER_ATTACK, (event, outcome) => outcome.killed);
  assert.equal(kill.before, 10);
  assert.equal(kill.delta, 0, "a power attack adds 2, but not the one that kills");
  assert.equal(lastResolvedAction(kill.battle).effects.some((effect) => effect.kind === "battle-resource"), false);
  // And the same staging, missing, does add: the kill is the reason, not the staging.
  const miss = resolveWhere(build, Ss2ActionType.POWER_ATTACK, (event) => !hit(event));
  assert.equal(miss.delta, 2);
});

test("above 1v1 every completed phase of ANYONE feeds the one crowd", () => {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: ["red", "blue"].map((id) => ({
      id,
      combatants: [1, 2].map((i) =>
        ss2Combatant(fields({ herolevel: 10, ...tough }), { id: `${id}-${i}`, name: `${id}-${i}`, controller: "local" }))
    }))
  });
  assert.equal(crowd(battle), 40);
  const seen = [crowd(battle)];
  for (let turn = 0; turn < 4; turn += 1) {
    const actorId = currentCombatant(battle).id;
    act(battle, Ss2ActionType.REST, actorId, actorId);
    seen.push(crowd(battle));
  }
  assert.deepEqual(seen, [40, 38, 36, 34, 32], "four fighters, four rests, one crowd booing each");
});

/* ------------------------------------------------------------------ *
 * Every verb's effective delta                                         *
 * ------------------------------------------------------------------ */

/** The hero's offered option of `type` (and `itemId`), so each action is one the rule set really offers. */
function offerOf(battle, type, itemId = null) {
  const option = legalActions(battle, "hero").find((entry) =>
    entry.type === type && (itemId === null || entry.itemId === itemId));
  assert.ok(option, `${type} must be offered to the hero in this staging`);
  return option;
}

/** One offered action by the hero; the crowd's move. */
function deltaFor(battle, type, itemId = null) {
  const option = offerOf(battle, type, itemId);
  const before = crowd(battle);
  act(battle, type, option.targetId, "hero", option.itemId === undefined ? {} : { itemId: option.itemId });
  assert.equal(lastResolvedAction(battle).knockouts.length, 0, `${type} must not kill in this staging`);
  return crowd(battle) - before;
}

test("an arm with a top write adds its constant, whatever the blow did: quick -1, power 2, shove 2", () => {
  const build = (seed) => duel({ seed, foe: tough });
  for (const [type, expected] of [[Ss2ActionType.QUICK_ATTACK, -1], [Ss2ActionType.POWER_ATTACK, 2]]) {
    assert.equal(resolveWhere(build, type, hit).delta, expected, `${type} that hits`);
    assert.equal(resolveWhere(build, type, (event) => !hit(event)).delta, expected, `${type} that misses`);
  }
  assert.equal(deltaFor(duel({ foe: tough }), Ss2ActionType.SHOVE), 2, "+0x5dc0, after knockback's 1");
});

test("normal_attack has no top write, so the damage path decides: -2 missed, 2 hit, 8 critical, 1 knocked back", () => {
  const build = (seed) => duel({ seed, foe: tough });
  const type = Ss2ActionType.NORMAL_ATTACK;
  // defender_blocked +0x2153.
  assert.equal(resolveWhere(build, type, (event) => !hit(event)).delta, -2);
  // damagecharacter +0x17c0, no knockback (randosmash <= 3).
  assert.equal(resolveWhere(build, type, (event) =>
    hit(event) && event.dispatchedMethod === "normal" && !knockedBack(event)).delta, 2);
  // damagecharacter +0x162e.
  assert.equal(resolveWhere(build, type, (event) =>
    hit(event) && event.dispatchedMethod === "critical" && !knockedBack(event), { limit: 3000 }).delta, 8);
  // knockback +0x1dfe lands last, over the 2 or the 8.
  assert.equal(resolveWhere(build, type, (event) => hit(event) && knockedBack(event)).delta, 1);
});

test("bash_attack has no top write either, and is never knocked back: -2, 2, or 8 on an inherited critical", () => {
  const archer = (seed, criticalhit) => {
    const battle = duel({ seed, gap: 100, hero: { secondary_weapon: 61, equipped_weapon: 2, criticalhit }, foe: tough });
    return battle;
  };
  const type = Ss2ActionType.BASH_ATTACK;
  assert.equal(resolveWhere((seed) => archer(seed, 0), type, (event) => !hit(event)).delta, -2);
  assert.equal(resolveWhere((seed) => archer(seed, 0), type, hit).delta, 2);
  const critical = resolveWhere((seed) => archer(seed, 20), type, (event) => hit(event) && event.dispatchedMethod === "critical");
  assert.equal(critical.delta, 8, "direction 23 assigns no criticalhit and reads the actor's last one");
});

test("psyche_up: a charging press adds 0; the level-3 press adds 3 out of range, 1 on a hit, -2 blocked", () => {
  // 60 + 50 opens at 110: a 0-delta phase still clamps it to 100, which shows the step ran.
  const charging = duel({ hero: { herolevel: 60, psyche_up: 1 }, foe: { herolevel: 50, ...tough } });
  assert.equal(crowd(charging), 110);
  act(charging, Ss2ActionType.PSYCHE_UP);
  assert.equal(crowd(charging), 100);

  const charged = (seed, gap = 100) => duel({ seed, gap, hero: { herolevel: 9, psyche_up: 3 }, foe: tough });
  const out = resolveOnce((seed) => charged(seed, 400), 1, Ss2ActionType.PSYCHE_UP);
  assert.equal(out.event.outOfRange, true);
  assert.equal(out.delta, 3, "+0x6604, with no checkattackroll after it");
  // Direction 30 is grievous, and its knockback always fires: 20, then 2, then 1.
  assert.equal(resolveWhere(charged, Ss2ActionType.PSYCHE_UP, hit).delta, 1);
  assert.equal(resolveWhere(charged, Ss2ActionType.PSYCHE_UP, (event) => event.outOfRange !== true && !hit(event)).delta, -2);
});

test("a taunt adds -2 whatever it rolled — failed, shove, flee or strike", () => {
  const build = (seed) => duel({ seed, gap: 400, foe: tough });
  const type = Ss2ActionType.TAUNT;
  assert.equal(resolveWhere(build, type, (event) => event.landed === false).delta, -2, "defender_blocked, then -2");
  assert.equal(resolveWhere(build, type, (event) => event.landed && event.effect === 2).delta, -2, "knockback's 1, then -2");
  assert.equal(resolveWhere(build, type, (event) => event.landed && event.effect === 1).delta, -2, "the strike's 2, then -2");
});

test("every item verb adds its arm's constant", () => {
  // Vitality 100 (2,050 hitpoints): a molten-death shower of 40 a boulder cannot finish it.
  const holding = (itemId, extra = {}) => duel({ hero: { inventory1: itemId, ...extra }, foe: { vitality: 100 } });
  const table = [
    [Ss2ActionType.CAST_GALE, 38, 2, "+0x7abd"],
    [Ss2ActionType.CAST_COMMAND, 39, 2, "+0x7bf9"],
    [Ss2ActionType.CAST_TELEPORT, 48, 3, "+0x7554"],
    [Ss2ActionType.CAST_WEAKEN_ARMOUR, 44, 4, "+0x778f"],
    [Ss2ActionType.CAST_WHIRLWIND, 37, 3, "+0x78ed"],
    [Ss2ActionType.CAST_GHOST_STRIKE, 36, 5, "+0x7dca"],
    [Ss2ActionType.CAST_COLOSSUS, 42, 15, "+0x7ffe"],
    [Ss2ActionType.CAST_LITTLE_FAT_KID, 33, 10, "+0x821c"],
    [Ss2ActionType.CAST_LIGHTNING_BOLT, 34, 5, "+0x841c"],
    [Ss2ActionType.CAST_FRIGHTNING_BOLT, 35, 5, "+0x841c"],
    [Ss2ActionType.CAST_DEATH_FROM_ABOVE, 49, 20, "+0x8642"],
    [Ss2ActionType.CAST_SWIFTSANDALS, 40, 3, "+0x8981"],
    [Ss2ActionType.CAST_BLOODLUST, 41, 3, "+0x8a84"],
    [Ss2ActionType.CAST_REGENERATE, 46, 3, "+0x8bcf"],
    [Ss2ActionType.CAST_BOUNDLESS_ENERGY, 45, 3, "+0x8cae"],
    [Ss2ActionType.CAST_REJUVINATE, 43, 3, "+0x8d7c"],
    [Ss2ActionType.CAST_FIREBALL, 30, 5, "+0x8f94"],
    [Ss2ActionType.CAST_HELL_FIREBALL, 31, 5, "+0x8f94"],
    [Ss2ActionType.CAST_DIRE_FIREBALL, 32, 5, "+0x8f94"]
  ];
  for (const [type, itemId, expected, offset] of table) {
    assert.equal(deltaFor(holding(itemId), type), expected, `${type} (item ${itemId}) adds ${expected}, ${offset}`);
  }
  // A drink costs 3 (+0x577f), one label for eight items.
  for (const itemId of [2, 6, 8]) {
    assert.equal(deltaFor(holding(itemId), Ss2ActionType.DRINK_POTION, itemId), -3, `potion ${itemId}`);
  }
  // The whirlwind out of range is a wasted cast, and the crowd still takes the arm's 3.
  const far = duel({ gap: 600, hero: { inventory1: 37 }, foe: tough });
  assert.equal(deltaFor(far, Ss2ActionType.CAST_WHIRLWIND), 3);
});

test("the archer's two shots add -1, hit or miss (+0x6ba2)", () => {
  // A snipe at this staging hits 99 times in 100, so the misses are staged on a foe
  // whose defence makes them common.
  const build = (foe) => (seed) =>
    duel({ seed, gap: 500, hero: { secondary_weapon: 61, equipped_weapon: 2 }, foe: { ...tough, ...foe } });
  for (const type of [Ss2ActionType.BOMBARD, Ss2ActionType.SNIPE]) {
    assert.equal(resolveWhere(build({}), type, hit).delta, -1, `${type} that hits`);
    assert.equal(resolveWhere(build({ defence: 90 }), type, (event) => !hit(event)).delta, -1, `${type} that misses`);
  }
});

test("the arms that write nothing add 0 — and still run the clamp, which is how a 0 is told from no step at all", () => {
  // Every staging opens at 60 + 50 = 110, so a completed phase that adds 0 lands on 100.
  const high = (hero = {}, extra = {}) => duel({ hero: { herolevel: 60, ...hero }, foe: { herolevel: 50, ...tough }, ...extra });
  const zero = (battle, type) => {
    assert.equal(crowd(battle), 110);
    const option = offerOf(battle, type);
    act(battle, type, option.targetId);
    assert.equal(crowd(battle), 100, `${type}: 110 + 0, clamped`);
  };
  zero(high({}, { gap: 400 }), Ss2ActionType.WALK_RIGHT);
  zero(high({}, { gap: 400 }), Ss2ActionType.WALK_LEFT);
  zero(high({ secondary_weapon: 61 }, { gap: 400 }), Ss2ActionType.SWAP_WEAPONS);
  // The taunted flee is `runleft`/`runright`, which write none.
  zero(high({ taunted1: true }), Ss2ActionType.TAUNTED_PHASE);
  // The status arms write 0 on every tick, over the tick's own 2 (+0x13cb).
  zero(high({ frozen: true }), Ss2ActionType.FROZEN_PHASE);
  zero(high({ burning: true }), Ss2ActionType.BURNING_PHASE);
});

test("the census: every arm's top write in the table, with the build's offsets — and the step is nextphase's", () => {
  // Re-read off the dump arm by arm; 34 arm writes + 10 helper/nextphase/intro hits = the 44 grep hits.
  const expected = {
    chargeright: [2, "+0x4201"], chargeleft: [2, "+0x446d"], jumpright: [-2, "+0x46d9"], jumpleft: [-2, "+0x49b1"],
    rest: [-2, "+0x5150"], frozen: [0, "+0x52af"], life_stolen: [0, "+0x53e3"], poisoned: [0, "+0x5517"],
    burning: [0, "+0x564b"], drink_potion: [-3, "+0x577f"], shove: [2, "+0x5dc0"], power_attack: [2, "+0x6029"],
    quick_attack: [-1, "+0x6304"], taunt: [-2, "+0x67a8"], bombard: [-1, "+0x6ba2"], snipe: [-1, "+0x6ba2"],
    cast_teleport: [3, "+0x7554"], cast_adulation: [50, "+0x76c1"], cast_weaken_armour: [4, "+0x778f"],
    cast_whirlwind: [3, "+0x78ed"], cast_gale: [2, "+0x7abd"], cast_command: [2, "+0x7bf9"],
    cast_ghost_strike: [5, "+0x7dca"], cast_colossus: [15, "+0x7ffe"], cast_little_fat_kid: [10, "+0x821c"],
    cast_lightning_bolt: [5, "+0x841c"], cast_frightning_bolt: [5, "+0x841c"], cast_death_from_above: [20, "+0x8642"],
    cast_swiftsandals: [3, "+0x8981"], cast_bloodlust: [3, "+0x8a84"], cast_regenerate: [3, "+0x8bcf"],
    cast_boundless_energy: [3, "+0x8cae"], cast_rejuvinate: [3, "+0x8d7c"], cast_fireball: [5, "+0x8f94"],
    cast_hell_fireball: [5, "+0x8f94"], cast_dire_fireball: [5, "+0x8f94"]
  };
  assert.deepEqual(
    Object.fromEntries(Object.entries(SS2_CROWD_ACTION).map(([label, row]) => [label, [row.value, row.offset]])),
    expected
  );
  for (const label of ["walkleft", "walkright", "runleft", "runright", "block", "swap_weapons", "normal_attack",
    "bash_attack", "psyche_up", "wincrowd"]) {
    assert.equal(Object.hasOwn(SS2_CROWD_ACTION, label), false, `${label} has no CONSTANT top write`);
  }
  // Each verb's own descriptor carries the literal its deriver transcribed, and the
  // branch hands THAT to nextphase: the two transcriptions must agree.
  const descriptors = {
    cast_whirlwind: SS2_WHIRLWIND, cast_ghost_strike: SS2_GHOST_STRIKE, cast_lightning_bolt: SS2_BOLT_INGRESS,
    cast_fireball: SS2_FIREBALL_INGRESS, cast_death_from_above: SS2_DEATH_FROM_ABOVE, cast_command: SS2_COMMAND,
    cast_teleport: SS2_TELEPORT, cast_adulation: SS2_ADULATION, cast_weaken_armour: SS2_WEAKEN_ARMOUR,
    cast_rejuvinate: SS2_REJUVENATE,
    ...Object.fromEntries(Object.entries({ ...SS2_TIMED_BUFFS, ...SS2_STAT_SPELLS })
      .map(([type, spell]) => [VANILLA_PHASE_LABEL[type], spell]))
  };
  for (const [label, descriptor] of Object.entries(descriptors)) {
    assert.equal(descriptor.crowdAction, SS2_CROWD_ACTION[label].value, `${label}: descriptor vs census`);
  }
  // `< 1` is tested first and short-circuits the `> 100` test (+0x357b jumps to +0x35a4).
  assert.equal(ss2CrowdStep(0, -5), 1);
  assert.equal(ss2CrowdStep(99, 50), 100);
  assert.equal(ss2CrowdStep(180, -2), 100);
  assert.equal(ss2CrowdStep(40, 7), 47);
});

/* ------------------------------------------------------------------ *
 * The purse                                                           *
 * ------------------------------------------------------------------ */

test("the 1v1 purse is frame 88's: gold += round(xp * (100 + crowd) / 100)", () => {
  // 150 * 137 / 100 = 205.5, and Math.round sends the half UP (the build's and JavaScript's alike).
  assert.deepEqual(ss2VictoryPurse({ crowdInterest: 37, loserXp: 150, winnerLevel: 5, winnerGold: 1000 }),
    { goldWon: 206, goldpieces: 1206, emperorsGift: false });
  // The two ends of a clamped crowd: 1.01x and 2.00x.
  assert.equal(ss2VictoryPurse({ crowdInterest: 1, loserXp: 100, winnerLevel: 5, winnerGold: 0 }).goldWon, 101);
  assert.equal(ss2VictoryPurse({ crowdInterest: 100, loserXp: 100, winnerLevel: 5, winnerGold: 0 }).goldWon, 200);
  // A bout decided before any phase completed pays on the UNCLAMPED opening.
  assert.equal(ss2VictoryPurse({ crowdInterest: 180, loserXp: 100, winnerLevel: 5, winnerGold: 0 }).goldWon, 280);
});

test("the emperor's gift: a level-1 winner's gold is SET to 2500, discarding the balance and the reward", () => {
  assert.deepEqual(SS2_EMPERORS_GIFT, { herolevel: 1, goldpieces: 2500 });
  assert.deepEqual(ss2VictoryPurse({ crowdInterest: 37, loserXp: 150, winnerLevel: 1, winnerGold: 9000 }),
    { goldWon: 206, goldpieces: 2500, emperorsGift: true },
    "+0x0867-+0x08b8 runs after +0x07ff, and assigns");
  assert.equal(ss2VictoryPurse({ crowdInterest: 37, loserXp: 150, winnerLevel: 2, winnerGold: 9000 }).goldpieces, 9206);
});

test("the team purse (AUTHORED base): each winner is paid on an equal share of the defeated side's xp", () => {
  const purses = ss2TeamVictoryPurses({
    crowdInterest: 50,
    winners: [
      { id: "a", herolevel: 5, goldpieces: 100 },
      { id: "b", herolevel: 1, goldpieces: 50 },
      { id: "c", herolevel: 7, goldpieces: 0 }
    ],
    losers: [{ id: "x", character_xp: 90 }, { id: "y", character_xp: 60 }, { id: "z", character_xp: 150 }]
  });
  // 300 xp over 3 winners: a basis of 100 each, round(100 * 150 / 100) = 150.
  assert.equal(purses.basis, 100);
  assert.deepEqual(purses.payouts, [
    { id: "a", goldWon: 150, goldpieces: 250, emperorsGift: false },
    { id: "b", goldWon: 150, goldpieces: 2500, emperorsGift: true },
    { id: "c", goldWon: 150, goldpieces: 150, emperorsGift: false }
  ]);
  // 1v1 through the team function IS the build's purse.
  const duelPurse = ss2TeamVictoryPurses({
    crowdInterest: 37, winners: [{ id: "hero", herolevel: 5, goldpieces: 1000 }], losers: [{ id: "villain", character_xp: 150 }]
  });
  assert.deepEqual(duelPurse.payouts[0],
    { id: "hero", ...ss2VictoryPurse({ crowdInterest: 37, loserXp: 150, winnerLevel: 5, winnerGold: 1000 }) });
  assert.throws(() => ss2TeamVictoryPurses({ crowdInterest: 37, winners: [], losers: [{ id: "x", character_xp: 1 }] }),
    /draw pays nobody/);
});

test("a settled SS2 bout carries the crowd its purse is paid on", () => {
  const battle = duel({ hero: { herolevel: 6 }, foe: { herolevel: 4 } });
  assert.equal(crowd(battle), 10);
  // In reach, so every rest here is the FORCED one (2026-09-24; see
  // `./ss2-rest-anywhere.js`) — the same -2 to the crowd, which is all this reads.
  restAnywhere(battle, "hero"); // -2
  restAnywhere(battle, "foe"); // -2
  combatantById(battle, "foe").health = 1;
  for (let seed = 0; !battle.result && seed < 50; seed += 1) {
    const actorId = currentCombatant(battle).id;
    if (actorId === "hero") act(battle, Ss2ActionType.POWER_ATTACK);
    else restAnywhere(battle, "foe");
  }
  assert.equal(battle.result?.winnerTeamId, "red");
  const wire = toTeamWireState(battle);
  const interest = ss2CrowdInterestOf(wire);
  // 10, two rests (-2 each), then +2 for each missed power attack, and nothing for the kill.
  const powerPhases = battle.events.filter((event) => event.type === Ss2ActionType.POWER_ATTACK).length;
  const foeRests = battle.events.filter((event) => event.type === Ss2ActionType.REST && event.actorId === "foe").length;
  assert.equal(interest, 10 - 2 - 2 * foeRests + 2 * (powerPhases - 1));
  assert.equal(ss2VictoryPurse({ crowdInterest: interest, loserXp: 100, winnerLevel: 6, winnerGold: 0 }).goldWon,
    Math.round(100 * (100 + interest) / 100));
});

/* ------------------------------------------------------------------ *
 * The adapter: WRITTEN to `_global` (owner, 2026-09-22)                *
 * ------------------------------------------------------------------ *
 *
 * ~~Reported, never written~~ — **the owner decided to WRITE the crowd back**,
 * keeping the provenance mechanism. The build keeps one `crowd_interest` on
 * `_global` (`crowd_bar` `+0x011f`-`+0x0158` opens it, `nextphase`
 * `+0x3541`-`+0x35b4` moves it), so the write names the
 * `declared-battle-resource` source, aims at the `global` target and must be
 * `===` the wire's `battleResources.crowd_interest.value`. Until 2026-09-23
 * these tests asserted a REPORT in `unmapped` and no write.
 */

const crowdReports = (unmapped) => unmapped.filter((entry) => Object.hasOwn(entry, "battleResource"));
const crowdWrites = (writes) => writes.filter((write) => write.source === WriteSource.DECLARED_BATTLE_RESOURCE);

/** The arena's own 1v1 (`tools/arena/main.js`'s path). */
function demoHost({ seed = 3, blue = (member) => member } = {}) {
  const blueSide = demoSide("blue", 1, { ss2Combatant, ss2BattleValues });
  blueSide.members[0] = blue(blueSide.members[0]);
  return createVanillaBattleHost({
    teams: [demoSide("red", 1, { ss2Combatant, ss2BattleValues }), blueSide],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed,
    awaitAnimations: false
  });
}

test("a completed phase WRITES the crowd onto `_global.crowd_interest`, the battle's own pool, and reports nothing", () => {
  const host = demoHost();
  const levels = host.battle.teams.flatMap((team) => team.combatants)
    .map((combatant) => combatant.resources.herolevel.value);
  const opening = ss2CrowdInterestOf(toTeamWireState(host.battle));
  assert.equal(opening, levels[0] + levels[1], "the demo roster's two levels, summed");
  assert.deepEqual(host.vanillaGlobals(), { crowd_interest: opening },
    "brought into step at construction, where the build's `crowd_bar` opens it");
  assert.deepEqual(host.diagnostics.globalSyncs, [{ field: "crowd_interest", path: "_global", to: opening }],
    "and reported, so a surface knows to set it");

  const actorId = currentCombatant(host.battle).id;
  const step = host.submit({ actorId, type: Ss2ActionType.REST, targetId: actorId });
  const moved = ss2CrowdInterestOf(host.wire());
  assert.equal(moved, opening - 2, "a rest's `crowd_action` is -2 (`+0x5150`), and 8 - 2 is inside 1..100");
  assert.deepEqual(
    crowdWrites(step.writes).map(({ target, path, combatantId, side, slotIndex, field, from, to }) =>
      ({ target, path, combatantId, side, slotIndex, field, from, to })),
    [{
      target: WriteTarget.GLOBAL,
      path: "_global",
      combatantId: null,
      side: null,
      slotIndex: null,
      field: "crowd_interest",
      from: opening,
      to: moved
    }]
  );
  assert.deepEqual(crowdReports(step.unmapped), [], "written, so no longer reported");
  assert.deepEqual(host.vanillaGlobals(), { crowd_interest: moved });
});

test("a KILLING phase writes no crowd — `death()` deletes `nextphase` — while the same verb's miss did", () => {
  // Seed 5, blue-1 staged at 1 hitpoint: red-1's first quick attack misses
  // (the crowd moves 5 -> 4) and its second kills with the crowd at 3, above
  // the floor, so an unmoved crowd there is the kill and not the clamp.
  const host = demoHost({ seed: 5, blue: (member) => ({ ...member, vanilla: { ...member.vanilla, hitpoints: 1 } }) });
  const steps = [];
  for (let actions = 0; !host.battle.result && actions < 60; actions += 1) {
    const actorId = host.currentCombatantId();
    const before = host.vanillaGlobals().crowd_interest;
    steps.push({ actorId, before, step: host.submit({ actorId, ...host.suggestAction() }) });
  }
  const killing = steps.at(-1);
  assert.ok(killing.step.result, "the bout ends on the kill");
  assert.equal(killing.step.action.type, Ss2ActionType.QUICK_ATTACK);
  assert.ok(killing.before > 1, `the crowd stood at ${killing.before}, above the clamp's floor`);
  assert.deepEqual(crowdWrites(killing.step.writes), [], "the killing phase adds no delta, so nothing is written");
  assert.equal(host.vanillaGlobals().crowd_interest, killing.before);
  assert.equal(ss2CrowdInterestOf(host.wire()), killing.before);

  const sameVerbEarlier = steps.slice(0, -1)
    .filter(({ actorId, step }) => actorId === "red-1" && step.action.type === Ss2ActionType.QUICK_ATTACK);
  assert.ok(sameVerbEarlier.length > 0);
  assert.ok(sameVerbEarlier.every(({ step }) => crowdWrites(step.writes).length === 1),
    "every earlier completed quick attack of red-1's wrote the crowd");
});

test("the write is total and quiet: an unmoved crowd writes nothing, a moved one writes once, from the `_global` mirror", () => {
  const battleAfter = { crowd_interest: { value: 8, min: null, max: null } };
  const battleBefore = { crowd_interest: { value: 10, min: null, max: null } };
  const globals = { crowd_interest: 10 };
  const moved = vanillaWritesForResolvedAction({ before: [], after: [], effects: [], battleBefore, battleAfter, globals });
  assert.deepEqual(crowdWrites(moved.writes).map(({ from, to, reason }) => [from, to, reason]),
    [[10, 8, "resolved-state-diff"]], "found by the totality pass");
  assert.deepEqual(crowdReports(moved.unmapped), []);
  const withEffect = vanillaWritesForResolvedAction({
    before: [], after: [], battleBefore, battleAfter, globals,
    effects: [{ kind: "battle-resource", resource: "crowd_interest", to: 8 }]
  });
  assert.deepEqual(crowdWrites(withEffect.writes).map(({ reason }) => reason), ["battle-resource-effect"],
    "the effect pass and the totality pass write it ONCE, attributed to the effect");
  const still = vanillaWritesForResolvedAction({ before: [], after: [], effects: [], battleBefore, battleAfter: battleBefore });
  assert.deepEqual(still.writes, []);
  assert.deepEqual(vanillaWritesForResolvedAction({ before: [], after: [] }).writes, [],
    "a battle with no pool of its own writes none");

  // A battle pool the build keeps no `_global` for is STILL reported: the
  // adapter will not invent a global to hold it.
  const invented = vanillaWritesForResolvedAction({
    before: [], after: [],
    battleBefore: { ...battleBefore, momentum: { value: 0, min: null, max: null } },
    battleAfter: { ...battleAfter, momentum: { value: 3, min: null, max: null } },
    globals
  });
  assert.deepEqual(crowdWrites(invented.writes).map(({ field }) => field), ["crowd_interest"]);
  assert.deepEqual(crowdReports(invented.unmapped).map(({ battleResource, from, to }) => [battleResource, from, to]),
    [["momentum", 0, 3]]);
  assert.match(crowdReports(invented.unmapped)[0].reason, /no vanilla global/);
});
