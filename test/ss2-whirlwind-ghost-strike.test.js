/**
 * `cast_whirlwind` (item 37) and `cast_ghost_strike` (item 36) — the two spell
 * verbs that are ATTACKS, and which therefore resolve through the ordinary
 * attack path rather than beside it.
 *
 * ## WHAT THE BUILD DOES, AND WHERE
 *
 * Read 2026-09-22 from `sprite:862[overlay]/frame:52/DoAction@0x240c7f`, block
 * base `0x240c85`, in the installed oracle's own dumps:
 *
 * ```text
 *   phase_decision == "cast_whirlwind"                               +0x78da
 *     register:3.crowd_action = 3                                    +0x78ed
 *     game_attacker.staminacost = Math.round(game_attacker.magicka)  +0x78fa-+0x7920
 *     if (attacker.struck == null) {                                 +0x7921-+0x7933
 *       cast_spell_icon(attacker, 37)                                +0x7938
 *       attacker.gotoAndPlay("psyche_up3")                           +0x7950
 *       attacker.struck = false                                      +0x7964
 *       if (gladiator_dir == "right"
 *           && attacker._x > round(defender._x - (weapon_range + 50))) { direction = 30; checkattackroll() }
 *                                                                    +0x7972-+0x79ea
 *       if (gladiator_dir == "left"
 *           && attacker._x < round(defender._x + (weapon_range + 50))) { direction = 30; checkattackroll() }
 *                                                                    +0x79eb-+0x7a63
 *       game_attacker.psyche_up = 1                                  +0x7a64-+0x7a74
 *     }
 *     if (attacker.struck == true) { struck = null; nextphase() }    +0x7a75-+0x7aa9
 *
 *   phase_decision == "cast_ghost_strike"                            +0x7db7
 *     register:3.crowd_action = 5                                    +0x7dca
 *     game_attacker.staminacost = Math.round(game_attacker.magicka)  +0x7dd7-+0x7dfd
 *     if (attacker.struck == null) {                                 +0x7dfe-+0x7e10
 *       cast_spell_icon(attacker, 36); attacker.blendMode = "add"    +0x7e15-+0x7e3b
 *       attacker_old_x = attacker._x                                 +0x7e3c
 *       attacker._x = defender._x +/- game_attacker.physical_size    +0x7e4c-+0x7eac (left: +, else: -)
 *       attacker.struck = false                                      +0x7ead
 *       attack_direction = randomBetween(9, 12); Attack9..Attack12   +0x7ebb-+0x7f76
 *       checkattackroll()                                            +0x7f77
 *     }
 *     if (attacker.struck == true) {                                 +0x7f87
 *       attacker._x = attacker_old_x; blendMode = "normal"; struck = null; nextphase()
 *     }                                                              +0x7f9f-+0x7fd9
 * ```
 *
 * The whirlwind is the psyche discharge's resolution — the same gate
 * instruction for instruction (`+0x6658`-`+0x6717`), the same direction 30 —
 * paid for with `round(magicka)` and an item instead of a three-press charge.
 * The ghost strike is `power_attack`'s draw and call (`+0x608a`-`+0x6146`)
 * with no range test at all, paid for the same way.
 *
 * Villain ladder (`DoAction@0x23e7cf`): arm 20 `check_inventory(37) &&
 * fightdistance < 200 && equipped_weapon != 2` (`+0x0c99`-`+0x0cf5`); arm 21
 * `check_inventory(36) && fightdistance > 500 && equipped_weapon != 2`
 * (`+0x0d19`-`+0x0d75`).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, rngJournal,
  suggestAction, toTeamWireState
} from "../src/team/index.js";
import {
  SS2_FACING_LEFT, SS2_GHOST_STRIKE, SS2_INVENTORY_EMPTY, SS2_PSYCHE_UP, SS2_WHIRLWIND, Ss2ActionType, VANILLA_PHASE_LABEL,
  ss2Combatant, ss2FacingEffects, ss2IsBackAttack, ss2PhysicalSize, ss2Reach, ss2TeamRules
} from "../src/team/ss2-rules.js";
import {
  buildArenaLayout, CommandKind, LabelProvenance, presentResolvedEvents, SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";

const WHIRLWIND = Ss2ActionType.CAST_WHIRLWIND;
const GHOST = Ss2ActionType.CAST_GHOST_STRIKE;

/** Level 9, so the psyche offer's `herolevel >= 7` gate is open for the comparisons. */
const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 9, character_level: 9, weapon: 1,
  psyche_up: SS2_PSYCHE_UP.floor, ...o
});

/**
 * A 1v1 with the caster on RED, opening. By default the caster stands LEFT of
 * the foe facing right and the foe faces left; `heroLeft` puts the caster on
 * the RIGHT, facing left, which is the build's other gate expression.
 */
function staged({
  hero = {}, foe = {}, gap = 100, heroLeft = false, controller = "local", seed = 3
} = {}) {
  const battle = createTeamBattle({
    seed,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(
          fields({ speed: 21, ...(heroLeft ? { gladiator_dir: "left" } : {}), ...hero }),
          { id: "hero", name: "hero", controller }
        )]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [ss2Combatant(
          fields({ ...(heroLeft ? {} : { gladiator_dir: "left" }), ...foe }),
          { id: "foe", name: "foe", controller }
        )]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: heroLeft ? gap : 0, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: heroLeft ? 0 : gap, y: 200 });
  // ► **THE FACING IS RE-STATED AFTER THE MOVE, because construction derived
  //   it from the STARTING positions** (`openingEffects`, red left and blue
  //   right), and the `gladiator_dir` field above is overwritten by that. The
  //   pair faces each other, as every 1v1 pair does.
  face(battle, "hero", heroLeft);
  face(battle, "foe", !heroLeft);
  assert.equal(currentCombatant(battle).id, "hero", "the caster must open for these tests to mean anything");
  return battle;
}

/** Make `id` face left (true) or right (false) — the status token is the whole of facing here. */
function face(battle, id, left) {
  const combatant = combatantById(battle, id);
  combatant.status = combatant.status.filter((token) => token !== SS2_FACING_LEFT);
  if (left) combatant.status.push(SS2_FACING_LEFT);
}

/** Act, and hand back the resolution plus the draws it took. */
function act(battle, type, targetId = "foe") {
  const before = rngJournal(battle).length;
  applyAction(battle, { actorId: "hero", type, targetId });
  const resolution = battle.lastResolution;
  const event = resolution.events.find((entry) => entry.type === type);
  assert.ok(event, `the ${type} event must be logged`);
  const draws = rngJournal(battle).slice(before).map(({ source, label, min, max, value }) => ({ source, label, min, max, value }));
  return { resolution, event, draws };
}

const value = (battle, id, name) => {
  const entry = combatantById(battle, id).resources[name];
  return typeof entry === "object" && entry !== null ? entry.value : entry;
};
const offered = (battle, type, id = "hero") =>
  legalActions(battle, id).filter((option) => option.type === type).map((option) => option.targetId);
/** Everything about the VICTIM that a blow can change, for comparing two resolutions. */
const victimState = (battle) => {
  const foe = combatantById(battle, "foe");
  return JSON.stringify({ health: foe.health, x: foe.x, status: foe.status, resources: foe.resources });
};

/** The first seed in 1..60 whose staged cast satisfies `predicate`. */
function seedWhere(build, type, predicate) {
  for (let seed = 1; seed <= 60; seed += 1) {
    const battle = build(seed);
    if (predicate(act(battle, type).event)) return seed;
  }
  throw new Error(`no seed in 1..60 produced the ${type} outcome under test`);
}

/* ------------------------------------------------------------------ *
 * The vocabulary                                                      *
 * ------------------------------------------------------------------ */

test("the tokens round-trip to the build's own labels, cast_whirlwind and cast_ghost_strike", () => {
  assert.equal(WHIRLWIND, "cast-whirlwind");
  assert.equal(GHOST, "cast-ghost-strike");
  // `+0x78e0` and `+0x7dbd`, and the decisions ladder arms 20 and 21 write
  // (`+0x0cfa`, `+0x0d7a`).
  assert.equal(VANILLA_PHASE_LABEL[WHIRLWIND], "cast_whirlwind");
  assert.equal(VANILLA_PHASE_LABEL[GHOST], "cast_ghost_strike");
  assert.ok(ss2TeamRules.actionTypes.includes(WHIRLWIND));
  assert.ok(ss2TeamRules.actionTypes.includes(GHOST));
});

test("the constants are the build's literals", () => {
  assert.equal(SS2_WHIRLWIND.itemId, 37, "cast_spell_icon(attacker, 37) +0x7938, check_inventory(37) +0x0c99");
  assert.equal(SS2_WHIRLWIND.direction, 30, "attack_direction = 30, +0x79d0 / +0x7a49");
  assert.equal(SS2_WHIRLWIND.casterClip, "psyche_up3", "attacker.gotoAndPlay(\"psyche_up3\") +0x7950");
  assert.equal(SS2_WHIRLWIND.aiFightDistanceBelow, 200, "fightdistance < 200, +0x0cc5");
  assert.equal(SS2_GHOST_STRIKE.itemId, 36, "cast_spell_icon(attacker, 36) +0x7e15, check_inventory(36) +0x0d19");
  assert.equal(SS2_GHOST_STRIKE.directionLow, 9, "randomBetween(9, 12) +0x7ebb");
  assert.equal(SS2_GHOST_STRIKE.directionHigh, 12);
  assert.equal(SS2_GHOST_STRIKE.aiFightDistanceAbove, 500, "fightdistance > 500, +0x0d45");
});

/* ------------------------------------------------------------------ *
 * The offer                                                           *
 * ------------------------------------------------------------------ */

test("nothing carried, nothing offered; carrying 37 or 36 offers the verb at the foe", () => {
  assert.deepEqual(offered(staged(), WHIRLWIND), []);
  assert.deepEqual(offered(staged(), GHOST), []);
  assert.deepEqual(offered(staged({ hero: { inventory1: 37 } }), WHIRLWIND), ["foe"]);
  assert.deepEqual(offered(staged({ hero: { inventory1: 37 } }), GHOST), []);
  assert.deepEqual(offered(staged({ hero: { inventory2: 36 } }), GHOST), ["foe"]);
  assert.deepEqual(offered(staged({ hero: { inventory2: 36 } }), WHIRLWIND), []);
});

test("BOTH are offered at any distance: the hero's button has no range test, and the WHIRLWIND's gate is in its arm", () => {
  const far = staged({ gap: 1900, hero: { inventory1: 37, inventory2: 36 } });
  assert.deepEqual(offered(far, WHIRLWIND), ["foe"], "a whirlwind out of range is a legal, wasted cast");
  assert.deepEqual(offered(far, GHOST), ["foe"]);
});

test("the empty marker and the slot window apply, as for every spell on the inventory button", () => {
  assert.deepEqual(offered(staged({ hero: { inventory1: SS2_INVENTORY_EMPTY } }), WHIRLWIND), []);
  assert.deepEqual(offered(staged({ hero: { inventory3: 37, inventory_maxslots: 2 } }), WHIRLWIND), []);
  assert.deepEqual(offered(staged({ hero: { inventory2: 36, inventory_maxslots: 2 } }), GHOST), ["foe"]);
});

test("above 1v1 both are offered at EVERY foe, because each arm reads one bound defender and the caster picks", () => {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, inventory1: 37, inventory2: 36 }), { id: "hero", name: "hero", controller: "local" })] },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(fields(), { id: "a", name: "a", controller: "local" }),
          ss2Combatant(fields(), { id: "b", name: "b", controller: "local" })
        ]
      }
    ]
  });
  assert.deepEqual(offered(battle, WHIRLWIND).sort(), ["a", "b"]);
  assert.deepEqual(offered(battle, GHOST).sort(), ["a", "b"]);
});

/* ------------------------------------------------------------------ *
 * The whirlwind                                                       *
 * ------------------------------------------------------------------ */

test("IN RANGE the whirlwind takes EXACTLY the psyche discharge's draws and does exactly its damage", () => {
  // The same seed, the same two gladiators, the same counter; one discharges,
  // the other casts. Direction 30 through `checkattackroll` is one resolution,
  // whichever arm assigned it.
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const discharge = staged({ seed, hero: { psyche_up: 3 } });
    const whirl = staged({ seed, hero: { psyche_up: 3, inventory1: 37 } });
    const a = act(discharge, Ss2ActionType.PSYCHE_UP);
    const b = act(whirl, WHIRLWIND);
    assert.equal(a.event.discharged, true, "the control must actually discharge");
    assert.ok(b.draws.length > 0, "an in-range whirlwind reaches checkattackroll");
    assert.deepEqual(b.draws, a.draws, `seed ${seed}: the whirlwind's tape must be the discharge's`);
    assert.equal(b.event.attackDirection, 30);
    assert.equal(b.event.hit, a.event.hit);
    assert.equal(b.event.damage, a.event.damage);
    assert.equal(victimState(whirl), victimState(discharge), `seed ${seed}: the victim must end identically`);
  }
});

test("the whirlwind costs round(magicka), not the swing's price, and a lethal one costs nothing", () => {
  const cheap = act(staged({ hero: { inventory1: 37, magicka: 7 } }), WHIRLWIND);
  const dear = staged({ hero: { inventory1: 37, magicka: 27 } });
  const dearCast = act(dear, WHIRLWIND);
  assert.equal(cheap.event.staminaSpent, 7);
  assert.equal(dearCast.event.staminaSpent, 27);
  const cheapBattle = staged({ hero: { inventory1: 37, magicka: 7 } });
  act(cheapBattle, WHIRLWIND);
  assert.equal(value(cheapBattle, "hero", "staminaleft") - value(dear, "hero", "staminaleft"), 20,
    "twenty more magicka spends exactly twenty more stamina");

  // The killing blow: `death()` deletes `nextphase`, so nothing is spent.
  const lethal = staged({ hero: { inventory1: 37, attack: 100, strength: 60 }, foe: { vitality: 1 } });
  combatantById(lethal, "foe").health = 1;
  const stamina = value(lethal, "hero", "staminaleft");
  const kill = act(lethal, WHIRLWIND);
  assert.ok(combatantById(lethal, "foe").health <= 0, "the cast must have killed, or this proves nothing");
  assert.equal(kill.event.staminaSpent, 0);
  assert.equal(value(lethal, "hero", "staminaleft"), stamina);
});

test("OUT OF RANGE the whirlwind draws NOTHING, damages nobody, still costs round(magicka) and still resets the charge", () => {
  const battle = staged({ gap: 1500, hero: { inventory1: 37, psyche_up: 3 } });
  const health = combatantById(battle, "foe").health;
  const stamina = value(battle, "hero", "staminaleft");
  const { event, draws } = act(battle, WHIRLWIND);
  assert.deepEqual(draws, [], "a gated whirlwind reaches no checkattackroll");
  assert.equal(event.outOfRange, true);
  assert.equal(combatantById(battle, "foe").health, health);
  assert.equal(event.staminaSpent, 7, "the cost is set before the gate, every tick");
  assert.ok(value(battle, "hero", "staminaleft") < stamina, "and nextphase spends it");
  // `game_attacker.psyche_up = 1` at +0x7a64 is reached on every exit of the
  // gate — and nextphase's reset would write the same.
  assert.equal(value(battle, "hero", "psyche_up"), SS2_PSYCHE_UP.floor);
  assert.equal(value(battle, "hero", "inventory1"), SS2_INVENTORY_EMPTY, "the item is spent whether or not it reached");
});

test("THE BOUND IS STRICT, facing right: the whirlwind fires at K - 1 and not at K", () => {
  const K = ss2Reach(combatantById(staged(), "hero")) + SS2_PSYCHE_UP.rangeBonus;
  assert.ok(Number.isInteger(K), "a derived weapon_range is an integer, so K is");
  const fires = act(staged({ gap: K - 1, hero: { inventory1: 37 } }), WHIRLWIND);
  assert.notEqual(fires.event.outOfRange, true);
  assert.ok(fires.draws.length > 0);
  const gated = act(staged({ gap: K, hero: { inventory1: 37 } }), WHIRLWIND);
  assert.equal(gated.event.outOfRange, true, "attacker._x > round(defender._x - K) is false at a gap of exactly K");
  assert.deepEqual(gated.draws, []);
});

test("THE BOUND IS STRICT, facing left: the whirlwind fires at K - 1 and not at K", () => {
  const K = ss2Reach(combatantById(staged(), "hero")) + SS2_PSYCHE_UP.rangeBonus;
  const fires = act(staged({ heroLeft: true, gap: K - 1, hero: { inventory1: 37 } }), WHIRLWIND);
  assert.notEqual(fires.event.outOfRange, true);
  const gated = act(staged({ heroLeft: true, gap: K, hero: { inventory1: 37 } }), WHIRLWIND);
  assert.equal(gated.event.outOfRange, true, "attacker._x < round(defender._x + K) is false at a gap of exactly K");
});

test("the charge: a whirlwind leaves 1 where a discharge leaves 2, lethal or not, because its write-back has no increment", () => {
  const whirl = staged({ hero: { inventory1: 37, psyche_up: 3 } });
  act(whirl, WHIRLWIND);
  assert.equal(value(whirl, "hero", "psyche_up"), SS2_PSYCHE_UP.floor);
  const lethal = staged({ hero: { inventory1: 37, psyche_up: 3, attack: 100, strength: 60 }, foe: { vitality: 1 } });
  combatantById(lethal, "foe").health = 1;
  act(lethal, WHIRLWIND);
  assert.ok(combatantById(lethal, "foe").health <= 0);
  assert.equal(value(lethal, "hero", "psyche_up"), SS2_PSYCHE_UP.floor,
    "+0x7a64 runs in the cast's own tick, before death() can stop anything");
});

test("casting CONSUMES the slot, first in the effect list, and the offer goes with it", () => {
  const battle = staged({ hero: { inventory1: 37 } });
  const { resolution } = act(battle, WHIRLWIND);
  assert.deepEqual(resolution.effects[0], { kind: "resource", targetId: "hero", resource: "inventory1", to: SS2_INVENTORY_EMPTY });
  assert.deepEqual(offered(battle, WHIRLWIND), []);
});

test("a whirlwind the caster does not carry is refused, and draws nothing", () => {
  const battle = staged();
  const before = rngJournal(battle).length;
  // Twice: the resolver's legality gate refuses the unoffered action, and a
  // DIRECT call to the rule set's own `resolveAction` — which skips that gate —
  // refuses it again before any draw, naming the item it looked for.
  assert.throws(() => applyAction(battle, { actorId: "hero", type: WHIRLWIND, targetId: "foe" }), /Illegal action/);
  assert.throws(
    () => ss2TeamRules.resolveAction({
      actor: combatantById(battle, "hero"), target: combatantById(battle, "foe"), targetId: "foe",
      type: WHIRLWIND, turnNumber: 1, allies: [combatantById(battle, "hero")], foes: [combatantById(battle, "foe")]
    }, { randomBetween: () => { throw new Error("must not draw"); } }),
    /cannot cast cast_whirlwind: no declared inventory slot holds item 37/
  );
  assert.equal(rngJournal(battle).length, before);
});

/* ------------------------------------------------------------------ *
 * The ghost strike                                                    *
 * ------------------------------------------------------------------ */

test("the ghost strike takes EXACTLY power_attack's draws and does exactly its damage", () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const power = staged({ seed });
    const ghost = staged({ seed, hero: { inventory1: 36 } });
    const a = act(power, Ss2ActionType.POWER_ATTACK);
    const b = act(ghost, GHOST);
    assert.deepEqual(b.draws[0], { source: "randomBetween", label: "attack-direction-roll", min: 9, max: 12, value: b.draws[0].value },
      "the first draw is randomBetween(9, 12), +0x7ebb");
    assert.deepEqual(b.draws, a.draws, `seed ${seed}: the ghost strike's tape must be the power attack's`);
    assert.equal(b.event.attackDirection, a.event.attackDirection);
    assert.equal(b.event.damage, a.event.damage);
    assert.equal(victimState(ghost), victimState(power), `seed ${seed}: the victim must end identically`);
  }
});

test("FROM ACROSS THE ARENA the ghost strike resolves exactly as it does in reach, and the caster ends where it began", () => {
  for (const seed of [1, 2, 3]) {
    const near = act(staged({ seed, hero: { inventory1: 36 } }), GHOST);
    const farBattle = staged({ seed, gap: 1500, hero: { inventory1: 36 } });
    const far = act(farBattle, GHOST);
    assert.deepEqual(far.draws, near.draws, "no range test: the distance enters nothing");
    assert.equal(far.event.damage, near.event.damage);
    if (combatantById(farBattle, "foe").health > 0) {
      assert.equal(combatantById(farBattle, "hero").x, 0, "restored to attacker_old_x at the phase end, +0x7f9f");
    }
  }
});

test("the ghost strike costs round(magicka), not round(strength * 3), and resets the caster's own charge", () => {
  const battle = staged({ hero: { inventory1: 36, magicka: 7, strength: 30, psyche_up: 3 } });
  const { event } = act(battle, GHOST);
  assert.equal(event.staminaSpent, 7);
  if (combatantById(battle, "foe").health > 0) {
    assert.equal(value(battle, "hero", "psyche_up"), SS2_PSYCHE_UP.floor, "nextphase resets on a decision that is not psyche_up");
  }
});

test("casting CONSUMES the ghost strike's slot, first in the effect list", () => {
  const battle = staged({ hero: { inventory2: 36 } });
  const { resolution } = act(battle, GHOST);
  assert.deepEqual(resolution.effects[0], { kind: "resource", targetId: "hero", resource: "inventory2", to: SS2_INVENTORY_EMPTY });
  assert.deepEqual(offered(battle, GHOST), []);
});

test("A LETHAL GHOST STRIKE LEAVES THE CASTER BESIDE THE BODY, because the restore is in the tick death() deletes", () => {
  for (const heroLeft of [false, true]) {
    const battle = staged({ heroLeft, gap: 1200, hero: { inventory1: 36, attack: 100, strength: 60 }, foe: { vitality: 1 } });
    combatantById(battle, "foe").health = 1;
    const stamina = value(battle, "hero", "staminaleft");
    const { event } = act(battle, GHOST);
    assert.ok(combatantById(battle, "foe").health <= 0, "the strike must have killed, or this proves nothing");
    const size = ss2PhysicalSize(combatantById(battle, "hero"));
    const foeX = heroLeft ? 0 : 1200;
    const expected = heroLeft ? foeX + size : foeX - size;
    assert.equal(combatantById(battle, "hero").x, expected,
      `facing ${heroLeft ? "left" : "right"}: defender._x ${heroLeft ? "+" : "-"} physical_size, +0x7e4c-+0x7eac`);
    assert.equal(event.casterFrom, heroLeft ? 1200 : 0);
    assert.equal(event.casterTo, expected);
    assert.equal(event.staminaSpent, 0);
    assert.equal(value(battle, "hero", "staminaleft"), stamina);
  }
});

test("a ghost strike the authored BACK-ATTACK BONUS finishes is still a kill, and leaves the caster beside the body", () => {
  // ► **FOUND BY A CODEX ADVERSARIAL REVIEW, 2026-09-22, reproduced here
  //   first.** The kill test read the vanilla blow alone, before the authored
  //   back-attack bonus (`SS2_BACK_ATTACK_BONUS`) was added, so a strike whose
  //   base damage left the target at 1 hitpoint and whose bonus killed it left
  //   the caster at its old x and told the presentation nothing.
  const build = (seed, health) => {
    const battle = staged({ gap: 900, seed, hero: { inventory1: 36 } });
    face(battle, "foe", false); // the foe faces AWAY: the caster is behind it
    if (health !== undefined) combatantById(battle, "foe").health = health;
    return battle;
  };
  for (let seed = 1; seed <= 60; seed += 1) {
    const probe = build(seed);
    const before = combatantById(probe, "foe").health;
    const { event } = act(probe, GHOST);
    const base = before - combatantById(probe, "foe").health - (event.backAttackDamage ?? 0);
    if (!(event.backAttackDamage > 0) || !(base > 0)) continue;
    // The same seed again, with exactly one hitpoint more than the base blow
    // takes: the vanilla blow does not kill, the bonus does.
    const battle = build(seed, base + 1);
    const hero = combatantById(battle, "hero");
    const stamina = value(battle, "hero", "staminaleft");
    const health = hero.health;
    const psyche = value(battle, "hero", "psyche_up");
    const { event: lethal } = act(battle, GHOST);
    assert.ok(combatantById(battle, "foe").health <= 0, "the bonus must have finished it, or this proves nothing");
    const expected = 900 - ss2PhysicalSize(combatantById(battle, "hero"));
    assert.equal(combatantById(battle, "hero").x, expected, "beside the body, as for any other kill");
    assert.equal(lethal.casterTo, expected);
    // ► **AND IT IS A KILL FOR EVERY OTHER RULE TOO** (Codex's second pass,
    //   2026-09-22): no transition runs after a kill, so the killer neither
    //   pays nor recovers, and its psyche is not reset.
    assert.equal(value(battle, "hero", "staminaleft"), stamina, "no stamina paid on a kill");
    assert.equal(combatantById(battle, "hero").health, health, "and no heal");
    assert.equal(value(battle, "hero", "psyche_up"), psyche, "and the charge is not reset");
    assert.equal(lethal.staminaSpent, 0);
    return;
  }
  assert.fail("no seed in 1..60 landed a back-attack ghost strike");
});

test("a WHIRLWIND or a SWING the back-attack bonus finishes skips the transition too", () => {
  // The same fix reaches every physical blow: the kill rule reads the damage
  // once the authored bonus has landed. The whirlwind still writes its own
  // counter back to 1 (+0x7a64), kill or not.
  for (const [type, item] of [[WHIRLWIND, 37], [Ss2ActionType.QUICK_ATTACK, null]]) {
    const build = (seed, health) => {
      const battle = staged({ gap: 100, seed, hero: item ? { inventory1: item } : {} });
      face(battle, "foe", false);
      if (health !== undefined) combatantById(battle, "foe").health = health;
      return battle;
    };
    let found = false;
    for (let seed = 1; seed <= 80 && !found; seed += 1) {
      const probe = build(seed);
      const before = combatantById(probe, "foe").health;
      const { event } = act(probe, type);
      const base = before - combatantById(probe, "foe").health - (event.backAttackDamage ?? 0);
      if (!(event.backAttackDamage > 0) || !(base > 0)) continue;
      const battle = build(seed, base + 1);
      const stamina = value(battle, "hero", "staminaleft");
      const health = combatantById(battle, "hero").health;
      const { event: lethal } = act(battle, type);
      assert.ok(combatantById(battle, "foe").health <= 0, `${type}: the bonus must have finished it`);
      assert.equal(value(battle, "hero", "staminaleft"), stamina, `${type}: no stamina paid on a kill`);
      assert.equal(combatantById(battle, "hero").health, health, `${type}: and no heal`);
      assert.equal(lethal.staminaSpent, 0, `${type}`);
      found = true;
    }
    assert.ok(found, `no seed in 1..80 landed a back-attack ${type} with a positive base blow`);
  }
});

/* ------------------------------------------------------------------ *
 * The ghost strike's back attack is judged from where it STRIKES      *
 * ------------------------------------------------------------------ */

// ► **THE AUTHORED BACK-ATTACK BONUS (`SS2_BACK_ATTACK_BONUS`) IS JUDGED FROM
//   THE TELEPORT, NOT FROM WHERE THE CASTER STOOD.** The arm moves the caster
//   to `defender._x + physical_size` when `gladiator_dir == "left"` and to
//   `defender._x - physical_size` otherwise (`+0x7e4c`-`+0x7eac`), and only
//   THEN calls `checkattackroll()` (`+0x7f77`). Found by an audit and an
//   independent refuter, 2026-09-22 (WG-1): the engine judged the bonus from
//   the pre-teleport `x`, so above 1v1 it could grant +50% — and a kill — from
//   a side the caster never strikes from, then record the killer on the other
//   side of the body.

/**
 * A 2v2 — red `hero` and `c`, blue `a` and `b` — at the given `x`s, with every
 * facing stated LITERALLY and then checked against the engine's own rule, so
 * the staging is a state play can reach and not a hand-built one.
 */
function staged2v2({ seed = 3, hero = {}, at, facingLeft }) {
  const battle = createTeamBattle({
    seed,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [
          ss2Combatant(fields({ speed: 21, inventory1: 36, ...hero }), { id: "hero", name: "hero", controller: "local" }),
          ss2Combatant(fields(), { id: "c", name: "c", controller: "local" })
        ]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(fields(), { id: "a", name: "a", controller: "local" }),
          ss2Combatant(fields(), { id: "b", name: "b", controller: "local" })
        ]
      }
    ]
  });
  for (const [id, x] of Object.entries(at)) Object.assign(combatantById(battle, id), { x, y: 200 });
  for (const id of Object.keys(at)) face(battle, id, facingLeft.includes(id));
  const side = (ids) => ids.map((id) => combatantById(battle, id));
  assert.deepEqual(ss2FacingEffects(side(["hero", "c"]), side(["a", "b"])), [],
    "the staged facings must be exactly what the engine derives from these x's");
  assert.equal(currentCombatant(battle).id, "hero", "the caster must open for these tests to mean anything");
  return battle;
}

/** Every landed ghost strike on `targetId` over seeds 1..`seeds`, with the health it took. */
function landedStrikes(build, targetId, seeds = 40) {
  const landed = [];
  for (let seed = 1; seed <= seeds; seed += 1) {
    const battle = build(seed);
    const before = combatantById(battle, targetId).health;
    const { event } = act(battle, GHOST, targetId);
    if (event.hit && event.damage > 0) {
      landed.push({ seed, battle, event, lost: before - combatantById(battle, targetId).health });
    }
  }
  return landed;
}

test("1v1 IS UNCHANGED: the caster faces its only foe, so the teleport lands on the side it already stood on", () => {
  // ► **WHY 1v1 CANNOT MOVE.** Facing is derived for BOTH of a pair from the
  //   pair on every `x` write, so a separated 1v1 pair always faces each
  //   other. A caster facing right stands left of its foe and the arm lands it
  //   left of its foe (`defender._x - physical_size`); facing left, right and
  //   right. A co-located pair keeps the facings it had when separated — each
  //   other — and is never behind before the teleport nor after it. So the
  //   verdict is the one the caster's own position already gave.
  //
  //   The "foe faces away" rows are HAND-STAGED (as the bonus-kill test above
  //   stages them); play cannot reach them in 1v1, and they are here because
  //   they are the only 1v1 rows in which a back attack happens at all.
  const rows = [
    { heroLeft: false, gap: 100, foeFacesAway: false, back: false },
    { heroLeft: true, gap: 100, foeFacesAway: false, back: false },
    { heroLeft: false, gap: 900, foeFacesAway: false, back: false },
    { heroLeft: true, gap: 900, foeFacesAway: false, back: false },
    { heroLeft: false, gap: 0, foeFacesAway: false, back: false },
    { heroLeft: true, gap: 0, foeFacesAway: false, back: false },
    { heroLeft: false, gap: 900, foeFacesAway: true, back: true },
    { heroLeft: true, gap: 900, foeFacesAway: true, back: true }
  ];
  for (const { heroLeft, gap, foeFacesAway, back } of rows) {
    const build = (seed) => {
      const battle = staged({ seed, heroLeft, gap, hero: { inventory1: 36 } });
      // The foe faces the caster unless the row turns it away.
      face(battle, "foe", foeFacesAway ? heroLeft : !heroLeft);
      return battle;
    };
    const landed = landedStrikes(build, "foe", 30);
    const label = `heroLeft=${heroLeft} gap=${gap} foeFacesAway=${foeFacesAway}`;
    assert.ok(landed.length >= 3, `${label}: too few landed strikes (${landed.length}) to prove anything`);
    for (const { seed, event, lost } of landed) {
      assert.equal(event.backAttack, back, `${label} seed ${seed}`);
      assert.equal(back ? event.backAttackDamage > 0 : event.backAttackDamage === 0, true, `${label} seed ${seed}`);
      assert.equal(lost, event.damage + event.backAttackDamage, `${label} seed ${seed}: the bonus is the only extra`);
    }
  }
});

/**
 * STANDING BEHIND, STRIKING FROM THE FRONT. The caster faces `a` and stands on
 * the far side of `b`, who faces `c`; the teleport follows the caster's facing
 * and puts it on `b`'s FACE side. Strength 9, so `physical_size` is
 * 80 + round(9 / 1.5) = 86. Both of the arm's branches: facing right lands at
 * 100 - 86 = 14, facing left (the mirror) at -100 + 86 = -14.
 */
const BEHIND_BUT_STRIKES_FRONT = Object.freeze([
  { at: { hero: 500, c: 0, a: 700, b: 100 }, facingLeft: ["a", "b"], strikesFrom: 14 },
  { at: { hero: -500, c: 0, a: -700, b: -100 }, facingLeft: ["hero", "c"], strikesFrom: -14 }
]);

test("ABOVE 1v1, a ghost strike from BEHIND its target that lands in FRONT of it earns NO back-attack bonus", () => {
  for (const { at, facingLeft, strikesFrom } of BEHIND_BUT_STRIKES_FRONT) {
    const build = (seed) => staged2v2({ seed, at, facingLeft });
    const probe = build(3);
    assert.equal(ss2IsBackAttack(combatantById(probe, "hero"), combatantById(probe, "b")), true,
      "the premise: where the caster STANDS is behind b, so the old rule granted the bonus");
    assert.equal(ss2PhysicalSize(combatantById(probe, "hero")), 86);
    assert.equal(ss2IsBackAttack({ x: strikesFrom }, combatantById(probe, "b")), false,
      "and where the arm puts it is in front");
    const landed = landedStrikes(build, "b");
    assert.ok(landed.length >= 3, `too few landed strikes (${landed.length}) to prove anything`);
    for (const { seed, event, lost } of landed) {
      assert.equal(event.backAttack, false, `hero@${at.hero} seed ${seed}: struck from ${strikesFrom}, in front of b`);
      assert.equal(event.backAttackDamage, 0, `hero@${at.hero} seed ${seed}`);
      assert.equal(lost, event.damage, `hero@${at.hero} seed ${seed}: the vanilla blow and nothing more`);
    }
  }
});

/**
 * STANDING IN FRONT, STRIKING FROM BEHIND — the mirror. `b` faces the caster;
 * the caster faces `a`, the same way `b` faces, so the teleport puts it at
 * `b`'s BACK: facing right at 0 - 86 = -86, facing left at 0 + 86 = 86.
 */
const FRONT_BUT_STRIKES_BEHIND = Object.freeze([
  { at: { hero: 300, c: -1500, a: 400, b: 0 }, facingLeft: ["a"], strikesFrom: -86 },
  { at: { hero: -300, c: 1500, a: -400, b: 0 }, facingLeft: ["hero", "c", "b"], strikesFrom: 86 }
]);

test("ABOVE 1v1, a ghost strike from IN FRONT of its target that lands BEHIND it EARNS the back-attack bonus", () => {
  for (const { at, facingLeft, strikesFrom } of FRONT_BUT_STRIKES_BEHIND) {
    const build = (seed) => staged2v2({ seed, at, facingLeft });
    const probe = build(3);
    assert.equal(ss2IsBackAttack(combatantById(probe, "hero"), combatantById(probe, "b")), false,
      "the premise: where the caster STANDS is in front of b, so the old rule refused the bonus");
    assert.equal(ss2IsBackAttack({ x: strikesFrom }, combatantById(probe, "b")), true,
      "and where the arm puts it is behind");
    const landed = landedStrikes(build, "b");
    assert.ok(landed.length >= 3, `too few landed strikes (${landed.length}) to prove anything`);
    for (const { seed, event, lost } of landed) {
      assert.equal(event.backAttack, true, `hero@${at.hero} seed ${seed}: struck from ${strikesFrom}, behind b`);
      assert.ok(event.backAttackDamage > 0, `hero@${at.hero} seed ${seed}`);
      assert.equal(lost, event.damage + event.backAttackDamage, `hero@${at.hero} seed ${seed}`);
    }
  }
});

/** The first landed strike in `layout` with a positive vanilla blow, rebuilt with `b` at `base + 1` hitpoints. */
function atBasePlusOne(layout) {
  const build = (seed) => staged2v2({ seed, at: layout.at, facingLeft: layout.facingLeft });
  const [first] = landedStrikes(build, "b", 60);
  assert.ok(first, "no seed in 1..60 landed a ghost strike on b");
  const battle = build(first.seed);
  combatantById(battle, "b").health = first.event.damage + 1;
  return battle;
}

test("a ghost strike the bonus FINISHES from behind is a kill, and the killer is recorded where it struck from", () => {
  // 237541b's rules for a bonus kill (no stamina, no heal, no psyche reset, the
  // caster left beside the body) and WG-2's position — `defender._x -/+
  // physical_size` by the caster's facing — on the side the bonus came from.
  for (const layout of FRONT_BUT_STRIKES_BEHIND) {
    const battle = atBasePlusOne(layout);
    const stamina = value(battle, "hero", "staminaleft");
    const health = combatantById(battle, "hero").health;
    const psyche = value(battle, "hero", "psyche_up");
    const { event } = act(battle, GHOST, "b");
    assert.equal(event.backAttack, true);
    assert.ok(combatantById(battle, "b").health <= 0, "the vanilla blow left 1 hitpoint; the bonus must have killed");
    assert.equal(combatantById(battle, "hero").x, layout.strikesFrom, "beside the body, BEHIND it, where it struck from");
    assert.equal(event.casterFrom, layout.at.hero);
    assert.equal(event.casterTo, layout.strikesFrom);
    assert.equal(event.staminaSpent, 0);
    assert.equal(value(battle, "hero", "staminaleft"), stamina, "no stamina paid on a kill");
    assert.equal(combatantById(battle, "hero").health, health, "and no heal");
    assert.equal(value(battle, "hero", "psyche_up"), psyche, "and the charge is not reset");
  }
});

test("a ghost strike from behind that lands in FRONT, at a health the old bonus would have finished, does not kill", () => {
  // The audit's own demonstration, turned round: the vanilla blow leaves 1
  // hitpoint, and there is no bonus to take it. So no kill, the caster is
  // restored to where it stood (`+0x7f9f`) and nothing is recorded, and the
  // cast pays round(magicka) like any other.
  for (const layout of BEHIND_BUT_STRIKES_FRONT) {
    const battle = atBasePlusOne(layout);
    const { event } = act(battle, GHOST, "b");
    assert.equal(event.backAttack, false);
    assert.equal(combatantById(battle, "b").health, 1, "the vanilla blow and nothing more");
    assert.equal(combatantById(battle, "hero").x, layout.at.hero, "restored to attacker_old_x");
    assert.equal(event.casterFrom, undefined);
    assert.equal(event.casterTo, undefined);
    assert.equal(event.staminaSpent, 7, "round(magicka 7)");
  }
});

test("AT THE WALL the side is judged from the UNCLAMPED landing the roll sees; only the kill's record is clamped", () => {
  // `b` stands on the left bound, -2100, facing the caster; the caster faces
  // `a`, so the arm lands it at -2100 - 86 = -2186, behind `b`. The build's clip
  // clamp runs at the top of `attacker.onEnterFrame` (`+0x38fd`-`+0x3a3f`),
  // before the phase arms, so `checkattackroll()` sees -2186. Clamped first it
  // would be -2100, co-located, and no back attack at all.
  const layout = { at: { hero: -1900, c: 1000, a: -1850, b: -2100 }, facingLeft: ["c", "a"] };
  const build = (seed) => staged2v2({ seed, ...layout });
  const landed = landedStrikes(build, "b");
  assert.ok(landed.length >= 3, `too few landed strikes (${landed.length}) to prove anything`);
  for (const { seed, event } of landed) {
    assert.equal(event.backAttack, true, `seed ${seed}: struck from -2186, behind b`);
  }
  const battle = atBasePlusOne(layout);
  const { event } = act(battle, GHOST, "b");
  assert.ok(combatantById(battle, "b").health <= 0, "the bonus must have killed");
  assert.equal(event.casterTo, -2100, "the recorded position keeps the arena bound, the named invention");
  assert.equal(combatantById(battle, "hero").x, -2100);
});

/* ------------------------------------------------------------------ *
 * The presentation                                                    *
 * ------------------------------------------------------------------ */

function present(battle) {
  const wire = toTeamWireState(battle);
  const { commands } = presentResolvedEvents(wire, { layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS });
  const clips = commands
    .filter((command) => command.kind === CommandKind.CLIP_GOTO)
    .map(({ combatantId, role, label, labelProvenance }) => ({ combatantId, role, label, labelProvenance }));
  return { commands, clips };
}

test("a presented whirlwind plays psyche_up3 on the caster and knockback on a hit, defend12 on a miss, all MAP_NAMED", () => {
  const build = (seed) => staged({ seed, hero: { inventory1: 37 } });
  for (const [hit, victim] of [[true, "knockback"], [false, "defend12"]]) {
    const battle = build(seedWhere(build, WHIRLWIND, (event) => event.hit === hit && event.outOfRange !== true));
    act(battle, WHIRLWIND);
    const { commands, clips } = present(battle);
    assert.deepEqual(clips, [
      { combatantId: "hero", role: "actor", label: "psyche_up3", labelProvenance: LabelProvenance.MAP_NAMED },
      { combatantId: "foe", role: "target", label: victim, labelProvenance: LabelProvenance.MAP_NAMED }
    ]);
    assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), []);
  }
});

test("a presented OUT-OF-RANGE whirlwind plays psyche_up3 on the caster and nothing on the victim, with nothing unmapped", () => {
  const battle = staged({ gap: 1500, hero: { inventory1: 37 } });
  act(battle, WHIRLWIND);
  const { commands, clips } = present(battle);
  assert.deepEqual(clips, [
    { combatantId: "hero", role: "actor", label: "psyche_up3", labelProvenance: LabelProvenance.MAP_NAMED }
  ]);
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), []);
});

test("a presented ghost strike is presented exactly as the power attack with the same draws is", () => {
  for (const seed of [1, 2, 3, 4]) {
    const power = staged({ seed });
    act(power, Ss2ActionType.POWER_ATTACK);
    const ghost = staged({ seed, hero: { inventory1: 36 } });
    const { event } = act(ghost, GHOST);
    const a = present(power);
    const b = present(ghost);
    assert.deepEqual(b.clips, a.clips, "Attack9..Attack12 on the caster, the ordinary hurt / defend clip on the victim");
    assert.equal(b.clips[0].label, `attack${event.attackDirection}`);
    assert.deepEqual(b.commands.filter((command) => command.kind === CommandKind.UNMAPPED), []);
    assert.deepEqual(b.commands.filter((command) => command.kind === CommandKind.MOVE_CLIP), [],
      "a strike that does not kill ends where it began, so nothing is moved");
  }
});

test("a presented LETHAL ghost strike moves the caster to the body as a teleport, not a slide", () => {
  const battle = staged({ gap: 1200, hero: { inventory1: 36, attack: 100, strength: 60 }, foe: { vitality: 1 } });
  combatantById(battle, "foe").health = 1;
  act(battle, GHOST);
  const { commands } = present(battle);
  const moves = commands.filter((command) => command.kind === CommandKind.MOVE_CLIP);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].combatantId, "hero");
  assert.equal(moves[0].from, 0);
  assert.equal(moves[0].to, 1200 - ss2PhysicalSize(combatantById(battle, "hero")));
  assert.equal(moves[0].teleported, true);
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), []);
});

/* ------------------------------------------------------------------ *
 * The AI                                                              *
 * ------------------------------------------------------------------ */

const aiCaster = ({ gap = 120, hero = {}, foe = {} } = {}) => staged({ controller: "ai", gap, hero, foe });
/** The same gladiator with the item removed — the control every gate test compares against. */
function without(battle, slot = "inventory1") {
  combatantById(battle, "hero").resources[slot].value = SS2_INVENTORY_EMPTY;
  return suggestAction(battle, "hero").type;
}

test("ARM 20: an AI carrying 37 with a foe inside 200 whirlwinds it, overriding the swing", () => {
  const battle = aiCaster({ hero: { inventory1: 37 } });
  assert.deepEqual(suggestAction(battle, "hero"), { type: WHIRLWIND, targetId: "foe" });
  assert.equal(without(battle), Ss2ActionType.QUICK_ATTACK, "the control: without 37 it swings");
});

test("ARM 20 is strict at 200, and the AI does what it would without 37", () => {
  const battle = aiCaster({ gap: 200, hero: { inventory1: 37 } });
  const shut = suggestAction(battle, "hero").type;
  assert.notEqual(shut, WHIRLWIND);
  assert.equal(shut, without(battle));
  assert.equal(suggestAction(aiCaster({ gap: 199, hero: { inventory1: 37 } }), "hero").type, WHIRLWIND);
});

/** A drawn bow with arrows to spend, so the option list is a real choice and not the forced swap. */
const BOW_DRAWN = Object.freeze({ secondary_weapon: 61, equipped_weapon: 2 });

test("ARM 20 is shut with the bow drawn (equipped_weapon == 2), although the button still offers the spell", () => {
  const battle = aiCaster({ hero: { inventory1: 37, ...BOW_DRAWN } });
  assert.deepEqual(offered(battle, WHIRLWIND), ["foe"], "the hero's button reads no weapon mode");
  assert.ok(legalActions(battle, "hero").length > 1, "not the forced swap, or this proves nothing");
  assert.notEqual(suggestAction(battle, "hero").type, WHIRLWIND);
});

test("ARM 21: an AI carrying 36 with its foe beyond 500 ghost-strikes it, instead of walking", () => {
  const battle = aiCaster({ gap: 501, hero: { inventory1: 36 } });
  assert.deepEqual(suggestAction(battle, "hero"), { type: GHOST, targetId: "foe" });
  assert.equal(without(battle), Ss2ActionType.WALK_RIGHT, "the control: without 36 it closes");
});

test("ARM 21 is strict at 500, and is shut with the bow drawn", () => {
  const at = aiCaster({ gap: 500, hero: { inventory1: 36 } });
  const shut = suggestAction(at, "hero").type;
  assert.notEqual(shut, GHOST);
  assert.equal(shut, without(at));
  const bow = aiCaster({ gap: 900, hero: { inventory1: 36, ...BOW_DRAWN } });
  assert.deepEqual(offered(bow, GHOST), ["foe"], "the hero's button reads no weapon mode");
  assert.ok(legalActions(bow, "hero").length > 1, "not the forced swap, or this proves nothing");
  assert.notEqual(suggestAction(bow, "hero").type, GHOST);
});

test("LADDER ORDER: a bolt (15, 17) and weaken armour (19) come first; the whirlwind (20) beats boundless energy (23)", () => {
  assert.equal(suggestAction(aiCaster({ hero: { inventory1: 37, inventory2: 34 } }), "hero").type,
    Ss2ActionType.CAST_LIGHTNING_BOLT);
  const weakened = aiCaster({ hero: { inventory1: 37, inventory2: 44 } });
  assert.equal(suggestAction(weakened, "hero").type, Ss2ActionType.CAST_WEAKEN_ARMOUR);
  assert.equal(without(weakened, "inventory2"), WHIRLWIND, "the control: with 44 gone, arm 20 fires");
  const boundless = aiCaster({ hero: { inventory1: 37, inventory2: 45 } });
  assert.equal(suggestAction(boundless, "hero").type, WHIRLWIND);
  assert.equal(without(boundless), Ss2ActionType.CAST_BOUNDLESS_ENERGY, "the control: with 37 gone, arm 23 fires");
});

test("LADDER ORDER: a bolt pre-empts the ghost strike (21), and the ghost strike beats boundless energy (23)", () => {
  assert.equal(suggestAction(aiCaster({ gap: 900, hero: { inventory1: 36, inventory2: 34 } }), "hero").type,
    Ss2ActionType.CAST_LIGHTNING_BOLT);
  const boundless = aiCaster({ gap: 900, hero: { inventory1: 36, inventory2: 45 } });
  assert.equal(suggestAction(boundless, "hero").type, GHOST);
  assert.equal(without(boundless), Ss2ActionType.CAST_BOUNDLESS_ENERGY, "the control: with 36 gone, arm 23 fires");
});

test("the AI takes no sample to decide, so the build's 90% roll is not reproduced", () => {
  const battle = aiCaster({ hero: { inventory1: 37 } });
  const before = battle.rng.cursor;
  suggestAction(battle, "hero");
  assert.equal(battle.rng.cursor, before);
});
