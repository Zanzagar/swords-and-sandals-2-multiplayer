/**
 * The AI's tired rest, in the build's ORDER: the spell ladder is consulted
 * before it, and it applies only IN RANGE.
 *
 * ## WHAT THE BUILD DOES, AND WHERE
 *
 * The villain's decision function (the anonymous function in
 * `sprite:862[overlay]/frame:52/DoAction@0x23f835`, base `0x23f83b`; re-read
 * 2026-09-22 from the main session's dump of it):
 *
 * ```text
 *   if ((villain.equipped_weapon == 1 && fightdistance < villain.weapon_range)   +0x034f-+0x038f
 *    || (villain.equipped_weapon == 2 && !(fightdistance < 200))) {            +0x0397-+0x03d3
 *     if (villain.staminaleft > 10) { ... the in-range choices bands ... }      +0x03e8
 *     else villaindecisionA = "rest"                                            +0x08b6
 *   } else { ... the out-of-range choices bands ... }                           +0x08c3
 *   ... swap, psyche, staminaleft > 0, taunted runs, the four statuses ...
 *   villain_cast_spells()                                                       +0x1432
 * ```
 *
 * 122 branches, none backward and none past `+0x1432`, so the ladder call is
 * the function's unconditional last statement; the ladder never reads
 * `villaindecisionA` (every arm's `GetVariable` is `item_used`). So:
 *
 * - **a tired villain IN RANGE rests, and the ladder can replace the rest** —
 *   a stamina vial on its `staminaleft < staminamax / 2` arm (always true at
 *   10 or less, since `staminamax >= 100`), a bolt or fireball on possession,
 *   the gale, weaken, boundless energy and teleport on their own gates;
 * - **a tired villain OUT of range is never sent to rest by this gate**: the
 *   out-of-range bands carry only the percentage-banded, randomly drawn rests
 *   this AI does not reproduce.
 *
 * The ladder's own `randomBetween(1, 100) > 10` (`villain_cast_spells`
 * `+0x056f`) is omitted, as everywhere in this AI: it takes no samples, so it
 * behaves as though the roll always passes.
 *
 * ## HOW THIS ENGINE SAYS "IN RANGE"
 *
 * By the VOCABULARY, the way every other arm of `chooseAiAction` does: in
 * range means `legalActions` offered one of the build's in-range verbs — the
 * three melee swings (`closerange_warrior`) or the two shots
 * (`longrange_archer`). A drawn bow closed on is offered only `bash_attack`
 * (`closerange_archer`), which is the build's `equipped_weapon == 2 &&
 * fightdistance < 200` — OUT of range.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { combatantById, createTeamBattle, currentCombatant, legalActions, suggestAction } from "../src/team/index.js";
import { Ss2ActionType, ss2Combatant, ss2StatusToken, ss2TeamRules } from "../src/team/ss2-rules.js";

// The drink-potion suite's fighter: `staminamax = 100 + stamina * 10` = 160,
// `hitpointsmax = herolevel * 10 + vitality * 20` = 170, and strength 9 with
// weapon 1 reaches `ss2Reach` = 130, so a foe at 120 is in melee reach and one
// at 1000 is not.
const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});
const ARMOURED = Object.freeze({ helmet: 4, breastplate: 6 });
const IN_REACH = 120;
const OUT_OF_REACH = 1000;
const TIRED = 10;

/** A 1v1, the AI on RED and opening, the foe at `foeX`. */
function staged({ hero = {}, foeX = IN_REACH, staminaleft = TIRED, health, armourclass } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller: "ai" })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: "left" }), { id: "foe", name: "foe", controller: "ai" })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: 0, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: foeX, y: 200 });
  assert.equal(currentCombatant(battle).id, "hero", "the AI must open for these tests to mean anything");
  const actor = combatantById(battle, "hero");
  actor.resources.staminaleft.value = staminaleft;
  if (health !== undefined) actor.health = health;
  if (armourclass !== undefined) actor.resources.armourclass.value = armourclass;
  return battle;
}

const typesOf = (battle) => legalActions(battle, "hero").map((option) => option.type);
const choose = (battle) => suggestAction(battle, "hero");

/* ------------------------------------------------------------------ *
 * In range: the ladder first, then the rest                           *
 * ------------------------------------------------------------------ */

test("the staging is what the tests say: a swing is on offer at 120 and none at 1000", () => {
  assert.ok(typesOf(staged()).includes(Ss2ActionType.QUICK_ATTACK));
  assert.ok(!typesOf(staged({ foeX: OUT_OF_REACH })).includes(Ss2ActionType.QUICK_ATTACK));
});

test("tired IN RANGE with nothing on the ladder, the AI rests — the one gate, where the build has it", () => {
  for (const staminaleft of [1, 5, TIRED]) {
    assert.deepEqual(choose(staged({ staminaleft })), { type: Ss2ActionType.REST, targetId: "hero" }, `staminaleft ${staminaleft}`);
  }
  // `staminaleft > 10` is strict: at 11 the in-range bands run, and this AI swings.
  assert.notEqual(choose(staged({ staminaleft: 11 })).type, Ss2ActionType.REST);
});

test("tired IN RANGE with a stamina vial, the AI DRINKS: arm 12 replaces the rest", () => {
  assert.deepEqual(choose(staged({ hero: { inventory1: 7 } })), { type: Ss2ActionType.DRINK_POTION, targetId: "hero", itemId: 7 });
  assert.deepEqual(choose(staged({ hero: { inventory1: 6 } })), { type: Ss2ActionType.DRINK_POTION, targetId: "hero", itemId: 6 });
});

test("tired IN RANGE with a bolt, the AI CASTS it, and in the ladder's order", () => {
  assert.deepEqual(choose(staged({ hero: { inventory1: 34 } })), { type: Ss2ActionType.CAST_LIGHTNING_BOLT, targetId: "foe" });
  assert.deepEqual(choose(staged({ hero: { inventory1: 30 } })), { type: Ss2ActionType.CAST_FIREBALL, targetId: "foe" });
  // Arm 17 (34) precedes arm 18 (30), whichever slot holds which.
  assert.equal(choose(staged({ hero: { inventory1: 30, inventory2: 34 } })).type, Ss2ActionType.CAST_LIGHTNING_BOLT);
});

test("tired IN RANGE, every other ladder arm this engine holds replaces the rest on its own gate", () => {
  // Arm 3: `check_inventory(46) && hitpoints < hitpointsmax / 2`.
  assert.equal(choose(staged({ hero: { inventory1: 46 }, health: 60 })).type, Ss2ActionType.CAST_REGENERATE);
  // Arm 19: `check_inventory(44) && fightdistance < 300`.
  assert.equal(choose(staged({ hero: { inventory1: 44 } })).type, Ss2ActionType.CAST_WEAKEN_ARMOUR);
  // Arm 23: `check_inventory(45)`, possession alone.
  assert.equal(choose(staged({ hero: { inventory1: 45 } })).type, Ss2ActionType.CAST_BOUNDLESS_ENERGY);
  // Arm 24: `check_inventory(38) && fightdistance < 400 && armourclass < armourclass_max / 2`.
  assert.equal(choose(staged({ hero: { inventory1: 38, ...ARMOURED }, armourclass: 10 })).type, Ss2ActionType.CAST_GALE);
  // Arm 26: `check_inventory(48) && fightdistance < 250 && hitpoints < hitpointsmax / 2`.
  assert.equal(choose(staged({ hero: { inventory1: 48 }, health: 60 })).type, Ss2ActionType.CAST_TELEPORT);
});

test("tired IN RANGE, a ladder arm whose gate is SHUT still leaves the rest", () => {
  // The regenerate and the teleport at full health, the gale unarmoured: each
  // item is carried and offered, and none of their gates is open.
  for (const item of [46, 48, 38]) {
    const battle = staged({ hero: { inventory1: item } });
    assert.equal(choose(battle).type, Ss2ActionType.REST, `item ${item}`);
  }
});

test("a drawn bow with the foe beyond the floor is IN RANGE, and rests tired", () => {
  const battle = staged({ hero: { secondary_weapon: 61, equipped_weapon: 2 }, foeX: OUT_OF_REACH });
  assert.ok(typesOf(battle).includes(Ss2ActionType.BOMBARD), "the long-range archer frame");
  assert.equal(choose(battle).type, Ss2ActionType.REST);
});

/* ------------------------------------------------------------------ *
 * Out of range: the gate does not apply                               *
 * ------------------------------------------------------------------ */

test("tired OUT of range, the AI does NOT rest: it does what it would untired", () => {
  const tired = staged({ foeX: OUT_OF_REACH });
  // 11 is above the gate and still below the taunt's 50%, so the option list is
  // the same one and the only thing that differs is the stamina the gate reads.
  const untired = staged({ foeX: OUT_OF_REACH, staminaleft: 11 });
  assert.deepEqual(typesOf(tired), typesOf(untired), "the same vocabulary either side of the gate");
  assert.deepEqual(choose(tired), choose(untired));
  assert.deepEqual(choose(tired), { type: Ss2ActionType.WALK_RIGHT, targetId: "hero" }, "it closes the distance");
});

test("a drawn bow CLOSED ON is out of range too — the bash frame is the build's `fightdistance < 200`", () => {
  const tired = staged({ hero: { secondary_weapon: 61, equipped_weapon: 2 } });
  assert.ok(typesOf(tired).includes(Ss2ActionType.BASH_ATTACK), "the close-range archer frame");
  assert.ok(!typesOf(tired).includes(Ss2ActionType.BOMBARD));
  const untired = staged({ hero: { secondary_weapon: 61, equipped_weapon: 2 }, staminaleft: 11 });
  assert.notEqual(choose(tired).type, Ss2ActionType.REST);
  assert.deepEqual(choose(tired), choose(untired));
});

/* ------------------------------------------------------------------ *
 * What the reorder does NOT move                                      *
 * ------------------------------------------------------------------ */

test("a status-flagged AI still plays its status phase, tired, in range and holding the ladder", () => {
  // In the BUILD the ladder can replace a status too (map §"The spell ladder
  // runs LAST"); here the status phase is the only legal action, which is a
  // legality decision left to the owner. So the forced phase is still returned
  // first — and before any record is built, which the stripped damage pair
  // proves: ranking anything would throw.
  const battle = staged({ hero: { inventory1: 7, inventory2: 34 } });
  const hero = combatantById(battle, "hero");
  hero.status = [ss2StatusToken("poison", "foe")];
  assert.deepEqual(typesOf(battle), [Ss2ActionType.POISONED_PHASE]);
  delete hero.resources.min_damage;
  delete hero.resources.max_damage;
  const chosen = ss2TeamRules.chooseAiAction(
    { actor: hero, allies: [hero], foes: [combatantById(battle, "foe")] },
    "hero",
    legalActions(battle, "hero")
  );
  assert.equal(chosen.type, Ss2ActionType.POISONED_PHASE);
});

test("at ZERO stamina rest is the only option, and the AI takes it without building a record", () => {
  // `legalActions` forces the rest at `staminaleft <= 0` (overlay frame 1
  // `+0x0d2e`). The tired gate used to catch this case on its way past; now
  // that it reads the range, the forced rest is returned the way the forced
  // swap is — and a gladiator with no damage pair must not throw on the way.
  const battle = staged({ staminaleft: 0, foeX: OUT_OF_REACH, hero: { inventory1: 34 } });
  const hero = combatantById(battle, "hero");
  assert.deepEqual(typesOf(battle), [Ss2ActionType.REST]);
  delete hero.resources.min_damage;
  delete hero.resources.max_damage;
  const chosen = ss2TeamRules.chooseAiAction(
    { actor: hero, allies: [hero], foes: [combatantById(battle, "foe")] },
    "hero",
    legalActions(battle, "hero")
  );
  assert.deepEqual(chosen, { type: Ss2ActionType.REST, targetId: "hero" });
});
