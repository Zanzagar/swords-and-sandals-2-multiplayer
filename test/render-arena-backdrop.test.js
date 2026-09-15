/**
 * THE ARENA SCREEN and the build's own camera, which is LIVE.
 *
 * ► **These tests pin DERIVED numbers, and the thing they are guarding against
 *   is a plausible correction.** Every constant in `arena-backdrop.js` is read
 *   off the oracle, including three that look like defects — two zoom bands
 *   that can never fire, a pan that lags the zoom by a frame, and an opening
 *   zoom of 5 that looks like a sentinel and is an establishing shot. A future
 *   reader who "tidies" any of them has changed the build's behaviour, and
 *   these say so at the assertion rather than in a comment.
 *
 * ► **AND ONE OF THEM ALREADY COST A RETRACTION.** The first version of this
 *   file asserted that the camera opened SETTLED, on the mistaken ground that
 *   the build never initialised `zoomscale`. It sets it to 5. See the module's
 *   own header for the two reading errors that produced that, both mine.
 *
 * ► **WHAT NO TEST HERE CAN DO IS TELL YOU IT LOOKS RIGHT.** A camera that
 *   frames the fight and a camera that frames the sand pass identically. The
 *   check for that is `LOOK AT IT`, which is the standing first item.
 */
import assert from "node:assert/strict";
import test from "node:test";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RANK_DEPTH_FACTOR,
  SS2_ARENA_ORIGIN,
  SS2_ARENA_SCREEN_LAYERS,
  SS2_CAMERA,
  SS2_GROUND_LINE,
  SS2_STAGE,
  arenaScreenLayersFor,
  arenaToStage,
  cameraFor,
  groundLineAt,
  cameraStep,
  easeZoom,
  focusXFor,
  hasArenaScreen,
  midwaypointFor,
  panStep,
  splitArenaScreen,
  layerPlacementFor,
  SS2_ARENA_OFFSET,
  SS2_ARENA_DRESSING,
  SS2_GLADIATORS_ORDER,
  FIGURE_HALF_WIDTH,
  fitZoomFor,
  targetZoomFor,
  frameForLayer,
  stageFitFor,
  stageClipRectFor,
  stageProjectorFor,
  zoomTargetFor,
  SS2_UI_BAR_READOUTS,
  SS2_UI_BAR_UNPLACED,
  uiBarReadoutsFor,
  hasUiBarReadouts
} from "../src/render/arena-backdrop.js";
import { SS2_ARENA } from "../src/team/ss2-rules.js";
import { propOpsFor } from "../src/render/props.js";
import { fieldsPlacedIn, textPackFrom } from "../src/render/text.js";
import { indexCharacters, resolveTimeline, flattenFrame } from "../tools/swf-display-list.mjs";
import { analyseSwfBuffer } from "../tools/inspect-swf.mjs";
import { parseShape } from "../tools/swf-shapes.mjs";
import { rootTimeline } from "../tools/extract-screens.mjs";

/**
 * Stage coordinates are the product of measured decimals (319.95, 166.75) and a
 * zoom fraction, so `319.95 - 250` is 69.94999999999999 in doubles. A renderer
 * does not care about 1e-14 of a pixel and `assert.equal` does, so the mapping
 * is compared at a tolerance — **which is a statement about doubles, not a
 * loosened assertion**: 0.0001px would still fail every real defect here.
 *
 * ► **A `function` DECLARATION RATHER THAN AN ARROW, AND THAT IS NOT STYLE.**
 *   `ss2-assertion-quality.test.js` follows one level of indirection to decide
 *   whether a test asserts, and it finds a helper's body by looking for the
 *   next `{` BEFORE the next newline. An arrow whose expression sits on the
 *   following line therefore reads as having no body, so five tests here
 *   reported as asserting nothing. **The guard is right to be conservative and
 *   was not touched**; the helper moved to the shape it can see.
 */
function near(actual, expected, what) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${what ?? "value"}: ${actual} !~ ${expected}`);
}

/**
 * The camera after it has finished easing in — `cameraFor` is the build's FIRST
 * frame, not its resting one, because `_global.zoomscale` starts at 5 and
 * rushes in. Anything asking "where does the camera end up" has to run it.
 */
function settle(xs, frames = 120) {
  let camera = cameraFor(xs);
  for (let frame = 0; frame < frames; frame += 1) camera = cameraStep(camera, xs);
  return camera;
}

/* ---------------------------------------------------------------- */
/* The mapping                                                       */
/* ---------------------------------------------------------------- */

test("the ground line is the arena origin plus the front rank, and NOT a guess", () => {
  // The number a previous session called "the unknown that would put gladiators
  // in the sky if guessed". It is `SS2_ARENA.frontY`, which this engine has
  // shipped since position landed — so the two must agree by construction.
  assert.equal(SS2_ARENA.frontY, 200);
  assert.equal(SS2_GROUND_LINE, SS2_ARENA_ORIGIN.y + SS2_ARENA.frontY);
  assert.equal(SS2_GROUND_LINE, 366.75);
});

test("the stage is the backdrop's own size, to the pixel", () => {
  const backdrop = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.character === 643);
  assert.ok(backdrop, "the backdrop is layer one");
  assert.deepEqual({ width: SS2_STAGE.width, height: SS2_STAGE.height }, { width: 640, height: 420 });
  assert.deepEqual({ x: backdrop.x, y: backdrop.y }, { x: 0, y: 0 });
  assert.equal(backdrop.scale, 1);
});

test("a fighter at the vanilla front rank lands where the build puts him", () => {
  // `_x = ±250`, `_y = 200`, unscaled, arena at (319.95, 166.75).
  const camera = { zoomscale: 100, gladiatorsX: 0 };
  const hero = arenaToStage(camera, { x: -SS2_ARENA.frontX, y: 200, lift: 0 });
  const villain = arenaToStage(camera, { x: SS2_ARENA.frontX, y: 200, lift: 0 });
  near(hero.x, 69.95, "the hero's stage x");
  near(villain.x, 569.95, "the villain's stage x");
  near(hero.y, SS2_GROUND_LINE, "the hero stands on the ground line");
  near(villain.y, SS2_GROUND_LINE, "the villain stands on the ground line");
  // Both inside the stage, which is what makes a fixed camera correct for a
  // vanilla 1v1 and only for a vanilla 1v1.
  assert.ok(hero.x > 0 && villain.x < SS2_STAGE.width);
});

test("depth lifts a figure up the stage and so does height", () => {
  const camera = { zoomscale: 100, gladiatorsX: 0 };
  const front = arenaToStage(camera, { x: 0, y: 200, lift: 0 });
  const oneRankBack = arenaToStage(camera, { x: 0, y: 200 - SS2_ARENA.rankStride, lift: 0 });
  const jumping = arenaToStage(camera, { x: 0, y: 200, lift: 97 });

  near(front.y, SS2_GROUND_LINE, "the front rank IS the ground line at full zoom");
  assert.ok(oneRankBack.y < front.y, "a rank back draws higher up the stage");
  assert.ok(jumping.y < front.y, "and so does a jump");
  // At factor 1 a rank back and an equal lift land on the same line, which is
  // the build's own arithmetic: `_y` is the only vertical axis it has.
  near(oneRankBack.y, jumping.y, "one stride back and one stride up agree at factor 1");
  assert.equal(RANK_DEPTH_FACTOR, 1);
});

test("EVERY rank lands on the painted sand, which is what set the depth factor", () => {
  // ► The arena clip's ground art spans local y -56.75..256.2, measured off
  //   char 673 on the oracle. At factor 1.7 the back rank sits at local
  //   y -129.8 — above the sand, standing in the crowd. This is the assertion
  //   that would fail if somebody restored the authored factor.
  const SAND_TOP = -56.75;
  const SAND_FRONT = 256.2;
  for (let rank = 0; rank < SS2_ARENA.rankCount; rank += 1) {
    const arenaY = 200 - rank * SS2_ARENA.rankStride;
    const localY = arenaY * RANK_DEPTH_FACTOR;
    assert.ok(localY > SAND_TOP && localY < SAND_FRONT,
      `rank ${rank} draws at arena-local y ${localY}, off sand that runs ${SAND_TOP}..${SAND_FRONT}`);
  }
});

test("the camera scales x and y together — an arena that zooms on one axis is a squash", () => {
  const half = { zoomscale: 50, gladiatorsX: 0 };
  const at = arenaToStage(half, { x: 250, y: 100, lift: 0 });
  near(at.x, SS2_ARENA_ORIGIN.x + 250 * 0.5, "x halves");
  near(at.y, SS2_ARENA_ORIGIN.y + 100 * 0.5, "and so does y, about the arena's own origin");
});

test("ZOOMING OUT WALKS THE FIGHTERS UP THE SAND — the ground line is not fixed", () => {
  // ► `combatscale` scales `gladiators` and nothing else: the sand is its
  //   SIBLING inside the arena clip, not its parent. So a zoom-out shrinks the
  //   fighters and lifts them toward the horizon while the ground stays put,
  //   which is what a 2D camera pulling back looks like. A projection that
  //   pinned the ground line would slide every fighter off the painted sand.
  const full = groundLineAt({ zoomscale: 100, gladiatorsX: 0 });
  const half = groundLineAt({ zoomscale: 50, gladiatorsX: 0 });
  const wide = groundLineAt({ zoomscale: 30, gladiatorsX: 0 });
  near(full, SS2_GROUND_LINE, "at full zoom it is the quoted number");
  assert.ok(half < full && wide < half, `the ground line rose: ${full} -> ${half} -> ${wide}`);
  near(half, SS2_ARENA_ORIGIN.y + 100, "and it is exactly the arena origin plus 200 * zoom");
});

test("the pan moves x and leaves the ground line alone", () => {
  const panned = { zoomscale: 100, gladiatorsX: -120 };
  const at = arenaToStage(panned, { x: 0, y: 200, lift: 0 });
  near(at.x, SS2_ARENA_ORIGIN.x - 120, "the pan is on x");
  near(at.y, SS2_GROUND_LINE, "panning sideways must not move the ground");
});

/* ---------------------------------------------------------------- */
/* The stage fit                                                     */
/* ---------------------------------------------------------------- */

test("the stage is LETTERBOXED into a canvas, never stretched", () => {
  const wide = stageFitFor({ width: 1280, height: 420 });
  assert.equal(wide.scale, 1, "height binds");
  assert.equal(wide.offsetX, (1280 - 640) / 2);
  assert.equal(wide.offsetY, 0);

  const tall = stageFitFor({ width: 640, height: 840 });
  assert.equal(tall.scale, 1, "width binds");
  assert.equal(tall.offsetY, (840 - 420) / 2);

  const exact = stageFitFor({ width: 1280, height: 840 });
  assert.equal(exact.scale, 2, "a canvas of the same aspect fills it");
  assert.deepEqual({ x: exact.offsetX, y: exact.offsetY }, { x: 0, y: 0 });
});

test("a degenerate canvas gets the stage's own size rather than a NaN scale", () => {
  // The shell sizes the canvas from a `getBoundingClientRect` that is 0x0 on
  // the first frame of a hidden tab. A NaN scale there paints nothing and
  // reports nothing.
  for (const size of [{ width: 0, height: 0 }, { width: -5, height: 10 }, {}]) {
    const fit = stageFitFor(size);
    assert.ok(Number.isFinite(fit.scale) && fit.scale > 0, `finite scale for ${JSON.stringify(size)}`);
  }
});

/* ---------------------------------------------------------------- */
/* The camera                                                        */
/* ---------------------------------------------------------------- */

test("midwaypoint is half the SPREAD, and at a vanilla 1v1 it is half the separation", () => {
  // `getfightdistance` +0x0467: `midwaypoint = round(fightdistance / 2)`.
  // Vanilla's opening is ±250, a separation of 500.
  assert.equal(midwaypointFor([-250, 250]), 250);
  assert.equal(focusXFor([-250, 250]), 0, "the focus opens on the arena's own origin");
  // Six on the field: the spread is what has to be framed, which is the stated
  // divergence — vanilla cannot distinguish the two because it has one pair.
  assert.equal(midwaypointFor([-510, -413, -316, 316, 413, 510]), 510);
  assert.equal(focusXFor([-510, -413, -316, 316, 413, 510]), 0);
});

test("an unplaced or single actor gives a camera rather than a NaN", () => {
  assert.equal(midwaypointFor([]), 0);
  assert.equal(midwaypointFor([120]), 0);
  assert.equal(midwaypointFor([null, undefined, Number.NaN]), 0);
  assert.equal(focusXFor([]), 0);
  assert.equal(focusXFor([120]), 120, "one gladiator IS the middle of the fight");
});

test("SEVEN declared zoom bands resolve to FIVE, because the fourth eats three of them", () => {
  // ► `combatscale`'s seven tests are sequential `if`s, so the LAST match wins
  //   — and the fourth is `> 200 && !(> 400)`, which swallows the 70 and 60
  //   arms whole and takes a slice out of the 80 arm too. This asserts they
  //   are dead, so that "fixing" the table into an else-if chain fails here
  //   rather than silently changing the game.
  //
  //   **The first version of this test asserted 80 at a midwaypoint of 239**,
  //   which is what the declared table looks like it says. It is not what it
  //   does, and the code was right.
  assert.equal(zoomTargetFor(200), 80, "the 80 band survives only up to 200");
  assert.equal(zoomTargetFor(239), 50, "239 is inside `< 240` AND inside `> 200` — the later arm wins");
  assert.equal(zoomTargetFor(250), 50, "the 70 band is DEAD — overwritten by the 50 arm");
  assert.equal(zoomTargetFor(350), 50, "the 60 band is DEAD — overwritten by the 50 arm");
  assert.equal(zoomTargetFor(401), 30);
  assert.equal(zoomTargetFor(701), 20);
  assert.equal(zoomTargetFor(1501), 15);

  // Swept rather than sampled: the reachable set is what a renderer can show.
  const reachable = new Set();
  for (let mp = 0; mp <= 2200; mp += 1) reachable.add(zoomTargetFor(mp));
  assert.deepEqual([...reachable].sort((left, right) => left - right), [15, 20, 30, 50, 80]);
  assert.equal(SS2_CAMERA.bands.length, 7, "all seven are kept, so the finding is visible");
});

test("the band boundaries are the build's own inclusivity, which is not uniform", () => {
  // `< 240` is strict; every other arm is `> min && !(> max)`, so `max` is IN.
  assert.equal(zoomTargetFor(240), 50, "240 fails `< 240` and passes `> 200 && !(> 400)`");
  assert.equal(zoomTargetFor(400), 50, "400 is inside `!(> 400)`");
  assert.equal(zoomTargetFor(700), 30, "700 is inside `!(> 700)`");
  assert.equal(zoomTargetFor(1500), 20, "1500 is inside `!(> 1500)`");
  // And it is MONOTONE: closing must never zoom you out.
  let previous = zoomTargetFor(0);
  for (let mp = 1; mp <= 2200; mp += 1) {
    const here = zoomTargetFor(mp);
    assert.ok(here <= previous, `zoom rose from ${previous} to ${here} at midwaypoint ${mp}`);
    previous = here;
  }
});

test("the zoom EASES by a fifth and then SNAPS, so it converges", () => {
  // `+0x0994`..`+0x0a7c`. Math.round is the build's and is why a gap of 4 or
  // less lands on the snap rather than crawling.
  assert.equal(easeZoom(80, 50), 80 - Math.round(30 / 5));
  assert.equal(easeZoom(15, 50), 15 + Math.round(35 / 5));
  assert.equal(easeZoom(52, 50), 50, "inside ±4 it snaps");
  assert.equal(easeZoom(50, 50), 50);

  // And it actually reaches the target from both directions in finite frames.
  for (const [from, to] of [[80, 15], [15, 80], [50, 30], [20, 80]]) {
    let value = from;
    let frames = 0;
    while (value !== to && frames < 100) {
      value = easeZoom(value, to);
      frames += 1;
    }
    assert.equal(value, to, `${from} -> ${to} converges`);
    assert.ok(frames < 100, `${from} -> ${to} took ${frames} frames`);
  }
});

test("an uninitialised zoom takes the target rather than becoming NaN", () => {
  // ► The build's own defect: `arena.zoomscale` is assigned nowhere before
  //   `combatscale` reads it, so `Math.ceil(undefined)` would set the arena's
  //   scale to NaN on the first frame. Named in the module and pinned here.
  assert.equal(easeZoom(undefined, 50), 50);
  assert.equal(easeZoom(Number.NaN, 80), 80);
});

test("the pan has a DEAD ZONE straddling the arena origin, and eases by a sixteenth", () => {
  assert.equal(SS2_CAMERA.deadZoneLeft, 300);
  assert.equal(SS2_CAMERA.deadZoneRight, 340);
  // Centred: 320 is inside 300..340, so nothing moves.
  assert.equal(panStep(0, 320), 0);
  assert.equal(panStep(0, 300), 0, "the boundary is not outside it");
  assert.equal(panStep(0, 340), 0);
  // Too far left -> the layer slides RIGHT to bring it back.
  assert.equal(panStep(0, 300 - 160), 160 / 16);
  // Too far right -> the layer slides LEFT.
  assert.equal(panStep(0, 340 + 160), -160 / 16);
});

test("the pan converges on the dead zone instead of oscillating across it", () => {
  let camera = cameraFor([0, 0]);
  camera = { ...camera, gladiatorsX: -400 };
  const seen = [];
  for (let frame = 0; frame < 200; frame += 1) {
    camera = cameraStep(camera, [-250, 250]);
    seen.push(camera.gladiatorsX);
  }
  const focusStageX = SS2_ARENA_ORIGIN.x + camera.gladiatorsX + 0 * (camera.zoomscale / 100);
  assert.ok(focusStageX >= SS2_CAMERA.deadZoneLeft - 1 && focusStageX <= SS2_CAMERA.deadZoneRight + 1,
    `the focus settled at stage x ${focusStageX}, outside the dead zone`);
  // Monotone, not a sawtooth: an ease that overshoots reads as a shudder.
  const reversals = seen.slice(2).filter((value, index) =>
    Math.sign(value - seen[index + 1]) !== 0 &&
    Math.sign(value - seen[index + 1]) !== Math.sign(seen[index + 1] - seen[index])).length;
  assert.ok(reversals <= 1, `the pan reversed direction ${reversals} times`);
});

test("A BOUT OPENS AT A ZOOM OF FIVE AND RUSHES IN — the build's establishing shot", () => {
  // \u25ba `_global.zoomscale = 5` at +0x0c7c, on the arena clip's own frame 1.
  //   An earlier version of this file opened SETTLED on the mistaken ground
  //   that the build never initialised it. It does, and 5 is the shot.
  const opening = cameraFor([-250, 250]);
  assert.equal(SS2_CAMERA.zoomStart, 5);
  assert.equal(opening.zoomscale, 5, "the arena opens at a twentieth of its size");
  assert.equal(opening.midwaypoint, 250);
  assert.equal(opening.maxscale, zoomTargetFor(250), "but it already knows where it is going");
  assert.equal(opening.gladiatorsX, 0, "root frame 221 sets gladiators._x = 0 explicitly");
  assert.equal(opening.crowdY, SS2_CAMERA.crowdBaseY + 5);
});

test("the rush-in reaches the target, and takes about half a second doing it", () => {
  let camera = cameraFor([-250, 250]);
  const target = camera.maxscale;
  const seen = [camera.zoomscale];
  let frames = 0;
  while (camera.zoomscale !== target && frames < 300) {
    camera = cameraStep(camera, [-250, 250]);
    seen.push(camera.zoomscale);
    frames += 1;
  }
  assert.equal(camera.zoomscale, target, `never settled; saw ${seen.slice(0, 12).join(" -> ")}`);
  // At 30fps the build's frame rate, this is the length of the opening move.
  assert.ok(frames > 1 && frames < 40, `settled in ${frames} frames, which is ${(frames / 30).toFixed(2)}s`);
  // MONOTONE up: an establishing shot that wobbles is a bug, not a flourish.
  for (let index = 1; index < seen.length; index += 1) {
    assert.ok(seen[index] >= seen[index - 1], `the zoom fell at frame ${index}: ${seen.join(",")}`);
  }
});

test("closing to reach ZOOMS IN, and a 3v3 at its widest ZOOMS OUT", () => {
  // The whole point of wiring the camera up: a fixed stage cannot hold a 3v3.
  const apart = settle([-510, 510]);
  const closed = settle([-65, 66]);
  assert.ok(closed.zoomscale > apart.zoomscale,
    `closing must zoom IN: ${apart.zoomscale} -> ${closed.zoomscale}`);

  // And at that zoom the whole 3v3 is inside the stage, which is the thing a
  // fixed 1:1 camera could not do.
  const camera = settle([-510, -413, -316, 316, 413, 510]);
  for (const x of [-510, 510]) {
    const at = arenaToStage(camera, { x, y: 200, lift: 0 });
    assert.ok(at.x > 0 && at.x < SS2_STAGE.width,
      `arena x ${x} drew at stage ${at.x.toFixed(1)}, off a ${SS2_STAGE.width}px stage`);
  }
});

test("a 3v3 on a FIXED camera would fall off the stage — the divergence is load-bearing", () => {
  // Stated as a test so the reason for wiring `combatscale` up is measured
  // rather than asserted in prose. This is what the build ships.
  const fixed = { zoomscale: 100, gladiatorsX: 0 };
  const offStage = [-510, 510]
    .map((x) => arenaToStage(fixed, { x, y: 200, lift: 0 }).x)
    .filter((x) => x < 0 || x > SS2_STAGE.width);
  assert.equal(offStage.length, 2, "both 3v3 flanks are off a fixed 640px stage");
});

test("the crowd rises as the camera pulls back, which is the build's one parallax", () => {
  const close = settle([-60, 60]);
  const far = settle([-1600, 1600]);
  assert.ok(far.crowdY < close.crowdY, `crowd y ${far.crowdY} should sit above ${close.crowdY}`);
  assert.equal(close.crowdY, SS2_CAMERA.crowdBaseY + Math.ceil(close.zoomscale));
});

test("the camera step PANS AGAINST THE OLD ZOOM, which is the build's order", () => {
  // ► `combatscale` computes the focus's stage position, pans, and only THEN
  //   re-targets the zoom — so a frame that does both lags the zoom by one.
  //   Reproduced deliberately; a reader who "corrects" the order fails here.
  const camera = { midwaypoint: 0, focusX: 0, zoomscale: 80, maxscale: 80, gladiatorsX: 0, crowdY: -120 };
  const stepped = cameraStep(camera, [400, 1400]);
  const focusStageX = SS2_ARENA_ORIGIN.x + 0 + 900 * (80 / 100);
  assert.equal(stepped.gladiatorsX, panStep(0, focusStageX),
    "the pan used the OLD zoom of 80, not the new target");
  assert.equal(stepped.maxscale, zoomTargetFor(500));
  assert.notEqual(stepped.zoomscale, 80, "and the zoom did move on the same frame");
});

/* ---------------------------------------------------------------- */
/* The layers                                                        */
/* ---------------------------------------------------------------- */

test("the layer stack is the build's own nesting order, with nothing reordered", () => {
  assert.deepEqual(SS2_ARENA_SCREEN_LAYERS.map((layer) => layer.prop),
    ["backdrop", "sky", "sand", "crowd", "rain", "panel", "border"]);
  assert.deepEqual(SS2_ARENA_SCREEN_LAYERS.map((layer) => layer.character),
    [643, 1729, 673, 2112, 1816, 1531, 646]);
  const orders = SS2_ARENA_SCREEN_LAYERS.map((layer) => layer.order);
  assert.deepEqual([...orders].sort((left, right) => left - right), orders, "declared in paint order");
  assert.equal(new Set(orders).size, orders.length, "no two layers share a slot");
  assert.ok(!orders.includes(SS2_GLADIATORS_ORDER), "the fighters' slot belongs to the fighters");
});

test("THE FIGHTERS PAINT BETWEEN THE CROWD AND THE RAIN, not over everything", () => {
  // ► Painting all the scenery and then all the bodies reads as correct on a
  //   still and is wrong the moment an arrow crosses the ornamental border.
  const ops = () => [{ kind: "path", d: "M0 0L1 1Z" }];
  const { behind, inFront } = splitArenaScreen(arenaScreenLayersFor({ props: {} }, ops, cameraFor([-250, 250])));
  assert.deepEqual(behind.map((layer) => layer.prop), ["backdrop", "sky", "sand", "crowd"]);
  assert.deepEqual(inFront.map((layer) => layer.prop), ["rain", "panel", "border"]);
  assert.equal(behind.length + inFront.length, SS2_ARENA_SCREEN_LAYERS.length, "nothing is dropped");
});

test("splitArenaScreen survives an empty or absent list", () => {
  assert.deepEqual(splitArenaScreen([]).behind, []);
  assert.deepEqual(splitArenaScreen(null).inFront, []);
});

test("an ARENA-space layer gets the clip's origin added and a STAGE one does not", () => {
  const camera = cameraFor([-250, 250]);
  const sand = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "sand");
  const border = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "border");

  near(layerPlacementFor(sand, camera).x, SS2_ARENA_OFFSET.x - 323.95, "the sand is arena-local");
  near(layerPlacementFor(border, camera).x, -25.55, "the border is already stage");
  near(layerPlacementFor(border, camera).y, -33);
});

test("THE CROWD IS THE ONLY LAYER THE CAMERA MOVES, and it moves on y alone", () => {
  const crowd = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "crowd");
  const close = layerPlacementFor(crowd, settle([-60, 60]));
  const far = layerPlacementFor(crowd, settle([-1600, 1600]));
  assert.ok(far.y < close.y, `the crowd rose: ${close.y} -> ${far.y}`);
  near(far.x, close.x, "and it never moves sideways");

  // Every OTHER layer is identical at both cameras.
  for (const layer of SS2_ARENA_SCREEN_LAYERS.filter((entry) => entry.prop !== "crowd")) {
    assert.deepEqual(layerPlacementFor(layer, settle([-60, 60])),
      layerPlacementFor(layer, settle([-1600, 1600])), `${layer.prop} must not move`);
  }
});

test("a camera with no crowdY leaves the crowd on its TIMELINE placement", () => {
  const crowd = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "crowd");
  near(layerPlacementFor(crowd, null).y, SS2_ARENA_OFFSET.y - 110.5);
  // ► And the timeline's -110.5 is NOT the camera's first value: `-200 +
  //   ceil(100)` is -100, so the build shifts the crowd 10.5 units the moment
  //   the camera runs a frame, fight or no fight.
  near(layerPlacementFor(crowd, settle([-100, 100])).y,
    SS2_ARENA_OFFSET.y + SS2_CAMERA.crowdBaseY + Math.ceil(settle([-100, 100]).zoomscale));
  assert.notEqual(crowd.y, SS2_CAMERA.crowdBaseY + 100);
});

test("the sky is the one scaled placement on the frame", () => {
  const scaled = SS2_ARENA_SCREEN_LAYERS.filter((layer) => layer.scale !== 1);
  assert.equal(scaled.length, 1);
  assert.equal(scaled[0].instance, "sky");
  assert.equal(scaled[0].scale, 1.04);
  // ► And that retires "every transform on frame 221 is 1.00", which a
  //   handoff states and which is false. What IS 1.00 is the arena's own
  //   placement, and that is the transform the 1:1 claim rests on — which is
  //   why SS2_ARENA_ORIGIN can be read straight off it.
  assert.equal(SS2_ARENA_ORIGIN.x, 319.95);
  assert.equal(SS2_ARENA_ORIGIN.y, 166.75);
});

test("a missing pack draws nothing and throws nothing", () => {
  const ops = () => [{ kind: "path", d: "M0 0L1 1Z" }];
  assert.deepEqual(arenaScreenLayersFor(null, ops), []);
  assert.deepEqual(arenaScreenLayersFor({}, null), []);
  assert.equal(hasArenaScreen(null, ops), false);
});

test("a PARTIAL pack draws what it has — a missing rain layer is a missing rain layer", () => {
  const only = new Set(["backdrop", "sand"]);
  const propOpsFor = (pack, { linkage }) =>
    only.has(linkage) ? [{ kind: "path", d: `M0 0L1 1Z ${linkage}` }] : null;

  const layers = arenaScreenLayersFor({ props: {} }, propOpsFor);
  assert.deepEqual(layers.map((layer) => layer.prop), ["backdrop", "sand"]);
  assert.equal(hasArenaScreen({ props: {} }, propOpsFor), true);
});

test("a pack that THROWS on one linkage does not take the other five with it", () => {
  const propOpsFor = (pack, { linkage }) => {
    if (linkage === "sky") throw new Error("truncated");
    return [{ kind: "path", d: "M0 0L1 1Z" }];
  };
  const layers = arenaScreenLayersFor({ props: {} }, propOpsFor);
  assert.deepEqual(layers.map((layer) => layer.prop),
    ["backdrop", "sand", "crowd", "rain", "panel", "border"]);
});

/* ---------------------------------------------------------------- */
/* The projector — the last arithmetic out of the shell              */
/* ---------------------------------------------------------------- */

test("the projector agrees with the mapping it is built from, at every zoom", () => {
  // ► The shell used to compute `toX`/`toY` itself, where nothing could reach
  //   them. This asserts the closures ARE `arenaToStage` and `stageFitFor`
  //   composed, so a future edit to either cannot drift from the other.
  const fit = stageFitFor({ width: 1280, height: 840 });
  for (const zoomscale of [100, 80, 50, 30, 15]) {
    for (const gladiatorsX of [0, -240, 137.5]) {
      const camera = { zoomscale, gladiatorsX };
      const view = stageProjectorFor(camera, fit);
      for (const x of [-2100, -510, 0, 250, 2100]) {
        const expected = arenaToStage(camera, { x, y: 200, lift: 0 });
        near(view.toX(x), fit.offsetX + expected.x * fit.scale, `toX(${x}) at zoom ${zoomscale}`);
      }
      for (const [y, lift] of [[200, 0], [103, 0], [6, 0], [200, 97], [200, -22]]) {
        const expected = arenaToStage(camera, { x: 0, y, lift });
        near(view.toY(y, lift), fit.offsetY + expected.y * fit.scale, `toY(${y}, ${lift})`);
      }
      near(view.scale, fit.scale * zoomscale / 100, "scale is arena units per canvas pixel");
    }
  }
});

test("the projector's toY defaults its lift, because the shell calls it both ways", () => {
  const fit = stageFitFor({ width: 640, height: 420 });
  const view = stageProjectorFor({ zoomscale: 100, gladiatorsX: 0 }, fit);
  near(view.toY(200), view.toY(200, 0), "an omitted lift is zero, not NaN");
  assert.ok(Number.isFinite(view.horizon));
});

test("a null camera projects at full zoom rather than throwing", () => {
  // The first frame can run before the roster is laid out; a stack trace where
  // the arena should be is a worse outcome than an unzoomed one.
  const fit = stageFitFor({ width: 640, height: 420 });
  const view = stageProjectorFor(null, fit);
  near(view.toX(250), 569.95, "an absent camera is zoom 100, pan 0");
  near(view.toY(200, 0), SS2_GROUND_LINE);
});

/* ---------------------------------------------------------------- */
/* Dressing — six arenas, six skies, and dry by default              */
/* ---------------------------------------------------------------- */

test("SIX ARENAS, and the sand and the stands are dressed by the SAME index", () => {
  // ► `sand.gotoAndStop(current_arena)` (+0x0d0f) and
  //   `crowd.gotoAndStop(current_arena)` (+0x0c99) — one choice, both clips, so
  //   a ground and its stands can never come from different arenas.
  const sand = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "sand");
  const crowd = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "crowd");
  assert.equal(sand.frameFrom, "arena");
  assert.equal(crowd.frameFrom, "arena");
  for (const arena of [1, 2, 3, 4, 5, 6]) {
    assert.equal(frameForLayer(sand, { arena }), arena);
    assert.equal(frameForLayer(crowd, { arena }), arena, "the stands follow the ground");
  }
});

test("the sky is dressed by the HOUR, and nothing else on the screen is", () => {
  const sky = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "sky");
  assert.equal(sky.frameFrom, "timeOfDay");
  assert.equal(frameForLayer(sky, { timeOfDay: 17 }), 17);
  assert.equal(frameForLayer(sky, { arena: 4 }), 1, "the arena choice must not move the sky");
  const byHour = SS2_ARENA_SCREEN_LAYERS.filter((layer) => layer.frameFrom === "timeOfDay");
  assert.deepEqual(byHour.map((layer) => layer.prop), ["sky"]);
});

test("THE DEFAULT IS DRY, and dry is a real frame rather than a missing layer", () => {
  // ► The rain clip's frames 1-9 place nothing; 10-17 carry the weather. So
  //   asking for frame 1 is asking for a clear arena, and a renderer that
  //   drops the layer for having no ops is agreeing with the build.
  assert.equal(SS2_ARENA_DRESSING.weather, 1);
  const rain = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "rain");
  assert.equal(frameForLayer(rain, SS2_ARENA_DRESSING), 1);
  assert.equal(frameForLayer(rain, { weather: 12 }), 12, "and it can be made to rain");
});

test("a layer with no frameFrom is always frame 1, whatever the dressing", () => {
  for (const layer of SS2_ARENA_SCREEN_LAYERS.filter((entry) => !entry.frameFrom)) {
    assert.equal(frameForLayer(layer, { arena: 5, timeOfDay: 9, weather: 14 }), 1,
      `${layer.prop} has one frame and must ignore the dressing`);
  }
});

test("nonsense dressing falls back to frame 1 rather than asking for frame NaN", () => {
  const sand = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "sand");
  for (const arena of [0, -3, "banana", null, undefined, Number.NaN, 2.7]) {
    const frame = frameForLayer(sand, { arena });
    assert.ok(Number.isInteger(frame) && frame >= 1, `arena=${String(arena)} gave frame ${frame}`);
  }
  assert.equal(frameForLayer(sand, { arena: 2.7 }), 2, "a fractional arena truncates");
});

test("the dressing reaches the resolver, and each layer records the frame it took", () => {
  const seen = [];
  const propOpsFor = (pack, { linkage, frame }) => {
    seen.push(`${linkage}@${frame}`);
    return [{ kind: "path", d: "M0 0L1 1Z" }];
  };
  const layers = arenaScreenLayersFor({ props: {} }, propOpsFor, cameraFor([-250, 250]),
    { arena: 4, timeOfDay: 11, weather: 13 });
  assert.ok(seen.includes("sand@4") && seen.includes("crowd@4"), `asked for ${seen.join(" ")}`);
  assert.ok(seen.includes("sky@11"));
  assert.ok(seen.includes("rain@13"));
  assert.ok(seen.includes("backdrop@1") && seen.includes("border@1"));
  assert.equal(layers.find((layer) => layer.prop === "sand").frame, 4,
    "a drawn layer says which frame it came from");
});

test("the sky clock runs 1..200, so the NIGHT frames are selectable", () => {
  // ► `time_of_day` starts at `1 + random(23)` and `day_night_cycle` increments
  //   it toward 200 on a 1500ms interval while a battle is on. Reading the
  //   bound as 1..23 made frames 112..200 — the masked night frames — look
  //   unreachable, and nearly got the moon's glow written off as a non-defect.
  const sky = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "sky");
  for (const hour of [1, 23, 25, 112, 199, 200]) {
    assert.equal(frameForLayer(sky, { timeOfDay: hour }), hour,
      `hour ${hour} must be selectable`);
  }
});

/* ---------------------------------------------------------------- */
/* Framing — the defect the owner found by looking at it            */
/* ---------------------------------------------------------------- */

/** The roster shapes the browser arena actually builds, at `rankStride` 97. */
const ROSTERS = Object.freeze({
  "1v1": [{ x: -250, side: "hero" }, { x: 250, side: "villain" }],
  "2v2": [{ x: -380, side: "hero" }, { x: -250, side: "hero" },
    { x: 250, side: "villain" }, { x: 380, side: "villain" }],
  "3v3": [{ x: -510, side: "hero" }, { x: -380, side: "hero" }, { x: -250, side: "hero" },
    { x: 250, side: "villain" }, { x: 380, side: "villain" }, { x: 510, side: "villain" }]
});

test("midwaypoint is the CLOSEST ENGAGEMENT, not the width of the formation", () => {
  // ► **THE DEFECT THE OWNER SAW: "the zoom appears to be way too far out".**
  //   The first version took the spread of every placed actor, so a 3v3 opening
  //   — dominated by the outermost ALLIES, who are fighting nobody — reported
  //   510 and dropped the zoom to 30. The build's own number is half the
  //   distance between the two gladiators who are fighting.
  //
  //   All three rosters open with the same 500-unit gap between the front
  //   ranks, so all three must report the same midwaypoint.
  for (const [name, roster] of Object.entries(ROSTERS)) {
    assert.equal(midwaypointFor(roster), 250, `${name} opens at the same engagement distance`);
  }
  // Without sides there is nothing to oppose, so it falls back to the spread —
  // which is the vanilla case and what every one-dimensional caller wants.
  assert.equal(midwaypointFor([-250, 250]), 250);
  assert.equal(midwaypointFor([-510, -380, -250, 250, 380, 510]), 510);
});

test("A WIDER ROSTER IS NEVER MORE ZOOMED OUT THAN A NARROWER ONE AT THE SAME RANGE", () => {
  // ► This is the assertion that would have caught it. Measured before the fix:
  //   1v1 zoom 50, 2v2 zoom 50, **3v3 zoom 30** — the widest fight drawn
  //   smallest, because it crossed a band boundary the band was never meant to
  //   answer. Nothing in the suite looked at framing at all.
  const zooms = Object.fromEntries(Object.entries(ROSTERS).map(([name, roster]) => {
    let camera = cameraFor(roster);
    for (let frame = 0; frame < 200; frame += 1) camera = cameraStep(camera, roster);
    return [name, camera.zoomscale];
  }));
  assert.equal(zooms["1v1"], zooms["2v2"], `1v1 ${zooms["1v1"]} vs 2v2 ${zooms["2v2"]}`);
  assert.equal(zooms["2v2"], zooms["3v3"], `2v2 ${zooms["2v2"]} vs 3v3 ${zooms["3v3"]}`);
  assert.equal(zooms["1v1"], zoomTargetFor(250), "and it is the build's own band for that range");
});

test("EVERY roster fills most of the stage, and every gladiator stays on it", () => {
  for (const [name, roster] of Object.entries(ROSTERS)) {
    let camera = cameraFor(roster);
    for (let frame = 0; frame < 200; frame += 1) camera = cameraStep(camera, roster);
    const drawn = roster.map((actor) => arenaToStage(camera, { x: actor.x, y: 200, lift: 0 }).x);
    for (let index = 0; index < drawn.length; index += 1) {
      assert.ok(drawn[index] > 0 && drawn[index] < SS2_STAGE.width,
        `${name}: actor at ${roster[index].x} drew at stage ${drawn[index].toFixed(0)}`);
    }
    // ► **AND IT MUST NOT WASTE THE FRAME**, which is the other half of the
    //   complaint: the broken 3v3 used 58% of the stage, LESS than the 2v2's
    //   76%, while being a third wider.
    const used = (Math.max(...drawn) - Math.min(...drawn) + FIGURE_HALF_WIDTH * 2 * camera.zoomscale / 100)
      / SS2_STAGE.width;
    assert.ok(used > 0.5, `${name} used only ${(used * 100).toFixed(0)}% of the stage`);
  }
});

test("the fit zoom is a CEILING and never raises the build's band", () => {
  // ► The ordering is the whole design: the band is the build's drama and wins
  //   whenever it can; the fit can only pull back. If this ever inverts, a
  //   vanilla 1v1 stops matching the build.
  for (const roster of Object.values(ROSTERS)) {
    const band = zoomTargetFor(midwaypointFor(roster));
    const target = targetZoomFor(midwaypointFor(roster), roster);
    assert.ok(target <= band, `the fit raised the zoom from ${band} to ${target}`);
  }
  // At a vanilla 1v1 the fit is slack and the band is untouched.
  assert.ok(fitZoomFor(ROSTERS["1v1"]) > zoomTargetFor(250), "the 1v1 is band-limited, not fit-limited");
  assert.equal(targetZoomFor(250, ROSTERS["1v1"]), zoomTargetFor(250));
  // A roster too wide for the stage is pulled back, but never below the build's
  // smallest band.
  const sprawl = [{ x: -2100, side: "hero" }, { x: 2100, side: "villain" }];
  assert.ok(fitZoomFor(sprawl) >= SS2_CAMERA.zoomMinimum);
  assert.ok(fitZoomFor(sprawl) < 30, "a 4200-unit arena cannot be framed at 30");
});

test("the focus is the middle of EVERYBODY, not of the closest duel", () => {
  // Pointing the camera at one engagement slides the rest of the roster off the
  // far edge — so the two jobs use two different numbers on purpose.
  const lopsided = [{ x: -600, side: "hero" }, { x: 100, side: "hero" }, { x: 200, side: "villain" }];
  assert.equal(midwaypointFor(lopsided), 50, "the closest engagement is 100 apart");
  assert.equal(focusXFor(lopsided), -200, "but the camera centres the whole scene");
});

/* ---------------------------------------------------------------- */
/* THE UI BAR — the sentence that was false, and the tally that
   replaces it                                                       */
/* ---------------------------------------------------------------- */

/**
 * ► **THE NOTE ON THE PANEL LAYER CLAIMED THIS RENDERER DREW THE BAR'S TEXT,
 *   AND IT NEVER HAS.** The tests below pin the two things that were actually
 *   measurable and were never checked: WHICH fields the bar places, and the
 *   fact that this engine has no live value for either of them. The second is
 *   the one that matters — an unresolved readout that reports as resolved is
 *   the exact shape of the defect this project has now recorded six times.
 *
 * ► **AND THE LIVING HEAD'S `sound:ON` / `tooltips:off` IS THE BAKED FRAME, NOT
 *   THE GAME.** Every runtime write in the build disagrees with it in case, in
 *   both fields and in opposite directions. Nothing here asserts a string,
 *   because nothing in the module holds one; the measurement is in the module's
 *   header with the offsets it was read at.
 *
 * ► **SEVEN OF THESE ASSERTIONS COULD NOT FAIL, AND AN ADVERSARIAL VERIFIER
 *   PROVED IT BY MUTATING THE IMPLEMENTATION LINE BY LINE.** Eleven one-line
 *   mutations — `SS2_UI_BAR_UNPLACED.slice(0, 1)`, `unvalued: declared -
 *   valued`, `depth: 439`, `instance: "wrong_panel"`, `unplaced: []`,
 *   `found.matrix ?? null`, a `site` of `+0xDEAD`, a `drivenBy` of "the phase
 *   of the moon" — left all 60 tests green. The FACTS were right; nothing held
 *   them. Each is now pinned, and the comment at each assertion names the
 *   mutation it exists to catch. **The worst of them was
 *   `assert.equal(tally.unplacedInBuild, SS2_UI_BAR_UNPLACED.length)` against a
 *   module computing `unplacedInBuild: SS2_UI_BAR_UNPLACED.length` — the same
 *   expression on both sides, which is not an assertion at all.**
 *
 * ► **WHAT IS STILL PROSE, SAID PLAINLY RATHER THAN DRESSED AS A MEASUREMENT.**
 *   A declaration's `note` is unpinned English and stays that way: asserting
 *   its text would restate the constant, which is the defect above wearing a
 *   different hat. What each note CLAIMS is pinned separately and against the
 *   build — that `gfxvar` has one state and `fullscreenvar` two, that each dead
 *   name occurs once at a recorded offset. `site` and `drivenBy` USED to be in
 *   that category and no longer are: a byte offset's truth is a property of the
 *   SWF, so it is checked against the SWF, in "EVERY DECLARED SITE…" below.
 *   **On a clone with no installed build that test skips and those two fields
 *   are unpinned prose.** That is the honest state, and it is written here
 *   rather than papered over with a clone-side assertion that compares the
 *   string to itself.
 */

/** A pack shaped like `text.js`'s, placing whatever fields a test names. */
function barPack(placements) {
  return textPackFrom({
    fonts: { 1526: { id: 1526, glyphs: [{ code: 65, char: "A", path: "M0 0L1 0Z", advance: 100 }] } },
    fields: Object.fromEntries(placements.map((entry) => [entry.id, { id: entry.id, bounds: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 } }])),
    placements: Object.fromEntries(placements.map((entry) => [entry.id, [{
      owner: entry.owner ?? 1531, frame: 1, depth: entry.depth, name: entry.name, matrix: entry.matrix
    }]]))
  });
}

/** The two the build really places, in the pack's own shape. */
function realBarPlacements() {
  return [
    { id: 1527, depth: 5, name: "soundvar", matrix: [0.99974, 0, 0, 1, 1820, 60] },
    { id: 1528, depth: 6, name: "tooltips_text", matrix: [1.0006, 0, 0, 1, 40, 60] }
  ];
}

test("THE PANEL LAYER NO LONGER CLAIMS TO DRAW TEXT, and points at what does describe it", () => {
  const panel = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.character === 1531);
  assert.ok(panel, "the UI bar is a layer of the arena screen");
  // ► The literal sentence that was false: "it carries live text this renderer
  //   draws itself". A note that says anything of the kind is the defect back.
  assert.doesNotMatch(panel.note, /draws itself|renderer draws|live text/i,
    `the panel note claims to draw text: ${panel.note}`);
  // And the replacement is not merely a deletion: the layer carries the
  // description, so a reader following the layer table reaches it.
  assert.equal(panel.readouts, SS2_UI_BAR_READOUTS);
  assert.equal(panel.readouts.length, 2);
  // No OTHER layer may quietly acquire the same claim.
  for (const layer of SS2_ARENA_SCREEN_LAYERS) {
    assert.doesNotMatch(layer.note, /draws itself|renderer draws/i, `layer ${layer.character}: ${layer.note}`);
  }
});

test("the bar declares TWO readouts, each naming the build site its value comes from", () => {
  assert.deepEqual(SS2_UI_BAR_READOUTS.map((entry) => entry.field), [1527, 1528]);
  assert.deepEqual(SS2_UI_BAR_READOUTS.map((entry) => entry.instance), ["soundvar", "tooltips_text"]);
  assert.deepEqual(SS2_UI_BAR_READOUTS.map((entry) => entry.depth), [5, 6]);
  assert.deepEqual(SS2_UI_BAR_READOUTS.map((entry) => entry.button), [1529, 1530]);
  // Every readout names a state key and a site in the build; a declaration with
  // neither is an assertion about the game with no way to check it.
  for (const entry of SS2_UI_BAR_READOUTS) {
    assert.ok(entry.valueOf.length > 0, `readout ${entry.field} names no state key`);
    // ► A SHAPE CHECK, and it is all a clone can honestly do. `/^sprite:1531\//`
    //   alone passed a site of `DoAction@0xDEAD +0xBEEF`; this at least demands
    //   a resolvable block path and a four-digit offset into it, which is what
    //   "EVERY DECLARED SITE…" then resolves AGAINST THE BUILD. Without the
    //   oracle these two fields are unpinned prose — said out loud in this
    //   section's header rather than covered by an assertion that restates them.
    assert.match(entry.site, /^sprite:1531\/frame:1\/[A-Za-z0-9:@/-]+ \+0x[0-9a-f]{4}\b/,
      `readout ${entry.field} site: ${entry.site}`);
    assert.ok(entry.drivenBy.length > 0, `readout ${entry.field} says nothing about what drives it`);
  }
  // ► **AND NO STRING THE BAR DISPLAYS IS IN THE MODULE.** A colon-joined
  //   readout string ("sound:on", "Tooltips:off") baked as a constant is the
  //   thing the pack-as-argument rule forbids, and it would also be wrong: the
  //   build writes four of them and the field holds a fifth.
  for (const entry of SS2_UI_BAR_READOUTS) {
    for (const value of Object.values(entry)) {
      if (typeof value !== "string") continue;
      assert.doesNotMatch(value, /\b(sound|tooltips|graphics|fullscreen):(on|off|high|low)\b/i,
        `readout ${entry.field} bakes a displayed string: ${value}`);
    }
  }
});

test("A CLONE WITH NO PACK GETS AN EMPTY LIST AND A NON-ZERO INVOICE", () => {
  // ► **THE HONESTY PROPERTY, AND IT IS THE ONE THAT IS EASY TO GET WRONG.**
  //   Counting unresolved readouts over the RETURNED list reports 0 here —
  //   nothing came back, so nothing is outstanding — which is exactly "an
  //   approximation that is not counted". It must be 2.
  const empty = uiBarReadoutsFor(null, fieldsPlacedIn);
  assert.deepEqual(empty.readouts, []);
  assert.equal(empty.unresolved, 2, "a bar with nothing on it still owes two readouts");
  assert.equal(empty.tally.missing, 2);
  assert.equal(empty.tally.placed, 0);
  assert.equal(empty.tally.valued, 0);
  // The bar's own placement survives, because it is measured off the root
  // frame and does not need a pack at all.
  assert.deepEqual({ x: empty.bar.x, y: empty.bar.y }, { x: -0.5, y: 401 });
  assert.equal(hasUiBarReadouts(null, fieldsPlacedIn), false);
  // A reader that throws is a pack with no bar, not a crash.
  const thrower = () => { throw new Error("no such pack"); };
  const broken = uiBarReadoutsFor({ fonts: {} }, thrower);
  assert.deepEqual(broken.readouts, []);
  assert.equal(broken.unresolved, 2);
  // A clone still gets the dead list, which is the half of the invoice that
  // does not depend on having a pack at all.
  assert.deepEqual(empty.unplaced.map((entry) => entry.instance), ["gfxvar", "fullscreenvar"]);
});

test("THE BAR IS THE PLACEMENT ROOT FRAME 221 GIVES IT — all five fields, not just the two that were read", () => {
  // ► **THREE OF THE FIVE WERE UNPINNED AND TWO OF THOSE ARE THE BAR'S
  //   IDENTITY.** `depth: 438 -> 439` and `instance: "fiz_info_panel" ->
  //   "wrong_panel"` each left all 60 tests green. Only `character` was held,
  //   and only by accident: it is the pack lookup key, so changing it broke
  //   five tests for a reason unrelated to what it means. A caller that orders
  //   its layers by `bar.depth` paints the UI bar under the border and nothing
  //   here would have said so.
  //
  //   The five are LITERALS so a clone with no build fails on a typo; they are
  //   MEASURED off root frame 221 in "THE BAR OBJECT IS ROOT FRAME 221'S OWN
  //   PLACEMENT" below, which is the only place they are derived.
  for (const [what, bar] of [
    ["no pack", uiBarReadoutsFor(null, fieldsPlacedIn).bar],
    ["real pack", uiBarReadoutsFor(barPack(realBarPlacements()), fieldsPlacedIn).bar],
    ["a pack whose reader throws", uiBarReadoutsFor({ fonts: {} }, () => { throw new Error("no"); }).bar]
  ]) {
    assert.deepEqual({ ...bar }, { character: 1531, instance: "fiz_info_panel", depth: 438, x: -0.5, y: 401 },
      `${what}: the bar is not the placement root frame 221 gives it`);
  }
  // The layer table is the OTHER copy of this placement. The two disagreeing is
  // the defect — the module reads its x/y from the table and its depth and name
  // from nowhere, so only the table's x/y were ever exercised.
  const panel = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.character === 1531);
  assert.deepEqual([panel.depth, panel.instance, panel.x, panel.y], [438, "fiz_info_panel", -0.5, 401]);
});

/**
 * Every identity the tally promises, recomputed from `readouts` — and it is
 * called on EVERY shape of bar below, which is the whole of the fix.
 *
 * ► **THE HALF PACK IS THE ONLY CASE THAT SEPARATES `unvalued`'s TWO CANDIDATE
 *   FORMULAS, AND IT WAS THE ONE CASE THAT DID NOT RECOUNT.** With both fields
 *   placed, `readouts.length`, `declared` and 2 are the same number, so
 *   `unvalued: declared - valued` passed every check here. The fix is not a new
 *   assertion — it is running the existing one where the formulas differ.
 *
 * ► **`declared` AND `unplacedInBuild` ARE COMPARED AGAINST LITERALS, ON
 *   PURPOSE.** `assert.equal(tally.declared, SS2_UI_BAR_READOUTS.length)`
 *   against a module computing `declared = SS2_UI_BAR_READOUTS.length` is the
 *   same expression on both sides and cannot fail; the same was true of
 *   `unplacedInBuild`, which is how `SS2_UI_BAR_UNPLACED.slice(0, 1)` survived.
 *   Both literals are 2 because sprite 1531's own scripts write four readouts
 *   and the display list places two of them — DERIVED from the oracle in "THE
 *   BAR'S SCRIPT NAMES FOUR READOUTS…" below, which is where the numbers live.
 */
function recount(bar, what) {
  const { tally } = bar;
  assert.equal(tally.declared, 2, `${what}: the bar declares two readouts`);
  assert.equal(tally.placed, bar.readouts.length, `${what}: placed is the length of what came back`);
  assert.equal(tally.missing, tally.declared - tally.placed, `${what}: missing`);
  assert.equal(tally.valued, bar.readouts.filter((entry) => entry.text !== null).length, `${what}: valued`);
  // ► Counted over the RETURNED list, which is exactly what makes it differ
  //   from `declared - valued` whenever the pack is partial or absent.
  assert.equal(tally.unvalued, bar.readouts.filter((entry) => entry.text === null).length, `${what}: unvalued`);
  assert.equal(tally.valued + tally.unvalued, tally.placed, `${what}: every placed readout is valued or not`);
  // The headline number, recomputed the way the module promises: against what
  // the bar HAS, never against what came back.
  assert.equal(tally.unresolved, tally.declared - tally.valued, `${what}: unresolved`);
  assert.equal(bar.unresolved, tally.unresolved, `${what}: the two spellings of unresolved`);
  assert.equal(tally.unplacedInBuild, 2, `${what}: the build writes two readouts into nothing`);
  // ► **AND THE DEAD LIST IS ON THE RESULT, NOT ONLY ON THE MODULE.** A caller
  //   reads `bar.unplaced`; nothing read it THERE, so `unplaced: []` passed
  //   every test while the module-level export stayed intact and the caller got
  //   a bar with no invoice on it.
  assert.deepEqual(bar.unplaced.map((entry) => entry.instance), ["gfxvar", "fullscreenvar"],
    `${what}: the dead readouts the result hands the caller`);
  assert.equal(bar.unplaced.length, tally.unplacedInBuild, `${what}: the dead list and its own count disagree`);
}

test("THE TALLY IS A RECOUNT OF THE READOUTS, and it closes on EVERY shape of pack", () => {
  const pack = barPack(realBarPlacements());
  for (const values of [{}, { sound: "x" }, { sound: "x", tooltips: "y" }]) {
    recount(uiBarReadoutsFor(pack, fieldsPlacedIn, values), `full pack ${JSON.stringify(values)}`);
  }
  // ► **THE PARTIAL PACK, WHICH IS THE CASE THAT CAN TELL THE FORMULAS APART.**
  //   One field placed and valued: counted over the readouts `unvalued` is 0,
  //   counted over `declared` it is 1. This is where that is asserted.
  const half = uiBarReadoutsFor(barPack([realBarPlacements()[0]]), fieldsPlacedIn, { sound: "x" });
  recount(half, "half pack, valued");
  assert.equal(half.tally.placed, 1);
  assert.equal(half.tally.missing, 1);
  assert.equal(half.tally.valued, 1);
  assert.equal(half.tally.unvalued, 0, "the one field the pack DOES place has a value, so nothing drawable is silent");
  assert.equal(half.unresolved, 1, "the field the pack never placed is still owed");
  // The same half pack with nothing supplied: now `unvalued` is 1 and
  // `declared - valued` is 2, so the two formulas part company the other way.
  const silent = uiBarReadoutsFor(barPack([realBarPlacements()[0]]), fieldsPlacedIn);
  recount(silent, "half pack, unvalued");
  assert.equal(silent.tally.unvalued, 1, "one readout is drawable with nothing to say in it");
  assert.equal(silent.unresolved, 2);
  // And the empty bar, where the recount is 0 and `declared - valued` is 2.
  const empty = uiBarReadoutsFor(null, fieldsPlacedIn);
  recount(empty, "no pack");
  assert.equal(empty.tally.unvalued, 0, "nothing came back, so nothing came back unvalued");
});

test("a supplied value is carried with its provenance, and an empty one is NOT a value", () => {
  const pack = barPack(realBarPlacements());
  const bar = uiBarReadoutsFor(pack, fieldsPlacedIn, { sound: "sound:on" });
  const sound = bar.readouts.find((entry) => entry.field === 1527);
  const tooltips = bar.readouts.find((entry) => entry.field === 1528);
  assert.equal(sound.text, "sound:on");
  assert.equal(sound.source, "caller");
  assert.equal(tooltips.text, null, "nothing was supplied for the tooltips readout");
  assert.equal(tooltips.source, null, "and an absent value has no provenance");
  // ► An empty string, a number and an object are all "no value". Accepting any
  //   of them would draw a blank readout and report it as resolved, which is
  //   the same defect as defaulting to a placeholder.
  for (const junk of ["", 0, 42, null, undefined, {}, ["x"]]) {
    const one = uiBarReadoutsFor(pack, fieldsPlacedIn, { sound: junk });
    assert.equal(one.readouts.find((entry) => entry.field === 1527).text, null,
      `${JSON.stringify(junk)} was taken as a live value`);
    assert.equal(one.unresolved, 2);
  }
});

test("A FIELD THE PACK PLACES AND THIS MODULE HAS NEVER HEARD OF IS REPORTED", () => {
  // ► The other direction of the same rule. If a future build, or a repaired
  //   extractor, puts a third readout on the bar, silently dropping it is the
  //   uncounted approximation again — so it is named in the tally.
  const pack = barPack([...realBarPlacements(),
    { id: 9999, depth: 7, name: "somethingelse", matrix: [1, 0, 0, 1, 0, 0] }]);
  const bar = uiBarReadoutsFor(pack, fieldsPlacedIn);
  recount(bar, "a pack with a third field on the bar");
  assert.deepEqual(bar.tally.undeclared, [9999]);
  assert.equal(bar.tally.placed, 2, "and it is not smuggled into the drawable list");
  assert.deepEqual(bar.readouts.map((entry) => entry.field), [1527, 1528]);
  // The ordinary case reports an empty list, not a missing key.
  assert.deepEqual(uiBarReadoutsFor(barPack(realBarPlacements()), fieldsPlacedIn).tally.undeclared, []);
});

test("THE BAR IS A STAGE LAYER, so no camera in the world moves its readouts", () => {
  // ► `layerPlacementFor` already says the panel is `space: "stage"`. This is
  //   the same claim cashed out where a renderer would actually get it wrong:
  //   the readout coordinates must be the bar's placement plus the field's, and
  //   nothing else. A pan term leaking in here would slide the UI with the
  //   fight.
  const pack = barPack(realBarPlacements());
  const bar = uiBarReadoutsFor(pack, fieldsPlacedIn);
  const panel = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.character === 1531);
  for (const readout of bar.readouts) {
    near(readout.stageX, panel.x + readout.x, `readout ${readout.field} stage x`);
    near(readout.stageY, panel.y + readout.y, `readout ${readout.field} stage y`);
  }
  // And the layer itself is placed identically whatever the camera is doing.
  const settled = settle(ROSTERS["3v3"]);
  assert.deepEqual(layerPlacementFor(panel, settled), layerPlacementFor(panel, cameraFor(ROSTERS["1v1"])));
  assert.notEqual(settled.gladiatorsX, undefined);
});

test("the pack's matrix is what places a readout, and it is TWIPS", () => {
  // The field placements are the only numbers here that come from an
  // extraction, so the conversion is pinned on its own: 1820 twips is 91px and
  // 40 twips is 2px, and the declaration's fallback says the same.
  const bar = uiBarReadoutsFor(barPack(realBarPlacements()), fieldsPlacedIn);
  assert.deepEqual(bar.readouts.map((entry) => entry.placedFrom), ["pack", "pack"]);
  assert.deepEqual(bar.readouts.map((entry) => [entry.x, entry.y]), [[91, 3], [2, 3]]);
  assert.deepEqual(bar.readouts.map((entry) => [entry.stageX, entry.stageY]), [[90.5, 404], [1.5, 404]]);
  assert.deepEqual(bar.readouts.map((entry) => entry.nameMatches), [true, true]);
  // ► **AND THE PACK WINS WHEN THE TWO DISAGREE**, which is the assertion that
  //   makes the line above mean anything: the declared fallback happens to be
  //   the same 91px, so returning it unconditionally would pass every check
  //   that only ever sees the real numbers.
  const moved = uiBarReadoutsFor(
    barPack([{ id: 1527, depth: 5, name: "soundvar", matrix: [1, 0, 0, 1, 400, 800] }]), fieldsPlacedIn);
  assert.deepEqual([moved.readouts[0].x, moved.readouts[0].y], [20, 40]);
  assert.deepEqual([moved.readouts[0].stageX, moved.readouts[0].stageY], [19.5, 441]);
  // A pack that places the field with NO matrix falls back to the declaration
  // and says so, rather than reporting a made-up coordinate as measured.
  const noMatrix = uiBarReadoutsFor(
    barPack([{ id: 1527, depth: 5, name: "soundvar", matrix: null }]), fieldsPlacedIn);
  assert.equal(noMatrix.readouts[0].placedFrom, "declaration");
  assert.deepEqual([noMatrix.readouts[0].x, noMatrix.readouts[0].y], [91, 3]);
  assert.equal(noMatrix.readouts[0].matrix, null);
  // A renamed instance is REPORTED, not overwritten with what this file expects.
  const renamed = uiBarReadoutsFor(
    barPack([{ id: 1527, depth: 5, name: "somethingelse", matrix: [1, 0, 0, 1, 20, 20] }]), fieldsPlacedIn);
  assert.equal(renamed.readouts[0].packName, "somethingelse");
  assert.equal(renamed.readouts[0].nameMatches, false);

  // ► **A MALFORMED MATRIX IS NOT A MATRIX, AND THE GUARD THAT SAYS SO WAS
  //   UNTESTED CODE THAT LOOKED TESTED.** The `matrix: null` case above passes
  //   identically whether the module checks the shape or writes `found.matrix
  //   ?? null` — both map null to null — so dropping `Array.isArray(...) &&
  //   ... .length === 6` left all 60 tests green. What separates the two forms
  //   is a matrix that is TRUTHY AND WRONG: on a five-element array `matrix[4]`
  //   is the ty and `matrix[5]` is `undefined`, so the readout comes back at
  //   `(1, NaN)` labelled `placedFrom: "pack"` — a made-up coordinate reported
  //   as a measurement, which is the one thing this module exists not to do. On
  //   a non-iterable the spread throws outright and the whole bar is lost, so
  //   the guard is also what keeps this function total.
  //
  //   `fieldsPlacedIn` passes `placement.matrix ?? null` through verbatim and
  //   `textPackFrom` validates nothing, so every one of these really does reach
  //   the guard — checked by reading `src/render/text.js:161`, not assumed.
  for (const junk of [[1, 0, 0, 1, 20], [1, 0, 0, 1, 20, 20, 20], [], "1,0,0,1,20,20",
    { 4: 20, 5: 20, length: 6 }, 12345, true]) {
    const bad = uiBarReadoutsFor(
      barPack([{ id: 1527, depth: 5, name: "soundvar", matrix: junk }]), fieldsPlacedIn);
    const readout = bad.readouts[0];
    const shown = JSON.stringify(junk);
    assert.equal(readout.placedFrom, "declaration", `${shown} was reported as a measured placement`);
    assert.equal(readout.matrix, null, `${shown} came back on the readout as a matrix`);
    assert.deepEqual([readout.x, readout.y], [91, 3], `${shown} moved the readout off its declaration`);
    assert.ok(Number.isFinite(readout.stageX) && Number.isFinite(readout.stageY),
      `${shown} produced a non-finite stage coordinate`);
  }
});

/* ---------------------------------------------------------------- */
/* Against the pack this machine has actually extracted              */
/* ---------------------------------------------------------------- */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PACK_PATH = path.join(REPO_ROOT, "assets", "text", "text.json");
const skipPack = fs.existsSync(PACK_PATH) ? false : "no extracted text pack on this machine";

test("THE REAL PACK PLACES EXACTLY THE TWO READOUTS DECLARED, where they are declared",
  { skip: skipPack }, () => {
    // ► The cross-check the declaration cannot do for itself: the `x`/`y` a
    //   clone falls back to are compared against the matrices the extraction
    //   read off the build, so a typo in either side is visible.
    const pack = textPackFrom(JSON.parse(fs.readFileSync(PACK_PATH, "utf8")));
    const bar = uiBarReadoutsFor(pack, fieldsPlacedIn);
    assert.deepEqual(bar.readouts.map((entry) => entry.field), [1527, 1528]);
    assert.deepEqual(bar.tally.undeclared, [], "the build places no third readout on the bar");
    assert.equal(bar.tally.missing, 0);
    for (const readout of bar.readouts) {
      const declared = SS2_UI_BAR_READOUTS.find((entry) => entry.field === readout.field);
      assert.equal(readout.packName, declared.instance, `readout ${readout.field} is renamed in the build`);
      near(readout.x, declared.x, `readout ${readout.field} declared x disagrees with the pack`);
      near(readout.y, declared.y, `readout ${readout.field} declared y disagrees with the pack`);
    }
    assert.deepEqual(bar.readouts.map((entry) => [entry.x, entry.y]), [[91, 3], [2, 3]]);
    // ► **AND THIS ENGINE STILL HAS NOTHING TO SAY IN EITHER OF THEM.** That is
    //   the true state today and it is recorded as a number rather than as a
    //   blank box nobody counted.
    assert.equal(bar.unresolved, 2);
    assert.equal(hasUiBarReadouts(pack, fieldsPlacedIn), true);
  });

/* ---------------------------------------------------------------- */
/* Against the installed build                                       */
/* ---------------------------------------------------------------- */

const ORACLE =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";
const skipOracle = fs.existsSync(ORACLE) ? false : "no installed build on this machine";

/** The oracle, read fresh per test. Nothing here writes to it. */
function oracleBuffer() {
  return fs.readFileSync(ORACLE);
}

/**
 * Every instruction in an action block, INCLUDING the bodies of the functions
 * defined inside it.
 *
 * ► **A FLAT SCAN OF THE TOP LEVEL MISSES FOUR OF THE EIGHT OFFSETS THE
 *   DECLARATIONS CITE.** `toggleSound` (`+0x0117`) and `toggleFS` (`+0x021d`)
 *   are `DefineFunction2` payloads on sprite 1531's frame-1 script, and four of
 *   the writes the `site` strings name happen inside them. The offsets in a
 *   `site` are relative to the BLOCK, not to the function, which is why this
 *   flattens rather than recursing into a separate address space.
 */
function actionsIn(instructions, out = []) {
  for (const instruction of instructions) {
    out.push(instruction);
    if (instruction.name === "DefineFunction" || instruction.name === "DefineFunction2" || instruction.name === "With") {
      actionsIn(instruction.operand?.body ?? [], out);
    } else if (instruction.name === "Try") {
      for (const body of instruction.operand?.bodies ?? []) actionsIn(body.body, out);
    }
  }
  return out;
}

/**
 * A declaration's `site`, split into the action block it names and the offsets
 * into it — `"sprite:1531/frame:1/DoAction@0x3d3686 +0x0170 / +0x01a0"` becomes
 * that context and `[0x0170, 0x01a0]`.
 *
 * The context is everything before the first ` +0x`, so the prose a `site` may
 * carry between offsets (`", and _root.toggleFS"`) is stepped over rather than
 * parsed. `@0x3d3686` is not picked up as an offset because it has no `+`.
 */
function parseSite(site) {
  return {
    context: site.split(" +0x")[0],
    offsets: [...site.matchAll(/\+0x([0-9a-fA-F]{4})\b/g)].map((match) => parseInt(match[1], 16))
  };
}

test("THE BAR OBJECT IS ROOT FRAME 221'S OWN PLACEMENT — depth and name included",
  { skip: skipOracle }, () => {
    // ► **WHERE 438 AND "fiz_info_panel" ACTUALLY COME FROM.** Both were shipped
    //   correct and both were unpinned: 438 -> 439 and "fiz_info_panel" ->
    //   "wrong_panel" each survived all 60 tests. The module's header prints
    //   this row of root frame 221 as a measurement, so it is measured.
    const buffer = oracleBuffer();
    const frame221 = resolveTimeline(buffer, rootTimeline(buffer), {}).frames[220];
    const placement = frame221.find((entry) => entry.characterId === 1531);
    assert.ok(placement, "root frame 221 no longer places character 1531");

    const { bar } = uiBarReadoutsFor(null, fieldsPlacedIn);
    assert.equal(bar.character, placement.characterId, "the bar's character");
    assert.equal(bar.instance, placement.name, "the bar's instance name");
    assert.equal(bar.depth, placement.depth, "the bar's depth");
    near(bar.x, placement.matrix.tx / 20, "the bar's stage x");
    near(bar.y, placement.matrix.ty / 20, "the bar's stage y");

    // The layer table carries the same placement a second time; the two
    // disagreeing is the defect, and only its x/y was ever exercised.
    const panel = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.character === 1531);
    assert.deepEqual([panel.depth, panel.instance], [placement.depth, placement.name]);
    near(panel.x, placement.matrix.tx / 20, "the layer table's x");
    near(panel.y, placement.matrix.ty / 20, "the layer table's y");

    // ► **AND IT IS THE ONLY THING AT THAT DEPTH ON THE FRAME**, so "depth 438"
    //   IDENTIFIES the bar rather than merely being true of it — which is what a
    //   caller ordering its layer stack by depth is relying on.
    assert.deepEqual(frame221.filter((entry) => entry.depth === bar.depth).map((entry) => entry.characterId), [1531],
      "depth 438 no longer picks out the UI bar alone");
  });

test("EVERY DECLARED SITE IS AN OFFSET IN THE BUILD THAT PUSHES THE NAME IT CLAIMS",
  { skip: skipOracle }, () => {
    // ► **`site` AND `drivenBy` WERE PROSE THE MODULE PRESENTED AS MEASUREMENTS.**
    //   The only check on `site` was `/^sprite:1531\//`, so a site of
    //   `DoAction@0xDEAD +0xBEEF / +0xBEEF` passed; the only check on `drivenBy`
    //   was `length > 0`, so "the phase of the moon" passed. A byte offset's
    //   truth is a property of the SWF and of nothing else, so it is checked
    //   against the SWF: the block the site names must exist, and at every
    //   offset it cites the build must push the readout's own instance name.
    //
    //   **On a machine with no installed build this skips and those two fields
    //   are unpinned prose.** Stated, not papered over — the alternative is a
    //   clone-side assertion comparing the string to itself, which is the
    //   defect this test exists to remove.
    const { analysis } = analyseSwfBuffer(oracleBuffer());
    const blocks = new Map(analysis.actionBlocks.map((block) => [block.context, block]));
    let checked = 0;
    for (const entry of [...SS2_UI_BAR_READOUTS, ...SS2_UI_BAR_UNPLACED]) {
      const { context, offsets } = parseSite(entry.site);
      const block = blocks.get(context);
      assert.ok(block, `${entry.instance}: no action block at ${context}`);
      assert.ok(offsets.length > 0, `${entry.instance}: site cites no offset: ${entry.site}`);
      const flattened = actionsIn(block.instructions);
      const byOffset = new Map(flattened.map((one) => [one.offset - block.offset, one]));
      for (const offset of offsets) {
        const at = `+0x${offset.toString(16).padStart(4, "0")}`;
        const instruction = byOffset.get(offset);
        assert.ok(instruction, `${entry.instance}: ${at} is not an instruction boundary in ${context}`);
        assert.equal(instruction.name, "Push", `${entry.instance}: ${at} is ${instruction.name}, not a Push`);
        const pushed = (instruction.operand ?? []).map((value) => value.value);
        assert.ok(pushed.includes(entry.instance),
          `${entry.instance}: ${at} pushes ${JSON.stringify(pushed)}`);
        checked += 1;
      }

      // ► **AND `drivenBy` NAMES SOMETHING THAT SCRIPT ACTUALLY MENTIONS.** It
      //   is prose and it stays prose — but prose claiming `_root.pSound` drives
      //   a field whose script has no `pSound` in it is a false measurement, and
      //   that much IS checkable. Every DOTTED name must resolve to a string the
      //   block pushes, and at least one name overall must, so a sentence that
      //   names nothing in the build fails here.
      if (entry.drivenBy === undefined) continue;
      const constants = new Set(flattened
        .filter((one) => one.name === "Push")
        .flatMap((one) => (one.operand ?? []).map((value) => value.value))
        .filter((value) => typeof value === "string"));
      let resolved = 0;
      for (const token of entry.drivenBy.match(/[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/g) ?? []) {
        const member = token.split(".").pop();
        if (token.includes(".")) {
          assert.ok(constants.has(member),
            `${entry.instance}: drivenBy names ${token}, and ${member} is not pushed anywhere in ${context}`);
        }
        if (constants.has(member)) resolved += 1;
      }
      assert.ok(resolved > 0,
        `${entry.instance}: drivenBy names nothing the build's own script mentions: ${entry.drivenBy}`);
    }

    // ► **A `note` IS PROSE AND STAYS PROSE — BUT AN OFFSET INSIDE PROSE IS
    //   STILL A MEASUREMENT.** `fullscreenvar`'s note says `toggleFS` is defined
    //   at `+0x021d`, which is either true of the build or it is not. Asserting
    //   the note's TEXT would restate the constant — the defect this whole
    //   section exists to remove, and the reason mutating a note to nonsense
    //   still passes here, which is said out loud in the section header. What
    //   is checked is the part that has a truth value.
    let notedOffsets = 0;
    for (const entry of SS2_UI_BAR_UNPLACED) {
      const block = blocks.get(parseSite(entry.site).context);
      const byOffset = new Map(actionsIn(block.instructions).map((one) => [one.offset - block.offset, one]));
      for (const match of (entry.note ?? "").matchAll(/\+0x([0-9a-fA-F]{4})\b/g)) {
        const offset = parseInt(match[1], 16);
        assert.ok(byOffset.has(offset),
          `${entry.instance}: its note cites +0x${match[1]}, which is not an instruction boundary in that script`);
        notedOffsets += 1;
      }
    }
    assert.equal(notedOffsets, 1, "one note cites one offset — `toggleFS` at +0x021d");
    // The tally this test owes: NINE cited offsets across the four declarations
    // — 2 for `soundvar`, 2 for `tooltips_text`, 1 for `gfxvar` and 4 for
    // `fullscreenvar`, whose two write sites are doubled by `toggleFS` — every
    // one of them resolved. A `site` that quietly lost an offset would
    // otherwise shrink the loop and still pass, which is the same uncounted
    // swallow as the one below. (Written as 10 on the first pass, from adding
    // up the module header rather than the declarations; this assertion is what
    // caught it, which is the only reason it is worth having.)
    assert.equal(checked, 9, "the four declarations cite nine offsets between them");
  });

test("THE BAR IS FOUR PLATES, TWO BUTTONS AND TWO FIELDS — and 641 x 27 is the PLATE",
  { skip: skipOracle }, () => {
    // ► Where "the bar renders as blank boxes" actually comes from. Four
    //   placements bottom out on one shape (char 487) and draw; both text
    //   placements come back `unsupported: "text"` and are dropped. The note on
    //   the panel layer is checked against the number measured here, so the
    //   table cannot drift from the build the way the committed size table did.
    const buffer = oracleBuffer();
    const { characters } = indexCharacters(buffer);
    const list = resolveTimeline(buffer, characters.get(1531), { frames: [1] }).frames[0];
    assert.deepEqual(list.map((entry) => entry.depth), [1, 3, 5, 6, 7, 9]);
    assert.deepEqual(list.map((entry) => entry.characterId), [488, 488, 1527, 1528, 1529, 1530]);
    assert.deepEqual(list.filter((entry) => entry.name).map((entry) => entry.name),
      ["myFootprint", "myFootprint", "soundvar", "tooltips_text"]);

    const drawables = flattenFrame(buffer, characters, list, {});
    const text = drawables.filter((entry) => entry.kind === "text");
    assert.equal(text.length, 2, "the two fields reach the flattener");
    for (const entry of text) {
      assert.equal(entry.unsupported, "text", `char ${entry.characterId} is dropped for another reason`);
    }
    const shapes = drawables.filter((entry) => entry.kind === "shape");
    assert.equal(shapes.length, 4, "four plate placements, which are the boxes you see");
    assert.deepEqual([...new Set(shapes.map((entry) => entry.characterId))], [487],
      "and all four are the same rectangle at four scales");

    // The plate's own extent, in bar pixels: the union of the four placements.
    const bounds = parseShape(buffer, characters.get(487).bodyStart, characters.get(487).bodyEnd,
      characters.get(487).tagCode).bounds;
    let xMin = Infinity; let xMax = -Infinity; let yMin = Infinity; let yMax = -Infinity;
    for (const drawable of shapes) {
      const { a, d, tx, ty } = drawable.matrix;
      for (const [x, y] of [[bounds.xMin, bounds.yMin], [bounds.xMax, bounds.yMax]]) {
        xMin = Math.min(xMin, (a * x + tx) / 20); xMax = Math.max(xMax, (a * x + tx) / 20);
        yMin = Math.min(yMin, (d * y + ty) / 20); yMax = Math.max(yMax, (d * y + ty) / 20);
      }
    }
    const width = Math.round(xMax - xMin);
    const height = Math.round(yMax - yMin);
    assert.deepEqual({ width, height }, { width: 641, height: 27 });
    const panel = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.character === 1531);
    assert.match(panel.note, new RegExp(`${width} x ${height}`),
      `the panel note does not carry the plate size measured here: ${panel.note}`);
  });

test("THE BAR'S SCRIPT NAMES FOUR READOUTS AND THE DISPLAY LIST PLACES TWO — the partition is DERIVED",
  { skip: skipOracle }, () => {
    // ► **NOTHING PINNED THE LENGTH OF EITHER LIST, AND THE ASSERTION THAT
    //   LOOKED LIKE IT DID WAS `assert.equal(X, X)`.** The test read
    //   `tally.unplacedInBuild === SS2_UI_BAR_UNPLACED.length` against a module
    //   computing `unplacedInBuild: SS2_UI_BAR_UNPLACED.length` — the same
    //   expression on both sides. Slicing `fullscreenvar` off the declaration
    //   left all 60 tests green, and the only record that the build writes two
    //   readouts into nothing quietly became a record of one.
    //
    //   So the partition is DERIVED here rather than declared. Scan sprite
    //   1531's own scripts for the build's `<name>.text = "<string>"` idiom —
    //   `[Push name][GetVariable|GetMember][Push "text", <string>][SetMember]`
    //   — which is literally where the count of FOUR comes from; then split
    //   those four by whether any timeline in the build places an instance
    //   under that name. The two halves must BE the two declared lists. Add a
    //   readout, drop one, or rename one, and this fails and says which.
    const buffer = oracleBuffer();
    assert.equal(buffer.length, 7586504, "the oracle is not the build these offsets were read from");

    const { analysis } = analyseSwfBuffer(buffer);
    const written = new Map();
    for (const block of analysis.actionBlocks.filter((one) => one.context.startsWith("sprite:1531/"))) {
      const all = actionsIn(block.instructions);
      for (let index = 3; index < all.length; index += 1) {
        if (all[index].name !== "SetMember") continue;
        const value = all[index - 1];
        const getter = all[index - 2];
        const target = all[index - 3];
        if (value.name !== "Push" || target.name !== "Push") continue;
        if (getter.name !== "GetMember" && getter.name !== "GetVariable") continue;
        const pushed = value.operand ?? [];
        if (pushed.length !== 2 || pushed[0].value !== "text" || typeof pushed[1].value !== "string") continue;
        const name = target.operand?.[target.operand.length - 1]?.value;
        if (typeof name !== "string") continue;
        if (!written.has(name)) written.set(name, []);
        written.get(name).push(pushed[1].value);
      }
    }
    assert.deepEqual([...written.keys()].sort(), ["fullscreenvar", "gfxvar", "soundvar", "tooltips_text"],
      "sprite 1531's scripts no longer write the four readouts these two lists partition");

    // ► **AND EACH DECLARED `valueOf` IS THE KEY THE BUILD'S OWN STRING USES.**
    //   The bar writes `graphics:high` into `gfxvar` and `sound:on` into
    //   `soundvar`; the part before the colon is the state key, which is the key
    //   a caller supplies a value under. Compared case-insensitively because the
    //   build writes `Tooltips:on` into a field whose BAKED text is
    //   `tooltips:off` — that disagreement is the measurement recorded in the
    //   module's header, not a normalisation to be hidden here.
    for (const entry of [...SS2_UI_BAR_READOUTS, ...SS2_UI_BAR_UNPLACED]) {
      const strings = written.get(entry.instance) ?? [];
      assert.ok(strings.length > 0, `${entry.instance}: the build's scripts write no string into it`);
      for (const value of strings) {
        assert.ok(value.toLowerCase().startsWith(`${entry.valueOf.toLowerCase()}:`),
          `${entry.instance}: declared valueOf ${JSON.stringify(entry.valueOf)} is not the key of ${JSON.stringify(value)}`);
      }
    }
    // The asymmetry each dead entry's `note` claims in prose, measured: `gfxvar`
    // has ONE state and so could never have been a toggle; `fullscreenvar` has
    // two. The `note` text itself stays unpinned English — asserting it would
    // restate the constant, which is the defect at the top of this test.
    assert.deepEqual([...new Set(written.get("gfxvar"))], ["graphics:high"]);
    assert.deepEqual([...new Set(written.get("fullscreenvar"))].sort(), ["fullscreen:off", "fullscreen:on"]);

    // Each dead name occurs ONCE in the whole file — its own constant pool entry.
    for (const entry of SS2_UI_BAR_UNPLACED) {
      const needle = Buffer.from(entry.instance, "latin1");
      const hits = [];
      let at = 0;
      while ((at = buffer.indexOf(needle, at)) !== -1) { hits.push(at); at += 1; }
      assert.equal(hits.length, entry.occurrences,
        `${entry.instance} occurs ${hits.length} times, not ${entry.occurrences}`);
      assert.deepEqual(hits, [entry.byteOffset], `${entry.instance} is not at its recorded offset`);
    }

    // ── The other half of the partition: which of the four are ever PLACED ──
    const { characters } = indexCharacters(buffer);
    const timelines = [...characters.values()].filter((entry) => entry.kind === "sprite");
    timelines.push(rootTimeline(buffer));
    assert.equal(timelines.length, 741,
      "740 sprites and the root — the build this partition was measured on");

    const placements = new Map();
    let walked = 0;
    let threw = 0;
    const unresolvable = [];
    for (const timeline of timelines) {
      let resolved;
      try {
        resolved = resolveTimeline(buffer, timeline, {});
      } catch (error) {
        threw += 1;
        unresolvable.push(`${timeline.id}: ${error.message}`);
        continue;
      }
      walked += 1;
      for (const frame of resolved.frames ?? []) {
        for (const entry of frame) {
          if (!entry.name || !written.has(entry.name)) continue;
          if (!placements.has(entry.name)) placements.set(entry.name, []);
          placements.get(entry.name).push(`timeline ${timeline.id} depth ${entry.depth}`);
        }
      }
    }

    // ► **THE CATCH USED TO SWALLOW WITHOUT COUNTING, UNDER `walked > 700`.**
    //   741 timelines resolve and none throws, so a loose floor left FORTY of
    //   them free to start throwing, be skipped in silence, and still report
    //   that no timeline places these names — a search that stopped searching,
    //   passing as a search that found nothing. An uncounted swallow is the same
    //   defect class as an uncounted approximation, so it is counted, and the
    //   assertion is on the count rather than on a floor.
    assert.equal(threw, 0,
      `${threw} timelines could not be resolved and were skipped: ${unresolvable.slice(0, 3).join("; ")}`);
    assert.equal(walked, timelines.length, "every timeline in the build was walked");

    const names = [...written.keys()].sort();
    assert.deepEqual(names.filter((name) => placements.has(name)),
      SS2_UI_BAR_READOUTS.map((entry) => entry.instance).sort(),
      "the readouts the build PLACES are not the ones declared live");
    assert.deepEqual(names.filter((name) => !placements.has(name)),
      SS2_UI_BAR_UNPLACED.map((entry) => entry.instance).sort(),
      "the readouts the build writes into NOTHING are not the ones declared dead");
    for (const entry of SS2_UI_BAR_UNPLACED) {
      assert.deepEqual(placements.get(entry.instance) ?? [], [],
        `${entry.instance} IS placed, which is what makes its writes land on undefined`);
    }
    for (const entry of SS2_UI_BAR_READOUTS) {
      assert.equal((placements.get(entry.instance) ?? []).length, 1,
        `${entry.instance} is placed ${(placements.get(entry.instance) ?? []).length} times, not once`);
    }
  });

/* ------------------------------------------------------------------ *
 * THE STAGE CLIP — the green band, closed 2026-09-15.
 * ------------------------------------------------------------------ */

test("the stage clip rectangle IS the letterboxed stage, at every canvas shape", () => {
  for (const size of [
    { width: 640, height: 420 },   // exact
    { width: 1280, height: 420 },  // wider than the stage: bars left and right
    { width: 640, height: 840 },   // taller: bars top and bottom
    { width: 1920, height: 1080 },
    { width: 401, height: 953 }    // deliberately not a round ratio
  ]) {
    const fit = stageFitFor(size);
    const rect = stageClipRectFor(fit);
    assert.equal(rect.x, fit.offsetX, `clip x disagrees with the fit at ${size.width}x${size.height}`);
    assert.equal(rect.y, fit.offsetY, `clip y disagrees with the fit at ${size.width}x${size.height}`);
    assert.equal(rect.width, SS2_STAGE.width * fit.scale, "clip width is not the stage");
    assert.equal(rect.height, SS2_STAGE.height * fit.scale, "clip height is not the stage");
    // The letterbox is whatever is left, and it must be symmetric — a clip that
    // was right on one edge and wrong on the other would still satisfy the four
    // assertions above if they were written against the rect alone.
    assert.ok(Math.abs((size.width - (rect.x + rect.width)) - rect.x) < 1e-9,
      "the left and right bars are not equal, so the stage is not centred");
    assert.ok(Math.abs((size.height - (rect.y + rect.height)) - rect.y) < 1e-9,
      "the top and bottom bars are not equal, so the stage is not centred");
  }
});

test("a malformed fit yields the stage at 1:1 rather than a NaN rectangle", () => {
  // Total for the reason every reader in this module is: a partial extraction
  // must leave a playable arena. A NaN rect passed to `ctx.rect` clips away the
  // WHOLE canvas silently, which is a black page rather than a missing layer.
  for (const bad of [null, undefined, {}, { scale: 0 }, { scale: -1 }, { scale: NaN }]) {
    const rect = stageClipRectFor(bad);
    assert.ok(Number.isFinite(rect.x) && Number.isFinite(rect.y), `x/y not finite for ${JSON.stringify(bad)}`);
    assert.ok(rect.width > 0 && rect.height > 0, `empty rect for ${JSON.stringify(bad)}`);
    assert.equal(rect.width, SS2_STAGE.width);
    assert.equal(rect.height, SS2_STAGE.height);
  }
});

test("the arena layers DO leave the stage, which is why the clip exists", () => {
  // ► **THIS IS THE ASSERTION THAT COULD HAVE VARIED, and the reason it is
  //   written against the real pack.** A test that only checked the rectangle's
  //   arithmetic would pass with the clip deleted and with the sky drawn
  //   anywhere at all. What makes the clip load-bearing is that the pack really
  //   does put paint outside 640x420 — so that is what is asserted, at the sky
  //   frame the band was reported at, against the frame where it was not.
  //
  //   The living head's extents table said the sky spans -12.0..207.7 and that
  //   the band at -75..-45 was therefore "not the sky's main body". That table
  //   was computed at FRAME 1. At frame 60 the sky reaches -164.8.
  const packPath = path.join(REPO_ROOT, "assets", "props", "props.json");
  if (!fs.existsSync(packPath)) {
    assert.fail(`the props pack is missing at ${packPath}; this check must not skip silently`);
  }
  const pack = JSON.parse(fs.readFileSync(packPath, "utf8"));

  const topOf = (linkage, frame) => {
    const ops = propOpsForPack(pack, linkage, frame);
    const layer = SS2_ARENA_SCREEN_LAYERS.find((entry) => entry.prop === linkage);
    const place = layerPlacementFor(layer, { crowdY: SS2_CAMERA.crowdBaseY + Math.ceil(SS2_CAMERA.zoomStart) });
    let top = Infinity;
    for (const op of ops) {
      if (op.kind !== "path" || typeof op.d !== "string") continue;
      const numbers = (op.d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
      const [a, b, c, d, tx, ty] = op.matrix ?? [1, 0, 0, 1, 0, 0];
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        const y = b * numbers[i] + d * numbers[i + 1] + ty / 20;
        top = Math.min(top, place.y + (place.scale ?? 1) * y);
      }
      void a; void c;
    }
    return top;
  };

  const skyAtOne = topOf("sky", 1);
  const skyAtSixty = topOf("sky", 60);
  assert.ok(skyAtSixty < -100,
    `the sky's top edge at frame 60 is ${skyAtSixty.toFixed(1)}, so nothing leaves the stage and this clip guards nothing`);
  assert.ok(skyAtOne > skyAtSixty + 100,
    `frame 1 (${skyAtOne.toFixed(1)}) and frame 60 (${skyAtSixty.toFixed(1)}) agree, so a frame-1 extents table was never the trap it was`);
  assert.ok(topOf("crowd", 1) < 0, "the crowd sits inside the stage, which contradicts its eight tiled stands");
});

function propOpsForPack(pack, linkage, frame) {
  const frames = pack?.props?.[linkage]?.frames;
  assert.ok(Array.isArray(frames) && frames.length > 0, `the pack has no frames for ${linkage}`);
  const ops = propOpsFor(pack, { linkage, frame });
  assert.ok(Array.isArray(ops) && ops.length > 0, `${linkage} frame ${frame} produced no operations`);
  return ops;
}
