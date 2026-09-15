/**
 * The decisions the browser shell was making where no test could see them.
 *
 * ► **`tools/arena/main.js` has given up FIVE live defects in one day and the
 *   suite could not reach any of them.** It is a browser module — absolute URL
 *   imports, `document`, `Audio`, `requestAnimationFrame` — so node cannot load
 *   it at all. These are the two decisions that were logic rather than drawing,
 *   moved somewhere a test can hold them, plus the provenance sentence that
 *   lied for a commit.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { arrowTrailOpsFor, propFrameCount, propInvoiceFor, propOpsFor, propPackFrom } from "../src/render/props.js";
import { arenaScreenLayersFor, SS2_ARENA_DRESSING } from "../src/render/arena-backdrop.js";
import { projectileDrawAt, projectileFlight, SS2_PROJECTILE } from "../src/render/projectile.js";
import { applyColourTransform, applyColourTransformAlpha, colourTransformFrom } from "../src/render/filters.js";
import {
  ArenaShellError,
  figureProvenance,
  perSideFrom,
  rankOfDepth,
  rankStrideFrom,
  retireVoices,
  rosterOrderOf,
  selectRules,
  viewportFor
} from "../src/render/arena-shell.js";

const params = (query) => new URLSearchParams(query);

test("a MISSING ?rank is the shipped default; ?rank=0 is the flat game", () => {
  // ► The defect: `Number(params.get("rank")) || 0` made both 0, and 0 then
  //   selected the singleton — which IS the shipped 97 rule set. Asking for the
  //   one-dimensional game handed back the second axis.
  assert.equal(rankStrideFrom(params(""), 97), 97, "absent means the shipped default");
  assert.equal(rankStrideFrom(params("rank=0"), 97), 0, "explicit zero means FLAT");
  assert.equal(rankStrideFrom(params("rank=150"), 97), 150);
  assert.equal(rankStrideFrom(params("teams=3"), 97), 97, "another param is still absent");
});

test("a nonsense ?rank is the flat game, not a crash — it is a URL, not a config file", () => {
  assert.equal(rankStrideFrom(params("rank=banana"), 97), 0);
  assert.equal(rankStrideFrom(params("rank=-5"), 97), 0);
  assert.equal(rankStrideFrom(params("rank="), 97), 0);
  assert.equal(rankStrideFrom(null, 97), 97);
});

test("the SINGLETON is selected by the shipped value, never by zero", () => {
  // ► The same line was fixed in `tools/engagement-census.mjs` on 2026-09-12 and
  //   survived here until 2026-09-13, because nothing could test this file.
  //   The singleton is `createSs2TeamRules()` and carries whatever the default
  //   is, so comparing against 0 is correct only while the default IS 0.
  const singleton = { id: "the-shipped-one" };
  const create = ({ rankStride }) => ({ id: `fresh-${rankStride}` });

  assert.equal(selectRules(97, { shippedStride: 97, singleton, create }), singleton);
  assert.equal(selectRules(0, { shippedStride: 97, singleton, create }).id, "fresh-0",
    "zero must NOT resolve to the shipped rule set");
  assert.equal(selectRules(150, { shippedStride: 97, singleton, create }).id, "fresh-150");

  // And the historic case: when the default WAS zero, zero is the singleton.
  assert.equal(selectRules(0, { shippedStride: 0, singleton, create }), singleton);
  assert.throws(() => selectRules(0, { shippedStride: 0, singleton }), ArenaShellError);
});

test("finished voices are reclaimed before a live one is ever stopped", () => {
  // Stopping a playing sound to make room is audible; reclaiming a dead one is
  // not. So the dead go first, always.
  const dead = { ended: true };
  const paused = { paused: true };
  const live = [{}, {}, {}];
  const { keep, evict } = retireVoices([dead, live[0], paused, live[1]], 8);
  assert.deepEqual(keep, [live[0], live[1]]);
  assert.deepEqual(evict, [], "under the cap nothing live is stopped");
});

test("at the cap the OLDEST live voice is evicted, because the caller is about to add one", () => {
  const a = {}; const b = {}; const c = {};
  const { keep, evict } = retireVoices([a, b, c], 3);
  assert.deepEqual(evict, [a], "one slot is freed for the incoming voice");
  assert.deepEqual(keep, [b, c]);
  assert.equal(keep.length, 2, "so that keep.length + 1 === cap");
});

test("a cap of one keeps nothing, which is the OLD behaviour and is why sound was cut off", () => {
  // ► One `Audio` element per file WAS a cap of one, and the owner heard it:
  //   "sounds get cut off and dont play out". The build shares files across
  //   labels — `706.mp3` serves five — so the collisions were constant.
  const a = {}; const b = {};
  const { keep, evict } = retireVoices([a, b], 1);
  assert.deepEqual(keep, []);
  assert.deepEqual(evict, [a, b]);
});

test("retireVoices is total, because a malformed voice list must not stop the arena", () => {
  assert.deepEqual(retireVoices(null, 4), { keep: [], evict: [] });
  assert.deepEqual(retireVoices([], 4), { keep: [], evict: [] });
  assert.deepEqual(retireVoices([null, undefined], 4).keep, [], "a null voice counts as finished");
  const live = {};
  assert.deepEqual(retireVoices([live], 0).evict, [live], "a nonsense cap floors at one");
});

test("the provenance line is DERIVED, because it claimed authored art over the extracted rig", () => {
  const authored = figureProvenance({ hasExtractedArt: false });
  assert.match(authored, /original vector art/);
  assert.match(authored, /No SS2 asset ships/);
  assert.match(authored, /extract-figure/, "and it says how to change that");

  const naked = figureProvenance({ hasExtractedArt: true, wardrobePieces: 0 });
  assert.match(naked, /BUILD'S OWN/);
  assert.match(naked, /undressed/);
  assert.match(naked, /extract-wardrobe/);

  const dressed = figureProvenance({ hasExtractedArt: true, wardrobePieces: 387 });
  assert.match(dressed, /BUILD'S OWN/);
  assert.match(dressed, /387 extracted wardrobe piece/);
  // Whatever it says, it must never stop saying the repo ships nothing.
  for (const line of [authored, naked, dressed]) assert.match(line, /No SS2 asset ships in this repository/);
});

/* ------------------------------------------------------------------ */
/* Four more decisions, every one of which has had a LIVE defect        */
/* ------------------------------------------------------------------ */

test("?teams clamps to 1..3 rather than throwing or stacking gladiators", () => {
  assert.equal(perSideFrom(params("")), 2, "the default is a duel's worth");
  assert.equal(perSideFrom(params("teams=1")), 1);
  assert.equal(perSideFrom(params("teams=3")), 3);
  assert.equal(perSideFrom(params("teams=99")), 3, "a big number is a 3v3, not an exception");
  // ► These three pin what the shell's `|| 2` ACTUALLY did, which is not what
  //   it looks like it did: `Number(null)` and `Number("0")` are both 0, so
  //   absent and zero take the fallback, while a negative is truthy and clamps.
  assert.equal(perSideFrom(params("teams=0")), 2, "zero is falsy, so it takes the fallback");
  assert.equal(perSideFrom(params("teams=-4")), 1, "but a negative is truthy and clamps to 1");
  assert.equal(perSideFrom(params("teams=banana")), 2);
  assert.equal(perSideFrom(null), 2);
  // The one deliberate difference from the shell expression this replaced: it
  // returned 2.7 here and handed a fractional team size to the roster builder.
  assert.equal(perSideFrom(params("teams=2.7")), 2, "a fractional roster is not a roster");
});

test("the perspective rank is FRACTIONAL and comes from the drawn y, not the slot", () => {
  // ► Taking `slotIndex` keeps a figure at its starting size for the whole lane
  //   change, which leaves a pure vertical translation — and in this game that
  //   is what a JUMP looks like. The owner reported exactly that.
  const arena = { frontY: 200, rankStride: 97 };
  assert.equal(rankOfDepth(200, 0, arena), 0, "the front rank is rank 0");
  assert.equal(rankOfDepth(103, 1, arena), 1);
  assert.equal(rankOfDepth(151.5, 0, arena), 0.5, "mid-slide is BETWEEN ranks");
  assert.equal(rankOfDepth(300, 0, arena), 0, "in front of the front rank clamps at 0");
  // No depth at all, or the axis off: fall back to the slot.
  assert.equal(rankOfDepth(null, 2, arena), 2);
  assert.equal(rankOfDepth(103, 2, { frontY: 200, rankStride: 0 }), 2);
});

test("the viewport fits the DEPTH as well as the width, or the horizon leaves the canvas", () => {
  // ► At stride 150 the solved horizon came out at -191 on an 800px canvas: no
  //   crowd, no barrier, the whole view sand. Found by screenshotting.
  const flat = viewportFor({
    width: 1280, height: 800, frontY: 200,
    actors: [{ x: -250, y: 200, placed: true }, { x: 250, y: 200, placed: true }]
  });
  assert.equal(flat.depthUnits, 0);
  assert.ok(flat.horizon > 0 && flat.horizon < 800, "a flat roster gives an on-canvas horizon");
  assert.equal(Math.round(flat.horizon), Math.round(800 * 0.58), "and with no depth it is exactly the old value");

  const deep = viewportFor({
    width: 1280, height: 800, frontY: 200,
    actors: [{ x: -250, y: 200, placed: true }, { x: 250, y: -100, placed: true }]
  });
  assert.equal(deep.depthUnits, 300);
  assert.ok(deep.horizon >= 800 * 0.18, "the horizon never leaves the canvas");
  assert.ok(deep.scale < flat.scale, "a deeper roster must draw smaller to fit");
});

test("the viewport's extent scan reads y as well as x, or the back rank stands in the crowd", () => {
  // ► The scan read `Math.abs(actor.x)` and nothing else, which was complete
  //   while every gladiator stood on one line.
  const seen = viewportFor({
    width: 1280, height: 800, frontY: 200,
    actors: [{ x: 100, y: 6, placed: true }, { x: -100, y: 200, placed: true }]
  });
  assert.equal(seen.depthUnits, 194, "the rearmost y is what sets the depth");

  // An UNPLACED actor is not on stage and must not widen the view.
  const ignored = viewportFor({
    width: 1280, height: 800, frontY: 200,
    actors: [{ x: 2000, y: -900, placed: false }, { x: 100, y: 200, placed: true }]
  });
  assert.equal(ignored.depthUnits, 0);
  assert.equal(ignored.extent, 250, "and the minimum extent still holds the view open");
});

test("the ROSTER panel is heroes-then-slot, not the painter's back-to-front order", () => {
  // ► It borrowed the scene's `drawOrder`, which is PAINT order — back rank
  //   first, both sides interleaved. A reader's list and a painter's list are
  //   different questions; sharing one answer was the defect.
  const placement = {
    "blue-2": { side: "villain", slotIndex: 1 },
    "red-0": { side: "hero", slotIndex: 0 },
    "blue-0": { side: "villain", slotIndex: 0 },
    "red-2": { side: "hero", slotIndex: 2 }
  };
  const paintOrder = ["blue-2", "red-2", "blue-0", "red-0"];
  assert.deepEqual(
    rosterOrderOf(paintOrder, (id) => placement[id]),
    ["red-0", "red-2", "blue-0", "blue-2"]
  );
  assert.deepEqual(rosterOrderOf([], () => ({})), []);
  assert.deepEqual(rosterOrderOf(null, () => ({})), []);
});

/* ------------------------------------------------------------------ */
/* The colour transform this shell used to compose, and no longer does  */
/* ------------------------------------------------------------------ */

/**
 * ► **`tools/arena/main.js` COMPOSED THE PLACEMENT'S COLOUR TRANSFORM UNTIL
 *   2026-09-14, AND NOTHING COULD TEST IT.** `propOpsFor` in
 *   `src/render/props.js` now folds it in, so the shell's copy —
 *   `tintedPropOpsFor`, `probeColourTransform`, `firstTintedPlacement`,
 *   `onePlacementPack`, `colourTransformMode`, `colourTransformTally` — is
 *   deleted, and these are the tests that did not exist when it was written.
 *
 * ► **TWO SURFACES, BECAUSE NEITHER ALONE IS THE CHECK.** Node cannot import
 *   `main.js` at all — absolute URL specifiers, `document`, `Audio`,
 *   `requestAnimationFrame` at module scope — so the VALUE of a double
 *   application is measured through the injected-reader seam the shell uses,
 *   and the fact that THIS shell no longer wraps that seam is read off the
 *   source text. A value test alone would stay green with the shim back; a
 *   source test alone would never say what the wrong picture looks like.
 */

/**
 * ► **ONE DERIVATION, BECAUSE AN ANCHOR THAT DERIVES ITS OWN PATH ANCHORS
 *   NOTHING.** These two readers each wrote `new URL("..", import.meta.url)`
 *   out again, and the first draft of the anchor below did too — so breaking
 *   one of the three left the other two correct and the anchor still passed.
 *   Measured 2026-09-14 in a scratch copy: with the props path broken by one
 *   segment and a self-deriving anchor, the run was 21 pass / 0 fail, exactly
 *   the green it was supposed to make impossible. Sharing the root is what
 *   gives the anchor its teeth.
 */
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The shell's source, or null — it is a tracked file, so null is a failure. */
function readShellSource() {
  const at = path.join(REPO_ROOT, "tools/arena/main.js");
  return fs.existsSync(at) ? fs.readFileSync(at, "utf8") : null;
}

/** The player's own extracted props, or null on a clone with no licensed copy. */
function readRealProps() {
  const at = path.join(REPO_ROOT, "assets/props/props.json");
  return fs.existsSync(at) ? propPackFrom(JSON.parse(fs.readFileSync(at, "utf8"))) : null;
}

const REAL_PROPS = readRealProps();

/**
 * ► **`fs.existsSync` IS NOT A GUARD ON ITS OWN — IT IS A WAY OF PASSING, and
 *   this file had three of them.** Every real-pack test below opens with
 *   `if (!REAL_PROPS) { ...; return; }`, and until 2026-09-14 the only thing
 *   behind that `!` was `fs.existsSync` on a path derived from
 *   `import.meta.url`. A wave-1 verifier broke the derivation by one segment in
 *   a scratch copy and the run was byte-identical to a green one: the bar's
 *   four operations, the 15-of-17 dead-weight sweep and the whole invoice
 *   roll-up evaporated, and **no counter moved** — not even the skip count,
 *   because these tests assert rather than skip.
 *
 *   So the ABSENCE is anchored on something TRACKED. `tools/arena/main.js` is
 *   the file this whole suite is about and it is committed; if the repo root
 *   cannot reach it then the root is wrong, and this fails BY NAME instead of
 *   letting a broken derivation wear a fresh clone's clothes. Same anchor
 *   `test/render-props.test.js` and `test/extract-props.test.js` use, and the
 *   same rule `AGENTS.md` states for the raw-trace archive check.
 *
 *   `readShellSource()` above has always anchored (`assert.ok(source, ...)`)
 *   and `readRealProps` never did — in the SAME file, eight lines apart, which
 *   is how a rule this project already knows gets broken next to a line
 *   obeying it.
 */
function assertRealPackPathIsDerivable() {
  const anchor = path.join(REPO_ROOT, "tools/arena/main.js");
  assert.ok(fs.existsSync(anchor),
    `${anchor} is not there, so the repo root is wrong and "no extraction on this machine" below ` +
    "would be a broken path derivation reading as a fresh clone");
}

/**
 * `source` with comments removed, so a test can ask what the shell DOES rather
 * than what it says about itself.
 *
 * ► **THE COMMENT ABOVE THE DELETED SHIM NAMES EVERY IDENTIFIER THAT WENT**, on
 *   purpose — this codebase records its own mistakes at the point it made them
 *   — so a grep over the raw file finds `tintedPropOpsFor` and `probeColour`
 *   forever and can never go red. Stripping first is what makes the absence
 *   mean something.
 *
 * ► **A LEXER, NOT A PARSER, AND IT SAYS SO BY COUNTING.** It tracks line
 *   comments, block comments and the three string quotes; it does NOT
 *   understand regexp literals, and a `/` beginning one followed by `/` or `*`
 *   would be read as a comment. `main.js` carries no regexp literal today (the
 *   callers below assert the strip stayed sane rather than trusting that), and
 *   the returned `removed` and `mode` are what a silently degraded run would
 *   have to lie about: a stripper that returned the empty string would make
 *   every absence assertion below pass vacuously, which is the exact defect
 *   `ss2-assertion-quality.test.js` exists over.
 */
function codeOnly(source) {
  let out = "";
  let removed = 0;
  let index = 0;
  let mode = "code";
  let quote = "";
  while (index < source.length) {
    const two = source.slice(index, index + 2);
    if (mode === "code") {
      if (two === "//") { mode = "line"; index += 2; removed += 2; continue; }
      if (two === "/*") { mode = "block"; index += 2; removed += 2; continue; }
      if (source[index] === "\"" || source[index] === "'" || source[index] === "`") {
        quote = source[index];
        mode = "string";
      }
      out += source[index];
      index += 1;
      continue;
    }
    if (mode === "string") {
      if (source[index] === "\\") { out += source.slice(index, index + 2); index += 2; continue; }
      out += source[index];
      if (source[index] === quote) mode = "code";
      index += 1;
      continue;
    }
    if (mode === "line") {
      if (source[index] === "\n") { mode = "code"; out += "\n"; index += 1; continue; }
      removed += 1;
      index += 1;
      continue;
    }
    if (two === "*/") { mode = "code"; index += 2; removed += 2; continue; }
    if (source[index] === "\n") out += "\n"; else removed += 1;
    index += 1;
  }
  return { code: out, removed, mode };
}

/** Occurrences of `needle` in `haystack`. */
function countOf(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/**
 * THE SHIM, REBUILT HERE EXACTLY AS IT WAS, so the tests below can say what the
 * wrong picture looks like instead of only asserting the right one.
 *
 * It wraps `propOpsFor` and re-applies each placement's transform to what comes
 * back — which is a DOUBLE application now that `props.js` applies it once. It
 * is deliberately the deleted code and not a paraphrase of it: a hand-rolled
 * "squarer" would prove a squarer is visible, not that the thing that was in
 * the tree was.
 */
function doubleApplyingReader(pack, options) {
  const ops = propOpsFor(pack, options);
  if (!ops) return ops;
  const frames = pack?.props?.[options?.linkage]?.frames;
  if (!Array.isArray(frames) || frames.length === 0) return ops;
  const wanted = Number.isFinite(options?.frame) ? Math.trunc(options.frame) : 1;
  const placements = frames[Math.min(frames.length, Math.max(1, wanted)) - 1] ?? [];
  const out = [];
  let at = 0;
  for (const placement of placements) {
    const shape = pack.shapes?.[placement.shape];
    if (!shape || !Array.isArray(shape.paths)) continue;
    const transform = colourTransformFrom(placement.colour ?? null);
    for (let index = 0; index < shape.paths.length; index += 1) {
      const operation = ops[at];
      at += 1;
      if (!transform || !operation) { out.push(operation); continue; }
      out.push(Object.freeze({
        ...operation,
        fill: applyColourTransform(operation.fill, transform),
        fillOpacity: applyColourTransformAlpha(operation.fillOpacity ?? 1, transform),
        stroke: applyColourTransform(operation.stroke, transform),
        strokeOpacity: applyColourTransformAlpha(operation.strokeOpacity ?? 1, transform)
      }));
    }
  }
  return Object.freeze(out);
}

test("the UI BAR the shell paints is the transform applied ONCE, and twice is a quarter-alpha bar", () => {
  // ► **THE BAR IS FOUR PLACEMENTS OF ONE WHITE RECTANGLE (shape 487).** The
  //   plate is `rgb x0, alpha x0.5`, the rule is identity, and the two button
  //   plates are `alpha x0` — the build's own invisible hit targets. Drop the
  //   transform and all four draw as opaque white, which is the blank strip
  //   that started this. Apply it twice and the plate halves again.
  if (!REAL_PROPS) {
    // Asserted rather than skipped, so the suite's skip count stays meaningful.
    assertRealPackPathIsDerivable();
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  const layers = arenaScreenLayersFor(REAL_PROPS, propOpsFor, null, SS2_ARENA_DRESSING);
  const panel = layers.find((layer) => layer.prop === "panel");
  assert.ok(panel, "the pack holds the bar");
  assert.deepEqual(
    panel.ops.map((op) => `${op.fill}@${op.fillOpacity}`),
    ["#000000@0.5", "#ffffff@1", "#ffffff@0", "#ffffff@0"],
    "plate, rule, and two invisible hit plates"
  );

  // ► **AND THE PLATE'S COLOUR CANNOT SEE THE DIFFERENCE, WHICH IS THE POINT OF
  //   ASSERTING THE ALPHA.** Its multipliers are 0, and 0 x 0 is 0, so the hex
  //   is `#000000` under one application and under two. A test that pinned the
  //   bar's colour would have watched the squaring happen and stayed green —
  //   the same shape as the digest over 26 screens that could not see a deleted
  //   gradient transform because every stop sat under an alpha-only one.
  const doubled = arenaScreenLayersFor(REAL_PROPS, doubleApplyingReader, null, SS2_ARENA_DRESSING);
  const doubledPanel = doubled.find((layer) => layer.prop === "panel");
  assert.deepEqual(
    doubledPanel.ops.map((op) => `${op.fill}@${op.fillOpacity}`),
    ["#000000@0.25", "#ffffff@1", "#ffffff@0", "#ffffff@0"],
    "a second application quarters the plate and leaves its colour alone"
  );
  assert.equal(doubledPanel.ops[0].fill, panel.ops[0].fill, "the FILL is identical either way");
  assert.notEqual(doubledPanel.ops[0].fillOpacity, panel.ops[0].fillOpacity, "only the alpha moves");
});

test("only 2 of the arena screen's 17 operations can see a second application at all", () => {
  // ► **WHAT THIS EVIDENCE COULD HAVE VARIED OVER, STATED.** At the shipped
  //   dressing the six layers come to 17 operations and only two of them move
  //   under a double application: the bar plate's alpha, and one `sky` fill.
  //   Everything else — the backdrop, the sand, all eight crowd operations, the
  //   border, the sky's second operation — is under an identity transform and
  //   is byte-identical whatever the shell does. **So a digest over the arena
  //   screen is 15/17 dead weight**, and a sweep that reported "nothing
  //   changed" would have been reporting on data that could not change.
  if (!REAL_PROPS) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  const once = arenaScreenLayersFor(REAL_PROPS, propOpsFor, null, SS2_ARENA_DRESSING);
  const twice = arenaScreenLayersFor(REAL_PROPS, doubleApplyingReader, null, SS2_ARENA_DRESSING);
  assert.deepEqual(
    once.map((layer) => layer.prop),
    ["backdrop", "sky", "sand", "crowd", "panel", "border"],
    "the six layers of the build's own arena screen, in paint order"
  );

  const moved = [];
  let total = 0;
  for (let index = 0; index < once.length; index += 1) {
    const before = once[index].ops;
    const after = twice[index].ops;
    assert.equal(before.length, after.length, `${once[index].prop} emits the same operations either way`);
    for (let op = 0; op < before.length; op += 1) {
      total += 1;
      if (before[op].fill !== after[op].fill) moved.push(`${once[index].prop}.${op}.fill`);
      if (before[op].fillOpacity !== after[op].fillOpacity) moved.push(`${once[index].prop}.${op}.fillOpacity`);
      if (before[op].stroke !== after[op].stroke) moved.push(`${once[index].prop}.${op}.stroke`);
      if (before[op].strokeOpacity !== after[op].strokeOpacity) moved.push(`${once[index].prop}.${op}.strokeOpacity`);
    }
  }
  assert.equal(total, 17, "the arena screen is seventeen draw operations at the shipped dressing");
  assert.deepEqual(moved, ["sky.1.fill", "panel.0.fillOpacity", "panel.0.strokeOpacity"],
    "three fields on two operations are the whole of the evidence a double application leaves");
  // ► **THE FIRST DRAFT OF THIS TEST EXPECTED `sky.0.fill` AND NO STROKE AT
  //   ALL, AND WAS WRONG TWICE.** The sky operation that moves is the flat one
  //   at index 1, not the gradient at index 0, and the bar plate's
  //   `strokeOpacity` moves as well as its fill opacity — it carries a null
  //   stroke at 0.5, so the alpha halves there too even though nothing is
  //   drawn with it. Both were found by running the test, which is the only
  //   reason they are right now.
  assert.equal(new Set(moved.map((name) => name.split(".").slice(0, 2).join("."))).size, 2,
    "on TWO of the seventeen operations, so fifteen of them are dead weight in any digest");
});

test("the shell imports NO colour-transform applier, because applying one twice squares it", () => {
  const source = readShellSource();
  assert.ok(source, "tools/arena/main.js is tracked and must be readable");
  const { code, removed, mode } = codeOnly(source);

  // The strip has to have engaged, or every absence below is vacuous. This file
  // is roughly half comment by weight and that is deliberate, so the floor is
  // generous rather than a snapshot of today's ratio.
  assert.equal(mode, "code", "the strip ended outside every comment and string");
  assert.ok(removed > 10000, `the strip removed ${removed} characters of comment`);
  assert.ok(code.length > 10000, `and left ${code.length} characters of code`);
  assert.ok(code.includes("function drawDrops(view, now) {"), "a landmark the stripper must not have eaten");
  assert.ok(code.includes("arenaScreenLayersFor("), "and the seam these tests are about");

  for (const applier of ["applyColourTransform", "applyColourTransformAlpha", "colourTransformApplies"]) {
    assert.equal(countOf(code, applier), 0,
      `${applier} has no call site and no import in the shell — the transform is props.js's`);
  }
  // The shim's own identifiers, which survive in the comment recording their
  // deletion and must survive NOWHERE else.
  //
  // ► **FIVE OF THE SIX DID. `colourTransformMode` survived in NO comment at
  //   all** — checked 2026-09-14 by grepping the shell for each name in turn:
  //   one hit each, except that one, which had zero. `git show HEAD` proves it
  //   was really there (five occurrences) and really went, so the guard was
  //   right; what was missing was the record it was guarding. The shell's
  //   deletion block now names it. A guard over an identifier that appears in
  //   no history and no comment is a guard the next reader cannot check.
  for (const gone of ["tintedPropOpsFor", "probeColourTransform", "firstTintedPlacement",
    "onePlacementPack", "colourTransformMode", "colourTransformTally"]) {
    assert.equal(countOf(code, gone), 0, `${gone} is deleted, not merely unused`);
  }
});

test("the two transform READS that survive in the shell are named, so a third is a finding", () => {
  // ► **ASKING WHAT A PLACEMENT CARRIES IS NOT APPLYING IT**, and the
  //   difference is the whole of what this track was for. `colourTransformFrom`
  //   is still imported for exactly two readers: `soundButtonPlate`, which
  //   finds the bar's invisible hit target by its `alphaMultiplier` of 0 rather
  //   than by index, and `reportArenaEffects`, which counts tinted placements
  //   for the log. Neither changes a pixel. A third occurrence means somebody
  //   started composing again.
  const source = readShellSource();
  assert.ok(source, "tools/arena/main.js is tracked and must be readable");
  const { code } = codeOnly(source);
  const lines = code.split("\n").map((line) => line.trim()).filter((line) => line.includes("colourTransformFrom"));
  assert.deepEqual(lines, [
    "colourTransformFrom,",
    "const transform = colourTransformFrom(placement?.colour ?? null);",
    "if (colourTransformFrom(placement?.colour ?? null)) tinted += 1;"
  ], "the import, the hit-plate finder, and the tinted-placement count");
});

test("the shell hands `propOpsFor` to the backdrop UNWRAPPED, at all three call sites", () => {
  // ► **THE INJECTION SEAM STAYS; ONLY THE SHIM GOES.** `arenaScreenLayersFor`
  //   and `hasArenaScreen` take the props reader as an argument so
  //   `arena-backdrop.js` stays a pure description of the arena with no edge to
  //   the pack format. What changed is WHICH function goes through it.
  const source = readShellSource();
  assert.ok(source, "tools/arena/main.js is tracked and must be readable");
  const { code } = codeOnly(source);
  assert.ok(code.includes("hasArenaScreen(propPack, propOpsFor)"),
    "the memoised availability question");
  assert.ok(code.includes("arenaScreenLayersFor(propPack, propOpsFor, camera, arenaDressing)"),
    "the per-frame backdrop");
  assert.ok(code.includes("propOpsFor(propPack, { linkage: drop.prop, frame: drop.artFrame })"),
    "and the blood and sparks, which went through the shim too");
  // ► **THAT THIRD ONE IS A HOLE IN THIS TEST AND IS NAMED RATHER THAN
  //   COUNTED AS COVERAGE.** `blood` and `sparks` carry 0 tinted placements
  //   between them in this build's pack, so the shim could never have changed a
  //   drop's pixels and no value assertion anywhere can tell the two readers
  //   apart there. The line above is the only evidence that call site is right.
  assert.equal(countOf(code, "propOpsFor"), 4, "one import and exactly three call sites");
});

test("the log panel no longer claims the transform is composed in the shell", () => {
  // ► **A NUMBER THAT DISAPPEARS READS AS A NUMBER THAT WENT TO ZERO.** The
  //   shell used to log how many tinted operations it could not reach —
  //   `bullet_trail`'s 28, every puff of the fade — because a transform
  //   composed out here could not follow `arrowTrailOpsFor` into `props.js`.
  //   That number is gone and the replacement says why: the invoice is
  //   `propInvoiceFor`'s now, printed with its denominators.
  const source = readShellSource();
  assert.ok(source, "tools/arena/main.js is tracked and must be readable");
  const { code } = codeOnly(source);
  assert.doesNotMatch(code, /composed here/i, "the probe's log line is gone with the probe");
  assert.doesNotMatch(code, /out of reach/i, "and so is the unreachable-op count it justified");
  assert.match(code, /tint applied in props\.js/, "the log names where the transform is applied");
  assert.match(code, /invoice\.bitmapOps/, "and prints the dead counters' denominators");
  assert.match(code, /invoice\.gradientOps/);

  // ► **AND THE WARNING THAT COULD NOT TURN ITSELF OFF IS GONE.** `props: NO
  //   filter data in the pack — see extract-props.mjs` fired on every load and
  //   named the wrong culprit: it tested `withFilters`, which counts OWN
  //   filters on a placement, and this build has none to count — its two are
  //   dropped with the edit-text drawables they sit on, and its filters live on
  //   effect GROUPS. Meanwhile `extract-props.mjs` had started writing 363 of
  //   those groups. What is left is a warning about a STALE PACK, which is a
  //   thing the reader can act on.
  assert.doesNotMatch(code, /NO filter data in the pack/,
    "the warning that blamed the extractor for the shape of the build is gone");
  assert.match(code, /effect group\(s\) over \$\{underAGroup\} placement\(s\)/,
    "and the count that actually moves on this build is printed");
  assert.match(code, /if \(groups === 0 && withFilters === 0\)/,
    "with the warning now conditioned on there being no effect data of EITHER kind");
});

test("the arrow trail is indexed by the puff's AGE, and the newest puff is the BRIGHTEST", () => {
  // ► **THE DEFECT WAS LIVE AND THIS FILE COULD NOT SEE IT.** `drawProjectiles`
  //   called `arrowTrailOpsFor(propPack, shot.artFrame)` — the ARROW's lookup,
  //   `secondary_weapon - 60` — into `bullet_trail`, whose seven frames are one
  //   puff's ALPHA FADE over time. It drew solid for as long as the shell
  //   ignored the colour transform; the day `props.js` folded the transform
  //   onto `fillOpacity`, every bow from 66 up started drawing nothing at all.
  //   Node cannot import `main.js`, so the call site is read as TEXT and the
  //   values it produces are computed through the two modules it calls.
  const { code } = codeOnly(readShellSource());
  assert.equal(countOf(code, "arrowTrailOpsFor"), 2, "one import and exactly one call site");
  assert.equal(countOf(code, "arrowTrailOpsFor(propPack, shot.artFrame)"), 0,
    "the weapon's art frame is not an age — that argument is the whole defect");
  assert.ok(code.includes("const puffOps = arrowTrailOpsFor(propPack, drawn.trail.length - 1 - index);"),
    "the age is computed per puff, INSIDE the loop, counting down the array");

  // ► **AND THE AUTHORED RAMP HAS TO BE ON THE FALLBACK SIDE OF THE BRANCH.**
  //   `paintProp` sets `globalAlpha = 1` on entry and `operation.fillOpacity`
  //   per operation, so the ramp set before the branch never reached an
  //   extracted puff — it was dead code that read as a working fade. It is the
  //   authored dot's fade and only the authored dot's.
  assert.equal(countOf(code, "context.globalAlpha = 0.10 + 0.05 * index;"), 1);
  assert.ok(code.indexOf("context.globalAlpha = 0.10 + 0.05 * index;") > code.indexOf("paintProp(puffOps, view"),
    "the ramp is below the extracted branch's `continue`, where nothing overwrites it");

  if (!REAL_PROPS) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }

  // ► **WHICH END OF `drawn.trail` IS THE NEWEST PUFF, MEASURED RATHER THAN
  //   READ.** `projectileTrail` pushes `at = 3, 6, 9 …` ascending and keeps the
  //   last six, so the LAST index is the youngest — and the proof that does not
  //   depend on reading that loop is the geometry: each puff sits closer to the
  //   arrowhead than the one before it. Getting this backwards fades the trail
  //   towards the archer, which looks deliberate and would have survived review.
  const flight = projectileFlight({ kind: "bombard", from: { x: -400, y: 0, height: 60 }, to: { x: 400, y: 0 } });
  const drawn = projectileDrawAt(flight, 0.7,
    { frontY: 0, rankStride: 97, figureScaleFor: () => 1, rankOfDepth: () => 0 });
  const gaps = drawn.trail.map((puff) => Math.abs(puff.x - drawn.x));
  assert.equal(gaps.length, 6, "six puffs at the default keep");
  assert.deepEqual(gaps, [128, 104, 80, 56, 32, 8],
    "index 0 is the OLDEST — 128 units behind the head — and the last is 8 behind it");

  // The fade those ages select, out of the pack the player extracted: monotone
  // up to the newest puff, which is the build's own seven-step ramp read from
  // its end.
  const alphas = drawn.trail.map((unused, index) =>
    arrowTrailOpsFor(REAL_PROPS, drawn.trail.length - 1 - index)[0].fillOpacity);
  assert.deepEqual(alphas,
    [0.1171875, 0.234375, 0.3515625, 0.46484375, 0.58203125, 0.69921875],
    "the build's measured fade, dimmest at the oldest puff");

  // ► **AND THE SIZE OF THE DEFECT, RE-DERIVED RATHER THAN QUOTED — AND THE
  //   FIRST VERSION OF THIS BLOCK RE-DERIVED THE WRONG THING.** It called
  //   `arrowTrailOpsFor(REAL_PROPS, weapon - 60)`, which is the FIXED wrapper
  //   fed the OLD argument: the wrapper now reads its parameter as a 0-based
  //   AGE and maps it to `age + 1`, so bow 66 came back at frame 7 and the
  //   count was 15. **That is a counterfactual — a shot nobody ever fired —
  //   not the shipped defect.** The shipped call passed `artFrame` straight
  //   through as a 1-BASED FRAME, which is `propOpsFor` with
  //   `frame: weapon - 60`, and that is what is reconstructed here. It gives
  //   **14**: bow 66 mapped to frame 6 (alpha 0.1171875, faint but drawn) and
  //   only 67..80 clamped onto the alpha-0 frame 7.
  //
  //   Two numbers for one defect, in a comment that said "RE-DERIVED RATHER
  //   THAN QUOTED", is worse than the quotation would have been — so the route
  //   is spelled out rather than the answer.
  const dark = [];
  for (let weapon = 61; weapon <= 80; weapon += 1) {
    const ops = propOpsFor(REAL_PROPS, { linkage: "bullet_trail", frame: weapon - 60 });
    if (ops.every((op) => (op.fillOpacity ?? 1) === 0)) dark.push(weapon);
  }
  assert.equal(dark.length, 14, "fourteen of the twenty bows drew an invisible trail");
  assert.equal(dark[0], 67, "from bow 67 up, because frame 7 is the alpha-0 one the clamp lands on");
  // The bow that was NOT dark, pinned so "14 vs 15" can never be re-litigated
  // from memory: 66 mapped to the LAST visible step of the ramp.
  assert.equal(
    propOpsFor(REAL_PROPS, { linkage: "bullet_trail", frame: 6 })[0].fillOpacity, 0.1171875,
    "bow 66 drew faint, not invisible — which is the whole difference between 14 and 15");

  // ► **ONE AGE STEP PER PUFF IS A CHOICE, AND THE NUMBER THAT MAKES IT ONE IS
  //   PINNED HERE SO THE CHOICE CANNOT DECAY INTO A CLAIM.** In the build a
  //   puff ages one frame per frame while a new one is attached every THREE, so
  //   the live puffs are 0, 3 and 6 frames old and the trail is TWO visible
  //   puffs. Spending one step per puff spreads the whole ramp across six: a
  //   longer, smoother comet than the build draws, on purpose. If
  //   `trailEveryFrames` were 1 the two would coincide and there would be
  //   nothing to declare.
  assert.equal(SS2_PROJECTILE.trailEveryFrames, 3, "three frames between puffs, one frame per age step");
  const faithful = [0, 3, 6].map((age) => arrowTrailOpsFor(REAL_PROPS, age)[0].fillOpacity);
  assert.deepEqual(faithful, [0.69921875, 0.3515625, 0],
    "what the build shows at any instant: two visible puffs and a dead one");
});

test("the shell's invoice is the UPSTREAM one, summed over the pack the same way", () => {
  // ► **THIS TEST WAS NAMED FOR A ROLL-UP IT NEVER PERFORMED, and a wave-1
  //   verifier proved it: it walked `props.json` directly, pinned three
  //   integers, and stayed green with `tools/arena/main.js` AND
  //   `src/render/props.js` both reverted to HEAD.** The only module it touched
  //   was `filters.js`, which was not in the change-set at all. A test that
  //   cannot see the change it is filed under is worse than no test — it
  //   reports coverage that does not exist — so the roll-up it was named for is
  //   now actually run, and the direct walk is kept as the SECOND opinion it
  //   was always pretending to be.
  //
  // ► **THE CHECK IS THE AGREEMENT, NOT THE THREE NUMBERS.** `propInvoiceFor`
  //   counts while it emits the operations; the walk below counts by reading
  //   `shape.paths.length` off the pack. They are two different code paths over
  //   one artefact, and the earlier version of this file — the one the shell
  //   deleted — is the reason that matters: it kept a SECOND tally that could
  //   silently disagree with the emitter, and `unpairable` fired into a counter
  //   nobody read. Make `propInvoiceFor` miscount and the equality below goes
  //   red without anyone having to know what the right number is.
  //
  // ► **AND THE THREE PINS ARE NOT PRE-WAVE DATA, WHICH WAS WORTH CHECKING
  //   RATHER THAN ASSUMING.** `assets/` is regenerated by hand here and was
  //   deliberately stale while this wave ran, so a pin against it could have
  //   been a pin against the old extractor's output. Measured 2026-09-14 by
  //   regenerating the pack into scratch (`node tools/extract-props.mjs --out
  //   <scratch>`) and running this same arithmetic over both: **3,345 / 2,330 /
  //   8,682 and a byte-identical invoice either way.** The new extractor adds
  //   `effectGroups` and `inheritedEffects`; it moves no placement and no path.
  if (!REAL_PROPS) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }

  // The shell's roll-up, spelled as `reportArenaEffects` spells it: per
  // linkage, per frame, summing whatever keys come back.
  const invoice = {};
  for (const linkage of Object.keys(REAL_PROPS.props)) {
    for (let frame = 1; frame <= propFrameCount(REAL_PROPS, linkage); frame += 1) {
      for (const [key, value] of Object.entries(propInvoiceFor(REAL_PROPS, { linkage, frame }))) {
        invoice[key] = (invoice[key] ?? 0) + value;
      }
    }
  }

  let placements = 0;
  let tinted = 0;
  let ops = 0;
  for (const prop of Object.values(REAL_PROPS.props)) {
    for (const frame of prop.frames ?? []) {
      for (const placement of frame ?? []) {
        placements += 1;
        if (colourTransformFrom(placement.colour ?? null)) tinted += 1;
        const shape = REAL_PROPS.shapes[placement.shape];
        if (Array.isArray(shape?.paths)) ops += shape.paths.length;
      }
    }
  }

  assert.equal(placements, 3345, "every placement in the pack");
  assert.equal(tinted, 2330, "70% of them tinted, which is the sky sweeping through dusk");
  assert.equal(ops, 8682, "and the operations they expand to");

  assert.equal(invoice.placements, placements, "the roll-up sees every placement the walk does");
  assert.equal(invoice.tintedPlacements, tinted, "and agrees which of them carry a transform");
  assert.equal(invoice.ops, ops, "and expands them to the same operations");
  assert.equal(invoice.tintedOps, 7246, "the number the shell prints as the numerator of its first line");

  // ► **THE TWO DENOMINATORS, PINNED BECAUSE THEIR NUMERATORS CANNOT MOVE.**
  //   41 bitmap operations and 1,054 gradient ones, with 0 drops and 0
  //   approximations against them on this build — so the shell's second log
  //   line is `0/41` and `0/1054` and the zeros are quiet, not broken. Pinning
  //   only the zeros would have been the vacuous half of the measurement.
  assert.equal(invoice.bitmapOps, 41);
  assert.equal(invoice.gradientOps, 1054);
  assert.equal(invoice.bitmapColourTransformDropped, 0);
  assert.equal(invoice.gradientAlphaOffsetApproximated, 0);

  // And that the shell really does roll it up this way, since node cannot
  // import the module that does it. The three log lines are pinned by the test
  // above; this is the loop behind them.
  const { code } = codeOnly(readShellSource());
  assert.match(code, /for \(const linkage of Object\.keys\(pack\?\.props \?\? \{\}\)\) \{/,
    "reportArenaEffects sums per linkage");
  assert.match(code, /propInvoiceFor\(pack, \{ linkage, frame \}\)/,
    "out of the upstream invoice, per frame, exactly as above");
});
