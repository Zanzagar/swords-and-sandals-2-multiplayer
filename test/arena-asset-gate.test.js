/**
 * THE ASSET GATE (`tools/arena/asset-gate.js`, 2026-09-24): the arena draws
 * its stage, and anyone acts, only once every VISUAL pack has settled —
 * loaded, 404'd or errored — or the timeout has passed; a pack that arrives
 * after that is not used for the bout.
 *
 * The owner's report it answers: *"the 'old skins' flash for a second before
 * being populated by the real swords and sandals 2 skins."*
 *
 * Pinned here, each by FINDING the case it is about, on a fake clock with
 * loaders the test settles by hand:
 *
 * 1. every pack loads — the gate opens when the LAST one is in, not before;
 * 2. one 404 — the gate opens without it, and its fallback is what is in use;
 * 3. a slow pack — the timeout opens the gate, and the late pack stays unused
 *    even when it arrives;
 * 4. no assets at all (a fresh clone) — the gate opens at once, no wait;
 * 5. the loading frame's words, count and motion;
 * 6. the few lines of `tools/arena/main.js` that wire it in, read as TEXT, as
 *    `test/arena-sound-wiring.test.js` does — node cannot import that file.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  ARENA_ASSET_TIMEOUT_MS,
  ARENA_VISUAL_PACKS,
  PackOutcome,
  assetGateReport,
  assetGateVerdict,
  createAssetGate,
  lateArrivalReport,
  loadingFrameFor
} from "../tools/arena/asset-gate.js";
import { hasExtractedProps, propPackFrom } from "../src/render/props.js";
import { hasExtractedArt } from "../src/render/extracted-figure.js";

const NAMES = ARENA_VISUAL_PACKS.map((pack) => pack.name);

/** A promise the test settles by hand. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** Lets every settled loader's `.then` run. */
const drain = () => new Promise((resolve) => setImmediate(resolve));

/** A gate over all eight packs on a clock the test moves, each loader a `deferred`. */
function gateOnFakeClock(options = {}) {
  const clock = { now: 1000 };
  const loaders = Object.fromEntries(NAMES.map((name) => [name, deferred()]));
  const late = [];
  const gate = createAssetGate({ clock: () => clock.now, onLateArrival: (arrival) => late.push(arrival), ...options });
  for (const name of NAMES) gate.track(name, loaders[name].promise);
  return { clock, loaders, gate, late };
}

/* ------------------------------------------------------------------ */
/* 1. Every pack loads                                                 */
/* ------------------------------------------------------------------ */

test("every pack loads: the gate opens once the LAST is in, and not a pack before", async () => {
  const { clock, loaders, gate } = gateOnFakeClock();
  assert.deepEqual(NAMES, ["figure", "wardrobe", "enchantments", "props", "clipEffects", "text", "icons", "bitmaps"],
    "the eight visual packs; sound is not one of them");

  const closed = gate.status();
  assert.equal(closed.open, false);
  assert.equal(closed.settledCount, 0);
  assert.equal(closed.total, 8);

  // Seven arrive, the clock moves — still closed, and counting.
  for (const name of NAMES.slice(0, 7)) loaders[name].resolve({ pack: name });
  await drain();
  clock.now += 300;
  const seven = gate.status();
  assert.equal(seven.open, false, "seven of eight is not in");
  assert.equal(seven.settledCount, 7);
  assert.deepEqual(seven.waiting, ["bitmaps"]);
  assert.deepEqual(gate.progress(), { settledCount: 7, total: 8, waiting: ["bitmaps"] },
    "the loading frame's count, asked without opening anything");

  loaders.bitmaps.resolve({ pack: "bitmaps" });
  await drain();
  clock.now += 16;
  const opened = gate.status();
  assert.equal(opened.open, true);
  assert.equal(opened.reason, "settled");
  assert.equal(opened.openedAtMs, clock.now);
  assert.equal(opened.elapsedMs, 316);
  for (const name of NAMES) {
    assert.equal(opened.outcomes[name], PackOutcome.LOADED, name);
    assert.deepEqual(opened.inUse[name], { pack: name }, `${name}'s own data is what the stage draws`);
  }
  assert.deepEqual(opened.late, []);
  assert.equal(gate.status(clock.now + 5000), opened, "latched: every later ask is the same answer");

  const [line] = assetGateReport(opened);
  assert.equal(line.warn, false, "a gate that opened on its packs is not a warning");
  assert.match(line.message, /all 8 visual pack\(s\) settled in 0\.32 s \(8 loaded, 0 missing, 0 failed\)/);
});

/* ------------------------------------------------------------------ */
/* 2. One 404                                                           */
/* ------------------------------------------------------------------ */

test("one 404: the gate opens without it, and its fallback is what is in use", async () => {
  const { loaders, gate } = gateOnFakeClock();
  const props = { props: { bullet: { frames: [[]] } }, shapes: {} };
  for (const name of NAMES) {
    if (name === "figure") loaders.figure.resolve(null); // `response.ok ? response.json() : null` on a 404
    else if (name === "props") loaders.props.resolve(props);
    else loaders[name].resolve({ pack: name });
  }
  await drain();
  const opened = gate.status();
  assert.equal(opened.open, true, "a 404 is settled — it is not waited for");
  assert.equal(opened.reason, "settled");
  assert.equal(opened.outcomes.figure, PackOutcome.MISSING);
  assert.equal(opened.inUse.figure, null);
  assert.equal(opened.settledCount, 8);

  // What the painters make of that: `null` is the render modules' own
  // "not extracted", so the authored figure is drawn — and a pack that did
  // arrive is the build's own.
  assert.equal(hasExtractedArt(null), false, "no rig in use: the authored figure");
  assert.equal(hasExtractedProps(propPackFrom(opened.inUse.props)), true, "the props that did arrive are drawn");
  assert.equal(hasExtractedProps(propPackFrom(null)), false, "and a missing props pack is the authored arrow");

  assert.match(assetGateReport(opened)[0].message, /7 loaded, 1 missing, 0 failed/);
});

test("a network or parse error settles the pack as FAILED — waited for no longer, fallback drawn, error said", async () => {
  const { loaders, gate } = gateOnFakeClock();
  for (const name of NAMES) {
    if (name === "text") loaders.text.reject(new SyntaxError("Unexpected token < in JSON at position 0"));
    else loaders[name].resolve(null);
  }
  await drain();
  const opened = gate.status();
  assert.equal(opened.open, true);
  assert.equal(opened.outcomes.text, PackOutcome.FAILED);
  assert.equal(opened.inUse.text, null);
  assert.match(opened.errors.text, /Unexpected token/);
  const lines = assetGateReport(opened);
  assert.ok(lines.some((line) => line.warn && /text failed \(Unexpected token/.test(line.message)),
    "a failure is named with its reason");
});

/* ------------------------------------------------------------------ */
/* 3. A slow pack                                                       */
/* ------------------------------------------------------------------ */

test("a slow pack: the timeout opens the gate, and the late pack is not used for the bout even when it arrives", async () => {
  const { clock, loaders, gate, late } = gateOnFakeClock();
  const started = gate.startedAtMs;
  for (const name of NAMES) if (name !== "bitmaps") loaders[name].resolve({ pack: name });
  await drain();

  assert.equal(ARENA_ASSET_TIMEOUT_MS, 8000, "the authored timeout, named at the code");
  clock.now = started + ARENA_ASSET_TIMEOUT_MS - 1;
  assert.equal(gate.status().open, false, "one millisecond short, it still waits");

  clock.now = started + ARENA_ASSET_TIMEOUT_MS;
  const opened = gate.status();
  assert.equal(opened.open, true);
  assert.equal(opened.reason, "timeout");
  assert.deepEqual(opened.late, ["bitmaps"]);
  assert.equal(opened.outcomes.bitmaps, PackOutcome.LATE);
  assert.equal(opened.inUse.bitmaps, null, "the stage draws without it");
  assert.equal(opened.inUse.figure.pack, "figure", "and with everything that did arrive");

  const [warning] = assetGateReport(opened);
  assert.equal(warning.warn, true);
  assert.match(warning.message, /8\.00 s timeout — the stage draws with 7 of 8/);
  assert.match(warning.message, /LATE, and not used this bout: bitmaps \(the arena's raster walls and crowds\)/);

  // It arrives 1.25 s into the bout: recorded and said, NEVER swapped in.
  clock.now += 1250;
  loaders.bitmaps.resolve({ pack: "bitmaps" });
  await drain();
  const after = gate.status();
  assert.equal(after, opened, "the same latched answer");
  assert.equal(after.inUse.bitmaps, null, "no art swaps mid-bout");
  assert.equal(after.outcomes.bitmaps, PackOutcome.LATE);
  assert.equal(late.length, 1);
  assert.equal(late[0].name, "bitmaps");
  assert.equal(late[0].afterOpenMs, 1250);
  assert.deepEqual(gate.lateArrivals().map((arrival) => arrival.name), ["bitmaps"]);
  assert.match(lateArrivalReport(late[0]).message, /bitmaps arrived 1\.25 s after the gate opened — not used this bout/);
});

test("a pack that settled before the gate was ASKED counts, even past the deadline: nothing was drawn without it", async () => {
  const { clock, loaders, gate } = gateOnFakeClock();
  for (const name of NAMES) if (name !== "icons") loaders[name].resolve({ pack: name });
  await drain();
  // A background tab: no frame asks for ten seconds, and the pack lands at nine.
  clock.now = gate.startedAtMs + 9000;
  loaders.icons.resolve({ pack: "icons" });
  await drain();
  clock.now = gate.startedAtMs + 10000;
  const opened = gate.status();
  assert.equal(opened.reason, "settled", "every pack had answered by the first ask");
  assert.equal(opened.outcomes.icons, PackOutcome.LOADED);
});

test("a pack declared but never wired is WAITED FOR and named late — a forgotten loader cannot shrink the count", () => {
  const clock = { now: 0 };
  const gate = createAssetGate({ clock: () => clock.now });
  for (const name of NAMES) if (name !== "clipEffects") gate.track(name, Promise.resolve(null));
  return drain().then(() => {
    assert.equal(gate.status().open, false, "seven of eight tracked is not all settled");
    assert.equal(gate.progress().total, 8);
    clock.now = ARENA_ASSET_TIMEOUT_MS;
    assert.deepEqual(gate.status().late, ["clipEffects"]);
  });
});

test("wiring mistakes throw: an unknown pack, a pack tracked twice, a gate with no clock", () => {
  const gate = createAssetGate({ clock: () => 0 });
  assert.throws(() => gate.track("sound", Promise.resolve(null)), /waits for no pack called "sound"/,
    "sound is not a visual pack and must not hold the stage");
  gate.track("props", Promise.resolve(null));
  assert.throws(() => gate.track("props", Promise.resolve(null)), /already tracking "props"/);
  assert.throws(() => createAssetGate({}), /needs a clock/);
});

/* ------------------------------------------------------------------ */
/* 4. No assets at all                                                  */
/* ------------------------------------------------------------------ */

test("no assets at all — a fresh clone: every pack 404s and the gate opens AT ONCE, with no wait", async () => {
  const clock = { now: 5000 };
  const gate = createAssetGate({ clock: () => clock.now });
  for (const name of NAMES) gate.track(name, Promise.resolve(null));
  await drain();
  const opened = gate.status(); // the clock has not moved at all
  assert.equal(opened.open, true);
  assert.equal(opened.reason, "settled", "opened by the answers, not by the timeout");
  assert.equal(opened.elapsedMs, 0);
  for (const name of NAMES) {
    assert.equal(opened.outcomes[name], PackOutcome.MISSING, name);
    assert.equal(opened.inUse[name], null, name);
  }
  assert.match(assetGateReport(opened)[0].message, /settled in 0\.00 s \(0 loaded, 8 missing, 0 failed\)/);
});

test("the rule itself: open when all settled or at the deadline; a clock that is not a number never times out", () => {
  const settled = new Map([["a", {}]]);
  const base = { names: ["a", "b"], settled, startedAtMs: 100, timeoutMs: 50 };
  assert.deepEqual(
    { ...assetGateVerdict({ ...base, nowMs: 149 }) },
    { open: false, reason: null, settledCount: 1, total: 2, waiting: ["b"], elapsedMs: 49 }
  );
  assert.equal(assetGateVerdict({ ...base, nowMs: 150 }).reason, "timeout");
  assert.equal(assetGateVerdict({ ...base, nowMs: Number.NaN }).open, false);
  assert.equal(assetGateVerdict({ ...base, names: ["a"], nowMs: Number.NaN }).reason, "settled",
    "but all settled is open whatever the clock says");
});

/* ------------------------------------------------------------------ */
/* 5. The loading frame                                                 */
/* ------------------------------------------------------------------ */

test("the loading frame: its words, the count, the bar — and nothing moves under reduced motion", () => {
  const shown = loadingFrameFor({ settledCount: 4, total: 8 }, { elapsedMs: 0 });
  assert.equal(shown.title, "Loading your arena…");
  assert.equal(shown.count, "4 of 8");
  assert.equal(shown.progress, 0.5);

  // The one thing that moves is the empty track's breath...
  const alphas = [0, 400, 800, 1200].map((elapsedMs) => loadingFrameFor({ settledCount: 4, total: 8 }, { elapsedMs }).trackAlpha);
  assert.ok(new Set(alphas).size > 1, "it breathes when motion is allowed");
  for (const alpha of alphas) assert.ok(alpha >= 0.25 && alpha <= 0.45);
  // ...and under prefers-reduced-motion it does not.
  const still = [0, 400, 800, 1200, 99_999].map((elapsedMs) =>
    loadingFrameFor({ settledCount: 4, total: 8 }, { elapsedMs, reducedMotion: true }).trackAlpha);
  assert.equal(new Set(still).size, 1, "constant under reduced motion");

  assert.equal(loadingFrameFor({ settledCount: 9, total: 8 }).count, "8 of 8", "never more than the total");
  assert.equal(loadingFrameFor({ settledCount: 0, total: 0 }).progress, 1, "nothing to wait for is full");
});

/* ------------------------------------------------------------------ */
/* 6. The wiring in tools/arena/main.js                                 */
/* ------------------------------------------------------------------ */

/** Comments out, strings blanked, so a word in prose cannot match. */
function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
}

function functionBody(code, name) {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is not defined in tools/arena/main.js`);
  let depth = 0;
  for (let index = code.indexOf("{", start); index < code.length; index += 1) {
    if (code[index] === "{") depth += 1;
    else if (code[index] === "}") { depth -= 1; if (depth === 0) return code.slice(start, index + 1); }
  }
  throw new Error(`${name}'s braces do not balance`);
}

const RAW = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
const CODE = codeOnly(RAW);

test("main.js hands every visual pack to the gate exactly once, and applies each only through `useArenaPacks`", () => {
  for (const name of NAMES) {
    assert.equal(RAW.split(`assetGate.track("${name}", `).length - 1 + RAW.split(`assetGate.track("${name}",\n`).length - 1, 1,
      `${name} is tracked exactly once`);
    assert.equal(RAW.split(`["${name}", `).length - 1, 1, `${name} has one user in PACK_USERS`);
  }
  // No pack variable is filled from a fetch's own `.then` any more: that is the flash.
  for (const variable of ["propPack", "textPack", "clipEffects", "figurePack", "wardrobe", "enchantments", "facePack", "popupPack"]) {
    assert.doesNotMatch(CODE, new RegExp(`\\.then\\(\\([^)]*\\) => \\{?\\s*${variable} = `), `${variable} is not set in a fetch's then`);
  }
  // An image entering the cache as it loads is the same flash, one layer down.
  assert.equal((functionBody(CODE, "loadBitmaps").match(/bitmapCache/g) ?? []).length, 0,
    "loadBitmaps builds its own set; only `useBitmaps` copies it in, at the gate");
  assert.equal((CODE.match(/bitmapCache\.set\(/g) ?? []).length, 1, "one writer: useBitmaps");
  assert.match(functionBody(CODE, "useBitmaps"), /bitmapCache\.set\(id, image\)/);
  // Sound stays OUT of the gate: its manifest is fetched as it always was.
  assert.equal(RAW.split('fetch("/assets/sound/manifest.json")').length - 1, 1);
  assert.equal((RAW.match(/assetGate\.track\("sound/g) ?? []).length, 0);

  const use = functionBody(CODE, "useArenaPacks");
  assert.match(use, /if \(outcome !== PackOutcome\.LOADED && outcome !== PackOutcome\.MISSING\) continue;/,
    "a late or failed pack is skipped whole");
  assert.match(use, /try \{\s*use\(opened\.inUse\[name\]\);\s*\} catch/, "one pack's throw costs that pack only");
});

test("main.js: the gate comes FIRST in the frame, the stage is guarded in `render`, and no button exists before it opens", () => {
  const frame = functionBody(CODE, "frame");
  assert.match(frame, /if \(!assetGateOpen && !openArena\(now\)\) \{\s*render\(now\);\s*return;\s*\}\s*drainFinishedAnimations\(now\);/,
    "nothing steps — no animation, no arena sound, no AI seat — until the gate is open");
  assert.ok(frame.indexOf("openArena(now)") < frame.indexOf("aiTurnStep()"));

  const render = functionBody(CODE, "render");
  assert.match(render, /^function render\(now = performance\.now\(\)\) \{\s*if \(!assetGateOpen\) \{\s*paintLoadingFrame\(now\);\s*return;\s*\}/,
    "the first thing `render` does: the loading frame, whoever called — the loop or a resize");

  const loading = functionBody(CODE, "paintLoadingFrame");
  assert.match(loading, /loadingFrameFor\(assetGate\.progress\(\), \{/, "counted without opening the gate");
  assert.match(loading, /reducedMotion: Boolean\(reducedMotionQuery\?\.matches\)/);
  // Templates are blanked in CODE; this one line is read from the raw body.
  const fonts = functionBody(RAW, "paintLoadingFrame").match(/context\.font = `[^`]*`/g) ?? [];
  assert.equal(fonts.length, 2);
  for (const font of fonts) assert.match(font, /\$\{look\.font\}`$/, "the page's font, never the game's");
  for (const stage of ["drawArenaBowl", "renderStage", "paintFigure", "drawOps", "textPack"]) {
    assert.equal(loading.includes(stage), false, `the loading frame draws nothing of the stage (${stage})`);
  }
  assert.match(RAW, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);

  const controls = functionBody(CODE, "renderControls");
  assert.ok(controls.indexOf("if (!assetGateOpen)") >= 0
    && controls.indexOf("if (!assetGateOpen)") < controls.indexOf("host.legalActions()"),
  "no button is built while the gate is shut");

  const open = functionBody(CODE, "openArena");
  assert.match(open, /const verdict = assetGate\.status\(now\);/);
  assert.match(open, /if \(!verdict\.open\) return false;\s*assetGateOpen = true;\s*useArenaPacks\(verdict\);/);
  assert.match(open, /boutStartedAt = now;/, "the crowd's clock starts when the arena appears");
  assert.match(CODE, /let boutStartedAt = null;/);
});
