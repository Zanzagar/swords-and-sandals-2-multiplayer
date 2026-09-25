/**
 * The resolver's BATTLE-RESOURCE seam: one declared, clamped, hashed numeric
 * pool that belongs to the battle rather than to any combatant.
 *
 * Game-agnostic on purpose: every rule set here is invented for the test and
 * is not SS2 behaviour. The SS2 use — `crowd_interest`, the build's one crowd
 * per bout — is tested in `test/ss2-crowd.test.js`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, BattleError, combatStateHash, createTeamBattle, defineTeamRuleSet, EffectKind,
  lastResolvedAction, replayTeamBattle, RuleSetVerification, TeamRuleSetError, toTeamWireState
} from "../src/team/index.js";

const warden = (id, agility, overrides = {}) => ({
  id,
  name: id,
  controller: "local",
  stats: { strength: 10, agility, attack: 40, defense: 6, vitality: 0, stamina: 5, magicka: 0 },
  maxHealth: 30,
  ...overrides
});

const strike = (actorId, targetId) => ({ actorId, type: "strike", targetId });

/** A rule set whose one verb emits whatever `effectsFor(request)` returns, and records what it saw. Invented. */
const emitting = (effectsFor, extra = {}, seen = []) => defineTeamRuleSet({
  id: "test-battle-resource-seam",
  verification: RuleSetVerification.PLACEHOLDER,
  provenance: { runtimeVerified: false, note: "Invented to exercise the battle-resource seam. Not SS2 behaviour." },
  actionTypes: ["strike"],
  maximumHealth: (combatant) => combatant.maxHealth ?? 30,
  legalActions: (view) => view.foes.map((foe) => ({ type: "strike", targetId: foe.id })),
  resolveAction: (request) => {
    seen.push(request.battleResources);
    return { effects: effectsFor(request), events: [{ type: "strike", actorId: request.actorId, targetId: request.targetId }] };
  },
  chooseAiAction: (view, actorId, options) => options[0],
  ...extra
});

/** Invented: the battle's `tide` starts at the number of combatants times ten, bounded 0..50. */
const tidal = (effectsFor, seen) => emitting(effectsFor, {
  openingBattleResources: (combatants) => ({ tide: { value: combatants.length * 10, min: 0, max: 50 } })
}, seen);

const pair = (rules, size = 1) => createTeamBattle({
  seed: 3,
  rules,
  teams: [
    { id: "red", combatants: Array.from({ length: size }, (_, i) => warden(`red-${i + 1}`, 30 - i)) },
    { id: "blue", combatants: Array.from({ length: size }, (_, i) => warden(`blue-${i + 1}`, 4 - i)) }
  ]
});

test("a rule set that declares no battle resource projects none, and its request carries an empty frozen bag", () => {
  const seen = [];
  const battle = pair(emitting(() => [], {}, seen));
  assert.equal(Object.hasOwn(toTeamWireState(battle), "battleResources"), false,
    "absent rather than `{}`, so every battle that declares none keeps its projection byte-for-byte");
  applyAction(battle, strike("red-1", "blue-1"));
  assert.deepEqual(seen[0], {});
  assert.ok(Object.isFrozen(seen[0]));
});

test("openingBattleResources is asked once, sees the whole roster, and its declaration is projected and hashed", () => {
  const asked = [];
  const rules = emitting(() => [], {
    openingBattleResources: (combatants) => {
      asked.push(combatants.map((combatant) => combatant.id));
      return { tide: { value: 40, min: 0, max: 50 } };
    }
  });
  const battle = pair(rules, 2);
  assert.deepEqual(asked, [["red-1", "red-2", "blue-1", "blue-2"]]);
  assert.deepEqual(toTeamWireState(battle).battleResources, { tide: { value: 40, min: 0, max: 50 } });
  const plain = pair(emitting(() => []), 2);
  assert.notEqual(combatStateHash(battle), combatStateHash(plain), "the hash covers the battle's own pool");
});

test("a BATTLE_RESOURCE effect writes the battle's pool to an ABSOLUTE value, clamped to its declared bounds", () => {
  const seen = [];
  let next = 25;
  const battle = pair(tidal(() => [{ kind: EffectKind.BATTLE_RESOURCE, resource: "tide", to: next }], seen));
  assert.equal(toTeamWireState(battle).battleResources.tide.value, 20);
  applyAction(battle, strike("red-1", "blue-1"));
  assert.equal(toTeamWireState(battle).battleResources.tide.value, 25);
  next = 90;
  applyAction(battle, strike("blue-1", "red-1"));
  assert.equal(toTeamWireState(battle).battleResources.tide.value, 50, "clamped to max 50");
  next = -5;
  applyAction(battle, strike("red-1", "blue-1"));
  assert.equal(toTeamWireState(battle).battleResources.tide.value, 0, "clamped to min 0");
  // What each request saw was the pre-action value, frozen.
  assert.deepEqual(seen.map((bag) => bag.tide.value), [20, 25, 50]);
  assert.ok(Object.isFrozen(seen[0].tide));
  assert.deepEqual(lastResolvedAction(battle).effects, [{ kind: EffectKind.BATTLE_RESOURCE, resource: "tide", to: -5 }],
    "the trace carries the effect as the rule set declared it");
});

test("everything a rule set can see of the battle's pool, the projection carries", () => {
  const seen = [];
  const battle = pair(tidal((request) => [
    { kind: EffectKind.BATTLE_RESOURCE, resource: "tide", to: request.battleResources.tide.value + 7 }
  ], seen));
  for (const actor of ["red-1", "blue-1", "red-1"]) {
    const before = toTeamWireState(battle).battleResources;
    applyAction(battle, strike(actor, actor === "red-1" ? "blue-1" : "red-1"));
    assert.deepEqual({ ...seen.at(-1), tide: { ...seen.at(-1).tide } }, before);
  }
  assert.equal(toTeamWireState(battle).battleResources.tide.value, 41);
});

test("the battle's pool replays deterministically at 1v1, 2v2 and 3v3", () => {
  for (const size of [1, 2, 3]) {
    const rules = tidal((request) => [
      { kind: EffectKind.BATTLE_RESOURCE, resource: "tide", to: request.battleResources.tide.value - 3 }
    ]);
    const blueprint = { seed: 5, rules, teams: pair(rules, size).teams.map((team) => ({
      id: team.id, combatants: team.combatants.map((c) => warden(c.id, c.stats.agility))
    })) };
    // Whoever is due, against the first foe — two turns.
    const played = createTeamBattle(blueprint);
    const actions = [];
    for (let turn = 0; turn < 2; turn += 1) {
      const actorId = played.initiative[played.turnCursor];
      const foe = played.teams.find((team) => !team.combatants.some((c) => c.id === actorId)).combatants[0];
      actions.push(strike(actorId, foe.id));
      applyAction(played, actions.at(-1));
    }
    const replayed = replayTeamBattle(blueprint, actions);
    assert.equal(combatStateHash(replayed), combatStateHash(played));
    assert.equal(toTeamWireState(replayed).battleResources.tide.value, Math.min(50, size * 20) - 6);
  }
});

test("a battle resource nobody declared is refused, not created", () => {
  const battle = pair(emitting(() => [{ kind: EffectKind.BATTLE_RESOURCE, resource: "tide", to: 1 }]));
  assert.throws(
    () => applyAction(battle, strike("red-1", "blue-1")),
    (error) => error instanceof BattleError && /the battle/.test(error.message) && /tide/.test(error.message)
  );
});

test("a malformed battle-resource effect is refused by the outcome contract", () => {
  const run = (effect) => applyAction(pair(tidal(() => [effect])), strike("red-1", "blue-1"));
  assert.throws(() => run({ kind: EffectKind.BATTLE_RESOURCE, to: 1 }),
    (error) => error instanceof TeamRuleSetError && /resource name/.test(error.message));
  assert.throws(() => run({ kind: EffectKind.BATTLE_RESOURCE, resource: "tide" }),
    (error) => error instanceof TeamRuleSetError && /absolute/.test(error.message));
  assert.throws(() => run({ kind: EffectKind.BATTLE_RESOURCE, resource: "tide", to: Number.NaN }),
    (error) => error instanceof TeamRuleSetError && /absolute/.test(error.message));
  // A targetId says the rule set meant a combatant's pool: refused rather than silently ignored.
  assert.throws(() => run({ kind: EffectKind.BATTLE_RESOURCE, targetId: "blue-1", resource: "tide", to: 1 }),
    (error) => error instanceof TeamRuleSetError && /belongs to no combatant/.test(error.message));
});

test("a malformed opening battle declaration is refused at construction", () => {
  const build = (declaration) => pair(emitting(() => [], { openingBattleResources: () => declaration }));
  assert.throws(() => build([{ resource: "tide", value: 1 }]),
    (error) => error instanceof BattleError && /plain object/.test(error.message));
  assert.throws(() => build({ tide: { value: Number.NaN } }),
    (error) => error instanceof BattleError && /finite/.test(error.message));
  assert.throws(() => build({ "not a name": 1 }),
    (error) => error instanceof BattleError && /must match/.test(error.message));
  // An empty declaration is the same battle as no hook at all.
  assert.equal(combatStateHash(build({})), combatStateHash(pair(emitting(() => []))));
});
