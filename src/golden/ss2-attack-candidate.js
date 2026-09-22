/**
 * Asset-free reconstruction of the licensed SS2 build's physical attack path.
 *
 * This module is deliberately isolated from classicStyleRules. Its output is a
 * static-analysis candidate for golden comparison, not a claim of runtime
 * parity. Only licensed observations should promote a fixture to verified.
 */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clone = (value) => JSON.parse(JSON.stringify(value));

// Byte-verified death() clear order: frozen, burning, poison, life_stolen —
// hero's group first, then villain's, then taunted1/taunted2 per field.
const STATUS_FIELDS = Object.freeze(["frozen", "burning", "poison", "life_stolen"]);
const ENCHANTMENT_STATUS = Object.freeze({
  2: "burning",
  3: "frozen",
  4: "poison",
  5: "life_stolen"
});

const TOP_ARMOUR = Object.freeze([
  ["helmet", "helmet_defence"],
  ["shoulderguard", "shoulderguard_defence"]
]);
const MIDDLE_ARMOUR = Object.freeze([
  ["breastplate", "breastplate_defence"],
  ["gauntlet", "gauntlet_defence"],
  ["greaves", "greaves_defence"]
]);
const LOWER_ARMOUR = Object.freeze([
  ["shinguard", "shinguard_defence"],
  ["boot", "boot_defence"],
  ["shield", "shield_defence"]
]);
const ALL_ARMOUR = Object.freeze([...TOP_ARMOUR, ...MIDDLE_ARMOUR, ...LOWER_ARMOUR]);

export class Ss2CandidateError extends Error {}

function numberField(object, name, fallback = 0) {
  const value = object[name] ?? fallback;
  if (!Number.isFinite(value)) throw new Ss2CandidateError(`${name} must be a finite number.`);
  return value;
}

function initialiseCombatant(combatant) {
  combatant.attack = numberField(combatant, "attack");
  combatant.defence = numberField(combatant, "defence");
  combatant.strength = numberField(combatant, "strength");
  combatant.charisma = numberField(combatant, "charisma");
  combatant.magicka = numberField(combatant, "magicka");
  combatant.shield = numberField(combatant, "shield");
  combatant.helmet = numberField(combatant, "helmet");
  combatant.greaves = numberField(combatant, "greaves");
  combatant.min_damage = numberField(combatant, "min_damage", 1);
  combatant.max_damage = numberField(combatant, "max_damage", combatant.min_damage);
  combatant.character_level = numberField(combatant, "character_level", 1);
  combatant.hitpointsmax = numberField(combatant, "hitpointsmax", combatant.hitpoints ?? 1);
  combatant.hitpoints = numberField(combatant, "hitpoints", combatant.hitpointsmax);
  combatant.armourclass_max = numberField(combatant, "armourclass_max", combatant.armourclass ?? 0);
  combatant.armourclass = numberField(combatant, "armourclass", combatant.armourclass_max);
  combatant.staminamax = numberField(combatant, "staminamax", combatant.staminaleft ?? 0);
  combatant.staminaleft = numberField(combatant, "staminaleft", combatant.staminamax);
  combatant.equipped_weapon = numberField(combatant, "equipped_weapon", 1);
  combatant.weapon_enchantment_type = numberField(combatant, "weapon_enchantment_type");
  combatant.weapon_enchantment_potency = numberField(combatant, "weapon_enchantment_potency");
  combatant.secondary_weapon_enchantment_type = numberField(combatant, "secondary_weapon_enchantment_type");
  combatant.secondary_weapon_enchantment_potency = numberField(combatant, "secondary_weapon_enchantment_potency");
  for (const [piece, defenceField] of ALL_ARMOUR) {
    combatant[piece] = numberField(combatant, piece);
    combatant[defenceField] = numberField(combatant, defenceField);
  }
  combatant.gladiator_dir ??= "right";
  for (const field of STATUS_FIELDS) combatant[field] = Boolean(combatant[field]);
  combatant.taunted1 = Boolean(combatant.taunted1);
  combatant.taunted2 = Boolean(combatant.taunted2);
  return combatant;
}

function roundedChance(ratio, factor) {
  return Math.round(ratio * 100 * factor);
}

/** Statically reconstructed candidate for overlay.attack_chances. */
export function calculateSs2AttackChances(attackerSource, defenderSource) {
  const attacker = initialiseCombatant(clone(attackerSource));
  const defender = initialiseCombatant(clone(defenderSource));
  const attackRatio = (attacker.attack + 9) / (defender.defence + 9);
  const charismaRatio = (attacker.charisma + 9) / (defender.charisma + 9);
  const magickaRatio = (attacker.magicka + 9) / (defender.magicka + 9);
  const rangedShieldAdjustment = (base) => Math.ceil(base * (100 + attacker.shield * 1.5) / 100);
  const bounded = (value) => clamp(value, 1, 99);
  return {
    power: bounded(roundedChance(attackRatio, 0.33)),
    normal: bounded(roundedChance(attackRatio, 0.5)),
    quick: bounded(roundedChance(attackRatio, 0.66)),
    bash: bounded(roundedChance(attackRatio, 0.2)),
    taunt: bounded(roundedChance(charismaRatio, 0.4)),
    bombard: bounded(rangedShieldAdjustment(roundedChance(attackRatio, 0.6))),
    snipe: bounded(rangedShieldAdjustment(roundedChance(attackRatio, 0.9))),
    magicka: roundedChance(magickaRatio, 0.5)
  };
}

function directionProfile(direction, attacker, defender, chances, rolls, transientCritical) {
  if (direction >= 1 && direction <= 4) {
    return {
      chance: chances.quick,
      damage: attacker.min_damage,
      critical: rolls.randomBetween("quick-critical-roll", -20, 20)
    };
  }
  if (direction >= 5 && direction <= 8) {
    return {
      chance: chances.normal,
      damage: rolls.randomBetween("normal-damage-roll", attacker.min_damage, attacker.max_damage),
      critical: rolls.randomBetween("normal-critical-roll", 1, 20)
    };
  }
  if (direction >= 9 && direction <= 12) {
    return {
      chance: chances.power,
      critical: rolls.randomBetween("power-critical-roll", 5, 20),
      damage: attacker.max_damage
    };
  }
  if (direction === 20) {
    let damage = Math.round(attacker.charisma * 4) - defender.charisma;
    if (damage < 1) damage = rolls.randomBetween("taunt-floor-damage-roll", 1, 3);
    return { chance: chances.taunt, damage, critical: 21 };
  }
  if (direction === 21) {
    return {
      chance: chances.bombard,
      critical: rolls.randomBetween("bombard-critical-roll", -20, 20),
      damage: rolls.randomBetween("bombard-damage-roll", attacker.min_damage, attacker.max_damage)
    };
  }
  if (direction === 22) return { chance: chances.snipe, damage: attacker.min_damage, critical: 0 };
  if (direction === 23) {
    if (!Number.isFinite(transientCritical)) {
      throw new Ss2CandidateError(
        "attack_direction 23 does not assign criticalhit; scenario.transient.criticalhit is required."
      );
    }
    return {
      chance: chances.bash,
      damage: Math.ceil(attacker.min_damage / 2),
      critical: transientCritical,
      inheritedCritical: true
    };
  }
  if (direction === 30) {
    let damage = Math.ceil(attacker.max_damage * 1.5);
    if (damage <= 1) damage = attacker.character_level * 10;
    return { chance: chances.normal, damage, critical: 20 };
  }
  throw new Ss2CandidateError(`Unsupported attack_direction: ${direction}`);
}

function armourGroup(direction) {
  if ([1, 5, 8, 9].includes(direction)) return TOP_ARMOUR;
  if ([2, 4, 6, 10, 12].includes(direction)) return MIDDLE_ARMOUR;
  if ([3, 7, 11].includes(direction)) return LOWER_ARMOUR;
  return null;
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function recordMutation(trace, path, before, after, reason) {
  if (valuesEqual(before, after)) return;
  trace.push({
    sequence: trace.length + 1,
    path,
    before: clone(before),
    after: clone(after),
    reason
  });
}

function removeArmourCandidate(defender, direction, rolls, requestIndex, mutationTrace, defenderSide) {
  // The build's order in each piece branch of `remove_armour` (overlay frame
  // 52 `DoAction@0x23d7fe`): take the defence out of both pools ONCE, launch
  // the piece's debris clips — two for a paired piece, left limb then right,
  // one otherwise (`DEBRIS_CLIPS_PER_PIECE`), three draws apiece — zero the
  // piece, then the trailing clamp. The helpers are defined at the END of this
  // module, so the line numbers other files cite below this function stay put.
  const group = armourGroup(direction);
  if (!group) {
    // No group matched: on the physical path, directions 20-23 and 30. The
    // three group tests' miss branches chain
    // `+0x02ee` -> `+0x0595` -> `+0x0986`, and `+0x09b6` jumps to `+0x0d4d`:
    // nothing is drawn, and the trailing clamp still runs. It can only write
    // here when an armour total arrives negative, which by the battle map's
    // writer census (§`check_stats` is a pure clamp, and the `armourclass_max`
    // bullet above it) play should not produce, so a staged value is what
    // reaches it. Corrected 2026-09-22: this used to return before the clamp.
    clampRemovalArmour(defender, mutationTrace, defenderSide);
    return { request: requestIndex, selected: null, removed: false };
  }
  const selection = rolls.randomBetween(`armour-selection-${requestIndex}`, 1, group.length);
  const [piece, defenceField] = group[selection - 1];
  const equipped = numberField(defender, piece);
  const defence = numberField(defender, defenceField);
  const removed = equipped !== 0;
  if (removed) {
    const armourBefore = defender.armourclass;
    defender.armourclass -= defence;
    recordMutation(
      mutationTrace,
      `/${defenderSide}/armourclass`,
      armourBefore,
      defender.armourclass,
      "remove-armour-piece"
    );
    const maximumBefore = defender.armourclass_max;
    defender.armourclass_max -= defence;
    recordMutation(
      mutationTrace,
      `/${defenderSide}/armourclass_max`,
      maximumBefore,
      defender.armourclass_max,
      "remove-armour-piece"
    );
  }
  // One entry per debris clip, in launch order; null when nothing was
  // destroyed. `armour-debris-N` is the N-th clip, NOT the request index: a
  // shoulderguard is `armour-selection-1`, then `armour-debris-1-*` and `-2-*`.
  // Counting per removal suffices: only direction 30 makes two removal
  // requests and it is in no group, so N is unique on the attack's tape.
  // (If a second request could ever reach a group, N would have to count on.)
  let debrisRolls = null;
  if (removed) {
    debrisRolls = [];
    for (let clip = 1; clip <= DEBRIS_CLIPS_PER_PIECE[piece]; clip += 1) {
      // Clip 1 is attached at the left limb, clip 2 at the right.
      debrisRolls.push(drawDebrisClip(defender, rolls, clip));
    }
    defender[piece] = 0;
    recordMutation(mutationTrace, `/${defenderSide}/${piece}`, equipped, 0, "remove-armour-piece");
  }
  clampRemovalArmour(defender, mutationTrace, defenderSide);
  return {
    request: requestIndex,
    selected: piece,
    removed,
    defenceRemoved: removed ? defence : 0,
    debrisRolls
  };
}

/**
 * Which enchantment the attacker's equipped weapon applies.
 *
 * ## The potency is the PRIMARY field in both branches, and that is correct
 *
 * This reads like a bug and is not one. It has now been flagged as a bug once,
 * so the bytes are recorded here rather than left to be re-derived by whoever
 * flags it next. In `damagecharacter`
 * (`sprite:862[overlay]/frame:52/DoAction@0x240c7f`) the build does:
 *
 * ```
 * +0x1bf1  magicweapon_percentage = randomBetween(1, 100)
 * +0x1c09  push magicweapon_percentage
 * +0x1c0f  push game_attacker.weapon_enchantment_potency   <-- PRIMARY, always
 * +0x1c17  push 10 ; Multiply
 * +0x1c20  Less2 ; Not
 * +0x1c22  If -> +0x1dd3                                   (skip all four arms)
 * ```
 *
 * The potency gate is HOISTED OUT of, and evaluated BEFORE, the first
 * `equipped_weapon` test at `+0x1c27`. `secondary_weapon_enchantment_potency`
 * is read **nowhere** in `damagecharacter` — verified by census: the variable
 * `magicweapon_percentage` occurs exactly twice in the whole build, one write
 * and one read, so there is exactly one enchantment roll and it is this one.
 * `docs/integration/ss2-battle-map.md` says the same in prose.
 *
 * Re-derive with:
 * `node tools/inspect-swf.mjs <ss2.swf> --references 'weapon_enchantment_potency' --around 34`
 *
 * (`secondary_weapon_enchantment_potency` IS used by the build, but for magic
 * DAMAGE, not for this proc: `battlevalues +0x3326` sets
 * `secondary_weapon_enchantment_damage = ceil(secondary_weapon_max_damage / 3 *
 * secondary_weapon_enchantment_potency)`. That whole damage path is unmodelled
 * here — see the gap noted in `src/team/ss2-rules.js`'s header.)
 *
 * ## What WAS wrong: the fallback
 *
 * Each of the four status arms is
 * `(equipped_weapon == 1 && weapon_enchantment_type == N) ||
 *  (equipped_weapon == 2 && secondary_weapon_enchantment_type == N)`
 * — `+0x1c27`/`+0x1c58` for N=2 burning, and the same pair again at
 * `+0x1cab`/`+0x1cdc` (3, frozen), `+0x1d16`/`+0x1d47` (4, poison) and
 * `+0x1d81`/`+0x1db2` (5, life_stolen). Both conjuncts are false for any other
 * `equipped_weapon`, so the build applies NO status.
 *
 * This function used to treat every value other than 2 as the primary weapon,
 * so `equipped_weapon` 0 or 3 applied the primary enchantment where the build
 * applies nothing. Corrected 2026-09-02. No fixture reaches it — all 12
 * `equipped_weapon` values in the corpus are 1, and `numberField` defaults the
 * rest to 1 — so this changes no measured evidence; it removes a divergence
 * that a future armoured or enchanted capture could have hit.
 *
 * The caller draws the roll unconditionally either way, so the RNG stream is
 * unaffected by returning a null type here.
 */
function activeEnchantment(attacker) {
  const potency = attacker.weapon_enchantment_potency;
  if (attacker.equipped_weapon === 1) {
    return { type: attacker.weapon_enchantment_type, potency };
  }
  if (attacker.equipped_weapon === 2) {
    return { type: attacker.secondary_weapon_enchantment_type, potency };
  }
  return { type: null, potency };
}

function clearDeathState(scenario, mutationTrace) {
  for (const side of ["hero", "villain"]) {
    for (const field of STATUS_FIELDS) {
      const before = scenario[side][field];
      scenario[side][field] = false;
      recordMutation(mutationTrace, `/${side}/${field}`, before, false, "death-status-clear");
    }
  }
  for (const field of ["taunted1", "taunted2"]) {
    for (const side of ["hero", "villain"]) {
      const before = scenario[side][field];
      scenario[side][field] = false;
      recordMutation(mutationTrace, `/${side}/${field}`, before, false, "death-taunt-clear");
    }
  }
}

function clampCombatant(combatant, mutationTrace, side) {
  const hitpointsBefore = combatant.hitpoints;
  combatant.hitpoints = clamp(combatant.hitpoints, 0, combatant.hitpointsmax);
  recordMutation(mutationTrace, `/${side}/hitpoints`, hitpointsBefore, combatant.hitpoints, "stat-clamp");
  const armourBefore = combatant.armourclass;
  combatant.armourclass = clamp(combatant.armourclass, 0, combatant.armourclass_max);
  recordMutation(mutationTrace, `/${side}/armourclass`, armourBefore, combatant.armourclass, "stat-clamp");
  const staminaBefore = combatant.staminaleft;
  combatant.staminaleft = clamp(combatant.staminaleft, 0, combatant.staminamax);
  recordMutation(mutationTrace, `/${side}/staminaleft`, staminaBefore, combatant.staminaleft, "stat-clamp");
}

function projectCombatant(combatant) {
  const projection = {
    hitpoints: combatant.hitpoints,
    armourclass: combatant.armourclass,
    armourclass_max: combatant.armourclass_max,
    staminaleft: combatant.staminaleft,
    burning: combatant.burning,
    frozen: combatant.frozen,
    poison: combatant.poison,
    life_stolen: combatant.life_stolen,
    taunted1: combatant.taunted1,
    taunted2: combatant.taunted2
  };
  for (const [piece] of ALL_ARMOUR) projection[piece] = combatant[piece];
  return projection;
}

function projectState(scenario) {
  return {
    hero: projectCombatant(scenario.hero),
    villain: projectCombatant(scenario.villain),
    result: scenario.result ?? null
  };
}

function createResult(attackerSide, defenderSide, reason, howDied) {
  const arenaLabel = attackerSide === "hero" ? "combat_won" : "combat_lost";
  return {
    status: "pending-animation",
    completionToken: `ss2-1v1:${attackerSide}:${defenderSide}:${arenaLabel}`,
    winnerSide: attackerSide,
    loserSide: defenderSide,
    reason,
    howDied,
    overlayLabel: attackerSide === "hero" ? "combatwon" : "combatlost",
    arenaLabel
  };
}

/** Byte-verified non-duel death dispatch by attack_direction. */
function deathHowDiedFor(direction) {
  if (direction <= 12) return "slain";
  if (direction === 20) return "taunt";
  if (direction >= 21 && direction <= 23) return "arrow";
  if (direction === 30) return "grievous";
  throw new Ss2CandidateError(
    `attack_direction ${direction} reaches the defeat block with no death dispatch arm.`
  );
}

/**
 * Resolves one mapped physical attack with a strict ordered-roll tape.
 * The passed scenario is intentionally mutated; the generic harness supplies a
 * deep clone so fixture input remains immutable.
 */
export function resolveSs2PhysicalAttackCandidate(scenario, rolls) {
  if (!scenario || typeof scenario !== "object") throw new Ss2CandidateError("scenario must be an object.");
  if (scenario.result) throw new Ss2CandidateError("The 1v1 result has already been set.");
  const attackerSide = scenario.attackerSide;
  if (attackerSide !== "hero" && attackerSide !== "villain") {
    throw new Ss2CandidateError("attackerSide must be hero or villain.");
  }
  const defenderSide = attackerSide === "hero" ? "villain" : "hero";
  const attacker = initialiseCombatant(scenario[attackerSide]);
  const defender = initialiseCombatant(scenario[defenderSide]);
  const direction = Number(scenario.attackDirection);
  if (!Number.isInteger(direction)) throw new Ss2CandidateError("attackDirection must be an integer.");
  // Byte-verified and observed live: the defeat gate depends on the fight
  // mode. Absent fightMode means "tournament", the mode whose only defeat
  // condition is hitpoints <= 0 (the implicit assumption of the earlier
  // static-only candidates).
  const fightMode = scenario.fightMode ?? "tournament";
  if (fightMode !== "tournament" && fightMode !== "duel" && fightMode !== "misc") {
    throw new Ss2CandidateError("fightMode must be tournament, duel, or misc.");
  }

  const chances = calculateSs2AttackChances(attacker, defender);
  const diceroll = rolls.randomBetween("hit-roll", 1, 100);
  const profile = directionProfile(
    direction,
    attacker,
    defender,
    chances,
    rolls,
    scenario.transient?.criticalhit
  );
  const selectedDamage = Math.ceil(profile.damage);
  const rollNeeded = 100 - profile.chance;
  const hit = diceroll >= rollNeeded;

  const calculation = {
    attackDirection: direction,
    chance: profile.chance,
    rollNeeded,
    diceroll,
    hit,
    selectedDamage,
    criticalSample: profile.critical,
    inheritedCritical: Boolean(profile.inheritedCritical)
  };

  if (!hit) {
    return {
      calculation,
      mutation: {
        armourDamage: 0,
        hitpointDamage: 0,
        staminaBonus: 0,
        armourRemovalRoll: null,
        armourRemovals: [],
        knockback: null,
        enchantmentRoll: null,
        statusApplied: null
      },
      mutationTrace: [],
      resultEvent: null,
      state: projectState(scenario)
    };
  }

  const deflectionRoll = rolls.randomBetween("critical-deflection-roll", 1, 100);
  const deflectionThreshold = (100 - defender.helmet * 1.5) + defender.greaves;
  const criticalCleared = direction !== 30 && deflectionRoll >= deflectionThreshold;
  const criticalSample = criticalCleared ? 0 : profile.critical;
  const dispatchedMethod = direction === 30
    ? "grievous"
    : direction === 20
      ? "taunt"
      : criticalSample === 20
        ? "critical"
        : "normal";
  const effectiveMethod = dispatchedMethod === "taunt" ? "normal" : dispatchedMethod;
  calculation.deflectionRoll = deflectionRoll;
  calculation.deflectionThreshold = deflectionThreshold;
  calculation.criticalCleared = criticalCleared;
  calculation.criticalSampleAfterDeflection = criticalSample;
  calculation.dispatchedMethod = dispatchedMethod;
  calculation.effectiveDamageMethod = effectiveMethod;

  const armourRemovalRoll = rolls.randomBetween("armour-removal-roll", 1, 100);
  const mutationTrace = [];
  const removalRequests = (effectiveMethod === "grievous" ? 1 : 0) + (armourRemovalRoll > 66 ? 1 : 0);
  const armourRemovals = [];
  for (let request = 1; request <= removalRequests; request += 1) {
    armourRemovals.push(
      removeArmourCandidate(defender, direction, rolls, request, mutationTrace, defenderSide)
    );
  }

  const armourBeforeDamage = defender.armourclass;
  const hitpointsBeforeDamage = defender.hitpoints;
  let vanillaDamageRegister = selectedDamage;
  let hitpointDamage = selectedDamage;
  let healthPathEntered = true;
  if ((effectiveMethod === "normal" || effectiveMethod === "grievous") && defender.armourclass > 0) {
    const armourTemporary = defender.armourclass;
    const armourBefore = defender.armourclass;
    defender.armourclass -= selectedDamage;
    recordMutation(
      mutationTrace,
      `/${defenderSide}/armourclass`,
      armourBefore,
      defender.armourclass,
      "physical-damage"
    );
    if (defender.armourclass < 0) vanillaDamageRegister = selectedDamage - armourTemporary;
    healthPathEntered = defender.armourclass <= 0;
    hitpointDamage = healthPathEntered ? vanillaDamageRegister : 0;
  }
  if (hitpointDamage > 0) {
    const hitpointsBefore = defender.hitpoints;
    defender.hitpoints -= hitpointDamage;
    recordMutation(
      mutationTrace,
      `/${defenderSide}/hitpoints`,
      hitpointsBefore,
      defender.hitpoints,
      "physical-damage"
    );
  }
  // Byte-verified 2026-08-30: the breastplate stamina block is an
  // unconditional join in the mapped ingress — the absorbed-armour skip
  // branch jumps directly into it — so fully absorbed damage still grants
  // stamina from the undiminished damage register.
  const staminaBonus = Math.ceil(defender.breastplate * vanillaDamageRegister / 100);
  if (staminaBonus !== 0) {
    const staminaBefore = defender.staminaleft;
    defender.staminaleft += staminaBonus;
    recordMutation(
      mutationTrace,
      `/${defenderSide}/staminaleft`,
      staminaBefore,
      defender.staminaleft,
      "breastplate-stamina"
    );
  }
  clampCombatant(defender, mutationTrace, defenderSide);

  // Byte-verified defeat gate, observed live twice: enter iff hitpoints <= 0
  // OR (hitpoints < hitpointsmax AND the mode is not tournament) — the
  // second term is the first-blood rule; duels always die by "yield".
  let resultEvent = null;
  const eliminated = defender.hitpoints <= 0;
  const firstBlood = !eliminated &&
    defender.hitpoints < defender.hitpointsmax &&
    fightMode !== "tournament";
  if (eliminated || firstBlood) {
    clearDeathState(scenario, mutationTrace);
    const resultBefore = scenario.result ?? null;
    scenario.result = createResult(
      attackerSide,
      defenderSide,
      eliminated ? "elimination" : "first-blood",
      fightMode === "duel" ? "yield" : deathHowDiedFor(direction)
    );
    recordMutation(mutationTrace, "/result", resultBefore, scenario.result, "battle-result-pending");
    resultEvent = { type: "battle-result-pending", ...scenario.result };
  }

  let knockback = null;
  if ((direction >= 5 && direction <= 12) || direction === 30) {
    const knockbackRoll = rolls.randomBetween("knockback-roll", 1, 4);
    if (knockbackRoll > 3 || direction === 30) {
      // Byte-verified: the vanilla force reads the timeline-aliased damage
      // register AFTER the armour-overflow rewrite, so an overflowing hit
      // knocks back with the overflow remainder, not the selected damage.
      const magnitude = Math.max(20, vanillaDamageRegister + attacker.strength * 6);
      const force = defender.gladiator_dir === "left" ? magnitude : -magnitude;
      // ► **`animation` IS A BYTE-EXACT CONDITION FOR A CLIP THAT NEVER
      //   PLAYS — derived 2026-09-17, recorded rather than removed.** The
      //   threshold 80 is real (`+0x1b40`/`+0x1bb1`) and so is the
      //   `gotoAndPlay("knockback")` it gates (`+0x1b4f`/`+0x1bc0`). But
      //   `defender_hurt` calls `damagecharacter` at `+0x211e` and then calls
      //   `defender.gotoAndPlay(animstate)` at `+0x2120`-`+0x2136` on the same
      //   clip in the same frame, so the knockback clip is overwritten by
      //   `"hurt5"`..`"hurt12"` immediately — and at direction 30 `animstate`
      //   is `"knockback"` anyway. **Nothing may build a presentation on this
      //   field**; it is kept because it is what the bytes say, and deleting a
      //   derived condition because its effect is invisible is how a
      //   measurement becomes an opinion.
      knockback = { roll: knockbackRoll, force, animation: Math.abs(force) > 80 };
    } else {
      knockback = { roll: knockbackRoll, force: null, animation: false };
    }
  }

  const enchantmentRoll = rolls.randomBetween("enchantment-potency-roll", 1, 100);
  const enchantment = activeEnchantment(attacker);
  const statusApplied = enchantmentRoll < enchantment.potency * 10
    ? ENCHANTMENT_STATUS[enchantment.type] ?? null
    : null;
  if (statusApplied) {
    const statusBefore = defender[statusApplied];
    defender[statusApplied] = true;
    recordMutation(
      mutationTrace,
      `/${defenderSide}/${statusApplied}`,
      statusBefore,
      true,
      "weapon-enchantment"
    );
  }

  return {
    calculation,
    mutation: {
      armourDamage: armourBeforeDamage - defender.armourclass,
      hitpointDamage: hitpointsBeforeDamage - defender.hitpoints,
      staminaBonus,
      armourRemovalRoll,
      armourRemovals,
      knockback,
      enchantmentRoll,
      statusApplied
    },
    mutationTrace,
    resultEvent,
    state: projectState(scenario)
  };
}

/** One-shot bridge for the final animation acknowledgement. */
export function createOneShotResultBridge(callback) {
  if (typeof callback !== "function") throw new Ss2CandidateError("A result callback is required.");
  let delivered = false;
  return {
    acknowledge(event, acknowledgement) {
      if (
        !event ||
        event.type !== "battle-result-pending" ||
        typeof event.completionToken !== "string" ||
        event.completionToken.length === 0
      ) {
        throw new Ss2CandidateError("Expected a battle-result-pending event with a completion token.");
      }
      if (
        !acknowledgement ||
        acknowledgement.type !== "battle-result-animation-complete" ||
        typeof acknowledgement.completionToken !== "string" ||
        acknowledgement.completionToken.length === 0 ||
        acknowledgement.completionToken !== event.completionToken
      ) {
        throw new Ss2CandidateError("A matching battle-result-animation-complete acknowledgement is required.");
      }
      if (delivered) return false;
      delivered = true;
      callback(clone(event));
      return true;
    },
    get delivered() {
      return delivered;
    }
  };
}

/* ------------------------------------------------------------------------ *
 * `remove_armour`'s debris clips and trailing clamp, used by
 * `removeArmourCandidate` above. Defined last so that adding them shifted no
 * line after that function, where other files cite this module by line.
 * ------------------------------------------------------------------------ */

/**
 * How many debris clips `remove_armour` launches when it destroys each piece.
 *
 * Every piece's branch attaches one `item_to_destroy` clip at a limb and calls
 * `destroy_armour` on it; a PAIRED piece does that twice, unconditionally, left
 * limb then right, and `destroy_armour` makes three draws per call. So a paired
 * piece is six debris draws and a single piece three. The `destroy_armour`
 * CallFunction offsets (overlay frame 52 `DoAction@0x23d7fe`), with the limb
 * each clip is attached at:
 *
 *   helmet         +0x03c5 head
 *   shoulderguard  +0x0500 Lupperarm, +0x056e Rupperarm
 *   breastplate    +0x06c1 torso
 *   gauntlet       +0x07a2 Llowerarm, +0x0810 Rlowerarm
 *   greaves        +0x08f1 Lupperleg, +0x095f Rupperleg
 *   shinguard      +0x0a8d Llowerleg, +0x0afb Rlowerleg
 *   boot           +0x0bdc Lfoot,     +0x0c4a Rfoot
 *   shield         +0x0d2b Rlowerarm
 *
 * 13 calls in all. The defence is subtracted ONCE per piece, ahead of both
 * calls (e.g. shoulderguard `+0x0477`-`+0x04a2`), so the clip count moves the
 * RNG stream and nothing else.
 *
 * ► **Corrected 2026-09-22.** This module used to draw ONE triple per removed
 *   piece, so every paired piece was three draws short. No golden could see it:
 *   none destroys a piece, and for a right- or left-facing defender the draws
 *   are RandomNumber opcodes the pipeline neither records nor compares. But the
 *   team engine resolves every physical attack through this function on its
 *   own tape, and for any other facing the first draw is a tape-consuming
 *   `randomBetween`.
 */
const DEBRIS_CLIPS_PER_PIECE = Object.freeze({
  helmet: 1,
  shoulderguard: 2,
  breastplate: 1,
  gauntlet: 2,
  greaves: 2,
  shinguard: 2,
  boot: 2,
  shield: 1
});

/**
 * One `destroy_armour` call: exactly three draws at call time, in this order
 * (overlay frame 52 `DoAction@0x23d7fe`):
 *
 *   +0x0dfb  xspeed = -30 + RandomNumber(20)        facing "right"
 *   +0x0e28  xspeed =  10 + RandomNumber(30)        facing "left"
 *   +0x0e30  xspeed = randomBetween(-30, 60)        any other facing
 *   +0x0e5b  dy = -40 + RandomNumber(20)
 *   +0x0e6f  rotationspeed = -5 + RandomNumber(5)
 *
 * The `onEnterFrame` closure it installs (`+0x0e86`) draws nothing. `clip` is
 * the clip's 1-based ordinal (see `removeArmourCandidate` for why that is also
 * its ordinal in the attack), and is the `N` of `armour-debris-N-*` — the
 * grammar `observation.js`'s cosmetic-debris predicate recognises, so a second
 * clip is excluded from comparison exactly as the first always was.
 */
function drawDebrisClip(defender, rolls, clip) {
  const prefix = `armour-debris-${clip}`;
  const horizontal = defender.gladiator_dir === "right"
    ? { source: "randomNumber", value: rolls.randomNumber(`${prefix}-x`, 20) }
    : defender.gladiator_dir === "left"
      ? { source: "randomNumber", value: rolls.randomNumber(`${prefix}-x`, 30) }
      : { source: "randomBetween", value: rolls.randomBetween(`${prefix}-x`, -30, 60) };
  return {
    horizontal,
    vertical: rolls.randomNumber(`${prefix}-y`, 20),
    rotation: rolls.randomNumber(`${prefix}-rotation`, 5)
  };
}

/**
 * `remove_armour`'s trailing zero-clamp (`+0x0d4d`-`+0x0da4`): `armourclass`,
 * then `armourclass_max`, each floored at 0 when below it. Every path through
 * the function ends here, including a direction that matches no piece group.
 */
function clampRemovalArmour(defender, mutationTrace, defenderSide) {
  const unclampedArmour = defender.armourclass;
  defender.armourclass = Math.max(0, defender.armourclass);
  recordMutation(
    mutationTrace,
    `/${defenderSide}/armourclass`,
    unclampedArmour,
    defender.armourclass,
    "remove-armour-clamp"
  );
  const unclampedMaximum = defender.armourclass_max;
  defender.armourclass_max = Math.max(0, defender.armourclass_max);
  recordMutation(
    mutationTrace,
    `/${defenderSide}/armourclass_max`,
    unclampedMaximum,
    defender.armourclass_max,
    "remove-armour-clamp"
  );
}
