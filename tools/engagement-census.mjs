/**
 * Does a team battle look like a BATTLE, or like six people in a phone booth?
 *
 * ## Why this exists
 *
 * The owner watched a 3v3 in the browser arena on 2026-09-12 and said it was
 * "super limited" — that the fighters "always just jumble up in melee range and
 * fight there", with no room for a breakoff fight, no choice between duelling
 * and brawling, and nowhere to stand off and shoot. He was right, and the
 * numbers that show it had until now lived in throwaway scratch scripts that
 * died with the session that wrote them. **A number nobody can reproduce is not
 * evidence**, and every figure in that day's design discussion was one.
 *
 * So this is the instrument, committed. It answers four questions about a bout
 * that no test asserts, because none of them is a pass/fail — they are the
 * shape of the game.
 *
 * ## What it measures, and what each number means
 *
 * 1. **SPREAD** — how much of the arena a bout actually uses. The arena is
 *    `SS2_ARENA.clamp` wide (4,200 units) and melee reaches ~130. If a bout
 *    occupies 100 units, everyone is permanently inside everyone's reach and
 *    position cannot matter, whatever the geometry says.
 * 2. **MUTUAL REACH** — the share of turns on which the acting gladiator can hit
 *    EVERY living enemy. At 100% there are no tactics, only arithmetic: there is
 *    no such thing as choosing who to engage, because you are engaged with all
 *    of them.
 * 3. **BLOWS THROUGH A BODY** — the share of swings that pass through a living
 *    gladiator standing between attacker and target. This is what a
 *    one-dimensional arena costs, and no renderer setting can hide it once the
 *    drawing is honest. It is the argument for a second axis.
 * 4. **IDLE RESTS** — a gladiator resting with a melee verb on offer and healthy
 *    stamina. This should be ZERO. It was 4.6% of 3v3 actions until 2026-09-12,
 *    when `chooseAiAction` was picking the globally weakest foe and then
 *    resting if that one happened to be out of reach.
 * 5. **CROSSINGS** — turns on which anybody stands on the far side of an enemy.
 *    Zero means the two teams meet at ONE interface and every blow in the bout
 *    is struck there. See `anyCrossing`.
 * 6. **SIMULTANEOUS FIGHTS** — how many separate engagements exist at once.
 *    One means a breakoff fight is not unlikely but IMPOSSIBLE. See
 *    `simultaneousFights`. **This is the number the owner's brief is about**,
 *    and the one any second-axis work has to move.
 *
 * ## THE RESULT THAT DECIDED THE DESIGN, and it took two wrong guesses first
 *
 * A walk may never cross a FOE (`ss2WalkDestination`, the build's own clamp at
 * `+0x3de6`). It MAY cross an ally — nothing stops that — so the left-to-right
 * order of the six does reshuffle, measured, in 24 of 24 bouts. That was the
 * first wrong guess: the order is not frozen.
 *
 * The second guess was that better TARGETING would spread them out. It is a
 * no-op, measured: the AI's target picks only a DIRECTION, while where a walk
 * STOPS is the clamp against the nearest binding foe, so all three allies park
 * on one line whatever they are aiming at.
 *
 * What is actually true is stronger than either, and this is the number to keep
 * — **now counted by this tool rather than quoted at it** (metrics 5 and 6
 * below; until 2026-09-12 this block was prose and nothing computed it):
 *
 * ```text
 *   3v3, 24 bouts, 1,682 turns inspected
 *   turns where ANY red stood right of ANY blue ........ 0
 *   most SIMULTANEOUS separate fights ever seen ........ 1
 * ```
 *
 * **In one dimension the two teams meet at exactly ONE interface, and every
 * fight in the bout must happen there.** No red ever reaches the far side of a
 * blue, because to get there it would have to walk through one. So a breakoff
 * fight is not unlikely, it is GEOMETRICALLY IMPOSSIBLE — and no change to the
 * AI, the targeting or the spacing can produce a second engagement in a space
 * that has one contact point. That is what makes a second axis a prerequisite
 * rather than an improvement.
 *
 * ## Why it drives the ARENA'S OWN host
 *
 * Deliberately `createVanillaBattleHost` + `tools/arena/roster.js`'s `demoSide`,
 * not a hand-built battle. That is the path the browser arena actually uses, so
 * these numbers describe what a person sees rather than what a fixture does —
 * and it is the path on which a previous measurement went wrong by feeding
 * `demoSide`'s members straight to `createTeamBattle`, which skips the
 * vanilla-to-stats derivation and silently gives every fighter strength 5.
 *
 * REPORT ONLY. It writes nothing, mutates nothing and needs no licensed build:
 * everything here is this repository's own code. Run it before and after any
 * change to movement, targeting, reach or the AI.
 *
 *   node tools/engagement-census.mjs
 *   node tools/engagement-census.mjs --seeds 48 --guard 900
 *
 * Node builtins only.
 */
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { combatantById } from "../src/team/index.js";
import {
  ss2BattleValues, ss2Combatant, ss2TeamRules, createSs2TeamRules, SS2_ARENA,
  ss2FightDistance, ss2Reach, ss2PhysicalSize
} from "../src/team/ss2-rules.js";
import { demoSide } from "./arena/roster.js";

/**
 * How many SEPARATE fights are happening right now.
 *
 * ► **THIS AND `anyCrossing` BELOW ARE THE TWO NUMBERS THIS FILE'S OWN HEADER
 *   CALLS "the number to keep", AND UNTIL 2026-09-12 IT DID NOT COMPUTE
 *   EITHER.** They came from a scratch script that died with its session, and
 *   were quoted into the tool committed to stop exactly that — under a
 *   paragraph reading "a number nobody can reproduce is not evidence". Found
 *   twice independently on 2026-09-12, by the main session and by an agent
 *   asked a different question. The conclusion they support survives, because
 *   it is re-derivable from the code; the NUMBERS had no instrument.
 *
 * An EDGE joins two living gladiators on OPPOSITE sides who are inside reach.
 * `ss2Reach` is per-actor — this roster's three slots reach 130/129/129 — so
 * engagement is `distance < max(reachA, reachB)`: the UNION, not the
 * intersection, because a fighter who can be struck without striking back is
 * still in a fight.
 *
 * A FIGHT is a connected component of that graph CONTAINING AT LEAST ONE EDGE.
 * Counting components over every living body instead would report a gladiator
 * standing alone as a fight, and in a converged 3v3 that is the difference
 * between "one brawl" and "four fights".
 */
export function simultaneousFights(living) {
  const parent = new Map(living.map((combatant) => [combatant.id, combatant.id]));
  const find = (id) => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root);
    return root;
  };
  const engaged = new Set();
  for (let i = 0; i < living.length; i += 1) {
    for (let j = i + 1; j < living.length; j += 1) {
      const a = living[i];
      const b = living[j];
      if (a.teamId === b.teamId) continue;
      const distance = ss2FightDistance(a, b);
      if (distance === null) continue;
      if (distance >= Math.max(ss2Reach(a), ss2Reach(b))) continue;
      const rootA = find(a.id);
      const rootB = find(b.id);
      if (rootA !== rootB) parent.set(rootA, rootB);
      engaged.add(a.id);
      engaged.add(b.id);
    }
  }
  const roots = new Set();
  for (const id of engaged) roots.add(find(id));
  return roots.size;
}

/**
 * Is `body` standing in the line of a blow from `actor` to `target`?
 *
 * ► **THIS WAS A PURE X TEST UNTIL 2026-09-12, AND THE SECOND AXIS MADE IT
 *   LIE.** It asked only whether `body.x` fell between the two, so a gladiator
 *   standing in a DIFFERENT RANK counted as being in the way of a blow it was
 *   nowhere near. Measured at `rankStride` 150 it reported 91.4% of blows
 *   passing through a body — higher than the one-dimensional arena it exists
 *   to indict, and an artefact rather than a finding. A metric that cannot see
 *   the axis reports nonsense about it confidently.
 *
 * So: project the body onto the segment between attacker and target. It is in
 * the way when it falls BETWEEN them along that segment (`0 < t < 1`) and its
 * perpendicular distance from the line is less than its own `physical_size` —
 * which is what "in the way" already meant, since `physical_size` is the
 * body's own extent.
 *
 * **It reduces exactly to the old test when every gladiator is level**, which
 * is every bout with the second axis off: with all y equal the perpendicular
 * distance is 0 and `0 < t < 1` is precisely "strictly between in x". Verified
 * by the sweep — every metric is byte-identical with the axis off.
 */
function isInTheWay(actor, target, body) {
  const ay = Number.isFinite(actor.y) ? actor.y : 0;
  const ty = Number.isFinite(target.y) ? target.y : 0;
  const by = Number.isFinite(body.y) ? body.y : 0;
  const dx = target.x - actor.x;
  const dy = ty - ay;
  const lengthSquared = dx * dx + dy * dy;
  // Attacker and target on the same spot: nothing can be between them.
  if (lengthSquared === 0) return false;
  const t = ((body.x - actor.x) * dx + (by - ay) * dy) / lengthSquared;
  if (!(t > 0 && t < 1)) return false;
  const perpendicular = Math.abs((body.x - actor.x) * dy - (by - ay) * dx) / Math.sqrt(lengthSquared);
  return perpendicular < ss2PhysicalSize(body);
}

/**
 * Has anybody got PAST anybody?
 *
 * Team 0 starts at negative x and team 1 at positive (`startingPosition`), so a
 * member of team 0 standing to the RIGHT of any member of team 1 can only have
 * happened by crossing.
 *
 * **In one dimension this is 0 by construction** — `ss2WalkDestination` clamps
 * a walk at `defender._x -/+ physical_size(defender)` and its reversal guard
 * sends a crossing walk nowhere — and that is the whole argument for a second
 * axis. It is MEASURED here rather than asserted so the argument can be
 * checked, and so a change to the geometry is visible the moment it lands.
 */
export function anyCrossing(living, leftTeamId) {
  const left = living.filter((combatant) => combatant.teamId === leftTeamId);
  const right = living.filter((combatant) => combatant.teamId !== leftTeamId);
  return left.some((a) => right.some((b) => a.x > b.x));
}

const IS_ATTACK = /attack$/;

const CENSUS_FLAGS = Object.freeze({
  // `min` is the smallest ACCEPTED value, so a stride of 0 — the second axis
  // switched off — is a legal measurement and not an error.
  "--seeds": { key: "seeds", min: 1 },
  "--guard": { key: "guard", min: 1 },
  "--rank-stride": { key: "rankStride", min: 0 }
});

/**
 * ► **AN UNKNOWN FLAG NOW THROWS. It was silently ignored until 2026-09-12**,
 *   which is the worst failure mode an instrument can have: a mistyped
 *   `--rank-stride` would have run the sweep at the DEFAULT and printed a tidy
 *   table that reads as a measurement of something it never measured. This
 *   tool exists because numbers that describe nothing got quoted as evidence;
 *   a parser that answers a question nobody asked is the same defect wearing a
 *   command line.
 */
export function parseArguments(argv) {
  // ► **THE DEFAULT IS THE SHIPPED STRIDE, and it was 0 until 2026-09-13.**
  //   The selection logic below was fixed a session earlier to compare against
  //   `SS2_ARENA.rankStride` rather than against zero, which was right — but
  //   the DEFAULT was left at 0, so a bare `node tools/engagement-census.mjs`
  //   measured the one-dimensional engine while the handoff that shipped with
  //   it documented that exact command as "the shipped engine". **The
  //   instrument was honest (it prints "second axis OFF") and the instruction
  //   above it was wrong**, which is the harder of the two to notice: the
  //   header says one thing, the brief says another, and the table looks fine.
  //
  //   An instrument's default must be what SHIPS, or its headline numbers
  //   describe a configuration nobody plays. `--rank-stride 0` is still how you
  //   ask for the before-picture.
  const options = { seeds: 24, guard: 600, rankStride: SS2_ARENA.rankStride };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const spec = CENSUS_FLAGS[flag];
    if (!spec) {
      throw new Error(
        `Unknown flag ${JSON.stringify(flag)}. Known flags: ${Object.keys(CENSUS_FLAGS).join(", ")}.`
      );
    }
    const value = Number(argv[index + 1]);
    if (!Number.isFinite(value) || value < spec.min) {
      throw new Error(`${flag} needs a number >= ${spec.min}, not ${JSON.stringify(argv[index + 1])}.`);
    }
    options[spec.key] = value;
    index += 1;
  }
  return options;
}

/** One team size, swept over seeds. Every counter is accumulated across bouts. */
function census(perSide, { seeds, guard, rankStride }) {
  // ► **THIS READ `rankStride === 0` AND THAT BROKE THE MOMENT 97 BECAME THE
  //   DEFAULT (2026-09-12).** The singleton is the SHIPPED rule set, so asking
  //   for `--rank-stride 0` selected it and the tool reported the default
  //   engine while printing "second axis OFF" above the table. **The one
  //   instrument whose numbers justify this work answered a question nobody
  //   asked, confidently, for the length of one commit.**
  //
  //   Compare against the shipped value, not against zero: the singleton is
  //   correct only when the request IS the default.
  const rules = rankStride === SS2_ARENA.rankStride
    ? ss2TeamRules
    : createSs2TeamRules({ rankStride });
  const totals = {
    bouts: 0, settled: 0, actions: 0,
    blows: 0, through: 0,
    mutualTurns: 0, reachTurns: 0,
    idleRests: 0,
    spread: 0, widest: 0,
    crossingTurns: 0, mostFights: 0, multiFightTurns: 0
  };
  for (let seed = 1; seed <= seeds; seed += 1) {
    const host = createVanillaBattleHost({
      teams: [
        demoSide("red", perSide, { ss2Combatant, ss2BattleValues }),
        demoSide("blue", perSide, { ss2Combatant, ss2BattleValues })
      ],
      // The stride is what the second axis IS: 0 builds the module singleton's
      // own rule set, which is the one-dimensional engine exactly.
      rules,
      bindings: SS2_STATIC_MAP_BINDINGS,
      seed,
      awaitAnimations: true
    });
    host.constructArena();
    const ids = host.combatantIds();
    // Team 0 is the side `startingPosition` puts at negative x. Read off the
    // battle rather than hard-coded to "red", so a caller that swaps the
    // rosters gets a crossing count that still means what it says.
    const leftTeamId = host.battle.teams[0].id;
    totals.bouts += 1;
    let taken = 0;
    let tightest = Infinity;

    while (!host.battle.result && taken < guard) {
      taken += 1;
      const actorId = host.currentCombatantId();
      const options = host.legalActions(actorId);
      if (options.length === 0) break;
      const actor = combatantById(host.battle, actorId);
      const living = ids
        .map((id) => combatantById(host.battle, id))
        .filter((combatant) => combatant.alive && Number.isFinite(combatant.x));

      // (1) SPREAD: the narrowest the whole field ever gets, per bout. The
      // narrowest rather than the average, because that is the pile.
      if (living.length > 1) {
        const xs = living.map((combatant) => combatant.x);
        tightest = Math.min(tightest, Math.max(...xs) - Math.min(...xs));
      }

      // (5) CROSSINGS and (6) SIMULTANEOUS FIGHTS. Per TURN rather than per
      // bout, so the denominator is the same `actions` every other rate uses.
      if (anyCrossing(living, leftTeamId)) totals.crossingTurns += 1;
      const fights = simultaneousFights(living);
      if (fights > totals.mostFights) totals.mostFights = fights;
      if (fights >= 2) totals.multiFightTurns += 1;

      // (2) MUTUAL REACH: can this actor hit every living enemy right now?
      const foesAlive = living.filter((combatant) => combatant.teamId !== actor.teamId);
      const attackable = new Set(
        options.filter((option) => IS_ATTACK.test(option.type)).map((option) => option.targetId)
      );
      if (foesAlive.length > 0) {
        totals.reachTurns += 1;
        if (foesAlive.every((foe) => attackable.has(foe.id))) totals.mutualTurns += 1;
      }

      const chosen = host.suggestAction(actorId);

      // (4) IDLE REST: resting with a swing on offer and stamina to spend.
      if (
        chosen.type === "rest"
        && attackable.size > 0
        && actor.resources.staminaleft.value > 10
      ) {
        totals.idleRests += 1;
      }

      // (3) BLOWS THROUGH A BODY.
      if (IS_ATTACK.test(chosen.type)) {
        totals.blows += 1;
        const target = combatantById(host.battle, chosen.targetId);
        if (target && Number.isFinite(target.x)) {
          const interposed = living.some((combatant) =>
            combatant.id !== actor.id && combatant.id !== target.id
            && isInTheWay(actor, target, combatant));
          if (interposed) totals.through += 1;
        }
      }

      const step = host.submit({ actorId, ...chosen });
      for (const token of step.actionTokens) host.reportActionAnimation(token);
    }

    totals.actions += taken;
    if (host.battle.result) totals.settled += 1;
    if (Number.isFinite(tightest)) {
      totals.spread += tightest;
      totals.widest = Math.max(totals.widest, tightest);
    }
  }
  return totals;
}

function main(argv) {
  const options = parseArguments(argv);
  const arenaWidth = SS2_ARENA.clamp.max - SS2_ARENA.clamp.min;
  console.log(`engagement census — ${options.seeds} seeds a size, guard ${options.guard}`);
  console.log(`arena is ${arenaWidth} units wide; a bare-handed reach is about 130`);
  console.log(options.rankStride === 0
    ? "second axis OFF (rankStride 0) — this is the one-dimensional engine\n"
    : `second axis ON, rankStride ${options.rankStride} units between ranks` +
      `${options.rankStride === SS2_ARENA.rankStride ? " (the shipped default)" : ""}\n`);

  const rows = [];
  for (const perSide of [1, 2, 3]) {
    const totals = census(perSide, options);
    const pct = (part, whole) => (whole > 0 ? `${((100 * part) / whole).toFixed(1)}%` : "n/a");
    const tightest = totals.bouts > 0 ? Math.round(totals.spread / totals.bouts) : 0;
    rows.push({ perSide, totals, tightest });
    console.log(`${perSide}v${perSide}`);
    console.log(`  settled              ${totals.settled}/${totals.bouts}   actions ${totals.actions}`);
    console.log(`  tightest spread      ${tightest} units on average (${pct(tightest, arenaWidth)} of the arena)`);
    console.log(`  can hit EVERY foe    ${pct(totals.mutualTurns, totals.reachTurns)} of turns  (${totals.mutualTurns}/${totals.reachTurns})`);
    console.log(`  blows through a body ${pct(totals.through, totals.blows)}  (${totals.through}/${totals.blows})`);
    console.log(`  idle rests           ${totals.idleRests}  ${totals.idleRests === 0 ? "" : "<-- SHOULD BE ZERO"}`);
    // The two that decide whether a second engagement exists at all. In one
    // dimension both are pinned by the geometry: nobody may cross, so the two
    // teams meet at a single interface and there is never more than one fight.
    console.log(`  crossings            ${pct(totals.crossingTurns, totals.actions)} of turns  (${totals.crossingTurns}/${totals.actions})`);
    console.log(`  most fights at once  ${totals.mostFights}   (2 or more on ${totals.multiFightTurns} turns)`);
    console.log("");
  }

  // The vacuity guard: a sweep that fought nothing proves nothing, and would
  // otherwise print a tidy table of zeroes that reads like good news.
  const fought = rows.reduce((total, row) => total + row.totals.blows, 0);
  if (fought === 0) {
    console.log("PROBLEM: not one blow was thrown in the whole sweep. These numbers describe nothing.");
    return 1;
  }
  const idle = rows.reduce((total, row) => total + row.totals.idleRests, 0);
  if (idle > 0) {
    console.log(`PROBLEM: ${idle} idle rests. A gladiator holding a melee verb with stamina to spend must never rest.`);
    return 1;
  }
  return 0;
}

// Guarded so the two metric functions above can be imported and tested without
// running a 90-second sweep as a side effect. **This tool had no test at all
// until 2026-09-12** — the one artefact whose numbers justify the second axis
// was the one artefact nothing could catch being wrong. Same idiom as
// `tools/inspect-swf.mjs:1059` and `tools/capture-session.mjs:407`.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
