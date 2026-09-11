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

test("a roster of the fallen is reported UNPLAYABLE rather than handed over as if it would fight", () => {
  // The first version of this seam said such a battle would "settle instantly".
  // It does not — it STALLS, and an independent review measured it: the roster
  // constructs, initiative includes the dead, and when a dead fighter holds the
  // turn there are ZERO legal actions and NO result, permanently.
  //
  // At 1v1 the loser's team is exactly that case, so `includeFallen` there is
  // always a stall. Refusing is the same judgement the rule set already makes
  // about a `staminamax <= 0` fixpoint: a battle that cannot change state is
  // not a battle.
  const { record, blueprints } = settledBout();
  const withFallen = rosterFromCampaignRecord(record, { blueprints, includeFallen: true });
  assert.equal(withFallen.playable, false, "a team of corpses cannot take a turn");
  assert.deepEqual(withFallen.unplayableTeamIds, ["blue"], "and the seam names which team");

  // Refusing outright was the FIRST fix and it was wrong: a settled bout always
  // has a wholly eliminated team, so refusing would have banned includeFallen's
  // only honest use — looking at who was there. Reporting is right; the
  // reported VALUE was not.
  //
  // ► **CORRECTED 2026-09-07. These two lines used to assert
  //   `survivors.playable === true` and `unplayableTeamIds === []`, and both
  //   were wrong.** The survivors-only roster of a settled 1v1 has an
  //   eliminated team holding zero combatants, and `createTeamBattle` refuses
  //   it — *"Each team must contain one to three combatants."* The assertion
  //   passed only because it checked the flag and never built the battle the
  //   flag is a promise about. See the contract test at the bottom of this
  //   file, which proves `playable` against `createTeamBattle` instead.
  //
  //   What a caller learns from `playable: false` here is the useful thing:
  //   carrying survivors forward is not replaying this bout, it is building
  //   the NEXT one, and the empty side has to be refilled with a fresh
  //   opponent before anybody can fight.
  const survivors = rosterFromCampaignRecord(record, { blueprints });
  assert.equal(survivors.playable, false, "the eliminated side is empty, so this roster cannot be fielded as-is");
  assert.deepEqual(survivors.unplayableTeamIds, ["blue"], "and the seam names the side needing a fresh opponent");
});

test("includeFallen DOES carry a casualty whose team still has somebody standing", () => {
  // The legitimate use, and the one that proves the refusal above is a guard
  // rather than a ban: a 2v2 where one side loses a fighter but not the fight.
  let bout = null;
  for (let seed = 1; seed <= 80 && bout === null; seed += 1) {
    const candidate = settledTeamBout(seed, "costly");
    if (candidate === null) continue;
    const byTeam = new Map();
    for (const outcome of candidate.record.outcomes) {
      const entry = byTeam.get(outcome.teamId) ?? { alive: 0, dead: 0 };
      entry[outcome.survived ? "alive" : "dead"] += 1;
      byTeam.set(outcome.teamId, entry);
    }
    if ([...byTeam.values()].some((entry) => entry.alive > 0 && entry.dead > 0)) bout = candidate;
  }
  assert.ok(bout, "no seed produced a team that lost a fighter but not the fight");

  const { teams, fallen } = rosterFromCampaignRecord(bout.record, {
    blueprints: bout.blueprints,
    includeFallen: true
  });
  assert.deepEqual(fallen, [], "nobody is reported missing when everybody is carried");
  const casualty = teams
    .flatMap((team) => team.combatants)
    .find((combatant) => combatant.health === 0);
  assert.ok(casualty, "the casualty must be carried, at the health the record measured");
  assert.equal(casualty.health, 0, "carried as measured — this is not a revival");
});

/**
 * A settled 2v2. Two shapes, because two different things need to happen.
 *
 * `"afflicted"` is tuned so a CONDITION survives the bout: the bearer must act
 * before the enemy that procs it and a teammate must land the kill after, so
 * initiative runs bearer-fastest and finisher-slowest. Measured: 23 of 80 seeds
 * proc, 8 leave a survivor afflicted — and its reds are strong enough that
 * neither of them dies.
 *
 * `"costly"` is tuned so a TEAM LOSES A FIGHTER BUT NOT THE FIGHT, which the
 * seat and casualty tests need and which the afflicted shape never produces.
 * Measured: 65 of 80 seeds leave a team mixed, every one of them with the
 * slot-0 fighter dead and a survivor behind. It procs nothing.
 */
function settledTeamBout(seed, shape = "afflicted") {
  const blueprints = shape === "costly" ? [
    ss2Combatant(gladiator({ speed: 12, vitality: 0, herolevel: 1 }), { id: "red-1", name: "Red 1", controller: "local" }),
    ss2Combatant(gladiator({ speed: 1, strength: 9, vitality: 6 }), { id: "red-2", name: "Red 2", controller: "local" }),
    ss2Combatant(
      gladiator({ vitality: 1, weapon_enchantment_type: 2, weapon_enchantment_potency: 3 }),
      { id: "blue-1", name: "Blue 1", controller: "local" }
    ),
    ss2Combatant(
      gladiator({ vitality: 1, weapon_enchantment_type: 2, weapon_enchantment_potency: 3 }),
      { id: "blue-2", name: "Blue 2", controller: "local" }
    )
  ] : [
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
  while (!battle.result && guard < 300) {
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

test("no 1v1 in this sweep leaves a survivor afflicted, and the reason it holds is narrow", () => {
  // The mechanism: a condition takes its bearer's very NEXT turn, so a
  // gladiator never lands a killing blow while carrying one — and if the bearer
  // is the one who dies, `death()` clears the other side too.
  //
  // ► **STATED AS A SWEEP, NOT AS A LAW, and that is a correction.** This test
  //   was called "a condition CANNOT cross a 1v1 boundary" and an independent
  //   review broke the universal within the hour: with two tokens naming one
  //   condition, the inflictor's death-clear took only the first and a survivor
  //   walked out of a 1v1 still alight. That hole is now closed and pinned in
  //   `test/ss2-team-rules.test.js`, and this sweep passes again — but the
  //   lesson is that "cannot" was a claim about every reachable state and this
  //   test only ever visited forty of them. It asserts what it visits.
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
  // ► **THE SWEEP THAT USED TO STAND HERE IS GONE, and the reason is a
  //   MEASURED consequence of `ss2InitiativeOrder` (2026-09-10, D3).**
  //
  //   It swept 80 seeds for a bout that naturally left a survivor carrying a
  //   condition, and its blueprint said so explicitly: *"the bearer has to act
  //   BEFORE the enemy that procs it and a TEAMMATE has to land the killing
  //   blow AFTER ... bearer fastest (12), enemies in the middle (5), the
  //   teammate who finishes it slowest (1)."* **That ordering only exists
  //   under a FLAT cross-team agility sort.** Sides alternate now, so every
  //   fighter acts once per round evenly spaced, and an afflicted fighter
  //   almost always gets a turn in which to burn the condition off.
  //
  //   Measured before this test was touched: **0 of 300 seeds left a living
  //   afflicted survivor**, at 2v2 and at 3v3, and across three different
  //   blueprint designs (fragile fast bearer, tanky fast bearer, slowest-in-
  //   side bearer starting afflicted). The old vacuity guard did its job — it
  //   refused to pass rather than quietly prove nothing.
  //
  //   **The CLAIM under test never depended on that sweep**: it is that
  //   read-back carries a survivor's statuses into the next bout. So the input
  //   is now constructed directly and the test is deterministic. What the
  //   sweep used to prove — that the situation arises in play — is no longer
  //   true often enough to sweep for, and is recorded as a finding in
  //   `docs/combat-economy-findings-2026-09-10.md` rather than asserted here.
  //   **If you make conditions survive bouts again, restore a sweep.**
  const bout = settledTeamBout(1);
  assert.ok(bout, "the 2v2 must settle");
  const survivor = bout.battle.teams
    .flatMap((team) => team.combatants)
    .find((combatant) => combatant.alive);
  assert.ok(survivor, "a settled bout has a survivor");

  // Constructed, not swept — and this file already mutates battle state
  // directly elsewhere for exactly this kind of setup.
  survivor.status = ["burning:from=blue-1"];
  const record = buildCampaignRecord(bout.battle, {
    battleId: "team-bout-constructed-condition",
    writer: { id: "campaign-read-back-test", version: "1" }
  });
  const outcome = record.outcomes.find((entry) => entry.combatantId === survivor.id);
  assert.ok(outcome?.survived, "the constructed bearer must be recorded as a survivor");
  assert.deepEqual(outcome.statuses, ["burning:from=blue-1"], "the record must carry it");

  const found = { record, blueprints: bout.blueprints, outcome };

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

test("a survivor behind a casualty CHANGES SEAT, and the change is reported not hidden", () => {
  // This test used to be called "everyone stands where they stood", which was
  // false and was my claim. `createTeamBattle` assigns `seatId` from the ARRAY
  // INDEX and there is no vacant-seat marker to hold a dead fighter's place —
  // `"empty"` means AI-FILL, and an SS2 team containing one is refused outright
  // because the fill template declares none of the required resources
  // (measured). So a survivor behind a casualty moves up, and the honest thing
  // is to say so.
  let bout = null;
  for (let seed = 1; seed <= 80 && bout === null; seed += 1) {
    const candidate = settledTeamBout(seed, "costly");
    if (candidate === null) continue;
    // Want a team whose slot-0 fighter died and whose slot-1 fighter lived.
    const dead = candidate.record.outcomes.find((outcome) => !outcome.survived && outcome.slotIndex === 0);
    if (!dead) continue;
    const behind = candidate.record.outcomes.find(
      (outcome) => outcome.survived && outcome.teamId === dead.teamId && outcome.slotIndex > 0
    );
    if (behind) bout = { ...candidate, dead, behind };
  }
  assert.ok(bout, "no seed produced a surviving fighter standing behind a casualty");

  const { teams, seatChanges } = rosterFromCampaignRecord(bout.record, { blueprints: bout.blueprints });
  const moved = seatChanges.find((change) => change.combatantId === bout.behind.combatantId);
  assert.ok(moved, `${bout.behind.combatantId} moved up a slot and that must be reported`);
  assert.equal(moved.fromSlotIndex, bout.behind.slotIndex);
  assert.equal(moved.toSlotIndex, bout.behind.slotIndex - 1);
  assert.equal(moved.fromSeatId, `${bout.behind.teamId}:slot-${bout.behind.slotIndex + 1}`);

  // And the relative order within the team is still the record's.
  const team = teams.find((entry) => entry.id === bout.behind.teamId);
  const expected = [...bout.record.teams
    .find((entry) => entry.teamId === bout.behind.teamId).slots]
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map((slot) => slot.combatantId)
    .filter((id) => bout.record.outcomes.find((outcome) => outcome.combatantId === id).survived);
  assert.deepEqual(team.combatants.map((combatant) => combatant.id), expected);
});

test("nobody moves seat when nobody falls, so seatChanges stays empty", () => {
  const { record, blueprints } = settledBout();
  const { seatChanges } = rosterFromCampaignRecord(record, { blueprints });
  // At 1v1 the survivor was already in slot 0; the casualty is on the other
  // team and its own slot 0 simply empties.
  assert.deepEqual(seatChanges, [], "a report that fires when nothing moved is noise");
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

test("`playable` is PROVED against createTeamBattle, not asserted — and it was wrong for the commonest roster there is", () => {
  // WHAT THIS CAUGHT. `playable` had exactly one consumer contract, stated in
  // to-battle.js's own comment: "A caller building a battle checks `playable`".
  // It reported TRUE for the survivors-only roster of an ordinary settled 1v1
  // — and `createTeamBattle` REFUSES that roster, because the eliminated team
  // carries zero combatants and a team must hold one to three.
  //
  // The test above asserted `survivors.playable === true` and never built a
  // battle, so it confirmed the flag rather than the promise. That is this
  // project's signature failure — a universal asserted from a shape rather
  // than measured — and it is the THIRD wrong claim this seam has made about
  // `playable`. The first said a roster of corpses settles instantly (it
  // stalls); the second refused such a roster outright (which banned
  // `includeFallen`'s only honest use).
  //
  // So this test does not assert a value. It asserts the CONTRACT: whatever
  // `playable` says, `createTeamBattle` agrees with it. A future change to
  // either side has to keep them agreeing.
  const cases = [
    { label: "survivors-only, settled 1v1", ...settledBout(), includeFallen: false },
    { label: "including the fallen, settled 1v1", ...settledBout(), includeFallen: true }
  ];

  // ► **THE FIRST VERSION OF THIS SWEEP HAD A DEAD BRANCH, found by an
  //   independent Codex review within the hour.** Both cases report
  //   `playable: false`, so the arm checking the actual promise — that a
  //   playable roster CONSTRUCTS — never ran. I guarded against the vacuous
  //   shape in one direction and walked straight into its mirror image.
  //
  //   Chasing it produced a better finding than the fix: `playable` cannot be
  //   true here AT ALL. See the invariant test below. So this sweep no longer
  //   pretends the positive arm is reachable; it asserts the direction that
  //   exists, in BOTH directions, and the separate test pins why.
  let sawPlayableFalse = false;
  let sawRefusal = false;
  let sawWalkover = false;
  for (const { label, record, blueprints, includeFallen } of cases) {
    const roster = rosterFromCampaignRecord(record, { blueprints, includeFallen });

    let constructs = true;
    let refusal = null;
    let built = null;
    try {
      built = createTeamBattle({
        seed: 3,
        rules: ss2TeamRules,
        teams: roster.teams.map((team) => ({ id: team.id, name: team.name, combatants: team.combatants }))
      });
    } catch (error) {
      constructs = false;
      refusal = error.message;
    }

    if (roster.playable) {
      assert.ok(
        constructs,
        `${label}: playable said true, but createTeamBattle refused it — ${refusal}`
      );
    } else {
      sawPlayableFalse = true;
      // ► **"UNPLAYABLE" HAS TWO DIFFERENT FAILURE MODES and an earlier
      //   version of this assertion flattened them into one, which failed.**
      //   An EMPTY side is refused by `createTeamBattle` outright. A side
      //   holding only CORPSES is ACCEPTED and then stalls — initiative
      //   includes the dead, and when a dead fighter holds the turn there are
      //   zero legal actions and no result, permanently. Both mean "cannot be
      //   fielded"; only one of them throws.
      //
      //   So the assertion is per mode, and each is PROVED rather than named.
      const hasEmptySide = roster.teams.some((team) => team.combatants.length === 0);
      if (hasEmptySide) {
        assert.ok(!constructs, `${label}: an empty side must be refused by createTeamBattle`);
        assert.match(refusal ?? "", /one to three combatants/, `${label}: and refused for that reason`);
        sawRefusal = true;
      } else {
        // ► **MEASURED, AND IT IS NOT WHAT THIS FILE USED TO SAY.** The
        //   comment in `to-battle.js` describes an unplayable roster as
        //   STALLING — "initiative includes the dead, zero legal actions, no
        //   result, permanently". That is not this case and I could not
        //   reproduce it here. `includeFallen` at 1v1 does not produce a
        //   roster of corpses: it produces the LIVE WINNER (measured at 88 of
        //   88 for seed 11) alongside the loser's body. So it constructs, the
        //   survivor has an action, and the battle settles at once because the
        //   other side is already eliminated.
        //
        //   `playable: false` is still right, and for a better reason than
        //   "it stalls": red cannot field anybody, so this is not a contest —
        //   it is a walkover that settles before the dead side ever acts.
        //   A genuinely all-corpses roster needs a DRAW to produce it, which
        //   this helper does not build, so the stall claim stays UNVERIFIED
        //   here rather than being repeated as though it were checked.
        assert.ok(constructs, `${label}: a roster with a live survivor constructs`);
        const actor = currentCombatant(built);
        assert.ok(actor?.alive, `${label}: the fighter holding the turn is the survivor, not a corpse`);
        assert.ok(legalActions(built).length > 0, `${label}: and he has something he may do`);

        applyAction(built, { ...legalActions(built)[0], actorId: actor.id });
        assert.ok(
          built.result,
          `${label}: with one side already eliminated the bout settles at once rather than being fought`
        );
        sawWalkover = true;
      }
      // Named, so an unplayable roster tells a caller WHICH team it cannot field.
      assert.ok(
        roster.unplayableTeamIds.length > 0,
        `${label}: reported unplayable without naming a team`
      );
    }
  }

  // SWEEP, THEN ASSERT YOU FOUND THE CASE. Without this the loop passes by
  // visiting only playable rosters, which is the vacuous-test shape this
  // repository has shipped twice.
  assert.ok(sawPlayableFalse, "no case exercised the unplayable branch — the sweep proved nothing");
  assert.ok(sawRefusal, "no case exercised the EMPTY-SIDE mode, which is the one this test was written for");
  assert.ok(sawWalkover, "no case exercised the WALKOVER mode, so the two failure shapes were never distinguished");
});

test("an eliminated team's EMPTY slot list makes a roster unplayable, and the seam names it", () => {
  // The specific hole: `unplayable` filtered to teams with combatants BEFORE
  // asking whether any could fight, so a team with zero fighters — which every
  // settled bout produces — was skipped rather than flagged.
  const { record, blueprints } = settledBout();
  const roster = rosterFromCampaignRecord(record, { blueprints });

  const emptyTeams = roster.teams.filter((team) => team.combatants.length === 0).map((team) => team.id);
  assert.deepEqual(emptyTeams, ["blue"], "the settled bout's loser is the empty team");
  assert.equal(roster.playable, false, "a roster missing a whole side cannot be fielded");
  assert.deepEqual(roster.unplayableTeamIds, ["blue"], "and the caller is told which side to refill");
});


test("INVARIANT: a roster derived from a settled record is NEVER playable, and that is structural", () => {
  // WHY THIS IS NOT A STATISTICAL CLAIM. A campaign record can only be built
  // from a SETTLED battle; settlement requires that at most one team still has
  // a standing combatant; so read-back always yields at least one side with
  // nobody alive. There is no input that makes `playable` true.
  //
  // Swept anyway, because this project's signature failure is a universal
  // asserted from a handful of cases and the argument above is exactly the
  // shape that has been wrong here before. Both bout shapes this file can
  // build — 1v1 and 2v2 — across twenty seeds, both `includeFallen` settings.
  //
  // WHAT A CALLER SHOULD READ INSTEAD is `unplayableTeamIds`, which names the
  // sides needing a fresh opponent. `src/campaign/circuit.js` uses exactly
  // that, and refills them.
  let rosters = 0;
  let everPlayable = 0;
  const shapesSeen = new Set();

  for (let seed = 1; seed <= 20; seed += 1) {
    const bouts = [
      { shape: "1v1", ...settledBout({ seed }) },
      (() => {
        const team = settledTeamBout(seed, "costly");
        return team === null ? null : { shape: "2v2", ...team };
      })()
    ].filter(Boolean);

    for (const bout of bouts) {
      shapesSeen.add(bout.shape);
      for (const includeFallen of [false, true]) {
        const roster = rosterFromCampaignRecord(bout.record, { blueprints: bout.blueprints, includeFallen });
        rosters += 1;
        if (roster.playable) everPlayable += 1;
        assert.ok(
          roster.unplayableTeamIds.length > 0,
          `${bout.shape} seed ${seed}: an unplayable roster must NAME the side to refill`
        );
      }
    }
  }

  // SWEEP, THEN ASSERT YOU FOUND THE CASE — twice over, because a sweep that
  // reached only one bout shape would prove far less than it appears to.
  assert.ok(rosters >= 40, `the sweep must actually visit rosters; saw ${rosters}`);
  assert.deepEqual([...shapesSeen].sort(), ["1v1", "2v2"], "both bout shapes must have been reached");
  assert.equal(
    everPlayable,
    0,
    "a record-derived roster became playable — if that is now genuinely reachable, the comment in " +
    "src/campaign/to-battle.js calling this structural is wrong and must be corrected, not this assertion"
  );
});
