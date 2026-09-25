#!/usr/bin/env node
/**
 * Read-only: the `combatStateHash` of every promoted golden, replayed through
 * the real resolver exactly as `test/ss2-golden-resolver-replay.test.js`
 * replays it.
 *
 *   node tools/golden-hash-census.mjs [repo-root]
 *
 * Prints `<fixtureId> <hash>` per golden, sorted, and exits non-zero if any
 * golden fails to replay. **Compare two trees by running it against each and
 * diffing the output** — the working tree and a `git worktree` of the commit
 * before your change:
 *
 *   git worktree add --detach /tmp/base HEAD~1
 *   node tools/golden-hash-census.mjs /tmp/base > before.txt
 *   node tools/golden-hash-census.mjs          > after.txt
 *   diff before.txt after.txt && echo "no golden moved"
 *   git worktree remove /tmp/base --force
 *
 * ## Why this is a committed tool
 *
 * ► **The 2026-09-20 handoff told the next session to use
 *   `scratchpad/golden-census.mjs`, and that file lived in a per-session
 *   scratch directory that was gone two days later.** The standing rule is
 *   "measure the hashes, do not argue them"; a rule whose instrument can
 *   vanish is a rule nobody can follow. So the instrument is in the tree.
 *
 * ## What it reproduces, and the one thing it does not
 *
 * It builds each golden's two combatants with the replay test's own builder —
 * `derive: false`, the stamina stat inverted out of `staminamax`, speed zeroed
 * so initiative is id-ordered — prepends the direction sample the build would
 * have drawn, and resolves the one action. **It does not assert the golden's
 * expected values**; the replay test does that. This measures only whether a
 * change MOVED the hash, which is the question the test cannot answer on its
 * own because a golden's hash is not pinned anywhere.
 *
 * `root` must be a checkout of this repository; the modules are imported from
 * it, so the census measures that tree's code against that tree's goldens.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] ?? process.cwd());
const load = (relative) => import(pathToFileURL(path.join(root, relative)).href);

const { applyAction, combatStateHash, createTeamBattle, currentCombatant } = await load("src/team/index.js");
const { ATTACK_DIRECTION_ROLL_LABEL, createSs2TeamRules, Ss2ActionType, ss2Combatant } =
  await load("src/team/ss2-rules.js");

const goldenDir = path.join(root, "test/fixtures/ss2-1v1-golden");
const files = (await readdir(goldenDir)).filter((name) => name.endsWith(".json")).sort();

// The three bands and the direction ranges they draw, exactly as the build
// draws them: quick 1-4, normal 5-8, power 9-12.
const BANDS = Object.freeze([
  { type: Ss2ActionType.QUICK_ATTACK, low: 1, high: 4 },
  { type: Ss2ActionType.NORMAL_ATTACK, low: 5, high: 8 },
  { type: Ss2ActionType.POWER_ATTACK, low: 9, high: 12 }
]);

const build = (side, id, name) => ss2Combatant(
  { ...side, stamina: (side.staminamax - 100) / 10, speed: 0 },
  { id, name, controller: "local", derive: false }
);

const lines = [];
let failures = 0;
for (const file of files) {
  const text = await readFile(path.join(goldenDir, file), "utf8");
  const golden = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  const direction = golden.scenario.attackDirection;
  const band = BANDS.find((entry) => direction >= entry.low && direction <= entry.high);
  try {
    if (!band) throw new Error(`direction ${direction} is in no attack band`);
    const battle = createTeamBattle({
      rules: createSs2TeamRules({ fightMode: golden.scenario.fightMode ?? "tournament", fixtureReplay: true }),
      rngTape: [
        { label: ATTACK_DIRECTION_ROLL_LABEL, source: "randomBetween", min: band.low, max: band.high, value: direction },
        ...golden.samples
      ],
      teams: [
        { id: "red", combatants: [build(golden.scenario.hero, "hero", "Hero")] },
        { id: "blue", combatants: [build(golden.scenario.villain, "villain", "Villain")] }
      ]
    });
    if (currentCombatant(battle).id !== "hero") throw new Error("the hero must swing first");
    applyAction(battle, { actorId: "hero", type: band.type, targetId: "villain" });
    lines.push(`${golden.fixtureId} ${combatStateHash(battle)}`);
  } catch (error) {
    failures += 1;
    lines.push(`${golden.fixtureId} ERROR ${error.message}`);
  }
}

process.stdout.write(`${lines.sort().join("\n")}\n`);
if (failures > 0) {
  process.stderr.write(`${failures} of ${files.length} goldens failed to replay\n`);
  process.exitCode = 1;
}
