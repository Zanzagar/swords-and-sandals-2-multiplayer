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
import test from "node:test";

import {
  applyCommands,
  emptyScene,
  arrowOpsFor,
  arrowTrailOpsFor,
  hasExtractedProps,
  propFrameCount,
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
    bullet_trail: {
      linkage: "bullet_trail",
      character: 48,
      frames: [[{ shape: 44, matrix: [1, 0, 0, 1, 0, 0] }]]
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

test("the trail is its own prop, read the same way", () => {
  const pack = packOf();
  const ops = arrowTrailOpsFor(pack, 1);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].fill, "#ddd");
  assert.equal(propFrameCount(pack, "bullet_trail"), 1);
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
