/**
 * `aiCharges` — the AI opponent that winds up for a grievous blow.
 *
 * WHY THIS FILE EXISTS: `psyche_up` shipped on 2026-09-16 with a live
 * population of ZERO outside human play. Measured before this arm existed: 20
 * AI-vs-AI bouts, 6,000 actions, the verb chosen **0 times** — so the action,
 * its three clips, the charged stance and its glow were all unreachable unless
 * a person pressed the button. `suggestAction` is keyed on `ATTACK_BANDS` and
 * this action deliberately is not a band.
 *
 * WHAT IS THE BUILD'S AND WHAT IS THIS ENGINE'S — the split matters more here
 * than usual, because almost all of it is this engine's:
 *
 * - **The build's**: that `psyche_up` is wired at `herolevel >= 7` on the
 *   warrior controller frames and `>= 3` on the archer ones; that the discharge
 *   rolls at `chances.normal` for `ceil(max_damage * 1.5)`
 *   (`directionProfile`'s `direction === 30` arm); that the range gate is
 *   `round(reach + 50)`; and that every decision which is not `psyche_up`
 *   resets the counter.
 * - **THIS ENGINE'S, and invented**: the whole policy. When to begin a charge,
 *   the full-health gate, the finisher override, and the decision to ship it
 *   OFF. `suggestAction`'s own provenance note already says "the AI's choice
 *   among the three melee verbs is invented; only its stamina gates are
 *   byte-decoded", and this is more of the same.
 *
 * ► **AND THE MEASUREMENT THAT SHAPED IT: CHARGING IS A LOSING MOVE.** Damage
 *   per actor turn over 40 seeded bouts, an even level-9 pair: quick 17.82,
 *   normal 15.26, charge-and-discharge 11.53, power 11.44. So this is a
 *   CHARACTER and not an optimisation, and the flag says so.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, createTeamBattle, currentCombatant, legalActions, rngJournal, suggestAction, toTeamWireState
} from "../src/team/index.js";
import { SS2_PSYCHE_UP, Ss2ActionType, createSs2TeamRules, ss2Combatant } from "../src/team/ss2-rules.js";
import { stanceLabelFor } from "../src/render/stance.js";

/**
 * The melee and ranged verbs, spelled out here because `ATTACK_BANDS` is
 * module-private — deliberately, and this file does not export it to get at it.
 * A list that drifts from the real one makes `close()` stop closing, which
 * fails loudly rather than silently passing.
 */
const ATTACK_VERBS = Object.freeze([
  Ss2ActionType.QUICK_ATTACK, Ss2ActionType.NORMAL_ATTACK, Ss2ActionType.POWER_ATTACK,
  Ss2ActionType.BASH_ATTACK, Ss2ActionType.BOMBARD, Ss2ActionType.SNIPE
]);

/** Level 9, so the warrior frame's `herolevel >= 7` gate is open. */
const gladiator = (overrides = {}) => ss2Combatant({
  strength: 9, speed: 40, attack: 9, defence: 5, vitality: 60, stamina: 40,
  magicka: 0, charisma: 3, herolevel: 9, character_level: 9, weapon: 1,
  psyche_up: SS2_PSYCHE_UP.floor, ...overrides
});

function duel({ aiCharges = false, seed = 3, hero = {}, villain = {} } = {}) {
  return createTeamBattle({
    rules: createSs2TeamRules({ aiCharges }), seed,
    teams: [
      { id: "red", combatants: [{ id: "hero", ...gladiator(hero) }] },
      { id: "blue", combatants: [{ id: "villain", ...gladiator(villain) }] }
    ]
  });
}

/** Walk both sides together until a melee verb is on offer. */
function close(battle) {
  for (let guard = 0; guard < 60; guard += 1) {
    const who = currentCombatant(battle);
    if (!who) return false;
    const legal = legalActions(battle);
    if (legal.some((option) => ATTACK_VERBS.includes(option.type))) return true;
    const toward = who.id === "hero" ? Ss2ActionType.WALK_RIGHT : Ss2ActionType.WALK_LEFT;
    const step = legal.find((option) => option.type === toward) ?? legal[0];
    applyAction(battle, { actorId: who.id, ...step });
  }
  return false;
}

/** What the AI picks for whoever's turn it is, without applying it. */
const picks = (battle) => suggestAction(battle)?.type ?? null;

/** Drive a bout with the AI on both sides and tally what it chose. */
function sweep({ aiCharges, seeds = [1, 2, 3, 4, 5, 6, 7, 8], hero = {}, villain = {} }) {
  let actions = 0;
  let charges = 0;
  for (const seed of seeds) {
    const battle = duel({ aiCharges, seed, hero, villain });
    for (let turn = 0; turn < 200; turn += 1) {
      const who = currentCombatant(battle);
      if (!who) break;
      const chosen = suggestAction(battle);
      if (!chosen) break;
      applyAction(battle, { actorId: who.id, ...chosen });
      actions += 1;
      if (chosen.type === Ss2ActionType.PSYCHE_UP) charges += 1;
    }
  }
  return { actions, charges };
}

/* ------------------------------------------------------------------ *
 * OFF BY DEFAULT, AND THAT IS THE SAFETY PROPERTY
 * ------------------------------------------------------------------ */

test("THE DEFAULT AI STILL NEVER CHARGES, which is what keeps every pinned hash", () => {
  // ► **THE ASSERTION THAT COULD HAVE VARIED.** A change to `suggestAction`
  //   reaches every AI decision in the project — every census, every seeded
  //   replay, every golden taken through the arena host. "The charging AI
  //   charges" would be satisfied by a change that also moved the default one.
  const off = sweep({ aiCharges: false });
  assert.ok(off.actions > 200, `only ${off.actions} actions; the sweep must exercise the AI`);
  assert.equal(off.charges, 0, "the default AI must choose the verb exactly as often as before: never");
});

test("the id names the trait, or two peers diverge at the first charge", () => {
  // ► **`toTeamWireState` CARRIES ONLY THE ID INTO THE HASH.** Two peers
  //   running different AI policies would otherwise agree on every hash and
  //   then diverge the first time one of them wound up — the same argument
  //   `crowdPatience` and `rankStride` are in the id for.
  assert.equal(createSs2TeamRules().id, "ss2-map-derived-tournament");
  assert.equal(createSs2TeamRules({ aiCharges: false }).id, "ss2-map-derived-tournament");
  assert.equal(createSs2TeamRules({ aiCharges: true }).id, "ss2-map-derived-tournament-charges");
});

test("`psyche_up` IS STILL NOT AN ATTACK BAND, and that must survive this arm", () => {
  // ► **THE LOAD-BEARING DECISION THE WHOLE ACTION TURNS ON, and teaching the
  //   AI to charge is exactly the change that would tempt someone to undo it.**
  //   Band membership means "always attacks"; two of three presses draw
  //   nothing, so an entry would put samples on the ordered channel the build
  //   never takes and desynchronise every peer replaying the same tape.
  //
  //   `ATTACK_BANDS` is module-private, so this asserts the CONSEQUENCE rather
  //   than the table — which is the better assertion anyway, because it would
  //   also catch a band added under another name.
  const battle = duel({ aiCharges: true });
  assert.ok(close(battle));
  for (let guard = 0; guard < 8 && currentCombatant(battle)?.id !== "hero"; guard += 1) {
    const who = currentCombatant(battle);
    const legal = legalActions(battle);
    applyAction(battle, { actorId: who.id, ...(legal.find((o) => o.type === Ss2ActionType.REST) ?? legal[0]) });
  }
  const before = rngJournal(battle).length;
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.PSYCHE_UP, targetId: "villain" });
  assert.equal(rngJournal(battle).length, before,
    "a charging press must take NO sample, or every peer replaying the tape desynchronises");
});

/* ------------------------------------------------------------------ *
 * WHAT IT DOES WHEN IT IS ON
 * ------------------------------------------------------------------ */

test("A CHARGING AI CHARGES, and the control is the same bouts with it off", () => {
  const on = sweep({ aiCharges: true });
  const off = sweep({ aiCharges: false });
  assert.ok(on.charges > 0, "the whole point of the flag");
  assert.equal(off.charges, 0);
});

test("A READY CHARGE IS TAKEN, because it is the best swing on the table", () => {
  // ► **ARITHMETIC, NOT PREFERENCE.** The discharge rolls at `chances.normal`
  //   for `1.5 * max_damage`, so it beats `normal_attack` by half again at the
  //   same chance and strictly dominates `power_attack`, which rolls
  //   `max_damage` at the worse `chances.power`. **And not firing forfeits
  //   it**: every decision that is not `psyche_up` resets the counter.
  // ► **THE CHARGE HAS TO BE BUILT AFTER CLOSING, NOT BEFORE.** Walking is a
  //   decision that is not `psyche_up`, so it RESETS the counter — a staged
  //   `psyche_up: 3` is back at the floor by the time the pair are in reach.
  //   That is the rule this whole action turns on, and it caught this test.
  const battle = duel({ aiCharges: true });
  assert.ok(close(battle), "the pair must reach melee or this proves nothing");
  const counterOf = (id) => toTeamWireState(battle).teams
    .flatMap((team) => team.combatants).find((c) => c.id === id).resources.psyche_up?.value;
  for (let guard = 0; guard < 30 && counterOf("hero") !== SS2_PSYCHE_UP.dischargeAt; guard += 1) {
    const who = currentCombatant(battle);
    if (!who) break;
    const legal = legalActions(battle);
    const press = who.id === "hero"
      ? legal.find((o) => o.type === Ss2ActionType.PSYCHE_UP)
      : legal.find((o) => o.type === Ss2ActionType.REST);
    applyAction(battle, { actorId: who.id, ...(press ?? legal[0]) });
  }
  assert.equal(counterOf("hero"), SS2_PSYCHE_UP.dischargeAt, "the hero must be fully charged");
  for (let guard = 0; guard < 8 && currentCombatant(battle)?.id !== "hero"; guard += 1) {
    const who = currentCombatant(battle);
    const legal = legalActions(battle);
    applyAction(battle, { actorId: who.id, ...(legal.find((o) => o.type === Ss2ActionType.REST) ?? legal[0]) });
  }
  assert.equal(currentCombatant(battle)?.id, "hero");
  assert.equal(counterOf("hero"), SS2_PSYCHE_UP.dischargeAt, "and still charged when it is his turn");
  assert.equal(picks(battle), Ss2ActionType.PSYCHE_UP, "a ready charge must be spent");
});

test("A WOUNDED GLADIATOR FIGHTS RATHER THAN WINDING UP", () => {
  // ► **THE GATE IS FULL HEALTH, AND IT IS THE RIGHT SHAPE RATHER THAN A
  //   CONVENIENT ONE**: taking a blow RESETS the charge, so the moment a
  //   gladiator is wounded is the moment a wind-up stops being likely to pay.
  //   A fraction would have been an invented constant; this is not.
  //
  //   **Staged rather than fought for.** A first version drove a bout until
  //   somebody happened to be wounded and uncharged, and fell back to
  //   `assert.ok(true)` when no seed produced it — which the suite's own
  //   constant-truthy check caught, correctly: a test that can pass without
  //   asserting anything is worse than no test. The pair is built into the
  //   state instead, so the comparison always runs.
  const wound = (battle, id) => {
    const combatant = battle.teams.flatMap((team) => team.combatants).find((c) => c.id === id);
    combatant.health = Math.max(1, combatant.maxHealth - 1);
  };
  const decide = ({ wounded }) => {
    const battle = duel({ aiCharges: true });
    assert.ok(close(battle), "the pair must reach melee or this proves nothing");
    for (let guard = 0; guard < 8 && currentCombatant(battle)?.id !== "hero"; guard += 1) {
      const who = currentCombatant(battle);
      const legal = legalActions(battle);
      applyAction(battle, { actorId: who.id, ...(legal.find((o) => o.type === Ss2ActionType.REST) ?? legal[0]) });
    }
    assert.equal(currentCombatant(battle)?.id, "hero");
    if (wounded) wound(battle, "hero");
    const hero = toTeamWireState(battle).teams[0].combatants[0];
    assert.equal(hero.resources.psyche_up.value, SS2_PSYCHE_UP.floor, "the hero must be at the floor");
    assert.equal(hero.health < hero.maxHealth, wounded, "the staging must have taken");
    return picks(battle);
  };
  // ► **THE CONTROL IS THE SAME GLADIATOR UNWOUNDED**, so this cannot pass
  //   because the AI declined to charge for some unrelated reason.
  assert.equal(decide({ wounded: false }), Ss2ActionType.PSYCHE_UP, "a whole gladiator winds up");
  assert.notEqual(decide({ wounded: true }), Ss2ActionType.PSYCHE_UP,
    "a wounded one fights, because the next blow would take the charge anyway");
});

test("ACROSS THE ARENA IT CLOSES RATHER THAN WINDING UP, and the MOVEMENT arm is why", () => {
  // ► **I GUARDED THIS ON A RANGE TEST AND THE RANGE TEST WAS DEAD CODE.** The
  //   reasoning was sound — a press out of range decides nothing and keeps the
  //   charge, so a gladiator who cannot reach anybody could wind up forever —
  //   but `suggestAction`'s `!attackOnOffer` arm RETURNS a step before the
  //   ranking ever runs, so the case cannot arise. Measured: adding the guard
  //   changed the charge count by zero, and a mutation check then showed
  //   removing it broke no test. **A guard no test can reach, carrying a
  //   justification that measurement contradicts, is worse than no guard**, so
  //   it is gone and this test asserts the real mechanism instead.
  const battle = duel({ aiCharges: true, hero: { psyche_up: SS2_PSYCHE_UP.dischargeAt } });
  // At the opening the two are the arena's width apart and nothing is in reach.
  const legal = legalActions(battle);
  assert.equal(legal.some((option) => ATTACK_VERBS.includes(option.type)), false,
    "the opening must be out of reach or this measures nothing");
  const chosen = picks(battle);
  assert.notEqual(chosen, Ss2ActionType.PSYCHE_UP, "a gladiator across the arena must close, not wind up");
  assert.ok([Ss2ActionType.WALK_LEFT, Ss2ActionType.WALK_RIGHT].includes(chosen),
    `it must take a STEP — the movement arm is the mechanism — and it chose ${chosen}`);
});

/* ------------------------------------------------------------------ *
 * WHAT IT REACHES
 * ------------------------------------------------------------------ */

test("THE CHARGED STANCE NOW HAS A POPULATION, which is why this arm exists", () => {
  // ► **THE FAILURE THIS CLOSES, STATED AS A NUMBER.** Before the arm: 6,000 AI
  //   actions, 0 charges, 0 frames drawn in the charged pose. The art, the
  //   stance and the glow were correct over a population of zero — the same
  //   shape as the twelve figure-pack effect groups this project recorded a
  //   week earlier, where nothing reached them either.
  let chargedStates = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const battle = duel({ aiCharges: true, seed });
    for (let turn = 0; turn < 150; turn += 1) {
      const who = currentCombatant(battle);
      if (!who) break;
      const chosen = suggestAction(battle);
      if (!chosen) break;
      applyAction(battle, { actorId: who.id, ...chosen });
      for (const c of toTeamWireState(battle).teams.flatMap((team) => team.combatants)) {
        if (c.alive && stanceLabelFor(c) !== null) chargedStates += 1;
      }
    }
  }
  assert.ok(chargedStates > 0, "an AI bout must now draw a gladiator in the charged stance");
});
