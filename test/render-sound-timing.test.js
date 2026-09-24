/**
 * WHEN a clip's sounds fire: at the DRAWN pose the build's `StartSound` sits
 * on, by the drawing's own pose arithmetic.
 *
 * The timing tables are never committed — they come out of the player's own
 * install into `assets/sound/manifest.json` — so every table here is written
 * for the test, in the manifest's own shape. The spans are the build's where
 * this repository already records them (`clip-sequences.js`: `hurt8` 1250-1265
 * then `hurt9` from 1266; `knockback` 1428-1433 then `knockback_mov`
 * 1434-1446), so the pose arithmetic is checked on the real run lengths.
 */
import assert from "node:assert/strict";
import nodeFs from "node:fs";
import nodePath from "node:path";
import { fileURLToPath as toPath } from "node:url";
import test from "node:test";

import {
  SOUND_STALE_MS,
  dueSoundCues,
  leadInFramesFor,
  leadInSecondsFrom,
  soundCuesFor,
  soundLabelFor,
  soundTimingFrom,
  unhonouredCuesIn,
  voiceActionFor
} from "../src/render/sound-timing.js";
import { chooseSound } from "../src/render/sound.js";
import { timelineFor } from "../src/render/timeline.js";
import { allClipLabels } from "../src/render/clip-labels.js";
import { animationFor, figurePackFrom, poseIndexAt } from "../src/render/extracted-figure.js";

/** The player's own extraction, when this machine has one — never committed. */
function readRealPack(relative) {
  const at = nodePath.join(toPath(new URL("..", import.meta.url)), relative);
  return nodeFs.existsSync(at) ? JSON.parse(nodeFs.readFileSync(at, "utf8")) : null;
}
const REAL_MANIFEST = readRealPack("assets/sound/manifest.json");
const REAL_SHAPES = readRealPack("assets/figure/shapes.json");
const REAL_ANIMATIONS = readRealPack("assets/figure/animations.json");
const REAL_PACK = REAL_SHAPES && REAL_ANIMATIONS ? figurePackFrom(REAL_SHAPES, REAL_ANIMATIONS) : null;

/** A manifest's `cues`, in the extractor's own shape. */
function manifestWith(labels, extra = {}) {
  return { bindings: {}, cues: { version: 1, clip: 1241, frameRate: 30, labels }, ...extra };
}

const label = (firstFrame, frames, sounds = []) => ({ firstFrame, frames, sounds });
const at = (file, offset, extra = {}) => ({ file, id: 0, frame: 0, offset, ...extra });

const TIMING = soundTimingFrom(manifestWith({
  standing: label(2, 31),
  stepforward: label(50, 18, [at("706.mp3", 4), at("1088.mp3", 13)]),
  stepback: label(33, 17, [at("1088.mp3", 3), at("706.mp3", 12)]),
  block: label(179, 11),
  hurt1: label(1144, 13, [at("1103.mp3", 5)]),
  hurt8: label(1250, 16),
  hurt9: label(1266, 18, [at("1183.mp3", 0)]),
  knockback: label(1428, 6),
  knockback_mov: label(1434, 13, [at("1104.mp3", 6)]),
  little_fat_kid: label(2200, 23, [at("1240.mp3", 3), at("late.mp3", 19)]),
  death1: label(585, 37, [at("1103.mp3", 2), at("1104.mp3", 20)])
}));

test("an old pack — bindings and no cues — has NO timing, and that is the fallback, not an error", () => {
  assert.equal(soundTimingFrom(null), null);
  assert.equal(soundTimingFrom({}), null);
  assert.equal(soundTimingFrom({ bindings: { hurt1: ["a.mp3"] } }), null);
  assert.equal(soundTimingFrom({ cues: null }), null);
  assert.equal(soundTimingFrom({ cues: { labels: "nonsense" } }), null);
  assert.equal(soundTimingFrom(manifestWith({ hurt1: { frames: 0, sounds: [] } })), null,
    "a table with no usable entry is an old pack to every caller");
});

test("a malformed cue drops out rather than becoming a reference to nothing", () => {
  const timing = soundTimingFrom(manifestWith({
    Hurt1: label(1144, 13, [at("ok.mp3", 5), at("", 1), at("neg.mp3", -1), at("frac.mp3", 1.5),
      { file: "none.mp3" }, at("cut.mp3", 2, { truncated: true })])
  }));
  assert.deepEqual(Object.keys(timing.labels), ["hurt1"], "keys lower-case, as the clip labels are");
  assert.deepEqual(timing.labels.hurt1.sounds.map((sound) => sound.file), ["ok.mp3"]);
  assert.equal(timing.frameRate, 30);
});

test("a label with TWO StartSounds plays BOTH, each at its own pose — not one picked by sequence", () => {
  // The shipped build's `stepforward` carries `706` and `1088`; `chooseSound`
  // played one of the two per step. Timed, a walk is both footsteps.
  const plan = soundCuesFor({ timing: TIMING }, { family: "movement:walk", label: "walkright", facing: "right" });
  assert.equal(plan.timed, true);
  assert.equal(plan.label, "stepforward");
  assert.equal(plan.poseCount, 18);
  assert.deepEqual(plan.cues.map(({ file, poseIndex }) => [file, poseIndex]), [["706.mp3", 4], ["1088.mp3", 13]]);
  // The same for any sequence number: there is nothing left to choose.
  for (const sequence of [0, 1, 2, 7]) {
    assert.deepEqual(soundCuesFor({ timing: TIMING }, { family: "movement:walk", label: "walkright", facing: "right", sequence }).cues, plan.cues);
  }
});

test("a walk sounds as the clip the figure DRAWS, which the facing picks", () => {
  // Walking left while facing right is a step BACK — its own clip, own frames.
  const back = soundCuesFor({ timing: TIMING }, { family: "movement:walk", label: "walkleft", facing: "right" });
  assert.equal(back.label, "stepback");
  assert.deepEqual(back.cues.map(({ file, poseIndex }) => [file, poseIndex]), [["1088.mp3", 3], ["706.mp3", 12]]);
  assert.equal(soundCuesFor({ timing: TIMING }, { family: "movement:walk", label: "walkleft", facing: "left" }).label, "stepforward");
  // And the drawing's own resolved label, when the shell has one, wins.
  assert.equal(soundLabelFor("movement:walk", { label: "walkleft", facing: "left", drawnLabel: "stepback" }), "stepback");
  // A drawn label outside the family is not taken — membership is the guard.
  assert.equal(soundLabelFor("movement:walk", { label: "walkright", facing: "right", drawnLabel: "attack1" }), "stepforward");
});

test("A CONTINUATION'S SOUND FIRES AT ITS FRAME IN THE RUN: hurt8 -> hurt9 at pose 16 of 34", () => {
  const plan = soundCuesFor({ timing: TIMING }, { family: "hurt", label: "hurt8" });
  assert.equal(plan.label, "hurt8");
  assert.equal(plan.poseCount, 34, "16 + 18, the build's 1250-1283");
  assert.deepEqual(plan.cues.map(({ file, poseIndex }) => [file, poseIndex]), [["1183.mp3", 16]],
    "frame 1266 is 16 frames after 1250");
});

test("and the knockback's at pose 12 of 19 — not 7, which counted from knockback_mov and from 1", () => {
  const plan = soundCuesFor({ timing: TIMING }, { family: "knockback", label: "knockback" });
  assert.equal(plan.poseCount, 19);
  assert.deepEqual(plan.cues.map(({ file, poseIndex }) => [file, poseIndex]), [["1104.mp3", 12]]);
  // Dispatched on its own (the `cast_command` pull), `knockback_mov` is its own run.
  const pulled = soundCuesFor({ timing: TIMING }, { family: "knockback", label: "knockback_mov" });
  assert.equal(pulled.poseCount, 13);
  assert.deepEqual(pulled.cues.map(({ poseIndex }) => poseIndex), [6]);
});

test("a tag past the build's STOP is never reached, so it is not a cue", () => {
  // `little_fat_kid` stops at 2216, 17 frames into its 23-frame span.
  const plan = soundCuesFor({ timing: TIMING }, { family: "little_fat_kid", label: "little_fat_kid" });
  assert.equal(plan.poseCount, 17);
  assert.deepEqual(plan.cues.map(({ file }) => file), ["1240.mp3"]);
});

test("A RUN THAT ENDS ON A JUMP draws each pass a frame short, and a tag ON the jump frame plays on the tick that enters it", () => {
  // ► **ADDED 2026-09-24 AFTER AN ADVERSARIAL VERIFIER BROKE `burning`'s 32.**
  //   1963 ends both `flame_repeat` passes with a jump (`clipPassesFor`). AVM1
  //   processes the frame's tags and runs its actions — the jump among them —
  //   before it renders, so that tick SHOWS the jump's target: the drawing has
  //   2 + 14 + 14 poses, not 32. A `StartSound` on the jump frame still starts
  //   on that tick, which is the next pass's first pose. The shipped build puts
  //   none there (`flame_repeat` carries no sound); the tags below are this
  //   test's, so the arithmetic is pinned before a build that does.
  const timing = soundTimingFrom(manifestWith({
    burning: label(1947, 2, [at("1216.mp3", 0), at("1181.mp3", 1)]),
    flame_repeat: label(1949, 15, [at("second.mp3", 1), at("jump.mp3", 14)])
  }));
  const plan = soundCuesFor({ timing }, { family: "condition:burning", label: "burning" });
  assert.equal(plan.poseCount, 30, "2 + 14 + 14 frames shown — not the 32 slots the playhead passes");
  assert.deepEqual(plan.cues.map(({ file, poseIndex }) => [file, poseIndex]), [
    ["1216.mp3", 0], ["1181.mp3", 1],
    ["second.mp3", 3],   // 1950 on the first pass
    ["jump.mp3", 16],    // 1963, entered on the tick that shows the second pass's 1949
    ["second.mp3", 17]   // 1950 again
    // and 1963's tag on the LAST pass is the tick the run hands back to
    // `Standing` — past the last drawn pose, like the build's `struck = true`
  ]);
});

test("THE SOUND PLAN COUNTS THE POSES THE DRAWING DRAWS, for every run, on the player's own packs", () => {
  // The one number the two must share: `dueSoundCues` picks the drawn pose
  // with `poseIndexAt(plan.poseCount, at)`, so a plan counting 32 against a
  // drawing of 30 fires every cue on the wrong frame.
  if (!REAL_MANIFEST || !REAL_PACK) {
    assert.ok(!REAL_MANIFEST || !REAL_PACK, "no extraction on this machine");
    return;
  }
  const timing = soundTimingFrom(REAL_MANIFEST);
  for (const label of ["hurt8", "knockback", "psyche_up", "psyche_up2", "burning", "celebrate1"]) {
    const { family } = timelineFor(label, { role: "actor" });
    const drawn = animationFor(REAL_PACK, { family, label });
    const plan = soundCuesFor({ timing }, { family, label, drawnLabel: drawn.label });
    assert.equal(plan.poseCount, drawn.animation.poses.length, `${label}: the plan and the drawing count the same poses`);
  }
});

test("hurt8's sound lands where the BUILD's does, on the player's own manifest: frame 1267, pose 17, 566.7 ms", () => {
  // ► **CORRECTED 2026-09-24 by an adversarial verifier.** This file's fixture
  //   puts `1183.mp3` on `hurt9`'s FIRST frame, 1266 (offset 0), and the
  //   sweep above times it at pose 16, 533.3 ms — right for the fixture. The
  //   clip-speed report and a comment here carried those numbers over as the
  //   BUILD's; the real manifest has the tag at 1267, offset 1: run pose 17,
  //   566.7 ms at the build's 30 fps (600 under the old 1,200 ms schedule).
  if (!REAL_MANIFEST) {
    assert.equal(REAL_MANIFEST, null, "no extraction on this machine");
    return;
  }
  const hurt9 = REAL_MANIFEST.cues.labels.hurt9;
  assert.deepEqual(hurt9.sounds.map(({ file, frame, offset }) => [file, frame, offset]), [["1183.mp3", 1267, 1]]);
  const timeline = timelineFor("hurt8", { role: "target" });
  const plan = soundCuesFor({ timing: soundTimingFrom(REAL_MANIFEST) }, { family: timeline.family, label: timeline.label });
  assert.deepEqual(plan.cues.map(({ file, poseIndex }) => [file, poseIndex]), [["1183.mp3", 17]]);
  let fired = 0;
  let firstFiredAt = null;
  for (let elapsed = 0; elapsed <= timeline.durationMs; elapsed += 0.5) {
    const result = dueSoundCues(plan, { elapsedMs: elapsed, durationMs: timeline.durationMs, fired });
    if (result.due.length > 0 && firstFiredAt === null) firstFiredAt = elapsed;
    fired = result.fired;
  }
  assert.ok(Math.abs(firstFiredAt - 1700 / 3) <= 0.5, `fired ${firstFiredAt} ms in, where the build's is 566.7`);
});

test("silence stays silence: the idle, a held stance, and a run with no tags", () => {
  assert.deepEqual(soundCuesFor({ timing: TIMING }, { family: "standing", label: "Standing" }).cues, []);
  assert.deepEqual(soundCuesFor({ timing: TIMING }, { family: "stance:psyche", label: "psyche_charging" }).cues, []);
  const block = soundCuesFor({ timing: TIMING }, { family: "block", label: "Block" });
  assert.equal(block.timed, true);
  assert.deepEqual(block.cues, []);
  assert.equal(soundLabelFor(null), null);
});

test("an OLD pack plays chooseSound's one file at pose 0 — exactly what the arena did before", () => {
  const bindings = { hurt9: ["1183.mp3"], attack1: ["a1.mp3"], attack2: ["a2.mp3"] };
  for (const [family, labelName, sequence] of [["hurt", "hurt8", 0], ["attack", null, 1], ["attack", "attack2", 5]]) {
    const plan = soundCuesFor({ bindings, timing: null }, { family, label: labelName, sequence });
    assert.equal(plan.timed, false);
    assert.deepEqual(plan.cues.map(({ file, poseIndex }) => [file, poseIndex]),
      [[chooseSound(bindings, family, sequence, labelName), 0]]);
  }
  assert.deepEqual(soundCuesFor({ bindings, timing: null }, { family: "block", label: "Block" }).cues, []);
  assert.deepEqual(soundCuesFor({}, { family: "hurt", label: "hurt1" }).cues, [], "no assets at all: silence");
});

test("a table from some other build, missing a member of the run, falls back rather than guessing", () => {
  const partial = soundTimingFrom(manifestWith({ hurt8: label(1250, 16) }));
  const plan = soundCuesFor({ bindings: { hurt9: ["1183.mp3"] }, timing: partial }, { family: "hurt", label: "hurt8" });
  assert.equal(plan.timed, false);
  assert.deepEqual(plan.cues.map(({ file, poseIndex }) => [file, poseIndex]), [["1183.mp3", 0]]);
});

test("A CUE FIRES EXACTLY WHEN THE DRAWING SHOWS ITS POSE, at every millisecond of the run", () => {
  // The drawing picks its pose with `poseIndexAt(count, at)`; the property is
  // that the sound starts on the first draw showing the cue's pose, whatever
  // the frame timing — so it is swept, not sampled.
  const timeline = timelineFor("hurt8", { role: "target" });
  // ~~"hurt8's authored run: 10 beats of 120 ms"~~ — the build's own 34 frames
  // at its 30 fps since 2026-09-24 (`test/render-build-timing.test.js`).
  assert.ok(Math.abs(timeline.durationMs - 3400 / 3) < 1e-6, `hurt8's run: 34 of the build's frames, not ${timeline.durationMs} ms`);
  const plan = soundCuesFor({ timing: TIMING }, { family: timeline.family, label: timeline.label });
  let fired = 0;
  let firstFiredAt = null;
  for (let elapsed = 0; elapsed <= timeline.durationMs; elapsed += 0.5) {
    const drawn = poseIndexAt(plan.poseCount, Math.min(1, elapsed / timeline.durationMs));
    const result = dueSoundCues(plan, { elapsedMs: elapsed, durationMs: timeline.durationMs, fired });
    if (result.due.length > 0) {
      assert.equal(firstFiredAt, null, "a cue fires once");
      firstFiredAt = elapsed;
      assert.equal(drawn, 16, "on the draw that first shows pose 16");
    } else if (firstFiredAt === null) {
      assert.ok(drawn < 16, `nothing before pose 16 is drawn (pose ${drawn} at ${elapsed} ms)`);
    }
    fired = result.fired;
  }
  // ~~16/34 of 1200 ms~~ — frame 1266 is sixteen of the build's frames into
  // the run, 533.3 ms at 30 fps~~, which is where the build starts it~~. To the
  // half-millisecond sweep. *(Corrected 2026-09-24 by an adversarial verifier:
  // 1266 is THIS FIXTURE's frame for the tag, offset 0. The build's is 1267,
  // offset 1 — run pose 17, 566.7 ms, and 600 under the old schedule; the
  // player's-manifest test below pins it.)*
  assert.ok(Math.abs(firstFiredAt - 16 * (1000 / 30)) <= 0.5, `fired at ${firstFiredAt} ms`);
});

test("AND THE KNOCKBACK'S SOUND LANDS WHERE THE BUILD'S DOES: frame 1440, 400 ms into the run — not 1,000", () => {
  // `knockback_mov` -> `1104.mp3` at frame 1440 (`clip-sequences.js`): twelve
  // frames after the run's first, 1428. The sound implementer measured it
  // firing 1,000 ms in while the knockback was drawn over 1,560 ms; drawn at
  // the build's rate it is the build's 400.
  const timeline = timelineFor("knockback", { role: "target" });
  const plan = soundCuesFor({ timing: TIMING }, { family: timeline.family, label: timeline.label });
  assert.deepEqual(plan.cues.map(({ file, poseIndex }) => [file, poseIndex]), [["1104.mp3", 12]]);
  let fired = 0;
  let firstFiredAt = null;
  for (let elapsed = 0; elapsed <= timeline.durationMs; elapsed += 0.5) {
    const result = dueSoundCues(plan, { elapsedMs: elapsed, durationMs: timeline.durationMs, fired });
    if (result.due.length > 0 && firstFiredAt === null) firstFiredAt = elapsed;
    fired = result.fired;
  }
  assert.ok(Math.abs(firstFiredAt - 400) <= 0.5, `the knockback's sound fired ${firstFiredAt} ms in, where the build's is 400`);
});

test("a clip that has not begun fires nothing — the delayed victim is heard at impact", () => {
  // An arrow's or a fireball's victim is stamped with a FUTURE start
  // (`reactionDelaysFor`), so the shell's elapsed time is negative until then.
  const plan = soundCuesFor({ timing: TIMING }, { family: "hurt", label: "hurt1" });
  assert.deepEqual(dueSoundCues(plan, { elapsedMs: -250, durationMs: 600 }), { due: [], dropped: [], fired: 0 });
  // Once it begins, the cue waits for its own pose (5 of 13 of 600 ms).
  assert.equal(dueSoundCues(plan, { elapsedMs: 200, durationMs: 600 }).due.length, 0);
  assert.equal(dueSoundCues(plan, { elapsedMs: 240, durationMs: 600 }).due.length, 1);
});

test("A CLIP CUT SHORT BEFORE ITS FRAME NEVER SOUNDS IT", () => {
  // `settleEntrySounds` settles a replaced entry at the moment it is replaced:
  // whatever it reached, and nothing after.
  const plan = soundCuesFor({ timing: TIMING }, { family: "death:slain", label: "death1" });
  assert.equal(plan.label, "death1");
  // Drawn at 60 fps: the grunt at pose 2 of 37 (65 ms of 1200) is heard...
  let fired = 0;
  const heard = [];
  for (let elapsed = 0; elapsed <= 500; elapsed += 1000 / 60) {
    const result = dueSoundCues(plan, { elapsedMs: elapsed, durationMs: 1200, fired });
    heard.push(...result.due.map(({ file }) => file));
    fired = result.fired;
  }
  assert.deepEqual(heard, ["1103.mp3"]);
  // ...and the clip is REPLACED at 500 ms, where the settle hands nothing on:
  // the thud at pose 20 (649 ms) was never reached and is never owed.
  const cut = dueSoundCues(plan, { elapsedMs: 500, durationMs: 1200, fired });
  assert.deepEqual(cut.due, []);
  assert.equal(cut.fired, 1);
});

test("a clip that ENDS between two draws still sounds its last pose, once", () => {
  const plan = { poseCount: 10, cues: [{ file: "last.mp3", poseIndex: 9 }] };
  // The last draw showed pose 8; the next frame finds the clip 10 ms over.
  assert.equal(dueSoundCues(plan, { elapsedMs: 890, durationMs: 1000 }).due.length, 0);
  const settled = dueSoundCues(plan, { elapsedMs: 1010, durationMs: 1000 });
  assert.deepEqual(settled.due.map(({ file }) => file), ["last.mp3"]);
  assert.equal(dueSoundCues(plan, { elapsedMs: 1020, durationMs: 1000, fired: settled.fired }).due.length, 0);
});

test("a STALE cue is dropped, not played — a tab back from the background is not a burst of noise", () => {
  const plan = soundCuesFor({ timing: TIMING }, { family: "death:slain", label: "death1" });
  const back = dueSoundCues(plan, { elapsedMs: 60_000, durationMs: 1200 });
  assert.deepEqual(back.due, []);
  assert.equal(back.dropped.length, 2);
  assert.equal(back.fired, 2, "handled, so neither can fire later");
  // Within the bound it still plays: late by less than a few frames is on time.
  const late = dueSoundCues({ poseCount: 1, cues: [{ file: "x.mp3", poseIndex: 0 }] },
    { elapsedMs: SOUND_STALE_MS - 1, durationMs: 600 });
  assert.equal(late.due.length, 1);
});

test("SyncStop stops, SyncNoMultiple skips a sound already playing, and anything else plays", () => {
  const playing = new Set(["busy.mp3"]);
  const isPlaying = (file) => playing.has(file);
  assert.equal(voiceActionFor({ file: "a.mp3" }, isPlaying), "play");
  assert.equal(voiceActionFor({ file: "a.mp3", stop: true }, isPlaying), "stop");
  assert.equal(voiceActionFor({ file: "busy.mp3", noMultiple: true }, isPlaying), "skip");
  assert.equal(voiceActionFor({ file: "free.mp3", noMultiple: true }, isPlaying), "play");
  assert.equal(voiceActionFor({ file: "busy.mp3" }, isPlaying), "play", "overlap is the default");
  assert.equal(voiceActionFor(null), "skip");
});

test("the SOUNDINFO fields this arena does not honour are counted, so the shell can say so", () => {
  assert.equal(unhonouredCuesIn(TIMING), 0);
  const odd = soundTimingFrom(manifestWith({
    hurt1: label(1, 5, [at("a.mp3", 0, { loops: 3 }), at("b.mp3", 1, { inPoint: 10 }), at("c.mp3", 2, { envelope: [[0, 1, 1]] }),
      at("d.mp3", 3, { loops: 1 })])
  }));
  assert.equal(unhonouredCuesIn(odd), 3, "a loop count of 1 is a plain play");
  assert.equal(unhonouredCuesIn(null), 0);
});

test("the MP3 lead-in is SeekSamples over the file's own rate, and only where it is silent", () => {
  assert.deepEqual(leadInSecondsFrom({
    sounds: [
      { file: "a.mp3", seekSamples: 1105, rate: 22050 },
      { file: "b.mp3", seekSamples: 0, rate: 44100 },
      { file: "c.mp3", seekSamples: null, rate: 44100 },
      { file: "d.mp3", seekSamples: -4, rate: 44100 }
    ]
  }), { "a.mp3": 1105 / 22050 });
  assert.deepEqual(leadInSecondsFrom(null), {});

  // 10 frames of silence, then sound. A cap of 100 frames trims only the 10;
  // a cap of 4 trims 4. The attack is never cut.
  const channel = new Float32Array(200);
  channel.fill(0.5, 10);
  assert.equal(leadInFramesFor([channel], 1000, 0.1), 10);
  assert.equal(leadInFramesFor([channel], 1000, 0.004), 4);
  // Any channel carrying sound ends the lead-in.
  const quiet = new Float32Array(200);
  const loud = new Float32Array(200);
  loud[3] = -0.2;
  assert.equal(leadInFramesFor([quiet, loud], 1000, 0.1), 3);
  assert.equal(leadInFramesFor([], 1000, 0.1), 0);
  assert.equal(leadInFramesFor([channel], 1000, 0), 0);
});

/**
 * ► **SOUND AND ART MUST RESOLVE THE SAME CLIP**, or a walking figure makes
 *   the other gait's footsteps. `soundLabelFor` mirrors `animationFor`'s
 *   candidate order; this checks the mirror against the real thing, on a pack
 *   holding every label, for every family the engine produces and both facings.
 */
test("the sounded label IS the drawn label, for every family and both facings", () => {
  const animations = {};
  for (const name of new Set(["standing", ...allClipLabels()])) {
    animations[name] = { poses: [[]], firstFrame: 1, lastFrame: 1, bounds: { xMin: -10, xMax: 10, yMin: -220, yMax: 0 } };
  }
  const pack = figurePackFrom({}, animations);
  const labels = [
    "walkleft", "walkright", "runleft", "runright", "chargeleft", "chargeright", "jumpleft", "jumpright", "sidestep",
    ...Array.from({ length: 12 }, (_, index) => `attack${index + 1}`),
    ...Array.from({ length: 12 }, (_, index) => `hurt${index + 1}`),
    "knockback", "knockback_mov", "rest", "Block", "shove", "drink_potion", "taunt", "taunted", "bombard", "snipe",
    "Cast1", "Cast2", "lightning", "Rejuvinate", "Colossus", "little_fat_kid", "psyche_up", "psyche_up2", "psyche_up3",
    "wincrowd1", "wincrowd4", "wincrowd6"
  ];
  let compared = 0;
  const cases = [
    ...labels.flatMap((name) => [[name, "actor"], [name, "target"]]),
    // The death VARIANTS, which reach a clip only through the `defeated` role.
    ...["slain", "yield", "taunt", "arrow", "grievous"].map((name) => [name, "defeated"])
  ];
  let deaths = 0;
  for (const [engineLabel, role] of cases) {
    const { family } = timelineFor(engineLabel, { role });
    for (const facing of ["left", "right"]) {
      const sounded = soundLabelFor(family, { label: engineLabel, facing });
      if (sounded === null) continue;
      const drawn = animationFor(pack, { family, label: engineLabel, facing });
      assert.equal(sounded, drawn?.label, `${engineLabel} (${role}, ${family}) facing ${facing}`);
      compared += 1;
      if (role === "defeated") deaths += 1;
    }
  }
  assert.ok(compared > 100, `compared ${compared} cases`);
  assert.ok(deaths > 0, "and the death variants were among them, not all silent");
});
