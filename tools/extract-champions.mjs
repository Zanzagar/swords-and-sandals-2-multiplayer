/**
 * THE TOURNAMENT CHAMPIONS — every branch of `unleash_hell(which_boss)`, out of
 * the player's own install and into gitignored `assets/champions/`.
 *
 * ## What the build does
 *
 * `unleash_hell` (root frame 35, `DoAction@0x3f8539`, `DefineFunction2` at
 * `+0x1812` on the oracle) is a flat run of `if (which_boss == N)` branches.
 * Each builds `_root.game.champion` as a fresh `Object` and writes its
 * `charDNA` and a few strings onto it; the function ends by making that object
 * the villain. `initcharacter` then decodes the DNA
 * (`src/team/ss2-champion-dna.js`) and `battlevalues` derives the rest
 * (`ss2BattleValues`). So a champion is fully determined by its branch.
 *
 * ## How this reads it — from the bytecode, not from a list
 *
 * 1. Find the ONE function named `unleash_hell`, anywhere in the file.
 * 2. Read its parameter's register, and its preloaded registers (`_root`,
 *    `_global`, ...), off the `DefineFunction2` header's flags.
 * 3. Walk the body's top level. Every `Push <param register>, <n>; Equals2;
 *    Not; If` is one branch: it runs from the `If` to the `If`'s target. The
 *    branch count, the `which_boss` values and the branch ends all come from
 *    there — there is no offset table and no count anywhere in this file.
 * 4. Evaluate each branch SYMBOLICALLY over the handful of instructions an
 *    assignment is made of (`Push`, `GetMember`, `SetMember`, `NewObject`,
 *    `Add2`, `GetVariable`). **Any other instruction is a refusal**, naming the
 *    branch and the offset: a `RandomNumber` or a call inside a branch would
 *    make that champion something other than a literal, and a reader that
 *    stepped over it would call a rolled champion fixed.
 * 5. Accept ONLY the build's own shape, and refuse everything else at its
 *    offset (five Codex passes, 2026-09-23, each reproduced before its fix):
 *    the parameter and `_root` registers are distinct, non-zero, inside the
 *    declared count and never written (`assertRegistersHold`);
 *    every statement leaves the stack empty; every path is the preloaded
 *    `_root` register plus identifier keys, compared as a KEY LIST and never
 *    as text; each branch first makes `_root.game.champion = new Object()` and
 *    then only writes its members; and outside the branches there is exactly
 *    one statement, `_root.game.villain = _root.game.champion`, after them all.
 *
 * The build is whatever the player passes — a modded copy is legitimate — so a
 * shape this reader does not model is a refusal, never a quietly wrong pack.
 *
 * ## What it found on the oracle, and it is not "eighteen literals"
 *
 * The dump of the oracle (read by the implementing agent 2026-09-23; this file
 * has never been run against the install by that agent — the main session
 * runs it) shows NINETEEN branches, `which_boss` 0 to 18, of which EIGHTEEN
 * write a literal `charDNA`. **`which_boss` 17 writes `_global.heroDNA`** — the
 * hero's own DNA — and names itself a literal prefix `+ _root.game.hero.character_name`:
 * a mirror of whoever is playing. It has no DNA of its own to extract, and this
 * tool records it with `dna: null` and `dnaFrom: "_global.heroDNA"` rather than
 * inventing one.
 *
 * ## What leaves the repository
 *
 * NOTHING of the build's. The pack (`champions.json`) holds each branch's DNA,
 * name, quote and hat name, and is written only under the gitignored
 * `assets/` (the Doom/WAD rule, `assets/README.md`). The manifest beside it is
 * numbers and offsets only. The repository carries this reader and the index
 * map (`src/team/ss2-champion-dna.js`), never a champion.
 *
 * Usage:
 *   node tools/extract-champions.mjs [path/to/swords_sandals2_download.swf] [--out dir]
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { analyseSwfBuffer } from "./inspect-swf.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The same default every other tool that reads the build uses. */
export const DEFAULT_SWF =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";

/** The oracle's sha256. Recorded and REPORTED — never enforced. */
export const ORACLE_SHA256 = "77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca";

/** The function this tool reads, and the field count `initcharacter` decodes (indices 0-49). */
const FUNCTION_NAME = "unleash_hell";
const DNA_FIELDS = 50;

export class ExtractChampionsError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

const hex = (value, width = 4) => `0x${Number(value).toString(16).padStart(width, "0")}`;

/* ───────────────────────────  finding the function  ──────────────────────── */

function* walk(instructions, context) {
  for (const instruction of Array.isArray(instructions) ? instructions : []) {
    yield { instruction, context };
    const operand = instruction.operand;
    if (instruction.name === "DefineFunction2" || instruction.name === "DefineFunction") {
      yield* walk(operand?.body, context);
    } else if (instruction.name === "With") {
      yield* walk(operand?.body, context);
    } else if (instruction.name === "Try") {
      for (const entry of operand?.bodies ?? []) yield* walk(entry.body, context);
    }
  }
}

function functionsNamed(analysis, wanted) {
  const found = [];
  for (const block of analysis.actionBlocks) {
    for (const { instruction } of walk(block.instructions, block.context)) {
      if (instruction.name !== "DefineFunction2" && instruction.name !== "DefineFunction") continue;
      if (instruction.operand?.name === wanted) found.push({ instruction, block });
    }
  }
  return found;
}

/**
 * The registers a `DefineFunction2` preloads, in the order AVM1 allocates
 * them from register 1: `this` (flag 0x01), `arguments` (0x04), `super`
 * (0x10), `_root` (0x40), `_parent` (0x80), `_global` (0x100). On the oracle
 * `unleash_hell` has flags 0x16a — this, arguments and super suppressed — so
 * `_root` is register 1 and `_global` register 2.
 */
export function preloadedRegisters(flags) {
  const order = [[0x01, "this"], [0x04, "arguments"], [0x10, "super"], [0x40, "_root"], [0x80, "_parent"], [0x100, "_global"]];
  const registers = {};
  let next = 1;
  for (const [bit, name] of order) {
    if ((Number(flags) & bit) !== 0) registers[next++] = name;
  }
  return registers;
}

/* ───────────────────────────  the symbolic reader  ───────────────────────── */

function operandValue(operand, registers) {
  if (operand.type === "register") {
    return { kind: "register", register: operand.value, name: registers[operand.value] ?? `register:${operand.value}` };
  }
  if (operand.type === "string" || operand.type === "constant") {
    if (typeof operand.value !== "string") return null;
    return { kind: "literal", value: operand.value };
  }
  if (["integer", "double", "float"].includes(operand.type) && Number.isFinite(operand.value)) {
    return { kind: "literal", value: operand.value };
  }
  if (operand.type === "boolean" || operand.type === "null") return { kind: "literal", value: operand.value };
  return null;
}

/** The keys a path may use: a plain identifier, so no key can contain a dot. */
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** One member key as source text: `.key` for an identifier, `["a.b"]` for anything else. */
const keyText = (key) => (IDENTIFIER.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`);

/**
 * A symbolic value as the source expression it stands for — for MESSAGES and
 * for the pack's `dnaFrom`, never for deciding what a path is (`pathOf` does
 * that). A key that is not an identifier renders in brackets, so
 * `_root["game.champion"]` and `_root.game.champion` no longer read alike, and
 * a root looked up by name renders as the lookup it is.
 */
export function expressionOf(value) {
  switch (value?.kind) {
    case "literal": return typeof value.value === "string" ? JSON.stringify(value.value) : String(value.value);
    case "register": return value.name;
    case "variable": return `GetVariable(${expressionOf(value.name)})`;
    case "member":
      return value.name.kind === "literal" && typeof value.name.value === "string"
        ? `${expressionOf(value.object)}${keyText(value.name.value)}`
        : `${expressionOf(value.object)}[${expressionOf(value.name)}]`;
    case "new": return `new ${value.ctor}(${(value.args ?? []).map(expressionOf).join(", ")})`;
    case "add": return `${expressionOf(value.left)} + ${expressionOf(value.right)}`;
    default: return "?";
  }
}

/**
 * A value as a STRUCTURAL path — the register it starts from and the literal
 * keys read from it, in order — or `null` when it is not a chain of literal
 * member reads from a register.
 *
 * ► **PATHS ARE COMPARED AS STRUCTURES, NEVER AS RENDERED TEXT (fourth Codex
 *   pass, 2026-09-23).** The reader used to compare `expressionOf` strings, and
 *   `_root["game.champion"]` (one key, holding a dot) rendered exactly as
 *   `_root.game.champion` (two keys) — so a branch that made the first and
 *   wrote its DNA through the second extracted fifty fields with
 *   `failures: []`. A `GetVariable("_root")` rendered as the preloaded
 *   register did too. Reproduced before it was fixed.
 */
function pathOf(value) {
  if (value?.kind === "register") return { register: value.register, keys: [] };
  if (value?.kind === "member" && value.name.kind === "literal" && typeof value.name.value === "string") {
    const parent = pathOf(value.object);
    return parent === null ? null : { register: parent.register, keys: [...parent.keys, value.name.value] };
  }
  return null;
}

const sameKeys = (a, b) => a.length === b.length && a.every((key, index) => key === b[index]);

/**
 * The ONLY paths this reader accepts as a write target or as the tail's
 * value: the preloaded `_root` register, then identifier keys. And of those,
 * exactly these three shapes — the build's, and nothing it would have to
 * reason about.
 */
const CHAMPION_KEYS = Object.freeze(["game", "champion"]);
const VILLAIN_KEYS = Object.freeze(["game", "villain"]);

/**
 * Evaluates a straight run of instructions and returns the assignments it
 * makes. `where` labels every refusal, so a failure names the branch.
 */
function assignmentsIn(instructions, registers, where, base) {
  const stack = [];
  const assignments = [];
  const at = (instruction) => `+${hex(instruction.offset - base)}`;
  const pop = (instruction) => {
    if (stack.length === 0) {
      throw new ExtractChampionsError(`${where}: ${instruction.name} at ${at(instruction)} pops an empty stack.`);
    }
    return stack.pop();
  };
  for (const instruction of instructions) {
    switch (instruction.name) {
      case "Push":
        for (const operand of instruction.operand ?? []) {
          const value = operandValue(operand, registers);
          if (value === null) {
            throw new ExtractChampionsError(
              `${where}: a ${operand.type} operand at ${at(instruction)} is not one this reader can name.`
            );
          }
          stack.push(value);
        }
        break;
      case "GetMember": {
        const name = pop(instruction);
        const object = pop(instruction);
        stack.push({ kind: "member", object, name });
        break;
      }
      case "GetVariable":
        stack.push({ kind: "variable", name: pop(instruction) });
        break;
      case "SetMember": {
        const value = pop(instruction);
        const name = pop(instruction);
        const object = pop(instruction);
        if (name.kind !== "literal" || typeof name.value !== "string") {
          throw new ExtractChampionsError(`${where}: the member written at ${at(instruction)} is computed, not named.`);
        }
        assignments.push({ object, member: name.value, value, offset: instruction.offset });
        // ► **EVERY STATEMENT STANDS ALONE (third Codex pass, 2026-09-23).** A
        //   member read is tracked as its PATH, not as the object that path
        //   named at that moment — so operands kept on the stack across another
        //   assignment would be written through a path that now names something
        //   else. Pushing the old champion, `"charDNA"` and the DNA, making and
        //   assigning the fresh champion, and only then consuming the three
        //   read as "new Object() first, then charDNA" while the DNA landed on
        //   the old object. Reproduced before it was fixed. The build's
        //   statements each leave the stack empty; one that does not is
        //   refused here rather than given an identity model. (`SetVariable`,
        //   the other store, is refused outright by the default arm below.)
        if (stack.length > 0) {
          throw new ExtractChampionsError(
            `${where}: SetMember at ${at(instruction)} leaves ${stack.length} value(s) on the stack for a later ` +
            "statement to consume, so what that statement writes through was read before this one ran. Every " +
            "statement in the build stands alone; this one does not, and is refused."
          );
        }
        break;
      }
      case "NewObject": {
        const ctor = pop(instruction);
        const count = pop(instruction);
        if (ctor.kind !== "literal" || count.kind !== "literal" || !Number.isInteger(count.value)) {
          throw new ExtractChampionsError(`${where}: the NewObject at ${at(instruction)} is not a literal constructor call.`);
        }
        // Arguments pop first-argument-first (AVM1 pushes them last-first).
        const args = [];
        for (let index = 0; index < count.value; index += 1) args.push(pop(instruction));
        stack.push({ kind: "new", ctor: ctor.value, args });
        break;
      }
      case "Add2": {
        const right = pop(instruction);
        const left = pop(instruction);
        stack.push({ kind: "add", left, right });
        break;
      }
      default:
        throw new ExtractChampionsError(
          `${where}: ${instruction.name} at ${at(instruction)} is not an instruction this reader can name. ` +
          "A champion branch is assignments of literals and nothing else; anything more would make the champion " +
          "something other than a literal, so it is refused rather than stepped over."
        );
    }
  }
  if (stack.length > 0) {
    throw new ExtractChampionsError(`${where}: leaves ${stack.length} value(s) on the stack, which no assignment consumed.`);
  }
  return assignments;
}

/**
 * ONE GUARD: `Push <param register>, <number>` / `Equals2` / `Not` / `If`.
 *
 * The compiler emits `if (!(which_boss == n)) jump past`, so the guarded
 * region is `(the If, the If's target)`. The `Not` is load-bearing: without
 * it the sense of every branch inverts.
 */
function matchGuard(body, index, register) {
  const [push, compare, negate, jump] = body.slice(index, index + 4);
  if (push?.name !== "Push" || !Array.isArray(push.operand) || push.operand.length !== 2) return null;
  const [subject, number] = push.operand;
  if (subject.type !== "register" || subject.value !== register) return null;
  if (!["integer", "double", "float"].includes(number.type) || !Number.isInteger(number.value)) return null;
  if (compare?.name !== "Equals2" || negate?.name !== "Not" || jump?.name !== "If") return null;
  if (!(jump.operand?.target > jump.offset)) return null;
  return { whichBoss: number.value, push, jump, target: jump.operand.target };
}

/**
 * The function's OWN instructions, into `With` and `Try` bodies (same register
 * frame) but never into a nested function, whose registers are its own.
 */
function* ownInstructions(instructions) {
  for (const instruction of Array.isArray(instructions) ? instructions : []) {
    yield instruction;
    if (instruction.name === "With") yield* ownInstructions(instruction.operand?.body);
    else if (instruction.name === "Try") {
      for (const entry of instruction.operand?.bodies ?? []) yield* ownInstructions(entry.body);
    }
  }
}

/**
 * THE REGISTERS THIS READER TRUSTS MUST HOLD WHAT IT THINKS THEY HOLD, for the
 * whole of the function — checked before a single branch is read.
 *
 * ► **FOUND BY A FIFTH CODEX PASS (2026-09-23), AND THE WHOLE CLASS IS CLOSED,
 *   NOT THE ONE INSTANCE.** With the parameter and its guards moved into the
 *   register the header preloads with `_root`, every champion was accepted
 *   with `failures: []` — but the parameters are assigned AFTER the preloads
 *   (Ruffle `core/src/avm1/function.rs`, cited by the review; not re-read
 *   here), so that register holds the boss number and every "`_root`" write
 *   lands on a number. Reproduced before it was fixed. Refused, in turn:
 *   - the parameter in register 0, DefineFunction2's "not in a register";
 *   - the parameter in any register a preload also claims;
 *   - the parameter or any preload in a register past the header's declared
 *     register count;
 *   - anything in the function's own body that WRITES the `_root` register or
 *     the parameter's register: `StoreRegister`, or a `Try` that catches into
 *     one. Such a write is refused wherever it sits, because it would change
 *     what every later guard or path read means.
 */
function assertRegistersHold({ definition, parameter, preloads, rootRegister, body, context, rel }) {
  const refuse = (message) => {
    throw new ExtractChampionsError(`${FUNCTION_NAME} at ${context}: ${message}`);
  };
  if (parameter.register === 0) {
    refuse(
      `its parameter ${parameter.name} is in register 0, which DefineFunction2 uses for "not in a register" — ` +
      "the parameter is a named variable, and no guard on a register can be testing it."
    );
  }
  if (rootRegister === 0) refuse("its _root preload is in register 0, which no preload can occupy.");
  if (Object.hasOwn(preloads, parameter.register)) {
    refuse(
      `its parameter ${parameter.name} is in register ${parameter.register}, which the header also preloads with ` +
      `${preloads[parameter.register]}. The parameters are assigned after the preloads, so that register holds the ` +
      "boss number and nothing this reader would read through it is what it looks like."
    );
  }
  const count = definition.registerCount;
  const used = [[parameter.register, parameter.name], ...Object.entries(preloads).map(([r, name]) => [Number(r), name])];
  for (const [register, name] of used) {
    if (Number.isInteger(count) && register >= count) {
      refuse(`${name} is in register ${register}, but the header declares ${count} registers (0-${count - 1}).`);
    }
  }
  const guarded = new Map([[rootRegister, "_root"], [parameter.register, parameter.name]]);
  guarded.delete(null);
  for (const instruction of ownInstructions(body)) {
    const written = instruction.name === "StoreRegister"
      ? instruction.operand?.register
      : instruction.name === "Try" ? instruction.operand?.catchTarget?.register : undefined;
    if (written !== undefined && guarded.has(written)) {
      refuse(
        `${instruction.name} at ${rel(instruction.offset)} writes register ${written}, which holds ` +
        `${guarded.get(written)}; every guard and every path this reader accepts relies on that register never ` +
        "changing, so this is refused wherever it sits."
      );
    }
  }
}

/* ─────────────────────────────  the extraction  ──────────────────────────── */

/**
 * Every branch of `unleash_hell` in `buffer` — a SWF already in memory. Nothing
 * here touches the filesystem.
 *
 * @returns {{ function: object, champions: object[], tail: object[], failures: object[] }}
 */
export function extractChampions(buffer) {
  const { analysis } = analyseSwfBuffer(buffer);
  const found = functionsNamed(analysis, FUNCTION_NAME);
  if (found.length === 0) {
    throw new ExtractChampionsError(
      `There is no ${FUNCTION_NAME} in this SWF, so it has no tournament champions to extract. ` +
      "Pass the path to your own Swords & Sandals II install."
    );
  }
  if (found.length > 1) {
    throw new ExtractChampionsError(
      `${found.length} functions named ${FUNCTION_NAME} (${found.map(({ block }) => block.context).join(", ")}). ` +
      "Which one the build calls is decided at run time by definition order, and this reader will not guess."
    );
  }
  const [{ instruction, block }] = found;
  const definition = instruction.operand;
  if (!Array.isArray(definition.parameters) || definition.parameters.length !== 1 ||
      !Number.isInteger(definition.parameters[0].register)) {
    throw new ExtractChampionsError(
      `${FUNCTION_NAME} at ${block.context} does not take exactly one parameter in a register, and every branch ` +
      "is keyed on that register."
    );
  }
  const parameter = definition.parameters[0];
  const preloads = preloadedRegisters(definition.flags);
  const base = block.offset;
  const rel = (offset) => `+${hex(offset - base)}`;
  // Every accepted path starts at THIS register: the one the header preloads
  // with `_root` (register 1 on the oracle). `null` when nothing preloads it,
  // and then every write is refused.
  const rootEntry = Object.entries(preloads).find(([, name]) => name === "_root");
  const rootRegister = rootEntry ? Number(rootEntry[0]) : null;
  const body = (definition.body ?? []).filter((entry) => entry.name !== "End");
  assertRegistersHold({ definition, parameter, preloads, rootRegister, body, context: block.context, rel });
  const registers = { ...preloads, [parameter.register]: parameter.name };
  const keysOf = (assignment, where) => targetKeys(assignment, rootRegister, where, rel);

  const champions = [];
  const failures = [];
  const outside = [];
  const firstSeen = new Map();
  let index = 0;
  while (index < body.length) {
    const guard = matchGuard(body, index, parameter.register);
    if (guard) {
      const at = rel(guard.push.offset);
      const where = `which_boss ${guard.whichBoss} (${at})`;
      if (firstSeen.has(guard.whichBoss)) {
        throw new ExtractChampionsError(
          `which_boss ${guard.whichBoss} is tested twice (${firstSeen.get(guard.whichBoss)} and ${at}); both branches ` +
          "would run, and which one wins is not a question this reader answers."
        );
      }
      firstSeen.set(guard.whichBoss, at);
      const region = body.filter((entry) => entry.offset > guard.jump.offset && entry.offset < guard.target);
      // Every branch must build on `_root.game.champion` itself (`championFrom`),
      // so every branch builds on the ONE object the tail makes the villain.
      const assignments = assignmentsIn(region, registers, where, base);
      champions.push(championFrom(assignments, guard.whichBoss, at, where, failures, rel, keysOf));
      index = body.findIndex((candidate) => candidate.offset >= guard.target);
      if (index === -1) index = body.length;
      continue;
    }
    // A statement outside every branch: read up to the next guard, and note
    // how many branches had run before it — it runs after exactly those.
    let end = index + 1;
    while (end < body.length && !matchGuard(body, end, parameter.register)) end += 1;
    for (const assignment of assignmentsIn(body.slice(index, end), registers, `${FUNCTION_NAME} outside its branches`, base)) {
      outside.push({ assignment, branchesBefore: champions.length });
    }
    index = end;
  }

  // ► **OUTSIDE THE BRANCHES, EXACTLY THE BUILD'S ONE TAIL — AND NOTHING THIS
  //   READER WOULD HAVE TO REASON ABOUT.** Every statement out here runs for
  //   EVERY champion. Two Codex passes (2026-09-23) found this loop too
  //   trusting, twice:
  //   1. it filed every outside statement under `tail` and changed nothing, so
  //      a trailing `_root.game.champion.charDNA = "…"` replaced every DNA at
  //      run time while the pack held the branches' own, `failures: []`;
  //   2. its replacement accepted any alias of the champion that did not write
  //      INTO it, so `_root.game = _root.game.champion` — which throws away the
  //      champion's PARENT, and `villain` with it — passed as well.
  //   Both were reproduced before they were fixed. So this no longer judges
  //   which writes are harmless: it accepts the build's own shape,
  //   `_root.game.villain = _root.game.champion` (`+0x2216`-`+0x222e` on the
  //   oracle) — both sides compared as STRUCTURAL paths (`pathOf`), made once
  //   and after every branch — and refuses anything else by offset.
  if (champions.length === 0) {
    throw new ExtractChampionsError(
      `${FUNCTION_NAME} at ${block.context} has no \`which_boss == n\` branch this reader recognises, so it names no champion.`
    );
  }
  const holder = pathText(CHAMPION_KEYS);
  const villain = pathText(VILLAIN_KEYS);
  const tail = [];
  for (const { assignment, branchesBefore } of outside) {
    const keys = keysOf(assignment, `${FUNCTION_NAME} outside its branches`);
    const value = pathOf(assignment.value);
    const isTheTail = sameKeys(keys, VILLAIN_KEYS) && value !== null && value.register === rootRegister &&
      sameKeys(value.keys, CHAMPION_KEYS) && branchesBefore === champions.length;
    if (!isTheTail) {
      throw new ExtractChampionsError(
        `${FUNCTION_NAME} runs ${statementText(assignment)} outside every branch (at ${rel(assignment.offset)}), so it ` +
        "runs for EVERY champion. The one statement this reader accepts there is the build's tail, " +
        `${villain} = ${holder}, after every branch; anything else could change what each branch built, ` +
        "so it is refused rather than recorded and ignored."
      );
    }
    tail.push({
      target: expressionOf(assignment.object), member: assignment.member,
      expression: expressionOf(assignment.value), offset: assignment.offset
    });
  }
  if (tail.length !== 1) {
    throw new ExtractChampionsError(
      tail.length === 0
        ? `${FUNCTION_NAME} never runs ${villain} = ${holder}, so the champion it builds is never made the ` +
          "villain; this is not the build's shape and nothing extracted from it would be fought."
        : `${FUNCTION_NAME} runs ${villain} = ${holder} ${tail.length} times ` +
          `(at ${tail.map((entry) => rel(entry.offset)).join(", ")}); the build runs it once.`
    );
  }
  for (const entry of tail) delete entry.offset;

  return {
    function: {
      name: FUNCTION_NAME,
      context: block.context,
      at: rel(instruction.offset),
      parameter: parameter.name,
      register: parameter.register,
      preloads
    },
    champions,
    tail,
    failures
  };
}

/** One assignment as source text, cut short: a DNA literal would otherwise fill the message. */
function statementText(assignment) {
  const clip = (text) => (text.length > 60 ? `${text.slice(0, 57)}...` : text);
  return `${expressionOf(assignment.object)}${keyText(assignment.member)} = ${clip(expressionOf(assignment.value))}`;
}

/** A validated key list as `_root.<key>...` text, for messages and the pack. */
const pathText = (keys) => `_root${keys.map(keyText).join("")}`;

/**
 * The key list an assignment WRITES, held to the one grammar this reader
 * accepts: reached from the preloaded `_root` register (`rootRegister`) by
 * literal keys, every key — the written member included — a plain identifier.
 * Anything else is refused at the assignment's offset: a computed key, a root
 * looked up by name, a key with a dot in it, a register that is not `_root`.
 */
function targetKeys(assignment, rootRegister, where, rel) {
  const base = pathOf(assignment.object);
  const at = rel(assignment.offset);
  if (base === null || rootRegister === null || base.register !== rootRegister) {
    throw new ExtractChampionsError(
      `${where}: runs ${statementText(assignment)} (at ${at}), whose target is not reached from the preloaded ` +
      "_root register by literal keys. This reader accepts only _root.<identifier>... paths, compared key by key, " +
      "so a computed key or a root looked up by name is refused rather than guessed at."
    );
  }
  const keys = [...base.keys, assignment.member];
  const odd = keys.find((key) => !IDENTIFIER.test(key));
  if (odd !== undefined) {
    throw new ExtractChampionsError(
      `${where}: runs ${statementText(assignment)} (at ${at}), whose key ${JSON.stringify(odd)} is not a plain ` +
      "identifier — one key holding a dot is not the path its text looks like, so it is refused."
    );
  }
  return keys;
}

/**
 * One branch's assignments as a champion — accepted ONLY in the build's own
 * shape: its FIRST statement is `<champion> = new Object()` with no argument,
 * and every statement after it writes one member of that object.
 *
 * ► **THE ORDER IS THE POINT (second Codex pass, 2026-09-23).** This used to
 *   find the creation anywhere in the branch, so a branch that wrote its
 *   members FIRST and made the object after still reported that name and DNA —
 *   which at run time are discarded with the old object. Reproduced before it
 *   was fixed. Refusing the shape rather than modelling object identity keeps
 *   this reader small enough to trust.
 */
function championFrom(assignments, whichBoss, at, where, failures, rel, keysOf) {
  const holder = pathText(CHAMPION_KEYS);
  const [created, ...writes] = assignments;
  const fresh = created !== undefined && created.value.kind === "new" && created.value.ctor === "Object" &&
    created.value.args.length === 0;
  if (!fresh) {
    throw new ExtractChampionsError(
      `${where}: ` +
      (created === undefined
        ? "writes nothing"
        : `its first statement is ${statementText(created)} (at ${rel(created.offset)})`) +
      `, where every branch of the build begins ${holder} = new Object() and only then writes its members; ` +
      "a member written before the object is made is lost when it is made, so this shape is refused."
    );
  }
  // ► **THE CHAMPION IS `_root.game.champion`, KEY BY KEY** (fourth Codex
  //   pass): the object this branch makes, and every object it writes to, are
  //   compared as key lists — never as text, which let `_root["game.champion"]`
  //   pass for `_root.game.champion`.
  const createdKeys = keysOf(created, where);
  if (!sameKeys(createdKeys, CHAMPION_KEYS)) {
    throw new ExtractChampionsError(
      `${where}: makes ${pathText(createdKeys)} (at ${rel(created.offset)}), where the build's champion is always ` +
      `${holder} — the one object its tail makes the villain — so this is refused.`
    );
  }
  const members = {};
  for (const assignment of writes) {
    const keys = keysOf(assignment, where);
    const ontoChampion = keys.length === CHAMPION_KEYS.length + 1 && sameKeys(keys.slice(0, -1), CHAMPION_KEYS);
    if (!ontoChampion || assignment.value.kind === "new") {
      throw new ExtractChampionsError(
        `${where}: runs ${statementText(assignment)} (at ${rel(assignment.offset)}) after making ${holder}; a branch ` +
        `of the build only writes members of the object it just made, with literals, so this is refused.`
      );
    }
    members[assignment.member] = assignment.value.kind === "literal" && typeof assignment.value.value === "string"
      ? { literal: assignment.value.value }
      : { expression: expressionOf(assignment.value) };
  }
  const literal = (member) => members[member]?.literal ?? null;

  let dna = null;
  let dnaFrom = null;
  const written = members.charDNA;
  if (written === undefined) {
    failures.push({ whichBoss, at, reason: "the branch writes no charDNA, so there is nothing to decode" });
  } else if (written.literal !== undefined) {
    dnaFrom = "literal";
    // `initcharacter` `+0x05e0`: `DNA.split(",")`, and nothing else.
    const split = written.literal.split(",");
    if (split.length === DNA_FIELDS) dna = split;
    else {
      failures.push({
        whichBoss,
        at,
        reason: `charDNA splits into ${split.length} fields where initcharacter reads ${DNA_FIELDS} (indices 0-49); ` +
          "a comma inside a text field shifts every index after it, so this DNA is not decoded"
      });
    }
  } else {
    dnaFrom = written.expression;
  }
  return {
    whichBoss,
    at,
    holder,
    dnaFrom,
    dna,
    name: literal("character_name"),
    quote: literal("character_quote"),
    hatName: literal("hat_name"),
    members
  };
}

/* ─────────────────────────────  pack and manifest  ───────────────────────── */

const EXTRACTED_FROM =
  "unleash_hell(which_boss): one champion per `Push <which_boss register>, n; Equals2; Not; If` branch, each " +
  "branch evaluated symbolically; dna is the branch's charDNA literal split on \",\" exactly as initcharacter " +
  "splits it (+0x05e0), and is decoded by src/team/ss2-champion-dna.js";

/** The pack a player's arena reads. It holds the build's text, so it lives ONLY under gitignored assets/. */
export function packFor(extraction, { source, sha256 }) {
  return {
    source,
    sha256,
    oracleSha256: ORACLE_SHA256,
    matchesOracle: sha256 === ORACLE_SHA256,
    extractedFrom: EXTRACTED_FROM,
    function: extraction.function,
    champions: extraction.champions,
    tail: extraction.tail,
    failures: extraction.failures
  };
}

/**
 * The manifest a human reads, RECOMPUTED from the champions (the defect
 * `test/extraction-honesty.test.js` exists for is a tally written beside the
 * data instead of out of it). Numbers and offsets only — no name, quote or
 * DNA of the build's.
 */
export function buildManifest(extraction, { source, sha256 }) {
  const champions = extraction.champions.map((entry) => ({
    whichBoss: entry.whichBoss,
    at: entry.at,
    dnaFrom: entry.dnaFrom === "literal" || entry.dnaFrom === null ? entry.dnaFrom : `computed: ${entry.dnaFrom}`,
    fields: Array.isArray(entry.dna) ? entry.dna.length : null
  }));
  return {
    source,
    sha256,
    oracleSha256: ORACLE_SHA256,
    matchesOracle: sha256 === ORACLE_SHA256,
    extractedFrom: EXTRACTED_FROM,
    function: extraction.function,
    totals: {
      branches: champions.length,
      literalDna: extraction.champions.filter((entry) => Array.isArray(entry.dna)).length,
      computedDna: extraction.champions.filter((entry) => entry.dnaFrom !== null && entry.dnaFrom !== "literal").length,
      failures: extraction.failures.length
    },
    champions,
    tail: extraction.tail,
    failures: extraction.failures.map(({ whichBoss, at, reason }) => ({ whichBoss, at, reason }))
  };
}

/* ─────────────────────────────────  the CLI  ─────────────────────────────── */

export function parseArguments(argv) {
  const options = { file: null, out: path.join(REPO_ROOT, "assets", "champions") };
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      const next = argv[index + 1];
      if (typeof next !== "string" || next.startsWith("--")) {
        throw new ExtractChampionsError("--out needs a directory path.");
      }
      options.out = next;
      index += 1;
    } else if (value.startsWith("--")) {
      throw new ExtractChampionsError(`Unknown option ${value}.`);
    } else {
      rest.push(value);
    }
  }
  options.file = rest[0] ?? DEFAULT_SWF;
  return options;
}

export function summaryLines(manifest, out) {
  const computed = manifest.champions.filter((entry) => entry.dnaFrom?.startsWith("computed"));
  const lines = [
    `champions: ${manifest.totals.branches} branches of ${manifest.function.name} (${manifest.function.context} ` +
      `${manifest.function.at}) — ${manifest.totals.literalDna} literal DNA, ${manifest.totals.computedDna} computed, ` +
      `${manifest.totals.failures} failures`,
    `  which_boss: ${manifest.champions.map((entry) => entry.whichBoss).join(", ")}`
  ];
  for (const entry of computed) lines.push(`  which_boss ${entry.whichBoss} has no DNA of its own: ${entry.dnaFrom}`);
  for (const failure of manifest.failures) lines.push(`  ! which_boss ${failure.whichBoss} (${failure.at}): ${failure.reason}`);
  lines.push(`wrote ${path.join(out, "champions.json")} and manifest.json — gitignored; never commit them`);
  return lines;
}

export function main(argv, { write = (line) => process.stdout.write(`${line}\n`) } = {}) {
  const options = parseArguments(argv);
  if (!fs.existsSync(options.file)) {
    throw new ExtractChampionsError(
      `No SWF at ${options.file}. Pass the path to YOUR OWN installed copy; this repository ships none.`
    );
  }
  const buffer = fs.readFileSync(options.file);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  if (sha256 !== ORACLE_SHA256) {
    write(
      `NOTE: this build is ${sha256.slice(0, 16)}…, not the oracle ${ORACLE_SHA256.slice(0, 16)}…\n` +
      "      That is legitimate; what is not is treating the output as evidence about the oracle."
    );
  }
  const extraction = extractChampions(buffer);
  const source = path.basename(options.file);
  const manifest = buildManifest(extraction, { source, sha256 });
  fs.mkdirSync(options.out, { recursive: true });
  fs.writeFileSync(path.join(options.out, "champions.json"), JSON.stringify(packFor(extraction, { source, sha256 }), null, 1));
  fs.writeFileSync(path.join(options.out, "manifest.json"), JSON.stringify(manifest, null, 1));
  for (const line of summaryLines(manifest, options.out)) write(line);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
