/**
 * How many movement phases does the build take before it is in melee range —
 * and is that consistent with the displacement the BYTES give?
 *
 * ## What this settles, and what it does not
 *
 * `MAP_SILENCE.movement-displacement` used to record that the battle map gives
 * every movement phase's stamina COST with a byte offset and no phase's
 * DISTANCE, and that the only figure the repository held — *"one walk is 44
 * px"* — was uncited, in a frozen handoff, and suspect.
 *
 * **THAT ENTRY IS CLOSED (2026-09-11), AND NOT BY THIS TOOL.** The walk
 * branches of overlay frame 52 compute the displacement and always did; see
 * `ss2WalkDisplacement` for the derivation and
 * `tools/walk-displacement-derivation.mjs` for the census that holds it to the
 * build. **The 44 was right, and it is the `movement_speed` FLOOR case.**
 *
 * So this tool's job changed. It is now the RUNTIME side of that derivation:
 *
 * 1. **The distribution.** How many movement phases the hero takes before the
 *    build's own controller selector flips to `closerange_warrior` — which IS
 *    `fightdistance < hero.weapon_range` first holding (frame 4
 *    `DoAction@0x238bbf` `+0x00f6`), so it observes the gate rather than
 *    inferring from when the autopilot chose to swing.
 * 2. **Who the hero IS, derived rather than assumed.** Every session's
 *    `{"t":"state"}` record carries `strength`, `min_damage` and `max_damage`.
 *    `min_damage - round(strength * 2)` is the weapon's own pair
 *    (`battlevalues` `+0x3356`), the pair identifies the weapon in
 *    `ss2-weapon-table.js`, and its `rangeMultiplier` gives
 *    `weapon_range = physical_size + multiplier * 44` (`+0x3190`). That is the
 *    gate's threshold, measured per session instead of guessed.
 * 3. **`movement_speed`, pinned from stamina.** A walk costs
 *    `round(movement_speed / 2)` (`+0x3d16`) and every completed phase
 *    regenerates `1 + round(stamina / 3)` (`nextphase` `+0x32c9`), with
 *    `staminamax = 100 + stamina * 10` (`+0x37b6`) naming the `stamina` stat.
 *    So the hero's stamina loss across the approach pins its `movement_speed`
 *    WITHOUT using the displacement law at all — which is what makes the next
 *    check a check and not a circle.
 * 4. **A ONE-SIDED BOUND on the displacement.** A hero closing ALONE at `d` per
 *    walk reaches the gate at `floor((500 - weapon_range) / d) + 1` walks. A
 *    villain that closes can only make the observed count SMALLER, so a count
 *    ABOVE the bound needs the separation to have GROWN — a retreat or a
 *    knockback. Counting the sessions that exceed each candidate `d` therefore
 *    rules out displacements that are too LARGE, and says nothing about ones
 *    that are too small. It is reported as the one-sided thing it is.
 *
 * **IT STILL DOES NOT DERIVE THE DISPLACEMENT, and must not be read as doing
 * so.** The villain closes too and these traces record the HERO's phases only
 * (`phase_action` mirrors the autopilot step one-for-one in every session here),
 * so no session gives the closure per step. A closed loop was attempted —
 * inferring the villain's `movement_speed` from ITS stamina drop and predicting
 * the flip — and **it failed: 208 of 1,484 predicted, 202 wrong, 1,074 with no
 * integer solution at all.** The villain does not simply walk every turn, and
 * its choices are not in the trace. That failure is recorded here rather than
 * dropped, because a reader who reaches for the same idea should know it has
 * been tried.
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

import { ss2WalkDisplacement } from "../src/team/ss2-rules.js";
import { SS2_WEAPON_IDS, ss2WeaponEntry } from "../src/team/ss2-weapon-table.js";

/**
 * Where the archive lives on the capture box. The repository's own `captures/`
 * is gitignored and empty on a fresh clone; the populated tree is a separate
 * checkout, which is why this is overridable.
 */
const DEFAULT_ROOT = "/mnt/c/ss2-capture/captures";

const MOVEMENT = /^(walk|jump|charge|run)(left|right)$/;

/** The separation at battle construction: clips at -250 and +250 (`getfightdistance`). */
const CONSTRUCTION_SEPARATION = 500;

/** AVM1 `Math.round` is `floor(x + 0.5)`, which differs from JS at negative halves. */
const avmRound = (value) => Math.floor(value + 0.5);

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
 * Every record in a trace, in order.
 *
 * Parsed by SHAPE rather than by line number or offset, for the same reason the
 * item-table census is: a scan keyed on position goes quiet when anything above
 * it moves, and going quiet looks exactly like finding nothing wrong.
 */
function records(file) {
  const out = [];
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return out;
  }
  for (const line of text.split("\n")) {
    const brace = line.indexOf("{");
    if (brace < 0) continue;
    try {
      out.push(JSON.parse(line.slice(brace)));
    } catch {
      // A truncated trailing line is ordinary in a log a run was killed
      // mid-write; it is skipped rather than failing the census.
    }
  }
  return out;
}

/**
 * The approach of the bout the capture ARMED, and nothing before it.
 *
 * ► **THE FIRST VERSION OF THIS TOOL DID NOT SEGMENT, AND ITS PUBLISHED
 *   DISTRIBUTION WAS WRONG BECAUSE OF IT (found 2026-09-11).** It took the
 *   first `closerange` controller in the whole FILE and counted every movement
 *   record before it. A trace holds more than one bout — and more than that, the
 *   autopilot presses before the battle is armed, which `{"at":"battle-ready"}`
 *   and a RESET of the autopilot's own `n` counter both mark. In
 *   `session-ondc100` that counted three walks where the armed bout took two.
 *   Segmenting on the `n == 1` reset and keeping the run that precedes
 *   `{"at":"action-armed"}` moves the census from "n = 1512, median 5, mode 5
 *   (36.3%), min 2, max 17" to the figures this tool now prints. **The old
 *   numbers are in `HANDOFF.md` and in the commit message of `0dd1811`; they
 *   are superseded by whatever this prints, not by a number written down here.**
 */
function armedApproach(file) {
  const all = records(file);
  const steps = all.filter((record) => record.at === "autopilot");
  if (steps.length === 0) return null;

  const runs = [];
  let current = [];
  for (const step of steps) {
    if (step.n === 1 && current.length > 0) {
      runs.push(current);
      current = [];
    }
    current.push(step);
  }
  if (current.length > 0) runs.push(current);

  // Which run belongs to the armed action, by position in the record stream.
  const stepIndices = all.flatMap((record, index) => (record.at === "autopilot" ? [index] : []));
  const armedIndex = all.findIndex((record) => record.at === "action-armed");
  const runStarts = [];
  let consumed = 0;
  for (const run of runs) {
    runStarts.push(stepIndices[consumed]);
    consumed += run.length;
  }
  let run = runs.at(-1);
  if (armedIndex >= 0) {
    const candidates = runStarts.flatMap((start, index) => (start <= armedIndex ? [index] : []));
    if (candidates.length > 0) run = runs[candidates.at(-1)];
  }

  const flip = run.findIndex((step) => typeof step.controller === "string" && step.controller.includes("closerange"));
  if (flip < 0) return null;

  const hero = all.find((record) => record.t === "state" && record.side === "hero")?.fields ?? null;
  return {
    movement: run.slice(0, flip).filter((step) => MOVEMENT.test(step.step ?? "")).length,
    nonMovement: run.slice(0, flip).filter((step) => !MOVEMENT.test(step.step ?? "")).map((step) => step.step),
    controllers: run.map((step) => step.controller).filter((name) => typeof name === "string"),
    hero
  };
}

/**
 * The gate's threshold for a hero, derived from its own state record.
 * `null` when the record does not carry the three fields, or when the damage
 * pair matches no weapon — never guessed.
 */
function weaponRangeOf(hero) {
  if (!hero) return null;
  const { strength, min_damage: min, max_damage: max, staminamax: staminaMax } = hero;
  if (![strength, min, max].every((value) => Number.isFinite(value))) return null;
  const physicalSize = 80 + avmRound(strength / 1.5);
  const pair = [min - avmRound(strength * 2), max - avmRound(strength * 2)];
  const weapons = SS2_WEAPON_IDS
    .map((id) => ss2WeaponEntry(id))
    .filter((entry) => entry.minDamage === pair[0] && entry.maxDamage === pair[1]);
  if (weapons.length === 0) return null;
  const multipliers = [...new Set(weapons.map((entry) => entry.rangeMultiplier))];
  return {
    physicalSize,
    pair,
    weaponIds: weapons.map((entry) => entry.id),
    multipliers,
    ranges: multipliers.map((multiplier) => physicalSize + multiplier * 44),
    stamina: Number.isFinite(staminaMax) ? (staminaMax - 100) / 10 : null,
    staminaLeft: hero.staminaleft ?? null,
    staminaMax: staminaMax ?? null
  };
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
  const controllers = new Map();
  const identities = new Map();
  const staminaSlope = new Map();
  let withSteps = 0;
  let reachedCloseRange = 0;
  let withHeroState = 0;
  const rangeVotes = new Map();

  for (const file of files) {
    const approach = armedApproach(file);
    if (approach === null) {
      if (records(file).some((record) => record.at === "autopilot")) withSteps += 1;
      continue;
    }
    withSteps += 1;
    reachedCloseRange += 1;
    for (const name of approach.controllers) controllers.set(name, (controllers.get(name) ?? 0) + 1);
    counts.set(approach.movement, (counts.get(approach.movement) ?? 0) + 1);

    const identity = weaponRangeOf(approach.hero);
    if (identity === null) continue;
    withHeroState += 1;
    const key = `strength ${approach.hero.strength}, weapon pair (${identity.pair.join(", ")}), ` +
      `physical_size ${identity.physicalSize}, weapon_range ${identity.ranges.join("/")}`;
    identities.set(key, (identities.get(key) ?? 0) + 1);
    for (const range of identity.ranges) rangeVotes.set(range, (rangeVotes.get(range) ?? 0) + 1);
    if (Number.isFinite(identity.staminaLeft) && Number.isFinite(identity.staminaMax)) {
      const drop = identity.staminaMax - identity.staminaLeft;
      const slopeKey = `${approach.movement}`;
      const bucket = staminaSlope.get(slopeKey) ?? new Map();
      bucket.set(drop, (bucket.get(drop) ?? 0) + 1);
      staminaSlope.set(slopeKey, bucket);
    }
  }

  console.log(`archive: ${root}`);
  console.log(`rufflelogs: ${files.length}   with autopilot steps: ${withSteps}   armed approaches reaching closerange: ${reachedCloseRange}`);
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
  }

  console.log(`\nWHO THE HERO IS, derived from each session's own state record (${withHeroState} of ${reachedCloseRange}):`);
  for (const [key, n] of [...identities].sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(5)}  ${key}`);
  if (withHeroState > 0 && identities.size === 0) {
    problems.push("hero state records parsed but no identity derived — the damage-pair inversion is broken");
  }

  console.log("\nmovement_speed, PINNED FROM STAMINA and not from the displacement:");
  console.log("  walk cost round(movement_speed / 2) minus nextphase's 1 + round(stamina / 3) regeneration.");
  let slopeHits = 0;
  let slopeTotal = 0;
  for (const [walks, drops] of [...staminaSlope].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const n = Number(walks);
    const all = [...drops].sort((a, b) => b[1] - a[1]);
    const expected = n + 1;
    const hit = drops.get(expected) ?? 0;
    slopeHits += hit;
    slopeTotal += [...drops.values()].reduce((sum, value) => sum + value, 0);
    console.log(`  ${String(n).padStart(3)} walks -> drop ${all.slice(0, 3).map(([drop, count]) => `${drop}x${count}`).join(" ")}   (net 1 a walk predicts ${expected})`);
  }
  if (slopeTotal > 0) {
    console.log(`\n  drop == walks + 1 in ${slopeHits} of ${slopeTotal} (${(100 * slopeHits / slopeTotal).toFixed(1)}%).`);
    console.log("  A net of 1 a walk means cost 2 against regeneration 1, so round(movement_speed / 2) = 2");
    console.log(`  and movement_speed = 4 — the clamp FLOOR. The derived displacement there is ${ss2WalkDisplacement(4)}.`);
  }

  const ranges = [...rangeVotes.keys()].sort((a, b) => b[1] - a[1]);
  if (reachedCloseRange > 0 && ranges.length > 0) {
    const range = ranges[0];
    const toClose = CONSTRUCTION_SEPARATION - range;
    console.log(`\nONE-SIDED BOUND on the per-walk displacement (weapon_range ${range}, so ${toClose} to close):`);
    console.log("  A hero closing ALONE at d reaches the gate at floor(toClose / d) + 1 walks. A villain that");
    console.log("  closes only makes the count SMALLER, so a count ABOVE the bound needs the separation to have");
    console.log("  GROWN — a retreat or a knockback. This rules out displacements that are too LARGE only.\n");
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    const candidates = [...new Set([16, 22, 30, 38, ss2WalkDisplacement(4), 50, ss2WalkDisplacement(5), ss2WalkDisplacement(6), 88, ss2WalkDisplacement(8)])].sort((a, b) => a - b);
    console.log(`  ${"d".padStart(5)} ${"bound".padStart(6)} ${"over".padStart(6)} ${"rate".padStart(7)}`);
    for (const d of candidates) {
      const bound = Math.floor(toClose / d) + 1;
      let over = 0;
      for (const [walks, n] of counts) if (walks > bound) over += n;
      const mark = d === ss2WalkDisplacement(4) ? "  <- the derivation, at the movement_speed floor" : "";
      console.log(`  ${String(d).padStart(5)} ${String(bound).padStart(6)} ${String(over).padStart(6)} ${(100 * over / total).toFixed(1).padStart(6)}%${mark}`);
    }
  }

  console.log(
    "\n  NONE OF THIS DERIVES THE DISPLACEMENT. The bytes do (`ss2WalkDisplacement`,\n" +
    "  `tools/walk-displacement-derivation.mjs`); this is the runtime side, and it is one-sided.\n" +
    "  A closed loop WAS tried — infer the villain's movement_speed from its own stamina drop and\n" +
    "  predict the flip — and it failed, 208 of 1,484 predicted and 1,074 with no integer solution:\n" +
    "  the villain does not simply walk every turn and its phases are not in the trace."
  );

  if (problems.length === 0) return 0;
  console.log("");
  for (const problem of problems) console.log(`PROBLEM: ${problem}`);
  return 1;
}

process.exitCode = main(process.argv.slice(2));
