/**
 * THE BOULDERS — molten death's shower, from the resolved event to the pixel.
 *
 * Until 2026-09-23 a molten death drew NOTHING: the caster played `Cast2`, the
 * victim's death clip started on the same clock, and not one rock fell. The
 * owner watched it as "dying immediately after one hit and no spell
 * animations". The resolver had carried every boulder's numbers on the event
 * since the day the verb was built — `boulders[]` "FOR A RENDERER" — and no
 * command presented them.
 *
 * The arm, from `SS2_DEATH_FROM_ABOVE` in `src/team/ss2-rules.js`:
 *
 * ```text
 *   attacker.gotoAndPlay("Cast2")                                   +0x86d8
 *   for (i = 1; !(i > boulder_stones); i++) {
 *     boulder = arena.gladiators.attachMovie("boulder_combat", ...,
 *         {_x: defender._x, _y: -600})                              +0x870f
 *     boulder._x += randomBetween(-300, 300)                        +0x878b
 *     boulder._y  = randomBetween(-600, -800)                       +0x87a9
 *     boulder.yspeed = randomBetween(50, 150)                       +0x87c8
 *     boulder._xscale = boulder._yscale = randomBetween(50, 100)    +0x87f1
 *     boulder.onEnterFrame = function () {                          +0x882f
 *       if (!(this._y > 150)) this._y += this.yspeed
 *       if (this._y > 150 && this.bounced != true) {
 *         bounced = true; gotoAndStop(4)
 *         magic_damage_character(defender, ..., "burning", 4, 40)   +0x88e5
 *       }
 *     }
 *   }
 * ```
 *
 * Four seams, each tested here: the COMMAND the presentation layer emits, the
 * SCENE that folds it, WHEN the victim reacts, and the ARITHMETIC that says
 * where each rock is. `tools/arena/main.js` only paints.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, lastResolvedAction, toTeamWireState
} from "../src/team/index.js";
import { Ss2ActionType, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import {
  buildArenaLayout, CommandKind, presentResolvedEvents, SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import {
  applyCommands, BOULDER_LANDED_FRAMES, boulderDrawAt, boulderLandedFramesFor, boulderOpsFor, boulderOutline,
  emptyScene, PROJECTILE_FRAME_MS, propPackFrom, reactionDelaysFor, timelinesForStep
} from "../src/render/index.js";

const MOLTEN = Ss2ActionType.CAST_DEATH_FROM_ABOVE;

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

/** 40 * 10 + 40 * 20 = 1,200 HP: survives every boulder a shower can hold. */
const TOUGH = Object.freeze({ vitality: 40, herolevel: 40 });
/**
 * `hitpointsmax = herolevel * 10 + vitality * 20` = 50 + 280 = 330 and no
 * armour, so eight hits of 40 (320) leave it standing and the NINTH kills.
 */
const NINE_HITS = Object.freeze({ vitality: 14 });

/**
 * Ten boulders with LITERAL numbers, so every expectation below is worked by
 * hand from the build's own closure rather than recomputed the way the code
 * does it. `floor((150 - y0) / ySpeed) + 1`:
 *
 * - boulder 1: y0 -601, speed 50  -> floor(751 / 50)  + 1 = 16
 * - boulder 3: y0 -700, speed 100 -> floor(850 / 100) + 1 = 9
 * - the other eight: y0 -601, speed 150 -> floor(751 / 150) + 1 = 6
 *
 * Landing order (ties by index): 2, 4, 5, 6, 7, 8, 9, 10, 3, 1 — so the ninth
 * hit is boulder 3, on frame 9, and the first lands on frame 6.
 */
function showerTape() {
  const samples = [
    { label: "death-from-above-boulder-count", source: "randomBetween", min: 10, max: 20, value: 10 }
  ];
  for (let i = 1; i <= 10; i += 1) {
    const b = i === 1
      ? { x: -300, y: -601, yspeed: 50, scale: 50 }
      : i === 3
        ? { x: 300, y: -700, yspeed: 100, scale: 100 }
        : { x: i, y: -601, yspeed: 150, scale: 60 + i };
    samples.push(
      { label: `death-from-above-boulder-${i}-x`, source: "randomBetween", min: -300, max: 300, value: b.x },
      { label: `death-from-above-boulder-${i}-y`, source: "randomBetween", min: -799, max: -601, value: b.y },
      { label: `death-from-above-boulder-${i}-yspeed`, source: "randomBetween", min: 50, max: 150, value: b.yspeed },
      { label: `death-from-above-boulder-${i}-scale`, source: "randomBetween", min: 50, max: 100, value: b.scale }
    );
  }
  return samples;
}

/** The caster opens at x -60 facing right; the victim stands at x 440, depth `foeY`. */
function shower({ foe = TOUGH, foeY = 200 } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    rngTape: showerTape(),
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(fields({ speed: 21, inventory1: 49 }), { id: "hero", name: "hero", controller: "local" })]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller: "local" })]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: 440, y: foeY });
  applyAction(battle, { actorId: "hero", type: MOLTEN, targetId: "foe" });
  const token = lastResolvedAction(battle).firstEventSequence;
  const wire = toTeamWireState(battle);
  const layout = buildArenaLayout(wire);
  const presented = presentResolvedEvents(wire, {
    layout, bindings: SS2_STATIC_MAP_BINDINGS, actionBoundaries: [token]
  });
  return { battle, token, ...presented };
}

const bouldersOf = (commands) => commands.filter((command) =>
  command.kind === CommandKind.ATTACH_EFFECT && command.effect === "boulder_combat");

/* ------------------------------------------------------------------ *
 * The command                                                         *
 * ------------------------------------------------------------------ */

test("a presented shower attaches ONE `boulder_combat` per boulder, from the event's own numbers", () => {
  const { commands, token } = shower();
  const boulders = bouldersOf(commands);
  assert.equal(boulders.length, 10, "`boulder_stones` attachMovie calls, one per boulder");
  // Draw order, as the build's loop attaches them: i = 1..N.
  assert.deepEqual(boulders.map((command) => command.boulder), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const [first, , third, , fifth] = boulders;
  assert.equal(first.casterId, "hero");
  assert.equal(first.targetId, "foe");
  // `_x: defender._x` then `_x += randomBetween(-300, 300)`: 440 - 300.
  assert.equal(first.x, 140);
  assert.equal(third.x, 740, "440 + 300");
  assert.equal(fifth.x, 445, "440 + 5");
  assert.equal(first.y, 200, "the victim's own depth: the build has none, and the bolt's rule applies");
  assert.deepEqual(first.fall, { y0: -601, ySpeed: 50, scale: 50, landingFrame: 16 });
  assert.deepEqual(third.fall, { y0: -700, ySpeed: 100, scale: 100, landingFrame: 9 });
  assert.deepEqual(fifth.fall, { y0: -601, ySpeed: 150, scale: 65, landingFrame: 6 });
  for (const boulder of boulders) {
    assert.equal(boulder.actionToken, token, "every rock belongs to the cast that dropped it");
    assert.equal(boulder.lethal, false, "a shower the victim survives has no killing rock");
  }
});

test("the boulders drop AFTER the caster's Cast2 and BEFORE the victim's burn, as the build orders them", () => {
  const { commands } = shower();
  const order = commands
    .filter((command) => command.kind === CommandKind.CLIP_GOTO || command.kind === CommandKind.ATTACH_EFFECT)
    .map((command) => (command.kind === CommandKind.ATTACH_EFFECT ? command.effect : command.label));
  assert.deepEqual(order, ["Cast2", ...Array(10).fill("boulder_combat"), "burning"]);
});

test("on a kill, exactly one rock is the killing one: the ingress's own killing hit", () => {
  const { commands, battle } = shower({ foe: NINE_HITS });
  assert.equal(combatantById(battle, "foe").alive, false, "330 HP cannot survive nine hits of 40");
  const lethal = bouldersOf(commands).filter((command) => command.lethal);
  assert.deepEqual(lethal.map((command) => command.boulder), [3],
    "the ninth hit in landing order is boulder 3, on frame 9");
});

/* ------------------------------------------------------------------ *
 * The scene                                                           *
 * ------------------------------------------------------------------ */

test("the scene carries every rock as its own record, with its fall, touching no actor", () => {
  const { commands, token } = shower({ foe: NINE_HITS });
  const scene = applyCommands(emptyScene(), commands);
  const rocks = scene.effects.filter((record) => record.effect === "boulder_combat");
  assert.equal(rocks.length, 10);
  const third = rocks.find((record) => record.boulder === 3);
  assert.equal(third.x, 740);
  assert.equal(third.y, 200);
  assert.deepEqual(third.fall, { y0: -700, ySpeed: 100, scale: 100, landingFrame: 9 });
  assert.equal(third.lethal, true);
  assert.equal(third.actionToken, token);
  assert.equal(rocks.filter((record) => record.lethal).length, 1);
  // Batch-local, like the bolt: the next action does not inherit this shower.
  assert.equal(applyCommands(scene, []).effects.length, 0);
});

test("a bolt's scene record is exactly what it was: the boulder's fields are present only on a boulder", () => {
  const bolt = {
    kind: "attach-effect", sequence: 4, casterId: "hero", targetId: "foe", effect: "lightning_bolt_combat",
    frame: 1, x: 140, y: 200, endsWithClip: "lightning", actionToken: 4
  };
  const [record] = applyCommands(emptyScene(), [bolt]).effects;
  assert.deepEqual(Object.keys(record).sort(),
    ["actionToken", "casterId", "effect", "endsWithClip", "frame", "sequence", "targetId", "x", "y"]);
});

/* ------------------------------------------------------------------ *
 * When the victim reacts                                              *
 * ------------------------------------------------------------------ */

test("a KILLED victim burns when the FIRST rock lands and dies after it, not when the spell is cast", () => {
  // ► ~~dies when the killing rock lands~~ (300 ms here) was right while a
  //   kill's death REPLACED its reaction. Since the death is queued BEHIND the
  //   reaction (`timelinesForStep`'s `then`, 2026-09-23), the chain's first
  //   link is the burn, and the build's burn starts at the first landing —
  //   frame 6, 200 ms. The death follows the burn.
  const { commands } = shower({ foe: NINE_HITS });
  const delays = reactionDelaysFor(commands);
  assert.equal(delays.get("foe"), 6 * PROJECTILE_FRAME_MS);
  assert.equal(delays.get("foe"), 200);
  assert.equal(delays.has("hero"), false, "the caster's Cast2 starts with the cast");
  const chain = timelinesForStep(commands).started.get("foe");
  assert.deepEqual([chain.timeline.label, chain.then?.timeline.label], ["burning", "slain"],
    "the burn, then the death queued behind it");
});

test("a victim whose ONLY clip is its death dies when the killing rock lands", () => {
  // The ingress that kills runs inside boulder 3's own `onEnterFrame`, on its
  // ninth invocation — nine of the build's 30 fps frames after the attach. A
  // binding that names no reaction leaves the death first in the chain.
  const { commands } = shower({ foe: NINE_HITS });
  const deathOnly = commands.filter((command) => !(command.kind === "clip-goto" && command.role === "target"));
  assert.equal(reactionDelaysFor(deathOnly).get("foe"), 9 * PROJECTILE_FRAME_MS);
});

test("a victim that SURVIVES starts burning when the FIRST rock lands", () => {
  // Every landing calls `gotoAndPlay("burning")`; the first is on frame 6.
  const { commands } = shower();
  assert.equal(reactionDelaysFor(commands).get("foe"), 6 * PROJECTILE_FRAME_MS);
});

test("a bolt's victim still reacts at the cast: only a fireball and a boulder wait", () => {
  const bolt = {
    kind: "attach-effect", sequence: 4, casterId: "hero", targetId: "foe", effect: "lightning_bolt_combat",
    frame: 1, x: 140, y: 200, endsWithClip: "lightning", actionToken: 4
  };
  assert.equal(reactionDelaysFor([bolt]).size, 0);
});

/* ------------------------------------------------------------------ *
 * The arithmetic                                                      *
 * ------------------------------------------------------------------ */

const DEPS = Object.freeze({
  frontY: 200,
  rankStride: 97,
  figureScaleFor: ({ rank }) => 1 - 0.1 * rank,
  rankOfDepth: (depth, unused, { frontY, rankStride }) => Math.round((frontY - depth) / rankStride)
});

/** Boulder 3 of the tape: attached at x 740, `_y` -700, 100 a frame, full size, lands on frame 9. */
const rock = (overrides = {}) => ({
  effect: "boulder_combat", frame: 1, boulder: 3, x: 740, y: 200,
  fall: { y0: -700, ySpeed: 100, scale: 100, landingFrame: 9 }, lethal: false, ...overrides
});

test("a rock starts at its own `_y` and falls `yspeed` a frame: lift is 200 minus the build's `_y`", () => {
  // Fighters stand at `_y` 200 in `arena.gladiators`, the object the boulder
  // is attached to, so a boulder at `_y` -700 is 900 arena units above them.
  const at0 = boulderDrawAt(rock(), 0, DEPS);
  assert.equal(at0.x, 740);
  assert.equal(at0.y, 200);
  assert.equal(at0.lift, 900);
  assert.equal(at0.stage, "falling");
  assert.equal(at0.clipFrame, 1, "`Stop` on frame 1 until the closure's `gotoAndStop(4)`");
  assert.equal(at0.rotation, 0);
  // Three invocations of `_y += yspeed`: -700 + 300 = -400, so 600 above.
  assert.equal(boulderDrawAt(rock(), 100, DEPS).lift, 600);
  // Frame 8: -700 + 800 = 100, still not past 150.
  const at8 = boulderDrawAt(rock(), 8 * PROJECTILE_FRAME_MS + 1, DEPS);
  assert.equal(at8.lift, 100);
  assert.equal(at8.stage, "falling");
});

test("a rock over a BACK-RANK victim falls in that rank's scale, as the victim is drawn", () => {
  // The build has one rank; here a victim two ranks back is drawn at that
  // rank's depth scale (0.8 under these deps), and so is the rock's art. Its
  // LIFT must be too, or a rock resting on the fighters' line at the front
  // rests above it at the back. Authored, like every depth here: added
  // 2026-09-23 with the arrow's, after a Codex review found drawn projectiles
  // ignoring the depth scale their victims are drawn at.
  const back = rock({ y: 200 - 97 * 2 });
  assert.equal(boulderDrawAt(back, 0, DEPS).lift, 900 * 0.8, "900 up at the front, 720 at rank 2");
  assert.equal(boulderDrawAt(back, 0, DEPS).size, 0.8, "the art at the same scale — the rock's own `_xscale` is 100");
  const slow = rock({ y: 200 - 97 * 2, fall: { y0: -601, ySpeed: 50, scale: 50, landingFrame: 16 } });
  assert.ok(Math.abs(boulderDrawAt(slow, 16 * PROJECTILE_FRAME_MS + 1, DEPS, { landedFrames: Infinity }).lift - 0.8) < 1e-9,
    "and the lift ignores the rock's OWN scale, which sizes its art, not where it is");
});

test("it LANDS on its landing frame, at the `_y` its last step reached, and stays there", () => {
  // Frame 9: -700 + 900 = 200 > 150 — bounced, `gotoAndStop(4)`, and the move
  // is not taken again. So this rock rests on the fighters' own line.
  const kept = { landedFrames: Infinity };
  const landed = boulderDrawAt(rock(), 300, DEPS, kept);
  assert.equal(landed.stage, "landed");
  assert.equal(landed.clipFrame, 4);
  assert.equal(landed.lift, 0);
  assert.equal(landed.landedAgeFrames, 0, "the landing's own clock starts on the landing frame");
  const later = boulderDrawAt(rock(), 500, DEPS, kept);
  assert.equal(later.lift, 0, "no step after the bounce");
  assert.equal(later.landedAgeFrames, 6, "frame 15, six after the landing");
  // Boulder 1: -601 + 16 * 50 = 199, one unit above the line.
  const slow = rock({ fall: { y0: -601, ySpeed: 50, scale: 50, landingFrame: 16 } });
  assert.equal(boulderDrawAt(slow, 16 * PROJECTILE_FRAME_MS + 1, DEPS, kept).lift, 1);
  assert.equal(boulderDrawAt(slow, 15 * PROJECTILE_FRAME_MS + 1, DEPS, kept).stage, "falling");
});

test("its size is its own `_xscale` on top of its victim's rank", () => {
  assert.equal(boulderDrawAt(rock(), 0, DEPS).size, 1);
  const small = rock({ y: 103, fall: { y0: -601, ySpeed: 50, scale: 50, landingFrame: 16 } });
  assert.equal(boulderDrawAt(small, 0, DEPS).size, 0.45, "rank 1 (0.9) at 50%");
  assert.equal(boulderDrawAt(rock({ y: null }), 0, DEPS).y, 200, "a null depth draws at the front rank");
});

test("the FALL is what holds the action, and how long the landing stays is handed in, never invented", () => {
  // ► ~~"the landed rock stays an authored half-second and goes"~~ — that was
  //   an invented rubble, with a fade and a ring the build never drew; a Codex
  //   review flagged it 2026-09-23. The landing's lifetime is now the caller's
  //   to hand in, from what the pack can say (`boulderLandedFramesFor`).
  const falling = boulderDrawAt(rock(), 0, DEPS);
  assert.equal(falling.fallMs, 300, "nine frames at 30 fps");

  // No landing to show — the authored fallback's case — so it goes AS it lands.
  assert.equal(falling.lifetimeMs, 300, "the default shows no landing at all");
  assert.equal(boulderDrawAt(rock(), 299, DEPS).stage, "falling");
  const gone = boulderDrawAt(rock(), 300, DEPS);
  assert.equal(gone.done, true);
  assert.equal(gone.stage, "gone");

  // A landing three frames long: frames 9, 10 and 11 are shown, 12 is not.
  const three = { landedFrames: 3 };
  assert.equal(boulderDrawAt(rock(), 0, DEPS, three).lifetimeMs, 400);
  assert.equal(boulderDrawAt(rock(), 399, DEPS, three).landedAgeFrames, 2);
  assert.equal(boulderDrawAt(rock(), 400, DEPS, three).done, true);

  // A landing nothing removes stays for as long as the arena does.
  const forever = boulderDrawAt(rock(), 10 * 60 * 1000, DEPS, { landedFrames: Infinity });
  assert.equal(forever.done, false);
  assert.equal(forever.stage, "landed");
  assert.equal(forever.lifetimeMs, Infinity);
  assert.equal(forever.fallMs, 300, "and it still holds the action only for its fall");
});

/* ------------------------------------------------------------------ *
 * The build's own rock, when the pack carries it                      *
 * ------------------------------------------------------------------ */

const at = (shape) => ({ shape, matrix: [1, 0, 0, 1, 0, 0] });
const SHAPES = Object.freeze({
  1: { bounds: {}, paths: [{ d: "M0 0L1 1", fill: "#111111" }] },
  2: { bounds: {}, paths: [{ d: "M0 0L1 1", fill: "#222222" }] },
  3: { bounds: {}, paths: [{ d: "M0 0L1 1", fill: "#333333" }] },
  4: { bounds: {}, paths: [{ d: "M0 0L1 1", fill: "#444444" }] }
});
/** `boulder_combat` as `tools/extract-props.mjs` writes it, with a three-frame landing clock found on frame 4. */
const withLanding = () => propPackFrom({
  props: {
    boulder_combat: {
      frames: [[at(1)], [at(1)], [at(1)], [at(2)]],
      clock: {
        character: 931, discoveredOn: 4, frameCount: 3,
        framesByParent: [
          [[at(1)], [at(1)], [at(1)]], [[at(1)], [at(1)], [at(1)]], [[at(1)], [at(1)], [at(1)]],
          [[at(2)], [at(3)], [at(4)]]
        ]
      },
      clockDiscovery: { onFrame: 4, byFrame: [[], [], [], [931]] }
    }
  },
  shapes: SHAPES
});
/** The same prop with a STILL frame 4: nothing animated placed there. */
const stillLanding = () => propPackFrom({
  props: { boulder_combat: { frames: [[at(1)], [at(1)], [at(1)], [at(2)]], clockDiscovery: { onFrame: 4, byFrame: [[], [], [], []] } } },
  shapes: SHAPES
});
const fills = (ops) => ops.map((op) => op.fill);

test("the FALLING rock is frame 1 and the LANDING is frame 4, at the landing's own age, held on its last frame", () => {
  const pack = withLanding();
  assert.deepEqual(fills(boulderOpsFor(pack, 1, 0)), ["#111111"], "falling: frame 1");
  assert.deepEqual(fills(boulderOpsFor(pack, 4, 0)), ["#222222"], "landed: frame 4, age 0");
  assert.deepEqual(fills(boulderOpsFor(pack, 4, 2)), ["#444444"]);
  assert.deepEqual(fills(boulderOpsFor(pack, 4, 9)), ["#444444"], "an age past the clock holds its last frame");
  assert.deepEqual(fills(boulderOpsFor(stillLanding(), 4, 5)), ["#222222"], "a still landing is frame 4 at any age");
  assert.equal(boulderOpsFor(null, 1, 0), null, "no pack is the authored rock's cue, not a throw");
});

test("how long the landing stays is what the PACK can say, and the build's own answer ~~is UNREAD~~ agrees with it", () => {
  // ► ~~**THE ONE NUMBER THIS CANNOT DERIVE.**~~ **READ 2026-09-23 (main
  //   session):** the real pack's frame-4 child is character 27, the fireball's
  //   explosion, whose only script is `_parent.removeMovieClip()` on its frame
  //   23 (`sprite:27/frame:23/DoAction@0xb819`) — so 22 frames, which is what
  //   the pack rule below already gives (pinned on the real pack in the next
  //   test). No override is needed, so the constant stays null.
  assert.equal(BOULDER_LANDED_FRAMES, null, "the pack rule is the build's answer; no override");
  assert.equal(boulderLandedFramesFor(null), 0, "no pack: the authored rock shows no landing at all");
  assert.equal(boulderLandedFramesFor(propPackFrom({ props: { rockMC: { frames: [[at(1)]] } }, shapes: SHAPES })), 0,
    "a pack without `boulder_combat` is the same case");
  assert.equal(boulderLandedFramesFor(stillLanding()), Infinity,
    "a still frame 4 has nothing in it that could remove the rock, so it stays as long as the arena");
  assert.equal(boulderLandedFramesFor(withLanding()), 2,
    "an animated landing plays ONCE, its last frame unseen — INTERIM, the fireball's explosion as precedent " +
    "(its last frame's script removes it before that frame is drawn), until the child is read");
});

test("THE REAL PACK: a landed boulder shows the explosion's 22 frames, and is gone on the 23rd", async (t) => {
  // The re-extracted pack (2026-09-23) carries `boulder_combat` with character
  // 27 on frame 4; sprite 27's frame 23 removes its parent before that frame is
  // drawn (`DoAction@0xb819`). Skips on a tree with no extracted pack.
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const at = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "props", "props.json");
  if (!fs.existsSync(at)) {
    t.skip("no extracted props pack in this tree (a fresh clone): run node tools/extract-props.mjs");
    return;
  }
  const pack = propPackFrom(JSON.parse(fs.readFileSync(at, "utf8")));
  // A pack that EXISTS but predates `boulder_combat` is a stale pack, not an
  // absent one — it fails by name rather than passing on absence.
  assert.ok(pack.props?.boulder_combat, "the props pack predates boulder_combat (2026-09-23): re-extract it");
  assert.equal(boulderLandedFramesFor(pack), 22);
});

test("the arithmetic refuses to guess its painter's scale, and a rock with no fall", () => {
  assert.throws(() => boulderDrawAt(rock(), 0, { frontY: 200 }), /figureScaleFor/);
  assert.throws(() => boulderDrawAt(rock({ fall: null }), 0, DEPS), /fall/);
});

test("the AUTHORED rock is the same rock every frame, and its neighbour is a different one", () => {
  const first = boulderOutline(3);
  assert.equal(first.length, 9);
  assert.deepEqual(boulderOutline(3), first, "no clock, no randomness: a rock does not shimmer as it falls");
  assert.notDeepEqual(boulderOutline(4), first, "turned by its own index");
  for (const [x, y] of first) {
    const reach = Math.hypot(x, y);
    assert.ok(reach > 25 && reach <= 36, `every lump within the authored 34-unit radius, got ${reach}`);
  }
});

test("nothing else a shower emits is read as a bolt, a fireball or a walk", () => {
  const { commands } = shower({ foe: NINE_HITS });
  assert.equal(commands.filter((command) => command.kind === CommandKind.ATTACH_EFFECT
    && command.effect !== "boulder_combat").length, 0, "no lightning bolt");
  assert.equal(commands.filter((command) => command.kind === CommandKind.FIRE_PROJECTILE).length, 0, "no fireball");
  assert.equal(commands.filter((command) => command.kind === CommandKind.MOVE_CLIP).length, 0, "nobody walks");
  assert.equal(commands.filter((command) => command.kind === CommandKind.UNMAPPED).length, 0);
});
