/**
 * `tools/shot-live.mjs` — the parts a test can reach.
 *
 * ► **WHAT THIS CANNOT TEST, SAID FIRST.** The tool's job is to drive a real
 *   Chrome over CDP and write a PNG, and no test here starts a browser — the
 *   repository's rule is that a screenshot is the main session's, serially. So
 *   the ARGUMENT handling, the FREEZE SCRIPT and the WINDOWS-NODE RESOLUTION
 *   are pinned, and the drive loop is not. That is a real gap and it is named
 *   rather than papered over: the evidence that the tool works is the null
 *   control it produced (two shots of one URL, **0 pixels differing and
 *   byte-identical files**), which is recorded in the module header and in the
 *   handoff, not asserted here.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  chromeFlagsFor,
  freezeScript,
  parseArguments,
  resolveWindowsNode,
  windowsNodeCandidates
} from "../tools/shot-live.mjs";

test("the host comes FIRST, because it is the argument the wrapper supplies", () => {
  const options = parseArguments(["172.27.81.183", "shot", "seed=7&enchant=3.2", "1600", "1100", "120"]);
  assert.equal(options.host, "172.27.81.183");
  assert.equal(options.name, "shot");
  assert.equal(options.query, "seed=7&enchant=3.2");
  assert.deepEqual([options.width, options.height, options.freeze], [1600, 1100, 120]);
  assert.equal(options.page, "/tools/arena/index.html", "the arena is the default page, as in tools/shot.sh");
});

test("a page path without a leading slash still addresses the server", () => {
  assert.equal(parseArguments(["h", "n", "", "1", "1", "1", "tools/screens/index.html"]).page,
    "/tools/screens/index.html");
  assert.equal(parseArguments(["h", "n", "", "1", "1", "1", "/tools/screens/index.html"]).page,
    "/tools/screens/index.html");
});

test("too few arguments returns null rather than shooting something unnamed", () => {
  assert.equal(parseArguments([]), null);
  assert.equal(parseArguments(["justAHost"]), null, "a host with no name is not a request");
});

test("the NAME becomes a filename, so it is refused rather than escaped", () => {
  // ► A name reaching `path.join` unchecked is a path traversal in a tool that
  //   writes to a fixed directory. Refused by NAME, so the message says which
  //   argument was wrong rather than failing later at the write.
  for (const bad of ["../escape", "a/b", "a\\b", "with space", "semi;colon", ""]) {
    assert.throws(() => parseArguments(["h", bad]), /Refusing the name/, `"${bad}" must be refused`);
  }
  for (const good of ["ench-on", "frz_t2", "shot.1", "A1"]) {
    assert.equal(parseArguments(["h", good]).name, good);
  }
});

/* ------------------------------------------------------------------ */
/* THE FREEZE, which is the whole reason this tool exists              */
/* ------------------------------------------------------------------ */

/**
 * ► **THE SCRIPT IS EXERCISED, NOT PATTERN-MATCHED.** Asserting that the source
 *   text contains `performance.now` would pass for a script that assigns it and
 *   never uses it. This runs the script against a fake `window` and drives the
 *   callback chain, so the assertions are about BEHAVIOUR — which frame it
 *   stops on, and what the clock reads while it runs.
 */
function runFreeze(at, frames, step) {
  const scheduled = [];
  const win = {
    requestAnimationFrame: (callback) => { scheduled.push(callback); return scheduled.length; }
  };
  const perf = { now: () => { throw new Error("the real performance.now must be replaced"); } };
  const sandbox = { window: win, performance: perf, Date: { now: () => 1_700_000_000_000 } };
  const source = freezeScript(at, step);
  // eslint-disable-next-line no-new-func
  new Function("window", "performance", "Date", source)(sandbox.window, sandbox.performance, sandbox.Date);

  const times = [];
  let body = 0;
  const loop = () => {
    body += 1;
    times.push(sandbox.performance.now());
    sandbox.window.requestAnimationFrame(loop);
  };
  sandbox.window.requestAnimationFrame(loop);
  for (let tick = 0; tick < frames && scheduled.length > 0; tick += 1) scheduled.shift()();
  return { win: sandbox.window, body, times, pending: scheduled.length };
}

test("the loop STOPS at the requested frame, and says so with a separate flag", () => {
  const { win, body, pending } = runFreeze(5, 50);
  assert.equal(win.__frames, 5, "it counted five frames");
  assert.equal(win.__frozen, true);
  assert.equal(body, 4, "and the page's own callback ran for four of them — the fifth is the stop");
  assert.equal(pending, 0, "nothing is left scheduled, so the chain really ended");
});

test("`__frozen` is NOT derivable from `__frames`, which is why it is its own flag", () => {
  // Stopped short: the counter reads 3 and the page is still running. A caller
  // that shot on `__frames >= 3` would photograph a moving scene.
  const { win } = runFreeze(9, 3);
  assert.equal(win.__frames, 3);
  assert.equal(win.__frozen, false, "three frames in, but not frozen");
});

test("THE CLOCK IS A PURE FUNCTION OF THE FRAME NUMBER — the determinism the diff rests on", () => {
  // ► Without this the tool is not an instrument. Measured on the real page:
  //   two shots frozen at frame 120 differed by 9,900 pixels with the clock
  //   left alone and by 2,822 with it pinned, and the blue signal of the frost
  //   glow went from +5.1 to +45.4 — the rest was the weapon having moved.
  // `at: 6` runs the page's callback on frames 1..5 and stops ON the sixth, so
  // there are FIVE timestamps — one per frame the page actually drew.
  const { times } = runFreeze(6, 20, 1000 / 60);
  const round = (value) => Math.round(value * 1000) / 1000;
  assert.deepEqual(times.map(round), [16.667, 33.333, 50, 66.667, 83.333].map(round));
  // And the step is a parameter, so a caller can pin a different frame rate.
  assert.deepEqual(runFreeze(4, 20, 100).times, [100, 200, 300]);
});

test("Date.now advances with the same clock, so a page timing off it agrees with rAF", () => {
  const scheduled = [];
  const win = { requestAnimationFrame: (cb) => { scheduled.push(cb); return scheduled.length; } };
  const box = { window: win, performance: { now: () => 0 }, Date: { now: () => 5000 } };
  // eslint-disable-next-line no-new-func
  new Function("window", "performance", "Date", freezeScript(4, 100))(box.window, box.performance, box.Date);
  const seen = [];
  const loop = () => { seen.push(box.Date.now() - 5000); box.window.requestAnimationFrame(loop); };
  box.window.requestAnimationFrame(loop);
  while (scheduled.length > 0) scheduled.shift()();
  assert.deepEqual(seen, [100, 200, 300], "the epoch is captured once and the offset is the frame clock");
});

test("a freeze of ONE frame stops before the page's callback ever runs", () => {
  const { win, body } = runFreeze(1, 10);
  assert.equal(win.__frozen, true);
  assert.equal(body, 0, "which is a usable request — the page is captured at its very first paint");
});

/* ------------------------------------------------------------------ */
/* Finding the Windows node                                            */
/* ------------------------------------------------------------------ */

test("the Windows node is RESOLVED across runtimes, not pinned to one directory", () => {
  // ► AGENTS.md names `codex-primary-runtime` and warns in the same breath that
  //   the directory moves on update. A hard-coded path is a scheduled failure,
  //   so the candidates are enumerated from the filesystem.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ss2-shotlive-"));
  try {
    assert.deepEqual(windowsNodeCandidates(home), [], "no runtimes directory is an empty list, not a throw");
    assert.equal(resolveWindowsNode(home), null);

    const runtime = path.join(home, ".cache", "codex-runtimes", "codex-secondary-runtime", "dependencies", "node", "bin");
    fs.mkdirSync(runtime, { recursive: true });
    const candidates = windowsNodeCandidates(home);
    assert.equal(candidates.length, 1, "a runtime whose node is missing is still a CANDIDATE, so the error can name it");
    assert.equal(resolveWindowsNode(home), null, "but it does not resolve until the binary exists");

    fs.writeFileSync(path.join(runtime, "node.exe"), "");
    assert.equal(resolveWindowsNode(home), path.join(runtime, "node.exe"),
      "and a runtime that is NOT called `codex-primary-runtime` resolves, which is the point");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ *
 * THE RASTERISER — the one flag that has already been reported as a
 * property of the page, now an argument instead of a constant.
 * ------------------------------------------------------------------ */

test("the rasteriser defaults to cpu, because that is what every number here was measured under", () => {
  // ► **THIS IS A COMPATIBILITY ASSERTION, NOT AN ENDORSEMENT.** Every pixel
  //   count in this repository was taken with `--disable-gpu`, including the
  //   fractional-clip residual. Flipping the default would silently re-base all
  //   of them against a rasteriser none of them were measured on.
  assert.equal(parseArguments(["h", "n"]).rasteriser, "cpu");
  assert.ok(chromeFlagsFor({ width: 1, height: 1, profile: "P", port: 1 }).includes("--disable-gpu"),
    "the default must still pass --disable-gpu or every prior measurement changes meaning");
});

test("`gpu` OMITS --disable-gpu, and that is the entire difference between the two", () => {
  const cpu = chromeFlagsFor({ width: 9, height: 9, profile: "P", port: 3, rasteriser: "cpu" });
  const gpu = chromeFlagsFor({ width: 9, height: 9, profile: "P", port: 3, rasteriser: "gpu" });
  assert.ok(cpu.includes("--disable-gpu"));
  assert.ok(!gpu.includes("--disable-gpu"));
  // ► **THE ASSERTION THAT MAKES THE PAIR A MEASUREMENT.** Two shots differ by
  //   the rasteriser only if NOTHING ELSE about the browser differs, and a
  //   future flag added to one branch and not the other would be invisible to
  //   a test that only checked for `--disable-gpu`.
  assert.deepEqual(cpu.filter((flag) => flag !== "--disable-gpu"), gpu,
    "the two flag lists differ by more than --disable-gpu, so a pair of shots is not a measurement");
});

test("an unknown rasteriser is refused BY NAME rather than falling back to one of them", () => {
  // A typo selecting software rasterisation silently is exactly how the 3.9x
  // frame cost came to be published as a property of the glow.
  assert.throws(() => parseArguments(["h", "n", "", "1", "1", "1", "/p", "GPU"]), /Refusing the rasteriser/);
  assert.throws(() => parseArguments(["h", "n", "", "1", "1", "1", "/p", "software"]), /Refusing the rasteriser/);
});

test("the rasteriser is the EIGHTH argument, so every existing caller is unchanged", () => {
  const before = parseArguments(["172.27.81.183", "shot", "seed=7", "1600", "1100", "120"]);
  assert.deepEqual(
    [before.host, before.name, before.query, before.width, before.height, before.freeze, before.page],
    ["172.27.81.183", "shot", "seed=7", 1600, 1100, 120, "/tools/arena/index.html"]);
});

/* ------------------------------------------------------------------ *
 * THE TWO SHOT TOOLS MUST AGREE ABOUT THE RASTERISER.
 * ------------------------------------------------------------------ */

test("tools/shot.sh is RETIRED, and this tool covers what it did", () => {
  // ► **THIS TEST REPLACED ONE THAT PINNED A CONTRACT BETWEEN THE TWO TOOLS.**
  //   For a session `shot.sh` hardcoded `--disable-gpu` while this one took it as
  //   an argument, so two shots taken with the two tools differed by 15.9% of the
  //   arena frame before anything under test had changed. The contract test was
  //   the right fix for that; retiring the tool is a better one.
  //
  //   `shot.sh`'s only remaining justification was pages this driver could not
  //   shoot — ones that draw once and stop, which never reach a frame number. A
  //   freeze of 0 waits for QUIESCENCE instead, and the two tools' renders of the
  //   same static screen are BYTE-IDENTICAL: 76,983 bytes, 0 differing pixels.
  //   Against that, `shot.sh` leaked a Chrome process per invocation.
  //
  //   The assertion is that it stays gone. A reader who finds the name in an
  //   archived handoff and recreates the file gets a tool with no rasteriser
  //   argument back, and this says so by failing.
  assert.ok(!fs.existsSync(new URL("../tools/shot.sh", import.meta.url)),
    "tools/shot.sh is back. It was retired because shot-live covers it and it leaks a browser per run.");
});

/* ------------------------------------------------------------------ *
 * QUIESCENCE — how a page that draws once and stops is shot.
 * ------------------------------------------------------------------ */

test("a freeze of 0 NEVER stops the page, which is what lets it go quiet", () => {
  const never = freezeScript(0);
  const stops = freezeScript(120);
  assert.match(never, /stopAt > 0/,
    "a freeze of 0 must not stop the loop, or a static page is shot before its packs land");
  assert.match(never, /const stopAt = 0;/);
  assert.match(stops, /const stopAt = 120;/);
  // ► **AND THE VIRTUAL CLOCK IS STILL THERE.** Quiescence gives up the
  //   same-frame guarantee, not determinism: a page animating on elapsed time
  //   must still be a pure function of the frame number, or two quiesced shots
  //   of an animating page are not comparable either.
  for (const script of [never, stops]) {
    assert.match(script, /performance\.now = now/, "the virtual clock is gone");
    assert.match(script, /Date\.now = \(\) => epoch \+ now\(\)/, "Date.now is no longer driven by the frame");
  }
});

test("the freeze is still the SIXTH argument and still defaults to 120", () => {
  // Quiescence is opt-in by 0. Every existing caller asks for a frame and must
  // keep getting one — a default of 0 would silently retire the determinism the
  // arena's two-shot measurements rest on.
  assert.equal(parseArguments(["h", "n"]).freeze, 120);
  assert.equal(parseArguments(["h", "n", "", "1", "1", "0"]).freeze, 0);
});
