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

import { bindingsFrom, chooseSound, soundBucketFor } from "../src/render/sound.js";
import { timelineFor } from "../src/render/timeline.js";

const TABLE = Object.freeze({
  movement: ["m1.mp3", "m2.mp3", "m3.mp3", "m4.mp3"],
  attack: ["a1.mp3", "a2.mp3", "a3.mp3"],
  hurt: ["h1.mp3", "h2.mp3"],
  rest: ["r1.mp3"],
  death: ["d1.mp3"]
});

test("a timeline family maps to the battle map's own animation bucket", () => {
  // `timelineFor(label).family` is the label's decoded meaning and the
  // extractor's buckets are the map's label RANGES. They meet at the prefix,
  // which is why this is a split and not a second table to keep in step.
  assert.equal(soundBucketFor("movement:walk"), "movement");
  assert.equal(soundBucketFor("movement:charge"), "movement");
  assert.equal(soundBucketFor("attack"), "attack");
  assert.equal(soundBucketFor("hurt"), "hurt");
  assert.equal(soundBucketFor("death:death3"), "death");
  assert.equal(soundBucketFor("condition:burning"), "condition");
});

test("a looping idle is silent, because a sound on a loop never stops", () => {
  assert.equal(soundBucketFor("standing"), null);
  assert.equal(soundBucketFor("unknown"), null);
  assert.equal(soundBucketFor(""), null);
  assert.equal(soundBucketFor(null), null);
});

test("the families the renderer actually produces all resolve", () => {
  // Derived from real labels rather than from the family strings, so a rename
  // in `familyOf` cannot quietly orphan a bucket.
  for (const [label, expected] of [
    ["walkleft", "movement"], ["runright", "movement"], ["chargeleft", "movement"],
    ["attack4", "attack"], ["hurt5", "hurt"], ["rest", "rest"], ["Block", "block"]
  ]) {
    const family = timelineFor(label, { role: "actor" }).family;
    assert.equal(soundBucketFor(family), expected, `${label} -> ${family}`);
  }
  assert.equal(soundBucketFor(timelineFor("Standing", { role: "actor" }).family), null);
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
  assert.equal(chooseSound(TABLE, "taunt", 0), null, "a bucket the build fired no sound in");
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
    bindings: { movement: ["33-step.mp3"], attack: ["190-swing.mp3"] },
    sounds: []
  };
  const bindings = bindingsFrom(manifest);
  assert.equal(chooseSound(bindings, "movement:walk", 0), "33-step.mp3");
  assert.equal(chooseSound(bindings, "attack", 0), "190-swing.mp3");
});
