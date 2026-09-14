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
  propPackFrom
} from "../src/render/index.js";
import { ss2ArrowFrameFor, ss2RangedWeaponFor, ss2WeaponEntry, SS2_WEAPON_IDS } from "../src/team/ss2-weapon-table.js";
import { CommandKind, SS2_STATIC_MAP_BINDINGS, buildArenaLayout, presentResolvedEvents } from "../src/adapter/index.js";
import { PROP_EXPORTS } from "../tools/extract-props.mjs";

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
    assert.match(prop.linkage, /^[a-z_]+$/, "the build's own linkage name");
    assert.ok(prop.indexedBy.length > 0, `${prop.linkage} must say what its frame number MEANS`);
    assert.ok(prop.reader.length > 0, `${prop.linkage} must name what reads it, or say plainly that nothing does`);
  }
  const arrow = PROP_EXPORTS.find((prop) => prop.linkage === "bullet");
  assert.equal(arrow.indexedBy, "secondary_weapon - 60", "the build's own lookup");
});
