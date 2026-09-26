/**
 * WHO THE ARENA CAMERA FRAMES, and what it does when that changes mid-bout.
 *
 * Owner, 2026-09-24: *"If a fighter dies, the arena cam can zoom in on the
 * remaining fighters."* The build is 1v1 and a death ends its bout, so every
 * rule here is AUTHORED for team play, and the first thing pinned is that a
 * vanilla pair never reads any of it.
 *
 * The camera's own arithmetic — bands, fit, ease, pan — is pinned in
 * `render-arena-backdrop.test.js`. This file pins what is added on top of it:
 * `framedActors` (who), `stepFramedCamera` (when to re-seed), the team/pair
 * hand-over (`teamWeight`), and the survivors' close-up (`SS2_CLOSE_UP`: how
 * close, never looser than the old camera, never cropping on the way in).
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  actorSpanFor,
  cameraFor,
  cameraStep,
  closeUpZoomFor,
  closeUpZoomRangeAt,
  easeTeamWeight,
  framedActors,
  groundLineAt,
  midwaypointFor,
  stepFramedCamera,
  targetZoomFor,
  SS2_CAMERA,
  SS2_CLOSE_UP,
  SS2_TEAM_FRAMING,
  SS2_ARENA_SCREEN_LAYERS,
  SS2_ARENA_WALL_BASE,
  arenaToStage,
  layerPlacementFor,
  namePlateDepthAt
} from "../src/render/arena-backdrop.js";
import { ADVANCE_UNITS } from "../src/render/timeline.js";

/** A placed fighter as the shell hands one over. */
function fighter(id, x, side, { alive = true, drawing = false } = {}) {
  return { id, x, side, teamId: side === "hero" ? "red" : "blue", alive, drawing };
}

/** The default 3v3's front line, flank to flank, every fighter standing. */
function threeVsThree(overrides = {}) {
  const roster = [
    fighter("red-3", -510, "hero"), fighter("red-2", -380, "hero"), fighter("red-1", -250, "hero"),
    fighter("blue-1", 250, "villain"), fighter("blue-2", 380, "villain"), fighter("blue-3", 510, "villain")
  ];
  return roster.map((entry) => ({ ...entry, ...(overrides[entry.id] ?? {}) }));
}

/** The camera after `frames` frames of the same roster, from its opening shot. */
function run(roster, frames = 120, { result = null, from = null } = {}) {
  let state = from;
  for (let frame = 0; frame < frames; frame += 1) state = stepFramedCamera(state, roster, { result });
  return state;
}

const ids = (list) => list.map((entry) => entry.id).sort();

/* ---------------------------------------------------------------- */
/* Who is framed                                                     */
/* ---------------------------------------------------------------- */

test("a team camera frames the living, plus the fallen whose clips are still being drawn", () => {
  const roster = threeVsThree({
    // Struck down this action: the reaction and the death behind it are in `playing`.
    "blue-3": { alive: false, drawing: true },
    // Fell an action ago; the body is at rest and nothing of his is playing.
    "red-3": { alive: false, drawing: false }
  });
  assert.deepEqual(ids(framedActors(roster)), ["blue-1", "blue-2", "blue-3", "red-1", "red-2"]);

  // The moment the fall finishes, the body leaves the frame.
  const rested = roster.map((entry) => (entry.id === "blue-3" ? { ...entry, drawing: false } : entry));
  assert.deepEqual(ids(framedActors(rested)), ["blue-1", "blue-2", "red-1", "red-2"]);
});

test("A VANILLA PAIR IS NEVER FILTERED — the build's camera frames hero and villain, bodies included", () => {
  const pair = [fighter("red-1", -60, "hero"), fighter("blue-1", 70, "villain", { alive: false, drawing: false })];
  const result = { winnerTeamId: "red" };
  assert.deepEqual(ids(framedActors(pair, { result })), ["blue-1", "red-1"]);

  // And the camera it drives is `cameraStep` over both, frame for frame: a 1v1
  // after its death is exactly what it was before this rule existed.
  let state = null;
  let camera = null;
  for (let frame = 0; frame < 60; frame += 1) {
    state = stepFramedCamera(state, pair, { result });
    camera = camera === null ? cameraFor(pair) : cameraStep(camera, pair);
    assert.deepEqual(state.camera, camera, `frame ${frame}`);
  }
});

test("a settled team bout frames its winners, and the fall that ended it until it is drawn", () => {
  const result = { winnerTeamId: "red" };
  const ending = threeVsThree({
    "red-3": { alive: false },
    "blue-1": { alive: false, drawing: true },
    "blue-2": { alive: false },
    "blue-3": { alive: false }
  });
  assert.deepEqual(ids(framedActors(ending, { result })), ["blue-1", "red-1", "red-2"]);
  const celebrating = ending.map((entry) => ({ ...entry, drawing: false }));
  assert.deepEqual(ids(framedActors(celebrating, { result })), ["red-1", "red-2"]);

  // A living fighter on the losing side is not framed once there is a result.
  // No result reaches that state today — every result is an elimination — so
  // this pins the stated intent, not a path the engine takes.
  const standingLoser = celebrating.map((entry) => (entry.id === "blue-2" ? { ...entry, alive: true } : entry));
  assert.deepEqual(ids(framedActors(standingLoser, { result })), ["red-1", "red-2"]);
  assert.deepEqual(ids(framedActors(standingLoser)), ["blue-2", "red-1", "red-2"], "and it is, while the bout is live");
});

test("ONE WINNER IS FRAMED ALONE, AND THE CLOSE-UP TAKES HIM TO THE OWNER'S CAP OF 100", () => {
  const result = { winnerTeamId: "red" };
  // `_yscale` 86, the demo roster's. At 100 his own crown stops the close-up at
  // 99 — 166.75 + (200 - 367) z/100 >= 1 holds only to z = 99.25 — pinned below.
  const roster = threeVsThree({
    "red-2": { yscale: 86 },
    "red-1": { alive: false }, "red-3": { alive: false },
    "blue-1": { alive: false }, "blue-2": { alive: false }, "blue-3": { alive: false }
  });
  assert.equal(closeUpZoomFor([{ x: -380, y: 200, yscale: 100 }], { teamWeights: [0] }), 99);
  const state = run(roster, 600, { result });
  assert.deepEqual(ids(state.framed), ["red-2"]);
  assert.equal(state.closeUp, true);
  const camera = state.camera;
  assert.equal(camera.focusX, -380, "the focus is the winner himself");
  assert.equal(camera.team, false);
  assert.equal(camera.teamWeight, 0);
  // 172 + 74 units either side of him is 492: it fits 100 with room.
  assert.equal(camera.maxscale, SS2_CLOSE_UP.zoomCap);
  assert.equal(camera.zoomscale, 100, "past the build's own tightest band of 80");
  const stageX = arenaToStage(camera, { x: -380, y: 200 }).x;
  assert.ok(stageX >= SS2_CAMERA.deadZoneLeft - 1 && stageX <= SS2_CAMERA.deadZoneRight + 1,
    `the winner stands at stage x ${stageX.toFixed(2)}`);
  // THE OWNER'S "34px ABOVE THE UI BAR", re-derived: the pair's line at zoom 100
  // is 166.75 + 200, 34.25 above the bar's y of 401 and 31.25 above the first
  // row its plate covers (398) — and the name plate still clears it.
  assert.equal(groundLineAt(camera), 366.75);
  const plate = arenaToStage(camera, { x: -380, y: 200, lift: -SS2_CLOSE_UP.namePlateDrop }).y;
  assert.equal(plate, 388.75, "the name plate's baseline, 22 units under the feet");
  // ~~`plate + 0.3 * 15`~~: the glyph alone. The plate's ink reaches its
  // outline too — 6.3px under the baseline at 15px (`namePlateDepthAt`).
  const ink = groundLineAt(camera) + namePlateDepthAt(1);
  assert.ok(ink <= SS2_CLOSE_UP.visible.bottom, `the plate's ink reaches ${ink}`);
  assert.ok(Math.abs(ink - 395.05) < 1e-9, `395.05, 2.95px above the bar's plate: ${ink}`);
});

test("a winner in the BACK rank is held below the cap by his own crown", () => {
  // At rank 2 (y 6) the squash stands his feet at 166.75 + 103 z/100 and the
  // measured crown, 367 units at `_yscale` 100, rises 367 * 0.86 z/100 above
  // them. So the crown leaves the top (stage y 1) above z = 165.75 / 2.126 = 77.9.
  const winner = { id: "red-2", x: -8, y: 6, yscale: 86, side: "hero", teamId: "red", alive: true };
  assert.equal(closeUpZoomFor([winner], { teamWeights: [0] }), 77);
  const crown = arenaToStage({ zoomscale: 77 }, { x: 0, y: 6, lift: SS2_CLOSE_UP.crown * 0.86 }).y;
  assert.ok(crown >= SS2_CLOSE_UP.visible.top, `at 77 the crown is at ${crown.toFixed(2)}`);
  assert.ok(arenaToStage({ zoomscale: 78 }, { x: 0, y: 6, lift: SS2_CLOSE_UP.crown * 0.86 }).y < SS2_CLOSE_UP.visible.top);
  // In the front rank the same fighter reaches the cap.
  assert.equal(closeUpZoomFor([{ ...winner, y: 200 }], { teamWeights: [0] }), 100);
});

test("a draw with nobody left to frame frames the whole field rather than an empty set", () => {
  const roster = threeVsThree(Object.fromEntries(
    ["red-1", "red-2", "red-3", "blue-1", "blue-2", "blue-3"].map((id) => [id, { alive: false }])
  ));
  const framed = framedActors(roster, { result: { winnerTeamId: null } });
  assert.equal(framed.length, 6);
  // An empty set would be read as a close-up on arena x 0.
  assert.equal(cameraFor([]).focusX, 0);
});

/* ---------------------------------------------------------------- */
/* A death eases; only the roster re-seeds                           */
/* ---------------------------------------------------------------- */

test("A DEATH EASES THE CAMERA, IT NEVER REPLAYS THE OPENING SHOT", () => {
  const opening = run(threeVsThree(), 120);
  assert.equal(opening.camera.zoomscale, 50, "a settled 3v3 at the default formation");

  // The whole right flank falls; one frame on, the camera is where it was plus
  // one frame of its own ease — not back at the build's zoom of 5.
  const fallen = threeVsThree({ "blue-3": { alive: false }, "blue-2": { alive: false } });
  const next = stepFramedCamera(opening, fallen);
  assert.equal(next.rosterKey, opening.rosterKey, "the same roster: nobody left the arena");
  assert.notEqual(next.camera.zoomscale, SS2_CAMERA.zoomStart);
  // The four left standing need 45 with a full swing each side and the old
  // camera wants 50, so the floor holds: the frame is the old camera's step.
  assert.equal(next.heldByFloor, true);
  assert.deepEqual(next.camera, cameraStep(opening.camera, fallen));
  // The fit loosened (the flank no longer needs the stage), so the pan moves
  // by at most its sixteenth: the focus slid 255 arena units left.
  assert.ok(Math.abs(next.camera.gladiatorsX - opening.camera.gladiatorsX) < 255 * 0.5 / SS2_CAMERA.panEase + 1e-9,
    `the pan moved ${next.camera.gladiatorsX - opening.camera.gladiatorsX}`);

  // WHAT THE COUNT-KEYED SHELL WOULD HAVE DONE, so this test has teeth: its
  // signature was the number of actors handed over, which fell from 6 to 4.
  assert.notEqual(framedActors(fallen).length, framedActors(threeVsThree()).length);
  assert.equal(cameraFor(framedActors(fallen)).zoomscale, SS2_CAMERA.zoomStart);
});

test("a fall still being drawn holds the camera exactly where the living roster would", () => {
  const opening = run(threeVsThree(), 120);
  const falling = threeVsThree({ "blue-3": { alive: false, drawing: true } });
  let withFall = opening;
  let allStanding = opening;
  for (let frame = 0; frame < 30; frame += 1) {
    withFall = stepFramedCamera(withFall, falling);
    allStanding = stepFramedCamera(allStanding, threeVsThree());
  }
  assert.deepEqual(withFall.camera, allStanding.camera);
});

test("the re-seed is keyed on the roster's identity: a lane change is not a new bout, a new roster is", () => {
  const opening = run(threeVsThree(), 120);
  // `scene.drawOrder` sorts on y, so a lane change REORDERS what the shell hands over.
  const reordered = [...threeVsThree()].reverse();
  const stepped = stepFramedCamera(opening, reordered);
  assert.equal(stepped.rosterKey, opening.rosterKey);
  assert.equal(stepped.camera.zoomscale, 50);

  const newBout = threeVsThree().map((entry) => ({ ...entry, id: `${entry.id}-rematch` }));
  const reseeded = stepFramedCamera(opening, newBout);
  assert.notEqual(reseeded.rosterKey, opening.rosterKey);
  assert.equal(reseeded.camera.zoomscale, SS2_CAMERA.zoomStart, "a new roster opens on the build's establishing shot");
});

/* ---------------------------------------------------------------- */
/* Team to pair                                                      */
/* ---------------------------------------------------------------- */

test("WHITTLED TO ONE A SIDE, THE TEAM FRAMING HANDS OVER TO THE BUILD'S PAIR — gliding, not jumping", () => {
  const opening = run(threeVsThree(), 120);
  assert.equal(opening.camera.team, true);
  assert.equal(groundLineAt(opening.camera), 313.48, "the team framing's front line at zoom 50");

  // The CENTRE pair survives, 500 apart. Their close-up is 57 — 250 + 200 + 74
  // units from the focus to a swing's end, into the 299px from the dead zone to
  // the edge — over the old camera's 50, so the camera follows them, and the
  // hand-over runs WITH the zoom rising.
  const lastPair = threeVsThree({
    "red-3": { alive: false }, "red-2": { alive: false }, "blue-2": { alive: false }, "blue-3": { alive: false }
  });
  // The OUTRIGHT switch this replaces: the whole fight lifted 46.73px in a frame.
  const switched = { ...opening.camera, team: false, teamWeight: undefined };
  assert.ok(Math.abs(groundLineAt(switched) - groundLineAt(opening.camera) + 46.73) < 1e-9,
    `an outright switch moves the front line ${groundLineAt(switched) - groundLineAt(opening.camera)}px`);

  let state = opening;
  let previous = groundLineAt(opening.camera);
  let worst = 0;
  let frames = 0;
  while (state.camera.teamWeight !== 0 && frames < 100) {
    state = stepFramedCamera(state, lastPair);
    frames += 1;
    const line = groundLineAt(state.camera);
    worst = Math.max(worst, Math.abs(line - previous));
    previous = line;
    assert.equal(state.closeUp, true);
    assert.equal(state.camera.team, false, "the camera's own 1v1 rule has taken over");
  }
  assert.equal(frames, 21, "a fifth of the gap a frame, snapping inside 1%");
  assert.equal(state.camera.zoomscale, 57);
  assert.equal(groundLineAt(state.camera), 166.75 + 2 * 57, "and it lands exactly on the build's own pair line");
  // No frame moves the line by more than the first frame of the ease — a
  // fifth of the 46.73 gap plus one step of the zoom — against 46.73 at once.
  assert.ok(worst < 10, `the largest step was ${worst.toFixed(3)}px`);
});

test("FLANKS LEFT STANDING: the floor holds, and with it the old camera's framing", () => {
  // The two FLANKS survive, 1020 apart: their close-up (38) is under the old
  // camera's 50, so every frame is the old camera's — its zoom, its pan and its
  // team framing — and nothing hands over.
  const opening = run(threeVsThree(), 120);
  const flanks = threeVsThree({
    "red-1": { alive: false }, "red-2": { alive: false }, "blue-1": { alive: false }, "blue-2": { alive: false }
  });
  let state = opening;
  let old = opening.camera;
  for (let frame = 0; frame < 60; frame += 1) {
    state = stepFramedCamera(state, flanks);
    old = cameraStep(old, flanks);
    assert.equal(state.heldByFloor, true);
    assert.deepEqual(state.camera, old, `frame ${frame}`);
  }
  assert.equal(groundLineAt(state.camera), 313.48, "the team framing's line at 50, as before");
});

test("one a side AT REACH, the close-up tightens PAST the build's closest band, eased", () => {
  const opening = run([
    fighter("red-3", -330, "hero"), fighter("red-2", -200, "hero"), fighter("red-1", -65, "hero"),
    fighter("blue-1", 65, "villain"), fighter("blue-2", 200, "villain"), fighter("blue-3", 330, "villain")
  ], 120);
  // floor(640 / (660 + 2 * 105) * 100) = 73: the fit binds below the band's 80.
  assert.equal(opening.camera.zoomscale, 73, "six on the field, the fit binds below the band's 80");

  const lastPair = [
    fighter("red-3", -330, "hero", { alive: false }), fighter("red-2", -200, "hero", { alive: false }),
    fighter("red-1", -65, "hero"), fighter("blue-1", 65, "villain"),
    fighter("blue-2", 200, "villain", { alive: false }), fighter("blue-3", 330, "villain", { alive: false })
  ];
  let state = opening;
  let previousZoom = opening.camera.zoomscale;
  let previousLine = groundLineAt(opening.camera);
  for (let frame = 0; frame < 40; frame += 1) {
    state = stepFramedCamera(state, lastPair);
    const zoom = state.camera.zoomscale;
    assert.ok(zoom >= previousZoom, `the zoom only closes in: ${previousZoom} -> ${zoom}`);
    // The build's own ease: a fifth of the gap, or the ±4 snap.
    const target = state.camera.maxscale;
    assert.ok(zoom - previousZoom <= Math.max(SS2_CAMERA.zoomSnap, Math.round((target - previousZoom) / SS2_CAMERA.zoomEase)),
      `frame ${frame}: ${previousZoom} -> ${zoom} toward ${target}`);
    const line = groundLineAt(state.camera);
    assert.ok(Math.abs(line - previousLine) < 10, `frame ${frame}: the front line moved ${(line - previousLine).toFixed(2)}px`);
    previousZoom = zoom;
    previousLine = line;
  }
  // 65 + 200 + 74 = 339 units from the focus to the far edge of a swing, and
  // 299px from the dead zone's edge to the stage's: floor(29900 / 339) = 88.
  assert.equal(state.camera.zoomscale, 88);
  assert.equal(groundLineAt(state.camera), 166.75 + 2 * 88, "on the pair's own line, at the close-up's zoom");
});

test("the hand-over ease: its arithmetic, and a camera without a weight reads its `team` flag as before", () => {
  assert.equal(easeTeamWeight(1, 0), 0.8);
  assert.equal(easeTeamWeight(0, 1), 0.2);
  assert.equal(easeTeamWeight(0.005, 0), 0, "inside 1% it snaps");
  assert.equal(easeTeamWeight(Number.NaN, 1), 1);

  // A literal camera, as every existing caller and test builds one.
  const team = { zoomscale: 50, team: true };
  const pair = { zoomscale: 50 };
  assert.equal(groundLineAt(team), 313.48);
  assert.equal(groundLineAt(pair), 266.75);
  assert.equal(groundLineAt({ ...team, teamWeight: 1 }), groundLineAt(team), "weight 1 is the team's expression exactly");
  assert.equal(groundLineAt({ ...team, teamWeight: 0 }), groundLineAt(pair), "weight 0 is the pair's exactly");
  assert.ok(Math.abs(groundLineAt({ ...team, teamWeight: 0.5 }) - (313.48 + 266.75) / 2) < 1e-9, "and between, the blend");
  // A new bout opens ON its framing.
  assert.equal(cameraFor(threeVsThree()).teamWeight, 1);
  assert.equal(cameraFor(threeVsThree().slice(2, 4)).teamWeight, 0);
});

/* ---------------------------------------------------------------- */
/* The survivors' close-up (AUTHORED, the owner's request)           */
/* ---------------------------------------------------------------- */

/** Whether every framed fighter's measured swing-and-crown box is on the visible stage. */
function clippedAt(camera, framed) {
  const { visible, reach, lunge, crown } = SS2_CLOSE_UP;
  const out = [];
  for (const actor of framed) {
    const size = Math.abs(actor.yscale ?? 100) / 100;
    const margin = reach * size + lunge;
    const left = arenaToStage(camera, { x: actor.x - margin, y: actor.y ?? 200 }).x;
    const right = arenaToStage(camera, { x: actor.x + margin, y: actor.y ?? 200 }).x;
    const top = arenaToStage(camera, { x: actor.x, y: actor.y ?? 200, lift: crown * size }).y;
    if (left < visible.left || right > visible.right || top < visible.top) {
      out.push(`${actor.id} ${left.toFixed(1)}..${right.toFixed(1)}, crown ${top.toFixed(1)}`);
    }
  }
  return out;
}

test("A DEATH NEVER LOWERS THE ZOOM TARGET: the old camera's target, bodies included, is the floor", () => {
  // The 2v2 that measured LOOSER: two archers left at ±380, their front
  // rankers dead between them. The old camera held 65 (a body in reach of a
  // living enemy); the survivors alone fit only 45 with a full swing each side.
  const roster = [
    fighter("red-2", -380, "hero", { alive: true }), fighter("red-1", 40, "hero", { alive: false }),
    fighter("blue-1", 2, "villain", { alive: false }), fighter("blue-2", 380, "villain", { alive: true })
  ];
  const floor = targetZoomFor(midwaypointFor(roster), roster);
  assert.equal(floor, 65);
  assert.ok(closeUpZoomFor(framedActors(roster)) < floor, "the close-up alone would pull back");
  let state = run(roster.map((entry) => ({ ...entry, alive: true })), 120);
  for (let frame = 0; frame < 120; frame += 1) {
    state = stepFramedCamera(state, roster);
    assert.equal(state.heldByFloor, true, "the floor beats the safe fit, so the frame is the old camera's");
    assert.ok(state.camera.maxscale >= floor, `frame ${frame}: target ${state.camera.maxscale} under the floor ${floor}`);
  }
  assert.equal(state.camera.zoomscale, 65);
});

test("THE CLOSE-UP NEVER CROPS A FRAMED FIGHTER ON THE WAY IN, even while the pan lags", () => {
  // A 3v3 settled at 50, then everybody but red-1 falls: the camera must pan
  // 250 units and close in from 50 to 100, and the zoom may only rise as fast
  // as the pan brings him in.
  const opening = run(threeVsThree(), 120);
  const lone = threeVsThree({
    "red-1": { yscale: 86 },
    ...Object.fromEntries(["red-2", "red-3", "blue-1", "blue-2", "blue-3"].map((id) => [id, { alive: false }]))
  });
  const result = { winnerTeamId: "red" };
  let state = opening;
  let peak = 0;
  for (let frame = 0; frame < 400; frame += 1) {
    state = stepFramedCamera(state, lone, { result });
    assert.deepEqual(clippedAt(state.camera, state.framed), [], `frame ${frame} at zoom ${state.camera.zoomscale}`);
    peak = Math.max(peak, state.camera.zoomscale);
  }
  assert.equal(peak, 100, "and it does get there");

  // The same fall WITHOUT the pan-aware fit — only the settled one — crops him
  // on the way in: the zoom outruns a pan that moves a sixteenth a frame.
  let naive = opening.camera;
  let croppedFrames = 0;
  const framed = framedActors(lone, { result });
  const settled = closeUpZoomFor(framed, { teamWeights: [1, 0] });
  for (let frame = 0; frame < 400; frame += 1) {
    naive = cameraStep(naive, framed, { targetFor: () => settled });
    if (clippedAt(naive, framed).length > 0) croppedFrames += 1;
  }
  assert.ok(croppedFrames > 0, "the pan-aware fit is doing work, not decoration");
});

test("the close-up is OFF until a fall has finished being drawn, and never on in a 1v1", () => {
  // "Engaged" is either form: the close-up driving, or the floor holding the old camera.
  function engaged(state) {
    return state.closeUp || state.heldByFloor;
  }
  const falling = threeVsThree({ "blue-3": { alive: false, drawing: true } });
  assert.equal(engaged(stepFramedCamera(run(threeVsThree(), 5), falling)), false);
  const fallen = threeVsThree({ "blue-3": { alive: false, drawing: false } });
  assert.equal(engaged(stepFramedCamera(run(threeVsThree(), 5), fallen)), true);
  // Close together, the same fall lets the close-up drive.
  const close = threeVsThree({ "blue-3": { alive: false }, "red-3": { x: -120 }, "red-2": { x: -60 }, "red-1": { x: -10 },
    "blue-1": { x: 10 }, "blue-2": { x: 60 } });
  assert.equal(stepFramedCamera(run(close.map((entry) => ({ ...entry, alive: true })), 5), close).closeUp, true);
  const duel = [fighter("red-1", -60, "hero"), fighter("blue-1", 70, "villain", { alive: false })];
  assert.equal(engaged(stepFramedCamera(run(duel, 5), duel, { result: { winnerTeamId: "red" } })), false);
});

test("a fighter's span is everywhere his running clip draws him: a walk, a blink, a teleport, a lane change", () => {
  const actor = { x: 300, y: 200 };
  assert.deepEqual({ ...actorSpanFor(actor, null) }, { xMin: 300, xMax: 300, yMin: 200, yMax: 200 });
  // The scene already holds the destination (300); he is drawn from 120.
  assert.deepEqual({ ...actorSpanFor(actor, { motion: { from: 120, to: 300 } }) }, { xMin: 120, xMax: 300, yMin: 200, yMax: 200 });
  // A ghost strike stands him BESIDE his victim, outside from..to.
  assert.deepEqual({ ...actorSpanFor(actor, { motion: { from: 120, to: 300, blink: 460 } }) },
    { xMin: 120, xMax: 460, yMin: 200, yMax: 200 });
  // A lane change: both ends of the depth.
  assert.deepEqual({ ...actorSpanFor({ x: 0, y: 103 }, { depthMotion: { from: 200, to: 103 } }) },
    { xMin: 0, xMax: 0, yMin: 103, yMax: 200 });
});

test("the floor holds WHILE THE PAN CATCHES UP to a close-up that will win", () => {
  // A tight 3v3 settles at 73; the flank at -330 is the last standing. His
  // close-up is 100 once the pan reaches him, but at the old camera's pan his
  // swing only fits 55 — and the target must not dip to 55 on the way.
  const tight = [
    fighter("red-3", -330, "hero"), fighter("red-2", -200, "hero"), fighter("red-1", -65, "hero"),
    fighter("blue-1", 65, "villain"), fighter("blue-2", 200, "villain"), fighter("blue-3", 330, "villain")
  ].map((entry) => ({ ...entry, yscale: 86 }));
  const opening = run(tight, 120);
  assert.equal(opening.camera.zoomscale, 73);
  const lone = tight.map((entry) => ({ ...entry, alive: entry.id === "red-3" }));
  const floor = targetZoomFor(midwaypointFor(lone), lone);
  assert.equal(floor, 73);
  assert.equal(closeUpZoomFor(framedActors(lone)), 100, "the settled close-up wins");
  assert.ok(closeUpZoomFor(framedActors(lone), { gladiatorsX: opening.camera.gladiatorsX }) < floor,
    "but not at the pan it starts from");
  let state = opening;
  let peak = 0;
  for (let frame = 0; frame < 400; frame += 1) {
    state = stepFramedCamera(state, lone, { result: { winnerTeamId: "red" } });
    assert.ok(state.camera.maxscale >= floor, `frame ${frame}: target ${state.camera.maxscale} under the floor`);
    assert.ok(state.camera.zoomscale >= 73, `frame ${frame}: zoom ${state.camera.zoomscale} looser than before the death`);
    peak = Math.max(peak, state.camera.zoomscale);
  }
  assert.equal(peak, 100);
});

test("A HOLD AFTER THE CLOSE-UP HAS PANNED converges on the old camera EXACTLY — the dead zone does not keep them apart", () => {
  // The first fix for Codex's finding stepped the OLD RULE from the close-up's
  // own state. The zoom converged but the pan did not: inside the build's dead
  // zone (300..340) the pan does not move at all, so a camera that had panned
  // to the survivors stayed up to 40px off the old camera's pan for good, and
  // the randomised sweep measured crops there 60+ frames after the switch.
  // A held frame is now the old camera itself, carried beside this one.
  const tight = [
    fighter("red-3", -330, "hero"), fighter("red-2", -200, "hero"), fighter("red-1", -65, "hero"),
    fighter("blue-1", 65, "villain"), fighter("blue-2", 200, "villain"), fighter("blue-3", 330, "villain")
  ].map((entry) => ({ ...entry, yscale: 86 }));
  const survivors = new Set(["red-2", "blue-1"]);
  const fallen = tight.map((entry) => ({ ...entry, alive: survivors.has(entry.id) }));
  let state = run(tight, 120);
  let old = state.old;
  for (let frame = 0; frame < 300; frame += 1) {
    state = stepFramedCamera(state, fallen);
    old = cameraStep(old, fallen);
  }
  assert.equal(state.closeUp, true, "first the close-up wins, and pans to the two left standing");
  assert.notEqual(state.camera.gladiatorsX, old.gladiatorsX);
  // Then red-2 backs off to -700: what fits the two survivors (47) falls under the floor (51).
  const apart = fallen.map((entry) => (entry.id === "red-2" ? { ...entry, x: -700 } : entry));
  // AND THE SWITCH IS NOT A JUMP: no frame covers more than half the gap between
  // the two pans, where cutting straight to the old camera would cover all of it.
  const gap = Math.abs(state.camera.gladiatorsX - old.gladiatorsX);
  assert.ok(gap > 10, `the two pans are ${gap.toFixed(1)} apart when the hold begins`);
  let previousPan = state.camera.gladiatorsX;
  let widest = 0;
  for (let frame = 0; frame < 120; frame += 1) {
    state = stepFramedCamera(state, apart);
    old = cameraStep(old, apart);
    assert.equal(state.heldByFloor, true);
    widest = Math.max(widest, Math.abs(state.camera.gladiatorsX - previousPan));
    previousPan = state.camera.gladiatorsX;
  }
  assert.ok(widest < gap / 2, `the widest single-frame pan move was ${widest.toFixed(2)} across a gap of ${gap.toFixed(2)}`);
  assert.deepEqual(state.camera, old, "held: the old camera's zoom, pan and framing, to the digit");
});

/** How far a fighter's full swing lies off the visible stage, at this camera. */
function swingOverflow(camera, x, size) {
  const margin = SS2_CLOSE_UP.reach * size + SS2_CLOSE_UP.lunge;
  return Math.max(0,
    SS2_CLOSE_UP.visible.left - arenaToStage(camera, { x: x - margin }).x,
    arenaToStage(camera, { x: x + margin }).x - SS2_CLOSE_UP.visible.right);
}

test("the hold is released only when the pan the camera HAS can fit the survivors, not merely where it will settle", () => {
  // Found by the randomised sweep (layout 128 of seed 7): a lone winner whose
  // close-up wins on its settled fit, while this camera's own pan is still far
  // off from an earlier phase. Released on the settled fit alone, the frame
  // blended toward that pan and cropped him more than the old camera did.
  const roster = [
    { id: "red-0", x: 91, y: 200, yscale: 86, side: "hero", teamId: "red", alive: false, drawing: false },
    { id: "red-1", x: -463, y: 200, yscale: 86, side: "hero", teamId: "red", alive: false, drawing: false },
    { id: "blue-2", x: -28, y: 200, yscale: 86, side: "villain", teamId: "blue", alive: true, drawing: false }
  ];
  const result = { winnerTeamId: "blue" };
  let state = run(roster, 300, { result });
  const floor = targetZoomFor(midwaypointFor(roster), roster);
  assert.ok(closeUpZoomFor(framedActors(roster, { result })) >= floor, "his settled close-up beats the floor");
  // This camera's pan, held off-centre as an earlier phase left it; the frame is held.
  state = { ...state, own: { ...state.own, gladiatorsX: 170 }, hold: 1, closeUp: false, heldByFloor: true };
  assert.ok(closeUpZoomFor(framedActors(roster, { result }), { gladiatorsX: 170 }) < floor, "but not at the pan it has");
  let released = 0;
  for (let frame = 0; frame < 240; frame += 1) {
    state = stepFramedCamera(state, roster, { result });
    if (!state.heldByFloor) released += 1;
    const now = swingOverflow(state.camera, -28, 0.86);
    const before = swingOverflow(state.old, -28, 0.86);
    assert.ok(now <= before + 1e-9, `frame ${frame}: ${now.toFixed(2)}px off with this camera, ${before.toFixed(2)}px with the old one`);
  }
  assert.ok(released > 0, "and once the pan arrives, the close-up takes over");
});

test("never looser than the old camera is RIGHT NOW, while it is still easing down to its target", () => {
  // Found by the sweep: this camera snapped to its own target while the old
  // one was still coming down from above — looser than the old camera for a
  // frame, though never below its target.
  const pair = threeVsThree({
    "red-3": { alive: false }, "red-2": { alive: false }, "blue-2": { alive: false }, "blue-3": { alive: false }
  });
  let state = run(threeVsThree(), 120);
  for (let frame = 0; frame < 60; frame += 1) state = stepFramedCamera(state, pair);
  assert.equal(state.closeUp, true);
  // The old camera caught high (70), easing down to 50; this one at 50, heading for 57.
  state = { ...state, own: { ...state.own, zoomscale: 50 }, old: { ...state.old, zoomscale: 70 }, camera: { ...state.camera, zoomscale: 50 } };
  for (let frame = 0; frame < 30; frame += 1) {
    state = stepFramedCamera(state, pair);
    assert.ok(state.camera.zoomscale >= state.old.zoomscale,
      `frame ${frame}: ${state.camera.zoomscale} against the old camera's ${state.old.zoomscale}`);
  }
  assert.equal(state.camera.zoomscale, 57);
});

test("the close-up's constants are the sources they name", () => {
  assert.equal(SS2_CLOSE_UP.lunge, ADVANCE_UNITS, "the lunge is timeline.js's own");
  assert.equal(SS2_CLOSE_UP.zoomCap, 100, "the owner's cap");
  assert.ok(SS2_CLOSE_UP.zoomCap > SS2_CAMERA.bands[0].scale, "and it is past the build's tightest band");
});

test("CODEX'S ASYMMETRIC DEATH: a held floor never pans a survivor off the stage the old camera kept him on", () => {
  // Codex's review, 2026-09-24. Four front-rankers, `_yscale` 86; the one at
  // 220 falls. The floor holds 75 over a safe fit of 56 — and until the fix,
  // the pan went on following the SURVIVORS (55.05 -> 81.30), which carried the
  // survivor at 150's measured reach from 615.92 to 642.17, past the stage's
  // right edge of 639, while the old camera kept him on it.
  const xs = [-420, -100, 150, 220];
  const layout = (fallen) => xs.map((x, index) => ({
    id: `f${index}`, x, y: 200, yscale: 86, side: index < 2 ? "hero" : "villain",
    teamId: index < 2 ? "red" : "blue", alive: !(fallen && x === 220), drawing: false
  }));
  let state = run(layout(false), 200);
  let old = state.camera;
  const fallen = layout(true);
  // Both geometries: Codex's (the measured reach alone) and the rule's own
  // (the reach rounded up, plus the lunge).
  const margins = [199.1 * 0.86, SS2_CLOSE_UP.reach * 0.86 + SS2_CLOSE_UP.lunge];
  function overflow(camera, x, margin) {
    return Math.max(0,
      SS2_CLOSE_UP.visible.left - arenaToStage(camera, { x: x - margin }).x,
      arenaToStage(camera, { x: x + margin }).x - SS2_CLOSE_UP.visible.right);
  }
  let held = 0;
  for (let frame = 0; frame < 200; frame += 1) {
    state = stepFramedCamera(state, fallen);
    old = cameraStep(old, fallen);
    if (state.heldByFloor) held += 1;
    for (const survivor of [-420, -100, 150]) {
      for (const margin of margins) {
        const now = overflow(state.camera, survivor, margin);
        const before = overflow(old, survivor, margin);
        assert.ok(now <= before + 1e-9,
          `frame ${frame}: the survivor at ${survivor} (margin ${margin.toFixed(1)}) is ${now.toFixed(2)}px off ` +
          `with this camera and ${before.toFixed(2)}px with the old one`);
      }
    }
  }
  assert.equal(held, 200, "the floor held every frame: 75 over a safe fit of 56");
  assert.equal(state.camera.zoomscale, 75);
});

test("CODEX'S WALK OUTWARD: the zoom DRAWN never runs past what fits at the pan it has, with no switch to excuse it", () => {
  // Codex's review, pass 3, 2026-09-24. A tight 3v3 at `_yscale` 86 whittled to
  // the centre pair at ±65, and the close-up settles at 96 on the two of them.
  // Then the survivor at +65 walks out to 190: the scene holds 190 and his span
  // is 65..190. What fits at this pan drops to 73 in one frame — but the zoom
  // only EASED toward it by the build's fifth (96 -> 91 -> 88 ...), so for seven
  // frames his measured swing ran off the right edge (714.21 against the old
  // camera's 638.23) with the floor never holding and no blend under way.
  const tight = [
    fighter("red-3", -330, "hero"), fighter("red-2", -200, "hero"), fighter("red-1", -65, "hero"),
    fighter("blue-1", 65, "villain"), fighter("blue-2", 200, "villain"), fighter("blue-3", 330, "villain")
  ].map((entry) => ({ ...entry, yscale: 86 }));
  const pair = tight.map((entry) => ({ ...entry, alive: Math.abs(entry.x) === 65 }));
  let state = run(tight, 120);
  let old = state.camera;
  for (let frame = 0; frame < 300; frame += 1) {
    state = stepFramedCamera(state, pair);
    old = cameraStep(old, pair);
  }
  // 65 + 172 + 74 = 311 units from the focus to a swing's end, into 299px: floor(96.1).
  assert.equal(state.camera.zoomscale, 96, "the close-up on the centre pair");
  assert.equal(old.zoomscale, 73, "and the old camera, bodies included, at its fit");

  const walked = pair.map((entry) => (entry.id === "blue-1" ? { ...entry, x: 190, xMin: 65, xMax: 190 } : entry));
  const margin = SS2_CLOSE_UP.reach * 0.86 + SS2_CLOSE_UP.lunge;
  const spans = [{ id: "red-1", lo: -65 - margin, hi: -65 + margin }, { id: "blue-1", lo: 65 - margin, hi: 190 + margin }];
  const overflowOf = (camera, { lo, hi }) => Math.max(0,
    SS2_CLOSE_UP.visible.left - arenaToStage(camera, { x: lo }).x,
    arenaToStage(camera, { x: hi }).x - SS2_CLOSE_UP.visible.right);
  for (let frame = 0; frame < 300; frame += 1) {
    state = stepFramedCamera(state, walked);
    old = cameraStep(old, walked);
    assert.ok(state.camera.zoomscale >= old.zoomscale, `frame ${frame}: ${state.camera.zoomscale} looser than ${old.zoomscale}`);
    for (const span of spans) {
      const now = overflowOf(state.camera, span);
      const before = overflowOf(old, span);
      assert.ok(now <= before + 1e-9, `frame ${frame} at zoom ${state.camera.zoomscale}: ${span.id}'s swing is ` +
        `${now.toFixed(2)}px off with this camera and ${before.toFixed(2)}px with the old one`);
    }
  }
  // And it still follows the pair, tighter than the old 73. It rests at 79, not
  // the settled fit's 80: at 79 the pan parks the focus (62.5) on the dead
  // zone's 340, so the origin is 340 - 62.5 * 0.79 = 290.625 and the swing's
  // right end, 436 units out, fits only floor(100 * 348.375 / 436) = 79 there.
  assert.equal(state.closeUp, true);
  assert.equal(state.camera.zoomscale, 79);
});

test("A PAN THAT PUTS THE ARENA'S ORIGIN OFF THE STAGE: zooming OUT can crop too, so what fits there is a range, not a ceiling", () => {
  // Found by a targeted search after Codex's pass 3, 2026-09-24. The default
  // 3v3's left flank wins alone at -510 and the close-up centres him at 100:
  // the pan is ~490, so arena x 0 is drawn at stage x ~810, off the right edge.
  // He then walks IN to -260. His swing's right end (-260 + 246 = -14) is left
  // of arena 0, so zooming out does not pull it on — it slides it RIGHT, toward
  // an origin that is already off the stage. The fit at this pan took only the
  // ceilings (a right end right of arena 0, a left end left of it) and called
  // 100 safe, and the zoom eased down from 100 with his swing 145px off the right.
  const flanked = threeVsThree(Object.fromEntries(
    ["red-3", "red-2", "red-1", "blue-1", "blue-2", "blue-3"].map((id) => [id, { yscale: 86, alive: id === "red-3" }])
  ));
  const result = { winnerTeamId: "red" };
  let state = run(threeVsThree(), 120);
  let old = state.camera;
  for (let frame = 0; frame < 300; frame += 1) {
    state = stepFramedCamera(state, flanked, { result });
    old = cameraStep(old, flanked);
  }
  assert.equal(state.camera.zoomscale, 100);
  assert.ok(arenaToStage(state.camera, { x: 0 }).x > SS2_CLOSE_UP.visible.right,
    `arena x 0 is drawn at stage x ${arenaToStage(state.camera, { x: 0 }).x.toFixed(1)}`);

  const walked = flanked.map((entry) => (entry.id === "red-3" ? { ...entry, x: -260, xMin: -510, xMax: -260 } : entry));
  const margin = SS2_CLOSE_UP.reach * 0.86 + SS2_CLOSE_UP.lunge;
  const span = { lo: -510 - margin, hi: -260 + margin };
  const overflowOf = (camera) => Math.max(0,
    SS2_CLOSE_UP.visible.left - arenaToStage(camera, { x: span.lo }).x,
    arenaToStage(camera, { x: span.hi }).x - SS2_CLOSE_UP.visible.right);
  let held = 0;
  for (let frame = 0; frame < 400; frame += 1) {
    state = stepFramedCamera(state, walked, { result });
    old = cameraStep(old, walked);
    if (state.heldByFloor) held += 1;
    assert.ok(state.camera.zoomscale >= old.zoomscale, `frame ${frame}: ${state.camera.zoomscale} looser than ${old.zoomscale}`);
    const now = overflowOf(state.camera);
    const before = overflowOf(old);
    // The one place a new crop may appear is the blend INTO a hold, a
    // documented switch — never a frame the close-up draws on its own.
    assert.ok(now <= before + 1e-9 || (state.heldByFloor && state.hold < 1), `frame ${frame} at zoom ` +
      `${state.camera.zoomscale} (hold ${state.hold}): his swing is ${now.toFixed(2)}px off with this camera and ` +
      `${before.toFixed(2)}px with the old one`);
  }
  // No zoom fits him at the pan the close-up has when the walk starts, so the
  // old camera takes the frame until the pan has followed him in...
  assert.ok(held > 0, "the hold carried the frames the close-up could not");
  // ...and then the close-up is his again.
  assert.equal(state.closeUp, true);
  assert.ok(state.camera.zoomscale > old.zoomscale, `${state.camera.zoomscale} against the old camera's ${old.zoomscale}`);
});

test("NEVER LOOSER and FITS HERE can disagree: while the old camera is still easing down above what fits, the frame is held", () => {
  // Found by the randomised sweep (layout 121 of seed 7), after Codex's pass 3.
  // Blue-3 (`_yscale` 73, rank 1) is the last standing when red-0's fall ends;
  // that same frame he walks out from 99 to 497. The old camera's target drops
  // to 30, but it is still at 43 on the way down; what fits him here is at most
  // 40. No zoom is both: drawn at 43 on this camera's pan, his swing ran 17px
  // off the right edge that the old camera kept him inside, with nothing held.
  const at = (id, x, y, yscale, side) => ({ id, x, y, yscale, side, teamId: side === "hero" ? "red" : "blue", alive: true, drawing: false });
  const roster = [at("red-0", -358, 6, 118, "hero"), at("red-1", -491, 6, 127, "hero"),
    at("blue-2", 690, 200, 103, "villain"), at("blue-3", 99, 103, 73, "villain")];
  const twoDown = roster.map((entry) => (["blue-2", "red-1"].includes(entry.id) ? { ...entry, alive: false } : entry));
  const falling = twoDown.map((entry) => (entry.id === "red-0" ? { ...entry, alive: false, drawing: true } : entry));
  const walked = falling.map((entry) => (entry.id === "red-0" ? { ...entry, drawing: false }
    : entry.id === "blue-3" ? { ...entry, x: 497, xMin: 99, xMax: 497 } : entry));
  const result = { winnerTeamId: "blue" };
  let state = null;
  let old = null;
  const step = (placed, options = {}) => {
    state = stepFramedCamera(state, placed, options);
    old = old === null ? cameraFor(placed) : cameraStep(old, placed);
  };
  for (let frame = 0; frame < 150; frame += 1) step(roster);
  for (let frame = 0; frame < 150; frame += 1) step(twoDown);
  for (let frame = 0; frame < 25; frame += 1) step(falling, { result });
  const margin = SS2_CLOSE_UP.reach * 0.73 + SS2_CLOSE_UP.lunge;
  const overflowOf = (camera) => Math.max(0,
    SS2_CLOSE_UP.visible.left - arenaToStage(camera, { x: 99 - margin, y: 103 }).x,
    arenaToStage(camera, { x: 497 + margin, y: 103 }).x - SS2_CLOSE_UP.visible.right);
  let held = 0;
  for (let frame = 0; frame < 120; frame += 1) {
    step(walked, { result });
    if (state.heldByFloor) held += 1;
    assert.ok(state.camera.zoomscale >= old.zoomscale, `frame ${frame}: ${state.camera.zoomscale} looser than ${old.zoomscale}`);
    const now = overflowOf(state.camera);
    const before = overflowOf(old);
    assert.ok(now <= before + 1e-9 || (state.heldByFloor && state.hold < 1), `frame ${frame} at zoom ` +
      `${state.camera.zoomscale} (hold ${state.hold}): his swing is ${now.toFixed(2)}px off with this camera and ` +
      `${before.toFixed(2)}px with the old one`);
  }
  assert.ok(held > 0, "the frame where the two promises disagree is the old camera's");
  assert.equal(state.closeUp, true, "and the close-up has him again once the old camera has come down");
});

test("what fits AT A PAN is a range: a ceiling while arena x 0 is on the stage, a floor as well once it is off", () => {
  const winner = { x: -510, y: 200, yscale: 86 };
  // On the stage (pan 0) it is the ceiling alone, the same as the target's fit:
  // his left end, -510 - 246 = -756 units, into the 319.95px left of the origin.
  assert.deepEqual({ ...closeUpZoomRangeAt([winner], { gladiatorsX: 0 }) }, { min: 0, max: 42 });
  assert.equal(closeUpZoomFor([winner], { gladiatorsX: 0 }), 42);
  // Panned 490 onto him, the origin is at 809.95. His right end, -264 units,
  // is on the stage only from z = 100 * 170.95 / 264 = 64.75 up; his left end
  // holds to 107, over the cap.
  assert.deepEqual({ ...closeUpZoomRangeAt([winner], { gladiatorsX: 490 }) }, { min: 65, max: 100 });
  // A swing that ends EXACTLY at arena x 0, with the origin off the right edge,
  // is off the stage at every zoom.
  assert.equal(closeUpZoomRangeAt([{ x: -246, y: 200, yscale: 86 }], { gladiatorsX: 400 }), null);
  // And the crown stays a ceiling: a back-rank winner, as `closeUpZoomFor` has him.
  assert.equal(closeUpZoomRangeAt([{ x: -8, y: 6, yscale: 86 }], { gladiatorsX: 0, teamWeights: [0] }).max, 77);
});

test("A LONE FLANK WALKING FURTHER OUT: the zoom drawn holds him from both sides, and the camera does not cycle", () => {
  // Found by a grid of lone-winner walks after the fix for Codex's pass 3. A
  // wide 3v3 whose left flank, at -700, is the last standing; the close-up pans
  // the origin far off the right edge, so what fits him there has a FLOOR as
  // well as a ceiling. He walks out to -950. Two ways to get it wrong, both seen:
  //   - draw this camera's own eased zoom when it is under that floor: his swing
  //     is pulled off the right edge by zooming out, with nothing held;
  //   - feed the checked zoom back into this camera's own ease: the floor drags
  //     the zoom up, the pan chases a focus that moves with the zoom, the floor
  //     rises again, nothing fits, the hold catches it, and round it goes — the
  //     hold engaged 38 times in four seconds.
  const wide = [
    fighter("red-3", -700, "hero"), fighter("red-2", -600, "hero"), fighter("red-1", -500, "hero"),
    fighter("blue-1", 500, "villain"), fighter("blue-2", 600, "villain"), fighter("blue-3", 700, "villain")
  ].map((entry) => ({ ...entry, yscale: 86 }));
  const lone = wide.map((entry) => ({ ...entry, alive: entry.id === "red-3" }));
  const result = { winnerTeamId: "red" };
  let state = run(wide, 120);
  let old = state.camera;
  for (let frame = 0; frame < 300; frame += 1) {
    state = stepFramedCamera(state, lone, { result });
    old = cameraStep(old, lone);
  }
  const walked = lone.map((entry) => (entry.id === "red-3" ? { ...entry, x: -950, xMin: -950, xMax: -700 } : entry));
  const margin = SS2_CLOSE_UP.reach * 0.86 + SS2_CLOSE_UP.lunge;
  const overflowOf = (camera) => Math.max(0,
    SS2_CLOSE_UP.visible.left - arenaToStage(camera, { x: -950 - margin }).x,
    arenaToStage(camera, { x: -700 + margin }).x - SS2_CLOSE_UP.visible.right);
  let engagements = 0;
  let wasHeld = state.heldByFloor;
  for (let frame = 0; frame < 240; frame += 1) {
    state = stepFramedCamera(state, walked, { result });
    old = cameraStep(old, walked);
    if (state.heldByFloor && !wasHeld) engagements += 1;
    wasHeld = state.heldByFloor;
    assert.ok(state.camera.zoomscale >= old.zoomscale, `frame ${frame}: ${state.camera.zoomscale} looser than ${old.zoomscale}`);
    const now = overflowOf(state.camera);
    const before = overflowOf(old);
    assert.ok(now <= before + 1e-9 || (state.heldByFloor && state.hold < 1), `frame ${frame} at zoom ` +
      `${state.camera.zoomscale} (hold ${state.hold}): his swing is ${now.toFixed(2)}px off with this camera and ` +
      `${before.toFixed(2)}px with the old one`);
  }
  assert.ok(engagements <= 1, `the hold engaged ${engagements} times`);
  assert.equal(state.closeUp, true);
});

/* ---------------------------------------------------------------- */
/* The close-up keeps every framed rank on the floor                  */
/* ---------------------------------------------------------------- */

/** How far each framed fighter's feet stand below the foot of each arena's painted wall, at this camera. */
function wallClearances(camera, framed) {
  const crowd = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "crowd");
  const out = [];
  for (const actor of framed) {
    const depths = [actor.y ?? 200, actor.yMin, actor.yMax].filter(Number.isFinite);
    for (const wall of SS2_ARENA_WALL_BASE) {
      // The painter's own route to the wall: the crowd layer's placement, which
      // follows the camera's `crowdY`, plus that arena's measured foot.
      const foot = layerPlacementFor(crowd, camera).y + wall.crowdY;
      for (const y of depths) {
        out.push({ id: actor.id, arena: wall.arena, y, clearance: arenaToStage(camera, { x: actor.x, y }).y - foot });
      }
    }
  }
  return out;
}

test("THE SURVIVORS' CLOSE-UP KEEPS EVERY FRAMED RANK ON THE FLOOR: a small back-ranker no longer stands in arena 5's wall", () => {
  // The defect, found by the HUD's camera study (2026-09-24) and re-measured
  // here before the fix: a 2v2 down one, three framed on the team framing, the
  // back-ranker (y 6) shrunk to `_yscale` 50 by little fat kid (item 33, the
  // `crowd` kit's). His crown no longer binds, so the close-up took the camera
  // to 97 — and at 97 the back rank's feet stood 17.39px INSIDE arena 5's wall.
  // `SS2_CLOSE_UP.zoomCap` is 100 and the old sweep stopped at the build's 80.
  //
  // Worked by hand: on the team framing the back rank (y 6, drawn at 103)
  // stands at 293.48 + 0.4 ceil z - 0.97 z; arena 5's wall foot is at
  // 166.75 - 200 + ceil z + 191.83. At least 5px between them holds to z 82
  // (6.16px) and fails at 83 (4.59px).
  const roster = [
    { id: "a0", x: -40, y: 200, yscale: 86, side: "A", teamId: "A", alive: true },
    { id: "a1", x: -60, y: 6, yscale: 50, side: "A", teamId: "A", alive: true },
    { id: "b0", x: 40, y: 200, yscale: 86, side: "B", teamId: "B", alive: false, drawing: false },
    { id: "b1", x: 60, y: 200, yscale: 86, side: "B", teamId: "B", alive: true }
  ];
  let state = null;
  let peak = 0;
  for (let frame = 0; frame < 400; frame += 1) {
    state = stepFramedCamera(state, roster);
    peak = Math.max(peak, state.camera.zoomscale);
    for (const { id, arena, y, clearance } of wallClearances(state.camera, state.framed)) {
      assert.ok(clearance >= SS2_CLOSE_UP.wallMargin,
        `frame ${frame} at zoom ${state.camera.zoomscale}: ${id} (y ${y}) stands ${clearance.toFixed(2)}px below arena ${arena}'s wall foot`);
    }
  }
  assert.equal(state.closeUp, true, "the close-up still drives");
  assert.equal(state.camera.teamWeight, 1);
  assert.equal(state.camera.zoomscale, 82, "as close as the back rank allows");
  assert.equal(peak, 82);
  assert.equal(closeUpZoomFor(state.framed, { teamWeights: [1] }), 82);
  // In the FRONT rank the same three close in past it: only the back rank binds.
  const front = state.framed.map((actor) => ({ ...actor, y: 200 }));
  assert.ok(closeUpZoomFor(front, { teamWeights: [1] }) > 82);
});
