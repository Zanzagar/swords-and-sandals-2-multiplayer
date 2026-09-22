/**
 * `drink_potion` — the inventory items 2-9, and the first verb here that
 * targets its own actor through an inventory slot.
 *
 * ## WHAT THE BUILD DOES, AND WHERE
 *
 * Derived from the oracle whose sha256 is `77CB545C…`, read 2026-09-22 from the
 * main session's dump of `sprite:862[overlay]/frame:52/DoAction@0x240c7f`,
 * block base `0x240c85`, `+0x576d`-`+0x5dad`:
 *
 * ```text
 *   phase_decision == "drink_potion"                                +0x5773
 *     register:3.crowd_action = -3                                  +0x577f
 *     game_attacker.staminacost = 0                                 +0x578c
 *     if (attacker.struck == null) {                                +0x57a1
 *       attacker.struck = false                                     +0x57b8
 *       attacker.gotoAndPlay("drink_potion")                        +0x57c6
 *       attacker.potions.gotoAndPlay(inventory_action - 1)          +0x57da
 *       if (inventory_action == 2) hitpoints += round(hitpointsmax * 0.25)   +0x5807
 *       if (inventory_action == 3) hitpoints += round(hitpointsmax * 0.5)    +0x58b7
 *       if (inventory_action == 4) hitpoints += round(hitpointsmax * 0.75)   +0x5967
 *       if (inventory_action == 5) hitpoints += hitpointsmax  (NO round)     +0x5a17
 *       if (inventory_action == 6) staminaleft += round(staminamax * 0.5)    +0x5aa9
 *       if (inventory_action == 7) staminaleft += round(staminamax)          +0x5b59
 *       if (inventory_action == 8) armourclass += round(armourclass * 0.5)   +0x5bfc
 *       if (inventory_action == 9) armourclass += round(armourclass_max)     +0x5cac
 *         (each: bonus_icon = attacker.attachMovie("bonus_icon", ..., 25001),
 *          bonus_icon.damage_splat.gotoAndStop(1 | 2 | 3),
 *          bonus_icon.bonus = "+ " + bonus)
 *       check_flipping(bonus_icon, attacker)                        +0x5d4f
 *       check_stats(game_attacker)                                  +0x5d67
 *     }
 *     if (attacker.struck == true) { attacker.struck = null; nextphase() }  +0x5d79
 * ```
 *
 * `check_stats` (`+0x110a`-`+0x11ff` of the same block) is a pure clamp of all
 * THREE pools — `staminaleft` to `[0, staminamax]`, `hitpoints` to
 * `[0, hitpointsmax]`, `armourclass` to `[0, armourclass_max]` — so a drink
 * that overflows is capped before `nextphase` runs its own regeneration. The
 * fighter clip's `drink_potion` label is frames 1887-1910 and frame 1910
 * writes `this.struck = true; Stop` — the drinker's own clip ends the phase.
 *
 * `inventory_action` is written BEFORE the phase by whoever chose it: the
 * hero's click handler (`sprite:862[overlay]/frame:1`, `+0x0601` for slot 1)
 * does `inventory_action = inventoryN; inventoryN = 1`, and the villain's
 * `use_item` (`DoAction@0x23e7cf` `+0x03ec`/`+0x0409`) does the same for the
 * FIRST slot holding the id. Either way the potion is spent before it is drunk.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, lastResolvedAction, legalActions,
  suggestAction, toTeamWireState
} from "../src/team/index.js";
import {
  SS2_INVENTORY_EMPTY, SS2_POTION_LADDER, SS2_POTIONS, Ss2ActionType, VANILLA_PHASE_LABEL,
  createSs2TeamRules, ss2Combatant, ss2InventorySlotHolding, ss2TeamRules
} from "../src/team/ss2-rules.js";
import {
  buildArenaLayout, CommandKind, LabelProvenance, presentResolvedEvents, SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import { timelineFor } from "../src/render/timeline.js";
import { allUnmappedLabels, clipLabelsFor } from "../src/render/clip-labels.js";

const DRINK = Ss2ActionType.DRINK_POTION;
const POTION_IDS = [2, 3, 4, 5, 6, 7, 8, 9];

// The shared fighter. `hitpointsmax = herolevel * 10 + vitality * 20` = 170,
// `staminamax = 100 + stamina * 10` = 160, and `nextphase` regenerates
// `1 + round(stamina / 3)` = 3 stamina and heals `1 + ceil(stamina / 2)` = 4.
const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});
const MAX_HP = 170;
const MAX_STAMINA = 160;
const REGEN = 3;
const HEAL = 4;
/** `helmet: 4, breastplate: 6` is 136 armour at most, as `test/ss2-gale.test.js` measures. */
const ARMOURED = Object.freeze({ helmet: 4, breastplate: 6 });
const MAX_ARMOUR = 136;

/** A 1v1 with the drinker on RED, opening. Same staging as the gale's and the bolt's. */
function staged({ hero = {}, foe = {}, heroX = -60, foeX = 60, controller = "local" } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
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
  assert.equal(currentCombatant(battle).id, "hero", "the drinker must open for these tests to mean anything");
  return battle;
}

/** Stage the drinker's three pools. The live bag is `{value, min, max}`, not a bare number. */
function pools(battle, { health, staminaleft, armourclass, armourclassMax } = {}) {
  const hero = combatantById(battle, "hero");
  if (health !== undefined) hero.health = health;
  if (staminaleft !== undefined) hero.resources.staminaleft.value = staminaleft;
  if (armourclass !== undefined) hero.resources.armourclass.value = armourclass;
  if (armourclassMax !== undefined) hero.resources.armourclass_max.value = armourclassMax;
  return hero;
}

const drinkOptions = (battle, id = "hero") => legalActions(battle, id).filter((option) => option.type === DRINK);
const drinkIds = (battle, id = "hero") => drinkOptions(battle, id).map((option) => option.itemId);

/** Drink, and hand back the drink's own event off the battle log. */
function drink(battle, itemId, actorId = "hero") {
  applyAction(battle, { actorId, type: DRINK, targetId: actorId, itemId });
  const event = battle.events.at(-1);
  assert.equal(event.type, DRINK, "the drink's own event is the last one logged");
  return event;
}

const heroOf = (battle) => combatantById(battle, "hero");
const staminaOf = (battle) => heroOf(battle).resources.staminaleft.value;
const armourOf = (battle) => heroOf(battle).resources.armourclass.value;

/* ------------------------------------------------------------------ *
 * The vocabulary                                                      *
 * ------------------------------------------------------------------ */

test("the token is `drink-potion` and it round-trips to the build's own `drink_potion`", () => {
  assert.equal(DRINK, "drink-potion");
  assert.equal(VANILLA_PHASE_LABEL[DRINK], "drink_potion");
  assert.ok(createSs2TeamRules().actionTypes.includes(DRINK));
});

test("the potion table is the build's eight arms, one stat and one splat frame each", () => {
  // Eight INDEPENDENT `if`s on `inventory_action`, `+0x5807`-`+0x5cc2`.
  assert.deepEqual(Object.keys(SS2_POTIONS).map(Number), POTION_IDS);
  const row = (id) => {
    const { stat, of, multiplier, rounded, bonusFrame } = SS2_POTIONS[id];
    return { stat, of, multiplier, rounded, bonusFrame };
  };
  assert.deepEqual(row(2), { stat: "hitpoints", of: "hitpointsmax", multiplier: 0.25, rounded: true, bonusFrame: 1 });
  assert.deepEqual(row(3), { stat: "hitpoints", of: "hitpointsmax", multiplier: 0.5, rounded: true, bonusFrame: 1 });
  assert.deepEqual(row(4), { stat: "hitpoints", of: "hitpointsmax", multiplier: 0.75, rounded: true, bonusFrame: 1 });
  // `Push "bonus", hitpointsmax; SetVariable` at `+0x5a32` — no Multiply, no Math.round.
  assert.deepEqual(row(5), { stat: "hitpoints", of: "hitpointsmax", multiplier: null, rounded: false, bonusFrame: 1 });
  assert.deepEqual(row(6), { stat: "staminaleft", of: "staminamax", multiplier: 0.5, rounded: true, bonusFrame: 2 });
  // `Math.round(staminamax)` at `+0x5b74` — rounded, but no Multiply.
  assert.deepEqual(row(7), { stat: "staminaleft", of: "staminamax", multiplier: null, rounded: true, bonusFrame: 2 });
  // The CURRENT armour, not the maximum: `Push armourclass; GetMember` at `+0x5c1f`.
  assert.deepEqual(row(8), { stat: "armourclass", of: "armourclass", multiplier: 0.5, rounded: true, bonusFrame: 3 });
  assert.deepEqual(row(9), { stat: "armourclass", of: "armourclass_max", multiplier: null, rounded: true, bonusFrame: 3 });
});

/* ------------------------------------------------------------------ *
 * The offer                                                           *
 * ------------------------------------------------------------------ */

test("a gladiator carrying no inventory is offered no drink", () => {
  assert.deepEqual(drinkOptions(staged()), []);
});

test("each potion id held is offered ONCE, self-targeted, carrying its id", () => {
  const battle = staged({ hero: { inventory1: 9, inventory2: 2, inventory3: 6 } });
  assert.deepEqual(drinkOptions(battle), [
    { type: DRINK, targetId: "hero", itemId: 2 },
    { type: DRINK, targetId: "hero", itemId: 6 },
    { type: DRINK, targetId: "hero", itemId: 9 }
  ]);
});

test("every id 2-9 is a drink, and no other id is", () => {
  for (const id of POTION_IDS) {
    assert.deepEqual(drinkIds(staged({ hero: { inventory1: id } })), [id], `id ${id}`);
  }
  // 34 is a bolt, 38 the gale, 43 an unbuilt spell, 10 a real non-potion row.
  for (const id of [10, 34, 38, 43]) {
    assert.deepEqual(drinkIds(staged({ hero: { inventory1: id } })), [], `id ${id}`);
  }
});

test("two slots holding the same potion are ONE offer, not two", () => {
  assert.deepEqual(drinkIds(staged({ hero: { inventory1: 3, inventory4: 3 } })), [3]);
});

test("a slot holding the EMPTY marker 1, or 0, offers no drink", () => {
  assert.deepEqual(drinkIds(staged({ hero: { inventory1: SS2_INVENTORY_EMPTY } })), []);
  assert.deepEqual(drinkIds(staged({ hero: { inventory1: 0 } })), []);
});

test("an UNDECLARED slot is not searched", () => {
  const battle = staged({ hero: { inventory2: 4 } });
  assert.equal(Object.hasOwn(heroOf(battle).resources, "inventory1"), false);
  assert.equal(ss2InventorySlotHolding(heroOf(battle), 4), "inventory2");
  assert.deepEqual(drinkIds(battle), [4]);
});

test("the slot window applies: a potion in slot 3 at inventory_maxslots 2 is not offered", () => {
  assert.deepEqual(drinkIds(staged({ hero: { inventory3: 5, inventory_maxslots: 2 } })), []);
  assert.deepEqual(drinkIds(staged({ hero: { inventory2: 5, inventory_maxslots: 2 } })), [5]);
});

test("a potion is offered at FULL health, because the build's button does not ask", () => {
  // The hero's click handler (`+0x05ca`-`+0x0638` for slot 1) tests only
  // `inv_struck != true`; the phase itself tests nothing before it writes.
  const battle = staged({ hero: { inventory1: 5 } });
  assert.equal(heroOf(battle).health, heroOf(battle).maxHealth);
  assert.deepEqual(drinkIds(battle), [5]);
});

test("a forced rest still outranks the drink, a stamina vial included", () => {
  const battle = staged({ hero: { inventory1: 7 } });
  pools(battle, { staminaleft: 0 });
  assert.deepEqual(legalActions(battle, "hero").map((option) => option.type), [Ss2ActionType.REST]);
});

/* ------------------------------------------------------------------ *
 * Legality: the id is part of the action                              *
 * ------------------------------------------------------------------ */

test("a drink must name a potion the drinker holds, and name the drinker", () => {
  const battle = staged({ hero: { inventory1: 2 } });
  // Not held.
  assert.throws(() => applyAction(battle, { actorId: "hero", type: DRINK, targetId: "hero", itemId: 5 }),
    /Illegal action/);
  // No id at all — the label alone cannot say which of eight potions.
  assert.throws(() => applyAction(battle, { actorId: "hero", type: DRINK, targetId: "hero" }), /Illegal action/);
  // Aimed at somebody else.
  assert.throws(() => applyAction(battle, { actorId: "hero", type: DRINK, targetId: "foe", itemId: 2 }),
    /Illegal action/);
  // And the legal one still goes through.
  assert.equal(drink(battle, 2).itemId, 2);
});

test("resolveAction refuses a non-potion id and an unheld potion, by name", () => {
  const battle = staged({ hero: { inventory1: 2 } });
  const hero = heroOf(battle);
  const request = (itemId) => ({
    type: DRINK, turnNumber: battle.turnNumber, actor: hero, target: hero, targetId: hero.id, itemId,
    allies: [hero], foes: [combatantById(battle, "foe")]
  });
  const rolls = { randomBetween: () => 1, randomNumber: () => 0 };
  assert.throws(() => ss2TeamRules.resolveAction(request(34), rolls), /not a potion/);
  assert.throws(() => ss2TeamRules.resolveAction(request(undefined), rolls), /not a potion/);
  assert.throws(() => ss2TeamRules.resolveAction(request(5), rolls), /no declared inventory slot holds item 5/);
  // The arm writes only `game_attacker`, so a drink aimed at the foe is a
  // malformed request, not a way to heal him.
  const foe = combatantById(battle, "foe");
  assert.throws(() => ss2TeamRules.resolveAction({ ...request(2), target: foe, targetId: foe.id }, rolls),
    /is drunk by the drinker/);
});

/* ------------------------------------------------------------------ *
 * The phase                                                           *
 * ------------------------------------------------------------------ */

test("a drink takes ZERO samples, whichever potion it is", () => {
  // No `randomBetween`, `RandomNumber` or `checkattackroll` over `+0x576d`-`+0x5dad`.
  for (const id of POTION_IDS) {
    const battle = staged({ hero: { inventory1: id, ...ARMOURED } });
    const before = battle.rng.cursor;
    drink(battle, id);
    assert.equal(battle.rng.cursor, before, `id ${id}`);
  }
});

test("the eight potions, each against the pool it names", () => {
  // Staged low on everything so no drink here overflows but 5, 7 and 9; the
  // .5 cases are chosen so `Math.round` is visible (170 * 0.25 = 42.5 -> 43,
  // 170 * 0.75 = 127.5 -> 128, 31 * 0.5 = 15.5 -> 16).
  const cases = [
    { id: 2, stat: "hitpoints", before: 50, bonus: 43, after: 93 },
    { id: 3, stat: "hitpoints", before: 50, bonus: 85, after: 135 },
    { id: 4, stat: "hitpoints", before: 30, bonus: 128, after: 158 },
    { id: 5, stat: "hitpoints", before: 40, bonus: 170, after: 170 },
    { id: 6, stat: "staminaleft", before: 20, bonus: 80, after: 100 },
    { id: 7, stat: "staminaleft", before: 20, bonus: 160, after: 160 },
    { id: 8, stat: "armourclass", before: 31, bonus: 16, after: 47 },
    { id: 9, stat: "armourclass", before: 31, bonus: 136, after: 136 }
  ];
  for (const { id, stat, before, bonus, after } of cases) {
    const battle = staged({ hero: { inventory1: id, ...ARMOURED } });
    assert.equal(heroOf(battle).resources.armourclass_max.value, MAX_ARMOUR);
    pools(battle, {
      health: stat === "hitpoints" ? before : 60,
      staminaleft: stat === "staminaleft" ? before : 40,
      armourclass: stat === "armourclass" ? before : 31
    });
    const event = drink(battle, id);
    assert.deepEqual(
      { stat: event.stat, bonus: event.bonus, statBefore: event.statBefore, statAfter: event.statAfter },
      { stat, bonus, statBefore: before, statAfter: after },
      `id ${id}`
    );
    // The two pools the potion does NOT name are untouched by the drink; only
    // `nextphase` moves them.
    if (stat !== "hitpoints") assert.equal(heroOf(battle).health, 60 + HEAL, `id ${id}: health`);
    if (stat !== "staminaleft") assert.equal(staminaOf(battle), 40 + REGEN, `id ${id}: stamina`);
    if (stat !== "armourclass") assert.equal(armourOf(battle), 31, `id ${id}: armour`);
  }
});

test("id 5 OVERFLOWS and is capped by check_stats; the event keeps the unclamped bonus", () => {
  const battle = staged({ hero: { inventory1: 5 } });
  pools(battle, { health: 40 });
  const event = drink(battle, 5);
  // `bonus_icon.bonus = "+ " + bonus` shows the UNCLAMPED 170.
  assert.equal(event.bonus, MAX_HP);
  assert.equal(event.statAfter, MAX_HP);
  assert.equal(heroOf(battle).health, MAX_HP);
});

test("id 8 on NO armour does nothing, because half of nothing is nothing", () => {
  // `round(armourclass * 0.5)` reads the CURRENT value (`+0x5c1f`).
  const battle = staged({ hero: { inventory1: 8, ...ARMOURED } });
  pools(battle, { armourclass: 0 });
  const event = drink(battle, 8);
  assert.equal(event.bonus, 0);
  assert.equal(event.statAfter, 0);
  assert.equal(armourOf(battle), 0);
  // And the potion is still spent.
  assert.equal(heroOf(battle).resources.inventory1.value, SS2_INVENTORY_EMPTY);
});

test("id 9 restores ALL the armour from nothing, because it adds the maximum", () => {
  const battle = staged({ hero: { inventory1: 9, ...ARMOURED } });
  pools(battle, { armourclass: 0 });
  const event = drink(battle, 9);
  assert.equal(event.bonus, MAX_ARMOUR);
  assert.equal(armourOf(battle), MAX_ARMOUR);
});

test("an armour potion on an UNARMOURED gladiator is capped at its maximum of 0", () => {
  const battle = staged({ hero: { inventory1: 9 } });
  assert.equal(heroOf(battle).resources.armourclass_max.value, 0);
  assert.equal(drink(battle, 9).statAfter, 0);
  assert.equal(armourOf(battle), 0);
});

test("check_stats clamps ALL THREE pools, not only the one the potion named", () => {
  // `+0x110a`-`+0x11ff`: staminaleft, hitpoints and armourclass in turn. A
  // health potion drunk over an armour value staged above its maximum brings
  // the armour down too — the build's clamp, not a cleanup of this engine's.
  const battle = staged({ hero: { inventory1: 2, ...ARMOURED } });
  pools(battle, { health: 50, armourclass: MAX_ARMOUR + 20 });
  drink(battle, 2);
  assert.equal(armourOf(battle), MAX_ARMOUR);
});

test("drinking CONSUMES the first slot holding the potion, and the offer goes with the last one", () => {
  const battle = staged({ hero: { inventory2: 3, inventory5: 3 } });
  const first = drink(battle, 3);
  assert.equal(first.consumedSlot, "inventory2");
  assert.equal(heroOf(battle).resources.inventory2.value, SS2_INVENTORY_EMPTY);
  assert.equal(heroOf(battle).resources.inventory5.value, 3);
  assert.deepEqual(drinkIds(battle), [3], "the second vial is still there");

  // The foe's turn, then the second vial.
  applyAction(battle, { actorId: "foe", type: Ss2ActionType.REST, targetId: "foe" });
  assert.equal(drink(battle, 3).consumedSlot, "inventory5");
  assert.equal(heroOf(battle).resources.inventory5.value, SS2_INVENTORY_EMPTY);
  assert.deepEqual(drinkIds(battle), [], "and with the last one spent, the offer is gone");
});

test("the phase costs NOTHING, and the drinker still gets nextphase's regeneration and heal", () => {
  // `game_attacker.staminacost = 0` at `+0x578c`, then an ordinary `nextphase`.
  const battle = staged({ hero: { inventory1: 8, ...ARMOURED } });
  pools(battle, { health: 60, staminaleft: 40, armourclass: 31 });
  const event = drink(battle, 8);
  assert.equal(event.staminaSpent, 0);
  assert.equal(event.staminaGained, REGEN);
  assert.equal(event.healed, HEAL);
  assert.equal(staminaOf(battle), 40 + REGEN);
  assert.equal(heroOf(battle).health, 60 + HEAL);
});

test("a drink is an ordinary decision, so nextphase resets a psyche charge", () => {
  const battle = staged({ hero: { inventory1: 2, psyche_up: 3 } });
  drink(battle, 2);
  assert.equal(heroOf(battle).resources.psyche_up.value, 1);
});

/* ------------------------------------------------------------------ *
 * The order: write, check_stats, THEN nextphase                       *
 * ------------------------------------------------------------------ */

test("a stamina vial is not undone by the transition: nextphase regenerates FROM the drink", () => {
  // If the transition were computed from the pre-drink 20 it would write
  // `staminaleft = 23` AFTER the vial's 160 and the potion would vanish.
  const battle = staged({ hero: { inventory1: 7 } });
  pools(battle, { staminaleft: 20 });
  const event = drink(battle, 7);
  assert.equal(staminaOf(battle), MAX_STAMINA);
  assert.equal(event.staminaGained, 0, "the cap already swallowed the regeneration");

  const partial = staged({ hero: { inventory1: 6 } });
  pools(partial, { staminaleft: 20 });
  drink(partial, 6);
  assert.equal(staminaOf(partial), 20 + 80 + REGEN);
});

test("id 5 at 40/170 fills the pool, so nextphase's heal is computed from the FULL pool and is 0", () => {
  // `check_stats` at `+0x5d67` caps the drink BEFORE `nextphase` heals. A heal
  // computed from the stale 40 would report 4 and emit a second HEAL that the
  // resolver's clamp then quietly discards.
  const battle = staged({ hero: { inventory1: 5 } });
  pools(battle, { health: 40 });
  const event = drink(battle, 5);
  assert.equal(event.healed, 0);
  const heals = lastResolvedAction(battle).effects.filter((effect) => effect.kind === "heal");
  assert.deepEqual(heals.map((effect) => effect.amount), [MAX_HP - 40], "one heal, the potion's, and no regen heal");
});

test("a drink that stops short of the cap leaves nextphase exactly the headroom above it", () => {
  // 50 + 85 = 135 with the cap at 170: the heal runs from 135, so it is the
  // full 4. At 83 + 85 = 168 it is the remaining 2.
  const roomy = staged({ hero: { inventory1: 3 } });
  pools(roomy, { health: 50 });
  assert.equal(drink(roomy, 3).healed, HEAL);
  assert.equal(heroOf(roomy).health, 135 + HEAL);

  const tight = staged({ hero: { inventory1: 3 } });
  pools(tight, { health: 83 });
  assert.equal(drink(tight, 3).healed, 2);
  assert.equal(heroOf(tight).health, MAX_HP);
});

/* ------------------------------------------------------------------ *
 * The event                                                           *
 * ------------------------------------------------------------------ */

test("the event names the potion, the pool, the clip and the frames the build plays", () => {
  const battle = staged({ hero: { inventory3: 6 } });
  pools(battle, { staminaleft: 20 });
  const event = drink(battle, 6);
  assert.equal(event.actorId, "hero");
  assert.equal(event.targetId, "hero");
  assert.equal(event.vanillaLabel, "drink_potion");
  // `attacker.gotoAndPlay("drink_potion")` at `+0x57c6`, on the drinker only.
  assert.equal(event.casterClip, "drink_potion");
  assert.equal(event.victimClip, null);
  assert.equal(event.itemId, 6);
  assert.equal(event.consumedSlot, "inventory3");
  // `damage_splat.gotoAndStop(2)` for a stamina vial (`+0x5b2a`), and
  // `potions.gotoAndPlay(inventory_action - 1)` (`+0x57da`).
  assert.equal(event.bonusFrame, 2);
  assert.equal(event.potionFrame, 5);
  // No field the presentation layer reads as the ACTOR walking.
  for (const field of ["from", "to", "fromY", "toY", "condition", "boltFrame"]) {
    assert.equal(Object.hasOwn(event, field), false, `${field} must not be on a drink event`);
  }
});

/* ------------------------------------------------------------------ *
 * The presentation                                                    *
 * ------------------------------------------------------------------ */

test("a presented drink plays drink_potion on the drinker, MAP_NAMED, and nothing on anybody else", () => {
  const battle = staged({ hero: { inventory1: 4 } });
  pools(battle, { health: 30 });
  drink(battle, 4);
  const wire = toTeamWireState(battle);
  const { commands } = presentResolvedEvents(wire, {
    layout: buildArenaLayout(wire),
    bindings: SS2_STATIC_MAP_BINDINGS
  });
  const clips = commands.filter((command) => command.kind === CommandKind.CLIP_GOTO);
  assert.deepEqual(
    clips.map(({ combatantId, role, label, labelProvenance }) => ({ combatantId, role, label, labelProvenance })),
    [{ combatantId: "hero", role: "actor", label: "drink_potion", labelProvenance: LabelProvenance.MAP_NAMED }]
  );
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), []);
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.MOVE_CLIP), []);
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.ATTACH_EFFECT), []);
});

test("drink_potion resolves to a family that can DRAW it, for the build's own length", () => {
  const timeline = timelineFor("drink_potion", { role: "actor" });
  assert.equal(timeline.recognised, true, "drink_potion must not fall to the `unknown` schedule");
  assert.equal(timeline.family, "drink");
  assert.ok(clipLabelsFor(timeline.family).includes("drink_potion"));
  // Frames 1887-1910 and a `Stop` inside its own span: 24 frames at 30 fps is
  // 800 ms = 6.67 beats of 120 ms, and the nearest beat is 7 = 840 ms — the
  // rule `shove`'s 35 frames -> 10 beats and `Cast2`'s 21 -> 6 follow.
  assert.equal(timeline.durationMs, 840);
});

test("drink_potion is PLAYED now, so it leaves the declared-unplayed list", () => {
  const unplayed = new Set(allUnmappedLabels());
  assert.equal(unplayed.has("drink_potion"), false);
  // The two spells still without a verb stay.
  assert.ok(unplayed.has("colossus"));
  assert.ok(unplayed.has("rejuvinate"));
});

/* ------------------------------------------------------------------ *
 * The AI                                                              *
 *                                                                     *
 * The build's own rule: arms 2, 4-6, 10-13 of `villain_cast_spells`   *
 * (block base `0x23e7d5`), each `check_inventory(id) && pool < max/2` *
 * with a strict `Less2`, health 5>4>3>2, then armour 9>8, then        *
 * stamina 7>6 — all AFTER one 90% roll this AI does not take, and all *
 * BEFORE the bolt arms (15, 17) and the gale (24).                    *
 * ------------------------------------------------------------------ */

function aiDrinker({ inventory = {}, health, staminaleft, armourclass, extra = {}, foeX = 120 } = {}) {
  const battle = staged({ controller: "ai", hero: { ...ARMOURED, ...inventory, ...extra }, heroX: 0, foeX });
  pools(battle, { health, staminaleft, armourclass });
  return battle;
}

test("the ladder is the build's order: 5, 4, 3, 2, then 9, 8, then 7, 6", () => {
  assert.deepEqual(SS2_POTION_LADDER.map(({ itemId }) => itemId), [5, 4, 3, 2, 9, 8, 7, 6]);
  assert.deepEqual(SS2_POTION_LADDER.map(({ arm }) => arm), [2, 4, 5, 6, 10, 11, 12, 13]);
});

test("below half health, an AI holding a health potion drinks it", () => {
  const battle = aiDrinker({ inventory: { inventory1: 2 }, health: 84 });
  assert.deepEqual(suggestAction(battle, "hero"), { type: DRINK, targetId: "hero", itemId: 2 });
});

test("at EXACTLY half the health arms are shut (strict `<`), and the AI does what it would without", () => {
  const battle = aiDrinker({ inventory: { inventory1: 2 }, health: 85 });
  const shut = suggestAction(battle, "hero");
  assert.notEqual(shut.type, DRINK);
  heroOf(battle).resources.inventory1.value = SS2_INVENTORY_EMPTY;
  assert.deepEqual(suggestAction(battle, "hero"), shut);
});

test("the biggest health potion first: 5 before 4 before 3 before 2", () => {
  const all = aiDrinker({ inventory: { inventory1: 2, inventory2: 3, inventory3: 4, inventory4: 5 }, health: 20 });
  assert.equal(suggestAction(all, "hero").itemId, 5);
  const small = aiDrinker({ inventory: { inventory1: 2, inventory2: 3 }, health: 20 });
  assert.equal(suggestAction(small, "hero").itemId, 3);
});

test("health before armour before stamina, whatever order the slots hold them in", () => {
  const everything = { inventory1: 6, inventory2: 9, inventory3: 2 };
  assert.equal(suggestAction(aiDrinker({ inventory: everything, health: 20, staminaleft: 20, armourclass: 10 }), "hero").itemId, 2);
  assert.equal(suggestAction(aiDrinker({ inventory: everything, staminaleft: 20, armourclass: 10 }), "hero").itemId, 9);
  assert.equal(suggestAction(aiDrinker({ inventory: everything, staminaleft: 20 }), "hero").itemId, 6);
  assert.equal(suggestAction(aiDrinker({ inventory: { inventory1: 8, inventory2: 9 }, armourclass: 10 }), "hero").itemId, 9);
  assert.equal(suggestAction(aiDrinker({ inventory: { inventory1: 6, inventory2: 7 }, staminaleft: 20 }), "hero").itemId, 7);
});

test("each pool gates only its own potions, at its own strict half", () => {
  // Armour below half, health full: the health potion is not drunk.
  assert.notEqual(suggestAction(aiDrinker({ inventory: { inventory1: 2 }, armourclass: 10 }), "hero").type, DRINK);
  // Armour at exactly 68 of 136 is not below half.
  assert.notEqual(suggestAction(aiDrinker({ inventory: { inventory1: 9 }, armourclass: 68 }), "hero").type, DRINK);
  assert.equal(suggestAction(aiDrinker({ inventory: { inventory1: 9 }, armourclass: 67 }), "hero").itemId, 9);
  // Stamina at exactly 80 of 160 is not below half.
  assert.notEqual(suggestAction(aiDrinker({ inventory: { inventory1: 7 }, staminaleft: 80 }), "hero").type, DRINK);
  assert.equal(suggestAction(aiDrinker({ inventory: { inventory1: 7 }, staminaleft: 79 }), "hero").itemId, 7);
});

test("an UNARMOURED AI never drinks armour oil, because 0 < 0 / 2 is false", () => {
  const battle = staged({ controller: "ai", hero: { inventory1: 9 }, heroX: 0, foeX: 120 });
  assert.equal(heroOf(battle).resources.armourclass_max.value, 0);
  assert.notEqual(suggestAction(battle, "hero").type, DRINK);
});

test("a potion PRE-EMPTS a bolt, because arms 2-13 come before arms 15 and 17", () => {
  const battle = aiDrinker({ inventory: { inventory1: 34, inventory2: 3 }, health: 20 });
  assert.equal(suggestAction(battle, "hero").itemId, 3);
  // The control: at full health the same gladiator casts.
  const healthy = aiDrinker({ inventory: { inventory1: 34, inventory2: 3 } });
  assert.equal(suggestAction(healthy, "hero").type, Ss2ActionType.CAST_LIGHTNING_BOLT);
});

test("armour oil PRE-EMPTS the gale, whose armour condition is the same one", () => {
  // Arm 10 (`armourclass < armourclass_max / 2`, id 9) precedes arm 24, whose
  // fifth condition is the identical test — so a villain carrying both oils up
  // rather than blowing the foe away.
  const battle = aiDrinker({ inventory: { inventory1: 38, inventory2: 9 }, armourclass: 20 });
  assert.equal(suggestAction(battle, "hero").itemId, 9);
  heroOf(battle).resources.inventory2.value = SS2_INVENTORY_EMPTY;
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_GALE);
});

test("a health potion PRE-EMPTS the teleport, whose health condition is the same one", () => {
  // Arm 2 (id 5, `hitpoints < hitpointsmax / 2`) precedes arm 26, which tests
  // the identical half. Added by the main session when the two verbs, built in
  // parallel worktrees, were merged on 2026-09-22 — neither worktree could see
  // the other's verb, so neither could pin this.
  const battle = aiDrinker({ inventory: { inventory1: 48, inventory2: 5 }, health: 60 });
  assert.equal(suggestAction(battle, "hero").itemId, 5);
  heroOf(battle).resources.inventory2.value = SS2_INVENTORY_EMPTY;
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_TELEPORT);
});

test("the forced rest still outranks a stamina vial at 10 stamina or less", () => {
  // `villainChooseAction`'s `staminaleft > 10` gate (`+0x03e8`) is this AI's
  // first decision, as it is for the bolts and the gale. WHETHER the build's
  // `villain_cast_spells()` call sits inside that gate is not in any dump this
  // derivation read; see the open question at the site.
  const battle = aiDrinker({ inventory: { inventory1: 7 }, staminaleft: 10 });
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.REST);
  assert.equal(suggestAction(aiDrinker({ inventory: { inventory1: 7 }, staminaleft: 11 }), "hero").itemId, 7);
});

test("the AI takes no sample to decide, so the build's 90% roll is not reproduced", () => {
  const battle = aiDrinker({ inventory: { inventory1: 2 }, health: 20 });
  const before = battle.rng.cursor;
  suggestAction(battle, "hero");
  assert.equal(battle.rng.cursor, before);
});

test("an AI bout that drinks runs to a result through the ordinary host path", () => {
  // The whole loop, not one decision: an AI-vs-AI bout where one side carries
  // every potion must still end, and must drink along the way.
  const battle = createTeamBattle({
    seed: 5,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(
          fields({ speed: 21, inventory1: 5, inventory2: 3, inventory3: 7, inventory4: 9, ...ARMOURED }),
          { id: "hero", name: "hero", controller: "ai" }
        )]
      },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ strength: 20 }), { id: "foe", name: "foe", controller: "ai" })] }
    ]
  });
  let guard = 0;
  while (!battle.result && guard < 2000) {
    const actor = currentCombatant(battle);
    applyAction(battle, { actorId: actor.id, ...suggestAction(battle, actor.id) });
    guard += 1;
  }
  assert.ok(battle.result, "the bout must end");
  assert.ok(battle.events.some((event) => event.type === DRINK), "and the drinker must have drunk");
});
