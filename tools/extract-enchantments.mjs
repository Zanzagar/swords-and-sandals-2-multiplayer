/**
 * THE WEAPON ENCHANTMENT SELECTOR — the function that picks the glow, the glow
 * it picks, and the rules the glow stands for, all READ OUT OF THE BYTES.
 *
 * ## The thing HANDOFF.md records as missing, and why it was missed
 *
 * The living head says the selector *"HAS NOT BEEN FOUND ... `weapon0` is
 * character 703 with flame/frost/poison/wraith at frames 2/5/8/11, the
 * resources exist, and `updatecharacter` contains no `gotoAndStop` at all."*
 *
 * **That last clause is TRUE, re-derived here, and it is exactly why the search
 * failed.** `updatecharacter` does not select the glow. Its neighbour on the
 * same root frame 35 DoAction, `skincharacter`, calls a THIRD function —
 * `itemglow(whichitem, enchant_type, enchant_potency)` — and that one is a
 * twelve-arm ladder of `whichitem.gotoAndStop(N)`. `updatecharacter`'s job is
 * the other half: `<fighter>.weapon.realweapon.attachMovie("weapon" + id, …)`
 * puts the blade INSIDE the glow shell. Two functions, two clips, one
 * instance — and grepping the wrong one of the two returns nothing four times
 * in a row.
 *
 * ## What is derived here, and from which bytes
 *
 *   the ladder      `itemglow`'s `DefineFunction2` body, pattern-matched
 *                   instruction by instruction.  NOTHING about the twelve rows
 *                   is written in this file; see `deriveLadder`.
 *   the art         sprite `weapon0` re-flattened at each of its own frames,
 *                   recording the filter list that encloses `realweapon`.
 *                   See `deriveArt`.
 *   the names       the build's OWN `weaponenchantments` array, plus the four
 *                   shop buttons, plus the status flags `damagecharacter` sets.
 *                   Three witnesses, compared rather than merged.
 *   the rules       proc chance and enchantment damage, quoted with offsets and
 *                   NOT implemented.  See `deriveRules`.
 *
 * ## THE JOIN THAT MAKES IT ONE FINDING, AND IT IS THE POINT OF THE FILE
 *
 * The ladder and the art come from byte regions that have nothing to do with
 * each other — an AVM1 function body inside a root `DoAction`, and a run of
 * `PlaceObject3` filter lists inside a `DefineSprite`. So they can be made to
 * AGREE OR DISAGREE, and `crossCheck` below makes them: the frames the ladder
 * assigns to one enchantment type must be exactly the frames that carry one
 * glow COLOUR, and the potency order the ladder gives must be the order the
 * blur radii grow in. Neither half is derived from the other, so the agreement
 * is evidence. `test/extract-enchantments.test.js` recomputes both halves from
 * the emitted pack and fails if they part company.
 *
 * ► **WHAT THAT CHECK IS NOT.** It cannot tell you that Flame is the gold one:
 *   nothing in a filter record says "flame". It tells you that WHATEVER type 2
 *   is, its three frames are the three gold ones and its blur grows with
 *   potency. The NAME comes from a different witness entirely — the build's own
 *   `weaponenchantments` array — and this tool reports the two side by side
 *   rather than folding one into the other.
 *
 * ## WHAT THIS TOOL DOES NOT DO
 *
 * - **It does not implement a single game rule.** The proc chance and the
 *   damage formula are RECORDED, with the offsets they were read from, because
 *   they are evidence about the art's meaning. `src/` is where a rule gets
 *   implemented, against the fixture corpus, never from a tool's JSON.
 * - **It does not emit the weapon art.** `realweapon` is an EMPTY shell at
 *   author time: `updatecharacter` and `damagecharacter` both call
 *   `<fighter>.weapon.realweapon.attachMovie("weapon" + <id>, …)` at runtime.
 *   The only shape inside it in the file is the placeholder. Naming that is the
 *   honest answer; exporting the placeholder as "the weapon" would not be.
 * - **It writes ONE file.** `assets/figure/` already holds `manifest.json` from
 *   `tools/extract-figure.mjs`, so a second tool writing `manifest.json` there
 *   would silently destroy the figure pack's invoice. Everything this tool has
 *   to say, invoice included, is in `enchantments.json`.
 *
 * ## The rule every extractor here obeys
 *
 * **Assets come out of the player's own install and never into the repository.**
 * `assets/` is gitignored AND `test/asset-attestation.test.js` fails if anything
 * under it is tracked. Doom/WAD model: clone this repo and you still need your
 * own licensed copy.
 *
 * Usage:
 *
 *   node tools/extract-enchantments.mjs --report
 *   node tools/extract-enchantments.mjs "<your swords_sandals2_download.swf>" --out <dir>
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { indexCharacters, resolveTimeline, flattenFrame } from "./swf-display-list.mjs";
import { analyseSwfBuffer } from "./inspect-swf.mjs";
// THE READER, IMPORTED SO THE INVOICE IS THE READER'S OWN VERDICT — the same
// arrangement `tools/extract-props.mjs` gives its reason for at `effectSummaryFor`:
// what this pack can say about a filter is exactly what `canvasFilterFor` does
// with it, so "the pack carries it" and "the renderer can draw it" cannot drift
// while both stay green.
import { blendModeFor, canvasFilterFor, summariseFilterUse } from "../src/render/filters.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The same default every other tool that reads the build uses. */
export const DEFAULT_SWF =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";

/** The oracle's sha256. Recorded and REPORTED — never enforced. */
export const ORACLE_SHA256 = "77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca";

export class ExtractEnchantmentsError extends Error {}

/**
 * THE ONLY NAMES THIS FILE SPELLS, and each one is a SEARCH KEY rather than an
 * answer.
 *
 * ► **NOTHING HERE IS A RESULT.** `"itemglow"` says which function to walk; the
 *   twelve rows come out of its bytes. `"weaponenchantments"` says which array
 *   literal to read; the four names come out of its operands. If a key is
 *   wrong, the derivation REFUSES by name and emits nothing — which is the
 *   failure mode this project wants, as against a table that is right for three
 *   enchantments out of four.
 *
 * ► **AND THE ART CLIP IS NOT IN THIS LIST ON PURPOSE.** `weapon0` / character
 *   703 would have been the obvious constant and it is derived instead: the
 *   callers pass `<fighter>.weapon`, so `deriveArt` reads the member name off
 *   the call sites, finds every INSTANCE of that name in the build, and refuses
 *   unless they all resolve to one character. That is the join from the
 *   selector to the art, measured; `703` pasted here would have been the join
 *   assumed.
 */
export const SEARCH_KEYS = Object.freeze({
  selector: "itemglow",
  /** The array the build itself indexes by `weapon_enchantment_type`. */
  typeNames: "weaponenchantments",
  /** And the one it indexes by `weapon_enchantment_potency`. */
  potencyNames: "weaponenchantments_potency",
  /** The function that turns a landed blow into a status flag. */
  damage: "damagecharacter",
  /** The function that derives a fighter's combat numbers from their kit. */
  values: "battlevalues",
  /** The variable the shop's four buttons write. */
  shopVariable: "enchant_type",
  /** The prefix the shop's highlighted icons share. */
  shopIconPrefix: "icon_"
});

const hex = (value) => `0x${Number(value).toString(16)}`;

/**
 * COUNT SOMETHING THIS EXTRACTION COULD NOT CARRY, BY NAME.
 *
 * Same contract as `refuse` in `tools/extract-props.mjs`: every drop in this
 * file goes through here, so `invoice.notCarried` is the complete list of what
 * the pack knows about and does not say. If you add a drop, it goes through
 * here or that sentence becomes a lie — which is precisely how the props
 * extractor lost its headline.
 */
function refuse(notCarried, kind, howMany = 1) {
  notCarried[kind] = (notCarried[kind] ?? 0) + howMany;
}

/* ─────────────────────────────  reading AVM1  ────────────────────────────── */

/**
 * Walks a decoded action tree, including every function, `with` and `try` body.
 *
 * Duplicated rather than imported from `tools/extract-icons.mjs` for the reason
 * `roundMatrix` is duplicated across three extractors: each tool stays runnable
 * on its own. This copy differs from that one in descending into `Try` bodies
 * as well, which that one does not need and this one gets for free.
 */
export function* walkInstructions(instructions, context = "") {
  for (const instruction of Array.isArray(instructions) ? instructions : []) {
    yield { instruction, context };
    const operand = instruction.operand;
    if (instruction.name === "DefineFunction2" || instruction.name === "DefineFunction") {
      yield* walkInstructions(operand?.body, `${context}/fn:${operand?.name || "<anonymous>"}`);
    } else if (instruction.name === "With") {
      yield* walkInstructions(operand?.body, `${context}/with`);
    } else if (instruction.name === "Try") {
      for (const entry of operand?.bodies ?? []) yield* walkInstructions(entry.body, `${context}/${entry.kind}`);
    }
  }
}

/** A `Push`'s operand list, or `null` for any other instruction. */
function pushOperands(instruction) {
  return instruction?.name === "Push" && Array.isArray(instruction.operand) ? instruction.operand : null;
}

/**
 * ► **A CONSTANT-POOL OPERAND ALREADY CARRIES ITS STRING, and indexing a pool
 *   array by `.index` is the wrong turn this file exists partly to record.**
 *   `parsePushValues` in `tools/inspect-swf.mjs` resolves the pool at decode
 *   time and writes the string onto `value`, because the pool that was live
 *   when an instruction was decoded is not recoverable later — a
 *   `DefineFunction2` body inherits a COPY of the pool that was current at its
 *   definition, and a second `ConstantPool` later in the same block replaces
 *   it. So `value` is the only correct read, and `index` is a decoding detail.
 */
const literalOf = (operand) => (operand === undefined || operand === null ? undefined : operand.value);
const isNumberLiteral = (operand) =>
  operand !== undefined && operand !== null &&
  (operand.type === "integer" || operand.type === "double" || operand.type === "float") &&
  Number.isFinite(operand.value);
const isStringLiteral = (operand) =>
  operand !== undefined && operand !== null && (operand.type === "string" || operand.type === "constant") &&
  typeof operand.value === "string";

/**
 * THE ARGUMENTS OF A `new Array(…)` OR A `CallFunction`, IN SOURCE ORDER.
 *
 * ► **AVM1 PUSHES ARGUMENTS BACKWARDS, and a reader that forgets reverses every
 *   table it builds.** The wire form is `argN … arg1, argc, callee`, because
 *   `arg1` has to be on top of the stack when the callee pops it first. So
 *   `new Array("", "", "Flame", "Frost", "Poison", "Wraith")` is compiled to a
 *   single `Push` reading `Wraith, Poison, Frost, Flame, "", "", 6, "Array"`,
 *   and an implementation that took the operands in order would report
 *   `weaponenchantments[2]` as "Frost" — an off-by-reversal that makes flame
 *   frozen and frost poisonous while still looking like a table.
 *
 * Returns `null` unless the tail really is `…, <integer count>, <string callee>`
 * and exactly that many operands precede it — so a partial match is a refusal
 * rather than a short array.
 */
export function callArgumentsFrom(operands, { leading = 1 } = {}) {
  if (!Array.isArray(operands) || operands.length < leading + 2) return null;
  const callee = operands[operands.length - 1];
  const count = operands[operands.length - 2];
  if (!isStringLiteral(callee) || !isNumberLiteral(count)) return null;
  const many = count.value;
  if (!Number.isInteger(many) || many < 0) return null;
  if (operands.length !== leading + many + 2) return null;
  const args = [];
  for (let index = 1; index <= many; index += 1) args.push(literalOf(operands[operands.length - 2 - index]));
  return { callee: callee.value, count: many, args, leading: operands.slice(0, leading).map(literalOf) };
}

/** Every `DefineFunction`/`DefineFunction2` in the build under a given name. */
export function functionsNamed(analysis, wanted) {
  const found = [];
  for (const block of analysis.actionBlocks) {
    for (const { instruction } of walkInstructions(block.instructions, block.context)) {
      if (instruction.name !== "DefineFunction2" && instruction.name !== "DefineFunction") continue;
      if (instruction.operand?.name !== wanted) continue;
      found.push({ instruction, block, context: block.context, offset: instruction.offset });
    }
  }
  return found;
}

/* ──────────────────────────────  1. the ladder  ──────────────────────────── */

/**
 * ONE GUARD: `Push <register>, <number>` / `Equals2|Less2` / `Not` / `If`.
 *
 * The compiler emits `if (!(r == k)) jump past`, so the guarded region is
 * `[the instruction after the If, the If's target)` and the condition that
 * holds inside it is `r == k`. The `Not` is therefore load-bearing and is
 * matched rather than skipped: without it the sense of every arm inverts.
 */
function matchGuard(body, at) {
  const [push, compare, negate, jump] = [body[at], body[at + 1], body[at + 2], body[at + 3]];
  const operands = pushOperands(push);
  if (!operands || operands.length !== 2) return null;
  if (operands[0]?.type !== "register" || !isNumberLiteral(operands[1])) return null;
  const operator = compare?.name === "Equals2" ? "eq" : compare?.name === "Less2" ? "lt" : null;
  if (!operator) return null;
  if (negate?.name !== "Not") return null;
  if (jump?.name !== "If" || !Number.isFinite(jump.operand?.target)) return null;
  return {
    kind: "guard", length: 4, at: push.offset,
    register: operands[0].value, operator, value: operands[1].value, target: jump.operand.target
  };
}

/**
 * ONE CALL: `Push <frame>, 1, <register>, "gotoAndStop"` / `CallMethod` / `Pop`.
 *
 * ► **THE ARGUMENT COUNT IS MATCHED AS A LITERAL `1`, not skipped over.** It is
 *   the operand that says this is a one-argument call, and a two-argument
 *   `gotoAndStop` — there is no such thing, which is the point — would
 *   otherwise be read as a one-argument one whose frame is the wrong operand.
 */
function matchCall(body, at) {
  const [push, call, pop] = [body[at], body[at + 1], body[at + 2]];
  const operands = pushOperands(push);
  if (!operands || operands.length !== 4) return null;
  if (!isNumberLiteral(operands[0])) return null;
  if (!isNumberLiteral(operands[1]) || operands[1].value !== 1) return null;
  if (operands[2]?.type !== "register") return null;
  if (!isStringLiteral(operands[3]) || operands[3].value !== "gotoAndStop") return null;
  if (call?.name !== "CallMethod" || pop?.name !== "Pop") return null;
  return { kind: "call", length: 3, at: push.offset, frame: operands[0].value, object: operands[2].value };
}

/**
 * A `ConstantPool` DECLARATION, which is the one instruction here that is
 * consumed rather than refused.
 *
 * ► **AND IT IS ONLY SAFE BECAUSE THE STRINGS ARE ALREADY RESOLVED.**
 *   `decodeActions` in `tools/inspect-swf.mjs` tracks the live pool as it walks
 *   and writes each constant's string onto the operand's `value`, so a pool
 *   declared mid-body has already done its work by the time this reader sees
 *   it. It declares names; it cannot change which frame a call names. Every
 *   other unmatched instruction is still a refusal — an `Add2` in here means
 *   the build is COMPUTING a frame, and a literal-matching reader must say so
 *   rather than skip it.
 *
 * ► **THE SHIPPED BUILD HAS NONE INSIDE `itemglow`** — its pool is declared by
 *   the enclosing `DoAction` and inherited — so this arm is exercised only by
 *   `test/extract-enchantments.test.js`'s synthetic build, which declares one
 *   in the body on purpose. Counted as `pools` so the accounting still balances
 *   and a reader can see it fired.
 */
function matchPool(body, at) {
  if (body[at]?.name !== "ConstantPool") return null;
  return { kind: "pool", length: 1, at: body[at].offset };
}

const ladderRefusal = (reason, detail = {}) => ({ matched: false, reason, ...detail });

/**
 * THE (enchant_type, enchant_potency) -> FRAME LADDER, RECOVERED FROM THE
 * INSTRUCTION STREAM.
 *
 * ► **NOT ONE OF THE TWELVE ROWS IS WRITTEN IN THIS FILE.** The function is
 *   found by name, its body is consumed by two patterns (`matchGuard`,
 *   `matchCall`), each call is attributed to the guards whose jump target it
 *   still sits before, and the rows fall out. A build with a thirteenth arm
 *   grows a row; a build with an eleventh loses one and `ladderIncomplete`
 *   fires.
 *
 * ► **AN AVM1 INTERPRETER IS TRACTABLE AND IS NOT NEEDED HERE, which is the
 *   living head's standing note and holds exactly because every operand in this
 *   body is a literal.** Both patterns refuse anything else, so the moment a
 *   future build computes a frame instead of pushing one, this returns
 *   `unrecognisedInstruction` with the offset rather than a plausible table.
 *
 * ► **EVERY INSTRUCTION IS ACCOUNTED FOR, and that is an assertion and not a
 *   description.** `instructionsMatched` and `instructionsInBody` are both
 *   emitted; if they differ, the walk consumed less than the function contains
 *   and something in the body is doing work this reader cannot see. Measured on
 *   the oracle they are equal.
 *
 * ► **THE FIRST ARM FALLS THROUGH, AND SAYING SO IS PART OF THE READING.**
 *   `enchant_type < 2 -> gotoAndStop(1)` is not followed by a `Return`, so for
 *   `enchant_type < 2` the function goes on to test 2, 3, 4 and 5, fails all
 *   four, and leaves the clip on frame 1. Behaviourally identical here;
 *   recorded in `fallsThrough` because a reimplementation that early-returns is
 *   making a choice the build did not.
 */
export function deriveLadder(analysis, notCarried) {
  const found = functionsNamed(analysis, SEARCH_KEYS.selector);
  if (found.length === 0) {
    refuse(notCarried, "selectorNotFound");
    return ladderRefusal("selectorNotFound", { searchedFor: SEARCH_KEYS.selector });
  }
  if (found.length > 1) {
    refuse(notCarried, "selectorNotUnique", found.length);
    return ladderRefusal("selectorNotUnique", { at: found.map((entry) => hex(entry.offset)) });
  }
  const { instruction, context, offset } = found[0];
  const definition = instruction.operand;
  const body = Array.isArray(definition.body) ? definition.body : [];
  const parameters = (definition.parameters ?? []).map((parameter) => ({ ...parameter }));
  const nameByRegister = new Map(parameters.map((parameter) => [parameter.register, parameter.name]));

  // THE PARAMETER ROLES, READ OFF THE BUILD'S OWN PARAMETER NAMES rather than
  // off their positions. `DefineFunction2` stores the names, so "the type
  // parameter" is the one called `…_type` — falsifiable, and a build that
  // renames them refuses here instead of silently transposing the table.
  const typeParameter = parameters.find((parameter) => /(^|_)type$/.test(parameter.name ?? ""));
  const potencyParameter = parameters.find((parameter) => /(^|_)potency$/.test(parameter.name ?? ""));
  const objectParameter = parameters[0];
  if (!typeParameter || !potencyParameter || !objectParameter) {
    refuse(notCarried, "selectorParameterRolesUnrecognised");
    return ladderRefusal("parameterRolesUnrecognised", {
      at: hex(offset), parameters: parameters.map((parameter) => parameter.name)
    });
  }

  const items = [];
  let cursor = 0;
  while (cursor < body.length) {
    // A trailing `End` is the tag terminator `decodeActions` keeps, not a
    // statement; it is counted so the accounting still balances.
    if (body[cursor].name === "End" && cursor === body.length - 1) { cursor += 1; continue; }
    const pool = matchPool(body, cursor);
    if (pool) { items.push(pool); cursor += pool.length; continue; }
    const guard = matchGuard(body, cursor);
    if (guard) { items.push(guard); cursor += guard.length; continue; }
    const call = matchCall(body, cursor);
    if (call) { items.push(call); cursor += call.length; continue; }
    refuse(notCarried, "selectorUnrecognisedInstruction");
    return ladderRefusal("unrecognisedInstruction", {
      at: hex(body[cursor].offset), instruction: body[cursor].name,
      instructionsMatched: cursor, instructionsInBody: body.length
    });
  }

  // WHICH GUARDS A CALL SITS INSIDE: every guard whose jump target is still
  // ahead of it. An `If` that jumps BACKWARDS is a loop and not a ladder, and
  // is refused rather than silently treated as an open region.
  const open = [];
  const arms = [];
  for (const item of items) {
    if (item.kind === "pool") continue;
    for (let index = open.length - 1; index >= 0; index -= 1) if (open[index].target <= item.at) open.splice(index, 1);
    if (item.kind === "guard") {
      if (item.target <= item.at) {
        refuse(notCarried, "selectorGuardJumpsBackwards");
        return ladderRefusal("guardJumpsBackwards", { at: hex(item.at), target: hex(item.target) });
      }
      // Properly nested: an inner guard may not outlive the one enclosing it.
      if (open.length > 0 && open[open.length - 1].target < item.target) {
        refuse(notCarried, "selectorGuardsNotNested");
        return ladderRefusal("guardsNotNested", { at: hex(item.at), target: hex(item.target) });
      }
      open.push(item);
      continue;
    }
    if (item.object !== objectParameter.register) {
      refuse(notCarried, "selectorCallsAnotherObject");
      return ladderRefusal("gotoAndStopOnAnotherObject", { at: hex(item.at), register: item.object });
    }
    const conditions = [];
    for (const guard of open) {
      const name = nameByRegister.get(guard.register);
      if (!name) {
        refuse(notCarried, "selectorGuardOnUnknownRegister");
        return ladderRefusal("guardOnUnknownRegister", { at: hex(guard.at), register: guard.register });
      }
      conditions.push({ parameter: name, operator: guard.operator, value: guard.value });
    }
    arms.push({ frame: item.frame, at: hex(item.at), conditions });
  }

  // THE ARM SHAPES THIS LADDER IS ALLOWED TO HAVE. Two, and anything else is a
  // refusal: an arm guarded on potency alone, or on three things, or on
  // nothing, means the selector is not the table this tool claims to have read.
  const defaults = [];
  const cells = [];
  for (const arm of arms) {
    const onType = arm.conditions.filter((condition) => condition.parameter === typeParameter.name);
    const onPotency = arm.conditions.filter((condition) => condition.parameter === potencyParameter.name);
    if (arm.conditions.length === 1 && onType.length === 1 && onType[0].operator === "lt") {
      defaults.push({ below: onType[0].value, frame: arm.frame, at: arm.at });
    } else if (
      arm.conditions.length === 2 && onType.length === 1 && onPotency.length === 1 &&
      onType[0].operator === "eq" && onPotency[0].operator === "eq"
    ) {
      cells.push({ type: onType[0].value, potency: onPotency[0].value, frame: arm.frame, at: arm.at });
    } else {
      refuse(notCarried, "selectorArmShapeUnrecognised");
      return ladderRefusal("armShapeUnrecognised", { at: arm.at, frame: arm.frame, conditions: arm.conditions });
    }
  }
  if (defaults.length !== 1) {
    refuse(notCarried, "selectorDefaultArmNotUnique", Math.max(1, defaults.length));
    return ladderRefusal("defaultArmNotUnique", { found: defaults.length, arms: defaults });
  }

  const types = [...new Set(cells.map((cell) => cell.type))].sort((left, right) => left - right);
  const potencies = [...new Set(cells.map((cell) => cell.potency))].sort((left, right) => left - right);
  // ► **A LADDER THAT IS RIGHT FOR THREE ENCHANTMENTS OUT OF FOUR IS WORSE THAN
  //   NO LADDER**, so every cell of the cross product must be present exactly
  //   once. The missing and the duplicated are both NAMED, because "incomplete"
  //   without the coordinates is a shrug.
  const seen = new Map();
  const duplicated = [];
  for (const cell of cells) {
    const key = `${cell.type}/${cell.potency}`;
    if (seen.has(key)) duplicated.push({ ...cell, alsoAt: seen.get(key).at });
    else seen.set(key, cell);
  }
  const missing = [];
  for (const type of types) for (const potency of potencies) if (!seen.has(`${type}/${potency}`)) missing.push({ type, potency });
  if (missing.length > 0 || duplicated.length > 0) {
    refuse(notCarried, "selectorLadderIncomplete", missing.length + duplicated.length);
    return ladderRefusal("ladderIncomplete", { missing, duplicated, types, potencies });
  }

  // A CLOSED FORM, FITTED AND THEN TESTED — never asserted. The stride and the
  // base come out of the cells; `holds` is the result of evaluating the fit
  // against every one of them. A build whose ladder is not arithmetic reports
  // `holds: false` and keeps its table, which is the honest pair.
  const stride = potencies.length;
  const baseCell = seen.get(`${types[0]}/${potencies[0]}`);
  const base = baseCell.frame - potencies[0];
  const predict = (type, potency) => stride * (type - types[0]) + potency + base;
  const holds = cells.every((cell) => predict(cell.type, cell.potency) === cell.frame);

  return {
    matched: true,
    function: definition.name,
    at: hex(offset),
    context,
    parameters: parameters.map((parameter) => parameter.name),
    roles: { object: objectParameter.name, type: typeParameter.name, potency: potencyParameter.name },
    // The `gotoAndStop(1)` arm, and the fact that it does not return.
    default: { ...defaults[0], condition: `${typeParameter.name} < ${defaults[0].below}`, fallsThrough: true },
    types,
    potencies,
    cells: cells.sort((left, right) => left.frame - right.frame),
    closedForm: {
      expression: `${stride} * (${typeParameter.name} - ${types[0]}) + ${potencyParameter.name} + ${base}`,
      stride, base, holds
    },
    // Measured, not described: if these two differ, the reader saw less than the
    // function contains.
    instructionsInBody: body.length,
    instructionsMatched: items.reduce((sum, item) => sum + item.length, 0),
    guards: items.filter((item) => item.kind === "guard").length,
    calls: items.filter((item) => item.kind === "call").length,
    pools: items.filter((item) => item.kind === "pool").length
  };
}

/**
 * EVERY CALL SITE OF THE SELECTOR, with the member expression each passes as
 * `whichitem`.
 *
 * ► **THIS IS THE JOIN TO THE ART AND IT IS WHY IT IS DERIVED.** The member
 *   name recovered here — measured: `weapon` — is what `deriveArt` looks up in
 *   the build's instance names to find the clip whose frames the ladder is
 *   selecting. Hard-coding character 703 would have made the tool's central
 *   claim unfalsifiable.
 *
 * A call site whose expression cannot be read is COUNTED and returned with
 * `member: null`, never dropped: a caller this reader cannot follow is exactly
 * what would otherwise make the join look unanimous.
 */
export function deriveCallers(analysis, selector, notCarried) {
  const callers = [];
  for (const block of analysis.actionBlocks) {
    const list = [...walkInstructions(block.instructions, block.context)];
    for (let index = 0; index < list.length; index += 1) {
      const operands = pushOperands(list[index].instruction);
      if (!operands || operands.length === 0) continue;
      const callee = operands[operands.length - 1];
      if (!isStringLiteral(callee) || callee.value !== selector) continue;
      if (list[index + 1]?.instruction?.name !== "CallMethod") continue;
      const count = operands[operands.length - 3];
      // `whichitem` is the last thing pushed before the call record, so the
      // expression that produced it ends at the instruction before this Push.
      let member = null;
      if (list[index - 1]?.instruction?.name === "GetMember") {
        const source = pushOperands(list[index - 2]?.instruction);
        const last = source?.[source.length - 1];
        if (isStringLiteral(last)) member = last.value;
      }
      if (member === null) refuse(notCarried, "callerMemberUnreadable");
      callers.push({
        at: hex(list[index].instruction.offset),
        context: list[index].context,
        argumentCount: isNumberLiteral(count) ? count.value : null,
        member
      });
    }
  }
  return callers;
}

/* ───────────────────────────────  2. the art  ────────────────────────────── */

/**
 * EVERYTHING ABOUT A FRAME'S DRAWABLES EXCEPT WHAT ENCLOSES THEM.
 *
 * The whole claim of `deriveArt` is that the thirteen frames differ in ONE
 * thing. This is the signature that has to be identical for that to be true, so
 * it deliberately carries the matrix, the colour transform, the path, the mask
 * state and the placement's OWN effects — everything a leaf could move.
 *
 * ► **`ancestorEffects` IS DELIBERATELY NOT IN HERE, AND LEAVING IT IN WAS THIS
 *   FILE'S FIRST WRONG ANSWER.** `flattenFrame` records an enclosing group ONLY
 *   when that placement wears a filter or a blend mode (see its `descend`), so
 *   the unenchanted frame's `realweapon` produces an EMPTY chain and the other
 *   twelve produce a chain of one. Comparing the chains therefore reports
 *   "twelve frames moved" about a clip in which nothing moved but the filter
 *   list — the very difference the table is built to show. The enclosure's
 *   IDENTITY is checked instead against `timelineSignature` below, which comes
 *   from `resolveTimeline` and lists every placement whether it wears anything
 *   or not, and by `enclosureIsTheInnerInstance` in `deriveArt`.
 */
function bodySignature(drawables) {
  return JSON.stringify(drawables.map((drawable) => ({
    character: drawable.characterId,
    kind: drawable.kind ?? null,
    path: drawable.path,
    matrix: drawable.matrix,
    colour: drawable.colourTransform,
    unsupported: drawable.unsupported ?? null,
    isMask: drawable.isMask ?? false,
    maskPath: drawable.maskPath ?? null,
    ownBlendMode: drawable.blendMode ?? null,
    ownHasFilters: drawable.hasFilters ?? false,
    ownFilters: drawable.filters ?? null
  })));
}

/**
 * THE CLIP'S OWN DISPLAY LIST AT ONE FRAME, MINUS THE FILTER LIST.
 *
 * This is the half `bodySignature` cannot see: `resolveTimeline` returns every
 * placement, filtered or not, so a `realweapon` that CHANGED CHARACTER, moved
 * depth, gained a mask, gained a blend mode or gained a colour transform
 * between frames shows up here even though the flatten below it would look
 * identical. Together the two say "only the filter list moved" without either
 * of them having to treat an absent enclosure as a change.
 */
function timelineSignature(entries) {
  return JSON.stringify((entries ?? []).map((entry) => ({
    depth: entry.depth,
    character: entry.characterId ?? null,
    name: entry.name ?? null,
    className: entry.className ?? null,
    matrix: entry.matrix ?? null,
    colour: entry.colourTransform ?? null,
    ratio: entry.ratio ?? null,
    clipDepth: entry.clipDepth ?? null,
    blendMode: entry.blendMode ?? null,
    hasClipActions: entry.hasClipActions ?? false
  })));
}

const artRefusal = (reason, detail = {}) => ({ matched: false, reason, ...detail });

/**
 * THE GLOW THE LADDER IS SELECTING, MEASURED FRAME BY FRAME.
 *
 * ► **THE CLIP IS FOUND FROM THE SELECTOR'S OWN ARGUMENT, not declared.**
 *   `deriveCallers` reads `<fighter>.weapon` off the four call sites; this
 *   takes that member name, finds every `PlaceObject` in the build that names
 *   an instance `weapon`, and requires them all to resolve to ONE character.
 *   Measured on the oracle: three placements — in sprites 711, 1241 and 1522 —
 *   all of character 703, exported as `weapon0`.
 *
 * ► **AND THE CHECK IS THE SAME ONE `nestedLookupFor` MAKES IN
 *   `tools/extract-props.mjs`: if anything but the filter list differs between
 *   two frames, REFUSE.** A thirteen-row table of glows is only a table if the
 *   thirteen rows are otherwise the same picture. Measured: they are — every
 *   frame is shape 701 at path 1/1 under the identity-ish matrix
 *   `(1,0,0,1,-70,-70)` with an identity colour transform, and the ONLY thing
 *   that moves across the thirteen is the filter list on `realweapon`.
 *
 * ► **FRAME 1 IS NOT AN ABSENCE, IT IS A CLEARED SLOT, and the distinction is
 *   the one `ownEffectsOf` draws in the props extractor.** `realweapon` is
 *   placed on frame 1 exactly as it is on the other twelve; its placement
 *   simply carries no filter list. So `filters: null` there means "the build
 *   put no glow on the unenchanted weapon", which is the ladder's default arm
 *   drawn, and not "this tool failed to read one".
 *
 * ► **THE FILTER LIST IS READ TWICE, FROM TWO DIFFERENT DECODERS, AND COMPARED.**
 *   Once off `resolveTimeline`'s placement record and once off `flattenFrame`'s
 *   `ancestorEffects` group. They come from the same tag but through different
 *   code, so a disagreement means one of them is wrong, and this refuses by
 *   name rather than picking a favourite.
 */
export function deriveArt(buffer, characters, names, analysis, member, notCarried) {
  if (!member) {
    refuse(notCarried, "artClipMemberUnknown");
    return artRefusal("memberUnknown");
  }
  const placements = analysis.instances.filter((instance) => instance.name === member);
  const ids = [...new Set(placements.map((instance) => instance.characterId).filter((id) => id !== null))];
  if (ids.length !== 1) {
    refuse(notCarried, "artClipAmbiguous", Math.max(1, ids.length));
    return artRefusal("artClipAmbiguous", { member, characters: ids, placements: placements.length });
  }
  const id = ids[0];
  const character = characters.get(id);
  if (!character || character.kind !== "sprite") {
    refuse(notCarried, "artClipNotASprite");
    return artRefusal("artClipNotASprite", { character: id, kind: character?.kind ?? "nothing" });
  }

  const wanted = Array.from({ length: character.frames }, (unused, index) => index + 1);
  let resolved;
  try {
    resolved = resolveTimeline(buffer, character, { frames: wanted });
  } catch (error) {
    refuse(notCarried, "artTimelineUnresolvable");
    return artRefusal("timelineUnresolvable", { character: id, message: String(error.message).slice(0, 120) });
  }

  // THE INNER INSTANCE THE GLOW IS WORN BY, derived: the one named placement
  // that is on every frame at one depth as one character. Refused if the clip
  // has none, several, or one that moves — because "the filter list that
  // encloses `realweapon`" is only well defined if `realweapon` is one thing.
  const innerKeys = new Set();
  let inner = null;
  for (const frame of resolved.frames) {
    const named = (frame ?? []).filter((entry) => typeof entry.name === "string" && entry.name.length > 0);
    if (named.length !== 1) { innerKeys.add(`count:${named.length}`); continue; }
    innerKeys.add(`${named[0].name}/${named[0].depth}/${named[0].characterId}`);
    inner = { instance: named[0].name, depth: named[0].depth, character: named[0].characterId };
  }
  if (innerKeys.size !== 1 || !inner) {
    refuse(notCarried, "artInnerInstanceNotUnique", Math.max(1, innerKeys.size));
    return artRefusal("innerInstanceNotUnique", { character: id, saw: [...innerKeys] });
  }

  const cache = new Map();
  const frames = [];
  const signatures = [];
  const timelines = [];
  let leafPlacements = 0;
  let ownFilteredLeaves = 0;
  let ownBlendModeLeaves = 0;
  const groupKeys = new Set();
  for (let index = 0; index < character.frames; index += 1) {
    const displayList = resolved.frames[index];
    let drawables;
    try {
      drawables = flattenFrame(buffer, characters, displayList ?? [], { cache, resolveMasks: true });
    } catch (error) {
      refuse(notCarried, "artFrameUnflattenable");
      return artRefusal("frameUnflattenable", { frame: index + 1, message: String(error.message).slice(0, 120) });
    }
    signatures.push(bodySignature(drawables));
    timelines.push(timelineSignature(displayList));
    leafPlacements += drawables.length;
    for (const drawable of drawables) {
      if (Array.isArray(drawable.filters) && drawable.filters.length > 0) ownFilteredLeaves += 1;
      else if (drawable.hasFilters) refuse(notCarried, "emptyFilterList");
      if (drawable.blendMode !== undefined && drawable.blendMode !== null) ownBlendModeLeaves += 1;
      // ► **EVERY ENCLOSURE MUST BE THE ONE INSTANCE, AND NOTHING ELSE.** The
      //   chain is allowed to be EMPTY (the unenchanted frame, where the
      //   placement wears nothing and `flattenFrame` records no group) or to be
      //   exactly `realweapon`. A second filtered ancestor, or a different one,
      //   would mean the filter list this table reads is not the only effect on
      //   the picture — so it is refused rather than averaged in.
      for (const group of drawable.ancestorEffects ?? []) {
        if (group.characterId === inner.character && group.path.length === 1 && group.path[0] === inner.depth) continue;
        refuse(notCarried, "artEnclosureUnexpected");
        return artRefusal("enclosureUnexpected", {
          frame: index + 1, path: group.path, character: group.characterId,
          expected: { path: [inner.depth], character: inner.character }
        });
      }
    }

    // Read one: the placement's own filter list, straight off the timeline.
    const entry = (displayList ?? []).find((candidate) => candidate.name === inner.instance);
    const placed = Array.isArray(entry?.filters) && entry.filters.length > 0 ? entry.filters : null;
    if (!placed && entry?.hasFilters) refuse(notCarried, "emptyFilterList");
    // Read two: the same tag as `flattenFrame` reports it to a leaf inside.
    const group = drawables
      .flatMap((drawable) => drawable.ancestorEffects ?? [])
      .find((candidate) => candidate.characterId === inner.character &&
        candidate.path.length === 1 && candidate.path[0] === inner.depth);
    const enclosing = Array.isArray(group?.filters) && group.filters.length > 0 ? group.filters : null;
    if (JSON.stringify(placed) !== JSON.stringify(enclosing)) {
      refuse(notCarried, "artFilterReadsDisagree");
      return artRefusal("filterReadsDisagree", {
        frame: index + 1, fromPlacement: placed?.length ?? 0, fromFlatten: enclosing?.length ?? 0
      });
    }
    if (group) {
      const key = JSON.stringify({ path: group.path, character: group.characterId, filters: group.filters ?? null });
      // ► **ONCE PER DISTINCT GROUP, NOT ONCE PER FRAME — the same unit
      //   `inheritedEffectsFor` counts on in `tools/extract-props.mjs`.** The
      //   loss is the same loss `inheritedEffectsFor` invoices there: an
      //   ancestor group record carries no matrix, so a renderer cannot scale
      //   the blur by the group's own transform and falls back to the stage
      //   scale. On this build the two units happen to give the same 12,
      //   because every frame's filter list differs; on a build that repeats
      //   one they would not, and the group is the honest denominator.
      if (!groupKeys.has(key)) {
        groupKeys.add(key);
        refuse(notCarried, "effectGroupMatrix");
        for (const filter of group.filters ?? []) if (filter.measured === false) refuse(notCarried, "unmeasuredFilterRecord");
      }
    }
    frames.push({
      frame: index + 1,
      // `null` and not `[]`: see this function's note on frame 1.
      filters: enclosing,
      filterCount: enclosing?.length ?? 0,
      filterTypes: (enclosing ?? []).map((filter) => filter.type),
      blendMode: group?.blendMode ?? null,
      drawables: drawables.length
    });
  }

  // ► **THE CHECK `nestedLookupFor` MAKES, ON BOTH READS OF THE FRAME.** If the
  //   flatten moved, the picture changed; if the timeline moved, a placement
  //   changed under a picture that happens to flatten the same. Either one and
  //   the thirteen-row table would be describing thirteen different things.
  for (const [what, list] of [["artMovesBetweenFrames", signatures], ["artTimelineMovesBetweenFrames", timelines]]) {
    const distinct = [...new Set(list)];
    if (distinct.length === 1) continue;
    const differing = list
      .map((signature, index) => (signature === list[0] ? null : index + 1))
      .filter((frame) => frame !== null);
    refuse(notCarried, what, differing.length);
    return artRefusal(what, { differingFrames: differing, distinctSignatures: distinct.length });
  }

  return {
    matched: true,
    member,
    character: id,
    linkage: names.get(id) ?? null,
    frameCount: character.frames,
    // Where the build places this clip, from `PlaceObject` instance names.
    placedIn: placements.map((instance) => ({ context: instance.context, depth: instance.depth })),
    inner,
    // ► **WHAT IS INSIDE `realweapon` IS A PLACEHOLDER AND THIS TOOL SAYS SO.**
    //   The blade is attached at runtime — `…weapon.realweapon.attachMovie(
    //   "weapon" + <id>, …)` in `updatecharacter` and in `damagecharacter` —
    //   so the shape the file holds is a stand-in, and exporting it as the
    //   weapon would be an invention. Named, and its geometry deliberately not
    //   emitted; `tools/extract-wardrobe.mjs` is where weapon art comes from.
    placeholder: "the shape inside `realweapon` is a stand-in: the build attaches weapon<id> into it at runtime",
    frames,
    distinctEnclosingGroups: groupKeys.size,
    leafPlacements,
    ownFilteredLeaves,
    ownBlendModeLeaves
  };
}

/**
 * WHAT A PARENT CLIP SEES WHEN THE ART CLIP IS STOPPED AT EACH OF ITS FRAMES.
 *
 * ► **THIS IS THE MEASUREMENT BEHIND "`tools/extract-figure.mjs` CANNOT REACH
 *   THESE GLOWS".** `flattenFrame` stops every nested sprite on frame 1, which
 *   is right for scenery and exactly wrong here: frame 1 is the UNENCHANTED
 *   weapon. So a figure extraction that carried filter fields perfectly would
 *   still report zero, because the clip it is looking through is frozen on the
 *   one frame with nothing on it.
 *
 * `flattenFrame`'s `spriteFrames` option is what moves it, the same technique
 * `nestedLookupFor` in `tools/extract-props.mjs` uses for `bullet_trail`. The
 * table below is measured, one row per parent, and the frame-1 zero is a
 * COUNTED zero with a denominator beside it rather than a silence.
 */
export function deriveInSitu(buffer, characters, art, notCarried) {
  if (!art.matched) return [];
  const rows = [];
  // ► **ONE ROW PER PARENT FRAME, NOT PER PLACEMENT.** Sprite 1522 places the
  //   clip TWICE (depths 31 and 65 — two fighters on one screen), and flattening
  //   its frame once already sees both. A row per placement re-flattened the
  //   same frame and printed the same 48 filters on two lines, which reads as
  //   two independent measurements agreeing.
  const seenParents = new Set();
  for (const placement of art.placedIn) {
    const match = /^sprite:(\d+)\//.exec(placement.context);
    if (!match) { refuse(notCarried, "inSituParentNotASprite"); continue; }
    const parentId = Number(match[1]);
    if (seenParents.has(placement.context)) continue;
    seenParents.add(placement.context);
    const parent = characters.get(parentId);
    if (!parent || parent.kind !== "sprite") { refuse(notCarried, "inSituParentMissing"); continue; }
    const frameMatch = /\/frame:(\d+)/.exec(placement.context);
    const parentFrame = frameMatch ? Number(frameMatch[1]) : 1;
    let displayList;
    try {
      displayList = resolveTimeline(buffer, parent, { frames: [parentFrame] }).frames[0] ?? [];
    } catch (error) {
      refuse(notCarried, "inSituParentUnresolvable");
      continue;
    }
    const cache = new Map();
    const byFrame = [];
    let failed = false;
    for (let frame = 1; frame <= art.frameCount; frame += 1) {
      let drawables;
      try {
        drawables = flattenFrame(buffer, characters, displayList, {
          cache, resolveMasks: true, spriteFrames: { [art.character]: frame }
        });
      } catch (error) { failed = true; break; }
      let filters = 0;
      let groups = 0;
      for (const drawable of drawables) {
        for (const group of drawable.ancestorEffects ?? []) {
          if (group.characterId !== art.inner.character) continue;
          groups += 1;
          filters += (group.filters ?? []).length;
        }
      }
      byFrame.push({ frame, groups, filters });
    }
    if (failed) { refuse(notCarried, "inSituFrameUnflattenable"); continue; }
    rows.push({
      parent: parentId, parentFrame, parentLinkage: placement.context,
      // How many times this parent frame places the clip, so `filters` can be
      // read as "per placement x placements" rather than looking inflated.
      placements: art.placedIn.filter((entry) => entry.context === placement.context).length,
      // Deliberately named `atFrameOne` rather than left to the reader: this is
      // the number every extractor that does not vary the nested frame gets.
      atFrameOne: byFrame[0]?.filters ?? 0,
      reachableFilters: byFrame.reduce((sum, row) => sum + row.filters, 0),
      byFrame
    });
  }
  return rows;
}

/* ──────────────────────────────  3. the names  ───────────────────────────── */

/**
 * AN ARRAY LITERAL THE BUILD ASSIGNS TO A NAMED VARIABLE.
 *
 * ► **`weaponenchantments` IS THE BUILD'S OWN NAME TABLE AND IT OUTRANKS EVERY
 *   INFERENCE FROM AN ICON OR A COLOUR.** `battlevalues` reads
 *   `weaponenchantments[whichcharacter.weapon_enchantment_type]` straight into
 *   `weapon_enchantment_type_name`, so index 2 IS the name of type 2, in the
 *   author's words, with no interpretation in between. Everything else in this
 *   file about naming is corroboration of this one array.
 */
export function deriveArrayLiteral(analysis, variable, notCarried) {
  const found = [];
  for (const block of analysis.actionBlocks) {
    const list = [...walkInstructions(block.instructions, block.context)];
    for (let index = 0; index < list.length; index += 1) {
      const operands = pushOperands(list[index].instruction);
      if (!operands || operands.length < 3) continue;
      if (literalOf(operands[0]) !== variable) continue;
      if (list[index + 1]?.instruction?.name !== "NewObject") continue;
      if (list[index + 2]?.instruction?.name !== "SetVariable") continue;
      const call = callArgumentsFrom(operands, { leading: 1 });
      if (!call || call.callee !== "Array") continue;
      found.push({ at: hex(list[index].instruction.offset), context: list[index].context, entries: call.args });
    }
  }
  if (found.length !== 1) {
    refuse(notCarried, `arrayLiteralNotUnique:${variable}`, Math.max(1, found.length));
    return { matched: false, reason: "arrayLiteralNotUnique", variable, found: found.length };
  }
  return { matched: true, variable, ...found[0] };
}

/**
 * THE FOUR SHOP BUTTONS, AND WHAT EACH ONE SAYS IT IS.
 *
 * A button that writes `enchant_type = N` is the SELECTOR's input side. What it
 * highlights (`icon_flame`) and what it says in the tooltip are two more
 * independent statements about the same N, and both are recorded rather than
 * reduced to one, because measured on the oracle **THEY DISAGREE IN WORDING for
 * type 4: the icon is `icon_acid`, the build's own name table says `Poison`,
 * and the status flag is `poison`.** A tool that picked one and moved on would
 * have published "acid" or "poison" as though the build were unanimous.
 */
export function deriveShopButtons(analysis, notCarried) {
  const byButton = new Map();
  for (const block of analysis.actionBlocks) {
    const match = /\/button:(\d+)\/condition:(\d+)/.exec(block.context);
    if (!match) continue;
    const button = Number(match[1]);
    if (!byButton.has(button)) byButton.set(button, { button, sets: [], icons: [], tooltips: [] });
    const record = byButton.get(button);
    const list = [...walkInstructions(block.instructions, block.context)];
    for (let index = 0; index < list.length; index += 1) {
      const operands = pushOperands(list[index].instruction);
      if (!operands) continue;
      // `enchant_type = N` — a WRITE, so `SetVariable` and not `GetVariable`.
      // The read form appears in the same button's roll-out handler and would
      // otherwise be counted as a second, contradictory setting.
      if (
        operands.length === 2 && literalOf(operands[0]) === SEARCH_KEYS.shopVariable &&
        isNumberLiteral(operands[1]) && list[index + 1]?.instruction?.name === "SetVariable"
      ) {
        record.sets.push({ value: operands[1].value, at: hex(list[index].instruction.offset) });
      }
      for (const operand of operands) {
        const value = literalOf(operand);
        if (typeof value !== "string") continue;
        if (value.startsWith(SEARCH_KEYS.shopIconPrefix) && value.length > SEARCH_KEYS.shopIconPrefix.length) {
          record.icons.push({ icon: value, at: hex(list[index].instruction.offset) });
        }
      }
      // The tooltip is `bubbletext = "<prose>"`, and the prose is the FOURTH
      // witness. Recorded verbatim, including the build's own "oppenent".
      if (
        operands.length === 2 && literalOf(operands[0]) === "bubbletext" &&
        isStringLiteral(operands[1]) && list[index + 1]?.instruction?.name === "SetVariable" &&
        literalOf(operands[1]) !== "initbubbletext"
      ) {
        record.tooltips.push({ text: operands[1].value, at: hex(list[index].instruction.offset) });
      }
    }
  }

  const rows = [];
  for (const record of [...byButton.values()].sort((left, right) => left.button - right.button)) {
    const values = [...new Set(record.sets.map((entry) => entry.value))];
    if (values.length === 0) continue;
    if (values.length > 1) { refuse(notCarried, "shopButtonSetsSeveralTypes", values.length); continue; }
    const icons = [...new Set(record.icons.map((entry) => entry.icon))];
    if (icons.length !== 1) { refuse(notCarried, "shopButtonIconNotUnique", Math.max(1, icons.length)); continue; }
    const tooltips = [...new Set(record.tooltips.map((entry) => entry.text))];
    if (tooltips.length > 1) refuse(notCarried, "shopButtonTooltipNotUnique", tooltips.length);
    rows.push({
      button: record.button,
      type: values[0],
      icon: icons[0],
      iconLabel: icons[0].slice(SEARCH_KEYS.shopIconPrefix.length),
      tooltip: tooltips[0] ?? null,
      setAt: record.sets.find((entry) => entry.value === values[0]).at,
      iconAt: record.icons.find((entry) => entry.icon === icons[0]).at
    });
  }
  return rows.sort((left, right) => left.type - right.type);
}

/* ──────────────────────────────  4. the rules  ───────────────────────────── */

/**
 * THE GAME RULES THE GLOW STANDS FOR — QUOTED, CITED, AND NOT IMPLEMENTED.
 *
 * ► **THIS TOOL REPORTS THESE; IT DOES NOT RUN THEM.** They are here because an
 *   art table with no meaning beside it invites a renderer to invent one: the
 *   grey glow is `life_stolen`, not "the default", and the three frames of each
 *   family are three POTENCIES and not three frames of a pulse. Each rule
 *   carries the offsets it was read from so a reader can check it against the
 *   bytes, and each can come back `matched: false` with a reason.
 *
 * ► **EACH IS A SEPARATE MATCH ON PURPOSE.** The status map, the proc chance
 *   and the damage formula live in two different functions in two different
 *   timelines; one matcher covering all three would have to succeed or fail as
 *   a unit, and a partial read is what this file is built to expose.
 */
export function deriveRules(analysis, notCarried) {
  const rules = {};

  /* --- the status one type sets on a landed blow (`damagecharacter`) ------- */
  const damage = functionsNamed(analysis, SEARCH_KEYS.damage);
  if (damage.length !== 1) {
    refuse(notCarried, "ruleFunctionNotUnique:damagecharacter", Math.max(1, damage.length));
    rules.statuses = { matched: false, reason: "functionNotUnique", found: damage.length };
    // Both rules live in this function, so both refuse together. Written out
    // rather than left `undefined`: an absent key and a refused one read the
    // same to a caller, which is the confusion this whole file is built against.
    refuse(notCarried, "ruleProcChanceUnmatched");
    rules.procChance = { matched: false, reason: "functionNotUnique", found: damage.length };
  } else {
    const body = [...walkInstructions(damage[0].instruction.operand.body, damage[0].context)];
    const statuses = [];
    const others = [];
    // ► **EVERY TYPE COMPARISON SINCE THE LAST STATUS, NOT JUST THE LAST ONE,
    //   AND THAT IS A CORRECTION.** The build guards each status with
    //   `(equipped_weapon == 1 && weapon_enchantment_type == T) ||
    //    (equipped_weapon == 2 && secondary_weapon_enchantment_type == T)`, so
    //   taking "the most recent comparison" cites only the SECONDARY hand and
    //   reads as though the main weapon's enchantment did not apply. Both are
    //   collected, and they are REQUIRED to name the same T — a check that
    //   would fire if a build ever guarded one status on two different types.
    let pending = [];
    for (let index = 0; index < body.length; index += 1) {
      const operands = pushOperands(body[index].instruction);
      if (!operands) continue;
      const member = literalOf(operands[operands.length - 1]);
      if (
        typeof member === "string" && /_enchantment_type$/.test(member) &&
        body[index + 1]?.instruction?.name === "GetMember"
      ) {
        const compared = pushOperands(body[index + 2]?.instruction);
        if (compared?.length === 1 && isNumberLiteral(compared[0]) && body[index + 3]?.instruction?.name === "Equals2") {
          pending.push({ value: compared[0].value, field: member, at: hex(body[index].instruction.offset) });
        }
        continue;
      }
      // `<defender>.<status> = true`
      if (
        operands.length === 3 && operands[0]?.type === "register" && isStringLiteral(operands[1]) &&
        operands[2]?.type === "boolean" && operands[2].value === true &&
        body[index + 1]?.instruction?.name === "SetMember"
      ) {
        if (pending.length === 0) {
          // ► **NOT A LOSS, SO NOT IN `notCarried` — AND STILL COUNTED.**
          //   `damagecharacter` sets other boolean flags of its own
          //   (`phasecomplete`); they are outside every enchantment arm and this
          //   tool never wanted them. Recording them under `notCarried` would
          //   say something was dropped; recording them nowhere would leave a
          //   reader unable to tell this matcher from one that skipped a status.
          others.push({ flag: operands[1].value, at: hex(body[index].instruction.offset) });
          continue;
        }
        const values = [...new Set(pending.map((entry) => entry.value))];
        if (values.length !== 1) {
          refuse(notCarried, "ruleStatusGuardsDisagree", values.length);
          pending = [];
          continue;
        }
        statuses.push({
          type: values[0], status: operands[1].value,
          // ALL the fields that gate this status, in the order the build tests
          // them — main hand and off hand, not whichever came last.
          guardedBy: pending.map((entry) => entry.field),
          guardAt: pending.map((entry) => entry.at),
          at: hex(body[index].instruction.offset)
        });
        pending = [];
      }
    }
    const byType = new Map();
    const conflicting = [];
    for (const entry of statuses) {
      const existing = byType.get(entry.type);
      if (existing && existing.status !== entry.status) conflicting.push(entry);
      else if (!existing) byType.set(entry.type, entry);
    }
    if (conflicting.length > 0) refuse(notCarried, "ruleStatusConflict", conflicting.length);
    rules.statuses = {
      matched: byType.size > 0 && conflicting.length === 0,
      function: SEARCH_KEYS.damage,
      at: hex(damage[0].offset),
      context: damage[0].context,
      rows: [...byType.values()].sort((left, right) => left.type - right.type),
      conflicting,
      // See the note at the `lastType === null` branch: counted, named, and
      // deliberately not an entry in the loss tally.
      otherBooleanFlags: others
    };

    /* --- the proc chance ------------------------------------------------- */
    let proc = { matched: false, reason: "patternNotFound" };
    for (let index = 0; index < body.length; index += 1) {
      const operands = pushOperands(body[index].instruction);
      if (!operands) continue;
      const call = callArgumentsFrom(operands, { leading: 1 });
      if (!call || call.callee !== "randomBetween") continue;
      if (body[index + 1]?.instruction?.name !== "CallFunction") continue;
      if (body[index + 2]?.instruction?.name !== "SetVariable") continue;
      const variable = literalOf(operands[0]);
      // The comparison that uses it, found forward rather than assumed adjacent.
      for (let ahead = index + 3; ahead < Math.min(body.length, index + 24); ahead += 1) {
        const compare = pushOperands(body[ahead].instruction);
        if (!compare || compare.length !== 1 || literalOf(compare[0]) !== variable) continue;
        if (body[ahead + 1]?.instruction?.name !== "GetVariable") continue;
        const field = pushOperands(body[ahead + 2]?.instruction);
        const scale = pushOperands(body[ahead + 4]?.instruction);
        const fieldName = field ? literalOf(field[field.length - 1]) : null;
        if (
          typeof fieldName === "string" && /_potency$/.test(fieldName) &&
          body[ahead + 3]?.instruction?.name === "GetMember" &&
          scale?.length === 1 && isNumberLiteral(scale[0]) &&
          body[ahead + 5]?.instruction?.name === "Multiply" &&
          body[ahead + 6]?.instruction?.name === "Less2"
        ) {
          proc = {
            matched: true,
            expression: `${call.callee}(${call.args.join(", ")}) < ${fieldName} * ${scale[0].value}`,
            roll: { function: call.callee, arguments: call.args, into: variable, at: hex(body[index].instruction.offset) },
            threshold: { field: fieldName, multiplier: scale[0].value, operator: "lt" },
            at: hex(body[ahead].instruction.offset)
          };
          break;
        }
      }
      if (proc.matched) break;
    }
    if (!proc.matched) refuse(notCarried, "ruleProcChanceUnmatched");
    rules.procChance = proc;
  }

  /* --- the damage the enchantment adds (`battlevalues`) -------------------- */
  const values = functionsNamed(analysis, SEARCH_KEYS.values);
  if (values.length !== 1) {
    refuse(notCarried, "ruleFunctionNotUnique:battlevalues", Math.max(1, values.length));
    rules.enchantmentDamage = { matched: false, reason: "functionNotUnique", found: values.length };
  } else {
    const body = [...walkInstructions(values[0].instruction.operand.body, values[0].context)];
    const formulas = [];
    for (let index = 0; index < body.length; index += 1) {
      const operands = pushOperands(body[index].instruction);
      if (!operands || operands.length < 4) continue;
      const target = literalOf(operands[1]);
      const source = literalOf(operands[3]);
      if (typeof target !== "string" || !/_enchantment_damage$/.test(target)) continue;
      if (typeof source !== "string" || !/_max_damage$/.test(source)) continue;
      const divisor = pushOperands(body[index + 2]?.instruction);
      const potency = pushOperands(body[index + 4]?.instruction);
      const mathObject = pushOperands(body[index + 7]?.instruction);
      const method = pushOperands(body[index + 9]?.instruction);
      const potencyField = potency ? literalOf(potency[potency.length - 1]) : null;
      if (
        body[index + 1]?.instruction?.name === "GetMember" &&
        divisor?.length === 1 && isNumberLiteral(divisor[0]) &&
        body[index + 3]?.instruction?.name === "Divide" &&
        typeof potencyField === "string" && /_potency$/.test(potencyField) &&
        body[index + 5]?.instruction?.name === "GetMember" &&
        body[index + 6]?.instruction?.name === "Multiply" &&
        mathObject?.length === 2 && literalOf(mathObject[1]) === "Math" &&
        body[index + 8]?.instruction?.name === "GetVariable" &&
        method?.length === 1 && isStringLiteral(method[0]) &&
        body[index + 10]?.instruction?.name === "CallMethod" &&
        body[index + 11]?.instruction?.name === "SetMember"
      ) {
        formulas.push({
          target,
          expression: `${target} = Math.${method[0].value}(${source} / ${divisor[0].value} * ${potencyField})`,
          source, divisor: divisor[0].value, potencyField, rounding: `Math.${method[0].value}`,
          at: hex(body[index].instruction.offset)
        });
      }
    }
    if (formulas.length === 0) refuse(notCarried, "ruleEnchantmentDamageUnmatched");
    rules.enchantmentDamage = {
      matched: formulas.length > 0,
      function: SEARCH_KEYS.values, at: hex(values[0].offset), context: values[0].context,
      formulas
    };
  }

  rules.note =
    "EVIDENCE ABOUT THE GAME RULE, READ FROM THE BYTES AND NOT IMPLEMENTED HERE. " +
    "This tool derives the art and the selector; a rule is implemented in src/ against the fixture corpus.";
  return rules;
}

/* ───────────────────────────  5. the cross-check  ────────────────────────── */

/** A glow's colour as `#rrggbb`, which is how a family is recognised. */
const colourKey = (filter) => {
  const colour = filter?.colour;
  if (!colour) return `${filter?.type ?? "?"}:nocolour`;
  const pair = (value) => Number(value).toString(16).padStart(2, "0");
  return `#${pair(colour.red)}${pair(colour.green)}${pair(colour.blue)}${colour.alpha === 255 ? "" : pair(colour.alpha)}`;
};

/** The whole filter list as one comparable palette string. */
const paletteKey = (filters) => (filters ?? []).map(colourKey).join("+");

/**
 * THE TWO DERIVATIONS, MADE TO AGREE OR DISAGREE.
 *
 * ► **THIS IS THE ONLY PART OF THE FILE THAT COULD HAVE BEEN FAKED, SO IT IS
 *   THE PART THAT IS STRUCTURED TO FAIL.** The ladder comes from an AVM1
 *   function body; the palettes come from `PlaceObject3` filter lists in a
 *   `DefineSprite`. Nothing computes one from the other. If the build's frames
 *   2-4 were not one colour, or frame 5 shared frame 4's, `families` goes
 *   false and the joined table is withheld.
 *
 * ► **WHAT EACH CHECK CAN AND CANNOT SEE.** `families` cannot tell you which
 *   colour is Flame — no filter record says so; it can only tell you the
 *   partition matches. `potencyOrdersBlur` cannot tell you the build MEANT the
 *   blur to grow; it can tell you it does, in the order the ladder numbers the
 *   potencies, which is what makes "the other two members are potencies, not a
 *   pulse" a measurement rather than a reading. Say which is which when
 *   quoting them.
 */
export function crossCheck(ladder, art, shop, typeNames, potencyNames) {
  const checks = {};
  const detail = {};
  if (!ladder.matched || !art.matched) {
    return { ran: false, reason: !ladder.matched ? "ladderRefused" : "artRefused", checks, detail };
  }
  const paletteByFrame = new Map(art.frames.map((frame) => [frame.frame, paletteKey(frame.filters)]));

  // 1. The frames the ladder gives a type must be exactly the frames that share
  //    one palette, and no two types may share a palette.
  const framesByType = new Map();
  for (const cell of ladder.cells) {
    if (!framesByType.has(cell.type)) framesByType.set(cell.type, []);
    framesByType.get(cell.type).push(cell.frame);
  }
  const palettesByType = new Map();
  let familiesOk = true;
  for (const [type, frames] of framesByType) {
    const palettes = [...new Set(frames.map((frame) => paletteByFrame.get(frame)))];
    if (palettes.length !== 1 || palettes[0] === "") familiesOk = false;
    palettesByType.set(type, palettes[0] ?? null);
  }
  const distinctPalettes = new Set([...palettesByType.values()]);
  if (distinctPalettes.size !== palettesByType.size) familiesOk = false;
  checks.families = familiesOk;
  detail.families = [...palettesByType].map(([type, palette]) => ({
    type, palette, frames: framesByType.get(type)
  }));

  // 2. Within a type, the blur must grow with the potency the ladder numbers.
  //    The three frames of a family are three POTENCIES; this is the
  //    measurement that distinguishes that from three frames of an animation.
  const blurs = [];
  let orderOk = ladder.potencies.length > 1;
  for (const type of ladder.types) {
    const series = ladder.potencies.map((potency) => {
      const cell = ladder.cells.find((entry) => entry.type === type && entry.potency === potency);
      const frame = art.frames.find((entry) => entry.frame === cell?.frame);
      const radii = (frame?.filters ?? []).map((filter) => filter.blurX ?? null);
      return { potency, frame: cell?.frame ?? null, radii };
    });
    blurs.push({ type, series });
    for (let slot = 0; slot < (series[0]?.radii.length ?? 0); slot += 1) {
      for (let step = 1; step < series.length; step += 1) {
        const before = series[step - 1].radii[slot];
        const after = series[step].radii[slot];
        if (!(Number.isFinite(before) && Number.isFinite(after) && after > before)) orderOk = false;
      }
    }
  }
  checks.potencyOrdersBlur = orderOk;
  detail.potencyOrdersBlur = blurs;

  // 3. The default arm's frame must be the one with NO glow, and every frame a
  //    cell reaches must have one.
  const defaultFrame = art.frames.find((frame) => frame.frame === ladder.default.frame);
  const cellFrames = new Set(ladder.cells.map((cell) => cell.frame));
  checks.defaultFrameIsBare = Boolean(defaultFrame) && defaultFrame.filterCount === 0;
  checks.everyCellFrameGlows = art.frames
    .filter((frame) => cellFrames.has(frame.frame))
    .every((frame) => frame.filterCount > 0);
  detail.defaultFrame = { frame: ladder.default.frame, filters: defaultFrame?.filterCount ?? null };

  // 4. The ladder's reachable frames must be exactly the clip's frames — no arm
  //    pointing past the end, no frame the ladder cannot reach.
  const reachable = new Set([ladder.default.frame, ...cellFrames]);
  const declared = new Set(art.frames.map((frame) => frame.frame));
  checks.ladderCoversClip =
    reachable.size === declared.size && [...declared].every((frame) => reachable.has(frame));
  detail.coverage = {
    reachable: [...reachable].sort((left, right) => left - right),
    unreachable: [...declared].filter((frame) => !reachable.has(frame)),
    offClip: [...reachable].filter((frame) => !declared.has(frame))
  };

  // 5. Three name witnesses must agree about WHICH type numbers exist.
  const shopTypes = [...new Set(shop.map((row) => row.type))].sort((left, right) => left - right);
  const namedTypes = typeNames.matched
    ? typeNames.entries.map((entry, index) => ({ entry, index })).filter((row) => row.entry !== "").map((row) => row.index)
    : [];
  const same = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
  checks.typeSetsAgree = same(ladder.types, shopTypes) && (namedTypes.length === 0 || same(ladder.types, namedTypes));
  detail.typeSets = { ladder: ladder.types, shop: shopTypes, nameTable: namedTypes };

  const namedPotencies = potencyNames.matched
    ? potencyNames.entries.map((entry, index) => ({ entry, index })).filter((row) => row.entry !== "").map((row) => row.index)
    : [];
  checks.potencySetsAgree = namedPotencies.length === 0 || same(ladder.potencies, namedPotencies);
  detail.potencySets = { ladder: ladder.potencies, nameTable: namedPotencies };

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  return { ran: true, checks, failed, detail };
}

/**
 * THE JOINED TABLE — one row per enchantment type, with its frames, its names
 * and its palette — WITHHELD ENTIRELY IF ANY CROSS-CHECK FAILED.
 *
 * ► **"RIGHT FOR THREE OUT OF FOUR" IS THE FAILURE THIS GUARD EXISTS FOR.** The
 *   joined table is the only artefact here that fuses two derivations, so it is
 *   the only one that can be wrong in a way that still reads as an answer. If
 *   the halves disagree, both halves stay in the pack under their own keys and
 *   this returns `null` with the reason — a reader can still do the join by
 *   hand, having been told it does not hold.
 */
export function joinTypes(ladder, art, shop, typeNames, statuses, potencyNames, verdict) {
  if (!verdict.ran || verdict.failed.length > 0) {
    return { emitted: false, reason: verdict.ran ? `crossCheckFailed:${verdict.failed.join(",")}` : verdict.reason };
  }
  const shopByType = new Map(shop.map((row) => [row.type, row]));
  const statusByType = new Map((statuses?.rows ?? []).map((row) => [row.type, row]));
  const rows = ladder.types.map((type) => {
    const cells = ladder.cells.filter((cell) => cell.type === type).sort((left, right) => left.potency - right.potency);
    return {
      type,
      // The build's own word for it, from `weaponenchantments`.
      name: typeNames.matched ? (typeNames.entries[type] ?? null) : null,
      // And the shop's, which for type 4 is a DIFFERENT word. Both kept.
      icon: shopByType.get(type)?.icon ?? null,
      tooltip: shopByType.get(type)?.tooltip ?? null,
      button: shopByType.get(type)?.button ?? null,
      status: statusByType.get(type)?.status ?? null,
      potencies: cells.map((cell) => {
        const frame = art.frames.find((entry) => entry.frame === cell.frame);
        return {
          potency: cell.potency,
          name: potencyNames.matched ? (potencyNames.entries[cell.potency] ?? null) : null,
          frame: cell.frame,
          at: cell.at,
          glows: (frame?.filters ?? []).map((filter) => ({
            type: filter.type,
            colour: colourKey(filter),
            blurX: filter.blurX, blurY: filter.blurY,
            strength: filter.strength, inner: filter.inner, knockout: filter.knockout, passes: filter.passes
          }))
        };
      })
    };
  });
  return { emitted: true, rows };
}

/* ────────────────────────────────  the pack  ─────────────────────────────── */

/**
 * THE INVOICE. What was read, out of how many, what was refused and why.
 *
 * ► **A DENOMINATOR FOR EVERY ZERO.** `ownFilteredPlacements: 0` is worthless
 *   on its own — it is the same shape whether the build has none or the reader
 *   dropped them before counting. Beside `leafPlacements: 13` it is a
 *   measurement. Every zero in this object has its denominator next to it.
 */
export function invoiceFor({ ladder, art, inSitu, shop, typeNames, potencyNames, rules, verdict, notCarried }) {
  const groupFilterLists = art.matched ? art.frames.map((frame) => frame.filters ?? []) : [];
  const blendModes = art.matched
    ? art.frames.map((frame) => frame.blendMode).filter((mode) => mode !== null && mode !== undefined)
    : [];
  const byType = {};
  for (const list of groupFilterLists) for (const filter of list) byType[filter.type] = (byType[filter.type] ?? 0) + 1;

  const blend = { exact: {}, refused: {} };
  for (const id of blendModes) {
    const seen = blendModeFor(id);
    const key = seen.composite && seen.exact ? "exact" : "refused";
    const label = key === "exact" ? seen.name : `${seen.name ?? id}:${seen.refused}`;
    blend[key][label] = (blend[key][label] ?? 0) + 1;
  }

  return {
    ladder: {
      matched: ladder.matched,
      instructionsInBody: ladder.instructionsInBody ?? null,
      instructionsMatched: ladder.instructionsMatched ?? null,
      // Both numbers, always: equal is the claim, and a claim needs two numbers.
      fullyAccounted: ladder.matched ? ladder.instructionsMatched === ladder.instructionsInBody : false,
      guards: ladder.guards ?? 0,
      calls: ladder.calls ?? 0,
      pools: ladder.pools ?? 0,
      cells: ladder.matched ? ladder.cells.length : 0,
      types: ladder.matched ? ladder.types.length : 0,
      potencies: ladder.matched ? ladder.potencies.length : 0
    },
    art: {
      matched: art.matched,
      frames: art.matched ? art.frameCount : 0,
      framesWithAGlow: art.matched ? art.frames.filter((frame) => frame.filterCount > 0).length : 0,
      framesBare: art.matched ? art.frames.filter((frame) => frame.filterCount === 0).length : 0,
      // ► THE UNITS DIFFER ON PURPOSE, the same way they do in
      //   `effectSummaryFor` in `tools/extract-props.mjs`: a group's filters are
      //   counted once per group and a placement's own once per placement.
      //   Adding them would report one enclosing glow as thirteen.
      enclosingFilters: groupFilterLists.reduce((sum, list) => sum + list.length, 0),
      enclosingFiltersByType: byType,
      distinctEnclosingGroups: art.matched ? art.distinctEnclosingGroups : 0,
      leafPlacements: art.matched ? art.leafPlacements : 0,
      ownFilteredLeaves: art.matched ? art.ownFilteredLeaves : 0,
      ownBlendModeLeaves: art.matched ? art.ownBlendModeLeaves : 0
    },
    // What an extractor that does NOT vary the nested frame sees, per parent.
    inSitu: inSitu.map((row) => ({
      parent: row.parent, placements: row.placements, atFrameOne: row.atFrameOne,
      reachableFilters: row.reachableFilters, framesProbed: row.byFrame.length
    })),
    names: {
      shopButtons: shop.length,
      typeNameEntries: typeNames.matched ? typeNames.entries.length : 0,
      typeNamesNonEmpty: typeNames.matched ? typeNames.entries.filter((entry) => entry !== "").length : 0,
      potencyNameEntries: potencyNames.matched ? potencyNames.entries.length : 0,
      potencyNamesNonEmpty: potencyNames.matched ? potencyNames.entries.filter((entry) => entry !== "").length : 0
    },
    rules: {
      statuses: rules.statuses?.matched ? rules.statuses.rows.length : 0,
      statusesMatched: Boolean(rules.statuses?.matched),
      procChanceMatched: Boolean(rules.procChance?.matched),
      enchantmentDamageMatched: Boolean(rules.enchantmentDamage?.matched),
      enchantmentDamageFormulas: rules.enchantmentDamage?.matched ? rules.enchantmentDamage.formulas.length : 0
    },
    crossCheck: verdict,
    use: {
      filters: summariseFilterUse(groupFilterLists.map((list) => canvasFilterFor(list))),
      blendModes: blend
    },
    // A NAMED-REASON TALLY, never a boolean. Empty means nothing was dropped,
    // which is a claim this file makes only because every drop goes through
    // `refuse`.
    notCarried,
    scope: [
      "the weapon BLADE is not here: the build attaches weapon<id> into `realweapon` at runtime, so the file holds a placeholder",
      "the enchantment RULES are reported with their offsets and are not implemented by this tool",
      "effects on the ROOT's placement of the fighter clip are outside a clip-in-isolation flatten, as in tools/extract-props.mjs"
    ]
  };
}

export function extractEnchantments(buffer) {
  const { analysis } = analyseSwfBuffer(buffer);
  const { characters, names } = indexCharacters(buffer);
  const notCarried = {};

  const ladder = deriveLadder(analysis, notCarried);
  const callers = deriveCallers(analysis, SEARCH_KEYS.selector, notCarried);
  const members = [...new Set(callers.map((caller) => caller.member).filter((member) => member !== null))];
  if (members.length > 1) refuse(notCarried, "callerMembersDisagree", members.length);
  const art = deriveArt(buffer, characters, names, analysis, members.length === 1 ? members[0] : null, notCarried);
  const inSitu = deriveInSitu(buffer, characters, art, notCarried);
  const shop = deriveShopButtons(analysis, notCarried);
  const typeNames = deriveArrayLiteral(analysis, SEARCH_KEYS.typeNames, notCarried);
  const potencyNames = deriveArrayLiteral(analysis, SEARCH_KEYS.potencyNames, notCarried);
  const rules = deriveRules(analysis, notCarried);
  const verdict = crossCheck(ladder, art, shop, typeNames, potencyNames);
  const joined = joinTypes(ladder, art, shop, typeNames, rules.statuses, potencyNames, verdict);
  const invoice = invoiceFor({ ladder, art, inSitu, shop, typeNames, potencyNames, rules, verdict, notCarried });

  return { ladder, callers, art, inSitu, shop, typeNames, potencyNames, rules, crossCheck: verdict, types: joined, invoice };
}

export function packFor({ source, sha256, pack }) {
  return {
    source,
    sha256,
    oracleSha256: ORACLE_SHA256,
    // Reported, NEVER enforced: a different build is a legitimate thing to run
    // this on; treating its output as evidence about the oracle is not.
    matchesOracle: sha256 === ORACLE_SHA256,
    derivedFrom:
      "the selector is read from an AVM1 DefineFunction2 body; the art from PlaceObject3 filter lists; " +
      "the names from the build's own array literals and its shop buttons. Frames are 1-based, as gotoAndStop indexes them.",
    selector: pack.ladder,
    callers: pack.callers,
    art: pack.art,
    inSitu: pack.inSitu,
    names: { typeNames: pack.typeNames, potencyNames: pack.potencyNames, shopButtons: pack.shop },
    rules: pack.rules,
    crossCheck: pack.crossCheck,
    types: pack.types,
    invoice: pack.invoice
  };
}

/* ─────────────────────────────────  the CLI  ─────────────────────────────── */

export function parseArguments(argv) {
  // ► **ONE FILE, AND IT IS NOT `manifest.json`.** `assets/figure/` already
  //   holds `tools/extract-figure.mjs`'s manifest; a second writer of that name
  //   would destroy the figure pack's invoice on every run. Everything this
  //   tool has to say is in `enchantments.json`.
  const options = { file: null, out: path.join(REPO_ROOT, "assets", "figure"), report: false };
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      const next = argv[index + 1];
      if (typeof next !== "string" || next.startsWith("--")) {
        throw new ExtractEnchantmentsError("--out needs a directory path.");
      }
      options.out = next;
      index += 1;
    } else if (value === "--report") {
      options.report = true;
    } else if (value.startsWith("--")) {
      throw new ExtractEnchantmentsError(`Unknown option ${value}.`);
    } else {
      rest.push(value);
    }
  }
  options.file = rest[0] ?? DEFAULT_SWF;
  return options;
}

/**
 * THE REPORT A HUMAN READS. Built here rather than inline in `main` so a test
 * can hold it — the arrangement `manifestFor` in `tools/extract-props.mjs`
 * records the reason for: a verifier deleted the per-prop invoice from that
 * object and fifteen tests stayed green, because `main` was exercised by
 * nothing.
 */
export function reportLines(pack, out) {
  const lines = [`enchantments -> ${out}`];
  const { ladder, art, shop, typeNames, potencyNames, rules, crossCheck: verdict, types, invoice } = pack;

  if (!ladder.matched) {
    lines.push(`  SELECTOR REFUSED: ${ladder.reason} ${JSON.stringify({ ...ladder, matched: undefined })}`);
  } else {
    lines.push(
      `  selector ${ladder.function}(${ladder.parameters.join(", ")}) at ${ladder.at}  ` +
      `${ladder.instructionsMatched}/${ladder.instructionsInBody} instructions matched, ` +
      `${ladder.guards} guards, ${ladder.calls} calls`
    );
    lines.push(
      `    default: ${ladder.default.condition} -> frame ${ladder.default.frame} (falls through)  |  ` +
      `closed form: ${ladder.closedForm.expression} ${ladder.closedForm.holds ? "HOLDS" : "DOES NOT HOLD"}`
    );
  }

  if (!art.matched) {
    lines.push(`  ART REFUSED: ${art.reason} ${JSON.stringify({ ...art, matched: undefined })}`);
  } else {
    lines.push(
      `  art: instance "${art.member}" -> character ${art.character}` +
      `${art.linkage ? ` (${art.linkage})` : ""}, ${art.frameCount} frames, ` +
      `glow worn by "${art.inner.instance}" (character ${art.inner.character}, depth ${art.inner.depth})`
    );
  }

  if (types.emitted) {
    lines.push("  type  name     icon         status        potency frames + palette");
    for (const row of types.rows) {
      const cells = row.potencies.map((entry) =>
        `${entry.name ?? entry.potency}=f${entry.frame}[${entry.glows.map((glow) => `${glow.colour}/${glow.blurX}`).join(" ")}]`
      );
      lines.push(
        `   ${String(row.type).padStart(2)}   ${String(row.name ?? "?").padEnd(8)} ${String(row.icon ?? "?").padEnd(12)} ` +
        `${String(row.status ?? "?").padEnd(13)} ${cells.join("  ")}`
      );
    }
  } else {
    lines.push(`  JOINED TABLE WITHHELD: ${types.reason}`);
  }

  const bare = art.matched ? art.frames.filter((frame) => frame.filterCount === 0).map((frame) => frame.frame) : [];
  lines.push(
    `  frames: ${invoice.art.framesWithAGlow} of ${invoice.art.frames} carry a glow, ` +
    `${invoice.art.framesBare} bare (${bare.join(", ") || "none"}), ` +
    `${invoice.art.enclosingFilters} enclosing filters over ${invoice.art.distinctEnclosingGroups} distinct group(s)`
  );
  lines.push(
    `  own:    ${invoice.art.ownFilteredLeaves} of ${invoice.art.leafPlacements} leaf placement(s) carry an own filter, ` +
    `${invoice.art.ownBlendModeLeaves} an own blend mode  [the glow is on the ENCLOSING sprite, never on the leaf]`
  );
  for (const row of pack.inSitu) {
    lines.push(
      `  in situ: parent ${row.parent} (${row.placements} placement(s)) sees ${row.atFrameOne} filter(s) ` +
      `with the clip frozen on frame 1, ${row.reachableFilters} across all ${row.byFrame.length} frames`
    );
  }
  lines.push(
    `  names:  ${SEARCH_KEYS.typeNames} = ${typeNames.matched ? JSON.stringify(typeNames.entries) : `REFUSED (${typeNames.reason})`}` +
    `${typeNames.matched ? ` at ${typeNames.at}` : ""}`
  );
  lines.push(
    `          ${SEARCH_KEYS.potencyNames} = ${potencyNames.matched ? JSON.stringify(potencyNames.entries) : `REFUSED (${potencyNames.reason})`}` +
    `${potencyNames.matched ? ` at ${potencyNames.at}` : ""}`
  );
  lines.push(`          ${shop.length} shop button(s): ${shop.map((row) => `${row.button}->type ${row.type} ${row.icon}`).join(", ") || "none"}`);
  lines.push(
    `  rules (REPORTED, NOT IMPLEMENTED): ` +
    `${rules.procChance?.matched ? rules.procChance.expression : `proc chance REFUSED (${rules.procChance?.reason})`}`
  );
  for (const formula of rules.enchantmentDamage?.formulas ?? []) lines.push(`          ${formula.expression}  @${formula.at}`);
  if (rules.statuses?.matched) {
    lines.push(`          status: ${rules.statuses.rows.map((row) => `${row.type}->${row.status}`).join(", ")}`);
  }
  const named = (counts) => Object.entries(counts).map(([kind, count]) => `${count} ${kind}`).join(", ") || "none";
  lines.push(
    `  cross-check: ${verdict.ran
      ? Object.entries(verdict.checks).map(([name, ok]) => `${name}=${ok ? "ok" : "FAILED"}`).join(" ")
      : `did not run (${verdict.reason})`}`
  );
  // ► **`applied` AND `approximated` ARE PRINTED TOGETHER OR NEITHER IS WORTH
  //   PRINTING.** Measured on the oracle: all 24 glows are `applied` AND all 24
  //   are approximated, as `shadowStrengthAsAlpha` — the renderer draws a glow
  //   as a CSS drop-shadow and spends the SWF's `strength` on the shadow's alpha
  //   because CSS has no strength. A line reading "24 applied" alone would say
  //   the pack is exactly drawable, which it is not.
  lines.push(
    `  a renderer: ${invoice.use.filters.applied} applied, ${invoice.use.filters.deferred} deferred, ` +
    `${invoice.use.filters.noOp} no-op, ${invoice.use.filters.refused} refused of ${invoice.use.filters.total}` +
    `${Object.keys(invoice.use.filters.refusedByReason).length ? ` (${named(invoice.use.filters.refusedByReason)})` : ""}`
  );
  lines.push(
    `              ${invoice.use.filters.approximated} approximated` +
    `${Object.keys(invoice.use.filters.approximatedByKind).length ? `: ${named(invoice.use.filters.approximatedByKind)}` : ""}`
  );
  lines.push(`  not carried: ${named(invoice.notCarried)}`);
  return lines;
}

function main(argv) {
  const options = parseArguments(argv);
  if (!fs.existsSync(options.file)) {
    throw new ExtractEnchantmentsError(
      `No SWF at ${options.file}. Pass the path to YOUR OWN installed copy; this repository ships none.`
    );
  }
  const buffer = fs.readFileSync(options.file);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  if (sha256 !== ORACLE_SHA256) {
    process.stdout.write(
      `NOTE: this build is ${sha256.slice(0, 16)}…, not the oracle ${ORACLE_SHA256.slice(0, 16)}…\n` +
      "      That is legitimate; what is not is treating the output as evidence about the oracle.\n"
    );
  }

  const pack = extractEnchantments(buffer);
  fs.mkdirSync(options.out, { recursive: true });
  fs.writeFileSync(
    path.join(options.out, "enchantments.json"),
    JSON.stringify(packFor({ source: path.basename(options.file), sha256, pack }), null, 1)
  );

  const lines = reportLines(pack, options.out);
  if (options.report && pack.crossCheck.ran) {
    for (const row of pack.crossCheck.detail.potencyOrdersBlur ?? []) {
      lines.push(`    ! type ${row.type} blur by potency: ${row.series.map((entry) => `${entry.potency}:${entry.radii.join("/")}`).join("  ")}`);
    }
    for (const row of pack.crossCheck.detail.families ?? []) {
      lines.push(`    ! type ${row.type} frames ${row.frames.join(",")} palette ${row.palette}`);
    }
  }
  process.stdout.write(`${lines.join("\n")}\n`);
  // A failed cross-check is a FINDING, and a tool that returns 0 on one is
  // telling a script it agreed with itself when it did not.
  if (pack.crossCheck.ran && pack.crossCheck.failed.length > 0) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
