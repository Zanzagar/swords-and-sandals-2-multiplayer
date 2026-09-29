/**
 * THE CAMERA ON A PERSON'S TURN (ring3 slice "camera"; the owner's decision 6,
 * `docs/design/battle-ui.md#decided-hud-2026-09-24`): "on a PERSON's turn only, the camera eases to also frame
 * the acting fighter's ring (buttons, items row, rank arrows) with a margin, and every lit target while a reach
 * preview shows ... AI and spectate turns stay byte-identical — the close-up and 1v1 untouched." Amended by D3
 * (`#decided-inframe-hud-2026-09-24`): in a team bout every camera keeps the fighters above the in-frame HUD, and
 * every rank off the painted wall.
 *
 * Seam under test: `stepFramedCamera`'s `framing` — a function the shell hands it on a person's turn, giving, for
 * any camera, the stage-px boxes of everything the person must see (the ring as `paintRing` lays it out there, and
 * the lit targets: `ringFramingFor` in `tools/arena/ring-layout.js`, pinned in `test/arena-ring-camera.test.js`).
 * Here the boxes are hand-made, so every expected number is worked by hand from the camera's own constants: the
 * arena origin 319.95, the band 80 below a `midwaypoint` of 240, the fit `floor(640 / (spread + 210) * 100)`, the
 * zoom's ease of a fifth.
 *
 * The camera before this slice is `src/render/arena-backdrop.js` at 76b9ca9 (the last commit to touch it, and
 * c2b5751's), read out of git and imported whole: it imports nothing.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { SS2_RING_FRAMING, actorSpanFor, arenaToStage, stepFramedCamera } from "../src/render/arena-backdrop.js";
import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2PhysicalSize, ss2TeamRules } from "../src/team/ss2-rules.js";
import { resourceValue } from "../src/team/resources.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { ss2ColossusYscaleAfter } from "../src/common/ss2-figure.js";
import { combatPanelLayoutFor } from "../src/render/combat-panel.js";
import { combatHudArtFor } from "../tools/arena/combat-hud.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The camera module before this slice (76b9ca9). Throws rather than skipping: an identity check must see what it is identical TO. */
async function baseCameraModule() {
  let source;
  try {
    source = execFileSync("git", ["show", "76b9ca9:src/render/arena-backdrop.js"], { cwd: REPO_ROOT, encoding: "utf8" });
  } catch (error) {
    throw new Error(`the identity sweep needs read-only git history (commit 76b9ca9) at ${REPO_ROOT}: ${error.message}`, { cause: error });
  }
  assert.ok(!/^import /m.test(source), "the base module imports nothing, so it loads on its own");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

/** Doubles, not a loosened assertion: within `tolerance` (1e-9 of a pixel or a zoom unless stated). */
function near(actual, expected, what, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${what ?? "value"}: ${actual} !~ ${expected}`);
}

/** A fighter standing still, as `placedActors()` hands him over. */
const standing = (id, x, teamId, { y = 200, yscale = 86 } = {}) => ({
  id, x, y, yscale, ...actorSpanFor({ x, y }, null), side: teamId === "red" ? "hero" : "villain", teamId, alive: true, drawing: false
});

/** The 2v2 of the worked cases: the front rank at -300, -200, 200 and 300. */
const PAIR_OF_PAIRS = [standing("red-1", -300, "red"), standing("red-2", -200, "red"), standing("blue-1", 200, "blue"), standing("blue-2", 300, "blue")];

/**
 * A HAND-MADE FRAMING: one box anchored to where `x` is drawn at the camera asked about — from 100 px left of it to
 * 50 px right, stage y 100..200 — as a person's ring is anchored to the fighter it stands on.
 */
const boxOn = (x, { left = 100, right = 50, top = 100, bottom = 200 } = {}) => (camera) => {
  const at = arenaToStage(camera, { x, y: 200 }).x;
  return [{ x0: at - left, x1: at + right, y0: top, y1: bottom }];
};

/** Steps `frames` frames with the same options, handing back the last result. */
function run(state, roster, frames, options = {}) {
  let current = state;
  for (let frame = 0; frame < frames; frame += 1) current = stepFramedCamera(current, roster, options);
  return current;
}

/* ------------------------------------------------------------------ */
/* 1. The constants                                                    */
/* ------------------------------------------------------------------ */

test("the framing's constants: an 8 stage-px margin, eased by the zoom's own fifth, snapping inside a hundredth", () => {
  assert.equal(SS2_RING_FRAMING.margin, 8);
  assert.equal(SS2_RING_FRAMING.ease, 5, "the build's zoomEase, `+0x0723`");
  assert.equal(SS2_RING_FRAMING.snapZoom, 0.01);
  assert.equal(SS2_RING_FRAMING.snapPan, 0.01);
});

/* ------------------------------------------------------------------ */
/* 2. A person's turn in a team bout                                   */
/* ------------------------------------------------------------------ */

test("A PERSON'S TURN: the camera eases to frame the boxes with the margin — panning, and zooming out only as far as keeping every fighter as framed as before needs", () => {
  // Worked by hand. The base camera settles at zoom 79, pan 0: the closest opposing pair is 400 apart
  // (midwaypoint 200, band 80), the spread 600 + 210 fits at floor(640 / 810 * 100) = 79, and the focus, arena x 0,
  // is drawn at 319.95, inside the build's dead zone 300..340, so the pan never moves.
  const settled = run(null, PAIR_OF_PAIRS, 60);
  assert.deepEqual([settled.camera.zoomscale, settled.camera.gladiatorsX], [79, 0]);
  // The box stands on red-1 at -300: drawn at 319.95 - 237 = 82.95, it starts at -17.05, off the stage's left.
  // Every fighter keeps the fit's margin, 105 units either side, as framed as the base camera frames it: at 79,
  // blue-2's right edge is 319.95 + 405 * 0.79 = 639.9 (0.9 past the stage's 639), so no pan to the right keeps him —
  // the zoom must come down until one does. At zoom z the box asks pan >= 8 - (319.95 - 3z - 100) and blue-2 allows
  // pan <= 639.9 - 319.95 - 4.05z: at 76, 16.05 against 12.15; at 75, 13.05 against 16.2. So: zoom 75, pan 13.05,
  // the pan nearest the base's that fits.
  const framed = run(settled, PAIR_OF_PAIRS, 60, { framing: boxOn(-300) });
  near(framed.camera.zoomscale, 75, "zoom");
  near(framed.camera.gladiatorsX, 13.05, "pan");
  assert.equal(framed.camera.crowdY, -200 + 75, "the crowd the build hangs from the zoom");
  // The box's left edge is the margin from the stage's; nothing else about the camera moved.
  near(boxOn(-300)(framed.camera)[0].x0, 8, "the box's left edge");
  for (const field of ["team", "teamWeight", "midwaypoint", "focusX", "maxscale"]) {
    assert.deepEqual(framed.camera[field], settled.camera[field], field);
  }
  // The base camera itself runs on untouched underneath: what the tween carries is the build's camera.
  assert.deepEqual([framed.own.zoomscale, framed.own.gladiatorsX], [79, 0]);
});

test("A PAN ALONE WHEN ONE DOES: the zoom kept, and of the pans that frame the box, the one nearest the camera's own — either way", () => {
  // Worked by hand: a closer 2v2 at -200, -100, 100 and 200 settles at the band's 80 (the fit would allow
  // floor(640 / 610 * 100) = 104), pan 0. Every fighter's margin has slack: red-1's left edge at 319.95 - 305 * 0.8 =
  // 75.95, blue-2's right at 563.95.
  const close = [standing("red-1", -200, "red"), standing("red-2", -100, "red"), standing("blue-1", 100, "blue"), standing("blue-2", 200, "blue")];
  const settled = run(null, close, 60);
  assert.deepEqual([settled.camera.zoomscale, settled.camera.gladiatorsX], [80, 0]);
  // A box 200 px left of red-1 (drawn at 159.95) starts at -40.05: a pan of 8 + 40.05 = 48.05 frames it, and
  // blue-2 allows up to 639 - 563.95 = 75.05. The zoom stays 80.
  const left = run(settled, close, 60, { framing: boxOn(-200, { left: 200 }) });
  near(left.camera.zoomscale, 80, "zoom, left");
  near(left.camera.gladiatorsX, 48.05, "pan, left");
  // Mirrored: a box 200 px right of blue-2 (479.95) ends at 679.95: any pan from -75.95 (red-1's slack) to
  // 631 - 679.95 = -48.95 frames it, and the one nearest 0 is -48.95.
  const right = run(settled, close, 60, { framing: boxOn(200, { left: 50, right: 200 }) });
  near(right.camera.zoomscale, 80, "zoom, right");
  near(right.camera.gladiatorsX, -48.95, "pan, right");
});

test("AS FRAMED AS BEFORE, NOT MORE: a fighter the fighters' camera already has partly off the stage may stay so — the framing does not zoom out to bring him on", () => {
  // Worked by hand. A 2v2 at -330, -230, 170 and 270: the spread fits at 79 and the focus, arena x -30, is drawn at
  // 319.95 - 23.7 = 296.25, left of the dead zone, so the pan creeps right toward 3.75 (a sixteenth of what is left
  // a frame). There red-1's fit margin, from -435, starts 19.95 px off the stage's left; blue-2's ends at 619.95.
  const shifted = [standing("red-1", -330, "red"), standing("red-2", -230, "red"), standing("blue-1", 170, "blue"), standing("blue-2", 270, "blue")];
  const settled = run(null, shifted, 600);
  near(settled.camera.gladiatorsX, 3.75, "the pan", 1e-9);
  // A box from 50 left to 100 right of blue-2, at zoom z: pan <= 631 - (319.95 + 2.7z + 100) = 211.05 - 2.7z; red-1
  // may stay as far off as he is: pan >= -19.95 - 319.95 + 4.35z. At 79: 3.75 against -2.25; at 78: -0.6 against
  // 0.45 — zoom 78, and the pan nearest 3.75 is 0.45. Held to the stage's edge instead (red-1 wholly on), it would
  // take pan >= -319.95 + 4.35z: not until zoom 73.
  const framed = run(settled, shifted, 80, { framing: boxOn(270, { left: 50, right: 100 }) });
  near(framed.camera.zoomscale, 78, "zoom");
  near(framed.camera.gladiatorsX, 0.45, "pan", 1e-6);
});

test("NO ONE-FRAME JUMP: the first frame of a person's turn moves a fifth of the way, and the next a fifth of what is left", () => {
  const settled = run(null, PAIR_OF_PAIRS, 60);
  const first = stepFramedCamera(settled, PAIR_OF_PAIRS, { framing: boxOn(-300) });
  // A fifth of -4 and of 13.05.
  near(first.camera.zoomscale, 78.2, "zoom");
  near(first.camera.gladiatorsX, 2.61, "pan");
  assert.equal(first.camera.crowdY, -200 + 79, "ceil(78.2)");
  const second = stepFramedCamera(first, PAIR_OF_PAIRS, { framing: boxOn(-300) });
  near(second.camera.zoomscale, 79 - 1.44, "zoom");
  near(second.camera.gladiatorsX, 4.698, "pan");
});

test("THE TURN ENDS: the camera eases back by the same fifth and then IS the camera before this slice, to the byte", async () => {
  const base = await baseCameraModule();
  let before = null;
  let now = null;
  for (let frame = 0; frame < 60; frame += 1) {
    before = base.stepFramedCamera(before, PAIR_OF_PAIRS);
    now = stepFramedCamera(now, PAIR_OF_PAIRS);
  }
  for (let frame = 0; frame < 60; frame += 1) {
    before = base.stepFramedCamera(before, PAIR_OF_PAIRS);
    now = stepFramedCamera(now, PAIR_OF_PAIRS, { framing: boxOn(-300) });
  }
  near(now.camera.zoomscale, 75, "framed");
  // The turn ends: no framing. The first frame gives back a fifth: -4 * 0.8 and 13.05 * 0.8.
  before = base.stepFramedCamera(before, PAIR_OF_PAIRS);
  now = stepFramedCamera(now, PAIR_OF_PAIRS, { framing: null });
  near(now.camera.zoomscale, 79 - 3.2, "zoom, a fifth back");
  near(now.camera.gladiatorsX, 10.44, "pan, a fifth back");
  // The zoom's gap, 3.2 * 0.8^n, is inside 0.01 after 26 more frames (0.00967); the pan's, 10.44 * 0.8^n, after 32
  // (0.00827; at 31 it is 0.01034). Then the framing is dropped and the result is the base camera's own.
  let identicalFrom = null;
  for (let frame = 1; frame <= 40; frame += 1) {
    before = base.stepFramedCamera(before, PAIR_OF_PAIRS);
    now = stepFramedCamera(now, PAIR_OF_PAIRS);
    if (identicalFrom === null && JSON.stringify(now) === JSON.stringify(before)) identicalFrom = frame;
    if (identicalFrom !== null) assert.equal(JSON.stringify(now), JSON.stringify(before), `frame ${frame} of the release`);
  }
  assert.equal(identicalFrom, 32, "the frame the pan snaps home");
});

/** How far each framed fighter's fit margin (`FIGURE_HALF_WIDTH` either side of his span) stands off the visible stage, each side. */
function offStage(camera, framed) {
  return framed.map((actor) => ({
    id: actor.id,
    left: 0 - arenaToStage(camera, { x: actor.xMin - 105 }).x,
    right: arenaToStage(camera, { x: actor.xMax + 105 }).x - 639
  }));
}

test("NO FIGHTER IS CROPPED MORE THAN THE FIGHTERS' CAMERA CROPS HIM, on ANY frame — the offsets a turn leaves easing out while the camera follows the next move included", () => {
  // The turn above leaves the camera 13.05 px right of the fighters' own (and 4 zooms out). Then everyone walks
  // 150 right: the fighters' camera pans after them by the build's sixteenth a frame, and for a while draws blue-2's
  // margin off the stage's right. Easing out, the offset still pushes the frame right — over blue-2 — unless the
  // drawn frame is kept, each frame, where no fighter is further off than the fighters' camera has him.
  const settled = run(null, PAIR_OF_PAIRS, 60);
  let state = run(settled, PAIR_OF_PAIRS, 60, { framing: boxOn(-300) });
  const walked = PAIR_OF_PAIRS.map((actor) => standing(actor.id, actor.x + 150, actor.teamId));
  let pushed = 0;
  for (let frame = 0; frame < 60; frame += 1) {
    state = stepFramedCamera(state, walked);
    const drawn = offStage(state.camera, walked);
    const own = offStage(state.person?.base ?? state.camera, walked);
    drawn.forEach((edges, index) => {
      assert.ok(edges.left <= Math.max(0, own[index].left) + 1e-9, `frame ${frame}: ${edges.id}'s left ${edges.left} against ${own[index].left}`);
      assert.ok(edges.right <= Math.max(0, own[index].right) + 1e-9, `frame ${frame}: ${edges.id}'s right ${edges.right} against ${own[index].right}`);
    });
    if (state.person && state.camera.gladiatorsX !== state.person.base.gladiatorsX + state.person.dg) pushed += 1;
  }
  assert.ok(pushed > 0, "the case is reached: some frame's eased pan would have cropped blue-2");
});

test("A 1v1 IS UNTOUCHED: the framing is not read, and the camera is the build's to the byte", async () => {
  const base = await baseCameraModule();
  const duel = [standing("red-1", -250, "red"), standing("blue-1", 250, "blue")];
  let before = null;
  let now = null;
  let asked = 0;
  const framing = (camera) => { asked += 1; return boxOn(-250, { left: 400 })(camera); };
  for (let frame = 0; frame < 90; frame += 1) {
    before = base.stepFramedCamera(before, duel);
    now = stepFramedCamera(now, duel, { framing });
    assert.equal(JSON.stringify(now), JSON.stringify(before), `frame ${frame}`);
  }
  assert.equal(asked, 0);
});

test("A NEW BOUT OPENS ON ITS OWN SHOT: a fresh roster drops a person's framing, and the camera is the build's opening", async () => {
  const base = await baseCameraModule();
  const framed = run(run(null, PAIR_OF_PAIRS, 60), PAIR_OF_PAIRS, 60, { framing: boxOn(-300) });
  const other = [standing("red-1", -310, "red"), standing("red-2", -150, "red"), standing("red-3", -60, "red"), standing("blue-1", 150, "blue")]
    .map((actor, index) => ({ ...actor, id: `new-${index}` }));
  const opened = stepFramedCamera(framed, other);
  assert.equal(JSON.stringify(opened), JSON.stringify(base.stepFramedCamera(null, other)));
});

test("A FRAMING NO ZOOM CAN FIT (taller than the stage) changes nothing: the base camera is drawn — and the margin is kept on y as on x", () => {
  const settled = run(null, PAIR_OF_PAIRS, 60);
  const tall = run(settled, PAIR_OF_PAIRS, 30, { framing: boxOn(-300, { top: -50, bottom: 450 }) });
  assert.deepEqual([tall.camera.zoomscale, tall.camera.gladiatorsX], [79, 0]);
  // A box whose top is ON the stage (y 5) but inside the 8 px margin (under 1 + 8) fits no zoom either: these boxes
  // stand at a fixed y whatever the camera does. Without the margin on y it would take zoom 75, pan 13.05 (above).
  const high = run(settled, PAIR_OF_PAIRS, 30, { framing: boxOn(-300, { top: 5 }) });
  assert.deepEqual([high.camera.zoomscale, high.camera.gladiatorsX], [79, 0]);
});

/* ------------------------------------------------------------------ */
/* 3. Byte-identical without a framing                                 */
/* ------------------------------------------------------------------ */

const deps = { ss2Combatant, ss2BattleValues };
function demoHost({ perSide, seed, kit = "" }) {
  const items = demoItemsFrom(kit);
  return createVanillaBattleHost({
    teams: [demoSide("red", perSide, { ...deps, items, seed }), demoSide("blue", perSide, { ...deps, items, seed })],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed
  });
}
function yscaleOf(host, id) {
  const record = host.combatant(id);
  const built = ss2PhysicalSize(record);
  return resourceValue(record, "spell_colossus", 0) > 0 ? ss2ColossusYscaleAfter(built, 100)
    : resourceValue(record, "spell_little_fat_kid", 0) > 0 ? 50 : built;
}
function rosterOf(host) {
  return host.wire().teams.flatMap((team) => team.combatants).filter((c) => Number.isFinite(c.x)).map((c) => {
    const placement = host.layout.placementFor(c.id);
    return {
      id: c.id, x: c.x, y: c.y, yscale: yscaleOf(host, c.id), ...actorSpanFor({ x: c.x, y: c.y }, null),
      side: placement?.side ?? null, teamId: placement?.teamId ?? null, alive: c.alive !== false, drawing: false
    };
  });
}
/** The in-frame HUD's top the page hands the camera (the layout a pack-less page draws); null in a 1v1. */
function hudTopOf(host) {
  const layout = combatPanelLayoutFor({
    sides: host.wire().teams.map((team) => ({ teamId: team.id, ids: [...team.combatants].sort((a, b) => a.slotIndex - b.slotIndex).map((c) => c.id) })),
    pack: combatHudArtFor(undefined).pack
  });
  return layout.mode === "team" && Number.isFinite(layout.hudTop) ? layout.hudTop : null;
}

test("NO FRAMING IS THE CAMERA BEFORE THIS SLICE: every frame of AI-played demo bouts, 1v1 to 3v3, under the in-frame HUD and without it, identical to 76b9ca9's — the close-up included", async () => {
  // Every turn played by the rule set's own AI, as a spectated bout or an AI seat's turn is; the whole returned
  // state compared, 20 frames a turn, with the framing absent and null.
  const base = await baseCameraModule();
  const tally = { bouts: 0, frames: 0, closeUp: 0 };
  for (const perSide of [1, 2, 3]) {
    for (const kit of ["", "tricks", "buffs"]) {
      for (const seed of [1, 2]) {
        const host = demoHost({ perSide, seed, kit });
        const withHud = hudTopOf(host);
        const states = { absent: null, none: null, before: null, bare: null, bareBefore: null };
        for (let taken = 0; !host.battle.result && taken < 1500; taken += 1) {
          const roster = rosterOf(host);
          const result = host.battle.result ?? null;
          for (let frame = 0; frame < 20; frame += 1) {
            states.absent = stepFramedCamera(states.absent, roster, { result, hudTop: withHud });
            states.none = stepFramedCamera(states.none, roster, { result, hudTop: withHud, framing: null });
            states.before = base.stepFramedCamera(states.before, roster, { result, hudTop: withHud });
            states.bare = stepFramedCamera(states.bare, roster, { result, framing: null });
            states.bareBefore = base.stepFramedCamera(states.bareBefore, roster, { result });
            const where = `${perSide}v${perSide} ${kit || "plain"} seed ${seed}, turn ${taken} frame ${frame}`;
            const expected = JSON.stringify(states.before);
            assert.equal(JSON.stringify(states.absent), expected, where);
            assert.equal(JSON.stringify(states.none), expected, `framing null: ${where}`);
            assert.equal(JSON.stringify(states.bare), JSON.stringify(states.bareBefore), `no HUD: ${where}`);
            tally.frames += 1;
            if (states.before.closeUp) tally.closeUp += 1;
          }
          const due = host.currentCombatantId();
          host.submit({ ...host.suggestAction(due), actorId: due });
        }
        tally.bouts += 1;
      }
    }
  }
  assert.equal(tally.bouts, 18);
  assert.ok(tally.frames > 20000 && tally.closeUp > 1000, JSON.stringify(tally));
});
