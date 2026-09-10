/**
 * The guards the mutation audit said were missing: hashes taken AFTER actions,
 * and one pinned seeded draw sequence.
 *
 * WHY THIS FILE EXISTS. `docs/mutation-audit-2026-09-07.md`, structural
 * finding 2:
 *
 *   "The pinned literal combat-state hashes are all taken on battles with NO
 *   action applied — cursor 0, turnCursor 0, result null, events []. They pin
 *   field PRESENCE and any value that varies at construction, and pin NOTHING
 *   whose value is 0/null/[] before the first action. That asymmetry is what
 *   most of the confirmed survivors exploit. Every other hash assertion in the
 *   suite is RELATIVE (rebuilt vs live, forced vs baseline), so it moves with
 *   the mutation on both sides and cannot catch a change to a derivation both
 *   sides share."
 *
 * Re-derived before it was believed, 2026-09-10: the audit's finding was
 * exactly right — every literal `combatStateHash` pin that existed before this
 * file was taken on a battle with NO action applied.
 *
 * ► **BUT THE COUNT THIS PARAGRAPH USED TO GIVE WAS WRONG, and the error is
 *   worth more than the correction — corrected later the same day.** It said
 *   *"the suite contains **exactly one** literal `combatStateHash` pin, in
 *   `test/ss2-team-rules.test.js` ... 57 other `combatStateHash` uses are all
 *   relative."* There are TEN, and six of them predate this file by eleven
 *   days:
 *
 *     test/ss2-team-rules.test.js:960                      1  (the one it named)
 *     test/team-resolver.test.js UNCHANGED_FILL_BLUEPRINTS 6  (`combat:` literals,
 *                                                             asserted in the loop at :700,
 *                                                             added in 193e54d, 2026-08-30)
 *     this file                                            3
 *
 *   Re-derive it rather than trusting either number:
 *     `grep -rn 'combatStateHash' test/*.js | grep -E '"[0-9a-f]{8}"'`
 *
 *   **The conclusion survived the miscount and the reasoning did not.** All
 *   seven pre-existing pins are construction-time — the six fill-blueprint
 *   ones hash `createTeamBattle(blueprint)` with no action applied, exactly
 *   the class the audit described — so this file's REASON to exist is intact
 *   and its pins are the right pins. What was wrong is the sentence "57 other
 *   uses are all relative", in a paragraph whose whole point is that it
 *   re-derived before believing. **A re-derivation that miscounts is not a
 *   re-derivation, and it reads exactly like one.** Found by an independent
 *   write-nothing agent and re-derived here by hand before it was believed.
 *
 * It also names the cheap guard: "one pinned seeded draw sequence (or a hash
 * after N seeded actions) checked against a literal". This file is both.
 *
 * ---
 *
 * **THESE ARE REGRESSION PINS, NOT GOLDENS, AND THE DIFFERENCE IS THE WHOLE
 * PROJECT.** A golden is SS2 behaviour measured in the running game, promoted
 * only through the pipeline from two independent capture sessions. Nothing here
 * is measured against anything: every literal below was computed from this
 * repository's own code and asserts only that it has not silently changed.
 * A moved value here is not evidence of a bug — it is a REQUIREMENT TO EXPLAIN,
 * because two peers on either side of the change now disagree about identical
 * battles. Re-derive, replace, and say in the commit message what moved and why.
 *
 * They may never be cited as evidence about the game, and they are deliberately
 * in their own file, away from `test/fixtures/`, so nothing can mistake them
 * for the corpus.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction,
  combatStateHash,
  createTeamBattle,
  currentCombatant,
  legalActions,
  rngJournal
} from "../src/team/index.js";
import { ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";

/** States as little as it can, so every SS2 resource DEFAULT feeds the hash. */
const MINIMAL = Object.freeze({
  strength: 1, speed: 1, attack: 1, defence: 1, vitality: 1,
  stamina: 1, magicka: 0, charisma: 0, herolevel: 1,
  weapon_min_damage: 1, weapon_max_damage: 1
});

/** Hits hard enough that a bout actually ends, which MINIMAL never does. */
const FIGHTER = Object.freeze({
  strength: 9, speed: 5, attack: 9, defence: 3, vitality: 3, stamina: 4,
  magicka: 0, charisma: 3, herolevel: 3, character_level: 3,
  weapon_min_damage: 6, weapon_max_damage: 12
});

function build(seed, stats, perSide = 1) {
  const side = (prefix) => ({
    id: prefix === "hero" ? "red" : "blue",
    combatants: Array.from({ length: perSide }, (unused, index) =>
      ss2Combatant(stats, {
        id: perSide === 1 ? prefix : `${prefix}-${index + 1}`,
        name: prefix === "hero" ? "Hero" : "Villain"
      })
    )
  });
  return createTeamBattle({ seed, rules: ss2TeamRules, teams: [side("hero"), side("villain")] });
}

/**
 * Deterministic action choice. No `Math.random`, no wall clock, no AI — the
 * index is a pure function of the battle's own turn number, so the whole
 * sequence replays exactly.
 */
function driveByTurn(battle, limit) {
  let taken = 0;
  while (!battle.result && taken < limit) {
    const actor = currentCombatant(battle);
    if (!actor) break;
    const options = legalActions(battle);
    if (options.length === 0) break;
    applyAction(battle, { ...options[battle.turnNumber % options.length], actorId: actor.id });
    taken += 1;
  }
  return taken;
}

/** Always the first legal option, which under `ss2TeamRules` is an attack. */
function driveFirst(battle, limit) {
  let taken = 0;
  while (!battle.result && taken < limit) {
    const actor = currentCombatant(battle);
    if (!actor) break;
    const options = legalActions(battle);
    if (options.length === 0) break;
    applyAction(battle, { ...options[0], actorId: actor.id });
    taken += 1;
  }
  return taken;
}

const WHY_IT_MOVED = [
  "This hash is taken AFTER actions, so unlike the construction-time pin it",
  "covers rngCursor, turnCursor, the event log and every value that is 0/null/[]",
  "before the first action. It moving means peers on either side of this change",
  "now disagree about identical battles. Re-derive it, replace the literal, and",
  "say in the commit message WHAT moved and why it was worth moving."
].join(" ");

test("a battle SIX ACTIONS IN hashes to a pinned value", () => {
  const battle = build(1, MINIMAL);
  const taken = driveByTurn(battle, 6);

  // The pin is worthless unless the battle actually reached the state the
  // construction-time pin cannot see. Assert that first.
  assert.equal(taken, 6, "the drive must have applied six actions");
  assert.ok(battle.rngCursor > 0, `rngCursor must have moved off 0: ${battle.rngCursor}`);
  assert.ok(battle.turnNumber > 1, `turnNumber must have moved off 1: ${battle.turnNumber}`);
  assert.ok(battle.events.length > 0, "the event log must be non-empty");
  assert.equal(battle.result, null, "and the battle must NOT be settled — that is the next test");

  assert.equal(combatStateHash(battle), "fb82a03e", WHY_IT_MOVED);
});

test("a SETTLED battle hashes to a pinned value, which is the only pin that covers `result`", () => {
  const battle = build(1, FIGHTER);
  const taken = driveFirst(battle, 500);

  assert.ok(battle.result, `the bout must have settled: ${taken} actions taken`);
  assert.equal(battle.result.winnerTeamId, "red");
  assert.equal(battle.result.reason, "elimination");
  assert.ok(battle.events.length > taken, "a settled bout emits more events than actions");

  assert.equal(combatStateHash(battle), "976c78a3", WHY_IT_MOVED);
});

test("a settled 3v3 hashes to a pinned value, because N-a-side has its own projection", () => {
  // 1v1 is the parity case and cannot exercise seats, slot indices or a
  // multi-combatant elimination order. This one can.
  const battle = build(4, FIGHTER, 3);
  const taken = driveFirst(battle, 900);

  assert.ok(battle.result, `the 3v3 must have settled: ${taken} actions taken`);
  assert.equal(battle.result.winnerTeamId, "red");
  assert.equal(combatStateHash(battle), "6474bf07", WHY_IT_MOVED);
});

/**
 * `src/team/rng.js`'s own docstring promises "Same seed + same ordered requests
 * => same values". The audit observed that **nothing asserted it** — every
 * other RNG assertion in the suite compares one run against another, so both
 * sides move together and a changed derivation is invisible.
 *
 * This pins the actual drawn numbers against literals, so a change to the
 * generator, to the draw ORDER, or to any bound fails here by name.
 */
test("a seeded draw sequence is pinned to literal values, order and bounds included", () => {
  const battle = build(1, FIGHTER);
  driveFirst(battle, 4);
  const journal = rngJournal(battle);

  assert.ok(journal.length >= 8, `too few draws to prove anything: ${journal.length}`);
  assert.deepEqual(
    journal.slice(0, 8).map((draw) => [draw.label, draw.min, draw.max, draw.value]),
    [
      ["attack-direction-roll", 1, 4, 3],
      ["hit-roll", 1, 100, 1],
      ["quick-critical-roll", -20, 20, 1],
      ["critical-deflection-roll", 1, 100, 99],
      ["armour-removal-roll", 1, 100, 97],
      ["armour-selection-1", 1, 3, 1],
      ["enchantment-potency-roll", 1, 100, 62],
      ["attack-direction-roll", 1, 4, 3]
    ],
    [
      "The seeded draw sequence changed. `src/team/rng.js` promises 'Same seed +",
      "same ordered requests => same values', so this is either a generator change,",
      "a change to the ORDER rule sets request draws in, or a changed bound — and",
      "all three desync a peer running the previous build. Nothing else in the",
      "suite asserts this: every other RNG check is relative and moves with the",
      "mutation on both sides."
    ].join(" ")
  );

  // Every draw is inside its own declared bounds. A generator that ignored them
  // would still satisfy the literals above only by coincidence.
  for (const draw of journal) {
    assert.ok(
      Number.isInteger(draw.value) && draw.value >= draw.min && draw.value <= draw.max,
      `${draw.label} drew ${draw.value} outside [${draw.min}, ${draw.max}]`
    );
  }
});

test("the same seed replays identically, and a different seed does not", () => {
  // The other half of the promise, and the half that a literal cannot state:
  // determinism itself. Relative by necessity, so it is here alongside the
  // literals rather than instead of them.
  const first = build(1, FIGHTER);
  const second = build(1, FIGHTER);
  driveFirst(first, 500);
  driveFirst(second, 500);
  assert.equal(combatStateHash(first), combatStateHash(second), "same seed, same battle");
  assert.deepEqual(rngJournal(first), rngJournal(second), "and the same draws, in the same order");

  const other = build(2, FIGHTER);
  driveFirst(other, 500);
  assert.notEqual(
    combatStateHash(other),
    combatStateHash(first),
    "a different seed must produce a different battle, or the seed does nothing"
  );
});
