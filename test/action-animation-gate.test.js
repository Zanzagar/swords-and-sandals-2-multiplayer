/**
 * The per-action animation seam: `actionToken` on presentation commands
 * (`src/adapter/presentation.js`) and the gate that waits on it
 * (`src/adapter/action-gate.js`).
 *
 * WHY THIS FILE EXISTS. `docs/ss2-adapter-contract.md` carried this as the one
 * remaining gap in the acknowledgement story, together with a four-part sketch
 * of the seam that would close it. Part 1 of that sketch was WRONG in the
 * direction that matters — "the resolver sequence is already unique per action
 * and would do" — and the first two tests below are what proves it, so that
 * anyone tempted to simplify the token back to `event.sequence` fails here
 * with the reason attached.
 *
 * THE ASSERTIONS PROVE, THEY DO NOT STATE. Every sweep asserts it FOUND the
 * case it was sweeping for: a killing blow that emits four events under one
 * token is the whole point, so a sweep that never met one would be green and
 * worthless.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction,
  combatStateHash,
  createTeamBattle,
  currentCombatant,
  defineTeamRuleSet,
  EffectKind,
  lastResolvedAction,
  legalActions,
  RuleSetVerification,
  toTeamWireState
} from "../src/team/index.js";
import { ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import {
  ActionAnimationError,
  buildArenaLayout,
  CommandKind,
  createActionAnimationGate,
  createPresentationBinder,
  PresentationError,
  presentResolvedEvents,
  SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const gladiator = (overrides = {}) => ({
  strength: 9, speed: 5, attack: 9, defence: 5, vitality: 5, stamina: 4,
  magicka: 0, charisma: 3, herolevel: 3, character_level: 3,
  weapon_min_damage: 3, weapon_max_damage: 9,
  breastplate: 20, helmet: 10,
  ...overrides
});

const fighter = (id, name, overrides = {}) =>
  ss2Combatant(gladiator(overrides), { id, name, controller: "local" });

function ss2Battle(perSide, seed) {
  const side = (prefix) => ({
    id: prefix,
    name: prefix,
    combatants: Array.from({ length: perSide }, (unused, index) =>
      fighter(`${prefix}-${index + 1}`, `${prefix} ${index + 1}`, { speed: 5 + index })
    )
  });
  return createTeamBattle({ seed, rules: ss2TeamRules, teams: [side("red"), side("blue")] });
}

/**
 * Drives a battle to its end, draining the binder ONCE PER ACTION and handing
 * it that action's own boundary — which is exactly how `battle-host.js` uses
 * it. Returns one entry per action.
 */
function driveWithBinder(battle, { withBoundaries = true, bindings = SS2_STATIC_MAP_BINDINGS } = {}) {
  const layout = buildArenaLayout(toTeamWireState(battle));
  const binder = createPresentationBinder({ layout, bindings });
  const actions = [];
  let guard = 0;
  while (!battle.result && guard < 5000) {
    guard += 1;
    const actor = currentCombatant(battle);
    if (!actor) break;
    const options = legalActions(battle);
    if (options.length === 0) break;
    applyAction(battle, { ...options[0], actorId: actor.id });
    const resolution = lastResolvedAction(battle);
    const commands = withBoundaries
      ? binder.drain(toTeamWireState(battle), { actionBoundary: resolution.firstEventSequence })
      : binder.drain(toTeamWireState(battle));
    actions.push({ boundary: resolution.firstEventSequence, resolution, commands });
  }
  assert.ok(battle.result, "the sweep needs a settled battle to reach the terminal commands");
  return actions;
}

/* ------------------------------------------------------------------ */
/* The token is the resolver's action boundary, never `event.sequence` */
/* ------------------------------------------------------------------ */

test("every command of one action carries that action's boundary, across 1v1 and 3v3", () => {
  let actionsChecked = 0;
  let multiSequenceActions = 0;
  let commandsChecked = 0;

  for (const perSide of [1, 3]) {
    for (let seed = 1; seed <= 12; seed += 1) {
      for (const action of driveWithBinder(ss2Battle(perSide, seed))) {
        actionsChecked += 1;
        const sequences = new Set(action.commands.map((command) => command.sequence));
        if (sequences.size > 1) multiSequenceActions += 1;
        for (const command of action.commands) {
          commandsChecked += 1;
          assert.equal(
            command.actionToken,
            action.boundary,
            `command ${command.kind}@seq${command.sequence} must carry the action boundary ${action.boundary}`
          );
        }
      }
    }
  }

  assert.ok(actionsChecked > 500, `the sweep must actually run: ${actionsChecked} actions`);
  assert.ok(commandsChecked > 1000, `the sweep must bind commands: ${commandsChecked}`);
  // Without this the test is vacuous: if every action produced commands from a
  // single event, `actionToken === command.sequence` would pass too.
  assert.ok(
    multiSequenceActions > 0,
    "the sweep must meet at least one action whose commands span more than one event sequence, " +
    "or it cannot distinguish the action boundary from `event.sequence`"
  );
});

test("a killing blow's death and arena commands carry the KILLING ACTION's token, not their own sequences", () => {
  let found = 0;

  for (let seed = 1; seed <= 12; seed += 1) {
    const actions = driveWithBinder(ss2Battle(1, seed));
    const last = actions[actions.length - 1];
    const kinds = new Set(last.commands.map((command) => command.kind));
    if (!kinds.has(CommandKind.ARENA_GOTO)) continue;
    found += 1;

    // Four events under one action: the attack, the knockout, `team-eliminated`
    // (bound to nothing) and `battle-result-pending`.
    assert.equal(last.resolution.events.length + last.resolution.knockouts.length >= 2, true);
    const bind = last.commands.find((command) => command.kind === CommandKind.BIND_GLOBALS);
    const arena = last.commands.find((command) => command.kind === CommandKind.ARENA_GOTO);
    assert.ok(bind && arena, "a killing blow binds globals and reaches the arena label");

    // THE MUTANT THIS KILLS: `actionToken = event.sequence`. These two commands
    // come from different events, so their sequences differ...
    assert.notEqual(bind.sequence, arena.sequence);
    // ...and yet they are one action, so they share one token.
    assert.equal(bind.actionToken, arena.actionToken);
    assert.equal(bind.actionToken, last.boundary);
    assert.equal(bind.actionToken, bind.sequence, "the boundary IS the first event's sequence");
    assert.notEqual(arena.actionToken, arena.sequence, "and it is NOT the later event's");
  }

  assert.ok(found >= 10, `the sweep must reach a decided battle with an arena transition: ${found} of 12`);
});

test("a rule set that emits two events for one action still produces ONE token", () => {
  // The reason the boundary is carried in rather than derived from the event
  // stream. `assertActionOutcome` requires only that `events` be an array, so
  // "a new action starts at every non-elimination event" is not a law, and a
  // rule set like this one breaks it.
  const twoEventRules = defineTeamRuleSet({
    id: "two-events-per-action",
    verification: RuleSetVerification.PLACEHOLDER,
    provenance: { runtimeVerified: false, note: "test-only: emits two events for one action" },
    actionTypes: ["melee"],
    maximumHealth: (source) => source.maxHealth ?? 40,
    legalActions: (view) => [{ type: "melee", targetId: view.foes[0]?.id ?? view.actor.id }],
    resolveAction: (request) => ({
      effects: [{ kind: EffectKind.DAMAGE, targetId: request.targetId, amount: 3 }],
      events: [
        { type: "melee", actorId: request.actorId, targetId: request.targetId, hit: true, amount: 3 },
        { type: "melee", actorId: request.actorId, targetId: request.targetId, hit: false, amount: 0 }
      ]
    }),
    chooseAiAction: () => null
  });

  const battle = createTeamBattle({
    seed: 3,
    rules: twoEventRules,
    teams: [
      { id: "red", name: "Red", combatants: [{ id: "red-1", name: "R1", stats: { agility: 9 }, health: 40, maxHealth: 40 }] },
      { id: "blue", name: "Blue", combatants: [{ id: "blue-1", name: "B1", stats: { agility: 1 }, health: 40, maxHealth: 40 }] }
    ]
  });
  const layout = buildArenaLayout(toTeamWireState(battle));
  const binder = createPresentationBinder({ layout });

  applyAction(battle, { actorId: "red-1", type: "melee", targetId: "blue-1" });
  const resolution = lastResolvedAction(battle);
  assert.equal(resolution.events.length, 2, "the fixture must actually emit two events");

  const commands = binder.drain(toTeamWireState(battle), { actionBoundary: resolution.firstEventSequence });
  const sequences = new Set(commands.map((command) => command.sequence));
  assert.equal(sequences.size, 2, "two events, so two distinct command sequences");
  const tokens = new Set(commands.map((command) => command.actionToken));
  assert.deepEqual([...tokens], [resolution.firstEventSequence], "but one action, so one token");
});

/* ------------------------------------------------------------------ */
/* No boundary: null, not absent, and never guessed                    */
/* ------------------------------------------------------------------ */

test("a caller who supplies no boundary gets actionToken null on every command, and no tokens reported", () => {
  const battle = ss2Battle(1, 5);
  const actions = driveWithBinder(battle, { withBoundaries: false });
  let commands = 0;
  for (const action of actions) {
    for (const command of action.commands) {
      commands += 1;
      // Present and null, deliberately: a host must not be able to read an
      // absent field as "no gating needed".
      assert.ok("actionToken" in command, `${command.kind} must carry the field`);
      assert.equal(command.actionToken, null);
    }
  }
  assert.ok(commands > 10, `the sweep must bind commands: ${commands}`);

  const wire = toTeamWireState(battle);
  const { actionTokens } = presentResolvedEvents(wire, { layout: buildArenaLayout(wire) });
  assert.deepEqual([...actionTokens], []);

  // And an empty gate shown those commands is READY, because it was told
  // nothing to wait for — the honest reading, not an invented boundary.
  const gate = createActionAnimationGate();
  gate.observe(actions.flatMap((action) => action.commands));
  assert.equal(gate.isReady, true);
  assert.deepEqual([...gate.observed], []);
});

test("the action token never enters combat state, so no battle hash moves", () => {
  const withTokens = ss2Battle(3, 7);
  const withoutTokens = ss2Battle(3, 7);
  driveWithBinder(withTokens);
  driveWithBinder(withoutTokens, { withBoundaries: false });

  assert.equal(combatStateHash(withTokens), combatStateHash(withoutTokens));
  assert.deepEqual(toTeamWireState(withTokens), toTeamWireState(withoutTokens));
  // The reason it cannot move one: the boundary the token is built from is on
  // `battle.lastResolution`, which the projection does not carry.
  const projected = toTeamWireState(withTokens);
  assert.equal("lastResolution" in projected, false);
  assert.equal(
    JSON.stringify(projected).includes("firstEventSequence"),
    false,
    "the action boundary must stay out of the hashed projection"
  );
});

/* ------------------------------------------------------------------ */
/* Boundaries are validated, never sorted or deduplicated              */
/* ------------------------------------------------------------------ */

test("action boundaries must be positive integers in strictly ascending order", () => {
  const battle = ss2Battle(1, 2);
  applyAction(battle, { ...legalActions(battle)[0], actorId: currentCombatant(battle).id });
  const wire = toTeamWireState(battle);
  const layout = buildArenaLayout(wire);

  for (const bad of [[0], [-1], [1.5], ["1"], [null], [3, 3], [3, 2]]) {
    assert.throws(
      () => presentResolvedEvents(wire, { layout, actionBoundaries: bad }),
      PresentationError,
      `${JSON.stringify(bad)} must be refused`
    );
  }
  assert.throws(() => presentResolvedEvents(wire, { layout, actionBoundaries: "1,2" }), PresentationError);
  // Ascending is fine.
  assert.doesNotThrow(() => presentResolvedEvents(wire, { layout, actionBoundaries: [1, 2, 9] }));
});

test("the binder refuses a boundary that repeats or goes backwards", () => {
  const battle = ss2Battle(1, 4);
  const layout = buildArenaLayout(toTeamWireState(battle));
  const binder = createPresentationBinder({ layout });

  applyAction(battle, { ...legalActions(battle)[0], actorId: currentCombatant(battle).id });
  binder.drain(toTeamWireState(battle), { actionBoundary: 1 });
  assert.deepEqual([...binder.actionBoundaries], [1]);

  applyAction(battle, { ...legalActions(battle)[0], actorId: currentCombatant(battle).id });
  assert.throws(
    () => binder.drain(toTeamWireState(battle), { actionBoundary: 1 }),
    PresentationError,
    "the same boundary twice means the host lost track of its own action order"
  );
  assert.deepEqual([...binder.actionBoundaries], [1], "a refused boundary must not be recorded");

  binder.drain(toTeamWireState(battle), { actionBoundary: 2 });
  assert.deepEqual([...binder.actionBoundaries], [1, 2]);

  binder.reset();
  assert.deepEqual([...binder.actionBoundaries], []);
  assert.equal(binder.sequence, 0);
});

/* ------------------------------------------------------------------ */
/* The gate                                                            */
/* ------------------------------------------------------------------ */

const commandsWithTokens = (...tokens) => tokens.map((actionToken) => ({ kind: "clip-goto", actionToken }));

test("a gate shown nothing is ready, and observing is idempotent per token", () => {
  const gate = createActionAnimationGate();
  assert.equal(gate.isReady, true);
  assert.deepEqual([...gate.pending], []);

  const first = gate.observe(commandsWithTokens(4, 4, 4, null));
  assert.deepEqual([...first.observed], [4], "one action, however many commands carried it");
  assert.deepEqual([...gate.pending], [4]);
  assert.equal(gate.isReady, false);

  // A re-drain, or the same batch handed over twice.
  const again = gate.observe(commandsWithTokens(4));
  assert.deepEqual([...again.observed], []);
  assert.deepEqual([...gate.pending], [4]);

  gate.observe(commandsWithTokens(9));
  assert.deepEqual([...gate.pending], [4, 9], "observation order, not sort order");
});

test("an unknown token is refused; a duplicate report is answered, not thrown", () => {
  const gate = createActionAnimationGate();
  gate.observe(commandsWithTokens(6));

  assert.throws(() => gate.report(7), ActionAnimationError, "a token no command carried opens no gate");
  assert.throws(() => gate.report(0), ActionAnimationError);
  assert.throws(() => gate.report("6"), ActionAnimationError);

  const first = gate.report(6);
  assert.equal(first.counted, true);
  assert.equal(first.duplicate, false);
  assert.equal(first.ready, true);

  const second = gate.report(6);
  assert.equal(second.accepted, true, "a surface firing its completion handler twice is a nuisance, not a desync");
  assert.equal(second.counted, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.ready, true);
});

test("an out-of-order report is accepted and flagged, because resolved state cannot contradict it", () => {
  const gate = createActionAnimationGate();
  gate.observe(commandsWithTokens(2, 5));

  const later = gate.report(5);
  assert.equal(later.accepted, true);
  assert.equal(later.outOfOrder, true);
  assert.equal(later.ready, false);
  assert.deepEqual([...later.pending], [2]);

  const earlier = gate.report(2);
  assert.equal(earlier.outOfOrder, false);
  assert.equal(earlier.ready, true);
  assert.deepEqual([...gate.reported], [2, 5], "reported in observation order, whatever order they arrived");
});

test("abandoning is a host decision and must name itself", () => {
  const gate = createActionAnimationGate();
  gate.observe(commandsWithTokens(3));

  assert.throws(() => gate.abandon(3), ActionAnimationError, "an unexplained abandonment reads as a report");
  assert.throws(() => gate.abandon(3, "   "), ActionAnimationError);
  assert.throws(() => gate.abandon(11, "timed out"), ActionAnimationError, "an unknown token is refused here too");
  assert.equal(gate.isReady, false, "a refused abandonment must not open the gate");

  const given = gate.abandon(3, "surface reported nothing in 5s (host policy)");
  assert.equal(given.counted, true);
  assert.equal(given.ready, true);
  assert.deepEqual(gate.abandoned.map((entry) => entry.token), [3]);
  assert.match(gate.abandoned[0].reason, /host policy/);
  assert.deepEqual([...gate.pending], [], "abandoned is not pending");
  assert.deepEqual([...gate.reported], [], "and it is not reported either");
});

test("a late report is recorded as late, and abandoning something already reported changes nothing", () => {
  const gate = createActionAnimationGate();
  gate.observe(commandsWithTokens(8, 12));

  gate.abandon(8, "timeout");
  const late = gate.report(8);
  assert.equal(late.accepted, true);
  assert.equal(late.late, true, "the animation finished after the host stopped waiting");
  assert.equal(late.counted, false);
  assert.deepEqual(gate.abandoned.map((entry) => entry.token), [], "a late report clears the abandonment");
  assert.deepEqual([...gate.reported], [8]);

  gate.report(12);
  const pointless = gate.abandon(12, "timeout");
  assert.equal(pointless.accepted, true);
  assert.equal(pointless.alreadyReported, true);
  assert.equal(pointless.counted, false);
  assert.deepEqual([...gate.reported], [8, 12]);
  assert.equal(gate.isReady, true);
});

test("the gate reports its own state as JSON, and reset forgets everything", () => {
  const gate = createActionAnimationGate();
  gate.observe(commandsWithTokens(1, 2, 3));
  gate.report(1);
  gate.abandon(2, "no surface attached");

  assert.deepEqual(gate.toJSON(), {
    observed: [1, 2, 3],
    reported: [1],
    abandoned: [{ token: 2, reason: "no surface attached" }],
    pending: [3],
    ready: false
  });

  gate.reset();
  assert.deepEqual(gate.toJSON(), { observed: [], reported: [], abandoned: [], pending: [], ready: true });
  assert.equal(gate.knows(1), false);
  assert.throws(() => gate.report(1), ActionAnimationError);
});

test("observe() needs commands, and refuses a malformed token rather than ignoring it", () => {
  const gate = createActionAnimationGate();
  assert.throws(() => gate.observe(null), ActionAnimationError);
  assert.throws(() => gate.observe(42), ActionAnimationError);
  assert.throws(() => gate.observe(commandsWithTokens(-2)), ActionAnimationError);
  assert.throws(() => gate.observe([{ kind: "clip-goto", actionToken: 1.5 }]), ActionAnimationError);
  // `undefined` and `null` are the two shapes that legitimately mean "no
  // boundary was supplied", and both are skipped rather than refused.
  assert.doesNotThrow(() => gate.observe([{ kind: "attach-clip" }, { kind: "clip-goto", actionToken: null }]));
  assert.equal(gate.isReady, true);
});

/* ------------------------------------------------------------------ */
/* End to end: a real battle's tokens, through a real gate             */
/* ------------------------------------------------------------------ */

test("a gate driven by a whole battle opens once per action, and only when told", () => {
  const battle = ss2Battle(2, 9);
  const gate = createActionAnimationGate();
  const actions = driveWithBinder(battle);

  let opened = 0;
  for (const action of actions) {
    const { observed } = gate.observe(action.commands);
    if (action.commands.length === 0) {
      assert.deepEqual([...observed], [], "an action that bound no command has nothing to wait for");
      continue;
    }
    assert.deepEqual([...observed], [action.boundary], "one action, one token");
    assert.equal(gate.isReady, false, "the gate stays shut until the surface answers");
    opened += 1;
    const outcome = gate.report(action.boundary);
    assert.equal(outcome.counted, true);
    assert.equal(outcome.ready, true);
  }

  assert.ok(opened > 5, `the battle must have opened the gate repeatedly: ${opened}`);
  assert.equal(gate.observed.length, opened);
  assert.deepEqual([...gate.pending], []);
  assert.deepEqual(gate.abandoned, []);
});

/* ------------------------------------------------------------------ */
/* Two claims this seam MADE about itself, one of them false           */
/* ------------------------------------------------------------------ */

/**
 * `presentation.js` and `action-gate.js` both said the action boundary is
 * "never derived from the wire". Not projected and not derivable are different
 * claims, and only the first was ever true — so a host was being told it needed
 * a resolver trace it does not need. These two tests pin the difference in both
 * directions, because the useful version is not "it is derivable" but "it is
 * derivable PROSPECTIVELY and not retrospectively".
 */
test("the action boundary IS derivable from the wire, prospectively", () => {
  for (const [perSide, seed] of [[1, 3], [1, 7], [2, 3], [3, 11]]) {
    const battle = ss2Battle(perSide, seed);
    let checked = 0;
    let guard = 0;
    while (!battle.result && guard < 5000) {
      guard += 1;
      const actor = currentCombatant(battle);
      if (!actor) break;
      const options = legalActions(battle);
      if (options.length === 0) break;

      // Taken BEFORE the action, from the projection alone. `addEvent` is the
      // sole appender to `battle.events` (`src/team/resolver.js`) and stamps
      // `sequence = events.length + 1`, so the sequences are dense and the next
      // one is arithmetic rather than a sample.
      const predicted = toTeamWireState(battle).events.length + 1;
      applyAction(battle, { ...options[0], actorId: actor.id });
      assert.equal(
        lastResolvedAction(battle).firstEventSequence,
        predicted,
        `${perSide}v${perSide} seed ${seed}: the wire already knew the boundary`
      );
      checked += 1;
    }
    assert.ok(checked > 3, `${perSide}v${perSide} seed ${seed} must have resolved several actions: ${checked}`);
  }
});

test("the action boundary is NOT recoverable from a finished event log", () => {
  // The whole reason the boundary must be carried in by a caller in the loop.
  // A four-event killing action and four one-event actions project to the same
  // dense sequence run, so nothing downstream can tell them apart afterwards.
  const battle = ss2Battle(1, 3);
  const actions = driveWithBinder(battle);
  const boundaries = actions.map((entry) => entry.boundary);
  const sequences = (toTeamWireState(battle).events ?? []).map((event) => event.sequence);

  assert.deepEqual(sequences, sequences.map((unused, index) => index + 1), "sequences are dense 1..N");
  assert.ok(
    sequences.length > boundaries.length,
    `some action must have emitted more than one event, or this test proves nothing: ` +
    `${sequences.length} events across ${boundaries.length} actions`
  );
  // The evidence that would be needed to split them is exactly what the
  // projection does not carry.
  assert.equal(
    boundaries.every((boundary) => sequences.includes(boundary)),
    true,
    "every boundary is itself a sequence, which is why the log cannot distinguish them"
  );
});

/**
 * The token is unique per EVENT BATCH, not per action, and `action-gate.js`
 * concedes in its own header that "a rule set may legally emit none or a
 * dozen". A rule set that emits NONE gives two consecutive actions the same
 * boundary — and the second drain throws inside the host's action loop.
 *
 * `ss2TeamRules` never emits a zero-event action, so nothing in this repository
 * hits this today. It is pinned so the next rule set meets it by name.
 */
test("a rule set that legally emits no events collides two actions on one boundary", () => {
  const silentRules = defineTeamRuleSet({
    id: "zero-event-rule-set",
    verification: RuleSetVerification.PLACEHOLDER,
    provenance: {
      note: "A rule set that resolves actions without emitting events, to pin the boundary collision.",
      runtimeVerified: false
    },
    actionTypes: ["noop"],
    maximumHealth: () => 10,
    legalActions: () => [{ type: "noop", targetId: null }],
    resolveAction: () => ({ effects: [], events: [] }),
    chooseAiAction: () => ({ type: "noop", targetId: null })
  });

  const battle = createTeamBattle({
    seed: 1,
    rules: silentRules,
    teams: [
      { id: "red", name: "red", combatants: [{ id: "r1", name: "R" }] },
      { id: "blue", name: "blue", combatants: [{ id: "b1", name: "B" }] }
    ]
  });
  const layout = buildArenaLayout(toTeamWireState(battle));
  const binder = createPresentationBinder({ layout });

  const boundaries = [];
  const submit = () => {
    const actor = currentCombatant(battle);
    applyAction(battle, { type: "noop", targetId: null, actorId: actor.id });
    const boundary = lastResolvedAction(battle).firstEventSequence;
    boundaries.push(boundary);
    return binder.drain(toTeamWireState(battle), { actionBoundary: boundary });
  };

  assert.deepEqual([...submit()], [], "a zero-event action binds no command");
  assert.throws(
    submit,
    (error) => error instanceof PresentationError && /ascend strictly/.test(error.message),
    "the second action reuses the first action's boundary and the binder refuses it"
  );
  assert.deepEqual(boundaries, [1, 1], "two distinct actions, one boundary — that is the defect, not the throw");
});
