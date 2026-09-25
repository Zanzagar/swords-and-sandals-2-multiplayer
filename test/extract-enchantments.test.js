/**
 * THE WEAPON ENCHANTMENT SELECTOR, AND THE ONE WAY IT COULD HAVE BEEN FAKED.
 *
 * ► **THE TRAP THIS FILE IS SHAPED AROUND.** `tools/extract-enchantments.mjs`
 *   derives a twelve-row ladder out of an AVM1 function body. A test that
 *   asserted that ladder against a table also written into the tool would check
 *   nothing at all — it would confirm that a constant equals itself, in a file
 *   whose entire claim is that no constant is involved. So the ladder is
 *   asserted TWICE and never against the tool:
 *
 *   1. against the BYTES this file assembles, which is a decoder test: the
 *      writer below encodes a ladder and the reader has to get it back; and
 *   2. against the GLOW COLOURS, which is the real one. The frames a type owns
 *      come out of a function body; the colour on a frame comes out of a
 *      `PlaceObject3` filter list in a different tag entirely. Nothing computes
 *      one from the other, so requiring that each type's frames share one
 *      palette and that no two types share a palette is a claim two independent
 *      derivations can break.
 *
 * ► **AND THE NEGATIVE CASES ARE THE POINT OF HAVING A WRITER.** On the shipped
 *   build every check passes, so a suite built only on the oracle proves the
 *   checks EXIST, not that they can fire. Five builds below are deliberately
 *   broken — an arm removed, an instruction the matcher cannot name, a frame
 *   that moves, a palette that crosses a family boundary, a blur that shrinks —
 *   and each asserts the tool refuses by the right name. A refusal nothing
 *   tests is a refusal nobody has seen work.
 *
 * ► **NOTHING HERE COMES FROM THE LICENSED BUILD.** Every byte is assembled in
 *   this file from invented names — `blade`, `Alpha`, `icon_alpha`, types 7, 8
 *   and 9 — for the reason `test/extract-props.test.js` gives: a fixture of real
 *   bytes would put extracted art in the repository, which is the one thing
 *   `assets/` exists to prevent. The invented names are also a guard: the
 *   synthetic build shares NO name or number with the oracle, so a tool that
 *   secretly knew the answer would fail here rather than pass everywhere.
 *   The writer is deliberately a SEPARATE one from the writers in
 *   `test/extract-props.test.js` and `test/extract-figure.test.js`; importing
 *   one test's fixture builder into another makes a shared wrong assumption
 *   look like agreement.
 *
 * What the real build contributes is numbers, quoted here and not stored:
 * `itemglow` at `0x3fa786`, 107 of 107 instructions matched, 17 guards and 13
 * calls; four types (2 Flame, 3 Frost, 4 Poison, 5 Wraith) x three potencies
 * (Weak, Medium, Strong) over frames 2-13 of character 703 `weapon0`, with
 * frame 1 bare; 24 glows on the enclosing `realweapon` placement and 0 on any
 * leaf. Reproduce with `node tools/extract-enchantments.mjs --out <somewhere
 * outside the repo> --report`, never by committing a fixture.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_SWF,
  ORACLE_SHA256,
  SEARCH_KEYS,
  callArgumentsFrom,
  extractEnchantments,
  packFor,
  reportLines
} from "../tools/extract-enchantments.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/* ─────────────────────────  the AVM1 assembler  ──────────────────────────── */

const u8 = (value) => Buffer.from([value & 0xff]);
const u16 = (value) => { const out = Buffer.alloc(2); out.writeUInt16LE(value & 0xffff); return out; };
const i16 = (value) => { const out = Buffer.alloc(2); out.writeInt16LE(value); return out; };
const u32 = (value) => { const out = Buffer.alloc(4); out.writeUInt32LE(value >>> 0); return out; };
const i32 = (value) => { const out = Buffer.alloc(4); out.writeInt32LE(value); return out; };
const cstr = (value) => Buffer.concat([Buffer.from(value, "utf8"), Buffer.from([0])]);

/** Push operand constructors, one per wire type this file uses. */
const I = (value) => Buffer.concat([u8(0x07), i32(value)]);
const S = (value) => Buffer.concat([u8(0x00), cstr(value)]);
const R = (value) => Buffer.concat([u8(0x04), u8(value)]);
const B = (value) => Buffer.concat([u8(0x05), u8(value ? 1 : 0)]);
/** A CONSTANT-POOL reference, so this fixture exercises the path the build uses. */
const C = (index) => Buffer.concat([u8(0x08), u8(index)]);

const OP = Object.freeze({
  End: 0x00, Pop: 0x17, GetVariable: 0x1c, SetVariable: 0x1d, Multiply: 0x0c, Divide: 0x0d,
  Add2: 0x47, Less2: 0x48, Equals2: 0x49, Not: 0x12, CallFunction: 0x3d, NewObject: 0x40,
  GetMember: 0x4e, SetMember: 0x4f, CallMethod: 0x52
});

/**
 * A relocatable AVM1 instruction stream.
 *
 * ► **JUMPS ARE WRITTEN AS DELTAS, WHICH IS WHY THIS DOES NOT NEED TO KNOW
 *   WHERE IT LANDS.** `decodeActions` computes an `If`'s target as
 *   `payloadEnd + delta`, so the delta is the distance from the end of the
 *   `If` record to the label — a number that is the same wherever the whole
 *   body is placed in the file. Two passes: size everything, then emit.
 */
class Actions {
  constructor() { this.items = []; }
  raw(bytes) { this.items.push({ size: bytes.length, emit: () => bytes }); return this; }
  op(code) { return this.raw(u8(code)); }
  push(...values) {
    const payload = Buffer.concat(values);
    return this.raw(Buffer.concat([u8(0x96), u16(payload.length), payload]));
  }
  constantPool(strings) {
    const payload = Buffer.concat([u16(strings.length), ...strings.map(cstr)]);
    return this.raw(Buffer.concat([u8(0x88), u16(payload.length), payload]));
  }
  /** `if (!<top of stack>) goto label` — the `If` half of the build's own idiom. */
  jumpIfTrue(label) { this.items.push({ size: 5, label }); return this; }
  mark(label) { this.items.push({ size: 0, mark: label }); return this; }
  build() {
    let offset = 0;
    const marks = new Map();
    for (const item of this.items) {
      if (item.mark !== undefined) marks.set(item.mark, offset);
      offset += item.size;
    }
    const out = [];
    let at = 0;
    for (const item of this.items) {
      if (item.mark !== undefined) continue;
      if (item.label !== undefined) {
        const target = marks.get(item.label);
        assert.ok(target !== undefined, `no such label ${item.label} in this fixture`);
        out.push(Buffer.concat([u8(0x9d), u16(2), i16(target - (at + 5))]));
      } else out.push(item.emit());
      at += item.size;
    }
    return Buffer.concat(out);
  }
}

function defineFunction2(name, parameters, registerCount, body) {
  const header = [cstr(name), u16(parameters.length), u8(registerCount), u16(0)];
  for (const parameter of parameters) header.push(u8(parameter.register), cstr(parameter.name));
  header.push(u16(body.length));
  const payload = Buffer.concat(header);
  return Buffer.concat([u8(0x8e), u16(payload.length), payload, body]);
}

/* ────────────────────────────  the SWF writer  ───────────────────────────── */

function tag(code, body) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.alloc(0);
  if (bytes.length >= 0x3f) return Buffer.concat([u16((code << 6) | 0x3f), u32(bytes.length), bytes]);
  return Buffer.concat([u16((code << 6) | bytes.length), bytes]);
}

/** A zero RECT: one 5-bit width of 0 and five padding bits. */
const emptyRect = Buffer.from([0x00]);
/** An IDENTITY MATRIX: no scale, no rotate, a 0-bit translate. */
const identityMatrix = Buffer.from([0x00]);

const SHOW_FRAME = tag(1);
const END_TAG = tag(0);
const removeObject2 = (depth) => tag(28, u16(depth));

/** DefineShape3 — `indexCharacters` reads the id and this file draws nothing. */
const defineShape = (id) => tag(32, Buffer.concat([u16(id), emptyRect, u8(0), u8(0), Buffer.from([0x00])]));

/** A GLOW (filter id 2): RGBA, blurX, blurY as FIXED, strength as FIXED8, flags. */
function glow({ red, green, blue, blur, strength = 2 }) {
  const fixed = (value) => { const out = Buffer.alloc(4); out.writeInt32LE(Math.round(value * 65536)); return out; };
  const fixed8 = (value) => { const out = Buffer.alloc(2); out.writeInt16LE(Math.round(value * 256)); return out; };
  // flags 0x21: one pass, compositeSource set, inner and knockout clear — the
  // shape every glow in the shipped build has.
  return Buffer.concat([u8(2), u8(red), u8(green), u8(blue), u8(255), fixed(blur), fixed(blur), fixed8(strength), u8(0x21)]);
}

function place3({ depth, characterId, name, filters, matrix = identityMatrix }) {
  let flags = 0x02 | 0x04;
  let flags2 = 0;
  if (name !== undefined) flags |= 0x20;
  // `Array.isArray` and not truthiness: an EMPTY list must still set the flag,
  // because "cleared" is the fact this fixture exists to encode.
  if (Array.isArray(filters)) flags2 |= 0x01;
  const parts = [u8(flags), u8(flags2), u16(depth), u16(characterId), matrix];
  if (name !== undefined) parts.push(cstr(name));
  if (Array.isArray(filters)) parts.push(u8(filters.length), ...filters);
  return tag(70, Buffer.concat(parts));
}

function place2({ depth, characterId, name }) {
  let flags = 0x02 | 0x04;
  if (name !== undefined) flags |= 0x20;
  const parts = [u8(flags), u16(depth), u16(characterId), identityMatrix];
  if (name !== undefined) parts.push(cstr(name));
  return tag(26, Buffer.concat(parts));
}

const defineSprite = (id, frames, inner) =>
  tag(39, Buffer.concat([u16(id), u16(frames), ...inner, END_TAG]));

const exportAssets = (pairs) =>
  tag(56, Buffer.concat([u16(pairs.length), ...pairs.flatMap(([id, name]) => [u16(id), cstr(name)])]));

const doAction = (actions) => tag(12, Buffer.concat([actions.build(), u8(OP.End)]));

/**
 * DefineButton2. Only the CONDITION ACTIONS matter to this tool, so the button
 * record list is one terminating zero and `ActionOffset` points just past it.
 */
function defineButton2(id, conditions) {
  const records = conditions.map((condition, index) => {
    const body = Buffer.concat([condition.actions.build(), u8(OP.End)]);
    const last = index === conditions.length - 1;
    const size = last ? 0 : 4 + body.length;
    return Buffer.concat([u16(size), u16(condition.flags), body]);
  });
  // characterId, flags, ActionOffset — measured from the ActionOffset field
  // itself, which sits at +3, to the first condition record at +6.
  return tag(34, Buffer.concat([u16(id), u8(0), u16(3), u8(0), ...records]));
}

function swfFile(tags) {
  const header = Buffer.concat([Buffer.from("FWS", "latin1"), u8(6), u32(0), emptyRect, u16(24 << 8), u16(1)]);
  return Buffer.concat([header, ...tags, END_TAG]);
}

/* ──────────────────────────  the synthetic build  ────────────────────────── */

/**
 * ► **NOT ONE NAME OR NUMBER HERE IS THE ORACLE'S.** The instance is `blade`,
 *   not `weapon`; the types are 7, 8 and 9, not 2 to 5; the potencies are two,
 *   not three; the names are Alpha, Beta and Gamma. A tool carrying a hidden
 *   table of the real answer would fail every assertion in this file, which is
 *   the only way a test can tell derivation from recall.
 */
const FIXTURE = Object.freeze({
  member: "blade",
  artCharacter: 900,
  innerCharacter: 901,
  shapeCharacter: 902,
  parentCharacter: 910,
  linkage: "blade0",
  innerInstance: "sharpbit",
  types: [7, 8, 9],
  potencies: [1, 2],
  defaultBelow: 7,
  defaultFrame: 1,
  // THE TWO HALVES THE CROSS-CHECK JOINS, and they are two separate tables on
  // purpose: `ladderFrame` writes the FUNCTION BODY and `palette` writes the
  // FILTER LISTS. Their only shared coordinate is the frame number.
  ladderFrame: (type, potency) => 2 * (type - 7) + potency + 1,
  palette: Object.freeze({
    7: Object.freeze([{ red: 0x11, green: 0x22, blue: 0x33 }, { red: 0x44, green: 0x55, blue: 0x66 }]),
    8: Object.freeze([{ red: 0x77, green: 0x88, blue: 0x99 }, { red: 0xaa, green: 0xbb, blue: 0xcc }]),
    9: Object.freeze([{ red: 0xdd, green: 0xee, blue: 0xff }, { red: 0x01, green: 0x02, blue: 0x03 }])
  }),
  // Blur grows with potency, which is what `potencyOrdersBlur` measures.
  blurFor: (potency, slot) => (slot === 0 ? 3 : 6) * potency,
  typeNames: Object.freeze(["", "", "", "", "", "", "", "Alpha", "Beta", "Gamma"]),
  potencyNames: Object.freeze(["", "Faint", "Fierce"]),
  icons: Object.freeze({ 7: "icon_alpha", 8: "icon_beta", 9: "icon_gamma" }),
  buttons: Object.freeze({ 7: 3101, 8: 3102, 9: 3103 }),
  statuses: Object.freeze({ 7: "scorched", 8: "chilled", 9: "drained" }),
  tooltips: Object.freeze({ 7: "Alpha - it sears", 8: "Beta - it bites", 9: "Gamma - it drains" })
});

const frameCount = () => 1 + FIXTURE.types.length * FIXTURE.potencies.length;

/** The registers `itemglow` uses, deliberately NOT in parameter order. */
const REG = Object.freeze({ whichitem: 1, potency: 2, type: 3 });

/**
 * `itemglow`'s body, written as the build writes it: a `Less2` guard, then one
 * `Equals2` guard per type, each holding one `Equals2` guard per potency, each
 * holding one `gotoAndStop`.
 *
 * `options` lets a test break exactly one thing: `omit` drops one cell,
 * `poison` splices in an instruction no pattern can name.
 */
function itemglowBody({ omit = null, poison = false } = {}) {
  const actions = new Actions();
  const pool = ["gotoAndStop"];
  actions.constantPool(pool);
  // `enchant_type < 2` -> frame 1, and NO return: the build falls through.
  actions.push(R(REG.type), I(FIXTURE.defaultBelow)).op(OP.Less2).op(OP.Not).jumpIfTrue("afterDefault");
  actions.push(I(FIXTURE.defaultFrame), I(1), R(REG.whichitem), C(0)).op(OP.CallMethod).op(OP.Pop);
  actions.mark("afterDefault");
  for (const type of FIXTURE.types) {
    actions.push(R(REG.type), I(type)).op(OP.Equals2).op(OP.Not).jumpIfTrue(`afterType${type}`);
    for (const potency of FIXTURE.potencies) {
      if (omit && omit.type === type && omit.potency === potency) continue;
      actions.push(R(REG.potency), I(potency)).op(OP.Equals2).op(OP.Not).jumpIfTrue(`afterCell${type}_${potency}`);
      actions.push(I(FIXTURE.ladderFrame(type, potency)), I(1), R(REG.whichitem), C(0))
        .op(OP.CallMethod).op(OP.Pop);
      actions.mark(`afterCell${type}_${potency}`);
    }
    actions.mark(`afterType${type}`);
  }
  // ► **THE REALISTIC WAY A LITERAL-MATCHING READER GOES WRONG: a COMPUTED
  //   frame.** `whichitem.gotoAndStop(enchant_potency + 1)` is a perfectly
  //   ordinary thing for a build to do and there is no literal frame number in
  //   it at all. The reader must refuse rather than match the `gotoAndStop`
  //   half and invent an index — which is the case the living head's note about
  //   not needing an AVM1 interpreter is conditional on.
  if (poison) {
    actions.push(R(REG.potency), I(1)).op(OP.Add2)
      .push(I(1), R(REG.whichitem), C(0)).op(OP.CallMethod).op(OP.Pop);
  }
  return actions.build();
}

/** The art clip: one bare frame, then one frame per (type, potency) cell. */
function artSprite({ moveOnFrame = null, clearOnFrame = null, palette = FIXTURE.palette, blurFor = FIXTURE.blurFor } = {}) {
  const inner = [];
  const byFrame = new Map();
  for (const type of FIXTURE.types) {
    for (const potency of FIXTURE.potencies) byFrame.set(FIXTURE.ladderFrame(type, potency), { type, potency });
  }
  for (let frame = 1; frame <= frameCount(); frame += 1) {
    if (frame > 1) inner.push(removeObject2(1));
    const cell = byFrame.get(frame);
    // A FILTER LIST OF COUNT ZERO is a different fact from no filter list at
    // all: the instance has had its filters CLEARED. `place3` writes the flag
    // and a zero count, which is exactly what a `PlaceObject3` can carry.
    const filters = frame === clearOnFrame
      ? []
      : cell
        ? palette[cell.type].map((colour, slot) => glow({ ...colour, blur: blurFor(cell.potency, slot) }))
        : null;
    // A MOVED placement, for the negative case: the matrix is the one thing
    // `bodySignature` is watching that the filter list is not.
    // No scale, no rotate, a 5-bit translate of tx=4 twips: `0x0A 0x40 0x00`.
    const matrix = frame === moveOnFrame ? Buffer.from([0x0a, 0x40, 0x00]) : identityMatrix;
    inner.push(place3({
      depth: 1, characterId: FIXTURE.innerCharacter, name: FIXTURE.innerInstance, filters, matrix
    }));
    inner.push(SHOW_FRAME);
  }
  return defineSprite(FIXTURE.artCharacter, frameCount(), inner);
}

/** `damagecharacter`: the proc roll, then one status per type. */
function damagecharacterBody() {
  const actions = new Actions();
  actions.push(S("magicweapon_percentage"), I(100), I(1), I(2), S("randomBetween"))
    .op(OP.CallFunction).op(OP.SetVariable);
  actions.push(S("magicweapon_percentage")).op(OP.GetVariable);
  actions.push(R(4), S("weapon_enchantment_potency")).op(OP.GetMember);
  actions.push(I(10)).op(OP.Multiply).op(OP.Less2).op(OP.Not).jumpIfTrue("noProc");
  // A boolean flag of its own, outside every enchantment arm: counted as
  // `otherBooleanFlags`, never as a status and never as a loss.
  actions.push(R(2), S("phasecomplete"), B(true)).op(OP.SetMember);
  for (const type of FIXTURE.types) {
    actions.push(R(4), S("weapon_enchantment_type")).op(OP.GetMember);
    actions.push(I(type)).op(OP.Equals2).op(OP.Not).jumpIfTrue(`noStatus${type}`);
    actions.push(R(3), S(FIXTURE.statuses[type]), B(true)).op(OP.SetMember);
    actions.mark(`noStatus${type}`);
  }
  actions.mark("noProc");
  return actions.build();
}

/** `battlevalues`: the enchantment damage formula, primary and secondary. */
function battlevaluesBody() {
  const actions = new Actions();
  for (const prefix of ["weapon", "secondary_weapon"]) {
    actions.push(R(3), S(`${prefix}_enchantment_damage`), R(3), S(`${prefix}_max_damage`)).op(OP.GetMember);
    actions.push(I(3)).op(OP.Divide);
    actions.push(R(3), S(`${prefix}_enchantment_potency`)).op(OP.GetMember).op(OP.Multiply);
    actions.push(I(1), S("Math")).op(OP.GetVariable);
    actions.push(S("ceil")).op(OP.CallMethod).op(OP.SetMember);
  }
  return actions.build();
}

/** `new Array(…)`, whose arguments AVM1 pushes backwards. */
function arrayLiteral(actions, variable, entries) {
  actions.push(S(variable), ...[...entries].reverse().map(S), I(entries.length), S("Array"))
    .op(OP.NewObject).op(OP.SetVariable);
  return actions;
}

function buildSwf(options = {}) {
  const root = new Actions();
  root.raw(defineFunction2(
    SEARCH_KEYS.selector,
    [{ register: REG.whichitem, name: "whichitem" },
     { register: REG.type, name: "enchant_type" },
     { register: REG.potency, name: "enchant_potency" }],
    5,
    itemglowBody(options)
  ));
  // A caller, so the member name `blade` is derivable and the art clip with it.
  root.push(S("enchant_potency")).op(OP.GetVariable);
  root.push(S("enchant_type")).op(OP.GetVariable);
  root.push(S("hero")).op(OP.GetVariable);
  root.push(S(FIXTURE.member)).op(OP.GetMember);
  root.push(I(3), R(1), S(SEARCH_KEYS.selector)).op(OP.CallMethod).op(OP.Pop);
  root.raw(defineFunction2(SEARCH_KEYS.damage, [{ register: 5, name: "defender" }], 8, damagecharacterBody()));
  root.raw(defineFunction2(SEARCH_KEYS.values, [{ register: 3, name: "whichcharacter" }], 4, battlevaluesBody()));
  arrayLiteral(root, SEARCH_KEYS.typeNames, FIXTURE.typeNames);
  arrayLiteral(root, SEARCH_KEYS.potencyNames, FIXTURE.potencyNames);

  const buttons = FIXTURE.types.map((type) => defineButton2(FIXTURE.buttons[type], [
    {
      flags: 1,
      actions: new Actions()
        .push(S("bubbletext"), S(FIXTURE.tooltips[type])).op(OP.SetVariable)
        .push(S(FIXTURE.icons[type])).op(OP.GetVariable)
        .push(S("_alpha"), I(100)).op(OP.SetMember)
    },
    {
      flags: 8,
      actions: new Actions()
        .push(S(SEARCH_KEYS.shopVariable), I(type)).op(OP.SetVariable)
    }
  ]));

  return swfFile([
    defineShape(FIXTURE.shapeCharacter),
    defineSprite(FIXTURE.innerCharacter, 1, [place2({ depth: 1, characterId: FIXTURE.shapeCharacter }), SHOW_FRAME]),
    artSprite(options),
    defineSprite(FIXTURE.parentCharacter, 1, [
      place2({ depth: 4, characterId: FIXTURE.artCharacter, name: FIXTURE.member }), SHOW_FRAME
    ]),
    exportAssets([[FIXTURE.artCharacter, FIXTURE.linkage]]),
    ...buttons,
    doAction(root),
    SHOW_FRAME
  ]);
}

/* ────────────────────────────────  the tests  ────────────────────────────── */

test("THE LADDER IS READ OUT OF THE BYTES, register names and all", () => {
  const pack = extractEnchantments(buildSwf());
  assert.equal(pack.ladder.matched, true, `the selector must be readable: ${JSON.stringify(pack.ladder)}`);

  // The decoder against the encoder. `expected` is built from the SAME table
  // the function body was written from, so this checks the READER, not the
  // build — the colour join two tests down is what checks the derivations
  // against each other.
  const expected = [];
  for (const type of FIXTURE.types) {
    for (const potency of FIXTURE.potencies) expected.push({ type, potency, frame: FIXTURE.ladderFrame(type, potency) });
  }
  assert.deepEqual(
    pack.ladder.cells.map(({ type, potency, frame }) => ({ type, potency, frame }))
      .sort((left, right) => left.frame - right.frame),
    expected.sort((left, right) => left.frame - right.frame)
  );
  assert.deepEqual(pack.ladder.types, FIXTURE.types);
  assert.deepEqual(pack.ladder.potencies, FIXTURE.potencies);
  assert.deepEqual(pack.ladder.default, {
    below: FIXTURE.defaultBelow, frame: FIXTURE.defaultFrame,
    at: pack.ladder.default.at, condition: `enchant_type < ${FIXTURE.defaultBelow}`, fallsThrough: true
  });
  // The PARAMETER NAMES come from the `DefineFunction2` header and the roles
  // from those names, so a build that renamed them would refuse rather than
  // transpose the table.
  assert.deepEqual(pack.ladder.roles, { object: "whichitem", type: "enchant_type", potency: "enchant_potency" });

  // ► **THE ACCOUNTING IS AN ASSERTION.** If the reader consumed fewer
  //   instructions than the body holds, something in there is doing work it
  //   cannot see, and the table is a partial read wearing a complete one's face.
  assert.equal(pack.ladder.instructionsMatched, pack.ladder.instructionsInBody);
  assert.equal(pack.ladder.guards, 1 + FIXTURE.types.length + FIXTURE.types.length * FIXTURE.potencies.length);
  assert.equal(pack.ladder.calls, 1 + FIXTURE.types.length * FIXTURE.potencies.length);
  assert.equal(pack.ladder.closedForm.holds, true);
});

test("THE ART IS READ FROM THE CLIP THE CALLERS NAME, not from a character id in the tool", () => {
  const pack = extractEnchantments(buildSwf());
  // The join: `blade` is only ever mentioned as a GetMember in the caller and
  // as an instance name on a placement. Nothing in the tool knows it.
  assert.deepEqual(pack.callers.map((caller) => caller.member), [FIXTURE.member]);
  assert.equal(pack.art.matched, true, `the art must be readable: ${JSON.stringify(pack.art)}`);
  assert.equal(pack.art.member, FIXTURE.member);
  assert.equal(pack.art.character, FIXTURE.artCharacter);
  assert.equal(pack.art.linkage, FIXTURE.linkage);
  assert.equal(pack.art.frameCount, frameCount());
  assert.deepEqual(pack.art.inner, { instance: FIXTURE.innerInstance, depth: 1, character: FIXTURE.innerCharacter });

  // ► **THE GLOW IS ON THE ENCLOSING SPRITE AND ON NO LEAF, and this is the
  //   distinction `tools/extract-props.mjs` lost its headline over.** A zero
  //   here with no denominator beside it would be the same shape whether the
  //   build has none or the reader dropped them.
  assert.equal(pack.art.ownFilteredLeaves, 0);
  assert.ok(pack.art.leafPlacements > 0, "a zero own count needs a denominator that is not also zero");
  assert.equal(pack.invoice.art.framesBare, 1);
  assert.equal(pack.invoice.art.framesWithAGlow, frameCount() - 1);
  assert.equal(pack.invoice.art.enclosingFilters, (frameCount() - 1) * 2);
  // `null`, not `[]`: a cleared list and an absent one are different facts.
  assert.equal(pack.art.frames[0].filters, null);
});

test("THE LADDER AND THE GLOW COLOURS ARE TWO DERIVATIONS AND THEY HAVE TO AGREE", () => {
  const pack = extractEnchantments(buildSwf());
  assert.equal(pack.crossCheck.ran, true);

  // ► **RECOMPUTED HERE, NOT READ OFF `pack.crossCheck`.** The tool's own
  //   verdict is checked at the end; this block rebuilds the join from the two
  //   halves of the pack so a tool that published `families: true` beside a
  //   table that disagrees would fail.
  const paletteOf = (frame) =>
    (pack.art.frames.find((entry) => entry.frame === frame)?.filters ?? [])
      .map((filter) => `${filter.colour.red},${filter.colour.green},${filter.colour.blue}`).join("+");

  const palettes = new Map();
  for (const type of pack.ladder.types) {
    const frames = pack.ladder.cells.filter((cell) => cell.type === type).map((cell) => cell.frame);
    const distinct = [...new Set(frames.map(paletteOf))];
    assert.equal(distinct.length, 1,
      `type ${type} owns frames ${frames} and they must share ONE palette, not ${distinct.length}`);
    assert.notEqual(distinct[0], "", `type ${type} must own a glow`);
    palettes.set(type, distinct[0]);
  }
  assert.equal(new Set(palettes.values()).size, palettes.size, "two types must not share a palette");

  // And the potency order, which is what makes "the other two frames are
  // potencies, not a pulse" a measurement rather than a reading.
  for (const type of pack.ladder.types) {
    const series = pack.ladder.potencies.map((potency) => {
      const cell = pack.ladder.cells.find((entry) => entry.type === type && entry.potency === potency);
      return (pack.art.frames.find((entry) => entry.frame === cell.frame)?.filters ?? []).map((filter) => filter.blurX);
    });
    for (let step = 1; step < series.length; step += 1) {
      for (let slot = 0; slot < series[step].length; slot += 1) {
        assert.ok(series[step][slot] > series[step - 1][slot],
          `type ${type} slot ${slot}: blur must grow with potency, got ${series[step - 1][slot]} then ${series[step][slot]}`);
      }
    }
  }

  assert.deepEqual(pack.crossCheck.failed, []);
  assert.equal(pack.types.emitted, true);
  assert.deepEqual(pack.types.rows.map((row) => row.type), FIXTURE.types);
});

test("THE NAMES COME FROM THREE WITNESSES AND ALL THREE ARE KEPT", () => {
  const pack = extractEnchantments(buildSwf());
  assert.equal(pack.typeNames.matched, true, JSON.stringify(pack.typeNames));
  assert.deepEqual(pack.typeNames.entries, [...FIXTURE.typeNames]);
  assert.equal(pack.potencyNames.matched, true, JSON.stringify(pack.potencyNames));
  assert.deepEqual(pack.potencyNames.entries, [...FIXTURE.potencyNames]);
  assert.deepEqual(
    pack.shop.map((row) => ({ button: row.button, type: row.type, icon: row.icon, tooltip: row.tooltip })),
    FIXTURE.types.map((type) => ({
      button: FIXTURE.buttons[type], type, icon: FIXTURE.icons[type], tooltip: FIXTURE.tooltips[type]
    }))
  );
  // ► **THE ARRAY IS READ BACKWARDS OFF THE WIRE AND FORWARDS INTO THE TABLE.**
  //   `new Array(a, b, c)` is pushed as `c, b, a, 3, "Array"`, so a reader that
  //   took the operands in order would put Gamma at index 7. The entries above
  //   are asserted in SOURCE order, which is the only order that can catch it.
  assert.equal(pack.typeNames.entries[FIXTURE.types[0]], FIXTURE.typeNames[FIXTURE.types[0]]);
  assert.equal(pack.typeNames.entries[FIXTURE.types.at(-1)], FIXTURE.typeNames[FIXTURE.types.at(-1)]);

  const joined = pack.types.rows;
  for (const row of joined) {
    assert.equal(row.name, FIXTURE.typeNames[row.type]);
    assert.equal(row.icon, FIXTURE.icons[row.type]);
    assert.equal(row.status, FIXTURE.statuses[row.type]);
    assert.deepEqual(row.potencies.map((entry) => entry.name), FIXTURE.potencies.map((p) => FIXTURE.potencyNames[p]));
  }
});

test("THE RULES ARE REPORTED WITH THEIR OFFSETS AND NOT IMPLEMENTED", () => {
  const pack = extractEnchantments(buildSwf());
  assert.equal(pack.rules.procChance.matched, true, JSON.stringify(pack.rules.procChance));
  assert.equal(pack.rules.procChance.expression, "randomBetween(1, 100) < weapon_enchantment_potency * 10");
  assert.deepEqual(pack.rules.procChance.roll.arguments, [1, 100], "randomBetween's arguments are pushed backwards");
  assert.equal(pack.rules.enchantmentDamage.matched, true);
  assert.deepEqual(pack.rules.enchantmentDamage.formulas.map((formula) => formula.expression), [
    "weapon_enchantment_damage = Math.ceil(weapon_max_damage / 3 * weapon_enchantment_potency)",
    "secondary_weapon_enchantment_damage = Math.ceil(secondary_weapon_max_damage / 3 * secondary_weapon_enchantment_potency)"
  ]);
  assert.equal(pack.rules.statuses.matched, true);
  assert.deepEqual(
    pack.rules.statuses.rows.map((row) => [row.type, row.status]),
    FIXTURE.types.map((type) => [type, FIXTURE.statuses[type]])
  );
  // ► **A STATUS CITES EVERY GUARD THAT GATES IT.** The shipped build tests the
  //   MAIN hand and then the OFF hand before setting one flag, so citing only
  //   the last comparison would read as though the main weapon's enchantment
  //   did not apply. The fixture has one guard per arm; the field is a LIST
  //   either way, so a reader never has to know which build they are holding.
  for (const row of pack.rules.statuses.rows) {
    assert.deepEqual(row.guardedBy, ["weapon_enchantment_type"]);
    assert.equal(row.guardAt.length, row.guardedBy.length);
  }
  // The build's own unrelated boolean flag: COUNTED and named, and deliberately
  // NOT in the loss tally, because nothing was lost.
  assert.deepEqual(pack.rules.statuses.otherBooleanFlags.map((entry) => entry.flag), ["phasecomplete"]);
  assert.equal(pack.invoice.notCarried.ruleStatusWithoutGuard, undefined);
  assert.match(pack.rules.note, /NOT IMPLEMENTED HERE/);
});

test("A NESTED SPRITE FROZEN ON FRAME 1 SEES NONE OF THE GLOWS, which is why a figure extraction cannot reach them", () => {
  const pack = extractEnchantments(buildSwf());
  assert.equal(pack.inSitu.length, 1, "the fixture places the clip in exactly one parent");
  const row = pack.inSitu[0];
  assert.equal(row.parent, FIXTURE.parentCharacter);
  // The whole finding, in two numbers on one line.
  assert.equal(row.atFrameOne, 0);
  assert.equal(row.reachableFilters, (frameCount() - 1) * 2);
  assert.equal(row.byFrame.length, frameCount());
});

/* ───────────────────  the builds that must be REFUSED  ───────────────────── */

test("AN INCOMPLETE LADDER IS REFUSED AND THE MISSING CELL IS NAMED", () => {
  const omit = { type: FIXTURE.types[1], potency: FIXTURE.potencies[1] };
  const pack = extractEnchantments(buildSwf({ omit }));
  assert.equal(pack.ladder.matched, false);
  assert.equal(pack.ladder.reason, "ladderIncomplete");
  assert.deepEqual(pack.ladder.missing, [omit], "a ladder right for two types out of three is worse than no ladder");
  assert.equal(pack.invoice.notCarried.selectorLadderIncomplete, 1);
  // And the joined table is withheld rather than published three rows short.
  assert.equal(pack.types.emitted, false);
  assert.equal(pack.crossCheck.ran, false);
});

test("A COMPUTED FRAME IS REFUSED RATHER THAN HALF-MATCHED, with its offset", () => {
  const pack = extractEnchantments(buildSwf({ poison: true }));
  assert.equal(pack.ladder.matched, false);
  assert.equal(pack.ladder.reason, "unrecognisedInstruction");
  // ► **THE REFUSAL LANDS ON THE FIRST INSTRUCTION NO PATTERN CAN CONSUME**,
  //   which for `gotoAndStop(potency + 1)` is the `Push` that starts the
  //   arithmetic rather than the `Add2` a reader might expect. The name matters
  //   less than the fact that it stops there and says where.
  assert.equal(pack.ladder.instruction, "Push");
  assert.match(pack.ladder.at, /^0x[0-9a-f]+$/);
  // ► **A PARTIAL READ NAMES ITS OWN DENOMINATOR.** `instructionsMatched` is
  //   short of `instructionsInBody`, which is exactly the shape of the failure.
  assert.ok(pack.ladder.instructionsMatched < pack.ladder.instructionsInBody);
  assert.equal(pack.invoice.notCarried.selectorUnrecognisedInstruction, 1);
});

test("A FRAME THAT MOVES ANYTHING BUT ITS FILTER LIST IS REFUSED", () => {
  const pack = extractEnchantments(buildSwf({ moveOnFrame: 3 }));
  assert.equal(pack.art.matched, false);
  assert.ok(
    ["artMovesBetweenFrames", "artTimelineMovesBetweenFrames"].includes(pack.art.reason),
    `expected a move refusal, got ${pack.art.reason}`
  );
  assert.ok(pack.art.differingFrames.includes(3));
  assert.equal(pack.types.emitted, false);
});

test("A PALETTE THAT CROSSES A FAMILY BOUNDARY FAILS THE CROSS-CHECK AND WITHHOLDS THE TABLE", () => {
  // One type's two frames given two different colours: the ladder still reads,
  // the art still reads, and the JOIN is the thing that breaks.
  const palette = { ...FIXTURE.palette, 8: [{ red: 1, green: 2, blue: 3 }, { red: 4, green: 5, blue: 6 }] };
  const crossed = {
    ...FIXTURE.palette,
    8: FIXTURE.palette[9]   // type 8 now wears type 9's colours
  };
  const pack = extractEnchantments(buildSwf({ palette: crossed }));
  assert.equal(pack.ladder.matched, true, "the ladder is unaffected — the halves really are independent");
  assert.equal(pack.art.matched, true, "and so is the art");
  assert.equal(pack.crossCheck.checks.families, false);
  assert.ok(pack.crossCheck.failed.includes("families"));
  assert.equal(pack.types.emitted, false);
  assert.match(pack.types.reason, /families/);
  assert.ok(palette, "kept so the alternative break is visible beside the one used");
});

test("A BLUR THAT DOES NOT GROW WITH POTENCY FAILS THE POTENCY CHECK", () => {
  // The three frames of a family are three POTENCIES, and this is the check
  // that says so. Reverse the growth and it fires.
  const pack = extractEnchantments(buildSwf({ blurFor: (potency, slot) => (slot === 0 ? 30 : 60) - potency }));
  assert.equal(pack.ladder.matched, true);
  assert.equal(pack.art.matched, true);
  assert.equal(pack.crossCheck.checks.families, true, "colours still partition — only the ORDER broke");
  assert.equal(pack.crossCheck.checks.potencyOrdersBlur, false);
  assert.equal(pack.types.emitted, false);
});

test("A FILTER LIST OF COUNT ZERO IS `CLEARED`, NOT `NOBODY ASKED`, and is refused by that name", () => {
  // ► **THE DISTINCTION `tools/extract-props.mjs` DRAWS AT `ownEffectsOf`, on
  //   the enclosing placement instead of the leaf.** A `PlaceObject3` can carry
  //   a filter list of COUNT ZERO; writing that out as `filters: []` would make
  //   it indistinguishable from a frame nobody put a glow on, and writing it out
  //   as `null` with no counter would lose it entirely. It is `null` AND a named
  //   entry in the loss tally.
  const cleared = FIXTURE.ladderFrame(FIXTURE.types[0], FIXTURE.potencies[0]);
  const pack = extractEnchantments(buildSwf({ clearOnFrame: cleared }));
  assert.equal(pack.art.matched, true, "a cleared list is a readable frame, not an unreadable one");
  const frame = pack.art.frames.find((entry) => entry.frame === cleared);
  assert.equal(frame.filters, null, "a cleared list must not be written out as an empty one");
  assert.ok(pack.invoice.notCarried.emptyFilterList > 0,
    `the cleared list must be COUNTED: ${JSON.stringify(pack.invoice.notCarried)}`);
  // And a cell frame with no glow breaks the join, so the table is withheld.
  assert.equal(pack.crossCheck.checks.everyCellFrameGlows, false);
  assert.equal(pack.types.emitted, false);
});

/* ────────────────────────────  the small parts  ──────────────────────────── */

test("`callArgumentsFrom` reverses the wire order and refuses a partial match", () => {
  const operands = [
    { type: "string", value: "names" },
    { type: "string", value: "third" }, { type: "string", value: "second" }, { type: "string", value: "first" },
    { type: "integer", value: 3 }, { type: "string", value: "Array" }
  ];
  assert.deepEqual(callArgumentsFrom(operands), {
    callee: "Array", count: 3, args: ["first", "second", "third"], leading: ["names"]
  });
  // A count that does not match the operands present is a REFUSAL, not a
  // shorter array: a short read here would silently renumber a name table.
  assert.equal(callArgumentsFrom([...operands.slice(0, 3), operands[4], operands[5]]), null);
  assert.equal(callArgumentsFrom([{ type: "integer", value: 1 }]), null);
});

test("the report names every refusal it prints a zero beside", () => {
  const pack = extractEnchantments(buildSwf());
  const lines = reportLines(pack, "/nowhere").join("\n");
  assert.match(lines, /instructions matched/);
  // ► **THE ZERO AND ITS DENOMINATOR ON ONE LINE.** `0 own filters` on its own
  //   is the sentence `tools/extract-props.mjs` published and had to retract.
  assert.match(lines, /0 of \d+ leaf placement\(s\) carry an own filter/);
  assert.match(lines, /approximated/);
  assert.match(lines, /NOT IMPLEMENTED/);
  assert.match(lines, /cross-check: .*families=ok/);

  const payload = packFor({ source: "synthetic.swf", sha256: "0".repeat(64), pack });
  assert.equal(payload.matchesOracle, false);
  assert.equal(payload.oracleSha256, ORACLE_SHA256);
  assert.ok(Array.isArray(payload.invoice.scope) && payload.invoice.scope.length > 0,
    "the pack must say in words what it cannot see at all");
});

/* ─────────────────────────────  the oracle half  ─────────────────────────── */

test("THE INSTALLED BUILD, when there is one: the two derivations agree on it too", (t) => {
  // Anchored on a TRACKED file, so a broken path derivation FAILS by name here
  // rather than reading as "no installed copy" and asserting nothing — the trap
  // `test/extract-props.test.js` records paying for twice.
  const tool = path.join(REPO_ROOT, "tools", "extract-enchantments.mjs");
  assert.ok(fs.existsSync(tool),
    `${tool} is not there, so REPO_ROOT is wrong and the absence below would mean nothing`);

  const at = process.env.SS2_SWF ?? DEFAULT_SWF;
  if (!fs.existsSync(at)) {
    t.diagnostic("no installed SS2 build on this machine — this test compared NOTHING; " +
      "every other test in this file ran against the synthetic build above");
    return;
  }

  const pack = extractEnchantments(fs.readFileSync(at));
  assert.equal(pack.ladder.matched, true, `the installed build's selector: ${JSON.stringify(pack.ladder)}`);
  assert.equal(pack.art.matched, true, `the installed build's art: ${JSON.stringify(pack.art)}`);
  assert.equal(pack.ladder.instructionsMatched, pack.ladder.instructionsInBody,
    "every instruction in the installed selector must be accounted for");

  // ► **NO NUMBER FROM THE BUILD IS PASTED IN HERE.** Every assertion is one
  //   derivation against another, so this stays true of a build this repository
  //   has never seen — which is the only way a claim about the bytes is worth
  //   making twice.
  assert.equal(pack.art.frameCount, 1 + pack.ladder.types.length * pack.ladder.potencies.length,
    "the clip must have exactly one frame per cell plus the unenchanted one");
  assert.deepEqual(pack.crossCheck.failed, [],
    `the installed build's halves disagree: ${JSON.stringify(pack.crossCheck.detail)}`);
  assert.equal(pack.types.emitted, true);

  const paletteOf = (frame) =>
    (pack.art.frames.find((entry) => entry.frame === frame)?.filters ?? [])
      .map((filter) => `${filter.colour.red},${filter.colour.green},${filter.colour.blue}`).join("+");
  const palettes = new Set();
  for (const type of pack.ladder.types) {
    const frames = pack.ladder.cells.filter((cell) => cell.type === type).map((cell) => cell.frame);
    const distinct = [...new Set(frames.map(paletteOf))];
    assert.equal(distinct.length, 1, `installed type ${type}: frames ${frames} must share one palette`);
    palettes.add(distinct[0]);
  }
  assert.equal(palettes.size, pack.ladder.types.length, "no two installed types may share a palette");

  // The glow is on the ENCLOSING placement and on no leaf, with a denominator.
  assert.equal(pack.art.ownFilteredLeaves, 0);
  assert.ok(pack.art.leafPlacements > 0);
  // And an extraction that freezes the nested clip on frame 1 sees none of it.
  assert.ok(pack.inSitu.length > 0, "the installed build places the clip somewhere");
  for (const row of pack.inSitu) {
    assert.equal(row.atFrameOne, 0, `parent ${row.parent} must see nothing with the clip frozen on frame 1`);
    assert.ok(row.reachableFilters > 0, `parent ${row.parent} must see the glows once the frame is varied`);
  }

  t.diagnostic(
    `installed build ${fs.statSync(at).size} bytes: ${pack.ladder.types.length} types x ` +
    `${pack.ladder.potencies.length} potencies over ${pack.art.frameCount} frames of character ` +
    `${pack.art.character}; ${pack.invoice.art.enclosingFilters} enclosing filters, ` +
    `${pack.art.ownFilteredLeaves} own; names ${JSON.stringify(pack.typeNames.entries ?? null)}`
  );
});
