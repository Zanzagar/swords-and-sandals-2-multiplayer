/**
 * How many movement phases does the build take before it is in melee range?
 *
 * ## What this settles, and what it does not
 *
 * `MAP_SILENCE.movement-displacement` records that the battle map gives every
 * movement phase's stamina COST with a byte offset and no phase's DISTANCE,
 * and that the only figure the repository holds — *"one walk is 44 px"* — is
 * **uncited, in a frozen handoff, and suspect** because 44 is also the range
 * multiplier in `weapon_range = physical_size + weapon[5] * 44`.
 *
 * That entry prescribes the measurement: *"Counting the walk phases before the
 * first attack in a staged session bounds the per-phase displacement, because
 * both ends of the interval are computable."* **This tool is the counting
 * half.** It reads the capture archive and reports the distribution.
 *
 * It uses a sharper boundary than "the first attack": the autopilot records the
 * CONTROLLER it is on, and the build selects `closerange_warrior` exactly when
 * `fightdistance < hero.weapon_range` (frame 4 `DoAction@0x238bbf` `+0x00f6`).
 * **So the flip from `longrange_warrior` to `closerange_warrior` IS the moment
 * the gate first held** — a direct observation of the predicate, rather than an
 * inference from when the autopilot chose to swing.
 *
 * **IT DOES NOT DERIVE THE DISPLACEMENT, and must not be read as doing so.**
 * Both gladiators close, and these traces record the HERO's autopilot steps;
 * without the villain's own phase sequence the closure per hero-step is
 * unknown, so the interval has one end and not two. What the distribution does
 * is corroborate the five-walk figure the 44 was consistency-checked against —
 * from the controller gate, over the whole archive, rather than from one
 * uncited line.
 *
 * REPORT ONLY, and read-only: it opens the archive and writes nothing.
 *
 *   node tools/approach-length-census.mjs [archive-root]
 *
 * Exit status is 0 when sessions were found and parsed, 2 when the archive is
 * not reachable — a fresh clone has none, so this is a tool for the capture
 * machine rather than a test.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * Where the archive lives on the capture box. The repository's own `captures/`
 * is gitignored and empty on a fresh clone; the populated tree is a separate
 * checkout, which is why this is overridable.
 */
const DEFAULT_ROOT = "/mnt/c/ss2-capture/captures";

const MOVEMENT = /^(walk|jump|charge|run)(left|right)$/;

function rufflelogsUnder(root) {
  const found = [];
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    let inner;
    try {
      inner = readdirSync(dir);
    } catch {
      continue;
    }
    for (const file of inner) {
      if (file.endsWith(".rufflelog")) found.push(path.join(dir, file));
    }
  }
  return found;
}

/**
 * The hero's autopilot steps, in order, each with the controller frame the
 * build was on when it took them.
 *
 * Parsed by SHAPE — a `{"at":"autopilot"}` debug record — rather than by line
 * number or offset, for the same reason the item-table census is: a scan keyed
 * on position goes quiet when anything above it moves, and going quiet looks
 * exactly like finding nothing wrong.
 */
function autopilotSteps(file) {
  const steps = [];
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return steps;
  }
  for (const line of text.split("\n")) {
    if (!line.includes('"at":"autopilot"')) continue;
    const brace = line.indexOf("{");
    if (brace < 0) continue;
    try {
      const record = JSON.parse(line.slice(brace));
      if (typeof record.step === "string") {
        steps.push({ step: record.step, controller: record.controller ?? null });
      }
    } catch {
      // A truncated trailing line is ordinary in a log a run was killed
      // mid-write; it is skipped rather than failing the census.
    }
  }
  return steps;
}

function main(argv) {
  const root = argv[0] ?? DEFAULT_ROOT;
  let exists = false;
  try {
    exists = statSync(root).isDirectory();
  } catch {
    exists = false;
  }
  if (!exists) {
    console.error(`The capture archive is not reachable at:\n  ${root}`);
    console.error("Pass its path as the first argument. A fresh clone has no archive; this tool needs the");
    console.error("capture machine, and for archive DATA the only honest oracle is the archive.");
    return 2;
  }

  const files = rufflelogsUnder(root) ?? [];
  const counts = new Map();
  let withSteps = 0;
  let reachedCloseRange = 0;
  const controllers = new Map();

  for (const file of files) {
    const steps = autopilotSteps(file);
    if (steps.length === 0) continue;
    withSteps += 1;
    for (const { controller } of steps) {
      if (controller) controllers.set(controller, (controllers.get(controller) ?? 0) + 1);
    }
    const flip = steps.findIndex(({ controller }) => typeof controller === "string" && controller.includes("closerange"));
    if (flip < 0) continue;
    reachedCloseRange += 1;
    const movement = steps.slice(0, flip).filter(({ step }) => MOVEMENT.test(step)).length;
    counts.set(movement, (counts.get(movement) ?? 0) + 1);
  }

  console.log(`archive: ${root}`);
  console.log(`rufflelogs: ${files.length}   with autopilot steps: ${withSteps}   reaching closerange: ${reachedCloseRange}`);
  console.log("\ncontroller frames observed (the build's own selector output):");
  for (const [name, n] of [...controllers].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name.padEnd(20)} ${n}`);
  }

  const problems = [];
  // Vacuity guards. A census that parses nothing agrees with everything.
  if (files.length === 0) problems.push("no rufflelogs found under the archive root — the scan is broken, not the archive");
  if (withSteps === 0) problems.push("no autopilot records parsed — the shape scan is broken, not the archive");
  if (reachedCloseRange === 0) problems.push("no session ever reached closerange; the flip boundary found nothing");

  if (reachedCloseRange > 0) {
    const keys = [...counts.keys()].sort((a, b) => a - b);
    const total = reachedCloseRange;
    console.log("\nMOVEMENT PHASES BEFORE THE CONTROLLER FLIPS TO closerange_warrior");
    console.log("(the flip IS `fightdistance < hero.weapon_range` first holding)\n");
    let cumulative = 0;
    let median = null;
    for (const key of keys) {
      const n = counts.get(key);
      cumulative += n;
      if (median === null && cumulative >= total / 2) median = key;
      const bar = "#".repeat(Math.max(1, Math.round((n / total) * 60)));
      console.log(`  ${String(key).padStart(3)}  ${String(n).padStart(5)}  ${(n / total * 100).toFixed(1).padStart(5)}%  ${bar}`);
    }
    const mode = keys.reduce((best, key) => (counts.get(key) > counts.get(best) ? key : best), keys[0]);
    console.log(`\n  n = ${total}   median ${median}   mode ${mode}   min ${keys[0]}   max ${keys.at(-1)}`);
    console.log(
      "\n  NOT a displacement. Both gladiators close and these are the HERO's steps, so the closure per\n" +
      "  step is unknown and the interval has one end. What this corroborates is the FIVE-WALK figure\n" +
      "  the authored 44 was consistency-checked against — now from the build's own controller gate,\n" +
      "  across the whole archive, rather than from one uncited line in a frozen handoff."
    );
  }

  if (problems.length === 0) return 0;
  console.log("");
  for (const problem of problems) console.log(`PROBLEM: ${problem}`);
  return 1;
}

process.exitCode = main(process.argv.slice(2));
