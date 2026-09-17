/**
 * THE CHARGED STANCE — what a gladiator holds between actions.
 *
 * WHY THIS FILE EXISTS: the idle pose was two lines inside the browser shell's
 * draw loop, so "which pose does a gladiator rest in" was a decision the suite
 * could not reach and nothing had ever asked. The build's answer is not
 * `Standing` for everyone.
 *
 * WHAT IS THE BUILD'S AND WHAT IS THIS ENGINE'S:
 *
 * - **The build's**, in `changeCombatants` (overlay frame 52,
 *   `DoAction@0x240c7f`, anonymous function at `+0x27a6`): both fighters are
 *   reset with `gotoAndPlay("Standing")` (`+0x27db`, `+0x27ef`) and then
 *   whichever holds a charge is overridden with `gotoAndStop` — counter 2 to
 *   `psyche_charging` (`+0x281e` attacker, `+0x287c` defender), counter 3 to
 *   `psyche_charging2` (`+0x284d`, `+0x28ab`). `gotoAndStop`, so ONE frame.
 * - **This engine's**: the two authored fallback poses, the decision to derive
 *   the stance at the draw site rather than push it down the presentation
 *   stream, and holding `at` at 0.
 */
import assert from "node:assert/strict";
import nodeFs from "node:fs";
import nodePath from "node:path";
import { fileURLToPath as toPath } from "node:url";
import test from "node:test";

import { clipLabelsFor } from "../src/render/clip-labels.js";
import { animationFor, figureEffectGroupsFor, figurePackFrom } from "../src/render/extracted-figure.js";
import { chooseSound, soundLabelsFor } from "../src/render/sound.js";
import {
  STANCE_CLIPS,
  STANCE_RESOURCE,
  StanceError,
  allStanceLabels,
  idleFrameFor,
  isStanceFamily,
  stanceFamiliesCover,
  stanceLabelFor
} from "../src/render/stance.js";
import { SS2_PSYCHE_UP } from "../src/team/ss2-rules.js";
import { poseAt, timelineFor } from "../src/render/timeline.js";

function readRealPack(relative) {
  const at = nodePath.join(toPath(new URL("..", import.meta.url)), relative);
  return nodeFs.existsSync(at) ? JSON.parse(nodeFs.readFileSync(at, "utf8")) : null;
}
const REAL_SHAPES = readRealPack("assets/figure/shapes.json");
const REAL_ANIMATIONS = readRealPack("assets/figure/animations.json");
const REAL_PACK = REAL_SHAPES && REAL_ANIMATIONS ? figurePackFrom(REAL_SHAPES, REAL_ANIMATIONS) : null;

/** A combatant as `toTeamWireState` projects one, carrying only what matters here. */
const charged = (value) => ({
  id: "hero",
  alive: true,
  resources: value === null ? {} : { [STANCE_RESOURCE]: { value, min: 0, max: null } }
});

/* ------------------------------------------------------------------ *
 * WHICH POSE
 * ------------------------------------------------------------------ */

test("A CHARGED GLADIATOR DOES NOT STAND IN `Standing`, which is the whole finding", () => {
  assert.equal(stanceLabelFor(charged(2)), "psyche_charging");
  assert.equal(stanceLabelFor(charged(3)), "psyche_charging2");
  assert.equal(idleFrameFor(charged(2), { now: 4321 }).label, "psyche_charging");
  assert.equal(idleFrameFor(charged(3), { now: 4321 }).label, "psyche_charging2");
});

test("THE FLOOR IS NOT A CHARGE, and neither is a value the build cannot reach", () => {
  // ► **1 IS THE FLOOR AND IT MUST NOT POSE.** Both of the build's resets write
  //   1 — `nextphase` on any other decision, `damagecharacter` on the defender
  //   of a landed blow — so 1 is the state every uncharged gladiator is in. A
  //   stance at 1 would put the whole roster in the charged pose.
  assert.equal(stanceLabelFor(charged(1)), null);
  assert.equal(idleFrameFor(charged(1), { now: 0 }).label, "Standing");

  // The build tests EQUALITY against two constants, so nothing outside {2,3}
  // poses. 4 is unreachable — at 3 the next press discharges — and a range
  // check (`>= 2`) would have posed it anyway.
  assert.equal(stanceLabelFor(charged(4)), null);
  assert.equal(stanceLabelFor(charged(0)), null, "a below-floor value is fresh, not charged");
  assert.equal(stanceLabelFor(charged(2.5)), null);
});

test("AN ABSENT COUNTER IS NOT A ZERO, and every golden's gladiator has one absent", () => {
  // ► **`psyche_up` HAS NO `SS2_RESOURCE_DEFAULTS` ENTRY, deliberately** — a
  //   defaulted name moves all 23 golden replay hashes — so a combatant carries
  //   the resource only when its record states one. If `undefined` threw, or
  //   posed, every golden combatant would be affected the moment it was drawn.
  assert.equal(stanceLabelFor(charged(null)), null);
  assert.equal(stanceLabelFor({}), null);
  assert.equal(stanceLabelFor(null), null);
  assert.equal(stanceLabelFor(undefined), null);
  assert.equal(idleFrameFor({}, { now: 0 }).label, "Standing");
});

/* ------------------------------------------------------------------ *
 * HELD, NOT PLAYED
 * ------------------------------------------------------------------ */

test("A STANCE IS HELD AT 0 AND THAT IS THE `gotoAndStop`", () => {
  // ► **RUNNING A CLOCK OVER IT WOULD ANIMATE A POSE THE BUILD FREEZES.** With
  //   the extracted pack, `psyche_charging` is nine frames; `at` chases
  //   `poseIndexAt` across all nine, so a moving `at` plays the charge as a
  //   loop rather than holding the frame `gotoAndStop` leaves the playhead on.
  for (const now of [0, 137, 4321, 999999]) {
    assert.equal(idleFrameFor(charged(2), { now }).at, 0, `held at ${now}ms`);
  }
  // The ordinary idle DOES breathe, and on the caller's clock.
  const standing = timelineFor("Standing", { role: "actor" });
  assert.equal(idleFrameFor(charged(1), { now: 0 }).at, 0);
  assert.notEqual(idleFrameFor(charged(1), { now: standing.durationMs / 2 }).at, 0);
  assert.equal(idleFrameFor(charged(1), { now: standing.durationMs }).at, 0, "and it wraps");
});

test("`now` IS AN ARGUMENT, so the idle's phase is reachable rather than wall-clock", () => {
  // A module that read the clock itself could not be asked where in the cycle
  // it is, which is the whole reason this decision left the shell.
  const standing = timelineFor("Standing", { role: "actor" });
  assert.equal(idleFrameFor(charged(1), { now: standing.durationMs / 4 }).at, 0.25);
  // A caller that passes nothing gets the start of the cycle, not NaN.
  assert.equal(idleFrameFor(charged(1)).at, 0);
  assert.equal(idleFrameFor(charged(1), { now: Number.NaN }).at, 0);
  assert.equal(idleFrameFor(charged(1), { now: Number.POSITIVE_INFINITY }).at, 0);
  // ► **AND A NEGATIVE `now`, which this guard used to let straight through.**
  //   `%` keeps the sign of the dividend, so `now = -500` gave `at = -0.347`
  //   while the docstring promised normalisation. `poseAt` clamps it, so
  //   nothing drew wrongly — the promise was what was broken. Found by a
  //   verifier; unreachable from `performance.now()`, which is the reason to
  //   fix the guard rather than to trust the caller.
  assert.equal(idleFrameFor(charged(1), { now: -500 }).at, 0);
  assert.equal(idleFrameFor(charged(1), { now: Number.NEGATIVE_INFINITY }).at, 0);
});

test("A CORPSE HAS NO STANCE, even one that died holding a charge", () => {
  // ► **THE SHELL GUARDS THIS AND THAT WAS THE WHOLE DEFENCE.** `render` takes
  //   the `!combatant.alive` branch to the death pose before it ever asks for
  //   an idle, so a verifier had to hand-forge a dead-and-charged combatant to
  //   expose it — and got `psyche_charging` back. One call site is not a
  //   contract, and a glowing corpse braced for a blow is a wrong picture with
  //   no error.
  const deadAndCharged = { id: "hero", alive: false, resources: { [STANCE_RESOURCE]: { value: 3 } } };
  assert.equal(stanceLabelFor(deadAndCharged), "psyche_charging2", "the counter is still readable");
  assert.equal(idleFrameFor(deadAndCharged, { now: 0 }).label, "Standing",
    "but the dead hold no stance");
  // Absent `alive` is NOT dead: most of this module's callers pass a projection
  // that always carries it, but a fixture that omits it must still pose.
  assert.equal(idleFrameFor({ resources: { [STANCE_RESOURCE]: { value: 3 } } }, { now: 0 }).label,
    "psyche_charging2");
  assert.equal(idleFrameFor({ alive: true, resources: { [STANCE_RESOURCE]: { value: 3 } } }, { now: 0 }).label,
    "psyche_charging2");
});

test("the held pose is CONSTANT, so nothing can make it drift by moving `at`", () => {
  // Belt and braces with the `at` of 0 above: one keyframe means every `at`
  // interpolates to the same pose, so a surface that ignored `at` — or a future
  // one that tweened into the stance — still rests where the build rests.
  const { timeline } = idleFrameFor(charged(2), { now: 0 });
  assert.equal(timeline.keyframes.length, 1);
  assert.deepEqual(poseAt(timeline, 0), poseAt(timeline, 0.5));
  assert.deepEqual(poseAt(timeline, 0), poseAt(timeline, 1));
  assert.equal(timeline.loop, true, "an idle loops; it does not end and hand back");
});

test("THE TWO LEVELS DO NOT READ ALIKE, which is why they are two families", () => {
  const one = idleFrameFor(charged(2), { now: 0 }).timeline;
  const two = idleFrameFor(charged(3), { now: 0 }).timeline;
  assert.equal(one.family, "stance:psyche");
  assert.equal(two.family, "stance:psyche2");
  assert.notDeepEqual(poseAt(one, 0), poseAt(two, 0), "a deeper charge must look deeper");
  // And the deeper one is braced further: lower, wider, wound further in.
  assert.ok(poseAt(two, 0).bob < poseAt(one, 0).bob);
  assert.ok(poseAt(two, 0).legSpread > poseAt(one, 0).legSpread);
});

/* ------------------------------------------------------------------ *
 * THE JOINS
 * ------------------------------------------------------------------ */

test("every stance label resolves through its own family, or the pack is ignored silently", () => {
  // ► **MEMBERSHIP IS THE GUARD IN `animationFor`**, so a stance whose family
  //   does not list its own label falls back to authored art on a machine that
  //   HAS the extraction — a wrong picture with no error anywhere.
  assert.equal(stanceFamiliesCover(), true);
  for (const { label, family } of STANCE_CLIPS.values()) {
    assert.ok(clipLabelsFor(family).includes(label), `${family} must list ${label}`);
    assert.equal(timelineFor(label).family, family);
    assert.equal(timelineFor(label).recognised, true);
  }
  assert.deepEqual(allStanceLabels(), ["psyche_charging", "psyche_charging2"]);
});

test("THE STANCE KEYS ARE COUPLED TO THE COUNTER, or the two drift in silence", () => {
  // ► **NOTHING TIED THESE TWO HALVES TOGETHER AND A VERIFIER SAID SO.** The
  //   stance table keys on 2 and 3; `SS2_PSYCHE_UP` owns the floor (1) and the
  //   discharge point (3). Raise the floor to 2, or `dischargeAt` to 4, and
  //   `STANCE_CLIPS` goes stale — posing an uncharged gladiator, or posing
  //   nobody — **with all of this file's other tests still green**, because it
  //   imported nothing from the rule set and `test/ss2-psyche-up.test.js`
  //   imports no stance function. This is the edge that was missing.
  //
  //   The charged states are exactly the values strictly above the floor and at
  //   most the discharge point: with floor 1 and dischargeAt 3, that is {2, 3}.
  const chargedValues = [];
  for (let value = SS2_PSYCHE_UP.floor + 1; value <= SS2_PSYCHE_UP.dischargeAt; value += 1) {
    chargedValues.push(value);
  }
  assert.deepEqual([...STANCE_CLIPS.keys()], chargedValues,
    "the stance table must key on exactly the counter's charged states");
  // And the floor itself is never a stance, which is the other half of the same
  // fact: a gladiator who has taken any other turn sits at the floor.
  assert.equal(stanceLabelFor(charged(SS2_PSYCHE_UP.floor)), null);
  assert.ok(stanceLabelFor(charged(SS2_PSYCHE_UP.dischargeAt)) !== null,
    "a fully charged gladiator must be posed");
});

test("THE UNCHARGED SET IS {0, 1}, because the arena's own roster authors 0", () => {
  // ► **`tools/arena/roster.js` STATES `psyche_up: 0`**, below the build's
  //   floor of 1, and the rule set reconciles it with `Math.max(floor, stated)`
  //   at press time rather than at authoring time — so an arena gladiator
  //   really does hold 0 until his first press, and that press takes him
  //   straight to 2. This module's header argued only about 1.
  for (const value of [0, 1]) {
    assert.equal(stanceLabelFor(charged(value)), null, `${value} is not a charge`);
  }
});

test("A STANCE IS SILENT, and the build's own bindings are not what makes it so", () => {
  // Both charging clips carry no `StartSound`, so this changes nothing on the
  // shipped build — which is exactly why the policy is written down rather than
  // relied upon. It would change the day someone bound one.
  assert.ok(isStanceFamily("stance:psyche"));
  assert.equal(isStanceFamily("psyche"), false);
  assert.deepEqual(soundLabelsFor("stance:psyche"), []);
  assert.equal(chooseSound({ psyche_charging: ["1194.mp3"] }, "stance:psyche", 0, "psyche_charging"), null,
    "even a bound stance stays silent: the psych-up sound already played on the action");
});

test("a stance label with no family FAILS LOUDLY rather than resting in `unknown`", () => {
  // Unreachable while `clip-labels.js` and `timeline.js` agree. It throws
  // because the alternative is a charged gladiator resting in the `unknown`
  // schedule, which looks like an ordinary idle and is a pose nothing chose.
  const orphan = { resources: { [STANCE_RESOURCE]: { value: 2 } } };
  assert.equal(idleFrameFor(orphan, { now: 0 }).label, "psyche_charging");
  assert.throws(() => {
    // The guard by hand, since the real tables are frozen and agree.
    const timeline = timelineFor("psyche_not_a_clip", { role: "actor" });
    if (!timeline.recognised) throw new StanceError("no family");
  }, StanceError);
});

/* ------------------------------------------------------------------ *
 * AGAINST THE REAL PACK
 * ------------------------------------------------------------------ */

test("THE CHARGED GLADIATOR GLOWS, and that is the resource made visible", () => {
  if (!REAL_PACK) {
    assert.equal(REAL_PACK, null, "no extraction on this machine");
    return;
  }
  // ► **THIS IS THE FIRST TIME ANY FIGURE EFFECT GROUP REACHES A RESTING
  //   GLADIATOR.** `tools/arena/main.js` recorded, measured 2026-09-15, that
  //   `figureEffectGroupsFor` returns ZERO group records for every psyche label
  //   at every `at` — true then, because nothing dispatched a psyche clip. The
  //   stance holds one every frame a charge is banked.
  for (const value of [2, 3]) {
    const idle = idleFrameFor(charged(value), { now: 0 });
    const groups = figureEffectGroupsFor(REAL_PACK, {
      family: idle.timeline.family, label: idle.label, at: idle.at, height: 1
    });
    assert.equal(groups.length, 1, `counter ${value} must draw its glow`);
    // ► **THE RECORD MUST CARRY A REAL FILTER STRING, not just exist.** A
    //   group with `filter: null` would satisfy a count and draw nothing, which
    //   is the shape of "the feature works over a population of zero" this
    //   project has now recorded twice.
    assert.match(groups[0].filter, /^drop-shadow\(/, `counter ${value}'s group must carry a CSS filter`);
    assert.match(groups[0].filter, /rgba\(0, 255, 255, 1\)/, "and the psych-up glow is cyan");
    assert.equal(groups[0].character, 1195, "drawn from the build's own `guard_charge` sprite");
  }
  // The control: an uncharged gladiator's idle carries none.
  const plain = idleFrameFor(charged(1), { now: 0 });
  assert.equal(figureEffectGroupsFor(REAL_PACK, {
    family: plain.timeline.family, label: plain.label, at: plain.at, height: 1
  }).length, 0);
});

test("the stance draws ONE frame of the build's clip, not the run", () => {
  if (!REAL_PACK) {
    assert.equal(REAL_PACK, null, "no extraction on this machine");
    return;
  }
  // ► **`psyche_charging` IS NOT A SEQUENCE ENTRY AND MUST NOT BECOME ONE.** It
  //   is the TAIL of `psyche_up`'s run; entering at it plays it alone, which is
  //   what `gotoAndStop` does more strongly still. If `clip-sequences.js` ever
  //   gained an entry for it, a resting gladiator would hold a concatenation.
  const idle = idleFrameFor(charged(2), { now: 0 });
  const { label, animation } = animationFor(REAL_PACK, { family: idle.timeline.family, label: idle.label });
  assert.equal(label, "psyche_charging");
  assert.equal(animation.poses.length, 9, "its own nine frames, and no continuation");
  assert.equal(animation.playsSequence, undefined);
  // And the frame shown is the FIRST one, which is frame 1618 in the build.
  assert.equal(animation.firstFrame, 1618);
});

test("THE GLOW RADIUS FOLLOWS THE SCALE, which is the test `filtersScaled` waited for", () => {
  if (!REAL_PACK) {
    assert.equal(REAL_PACK, null, "no extraction on this machine");
    return;
  }
  // ► **`tools/arena/main.js` SET THIS CONDITION AND COULD NOT MEET IT.**
  //   `figureRouteFor()` returned `filtersScaled: false` with the reason
  //   written out: *"`figureEffectGroupsFor` returns ZERO group records for
  //   every psyche label at every `at`, so there is no figure filter string in
  //   this repository to read at two scales and compare, and
  //   `filtersScaled: true` would be an assertion no test could go red on.
  //   Flip it in the commit that makes a figure group observable, beside a test
  //   that reads two `figureEffectGroupsFor` results at two scales and asserts
  //   the radius moved."* This is that test, and the stance is what made it
  //   possible: the glow is now on a RESTING gladiator, every frame.
  //
  // ► **AND THE FAMILY IS WHAT SELECTS THE CLIP HERE, NOT THE LABEL** — a
  //   verifier measured that `animationFor(pack, {family: "stance:psyche",
  //   label: X})` resolves to `psyche_charging` for EVERY `X` it tried,
  //   including `"Standing"`, because the family holds one clip and wins. So
  //   passing the label proves nothing, and this test varies the FAMILY to show
  //   the two levels really are two different glows.
  const radiiAt = (family, scale) => {
    const [group] = figureEffectGroupsFor(REAL_PACK, { family, at: 0, height: 1, scale });
    return [...group.filter.matchAll(/drop-shadow\(0px 0px ([\d.]+)px/g)].map((match) => Number(match[1]));
  };
  // The two charge levels carry DIFFERENT radii, so a renderer that collapsed
  // them into one clip would be visibly wrong rather than merely imprecise.
  assert.notDeepEqual(radiiAt("stance:psyche", 1), radiiAt("stance:psyche2", 1));
  assert.equal(radiiAt("stance:psyche", 1)[1].toFixed(4), "4.2742", "the first charge's outer glow");
  assert.equal(radiiAt("stance:psyche2", 1)[1].toFixed(4), "2.5208", "the deeper charge's is tighter");
  const one = radiiAt("stance:psyche", 1);
  assert.equal(one.length, 2, "the psych-up glow is two drop-shadows, inner and outer");
  // ► **LINEAR IN THE SCALE, WHICH IS WHAT "ARRIVES IN DEVICE PIXELS" MEANS.**
  //   The shell passes `(origin.size ?? 1) * view.scale`, exactly the factor its
  //   CTM carries, so a radius that tracks the argument is a radius already in
  //   the space the canvas draws in.
  for (const scale of [2, 4, 0.5]) {
    const scaled = radiiAt("stance:psyche", scale);
    scaled.forEach((radius, index) => {
      assert.ok(Math.abs(radius - one[index] * scale) < 1e-3,
        `radius ${index} at scale ${scale}: expected ${one[index] * scale}, got ${radius}`);
    });
  }
  // The assertion that could have varied: a radius that IGNORED the argument
  // would pass a "two scales differ" check written carelessly, so this pins
  // that they differ BY THE FACTOR.
  assert.notEqual(radiiAt("stance:psyche", 2)[1], one[1]);
});
