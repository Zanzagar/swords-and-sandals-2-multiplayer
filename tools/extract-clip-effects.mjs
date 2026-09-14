/**
 * WHEN THE FIGHTER CLIP SPAWNS AN EFFECT — a table, derived, with no interpreter.
 *
 * ## Why this is not an AVM1 interpreter, having measured whether it needed to be
 *
 * The owner asked for "the bigger implementation if it is the proper way to do
 * it". **It is not**, and the measurement is why rather than a preference.
 *
 * The fighter clip spawns its blood and its bounced limbs through one function,
 * `bounceitem(whichitem, blood_drops)`, defined in its own frame 1
 * (`sprite:1241/frame:1/DoAction@0x34951a`) and looping five drops onto
 * `arena.gladiators` at depth 45300. An interpreter would be the proper way if
 * the CALLS were dynamic. They are not:
 *
 * ```text
 *   32 call sites across 28 frames of clip 1241
 *   30 of them push two CONSTANTS   bounceitem("blood", n)   n in {3, 6, 9, 15}
 *    2 of them push the rig's own `head` limb — a decapitation, on frame 1041
 * ```
 *
 * **Every argument is statically known**, so an interpreter would spend its
 * whole run computing the table below. Reading it out directly is the same
 * information by a shorter route, and it is testable in a way a stack machine
 * driving a live clip would not be.
 *
 * ► **WHAT WOULD CHANGE THE ANSWER, so a later reader can check rather than
 *   take this on faith:** a call whose arguments come from a variable, a
 *   conditional that decides WHETHER to call, or a spawn count that depends on
 *   the damage. None of the 32 sites has any of those. **The build-wide opcode
 *   surface is 58 distinct instructions**, so an interpreter is genuinely
 *   tractable here — it is just not what this particular job needs.
 *
 * ## What it emits
 *
 * One row per frame that spawns something, keyed by the frame number the
 * extracted animations already use, so `src/render/` can look it up with the
 * pose index it already has.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { analyseSwfBuffer } from "./inspect-swf.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

const DEFAULT_SWF =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";

const ORACLE_SHA256 = "77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca";

/** `hero_battle`, the fighter clip every gladiator is. */
const FIGHTER_CLIP = 1241;

/**
 * The spawner this reads. One name, because one is what the clip has — and a
 * closed list for the same reason `PROP_EXPORTS` is closed: a pattern would
 * sweep up `gotoAndPlay` and call it an effect.
 */
const SPAWNERS = Object.freeze(["bounceitem"]);

export class ExtractClipEffectsError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

export function parseArguments(argv) {
  const options = { file: null, out: path.join(REPO_ROOT, "assets", "props"), report: false };
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      const next = argv[index + 1];
      if (typeof next !== "string" || next.startsWith("--")) {
        throw new ExtractClipEffectsError("--out needs a directory path.");
      }
      options.out = next;
      index += 1;
    } else if (value === "--report") {
      options.report = true;
    } else if (value.startsWith("--")) {
      throw new ExtractClipEffectsError(`Unknown option ${value}.`);
    } else {
      rest.push(value);
    }
  }
  options.file = rest[0] ?? DEFAULT_SWF;
  return options;
}

/**
 * Reads one `CallFunction` back to the `Push` that set up its arguments.
 *
 * AVM1 calls are `Push arg1 … argN, argc, name` then `CallFunction`, and this
 * build emits the whole set-up as ONE `Push` with a list of operands — so the
 * arguments are the operands before the count, in order.
 *
 * **Returns null the moment anything is not a literal**, which is the guard
 * that makes this a derivation rather than a guess: a call assembled from
 * variables reaches here as a `Push` that does not carry them, and this reports
 * it as dynamic instead of inventing constants for it.
 */
export function argumentsOfCall(instruction) {
  if (!instruction || instruction.name !== "Push" || !Array.isArray(instruction.operand)) return null;
  const operands = instruction.operand;
  if (operands.length < 2) return null;
  const name = operands[operands.length - 1];
  const count = operands[operands.length - 2];
  // ► **A NAME IS A `string` OR A `constant`, AND READING ONLY THE FIRST MISSES
  //   NEARLY EVERYTHING.** This build interns almost every identifier in a
  //   `ConstantPool`, so a `Push` carries `{type: "constant", index, value}`
  //   where a naive reader expects `{type: "string"}`. The first version of
  //   this rejected 28 of 32 call sites as "not all literals" for exactly that
  //   reason — they were literals, in the pool.
  const isText = (operand) => operand?.type === "string" || operand?.type === "constant";
  if (!isText(name) || count?.type !== "integer") return null;
  const args = operands.slice(0, operands.length - 2);
  // The push must carry EXACTLY the declared number of arguments. Fewer means
  // the rest came from somewhere this cannot see.
  if (args.length !== count.value) return null;
  // ► **AVM1 POPS ARGUMENTS IN REVERSE, so the operand list is back to front.**
  //   `Push 15, "blood", 2, "bounceitem"` leaves "bounceitem" on top; the name
  //   pops first, then the count, then `"blood"` and then `15` — so the LAST
  //   operand pushed is the FIRST parameter. Reading it forwards gave
  //   `bounceitem(15, "blood")` and reported the prop name as a count.
  return { callee: name.value, args: args.map((operand) => operand.value).reverse() };
}

export function extractClipEffects(buffer) {
  const { analysis } = analyseSwfBuffer(buffer);
  const pattern = new RegExp(`^sprite:${FIGHTER_CLIP}/frame:(\\d+)/`);

  const frames = {};
  const dynamic = [];
  let calls = 0;

  for (const block of analysis.actionBlocks) {
    const match = pattern.exec(block.context);
    if (!match) continue;
    const frame = Number(match[1]);
    const instructions = block.instructions ?? [];
    for (let index = 0; index < instructions.length; index += 1) {
      if (instructions[index].name !== "CallFunction") continue;
      const call = argumentsOfCall(instructions[index - 1]);
      // A call whose set-up this cannot read is REPORTED, never skipped: an
      // effect that silently went missing would look exactly like a frame that
      // spawns nothing.
      if (!call) {
        const previous = instructions[index - 1];
        if (previous?.name === "Push" && previous.operand?.some?.((o) => SPAWNERS.includes(o.value))) {
          dynamic.push({ frame, reason: "arguments are not all literals" });
        }
        continue;
      }
      if (!SPAWNERS.includes(call.callee)) continue;
      calls += 1;
      const [item, count] = call.args;
      if (typeof item !== "string") {
        // `bounceitem(head, 1)` — the rig's own limb rather than a prop name.
        dynamic.push({ frame, reason: `first argument is not a prop name (${String(item)})` });
        continue;
      }
      (frames[frame] ??= []).push({ prop: item, count: Number(count) || 0 });
    }
  }

  return { clip: FIGHTER_CLIP, frames, dynamic, calls };
}

function main(argv) {
  const options = parseArguments(argv);
  if (!fs.existsSync(options.file)) {
    throw new ExtractClipEffectsError(
      `No SWF at ${options.file}. Pass the path to YOUR OWN installed copy; this repository ships none.`
    );
  }
  const buffer = fs.readFileSync(options.file);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  if (sha256 !== ORACLE_SHA256) {
    process.stdout.write(`NOTE: this build is ${sha256.slice(0, 16)}…, not the oracle ${ORACLE_SHA256.slice(0, 16)}…\n`);
  }

  const result = extractClipEffects(buffer);
  fs.mkdirSync(options.out, { recursive: true });
  fs.writeFileSync(path.join(options.out, "clip-effects.json"), JSON.stringify(result, null, 1));

  const frameNumbers = Object.keys(result.frames).map(Number).sort((a, b) => a - b);
  const lines = [
    `clip effects -> ${path.join(options.out, "clip-effects.json")}`,
    `  ${result.calls} call(s) across ${frameNumbers.length} frame(s) of clip ${result.clip}`,
    `  ${result.dynamic.length} call(s) this cannot read statically`
  ];
  if (options.report) {
    for (const frame of frameNumbers) {
      lines.push(`    frame ${String(frame).padStart(4)}  ${result.frames[frame].map((e) => `${e.prop} x${e.count}`).join(", ")}`);
    }
    for (const entry of result.dynamic) lines.push(`    ! frame ${entry.frame}: ${entry.reason}`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
