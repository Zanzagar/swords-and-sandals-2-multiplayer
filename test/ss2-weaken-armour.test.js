/**
 * `cast_weaken_armour` — the first spell verb that destroys equipment.
 *
 * ## WHAT THE BUILD DOES, AND WHERE
 *
 * Derived from the oracle whose sha256 is `77CB545C…`, read 2026-09-22 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f`, block base `0x240c85`,
 * `+0x777c`-`+0x78d9`:
 *
 * ```text
 *   phase_decision == "cast_weaken_armour"                          +0x7782
 *     register:3.crowd_action = 4                                   +0x778f
 *     game_attacker.staminacost = Math.round(game_attacker.magicka) +0x779c-+0x77c2
 *     if (attacker.struck == null) {                                +0x77c3-+0x77d5
 *       cast_spell_icon(attacker, 44)                               +0x77da
 *       attacker.struck = false                                     +0x77f2
 *       attacker.gotoAndPlay("Cast1")                               +0x7800
 *       attack_direction = 1 + RandomNumber(9)                      +0x7815-+0x7826
 *       remove_armour(game_defender, defender, attack_direction)    +0x7827-+0x7844
 *       ...the same pair twice more                                 +0x7845-+0x78a4
 *     }
 *     if (attacker.struck == true) { attacker.struck = null; nextphase() } +0x78a5-+0x78d9
 * ```
 *
 * `remove_armour` (`DoAction@0x23d7fe`) draws its piece selector BEFORE it
 * tests the piece, so every round costs two samples whatever the victim wears,
 * and a destroyed piece adds three per debris clip (two clips for a paired
 * piece). No `checkattackroll`, no hit roll, no damage, and no clip on the
 * victim. Villain arm 19 (`DoAction@0x23e7cf` `+0x0c3f`-`+0x0c94`):
 * `check_inventory(44) && fightdistance < 300`, and nothing about armour.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, RngSequenceError,
  suggestAction, toTeamWireState
} from "../src/team/index.js";
import {
  SS2_FACING_LEFT, SS2_INVENTORY_EMPTY, SS2_WEAKEN_ARMOUR, Ss2ActionType, VANILLA_PHASE_LABEL,
  createSs2TeamRules, ss2Combatant, ss2TeamRules
} from "../src/team/ss2-rules.js";
import { removeSs2ArmourCandidate } from "../src/golden/ss2-attack-candidate.js";
import {
  buildArenaLayout, CommandKind, LabelProvenance, presentResolvedEvents, SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";

const WEAKEN = Ss2ActionType.CAST_WEAKEN_ARMOUR;

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

/**
 * Helmet 1, shoulderguard 2, breastplate 3: `_defence` 10, 16 and 48 by the
 * `dval` table (`root/frame:35` `+0x3089`-`+0x30e4`), so armour 74 of 74.
 */
const ARMOURED = Object.freeze({ helmet: 1, shoulderguard: 2, breastplate: 3 });

/**
 * A 1v1 with the caster on RED, opening, facing right; the victim on BLUE
 * facing left — the gale and teleport tests' staging. `rngTape` replaces the
 * seeded channel when given.
 */
function staged({
  hero = {}, foe = {}, heroX = -60, foeX = 60, controller = "local", rngTape = null, seed = 3
} = {}) {
  const battle = createTeamBattle({
    seed,
    rngTape,
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
  assert.equal(currentCombatant(battle).id, "hero", "the caster must open for these tests to mean anything");
  return battle;
}

const weakenTargets = (battle, id = "hero") =>
  legalActions(battle, id).filter((option) => option.type === WEAKEN).map((option) => option.targetId);

/** Cast, and hand back the spell's own event off the battle log. */
function cast(battle, actorId = "hero", targetId = "foe") {
  applyAction(battle, { actorId, type: WEAKEN, targetId });
  const event = battle.events.at(-1);
  assert.equal(event.type, WEAKEN, "the spell's own event is the last one logged");
  return event;
}

const armourOf = (battle, id) => {
  const { resources } = combatantById(battle, id);
  return {
    armourclass: resources.armourclass.value,
    armourclass_max: resources.armourclass_max.value,
    helmet: resources.helmet.value,
    shoulderguard: resources.shoulderguard.value,
    breastplate: resources.breastplate.value,
    shield: resources.shield.value
  };
};

/* The tape. Every label is written as a LITERAL: a tape that read its labels
 * off the constant would agree with any label the constant held. */

/** `attack_direction = 1 + RandomNumber(9)`: the opcode draws 0..8, and 1 is added. */
const direction = (round, value) => ({
  label: `weaken-armour-direction-${round}`, source: "randomNumber", min: 0, max: 8, value: value - 1
});
/** `armour_to_remove = randomBetween(1, 2 | 3)`, drawn before the piece test. */
const selection = (round, groupSize, value) => ({
  label: `armour-selection-${round}`, source: "randomBetween", min: 1, max: groupSize, value
});
/** One `destroy_armour` call. `xMax` is 29 for a LEFT-facing victim and 19 for a right-facing one. */
const debris = (clip, xMax = 29) => [
  { label: `armour-debris-${clip}-x`, source: "randomNumber", min: 0, max: xMax, value: 3 },
  { label: `armour-debris-${clip}-y`, source: "randomNumber", min: 0, max: 19, value: 4 },
  { label: `armour-debris-${clip}-rotation`, source: "randomNumber", min: 0, max: 4, value: 1 }
];

/* ------------------------------------------------------------------ *
 * The vocabulary                                                      *
 * ------------------------------------------------------------------ */

test("the token is `cast-weaken-armour` and it round-trips to the build's own `cast_weaken_armour`", () => {
  assert.equal(WEAKEN, "cast-weaken-armour");
  // `phase_decision == "cast_weaken_armour"` at `+0x7782`, and the decision
  // ladder arm 19 writes at `+0x0c7a`.
  assert.equal(VANILLA_PHASE_LABEL[WEAKEN], "cast_weaken_armour");
  assert.ok(createSs2TeamRules().actionTypes.includes(WEAKEN));
});

test("the spell's constants are the build's literals", () => {
  // `cast_spell_icon(attacker, 44)` at `+0x77da`; `check_inventory(44)` at `+0x0c3f`.
  assert.equal(SS2_WEAKEN_ARMOUR.itemId, 44);
  // `attacker.gotoAndPlay("Cast1")` at `+0x7800`.
  assert.equal(SS2_WEAKEN_ARMOUR.casterClip, "Cast1");
  // THREE `1 + RandomNumber(9)` / `remove_armour` pairs: `+0x7815`, `+0x7845`, `+0x7875`.
  assert.equal(SS2_WEAKEN_ARMOUR.rounds, 3);
  assert.equal(SS2_WEAKEN_ARMOUR.directionBase, 1);
  assert.equal(SS2_WEAKEN_ARMOUR.directionSpan, 9);
  // `fightdistance < 300` at `+0x0c6b`-`+0x0c73`, strict.
  assert.equal(SS2_WEAKEN_ARMOUR.aiFightDistanceBelow, 300);
  // `register:3.crowd_action = 4` at `+0x778f`.
  assert.equal(SS2_WEAKEN_ARMOUR.crowdAction, 4);
});

/* ------------------------------------------------------------------ *
 * The offer                                                           *
 * ------------------------------------------------------------------ */

test("a gladiator carrying no inventory is offered no weaken armour", () => {
  assert.deepEqual(weakenTargets(staged()), []);
});

test("carrying id 44 offers the spell per foe, from any declared slot", () => {
  assert.deepEqual(weakenTargets(staged({ hero: { inventory1: 44 } })), ["foe"]);
  assert.deepEqual(weakenTargets(staged({ hero: { inventory6: 44 } })), ["foe"]);
});

test("above 1v1 it is offered at EVERY foe, because the arm reads one bound `defender` and the caster picks", () => {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, inventory1: 44 }), { id: "hero", name: "hero" })] },
      {
        id: "blue",
        name: "blue",
        combatants: [ss2Combatant(fields(), { id: "a", name: "a" }), ss2Combatant(fields(), { id: "b", name: "b" })]
      }
    ]
  });
  assert.equal(currentCombatant(battle).id, "hero");
  assert.deepEqual(weakenTargets(battle).sort(), ["a", "b"]);
});

test("a slot holding the EMPTY marker 1, or 0, offers no weaken armour", () => {
  assert.deepEqual(weakenTargets(staged({ hero: { inventory1: SS2_INVENTORY_EMPTY } })), []);
  assert.deepEqual(weakenTargets(staged({ hero: { inventory1: 0 } })), []);
});

test("the slot window applies: id 44 above `inventory_maxslots` is not offered, inside it is", () => {
  assert.deepEqual(weakenTargets(staged({ hero: { inventory3: 44, inventory_maxslots: 2 } })), []);
  assert.deepEqual(weakenTargets(staged({ hero: { inventory3: 44, inventory_maxslots: 3 } })), ["foe"]);
});

test("the offer reads neither distance nor anybody's armour, which the button and the phase do not read", () => {
  // Arm 19's `fightdistance < 300` is the villain's DECISION; the hero's
  // click handler tests only `inv_struck`, and `+0x777c`-`+0x78d9` reads no
  // distance. Neither the arm nor the ladder reads armour at all.
  assert.deepEqual(weakenTargets(staged({ hero: { inventory1: 44 }, foeX: 1900 })), ["foe"]);
  const bare = staged({ hero: { inventory1: 44 } });
  assert.equal(armourOf(bare, "foe").armourclass_max, 0, "an unarmoured victim");
  assert.deepEqual(weakenTargets(bare), ["foe"]);
});

test("a forced rest still outranks the spell", () => {
  const battle = staged({ hero: { inventory1: 44 } });
  combatantById(battle, "hero").resources.staminaleft.value = 0;
  assert.deepEqual(legalActions(battle, "hero").map((option) => option.type), [Ss2ActionType.REST]);
});

/* ------------------------------------------------------------------ *
 * The phase: draws                                                    *
 * ------------------------------------------------------------------ */

/** The draws the last action took, off the diagnostic journal. */
const drawsOf = (battle, before) => battle.rng.journal.slice(before)
  .map(({ label, source, min, max, value }) => ({ label, source, min, max, value }));

/** The group size `remove_armour` selects over for a direction 1..9. */
const groupSizeFor = (dir) => ([1, 5, 8, 9].includes(dir) ? 2 : 3);

test("an UNARMOURED victim costs exactly SIX draws: direction, selector, three times, in that order", () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const battle = staged({ hero: { inventory1: 44 }, seed });
    const before = battle.rng.cursor;
    cast(battle);
    const draws = drawsOf(battle, before);
    assert.equal(draws.length, 6, `seed ${seed}: nothing is equipped, so nothing adds a debris draw`);
    for (let round = 1; round <= 3; round += 1) {
      const dir = draws[2 * round - 2];
      const sel = draws[2 * round - 1];
      assert.deepEqual(
        { label: dir.label, source: dir.source, min: dir.min, max: dir.max },
        { label: `weaken-armour-direction-${round}`, source: "randomNumber", min: 0, max: 8 }
      );
      assert.deepEqual(
        { label: sel.label, source: sel.source, min: sel.min, max: sel.max },
        { label: `armour-selection-${round}`, source: "randomBetween", min: 1, max: groupSizeFor(dir.value + 1) },
        `seed ${seed} round ${round}: the selector's range follows the direction's group`
      );
    }
  }
});

test("an ARMOURED victim costs the same six plus three per debris clip, and the clips count on across the cast", () => {
  let sawDebris = false;
  for (let seed = 1; seed <= 40; seed += 1) {
    const battle = staged({ hero: { inventory1: 44 }, foe: { ...ARMOURED }, seed });
    const before = battle.rng.cursor;
    const event = cast(battle);
    const draws = drawsOf(battle, before);
    const nonDebris = draws.filter((draw) => !draw.label.startsWith("armour-debris-"));
    assert.equal(nonDebris.length, 6, `seed ${seed}: the non-debris draws are six either way`);
    const clips = event.removals.reduce((total, removal) => total + (removal.debris?.length ?? 0), 0);
    assert.equal(draws.length - 6, 3 * clips, `seed ${seed}: three draws per clip`);
    const labels = draws.filter((draw) => draw.label.startsWith("armour-debris-")).map((draw) => draw.label);
    const expected = [];
    for (let clip = 1; clip <= clips; clip += 1) {
      expected.push(`armour-debris-${clip}-x`, `armour-debris-${clip}-y`, `armour-debris-${clip}-rotation`);
    }
    assert.deepEqual(labels, expected, `seed ${seed}: clip N is the N-th clip of the CAST, not of the round`);
    if (clips > 0) sawDebris = true;
  }
  assert.ok(sawDebris, "the sweep must destroy something");
});

test("the direction is 1 + RandomNumber(9): draw 0 is direction 1 and draw 8 is direction 9, the top group", () => {
  // Direction 9 is in {1,5,8,9}, so its selector is randomBetween(1, 2); a
  // direction of 10 (an off-by-one) would be the middle group's 1..3.
  const battle = staged({
    hero: { inventory1: 44 },
    rngTape: [direction(1, 1), selection(1, 2, 1), direction(2, 9), selection(2, 2, 2), direction(3, 5), selection(3, 2, 1)]
  });
  const event = cast(battle);
  assert.deepEqual(event.removals.map((removal) => removal.attackDirection), [1, 9, 5]);
  assert.equal(battle.rng.remainingCount, 0);
});

test("a tape whose direction draw has the WRONG bound is refused at the cursor", () => {
  // RandomNumber(10) would reach direction 10, which the one-byte opcode
  // at `+0x7824` cannot produce.
  const battle = staged({
    hero: { inventory1: 44 },
    rngTape: [{ ...direction(1, 1), max: 9 }, selection(1, 2, 1)]
  });
  assert.throws(() => cast(battle), RngSequenceError);
});

test("a tape that labels the direction as the ATTACK path's direction is refused: the two draws are not the same draw", () => {
  const battle = staged({
    hero: { inventory1: 44 },
    rngTape: [{ ...direction(1, 1), label: "attack-direction-roll" }, selection(1, 2, 1)]
  });
  assert.throws(() => cast(battle), RngSequenceError);
});

/* ------------------------------------------------------------------ *
 * The phase: what it removes                                          *
 * ------------------------------------------------------------------ */

/**
 * Round 1: direction 1 (top), selector 2 -> the SHOULDERGUARD, a paired piece:
 *          two debris clips, six draws.
 * Round 2: direction 2 (middle), selector 1 -> the BREASTPLATE, a single piece:
 *          one clip, three draws, and the clip is the CAST's third.
 * Round 3: direction 5 (top), selector 2 -> the shoulderguard AGAIN, already
 *          0: nothing is removed and nothing is launched, but the selector was
 *          still drawn.
 */
const SCRIPT = Object.freeze([
  direction(1, 1), selection(1, 2, 2), ...debris(1), ...debris(2),
  direction(2, 2), selection(2, 3, 1), ...debris(3),
  direction(3, 5), selection(3, 2, 2)
]);

test("a scripted tape removes a PAIRED piece and a SINGLE piece, and the third pick finds the first one gone", () => {
  const battle = staged({ hero: { inventory1: 44 }, foe: { ...ARMOURED }, rngTape: SCRIPT });
  assert.deepEqual(armourOf(battle, "foe"), {
    armourclass: 74, armourclass_max: 74, helmet: 1, shoulderguard: 2, breastplate: 3, shield: 0
  });
  const event = cast(battle);
  assert.equal(battle.rng.remainingCount, 0, "every scripted sample is consumed, and no more are asked for");
  // 74 - 16 (shoulderguard 2 x dval 8) - 48 (breastplate 3 x dval 16) = 10,
  // out of BOTH pools; the helmet is untouched.
  assert.deepEqual(armourOf(battle, "foe"), {
    armourclass: 10, armourclass_max: 10, helmet: 1, shoulderguard: 0, breastplate: 0, shield: 0
  });
  assert.deepEqual(
    event.removals.map(({ attackDirection, selected, removed, defenceRemoved }) =>
      ({ attackDirection, selected, removed, defenceRemoved })),
    [
      { attackDirection: 1, selected: "shoulderguard", removed: true, defenceRemoved: 16 },
      { attackDirection: 2, selected: "breastplate", removed: true, defenceRemoved: 48 },
      { attackDirection: 5, selected: "shoulderguard", removed: false, defenceRemoved: 0 }
    ]
  );
  assert.deepEqual(event.removals.map((removal) => removal.debris?.length ?? null), [2, 1, null]);
  assert.deepEqual(event.armourDestroyed, ["shoulderguard", "breastplate"]);
  assert.equal(event.armourLost, 64);
});

test("the effects: slot, armourclass, armourclass_max, then the pieces in the order they fell, then the phase advance", () => {
  const battle = staged({ hero: { inventory1: 44 }, foe: { ...ARMOURED }, rngTape: SCRIPT });
  cast(battle);
  const effects = battle.lastResolution.effects;
  const onVictim = effects.filter((effect) => effect.targetId === "foe");
  assert.deepEqual(onVictim, [
    { kind: "resource", targetId: "foe", resource: "armourclass", to: 10 },
    { kind: "resource", targetId: "foe", resource: "armourclass_max", to: 10 },
    { kind: "resource", targetId: "foe", resource: "shoulderguard", to: 0 },
    { kind: "resource", targetId: "foe", resource: "breastplate", to: 0 }
  ], "and NO damage effect, not even a zero one: nothing was swung");
  assert.deepEqual(effects[0], { kind: "resource", targetId: "hero", resource: "inventory1", to: SS2_INVENTORY_EMPTY });
  const lastVictim = effects.findLastIndex((effect) => effect.targetId === "foe");
  const firstStamina = effects.findIndex((effect) => effect.targetId === "hero" && effect.resource === "staminaleft");
  assert.ok(firstStamina > lastVictim, "`nextphase` settles the caster's stamina after the removals");
});

test("the pieces are written in the order they FELL, not in the armour table's order", () => {
  // The breastplate (round 1) before the helmet (round 2): first-touch order,
  // which `SS2_ARMOUR_PIECES` order (helmet first) would reverse.
  const battle = staged({
    hero: { inventory1: 44 },
    foe: { ...ARMOURED },
    rngTape: [
      direction(1, 2), selection(1, 3, 1), ...debris(1),
      direction(2, 1), selection(2, 2, 1), ...debris(2),
      direction(3, 3), selection(3, 3, 3)
    ]
  });
  cast(battle);
  assert.deepEqual(
    battle.lastResolution.effects.filter((effect) => effect.targetId === "foe").map((effect) => effect.resource),
    ["armourclass", "armourclass_max", "breastplate", "helmet"]
  );
});

test("a removed piece's `_defence` rating is NOT zeroed — only the piece id is", () => {
  // `remove_armour` writes `whichcharacter.shoulderguard = 0` and never
  // touches `shoulderguard_defence`; it is the zeroed id that makes a second
  // pick find nothing.
  const battle = staged({ hero: { inventory1: 44 }, foe: { ...ARMOURED }, rngTape: SCRIPT });
  cast(battle);
  const { resources } = combatantById(battle, "foe");
  assert.equal(resources.shoulderguard_defence.value, 16);
  assert.equal(resources.breastplate_defence.value, 48);
});

test("the same piece picked twice: the second pick draws its selector, launches nothing and changes nothing", () => {
  // Direction 1 then 9, both top group, both selector 1: the helmet, then the
  // helmet again. Round 3 picks the shield (direction 3, selector 3), which
  // this victim does not wear.
  const battle = staged({
    hero: { inventory1: 44 },
    foe: { ...ARMOURED },
    rngTape: [
      direction(1, 1), selection(1, 2, 1), ...debris(1),
      direction(2, 9), selection(2, 2, 1),
      direction(3, 3), selection(3, 3, 3)
    ]
  });
  const event = cast(battle);
  assert.equal(battle.rng.remainingCount, 0);
  assert.deepEqual(armourOf(battle, "foe"), {
    armourclass: 64, armourclass_max: 64, helmet: 0, shoulderguard: 2, breastplate: 3, shield: 0
  });
  assert.deepEqual(event.removals.map((removal) => [removal.selected, removal.removed]), [
    ["helmet", true], ["helmet", false], ["shield", false]
  ]);
});

test("the trailing clamp floors a DAMAGED pool at 0 while the maximum keeps what is left", () => {
  // Armour 30 of 74. The breastplate's 48 comes out of both pools: 30 - 48 is
  // -18, floored to 0 by `remove_armour`'s own clamp (`+0x0d4d`); 74 - 48 = 26.
  const battle = staged({
    hero: { inventory1: 44 },
    foe: { ...ARMOURED },
    rngTape: [
      direction(1, 2), selection(1, 3, 1), ...debris(1),
      direction(2, 3), selection(2, 3, 3),
      direction(3, 3), selection(3, 3, 3)
    ]
  });
  combatantById(battle, "foe").resources.armourclass.value = 30;
  const event = cast(battle);
  const armour = armourOf(battle, "foe");
  assert.equal(armour.armourclass, 0);
  assert.equal(armour.armourclass_max, 26);
  // The resource bag floors at 0 on its own, so the stored value alone cannot
  // tell the build's clamp from none at all. The EFFECT and the event can: an
  // unclamped removal writes -18 and reports 48 lost from a pool of 30.
  const written = battle.lastResolution.effects.find((effect) => effect.targetId === "foe" && effect.resource === "armourclass");
  assert.equal(written.to, 0);
  assert.equal(event.armourLost, 30);
});

test("the debris draw's shape follows the VICTIM's facing, not the caster's", () => {
  // `destroy_armour` reads `whichavatar.gladiator_dir` — the victim. Staged
  // with the caster on BLUE (right of red, so facing left) and the victim on
  // RED (facing right): the horizontal draw is RandomNumber(20), max 19.
  const battle = createTeamBattle({
    seed: 3,
    rngTape: [direction(1, 1), selection(1, 2, 1), ...debris(1, 19), direction(2, 3), selection(2, 3, 3), direction(3, 3), selection(3, 3, 3)],
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ ...ARMOURED }), { id: "victim", name: "victim" })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ speed: 21, inventory1: 44 }), { id: "caster", name: "caster" })] }
    ]
  });
  assert.equal(currentCombatant(battle).id, "caster");
  assert.ok(combatantById(battle, "caster").status.includes(SS2_FACING_LEFT));
  assert.equal(combatantById(battle, "victim").status.includes(SS2_FACING_LEFT), false);
  cast(battle, "caster", "victim");
  assert.equal(battle.rng.remainingCount, 0);
  assert.equal(combatantById(battle, "victim").resources.helmet.value, 0);
});

test("nothing is damaged and nobody moves: health, stamina, positions and the victim's charge all stand", () => {
  const battle = staged({ hero: { inventory1: 44 }, foe: { ...ARMOURED, psyche_up: 3 }, rngTape: SCRIPT });
  const foeBefore = combatantById(battle, "foe");
  const { health, x } = foeBefore;
  const stamina = foeBefore.resources.staminaleft.value;
  assert.equal(foeBefore.resources.psyche_up.value, 3, "a charged victim, so the check below can fail");
  cast(battle);
  const foe = combatantById(battle, "foe");
  assert.equal(foe.health, health);
  assert.equal(foe.x, x);
  assert.equal(foe.resources.staminaleft.value, stamina);
  assert.equal(foe.resources.psyche_up.value, 3, "remove_armour is not an ingress: no charge is interrupted");
  assert.equal(combatantById(battle, "hero").x, -60);
  assert.equal(foe.alive, true);
});

/* ------------------------------------------------------------------ *
 * The phase: a shield on the arm of somebody holding a bow            *
 * ------------------------------------------------------------------ */

/**
 * WHAT THE BUILD DOES, re-derived 2026-09-22 from `root/frame:35`
 * `DoAction@0x3fa9dc` (`battlevalues`, `+0x3062`) and overlay frame 52
 * `DoAction@0x240c7f`:
 *
 * ```text
 *   battlevalues:  if (using_bow == true) shield_defence = 0                  +0x35e2-+0x35f2, +0x3623
 *                  else shield_defence = round(shield * shield_dval 12)       +0x35f7-+0x361d
 *   swap_weapons:  equipped_weapon = 2; using_bow = true;  battlevalues()     +0x4dbd, +0x4dce, +0x4ea1
 *                  equipped_weapon = 1; using_bow = false; battlevalues()     +0x4eba, +0x4ecb, +0x4fab
 *   nextphase:     battlevalues(game_attacker); battlevalues(game_defender)   +0x35f1, +0x3605 (ungated)
 *   remove_armour: armourclass -= shield_defence; armourclass_max -= ...      +0x0ca2-+0x0ccd
 * ```
 *
 * and `armourclass_max` is rebuilt from the `_defence` fields only while
 * `battle_started != true` (`+0x3a90`-`+0x3aa0`). So drawing a bow mid-fight
 * leaves both pools where they were, and the shield it zeroed then comes off
 * for NOTHING. Sheathing reprices it at once, in the swap's own call.
 *
 * The victim OPENS, so its own turn can draw the bow through the swap verb —
 * the state is reached, never written into the bag by hand.
 */
const SHIELDED = Object.freeze({ shield: 1, breastplate: 2, secondary_weapon: 61 });

/** Round 1: direction 3 (lower group), selector 3 -> the SHIELD. Rounds 2-3 find no shinguard. */
const SHIELD_TAPE = Object.freeze([
  direction(1, 3), selection(1, 3, 3), ...debris(1),
  direction(2, 3), selection(2, 3, 1),
  direction(3, 3), selection(3, 3, 1)
]);

function shieldedVictim() {
  const battle = createTeamBattle({
    seed: 3,
    rngTape: SHIELD_TAPE,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ inventory1: 44 }), { id: "hero", name: "hero", controller: "local" })] },
      {
        id: "blue",
        name: "blue",
        combatants: [ss2Combatant(fields({ speed: 21, gladiator_dir: "left", ...SHIELDED }), { id: "foe", name: "foe", controller: "local" })]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: 60, y: 200 });
  assert.equal(currentCombatant(battle).id, "foe", "the victim must open, so it can draw first");
  // 12 (shield 1) + 32 (breastplate 2), and the shield's rating on the bag.
  assert.deepEqual(
    [armourOf(battle, "foe").armourclass, armourOf(battle, "foe").armourclass_max],
    [44, 44]
  );
  assert.equal(combatantById(battle, "foe").resources.shield_defence.value, 12);
  return battle;
}

const swap = (battle, id) => applyAction(battle, { actorId: id, type: Ss2ActionType.SWAP_WEAPONS, targetId: id });
const rest = (battle, id) => applyAction(battle, { actorId: id, type: Ss2ActionType.REST, targetId: id });

test("a victim HOLDING ITS BOW loses its shield for nothing: `battlevalues` priced it at 0 (+0x3623)", () => {
  const battle = shieldedVictim();
  swap(battle, "foe");
  assert.equal(combatantById(battle, "foe").resources.equipped_weapon.value, 2, "the bow is drawn");
  const event = cast(battle);
  assert.equal(battle.rng.remainingCount, 0);
  assert.deepEqual(armourOf(battle, "foe"), {
    armourclass: 44, armourclass_max: 44, helmet: 0, shoulderguard: 0, breastplate: 2, shield: 0
  }, "the shield is gone and neither pool moved");
  assert.deepEqual(event.removals[0].selected, "shield");
  assert.equal(event.removals[0].removed, true, "it IS removed — debris and all — it is just worth nothing");
  assert.equal(event.removals[0].defenceRemoved, 0);
  assert.equal(event.armourLost, 0);
});

test("the control: a victim holding its SWORD loses the shield's 12 from both pools (+0x35f7)", () => {
  // Same victim, same tape, same turn order — the victim rests instead of
  // drawing. Guards the fix from the other side: a shield that stopped costing
  // anything at all would pass the test above and fail this one.
  const battle = shieldedVictim();
  rest(battle, "foe");
  assert.equal(combatantById(battle, "foe").resources.equipped_weapon.value, 1);
  const event = cast(battle);
  assert.equal(battle.rng.remainingCount, 0);
  assert.deepEqual(
    [armourOf(battle, "foe").armourclass, armourOf(battle, "foe").armourclass_max, armourOf(battle, "foe").shield],
    [32, 32, 0]
  );
  assert.equal(event.removals[0].defenceRemoved, 12);
});

test("drawn and SHEATHED again, the shield is worth its 12: the sheathing swap reprices it (+0x4fab)", () => {
  const battle = shieldedVictim();
  swap(battle, "foe");
  rest(battle, "hero");
  swap(battle, "foe");
  assert.equal(combatantById(battle, "foe").resources.equipped_weapon.value, 1, "the sword is back in hand");
  const event = cast(battle);
  assert.equal(battle.rng.remainingCount, 0);
  assert.deepEqual(
    [armourOf(battle, "foe").armourclass, armourOf(battle, "foe").armourclass_max, armourOf(battle, "foe").shield],
    [32, 32, 0]
  );
  assert.equal(event.removals[0].defenceRemoved, 12);
});

test("a gladiator REBUILT mid-fight holding its bow keeps the shield's melee rating for when it sheathes", () => {
  // `ss2Combatant(..., { battleStarted: true })` rebuilds a capture or a
  // resumed campaign, and a record that says `using_bow: true` derives
  // `shield_defence` 0 — the build's own number at that moment. Kept in the
  // bag, it would outlive the bow: the build's sheathing `battlevalues`
  // gives the shield its 12 back, and a bag that remembered 0 never could.
  const rebuilt = (overrides = {}) => ss2Combatant(
    fields({
      speed: 21, gladiator_dir: "left", ...SHIELDED, equipped_weapon: 2, using_bow: true,
      armourclass: 44, armourclass_max: 44, hitpoints: 170, staminaleft: 160, ...overrides
    }),
    { id: "foe", name: "foe", controller: "local", battleStarted: true }
  );
  assert.equal(rebuilt().resources.shield_defence, 12, "the bag holds the SHEATHED rating");

  const battle = createTeamBattle({
    seed: 3,
    rngTape: SHIELD_TAPE,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ inventory1: 44 }), { id: "hero", name: "hero", controller: "local" })] },
      { id: "blue", name: "blue", combatants: [rebuilt({ ammo_left: 5 })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: 60, y: 200 });
  assert.equal(currentCombatant(battle).id, "foe");
  swap(battle, "foe");
  assert.equal(combatantById(battle, "foe").resources.equipped_weapon.value, 1, "sheathed");
  const event = cast(battle);
  assert.equal(event.removals[0].defenceRemoved, 12);
  assert.deepEqual([armourOf(battle, "foe").armourclass, armourOf(battle, "foe").armourclass_max], [32, 32]);
});

/* ------------------------------------------------------------------ *
 * The phase: cost, consumption, event, refusals                       *
 * ------------------------------------------------------------------ */

test("the cost is round(magicka), the STAT, with regeneration on top", () => {
  const battle = staged({ hero: { inventory1: 44, magicka: 12 } });
  const before = combatantById(battle, "hero").resources.staminaleft.value;
  const event = cast(battle);
  assert.equal(event.staminaSpent, 12);
  // `nextphase`: `-= staminacost`, then `+= 1 + round(stamina / 3)` with stamina 6.
  assert.equal(event.staminaGained, -12 + 1 + Math.round(6 / 3));
  assert.equal(combatantById(battle, "hero").resources.staminaleft.value - before, event.staminaGained);
});

test("there is NO affordability check: a caster at 11 stamina still casts a 30-magicka spell and floors at 0", () => {
  const battle = staged({ hero: { inventory1: 44, magicka: 30 } });
  combatantById(battle, "hero").resources.staminaleft.value = 11;
  assert.deepEqual(weakenTargets(battle), ["foe"]);
  cast(battle);
  assert.equal(combatantById(battle, "hero").resources.staminaleft.value, 0);
});

test("casting CONSUMES the slot by setting it to 1, and the offer goes with it", () => {
  const battle = staged({ hero: { inventory3: 44 } });
  const event = cast(battle);
  assert.equal(event.consumedSlot, "inventory3");
  assert.equal(combatantById(battle, "hero").resources.inventory3.value, SS2_INVENTORY_EMPTY);
  assert.deepEqual(weakenTargets(battle), []);
});

test("the event names Cast1 on the caster, NO victim clip, and carries no geometry", () => {
  const event = cast(staged({ hero: { inventory1: 44 } }));
  assert.equal(event.casterClip, "Cast1");
  assert.equal(Object.hasOwn(event, "victimClip"), false, "the arm plays nothing on the victim");
  assert.equal(event.vanillaLabel, "cast_weaken_armour");
  assert.equal(event.spellId, 44);
  assert.equal(event.actorId, "hero");
  assert.equal(event.targetId, "foe");
  // `from`/`to` would be read as the ACTOR's own move by the presentation.
  for (const key of ["from", "to", "targetFrom", "targetTo"]) assert.equal(Object.hasOwn(event, key), false, key);
});

test("the event carries each round's debris draws for a presentation to use", () => {
  const event = cast(staged({ hero: { inventory1: 44 }, foe: { ...ARMOURED }, rngTape: SCRIPT }));
  assert.deepEqual(event.removals[1].debris, [
    { horizontal: { source: "randomNumber", value: 3 }, vertical: 4, rotation: 1 }
  ]);
});

test("a spell the caster does not carry is refused TWICE, and the second refusal names it", () => {
  const battle = staged();
  assert.throws(() => applyAction(battle, { actorId: "hero", type: WEAKEN, targetId: "foe" }), /Illegal action/);
  const hero = combatantById(battle, "hero");
  const foe = combatantById(battle, "foe");
  assert.throws(
    () => ss2TeamRules.resolveAction({
      type: WEAKEN, turnNumber: battle.turnNumber, actor: hero, target: foe, targetId: foe.id,
      allies: [hero], foes: [foe]
    }, { randomBetween: () => 1, randomNumber: () => 0 }),
    /no declared inventory slot holds item 44/
  );
});

test("a direct resolve refuses id 44 held OUTSIDE the slot window, says so, and draws nothing", () => {
  const battle = staged({ hero: { inventory3: 44, inventory_maxslots: 2 } });
  const hero = combatantById(battle, "hero");
  const foe = combatantById(battle, "foe");
  let drawn = 0;
  const count = () => { drawn += 1; return 0; };
  assert.throws(
    () => ss2TeamRules.resolveAction({
      type: WEAKEN, turnNumber: battle.turnNumber, actor: hero, target: foe, targetId: foe.id,
      allies: [hero], foes: [foe]
    }, { randomBetween: count, randomNumber: count }),
    /inventory3.*inventory_maxslots 2/
  );
  assert.equal(drawn, 0);
});

/* ------------------------------------------------------------------ *
 * The candidate entry point                                           *
 * ------------------------------------------------------------------ */

/** A minimal ordered stream that records what it was asked for. */
function recorder(values) {
  const asked = [];
  const next = () => values.shift();
  return {
    asked,
    randomBetween: (label, min, max) => { asked.push({ label, source: "randomBetween", min, max }); return next(); },
    randomNumber: (label, n) => { asked.push({ label, source: "randomNumber", min: 0, max: n - 1 }); return next(); }
  };
}

test("`removeSs2ArmourCandidate` numbers its debris clips from `firstDebrisClip`", () => {
  const defender = {
    armourclass: 30, armourclass_max: 30, shoulderguard: 2, shoulderguard_defence: 16, gladiator_dir: "right"
  };
  const rolls = recorder([2, 1, 2, 3, 4, 5, 6]);
  const removal = removeSs2ArmourCandidate(defender, 5, rolls, { request: 2, firstDebrisClip: 4 });
  assert.deepEqual(rolls.asked.map((draw) => draw.label), [
    "armour-selection-2",
    "armour-debris-4-x", "armour-debris-4-y", "armour-debris-4-rotation",
    "armour-debris-5-x", "armour-debris-5-y", "armour-debris-5-rotation"
  ]);
  assert.equal(rolls.asked[1].max, 19, "a right-facing avatar draws RandomNumber(20)");
  assert.equal(removal.selected, "shoulderguard");
  assert.equal(removal.removed, true);
  assert.equal(defender.armourclass, 14);
  assert.equal(defender.armourclass_max, 14);
  assert.equal(defender.shoulderguard, 0);
});

test("`removeSs2ArmourCandidate` defaults to the attack path's numbering, request 1 and clip 1", () => {
  const defender = { armourclass: 10, armourclass_max: 10, helmet: 1, helmet_defence: 10, gladiator_dir: "left" };
  const rolls = recorder([1, 0, 0, 0]);
  removeSs2ArmourCandidate(defender, 1, rolls);
  assert.deepEqual(rolls.asked.map((draw) => draw.label), [
    "armour-selection-1", "armour-debris-1-x", "armour-debris-1-y", "armour-debris-1-rotation"
  ]);
});

test("`removeSs2ArmourCandidate` refuses a direction that is not an integer", () => {
  assert.throws(() => removeSs2ArmourCandidate({ armourclass: 0, armourclass_max: 0 }, 1.5, recorder([])), /integer/);
});

/* ------------------------------------------------------------------ *
 * The presentation                                                    *
 * ------------------------------------------------------------------ */

test("a presented cast plays Cast1 on the caster, MAP_NAMED, and NOTHING on the victim, with nothing unmapped", () => {
  const battle = staged({ hero: { inventory1: 44 }, foe: { ...ARMOURED }, rngTape: SCRIPT });
  cast(battle);
  const wire = toTeamWireState(battle);
  const { commands } = presentResolvedEvents(wire, { layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS });
  const clips = commands.filter((command) => command.kind === CommandKind.CLIP_GOTO);
  // The self-cast binding (a `casterClip` with no `victimClip`) binds the
  // caster alone; the event's foe `targetId` gets no clip, and no complaint.
  assert.deepEqual(
    clips.map(({ combatantId, role, label, labelProvenance }) => ({ combatantId, role, label, labelProvenance })),
    [{ combatantId: "hero", role: "actor", label: "Cast1", labelProvenance: LabelProvenance.MAP_NAMED }]
  );
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), []);
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.MOVE_CLIP), []);
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.ATTACH_EFFECT), []);
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.FIRE_PROJECTILE), []);
});

/* ------------------------------------------------------------------ *
 * The AI                                                              *
 *                                                                     *
 * The build's rule: arm 19 of `villain_cast_spells` casts when id 44   *
 * is carried and `fightdistance < 300` — after arms 1-18 did not fire, *
 * and after one 90% roll this AI does not take.                        *
 * ------------------------------------------------------------------ */

function weakenCaster({ foeX = 120, extra = {}, foe = {} } = {}) {
  return staged({ controller: "ai", hero: { inventory1: 44, ...extra }, foe, heroX: 0, foeX });
}

/** The same gladiator with no id 44 — the control every gate test compares against. */
function withoutWeaken(battle) {
  combatantById(battle, "hero").resources.inventory1.value = SS2_INVENTORY_EMPTY;
  return suggestAction(battle, "hero").type;
}

test("an AI caster with a foe inside 300 weakens that foe", () => {
  assert.deepEqual(suggestAction(weakenCaster({ foe: { ...ARMOURED } }), "hero"), { type: WEAKEN, targetId: "foe" });
});

test("the spell OVERRIDES a swing in reach, as `villain_cast_spells` overrides the decision", () => {
  const battle = weakenCaster({ foeX: 120 });
  assert.equal(suggestAction(battle, "hero").type, WEAKEN);
  assert.equal(withoutWeaken(battle), Ss2ActionType.QUICK_ATTACK);
});

test("the spell is cast from BEYOND melee reach too, anywhere inside 300", () => {
  const battle = weakenCaster({ foeX: 299 });
  assert.equal(suggestAction(battle, "hero").type, WEAKEN);
  assert.equal(withoutWeaken(battle), Ss2ActionType.WALK_RIGHT);
});

test("at fightdistance 300 the gate is SHUT (strict `<`), and the AI does what it would without 44", () => {
  const battle = weakenCaster({ foeX: 300 });
  const shut = suggestAction(battle, "hero").type;
  assert.notEqual(shut, WEAKEN);
  assert.equal(shut, withoutWeaken(battle));
});

test("an UNARMOURED foe is weakened all the same, because the build's arm tests no armour on either side", () => {
  const battle = weakenCaster();
  assert.equal(combatantById(battle, "foe").resources.armourclass_max.value, 0);
  assert.equal(suggestAction(battle, "hero").type, WEAKEN);
});

test("a caster offered a BOLT keeps the bolt, because arms 15 and 17 precede arm 19", () => {
  const battle = weakenCaster({ extra: { inventory2: 34 } });
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_LIGHTNING_BOLT);
});

test("carrying a bolt shuts the spell even when the bolt itself loses the pricing", () => {
  const battle = weakenCaster({ extra: { inventory2: 34, strength: 60, attack: 60, weapon: 24 } });
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.POWER_ATTACK);
});

test("a caster offered a FIREBALL never reaches arm 19 either (arms 14, 16, 18)", () => {
  const battle = weakenCaster({ extra: { inventory2: 30 } });
  assert.notEqual(suggestAction(battle, "hero").type, WEAKEN);
});

test("a health potion PRE-EMPTS the spell, because arm 2 precedes arm 19", () => {
  const battle = weakenCaster({ extra: { inventory2: 5 } });
  combatantById(battle, "hero").health = 40;
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.DRINK_POTION);
  combatantById(battle, "hero").resources.inventory2.value = SS2_INVENTORY_EMPTY;
  assert.equal(suggestAction(battle, "hero").type, WEAKEN);
});

test("a caster carrying BOUNDLESS ENERGY weakens first, because arm 19 precedes arm 23", () => {
  // Added by the main session when this verb and the timed buffs, built in
  // parallel worktrees, were merged on 2026-09-22: arm 23 fires on possession
  // alone, so only the block ORDER keeps it from winning.
  const battle = weakenCaster({ extra: { inventory2: 45 } });
  assert.equal(suggestAction(battle, "hero").type, WEAKEN);
  combatantById(battle, "hero").resources.inventory1.value = SS2_INVENTORY_EMPTY;
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_BOUNDLESS_ENERGY);
});

test("a caster QUALIFYING for the gale weakens instead, because arm 19 precedes arm 24", () => {
  // Armour 60 of 136 is below half and 120 is inside both 300 and 400.
  const battle = weakenCaster({ extra: { inventory2: 38, helmet: 4, breastplate: 6 } });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.resources.armourclass_max.value, 136);
  hero.resources.armourclass.value = 60;
  assert.equal(suggestAction(battle, "hero").type, WEAKEN);
});

test("between 300 and 400 the weaken gate is shut and the ladder falls through to the gale", () => {
  const battle = weakenCaster({ foeX: 350, extra: { inventory2: 38, helmet: 4, breastplate: 6 } });
  combatantById(battle, "hero").resources.armourclass.value = 60;
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_GALE);
});

test("a caster QUALIFYING for the teleport weakens instead, because arm 19 precedes arm 26", () => {
  const battle = weakenCaster({ extra: { inventory2: 48 } });
  combatantById(battle, "hero").health = 60;
  assert.equal(suggestAction(battle, "hero").type, WEAKEN);
  combatantById(battle, "hero").resources.inventory1.value = SS2_INVENTORY_EMPTY;
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_TELEPORT, "the control");
});

test("above 1v1 the AI weakens the NEAREST foe, and the distance gate is measured to it", () => {
  // INVENTED: the build has one `defender`. The nearest is the one the
  // distance gate is about, as it is for the gale and the teleport.
  const build = (nearX) => {
    const battle = createTeamBattle({
      seed: 3,
      rules: ss2TeamRules,
      teams: [
        {
          id: "red",
          name: "red",
          combatants: [ss2Combatant(fields({ speed: 21, inventory1: 44 }), { id: "hero", name: "hero", controller: "ai" })]
        },
        {
          id: "blue",
          name: "blue",
          combatants: [
            ss2Combatant(fields(), { id: "far", name: "far", controller: "ai" }),
            ss2Combatant(fields(), { id: "near", name: "near", controller: "ai" })
          ]
        }
      ]
    });
    Object.assign(combatantById(battle, "hero"), { x: 0, y: 200 });
    Object.assign(combatantById(battle, "near"), { x: nearX, y: 200 });
    Object.assign(combatantById(battle, "far"), { x: 1200, y: 200 });
    assert.equal(currentCombatant(battle).id, "hero");
    return battle;
  };
  assert.deepEqual(suggestAction(build(200), "hero"), { type: WEAKEN, targetId: "near" });
  assert.notEqual(suggestAction(build(320), "hero").type, WEAKEN);
});

test("the AI takes no sample to decide, so the build's 90% roll is not reproduced", () => {
  // `randomBetween(1, 100) > 10` once at the top of `villain_cast_spells`
  // (`+0x056f`); this AI draws nothing, so it casts on every turn the gate is
  // open rather than on nine in ten.
  const battle = weakenCaster();
  const before = battle.rng.cursor;
  suggestAction(battle, "hero");
  assert.equal(battle.rng.cursor, before);
});
