/**
 * Which sound a running animation plays — the decision, not the playing.
 *
 * The bindings themselves are never committed: they are derived from the
 * player's own install into `assets/sound/manifest.json`, because the sound ids
 * belong to the build they were read out of and because a clone must still
 * need its own licensed copy. So every test here supplies its own table, which
 * is also the honest shape of the module: it holds no table of its own.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { bindingsFrom, chooseSound, soundLabelsFor } from "../src/render/sound.js";
import { timelineFor } from "../src/render/timeline.js";

/**
 * Keyed on the build's OWN clip labels, which is what the extractor now emits.
 * The previous version of this table was keyed on coarse buckets and was
 * therefore agreeing with a bug.
 */
const TABLE = Object.freeze({
  stepforward: ["step-f.mp3"],
  stepback: ["step-b.mp3"],
  jump: ["jump.mp3"],
  superjump: ["superjump.mp3"],
  charge: ["charge.mp3"],
  chargeattack: ["chargeattack.mp3"],
  attack1: ["a1.mp3"],
  attack2: ["a2.mp3"],
  attack3: ["a3.mp3"],
  hurt1: ["h1.mp3"],
  rest: ["r1.mp3"],
  death3: ["d3.mp3"]
});

/**
 * ► **THE OWNER CAUGHT THIS BY EAR: "I am hearing a block sound and jump sound
 *   for walking."** Both sides of the lookup were bucketing by the battle map's
 *   PROSE ranges, so `movement` meant frames 33-104 — `StepBack`,
 *   `StepForward`, `Charge` and `Chargeattack`, four separate clips — and
 *   `block` meant 118-179, which swallowed `Jump` and `Superjump`.
 *
 *   Nothing in the suite could tell, because both sides were self-consistent.
 *   These tests pin the labels themselves so a coarse mapping cannot come back.
 */
test("a walk sounds as a walk, and never as a charge or a jump", () => {
  const walk = soundLabelsFor("movement:walk");
  assert.deepEqual(walk, ["stepforward", "stepback"]);
  for (const forbidden of ["charge", "chargeattack", "jump", "superjump"]) {
    assert.ok(!walk.includes(forbidden), `a walk must not sound as ${forbidden}`);
  }
  // And through the real lookup, at every sequence it can take.
  for (let sequence = 0; sequence < 6; sequence += 1) {
    const file = chooseSound(TABLE, "movement:walk", sequence);
    assert.ok(["step-f.mp3", "step-b.mp3"].includes(file), `seq ${sequence} played ${file}`);
  }
});

test("each gait keeps its own clips, because the build gives them their own", () => {
  assert.deepEqual(soundLabelsFor("movement:run"), ["runforward", "runback"]);
  assert.deepEqual(soundLabelsFor("movement:charge"), ["charge", "chargeattack"]);
  assert.deepEqual(soundLabelsFor("movement:jump"), ["jump", "superjump"]);
  assert.equal(chooseSound(TABLE, "movement:jump", 0), "jump.mp3");
  assert.equal(chooseSound(TABLE, "movement:charge", 0), "charge.mp3");
});

test("a block is SILENT, and it is the BINDINGS that say so, not the table", () => {
  // `Block` and `BlockForward` carry no StartSound at all. The prose bucket hid
  // that by lending the range `Jump` and `Superjump`.
  //
  // ► **This used to assert `soundLabelsFor("block")` was EMPTY, and that was
  //   the right silence for the wrong reason.** An empty list conflated two
  //   different facts — "the build has no block clip" and "the build's block
  //   makes no noise" — and only the second is true: the figure draws `Block`
  //   and `BlockForward` from the same extraction. **An assertion that the
  //   table omits the label would also have passed if the build DID bind a
  //   sound to it**, which is exactly the kind of self-confirming check this
  //   project keeps finding. So the labels are named, and the silence is
  //   derived from bindings that do not mention them.
  assert.deepEqual(soundLabelsFor("block"), ["block", "blockforward"]);
  assert.equal(TABLE.block, undefined, "the extractor binds no sound to a block");
  assert.equal(TABLE.blockforward, undefined);
  assert.equal(chooseSound(TABLE, "block", 0), null);
});

test("an attack is one of twelve clips, not one bucket", () => {
  const labels = soundLabelsFor("attack");
  assert.equal(labels.length, 12);
  assert.equal(labels[0], "attack1");
  assert.equal(labels[11], "attack12");
  // Only the three the table holds are reachable; the rest simply contribute
  // nothing rather than becoming broken references.
  const heard = new Set([0, 1, 2].map((sequence) => chooseSound(TABLE, "attack", sequence)));
  assert.deepEqual([...heard].sort(), ["a1.mp3", "a2.mp3", "a3.mp3"]);
});

test("a death sounds as its OWN variant, which the family already names", () => {
  assert.deepEqual(soundLabelsFor("death:death3"), ["death3"]);
  assert.equal(chooseSound(TABLE, "death:death3", 0), "d3.mp3");
  // An unknown variant falls back to the whole set rather than to silence.
  assert.ok(soundLabelsFor("death:unknown").length > 1);
});

test("a looping idle is silent, because a sound on a loop never stops", () => {
  assert.deepEqual(soundLabelsFor("standing"), []);
  assert.deepEqual(soundLabelsFor("unknown"), []);
  assert.deepEqual(soundLabelsFor(""), []);
  assert.deepEqual(soundLabelsFor(null), []);
});

test("the families the renderer actually produces all resolve to real labels", () => {
  // Derived from real labels rather than family strings, so a rename in
  // `familyOf` cannot quietly orphan a mapping.
  for (const [label, expected] of [
    ["walkleft", "stepforward"], ["runright", "runforward"],
    ["chargeleft", "charge"], ["jumpright", "jump"],
    ["attack4", "attack1"], ["hurt5", "hurt1"], ["rest", "rest"]
  ]) {
    const family = timelineFor(label, { role: "actor" }).family;
    assert.equal(soundLabelsFor(family)[0], expected, `${label} -> ${family}`);
  }
});

test("the choice is DETERMINISTIC, because the same bout must replay the same", () => {
  // `Math.random()` here would make two replays of one bout sound different,
  // which is the same class of small lie as a renderer drawing a separation
  // the model does not have.
  assert.equal(chooseSound(TABLE, "attack", 0), "a1.mp3");
  assert.equal(chooseSound(TABLE, "attack", 1), "a2.mp3");
  assert.equal(chooseSound(TABLE, "attack", 2), "a3.mp3");
  assert.equal(chooseSound(TABLE, "attack", 3), "a1.mp3", "and it wraps");
  // Same input, same answer, every time.
  for (let run = 0; run < 5; run += 1) assert.equal(chooseSound(TABLE, "attack", 7), "a2.mp3");
  // A negative or fractional sequence must not produce `undefined`.
  assert.equal(chooseSound(TABLE, "attack", -1), "a2.mp3");
  assert.equal(chooseSound(TABLE, "attack", 2.7), "a3.mp3");
});

test("no extracted assets means SILENCE, never an error", () => {
  // A fresh clone has no `assets/` — that is the point, the repo ships none —
  // so every one of these is the ordinary case rather than a failure.
  assert.equal(chooseSound({}, "attack", 0), null);
  assert.equal(chooseSound(null, "attack", 0), null);
  assert.equal(chooseSound(undefined, "attack", 0), null);
  assert.equal(chooseSound(TABLE, "taunt", 0), null, "a label this table holds no file for");
});

test("a malformed manifest leaves the arena silent and playable, not broken", () => {
  assert.deepEqual(bindingsFrom(null), {});
  assert.deepEqual(bindingsFrom({}), {});
  assert.deepEqual(bindingsFrom({ bindings: "nonsense" }), {});
  // Entries that are not usable file names drop out rather than becoming
  // broken references a player would hear as nothing and have to diagnose.
  assert.deepEqual(
    bindingsFrom({ bindings: { attack: ["ok.mp3", "", null, 7], empty: [], bad: "x" } }),
    { attack: ["ok.mp3"] }
  );
});

test("bindingsFrom survives a real manifest shape", () => {
  const manifest = {
    source: { file: "x.swf", sha256: "abc" },
    count: 2,
    bindings: { stepforward: ["33-step.mp3"], attack1: ["190-swing.mp3"] },
    sounds: []
  };
  const bindings = bindingsFrom(manifest);
  assert.equal(chooseSound(bindings, "movement:walk", 0), "33-step.mp3");
  assert.equal(chooseSound(bindings, "attack", 0), "190-swing.mp3");
});
