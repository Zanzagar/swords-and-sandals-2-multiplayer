/**
 * THE CAMERA UNDER THE IN-FRAME TEAM HUD (D3, 2026-09-24), and the close-up's
 * wall, which it needed first.
 *
 * The owner: *"the team health, energy, and aramor should be in the game frame
 * as UI elements ... Make camera adjustments necessary to fit these assets."*
 * The HUD is drawn in the stage's bottom band, so in a team bout the camera
 * must keep every framed fighter's feet, shadow and name plate above the HUD's
 * highest ink (`hudTop`). A 1v1 is the build's own panel under the build's own
 * camera, and never passes one.
 *
 * Seams under test: `stepFramedCamera` (who is framed and where, frame by
 * frame), `arenaToStage`/`groundLineAt`/`stageProjectorFor` (where a framed
 * fighter is drawn), `closeUpZoomFor` (the close-up's fit), the ink model
 * (`namePlateDepthAt`, `inkDepthAt`) and, in the fitted view, `viewportFor`.
 * The bouts come off a REAL host (the arena's demo rosters, the rule set's own
 * AI), never a mock.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  SS2_ARENA_SCREEN_LAYERS,
  SS2_ARENA_WALL_BASE,
  SS2_CAMERA,
  SS2_CLOSE_UP,
  SS2_TEAM_HUD,
  actorSpanFor,
  arenaToStage,
  inkDepthAt,
  groundLineAt,
  layerPlacementFor,
  namePlateDepthAt,
  stageFitFor,
  stageProjectorFor,
  stepFramedCamera
} from "../src/render/arena-backdrop.js";
import { paintShadow } from "../src/render/painter.js";
import { figureSpecFor } from "../src/render/figure.js";
import { poseAt, timelineFor } from "../src/render/timeline.js";
import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2PhysicalSize, ss2TeamRules } from "../src/team/ss2-rules.js";
import { resourceValue } from "../src/team/resources.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { ss2ColossusYscaleAfter } from "../src/common/ss2-figure.js";
import { viewportFor } from "../src/render/arena-shell.js";
import { namePlateLayout } from "../tools/arena/team-hud.js";
import { SS2_FIGURE_HEIGHT } from "../src/render/painter.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * THE CAMERA MODULE AS IT WAS BEFORE THE HUD: `src/render/arena-backdrop.js`
 * at 808f6da, read out of git and imported whole (it imports nothing). Throws
 * rather than skipping, as the transcription guard does: an identity check that
 * cannot see what it is identical TO has to say so.
 */
async function baseCameraModule() {
  let source;
  try {
    source = execFileSync("git", ["show", "808f6da:src/render/arena-backdrop.js"], { cwd: REPO_ROOT, encoding: "utf8" });
  } catch (error) {
    throw new Error(`the identity sweep needs read-only git history (commit 808f6da) at ${REPO_ROOT}: ${error.message}`,
      { cause: error });
  }
  assert.ok(!/^import /m.test(source), "the base module imports nothing, so it loads on its own");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

/**
 * THE FITTED VIEW AS IT WAS BEFORE THE HUD: `src/render/arena-shell.js` at
 * 808f6da. Its one import (`./painter.js`, for `SS2_FIGURE_HEIGHT`) is pointed
 * at this tree's painter, which this change does not touch.
 */
async function baseShellModule() {
  const source = execFileSync("git", ["show", "808f6da:src/render/arena-shell.js"], { cwd: REPO_ROOT, encoding: "utf8" });
  const painter = new URL("../src/render/painter.js", import.meta.url).href;
  const imports = source.match(/^import .*$/gm) ?? [];
  assert.deepEqual(imports, ['import { SS2_FIGURE_HEIGHT } from "./painter.js";'], "the base shell's only import");
  const rewired = source.replace('from "./painter.js"', `from "${painter}"`);
  return import(`data:text/javascript;base64,${Buffer.from(rewired).toString("base64")}`);
}

const deps = { ss2Combatant, ss2BattleValues };
/** The arena's demo bout, headless: the roster and rule set `tools/arena/main.js` builds. */
function demoHost({ perSide, seed, kit = "" }) {
  const items = demoItemsFrom(kit);
  return createVanillaBattleHost({
    teams: [demoSide("red", perSide, { ...deps, items, seed }), demoSide("blue", perSide, { ...deps, items, seed })],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed
  });
}
/** The `_yscale` a fighter is drawn at, his colossus or little-fat-kid spell applied. */
function yscaleOf(host, id) {
  const record = host.combatant(id);
  const built = ss2PhysicalSize(record);
  return resourceValue(record, "spell_colossus", 0) > 0 ? ss2ColossusYscaleAfter(built, 100)
    : resourceValue(record, "spell_little_fat_kid", 0) > 0 ? 50 : built;
}
/** Every placed fighter as `placedActors()` in `tools/arena/main.js` hands him over, nobody mid-clip. */
function rosterOf(host) {
  return host.wire().teams.flatMap((team) => team.combatants).filter((c) => Number.isFinite(c.x)).map((c) => {
    const placement = host.layout.placementFor(c.id);
    return {
      id: c.id, x: c.x, y: c.y, yscale: yscaleOf(host, c.id), ...actorSpanFor({ x: c.x, y: c.y }, null),
      side: placement?.side ?? null, teamId: placement?.teamId ?? null, alive: c.alive !== false, drawing: false
    };
  });
}
/**
 * Plays a demo bout with the rule set's own AI, stepping each camera `frames`
 * frames per turn on that turn's roster — one continuous camera, as the arena
 * runs it — and hands each frame to `visit`.
 */
function playBout({ perSide, seed, kit }, cameras, frames, visit) {
  const host = demoHost({ perSide, seed, kit });
  const states = cameras.map(() => null);
  for (let taken = 0; !host.battle.result && taken < 1500; taken += 1) {
    const roster = rosterOf(host);
    const result = host.battle.result ?? null;
    for (let frame = 0; frame < frames; frame += 1) {
      cameras.forEach((step, index) => { states[index] = step(states[index], roster, result); });
      visit(states, { taken, frame, roster });
    }
    const due = host.currentCombatantId();
    host.submit({ ...host.suggestAction(due), actorId: due });
  }
}

/** A small seeded generator (mulberry32), so a random sweep is the same sweep every run. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How far above the foot of the LOWEST painted wall of the six arenas each
 * framed depth stands, at this camera — measured the painter's way (the crowd
 * layer's placement plus each arena's measured foot), not through the fit.
 */
function worstWallClearance(camera, framed) {
  const crowd = SS2_ARENA_SCREEN_LAYERS.find((layer) => layer.prop === "crowd");
  let worst = Infinity;
  for (const wall of SS2_ARENA_WALL_BASE) {
    const foot = layerPlacementFor(crowd, { crowdY: -200 + Math.ceil(camera.zoomscale) }).y + wall.crowdY;
    for (const actor of framed) {
      for (const y of [actor.y, actor.yMin, actor.yMax].filter(Number.isFinite)) {
        worst = Math.min(worst, arenaToStage(camera, { x: 0, y }).y - foot);
      }
    }
  }
  return worst;
}

/** Doubles, not a loosened assertion: 1e-9 of a pixel. */
function near(actual, expected, what) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${what ?? "value"}: ${actual} !~ ${expected}`);
}

/* ---------------------------------------------------------------- */
/* The ink below the feet, in ONE place                              */
/* ---------------------------------------------------------------- */

test("THE PLATE'S INK BELOW THE FEET is computed in one place: the drop, the glyph's descent and half the stroke", () => {
  // Worked by hand from `tools/arena/main.js`'s plate: the baseline 22 units
  // under the feet (`view.toY(origin.y, -22)`), the font `max(10, 15 * k)` px,
  // the name stroked `max(2, 0.24 * px)` wide (team-hud.js `namePlateLayout`),
  // so half of it lies outside the glyph; the glyph's descent budgeted at
  // 0.3 em. k is px per arena unit (zoom / 100 on the stage).
  near(namePlateDepthAt(0.8), 17.6 + 0.3 * 12 + 0.24 * 12 / 2, "zoom 80: 22.64");
  near(namePlateDepthAt(1), 22 + 0.3 * 15 + 0.24 * 15 / 2, "zoom 100: 28.3");
  // Under 10px the font holds at 10: the drop scales, the rest does not.
  near(namePlateDepthAt(0.5), 11 + 3 + 1.2, "zoom 50: 15.2");
  // ► THE OLD BUDGET, 0.3 x px ALONE, WAS UNDER THE INK IT BUDGETED FOR: the
  //   underline the plate carried until D1 reached 0.34-0.41 px below the
  //   baseline, and the D1 plate's stroke alone adds 0.12 px to the glyph.
  assert.ok(namePlateDepthAt(0.8) - 17.6 > 0.3 * 12, "more than the old 0.3 em");
});

test("THE PLATE'S STROKE BUDGET IS THE STROKE THE ARENA DRAWS: `namePlateLayout`'s outline, at every font size the plate takes", () => {
  // The camera cannot import the shell's plate module (src/render imports
  // nothing from tools/), so the budget is restated in `SS2_CLOSE_UP` and pinned
  // here against the module that draws it. A plate restyled with a wider stroke
  // fails this, rather than quietly inking under the HUD.
  const { outline, outlineMinimumPx } = SS2_CLOSE_UP.namePlateFont;
  for (const px of [10, 11, 12, 13.5, 15, 18, 22.5, 30]) {
    const { outlineWidth } = namePlateLayout({ x: 0, baseline: 0, px, nameWidth: 40 });
    assert.equal(outlineWidth, Math.max(outlineMinimumPx, outline * px), `the stroke at ${px}px`);
  }
});

test("THE SHADOW is the authored ellipse's lowest point, at the widest build and the widest stance the pose allows", () => {
  // `paintShadow` draws an ellipse centred on the feet, `ry` = 0.22 of a width
  // that grows with `bulk` (0.85..1.19, saturating at strength 20) and with
  // `legSpread` (0 together .. 1 wide). Measured here off the painter itself,
  // at the widest of both, not restated.
  const widest = figureSpecFor({ id: "widest", stats: { strength: 999, agility: 999 } }, { side: "hero" });
  assert.equal(widest.build.bulk, 1.19);
  const [shadow] = paintShadow(widest, { ...poseAt(timelineFor("idle"), 0), legSpread: 1 });
  assert.equal(shadow.kind, "ellipse");
  assert.equal(shadow.y, 0, "centred on the feet");
  assert.ok(SS2_CLOSE_UP.shadowDepth >= shadow.ry, `budget ${SS2_CLOSE_UP.shadowDepth} against ${shadow.ry}`);
  assert.ok(SS2_CLOSE_UP.shadowDepth - shadow.ry < 0.05, "and no looser than the rounding");
  // The ink below the feet is whichever reaches lower, at the fighter's size.
  near(inkDepthAt(0.8, 1), Math.max(namePlateDepthAt(0.8), SS2_CLOSE_UP.shadowDepth * 0.8), "size 1 at zoom 80: the shadow");
  near(inkDepthAt(0.3, 0.5), namePlateDepthAt(0.3), "a little fat kid at zoom 30: the plate");
  near(inkDepthAt(0.8, 1.5), SS2_CLOSE_UP.shadowDepth * 1.2, "a colossus at zoom 80");
});

/* ---------------------------------------------------------------- */
/* hudTop null or absent: the camera before the HUD                  */
/* ---------------------------------------------------------------- */

test("NO hudTop IS THE CAMERA BEFORE THE HUD: every frame of every demo bout, 1v1 to 3v3, identical to 808f6da's", async () => {
  // Frame by frame, the whole returned state (camera, the two tweens, the
  // hold, who is framed), on the arena's demo rosters with the rule set's own
  // AI: three sizes, four kits (`crowd` carries little fat kid, `buffs`
  // colossus), two seeds. Absent, null and undefined are the same request.
  const base = await baseCameraModule();
  let frames = 0;
  let bouts = 0;
  for (const perSide of [1, 2, 3]) {
    for (const kit of ["", "tricks", "crowd", "buffs"]) {
      for (const seed of [1, 2]) {
        bouts += 1;
        playBout({ perSide, seed, kit }, [
          (state, roster, result) => stepFramedCamera(state, roster, { result }),
          (state, roster, result) => stepFramedCamera(state, roster, { result, hudTop: null }),
          (state, roster, result) => base.stepFramedCamera(state, roster, { result })
        ], 30, ([absent, none, before], { taken, frame }) => {
          frames += 1;
          const expected = JSON.stringify(before);
          assert.equal(JSON.stringify(absent), expected, `${perSide}v${perSide} ${kit || "plain"} seed ${seed}, turn ${taken} frame ${frame}`);
          assert.equal(JSON.stringify(none), expected, `hudTop null: ${perSide}v${perSide} ${kit || "plain"} seed ${seed}, turn ${taken} frame ${frame}`);
        });
      }
    }
  }
  assert.equal(bouts, 24);
  assert.ok(frames > 50000, `${frames} frames compared`);
});

test("THE WALL FIX MOVES EXACTLY THE LAYOUTS THAT BREACHED IT, no hudTop: a grid of team close-ups against 808f6da", async () => {
  // The demo bouts never reach the defect — their worst back rank clears arena
  // 5's wall by 9.3px — so this grid builds the layouts that can: 2 or 3 a
  // side, close in or at the default range, allies 20 or 135 apart, red's
  // outermost fighter standing back (at rank 1 or 2, `_yscale` 50, 70 or 86),
  // and one blue falling (flank or centre), so the survivors' close-up
  // engages on three or more framed.
  // A layout's camera may differ from the old one ONLY where the old camera
  // DREW a framed rank within the 5px wall margin, and every layout where it
  // did must move. ~~"at the zoom it drew, or at the close-up target it chose
  // under the framing weights it checked"~~ — the fix round after the
  // verifier (verify:camera-r1) found that looser definition let a hand-over
  // move with nobody near the wall; the wall is now checked where a frame is
  // drawn, and so is this.
  const base = await baseCameraModule();
  const tally = { layouts: 0, differing: 0, breached: 0, settledWorst: Infinity };
  const moved = [];
  for (const perSide of [2, 3]) {
    for (const [spacing, gap] of [[30, 20], [30, 135], [250, 20], [250, 135]]) {
      for (const depth of [103, 6]) {
        for (const yscale of [50, 70, 86]) {
          for (const falls of ["flank", "centre"]) {
            const xs = [spacing, spacing + gap, spacing + 2 * gap].slice(0, perSide);
            const roster = [
              ...xs.map((x, index) => ({ id: `red-${index}`, x: -x, y: index === perSide - 1 ? depth : 200,
                yscale: index === perSide - 1 ? yscale : 86, side: "hero", teamId: "red", alive: true, drawing: false })),
              ...xs.map((x, index) => ({ id: `blue-${index}`, x, y: 200, yscale: 86, side: "villain", teamId: "blue", alive: true, drawing: false }))
            ];
            const victim = falls === "flank" ? `blue-${perSide - 1}` : "blue-0";
            const fallen = roster.map((actor) => (actor.id === victim ? { ...actor, alive: false } : actor));
            let now = null;
            let before = null;
            let differs = false;
            let breached = false;
            for (const [placed, frames] of [[roster, 100], [fallen, 150]]) {
              for (let frame = 0; frame < frames; frame += 1) {
                now = stepFramedCamera(now, placed);
                before = base.stepFramedCamera(before, placed);
                if (!differs && JSON.stringify(now) !== JSON.stringify(before)) differs = true;
                if (worstWallClearance(before.camera, before.framed) < SS2_CLOSE_UP.wallMargin) breached = true;
              }
            }
            tally.layouts += 1;
            tally.settledWorst = Math.min(tally.settledWorst, worstWallClearance(now.camera, now.framed));
            const name = `${perSide}v${perSide} at ${spacing} by ${gap}, red's back one at y ${depth} and _yscale ${yscale}, the ${falls} blue down`;
            if (differs) {
              tally.differing += 1;
              moved.push(`${name}: ${before.camera.zoomscale} -> ${now.camera.zoomscale}`);
              assert.ok(breached, `${name} moved, and the old camera never drew anybody within 5px of the wall`);
            }
            if (breached) tally.breached += 1;
          }
        }
      }
    }
  }
  assert.equal(tally.layouts, 96);
  assert.equal(tally.differing, tally.breached, `every breaching layout moved: ${JSON.stringify(tally)}`);
  assert.ok(tally.settledWorst >= SS2_CLOSE_UP.wallMargin, `a settled frame at ${tally.settledWorst.toFixed(2)}px`);
  // WHICH MOVE, worked by hand and then run: only a back rank at y 6 (rank 1
  // clears arena 5's wall by 5px to zoom 119), only a fighter whose crown does
  // not bind first (at `_yscale` 86 the back rank's crown leaves the stage above
  // 78: 292.48 >= (0.57 + 3.156) z), only close enough in for the swing's fit
  // to pass 82 — and every one to the wall's own 82.
  assert.deepEqual(moved, [
    "2v2 at 30 by 20, red's back one at y 6 and _yscale 50, the flank blue down: 100 -> 82",
    "2v2 at 30 by 20, red's back one at y 6 and _yscale 50, the centre blue down: 100 -> 82",
    "2v2 at 30 by 20, red's back one at y 6 and _yscale 70, the flank blue down: 93 -> 82",
    "2v2 at 30 by 20, red's back one at y 6 and _yscale 70, the centre blue down: 93 -> 82",
    "2v2 at 30 by 135, red's back one at y 6 and _yscale 50, the flank blue down: 87 -> 82",
    "2v2 at 30 by 135, red's back one at y 6 and _yscale 70, the flank blue down: 87 -> 82",
    "3v3 at 30 by 20, red's back one at y 6 and _yscale 50, the flank blue down: 97 -> 82",
    "3v3 at 30 by 20, red's back one at y 6 and _yscale 50, the centre blue down: 94 -> 82",
    "3v3 at 30 by 20, red's back one at y 6 and _yscale 70, the flank blue down: 93 -> 82",
    "3v3 at 30 by 20, red's back one at y 6 and _yscale 70, the centre blue down: 93 -> 82"
  ]);
});

/* ---------------------------------------------------------------- */
/* hudTop a number: every framed fighter above the HUD               */
/* ---------------------------------------------------------------- */

/** The widest authored build: the shadow a fighter of this size can cast at most, measured off the painter. */
const WIDEST = figureSpecFor({ id: "widest", stats: { strength: 999, agility: 999 } }, { side: "hero" });
const WIDEST_SHADOW = paintShadow(WIDEST, { ...poseAt(timelineFor("idle"), 0), legSpread: 1 })[0].ry;

/**
 * The lowest ink each framed fighter puts on the stage at this camera, the
 * way the shell draws it (640x420 canvas, fit scale 1): his feet at
 * `view.toY(y, 0)`, his plate's baseline at `view.toY(y, -22)` in a
 * `max(10, view.scale * 15)` px font — its glyph descending at most 0.3 em
 * and its stroke `max(2, 0.24 px)` wide, half outside — and his shadow, the
 * painter's widest ellipse at his size. At his FRONT-most depth (`yMax`).
 */
function lowestInk(camera, framed) {
  const view = stageProjectorFor(camera, stageFitFor({ width: 640, height: 420 }));
  let lowest = -Infinity;
  let who = null;
  for (const actor of framed) {
    const y = Math.max(...[actor.y, actor.yMax].filter(Number.isFinite));
    const size = Math.abs(actor.yscale ?? 100) / 100;
    const px = Math.max(10, view.scale * 15);
    const plate = view.toY(y, -22) + 0.3 * px + Math.max(2, 0.24 * px) / 2;
    const shadow = view.toY(y, 0) + WIDEST_SHADOW * size * view.scale;
    const ink = Math.max(plate, shadow);
    if (ink > lowest) { lowest = ink; who = `${actor.id} (y ${y}, _yscale ${actor.yscale})`; }
  }
  return { lowest, who };
}

test("A TEAM CAMERA CARRYING hudTop stands its front line where the ink stops at the HUD, and never lower than it stood", () => {
  // Worked by hand at zoom 80: the team framing's line is 293.48 + 0.4 x 80 =
  // 325.48. A `_yscale` 86 fighter's ink reaches max(22.64, 33.8 x 0.86 x 0.8 =
  // 23.2544) below his feet, so under a HUD at 326 the line is 302.7456 — and
  // under one at 352 (328.7456) the framing is left exactly where it was.
  const team = { zoomscale: 80, gladiatorsX: 0, team: true, teamWeight: 1 };
  near(groundLineAt(team), 325.48, "no HUD");
  near(groundLineAt({ ...team, hudTop: 326, inkSize: 0.86 }), 326 - 23.2544, "a HUD at 326");
  assert.equal(groundLineAt({ ...team, hudTop: 352, inkSize: 0.86 }), groundLineAt(team), "a HUD at 352 moves nothing at 80");
  // Every depth moves with the line; the ranks keep their spacing.
  const lifted = { ...team, hudTop: 326, inkSize: 0.86 };
  near(arenaToStage(lifted, { y: 6 }).y - groundLineAt(lifted), -97 * 0.8, "the back rank, 0.97 x 80 up");
  // A PAIR's line is the build's and a HUD does not move it: the close-up caps a pair's ZOOM instead.
  const pair = { zoomscale: 80, gladiatorsX: 0, team: false, teamWeight: 0 };
  assert.equal(groundLineAt({ ...pair, hudTop: 326, inkSize: 0.86 }), groundLineAt(pair));
});

test("THE BAND GUARANTEE on a settled team camera: 2v2 and 3v3, every size, rank and fall, under a HUD at 352 and 326", () => {
  // Formations the demo rosters stand in and tighter ones, `_yscale` 50..150,
  // a back-ranker at every rank, before and after a fall (the close-up), with
  // and without a result. At the settled frame: every framed fighter's lowest
  // ink at or above the HUD's top, and his feet 5px below every arena's wall.
  let checked = 0;
  for (const hudTop of [352, 326]) {
    for (const perSide of [2, 3]) {
      for (const [spacing, gap] of [[30, 20], [65, 135], [250, 130]]) {
        for (const depth of [200, 103, 6]) {
          for (const yscale of [50, 86, 113, 150]) {
            const xs = [spacing, spacing + gap, spacing + 2 * gap].slice(0, perSide);
            const roster = [
              ...xs.map((x, index) => ({ id: `red-${index}`, x: -x, y: index === perSide - 1 ? depth : 200, yscale,
                side: "hero", teamId: "red", alive: true, drawing: false })),
              ...xs.map((x, index) => ({ id: `blue-${index}`, x, y: 200, yscale: 86, side: "villain", teamId: "blue",
                alive: true, drawing: false }))
            ];
            const fallen = roster.map((actor) => (actor.id === "blue-0" ? { ...actor, alive: false } : actor));
            const won = roster.map((actor) => (actor.side === "villain" ? { ...actor, alive: false } : actor));
            // The last one standing is red's back one: framed ALONE, on the pair's line.
            const alone = won.map((actor) => (actor.id === `red-${perSide - 1}` ? actor : { ...actor, alive: false }));
            const phases = [[roster, null, "all up"], [fallen, null, "one down"], [won, { winnerTeamId: "red" }, "won"],
              [alone, { winnerTeamId: "red" }, "won alone"]];
            let state = null;
            for (const [placed, result, when] of phases) {
              for (let frame = 0; frame < 150; frame += 1) state = stepFramedCamera(state, placed, { result, hudTop });
              const name = `${perSide}v${perSide} at ${spacing} by ${gap}, back one at y ${depth}, _yscale ${yscale}, ${when}, HUD ${hudTop}`;
              assert.equal(state.camera.zoomscale, state.camera.maxscale, `${name}: settled`);
              const { lowest, who } = lowestInk(state.camera, state.framed);
              assert.ok(lowest <= hudTop + 1e-9, `${name}: ${who} inks down to ${lowest.toFixed(2)}, under the HUD`);
              const clearance = worstWallClearance(state.camera, state.framed);
              assert.ok(clearance >= SS2_CLOSE_UP.wallMargin, `${name}: a framed fighter ${clearance.toFixed(2)}px from the wall`);
              checked += 1;
            }
          }
        }
      }
    }
  }
  assert.equal(checked, 2 * 2 * 3 * 3 * 4 * 4);
});

test("THE BAND GUARANTEE OVER THE ARENA'S OWN BOUTS: 2v2 under the HUD at 326, 3v3 at 352 (and each at the other), four kits, the `crowd` kit's little fat kid and the `buffs` kit's colossus included", () => {
  // The rule set's own AI plays each bout; the camera runs on, continuously,
  // 40 frames a turn, and is read at each turn's last frame. Every framed
  // fighter's lowest ink at or above the HUD's top, and every framed depth 5px
  // under the foot of all six arenas' walls.
  const tally = { bouts: 0, turns: 0, closeUps: 0, small: 0, large: 0, backRank: 0, lifted: 0 };
  for (const perSide of [2, 3]) {
    for (const hudTop of [326, 352]) {
      for (const kit of ["", "tricks", "crowd", "buffs"]) {
        for (const seed of [1]) {
          tally.bouts += 1;
          playBout({ perSide, seed, kit }, [
            (state, roster, result) => stepFramedCamera(state, roster, { result, hudTop })
          ], 40, ([state], { taken, frame }) => {
            if (frame !== 39) return;
            tally.turns += 1;
            const name = `${perSide}v${perSide} ${kit || "plain"} seed ${seed} turn ${taken}, HUD ${hudTop}`;
            assert.equal(state.camera.hudTop, hudTop, `${name}: the HUD has settled`);
            const { lowest, who } = lowestInk(state.camera, state.framed);
            assert.ok(lowest <= hudTop + 1e-9, `${name} at zoom ${state.camera.zoomscale}: ${who} inks down to ${lowest.toFixed(2)}`);
            const clearance = worstWallClearance(state.camera, state.framed);
            assert.ok(clearance >= SS2_CLOSE_UP.wallMargin, `${name}: a framed fighter ${clearance.toFixed(2)}px from the wall`);
            if (state.closeUp) tally.closeUps += 1;
            if (state.framed.some((actor) => actor.yscale === 50)) tally.small += 1;
            if (state.framed.some((actor) => actor.yscale >= 150)) tally.large += 1;
            if (state.framed.some((actor) => actor.y === 6)) tally.backRank += 1;
            if (groundLineAt(state.camera) < groundLineAt({ ...state.camera, hudTop: undefined })) tally.lifted += 1;
          });
        }
      }
    }
  }
  // The sweep reached what it claims to cover.
  assert.equal(tally.bouts, 16);
  for (const key of ["closeUps", "small", "large", "backRank", "lifted"]) assert.ok(tally[key] > 0, `${key}: ${JSON.stringify(tally)}`);
});

test("RULE 1's FLOOR UNDER A HUD is the old camera's target CAPPED BY THE SAME FIT: a body in the back rank does not hold the survivors' close-up off", () => {
  // A close 3v3 under the 2v2-sized HUD (326). Red's back-ranker (y 6) falls.
  // His BODY stays placed, so the old camera — bodies included — keeps him in
  // its fit: under the HUD its target is capped at 71 (worked: the back rank
  // 0.97 z above a line lifted to 326 - 0.3378 x 0.86 z clears arena 5's wall
  // to z 71.8). The survivors all stand in the front rank, and their close-up
  // fits 75. Measured against an UNCAPPED floor — the band's 80 — the frame
  // would be held at the old camera's 71; against the capped one, the
  // close-up drives, tighter, and still above the HUD.
  const at = (id, x, side, y = 200) => ({ id, x, y, yscale: 86, side, teamId: side === "hero" ? "red" : "blue", alive: true, drawing: false });
  const roster = [at("red-1", -60, "hero"), at("red-2", -150, "hero"), at("red-3", -100, "hero", 6),
    at("blue-1", 60, "villain"), at("blue-2", 150, "villain"), at("blue-3", 100, "villain")];
  const fallen = roster.map((actor) => (actor.id === "red-3" ? { ...actor, alive: false } : actor));
  let state = null;
  for (let frame = 0; frame < 150; frame += 1) state = stepFramedCamera(state, roster, { hudTop: 326 });
  for (let frame = 0; frame < 200; frame += 1) state = stepFramedCamera(state, fallen, { hudTop: 326 });
  assert.equal(state.old.maxscale, 71, "the old camera's target, capped by the body at the back rank");
  assert.equal(state.closeUp, true, "the floor is 71, so the close-up's 75 is not held");
  assert.equal(state.camera.zoomscale, 75);
  const { lowest } = lowestInk(state.camera, state.framed);
  assert.ok(lowest <= 326 + 1e-9, `and above the HUD: ${lowest}`);
  // Without a HUD the same fall is held by the band's 80, as before.
  let plain = null;
  for (let frame = 0; frame < 150; frame += 1) plain = stepFramedCamera(plain, roster);
  for (let frame = 0; frame < 200; frame += 1) plain = stepFramedCamera(plain, fallen);
  assert.equal(plain.heldByFloor, true);
  assert.equal(plain.camera.zoomscale, 80);
});

test("A HOLD'S BLEND UNDER A HUD carries the HUD: the line glides from the close-up to the held camera, and the ink never passes the HUD", () => {
  // A close 3v3 (30, 95, 160 a side) under 326; blue-3 falls and the close-up
  // frames the five at 80, the line lifted to 326 - 23.2544 = 302.7456. Then
  // red-3 walks out to -500: what fits at the close-up's pan falls under the
  // floor and the frame is handed to the old camera, blended by the zoom's
  // fifth. Both ends stand to the HUD, so every blended frame must too; a
  // blend that dropped the HUD moved the line 22.33px in its first frame.
  const at = (id, x, side) => ({ id, x, y: 200, yscale: 86, side, teamId: side === "hero" ? "red" : "blue", alive: true, drawing: false });
  const roster = [at("red-1", -30, "hero"), at("red-2", -95, "hero"), at("red-3", -160, "hero"),
    at("blue-1", 30, "villain"), at("blue-2", 95, "villain"), at("blue-3", 160, "villain")];
  const fallen = roster.map((actor) => (actor.id === "blue-3" ? { ...actor, alive: false } : actor));
  const walked = fallen.map((actor) => (actor.id === "red-3" ? { ...actor, x: -500, xMin: -500, xMax: -160 } : actor));
  let state = null;
  for (let frame = 0; frame < 120; frame += 1) state = stepFramedCamera(state, roster, { hudTop: 326 });
  for (let frame = 0; frame < 200; frame += 1) state = stepFramedCamera(state, fallen, { hudTop: 326 });
  assert.equal(state.closeUp, true);
  assert.equal(state.camera.zoomscale, 80);
  near(groundLineAt(state.camera), 302.7456, "the close-up's lifted line");
  let previous = groundLineAt(state.camera);
  let blended = 0;
  for (let frame = 0; frame < 200; frame += 1) {
    state = stepFramedCamera(state, walked, { hudTop: 326 });
    if (state.hold > 0 && state.hold < 1) blended += 1;
    const line = groundLineAt(state.camera);
    assert.ok(Math.abs(line - previous) < 2, `frame ${frame} (hold ${state.hold.toFixed(3)}): the line moved ${(line - previous).toFixed(2)}px`);
    previous = line;
    const { lowest, who } = lowestInk(state.camera, state.framed);
    assert.ok(lowest <= 326 + 1e-9, `frame ${frame} (hold ${state.hold.toFixed(3)}): ${who} inks to ${lowest.toFixed(2)}`);
  }
  assert.ok(blended > 0, "the hold did blend");
  assert.equal(state.heldByFloor, true);
  assert.equal(state.camera.zoomscale, 73);
});

/* ---------------------------------------------------------------- */
/* No jumps: the HUD eases in, out and between                       */
/* ---------------------------------------------------------------- */

/** A 2v2 close in, red's second a rank back: a team camera that settles at the build's 80. */
function closeTwoVsTwo(overrides = {}) {
  const at = (id, x, side, y = 200) => ({ id, x, y, yscale: 86, side, teamId: side === "hero" ? "red" : "blue", alive: true, drawing: false });
  return [at("red-1", -65, "hero"), at("red-2", -200, "hero", 103), at("blue-1", 65, "villain"), at("blue-2", 200, "villain")]
    .map((actor) => ({ ...actor, ...(overrides[actor.id] ?? {}) }));
}

/** Runs `phases` of [roster, frames, hudTop] and returns every frame's state. */
function frames(phases) {
  const out = [];
  let state = null;
  for (const [roster, count, hudTop] of phases) {
    for (let frame = 0; frame < count; frame += 1) {
      state = stepFramedCamera(state, roster, { hudTop });
      out.push(state);
    }
  }
  return out;
}

test("NO ONE-FRAME JUMPS: a HUD appearing mid-bout, changing, withdrawn, and a fighter growing under one, all glide by the zoom's fifth", () => {
  const settledAt80 = (state) => state.camera.zoomscale === 80 && state.camera.maxscale === 80;
  const cases = [
    // [what, before, after]: 120 frames of each. Worked at zoom 80, where the
    // framing's line is 325.48 and a `_yscale` 86 fighter inks 23.2544 below
    // his feet (the shadow): under 326 the line is 302.7456; under 352 it is
    // left alone (328.75 > 325.48). A colossus (`_yscale` 150) inks 40.56.
    ["a HUD appearing at 326", [closeTwoVsTwo(), null], [closeTwoVsTwo(), 326], 325.48, 326 - 23.2544],
    ["the HUD changing 352 -> 326", [closeTwoVsTwo(), 352], [closeTwoVsTwo(), 326], 325.48, 326 - 23.2544],
    ["the HUD withdrawn", [closeTwoVsTwo(), 326], [closeTwoVsTwo(), null], 326 - 23.2544, 325.48],
    ["red-1 growing to a colossus under 352", [closeTwoVsTwo(), 352], [closeTwoVsTwo({ "red-1": { yscale: 150 } }), 352], 325.48, 352 - 40.56]
  ];
  for (const [what, [before, beforeHud], [after, afterHud], from, to] of cases) {
    const run = frames([[before, 120, beforeHud], [after, 120, afterHud]]);
    const lines = run.map((state) => groundLineAt(state.camera));
    assert.ok(settledAt80(run[119]), `${what}: settled at 80 before`);
    near(lines[119], from, `${what}: the line before`);
    // The frame it happens, the line has not moved: the ease starts where it stands.
    assert.ok(Math.abs(lines[120] - from) <= Math.abs(to - from) / SS2_TEAM_HUD.ease + 1e-9,
      `${what}: the first frame moved the line ${(lines[120] - from).toFixed(3)}px`);
    // No frame covers more than a fifth of the whole move, and the zoom never moves.
    for (let frame = 120; frame < 240; frame += 1) {
      assert.ok(Math.abs(lines[frame] - lines[frame - 1]) <= Math.abs(to - from) / SS2_TEAM_HUD.ease + 1e-9,
        `${what}, frame ${frame}: the line moved ${(lines[frame] - lines[frame - 1]).toFixed(3)}px`);
      assert.equal(run[frame].camera.zoomscale, 80, `${what}, frame ${frame}`);
    }
    // And it gets there.
    near(lines[239], to, `${what}: the line after`);
    assert.ok(Math.abs(lines[160] - to) < 0.2, `${what}: 40 frames on, within 0.2px`);
  }
  // A HUD withdrawn leaves a camera with no HUD on it at all, once it binds nothing.
  const withdrawn = frames([[closeTwoVsTwo(), 120, 326], [closeTwoVsTwo(), 120, null]]).at(-1);
  assert.equal("hudTop" in withdrawn.camera, false);
  assert.equal("inkSize" in withdrawn.camera, false);
});

test("THE FRAME A BOUT STARTS opens ON the HUD, at the build's zoom of 5, with the rush-in aimed at the capped target", () => {
  // With red-2 at the BACK rank (y 6) under the 2v2's HUD at 326, the line
  // must lift ~23px at 80 and the back rank would stand in arena 5's wall: the
  // target is capped. Worked: the lifted line is 326 - 0.3378 x 0.86 z (the
  // shadow binds above ~57), the back rank 0.97 z above it, and arena 5's wall
  // foot at 158.58 + z: 5px of floor holds to z 71.8, so 71.
  const roster = closeTwoVsTwo({ "red-2": { y: 6 } });
  const [opening] = frames([[roster, 1, 326]]);
  assert.equal(opening.camera.zoomscale, SS2_CAMERA.zoomStart, "the build's establishing shot");
  assert.equal(opening.camera.hudTop, 326, "already standing to the HUD — nothing to ease in");
  assert.equal(opening.camera.inkSize, 0.86);
  assert.equal(opening.camera.maxscale, 71, "the target the rush-in is aimed at");
  // At zoom 5 the HUD binds nothing: the opening frame is the framing's own.
  near(groundLineAt(opening.camera), groundLineAt({ ...opening.camera, hudTop: undefined }), "the line at zoom 5");
  // The rush-in never overshoots the capped target, and settles on it.
  const run = frames([[roster, 120, 326]]);
  for (const state of run) assert.ok(state.camera.zoomscale <= 71, `zoom ${state.camera.zoomscale}`);
  assert.equal(run.at(-1).camera.zoomscale, 71);
  // Without the HUD the same roster settles at the build's 80.
  assert.equal(frames([[roster, 120, null]]).at(-1).camera.zoomscale, 80);
});

/* ---------------------------------------------------------------- */
/* The FITTED view: a reserved band at the canvas's foot              */
/* ---------------------------------------------------------------- */

/** Canvases, rosters and reserves for the fitted view: wide, tall, tiny; flat and three ranks deep. */
const FITTED_CASES = (() => {
  const out = [];
  const rosters = [
    [{ x: -250, y: 200 }, { x: 250, y: 200 }],
    [{ x: -510, y: 200 }, { x: -380, y: 103 }, { x: 250, y: 6 }, { x: 510, y: 200 }],
    [{ x: -30, y: 6 }, { x: 30, y: 200 }],
    []
  ];
  for (const [width, height] of [[640, 420], [1280, 840], [870, 688], [4000, 600], [400, 1600], [320, 200]]) {
    for (const actors of rosters) out.push({ width, height, frontY: 200, actors: actors.map((actor) => ({ ...actor, placed: true })) });
  }
  return out;
})();

test("THE FITTED VIEW WITH NO RESERVE IS 808f6da's, and names the ground line the shell draws from", async () => {
  const base = await baseShellModule();
  for (const view of FITTED_CASES) {
    const before = base.viewportFor(view);
    for (const reserveBottom of [undefined, null, 0, -40, Number.NaN]) {
      const now = viewportFor({ ...view, reserveBottom });
      const what = `${view.width}x${view.height}, ${view.actors.length} placed, reserve ${reserveBottom}`;
      for (const key of ["scale", "horizon", "extent", "depthUnits"]) assert.equal(now[key], before[key], `${what}: ${key}`);
      // The shell's own expression for the front rank's feet, `horizon + (height - horizon) * 0.62`.
      assert.equal(now.floor, view.height, what);
      assert.equal(now.ground, before.horizon + (view.height - before.horizon) * 0.62, what);
    }
  }
});

test("THE FITTED VIEW'S RESERVE: a band at the canvas's foot the fighters' ink stays above, the whole figure still on the canvas", () => {
  // Every fitted fighter — up to a colossus (`_yscale` 150) — stands with his
  // plate and shadow (`inkDepthAt`, at the fitted view's px per unit) at or
  // above the reserved band's top, and his crown on the canvas.
  let checked = 0;
  for (const view of FITTED_CASES) {
    const plain = viewportFor(view);
    for (const fraction of [0.1, 0.2, 0.3, 0.4]) {
      const reserveBottom = Math.round(view.height * fraction);
      const reserved = viewportFor({ ...view, reserveBottom });
      const what = `${view.width}x${view.height}, ${view.actors.length} placed, reserve ${reserveBottom}`;
      assert.equal(reserved.floor, view.height - reserveBottom, what);
      near(reserved.ground, reserved.horizon + (reserved.floor - reserved.horizon) * 0.62, `${what}: the ground`);
      assert.ok(reserved.ground + inkDepthAt(reserved.scale, 1.5) <= reserved.floor + 1e-9,
        `${what}: ink to ${(reserved.ground + inkDepthAt(reserved.scale, 1.5)).toFixed(2)} past the band at ${reserved.floor}`);
      assert.ok(reserved.ground - SS2_FIGURE_HEIGHT * reserved.scale > 0, `${what}: a front-rank crown off the top`);
      assert.ok(reserved.scale <= plain.scale, `${what}: a reserve never draws bigger`);
      assert.ok(reserved.ground < plain.ground || reserveBottom === 0, `${what}: and it lifts the ground`);
      checked += 1;
    }
  }
  assert.equal(checked, FITTED_CASES.length * 4);
  // A reserve as tall as the canvas cannot give a negative floor or a NaN view.
  const swallowed = viewportFor({ width: 640, height: 420, frontY: 200, actors: [], reserveBottom: 9999 });
  assert.ok(swallowed.floor >= 1 && Number.isFinite(swallowed.scale) && swallowed.scale > 0, JSON.stringify(swallowed));
});

test("CODEX PASS 1: a HUD appearing during a SETTLED CLOSE-UP eases the close-up down with it — no cut", () => {
  // Codex's review, pass 1 (2026-09-24). One fighter left standing at x 0,
  // three bodies at rest far out (2000, -2000, 1500). The close-up frames him
  // alone, on the pair's line, at 100 (feet 366.75). A HUD at 326 then
  // appears: on the pair's line only the zoom keeps his ink above it, to 69
  // (166.75 + 2z + 29.07z/100 <= 326). The draw-time fit took the REQUESTED
  // top at once, and the frame cut from 100 to 69 — the line 62px — in one
  // frame. The HUD must bind the close-up as it binds the line: eased.
  const at = (id, x, side, alive) => ({ id, x, y: 200, yscale: 86, side, teamId: side === "hero" ? "red" : "blue", alive, drawing: false });
  const roster = [at("red-1", 0, "hero", true), at("red-2", -2000, "hero", false),
    at("blue-1", 2000, "villain", false), at("blue-2", 1500, "villain", false)];
  const run = frames([[roster, 300, null], [roster, 200, 326]]);
  const settled = run[299];
  assert.equal(settled.closeUp, true);
  assert.equal(settled.camera.zoomscale, 100);
  near(groundLineAt(settled.camera), 366.75, "the pair's line at 100");
  // The HUD appears where it binds nothing — his ink's own foot, 366.75 +
  // 33.8 x 0.86 = 395.818 — and eases to 326 by a fifth a frame, so the fit
  // relaxes by at most 13.96px of line a frame, plus the one whole zoom (2px
  // of the pair's line) the fit's integer zoom can round it by. The first
  // frame does not move at all, and the move takes many frames, not one.
  const bound = (395.818 - 326) / 5 + 2;
  let previous = groundLineAt(settled.camera);
  let moving = 0;
  for (let frame = 300; frame < 500; frame += 1) {
    const line = groundLineAt(run[frame].camera);
    assert.ok(Math.abs(line - previous) <= bound + 1e-9, `frame ${frame}: zoom ${run[frame - 1].camera.zoomscale} -> ` +
      `${run[frame].camera.zoomscale}, the line moved ${(line - previous).toFixed(2)}px`);
    if (frame === 300) assert.equal(line, previous, "the frame the HUD appears");
    if (line !== previous) moving += 1;
    previous = line;
  }
  assert.ok(moving >= 10, `the move took ${moving} frames`);
  const last = run.at(-1);
  assert.equal(last.camera.hudTop, 326, "settled on the HUD");
  assert.equal(last.camera.zoomscale, 69);
  const { lowest } = lowestInk(last.camera, last.framed);
  assert.ok(lowest <= 326 + 1e-9, `and above it: ${lowest}`);
});

test("CODEX PASS 1, the other two ways: the HUD CHANGING and WITHDRAWN during a settled close-up glide too, and a withdrawal never tightens it first", () => {
  const at = (id, x, side, alive) => ({ id, x, y: 200, yscale: 86, side, teamId: side === "hero" ? "red" : "blue", alive, drawing: false });
  const roster = [at("red-1", 0, "hero", true), at("red-2", -2000, "hero", false),
    at("blue-1", 2000, "villain", false), at("blue-2", 1500, "villain", false)];
  // 352 -> 326. Under 352 his ink allows 80 (166.75 + 2.29068 z <= 352, z
  // 80.87); under 326, 69. The top eases 26px by fifths: at most 5.2px of line
  // a frame, plus a whole zoom's 2px.
  const changing = frames([[roster, 300, 352], [roster, 200, 326]]);
  assert.equal(changing[299].camera.zoomscale, 80);
  let previous = groundLineAt(changing[299].camera);
  for (let frame = 300; frame < 500; frame += 1) {
    const line = groundLineAt(changing[frame].camera);
    assert.ok(Math.abs(line - previous) <= 26 / 5 + 2 + 1e-9, `352 -> 326, frame ${frame}: the line moved ${(line - previous).toFixed(2)}px`);
    previous = line;
  }
  assert.equal(changing.at(-1).camera.zoomscale, 69);
  // 326 -> withdrawn. On the pair's line a HUD binds only the zoom, and at 69
  // the ink is already above 326, so nothing is left to ease out: the HUD is
  // dropped at once and the zoom rises to the close-up's 100 by the build's own
  // ease (a fifth of the gap: 69 -> 75, 12px). It must never TIGHTEN first.
  const withdrawn = frames([[roster, 300, 326], [roster, 200, null]]);
  assert.equal(withdrawn[299].camera.zoomscale, 69);
  previous = groundLineAt(withdrawn[299].camera);
  for (let frame = 300; frame < 500; frame += 1) {
    const state = withdrawn[frame];
    assert.ok(state.camera.zoomscale >= withdrawn[frame - 1].camera.zoomscale, `frame ${frame}: the zoom fell while the HUD left`);
    if (Number.isFinite(state.camera.hudTop)) assert.ok(state.camera.hudTop >= 326, `frame ${frame}: the HUD tightened to ${state.camera.hudTop}`);
    const line = groundLineAt(state.camera);
    assert.ok(Math.abs(line - previous) <= 2 * Math.round((100 - 69) / 5) + 1e-9, `withdrawn, frame ${frame}: the line moved ${(line - previous).toFixed(2)}px`);
    previous = line;
  }
  assert.equal("hudTop" in withdrawn.at(-1).camera, false);
  assert.equal(withdrawn.at(-1).camera.zoomscale, 100);
});

/* ---------------------------------------------------------------- */
/* Blends: the frames BETWEEN two cameras keep the floor and the HUD  */
/* (fix round after the adversarial verifier verify:camera-r1)        */
/* ---------------------------------------------------------------- */

/** A roster entry as the shell hands a fighter over at rest: his span is where he stands. */
function atRest(actor, alive = true) {
  return { ...actor, xMin: actor.x, xMax: actor.x, yMin: actor.y, yMax: actor.y,
    side: actor.teamId === "red" ? "hero" : "villain", alive, drawing: false };
}

/** Plays `phases` — [frames, roster, result] — through ONE camera and hands every frame to `visit`. */
function playPhases(phases, hudTop, visit) {
  let state = null;
  phases.forEach(([count, roster, result], phase) => {
    for (let frame = 0; frame < count; frame += 1) {
      state = stepFramedCamera(state, roster, hudTop === null ? { result } : { result, hudTop });
      visit(state, { phase, frame });
    }
  });
  return state;
}

/** A blend frame with both halves of the bilinear in play: the hold AND the framing weight strictly between 0 and 1. */
function isMixedBlend(state) {
  const weight = state.camera.teamWeight;
  return state.hold > 0 && state.hold < 1 && weight > 0 && weight < 1;
}

/**
 * The verifier's two layouts, and a fall that leaves blue-1 — `_yscale` 50,
 * at the BACK rank (y 6) — the lone winner: 60 frames all up, 30 with the
 * three falls still drawn, 60 at rest with the result, then (case B) 40
 * frames of blue-1 walking to `walkTo`.
 */
function verifierCase(roster, walkTo = null) {
  const kills = new Set(["blue-0", "red-0", "red-1"]);
  const down = (drawing) => roster.map((actor) => (kills.has(actor.id)
    ? { ...atRest(actor, false), drawing } : atRest(actor)));
  const result = { winnerTeamId: "blue" };
  const phases = [[60, roster.map((actor) => atRest(actor)), null], [30, down(true), null], [60, down(false), result]];
  if (walkTo !== null) {
    phases.push([40, down(false).map((actor) => (actor.id !== "blue-1" ? actor : {
      ...actor, x: walkTo, xMin: Math.min(actor.x, walkTo), xMax: Math.max(actor.x, walkTo), drawing: true
    })), result]);
  }
  return phases;
}

test("A HOLD'S BLEND KEEPS THE FLOOR, no HUD: a lone little-fat-kid winner at the back rank is never framed within 5px of the wall between the two cameras", () => {
  // The verifier's case A (verify:camera-r1, 2026-09-24). All four at the back
  // rank; blue-1 (`_yscale` 50) wins alone. The close-up frames him alone on
  // the PAIR's line, the old camera holds the TEAM framing, and the hold
  // releases through a blend. A blend lerps the zoom and the framing weight
  // separately, so a foot's stage y is BILINEAR in the blend's weight:
  // checking the two ends does not bound the frames between. 808f6da and the
  // first HUD camera both stood him 1.591px from arena 5's wall foot there
  // (phase 2, frame 8: zoom 94.019, framing weight 0.361, hold 0.262).
  const roster = [
    { id: "red-0", x: -479.3768, y: 6, yscale: 100, teamId: "red" },
    { id: "red-1", x: -177.0297, y: 6, yscale: 86, teamId: "red" },
    { id: "blue-0", x: 94.3915, y: 6, yscale: 86, teamId: "blue" },
    { id: "blue-1", x: 108.6834, y: 6, yscale: 50, teamId: "blue" }
  ];
  let mixed = 0;
  playPhases(verifierCase(roster), null, (state, { phase, frame }) => {
    const clearance = worstWallClearance(state.camera, state.framed);
    assert.ok(clearance >= SS2_CLOSE_UP.wallMargin, `phase ${phase} frame ${frame} (zoom ${state.camera.zoomscale.toFixed(3)}, ` +
      `weight ${(+state.camera.teamWeight).toFixed(3)}, hold ${state.hold.toFixed(3)}): ${clearance.toFixed(3)}px from the wall`);
    if (isMixedBlend(state)) mixed += 1;
  });
  assert.ok(mixed > 0, "the release was drawn through blends with both weights between 0 and 1");
});

test("A HOLD'S BLEND KEEPS THE FLOOR AND THE HUD under 326: the lone winner walking in while a colossus's body lifts the old camera's line", () => {
  // The verifier's case B. Under the 2v2's HUD (326) blue-1 (`_yscale` 50, y 6)
  // wins alone and walks from 460.49 to 193.32; red-1's body is a colossus
  // (`_yscale` 150). The old camera frames the bodies too, so its line is
  // lifted for the colossus's shadow (`inkSize` 1.5), and the blend lerped
  // that toward the close-up's 0.5: at phase 3 frame 6 (zoom 75.653, hold
  // 0.59, `inkSize` 1.09) blue-1's feet stood 1.675px INSIDE arena 5's wall.
  // Every frame: every framed rank 5px under the wall, every framed fighter's
  // ink at or above the HUD the camera stands to.
  const roster = [
    { id: "red-0", x: -274.6592, y: 200, yscale: 113, teamId: "red" },
    { id: "red-1", x: -258.0114, y: 200, yscale: 150, teamId: "red" },
    { id: "blue-0", x: 140.6156, y: 6, yscale: 70, teamId: "blue" },
    { id: "blue-1", x: 460.4937, y: 6, yscale: 50, teamId: "blue" }
  ];
  let mixed = 0;
  playPhases(verifierCase(roster, 193.318), 326, (state, { phase, frame }) => {
    const what = `phase ${phase} frame ${frame} (zoom ${state.camera.zoomscale.toFixed(3)}, weight ` +
      `${(+state.camera.teamWeight).toFixed(3)}, hold ${state.hold.toFixed(3)}, inkSize ${state.camera.inkSize})`;
    const clearance = worstWallClearance(state.camera, state.framed);
    assert.ok(clearance >= SS2_CLOSE_UP.wallMargin, `${what}: ${clearance.toFixed(3)}px from the wall`);
    const { lowest, who } = lowestInk(state.camera, state.framed);
    assert.ok(lowest <= state.camera.hudTop + 1e-9, `${what}: ${who} inks to ${lowest.toFixed(3)}, under the HUD at ${state.camera.hudTop}`);
    if (isMixedBlend(state)) mixed += 1;
  });
  assert.ok(mixed > 0, "the hold was drawn through blends with both weights between 0 and 1");
});

/**
 * A random team layout and its bout, from `random` (`seeded`): 2 or 3 a side,
 * anywhere from 30 to 480 out, every rank, `_yscale` 50..150; one to all but
 * one falling; a result when one side is left; then one survivor walking up
 * to 300 either way, a third of the time into another rank.
 */
function randomBout(random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const perSide = pick([2, 3]);
  const roster = [];
  for (const teamId of ["red", "blue"]) {
    for (let index = 0; index < perSide; index += 1) {
      const x = (teamId === "red" ? -1 : 1) * (30 + random() * 450);
      roster.push({ id: `${teamId}-${index}`, x, y: pick([200, 103, 6]), yscale: pick([50, 50, 70, 86, 86, 100, 113, 150]), teamId });
    }
  }
  const order = [...roster].sort(() => random() - 0.5);
  const kills = new Set(order.slice(0, 1 + Math.floor(random() * (roster.length - 1))).map((actor) => actor.id));
  const standing = roster.filter((actor) => !kills.has(actor.id));
  const sides = new Set(standing.map((actor) => actor.teamId));
  const result = sides.size === 1 ? { winnerTeamId: [...sides][0] } : null;
  const walker = pick(standing);
  const to = walker.x + (random() - 0.5) * 600;
  const lane = pick([null, null, 200, 103, 6]) ?? walker.y;
  const down = (drawing) => roster.map((actor) => (kills.has(actor.id) ? { ...atRest(actor, false), drawing } : atRest(actor)));
  const walking = down(false).map((actor) => (actor.id !== walker.id ? actor : {
    ...actor, x: to, y: lane, xMin: Math.min(walker.x, to), xMax: Math.max(walker.x, to),
    yMin: Math.min(walker.y, lane), yMax: Math.max(walker.y, lane), drawing: true
  }));
  const arrived = down(false).map((actor) => (actor.id !== walker.id ? actor : atRest({ ...walker, x: to, y: lane })));
  return { perSide, walker: { id: walker.id, from: walker.y, to: lane },
    phases: [[60, roster.map((actor) => atRest(actor)), null], [30, down(true), null], [60, down(false), result],
      [40, walking, result], [80, arrived, result]] };
}

test("EVERY BLEND KEEPS THE FLOOR AND THE HUD: random team bouts, the hold and the framing weight all through (0, 1), with no HUD and under 326 and 352", () => {
  // 240 random bouts (seed 11), each run with no HUD, under 326 and under 352.
  // At every frame drawn as a BLEND (hold strictly between 0 and 1):
  // - THE WALL, always: every framed depth — every depth of a lane change's
  //   span — 5px under the foot of all six arenas' walls.
  // - THE HUD, as far as the wall allows: every framed fighter's lowest ink
  //   (his front-most depth, the shell's plate and the painter's widest
  //   shadow) at or above the top the camera stands to — or, where the spans
  //   are taller than the band between the wall and the HUD, the back-most
  //   depth EXACTLY on the wall's margin, the lift having gone as far as it
  //   can (Codex's review of this fix, pass 2).
  //   ~~Every framed fighter's ink at or above the HUD, full stop~~ — bought
  //   with a deeper one-frame cut where a lane change starts a hold's blend.
  // - AND WHERE HE IS DRAWN, the ink above the HUD with no exception: the
  //   walker drawn moving linearly through his span over the walk's 40 frames
  //   (the game's lane change takes 1.2s, 72 frames at 60fps, so this is the
  //   harsher case).
  // And the sweep must reach every tenth of (0, 1) in the hold and in the
  // framing weight under every HUD, and the wall must stop the lift somewhere.
  const random = seeded(11);
  const huds = [null, 326, 352];
  const tally = huds.map(() => ({ blends: 0, mixed: 0, walled: 0, holds: new Set(), weights: new Set() }));
  for (let bout = 0; bout < 240; bout += 1) {
    const { perSide, walker, phases } = randomBout(random);
    huds.forEach((hudTop, index) => {
      playPhases(phases, hudTop, (state, { phase, frame }) => {
        if (!(state.hold > 0 && state.hold < 1)) return;
        const what = `bout ${bout} (${perSide}v${perSide}), HUD ${hudTop}, phase ${phase} frame ${frame} (zoom ` +
          `${state.camera.zoomscale.toFixed(3)}, weight ${(+state.camera.teamWeight).toFixed(3)}, hold ${state.hold.toFixed(3)})`;
        const clearance = worstWallClearance(state.camera, state.framed);
        assert.ok(clearance >= SS2_CLOSE_UP.wallMargin - 1e-9, `${what}: ${clearance.toFixed(3)}px from the wall`);
        const entry = tally[index];
        if (hudTop !== null) {
          const { lowest, who } = lowestInk(state.camera, state.framed);
          const onMargin = Math.abs(clearance - SS2_CLOSE_UP.wallMargin) < 1e-6;
          assert.ok(lowest <= state.camera.hudTop + 1e-9 || onMargin,
            `${what}: ${who} inks to ${lowest.toFixed(3)} under ${state.camera.hudTop}, and the wall had ${(clearance - 5).toFixed(3)}px to spare`);
          if (lowest > state.camera.hudTop + 1e-9) entry.walled += 1;
          const drawnY = phase === 3 ? walker.from + ((walker.to - walker.from) * frame) / 40 : phase === 4 ? walker.to : walker.from;
          const drawn = state.framed.map((actor) => (actor.id !== walker.id ? actor : { ...actor, y: drawnY, yMin: drawnY, yMax: drawnY }));
          const where = lowestInk(state.camera, drawn);
          assert.ok(where.lowest <= state.camera.hudTop + 1e-9, `${what}: where he is drawn, ${where.who} inks to ${where.lowest.toFixed(3)}`);
        }
        entry.blends += 1;
        entry.holds.add(Math.floor(state.hold * 10));
        if (isMixedBlend(state)) {
          entry.mixed += 1;
          entry.weights.add(Math.floor(state.camera.teamWeight * 10));
        }
      });
    });
  }
  assert.ok(tally[1].walled > 0, `under 326 the wall stopped the lift somewhere: ${tally[1].walled}`);
  huds.forEach((hudTop, index) => {
    const { blends, mixed, holds, weights } = tally[index];
    assert.ok(mixed > 500, `HUD ${hudTop}: ${blends} blend frames, ${mixed} with both weights between 0 and 1`);
    assert.deepEqual([...holds].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], `HUD ${hudTop}: the holds reached`);
    assert.deepEqual([...weights].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], `HUD ${hudTop}: the framing weights reached`);
  });
});

test("A HAND-OVER IS FITTED AT THE WEIGHT IT IS DRAWN AT, no HUD: the verifier's layout 7 is 808f6da's camera in every frame, because 808f6da never took it near the wall", async () => {
  // verify:camera-r1's secondary (a), layout 7 of its seed-11 search. Red wins
  // with red-2 (`_yscale` 50) alone at the BACK rank: the framing hands over
  // from the team's line to the pair's while the close-up zooms in. 808f6da's
  // camera goes 70, 76, 81, 85, 88 ... 100 with the framing weight 0.8, 0.64,
  // 0.51 ... and red-2's feet never come nearer arena 5's wall foot than
  // 6.20px. The first HUD camera checked the wall at BOTH ends of the
  // hand-over — at the team's weight of 1, which the camera was leaving — held
  // the target to 82 and zoomed in slower (67 vs 70 ... 96 vs 100) with
  // nobody near the wall. The wall is a fact about where a fighter IS drawn.
  const base = await baseCameraModule();
  const roster = [
    { id: "red-0", x: -117.01388358604163, y: 103, yscale: 113, teamId: "red" },
    { id: "red-1", x: -362.52219578716904, y: 6, yscale: 50, teamId: "red" },
    { id: "red-2", x: -69.84829114051536, y: 6, yscale: 50, teamId: "red" },
    { id: "blue-0", x: 80.80339049454778, y: 103, yscale: 50, teamId: "blue" },
    { id: "blue-1", x: 427.56452387664467, y: 103, yscale: 100, teamId: "blue" },
    { id: "blue-2", x: 290.0284687243402, y: 6, yscale: 100, teamId: "blue" }
  ];
  const kills = new Set(["blue-0", "red-1", "blue-2", "blue-1", "red-0"]);
  const down = (drawing) => roster.map((actor) => (kills.has(actor.id) ? { ...atRest(actor, false), drawing } : atRest(actor)));
  const phases = [[60, roster.map((actor) => atRest(actor)), null], [30, down(true), null], [60, down(false), { winnerTeamId: "red" }]];
  let before = null;
  let worst = Infinity;
  let handedOver = 0;
  playPhases(phases, null, (state, { phase, frame }) => {
    before = base.stepFramedCamera(before, phases[phase][1], { result: phases[phase][2] });
    assert.equal(JSON.stringify(state), JSON.stringify(before), `phase ${phase} frame ${frame}`);
    worst = Math.min(worst, worstWallClearance(before.camera, before.framed));
    if (state.closeUp && state.camera.teamWeight > 0 && state.camera.teamWeight < 1 && state.camera.zoomscale > 82) handedOver += 1;
  });
  assert.ok(worst >= SS2_CLOSE_UP.wallMargin, `808f6da came ${worst.toFixed(2)}px from the wall`);
  assert.ok(handedOver > 0, "the close-up passed 82 during the hand-over");
});

test("NO hudTop, RANDOM BOUTS: the camera moves off 808f6da's in EXACTLY the bouts where 808f6da drew a framed rank within 5px of the wall", async () => {
  // verify:camera-r1's secondary (a): on random layouts the first HUD camera
  // moved 59 bouts of 3,000 (its seed 11), 33 of them bouts where 808f6da never
  // drew anybody near the wall — a hand-over's target held to the team line's
  // 82 by a weight the camera was leaving. Every frame's whole state is
  // compared; a bout "breached" if any frame 808f6da drew put any framed depth
  // (a lane change's span included) within `wallMargin` of the lowest wall foot.
  const base = await baseCameraModule();
  const random = seeded(5);
  const tally = { bouts: 0, moved: 0, breached: 0 };
  for (let bout = 0; bout < 300; bout += 1) {
    const { perSide, phases } = randomBout(random);
    let before = null;
    let moved = false;
    let breached = false;
    playPhases(phases, null, (state, { phase }) => {
      before = base.stepFramedCamera(before, phases[phase][1], { result: phases[phase][2] });
      if (!moved && JSON.stringify(state) !== JSON.stringify(before)) moved = true;
      if (!breached && worstWallClearance(before.camera, before.framed) < SS2_CLOSE_UP.wallMargin) breached = true;
    });
    assert.equal(moved, breached, `bout ${bout} (${perSide}v${perSide}): moved ${moved}, 808f6da breached ${breached}`);
    tally.bouts += 1;
    if (moved) tally.moved += 1;
    if (breached) tally.breached += 1;
  }
  assert.ok(tally.moved > 0, `the sweep reached the defect: ${JSON.stringify(tally)}`);
});

test("CODEX FIX-ROUND PASS 1: a blend under a HUD reaches the held camera WITHOUT A JUMP — the ink is cleared by lifting the blend, not by holding its zoom down", () => {
  // Codex's review of the fix round, pass 1 (2026-09-24). Under the 2v2's HUD
  // (326), blue-0 (`_yscale` 100) wins alone and walks from 423 to 124; the
  // close-up cannot hold him and the hold takes the frame to the old camera,
  // which frames the bodies on a TEAM line lifted so its largest fighter's ink
  // lands EXACTLY on 326. Any pair weight left in a blend then puts ink under
  // the HUD unless the pair part fits by itself — so lowering the blend's
  // zoom held it at the pair's fit, 68, for 20 frames, and the frame the hold
  // snapped from 0.9885 to 1 jumped to the old camera's 80 (12 zooms, the line
  // 4px). Every frame here must keep the ink above the HUD and the zoom and
  // the line moving by no more than the build's own ease does: its 4-zoom snap,
  // and under 2px of line.
  const roster = [
    { id: "red-0", x: -295, y: 200, yscale: 50, teamId: "red" },
    { id: "red-1", x: -35, y: 103, yscale: 100, teamId: "red" },
    { id: "blue-0", x: 423, y: 200, yscale: 100, teamId: "blue" },
    { id: "blue-1", x: 264, y: 200, yscale: 86, teamId: "blue" }
  ];
  const kills = new Set(["red-0", "red-1", "blue-1"]);
  const down = (drawing) => roster.map((actor) => (kills.has(actor.id) ? { ...atRest(actor, false), drawing } : atRest(actor)));
  const result = { winnerTeamId: "blue" };
  const walking = down(false).map((actor) => (actor.id !== "blue-0" ? actor
    : { ...actor, x: 124, xMin: 124, xMax: 423, drawing: true }));
  let previous = null;
  let blended = 0;
  let reachedHeld = false;
  playPhases([[60, roster.map((actor) => atRest(actor)), null], [30, down(true), null], [60, down(false), result],
    [60, walking, result]], 326, (state, { phase, frame }) => {
    const what = `phase ${phase} frame ${frame} (zoom ${state.camera.zoomscale.toFixed(3)}, hold ${state.hold.toFixed(4)})`;
    const { lowest, who } = lowestInk(state.camera, state.framed);
    assert.ok(lowest <= state.camera.hudTop + 1e-9, `${what}: ${who} inks to ${lowest.toFixed(3)}`);
    if (phase === 3 && previous !== null) {
      const dz = state.camera.zoomscale - previous.camera.zoomscale;
      const dl = groundLineAt(state.camera) - groundLineAt(previous.camera);
      assert.ok(Math.abs(dz) <= SS2_CAMERA.zoomSnap, `${what}: the zoom moved ${dz.toFixed(3)}`);
      assert.ok(Math.abs(dl) < 2, `${what}: the line moved ${dl.toFixed(3)}px`);
      if (state.hold > 0 && state.hold < 1) blended += 1;
      if (state.hold === 1 && previous.hold > 0 && previous.hold < 1) reachedHeld = true;
    }
    previous = state;
  });
  assert.ok(blended >= 10, `${blended} blend frames`);
  assert.ok(reachedHeld, "the blend reached the fully held frame");
});

test("CODEX FIX-ROUND PASS 2: a lane change starting a hold's blend costs the zoom only what the WALL needs — the ink is lifted as far as the wall allows, never bought with a deeper cut", () => {
  // Codex's review of the fix round, pass 2 (2026-09-24): the test file's own
  // random bout 159 (seed 11) under 326. Blue-0 (`_yscale` 50) is the lone
  // winner at the BACK rank, framed alone on the pair's line at 100; then he
  // walks to -66.56 and steps up to the front rank, so his span is y 6..200 —
  // standing at 6, arriving at 200. The close-up cannot hold that span and
  // the hold blends to the old camera. The raw blend's first frame zoomed
  // 100 -> 85.6 and stood his feet (at 6, where he IS) 3.10px from arena 5's
  // wall. Lifting the blend for the ink of the span's FRONT end (where he will
  // arrive, 29px under the HUD) and only then fitting the wall cut the frame
  // to 72: 13.6 zooms more than the raw blend, for ink that is not drawn yet.
  // The wall comes first: the zoom falls only until the span's back end
  // clears it, and the lift then goes only as far as the wall allows.
  const roster = [
    { id: "red-0", x: -323.47783309640363, y: 103, yscale: 100, teamId: "red" },
    { id: "red-1", x: -471.3198104593903, y: 6, yscale: 50, teamId: "red" },
    { id: "red-2", x: -370.9886023728177, y: 6, yscale: 113, teamId: "red" },
    { id: "blue-0", x: 229.9540219316259, y: 6, yscale: 50, teamId: "blue" },
    { id: "blue-1", x: 56.40789358410984, y: 200, yscale: 113, teamId: "blue" },
    { id: "blue-2", x: 309.9632290843874, y: 103, yscale: 86, teamId: "blue" }
  ];
  const kills = new Set(["red-1", "red-0", "blue-1", "blue-2", "red-2"]);
  const down = (drawing) => roster.map((actor) => (kills.has(actor.id) ? { ...atRest(actor, false), drawing } : atRest(actor)));
  const result = { winnerTeamId: "blue" };
  const to = -66.55502478126436;
  const walking = down(false).map((actor) => (actor.id !== "blue-0" ? actor
    : { ...actor, x: to, y: 200, xMin: to, xMax: actor.x, yMin: 6, yMax: 200, drawing: true }));
  const states = [];
  playPhases([[60, roster.map((actor) => atRest(actor)), null], [30, down(true), null], [60, down(false), result],
    [40, walking, result]], 326, (state, { phase }) => { if (phase === 3) states.push(state); });
  const [start] = states;
  assert.ok(start.hold > 0 && start.hold < 1, "the walk's first frame is a blend");
  // His span's back end — where he stands this frame — exactly on the 5px margin, not deeper.
  near(worstWallClearance(start.camera, start.framed), SS2_CLOSE_UP.wallMargin, "the back end on the margin");
  // And one zoom closer, with nothing lifted, it would not be: the drop is the wall's own.
  const closer = { ...start.camera, zoomscale: start.camera.zoomscale + 1, crowdY: start.camera.crowdY + 1, inkLift: undefined };
  assert.ok(worstWallClearance(closer, start.framed) < SS2_CLOSE_UP.wallMargin,
    `zoom ${start.camera.zoomscale}: ${start.camera.zoomscale + 1} would also have kept the wall`);
  for (const [index, state] of states.entries()) {
    const clearance = worstWallClearance(state.camera, state.framed);
    assert.ok(clearance >= SS2_CLOSE_UP.wallMargin - 1e-9, `walk frame ${index}: ${clearance.toFixed(3)}px from the wall`);
  }
});
