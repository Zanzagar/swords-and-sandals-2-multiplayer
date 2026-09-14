/**
 * BLOOD AND SPARKS — the build's own `bounceitem`, tested as the particle
 * system it is.
 *
 * ► **THE WHOLE MODULE ARRIVED AT ONCE, so every branch is executed here on
 *   purpose.** The mutation audit of 2026-09-13 found two survivors in code
 *   that had simply never been run, and a silent no-blood looks exactly like a
 *   correct bout — which is precisely the failure the first shell integration
 *   had, and which a test caught.
 *
 * Every number is the build's, from `sprite:1241/frame:1/DoAction@0x34951a`,
 * and cited at its assertion. **The one thing that is ours** is the SOURCE of
 * the four random draws per drop, for the same reason the arrow's velocity is
 * ours: a renderer may not take a sample from the resolver's ordered channel.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  clipEffectTableFrom,
  dropAt,
  dropRandom,
  effectsForAnimation,
  spawnDrops,
  ClipEffectsError,
  SS2_DROP
} from "../src/render/index.js";

const tableOf = (frames) => clipEffectTableFrom({ clip: 1241, frames });

/* ------------------------------------------------------------------ */
/* The constants, and running without a table                          */
/* ------------------------------------------------------------------ */

test("the drop's constants are the build's", () => {
  assert.equal(SS2_DROP.gravity, 2, "`dy += 2` (+0x040f)");
  assert.equal(SS2_DROP.bounce, -0.4, "`dy *= -0.4` on the ground (+0x035f)");
  assert.equal(SS2_DROP.friction, 0.1, "xspeed bleeds toward zero (+0x03c0)");
  assert.equal(SS2_DROP.lifeFrames, 25, "`counter > 25` removes it (+0x046a)");
  assert.deepEqual(SS2_DROP.spawn.y, { base: -220, span: 150 });
  assert.deepEqual(SS2_DROP.spawn.xspeed, { base: -30, span: 60 });
  assert.deepEqual(SS2_DROP.spawn.dy, { base: -40, span: 20 });
  assert.deepEqual(SS2_DROP.spawn.rotationSpeed, { base: -40, span: 80 });
});

test("no table means no blood, not a crash — which is how a fresh clone runs", () => {
  for (const absent of [null, undefined, {}, { frames: null }, "nonsense", 7]) {
    const table = clipEffectTableFrom(absent);
    assert.equal(table, null, `${JSON.stringify(absent)} is not a table`);
    assert.deepEqual(effectsForAnimation(table, { firstFrame: 1, lastFrame: 9 }), []);
  }
});

/* ------------------------------------------------------------------ */
/* Which pose throws it                                                */
/* ------------------------------------------------------------------ */

test("a clip frame becomes a POSE INDEX, and frames outside the animation are ignored", () => {
  const table = tableOf({ 1201: [{ prop: "blood", count: 6 }], 1300: [{ prop: "blood", count: 9 }] });
  const animation = { firstFrame: 1201, lastFrame: 1218, poses: new Array(18) };
  const effects = effectsForAnimation(table, animation);
  assert.equal(effects.length, 1, "only the frame inside this animation");
  assert.equal(effects[0].poseIndex, 0, "1201 - 1201");
  assert.equal(effects[0].prop, "blood");

  const later = effectsForAnimation(tableOf({ 1204: [{ prop: "blood", count: 6 }] }), animation);
  assert.equal(later[0].poseIndex, 3, "1204 - 1201, which is where hurt5 actually throws");
});

test("the POSE COUNT comes back with the effect, because `poses` is an ARRAY", () => {
  // ► **THIS IS A DEFECT THAT SHIPPED INTO THE SHELL AND FIRED NOTHING.**
  //   `animation.poses` is the array of poses, not a count, so the first
  //   integration computed `at * [object Array]` = NaN, every comparison
  //   against it was false, and no blood ever appeared. **A silent no-blood
  //   looks exactly like a correct bout**, which is why the count is returned
  //   here rather than left for each caller to take the length of.
  const animation = { firstFrame: 100, lastFrame: 110, poses: new Array(11) };
  const [effect] = effectsForAnimation(tableOf({ 105: [{ prop: "blood", count: 3 }] }), animation);
  assert.equal(effect.poseCount, 11);
  assert.equal(typeof effect.poseCount, "number", "a NUMBER, which is the whole point");

  // An animation with no pose array reports null rather than 0: "not stated" is
  // a different fact from "no poses", and a caller dividing by it must see the
  // difference.
  const bare = effectsForAnimation(tableOf({ 105: [{ prop: "blood", count: 3 }] }), { firstFrame: 100, lastFrame: 110 });
  assert.equal(bare[0].poseCount, null);
});

test("effects come back in POSE ORDER, whatever order the table was written in", () => {
  const table = tableOf({ 108: [{ prop: "blood", count: 3 }], 102: [{ prop: "sparks", count: 3 }] });
  const effects = effectsForAnimation(table, { firstFrame: 100, lastFrame: 110, poses: new Array(11) });
  assert.deepEqual(effects.map((e) => e.poseIndex), [2, 8], "ascending, so a caller can fire them in a sweep");
});

/* ------------------------------------------------------------------ */
/* The spray                                                           */
/* ------------------------------------------------------------------ */

test("FIVE drops per call whatever the count argument, because the build's loop says so", () => {
  // ► **AND THE COUNT IS A DEPTH, NOT A COUNT.** `bounceitem(whichitem,
  //   blood_drops)` runs `i` from 1 to 5 unconditionally (+0x0116) and uses the
  //   second argument only as `blooddepth = 45300 + blood_drops` (+0x0155).
  //   Read as counts, the extracted 3/6/9/15 say a power hit bleeds three times
  //   a quick one — a nice story, and not what the bytes do.
  for (const seed of [0, 1, 99]) {
    assert.equal(spawnDrops({ seed }).length, 5, `seed ${seed}`);
  }
});

test("armour strikes SPARKS and flesh BLEEDS", () => {
  // `bounceitem` branches on `armourclass > 0` (+0x018e hero, +0x021d villain).
  // This engine's own ingress decrements armour before hitpoints, so the input
  // was already there.
  assert.equal(spawnDrops({ seed: 1, armoured: true })[0].prop, "sparks");
  assert.equal(spawnDrops({ seed: 1, armoured: false })[0].prop, "blood");
  assert.equal(spawnDrops({ seed: 1 })[0].prop, "blood", "unarmoured is the default");
});

test("every drop differs, and the SAME seed sprays the same way every replay", () => {
  // ► **THE BUILD DRAWS FOUR SAMPLES PER DROP AND A RENDERER HERE MAY NOT** —
  //   the only RNG this engine has is the resolver's ordered channel, and that
  //   channel IS the wire format. So the spread is the build's and the source
  //   is the caller's own seed.
  const spray = spawnDrops({ seed: 7, frames: 9 });
  const signatures = spray.map((d) => `${d.y}|${d.xspeed}|${d.dy}|${d.rotationSpeed}`);
  assert.equal(new Set(signatures).size, 5, "five DIFFERENT drops, not one repeated five times");

  const again = spawnDrops({ seed: 7, frames: 9 });
  assert.deepEqual(again, spray, "and the same seed is the same spray");
  assert.notDeepEqual(spawnDrops({ seed: 8, frames: 9 }), spray, "while a different one differs");

  // Every value inside the band the build declares.
  for (const drop of spray) {
    const { spawn } = SS2_DROP;
    assert.ok(drop.y >= spawn.y.base && drop.y < spawn.y.base + spawn.y.span, `y ${drop.y}`);
    assert.ok(drop.xspeed >= spawn.xspeed.base && drop.xspeed < spawn.xspeed.base + spawn.xspeed.span);
    assert.ok(drop.dy >= spawn.dy.base && drop.dy < spawn.dy.base + spawn.dy.span);
    assert.ok(drop.artFrame >= 1 && drop.artFrame <= 9, "and the art frame is 1-based and in range");
  }
});

test("dropRandom spreads across the whole span and never leaves it", () => {
  const seen = new Set();
  for (let seed = 0; seed < 400; seed += 1) seen.add(dropRandom(seed, 10));
  assert.equal(seen.size, 10, "every value in 0..9 is reachable");
  for (const value of seen) assert.ok(value >= 0 && value < 10);
  assert.equal(dropRandom(5, 0), 0, "a zero span is zero, not NaN");
  assert.equal(dropRandom(5, -3), 0);
});

/* ------------------------------------------------------------------ */
/* The flight                                                          */
/* ------------------------------------------------------------------ */

test("a drop falls under gravity 2, is slowed by friction, and is REMOVED at 25 frames", () => {
  const drop = { prop: "blood", artFrame: 1, y: -100, xspeed: 20, dy: -10, rotationSpeed: 10 };

  // Step one, by hand against the build's order: bounce test (not triggered,
  // y < 0), then y += dy, x += xspeed, friction, gravity.
  const one = dropAt(drop, 1);
  assert.equal(one.y, -110, "y += dy");
  assert.equal(one.x, 20, "x += xspeed");

  // Gravity accumulates: after two steps dy is -10 then -8, so y is -110 - 8.
  assert.equal(dropAt(drop, 2).y, -118);

  // Friction pulls xspeed toward zero, so the second step travels LESS far.
  assert.ok(dropAt(drop, 2).x - one.x < 20, "friction (+0x03c0)");

  assert.ok(dropAt(drop, SS2_DROP.lifeFrames), "still alive at exactly 25 — the test is `counter > 25`");
  assert.equal(dropAt(drop, 26), null, "and removed at 26 — the build removes rather than fading");
  assert.throws(() => dropAt(null, 1), ClipEffectsError);
});

test("a drop BOUNCES off the ground, which is what the function is named for", () => {
  // `if (_y > 0) dy *= -0.4` (+0x035f). Screen y is DOWN, so y > 0 is below the
  // ground line and the drop is sent back up at 40% of its speed.
  const drop = { prop: "blood", artFrame: 1, y: 1, xspeed: 0, dy: 10, rotationSpeed: 0 };
  const after = dropAt(drop, 1);
  // dy 10 -> -4 on the bounce, so y goes 1 - 4 = -3: back above the ground.
  assert.equal(after.y, -3, "reversed at 40% and travelled back up");
  assert.ok(after.y < drop.y, "a bounce moves it the other way");

  // A drop still in the air does NOT bounce.
  const airborne = { prop: "blood", artFrame: 1, y: -50, xspeed: 0, dy: 10, rotationSpeed: 0 };
  assert.equal(dropAt(airborne, 1).y, -40, "no bounce above the ground: y += dy, unreversed");
});

test("a drop tumbles while it lives, and its rotation is radians", () => {
  const drop = { prop: "blood", artFrame: 1, y: -100, xspeed: 0, dy: 0, rotationSpeed: 36 };
  assert.equal(Math.round((dropAt(drop, 1).rotation * 180) / Math.PI), 36, "one step is one rotationSpeed");
  assert.equal(Math.round((dropAt(drop, 5).rotation * 180) / Math.PI), 180, "and it accumulates");
  assert.equal(dropAt(drop, 0).rotation, 0, "nothing has happened at frame 0");
});

test("frame 0 is the spawn state, and a negative frame is not the future", () => {
  const drop = { prop: "blood", artFrame: 4, y: -77, xspeed: 5, dy: -3, rotationSpeed: 9 };
  const start = dropAt(drop, 0);
  assert.equal(start.y, -77, "the spawn y, untouched");
  assert.equal(start.x, 0, "and x is an OFFSET from wherever the caller anchors the spray");
  assert.equal(start.artFrame, 4, "carrying its own art frame through");
  assert.deepEqual(dropAt(drop, -5), start, "a negative frame clamps to the spawn");
});
