/**
 * WHEN A CLIP'S BLOOD FIRES — at the pose the DRAWING shows, in the run the
 * build actually plays.
 *
 * WHY THIS FILE EXISTS: the shell took a clip's blood from the UN-JOINED
 * animation keyed by the engine's label (`figurePack.animations[label]`), while
 * the figure is drawn from the animation `animationFor` resolves — the joined
 * run for a continuation label. So `hurt8`'s run of 34 poses bled only from the
 * 16 its entry clip carries: `hurt9`'s two `bounceitem` calls (clip frames 1266
 * and 1277) never fired, though the figure plays through both.
 *
 * The seams: the blood timing API in `src/render/blood-timing.js`
 * (`bloodPlanFor` + `dueBloodEffects`); the drawing's own pose clock
 * (`animationFor` + `poseIndexAt`) and `timelineFor`'s schedule; and the
 * shell's wiring, read as TEXT because node cannot import `tools/arena/main.js`
 * (it touches the DOM at load).
 */
import assert from "node:assert/strict";
import nodeFs from "node:fs";
import test from "node:test";

import { bloodPlanFor, bloodSeedFor, dueBloodEffects } from "../src/render/blood-timing.js";
import { clipEffectTableFrom, spawnDrops } from "../src/render/clip-effects.js";
import { animationFor, figurePackFrom, poseIndexAt } from "../src/render/extracted-figure.js";
import { timelineFor } from "../src/render/timeline.js";

/* ------------------------------------------------------------------ *
 * A small pack, so a clone without the player's extraction runs this too
 * ------------------------------------------------------------------ */

const SHAPES = Object.freeze({
  1: { bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, paths: [{ d: "M0 0L1 0L1 1L0 1L0 0Z", fill: "#804020" }] }
});

const clip = (label, { poses = 2, firstFrame = 1 } = {}) => ({
  label,
  firstFrame,
  lastFrame: firstFrame + poses - 1,
  bounds: { xMin: -20, xMax: 20, yMin: -100, yMax: 0 },
  effectGroups: [],
  poses: Array.from({ length: poses }, (_, index) => [
    { shape: 1, limb: "torso", depth: [23, 1], matrix: [1, 0, 0, 1, 0, -1000 - index * 10] }
  ]),
  limbs: Array.from({ length: poses }, (_, index) => ({ torso: [1, 0, 0, 1, 0, -1000 - index * 10] }))
});

/** A pack that always has `standing` (the size datum) plus whatever is asked for. */
const packOf = (extra) => figurePackFrom(SHAPES, { standing: clip("Standing"), ...extra });
const tableOf = (frames) => clipEffectTableFrom({ clip: 1241, frames });
const blood = (count = 9) => [{ prop: "blood", count }];

/* ------------------------------------------------------------------ *
 * THE PLAN: which pose of the DRAWN run throws what
 * ------------------------------------------------------------------ */

test("blood thrown by a CONTINUATION clip fires, at its pose in the joined run", () => {
  // `hurt8` runs on into `hurt9` (`clip-sequences.js`). Frames here are this
  // pack's own: hurt8 is 100-103 (4 poses), hurt9 is 104-109 (6 poses).
  const pack = packOf({
    hurt8: clip("hurt8", { poses: 4, firstFrame: 100 }),
    hurt9: clip("hurt9", { poses: 6, firstFrame: 104 })
  });
  const table = tableOf({ 100: blood(3), 105: blood(9) });
  const plan = bloodPlanFor(table, pack, { family: "hurt", label: "hurt8" });
  assert.equal(plan.poseCount, 10, "the drawing shows 4 + 6 poses");
  assert.deepEqual(plan.effects.map((effect) => effect.poseIndex), [0, 5],
    "hurt8's own at its pose 0, and hurt9's frame 105 at 4 + (105 - 104)");
});

test("a member the run plays TWICE throws twice, once per pass", () => {
  // `burning` plays `burning` -> `flame_repeat` -> `flame_repeat`. A single
  // clip-frame window over the joined animation would find a call inside the
  // repeat once, at the wrong pose; the build executes that frame on each pass.
  const pack = packOf({
    burning: clip("burning", { poses: 2, firstFrame: 200 }),
    flame_repeat: clip("flame_repeat", { poses: 3, firstFrame: 202 })
  });
  const plan = bloodPlanFor(tableOf({ 203: blood(3) }), pack, { family: "condition:burning", label: "burning" });
  assert.equal(plan.poseCount, 8, "2 + 3 + 3");
  assert.deepEqual(plan.effects.map((effect) => [effect.poseIndex, effect.clipFrame]), [[3, 203], [6, 203]]);
});

test("a death bleeds from the clip the drawing DRAWS, not from the engine's variant name", () => {
  // The engine's death timelines carry `slain`, `yield`, `arrow`, `grievous`
  // or `taunt` — how the gladiator died, not a clip label. The drawing resolves
  // `death:slain` to `death1` (`clip-labels.js`). The shell looked up
  // `animations["slain"]`, found nothing, and no death ever bled.
  const pack = packOf({
    death1: clip("death1", { poses: 5, firstFrame: 585 }),
    deathtaunt: clip("deathtaunt", { poses: 4, firstFrame: 1083 })
  });
  const table = tableOf({ 585: blood(15) });
  const slain = bloodPlanFor(table, pack, { family: "death:slain", label: "slain" });
  assert.equal(slain.label, "death1");
  assert.deepEqual(slain.effects.map((effect) => [effect.poseIndex, effect.clipFrame]), [[0, 585]]);
  assert.equal(slain.poseCount, 5);
  // And a taunting death draws `deathtaunt`, which throws nothing.
  const taunt = bloodPlanFor(table, pack, { family: "death:taunt", label: "taunt" });
  assert.equal(taunt.label, "deathtaunt");
  assert.deepEqual(taunt.effects, []);
});

test("a run the build STOPS short never reaches a call past its stop", () => {
  // `little_fat_kid` spans 2200-2222 in the pack and the build stops at 2216
  // (`SHORT_RUNS`): the drawing shows 17 poses, and a frame past them is never
  // played, so it throws nothing. Sounds are cut the same way (`soundCuesFor`).
  const pack = packOf({ little_fat_kid: clip("little_fat_kid", { poses: 23, firstFrame: 2200 }) });
  const plan = bloodPlanFor(tableOf({ 2210: blood(3), 2220: blood(3) }), pack, {
    family: "little_fat_kid", label: "little_fat_kid"
  });
  assert.equal(plan.poseCount, 17);
  assert.deepEqual(plan.effects.map((effect) => effect.poseIndex), [10]);
});

test("a directional gait bleeds from the clip its FACING draws", () => {
  // Walking left while facing right is a step BACK (`directionalLabel`), and
  // the build draws it as its own clip. The facing is the painter's input, so
  // it is this plan's too. No gait of the shipped build throws blood; the
  // input is honoured so the plan can never resolve a different clip.
  const pack = packOf({
    stepforward: clip("stepforward", { poses: 4, firstFrame: 300 }),
    stepback: clip("stepback", { poses: 4, firstFrame: 310 })
  });
  const table = tableOf({ 312: blood(3) });
  const back = bloodPlanFor(table, pack, { family: "movement:walk", label: "walkleft", facing: "right" });
  assert.equal(back.label, "stepback");
  assert.deepEqual(back.effects.map((effect) => effect.poseIndex), [2]);
  const forward = bloodPlanFor(table, pack, { family: "movement:walk", label: "walkleft", facing: "left" });
  assert.equal(forward.label, "stepforward");
  assert.deepEqual(forward.effects, []);
});

test("no table, no pack or nothing drawable is a plan with no blood — never a throw", () => {
  const pack = packOf({ hurt1: clip("hurt1", { poses: 3, firstFrame: 1144 }) });
  const table = tableOf({ 1144: blood(3) });
  for (const [what, plan] of [
    ["no table", bloodPlanFor(null, pack, { family: "hurt", label: "hurt1" })],
    ["no pack", bloodPlanFor(table, null, { family: "hurt", label: "hurt1" })],
    ["a family the pack cannot draw", bloodPlanFor(table, pack, { family: "block", label: "Block" })]
  ]) {
    assert.deepEqual(plan.effects, [], what);
    assert.equal(plan.label, null, what);
  }
  // The one the pack CAN draw bleeds, so the three above are not vacuous.
  assert.equal(bloodPlanFor(table, pack, { family: "hurt", label: "hurt1" }).effects.length, 1);
});

/* ------------------------------------------------------------------ *
 * FIRING: on the draw whose pose reaches the call, once
 * ------------------------------------------------------------------ */

test("each call fires ONCE, on the first draw whose drawn pose has reached it", () => {
  const pack = packOf({
    hurt8: clip("hurt8", { poses: 4, firstFrame: 100 }),
    hurt9: clip("hurt9", { poses: 6, firstFrame: 104 })
  });
  const plan = bloodPlanFor(tableOf({ 100: blood(3), 105: blood(9) }), pack, { family: "hurt", label: "hurt8" });
  // Ten poses: pose 5 is drawn from at = 0.5, and not a hair before.
  let fired = 0;
  const step = (at) => {
    const result = dueBloodEffects(plan, { at, fired });
    fired = result.fired;
    return result.due.map((effect) => effect.poseIndex);
  };
  assert.deepEqual(step(0), [0], "hurt8's own call, on the first pose");
  assert.deepEqual(step(0), [], "and not again on a redraw of the same pose");
  assert.deepEqual(step(0.4999), [], "pose 4 is still showing");
  assert.deepEqual(step(0.5), [5], "hurt9's call, on the draw that first shows pose 5");
  assert.deepEqual(step(1), [], "nothing is left");
  assert.equal(fired, 2);
});

test("a late draw that jumps past several calls fires each of them, in pose order", () => {
  const pack = packOf({
    hurt8: clip("hurt8", { poses: 4, firstFrame: 100 }),
    hurt9: clip("hurt9", { poses: 6, firstFrame: 104 })
  });
  // Two calls on ONE frame are two calls: the build runs each `bounceitem`.
  const plan = bloodPlanFor(tableOf({ 101: blood(3), 106: [{ prop: "blood", count: 6 }, { prop: "blood", count: 9 }] }),
    pack, { family: "hurt", label: "hurt8" });
  const { due, fired } = dueBloodEffects(plan, { at: 1, fired: 0 });
  assert.deepEqual(due.map((effect) => [effect.poseIndex, effect.count]), [[1, 3], [6, 6], [6, 9]]);
  assert.equal(fired, 3);
});

test("a clip that has not begun, or a plan with nothing in it, fires nothing", () => {
  const pack = packOf({ hurt1: clip("hurt1", { poses: 3, firstFrame: 1144 }) });
  const plan = bloodPlanFor(tableOf({ 1144: blood(3) }), pack, { family: "hurt", label: "hurt1" });
  assert.deepEqual(dueBloodEffects(plan, { at: -0.2, fired: 0 }), { due: [], fired: 0 }, "a victim waiting for impact");
  assert.deepEqual(dueBloodEffects(plan, { at: Number.NaN, fired: 0 }), { due: [], fired: 0 });
  assert.deepEqual(dueBloodEffects(null, { at: 1, fired: 0 }), { due: [], fired: 0 });
  // The same plan at its start does fire, so the three above are not vacuous.
  assert.equal(dueBloodEffects(plan, { at: 0, fired: 0 }).due.length, 1);
});

/* ------------------------------------------------------------------ *
 * EACH CALL ITS OWN SPRAY
 * ------------------------------------------------------------------ */

test("every call of one action sprays differently, and the same action sprays the same way every replay", () => {
  // The build draws fresh random numbers on every `bounceitem` call. One seed
  // per entry made a `hurt8` run's three calls — and a killing blow's hurt
  // and the death queued behind it, which carry ONE action token
  // (`cursor.js`) — five identical drops each time.
  const token = 41;
  const calls = [
    { poseIndex: 0, clipFrame: 1250 }, { poseIndex: 16, clipFrame: 1266 }, { poseIndex: 27, clipFrame: 1277 },
    { poseIndex: 0, clipFrame: 585 },                                        // death1, same token
    { poseIndex: 3, clipFrame: 1952 }, { poseIndex: 18, clipFrame: 1952 }     // one frame, two passes
  ];
  const seeds = calls.map((call) => bloodSeedFor(token, call));
  assert.equal(new Set(seeds).size, calls.length, `distinct seeds: ${seeds.join(", ")}`);
  const sprays = seeds.map((seed) => JSON.stringify(spawnDrops({ seed, frames: 9 })));
  assert.equal(new Set(sprays).size, calls.length, "and so distinct sprays");
  // Another action's first call is not this one's.
  assert.notEqual(bloodSeedFor(token + 1, calls[0]), seeds[0]);
  // Deterministic: a replay of the bout draws the same drops.
  assert.deepEqual(calls.map((call) => bloodSeedFor(token, call)), seeds);
});

/* ------------------------------------------------------------------ *
 * THE SHELL asks the plan, with the painter's own options and clock
 * ------------------------------------------------------------------ */

const SHELL = nodeFs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");

/** Comments out, strings blanked, so a word in prose cannot match. */
function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
}

/** The text of one top-level `function name(...) {...}`, by brace matching. */
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

test("the shell no longer keys blood on the engine's label: a prepared entry starts with no plan and nothing fired", () => {
  const prepare = functionBody(codeOnly(SHELL), "prepareEntry");
  assert.match(prepare, /entry\.bloodPlan = null;\s*entry\.bloodFired = 0;/);
  assert.doesNotMatch(prepare, /effectsForAnimation\(|figurePack\?\.animations/,
    "the un-joined animation keyed by `entry.timeline.label` is gone");
});

test("the draw loop resolves the plan with the PAINTER'S OWN options and fires it by the clock the figure is posed with", () => {
  const stage = functionBody(codeOnly(SHELL), "renderStage");
  // The very object the body and the face are painted with — family, label and
  // facing cannot drift from the drawing's.
  assert.match(stage, /entry\.bloodPlan = bloodPlanFor\(clipEffects, figurePack, figureOptions\)/);
  assert.match(stage, /dueBloodEffects\(entry\.bloodPlan, \{ at: drawnAt, fired: entry\.bloodFired \}\)/);
  assert.match(stage, /entry\.bloodFired = /);
  // The old comparison, against the un-joined pose count, is gone.
  assert.doesNotMatch(stage, /effectPoses|firedEffects|entry\?\.effects/);
  // And each call sprays from its own seed, still rooted in the entry's action token.
  assert.match(stage, /seed: bloodSeedFor\(entry\.token \?\? scene\.sequence, effect\)/);
});

/* ------------------------------------------------------------------ *
 * HEADLESS, AGAINST THE DRAWING — the player's own pack, when this machine has it
 * ------------------------------------------------------------------ */

function readRealAsset(relative) {
  const at = new URL(`../${relative}`, import.meta.url);
  return nodeFs.existsSync(at) ? JSON.parse(nodeFs.readFileSync(at, "utf8")) : null;
}
const REAL_SHAPES = readRealAsset("assets/figure/shapes.json");
const REAL_ANIMATIONS = readRealAsset("assets/figure/animations.json");
const REAL_PACK = REAL_SHAPES && REAL_ANIMATIONS ? figurePackFrom(REAL_SHAPES, REAL_ANIMATIONS) : null;
const REAL_TABLE = clipEffectTableFrom(readRealAsset("assets/props/clip-effects.json"));

/** A draw loop at 60 fps over one timeline: which call fired on which draw, and what that draw showed. */
function drawLoop(plan, timeline, drawnAnimation) {
  const drawMs = 1000 / 60;
  const fired = [];
  let count = 0;
  for (let tick = 0; tick * drawMs <= timeline.durationMs + drawMs; tick += 1) {
    const now = tick * drawMs;
    // The shell's own clock: `at` for the pose, the same `at` for the blood.
    const at = Math.min(1, now / timeline.durationMs);
    const pose = poseIndexAt(drawnAnimation.poses.length, at);
    const result = dueBloodEffects(plan, { at, fired: count });
    count = result.fired;
    for (const effect of result.due) fired.push({ effect, now, pose, limbs: drawnAnimation.limbs[pose] });
  }
  return fired;
}

test("HEADLESS: hurt8's three sprays fire on the draws that SHOW the clip frames calling them, at the build's times", () => {
  // The repository's convention for the gitignored pack: a clone without it
  // passes on the synthetic half above rather than adding a skip.
  if (!REAL_PACK || !REAL_TABLE) {
    assert.ok(!REAL_PACK || !REAL_TABLE, "no extraction on this machine");
    return;
  }
  const timeline = timelineFor("hurt8", { role: "target" });
  for (const facing of ["right", "left"]) {
    const options = { family: timeline.family, label: timeline.label, facing };
    const drawn = animationFor(REAL_PACK, options);
    const plan = bloodPlanFor(REAL_TABLE, REAL_PACK, options);
    // Measured from the pack and the table (`tools/extract-clip-effects.mjs`):
    // hurt8 is 1250-1265 and calls at 1250; hurt9 is 1266-1283 and calls at
    // 1266 and 1277. Before this module the shell reached only the first.
    assert.equal(plan.poseCount, 34, facing);
    assert.deepEqual(plan.effects.map((effect) => [effect.poseIndex, effect.clipFrame]),
      [[0, 1250], [16, 1266], [27, 1277]], facing);

    const fired = drawLoop(plan, timeline, drawn.animation);
    assert.deepEqual(fired.map((entry) => entry.effect.clipFrame), [1250, 1266, 1277], `${facing}: each fires once`);
    for (const { effect, now, pose, limbs } of fired) {
      // THE DRAWN POSE IS THE CALLING FRAME — checked by identity against the
      // member clip's own limb table, which the joined run copies by reference,
      // so this does not go through the plan's arithmetic at all.
      const member = ["hurt8", "hurt9"].map((name) => REAL_PACK.animations[name])
        .find((clip) => effect.clipFrame >= clip.firstFrame && effect.clipFrame <= clip.lastFrame);
      assert.equal(pose, effect.poseIndex, `${facing} ${effect.clipFrame}: fired on the first draw of its pose`);
      assert.equal(limbs, member.limbs[effect.clipFrame - member.firstFrame],
        `${facing} ${effect.clipFrame}: the pose drawn when it fires is that clip frame`);
      // At the build's time for that frame, 30 fps, within one 60 fps draw.
      const buildMs = ((effect.clipFrame - 1250) * 1000) / 30;
      assert.ok(now >= buildMs - 1e-9 && now < buildMs + 1000 / 60,
        `${facing} ${effect.clipFrame}: fired at ${now.toFixed(1)} ms, the build's is ${buildMs.toFixed(1)}`);
    }
  }
});

test("HEADLESS: every timeline the engine can start bleeds from exactly the calls its DRAWN animation makes", () => {
  if (!REAL_PACK || !REAL_TABLE) {
    assert.ok(!REAL_PACK || !REAL_TABLE, "no extraction on this machine");
    return;
  }
  // Independent of the plan: walk the drawn animation's own poses, find the
  // clip frame each one IS by limb identity against every un-joined clip, and
  // collect the frames the table says call `bounceitem`.
  const frameOfLimbs = new Map();
  for (const clip of Object.values(REAL_ANIMATIONS)) {
    clip.limbs?.forEach((limbs, index) => { if (limbs) frameOfLimbs.set(limbs, clip.firstFrame + index); });
  }
  const calling = new Set(Object.keys(REAL_TABLE.frames).map(Number));
  const labels = new Set(Object.keys(REAL_ANIMATIONS));
  // The engine's own death variants, which are not clip labels.
  for (const variant of ["slain", "yield", "taunt", "arrow", "grievous"]) labels.add(variant);
  let bleeding = 0;
  for (const label of labels) {
    for (const role of ["actor", "target", "defeated"]) {
      const timeline = timelineFor(label, { role });
      for (const facing of ["right", "left"]) {
        const options = { family: timeline.family, label: timeline.label, facing };
        const drawn = animationFor(REAL_PACK, options);
        const expected = [];
        drawn?.animation.limbs.forEach((limbs, pose) => {
          const frame = frameOfLimbs.get(limbs);
          if (calling.has(frame)) expected.push([pose, frame]);
        });
        const plan = bloodPlanFor(REAL_TABLE, REAL_PACK, options);
        assert.deepEqual(plan.effects.map((effect) => [effect.poseIndex, effect.clipFrame]), expected,
          `${label} as ${role}, facing ${facing}`);
        if (expected.length > 0) bleeding += 1;
      }
    }
  }
  assert.ok(bleeding > 0, "some timeline bleeds, so the sweep is not vacuous");
  // The death the engine names `slain` is drawn as death1, which bleeds on its first frame.
  const slain = timelineFor("slain", { role: "defeated" });
  assert.deepEqual(bloodPlanFor(REAL_TABLE, REAL_PACK, { family: slain.family, label: slain.label })
    .effects.map((effect) => [effect.poseIndex, effect.clipFrame]), [[0, 585]]);
});
