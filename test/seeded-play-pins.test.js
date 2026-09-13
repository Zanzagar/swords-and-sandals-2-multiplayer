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

/**
 * ► **STAGED IN CONTACT (`x: ∓30`) SINCE 2026-09-11, and it is what keeps
 *   these pins pinning what they were built to pin.** The rule set models
 *   position now, so a battle left to `startingPosition` opens 500 apart
 *   against an unarmed reach of ~83 — and the first six actions of such a
 *   battle are six WALKS, which draw nothing. The "six actions in" pin exists
 *   to cover `rngCursor`, the event log and everything that is 0/null/[]
 *   before the first action; against an approach it would have hashed a
 *   battle whose cursor was still zero and gone on passing. Its own guard
 *   caught that — `rngCursor must have moved off 0: 0` — which is the guard
 *   doing exactly its job.
 *
 *   ~~The approach is not left uncovered: `positionBuild` below pins it
 *   separately, so both states have a literal.~~ **THAT WAS FALSE FROM THE DAY
 *   IT WAS WRITTEN UNTIL 2026-09-12: `positionBuild` was declared and never
 *   called.** Two hits in the repository, this sentence and the declaration.
 *   The approach now genuinely has a literal — see "the VANILLA-SEPARATION
 *   opening" below — and the sentence is kept struck through rather than
 *   deleted, because a claim that a thing is covered is more dangerous than no
 *   claim at all: it is the reason nobody looked for eleven days.
 */
function build(seed, stats, perSide = 1) {
  const side = (prefix) => ({
    id: prefix === "hero" ? "red" : "blue",
    combatants: Array.from({ length: perSide }, (unused, index) =>
      ss2Combatant(stats, {
        id: perSide === 1 ? prefix : `${prefix}-${index + 1}`,
        name: prefix === "hero" ? "Hero" : "Villain",
        x: prefix === "hero" ? -30 : 30
      })
    )
  });
  return createTeamBattle({ seed, rules: ss2TeamRules, teams: [side("hero"), side("villain")] });
}

/** The same pair, left where the RULE SET puts them: the vanilla +/-250. */
function positionBuild(seed, stats, perSide = 1) {
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

/**
 * Always the first legal option — an attack for a pair staged in CONTACT, and
 * `walk-left` for a pair that is not. (It used to say "which under
 * `ss2TeamRules` is an attack"; that became false when the rule set learned
 * about position, and the callers below all use `build`, which stages.)
 */
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

/**
 * ► **ALL THREE LITERALS MOVED ON 2026-09-10, and this is the explanation the
 *   `WHY_IT_MOVED` message demands.** The cause is one deliberate change:
 *   a swing is now priced on the WEAPON (`SS2_SWING`, `ss2SwingCost`) instead
 *   of on `round(strength * band_factor)`, closing the measured defect in
 *   `docs/combat-economy-findings-2026-09-10.md` D2 — strength 7 beat strength
 *   30 over 39 actions without losing a point of stamina or health.
 *
 *   Then the 3v3 literal moved AGAIN, later the same day, on a SECOND
 *   deliberate change: `ss2InitiativeOrder` (D3) makes sides ALTERNATE
 *   instead of sorting flat by agility across both teams, so a 3v3's turn
 *   order — and therefore its whole event log — is different.
 *   3f21de75 -> 347dc64f. **Only the 3v3 pin moved**, and that is the pin
 *   earning its place: 1v1 alternates identically under both rules, so the
 *   two settled-1v1 pins could not have caught this and did not.
 *
 *   fb82a03e -> f12b5d6c   (six actions in)
 *   976c78a3 -> edb93099   (settled 1v1)
 *   6474bf07 -> 3f21de75   (settled 3v3)
 *
 *   **Two peers on either side of that change disagree about identical
 *   battles, and that is the point of these pins firing.** The goldens did NOT
 *   move: `fixtureReplay` keeps the build's own formula, so all 23 still
 *   reproduce their measured `staminaleft`. A fourth literal in
 *   `ss2-team-rules.test.js` and the six in `team-resolver.test.js` are
 *   construction-time and did not move either, which is exactly the asymmetry
 *   this file exists to cover.
 */
/**
 * ► **ALL THREE MOVED AGAIN ON 2026-09-11, and this time for a PROJECTION
 *   change rather than an arithmetic one.** `x` joined `combatantProjection`,
 *   so every SS2 battle hashes differently — `null` for a rule set that models
 *   no position, a number for one that does, and the key present either way so
 *   two peers commit to one shape. The three pins ALSO changed what they
 *   describe: the pair is now staged in contact (see `build`), because left at
 *   the vanilla separation the first six actions are six walks and the
 *   six-actions-in pin would have hashed a battle with `rngCursor` still 0.
 *
 *     f12b5d6c -> 49866259   (six actions in)
 *     edb93099 -> 83b564ac   (settled 1v1)
 *     347dc64f -> 797ff2be   (settled 3v3)
 *
 *   **The goldens did NOT move**: `fixtureReplay` returns `null` from
 *   `startingPosition`, so a fixture models no geometry, is never offered a
 *   walk, and replays through exactly the vocabulary it always did.
 */
/**
 * ► **THE SIX-ACTIONS-IN PIN MOVED ALONE ON 2026-09-11, and the one that did
 *   NOT move is the interesting half.**
 *
 *     49866259 -> 01621469   (six actions in)
 *     83b564ac   unchanged   (settled 1v1)
 *     797ff2be   unchanged   (settled 3v3)
 *
 *   `weapon_range` became a declared resource and `ss2Reach` stopped returning
 *   `physical_size`, so `MINIMAL`'s reach went 81 -> 125 (`physical_size` 81
 *   plus weapon 0's multiplier of 1 times 44). **Neither the resource bag nor
 *   the action sequence's first five entries changed** — `MINIMAL` states no
 *   `weapon`, so it declares 32 names before and after — and the sixth action
 *   changed for a reason worth reading:
 *
 *     old  action 5: hero walks left -30 -> -74; distance is now 104, which is
 *                    NOT < the old reach of 81, so the villain drops to
 *                    `longrange_warrior`, is offered BOTH walks, and closes.
 *     new  action 5: 104 IS < 125, so the villain is still on
 *                    `closerange_warrior` — three verbs and the RETREAT — and
 *                    backs off instead.
 *
 *   So one gladiator stepping back 44 units no longer drops the other out of
 *   range, which is the build's own behaviour arriving rather than a tuning
 *   choice. The two SETTLED pins did not move at all: their fixture is staged
 *   in contact and the bout is decided before the reach ever separates them.
 */
/**
 * ► **ALL THREE MOVED AGAIN ON 2026-09-12, for a PROJECTION change again: `y`
 *   joined `combatantProjection` as the SECOND AXIS.**
 *
 *     01621469 -> 32247fc9   (six actions in)
 *     83b564ac -> abaca958   (settled 1v1)
 *     797ff2be -> ef01645a   (settled 3v3)
 *
 *   **No arithmetic changed and no action sequence changed.** `y` is `null`
 *   for every rule set in this file — `rankStride` defaults to 0, which is the
 *   second axis switched OFF — so what moved is one key per combatant in the
 *   serialised projection and nothing else. That is the whole point of the
 *   key being unconditional: two peers commit to the same shape whether or not
 *   they model depth, and the cost of that guarantee is exactly this, one
 *   re-pin per projection change.
 *
 *   **The goldens did not move, for the third time and for the same reason**:
 *   `fixtureReplay` returns `null` from `startingY` as it does from
 *   `startingPosition`, and a golden's hash is compared against another hash
 *   rather than against a literal.
 *
 *   Verified to be shape-only rather than behavioural: with the axis off,
 *   `ss2FightDistance` reduces EXACTLY to the rounded x-separation (pinned in
 *   `ss2-position.test.js` over 30,005 offsets), and every metric in
 *   `tools/engagement-census.mjs` is byte-identical to the run before the
 *   change — spread 99, mutual reach 41.0%, blows through a body 44.7%.
 */
/**
 * ► **ALL THREE MOVED AGAIN ON 2026-09-12, and this time for a GAMEPLAY change
 *   rather than a projection one: the owner played the arena and made the
 *   second axis the shipped default** — *"97 looks great, 150 is too far"*.
 *
 *     32247fc9 -> 2d047e45   (six actions in)
 *     abaca958 -> 1f2b26e4   (settled 1v1)
 *     ef01645a -> e8f10147   (settled 3v3)
 *     f6af12c0 -> d36b56ca   (vanilla-separation opening)
 *
 *   These pins stage their pair IN CONTACT at x = -/+30, both in slot 0, so
 *   both gladiators sit in rank 0 and no `ydist` is ever non-zero in the
 *   1v1 pins. **They moved because `y: 200` is now a projected value where it
 *   used to be `null`** — a one-key serialisation change, as before — and the
 *   3v3 pin moved for that AND because its six fighters now open in three
 *   ranks and fight a different bout.
 *
 *   **The goldens did not move, for the fourth time and the same reason.**
 */
/**
 * ► **TWO OF THE FOUR MOVED ON 2026-09-12 AND TWO DID NOT, which is the whole
 *   story: FACING IS NOW DERIVED FROM POSITION, as the build derives it.**
 *
 *     2d047e45 -> a6b17667   (six actions in)
 *     d36b56ca -> c46c6c20   (vanilla-separation opening)
 *     1f2b26e4   unchanged   (settled 1v1)
 *     e8f10147   unchanged   (settled 3v3)
 *
 *   `changeCombatants` recomputes `gladiator_dir` from the sign of the
 *   x-separation at every phase advance and this engine had been setting it
 *   ONCE, at construction. It is carried as the `facing-left` status, so a
 *   fighter that walks past its opponent now turns round and the status list
 *   changes — which is a projection change and therefore a hash change.
 *
 *   **The two that moved are the two that WALK.** The six-actions-in pin and
 *   the vanilla-separation opening both spend their early actions approaching;
 *   the two SETTLED pins stage their pair in contact at -/+30, close before
 *   anyone crosses, and nobody in them ever turns. That split is the evidence
 *   that this change does what it says: it moves exactly the battles where
 *   somebody's position stopped justifying their facing.
 *
 *   **No golden moved**, and here the firewall matters more than usual: a
 *   fixture models no position, so it has nothing to derive a facing FROM and
 *   gets no effect at all. `gladiator_dir` is load-bearing in the golden
 *   pipeline — `ss2-attack-candidate.js:214` picks the debris direction from
 *   it and `:576` signs the knockback force with it — so a recomputed facing
 *   would have silently re-datumed measured fixtures.
 */
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

  assert.equal(combatStateHash(battle), "a6b17667", WHY_IT_MOVED);
});

test("a SETTLED battle hashes to a pinned value, which is the only pin that covers `result`", () => {
  const battle = build(1, FIGHTER);
  const taken = driveFirst(battle, 500);

  assert.ok(battle.result, `the bout must have settled: ${taken} actions taken`);
  assert.equal(battle.result.winnerTeamId, "red");
  assert.equal(battle.result.reason, "elimination");
  assert.ok(battle.events.length > taken, "a settled bout emits more events than actions");

  assert.equal(combatStateHash(battle), "1f2b26e4", WHY_IT_MOVED);
});

/**
 * ► **THE PIN THIS FILE'S OWN HEADER SAID EXISTED, AND IT DID NOT. Added
 *   2026-09-12.** The header at the top of `build` reads: *"The approach is not
 *   left uncovered: `positionBuild` below pins it separately, so both states
 *   have a literal."* `positionBuild` was declared and NEVER CALLED — two hits
 *   in the whole repository, the claim and the declaration — so the
 *   VANILLA-SEPARATION opening had no literal at all, while the file asserted
 *   it did.
 *
 *   That gap matters more than an ordinary missing pin, because the approach is
 *   exactly the state a second axis changes: at +/-250 the first actions are
 *   walks, and a rule set with `rankStride` non-zero changes who is in reach of
 *   whom on the way in. The contact-staged pins above cannot see any of it.
 *
 *   Guarded rather than trusted: a bout still at `rngCursor` 0 after six
 *   actions is six walks and nothing else, which is a real state and one worth
 *   pinning, but it must be ASSERTED as that state rather than assumed — the
 *   defect that produced the contact staging in the first place.
 */
test("the VANILLA-SEPARATION opening hashes to a pinned value, which the contact pins cannot see", () => {
  const battle = positionBuild(1, MINIMAL);

  // The state under test: the rule set's own +/-250, a 500-unit separation,
  // and therefore an approach rather than a brawl.
  const hero = battle.teams[0].combatants[0];
  const villain = battle.teams[1].combatants[0];
  assert.equal(hero.x, -250, "the hero opens where startingPosition puts it");
  assert.equal(villain.x, 250, "and the villain mirrors it");
  // Slot 0 of both sides stands in the front rank, which is the vanilla `_y`,
  // so this opening is one-dimensional whatever the stride is — the parity
  // case on the second axis exactly as it is on the first.
  assert.equal(hero.y, 200, "slot 0 opens at the vanilla front rank");
  assert.equal(villain.y, 200);

  const taken = driveByTurn(battle, 6);
  assert.equal(taken, 6, "the drive must have applied six actions");
  assert.equal(battle.result, null, "an approach does not settle in six actions");

  assert.equal(combatStateHash(battle), "c46c6c20", WHY_IT_MOVED);
});

test("a settled 3v3 hashes to a pinned value, because N-a-side has its own projection", () => {
  // 1v1 is the parity case and cannot exercise seats, slot indices or a
  // multi-combatant elimination order. This one can.
  const battle = build(4, FIGHTER, 3);
  const taken = driveFirst(battle, 900);

  assert.ok(battle.result, `the 3v3 must have settled: ${taken} actions taken`);
  assert.equal(battle.result.winnerTeamId, "red");
  assert.equal(combatStateHash(battle), "e8f10147", WHY_IT_MOVED);
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
