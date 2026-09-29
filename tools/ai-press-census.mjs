/**
 * How does the AI use a numbers advantage? The instrument behind the owner's
 * decision P2 (`docs/design/battle-ui.md#decided-ai-press-2026-09-27`).
 *
 * The owner, after playtesting (2026-09-26): *"the ai on the team of 2 never
 * makes a concerted effort to corner the single gladiator oftentimes it just
 * dances or waits for the 1v1 to finish"*. He asked for evidence, not a
 * preference, on how the free member should close — so the table in that
 * decision is this tool's output, and a reader can run it again.
 *
 * ## What it measures
 *
 * Every bout runs on the path the browser arena uses (`createVanillaBattleHost`
 * with `demoSide`, or the build's champions from the player's own extracted
 * pack), each turn the acting side's policy choosing. Per `aiPress` policy
 * (`off`, `ranged-first`, `pincer-first`):
 *
 * - **converted** — 2v1 phases the pair ends with both members alive;
 * - **medianTurnsToKill** — the pair's own turns in those phases;
 * - **pairIdle / pairCrowd** — the free member's turns spent on a
 *   crowd-pleaser, a rest or a taunt / on the crowd-pleaser alone;
 * - **bothEngaged** — turns with both pair members in reach of the lone foe,
 *   in his lane;
 * - **pincer** — turns with the pair on both sides of him;
 * - **backAttackShare** — the pair's blows that land from behind;
 * - **stuckWalks** — AI walks that went nowhere (the other playtest defect);
 * - **unsettled / meanTurns / redWins / blueWins** — whether anything stalls,
 *   and the balance between the sides.
 *
 * `h2h` plays the two P2 variants against each other instead, each side a
 * different policy, both colour assignments, and reports the wins.
 *
 * ## Running it
 *
 *   node tools/ai-press-census.mjs <kit> <perSide> <seeds> [h2h]
 *
 * `kit` is a demo kit name (`plain` for none, `buffs`, `tricks`, `crowd`, ...)
 * or `champ` for the build's champions (needs `assets/champions/`, which
 * `node tools/extract-champions.mjs` writes from your own copy; which_boss 17
 * is skipped, as it mirrors the hero). The decision's table is
 * `plain 2|3`, `buffs 2|3`, `tricks 3`, `crowd 3`, `champ 2|3`, 96 seeds each.
 * Output is one JSON line per policy.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { citationFor } from "../src/adapter/vanilla-fields.js";
import { combatantById } from "../src/team/index.js";
import {
  createSs2TeamRules, SS2_AI_PRESS, ss2BattleValues, ss2Combatant,
  ss2FightDistance, ss2IsBackAttack, ss2Reach, ss2SameLane
} from "../src/team/ss2-rules.js";
import { championSide, demoItemsFrom, demoSide } from "./arena/roster.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ATTACK = /attack|snipe|bombard|bash/;
const IDLE = new Set(["wincrowd", "rest", "taunt"]);
const GUARD = 900;

function rosterFor(kit, perSide) {
  const deps = { ss2Combatant, ss2BattleValues };
  if (kit !== "champ") {
    const items = kit === "plain" ? [] : demoItemsFrom(kit);
    return (seed) => ["red", "blue"].map((side) => demoSide(side, perSide, { ...deps, items, seed }));
  }
  const file = path.join(ROOT, "assets/champions/champions.json");
  if (!fs.existsSync(file)) {
    throw new Error("champ needs assets/champions/champions.json: run node tools/extract-champions.mjs against your own copy.");
  }
  const pack = JSON.parse(fs.readFileSync(file, "utf8"));
  const bosses = pack.champions.filter((one) => one.dnaFrom !== "hero" && one.whichBoss !== 17).map((one) => one.whichBoss);
  const pick = (seed, k) => Array.from({ length: perSide }, (unused, i) => bosses[(seed * 7 + k * 5 + i * 3) % bosses.length]);
  return (seed) => [
    championSide("red", pick(seed, 0), { ...deps, pack, admitResource: citationFor }),
    championSide("blue", pick(seed, 1), { ...deps, pack, admitResource: citationFor })
  ];
}

/** One sweep of `seeds` bouts; `policyFor(teamId)` is the rule set that side chooses with. */
export function census({ roster, seeds, policyFor }) {
  const t = {
    bouts: 0, settled: 0, turns: 0, redWins: 0, blueWins: 0, stuck: 0,
    phases: 0, converted: 0, pairTurns: 0, pairIdle: 0, pairCrowd: 0,
    bothEngaged: 0, phaseTurns: 0, pincer: 0, killTurns: [], backAttacks: 0, pairAttacks: 0
  };
  for (let seed = 1; seed <= seeds; seed += 1) {
    const red = policyFor("red");
    const blue = policyFor("blue");
    const host = createVanillaBattleHost({
      teams: roster(seed), rules: red, bindings: SS2_STATIC_MAP_BINDINGS, seed, awaitAnimations: true
    });
    host.constructArena();
    const ids = host.combatantIds();
    t.bouts += 1;
    let taken = 0;
    let inPhase = false;
    let pairTeam = null;
    let pairTurnsThisPhase = 0;
    while (!host.battle.result && taken < GUARD) {
      taken += 1;
      const actorId = host.currentCombatantId();
      if (host.legalActions(actorId).length === 0) break;
      const actor = combatantById(host.battle, actorId);
      const living = ids.map((id) => combatantById(host.battle, id)).filter((one) => one.alive);
      const byTeam = {};
      for (const one of living) (byTeam[one.teamId] ??= []).push(one);
      const counts = Object.values(byTeam).map((list) => list.length).sort();
      const twoOnOne = counts.length === 2 && counts[0] === 1 && counts[1] === 2;
      if (twoOnOne && !inPhase) {
        inPhase = true;
        t.phases += 1;
        pairTeam = Object.keys(byTeam).find((team) => byTeam[team].length === 2);
        pairTurnsThisPhase = 0;
      }
      // The acting side's policy chooses; the battle's own rule set resolves.
      // Only the suggestion swaps rule sets, and every policy resolves alike.
      const own = host.battle.rules;
      host.battle.rules = actor.teamId === "blue" ? blue : red;
      const chosen = host.suggestAction(actorId);
      host.battle.rules = own;
      const from = actor.x;
      if (twoOnOne) {
        t.phaseTurns += 1;
        const lone = byTeam[Object.keys(byTeam).find((team) => team !== pairTeam)][0];
        const pair = byTeam[pairTeam];
        const inReach = (one) => ss2SameLane(one, lone) && ss2FightDistance(one, lone) < ss2Reach(one);
        if (pair.every(inReach)) t.bothEngaged += 1;
        if (Math.sign(pair[0].x - lone.x) * Math.sign(pair[1].x - lone.x) < 0) t.pincer += 1;
        if (actor.teamId === pairTeam) {
          t.pairTurns += 1;
          pairTurnsThisPhase += 1;
          if (IDLE.has(chosen.type)) t.pairIdle += 1;
          if (chosen.type === "wincrowd") t.pairCrowd += 1;
          if (ATTACK.test(chosen.type)) {
            t.pairAttacks += 1;
            if (ss2IsBackAttack(actor, lone)) t.backAttacks += 1;
          }
        }
      }
      const step = host.submit({ actorId, ...chosen });
      for (const token of step.actionTokens) host.reportActionAnimation(token);
      if (/^walk-/.test(chosen.type) && combatantById(host.battle, actorId).x === from) t.stuck += 1;
      const after = ids.map((id) => combatantById(host.battle, id)).filter((one) => one.alive);
      const teams = new Set(after.map((one) => one.teamId));
      if (inPhase && !(teams.size === 2 && after.length === 3)) {
        inPhase = false;
        if (teams.size === 1 && after.filter((one) => one.teamId === pairTeam).length === 2) {
          t.converted += 1;
          t.killTurns.push(pairTurnsThisPhase);
        }
      }
    }
    t.turns += taken;
    if (host.battle.result) {
      t.settled += 1;
      if (host.battle.result.winnerTeamId === "red") t.redWins += 1;
      else if (host.battle.result.winnerTeamId === "blue") t.blueWins += 1;
    }
  }
  const kills = [...t.killTurns].sort((a, b) => a - b);
  const pct = (n, d) => (d ? `${(100 * n / d).toFixed(1)}%` : "-");
  return {
    bouts: t.bouts, unsettled: t.bouts - t.settled, meanTurns: (t.turns / t.bouts).toFixed(1),
    redWins: t.redWins, blueWins: t.blueWins, stuckWalks: t.stuck,
    phases2v1: t.phases, converted: `${t.converted}/${t.phases} ${pct(t.converted, t.phases)}`,
    medianTurnsToKill: kills.length ? kills[Math.floor(kills.length / 2)] : "-",
    pairIdle: pct(t.pairIdle, t.pairTurns), pairCrowd: pct(t.pairCrowd, t.pairTurns),
    bothEngaged: pct(t.bothEngaged, t.phaseTurns), pincer: pct(t.pincer, t.phaseTurns),
    backAttackShare: pct(t.backAttacks, t.pairAttacks)
  };
}

function main(argv) {
  const [kit = "plain", perSideArg = "2", seedsArg = "96", mode = "sweep"] = argv;
  const perSide = Number(perSideArg);
  const seeds = Number(seedsArg);
  if (![1, 2, 3].includes(perSide) || !(seeds >= 1)) {
    throw new Error("usage: node tools/ai-press-census.mjs <kit> <perSide 1-3> <seeds> [h2h]");
  }
  const roster = rosterFor(kit, perSide);
  const rules = Object.fromEntries(SS2_AI_PRESS.map((aiPress) => [aiPress, createSs2TeamRules({ aiPress })]));
  if (mode === "h2h") {
    const a = census({ roster, seeds, policyFor: (side) => rules[side === "red" ? "ranged-first" : "pincer-first"] });
    const b = census({ roster, seeds, policyFor: (side) => rules[side === "red" ? "pincer-first" : "ranged-first"] });
    console.log(JSON.stringify({
      kit, perSide, seeds,
      h2h: { rangedWins: a.redWins + b.blueWins, pincerWins: a.blueWins + b.redWins, unsettled: a.unsettled + b.unsettled }
    }));
    return;
  }
  for (const aiPress of SS2_AI_PRESS) {
    console.log(JSON.stringify({ kit, perSide, policy: aiPress, ...census({ roster, seeds, policyFor: () => rules[aiPress] }) }));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
