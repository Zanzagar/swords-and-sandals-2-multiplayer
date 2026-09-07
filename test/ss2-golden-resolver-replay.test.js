/**
 * The 23 promoted goldens, replayed through the THING THAT WOULD BE THE GAME.
 *
 * WHY THIS FILE EXISTS. Every golden already replays exactly — through
 * `src/golden/run-1v1-fixture.js`, a standalone harness that imports nothing
 * from `src/team/`. So the corpus proved the arithmetic and proved nothing
 * about the resolver, the roster, the RNG channel, effect application or
 * clamping. Twenty-three runtime-verified fixtures had no consumer. This file is
 * that consumer: it builds a real `createTeamBattle`, applies a real action,
 * and requires the measured outcome to come back out the other side.
 *
 * The standalone suite is deliberately NOT deleted. It checks the vanilla-
 * shaped `mutationTrace` and `state`, which the resolver does not produce, so
 * removing it would cost the byte-level trace its only check.
 *
 * ## What this proves, and what it cannot
 *
 * PROVES: the direction draw, the whole ordered draw sequence (tape mode
 * refuses a wrong label, source or bound at the exact cursor), the arithmetic's
 * full return, and the translation of that return into the one declarative
 * effect these fixtures produce on the defender.
 *
 * CANNOT PROVE, and the limit is the corpus, not the harness: 22 of the 23
 * stage `armourclass 0` with all eight piece ids 0 and no enchantment; the hero
 * wins 19, misses 3, and lands one non-lethal hit. On the DEFENDER they
 * exercise one effect kind, `damage`. Piece destruction, the breastplate
 * stamina join and enchantment status have ZERO runtime backing here — see
 * `test/ss2-team-rules.test.js`, which cross-checks those against the
 * arithmetic itself and says plainly that a cross-check between two paths over
 * one module is not evidence about the build.
 *
 * ► **CORRECTED 2026-09-07, and in the direction that makes the corpus BETTER
 *   than this header claimed.** The sentence above said "every one of the 22"
 *   and listed the armour-first split among the untested. Since
 *   `golden-armoured-deflection-threshold-cleared` became drivable, that is
 *   false in two places, and both are worth stating precisely rather than
 *   deleting:
 *
 *   - **Armour absorption and the deflection threshold now HAVE runtime
 *     backing**, from exactly one golden. It measures `armourclass` 79 -> 57
 *     against `selectedDamage` 22 with `hitpointDamage` 0, and a
 *     `deflectionRoll` of 93 against a `deflectionThreshold` of 93 that clears
 *     the critical. One fixture is one fixture: it pins the absorb path, not
 *     the family.
 *   - **The overflow to health is still unbacked**, because that golden's
 *     armour was never exhausted (`hitpointDamage` 0). So the SPLIT — armour
 *     first, remainder to health — remains a two-path cross-check only.
 *   - Piece destruction (`armourRemovals: []`, roll 12), the breastplate join
 *     (`breastplate 0`, `staminaBonus 0`) and enchantment (`statusApplied
 *     null`) are untouched by it.
 *
 * It also proves NO CLAMPING. This header claimed it did, and a verifier
 * removed all three clamp sites (`ss2-rules.js`'s stamina clamp and both of
 * `resolver.js`'s health clamps) with this file still green. Nine further
 * mutations of the rule set pass the entire 685-test suite. Closing those needs
 * NEW EVIDENCE — an armoured or enchanted fixture — not more assertions over
 * the same 22.
 *
 * ► **CORRECTED 2026-09-02, TWICE OVER, and the second correction is the one
 *   that matters.** This paragraph used to end "no value in any of the 22 ever
 *   reaches a bound", and gave that as the REASON the clamps delete green. It
 *   is false, and it is false in the direction that makes the corpus sound
 *   better than it is:
 *
 *   - **Values reach bounds constantly.** Instrumented over this file,
 *     `src/team/resolver.js:259` takes 141 arrivals, of which **120 land
 *     exactly on the floor** and 21 on the ceiling. All 22 goldens stage
 *     villain `hitpoints`/`hitpointsmax` at 10 against a hero doing 21-23, so
 *     the damage does not merely reach the floor, it buries it. The reason a
 *     clamp deletes green is not that it never fires — it is that **nothing
 *     downstream distinguishes a clamped value from an unclamped one**, which
 *     is a much worse property and needs a different fix.
 *   - **"three" is wrong, in both directions.** At this file's own bar, **15
 *     of 16** clamp sites across the rule set, resolver, resources, roster and
 *     candidate delete green. Against the FULL suite exactly **seven** do
 *     (`ss2-rules.js:490`, `:707`, `resolver.js:261`, `roster.js:168`,
 *     `ss2-attack-candidate.js:228`, `:237`, `:575`) — and only ONE of the
 *     three named above is among them.
 *   - **This file defends exactly one clamp**, and it is not one of the three:
 *     deleting `src/golden/ss2-attack-candidate.js:339` fails the replay
 *     assertion below. So the honest form of this paragraph's headline is
 *     "it proves ONE clamp, and is blind to fifteen".
 *
 *   Related, and the same shape one layer down: the stamina clamp's FLOOR at
 *   `ss2-rules.js:784` is dead code. Deleting just the floor stays green even
 *   though `test/ss2-team-rules.test.js:456` drives −38 through it, because
 *   `src/team/resources.js:252` re-clamps every resource write to the entry's
 *   minimum. **A guard sitting behind another guard reads as coverage and is
 *   not.**
 *
 * ## Two harness conventions, stated rather than assumed
 *
 * 1. **The direction sample is PREPENDED by this file.** In the build the
 *    direction is drawn before `checkattackroll` opens the capture window, so
 *    no golden's tape carries one — the map's words are "recorded, never
 *    dictated". The rule set draws it, so a replay has to supply it. The value
 *    comes from `golden.scenario.attackDirection`, i.e. from the golden. The
 *    fixture file is not touched.
 * 2. **`fightMode` is the golden's own (`misc` for all 23).** Play uses
 *    `tournament`. No golden produces a first-blood outcome, so the mode's one
 *    unrepresentable case never arises here; the rule set throws if it ever
 *    does.
 *
 * ## The attacker's state: nineteen measured assertions this file used to deny
 *
 * This header used to say a golden's `expected.state.hero` is the state before
 * `nextphase` ran, so the hero's post-action `staminaleft` "is deliberately NOT
 * the golden's" — and the test asserted `notEqual` nineteen times.
 *
 * That was wrong, and it is the worst thing this session got wrong: it pinned
 * the engine to DISAGREE with the only measured number the fixture carries for
 * the attacker. `death()` deletes `nextphase` and both `onEnterFrame` handlers
 * (`+0x2035`, `+0x2042`, `+0x2049`) before the branch's `struck`-gated
 * `nextphase()` call can fire, so on a killing blow there is no phase
 * transition at all. Nineteen of the 23 goldens are kills. Their attacker
 * state must EQUAL the measurement, and now does.
 *
 * The three misses do transition, and their delta is asserted against the
 * map's formula — the one place in this file where an expected value is
 * recomputed rather than read from a fixture.
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  applyAction,
  combatantById,
  combatStateHash,
  createTeamBattle,
  currentCombatant,
  legalActions,
  rngJournal
} from "../src/team/index.js";
import {
  ATTACK_DIRECTION_ROLL_LABEL,
  createSs2TeamRules,
  Ss2ActionType,
  SS2_ARMOUR_PIECES,
  SS2_GOLDEN_FIXTURE_IDS,
  SS2_STATUS_FLAGS,
  ss2Combatant
} from "../src/team/ss2-rules.js";

const GOLDEN_DIR = fileURLToPath(new URL("fixtures/ss2-1v1-golden/", import.meta.url));

async function loadJson(filePath) {
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
}

const goldenFiles = (await readdir(GOLDEN_DIR)).filter((name) => name.endsWith(".json")).sort();
const goldens = await Promise.all(goldenFiles.map((name) => loadJson(path.join(GOLDEN_DIR, name))));

/**
 * Goldens this file CANNOT drive, and the reason each one cannot be driven.
 *
 * Not a skip list and not a tolerance: every entry is a REAL GAP between what
 * the corpus records and what the rule set requires, and the assertion below
 * fails if the set changes in EITHER direction — a new undrivable golden is a
 * finding, and one that becomes drivable must be removed from here.
 *
 * `golden-armoured-deflection-threshold-cleared` is the first golden in this
 * project with armour on the defender, promoted 2026-09-02 from two independent
 * captures. Its villain scenario carries twelve keys where the prisoner goldens
 * carry fourteen: **`min_damage` and `max_damage` are absent**, because the
 * candidate does not pin them — the villain never swings in this scenario, so
 * nothing in it is determined by the villain's damage pair.
 *
 * The rule set refused the combatant anyway, and the paragraph that used to
 * stand here said it was RIGHT to — that it "cannot know in advance that this
 * defender never attacks". **That was the wrong half to fix, and the fix went
 * to the rule set on 2026-09-07: the set is now EMPTY.**
 *
 * It can know. The requirement is role-based — `min_damage`/`max_damage` are
 * demanded of whoever ATTACKS, at the moment the swing resolves
 * (`SS2_ATTACKER_REQUIRED_RESOURCES` in `src/team/ss2-rules.js`) — because
 * every read of that pair in `ss2-attack-candidate.js` is on `attacker.*` and
 * the file contains no `defender.min_damage` read at all. The candidate's
 * omission was correct from the map all along; the guard was over-broad. The
 * corpus was never edited to fit the code, which is the move this repository
 * refuses most consistently and which the old wording correctly warned about
 * (the raw trace DOES carry both numbers — they are in the wrapper's
 * DEFAULT_WATCH_FIELDS — so writing them into the candidate was always one
 * keystroke away).
 *
 * **Keep this object and its two assertions even while it is empty.** They are
 * what makes a future gap a finding instead of a silent skip, and the
 * emptiness itself is now pinned: `replayableGoldens` must equal the whole
 * corpus.
 */
const REPLAY_UNDRIVABLE = Object.freeze({});

/** Whether this file can build a battle from the golden at all. */
function isReplayable(golden) {
  return !Object.hasOwn(REPLAY_UNDRIVABLE, golden.fixtureId);
}

/**
 * The goldens this file can actually build a battle from.
 *
 * `goldens` stays the WHOLE promoted corpus, because the size assertion and the
 * undrivable-set assertion are both about the corpus. Everything that drives a
 * battle uses this list instead — see REPLAY_UNDRIVABLE below for why the two
 * differ and why the difference is a finding rather than a tolerance.
 */
const replayableGoldens = goldens.filter((golden) => isReplayable(golden));

/** The three melee bands, keyed the way the build assigns them. */
const BANDS = Object.freeze([
  { low: 1, high: 4, type: Ss2ActionType.QUICK_ATTACK, strengthFactor: 1 },
  { low: 5, high: 8, type: Ss2ActionType.NORMAL_ATTACK, strengthFactor: 2 },
  { low: 9, high: 12, type: Ss2ActionType.POWER_ATTACK, strengthFactor: 3 }
]);

function bandFor(direction) {
  const band = BANDS.find((entry) => direction >= entry.low && direction <= entry.high);
  assert.ok(band, `direction ${direction} is outside the three melee bands this rule set implements`);
  return band;
}

/**
 * One combatant source from a golden's vanilla-shaped scenario side.
 *
 * `derive: false`: the golden's numbers are MEASURED, and running
 * `battlevalues` over them would overwrite `min_damage 21` with
 * `round(strength * 2) + weapon_min_damage`, computed from a weapon field the
 * fixture schema does not carry. Re-deriving a measured value is the single
 * move this repository refuses most often.
 *
 * `stamina` is the one base stat the arithmetic needs that the fixture schema
 * has no key for. It is INVERTED from the build's own
 * `staminamax = 100 + stamina * 10` (`battlevalues` `+0x37b6`), which is exact
 * for every value the build can produce. Nothing else is added.
 *
 * `speed` is left at 0 for both sides, so `initiativeOrder` falls through to
 * its id tie-break and `hero` acts first — deterministic, and it invents no
 * agility the fixture does not state.
 */
function combatantFromScenarioSide(side, { id, name }) {
  assert.ok(Number.isFinite(side.staminamax), `${id} needs staminamax to invert the stamina stat`);
  return ss2Combatant(
    { ...side, stamina: (side.staminamax - 100) / 10, speed: 0 },
    { id, name, controller: "local", derive: false }
  );
}

function teamsFromGolden(golden) {
  return [
    {
      id: "red",
      combatants: [combatantFromScenarioSide(golden.scenario.hero, { id: "hero", name: "Hero" })]
    },
    {
      id: "blue",
      combatants: [combatantFromScenarioSide(golden.scenario.villain, { id: "villain", name: "Villain" })]
    }
  ];
}

/** The sample the build would have drawn, reconstructed from the golden's own direction. */
function directionSampleFor(direction) {
  const band = bandFor(direction);
  return {
    label: ATTACK_DIRECTION_ROLL_LABEL,
    source: "randomBetween",
    min: band.low,
    max: band.high,
    value: direction
  };
}

/** Every golden is a hero swing at a villain; assert that rather than assume it. */
function assertGoldenShape(golden) {
  assert.equal(golden.scenario.attackerSide, "hero", `${golden.fixtureId} is not a hero swing`);
  assert.equal(golden.classification, "golden", `${golden.fixtureId} is not promoted`);
  assert.equal(golden.provenance.runtimeVerified, true, `${golden.fixtureId} is not runtime-verified`);
}

function replayGolden(golden) {
  assertGoldenShape(golden);
  const direction = golden.scenario.attackDirection;
  const band = bandFor(direction);
  const observed = [];
  const rules = createSs2TeamRules({
    fightMode: golden.scenario.fightMode ?? "tournament",
    // 22 of the 23 are `misc`, which the factory otherwise refuses: it can
    // produce a first-blood result this seam cannot represent. Safe here and
    // asserted below — 19 of the 23 expect `elimination` and 4 expect no
    // result at all, so none can take that path. The 23rd, the armoured
    // golden, declares `tournament` and needs no opt-in; passing the flag for
    // every golden is simpler than branching and costs that one nothing.
    //
    // (Measured 2026-09-07, after a first draft of this comment asserted "all
    // 23 are misc" from the old count. Re-deriving the property is what caught
    // it.)
    fixtureReplay: true,
    observer: (record) => observed.push(record)
  });
  const rngTape = [directionSampleFor(direction), ...golden.samples];
  const battle = createTeamBattle({ teams: teamsFromGolden(golden), rules, rngTape });

  const actor = currentCombatant(battle);
  assert.equal(actor.id, "hero", `${golden.fixtureId}: the hero must swing first`);
  const action = { actorId: "hero", type: band.type, targetId: "villain" };
  assert.ok(
    legalActions(battle).some((option) => option.type === action.type && option.targetId === action.targetId),
    `${golden.fixtureId}: ${band.type} must be legal for the staged hero`
  );
  applyAction(battle, action);
  return { battle, observed, band, rngTape };
}

/* ------------------------------------------------------------------ */
/* The corpus finally has a consumer                                    */
/* ------------------------------------------------------------------ */

test("every promoted golden replays through createTeamBattle/applyAction", () => {
  // The floor first: a loop over an empty listing asserts nothing at all, and
  // this repository has already lost 69 files to exactly that hole.
  assert.ok(goldens.length > 0, "the golden directory is empty; nothing below would run");
  assert.equal(goldens.length, 23, "the golden corpus changed size; re-read what this file claims");

  // The undrivable set is asserted in BOTH directions before anything is
  // replayed, so a golden that quietly stops being replayable cannot hide in a
  // loop that simply skips it.
  const undrivable = goldens.filter((golden) => !isReplayable(golden)).map((golden) => golden.fixtureId).sort();
  assert.deepEqual(
    undrivable,
    Object.keys(REPLAY_UNDRIVABLE).sort(),
    "the set of goldens this file cannot drive changed; read REPLAY_UNDRIVABLE before touching this"
  );

  // And the listed goldens must ACTUALLY be undrivable. The deepEqual above
  // compares the frozen list with the goldens that carry its keys — which is
  // the list compared with itself, so it catches an entry naming a golden that
  // does not exist and nothing else. Found 2026-09-02 by two independent
  // agents: a listed golden that quietly BECAME drivable was never noticed,
  // the project's signature defect in the assertion that claimed to prevent
  // it. Build each one and require the refusal by name; the mutation that
  // kills this loop is relaxing the rule set's guard while leaving the list.
  //
  // The list is EMPTY as of 2026-09-07, so this loop currently runs zero times
  // — which is exactly the hole it was written to close. The assertion on the
  // line after it carries the weight instead: every golden must drive.
  for (const golden of goldens.filter((entry) => !isReplayable(entry))) {
    assert.throws(
      () => replayGolden(golden),
      /min_damage|max_damage/,
      `${golden.fixtureId} is listed in REPLAY_UNDRIVABLE but built a battle; remove it from the list`
    );
  }

  const replayable = goldens.filter(isReplayable);
  assert.equal(
    replayable.length,
    goldens.length,
    "a golden stopped driving; REPLAY_UNDRIVABLE is empty and must stay so unless the gap is real"
  );
  assert.equal(replayable.length, 23, "the replayable corpus changed size");
  for (const golden of replayable) {
    const { observed } = replayGolden(golden);
    assert.equal(observed.length, 1, `${golden.fixtureId}: exactly one action must resolve`);
    const [record] = observed;
    assert.equal(record.attackDirection, golden.scenario.attackDirection, golden.fixtureId);
    // The arithmetic's ENTIRE return, not a summary of it.
    assert.deepEqual(record.outcome.calculation, golden.expected.calculation, golden.fixtureId);
    assert.deepEqual(record.outcome.mutation, golden.expected.mutation, golden.fixtureId);
    assert.deepEqual(record.outcome.mutationTrace, golden.expected.mutationTrace, golden.fixtureId);
    assert.deepEqual(record.outcome.state, golden.expected.state, golden.fixtureId);
    assert.deepEqual(record.outcome.resultEvent, golden.expected.resultEvent, golden.fixtureId);
  }
});

test("the ordered channel consumes exactly the golden's tape, in order, and drains it", () => {
  for (const golden of replayableGoldens) {
    const { battle, rngTape } = replayGolden(golden);
    assert.equal(
      battle.rngCursor,
      rngTape.length,
      `${golden.fixtureId}: every supplied sample must be drawn, and no more`
    );
    // Tape mode already refuses a wrong label/source/bound at the cursor, so
    // this restates the guarantee positively rather than trusting the absence
    // of a throw.
    const journal = rngJournal(battle);
    assert.deepEqual(
      journal.map(({ label, source, min, max, value }) => ({ label, source, min, max, value })),
      rngTape,
      golden.fixtureId
    );
  }
});

test("the defender's battle state is the golden's measured state", () => {
  for (const golden of replayableGoldens) {
    const { battle } = replayGolden(golden);
    const villain = combatantById(battle, "villain");
    const expected = golden.expected.state.villain;

    assert.equal(villain.health, expected.hitpoints, `${golden.fixtureId}: hitpoints`);
    assert.equal(villain.alive, expected.hitpoints > 0, `${golden.fixtureId}: alive`);
    for (const name of ["armourclass", "armourclass_max", "staminaleft"]) {
      assert.equal(villain.resources[name].value, expected[name], `${golden.fixtureId}: ${name}`);
    }
    // These sixteen are VACUOUS for the corpus as it stands and are kept
    // deliberately: every golden stages zero on all eight pieces and false on
    // all six flags, so staged == expected and no effect ever runs. They are a
    // trap set for the first armoured or enchanted golden, not evidence today.
    for (const piece of SS2_ARMOUR_PIECES) {
      assert.equal(villain.resources[piece].value, expected[piece], `${golden.fixtureId}: ${piece}`);
    }
    for (const flag of SS2_STATUS_FLAGS) {
      assert.equal(villain.status.includes(flag), expected[flag], `${golden.fixtureId}: ${flag}`);
    }
    // What is NOT vacuous: a lethal golden must actually have moved something.
    if (golden.expected.resultEvent !== null) {
      assert.notEqual(villain.health, golden.scenario.villain.hitpoints, `${golden.fixtureId}: nothing moved`);
    }
  }
});

test("a lethal golden ends the battle through the resolver's own elimination path", () => {
  const lethal = replayableGoldens.filter((golden) => golden.expected.resultEvent !== null);
  const survived = replayableGoldens.filter((golden) => golden.expected.resultEvent === null);
  assert.equal(lethal.length, 19);
  assert.equal(
    survived.length,
    4,
    "three misses and one non-lethal HIT — the armoured golden, added 2026-09-07"
  );

  for (const golden of lethal) {
    const { battle } = replayGolden(golden);
    assert.equal(golden.expected.resultEvent.reason, "elimination", golden.fixtureId);
    assert.deepEqual(battle.result, { winnerTeamId: "red", reason: "elimination" }, golden.fixtureId);
    // The resolver's own vocabulary, not the arithmetic's: the rule set must
    // not emit `battle-result-pending` itself.
    const types = battle.events.map((event) => event.type);
    assert.ok(types.includes("defeated"), golden.fixtureId);
    assert.ok(types.includes("team-eliminated"), golden.fixtureId);
    assert.equal(
      types.filter((type) => type === "battle-result-pending").length,
      1,
      `${golden.fixtureId}: exactly one result event, and the resolver stamps it`
    );
  }

  for (const golden of survived) {
    const { battle } = replayGolden(golden);
    assert.equal(battle.result, null, golden.fixtureId);
    assert.equal(currentCombatant(battle).id, "villain", `${golden.fixtureId}: the turn must advance`);
  }
});

test("the miss goldens reach the resolver as a zero-damage effect, not as no effect", () => {
  for (const golden of replayableGoldens.filter((entry) => entry.expected.calculation.hit === false)) {
    const { battle } = replayGolden(golden);
    const damage = battle.lastResolution.effects.filter((effect) => effect.kind === "damage");
    assert.equal(damage.length, 1, golden.fixtureId);
    assert.equal(damage[0].amount, 0, golden.fixtureId);
    assert.equal(combatantById(battle, "villain").health, golden.scenario.villain.hitpoints, golden.fixtureId);
  }
});

/* ------------------------------------------------------------------ */
/* The difference between the ingress and the phase transition          */
/* ------------------------------------------------------------------ */

test("a killing blow leaves the attacker's state exactly as the golden measured it", () => {
  // Nineteen measured assertions. `death()` deletes `nextphase` and both
  // `onEnterFrame` handlers (`+0x2035`, `+0x2042`, `+0x2049`) before the melee
  // branch's `struck`-gated `nextphase()` call (`+0x62c3` -> `+0x62e2`) can
  // fire, so a killing blow costs the attacker nothing at all.
  const lethal = replayableGoldens.filter((golden) => golden.expected.resultEvent !== null);
  assert.ok(lethal.length >= 19, "the lethal goldens are what carry this assertion");
  for (const golden of lethal) {
    const { battle } = replayGolden(golden);
    const hero = combatantById(battle, "hero");
    assert.equal(
      hero.resources.staminaleft.value,
      golden.expected.state.hero.staminaleft,
      `${golden.fixtureId}: a kill must not spend the attacker's stamina`
    );
    assert.equal(
      hero.health,
      golden.expected.state.hero.hitpoints,
      `${golden.fixtureId}: a kill must not regenerate the attacker's hitpoints`
    );
    assert.equal(battle.lastResolution.events[0].staminaSpent, 0, golden.fixtureId);
    assert.equal(battle.lastResolution.events[0].staminaGained, 0, golden.fixtureId);
  }
});

test("a non-lethal action DOES transition, by the map's own formula", () => {
  // This is the one place in this file where an expected value is recomputed
  // from the map rather than read out of a fixture, so it is pinned to a
  // literal as well as to the formula: the hero of every golden is strength 10
  // / staminamax 110 / staminaleft 105, i.e. stamina 1, and a normal attack
  // costs round(10 * 2) = 20 against a regen of 1 + round(1/3).
  //
  // ► These were "the three misses" until 2026-09-07. The armoured golden is a
  //   fourth non-lethal action and the first that HITS — the villain has 80
  //   hitpoints and armour, and survives 21-23 damage. So this test stopped
  //   being about missing and became about surviving, which is what it always
  //   measured: a transition fires whenever `death()` does not.
  const survived = replayableGoldens.filter((golden) => golden.expected.resultEvent === null);
  assert.equal(survived.length, 4, "three misses and one non-lethal hit");
  assert.ok(
    survived.some((golden) => golden.expected.calculation.hit === true),
    "a non-lethal HIT must be among them, or this test is still only about misses"
  );
  const literalFor = { 1: 96, 2: 86, 3: 76 };  // quick / normal / power, from 105
  for (const golden of survived) {
    const { battle, band } = replayGolden(golden);
    const hero = combatantById(battle, "hero");
    const scenarioHero = golden.scenario.hero;
    const stamina = (scenarioHero.staminamax - 100) / 10;
    const cost = Math.round(scenarioHero.strength * band.strengthFactor);
    const expectedStamina = Math.max(0, Math.min(
      scenarioHero.staminamax,
      scenarioHero.staminaleft - cost + 1 + Math.round(stamina / 3)
    ));
    assert.equal(expectedStamina, literalFor[band.strengthFactor], `${golden.fixtureId}: formula vs literal`);
    assert.equal(hero.resources.staminaleft.value, expectedStamina, `${golden.fixtureId}: attacker staminaleft`);
    assert.notEqual(
      hero.resources.staminaleft.value,
      golden.expected.state.hero.staminaleft,
      `${golden.fixtureId}: a miss DOES transition, so it must differ from the pre-nextphase measurement`
    );

    // Deliberately NOT presented as a check of the heal: every golden's hero
    // is at full health, so `min(30, 30 + 1 + ceil(1/2))` is 30 whatever the
    // formula says. The heal is checked in test/ss2-team-rules.test.js.
    assert.equal(hero.health, scenarioHero.hitpointsmax, `${golden.fixtureId}: attacker at full health throughout`);
  }
});

test("the defender neither pays nor regenerates: the per-turn mutation is attacker-only", () => {
  // `nextphase` `+0x32a1`-`+0x3346` has no `game_defender` counterpart.
  // `nextphase` has no `game_defender` counterpart anywhere in the function
  // (map § "The per-turn mutation is attacker-only"). Any simulation that
  // regenerates both sides drifts from the build, so pin it.
  for (const golden of replayableGoldens) {
    const { battle } = replayGolden(golden);
    const villain = combatantById(battle, "villain");
    assert.equal(
      villain.resources.staminaleft.value,
      golden.expected.state.villain.staminaleft,
      `${golden.fixtureId}: the defender's stamina moves only by the breastplate join`
    );
  }
});

/* ------------------------------------------------------------------ */
/* The citation is executable                                           */
/* ------------------------------------------------------------------ */

test("the rule set cites exactly the goldens this file replays", () => {
  // A map-derived rule set is licensed to cite goldens while declaring
  // `runtimeVerified: false`. That licence is only honest if the citation is
  // checkable, so the cited list must equal the set actually replayed through
  // the resolver — not a list someone kept by hand.
  assert.deepEqual(
    [...SS2_GOLDEN_FIXTURE_IDS].sort(),
    replayableGoldens.map((golden) => golden.fixtureId).sort()
  );
  assert.deepEqual(
    goldens.map((golden) => `${golden.fixtureId}.json`).sort(),
    [...goldenFiles].sort(),
    "a golden's file name must be its id"
  );
});

test("replay is deterministic: the same tape and the same action reach the same hash", () => {
  for (const golden of replayableGoldens.slice(0, 3)) {
    const first = replayGolden(golden);
    const second = replayGolden(golden);
    assert.equal(
      JSON.stringify(first.battle.events),
      JSON.stringify(second.battle.events),
      golden.fixtureId
    );
  }
});

/* ------------------------------------------------------------------ */
/* The role-based damage-pair requirement, pinned over the whole corpus  */
/* ------------------------------------------------------------------ */

/**
 * Replay a golden with the villain's damage pair FORCED to a given value.
 *
 * The pair is written onto the scenario side before `combatantFromScenarioSide`
 * builds the blueprint, so it travels the ordinary declared-resource route and
 * reaches the arithmetic exactly as a real pair would.
 */
/**
 * The same observer records with the villain's damage pair removed.
 *
 * The observer echoes the vanilla record it fed the arithmetic, so the pair
 * appears there as an INPUT whatever the arithmetic did with it. Stripping it
 * is what makes the comparison a statement about the OUTPUT — and it is
 * stripped from the villain only: the hero's pair is the attacker's, and must
 * come back identical.
 */
function withoutVillainPair(records) {
  return records.map((record) => {
    const villain = { ...record.scenario.villain };
    delete villain.min_damage;
    delete villain.max_damage;
    return { ...record, scenario: { ...record.scenario, villain } };
  });
}

function replayWithVillainPair(golden, min, max) {
  const forced = {
    ...golden,
    scenario: {
      ...golden.scenario,
      villain: { ...golden.scenario.villain, min_damage: min, max_damage: max }
    }
  };
  return replayGolden(forced);
}

/**
 * Events with the settlement's completion token blanked.
 *
 * The token's second half is `combatStateHash`, an fnv1a over the whole wire
 * projection — and `combatantProjection` (`src/team/resolver.js:490`) carries
 * every DECLARED resource. So a defender's damage pair moves the token by
 * being declared at all, without touching a single number the arithmetic
 * computed. Separating the two is the entire point of the test below.
 */
function withoutCompletionToken(events) {
  return events.map((event) => (
    Object.hasOwn(event, "completionToken") ? { ...event, completionToken: null } : event
  ));
}

const completionTokenOf = (events) => events.find((event) => event.completionToken)?.completionToken ?? null;

test("the DEFENDER's damage pair cannot reach the arithmetic — every golden, three pairs", () => {
  // This is the claim the role-based requirement rests on, and it is pinned
  // here rather than left as a comment: `SS2_ATTACKER_REQUIRED_RESOURCES` lets
  // a defender omit min_damage/max_damage precisely because no read of that
  // pair in `ss2-attack-candidate.js` is on `defender.*`. If that ever stops
  // being true, a defender's absent pair starts silently defaulting to 1 and
  // changing outcomes — so the invariance is asserted, over the WHOLE corpus,
  // against values three orders of magnitude apart.
  //
  // It also reproduces from the runtime: the two capture sessions
  // `golden-armoured-deflection-threshold-cleared` cites recorded villains with
  // different damage pairs (18/30 against 7/22) and measured identical
  // outcomes.
  assert.equal(replayableGoldens.length, 23, "every golden must be exercised here");
  for (const golden of replayableGoldens) {
    const baseline = replayGolden(golden);
    for (const [min, max] of [[1, 1], [999, 999], [7, 22]]) {
      const forced = replayWithVillainPair(golden, min, max);
      assert.deepEqual(
        withoutCompletionToken(forced.battle.events),
        withoutCompletionToken(baseline.battle.events),
        `${golden.fixtureId}: villain pair ${min}/${max} changed the events`
      );

      // The pair must actually have ARRIVED, or this test passes by doing
      // nothing. The observer echoes the vanilla record it fed the arithmetic,
      // so the forced value is visible there — and that echo is the ONLY place
      // it may appear.
      for (const record of forced.observed) {
        assert.equal(record.scenario.villain.min_damage, min, `${golden.fixtureId}: pair did not reach the record`);
        assert.equal(record.scenario.villain.max_damage, max, `${golden.fixtureId}: pair did not reach the record`);
      }
      assert.deepEqual(
        withoutVillainPair(forced.observed),
        withoutVillainPair(baseline.observed),
        `${golden.fixtureId}: villain pair ${min}/${max} changed the calculation/mutation trace`
      );
    }
  }
});

test("an attacker that omits the pair is still refused, so emptying the list narrowed nothing", () => {
  // The other half of the split, on the corpus rather than on a synthetic
  // gladiator: strip the HERO's pair from a golden and the replay must fail by
  // name. Without this, "the guard fills a hole and overwrites nothing" is an
  // assertion about code that no test distinguishes from having removed the
  // guard entirely.
  const golden = replayableGoldens.find((entry) => entry.scenario.hero.min_damage !== undefined);
  assert.ok(golden, "no golden states a hero damage pair; this test would prove nothing");
  for (const missing of ["min_damage", "max_damage"]) {
    const hero = { ...golden.scenario.hero };
    delete hero[missing];
    assert.throws(
      () => replayGolden({ ...golden, scenario: { ...golden.scenario, hero } }),
      (error) => new RegExp(missing).test(error.message),
      `a hero missing ${missing} must be refused by name when the swing resolves`
    );
  }
});

test("declaring a defender's damage pair MOVES the battle hash, which is why no fixture may add one", () => {
  // The other side of the invariance above, and the one with a consequence for
  // the corpus. `combatStateHash` is an fnv1a over `toTeamWireState`, whose
  // `combatantProjection` carries every DECLARED resource
  // (`src/team/resolver.js:480-496`, `:560`); the hash is the completion
  // token's second half (`:316`, `settlement.js:93`). So writing
  // min_damage/max_damage into a villain scenario changes the token even
  // though it changes no number the arithmetic computed.
  //
  // That makes "complete the fixture so the guard stops complaining" a
  // PROJECTION change, not a tidy-up — two peers, one with the pair and one
  // without, desync on a battle they agree about in every arithmetic respect.
  // The candidate must keep omitting it, which is what the map already said.
  // ► **CORRECTED after an independent Codex review, and the correction is the
  //   point.** This test first filtered to goldens that SETTLE, and compared
  //   their completion tokens. `golden-armoured-deflection-threshold-cleared`
  //   has `resultEvent: null` — it is a non-lethal hit — so it settles, never
  //   entered the loop, and the one fixture whose villain actually OMITS the
  //   pair was the one fixture this test skipped. It was named for a hole and
  //   stepped around it: the project's signature defect, caught here by a
  //   reviewer rather than by the suite.
  //
  //   `combatStateHash` is compared directly instead. It exists for every
  //   battle, settled or not, and it is the token's second half anyway.
  for (const golden of replayableGoldens) {
    const baseline = combatStateHash(replayGolden(golden).battle);
    const forced = combatStateHash(replayWithVillainPair(golden, 999, 999).battle);
    assert.notEqual(
      forced,
      baseline,
      `${golden.fixtureId}: a declared villain damage pair left the battle hash unchanged, so the ` +
      "projection no longer covers declared resources — read src/team/resolver.js:480"
    );
  }

  // The ABSENT-versus-DECLARED case, which is the one the corpus actually
  // faces, and which the token comparison could not reach. Only the armoured
  // golden's villain omits the pair, so it is named rather than filtered for:
  // if another golden ever omits it, the assertion below says so.
  const omitting = replayableGoldens.filter((golden) => golden.scenario.villain.min_damage === undefined);
  assert.deepEqual(
    omitting.map((golden) => golden.fixtureId),
    ["golden-armoured-deflection-threshold-cleared"],
    "the set of goldens whose villain omits the damage pair changed"
  );
  const absent = combatStateHash(replayGolden(omitting[0]).battle);
  const declared = combatStateHash(replayWithVillainPair(omitting[0], 1, 1).battle);
  assert.notEqual(
    absent,
    declared,
    "declaring the villain's pair as 1/1 — the value the arithmetic defaults to anyway — must still " +
    "move the hash, because the projection covers the DECLARATION and not just the value. If these " +
    "are equal, completing the fixture is free and this whole test is unnecessary; check " +
    "src/team/resolver.js:480 before believing that."
  );

  // And the outcome is genuinely unchanged for the settled ones: same winner,
  // same reason, only the battle half of the token moves.
  const settling = replayableGoldens.filter(
    (golden) => completionTokenOf(replayGolden(golden).battle.events) !== null
  );
  assert.equal(settling.length, 19, "the 19 lethal goldens are what carry the outcome-half assertion");
  for (const golden of settling) {
    const baseline = completionTokenOf(replayGolden(golden).battle.events);
    const forced = completionTokenOf(replayWithVillainPair(golden, 999, 999).battle.events);
    assert.equal(
      forced.slice(0, forced.lastIndexOf(":")),
      baseline.slice(0, baseline.lastIndexOf(":")),
      `${golden.fixtureId}: the OUTCOME half of the token moved, which would mean the fight changed`
    );
  }
});
