/**
 * `cast_death_from_above` — inventory id 49, "Molten Death", the fourth spell
 * arm this engine resolves and the first that hits more than once.
 *
 * ## THE ARM, FROM THE BYTES
 *
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f`, block base `0x240c85`,
 * `+0x862f`-`+0x895c`, read 2026-09-22 off the main session's dump of the
 * oracle whose sha256 is `77CB545C…`:
 *
 * ```text
 *   phase_decision == "cast_death_from_above"                       +0x8635
 *   crowd_action = 20; staminacost = Math.round(magicka)            +0x8642-+0x8675
 *   if (attacker.struck == null) {                                  +0x8688
 *     cast_spell_icon(attacker, 49)                                 +0x868d
 *     boulder_stones = randomBetween(10, 20)                        +0x86a5
 *     lightning_frame = 1                  // a copy-paste leftover  +0x86be
 *     attacker.struck = false; attacker.gotoAndPlay("Cast2")        +0x86ca-+0x86ec
 *     for (i = 1; !(i > boulder_stones); i++) {                     +0x86ed-+0x88fe
 *       boulder = attachMovie("boulder_combat", ..., {_x: defender._x, _y: -600})
 *       boulder._x += randomBetween(-300, 300)                      +0x878b
 *       boulder._y  = randomBetween(-600, -800)   // SIC: a > b     +0x87a9
 *       boulder.yspeed = randomBetween(50, 150)                     +0x87c8
 *       boulder._xscale = boulder._yscale = randomBetween(50, 100)  +0x87f1
 *       boulder.onEnterFrame = function () {                        +0x882f
 *         if (_y <= 150) _y += yspeed
 *         if (_y > 150 && bounced != true) {
 *           bounced = true; gotoAndStop(4)
 *           magic_damage_character(defender, attacker, game_defender,
 *               game_attacker, "burning", 4, 40)                    +0x88e5
 *         }
 *       }
 *     }
 *   }
 *   if (defender.struck == true) {                                  +0x8903
 *     bolt.removeMovieClip()             // a copy-paste leftover   +0x892b
 *     attacker.struck = null; defender.struck = null; nextphase()   +0x8933-+0x895c
 *   }
 * ```
 *
 * ► **1 + 4N DRAWS, ALL AT THE CAST, AND NOT ONE DECIDES A NUMBER THAT
 *   MATTERS EXCEPT N.** The boulder's closure reads only its own `_y`,
 *   `yspeed` and `bounced` — there is no x test — so every boulder lands, on
 *   the frame its fall first crosses 150, and each one is the same ingress
 *   call with a literal 40. The x offset, the start height, the speed and the
 *   scale decide only WHERE and WHEN each lands, which is presentation; they
 *   are still real draws on this engine's ordered channel, in the build's
 *   order, because a peer that skipped them would fall out of step.
 *
 * ► **THE `_y` DRAW HAS ITS BOUNDS THE WRONG WAY ROUND, AND THE BRIEF THIS WAS
 *   BUILT FROM READ IT AS `(-800, -600)`.** `+0x87a9` is `Push "_y", -800,
 *   -600, 2, "randomBetween"`: `CallFunction` pops the arguments top-first, so
 *   the call is `randomBetween(-600, -800)` — every other call in the arm
 *   pushes its HIGH bound first (`20, 10`; `300, -300`; `150, 50`; `100, 50`).
 *   The build's formula `floor(Math.random() * (b - a + 1)) + a` then gives
 *   `-600 + floor(r * -199)`, which is -601..-799, uniformly, and -600 only
 *   when `Math.random()` returns exactly 0. This engine's channel refuses
 *   `max < min`, so the draw is stated as the range the build actually
 *   reaches: `[-799, -601]`. Presentation only; see `SS2_DEATH_FROM_ABOVE`.
 *
 * ## WHAT IS INVENTED, SAID OUT LOUD
 *
 * - **That the caster picks a target**, as for the bolts and the fireballs.
 * - **The tape labels** (`death-from-above-boulder-count`,
 *   `death-from-above-boulder-<i>-x|y|yspeed|scale`), in the shape of the
 *   weaken-armour and debris labels.
 * - **The order of hits that land on the same frame** (by boulder index). Every
 *   hit is the same 40 through the same ingress, so no number depends on it;
 *   only which boulder the presentation shows as the killing one does.
 * - **That the AI targets the most wounded foe** above 1v1.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, RngExhaustedError,
  RngSequenceError, suggestAction, toTeamWireState
} from "../src/team/index.js";
import {
  SS2_DEATH_FROM_ABOVE, SS2_DAMAGE_SPELL_LADDER, SS2_FIREBALL_INGRESS, SS2_INVENTORY_EMPTY, Ss2ActionType,
  VANILLA_PHASE_LABEL, createSs2TeamRules, ss2BoulderLandingFrame, ss2Combatant, ss2TeamRules
} from "../src/team/ss2-rules.js";
import { SS2_DIRECT_DAMAGE_SPELLS } from "../src/golden/ss2-spell-candidate.js";
import {
  buildArenaLayout, CommandKind, LabelProvenance, presentResolvedEvents, SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import { timelineFor } from "../src/render/index.js";
import { clipLabelsFor } from "../src/render/clip-labels.js";

const MOLTEN = Ss2ActionType.CAST_DEATH_FROM_ABOVE;

// The shared fighter. `hitpointsmax = herolevel * 10 + vitality * 20` = 170,
// `staminamax = 100 + stamina * 10` = 160, and `nextphase` regenerates
// `1 + round(stamina / 3)` = 3 stamina.
const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

/** A victim that survives twenty boulders: 40 * 10 + 40 * 20 = 1,200 HP against 800. */
const TOUGH = Object.freeze({ vitality: 40, herolevel: 40 });
/** `helmet: 4, breastplate: 6` is 136 armour, and breastplate 6 is the stamina join's percentage. */
const ARMOURED = Object.freeze({ helmet: 4, breastplate: 6 });
const ALL_NINES = Object.freeze({
  helmet: 9, shoulderguard: 9, breastplate: 9, gauntlet: 9, greaves: 9, shinguard: 9, boot: 9, shield: 9
});

/** The caster opens, facing right at x -60, and the foe stands at `foeX`. The fireball tests' staging. */
function staged({
  hero = {}, foe = {}, foeX = 60, heroX = -60, controller = "local", rules = ss2TeamRules, seed = 3,
  rngTape = null, extraFoes = []
} = {}) {
  const battle = createTeamBattle({
    seed,
    rules,
    ...(rngTape ? { rngTape } : {}),
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller })]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller }),
          ...extraFoes.map((extra) =>
            ss2Combatant(fields({ gladiator_dir: "left", ...extra.fields }), { id: extra.id, name: extra.id, controller }))
        ]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: heroX, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: foeX, y: 200 });
  for (const extra of extraFoes) Object.assign(combatantById(battle, extra.id), { x: extra.x, y: extra.y ?? 200 });
  assert.equal(currentCombatant(battle).id, "hero", "the caster must open for these tests to mean anything");
  return battle;
}

const typesFor = (battle, id) => legalActions(battle, id).map((option) => option.type);

/** Cast, and hand back the spell's own event off the battle log. */
function cast(battle, targetId = "foe") {
  applyAction(battle, { actorId: "hero", type: MOLTEN, targetId });
  const event = battle.events.find((entry) => entry.type === MOLTEN);
  assert.ok(event, "the spell's own event is logged");
  return event;
}

/**
 * A tape for a shower of `count` boulders, written with LITERAL labels and
 * bounds so the test pins them independently of the constant. `boulder(i)`
 * supplies boulder i's four values; the default lands every boulder on frame 9.
 */
function showerTape(count, boulder = () => ({ x: 0, y: -700, yspeed: 100, scale: 75 })) {
  const samples = [
    { label: "death-from-above-boulder-count", source: "randomBetween", min: 10, max: 20, value: count }
  ];
  for (let i = 1; i <= count; i += 1) {
    const b = boulder(i);
    samples.push(
      { label: `death-from-above-boulder-${i}-x`, source: "randomBetween", min: -300, max: 300, value: b.x },
      { label: `death-from-above-boulder-${i}-y`, source: "randomBetween", min: -799, max: -601, value: b.y },
      { label: `death-from-above-boulder-${i}-yspeed`, source: "randomBetween", min: 50, max: 150, value: b.yspeed },
      { label: `death-from-above-boulder-${i}-scale`, source: "randomBetween", min: 50, max: 100, value: b.scale }
    );
  }
  return samples;
}

/** The draws since `before`, off the diagnostic journal. */
const drawsOf = (battle, before) => battle.rng.journal.slice(before)
  .map(({ label, source, min, max }) => ({ label, source, min, max }));

const foeOf = (battle) => combatantById(battle, "foe");
const heroOf = (battle) => combatantById(battle, "hero");

/* ------------------------------------------------------------------ *
 * The vocabulary                                                      *
 * ------------------------------------------------------------------ */

test("the token is `cast-death-from-above` and it round-trips to the build's own `cast_death_from_above`", () => {
  // `+0x8635` — the constant the gate compares — and the decision ladder arm 7
  // writes at `+0x0871`.
  assert.equal(MOLTEN, "cast-death-from-above");
  assert.equal(VANILLA_PHASE_LABEL[MOLTEN], "cast_death_from_above");
  assert.ok(createSs2TeamRules().actionTypes.includes(MOLTEN));
});

test("the spell's constants are the build's literals", () => {
  const spell = SS2_DEATH_FROM_ABOVE;
  assert.equal(spell.itemId, 49, "`cast_spell_icon(attacker, 49)` +0x868d, `check_inventory(49)` +0x0855");
  assert.equal(spell.ladderArm, 7);
  assert.deepEqual([spell.boulderCount.low, spell.boulderCount.high], [10, 20], "`randomBetween(10, 20)` +0x86a5");
  assert.deepEqual(
    spell.boulderRolls.map(({ field, low, high }) => [field, low, high]),
    [
      ["xOffset", -300, 300], // +0x878b
      // +0x87a9 is randomBetween(-600, -800): the range it REACHES, stated low-first.
      ["y0", -799, -601],
      ["ySpeed", 50, 150], // +0x87c8
      ["scale", 50, 100] // +0x87f1
    ],
    "four draws per boulder, in the build's order"
  );
  assert.equal(spell.groundY, 150, "`_y > 150`, +0x8871");
  assert.equal(spell.damagePerBoulder, 40, "`Push 40, 4, \"burning\"` at +0x88c1 — a literal, not a roll");
  assert.equal(spell.damageMethod, "burning");
  assert.equal(spell.bonusFrame, 4);
  assert.equal(spell.casterClip, "Cast2", "`attacker.gotoAndPlay(\"Cast2\")` +0x86d8 — the bolts' clip, not the fireballs'");
  assert.equal(spell.crowdAction, 20, "+0x8642");
  // The same `damage_method`/`bonus_frame` pair as the fireball group's ONE
  // call, pushed at a different call site.
  assert.equal(spell.damageMethod, SS2_FIREBALL_INGRESS.damageMethod);
  assert.equal(spell.bonusFrame, SS2_FIREBALL_INGRESS.bonusFrame);
  // Not a single-invocation direct-damage caller, so the candidate module does
  // not map it and must keep refusing it (`test/ss2-spell-candidate.test.js`).
  assert.equal(SS2_DIRECT_DAMAGE_SPELLS[49], undefined);
  assert.equal(SS2_DAMAGE_SPELL_LADDER.includes(MOLTEN), false, "arms 14-18 only; arm 7 is not priced");
});

/* ------------------------------------------------------------------ *
 * The offer                                                           *
 * ------------------------------------------------------------------ */

test("no inventory offers no molten death; carrying 49 offers it, and nothing else does", () => {
  assert.equal(typesFor(staged(), "hero").includes(MOLTEN), false);
  assert.equal(typesFor(staged({ hero: { inventory5: 49 } }), "hero").includes(MOLTEN), true);
  for (const id of [30, 31, 32, 34, 35, 44, 45, 48]) {
    assert.equal(typesFor(staged({ hero: { inventory1: id } }), "hero").includes(MOLTEN), false, `id ${id}`);
  }
});

test("it is offered PER FOE, out of reach and in another rank alike", () => {
  // The arm reads `defender._x` only to place the boulders, and the closure has
  // no x test at all — so every foe is a legal target from anywhere.
  const battle = staged({
    hero: { inventory1: 49 },
    foeX: 1900,
    extraFoes: [{ id: "back", x: 400, y: 100, fields: {} }]
  });
  assert.deepEqual(
    legalActions(battle, "hero").filter((option) => option.type === MOLTEN).map((option) => option.targetId).sort(),
    ["back", "foe"]
  );
});

test("the slot window applies, and a direct resolve refuses what the offer refused", () => {
  const battle = staged({ hero: { inventory3: 49, inventory_maxslots: 2 }, foe: TOUGH });
  assert.equal(typesFor(battle, "hero").includes(MOLTEN), false);
  const hero = heroOf(battle);
  const foe = foeOf(battle);
  let draws = 0;
  assert.throws(
    () => ss2TeamRules.resolveAction({
      type: MOLTEN, turnNumber: battle.turnNumber, actor: hero, target: foe, targetId: foe.id,
      allies: [hero], foes: [foe]
    }, { randomBetween: () => { draws += 1; return 10; }, randomNumber: () => 0 }),
    /outside inventory_maxslots 2/
  );
  assert.equal(draws, 0, "refused before the first draw");
});

test("a spell the caster does not carry is refused, and the refusal names the item", () => {
  const battle = staged();
  assert.throws(() => applyAction(battle, { actorId: "hero", type: MOLTEN, targetId: "foe" }), /Illegal action/);
  const hero = heroOf(battle);
  const foe = foeOf(battle);
  assert.throws(
    () => ss2TeamRules.resolveAction({
      type: MOLTEN, turnNumber: battle.turnNumber, actor: hero, target: foe, targetId: foe.id,
      allies: [hero], foes: [foe]
    }, { randomBetween: () => 10, randomNumber: () => 0 }),
    /no declared inventory slot holds item 49/
  );
});

test("a forced phase still outranks molten death", () => {
  const battle = staged({ hero: { inventory1: 49 } });
  heroOf(battle).resources.staminaleft.value = 0;
  assert.deepEqual(typesFor(battle, "hero"), [Ss2ActionType.REST]);
});

/* ------------------------------------------------------------------ *
 * The phase: draws                                                    *
 * ------------------------------------------------------------------ */

test("the draws are 1 + 4N, in the build's order: the count, then x, y, speed, scale per boulder", () => {
  for (const count of [10, 20]) {
    const battle = staged({ hero: { inventory1: 49 }, foe: TOUGH });
    const hero = heroOf(battle);
    const foe = foeOf(battle);
    const calls = [];
    const values = { count, x: 0, y: -700, yspeed: 100, scale: 75 };
    ss2TeamRules.resolveAction({
      type: MOLTEN, turnNumber: battle.turnNumber, actor: hero, target: foe, targetId: foe.id,
      allies: [hero], foes: [foe]
    }, {
      randomBetween: (label, min, max) => {
        calls.push([label, min, max]);
        return label.endsWith("-count") ? values.count : values[label.split("-").at(-1)];
      },
      randomNumber: () => assert.fail("the arm has no RandomNumber opcode")
    });
    const expected = [["death-from-above-boulder-count", 10, 20]];
    for (let i = 1; i <= count; i += 1) {
      expected.push(
        [`death-from-above-boulder-${i}-x`, -300, 300],
        [`death-from-above-boulder-${i}-y`, -799, -601],
        [`death-from-above-boulder-${i}-yspeed`, 50, 150],
        [`death-from-above-boulder-${i}-scale`, 50, 100]
      );
    }
    assert.equal(calls.length, 1 + 4 * count, `N = ${count}: 1 + 4N draws`);
    assert.deepEqual(calls, expected, `N = ${count}: the build's order, boulder by boulder`);
  }
});

test("an exact tape of 1 + 4N is consumed to the last sample; one short is exhausted, not guessed", () => {
  for (const count of [10, 20]) {
    const battle = staged({ hero: { inventory1: 49 }, foe: TOUGH, rngTape: showerTape(count) });
    const event = cast(battle);
    assert.equal(battle.rng.cursor, 1 + 4 * count);
    assert.equal(battle.rng.remainingCount, 0);
    assert.equal(event.boulderCount, count);
    assert.equal(event.hits.length, count, `N = ${count}: every boulder lands`);
  }
  const short = staged({ hero: { inventory1: 49 }, foe: TOUGH, rngTape: showerTape(10).slice(0, -1) });
  assert.throws(() => cast(short), RngExhaustedError);
});

test("a tape that draws the start height over the brief's (-800, -600) is refused at the cursor", () => {
  // The build's call is randomBetween(-600, -800), which reaches -601..-799.
  const tape = showerTape(10).map((sample) =>
    sample.label.endsWith("-y") ? { ...sample, min: -800, max: -600 } : sample);
  assert.throws(() => cast(staged({ hero: { inventory1: 49 }, foe: TOUGH, rngTape: tape })), RngSequenceError);
});

test("seeded: N lands in 10..20, every value in its range, and the cursor moves 1 + 4N", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 12; seed += 1) {
    const battle = staged({ hero: { inventory1: 49 }, foe: TOUGH, seed });
    const before = battle.rng.cursor;
    const event = cast(battle);
    const n = event.boulderCount;
    seen.add(n);
    assert.ok(n >= 10 && n <= 20, `seed ${seed}: N = ${n}`);
    assert.equal(battle.rng.cursor - before, 1 + 4 * n);
    assert.deepEqual(drawsOf(battle, before)[0],
      { label: "death-from-above-boulder-count", source: "randomBetween", min: 10, max: 20 });
    for (const b of event.boulders) {
      assert.ok(b.xOffset >= -300 && b.xOffset <= 300);
      assert.ok(b.y0 >= -799 && b.y0 <= -601);
      assert.ok(b.ySpeed >= 50 && b.ySpeed <= 150);
      assert.ok(b.scale >= 50 && b.scale <= 100);
      assert.ok(b.landingFrame >= 6 && b.landingFrame <= 19, `frame ${b.landingFrame}`);
    }
  }
  assert.ok(seen.size > 1, "the count is drawn, not fixed");
});

/* ------------------------------------------------------------------ *
 * The phase: the ingress, N times                                     *
 * ------------------------------------------------------------------ */

test("N hits of 40 against NO armour: 40N off the hitpoints, every hit whole", () => {
  for (const count of [10, 20]) {
    const battle = staged({ hero: { inventory1: 49 }, foe: TOUGH, rngTape: showerTape(count) });
    const before = foeOf(battle).health;
    const event = cast(battle);
    assert.equal(event.armourDamage, 0);
    assert.equal(event.hitpointDamage, 40 * count);
    assert.equal(foeOf(battle).health, before - 40 * count);
    for (const hit of event.hits) {
      assert.deepEqual([hit.armourDamage, hit.hitpointDamage, hit.afterDeath], [0, 40, false]);
    }
  }
});

test("N hits of 40 against ARMOUR: armour first, the overflow rewrite once, then whole hits", () => {
  // 136 armour: 96, 56, 16 absorbed; the fourth takes the last 16 and rewrites
  // the register to 24; hits 5-10 are 40 each. Breastplate 6 joins
  // ceil(6 * register / 100) stamina per hit: 3, 3, 3, 2, then 3.
  const battle = staged({ hero: { inventory1: 49 }, foe: { ...TOUGH, ...ARMOURED }, rngTape: showerTape(10) });
  const foe = foeOf(battle);
  assert.equal(foe.resources.armourclass.value, 136);
  foe.resources.staminaleft.value = 100;
  const hp = foe.health;
  const event = cast(battle);
  assert.deepEqual(event.hits.map((hit) => hit.armourDamage), [40, 40, 40, 16, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(event.hits.map((hit) => hit.hitpointDamage), [0, 0, 0, 24, 40, 40, 40, 40, 40, 40]);
  assert.deepEqual(event.hits.map((hit) => hit.staminaBonus), [3, 3, 3, 2, 3, 3, 3, 3, 3, 3]);
  assert.equal(event.armourDamage, 136);
  assert.equal(event.hitpointDamage, 24 + 6 * 40);
  assert.equal(event.staminaBonus, 29);
  assert.equal(foeOf(battle).resources.armourclass.value, 0, "check_stats floors it");
  assert.equal(foeOf(battle).health, hp - 264);
  assert.equal(foeOf(battle).resources.staminaleft.value, 129, "the stamina join runs on EVERY hit");

  // `staminaBonus` is the ingress's own per-call numbers, summed and UNCLAMPED:
  // at a full pool `check_stats` keeps all 29 off.
  const full = staged({ hero: { inventory1: 49 }, foe: { ...TOUGH, ...ARMOURED }, rngTape: showerTape(10) });
  assert.equal(cast(full).staminaBonus, 29);
  assert.equal(foeOf(full).resources.staminaleft.value, 160);
});

test("the exact-equality quirk fires once, on the hit that takes armour to exactly 0", () => {
  // 80 armour: 40, then 0 EXACTLY — which skips the overflow rewrite, so the
  // full 40 also reaches hitpoints on that hit.
  const battle = staged({ hero: { inventory1: 49 }, foe: TOUGH, rngTape: showerTape(10) });
  foeOf(battle).resources.armourclass.value = 80;
  foeOf(battle).resources.armourclass_max.value = 80;
  const event = cast(battle);
  assert.deepEqual(event.hits.map((hit) => hit.armourDamage), [40, 40, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(event.hits.map((hit) => hit.hitpointDamage), [0, 40, 40, 40, 40, 40, 40, 40, 40, 40]);
  assert.equal(event.hitpointDamage, 360);
});

test("a KILL mid-shower: the later boulders land on the dead, throw nothing and move no hitpoint", () => {
  // 170 HP, unarmoured: 130, 90, 50, 10, dead on the fifth. `death()` deletes
  // the FIGHTERS' onEnterFrame and `nextphase`, not the boulders', so the other
  // five still call the ingress on the same defender.
  const battle = staged({ hero: { inventory1: 49 }, rngTape: showerTape(10) });
  const hero = heroOf(battle);
  const stamina = hero.resources.staminaleft.value;
  const event = cast(battle);
  assert.equal(foeOf(battle).alive, false);
  assert.equal(foeOf(battle).health, 0);
  assert.equal(event.killingHit, 5);
  assert.deepEqual(event.hits.map((hit) => hit.afterDeath),
    [false, false, false, false, false, true, true, true, true, true]);
  assert.deepEqual(event.hits.map((hit) => hit.hitpointDamage), [40, 40, 40, 40, 10, 0, 0, 0, 0, 0]);
  assert.equal(event.hitpointDamage, 170);
  assert.equal(battle.events.filter((entry) => entry.type === "battle-result-pending").length, 1,
    "one result, not six");
  // No transition on a kill: `death()` deleted `nextphase`.
  assert.equal(event.staminaSpent, 0);
  assert.equal(event.staminaGained, 0);
  assert.equal(hero.resources.staminaleft.value, stamina);
  // Consumed anyway: the slot goes when the phase BEGINS.
  assert.equal(hero.resources.inventory1.value, SS2_INVENTORY_EMPTY);
});

test("after the kill the ingress still runs its stamina join on the dead body, and nothing else moves", () => {
  // Breastplate 6 is 96 armour on a 170-HP body: 56, 16, overflow 24 (146),
  // 106, 66, 26, dead on the seventh. Stamina from 10: +3 +3 +2 +3 +3 +3 +3 =
  // 30 at the kill, and the three boulders that land on the dead add +3 each.
  // Faithful, and it can change nothing a living combatant reads.
  const battle = staged({ hero: { inventory1: 49 }, foe: { breastplate: 6 }, rngTape: showerTape(10) });
  foeOf(battle).resources.staminaleft.value = 10;
  const event = cast(battle);
  assert.equal(event.killingHit, 7);
  const after = event.hits.slice(7);
  assert.equal(after.length, 3);
  for (const hit of after) {
    assert.deepEqual([hit.afterDeath, hit.armourDamage, hit.hitpointDamage, hit.staminaBonus], [true, 0, 0, 3]);
  }
  assert.equal(foeOf(battle).resources.staminaleft.value, 39);
  assert.equal(foeOf(battle).health, 0);
  assert.equal(foeOf(battle).resources.armourclass.value, 0);
});

test("a kill runs death()'s clear on the victim's conditions; a shower it survives clears nothing", () => {
  const killed = staged({ hero: { inventory1: 49 }, rngTape: showerTape(10) });
  foeOf(killed).status = [...(foeOf(killed).status ?? []), "poison"];
  cast(killed);
  assert.equal(foeOf(killed).status.includes("poison"), false, "death() clears all six flags on both sides");

  const survived = staged({ hero: { inventory1: 49 }, foe: TOUGH, rngTape: showerTape(10) });
  foeOf(survived).status = [...(foeOf(survived).status ?? []), "poison"];
  cast(survived);
  assert.equal(foeOf(survived).status.includes("poison"), true, "the ingress itself writes no condition");
});

test("a first-blood result is REFUSED, as for every spell, not dropped mid-shower", () => {
  const rules = createSs2TeamRules({ fightMode: "duel", fixtureReplay: true });
  const battle = staged({ hero: { inventory1: 49 }, foe: TOUGH, rules, rngTape: showerTape(10) });
  assert.throws(() => cast(battle), /first-blood/);
});

test("the victim's charge is reset even when armour absorbs every boulder", () => {
  // Ingress step 4, `psyche_up = 1`, is an unconditional join. 558 armour
  // against 400.
  const battle = staged({ hero: { inventory1: 49 }, foe: { ...TOUGH, ...ALL_NINES, psyche_up: 3 }, rngTape: showerTape(10) });
  assert.equal(foeOf(battle).resources.armourclass.value, 558);
  assert.equal(foeOf(battle).resources.psyche_up.value, 3);
  const event = cast(battle);
  assert.equal(event.hitpointDamage, 0);
  assert.equal(event.armourDamage, 400);
  assert.equal(foeOf(battle).resources.psyche_up.value, 1);
});

test("\"burning\" is the victim's CLIP: nobody is set alight", () => {
  const battle = staged({ hero: { inventory1: 49 }, foe: TOUGH });
  cast(battle);
  assert.deepEqual((foeOf(battle).status ?? []).filter((token) => token.startsWith("burning")), []);
});

test("the cost is round(magicka), spent once for the whole shower, with the slot consumed to 1", () => {
  // `staminacost = Math.round(game_attacker.magicka)` at `+0x8655`, assigned
  // every tick and spent by the teardown's one `nextphase`.
  const battle = staged({ hero: { inventory4: 49, magicka: 12 }, foe: TOUGH });
  const hero = heroOf(battle);
  hero.resources.staminaleft.value = 40;
  const event = cast(battle);
  assert.equal(event.staminaSpent, 12);
  assert.equal(event.staminaGained, -12 + 1 + Math.round(6 / 3), "the NET change, cost included");
  assert.equal(hero.resources.staminaleft.value, 40 + event.staminaGained);
  assert.equal(event.consumedSlot, "inventory4");
  assert.equal(hero.resources.inventory4.value, SS2_INVENTORY_EMPTY);
  assert.equal(typesFor(battle, "hero").includes(MOLTEN), false, "and the offer is gone");

  // No affordability gate: a caster at 1 stamina casts and floors at 0.
  const broke = staged({ hero: { inventory1: 49, magicka: 30 }, foe: TOUGH });
  heroOf(broke).resources.staminaleft.value = 1;
  assert.equal(typesFor(broke, "hero").includes(MOLTEN), true);
  cast(broke);
  assert.equal(heroOf(broke).resources.staminaleft.value, 0);
});

test("only the target is hit: a body standing where the boulders fall is never consulted", () => {
  const battle = staged({
    hero: { inventory1: 49 }, foe: TOUGH, foeX: 900, extraFoes: [{ id: "near", x: 950, fields: TOUGH }]
  });
  const nearBefore = combatantById(battle, "near").health;
  const event = cast(battle, "foe");
  assert.equal(event.targetId, "foe");
  assert.equal(combatantById(battle, "near").health, nearBefore);
});

/* ------------------------------------------------------------------ *
 * The event                                                           *
 * ------------------------------------------------------------------ */

test("the landing frame: the first fall past 150, strictly — floor((150 - y0) / v) + 1", () => {
  const cases = [
    // y0,  v,   frame
    [-601, 150, 6], // the earliest
    [-799, 50, 19], // the latest: -800 is not reachable, so 20 is not either
    [-700, 100, 9],
    [-650, 100, 9], // 8 frames reach EXACTLY 150, which is not past it
    [-651, 100, 9],
    [-649, 100, 8]
  ];
  for (const [y0, v, frame] of cases) {
    assert.equal(ss2BoulderLandingFrame(y0, v), frame, `y0 ${y0}, v ${v}`);
    // Simulate the closure, frame by frame, to check the formula against it.
    let y = y0;
    let landed = null;
    for (let f = 1; f <= 40 && landed === null; f += 1) {
      if (!(y > 150)) y += v;
      if (y > 150) landed = f;
    }
    assert.equal(landed, frame, `the closure itself, y0 ${y0}, v ${v}`);
  }
});

test("the event carries every boulder in draw order, and the hits in LANDING order", () => {
  // Boulder 1 lands on frame 16, boulder 3 on frame 9, the rest on frame 6.
  const tape = showerTape(10, (i) => {
    if (i === 1) return { x: -300, y: -601, yspeed: 50, scale: 50 };
    if (i === 3) return { x: 300, y: -700, yspeed: 100, scale: 100 };
    return { x: i, y: -601, yspeed: 150, scale: 60 + i };
  });
  const battle = staged({ hero: { inventory1: 49 }, foe: TOUGH, rngTape: tape });
  const event = cast(battle);
  assert.equal(event.boulderCount, 10);
  assert.deepEqual(event.boulders[0], { index: 1, xOffset: -300, y0: -601, ySpeed: 50, scale: 50, landingFrame: 16 });
  assert.deepEqual(event.boulders[2], { index: 3, xOffset: 300, y0: -700, ySpeed: 100, scale: 100, landingFrame: 9 });
  assert.deepEqual(event.boulders[4], { index: 5, xOffset: 5, y0: -601, ySpeed: 150, scale: 65, landingFrame: 6 });
  assert.deepEqual(event.boulders.map((b) => b.index), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  // Same-frame hits by boulder index (INVENTED; every hit is the same 40).
  assert.deepEqual(event.hits.map((hit) => hit.boulder), [2, 4, 5, 6, 7, 8, 9, 10, 3, 1]);
});

test("the event names the build's clips, and NOTHING a bolt, a fireball or a walk would be read by", () => {
  const event = cast(staged({ hero: { inventory1: 49 }, foe: TOUGH }));
  assert.equal(event.vanillaLabel, "cast_death_from_above");
  assert.equal(event.casterClip, "Cast2");
  assert.equal(event.victimClip, "burning", "`damage_method`, played by defenderClip.gotoAndPlay on every hit");
  assert.equal(event.bonusFrame, 4);
  assert.equal(event.spellId, 49);
  assert.equal(event.damagePerBoulder, 40);
  assert.equal(event.killingHit, null);
  // `boltFrame` would attach a LIGHTNING BOLT, `xVelocity` would fire a
  // fireball, and `from`/`to` would be read as the caster's own walk.
  for (const field of ["boltFrame", "xVelocity", "from", "to", "fromY", "toY", "targetFrom", "targetTo", "condition"]) {
    assert.equal(Object.hasOwn(event, field), false, `must not carry ${field}`);
  }
});

/* ------------------------------------------------------------------ *
 * The presentation                                                    *
 * ------------------------------------------------------------------ */

function presented({ foe = TOUGH } = {}) {
  const battle = staged({ hero: { inventory1: 49 }, foe, foeX: 440 });
  applyAction(battle, { actorId: "hero", type: MOLTEN, targetId: "foe" });
  const wire = toTeamWireState(battle);
  const layout = buildArenaLayout(wire);
  return { battle, ...presentResolvedEvents(wire, { layout, bindings: SS2_STATIC_MAP_BINDINGS }) };
}

test("a presented shower plays Cast2 on the caster and burning on the victim — nothing unmapped, nothing flies", () => {
  const { commands } = presented();
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), []);
  assert.equal(commands.filter((command) => command.kind === CommandKind.ATTACH_EFFECT).length, 0, "no bolt");
  assert.equal(commands.filter((command) => command.kind === CommandKind.FIRE_PROJECTILE).length, 0, "no fireball");
  const clips = commands.filter((command) => command.kind === CommandKind.CLIP_GOTO);
  assert.deepEqual(clips.map((command) => `${command.role}:${command.label}`), ["actor:Cast2", "target:burning"]);
  for (const clip of clips) assert.equal(clip.labelProvenance, LabelProvenance.MAP_NAMED);
  // Both resolve to families that can draw them.
  for (const [label, role, member] of [["Cast2", "actor", "cast2"], ["burning", "target", "burning"]]) {
    const timeline = timelineFor(label, { role });
    assert.equal(timeline.recognised, true, label);
    assert.ok(clipLabelsFor(timeline.family).includes(member), label);
  }
});

test("a KILLING shower still ends on the victim's death", () => {
  const { commands, battle } = presented({ foe: {} });
  assert.equal(foeOf(battle).alive, false);
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), []);
  const victim = commands.filter((command) => command.kind === CommandKind.CLIP_GOTO && command.combatantId === "foe");
  assert.deepEqual(victim.map((command) => `${command.role}:${command.label}`), ["target:burning", "defeated:slain"],
    "the burn, then the death: the ingress's own `slain` outside a duel");
});

/* ------------------------------------------------------------------ *
 * The AI                                                              *
 *                                                                     *
 * Ladder arm 7 of `villain_cast_spells` (`+0x0855`-`+0x088b`):        *
 * `check_inventory(49)` and NOTHING else. It follows arms 1-6         *
 * (rejuvenate, the id-5 potion, regenerate, the 4, 3, 2 potions) and   *
 * pre-empts arms 8-28 — the armour and stamina potions, every damage   *
 * spell, weaken, boundless energy, the gale, the teleport.             *
 * ------------------------------------------------------------------ */

function aiStaged({ hero = {}, foe = {}, heroX = 0, foeX = 120, rules = ss2TeamRules, extraFoes = [] } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller: "ai" })] },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller: "ai" }),
          ...extraFoes.map((extra) =>
            ss2Combatant(fields({ gladiator_dir: "left", ...extra.fields }), { id: extra.id, name: extra.id, controller: "ai" }))
        ]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: heroX, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: foeX, y: 200 });
  for (const extra of extraFoes) Object.assign(combatantById(battle, extra.id), { x: extra.x, y: extra.y ?? 200 });
  return battle;
}

const pick = (battle) => suggestAction(battle, "hero");

test("an AI carrying 49 casts it, in reach and far beyond it", () => {
  assert.deepEqual(pick(aiStaged({ hero: { inventory1: 49 } })), { type: MOLTEN, targetId: "foe" });
  assert.deepEqual(pick(aiStaged({ hero: { inventory1: 49 }, foeX: 1960 })), { type: MOLTEN, targetId: "foe" });
  // The control: nothing carried, nothing changes.
  assert.equal(pick(aiStaged()).type, Ss2ActionType.QUICK_ATTACK);
  assert.equal(pick(aiStaged({ foeX: 1960 })).type, Ss2ActionType.WALK_RIGHT);
});

test("on POSSESSION ALONE, not priced: a heavy hitter who would keep a fireball still casts it", () => {
  const heavy = { strength: 60, attack: 60, weapon: 24 };
  assert.equal(pick(aiStaged({ hero: { inventory1: 30, ...heavy } })).type, Ss2ActionType.POWER_ATTACK,
    "the control: a fireball is priced and loses to the swing");
  assert.equal(pick(aiStaged({ hero: { inventory1: 49, ...heavy } })).type, MOLTEN);
});

test("a health potion below half comes FIRST — arms 2 and 4-6 precede arm 7", () => {
  for (const potion of [5, 4, 3, 2]) {
    const battle = aiStaged({ hero: { inventory1: 49, inventory2: potion } });
    heroOf(battle).health = 84;
    assert.deepEqual(pick(battle), { type: Ss2ActionType.DRINK_POTION, targetId: "hero", itemId: potion }, `id ${potion}`);
    heroOf(battle).health = 85;
    assert.equal(pick(battle).type, MOLTEN, `id ${potion}: at exactly half the arm is shut`);
  }
});

test("regenerate below half comes FIRST — arm 3 precedes arm 7", () => {
  const battle = aiStaged({ hero: { inventory1: 49, inventory2: 46 } });
  heroOf(battle).health = 84;
  assert.equal(pick(battle).type, Ss2ActionType.CAST_REGENERATE);
  heroOf(battle).health = 170;
  assert.equal(pick(battle).type, MOLTEN);
});

test("it PRE-EMPTS the armour oils and the stamina vials — arm 7 precedes arms 10-13", () => {
  for (const [potion, pool] of [[9, "armourclass"], [8, "armourclass"], [7, "staminaleft"], [6, "staminaleft"]]) {
    const battle = aiStaged({ hero: { inventory1: potion, inventory2: 49, ...ARMOURED } });
    heroOf(battle).resources[pool].value = 20;
    assert.equal(pick(battle).type, MOLTEN, `id ${potion}`);
    // The control: without 49 the same gladiator drinks.
    heroOf(battle).resources.inventory2.value = SS2_INVENTORY_EMPTY;
    assert.deepEqual(pick(battle), { type: Ss2ActionType.DRINK_POTION, targetId: "hero", itemId: potion }, `id ${potion}`);
  }
});

test("it PRE-EMPTS every damage spell, weaken, boundless energy, the gale and the teleport", () => {
  const cases = [
    [32, Ss2ActionType.CAST_DIRE_FIREBALL, {}],
    [35, Ss2ActionType.CAST_FRIGHTNING_BOLT, {}],
    [30, Ss2ActionType.CAST_FIREBALL, {}],
    [44, Ss2ActionType.CAST_WEAKEN_ARMOUR, {}],
    // Whirlwind (arm 20) joined when the parallel worktrees were merged on
    // 2026-09-22; its own gate is fightdistance < 200, which 120 meets.
    [37, Ss2ActionType.CAST_WHIRLWIND, {}],
    [45, Ss2ActionType.CAST_BOUNDLESS_ENERGY, {}],
    // The gale's own gate: armour below half, the foe inside 400.
    [38, Ss2ActionType.CAST_GALE, { armourclass: 20 }],
    // The teleport's own gate: below half health, the foe inside 250. No
    // health potion, so arm 2 cannot take it first.
    [48, Ss2ActionType.CAST_TELEPORT, { health: 60 }]
  ];
  for (const [id, type, pools] of cases) {
    const battle = aiStaged({ hero: { inventory1: id, inventory2: 49, ...ARMOURED } });
    const hero = heroOf(battle);
    if (pools.armourclass !== undefined) hero.resources.armourclass.value = pools.armourclass;
    if (pools.health !== undefined) hero.health = pools.health;
    assert.equal(pick(battle).type, MOLTEN, `id ${id}`);
    hero.resources.inventory2.value = SS2_INVENTORY_EMPTY;
    assert.equal(pick(battle).type, type, `id ${id}: the control, without 49`);
  }
});

test("it PRE-EMPTS ghost strike too, whose own gate wants the foe beyond 500", () => {
  // Arm 21, merged the same day. Staged at 600 so ghost strike's gate is open.
  const battle = aiStaged({ hero: { inventory1: 36, inventory2: 49, ...ARMOURED }, foeX: 600 });
  assert.equal(pick(battle).type, MOLTEN);
  heroOf(battle).resources.inventory2.value = SS2_INVENTORY_EMPTY;
  assert.equal(pick(battle).type, Ss2ActionType.CAST_GHOST_STRIKE, "the control, without 49");
});

test("it REPLACES the tired rest in range, because the ladder runs after it", () => {
  const battle = aiStaged({ hero: { inventory1: 49 } });
  heroOf(battle).resources.staminaleft.value = 10;
  assert.equal(pick(battle).type, MOLTEN);
  heroOf(battle).resources.inventory1.value = SS2_INVENTORY_EMPTY;
  assert.equal(pick(battle).type, Ss2ActionType.REST, "the control: the same gladiator without it rests");
});

test("above 1v1 the AI drops it on the most wounded foe (INVENTED; the build has one defender)", () => {
  const battle = aiStaged({ hero: { inventory1: 49 }, extraFoes: [{ id: "hurt", x: 900, fields: {} }] });
  combatantById(battle, "hurt").health = 30;
  assert.deepEqual(pick(battle), { type: MOLTEN, targetId: "hurt" });
});

test("the AI takes no sample to decide, so the build's 90% roll is not reproduced", () => {
  const battle = aiStaged({ hero: { inventory1: 49 } });
  const before = battle.rng.cursor;
  pick(battle);
  assert.equal(battle.rng.cursor, before);
});

test("an AI bout with molten death runs to a result through the ordinary host path", () => {
  const battle = createTeamBattle({
    seed: 5,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, inventory1: 49 }), { id: "hero", name: "hero", controller: "ai" })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ ...TOUGH }), { id: "foe", name: "foe", controller: "ai" })] }
    ]
  });
  let guard = 0;
  while (!battle.result && guard < 2000) {
    const actor = currentCombatant(battle);
    applyAction(battle, { actorId: actor.id, ...suggestAction(battle, actor.id) });
    guard += 1;
  }
  assert.ok(battle.result, "the bout must end");
  assert.equal(battle.events.filter((event) => event.type === MOLTEN).length, 1, "cast once: the item is consumed");
});
