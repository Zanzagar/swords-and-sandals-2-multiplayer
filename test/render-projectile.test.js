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
 *   SOURCE (the build draws it and a renderer here may not), the launch heights
 *   expressed in figure heights rather than the build's screen pixels, and the
 *   DEPTH axis, which vanilla does not have because both its gladiators stand
 *   at `_y = 200`.
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
  figureScaleFor,
  rankOfDepth,
  ProjectileError,
  ProjectileKind,
  SS2_PROJECTILE
} from "../src/render/index.js";
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
  //   A gladiator is exactly 1.0 figure heights tall, which is what
  //   `bombardLaunchHeight` is anchored to.
  const BODY_HEIGHT = 1;

  // A blocker can only stand BETWEEN the two, and no nearer either end than one
  // body — closer than that and they are standing inside somebody. `86` is
  // `physical_size` at the demo roster's strength 9.
  const BODY_WIDTH = 86;
  let worstClearance = Infinity;
  let sawARange = false;
  for (const distance of [200, 400, 630, 1000, 2000, 4000]) {
    const flight = projectileFlight({
      kind: ProjectileKind.BOMBARD,
      from: { x: 0, y: 200 },
      to: { x: distance, y: 200 },
      sequence: 3
    });
    let lowest = Infinity;
    // Sub-frame steps: the arrow is only sampled per frame in play, but the
    // CLAIM is about the continuous curve, and a coarse sweep could step over
    // the low point.
    for (let t = 0; t <= flight.flightFrames; t += 0.1) {
      const point = projectileAt(flight, t);
      if (point.x < BODY_WIDTH || point.x > distance - BODY_WIDTH) continue;
      lowest = Math.min(lowest, point.height);
    }
    if (lowest === Infinity) continue;   // too short for anybody to stand in
    sawARange = true;
    worstClearance = Math.min(worstClearance, lowest);
    assert.ok(
      lowest > BODY_HEIGHT,
      `bombard over ${distance}: lowest ${lowest.toFixed(3)} must clear a body of ${BODY_HEIGHT}`
    );
  }
  assert.ok(sawARange, "the sweep must contain a range with room for a blocker, or it proves nothing");
  assert.ok(worstClearance > 1, `worst clearance across every range: ${worstClearance.toFixed(3)}`);

  // ► **AND THE SNIPE MUST FAIL THE SAME TEST**, or the two rules are not
  //   telling the two shots apart and the whole split is decoration.
  const snipe = projectileFlight({
    kind: ProjectileKind.SNIPE,
    from: { x: 0, y: 200 },
    to: { x: 630, y: 200 },
    sequence: 3
  });
  const snipeHeight = projectileAt(snipe, snipe.flightFrames / 2).height;
  assert.ok(
    snipeHeight < BODY_HEIGHT,
    `a snipe flies at ${snipeHeight.toFixed(3)} — chest height, and straight through anybody in the way`
  );
});

test("a snipe is loosed LOWER than a bombard, which is the build's own relationship", () => {
  // `_y = attacker._y - (_yscale * 2 + 30)` for a bombard (`+0x6e42`) against
  // `_yscale * 1.5 + 5` for a snipe (`+0x6e9e`) — 230 against 155 screen pixels
  // at the nominal scale.
  //
  // ► **THE RATIO IS WHAT IS PORTED, NOT THE PIXELS**, and this project has
  //   already paid once for the other choice: the shield attach offset was
  //   added to twips when it was in ActionScript pixels and drew twenty times
  //   too close (2026-09-13). Two coordinate systems do not share a unit; the
  //   relationship between two numbers in ONE of them does survive.
  const bombard = shot();
  const snipe = shot({ kind: ProjectileKind.SNIPE });
  assert.ok(snipe.launch.height < bombard.launch.height, "the flat shot leaves from the shoulder");
  assert.equal(snipe.launch.height / bombard.launch.height, 155 / 230);
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

test("a bombard pitches nose-up, levels at the apex and noses down; a snipe never pitches", () => {
  // The build carries `bullet._rotation` and hands it to every trail puff
  // (`+0x7205`) but never assigns it in the action code — it is the clip's own
  // tween there. Here it is DERIVED from the velocity, which is the only honest
  // source: an arrow points where it is going.
  const flight = shot({ from: { x: -600, y: 200 }, to: { x: 600, y: 200 } });
  //
  // ► **THE ANGLE IS THE VELOCITY VECTOR'S OWN, in the arena's frame**, so a
  //   renderer drawing an arrow along +x and rotating by it gets the head
  //   leading in both directions. The first version returned a pitch with the
  //   sign folded by `direction`, which made every LEFT-flying arrow leave the
  //   bow nose-DOWN — invisible until somebody watched the blue side shoot,
  //   and caught here rather than there.
  //
  //   So "nose-up" is the VERTICAL component being positive, which is the claim
  //   in both directions; the raw angle is near 0 flying right and near pi
  //   flying left, and comparing those two numbers directly would be comparing
  //   two different things.
  const rise = (flight_, t) => Math.sin(projectileAt(flight_, t).rotation);
  const launch = rise(flight, 0);
  const apex = rise(flight, flight.flightFrames / 2);
  const landing = rise(flight, flight.flightFrames);

  assert.ok(launch > 0, `it leaves nose-up: ${launch}`);
  assert.ok(Math.abs(apex) < Math.abs(launch), "and levels off at the top");
  assert.ok(landing < 0, `and comes down nose-first: ${landing}`);
  // A lob is symmetric: it lands as steeply as it left.
  assert.ok(Math.abs(Math.abs(landing) - launch) < 0.2, "and the descent mirrors the climb");

  const leftward = shot({ from: { x: 600, y: 200 }, to: { x: -600, y: 200 } });
  assert.ok(rise(leftward, 0) > 0, "the blue side's arrows leave nose-up as well");
  assert.ok(rise(leftward, leftward.flightFrames) < 0, "and come down nose-first as well");
  assert.ok(
    Math.cos(projectileAt(leftward, 0).rotation) < 0,
    "and they point LEFT, or the head is on the wrong end"
  );

  const snipe = shot({ kind: ProjectileKind.SNIPE });
  for (let t = 0; t <= snipe.flightFrames; t += 1) {
    assert.equal(projectileAt(snipe, t).rotation, 0, "a flat shot has no pitch to report");
  }
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
  // The flight reports height in FIGURE HEIGHTS — the one unit the build's
  // screen pixels can honestly be ported into — and the conversion happens
  // once, here, rather than in every surface that draws one.
  const view = { frontY: 200, rankStride: 97, figureScaleFor, rankOfDepth };
  const flight = projectileFlight({
    kind: ProjectileKind.SNIPE, from: { x: -300, y: 200 }, to: { x: 300, y: 200 }, sequence: 0
  });
  const drawn = projectileDrawAt(flight, 0.5, view);
  const height = projectileAt(flight, 0.5 * flight.flightFrames).height;
  assert.equal(drawn.lift, height * 150, "figure heights x the arena height of a figure");
  assert.ok(drawn.lift > 50, "and it is a real arena distance, not a fraction");
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
