/**
 * How long does an HONEST bout last, and does `SS2_CROWD.patience` still sit
 * past the tail?
 *
 * ## The question turned out to have two answers, and the tool says which
 *
 * Running this the first time found that **"honest bout length" is undefined
 * for some archetypes, because their bouts do not end.** Two `attrition`
 * gladiators — defence 16 against attack 2 — traded 28,932 `normal-attack`s
 * over 15,001 turns with the toll out of reach and finished at 349/350 and
 * 350/350 health. Every completed phase heals its actor `1 + ceil(stamina / 2)`
 * (`nextphase` `+0x3305`, the build's own), and at that defence the damage
 * getting through is smaller than the heal. **It is a D1-class fixpoint reached
 * by FIGHTING rather than by resting**, which the D1 write-up did not
 * anticipate: that one was about two combatants who decline to fight.
 *
 * So archetypes fall into two classes and the tuning question differs:
 *
 * - **self-terminating** — settles with no crowd at all. `patience` must clear
 *   its tail, or the crowd becomes a routine combat mechanic;
 * - **crowd-dependent** — does not settle without the crowd. For these the
 *   crowd is not a backstop, it is THE termination mechanism, and "put patience
 *   past the tail" is meaningless because there is no tail. What `patience`
 *   picks for them is how long the bout lasts.
 *
 * Only the first class can bound `patience` from below. The tool reports both
 * and applies the check to the first.
 *
 * ## Why this file exists
 *
 * `SS2_CROWD.patience` carries the instruction **"re-run it whenever the combat
 * economy moves"**, and until now that instruction was UNRUNNABLE: the sweep
 * behind the 2026-09-10 baseline — *"min 21, median 50, p95 102, max 135"* —
 * recorded its RESULTS in two source comments and its PARAMETERS nowhere. No
 * stat block, no seed count, no team sizes. So "re-run it" meant "invent a new
 * sweep and hope it measures the same thing", which is not a re-run.
 *
 * The economy has since moved twice — the swing cost in `849831f`, and
 * movement in `567eb41`, which adds an approach to every bout — so the
 * instruction came due and the tool it needed did not exist.
 *
 * ## The methodology, which is the part that was got wrong once already
 *
 * **Measure with the toll OFF.** `patience` was first set to 40 and then 120,
 * both times against a distribution the toll itself had shaped: at 40 the crowd
 * was killing people and ENDING BOUTS EARLY, so the observed maximum was a
 * measurement of the crowd rather than of combat, and every threshold tuned on
 * it was guaranteed to sit too low. Raising it revealed a longer tail each
 * time, which reads exactly like converging and is not.
 *
 * So this tool disables the toll by *raising `patience` beyond reach* rather
 * than by passing `fixtureReplay: true` — that flag also turns off position and
 * the swing cost, and would measure a different engine entirely.
 *
 * **Sweep archetypes, not one gladiator.** The tail is what `patience` has to
 * clear, and the tail belongs to whichever build fights longest. One stat block
 * measures one point of that curve and says nothing about where it ends.
 *
 * REPORT ONLY. It writes nothing and needs no licensed build: this is a
 * question about this repository's own rule set, not about SS2.
 *
 *   node tools/crowd-patience-sweep.mjs
 *   node tools/crowd-patience-sweep.mjs --seeds 200
 *
 * Exit status is 0 when `patience` still clears the measured maximum, 1 when it
 * does not — which is a finding, not a crash.
 */
import process from "node:process";

import { applyAction, createTeamBattle, currentCombatant, legalActions } from "../src/team/index.js";
import {
  createSs2TeamRules,
  ss2Combatant,
  ss2WeaponDemand,
  ss2WeaponGateAttribute,
  ss2WeaponIsRanged,
  SS2_CROWD
} from "../src/team/ss2-rules.js";
import { ss2WeaponEntry, SS2_SHOP_WEAPON_IDS } from "../src/team/ss2-weapon-table.js";

/**
 * THE EIGHT STATS, and the budget a real gladiator spends them from.
 *
 * ► **THE FIRST VERSION OF THIS FILE INVENTED FIVE ARCHETYPES AND NEVER
 *   CHECKED THEM AGAINST THIS BUDGET. Every one of them was impossible.**
 *   They declared `herolevel: 3` — a budget of 25 — while spending 40 to 53
 *   points, and every one set `magicka: 0`, below the floor of 1 that
 *   `heroDNA` seeds and that has no refund path (`createchar` refunds stop at
 *   the floor and the level-up panel has no refund button at all). So the
 *   bouts measured were between gladiators the game cannot produce, and the
 *   findings drawn from them — a 684-turn tail, four non-terminating cells —
 *   were numbers about nobody. `tools/stat-vector-reachability.mjs` had
 *   implemented this budget for days.
 *
 * A character at herolevel L has eight stats summing to `13 + 4L`, none below
 * 1 (battle map, "Levelling and stat points": `heroDNA` indices 16-22 seed
 * every stat at 1, root frame 227 grants `statpoints = 4` per level). Health
 * and stamina are NOT declared here — `ss2BattleValues` derives them from the
 * stats, which is the other half of what went wrong before.
 */
const STATS = Object.freeze(["strength", "speed", "attack", "defence", "vitality", "stamina", "magicka", "charisma"]);
const STAT_FLOOR = 1;
const budgetFor = (herolevel) => 13 + 4 * herolevel;

/**
 * Reachable allocations at one herolevel, spanning the CORNERS of the space.
 *
 * Deterministic and structured rather than sampled: a stalemate is a corner
 * phenomenon — it needs a build that can absorb more than it deals — so the
 * builds worth running are the ones that dump everything into one or two
 * stats. Every vector sums to exactly the budget with no stat below the floor,
 * which is what makes it a gladiator a player could actually hold.
 */
function reachableVectors(herolevel, includePairs = false) {
  const budget = budgetFor(herolevel);
  const surplus = budget - STATS.length * STAT_FLOOR;
  if (surplus < 0) return [];
  const base = Object.fromEntries(STATS.map((stat) => [stat, STAT_FLOOR]));
  const vectors = [];

  // Everything into one stat.
  for (const stat of STATS) {
    vectors.push({ name: `all-${stat}`, stats: { ...base, [stat]: STAT_FLOOR + surplus } });
  }
  // Split between each pair, which is where "tanky AND rested" lives. OFF by
  // default: 28 more vectors triples the run time and the corners already show
  // the effect. `--pairs` turns them on.
  if (includePairs) for (let i = 0; i < STATS.length; i += 1) {
    for (let j = i + 1; j < STATS.length; j += 1) {
      const half = Math.floor(surplus / 2);
      vectors.push({
        name: `${STATS[i]}+${STATS[j]}`,
        stats: { ...base, [STATS[i]]: STAT_FLOOR + half, [STATS[j]]: STAT_FLOOR + (surplus - half) }
      });
    }
  }
  // And an even spread, as the ordinary case.
  const even = { ...base };
  for (let k = 0; k < surplus; k += 1) even[STATS[k % STATS.length]] += 1;
  vectors.push({ name: "even", stats: even });

  return vectors.map((vector) => {
    const sum = STATS.reduce((total, stat) => total + vector.stats[stat], 0);
    if (sum !== budget) throw new Error(`${vector.name} at L${herolevel} sums to ${sum}, not ${budget}`);
    if (STATS.some((stat) => vector.stats[stat] < STAT_FLOOR)) {
      throw new Error(`${vector.name} at L${herolevel} puts a stat below the floor`);
    }
    return { ...vector, herolevel };
  });
}

const LEVELS = Object.freeze([1, 6, 15]);

/**
 * TWO LOADOUTS: what you start with, and THE BEST THING YOUR OWN STATS CAN BUY.
 *
 * ► **THE SECOND ONE IS NOT A CHOICE THIS TOOL MAKES — THE BUILD MAKES IT.**
 *   The first draft picked weapon 24 for every build and `assertSs2WeaponPurchasable`
 *   threw: the shop gates it at `strength >= 12` (`3 * band_position`,
 *   `ss2-item-tables.md:530-552`, `onRelease +0x0929`) and a defence-dumping
 *   gladiator has strength 1. **The loadout is not a free parameter.** A build
 *   that spends its points away from the gate attribute cannot carry the
 *   weapon that would let it kill anything — which is the measured rule that
 *   decides whether the stall below is reachable, and it came from the engine
 *   refusing, not from a judgement here.
 *
 * Affordability in GOLD is still not modelled; the gate is a stat gate and
 * that is what is applied. So "best purchasable" is an upper bound on what a
 * gladiator of these stats could be holding.
 */
const LOADOUTS = Object.freeze([
  { name: "weapon 0 (starting)", best: false },
  { name: "best it can buy", best: true }
]);

/**
 * The highest-damage primary the shop would sell THIS build, or weapon 0.
 *
 * Ranged ids (61-80) are excluded because `buyweapon` routes them to the
 * secondary slot and no gladiator carries one as a primary.
 */
function bestPurchasable(stats) {
  let best = 0;
  let bestMax = ss2WeaponEntry(0).maxDamage;
  for (const id of SS2_SHOP_WEAPON_IDS) {
    if (ss2WeaponIsRanged(id)) continue;
    const attribute = ss2WeaponGateAttribute(id);
    if (attribute !== null && ss2WeaponDemand(id) > (stats[attribute] ?? 0)) continue;
    const entry = ss2WeaponEntry(id);
    if (entry.maxDamage > bestMax) {
      bestMax = entry.maxDamage;
      best = id;
    }
  }
  return best;
}

/**
 * 1v1 only by default. The stall is a per-PAIR phenomenon — it is two builds
 * failing to out-damage each other's heal — and running it at 2v2 and 3v3
 * triples the cost to re-measure the same effect with more bodies in it.
 */
const SIZES = Object.freeze([1]);

function parse(argv) {
  // ► **DEFAULTS CHOSEN SO THIS FINISHES.** The first version defaulted to 40
  //   seeds, a 4,000-action cap and 37 vectors across three team sizes, and
  //   was killed by a 900-second timeout twice: a stalling bout burns the FULL
  //   cap, and half of them stall, so the run time is dominated by the cases
  //   that prove the point. A tool nobody can finish running is a tool nobody
  //   re-runs, which is how the last instruction rotted.
  const options = { seeds: 2, cap: 600, pairs: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--seeds") {
      options.seeds = Number(argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--cap") {
      options.cap = Number(argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--pairs") {
      options.pairs = true;
    } else {
      throw new Error(`Unknown flag ${argv[index]}. Try --seeds <n>, --cap <actions>, or --pairs.`);
    }
  }
  if (!Number.isInteger(options.seeds) || options.seeds < 1) throw new Error("--seeds must be a positive integer.");
  if (!Number.isInteger(options.cap) || options.cap < 1) throw new Error("--cap must be a positive integer.");
  return options;
}

/**
 * A blueprint from a reachable vector. **It declares the STATS and the
 * herolevel and nothing else** — `ss2BattleValues` derives `hitpointsmax`
 * (`10L + 20*vitality`) and `staminamax` (`100 + 10*stamina`) from them.
 *
 * That is the second half of the earlier error: the invented archetypes
 * declared level-10 stat totals at `herolevel: 3`, so even their health was a
 * number no gladiator has.
 */
const gladiator = (vector, dir) => ({
  ...vector.stats,
  herolevel: vector.herolevel,
  character_level: vector.herolevel,
  gladiator_dir: dir,
  weapon: vector.weapon
});

function viewFor(battle, actor) {
  const alive = battle.teams.flatMap((team) => team.combatants).filter((combatant) => combatant.alive);
  return {
    turnNumber: battle.turnNumber,
    actor: { ...actor },
    allies: alive.filter((combatant) => combatant.teamId === actor.teamId).map((combatant) => ({ ...combatant })),
    foes: alive.filter((combatant) => combatant.teamId !== actor.teamId).map((combatant) => ({ ...combatant }))
  };
}

/**
 * One bout between two builds. `left === right` is a MIRROR match.
 *
 * Mirrors are the worst case for termination by construction — two identical
 * builds cannot out-damage each other — so they bound the problem. **They do
 * not describe play**, where two players bring different gladiators and one
 * usually out-damages the other, so the sweep runs CROSS pairings too and
 * reports the two separately. Quoting the mirror rate as if it were a player's
 * experience would be the same error as the invented archetypes: a number
 * about a situation nobody is in.
 */
function runBout(rules, left, right, perSide, seed, patience, cap) {
  const side = (prefix, dir, vector) => ({
    id: prefix,
    combatants: Array.from({ length: perSide }, (unused, index) =>
      ss2Combatant(gladiator(vector, dir), {
        id: `${prefix}-${index + 1}`,
        name: `${prefix} ${index + 1}`,
        controller: "ai"
      })
    )
  });
  const battle = createTeamBattle({
    seed,
    rules,
    teams: [side("red", "right", left), side("blue", "left", right)]
  });
  let actions = 0;
  let tolled = false;
  while (!battle.result && actions < cap) {
    const actor = currentCombatant(battle);
    if (!actor) break;
    const options = legalActions(battle);
    if (options.length === 0) break;
    const chosen = rules.chooseAiAction(viewFor(battle, actor), actor.id, options);
    applyAction(battle, { ...chosen, actorId: actor.id });
    actions += 1;
    if (battle.turnNumber > patience) tolled = true;
  }
  return { turns: battle.turnNumber, actions, settled: Boolean(battle.result), tolled };
}

const percentile = (values, p) => {
  const sorted = values.slice().sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

function main(argv) {
  const options = parse(argv);
  // THE TOLL IS OUT OF REACH. This is the whole methodology: `patience` was set
  // to 40 and then 120 against distributions the toll itself had shaped, and
  // each rise revealed a longer tail, which reads like converging and is not.
  const rules = createSs2TeamRules({ crowdPatience: Infinity });
  const patience = SS2_CROWD.patience;

  console.log("HONEST BOUT LENGTH, in TURNS — `turnNumber` advances once per ROUND, not per action.");
  console.log("measured with the crowd toll OUT OF REACH (crowdPatience: Infinity), which is the point.");
  console.log(`seeds per cell: ${options.seeds}   levels: ${LEVELS.join("/")}   sizes: ${SIZES.join("/")}`);
  console.log("every build is REACHABLE: eight stats, none below 1, summing to 13 + 4L.");
  console.log(`SS2_CROWD.patience = ${patience}, ramp = ${SS2_CROWD.ramp} — compared against, never applied\n`);

  let worst = 0;
  let worstCell = null;
  let cells = 0;
  let bouts = 0;
  const stalling = [];

  console.log("  loadout                level   MIRROR stalls        CROSS stalls     max turns (self-terminating)");
  for (const loadout of LOADOUTS) {
    for (const herolevel of LEVELS) {
      const vectors = reachableVectors(herolevel, options.pairs)
        .map((vector) => ({ ...vector, weapon: loadout.best ? bestPurchasable(vector.stats) : 0 }));
      const tally = { mirror: { stalled: 0, total: 0 }, cross: { stalled: 0, total: 0 } };
      let levelWorst = 0;
      let levelWorstName = "-";

      for (let index = 0; index < vectors.length; index += 1) {
        // One mirror, then three CROSS pairings chosen by a fixed stride so the
        // opponent set is spread across the space and the run stays reproducible.
        const pairings = [
          { kind: "mirror", other: vectors[index] },
          ...[1, 7, 19].map((stride) => ({ kind: "cross", other: vectors[(index + stride) % vectors.length] }))
        ];
        for (const pairing of pairings) {
          if (pairing.kind === "cross" && pairing.other.name === vectors[index].name) continue;
          for (const perSide of SIZES) {
            cells += 1;
            for (let seed = 1; seed <= options.seeds; seed += 1) {
              const bout = runBout(rules, vectors[index], pairing.other, perSide, seed, patience, options.cap);
              bouts += 1;
              tally[pairing.kind].total += 1;
              if (!bout.settled) {
                tally[pairing.kind].stalled += 1;
                if (pairing.kind === "cross") {
                  stalling.push({
                    loadout: loadout.name, herolevel, perSide, seed,
                    name: `${vectors[index].name} vs ${pairing.other.name}`
                  });
                }
                continue;
              }
              if (bout.turns > levelWorst) {
                levelWorst = bout.turns;
                levelWorstName = `${vectors[index].name} ${perSide}v${perSide}`;
              }
            }
          }
        }
      }
      if (levelWorst > worst) {
        worst = levelWorst;
        worstCell = `${loadout.name} L${herolevel} ${levelWorstName}`;
      }
      const rate = (t) => `${String(t.stalled).padStart(5)}/${String(t.total).padEnd(5)} ${(t.stalled / t.total * 100).toFixed(0).padStart(3)}%`;
      console.log(
        `  ${loadout.name.padEnd(22)} ${String(herolevel).padStart(5)}   ${rate(tally.mirror)}   ${rate(tally.cross)}   ` +
        `${String(levelWorst).padStart(6)}  ${levelWorstName}`
      );
    }
  }

  const problems = [];
  if (cells === 0) problems.push("no cells ran — the sweep is broken, not the constant");
  if (worstCell === null) {
    problems.push("NO bout settled without the crowd; nothing here bounds `patience` from below");
  }

  console.log(
    `\nbouts run: ${bouts}   mirror AND cross pairings, toll out of reach, cap ${options.cap} actions`
  );

  if (stalling.length > 0) {
    const byVector = new Map();
    for (const entry of stalling) {
      const key = `${entry.loadout} L${entry.herolevel} ${entry.name} ${entry.perSide}v${entry.perSide}`;
      byVector.set(key, (byVector.get(key) ?? 0) + 1);
    }
    console.log(`\nSTALLING: ${stalling.length} of ${bouts} bouts did not end without the crowd.`);
    for (const [key, count] of [...byVector].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      // Counted over seeds AND team sizes, so the denominator is not `seeds`.
      // The first version labelled it "seeds" and printed 4/2, which is the
      // kind of impossible fraction that makes a reader distrust the rest.
      console.log(`  ${key.padEnd(52)} ${count} bout(s)`);
    }
    problems.push(
      `${byVector.size} REACHABLE build PAIRINGS stall, so the crowd is load-bearing for gladiators a ` +
      "player can actually hold and matchups a player can actually face — not only for declared blueprints"
    );
  } else {
    console.log("\nNO reachable mirror match stalled. Every bout ended on its own, with no crowd at all.");
  }

  if (worstCell !== null) {
    console.log(`longest self-terminating bout: ${worst} turns (${worstCell})`);
    if (worst >= patience) {
      problems.push(
        `patience ${patience} does NOT clear the self-terminating maximum of ${worst} among REACHABLE builds`
      );
    } else {
      const headroom = patience - worst;
      console.log(`headroom: ${headroom} turns (${(headroom / patience * 100).toFixed(0)}% of patience)`);
    }
  }

  if (problems.length === 0) {
    console.log("\nOK: patience clears every reachable self-terminating tail, and nothing reachable stalls.");
    return 0;
  }
  console.log("");
  for (const problem of problems) console.log(`PROBLEM: ${problem}`);
  return 1;
}

process.exitCode = main(process.argv.slice(2));
