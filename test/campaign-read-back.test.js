/**
 * `src/campaign/to-battle.js` — the read side of the campaign record.
 *
 * WHY THIS FILE EXISTS. `src/campaign/` could write a record, validate it,
 * migrate it across schema versions, key it by content and quarantine it when
 * corrupt, and NOTHING COULD READ ONE BACK INTO A BATTLE. `docs/roadmap.md`
 * said exactly that: "a record is written and never read back into a battle,
 * and nothing pays a reward". It is the same shape as the defect this project
 * already found one layer down, when 22 runtime-verified goldens fed nothing.
 *
 * The last test in this file is the one that matters: bout -> record -> roster
 * -> bout. Everything above it checks a single refusal or a single carried
 * field; that one closes the loop.
 *
 * WHAT IS DELIBERATELY NOT TESTED HERE, because it is deliberately not built:
 * rewards, healing between bouts, revival, levelling and re-equipping. Every
 * one is a progression decision belonging to the design track, where EP-D04 is
 * still pending. A seam that healed the survivors would be a balance choice
 * wearing the costume of a data structure.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  acknowledgeResultAnimation,
  applyAction,
  BATTLE_RESULT_ACK_TYPE,
  combatantById,
  createTeamBattle,
  currentCombatant,
  legalActions,
  pendingResultEvent
} from "../src/team/index.js";
import { ss2Combatant, ss2TeamRules, Ss2ActionType, ss2StatusToken } from "../src/team/ss2-rules.js";
import { buildCampaignRecord, CampaignRecordError, rosterFromCampaignRecord } from "../src/campaign/index.js";

function gladiator(overrides = {}) {
  return {
    strength: 5, speed: 5, attack: 9, defence: 1, vitality: 2, stamina: 4,
    magicka: 0, charisma: 3, herolevel: 2, character_level: 2,
    weapon_min_damage: 3, weapon_max_damage: 9,
    ...overrides
  };
}

/** A finished bout: its record, and the blueprints it was built from. */
function settledBout({ heroFields = {}, villainFields = {}, seed = 11, heroStatus = null } = {}) {
  const blueprints = [
    ss2Combatant(gladiator({ speed: 9, ...heroFields }), { id: "hero", name: "Hero", controller: "local" }),
    ss2Combatant(
      gladiator({ vitality: 0, herolevel: 1, ...villainFields }),
      { id: "villain", name: "Villain", controller: "local" }
    )
  ];
  const battle = createTeamBattle({
    seed,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "Red", combatants: [blueprints[0]] },
      { id: "blue", name: "Blue", combatants: [blueprints[1]] }
    ]
  });
  if (heroStatus) combatantById(battle, "hero").status = heroStatus;

  let guard = 0;
  while (!battle.result && guard < 80) {
    guard += 1;
    const actor = currentCombatant(battle);
    const options = legalActions(battle);
    const chosen = options.find((option) => option.type === Ss2ActionType.POWER_ATTACK) ?? options[0];
    applyAction(battle, { actorId: actor.id, ...chosen });
  }
  assert.ok(battle.result, "the bout must settle, or these tests measure nothing");

  acknowledgeResultAnimation(battle, {
    type: BATTLE_RESULT_ACK_TYPE,
    completionToken: pendingResultEvent(battle).completionToken
  });
  const record = buildCampaignRecord(battle, {
    battleId: "bout-1",
    writer: { id: "campaign-read-back-test", version: "1" }
  });
  return { battle, record, blueprints };
}

test("a record needs its blueprints, and the refusal says WHY", () => {
  // The load-bearing fact about the record format: `outcomes` carry survival,
  // health, maxHealth and statuses, and carry NO stats, loadout or resources.
  // So a record cannot rebuild a gladiator alone — it has no strength, no
  // damage pair, no armour and no stamina — and a seam that filled those in
  // would be inventing evidence.
  const { record } = settledBout();
  for (const outcome of record.outcomes) {
    assert.ok(Object.hasOwn(outcome, "health"), "the outcome carries the measured health");
    assert.ok(!Object.hasOwn(outcome, "stats"), "and deliberately not the stats");
    assert.ok(!Object.hasOwn(outcome, "resources"), "nor the resources");
    assert.ok(!Object.hasOwn(outcome, "loadout"), "nor the loadout");
  }
  assert.throws(
    () => rosterFromCampaignRecord(record),
    (error) => error instanceof CampaignRecordError && /carries outcomes/.test(error.message)
  );
});

test("the survivor carries his MEASURED end state, not a fresh one", () => {
  // The whole point of reading a record back. A campaign in which everyone
  // starts each bout at full health is a series of unrelated fights.
  const { record, blueprints, battle } = settledBout({ villainFields: { attack: 9, strength: 8, vitality: 3 } });
  const measured = combatantById(battle, "hero").health;
  // WITHOUT THIS THE TEST CAN GO VACUOUS. If the winner ends untouched,
  // "carries his measured health" and "starts fresh" are the same number and
  // the assertion below proves nothing. Measured: this fixture leaves him at
  // 25/60 after 13 turns; a future edit that makes the bout one-sided has to
  // fail here rather than quietly stop testing anything.
  assert.ok(
    measured < blueprints[0].maxHealth,
    `the surviving hero must end WOUNDED for this test to mean anything (${measured}/${blueprints[0].maxHealth})`
  );
  const { teams, carried } = rosterFromCampaignRecord(record, { blueprints });

  const hero = teams.find((team) => team.id === "red").combatants[0];
  assert.equal(hero.health, measured, "the next bout starts where the last one ended");
  assert.notEqual(hero.health, undefined);
  assert.equal(carried.find((entry) => entry.combatantId === "hero").health, measured);

  // And nothing else about him moved: the blueprint still owns who he is.
  assert.deepEqual(hero.stats, blueprints[0].stats, "read-back must not touch the stats");
  assert.deepEqual(hero.resources, blueprints[0].resources, "nor the resources");
  assert.equal(hero.maxHealth, blueprints[0].maxHealth, "nor the maximum");
});

test("the fallen are NAMED, neither silently dropped nor silently revived", () => {
  // Deciding what a campaign does about a dead gladiator is a rule about the
  // game. This is a rule about a file, so it reports and does not decide.
  const { record, blueprints } = settledBout();
  const { teams, fallen } = rosterFromCampaignRecord(record, { blueprints });

  assert.deepEqual(fallen.map((entry) => entry.combatantId), ["villain"]);
  assert.equal(fallen[0].name, "Villain", "named, so a caller can say who died without re-reading the record");
  assert.equal(fallen[0].teamId, "blue");

  const blue = teams.find((team) => team.id === "blue");
  assert.deepEqual(blue.combatants, [], "the slot is left EMPTY rather than backfilled");
  assert.equal(teams.find((team) => team.id === "red").combatants.length, 1);
});

test("includeFallen carries the dead at the health the record measured, which is zero", () => {
  const { record, blueprints } = settledBout();
  const { teams, fallen } = rosterFromCampaignRecord(record, { blueprints, includeFallen: true });
  assert.deepEqual(fallen, [], "nobody is reported missing when everybody is carried");
  const villain = teams.find((team) => team.id === "blue").combatants[0];
  assert.equal(villain.id, "villain");
  assert.equal(villain.health, 0, "carried as measured — this is not a revival");
});

/** A settled 2v2 whose blue side wields enchanted weapons. */
function settledTeamBout(seed) {
  const blueprints = [
    // THE SPEEDS ARE THE EXPERIMENT, and getting them backwards produced zero
    // survivors carrying a condition across 80 seeds — twice.
    //
    // For a condition to outlive a bout its bearer must never get a turn to
    // burn it off, so the bearer has to act BEFORE the enemy that procs it and
    // a TEAMMATE has to land the killing blow AFTER. Initiative is by speed, so
    // that is: bearer fastest (Red 1, 12), enemies in the middle (5), the
    // teammate who finishes it slowest (Red 2, 1). Measured with those speeds:
    // 23 of 80 seeds proc at all and 8 leave a survivor still afflicted.
    ss2Combatant(gladiator({ speed: 12 }), { id: "red-1", name: "Red 1", controller: "local" }),
    ss2Combatant(gladiator({ speed: 1, strength: 9 }), { id: "red-2", name: "Red 2", controller: "local" }),
    ss2Combatant(
      gladiator({ vitality: 0, herolevel: 1, weapon_enchantment_type: 2, weapon_enchantment_potency: 3 }),
      { id: "blue-1", name: "Blue 1", controller: "local" }
    ),
    ss2Combatant(
      gladiator({ vitality: 0, herolevel: 1, weapon_enchantment_type: 2, weapon_enchantment_potency: 3 }),
      { id: "blue-2", name: "Blue 2", controller: "local" }
    )
  ];
  const battle = createTeamBattle({
    seed,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "Red", combatants: [blueprints[0], blueprints[1]] },
      { id: "blue", name: "Blue", combatants: [blueprints[2], blueprints[3]] }
    ]
  });
  let guard = 0;
  while (!battle.result && guard < 200) {
    guard += 1;
    const actor = currentCombatant(battle);
    const options = legalActions(battle);
    const chosen = options.find((option) => option.type === Ss2ActionType.POWER_ATTACK) ?? options[0];
    applyAction(battle, { actorId: actor.id, ...chosen });
  }
  if (!battle.result) return null;
  acknowledgeResultAnimation(battle, {
    type: BATTLE_RESULT_ACK_TYPE,
    completionToken: pendingResultEvent(battle).completionToken
  });
  return {
    battle,
    blueprints,
    record: buildCampaignRecord(battle, {
      battleId: `team-bout-${seed}`,
      writer: { id: "campaign-read-back-test", version: "1" }
    })
  };
}

test("a condition CANNOT cross a 1v1 boundary, and the reason is structural", () => {
  // Worth pinning as a fact about the game rather than discovering it twice.
  // A condition takes its bearer's very NEXT turn, so a gladiator can never
  // land a killing blow while carrying one — and if the bearer is the one who
  // dies, `death()` clears it. So at 1v1 the surviving side is always clean.
  //
  // This was found by a sweep that expected the opposite and returned nothing.
  for (let seed = 1; seed <= 40; seed += 1) {
    const bout = settledBout({
      seed,
      heroStatus: [ss2StatusToken("burning", "villain")],
      villainFields: { vitality: 3 }
    });
    for (const outcome of bout.record.outcomes) {
      if (!outcome.survived) continue;
      assert.deepEqual(
        outcome.statuses, [],
        `seed ${seed}: ${outcome.combatantId} survived carrying ${outcome.statuses.join(",")}, ` +
        "which the status phase should have consumed on its own turn"
      );
    }
  }
});

test("conditions cross the bout boundary, because nothing in the build clears them there", () => {
  // death() clears conditions on a KILL, which happens inside a bout. Nothing
  // clears them at a boundary, so carrying them is the faithful default. A
  // campaign that wants a clean slate has to say so out loud.
  // SWEPT, not assumed, and asserted to have found one. The first version of
  // this test returned early when the bout happened to consume the condition
  // mid-fight — which is most of the time, since a condition takes its bearer's
  // very next turn. An early return is a test that passes by not running.
  // It takes a TEAM fight, and that is the finding: a condition survives a bout
  // only when a TEAMMATE ends it, leaving the afflicted fighter no turn in
  // which to burn it off. The 1v1 test above proves the other half.
  //
  // Swept and asserted to have found one. An early return here would be a test
  // that passes by not running.
  let found = null;
  for (let seed = 1; seed <= 80 && found === null; seed += 1) {
    const bout = settledTeamBout(seed);
    if (bout === null) continue;
    const outcome = bout.record.outcomes.find((entry) => entry.survived && entry.statuses.length > 0);
    if (outcome) found = { ...bout, outcome };
  }
  assert.ok(found, "no seed left a survivor carrying a condition; this test would prove nothing");

  const { teams } = rosterFromCampaignRecord(found.record, { blueprints: found.blueprints });
  const carriedFighter = teams
    .flatMap((team) => team.combatants)
    .find((combatant) => combatant.id === found.outcome.combatantId);
  assert.deepEqual(
    carriedFighter.status,
    found.outcome.statuses,
    "a condition still standing at the end of a bout is still standing at the start of the next"
  );
  assert.ok(
    found.outcome.statuses.some((token) => token.startsWith("burning")),
    "and it is a real condition, inflicted in the fight rather than staged"
  );
});

test("a roster from a DIFFERENT bout is refused, in both directions", () => {
  const { record, blueprints } = settledBout();

  const extra = [...blueprints, ss2Combatant(gladiator(), { id: "stranger", name: "Stranger" })];
  assert.throws(
    () => rosterFromCampaignRecord(record, { blueprints: extra }),
    (error) => error instanceof CampaignRecordError && /different bout/.test(error.message),
    "a blueprint the record never mentions means the caller mixed up two bouts"
  );

  assert.throws(
    () => rosterFromCampaignRecord(record, { blueprints: [blueprints[0]] }),
    (error) => error instanceof CampaignRecordError && /no blueprint supplies/.test(error.message),
    "and a combatant with no blueprint cannot be rebuilt at all"
  );
});

test("a blueprint that disagrees with the record about maxHealth is refused, not reconciled", () => {
  // Picking one would silently decide which of two gladiators this is.
  const { record, blueprints } = settledBout();
  const tampered = [{ ...blueprints[0], maxHealth: blueprints[0].maxHealth + 1 }, blueprints[1]];
  assert.throws(
    () => rosterFromCampaignRecord(record, { blueprints: tampered }),
    (error) => error instanceof CampaignRecordError && /not this gladiator/.test(error.message)
  );
});

test("slot order comes from the record, so everyone stands where they stood", () => {
  const { record, blueprints } = settledBout();
  const { teams } = rosterFromCampaignRecord(record, { blueprints, includeFallen: true });
  for (const team of teams) {
    const recorded = record.teams.find((entry) => entry.teamId === team.id);
    const expected = [...recorded.slots]
      .sort((left, right) => left.slotIndex - right.slotIndex)
      .map((slot) => slot.combatantId);
    assert.deepEqual(team.combatants.map((combatant) => combatant.id), expected, team.id);
  }
});

/* ------------------------------------------------------------------ */
/* The loop, closed                                                     */
/* ------------------------------------------------------------------ */

test("bout -> record -> roster -> BOUT: the record finally feeds something", () => {
  // Everything above checks one refusal or one field. This is the claim the
  // file exists for, and until it passed, `src/campaign/` was a filing cabinet.
  const first = settledBout({ villainFields: { attack: 9, strength: 8, vitality: 3 } });
  const carriedHealth = combatantById(first.battle, "hero").health;

  const { teams, fallen } = rosterFromCampaignRecord(first.record, { blueprints: first.blueprints });

  // A survivor alone cannot fight: the loser's slot is empty by design, so the
  // caller — a campaign — supplies the next opponent. That IS the seam working;
  // read-back carries a roster forward, it does not invent a challenger.
  assert.equal(fallen.length, 1);
  const challenger = ss2Combatant(
    gladiator({ vitality: 0, herolevel: 1 }),
    { id: "challenger", name: "Challenger", controller: "local" }
  );
  const next = createTeamBattle({
    seed: 12,
    rules: ss2TeamRules,
    teams: [
      teams.find((team) => team.id === "red"),
      { id: "blue", name: "Blue", combatants: [challenger] }
    ]
  });

  assert.equal(
    combatantById(next, "hero").health,
    carriedHealth,
    "the second bout begins at the health the first one ended on"
  );
  assert.ok(legalActions(next).length > 0, "and it is a real battle: somebody can act");

  let guard = 0;
  while (!next.result && guard < 80) {
    guard += 1;
    const actor = currentCombatant(next);
    const options = legalActions(next);
    applyAction(next, { actorId: actor.id, ...(options.find((o) => o.type === Ss2ActionType.POWER_ATTACK) ?? options[0]) });
  }
  assert.ok(next.result, "the carried-forward bout settles like any other");
});
