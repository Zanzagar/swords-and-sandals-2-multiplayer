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
 * - **The team-play tick — THE OWNER'S DECISION, 2026-09-22, "bearer's turns,
 *   1v1-exact".** A bearer's counters tick on its OWN completed phase and on
 *   the first phase anybody else completes after it, and on no other, so a
 *   cast applies ten times at every team size and 1v1 is the build phase by
 *   phase. The "owed" fact is the AUTHORED resource `timed_spell_tick_owed`,
 *   declared only beside a timed counter. See `ss2TimedSpellBystanders`.
 *   (Until then — the main session's rule of the same day — every completed
 *   phase ticked every living combatant: ten applications in 1v1, five in 2v2,
 *   four in 3v3.)
 * - **A phase that kills does not exist for the clock**: it ticks nobody
 *   (`death()` deletes `nextphase`), pays no owed tick and earns its actor
 *   none; an owed tick waits for the next COMPLETED phase, an owed bearer that
 *   dies takes it with it, and the dead are never ticked again.
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
/** The engine's own "owes one bystander tick" fact. AUTHORED: the build has no such field. */
const CLOCK = "timed_spell_tick_owed";

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

/** A 3v3. Speeds fix the order hero, foe1, ally, foe2, ally2, foe3. */
function stagedTrios(sides = {}) {
  const make = (id, speed, left) => ss2Combatant(
    fields({ speed, ...(left ? { gladiator_dir: "left" } : {}), ...(sides[id] ?? {}) }),
    { id, name: id, controller: "local" }
  );
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [make("hero", 26, false), make("ally", 24, false), make("ally2", 22, false)] },
      { id: "blue", name: "blue", combatants: [make("foe1", 25, true), make("foe2", 23, true), make("foe3", 21, true)] }
    ]
  });
  assert.deepEqual(battle.initiative, ["hero", "foe1", "ally", "foe2", "ally2", "foe3"]);
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
  // `crowd_action = 3`, `+0x8bcf` / `+0x8cae` — ~~recorded, not modelled~~ MODELLED 2026-09-22 (`test/ss2-crowd.test.js`).
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

/**
 * ► **POSSESSION DECLARES AT THE OPENING, NOT IN `ss2Combatant`'S BAG — moved
 *   2026-09-23.** These two tests used to read the pair straight off
 *   `ss2Combatant(...).resources`. That bag is what a caller hands
 *   `createVanillaBattleHost`, which refuses any name the battle map does not
 *   cite, and the clock is this engine's invention — so the arena's
 *   `?items=buffs` kit could not build at all. The pair is now declared by
 *   `rules.openingResources` (`ss2TimedBuffDeclarations`), and these assert
 *   the BATTLE's combatant, which is where the resolver reads them. A STATED
 *   counter, and the clock beside it, are still the record's, so still the bag's.
 */
const declaredOn = (battle, id, name) => combatantById(battle, id).resources[name]?.value;

test("a STATED counter is declared at the stated value; POSSESSION declares it at 0; the other stays absent", () => {
  assert.equal(ss2Combatant(fields({ spell_regenerate: 7 })).resources[REGEN_COUNTER], 7);
  const holder = staged({ hero: { inventory3: 46 } });
  assert.equal(declaredOn(holder, "hero", REGEN_COUNTER), 0, "carrying id 46 declares spell_regenerate");
  assert.equal(declaredOn(holder, "hero", BOUNDLESS_COUNTER), undefined, "and nothing for id 45");
  assert.equal(declaredOn(holder, "foe", REGEN_COUNTER), undefined, "and nothing on a foe who carries nothing");
  const both = staged({ hero: { inventory1: 45, inventory6: 46 } });
  assert.equal(declaredOn(both, "hero", REGEN_COUNTER), 0);
  assert.equal(declaredOn(both, "hero", BOUNDLESS_COUNTER), 0);
  // A stated value wins over possession.
  assert.equal(declaredOn(staged({ hero: { inventory1: 45, spell_boundless_energy: 12 } }), "hero", BOUNDLESS_COUNTER), 12);
  // The empty marker is not an item.
  assert.equal(declaredOn(staged({ hero: { inventory1: SS2_INVENTORY_EMPTY } }), "hero", REGEN_COUNTER), undefined);
  // And possession no longer reaches the BAG, which is the point of the move.
  assert.equal(Object.hasOwn(ss2Combatant(fields({ inventory3: 46 })).resources, REGEN_COUNTER), false);
});

test("the TICK CLOCK is declared beside any timed counter, at 1 (owed), and nowhere else — no default, so no golden moves", () => {
  assert.ok(SS2_RESOURCE_NAMES.includes(CLOCK), "declarable, so a restored record keeps its value");
  assert.ok(SS2_WRITTEN_RESOURCES.includes(CLOCK));
  assert.equal(Object.hasOwn(SS2_RESOURCE_DEFAULTS, CLOCK), false,
    "a default would be filled into every golden's combatant and move all 23 hashes");
  // Possession of either item declares it at the opening, and a stated counter
  // in the bag — at 1, because before any phase has completed every bearer
  // counts as owed.
  assert.equal(declaredOn(staged({ hero: { inventory2: 46 } }), "hero", CLOCK), 1);
  assert.equal(declaredOn(staged({ hero: { inventory5: 45 } }), "hero", CLOCK), 1);
  assert.equal(ss2Combatant(fields({ spell_regenerate: 7 })).resources[CLOCK], 1);
  // A stated clock wins, as a stated counter does: a restored bout keeps its place.
  assert.equal(ss2Combatant(fields({ spell_regenerate: 7, [CLOCK]: 0 })).resources[CLOCK], 0);
  assert.equal(declaredOn(staged({ hero: { inventory1: 46, spell_regenerate: 7, [CLOCK]: 0 } }), "hero", CLOCK), 0,
    "and the opening does not overwrite it");
  // No counter, no clock — the census's mechanism.
  assert.equal(declaredOn(staged(), "hero", CLOCK), undefined);
  assert.equal(declaredOn(staged(), "foe", CLOCK), undefined);
  assert.equal(declaredOn(staged({ hero: { inventory1: 35 } }), "hero", CLOCK), undefined, "a bolt is not a timed spell");
  // Possession's clock is not the bag's: that bag is what the host checks against the map.
  assert.equal(Object.hasOwn(ss2Combatant(fields({ inventory2: 46 })).resources, CLOCK), false);
});

test("a combatant declaring a timed counter WITHOUT the clock is refused at construction, by name", () => {
  // Built past the rule set's own declarations — the counter declared by hand,
  // with no clock beside it. Without the clock it would never be owed, so its
  // counter would tick on its own phases only and a 1v1 would silently stop
  // being the build. Refused before any draw, not mid-bout: the roster runs
  // this check before the opening could fill the hole.
  const raw = ss2Combatant(fields({ speed: 21, inventory1: 46 }), { id: "hero", name: "hero", controller: "local" });
  raw.resources[REGEN_COUNTER] = 0;
  assert.equal(Object.hasOwn(raw.resources, CLOCK), false);
  assert.throws(() => createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [raw] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields(), { id: "foe", name: "foe", controller: "local" })] }
    ]
  }), /hero declares spell_regenerate but not timed_spell_tick_owed/);
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
  // Built past the opening hook's reach — the counter removed after
  // construction, as `test/ss2-stat-spells.test.js` does for bloodlust. (Until
  // 2026-09-23 this deleted it from `ss2Combatant`'s bag; possession now
  // declares it at the opening, which fills that hole.) The resolver would
  // refuse the write mid-list, so the button must not exist.
  const battle = staged({ hero: { inventory1: 46 } });
  assert.equal(offersOf(battle, REGEN).length, 1, "declared, it is offered");
  delete combatantById(battle, "hero").resources[REGEN_COUNTER];
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
    { kind: EffectKind.RESOURCE, targetId: "foe", resource: BOUNDLESS_COUNTER, to: 5 },
    // Since 2026-09-22 the owed tick is also marked PAID — the engine's own
    // bookkeeping, not a build write. See `ss2TimedSpellBystanders`.
    { kind: EffectKind.RESOURCE, targetId: "foe", resource: CLOCK, to: 0 }
  ], "the tick, and the clock that says it is paid, are the only things that happen to a bystander");
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
 * The team rule (owner, 2026-09-22): a bearer ticks on its own       *
 * completed phase and on the first one anybody completes after it    *
 * ------------------------------------------------------------------ */

test("2v2: the bout's FIRST completed phase ticks all four (everybody starts owed); every later one ticks its actor and the previous actor only", () => {
  const counters = { spell_regenerate: 5 };
  const battle = stagedTeams({ hero: counters, ally: counters, foe1: counters, foe2: counters });
  const ids = ["hero", "foe1", "ally", "foe2"];
  const snapshot = () => Object.fromEntries(ids.map((id) => [id, counterOf(battle, id, REGEN_COUNTER)]));
  const clocks = () => Object.fromEntries(ids.map((id) => [id, counterOf(battle, id, CLOCK)]));
  for (const id of ids) combatantById(battle, id).health = 50;
  assert.deepEqual(clocks(), { hero: 1, foe1: 1, ally: 1, foe2: 1 }, "before any phase, everybody is owed");

  rest(battle, "hero");
  assert.deepEqual(snapshot(), { hero: 4, foe1: 4, ally: 4, foe2: 4 }, "phase 1 pays every opening debt");
  assert.deepEqual(heals(battle, "hero"), [13, 43], "the actor regenerates");
  for (const id of ["ally", "foe1", "foe2"]) assert.equal(combatantById(battle, id).health, 50, `${id} does not`);
  assert.deepEqual(clocks(), { hero: 1, foe1: 0, ally: 0, foe2: 0 }, "now only the hero is owed");

  rest(battle, "foe1");
  assert.deepEqual(snapshot(), { hero: 3, foe1: 3, ally: 4, foe2: 4 }, "foe1's own tick and the hero's owed one");
  assert.deepEqual(clocks(), { hero: 0, foe1: 1, ally: 0, foe2: 0 });

  rest(battle, "ally");
  assert.deepEqual(snapshot(), { hero: 3, foe1: 2, ally: 3, foe2: 4 });

  rest(battle, "foe2");
  assert.deepEqual(snapshot(), { hero: 3, foe1: 2, ally: 2, foe2: 3 });

  // A full round later everybody has ticked exactly twice more: once on its
  // own phase and once on the phase after it.
  for (const id of ids) rest(battle, id);
  assert.deepEqual(snapshot(), { hero: 1, foe1: 0, ally: 0, foe2: 1 });
});

/**
 * Plays `phases` completed phases with nobody dying: the hero casts `type` on
 * phase 0, everyone else rests. Returns the counter after every phase, and the
 * counter at each hero phase that APPLIED the buff.
 */
function playBuff(battle, { type = REGEN, counter = REGEN_COUNTER, phases }) {
  const hero = combatantById(battle, "hero");
  const counters = [];
  const appliedAt = [];
  for (let phase = 0; phase < phases; phase += 1) {
    const actorId = currentCombatant(battle).id;
    // Headroom on every hero phase, so an application is always visible. (Not
    // stamina on the cast phase: at 0 the forced rest would refuse the cast.)
    if (actorId === "hero") {
      hero.health = 1;
      if (phase > 0) hero.resources.staminaleft.value = 0;
    }
    if (phase === 0) cast(battle, type); else rest(battle, actorId);
    counters.push(counterOf(battle, "hero", counter));
    // Regeneration is its own HEAL of round(170 / 4); boundless energy is a
    // SECOND staminaleft write, after the floored one (see the floor test).
    const applied = type === REGEN
      ? heals(battle, "hero").includes(43)
      : effectsOn(battle, "hero").filter((effect) => effect.resource === "staminaleft").length === 2;
    if (actorId === "hero" && applied) appliedAt.push(counterOf(battle, "hero", counter));
  }
  return { counters, appliedAt };
}

test("2v2: a cast APPLIES TEN times (19, 17, …, 1), as in 1v1 — the owner's rule, 2026-09-22", () => {
  // Order hero, foe1, ally, foe2. Five until 2026-09-22 (19, 15, 11, 7, 3),
  // when every phase ticked the whole field.
  for (const [type, counter, itemId] of [[REGEN, REGEN_COUNTER, 46], [BOUNDLESS, BOUNDLESS_COUNTER, 45]]) {
    const { counters, appliedAt } = playBuff(stagedTeams({ hero: { inventory1: itemId } }), { type, counter, phases: 44 });
    assert.deepEqual(appliedAt, [19, 17, 15, 13, 11, 9, 7, 5, 3, 1], type);
    // The bearer ticks on its OWN phase and on the one right after it, and on
    // no other: the ally's and foe2's phases leave it alone.
    assert.deepEqual(counters.slice(0, 9), [19, 18, 18, 18, 17, 16, 16, 16, 15], type);
  }
});

/* ------------------------------------------------------------------ *
 * 1v1 IS THE BUILD, phase by phase — a differential against the rule  *
 * this engine shipped until 2026-09-22 and the build runs              *
 * ------------------------------------------------------------------ */

/**
 * THE OLD POLICY, WHICH IN 1v1 IS THE BUILD: `nextphase` runs `check_spells`
 * for the attacker and then the defender (`+0x3271`, `+0x3289`) on every
 * completed phase, and for these counters `check_spells` is `if (c > 0) c -= 1`
 * (`+0x272e`-`+0x278f`) — applied AFTER whatever the phase's arm wrote. The
 * buff then applies to the ATTACKER when its post-tick counter is `> 0`
 * (`+0x33bd`, `+0x3476`). Written here from the bytes, not from the engine.
 */
function buildPhase(clips, actorId, writes) {
  for (const { id, counter, value } of writes) clips[id][counter] = value;
  for (const id of Object.keys(clips)) {
    for (const counter of Object.keys(clips[id])) if (clips[id][counter] > 0) clips[id][counter] -= 1;
  }
  return { regen: clips[actorId][REGEN_COUNTER] > 0, boundless: clips[actorId][BOUNDLESS_COUNTER] > 0 };
}

/** A 1v1 in which `opener` acts first; both carry two of each item unless told otherwise. */
function duel({ opener = "hero", hero = {}, foe = {} } = {}) {
  const kit = { inventory1: 46, inventory2: 46, inventory3: 45, inventory4: 45 };
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: opener === "hero" ? 21 : 19, ...kit, ...hero }), { id: "hero", name: "hero", controller: "local" })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: "left", ...kit, ...foe }), { id: "foe", name: "foe", controller: "local" })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: 60, y: 200 });
  assert.equal(currentCombatant(battle).id, opener);
  return battle;
}

/**
 * Plays `script` (phase -> { cast?, writeOnDefender? }) for `phases` phases,
 * resting otherwise, and asserts after EVERY phase that both fighters' counters
 * and the actor's two applications equal `buildPhase`'s.
 *
 * `writeOnDefender` stands for a cast arm that writes a counter on the OTHER
 * fighter's clip during the actor's phase — `cast_little_fat_kid`'s
 * `defender.spell_little_fat_kid = 16` (`+0x820b`) is the build's one such
 * arm, and it is not built yet. The value lands before `nextphase`, which is
 * exactly a value staged on the defender just before the phase resolves.
 */
function assertDuelIsTheBuild(battle, options) {
  // Not destructured in the signature: `ss2-assertion-quality.test.js` reads a
  // helper's body from the first brace after its name.
  const { phases, script, label } = options;
  const clips = {};
  for (const id of ["hero", "foe"]) {
    clips[id] = {};
    for (const counter of [REGEN_COUNTER, BOUNDLESS_COUNTER]) clips[id][counter] = counterOf(battle, id, counter);
  }
  for (let phase = 0; phase < phases; phase += 1) {
    const actorId = currentCombatant(battle).id;
    const defenderId = actorId === "hero" ? "foe" : "hero";
    const step = script[phase] ?? {};
    const actor = combatantById(battle, actorId);
    // Headroom for both applications on every phase, so each is visible.
    actor.health = 1;
    actor.resources.staminaleft.value = step.cast ? 100 : 0;
    const writes = [];
    if (step.cast) {
      writes.push({ id: actorId, counter: SS2_TIMED_BUFFS[step.cast].counter, value: SS2_TIMED_BUFFS[step.cast].duration });
    }
    if (step.writeOnDefender) {
      const { counter, value } = step.writeOnDefender;
      combatantById(battle, defenderId).resources[counter].value = value;
      writes.push({ id: defenderId, counter, value });
    }
    if (step.cast) cast(battle, step.cast, actorId); else rest(battle, actorId);
    const expected = buildPhase(clips, actorId, writes);
    for (const id of ["hero", "foe"]) {
      for (const counter of [REGEN_COUNTER, BOUNDLESS_COUNTER]) {
        assert.equal(counterOf(battle, id, counter), clips[id][counter],
          `${label}: ${id}.${counter} after phase ${phase} (${actorId} acting)`);
      }
    }
    const staminaWrites = effectsOn(battle, actorId).filter((effect) => effect.resource === "staminaleft").length;
    assert.equal(heals(battle, actorId).includes(43), expected.regen, `${label}: regeneration on phase ${phase}`);
    assert.equal(staminaWrites === 2, expected.boundless, `${label}: boundless energy on phase ${phase}`);
  }
}

test("1v1 IS THE BUILD: both fighters' counters after EVERY phase, and every application, equal check_spells on both — regenerate", () => {
  assertDuelIsTheBuild(duel(), { phases: 50, label: "regen", script: { 0: { cast: REGEN } } });
  assertDuelIsTheBuild(duel(), { phases: 50, label: "regen, recast at 12", script: { 0: { cast: REGEN }, 12: { cast: REGEN } } });
  assertDuelIsTheBuild(duel(), { phases: 50, label: "regen, foe casts at 1", script: { 1: { cast: REGEN } } });
});

test("1v1 IS THE BUILD: … — boundless energy, and both buffs on both fighters at once", () => {
  assertDuelIsTheBuild(duel(), { phases: 50, label: "boundless", script: { 0: { cast: BOUNDLESS } } });
  assertDuelIsTheBuild(duel(), {
    phases: 60,
    label: "boundless, recast at 10",
    script: { 0: { cast: BOUNDLESS }, 10: { cast: BOUNDLESS } }
  });
  assertDuelIsTheBuild(duel(), {
    phases: 70,
    label: "all four casts, interleaved",
    script: { 0: { cast: REGEN }, 3: { cast: BOUNDLESS }, 6: { cast: BOUNDLESS }, 9: { cast: REGEN }, 14: { cast: REGEN }, 21: { cast: BOUNDLESS } }
  });
});

test("1v1 IS THE BUILD for a counter the DEFENDER bears: stated before the bout, and written on it mid-phase by the attacker", () => {
  // Stated on the defender: the build's first nextphase ticks it, so the
  // defender must count as owed before anybody has acted.
  assertDuelIsTheBuild(duel({ foe: { spell_regenerate: 7, spell_boundless_energy: 20 } }), {
    phases: 30, label: "stated on the defender", script: {}
  });
  // The same with the FOE opening, so the owed fighter at phase 0 is the hero.
  assertDuelIsTheBuild(duel({ opener: "foe", hero: { spell_regenerate: 20, spell_boundless_energy: 9 } }), {
    phases: 30, label: "stated on the defender, foe opens", script: {}
  });
  // Written on the defender during the attacker's phase — the little-fat-kid
  // shape, whose bearer is not its caster — at the opening phase, mid-bout,
  // and on top of a counter already running.
  assertDuelIsTheBuild(duel(), {
    phases: 50,
    label: "written on the defender",
    script: {
      0: { writeOnDefender: { counter: REGEN_COUNTER, value: 16 } },
      7: { writeOnDefender: { counter: BOUNDLESS_COUNTER, value: 16 } },
      8: { cast: REGEN, writeOnDefender: { counter: REGEN_COUNTER, value: 16 } },
      20: { writeOnDefender: { counter: BOUNDLESS_COUNTER, value: 16 } }
    }
  });
});

test("3v3: a cast APPLIES TEN times too — four until 2026-09-22 (19, 13, 7, 1)", () => {
  for (const [type, counter, itemId] of [[REGEN, REGEN_COUNTER, 46], [BOUNDLESS, BOUNDLESS_COUNTER, 45]]) {
    const { counters, appliedAt } = playBuff(stagedTrios({ hero: { inventory1: itemId } }), { type, counter, phases: 66 });
    assert.deepEqual(appliedAt, [19, 17, 15, 13, 11, 9, 7, 5, 3, 1], type);
    assert.deepEqual(counters.slice(0, 7), [19, 18, 18, 18, 18, 18, 17], type);
    assert.equal(counters.at(-1), 0, `${type} has run out`);
  }
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
  // The ally's rest is the bout's first COMPLETED phase, so it pays every
  // opening debt — the killing phase paid none — and ticks all the living.
  rest(battle);
  for (const id of ["hero", "ally", "foe2"]) assert.equal(counterOf(battle, id, REGEN_COUNTER), 4, `${id} lives`);
  assert.equal(counterOf(battle, "foe1", REGEN_COUNTER), 5, "the dead keep what they had");
});

/**
 * THE DEATH RULE, decided 2026-09-22 with the owner's tick rule: **a phase
 * that kills does not exist for the clock.** It ticks nobody (the build's
 * `death()` deletes `nextphase`), it pays no owed tick, and it earns its actor
 * none — so an owed tick waits for the next phase anybody COMPLETES, and a
 * killer's own buff neither ticks nor applies on the phase it killed in.
 */
const killingBolt = (battle, actorId, targetId) =>
  applyAction(battle, { actorId, type: Ss2ActionType.CAST_FRIGHTNING_BOLT, targetId });

test("an owed tick SURVIVES a killing phase and is paid by the next COMPLETED one; the killer earns none", () => {
  const counters = { spell_regenerate: 5 };
  const battle = stagedTeams({ hero: counters, ally: counters, foe1: { ...counters, inventory1: 35 }, foe2: counters });
  const snapshot = () => Object.fromEntries(["hero", "foe1", "ally", "foe2"].map((id) => [id, counterOf(battle, id, REGEN_COUNTER)]));
  rest(battle, "hero");
  assert.deepEqual(snapshot(), { hero: 4, foe1: 4, ally: 4, foe2: 4 });
  // foe1 — the phase that owed the hero its tick — kills the ally instead.
  killingBolt(battle, "foe1", "ally");
  assert.equal(combatantById(battle, "ally").alive, false);
  assert.deepEqual(snapshot(), { hero: 4, foe1: 4, ally: 4, foe2: 4 }, "the killing phase ticks nobody");
  assert.equal(counterOf(battle, "hero", CLOCK), 1, "and leaves the hero owed");
  assert.equal(counterOf(battle, "foe1", CLOCK), 0, "and earns the killer nothing");
  // foe2 completes the next phase, and pays the HERO, not the killer.
  assert.equal(currentCombatant(battle).id, "foe2");
  rest(battle, "foe2");
  assert.deepEqual(snapshot(), { hero: 3, foe1: 4, ally: 4, foe2: 3 });
  rest(battle, "hero");
  assert.deepEqual(snapshot(), { hero: 2, foe1: 4, ally: 4, foe2: 2 });
  rest(battle, "foe1");
  assert.deepEqual(snapshot(), { hero: 1, foe1: 3, ally: 4, foe2: 2 }, "the dead ally is never ticked again");
});

test("a bearer whose OWN phase kills THE NEXT ACTOR neither ticks nor becomes owed; the one owed before it stays owed", () => {
  const counters = { spell_regenerate: 5 };
  const battle = stagedTeams({ hero: counters, ally: { ...counters, inventory1: 35 }, foe1: counters, foe2: counters });
  const snapshot = () => Object.fromEntries(["hero", "foe1", "ally", "foe2"].map((id) => [id, counterOf(battle, id, REGEN_COUNTER)]));
  rest(battle, "hero");
  rest(battle, "foe1");
  assert.deepEqual(snapshot(), { hero: 3, foe1: 3, ally: 4, foe2: 4 });
  // The ally kills foe2, whose phase was next.
  killingBolt(battle, "ally", "foe2");
  assert.equal(combatantById(battle, "foe2").alive, false);
  assert.deepEqual(snapshot(), { hero: 3, foe1: 3, ally: 4, foe2: 4 });
  assert.equal(counterOf(battle, "ally", CLOCK), 0);
  assert.equal(counterOf(battle, "foe1", CLOCK), 1);
  assert.equal(currentCombatant(battle).id, "hero", "foe2 is dead, so the hero is next");
  rest(battle, "hero");
  assert.deepEqual(snapshot(), { hero: 2, foe1: 2, ally: 4, foe2: 4 }, "foe1's debt is paid by the hero's completed phase");
  rest(battle, "foe1");
  rest(battle, "ally");
  assert.deepEqual(snapshot(), { hero: 1, foe1: 0, ally: 3, foe2: 4 },
    "the killer's cycle skipped both its ticks: one own tick since the bout's first phase");
});

test("an OWED bearer that dies takes its tick with it: nobody inherits it", () => {
  const counters = { spell_regenerate: 5 };
  const battle = stagedTeams({ hero: counters, ally: counters, foe1: { ...counters, inventory1: 35 }, foe2: counters });
  const snapshot = () => Object.fromEntries(["hero", "foe1", "ally", "foe2"].map((id) => [id, counterOf(battle, id, REGEN_COUNTER)]));
  rest(battle, "hero");
  killingBolt(battle, "foe1", "hero");
  assert.equal(combatantById(battle, "hero").alive, false);
  rest(battle, "ally");
  assert.deepEqual(snapshot(), { hero: 4, foe1: 4, ally: 3, foe2: 4 },
    "the ally's own tick and nothing else: the owed hero is dead, and nobody else was owed");
  rest(battle, "foe2");
  assert.deepEqual(snapshot(), { hero: 4, foe1: 4, ally: 2, foe2: 3 });
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
