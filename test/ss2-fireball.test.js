/**
 * `cast_fireball` / `cast_hell_fireball` / `cast_dire_fireball` — inventory
 * ids 30, 31 and 32, and the third spell arm this engine resolves.
 *
 * ## THE ARM, FROM THE BYTES
 *
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f`, block base `0x240c85`,
 * `+0x8f59`-`+0x94ff`, read 2026-09-22 off the main session's dump of the
 * oracle whose sha256 is `77CB545C…`:
 *
 * ```text
 *   phase_decision == "cast_fireball" || == "cast_hell_fireball"
 *     || == "cast_dire_fireball"                                   +0x8f59-+0x8f8f
 *   crowd_action = 5; staminacost = Math.round(magicka)            +0x8f94-+0x8fc7
 *   if (attacker.struck == null) {                                 +0x8fda
 *     bullet_in_air = true                                         +0x8fdf
 *     [one of] cast_spell_icon(attacker, 30|31|32)
 *              fireball_damage = randomBetween(80,160 | 150,450 | 300,600)
 *              fireball_frame  = 1 | 2 | 3                          +0x8ffa-+0x90d6
 *     attacker.struck = false; attacker.fired = true                +0x90d7-+0x90f3
 *     attacker.gotoAndPlay("Cast1")                                 +0x90f4
 *   }
 *   if (((bullet._x > defender._x && dir == "right")
 *        || (bullet._x < defender._x && dir == "left"))
 *       && bullet._currentframe != 4) {                             +0x9109-+0x9196
 *     magic_damage_character(defender, attacker, game_defender,
 *         game_attacker, "burning", 4, fireball_damage)             +0x91c1
 *     bullet.gotoAndStop(4); bullet.flying = false;
 *     bullet_in_air = false                                         +0x91cd-+0x91fc
 *   }
 *   if (attacker.fired == true) {                                   +0x91fd
 *     attacker.fired = false
 *     bullet = arena.gladiators.attachMovie("fireball_combat", ..., 45000)
 *     bullet.gotondStop(fireball_frame)      // sic — see below      +0x9276
 *     bullet._x = attacker._x ± 30 (mirrored _xscale facing left)  +0x927e-+0x92f9
 *     bullet._y = attacker._y - (attacker._yscale * 1.5 + 5)       +0x92fa-+0x9332
 *     bullet.Xvelocity = 50 | 70 | 90                              +0x940f/+0x9435/+0x945b
 *     bullet.onEnterFrame = () => {
 *       if (bullet.flying != false) bullet._x ±= bullet.Xvelocity   +0x947b-+0x94fe
 *     }
 *   }
 * ```
 *
 * ► **ONE SAMPLE AND NO HIT ROLL.** The three `randomBetween` sites are
 *   mutually exclusive, and there is no `checkattackroll`, no direction draw
 *   and no `RandomNumber` anywhere in the arm. **It cannot miss**: the impact
 *   test has no ground, lifetime or off-screen clause, only "past the victim's
 *   x in the caster's facing".
 * ► **`gotondStop` IS A TYPO IN THE BUILD** (constant pool entry 343), a call
 *   to a MovieClip method that does not exist, so `fireball_frame` is never
 *   applied and all three spells fly on `fireball_combat` frame 1.
 * ► **THE FLIGHT IS FLAT.** The `onEnterFrame` reads `flying`,
 *   `gladiator_dir`, `_x` and `Xvelocity` and nothing else; `gravity`,
 *   `bulletlife`, `bulletcounter` and `distance_to_enemy` are written and never
 *   read. *(The battle map's "ballistic flight" sentence is corrected at the
 *   site.)*
 *
 * ## WHAT IS INVENTED, SAID OUT LOUD
 *
 * - **That the caster picks a target**, as for the bolts.
 * - **Which side of the poll-order ambiguity the arrival tick is on** — see
 *   `fireballImpact` in `src/render/projectile.js` and the tests below.
 * - **The depth the fireball flies at above 1v1**: the build has none, and it
 *   interpolates the caster's rank to the target's exactly as the arrow does.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, suggestAction, toTeamWireState
} from "../src/team/index.js";
import {
  SS2_BOLT_SPELLS, SS2_DAMAGE_SPELL_LADDER, SS2_FIREBALL_INGRESS, SS2_FIREBALL_SPELLS, SS2_INVENTORY_EMPTY,
  Ss2ActionType, VANILLA_PHASE_LABEL, createSs2TeamRules, ss2Combatant, ss2TeamRules
} from "../src/team/ss2-rules.js";
import { SS2_DIRECT_DAMAGE_SPELLS } from "../src/golden/ss2-spell-candidate.js";
import {
  buildArenaLayout, CommandKind, LabelProvenance, presentResolvedEvents, SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import {
  animationCursor, applyCommands, emptyScene, fireballAt, fireballDrawAt, fireballFlight, fireballImpact,
  fireballLifetimeMs, fireballOpsFor, flightDurationMs, PROJECTILE_FRAME_MS, propPackFrom, reactionDelaysFor,
  SS2_FIREBALL, SS2_PROJECTILE, timelineFor, timelinesForStep
} from "../src/render/index.js";
import { clipLabelsFor } from "../src/render/clip-labels.js";

const FIREBALL = Ss2ActionType.CAST_FIREBALL;
const HELL = Ss2ActionType.CAST_HELL_FIREBALL;
const DIRE = Ss2ActionType.CAST_DIRE_FIREBALL;
const ALL = Object.freeze([
  [FIREBALL, 30, 80, 160, 50],
  [HELL, 31, 150, 450, 70],
  [DIRE, 32, 300, 600, 90]
]);

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

/** A victim that survives even a dire fireball: 40 * 10 + 40 * 20 = 1,200 HP. */
const TOUGH = Object.freeze({ vitality: 40, herolevel: 40 });

/**
 * The caster opens (one point of speed settles initiative, as in the bolt
 * tests), facing right at x -60, and the foe stands at `foeX`.
 */
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

/** Cast, and hand back the fireball's own event off the battle log. */
function cast(battle, type, targetId = "foe") {
  applyAction(battle, { actorId: "hero", type, targetId });
  const event = battle.events.find((entry) => entry.type === type);
  assert.ok(event, `${type}: the fireball's own event is logged`);
  return event;
}

/* ------------------------------------------------------------------ *
 * The vocabulary                                                      *
 * ------------------------------------------------------------------ */

test("three action types, one per phase label, spelled as the build spells them", () => {
  // `+0x8f5f`, `+0x8f73`, `+0x8f87` — the three constants the gate compares,
  // and the three decisions `villain_cast_spells` writes (`+0x0c20`,
  // `+0x0baa`, `+0x0b34`).
  assert.equal(FIREBALL, "cast-fireball");
  assert.equal(HELL, "cast-hell-fireball");
  assert.equal(DIRE, "cast-dire-fireball");
  assert.equal(VANILLA_PHASE_LABEL[FIREBALL], "cast_fireball");
  assert.equal(VANILLA_PHASE_LABEL[HELL], "cast_hell_fireball");
  assert.equal(VANILLA_PHASE_LABEL[DIRE], "cast_dire_fireball");
  const rules = createSs2TeamRules({ fightMode: "tournament" });
  for (const type of [FIREBALL, HELL, DIRE]) assert.ok(rules.actionTypes.includes(type), type);
});

test("the table carries the build's ids, ranges and speeds, and agrees with the spell candidate", () => {
  for (const [type, id, low, high, speed] of ALL) {
    const spell = SS2_FIREBALL_SPELLS[type];
    assert.equal(spell.itemId, id, `${type}: cast_spell_icon(attacker, ${id})`);
    assert.equal(spell.damageLow, low);
    assert.equal(spell.damageHigh, high);
    assert.equal(spell.xVelocity, speed, `${type}: bullet.Xvelocity = ${speed}`);
    // ONE source for the tape label: a fixture and a live battle must put the
    // same name on the same draw.
    const candidate = SS2_DIRECT_DAMAGE_SPELLS[id];
    assert.equal(spell.rollLabel, candidate.rollLabel);
    assert.equal(spell.damageLow, candidate.min);
    assert.equal(spell.damageHigh, candidate.max);
    // Id 30 carried "burning" from the start; 31 and 32 were `null` until
    // 2026-09-20. All three share the arm's ONE call at `+0x91c1`.
    assert.equal(candidate.damageMethod, SS2_FIREBALL_INGRESS.damageMethod);
  }
  assert.equal(SS2_FIREBALL_INGRESS.damageMethod, "burning", "`Push 4, \"burning\"` at +0x91a2");
  assert.equal(SS2_FIREBALL_INGRESS.bonusFrame, 4);
  assert.equal(SS2_FIREBALL_INGRESS.casterClip, "Cast1", "`attacker.gotoAndPlay(\"Cast1\")` at +0x90f4");
  assert.deepEqual(
    Object.values(SS2_FIREBALL_SPELLS).map((spell) => spell.fireballFrame),
    [1, 2, 3],
    "the build ASSIGNS 1/2/3 — and then never applies them (`gotondStop`)"
  );
});

/* ------------------------------------------------------------------ *
 * The offer                                                           *
 * ------------------------------------------------------------------ */

test("no inventory offers no fireball, and each id offers exactly its own spell", () => {
  const empty = typesFor(staged(), "hero");
  for (const [type] of ALL) assert.equal(empty.includes(type), false, `${type} with nothing carried`);

  for (const [type, id] of ALL) {
    const types = typesFor(staged({ hero: { inventory2: id } }), "hero");
    for (const [other] of ALL) {
      assert.equal(types.includes(other), other === type, `carrying ${id} offers ${type} and only ${type}`);
    }
  }
});

test("a fireball is offered PER FOE, out of reach and in another rank alike", () => {
  // The arm has no distance read and the impact test reads only the target's
  // `_x`, so every foe is a legal target from anywhere on the sands.
  const battle = staged({
    hero: { inventory1: 30 },
    foeX: 1900,
    extraFoes: [{ id: "back", x: 400, y: 100, fields: {} }]
  });
  assert.deepEqual(
    legalActions(battle, "hero").filter((option) => option.type === FIREBALL).map((option) => option.targetId).sort(),
    ["back", "foe"]
  );
});

test("the slot window applies to a fireball exactly as to a bolt", () => {
  // `inventory_maxslots` 2 hides button 3 (`sprite:492` `+0x024f`), and the
  // resolve re-find refuses what the offer refused.
  const battle = staged({ hero: { inventory3: 32, inventory_maxslots: 2 }, foe: TOUGH });
  assert.equal(typesFor(battle, "hero").includes(DIRE), false);
  const hero = combatantById(battle, "hero");
  const foe = combatantById(battle, "foe");
  assert.throws(
    () => ss2TeamRules.resolveAction({
      type: DIRE, turnNumber: battle.turnNumber, actor: hero, target: foe, targetId: foe.id,
      allies: [hero], foes: [foe]
    }, { randomBetween: () => 400, randomNumber: () => 0 }),
    /outside inventory_maxslots 2/
  );
});

test("a forced phase still outranks a fireball", () => {
  const battle = staged({ hero: { inventory1: 30 } });
  combatantById(battle, "hero").resources.staminaleft.value = 0;
  assert.deepEqual(typesFor(battle, "hero"), [Ss2ActionType.REST]);
});

/* ------------------------------------------------------------------ *
 * The phase                                                           *
 * ------------------------------------------------------------------ */

test("each fireball takes EXACTLY one sample, under its own label and range, and nothing else", () => {
  // A one-sample TAPE is the strongest form of this: a second draw of any
  // kind — a direction, a hit roll — would throw `RngExhaustedError`, and a
  // wrong label or range would throw `RngSequenceError`.
  for (const [type, id, low, high] of ALL) {
    const value = Math.floor((low + high) / 2);
    const battle = staged({
      hero: { inventory1: id },
      foe: TOUGH,
      rngTape: [{ label: SS2_FIREBALL_SPELLS[type].rollLabel, source: "randomBetween", min: low, max: high, value }]
    });
    const event = cast(battle, type);
    assert.equal(battle.rng.cursor, 1, `${type}: one sample left the channel`);
    assert.equal(event.rolledDamage, value, `${type}: the sample IS the damage`);
    assert.equal(event.attackDirection, undefined, `${type}: no direction chain`);
    assert.equal(event.hit, undefined, `${type}: no hit roll to report`);
  }
});

test("damage goes through the shared magic ingress — armour first, then hitpoints", () => {
  const plain = staged({ hero: { inventory1: 31 }, foe: TOUGH });
  const before = combatantById(plain, "foe").health;
  const event = cast(plain, HELL);
  assert.equal(event.armourDamage, 0, "an unarmoured victim");
  assert.equal(event.hitpointDamage, event.rolledDamage, "the raw roll, no Math.ceil on the magic path");
  assert.equal(combatantById(plain, "foe").health, before - event.rolledDamage);

  const armoured = staged({ hero: { inventory1: 30 }, foe: { ...TOUGH, helmet: 4, breastplate: 6 } });
  const armour = combatantById(armoured, "foe").resources.armourclass.value;
  assert.ok(armour > 0);
  const hit = cast(armoured, FIREBALL);
  assert.equal(hit.armourDamage, Math.min(armour, hit.rolledDamage), "armour takes it first");
  // The overflow rewrite, and the ingress's exact-equality quirk, both
  // unchanged from the bolt: this is `applySs2MagicDamageCandidate`'s path.
  const overflow = hit.rolledDamage > armour ? hit.rolledDamage - armour : hit.rolledDamage === armour ? armour : 0;
  assert.equal(hit.hitpointDamage, overflow);
});

test("a dire fireball is LETHAL to an ordinary gladiator, and a lethal cast spends no stamina", () => {
  // 170 HP against 300-600. `death()` deletes `nextphase`, so the cost the
  // arm assigned is never spent — the bolt's rule, for the same reason.
  const battle = staged({ hero: { inventory1: 32 } });
  assert.equal(combatantById(battle, "foe").maxHealth, 170);
  const stamina = combatantById(battle, "hero").resources.staminaleft.value;
  const event = cast(battle, DIRE);
  assert.equal(combatantById(battle, "foe").alive, false);
  assert.equal(battle.events.at(-1).type, "battle-result-pending");
  assert.equal(event.staminaSpent, 0);
  assert.equal(event.staminaGained, 0);
  assert.equal(combatantById(battle, "hero").resources.staminaleft.value, stamina);
  // Consumed anyway: the slot goes when the phase BEGINS.
  assert.equal(combatantById(battle, "hero").resources.inventory1.value, SS2_INVENTORY_EMPTY);
});

test("the cost is round(magicka), spent unconditionally, with the slot consumed to 1", () => {
  // `staminacost = Math.round(game_attacker.magicka)` at `+0x8fa1`-`+0x8fc7`.
  const battle = staged({ hero: { inventory4: 30, magicka: 12 }, foe: TOUGH });
  const event = cast(battle, FIREBALL);
  assert.equal(event.staminaSpent, 12);
  assert.equal(event.consumedSlot, "inventory4");
  assert.equal(combatantById(battle, "hero").resources.inventory4.value, SS2_INVENTORY_EMPTY);
  assert.equal(typesFor(battle, "hero").includes(FIREBALL), false, "and the offer is gone");

  // No affordability gate: a caster at 1 stamina casts and floors at 0.
  const broke = staged({ hero: { inventory1: 30, magicka: 30 }, foe: TOUGH });
  combatantById(broke, "hero").resources.staminaleft.value = 1;
  assert.equal(typesFor(broke, "hero").includes(FIREBALL), true);
  cast(broke, FIREBALL);
  assert.equal(combatantById(broke, "hero").resources.staminaleft.value >= 0, true);
});

test("the stamina ledger is nextphase's: `staminaGained` is the NET change, cost included", () => {
  // `phaseTransitionEffects` reports `after - before` of
  // `clamp(before - cost + 1 + round(stamina / 3), 0, max)`, so the cost is
  // inside `staminaGained` rather than beside it — the bolt test pins the same.
  const battle = staged({ hero: { inventory1: 31, magicka: 9 }, foe: TOUGH });
  const hero = combatantById(battle, "hero");
  hero.resources.staminaleft.value = 40;
  const event = cast(battle, HELL);
  assert.equal(event.staminaSpent, 9);
  const after = combatantById(battle, "hero").resources.staminaleft.value;
  assert.equal(after - 40, event.staminaGained);
  assert.equal(event.staminaGained, -9 + 1 + Math.round(6 / 3), "cost 9 against a regeneration of 3");
});

test("the victim's charge is interrupted even when armour absorbs the whole fireball", () => {
  // Ingress step 4, `psyche_up = 1`, is an unconditional join.
  const battle = staged({
    hero: { inventory1: 30 },
    foe: {
      ...TOUGH, psyche_up: 3,
      helmet: 9, shoulderguard: 9, breastplate: 9, gauntlet: 9, greaves: 9, shinguard: 9, boot: 9, shield: 9
    }
  });
  const foe = combatantById(battle, "foe");
  foe.resources.psyche_up.value = 3;
  assert.ok(foe.resources.armourclass.value > 160, "armour deeper than any plain fireball");
  const event = cast(battle, FIREBALL);
  assert.equal(event.hitpointDamage, 0);
  assert.equal(combatantById(battle, "foe").resources.psyche_up.value, 1);
});

test("the event names the build's clips and flight, and NOTHING a bolt or a walk would be read by", () => {
  for (const [type, id, , , speed] of ALL) {
    const event = cast(staged({ hero: { inventory1: id }, foe: TOUGH }), type);
    assert.equal(event.vanillaLabel, VANILLA_PHASE_LABEL[type]);
    assert.equal(event.casterClip, "Cast1");
    assert.equal(event.victimClip, "burning", "`damage_method`, played by defenderClip.gotoAndPlay");
    assert.equal(event.bonusFrame, 4);
    assert.equal(event.spellId, id);
    assert.equal(event.xVelocity, speed);
    assert.equal(event.gladiatorDir, "right", "the caster faces right from x -60");
    // `boltFrame` would attach a LIGHTNING BOLT (`spellEffectFor`), and
    // `from`/`to` would be read as the caster's own walk (`displacementOf`).
    for (const field of ["boltFrame", "from", "to", "fromY", "toY", "targetFrom", "targetTo", "condition"]) {
      assert.equal(Object.hasOwn(event, field), false, `${type} must not carry ${field}`);
    }
  }
});

test("a caster facing LEFT reports it, because the flight follows the caster's facing", () => {
  const battle = staged({ hero: { inventory1: 30 }, foe: TOUGH, heroX: 300, foeX: 0 });
  // Facing is recomputed on movement only; stage it the build's way.
  const hero = combatantById(battle, "hero");
  hero.status = [...(hero.status ?? []), "facing-left"];
  assert.equal(cast(battle, FIREBALL).gladiatorDir, "left");
});

test("a fireball the caster does not carry is refused, and the refusal names the item", () => {
  const battle = staged();
  assert.throws(() => applyAction(battle, { actorId: "hero", type: HELL, targetId: "foe" }), /Illegal action/);
  const hero = combatantById(battle, "hero");
  const foe = combatantById(battle, "foe");
  assert.throws(
    () => ss2TeamRules.resolveAction({
      type: HELL, turnNumber: battle.turnNumber, actor: hero, target: foe, targetId: foe.id,
      allies: [hero], foes: [foe]
    }, { randomBetween: () => 200, randomNumber: () => 0 }),
    /no declared inventory slot holds item 31/
  );
});

test("a fireball PASSES THROUGH a body between caster and target — the faithful N-body reading", () => {
  // The impact test compares `bullet._x` with `defender._x` and nothing else,
  // so a gladiator standing in the line of flight is never consulted.
  const battle = staged({
    hero: { inventory1: 31 },
    foe: TOUGH,
    foeX: 900,
    extraFoes: [{ id: "shield", x: 200, fields: TOUGH }]
  });
  const shieldBefore = combatantById(battle, "shield").health;
  const event = cast(battle, HELL, "foe");
  assert.equal(event.targetId, "foe");
  assert.equal(combatantById(battle, "shield").health, shieldBefore, "the body in the way is untouched");
  assert.ok(event.hitpointDamage > 0);
});

/* ------------------------------------------------------------------ *
 * The flight, from the build's arithmetic                             *
 * ------------------------------------------------------------------ */

test("the arrival: k = 0 if s < 30, else floor((s - 30) / V) + 1 — and the tick is max(1, k)", () => {
  // s is the target's distance along the CASTER'S FACING. The bullet starts
  // at `attacker._x ± 30` and the test is strict (`Greater`/`Less2`), so it
  // needs 30 + k*V > s. **THE TICK IS max(1, k)**, the side of the poll-order
  // ambiguity chosen here: the bullet is the NEWEST clip, and the reading is
  // that its onEnterFrame runs before the attacker's on every later frame, so
  // it moves before it is tested. The other order makes the tick k + 1 and
  // the stop k moves; see `fireballImpact`.
  const cases = [
    // s,    V,  k,  tick
    [500, 50, 10, 10],
    [80, 50, 2, 2], // 30 + 50 = 80 is NOT past 80: strict
    [79, 50, 1, 1],
    [30, 50, 1, 1], // 30 is not past 30
    [29, 50, 0, 1], // already past at launch: tested on the next frame, after one move
    [0, 70, 0, 1],
    [-400, 90, 0, 1], // behind the caster: it still cannot miss
    [4200, 50, 84, 84], // the whole clamp, ±2100: the watchdog's 200 cannot bind
    [4200, 90, 47, 47]
  ];
  for (const [s, V, k, tick] of cases) {
    for (const dir of ["right", "left"]) {
      const sign = dir === "right" ? 1 : -1;
      const impact = fireballImpact({ casterX: 100, targetX: 100 + sign * s, gladiatorDir: dir, xVelocity: V });
      assert.equal(impact.separation, s, `${dir} s=${s}`);
      assert.equal(impact.k, k, `${dir} s=${s} V=${V}: k`);
      assert.equal(impact.impactFrame, tick, `${dir} s=${s} V=${V}: the tick`);
      assert.equal(impact.moves, tick, "and it has moved once per frame up to it");
    }
  }
  // The build's `demand_move >= 200` cap needs 199 frames, far past the longest flight.
  assert.ok(fireballImpact({ casterX: -2100, targetX: 2100, gladiatorDir: "right", xVelocity: 50 }).impactFrame < 199);
});

test("the flight is FLAT, from caster ± 30 at the snipe's height, and stops where it was tested", () => {
  const right = fireballFlight({ from: { x: -60, y: 200 }, to: { x: 440, y: 200 }, gladiatorDir: "right", xVelocity: 50 });
  assert.equal(right.launch.x, -30, "`attacker._x + 30`");
  assert.equal(right.launch.height, SS2_PROJECTILE.bombardLaunchHeight * SS2_PROJECTILE.snipeLaunchHeightRatio,
    "`_yscale * 1.5 + 5` — the snipe's launch height, which projectile.js already carries");
  assert.equal(right.flightFrames, 10);
  assert.equal(right.impact.x, -30 + 10 * 50, "the first frame past the victim's x");
  for (let frame = 0; frame < right.flightFrames; frame += 1) {
    const at = fireballAt(right, frame);
    assert.equal(at.stage, "flight");
    assert.equal(at.height, right.launch.height, `frame ${frame}: no gravity is ever read`);
    assert.equal(at.x, -30 + frame * 50);
    assert.equal(at.clipFrame, 1, "`gotondStop` never applied `fireball_frame`");
  }
  const left = fireballFlight({ from: { x: 300, y: 200 }, to: { x: 0, y: 200 }, gladiatorDir: "left", xVelocity: 70 });
  assert.equal(left.launch.x, 270, "`attacker._x - 30`");
  assert.equal(left.direction, -1);
  assert.equal(left.flightFrames, Math.floor((300 - 30) / 70) + 1);
  assert.equal(left.impact.x, 270 - left.flightFrames * 70);
  assert.ok(left.impact.x < 0, "past the victim, on the far side");
});

test("after impact the bullet sits on frame 4 for the explosion, then is gone", () => {
  const flight = fireballFlight({ from: { x: 0, y: 200 }, to: { x: 330, y: 200 }, gladiatorDir: "right", xVelocity: 90 });
  assert.equal(flight.flightFrames, 4);
  const landed = fireballAt(flight, flight.flightFrames);
  assert.equal(landed.stage, "explosion");
  assert.equal(landed.clipFrame, SS2_FIREBALL.explosionFrame);
  assert.equal(landed.ageFrames, 0);
  assert.equal(landed.x, flight.impact.x, "it stops: `flying = false`");
  // Sprite 27's last frame runs `_parent.removeMovieClip()` before it can be
  // drawn, so the explosion shows `explosionFrames - 1` frames.
  const last = fireballAt(flight, flight.flightFrames + SS2_FIREBALL.explosionFrames - 2);
  assert.equal(last.stage, "explosion");
  assert.equal(last.ageFrames, SS2_FIREBALL.explosionFrames - 2);
  assert.equal(fireballAt(flight, flight.flightFrames + SS2_FIREBALL.explosionFrames - 1).stage, "gone");
  assert.equal(fireballLifetimeMs(flight),
    (flight.flightFrames + SS2_FIREBALL.explosionFrames - 1) * PROJECTILE_FRAME_MS);
});

test("drawn: mirrored when the caster faces left, and done when the explosion is", () => {
  const deps = {
    frontY: 200,
    rankStride: 100,
    figureScaleFor: () => 1,
    rankOfDepth: () => 0
  };
  const left = fireballFlight({ from: { x: 300, y: 200 }, to: { x: 0, y: 200 }, gladiatorDir: "left", xVelocity: 50 });
  const flying = fireballDrawAt(left, PROJECTILE_FRAME_MS, deps);
  assert.equal(flying.mirrored, true, "`bullet._xscale = 0 - bullet._xscale` facing left");
  assert.equal(flying.clipFrame, 1);
  assert.equal(flying.done, false);
  assert.ok(flying.lift > 0);
  const gone = fireballDrawAt(left, fireballLifetimeMs(left), deps);
  assert.equal(gone.done, true);
  const right = fireballFlight({ from: { x: 0, y: 200 }, to: { x: 300, y: 200 }, gladiatorDir: "right", xVelocity: 50 });
  assert.equal(fireballDrawAt(right, 0, deps).mirrored, false);
});

test("a pack with no `fireball_combat` draws nothing rather than throwing", () => {
  assert.equal(fireballOpsFor(null, 1, 0), null);
  assert.equal(fireballOpsFor(propPackFrom({ props: {}, shapes: {} }), 4, 3), null);
  const pack = propPackFrom({
    props: {
      fireball_combat: {
        frames: [
          [{ shape: "ball", matrix: [1, 0, 0, 1, 0, 0] }],
          [], [],
          [{ shape: "boom0", matrix: [1, 0, 0, 1, 0, 0] }]
        ],
        clock: {
          framesByParent: [
            [], [], [],
            [
              [{ shape: "boom0", matrix: [1, 0, 0, 1, 0, 0] }],
              [{ shape: "boom1", matrix: [1, 0, 0, 1, 0, 0] }]
            ]
          ]
        }
      }
    },
    shapes: {
      ball: { paths: [{ d: "M0 0L1 1", fill: "#ff8800" }] },
      boom0: { paths: [{ d: "M0 0L2 2", fill: "#ff0000" }] },
      boom1: { paths: [{ d: "M0 0L3 3", fill: "#ffff00" }] }
    }
  });
  assert.equal(fireballOpsFor(pack, 1, 0)[0].d, "M0 0L1 1", "frame 1 in flight");
  assert.equal(fireballOpsFor(pack, 4, 0)[0].d, "M0 0L2 2", "the explosion at age 0");
  assert.equal(fireballOpsFor(pack, 4, 1)[0].d, "M0 0L3 3", "and it AGES");
  // Age 4 of a two-frame clock: WRAPPING would land on index 0 (`4 % 2`) and
  // clamping on index 1. (Age 9 could not tell them apart — `9 % 2` is 1 too,
  // which is how the first cut of this line passed under the wrong reading.)
  assert.equal(fireballOpsFor(pack, 4, 4)[0].d, "M0 0L3 3", "clamped, never wrapped: it removes itself");
});

/* ------------------------------------------------------------------ *
 * The presentation, end to end                                        *
 * ------------------------------------------------------------------ */

function presented(type, id, { foe = TOUGH, foeX = 440 } = {}) {
  const battle = staged({ hero: { inventory1: id }, foe, foeX });
  applyAction(battle, { actorId: "hero", type, targetId: "foe" });
  const wire = toTeamWireState(battle);
  const layout = buildArenaLayout(wire);
  return { battle, ...presentResolvedEvents(wire, { layout, bindings: SS2_STATIC_MAP_BINDINGS }) };
}

test("a presented fireball plays Cast1, looses the build's own clip, and burns its victim — nothing unmapped", () => {
  for (const [type, id, , , speed] of ALL) {
    const { commands } = presented(type, id);
    assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), [], `${type}: all bound`);
    assert.equal(commands.filter((command) => command.kind === CommandKind.ATTACH_EFFECT).length, 0,
      `${type}: no bolt is attached`);
    const order = commands
      .filter((command) => command.kind === CommandKind.CLIP_GOTO || command.kind === CommandKind.FIRE_PROJECTILE)
      .map((command) => (command.kind === CommandKind.FIRE_PROJECTILE ? command.projectile : `${command.role}:${command.label}`));
    assert.deepEqual(order, ["actor:Cast1", "fireball", "target:burning"],
      `${type}: the build's order — Cast1 at +0x90f4, the attachMovie at +0x9246, the ingress on a later frame`);
    for (const clip of commands.filter((command) => command.kind === CommandKind.CLIP_GOTO)) {
      assert.equal(clip.labelProvenance, LabelProvenance.MAP_NAMED);
    }
    const [shot] = commands.filter((command) => command.kind === CommandKind.FIRE_PROJECTILE);
    assert.equal(shot.combatantId, "hero");
    assert.equal(shot.targetId, "foe");
    assert.equal(shot.artFrame, 1, `${type}: frame 1 for all three — the typo`);
    assert.equal(shot.xVelocity, speed);
    assert.equal(shot.gladiatorDir, "right");
    assert.equal(shot.from.x, -60);
    assert.equal(shot.to.x, 440);
  }
});

test("both clips resolve to families that can draw them", () => {
  const caster = timelineFor("Cast1", { role: "actor" });
  assert.equal(caster.recognised, true);
  assert.ok(clipLabelsFor(caster.family).includes("cast1"));
  const victim = timelineFor("burning", { role: "target" });
  assert.equal(victim.recognised, true);
  assert.ok(clipLabelsFor(victim.family).includes("burning"));
});

test("the scene carries the fireball's speed and facing, and an arrow's record is unchanged", () => {
  const { commands } = presented(DIRE, 32);
  const scene = applyCommands(emptyScene(), commands);
  assert.equal(scene.projectiles.length, 1);
  const [record] = scene.projectiles;
  assert.equal(record.projectile, "fireball");
  assert.equal(record.xVelocity, 90);
  assert.equal(record.gladiatorDir, "right");
  assert.equal(record.artFrame, 1);
});

test("the victim's reaction starts at IMPACT, not at the cast", () => {
  // s = 440 - -60 = 500; V = 50 -> k = 10 -> ten frames of flight.
  const { commands } = presented(FIREBALL, 30);
  const delays = reactionDelaysFor(commands);
  assert.equal(delays.get("foe"), 10 * PROJECTILE_FRAME_MS);
  assert.equal(delays.has("hero"), false, "the caster's Cast1 begins with the cast");
  const { started } = timelinesForStep(commands);
  assert.equal(started.get("foe").timeline.label, "burning");
  assert.equal(started.get("hero").timeline.label, "Cast1");

  // A dire fireball is faster: V = 90 -> floor(470 / 90) + 1 = 6 frames.
  assert.equal(reactionDelaysFor(presented(DIRE, 32).commands).get("foe"), 6 * PROJECTILE_FRAME_MS);
});

test("a KILLING fireball delays the victim's death too, because the death is at impact", () => {
  const { commands, battle } = presented(DIRE, 32, { foe: {}, foeX: 440 });
  assert.equal(combatantById(battle, "foe").alive, false);
  const { started } = timelinesForStep(commands);
  // Since 2026-09-23 the victim's death is QUEUED behind its reaction rather
  // than replacing it (test/render-drawn-matches-engine.test.js): the delay is
  // on the head of that chain, so it burns at impact and dies after.
  assert.equal(started.get("foe").timeline.label, "burning", "the reaction plays first");
  assert.equal(started.get("foe").then.timeline.family.startsWith("death:"), true, "and the death is queued behind it");
  assert.equal(reactionDelaysFor(commands).get("foe"), 6 * PROJECTILE_FRAME_MS);
});

test("the action is held while the fireball flies, then by the victim's reaction, then released", () => {
  // A LONG flight, so each hold is the only one left at its checkpoint: s =
  // 1440 - -60 = 1500, V = 50 -> k = 30 frames = 1,000 ms, past the caster's
  // 720 ms `Cast1`. (The first cut used a 10-frame flight, which `Cast1`
  // outlasted, so the victim's delayed reaction was never what held the gate
  // and a mutation that delayed the CASTER instead passed it.)
  const { commands, actionTokens } = presented(FIREBALL, 30, { foeX: 1440 });
  const { started } = timelinesForStep(commands);
  const delays = reactionDelaysFor(commands);
  const token = 7;
  const playing = new Map();
  for (const [id, entry] of started) playing.set(id, { ...entry, token, startedAt: delays.get(id) ?? 0 });
  const [shot] = applyCommands(emptyScene(), commands).projectiles;
  const flight = fireballFlight({ from: shot.from, to: shot.to, gladiatorDir: shot.gladiatorDir, xVelocity: shot.xVelocity });
  const flightMs = flightDurationMs(flight);
  const projectiles = [{ token, startedAt: 0, durationMs: flightMs }];
  assert.equal(actionTokens.length, 0, "no boundaries handed in, so the gate is driven by hand here");

  const burning = started.get("foe").timeline.durationMs;
  const cast1 = started.get("hero").timeline.durationMs;
  assert.equal(flight.flightFrames, 30);
  assert.ok(flightMs > cast1, "the flight outlasts the caster's clip, so the checkpoints below are separable");
  const at = (now) => animationCursor([token], playing, now, { projectiles }).finished;
  assert.deepEqual(at(cast1 + 1), [], "Cast1 is over and the fireball is still in the air");
  assert.deepEqual(at(flightMs + 1), [], "landed, and the victim is burning");
  assert.deepEqual(at(flightMs + burning - 1), [], "still burning");
  assert.deepEqual(at(flightMs + burning + 1), [token], "released when the reaction ends");
});

/* ------------------------------------------------------------------ *
 * The AI                                                              *
 * ------------------------------------------------------------------ */

function aiStaged({ hero = {}, foe = {}, heroX = 0, foeX = 120, rules = ss2TeamRules } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller: "ai" })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller: "ai" })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: heroX, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: foeX, y: 200 });
  return battle;
}

test("an AI caster casts a fireball rather than swinging, in reach and far beyond it", () => {
  assert.equal(suggestAction(aiStaged({ hero: { inventory1: 32 } }), "hero").type, DIRE);
  assert.equal(suggestAction(aiStaged({ hero: { inventory1: 31 }, foeX: 1960 }), "hero").type, HELL);
  // The control: nothing carried, nothing changes.
  assert.equal(suggestAction(aiStaged(), "hero").type, Ss2ActionType.QUICK_ATTACK);
  assert.equal(suggestAction(aiStaged({ foeX: 1960 }), "hero").type, Ss2ActionType.WALK_RIGHT);
});

test("a heavy hitter keeps a plain fireball and swings: priced at its mean, not privileged", () => {
  const battle = aiStaged({ hero: { inventory1: 30, strength: 60, attack: 60, weapon: 24 } });
  assert.ok(combatantById(battle, "hero").resources.max_damage.value > 120);
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.POWER_ATTACK);
});

test("the five damage spells are preferred in the build's ladder order, arms 14-18", () => {
  // `villain_cast_spells` (`DoAction@0x23e7cf`, base `0x23e7d5`): 32 at
  // `+0x0b18`, 35 at `+0x0b53`, 31 at `+0x0b8e`, 34 at `+0x0bc9`, 30 at
  // `+0x0c04`, each a single `check_inventory` test whose failing branch lands
  // on the next arm's first instruction.
  assert.deepEqual(SS2_DAMAGE_SPELL_LADDER, [
    DIRE, Ss2ActionType.CAST_FRIGHTNING_BOLT, HELL, Ss2ActionType.CAST_LIGHTNING_BOLT, FIREBALL
  ]);
  const pick = (ids) => suggestAction(aiStaged({
    hero: Object.fromEntries(ids.map((id, index) => [`inventory${index + 1}`, id])),
    foe: TOUGH
  }), "hero").type;
  assert.equal(pick([30, 34, 31, 35, 32]), DIRE);
  // 35 and 31 both mean 300: the tie is broken by the ladder, which puts 35 first.
  assert.equal(pick([31, 35]), Ss2ActionType.CAST_FRIGHTNING_BOLT);
  assert.equal(pick([34, 31]), HELL);
  assert.equal(pick([30, 34]), Ss2ActionType.CAST_LIGHTNING_BOLT);
  assert.equal(pick([30]), FIREBALL);
});

test("an UNPRICED caster follows the ladder, not the top of the range", () => {
  // A caster with no damage pair cannot be priced. Heaviest-by-`damageHigh`
  // would pick the hell fireball (450) over the frightning bolt (400); the
  // build's ladder casts 35 first (arm 15 before arm 16).
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(
          { staminaleft: 160, staminamax: 160, hitpoints: 170, hitpointsmax: 170, magicka: 7, inventory1: 31, inventory2: 35 },
          { id: "hero", name: "hero", controller: "ai", derive: false }
        )]
      },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: "left" }), { id: "foe", name: "foe", controller: "ai" })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: 0, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: 120, y: 200 });
  assert.equal(combatantById(battle, "hero").resources.min_damage, undefined);
  assert.equal(SS2_FIREBALL_SPELLS[HELL].damageHigh > SS2_BOLT_SPELLS[Ss2ActionType.CAST_FRIGHTNING_BOLT].damageHigh, true);
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_FRIGHTNING_BOLT);
});

test("a CHARGED caster out of discharge range casts its fireball instead of burning the charge", () => {
  // The psyche range gate is load-bearing because a damage spell reaches the
  // ranking from anywhere; see `chooseAiAction`.
  const charged = { inventory1: 30, psyche_up: 3, strength: 60, attack: 60, weapon: 24, herolevel: 10 };
  const battle = aiStaged({ hero: charged, foeX: 1960, rules: createSs2TeamRules({ aiCharges: true }) });
  assert.equal(suggestAction(battle, "hero").type, FIREBALL);
});

test("a fireball pre-empts the gale, because arms 14, 16 and 18 precede arm 24", () => {
  // The gale's own gate is open here (armour 60 of 136, foe at 120), and a
  // heavy hitter swings rather than cast — but in the build the fireball arm
  // fired first, so the gale must not be reachable.
  const battle = aiStaged({
    hero: { inventory1: 38, inventory2: 30, helmet: 4, breastplate: 6, strength: 60, attack: 60, weapon: 24 }
  });
  combatantById(battle, "hero").resources.armourclass.value = 60;
  assert.notEqual(suggestAction(battle, "hero").type, Ss2ActionType.CAST_GALE);
});
