/**
 * THE CLOSED-ON ARCHER WITH NOTHING TO BASH — what the AI does when a drawn bow
 * is closed on by a foe in ANOTHER rank.
 *
 * ## WHY THIS FILE EXISTS
 *
 * Since the owner's decision of 2026-09-24 (grill Q7, no rest while a foe is in
 * reach) `closerange_archer` offers no `rest`. A drawn bow whose nearest foe is
 * inside its floor (`100 + physical_size`) is on that frame, and the bash, a
 * melee verb, needs the lane (`ss2SameLane`). So a closer standing a rank over
 * leaves the archer with no attack at all. Every arm of `chooseAiAction`'s
 * `!attackOnOffer` block could decline (the toward-walk is not wired on a close
 * frame), and the decision fell into the swing table with nothing to rank, and
 * then out of it by accident:
 *
 * - to `options[0]` — the retreat walk on the plain roster, but in the tricks
 *   kit whichever spell leads the list, including a teleport the ladder's own
 *   gate had just refused;
 * - or, when the weakest foe happened to stand in the archer's own rank, to a
 *   taunt at him that the table took because it was the ONLY row, never
 *   compared with anything, and often one the taunt arm above had priced and
 *   declined.
 *
 * ## WHAT THE BUILD'S VILLAIN DOES WITH A BOW WHEN A FOE CLOSES
 *
 * `villainChooseAction` (`sprite:862[overlay]/frame:52/DoAction@0x23f835`,
 * base `0x23f83b`) calls a drawn bow OUT of range when `fightdistance < 200`
 * (`+0x0397`-`+0x03d5`), so a closed-on bow takes the out-of-range branch
 * (`+0x08c3`). That branch splits on `villain._x < hero._x` and draws
 * `choices = randomBetween(1, 100)`, inclusive at both bounds, once, in
 * whichever facing arm runs (`+0x08fe`, `+0x0bed`). For `equipped_weapon != 1`
 * its bands are, by the direction relative to the hero (offsets: villain left
 * of the hero / right of it):
 *
 * ```text
 *   choices    1-49   walk AWAY                  +0x095b / +0x0c4a
 *             50-69   jump AWAY                  +0x09c0 / +0x0caf
 *             70-74   jump AWAY (a sword charges) +0x0a25 / +0x0d14
 *             75-79   walk TOWARD                +0x0a8a / +0x0d79
 *             80-84   jump TOWARD                +0x0aef / +0x0dde
 *             85-95   taunt, or rest below 40% stamina
 *             96-100  wincrowd, or rest below 30% stamina
 * ```
 *
 * So 74 draws in 100 retreat, and the single likeliest verb is the walk away
 * (49 in 100).
 * Overrides follow — a 20% `random_swap` that puts a closed-on bow away
 * (`+0x0ed7`-`+0x0fe4`), the zero-stamina rest, the empty quiver, the taunted
 * runs, the statuses — and the ladder (`+0x1432`) last. The villain never
 * picks `bash_attack`: only the hero's buttons send it.
 *
 * ## WHAT THIS ENGINE DOES NOW
 *
 * Once the arms of the `!attackOnOffer` block that weigh something (the crowd,
 * the taunt) or change the fight (the flank, the join, the rank step) have
 * declined, a drawn bow BACKS AWAY from the foe on top of it: the band's
 * likeliest verb, taken without the sample, as every ladder arm here is. A
 * taunt or a crowd-pleaser the valuation prices above the turn is still taken
 * first. ~~a bash on offer is still priced in the table (an engine choice: the
 * villain never bashes). A walk that would not carry it away is not taken: a
 * cornered archer taunts the foe in its own rank (an engine choice too — the
 * villain's walk band reads no wall).~~
 *
 * **Rewritten the same night (night/engine e-verifier-fix), after a
 * write-nothing verifier measured the arena's default 2v2 and its champion
 * mode:** the walk is taken only if it REACHES A SHOT (every foe outside the
 * floor where it lands, and — f-chaser, the same night — still outside after
 * the nearest foe's own walk after it), otherwise the bow is PUT AWAY — the build's random
 * swap, the likeliest verb left once the walks go nowhere — and the same
 * answer is given with a bash ON offer, before the swing table, because the
 * bash is a verb the build's villain never picks. See `ss2ClosedOnBowMove`.
 * The tests from "A DRAWN BOW CLOSED ON IN ITS OWN LANE" down pin that; the
 * two above them were restated from the cornered taunt to the swap.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { combatantById, createTeamBattle, legalActions, previewAction, suggestAction } from "../src/team/index.js";
import {
  SS2_ARENA, Ss2ActionType, createSs2TeamRules, ss2ArcherMinimumRange, ss2Combatant, ss2FightDistance, ss2SameLane
} from "../src/team/ss2-rules.js";

const FRONT = SS2_ARENA.frontY;
const STRIDE = SS2_ARENA.rankStride;

const gladiator = (overrides = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 0, charisma: 6, herolevel: 5, character_level: 5, weapon: 1,
  ...overrides
});
const BOW = Object.freeze({ secondary_weapon: 61, equipped_weapon: 2 });
/** Speed 5 is blue-2's, the demo roster's blue archer (red-2 runs 6): `movement_speed` 8, a walk of 108. */
const SLOW = Object.freeze({ speed: 5 });

/** Explicit positions for every body, as `test/ss2-ai-taunt.test.js` stages them. */
function staged({ red, blue, seed = 3 } = {}) {
  const place = (prefix, list) => ({
    id: prefix,
    name: prefix,
    combatants: list.map((entry) => ss2Combatant(entry.fields, { id: entry.id, name: entry.id, controller: "local" }))
  });
  const battle = createTeamBattle({
    seed,
    rules: createSs2TeamRules({ rankStride: STRIDE }),
    teams: [place("red", red), place("blue", blue)]
  });
  for (const entry of [...red, ...blue]) {
    const one = combatantById(battle, entry.id);
    one.x = entry.x;
    one.y = entry.y;
    if (entry.health !== undefined) one.health = entry.health;
  }
  return battle;
}

/**
 * The archer at the front rank, x 0, bow drawn; `closer` a rank back and
 * `closerX` along, inside the floor; `rival` in the archer's own rank, far off.
 */
function closedOnAcrossRanks({ archer = {}, archerHealth, closerX = 100, closer = { speed: 5 }, rival = {}, rivalHealth } = {}) {
  // ► **The closer is SLOW (speed 5, a walk of 108 against the archer's 461)
  //   since 2026-09-24 (night/engine f-chaser)**: the walk away must now reach
  //   a shot that survives the closer's own walk after it, and at speed 20
  //   the closer lands back inside the floor, so the archer swaps (pinned in
  //   "AN EQUALLY FAST CLOSER TAKES THE SHOT BACK"). These tests are about the
  //   retreat itself, so they stage a closer it can outrun.
  return staged({
    red: [{ id: "archer", x: 0, y: FRONT, health: archerHealth, fields: gladiator({ ...BOW, ...archer }) }],
    blue: [
      { id: "closer", x: closerX, y: FRONT - STRIDE, fields: gladiator({ gladiator_dir: closerX > 0 ? "left" : "right", ...closer }) },
      { id: "rival", x: closerX > 0 ? 1400 : -1400, y: FRONT, health: rivalHealth,
        fields: gladiator({ gladiator_dir: closerX > 0 ? "left" : "right", ...rival }) }
    ]
  });
}

/** The staging checked rather than trusted: closed on, across ranks, nothing to hit. */
function assertClosedOnWithNothingToBash(battle) {
  const archer = combatantById(battle, "archer");
  const closer = combatantById(battle, "closer");
  assert.ok(ss2FightDistance(archer, closer) < ss2ArcherMinimumRange(archer), "the closer is inside the floor");
  assert.equal(ss2SameLane(archer, closer), false, "and in another rank");
  const offered = legalActions(battle, "archer").map((option) => option.type);
  for (const verb of [Ss2ActionType.BASH_ATTACK, Ss2ActionType.BOMBARD, Ss2ActionType.SNIPE, Ss2ActionType.REST]) {
    assert.equal(offered.includes(verb), false, `closerange_archer across ranks: no ${verb}`);
  }
  return offered;
}

test("A CLOSED-ON ARCHER HOLDING A TELEPORT ITS LADDER REFUSES BACKS AWAY, rather than casting the first spell listed", () => {
  // Ladder arm 26 (`+0x0f1c`-`+0x0fab`) casts only below half health; this
  // archer is at full. The decision used to fall to `options[0]`, which is the
  // teleport because the spells are listed before the walks.
  const battle = closedOnAcrossRanks({ archer: { inventory1: 48 } });
  const offered = assertClosedOnWithNothingToBash(battle);
  assert.equal(offered[0], Ss2ActionType.CAST_TELEPORT, "the teleport leads the list");
  const chosen = suggestAction(battle, "archer");
  assert.deepEqual({ type: chosen.type, targetId: chosen.targetId }, { type: Ss2ActionType.WALK_LEFT, targetId: "archer" },
    "the closer is to the right, so the retreat is the walk left");
});

test("A CLOSED-ON ARCHER DOES NOT TAUNT THE WEAKEST FOE JUST BECAUSE THE TABLE HAD NO OTHER ROW — it backs away", () => {
  // `rival`, in the archer's own rank and wounded, is the weakest foe, so the
  // swing table was built against him and his taunt was its only row. The
  // taunt arm of the `!attackOnOffer` block prices that same taunt against the
  // turn and, for an unwounded archer of charisma 6, declines it; the table
  // then took it anyway, compared with nothing. The next test but one raises
  // the taunt's price until the arm takes it, which is the other half.
  const battle = closedOnAcrossRanks({ rivalHealth: 20 });
  const offered = assertClosedOnWithNothingToBash(battle);
  assert.ok(offered.includes(Ss2ActionType.TAUNT), "a taunt at the rival is on offer");
  const chosen = suggestAction(battle, "archer");
  assert.deepEqual({ type: chosen.type, targetId: chosen.targetId }, { type: Ss2ActionType.WALK_LEFT, targetId: "archer" });
});

test("AND BACKS AWAY IN EITHER FACING: a closer to the LEFT sends it right", () => {
  const battle = closedOnAcrossRanks({ closerX: -100, rivalHealth: 20 });
  assertClosedOnWithNothingToBash(battle);
  const chosen = suggestAction(battle, "archer");
  assert.deepEqual({ type: chosen.type, targetId: chosen.targetId }, { type: Ss2ActionType.WALK_RIGHT, targetId: "archer" });
});

test("A TAUNT THE VALUATION PRICES ABOVE THE TURN IS STILL TAKEN FIRST — the retreat comes after the taunt arm", () => {
  // Wounded (the recovery is worth `3 + ceil(stamina)`, and nobody can hit
  // back: the closer is a rank over and the rival 1,400 off) and charismatic,
  // so the taunt arm's price beats the shot this archer would walk away to.
  // The same staging as the two tests above in every other respect.
  const battle = closedOnAcrossRanks({ archer: { charisma: 20 }, archerHealth: 8 });
  assertClosedOnWithNothingToBash(battle);
  const chosen = suggestAction(battle, "archer");
  assert.deepEqual({ type: chosen.type, targetId: chosen.targetId }, { type: Ss2ActionType.TAUNT, targetId: "rival" });
});

test("IN A 1v1 THE DUEL'S RANK ARM ANSWERS FIRST: the archer steps into the closer's rank, as before", () => {
  // A duel may only close a rank gap (`legalActions`, the owner's rule of
  // 2026-09-12), and with no foe in its own rank the archer's rank arm steps
  // toward the nearest foe's rank before the retreat is reached. So the
  // retreat changes no 1v1 whose two gladiators stand in different ranks; the
  // demo roster's own 1v1 has no archer at all.
  const battle = staged({
    red: [{ id: "archer", x: 0, y: FRONT, fields: gladiator({ ...BOW, inventory1: 48 }) }],
    blue: [{ id: "closer", x: 100, y: FRONT - STRIDE, fields: gladiator({ gladiator_dir: "left" }) }]
  });
  const archer = combatantById(battle, "archer");
  assert.ok(ss2FightDistance(archer, combatantById(battle, "closer")) < ss2ArcherMinimumRange(archer));
  const offered = legalActions(battle, "archer").map((option) => option.type);
  assert.ok(offered.includes(Ss2ActionType.WALK_LEFT), "the retreat is on offer");
  assert.equal(suggestAction(battle, "archer").type, Ss2ActionType.RANK_BACK);
});

/* ------------------------------------------------------------------ *
 * A retreat that cannot carry the archer away is not a retreat        *
 * ------------------------------------------------------------------ */

/** Where the walk away would put the archer, by the rule set's own preview. */
function retreatLandsAt(battle, type) {
  return previewAction(battle, { actorId: "archer", type, targetId: "archer" })?.destination?.x;
}

test("AN ARCHER PINNED AT THE WALL DOES NOT WALK INTO IT: it puts the bow away (~~it taunts the foe in its own rank~~)", () => {
  // Found by the Codex review of this change (pass 1) and reproduced before it
  // was fixed. At x -2100 the walk left is still offered and still costs its
  // stamina, and the clamp (`SS2_ARENA.clamp`) leaves the archer where it
  // stood — closed on as before. The build's villain would walk into the wall
  // just the same (its walk band reads no wall), so this is an engine choice:
  // the retreat's only worth is the shot it walks toward, and a walk that goes
  // nowhere reaches none, ~~so the taunt the arm above weighed against that shot
  // is taken instead. It is the band the build draws next that this frame
  // wires (85-95), after the two retreats and the jump this engine lacks.~~
  //
  // ► **CORRECTED 2026-09-24 (night/engine e-verifier-fix): THE CORNERED
  //   ARCHER PUTS ITS BOW AWAY.** The taunt was taken UNCONDITIONALLY — after
  //   the taunt arm above had priced it and declined — and a write-nothing
  //   verifier measured what that did on the arena's default size: tricks 2v2
  //   seed 140, blue-2 pinned at x 2100 taunted a foe about 3,400 units off 18
  //   times at full health. The next verb the build draws for a closed-on bow
  //   that CHANGES anything is not the taunt band (85-95) but the random swap
  //   that overrides every band one turn in five (`+0x0ed7`-`+0x0fe4`): the
  //   walk and jump bands go nowhere at a wall, so of what is left the swap is
  //   ~~20 draws in 100 against the taunt's 8.8 (11 of the 80 the swap
  //   leaves)~~ 18 against 7.92: the psyche roll after the swap rests a bow
  //   on 10 turns in 100 and overwrites it (corrected the same night; see
  //   `ss2ClosedOnBowMove`).
  //   A taunt the valuation prices above the turn is still taken — by the
  //   taunt arm, which comes first.
  //
  // Two woundings: the review's own staging (the rival the weakest, so the
  // swing table's lone TAUNT row would have named him anyway), and the closer
  // the weakest, where the table has no row at all.
  for (const [archerX, closerX, rivalX, away] of [
    [-2100, -2000, -700, Ss2ActionType.WALK_LEFT],
    [2100, 2000, 700, Ss2ActionType.WALK_RIGHT]
  ]) {
    for (const { rivalHealth, closerHealth } of [{ rivalHealth: 20 }, { closerHealth: 10 }]) {
      const battle = staged({
        red: [{ id: "archer", x: archerX, y: FRONT, fields: gladiator({ ...BOW, gladiator_dir: closerX > archerX ? "right" : "left" }) }],
        blue: [
          { id: "closer", x: closerX, y: FRONT - STRIDE, health: closerHealth, fields: gladiator() },
          { id: "rival", x: rivalX, y: FRONT, health: rivalHealth, fields: gladiator() }
        ]
      });
      const offered = assertClosedOnWithNothingToBash(battle);
      assert.ok(offered.includes(away), `at ${archerX} the walk away is on offer`);
      assert.equal(retreatLandsAt(battle, away), archerX, `and at ${archerX} it goes nowhere`);
      const chosen = suggestAction(battle, "archer");
      assert.deepEqual({ type: chosen.type, targetId: chosen.targetId }, { type: Ss2ActionType.SWAP_WEAPONS, targetId: "archer" },
        `pinned at ${archerX}, rival ${rivalHealth ?? "unhurt"}, closer ${closerHealth ?? "unhurt"}`);
    }
  }
});

test("AND A WALK AWAY THAT A BODY BEHIND TURNS ROUND IS NOT A RETREAT EITHER, wherever the rival stands: the bow is put away", () => {
  // An ally standing inside its own `physical_size` behind the archer, in the
  // archer's lane: the build's clamp (`defender._x - physical_size`, `+0x3de6`)
  // sets the destination beyond it, which lands IN FRONT of where the archer
  // stood, so the "retreat" carries it a few units toward the closer — and from
  // there, nowhere. Moving is not enough; it has to move away.
  //
  // ► **THE RIVAL ON THE FAR SIDE WAS THE CODEX REVIEW'S SECOND FINDING (pass
  //   2), reproduced before it was fixed.** With the rival in the archer's rank
  //   beyond the ally, the walk away from the closer is ALSO the walk toward
  //   the rival, and the toward-walk arm returned it before the retreat's check
  //   ran: walk-left from 0 to 6, then walk-left from 6 to 6, a taunt on offer.
  //   **It happened on the arena's own host before this change**: tricks 3v3,
  //   seed 3, actions 114 and 144, red-2 closed on across ranks with red-1 at
  //   its back — walk-left, and it moved ONE unit, rightward, both times.
  // The closer is the weakest foe, so the swing table has no row to fall to.
  for (const [archerX, rivalX] of [[0, 1400], [0, -1400], [6, -1400]]) {
    const battle = staged({
      red: [
        { id: "archer", x: archerX, y: FRONT, fields: gladiator({ ...BOW }) },
        { id: "mate", x: -80, y: FRONT, fields: gladiator() }
      ],
      blue: [
        // Slow (f-chaser): a closer the archer could outrun, so that only the
        // body behind it — not the closer's walk after it — refuses the walk.
        { id: "closer", x: 100, y: FRONT - STRIDE, health: 10, fields: gladiator({ gladiator_dir: "left", ...SLOW }) },
        { id: "rival", x: rivalX, y: FRONT, fields: gladiator({ gladiator_dir: rivalX > 0 ? "left" : "right" }) }
      ]
    });
    assertClosedOnWithNothingToBash(battle);
    const landing = retreatLandsAt(battle, Ss2ActionType.WALK_LEFT);
    assert.ok(landing >= archerX, `from ${archerX} the walk left lands at ${landing}, not farther from the closer`);
    const chosen = suggestAction(battle, "archer");
    // ~~TAUNT at the rival~~ — the swap since 2026-09-24; see the test above.
    assert.deepEqual({ type: chosen.type, targetId: chosen.targetId }, { type: Ss2ActionType.SWAP_WEAPONS, targetId: "archer" },
      `archer at ${archerX}, rival at ${rivalX}`);
  }
});

/* ------------------------------------------------------------------ *
 * The bands for EVERY closed-on bow, the bash on offer or not         *
 * (2026-09-24, night/engine e-verifier-fix)                           *
 * ------------------------------------------------------------------ */

// ► **WHY THESE EXIST: THE BASH WAS STILL REACHABLE, AND THE BUILD NEVER
//   PICKS IT.** The arm above answered only the closed-on bow with NOTHING to
//   bash. With the closer in its own lane the decision went to the swing table,
//   where the taunt-heal fix of the same night (the return blows, and the
//   rounding tolerance) turned the table's taunt into a BASH. A write-nothing
//   verifier measured that on the arena's champion mode: 151 of 972 champion
//   1v1 bouts changed, 77 of them first at a closed-on archer switching taunt ->
//   bash. `villainChooseAction` never writes `bash_attack` (map, "AND THE
//   BUILD'S MELEE NEVER CHECKS DISTANCE"; "The out-of-range bands"): its bow
//   with `fightdistance < 200` is OUT of range and draws a movement band. So
//   the bands now answer every closed-on bow, the bash on offer or not.
//
// ► **AND A RETREAT HAS TO REACH A SHOT, which is what stops the ping-pong.**
//   Across ranks a closer cannot swing at the archer at all (the lane rule), so
//   a walk that leaves him inside the floor buys nothing — and on tricks 2v2
//   seed 67 it was a ping-pong: the archer walked away, the closer (flanking)
//   walked past it, the archer walked back, 215 actions without a wound.


/** Both in the front rank: the closer is in the archer's LANE, so the bash is on offer. */
function closedOnInLane({ archerX = 0, archerHealth, closerX = 100, closer = {}, extra = [] } = {}) {
  return staged({
    red: [{ id: "archer", x: archerX, y: FRONT, health: archerHealth, fields: gladiator({ ...BOW }) }],
    blue: [
      { id: "closer", x: closerX, y: FRONT, fields: gladiator({ gladiator_dir: closerX > archerX ? "left" : "right", ...closer }) },
      ...extra
    ]
  });
}

/** Where a walk would put the archer, and whether every foe would then stand outside its floor. */
function walkReachesShot(battle, type) {
  const archer = combatantById(battle, "archer");
  const to = previewAction(battle, { actorId: "archer", type, targetId: "archer" })?.destination?.x;
  const foes = battle.teams.find((team) => team.id === "blue").combatants;
  const clear = foes.every((foe) => !(ss2FightDistance({ ...archer, x: to }, foe) < ss2ArcherMinimumRange(archer)));
  return { to, clear };
}

const pick = (battle) => {
  const chosen = suggestAction(battle, "archer");
  return { type: chosen.type, targetId: chosen.targetId };
};

test("A DRAWN BOW CLOSED ON IN ITS OWN LANE BACKS AWAY — IT DOES NOT BASH, the bash on offer or not", () => {
  // Full health is the rounding tie the tolerance settles for the bash; 20 of
  // 170 is the taunt-heal loop's state, where the return blows turned the taunt
  // into a bash. Both are a closed-on bow, so both take the band. The closer
  // is slow (speed 5), so the shot survives his walk after it (f-chaser; the
  // equally fast closer is the swap, pinned further down).
  for (const closerX of [100, -100]) {
    for (const archerHealth of [undefined, 20]) {
      const battle = closedOnInLane({ closerX, archerHealth, closer: SLOW });
      const archer = combatantById(battle, "archer");
      assert.ok(ss2FightDistance(archer, combatantById(battle, "closer")) < ss2ArcherMinimumRange(archer), "inside the floor");
      const offered = legalActions(battle, "archer").map((option) => option.type);
      assert.ok(offered.includes(Ss2ActionType.BASH_ATTACK), "the bash IS on offer: same lane");
      const away = closerX > 0 ? Ss2ActionType.WALK_LEFT : Ss2ActionType.WALK_RIGHT;
      assert.equal(walkReachesShot(battle, away).clear, true, "and the walk away reaches a shot");
      assert.deepEqual(pick(battle), { type: away, targetId: "archer" },
        `closer at ${closerX}, archer at ${archerHealth ?? "full"} health`);
    }
  }
});

test("A RETREAT THAT REACHES NO SHOT IS NOT TAKEN: at the wall, or between two foes, the archer PUTS THE BOW AWAY", () => {
  // The build's random swap (`+0x0ed7`-`+0x0fe4`): one turn in five a closed-on
  // bow is put away, whatever band was drawn. Where every walk band goes
  // nowhere, it is the likeliest verb left that changes the fight (~~20 in 100,
  // against the taunt band's 8.8~~ 18 against 7.92, corrected). Never the bash,
  // which the build never picks.
  const cases = [
    { label: "pinned at -2100", archerX: -2100, closerX: -2000, away: Ss2ActionType.WALK_LEFT },
    { label: "pinned at 2100", archerX: 2100, closerX: 2000, away: Ss2ActionType.WALK_RIGHT },
    {
      label: "between two foes", archerX: 0, closerX: 90, away: Ss2ActionType.WALK_LEFT,
      extra: [{ id: "other", x: -95, y: FRONT, fields: gladiator({ gladiator_dir: "right" }) }]
    }
  ];
  for (const { label, archerX, closerX, away, extra } of cases) {
    const battle = closedOnInLane({ archerX, closerX, extra });
    const offered = legalActions(battle, "archer").map((option) => option.type);
    assert.ok(offered.includes(Ss2ActionType.BASH_ATTACK) && offered.includes(away), `${label}: bash and walk on offer`);
    assert.equal(walkReachesShot(battle, away).clear, false, `${label}: the walk away reaches no shot`);
    assert.deepEqual(pick(battle), { type: Ss2ActionType.SWAP_WEAPONS, targetId: "archer" }, label);
  }
});

test("THE PING-PONG: across ranks, a walk that leaves the closer inside the floor is not a retreat — tricks 2v2 seed 67", () => {
  // The two states the archer alternated between on seed 67 (blue-2 at rank
  // 103, red-1 flanking it from rank 200), mirrored here: the closer 10 to its
  // right and 40 to its left. Each walk away is 108, and lands 153 and 177
  // from the closer — both inside the floor of 186 — so each retreat reached
  // nothing and only handed the flanker the next pass. A rival in the archer's
  // own rank keeps the rank arm shut, as on the seed.
  for (const closerX of [10, -40]) {
    const battle = staged({
      red: [{ id: "archer", x: 0, y: FRONT - STRIDE, fields: gladiator({ ...BOW, ...SLOW }) }],
      blue: [
        { id: "closer", x: closerX, y: FRONT, fields: gladiator() },
        { id: "rival", x: -1600, y: FRONT - STRIDE, fields: gladiator({ ...BOW, gladiator_dir: "right" }) }
      ]
    });
    const away = closerX > 0 ? Ss2ActionType.WALK_LEFT : Ss2ActionType.WALK_RIGHT;
    const offered = assertClosedOnWithNothingToBash(battle);
    assert.ok(offered.includes(away), "the walk away is on offer");
    const { to, clear } = walkReachesShot(battle, away);
    assert.equal(Math.abs(to), 108, "a walk of 108");
    assert.equal(clear, false, "and it leaves the closer inside the floor");
    assert.deepEqual(pick(battle), { type: Ss2ActionType.SWAP_WEAPONS, targetId: "archer" }, `closer at ${closerX}`);
  }
});

test("AND EVERY FOE COUNTS, not only the one on top of it: a walk that lands inside another's floor is no retreat", () => {
  // A fast archer (a walk of 461) whose walk away from the closer would carry
  // it well clear of him — and onto a second foe in its own rank. The closer
  // is slow (f-chaser), so his walk after it would not refuse the walk.
  const battle = staged({
    red: [{ id: "archer", x: 0, y: FRONT, fields: gladiator({ ...BOW }) }],
    blue: [
      { id: "closer", x: 40, y: FRONT - STRIDE, fields: gladiator(SLOW) },
      { id: "second", x: -500, y: FRONT, fields: gladiator({ gladiator_dir: "right" }) }
    ]
  });
  assertClosedOnWithNothingToBash(battle);
  const archer = combatantById(battle, "archer");
  const { to, clear } = walkReachesShot(battle, Ss2ActionType.WALK_LEFT);
  assert.ok(ss2FightDistance({ ...archer, x: to }, combatantById(battle, "closer")) >= ss2ArcherMinimumRange(archer),
    "the walk clears the closer");
  assert.equal(clear, false, "but lands inside the second foe's floor");
  assert.deepEqual(pick(battle), { type: Ss2ActionType.SWAP_WEAPONS, targetId: "archer" });
});

test("THE LADDER STILL COMES FIRST, as `villain_cast_spells()` runs after the bands: a closed-on archer below half health teleports", () => {
  // Ladder arm 26 (`+0x0f1c`-`+0x0fab`): a teleport below half health, inside
  // 250. The bands are drawn before the ladder in the build, so the ladder
  // overwrites them; here it is read first. The same staging at full health is
  // the first test of this file, where the ladder refuses and the walk is taken.
  const battle = staged({
    red: [{ id: "archer", x: 0, y: FRONT, health: 40, fields: gladiator({ ...BOW, inventory1: 48 }) }],
    blue: [{ id: "closer", x: 100, y: FRONT, fields: gladiator({ gladiator_dir: "left" }) }]
  });
  assert.ok(legalActions(battle, "archer").some((option) => option.type === Ss2ActionType.BASH_ATTACK), "the bash is on offer");
  assert.equal(pick(battle).type, Ss2ActionType.CAST_TELEPORT);
});

test("AND A DAMAGE SPELL ON OFFER IS STILL PRICED IN THE TABLE, not walked away from", () => {
  // A bolt is an attack on offer that is not the bash; the table ranks it
  // (`SS2_DAMAGE_SPELL_LADDER`) and the band is not read, as before.
  const battle = staged({
    red: [{ id: "archer", x: 0, y: FRONT, fields: gladiator({ ...BOW, magicka: 20, inventory1: 34 }) }],
    blue: [{ id: "closer", x: 100, y: FRONT, fields: gladiator({ gladiator_dir: "left" }) }]
  });
  const offered = legalActions(battle, "archer").map((option) => option.type);
  const bolt = offered.find((type) => type.startsWith("cast-") && type !== Ss2ActionType.CAST_TELEPORT);
  assert.ok(bolt, `a damage spell is on offer (${offered.join(" ")})`);
  assert.equal(pick(battle).type, bolt);
});

/** The arena's own host, as `test/arena-item-kits.test.js` builds it. */
async function arenaBout(kit, size, seed, cap, onDecision = () => {}) {
  const { demoSide, demoItemsFrom } = await import("../tools/arena/roster.js");
  const { ss2BattleValues, ss2TeamRules } = await import("../src/team/ss2-rules.js");
  const { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } = await import("../src/adapter/index.js");
  const items = kit === "plain" ? [] : demoItemsFrom(kit);
  const host = createVanillaBattleHost({
    teams: [
      demoSide("red", size, { ss2Combatant, ss2BattleValues, items, seed }),
      demoSide("blue", size, { ss2Combatant, ss2BattleValues, items, seed })
    ],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed
  });
  host.constructArena();
  const everyone = () => host.combatantIds().map((id) => host.combatant(id));
  let actions = 0;
  let quiet = 0;
  let longestQuiet = 0;
  for (; actions < cap && !host.battle.result; actions += 1) {
    const actorId = host.currentCombatantId();
    const suggestion = host.suggestAction();
    onDecision(host, actorId, suggestion);
    const before = everyone().map((one) => one.health);
    host.submit({ actorId, ...suggestion });
    const wounded = everyone().some((one, index) => one.health < before[index]);
    quiet = wounded ? 0 : quiet + 1;
    longestQuiet = Math.max(longestQuiet, quiet);
  }
  return { actions, result: host.battle.result, longestQuiet };
}

test("TRICKS 2v2 SEED 67 ON THE ARENA'S OWN HOST: no 200 actions without a wound (it was 215)", async () => {
  // The verifier's measurement on the tree before this fix: 215 consecutive
  // actions without any health falling, the ping-pong above and a cross-rank
  // chase to the wall. 2v2 is the arena's DEFAULT size (`perSideFrom` falls
  // back to 2), which neither earlier report measured.
  const { actions, result, longestQuiet } = await arenaBout("tricks", 2, 67, 1000);
  assert.ok(result, `the bout ends inside 1000 actions (${actions})`);
  assert.ok(longestQuiet < 200, `the longest stretch without a wound is ${longestQuiet}`);
});

test("ON THE ARENA'S OWN HOST NO DRAWN BOW ON THE CLOSE FRAME BASHES: plain, tricks and buffs, 2v2 and 3v3, seeds 1-5", async () => {
  // The property the champion regression broke, pinned where the demo roster
  // can reach it: the build's villain never writes `bash_attack`, and a
  // closed-on bow now answers with its band. Measured before this fix on the
  // same thirty bouts: bashes by closed-on bows in tricks and buffs.
  const { ss2InBowMode } = await import("../src/team/ss2-rules.js");
  const bashes = [];
  for (const kit of ["plain", "tricks", "buffs"]) {
    for (const size of [2, 3]) {
      for (let seed = 1; seed <= 5; seed += 1) {
        await arenaBout(kit, size, seed, 1000, (host, actorId, suggestion) => {
          if (suggestion.type !== Ss2ActionType.BASH_ATTACK) return;
          const actor = host.combatant(actorId);
          if (ss2InBowMode(actor)) bashes.push(`${kit} ${size}v${size} seed ${seed}: ${actorId}`);
        });
      }
    }
  }
  assert.deepEqual(bashes, []);
});

/* ------------------------------------------------------------------ *
 * A shot the closer takes straight back is not a shot                 *
 * (2026-09-24, night/engine f-chaser)                                 *
 * ------------------------------------------------------------------ */

// ► **WHY: THE REACH-A-SHOT TEST ASSUMED THE CLOSER STANDS STILL.** A
//   write-nothing verifier (engine-4) measured what that did at stride 0: an
//   equally fast swordsman follows the archer's walk, closes again, and the
//   archer walks again — to the wall. Plain 2v2 at `?rank=0`, seeds 1-200:
//   the mean longest stretch without a wound 14.3 -> 23.9, and 58 bouts with a
//   stretch of 40 or more where there had been none. So the walk now has to
//   reach a shot that SURVIVES the nearest foe's own walk after it.

/** Where `closerId`'s walk toward the archer lands once the archer stands at `archerX`. */
function chaserLandsAt(battle, archerX, closerId = "closer") {
  const archer = combatantById(battle, "archer");
  const closer = combatantById(battle, closerId);
  const saved = archer.x;
  archer.x = archerX;
  const type = archerX > closer.x ? Ss2ActionType.WALK_RIGHT : Ss2ActionType.WALK_LEFT;
  const to = previewAction(battle, { actorId: closerId, type, targetId: closerId })?.destination?.x;
  archer.x = saved;
  return to;
}

test("AN EQUALLY FAST CLOSER TAKES THE SHOT BACK, so the walk is no retreat: the bow is put away", () => {
  // Speed 20 on both sides: a walk of 461 each. The archer's walk lands clear
  // of the floor, and the closer's walk after it lands on top of it again.
  for (const closerX of [100, -100]) {
    const battle = closedOnInLane({ closerX });
    const away = closerX > 0 ? Ss2ActionType.WALK_LEFT : Ss2ActionType.WALK_RIGHT;
    const { to, clear } = walkReachesShot(battle, away);
    assert.equal(clear, true, "the walk alone reaches a shot");
    const archer = combatantById(battle, "archer");
    const chased = chaserLandsAt(battle, to);
    assert.ok(ss2FightDistance({ ...archer, x: to }, { ...combatantById(battle, "closer"), x: chased }) < ss2ArcherMinimumRange(archer),
      `but the closer's walk from ${closerX} lands at ${chased}, inside the floor again`);
    assert.deepEqual(pick(battle), { type: Ss2ActionType.SWAP_WEAPONS, targetId: "archer" }, `closer at ${closerX}`);
  }
});

test("PLAIN 2v2 AT STRIDE 0, SEED 24, ON THE ARENA'S OWN HOST: no 40 actions without a wound (the kite ran 57)", async () => {
  // The verifier's worst bout: the demo archer kited an equally fast
  // swordsman across the arena, each walk reaching a shot the swordsman's
  // next walk took back. Before the closed-on band existed the bout's longest
  // quiet stretch was 10.
  const { demoSide } = await import("../tools/arena/roster.js");
  const { ss2BattleValues } = await import("../src/team/ss2-rules.js");
  const { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } = await import("../src/adapter/index.js");
  const host = createVanillaBattleHost({
    teams: [
      demoSide("red", 2, { ss2Combatant, ss2BattleValues }),
      demoSide("blue", 2, { ss2Combatant, ss2BattleValues })
    ],
    rules: createSs2TeamRules({ rankStride: 0 }),
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed: 24
  });
  host.constructArena();
  const everyone = () => host.combatantIds().map((id) => host.combatant(id));
  let quiet = 0;
  let longestQuiet = 0;
  let actions = 0;
  for (; actions < 1000 && !host.battle.result; actions += 1) {
    const actorId = host.currentCombatantId();
    const before = everyone().map((one) => one.health);
    host.submit({ actorId, ...host.suggestAction() });
    quiet = everyone().some((one, index) => one.health < before[index]) ? 0 : quiet + 1;
    longestQuiet = Math.max(longestQuiet, quiet);
  }
  assert.ok(host.battle.result, `the bout ends inside 1000 actions (${actions})`);
  assert.ok(longestQuiet < 40, `the longest stretch without a wound is ${longestQuiet}`);
});

test("AND THE CLOSER'S WALK IS CLAMPED BY EVERY BODY IN HIS WAY, as the resolver clamps it: a mate in his lane lets the retreat stand", () => {
  // The closer (speed 20) is a rank over. Alone, his walk after the archer
  // would land him inside its floor again, and the archer would swap. Here the
  // archer's mate stands in the CLOSER's lane, between him and where the
  // archer lands, so the build's clamp stops him a body-width short of the
  // mate — out of the floor — and the walk away is a retreat after all. The
  // resolver clamps a walk against the walker's foes and his other allies
  // (`bodies` in `resolveAction`), so the chaser is asked of the same set.
  const rivalAt = 1400;
  const battle = staged({
    red: [
      { id: "archer", x: 0, y: FRONT, fields: gladiator({ ...BOW }) },
      { id: "mate", x: -200, y: FRONT - STRIDE, fields: gladiator({ gladiator_dir: "right" }) }
    ],
    blue: [
      { id: "closer", x: 40, y: FRONT - STRIDE, fields: gladiator({ gladiator_dir: "left" }) },
      { id: "rival", x: rivalAt, y: FRONT, fields: gladiator({ gladiator_dir: "left" }) }
    ]
  });
  assertClosedOnWithNothingToBash(battle);
  const { to, clear } = walkReachesShot(battle, Ss2ActionType.WALK_LEFT);
  assert.equal(clear, true, `the walk left lands at ${to}, clear of every foe`);
  const archer = combatantById(battle, "archer");
  const closer = combatantById(battle, "closer");
  const chased = chaserLandsAt(battle, to);
  assert.ok(chased > -200, `the mate stops the closer at ${chased}`);
  assert.ok(!(ss2FightDistance({ ...archer, x: to }, { ...closer, x: chased }) < ss2ArcherMinimumRange(archer)),
    "short of the archer's floor");
  const unclamped = { ...closer, x: closer.x - 461 };
  assert.ok(ss2FightDistance({ ...archer, x: to }, unclamped) < ss2ArcherMinimumRange(archer),
    "while an unclamped walk of 461 would have put him inside it");
  assert.deepEqual(pick(battle), { type: Ss2ActionType.WALK_LEFT, targetId: "archer" });
});
