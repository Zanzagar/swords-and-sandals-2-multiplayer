/**
 * A MASK IS IN FORCE WHEN ITS SHAPE IS PAINTED (D7 of the in-frame team HUD,
 * 2026-09-24): `paintLayerOperation` in `tools/arena/main.js` and `paintOne` in
 * `tools/screens/main.js`, the two painters that apply an operation's `clip`.
 *
 * ► **BOTH SET THE CLIP INSIDE A save()/restore() OF THEIR OWN, AND restore()
 *   DISCARDED IT BEFORE THE FILL** (wave 1 of the HUD, 2026-09-24; git blame
 *   puts both at d229f00). The HTML spec's drawing state includes "the current
 *   clipping region", and restore() "pops the top entry in the drawing state
 *   stack, and reset[s] the drawing state it describes" — so every masked
 *   operation was drawn UNCLIPPED: the night sky's moon (56 masked operations
 *   from frame 112), and the build's gauges once they are drawn. The screens
 *   page counted each discarded clip as "clips applied".
 *
 * Neither shell can be imported by node (they need a canvas and a DOM), so the
 * painters are LIFTED out of their source, as `test/render-arena-shell.test.js`
 * lifts the compositor, and run against a context whose drawing state is the
 * spec's: `save()` pushes the matrix AND the clipping region, `restore()` pops
 * both, `setTransform` replaces the matrix and leaves the clip alone.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { TWIPS_PER_PIXEL } from "../src/render/index.js";

/**
 * One top-level function of a shell, as WRITTEN: from `function <name>(` to the
 * first closing brace that starts a line (every top-level function in both
 * shells ends so). Refuses a name it cannot find, so a rename fails by name
 * rather than lifting nothing.
 */
function lift(source, name, file) {
  const start = source.indexOf(`\nfunction ${name}(`);
  assert.ok(start >= 0, `${name} is not a top-level function in ${file}`);
  const end = source.indexOf("\n}\n", start);
  assert.ok(end > start, `${name} has no closing brace at the start of a line in ${file}`);
  return source.slice(start + 1, end + 2);
}

/** A top-level `const NAME = <number>;` of a shell, read rather than restated. */
function constantOf(source, name, file) {
  const found = new RegExp(`\\nconst ${name} = (\\d+);`).exec(source);
  assert.ok(found, `${file} declares ${name}`);
  return Number(found[1]);
}

/** `outer` then `inner`, as canvas composes `transform(inner)` onto a matrix `outer`. */
function compose(outer, inner) {
  const [a, b, c, d, e, f] = outer;
  const [a2, b2, c2, d2, e2, f2] = inner;
  return [a * a2 + c * b2, b * a2 + d * b2, a * c2 + c * d2, b * c2 + d * d2, a * e2 + c * f2 + e, b * e2 + d * f2 + f];
}

/**
 * A 2D context reduced to what the painters call, whose DRAWING STATE is the
 * HTML spec's: the current transformation matrix, the current clipping region
 * (kept as the list of clips intersected into it, each with the matrix it was
 * set under) and the paint settings. `save()` pushes a copy of all of it;
 * `restore()` pops it back, and does nothing on an empty stack. Every paint
 * call is journalled with the clipping region and the matrix in force when it
 * ran — which is the only thing these tests read.
 */
function specContext(matrix = [1, 0, 0, 1, 0, 0]) {
  let state = { matrix: [...matrix], clips: [], globalAlpha: 1, fillStyle: "#000000", strokeStyle: "#000000", lineWidth: 1, lineJoin: "miter" };
  const stack = [];
  const paints = [];
  const journal = (call, extra = {}) => paints.push({
    call, ...extra, clips: state.clips.map((clip) => ({ ...clip, matrix: [...clip.matrix] })), matrix: [...state.matrix]
  });
  const gradient = () => ({ addColorStop() {} });
  const context = {
    paints,
    depth: () => stack.length,
    currentMatrix: () => [...state.matrix],
    currentClips: () => state.clips.map((clip) => ({ ...clip })),
    save() { stack.push({ ...state, matrix: [...state.matrix], clips: [...state.clips] }); },
    restore() { const saved = stack.pop(); if (saved) state = saved; },
    transform(...args) { state.matrix = compose(state.matrix, args); },
    getTransform() { const [a, b, c, d, e, f] = state.matrix; return { a, b, c, d, e, f }; },
    setTransform(...args) {
      if (args.length === 1) {
        const { a, b, c, d, e, f } = args[0];
        state.matrix = [a, b, c, d, e, f];
      } else {
        state.matrix = args.slice(0, 6);
      }
    },
    clip(path, rule = "nonzero") { state.clips = [...state.clips, { d: path.d, rule, matrix: [...state.matrix] }]; },
    fill(path, rule = "nonzero") { journal("fill", { d: path.d, rule }); },
    stroke(path) { journal("stroke", { d: path.d }); },
    fillRect() { journal("fillRect"); },
    drawImage() { journal("drawImage"); },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createPattern: () => ({ pattern: true })
  };
  for (const key of ["globalAlpha", "fillStyle", "strokeStyle", "lineWidth", "lineJoin"]) {
    Object.defineProperty(context, key, { get: () => state[key], set: (value) => { state[key] = value; } });
  }
  return context;
}

/** `Path2D` as the painters build it: from its `d`, which is all the journal needs. */
class FakePath2D {
  constructor(d) { this.d = d; }
}

/** An image the bitmap painters take as loaded. */
const LOADED = Object.freeze({ naturalWidth: 4, width: 4 });

/* ------------------------------------------------------------------ */
/* The arena: paintLayerOperation                                      */
/* ------------------------------------------------------------------ */

const ARENA = "tools/arena/main.js";
const arenaSource = fs.readFileSync(new URL(`../${ARENA}`, import.meta.url), "utf8");

/**
 * `paintLayerOperation` with the painters it calls, closed over a `context`
 * that is `let`, as the shell's is (`paintGroupRuns` rebinds it to a buffer).
 */
function arenaPainter(context) {
  const bodies = ["paintLayerOperation", "paintGradientFill", "paintBitmapFill", "rgbaOf", "path2dFor"]
    .map((name) => lift(arenaSource, name, ARENA));
  return new Function(
    "destination", "TWIPS_PER_PIXEL", "GRADIENT_SQUARE", "bitmapCache", "Path2D",
    `let context = destination;
     const pathCache = new Map();
     ${bodies.join("\n")}
     return paintLayerOperation;`
  )(
    context,
    constantOf(arenaSource, "TWIPS_PER_PIXEL", ARENA),
    constantOf(arenaSource, "GRADIENT_SQUARE", ARENA),
    new Map([["moon", LOADED]]),
    FakePath2D
  );
}

// A shape at x2 and (200, 400) twips = (10, 20) px, and its cutter at a
// DIFFERENT placement, (100, 100) twips = (5, 5) px, so a clip set under the
// shape's matrix, or under both, or under neither, each lands somewhere else.
const SHAPE_D = "M0 0L10 0L10 10Z";
const MASK_D = "M0 0L5 0L5 5Z";
const masked = (fields = {}) => ({
  kind: "path", d: SHAPE_D, matrix: [2, 0, 0, 2, 200, 400], fill: "#ff0000", fillOpacity: 1,
  clip: { d: MASK_D, matrix: [1, 0, 0, 1, 100, 100] }, ...fields
});
// The layer's own space on the canvas: whatever the caller left in the matrix.
const LAYER = [1, 0, 0, 1, 5, 7];
// Worked by hand: LAYER then [2, 0, 0, 2, 10, 20], the shape's own transform ...
const PLACED = [2, 0, 0, 2, 15, 27];
// ... and LAYER then [1, 0, 0, 1, 5, 5], the cutter's, composed in the SAME space.
const MASK_IN_FORCE = Object.freeze({ d: MASK_D, rule: "evenodd", matrix: [1, 0, 0, 1, 10, 12] });

test("D7: a masked arena operation is FILLED with its mask in force, set in the layer's space, and at its own transform", () => {
  const context = specContext(LAYER);
  arenaPainter(context)(masked());
  assert.deepEqual(context.paints.map((paint) => paint.call), ["fill"]);
  const [fill] = context.paints;
  assert.deepEqual(fill.clips, [MASK_IN_FORCE], "the mask is the clipping region when the fill runs");
  assert.deepEqual(fill.matrix, PLACED, "the shape's own transform, not stacked on the cutter's");
  assert.equal(fill.d, SHAPE_D);
});

test("D7: and nothing of it outlives the operation — the stack balances, the layer's matrix is back, the next shape is unmasked", () => {
  const context = specContext(LAYER);
  context.save();
  const paint = arenaPainter(context);
  paint(masked());
  assert.equal(context.depth(), 1, "every save() the painter made, it restored");
  assert.deepEqual(context.currentMatrix(), LAYER, "the layer's own matrix, for the next operation");
  assert.deepEqual(context.currentClips(), [], "the mask ends with its operation");
  paint(masked({ clip: undefined, d: "M1 1L2 2Z" }));
  const [, next] = context.paints;
  assert.equal(next.d, "M1 1L2 2Z");
  assert.deepEqual(next.clips, [], "an unmasked operation after a masked one is not clipped by it");
  assert.deepEqual(next.matrix, PLACED);
});

test("D7: every paint a masked operation makes runs under its mask — its stroke, a gradient fill and a bitmap fill too", () => {
  const cases = {
    stroke: masked({ fill: "none", stroke: "#000000", strokeWidth: 1 }),
    gradient: masked({ gradient: { type: "linear", matrix: { a: 20, b: 0, c: 0, d: 20, tx: 0, ty: 0 }, stops: [{ offset: 0, fill: "#ffffff", opacity: 1 }] } }),
    bitmap: masked({ bitmap: { id: "moon", matrix: { a: 20, b: 0, c: 0, d: 20, tx: 0, ty: 0 }, repeat: false } })
  };
  for (const [kind, operation] of Object.entries(cases)) {
    const context = specContext(LAYER);
    arenaPainter(context)(operation);
    assert.ok(context.paints.length > 0, `${kind}: it paints`);
    for (const paint of context.paints) {
      assert.deepEqual(paint.clips[0], MASK_IN_FORCE, `${kind}: its ${paint.call} runs under the mask`);
    }
    assert.equal(context.depth(), 0, `${kind}: and the stack balances`);
    assert.deepEqual(context.currentClips(), [], `${kind}: and the mask ends with it`);
  }
});

/* ------------------------------------------------------------------ */
/* The screens page: paintOne, and its "clips applied" tally           */
/* ------------------------------------------------------------------ */

const SCREENS = "tools/screens/main.js";
const screensSource = fs.readFileSync(new URL(`../${SCREENS}`, import.meta.url), "utf8");

/** `paintOne` with the painters it calls, and the page's own fresh tally. */
function screensPainter() {
  const bodies = ["paintOne", "paintGradientFill", "paintBitmapFill", "rgbaOf", "path2dFor", "emptyTally", "emptyFilterCounts"]
    .map((name) => lift(screensSource, name, SCREENS));
  return new Function(
    "TWIPS_PER_PIXEL", "GRADIENT_SQUARE", "bitmaps", "show", "Path2D",
    `const pathCache = new Map();
     ${bodies.join("\n")}
     return { paintOne, emptyTally };`
  )(
    TWIPS_PER_PIXEL,
    constantOf(screensSource, "GRADIENT_SQUARE", SCREENS),
    new Map([["moon", LOADED]]),
    { bitmaps: true },
    FakePath2D
  );
}

test("D7: a masked screen operation is FILLED with its mask in force, at its own transform, and nothing of it outlives the operation", () => {
  assert.equal(TWIPS_PER_PIXEL, 20, "the worked matrices below are in twips at 20 to the pixel");
  const { paintOne, emptyTally } = screensPainter();
  const context = specContext(LAYER);
  const tally = emptyTally();
  paintOne(context, masked(), tally);
  const [fill] = context.paints;
  assert.equal(fill.call, "fill");
  assert.deepEqual(fill.clips, [MASK_IN_FORCE], "the mask is the clipping region when the fill runs");
  assert.deepEqual(fill.matrix, PLACED, "the shape's own transform, not stacked on the cutter's");
  assert.equal(context.depth(), 0, "every save() the painter made, it restored");
  assert.deepEqual(context.currentMatrix(), LAYER);
  assert.deepEqual(context.currentClips(), [], "the mask ends with its operation");
  paintOne(context, masked({ clip: undefined, d: "M1 1L2 2Z" }), tally);
  assert.deepEqual(context.paints[1].clips, [], "an unmasked operation after a masked one is not clipped by it");
});

test("D7: the screens page's \"clips applied\" counts only masks IN FORCE over something painted — not every clip it was handed", () => {
  const { paintOne, emptyTally } = screensPainter();
  const context = specContext(LAYER);
  const tally = emptyTally();
  const operations = [
    masked(), // painted under its mask: counts
    masked({ fill: "none", stroke: "#000000", strokeWidth: 1 }), // its stroke under its mask: counts
    masked({ fillOpacity: 0 }), // a transparent fill paints nothing: no pixel was clipped
    masked({ bitmap: { id: "not-loaded", matrix: { a: 20, b: 0, c: 0, d: 20, tx: 0, ty: 0 } } }), // nothing to draw
    masked({ clip: undefined }) // painted, and has no mask
  ];
  for (const operation of operations) paintOne(context, operation, tally);
  // Worked by hand from the list above: two operations painted under their mask.
  assert.equal(tally.clipsApplied, 2);
  // And the journal agrees: every paint of a masked operation ran under the mask.
  const underMask = context.paints.filter((paint) => paint.clips.length === 1 && paint.clips[0].d === MASK_D);
  assert.deepEqual(underMask.map((paint) => paint.call), ["fill", "stroke"]);
  assert.equal(tally.painted, 3);
  assert.equal(context.depth(), 0);
});
