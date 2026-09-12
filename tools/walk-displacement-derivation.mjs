/**
 * Census: does the build still say what `ss2WalkDisplacement` says?
 *
 * `MAP_SILENCE.movement-displacement` spent nine days recording that the battle
 * map gives every movement phase's stamina COST with a byte offset and no
 * phase's DISTANCE, and `SS2_ARENA.walkDistance` carried 44 on the strength of
 * one uncited line in a frozen handoff. **The map is silent; the build is not.**
 * The eight movement branches of overlay frame 52 each compute a destination,
 * and nobody had read them.
 *
 * This tool is what keeps that from decaying back into a transcription nobody
 * re-checks. It reads the installed SWF and diffs the BUILD against
 * `src/team/ss2-rules.js` — the step factors, the boot and shinguard bonus
 * terms, the easing divisor, the stop tolerance, the two percentage helpers
 * INCLUDING their parameter registers, and the `movement_speed` clamp.
 *
 * REPORT ONLY. It reads the installed SWF and the committed module, and writes
 * nothing.
 *
 *   node tools/walk-displacement-derivation.mjs
 *   node tools/walk-displacement-derivation.mjs "/path/to/swords_sandals2_download.swf"
 *
 * Exit status is 0 when every check agrees, 1 when any disagrees, 2 when the
 * SWF is not reachable. A fresh clone has no licensed build, so this is a tool
 * a human runs on the capture box rather than a test — the same shape as
 * `tools/item-table-transcription.mjs`, and for the same reason: for build DATA
 * the only honest oracle is the build.
 *
 * ## Why it checks the register numbers, which is the easy half to leave out
 *
 * `get_percentage` and `add_percentage` decide whether boots make a walk longer
 * or shorter. Their bodies read `Push register:2, register:1` — and the
 * `DefineFunction2` header assigns parameter `a` to register 2 and `b` to
 * register 1, which is the reverse of the obvious reading. Transcribing the
 * body without the header inverts both helpers and the error is invisible,
 * because the result is still a plausible percentage. So the headers are
 * checked, not assumed.
 *
 * ## Why it locates everything by SHAPE
 *
 * Every search below is keyed on a constant the build pushes — a phase name, a
 * field name, a literal — and never on an offset or an instruction index. A
 * scan keyed on position goes quiet the moment anything above it moves, and
 * going quiet looks exactly like finding nothing wrong. The offsets this tool
 * PRINTS are derived from what it found; they are output, never input.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { analyseSwfBuffer } from "./inspect-swf.mjs";
import { ss2WalkDisplacement, SS2_MOVEMENT_STEP_FACTOR, SS2_ARENA } from "../src/team/ss2-rules.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Where the Collection installs on the capture box; overridable because the tree has moved twice. */
const DEFAULT_SWF =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";

/** The block every movement branch lives in, matched by CONTEXT rather than offset. */
const PHASE_BLOCK = "sprite:862/frame:52/DoAction@0x240c7f";
/** And the one `battlevalues` lives in, for the `movement_speed` clamp. */
const BATTLEVALUES_BLOCK = "root/frame:35/DoAction@0x3fa9dc";

/**
 * What each movement phase is expected to compute, and how it is spelt in the
 * build. `factor` multiplies `movement_speed`; `bonus` is the armour field whose
 * id feeds the `100 + 2 * id` percentage, or null for the phases that take one.
 */
const PHASES = Object.freeze([
  { phase: "walkleft", family: "walk", factor: 16, bonus: "boot", clip: "StepBack" },
  { phase: "walkright", family: "walk", factor: 16, bonus: "boot", clip: "StepForward" },
  { phase: "runleft", family: "run", factor: 40, bonus: null, clip: "RunBack" },
  { phase: "runright", family: "run", factor: 40, bonus: null, clip: "RunForward" },
  { phase: "chargeleft", family: "charge", factor: 20, bonus: null, clip: null },
  { phase: "chargeright", family: "charge", factor: 20, bonus: null, clip: null },
  { phase: "jumpleft", family: "jump", factor: 0.6, bonus: "shinguard", clip: null },
  { phase: "jumpright", family: "jump", factor: 0.6, bonus: "shinguard", clip: null }
]);

const numeric = (operand) =>
  operand && (operand.type === "integer" || operand.type === "double" || operand.type === "float")
    ? operand.value
    : null;

const stringish = (operand) =>
  operand && (operand.type === "string" || operand.type === "constant") ? operand.value : null;

/**
 * Every instruction in a block, flattened in offset order, each carrying the
 * name of the function it sits inside. The movement branches are one level deep
 * — the whole phase machine is nested — so a top-level-only walk finds nothing,
 * which is the failure this flatten exists to prevent.
 */
function flatten(instructions, fnName = "<timeline>", output = []) {
  for (const instruction of instructions) {
    output.push({ instruction, fnName });
    const operand = instruction.operand;
    if (instruction.name === "DefineFunction" || instruction.name === "DefineFunction2") {
      flatten(operand?.body ?? [], operand?.name || "<anonymous>", output);
    } else if (Array.isArray(operand?.body)) {
      flatten(operand.body, fnName, output);
    } else if (Array.isArray(operand?.bodies)) {
      for (const body of operand.bodies) flatten(body.body ?? [], fnName, output);
    }
  }
  return output;
}

/** Every string a Push instruction pushes, in push order. */
function pushedStrings(instruction) {
  if (instruction.name !== "Push") return [];
  return instruction.operand.map(stringish).filter((value) => typeof value === "string");
}

/** Every number a Push instruction pushes. */
function pushedNumbers(instruction) {
  if (instruction.name !== "Push") return [];
  return instruction.operand.map(numeric).filter((value) => value !== null);
}

/**
 * The index at which a phase's branch begins: the `Push "<phase>"` that the
 * build compares `phase_decision` against. Found by shape, and asserted UNIQUE
 * — a phase name pushed twice would make every window below ambiguous.
 */
function branchStart(flat, phase) {
  const hits = [];
  for (let index = 0; index < flat.length; index += 1) {
    if (!pushedStrings(flat[index].instruction).includes(phase)) continue;
    // The comparison, not a label or a `gotoAndPlay` argument: the build tests
    // `phase_decision == "<phase>"` and the Equals2 follows within a couple of
    // instructions.
    const follows = flat.slice(index + 1, index + 3).map((entry) => entry.instruction.name);
    if (follows.includes("Equals2")) hits.push(index);
  }
  return hits;
}

/** Where the next phase's comparison starts, so a window never reads into its neighbour. */
function windowEnd(flat, start) {
  for (let index = start + 1; index < flat.length; index += 1) {
    const pushes = pushedStrings(flat[index].instruction);
    if (!pushes.some((value) => PHASES.some((entry) => entry.phase === value))) continue;
    const follows = flat.slice(index + 1, index + 3).map((entry) => entry.instruction.name);
    if (follows.includes("Equals2")) return index;
  }
  return flat.length;
}

/**
 * Where a window's `staminacost` assignment ENDS, so the destination search
 * never reads the cost by mistake.
 *
 * ► **THIS FUNCTION EXISTS BECAUSE THE TOOL GOT IT WRONG FIRST, which is the
 *   argument for the tool.** The first version skipped "the `staminacost`
 *   divide" and searched from the top of the branch. That works for `walk*` and
 *   `run*`, whose cost is `round(movement_speed / 2)` — and it reported
 *   `chargeleft`/`chargeright` as `movement_speed * 2`, because a charge's COST
 *   is `round(movement_speed * 2)` (map table `+0x4214` / `+0x4480`) and a
 *   multiplication is exactly what the search was looking for. A hand
 *   transcription would have read the destination and never noticed; the tool
 *   disagreed with it out loud and was right to.
 */
function staminacostEnd(flat, start, end) {
  for (let index = start; index < end; index += 1) {
    if (!pushedStrings(flat[index].instruction).includes("staminacost")) continue;
    for (let ahead = index + 1; ahead < end; ahead += 1) {
      if (flat[ahead].instruction.name === "SetMember") return ahead + 1;
    }
    return index + 1;
  }
  return start;
}

/**
 * The factor a window multiplies `movement_speed` by in its DESTINATION:
 * `Push "movement_speed"; GetMember; Push <n>; Multiply`, searched from after
 * the branch's `staminacost` assignment. Returned with its offset so the report
 * can cite it.
 */
function movementSpeedFactor(flat, branchStartIndex, end) {
  const start = staminacostEnd(flat, branchStartIndex, end);
  for (let index = start; index < end; index += 1) {
    if (!pushedStrings(flat[index].instruction).includes("movement_speed")) continue;
    for (let ahead = index + 1; ahead < Math.min(index + 6, end); ahead += 1) {
      const entry = flat[ahead].instruction;
      const numbers = pushedNumbers(entry);
      if (entry.name !== "Push" || numbers.length === 0) continue;
      const next = flat.slice(ahead + 1, ahead + 3).map((item) => item.instruction.name);
      if (next.includes("Multiply")) return { factor: numbers[0], offset: entry.offset };
      break;
    }
  }
  return null;
}

/** The armour field a window's percentage bonus reads, with the `* 2` beside it. */
function bonusField(flat, start, end) {
  for (let index = start; index < end; index += 1) {
    const pushes = pushedStrings(flat[index].instruction);
    const field = pushes.find((value) => value === "boot" || value === "shinguard");
    if (!field) continue;
    const window = flat.slice(index, Math.min(index + 6, end));
    const doubled = window.some((entry) => pushedNumbers(entry.instruction).includes(2))
      && window.some((entry) => entry.instruction.name === "Multiply");
    const hundreds = flat.slice(Math.max(start, index - 6), index)
      .some((entry) => pushedNumbers(entry.instruction).includes(100));
    return { field, doubled, hundreds, offset: flat[index].instruction.offset };
  }
  return null;
}

/** Does the window ease toward its destination by `ceil(gap / <divisor>)`? */
function easing(flat, start, end) {
  for (let index = start; index < end; index += 1) {
    const numbers = pushedNumbers(flat[index].instruction);
    if (numbers.length === 0) continue;
    const next = flat.slice(index + 1, index + 6).map((entry) => entry.instruction);
    if (!next.some((entry) => entry.name === "Divide")) continue;
    if (!next.some((entry) => pushedStrings(entry).includes("ceil"))) continue;
    return { divisor: numbers[0], offset: flat[index].instruction.offset };
  }
  return null;
}

/** The stop tolerance: the literal the window adds to the destination before comparing. */
function stopGap(flat, start, end) {
  for (let index = start; index < end; index += 1) {
    const numbers = pushedNumbers(flat[index].instruction);
    if (numbers.length === 0) continue;
    const next = flat.slice(index + 1, index + 4).map((entry) => entry.instruction.name);
    const arithmetic = next.includes("Add2") || next.includes("Subtract");
    const compared = next.includes("Greater") || next.includes("Less2");
    if (arithmetic && compared) return { gap: numbers[0], offset: flat[index].instruction.offset };
  }
  return null;
}

/** A named function's parameter registers and body, found by name anywhere in the block. */
function namedFunction(block, name) {
  const found = [];
  const visit = (instructions) => {
    for (const instruction of instructions) {
      const operand = instruction.operand;
      if ((instruction.name === "DefineFunction" || instruction.name === "DefineFunction2") && operand?.name === name) {
        found.push(operand);
      }
      if (Array.isArray(operand?.body)) visit(operand.body);
      if (Array.isArray(operand?.bodies)) for (const body of operand.bodies) visit(body.body ?? []);
    }
  };
  visit(block.instructions);
  return found;
}

function main(argv) {
  const file = argv[0] ?? DEFAULT_SWF;
  let buffer;
  try {
    buffer = readFileSync(file);
  } catch (error) {
    console.error(`The installed build is not reachable at:\n  ${file}\n${error.message}`);
    console.error("Pass its path as the first argument. A fresh clone has no licensed build; this tool needs");
    console.error("the capture box, and for build DATA the only honest oracle is the build.");
    return 2;
  }

  const { swf, analysis } = analyseSwfBuffer(buffer);
  const block = analysis.actionBlocks.find((entry) => entry.context.includes(PHASE_BLOCK));
  const battlevalues = analysis.actionBlocks.find((entry) => entry.context.includes(BATTLEVALUES_BLOCK));

  const problems = [];
  const note = (message) => console.log(`  ${message}`);

  console.log(`build: ${path.basename(file)}  (${buffer.length} bytes, ${swf.frameRate} fps)`);
  if (!block) {
    problems.push(`no action block matching ${PHASE_BLOCK} — the phase machine moved, or the build is not SS2`);
  }
  if (!battlevalues) {
    problems.push(`no action block matching ${BATTLEVALUES_BLOCK} — battlevalues moved`);
  }
  if (problems.length > 0) {
    for (const problem of problems) console.log(`PROBLEM: ${problem}`);
    return 1;
  }

  const flat = flatten(block.instructions);
  console.log(`block ${PHASE_BLOCK}: ${flat.length} instructions (flattened)\n`);

  console.log("THE EIGHT MOVEMENT PHASES — destination factor on movement_speed");
  for (const expected of PHASES) {
    const starts = branchStart(flat, expected.phase);
    if (starts.length !== 1) {
      problems.push(`${expected.phase}: expected exactly one phase_decision comparison, found ${starts.length}`);
      continue;
    }
    const start = starts[0];
    const end = windowEnd(flat, start);
    const found = movementSpeedFactor(flat, start, end);
    if (found === null) {
      problems.push(`${expected.phase}: no movement_speed multiplication found in its branch`);
      continue;
    }
    const offset = `+0x${(found.offset - block.offset).toString(16).padStart(4, "0")}`;
    const agrees = found.factor === expected.factor;
    const shipped = SS2_MOVEMENT_STEP_FACTOR[expected.family];
    note(`${expected.phase.padEnd(12)} movement_speed * ${String(found.factor).padEnd(4)} ${offset}  ${agrees ? "ok" : "DISAGREES"}`);
    if (!agrees) {
      problems.push(`${expected.phase}: build says movement_speed * ${found.factor}, this tool expected ${expected.factor}`);
    }
    if (shipped !== expected.factor) {
      problems.push(
        `${expected.phase}: SS2_MOVEMENT_STEP_FACTOR.${expected.family} is ${shipped}, the build says ${found.factor}`
      );
    }

    const bonus = bonusField(flat, start, end);
    if (expected.bonus === null) {
      if (bonus !== null) {
        problems.push(`${expected.phase}: found a ${bonus.field} bonus the module says it does not take`);
      }
    } else if (bonus === null) {
      problems.push(`${expected.phase}: expected a ${expected.bonus} percentage bonus and found none`);
    } else {
      const offsetText = `+0x${(bonus.offset - block.offset).toString(16).padStart(4, "0")}`;
      const shape = bonus.field === expected.bonus && bonus.doubled && bonus.hundreds;
      note(`${"".padEnd(12)} bonus 100 + 2 * ${bonus.field.padEnd(10)} ${offsetText}  ${shape ? "ok" : "DISAGREES"}`);
      if (!shape) {
        problems.push(
          `${expected.phase}: bonus shape is ${bonus.field}, doubled=${bonus.doubled}, hasHundred=${bonus.hundreds}; ` +
          `expected ${expected.bonus}, doubled, against 100`
        );
      }
    }
  }

  console.log("\nTHE EASING, which is what turns a destination into a realised displacement");
  const walkStart = branchStart(flat, "walkright")[0];
  const walkEnd = walkStart === undefined ? 0 : windowEnd(flat, walkStart);
  const ease = walkStart === undefined ? null : easing(flat, walkStart, walkEnd);
  const stop = walkStart === undefined ? null : stopGap(flat, walkStart, walkEnd);
  if (ease === null) problems.push("walkright: no `ceil(gap / n)` easing found");
  else {
    note(`easing divisor ${ease.divisor}   +0x${(ease.offset - block.offset).toString(16).padStart(4, "0")}`);
    if (ease.divisor !== 8) problems.push(`walkright: easing divisor is ${ease.divisor}, the module assumes 8`);
  }
  if (stop === null) problems.push("walkright: no stop tolerance found");
  else {
    note(`stop tolerance ${stop.gap}   +0x${(stop.offset - block.offset).toString(16).padStart(4, "0")}`);
    if (stop.gap !== 20) problems.push(`walkright: stop tolerance is ${stop.gap}, the module assumes 20`);
  }

  console.log("\nTHE TWO PERCENTAGE HELPERS, headers included — the half a careless read inverts");
  for (const name of ["get_percentage", "add_percentage"]) {
    const defs = namedFunction(block, name);
    if (defs.length !== 1) {
      problems.push(`${name}: expected exactly one definition, found ${defs.length}`);
      continue;
    }
    const registers = (defs[0].parameters ?? []).map((parameter) => `${parameter.name}=r${parameter.register}`);
    note(`${name}(${registers.join(", ")})`);
    const expected = ["a=r2", "b=r1"];
    if (registers.join(",") !== expected.join(",")) {
      problems.push(
        `${name}: parameter registers are ${registers.join(", ")}, and this module's arithmetic assumes ` +
        `${expected.join(", ")} — read the header, because the body alone inverts the helper`
      );
    }
  }

  console.log("\nTHE movement_speed CLAMP, which is what makes 44 the FLOOR case and not the rule");
  const bvFlat = flatten(battlevalues.instructions);
  const clampLiterals = [];
  for (let index = 0; index < bvFlat.length; index += 1) {
    if (!pushedStrings(bvFlat[index].instruction).includes("movement_speed")) continue;
    for (const entry of bvFlat.slice(index, index + 8)) {
      for (const value of pushedNumbers(entry.instruction)) clampLiterals.push(value);
    }
  }
  const hasFloor = clampLiterals.includes(4);
  const hasCeiling = clampLiterals.includes(60);
  note(`floor 4 ${hasFloor ? "ok" : "NOT FOUND"}   ceiling 60 ${hasCeiling ? "ok" : "NOT FOUND"}`);
  if (!hasFloor) problems.push("battlevalues: no clamp floor of 4 beside movement_speed");
  if (!hasCeiling) problems.push("battlevalues: no clamp ceiling of 60 beside movement_speed");

  console.log("\nTHE MODULE'S OWN ARITHMETIC, against the build's numbers rather than against itself");
  const floorStep = Math.ceil(4 * SS2_MOVEMENT_STEP_FACTOR.walk);
  let gap = floorStep;
  while (gap > 20) gap -= Math.ceil(gap / 8);
  const realised = floorStep - gap;
  note(`movement_speed 4 -> step ${floorStep} -> eased to a stop with ${gap} left -> displacement ${realised}`);
  if (ss2WalkDisplacement(4) !== realised) {
    problems.push(`ss2WalkDisplacement(4) is ${ss2WalkDisplacement(4)}; the build's own arithmetic gives ${realised}`);
  }
  if (SS2_ARENA.walkDistanceAtSpeedFloor !== realised) {
    problems.push(
      `SS2_ARENA.walkDistanceAtSpeedFloor is ${SS2_ARENA.walkDistanceAtSpeedFloor}; the build gives ${realised}`
    );
  }
  note(`ss2WalkDisplacement(4) = ${ss2WalkDisplacement(4)}   SS2_ARENA.walkDistanceAtSpeedFloor = ${SS2_ARENA.walkDistanceAtSpeedFloor}`);

  // Vacuity guard. A census that matched nothing agrees with everything.
  if (flat.length < 1000) {
    problems.push(`only ${flat.length} instructions flattened out of a 0x${block.length.toString(16)}-byte block — the flatten is broken, not the build`);
  }

  console.log("");
  if (problems.length === 0) {
    console.log(`AGREES: ${PHASES.length} movement phases, both helpers, the easing, the stop and the clamp.`);
    console.log(`Repository checked: ${path.relative(REPO_ROOT, fileURLToPath(new URL("../src/team/ss2-rules.js", import.meta.url)))}`);
    return 0;
  }
  for (const problem of problems) console.log(`PROBLEM: ${problem}`);
  return 1;
}

process.exitCode = main(process.argv.slice(2));
