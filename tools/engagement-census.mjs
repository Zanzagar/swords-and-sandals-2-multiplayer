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
 * What is actually true is stronger than either, and this is the number to keep:
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

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { combatantById } from "../src/team/index.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules, SS2_ARENA } from "../src/team/ss2-rules.js";
import { demoSide } from "./arena/roster.js";

const IS_ATTACK = /attack$/;

function parseArguments(argv) {
  const options = { seeds: 24, guard: 600 };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag !== "--seeds" && flag !== "--guard") continue;
    const value = Number(argv[index + 1]);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${flag} needs a positive number, not ${JSON.stringify(argv[index + 1])}.`);
    }
    options[flag.slice(2)] = value;
    index += 1;
  }
  return options;
}

/** One team size, swept over seeds. Every counter is accumulated across bouts. */
function census(perSide, { seeds, guard }) {
  const totals = {
    bouts: 0, settled: 0, actions: 0,
    blows: 0, through: 0,
    mutualTurns: 0, reachTurns: 0,
    idleRests: 0,
    spread: 0, widest: 0
  };
  for (let seed = 1; seed <= seeds; seed += 1) {
    const host = createVanillaBattleHost({
      teams: [
        demoSide("red", perSide, { ss2Combatant, ss2BattleValues }),
        demoSide("blue", perSide, { ss2Combatant, ss2BattleValues })
      ],
      rules: ss2TeamRules,
      bindings: SS2_STATIC_MAP_BINDINGS,
      seed,
      awaitAnimations: true
    });
    host.constructArena();
    const ids = host.combatantIds();
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
          const low = Math.min(actor.x, target.x);
          const high = Math.max(actor.x, target.x);
          const interposed = living.some((combatant) =>
            combatant.id !== actor.id && combatant.id !== target.id
            && combatant.x > low && combatant.x < high);
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
  console.log(`arena is ${arenaWidth} units wide; a bare-handed reach is about 130\n`);

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

process.exitCode = main(process.argv.slice(2));
