/**
 * `src/team/ss2-rules.js` — the map-derived SS2 rule set.
 *
 * The golden corpus is checked against this rule set in
 * `test/ss2-golden-resolver-replay.test.js`. This file covers everything the
 * corpus cannot reach, and is explicit about which of those checks is evidence
 * and which is only self-consistency:
 *
 * - **Map-derived arithmetic with no runtime backing**: `battlevalues`, the
 *   `staminacost` table, `nextphase`'s attacker-only cost and regeneration,
 *   the forced-rest gate. Each assertion below names the offset it came from.
 *   These pin the code to the MAP. They are not evidence about the build.
 * - **Differential checks**: the armour-first split, piece destruction, the
 *   breastplate stamina join and enchantment status have ZERO golden coverage
 *   (22 of the 23 stage `armourclass 0` and eight zero piece ids; the 23rd,
 *   the armoured golden, backs armour ABSORPTION and the deflection threshold
 *   but never exhausts the armour, so the overflow split is still unbacked —
 *   see `test/ss2-golden-resolver-replay.test.js`). They are checked
 *   here by running the SAME arithmetic down two paths — standalone, and
 *   through the resolver — and requiring the defender to end up in the same
 *   state. **That tests the translation, not the arithmetic**, and agreement
 *   between two paths over one module is not a measurement of anything.
 * - **Contract checks**: the seam's own rules — no undeclared resource is ever
 *   written, no event carries `sequence`/`turn`, an AI return is always a legal
 *   option.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceAiTurns,
  applyAction,
  chooseAiAction,
  combatantById,
  combatStateHash,
  createOrderedRngChannel,
  createTeamBattle,
  toTeamWireState,
  currentCombatant,
  legalActions,
  reassignController,
  RngSequenceError,
  rngJournal,
  RuleSetVerification,
  TeamRuleSetError
} from "../src/team/index.js";
import { resolveSs2PhysicalAttackCandidate } from "../src/golden/ss2-attack-candidate.js";
import { SS2_BUILD_SHA256 } from "../src/golden/run-1v1-fixture.js";
import {
  ATTACK_DIRECTION_ROLL_LABEL,
  assertSs2WeaponPurchasable,
  createSs2TeamRules,
  SS2_CROWD,
  SS2_SWING,
  ss2SwingCost,
  ss2CrowdDamage,
  Ss2ActionType,
  SS2_ARMOUR_DVAL,
  SS2_ARMOUR_PIECES,
  SS2_ATTACKER_REQUIRED_RESOURCES,
  SS2_CONSTRUCTION_REQUIRED_RESOURCES,
  SS2_FACING_LEFT,
  SS2_MAP_SOURCE_REFS,
  SS2_REQUIRED_RESOURCES,
  SS2_RESOURCE_DEFAULTS,
  SS2_RESOURCE_NAMES,
  ss2StatusFlagOf,
  ss2StatusSourceOf,
  ss2StatusToken,
  SS2_STATUS_DAMAGE_METHOD,
  SS2_STATUS_FLAGS,
  ss2BattleValues,
  ss2Combatant,
  ss2TeamRules,
  VANILLA_PHASE_LABEL
} from "../src/team/ss2-rules.js";

/** A gladiator described the way a player would describe one: stats and kit. */
function gladiator(overrides = {}) {
  return {
    strength: 5,
    speed: 5,
    attack: 5,
    defence: 5,
    vitality: 3,
    stamina: 4,
    magicka: 0,
    charisma: 3,
    herolevel: 3,
    character_level: 3,
    weapon_min_damage: 3,
    weapon_max_damage: 6,
    ...overrides
  };
}

/**
 * THE TWO GLADIATORS ARE STAGED IN CONTACT, and it is deliberate.
 *
 * ► **BEFORE 2026-09-11 THERE WAS NOWHERE ELSE TO STAND.** The rule set now
 *   models position, and `startingPosition` puts the vanilla pair 500 apart
 *   (map, "Battle entry" step 5) against an unarmed reach of ~86 — so a battle
 *   built with no stated `x` offers `walk-left`, `walk-right` and `rest` and
 *   NO melee verb, which is the build's own `closerange_warrior` gate doing
 *   its job. Almost every test in this file is about the attack arithmetic,
 *   the stamina economy or the resource vocabulary, and would otherwise have
 *   to walk ten times to reach the thing it is testing.
 *
 *   `x: ∓30` puts them 60 apart, inside the reach of any strength. **A test
 *   that IS about geometry does not use this helper** — those live in
 *   `test/ss2-position.test.js`, which states its positions explicitly.
 */
function battleOf(heroFields, villainFields, options = {}) {
  const { rules = ss2TeamRules, seed = 1, rngTape = null, heroX = -30, villainX = 30 } = options;
  return createTeamBattle({
    seed,
    rngTape,
    rules,
    teams: [
      {
        id: "red",
        combatants: [
          ss2Combatant(gladiator(heroFields), { id: "hero", name: "Hero", controller: "local", x: heroX })
        ]
      },
      {
        id: "blue",
        combatants: [
          ss2Combatant(
            gladiator({ speed: 0, gladiator_dir: "left", ...villainFields }),
            { id: "villain", name: "Villain", controller: "local", x: villainX }
          )
        ]
      }
    ]
  });
}

const strip = (journal) => journal.map(({ label, source, min, max, value }) => ({ label, source, min, max, value }));

/* ------------------------------------------------------------------ */
/* The tier, and what it is allowed to claim                            */
/* ------------------------------------------------------------------ */

test("the rule set is map-derived, cites its evidence, and never claims runtime verification", () => {
  const descriptor = ss2TeamRules.provenance;
  assert.equal(ss2TeamRules.verification, RuleSetVerification.MAP_DERIVED);
  assert.equal(descriptor.runtimeVerified, false);
  assert.equal(descriptor.buildSha256, SS2_BUILD_SHA256);
  assert.deepEqual(descriptor.mapSourceRefs, SS2_MAP_SOURCE_REFS);
  assert.ok(descriptor.goldenFixtureIds.length >= 1);
  assert.match(descriptor.note, /NOT runtime-verified/);
  assert.match(descriptor.note, /invented/, "the note must say which part of this rule set is invented");
});

test("the fight mode is inside the rule-set id, because the wire projection carries only the id", () => {
  // `toTeamWireState` hashes id, contractVersion, verification and
  // runtimeVerified — and nothing else about the rule set. Two peers running
  // different defeat gates would otherwise hash identically and diverge later.
  assert.equal(createSs2TeamRules({ fightMode: "tournament" }).id, "ss2-map-derived-tournament");
  assert.equal(createSs2TeamRules({ fightMode: "misc", fixtureReplay: true }).id, "ss2-map-derived-misc");
  assert.notEqual(
    createSs2TeamRules({ fightMode: "duel", fixtureReplay: true }).id,
    createSs2TeamRules({ fightMode: "tournament" }).id
  );
  assert.throws(() => createSs2TeamRules({ fightMode: "brawl" }), TeamRuleSetError);
  assert.throws(() => createSs2TeamRules({ observer: "not a function" }), TeamRuleSetError);
});

test("duel and misc are refused at CONSTRUCTION unless the caller says it is a fixture replay", () => {
  // The in-action first-blood refusal is not free: it fires after the action's
  // draws have advanced the authoritative RNG state and cursor, which the hash
  // covers and `applyAction` cannot roll back. So the mode that can reach it is
  // gated where the gate costs nothing.
  for (const fightMode of ["duel", "misc"]) {
    assert.throws(
      () => createSs2TeamRules({ fightMode }),
      (error) => error instanceof TeamRuleSetError && /fixtureReplay/.test(error.message),
      fightMode
    );
    assert.ok(createSs2TeamRules({ fightMode, fixtureReplay: true }));
  }
  assert.ok(createSs2TeamRules({ fightMode: "tournament" }), "play needs no opt-in");
});

test("a battle that cannot change state is refused at construction", () => {
  // staminamax <= 0 makes the forced-rest gate the only legal action and rest
  // a total no-op: zero effects, zero rolls, no result, forever.
  const source = ss2Combatant(gladiator(), { id: "hero", name: "Hero" });
  source.resources.staminamax = 0;
  assert.throws(
    () => createTeamBattle({
      rules: ss2TeamRules,
      teams: [
        { id: "red", combatants: [source] },
        { id: "blue", combatants: [ss2Combatant(gladiator(), { id: "villain", name: "Villain" })] }
      ]
    }),
    (error) => error instanceof TeamRuleSetError && /fixpoint/.test(error.message)
  );
});

test("the vocabulary is three melee verbs, two walks, a rest and four status phases, hyphenated for the token grammar", () => {
  // FOUR status types rather than one, because the build's decision IS the
  // label: getphase("frozen") and getphase("poisoned") reach different arms.
  // The player never picks among them — legalActions offers exactly one.
  //
  // ► **TWO WALKS JOINED IT 2026-09-11, and they are DIRECTION-absolute.**
  //   Every controller frame wires `walkleft` and/or `walkright` BY NAME and
  //   the player picks a direction, not a relationship to an opponent (battle
  //   map, "Buttons wired per controller frame"). A `walk-toward` token would
  //   be this engine inventing a decision the build does not offer, and would
  //   lose the case the map is explicit about: `closerange_warrior` wires only
  //   the AWAY direction, in both facings.
  //
  //   TWO of the build's eight movement phases, not eight: `run*` is reachable
  //   only through the taunted chain, which nothing here sets, and `charge*`
  //   and `jump*` have no displacement this repository can separate from the
  //   walk's. One unmeasured distance is enough — see `SS2_ARENA.walkDistance`.
  assert.deepEqual([...ss2TeamRules.actionTypes].sort(), [
    "burning-phase",
    "frozen-phase",
    "life-stolen-phase",
    "normal-attack",
    "poisoned-phase",
    "power-attack",
    "quick-attack",
    "rest",
    "walk-left",
    "walk-right"
  ]);
  for (const type of ss2TeamRules.actionTypes) {
    assert.match(type, /^[a-z0-9][a-z0-9-]{0,63}$/, "actionTypes tokens reject vanilla's underscores");
    assert.match(VANILLA_PHASE_LABEL[type], /^[a-z_]+$/, "every token maps back to a getphase label");
  }
});

/* ------------------------------------------------------------------ */
/* `battlevalues` — the build's own derivations                         */
/* ------------------------------------------------------------------ */

test("ss2BattleValues reproduces the unconditional derivations, offsets named in the source", () => {
  const derived = ss2BattleValues({
    strength: 7, speed: 6, vitality: 4, stamina: 3, herolevel: 5,
    weapon_min_damage: 4, weapon_max_damage: 9,
    secondary_weapon_min_damage: 2, secondary_weapon_max_damage: 5,
    breastplate: 2, helmet: 3, shinguard: 1, greaves: 1,
    shoulderguard: 1, gauntlet: 1, boot: 1, shield: 2
  });
  assert.equal(derived.physical_size, 80 + Math.round(7 / 1.5));          // +0x30f1
  assert.equal(derived.min_damage, Math.round(7 * 2) + 4);                 // +0x3356
  assert.equal(derived.max_damage, Math.round(7 * 2) + 9);                 // +0x3386
  assert.equal(derived.secondary_min_damage, Math.round(7 * 1) + 2);       // +0x33b6
  assert.equal(derived.secondary_max_damage, Math.round(7 * 1) + 5);       // +0x33e6
  assert.equal(derived.hitpointsmax, 5 * 10 + 4 * 20);                     // +0x378e
  assert.equal(derived.staminamax, 100 + 3 * 10);                          // +0x37b6
  assert.equal(derived.movement_speed, Math.max(4, Math.min(60, Math.round(6 * 1.5)))); // +0x37d2

  for (const piece of SS2_ARMOUR_PIECES) {
    if (piece === "helmet" || piece === "shield") continue;
    assert.equal(
      derived[`${piece}_defence`],
      Math.round(derived[piece] * SS2_ARMOUR_DVAL[piece]),
      `${piece}_defence`
    );
  }
  // The out-of-battle block: armourclass_max is summed only when
  // `_global.battle_started` is false (`+0x3ac3`), and armourclass follows it.
  const sum = SS2_ARMOUR_PIECES.reduce((total, piece) => total + derived[`${piece}_defence`], 0);
  assert.equal(derived.armourclass_max, sum);
  assert.equal(derived.armourclass, sum);
  assert.equal(derived.hitpoints, derived.hitpointsmax);
});

test("helmet_defence is branched at id 25, and shield_defence is flat zero in bow mode", () => {
  // `+0x34eb` above 25, `+0x34bf` at or below; `+0x3623` for the bow branch.
  const low = ss2BattleValues({ helmet: 25, herolevel: 8 });
  const high = ss2BattleValues({ helmet: 26, herolevel: 8 });
  assert.equal(low.helmet_defence, Math.round(25 * SS2_ARMOUR_DVAL.helmet));
  assert.equal(high.helmet_defence, Math.round(8 * 0.5 * SS2_ARMOUR_DVAL.helmet));

  const onFoot = ss2BattleValues({ shield: 3 });
  const withBow = ss2BattleValues({ shield: 3, using_bow: true });
  assert.equal(onFoot.shield_defence, Math.round(3 * SS2_ARMOUR_DVAL.shield));
  assert.equal(withBow.shield_defence, 0);
});

test("bow mode OVERWRITES the primary damage pair with the secondary one", () => {
  // `+0x3416`. The secondary pair carries `round(strength * 1)`, not `* 2`, so
  // a bow swap silently rescales every damage row in the direction dispatcher.
  const withBow = ss2BattleValues({
    strength: 10, using_bow: true,
    weapon_min_damage: 4, weapon_max_damage: 9,
    secondary_weapon_min_damage: 1, secondary_weapon_max_damage: 2
  });
  assert.equal(withBow.min_damage, Math.round(10 * 1) + 1);
  assert.equal(withBow.max_damage, Math.round(10 * 1) + 2);
});

test("the in-battle call skips the block the build skips", () => {
  // `+0x3a90` reads `_global.battle_started` and jumps 360 bytes past the
  // hitpoint refill, the armourclass_max sum and the stamina refill.
  const inBattle = ss2BattleValues({ helmet: 2, hitpoints: 5, staminaleft: 1 }, { battleStarted: true });
  assert.equal(inBattle.hitpoints, 5, "a staged hitpoints survives an in-battle call");
  assert.equal(inBattle.armourclass_max, undefined, "armourclass_max is summed only out of battle");
  assert.ok(Number.isFinite(inBattle.helmet_defence), "the per-piece defences are still unconditional");
});

/* ------------------------------------------------------------------ */
/* Construction refuses an under-specified gladiator                    */
/* ------------------------------------------------------------------ */

/**
 * Two prebuilt sources, staged in contact for the same reason `battleOf` is:
 * these tests are about the resource vocabulary and the damage-pair roles, and
 * a battle with no stated `x` starts 500 apart and offers no melee verb at all.
 * Stated HERE rather than at each call site so the intent reads once.
 */
function battleWith(hero, villain) {
  return createTeamBattle({
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [{ ...hero, x: -30 }] },
      { id: "blue", combatants: [{ ...villain, x: 30 }] }
    ]
  });
}

function without(resource, options) {
  const source = ss2Combatant(gladiator(), options);
  delete source.resources[resource];
  return source;
}

test("a combatant missing a CONSTRUCTION resource is refused when the battle is BUILT, not on the first blow", () => {
  assert.deepEqual(
    [...SS2_CONSTRUCTION_REQUIRED_RESOURCES].sort(),
    ["staminaleft", "staminamax"],
    "the construction requirement changed; this test names what it checks"
  );
  for (const missing of SS2_CONSTRUCTION_REQUIRED_RESOURCES) {
    assert.throws(
      () => battleWith(
        without(missing, { id: "hero", name: "Hero" }),
        ss2Combatant(gladiator(), { id: "villain", name: "Villain" })
      ),
      (error) => error instanceof TeamRuleSetError && error.message.includes(missing),
      `omitting ${missing} must be refused by name, at construction`
    );
  }
});

/* ------------------------------------------------------------------ */
/* The damage pair is required of the ATTACKER, and only of it          */
/* ------------------------------------------------------------------ */

test("a pure DEFENDER may omit the damage pair: the battle builds and the blow lands", () => {
  // The hole this closes. `golden-armoured-deflection-threshold-cleared`'s
  // villain omits min_damage/max_damage because the map says the candidate must
  // not pin them — the villain never swings — and the old construction-time,
  // role-blind check refused the whole battle for it.
  for (const missing of SS2_ATTACKER_REQUIRED_RESOURCES) {
    const battle = battleWith(
      ss2Combatant(gladiator({ strength: 6 }), { id: "hero", name: "Hero" }),
      without(missing, { id: "villain", name: "Villain" })
    );
    applyAction(battle, { actorId: "hero", type: Ss2ActionType.NORMAL_ATTACK, targetId: "villain" });
    assert.ok(
      battle.lastResolution.effects.length > 0,
      `a villain missing ${missing} must still be a legal target of a resolved swing`
    );
  }
});

test("an ATTACKER missing the damage pair is refused BY NAME when its swing resolves", () => {
  // And it must be the swing that fails, not the build: the omission changes a
  // number only when this gladiator attacks, and refusing earlier is what
  // rejected a fixture the map calls complete.
  for (const missing of SS2_ATTACKER_REQUIRED_RESOURCES) {
    const attacker = without(missing, { id: "hero", name: "Hero" });
    const battle = battleWith(
      attacker,
      ss2Combatant(gladiator(), { id: "villain", name: "Villain" })
    );
    assert.throws(
      () => applyAction(battle, { actorId: "hero", type: Ss2ActionType.NORMAL_ATTACK, targetId: "villain" }),
      (error) => error instanceof TeamRuleSetError && error.message.includes(missing),
      `an attacker omitting ${missing} must be refused by name when it swings`
    );
  }
});

test("a REFUSED attack costs nothing: no RNG draw, no hash movement, however often it is retried", () => {
  // The defect this test exists for, found by an independent Codex review of
  // 89bc6c0 and confirmed by measurement before it was believed. The
  // construction check no longer refuses an incomplete gladiator, so the
  // refusal moved into `resolveAction` — and it originally sat AFTER the
  // direction draw. `randomBetween` advances the channel's generator state and
  // cursor, `applyAction` has no rollback around resolution, and the cursor is
  // inside `toTeamWireState`. So every rejected swing moved the battle hash and
  // each retry burned another draw: measured 3 -> 4 -> 5 -> 6 over three
  // attempts, against a peer that never attempted it and stayed at 3.
  //
  // A guard that can fire on an ordinary play path must be free. The mutation
  // that kills this test is moving `vanillaRecordOf(actor, "attacker")` back
  // below the draw.
  // Vitality 20 so it SURVIVES the hero's blow and gets a turn of its own —
  // the only way to reach the refusal is to be a legal actor first.
  const source = ss2Combatant(gladiator({ vitality: 20 }), { id: "villain", name: "Villain" });
  delete source.resources.min_damage;
  const battle = createTeamBattle({
    seed: 7,
    rules: ss2TeamRules,
    teams: [
      // Staged in contact: this test is about the refusal being free, not about
      // geometry, and a battle with no stated `x` starts out of melee range.
      { id: "red", combatants: [ss2Combatant(gladiator({ speed: 9 }), { id: "hero", name: "Hero", x: -30 })] },
      { id: "blue", combatants: [{ ...source, x: 30 }] }
    ]
  });
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.QUICK_ATTACK, targetId: "villain" });
  assert.equal(currentCombatant(battle).id, "villain", "the incomplete gladiator must get a turn");

  const drawsBefore = rngJournal(battle).length;
  const hashBefore = combatStateHash(battle);
  assert.ok(drawsBefore > 0, "the hero's swing must have drawn, or this test proves nothing");

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    assert.throws(
      () => applyAction(battle, { actorId: "villain", type: Ss2ActionType.NORMAL_ATTACK, targetId: "hero" }),
      (error) => error instanceof TeamRuleSetError && error.message.includes("min_damage")
    );
    assert.equal(
      rngJournal(battle).length,
      drawsBefore,
      `attempt ${attempt}: a refused attack consumed an RNG draw it cannot roll back`
    );
    assert.equal(
      combatStateHash(battle),
      hashBefore,
      `attempt ${attempt}: a refused attack moved the battle hash, so peers desync on a no-op`
    );
  }
});

test("the AI refuses to choose for an attacker that cannot state its damage", () => {
  // chooseAiAction reads attacker.min_damage/max_damage directly to rank the
  // three verbs, so the same requirement binds there. Without this the AI would
  // rank on a defaulted 1/1 and pick a verb the gladiator cannot back.
  const battle = battleWith(
    without("max_damage", { id: "hero", name: "Hero", controller: "ai" }),
    ss2Combatant(gladiator(), { id: "villain", name: "Villain" })
  );
  assert.throws(
    () => ss2TeamRules.chooseAiAction(
      { actor: currentCombatant(battle), foes: [combatantById(battle, "villain")] },
      "hero",
      legalActions(battle)
    ),
    (error) => error instanceof TeamRuleSetError && error.message.includes("max_damage")
  );
});

// `vanillaRecordOf`'s mandatory `role` is deliberately NOT pinned by a test.
// It is module-private with two call sites, both in this file's subject, and
// the only way to reach its throw is to add a third that passes no role — so a
// test would have to import a private or fake the failure, and would assert
// nothing about behaviour. The guard is a compile-time-shaped check on future
// editors, not a runtime rule; saying so is better than an assertion whose name
// promises more than it does.

test("deriving over a record that already states a measured number is refused", () => {
  // `battlevalues` overwrites min_damage/max_damage/hitpointsmax/staminamax
  // unconditionally, so `ss2Combatant(golden.scenario.hero)` would replace the
  // corpus's measured 21/23/30/110 with a computed 20/20/10/100. `derive` was
  // a convention until a verifier pointed out that nothing enforced it.
  const measured = { strength: 10, attack: 1, defence: 1, min_damage: 21, max_damage: 23, hitpointsmax: 30, staminamax: 110, staminaleft: 105, hitpoints: 30 };
  assert.throws(
    () => ss2Combatant(measured, { id: "hero" }),
    (error) => error instanceof TeamRuleSetError && /min_damage/.test(error.message)
  );
  const kept = ss2Combatant(measured, { id: "hero", derive: false });
  assert.equal(kept.resources.min_damage, 21);
  assert.equal(kept.resources.max_damage, 23);
  assert.equal(kept.maxHealth, 30);
});

test("a declared maxHealth is returned verbatim; the battlevalues formula is only a fallback", () => {
  // `battle-host.js` throws outright when a rule set derives a maximum health
  // that disagrees with a vanilla gladiator's staged `hitpointsmax`, because
  // that number is licensed evidence and the formula is rule-set work.
  const source = ss2Combatant(gladiator({ herolevel: 3, vitality: 3 }), { id: "hero" });
  assert.equal(source.maxHealth, 3 * 10 + 3 * 20);
  assert.equal(ss2TeamRules.maximumHealth({ ...source, maxHealth: 999 }), 999);

  const derivedOnly = { ...source, maxHealth: undefined };
  assert.equal(ss2TeamRules.maximumHealth(derivedOnly), 3 * 10 + 3 * 20);

  const noHerolevel = { ...source, maxHealth: undefined, resources: { ...source.resources } };
  delete noHerolevel.resources.herolevel;
  assert.throws(() => ss2TeamRules.maximumHealth(noHerolevel), TeamRuleSetError);
});

/* ------------------------------------------------------------------ */
/* Legality: one gate, and it is the build's                            */
/* ------------------------------------------------------------------ */

test("at zero stamina the only action is rest, exactly as overlay frame 1 forces it", () => {
  // `+0x0d2e`-`+0x0d48`: `staminaleft <= 0` forces `getphase("rest")` before
  // any player choice.
  const battle = battleOf({ stamina: 0 }, {});
  combatantById(battle, "hero").resources.staminaleft.value = 0;
  assert.deepEqual(legalActions(battle), [{ type: Ss2ActionType.REST, targetId: "hero" }]);
});

test("there is NO affordability gate: the build never refuses an attack for lack of stamina", () => {
  // `nextphase` subtracts the cost and `check_stats` floors at zero (`+0x114b`).
  // An "you cannot afford this" gate would be a playability affordance wearing
  // measured clothes, so it is deliberately absent.
  const battle = battleOf({ strength: 20 }, {});
  combatantById(battle, "hero").resources.staminaleft.value = 1;
  const options = legalActions(battle).map((option) => option.type);
  // ► **`walk-left` JOINED THIS LIST 2026-09-11, and it is the RETREAT.** The
  //   two are staged in contact, so the build's selector puts this gladiator on
  //   `closerange_warrior` — which wires `jumpleft`/`walkleft` facing right and
  //   `jumpright`/`walkright` facing left, both of them AWAY. Once you are in
  //   range the build lets you back out and never further in, so a
  //   toward-walk is correctly absent here while the three melee verbs are not.
  //   The point of the test is unchanged: at 1 stamina against a swing costing
  //   far more, nothing is withheld.
  assert.deepEqual(options, ["quick-attack", "normal-attack", "power-attack", "walk-left", "rest"]);
});

test("every living foe gets all three melee verbs, and rest targets the actor", () => {
  const battle = battleOf({}, {});
  const options = legalActions(battle);
  assert.equal(options.filter((option) => option.targetId === "villain").length, 3);
  assert.deepEqual(options.at(-1), { type: Ss2ActionType.REST, targetId: "hero" });
});

/* ------------------------------------------------------------------ */
/* The direction is DRAWN, not chosen                                   */
/* ------------------------------------------------------------------ */

test("each verb draws its direction from the build's own band, before anything else", () => {
  // `randomBetween(1, 4)` `+0x635c`, `(5, 8)` `+0x61f1`, `(9, 12)` `+0x608a`,
  // each assigned before the branch's own `checkattackroll()` call.
  const bands = {
    [Ss2ActionType.QUICK_ATTACK]: [1, 4],
    [Ss2ActionType.NORMAL_ATTACK]: [5, 8],
    [Ss2ActionType.POWER_ATTACK]: [9, 12]
  };
  for (const [type, [low, high]] of Object.entries(bands)) {
    const battle = battleOf({}, {}, { seed: 11 });
    applyAction(battle, { actorId: "hero", type, targetId: "villain" });
    const first = rngJournal(battle)[0];
    assert.equal(first.label, ATTACK_DIRECTION_ROLL_LABEL, type);
    assert.equal(first.source, "randomBetween", type);
    assert.deepEqual([first.min, first.max], [low, high], type);
    const event = battle.lastResolution.events[0];
    assert.ok(event.attackDirection >= low && event.attackDirection <= high, type);
  }
});

test("the player cannot pick a direction: it is not an action type and not a spellKind", () => {
  const battle = battleOf({}, {});
  assert.throws(
    () => applyAction(battle, { actorId: "hero", type: "normal-7", targetId: "villain" }),
    /Illegal action/
  );
  assert.throws(
    () => applyAction(battle, { actorId: "hero", type: Ss2ActionType.NORMAL_ATTACK, targetId: "villain", spellKind: 7 }),
    /Illegal action/
  );
});

/* ------------------------------------------------------------------ */
/* The stamina economy                                                  */
/* ------------------------------------------------------------------ */

test("rest gains the negative staminacost, the branch's own bonus, and the per-turn baseline", () => {
  // `staminacost = 0 - round(stamina * 15)` `+0x5163` (a GAIN, because
  // `nextphase` spends by subtraction), the rest branch's own
  // `staminaleft += stamina` `+0x521d`, and `nextphase`'s
  // `+= 1 + round(stamina / 3)` `+0x32c9`.
  const stamina = 4;
  const battle = battleOf({ stamina }, {});
  const hero = combatantById(battle, "hero");
  hero.resources.staminaleft.value = 10;
  hero.health = 5;

  applyAction(battle, { actorId: "hero", type: Ss2ActionType.REST, targetId: "hero" });
  const gain = Math.round(stamina * 15) + stamina + 1 + Math.round(stamina / 3);
  assert.equal(gain, 60 + 4 + 1 + 1, "pinned to a literal as well as to the formula");
  assert.equal(hero.resources.staminaleft.value, Math.min(100 + stamina * 10, 10 + gain));

  // BOTH hitpoint terms: the rest branch's own `3 + ceil(stamina)` at
  // `+0x51d5`, inside the same `attacker.struck == null` guard as the
  // `+0x521d` stamina write, PLUS `nextphase`'s `1 + ceil(stamina / 2)` at
  // `+0x3305`.
  //
  // This assertion previously read `5 + 1 + ceil(stamina/2)`, on a comment
  // claiming `+0x684c` (taunt) was the only site for `3 + ceil(stamina)`. The
  // battle map's prose said otherwise and was right; the map's own WRITERS
  // TABLE lists only `+0x684c`, which is how a reader who trusts tables over
  // prose loses it. The bytes were then read directly.
  const healed = 3 + Math.ceil(stamina) + 1 + Math.ceil(stamina / 2);
  assert.equal(healed, 3 + 4 + 1 + 2, "pinned to a literal as well as to the formula");
  assert.equal(hero.health, 5 + healed);
  assert.equal(battle.lastResolution.events[0].healed, healed);
  assert.equal(rngJournal(battle).length, 0, "the rest branch draws nothing");
});

test("rest clamps at staminamax and at maxHealth rather than overshooting", () => {
  const battle = battleOf({ stamina: 9 }, {});
  const hero = combatantById(battle, "hero");
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.REST, targetId: "hero" });
  assert.equal(hero.resources.staminaleft.value, hero.resources.staminamax.value);
  assert.equal(hero.health, hero.maxHealth);
  assert.equal(battle.lastResolution.events[0].healed, 0, "a fighter at full health reports no heal");
});

test("an attack spends the SWING COST and regenerates, attacker-only", () => {
  // ► **THIS TEST PINNED `round(strength * factor)` AND NOW PINS THE SWING
  //   COST — the one deliberate departure from the build's combat arithmetic
  //   in this engine (owner's decision, 2026-09-10).** The band FACTORS below
  //   are still the build's and still pinned: `quick_attack` `+0x6317` = 1,
  //   `normal_attack` `+0x61a3` = 2, `power_attack` `+0x603c` = 3, so the
  //   three bands keep their relative prices. What changed is what the factor
  //   multiplies — the weapon's mass rather than the wielder's strength, with
  //   strength in the denominator. See `SS2_SWING` for the measured defect
  //   that forced it (strength 7 beat strength 30 losing nothing) and for the
  //   one weak inference in it.
  //
  //   Everything else this test asserted is UNCHANGED and still asserted: the
  //   spend and regen are combined before one clamp, and `nextphase`
  //   `+0x32a1`-`+0x3304` has no `game_defender` counterpart, so a defender
  //   neither pays nor recovers.
  const factors = {
    [Ss2ActionType.QUICK_ATTACK]: 1,
    [Ss2ActionType.NORMAL_ATTACK]: 2,
    [Ss2ActionType.POWER_ATTACK]: 3
  };
  const strength = 6;
  const stamina = 4;
  for (const [type, factor] of Object.entries(factors)) {
    const battle = battleOf({ strength, stamina }, { vitality: 40 }, { seed: 5 });
    const hero = combatantById(battle, "hero");
    const villain = combatantById(battle, "villain");
    const staminaBefore = hero.resources.staminaleft.value;
    const villainStaminaBefore = villain.resources.staminaleft.value;
    applyAction(battle, { actorId: "hero", type, targetId: "villain" });

    const cost = ss2SwingCost({
      bandFactor: factor,
      attackSpeed: hero.resources.attack_speed?.value,
      strength
    });
    const expected = Math.max(0, Math.min(
      hero.resources.staminamax.value,
      staminaBefore - cost + 1 + Math.round(stamina / 3)
    ));
    assert.equal(hero.resources.staminaleft.value, expected, type);
    assert.equal(battle.lastResolution.events[0].staminaSpent, cost, type);
    // The inversion itself, asserted rather than assumed: a STRONGER wielder
    // pays LESS for the same swing. Under the build's own formula this was
    // strictly the other way round, which is what made strength a trap.
    assert.ok(
      ss2SwingCost({ bandFactor: factor, attackSpeed: 1, strength: 60 }) <
      ss2SwingCost({ bandFactor: factor, attackSpeed: 1, strength: 1 }),
      `${type}: strength must BUY cheaper swings, not pay for them`
    );
    // `nextphase` `+0x32a1`-`+0x3304` has no `game_defender` counterpart.
    assert.equal(villain.resources.staminaleft.value, villainStaminaBefore, `${type}: defender untouched`);
  }
});

test("the regeneration ROUNDS stamina/3, and a stat where round differs from floor proves it", () => {
  // `+0x32c9` is `Math.round`. With stamina 4 (this file's default gladiator)
  // round and floor agree, so `round -> floor` passed the whole suite. stamina
  // 2 separates them: round(2/3) is 1, floor(2/3) is 0.
  const battle = battleOf({ strength: 6, stamina: 2 }, { vitality: 40 }, { seed: 5 });
  const hero = combatantById(battle, "hero");
  hero.resources.staminaleft.value = 50;
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.QUICK_ATTACK, targetId: "villain" });
  // The REGEN half is untouched by the swing-cost change and is what this test
  // is for: `+0x32c9` is `Math.round`, and stamina 2 separates round from
  // floor. Only the spend moved; it is read from the model rather than
  // restated so this test cannot drift from `SS2_SWING`.
  const spend = ss2SwingCost({ bandFactor: 1, attackSpeed: hero.resources.attack_speed?.value, strength: 6 });
  assert.equal(hero.resources.staminaleft.value, 50 - spend + 1 + 1, "50 - swing + 1 + round(2/3)");
});

test("the spend and the regeneration are combined before ONE clamp, as the build has them", () => {
  // The two statements are consecutive and unbranched with no clamp between,
  // so flooring the spend at zero and then adding the baseline would produce a
  // different number: 1 - 20 + 1 is 0, not 1.
  const battle = battleOf({ strength: 20, stamina: 0 }, {}, { seed: 3 });
  const hero = combatantById(battle, "hero");
  hero.resources.staminaleft.value = 1;
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.NORMAL_ATTACK, targetId: "villain" });
  assert.equal(hero.resources.staminaleft.value, 0);
});

/* ------------------------------------------------------------------ */
/* Differential: the effect translation, on cases no golden covers      */
/* ------------------------------------------------------------------ */

/**
 * Runs one attack down both paths on the same ordered samples and returns the
 * standalone arithmetic's mutated scenario alongside the battle.
 *
 * NOT EVIDENCE ABOUT THE BUILD. Both paths call the same module, so agreement
 * says only that the rule set's translation into effects, and the resolver's
 * application of them, preserve what the arithmetic decided. The build has
 * never been observed doing any of this with armour on.
 */
function bothPaths({ heroFields, villainFields, type, seed }) {
  const heroVanilla = ss2BattleValues(gladiator(heroFields));
  const villainVanilla = ss2BattleValues(gladiator({ speed: 0, gladiator_dir: "left", ...villainFields }));
  // Unsaturated, so a dropped write is visible. Measured: with the defender at
  // full stamina the breastplate join clamps to staminamax and writes nothing,
  // which made "drop the defender's staminaleft write" pass the whole suite.
  villainVanilla.staminaleft = villainVanilla.staminamax - 20;

  // Take the tape from a seeded standalone run, so no sample is hand-authored.
  const probeChannel = createOrderedRngChannel({ seed });
  const probe = probeChannel.withContext({ path: "standalone-probe" });
  const bands = {
    [Ss2ActionType.QUICK_ATTACK]: [1, 4],
    [Ss2ActionType.NORMAL_ATTACK]: [5, 8],
    [Ss2ActionType.POWER_ATTACK]: [9, 12]
  };
  const [low, high] = bands[type];
  const attackDirection = probe.randomBetween(ATTACK_DIRECTION_ROLL_LABEL, low, high);
  const scenario = {
    attackerSide: "hero",
    attackDirection,
    fightMode: "tournament",
    hero: { ...heroVanilla },
    villain: { ...villainVanilla },
    result: null
  };
  const outcome = resolveSs2PhysicalAttackCandidate(scenario, probe);
  const tape = strip(probeChannel.journal);

  const battle = battleOf(heroFields, villainFields, { rngTape: tape });
  combatantById(battle, "villain").resources.staminaleft.value = villainVanilla.staminaleft;
  applyAction(battle, { actorId: "hero", type, targetId: "villain" });
  return { battle, scenario, outcome, tape, attackDirection };
}

test("armour absorbs first and the overflow reaches health — the split no golden covers", () => {
  // Every promoted golden stages armourclass 0, so the armour-first path has
  // zero runtime backing. This checks the TRANSLATION of it, not the maths.
  //
  // Two armour weights, because one cannot show both halves: a hero of
  // strength 5 with a 3-6 weapon swings for 13-16, so a breastplate (defence
  // 32) always absorbs the whole blow and a boot (defence 2) never does.
  const cases = [
    { label: "absorbed", armour: { breastplate: 2 }, wants: (m) => m.armourDamage > 0 && m.hitpointDamage === 0 },
    { label: "overflowed", armour: { boot: 1 }, wants: (m) => m.armourDamage > 0 && m.hitpointDamage > 0 }
  ];
  for (const { label, armour, wants } of cases) {
    let satisfied = false;
    for (let seed = 1; seed <= 60; seed += 1) {
      const { battle, scenario, outcome } = bothPaths({
        heroFields: { strength: 5, attack: 7, defence: 3 },
        villainFields: { ...armour, vitality: 6, attack: 2, defence: 6 },
        type: Ss2ActionType.NORMAL_ATTACK,
        seed
      });
      const villain = combatantById(battle, "villain");
      assert.equal(villain.resources.armourclass.value, scenario.villain.armourclass, `${label} seed ${seed}`);
      assert.equal(villain.resources.armourclass_max.value, scenario.villain.armourclass_max, `${label} seed ${seed}`);
      assert.equal(villain.health, scenario.villain.hitpoints, `${label} seed ${seed}: hitpoints`);
      assert.equal(
        villain.resources.staminaleft.value,
        scenario.villain.staminaleft,
        `${label} seed ${seed}: the breastplate stamina join`
      );
      for (const piece of SS2_ARMOUR_PIECES) {
        assert.equal(villain.resources[piece].value, scenario.villain[piece], `${label} seed ${seed}: ${piece}`);
      }
      // The build's own first-touch order over distinct fields: armourclass,
      // armourclass_max, the destroyed piece, hitpoints, staminaleft. Nothing
      // pinned it, so reversing the two armour writes passed the whole suite.
      const emitted = battle.lastResolution.effects.map(
        (effect) => effect.resource ?? effect.status ?? effect.kind
      );
      const rank = { armourclass: 0, armourclass_max: 1, damage: 3, staminaleft: 4 };
      const ranked = emitted.map((name) => rank[name] ?? (SS2_ARMOUR_PIECES.includes(name) ? 2 : 5));
      assert.deepEqual(ranked, [...ranked].sort((a, b) => a - b), `${label}: ${emitted.join(", ")}`);

      if (outcome.calculation.hit && wants(outcome.mutation)) satisfied = true;
    }
    assert.ok(satisfied, `the sweep must contain a hit that ${label} armour`);
  }
});

test("a destroyed armour piece is written to zero, and its defence leaves both armour pools", () => {
  let sawRemoval = false;
  for (let seed = 1; seed <= 120 && !sawRemoval; seed += 1) {
    const { battle, scenario, outcome } = bothPaths({
      heroFields: { strength: 6, attack: 7, defence: 3 },
      villainFields: { helmet: 3, shoulderguard: 3, breastplate: 3, gauntlet: 3, greaves: 3, vitality: 8, attack: 2, defence: 6 },
      type: Ss2ActionType.NORMAL_ATTACK,
      seed
    });
    const destroyed = outcome.mutation.armourRemovals.filter((removal) => removal.removed);
    if (destroyed.length === 0) continue;
    sawRemoval = true;
    const villain = combatantById(battle, "villain");
    for (const removal of destroyed) {
      assert.equal(villain.resources[removal.selected].value, 0, `seed ${seed}: ${removal.selected} destroyed`);
    }
    assert.equal(villain.resources.armourclass_max.value, scenario.villain.armourclass_max, `seed ${seed}`);
    assert.deepEqual(
      battle.lastResolution.events[0].armourDestroyed,
      destroyed.map((removal) => removal.selected)
    );
  }
  assert.ok(sawRemoval, "the sweep must destroy at least one piece");
});

test("an enchantment status reaches the resolver as a status effect", () => {
  let sawStatus = false;
  for (let seed = 1; seed <= 120 && !sawStatus; seed += 1) {
    const { battle, outcome } = bothPaths({
      heroFields: { strength: 6, attack: 7, defence: 3, weapon_enchantment_type: 2, weapon_enchantment_potency: 3 },
      villainFields: { vitality: 8, attack: 2, defence: 6 },
      type: Ss2ActionType.NORMAL_ATTACK,
      seed
    });
    if (!outcome.mutation.statusApplied) continue;
    sawStatus = true;
    const villain = combatantById(battle, "villain");
    assert.ok(SS2_STATUS_FLAGS.includes(outcome.mutation.statusApplied));
    // Through the token grammar since 2026-09-07: a condition carries its
    // inflictor (`"burning:from=hero"`), so an exact-string `includes` would
    // fail on a condition that IS present. The source is asserted too — that is
    // the half that was silently missing and made every in-play condition tick
    // for nothing.
    assert.ok(
      villain.status.some((token) => ss2StatusFlagOf(token) === outcome.mutation.statusApplied),
      `seed ${seed}: status applied`
    );
    assert.ok(
      villain.status.some((token) => ss2StatusSourceOf(token) === "hero"),
      `seed ${seed}: the condition must name the gladiator that inflicted it`
    );
    assert.ok(
      battle.lastResolution.effects.some(
        (effect) => effect.kind === "status" && ss2StatusFlagOf(effect.status) === outcome.mutation.statusApplied
      )
    );
  }
  assert.ok(sawStatus, "the sweep must apply at least one enchantment status");
});

/* ------------------------------------------------------------------ */
/* Facing is on the tape, not just on the presentation                  */
/* ------------------------------------------------------------------ */

test("facing changes the armour-debris draw's shape, so it is tape-load-bearing", () => {
  // `gladiator_dir == "right"` draws `randomNumber(x, 20)`, `"left"` draws
  // `randomNumber(x, 30)`. Replaying a right-facing tape against a left-facing
  // defender must therefore be REFUSED at the cursor, not silently absorbed.
  let checked = false;
  for (let seed = 1; seed <= 200 && !checked; seed += 1) {
    const right = bothPaths({
      heroFields: { strength: 6, attack: 7, defence: 3 },
      villainFields: { gladiator_dir: "right", helmet: 3, shoulderguard: 3, breastplate: 3, vitality: 8, attack: 2, defence: 6 },
      type: Ss2ActionType.NORMAL_ATTACK,
      seed
    });
    if (!right.outcome.mutation.armourRemovals.some((removal) => removal.removed)) continue;
    checked = true;
    assert.ok(right.tape.some((sample) => sample.label.endsWith("-x") && sample.max === 19));

    const mirrored = battleOf(
      { strength: 6, attack: 7, defence: 3 },
      { gladiator_dir: "left", helmet: 3, shoulderguard: 3, breastplate: 3, vitality: 8, attack: 2, defence: 6 },
      { rngTape: right.tape }
    );
    assert.equal(combatantById(mirrored, "villain").status.includes(SS2_FACING_LEFT), true);
    assert.throws(
      () => applyAction(mirrored, { actorId: "hero", type: Ss2ActionType.NORMAL_ATTACK, targetId: "villain" }),
      RngSequenceError,
      "a facing swap must desync the tape rather than move a number quietly"
    );
  }
  assert.ok(checked, "the sweep must reach an armour destruction");
});

/* ------------------------------------------------------------------ */
/* The wire projection: what every peer must agree on, byte for byte     */
/* ------------------------------------------------------------------ */

/**
 * WHY THIS SECTION EXISTS, and it is a defect report rather than a precaution.
 *
 * On 2026-09-07 two resource names were added to this rule set's vocabulary so
 * the status phase could read an inflictor's enchantment damage. `ss2Combatant`
 * declares every name in the vocabulary, `combatantProjection`
 * (`src/team/resolver.js:480-496`) carries every DECLARED resource, and
 * `combatStateHash` is an fnv1a over that projection. So **all 23 golden replay
 * hashes moved** — measured, the armoured golden went `70e605e1` -> `4032d673`
 * — and the entire suite stayed green, because nothing pinned the shape. The
 * commit that did it reported "no pinned hash moved", which was true of the
 * assertions and false of the hashes.
 *
 * Two peers on either side of that change do NOT corrupt a battle: their hashes
 * differ, which is exactly the signal the hash exists to produce. What they lose
 * is the diagnosis — it reads as state divergence when the cause is "different
 * code". The fix chosen was NOT a version number in the rule-set id, because a
 * version is only as good as the discipline that bumps it and this repository
 * has a long record of metadata rotting quietly. The fix is to pin the SHAPE, so
 * the next change to it cannot be silent and has to be a decision.
 *
 * ~~The legacy engine projection and the adapter's resource bags already had
 * pins like these.~~ ► **HALF WRONG, and corrected 2026-09-07. The half that
 * was wrong is load-bearing**, because it is the reason a reader would believe
 * the suite guards the adapter's bag. The wire projection's KEY SHAPE is
 * pinned (`test/team-resolver.test.js:1312-1316`) — that half holds — but that
 * pins which keys a combatant has, not what is inside `resources`. **The
 * ADAPTER's resource NAMES were not pinned at all**: every assertion about
 * `CANONICAL_RESOURCE_SOURCES` was relative (`[...].sort()`, `.includes(...)`)
 * and self-updated when the list changed, so growing it would have re-hashed
 * every adapter-built battle with the suite staying green. It is pinned now,
 * in `test/ss2-adapter.test.js`.
 */

test("the SS2 resource vocabulary is pinned: changing it moves every peer's hash", () => {
  assert.deepEqual([...SS2_RESOURCE_NAMES], [
    "armourclass", "armourclass_max",
    "boot", "boot_defence",
    "breastplate", "breastplate_defence",
    "character_level", "charisma", "equipped_weapon",
    "gauntlet", "gauntlet_defence",
    "greaves", "greaves_defence",
    "helmet", "helmet_defence",
    "herolevel", "max_damage", "min_damage",
    "secondary_weapon_enchantment_damage",
    "secondary_weapon_enchantment_potency",
    "secondary_weapon_enchantment_type",
    "shield", "shield_defence",
    "shinguard", "shinguard_defence",
    "shoulderguard", "shoulderguard_defence",
    "staminaleft", "staminamax",
    "weapon_enchantment_damage",
    "weapon_enchantment_potency",
    "weapon_enchantment_type"
  ], [
    "The SS2 resource vocabulary changed. `ss2Combatant` declares every one of",
    "these names, declared resources enter `combatantProjection`, and the",
    "projection IS `combatStateHash` — so this list is part of the wire format.",
    "Adding or removing a name re-hashes every battle in existence, including",
    "all 23 golden replays, and a peer on the other side of the change will",
    "disagree with this one about a battle they are playing identically.",
    "If that is intended, update this list deliberately and say so in the",
    "commit message. Do not update it to make the suite green."
  ].join(" "));
});

test("an SS2 combatant declares exactly the vocabulary, and the projection carries it", () => {
  // The vocabulary is the intent; this is what a real combatant actually puts
  // on the wire. They can drift apart — a name could be declared and dropped
  // from the projection, or a default could stop being written — so both are
  // pinned and the second is derived from the first rather than restated.
  const battle = battleOf({}, {});
  const declared = Object.keys(combatantById(battle, "hero").resources).sort();
  assert.deepEqual(declared, [...SS2_RESOURCE_NAMES].sort(), "declaration must match the vocabulary");

  const projected = toTeamWireState(battle).teams[0].combatants[0];
  assert.deepEqual(
    Object.keys(projected.resources).sort(),
    declared,
    "every declared resource must reach the projection, or the hash is blind to an input"
  );
  // ► **`x` JOINED THE PROJECTION 2026-09-11 and it moved every pinned hash.**
  //   It is present on EVERY combatant, `null` for a rule set that models no
  //   position, so two peers commit to the same projection shape whatever rule
  //   set they run — an absent key would let them disagree about whether the
  //   field exists at all, which is the one thing this pin is for.
  assert.deepEqual(Object.keys(projected), [
    "id", "name", "teamId", "seatId", "slotIndex", "aiFilled",
    "stats", "loadout", "resources", "maxHealth", "health", "alive", "status", "x"
  ], "the per-combatant projection shape is wire format too");
});

test("the SS2 resource DEFAULTS are pinned: they are wire format too", () => {
  // A default is as load-bearing as a name. Every gladiator that does not state
  // a value declares this one, so changing a default re-hashes every battle
  // exactly as adding a name does — and it does it without touching any list a
  // reader would think to check.
  assert.deepEqual(SS2_RESOURCE_DEFAULTS, {
    armourclass: 0, armourclass_max: 0,
    // AUTHORED default over a real `battlevalues` field, added 2026-09-10 and
    // load-bearing twice over: it prices every swing (`SS2_SWING`), and 3 is
    // the middle of the six-entry `weaponweights` index, so a gladiator that
    // states no `weapon` swings something unremarkable rather than free or
    // crippling. Changing it re-hashes every battle that does not state one.
    attack_speed: 3,
    character_level: 1, charisma: 0, equipped_weapon: 1, herolevel: 1,
    secondary_weapon_enchantment_damage: 0,
    secondary_weapon_enchantment_potency: 0,
    secondary_weapon_enchantment_type: 0,
    weapon_enchantment_damage: 0,
    weapon_enchantment_potency: 0,
    weapon_enchantment_type: 0,
    helmet: 0, shoulderguard: 0, breastplate: 0, gauntlet: 0,
    greaves: 0, shinguard: 0, boot: 0, shield: 0,
    helmet_defence: 0, shoulderguard_defence: 0, breastplate_defence: 0,
    gauntlet_defence: 0, greaves_defence: 0, shinguard_defence: 0,
    boot_defence: 0, shield_defence: 0
  }, "a changed default re-hashes every battle that relies on it — change it deliberately");

  // The four required names are absent on purpose: they have no defensible
  // default, so a gladiator omitting one is refused instead of defaulted.
  for (const required of SS2_REQUIRED_RESOURCES) {
    assert.ok(
      !Object.hasOwn(SS2_RESOURCE_DEFAULTS, required),
      `${required} must never gain a default; refusing is the whole point of requiring it`
    );
  }
});

test("a canonical SS2 battle hashes to a pinned value — one tripwire for the whole projection", () => {
  // The key-set pins above catch a NAME changing. This catches everything else
  // that feeds the hash: a default value, a stat, a status token's spelling, the
  // rule-set id, the contract version. One literal, and it moves whenever the
  // wire format does.
  //
  // Deliberately a battle with no action applied: the point is the projection,
  // not the arithmetic, and a fixed seed keeps it independent of RNG changes.
  //
  // And deliberately built from a MINIMAL gladiator that states as little as it
  // can, so every value in `SS2_RESOURCE_DEFAULTS` actually feeds the hash. The
  // first version of this test used the ordinary `gladiator()` helper, which
  // states `character_level` — and a mutation changing that default passed the
  // whole suite. A tripwire that only fires on names is half a tripwire.
  const minimal = {
    strength: 1, speed: 1, attack: 1, defence: 1, vitality: 1,
    stamina: 1, magicka: 0, charisma: 0, herolevel: 1,
    weapon_min_damage: 1, weapon_max_damage: 1
  };
  const battle = createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [ss2Combatant(minimal, { id: "hero", name: "Hero" })] },
      { id: "blue", combatants: [ss2Combatant(minimal, { id: "villain", name: "Villain" })] }
    ]
  });
  assert.equal(combatStateHash(battle), "8cf9b04e", [
    "The SS2 wire projection changed. That is not necessarily wrong — but it",
    "means every peer running the previous build now disagrees with this one",
    "about identical battles, and every stored completion token minted before",
    "the change names a battle this build would hash differently.",
    "Re-derive the new value, put it here, and say in the commit message WHAT",
    "moved and why it was worth moving."
  ].join(" "));
});

/* ------------------------------------------------------------------ */
/* Seam contract                                                        */
/* ------------------------------------------------------------------ */

test("no resource is ever written that the blueprint did not declare", () => {
  // `writeResource` refuses an undeclared name mid-list, leaving the earlier
  // effects applied with no rollback — a partial action. The rule set must
  // therefore skip, not assume.
  const minimal = ss2Combatant(gladiator({ helmet: 3, breastplate: 3, vitality: 8 }), {
    id: "villain",
    name: "Villain"
  });
  const declared = new Set(SS2_REQUIRED_RESOURCES);
  minimal.resources = Object.fromEntries(
    Object.entries(minimal.resources).filter(([name]) => declared.has(name))
  );

  for (let seed = 1; seed <= 40; seed += 1) {
    const battle = createTeamBattle({
      seed,
      rules: ss2TeamRules,
      teams: [
        { id: "red", combatants: [ss2Combatant(gladiator({ strength: 6 }), { id: "hero", name: "Hero", x: -30 })] },
        { id: "blue", combatants: [{ ...JSON.parse(JSON.stringify(minimal)), x: 30 }] }
      ]
    });
    applyAction(battle, { actorId: "hero", type: Ss2ActionType.NORMAL_ATTACK, targetId: "villain" });
    for (const effect of battle.lastResolution.effects) {
      if (effect.kind !== "resource") continue;
      const target = combatantById(battle, effect.targetId);
      assert.ok(
        Object.hasOwn(target.resources, effect.resource),
        `seed ${seed}: wrote undeclared ${effect.resource} on ${effect.targetId}`
      );
    }
  }
});

test("the rule set never emits the resolver's own result event", () => {
  const battle = battleOf({ strength: 30 }, { vitality: 0, herolevel: 1 }, { seed: 4 });
  while (!battle.result) {
    const actor = currentCombatant(battle);
    applyAction(battle, { actorId: actor.id, type: Ss2ActionType.POWER_ATTACK, targetId: actor.id === "hero" ? "villain" : "hero" });
  }
  const emitted = battle.events.filter((event) => event.type === "battle-result-pending");
  assert.equal(emitted.length, 1, "exactly one, and the resolver stamped it");
  assert.ok(battle.events.every((event) => Number.isSafeInteger(event.sequence) && Number.isSafeInteger(event.turn)));
});

test("a first-blood outcome is REFUSED, not silently dropped", () => {
  // The arithmetic ends a duel or misc bout at `hitpoints < hitpointsmax`;
  // `battleStanding` decides on `health > 0` alone. Rather than let the two
  // disagree in silence, the rule set throws.
  const rules = createSs2TeamRules({ fightMode: "duel", fixtureReplay: true });
  let threw = false;
  for (let seed = 1; seed <= 40 && !threw; seed += 1) {
    const battle = battleOf({ strength: 4 }, { vitality: 20 }, { rules, seed });
    try {
      applyAction(battle, { actorId: "hero", type: Ss2ActionType.NORMAL_ATTACK, targetId: "villain" });
    } catch (error) {
      assert.ok(error instanceof TeamRuleSetError, `seed ${seed}`);
      assert.match(error.message, /first-blood/);
      threw = true;
    }
  }
  assert.ok(threw, "a duel-mode hit that does not kill must be refused");
});

/* ------------------------------------------------------------------ */
/* The AI: two decisions from the build, one invented                   */
/* ------------------------------------------------------------------ */

test("the AI rests at or below the ONE stamina gate the bytes actually decode", () => {
  // `villainChooseAction` `+0x03e8` gates the whole action-choice block on
  // `staminaleft > 10`, unconditionally. That is the only villain stamina gate
  // this rule set applies.
  //
  // A `< 40%` rest gate stood here and has been removed. The map places that
  // test on ONE `choices` band arm, and a verifier reading the bytes found the
  // map's own row conflates it with a sibling arm that pushes 30 and selects
  // `wincrowd`. Generalising a band-conditional gate to every decision, under
  // a comment calling it byte-decoded, is an invented number with a citation.
  for (const staminaleft of [0, 5, 10]) {
    const battle = battleOf({ stamina: 10 }, {});
    reassignController(battle, "red:slot-1", "ai");
    combatantById(battle, "hero").resources.staminaleft.value = staminaleft;
    const choice = ss2TeamRules.chooseAiAction(
      { turnNumber: 1, actor: viewOf(battle, "hero"), allies: [viewOf(battle, "hero")], foes: [viewOf(battle, "villain")] },
      "hero",
      legalActions(battle)
    );
    assert.equal(choice.type, Ss2ActionType.REST, `staminaleft ${staminaleft} (of ${100 + 10 * 10})`);
  }
  // Above the gate it attacks, even at 11 of 200 — the removed 40% gate would
  // have rested here, so this pins the removal rather than merely allowing it.
  const battle = battleOf({ stamina: 10 }, {});
  reassignController(battle, "red:slot-1", "ai");
  combatantById(battle, "hero").resources.staminaleft.value = 11;
  const choice = ss2TeamRules.chooseAiAction(
    { turnNumber: 1, actor: viewOf(battle, "hero"), allies: [viewOf(battle, "hero")], foes: [viewOf(battle, "villain")] },
    "hero",
    legalActions(battle)
  );
  assert.notEqual(choice.type, Ss2ActionType.REST);
});

test("a killing blow costs the attacker nothing: death() removes the phase transition", () => {
  // `death()` deletes `attacker.onEnterFrame` (`+0x2035`),
  // `defender.onEnterFrame` (`+0x2042`) and the `nextphase` variable itself
  // (`+0x2049`), and the melee branch only calls `nextphase()` on a later tick
  // behind `attacker.struck == true` (`+0x62c3` -> `+0x62e2`). So the tick that
  // kills is the last one, and it never pays.
  let sawKill = false;
  for (let seed = 1; seed <= 60 && !sawKill; seed += 1) {
    const battle = battleOf({ strength: 20 }, { vitality: 0, herolevel: 1 }, { seed });
    const hero = combatantById(battle, "hero");
    const staminaBefore = hero.resources.staminaleft.value;
    const healthBefore = hero.health;
    applyAction(battle, { actorId: "hero", type: Ss2ActionType.POWER_ATTACK, targetId: "villain" });
    if (combatantById(battle, "villain").alive) continue;
    sawKill = true;
    assert.equal(hero.resources.staminaleft.value, staminaBefore, `seed ${seed}: no stamina spent on a kill`);
    assert.equal(hero.health, healthBefore, `seed ${seed}: no regeneration on a kill`);
    assert.equal(battle.lastResolution.events[0].staminaSpent, 0, `seed ${seed}`);
  }
  assert.ok(sawKill, "the sweep must land a killing blow");

  // And a NON-lethal blow does transition, so the skip is conditional and not
  // a quiet removal of the whole mechanism.
  const survivor = battleOf({ strength: 20 }, { vitality: 40 }, { seed: 5 });
  const hero = combatantById(survivor, "hero");
  const staminaBefore = hero.resources.staminaleft.value;
  applyAction(survivor, { actorId: "hero", type: Ss2ActionType.POWER_ATTACK, targetId: "villain" });
  assert.ok(combatantById(survivor, "villain").alive);
  assert.notEqual(hero.resources.staminaleft.value, staminaBefore);
});

test("status effects come out in death()'s own order: attacker's four, defender's four, then the taunts", () => {
  // `clearDeathState` walks side-then-field for the four condition flags and
  // field-then-SIDE for the two taunts. This file emitted two independent
  // per-side passes, in the wrong flag order, under a docstring claiming it was
  // the build's — caught by a verifier reading the interleave.
  assert.deepEqual([...SS2_STATUS_FLAGS], ["frozen", "burning", "poison", "life_stolen", "taunted1", "taunted2"]);

  // ► **NARROWED 2026-09-07, and the narrowing is a real consequence, not a
  //   concession.** This test used to give BOTH sides all four conditions and
  //   have the hero attack. Since the status phase became a forced legal action,
  //   an attacker carrying a condition CANNOT attack — `legalActions` offers it
  //   exactly one option, its own status phase — so the old setup now throws
  //   "Illegal action" and the attacker's four are unreachable through the
  //   resolver. The taunt flags do NOT force a phase (the build's taunted row
  //   is modelled nowhere yet), so they still reach both sides and the
  //   field-then-SIDE interleave is still pinned here.
  let cleared = null;
  for (let seed = 1; seed <= 60 && cleared === null; seed += 1) {
    const battle = battleOf({ strength: 30 }, { vitality: 0, herolevel: 1 }, { seed });
    combatantById(battle, "hero").status = ["taunted1", "taunted2"];
    combatantById(battle, "villain").status =
      ["frozen", "burning", "poison", "life_stolen", "taunted1", "taunted2"];
    applyAction(battle, { actorId: "hero", type: Ss2ActionType.POWER_ATTACK, targetId: "villain" });
    if (!battle.result) continue;   // a miss: death() never runs
    cleared = battle.lastResolution.effects
      .filter((effect) => effect.kind === "status")
      .map((effect) => `${effect.targetId}:${effect.status}`);
  }
  assert.ok(cleared, "the sweep must land a killing blow, so death() runs and clears the flags");
  assert.deepEqual(cleared, [
    "villain:frozen", "villain:burning", "villain:poison", "villain:life_stolen",
    "hero:taunted1", "villain:taunted1",
    "hero:taunted2", "villain:taunted2"
  ]);
});

test("an attacker carrying a condition cannot attack: the phase takes the turn", () => {
  // The other half of the narrowing above, asserted rather than left implied.
  const battle = battleOf({ strength: 30 }, { vitality: 0, herolevel: 1 }, { seed: 3 });
  combatantById(battle, "hero").status = ["burning"];
  assert.deepEqual(
    legalActions(battle).map((option) => option.type),
    [Ss2ActionType.BURNING_PHASE],
    "a burning gladiator gets exactly one option, and it is not an attack"
  );
  assert.throws(
    () => applyAction(battle, { actorId: "hero", type: Ss2ActionType.POWER_ATTACK, targetId: "villain" }),
    /Illegal action/
  );
});

/* ------------------------------------------------------------------ */
/* The status phase: the turn a condition costs its bearer               */
/* ------------------------------------------------------------------ */

/** A gladiator whose weapon enchantment does `ceil(weapon_max_damage / 3 * potency)`. */
function enchanter(overrides = {}) {
  return gladiator({ weapon_enchantment_type: 2, weapon_enchantment_potency: 3, weapon_max_damage: 9, ...overrides });
}

function statusBattle({ heroFields = {}, villainFields = {}, status = [], seed = 5 } = {}) {
  const battle = createTeamBattle({
    seed,
    rules: ss2TeamRules,
    teams: [
      // In contact, as `battleOf` is: the status phases are what these tests
      // are about, and reaching one means landing a blow first.
      { id: "red", combatants: [ss2Combatant(gladiator({ speed: 9, vitality: 8, ...heroFields }), { id: "hero", name: "Hero", x: -30 })] },
      { id: "blue", combatants: [ss2Combatant(enchanter({ vitality: 8, ...villainFields }), { id: "villain", name: "Villain", x: 30 })] }
    ]
  });
  combatantById(battle, "hero").status = status;
  return battle;
}

const onlyAction = (battle) => {
  const options = legalActions(battle);
  assert.equal(options.length, 1, `expected exactly one legal option, got ${options.map((o) => o.type)}`);
  return { actorId: "hero", ...options[0] };
};

test("the enchantment damage derives from the build's own formula and is a DECLARED resource", () => {
  // ceil(weapon_max_damage / 3 * potency) = ceil(9 / 3 * 3) = 9, `battlevalues`
  // +0x320c. Declared rather than recomputed at tick time, because the build
  // derives it once in battlevalues and the status phase reads the stored field.
  // A BLUEPRINT's resources are plain numbers; the `{ value }` shape appears
  // only once `normaliseResourceBag` runs inside a battle. Both are checked, so
  // this test fails if either representation stops carrying the derivation.
  const source = ss2Combatant(enchanter(), { id: "villain", name: "Villain" });
  assert.equal(source.resources.weapon_enchantment_damage, 9);
  const battle = statusBattle({});
  assert.equal(combatantById(battle, "villain").resources.weapon_enchantment_damage.value, 9);
  assert.ok(
    SS2_RESOURCE_NAMES.includes("weapon_enchantment_damage") &&
    SS2_RESOURCE_NAMES.includes("secondary_weapon_enchantment_damage"),
    "both must be declarable, or the tick cannot read them off a combatant view"
  );
});

test("a condition takes the turn, applies the INFLICTOR's enchantment damage, and draws NO rng", () => {
  // `magic_damage_character` contains no RNG call, no RandomNumber opcode and
  // no armour-removal call, so a status phase must consume nothing from the
  // channel. That is what keeps a status turn replayable off a fixture tape.
  const battle = statusBattle({ status: [ss2StatusToken("burning", "villain")] });
  const drawsBefore = rngJournal(battle).length;
  const before = combatantById(battle, "hero").health;

  applyAction(battle, onlyAction(battle));

  const event = battle.lastResolution.events[0];
  assert.equal(event.type, Ss2ActionType.BURNING_PHASE);
  assert.equal(event.vanillaLabel, "burning", "the getphase label the build knows it by");
  assert.equal(event.inflictorId, "villain");
  assert.equal(event.damage, 9, "the inflictor's weapon_enchantment_damage, not the victim's");
  assert.equal(event.staminaSpent, 0, "staminacost is forced to 0 at +0x52c0");
  assert.equal(rngJournal(battle).length, drawsBefore, "the status phase must draw nothing");

  // Net positive except the tick: nextphase still runs, so the heal applies.
  const after = combatantById(battle, "hero");
  assert.equal(after.health, before - event.hitpointDamage + event.healed);
  assert.ok(event.healed > 0, "nextphase's heal must still fire; only staminacost is zeroed");
  assert.deepEqual([...after.status], [], "the condition is consumed");
});

test("a condition inflicted IN PLAY carries its inflictor, so its tick can bill somebody", () => {
  // THE GAP THIS CLOSES WAS FOUND BY PLAYING A FIGHT, NOT BY A TEST. The status
  // phase read an inflictor off the token, and the attack path wrote a BARE
  // flag — so every condition anyone could actually inflict ticked for zero and
  // the whole mechanism was dead on the only path a player can reach. The
  // narration said "gains burning" where it should have said "gains burning
  // (from Player 2)".
  //
  // The mutation that kills this is dropping the inflictor argument where the
  // defender's conditions are emitted.
  let applied = null;
  for (let seed = 1; seed <= 80 && applied === null; seed += 1) {
    const battle = statusBattle({ villainFields: { vitality: 40 }, seed });
    // The villain wields the enchanted weapon; give the HERO one too so the
    // hero's swing is what procs, and the hero is the inflictor.
    const hero = combatantById(battle, "hero");
    hero.resources.weapon_enchantment_type.value = 2;
    hero.resources.weapon_enchantment_potency.value = 3;
    applyAction(battle, { actorId: "hero", type: Ss2ActionType.NORMAL_ATTACK, targetId: "villain" });
    applied = battle.lastResolution.effects.find(
      (effect) => effect.kind === "status" && effect.active !== false
    ) ?? null;
  }
  assert.ok(applied, "the sweep must land an enchantment proc, or this test proves nothing");
  assert.equal(ss2StatusFlagOf(applied.status), "burning");
  assert.equal(
    ss2StatusSourceOf(applied.status),
    "hero",
    "the condition must name whoever inflicted it, or its tick has no damage to read"
  );
});

test("the FIRST condition plays and EVERY condition is consumed — the map's order, corrected 2026-09-07", () => {
  // frozen, burning, poison, life_stolen as four SEQUENTIAL ifs. Each clears
  // its own flag before calling getphase, and getphase only runs at
  // turnphase == 1 — so the first match takes the turn and the rest are silent
  // no-ops that have already eaten their flags.
  const battle = statusBattle({
    status: [ss2StatusToken("burning", "villain"), ss2StatusToken("frozen", "villain")]
  });
  const action = onlyAction(battle);
  assert.equal(action.type, Ss2ActionType.FROZEN_PHASE, "frozen outranks burning whatever order they were added in");

  applyAction(battle, action);
  assert.equal(battle.lastResolution.events[0].condition, "frozen");
  assert.deepEqual(
    [...combatantById(battle, "hero").status],
    [],
    "the burning was consumed too, without ever playing — this is the build's behaviour, not a bug"
  );
});

test("a forced REST at zero stamina eats the condition without playing it", () => {
  // The status arms are rows 4-7 of frame 1's forced chain; rest is row 2. The
  // map states this exact consequence: "a forced rest at zero stamina clears
  // and discards a pending burning phase in the same pass".
  const battle = statusBattle({ status: [ss2StatusToken("burning", "villain")] });
  const hero = combatantById(battle, "hero");
  hero.resources.staminaleft.value = 0;

  const action = onlyAction(battle);
  assert.equal(action.type, Ss2ActionType.REST, "the rest gate outranks every condition");

  applyAction(battle, action);
  assert.deepEqual([...combatantById(battle, "hero").status], [], "the condition is consumed anyway");
  assert.ok(
    !battle.lastResolution.events.some((event) => event.condition),
    "and no status phase was played"
  );
});

test("the primary/secondary selector reads the VICTIM's weapon slot — reproduced, not corrected", () => {
  // `+0x530e` reads game_attacker.equipped_weapon (the VICTIM's slot) to choose
  // between game_defender's (the INFLICTOR's) two enchantment damages. Which of
  // someone else's weapons burned you cannot depend on which weapon you are
  // holding, and it does. The map says reproduce it.
  const villainFields = {
    weapon_max_damage: 9, weapon_enchantment_potency: 3,              // primary   -> 9
    secondary_weapon_max_damage: 30, secondary_weapon_enchantment_potency: 2  // secondary -> 20
  };
  for (const [slot, expected] of [[1, 9], [2, 20]]) {
    const battle = statusBattle({
      heroFields: { equipped_weapon: slot },
      villainFields,
      status: [ss2StatusToken("burning", "villain")]
    });
    applyAction(battle, onlyAction(battle));
    assert.equal(
      battle.lastResolution.events[0].damage,
      expected,
      `victim holding slot ${slot} must take the inflictor's slot-${slot} enchantment damage`
    );
  }
});

test("a condition with NO recorded inflictor costs the turn and applies nothing", () => {
  // A battle that STARTS with a condition, which vanilla cannot produce: there
  // is no enchantment damage to read, so none is invented.
  const battle = statusBattle({ status: ["burning"] });
  const before = combatantById(battle, "hero").health;
  applyAction(battle, onlyAction(battle));

  const event = battle.lastResolution.events[0];
  assert.equal(event.inflictorId, null);
  assert.equal(event.damage, 0, "no inflictor means no number to read, and inventing one would be inventing evidence");
  assert.equal(event.hitpointDamage, 0);
  assert.ok(combatantById(battle, "hero").health >= before, "the turn still passes and nextphase still heals");
  assert.deepEqual([...combatantById(battle, "hero").status], [], "the condition is still consumed");
});

test("above 1v1 the tick reads the RECORDED inflictor, not whoever happens to be opposite", () => {
  // Vanilla reads "the other gladiator", which names nobody at 2v2. The owner's
  // decision (2026-09-07) is that the condition remembers its source; this
  // pins that the WEAKER enchanter opposite is not the one billed.
  const battle = createTeamBattle({
    seed: 5,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        combatants: [
          ss2Combatant(gladiator({ speed: 9, vitality: 8 }), { id: "hero", name: "Hero" }),
          ss2Combatant(gladiator({ speed: 1, vitality: 8 }), { id: "ally", name: "Ally" })
        ]
      },
      {
        id: "blue",
        combatants: [
          ss2Combatant(enchanter({ vitality: 8, weapon_max_damage: 3, weapon_enchantment_potency: 1 }), { id: "weak", name: "Weak" }),
          ss2Combatant(enchanter({ vitality: 8, weapon_max_damage: 30, weapon_enchantment_potency: 3 }), { id: "strong", name: "Strong" })
        ]
      }
    ]
  });
  combatantById(battle, "hero").status = [ss2StatusToken("burning", "strong")];
  applyAction(battle, onlyAction(battle));

  const event = battle.lastResolution.events[0];
  assert.equal(event.inflictorId, "strong");
  assert.equal(event.damage, 30, "ceil(30 / 3 * 3) from the recorded source");
  assert.notEqual(event.damage, 1, "and NOT ceil(3 / 3 * 1) from the other foe");
});

test("a lethal tick runs no phase transition and clears the flags on BOTH gladiators", () => {
  // death() deletes nextphase before the transition can fire — the same rule
  // nineteen goldens measure on the attack path — and clearDeathState walks
  // both sides, so the inflictor's own conditions go too.
  const battle = statusBattle({
    heroFields: { vitality: 0, herolevel: 1 },
    villainFields: { weapon_max_damage: 300, weapon_enchantment_potency: 3 },
    status: [ss2StatusToken("burning", "villain")]
  });
  combatantById(battle, "villain").status = ["poison", "taunted1"];

  applyAction(battle, onlyAction(battle));

  const event = battle.lastResolution.events[0];
  assert.equal(event.healed, 0, "a lethal tick regenerates nothing");
  assert.equal(event.staminaGained, 0);
  assert.equal(combatantById(battle, "hero").alive, false);
  assert.deepEqual(
    [...combatantById(battle, "villain").status],
    [],
    "death() clears the inflictor's conditions and taunts as well as the victim's"
  );
  assert.ok(battle.result, "the battle settles through the resolver's own elimination path");
});

/* --- Defects an independent review found, each now pinned ------------ */

test("the life-steal tick reaches the ingress as `lifesteal`, not as its decision label", () => {
  // "Three spellings for one effect, and they are not interchangeable": the
  // FIELD is poison and the DECISION is poisoned; life_stolen keeps its
  // spelling as a decision but reaches magic_damage_character as `lifesteal`.
  // Passing the decision label straight through got this one wrong.
  const observed = [];
  const rules = createSs2TeamRules({ observer: (record) => observed.push(record) });
  const battle = createTeamBattle({
    seed: 5,
    rules,
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator({ speed: 9, vitality: 8 }), { id: "hero", name: "Hero" })] },
      { id: "blue", combatants: [ss2Combatant(enchanter({ vitality: 8 }), { id: "villain", name: "Villain" })] }
    ]
  });
  combatantById(battle, "hero").status = [ss2StatusToken("life_stolen", "villain")];
  applyAction(battle, { actorId: "hero", ...legalActions(battle)[0] });

  assert.equal(battle.lastResolution.events[0].vanillaLabel, "life_stolen", "the getphase decision");
  assert.equal(observed.at(-1).damageMethod, "lifesteal", "the ingress argument is spelled differently");
  assert.deepEqual(
    Object.entries(SS2_STATUS_DAMAGE_METHOD).sort(),
    [["burning", "burning"], ["frozen", "frozen"], ["life_stolen", "lifesteal"], ["poison", "poisoned"]]
  );
});

test("TWO tokens for one condition are BOTH consumed, so neither forces a second turn", () => {
  // normaliseStatus dedupes identical STRINGS, not conditions, so two different
  // inflictors leave two burning tokens. Clearing only the first left the
  // survivor to take another turn — "every set flag is cleared" would have been
  // false in the one case where it matters.
  const battle = statusBattle({
    status: [ss2StatusToken("burning", "villain"), ss2StatusToken("burning", "hero")]
  });
  assert.equal(combatantById(battle, "hero").status.length, 2, "both tokens must survive construction");

  applyAction(battle, onlyAction(battle));
  assert.deepEqual(
    [...combatantById(battle, "hero").status],
    [],
    "both tokens go, or the condition outlives the turn that was supposed to spend it"
  );
});

test("a lethal tick clears EVERY token on the inflictor, not the first per condition", () => {
  // An independent review turned this into a counterexample against a claim
  // made elsewhere in this repository — that a condition cannot survive a 1v1
  // bout. It could, because `statusTokenFor` returns ONE token per flag and the
  // inflictor's clear used it: a gladiator carrying `burning:from=x` and
  // `burning:from=y` kept the second, and walked out of a finished bout still
  // alight. The victim's own consumption already took every token; the
  // inflictor's did not.
  const battle = statusBattle({
    heroFields: { vitality: 0, herolevel: 1 },
    villainFields: { weapon_max_damage: 300, weapon_enchantment_potency: 3 },
    status: [ss2StatusToken("burning", "villain")]
  });
  combatantById(battle, "villain").status = [
    ss2StatusToken("frozen", "hero"),
    ss2StatusToken("frozen", "someone-else")
  ];

  applyAction(battle, onlyAction(battle));
  assert.equal(combatantById(battle, "hero").alive, false, "the tick must be lethal for death() to run");
  assert.deepEqual(
    [...combatantById(battle, "villain").status],
    [],
    "both frozen tokens go: death() clears the flag, and two tokens are still one flag"
  );
});

test("a LETHAL tick clears the victim's taunts too, not only its conditions", () => {
  // death() clears all six flags on both gladiators. Clearing only the four
  // conditions left a corpse still carrying taunted1/taunted2.
  const battle = statusBattle({
    heroFields: { vitality: 0, herolevel: 1 },
    villainFields: { weapon_max_damage: 300, weapon_enchantment_potency: 3 },
    status: [ss2StatusToken("burning", "villain"), "taunted1", "taunted2"]
  });
  applyAction(battle, onlyAction(battle));
  assert.equal(combatantById(battle, "hero").alive, false);
  assert.deepEqual(
    [...combatantById(battle, "hero").status],
    [],
    "a lethal tick must leave the victim carrying nothing at all"
  );
});

test("a status phase REFUSES a first-blood result rather than dropping it", () => {
  // The attack path already refuses this; the status path tested only
  // hitpoints <= 0 and silently healed a victim the build would have defeated.
  const rules = createSs2TeamRules({ fightMode: "duel", fixtureReplay: true });
  const battle = createTeamBattle({
    seed: 5,
    rules,
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator({ speed: 9, vitality: 8 }), { id: "hero", name: "Hero" })] },
      { id: "blue", combatants: [ss2Combatant(enchanter({ vitality: 8 }), { id: "villain", name: "Villain" })] }
    ]
  });
  combatantById(battle, "hero").status = [ss2StatusToken("burning", "villain")];
  assert.throws(
    () => applyAction(battle, { actorId: "hero", ...legalActions(battle)[0] }),
    (error) => error instanceof TeamRuleSetError && /first-blood/.test(error.message)
  );
});

test("an ambiguous inflictor id is REFUSED, not billed to whichever matched first", () => {
  // The roster enforces id uniqueness with a Set over raw values, so numeric 7
  // and string "7" can both exist while the token can only record one of them.
  const battle = createTeamBattle({
    seed: 5,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator({ speed: 9, vitality: 8 }), { id: "hero", name: "Hero" })] },
      {
        id: "blue",
        combatants: [
          ss2Combatant(enchanter({ vitality: 8, weapon_max_damage: 30 }), { id: 7, name: "Numeric" }),
          ss2Combatant(enchanter({ vitality: 8, weapon_max_damage: 3 }), { id: "7", name: "Stringy" })
        ]
      }
    ]
  });
  combatantById(battle, "hero").status = [ss2StatusToken("burning", "7")];
  assert.throws(
    () => applyAction(battle, { actorId: "hero", ...legalActions(battle)[0] }),
    (error) => error instanceof TeamRuleSetError && /stringified/.test(error.message),
    "billing one of them at random would be inventing evidence about which weapon burned the victim"
  );
});

test("the tick costs no stamina and STILL regenerates — pinned as numbers, not as a flag", () => {
  // `staminacost` is forced to 0 at +0x52c0 but nextphase() still runs, so the
  // regeneration applies. Asserting only `staminaSpent: 0` left both the zero
  // cost and the post-tick transition state removable without any test failing.
  const battle = statusBattle({ status: [ss2StatusToken("burning", "villain")] });
  const hero = combatantById(battle, "hero");
  hero.resources.staminaleft.value = 40;
  const stamina = hero.stats.stamina;

  applyAction(battle, onlyAction(battle));

  const event = battle.lastResolution.events[0];
  // nextphase: staminaleft - 0 + 1 + round(stamina / 3); the tick itself adds
  // only the breastplate bonus, which is 0 with no breastplate.
  const expected = 40 + event.staminaBonus + 1 + Math.round(stamina / 3);
  assert.equal(combatantById(battle, "hero").resources.staminaleft.value, expected);
  assert.equal(event.staminaSpent, 0, "the phase spends nothing");
  assert.equal(event.staminaGained, expected - 40);
});

test("the tick applies its damage RAW: no ceil, because the ingress has none", () => {
  // The map is explicit that the ceil in magic_damage_character is display-only.
  // A derived enchantment damage is always integral, so this is reachable only
  // through a DECLARED fractional value — which the resource vocabulary now
  // permits, and which is exactly why the seam must not round.
  const battle = statusBattle({ status: [ss2StatusToken("burning", "villain")] });
  combatantById(battle, "villain").resources.weapon_enchantment_damage.value = 2.5;
  const before = combatantById(battle, "hero").health;

  applyAction(battle, onlyAction(battle));
  const event = battle.lastResolution.events[0];
  assert.equal(event.damage, 2.5, "a ceil here would report 3");
  assert.equal(before - event.hitpointDamage + event.healed, combatantById(battle, "hero").health);
});

test("the breastplate stamina join fires on a status tick, as it does on a blow", () => {
  // Step 5 of the ingress is "the same unconditional breastplate stamina join
  // as the physical path": ceil(breastplate * damageRegister / 100).
  const battle = statusBattle({
    heroFields: { breastplate: 8 },
    villainFields: { weapon_max_damage: 60, weapon_enchantment_potency: 3 },
    status: [ss2StatusToken("burning", "villain")]
  });
  combatantById(battle, "hero").resources.staminaleft.value = 10;

  applyAction(battle, onlyAction(battle));
  const event = battle.lastResolution.events[0];
  assert.ok(event.staminaBonus > 0, "a breastplate must convert incoming damage into stamina");
  // The join reads the DAMAGE REGISTER, not the hitpoint damage — with armour
  // standing, most of that damage never reaches health, and the stamina gain
  // still fires on the full figure. Asserting it against hitpointDamage looked
  // right and measured 0 against an actual 5.
  assert.equal(event.staminaBonus, Math.ceil(8 * event.damage / 100));

  // AND the transition must build on that bonus rather than on the pre-tick
  // view. This is the only reachable case where the two differ — with no
  // breastplate the tick moves no stamina, so dropping the post-tick handoff
  // is invisible. That is exactly how it survived the first mutation sweep.
  const stamina = combatantById(battle, "hero").stats.stamina;
  assert.equal(
    combatantById(battle, "hero").resources.staminaleft.value,
    10 + event.staminaBonus + 1 + Math.round(stamina / 3),
    "the regeneration must start from the post-tick stamina, bonus included"
  );
});

test("an unknown inflictor still gets the FULL transition, pinned exactly", () => {
  // This asserted only `health >= before`, which passes with the healing
  // removed. Every gladiator here starts at full health, so the heal is clamped
  // to zero and the assertion proved nothing; start it wounded instead.
  const battle = statusBattle({ status: ["burning"] });
  const hero = combatantById(battle, "hero");
  hero.health = hero.maxHealth - 20;
  const stamina = hero.stats.stamina;
  const before = hero.health;

  applyAction(battle, onlyAction(battle));
  const event = battle.lastResolution.events[0];
  assert.equal(event.damage, 0, "no inflictor, no number to read");
  assert.equal(event.healed, 1 + Math.ceil(stamina / 2), "and the transition still runs in full");
  assert.equal(combatantById(battle, "hero").health, before + event.healed);
});

test("the AI takes the status phase it is handed, WITHOUT building an attacker record", () => {
  const battle = statusBattle({ status: [ss2StatusToken("poison", "villain")] });
  reassignController(battle, "red:slot-1", "ai");
  const chosen = ss2TeamRules.chooseAiAction(
    { actor: combatantById(battle, "hero"), foes: [combatantById(battle, "villain")] },
    "hero",
    legalActions(battle)
  );
  assert.equal(chosen.type, Ss2ActionType.POISONED_PHASE, "the field is `poison`; the decision label is `poisoned`");

  // And it must not have needed the damage pair to get there. Ranking the melee
  // verbs builds the ATTACKER record, which requires min_damage/max_damage — so
  // a conditioned AI gladiator that declares neither must still take its forced
  // phase rather than throwing. The mutation that kills this is moving the
  // forced-option check below the record build.
  const stripped = combatantById(battle, "hero");
  delete stripped.resources.min_damage;
  delete stripped.resources.max_damage;
  assert.equal(
    ss2TeamRules.chooseAiAction(
      { actor: stripped, foes: [combatantById(battle, "villain")] },
      "hero",
      legalActions(battle)
    ).type,
    Ss2ActionType.POISONED_PHASE
  );
});

test("the AI always returns one of the options it was handed, and a full AI fight settles", () => {
  const battle = battleOf({ strength: 8 }, { strength: 8, vitality: 1, herolevel: 1 }, { seed: 21 });
  reassignController(battle, "red:slot-1", "ai");
  reassignController(battle, "blue:slot-1", "ai");
  const actions = advanceAiTurns(battle, 400);
  assert.ok(actions.length > 0);
  for (const action of actions) {
    assert.ok(ss2TeamRules.actionTypes.includes(action.type), action.type);
  }
  assert.ok(battle.result, "an AI-vs-AI fight must reach a result rather than deadlocking");
});

/** A combatant view shaped the way the resolver builds one, for direct AI calls. */
function viewOf(battle, id) {
  const combatant = combatantById(battle, id);
  return Object.freeze({
    id: combatant.id,
    name: combatant.name,
    teamId: combatant.teamId,
    seatId: combatant.seatId,
    slotIndex: combatant.slotIndex,
    aiFilled: combatant.aiFilled,
    stats: { ...combatant.stats },
    loadout: { ...combatant.loadout },
    resources: JSON.parse(JSON.stringify(combatant.resources)),
    maxHealth: combatant.maxHealth,
    health: combatant.health,
    alive: combatant.alive,
    status: [...combatant.status]
  });
}

/* ------------------------------------------------------------------ */
/* Holes a mutation sweep found on 2026-09-02, and the inputs that     */
/* close them. Each block names the mutant it kills.                   */
/* ------------------------------------------------------------------ */

/**
 * MUTANT: any `SS2_ARMOUR_DVAL` entry set to an arbitrary number.
 *
 * Measured before this test existed: setting `helmet`, `shinguard`, `greaves`,
 * `shoulderguard` or `gauntlet` to 500 left all 702 tests passing. The three
 * oracles that touched the table computed their expected value FROM the table
 * under test (`Math.round(derived[piece] * SS2_ARMOUR_DVAL[piece])`), so the
 * oracle moved with the code — the project's most reliable defect signal, an
 * assertion that cannot fail.
 *
 * The table is NOT reasoned into existence: all eight values are read directly
 * out of the licensed build, `_global.<piece>_dval` assigned as literals in one
 * straight-line run inside `battlevalues`. So the right fix here is a LITERAL
 * pin with the offset, not a desaturated input — this is build data, and the
 * only honest oracle for build data is the build.
 *
 * Re-derive every row with:
 * `node tools/inspect-swf.mjs <ss2.swf> --references '_dval' --around 2`
 */
test("the armour dval table equals the build's own literals, offset by offset", () => {
  const fromTheBuild = Object.freeze({
    breastplate: [16, "+0x3089"],
    helmet: [10, "+0x3096"],
    shinguard: [6, "+0x30a3"],
    greaves: [3, "+0x30b0"],
    shoulderguard: [8, "+0x30bd"],
    gauntlet: [5, "+0x30ca"],
    boot: [2, "+0x30d7"],
    shield: [12, "+0x30e4"]
  });
  for (const [piece, [value, offset]] of Object.entries(fromTheBuild)) {
    assert.equal(
      SS2_ARMOUR_DVAL[piece],
      value,
      `${piece}_dval disagrees with root:35/DoAction@0x3fa9dc/battlevalues@${offset}`
    );
  }
  // The set must match too, or a piece could be dropped without failing above.
  assert.deepEqual(
    Object.keys(SS2_ARMOUR_DVAL).slice().sort(),
    Object.keys(fromTheBuild).slice().sort()
  );
  assert.deepEqual(SS2_ARMOUR_PIECES.slice().sort(), Object.keys(fromTheBuild).slice().sort());
});

/**
 * MUTANT: `Math.ceil(stamina / 2)` -> `Math.floor(stamina / 2)` in
 * `phaseTransitionEffects`, and even `+ (stamina % 2) * 1000`.
 *
 * Both passed the whole suite. The cause was NOT stamina parity but the
 * maxHealth clamp: of 326 invocations across the suite, 265 had zero headroom
 * and wrote nothing at all — and that included every odd-stamina one. The 22
 * goldens replay at `stamina 1`, exactly where ceil and floor disagree, and
 * every one of them is at full health when the heal is computed.
 *
 * So the fix is an INPUT, not an assertion: an odd-stamina actor with room to
 * heal. `nextphase` regenerates the acting combatant by `1 + ceil(stamina/2)`
 * at `+0x3305..+0x3346`, immediately before `check_stats`.
 */
test("the phase-transition heal rounds UP, measured with odd stamina and headroom", () => {
  // `nextphase` regenerates the acting combatant by `1 + ceil(stamina / 2)` at
  // `+0x3305..+0x3346`, and the rest branch adds its own `3 + ceil(stamina)` at
  // `+0x51d5`. The neighbouring rest test above uses `stamina 4`, where ceil
  // and floor agree — which is precisely why the mutants lived.
  for (const stamina of [1, 3, 5, 9]) {
    const battle = battleOf({ stamina }, {});
    const hero = combatantById(battle, "hero");
    hero.resources.staminaleft.value = 10;
    // Real headroom. Without it `Math.min(..., maxHealth - health)` clamps the
    // heal to 0 and writes nothing, which is how 265 of the suite's 326
    // invocations of this code assert nothing at all.
    hero.health = 5;

    applyAction(battle, { actorId: "hero", type: Ss2ActionType.REST, targetId: "hero" });

    const healed = 3 + Math.ceil(stamina) + 1 + Math.ceil(stamina / 2);
    // Pinned to literals as well as to the formula, so the oracle cannot move
    // with the code. Every one of these differs from the floor variant.
    const literal = { 1: 6, 3: 9, 5: 12, 9: 18 }[stamina];
    assert.equal(healed, literal, `stamina ${stamina}: formula and literal disagree`);
    assert.equal(hero.health, 5 + literal, `stamina ${stamina}: applied heal`);
    assert.equal(battle.lastResolution.events[0].healed, literal);
  }
});


/* ------------------------------------------------------------------ */
/* The crowd's patience                                                */
/* ------------------------------------------------------------------ */

/** The blueprint the standoff and the honest-bout sweep share. */
function crowdFighter(id, salt = 0) {
  return {
    id,
    maxHealth: 250,
    stats: { strength: 10 + (salt % 7), agility: 3 + (salt % 5), vitality: 10, stamina: 5 },
    resources: {
      staminaleft: 150,
      staminamax: 150,
      min_damage: 10 + (salt % 9),
      max_damage: 25 + (salt % 11),
      herolevel: 5
    }
  };
}

/**
 * THE DEFECT THIS CLOSES, and it was measured before anything was built:
 * 4,000 consecutive mutual `rest` actions left `battle.result === null`.
 * `rest` is stamina-positive AND heals, so two combatants who decline to fight
 * are a fixpoint both sides strictly improve in, for ever
 * (`docs/combat-economy-findings-2026-09-10.md`, D1).
 *
 * The toll is AUTHORED — see `MAP_SILENCE.crowd-impatience`; vanilla records
 * no bout-level pressure mechanic and this test may never be cited as evidence
 * about the game.
 */
test("a mutual-rest standoff ENDS, because the crowd runs out of patience", () => {
  const battle = createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "blue", combatants: [crowdFighter("b1")] },
      { id: "red", combatants: [crowdFighter("r1")] }
    ]
  });

  let applied = 0;
  while (!battle.result && applied < 9000) {
    const actor = currentCombatant(battle);
    const rest = legalActions(battle).find((option) => option.type === Ss2ActionType.REST);
    assert.ok(rest, `rest must stay legal for ${actor.id}; the standoff is the point`);
    applyAction(battle, { actorId: actor.id, ...rest });
    applied += 1;
  }

  assert.ok(battle.result, `the standoff must end; it ran ${applied} actions to turn ${battle.turnNumber}`);
  assert.ok(
    battle.turnNumber > SS2_CROWD.patience,
    `it must end BECAUSE of the crowd, past turn ${SS2_CROWD.patience}, not by accident at ${battle.turnNumber}`
  );
});

/**
 * The other half, and the one that makes the number defensible: a backstop
 * that fires in ordinary fights is a balance change wearing a safety feature's
 * clothes. At `patience` 40 this assertion failed for 85 of 120 bouts.
 */
test("the crowd is INVISIBLE in an honest bout: no seeded fight ever reaches its patience", () => {
  let longest = 0;
  let settled = 0;
  for (const perSide of [1, 2, 3]) {
    for (let seed = 1; seed <= 12; seed += 1) {
      const side = (id) => ({
        id,
        combatants: Array.from({ length: perSide }, (_, i) => crowdFighter(`${id}${i}`, seed + i + perSide))
      });
      const battle = createTeamBattle({ seed, rules: ss2TeamRules, teams: [side("b"), side("r")] });
      let applied = 0;
      while (!battle.result && applied < 20000) {
        const actor = currentCombatant(battle);
        applyAction(battle, { actorId: actor.id, ...chooseAiAction(battle) });
        applied += 1;
      }
      assert.ok(battle.result, `${perSide}v${perSide} seed ${seed} must settle on its own`);
      settled += 1;
      longest = Math.max(longest, battle.turnNumber);
    }
  }
  assert.equal(settled, 36);
  assert.ok(
    longest <= SS2_CROWD.patience,
    `an honest bout reached turn ${longest}, at or past the crowd's patience of ${SS2_CROWD.patience}. ` +
    "RE-MEASURE THE DISTRIBUTION WITH THE TOLL DISABLED (fixtureReplay: true) and raise patience past the " +
    "tail — never tune it against a sweep the toll itself shaped, which is how 40 and 120 were both wrong."
  );
});

/** The toll itself: zero during grace, linear after, and never negative. */
test("the crowd's toll is zero during grace and grows linearly after it", () => {
  assert.equal(ss2CrowdDamage(1), 0);
  assert.equal(ss2CrowdDamage(SS2_CROWD.patience), 0);
  assert.equal(ss2CrowdDamage(SS2_CROWD.patience + 1), SS2_CROWD.ramp);
  assert.equal(ss2CrowdDamage(SS2_CROWD.patience + 10), 10 * SS2_CROWD.ramp);
  assert.equal(ss2CrowdDamage(Number.NaN), 0);
  // A fixture never pays it, so no golden can be re-datumed by an authored rule.
  const fixture = createSs2TeamRules({ fightMode: "misc", fixtureReplay: true });
  assert.ok(fixture, "a fixtureReplay rule set still constructs");
});


/* ------------------------------------------------------------------ */
/* What the campaign would never have sold you                         */
/* ------------------------------------------------------------------ */

/**
 * The shop's own purchase gate, byte-verified at
 * `docs/integration/ss2-item-tables.md:530-552` from the `onRelease` opcodes
 * at `+0x0929`-`+0x0941`. MEASURED, not authored — which is what makes it
 * cheap to defend and why it is enforced rather than tuned.
 */
test("the shop's gate refuses a weapon the campaign would never have sold", () => {
  // Slashing and ranged gate on SPEED at 3 * band_position.
  assert.throws(
    () => assertSs2WeaponPurchasable({ weapon: 4, speed: 6, strength: 99 }, "Test"),
    (error) => error instanceof TeamRuleSetError && /speed >= 12/.test(error.message),
    "weapon 4 sits at band position 4, so it demands speed 12"
  );
  // ...and strength does NOT substitute for it, which is the half that makes
  // the gate bite on the dump build: pouring everything into strength buys no
  // slashing weapon at all.
  assert.throws(
    () => assertSs2WeaponPurchasable({ weapon: 20, speed: 1, strength: 200 }, "Test"),
    (error) => error instanceof TeamRuleSetError && /speed >= 60/.test(error.message)
  );

  // Hacking and bashing gate on STRENGTH instead.
  assert.throws(
    () => assertSs2WeaponPurchasable({ weapon: 40, speed: 200, strength: 5 }, "Test"),
    (error) => error instanceof TeamRuleSetError && /strength >= 60/.test(error.message)
  );

  // The band boundary itself, both sides of it: band position 1 demands 3.
  assert.equal(assertSs2WeaponPurchasable({ weapon: 21, speed: 0, strength: 3 }, "Test"), undefined);
  assert.throws(
    () => assertSs2WeaponPurchasable({ weapon: 21, speed: 0, strength: 2 }, "Test"),
    (error) => error instanceof TeamRuleSetError && /strength >= 3/.test(error.message),
    "one point below the band's demand must still be refused, and say so by name"
  );
});

test("ranged is refused in the PRIMARY slot, because `buyweapon` never puts it there", () => {
  // ss2-item-tables.md:826-828. Without this the 18 rangeMultiplier-100 rows
  // give a weapon_range in the thousands, which makes any distance check a
  // tautology — and refusing on range alone LEAKS, because ids 65 and 75 are
  // type-4 bows with a range multiplier of 4. Refuse by BAND.
  for (const id of [61, 65, 75, 80]) {
    assert.throws(
      () => assertSs2WeaponPurchasable({ weapon: id, speed: 999, strength: 999 }, "Test"),
      (error) => error instanceof TeamRuleSetError && /ranged band|secondary_weapon/.test(error.message),
      `weapon ${id} must be refused as a primary however good the stats are`
    );
  }
});

test("a combatant that states NO weapon id is untouched, which is what keeps the corpus out of this", () => {
  // Every promoted golden declares its damage pair directly and states no
  // `weapon`. If the gate ever fired on them it would be refusing runtime
  // evidence on the strength of a shop rule, which is backwards.
  assert.equal(assertSs2WeaponPurchasable({ speed: 0, strength: 0 }, "Test"), undefined);
  assert.equal(assertSs2WeaponPurchasable({ weapon: null, speed: 0 }, "Test"), undefined);
  assert.equal(assertSs2WeaponPurchasable({}, "Test"), undefined);
});
