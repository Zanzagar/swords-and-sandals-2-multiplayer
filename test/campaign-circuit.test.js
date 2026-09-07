/**
 * `src/campaign/circuit.js` — consecutive bouts with the survivors carried.
 *
 * WHY THIS FILE EXISTS. `rosterFromCampaignRecord` landed on 2026-09-07 so a
 * record could be read back into a battle, and a week later its only caller
 * was its own test file. This is the seam's first consumer, and the test that
 * matters most is the last one: bout -> record -> next bout -> record, twice
 * over, with a survivor who is measurably weaker the second time.
 *
 * THE ASSERTIONS HERE PROVE, THEY DO NOT STATE. Two shapes are banned on this
 * project because both have shipped green while testing nothing: a universal
 * asserted from one visit, and a test that returns early when its setup did
 * not occur. Every sweep below asserts it FOUND the case it was sweeping for.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  acknowledgeResultAnimation,
  applyAction,
  createTeamBattle,
  currentCombatant,
  legalActions,
  pendingResultEvent
} from "../src/team/index.js";
import { ss2Combatant, ss2TeamRules, SS2_FACING_LEFT } from "../src/team/ss2-rules.js";
import { advanceCircuit, CampaignRecordError, circuitLength, CircuitSide } from "../src/campaign/index.js";

function gladiator(overrides = {}) {
  return {
    strength: 9, speed: 5, attack: 9, defence: 5, vitality: 5, stamina: 4,
    magicka: 0, charisma: 3, herolevel: 3, character_level: 3,
    weapon_min_damage: 3, weapon_max_damage: 9,
    breastplate: 20, helmet: 10,
    ...overrides
  };
}

function fighter(id, name, side, overrides = {}) {
  return ss2Combatant(
    gladiator({ gladiator_dir: side === CircuitSide.LEFT ? "left" : "right", ...overrides }),
    { id, name, controller: "local" }
  );
}

/** Drives a bout to elimination and acknowledges it, so a record can be built. */
function settle(battle) {
  let guard = 0;
  while (!battle.result && guard < 5000) {
    guard += 1;
    const actor = currentCombatant(battle);
    if (!actor) break;
    const options = legalActions(battle);
    if (options.length === 0) break;
    applyAction(battle, { ...options[0], actorId: actor.id });
  }
  assert.ok(battle.result, "the bout must settle for a circuit to advance");
  const pending = pendingResultEvent(battle);
  acknowledgeResultAnimation(battle, {
    type: "battle-result-animation-complete",
    completionToken: pending.completionToken
  });
  return battle;
}

function boutOf(blue, red, seed) {
  return settle(
    createTeamBattle({
      seed,
      rules: ss2TeamRules,
      teams: [
        { id: "blue", name: "Blue", combatants: blue },
        { id: "red", name: "Red", combatants: red }
      ]
    })
  );
}

test("a circuit has no default length, because four fights is EP-D03 and EP-D03 is pending", () => {
  assert.throws(() => circuitLength(undefined), CampaignRecordError);
  assert.throws(() => circuitLength(null), CampaignRecordError);
  assert.throws(() => circuitLength(0), CampaignRecordError);
  assert.throws(() => circuitLength(2.5), CampaignRecordError);
  assert.throws(() => circuitLength(-1), CampaignRecordError);
  assert.equal(circuitLength(1), 1);
  assert.equal(circuitLength(4), 4);

  // The point is not that 4 is rejected — it is that 4 must be CHOSEN. An
  // agent adopting a pending decision's number as a default is the failure
  // this refusal exists to prevent.
  assert.throws(
    () => circuitLength(),
    /EP-D03 is pending/,
    "the refusal must name the decision, so a reader knows what would unblock it"
  );
});

test("advancing needs a settled bout and a fresh challenger, and says why", () => {
  const blue = [fighter("hero", "Hero", CircuitSide.LEFT)];
  const red = [fighter("foe", "Foe", CircuitSide.RIGHT)];

  const unsettled = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [{ id: "blue", combatants: blue }, { id: "red", combatants: red }]
  });
  assert.throws(
    () => advanceCircuit(unsettled, { blueprints: [...blue, ...red], challengers: { combatants: red } }),
    /never on a knockout/
  );

  const settled = boutOf(blue, red, 5);
  assert.throws(
    () => advanceCircuit(settled, { blueprints: [...blue, ...red], battleId: "b", recordedAt: "2026-09-07T00:00:00Z" }),
    /refills the eliminated side/,
    "a settled bout always leaves one side empty, so there is no next bout without an opponent"
  );
});

test("THE RESTORED-RESOURCE REPORT: armour and stamina attrition are undone, and the circuit says so", () => {
  // THE FINDING THIS TEST EXISTS FOR. A campaign record carries `survived`,
  // `health`, `maxHealth` and `statuses` and carries NO resources, so
  // read-back rebuilds a survivor from its blueprint and the blueprint's
  // armour and stamina come back with it. Measured 2026-09-07: a fighter who
  // ended at armourclass 0 and staminaleft 48 re-entered at 420 and 140.
  //
  // Whether that SHOULD happen is a balance decision (EP-A03, not drafted).
  // Whether it happens SILENTLY is this file's business, and it must not.
  const blue = [fighter("hero", "Hero", CircuitSide.LEFT)];
  const red = [fighter("foe", "Foe", CircuitSide.RIGHT)];
  const battle = boutOf(blue, red, 5);

  const next = [fighter("foe2", "Second Foe", CircuitSide.RIGHT)];
  const advance = advanceCircuit(battle, {
    blueprints: [...blue, ...red],
    challengers: { teamId: "red", name: "Red", combatants: next, side: CircuitSide.RIGHT },
    battleId: "bout-1",
    recordedAt: "2026-09-07T00:00:00Z"
  });

  assert.ok(
    advance.restoredResources.length > 0,
    "the survivor spent SOMETHING — a report of nothing means the comparison is not running"
  );

  const report = advance.restoredResources[0];
  assert.ok(advance.survivors.includes(report.combatantId), "the report names a fighter who is actually carrying on");

  // Every entry must be a real difference, in the direction of restoration,
  // and must name both numbers — a report saying only "this changed" cannot
  // be acted on.
  for (const change of report.changes) {
    assert.equal(typeof change.resource, "string");
    assert.ok(Number.isFinite(change.measured), `${change.resource} must report what the bout measured`);
    assert.ok(Number.isFinite(change.entersAt), `${change.resource} must report what it re-enters at`);
    assert.notEqual(change.measured, change.entersAt, "an unchanged resource must not be reported as restored");
  }

  // SWEEP, THEN ASSERT YOU FOUND THE CASE. Stamina is spent by every action,
  // so it must appear; without this the loop above would pass on an empty
  // `changes` array.
  const named = report.changes.map((change) => change.resource);
  assert.ok(
    named.includes("staminaleft"),
    `stamina is spent by every attack and must be reported restored; got ${JSON.stringify(named)}`
  );
  const stamina = report.changes.find((change) => change.resource === "staminaleft");
  assert.ok(
    stamina.entersAt > stamina.measured,
    "restoration means entering HIGHER than the bout ended; a lower value would be attrition, not repair"
  );
});

test("the circuit heals nobody: a wounded survivor enters the next bout at the health the record measured", () => {
  const blue = [fighter("hero", "Hero", CircuitSide.LEFT)];
  const red = [fighter("foe", "Foe", CircuitSide.RIGHT)];

  // SWEEP for a bout whose winner is actually wounded. A survivor who ends
  // untouched makes "carries his measured health" identical to "starts
  // fresh", which is a vacuous pass — this repository has shipped that shape.
  let advance = null;
  let woundedHealth = null;
  let maximum = null;
  for (let seed = 1; seed <= 60 && advance === null; seed += 1) {
    const battle = boutOf(
      [fighter("hero", "Hero", CircuitSide.LEFT)],
      [fighter("foe", "Foe", CircuitSide.RIGHT)],
      seed
    );
    const alive = battle.teams.flatMap((team) => team.combatants).filter((combatant) => combatant.alive);
    if (alive.length !== 1) continue;
    if (alive[0].health >= alive[0].maxHealth) continue;
    woundedHealth = alive[0].health;
    maximum = alive[0].maxHealth;
    advance = advanceCircuit(battle, {
      blueprints: [...blue, ...red],
      challengers: {
        teamId: "challenger",
        name: "Challenger",
        combatants: [fighter("next", "Next", CircuitSide.RIGHT)],
        side: CircuitSide.RIGHT
      },
      battleId: `bout-${seed}`,
      recordedAt: "2026-09-07T00:00:00Z"
    });
  }
  assert.ok(advance, "no seed in 1..60 produced a WOUNDED survivor — the sweep proved nothing");
  assert.ok(woundedHealth < maximum, "the swept survivor must actually be wounded");

  const carried = advance.teams
    .flatMap((team) => team.combatants)
    .find((combatant) => combatant.id === "hero" || combatant.id === "foe");
  assert.equal(carried.health, woundedHealth, "the wound carries: nothing here heals");
  assert.ok(carried.health < carried.maxHealth, "and it is still a wound in the next bout");
});

test("a survivor crossing to the other side is RE-FACED, and the correction is reported", () => {
  // Facing is per SIDE and load-bearing: `gladiator_dir` shapes the knockback
  // direction and the armour-debris draw. Read-back copies the measured
  // statuses verbatim, and `facing-left` is one of them, so a fighter moved
  // across the arena keeps a facing that belongs to the side he left.
  const blue = [fighter("hero", "Hero", CircuitSide.LEFT)];
  const red = [fighter("foe", "Foe", CircuitSide.RIGHT)];

  let advance = null;
  let movedId = null;
  for (let seed = 1; seed <= 60 && advance === null; seed += 1) {
    const battle = boutOf(
      [fighter("hero", "Hero", CircuitSide.LEFT)],
      [fighter("foe", "Foe", CircuitSide.RIGHT)],
      seed
    );
    const alive = battle.teams.flatMap((team) => team.combatants).filter((combatant) => combatant.alive);
    if (alive.length !== 1) continue;
    const survivor = alive[0];
    const facesLeft = (survivor.status ?? []).includes(SS2_FACING_LEFT);
    // Ask for the side OPPOSITE the one he is facing, so a correction is owed.
    const target = facesLeft ? CircuitSide.RIGHT : CircuitSide.LEFT;
    movedId = survivor.id;
    advance = advanceCircuit(battle, {
      blueprints: [...blue, ...red],
      challengers: {
        teamId: "challenger",
        name: "Challenger",
        combatants: [fighter("next", "Next", CircuitSide.RIGHT)],
        side: CircuitSide.RIGHT
      },
      sides: { [survivor.teamId]: target },
      battleId: `bout-${seed}`,
      recordedAt: "2026-09-07T00:00:00Z"
    });
    assert.deepEqual(
      advance.facingCorrections.map((entry) => entry.combatantId),
      [movedId],
      "the survivor whose side changed must be named"
    );
    assert.equal(advance.facingCorrections[0].to, target, "and the correction must name where he now faces");

    const carried = advance.teams.flatMap((team) => team.combatants).find((combatant) => combatant.id === movedId);
    const nowFacesLeft = carried.status.includes(SS2_FACING_LEFT);
    assert.equal(nowFacesLeft, target === CircuitSide.LEFT, "and the token must actually have been corrected");
  }
  assert.ok(advance, "no seed in 1..60 produced a single survivor — the sweep proved nothing");
});

test("a fighter who does NOT change sides is left alone, so the correction is not a blanket rewrite", () => {
  // The complement, and the one that stops the test above passing for a
  // function that rewrites every fighter's facing unconditionally.
  const blue = [fighter("hero", "Hero", CircuitSide.LEFT)];
  const red = [fighter("foe", "Foe", CircuitSide.RIGHT)];

  let checked = 0;
  for (let seed = 1; seed <= 60 && checked === 0; seed += 1) {
    const battle = boutOf(
      [fighter("hero", "Hero", CircuitSide.LEFT)],
      [fighter("foe", "Foe", CircuitSide.RIGHT)],
      seed
    );
    const alive = battle.teams.flatMap((team) => team.combatants).filter((combatant) => combatant.alive);
    if (alive.length !== 1) continue;
    const survivor = alive[0];
    const facesLeft = (survivor.status ?? []).includes(SS2_FACING_LEFT);
    const same = facesLeft ? CircuitSide.LEFT : CircuitSide.RIGHT;
    const advance = advanceCircuit(battle, {
      blueprints: [...blue, ...red],
      challengers: {
        teamId: "challenger",
        combatants: [fighter("next", "Next", CircuitSide.RIGHT)],
        side: CircuitSide.RIGHT
      },
      sides: { [survivor.teamId]: same },
      battleId: `bout-${seed}`,
      recordedAt: "2026-09-07T00:00:00Z"
    });
    assert.deepEqual(advance.facingCorrections, [], "asking for the side he already faces must correct nothing");
    checked += 1;
  }
  assert.equal(checked, 1, "no seed in 1..60 produced a single survivor — the sweep proved nothing");
});

test("bout -> record -> bout -> record: the survivor is measurably weaker the second time", () => {
  // THE ONE THAT CLOSES THE LOOP. Everything above checks one field or one
  // refusal; this runs an actual circuit and proves the carry is real by
  // showing the second bout starts from the first bout's end state.
  const blue = [fighter("hero", "Hero", CircuitSide.LEFT)];
  const red = [fighter("foe", "Foe", CircuitSide.RIGHT)];

  let first = null;
  let carriedHealth = null;
  let fullHealth = null;
  for (let seed = 1; seed <= 60 && first === null; seed += 1) {
    const battle = boutOf(
      [fighter("hero", "Hero", CircuitSide.LEFT)],
      [fighter("foe", "Foe", CircuitSide.RIGHT)],
      seed
    );
    const alive = battle.teams.flatMap((team) => team.combatants).filter((combatant) => combatant.alive);
    if (alive.length !== 1 || alive[0].health >= alive[0].maxHealth) continue;
    carriedHealth = alive[0].health;
    fullHealth = alive[0].maxHealth;
    first = advanceCircuit(battle, {
      blueprints: [...blue, ...red],
      challengers: {
        teamId: "challenger",
        name: "Challenger",
        combatants: [fighter("second", "Second", CircuitSide.RIGHT)],
        side: CircuitSide.RIGHT
      },
      battleId: "bout-1",
      recordedAt: "2026-09-07T00:00:00Z"
    });
  }
  assert.ok(first, "no seed in 1..60 produced a wounded survivor — the sweep proved nothing");
  assert.equal(first.teams.length, 2, "the next bout has two sides again");
  assert.ok(first.record, "the settled bout produced a record");

  // Bout two, built from what bout one returned. This is the whole point:
  // the teams handed back are directly constructible.
  const second = settle(
    createTeamBattle({
      seed: 21,
      rules: ss2TeamRules,
      teams: first.teams.map((team) => ({ id: team.id, name: team.name, combatants: team.combatants }))
    })
  );
  assert.ok(second.result, "the carried roster produced a real, settleable bout");

  // The carried fighter entered bout two below full health — measured, not
  // assumed, and the sweep above guarantees the case exists.
  assert.ok(carriedHealth < fullHealth);
  const enteredAt = first.teams
    .flatMap((team) => team.combatants)
    .find((combatant) => combatant.id === "hero" || combatant.id === "foe");
  assert.equal(enteredAt.health, carriedHealth, "bout two began from bout one's measured end health");

  // And the loop can keep going: bout two settles, so it too can be advanced.
  const third = advanceCircuit(second, {
    blueprints: first.teams.flatMap((team) => team.combatants),
    challengers: {
      teamId: "challenger-2",
      combatants: [fighter("third", "Third", CircuitSide.RIGHT)],
      side: CircuitSide.RIGHT
    },
    battleId: "bout-2",
    recordedAt: "2026-09-07T00:01:00Z"
  });
  assert.ok(third.record, "a circuit is not limited to two bouts");
  assert.notEqual(third.record.battleId, first.record.battleId, "each bout writes its own record");
});
