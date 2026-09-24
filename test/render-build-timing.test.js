/**
 * THE BUILD'S OWN SCHEDULE — how long one of its frames lasts, and which of
 * this engine's clip schedules play the build's frames at that rate.
 *
 * WHY THIS FILE EXISTS: a knockback was drawn over 1,560 ms where the build
 * plays it in 633 (the sound implementer's measurement, 2026-09-24). Measured
 * across every family the same day, the causes were two, and both are in the
 * UNIT rather than in any one number:
 *
 * - **a 120 ms BEAT was used as one of the build's FRAMES** — `psyche_up`,
 *   `psyche_up2`, `psyche_up3` and `celebrate1` were given one beat per pack
 *   frame and so ran exactly 120 / 33.3 = 3.6 times the build's length;
 * - **a "pace" was imputed to two families that were never authored at one** —
 *   `hurt`'s five beats and `knockback`'s nine were written on 2026-09-10
 *   (473ef59), three days before any frame of the fighter was extracted
 *   (ede9350), and `clip-sequences.js` then scaled them over the runs as if they
 *   had been chosen against a clip length.
 *
 * The seams: the build's frame clock in `build-timing.js`; `timelineFor`; the
 * drawing's own pose clock (`animationFor` + `poseIndexAt`); and the sound
 * cues (`soundCuesFor` + `dueSoundCues`).
 */
import assert from "node:assert/strict";
import nodeFs from "node:fs";
import nodePath from "node:path";
import { fileURLToPath as toPath } from "node:url";
import test from "node:test";

import { BUILD_FRAME_MS, BUILD_FRAME_RATE, buildFramesMs } from "../src/render/build-timing.js";
import { allClipLabels } from "../src/render/clip-labels.js";
import { animationFor, figurePackFrom, poseIndexAt } from "../src/render/extracted-figure.js";
import { timelineFor } from "../src/render/timeline.js";

const ROOT = toPath(new URL("..", import.meta.url));
const readJson = (relative) => JSON.parse(nodeFs.readFileSync(nodePath.join(ROOT, relative), "utf8"));

test("the build's frame rate is the one the committed fingerprint records for the oracle", () => {
  // The fingerprint is sha256-bound to the measurement oracle and committed,
  // so a fresh clone checks this too — no pack, no skip.
  const fingerprint = readJson("docs/integration/ss2-build-fingerprint.json");
  assert.equal(fingerprint.collection.ss2.sha256.toLowerCase(),
    "77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca", "the oracle's own record");
  assert.equal(BUILD_FRAME_RATE, fingerprint.collection.ss2.frameRate);
  // And one frame of it, as a worked number rather than the same division.
  assert.ok(Math.abs(BUILD_FRAME_MS - 33.333333) < 1e-6, `one frame at 30 fps is 33.3 ms, not ${BUILD_FRAME_MS}`);
});

test("a run of the build's frames is timed with ONE rounding, so a whole-millisecond length stays whole", () => {
  // 27 frames of a pre-divided 33.33... ms is 900.0000000000001, and a loop
  // that wraps at that length lands a hair short of its own boundary — which
  // is how the celebration's second pass came out in the body's LAST pose.
  assert.equal(buildFramesMs(27), 900);
  assert.equal(buildFramesMs(18), 600);
  assert.ok(Math.abs(buildFramesMs(19) - 1900 / 3) < 1e-9);
  for (const bad of [0, -1, 1.5, Number.NaN, "19", null]) {
    assert.throws(() => buildFramesMs(bad), /frame count/, `${String(bad)} is not a frame count`);
  }
});

/** Equal to within float noise: 19 frames of 33.3 ms is not an exact binary number. */
function near(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} ms, expected ${expected}`);
}

test("A KNOCKBACK PLAYS ITS 19 FRAMES IN 633 ms, THE BUILD'S TIME, not the 1,560 it was drawn over", () => {
  // `knockback` 1428-1433 runs on into `knockback_mov` 1434-1446 and stops at
  // 1446: nineteen of the build's frames (`CLIP_SEQUENCES.knockback`).
  const run = timelineFor("knockback", { role: "target" });
  near(run.durationMs, 1900 / 3, "the knockback run");
  assert.equal(run.provenance, "build-frames", "and it says whose clock it runs on");
});

test("`knockback_mov` dispatched on its own plays ITS 13 frames at the build's rate", () => {
  // `defender.gotoAndPlay("knockback_mov")` at `+0x7c5e` (the command spell's
  // pull): 1434-1446, one `Stop`. The family's nine beats were said to be
  // "the length the family's nine beats were authored at" — they were written
  // on 2026-09-10, before any frame of the fighter had been extracted.
  const pulled = timelineFor("knockback_mov", { role: "target" });
  near(pulled.durationMs, 1300 / 3, "knockback_mov alone");
  assert.equal(pulled.provenance, "build-frames");
});

test("THE ONE-BEAT-A-FRAME CLIPS play their frames at 33.3 ms each, not at 120", () => {
  // Each was 3.6 times the build's length — exactly 120 / 33.3, the signature
  // of a beat standing in for a frame. Frame counts are the build's:
  // `psyche_up` 1609-1626 (18, the run), `psyche_up2` 1627-1643 (17),
  // `psyche_up3` 1644-1656 (13), `celebrate1` 1400-1426 (27, one pass).
  const cases = [
    ["psyche_up", "actor", 600],
    ["psyche_up2", "actor", 1700 / 3],
    ["psyche_up3", "actor", 1300 / 3],
    ["celebrate1", "actor", 900]
  ];
  for (const [label, role, ms] of cases) {
    const timeline = timelineFor(label, { role });
    near(timeline.durationMs, ms, label);
    assert.equal(timeline.provenance, "build-frames", `${label} runs on the build's clock`);
  }
});

test("the other two runs the build's frame actions extend play at its rate too", () => {
  // `hurt8` 1250-1265 runs on into `hurt9` to the stop at 1283 (34 frames);
  // `burning` is 2 + 15 + 15 frame slots, `flame_repeat` twice (32).
  near(timelineFor("hurt8", { role: "target" }).durationMs, 3400 / 3, "hurt8 -> hurt9");
  near(timelineFor("burning", { role: "actor" }).durationMs, 3200 / 3, "burning, flame_repeat twice");
});

/**
 * THE EIGHT LABELS ON THE BUILD'S CLOCK, with the build's frame counts — and
 * the control, which is every other label: a change to `timelineFor` reaches
 * every animation in the game, and "the knockback is right" would be satisfied
 * by a change that also sped up every attack.
 */
const ON_THE_BUILDS_CLOCK = Object.freeze({
  knockback: 19, knockback_mov: 13, hurt8: 34, burning: 32,
  psyche_up: 18, psyche_up2: 17, psyche_up3: 13, celebrate1: 27
});

test("EXACTLY EIGHT LABELS MOVED to the build's clock, and every other stays on the authored beat", () => {
  const moved = [];
  for (const label of allClipLabels()) {
    for (const role of ["actor", "target", "defeated"]) {
      const timeline = timelineFor(label, { role });
      if (timeline.provenance === "build-frames") {
        moved.push(label);
        near(timeline.durationMs, ON_THE_BUILDS_CLOCK[label] * (1000 / 30), `${label} as ${role}`);
        continue;
      }
      assert.equal(timeline.provenance, "authored-timing", `${label} as ${role}`);
      assert.equal(timeline.durationMs % 120, 0, `${label} as ${role} stays a whole number of 120 ms beats`);
    }
  }
  // Every label as `defeated` is a death variant's schedule, which is authored.
  assert.deepEqual([...new Set(moved)].sort(), Object.keys(ON_THE_BUILDS_CLOCK).sort());
});

/* ------------------------------------------------------------------ *
 * AGAINST THE DRAWING — the player's own pack, when this machine has it
 * ------------------------------------------------------------------ */

function readRealPack(relative) {
  const at = nodePath.join(ROOT, relative);
  return nodeFs.existsSync(at) ? JSON.parse(nodeFs.readFileSync(at, "utf8")) : null;
}
const REAL_SHAPES = readRealPack("assets/figure/shapes.json");
const REAL_ANIMATIONS = readRealPack("assets/figure/animations.json");
const REAL_PACK = REAL_SHAPES && REAL_ANIMATIONS ? figurePackFrom(REAL_SHAPES, REAL_ANIMATIONS) : null;

test("EVERY POSE OF THE DRAWN RUN IS FIRST SHOWN ON ITS OWN BUILD FRAME — so its sounds and blood are too", () => {
  // The repository's convention for the gitignored pack: a clone without it
  // passes on the committed half above rather than adding a skip.
  if (!REAL_PACK) {
    assert.equal(REAL_PACK, null, "no extraction on this machine");
    return;
  }
  // Sounds (`dueSoundCues`) and blood (the shell's `drawnAt * poseCount`) both
  // fire when the drawn pose reaches theirs, and the drawn pose is
  // `poseIndexAt(poses, elapsed / durationMs)`. So "pose p is first drawn at
  // p frames of the build's time" is the whole claim for all three.
  for (const [label, frames] of Object.entries(ON_THE_BUILDS_CLOCK)) {
    const role = ["knockback", "knockback_mov", "hurt8"].includes(label) ? "target" : "actor";
    const timeline = timelineFor(label, { role });
    const drawn = animationFor(REAL_PACK, { family: timeline.family, label });
    assert.ok(drawn, `${label} draws from the pack`);
    const poses = drawn.animation.poses.length;
    assert.equal(poses, frames, `${label}: the drawing shows the build's ${frames} frames`);
    for (let pose = 1; pose < poses; pose += 1) {
      const buildMs = pose * (1000 / 30);
      const before = poseIndexAt(poses, (buildMs - 0.01) / timeline.durationMs);
      const after = poseIndexAt(poses, (buildMs + 0.01) / timeline.durationMs);
      assert.equal(before, pose - 1, `${label} pose ${pose} must not show before ${buildMs.toFixed(1)} ms`);
      assert.equal(after, pose, `${label} pose ${pose} must show from ${buildMs.toFixed(1)} ms`);
    }
  }
});
