/**
 * THE BUILD'S OWN COMBAT PROPS — the arrow, and the route from a resource bag
 * back to which arrow it is.
 *
 * WHY THIS FILE IS SEPARATE from `render-projectile.test.js`: that one is the
 * FLIGHT, which is pure arithmetic and needs no assets at all. This one is the
 * ART, which a player may or may not have extracted — so every test here has to
 * work both ways, and the "no pack" path is the one a fresh clone takes.
 *
 * ► **THERE IS NO FIXTURE, AND THERE MUST NOT BE.** This repository ships no
 *   SS2 asset: `assets/` is gitignored AND `test/asset-attestation.test.js`
 *   fails if anything under it is tracked. So these tests build their own tiny
 *   pack in the shape the extractor writes, which is also the honest thing —
 *   what is under test is `props.js`'s reading of that shape, not the contents
 *   of one person's install.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  applyCommands,
  emptyScene,
  arrowOpsFor,
  arrowTrailOpsFor,
  hasExtractedProps,
  propFrameCount,
  propInvoiceFor,
  propOpsFor,
  propPackFrom,
  arenaSceneryFor,
  SS2_ARENA_SCENERY
} from "../src/render/index.js";
import { ss2ArrowFrameFor, ss2RangedWeaponFor, ss2WeaponEntry, SS2_WEAPON_IDS } from "../src/team/ss2-weapon-table.js";
import { SS2_ARENA } from "../src/team/ss2-rules.js";
import { CommandKind, SS2_STATIC_MAP_BINDINGS, buildArenaLayout, presentResolvedEvents } from "../src/adapter/index.js";
import { PROP_EXPORTS } from "../tools/extract-props.mjs";
import { argumentsOfCall } from "../tools/extract-clip-effects.mjs";

/**
 * `bullet_trail`'s SEVEN alphas, in age order, as the build's own display list
 * carries them on sprite 48 frames 1..7.
 *
 * ► **MEASURED, NOT AUTHORED, AND THE SYNTHETIC PACK BORROWS THEM ON PURPOSE.**
 *   `resolveTimeline` on character 48 gives seven frames, each placing
 *   character 47 at depth 1 under the instance name `bullet` at the identity
 *   matrix, with only `alphaMultiplier` moving. The real-pack test at the foot
 *   of this file asserts this same list against `assets/props/props.json`, so
 *   the fixture and the oracle are pinned to each other rather than the fixture
 *   being free to drift into whatever makes a test pass.
 */
const TRAIL_FADE = Object.freeze([0.69921875, 0.58203125, 0.46484375, 0.3515625, 0.234375, 0.1171875, 0]);

/** The extractor's colour block with only the alpha moved, as sprite 48 carries it. */
const alphaOnly = (alphaMultiplier) => ({
  redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier,
  redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0
});

/**
 * A pack in the shape `tools/extract-props.mjs` writes: props keyed by linkage,
 * each with 1-based frames of `{shape, matrix}` placements, and a shape table.
 *
 * Deliberately reproduces the arrow's REAL structure — several frames, of which
 * the later ones repeat one shape — because that is the property every caller
 * has to cope with.
 */
const packOf = (overrides = {}) => propPackFrom({
  props: {
    bullet: {
      linkage: "bullet",
      character: 47,
      frames: [
        [{ shape: 42, matrix: [1, 0, 0, 1, 0, 0] }],
        [{ shape: 43, matrix: [1, 0, 0, 1, 0, 0] }],
        [{ shape: 46, matrix: [1, 0, 0, 1, 0, 0] }],
        [{ shape: 46, matrix: [1, 0, 0, 1, 0, 0] }]
      ]
    },
    // ► **SEVEN FRAMES OF ONE SHAPE UNDER A FALLING ALPHA, because that is
    //   what sprite 48 is and the difference from `bullet` above is the whole
    //   point.** The arrow's frame is a LOOKUP keyed on the bow; the trail's is
    //   a CLOCK keyed on the puff's age. Reproducing that here is what lets a
    //   FRESH CLONE catch the off-by-one — the alphas are the only thing that
    //   distinguishes age 1 from age 0, exactly as on the real pack, so a test
    //   that only had the real pack to pin it would pin nothing on a clone.
    bullet_trail: {
      linkage: "bullet_trail",
      character: 48,
      frames: TRAIL_FADE.map((alpha) => [{ shape: 44, matrix: [1, 0, 0, 1, 0, 0], colour: alphaOnly(alpha) }])
    },
    ...overrides.props
  },
  shapes: {
    42: { bounds: {}, paths: [{ d: "M0 0L1 1", fill: "#aaa" }] },
    43: { bounds: {}, paths: [{ d: "M0 0L2 2", fill: "#bbb" }, { d: "M2 2L3 3", fill: "#ccc" }] },
    44: { bounds: {}, paths: [{ d: "M0 0L4 4", fill: "#ddd" }] },
    46: { bounds: {}, paths: [{ d: "M0 0L5 5", fill: "#eee" }] },
    ...overrides.shapes
  }
});

/* ------------------------------------------------------------------ */
/* Reading a pack, and running without one                             */
/* ------------------------------------------------------------------ */

test("no pack means NO ARROW, not a crash — which is how a fresh clone runs", () => {
  // ► **THE FALLBACK IS THE SUPPORTED PATH, not an error path.** This
  //   repository ships no SS2 asset, so a player who has not run the extractor
  //   must get a playable arena drawing its own authored arrow. `sound.js` and
  //   `extracted-figure.js` have the identical arrangement.
  for (const absent of [null, undefined, {}, { props: null }, { props: {}, shapes: null }, "nonsense", 7]) {
    const pack = propPackFrom(absent);
    assert.equal(hasExtractedProps(pack), false, `${JSON.stringify(absent)} is not a pack`);
    assert.equal(arrowOpsFor(pack, 1), null, "and asking for an arrow gets null rather than throwing");
    assert.equal(propFrameCount(pack, "bullet"), 0);
  }
  // A pack that IS well-formed but holds nothing this caller wants is the same
  // answer, which is what a partial extraction looks like.
  const partial = propPackFrom({ props: { sparks: { frames: [[]] } }, shapes: {} });
  assert.equal(hasExtractedProps(partial), true, "it is a pack");
  assert.equal(arrowOpsFor(partial, 1), null, "and it simply has no arrow in it");
});

test("a frame resolves to draw operations in the same shape the figure emits", () => {
  const pack = packOf();
  const ops = arrowOpsFor(pack, 2);
  assert.equal(ops.length, 2, "shape 43 carries two paths");
  for (const op of ops) {
    assert.equal(op.kind, "path", "the same op kind `paintFigure` emits, so a surface needs no new code");
    assert.equal(typeof op.d, "string");
    assert.deepEqual(op.matrix, [1, 0, 0, 1, 0, 0]);
    assert.equal(op.fillRule, "evenodd");
  }
  assert.deepEqual(ops.map((op) => op.fill), ["#bbb", "#ccc"]);
});

test("frames are ONE-BASED, as gotoAndStop indexes them", () => {
  // A zero-based array here would put an off-by-one between this data and every
  // offset in the map that indexes it — the kind of seam that goes wrong
  // silently, because frame 1 and frame 2 both hold a plausible arrow.
  const pack = packOf();
  assert.equal(arrowOpsFor(pack, 1)[0].fill, "#aaa", "frame 1 is the FIRST frame");
  assert.equal(arrowOpsFor(pack, 2)[0].fill, "#bbb");
  assert.equal(propFrameCount(pack, "bullet"), 4);
});

test("a frame past the end CLAMPS to the last, which is what the build would be showing", () => {
  // `gotoAndStop` past the end of a clip leaves the playhead where it is; a
  // renderer with no playhead has to choose, and the last frame is it. **It
  // matters less than it looks** — every frame of the real `bullet` from 6 to
  // 50 is the same drawing anyway.
  const pack = packOf();
  assert.deepEqual(arrowOpsFor(pack, 99), arrowOpsFor(pack, 4));
  assert.deepEqual(arrowOpsFor(pack, 0), arrowOpsFor(pack, 1), "and below the start clamps up");
  assert.deepEqual(arrowOpsFor(pack, null), arrowOpsFor(pack, 1), "an unknown bow falls back to the first arrow");
  assert.deepEqual(arrowOpsFor(pack, Number.NaN), arrowOpsFor(pack, 1));
});

test("an empty frame is null rather than an empty draw", () => {
  // `blood` really does have empty frames — two of its nine — so this is the
  // shape of a real prop, not a defensive case.
  const pack = propPackFrom({
    props: { bullet: { frames: [[], [{ shape: 42, matrix: [1, 0, 0, 1, 0, 0] }]] } },
    shapes: { 42: { bounds: {}, paths: [{ d: "M0 0L1 1", fill: "#aaa" }] } }
  });
  assert.equal(propOpsFor(pack, { linkage: "bullet", frame: 1 }), null, "nothing on this frame");
  assert.ok(propOpsFor(pack, { linkage: "bullet", frame: 2 }), "and something on the next");
});

test("a placement naming a missing shape is SKIPPED, not drawn as a hole", () => {
  const pack = propPackFrom({
    props: { bullet: { frames: [[{ shape: 999, matrix: [1, 0, 0, 1, 0, 0] }]] } },
    shapes: {}
  });
  assert.equal(arrowOpsFor(pack, 1), null, "a frame whose every shape is missing draws nothing");
});

test("THE TRAIL'S INDEX IS THE PUFF'S AGE, AND READING IT AS THE WEAPON DREW NO TRAIL FOR 14 OF 20 BOWS", () => {
  // ► **THIS IS THE REGRESSION TEST FOR THE OFF-BY-ONE, and it is the only
  //   assertion in this file a fresh clone can run against it.** Until
  //   2026-09-14 `arrowTrailOpsFor` read `Same fallback rule as arrowOpsFor`
  //   and passed `secondary_weapon - 60` straight into a seven-frame clip.
  //   `emitPropOps` clamps, so bows 67-80 all landed on frame 7 — alpha 0 —
  //   and the arena drew nothing at all for fourteen of the twenty bows.
  //
  //   `bullet_trail` is a CLOCK: sprite 48's seven frames each place the same
  //   character 47 at depth 1 under the instance name `bullet`, and only the
  //   alpha moves. The weapon picks the ARROW INSIDE the puff —
  //   `trail.bullet.gotoAndStop(secondary_weapon - 60)` at `+0x7255` takes
  //   `GetMember "bullet"` on the attached clip BEFORE the call — so seven
  //   slots were never addressing twenty bows.
  const pack = packOf();
  assert.equal(propFrameCount(pack, "bullet_trail"), 7, "seven frames, one per frame of the puff's life");

  // ► **ZERO-BASED, AND THAT ASYMMETRY WITH `arrowOpsFor` IS THE GUARD.** An
  //   age is a duration; a frame is an index. If this took a 1-based frame the
  //   two calls would be interchangeable at every call site again.
  for (const [age, alpha] of TRAIL_FADE.entries()) {
    const ops = arrowTrailOpsFor(pack, age);
    assert.equal(ops.length, 1, `age ${age} still draws the one shape`);
    assert.equal(ops[0].fill, "#ddd", "the drawing never changes — `distinctFrames` is 1");
    assert.equal(ops[0].fillOpacity, alpha, `age ${age} is frame ${age + 1} of the fade`);
  }

  // The assertion that actually goes red on a revert: age 0 and a 1-based
  // frame 1 agree, so the FIRST puff cannot catch it and the second can.
  assert.equal(arrowTrailOpsFor(pack, 1)[0].fillOpacity, TRAIL_FADE[1],
    "the puff one frame old is the SECOND alpha, not the first");

  // Older than the clip is the build's own answer here rather than a guess:
  // frame 7 carries `alphaMultiplier: 0` AND a `this.removeMovieClip()`, so a
  // puff past the end is invisible in the renderer and gone in the runtime.
  for (const past of [7, 12, 20, 999]) {
    assert.equal(arrowTrailOpsFor(pack, past)[0].fillOpacity, 0, `age ${past} puts down no pixel`);
  }

  // Totality, like every other reader in this module.
  assert.equal(arrowTrailOpsFor(null, 0), null, "no pack is no puff, not a throw");
  assert.equal(arrowTrailOpsFor(pack, undefined)[0].fillOpacity, TRAIL_FADE[0], "an unstated age is the NEWEST puff");
  assert.equal(arrowTrailOpsFor(pack, -3)[0].fillOpacity, TRAIL_FADE[0], "and so is a nonsensical one");
});

test("THE ARROW AND THE TRAIL ARE INDEXED BY DIFFERENT QUANTITIES, and swapping them is silent", () => {
  // The two clips take a small positive integer and both return a plausible
  // puff-or-arrow for it, which is exactly why the wrong one went unnoticed
  // through a whole wave. Pin that they disagree, so a call site that starts
  // feeding one to the other moves a number here.
  const pack = packOf();
  // Bow 62: art frame 2. As an ARROW that is the second drawing; the same 2
  // handed to the trail is an AGE and lands on the THIRD alpha.
  assert.deepEqual(arrowOpsFor(pack, 2).map((op) => op.fill), ["#bbb", "#ccc"], "frame 2 of the arrow LOOKUP");
  assert.equal(arrowTrailOpsFor(pack, 2)[0].fillOpacity, TRAIL_FADE[2],
    "while 2 handed to the trail is an AGE and lands on the third alpha");
  assert.notEqual(arrowTrailOpsFor(pack, 2)[0].fillOpacity, arrowTrailOpsFor(pack, 1)[0].fillOpacity,
    "so the two readings are distinguishable, which is what makes the test above possible");
});

/* ------------------------------------------------------------------ */
/* Which arrow — the route back from a resource bag                     */
/* ------------------------------------------------------------------ */

test("the ranged band's damage pairs identify the bow, and every one collides outside it", () => {
  // ► **THE MEASUREMENT THE LOOKUP RESTS ON, asserted rather than asserted-in-a-
  //   comment.** `ss2Reach`'s header records that inverting the damage pair is
  //   AMBIGUOUS across the whole ninety-row table, and withdraws a claim that
  //   leaned on it. That is true and about a different question.
  const inBand = new Map();
  for (const id of SS2_WEAPON_IDS) {
    const entry = ss2WeaponEntry(id);
    if (entry.type !== 4) continue;
    const key = `${entry.minDamage},${entry.maxDamage}`;
    assert.ok(!inBand.has(key), `ranged ids ${inBand.get(key)} and ${id} share (${key})`);
    inBand.set(key, id);
  }
  assert.equal(inBand.size, 20, "all twenty ranged rows, all distinct");

  // ► **AND NEARLY EVERY ONE OF THEM COLLIDES WITH A MELEE ROW**, which is
  //   exactly why the lookup searches the BAND and never the table. (4,16) is
  //   ids 2, 21 and 61.
  let collisions = 0;
  for (const [key, rangedId] of inBand) {
    const [min, max] = key.split(",").map(Number);
    const others = SS2_WEAPON_IDS.filter((id) => {
      const entry = ss2WeaponEntry(id);
      return entry.type !== 4 && entry.minDamage === min && entry.maxDamage === max;
    });
    if (others.length > 0) collisions += 1;
    assert.equal(ss2RangedWeaponFor(min, max), rangedId, `(${key}) must resolve to the ranged row ${rangedId}`);
  }
  assert.ok(collisions > 10, `the collisions are the point of the band restriction: ${collisions} of 20`);
});

test("a pair from outside the ranged band resolves to NOTHING, rather than a plausible bow", () => {
  // A gladiator carrying a sword in the secondary slot is a state the shop
  // cannot produce — `buyweapon` routes only a ranged purchase there — and
  // guessing a bow for it is the move this returns null instead of making.
  const sword = ss2WeaponEntry(1);
  assert.equal(ss2RangedWeaponFor(sword.minDamage, sword.maxDamage), null);
  assert.equal(ss2RangedWeaponFor(undefined, undefined), null);
  assert.equal(ss2RangedWeaponFor(999, 999), null);
});

test("the arrow frame is `id - 60`, and it is null outside the band", () => {
  assert.equal(ss2ArrowFrameFor(61), 1, "the first bow looses the first arrow");
  assert.equal(ss2ArrowFrameFor(80), 20);
  for (const outside of [1, 60, 81, null, Number.NaN]) {
    assert.equal(ss2ArrowFrameFor(outside), null, `${outside} is not a bow`);
  }
});

/* ------------------------------------------------------------------ */
/* End to end: the command carries the arrow                            */
/* ------------------------------------------------------------------ */

const wireFor = (secondary) => ({
  teams: [
    {
      id: "red",
      combatants: [{
        id: "red-1", name: "Red", teamId: "red", seatId: "s1", slotIndex: 0, aiFilled: false,
        alive: true, health: 40, maxHealth: 40, stats: {}, loadout: {}, status: [], x: -300, y: 200,
        resources: secondary === null ? {} : {
          secondary_weapon_min_damage: { value: ss2WeaponEntry(secondary).minDamage, min: 0, max: 999 },
          secondary_weapon_max_damage: { value: ss2WeaponEntry(secondary).maxDamage, min: 0, max: 999 }
        }
      }]
    },
    {
      id: "blue",
      combatants: [{
        id: "blue-1", name: "Blue", teamId: "blue", seatId: "s2", slotIndex: 0, aiFilled: false,
        alive: true, health: 40, maxHealth: 40, stats: {}, loadout: {}, resources: {}, status: [], x: 300, y: 200
      }]
    }
  ],
  events: [{
    sequence: 1, type: "bombard", actorId: "red-1", targetId: "blue-1",
    attackDirection: 21, hit: true, dispatchedMethod: "normal"
  }]
});

function firedFor(secondary) {
  const wire = wireFor(secondary);
  const layout = buildArenaLayout(wire);
  const { commands } = presentResolvedEvents(wire, { layout, bindings: SS2_STATIC_MAP_BINDINGS });
  return commands.find((command) => command.kind === CommandKind.FIRE_PROJECTILE);
}

test("the command names WHICH arrow, derived from the bag the swing already needs", () => {
  // The build picks the art with `gotoAndStop(secondary_weapon - 60)` and the
  // weapon id does not survive into the resolver — but the table's own raw
  // damage columns do, because the swing reads them.
  assert.equal(firedFor(61).artFrame, 1, "the cheapest bow looses the first arrow");
  assert.equal(firedFor(65).artFrame, 5, "and the fifth is the last DISTINCT one");
  assert.equal(firedFor(80).artFrame, 20, "while the top bow asks for frame 20, which repeats the fifth");

  // ► **NULL IS A REAL ANSWER and the renderer falls back for it.** A bag with
  //   no secondary columns at all — every combatant built before the ranged
  //   vocabulary — has no bow to identify.
  assert.equal(firedFor(null).artFrame, null);
});

test("the scene carries the arrow through, so the shell asks the weapon table nothing", () => {
  const scene = applyCommands(emptyScene(), [firedFor(63)]);
  assert.equal(scene.projectiles[0].artFrame, 3);
  assert.ok("artFrame" in scene.projectiles[0], "always present, never conditional");

  const unknown = applyCommands(emptyScene(), [firedFor(null)]);
  assert.equal(unknown.projectiles[0].artFrame, null, "and null survives as null rather than becoming 1 here");
});

/* ------------------------------------------------------------------ */
/* The extractor's own declaration                                     */
/* ------------------------------------------------------------------ */

test("every declared prop names what reads it, so a dead entry is visible", () => {
  // ► **A CLOSED LIST RATHER THAN A PATTERN.** The build exports 502 names; a
  //   sweep would extract a `saving_movie` and a `charsheet` nothing can use
  //   and call it coverage. The rule is that an entry names its reader.
  assert.ok(PROP_EXPORTS.length > 0);
  for (const prop of PROP_EXPORTS) {
    // ► **TWO WAYS TO NAME AN ASSET, AND AN ENTRY MUST PICK ONE.** Every prop
    //   is in `ExportAssets` and is asked for by linkage; the arena is NOT — it
    //   is a named instance on a root frame, so it is asked for by character
    //   id. An entry carrying neither would extract nothing and say nothing.
    const key = prop.linkage ?? prop.name;
    // `rockMC` is the build's own spelling and it is camelCase, so the pattern
    // is the build's naming rather than a house style: an entry must match a
    // linkage name that actually exists, not one this repository would prefer.
    assert.match(key, /^[A-Za-z_]+$/, "the build's own identifier either way");
    assert.ok(
      typeof prop.linkage === "string" || Number.isFinite(prop.character),
      `${key} must state a linkage OR a character id`
    );
    assert.ok(prop.indexedBy.length > 0, `${key} must say what its frame number MEANS`);
    assert.ok(prop.reader.length > 0, `${key} must name what reads it, or say plainly that nothing does`);
  }
  const arrow = PROP_EXPORTS.find((prop) => prop.linkage === "bullet");
  assert.equal(arrow.indexedBy, "secondary_weapon - 60", "the build's own lookup");
});

test("THE FUSED `arena` ENTRY IS GONE, and it must not come back", () => {
  // ► **IT USED TO TAKE CHARACTER 2249 WHOLE, AND THAT LOST THREE THINGS.**
  //   The arena clip's frame 1 flattens to nine placements with no way to tell
  //   the sand from the stands — and **the camera moves one of them and not the
  //   other**, so a fused blob cannot express `crowd._y = -200 +
  //   ceil(zoomscale)`. It also collapsed the SIX arenas to one, because the
  //   fused frame 1 is arena 1 of 6, and it dragged in the `about_fight_mov`
  //   text field, which was this tool's only reported failure for weeks.
  //
  //   `sand` (673) and `crowd` (2112) replace it and are strictly more.
  assert.equal(PROP_EXPORTS.find((prop) => prop.name === "arena"), undefined,
    "character 2249 is not declared; take `sand` and `crowd` separately");
  for (const [name, character] of [["sand", 673], ["crowd", 2112]]) {
    const entry = PROP_EXPORTS.find((prop) => prop.name === name);
    assert.ok(entry, `${name} must be declared`);
    assert.equal(entry.character, character);
    assert.equal(entry.framesWanted, undefined, `${name} takes ALL six arenas, not frame 1`);
    assert.match(entry.indexedBy, /current_arena/, `${name} says the index is the arena`);
  }
});

test("CHARACTER 1729 IS THE SKY, and calling it the crowd would mis-draw in SILENCE", () => {
  // ► **THIS ENTRY WAS NAMED `crowd` AND IS THE SKY.** The build says so three
  //   ways: root frame 221 places it under the instance name `sky`,
  //   `day_night_cycle` calls `_root.sky.gotoAndStop(time_of_day)`, and its own
  //   child sprite is `cloud_patterns`. The real crowd is character 2112.
  //
  //   The failure mode is the reason this test exists: the renderer looks a
  //   layer up BY KEY, so a `crowd` key holding the sky paints a 640x211 sky
  //   where the stands belong and draws no stands at all — no error, no gap,
  //   just the wrong picture.
  const sky = PROP_EXPORTS.find((prop) => prop.name === "sky");
  const crowd = PROP_EXPORTS.find((prop) => prop.name === "crowd");
  assert.equal(sky.character, 1729);
  assert.equal(crowd.character, 2112);
  assert.notEqual(sky.character, crowd.character, "two clips, two keys, never one");
  assert.match(sky.indexedBy, /time_of_day/,
    "and its 200 frames are an HOUR lookup, not an animation");
  assert.equal(sky.framesWanted, undefined, "so every frame is taken");
});

/* ------------------------------------------------------------------ */
/* The clip's own effect calls, read without an interpreter            */
/* ------------------------------------------------------------------ */

test("an AVM1 call's arguments read BACKWARDS off the push, and pool entries are literals", () => {
  // ► **BOTH HALVES OF THIS WERE REAL BUGS, caught by the extractor reporting
  //   28 of 32 call sites as unreadable when they were all plain constants.**
  //
  //   1. **AVM1 pops arguments in reverse.** `Push 15, "blood", 2, "bounceitem"`
  //      leaves the name on top; the name pops first, then the count, then
  //      `"blood"`, then `15`. So the LAST operand pushed is the FIRST
  //      parameter, and reading forwards gave `bounceitem(15, "blood")` — the
  //      prop name reported as a count.
  //   2. **An identifier is a `constant`, not a `string`.** This build interns
  //      almost every name in a `ConstantPool`, so a `Push` carries
  //      `{type: "constant", index, value}` where a naive reader expects
  //      `{type: "string"}`.
  const pooled = {
    name: "Push",
    operand: [
      { type: "integer", value: 15 },
      { type: "constant", index: 6, value: "blood" },
      { type: "integer", value: 2 },
      { type: "constant", index: 7, value: "bounceitem" }
    ]
  };
  assert.deepEqual(argumentsOfCall(pooled), { callee: "bounceitem", args: ["blood", 15] });

  // The same call with inline strings rather than pool entries, which is what
  // the later frames of the clip actually emit.
  const inline = {
    name: "Push",
    operand: [
      { type: "integer", value: 3 },
      { type: "string", value: "blood" },
      { type: "integer", value: 2 },
      { type: "string", value: "bounceitem" }
    ]
  };
  assert.deepEqual(argumentsOfCall(inline), { callee: "bounceitem", args: ["blood", 3] });
});

test("a call this cannot read statically is REFUSED, never guessed at", () => {
  // ► **THE GUARD THAT MAKES THIS A DERIVATION RATHER THAN A GUESS.** The clip
  //   has exactly one call whose arguments are not literals — frame 1041's
  //   `bounceitem(head, 1)`, a decapitation that passes the rig's own limb —
  //   and the extractor reports it instead of inventing a prop name for it.
  //
  //   **This is also the measurement that says an AVM1 interpreter is not
  //   needed here.** An interpreter would be the proper way if the calls were
  //   dynamic; 27 of 28 are not.
  const shortOfArguments = {
    name: "Push",
    // argc says 2 and only one operand precedes it: the other came off a
    // GetVariable this reader cannot see.
    operand: [
      { type: "integer", value: 1 },
      { type: "integer", value: 2 },
      { type: "constant", index: 6, value: "bounceitem" }
    ]
  };
  assert.equal(argumentsOfCall(shortOfArguments), null);

  for (const notACall of [null, undefined, { name: "GetVariable" }, { name: "Push" }, { name: "Push", operand: [] }]) {
    assert.equal(argumentsOfCall(notACall), null, "and nothing that is not a set-up push reads as one");
  }
});

/* ------------------------------------------------------------------ */
/* The arena's own scenery                                             */
/* ------------------------------------------------------------------ */

test("the arena's edges are the build's own coordinates, and they bracket the walk clamp", () => {
  // ► **ROOT FRAME 221 IS A CONSTRUCTION SCRIPT — its display list is EMPTY —
  //   and two `rockMC` are the only scenery in its 488 instructions.**
  //
  //   ```text
  //     attachMovie("rockMC", "rockLeft",  200)   ._x = -2160
  //     attachMovie("rockMC", "rockRight", 201)   ._x =  2160
  //     both ._y = 210 ; arena.gladiators at (0, 0)
  //   ```
  assert.deepEqual(
    SS2_ARENA_SCENERY.map((piece) => [piece.instance, piece.x, piece.y]),
    [["rockLeft", -2160, 210], ["rockRight", 2160, 210]]
  );

  // ► **TWO INDEPENDENT READINGS OF THE BUILD AGREEING ABOUT WHERE THE ARENA
  //   STOPS.** `SS2_ARENA.clamp` came out of `nextphase` step 1 long before
  //   anybody looked at the scenery, and the rocks stand just outside it — so
  //   the build marks the end of the walkable ground with a rock at each end.
  for (const piece of SS2_ARENA_SCENERY) {
    assert.ok(
      Math.abs(piece.x) > Math.abs(SS2_ARENA.clamp.min),
      `${piece.instance} at ${piece.x} must lie OUTSIDE the walk clamp of ${SS2_ARENA.clamp.min}`
    );
    assert.ok(Math.abs(piece.x) - Math.abs(SS2_ARENA.clamp.min) < 200, "and only just outside it");
  }

  // Mirrored, and nearer the viewer than the fighters' line — a depth cue, not
  // a mistake.
  assert.equal(SS2_ARENA_SCENERY[0].x, -SS2_ARENA_SCENERY[1].x);
  for (const piece of SS2_ARENA_SCENERY) {
    assert.ok(piece.y > SS2_ARENA.frontY, `${piece.instance} sits nearer than the fighters' ${SS2_ARENA.frontY}`);
  }
});

test("scenery resolves to draw operations, and a missing pack draws none", () => {
  const pack = propPackFrom({
    props: { rockMC: { frames: [[{ shape: 42, matrix: [1, 0, 0, 1, 0, 0] }]] } },
    shapes: { 42: { bounds: {}, paths: [{ d: "M0 0L9 9", fill: "#555" }] } }
  });
  const scenery = arenaSceneryFor(pack);
  assert.equal(scenery.length, 2, "both rocks");
  for (const piece of scenery) {
    assert.ok(piece.ops.length > 0, "each with its own ops resolved");
    assert.equal(piece.ops[0].kind, "path");
  }

  // A partial extraction loses the rock, not the arena.
  assert.deepEqual(arenaSceneryFor(null), []);
  assert.deepEqual(arenaSceneryFor(propPackFrom({ props: { bullet: { frames: [[]] } }, shapes: {} })), []);
});

/* ------------------------------------------------------------------ */
/* Masks                                                               */
/* ------------------------------------------------------------------ */

test("a MASKED placement carries its cutter, and the cutter is never drawn itself", () => {
  // ► **A MASK IS A CUTTER, NOT A DRAWING.** The extractor drops the mask's own
  //   placement and hands its geometry to everything it clips, because a
  //   renderer has to set the clip before the fill and clear it after — and a
  //   list of cutters somewhere else is an invitation to forget one.
  const pack = propPackFrom({
    props: {
      night: {
        linkage: "night",
        frames: [[
          { shape: 10, matrix: [1, 0, 0, 1, 0, 0], clip: { shape: 11, matrix: [0.5, 0, 0, 0.5, -20, -40] } },
          { shape: 10, matrix: [1, 0, 0, 1, 100, 0] }
        ]]
      }
    },
    shapes: {
      10: { paths: [{ d: "M0 0L10 0L10 10Z", fill: "#fff" }, { d: "M0 0L5 5Z", fill: "#000" }] },
      11: { paths: [{ d: "M0 0L8 0L8 8Z" }, { d: "M2 2L4 2L4 4Z" }] }
    }
  });

  const ops = propOpsFor(pack, { linkage: "night", frame: 1 });
  assert.equal(ops.length, 4, "two placements of a two-path shape");

  const clipped = ops.filter((op) => op.clip);
  assert.equal(clipped.length, 2, "BOTH paths of the masked placement are clipped");
  assert.deepEqual(clipped[0].clip.matrix, [0.5, 0, 0, 0.5, -20, -40], "the cutter's own matrix");
  // ► **EVERY LOOP OF THE CUTTER, because a mask with a hole is still ONE
  //   region.** Keeping only the first would clip to the outline and fill the
  //   hole back in.
  assert.equal(clipped[0].clip.d, "M0 0L8 0L8 8ZM2 2L4 2L4 4Z");
  assert.equal(clipped[0].clip, clipped[1].clip, "resolved once per placement, not once per path");

  const unclipped = ops.filter((op) => !op.clip);
  assert.equal(unclipped.length, 2, "the unmasked placement is untouched");
  assert.ok(!ops.some((op) => op.d === "M0 0L8 0L8 8ZM2 2L4 2L4 4Z"),
    "the cutter must never appear as a drawing of its own");
});

test("a clip naming a shape the pack does not hold is dropped, not half-applied", () => {
  // Better to draw the thing unclipped than to throw where a sky should be —
  // the same total-rather-than-throwing rule every reader in this file follows.
  const pack = propPackFrom({
    props: { x: { linkage: "x", frames: [[{ shape: 1, matrix: [1, 0, 0, 1, 0, 0], clip: { shape: 99, matrix: [1, 0, 0, 1, 0, 0] } }]] } },
    shapes: { 1: { paths: [{ d: "M0 0L1 1Z" }] } }
  });
  const ops = propOpsFor(pack, { linkage: "x", frame: 1 });
  assert.equal(ops.length, 1);
  assert.equal(ops[0].clip, undefined, "an unresolvable cutter is absent, not a broken object");
});

/* ------------------------------------------------------------------ */
/* The placement's COLOUR TRANSFORM                                     */
/* ------------------------------------------------------------------ */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * The player's own extracted props, or null on a clone with no licensed copy.
 *
 * A function declaration rather than an arrow, copying `render-screen.test.js`:
 * `ss2-assertion-quality.test.js` finds a helper's body by looking for the next
 * brace before the next newline, so a multi-line arrow reads as bodyless and
 * every test calling it is reported as asserting nothing.
 */
function readRealProps() {
  const at = path.join(REPO_ROOT, "assets", "props", "props.json");
  return fs.existsSync(at) ? propPackFrom(JSON.parse(fs.readFileSync(at, "utf8"))) : null;
}

const REAL_PROPS = readRealProps();

/**
 * ► **`fs.existsSync` IS NOT A GUARD ON ITS OWN — IT IS A WAY OF PASSING.**
 *   Every real-pack test below opens with `if (!REAL_PROPS) { ...; return; }`,
 *   and until 2026-09-14 the only thing standing behind that `!` was
 *   `fs.existsSync` on a path derived from `import.meta.url`. Break the
 *   derivation by one segment and all of them take the early return and the
 *   suite reports **pass, 0 skipped** — no counter moves, and 3,345 / 2,330 /
 *   8,682 / the sky's two hex pins / the whole trail fade evaporate in silence.
 *   Reproduced by a wave-1 verifier: rewrite `new URL("..")` as
 *   `new URL("../..")` in this file and the run is byte-identical to a green
 *   one.
 *
 *   So the ABSENCE is anchored on something TRACKED. `tools/extract-props.mjs`
 *   is the tool that writes the pack and it is committed; if `REPO_ROOT` cannot
 *   reach it then `REPO_ROOT` is wrong, and this fails BY NAME instead of
 *   letting a broken derivation wear a fresh clone's clothes. The same anchor
 *   `test/extract-props.test.js` uses, and the same rule `AGENTS.md` states for
 *   the raw-trace archive check.
 */
function assertRealPackPathIsDerivable() {
  const anchor = path.join(REPO_ROOT, "tools", "extract-props.mjs");
  assert.ok(fs.existsSync(anchor),
    `${anchor} is not there, so REPO_ROOT is wrong and "this machine has no extracted pack" below ` +
    "would be a broken path derivation reading as a fresh clone");
}

/**
 * A pack built to reach what the real one CANNOT, which is the only reason a
 * synthetic fixture earns its place beside a measured one.
 *
 * Measured on `assets/props/props.json` 2026-09-14: **0 of its 3,345
 * placements carries a non-zero `alphaOffset`**, and **0 of its 41 bitmap
 * operations sits under a colour transform of any kind**. So the two counts
 * `propInvoiceFor` exists to report are DEAD on real data and a suite that only
 * ran against the pack would pin two zeros that cannot move. This one puts a
 * bitmap under identity multipliers with offsets 17/0/-9 — the only shape of
 * transform for which `touchesRgb`'s three OFFSET checks are the thing that
 * answers — and a gradient of differing stop opacities under an alpha offset.
 */
const tintPack = () => propPackFrom({
  props: {
    flat: { frames: [[{ shape: 1, matrix: [1, 0, 0, 1, 0, 0], colour: { redMultiplier: 0.30078125, greenMultiplier: 0.30078125, blueMultiplier: 0.30078125, alphaMultiplier: 0.5, redOffset: 0, greenOffset: 0, blueOffset: 36, alphaOffset: 0 } }]] },
    raster: { frames: [[{ shape: 2, matrix: [1, 0, 0, 1, 0, 0], colour: { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 0.5, redOffset: 17, greenOffset: 0, blueOffset: -9, alphaOffset: 0 } }]] },
    rasterAlphaOnly: { frames: [[{ shape: 2, matrix: [1, 0, 0, 1, 0, 0], colour: { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 0.25, redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0 } }]] },
    // ► **THE REAL PACK'S OWN RASTER SHAPE, under the SAME transform as
    //   `raster`.** All 7 bitmap-bearing paths in `assets/props/props.json`
    //   carry `fill: "none"` — measured 2026-09-14 — so `raster` above, with a
    //   fallback hex fill beside its bitmap, is a shape the build does not
    //   produce. Both are kept: together they are the only way to say what
    //   `bitmapColourTransformDropped` counts, which is the RASTER and not the
    //   fallback fill. A wave-1 verifier read the counter as wrong because
    //   `raster`'s fill visibly receives the transform; it is the raster that
    //   does not, and one fixture could not show the difference.
    rasterNoFill: { frames: [[{ shape: 5, matrix: [1, 0, 0, 1, 0, 0], colour: { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 0.5, redOffset: 17, greenOffset: 0, blueOffset: -9, alphaOffset: 0 } }]] },
    ramp: { frames: [[{ shape: 3, matrix: [1, 0, 0, 1, 0, 0], colour: { redMultiplier: 0.5, greenMultiplier: 0.5, blueMultiplier: 0.5, alphaMultiplier: 1, redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 51 } }]] },
    // The SAME ramp under an alpha offset whose stops all share one opacity,
    // which folds exactly and must NOT be counted as an approximation.
    levelRamp: { frames: [[{ shape: 4, matrix: [1, 0, 0, 1, 0, 0], colour: { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 51 } }]] },
    // Identity, written out in full the way the extractor writes it on EVERY
    // placement, so "carries a colour block" and "carries a tint" stay apart.
    plain: { frames: [[{ shape: 3, matrix: [1, 0, 0, 1, 0, 0], colour: { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0 } }]] },
    // `tools/extract-figure.mjs`'s EIGHT-NUMBER ARRAY spelling of the same
    // thing, which a reader that only knew the named object would drop whole.
    arrayShaped: { frames: [[{ shape: 1, matrix: [1, 0, 0, 1, 0, 0], colour: [0.30078125, 0.30078125, 0.30078125, 0.5, 0, 0, 36, 0] }]] },
    gone: { frames: [[{ shape: 404, matrix: [1, 0, 0, 1, 0, 0] }]] },
    uncuttable: { frames: [[{ shape: 1, matrix: [1, 0, 0, 1, 0, 0], clip: { shape: 404, matrix: [1, 0, 0, 1, 0, 0] } }]] }
  },
  shapes: {
    1: { paths: [{ d: "M0 0L1 1Z", fill: "#ffffff", fillOpacity: 1, stroke: "#ffffff", strokeWidth: 2, strokeOpacity: 0.8 }] },
    2: { paths: [{ d: "M0 0L2 2Z", fill: "#000000", fillOpacity: 1, bitmap: { id: 7 }, approximated: "bitmap" }] },
    5: { paths: [{ d: "M0 0L5 5Z", fill: "none", fillOpacity: 1, bitmap: { id: 9 }, approximated: "bitmap" }] },
    3: {
      paths: [{
        d: "M0 0L3 3Z",
        fill: "#2d2dfd",
        fillOpacity: 1,
        gradient: { type: "linear", stops: [{ offset: 0, fill: "#2d2dfd", opacity: 1 }, { offset: 1, fill: "#5fbefe", opacity: 0.5 }] }
      }]
    },
    4: {
      paths: [{
        d: "M0 0L4 4Z",
        fill: "#2d2dfd",
        fillOpacity: 1,
        gradient: { type: "linear", stops: [{ offset: 0, fill: "#2d2dfd", opacity: 0.5 }, { offset: 1, fill: "#5fbefe", opacity: 0.5 }] }
      }]
    }
  }
});

test("the placement's colour transform lands on the fill, the stroke and BOTH opacities", () => {
  // ► **PINNED BY VALUE, because this is what the figure's tint has never
  //   been.** `#ffffff` at multiplier 0.30078125 with blueOffset 36 is
  //   `#4c4c70` — 255 * 0.30078125 is 76.699, floored to 76 (`0x4c`), and
  //   76 + 36 is 112 (`0x70`). A reader that only checked "the fill changed"
  //   would pass on every one of the wrong answers.
  const ops = propOpsFor(tintPack(), { linkage: "flat", frame: 1 });
  assert.equal(ops.length, 1);
  assert.equal(ops[0].fill, "#4c4c70", "the RGB half, floored");
  assert.equal(ops[0].stroke, "#4c4c70", "the STROKE too — it was copied untransformed for as long as the fill was");
  assert.equal(ops[0].fillOpacity, 0.5, "1 * alphaMultiplier 0.5");
  assert.equal(ops[0].strokeOpacity, 0.4, "0.8 * 0.5, and the stroke's own opacity is the base");
  assert.equal(ops[0].strokeWidth, 2, "geometry is untouched by a colour transform");
});

test("IT FLOORS, because the player shifts rather than rounds", () => {
  // `readColourTransform` reads the multiply term as `readSB(bits) / 256`, so
  // the player computes `(channel * multTerm) >> 8` — an arithmetic shift,
  // which rounds toward negative infinity. Rounding instead is a plus-or-minus
  // one error on every pixel it touches, and on the REAL props pack it moves
  // 3,888 of the 4,575 colour-moving fills.
  //
  // ► **~~`assert.notEqual(ops[0].fill, "#4d4d71")` WAS THE WHOLE BODY, AND IT
  //   PASSED WITH THE FIX DELETED.~~** A wave-1 verifier reverted `props.js` to
  //   HEAD, where no transform is applied at all: `ops[0].fill` came back as
  //   the pack's untouched `#ffffff`, which is also not `#4d4d71`, and the test
  //   went green. **A lone `notEqual` against one value cannot tell "floors"
  //   from "never ran"** — it excludes exactly one of the infinitely many wrong
  //   answers. So the floored value is asserted POSITIVELY, and the rounded one
  //   is computed here from the same inputs rather than typed in, so the
  //   contrast is derived and cannot go stale against `filters.js`.
  const ops = propOpsFor(tintPack(), { linkage: "flat", frame: 1 });
  const channel = (base, multiplier, offset) => base * multiplier + offset;
  const hex = (value) => value.toString(16).padStart(2, "0");
  const floored = `#${[channel(255, 0.30078125, 0), channel(255, 0.30078125, 0), channel(255, 0.30078125, 36)]
    .map((value) => hex(Math.floor(value))).join("")}`;
  const rounded = `#${[channel(255, 0.30078125, 0), channel(255, 0.30078125, 0), channel(255, 0.30078125, 36)]
    .map((value) => hex(Math.round(value))).join("")}`;
  assert.equal(floored, "#4c4c70", "255 * 0.30078125 is 76.699 — floored, 76; plus the blue offset 36, 112");
  assert.equal(rounded, "#4d4d71", "and rounded it is one unit up on all three");
  assert.notEqual(floored, rounded, "so the two arithmetics are distinguishable on this input at all");
  assert.equal(ops[0].fill, floored, "the transform RAN, and it floored");
  assert.notEqual(ops[0].fill, rounded, "which is what `Math.round` would give");
  assert.equal(ops[0].stroke, floored, "the stroke takes the same arithmetic — `tintPack` is all that pins this");
});

test("the EIGHT-NUMBER array spelling of a transform is read, not dropped in silence", () => {
  // A colour transform exists in this tree in two shapes: the named object
  // `tools/extract-props.mjs` writes and the array `tools/extract-figure.mjs`
  // writes. A reader that took only one would drop every tint on the other
  // pack with no tint and no tally — this project's standing defect in a new
  // hat, and `colourTransformFrom` is why there is one reader for both.
  const pack = tintPack();
  const named = propOpsFor(pack, { linkage: "flat", frame: 1 });
  const array = propOpsFor(pack, { linkage: "arrayShaped", frame: 1 });
  assert.equal(array[0].fill, "#4c4c70", "the array shape reaches the same arithmetic");
  assert.equal(array[0].fillOpacity, named[0].fillOpacity);
});

test("an IDENTITY transform is not merely a no-op, it allocates nothing", () => {
  // The extractor stamps a colour block on EVERY placement, so `plain` carries
  // one and it changes nothing. `colourTransformFrom` collapsing it to `null`
  // is what keeps the gradient object shared instead of rebuilt 3,345 times,
  // and object identity is the only way to observe that from out here.
  //
  // ► **THIS TEST SURVIVES A FULL REVERT OF `props.js`, AND THAT IS NOT THE
  //   SAME AS BEING TOOTHLESS — BUT IT IS WORTH SAYING WHICH.** A wave-1
  //   verifier put it on a list of nine tests that stay green at HEAD, which is
  //   true: HEAD applies nothing, so an identity placement is trivially
  //   unchanged there too. What this catches is a mutation in the CURRENT code,
  //   and it was measured going red: make `colourTransformFrom` return its
  //   eight-number array for the identity instead of `null` and the `gradient`
  //   assertion below fails, because `transformGradient` then rebuilds and
  //   re-freezes every stop of all 1,054 gradient operations to arrive at the
  //   values it was already holding. A test that only excludes one direction
  //   should say so rather than be counted as coverage of both.
  const pack = tintPack();
  const ops = propOpsFor(pack, { linkage: "plain", frame: 1 });
  assert.equal(ops[0].fill, "#2d2dfd", "untouched");
  assert.equal(ops[0].fillOpacity, 1);
  assert.equal(ops[0].gradient, pack.shapes[3].paths[0].gradient, "the pack's own gradient object, not a copy of it");
});

test("a gradient's STOPS carry the transform, because that is where the painter reads alpha", () => {
  // ► **THIS LINE IS DEAD ON THE SCREENS PACK AND ALIVE ON THIS ONE.**
  //   `screen.js`'s header records that all 107 of its transformed gradient
  //   stops sit under ALPHA-ONLY transforms, so deleting its stop-fill
  //   transform moved no byte of its output. 70 of the props pack's stops sit
  //   under a transform that moves colour, so the same deletion here is
  //   visible — which is the whole reason to pin it by value.
  const ops = propOpsFor(tintPack(), { linkage: "ramp", frame: 1 });
  const stops = ops[0].gradient.stops;
  // 0x2d is 45; 45 * 0.5 is 22.5, floored to 22 (`0x16`). 0xfd is 253;
  // 253 * 0.5 is 126.5, floored to 126 (`0x7e`).
  assert.equal(stops[0].fill, "#16167e", "the RGB half reaches every stop");
  assert.equal(stops[1].fill, "#2f5f7f");
  // The alpha half too: `opacity * alphaMultiplier + alphaOffset / 255`, and
  // the offset is divided by 255 because these opacities are 0..1 and the
  // wire's offset is a colour byte. 51 / 255 is exactly 0.2.
  assert.equal(stops[0].opacity, 1, "clamped — 1 + 0.2 cannot exceed full");
  assert.equal(stops[1].opacity, 0.7, "0.5 + 0.2");
  assert.equal(ops[0].fill, "#16167e", "and the flat first-stop fallback moves with them");
});

test("a bitmap keeps the ALPHA half and loses the colour half, and the loss is COUNTED", () => {
  // A raster operation carries no colour for the RGB half to fold into — the
  // op reports the bitmap and leaves `fill` alone so the picture is not painted
  // over. Dropping that silently is the defect that left the arena walls
  // invisible; the count is the difference between an approximation and a lie.
  const pack = tintPack();
  const ops = propOpsFor(pack, { linkage: "raster", frame: 1 });
  assert.equal(ops[0].fillOpacity, 0.5, "the alpha half survives");
  assert.deepEqual(ops[0].bitmap, { id: 7 }, "and the raster is still named");
  const invoice = propInvoiceFor(pack, { linkage: "raster", frame: 1 });
  assert.equal(invoice.bitmapOps, 1, "the DENOMINATOR, without which the count below cannot be read");
  assert.equal(invoice.bitmapColourTransformDropped, 1);

  // ► **WHAT IS DROPPED IS THE RASTER, NOT "the colour half of the
  //   operation" — AND ON THIS FIXTURE THOSE ARE DIFFERENT THINGS.** `raster`
  //   carries a fallback hex fill beside its bitmap, and that fill is
  //   transformed like any other: `#000000` under redOffset 17 comes back
  //   `#110000`. The count is still 1 and is still right, because the pixels
  //   the painter draws are the BITMAP's and no arithmetic here reaches them.
  assert.equal(ops[0].fill, "#110000", "the fallback fill DID receive the colour half");

  // The shape the build actually produces: `fill: "none"`, so the colour half
  // lands nowhere at all and the two readings of the counter coincide. All 7
  // bitmap-bearing paths in the real pack look like this, which is why the
  // distinction above is invisible there and had to be built here.
  const bare = propOpsFor(pack, { linkage: "rasterNoFill", frame: 1 });
  assert.equal(bare[0].fill, "none", "nothing for the RGB half to fold into, which is the real pack's shape");
  assert.equal(bare[0].fillOpacity, 0.5, "and the alpha half still survives");
  const bareInvoice = propInvoiceFor(pack, { linkage: "rasterNoFill", frame: 1 });
  assert.equal(bareInvoice.bitmapOps, 1);
  assert.equal(bareInvoice.bitmapColourTransformDropped, 1, "the same count, on the same transform, for the same reason");

  // ► **AND THE OFFSETS ARE WHAT ANSWERS HERE.** This placement's three
  //   multipliers are all 1, so a `touchesRgb` that only looked at multipliers
  //   would count nothing — `#000000` under redOffset 17 is `#110000`, which is
  //   colour a raster has nowhere to put.
  const alphaOnly = propInvoiceFor(pack, { linkage: "rasterAlphaOnly", frame: 1 });
  assert.equal(alphaOnly.bitmapOps, 1, "the same bitmap");
  assert.equal(alphaOnly.bitmapColourTransformDropped, 0, "but nothing was dropped: this transform carries no colour");
});

test("an ALPHA OFFSET on a gradient of uneven stops is an approximation, and a level one is not", () => {
  // Transforming the stops and letting the canvas ramp interpolate is the same
  // picture as transforming the interpolated result whenever the transform is
  // linear in the interpolated quantity — true of a multiplier, false of an
  // offset added to stops that differ in opacity.
  const pack = tintPack();
  const uneven = propInvoiceFor(pack, { linkage: "ramp", frame: 1 });
  assert.equal(uneven.gradientOps, 1, "the denominator");
  assert.equal(uneven.gradientAlphaOffsetApproximated, 1);
  const level = propInvoiceFor(pack, { linkage: "levelRamp", frame: 1 });
  assert.equal(level.gradientOps, 1, "the same offset on the same kind of ramp");
  assert.equal(level.gradientAlphaOffsetApproximated, 0, "folds exactly, because both stops share one opacity");
});

test("the invoice counts what drew NOTHING, which used to be two silent `continue`s", () => {
  const pack = tintPack();
  const missing = propInvoiceFor(pack, { linkage: "gone", frame: 1 });
  assert.equal(missing.placements, 1, "the placement is still a placement");
  assert.equal(missing.ops, 0, "and it drew nothing");
  assert.equal(missing.shapesMissing, 1);
  assert.equal(propOpsFor(pack, { linkage: "gone", frame: 1 }), null, "the emission is unchanged: still null");

  // A placement that says it is clipped and whose cutter will not resolve draws
  // UNCLIPPED — larger than it should be, over things it should not cover.
  const uncut = propInvoiceFor(pack, { linkage: "uncuttable", frame: 1 });
  assert.equal(uncut.clipsUnresolved, 1);
  assert.equal(uncut.ops, 1, "it is still drawn, which is why the count is the only warning");
});

test("an absent pack invoices zero rather than throwing, like every other reader here", () => {
  for (const absent of [null, undefined, {}, { props: {}, shapes: null }]) {
    const invoice = propInvoiceFor(propPackFrom(absent), { linkage: "bullet", frame: 1 });
    assert.equal(invoice.placements, 0, `${JSON.stringify(absent)} invoices nothing`);
    assert.equal(invoice.ops, 0);
    assert.equal(invoice.bitmapColourTransformDropped, 0);
  }
  const unknown = propInvoiceFor(tintPack(), { linkage: "no_such_prop", frame: 1 });
  assert.equal(unknown.placements, 0, "and a prop this pack does not hold is the same answer");
});

test("propOpsFor still returns a FROZEN FLAT ARRAY, because an INJECTED SEAM takes it", () => {
  // ► **~~`tools/arena/main.js` pairs operations back to placements by counting
  //   and reads `ops[0]` in its probe.~~ NEITHER IS TRUE ANY MORE**, and the
  //   same stale sentence was sitting in `props.js`'s own docstring: the
  //   pairing lived in `tintedPropOpsFor` and the probe was
  //   `probeColourTransform`, both deleted with the double-applying shim on
  //   2026-09-14. `grep -rn 'ops\[0\]' src tools` finds nothing outside a
  //   comment. The surviving reason is better anyway — `arena-backdrop.js`
  //   takes this function as an ARGUMENT
  //   (`arenaScreenLayersFor(pack, propOpsFor, camera, dressing)`), so a
  //   `{ ops, invoice }` record breaks an injected seam and not one file. The
  //   invoice is a second FUNCTION for exactly that reason.
  //
  // ► **AND IT IS AN API GUARD, WHICH IS WHY IT PASSES AT HEAD.** Named,
  //   because a wave-1 verifier counted it among the tests that survive a full
  //   revert of `props.js` — correctly. The mutation it DOES catch was measured
  //   going red: returning `Object.freeze({ ops, invoice })` from `propOpsFor`
  //   fails `Array.isArray` here, and dropping the outer `Object.freeze` fails
  //   the line after. What it can never catch is the colour transform, and it
  //   does not claim to.
  const ops = propOpsFor(tintPack(), { linkage: "flat", frame: 1 });
  assert.ok(Array.isArray(ops), "an array, not a record with an `ops` field");
  assert.equal(Object.isFrozen(ops), true);
  assert.equal(ops[0].kind, "path");
  assert.equal(Object.prototype.hasOwnProperty.call(ops, "invoice"), false, "nothing rides home on the array");
});

/* ------------------------------------------------------------------ */
/* The same thing, against the player's own pack                        */
/* ------------------------------------------------------------------ */

test("THE SEVENTH TRAIL PUFF IS INVISIBLE, and it drew SOLID until the transform was read", () => {
  // ► **`bullet_trail` IS SEVEN FRAMES OF ONE SHAPE AND THE FADE IS ENTIRELY IN
  //   THE PLACEMENT'S COLOUR TRANSFORM.** Every one of its four paths carries
  //   `fillOpacity: 1` and the shape never changes — `distinctFrames` is 1 — so
  //   a reader that walked past `colour` drew all seven puffs at full strength,
  //   including the one the build fades to nothing.
  //
  // ► **AND THE FRAMES ARE ASKED FOR THROUGH `propOpsFor`, NOT THROUGH
  //   `arrowTrailOpsFor`, because they are two different questions now.** This
  //   one is "what is on sprite 48's seven frames", which is the oracle's fact
  //   and the thing `TRAIL_FADE` copies into the synthetic pack. What a caller
  //   should HAND those frames is the test below.
  assertRealPackPathIsDerivable();
  if (!REAL_PROPS) {
    // Asserted rather than skipped, so the suite's skip count stays meaningful.
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  assert.equal(propFrameCount(REAL_PROPS, "bullet_trail"), TRAIL_FADE.length, "seven frames, and the fixture copies all seven");
  for (let frame = 1; frame <= TRAIL_FADE.length; frame += 1) {
    const ops = propOpsFor(REAL_PROPS, { linkage: "bullet_trail", frame });
    assert.equal(ops.length, 4, `frame ${frame} is the same four-path puff`);
    for (const op of ops) {
      assert.equal(op.fillOpacity, TRAIL_FADE[frame - 1], `frame ${frame} draws at the build's own alpha`);
    }
  }
  const last = propOpsFor(REAL_PROPS, { linkage: "bullet_trail", frame: 7 });
  assert.equal(last[0].fillOpacity, 0, "the last puff puts down no pixel at all");
  assert.equal(last[0].fill, "#999999", "and its colour is untouched — the fade is alpha only");
});

test("THE ARENA DREW NO TRAIL AT ALL FOR 14 OF THE 20 BOWS, and this is what says so", () => {
  // ► **THE REGRESSION, PINNED AGAINST THE PLAYER'S OWN PACK.** Wave 1 made
  //   `propOpsFor` apply the placement's colour transform, which was right, and
  //   that exposed a defect older than itself: `arrowTrailOpsFor` was pushing
  //   `secondary_weapon - 60` — the ARROW's lookup, 1..20 over bows 61..80 —
  //   into `bullet_trail`'s seven-frame CLOCK. Clamped, bows 67-80 all landed
  //   on frame 7, `alphaMultiplier: 0`. Reproduced by the main session before
  //   this fix:
  //
  //   ```text
  //     bow 61 artFrame 1  -> 0.699, 0.699, 0.699, 0.699
  //     bow 67 artFrame 7  -> 0, 0, 0, 0
  //     bow 80 artFrame 20 -> 0, 0, 0, 0
  //   ```
  //
  //   The receiver settles it and the display list confirms it:
  //   `+0x7249`..`+0x7276` does `GetVariable "bullet_trail"`, then
  //   **`GetMember "bullet"`**, then `CallMethod "gotoAndStop"` — the weapon
  //   indexes a CHILD of the puff. Sprite 48's seven frames all place character
  //   47 under that instance name, and only the alpha moves.
  assertRealPackPathIsDerivable();
  if (!REAL_PROPS) {
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  // The band is DERIVED from the weapon table rather than written out, so a
  // change to which ids are bows moves this test instead of going stale.
  const artFrames = SS2_WEAPON_IDS.map((id) => ss2ArrowFrameFor(id)).filter((frame) => Number.isFinite(frame));
  assert.deepEqual(artFrames, Array.from({ length: 20 }, (unused, index) => index + 1),
    "twenty bows, art frames 1..20 — the range that was being fed to a SEVEN-frame clip");

  // ► **THE BUG, REPRODUCED THROUGH THE CALL `arrowTrailOpsFor` USED TO
  //   MAKE.** `frame: artFrame` on `bullet_trail`: `emitPropOps` clamps, so art
  //   frames 7..20 all resolve to frame 7 and come back at alpha 0. Fourteen of
  //   the twenty bows, drawing nothing. This assertion is deliberately written
  //   against `propOpsFor` and not against the fixed wrapper, because what has
  //   to stay pinned is the PROPERTY that made the old wiring fatal — seven
  //   slots cannot address twenty bows — and that property is the pack's, not
  //   the wrapper's.
  const blank = artFrames.filter((artFrame) =>
    propOpsFor(REAL_PROPS, { linkage: "bullet_trail", frame: artFrame })[0].fillOpacity === 0);
  assert.deepEqual(blank, artFrames.filter((artFrame) => artFrame >= 7), "art frames 7 and up, which is bows 67-80");
  assert.equal(blank.length, 14, "fourteen of twenty — the number in the finding");

  // ► **AND THE FIX: THE PUFF'S ALPHA IS NOT A FUNCTION OF THE BOW AT ALL.**
  //   Whatever loosed it, the newest puff is the first alpha and a puff four
  //   frames old is the fifth. If this ever starts varying with the weapon,
  //   somebody has wired the arrow's lookup back into the clock.
  for (const artFrame of artFrames) {
    assert.equal(arrowTrailOpsFor(REAL_PROPS, 0)[0].fillOpacity, TRAIL_FADE[0],
      `the newest puff behind art frame ${artFrame} is the FIRST alpha`);
    assert.equal(arrowTrailOpsFor(REAL_PROPS, 4)[0].fillOpacity, TRAIL_FADE[4],
      `and a four-frame-old one behind art frame ${artFrame} is the fifth`);
  }
});

test("the arena's UI BAR is a black plate and two invisible hit plates, not a white strip", () => {
  // Four placements of ONE white rectangle (shape 487), which is why dropping
  // the transform rendered the bar as a blank white strip: the plate, the rule
  // along its top and the two toggles' hit plates are the same drawing.
  assertRealPackPathIsDerivable();
  if (!REAL_PROPS) {
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  const ops = propOpsFor(REAL_PROPS, { linkage: "panel", frame: 1 });
  assert.equal(ops.length, 4, "four placements of a one-path shape");
  assert.equal(ops[0].fill, "#000000", "the bar's own ground: `#ffffff` under rgb x0");
  assert.equal(ops[0].fillOpacity, 0.5, "at half alpha");
  assert.equal(ops[1].fill, "#ffffff", "the 2.8px highlight along the top is the one identity placement");
  assert.equal(ops[1].fillOpacity, 1);
  assert.equal(ops[2].fillOpacity, 0, "the sound toggle's INVISIBLE hit plate");
  assert.equal(ops[3].fillOpacity, 0, "and the tooltips toggle's");
});

test("the SKY's day/night colouring is this transform, pinned by value on two frames", () => {
  assertRealPackPathIsDerivable();
  if (!REAL_PROPS) {
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  // Frame 1, second placement: shape 1681 is a flat `#ffffff` sheet under
  // multiplier 0.30078125 with blueOffset 36. Floored that is `#4c4c70`;
  // ROUNDED it is `#4d4d71`, which is the same one-unit disagreement
  // `render-screen.test.js` pins on its own pack — 3,888 of this pack's 4,575
  // colour-moving fills move under that change.
  const dawn = propOpsFor(REAL_PROPS, { linkage: "sky", frame: 1 });
  assert.equal(dawn[1].fill, "#4c4c70", "the sheet, floored");
  assert.notEqual(dawn[1].fill, "#4d4d71", "and not rounded");

  // Frame 88, first placement: shape 1679's `#2d2dfd`→`#5fbefe` ramp under
  // multiplier 0.91015625 with every offset 23. **The RGB half of the gradient
  // fold is UNREACHABLE on the screens pack and reachable here**, so this is
  // the assertion that dies if the stop-fill transform is deleted.
  const dusk = propOpsFor(REAL_PROPS, { linkage: "sky", frame: 88 });
  assert.deepEqual(dusk[0].gradient.stops.map((stop) => stop.fill), ["#3f3ffd", "#6dc3fe"]);
  assert.equal(dusk[0].fill, "#3f3ffd", "and the flat fallback follows the first stop");
  assert.equal(dusk[dusk.length - 1].fill, "#ffefef", "the same sheet, now under 0.9375 with redOffset 16");
});

test("THE ARROW AND THE SCENERY CARRY NO TINT AT ALL, so a sweep over them proves nothing", () => {
  // ► **A COUNT OVER DATA THAT CANNOT CHANGE IS NOT A CHECK, AND TWO OF THIS
  //   MODULE'S THREE CONVENIENCES ARE EXACTLY THAT.** `arrowOpsFor` and
  //   `arenaSceneryFor` were cited as evidence that the colour transform is now
  //   applied once; a wave-1 verifier re-derived the pack and found neither can
  //   say anything about it, because neither reaches a tinted placement. So the
  //   vacuity is MEASURED here rather than left as a sentence in a docstring:
  //   if the extractor ever starts carrying a transform on the arrow or the
  //   rock, this goes red and both docstrings get corrected instead of quietly
  //   becoming false.
  assertRealPackPathIsDerivable();
  if (!REAL_PROPS) {
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  let arrow = { placements: 0, tintedPlacements: 0, ops: 0 };
  for (let frame = 1; frame <= propFrameCount(REAL_PROPS, "bullet"); frame += 1) {
    const invoice = propInvoiceFor(REAL_PROPS, { linkage: "bullet", frame });
    for (const key of Object.keys(arrow)) arrow[key] += invoice[key];
  }
  assert.equal(arrow.placements, 50, "fifty frames, one placement each");
  assert.equal(arrow.ops, 294, "the denominator a zero below has to be read against");
  assert.equal(arrow.tintedPlacements, 0,
    "NOT ONE of them is tinted, so `propOpsFor`'s whole fold is a no-op on every arrow this build has");

  const rock = propInvoiceFor(REAL_PROPS, { linkage: "rockMC", frame: 1 });
  assert.equal(rock.placements, 1);
  assert.equal(rock.ops, 5);
  assert.equal(rock.tintedPlacements, 0, "and the scenery is the same — one placement, no transform");
  for (const piece of arenaSceneryFor(REAL_PROPS)) {
    assert.equal(piece.ops.length, 5, `${piece.instance} is the same five operations, differing only in x`);
  }

  // ► **WHERE THE LIVE EVIDENCE ACTUALLY IS**, so the reader who needs a
  //   varying case knows which linkage to reach for. These three are the only
  //   props in the build that carry a non-identity transform at all.
  const tintedBy = {};
  for (const linkage of Object.keys(REAL_PROPS.props)) {
    let tinted = 0;
    for (let frame = 1; frame <= propFrameCount(REAL_PROPS, linkage); frame += 1) {
      tinted += propInvoiceFor(REAL_PROPS, { linkage, frame }).tintedPlacements;
    }
    if (tinted > 0) tintedBy[linkage] = tinted;
  }
  assert.deepEqual(tintedBy, { bullet_trail: 7, sky: 2320, panel: 3 },
    "three linkages out of twelve, and `bullet` and `rockMC` are not among them");
});

test("what the real pack's colour transforms COULD have varied over, counted", () => {
  // ► **A COUNT OVER DATA THAT CANNOT CHANGE IS NOT A CHECK**, so each number
  //   below is stated with the population it was drawn from. Every one of them
  //   was measured by walking `assets/props/props.json` directly, before this
  //   module could apply anything, and they are asserted here against the
  //   module's own invoice so that the two readings have to keep agreeing.
  assertRealPackPathIsDerivable();
  if (!REAL_PROPS) {
    assert.equal(REAL_PROPS, null, "no extraction on this machine");
    return;
  }
  const total = { placements: 0, tintedPlacements: 0, ops: 0, tintedOps: 0, bitmapOps: 0, gradientOps: 0, bitmapColourTransformDropped: 0, gradientAlphaOffsetApproximated: 0 };
  for (const linkage of Object.keys(REAL_PROPS.props)) {
    for (let frame = 1; frame <= propFrameCount(REAL_PROPS, linkage); frame += 1) {
      const invoice = propInvoiceFor(REAL_PROPS, { linkage, frame });
      for (const key of Object.keys(total)) total[key] += invoice[key];
    }
  }
  assert.equal(total.placements, 3345);
  assert.equal(total.tintedPlacements, 2330, "70% of them — this pack is mostly TINTED, unlike the screens one");
  assert.equal(total.ops, 8682);
  assert.equal(total.tintedOps, 7246);

  // ► **BOTH APPROXIMATION COUNTS ARE DEAD ON THIS PACK, and the denominators
  //   are what says so instead of letting two zeros read as "nothing lost".**
  //   41 bitmap operations exist and not one of them sits under a transform;
  //   1,054 gradient operations exist and no placement in the pack carries a
  //   non-zero alphaOffset at all. `tintPack` above is what exercises them.
  assert.equal(total.bitmapOps, 41, "so a zero below is a zero out of 41, not out of nothing");
  assert.equal(total.gradientOps, 1054);
  assert.equal(total.bitmapColourTransformDropped, 0);
  assert.equal(total.gradientAlphaOffsetApproximated, 0);

  // The sky is 7,215 of the 7,246 tinted operations, which is why this is the
  // arena's backdrop defect and not a cosmetic one.
  let sky = 0;
  for (let frame = 1; frame <= propFrameCount(REAL_PROPS, "sky"); frame += 1) {
    sky += propInvoiceFor(REAL_PROPS, { linkage: "sky", frame }).tintedOps;
  }
  assert.equal(sky, 7215);
});
