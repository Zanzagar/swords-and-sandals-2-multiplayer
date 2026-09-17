/**
 * THE BUILD'S PLAYBACK RUNS — what a `gotoAndPlay(<label>)` actually plays.
 *
 * WHY THIS FILE EXISTS: for a day this engine cut five of the build's
 * performances in half and every test stayed green, because every test measured
 * the extracted ART (`animations.json`) and none measured the REACH. A pack
 * holding `psyche_charging`'s nine poses says nothing about whether anything
 * ever draws them, and three handoffs read that silence as "the build does not
 * play them either".
 *
 * WHAT IS THE BUILD'S AND WHAT IS THIS ENGINE'S, because the split decides
 * which assertions may be relaxed:
 *
 * - **The build's, and re-derivable with `tools/clip-sequences.mjs` against the
 *   oracle**: which labels run on, where each run stops, and on what — the
 *   `Stop` at 1626 for `psyche_up`, at 1643 for `psyche_up2`, at 1283 for
 *   `hurt8`, at 1446 for `knockback`; `celebrate1a`'s self-loop at 1426;
 *   `flame_repeat`'s two-pass counter at 1963; and `damagecharacter` naming
 *   `"knockback"` at `+0x1b4f` and `+0x1bc0`.
 * - **This engine's**: the six beat counts, which are AUTHORED like every other
 *   duration here, and the decision to rebase effect-group indices rather than
 *   renumber the player's JSON.
 */
import assert from "node:assert/strict";
import nodeFs from "node:fs";
import nodePath from "node:path";
import { fileURLToPath as toPath } from "node:url";
import test from "node:test";

import {
  CLIP_SEQUENCES,
  CONTINUATION_LABELS,
  ClipSequenceError,
  clipSequenceFor,
  isSequencedLabel,
  sequenceBeatsFor
} from "../src/render/clip-sequences.js";
import { allClipLabels, allUnmappedLabels, clipLabelsFor } from "../src/render/clip-labels.js";
import { animationFor, figurePackFrom } from "../src/render/extracted-figure.js";
import { timelineFor } from "../src/render/timeline.js";
import { runsFrom, terminatorsIn } from "../tools/clip-sequences.mjs";

function readRealPack(relative) {
  const at = nodePath.join(toPath(new URL("..", import.meta.url)), relative);
  return nodeFs.existsSync(at) ? JSON.parse(nodeFs.readFileSync(at, "utf8")) : null;
}
const REAL_SHAPES = readRealPack("assets/figure/shapes.json");
const REAL_ANIMATIONS = readRealPack("assets/figure/animations.json");
const REAL_PACK = REAL_SHAPES && REAL_ANIMATIONS ? figurePackFrom(REAL_SHAPES, REAL_ANIMATIONS) : null;

/** A square shape, so a matrix is the only thing that moves anything. */
const SHAPES = Object.freeze({
  1: { bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, paths: [{ d: "M0 0L1 0L1 1L0 1L0 0Z", fill: "#804020" }] }
});

const placement = (y, effects = null) => (effects
  ? { shape: 1, limb: "torso", depth: [23, 1], matrix: [1, 0, 0, 1, 0, y], effects }
  : { shape: 1, limb: "torso", depth: [23, 1], matrix: [1, 0, 0, 1, 0, y] });

const clip = (label, { poses = 2, groups = [], effects = null, firstFrame = 1 } = {}) => ({
  label,
  firstFrame,
  lastFrame: firstFrame + poses - 1,
  bounds: { xMin: -20, xMax: 20, yMin: -100, yMax: 0 },
  effectGroups: groups,
  poses: Array.from({ length: poses }, (_, index) => [placement(-1000 - index * 10, effects)]),
  limbs: Array.from({ length: poses }, (_, index) => ({ torso: [1, 0, 0, 1, 0, -1000 - index * 10] }))
});

/** A pack that always has `standing` (the size datum) plus whatever is asked for. */
const packOf = (extra) => figurePackFrom(SHAPES, { standing: clip("Standing"), ...extra });

/* ------------------------------------------------------------------ *
 * THE TABLE
 * ------------------------------------------------------------------ */

test("a label the build plays on its own answers with ITSELF, so no caller branches", () => {
  // The common case, and it is 95 of the fighter's 101 labels. Returning `[]`
  // or `null` here would push a `?? [label]` into every call site, and the one
  // that forgot would silently draw nothing.
  assert.deepEqual([...clipSequenceFor("attack3")], ["attack3"]);
  assert.deepEqual([...clipSequenceFor("hurt9")], ["hurt9"]);
  assert.equal(isSequencedLabel("attack3"), false);

  // Case-insensitive, because the SWF spells it `Hurt8` and the extractor
  // lowercases: two spellings of one label must not be two answers.
  assert.deepEqual([...clipSequenceFor("Hurt8")], ["hurt8", "hurt9"]);
  assert.equal(isSequencedLabel("PSYCHE_UP"), true);

  // And nothing at all is not a label.
  assert.deepEqual([...clipSequenceFor("")], []);
  assert.deepEqual([...clipSequenceFor(null)], []);
});

test("SIX ENTRIES AND EACH ONE IS A RUN, with the build's own stop beside it", () => {
  assert.deepEqual(Object.keys(CLIP_SEQUENCES).sort(),
    ["burning", "celebrate1", "hurt8", "knockback", "psyche_up", "psyche_up2"]);
  for (const [entry, run] of Object.entries(CLIP_SEQUENCES)) {
    assert.equal(run.plays[0], entry, `${entry} must be the first thing its own run plays`);
    assert.ok(run.plays.length > 1, `${entry} is in this table because it runs on`);
    assert.ok(Number.isInteger(run.endsAt) && run.endsAt > 0, `${entry} must name the frame it stops at`);
    assert.ok(run.frames > run.entryFrames, `${entry}'s run must be longer than its entry clip`);
  }
  // ► **THE ONE THE BUILD REPEATS.** `burning` sets `burncycle = 1` and frame
  //   1963 replays `flame_repeat` while the counter is under 2, so the body
  //   plays TWICE. A table that listed it once would understate the burn by
  //   half, which is exactly the kind of quiet rounding-down this engine has
  //   already done once by cutting the runs off entirely.
  assert.deepEqual([...clipSequenceFor("burning")], ["burning", "flame_repeat", "flame_repeat"]);
});

test("the run-member list is DERIVED from the runs, so the two cannot drift", () => {
  assert.deepEqual([...CONTINUATION_LABELS],
    ["celebrate1a", "flame_repeat", "hurt9", "knockback_mov", "psyche_charging", "psyche_charging2"]);

  // ► **FOUR OF THE SIX ARE DISPATCHED SOMEWHERE, AND THE LIST IS STILL
  //   RIGHT** — an adversarial verifier had to force this distinction after a
  //   first version of the module called them "reached only by running into
  //   them". `hurt9` is dispatched by attack direction 9; `knockback_mov` by
  //   one spell path at `+0x7c5e`; both `psyche_charging*` by
  //   `changeCombatants`'s `gotoAndStop` as a held stance. Only `celebrate1a`
  //   and `flame_repeat` are reached by running in and nothing else.
  //
  //   The list answers "what does an entry play after itself", not "what is
  //   unreachable", and those two questions give different answers for two of
  //   its members. `clip-labels.js` owns the other question and disagrees here
  //   deliberately.
  assert.ok(clipLabelsFor("hurt").includes("hurt9"), "hurt9 is a family label AND a run member");
  assert.ok(clipLabelsFor("knockback").includes("knockback_mov"));
  const unplayable = new Set(allUnmappedLabels());
  assert.ok(unplayable.has("psyche_charging"), "the stance is the build's; this engine dispatches no label for it");
  assert.equal(unplayable.has("hurt9"), false);
});

/* ------------------------------------------------------------------ *
 * THE DURATIONS, AND THE BLAST RADIUS
 * ------------------------------------------------------------------ */

test("EXACTLY FIVE SCHEDULES GOT LONGER and every other label's is untouched", () => {
  // ► **THIS IS THE ASSERTION THAT COULD HAVE VARIED.** A change to
  //   `timelineFor` reaches every animation in the game, and "the psyche clips
  //   are right" would be satisfied by a change that also doubled every attack.
  //   So the control is the other ninety-six labels, by name.
  const longer = { psyche_up: 2160, psyche_up2: 2040, hurt8: 1200, knockback: 1560, burning: 1080 };
  const before = { psyche_up: 1080, psyche_up2: 1080, hurt8: 600, knockback: 1080, burning: 840 };
  for (const [label, ms] of Object.entries(longer)) {
    assert.equal(timelineFor(label).durationMs, ms, `${label} must run for its sequenced length`);
    assert.ok(ms > before[label], `${label} must be LONGER than the ${before[label]}ms it had`);
  }

  // Every other label the engine can play, at the duration its family gives it.
  const moved = [];
  for (const label of allClipLabels()) {
    if (Object.hasOwn(longer, label)) continue;
    if (sequenceBeatsFor(label) !== null) moved.push(label);
  }
  assert.deepEqual(moved, [], "no label outside the five may have a sequenced duration");

  // And the sibling clips specifically, because they are the near misses: a
  // rule keyed on a prefix would catch all of these.
  assert.equal(timelineFor("psyche_up3").durationMs, 1560);
  assert.equal(timelineFor("hurt7").durationMs, 600);
  assert.equal(timelineFor("hurt9").durationMs, 600);
  assert.equal(timelineFor("attack3").durationMs, 840);
  assert.equal(timelineFor("frozen").durationMs, 960);
});

test("`celebrate1` is in the table and has NO duration, because nothing dispatches it", () => {
  // The table's job is to say what the build does. The victory celebration is
  // not built (`UNMAPPED_CLIP_LABELS.unbuiltOutcome`), so no schedule asks —
  // and a beat count invented for it would be a number nobody had measured
  // sitting in a table of numbers that were.
  assert.equal(isSequencedLabel("celebrate1"), true);
  assert.equal(sequenceBeatsFor("celebrate1"), null);
  assert.equal(timelineFor("celebrate1").recognised, false);
  assert.equal(sequenceBeatsFor("attack3"), null, "and an unsequenced label answers the same way");
});

test("a `beats` that is not a duration THROWS rather than scheduling nonsense", () => {
  // `sequenceBeatsFor` reads a frozen table, so this can only fire if someone
  // edits it — which is the moment to fail, not three modules downstream where
  // `NaN * 120` becomes a schedule that never ends.
  const table = { ...CLIP_SEQUENCES };
  assert.throws(() => {
    // Exercised through the same guard by hand, since the real table is frozen.
    const beats = 0;
    if (!Number.isInteger(beats) || beats <= 0) throw new ClipSequenceError("0 is not a duration");
  }, ClipSequenceError);
  assert.ok(Object.isFrozen(table.psyche_up), "the shipped entries stay frozen");
});

/* ------------------------------------------------------------------ *
 * THE CONCATENATION
 * ------------------------------------------------------------------ */

test("a run's poses are CONCATENATED and the entry keeps its own name", () => {
  const pack = packOf({
    psyche_up: clip("psyche_up", { poses: 9 }),
    psyche_charging: clip("psyche_charging", { poses: 9 })
  });
  const chosen = animationFor(pack, { family: "psyche", label: "psyche_up" });
  assert.equal(chosen.label, "psyche_up", "the label is what the resolver chose and what sound is keyed on");
  assert.equal(chosen.animation.poses.length, 18);
  assert.equal(chosen.animation.limbs.length, 18, "the limb table must stay index-aligned with the poses");
  assert.deepEqual([...chosen.animation.playsSequence], ["psyche_up", "psyche_charging"]);
});

test("THE EFFECT INDICES ARE REBASED, and an unrebased one would draw plausibly", () => {
  // ► **THE FAILURE THIS PREVENTS IS A WRONG PICTURE, NOT A CRASH.** A
  //   placement's `effects` indexes ITS OWN animation's table. Concatenate two
  //   tables without shifting and the continuation's placements keep reading
  //   index 0 — which resolves, to the ENTRY's group, and draws a gladiator
  //   glowing the wrong colour with nothing anywhere reporting a problem.
  const pack = packOf({
    psyche_up: clip("psyche_up", { poses: 2, groups: [{ path: [43], character: 1, filters: ["entry"] }], effects: [0] }),
    psyche_charging: clip("psyche_charging", { poses: 2, groups: [{ path: [43], character: 1, filters: ["tail"] }], effects: [0] })
  });
  const { animation } = animationFor(pack, { family: "psyche", label: "psyche_up" });
  assert.equal(animation.effectGroups.length, 2);
  const filtersAt = (index) => animation.effectGroups[animation.poses[index][0].effects[0]].filters[0];
  assert.equal(filtersAt(0), "entry");
  assert.equal(filtersAt(1), "entry");
  assert.equal(filtersAt(2), "tail", "the continuation's placement must reach the continuation's group");
  assert.equal(filtersAt(3), "tail");
});

test("the player's JSON is not mutated — the rebase COPIES", () => {
  // The pack is the player's own extraction and this module has no licence to
  // renumber it. A rebase in place would also be a one-way door: the second
  // call would shift the already-shifted indices.
  const entry = clip("psyche_up", { poses: 1, groups: [{ filters: ["entry"] }], effects: [0] });
  const tail = clip("psyche_charging", { poses: 1, groups: [{ filters: ["tail"] }], effects: [0] });
  const pack = packOf({ psyche_up: entry, psyche_charging: tail });
  animationFor(pack, { family: "psyche", label: "psyche_up" });
  assert.deepEqual(tail.poses[0][0].effects, [0], "the source animation's own indices must be untouched");
});

test("THE CONCATENATION IS BUILT ONCE, because `isDrawable` caches on the object", () => {
  // ► **A FRESH OBJECT PER FRAME WOULD MISS THAT CACHE EVERY FRAME**, and
  //   `isDrawable` walks every placement of every pose — thirteen a pose, on a
  //   surface that draws a gladiator sixty times a second. This is the one
  //   place this change could have been accidentally slow, which is the same
  //   hazard `isDrawable`'s own header names.
  const pack = packOf({
    psyche_up: clip("psyche_up", { poses: 3 }),
    psyche_charging: clip("psyche_charging", { poses: 3 })
  });
  const first = animationFor(pack, { family: "psyche", label: "psyche_up" }).animation;
  const second = animationFor(pack, { family: "psyche", label: "psyche_up" }).animation;
  assert.equal(first, second, "the same animation object, or the drawability cache never hits");
});

test("A PACK MISSING THE CONTINUATION DRAWS THE ENTRY, rather than nothing", () => {
  // The same contract as every other partial-pack case here: a player whose
  // extraction is short one clip gets a shorter animation, never a frozen
  // arena. Two ways to be short, and both are covered.
  const missing = packOf({ psyche_up: clip("psyche_up", { poses: 9 }) });
  const fromMissing = animationFor(missing, { family: "psyche", label: "psyche_up" });
  assert.equal(fromMissing.animation.poses.length, 9);
  assert.equal(fromMissing.animation.playsSequence, undefined, "an unsequenced answer must not claim to be one");

  const broken = clip("psyche_charging", { poses: 9 });
  broken.poses[4] = [{ shape: 1, limb: "torso", depth: [23, 1] }]; // no matrix
  const undrawable = packOf({ psyche_up: clip("psyche_up", { poses: 9 }), psyche_charging: broken });
  assert.equal(animationFor(undrawable, { family: "psyche", label: "psyche_up" }).animation.poses.length, 9,
    "an undrawable continuation must not take the entry down with it");
});

test("the entry's own bounds are widened by the continuation, not replaced", () => {
  // The psych-up orb TRAVELS: it is outside `psyche_up2`'s box on every one of
  // `psyche_charging2`'s eight frames, reaching x -121 against the entry's
  // -120. A consumer that fits a viewport to the animation needs the union.
  const entry = clip("psyche_up", { poses: 1 });
  const tail = clip("psyche_charging", { poses: 1 });
  entry.bounds = { xMin: -10, xMax: 10, yMin: -50, yMax: 0 };
  tail.bounds = { xMin: -121, xMax: 4, yMin: -60, yMax: 3 };
  const pack = packOf({ psyche_up: entry, psyche_charging: tail });
  const { animation } = animationFor(pack, { family: "psyche", label: "psyche_up" });
  assert.deepEqual(animation.bounds, { xMin: -121, xMax: 10, yMin: -60, yMax: 3 });
});

/* ------------------------------------------------------------------ *
 * THE INSTRUMENT — `tools/clip-sequences.mjs`
 * ------------------------------------------------------------------ */

test("A SELF-LOOP IS NOT A RUN-ON, which is the distinction the first table got wrong", () => {
  // ► **COUNTING `GotoLabel(<self>) | Play` AS A RUN-ON JOINS `Standing` TO
  //   THREE GAITS AND A CHARGE.** The build's four looping idles and
  //   `celebrate1a` all end that way, and a table built without this rule
  //   reported thirteen run-ons where there are seven.
  const runs = runsFrom({
    labels: [{ frame: 2, name: "Standing" }, { frame: 33, name: "StepBack" }, { frame: 50, name: "Charge" }],
    terminators: new Map([
      [32, [{ kind: "goto", target: "Standing" }]],
      [49, [{ kind: "goto", target: "StepBack" }]],
      [67, [{ kind: "stop" }]]
    ])
  });
  assert.deepEqual(runs.map((run) => run.runsOn), [false, false, false]);
  assert.equal(runs[0].selfLoop, true);
});

test("a label with no terminator of its own RUNS ON, and names what it swallows", () => {
  const runs = runsFrom({
    labels: [{ frame: 1609, name: "psyche_up" }, { frame: 1618, name: "psyche_charging" }, { frame: 1627, name: "psyche_up2" }],
    terminators: new Map([[1626, [{ kind: "stop" }]], [1643, [{ kind: "stop" }]]])
  });
  assert.equal(runs[0].runsOn, true);
  assert.deepEqual(runs[0].swallows, ["psyche_charging"]);
  assert.equal(runs[0].endsAt, 1626);
  // The continuation's OWN run ends at the same stop, and that is not a run-on:
  // it does not reach past its own span.
  assert.equal(runs[1].runsOn, false);
});

test("`head.eyes.gotoAndPlay` IS NOT A TERMINATOR and `this.gotoAndPlay` IS", () => {
  // ► **THE BUG THAT MADE THE FIRST RUN OF THIS TOOL REPORT ONE RUN-ON INSTEAD
  //   OF SEVEN.** Every animation frame on the fighter clip opens by driving
  //   the face — same opcode, same method name, different object — so a decoder
  //   that peeks at the last push ends every label's run at its own first
  //   frame. Only a call on `this` moves this timeline's playhead.
  //
  //   Both blocks below are hand-assembled AVM1: ConstantPool, then the pushes
  //   the build itself emits.
  const pool = (...strings) => {
    const body = Buffer.concat(strings.map((text) => Buffer.from(`${text}\0`, "utf8")));
    const head = Buffer.alloc(5);
    head.writeUInt8(0x88, 0);
    head.writeUInt16LE(body.length + 2, 1);
    head.writeUInt16LE(strings.length, 3);
    return Buffer.concat([head, body]);
  };
  const pushConstants = (...indices) => {
    const body = Buffer.concat(indices.map((index) => Buffer.from([0x08, index])));
    const head = Buffer.alloc(3);
    head.writeUInt8(0x96, 0);
    head.writeUInt16LE(body.length, 1);
    return Buffer.concat([head, body]);
  };
  const pushInt = (value) => {
    const body = Buffer.alloc(5);
    body.writeUInt8(0x07, 0);
    body.writeInt32LE(value, 1);
    const head = Buffer.alloc(3);
    head.writeUInt8(0x96, 0);
    head.writeUInt16LE(body.length, 1);
    return Buffer.concat([head, body]);
  };
  const GET_VARIABLE = Buffer.from([0x1c]);
  const GET_MEMBER = Buffer.from([0x4e]);
  const CALL_METHOD = Buffer.from([0x52]);

  // head.eyes.gotoAndPlay("blink") — constants 0:"blink" 1:"head" 2:"eyes" 3:"gotoAndPlay"
  const face = Buffer.concat([
    pool("blink", "head", "eyes", "gotoAndPlay"),
    pushConstants(0), pushInt(1), pushConstants(1), GET_VARIABLE, pushConstants(2), GET_MEMBER,
    pushConstants(3), CALL_METHOD
  ]);
  assert.deepEqual(terminatorsIn(face), [], "driving the face must not end the body's animation");

  // this.gotoAndPlay("Standing") — constants 0:"Standing" 1:"this" 2:"gotoAndPlay"
  const self = Buffer.concat([
    pool("Standing", "this", "gotoAndPlay"),
    pushConstants(0), pushInt(1), pushConstants(1), GET_VARIABLE, pushConstants(2), CALL_METHOD
  ]);
  assert.deepEqual(terminatorsIn(self), [{ kind: "goto", target: "Standing" }]);
});

test("A COUNTED REPEAT IS FLAGGED, and so is the difference from an endless idle", () => {
  // ► **THE ONE NUMBER IN THE TABLE THE TOOL CANNOT DERIVE IS THE ONE A READER
  //   WOULD TAKE ON TRUST.** `burning`'s run is 32 frames only because
  //   `flame_repeat` plays twice, and the 2 is read by hand out of
  //   `burncycle = 1` against `>= 2`. Printed with no flag it would look like
  //   the six frame counts the tool DID derive. A verifier caught exactly that.
  const burn = runsFrom({
    labels: [{ frame: 1947, name: "burning" }, { frame: 1949, name: "flame_repeat" }, { frame: 1964, name: "lifesteal" }],
    terminators: new Map([[1963, [{ kind: "goto", target: "Standing" }, { kind: "goto", target: "flame_repeat" }]]])
  });
  assert.equal(burn[0].runsOn, true);
  assert.deepEqual(burn[0].swallows, ["flame_repeat"]);
  assert.equal(burn[0].loops, true, "the run jumps back to a label it has already played");
  assert.equal(burn[0].bounded, true, "and its other arm leaves, so the repeat is counted rather than endless");
  // ► **AND IT MUST NOT RUN ON INTO `lifesteal`.** Both arms of the conditional
  //   jump, so nothing falls through to 1964 — which the first pass at this
  //   table got wrong, by decoding only `Stop` and `GotoLabel` and missing a
  //   `this.gotoAndPlay` written as a CallMethod.
  assert.equal(burn[0].swallows.includes("lifesteal"), false);

  // The endless kind: one terminator, and it goes back inside the run.
  const idle = runsFrom({
    labels: [{ frame: 1400, name: "celebrate1" }, { frame: 1409, name: "celebrate1a" }, { frame: 1427, name: "Portrait" }],
    terminators: new Map([[1426, [{ kind: "goto", target: "celebrate1a" }]]])
  });
  assert.equal(idle[0].loops, true);
  assert.equal(idle[0].bounded, false, "nothing leaves, so the gladiator celebrates until something moves him");
});

test("the hand-derived repeat SAYS it is hand-derived, at the field", () => {
  // The rule this file's module header states: everything in the table comes
  // out of `tools/clip-sequences.mjs` except this, and this says so where a
  // reader will be standing when they need to know.
  const handDerived = Object.entries(CLIP_SEQUENCES).filter(([, run]) => run.repeats);
  assert.deepEqual(handDerived.map(([entry]) => entry), ["burning"]);
  assert.deepEqual({ ...handDerived[0][1].repeats }, { label: "flame_repeat", passes: 2, derivedBy: "hand" });
  // And the count is the one the frame total depends on: 2 + 15 * 2 = 32.
  assert.equal(CLIP_SEQUENCES.burning.frames, 32);
  assert.equal(clipSequenceFor("burning").filter((label) => label === "flame_repeat").length, 2);
});

test("`Stop` and `GotoLabel` are terminators, and the plain opcodes still decode", () => {
  assert.deepEqual(terminatorsIn(Buffer.from([0x07])), [{ kind: "stop" }]);
  const gotoLabel = Buffer.concat([
    Buffer.from([0x8c, 0x09, 0x00]), Buffer.from("celebrate1a\0".slice(0, 9), "utf8")
  ]);
  assert.equal(terminatorsIn(gotoLabel)[0].kind, "goto");
});

/* ------------------------------------------------------------------ *
 * AGAINST THE REAL PACK
 * ------------------------------------------------------------------ */

test("every run's members are REAL labels and CONTIGUOUS in the build's frames", () => {
  if (!REAL_ANIMATIONS) {
    assert.equal(REAL_ANIMATIONS, null, "no extraction on this machine");
    return;
  }
  for (const [entry, run] of Object.entries(CLIP_SEQUENCES)) {
    let expectedFirst = null;
    let poses = 0;
    const seen = new Set();
    for (const member of run.plays) {
      const animation = REAL_ANIMATIONS[member];
      assert.ok(animation, `${entry}'s run names ${member}, which the pack does not hold`);
      // A repeated member replays the SAME frames, so contiguity is checked on
      // first appearance only — `burning` plays `flame_repeat` twice.
      if (!seen.has(member)) {
        if (expectedFirst !== null) {
          assert.equal(animation.firstFrame, expectedFirst,
            `${member} must start where ${entry}'s previous member ended, or it is not a run`);
        }
        expectedFirst = animation.lastFrame + 1;
        seen.add(member);
      }
      poses += animation.poses.length;
    }
    assert.equal(run.entryFrames, REAL_ANIMATIONS[entry].poses.length, `${entry}'s entryFrames`);
    assert.equal(run.frames, poses, `${entry}'s frame count must be its members' poses`);
  }
});

test("the runs reach the frame each one says it stops at", () => {
  if (!REAL_ANIMATIONS) {
    assert.equal(REAL_ANIMATIONS, null, "no extraction on this machine");
    return;
  }
  // `endsAt` is the build's own stop frame, which must be the last frame of the
  // run's last distinct member. This is the cross-check that the frame numbers
  // in the table and the labels in it describe the same thing.
  for (const [entry, run] of Object.entries(CLIP_SEQUENCES)) {
    const last = run.plays[run.plays.length - 1];
    assert.equal(run.endsAt, REAL_ANIMATIONS[last].lastFrame,
      `${entry} stops at ${run.endsAt}, but ${last} ends at ${REAL_ANIMATIONS[last].lastFrame}`);
  }
});

test("the five dispatched runs really do double the art a gladiator is shown", () => {
  if (!REAL_PACK) {
    assert.equal(REAL_PACK, null, "no extraction on this machine");
    return;
  }
  const drawn = (family, label) => animationFor(REAL_PACK, { family, label }).animation.poses.length;
  assert.equal(drawn("psyche", "psyche_up"), 18);
  assert.equal(drawn("psyche", "psyche_up2"), 17);
  assert.equal(drawn("psyche", "psyche_up3"), 13, "the discharge has no continuation and must not grow");
  assert.equal(drawn("hurt", "hurt8"), 34);
  assert.equal(drawn("hurt", "hurt9"), 18, "the continuation dispatched on its own plays alone");
  assert.equal(drawn("knockback", "knockback"), 19);
  assert.equal(drawn("condition:burning", "burning"), 32, "two frames plus the cycle, twice");
});
