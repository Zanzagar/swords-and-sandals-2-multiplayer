/**
 * THE ARROW — the build's ballistic, and the one axis vanilla cannot have.
 *
 * WHY THIS FILE IS SEPARATE, and it is the same reason `ss2-ranged.test.js` is:
 * **a green suite is not coverage.** `projectile.js` arrived whole, and every
 * branch in it — the arc, the flat shot, the pitch, the depth interpolation,
 * the trail cadence — is executed here by a test that would fail if the branch
 * were deleted. The mutation audit of 2026-09-13 found two survivors in code
 * that had simply never been run.
 *
 * WHAT IS THE BUILD'S AND WHAT IS OURS, cited at each assertion:
 *
 * - **The build's**: `gravity` 2, `Yvelocity = ceil(distance / Xvelocity)`, the
 *   arc on bombard ONLY, the flat 60 for a snipe, snipe loosed LOWER than
 *   bombard, the `± 30` launch offset, a trail puff every third frame.
 * - **Ours, each with its reason in the source**: the bombard velocity's
 *   SOURCE (the build draws it and a renderer here may not), the arc's peak
 *   normalised to one launch height, and the DEPTH axis, which vanilla does
 *   not have because both its gladiators stand at `_y = 200`. (~~"the launch
 *   heights expressed in figure heights rather than the build's screen
 *   pixels"~~ until 2026-09-23: the launch heights are the build's own, in
 *   arena units, for the shooter's own `_yscale`.)
 *
 * THE ASSERTIONS PROVE, THEY DO NOT STATE: every sweep asserts it found the
 * case it was sweeping for.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  animationCursor,
  applyCommands,
  emptyScene,
  bombardVelocityFor,
  flightDurationMs,
  projectileAt,
  projectileDrawAt,
  projectileFlight,
  projectileTrail,
  reactionDelaysFor,
  PROJECTILE_FRAME_MS,
  figureScaleFor,
  figureSpecFor,
  paintFigure,
  poseAt,
  rankOfDepth,
  timelineFor,
  ProjectileError,
  ProjectileKind,
  SS2_PROJECTILE
} from "../src/render/index.js";
import { SS2_FIGURE_HALF_WIDTH, SS2_FIGURE_HEIGHT } from "../src/common/ss2-figure.js";
import { CommandKind, SS2_STATIC_MAP_BINDINGS, presentResolvedEvents, buildArenaLayout } from "../src/adapter/index.js";

const shot = (overrides = {}) => projectileFlight({
  kind: ProjectileKind.BOMBARD,
  from: { x: -300, y: 200 },
  to: { x: 300, y: 200 },
  sequence: 0,
  ...overrides
});

/* ------------------------------------------------------------------ */
/* The flight's own constants                                          */
/* ------------------------------------------------------------------ */

test("the flight constants are the build's, and the velocity is DERIVED rather than drawn", () => {
  // `bullet.gravity = 2` (`+0x6efd`), `bulletcounter >= 3` (`+0x71aa`),
  // `bullet._x = attacker._x ± 30` (`+0x6dff`), and the snipe's flat
  // `randomBetween(60, 60)` (`+0x7112`) — a range of one value, so it is a
  // constant wearing a draw's clothes.
  assert.equal(SS2_PROJECTILE.gravity, 2);
  assert.equal(SS2_PROJECTILE.trailEveryFrames, 3);
  assert.equal(SS2_PROJECTILE.launchOffsetX, 30);
  assert.equal(SS2_PROJECTILE.snipeVelocity, 60);

  // ► **THE BUILD DRAWS `randomBetween(8, 18)` AND A RENDERER HERE MAY NOT.**
  //   The only RNG this engine has is the resolver's ordered channel, and that
  //   channel IS the wire format — a presentation surface taking a sample from
  //   it would move every peer's `rngCursor` and desync two clients watching
  //   one bout. A second, unhashed generator would be worse: two replays of a
  //   bout would not look alike.
  //
  //   So the SPREAD is kept and the SOURCE is the sequence number. Both halves
  //   are asserted, because either alone is satisfiable by a constant.
  const seen = new Set();
  for (let sequence = 0; sequence < 40; sequence += 1) seen.add(bombardVelocityFor(sequence));
  assert.deepEqual(
    [...seen].sort((a, b) => a - b),
    [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    "the whole 8..18 band the build draws from, and nothing outside it"
  );
  // Determinism, pinned against LITERALS rather than against a second call —
  // `f(7) === f(7)` compares an expression with itself and asserts nothing,
  // which the suite's own meta-test catches and did.
  assert.equal(bombardVelocityFor(0), 8, "sequence 0 is the bottom of the band");
  assert.equal(bombardVelocityFor(7), 15);
  assert.equal(bombardVelocityFor(11), 8, "and it wraps, so a long bout keeps spreading");
  assert.equal(bombardVelocityFor(undefined), 8, "an absent sequence is the bottom, never NaN");
  // Two flights built independently from the same sequence must agree, which
  // is the claim a replay actually depends on.
  assert.equal(
    projectileFlight({ kind: ProjectileKind.BOMBARD, from: { x: 0, y: 0 }, to: { x: 600, y: 0 }, sequence: 7 }).xVelocity,
    15,
    "and a flight built from it carries the same number"
  );
});

test("a projectile needs a kind it recognises and two placed ends", () => {
  assert.throws(() => projectileFlight({ kind: "fireball", from: { x: 0 }, to: { x: 1 } }), ProjectileError);
  // An unplaced end is a rule set that models no geometry — `fixtureReplay`, or
  // a position-blind archer. There is nothing to fly an arrow BETWEEN, and
  // inventing two points would put a trajectory on screen the model does not
  // have.
  assert.throws(
    () => projectileFlight({ kind: ProjectileKind.BOMBARD, from: { x: null }, to: { x: 300 } }),
    ProjectileError
  );
});

/* ------------------------------------------------------------------ */
/* The arc, which is the build's and is bombard-only                   */
/* ------------------------------------------------------------------ */

test("Yvelocity IS the flight's length in frames, which is what aims the arc", () => {
  // `Yvelocity = ceil(distance_to_enemy / Xvelocity)` (`+0x7139`), and `_x +=
  // Xvelocity` once a frame — so the same quantity is both the initial climb
  // rate and the number of frames the arrow is in the air. **The arc is aimed
  // by the RANGE**, which is why a bombard can fall short onto the ground
  // (`bullet._y > 160`) and a snipe never can.
  for (const distance of [200, 600, 1200, 4000]) {
    const flight = shot({ from: { x: 0, y: 200 }, to: { x: distance, y: 200 } });
    assert.equal(flight.distance, distance);
    assert.equal(
      flight.flightFrames,
      Math.ceil(distance / flight.xVelocity),
      `distance ${distance}: the flight is distance / Xvelocity frames`
    );
    assert.equal(flight.yVelocity, flight.flightFrames, "and Yvelocity is the same number");
  }
});

test("a bombard arcs, peaks at the MIDPOINT, and comes back down; a snipe is flat", () => {
  const bombard = shot({ from: { x: -600, y: 200 }, to: { x: 600, y: 200 } });
  assert.equal(bombard.arc, true);

  const heights = [];
  for (let t = 0; t <= bombard.flightFrames; t += 1) heights.push(projectileAt(bombard, t).height);
  const peak = Math.max(...heights);
  const peakAt = heights.indexOf(peak);

  assert.ok(peak > heights[0], "it must actually rise");
  assert.ok(
    Math.abs(peakAt - bombard.flightFrames / 2) <= 1,
    `the apex must be the midpoint: ${peakAt} of ${bombard.flightFrames}`
  );
  assert.ok(
    heights[heights.length - 1] < peak,
    "and come back down, or it is a balloon rather than an arrow"
  );
  // Strictly monotone up then strictly monotone down — a ballistic has exactly
  // one turning point, and a curve that wobbled would still pass the three
  // assertions above.
  for (let t = 1; t <= peakAt; t += 1) assert.ok(heights[t] >= heights[t - 1], `rising at ${t}`);
  for (let t = peakAt + 1; t < heights.length; t += 1) assert.ok(heights[t] <= heights[t - 1], `falling at ${t}`);

  // ► **THE `_y` INTEGRATION IS INSIDE A BOMBARD-ONLY TEST (`+0x72c7`), so a
  //   snipe never changes height at all.** Loosed lower, constant velocity,
  //   hits or passes.
  const snipe = shot({ kind: ProjectileKind.SNIPE, from: { x: -600, y: 200 }, to: { x: 600, y: 200 } });
  assert.equal(snipe.arc, false);
  assert.equal(snipe.xVelocity, SS2_PROJECTILE.snipeVelocity);
  const snipeHeights = new Set();
  for (let t = 0; t <= snipe.flightFrames; t += 1) snipeHeights.add(projectileAt(snipe, t).height);
  assert.equal(snipeHeights.size, 1, "a snipe holds one height for the whole flight");
});

test("a BOMBARD clears a standing body and a SNIPE does not — the measurement the RULE rests on", () => {
  // ► **THIS IS THE LOAD-BEARING TEST FOR A GAME RULE THAT LIVES IN ANOTHER
  //   FILE.** `ss2-rules.js` offers a bombard against any foe in any lane and
  //   gates a snipe on a clear line, and it does that because a lobbed arrow
  //   genuinely passes over a body while a flat one does not. **That is a
  //   property of THIS module's arithmetic**, so if the launch height or the
  //   arc changed, the rule over there would quietly stop being true and
  //   nothing would say so.
  //
  // ► ~~Measured on `projectileAt().height` against "a gladiator 1.0 figure
  //   heights tall"~~ **until 2026-09-23 — a number the drawing never used.** A
  //   Codex review found the DRAWN lob 159.66 up under an identical bystander's
  //   191.48 crown while this test, reading the arc underneath the drawing,
  //   passed; it could not fail on the defect it existed to catch. It now
  //   measures `projectileDrawAt().lift` — what the screen shows — over a
  //   blocker's DRAWN body, against the crown the authored painter draws, for
  //   a blocker every 25 units between the two and at the walk clamp in front
  //   of the target, the shooter's size and a much bigger one.
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const bareCrown = Math.max(...paintFigure(
    figureSpecFor({ id: "x", name: "X", resources: {} }, { side: "hero" }),
    poseAt(timelineFor("Standing", { role: "actor" }), 0)
  ).flatMap((op) => op.kind === "polygon" ? op.points.map(([, y]) => y) : op.kind === "circle" ? [op.y + op.r] : []));
  // ► **AWAY FROM THE ENDS, since a fourth Codex finding the same day**: a lob
  //   is `chord + k * bulge` with one capped `k` per flight (`lobLiftAt`), and
  //   near either end no capped raise can clear a tall body — so the promise,
  //   and this measurement, is every point at least the body's OWN end room
  //   from the launch and from the landing, on a flight at least twice that
  //   long: `2 * (C - e)` here, every fighter in the front rank, with `C` his
  //   crown plus 5% and `e` the strength-9 target's 134 shoulder (`endRoomFor`
  //   in `projectile.js`; ~~`LOB_END_ROOM` 140~~ until Codex pass 5 showed a
  //   fixed room assumed nobody stronger than 50). `endRoom: 0` measures the
  //   whole body, for the snipe below.
  const roomOf = (blocker) => 2 * Math.max(0, SS2_FIGURE_HEIGHT * (blocker.yscale / 100) * 1.05 - (86 * 1.5 + 5));
  const drawnOver = (flight, blocker, { endRoom = roomOf(blocker) } = {}) => {
    const reach = SS2_FIGURE_HALF_WIDTH * blocker.yscale / 100;
    const landingX = projectileDrawAt(flight, 1, view).x;
    let lowest = Infinity;
    let highest = -Infinity;
    if (Math.abs(landingX - flight.launch.x) < 2 * endRoom) return { lowest, highest };
    for (let x = blocker.x - reach; x <= blocker.x + reach; x += 1) {
      const t = (x - flight.launch.x) / (flight.direction * flight.xVelocity);
      if (t < 0 || t > flight.flightFrames) continue;
      if (Math.abs(x - flight.launch.x) < endRoom || Math.abs(landingX - x) < endRoom) continue;
      const point = projectileDrawAt(flight, t / flight.flightFrames, view);
      if (Math.abs(point.x - blocker.x) > reach) continue;
      lowest = Math.min(lowest, point.lift);
      highest = Math.max(highest, point.lift);
    }
    return { lowest, highest };
  };
  // `stopShortFor`'s rule: the drawn front, or the centre when that is inside the blocker.
  const stopFor = (targetX, blocker) => {
    const surface = SS2_FIGURE_HALF_WIDTH * 86 / 100;
    return Math.abs(blocker.x - (targetX - surface)) <= SS2_FIGURE_HALF_WIDTH * blocker.yscale / 100 ? 0 : surface;
  };

  let measured = 0;
  for (const distance of [200, 400, 630, 1000, 2000, 4000]) {
    for (const blockerYscale of [86, 113]) {
      const spots = [distance - 86];
      for (let x = 86; x < distance - 86; x += 25) spots.push(x);
      for (const bx of spots) {
        const blocker = { x: bx, y: 200, yscale: blockerYscale };
        const crown = bareCrown * blockerYscale / 100;
        for (let sequence = 0; sequence <= 10; sequence += 1) {
          const bombard = projectileFlight({
            kind: ProjectileKind.BOMBARD, from: { x: 0, y: 200 }, to: { x: distance, y: 200 }, sequence,
            targetSize: stopFor(distance, blocker), shooterYscale: 86, targetYscale: 86, bodies: [blocker]
          });
          const over = drawnOver(bombard, blocker);
          if (over.lowest === Infinity) continue;
          measured += 1;
          assert.ok(over.lowest > crown,
            `bombard over ${distance}, v${bombard.xVelocity}: ${over.lowest.toFixed(1)} over a ${blockerYscale} body at ${bx} whose crown is ${crown.toFixed(1)}`);
        }
      }
    }
  }
  assert.ok(measured > 500, `the sweep must actually pass over blockers, or it proves nothing: ${measured}`);

  // ► **AND THE SNIPE MUST FAIL THE SAME TEST**, or the two rules are not
  //   telling the two shots apart and the whole split is decoration. Drawn
  //   straight, shoulder to shoulder, it goes through anybody in the way.
  const blocker = { x: 315, y: 200, yscale: 86 };
  const snipe = projectileFlight({
    kind: ProjectileKind.SNIPE, from: { x: 0, y: 200 }, to: { x: 630, y: 200 }, sequence: 3,
    shooterYscale: 86, targetYscale: 86, bodies: [blocker]
  });
  const through = drawnOver(snipe, blocker, { endRoom: 0 });
  assert.ok(through.highest < bareCrown * 0.86,
    `a snipe flies at ${through.highest.toFixed(1)} — chest height, and straight through anybody in the way`);
});

test("a snipe is loosed LOWER than a bombard, which is the build's own relationship", () => {
  // `_y = attacker._y - (_yscale * 2 + 30)` for a bombard (`+0x6e42`) against
  // `_yscale * 1.5 + 5` for a snipe (`+0x6e9e`) — 230 against 155 ARENA UNITS
  // at the nominal scale (~~screen pixels~~; the bullet is attached to the
  // object the fighters stand in, see the test below).
  //
  // ► ~~**THE RATIO IS WHAT IS PORTED, NOT THE PIXELS** ... Two coordinate
  //   systems do not share a unit~~ — **these two do, corrected 2026-09-23**,
  //   and the numbers are now ported as numbers. The ratio still holds at the
  //   nominal `_yscale`, which is what this asserts.
  const bombard = shot();
  const snipe = shot({ kind: ProjectileKind.SNIPE });
  assert.ok(snipe.launch.height < bombard.launch.height, "the flat shot leaves from the shoulder");
  assert.equal(snipe.launch.height / bombard.launch.height, 155 / 230);
});

test("THE ARROW LEAVES AT THE BUILD'S OWN HEIGHT FOR ITS SHOOTER — just over the crown of the figure the arena draws", () => {
  // ► **THE BUILD'S LAUNCH HEIGHTS ARE ARENA UNITS, NOT SCREEN PIXELS.** The
  //   bullet is attached to `arena.gladiators` (`+0x6da2`), the same object
  //   both fighters stand in, and placed relative to the shooter's own `_y`:
  //
  //     bombard   bullet._y = attacker._y - (attacker._yscale * 2 + 30)     +0x6e42-+0x6e76
  //     snipe     bullet._y = attacker._y - (attacker._yscale * 1.5 + 5)    +0x6e9e-+0x6ed6
  //
  //   So a strength-9 shooter (`physical_size` 86) looses a bombard 202 units
  //   up and a snipe 134, and with no size stated the clip's own `_yscale` 100
  //   gives 230 and 155.
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const liftAt = (kind, shooterYscale) => projectileDrawAt(projectileFlight({
    kind, from: { x: -300, y: 200 }, to: { x: 300, y: 200 }, sequence: 0, shooterYscale
  }), 0, view).lift;
  assert.equal(liftAt(ProjectileKind.BOMBARD, 86), 202, "86 * 2 + 30");
  assert.equal(liftAt(ProjectileKind.SNIPE, 86), 134, "86 * 1.5 + 5");
  assert.equal(liftAt(ProjectileKind.BOMBARD), 230, "no size stated: the clip's own `_yscale` 100");
  assert.equal(liftAt(ProjectileKind.SNIPE), 155);

  // ► **AND THAT IS THE HEAD OF THE FIGURE THE ARENA DRAWS**, which is the
  //   attachment this asserts: the build draws that shooter's `standing` clip,
  //   222.65 pixels from sole to crown, at 86%. ~~150 arena units per figure
  //   height~~ put the bombard 26 units over a 124-unit figure until
  //   2026-09-23; the build puts it 10.5 over a 191.5-unit one.
  const crown = 222.65 * 0.86;
  const bombard = liftAt(ProjectileKind.BOMBARD, 86);
  assert.ok(bombard > crown && bombard - crown < crown * 0.1,
    `a bombard leaves just over the crown (${crown.toFixed(1)}), at ${bombard}`);
  const snipe = liftAt(ProjectileKind.SNIPE, 86);
  assert.ok(snipe > crown * 0.5 && snipe < crown * 0.8,
    `a snipe leaves from the shoulder, at ${(snipe / crown).toFixed(2)} of the figure`);
});

test("the launch is the BOW ARM, thirty units toward the target, whichever way it faces", () => {
  const right = shot({ from: { x: -300, y: 200 }, to: { x: 300, y: 200 } });
  assert.equal(right.launch.x, -300 + SS2_PROJECTILE.launchOffsetX);
  assert.equal(right.direction, 1);

  const left = shot({ from: { x: 300, y: 200 }, to: { x: -300, y: 200 } });
  assert.equal(left.launch.x, 300 - SS2_PROJECTILE.launchOffsetX, "mirrored, not repeated");
  assert.equal(left.direction, -1);
});

test("the arrow lands ON the target rather than one velocity past it", () => {
  // `_x += Xvelocity` is unbounded in the build because the impact test removes
  // the clip the moment it passes the defender. Here the flight is a function
  // of time, so the clamp is what stops the last frame overshooting — the same
  // rule `poseIndexAt` applies to an animation's final frame.
  for (const [from, to] of [[-300, 300], [300, -300]]) {
    const flight = shot({ from: { x: from, y: 200 }, to: { x: to, y: 200 } });
    assert.equal(projectileAt(flight, flight.flightFrames).x, to, `${from} -> ${to}`);
    assert.equal(projectileAt(flight, flight.flightFrames * 10).x, to, "and an overrun does not sail past");
    assert.equal(projectileAt(flight, -5).x, flight.launch.x, "nor does a negative frame fly backwards");
  }
});

/* ------------------------------------------------------------------ */
/* Depth — the axis vanilla does not have                              */
/* ------------------------------------------------------------------ */

test("depth interpolates LINEARLY across lanes, and the arc does not touch it", () => {
  // ► **THE WHOLE OF THE THREE-AXIS SPLIT, and the owner's own question.** The
  //   build has one `_y` and it carries the arc, which it can because both
  //   gladiators stand at `_y = 200`. Here arena `y` is DEPTH and height is the
  //   renderer's `lift`, so an arrow crossing lanes is at a different rank every
  //   frame — and it changes rank at a steady rate, because there is no
  //   ballistic reason for it to do anything else. Drawing depth from the arc's
  //   curve would make a cross-lane shot rise and fall in DEPTH, which is not a
  //   thing that happens.
  const flight = shot({ from: { x: -300, y: 103 }, to: { x: 300, y: 200 } });
  const samples = [];
  for (let t = 0; t <= flight.flightFrames; t += 1) samples.push(projectileAt(flight, t));

  assert.equal(samples[0].y, 103, "it starts in the shooter's rank");
  assert.equal(samples[samples.length - 1].y, 200, "and arrives in the target's");

  // Linear: every step is the same size. The arc above is demonstrably NOT
  // linear, so this also pins that the two are computed from different curves.
  const steps = samples.slice(1).map((point, index) => point.y - samples[index].y);
  const first = steps[0];
  for (const step of steps) assert.ok(Math.abs(step - first) < 1e-9, "depth moves at a steady rate");
  const heightSteps = samples.slice(1).map((point, index) => point.height - samples[index].height);
  assert.ok(
    new Set(heightSteps.map((value) => value.toFixed(6))).size > 1,
    "while height does not — or the two axes are sharing one curve"
  );
});

test("a one-lane arena flies a flat depth, and an unmodelled one flies none", () => {
  const level = shot({ from: { x: -300, y: 200 }, to: { x: 300, y: 200 } });
  assert.equal(projectileAt(level, level.flightFrames / 2).y, 200, "same rank, same depth throughout");

  // ► **NULL IS AN ANSWER.** A rule set with the second axis off gives every
  //   gladiator `y: null`, and an arrow between two of them has no depth to
  //   report. Substituting the front rank here would be inventing a lane for a
  //   game that has none — the surface decides what to draw for a null, and
  //   this module declines to decide it for them.
  const flat = shot({ from: { x: -300, y: null }, to: { x: 300, y: null } });
  assert.equal(flat.launch.y, null);
  assert.equal(projectileAt(flat, 3).y, null);
});

/* ------------------------------------------------------------------ */
/* Pitch and trail                                                     */
/* ------------------------------------------------------------------ */

test("a bombard TUMBLES and a snipe lies FLAT — the build's rotation, not a pitch", () => {
  // ► **THIS REPLACES AN INVENTION, AND THE OWNER SAW THE INVENTION.** What
  //   stood here pinned an angle derived from the velocity vector, on the
  //   reasoning that "an arrow points where it is going", and on a report that
  //   the build "never assigns `bullet._rotation` in the action code". **That
  //   report was wrong** — it assigns it at `+0x7498`, `+0x74b0` and `+0x74f3`,
  //   all inside the bullet's own `onEnterFrame`, past where the read stopped.
  //
  //   ```text
  //     sniperight   _rotation =  90                      +0x7498
  //     snipeleft    _rotation = -90                      +0x74b0
  //     bombard      bulletrotus = round(bulletlife * gravity * 2 / Xvelocity)
  //                  _rotation   = ±bulletrotus, clamp 170
  //   ```
  //
  //   **The art is VERTICAL** — the arrow shape is 11.4 x 58.4 px — so rotation
  //   0 points at the sky and the ±90 is what lays a snipe flat.
  const degrees = (flight, t) => Math.round((projectileAt(flight, t).rotation * 180) / Math.PI);

  const snipe = shot({ kind: ProjectileKind.SNIPE, from: { x: -600, y: 200 }, to: { x: 600, y: 200 } });
  for (let t = 0; t <= snipe.flightFrames; t += 1) {
    assert.equal(degrees(snipe, t), 90, `a snipe holds a constant 90 at t=${t}`);
  }

  // ► **`bulletlife` ACCUMULATES DISTANCE, NOT FRAMES** — `bulletlife +=
  //   Xvelocity` from a start of **1** (`+0x73d9`, `+0x6ede`) — so the velocity
  //   divides straight back out and the tumble is `round(4t + 4/Xvelocity)`:
  //   four degrees a frame however fast the shot, plus a sub-degree offset from
  //   that start of 1.
  //
  //   **The first version of this asserted a flat `4t` and asserted it across
  //   three flights that all had the SAME velocity** — every `shot()` here
  //   defaults to sequence 0 — so the cross-velocity claim never fired and the
  //   offset showed up as an off-by-one. The sequences differ now, and the
  //   tolerance is the offset the build's own `+1` produces rather than a
  //   fudge.
  const tumbles = [];
  for (const sequence of [0, 4, 10]) {
    const bombard = shot({ from: { x: 0, y: 200 }, to: { x: 2400, y: 200 }, sequence });
    tumbles.push([bombard.xVelocity, [1, 5, 10, 20].map((t) => degrees(bombard, t))]);
  }
  assert.equal(new Set(tumbles.map(([velocity]) => velocity)).size, 3, "three genuinely different velocities");
  for (const [velocity, samples] of tumbles) {
    samples.forEach((value, index) => {
      const frame = [1, 5, 10, 20][index];
      assert.ok(
        Math.abs(value - 4 * frame) <= 1,
        `velocity ${velocity} at t=${frame}: ${value} must be within a degree of ${4 * frame}`
      );
    });
  }
  assert.deepEqual(tumbles[0][1], [5, 21, 41, 81], "and the exact numbers at the slowest velocity");

  // It CLAMPS rather than spinning for ever.
  const long = shot({ from: { x: 0, y: 200 }, to: { x: 4000, y: 200 } });
  assert.ok(long.flightFrames > 170 / 4, "the sweep needs a flight long enough to reach the clamp");
  assert.equal(degrees(long, long.flightFrames), SS2_PROJECTILE.tumbleClamp);
  assert.equal(SS2_PROJECTILE.tumbleClamp, 170, "just short of a half turn");

  // ► **THE SIGN IS THE SHOOTER'S FACING, NOT THE VELOCITY** (`+0x7511`), so a
  //   left-flying shot mirrors rather than repeating the same turn.
  const rightward = shot({ from: { x: -600, y: 200 }, to: { x: 600, y: 200 } });
  const leftward = shot({ from: { x: 600, y: 200 }, to: { x: -600, y: 200 } });
  assert.equal(degrees(leftward, 10), -degrees(rightward, 10));
  const snipeLeft = shot({ kind: ProjectileKind.SNIPE, from: { x: 600, y: 200 }, to: { x: -600, y: 200 } });
  assert.equal(degrees(snipeLeft, 3), -90, "and a snipe flying left lies flat the other way");
});

test("the flight ends at the target's BODY, not inside it", () => {
  // ► **OWNER'S REPORT, 2026-09-13: the projectile "kinda clipped to the model
  //   at the end".** The build's impact test is `bullet._x > defender._x`
  //   (`+0x6cb4`) — it crosses the centre and is removed the same tick, which
  //   reads fine at vanilla's scale and badly here: a `physical_size` of ~86
  //   against a flight of a few hundred means the last frames are drawn INSIDE
  //   the figure, and over it, because the build attaches at depth 45000.
  //
  //   Stopping at the surface is the same geometry `ss2WalkDestination` uses to
  //   stop a walk against a body, so it is the engine's existing answer rather
  //   than a new one.
  const centred = shot({ from: { x: -300, y: 200 }, to: { x: 300, y: 200 } });
  assert.equal(projectileAt(centred, centred.flightFrames).x, 300, "targetSize 0 is the build's literal behaviour");

  const bodied = projectileFlight({
    kind: ProjectileKind.BOMBARD, from: { x: -300, y: 200 }, to: { x: 300, y: 200 },
    targetSize: 86, sequence: 0
  });
  assert.equal(projectileAt(bodied, bodied.flightFrames).x, 300 - 86, "and a body stops it at its own edge");
  assert.equal(bodied.impact.centreX, 300, "while the centre is still reported, for anything that wants it");
  assert.ok(bodied.distance < centred.distance, "a shorter flight, because it ends sooner");

  // Mirrored, or the blue side's arrows would stop a body-width PAST the foe.
  const leftward = projectileFlight({
    kind: ProjectileKind.BOMBARD, from: { x: 300, y: 200 }, to: { x: -300, y: 200 },
    targetSize: 86, sequence: 0
  });
  assert.equal(projectileAt(leftward, leftward.flightFrames).x, -300 + 86);
});

test("the trail is one puff every third frame, and the oldest fall off", () => {
  // `bulletcounter` counts to 3 and drops a puff at the arrow's own position
  // (`+0x71aa`-`+0x7205`). At 30 fps that is ten a second.
  const flight = shot({ from: { x: -600, y: 200 }, to: { x: 600, y: 200 } });
  assert.ok(flight.flightFrames >= 30, "the sweep needs a flight long enough to shed several puffs");

  assert.equal(projectileTrail(flight, 2).length, 0, "nothing before the third frame");
  assert.equal(projectileTrail(flight, 3).length, 1, "and one at it");
  assert.equal(projectileTrail(flight, 8).length, 2, "frames 3 and 6");

  const capped = projectileTrail(flight, flight.flightFrames, { keep: 4 });
  assert.equal(capped.length, 4, "the cap is this engine's own; the build never removes them");
  // The KEPT ones are the newest, which is what makes a trail read as a trail.
  const all = projectileTrail(flight, flight.flightFrames, { keep: Infinity });
  assert.deepEqual(capped, all.slice(-4));
});

/* ------------------------------------------------------------------ */
/* The command, and the scene it folds into                            */
/* ------------------------------------------------------------------ */

const wireWith = (event, positions = {}) => ({
  teams: [
    {
      id: "red",
      combatants: [{
        id: "red-1", name: "Red", teamId: "red", seatId: "s1", slotIndex: 0, aiFilled: false,
        alive: true, health: 40, maxHealth: 40, stats: {}, loadout: {}, resources: {}, status: [],
        x: positions.redX === undefined ? -300 : positions.redX, y: positions.redY ?? 103
      }]
    },
    {
      id: "blue",
      combatants: [{
        id: "blue-1", name: "Blue", teamId: "blue", seatId: "s2", slotIndex: 0, aiFilled: false,
        alive: true, health: 40, maxHealth: 40, stats: {}, loadout: {}, resources: {}, status: [],
        x: positions.blueX === undefined ? 300 : positions.blueX, y: positions.blueY ?? 200
      }]
    }
  ],
  events: [{ sequence: 1, actorId: "red-1", targetId: "blue-1", hit: true, dispatchedMethod: "normal", ...event }]
});

function firedFor(event, positions) {
  const wire = wireWith(event, positions);
  const layout = buildArenaLayout(wire);
  const { commands } = presentResolvedEvents(wire, { layout, bindings: SS2_STATIC_MAP_BINDINGS });
  return commands.filter((command) => command.kind === CommandKind.FIRE_PROJECTILE);
}

test("a shot emits fire-projectile; a BASH does not, and neither does a sword", () => {
  // ► **DETECTED BY `attackDirection`, NEVER BY THE TYPE STRING** — the rule
  //   every case in `presentation.js` follows, and here it is at its strongest:
  //   21 and 22 are the build's own constants (`+0x6c67`, `+0x6c8c`) while
  //   `bombard`/`snipe` are this repository's spelling.
  const bombard = firedFor({ type: "bombard", attackDirection: 21 });
  assert.equal(bombard.length, 1);
  assert.equal(bombard[0].projectile, "bombard");
  assert.equal(bombard[0].combatantId, "red-1");
  assert.equal(bombard[0].targetId, "blue-1");
  assert.deepEqual(bombard[0].from, { x: -300, y: 103 }, "the shooter's own arena position");
  assert.deepEqual(bombard[0].to, { x: 300, y: 200 });
  assert.equal(bombard[0].hit, true);

  assert.equal(firedFor({ type: "snipe", attackDirection: 22 })[0].projectile, "snipe");

  // ► **DIRECTION 23 IS IN THE RANGED BAND AND LOOSES NOTHING**, which is why
  //   `PROJECTILE_DIRECTIONS` is a separate set from `RANGED_DIRECTIONS`.
  //   `bash_attack` is a blow WITH the bow: its branch (`+0x6463`) attaches no
  //   bullet, sets no `bullet_in_air`, and plays `Attack2`.
  assert.equal(firedFor({ type: "bash-attack", attackDirection: 23 }).length, 0, "a bash is not a shot");
  assert.equal(firedFor({ type: "normal-attack", attackDirection: 5 }).length, 0, "and neither is a sword");
});

test("an unplaced shooter looses no arrow, because there is nothing to fly it between", () => {
  assert.equal(
    firedFor({ type: "bombard", attackDirection: 21 }, { redX: null }).length,
    0,
    "a rule set that models no geometry gets no trajectory invented for it"
  );
});

test("the scene folds an arrow, and does NOT carry it into the next action", () => {
  const fired = firedFor({ type: "bombard", attackDirection: 21 });
  const scene = applyCommands(emptyScene(), fired);
  assert.equal(scene.projectiles.length, 1);
  assert.equal(scene.projectiles[0].projectile, "bombard");
  // ► **AN ARROW IS AN EVENT, NOT STATE**, and the build says so plainly: it
  //   attaches the bullet on release and `removeMovieClip()`s it on impact.
  //   Carrying one forward would leave arrows hanging over later turns.
  const next = applyCommands(scene, []);
  assert.equal(next.projectiles.length, 0, "the next batch starts with an empty sky");
  assert.equal(Object.keys(next.actors).length, Object.keys(scene.actors).length, "while actors DO carry forward");
});

/* ------------------------------------------------------------------ */
/* Drawing: the decisions the shell is not allowed to make              */
/* ------------------------------------------------------------------ */

test("an arrow crossing lanes SHRINKS, at the same scale as the figures it flies between", () => {
  // ► **THE OWNER'S OWN QUESTION, AND THE REASON THIS FUNCTION EXISTS AT ALL.**
  //   `tools/arena/main.js` cannot be tested — it has given up six live defects
  //   in three days, every one found by screenshotting — so the arithmetic
  //   lives here and the shell makes canvas calls.
  //
  //   The arrow rides `figureScaleFor` on its INTERPOLATED depth, which is the
  //   same function with the same fractional rank the gladiators use. An arrow
  //   that held one size while flying between two figures of visibly different
  //   sizes is the tell this exists to prevent.
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };

  // Rank 2 (the back) to rank 0 (the front): the arrow flies TOWARD the viewer.
  const forward = projectileFlight({
    kind: ProjectileKind.BOMBARD, from: { x: -400, y: 6 }, to: { x: 400, y: 200 }, sequence: 2
  });
  const start = projectileDrawAt(forward, 0, view);
  const end = projectileDrawAt(forward, 1, view);
  assert.ok(start.size < end.size, `it must grow coming forward: ${start.size} -> ${end.size}`);

  // And the arrow's size at each end must be the size a GLADIATOR standing
  // there draws at — the claim is not "it changes" but "it agrees".
  assert.equal(start.size, figureScaleFor({ yscale: 100, rank: 2, slotIndex: 0 }), "at the back rank");
  assert.equal(end.size, figureScaleFor({ yscale: 100, rank: 0, slotIndex: 0 }), "and at the front");

  // The reverse shot shrinks, or the scaling is keyed on something other than
  // depth and happens to be monotone.
  const away = projectileFlight({
    kind: ProjectileKind.BOMBARD, from: { x: -400, y: 200 }, to: { x: 400, y: 6 }, sequence: 2
  });
  assert.ok(
    projectileDrawAt(away, 0, view).size > projectileDrawAt(away, 1, view).size,
    "and shrink going away"
  );

  // A LEVEL shot does not change size at all, which is the control: with both
  // ends in one rank there is no depth to interpolate.
  const level = projectileFlight({
    kind: ProjectileKind.BOMBARD, from: { x: -400, y: 103 }, to: { x: 400, y: 103 }, sequence: 2
  });
  assert.equal(projectileDrawAt(level, 0, view).size, projectileDrawAt(level, 1, view).size);
});

test("the TRAIL tapers across lanes too, each puff at its own depth", () => {
  // Each puff takes the scale of the rank IT is at, not the arrow's — which is
  // the whole reason depth is interpolated rather than fixed at the launch. A
  // trail drawn at one size across three ranks reads as a flat sticker.
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const flight = projectileFlight({
    kind: ProjectileKind.BOMBARD, from: { x: -600, y: 6 }, to: { x: 600, y: 200 }, sequence: 1
  });
  const drawn = projectileDrawAt(flight, 1, view, {});
  assert.ok(drawn.trail.length >= 3, `the sweep needs several puffs: ${drawn.trail.length}`);
  const sizes = drawn.trail.map((puff) => puff.size);
  for (let index = 1; index < sizes.length; index += 1) {
    assert.ok(sizes[index] > sizes[index - 1], `puff ${index} must be nearer than ${index - 1}`);
  }
});

test("EACH PUFF WEARS THE ROTATION THE ARROW HAD WHEN IT WAS DROPPED", () => {
  // ► **THE BUILD ATTACHES A PUFF AT THE BULLET'S `_x`, `_y` AND `_rotation`**
  //   (`+0x71ee`), and `projectileAt` has always computed that rotation — but
  //   `projectileDrawAt` copied x, y, lift and size out of it and dropped the
  //   rotation, so `tools/arena/main.js` hardcoded `rotation: 0` and every puff
  //   behind a pitching bombard lay flat. Fixed 2026-09-15.
  //
  // ► **A BOMBARD IS THE CASE THAT CAN TELL.** Its pitch changes every frame,
  //   so its puffs must carry DIFFERENT rotations from one another; a snipe's
  //   `_rotation` is the constant ±90 of `+0x7498`/`+0x74b0`, so a test using
  //   one could not distinguish "carried" from "hardcoded to the same number".
  //   That is what this test would have been if it had used the simpler shot.
  // ► **AND THE PROGRESS MATTERS, WHICH IS HOW THE FIRST VERSION OF THIS TEST
  //   FAILED.** It asked at progress 1 — the end of the flight — where the six
  //   KEPT puffs are the newest six and the tumble has long since hit its 170°
  //   clamp, so all six shared one rotation and the assertion below fired
  //   against correct code. The tumble is ~4°/frame and a puff falls every
  //   third, so consecutive puffs are 12° apart until the clamp: measured here,
  //   12, 24, 36, 48 … 168, then 170 forever. **Both halves are pinned below**,
  //   because a test that only saw the clamp could not tell a carried rotation
  //   from a hardcoded one, and that is exactly the reading that fooled me.
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const arc = projectileFlight({
    kind: ProjectileKind.BOMBARD, from: { x: -200, y: 103 }, to: { x: 200, y: 103 }, sequence: 1
  });
  const early = projectileDrawAt(arc, 0.3, view, {});
  assert.ok(early.trail.length >= 3, `the sweep needs several puffs: ${early.trail.length}`);

  for (const [index, puff] of early.trail.entries()) {
    assert.ok(Number.isFinite(puff.rotation), `puff ${index} must carry a finite rotation, not undefined`);
  }
  // Not merely present — DIFFERENT, which is what fails if the field is ever
  // filled from the arrow's current rotation or from a constant.
  const distinct = new Set(early.trail.map((puff) => puff.rotation));
  assert.ok(distinct.size > 1,
    `a tumbling bombard's early puffs must not share one rotation: ${[...distinct].join(", ")}`);

  // And each is the rotation the arrow ACTUALLY had at that frame — the puffs
  // are dropped every third frame, oldest first, so the Nth SURVIVING puff of
  // an un-truncated trail was dropped at frame 3*(N+1). Asserting against
  // `projectileAt` is what pins "the arrow's own rotation, then" rather than
  // "some plausible changing number".
  for (const [index, puff] of early.trail.entries()) {
    const droppedAt = SS2_PROJECTILE.trailEveryFrames * (index + 1);
    assert.equal(puff.rotation, projectileAt(arc, droppedAt).rotation,
      `puff ${index} must wear the rotation the arrow had at frame ${droppedAt}`);
  }

  // THE CLAMP: `_rotation = ±bulletrotus, clamped at 170` (`+0x742f`,
  // `+0x74e0`, `+0x74f3`). Late puffs SHOULD share one rotation, and a test
  // that called that a bug would be wrong.
  //
  // ► **IT TAKES A LONGER FLIGHT THAN THE ONE ABOVE, and the second draft of
  //   this test got that wrong too.** The 400-unit shot is 45 frames, so even
  //   its newest six puffs sit at 120, 132, 144, 156, 168, 170 — still
  //   climbing. The tumble needs ~42 frames to reach 170 at 4°/frame, and the
  //   trail keeps only the newest six, so the clamp is only ALL of them on a
  //   flight long enough that every kept puff was dropped after frame 42.
  const far = projectileFlight({
    kind: ProjectileKind.BOMBARD, from: { x: -600, y: 103 }, to: { x: 600, y: 103 }, sequence: 1
  });
  const late = projectileDrawAt(far, 1, view, {});
  const lateDegrees = late.trail.map((puff) => Math.round((puff.rotation * 180) / Math.PI));
  assert.deepEqual([...new Set(lateDegrees)], [SS2_PROJECTILE.tumbleClamp],
    `past the clamp every puff is ${SS2_PROJECTILE.tumbleClamp}°: ${lateDegrees.join(", ")}`);
});

test("a null depth draws at the FRONT RANK, and that decision is not the shell's", () => {
  // With the second axis off every gladiator has `y: null` and `projectileAt`
  // faithfully reports null — "this model has no depth". A canvas still has to
  // put the arrow somewhere, and the front rank is where every figure in such a
  // game already stands.
  const view = { frontY: 200, rankStride: 0, figureScaleFor, rankOfDepth };
  const flat = projectileFlight({
    kind: ProjectileKind.SNIPE, from: { x: -300, y: null }, to: { x: 300, y: null }, sequence: 0
  });
  const drawn = projectileDrawAt(flat, 0.5, view);
  assert.equal(drawn.y, 200, "the front rank, not null and not NaN");
  assert.ok(Number.isFinite(drawn.size) && drawn.size > 0, "and a size a painter can use");
  for (const puff of drawn.trail) assert.equal(puff.y, 200, "trail puffs too");
});

test("the lift arrives in ARENA UNITS, so a surface hands it straight to toY", () => {
  // The flight reports height in BOMBARD LAUNCH HEIGHTS and the conversion
  // happens once, here, rather than in every surface that draws one. The unit
  // is the build's own `_yscale * 2 + 30` — 230 arena units at the nominal
  // `_yscale` 100, the bullet being attached to the object the fighters stand
  // in. ~~`height * 150`, "figure heights x the arena height of a figure"~~
  // until 2026-09-23: the AUTHORED figure's height, and ~101 units for this snipe.
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const flight = projectileFlight({
    kind: ProjectileKind.SNIPE, from: { x: -300, y: 200 }, to: { x: 300, y: 200 }, sequence: 0
  });
  const drawn = projectileDrawAt(flight, 0.5, view);
  const height = projectileAt(flight, 0.5 * flight.flightFrames).height;
  assert.equal(drawn.lift, height * 230, "bombard launch heights x the build's bombard launch");
  assert.equal(drawn.lift, 155, "and a flat snipe is `_yscale * 1.5 + 5` the whole way");
});

test("projectileDrawAt REFUSES to import the painter, so the injection is not optional", () => {
  // `src/render/projectile.js` is pure arithmetic and must not reach for
  // `figure.js`; the caller passes the scale function in. A missing one is a
  // programming error worth naming rather than a silent nominal size.
  const flight = projectileFlight({
    kind: ProjectileKind.SNIPE, from: { x: 0, y: 200 }, to: { x: 300, y: 200 }, sequence: 0
  });
  assert.throws(() => projectileDrawAt(flight, 0.5, { frontY: 200, rankStride: 97 }), ProjectileError);
});

/* ------------------------------------------------------------------ */
/* The gate: an arrow in the air is work in progress                    */
/* ------------------------------------------------------------------ */

test("an arrow in the air holds the action open, which is the build's own guard", () => {
  // ► **VANILLA WILL NOT COMPLETE A RANGED PHASE WHILE THE BULLET IS FLYING.**
  //   `bullet_in_air != true` sits on the phase-completion guard (`+0x3829`),
  //   beside `attacker.struck` and `grounded`. So a long bombard genuinely takes
  //   a long turn there, and the animation gate here is given the same fact
  //   rather than a timeline that has already finished.
  //
  //   The numbers are why it matters: `ranged` is 9 beats (1,080ms) and a
  //   58-frame bombard across the arena is over 1,900. Without this the arrow
  //   vanished for most of its own flight.
  const flight = shot({ from: { x: -600, y: 200 }, to: { x: 600, y: 200 } });
  const durationMs = flightDurationMs(flight);
  assert.equal(durationMs, flight.flightFrames * (1000 / 30), "the build's own 30 fps");

  const arrow = { token: 7, startedAt: 0, durationMs };
  // Nothing else is running: without the arrow the token would be finished.
  assert.deepEqual(
    animationCursor([7], new Map(), 10).finished,
    [7],
    "the control: an empty arena finishes the token at once"
  );
  assert.deepEqual(
    animationCursor([7], new Map(), 10, { projectiles: [arrow] }).finished,
    [],
    "and an arrow still in the air holds it open"
  );
  assert.deepEqual(
    animationCursor([7], new Map(), durationMs + 1, { projectiles: [arrow] }).finished,
    [7],
    "until it lands"
  );
});

test("an arrow is not subject to the abandon grace, because it cannot fail to arrive", () => {
  // A timeline overrunning its own duration is ABANDONED after
  // `ANIMATION_TIMEOUT_MS`, because a surface may simply never report it. A
  // projectile's duration is arithmetic this engine computed, not a signal it
  // is waiting on — so there is nothing to give up on, and reporting one as
  // abandoned would record the gate being forced open by a surface that was in
  // fact working correctly.
  const flight = shot();
  const arrow = { token: 3, startedAt: 0, durationMs: flightDurationMs(flight) };
  const long = animationCursor([3], new Map(), 1e6, { projectiles: [arrow] });
  assert.equal(long.abandon, null, "no arrow is ever abandoned");
  assert.deepEqual(long.finished, [3], "it simply lands");
});

test("an arrow with no action token holds nothing open", () => {
  // A shot emitted outside any action — which `presentResolvedEvents` does not
  // do today, and which a different binding table might — must not wedge a gate
  // waiting on a token nobody is holding.
  const arrow = { token: null, startedAt: 0, durationMs: 5000 };
  assert.deepEqual(animationCursor([9], new Map(), 10, { projectiles: [arrow] }).finished, [9]);
});

test("the scene carries the action token through, so the shell has ONE source", () => {
  const fired = firedFor({ type: "bombard", attackDirection: 21 });
  const scene = applyCommands(emptyScene(), fired);
  assert.equal(
    scene.projectiles[0].actionToken,
    fired[0].actionToken ?? null,
    "whatever presentResolvedEvents stamped, the scene reports"
  );
  assert.ok("actionToken" in scene.projectiles[0], "and the key is always present, never conditional");
});

test("a fire-projectile touches no actor, so nothing is drawn twice", () => {
  // The build attaches the bullet to `arena.gladiators` at depth 45000, not to
  // either fighter. Folding it into the shooter would give a gladiator a
  // position it does not have.
  const scene = applyCommands(emptyScene(), firedFor({ type: "bombard", attackDirection: 21 }));
  assert.deepEqual(Object.keys(scene.actors), [], "an arrow is nobody's figure");
});

/* ------------------------------------------------------------------ */
/* The victim waits for the arrow (+0x6d29), 2026-09-23                */
/* ------------------------------------------------------------------ */

test("an ARROW's victim waits for the DRAWN flight — bombard and snipe, hit and miss alike", () => {
  // The build rolls the shot when the bullet arrives: the impact test at
  // +0x6c97..+0x6d24 runs every tick of the ranged arm, and only when it holds
  // is checkattackroll() called (+0x6d29). So the victim's clip — and its
  // pop-up — start when the drawn arrow reaches the drawn body.
  const command = (overrides) => ({
    kind: CommandKind.FIRE_PROJECTILE, sequence: 7, combatantId: "archer", targetId: "foe",
    projectile: "bombard", from: { x: -250, y: 200 }, to: { x: 250, y: 200 }, targetSize: 41.4, hit: true,
    ...overrides
  });
  for (const projectile of ["bombard", "snipe"]) {
    for (const hit of [true, false]) {
      const fired = command({ projectile, hit });
      const delay = reactionDelaysFor([fired]).get("foe");
      // The flight tools/arena/main.js draws: the same four inputs PLUS the
      // two yscales and the bodies it passes, which shape the arc only.
      const drawn = projectileFlight({
        kind: projectile, from: fired.from, to: fired.to, sequence: fired.sequence, targetSize: fired.targetSize,
        shooterYscale: 120, targetYscale: 70, bodies: [{ x: 0, y: 200, yscale: 150 }]
      });
      assert.equal(delay, flightDurationMs(drawn), `${projectile} ${hit ? "hit" : "miss"}: the drawn flight's length`);
      assert.equal(delay, drawn.flightFrames * PROJECTILE_FRAME_MS);
      assert.ok(delay > 0);
    }
  }
  // The snipe is flat and fast, the bombard a lob at a sequence-chosen speed.
  assert.ok(reactionDelaysFor([command({ projectile: "snipe" })]).get("foe")
    < reactionDelaysFor([command({ projectile: "bombard" })]).get("foe"));
  // Total: an arrow that cannot be flown delays nothing.
  assert.equal(reactionDelaysFor([command({ from: { x: null, y: 200 } })]).size, 0);
  assert.equal(reactionDelaysFor([command({ targetId: null })]).size, 0);
});
