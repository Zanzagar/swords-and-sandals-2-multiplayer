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

import {
  arrowTrailOpsFor, propEffectsUnreachable, propFrameCount, propInvoiceFor, propOpsFor, propPackFrom
} from "../src/render/props.js";
import {
  arenaScreenLayersFor, cameraFor, cameraStep, stageFitFor, stageProjectorFor, SS2_ARENA_DRESSING
} from "../src/render/arena-backdrop.js";
import {
  fireballDrawAt, fireballFlight, fireballLifetimeMs, projectileDrawAt, projectileFlight, SS2_PROJECTILE
} from "../src/render/projectile.js";
import { applyColourTransform, applyColourTransformAlpha, colourTransformFrom } from "../src/render/filters.js";
import { figurePackFrom, loadoutFrom, paintExtractedFigure } from "../src/render/extracted-figure.js";
import { figureScaleFor, figureSpecFor } from "../src/render/figure.js";
import { poseAt, timelineFor } from "../src/render/timeline.js";
import { paintFigure, paintShadow } from "../src/render/painter.js";
import { applyCommands, emptyScene } from "../src/render/scene.js";
import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { demoSide } from "../tools/arena/roster.js";
import { SS2_FIGURE_HALF_WIDTH, SS2_FIGURE_HEIGHT } from "../src/common/ss2-figure.js";
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

test("the shell wraps `propOpsFor` for the STAGE SCALE and for nothing else", () => {
  // ► **THE INJECTION SEAM STAYS; ONLY THE SHIM WENT.** `arenaScreenLayersFor`
  //   and `hasArenaScreen` take the props reader as an argument so
  //   `arena-backdrop.js` stays a pure description of the arena with no edge to
  //   the pack format. What changed on 2026-09-14 is WHICH function goes
  //   through it; what changed on 2026-09-15 is that the backdrop's one is
  //   wrapped again — and the whole point of this test is that the new wrapper
  //   is not the old one coming back.
  //
  // ► ~~`assert.ok(code.includes("arenaScreenLayersFor(propPack, propOpsFor,
  //   camera, arenaDressing)"))`~~ **— WHICH WAS A BAN ON WRAPPING AT ALL, AND
  //   THAT IS MORE THAN THE DEFECT EVER JUSTIFIED.** `tintedPropOpsFor` was
  //   wrong because it RE-APPLIED a colour transform `props.js` had already
  //   applied, not because it was a function. `stagePropOpsFor` adds one
  //   option, `scale`, whose only effect is the length in a filter string —
  //   pinned by value in the test below this one, across every linkage and
  //   every frame of the real pack, not by reading the wrapper.
  const source = readShellSource();
  assert.ok(source, "tools/arena/main.js is tracked and must be readable");
  const { code } = codeOnly(source);
  assert.ok(code.includes("hasArenaScreen(propPack, propOpsFor)"),
    "the memoised availability question, which needs no scale and is still unwrapped");
  assert.ok(code.includes("arenaScreenLayersFor(propPack, stagePropOpsFor(fit), camera, arenaDressing)"),
    "the per-frame backdrop, through the scale wrapper");
  assert.ok(code.includes("propOpsFor(propPack, { linkage: drop.prop, frame: drop.artFrame })"),
    "and the blood and sparks, which went through the shim too");
  // ► **THAT THIRD ONE IS A HOLE IN THIS TEST AND IS NAMED RATHER THAN
  //   COUNTED AS COVERAGE.** `blood` and `sparks` carry 0 tinted placements
  //   between them in this build's pack, so the shim could never have changed a
  //   drop's pixels and no value assertion anywhere can tell the two readers
  //   apart there. The line above is the only evidence that call site is right.
  assert.equal(countOf(code, "propOpsFor"), 4,
    "one import, the wrapper's body, the availability question and the drops");

  // THE WRAPPER'S WHOLE BODY, so that a second option — or an applier — cannot
  // be added to it without this going red. It is three lines and they are all
  // of it.
  assert.ok(code.includes(
    "return (pack, options) => propOpsFor(pack, {\n"
    + "    ...options,\n"
    + "    scale: fit.scale * layerScaleOf(options && options.linkage)\n"
    + "  });"
  ), "stagePropOpsFor adds `scale` and touches nothing else");
  assert.equal(countOf(code, "stagePropOpsFor"), 2, "declared once, called once");
});

test("the scale the backdrop is read at moves the FILTER STRING and nothing else", () => {
  // ► **THIS IS THE VALUE HALF OF THE TEST ABOVE, AND WITHOUT IT THE WRAPPER IS
  //   ONLY READ.** `propOpsFor`'s own header says the buckets are
  //   scale-invariant and only the emitted lengths move; that is a claim about
  //   `filters.js`, and this re-derives it over every linkage and every frame
  //   of the pack the player actually extracted rather than quoting it.
  if (!REAL_PROPS) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  const withoutGroup = (ops) => (ops ?? []).map(({ group, ...rest }) => rest);
  let frames = 0;
  let moved = 0;
  let same = 0;
  for (const linkage of Object.keys(REAL_PROPS.props)) {
    for (let frame = 1; frame <= propFrameCount(REAL_PROPS, linkage); frame += 1) {
      frames += 1;
      const plain = propOpsFor(REAL_PROPS, { linkage, frame }) ?? [];
      const scaled = propOpsFor(REAL_PROPS, { linkage, frame, scale: 3.75 }) ?? [];
      assert.deepEqual(withoutGroup(scaled), withoutGroup(plain),
        `${linkage} frame ${frame}: a scale must move no fill, no opacity and no geometry`);
      const seen = new Set();
      for (let index = 0; index < plain.length; index += 1) {
        const before = plain[index].group;
        if (!before || seen.has(before)) continue;
        seen.add(before);
        if (before.filter === scaled[index].group.filter) same += 1; else moved += 1;
      }
    }
  }
  // ► **MOVED 2026-09-22 BY EXACTLY ONE PROP**: `lightning_bolt_combat` joined the pack (2 frames,
  //   3 placements, 20 ops, 2 glow groups of 9 ops, 5 shapes / 39 paths). Control: on the pack as it was
  //   before, every assertion in this file passes unchanged.
  //   **And again the same day by `fireball_combat`** (4 frames, 3 placements, 28 ops, 7 shapes / 61 paths,
  //   NO effect groups; its explosion frames 1-18 are morph shapes the extractor refuses, so only the flight
  //   frame and the last four explosion frames carry geometry). Measured by the same walk.
  //   **And once more when extract-props began baking morphs** (+1 placement, +10 ops, +18 shapes /
  //   +233 paths: the explosion's first 18 frames, which the line above says were refused).
  assert.equal(frames, 312, "every frame of every linkage in the pack" + " — +4 on 2026-09-23 when `boulder_combat` (sprite 33, frames 1/4, with the explosion child 27 on frame 4) joined the pack");
  // ► **BOTH SIDES PINNED, BECAUSE EITHER ONE ALONE IS SATISFIED BY A BUG.**
  //   If the scale were ignored, `moved` would be 0 and every blur would draw
  //   at 1/`fit.scale` of its width; if the buckets were NOT scale-invariant,
  //   the deepEqual above would already have failed.
  //
  // ► **AND THE ~~289~~ 290 THAT DO NOT MOVE ARE TWO POPULATIONS, WHICH IS WORTH MORE
  //   THAN THE TOTAL WAS.** ~~281~~ 282 of them carry no filter string at all — ~~274~~ 275
  //   colour-matrix-only groups whose matrices `props.js` has already folded
  //   into the fills, plus `bullet_trail`'s 7 blend-mode instances. The other
  //   **8 carry a string whose every length is ZERO**:
  //   `drop-shadow(0px 0px 0px rgba(229, 26, 26, 1))` and its neighbours, the
  //   dawn cloud bank at `sky` frames 100-105 and the moon at 124-125, where
  //   the glow's blur has ramped to nothing while its strength has not. Zero
  //   times any scale is zero, so those eight are scale-invariant for a real
  //   reason and not because the option was ignored.
  // The bolt's two glows carry pixel lengths, so they move with the stage too.
  // ► **289 -> 290 and 747 -> 748 on 2026-09-23: `boulder_combat` (sprite 33 + its explosion child 27)
  //   joined the pack.** Its one group instance (frame 4, character 27) is a colourMatrix and nothing
  //   else — `filter: null` at scale 1 and at 3.75 — so it lands in the no-string population and
  //   `moved` does not change. Control: this walk over the pack with `boulder_combat` excluded (which
  //   is deep-equal to the pre-extraction pack) gives 458 / 289 / 747.
  assert.equal(moved, 458, "the filter strings that move with the stage scale");
  assert.equal(same, 290, "and the ones with nothing in them to move — +1 on 2026-09-23: boulder_combat (sprite 33 + its explosion child 27) joined the pack, and its one group is a colourMatrix with no filter string");
  assert.equal(moved + same, 748, "which is every group instance in the pack — +1 on 2026-09-23: boulder_combat (sprite 33 + its explosion child 27) joined the pack");
  const flat = [];
  for (let frame = 100; frame <= 105; frame += 1) {
    for (const op of propOpsFor(REAL_PROPS, { linkage: "sky", frame, scale: 9 }) ?? []) {
      if (op.group && op.group.filter && op.group.filter.includes("0px 0px 0px")) {
        flat.push(op.group.character);
        break;
      }
    }
  }
  assert.deepEqual(flat, [1702, 1702, 1702, 1702, 1702, 1702],
    "the zero-radius glows are still zero at scale 9, on the cloud bank");
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

  // ► **MOVED 2026-09-22 BY EXACTLY ONE PROP**: `lightning_bolt_combat` joined the pack (2 frames,
  //   3 placements, 20 ops, 2 glow groups of 9 ops, 5 shapes / 39 paths). Control: on the pack as it was
  //   before, every assertion in this file passes unchanged.
  //   **And again the same day by `fireball_combat`** (4 frames, 3 placements, 28 ops, 7 shapes / 61 paths,
  //   NO effect groups; its explosion frames 1-18 are morph shapes the extractor refuses, so only the flight
  //   frame and the last four explosion frames carry geometry). Measured by the same walk.
  //   **And once more when extract-props began baking morphs** (+1 placement, +10 ops, +18 shapes /
  //   +233 paths: the explosion's first 18 frames, which the line above says were refused).
  assert.equal(placements, 3356, "every placement in the pack" + " — +4 on 2026-09-23 when `boulder_combat` (sprite 33, frames 1/4, with the explosion child 27 on frame 4) joined the pack");
  assert.equal(tinted, 2330, "70% of them tinted, which is the sky sweeping through dusk");
  assert.equal(ops, 8789, "and the operations they expand to — +49 on 2026-09-23: boulder_combat (sprite 33 + its explosion child 27) joined the pack: 3 x 13 paths of the rock, shape 32, on frames 1-3, plus the 10 paths of shape 19@0, the explosion's first frame, on frame 4");

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

/* ------------------------------------------------------------------ */
/* THE ENCLOSING GROUPS, COMPOSITED                                    */
/* ------------------------------------------------------------------ */

/**
 * ► **THE SHELL'S OWN FUNCTIONS ARE LIFTED OUT OF ITS SOURCE AND RUN, WHICH IS
 *   NOT THE SAME AS RE-IMPLEMENTING THEM HERE.** Node cannot import
 *   `tools/arena/main.js` — absolute URL specifiers, `document`, `Audio` at
 *   module scope — so every other test in this file reads the shell as TEXT and
 *   asserts what it says. Text assertions catch a deletion and are blind to a
 *   wrong number: `assert.ok(code.includes("filterBleedOf"))` stays green while
 *   the bleed is a tenth of what it must be.
 *
 *   So the group compositor's decisions were written as functions that close
 *   over NOTHING, and these tests cut them out of the file and execute them.
 *   A copy of the code in this file would have been a second implementation
 *   that agrees with itself; this one goes red when the shell changes, which
 *   is the whole point.
 *
 * ► **AND THE LIFT ASSERTS THAT IT ENGAGED, BECAUSE A LIFT THAT RETURNED
 *   NOTHING WOULD MAKE EVERY TEST BELOW VACUOUS.** `new Function` throws on a
 *   truncated body, and `liftFromShell` refuses a name it cannot find rather
 *   than returning `undefined` for it — the shape `assert.equal(X, X)` has in
 *   this project's own ledger of what has gone wrong here.
 */
function shellFunctionSource(code, name) {
  const at = code.indexOf(`function ${name}(`);
  if (at < 0) return null;
  let index = code.indexOf("{", at);
  if (index < 0) return null;
  let depth = 0;
  let mode = "code";
  let quote = "";
  for (; index < code.length; index += 1) {
    const ch = code[index];
    if (mode === "string") {
      if (ch === "\\") { index += 1; continue; }
      if (ch === quote) mode = "code";
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") { quote = ch; mode = "string"; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return code.slice(at, index + 1);
    }
  }
  return null;
}

/**
 * The KEY NAMES of one of the shell's `const <name> = { … };` tallies, read out
 * of its source rather than restated here.
 *
 * ► **WRITTEN AFTER A HAND-WRITTEN COPY OF `figureGroupPaint` DRIFTED.** The
 *   shell renamed two counters; this file's duplicate did not; `countFigureGroups`
 *   incremented keys that did not exist and the assertions compared against
 *   `NaN`. The whole point of `liftFromShell` is that the thing under test is
 *   the shell's own text — a tally literal transcribed by hand defeats it for
 *   the one part of the harness that carries the numbers.
 */
/** A brace-balanced object literal starting at `from`, string-aware. */
function objectLiteralAt(code, from) {
  const at = code.indexOf("{", from);
  if (at < 0) return null;
  let depth = 0;
  let mode = "code";
  let quote = "";
  for (let index = at; index < code.length; index += 1) {
    const ch = code[index];
    if (mode === "string") {
      if (ch === "\\") { index += 1; continue; }
      if (ch === quote) mode = "code";
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") { quote = ch; mode = "string"; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return code.slice(at, index + 1);
    }
  }
  return null;
}

function shellTallyKeys(name) {
  const source = readShellSource();
  assert.ok(source, "tools/arena/main.js is tracked and must be readable");
  const { code } = codeOnly(source);
  const at = code.indexOf(`const ${name} = {`);
  assert.ok(at >= 0, `${name} is declared in tools/arena/main.js as a const object literal`);
  const body = objectLiteralAt(code, at + `const ${name} = `.length);
  assert.ok(body, `${name}'s literal is brace-balanced`);
  const keys = [...body.matchAll(/(?:^|[{,])\s*([A-Za-z_$][\w$]*)\s*:/g)].map((match) => match[1]);
  assert.ok(keys.length > 3, `${name} came out with ${keys.length} keys, which is not a tally`);
  return keys;
}

/** The named functions, cut out of the shell's stripped source and evaluated. */
function liftFromShell(names) {
  const source = readShellSource();
  assert.ok(source, "tools/arena/main.js is tracked and must be readable");
  const { code, mode } = codeOnly(source);
  assert.equal(mode, "code", "the comment strip ended outside every comment and string");
  const parts = [];
  for (const name of names) {
    const part = shellFunctionSource(code, name);
    assert.ok(part, `${name} is declared in tools/arena/main.js as a plain function`);
    assert.ok(part.length > 60, `${name} came out at ${part.length} chars, which is not a function body`);
    parts.push(part);
  }
  const built = new Function(`${parts.join("\n")}\nreturn { ${names.join(", ")} };`)();
  for (const name of names) assert.equal(typeof built[name], "function", `${name} evaluated to a function`);
  return built;
}

const COMPOSITOR = liftFromShell([
  "groupRunsOf", "pathBoxOf", "composedMatrix", "boxThrough",
  "filterBleedOf", "runBoxOf", "bufferRegionOf"
]);

/** A group record shaped as `props.js` freezes one, for the synthetic cases. */
function groupRecord(fields = {}) {
  return {
    id: 0, path: [], character: null, enclosedBy: null, filter: null,
    composite: null, blendModeRefused: null, colourMatricesFolded: 0,
    ops: 0, placements: 0, counts: {}, ...fields
  };
}

test("a run ends where the GROUP OBJECT changes, never where its id does", () => {
  // ► **`props.js` INTERNS ONE RECORD PER GROUP PER FRAME SO THAT IDENTITY IS
  //   THE QUESTION**, and its own header says a painter flushes on `!==`.
  //   Comparing `group.id` instead would merge two different groups that happen
  //   to share an index — which is exactly what happens when one frame's
  //   operations come from two props, since the index is into each prop's OWN
  //   `effectGroups`. The two records below are `id: 3` twice on purpose.
  const first = groupRecord({ id: 3, filter: "blur(2px)" });
  const second = groupRecord({ id: 3, filter: "blur(9px)" });
  const { runs, tally } = COMPOSITOR.groupRunsOf([{ group: first }, { group: second }]);
  assert.equal(runs.length, 2, "two records at one id are two runs, not one");
  assert.equal(tally.groups, 2);
  assert.equal(tally.split, 0, "and neither of them is split");
  assert.deepEqual(runs.map((run) => run.group.filter), ["blur(2px)", "blur(9px)"]);
});

test("a group with only a colour matrix gets NO buffer, because props.js already folded it", () => {
  // ► **THE ONE CASE A BUFFER WOULD BE PURE COST.** `props.js` folds a group's
  //   colour matrices into every fill, stroke and gradient stop — the fold is
  //   exact per fill for all 150 of this build's group matrices — so such a
  //   group has nothing left for a painter to do. 274 of the pack's 745 group
  //   instances are this case — and the sweep below pins that number, because
  //   this comment said 289 until it was run, which is the count of instances
  //   whose filter STRING does not move with the scale and is a different
  //   question one line away. Buffering them anyway would be invisible on a
  //   screenshot and would cost an offscreen per group per frame.
  const inert = groupRecord({ id: 1, colourMatricesFolded: 2 });
  const { runs, tally } = COMPOSITOR.groupRunsOf([{ group: inert }, { group: inert }]);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].buffered, false, "nothing to composite");
  assert.equal(tally.inert, 1, "and it is COUNTED, so the zero-buffer frame is explicable");
  assert.equal(tally.buffered, 0);
  assert.equal(tally.direct, 1);

  // A blend mode alone is enough to need one; so is a filter alone.
  for (const [field, value] of [["composite", "lighten"], ["filter", "blur(1px)"]]) {
    const live = groupRecord({ id: 2, [field]: value });
    const plan = COMPOSITOR.groupRunsOf([{ group: live }]);
    assert.equal(plan.runs[0].buffered, true, `${field} alone needs a buffer`);
    assert.equal(plan.tally.inert, 0);
  }
});

test("an ungrouped operation is its own run and is drawn straight onto the canvas", () => {
  const group = groupRecord({ id: 7, filter: "blur(2px)" });
  const { runs, tally } = COMPOSITOR.groupRunsOf([{}, { group }, { group }, { d: "M0 0" }]);
  assert.deepEqual(runs.map((run) => [run.group ? run.group.id : null, run.from, run.to, run.buffered]), [
    [null, 0, 1, false],
    [7, 1, 3, true],
    [null, 3, 4, false]
  ]);
  assert.equal(tally.ops, 4);
  assert.equal(tally.groupedOps, 2, "the denominator the buffered count is read against");
  assert.equal(tally.bufferedOps, 2);
  assert.equal(tally.direct, 2);
  // Total-ness: a malformed array must not stop the arena being painted.
  assert.deepEqual(COMPOSITOR.groupRunsOf(null).runs, []);
  assert.equal(COMPOSITOR.groupRunsOf(undefined).tally.ops, 0);
  assert.equal(COMPOSITOR.groupRunsOf([null, undefined]).tally.groupedOps, 0);
});

test("a group whose operations are NOT CONTIGUOUS is counted ONCE, and the real pack has none", () => {
  // ► **THIS IS THE PER-LEAF MISTAKE AT A COARSER GRAIN.** A group reaching two
  //   runs is filtered twice, on two buffers, with a seam between them — the
  //   same class of wrong picture as blurring each path, arrived at from the
  //   other direction. It cannot happen on this pack (`props.js` emits
  //   placements in path order), so this synthetic case is the ONLY thing that
  //   can move the counter and the sweep below is what says the counter is
  //   quiet rather than dead.
  const split = groupRecord({ id: 4, filter: "blur(2px)" });
  const other = groupRecord({ id: 5, composite: "lighten" });
  const plan = COMPOSITOR.groupRunsOf([
    { group: split }, { group: other }, { group: split }, { group: split }
  ]);
  assert.equal(plan.runs.length, 3, "the group comes back and is a second run");
  assert.equal(plan.tally.groups, 2, "but it is still two GROUPS");
  assert.equal(plan.tally.split, 1, "counted once per split group, not once per extra run");
  assert.equal(plan.tally.buffered, 3, "and all three runs are composited");

  // ► **THREE RUNS OF ONE GROUP IS STILL *ONE* SPLIT GROUP** — the count reads
  //   against `groups` and cannot exceed it. Below, BOTH groups are
  //   interleaved, so both are split and the answer is 2 rather than 1: the
  //   first draft of this assertion said 1 and was counting the first group
  //   while looking straight at the second.
  const thrice = COMPOSITOR.groupRunsOf([
    { group: split }, { group: other }, { group: split }, { group: other }, { group: split }
  ]);
  assert.equal(thrice.runs.length, 5, "five runs from two groups");
  assert.equal(thrice.tally.groups, 2);
  assert.equal(thrice.tally.split, 2, "and both of them are split, not just the one that repeats most");
  assert.ok(thrice.tally.split <= thrice.tally.groups, "the count can never exceed its denominator");
});

test("a NESTED group and a REFUSED blend mode are counted, because neither is drawn right", () => {
  // ► **ONLY THE INNERMOST RECORD IS COMPOSITED.** `op.group` is the innermost
  //   and `enclosedBy` walks out; doing it properly needs a stack of buffers,
  //   and every chain in this build's pack is one deep. So the outer filter of
  //   a nested pair is silently dropped — which is why it is not silent.
  const outer = groupRecord({ id: 1, filter: "blur(8px)" });
  const inner = groupRecord({ id: 2, filter: "blur(2px)", enclosedBy: outer });
  const refused = groupRecord({ id: 3, composite: null, blendModeRefused: "erase" });
  const plan = COMPOSITOR.groupRunsOf([{ group: inner }, { group: refused }]);
  assert.equal(plan.tally.nested, 1, "the outer blur is not drawn and says so");
  assert.equal(plan.tally.blendRefused, 1, "canvas cannot express `erase`");
  assert.equal(plan.runs[1].buffered, false,
    "a refused blend with no filter has nothing canvas can do, so it gets no buffer");
});

test("the REAL pack's groups: the sky's are contiguous, and the moon is ONE buffer of 56 paths", () => {
  if (!REAL_PROPS) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  // ► **THE WHOLE PACK, SO THE TWO ZEROS BELOW HAVE A DENOMINATOR.** 745 group
  //   instances across 302 frames of 12 linkages; 0 split and 0 nested. Both
  //   counters are exercised by the synthetic cases above, so these zeros are
  //   the pack being tidy and not the counters being dead.
  let instances = 0;
  let split = 0;
  let nested = 0;
  let buffered = 0;
  let inert = 0;
  for (const linkage of Object.keys(REAL_PROPS.props)) {
    for (let frame = 1; frame <= propFrameCount(REAL_PROPS, linkage); frame += 1) {
      const { tally } = COMPOSITOR.groupRunsOf(propOpsFor(REAL_PROPS, { linkage, frame }) ?? []);
      instances += tally.groups;
      split += tally.split;
      nested += tally.nested;
      buffered += tally.buffered;
      inert += tally.inert;
    }
  }
  // ► **MOVED 2026-09-22 BY EXACTLY ONE PROP**: `lightning_bolt_combat` joined the pack (2 frames,
  //   3 placements, 20 ops, 2 glow groups of 9 ops, 5 shapes / 39 paths). Control: on the pack as it was
  //   before, every assertion in this file passes unchanged.
  //   `fireball_combat`, which joined the same day, adds no effect group, so this count did not move.
  assert.equal(instances, 748, "every group instance the pack reaches, frame by frame" + " — +1 on 2026-09-23 when `boulder_combat` (sprite 33, frames 1/4, with the explosion child 27 on frame 4) joined the pack (its inherited colourMatrix group)");
  assert.equal(split, 0, "no group's operations are interrupted by another group's");
  assert.equal(nested, 0, "and no chain is deeper than one");
  assert.equal(buffered, 473, "the instances that need an offscreen — 466 filtered plus 7 blended");
  assert.equal(inert, 275, "and the colour-matrix-only ones that do not — +1 on 2026-09-23: boulder_combat (sprite 33 + its explosion child 27) joined the pack, and its one group is a colourMatrix and nothing else");
  assert.equal(buffered + inert, instances, "which partitions the roster exactly");

  // ► **THE ONE GROUP THE WHOLE DESIGN IS FOR.** `sky` frame 150 draws the moon
  //   as 56 separate paths under a single `drop-shadow`. Per-leaf that is 56
  //   glows with 56 internal edges; this is ONE run, so it is one buffer and
  //   one `ctx.filter`.
  const moon = COMPOSITOR.groupRunsOf(propOpsFor(REAL_PROPS, { linkage: "sky", frame: 150 }));
  const biggest = moon.runs.filter((run) => run.buffered)
    .sort((left, right) => (right.to - right.from) - (left.to - left.from))[0];
  assert.equal(biggest.to - biggest.from, 56, "fifty-six paths in one composite");
  assert.equal(biggest.group.character, 1728, "character 1728, the moon");
  assert.match(biggest.group.filter, /^drop-shadow\(/);
  assert.equal(moon.tally.groups, 4);
  assert.equal(moon.tally.buffered, 3, "the moon, the cloud bank and the small blur");
  assert.equal(moon.tally.inert, 1, "and the backdrop's colour matrix, already folded");

  // ► **THE SHIPPED DRESSING, WHICH IS WHAT A SCREENSHOT OF THIS PAGE SHOWS.**
  //   `?sky=1` is ONE filtered group over ONE operation — so the default
  //   picture moves by a single 3.16px blur at scale 1, and a reader expecting
  //   the moon has to ask for `?sky=150`.
  const shipped = COMPOSITOR.groupRunsOf(propOpsFor(REAL_PROPS, { linkage: "sky", frame: 1 }));
  assert.equal(shipped.tally.ops, 2);
  assert.equal(shipped.tally.groups, 2);
  assert.equal(shipped.tally.buffered, 1);
  assert.equal(shipped.tally.bufferedOps, 1);
  assert.equal(shipped.runs.find((run) => run.buffered).group.filter, "blur(3.1623px)");

  // ► **THE PACK'S ONE BLEND MODE, AND IT IS NOT THE SKY.** `bullet_trail`'s
  //   group carries `lighten` and NO filter, over all four paths of one puff.
  const puff = COMPOSITOR.groupRunsOf(propOpsFor(REAL_PROPS, { linkage: "bullet_trail", frame: 1 }));
  assert.equal(puff.tally.groups, 1);
  assert.equal(puff.tally.buffered, 1);
  assert.equal(puff.tally.bufferedOps, 4);
  assert.equal(puff.runs[0].group.composite, "lighten");
  assert.equal(puff.runs[0].group.filter, null, "a blend mode with nothing to filter");
  assert.equal(puff.runs[0].group.blendModeRefused, null);
});

test("per-leaf and per-group COINCIDE for 286 of the pack's 748 groups (747 before boulder_combat, 2026-09-23), and it is still not taken", () => {
  if (!REAL_PROPS) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  // ► **THE BRIEF ASKED WHICH CASES COINCIDE, AND THE ANSWER IS A REAL ONE.** A
  //   group over exactly ONE unclipped path IS its own composite, so setting
  //   `ctx.filter` around that one fill draws the same image as rasterising and
  //   filtering it. Measured here rather than argued: 286 of the 745 group
  //   instances are a single filtered operation, and NONE of the 286 carries a
  //   clip. The shell buffers them anyway, and this is the reason:
  //
  //   a per-leaf `ctx.filter` is set while the canvas transform carries
  //   `fit.scale * layer.scale` and the placement's own matrix, and whether
  //   `ctx.filter` lengths are scaled by the transform is an UNMEASURED
  //   hypothesis (`filters.js` says so in its own header, and there is no
  //   browser on this route). Compositing the buffer at the IDENTITY transform
  //   makes the two readings of that hypothesis the same reading. Taking the
  //   shortcut for these 286 would make a quarter of the pack's groups depend
  //   on a fact nobody here has measured, to save an offscreen.
  let single = 0;
  let singleClipped = 0;
  let multi = 0;
  for (const linkage of Object.keys(REAL_PROPS.props)) {
    for (let frame = 1; frame <= propFrameCount(REAL_PROPS, linkage); frame += 1) {
      for (const run of COMPOSITOR.groupRunsOf(propOpsFor(REAL_PROPS, { linkage, frame }) ?? []).runs) {
        if (!run.buffered || !run.group.filter) continue;
        if (run.to - run.from === 1) {
          single += 1;
          if (propOpsFor(REAL_PROPS, { linkage, frame })[run.from].clip) singleClipped += 1;
        } else {
          multi += 1;
        }
      }
    }
  }
  assert.equal(single, 286, "single-operation filtered groups, where the two pictures coincide");
  assert.equal(singleClipped, 0, "and not one of them is clipped, which is what makes them coincide");
  // ► **MOVED 2026-09-22 BY EXACTLY ONE PROP**: `lightning_bolt_combat` joined the pack (2 frames,
  //   3 placements, 20 ops, 2 glow groups of 9 ops, 5 shapes / 39 paths). Control: on the pack as it was
  //   before, every assertion in this file passes unchanged.
  //   `fireball_combat`, which joined the same day, adds no effect group, so this count did not move.
  // The bolt's two glows each cover nine operations, so both land here.
  assert.equal(multi, 180, "the filtered groups where they do NOT coincide");
  assert.equal(single + multi, 466, "and together they are every filtered instance");

  // ► **AND THE CASE THAT BREAKS THE SHORTCUT EVEN WITHOUT THE HYPOTHESIS.**
  //   Canvas applies `ctx.filter` to the source and clips the RESULT, so a
  //   per-operation filter on a clipped path is cut off at the cutter's edge
  //   where the build's blur spills past it. Most of the sky is that case.
  let underFilter = 0;
  let clipped = 0;
  for (let frame = 1; frame <= propFrameCount(REAL_PROPS, "sky"); frame += 1) {
    for (const op of propOpsFor(REAL_PROPS, { linkage: "sky", frame }) ?? []) {
      if (!op.group || !op.group.filter) continue;
      underFilter += 1;
      if (op.clip) clipped += 1;
    }
  }
  assert.equal(underFilter, 5810, "sky operations sitting under a filtered group");
  assert.equal(clipped, 4312, "of which this many carry a clip a per-leaf filter would cut");
});

test("pathBoxOf reads every path in the pack, and the STROKE PAD is what keeps 31 shapes inside it (27 when this was named, 30 before boulder_combat on 2026-09-23)", () => {
  if (!REAL_PROPS) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  // ► **THE BOX IS READ AS NUMBER PAIRS, AND THAT IS ONLY CORRECT BECAUSE OF
  //   WHICH COMMANDS OCCUR.** Every path in this pack is M, L, Q and Z, whose
  //   parameters are all points; a quadratic lies inside the hull of its
  //   control points, so the pair scan over-estimates a curve and never clips
  //   one. This walks all 258 paths rather than trusting that.
  let paths = 0;
  let unreadable = 0;
  for (const shape of Object.values(REAL_PROPS.shapes)) {
    for (const path of shape.paths ?? []) {
      paths += 1;
      if (!COMPOSITOR.pathBoxOf(path.d)) unreadable += 1;
    }
  }
  // ► **MOVED 2026-09-22 BY EXACTLY ONE PROP**: `lightning_bolt_combat` joined the pack (2 frames,
  //   3 placements, 20 ops, 2 glow groups of 9 ops, 5 shapes / 39 paths). Control: on the pack as it was
  //   before, every assertion in this file passes unchanged.
  //   **And again the same day by `fireball_combat`** (4 frames, 3 placements, 28 ops, 7 shapes / 61 paths,
  //   NO effect groups; its explosion frames 1-18 are morph shapes the extractor refuses, so only the flight
  //   frame and the last four explosion frames carry geometry). Measured by the same walk.
  //   **And once more when extract-props began baking morphs** (+1 placement, +10 ops, +18 shapes /
  //   +233 paths: the explosion's first 18 frames, which the line above says were refused).
  assert.equal(paths, 604, "every path in every shape the pack holds" + " — +13 on 2026-09-23 when `boulder_combat` (sprite 33, frames 1/4, with the explosion child 27 on frame 4) joined the pack");
  assert.equal(unreadable, 0, "and the pair scan reads all of them");

  // ► **THE CROSS-CHECK IS THE EXTRACTOR'S OWN `bounds`, WRITTEN BY A DIFFERENT
  //   CODE PATH, AND IT IS WHAT PROVES THE STROKE PAD NECESSARY.** A stroke is
  //   centred on its path and reaches outside it, so a box built on the
  //   coordinates alone is short by up to the stroke's width — on 23 of this
  //   pack's 56 shapes, measured. A buffer built on that box clips those
  //   shapes' outlines.
  //
  // ► **AND IT GOES THROUGH `runBoxOf`, WHICH OWNS THE PAD, RATHER THAN
  //   APPLYING THE PAD HERE.** The first draft of this block did its own
  //   padding and compared the two answers — so it proved that padding works
  //   and said NOTHING about whether the shell does it. Mutation M4, deleting
  //   the pad from `runBoxOf` in a scratch copy, left the whole suite green.
  //   That is this project's signature defect committed in a test written to
  //   catch it.
  const identity = [1, 0, 0, 1, 0, 0];
  let shapes = 0;
  let shortOfItsOwnBounds = 0;
  let looserMidMorph = 0;
  let savedByThePad = 0;
  for (const shape of Object.values(REAL_PROPS.shapes)) {
    const bounds = shape.bounds;
    if (!bounds || !Array.isArray(shape.paths) || shape.paths.length === 0) continue;
    shapes += 1;
    const asOps = shape.paths.map((path) => ({
      d: path.d, matrix: identity, strokeWidth: path.strokeWidth ?? 0
    }));
    const box = COMPOSITOR.runBoxOf(asOps, { from: 0, to: asOps.length }, identity, 1);
    assert.ok(box, "every shape in the pack measures");
    const short = Math.max(box.minX - bounds.xMin, box.minY - bounds.yMin,
      bounds.xMax - box.maxX, bounds.yMax - box.maxY);
    // ► **A MORPH BAKED BETWEEN ITS ENDS HAS NO EXACT BOUNDS TO BE MEASURED
    //   AGAINST** (added 2026-09-22, when extract-props began carrying morphs).
    //   Its `bounds` are the declared start and end bounds INTERPOLATED, as
    //   extract-figure does, and the box of an interpolated shape is not the
    //   interpolation of the two boxes — measured on this pack, those bounds
    //   run LOOSER than the geometry mid-morph, up to ~13 px on character 20.
    //   Loose bounds are harmless (runBoxOf sizes buffers from the geometry),
    //   so they are counted apart; a morph at ratio 0 or 65535 carries its
    //   declared StartBounds/EndBounds exactly and stays in the oracle.
    if (shape.morph !== undefined && shape.ratio !== 0 && shape.ratio !== 65535) {
      if (short > 0.001) looserMidMorph += 1;
      continue;
    }
    if (short > 0.001) shortOfItsOwnBounds += 1;
    // What the pad is worth on THIS shape: the unpadded box would have been
    // short, and the padded one is not.
    const bare = shape.paths.map((path) => ({ d: path.d, matrix: identity, strokeWidth: 0 }));
    const bareBox = COMPOSITOR.runBoxOf(bare, { from: 0, to: bare.length }, identity, 1);
    const bareShort = Math.max(bareBox.minX - bounds.xMin, bareBox.minY - bounds.yMin,
      bounds.xMax - bareBox.maxX, bounds.yMax - bareBox.maxY);
    if (bareShort > 0.001 && short <= 0.001) savedByThePad += 1;
  }
  // The bolt's five: shapes 6, 7, 8, 9 (the flicker) and 11 (the frightning bolt's addition).
  // 68 -> 86 on 2026-09-22 when extract-props began baking morphs: the fireball
  // explosion's 18 (characters 19-22 at the ratios sprite 27 places them).
  // 86 -> 87 on 2026-09-23 when `boulder_combat` (sprite 33 + its explosion child 27) joined the pack:
  // the rock, shape 32, is the only shape it adds — the explosion's are already here, from the fireball.
  // Control: the pack with `boulder_combat` and shape 32 removed is deep-equal to the pre-extraction
  // pack, and this walk over it gives 86 / 591 paths / 14 / 30.
  assert.equal(shapes, 87, "every shape the pack holds declares bounds — +1 on 2026-09-23: boulder_combat (sprite 33 + its explosion child 27) joined the pack, adding the rock, shape 32");
  assert.equal(shortOfItsOwnBounds, 0, "and runBoxOf's box contains every one of them");
  // 18 baked morphs, four at ratio 0 (in the oracle above) and FOURTEEN between
  // their ends, every one of which has interpolated bounds looser than its
  // geometry. Pinned so a change in how morph bounds are baked is seen rather
  // than absorbed. (It does NOT check the other direction — geometry reaching
  // past its bounds — which the compositor would not care about either, since
  // it sizes buffers from the geometry.)
  assert.equal(looserMidMorph, 14, "every mid-morph shape's interpolated bounds run looser than its geometry");
  // 23 -> 27 on 2026-09-22: four of the bolt's five new shapes are STROKED lines, and the old 56 are unchanged.
  // 27 -> 30 the same day, when `fireball_combat` joined: three of its seven new shapes are stroked.
  // 30 -> 31 on 2026-09-23, when `boulder_combat` joined: its one new shape, the rock (32), carries two
  // 2-wide strokes and is saved by the pad (probed by shape id in a scratch copy of this walk).
  assert.equal(savedByThePad, 31, "31 of which only because the stroke width is added — +1 on 2026-09-23: boulder_combat (sprite 33 + its explosion child 27) joined the pack, and its rock, shape 32, is stroked");

  // And the pad is read off the OPERATION, so a wider stroke moves the box.
  const stroked = [{ d: "M0 0L10 0L10 10L0 10Z", matrix: identity, strokeWidth: 6 }];
  assert.deepEqual(COMPOSITOR.runBoxOf(stroked, { from: 0, to: 1 }, identity, 1),
    { minX: -6, minY: -6, maxX: 16, maxY: 16 }, "a 6-wide stroke pushes the box out by 6 on every side");

  // An odd number count is what a command whose parameters are NOT points would
  // arrive as, and the honest answer is `null` — the caller then uses the whole
  // surface, which is slow and correct, rather than a box missing a coordinate.
  assert.equal(COMPOSITOR.pathBoxOf("M0 0L10"), null, "an odd count is refused, not truncated");
  assert.equal(COMPOSITOR.pathBoxOf(""), null);
  assert.equal(COMPOSITOR.pathBoxOf(null), null);
  assert.deepEqual(COMPOSITOR.pathBoxOf("M0 0L10 -4Q20 30 5 5Z"),
    { minX: 0, minY: -4, maxX: 20, maxY: 30 },
    "the quadratic's CONTROL point is in the box, which over-estimates and never clips");
});

test("filterBleedOf bounds the reach of every filter string the pack produces", () => {
  if (!REAL_PROPS) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  // ► **THE ASYMMETRY IS THE WHOLE ARGUMENT: TOO MUCH PADDING COSTS PIXELS AND
  //   TOO LITTLE COSTS THE PICTURE.** A CSS Gaussian's support is 3 sigma, and
  //   `blur(R)` takes R AS sigma while `drop-shadow`'s R is twice sigma — so
  //   3 x R bounds the reach of either. This checks every distinct string the
  //   real pack makes, at scale 1, rather than the two in the docstring.
  const strings = new Set();
  for (const linkage of Object.keys(REAL_PROPS.props)) {
    for (let frame = 1; frame <= propFrameCount(REAL_PROPS, linkage); frame += 1) {
      for (const op of propOpsFor(REAL_PROPS, { linkage, frame }) ?? []) {
        if (op.group && op.group.filter) strings.add(op.group.filter);
      }
    }
  }
  // ► **MOVED 2026-09-22 BY EXACTLY ONE PROP**: `lightning_bolt_combat` joined the pack (2 frames,
  //   3 placements, 20 ops, 2 glow groups of 9 ops, 5 shapes / 39 paths). Control: on the pack as it was
  //   before, every assertion in this file passes unchanged.
  //   `fireball_combat`, which joined the same day, adds no effect group, so this count did not move.
  assert.equal(strings.size, 213, "the distinct filter strings this pack asks for");
  let tightest = Infinity;
  for (const filter of strings) {
    const lengths = filter.match(/[-+]?[0-9]*[.]?[0-9]+px/g) ?? [];
    assert.ok(lengths.length > 0, `${filter} states at least one length`);
    const widest = Math.max(...lengths.map((token) => Math.abs(Number(token.slice(0, token.length - 2)))));
    const bleed = COMPOSITOR.filterBleedOf(filter);
    assert.ok(bleed >= 3 * widest, `${filter} needs ${3 * widest}px of room and gets ${bleed}px`);
    tightest = Math.min(tightest, bleed / (3 * widest));
  }
  // The margin at its narrowest, so "it is generous" is a number rather than an
  // adjective. 1.0889 is `drop-shadow(0px 0px 15px …)`: 49px of padding for
  // 45px of Gaussian support.
  assert.ok(tightest > 1.05 && tightest < 1.2, `tightest margin was ${tightest}x`);

  assert.equal(COMPOSITOR.filterBleedOf(null), 0, "no filter, no bleed");
  assert.equal(COMPOSITOR.filterBleedOf(""), 0);
  assert.equal(COMPOSITOR.filterBleedOf("none"), 0, "and a string with no length in it");
  // A chained string sums, because the second filter is applied to the first
  // one's already-spread result.
  assert.equal(COMPOSITOR.filterBleedOf("blur(2px) blur(3px)"), 19);
});

test("the buffer region GROWS by the bleed, falls back to the WHOLE surface, and can be empty", () => {
  // ► **THE FALLBACK IS THE WHOLE SURFACE AND NOT A GUESS AT A SMALLER ONE.**
  //   `runBoxOf` returns null when it cannot read a path; a painter that
  //   answered that with a plausible box would clip the run and nothing would
  //   say so.
  const everything = COMPOSITOR.bufferRegionOf(null, 4, 800, 600);
  assert.deepEqual(
    { x: everything.x, y: everything.y, width: everything.width, height: everything.height },
    { x: 0, y: 0, width: 800, height: 600 }
  );
  assert.equal(everything.clamped, false, "an unmeasurable run is not a clamped one");

  // The bleed is added on EVERY side, or a blur is cut off on the side that
  // was forgotten — which reads as a straight edge in a soft glow.
  const grown = COMPOSITOR.bufferRegionOf({ minX: 100, minY: 200, maxX: 140, maxY: 260 }, 10, 800, 600);
  assert.deepEqual(grown, { x: 90, y: 190, width: 60, height: 80, clamped: false });

  // Clipped by the surface, and it says so: the spill that falls off the canvas
  // is spill the destination would have cut anyway.
  const clamped = COMPOSITOR.bufferRegionOf({ minX: -5, minY: 10, maxX: 30, maxY: 40 }, 4, 100, 100);
  assert.deepEqual(clamped, { x: 0, y: 6, width: 34, height: 38, clamped: true });

  // Entirely off the canvas: an EMPTY region, which the painter skips.
  const gone = COMPOSITOR.bufferRegionOf({ minX: -500, minY: -500, maxX: -400, maxY: -400 }, 4, 100, 100);
  assert.equal(gone.width, 0);
  assert.equal(gone.height, 0);

  // Whole pixels, so a buffer is never asked for a fractional canvas.
  const snapped = COMPOSITOR.bufferRegionOf({ minX: 10.4, minY: 10.4, maxX: 20.6, maxY: 20.6 }, 0.5, 800, 600);
  assert.equal(snapped.x, 9, "floored outwards");
  assert.equal(snapped.width, 13, "and ceiled outwards, so the box is never shaved");
});

test("runBoxOf is told which painter's twips convention it is measuring, because they differ", () => {
  // ► **`paintLayerOperation` DIVIDES A PLACEMENT'S TRANSLATION BY 20 AND
  //   `paintPropOperation` DOES NOT.** That predates the compositor and is left
  //   alone; what matters here is that a box computed with the wrong divisor
  //   puts the buffer twenty times too far from the geometry, draws nothing
  //   into it, and composites an empty rectangle — a layer that silently
  //   vanishes. The two answers below are the same operation read both ways.
  const ops = [{ d: "M0 0L10 0L10 10L0 10Z", matrix: [1, 0, 0, 1, 200, 400], strokeWidth: 0 }];
  const run = { from: 0, to: 1, group: null, buffered: true };
  const identity = [1, 0, 0, 1, 0, 0];
  assert.deepEqual(COMPOSITOR.runBoxOf(ops, run, identity, 20),
    { minX: 10, minY: 20, maxX: 20, maxY: 30 });
  assert.deepEqual(COMPOSITOR.runBoxOf(ops, run, identity, 1),
    { minX: 200, minY: 400, maxX: 210, maxY: 410 });

  // ► **ALL FOUR CORNERS THROUGH THE MATRIX, because `paintProp` scales by
  //   `(k, -k)` and rotates every arrow by its pitch.** A two-corner hull is
  //   right only for a matrix that maps one diagonal of the box onto the hull
  //   of all four — which every pure scale, every flip and (as it happens)
  //   every quarter turn does.
  //
  // ► **SO THE FIRST THREE CASES HERE WERE ALL SATISFIED BY THE TWO-CORNER
  //   VERSION, AND MUTATION M14 PROVED IT** — a square box, a y-flip and a
  //   quarter turn each came back identical with two corners and the suite
  //   stayed green. What separates them is a NON-SQUARE box under a rotation
  //   that is not a multiple of 90 degrees, which is what `[3, 4, -4, 3]` is
  //   (a 53-degree turn at 5x, chosen so every corner lands on an integer).
  const oblong = { minX: 0, minY: 0, maxX: 10, maxY: 2 };
  assert.deepEqual(COMPOSITOR.boxThrough(oblong, [3, 4, -4, 3, 0, 0]),
    { minX: -8, minY: 0, maxX: 30, maxY: 46 },
    "the two corners the box is NAMED by map to (0,0) and (22,46), which misses 38 units of it");
  assert.deepEqual(COMPOSITOR.boxThrough({ minX: -1, minY: -1, maxX: 1, maxY: 1 }, [0, 2, -2, 0, 10, 20]),
    { minX: 8, minY: 18, maxX: 12, maxY: 22 }, "a quarter turn keeps the box around the shape");
  const flipped = COMPOSITOR.runBoxOf(ops, run, [2, 0, 0, -2, 0, 0], 1);
  assert.deepEqual(flipped, { minX: 400, minY: -820, maxX: 420, maxY: -800 },
    "and a y-flip puts the box above the origin, not below it");
  const turned = COMPOSITOR.runBoxOf(
    [{ d: "M0 0L10 0L10 2L0 2Z", matrix: [1, 0, 0, 1, 0, 0], strokeWidth: 0 }],
    run, [3, 4, -4, 3, 0, 0], 1
  );
  assert.deepEqual(turned, { minX: -8, minY: 0, maxX: 30, maxY: 46 },
    "and runBoxOf carries the four-corner hull, not just boxThrough");

  // The composition is canvas's own: outer, then inner.
  assert.deepEqual(COMPOSITOR.composedMatrix([2, 0, 0, 2, 5, 5], [1, 0, 0, 1, 3, 4]),
    [2, 0, 0, 2, 11, 13], "the inner translation is scaled by the outer transform");

  // One unreadable operation loses the whole run's box, which is the safe
  // direction: the caller uses the whole surface.
  assert.equal(COMPOSITOR.runBoxOf([{ d: "M0 0L1", matrix: [1, 0, 0, 1, 0, 0] }], run, identity, 1), null);
  assert.equal(COMPOSITOR.runBoxOf([{ d: "M0 0L1 1", matrix: null }], run, identity, 1), null);
});

test("the sky's buffer lands where the sky is drawn, at the fit the shell computes", () => {
  if (!REAL_PROPS) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  // ► **THE BOX IS BUILT FROM THE SAME TRANSFORM CHAIN `paintArenaLayer`
  //   APPLIES, RE-DERIVED HERE RATHER THAN COPIED FROM IT.** `stageFitFor` then
  //   the layer's placement then the layer's own scale — and `runBoxOf` is
  //   handed the product, exactly as the shell hands it `getTransform()` after
  //   the same three calls. If the shell's chain and this one disagree the box
  //   is in the wrong place, and this is the only surface that can say so.
  const fit = stageFitFor({ width: 1280, height: 840 });
  assert.equal(fit.scale, 2, "a 1280x840 canvas is exactly twice the 640x420 stage");
  const layers = arenaScreenLayersFor(REAL_PROPS, propOpsFor, null, SS2_ARENA_DRESSING);
  const sky = layers.find((layer) => layer.prop === "sky");
  assert.ok(sky, "the pack holds the sky");
  assert.equal(sky.placement.scale, 1.04, "the one object on the arena frame that is not unscaled");

  const ctm = [
    fit.scale * sky.placement.scale, 0, 0, fit.scale * sky.placement.scale,
    fit.offsetX + fit.scale * sky.placement.x,
    fit.offsetY + fit.scale * sky.placement.y
  ];
  const plan = COMPOSITOR.groupRunsOf(sky.ops);
  const run = plan.runs.find((candidate) => candidate.buffered);
  const box = COMPOSITOR.runBoxOf(sky.ops, run, ctm, 20);
  assert.ok(box, "the filtered run measures");
  // The blurred object is the sky's own cloud layer: it spans the stage and
  // then some, which is why the region below comes back clamped to the canvas.
  const region = COMPOSITOR.bufferRegionOf(box, COMPOSITOR.filterBleedOf(run.group.filter), 1280, 840);
  assert.ok(region.width > 0 && region.height > 0, "and it is on the canvas");
  assert.ok(region.width <= 1280 && region.height <= 840, "never larger than the surface");
  // ► **THE BUFFER IS A BAND, NOT THE WHOLE CANVAS, AND THAT IS THE WHOLE
  //   POINT OF MEASURING THE BOX.** The blurred object at the shipped dressing
  //   is a cloud layer 1256 x 272 device pixels in a 1280 x 840 canvas — 39% of
  //   the area a canvas-sized buffer would clear and filter every frame. It
  //   overhangs left, right and top, so the region comes back CLAMPED: the
  //   spill it loses is spill the destination would have cut anyway.
  assert.deepEqual(
    { x: region.x, y: region.y, width: region.width, height: region.height },
    { x: 24, y: 20, width: 1256, height: 272 },
    "the sky's blurred layer is a band across the top of the stage"
  );
  assert.equal(region.clamped, true, "clipped by the canvas on at least one side, and it says so");
  assert.ok(region.width * region.height < 1280 * 840 * 0.5,
    "less than half the work a canvas-sized buffer would do");

  // ► **AND THE SAME RUN AT A SMALLER CANVAS, so the numbers above are not a
  //   property of one size.** Halve the canvas and the region halves with it.
  const small = stageFitFor({ width: 640, height: 420 });
  const smallCtm = [
    small.scale * sky.placement.scale, 0, 0, small.scale * sky.placement.scale,
    small.offsetX + small.scale * sky.placement.x,
    small.offsetY + small.scale * sky.placement.y
  ];
  const smallBox = COMPOSITOR.runBoxOf(sky.ops, run, smallCtm, 20);
  assert.ok(smallBox.maxX - smallBox.minX < (box.maxX - box.minX) * 0.55,
    "half the stage scale is about half the box");
});

test("the shell composites at the IDENTITY transform, and sets no filter per operation", () => {
  const source = readShellSource();
  assert.ok(source, "tools/arena/main.js is tracked and must be readable");
  const { code } = codeOnly(source);

  // ► **THE FOUR LINES THAT ARE THE WHOLE COMPOSITE, PINNED IN ORDER.** Setting
  //   the transform to the identity BEFORE the filter and the draw is what makes
  //   `filters.js`'s unmeasured "are ctx.filter lengths scaled by setTransform"
  //   hypothesis stop mattering: under the identity the two readings are one
  //   reading. Drawing the buffer back under the layer's own transform would put
  //   the whole question back, and would also scale the buffer's pixels twice.
  assert.ok(code.includes(
    "    context.setTransform(1, 0, 0, 1, 0, 0);\n"
    + "    context.globalAlpha = 1;\n"
    + "    if (run.group.filter && !amplified) context.filter = run.group.filter;\n"
    + "    if (run.group.composite) context.globalCompositeOperation = run.group.composite;\n"
    + "    context.drawImage("
  ), "the composite is identity-transformed, then filtered, then blended, then drawn");

  // ► **`&& !amplified` IS THE ONE CHANGE THIS LINE HAS TAKEN, AND IT IS LOAD-
  //   BEARING.** When `glowAmplificationFor` returns a plan, the sequence in
  //   `amplifyGlows` has ALREADY applied the blur; setting the string as well
  //   would blur the composite a second time. The order this test exists to
  //   pin — identity, then filter, then blend, then draw — is untouched.
  assert.ok(code.includes("      ? amplifyGlows(buffer.canvas, region, run.group.amplify)\n"),
    "the amplified path is taken from the group's own plan, not decided in the shell");
  assert.equal(countOf(code, "glowAmplificationFor"), 0,
    "the SHELL must not decide which glows amplify — that is filters.js's, where the suite reaches it");

  // ► **AND THE FILTER IS SET NOWHERE ELSE THAT COULD REACH AN OPERATION.**
  //   `context.filter` appears in the probe (which draws into its own save/
  //   restore and never touches the arena), on the buffer's reset, and once in
  //   the composite. A fifth occurrence inside `paintLayerOperation` or
  //   `paintPropOperation` is the per-leaf picture arriving by habit.
  for (const painter of ["paintLayerOperation", "paintPropOperation"]) {
    const body = shellFunctionSource(code, painter);
    assert.ok(body, `${painter} is declared`);
    assert.equal(countOf(body, "filter"), 0, `${painter} sets no filter on an operation`);
    assert.equal(countOf(body, "globalCompositeOperation"), 0,
      `${painter} sets no blend mode on an operation`);
  }

  // The destination swap, and the belt to its braces.
  assert.ok(code.includes("const surface = canvas.getContext(\"2d\");\nlet context = surface;"),
    "`context` is rebindable and `surface` is the canvas it must come back to");
  assert.ok(code.includes("    } finally {\n      groupDepth -= 1;\n      context = destination;\n    }"),
    "the rebinding is undone in a finally, not after the loop");
  assert.ok(shellFunctionSource(code, "render").includes("context = surface;"),
    "and every frame re-asserts the invariant before it draws anything");

  // ► **THE ESCAPE HATCH IS THE MEASUREMENT.** The only check on any of this is
  //   a screenshot, and one picture says nothing; `?groups=0` is the other half
  //   of the pair.
  assert.ok(code.includes("params.get(\"groups\") !== \"0\""), "`?groups=0` turns the compositor off");

  // ► **AND THE COUNT FOR WHAT `?groups=0` COSTS IS PINNED AS TEXT, WHICH IS
  //   WEAKER THAN THE REST OF THIS FILE AND IS SAID SO.** `notComposited` only
  //   moves when the compositor is OFF — by the flag, or on a browser with no
  //   `ctx.getTransform` — and that branch lives in `paintGroupRuns`, which
  //   touches the DOM and cannot be lifted out. Mutation M20 killed the
  //   increment and every value assertion in this file stayed green; this line
  //   is the only thing that sees it. A reader should know that "the escape
  //   hatch reports what it skipped" rests on a `includes`, not on a number.
  assert.ok(code.includes("if (run.buffered) groupPaint.notComposited += run.to - run.from;"),
    "turning the compositor off still COUNTS the operations it stopped compositing");
});

test("the shell says out loud that the UI bar's own glows are NOT drawn", () => {
  const source = readShellSource();
  assert.ok(source, "tools/arena/main.js is tracked and must be readable");
  const { code } = codeOnly(source);
  assert.ok(code.includes("propEffectsUnreachable(pack)"),
    "the per-pack count of filters that reach no shape at all");
  assert.match(code, /the UI bar's own glows are NOT drawn/,
    "and it is in the log line, not only in a comment");
  assert.match(code, /group matrix\(es\) NOT in the pack/,
    "as is the 363 group matrices a radius cannot be scaled by");

  if (!REAL_PROPS) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  // ► **TWO GLOWS, ON TWO TEXT FIELDS, ON ONE PROP — AND NO RENDERER CAN DRAW
  //   THEM FROM THIS PACK.** Characters 1527 and 1528 are `DefineEditText`
  //   fields on `panel`; the extractor drops a drawable it cannot turn into
  //   paths and drops their filters with them, so there is no shape for a glow
  //   to sit on. Every count in `propInvoiceFor` is honestly zero about them,
  //   which is exactly why the bar must not be logged as complete.
  const unreachable = propEffectsUnreachable(REAL_PROPS);
  assert.equal(unreachable.props, 1, "one prop lost something");
  assert.equal(unreachable.placements, 2, "two text fields");
  assert.equal(unreachable.filters, 2);
  assert.deepEqual(unreachable.byType, { glow: 2 }, "both of them glows");
  // And the denominator that says this is not everything the pack lost: the
  // bar's own four plate operations are all still there.
  const panel = arenaScreenLayersFor(REAL_PROPS, propOpsFor, null, SS2_ARENA_DRESSING)
    .find((layer) => layer.prop === "panel");
  assert.equal(panel.ops.length, 4, "the plate is drawn; it is the WORDS' glows that are not");
  assert.equal(panel.ops.filter((op) => op.group).length, 0, "and no group reaches the bar at all");
});

/**
 * A RECORDING 2D CONTEXT, so the DOM-touching half of the compositor can be run
 * in node as well.
 *
 * ► **EVERYTHING ABOVE THIS POINT TESTS FUNCTIONS THAT TOUCH NOTHING, AND THE
 *   DEFECTS THIS FILE EXISTS FOR WERE NEVER IN THOSE.** `paintGroupRuns` is
 *   where the buffer is sized, the transform copied, the destination swapped
 *   and the composite issued — six live defects in three days came out of code
 *   shaped like that, and a text assertion cannot see any of it. So the shell's
 *   own `paintGroupRuns`, `groupBufferAt` and `groupCompositingAvailable` are
 *   lifted out with the pure helpers and run against a context that records
 *   what it was asked to do.
 *
 *   It tracks the TRANSFORM for real — a 2x3 matrix with a save/restore stack —
 *   because "is the buffer drawn at the same place the canvas would have drawn
 *   it" is the question, and a double that only counted calls could not answer
 *   it.
 */
function recordingContext(label, journal, strokes = []) {
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const compose = (outer, inner) => [
    outer[0] * inner[0] + outer[2] * inner[1], outer[1] * inner[0] + outer[3] * inner[1],
    outer[0] * inner[2] + outer[2] * inner[3], outer[1] * inner[2] + outer[3] * inner[3],
    outer[0] * inner[4] + outer[2] * inner[5] + outer[4], outer[1] * inner[4] + outer[3] * inner[5] + outer[5]
  ];
  const context = {
    label, filter: "none", globalAlpha: 1, globalCompositeOperation: "source-over",
    fillStyle: null, strokeStyle: null, lineWidth: 0, lineJoin: null,
    getTransform: () => ({ a: matrix[0], b: matrix[1], c: matrix[2], d: matrix[3], e: matrix[4], f: matrix[5] }),
    setTransform: (...args) => {
      if (args.length === 1) {
        const given = args[0];
        matrix = [given.a, given.b, given.c, given.d, given.e, given.f];
      } else {
        matrix = args.slice(0, 6);
      }
    },
    transform: (...args) => { matrix = compose(matrix, args); },
    translate: (x, y) => { matrix = compose(matrix, [1, 0, 0, 1, x, y]); },
    scale: (x, y) => { matrix = compose(matrix, [x, 0, 0, y, 0, 0]); },
    rotate: () => {},
    save: () => stack.push({
      matrix: matrix.slice(), filter: context.filter,
      alpha: context.globalAlpha, blend: context.globalCompositeOperation
    }),
    restore: () => {
      const saved = stack.pop();
      if (!saved) return;
      matrix = saved.matrix;
      context.filter = saved.filter;
      context.globalAlpha = saved.alpha;
      context.globalCompositeOperation = saved.blend;
    },
    clearRect: () => {},
    clip: () => {},
    fill: () => {},
    stroke: () => {},
    // ► **INTO `strokes`, NEVER INTO `journal`.** `journal` is the composite
    //   record every test above indexes by position, and a painter that moved
    //   a pen would otherwise shift `journal[0]` out from under them.
    beginPath: () => {},
    closePath: () => {},
    moveTo: (x, y) => strokes.push({ into: label, call: "moveTo", x, y, matrix: matrix.slice() }),
    lineTo: (x, y) => strokes.push({ into: label, call: "lineTo", x, y, matrix: matrix.slice() }),
    ellipse: (x, y, rx, ry) => strokes.push({ into: label, call: "ellipse", x, y, rx, ry, matrix: matrix.slice() }),
    drawImage: (image, ...args) => journal.push({
      into: label, from: image.label, args,
      matrix: matrix.slice(), filter: context.filter,
      blend: context.globalCompositeOperation, alpha: context.globalAlpha
    })
  };
  return context;
}

function recordingCanvas(label, journal, width, height, strokes) {
  const context = recordingContext(label, journal, strokes);
  let wide = width;
  let tall = height;
  return {
    label,
    getContext: () => context,
    get width() { return wide; },
    set width(value) { wide = value; },
    get height() { return tall; },
    set height(value) { tall = value; }
  };
}

/** The shell's compositor, wired to recording canvases. */
function compositorHarness({ width = 1280, height = 840, compositing = true } = {}) {
  const source = readShellSource();
  assert.ok(source, "tools/arena/main.js is tracked and must be readable");
  const { code } = codeOnly(source);
  const names = [
    "groupRunsOf", "pathBoxOf", "composedMatrix", "boxThrough", "filterBleedOf",
    "runBoxOf", "bufferRegionOf", "groupBufferAt", "groupCompositingAvailable", "paintGroupRuns",
    // ► **AND THE FIGURE'S OWN PAINTERS, BECAUSE `drawOps` IS WHERE THE
    //   ROUTING DECISION LIVES AND A TEXT ASSERTION CANNOT SEE IT.** Every
    //   defect this section exists over was in code shaped like `drawOps`: a
    //   transform applied in the wrong place, a buffer measured against the
    //   wrong CTM. Running the real function against a recording context is
    //   the only thing that can tell a hoisted transform from a deleted one.
    "path2dFor", "figureOriginMatrix", "opSpaceRunsOf", "figureRouteFor",
    "countFigureGroups", "drawFigureOperation", "drawAuthoredOperation", "drawOps"
  ];
  const parts = names.map((name) => {
    const part = shellFunctionSource(code, name);
    assert.ok(part, `${name} is declared in tools/arena/main.js as a plain function`);
    return part;
  });
  const journal = [];
  const strokes = [];
  const logLines = [];
  const offscreens = [];
  const canvas = recordingCanvas("destination", journal, width, height, strokes);
  const groupPaint = {
    ops: 0, groupedOps: 0, runs: 0, groups: 0, buffers: 0, bufferedOps: 0, direct: 0,
    inert: 0, offscreen: 0, groupsSplit: 0, groupsNested: 0, groupsBlendRefused: 0,
    boxUnknown: 0, boxClamped: 0, filterAtStageScale: 0, notComposited: 0
  };
  // `context` and `groupDepth` are REASSIGNED by `paintGroupRuns`, so they have
  // to be `let` in the scope the lifted bodies close over — which is what makes
  // this a test of the shell's rebinding rather than of a copy of it.
  // ► **THE KEYS COME OUT OF THE SHELL'S OWN LITERAL, NOT OUT OF A COPY HERE.**
  //   This used to be a hand-written duplicate, and it drifted the moment
  //   `buffered`/`bufferedOps` were renamed to `plannedBuffers`/
  //   `plannedBufferOps` in the shell: `countFigureGroups` then did
  //   `undefined += n` and the tally came back `NaN`, which is a silent wrong
  //   number rather than a failure. A second copy of a key list is a second
  //   thing to get wrong — so the list is READ, and `shellTallyKeys` fails by
  //   name if the literal ever stops being readable.
  const figureGroupPaint = Object.fromEntries(
    shellTallyKeys("figureGroupPaint").map((key) => [key, 0]));
  const built = new Function(
    "destinationContext", "canvas", "document", "log", "groupPaint", "GROUP_COMPOSITING",
    "figureGroupPaint", "Path2D",
    `let context = destinationContext;
     let groupDepth = 0;
     let groupCompositingAnswer = null;
     const groupBuffers = [];
     const pathCache = new Map();
     ${parts.join("\n")}
     return {
       paintGroupRuns,
       drawOps,
       figureOriginMatrix,
       contextLabel: () => context.label,
       currentTransform: () => context.getTransform(),
       depth: () => groupDepth
     };`
  )(
    canvas.getContext("2d"),
    canvas,
    {
      createElement: () => {
        const made = recordingCanvas(`buffer${offscreens.length}`, journal, 1, 1, strokes);
        offscreens.push(made);
        return made;
      }
    },
    (message) => logLines.push(message),
    groupPaint,
    compositing,
    figureGroupPaint,
    // `Path2D` does not exist in node. The shell only ever hands the object
    // back to `ctx.fill`/`ctx.stroke`, which the recorder ignores, so the `d`
    // it was built from is all this has to carry.
    class { constructor(d) { this.d = d; } }
  );
  return { ...built, canvas, context: canvas.getContext("2d"), journal, strokes, logLines, groupPaint,
    figureGroupPaint, offscreens };
}

test("a buffered run is drawn into an OFFSCREEN, at the same device place the canvas would have", () => {
  const harness = compositorHarness();
  const blurred = groupRecord({ id: 1, character: 9, filter: "blur(4px)" });
  const blended = groupRecord({ id: 2, character: 8, composite: "lighten" });
  const square = "M0 0L100 0L100 100L0 100Z";
  const ops = [
    { d: square, matrix: [1, 0, 0, 1, 0, 0], strokeWidth: 0 },
    { d: square, matrix: [1, 0, 0, 1, 4000, 2000], strokeWidth: 0, group: blurred },
    { d: square, matrix: [1, 0, 0, 1, 5200, 2000], strokeWidth: 0, group: blurred },
    { d: square, matrix: [1, 0, 0, 1, 12000, 8000], strokeWidth: 0, group: blended }
  ];

  // The transform `paintArenaLayer` would be holding: the stage fit, then the
  // layer's placement.
  harness.context.setTransform(1, 0, 0, 1, 0, 0);
  harness.context.translate(10, 20);
  harness.context.scale(2, 2);

  const drawn = [];
  harness.paintGroupRuns(ops, { translationDivisor: 20, filtersScaled: true }, () => {
    drawn.push({ into: harness.contextLabel(), depth: harness.depth() });
  });

  // ► **THE UNGROUPED OPERATION GOES ON THE CANVAS AND THE GROUPED ONES DO
  //   NOT.** If this ever reads `["destination", "destination", ...]` the
  //   buffers are being made and thrown away, and the picture is the one that
  //   was there before any of this existed.
  assert.deepEqual(drawn.map((entry) => entry.into),
    ["destination", "buffer0", "buffer0", "buffer0"]);
  assert.deepEqual(drawn.map((entry) => entry.depth), [0, 1, 1, 1],
    "the depth is raised while a buffer is being filled, so a nested run could not reuse it");
  assert.equal(harness.contextLabel(), "destination",
    "and the destination is restored when the last run is done");

  // ► **TWO COMPOSITES, EACH AT THE IDENTITY TRANSFORM.** The blur's region is
  //   the two squares' device box (410,220)-(730,420) grown by
  //   `filterBleedOf("blur(4px)")` = 16 on every side; the blend's carries no
  //   bleed at all and is clipped by the right and bottom edges of the canvas.
  assert.equal(harness.journal.length, 2, "one drawImage per buffered run, and not one per operation");
  const [blurComposite, blendComposite] = harness.journal;
  assert.deepEqual(blurComposite.matrix, [1, 0, 0, 1, 0, 0],
    "the buffer goes back at the IDENTITY transform, not under the layer's");
  assert.equal(blurComposite.filter, "blur(4px)");
  assert.equal(blurComposite.blend, "source-over", "a filter is not a blend mode");
  assert.equal(blurComposite.alpha, 1);
  assert.deepEqual(blurComposite.args, [0, 0, 352, 232, 394, 204, 352, 232],
    "the whole buffer, back at the region it was measured from");
  assert.equal(blendComposite.filter, "none", "this group has nothing to filter");
  assert.equal(blendComposite.blend, "lighten", "and canvas's name for SWF blend mode 5");
  assert.deepEqual(blendComposite.args, [0, 0, 70, 20, 1210, 820, 70, 20],
    "clipped by the canvas's right and bottom edges");

  assert.equal(harness.groupPaint.buffers, 2);
  assert.equal(harness.groupPaint.bufferedOps, 3);
  assert.equal(harness.groupPaint.direct, 1);
  assert.equal(harness.groupPaint.boxClamped, 1, "one of the two regions ran off the canvas");
  assert.equal(harness.groupPaint.filterAtStageScale, 0, "the caller said the radii were scaled");
});

test("the buffer's transform is the destination's, shifted by the region — or the run lands nowhere", () => {
  // ► **THIS IS THE DEFECT A SCREENSHOT WOULD SHOW AS AN EMPTY LAYER.** The
  //   operations are drawn into a buffer whose origin is the region's top-left,
  //   so the buffer's transform has to be the destination's with that origin
  //   subtracted. Get it wrong and the geometry is drawn off the edge of a
  //   correctly-sized buffer, and a correctly-placed empty rectangle is
  //   composited over the canvas.
  const harness = compositorHarness();
  const group = groupRecord({ id: 1, filter: "blur(4px)" });
  const ops = [{ d: "M0 0L100 0L100 100L0 100Z", matrix: [1, 0, 0, 1, 4000, 2000], strokeWidth: 0, group }];
  harness.context.setTransform(1, 0, 0, 1, 0, 0);
  harness.context.translate(10, 20);
  harness.context.scale(2, 2);
  const outer = harness.context.getTransform();

  let inside = null;
  harness.paintGroupRuns(ops, { translationDivisor: 20, filtersScaled: true }, () => {
    // The transform the BUFFER is holding at the moment an operation is drawn
    // into it — read off the same context `paintPropOperation` would be using.
    const held = harness.currentTransform();
    inside = [held.a, held.b, held.c, held.d, held.e, held.f];
  });
  const region = harness.journal[0].args;

  // ► **AND THE OFFSCREEN IS ACTUALLY THE REGION'S SIZE**, which mutation M28
  //   showed nothing was checking: with the resize deleted, `groupBufferAt`
  //   handed back the 1x1 canvas `document.createElement` makes and every
  //   buffered run was clipped to a single pixel — composited at the right
  //   place, at the right size, holding nothing. The whole suite stayed green.
  assert.equal(harness.offscreens.length, 1, "one offscreen, reused");
  assert.equal(harness.offscreens[0].width, region[2], "sized to the region's width");
  assert.equal(harness.offscreens[0].height, region[3], "and to its height");

  assert.deepEqual(inside.slice(0, 4), [outer.a, outer.b, outer.c, outer.d],
    "the scale and rotation are the destination's, untouched");
  assert.deepEqual([inside[4], inside[5]], [outer.e - region[4], outer.f - region[5]],
    "and the translation is the destination's minus the region's origin");

  // The op's own device position inside the buffer, worked out end to end: the
  // square's top-left is at (410,220) on the canvas and the region starts at
  // (394,204), so it must land at (16,16) in the buffer — the bleed, exactly.
  const placed = COMPOSITOR.composedMatrix(inside, [1, 0, 0, 1, 4000 / 20, 2000 / 20]);
  assert.deepEqual([placed[4], placed[5]], [16, 16],
    "which puts the geometry one bleed in from the buffer's edge on every side");
});

test("?groups=0 draws every operation straight onto the canvas, and COUNTS what it skipped", () => {
  // ► **THE ESCAPE HATCH HAS TO BE THE OLD PICTURE EXACTLY**, or the pair of
  //   screenshots it exists for compares two new things. No buffer is made, no
  //   filter is set, every operation reaches the destination.
  const harness = compositorHarness({ compositing: false });
  const group = groupRecord({ id: 1, filter: "blur(4px)", composite: "lighten" });
  const ops = [
    { d: "M0 0L10 0L10 10L0 10Z", matrix: [1, 0, 0, 1, 0, 0], strokeWidth: 0, group },
    { d: "M0 0L10 0L10 10L0 10Z", matrix: [1, 0, 0, 1, 0, 0], strokeWidth: 0, group }
  ];
  const drawn = [];
  harness.paintGroupRuns(ops, { translationDivisor: 20, filtersScaled: true }, () => {
    drawn.push(harness.contextLabel());
  });
  assert.deepEqual(drawn, ["destination", "destination"]);
  assert.equal(harness.journal.length, 0, "nothing was composited");
  assert.equal(harness.groupPaint.buffers, 0);
  assert.equal(harness.groupPaint.notComposited, 2, "and the two operations it skipped are counted");
  assert.deepEqual(harness.logLines, [
    "groups: ?groups=0 — filters and blends are NOT drawn, on purpose."
  ], "said once, in the panel a screenshot catches");
});

test("an unmeasurable run falls back to the WHOLE canvas rather than a plausible box", () => {
  // ► **`runBoxOf` RETURNS NULL AND THE PAINTER MUST NOT GUESS.** A path whose
  //   coordinates cannot be read as pairs is what a command letter this
  //   extractor has never emitted would look like; the safe answer is slow, and
  //   the unsafe one is a layer clipped to a rectangle nobody chose.
  const harness = compositorHarness({ width: 400, height: 300 });
  const group = groupRecord({ id: 1, filter: "blur(1px)" });
  const ops = [{ d: "M0 0A50 50 0 0 1 10 10", matrix: [1, 0, 0, 1, 0, 0], strokeWidth: 0, group }];
  harness.paintGroupRuns(ops, { translationDivisor: 20, filtersScaled: true }, () => {});
  assert.equal(harness.groupPaint.boxUnknown, 1, "and it says it could not measure the run");
  assert.deepEqual(harness.journal[0].args, [0, 0, 400, 300, 0, 0, 400, 300],
    "so the buffer is the whole surface");
  assert.equal(harness.groupPaint.boxClamped, 0, "an unmeasurable run is not a clamped one");
});

test("a run entirely off the canvas is SKIPPED, and the skip is counted rather than silent", () => {
  const harness = compositorHarness({ width: 400, height: 300 });
  const group = groupRecord({ id: 1, composite: "lighten" });
  const ops = [{ d: "M0 0L10 0L10 10L0 10Z", matrix: [1, 0, 0, 1, -20000, -20000], strokeWidth: 0, group }];
  let drew = 0;
  harness.paintGroupRuns(ops, { translationDivisor: 20, filtersScaled: true }, () => { drew += 1; });
  assert.equal(drew, 0, "nothing is drawn for a run nobody can see");
  assert.equal(harness.journal.length, 0, "and nothing is composited");
  assert.equal(harness.groupPaint.offscreen, 1, "counted, because this is the one branch that draws NOTHING");
  assert.equal(harness.groupPaint.buffers, 0);
});

test("a filter that reached paintProp's route at scale 1 is COUNTED, because the camera would be in it", () => {
  // ► **THE ONE THING THAT WOULD MAKE EVERY BLUR ON A PROP THE WRONG WIDTH.**
  //   `arrowOpsFor`, `arrowTrailOpsFor`, `arenaSceneryFor` and `drawDrops` all
  //   call `propOpsFor` inside `props.js` with no scale, while `paintProp` draws
  //   at `size * view.scale` and `view.scale` carries the camera's zoom. No
  //   group on that route carries a filter in this build — `bullet_trail`'s has
  //   a blend mode and nothing else — so the counter is 0, and it exists so
  //   that a pack where that changes is loud instead of soft-edged.
  const harness = compositorHarness();
  const filtered = groupRecord({ id: 1, filter: "blur(4px)" });
  const blended = groupRecord({ id: 2, composite: "lighten" });
  const ops = [
    { d: "M0 0L10 0L10 10L0 10Z", matrix: [1, 0, 0, 1, 100, 100], strokeWidth: 0, group: filtered },
    { d: "M0 0L10 0L10 10L0 10Z", matrix: [1, 0, 0, 1, 100, 100], strokeWidth: 0, group: blended }
  ];
  harness.paintGroupRuns(ops, { translationDivisor: 1, filtersScaled: false }, () => {});
  assert.equal(harness.groupPaint.filterAtStageScale, 1,
    "the filtered operation is counted; the blended one has no length to get wrong");
  assert.equal(harness.groupPaint.buffers, 2, "both are still composited, at whatever radius they carry");
});

/* ------------------------------------------------------------------ */
/* THE FIGURE'S OWN GROUPS                                             */
/* ------------------------------------------------------------------ */

/**
 * ► **THE FIGURE WAS THE ONE PAINTER IN THIS FILE THAT WAS NOT WIRED TO THE
 *   COMPOSITOR, AND NOTHING SAID SO.** `paintArenaLayer` and `paintProp` both
 *   route their operations through `paintGroupRuns`; `drawOps` — which draws
 *   the extracted rig, the face and the authored fallback — was a flat
 *   `for (const operation of ops)` loop until 2026-09-15. Every test above
 *   passed, because every one of them is about the props.
 *
 *   So an `op.group` arriving from `src/render/extracted-figure.js` would have
 *   been drawn per leaf: twelve enclosing glows, each applied to nothing,
 *   silently. The tests below are about the route the figure now takes, and the
 *   two numbers that would make it draw in the wrong place if they were wrong.
 */
const FIGURE = liftFromShell([
  "figureOriginMatrix", "opSpaceRunsOf", "figureRouteFor",
  "figureEffectCensusOf", "enchantmentCensusOf", "enchantDemoFrom"
]);

/** The player's own extracted rig, or null on a clone with no licensed copy. */
function readRealFigure() {
  const shapesAt = path.join(REPO_ROOT, "assets/figure/shapes.json");
  const animationsAt = path.join(REPO_ROOT, "assets/figure/animations.json");
  if (!fs.existsSync(shapesAt) || !fs.existsSync(animationsAt)) return null;
  const animations = JSON.parse(fs.readFileSync(animationsAt, "utf8"));
  const pack = figurePackFrom(JSON.parse(fs.readFileSync(shapesAt, "utf8")), animations);
  return { pack, animations };
}

const REAL_FIGURE = readRealFigure();

/** The player's own enchantment ladder, or null. */
function readRealEnchantments() {
  const at = path.join(REPO_ROOT, "assets/figure/enchantments.json");
  return fs.existsSync(at) ? JSON.parse(fs.readFileSync(at, "utf8")) : null;
}

const REAL_ENCHANTMENTS = readRealEnchantments();

/** A standing gladiator's operations, as the shell asks for them. */
function realFigureOps() {
  // ► **`height` IS 1 — NOT 150.** The `?seam=1` probe in the shell passes 150
  //   and is a probe; the draw path passes NO height since 2026-09-23 (the
  //   build's 1:1 — until then it passed `figure.build.height`, the authored
  //   vitality multiplier, `0.92 + vitality/20 * 0.16`). Writing 150
  //   here scales every matrix by 150 and puts the whole figure off the canvas,
  //   which is how this test was first written and is worth naming.
  return paintExtractedFigure(REAL_FIGURE.pack, {
    family: "standing", label: "Standing", facing: "right", at: 0,
    height: 1, loadout: { weapon: 1, equipped_weapon: 1 }
  });
}

test("the rig's effect-group census is re-derived from the pack, not asserted", () => {
  if (!REAL_FIGURE) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_FIGURE, null, "no extraction on this machine");
    return;
  }
  const census = FIGURE.figureEffectCensusOf(REAL_FIGURE.animations);

  // ► **THE FOUR LABELS, AND THEY ARE THE PSYCHE-UP CLIPS.** `psyche_up2` is
  //   the only one that TWEENS — nine frames, nine distinct outer-glow payloads
  //   — which is why it alone carries nine group-table entries while the other
  //   three carry one each.
  assert.deepEqual(census.labels.slice().sort(),
    ["psyche_charging", "psyche_charging2", "psyche_up", "psyche_up2"],
    "only the psyche-up clips carry an effect group in this build");
  assert.equal(census.groups, 12, "twelve group-table entries");
  assert.equal(census.effectedPlacements, 30, "over thirty placements that name one");
  assert.equal(census.withEffects, 4);
  assert.equal(census.animations, 101, "out of a hundred and one animations");

  // ► **THE DENOMINATOR THAT MAKES THE ZEROS READABLE.** A placement's OWN
  //   filter list and blend mode are a DIFFERENT thing from its enclosing
  //   group's, and this painter has nowhere to put either. Both are zero here,
  //   over 37,077 placements — so `drawFigureOperation` dropping them is a
  //   loss of nothing on this build, and a pack where that changes makes this
  //   go red instead of drawing flat.
  assert.equal(census.placements, 37077);
  assert.equal(census.ownFilters, 0, "0 of 37,077 placements carry their own filter");
  assert.equal(census.ownBlendModes, 0, "0 of 37,077 carry their own blend mode");

  // And the count could not have come out of an empty walk.
  assert.ok(census.placements > census.effectedPlacements * 100,
    "the effected placements are a tiny fraction of the pack, which is what makes 30 a finding");
});

test("the census is total, because a malformed pack must not stop the arena being drawn", () => {
  for (const nothing of [null, undefined, 7, "x", []]) {
    const census = FIGURE.figureEffectCensusOf(nothing);
    assert.equal(census.groups, 0);
    assert.deepEqual(census.labels, []);
  }
  // An animation with a group table and no poses still counts its groups; one
  // with effects and no table still counts its placements. The two halves are
  // read separately on purpose — a pack that lost one would otherwise look
  // like a pack that never had either.
  const table = FIGURE.figureEffectCensusOf({ a: { effectGroups: [{}, {}], poses: null } });
  assert.deepEqual([table.groups, table.effectedPlacements, table.withEffects], [2, 0, 1]);
  const placed = FIGURE.figureEffectCensusOf({ a: { poses: [[{ effects: [0] }, { effects: [] }, null]] } });
  assert.deepEqual([placed.groups, placed.effectedPlacements, placed.placements, placed.withEffects], [0, 1, 2, 1]);

  // ► **THE TWO OWN-EFFECT COUNTERS WERE ONLY EVER EXERCISED AT ZERO, AND FOUR
  //   MUTANTS SURVIVED BECAUSE OF IT.** The real pack has 0 of 37,077
  //   placements carrying their own `filters` or `blendMode`, and every
  //   synthetic input above omits both — so deleting `census.ownFilters += 1`
  //   outright, deleting `census.ownBlendModes += 1`, dropping the
  //   `.length > 0` guard, and swapping the blend-mode presence test for a
  //   truthiness test (which loses a real blend id of 0) ALL left the suite
  //   green. The census's own comment claims a pack where that changes "makes
  //   this go red instead of drawing flat", which is true only if the counters
  //   work, and nothing tested that they work.
  //
  //   This is the same hazard `tools/extract-figure.mjs`'s own test header
  //   names — "`own 0` and `dropped 0` cannot fail for any input in this
  //   build" — solved the same way: give the counter an input it must count.
  //   **Note `blendMode: 0` is deliberate: it is a REAL blend id and a
  //   truthiness test drops it.**
  const owned = FIGURE.figureEffectCensusOf({
    a: { poses: [[{ filters: [{ type: "glow" }], blendMode: 3 }, { filters: [], blendMode: 0 }, {}]] }
  });
  assert.equal(owned.ownFilters, 1, "an EMPTY own filter list is not an own filter");
  assert.equal(owned.ownBlendModes, 2, "but blend mode 0 IS a blend mode");
});

test("the enchantment ladder is reported from the PACK'S OWN invoice, and is absent-safe", () => {
  for (const nothing of [null, undefined, {}, { invoice: 3 }]) {
    const empty = FIGURE.enchantmentCensusOf(nothing);
    assert.equal(empty.cells, 0);
    assert.deepEqual(empty.names, []);
  }
  if (!REAL_ENCHANTMENTS) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_ENCHANTMENTS, null, "no extraction on this machine");
    return;
  }
  const ladder = FIGURE.enchantmentCensusOf(REAL_ENCHANTMENTS);
  // ► **TWELVE CELLS, AND THIRTEEN FRAMES.** Frame 1 is the bare weapon — the
  //   `enchant_type < 2` case — so the art has one more frame than the ladder
  //   has cells, and a reader who saw only "12" beside "12" could not tell
  //   which. `4 x 3` is the other half of the same statement.
  assert.equal(ladder.cells, 12);
  assert.equal(ladder.types, 4);
  assert.equal(ladder.potencies, 3);
  assert.equal(ladder.types * ladder.potencies, ladder.cells, "the ladder is the full product");
  assert.equal(ladder.frames, 13, "twelve cells plus the bare frame");
  assert.equal(ladder.framesWithAGlow, 12);
  assert.equal(ladder.frames - ladder.framesWithAGlow, 1, "and exactly one frame is bare");
  assert.deepEqual(ladder.names, ["Flame", "Frost", "Poison", "Wraith"]);
  assert.ok(ladder.filters >= ladder.groups, "a group carries at least one filter");
});

test("operations are partitioned by SPACE, because the two halves of drawOps disagree about it", () => {
  // ► **A `path` OPERATION IS IN THE FIGURE'S OWN SPACE AND EVERYTHING ELSE IS
  //   IN CANVAS PIXELS.** `paintFigure`'s polygons and `paintShadow`'s ellipse
  //   call `view.toX`/`view.toY` for themselves; putting `figureOriginMatrix`
  //   on the context for those would apply the figure's placement twice.
  assert.deepEqual(FIGURE.opSpaceRunsOf([]), []);
  assert.deepEqual(FIGURE.opSpaceRunsOf(null), []);
  assert.deepEqual(FIGURE.opSpaceRunsOf([{ kind: "path" }, { kind: "path" }]),
    [{ space: "figure", from: 0, to: 2 }], "adjacent paths are ONE run, or every leaf is its own group");
  assert.deepEqual(FIGURE.opSpaceRunsOf([{ kind: "ellipse" }, { kind: "path" }, { kind: "polygon" }]), [
    { space: "canvas", from: 0, to: 1 },
    { space: "figure", from: 1, to: 2 },
    { space: "canvas", from: 2, to: 3 }
  ]);
  assert.deepEqual(FIGURE.opSpaceRunsOf([null, undefined]), [{ space: "canvas", from: 0, to: 2 }],
    "a malformed operation is canvas-space, which draws nothing rather than mis-transforming");
});

test("every real draw call is ONE run, so the partition costs nothing on this build", () => {
  if (!REAL_FIGURE) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_FIGURE, null, "no extraction on this machine");
    return;
  }
  const extracted = realFigureOps();
  assert.ok(extracted.length > 0, "the standing rig draws something, or every assertion below is vacuous");
  assert.deepEqual(FIGURE.opSpaceRunsOf(extracted), [{ space: "figure", from: 0, to: extracted.length }],
    "the extracted rig is all paths");

  // The authored fallback, from the same painter the shell falls back to.
  const figure = figureSpecFor({ id: "x", name: "X", resources: {} }, { side: "hero" });
  const pose = poseAt(timelineFor({ family: "standing", label: null }), 0);
  const authored = paintFigure(figure, pose);
  const shadow = paintShadow(figure, pose);
  assert.ok(authored.length > 0 && shadow.length > 0);
  assert.deepEqual(FIGURE.opSpaceRunsOf(authored), [{ space: "canvas", from: 0, to: authored.length }],
    "the authored figure is all polygons and circles");
  assert.deepEqual(FIGURE.opSpaceRunsOf(shadow), [{ space: "canvas", from: 0, to: shadow.length }]);
});

test("the hoisted origin transform is the OLD per-operation one, exactly", () => {
  // ► **THE HOIST IS THE WHOLE CHANGE TO `drawOps`, SO IT IS MEASURED RATHER
  //   THAN ARGUED.** The old body did `translate` then `scale` then `transform`
  //   inside each operation's own `save()`. The new one does `transform(the
  //   origin matrix)` once, outside, and each operation does `transform(its own
  //   matrix)`. These two sequences are run against the same recording context
  //   and the resulting matrices compared — if they ever differ, every figure
  //   on the page is drawn somewhere else.
  const journal = [];
  const view = { scale: 2, toX: (x) => 640 + x * 2, toY: (y, lift) => 500 - (200 - y) * 2 * 1.7 - lift * 2 };
  const placement = [0.7, 0.1, -0.2, 0.7, -11.5, 53.7];

  for (const origin of [
    { x: 120, y: 200, facing: "right", size: 1 },
    { x: -40, y: 103, facing: "left", size: 0.74 },
    { x: 0, y: 200, facing: "right" }
  ]) {
    const size = origin.size ?? 1;
    const flip = origin.facing === "left" ? -1 : 1;
    const k = size * view.scale;

    const before = recordingContext("before", journal);
    before.save();
    before.translate(view.toX(origin.x), view.toY(origin.y, 0));
    before.scale(k * flip, -k);
    before.transform(...placement);
    const wasAt = before.getTransform();

    const after = recordingContext("after", journal);
    const m = FIGURE.figureOriginMatrix(view, origin);
    after.save();
    after.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    after.save();
    after.transform(...placement);
    const isAt = after.getTransform();

    assert.deepEqual(
      [isAt.a, isAt.b, isAt.c, isAt.d, isAt.e, isAt.f],
      [wasAt.a, wasAt.b, wasAt.c, wasAt.d, wasAt.e, wasAt.f],
      `${origin.facing} at size ${size} draws in the same place as it did before the hoist`);
  }

  // And the matrix itself, so a reader can see what it is: scale, y flip, mirror.
  assert.deepEqual(FIGURE.figureOriginMatrix(view, { x: 120, y: 200, facing: "right", size: 1 }),
    [2, 0, 0, -2, 880, 500], "arena y is UP and canvas y is DOWN, which is the negative d");
  assert.deepEqual(FIGURE.figureOriginMatrix(view, { x: 120, y: 200, facing: "left", size: 1 }),
    [-2, 0, 0, -2, 880, 500], "facing left mirrors x and nothing else");
});

test("the figure's route divides no twips, and filtersScaled is a COUNTER rather than a picture", () => {
  // ► **`filtersScaled` FLIPPED TO `true` ON 2026-09-16, on the condition its
  //   own comment set.** It was `false` because nothing in this repository
  //   could observe a figure filter string, so `true` would have been an
  //   assertion no test could go red on. The charged stance made one
  //   observable — a gladiator holding a psych-up charge rests in
  //   `psyche_charging`, which carries the cyan glow — and the radius was then
  //   measured at three scales and is linear. See `test/render-stance.test.js`.
  assert.deepEqual(FIGURE.figureRouteFor(), { translationDivisor: 1, filtersScaled: true });

  // ► **WHAT `filtersScaled` ACTUALLY DOES, MEASURED — BECAUSE THE FLIP IS ONLY
  //   SAFE IF THIS IS TRUE.** The route's flag is read in exactly one place,
  //   `groupPaint.filterAtStageScale += ...`, so it moves an honesty counter and
  //   nothing else. Neither value changes a pixel: the same buffer, the same
  //   region, the same filter string, the same composite.
  //
  //   If this ever goes red, `filtersScaled` has grown teeth and the comment on
  //   `figureRouteFor` is wrong about the cost of getting it backwards — which
  //   would matter more now that the flag is no longer the conservative one.
  const group = groupRecord({ id: 0, filter: "drop-shadow(0px 0px 10px #000066)" });
  const ops = [{ kind: "path", d: "M0 0L40 0L40 40L0 40Z", matrix: [1, 0, 0, 1, 200, 200], strokeWidth: 0, group }];
  const shots = {};
  for (const filtersScaled of [false, true]) {
    const harness = compositorHarness({ width: 1280, height: 840 });
    harness.paintGroupRuns(ops, { translationDivisor: 1, filtersScaled }, () => {});
    shots[String(filtersScaled)] = {
      journal: harness.journal.map((entry) => ({ args: entry.args, filter: entry.filter, blend: entry.blend })),
      counted: harness.groupPaint.filterAtStageScale
    };
  }
  assert.deepEqual(shots.true.journal, shots.false.journal,
    "the flag composites the SAME buffer at the SAME place with the SAME filter string");
  assert.equal(shots.false.counted, 1, "and all it moves is the honesty counter");
  assert.equal(shots.true.counted, 0);
});

test("a real weapon glow is composited AT THE WEAPON, which the identity transform would not be", () => {
  if (!REAL_FIGURE) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_FIGURE, null, "no extraction on this machine");
    return;
  }
  // ► **THIS IS THE DEFECT THE HOIST EXISTS FOR, MEASURED ON THE REAL RIG.**
  //   `runBoxOf` measures a run against `context.getTransform()`. With the
  //   figure's placement applied per operation — where it used to be — the CTM
  //   during `paintGroupRuns` is whatever the canvas already held, and the
  //   weapon's box comes out in the figure's LOCAL units: x -26..-7, y 47..56,
  //   which is a 28x78 sliver against the canvas's left edge. The glow would
  //   have been composited there, ~850 pixels from the weapon.
  const weapon = realFigureOps().filter((operation) => operation.limb === "weapon");
  assert.ok(weapon.length > 0, "the rig has a weapon limb, or this test measures nothing");

  const view = { scale: 2, toX: (x) => 640 + x * 2, toY: (y, lift) => 500 - (200 - y) * 2 * 1.7 - lift * 2 };
  const origin = { x: 120, y: 200, facing: "right", size: 1 };
  const m = FIGURE.figureOriginMatrix(view, origin);
  // H3's inner glow, as `canvasFilterFor` emits one.
  const group = groupRecord({ id: 0, character: 1195, filter: "drop-shadow(0px 0px 10px #000066)" });
  const ops = weapon.map((operation) => ({ ...operation, group }));

  const regions = {};
  for (const [label, ctm] of [["hoisted", m], ["identity", [1, 0, 0, 1, 0, 0]]]) {
    const harness = compositorHarness({ width: 1280, height: 840 });
    harness.context.setTransform(...ctm);
    harness.paintGroupRuns(ops, FIGURE.figureRouteFor(), () => {});
    assert.equal(harness.journal.length, 1, `${label}: one drawImage per buffered run`);
    const args = harness.journal[0].args;
    regions[label] = { x: args[4], y: args[5], width: args[6], height: args[7] };
    assert.equal(harness.groupPaint.buffers, 1);
    assert.equal(harness.groupPaint.bufferedOps, weapon.length, "every weapon operation went into the buffer");
    // ► **THIS ASSERTED `weapon.length` UNTIL 2026-09-16**, because
    //   `figureRouteFor()` said `filtersScaled: false` — "the radius is not in
    //   device pixels", counted out loud. It says `true` now, on the condition
    //   its own comment set: the charged stance made a figure group observable
    //   and the radius was measured linear in `scale` at three values. So the
    //   honest count is ZERO approximations, and a regression to the old flag
    //   turns this red rather than quietly re-admitting one.
    assert.equal(harness.groupPaint.filterAtStageScale, 0,
      "the shell hands the painter its own scale, so no figure radius is approximated");
  }

  // Where the weapon actually IS on the canvas, worked out here with plain
  // arithmetic rather than through the shell's own helpers.
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const operation of weapon) {
    const numbers = operation.d.match(/[-+]?[0-9]*[.]?[0-9]+(?:[eE][-+]?[0-9]+)?/g).map(Number);
    const p = operation.matrix;
    for (let index = 0; index < numbers.length; index += 2) {
      const lx = numbers[index];
      const ly = numbers[index + 1];
      // the placement, then the figure's own space
      const fx = p[0] * lx + p[2] * ly + p[4];
      const fy = p[1] * lx + p[3] * ly + p[5];
      const dx = m[0] * fx + m[2] * fy + m[4];
      const dy = m[1] * fx + m[3] * fy + m[5];
      if (dx < minX) minX = dx;
      if (dx > maxX) maxX = dx;
      if (dy < minY) minY = dy;
      if (dy > maxY) maxY = dy;
    }
  }
  const hoisted = regions.hoisted;
  assert.ok(hoisted.x <= minX && hoisted.y <= minY
    && hoisted.x + hoisted.width >= maxX && hoisted.y + hoisted.height >= maxY,
  `the buffer [${hoisted.x},${hoisted.y},${hoisted.width},${hoisted.height}] must contain the weapon ` +
    `[${minX.toFixed(1)},${minY.toFixed(1)}]-[${maxX.toFixed(1)},${maxY.toFixed(1)}]`);
  assert.ok(hoisted.x > 700 && hoisted.x < 880,
    "and it is beside the gladiator, who stands at device x 880");

  // ► **AND THE OLD ARRANGEMENT PUTS IT SOMEWHERE ELSE ENTIRELY**, which is
  //   what makes the assertion above an assertion rather than a tautology.
  const stray = regions.identity;
  assert.ok(stray.x + stray.width < minX,
    `the un-hoisted buffer ends at ${stray.x + stray.width} and the weapon starts at ${minX.toFixed(1)}`);
  assert.notDeepEqual(stray, hoisted);
});

test("?groups=0 draws the figure's grouped operations straight, and counts what it skipped", () => {
  // The kill switch is the other half of the screenshot pair, and it has to
  // reach the figure now that the figure goes through the compositor.
  const harness = compositorHarness({ compositing: false });
  const group = groupRecord({ id: 0, filter: "drop-shadow(0px 0px 10px #000066)" });
  const ops = [
    { kind: "path", d: "M0 0L10 0L10 10L0 10Z", matrix: [1, 0, 0, 1, 0, 0], strokeWidth: 0, group },
    { kind: "path", d: "M0 0L10 0L10 10L0 10Z", matrix: [1, 0, 0, 1, 0, 0], strokeWidth: 0, group }
  ];
  const drawn = [];
  harness.paintGroupRuns(ops, FIGURE.figureRouteFor(), () => drawn.push(harness.contextLabel()));
  assert.deepEqual(drawn, ["destination", "destination"]);
  assert.equal(harness.journal.length, 0, "no offscreen, no composite");
  assert.equal(harness.groupPaint.notComposited, 2, "and the two it skipped are counted, not silent");
  assert.deepEqual(harness.logLines, ["groups: ?groups=0 — filters and blends are NOT drawn, on purpose."]);
});

test("?enchant= is parsed as a pair per SLOT, and an absent potency is not promoted to a cell", () => {
  assert.equal(FIGURE.enchantDemoFrom(params("")), null);
  assert.equal(FIGURE.enchantDemoFrom(params("enchant=")), null, "an empty value is no override");
  assert.equal(FIGURE.enchantDemoFrom(params("seed=7")), null);
  assert.equal(FIGURE.enchantDemoFrom(null), null, "and it never throws on a URL");

  // ► **BOTH SLOTS, BECAUSE THE BUILD READS THE EQUIPPED SLOT'S OWN PAIR FOR
  //   THE GLOW.** `itemglow(weapon, weapon_enchantment_type, ...)` in melee and
  //   `itemglow(weapon, secondary_weapon_enchantment_type, ...)` with a bow up.
  //   A two-part `?enchant=` sets them alike so a glow appears whatever is in
  //   hand; the four-part form sets them APART, which is the configuration
  //   where a renderer that reused `damagecharacter`'s rule — it gates the PROC
  //   on `weapon_enchantment_potency` whichever slot is equipped — draws the
  //   wrong cell.
  const both = FIGURE.enchantDemoFrom(params("enchant=3.2"));
  assert.equal(both.complete, true);
  assert.equal(both.text, "3.2");
  assert.deepEqual(both.fields, {
    weapon_enchantment_type: 3, weapon_enchantment_potency: 2,
    secondary_weapon_enchantment_type: 3, secondary_weapon_enchantment_potency: 2
  });

  const split = FIGURE.enchantDemoFrom(params("enchant=3.2.5.1"));
  assert.deepEqual(split.fields, {
    weapon_enchantment_type: 3, weapon_enchantment_potency: 2,
    secondary_weapon_enchantment_type: 5, secondary_weapon_enchantment_potency: 1
  });

  // ► **`?enchant=3` IS POTENCY 0, AND 0 IS THE BUILD'S UNWRITTEN NO-OP.** For
  //   a potency outside 1..3 `itemglow` calls `gotoAndStop` ZERO times and the
  //   clip keeps its current frame — there is no trailing default — so nothing
  //   glows. Defaulting it to 1 here would invent a measurement, and
  //   `complete` is what the log line warns on instead.
  const bare = FIGURE.enchantDemoFrom(params("enchant=3"));
  assert.equal(bare.complete, false);
  assert.equal(bare.fields.weapon_enchantment_potency, 0);
  assert.equal(bare.fields.secondary_weapon_enchantment_potency, 0);

  // A URL is not a config file: nonsense is zero, never a throw and never NaN.
  const junk = FIGURE.enchantDemoFrom(params("enchant=banana.x"));
  assert.deepEqual(junk.fields, {
    weapon_enchantment_type: 0, weapon_enchantment_potency: 0,
    secondary_weapon_enchantment_type: 0, secondary_weapon_enchantment_potency: 0
  });
  for (const value of Object.values(junk.fields)) assert.ok(Number.isFinite(value));
});

test("the shell loads the enchantment pack, routes the figure, and labels the demo as a demo", () => {
  const source = readShellSource();
  assert.ok(source, "tools/arena/main.js is tracked and must be readable");
  const { code } = codeOnly(source);

  // 1. The pack: optional, failing soft, and handed to the figure pack.
  assert.ok(code.includes('fetch("/assets/figure/enchantments.json").then((response) => '
    + '(response.ok ? response.json() : null)).catch(() => null)'),
  "the enchantment pack is fetched the way the wardrobe is — optional, and a 404 is not a failure");
  assert.ok(code.includes("figurePackFrom(shapes, animations, enchantments)"),
    "and it reaches the figure pack as its third argument");
  assert.match(code, /no enchantment pack — a weapon draws unglowed/,
    "a missing pack is ONE line and the picture that was there before");

  // 2. The route. `drawOps` was a flat loop; it is the compositor's now.
  const drawOps = shellFunctionSource(code, "drawOps");
  assert.ok(drawOps, "drawOps is declared");
  assert.ok(drawOps.includes("paintGroupRuns(slice, figureRouteFor(), drawFigureOperation)"),
    "the figure's operations go through the same compositor the props do");
  assert.ok(drawOps.includes("figureOriginMatrix(view, origin)") && drawOps.includes("context.transform("),
    "with the figure's own space ON the context, which is what runBoxOf measures against");
  assert.ok(drawOps.includes("} finally {"), "and the transform is restored in a finally");

  // ► **AND THE FACTOR THE FIGURE PAINTER CANNOT WORK OUT FOR ITSELF.** A
  //   group's blur radius is in the fighter clip's pixels; the painter knows
  //   clip-to-arena and this file knows arena-to-canvas, so neither half is the
  //   whole factor. The number handed over has to be the CTM's own scale, or
  //   the radius is right for a canvas nobody is looking at.
  assert.ok(code.includes("scale: (origin.size ?? 1) * view.scale"),
    "the figure painter is told how many canvas pixels an arena unit is");
  for (const origin of [{ x: 0, y: 200, facing: "right", size: 0.74 }, { x: 9, y: 103, facing: "left" }]) {
    const view = { scale: 3.75, toX: (x) => x, toY: (y) => y };
    assert.equal((origin.size ?? 1) * view.scale, Math.abs(FIGURE.figureOriginMatrix(view, origin)[3]),
      "and it is the SAME number the context is transformed by, not a second one that can drift");
  }
  assert.match(code, /seam: enchant melee=/, "the ?seam=1 probe prints both slots' pairs");
  assert.match(code, /FORCED by \?enchant=, not the engine's/,
    "and says when the pair it printed was the demo's rather than the engine's");

  // ► **AND THE PER-LEAF PICTURE IS REFUSED HERE TOO.** The same assertion the
  //   props' two painters carry: an operation-level `filter` or blend mode is
  //   the mistake this whole section exists to prevent, and the figure is the
  //   painter it would arrive at next.
  const painter = shellFunctionSource(code, "drawFigureOperation");
  assert.ok(painter, "drawFigureOperation is declared");
  assert.equal(countOf(painter, "filter"), 0, "drawFigureOperation sets no filter on an operation");
  assert.equal(countOf(painter, "globalCompositeOperation"), 0, "and no blend mode");

  // 3. The demo control says what it is, on the screenshot.
  assert.match(code, /DEMO OVERRIDE \?enchant=/, "the override announces itself in the log panel");
  assert.match(code, /THE ENGINE PRODUCED NONE OF IT — a screenshot of this is not evidence about a battle/,
    "and says why a picture of it must not be filed as an observation");
  assert.ok(code.includes("{ ...declared, ...ENCHANT_DEMO.fields }"),
    "the override goes on the LOADOUT, never on the wire projection the panels are copied from");

  // 4. The figure's own report, with denominators — `groupPaint`'s own rule.
  const report = shellFunctionSource(code, "reportFigureGroups");
  assert.ok(report, "reportFigureGroups is declared");
  assert.ok(report.includes("${figureGroupPaint.groupedOps}/${figureGroupPaint.ops}"),
    "grouped operations over TOTAL operations, so a zero can be told from a counter never reached");
  assert.ok(report.includes("figureEffects.groups") && report.includes("figureEffects.placements"),
    "and the pack's own census beside it, so a zero frame is explicable");
  assert.ok(report.includes("figureGroupPaint.ops === 0"),
    "it reports the ZERO — unlike reportGroupPaint, which returns early on it");
});

/** The device box of a list of operations, worked out here rather than lifted. */
function deviceBoxOf(ops, origin) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const operation of ops) {
    const numbers = operation.d.match(/[-+]?[0-9]*[.]?[0-9]+(?:[eE][-+]?[0-9]+)?/g).map(Number);
    const p = operation.matrix;
    for (let index = 0; index < numbers.length; index += 2) {
      const fx = p[0] * numbers[index] + p[2] * numbers[index + 1] + p[4];
      const fy = p[1] * numbers[index] + p[3] * numbers[index + 1] + p[5];
      const dx = origin[0] * fx + origin[2] * fy + origin[4];
      const dy = origin[1] * fx + origin[3] * fy + origin[5];
      if (dx < minX) minX = dx;
      if (dx > maxX) maxX = dx;
      if (dy < minY) minY = dy;
      if (dy > maxY) maxY = dy;
    }
  }
  return { minX, minY, maxX, maxY };
}

test("drawOps ITSELF composites a real weapon glow, and hands back the context it borrowed", () => {
  if (!REAL_FIGURE) {
    assertRealPackPathIsDerivable();
    assert.equal(REAL_FIGURE, null, "no extraction on this machine");
    return;
  }
  // ► **THE ROUTE, RUN RATHER THAN READ.** Everything above this tests
  //   `paintGroupRuns` with a transform the test put on the context itself.
  //   This runs the SHELL'S OWN `drawOps` — the function that decides which
  //   transform goes on, which operations go through the compositor and which
  //   do not — against the real rig. Deleting the hoist, dropping the
  //   `paintGroupRuns` call, or partitioning the wrong way all land here as a
  //   composite in the wrong place or no composite at all.
  const harness = compositorHarness({ width: 1280, height: 840 });
  const view = { scale: 2, toX: (x) => 640 + x * 2, toY: (y, lift) => 500 - (200 - y) * 2 * 1.7 - lift * 2 };
  const origin = { x: 120, y: 200, facing: "right", size: 1 };

  const all = realFigureOps();
  const group = groupRecord({ id: 0, character: 1195, filter: "drop-shadow(0px 0px 10px #000066)" });
  // The build's own arrangement: the glow is on the placement of `realweapon`,
  // so it encloses the attached weapon art and NOTHING else on the figure.
  const ops = all.map((operation) => (operation.limb === "weapon" ? { ...operation, group } : operation));
  const weapon = ops.filter((operation) => operation.group);
  assert.ok(weapon.length > 0 && weapon.length < ops.length,
    "some of the figure is glowing and some of it is not, or this measures one case");

  const before = harness.context.getTransform();
  harness.drawOps(ops, view, origin);
  const after = harness.context.getTransform();

  // ► **ONE COMPOSITE, NOT ONE PER LEAF.** Nine weapon paths under one group is
  //   one offscreen and one `drawImage`; nine of them is the per-leaf picture
  //   `src/render/screen.js` refuses, arrived at by accident.
  assert.equal(harness.journal.length, 1, "one drawImage for the whole group");
  assert.equal(harness.offscreens.length, 1, "and one offscreen");
  const [, , , , x, y, width, height] = harness.journal[0].args;
  assert.equal(harness.journal[0].filter, "drop-shadow(0px 0px 10px #000066)");
  assert.deepEqual(harness.journal[0].matrix, [1, 0, 0, 1, 0, 0],
    "composited at the identity, like every other group in this file");

  const box = deviceBoxOf(weapon, harness.figureOriginMatrix(view, origin));
  assert.ok(x <= box.minX && y <= box.minY && x + width >= box.maxX && y + height >= box.maxY,
    `the buffer [${x},${y},${width},${height}] must contain the weapon `
    + `[${box.minX.toFixed(1)},${box.minY.toFixed(1)}]-[${box.maxX.toFixed(1)},${box.maxY.toFixed(1)}]`);
  assert.ok(x > 700 && x < 880, "which is beside the gladiator standing at device x 880, not at the origin");

  // The figure's own invoice, from the real draw.
  assert.equal(harness.figureGroupPaint.figures, 1);
  assert.equal(harness.figureGroupPaint.ops, ops.length, "the denominator is every operation drawn");
  assert.equal(harness.figureGroupPaint.groupedOps, weapon.length);
  assert.equal(harness.figureGroupPaint.groups, 1);
  // ► **`plannedBuffers`, NOT `buffered` — the rename is a correction, not a
  //   tidy-up.** `groupRunsOf` derives `run.buffered` from the group RECORD and
  //   never consults `groupCompositingAvailable()`, so the old name reported
  //   buffers at `?groups=0` where the compositor opens none. `groupPaint.buffers`
  //   is the count of buffers actually made.
  assert.equal(harness.figureGroupPaint.plannedBuffers, 1);
  assert.equal(harness.figureGroupPaint.plannedBufferOps, weapon.length);
  assert.ok(harness.figureGroupPaint.direct > 0, "and the ungrouped body went straight onto the canvas");

  // ► **AND THE BORROWED CONTEXT IS GIVEN BACK.** `drawOps` puts the figure's
  //   space on the destination; the name plate, the arrows and the UI bar are
  //   drawn straight after it in canvas pixels.
  assert.deepEqual([after.a, after.b, after.c, after.d, after.e, after.f],
    [before.a, before.b, before.c, before.d, before.e, before.f]);
  assert.equal(harness.contextLabel(), "destination");
});

test("the authored fallback is drawn with NO figure transform, because it computes pixels itself", () => {
  // ► **THE OTHER HALF OF THE PARTITION, AND THE ONE THAT WOULD BREAK
  //   SILENTLY.** `paintFigure`'s polygons already went through `view.toX`, so
  //   leaving `figureOriginMatrix` on the context would apply the gladiator's
  //   position, size and facing to them a SECOND time. A clone with no
  //   extracted art draws nothing else — the whole page would be this bug.
  const harness = compositorHarness({ width: 1280, height: 840 });
  const view = { scale: 2, toX: (x) => 640 + x * 2, toY: (y, lift) => 500 - (200 - y) * 2 * 1.7 - lift * 2 };
  const origin = { x: 120, y: 200, facing: "right", size: 1 };
  const figure = figureSpecFor({ id: "x", name: "X", resources: {} }, { side: "hero" });
  const pose = poseAt(timelineFor({ family: "standing", label: null }), 0);

  harness.drawOps(paintFigure(figure, pose), view, origin);
  harness.drawOps(paintShadow(figure, pose), view, origin);

  assert.ok(harness.strokes.length > 0, "the authored figure drew something");
  for (const stroke of harness.strokes) {
    assert.equal(stroke.into, "destination", "straight onto the canvas — it carries no group");
    assert.deepEqual(stroke.matrix, [1, 0, 0, 1, 0, 0],
      "and at the transform the context already held, NOT under figureOriginMatrix");
  }
  // The ellipse of the shadow is at the gladiator's feet in canvas pixels,
  // which is what "it computes them itself" means.
  const shadow = harness.strokes.find((stroke) => stroke.call === "ellipse");
  assert.ok(shadow, "the shadow is an ellipse");
  assert.equal(shadow.x, view.toX(origin.x));
  assert.equal(harness.journal.length, 0, "nothing was composited, because nothing was grouped");
  assert.equal(harness.figureGroupPaint.figures, 0, "and the figure invoice never saw a figure-space run");
});

/* ------------------------------------------------------------------ */
/* THE FALLBACK'S SIZE — one geometry for both renderers (2026-09-23)  */
/* ------------------------------------------------------------------ */

/** The highest point of an AUTHORED figure, in arena units over its feet, before `size`. */
function authoredCrownOf(ops) {
  let top = -Infinity;
  for (const operation of ops) {
    if (operation.kind === "polygon") for (const [, y] of operation.points) top = Math.max(top, y);
    if (operation.kind === "circle") top = Math.max(top, operation.y + operation.r);
  }
  return top;
}

/** The same for an EXTRACTED figure's paths. */
function extractedCrownOf(ops) {
  let top = -Infinity;
  for (const op of ops) {
    const numbers = (op.d.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi) ?? []).map(Number);
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      top = Math.max(top, op.matrix[1] * numbers[index] + op.matrix[3] * numbers[index + 1] + op.matrix[5]);
    }
  }
  return top;
}

const RESTING = () => poseAt(timelineFor("Standing", { role: "actor" }), 0);

test("WITH NO PACK THE AUTHORED GLADIATOR STANDS AT THE BUILD'S HEIGHT, whatever his vitality", () => {
  // ► **ONE GEOMETRY FOR BOTH RENDERERS.** The arrow, the fireball, the bolt and
  //   the blood are placed in the build's own arena units — `_yscale * 2 + 30`,
  //   `_yscale * 1.5 + 5`, `_y` 50, the clip's `-220..-71` — which is the
  //   right place only on a figure the build's size. The build's gladiator is
  //   its `standing` clip, 222.65 pixels from sole to crown, drawn 1:1 into
  //   `arena.gladiators` and scaled by `_yscale` alone. So the authored
  //   fallback, which a fresh clone draws, stands that tall too: a bare
  //   strength-9 gladiator (`_yscale` 86) is 222.65 * 0.86 = 191.48 units.
  //   ~~150 units times a vitality multiplier (0.92-1.08)~~ until 2026-09-23 —
  //   124-128 units, with a snipe flying at 134 over his head.
  const size = figureScaleFor({ yscale: 86, rank: 0 });
  const crownAt = (vitality) => authoredCrownOf(paintFigure(
    figureSpecFor({ id: "x", name: "X", resources: {}, stats: { vitality } }, { side: "hero" }), RESTING()
  )) * size;
  for (const vitality of [0, 5, 20]) {
    assert.ok(Math.abs(crownAt(vitality) - 222.65 * 0.86) < 1,
      `vitality ${vitality}: the crown is ${crownAt(vitality).toFixed(2)}, the build's is ${(222.65 * 0.86).toFixed(2)}`);
  }

  // And against the extracted rig itself, where this machine has one: the two
  // renderers put a bare gladiator's crown in the same place at the same size.
  if (!REAL_FIGURE) return;
  const extracted = extractedCrownOf(paintExtractedFigure(REAL_FIGURE.pack, {
    family: "standing", label: "Standing", facing: "right", at: 0
  })) * size;
  assert.ok(Math.abs(crownAt(5) - extracted) < 3,
    `the fallback's crown (${crownAt(5).toFixed(2)}) is the extracted rig's (${extracted.toFixed(2)})`);
});

test("WITH NO PACK THE ARROW AND THE FIREBALL LEAVE AND LAND ON THE FALLBACK'S BODY, on the arena's own host", () => {
  // The arena's own host and roster, as `tools/arena/main.js` builds them, and
  // the flights as its `beginStep` builds them — the shooter's `yscale` from
  // the scene, the stop-short from the target's `physical_size`.
  const host = createVanillaBattleHost({
    teams: [
      demoSide("red", 1, { ss2Combatant, ss2BattleValues }),
      demoSide("blue", 1, { ss2Combatant, ss2BattleValues })
    ],
    rules: ss2TeamRules, bindings: SS2_STATIC_MAP_BINDINGS, seed: 7, awaitAnimations: true
  });
  const scene = applyCommands(emptyScene(), host.constructArena().commands);
  const byId = new Map(host.wire().teams.flatMap((team) => team.combatants).map((c) => [c.id, c]));
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const bodyOf = (id) => {
    const actor = scene.actors[id];
    const combatant = byId.get(id);
    const figure = figureSpecFor({ ...combatant, resources: {} }, { side: host.layout.placementFor(id).side });
    const size = figureScaleFor({ yscale: actor.yscale, rank: rankOfDepth(actor.y, combatant.slotIndex, view), slotIndex: combatant.slotIndex });
    return { actor, crown: authoredCrownOf(paintFigure(figure, RESTING())) * size };
  };
  const [shooterId, targetId] = scene.drawOrder;
  const shooter = bodyOf(shooterId);
  const target = bodyOf(targetId);
  assert.ok(shooter.actor.yscale > 0 && target.actor.yscale > 0, "the scene carries both fighters' `yscale`");
  const inside = (lift, body, what) => assert.ok(lift > 0 && lift < body.crown,
    `${what}: ${lift.toFixed(1)} must be on a body ${body.crown.toFixed(1)} tall`);

  const from = { x: shooter.actor.x, y: shooter.actor.y };
  const to = { x: target.actor.x, y: target.actor.y };
  const shooterYscale = shooter.actor.yscale;
  const snipe = projectileFlight({ kind: "snipe", from, to, sequence: 0, targetSize: 86, shooterYscale });
  inside(projectileDrawAt(snipe, 0, view).lift, shooter, "a snipe leaves from the shooter's shoulder");
  inside(projectileDrawAt(snipe, 1, view).lift, target, "and lands on the target");

  // ► **THE BOMBARD LEAVES JUST OVER THE CROWN, NOT INSIDE THE BODY — the
  //   build's own geometry.** `_yscale * 2 + 30` is 202 at 86, against a bare
  //   crown of 191.5: the lob is loosed from above the head, 5.5% of the
  //   figure over it. It LANDS inside the body at every velocity the build draws.
  for (let sequence = 0; sequence <= 10; sequence += 1) {
    const bombard = projectileFlight({ kind: "bombard", from, to, sequence, targetSize: 86, shooterYscale });
    const launch = projectileDrawAt(bombard, 0, view).lift;
    assert.ok(launch > shooter.crown && launch - shooter.crown < shooter.crown * 0.1,
      `a bombard leaves just over the crown (${shooter.crown.toFixed(1)}), at ${launch}`);
    inside(projectileDrawAt(bombard, 1, view).lift, target, `a bombard at velocity ${bombard.xVelocity} lands on the target`);
  }

  const fireball = fireballFlight({ from, to, gladiatorDir: "right", xVelocity: 50, casterYscale: shooterYscale });
  inside(fireballDrawAt(fireball, 0, view).lift, shooter, "a fireball leaves from the caster's shoulder");
  inside(fireballDrawAt(fireball, fireballLifetimeMs(fireball) - 1, view).lift, target, "and bursts on the target");
});

test("EVERY DRAWN FLIGHT LEAVES FROM THE SHOOTER'S DRAWN HEAD OR SHOULDER AND ENDS ON THE TARGET'S DRAWN BODY", () => {
  // ► **FOUND BY A CODEX REVIEW, REPRODUCED BEFORE IT WAS FIXED (2026-09-23).**
  //   The lift kept the arc's normalised endpoint in the SHOOTER's units and
  //   ignored the depth scale every body is drawn at: a strength-9 bombard over
  //   500 units ended 186.46 up against a rank-2 crown of 179.99, and over 3000
  //   units ended 199.79 against a front-rank crown of 191.48 — 1,620 of 2,916
  //   flights in this sweep's shape ended off the target, the worst 86.6 units
  //   over its head. The front-pair test above could not see any of it.
  //
  //   Every combination below: three kinds, `_yscale` 80 / 86 / 113 on each end
  //   (strength 0, 9, 50), ranks 0-2 on each end, the default pair, ±1500 and
  //   the walls at ±2100, every bombard velocity the build draws (8-18) and all
  //   three fireball velocities. The bodies are the ones the arena draws: the
  //   authored figure always, and the extracted rig where this machine has one.
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const yOf = (rank) => 200 - 97 * rank;
  const authoredBare = authoredCrownOf(paintFigure(
    figureSpecFor({ id: "x", name: "X", resources: {} }, { side: "hero" }), RESTING()
  ));
  const extractedBare = REAL_FIGURE ? extractedCrownOf(paintExtractedFigure(REAL_FIGURE.pack, {
    family: "standing", label: "Standing", facing: "right", at: 0
  })) : null;
  const crowns = (yscale, rank) => {
    const size = figureScaleFor({ yscale, rank: rankOfDepth(yOf(rank), 0, view), slotIndex: 0 });
    return [authoredBare * size, ...(extractedBare === null ? [] : [extractedBare * size])];
  };
  const on = (lift, body, what) => {
    for (const crown of body) {
      assert.ok(lift > 0 && lift < crown, `${what}: ${lift.toFixed(1)} must be on a body ${crown.toFixed(1)} tall`);
    }
  };
  const overHead = (lift, body, what) => {
    for (const crown of body) {
      assert.ok(lift > crown && lift - crown < crown * 0.1,
        `${what}: a bombard leaves just over the crown (${crown.toFixed(1)}), not at ${lift.toFixed(1)}`);
    }
  };

  let flights = 0;
  for (const shooterYscale of [80, 86, 113]) for (const targetYscale of [80, 86, 113]) {
    for (const shooterRank of [0, 1, 2]) for (const targetRank of [0, 1, 2]) {
      for (const [fromX, toX] of [[-250, 250], [-1500, 1500], [-2100, 2100], [2100, -2100]]) {
        const from = { x: fromX, y: yOf(shooterRank) };
        const to = { x: toX, y: yOf(targetRank) };
        const shooter = crowns(shooterYscale, shooterRank);
        const target = crowns(targetYscale, targetRank);
        // The stop-short is the target's `physical_size`, which IS its `_yscale`.
        const targetSize = targetYscale;
        const label = `${shooterYscale}@${shooterRank} -> ${targetYscale}@${targetRank}, ${fromX}..${toX}`;
        const shot = (kind, sequence) => projectileFlight({ kind, from, to, sequence, targetSize, shooterYscale, targetYscale });

        const snipe = shot("snipe", 0);
        on(projectileDrawAt(snipe, 0, view).lift, shooter, `snipe leaves ${label}`);
        on(projectileDrawAt(snipe, 1, view).lift, target, `snipe lands ${label}`);
        for (let sequence = 0; sequence <= 10; sequence += 1) {
          const bombard = shot("bombard", sequence);
          overHead(projectileDrawAt(bombard, 0, view).lift, shooter, `bombard ${label}`);
          on(projectileDrawAt(bombard, 1, view).lift, target, `bombard v${bombard.xVelocity} lands ${label}`);
          flights += 1;
        }
        for (const xVelocity of [50, 70, 90]) {
          const fireball = fireballFlight({
            from, to, gladiatorDir: toX > fromX ? "right" : "left", xVelocity, casterYscale: shooterYscale, targetYscale
          });
          on(fireballDrawAt(fireball, 0, view).lift, shooter, `fireball leaves ${label}`);
          on(fireballDrawAt(fireball, fireballLifetimeMs(fireball) - 1, view).lift, target, `fireball v${xVelocity} bursts ${label}`);
          flights += 1;
        }
        flights += 1;
      }
    }
  }
  assert.equal(flights, 3 * 3 * 3 * 3 * 4 * (1 + 11 + 3), "the sweep ran every combination it names");
});

/**
 * A body's DOCUMENTED end room, restated from `endRoomFor` in
 * `src/render/projectile.js` — the promise the tests hold the drawing to:
 * `2 * (C - e) / rho`, with `C` the body's crown at its drawn scale plus 5%,
 * `e` the lower of the drawn launch and the target's drawn shoulder, and `rho`
 * the two ends' depth scales, smaller over larger. A flight shorter than twice
 * it promises that body nothing.
 */
function documentedEndRoom(flight, body, { targetYscale, view }) {
  const sizeAt = (y) => figureScaleFor({ yscale: 100, rank: rankOfDepth(y, 0, view), slotIndex: 0 });
  const near = sizeAt(Number.isFinite(flight.launch.y) ? flight.launch.y : view.frontY);
  const far = sizeAt(Number.isFinite(flight.impact.y) ? flight.impact.y : view.frontY);
  const launch = projectileDrawAt(flight, 0, view).lift;
  const shoulder = (1.5 * targetYscale + 5) * far;
  const clearance = SS2_FIGURE_HEIGHT * (body.yscale / 100) * sizeAt(body.y) * 1.05;
  return (2 * Math.max(0, clearance - Math.min(launch, shoulder))) / (Math.min(near, far) / Math.max(near, far));
}

/**
 * Where a body is PROMISED clearance, restated from `lobLiftAt`: at least
 * `max(his end room, that end's approach)` from each end — the approach being
 * the shooter's `physical_size` after the launch and the target's before the
 * landing — on a flight at least twice his room long.
 */
function promisedStretch(flight, body, { shooterYscale, targetYscale, view }) {
  const room = documentedEndRoom(flight, body, { targetYscale, view });
  return {
    room,
    fromLaunch: Math.max(room, shooterYscale),
    fromLanding: Math.max(room, targetYscale),
    long: Math.abs(flight.impact.x - flight.launch.x) >= 2 * room
  };
}

test("A DRAWN LOB PASSES OVER EVERY BODY AWAY FROM ITS ENDS, AND LANDS ON ITS TARGET — ON ITS HEAD WHEN SOMEBODY STANDS IN ITS APPROACH", () => {
  // ► **FOUND BY A CODEX REVIEW, REPRODUCED BEFORE IT WAS FIXED (2026-09-23).**
  //   The drawn lob's end correction was spread over the whole flight, so from
  //   x 0 to 4000 it was 159.66 up at x 3828 — under an identical bystander's
  //   191.48 crown, 172 short of the target. The resolver exempts a bombard from
  //   line blocking BECAUSE it clears bodies, and the clearance sweep that
  //   should have caught it measured `projectileAt().height`, a number the
  //   drawing never used. This measures `projectileDrawAt().lift`, against the
  //   crowns the two painters actually draw.
  //
  //   The criterion is `lobLiftAt`'s, since a fourth Codex finding the same
  //   day (the round-3 version of this test asserted clearance over EVERY
  //   footprint, and the construction that met it jumped at footprint edges):
  //   the lob is `chord + k * bulge`, so it clears every body at least its
  //   OWN end room from BOTH ends (`documentedEndRoom`; ~~`LOB_END_ROOM` 140~~
  //   until Codex pass 5 showed that fixed room assumed nobody stronger than
  //   50), and a body inside the landing's end room RAISES THE LANDING to 95%
  //   of the target's crown. The graze that leaves over a clamp-adjacent ally
  //   is measured and documented there, not asserted away here.
  //   Blockers stand in the TARGET's rank where the walk clamp puts one
  //   (`physical_size` in front of it), 172 short (Codex's), and mid-field; the
  //   stop is `stopShortFor`'s rule, restated (pinned against the real
  //   presentation in `test/ss2-projectile-endpoint.test.js`).
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const yOf = (rank) => 200 - 97 * rank;
  const authoredBare = authoredCrownOf(paintFigure(
    figureSpecFor({ id: "x", name: "X", resources: {} }, { side: "hero" }), RESTING()
  ));
  const extractedBare = REAL_FIGURE ? extractedCrownOf(paintExtractedFigure(REAL_FIGURE.pack, {
    family: "standing", label: "Standing", facing: "right", at: 0
  })) : null;
  const scaleOf = (yscale, y) => figureScaleFor({ yscale, rank: rankOfDepth(y, 0, view), slotIndex: 0 });
  const crownsOf = (yscale, y) => [authoredBare, ...(extractedBare === null ? [] : [extractedBare])]
    .map((crown) => crown * scaleOf(yscale, y));
  const reachOf = (yscale, y) => SS2_FIGURE_HALF_WIDTH * scaleOf(yscale, y);

  let checked = 0;
  let overBodies = 0;
  for (const shooterYscale of [80, 113]) for (const targetYscale of [80, 113]) for (const blockerYscale of [80, 113]) {
    for (const shooterRank of [0, 1, 2]) for (const targetRank of [0, 1, 2]) {
      for (const [fromX, toX] of [[-250, 250], [-1500, 1500], [-2100, 2100], [2100, -2100]]) {
        const direction = toX > fromX ? 1 : -1;
        const targetY = yOf(targetRank);
        for (const blockerX of [toX - direction * targetYscale, toX - direction * 172, (fromX + toX) / 2]) {
          const blocker = { x: blockerX, y: targetY, yscale: blockerYscale };
          const surface = SS2_FIGURE_HALF_WIDTH * targetYscale / 100;
          const terminal = toX - direction * surface;
          const targetSize = Math.abs(blocker.x - terminal) <= SS2_FIGURE_HALF_WIDTH * blockerYscale / 100 ? 0 : surface;
          const label = `${shooterYscale}@${shooterRank} -> ${targetYscale}@${targetRank} past ${blockerYscale} at ${blockerX}, ${fromX}..${toX}`;
          for (let sequence = 0; sequence <= 10; sequence += 1) {
            const flight = projectileFlight({
              kind: "bombard", from: { x: fromX, y: yOf(shooterRank) }, to: { x: toX, y: targetY },
              sequence, targetSize, shooterYscale, targetYscale, bodies: [blocker]
            });
            // Every drawn point over the blocker's drawn body, two units apart,
            // at least his end room from both ends — what the construction promises.
            const reach = reachOf(blockerYscale, targetY);
            const landingX = projectileDrawAt(flight, 1, view).x;
            const promise = promisedStretch(flight, blocker, { shooterYscale, targetYscale, view });
            for (let x = blocker.x - reach; x <= blocker.x + reach; x += 2) {
              const t = (x - flight.launch.x) / (flight.direction * flight.xVelocity);
              if (t < 0 || t > flight.flightFrames) continue;
              if (!promise.long) continue;
              if (Math.abs(x - flight.launch.x) < promise.fromLaunch || Math.abs(landingX - x) < promise.fromLanding) continue;
              const point = projectileDrawAt(flight, t / flight.flightFrames, view);
              if (Math.abs(point.y - targetY) > 97 / 2) continue;   // passing another rank there
              if (Math.abs(point.x - blocker.x) > reach) continue;   // stopped short of him
              for (const crown of crownsOf(blockerYscale, targetY)) {
                assert.ok(point.lift > crown,
                  `${label} v${flight.xVelocity}: at x ${point.x.toFixed(1)} the lob is ${point.lift.toFixed(1)}, under a ${crown.toFixed(1)} crown`);
              }
              overBodies += 1;
            }
            const end = projectileDrawAt(flight, 1, view).lift;
            // Somebody in the target's rank where he is not promised — his end
            // room or the target's approach, his footprint widened 5% as the
            // construction widens it — raises it.
            const wide = reach * 1.05;
            const crowded = direction * (landingX - (blocker.x - direction * wide)) > 0
              && direction * (landingX - (blocker.x + direction * wide)) < promise.fromLanding;
            for (const crown of crownsOf(targetYscale, targetY)) {
              assert.ok(end > 0 && end < crown, `${label} v${flight.xVelocity}: it lands at ${end.toFixed(1)}, on a ${crown.toFixed(1)} body`);
              if (crowded) {
                assert.ok(end >= 0.95 * crown - 1e-6, `${label}: somebody in the approach, so it lands on the head, not at ${end.toFixed(1)}`);
              }
            }
            checked += 1;
          }
        }
      }
    }
  }
  assert.equal(checked, 2 * 2 * 2 * 3 * 3 * 4 * 3 * 11, "every flight the sweep names was drawn");
  assert.ok(overBodies > checked, `and the lob was actually measured over the bodies: ${overBodies} points`);
});

/* ------------------------------------------------------------------ */
/* THE LOB IS CONTINUOUS BY CONSTRUCTION — fourth Codex finding        */
/* ------------------------------------------------------------------ */

/**
 * A drawn lob sampled along x: every `step` units, plus ±0.01 around every
 * point named in `edges`. Sorted by x, as `{x, lift}` from `projectileDrawAt`.
 */
function lobSamples(flight, view, { step = 4, edges = [] } = {}) {
  const length = Math.abs(flight.impact.x - flight.launch.x);
  const xs = [];
  for (let d = 0; d <= length; d += step) xs.push(flight.launch.x + flight.direction * d);
  xs.push(flight.impact.x);
  for (const edge of edges) for (const offset of [-0.01, -0.001, 0, 0.001, 0.01]) xs.push(edge + offset);
  return xs
    .map((x) => (x - flight.launch.x) / (flight.direction * flight.xVelocity))
    .filter((t) => t >= 0 && flight.direction * (flight.launch.x + flight.direction * flight.xVelocity * t - flight.impact.x) <= 1e-9)
    .map((t) => projectileDrawAt(flight, Math.min(1, t / flight.flightFrames), view))
    .sort((a, b) => a.x - b.x);
}

/**
 * THE CONTINUITY BOUND, derived from the UNMODIFIED arc — the same flight with
 * nobody in the way. Its steepest drawn slope `S0`, times the most the cap lets
 * `k` raise its bulge (a quarter of the length over its own bulge peak `B0`),
 * plus one unit per unit for the chord a raised landing tilts. A step larger
 * than `bound * dx` is a jump: the one Codex found was 60.89 in 0.002.
 */
function continuityBound(bare, view) {
  const samples = lobSamples(bare, view, { step: 1 });
  let slope = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const dx = Math.abs(samples[index].x - samples[index - 1].x);
    if (dx > 1e-9) slope = Math.max(slope, Math.abs(samples[index].lift - samples[index - 1].lift) / dx);
  }
  const first = samples[0];
  const last = samples[samples.length - 1];
  const chordAt = (x) => first.lift + ((x - first.x) / (last.x - first.x)) * (last.lift - first.lift);
  const bulge = Math.max(...samples.map((point) => point.lift - chordAt(point.x)));
  const length = Math.abs(last.x - first.x);
  const raise = bulge > 0 ? Math.max(1, (0.25 * length) / bulge) : 1;
  return raise * slope + 1;
}

test("CODEX'S FOOTPRINT-EDGE CASE: a bystander at x 86 no longer makes the lob jump 60.89 units at his edge", () => {
  // ► **REPRODUCED BEFORE IT WAS FIXED (2026-09-23), both directions.** A
  //   strength-9 archer at x 0 lobbing at a strength-9 target at 1000, a
  //   strength-50 bystander at 86 in the same rank: 203.28 at x 31.53865, 264.17
  //   at 31.54065 — the clearance floor switching on at his footprint's edge.
  //   The lob is now `chord + k * bulge` with one `k` per flight.
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  for (const [from, to, bystanderX] of [[0, 1000, 86], [1000, 0, 914]]) {
    const shot = (bodies) => projectileFlight({
      kind: "bombard", from: { x: from, y: 200 }, to: { x: to, y: 200 }, sequence: 0,
      targetSize: SS2_FIGURE_HALF_WIDTH * 0.86, shooterYscale: 86, targetYscale: 86, bodies
    });
    const flight = shot([{ x: bystanderX, y: 200, yscale: 113 }]);
    const direction = flight.direction;
    const edge = bystanderX - direction * SS2_FIGURE_HALF_WIDTH * 1.13;
    const at = (x) => projectileDrawAt(flight, (x - flight.launch.x) / (direction * flight.xVelocity) / flight.flightFrames, view);
    const bound = continuityBound(shot([]), view);
    const before = at(edge - direction * 0.001);
    const after = at(edge + direction * 0.001);
    assert.ok(Math.abs(after.lift - before.lift) <= bound * 0.002 + 1e-9,
      `${from}->${to}: ${before.lift.toFixed(4)} then ${after.lift.toFixed(4)} across his edge — a step of ${(after.lift - before.lift).toFixed(4)}`);
    // And over the whole flight, densely.
    const samples = lobSamples(flight, view, { step: 0.5, edges: [edge, bystanderX + direction * SS2_FIGURE_HALF_WIDTH * 1.13] });
    for (let index = 1; index < samples.length; index += 1) {
      const dx = Math.abs(samples[index].x - samples[index - 1].x);
      assert.ok(Math.abs(samples[index].lift - samples[index - 1].lift) <= bound * dx + 1e-9,
        `${from}->${to}: a step of ${(samples[index].lift - samples[index - 1].lift).toFixed(3)} at x ${samples[index].x.toFixed(3)}`);
    }
    // He stands inside the launch's end room, so passing him is the documented
    // exception; the lob still lands on the target's shoulder.
    assert.equal(projectileDrawAt(flight, 1, view).lift, 86 * 1.5 + 5, "on the target's shoulder: nobody in its approach");
  }
});

test("THE DRAWN LOB NEVER STEPS, anywhere, in either direction — footprint edges, end rooms, ranks, sizes, velocities, ranges", () => {
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const yOf = (rank) => 200 - 97 * rank;
  let flights = 0;
  let steps = 0;
  for (const [fromX, toX] of [[-250, 250], [250, -250], [-1500, 1500], [1500, -1500], [-2100, 2100], [2100, -2100]]) {
    const direction = toX > fromX ? 1 : -1;
    for (const [shooterRank, targetRank] of [[0, 0], [0, 2], [2, 0]]) {
      // Strength 0 and 50, then the reachable giants (Codex pass 5): the
      // strongest tournament boss (Emperor Antares, strength 60), Codex's
      // strength-100 body, the build's colossus `_yscale` 150, and the
      // largest a generated opponent can roll (`_yscale` 242).
      for (const blockerYscale of [80, 113, 120, 147, 150, 242]) {
        const targetY = yOf(targetRank);
        const surface = SS2_FIGURE_HALF_WIDTH * 0.86;
        const landingX = toX - direction * surface;
        const launchX = fromX + direction * 30;
        const blockers = [
          toX - direction * 86,                    // parked by the walk clamp
          toX - direction * 172,                   // Codex's round-3 case
          (fromX + toX) / 2,                       // mid-field
          fromX + direction * 86,                  // Codex's round-4 case: in front of the archer
          toX - direction * 250                    // Codex's round-5 case: 250 short of the target
        ];
        for (const blockerX of blockers) {
          const bodies = [{ x: blockerX, y: targetY, yscale: blockerYscale }];
          const reach = SS2_FIGURE_HALF_WIDTH * blockerYscale / 100;
          for (const sequence of [0, 5, 10]) {
            const shot = (with_) => projectileFlight({
              kind: "bombard", from: { x: fromX, y: yOf(shooterRank) }, to: { x: toX, y: targetY }, sequence,
              targetSize: surface, shooterYscale: 86, targetYscale: 86, bodies: with_
            });
            const flight = shot(bodies);
            const room = documentedEndRoom(flight, bodies[0], { targetYscale: 86, view });
            const edges = [
              blockerX - reach, blockerX + reach, blockerX - reach * 1.05, blockerX + reach * 1.05,
              launchX + direction * room, landingX - direction * room,
              launchX + direction * 86, landingX - direction * 86   // the two approaches
            ];
            const bound = continuityBound(shot([]), view);
            const samples = lobSamples(flight, view, { step: 4, edges });
            for (let index = 1; index < samples.length; index += 1) {
              const dx = Math.abs(samples[index].x - samples[index - 1].x);
              const dy = Math.abs(samples[index].lift - samples[index - 1].lift);
              assert.ok(dy <= bound * dx + 1e-9,
                `${fromX}..${toX} ranks ${shooterRank}->${targetRank}, a ${blockerYscale} at ${blockerX}, v${flight.xVelocity}: ` +
                `a step of ${dy.toFixed(3)} over ${dx.toFixed(4)} at x ${samples[index].x.toFixed(3)} (bound ${bound.toFixed(2)}/unit)`);
              steps += 1;
            }
            flights += 1;
          }
        }
      }
    }
  }
  assert.equal(flights, 6 * 3 * 6 * 5 * 3, "every flight the sweep names was drawn");
  assert.ok(steps > flights * 100, `and densely: ${steps} steps`);
});

test("CODEX PASS 5: A STRENGTH-100 GIANT 158.55 BEFORE THE LANDING IS HANDLED ON PURPOSE, NOT CLAMPED AWAY", () => {
  // ► **REPRODUCED BEFORE IT WAS FIXED (2026-09-23).** A strength-9 pair, x 0
  //   to 1000, a `_yscale` 147 body (strength 100 — nothing caps strength that
  //   high, see `endRoomFor`) at 750 in the target's rank: at x 800, 158.55
  //   units before the landing and so outside the old fixed 140-unit room, the
  //   lob was drawn 316.82 against his 327.30 crown, `k` silently clamped.
  //
  //   Now his OWN end room is 419.4 (`2 * (343.66 - 134) / 1`), he stands
  //   inside it, and the construction does what it documents, out loud: no
  //   promise is made over him; he asks for more than the stage's budget and
  //   the lob is RAISED OVER HIM AS FAR AS THE BUDGET GOES — its bulge peaks at
  //   a quarter of the flight's length — and passes through the rest of him
  //   (still 10.48 under his crown at x 800: accepted, and said); the landing
  //   RISES to the target's head; the path stays continuous. The same giant
  //   standing mid-flight is cleared.
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const shot = (bodies) => projectileFlight({
    kind: "bombard", from: { x: 0, y: 200 }, to: { x: 1000, y: 200 }, sequence: 0,
    targetSize: 41.4477, shooterYscale: 86, targetYscale: 86, bodies
  });
  const giant = { x: 750, y: 200, yscale: 147 };
  const flight = shot([giant]);
  const room = documentedEndRoom(flight, giant, { targetYscale: 86, view });
  assert.ok(Math.abs(room - 419.4) < 0.1, `his end room is 419.4, not the old 140: ${room.toFixed(2)}`);
  const landingX = projectileDrawAt(flight, 1, view).x;
  const farEdge = giant.x + SS2_FIGURE_HALF_WIDTH * 1.47 * 1.05;
  assert.ok(landingX - farEdge < room, "and he stands inside it, before the landing");

  const targetCrown = authoredCrownOf(paintFigure(
    figureSpecFor({ id: "x", name: "X", resources: {} }, { side: "hero" }), RESTING()
  )) * 0.86;
  const landed = projectileDrawAt(flight, 1, view).lift;
  assert.ok(landed >= 0.95 * targetCrown - 1e-6 && landed < targetCrown,
    `somebody in the approach: it lands on the target's head (${landed.toFixed(1)} of a ${targetCrown.toFixed(1)} crown)`);

  // The budget, spent: the lob's bulge over its own chord peaks at a quarter of
  // the flight's length — measured off the drawing, not read off the shape.
  const drawn = lobSamples(flight, view, { step: 1 });
  const first = drawn[0];
  const last = drawn[drawn.length - 1];
  const length = Math.abs(last.x - first.x);
  const chordAt = (x) => first.lift + ((x - first.x) / (last.x - first.x)) * (last.lift - first.lift);
  const bulge = Math.max(...drawn.map((point) => point.lift - chordAt(point.x)));
  assert.ok(Math.abs(bulge - length / 4) < 0.5,
    `raised over him as far as the budget goes: a bulge of ${bulge.toFixed(2)} against the budget's ${(length / 4).toFixed(2)}`);
  const over = projectileDrawAt(flight, (800 - flight.launch.x) / flight.xVelocity / flight.flightFrames, view).lift;
  assert.ok(over < 222.65 * 1.47 && over > 222.65 * 1.47 - 15,
    `and at x 800 he is still ${(222.65 * 1.47 - over).toFixed(2)} over it: the documented overlap, not a hidden one`);

  const bound = continuityBound(shot([]), view);
  const samples = lobSamples(flight, view, { step: 0.5, edges: [giant.x - 72.3, giant.x + 72.3, landingX - room, landingX - 86] });
  for (let index = 1; index < samples.length; index += 1) {
    const dx = Math.abs(samples[index].x - samples[index - 1].x);
    assert.ok(Math.abs(samples[index].lift - samples[index - 1].lift) <= bound * dx + 1e-9,
      `a step of ${(samples[index].lift - samples[index - 1].lift).toFixed(3)} at x ${samples[index].x.toFixed(2)}`);
  }

  // The same giant at mid-flight: the lob is 928.6 long, twice his room is
  // 838.8, so it promises him the stretch 419.4 from both ends — and keeps it.
  const middle = { x: 500, y: 200, yscale: 147 };
  const across = shot([middle]);
  let measured = 0;
  for (let x = across.launch.x + room; x <= landingX - room; x += 1) {
    if (Math.abs(x - middle.x) > SS2_FIGURE_HALF_WIDTH * 1.47) continue;
    const point = projectileDrawAt(across, (x - across.launch.x) / across.xVelocity / across.flightFrames, view);
    assert.ok(point.lift > 222.65 * 1.47, `mid-flight he is cleared: ${point.lift.toFixed(1)} at x ${point.x.toFixed(1)}`);
    measured += 1;
  }
  assert.ok(measured > 50, `over his promised stretch: ${measured} points`);
});

/** The lob's drawn lift over arena x, through `projectileDrawAt`. */
function lobLiftOver(flight, x, view) {
  return projectileDrawAt(flight, (x - flight.launch.x) / (flight.direction * flight.xVelocity) / flight.flightFrames, view);
}

test("CODEX PASS 6: A GIANT ENDPOINT NO LONGER DROPS WHAT cab600f CLEARED — the lob over his clamp-parked twin", () => {
  // ► **REPRODUCED BEFORE IT WAS FIXED (2026-09-23), both directions.** A
  //   strength-60 archer (`_yscale` 120) at the wall lobs at a `_yscale` 242
  //   target at the other wall, over a `_yscale` 242 body parked at the
  //   target's walk clamp. cab600f drew 540.50 at x 1910, over his 538.81
  //   crown; the per-body rule alone drew 529.07 — the target's approach (his
  //   242-unit `physical_size`) had grown past cab600f's 140-unit room and
  //   dropped points cab600f enforced. The lob now takes the stricter of the
  //   two requirements (`lobShapeFor`, `CAB600F_END_ROOM`).
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const crown = authoredCrownOf(paintFigure(
    figureSpecFor({ id: "x", name: "X", resources: {} }, { side: "hero" }), RESTING()
  )) * 2.42;
  for (const mirror of [1, -1]) {
    const at = (x) => mirror * (x - 2100);
    const flight = projectileFlight({
      kind: "bombard", from: { x: at(0), y: 200 }, to: { x: at(4200), y: 200 }, sequence: 0,
      targetSize: 116.6319, shooterYscale: 120, targetYscale: 242, bodies: [{ x: at(3958), y: 200, yscale: 242 }]
    });
    const lift = lobLiftOver(flight, at(4010), view).lift;
    assert.ok(lift > crown, `${mirror > 0 ? "forward" : "mirrored"}: ${lift.toFixed(2)} at x ${at(4010)}, over his ${crown.toFixed(2)} crown`);
    // And every point of him cab600f's own rule covered — at least 140 from both ends.
    const landingX = projectileDrawAt(flight, 1, view).x;
    for (let x = at(3958) - SS2_FIGURE_HALF_WIDTH * 2.42; x <= at(3958) + SS2_FIGURE_HALF_WIDTH * 2.42; x += 1) {
      if (Math.abs(x - flight.launch.x) < 140 || Math.abs(landingX - x) < 140) continue;
      assert.ok(lobLiftOver(flight, x, view).lift > crown, `${mirror > 0 ? "forward" : "mirrored"}: under his crown at x ${x.toFixed(1)}`);
    }
  }
});

test("MONOTONE AGAINST cab600f: giant endpoints over giant blockers — every sampled point cab600f cleared stays cleared", () => {
  // ► **A REPRESENTATIVE SUBSET OF A DIFFERENTIAL SWEEP (2026-09-23, Codex pass
  //   6).** The sweep itself lives in scratch, not here: 40,500 flights — the
  //   continuity grid, every range and direction, three rank pairings, endpoints
  //   of `_yscale` 86/120/147/150/242, blockers 80 to 242 at the walk clamp, 172
  //   and 250 short, mid-field and in front of the archer — drawn by this
  //   module and by cab600f's frozen `projectile.js`, point by point. Without
  //   the floor, 726 cells had points cab600f cleared and this did not (worst
  //   drop 310.5 units); with it, 0, and no sampled point anywhere is lower
  //   than cab600f drew it. These are cells from that list, each with three of
  //   the x's cab600f cleared, measured then; the sweep's own numbers are in
  //   its report, not asserted here.
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const cells = [
    { from: -1500, to: 1500, ranks: [0, 0], target: 147, blocker: 147, bx: 1353, stop: 70.8466, xs: [1358, 1359, 1360] },
    { from: 1500, to: -1500, ranks: [0, 0], target: 147, blocker: 147, bx: -1353, stop: 70.8466, xs: [-1360, -1359, -1358] },
    { from: -1500, to: 1500, ranks: [0, 2], target: 242, blocker: 242, bx: 1250, stop: 116.6319, xs: [1270, 1293, 1315] },
    { from: 1500, to: -1500, ranks: [0, 2], target: 242, blocker: 242, bx: -1250, stop: 116.6319, xs: [-1315, -1292, -1270] },
    { from: -2100, to: 2100, ranks: [0, 2], target: 147, blocker: 147, bx: 1953, stop: 70.8466, xs: [1931, 1946, 1960] },
    { from: 2100, to: -2100, ranks: [0, 2], target: 147, blocker: 147, bx: -1953, stop: 70.8466, xs: [-1960, -1945, -1931] },
    { from: -2100, to: 2100, ranks: [2, 0], target: 242, blocker: 242, bx: 1850, stop: 116.6319, xs: [1868, 1891, 1914] },
    { from: 2100, to: -2100, ranks: [2, 0], target: 242, blocker: 242, bx: -1850, stop: 116.6319, xs: [-1914, -1891, -1868] }
  ];
  const yOf = (rank) => 200 - 97 * rank;
  const bare = authoredCrownOf(paintFigure(
    figureSpecFor({ id: "x", name: "X", resources: {} }, { side: "hero" }), RESTING()
  ));
  for (const cell of cells) {
    const targetY = yOf(cell.ranks[1]);
    const flight = projectileFlight({
      kind: "bombard", from: { x: cell.from, y: yOf(cell.ranks[0]) }, to: { x: cell.to, y: targetY }, sequence: 0,
      targetSize: cell.stop, shooterYscale: 86, targetYscale: cell.target,
      bodies: [{ x: cell.bx, y: targetY, yscale: cell.blocker }]
    });
    const crown = bare * figureScaleFor({ yscale: cell.blocker, rank: rankOfDepth(targetY, 0, view), slotIndex: 0 });
    for (const x of cell.xs) {
      const lift = lobLiftOver(flight, x, view).lift;
      assert.ok(lift > crown,
        `${cell.from}..${cell.to} ranks ${cell.ranks.join("->")}, a ${cell.blocker} at ${cell.bx}: ${lift.toFixed(2)} at x ${x}, under his ${crown.toFixed(2)} crown`);
    }
  }
});

test("A GIANT cab600f PASSED THROUGH IS NOW CLEARED — a strength-100 body 250 before the landing of a ±1500 lob", () => {
  // cab600f kept the landing on the target's SHOULDER — he stands ~176 from it,
  // outside its fixed 140 — so against that low chord he asked `k` for more
  // than the budget (4.43 against 3.62 at velocity 8, by hand) and was cut to
  // it: the lob went through him by 20.3 units. His own end room (419) raises
  // the landing to the target's head, which brings what he asks for inside the
  // budget — measured 24.6 over his crown at the lowest. This test FAILS on
  // cab600f's drawing.
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const crown = authoredCrownOf(paintFigure(
    figureSpecFor({ id: "x", name: "X", resources: {} }, { side: "hero" }), RESTING()
  )) * 1.47;
  for (const [from, to] of [[-1500, 1500], [1500, -1500]]) {
    for (let sequence = 0; sequence <= 10; sequence += 1) {
      const shot = (bodies) => projectileFlight({
        kind: "bombard", from: { x: from, y: 200 }, to: { x: to, y: 200 }, sequence,
        targetSize: SS2_FIGURE_HALF_WIDTH * 0.86, shooterYscale: 86, targetYscale: 86, bodies
      });
      const giantX = shot([]).impact.x - Math.sign(to - from) * 250;
      const flight = shot([{ x: giantX, y: 200, yscale: 147 }]);
      for (let x = giantX - SS2_FIGURE_HALF_WIDTH * 1.47; x <= giantX + SS2_FIGURE_HALF_WIDTH * 1.47; x += 1) {
        const lift = lobLiftOver(flight, x, view).lift;
        assert.ok(lift > crown, `${from}..${to} v${flight.xVelocity}: ${lift.toFixed(1)} at x ${x.toFixed(1)}, under his ${crown.toFixed(1)} crown`);
      }
    }
  }
});

test("THE REACHABLE GIANTS ARE CLEARED OUTSIDE THEIR OWN END ROOMS — bosses, colossus, the largest roll", () => {
  // ► **THE SIZE RANGE, re-derived for Codex pass 5** (see `endRoomFor`):
  //   `physical_size = 80 + round(strength / 1.5)` has no ceiling in the
  //   engine, and nothing caps strength in the build — `is_that_virtuous()`'s
  //   50 is skipped when `fizMode == "fizzle"`. Measured: the tournament
  //   bosses' own DNA runs to strength 60 (`_yscale` 120, Emperor Antares);
  //   colossus drives the build's `_yscale` to 150 from any start; a generated
  //   opponent's points come from the HERO's level (`ceil(herolevel * 5) - 8`,
  //   `randomise_gladiator` `+0x24a6`, before the level jitter) and are spent
  //   exactly (`+0x27bc`-`+0x27ce`) over stats seeded at 1, so at the level
  //   ceiling of 50 the route doc records, strength up to 243 — `_yscale`
  //   242. Every one of them, placed where the lob has room for him,
  //   is cleared over every point of him at least his own end room from both
  //   ends, against the crowns both painters draw.
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const yOf = (rank) => 200 - 97 * rank;
  const authoredBare = authoredCrownOf(paintFigure(
    figureSpecFor({ id: "x", name: "X", resources: {} }, { side: "hero" }), RESTING()
  ));
  const extractedBare = REAL_FIGURE ? extractedCrownOf(paintExtractedFigure(REAL_FIGURE.pack, {
    family: "standing", label: "Standing", facing: "right", at: 0
  })) : null;
  const scaleOf = (yscale, y) => figureScaleFor({ yscale, rank: rankOfDepth(y, 0, view), slotIndex: 0 });
  let flights = 0;
  let measured = 0;
  for (const [fromX, toX] of [[-1500, 1500], [1500, -1500], [-2100, 2100], [2100, -2100]]) {
    const direction = toX > fromX ? 1 : -1;
    for (const [shooterRank, targetRank] of [[0, 0], [0, 2]]) {
      for (const shooterYscale of [80, 113]) for (const targetYscale of [80, 113]) {
        for (const giantYscale of [120, 147, 150, 242]) {
          const targetY = yOf(targetRank);
          const surface = SS2_FIGURE_HALF_WIDTH * targetYscale / 100;
          const reach = SS2_FIGURE_HALF_WIDTH * scaleOf(giantYscale, targetY);
          // Where to stand him: mid-field, and hard against each end room.
          const probe = projectileFlight({
            kind: "bombard", from: { x: fromX, y: yOf(shooterRank) }, to: { x: toX, y: targetY }, sequence: 0,
            targetSize: surface, shooterYscale, targetYscale
          });
          const room = documentedEndRoom(probe, { yscale: giantYscale, y: targetY }, { targetYscale, view });
          const landingX = probe.impact.x;
          const spots = [(fromX + toX) / 2, probe.launch.x + direction * (room + reach), landingX - direction * (room + reach)];
          for (const giantX of spots) for (const sequence of [0, 5, 10]) {
            const giant = { x: giantX, y: targetY, yscale: giantYscale };
            const flight = projectileFlight({
              kind: "bombard", from: { x: fromX, y: yOf(shooterRank) }, to: { x: toX, y: targetY }, sequence,
              targetSize: surface, shooterYscale, targetYscale, bodies: [giant]
            });
            const promise = promisedStretch(flight, giant, { shooterYscale, targetYscale, view });
            flights += 1;
            if (!promise.long) continue;   // too short to promise him anything
            for (let x = giantX - reach; x <= giantX + reach; x += 2) {
              if (Math.abs(x - flight.launch.x) < promise.fromLaunch || Math.abs(landingX - x) < promise.fromLanding) continue;
              const t = (x - flight.launch.x) / (flight.direction * flight.xVelocity);
              const point = projectileDrawAt(flight, t / flight.flightFrames, view);
              if (Math.abs(point.y - targetY) > 97 / 2) continue;   // passing another rank there
              for (const bare of [authoredBare, ...(extractedBare === null ? [] : [extractedBare])]) {
                const crown = bare * scaleOf(giantYscale, targetY);
                assert.ok(point.lift > crown,
                  `a ${giantYscale} at ${giantX.toFixed(0)}, ${fromX}..${toX}, ${shooterYscale}@${shooterRank} -> ` +
                  `${targetYscale}@${targetRank}, v${flight.xVelocity}: ${point.lift.toFixed(1)} under his ${crown.toFixed(1)} crown`);
              }
              measured += 1;
            }
          }
        }
      }
    }
  }
  assert.equal(flights, 4 * 2 * 2 * 2 * 4 * 3 * 3, "every flight the sweep names was drawn");
  assert.ok(measured > 5000, `and the giants were actually measured over: ${measured} points`);
});

test("A RAISED LOB STAYS ON THE STAGE WHEREVER ITS UNRAISED ARC DID — the cap, through the stage camera", () => {
  // ► `LOB_PEAK_PER_LENGTH`: `k` may raise the bulge to a quarter of the
  //   flight's length. The camera fits the fight's spread into the 640x420
  //   stage, so its headroom grows with the distance. Blockers placed just
  //   outside THEIR OWN end rooms make `k` work hardest — ~~"just outside either
  //   end room ... up to 3.81 at the walls, under a cap of 4.12"~~, measured
  //   against the fixed 140-unit room until Codex pass 5; the rooms are sized
  //   per body now and the giants are in. The claim is the cap's own: raising
  //   the lob never lifts its highest point off the top of the stage when the
  //   unraised arc stayed on it. (The UNRAISED arc of a strength-50 archer
  //   already peaks above a zoom-80 stage — one launch height over his 256-unit
  //   launch — which is the normalised arc's, not this construction's.)
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  let checked = 0;
  for (const [fromX, toX] of [[-250, 250], [-1500, 1500], [-2100, 2100], [2100, -2100]]) {
    const direction = toX > fromX ? 1 : -1;
    for (const blockerYscale of [113, 147, 242]) for (const shooterYscale of [80, 113]) {
      const shot = (sequence, bodies) => projectileFlight({
        kind: "bombard", from: { x: fromX, y: 200 }, to: { x: toX, y: 200 }, sequence,
        targetSize: SS2_FIGURE_HALF_WIDTH * 0.86, shooterYscale, targetYscale: 86, bodies
      });
      const probe = shot(0, []);
      const room = documentedEndRoom(probe, { yscale: blockerYscale, y: 200 }, { targetYscale: 86, view });
      const wide = SS2_FIGURE_HALF_WIDTH * (blockerYscale / 100) * 1.05;
      const spots = [
        probe.impact.x - direction * (room + wide + 1), probe.launch.x + direction * (room + wide + 1), (fromX + toX) / 2
      ];
      for (const blockerX of spots) for (let sequence = 0; sequence <= 10; sequence += 1) {
        const actors = [{ x: fromX, side: "hero" }, { x: toX, side: "villain" }, { x: blockerX, side: "hero" }];
        let camera = cameraFor(actors);
        for (let frame = 0; frame < 60; frame += 1) camera = cameraStep(camera, actors);
        const stage = stageProjectorFor(camera, stageFitFor({ width: 640, height: 420 }));
        const top = (flight) => Math.min(...lobSamples(flight, view, { step: 8 }).map((point) => stage.toY(point.y, point.lift)));
        const raised = top(shot(sequence, [{ x: blockerX, y: 200, yscale: blockerYscale }]));
        const unraised = top(shot(sequence, []));
        // ► **ONLY WHERE THE UNRAISED ARC WAS ON THE STAGE — which is what this
        //   test's name says.** ~~`raised >= 0 || raised >= unraised`~~ until
        //   Codex pass 5: it also demanded that a lob ALREADY off the top go no
        //   higher, which a raised LANDING (a body in his own end room, now
        //   sized per body) legitimately breaks — a strength-50 archer's arc at
        //   ±250 tops out at stage y -8.6 on its own. That is the normalised
        //   arc's, reported with the cap, and not this claim.
        if (unraised >= 0) {
          assert.ok(raised >= 0,
            `${fromX}..${toX}, a ${blockerYscale} at ${blockerX.toFixed(0)}, archer ${shooterYscale}, sequence ${sequence}: ` +
            `the raised lob tops out at stage y ${raised.toFixed(1)}, off the stage, where the unraised was on it at ${unraised.toFixed(1)}`);
        }
        checked += 1;
      }
    }
  }
  assert.equal(checked, 4 * 3 * 2 * 3 * 11);
});

test("the FITTED view still frames a whole gladiator when its height bound is the one that binds", () => {
  // ► The fallback bowl (no extracted arena) fits the roster with
  //   `viewportFor`, whose vertical bound was `height / 250` for a figure "about
  //   150 arena units tall". At the build's 222.65 that bound put a front-rank
  //   crown ABOVE the canvas on a wide, short one. The shell's own mapping,
  //   `viewport()` in `tools/arena/main.js`, stands the front rank's feet at
  //   `horizon + (height - horizon) * 0.62`.
  const width = 4000;
  const height = 600;
  const fitted = viewportFor({
    width, height, frontY: 200,
    actors: [{ x: -250, y: 200, placed: true }, { x: 250, y: 200, placed: true }]
  });
  assert.ok(fitted.scale < width / ((250 + 200) * 2), "the width is not what binds on this canvas");
  const feet = fitted.horizon + (height - fitted.horizon) * 0.62;
  const crown = feet - 222.65 * fitted.scale;
  assert.ok(crown > 0, `a size-1 gladiator's crown is on the canvas: y ${crown.toFixed(1)}`);
  assert.ok(crown > height * 0.1, "with the headroom the old bound gave the old figure");
});

test("the demo override reaches the painter's own loadout shape, both slots intact", () => {
  // ► **THE OVERRIDE IS A SPREAD ONTO `loadoutFrom`'s RESULT, SO THE FIELD
  //   NAMES ARE A CONTRACT WITH ANOTHER MODULE AND ARE CHECKED AGAINST IT.**
  //   A rename on either side leaves `?enchant=` silently drawing a bare
  //   weapon: the URL parses, the log line prints, the fields land on an object
  //   nothing reads. That is the failure this asserts away.
  const demo = FIGURE.enchantDemoFrom(params("enchant=3.2.5.1"));
  const loadout = { ...loadoutFrom({ weapon: 1, equipped_weapon: 2 }), ...demo.fields };
  for (const [field, value] of Object.entries(demo.fields)) {
    assert.equal(loadout[field], value, `${field} is a field the figure painter's loadout carries`);
  }

  // ► **AND THE TWO PAIRS STAY APART.** The build reads the EQUIPPED slot's own
  //   pair for the glow — the bow slot here, since `equipped_weapon` is 2 —
  //   while `damagecharacter` gates the PROC on `weapon_enchantment_potency`
  //   whichever is equipped. A loadout that collapsed them would draw the melee
  //   cell on a drawn bow and nothing would say so.
  assert.equal(loadout.equipped_weapon, 2, "a bow is up");
  assert.notEqual(loadout.weapon_enchantment_type, loadout.secondary_weapon_enchantment_type);
  assert.notEqual(loadout.weapon_enchantment_potency, loadout.secondary_weapon_enchantment_potency);

  // The declared loadout survives the spread: an override adds an enchantment,
  // it does not replace the gladiator's kit.
  assert.equal(loadout.weapon, 1, "the weapon the roster declared is still there");
});
