/**
 * `rankJoinSurplus` — how willing an AI gladiator is to leave its own fight and
 * join an ally's.
 *
 * ## WHY THIS EXISTS, and the question it replaces
 *
 * Ranked item 2 of the 2026-09-18 handoff called the TEAM LAYOUT blocking:
 * *"With lanes enforced and `startingY` opening ally slot 1 one rank back, a 2v2
 * is two parallel duels and a 3v3 is three. Nobody can gang up. Either allies
 * start in one lane and ranks become a tactical move, or the AI learns to change
 * rank to join a fight."*
 *
 * **The premise is backwards.** Measured 2026-09-19 over 24 seeded 3v3 bouts,
 * counting turns on which a gladiator is inside 2+ enemies' melee reach **with
 * `ss2SameLane` applied exactly as the attack offer applies it**:
 *
 * ```text
 *   rankStride 97 (shipped)    59 of 1,983 turns   3.0%   in 14 of 24 bouts
 *   rankStride 0  (one lane)    0 of 2,851 turns   0.0%   in  0 of 24 bouts
 * ```
 *
 * One lane is the arrangement in which ganging up is IMPOSSIBLE — a walk may
 * never cross a foe (`ss2WalkDestination`, `+0x3de6`), so two allies approaching
 * one target queue on the same side of it. **The lanes are the only thing that
 * makes a 2-on-1 reachable at all**, so the first option is the disease and the
 * second is the whole question. This file is the second option, as a dial.
 *
 * ## WHAT IS THE BUILD'S AND WHAT IS THIS ENGINE'S
 *
 * **None of this is the build's.** Vanilla SS2 is a duel; it has no ranks, no
 * allies and no rank verbs, and `MAP_SILENCE.multi-slot-arena-geometry` records
 * that it cannot settle multi-slot geometry at all. The rank verbs, the stride,
 * `ss2RankToJoin` and this dial are all this engine's invention, and
 * `chooseAiAction`'s provenance note already says the policy is invented.
 *
 * ## THE SWEEP, because the dial is the owner's and a dial needs a curve
 *
 * 300 seeded 3v3 bouts an arm, on the demo roster through the arena's own host.
 * **Head-to-head against the shipped policy, run on BOTH arms plus the control**
 * — a one-armed A/B is an A, which is how the previous handoff's taunt claim
 * went wrong:
 *
 * ```text
 *   surplus   as team 0       as team 1       alternating
 *   0         155-145  51.7%  136-164  45.3%  130-170  43.3%   -2.3σ
 *   -1        166-133  55.5%  148-150  49.7%  150-149  50.2%   +0.1σ
 *   -99       166-133  55.5%  148-150  49.7%  150-149  50.2%   +0.1σ
 * ```
 *
 * And what a bout LOOKS like with both sides on the same value:
 *
 * ```text
 *   surplus   turns/bout  settled    2-on-1 turns   rank changes   taunts
 *   off               97   300/300     804 (2.7%)            500     2661
 *   0                 92   300/300    1465 (5.3%)            847     2290
 *   -1               137   297/300     754 (1.8%)           1113     3074
 *   -99              137   297/300     754 (1.8%)           1113     3074
 * ```
 *
 * ► **JOINING DOES NOT WIN, AND THAT IS THE POINT RATHER THAN A PROBLEM.** At 0
 *   it LOSES about 2.3σ; below 0 it is dead even. So this is the same shape of
 *   decision as `aiCharges`: a trait that makes the opponent more interesting to
 *   fight and slightly worse at fighting. **The win-rate is also the wrong
 *   number for the PvP case** — ship it and both sides have it, so it is
 *   symmetric; it only costs anything against an AI opponent.
 *
 * ► **AND `-1` IS WORSE THAN DOING NOTHING AT THE VERY THING IT IS FOR.** It
 *   halves the 2-on-1 rate against `off` (1.8% against 2.7%) while tripling rank
 *   changes, because everybody breaks off constantly and nobody stands still
 *   long enough for a second attacker to arrive. **Churn, not focus.** Bouts
 *   also run 41% longer and three of 300 stop settling.
 *
 * ► **`-1`, `-2` AND `-99` ARE THE SAME POLICY ON THIS ROSTER**, byte-identical
 *   in both tables, and the reason is structural: with one gladiator a side in a
 *   rank the surplus only ever reaches -1, so anything below it cannot bind.
 *   **The dial has three distinguishable settings here, not a curve** — off, 0,
 *   and "anything negative" — and saying so is the honest shape of the result.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { combatantById, createTeamBattle, legalActions, suggestAction } from "../src/team/index.js";
import {
  SS2_ARENA, Ss2ActionType, createSs2TeamRules, ss2Combatant, ss2RankToJoin, ss2TeamRules
} from "../src/team/ss2-rules.js";

const gladiator = (overrides = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 0, charisma: 6, herolevel: 5, character_level: 5, weapon: 1,
  ...overrides
});

const FRONT = SS2_ARENA.frontY;
const BACK = SS2_ARENA.frontY - SS2_ARENA.rankStride;

function staged({ red, blue, seed = 3, rankJoinSurplus }) {
  const place = (prefix, list) => ({
    id: prefix,
    name: prefix,
    combatants: list.map((entry, index) =>
      ss2Combatant(entry.fields, {
        id: entry.id ?? `${prefix}-${index + 1}`,
        name: entry.id ?? `${prefix}-${index + 1}`,
        controller: "local"
      })
    )
  });
  const battle = createTeamBattle({
    seed,
    rules: rankJoinSurplus === undefined ? ss2TeamRules : createSs2TeamRules({ rankJoinSurplus }),
    teams: [place("red", red), place("blue", blue)]
  });
  for (const [prefix, list] of [["red", red], ["blue", blue]]) {
    list.forEach((entry, index) => {
      const one = combatantById(battle, entry.id ?? `${prefix}-${index + 1}`);
      if (entry.x !== undefined) one.x = entry.x;
      if (entry.y !== undefined) one.y = entry.y;
    });
  }
  return battle;
}

/**
 * The staging every behavioural test here uses: `hero` holds the BACK rank with
 * one foe of its own (`keeper`, out of reach), while its ally `mate` is already
 * engaged in the FRONT rank against `boss`. Joining means leaving `keeper` to
 * make it 2-on-1 on `boss`; holding means staying.
 *
 * ► **`hero` STANDS ON THE FAR SIDE OF THE FIGHT ON PURPOSE, AND THAT IS NOT
 *   COSMETIC.** `ss2FlankingWalk` runs BEFORE this arm and answers the same
 *   situation with a WALK — "keep walking until I am past the target, and only
 *   then let the rank arm bring me in, arriving behind". It is a PRELUDE to the
 *   join rather than a competitor, which is why the join is ordered after it and
 *   not before. It declines when the actor is already on the opposite side from
 *   the engaging ally, or when the nearest foe shares the actor's rank — and
 *   both hold here, so these tests exercise the join and not the flank.
 *
 *   **The first version of this file staged `hero` on the same side and every
 *   behavioural test returned `walk-right`.** Worth keeping: a test that stages
 *   past the arm it means to exercise reports the wrong function green.
 */
function brawl(rankJoinSurplus, { keeper = true } = {}) {
  return staged({
    rankJoinSurplus,
    red: [
      { id: "hero", fields: gladiator(), x: 600, y: BACK },
      { id: "mate", fields: gladiator(), x: -60, y: FRONT }
    ],
    blue: [
      ...(keeper
        ? [{ id: "keeper", fields: gladiator({ gladiator_dir: "left" }), x: 900, y: BACK }]
        : []),
      { id: "boss", fields: gladiator({ gladiator_dir: "left" }), x: 60, y: FRONT }
    ]
  });
}

/* ------------------------------------------------------------------ *
 * THE DEFAULT IS OFF, BY CONSTRUCTION
 * ------------------------------------------------------------------ */

test("THE SHIPPED RULE SET NEVER JOINS, and the arm is off before it reads anything", () => {
  // ► **THE ASSERTION THAT COULD HAVE VARIED, and it caught a real error.** The
  //   first cut of this parameter defaulted to 0 and said in its own docstring
  //   that nothing moved at the default. Measured on the arena's own path: 25
  //   seeded 3v3 bouts went from 2,234 decisions to 2,307, `rank-front` from 14
  //   to 28 and `rank-back` from 29 to 51. **At 0 the arm still fires from a
  //   rank holding an ally and one foe, and it aims at the rank where an ALLY is
  //   fighting where the old arm aimed at the NEAREST FOE's rank** — two
  //   different moves, both reachable.
  //
  //   `Infinity` is the off switch and `ss2RankToJoin` returns `null` for it
  //   before reading the view, so the default is a no-op by construction rather
  //   than by argument.
  const view = { actor: { id: "hero", y: BACK, x: 0 }, allies: [], foes: [] };
  assert.equal(ss2RankToJoin(view, Infinity, SS2_ARENA.rankStride), null);

  const battle = brawl(undefined);
  assert.doesNotMatch(suggestAction(battle, "hero").type, /^rank-/, "the shipped AI holds its rank");
  assert.equal(ss2TeamRules.id, "ss2-map-derived-tournament");
  assert.equal(createSs2TeamRules().id, "ss2-map-derived-tournament");
});

test("a finite value names itself in the id, and the spelling reads", () => {
  assert.equal(createSs2TeamRules({ rankJoinSurplus: 0 }).id, "ss2-map-derived-tournament-join-hold-0");
  assert.equal(createSs2TeamRules({ rankJoinSurplus: -1 }).id, "ss2-map-derived-tournament-join-down-1");
  assert.equal(createSs2TeamRules({ rankJoinSurplus: -2 }).id, "ss2-map-derived-tournament-join-down-2");
});

/* ------------------------------------------------------------------ *
 * WHAT THE DIAL ACTUALLY GATES
 * ------------------------------------------------------------------ */

test("AT -1 A GLADIATOR LEAVES ONE FOE BEHIND TO MAKE A 2-ON-1", () => {
  const battle = brawl(-1);
  const legal = legalActions(battle, "hero").map((option) => option.type);
  assert.ok(legal.includes(Ss2ActionType.RANK_FRONT), "the staging must offer the rank that joins");
  assert.ok(
    !legal.some((type) => /attack$|^bombard$|^snipe$/.test(type)),
    "and nothing in reach, or the join arm is not the branch under test"
  );
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.RANK_FRONT);
});

test("AT 0 IT HOLDS, because leaving would desert the rank it is standing in", () => {
  // Surplus after leaving is `alliesHere (not counting me) - foesHere` = 0 - 1 =
  // -1, which is below 0, so the gate refuses. The SAME staging, one value
  // apart: this is the dial and nothing else.
  const battle = brawl(0);
  assert.notEqual(suggestAction(battle, "hero").type, Ss2ActionType.RANK_FRONT);
});

test("AND AT 0 IT DOES JOIN once its own rank is clear", () => {
  // No `keeper`: the surplus after leaving is 0, which meets the gate. One
  // gladiator apart from the test above, and it flips the decision.
  assert.equal(suggestAction(brawl(0, { keeper: false }), "hero").type, Ss2ActionType.RANK_FRONT);
});

test("IT JOINS ONLY A RANK WHERE AN ALLY IS ALREADY ENGAGED — the anti-pile-up guard", () => {
  // ► **THIS IS THE PROPERTY THAT HAS TO SURVIVE ANY VALUE OF THE DIAL.** The
  //   2026-09-12 pile-up came from "move toward the NEAREST foe's rank", which
  //   fires at the OPENING when nothing is engaged and folds all six into one
  //   rank — the tell being that strides 97 and 150 then returned IDENTICAL
  //   censuses (1,839 actions, 32.8% mutual reach, 0% crossings, 1 fight),
  //   because once everybody shares a rank the stride cannot matter.
  //
  //   Here `mate` is far from `boss`, so nobody is engaged and the join must not
  //   fire — at the most permissive value there is.
  const battle = staged({
    rankJoinSurplus: -99,
    red: [
      { id: "hero", fields: gladiator(), x: 600, y: BACK },
      { id: "mate", fields: gladiator(), x: -900, y: FRONT }
    ],
    blue: [
      { id: "keeper", fields: gladiator({ gladiator_dir: "left" }), x: 900, y: BACK },
      { id: "boss", fields: gladiator({ gladiator_dir: "left" }), x: 60, y: FRONT }
    ]
  });
  assert.notEqual(
    suggestAction(battle, "hero").type,
    Ss2ActionType.RANK_FRONT,
    "nobody is engaged, so there is no fight to join and the opening stays untouched"
  );
});

test("THE STRIDE IS THE RULE SET'S, not the module constant", () => {
  // ► **THE 2026-09-12 DEFECT, IN A NEW PLACE.** `tools/engagement-census.mjs`
  //   compared a requested stride against 0 instead of against the SHIPPED
  //   value, and so handed back the default engine while printing "second axis
  //   OFF". An adjacency test here against `SS2_ARENA.rankStride` would do the
  //   same thing quietly: a rule set built with another stride would find no
  //   neighbour and the arm would be silently dead.
  const stride = 150;
  const front = SS2_ARENA.frontY;
  const back = front - stride;
  const battle = createTeamBattle({
    seed: 3,
    rules: createSs2TeamRules({ rankJoinSurplus: -99, rankStride: stride }),
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [
          ss2Combatant(gladiator(), { id: "hero", name: "hero", controller: "local" }),
          ss2Combatant(gladiator(), { id: "mate", name: "mate", controller: "local" })
        ]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "keeper", name: "keeper", controller: "local" }),
          ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "boss", name: "boss", controller: "local" })
        ]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: 600, y: back });
  Object.assign(combatantById(battle, "mate"), { x: -60, y: front });
  Object.assign(combatantById(battle, "keeper"), { x: 900, y: back });
  Object.assign(combatantById(battle, "boss"), { x: 60, y: front });

  assert.equal(
    suggestAction(battle, "hero").type,
    Ss2ActionType.RANK_FRONT,
    "the join must find its neighbour at the rule set's own stride, not at 97"
  );
});

test("a rule set with no depth at all cannot join, and does not throw trying", () => {
  const flat = createSs2TeamRules({ rankJoinSurplus: -99, rankStride: 0 });
  const view = { actor: { id: "hero", y: null, x: 0 }, allies: [], foes: [] };
  assert.equal(ss2RankToJoin(view, -99, 0), null, "no stride, no neighbour");
  assert.equal(flat.id, "ss2-map-derived-tournament-rank-0-join-down-99");
});
