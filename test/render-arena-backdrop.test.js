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
  frameForLayer,
  stageFitFor,
  stageProjectorFor,
  zoomTargetFor
} from "../src/render/arena-backdrop.js";
import { SS2_ARENA } from "../src/team/ss2-rules.js";

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
