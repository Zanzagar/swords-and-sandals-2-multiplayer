/**
 * The resolver's STAT seam: how a verb changes a combatant's IN-BATTLE stat,
 * and how a rule set declares, at construction, a resource its verbs will
 * write on somebody who is not carrying the item that writes it.
 *
 * Game-agnostic on purpose: every rule set here is invented for the test and
 * is not SS2 behaviour. The SS2 use of both — colossus, little fat kid, swift
 * sandals and bloodlust — is tested in `test/ss2-stat-spells.test.js`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, BattleError, combatantById, combatStateHash, COMBATANT_PROJECTION_FIELDS, createTeamBattle,
  defineTeamRuleSet, EffectKind, lastResolvedAction, RuleSetVerification, TeamRuleSetError, toTeamWireState
} from "../src/team/index.js";

const warden = (id, agility, resources = {}, overrides = {}) => ({
  id,
  name: id,
  controller: "local",
  stats: { strength: 10, agility, attack: 40, defense: 6, vitality: 0, stamina: 5, magicka: 0 },
  maxHealth: 30,
  resources,
  ...overrides
});

const strike = (actorId, targetId) => ({ actorId, type: "strike", targetId });

/** A rule set whose one verb emits whatever effects `effectsFor(request)` returns. Invented. */
const emitting = (effectsFor, extra = {}) => defineTeamRuleSet({
  id: "test-stat-seam",
  verification: RuleSetVerification.PLACEHOLDER,
  provenance: { runtimeVerified: false, note: "Invented to exercise the stat seam. Not SS2 behaviour." },
  actionTypes: ["strike"],
  maximumHealth: (combatant) => combatant.maxHealth ?? 30,
  legalActions: (view) => view.foes.map((foe) => ({ type: "strike", targetId: foe.id })),
  resolveAction: (request) => ({
    effects: effectsFor(request),
    events: [{ type: "strike", actorId: request.actorId, targetId: request.targetId, seen: request.target.stats }]
  }),
  chooseAiAction: (view, actorId, options) => options[0],
  ...extra
});

const pair = (rules, blue = {}) => createTeamBattle({
  seed: 3,
  rules,
  teams: [
    { id: "red", combatants: [warden("red-1", 30)] },
    { id: "blue", combatants: [warden("blue-1", 4, blue)] }
  ]
});

test("a STAT effect writes one stat to an ABSOLUTE value on the combatant it names, and nothing else", () => {
  const battle = pair(emitting((request) => [
    { kind: EffectKind.STAT, targetId: request.targetId, stat: "strength", to: 27 }
  ]));
  applyAction(battle, strike("red-1", "blue-1"));
  const blue = combatantById(battle, "blue-1");
  assert.equal(blue.stats.strength, 27);
  assert.deepEqual({ ...blue.stats, strength: 10 },
    { strength: 10, agility: 4, attack: 40, defense: 6, vitality: 0, stamina: 5, magicka: 0 },
    "no other stat moved");
  assert.equal(combatantById(battle, "red-1").stats.strength, 10, "and nobody else's");
});

test("the written stat is what every later view sees, and what the projection hashes", () => {
  const battle = pair(emitting((request) => [
    { kind: EffectKind.STAT, targetId: request.targetId, stat: "defense", to: 3 }
  ]));
  const before = combatStateHash(battle);
  applyAction(battle, strike("red-1", "blue-1"));
  assert.equal(battle.events.at(-1).seen.defense, 6, "the view the verb itself read is the pre-write one");
  applyAction(battle, strike("blue-1", "red-1"));
  applyAction(battle, strike("red-1", "blue-1"));
  assert.equal(battle.events.at(-1).seen.defense, 3, "a later verb reads the in-battle value");
  const projected = toTeamWireState(battle).teams[1].combatants[0];
  assert.equal(projected.stats.defense, 3);
  assert.notEqual(combatStateHash(battle), before);
});

test("a stat write changes no projection SHAPE: the same keys before and after, and no field was added", () => {
  const battle = pair(emitting((request) => [
    { kind: EffectKind.STAT, targetId: request.targetId, stat: "agility", to: 50 }
  ]));
  const shape = (state) => state.teams.map((team) => team.combatants.map((c) => [Object.keys(c), Object.keys(c.stats)]));
  const before = shape(toTeamWireState(battle));
  applyAction(battle, strike("red-1", "blue-1"));
  assert.deepEqual(shape(toTeamWireState(battle)), before);
  assert.deepEqual([...COMBATANT_PROJECTION_FIELDS].sort(), [
    "aiFilled", "alive", "health", "id", "loadout", "maxHealth", "name", "resources", "seatId", "slotIndex",
    "stats", "status", "teamId", "x", "y"
  ], "no field was added to carry the seam");
});

test("a stat the combatant was not built with is refused, not created", () => {
  const battle = pair(emitting((request) => [
    { kind: EffectKind.STAT, targetId: request.targetId, stat: "charisma", to: 9 }
  ]));
  assert.throws(
    () => applyAction(battle, strike("red-1", "blue-1")),
    (error) => error instanceof BattleError && /creates no stat mid-battle/.test(error.message)
  );
});

test("a malformed stat effect is refused by the outcome contract; a well-formed one is signed and unclamped", () => {
  const run = (effect) => applyAction(pair(emitting(() => [effect])), strike("red-1", "blue-1"));
  assert.throws(
    () => run({ kind: EffectKind.STAT, targetId: "blue-1", to: 1 }),
    (error) => error instanceof TeamRuleSetError && /without a stat name/.test(error.message)
  );
  assert.throws(
    () => run({ kind: EffectKind.STAT, targetId: "blue-1", stat: "strength" }),
    (error) => error instanceof TeamRuleSetError && /absolute/.test(error.message)
  );
  assert.throws(
    () => run({ kind: EffectKind.STAT, targetId: "blue-1", stat: "strength", to: Number.POSITIVE_INFINITY }),
    (error) => error instanceof TeamRuleSetError && /absolute/.test(error.message)
  );
  // Signed like a coordinate, and unclamped: the rule set owns any bound.
  const battle = pair(emitting(() => [{ kind: EffectKind.STAT, targetId: "blue-1", stat: "strength", to: -4.5 }]));
  applyAction(battle, strike("red-1", "blue-1"));
  assert.equal(combatantById(battle, "blue-1").stats.strength, -4.5);
  assert.deepEqual(lastResolvedAction(battle).effects,
    [{ kind: EffectKind.STAT, targetId: "blue-1", stat: "strength", to: -4.5 }]);
});

/* ------------------------------------------------------------------ *
 * `openingResources`: declared at construction, seeing the roster     *
 * ------------------------------------------------------------------ */

test("openingResources declares a resource at construction on a combatant the blueprint said nothing about", () => {
  // Invented: every combatant facing somebody with 30+ strength holds a `dread` counter at -1.
  const rules = emitting(() => [], {
    openingResources: (combatants) => combatants.flatMap((combatant) =>
      combatants.some((other) => other.teamId !== combatant.teamId && other.stats.agility >= 30)
        ? [{ targetId: combatant.id, resource: "dread", value: -1, min: -1 }]
        : [])
  });
  const battle = pair(rules, { zeal: 4 });
  assert.equal(Object.hasOwn(combatantById(battle, "red-1").resources, "dread"), false, "red faces nobody that fast");
  assert.deepEqual(combatantById(battle, "blue-1").resources, {
    dread: { value: -1, min: -1, max: null },
    zeal: { value: 4, min: 0, max: null }
  }, "declared beside the blueprint's own, and the bag stays sorted");
  assert.deepEqual(Object.keys(toTeamWireState(battle).teams[1].combatants[0].resources), ["dread", "zeal"]);
});

test("a name the blueprint already declares keeps the blueprint's declaration", () => {
  const rules = emitting(() => [], {
    openingResources: () => [{ targetId: "blue-1", resource: "zeal", value: 99 }]
  });
  assert.deepEqual(combatantById(pair(rules, { zeal: 4 }), "blue-1").resources.zeal, { value: 4, min: 0, max: null });
});

test("a rule set without the hook builds exactly the battle it always did", () => {
  const plain = emitting(() => []);
  const hooked = emitting(() => [], { openingResources: () => [] });
  assert.equal(combatStateHash(pair(plain, { zeal: 4 })), combatStateHash(pair(hooked, { zeal: 4 })));
});

test("a malformed opening declaration is refused at construction", () => {
  const build = (declarations) => pair(emitting(() => [], { openingResources: () => declarations }));
  assert.throws(() => build("dread"), (error) => error instanceof BattleError && /array/.test(error.message));
  assert.throws(() => build([{ targetId: "nobody", resource: "dread", value: 1 }]),
    (error) => error instanceof BattleError && /unknown combatant nobody/.test(error.message));
  assert.throws(() => build([{ targetId: "blue-1", resource: "health", value: 1 }]),
    (error) => error instanceof BattleError && /reserved/.test(error.message));
  assert.throws(() => build([{ targetId: "blue-1", resource: "dread", value: Number.NaN }]),
    (error) => error instanceof BattleError && /finite/.test(error.message));
});

test("a resource declared at the opening is written like any other, and replays", () => {
  const rules = emitting((request) => [{ kind: EffectKind.RESOURCE, targetId: request.targetId, resource: "dread", to: 5 }], {
    openingResources: (combatants) => combatants.map((c) => ({ targetId: c.id, resource: "dread", value: 0 }))
  });
  const battle = pair(rules);
  applyAction(battle, strike("red-1", "blue-1"));
  assert.equal(combatantById(battle, "blue-1").resources.dread.value, 5);
  const again = pair(rules);
  applyAction(again, strike("red-1", "blue-1"));
  assert.equal(combatStateHash(again), combatStateHash(battle));
});
