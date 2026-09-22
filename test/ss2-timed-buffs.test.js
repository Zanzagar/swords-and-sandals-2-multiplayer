/**
 * `cast_regenerate` (id 46) and `cast_boundless_energy` (id 45) — the two timed
 * self-buffs, and the per-phase ticking `nextphase` applies to them.
 *
 * ## WHAT THE BUILD DOES, AND WHERE
 *
 * Derived from the oracle whose sha256 is `77CB545C…`, read 2026-09-22 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f`, block base `0x240c85`.
 *
 * The two cast arms, `+0x8bab` and `+0x8c8a`, are the same shape:
 *
 * ```text
 *   phase_decision == "cast_regenerate"                             +0x8bab
 *     attacker.spell_regenerate = 20            (EVERY tick)        +0x8bbe
 *     register:3.crowd_action = 3                                   +0x8bcf
 *     game_attacker.staminacost = Math.round(game_attacker.magicka) +0x8bdc
 *     if (attacker.struck == null) {                                +0x8c03
 *       cast_spell_icon(attacker, 46)                               +0x8c1a
 *       attacker.struck = false; attacker.gotoAndPlay("Cast2")      +0x8c32-+0x8c54
 *     }
 *     if (attacker.struck == true) { attacker.struck = null; nextphase() }
 * ```
 *
 * (`cast_boundless_energy` is `+0x8c8a`-`+0x8d68`, id 45, counter
 * `spell_boundless_energy`.) No draw, no stat write. `check_spells` decrements
 * each counter while `> 0` and never expires either (`+0x272e`-`+0x278f`), and
 * `nextphase` runs it for the attacker THEN the defender (`+0x3271`, `+0x3289`)
 * before any stamina arithmetic; the two effects come after `check_stats`
 * (`+0x33bd`-`+0x3475` regenerate, `+0x3476`-`+0x3540` boundless) and read the
 * ATTACKER's clip only. So the cast phase itself applies (20 -> 19 > 0), a
 * bearer in strict alternation gains ten times, and boundless energy's gain
 * lands AFTER the floor.
 *
 * ## WHAT IS DECIDED HERE, AND WHOSE
 *
 * - **Every completed phase ticks every LIVING combatant's counters** — the
 *   build's rule exactly in 1v1, where it ticks both fighters. The main
 *   session's decision, the owner's to revisit; see `ss2TimedSpellBystanders`.
 * - **A phase that kills ticks nobody**, because this engine skips the whole
 *   transition on a kill (`death()` deletes `nextphase`), and the dead are
 *   never ticked again.
 * - **The counters are declared by possession as well as by statement**, so a
 *   gladiator who carries the item can hold the counter it writes.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, EffectKind, lastResolvedAction,
  legalActions, suggestAction, toTeamWireState
} from "../src/team/index.js";
import {
  SS2_INVENTORY_EMPTY, SS2_RESOURCE_DEFAULTS, SS2_RESOURCE_NAMES, SS2_TIMED_BUFFS, SS2_WRITTEN_RESOURCES,
  Ss2ActionType, VANILLA_PHASE_LABEL, createSs2TeamRules, ss2Combatant, ss2TeamRules
} from "../src/team/ss2-rules.js";
import {
  buildArenaLayout, CommandKind, LabelProvenance, presentArenaConstruction, presentResolvedEvents,
  SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import { applyCommands, emptyScene, timelineFor } from "../src/render/index.js";

const REGEN = Ss2ActionType.CAST_REGENERATE;
const BOUNDLESS = Ss2ActionType.CAST_BOUNDLESS_ENERGY;
const REGEN_COUNTER = "spell_regenerate";
const BOUNDLESS_COUNTER = "spell_boundless_energy";

/** 170 hitpoints, 160 stamina, magicka 7 and stamina 6 once derived. */
const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

/** A 1v1 with the caster on RED, opening — the teleport test's staging. */
function staged({
  hero = {}, foe = {}, heroX = -60, foeX = 60, controller = "local", rules = ss2TeamRules, rngTape = null
} = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rngTape,
    rules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller })]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller })]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: heroX, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: foeX, y: 200 });
  assert.equal(currentCombatant(battle).id, "hero", "the caster must open for these tests to mean anything");
  return battle;
}

/** A 2v2: hero and ally on red, foe1 and foe2 on blue. Speeds fix the order hero, foe1, ally, foe2. */
function stagedTeams({ hero = {}, ally = {}, foe1 = {}, foe2 = {} } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [
          ss2Combatant(fields({ speed: 24, ...hero }), { id: "hero", name: "hero", controller: "local" }),
          ss2Combatant(fields({ speed: 22, ...ally }), { id: "ally", name: "ally", controller: "local" })
        ]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(fields({ speed: 23, gladiator_dir: "left", ...foe1 }), { id: "foe1", name: "foe1", controller: "local" }),
          ss2Combatant(fields({ speed: 21, gladiator_dir: "left", ...foe2 }), { id: "foe2", name: "foe2", controller: "local" })
        ]
      }
    ]
  });
  assert.equal(currentCombatant(battle).id, "hero");
  return battle;
}

const counterOf = (battle, id, counter) => combatantById(battle, id).resources[counter]?.value;
const offersOf = (battle, type, id = "hero") => legalActions(battle, id).filter((option) => option.type === type);
const cast = (battle, type, actorId = "hero") => applyAction(battle, { actorId, type, targetId: actorId });
const rest = (battle, actorId = currentCombatant(battle).id) =>
  applyAction(battle, { actorId, type: Ss2ActionType.REST, targetId: actorId });
const effectsOn = (battle, id) => lastResolvedAction(battle).effects.filter((effect) => effect.targetId === id);
const heals = (battle, id) => effectsOn(battle, id)
  .filter((effect) => effect.kind === EffectKind.HEAL).map((effect) => effect.amount);

/* ------------------------------------------------------------------ *
 * The vocabulary                                                      *
 * ------------------------------------------------------------------ */

test("the tokens are `cast-regenerate` and `cast-boundless-energy`, and they round-trip to the build's labels", () => {
  assert.equal(REGEN, "cast-regenerate");
  assert.equal(BOUNDLESS, "cast-boundless-energy");
  // `Push constant[320]="cast_regenerate"` at `+0x8bb1`, `constant[321]="cast_boundless_energy"`
  // at `+0x8c90`; the decisions ladder arms 3 and 23 write (`+0x06d7`, `+0x0e0f`).
  assert.equal(VANILLA_PHASE_LABEL[REGEN], "cast_regenerate");
  assert.equal(VANILLA_PHASE_LABEL[BOUNDLESS], "cast_boundless_energy");
  const types = createSs2TeamRules().actionTypes;
  assert.ok(types.includes(REGEN));
  assert.ok(types.includes(BOUNDLESS));
});

test("the constants are the build's literals", () => {
  const regen = SS2_TIMED_BUFFS[REGEN];
  const boundless = SS2_TIMED_BUFFS[BOUNDLESS];
  // `cast_spell_icon(attacker, 46)` `+0x8c1a`, `(attacker, 45)` `+0x8cf9`.
  assert.equal(regen.itemId, 46);
  assert.equal(boundless.itemId, 45);
  // `Push "spell_regenerate", 20; SetMember` `+0x8bc4`, and `+0x8ca3` for boundless.
  assert.equal(regen.counter, "spell_regenerate");
  assert.equal(boundless.counter, "spell_boundless_energy");
  assert.equal(regen.duration, 20);
  assert.equal(boundless.duration, 20);
  // `gotoAndPlay("Cast2")` `+0x8c40` / `+0x8d1f`.
  assert.equal(regen.casterClip, "Cast2");
  assert.equal(boundless.casterClip, "Cast2");
  // `crowd_action = 3`, `+0x8bcf` / `+0x8cae` — recorded, not modelled.
  assert.equal(regen.crowdAction, 3);
  assert.equal(boundless.crowdAction, 3);
  // `round(hitpointsmax / 4)` `+0x33f0`-`+0x3415`; `round(staminamax / 4)` `+0x34a9`-`+0x34ce`.
  assert.equal(regen.divisor, 4);
  assert.equal(boundless.divisor, 4);
  // Ladder arms: 3 (`+0x0681`) and 23 (`+0x0df3`).
  assert.equal(regen.ladderArm, 3);
  assert.equal(boundless.ladderArm, 23);
});

/* ------------------------------------------------------------------ *
 * The counters are resources, with NO default                         *
 * ------------------------------------------------------------------ */

test("both counters are declared resources with NO default, and both are written", () => {
  for (const counter of [REGEN_COUNTER, BOUNDLESS_COUNTER]) {
    assert.ok(SS2_RESOURCE_NAMES.includes(counter), `${counter} must be declarable`);
    assert.equal(Object.hasOwn(SS2_RESOURCE_DEFAULTS, counter), false,
      `${counter} with a default would be filled into every golden's combatant and move all 23 hashes`);
    assert.ok(SS2_WRITTEN_RESOURCES.includes(counter));
  }
});

test("a combatant that neither carries nor states a counter declares neither key — the census's mechanism", () => {
  const plain = ss2Combatant(fields(), { id: "plain" });
  assert.equal(Object.hasOwn(plain.resources, REGEN_COUNTER), false);
  assert.equal(Object.hasOwn(plain.resources, BOUNDLESS_COUNTER), false);
  // And a phase between two such combatants emits no counter write at all.
  const battle = staged();
  rest(battle);
  assert.deepEqual(
    lastResolvedAction(battle).effects.filter((effect) => /^spell_/.test(effect.resource ?? "")), []
  );
});

test("a STATED counter is declared at the stated value; POSSESSION declares it at 0; the other stays absent", () => {
  assert.equal(ss2Combatant(fields({ spell_regenerate: 7 })).resources[REGEN_COUNTER], 7);
  const holder = ss2Combatant(fields({ inventory3: 46 }));
  assert.equal(holder.resources[REGEN_COUNTER], 0, "carrying id 46 declares spell_regenerate");
  assert.equal(Object.hasOwn(holder.resources, BOUNDLESS_COUNTER), false, "and nothing for id 45");
  const both = ss2Combatant(fields({ inventory1: 45, inventory6: 46 }));
  assert.equal(both.resources[REGEN_COUNTER], 0);
  assert.equal(both.resources[BOUNDLESS_COUNTER], 0);
  // A stated value wins over possession.
  assert.equal(ss2Combatant(fields({ inventory1: 45, spell_boundless_energy: 12 })).resources[BOUNDLESS_COUNTER], 12);
  // The empty marker is not an item.
  assert.equal(Object.hasOwn(ss2Combatant(fields({ inventory1: SS2_INVENTORY_EMPTY })).resources, REGEN_COUNTER), false);
});

/* ------------------------------------------------------------------ *
 * The offer                                                           *
 * ------------------------------------------------------------------ */

test("carrying no item offers neither buff", () => {
  const battle = staged();
  assert.deepEqual(offersOf(battle, REGEN), []);
  assert.deepEqual(offersOf(battle, BOUNDLESS), []);
});

test("each item offers ONE self-targeted cast, from any declared slot", () => {
  assert.deepEqual(offersOf(staged({ hero: { inventory1: 46 } }), REGEN), [{ type: REGEN, targetId: "hero" }]);
  assert.deepEqual(offersOf(staged({ hero: { inventory6: 45 } }), BOUNDLESS), [{ type: BOUNDLESS, targetId: "hero" }]);
  assert.deepEqual(offersOf(staged({ hero: { inventory1: 46 } }), BOUNDLESS), [], "46 is not 45");
});

test("the offer reads no health and no stamina: a full gladiator is offered both", () => {
  const battle = staged({ hero: { inventory1: 46, inventory2: 45 } });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.health, hero.maxHealth);
  assert.equal(offersOf(battle, REGEN).length, 1);
  assert.equal(offersOf(battle, BOUNDLESS).length, 1);
});

test("the slot window applies: id 46 in slot 3 is hidden at maxslots 2 and offered at 3", () => {
  assert.equal(offersOf(staged({ hero: { inventory3: 46, inventory_maxslots: 2 } }), REGEN).length, 0);
  assert.equal(offersOf(staged({ hero: { inventory3: 46, inventory_maxslots: 3 } }), REGEN).length, 1);
});

test("a combatant carrying the item but NOT declaring the counter is not offered it", () => {
  // Built without `ss2Combatant`, so possession did not declare the counter:
  // the resolver would refuse the write mid-list, so the button must not exist.
  const raw = ss2Combatant(fields({ inventory1: 46 }), { id: "hero", name: "hero", controller: "local" });
  delete raw.resources[REGEN_COUNTER];
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [{ ...raw, stats: { ...raw.stats, agility: 21 } }] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields(), { id: "foe", name: "foe", controller: "local" })] }
    ]
  });
  assert.deepEqual(offersOf(battle, REGEN), []);
});

test("a combatant STATING a counter but carrying no item is not offered the cast — possession is the gate", () => {
  const battle = staged({ hero: { spell_regenerate: 0, spell_boundless_energy: 4, inventory1: SS2_INVENTORY_EMPTY } });
  assert.deepEqual(offersOf(battle, REGEN), []);
  assert.deepEqual(offersOf(battle, BOUNDLESS), []);
});

test("the cast is refused when aimed at anybody but the caster", () => {
  const battle = staged({ hero: { inventory1: 46 } });
  assert.throws(() => applyAction(battle, { actorId: "hero", type: REGEN, targetId: "foe" }), /Illegal action/);
});

test("a forced rest still outranks both buffs", () => {
  const battle = staged({ hero: { inventory1: 46, inventory2: 45 } });
  combatantById(battle, "hero").resources.staminaleft.value = 0;
  assert.deepEqual(legalActions(battle, "hero").map((option) => option.type), [Ss2ActionType.REST]);
});

/* ------------------------------------------------------------------ *
 * The cast phase                                                      *
 * ------------------------------------------------------------------ */

test("a cast takes ZERO samples", () => {
  for (const [type, itemId] of [[REGEN, 46], [BOUNDLESS, 45]]) {
    const battle = staged({ hero: { inventory1: itemId } });
    const before = battle.rng.cursor;
    cast(battle, type);
    assert.equal(battle.rng.cursor, before, `${type} leaves the ordered channel untouched`);
  }
});

test("the cast consumes the slot, and the counter it leaves is 19 — the cast phase has already ticked it", () => {
  for (const [type, itemId, counter] of [[REGEN, 46, REGEN_COUNTER], [BOUNDLESS, 45, BOUNDLESS_COUNTER]]) {
    const battle = staged({ hero: { inventory2: itemId } });
    cast(battle, type);
    assert.equal(counterOf(battle, "hero", "inventory2"), SS2_INVENTORY_EMPTY);
    assert.equal(counterOf(battle, "hero", counter), 19, "the arm writes 20 and nextphase decrements before the test");
    assert.deepEqual(offersOf(battle, type), [], "the slot is spent, so the offer goes with it");
  }
});

test("the cost is round(magicka), the STAT, and the arm writes no stat of its own", () => {
  // magicka 7.5 rounds to 8; the transition adds 1 + round(6 / 3) = 3.
  const battle = staged({ hero: { inventory1: 46, magicka: 7.5 } });
  cast(battle, REGEN);
  assert.equal(counterOf(battle, "hero", "staminaleft"), 160 - 8 + 3);
  const event = battle.events.at(-1);
  assert.equal(event.staminaSpent, 8);
});

test("the event names Cast2 on the caster, no victim clip, the item and the counter", () => {
  const battle = staged({ hero: { inventory4: 45 } });
  cast(battle, BOUNDLESS);
  const event = battle.events.at(-1);
  assert.equal(event.type, BOUNDLESS);
  assert.equal(event.actorId, "hero");
  assert.equal(event.targetId, "hero");
  assert.equal(event.vanillaLabel, "cast_boundless_energy");
  assert.equal(event.casterClip, "Cast2");
  assert.equal(Object.hasOwn(event, "victimClip"), false, "the arm plays nothing on anybody else");
  assert.equal(event.spellId, 45);
  assert.equal(event.consumedSlot, "inventory4");
  assert.equal(event.counter, BOUNDLESS_COUNTER);
  assert.equal(event.counterSet, 20);
  assert.equal(event.counterAfter, 19);
});

test("nobody else is touched by the arm: the foe keeps its x, health, stamina and armour", () => {
  const battle = staged({ hero: { inventory1: 46 } });
  const foe = combatantById(battle, "foe");
  const before = { x: foe.x, health: foe.health, stamina: foe.resources.staminaleft.value, armour: foe.resources.armourclass.value };
  cast(battle, REGEN);
  assert.deepEqual(effectsOn(battle, "foe"), [], "the foe declares no counter, so there is nothing of his to tick");
  assert.deepEqual(
    { x: foe.x, health: foe.health, stamina: foe.resources.staminaleft.value, armour: foe.resources.armourclass.value },
    before
  );
});

/* ------------------------------------------------------------------ *
 * Ticking and applying, phase by phase                               *
 * ------------------------------------------------------------------ */

test("TEN applications in strict alternation, at 19, 17, …, 1, with the exact counter after every phase", () => {
  const battle = staged({ hero: { inventory1: 46 } });
  const hero = combatantById(battle, "hero");
  const counters = [];
  const applied = [];
  for (let phase = 0; phase < 24; phase += 1) {
    const actorId = currentCombatant(battle).id;
    assert.equal(actorId, phase % 2 === 0 ? "hero" : "foe", "strict alternation");
    // Headroom on every hero phase, so an application is always visible.
    if (actorId === "hero") hero.health = 1;
    if (phase === 0) cast(battle, REGEN); else rest(battle, actorId);
    counters.push(counterOf(battle, "hero", REGEN_COUNTER));
    // The regeneration is its own HEAL, after `nextphase`'s own (and a rest's).
    applied.push(heals(battle, "hero").includes(43));
  }
  assert.deepEqual(counters, [
    19, 18, 17, 16, 15, 14, 13, 12, 11, 10,
    9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
    0, 0, 0, 0
  ]);
  const heroPhasesApplied = applied.filter((wasApplied, phase) => phase % 2 === 0 && wasApplied).length;
  assert.equal(heroPhasesApplied, 10, "ten applications, the first on the cast phase itself");
  assert.deepEqual(applied.map((wasApplied, phase) => (wasApplied ? phase : null)).filter((p) => p !== null),
    [0, 2, 4, 6, 8, 10, 12, 14, 16, 18], "on the bearer's own phases only, and never at 0");
});

test("the regeneration is round(hitpointsmax / 4), AFTER nextphase's own heal, as a second HEAL", () => {
  const battle = staged({ hero: { inventory1: 46 } });
  combatantById(battle, "hero").health = 50;
  cast(battle, REGEN);
  // 1 + ceil(6 / 2) = 4 first, then round(170 / 4) = round(42.5) = 43 — the
  // build's `Math.round`, which rounds the half UP.
  assert.deepEqual(heals(battle, "hero"), [4, 43]);
  assert.equal(combatantById(battle, "hero").health, 97);
  assert.equal(battle.events.at(-1).healed, 47, "the event's `healed` is everything nextphase healed");
});

test("regeneration is CLAMPED at the maximum, by the build's check_stats", () => {
  const battle = staged({ hero: { inventory1: 46 } });
  combatantById(battle, "hero").health = 160;
  cast(battle, REGEN);
  assert.deepEqual(heals(battle, "hero"), [4, 6], "164 after nextphase's heal, and only 6 of 43 fits");
  assert.equal(combatantById(battle, "hero").health, 170);
});

test("at full health regeneration emits nothing to heal", () => {
  const battle = staged({ hero: { inventory1: 46 } });
  cast(battle, REGEN);
  assert.deepEqual(heals(battle, "hero"), []);
  assert.equal(counterOf(battle, "hero", REGEN_COUNTER), 19, "it still ticks");
});

test("BOUNDLESS ENERGY LANDS AFTER THE FLOOR: 5 left, cost 30, stamina 6, max 160 ends at 40, not 18", () => {
  const battle = staged({ hero: { inventory1: 45, magicka: 30 } });
  combatantById(battle, "hero").resources.staminaleft.value = 5;
  cast(battle, BOUNDLESS);
  // 5 - 30 + 1 + round(6 / 3) = -22, floored to 0 by check_stats, THEN
  // + round(160 / 4) = 40. One clamp over the sum would give -22 + 40 = 18.
  assert.equal(counterOf(battle, "hero", "staminaleft"), 40);
  const writes = effectsOn(battle, "hero")
    .filter((effect) => effect.resource === "staminaleft").map((effect) => effect.to);
  assert.deepEqual(writes, [0, 40], "the floor, then the gain — two writes in the build's order");
  assert.equal(battle.events.at(-1).staminaGained, 35);
});

test("the same caster casting REGENERATE instead floors at 0 and stays there", () => {
  const battle = staged({ hero: { inventory1: 46, magicka: 30 } });
  combatantById(battle, "hero").resources.staminaleft.value = 5;
  cast(battle, REGEN);
  assert.equal(counterOf(battle, "hero", "staminaleft"), 0);
});

test("boundless energy is clamped at staminamax", () => {
  const battle = staged({ hero: { inventory1: 45 } });
  cast(battle, BOUNDLESS);
  // 160 - 7 + 3 = 156, + 40 clamps to 160.
  assert.equal(counterOf(battle, "hero", "staminaleft"), 160);
});

test("a RECAST RESETS to 20 and never stacks", () => {
  const battle = staged({ hero: { inventory1: 46, inventory2: 46 } });
  cast(battle, REGEN);
  rest(battle, "foe");
  assert.equal(counterOf(battle, "hero", REGEN_COUNTER), 18);
  cast(battle, REGEN);
  assert.equal(counterOf(battle, "hero", REGEN_COUNTER), 19, "20 again, ticked once — not 18 + 20");
});

test("BOTH fighters' counters tick on EVERY phase, whoever acts", () => {
  const battle = staged({ hero: { inventory1: 46 }, foe: { spell_boundless_energy: 6 } });
  cast(battle, REGEN);
  assert.equal(counterOf(battle, "hero", REGEN_COUNTER), 19);
  assert.equal(counterOf(battle, "foe", BOUNDLESS_COUNTER), 5, "the defender's counter ticks in the caster's phase");
  rest(battle, "foe");
  assert.equal(counterOf(battle, "hero", REGEN_COUNTER), 18, "and the caster's ticks in the foe's");
  assert.equal(counterOf(battle, "foe", BOUNDLESS_COUNTER), 4);
});

test("the attacker is ticked BEFORE the defender, and both before the stamina arithmetic", () => {
  const battle = staged({ hero: { inventory1: 46 }, foe: { spell_boundless_energy: 6 } });
  cast(battle, REGEN);
  const effects = lastResolvedAction(battle).effects;
  const index = (predicate) => effects.findIndex(predicate);
  const heroTick = index((effect) => effect.targetId === "hero" && effect.resource === REGEN_COUNTER);
  const foeTick = index((effect) => effect.targetId === "foe" && effect.resource === BOUNDLESS_COUNTER);
  const stamina = index((effect) => effect.targetId === "hero" && effect.resource === "staminaleft");
  assert.ok(heroTick >= 0 && foeTick > heroTick && stamina > foeTick,
    `check_spells(attacker), check_spells(defender), then staminaleft: ${JSON.stringify(effects)}`);
});

test("THE EFFECT APPLIES ONLY TO THE ACTOR: a ticking bystander gains nothing on somebody else's phase", () => {
  const battle = staged({ foe: { spell_boundless_energy: 6 } });
  const foe = combatantById(battle, "foe");
  foe.resources.staminaleft.value = 5;
  foe.health = 50;
  rest(battle, "hero");
  assert.equal(foe.resources.staminaleft.value, 5, "the foe's boundless energy does nothing on the hero's rest");
  assert.equal(foe.health, 50);
  assert.deepEqual(effectsOn(battle, "foe"), [
    { kind: EffectKind.RESOURCE, targetId: "foe", resource: BOUNDLESS_COUNTER, to: 5 }
  ], "the tick is the only thing that happens to a bystander");
});

test("on its OWN phase a ticking bearer gains exactly round(staminamax / 4) on top of the ordinary transition", () => {
  const withBuff = staged({ foe: { spell_boundless_energy: 6 } });
  const control = staged({ foe: { spell_boundless_energy: 0 } });
  for (const battle of [withBuff, control]) {
    combatantById(battle, "foe").resources.staminaleft.value = 5;
    rest(battle, "hero");
    rest(battle, "foe");
  }
  // A rest: 5 + round(6 * 15) + 6 + 1 + round(6 / 3) = 104 in the control.
  assert.equal(counterOf(control, "foe", "staminaleft"), 104);
  assert.equal(counterOf(withBuff, "foe", "staminaleft"), 144);
  assert.equal(counterOf(withBuff, "foe", BOUNDLESS_COUNTER), 4, "ticked on the hero's phase and on its own");
});

test("a counter at 0 is left alone — check_spells decrements only while > 0 — and applies nothing", () => {
  const battle = staged({ hero: { spell_regenerate: 0 } });
  combatantById(battle, "hero").health = 50;
  rest(battle, "hero");
  assert.equal(counterOf(battle, "hero", REGEN_COUNTER), 0);
  assert.deepEqual(effectsOn(battle, "hero").filter((effect) => effect.resource === REGEN_COUNTER), []);
  assert.deepEqual(heals(battle, "hero"), [13], "a rest's own 3 + ceil(6) and nextphase's 4, nothing more");
});

test("a STATED counter of 1 applies once on the bearer's phase and then runs out", () => {
  const battle = staged({ hero: { spell_regenerate: 1 } });
  combatantById(battle, "hero").health = 50;
  rest(battle, "hero");
  assert.equal(counterOf(battle, "hero", REGEN_COUNTER), 0);
  assert.deepEqual(heals(battle, "hero"), [13], "1 ticks to 0 BEFORE the test, so nothing is applied");
});

test("a STATED counter of 2 applies on the bearer's phase (2 -> 1 > 0)", () => {
  const battle = staged({ hero: { spell_regenerate: 2 } });
  combatantById(battle, "hero").health = 50;
  rest(battle, "hero");
  assert.equal(counterOf(battle, "hero", REGEN_COUNTER), 1);
  assert.deepEqual(heals(battle, "hero"), [13, 43]);
});

/* ------------------------------------------------------------------ *
 * The team rule: every completed phase ticks every LIVING combatant  *
 * ------------------------------------------------------------------ */

test("2v2: ONE phase ticks all four combatants' counters, and applies only to the actor", () => {
  const counters = { spell_regenerate: 5 };
  const battle = stagedTeams({ hero: counters, ally: counters, foe1: counters, foe2: counters });
  for (const id of ["hero", "ally", "foe1", "foe2"]) combatantById(battle, id).health = 50;
  rest(battle, "hero");
  for (const id of ["hero", "ally", "foe1", "foe2"]) {
    assert.equal(counterOf(battle, id, REGEN_COUNTER), 4, `${id} ticks on the hero's phase`);
  }
  assert.deepEqual(heals(battle, "hero"), [13, 43], "the actor regenerates");
  for (const id of ["ally", "foe1", "foe2"]) {
    assert.equal(combatantById(battle, id).health, 50, `${id} does not`);
  }
  // And the next phase — somebody else's — ticks all four again.
  const next = currentCombatant(battle).id;
  assert.notEqual(next, "hero");
  rest(battle, next);
  for (const id of ["hero", "ally", "foe1", "foe2"]) assert.equal(counterOf(battle, id, REGEN_COUNTER), 3);
});

test("2v2: because every phase ticks the field, a cast APPLIES five times (19, 15, 11, 7, 3), not ten", () => {
  const battle = stagedTeams({ hero: { inventory1: 46 } });
  const hero = combatantById(battle, "hero");
  const appliedAt = [];
  for (let phase = 0; phase < 24; phase += 1) {
    const actorId = currentCombatant(battle).id;
    if (actorId === "hero") hero.health = 1;
    if (phase === 0) cast(battle, REGEN); else rest(battle, actorId);
    if (actorId === "hero" && heals(battle, "hero").includes(43)) appliedAt.push(counterOf(battle, "hero", REGEN_COUNTER));
  }
  assert.deepEqual(appliedAt, [19, 15, 11, 7, 3]);
});

test("A PHASE THAT KILLS TICKS NOBODY, and the dead are never ticked again", () => {
  // A frightning bolt is 200-400 against 170 unarmoured hitpoints: it cannot
  // fail to kill. This engine skips the whole transition on a kill, as
  // `death()` deletes `nextphase` in the build, so `check_spells` never runs.
  const counters = { spell_regenerate: 5 };
  const battle = stagedTeams({ hero: { ...counters, inventory1: 35 }, ally: counters, foe1: counters, foe2: counters });
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.CAST_FRIGHTNING_BOLT, targetId: "foe1" });
  assert.equal(combatantById(battle, "foe1").alive, false, "the bolt killed");
  for (const id of ["hero", "ally", "foe1", "foe2"]) {
    assert.equal(counterOf(battle, id, REGEN_COUNTER), 5, `${id} is not ticked by a killing phase`);
  }
  rest(battle);
  for (const id of ["hero", "ally", "foe2"]) assert.equal(counterOf(battle, id, REGEN_COUNTER), 4, `${id} lives`);
  assert.equal(counterOf(battle, "foe1", REGEN_COUNTER), 5, "the dead keep what they had");
});

test("1v1: the bearer killed as a DEFENDER keeps its counter — the killing phase ran no nextphase", () => {
  const battle = staged({ hero: { inventory1: 35 }, foe: { spell_boundless_energy: 9 } });
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.CAST_FRIGHTNING_BOLT, targetId: "foe" });
  assert.equal(combatantById(battle, "foe").alive, false);
  assert.equal(counterOf(battle, "foe", BOUNDLESS_COUNTER), 9);
});

test("every kind of completed phase ticks: a walk, a swap, a shove, a drink, a gale and a teleport", () => {
  // One counter on the FOE, which never acts here, so each verb's own tick of
  // it is the whole of the change.
  const walked = staged();
  const walk = legalActions(walked, "hero").find((option) =>
    option.type === Ss2ActionType.WALK_LEFT || option.type === Ss2ActionType.WALK_RIGHT);
  assert.ok(walk, "the close frame wires one walk");
  const verbs = [
    { hero: {}, action: { type: walk.type, targetId: "hero" } },
    { hero: { secondary_weapon: 61, speed: 21 }, action: { type: Ss2ActionType.SWAP_WEAPONS, targetId: "hero" } },
    { hero: {}, action: { type: Ss2ActionType.SHOVE, targetId: "foe" } },
    { hero: { inventory1: 2 }, action: { type: Ss2ActionType.DRINK_POTION, targetId: "hero", itemId: 2 } },
    { hero: { inventory1: 38 }, action: { type: Ss2ActionType.CAST_GALE, targetId: "foe" } },
    { hero: { inventory1: 48 }, action: { type: Ss2ActionType.CAST_TELEPORT, targetId: "hero" } }
  ];
  for (const { hero, action } of verbs) {
    const battle = staged({ hero, foe: { spell_regenerate: 7 } });
    const offered = legalActions(battle, "hero").some((option) =>
      option.type === action.type && option.targetId === action.targetId && (option.itemId ?? null) === (action.itemId ?? null));
    assert.ok(offered, `${action.type} must be offered for this test to mean anything`);
    applyAction(battle, { actorId: "hero", ...action });
    assert.equal(counterOf(battle, "foe", REGEN_COUNTER), 6, `${action.type} is a completed phase`);
  }
});

test("a TAUNT ticks the field on every outcome that completes the phase, and a LETHAL strike ticks nobody", () => {
  // The taunt computes a transition BEFORE its roll and, on a strike, falls
  // through to the dispatcher, which computes its own; this sweeps all of its
  // paths. It cannot catch a DOUBLED transition, and says so: both would read
  // the same frozen view and write the same absolute 6, so one tick is
  // structural here rather than tested.
  const outcomes = new Set();
  for (let seed = 1; seed <= 60; seed += 1) {
    const battle = createTeamBattle({
      seed,
      rules: ss2TeamRules,
      teams: [
        { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, charisma: 60 }), { id: "hero", name: "hero", controller: "local" })] },
        // A deep hitpoint pool, so a strike can land without killing.
        { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: "left", vitality: 60, spell_regenerate: 7 }), { id: "foe", name: "foe", controller: "local" })] }
      ]
    });
    // Out of reach: the taunt is wired on the FAR frame (`legalActions`).
    Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
    Object.assign(combatantById(battle, "foe"), { x: 400, y: 200 });
    applyAction(battle, { actorId: "hero", type: Ss2ActionType.TAUNT, targetId: "foe" });
    const event = battle.events.find((entry) => entry.type === Ss2ActionType.TAUNT);
    const alive = combatantById(battle, "foe").alive;
    outcomes.add(event.landed === false ? "failed"
      : event.attackDirection === 20 ? (alive ? "strike" : "lethal-strike") : `effect-${event.effect}`);
    // A lethal strike runs no transition at all, so it ticks nobody.
    assert.equal(counterOf(battle, "foe", REGEN_COUNTER), alive ? 6 : 7, `seed ${seed}: one tick, never two`);
  }
  assert.ok(outcomes.has("failed") && outcomes.has("strike"),
    `the sweep must reach a failed taunt and a SURVIVED strike; saw ${[...outcomes]}`);
});

test("a status phase ticks too, and a regenerating victim heals after the tick", () => {
  const battle = staged({ hero: { spell_regenerate: 5, burning: true } });
  combatantById(battle, "hero").health = 60;
  const options = legalActions(battle, "hero");
  assert.deepEqual(options.map((option) => option.type), [Ss2ActionType.BURNING_PHASE]);
  applyAction(battle, { actorId: "hero", ...options[0] });
  assert.equal(counterOf(battle, "hero", REGEN_COUNTER), 4);
  assert.ok(heals(battle, "hero").includes(43), "the phase completed, so the regeneration applies");
});

/* ------------------------------------------------------------------ *
 * The presentation                                                    *
 * ------------------------------------------------------------------ */

test("a presented buff plays Cast2 on the caster, MAP_NAMED, and nothing on anybody else, nothing unmapped", () => {
  for (const [type, itemId] of [[REGEN, 46], [BOUNDLESS, 45]]) {
    const battle = staged({ hero: { inventory1: itemId }, foe: { spell_regenerate: 3 } });
    const layoutBefore = buildArenaLayout(toTeamWireState(battle));
    const constructed = applyCommands(emptyScene(), presentArenaConstruction(layoutBefore));
    cast(battle, type);
    const wire = toTeamWireState(battle);
    const { commands } = presentResolvedEvents(wire, { layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS });
    const clips = commands.filter((command) => command.kind === CommandKind.CLIP_GOTO);
    assert.deepEqual(
      clips.map(({ combatantId, role, label, labelProvenance }) => ({ combatantId, role, label, labelProvenance })),
      [{ combatantId: "hero", role: "actor", label: "Cast2", labelProvenance: LabelProvenance.MAP_NAMED }],
      `${type}`
    );
    assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), [], `${type}`);
    assert.deepEqual(commands.filter((command) => command.kind === CommandKind.MOVE_CLIP), [], "nobody moves");
    assert.doesNotThrow(() => applyCommands(constructed, commands));
  }
});

test("Cast2 resolves to a family that can draw it", () => {
  const timeline = timelineFor("Cast2", { role: "actor" });
  assert.equal(timeline.recognised, true);
  assert.equal(timeline.family, "cast");
});

/* ------------------------------------------------------------------ *
 * The AI: `villain_cast_spells`' order, as far as this engine holds it *
 * ------------------------------------------------------------------ */

/** An AI hero at `health` of 170 with a foe in melee reach. */
function aiHero({ health = 170, hero = {}, foe = {}, foeX = 120 } = {}) {
  const battle = staged({ controller: "ai", hero, foe, heroX: 0, foeX });
  const actor = combatantById(battle, "hero");
  assert.equal(actor.maxHealth, 170);
  actor.health = health;
  return battle;
}
const choose = (battle) => suggestAction(battle, "hero");

test("arm 3: carrying 46 below half health, the AI regenerates", () => {
  assert.deepEqual(choose(aiHero({ health: 84, hero: { inventory1: 46 } })), { type: REGEN, targetId: "hero" });
});

test("arm 3 is STRICT: at exactly half (85 of 170) it does not regenerate", () => {
  assert.notEqual(choose(aiHero({ health: 85, hero: { inventory1: 46 } })).type, REGEN);
  assert.notEqual(choose(aiHero({ health: 170, hero: { inventory1: 46 } })).type, REGEN);
});

test("arm 2 PRECEDES arm 3: the id-5 potion, the same test, is drunk first", () => {
  assert.deepEqual(
    choose(aiHero({ health: 60, hero: { inventory1: 46, inventory2: 5 } })),
    { type: Ss2ActionType.DRINK_POTION, targetId: "hero", itemId: 5 }
  );
});

test("arm 3 PRECEDES arms 4-6: regenerate is cast before the 4, 3 and 2 potions", () => {
  for (const potion of [4, 3, 2]) {
    assert.deepEqual(
      choose(aiHero({ health: 60, hero: { inventory1: potion, inventory2: 46 } })),
      { type: REGEN, targetId: "hero" },
      `potion ${potion}`
    );
  }
});

test("arm 23: carrying 45 the AI casts boundless energy on POSSESSION ALONE — full health, foe in reach", () => {
  assert.deepEqual(choose(aiHero({ hero: { inventory1: 45 } })), { type: BOUNDLESS, targetId: "hero" });
  // Without it, the same gladiator swings.
  const swings = [Ss2ActionType.QUICK_ATTACK, Ss2ActionType.NORMAL_ATTACK, Ss2ActionType.POWER_ATTACK];
  assert.ok(swings.includes(choose(aiHero()).type));
});

test("arm 3 PRECEDES arm 23: below half, holding both, it regenerates; above half, boundless", () => {
  assert.equal(choose(aiHero({ health: 60, hero: { inventory1: 45, inventory2: 46 } })).type, REGEN);
  assert.equal(choose(aiHero({ health: 170, hero: { inventory1: 45, inventory2: 46 } })).type, BOUNDLESS);
});

test("arms 14-18 PRECEDE arm 23: a damage spell on offer pre-empts boundless energy", () => {
  assert.notEqual(choose(aiHero({ hero: { inventory1: 45, inventory2: 35 } })).type, BOUNDLESS);
});

test("arms 12-13 PRECEDE arm 23: a stamina potion below half stamina is drunk first", () => {
  const battle = aiHero({ hero: { inventory1: 45, inventory2: 7 } });
  combatantById(battle, "hero").resources.staminaleft.value = 60;
  assert.deepEqual(choose(battle), { type: Ss2ActionType.DRINK_POTION, targetId: "hero", itemId: 7 });
});

test("arm 23 PRECEDES arm 24: boundless energy pre-empts an OPEN gale gate", () => {
  // Gale's gate: 38 carried, fightdistance < 400, armourclass below half its
  // max — staged as the gale test stages it, 60 of 136.
  const battle = aiHero({ hero: { inventory1: 38, inventory2: 45, helmet: 4, breastplate: 6 } });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.resources.armourclass_max.value, 136);
  hero.resources.armourclass.value = 60;
  assert.equal(choose(battle).type, BOUNDLESS);
  combatantById(battle, "hero").resources.inventory2.value = SS2_INVENTORY_EMPTY;
  assert.equal(choose(battle).type, Ss2ActionType.CAST_GALE, "the control: without 45 the gale fires");
});

test("arm 23 PRECEDES arm 26: boundless energy pre-empts an OPEN teleport gate", () => {
  // Teleport's gate: 48 carried, fightdistance < 250, hitpoints below half.
  const battle = aiHero({ health: 84, hero: { inventory1: 48, inventory2: 45 } });
  assert.equal(choose(battle).type, BOUNDLESS);
  combatantById(battle, "hero").resources.inventory2.value = SS2_INVENTORY_EMPTY;
  assert.equal(choose(battle).type, Ss2ActionType.CAST_TELEPORT, "the control: without 45 the teleport fires");
});

test("arm 3 PRECEDES arm 26: regenerate pre-empts an OPEN teleport gate, which tests the SAME half", () => {
  const battle = aiHero({ health: 84, hero: { inventory1: 48, inventory2: 46 } });
  assert.equal(choose(battle).type, REGEN);
  combatantById(battle, "hero").resources.inventory2.value = SS2_INVENTORY_EMPTY;
  assert.equal(choose(battle).type, Ss2ActionType.CAST_TELEPORT, "the control: without 46 the teleport fires");
});

test("arm 3 PRECEDES arm 24: below half, regenerate pre-empts an OPEN gale gate", () => {
  const battle = aiHero({ health: 84, hero: { inventory1: 38, inventory2: 46, helmet: 4, breastplate: 6 } });
  combatantById(battle, "hero").resources.armourclass.value = 60;
  assert.equal(choose(battle).type, REGEN);
  combatantById(battle, "hero").health = 170;
  assert.equal(choose(battle).type, Ss2ActionType.CAST_GALE, "above half the gale's own gate decides");
});

test("the ladder never asks whether a buff is ACTIVE: holding a second 45 it recasts, and resets", () => {
  const battle = aiHero({ hero: { inventory1: 45, inventory2: 45 } });
  applyAction(battle, { actorId: "hero", ...choose(battle) });
  assert.equal(counterOf(battle, "hero", BOUNDLESS_COUNTER), 19);
  rest(battle, "foe");
  assert.deepEqual(choose(battle), { type: BOUNDLESS, targetId: "hero" }, "18 turns of buff left, and it casts anyway");
  applyAction(battle, { actorId: "hero", ...choose(battle) });
  assert.equal(counterOf(battle, "hero", BOUNDLESS_COUNTER), 19);
});

test("the AI takes no sample to decide, so the build's 90% roll is not reproduced", () => {
  const battle = aiHero({ hero: { inventory1: 45 } });
  const before = battle.rng.cursor;
  for (let i = 0; i < 5; i += 1) assert.equal(choose(battle).type, BOUNDLESS);
  assert.equal(battle.rng.cursor, before);
});
