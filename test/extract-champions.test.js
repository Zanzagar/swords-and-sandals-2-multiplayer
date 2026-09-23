/**
 * THE TOURNAMENT CHAMPIONS, out of `unleash_hell`'s own bytecode.
 *
 * `tools/extract-champions.mjs` finds the function named `unleash_hell`, reads
 * its parameter's register off the `DefineFunction2` header, and takes every
 * `Push <that register>, <n>; Equals2; Not; If` guard as one champion's
 * branch — so the number of champions, their `which_boss` values and where
 * each branch ends all come from the bytes. This file writes those bytes.
 *
 * ► **NOTHING HERE IS THE BUILD'S.** Every name, quote, DNA field and
 *   `which_boss` value is invented, and the synthetic function deliberately
 *   differs from the real one wherever a lazy reader could lean on a constant:
 *   the parameter lives in register 4 (the build's is 3), `_root` and
 *   `_global` are preloaded into registers 2 and 3 (the build's are 1 and 2,
 *   because it suppresses `this`), the function sits on root frame 2 (the
 *   build's on 35), and the branches are `which_boss` 0, 3, 5 and 9 (the
 *   build's run 0..18). A tool with the real answer tucked away fails here.
 *
 * ► **AND THE REFUSALS ARE THE POINT OF HAVING A WRITER** (the reason
 *   `test/extract-enchantments.test.js` gives): on the shipped build every
 *   check passes, so only a deliberately broken build proves a check can fire.
 *
 * The writer is this file's own, not imported from another test: a shared
 * fixture builder makes one wrong assumption look like agreement.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ExtractChampionsError,
  ORACLE_SHA256,
  buildManifest,
  extractChampions,
  main,
  parseArguments
} from "../tools/extract-champions.mjs";
import { ss2ChampionFromDna } from "../src/team/ss2-champion-dna.js";

/* ─────────────────────────  the AVM1 assembler  ──────────────────────────── */

const u8 = (value) => Buffer.from([value & 0xff]);
const u16 = (value) => { const out = Buffer.alloc(2); out.writeUInt16LE(value & 0xffff); return out; };
const i16 = (value) => { const out = Buffer.alloc(2); out.writeInt16LE(value); return out; };
const u32 = (value) => { const out = Buffer.alloc(4); out.writeUInt32LE(value >>> 0); return out; };
const i32 = (value) => { const out = Buffer.alloc(4); out.writeInt32LE(value); return out; };
const cstr = (value) => Buffer.concat([Buffer.from(value, "utf8"), Buffer.from([0])]);

/** Push operands: integer, string, register, constant-pool index. */
const I = (value) => Buffer.concat([u8(0x07), i32(value)]);
const S = (value) => Buffer.concat([u8(0x00), cstr(value)]);
const R = (value) => Buffer.concat([u8(0x04), u8(value)]);
const C = (index) => Buffer.concat([u8(0x08), u8(index)]);

const OP = Object.freeze({
  End: 0x00, Not: 0x12, Pop: 0x17, GetVariable: 0x1c, SetVariable: 0x1d, RandomNumber: 0x30, NewObject: 0x40,
  Add2: 0x47, Equals2: 0x49, GetMember: 0x4e, SetMember: 0x4f
});

/** A relocatable instruction stream: `If` targets are labels, resolved in a second pass. */
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
  /** The `If` of the compiler's `if (!(r == k)) jump past` idiom. */
  jumpIfTrue(label) { this.items.push({ size: 5, label }); return this; }
  mark(label) { this.items.push({ size: 0, mark: label }); return this; }
  build() {
    const marks = new Map();
    let offset = 0;
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
        assert.ok(target !== undefined, `no label ${item.label}`);
        out.push(Buffer.concat([u8(0x9d), u16(2), i16(target - (at + 5))]));
      } else out.push(item.emit());
      at += item.size;
    }
    return Buffer.concat(out);
  }
}

/** DefineFunction2 with the flags word stated, so the preloads are the fixture's choice. */
function defineFunction2(name, parameters, registerCount, flags, body) {
  const header = [cstr(name), u16(parameters.length), u8(registerCount), u16(flags)];
  for (const parameter of parameters) header.push(u8(parameter.register), cstr(parameter.name));
  header.push(u16(body.length));
  const payload = Buffer.concat(header);
  return Buffer.concat([u8(0x8e), u16(payload.length), payload, body]);
}

function tag(code, body = Buffer.alloc(0)) {
  if (body.length >= 0x3f) return Buffer.concat([u16((code << 6) | 0x3f), u32(body.length), body]);
  return Buffer.concat([u16((code << 6) | body.length), body]);
}

const SHOW_FRAME = tag(1);
const END_TAG = tag(0);

function swfFile(tags) {
  const header = Buffer.concat([Buffer.from("FWS", "latin1"), u8(8), u32(0), Buffer.from([0x00]), u16(24 << 8), u16(3)]);
  const file = Buffer.concat([header, ...tags, END_TAG]);
  file.writeUInt32LE(file.length, 4);
  return file;
}

/* ──────────────────────────  the synthetic build  ────────────────────────── */

/**
 * `this` in r1, `_root` in r2, `_global` in r3 — PreloadThis 0x01,
 * SuppressArguments 0x08, SuppressSuper 0x20, PreloadRoot 0x40,
 * PreloadGlobal 0x100 — and the parameter in r4.
 */
const FLAGS = 0x01 | 0x08 | 0x20 | 0x40 | 0x100;
const PARAM = 4;
const ROOT = 2;
const GLOBAL = 3;

/** Fifty invented fields, each distinct, text at 0 and 28 as `initcharacter` reads them. */
function inventedDna(name, seed, { fields = 50 } = {}) {
  const values = Array.from({ length: fields }, (unused, index) => String((seed * 7 + index * 3) % 97));
  values[0] = name;
  values[28] = "no one";
  return values.join(",");
}

const LITERALS = Object.freeze([
  { whichBoss: 0, name: "Alpha Brute", quote: "Alpha has never read a book.", hat: "Pail", seed: 1 },
  { whichBoss: 3, name: "Beta Lancer", quote: "Beta, twice as late.", hat: "Colander", seed: 2 },
  { whichBoss: 5, name: "Gamma Warden", quote: "Gamma keeps the keys.", hat: null, seed: 3 }
]);
const MIRROR = 9;

const POOL = Object.freeze([
  "game", "champion", "Object", "charDNA", "character_name", "character_quote", "hat_name",
  "heroDNA", "hero", "villain", "Other ", "Array", "boss"
]);
const K = Object.fromEntries(POOL.map((name, index) => [name, index]));

/** `_root.game.champion` on the stack. */
function champion(actions) {
  return actions.push(R(ROOT), C(K.game)).op(OP.GetMember).push(C(K.champion)).op(OP.GetMember);
}

/**
 * `unleash_hell`'s body as the build shapes it: a flat run of guarded
 * branches, each making a fresh `game.champion` and writing string literals
 * onto it, one branch copying the hero instead, and a tail that makes the
 * champion the villain.
 */
function unleashHellBody({
  dnaFor = inventedDna, poison = null, duplicate = false, omitDnaFor = null,
  before = null, after = null, holderFor = () => K.champion,
  createAfterFor = null, creationFor = () => [I(0), C(K.Object)], omitTail = false,
  retainOldFor = null, setVariableFor = null,
  dottedCreateFor = null, computedWriteFor = null, variableRootFor = null,
  paramRegister = PARAM, storeRegisterBefore = null
} = {}) {
  const actions = new Actions();
  // Statements OUTSIDE every branch, which a test can add on either side.
  if (before) before(actions);
  // `r = 7`, kept off the stack: `Push 7; StoreRegister r; Pop`.
  if (storeRegisterBefore !== null) {
    actions.push(I(7)).raw(Buffer.from([0x87, 0x01, 0x00, storeRegisterBefore])).op(OP.Pop);
  }
  const branches = [...LITERALS, ...(duplicate ? [LITERALS[1]] : [])];
  branches.forEach((entry, index) => {
    const skip = `skip${index}`;
    actions.push(R(paramRegister), I(entry.whichBoss)).op(OP.Equals2).op(OP.Not).jumpIfTrue(skip);
    const holder = holderFor(entry.whichBoss);
    // `holder = new Object()`: the argument operands (pushed in AVM1 order,
    // last first), the count, the constructor name.
    const create = dottedCreateFor === entry.whichBoss
      // `_root["game.champion"] = new Object()`: ONE key with a dot in it, on
      // `_root` itself — not `_root.game.champion`, which is two keys deep.
      ? () => actions.push(R(ROOT), S("game.champion"), ...creationFor(entry.whichBoss)).op(OP.NewObject).op(OP.SetMember)
      : () => actions.push(R(ROOT), C(K.game)).op(OP.GetMember)
        .push(C(holder), ...creationFor(entry.whichBoss)).op(OP.NewObject).op(OP.SetMember);
    const onto = (member, value) => actions.push(R(ROOT), C(K.game)).op(OP.GetMember)
      .push(C(holder)).op(OP.GetMember).push(C(member), S(value)).op(OP.SetMember);
    if (retainOldFor === entry.whichBoss) {
      // The OLD champion, the DNA key and the DNA pushed first and kept on the
      // stack across the creation; the last SetMember then writes onto the
      // object read BEFORE the fresh one existed.
      actions.push(R(ROOT), C(K.game)).op(OP.GetMember).push(C(holder)).op(OP.GetMember)
        .push(C(K.charDNA), S(dnaFor(entry.name, entry.seed)));
      create();
      actions.op(OP.SetMember);
    } else if (computedWriteFor === entry.whichBoss) {
      // The DNA written through `_root.game["champ" + "ion"]`: a COMPUTED key.
      create();
      actions.push(R(ROOT), C(K.game)).op(OP.GetMember).push(S("champ"), S("ion")).op(OP.Add2).op(OP.GetMember)
        .push(C(K.charDNA), S(dnaFor(entry.name, entry.seed))).op(OP.SetMember);
    } else if (variableRootFor === entry.whichBoss) {
      // The DNA written through `GetVariable("_root").game.champion` — a root
      // looked up by NAME, not the register the function header preloads.
      create();
      actions.push(S("_root")).op(OP.GetVariable).push(C(K.game)).op(OP.GetMember).push(C(holder)).op(OP.GetMember)
        .push(C(K.charDNA), S(dnaFor(entry.name, entry.seed))).op(OP.SetMember);
    } else {
      if (createAfterFor !== entry.whichBoss) create();
      if (omitDnaFor !== entry.whichBoss) onto(K.charDNA, dnaFor(entry.name, entry.seed));
    }
    // A plain variable write inside a branch: `scratch = "x"`.
    if (setVariableFor === entry.whichBoss) actions.push(S("scratch"), S("x")).op(OP.SetVariable);
    onto(K.character_name, entry.name);
    onto(K.character_quote, entry.quote);
    if (poison === entry.whichBoss) actions.push(I(100)).op(OP.RandomNumber).op(OP.Pop);
    if (entry.hat !== null) onto(K.hat_name, entry.hat);
    // The object made AFTER its members: at run time every write above is lost.
    if (createAfterFor === entry.whichBoss) create();
    actions.mark(skip);
  });
  // The mirror: the hero's own DNA, and a name built at run time.
  actions.push(R(paramRegister), I(MIRROR)).op(OP.Equals2).op(OP.Not).jumpIfTrue("skipMirror");
  actions.push(R(ROOT), C(K.game)).op(OP.GetMember).push(C(K.champion), I(0), C(K.Object)).op(OP.NewObject).op(OP.SetMember);
  champion(actions).push(C(K.charDNA), R(GLOBAL), C(K.heroDNA)).op(OP.GetMember).op(OP.SetMember);
  champion(actions).push(C(K.character_name), C(K["Other "]), R(ROOT), C(K.game)).op(OP.GetMember)
    .push(C(K.hero)).op(OP.GetMember).push(C(K.character_name)).op(OP.GetMember).op(OP.Add2).op(OP.SetMember);
  actions.mark("skipMirror");
  // The tail: `_root.game.villain = _root.game.champion`.
  if (!omitTail) {
    actions.push(R(ROOT), C(K.game)).op(OP.GetMember).push(C(K.villain), R(ROOT), C(K.game)).op(OP.GetMember)
      .push(C(K.champion)).op(OP.GetMember).op(OP.SetMember);
  }
  if (after) after(actions);
  return actions.build();
}

/** A decoy with the same guard shape under another name, which must not be read. */
function decoyBody() {
  const actions = new Actions();
  actions.push(R(2), I(1)).op(OP.Equals2).op(OP.Not).jumpIfTrue("out");
  actions.push(R(1), C(K.game)).op(OP.GetMember).push(C(K.charDNA), S("decoy,1,2,3")).op(OP.SetMember);
  actions.mark("out");
  return actions.build();
}

function doAction(functions) {
  const head = new Actions().constantPool(POOL).build();
  return tag(12, Buffer.concat([head, ...functions, u8(OP.End)]));
}

function buildSwf({ functions = null, registerCount = 5, ...options } = {}) {
  const defined = functions ?? [
    defineFunction2("unleash_hell", [{ register: options.paramRegister ?? PARAM, name: "which_boss" }], registerCount,
      FLAGS, unleashHellBody(options))
  ];
  return swfFile([
    SHOW_FRAME,
    doAction([defineFunction2("not_it", [{ register: 2, name: "which" }], 3, 0x2a | 0x40, decoyBody()), ...defined]),
    SHOW_FRAME
  ]);
}

/* ────────────────────────────────  the tests  ────────────────────────────── */

test("every guarded branch is one champion, found from the bytes and not from a list", () => {
  const extraction = extractChampions(buildSwf());
  assert.deepEqual(extraction.champions.map((entry) => entry.whichBoss), [0, 3, 5, 9]);
  assert.equal(extraction.function.name, "unleash_hell");
  assert.equal(extraction.function.parameter, "which_boss");
  assert.equal(extraction.function.register, PARAM);
  assert.match(extraction.function.context, /^root\/frame:2\/DoAction@0x[0-9a-f]+$/);
  assert.deepEqual(extraction.function.preloads, { 1: "this", 2: "_root", 3: "_global" });
  assert.deepEqual(extraction.failures, []);

  for (const literal of LITERALS) {
    const entry = extraction.champions.find((candidate) => candidate.whichBoss === literal.whichBoss);
    assert.equal(entry.dnaFrom, "literal");
    // `DNA.split(",")`, exactly as `initcharacter` does it: fifty STRINGS.
    assert.deepEqual(entry.dna, inventedDna(literal.name, literal.seed).split(","));
    assert.equal(entry.name, literal.name);
    assert.equal(entry.quote, literal.quote);
    assert.equal(entry.hatName, literal.hat);
    assert.match(entry.at, /^\+0x[0-9a-f]{4}$/);
    // And the shared decoder takes the pack's entry as it stands.
    assert.equal(ss2ChampionFromDna(entry.dna).weapon, Number(entry.dna[13]));
  }
  // Branch offsets are the GUARDS', in the order the function tests them.
  const offsets = extraction.champions.map((entry) => parseInt(entry.at.slice(3), 16));
  assert.deepEqual([...offsets].sort((a, b) => a - b), offsets);
});

test("the branch that copies the hero carries no DNA, and says where it would have come from", () => {
  const mirror = extractChampions(buildSwf()).champions.find((entry) => entry.whichBoss === MIRROR);
  assert.equal(mirror.dna, null);
  // Named through the PRELOADS the header declares: register 3 is `_global` here.
  assert.equal(mirror.dnaFrom, "_global.heroDNA");
  assert.equal(mirror.name, null);
  assert.equal(mirror.members.character_name.expression, '"Other " + _root.game.hero.character_name');
});

test("the tail that makes the champion the villain is read, not assumed", () => {
  const { tail } = extractChampions(buildSwf());
  assert.deepEqual(tail, [{ target: "_root.game", member: "villain", expression: "_root.game.champion" }]);
});

/**
 * ► **A WRITE OUTSIDE EVERY BRANCH RUNS FOR EVERY CHAMPION, AND THIS READER
 *   ONCE RECORDED ONE AND IGNORED IT** — found by a Codex review of this file,
 *   reproduced here before it was fixed. A trailing
 *   `_root.game.champion.charDNA = <literal>` replaces whichever DNA the branch
 *   wrote; the reader filed it under `tail`, returned every branch's own DNA
 *   and `failures: []`. The build this tool reports on is whatever the player
 *   passes, so a statement it does not model is a refusal, not a footnote.
 *   The ONE statement accepted outside the branches is the build's own tail:
 *   something else made an alias of the champion, `<x> = <champion>`.
 */
test("a trailing overwrite of the champion's DNA is refused, never ignored", () => {
  const overwrite = (actions) => champion(actions).push(C(K.charDNA), S(inventedDna("Overwritten", 9))).op(OP.SetMember);
  assert.throws(
    () => extractChampions(buildSwf({ after: overwrite })),
    (error) => error instanceof ExtractChampionsError &&
      /_root\.game\.champion\.charDNA/.test(error.message) && /outside/.test(error.message)
  );
  // Before the branches it would be dead (each branch makes a fresh object),
  // and it is refused anyway: the reader models the build's tail and nothing else.
  assert.throws(
    () => extractChampions(buildSwf({ before: overwrite })),
    (error) => error instanceof ExtractChampionsError && /outside/.test(error.message)
  );
  // Replacing the champion object itself after the branches, likewise.
  const recreate = (actions) => actions.push(R(ROOT), C(K.game)).op(OP.GetMember)
    .push(C(K.champion), I(0), C(K.Object)).op(OP.NewObject).op(OP.SetMember);
  assert.throws(
    () => extractChampions(buildSwf({ after: recreate })),
    (error) => error instanceof ExtractChampionsError && /_root\.game\.champion/.test(error.message)
  );
});

/**
 * ► **ONLY THE BUILD'S EXACT TAIL, `<champion's parent>.villain = <champion>`,
 *   AND EXACTLY ONCE** — a second Codex pass found the alias rule too loose:
 *   `_root.game = _root.game.champion` after the tail replaced the champion's
 *   PARENT, losing both `champion` and `villain`, and was accepted with
 *   `failures: []`. Reproduced here before it was fixed. The reader no longer
 *   reasons about which writes are harmless; it accepts the one shape the build
 *   has and refuses the rest, by offset.
 */
test("an overwrite of the champion's parent after the tail is refused", () => {
  const ancestor = (actions) => actions.push(R(ROOT), C(K.game), R(ROOT), C(K.game)).op(OP.GetMember)
    .push(C(K.champion)).op(OP.GetMember).op(OP.SetMember);
  assert.throws(
    () => extractChampions(buildSwf({ after: ancestor })),
    (error) => error instanceof ExtractChampionsError && /_root\.game = _root\.game\.champion/.test(error.message) &&
      /\+0x[0-9a-f]{4}/.test(error.message)
  );
});

test("the tail is exactly one villain alias: a second alias, another name, or none at all is refused", () => {
  const alias = (member) => (actions) => actions.push(R(ROOT), C(K.game)).op(OP.GetMember)
    .push(C(member), R(ROOT), C(K.game)).op(OP.GetMember).push(C(K.champion)).op(OP.GetMember).op(OP.SetMember);
  // A second, otherwise identical tail.
  assert.throws(() => extractChampions(buildSwf({ after: alias(K.villain) })), ExtractChampionsError);
  // The same alias under another name, in place of the build's.
  assert.throws(
    () => extractChampions(buildSwf({ omitTail: true, after: alias(K.boss) })),
    (error) => error instanceof ExtractChampionsError && /_root\.game\.boss/.test(error.message)
  );
  // No tail: the champion is built and never made the villain.
  assert.throws(
    () => extractChampions(buildSwf({ omitTail: true })),
    (error) => error instanceof ExtractChampionsError && /villain/.test(error.message)
  );
});

/**
 * ► **A BRANCH IS `<champion> = new Object()` FIRST, THEN MEMBER WRITES** —
 *   the same Codex pass: with the creation moved after the member writes, the
 *   reader still returned the branch's name and DNA, which at run time are
 *   thrown away with the old object. Reproduced before it was fixed.
 */
test("a branch that makes its champion AFTER writing to it is refused, by offset", () => {
  assert.throws(
    () => extractChampions(buildSwf({ createAfterFor: 3 })),
    (error) => error instanceof ExtractChampionsError && /which_boss 3/.test(error.message) &&
      /new Object\(\)/.test(error.message) && /\+0x[0-9a-f]{4}/.test(error.message)
  );
});

/**
 * ► **EVERY STATEMENT STANDS ALONE: A `SetMember` LEAVES THE STACK EMPTY** —
 *   a third Codex pass. The reader tracks a member read as its PATH, not as the
 *   object that path named at that moment, so a branch that pushed the OLD
 *   champion, the DNA key and the DNA, then made and assigned the fresh
 *   champion, then consumed the saved three with a second `SetMember`, read as
 *   "new Object() first, then charDNA": fifty literal fields, `failures: []` —
 *   while at run time the DNA landed on the old object and the villain has
 *   none. Reproduced before it was fixed. Rather than model object identity,
 *   the reader refuses any statement that leaves operands behind, at its offset.
 */
test("a DNA write held on the stack across the champion's creation is refused at its offset", () => {
  assert.throws(
    () => extractChampions(buildSwf({ retainOldFor: 3 })),
    (error) => error instanceof ExtractChampionsError && /which_boss 3/.test(error.message) &&
      /SetMember at \+0x[0-9a-f]{4}/.test(error.message) && /3 value\(s\)/.test(error.message)
  );
  // And a variable write, the other way to store: not a champion statement at all.
  assert.throws(
    () => extractChampions(buildSwf({ setVariableFor: 5 })),
    (error) => error instanceof ExtractChampionsError && /which_boss 5/.test(error.message) &&
      /SetVariable at \+0x[0-9a-f]{4}/.test(error.message)
  );
});

/**
 * ► **A PATH IS A ROOT AND A LIST OF KEYS, NEVER ITS RENDERED TEXT** — a fourth
 *   Codex pass. The reader compared paths as strings, and `_root["game.champion"]`
 *   (one key, with a dot in it) renders exactly as `_root.game.champion` (two
 *   keys). A branch that created the former and wrote its DNA through the
 *   latter extracted fifty fields with `failures: []`, though at run time the
 *   DNA went onto an object that branch never made. Reproduced before it was
 *   fixed. Paths are now compared as structures, and only one narrow grammar
 *   is accepted: the preloaded `_root` register, then identifier keys, with the
 *   champion exactly `_root.game.champion` and the tail `_root.game.villain`.
 */
test("a champion created on a dotted KEY, and written on the dotted PATH, is refused at its offset", () => {
  assert.throws(
    () => extractChampions(buildSwf({ dottedCreateFor: 3 })),
    (error) => error instanceof ExtractChampionsError && /which_boss 3/.test(error.message) &&
      /"game\.champion"/.test(error.message) && /\+0x[0-9a-f]{4}/.test(error.message)
  );
});

test("a champion written through a computed key is refused at its offset", () => {
  assert.throws(
    () => extractChampions(buildSwf({ computedWriteFor: 5 })),
    (error) => error instanceof ExtractChampionsError && /which_boss 5/.test(error.message) &&
      /"champ" \+ "ion"/.test(error.message) && /\+0x[0-9a-f]{4}/.test(error.message)
  );
});

test("a champion written through a _root looked up BY NAME, not the preloaded register, is refused", () => {
  // `GetVariable("_root")` and the preloaded register render identically as
  // text, which is exactly why text was the wrong thing to compare.
  assert.throws(
    () => extractChampions(buildSwf({ variableRootFor: 0 })),
    (error) => error instanceof ExtractChampionsError && /which_boss 0/.test(error.message) &&
      /preloaded _root register/.test(error.message) && /\+0x[0-9a-f]{4}/.test(error.message)
  );
});

/**
 * ► **THE REGISTERS THE READER TRUSTS MUST HOLD WHAT IT THINKS THEY HOLD** —
 *   a fifth Codex pass. With the parameter AND its guards moved into register
 *   2, which the header also preloads with `_root`, the reader accepted every
 *   champion with `failures: []` — but a DefineFunction2 call assigns the
 *   parameters AFTER the preloads (Ruffle `core/src/avm1/function.rs`, per the
 *   review), so register 2 holds the boss number and every "`_root`" write
 *   goes to a number. Reproduced before it was fixed. The whole class is
 *   refused now, before the body is read: a parameter register that any
 *   preload also claims, a register write that could change what the `_root`
 *   or parameter register holds, register 0 for either, and a register past
 *   the header's declared count.
 */
test("a parameter register that a preload also claims is refused before the body is read", () => {
  // Codex's reproduction: parameter and guards on r2, the `_root` preload.
  assert.throws(
    () => extractChampions(buildSwf({ paramRegister: ROOT })),
    (error) => error instanceof ExtractChampionsError && /register 2/.test(error.message) &&
      /preloads with _root/.test(error.message)
  );
  // And on r3, the `_global` preload, which the mirror branch reads.
  assert.throws(
    () => extractChampions(buildSwf({ paramRegister: GLOBAL })),
    (error) => error instanceof ExtractChampionsError && /register 3/.test(error.message) &&
      /preloads with _global/.test(error.message)
  );
});

test("a StoreRegister into the _root register or the parameter's register is refused at its offset", () => {
  for (const [register, role] of [[ROOT, "_root"], [PARAM, "which_boss"]]) {
    assert.throws(
      () => extractChampions(buildSwf({ storeRegisterBefore: register })),
      (error) => error instanceof ExtractChampionsError &&
        new RegExp(`StoreRegister at \\+0x[0-9a-f]{4} writes register ${register}`).test(error.message) &&
        error.message.includes(role),
      `register ${register} (${role})`
    );
  }
});

test("register 0 for the parameter, or a register past the declared count, is refused", () => {
  // DefineFunction2's register 0 means "not in a register": the parameter is
  // then a named variable, and no guard on a register can be testing it.
  assert.throws(
    () => extractChampions(buildSwf({ paramRegister: 0 })),
    (error) => error instanceof ExtractChampionsError && /register 0/.test(error.message)
  );
  // The header declares 4 registers here (0-3), and the parameter sits in 4.
  assert.throws(
    () => extractChampions(buildSwf({ registerCount: 4 })),
    (error) => error instanceof ExtractChampionsError && /register 4/.test(error.message) &&
      /declares 4 registers/.test(error.message)
  );
});

test("a champion made by anything but a zero-argument new Object() is refused", () => {
  const cases = [
    ["new Array()", () => [I(0), C(K.Array)]],
    ["new Object with an argument", () => [S("seed"), I(1), C(K.Object)]]
  ];
  for (const [label, creation] of cases) {
    assert.throws(
      () => extractChampions(buildSwf({ creationFor: (whichBoss) => (whichBoss === 5 ? creation() : [I(0), C(K.Object)]) })),
      (error) => error instanceof ExtractChampionsError && /which_boss 5/.test(error.message),
      label
    );
  }
});

test("an unleash_hell with no branch at all names no champion, and says so", () => {
  const tailOnly = new Actions().push(R(ROOT), C(K.game)).op(OP.GetMember).push(C(K.villain), R(ROOT), C(K.game))
    .op(OP.GetMember).push(C(K.champion)).op(OP.GetMember).op(OP.SetMember).build();
  const bare = defineFunction2("unleash_hell", [{ register: PARAM, name: "which_boss" }], 5, FLAGS, tailOnly);
  assert.throws(
    () => extractChampions(buildSwf({ functions: [bare] })),
    (error) => error instanceof ExtractChampionsError && /no `which_boss == n` branch/.test(error.message)
  );
});

test("branches that build their champion on different objects are refused", () => {
  // The tail aliases ONE object; a branch writing elsewhere is not the villain.
  assert.throws(
    () => extractChampions(buildSwf({ holderFor: (whichBoss) => (whichBoss === 5 ? K.hero : K.champion) })),
    (error) => error instanceof ExtractChampionsError && /which_boss 5/.test(error.message) && /_root\.game\.hero/.test(error.message)
  );
});

test("a DNA whose split does not give fifty fields is a FAILURE, never a shifted decode", () => {
  // A comma in a name moves every field after it one index along; initcharacter
  // would decode that without complaint, and so would anything that trusted it.
  const extraction = extractChampions(buildSwf({
    dnaFor: (name, seed) => (seed === 2 ? inventedDna(`${name}, the Second`, seed) : inventedDna(name, seed))
  }));
  const broken = extraction.champions.find((entry) => entry.whichBoss === 3);
  assert.equal(broken.dna, null);
  assert.equal(broken.dnaFrom, "literal");
  assert.equal(extraction.failures.length, 1);
  assert.match(extraction.failures[0].reason, /51 fields/);
  assert.equal(extraction.failures[0].whichBoss, 3);
});

test("a branch that writes no charDNA is a failure by name", () => {
  const extraction = extractChampions(buildSwf({ omitDnaFor: 5 }));
  assert.equal(extraction.champions.find((entry) => entry.whichBoss === 5).dna, null);
  assert.deepEqual(extraction.failures.map((failure) => failure.whichBoss), [5]);
  assert.match(extraction.failures[0].reason, /no charDNA/);
});

test("an instruction the reader cannot name is a refusal, not a skipped line", () => {
  // `RandomNumber` inside a branch is the one thing that would make a champion
  // something other than a literal; a reader that stepped over it would call a
  // rolled champion fixed.
  assert.throws(
    () => extractChampions(buildSwf({ poison: 3 })),
    (error) => error instanceof ExtractChampionsError && /RandomNumber/.test(error.message) && /which_boss 3/.test(error.message)
  );
});

test("no unleash_hell, two of them, or a which_boss tested twice: each refused by name", () => {
  const onlyDecoy = swfFile([doAction([defineFunction2("not_it", [{ register: 2, name: "which" }], 3, 0x6a, decoyBody())])]);
  assert.throws(() => extractChampions(onlyDecoy), (error) => error instanceof ExtractChampionsError && /no unleash_hell/.test(error.message));

  const twice = defineFunction2("unleash_hell", [{ register: PARAM, name: "which_boss" }], 5, FLAGS, unleashHellBody());
  assert.throws(
    () => extractChampions(buildSwf({ functions: [twice, twice] })),
    (error) => error instanceof ExtractChampionsError && /2 functions named unleash_hell/.test(error.message)
  );
  assert.throws(
    () => extractChampions(buildSwf({ duplicate: true })),
    (error) => error instanceof ExtractChampionsError && /which_boss 3 is tested twice/.test(error.message)
  );
});

test("the manifest is recomputed from the champions and carries no text of the build's", () => {
  const extraction = extractChampions(buildSwf({ omitDnaFor: 5 }));
  const manifest = buildManifest(extraction, { source: "synthetic.swf", sha256: "ab".repeat(32) });
  assert.equal(manifest.sha256, "ab".repeat(32));
  assert.equal(manifest.matchesOracle, false);
  assert.equal(manifest.oracleSha256, ORACLE_SHA256);
  assert.deepEqual(manifest.totals, { branches: 4, literalDna: 2, computedDna: 1, failures: 1 });
  assert.deepEqual(manifest.champions.map((entry) => entry.whichBoss), [0, 3, 5, 9]);
  const text = JSON.stringify(manifest);
  for (const literal of LITERALS) {
    assert.equal(text.includes(literal.name), false, `the manifest names nobody (${literal.name})`);
    assert.equal(text.includes(literal.quote), false);
  }
});

test("the CLI reads the SWF it is given and writes the pack and the manifest to --out", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "extract-champions-"));
  try {
    const swf = path.join(dir, "synthetic.swf");
    const bytes = buildSwf();
    fs.writeFileSync(swf, bytes);
    const out = path.join(dir, "pack");
    const lines = [];
    main([swf, "--out", out], { write: (line) => lines.push(line) });

    const pack = JSON.parse(fs.readFileSync(path.join(out, "champions.json"), "utf8"));
    const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
    assert.deepEqual(pack.champions.map((entry) => entry.whichBoss), [0, 3, 5, 9]);
    assert.equal(pack.sha256, crypto.createHash("sha256").update(bytes).digest("hex"));
    assert.equal(manifest.sha256, pack.sha256);
    const printed = lines.join("\n");
    assert.match(printed, /NOTE: this build is/, "a non-oracle build is reported, never refused");
    assert.match(printed, /4 branches/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the default --out is the gitignored assets/champions/, and bad options are refused", () => {
  assert.match(parseArguments([]).out, /assets[\\/]champions$/);
  assert.equal(parseArguments(["x.swf"]).file, "x.swf");
  assert.throws(() => parseArguments(["--out"]), ExtractChampionsError);
  assert.throws(() => parseArguments(["--frobnicate"]), ExtractChampionsError);
});
