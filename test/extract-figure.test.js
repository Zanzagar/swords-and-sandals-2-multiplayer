/**
 * The figure extractor's GUARDS and its pure helpers.
 *
 * The extraction itself needs a licensed build and is therefore not under the
 * suite — `node tools/extract-figure.mjs --report` is how that is checked, and
 * `preview.html` is how a person checks the result. What IS under the suite is
 * everything that can go wrong without a build present: where the tool is
 * allowed to write, what it refuses to write through, and the arithmetic that
 * turns poses into a viewBox.
 *
 * ► **The write guards exist because of a Codex adversarial review, and they
 *   guard two different things.** One is licensing: `--out .` puts extracted
 *   art in the repository root where the ignore rule does not reach it, and on
 *   2026-09-01 exactly that lost 67 raw traces to a single `git add -A`. The
 *   other is evidence: `writeFileSync` follows a symlink and truncates its
 *   destination, and the destination most worth not truncating on this machine
 *   is the measurement oracle the same run is reading.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ExtractFigureError,
  assertReplaceableFile,
  assertWritableOutput,
  labelKey,
  parseArguments,
  poseBounds
} from "../tools/extract-figure.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SWF = "/somewhere/else/swords_sandals2_download.swf";

/** A scratch directory outside the repository, removed by the caller. */
function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "extract-figure-test-"));
}

test("inside the repository, only assets/ may be written to", () => {
  assert.doesNotThrow(() => assertWritableOutput(path.join(REPO_ROOT, "assets", "figure"), SWF));
  assert.doesNotThrow(() => assertWritableOutput(path.join(REPO_ROOT, "assets", "anything", "deeper"), SWF));

  for (const bad of [REPO_ROOT, path.join(REPO_ROOT, "src"), path.join(REPO_ROOT, "docs", "handoffs")]) {
    assert.throws(() => assertWritableOutput(bad, SWF), (error) => {
      assert.ok(error instanceof ExtractFigureError);
      assert.match(error.message, /inside the repository but outside assets\//);
      return true;
    }, `${bad} must be refused`);
  }
});

test("outside the repository is free, because nothing out there can be committed by accident", () => {
  const directory = scratch();
  try {
    // `doesNotThrow` rather than a bare call: the suite's own meta-test is
    // right that a test body which only runs code reports green for any
    // behaviour, this guard turning into a no-op included.
    assert.doesNotThrow(() => assertWritableOutput(directory, SWF));
    assert.doesNotThrow(() => assertWritableOutput(path.join(directory, "one", "two"), SWF));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("the directory holding the build being read is refused outright", () => {
  const directory = scratch();
  try {
    const swf = path.join(directory, "swords_sandals2_download.swf");
    assert.throws(() => assertWritableOutput(directory, swf), /measurement oracle/);
    assert.throws(() => assertWritableOutput(path.dirname(swf), swf), /measurement oracle/);
    // A sibling directory is fine: it does not contain the build.
    assert.doesNotThrow(() => assertWritableOutput(path.join(directory, "out"), swf));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("a symlinked target is refused, because writing through it truncates what it points at", () => {
  const directory = scratch();
  try {
    const victim = path.join(directory, "pretend-build.swf");
    fs.writeFileSync(victim, "the oracle's bytes");
    const link = path.join(directory, "manifest.json");
    fs.symlinkSync(victim, link);

    assert.throws(() => assertReplaceableFile(link, victim), (error) => {
      assert.ok(error instanceof ExtractFigureError);
      assert.match(error.message, /is a symlink/);
      return true;
    });
    assert.equal(fs.readFileSync(victim, "utf8"), "the oracle's bytes", "the guard must not have touched it");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("a target that IS the build is refused even without a link in the way", () => {
  const directory = scratch();
  try {
    const swf = path.join(directory, "build.swf");
    fs.writeFileSync(swf, "bytes");
    assert.throws(() => assertReplaceableFile(swf, swf), /Refusing to write over the build/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("an ordinary file and a missing file are both replaceable", () => {
  const directory = scratch();
  try {
    const target = path.join(directory, "shapes.json");
    assert.doesNotThrow(() => assertReplaceableFile(target, SWF), "nothing there yet");
    fs.writeFileSync(target, "{}");
    assert.doesNotThrow(() => assertReplaceableFile(target, SWF), "a previous run's output");
    fs.mkdirSync(path.join(directory, "a-directory"));
    assert.throws(() => assertReplaceableFile(path.join(directory, "a-directory"), SWF), /not a regular file/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("an unknown flag THROWS rather than running a different job and reporting it as this one", () => {
  assert.deepEqual(parseArguments(["--report"]).report, true);
  assert.equal(parseArguments(["--clip", "703"]).clip, 703);
  assert.equal(parseArguments(["/some/build.swf"]).file, "/some/build.swf");
  assert.throws(() => parseArguments(["--frames", "1-30"]), /Unknown flag "--frames"/);
  assert.throws(() => parseArguments(["--out"]), /--out needs a directory path/);
  assert.throws(() => parseArguments(["--clip", "zero"]), /--clip needs a positive character id/);
  assert.throws(() => parseArguments(["a.swf", "b.swf"]), /Unexpected argument/);
});

test("a label becomes a key that is safe in a file name and in a URL", () => {
  assert.equal(labelKey("StepForward"), "stepforward");
  assert.equal(labelKey("Death_Poisoned"), "death_poisoned");
  assert.equal(labelKey("Attack 1 / left"), "attack-1-left");
  assert.equal(labelKey("--odd--"), "odd");
});

test("pose bounds transform all FOUR corners, because a rotated box is not two rotated corners", () => {
  const shapes = { 1: { bounds: { xMin: 0, xMax: 10, yMin: 0, yMax: 4 } } };
  // A quarter turn: the 10-wide, 4-tall box becomes 4 wide and 10 tall.
  const rotated = poseBounds(shapes, [[{ shape: 1, matrix: [0, 1, -1, 0, 0, 0] }]]);
  assert.deepEqual(rotated, { xMin: -4, xMax: 0, yMin: 0, yMax: 10 });

  // Translation is in TWIPS in the pose data and pixels in the bounds, which is
  // the one unit mismatch in this pipeline and the reason this is asserted.
  const moved = poseBounds(shapes, [[{ shape: 1, matrix: [1, 0, 0, 1, 200, -40] }]]);
  assert.deepEqual(moved, { xMin: 10, xMax: 20, yMin: -2, yMax: 2 });

  assert.deepEqual(poseBounds(shapes, []), { xMin: 0, xMax: 0, yMin: 0, yMax: 0 });
  assert.deepEqual(
    poseBounds(shapes, [[{ shape: 999, matrix: [1, 0, 0, 1, 0, 0] }]]),
    { xMin: 0, xMax: 0, yMin: 0, yMax: 0 },
    "a shape that failed to parse must not poison the viewBox with Infinity"
  );
});
