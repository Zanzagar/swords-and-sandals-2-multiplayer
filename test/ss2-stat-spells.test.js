/**
 * The four STAT spells — `cast_colossus` (id 42), `cast_little_fat_kid` (33),
 * `cast_swiftsandals` (40) and `cast_bloodlust` (41) — and the machinery they
 * need: an in-battle stat write (`EffectKind.STAT`), the fight-start snapshot
 * each restores from (`backup_*`), and an expiry step in the per-phase tick.
 *
 * ## WHAT THE BUILD DOES, AND WHERE
 *
 * Read 2026-09-22 from the oracle whose sha256 is `77CB545C…`,
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f`, block base `0x240c85`.
 *
 * ```text
 *   cast_colossus         +0x7fda  attacker.spell_colossus = 16     (every tick)
 *                                  once: strength = backup_strength * 3
 *                                        attack   = backup_attack * 2
 *   cast_little_fat_kid   +0x81f8  DEFENDER.spell_little_fat_kid = 16
 *                                  once (defender.struck == null):
 *                                        game_defender.strength = round(backup_strength / 2)
 *                                        game_defender.attack   = round(backup_attack / 2)
 *   cast_swiftsandals     +0x895d  attacker.spell_swiftsandals = 20
 *                                  once: speed = 10 + backup_speed * 2
 *   cast_bloodlust        +0x8a60  attacker.spell_bloodlust = 20
 *                                  once: strength = 10 + round(backup_strength * 1.5)
 *                                        defence  = round(backup_defence * 0.5)
 *
 *   check_spells(which_character, which_avatar)   +0x2439-+0x278f, per counter:
 *     if (c > 0) c -= 1
 *     if (c == 0) { restore from backup_*; c = -1 }     <- OUTSIDE the > 0 block
 * ```
 *
 * `backup_*` is `backup_char`'s fight-start copy (`+0x2d80`-`+0x2da7`), run
 * for both fighters before the bout (`sprite:2249/frame:1` `+0x010a`,
 * `+0x012e`) and never mid-battle. `nextphase` runs `check_spells` for the
 * attacker then the defender (`+0x3271`, `+0x3289`), and `battlevalues`
 * (`+0x35eb`, `+0x35ff`) afterwards recomputes reach and damage from the live
 * strength and movement from the live speed.
 *
 * ## WHAT IS DECIDED HERE, AND WHOSE
 *
 * - **The hero's per-round re-skin is NOT reproduced** (owner, 2026-09-22):
 *   every combatant keeps its buff for the counter's whole run.
 * - **The tick policy is not decided here** — these counters go through the
 *   same `ss2TimedSpellTick` as regenerate's, so whatever policy lands there,
 *   they follow it. These tests are 1v1, where every policy agrees with the
 *   build.
 * - **`crowd_action` is recorded, not modelled** (owner, 2026-09-22).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, EffectKind, lastResolvedAction,
  legalActions, suggestAction, toTeamWireState
} from "../src/team/index.js";
import {
  buildArenaLayout, CommandKind, createVanillaBattleHost, LabelProvenance, presentArenaConstruction,
  presentResolvedEvents, SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import { demoSide } from "../tools/arena/roster.js";
import { allUnmappedLabels, applyCommands, clipLabelsFor, emptyScene, timelineFor } from "../src/render/index.js";
import {
  SS2_INVENTORY_EMPTY, SS2_RESOURCE_DEFAULTS, SS2_RESOURCE_NAMES, SS2_STAT_SPELLS, SS2_WRITTEN_RESOURCES,
  SS2_TAUNT, Ss2ActionType, VANILLA_PHASE_LABEL, createSs2TeamRules, ss2ActiveDamagePair, ss2BattleValues,
  ss2Combatant, ss2PhysicalSize, ss2Reach, ss2TauntValue, ss2TeamRules
} from "../src/team/ss2-rules.js";

const COLOSSUS = Ss2ActionType.CAST_COLOSSUS;
const FAT_KID = Ss2ActionType.CAST_LITTLE_FAT_KID;
const SWIFT = Ss2ActionType.CAST_SWIFTSANDALS;
const BLOODLUST = Ss2ActionType.CAST_BLOODLUST;

/** Strength 9, speed 20, attack 8, defence 5; 170 hitpoints, 160 stamina, magicka 7. */
const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

/** A 1v1 with the caster on RED, opening. */
function staged({ hero = {}, foe = {}, heroX = -60, foeX = 60, rules = ss2TeamRules, seed = 3 } = {}) {
  const battle = createTeamBattle({
    seed,
    rules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller: "local" })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller: "local" })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: heroX, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: foeX, y: 200 });
  assert.equal(currentCombatant(battle).id, "hero", "the caster must open for these tests to mean anything");
  return battle;
}

const valueOf = (battle, id, name) => combatantById(battle, id).resources[name]?.value;
const statOf = (battle, id, stat) => combatantById(battle, id).stats[stat];
const offersOf = (battle, type, id = "hero") => legalActions(battle, id).filter((option) => option.type === type);
const cast = (battle, type, actorId = "hero", targetId = actorId) => applyAction(battle, { actorId, type, targetId });
const rest = (battle, actorId = currentCombatant(battle).id) =>
  applyAction(battle, { actorId, type: Ss2ActionType.REST, targetId: actorId });

/* ------------------------------------------------------------------ *
 * The vocabulary                                                      *
 * ------------------------------------------------------------------ */

test("the four tokens round-trip to the build's labels and join the rule set's vocabulary", () => {
  assert.deepEqual([COLOSSUS, FAT_KID, SWIFT, BLOODLUST],
    ["cast-colossus", "cast-little-fat-kid", "cast-swiftsandals", "cast-bloodlust"]);
  // `+0x7fe0`, `+0x81fe`, `+0x8963`, `+0x8a66`.
  assert.deepEqual([COLOSSUS, FAT_KID, SWIFT, BLOODLUST].map((type) => VANILLA_PHASE_LABEL[type]),
    ["cast_colossus", "cast_little_fat_kid", "cast_swiftsandals", "cast_bloodlust"]);
  const types = createSs2TeamRules().actionTypes;
  for (const type of [COLOSSUS, FAT_KID, SWIFT, BLOODLUST]) assert.ok(types.includes(type));
});

test("the constants are the build's literals", () => {
  const row = (type) => {
    const { itemId, counter, duration, bearer, casterClip, victimClip, crowdAction, stats } = SS2_STAT_SPELLS[type];
    return { itemId, counter, duration, bearer, casterClip, victimClip, crowdAction, stats: [...stats] };
  };
  assert.deepEqual(row(COLOSSUS), {
    itemId: 42, counter: "spell_colossus", duration: 16, bearer: "caster", casterClip: "Colossus",
    victimClip: null, crowdAction: 15, stats: ["strength", "attack"]
  });
  assert.deepEqual(row(FAT_KID), {
    itemId: 33, counter: "spell_little_fat_kid", duration: 16, bearer: "victim", casterClip: "Cast2",
    victimClip: "little_fat_kid", crowdAction: 10, stats: ["strength", "attack"]
  });
  assert.deepEqual(row(SWIFT), {
    itemId: 40, counter: "spell_swiftsandals", duration: 20, bearer: "caster", casterClip: "Cast2",
    victimClip: null, crowdAction: 3, stats: ["agility"]
  });
  assert.deepEqual(row(BLOODLUST), {
    itemId: 41, counter: "spell_bloodlust", duration: 20, bearer: "caster", casterClip: "Cast2",
    victimClip: null, crowdAction: 3, stats: ["strength", "defense"]
  });
});

test("the counters and backups are NOT record vocabulary: no default, never read out of a record, only the counters written", () => {
  const counters = ["spell_colossus", "spell_little_fat_kid", "spell_swiftsandals", "spell_bloodlust"];
  const backups = ["backup_strength", "backup_speed", "backup_attack", "backup_defence"];
  for (const name of [...counters, ...backups]) {
    assert.equal(SS2_RESOURCE_NAMES.includes(name), false, `${name} is declared at the opening, not from a record`);
    assert.equal(Object.hasOwn(SS2_RESOURCE_DEFAULTS, name), false,
      `${name} with a default would be filled into every golden's combatant and move all 23 hashes`);
  }
  for (const name of counters) assert.ok(SS2_WRITTEN_RESOURCES.includes(name));
  for (const name of backups) assert.equal(SS2_WRITTEN_RESOURCES.includes(name), false, `${name} is never written`);
});

test("a record STATING a counter on the persistent object is ignored — the build keeps it on the clip", () => {
  // `tools/arena/roster.js` states `spell_colossus: 0, spell_bloodlust: 0`. Declared, a 0 would
  // restore on the first tick (`check_spells`' `== 0` sits outside its `> 0`).
  const record = ss2Combatant(fields({ spell_colossus: 0, spell_bloodlust: 0, backup_strength: 99 }));
  for (const name of ["spell_colossus", "spell_bloodlust", "backup_strength"]) {
    assert.equal(Object.hasOwn(record.resources, name), false, name);
  }
  const battle = staged({ hero: { inventory1: 41, spell_bloodlust: 0, backup_strength: 99 } });
  assert.equal(valueOf(battle, "hero", "spell_bloodlust"), -1, "the opening's -1, not the stated 0");
  assert.equal(valueOf(battle, "hero", "backup_strength"), 9, "the stat the gladiator was built with");
  rest(battle, "hero");
  assert.equal(statOf(battle, "hero", "strength"), 9);
  assert.deepEqual(lastResolvedAction(battle).effects.filter((effect) => effect.kind === EffectKind.STAT), []);
});

test("a battle where nobody carries 33, 40, 41 or 42 declares none of them — the census's mechanism", () => {
  const battle = staged({ hero: { inventory1: 46 }, foe: { inventory1: 45 } });
  for (const id of ["hero", "foe"]) {
    assert.equal(Object.keys(combatantById(battle, id).resources).some((name) =>
      /^backup_|^spell_(colossus|little_fat_kid|swiftsandals|bloodlust)$/.test(name)), false);
  }
  assert.deepEqual(offersOf(battle, COLOSSUS), []);
  assert.deepEqual(offersOf(battle, FAT_KID), []);
});

test("a gladiator carrying the item whose bearer declares nothing is not offered the cast", () => {
  // Built past the opening hook's reach: the counter removed after construction.
  const battle = staged({ hero: { inventory1: 41 } });
  delete combatantById(battle, "hero").resources.spell_bloodlust;
  assert.deepEqual(offersOf(battle, BLOODLUST), []);
});

/* ------------------------------------------------------------------ *
 * Bloodlust                                                           *
 * ------------------------------------------------------------------ */

test("carrying id 41 declares spell_bloodlust at the build's inert -1, and the two backups it restores from", () => {
  const battle = staged({ hero: { inventory1: 41 } });
  const hero = combatantById(battle, "hero");
  assert.deepEqual(hero.resources.spell_bloodlust, { value: -1, min: -1, max: null });
  assert.deepEqual(hero.resources.backup_strength, { value: 9, min: 0, max: null });
  assert.deepEqual(hero.resources.backup_defence, { value: 5, min: 0, max: null });
  assert.equal(Object.hasOwn(hero.resources, "backup_speed"), false, "bloodlust writes no speed");
  assert.equal(Object.hasOwn(hero.resources, "backup_attack"), false, "nor attack");
  const foe = combatantById(battle, "foe");
  assert.equal(Object.keys(foe.resources).some((name) => /^spell_|^backup_/.test(name)), false,
    "bloodlust lands on its caster, so its caster's foe declares nothing");
});

test("bloodlust is offered once, aimed at the caster, on possession", () => {
  assert.deepEqual(offersOf(staged({ hero: { inventory2: 41 } }), BLOODLUST), [{ type: BLOODLUST, targetId: "hero" }]);
  assert.deepEqual(offersOf(staged(), BLOODLUST), []);
  assert.deepEqual(offersOf(staged({ hero: { inventory3: 41, inventory_maxslots: 2 } }), BLOODLUST), [],
    "the slot window applies, as it does to every spell");
});

test("the cast writes strength = 10 + round(1.5 * backup) and defence = round(0.5 * backup), and ticks 20 to 19", () => {
  const battle = staged({ hero: { inventory1: 41 } });
  cast(battle, BLOODLUST);
  // 10 + round(13.5) = 24 and round(2.5) = 3: the build's Math.round sends a half UP.
  assert.equal(statOf(battle, "hero", "strength"), 24);
  assert.equal(statOf(battle, "hero", "defense"), 3);
  assert.equal(valueOf(battle, "hero", "spell_bloodlust"), 19);
  assert.equal(valueOf(battle, "hero", "inventory1"), SS2_INVENTORY_EMPTY);
  const effects = lastResolvedAction(battle).effects;
  assert.deepEqual(effects.filter((effect) => effect.kind === EffectKind.STAT), [
    { kind: EffectKind.STAT, targetId: "hero", stat: "strength", to: 24 },
    { kind: EffectKind.STAT, targetId: "hero", stat: "defense", to: 3 }
  ]);
});

test("THE EXPIRY: on the 20th nextphase the counter reaches 0, strength and defence go back, and it is left at -1", () => {
  const battle = staged({ hero: { inventory1: 41 } });
  const counters = [];
  const strengths = [];
  for (let phase = 0; phase < 23; phase += 1) {
    const actorId = currentCombatant(battle).id;
    if (phase === 0) cast(battle, BLOODLUST); else rest(battle, actorId);
    counters.push(valueOf(battle, "hero", "spell_bloodlust"));
    strengths.push(statOf(battle, "hero", "strength"));
  }
  assert.deepEqual(counters, [19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, -1, -1, -1, -1],
    "1 -> 0 restores and writes -1 in the SAME call; 0 is never left behind");
  assert.deepEqual(strengths, [...Array(19).fill(24), 9, 9, 9, 9]);
  assert.equal(statOf(battle, "hero", "defense"), 5);
});

test("the expiry's writes are the restores then the -1, and a bystander's expiry lands in somebody else's phase", () => {
  const battle = staged({ hero: { inventory1: 41 } });
  cast(battle, BLOODLUST);
  for (let phase = 1; phase < 19; phase += 1) rest(battle);
  assert.equal(valueOf(battle, "hero", "spell_bloodlust"), 1);
  assert.equal(currentCombatant(battle).id, "foe");
  rest(battle, "foe");
  const onHero = lastResolvedAction(battle).effects.filter((effect) => effect.targetId === "hero");
  assert.deepEqual(onHero, [
    { kind: EffectKind.STAT, targetId: "hero", stat: "strength", to: 9 },
    { kind: EffectKind.STAT, targetId: "hero", stat: "defense", to: 5 },
    { kind: EffectKind.RESOURCE, targetId: "hero", resource: "spell_bloodlust", to: -1 },
    // MERGED 2026-09-22 with the owner's bearer's-turn tick rule: the hero was
    // owed this bystander tick (it acted last), so the foe's phase PAYS it —
    // after every tick, as `ss2TimedSpellTick` writes the clock.
    { kind: EffectKind.RESOURCE, targetId: "hero", resource: "timed_spell_tick_owed", to: 0 }
  ]);
});

test("-1 IS INERT and 0 IS NOT: a counter entering a tick at 0 restores, one at -1 never does", () => {
  // The build's `== 0` sits outside its `> 0` (`+0x26ac`), so a counter ENTERING at 0 restores.
  const zero = staged({ hero: { inventory1: 41 } });
  combatantById(zero, "hero").resources.spell_bloodlust.value = 0;
  rest(zero, "hero");
  assert.equal(valueOf(zero, "hero", "spell_bloodlust"), -1);
  assert.ok(lastResolvedAction(zero).effects.some((effect) => effect.kind === EffectKind.STAT && effect.targetId === "hero"),
    "the restore fired");
  const inert = staged({ hero: { inventory1: 41 } });
  rest(inert, "hero");
  assert.equal(valueOf(inert, "hero", "spell_bloodlust"), -1);
  assert.deepEqual(lastResolvedAction(inert).effects.filter((effect) => effect.targetId === "hero"
    && (effect.kind === EffectKind.STAT || effect.resource === "spell_bloodlust")), []);
});

test("a RECAST resets to 20 and writes the same stats again: absolute from the backup, never stacked", () => {
  const battle = staged({ hero: { inventory1: 41, inventory2: 41 } });
  cast(battle, BLOODLUST);
  rest(battle, "foe");
  cast(battle, BLOODLUST);
  assert.equal(valueOf(battle, "hero", "spell_bloodlust"), 19);
  assert.equal(statOf(battle, "hero", "strength"), 24, "10 + round(1.5 * 9) again, not from the buffed 24");
  assert.equal(statOf(battle, "hero", "defense"), 3);
});

test("the cast costs round(magicka), the caster's stat, and takes zero samples", () => {
  const battle = staged({ hero: { inventory1: 41, magicka: 7.5 } });
  const cursor = battle.rng.cursor;
  cast(battle, BLOODLUST);
  assert.equal(battle.rng.cursor, cursor);
  // 160 - round(7.5) + 1 + round(6 / 3) = 155.
  assert.equal(valueOf(battle, "hero", "staminaleft"), 155);
  const event = battle.events.at(-1);
  assert.equal(event.staminaSpent, 8);
  assert.deepEqual(
    { type: event.type, actorId: event.actorId, targetId: event.targetId, vanillaLabel: event.vanillaLabel,
      casterClip: event.casterClip, spellId: event.spellId, counter: event.counter, counterSet: event.counterSet,
      counterAfter: event.counterAfter, statsSet: event.statsSet },
    { type: BLOODLUST, actorId: "hero", targetId: "hero", vanillaLabel: "cast_bloodlust", casterClip: "Cast2",
      spellId: 41, counter: "spell_bloodlust", counterSet: 20, counterAfter: 19, statsSet: { strength: 24, defense: 3 } }
  );
  assert.equal(Object.hasOwn(event, "victimClip"), false, "bloodlust plays nothing on anybody else");
});

/* ------------------------------------------------------------------ *
 * The readers: every one reads the LIVE stat, as the build's do        *
 * ------------------------------------------------------------------ */

test("battlevalues' outputs follow the live strength: the melee pair by round(2 * s), the reach by physical_size", () => {
  const battle = staged({ hero: { inventory1: 41 } });
  const hero = combatantById(battle, "hero");
  // Weapon 1 at strength 9: 21-27 and a reach of 130 (physical_size 86 + 44).
  assert.deepEqual(ss2ActiveDamagePair(hero), { min_damage: 21, max_damage: 27 });
  assert.equal(ss2Reach(hero), 130);
  cast(battle, BLOODLUST);
  // Strength 24: round(48) - round(18) = +30 on both, and physical_size 96 is +10 on the reach.
  assert.deepEqual(ss2ActiveDamagePair(hero), { min_damage: 51, max_damage: 57 });
  assert.equal(ss2PhysicalSize(hero), 96);
  assert.equal(ss2Reach(hero), 140);
  // The stored resources are still the fight-start battlevalues; only the reading moved.
  assert.equal(hero.resources.min_damage.value, 21);
  assert.equal(hero.resources.weapon_range.value, 130);
});

test("a blow from the buffed caster lands with the live pair: the same roll deals exactly 30 more", () => {
  const blow = (hero) => {
    // Seed 5 lands a normal blow here (probed; the other seeds this staging tried miss).
    const battle = staged({ hero, seed: 5 });
    if (hero.inventory1 === 41) cast(battle, BLOODLUST); else rest(battle, "hero");
    rest(battle, "foe");
    const foe = combatantById(battle, "foe");
    const before = foe.health;
    applyAction(battle, { actorId: "hero", type: Ss2ActionType.NORMAL_ATTACK, targetId: "foe" });
    const event = battle.events.at(-1);
    return { hit: event.hit, dealt: before - foe.health + event.armourAbsorbed };
  };
  const plain = blow({ inventory1: SS2_INVENTORY_EMPTY });
  const buffed = blow({ inventory1: 41 });
  assert.equal(plain.hit, true, "the staging must land a blow for this to mean anything");
  assert.equal(buffed.hit, true);
  assert.equal(buffed.dealt - plain.dealt, 30);
});

test("bloodlust's halved defence is read live by the hit chance: the foe's chance on the caster goes up", () => {
  const chanceOnHero = (hero) => {
    const battle = staged({ hero });
    if (hero.inventory1 === 41) cast(battle, BLOODLUST); else rest(battle, "hero");
    applyAction(battle, { actorId: "foe", type: Ss2ActionType.QUICK_ATTACK, targetId: "hero" });
    return battle.events.at(-1).chance;
  };
  const plain = chanceOnHero({ inventory1: SS2_INVENTORY_EMPTY });
  const buffed = chanceOnHero({ inventory1: 41 });
  assert.ok(buffed > plain, `defence 5 -> 3 must raise the chance: ${plain} -> ${buffed}`);
});

/* ------------------------------------------------------------------ *
 * Little fat kid: a debuff on the DEFENDER                            *
 * ------------------------------------------------------------------ */

test("little fat kid's counter and backups are declared on the FOES of whoever carries id 33, not on the carrier", () => {
  const battle = staged({ hero: { inventory1: 33 } });
  const foe = combatantById(battle, "foe");
  assert.deepEqual(foe.resources.spell_little_fat_kid, { value: -1, min: -1, max: null });
  assert.deepEqual(foe.resources.backup_strength, { value: 9, min: 0, max: null });
  assert.deepEqual(foe.resources.backup_attack, { value: 8, min: 0, max: null });
  assert.equal(Object.hasOwn(foe.resources, "backup_defence"), false);
  const hero = combatantById(battle, "hero");
  assert.equal(Object.keys(hero.resources).some((name) => /^spell_|^backup_/.test(name)), false,
    "the caster is not the one it lands on");
});

test("little fat kid is offered PER FOE, and aimed at the foe", () => {
  assert.deepEqual(offersOf(staged({ hero: { inventory1: 33 } }), FAT_KID), [{ type: FAT_KID, targetId: "foe" }]);
  assert.throws(() => cast(staged({ hero: { inventory1: 33 } }), FAT_KID, "hero", "hero"), /Illegal action/);
});

test("the cast halves the VICTIM's strength and attack from ITS backups, rounding a half UP", () => {
  const battle = staged({ hero: { inventory1: 33, strength: 30 } });
  cast(battle, FAT_KID, "hero", "foe");
  // round(9 / 2) = round(4.5) = 5, round(8 / 2) = 4 — the victim's 9 and 8, never the caster's 30.
  assert.equal(statOf(battle, "foe", "strength"), 5);
  assert.equal(statOf(battle, "foe", "attack"), 4);
  assert.equal(statOf(battle, "hero", "strength"), 30, "the caster is untouched");
  const event = battle.events.at(-1);
  assert.equal(event.targetId, "foe");
  assert.equal(event.casterClip, "Cast2");
  assert.equal(event.victimClip, "little_fat_kid");
  assert.deepEqual(event.statsSet, { strength: 5, attack: 4 });
  // The arm writes 16 on the VICTIM's clip, and in 1v1 `check_spells(game_defender, defender)` ticks it.
  assert.equal(event.counterSet, 16);
  assert.equal(event.counterAfter, 15);
  assert.equal(valueOf(battle, "foe", "spell_little_fat_kid"), 15);
  // And the caster pays round(magicka), its OWN stat (`+0x8229`).
  assert.equal(event.staminaSpent, 7);
});

test("little fat kid expires on the 16th nextphase counting its own, and the victim's stats come back", () => {
  const battle = staged({ hero: { inventory1: 33 } });
  cast(battle, FAT_KID, "hero", "foe");
  const counters = [valueOf(battle, "foe", "spell_little_fat_kid")];
  for (let phase = 1; phase < 17; phase += 1) {
    rest(battle);
    counters.push(valueOf(battle, "foe", "spell_little_fat_kid"));
  }
  assert.deepEqual(counters, [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, -1, -1]);
  assert.equal(statOf(battle, "foe", "strength"), 9);
  assert.equal(statOf(battle, "foe", "attack"), 8);
});

test("in 2v2 every foe of the carrier declares, and the caster's own ally does not", () => {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [
        ss2Combatant(fields({ speed: 24, inventory1: 33 }), { id: "hero", name: "hero", controller: "local" }),
        ss2Combatant(fields({ speed: 22 }), { id: "ally", name: "ally", controller: "local" })
      ] },
      { id: "blue", name: "blue", combatants: [
        ss2Combatant(fields({ speed: 23, gladiator_dir: "left" }), { id: "foe1", name: "foe1", controller: "local" }),
        ss2Combatant(fields({ speed: 21, gladiator_dir: "left" }), { id: "foe2", name: "foe2", controller: "local" })
      ] }
    ]
  });
  for (const id of ["foe1", "foe2"]) {
    assert.equal(valueOf(battle, id, "spell_little_fat_kid"), -1, `${id} can be the victim`);
  }
  for (const id of ["hero", "ally"]) {
    assert.equal(Object.hasOwn(combatantById(battle, id).resources, "spell_little_fat_kid"), false);
  }
  assert.deepEqual(offersOf(battle, FAT_KID).map((option) => option.targetId), ["foe1", "foe2"]);
});

/* ------------------------------------------------------------------ *
 * Colossus                                                            *
 * ------------------------------------------------------------------ */

test("colossus writes strength = 3 * backup and attack = 2 * backup, unrounded, and its counter starts at 16", () => {
  const battle = staged({ hero: { inventory1: 42 } });
  const hero = combatantById(battle, "hero");
  assert.deepEqual(hero.resources.spell_colossus, { value: -1, min: -1, max: null });
  assert.deepEqual(offersOf(battle, COLOSSUS), [{ type: COLOSSUS, targetId: "hero" }]);
  cast(battle, COLOSSUS);
  assert.equal(statOf(battle, "hero", "strength"), 27);
  assert.equal(statOf(battle, "hero", "attack"), 16);
  assert.equal(valueOf(battle, "hero", "spell_colossus"), 15);
  const event = battle.events.at(-1);
  assert.equal(event.casterClip, "Colossus");
  assert.equal(Object.hasOwn(event, "victimClip"), false);
  assert.deepEqual(event.statsSet, { strength: 27, attack: 16 });
  // Strength 27: +36 on the melee pair (round(54) - round(18)) and physical_size 98, +12 on the reach.
  assert.deepEqual(ss2ActiveDamagePair(hero), { min_damage: 57, max_damage: 63 });
  assert.equal(ss2Reach(hero), 142);
});

test("THE DRIFT IS DEFERRED, and pinned so that modelling it is a decision: the caster does not move", () => {
  // The build moves the caster 2 px a tick toward `gladiator_dir` for the ~58
  // ticks the watchdog lets the phase run (`+0x8139`-`+0x8191`); see
  // `SS2_STAT_SPELLS` for why a straight 116 px is not that.
  const battle = staged({ hero: { inventory1: 42 } });
  cast(battle, COLOSSUS);
  assert.equal(combatantById(battle, "hero").x, -60);
  assert.deepEqual(lastResolvedAction(battle).effects.filter((effect) => effect.kind === EffectKind.POSITION), []);
  assert.equal(SS2_STAT_SPELLS[COLOSSUS].driftPerTick, 2);
  assert.equal(SS2_STAT_SPELLS[COLOSSUS].watchdogTicks, 58);
});

test("colossus expires on the 16th nextphase counting its own", () => {
  const battle = staged({ hero: { inventory1: 42 } });
  cast(battle, COLOSSUS);
  for (let phase = 1; phase < 15; phase += 1) rest(battle);
  assert.equal(valueOf(battle, "hero", "spell_colossus"), 1);
  assert.equal(statOf(battle, "hero", "strength"), 27);
  rest(battle);
  assert.equal(valueOf(battle, "hero", "spell_colossus"), -1);
  assert.equal(statOf(battle, "hero", "strength"), 9);
  assert.equal(statOf(battle, "hero", "attack"), 8);
});

/* ------------------------------------------------------------------ *
 * One slot per stat: last writer wins, any expiry resets it           *
 * ------------------------------------------------------------------ */

test("ANY expiry resets strength: colossus running out cancels bloodlust's strength, and its halved defence goes on", () => {
  const battle = staged({ hero: { inventory1: 42, inventory2: 41 } });
  cast(battle, COLOSSUS);
  rest(battle, "foe");
  cast(battle, BLOODLUST);
  assert.equal(statOf(battle, "hero", "strength"), 24, "the last writer wins");
  assert.equal(statOf(battle, "hero", "attack"), 16, "colossus's attack is untouched by bloodlust");
  for (let phase = 3; phase < 16; phase += 1) rest(battle);
  assert.equal(valueOf(battle, "hero", "spell_colossus"), -1);
  assert.equal(valueOf(battle, "hero", "spell_bloodlust"), 6, "bloodlust still has six phases to run");
  assert.equal(statOf(battle, "hero", "strength"), 9, "colossus's expiry wrote backup_strength over bloodlust's 24");
  assert.equal(statOf(battle, "hero", "attack"), 8);
  assert.equal(statOf(battle, "hero", "defense"), 3, "bloodlust's defence is nobody else's to restore");
});

test("an expiry IN THE CAST'S OWN PHASE overrides the cast: nextphase restores after the arm writes", () => {
  // A colossus with one phase left, and bloodlust cast now: the arm writes 24,
  // then `check_spells` takes colossus 1 -> 0 and writes backup_strength back.
  const battle = staged({ hero: { inventory1: 41, inventory2: 42 } });
  combatantById(battle, "hero").resources.spell_colossus.value = 1;
  cast(battle, BLOODLUST);
  assert.equal(valueOf(battle, "hero", "spell_colossus"), -1);
  assert.equal(statOf(battle, "hero", "strength"), 9);
  assert.equal(statOf(battle, "hero", "defense"), 3);
  const strengthWrites = lastResolvedAction(battle).effects
    .filter((effect) => effect.kind === EffectKind.STAT && effect.stat === "strength").map((effect) => effect.to);
  assert.deepEqual(strengthWrites, [24, 9], "the arm's, then the expiry's — the build's order");
});

test("little fat kid on a colossus reads the VICTIM's backup, not its buffed strength", () => {
  const battle = staged({ hero: { inventory1: 42 }, foe: { inventory1: 33 } });
  cast(battle, COLOSSUS);
  cast(battle, FAT_KID, "foe", "hero");
  assert.equal(statOf(battle, "hero", "strength"), 5, "round(9 / 2), not round(27 / 2)");
  assert.equal(statOf(battle, "hero", "attack"), 4);
});

/* ------------------------------------------------------------------ *
 * Swift sandals                                                       *
 * ------------------------------------------------------------------ */

test("swift sandals declares its counter and backup_speed alone, and writes speed = 10 + 2 * backup — not a doubling", () => {
  const battle = staged({ hero: { inventory1: 40, speed: 5 }, foe: { speed: 4 } });
  const hero = combatantById(battle, "hero");
  assert.deepEqual(hero.resources.spell_swiftsandals, { value: -1, min: -1, max: null });
  assert.deepEqual(hero.resources.backup_speed, { value: 5, min: 0, max: null });
  assert.equal(Object.hasOwn(hero.resources, "backup_strength"), false);
  assert.deepEqual(offersOf(battle, SWIFT), [{ type: SWIFT, targetId: "hero" }]);
  cast(battle, SWIFT);
  assert.equal(statOf(battle, "hero", "agility"), 20, "10 + 5 * 2");
  assert.equal(valueOf(battle, "hero", "spell_swiftsandals"), 19);
  assert.deepEqual(battle.events.at(-1).statsSet, { agility: 20 });
});

test("the boost reaches movement through battlevalues: a walk goes further and costs more", () => {
  const walkOf = (battle) => {
    const hero = combatantById(battle, "hero");
    const from = hero.x;
    applyAction(battle, { actorId: "hero", type: Ss2ActionType.WALK_LEFT, targetId: "hero" });
    // `nextphase` adds back 1 + round(stamina 6 / 3) = 3, unclamped below the maximum here.
    return { distance: from - hero.x, cost: 3 - battle.events.at(-1).staminaGained };
  };
  const plain = staged({ hero: { speed: 5 }, foe: { speed: 4 }, heroX: -600, foeX: 600 });
  const boosted = staged({ hero: { inventory1: 40, speed: 5 }, foe: { speed: 4 }, heroX: -600, foeX: 600 });
  cast(boosted, SWIFT);
  rest(plain, "hero");
  rest(plain, "foe");
  rest(boosted, "foe");
  const before = walkOf(plain);
  const after = walkOf(boosted);
  // movement_speed = clamp(round(speed * 1.5), 4, 60): 8 plain, 30 boosted — 15 + 3 * 5.
  assert.equal(before.cost, Math.round(8 / 2));
  assert.equal(after.cost, Math.round(30 / 2));
  assert.ok(after.distance > before.distance, `${after.distance} > ${before.distance}`);
});

test("swift sandals' expiry puts SPEED back and touches no strength", () => {
  const battle = staged({ hero: { inventory1: 40, inventory2: 41 } });
  cast(battle, SWIFT);
  rest(battle, "foe");
  cast(battle, BLOODLUST);
  for (let phase = 3; phase < 19; phase += 1) rest(battle);
  assert.equal(valueOf(battle, "hero", "spell_swiftsandals"), 1);
  rest(battle);
  assert.equal(valueOf(battle, "hero", "spell_swiftsandals"), -1);
  assert.equal(statOf(battle, "hero", "agility"), 21, "speed restored");
  assert.equal(statOf(battle, "hero", "strength"), 24, "bloodlust's strength survives swift's expiry");
  assert.equal(valueOf(battle, "hero", "spell_bloodlust"), 2);
});

/* ------------------------------------------------------------------ *
 * The presentation                                                    *
 * ------------------------------------------------------------------ */

test("each cast presents the build's own clips, MAP_NAMED, moves nobody and leaves nothing unmapped", () => {
  const cases = [
    [COLOSSUS, 42, "hero", [["hero", "actor", "Colossus"]]],
    [FAT_KID, 33, "foe", [["hero", "actor", "Cast2"], ["foe", "target", "little_fat_kid"]]],
    [SWIFT, 40, "hero", [["hero", "actor", "Cast2"]]],
    [BLOODLUST, 41, "hero", [["hero", "actor", "Cast2"]]]
  ];
  for (const [type, itemId, targetId, expected] of cases) {
    const battle = staged({ hero: { inventory1: itemId } });
    const constructed = applyCommands(emptyScene(), presentArenaConstruction(buildArenaLayout(toTeamWireState(battle))));
    cast(battle, type, "hero", targetId);
    const wire = toTeamWireState(battle);
    const { commands } = presentResolvedEvents(wire, { layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS });
    assert.deepEqual(
      commands.filter((command) => command.kind === CommandKind.CLIP_GOTO)
        .map(({ combatantId, role, label, labelProvenance }) => [combatantId, role, label, labelProvenance]),
      expected.map((entry) => [...entry, LabelProvenance.MAP_NAMED]),
      type
    );
    assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), [], type);
    assert.deepEqual(commands.filter((command) => command.kind === CommandKind.MOVE_CLIP), [], `${type}: nobody moves`);
    assert.doesNotThrow(() => applyCommands(constructed, commands));
  }
});

test("`Colossus` resolves to a family that can DRAW it, for the build's own length", () => {
  // The verb shipped (d551c57) with the clip bound MAP_NAMED and no family, so
  // the caster played the `unknown` schedule. `attacker.gotoAndPlay("Colossus")`
  // at `+0x806f`; the clip is frames 2147-2168 with `struck = true; Stop` at
  // 2168 — 22 frames at 30 fps is 733 ms = 6.11 beats of 120 ms, and the
  // nearest beat is 6 = 720 ms, the rounding `Cast2`'s 21 frames get.
  const timeline = timelineFor("Colossus", { role: "actor" });
  assert.equal(timeline.recognised, true, "Colossus must not fall to the `unknown` schedule");
  assert.equal(timeline.family, "colossus");
  assert.ok(clipLabelsFor(timeline.family).includes("colossus"));
  assert.equal(timeline.durationMs, 720);
  assert.equal(new Set(allUnmappedLabels()).has("colossus"), false, "played now, so no longer declared unplayed");
});

test("the VICTIM's `little_fat_kid` resolves to a family that can DRAW it, for the length the build PLAYS", () => {
  // `defender.gotoAndPlay("little_fat_kid")` at `+0x82a2`. The label runs to
  // the end of the fighter clip, but the build stops at 2216
  // (`struck = true; Stop`), so it PLAYS 2200-2216: 17 frames at 30 fps is
  // 567 ms = 4.72 beats of 120 ms, and the nearest beat is 5 = 600 ms.
  const timeline = timelineFor("little_fat_kid", { role: "target" });
  assert.equal(timeline.recognised, true, "little_fat_kid must not fall to the `unknown` schedule");
  assert.equal(timeline.family, "little_fat_kid");
  assert.ok(clipLabelsFor(timeline.family).includes("little_fat_kid"));
  assert.equal(timeline.durationMs, 600);
  assert.equal(new Set(allUnmappedLabels()).has("little_fat_kid"), false,
    "classified and played now, so it leaves the declared-unplayed `unknown` bucket");
});

/* ------------------------------------------------------------------ *
 * The vanilla mirror (Codex, 2026-09-22): reported, never silent       *
 * ------------------------------------------------------------------ */

/** The arena's own host (`tools/arena/main.js`'s path), red-1 carrying item 42. */
function colossusHost() {
  const red = demoSide("red", 1, { ss2Combatant, ss2BattleValues });
  red.members[0] = {
    ...red.members[0],
    vanilla: { ...red.members[0].vanilla, inventory1: 42 },
    resources: { ...red.members[0].resources, inventory1: 42 }
  };
  return createVanillaBattleHost({
    teams: [red, demoSide("blue", 1, { ss2Combatant, ss2BattleValues })],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed: 3,
    awaitAnimations: false
  });
}

const statReports = (step) => step.unmapped.filter((entry) => Object.hasOwn(entry, "stat"))
  .map(({ combatantId, stat, field }) => [combatantId, stat, field]);

test("a stat write through the host is REPORTED unmapped, as the adapter contract prescribes, and writes nothing", () => {
  // Reproduced before it was fixed (Codex finding 2): the cast emitted no write AND no report for
  // strength or attack, and the host's agreement check (no stats) saw no drift.
  const host = colossusHost();
  const step = host.submit({ actorId: "red-1", type: COLOSSUS, targetId: "red-1" });
  assert.deepEqual(statReports(step), [["red-1", "strength", "strength"], ["red-1", "attack", "attack"]]);
  for (const entry of step.unmapped.filter((one) => Object.hasOwn(one, "stat"))) {
    assert.match(entry.reason, /WriteSource/);
  }
  assert.deepEqual(step.writes.filter((write) => ["strength", "attack"].includes(write.field)), [],
    "WriteSource is a closed set of four and none of them is a stat — docs/ss2-adapter-contract.md");
  assert.equal(host.combatant("red-1").stats.strength, 27);
  assert.equal(host.mirrorFor("red-1").fields.strength, 9, "the mirror keeps the licensed record's own value");
});

test("the EXPIRY is reported the same way, on the phase it happens in, and nothing else is", () => {
  const host = colossusHost();
  host.submit({ actorId: "red-1", type: COLOSSUS, targetId: "red-1" });
  const reports = [];
  for (let phase = 1; phase < 16; phase += 1) {
    const actorId = currentCombatant(host.battle).id;
    const step = host.submit({ actorId, type: Ss2ActionType.REST, targetId: actorId });
    reports.push(statReports(step));
  }
  assert.deepEqual(reports.slice(0, 14).flat(), [], "fourteen phases with no stat change report nothing");
  assert.deepEqual(reports[14], [["red-1", "strength", "strength"], ["red-1", "attack", "attack"]]);
  assert.equal(host.combatant("red-1").stats.strength, 9, "restored: canonical and mirror agree again");
  assert.equal(host.mirrorFor("red-1").fields.strength, 9);
});

/* ------------------------------------------------------------------ *
 * The AI: ladder arms 8, 9, 22 and 27                                  *
 * ------------------------------------------------------------------ */

/** What the AI would do for the hero, standing `distance` from the foe. */
const aiAt = (distance, hero, foe = {}) =>
  suggestAction(staged({ hero, foe, heroX: 0, foeX: distance }), "hero");

test("the ladder's constants are the build's: arms 8, 9, 22, 27 and their strict distance tests", () => {
  assert.deepEqual(
    [COLOSSUS, FAT_KID, BLOODLUST, SWIFT].map((type) => {
      const { itemId, ladderArm, aiFightDistanceBelow, aiFightDistanceAbove } = SS2_STAT_SPELLS[type];
      return [itemId, ladderArm, aiFightDistanceBelow ?? null, aiFightDistanceAbove ?? null];
    }),
    [[42, 8, 300, null], [33, 9, 500, null], [41, 22, 400, null], [40, 27, null, 300]]
  );
});

test("arm 8: colossus below 300 and not AT 300 (`Less2`, strict)", () => {
  assert.deepEqual(aiAt(299, { inventory1: 42 }), { type: COLOSSUS, targetId: "hero" });
  assert.notEqual(aiAt(300, { inventory1: 42 }).type, COLOSSUS);
});

test("arm 9: little fat kid below 500, at the foe the distance is measured to", () => {
  assert.deepEqual(aiAt(499, { inventory1: 33 }), { type: FAT_KID, targetId: "foe" });
  assert.notEqual(aiAt(500, { inventory1: 33 }).type, FAT_KID);
});

test("arm 22: bloodlust below 400 and not at 400", () => {
  assert.deepEqual(aiAt(399, { inventory1: 41 }), { type: BLOODLUST, targetId: "hero" });
  assert.notEqual(aiAt(400, { inventory1: 41 }).type, BLOODLUST);
});

test("arm 27: swift sandals ABOVE 300 (`Greater`) and not at 300", () => {
  assert.deepEqual(aiAt(301, { inventory1: 40 }), { type: SWIFT, targetId: "hero" });
  assert.notEqual(aiAt(300, { inventory1: 40 }).type, SWIFT);
});

test("ladder order: arm 8 before arm 9 — colossus wins below 300, little fat kid from 300 to 499", () => {
  assert.equal(aiAt(250, { inventory1: 33, inventory2: 42 }).type, COLOSSUS);
  assert.equal(aiAt(300, { inventory1: 33, inventory2: 42 }).type, FAT_KID);
});

test("ladder order: a health potion (arm 2) and molten death (arm 7) come before arms 8 and 9", () => {
  const hurt = { inventory1: 42, inventory2: 5 };
  const battle = staged({ hero: hurt, heroX: 0, foeX: 200 });
  combatantById(battle, "hero").health = 60;
  assert.deepEqual(suggestAction(battle, "hero"), { type: Ss2ActionType.DRINK_POTION, targetId: "hero", itemId: 5 });
  assert.equal(aiAt(200, { inventory1: 33, inventory2: 49 }).type, Ss2ActionType.CAST_DEATH_FROM_ABOVE);
});

test("ladder order: arm 9 comes BEFORE the stamina potion (arm 12)", () => {
  const battle = staged({ hero: { inventory1: 7, inventory2: 33 }, heroX: 0, foeX: 200 });
  combatantById(battle, "hero").resources.staminaleft.value = 30;
  assert.equal(suggestAction(battle, "hero").type, FAT_KID);
  const alone = staged({ hero: { inventory1: 7 }, heroX: 0, foeX: 200 });
  combatantById(alone, "hero").resources.staminaleft.value = 30;
  assert.equal(suggestAction(alone, "hero").type, Ss2ActionType.DRINK_POTION, "the control: without 33 it drinks");
});

test("ladder order: arm 22 is pre-empted by the damage spells (14-18) and by arm 9, and pre-empts boundless (23)", () => {
  assert.notEqual(aiAt(200, { inventory1: 41, inventory2: 35 }).type, BLOODLUST, "a bolt on offer shuts arms 19 onward");
  assert.equal(aiAt(200, { inventory1: 41, inventory2: 33 }).type, FAT_KID, "33 covers all of bloodlust's range");
  assert.equal(aiAt(200, { inventory1: 45, inventory2: 41 }).type, BLOODLUST);
});

test("ladder order: arm 22 pre-empts the gale (24) — a caster holding 41 never gales inside 400", () => {
  const armoured = (hero) => {
    const battle = staged({ hero, heroX: 0, foeX: 200 });
    const resources = combatantById(battle, "hero").resources;
    resources.armourclass_max.value = 20;
    resources.armourclass.value = 2;
    return suggestAction(battle, "hero").type;
  };
  assert.equal(armoured({ inventory1: 38 }), Ss2ActionType.CAST_GALE, "the control: the gale's gate is open");
  assert.equal(armoured({ inventory1: 38, inventory2: 41 }), BLOODLUST);
});

test("ladder order: arm 27 is pre-empted by boundless energy (23) and pre-empts nothing built above it", () => {
  assert.equal(aiAt(600, { inventory1: 40, inventory2: 45 }).type, Ss2ActionType.CAST_BOUNDLESS_ENERGY);
  assert.equal(aiAt(600, { inventory1: 40 }).type, SWIFT);
});

test("a gladiator holding 42 or 33 never teleports: the teleport's own gate implies theirs", () => {
  const battle = staged({ hero: { inventory1: 48, inventory2: 33 }, heroX: 0, foeX: 200 });
  combatantById(battle, "hero").health = 60;
  assert.equal(suggestAction(battle, "hero").type, FAT_KID);
});

/* ------------------------------------------------------------------ *
 * What the merge made meet: the bearer's-turn tick rule and rejuvenate *
 * ------------------------------------------------------------------ */

/** A 2v2 in the fixed order hero, foe1, ally, foe2 (speeds 24, 23, 22, 21). */
function stagedTeams({ hero = {}, ally = {}, foe1 = {}, foe2 = {} } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [
        ss2Combatant(fields({ speed: 24, ...hero }), { id: "hero", name: "hero", controller: "local" }),
        ss2Combatant(fields({ speed: 22, ...ally }), { id: "ally", name: "ally", controller: "local" })
      ] },
      { id: "blue", name: "blue", combatants: [
        ss2Combatant(fields({ speed: 23, gladiator_dir: "left", ...foe1 }), { id: "foe1", name: "foe1", controller: "local" }),
        ss2Combatant(fields({ speed: 21, gladiator_dir: "left", ...foe2 }), { id: "foe2", name: "foe2", controller: "local" })
      ] }
    ]
  });
  assert.deepEqual(battle.initiative, ["hero", "foe1", "ally", "foe2"]);
  return battle;
}

/** Cast bloodlust on the hero's first turn, rest everybody, and record the buff's run. */
function bloodlustRun(battle, phases) {
  let ownTurnsBuffed = 0;
  let expiredAt = null;
  let expiredOn = null;
  for (let phase = 0; phase < phases; phase += 1) {
    const actorId = currentCombatant(battle).id;
    if (phase > 0 && actorId === "hero" && statOf(battle, "hero", "strength") === 24) ownTurnsBuffed += 1;
    if (phase === 0) cast(battle, BLOODLUST); else rest(battle, actorId);
    if (expiredAt === null && statOf(battle, "hero", "strength") === 9) {
      expiredAt = phase;
      expiredOn = actorId;
    }
  }
  return { ownTurnsBuffed, expiredAt, expiredOn };
}

test("UNDER THE BEARER'S-TURN RULE a stat buff runs the same number of its bearer's own turns in 2v2 as in 1v1", () => {
  // 1v1: the build's own schedule — 19, 18, … — expiring on the 20th nextphase (the foe's phase 19).
  assert.deepEqual(bloodlustRun(staged({ hero: { inventory1: 41 } }), 24),
    { ownTurnsBuffed: 9, expiredAt: 19, expiredOn: "foe" });
  // 2v2: every bearer cycle still costs two ticks (its own phase and the next one anybody
  // completes), so the buff covers the same nine later turns of the hero's and expires on
  // the phase straight after its tenth — foe1's phase 37 — as 1v1's did on the foe's.
  const teams = stagedTeams({ hero: { inventory1: 41 } });
  assert.deepEqual(bloodlustRun(teams, 44), { ownTurnsBuffed: 9, expiredAt: 37, expiredOn: "foe1" });
  assert.equal(valueOf(teams, "hero", "spell_bloodlust"), -1);
  assert.equal(statOf(teams, "hero", "defense"), 5);
});

test("little fat kid in 2v2 on a victim NOT owed a tick: the arm's 16 lands UNTICKED; on an owed one it ticks", () => {
  // Phases 0-3 are rests. Each foe's clock is set by its own phase and paid by the next one
  // anybody completes: after them foe1 is paid (ally's phase 2) and foe2 is owed (its phase 3).
  const cycled = () => {
    const battle = stagedTeams({ hero: { inventory1: 33 } });
    for (let phase = 0; phase < 4; phase += 1) rest(battle);
    assert.equal(currentCombatant(battle).id, "hero");
    assert.equal(valueOf(battle, "foe1", "timed_spell_tick_owed"), 0);
    assert.equal(valueOf(battle, "foe2", "timed_spell_tick_owed"), 1);
    return battle;
  };
  const unowed = cycled();
  cast(unowed, FAT_KID, "hero", "foe1");
  assert.equal(valueOf(unowed, "foe1", "spell_little_fat_kid"), 16, "written as the arm left it");
  assert.equal(unowed.events.at(-1).counterAfter, 16);
  assert.equal(statOf(unowed, "foe1", "strength"), 5, "the halving lands either way");
  assert.equal(valueOf(unowed, "foe1", "timed_spell_tick_owed"), 0, "and nobody paid a tick it was not owed");
  const owed = cycled();
  cast(owed, FAT_KID, "hero", "foe2");
  assert.equal(valueOf(owed, "foe2", "spell_little_fat_kid"), 15, "ticked in the phase that wrote it");
  assert.equal(owed.events.at(-1).counterAfter, 15);
  assert.equal(valueOf(owed, "foe2", "timed_spell_tick_owed"), 0, "and the tick is paid");
});

test("ARM 1 PRE-EMPTS 8, 9, 22 AND 27: a holder of 43 below the 1.5 line rejuvenates whichever it also holds", () => {
  for (const [itemId, type, distance] of [[42, COLOSSUS, 200], [33, FAT_KID, 200], [41, BLOODLUST, 200], [40, SWIFT, 400]]) {
    const battle = staged({ hero: { inventory1: 43, inventory2: itemId }, heroX: 0, foeX: distance });
    const hero = combatantById(battle, "hero");
    hero.health = 113; // 170 / 1.5 = 113.3…, strictly below
    assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_REJUVINATE, `${type}`);
    hero.health = 114;
    assert.equal(suggestAction(battle, "hero").type, type, `${type}: above the line, its own arm fires`);
  }
});

test("REJUVENATE DOES NOT TOUCH A BUFFED STAT: its arm writes pools and pieces only", () => {
  const battle = staged({ hero: { inventory1: 41, inventory2: 43 } });
  cast(battle, BLOODLUST);
  rest(battle, "foe");
  combatantById(battle, "hero").health = 50;
  cast(battle, Ss2ActionType.CAST_REJUVINATE);
  assert.equal(combatantById(battle, "hero").health, 170, "the rejuvenate itself happened");
  assert.equal(statOf(battle, "hero", "strength"), 24);
  assert.equal(statOf(battle, "hero", "defense"), 3);
  assert.deepEqual(lastResolvedAction(battle).effects.filter((effect) => effect.kind === EffectKind.STAT), []);
  assert.equal(valueOf(battle, "hero", "spell_bloodlust"), 17, "and the buff's counter runs on");
});

/* ------------------------------------------------------------------ *
 * The AI's own estimates read the LIVE damage too (Codex, 2026-09-22)  *
 * ------------------------------------------------------------------ */

test("the wind-up's survival check prices a colossus-buffed foe at its LIVE damage, not its fight-start one", () => {
  // Reproduced before it was fixed (Codex finding 1): hero 190 HP, foe strength 20, weapon 1.
  // Fight-start max_damage is round(2 * 20) + 9 = 49; after colossus (strength 60) it is 120 + 9 = 129.
  // Three presses: 147 fight-start (survivable) against 387 live (not).
  const wound = (foeItem) => {
    const battle = staged({
      rules: createSs2TeamRules({ aiCharges: true }),
      // herolevel 7 is the psyche button's own gate; 7 * 10 + 6 * 20 = 190 hitpoints.
      hero: { herolevel: 7, psyche_up: 1 },
      foe: { strength: 20, inventory1: foeItem }
    });
    rest(battle, "hero");
    if (foeItem === 42) cast(battle, COLOSSUS, "foe"); else rest(battle, "foe");
    const hero = combatantById(battle, "hero");
    assert.equal(hero.maxHealth, 190);
    assert.equal(hero.health, 190, "an unwounded gladiator is the one the trait winds up");
    return { battle, choice: suggestAction(battle, "hero").type };
  };
  const control = wound(SS2_INVENTORY_EMPTY);
  assert.equal(ss2ActiveDamagePair(combatantById(control.battle, "foe")).max_damage, 49);
  assert.equal(control.choice, Ss2ActionType.PSYCHE_UP, "the control: 3 x 49 = 147 < 190, so it winds up");
  const buffed = wound(42);
  assert.equal(ss2ActiveDamagePair(combatantById(buffed.battle, "foe")).max_damage, 129);
  assert.notEqual(buffed.choice, Ss2ActionType.PSYCHE_UP, "3 x 129 = 387 > 190: the wind-up does not survive");
});

test("the taunt's denial term prices a buffed foe's turn at its LIVE max_damage, and an undeclared one at 0", () => {
  // The flee arm scores only against a target in bow mode; the proxy is its melee max_damage.
  const battle = staged({ foe: { strength: 20, inventory1: 42 } });
  const foe = combatantById(battle, "foe");
  foe.resources.equipped_weapon.value = 2;
  const chances = { taunt: 100 };
  const before = ss2TauntValue(combatantById(battle, "hero"), foe, chances);
  rest(battle, "hero");
  cast(battle, COLOSSUS, "foe");
  assert.equal(statOf(battle, "foe", "strength"), 60);
  const after = ss2TauntValue(combatantById(battle, "hero"), foe, chances);
  // round(2 * 60) - round(2 * 20) = +80 on the proxy, split over the taunt's effects.
  assert.equal(after - before, 80 / SS2_TAUNT.effectMax);
  // The fallback is kept: a target that declares no damage pair still scores 0 there.
  const bare = { ...foe, resources: Object.fromEntries(Object.entries(foe.resources).filter(([name]) => name !== "max_damage")) };
  const hero = combatantById(battle, "hero");
  assert.equal(ss2TauntValue(hero, bare, chances) - ss2TauntValue(hero, { ...bare, resources: { ...bare.resources, equipped_weapon: { value: 1, min: 0, max: null } } }, chances), 0);
});

/* ------------------------------------------------------------------ *
 * A counter declared with bounds it cannot live in (Codex, 2026-09-22) *
 * ------------------------------------------------------------------ */

/** A raw blueprint — `ss2Combatant`'s output with resources added past it — carrying 41 and 42. */
function rawBlueprint(extra, { items = { inventory1: 41, inventory2: 42 } } = {}) {
  const hero = ss2Combatant(fields({ speed: 21, ...items }), { id: "hero", name: "hero", controller: "local" });
  hero.resources = { ...hero.resources, timed_spell_tick_owed: 1, ...extra };
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [hero] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: "left" }), { id: "foe", name: "foe", controller: "local" })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: 60, y: 200 });
  return battle;
}

test("A STAT COUNTER DECLARED AS SHORTHAND 0 IS REFUSED: its floor of 0 cannot hold the expiry's -1", () => {
  // Reproduced before it was refused (Codex): `spell_bloodlust: 0` normalises to `min: 0`, so the
  // expiry's -1 clamped back to 0 and restored on EVERY tick — a colossus cast then read strength
  // 27 and was put back to 9 in the same phase, its own counter still running at 15.
  assert.throws(() => rawBlueprint({ spell_bloodlust: 0 }),
    (error) => /spell_bloodlust/.test(error.message) && /-1/.test(error.message) && /20/.test(error.message));
  assert.throws(() => rawBlueprint({ spell_colossus: { value: -1, min: -1, max: 10 } }),
    (error) => /spell_colossus/.test(error.message) && /16/.test(error.message), "a ceiling below the duration too");
  // The same refusal off an UN-normalised source, which is what the adapter's
  // `compareMaximumHealth` hands `maximumHealth`: the bare number means a floor of 0 there too.
  const source = ss2Combatant(fields({ inventory1: 41 }), { id: "hero" });
  source.resources = { ...source.resources, timed_spell_tick_owed: 1, spell_bloodlust: 0 };
  assert.throws(() => ss2TeamRules.maximumHealth(source), /spell_bloodlust with bounds \[0, none\]/);
});

test("and a counter declared to hold -1 through its duration is accepted, and an expired one cancels nothing later", () => {
  const battle = rawBlueprint({ spell_bloodlust: { value: -1, min: -1 } });
  rest(battle, "hero");
  rest(battle, "foe");
  assert.equal(valueOf(battle, "hero", "spell_bloodlust"), -1);
  cast(battle, COLOSSUS);
  assert.equal(statOf(battle, "hero", "strength"), 27, "the overlapping colossus holds");
  assert.equal(valueOf(battle, "hero", "spell_colossus"), 15);
});

test("REGENERATE AND BOUNDLESS ENERGY: a floor above 0 or a ceiling below 20 is refused too", () => {
  // Measured before the refusal: `min: 1` held the counter at 1 for ever, so the buff never
  // ended; `max: 10` clamped the arm's 20 to 10, so it ran half as long. Both silently.
  const regen = { inventory1: 46 };
  assert.throws(() => rawBlueprint({ spell_regenerate: { value: 1, min: 1 } }, { items: regen }),
    (error) => /spell_regenerate/.test(error.message));
  assert.throws(() => rawBlueprint({ spell_regenerate: { value: 0, max: 10 } }, { items: regen }),
    (error) => /spell_regenerate/.test(error.message));
  assert.throws(() => rawBlueprint({ spell_boundless_energy: { value: 0, max: 19 } }, { items: { inventory1: 45 } }),
    (error) => /spell_boundless_energy/.test(error.message));
  // Their inert value is 0, so the shorthand `ss2Combatant` itself declares is fine.
  assert.doesNotThrow(() => rawBlueprint({ spell_regenerate: 0 }, { items: regen }));
});
