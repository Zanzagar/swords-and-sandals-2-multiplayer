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
import { createSs2TeamRules, ss2Combatant, SS2_CROWD } from "../src/team/ss2-rules.js";

/**
 * The stat blocks the sweep runs, chosen to span what changes bout LENGTH
 * rather than to be realistic. Each names what it is for, because an archetype
 * nobody can justify is a number nobody can re-derive.
 */
const ARCHETYPES = Object.freeze([
  {
    name: "baseline",
    note: "the ordinary demo gladiator the rest of the suite uses",
    stats: { strength: 9, speed: 5, attack: 9, defence: 5, vitality: 5, stamina: 4 }
  },
  {
    name: "glass",
    note: "dies fast — the SHORT end, which bounds nothing but proves the sweep spans a range",
    stats: { strength: 12, speed: 7, attack: 14, defence: 1, vitality: 1, stamina: 3 }
  },
  {
    name: "tank",
    note: "high vitality AND defence: the long end, and the one `patience` actually has to clear",
    stats: { strength: 6, speed: 3, attack: 4, defence: 14, vitality: 14, stamina: 8 }
  },
  {
    name: "stamina-hoarder",
    note: "the D2 exploit shape — low strength, high stamina — which the swing cost was repriced to answer",
    stats: { strength: 1, speed: 9, attack: 10, defence: 8, vitality: 10, stamina: 12 }
  },
  {
    name: "attrition",
    note: "two tanks that can barely hurt each other: the worst honest case short of a standoff",
    stats: { strength: 2, speed: 2, attack: 2, defence: 16, vitality: 16, stamina: 10 }
  }
]);

const SIZES = Object.freeze([1, 2, 3]);

function parse(argv) {
  const options = { seeds: 40, cap: 4000 };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--seeds") {
      options.seeds = Number(argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--cap") {
      options.cap = Number(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown flag ${argv[index]}. Try --seeds <n> or --cap <actions>.`);
    }
  }
  if (!Number.isInteger(options.seeds) || options.seeds < 1) throw new Error("--seeds must be a positive integer.");
  if (!Number.isInteger(options.cap) || options.cap < 1) throw new Error("--cap must be a positive integer.");
  return options;
}

const gladiator = (stats) => ({
  ...stats,
  magicka: 0,
  charisma: 3,
  herolevel: 3,
  character_level: 3,
  weapon_min_damage: 3,
  weapon_max_damage: 9
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

function runBout(rules, stats, perSide, seed, patience, cap) {
  const side = (prefix, dir) => ({
    id: prefix,
    combatants: Array.from({ length: perSide }, (unused, index) =>
      ss2Combatant(gladiator({ ...stats, speed: stats.speed + index, gladiator_dir: dir }), {
        id: `${prefix}-${index + 1}`,
        name: `${prefix} ${index + 1}`,
        controller: "ai"
      })
    )
  });
  const battle = createTeamBattle({
    seed,
    rules,
    teams: [side("red", "right"), side("blue", "left")]
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
  console.log(`seeds per cell: ${options.seeds}   archetypes: ${ARCHETYPES.length}   sizes: ${SIZES.join("/")}`);
  console.log(`SS2_CROWD.patience = ${patience}, ramp = ${SS2_CROWD.ramp} — compared against, never applied\n`);

  let worst = 0;
  let worstCell = null;
  let cells = 0;
  const crowdDependent = [];

  console.log("  archetype         size   min  median   p95   max   actions(med)  settled  class");
  for (const archetype of ARCHETYPES) {
    for (const perSide of SIZES) {
      const turns = [];
      const actions = [];
      let settled = 0;
      for (let seed = 1; seed <= options.seeds; seed += 1) {
        const bout = runBout(rules, archetype.stats, perSide, seed, patience, options.cap);
        turns.push(bout.turns);
        actions.push(bout.actions);
        if (bout.settled) settled += 1;
      }
      cells += 1;
      const cell = `${archetype.name} ${perSide}v${perSide}`;
      // A cell is CROWD-DEPENDENT the moment one bout fails to settle without
      // the toll. It is deliberately not "most of them": one non-terminating
      // bout is a bout a player can be stuck in.
      const selfTerminating = settled === options.seeds;
      if (!selfTerminating) crowdDependent.push({ cell, settled, of: options.seeds });
      const max = Math.max(...turns);
      // ONLY a self-terminating cell can bound `patience` from below. Taking
      // the max over a capped, non-terminating cell would measure the cap.
      if (selfTerminating && max > worst) {
        worst = max;
        worstCell = cell;
      }
      console.log(
        `  ${archetype.name.padEnd(16)} ${perSide}v${perSide}   ` +
        `${String(Math.min(...turns)).padStart(4)} ${String(percentile(turns, 0.5)).padStart(7)} ` +
        `${String(percentile(turns, 0.95)).padStart(5)} ${String(max).padStart(5)} ` +
        `${String(percentile(actions, 0.5)).padStart(13)} ` +
        `${String(settled).padStart(8)}  ${selfTerminating ? "self-terminating" : "CROWD-DEPENDENT"}`
      );
    }
  }

  console.log("\n  " + ARCHETYPES.map((a) => `${a.name}: ${a.note}`).join("\n  "));

  const problems = [];
  // Vacuity guard: a sweep that ran nothing agrees with everything.
  if (cells === 0) problems.push("no cells ran — the sweep is broken, not the constant");
  if (worstCell === null) {
    problems.push(
      "NO cell settled without the crowd, so nothing here bounds `patience` from below and this run " +
      "cannot tune it. That is a finding about the economy, not about the sweep."
    );
  }

  if (crowdDependent.length > 0) {
    console.log(
      `\ncrowd-dependent cells: ${crowdDependent.length} of ${cells}. Without the toll these do not end ` +
      `within ${options.cap} actions — so for them the crowd is not a backstop, it is what ENDS the bout, ` +
      "and `patience` is choosing their length rather than catching their tail."
    );
    for (const entry of crowdDependent) {
      console.log(`  ${entry.cell.padEnd(24)} settled ${entry.settled}/${entry.of} without the crowd`);
    }
    console.log(
      "  (A capped bout is evidence of non-termination, not proof: raise --cap to push on it. " +
      "One probe ran attrition 1v1 to 30,000 actions and 15,001 turns, ending at 349/350 health.)"
    );
  }

  if (worstCell !== null) {
    console.log(`\nlongest SELF-TERMINATING bout: ${worst} turns (${worstCell})`);
    if (worst >= patience) {
      problems.push(
        `patience ${patience} does NOT clear the self-terminating maximum of ${worst}: the crowd would be ` +
        "a routine combat mechanic for builds that end their own fights, which is what it must not be"
      );
    } else {
      const headroom = patience - worst;
      console.log(`headroom: ${headroom} turns (${(headroom / patience * 100).toFixed(0)}% of patience)`);
    }
  }

  if (problems.length === 0) {
    console.log("\nOK: patience still clears every self-terminating tail.");
    return 0;
  }
  console.log("");
  for (const problem of problems) console.log(`PROBLEM: ${problem}`);
  return 1;
}

process.exitCode = main(process.argv.slice(2));
