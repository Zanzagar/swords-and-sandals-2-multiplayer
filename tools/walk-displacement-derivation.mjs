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
 * INCLUDING their parameter registers, the `movement_speed` clamp, and the
 * sub-100 nudge's DIRECTION.
 *
 * ## Why the nudge's direction is checked, and checked the long way
 *
 * Added 2026-09-12, after two source docstrings, two test comments and a commit
 * message all said the nudge "drives the two together a pixel a frame". **It
 * separates.** The instructive part is that the nudge's own bytes DO NOT SETTLE
 * IT: `hero._x += 1` is toward or away depending entirely on what
 * `gladiator_dir` means, and the rival convention ("the side I stand on") fits
 * the same opcodes and yields the opposite answer. So this tool reads the
 * TURNAROUND as well — `if (hero._x < villain._x) hero.gladiator_dir = "right"`
 * — and DERIVES the direction from the two together, reporting SEPARATES or
 * CLOSES as a conclusion rather than checking a constant. A checker that only
 * confirmed the `±1` pattern would have been green through the whole error.
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

  // THE STOP TOLERANCE IS PER PHASE, and the first version of this tool printed
  // one line as though it were universal — which invites computing a run's step
  // as `40 * ms - 20` when it is `- 10`. Reported per branch, asserted only
  // where the module depends on it.
  const tolerances = new Map();
  for (const entry of PHASES) {
    const starts = branchStart(flat, entry.phase);
    if (starts.length !== 1) continue;
    const found = stopGap(flat, starts[0], windowEnd(flat, starts[0]));
    tolerances.set(entry.phase, found?.gap ?? null);
  }
  note(`per-phase stop tolerance: ${[...tolerances].map(([phase, gap]) => `${phase} ${gap ?? "none"}`).join(", ")}`);
  if (tolerances.get("walkleft") !== 20 || tolerances.get("walkright") !== 20) {
    problems.push(`the two walk branches must both stop at 20; found ${tolerances.get("walkleft")} / ${tolerances.get("walkright")}`);
  }
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

  console.log("\nTHE TWO PERCENTAGE HELPERS, headers AND operation order — the halves a careless read gets wrong");
  const helperOrder = new Map();
  for (const name of ["get_percentage", "add_percentage"]) {
    const defs = namedFunction(block, name);
    if (defs.length !== 1) {
      problems.push(`${name}: expected exactly one definition, found ${defs.length}`);
      continue;
    }
    const registers = (defs[0].parameters ?? []).map((parameter) => `${parameter.name}=r${parameter.register}`);
    // THE ARITHMETIC ORDER, READ RATHER THAN TRANSCRIBED. This is the check the
    // first version of this tool did not have, and the one a verifier used to
    // break the module: `add_percentage` DIVIDES BEFORE MULTIPLYING, which is a
    // different function from `a * b / 100` in IEEE-754 doubles. The opcode
    // sequence says so and a literal scan cannot.
    const ops = (defs[0].body ?? []).map((instruction) => instruction.name).filter((op) => op === "Divide" || op === "Multiply");
    helperOrder.set(name, ops.join(","));
    note(`${name}(${registers.join(", ")})   arithmetic: ${ops.join(" then ") || "none"}`);
    const expected = ["a=r2", "b=r1"];
    if (registers.join(",") !== expected.join(",")) {
      problems.push(
        `${name}: parameter registers are ${registers.join(", ")}, and this module's arithmetic assumes ` +
        `${expected.join(", ")} — read the header, because the body alone inverts the helper`
      );
    }
    if (ops.join(",") !== "Divide,Multiply") {
      problems.push(
        `${name}: arithmetic order is ${ops.join(" then ")}, and ss2WalkDisplacement is written for ` +
        "Divide then Multiply. Collapsing the two into one expression changes the function in doubles."
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

  console.log("\nTHE INIT BLOCK FALLS THROUGH INTO THE TWEEN, which is why a do/while and not a while");
  // A verifier's mutation — replacing the init block's tail with a Jump over the
  // tween — left the first version of this tool printing AGREES, because it
  // checked literals and never control flow. The `destination == null` If's
  // target is the tween's first instruction, and nothing between them jumps.
  const destinationIf = (() => {
    if (walkStart === undefined) return null;
    for (let index = walkStart; index < walkEnd; index += 1) {
      const instruction = flat[index].instruction;
      if (instruction.name !== "If") continue;
      const before = flat.slice(Math.max(walkStart, index - 6), index);
      if (!before.some((entry) => pushedStrings(entry.instruction).includes("destination"))) continue;
      if (!before.some((entry) => entry.instruction.name === "Equals2")) continue;
      return { index, target: instruction.operand?.target ?? null };
    }
    return null;
  })();
  if (destinationIf === null || destinationIf.target === null) {
    problems.push("walkright: could not locate the `destination == null` If, so the fall-through is unchecked");
  } else {
    const targetRel = destinationIf.target - block.offset;
    const body = flat.filter((entry) => {
      const rel = entry.instruction.offset - block.offset;
      const fromRel = flat[destinationIf.index].instruction.offset - block.offset;
      return rel > fromRel && rel < targetRel;
    });
    const jumps = body.filter((entry) => entry.instruction.name === "Jump" || entry.instruction.name === "Return");
    note(`init block +0x${(flat[destinationIf.index].instruction.offset - block.offset).toString(16)}..+0x${targetRel.toString(16)}: ${body.length} instructions, ${jumps.length} Jump/Return`);
    if (jumps.length > 0) {
      problems.push(
        `walkright: the destination init block contains ${jumps.length} Jump/Return, so it may not fall through ` +
        "into the tween — ss2WalkDisplacement's do/while assumes it does"
      );
    }
    // Vacuity guard: an empty init block would make "0 Jump/Return" vacuously true.
    if (body.length === 0) problems.push("the fall-through scan found an EMPTY init block, so its 0 Jump/Return proves nothing");
  }

  // ------------------------------------------------------------------
  // THE SUB-100 NUDGE, and which way it pushes.
  //
  // ► **THIS CHECK EXISTS BECAUSE THE ANSWER WAS WRITTEN DOWN BACKWARDS
  //   (2026-09-12).** Two source docstrings, two test comments and a commit
  //   message all said the nudge "drives the two together a pixel a frame". It
  //   SEPARATES. The bytes alone do not settle it — `hero._x += 1` is toward or
  //   away depending entirely on what `gladiator_dir` MEANS — so the rival
  //   convention ("the side I stand on") fits the same opcodes and gives the
  //   opposite answer. What settles it is the TURNAROUND in the same block, and
  //   that is why this check reads both and derives the direction rather than
  //   asserting it.
  // ------------------------------------------------------------------
  console.log("\nTHE SUB-100 NUDGE, and which way it pushes — derived from the turnaround, never assumed");
  {
    // The guard: the single `Push "fightdistance"` in this block, followed by a
    // literal and a `Less2`.
    let guard = null;
    let nudgeAt = -1;
    for (let index = 0; index < flat.length; index += 1) {
      if (!pushedStrings(flat[index].instruction).includes("fightdistance")) continue;
      for (let ahead = index + 1; ahead < Math.min(index + 6, flat.length); ahead += 1) {
        const numbers = pushedNumbers(flat[ahead].instruction);
        if (numbers.length === 0) continue;
        if (flat[ahead + 1]?.instruction.name !== "Less2") break;
        guard = { value: numbers[0], offset: flat[ahead].instruction.offset };
        nudgeAt = index;
        break;
      }
      if (guard) break;
    }
    if (!guard) {
      problems.push("the sub-100 nudge's `fightdistance <` guard was not found; its direction is UNVERIFIED");
      note("nudge guard NOT FOUND");
    } else {
      note(`guard: fightdistance < ${guard.value}   +0x${(guard.offset - block.offset).toString(16)}`);

      // The branch: `hero.gladiator_dir == "left"` decides which arm runs.
      // Within each arm, record whether hero._x is Incremented or Decremented.
      const window = flat.slice(nudgeAt, nudgeAt + 140);
      const test = window.find((entry) => pushedStrings(entry.instruction).includes("left"));
      const arms = [];
      for (let index = 0; index < window.length; index += 1) {
        const op = window[index].instruction.name;
        if (op !== "Increment" && op !== "Decrement") continue;
        // Whose `_x`? the nearest preceding "hero"/"villain" push.
        let who = null;
        for (let back = index - 1; back >= 0 && back > index - 14; back -= 1) {
          const pushes = pushedStrings(window[back].instruction);
          if (pushes.includes("hero")) { who = "hero"; break; }
          if (pushes.includes("villain")) { who = "villain"; break; }
        }
        if (who) arms.push({ who, op, offset: window[index].instruction.offset });
      }
      if (!test || arms.length !== 4) {
        problems.push(`the nudge's two arms did not decode (test ${Boolean(test)}, ${arms.length} +/-1 sites, expected 4)`);
      } else {
        for (const arm of arms) {
          note(`  ${arm.who}._x ${arm.op === "Increment" ? "+= 1" : "-= 1"}   +0x${(arm.offset - block.offset).toString(16)}`);
        }

        // THE HINGE: what `gladiator_dir` means, read off the turnaround.
        // `if (hero._x < villain._x) { hero.gladiator_dir = <A>; ... }`
        let facingWord = null;
        for (let index = 0; index < flat.length; index += 1) {
          if (flat[index].instruction.name !== "Less2") continue;
          const before = flat.slice(Math.max(0, index - 26), index);
          const names = before.flatMap((entry) => pushedStrings(entry.instruction));
          if (!names.includes("hero") || !names.includes("villain") || !names.includes("_x")) continue;
          const after = flat.slice(index + 1, index + 30);
          const assign = after.find((entry) => {
            const pushes = pushedStrings(entry.instruction);
            return pushes.includes("gladiator_dir") && (pushes.includes("left") || pushes.includes("right"));
          });
          if (!assign) continue;
          const pushes = pushedStrings(assign.instruction);
          facingWord = { word: pushes.includes("right") ? "right" : "left", offset: assign.instruction.offset };
          break;
        }
        if (!facingWord) {
          problems.push("the gladiator_dir turnaround was not found, so the nudge's DIRECTION is UNVERIFIED (the bytes alone do not settle it)");
          note("  turnaround NOT FOUND — direction UNVERIFIED");
        } else {
          const rel = `+0x${(facingWord.offset - block.offset).toString(16)}`;
          note(`  turnaround: hero._x < villain._x  =>  hero.gladiator_dir = "${facingWord.word}"   ${rel}`);
          // hero._x < villain._x means the hero is on the LEFT. If that state
          // is spelt "right", the word is FACING. Then the nudge's `dir ==
          // "left"` arm runs when the hero is on the RIGHT, and that arm does
          // hero += 1 (further right) — away.
          const heroIsFacing = facingWord.word === "right";
          const leftArm = arms.slice(0, 2);
          const heroInLeftArm = leftArm.find((arm) => arm.who === "hero");
          const separates = heroIsFacing && heroInLeftArm?.op === "Increment";
          note(`  gladiator_dir is ${heroIsFacing ? "FACING" : "SIDE-OF-ARENA"}, so the nudge ${separates ? "SEPARATES" : "CLOSES"}`);
          if (!separates) {
            problems.push(
              "the nudge decodes as CLOSING; every comment in src/ and test/ now says it SEPARATES " +
              "(see ss2WalkDestination). One of the two is wrong and it is no longer this tool's guess."
            );
          }
        }
      }
    }
  }

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

  // THE BOOT TERM, SWEPT. The first version of this tool checked one numeric
  // point — `ss2WalkDisplacement(4)` at boot 0 — which is the single place the
  // build's lossy percentage round trip is exact, so the module could disagree
  // with the build everywhere else and still read AGREES. It did, by +1 at six
  // pairs. This sweep reproduces the build's operation order from the literals
  // read above and compares every reachable input.
  const buildWalk = (speed, boot) => {
    const base = speed * SS2_MOVEMENT_STEP_FACTOR.walk;
    const bonus = ((100 + 2 * boot) / 100) * 100;
    const step = Math.ceil(base * (bonus / 100));
    let gap = step;
    do {
      gap -= Math.ceil(gap / (ease?.divisor ?? 8));
    } while (gap > (stop?.gap ?? 20));
    return step - gap;
  };
  const mismatches = [];
  for (let speed = 4; speed <= 60; speed += 1) {
    for (let boot = 0; boot <= 26; boot += 1) {
      const mine = ss2WalkDisplacement(speed, { boot });
      const theirs = buildWalk(speed, boot);
      if (mine !== theirs) mismatches.push(`ms ${speed} boot ${boot}: module ${mine}, build ${theirs}`);
    }
  }
  note(`boot sweep: movement_speed 4..60 x boot 0..26 = ${57 * 27} pairs, ${mismatches.length} disagree`);
  for (const mismatch of mismatches.slice(0, 8)) problems.push(`boot sweep — ${mismatch}`);
  if (mismatches.length > 8) problems.push(`boot sweep — and ${mismatches.length - 8} more`);

  // Vacuity guard. A census that matched nothing agrees with everything.
  if (flat.length < 1000) {
    problems.push(`only ${flat.length} instructions flattened out of a 0x${block.length.toString(16)}-byte block — the flatten is broken, not the build`);
  }

  console.log("");
  if (problems.length === 0) {
    console.log(
      `AGREES: ${PHASES.length} movement phases, both helpers (registers AND arithmetic order), the easing, ` +
      "the per-phase stop tolerances, the init fall-through, the movement_speed clamp, and the boot sweep."
    );
    console.log(`Repository checked: ${path.relative(REPO_ROOT, fileURLToPath(new URL("../src/team/ss2-rules.js", import.meta.url)))}`);
    return 0;
  }
  for (const problem of problems) console.log(`PROBLEM: ${problem}`);
  return 1;
}

process.exitCode = main(process.argv.slice(2));
