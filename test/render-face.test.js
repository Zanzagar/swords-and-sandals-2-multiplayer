/**
 * THE GLADIATOR'S FACE — which expression the build asks for, and where it lands
 * on the head.
 *
 * ► **THERE IS NO FIXTURE, AND THERE MUST NOT BE.** This repository ships no SS2
 *   asset: `assets/` is gitignored AND `test/asset-attestation.test.js` fails if
 *   anything under it is tracked. So every pack here is built by hand in the
 *   shape `tools/extract-icons.mjs` writes, which is also the honest thing —
 *   what is under test is `face.js`'s READING of that shape, not the contents of
 *   one person's install. Nothing here skips: a fresh clone runs all of it.
 *
 * The two things worth testing, and they are not "the geometry is pretty":
 *
 * 1. **An expression that does not resolve must fall back to a NAMED default and
 *    be COUNTED.** The build's own script asks `mouth1` for `Smile` five times
 *    and for `pain` once, and `mouth1` has neither; 29 further calls differ from
 *    the label only in case; 18 of the fighter's 101 animations bind nothing at
 *    all and ten more never touch the mouth. A renderer that quietly drew
 *    `normal` for every one of those would look exactly like a renderer that had
 *    read the build correctly. **An approximation that is not counted is
 *    indistinguishable from a correct read.**
 *
 * 2. **The offset is in ACTIONSCRIPT PIXELS and every matrix beside it is in
 *    TWIPS.** `head.eyes._x = -3` is a MovieClip property; `[1,0,0,1,-42,0]` is
 *    a SWF matrix. Twenty times out is a face sitting on the chin, and this seam
 *    has already produced three defects in this repository. The numbers below
 *    are exact and a factor of twenty apart from the wrong reading.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_EXPRESSION,
  FACE_PARTS,
  expressionFor,
  faceCoverageFor,
  faceOpsFor,
  facePackFrom,
  hasExtractedFace,
  mergeFaceOps
} from "../src/render/face.js";
import { figurePackFrom, paintExtractedFigure } from "../src/render/extracted-figure.js";
import { applyColourTransform } from "../src/render/filters.js";

/* ------------------------------------------------------------------ */
/* The packs, in the shape the two extractors actually write            */
/* ------------------------------------------------------------------ */

/**
 * A figure pack whose numbers make the arena transform an IDENTITY on the
 * pixels: the scale is the build's one arena unit per clip pixel at height 1
 * (`clipHeight` 150 no longer matters — it did while the rig was fitted to the
 * authored 150-unit figure, until 2026-09-23), and `centreX` and `groundY`
 * are 0. Every coordinate asserted below is then
 * the clip's own, which is what makes a twips/pixels error visible as itself
 * rather than as a number nobody can check by hand.
 */
const figurePack = () => figurePackFrom(
  {
    1: { bounds: {}, paths: [{ d: "M0 0L10 0", fill: "#442200" }] },
    2: { bounds: {}, paths: [{ d: "M0 0L4 4", fill: "#ff0000" }] }
  },
  {
    standing: {
      label: "Standing",
      firstFrame: 1,
      lastFrame: 2,
      // Two poses, so `at` has somewhere to move and the frame join is testable.
      poses: [
        [
          { shape: 1, limb: "head", depth: [25, 1, 1], matrix: [1, 0, 0, 1, 0, -2000] },
          { shape: 2, limb: "torso", depth: [23, 1, 1], matrix: [1, 0, 0, 1, 0, -1000] }
        ],
        [
          { shape: 1, limb: "head", depth: [25, 1, 1], matrix: [1, 0, 0, 1, 0, -2000] },
          { shape: 2, limb: "torso", depth: [23, 1, 1], matrix: [1, 0, 0, 1, 0, -1000] }
        ]
      ],
      limbs: [
        { head: [1, 0, 0, 1, 0, -2000], torso: [1, 0, 0, 1, 0, -1000] },
        { head: [1, 0, 0, 1, 0, -2000], torso: [1, 0, 0, 1, 0, -1000] }
      ],
      bounds: { xMin: -50, xMax: 50, yMin: -150, yMax: 0 }
    },
    taunt: {
      label: "Taunt",
      firstFrame: 10,
      lastFrame: 14,
      poses: Array.from({ length: 5 }, () => [{ shape: 1, limb: "head", depth: [25, 1, 1], matrix: [1, 0, 0, 1, 0, -2000] }]),
      limbs: Array.from({ length: 5 }, () => ({ head: [1, 0, 0, 1, 0, -2000] })),
      bounds: { xMin: -50, xMax: 50, yMin: -150, yMax: 0 }
    },
    // The build has animations that never set a face, and one pose here has no
    // head at all — `little_fat_kid` really is like this on the oracle.
    roll: {
      label: "Roll",
      firstFrame: 20,
      lastFrame: 20,
      poses: [[{ shape: 2, limb: "torso", depth: [23, 1, 1], matrix: [1, 0, 0, 1, 0, -1000] }]],
      limbs: [{ torso: [1, 0, 0, 1, 0, -1000] }],
      bounds: { xMin: -50, xMax: 50, yMin: -150, yMax: 0 }
    }
  }
);

/** One expression in the shape `extract-icons.mjs` writes: a run of identical poses. */
const expressionOf = (label, first, last, placements) => ({
  label,
  firstFrame: first,
  lastFrame: last,
  frameCount: last - first + 1,
  distinctPoses: 1,
  stopsAtEnd: true,
  poses: Array.from({ length: last - first + 1 }, () => placements)
});

/**
 * A face pack carrying the oracle's OWN attach facts — head, depths 1 and 2,
 * `(-3, -14)` on the eyes and nothing on the mouth — with a small stand-in
 * vocabulary. `overrides` replaces whole branches so a test can express one
 * broken thing without restating the rest.
 */
const facePack = (overrides = {}) => facePackFrom({
  faces: {
    eyes: {
      linkage: "eyes1",
      character: 898,
      attachedTo: "head",
      instance: "eyes",
      depth: 1,
      offset: { x: -3, y: -14 },
      expressionCount: 3,
      everyExpressionIsOnePose: true,
      expressions: {
        normal: expressionOf("Normal", 1, 9, [{ kind: "shape", character: 889, matrix: [1, 0, 0, 1, -42, 0] }]),
        up: expressionOf("Up", 10, 19, [{ kind: "shape", character: 889, matrix: [1, 0, 0, 1, -42, -30] }]),
        angry: expressionOf("Angry", 20, 29, [{ kind: "shape", character: 890, matrix: [1, 0, 0, 1, 0, 0] }])
      },
      ...overrides.eyes
    },
    mouth: {
      linkage: "mouth1",
      character: 909,
      attachedTo: "head",
      instance: "mouth",
      depth: 2,
      offset: null,
      expressionCount: 2,
      everyExpressionIsOnePose: true,
      expressions: {
        normal: expressionOf("Normal", 1, 9, [{ kind: "shape", character: 899, matrix: [1, 0, 0, 1, 0, 0] }]),
        smirk: expressionOf("Smirk", 10, 19, [{ kind: "shape", character: 900, matrix: [1, 0, 0, 1, 0, 0] }])
      },
      ...overrides.mouth
    }
  },
  shapes: {
    889: { bounds: {}, paths: [{ d: "M0 0L2 0", fill: "#ffffff", strokeWidth: 0 }] },
    890: { bounds: {}, paths: [{ d: "M0 0L3 0", fill: "#ffffff", strokeWidth: 0 }] },
    899: { bounds: {}, paths: [{ d: "M0 0Q1 1 2 0", fill: "none", stroke: "#000000", strokeWidth: 2 }] },
    900: { bounds: {}, paths: [{ d: "M0 0L1 1", fill: "none", stroke: "#000000", strokeWidth: 2 }] },
    ...overrides.shapes
  },
  expressionScript: {
    driver: { character: 1241, linkage: "hero_battle" },
    callCount: 4,
    bindings: overrides.bindings ?? {
      standing: {
        animation: "Standing",
        eyes: [{ frame: 1, method: "gotoAndPlay", asked: "Normal", resolved: "Normal", status: "exact", expression: "normal" }],
        mouth: [{ frame: 1, method: "gotoAndPlay", asked: "Normal", resolved: "Normal", status: "exact", expression: "normal" }]
      },
      // The build's own two failure modes, on the build's own pattern: a call
      // that matched only after lower-casing, and a call naming a label that
      // does not exist at all.
      taunt: {
        animation: "Taunt",
        eyes: [
          { frame: 10, method: "gotoAndPlay", asked: "angry", resolved: "Angry", status: "case", expression: "angry" },
          { frame: 13, method: "gotoAndPlay", asked: "Up", resolved: "Up", status: "exact", expression: "up" }
        ],
        mouth: [{ frame: 10, method: "gotoAndPlay", asked: "Smile", resolved: null, status: "missing", expression: null }]
      }
    }
  },
  ...overrides.top
});

/** Every operation in a list that belongs to one face part. */
function opsFor(face, part) {
  const ops = face.ops.filter((op) => op.slot === part);
  assert.ok(Array.isArray(ops), `${part} operations must be a list`);
  return ops;
}

/**
 * Recompute the approximation tally from the RESULT's own data, exactly as
 * `test/extraction-honesty.test.js` recomputes a manifest's from its pack.
 *
 * ► **THIS IS THE POINT OF THE FILE.** A count that is written rather than
 *   derived will agree with itself forever; this derives the same number a
 *   second way, from the resolutions and the skip list, so a reader that
 *   approximates something new and forgets to count it fails by name.
 */
function assertCountsAreRecomputable(face) {
  const expected = {};
  const bump = (kind) => { expected[kind] = (expected[kind] ?? 0) + 1; };
  for (const part of FACE_PARTS) {
    const status = face[part].status;
    if (status === "case") bump("label-case");
    else if (status === "missing") bump("label-missing");
    else if (status === "silent") bump("label-silent");
    else if (status === "pending") bump("label-pending");
    else if (status === "unbound") bump("label-unbound");
    else if (status === "absent") bump("part-absent");
  }
  // Two enumerable lists: `skipped` is what drew NOTHING, `notes` is what drew
  // with a judgement in it. Between them and the two resolutions, every tick in
  // the tally has a second derivation.
  for (const entry of face.skipped) bump(entry.reason);
  for (const entry of face.notes) bump(entry.reason);
  assert.deepEqual(
    face.approximations, expected,
    "the reported approximations must equal the ones recomputable from the resolutions, the skip list and the notes"
  );
}

/* ------------------------------------------------------------------ */
/* Running with no pack at all, which is how a fresh clone runs         */
/* ------------------------------------------------------------------ */

test("no icons pack means NO FACE, not a crash — which is how a fresh clone runs", () => {
  for (const absent of [null, undefined, {}, { faces: null }, { faces: {}, shapes: {} }, "nonsense", 7]) {
    const pack = facePackFrom(absent);
    assert.equal(pack, null, `${JSON.stringify(absent) ?? "undefined"} is not a face pack`);
    assert.equal(hasExtractedFace(pack), false);
    assert.equal(faceOpsFor(pack, figurePack(), { family: "standing", label: "standing" }), null);
    const resolution = expressionFor(pack, { part: "eyes", label: "standing" });
    assert.equal(resolution.status, "absent", "and asking for an expression says so rather than throwing");
    assert.equal(resolution.expression, null);
  }
});

test("no FIGURE pack means no face either: the face is geometry on the body", () => {
  // The icons pack says WHAT to draw and the figure pack says WHERE the head is
  // this frame. Half the information is not half a face, it is none.
  assert.equal(faceOpsFor(facePack(), null, { family: "standing", label: "standing" }), null);
  assert.equal(faceOpsFor(facePack(), {}, { family: "standing", label: "standing" }), null);
});

test("a pack with no expression script is READABLE, and every animation in it is unbound", () => {
  // A different answer from "no pack", and the difference is worth keeping: the
  // art is there and only the join is missing, so the face still draws.
  const pack = facePackFrom({
    faces: facePack().parts && {
      eyes: {
        attachedTo: "head", depth: 1, offset: { x: -3, y: -14 },
        expressions: { normal: expressionOf("Normal", 1, 9, [{ kind: "shape", character: 889, matrix: [1, 0, 0, 1, 0, 0] }]) }
      },
      mouth: {
        attachedTo: "head", depth: 2, offset: null,
        expressions: { normal: expressionOf("Normal", 1, 9, [{ kind: "shape", character: 899, matrix: [1, 0, 0, 1, 0, 0] }]) }
      }
    },
    shapes: { 889: { paths: [{ d: "M0 0L2 0", fill: "#ffffff" }] }, 899: { paths: [{ d: "M0 0L1 0", stroke: "#000000", strokeWidth: 2 }] } }
  });
  assert.equal(hasExtractedFace(pack), true);
  const face = faceOpsFor(pack, figurePack(), { family: "standing", label: "standing" });
  assert.equal(face.eyes.status, "unbound");
  assert.equal(face.eyes.expression, DEFAULT_EXPRESSION, "and it still draws, at the named default");
  assert.equal(face.approximations["label-unbound"], 2, "both parts, counted");
  assert.ok(face.ops.length > 0, "an unbound animation still gets a face");
  assertCountsAreRecomputable(face);
});

/* ------------------------------------------------------------------ */
/* THE JOIN: which expression, and why                                  */
/* ------------------------------------------------------------------ */

test("the expression is a function of the ANIMATION, not of the gladiator", () => {
  // ► This is the whole design. `eyes1` and `mouth1` are the only members of
  //   their families in the build — there is no `eyes2` — so nothing about WHO
  //   is fighting changes the face. What changes it is which clip is playing,
  //   which is the same join sound and art already use.
  const pack = facePack();
  assert.equal(expressionFor(pack, { part: "eyes", label: "standing" }).expression, "normal");
  assert.equal(expressionFor(pack, { part: "eyes", label: "taunt" }).expression, "angry");
  assert.equal(expressionFor(pack, { part: "mouth", label: "standing" }).expression, "normal");
});

test("the animation label is matched case-insensitively, because the build writes both", () => {
  // The fighter's labels are `Standing` and `Taunt`; every pack keys them
  // lower-cased. A caller holding either must reach the same binding.
  const pack = facePack();
  for (const label of ["taunt", "Taunt", "TAUNT"]) {
    assert.equal(expressionFor(pack, { part: "eyes", label }).expression, "angry", `${label} must reach the same binding`);
  }
});

test("a call that matched only after lower-casing is COUNTED, not flattened away", () => {
  // 29 of the build's own 228 calls are like this — `gotoAndPlay("angry")`
  // against a frame labelled `Angry`. Whether the player's runtime honours it is
  // a question this repository has not measured, so the renderer records that it
  // made the judgement rather than pretending the label matched.
  const face = faceOpsFor(facePack(), figurePack(), { family: "taunt", label: "taunt", at: 0 });
  assert.equal(face.eyes.status, "case");
  assert.equal(face.eyes.asked, "angry");
  assert.equal(face.eyes.expression, "angry");
  assert.equal(face.approximations["label-case"], 1);
  assertCountsAreRecomputable(face);
});

test("a label the clip does not have falls back to a NAMED default and is counted", () => {
  // `mouth.gotoAndPlay("Smile")` — the build asks five times in `wincrowd4` and
  // `mouth1` has no such frame. **In Flash this call does nothing at all**, so
  // the only wrong answer is a silent one.
  const face = faceOpsFor(facePack(), figurePack(), { family: "taunt", label: "taunt", at: 0 });
  assert.equal(face.mouth.status, "missing");
  assert.equal(face.mouth.asked, "Smile");
  assert.equal(face.mouth.resolved, null, "nothing resolved it");
  assert.equal(face.mouth.expression, DEFAULT_EXPRESSION);
  assert.equal(face.mouth.fallback, DEFAULT_EXPRESSION, "and the default is NAMED in the result");
  assert.equal(face.approximations["label-missing"], 1);
  assert.equal(opsFor(face, "mouth").length, 1, "a mouth that could not resolve still draws one");
  assertCountsAreRecomputable(face);
});

test("`held` reproduces the build's no-op `gotoAndPlay` exactly", () => {
  // A `gotoAndPlay` on a label a clip does not have leaves the playhead where it
  // is, so the face keeps what it was showing. A pure function has no "was", so
  // the caller hands back what it last saw — and then this is not an
  // approximation at all.
  const face = faceOpsFor(facePack(), figurePack(), {
    family: "taunt", label: "taunt", at: 0, held: { mouth: "smirk" }
  });
  assert.equal(face.mouth.expression, "smirk");
  assert.equal(face.mouth.fallback, "held");
  assert.equal(face.approximations["label-missing"], 1, "still counted: the BUILD's call still failed");
});

test("a `held` expression this pack does not have is ignored rather than drawn", () => {
  // The caller's memory is an input like any other, and a pack that has been
  // swapped underneath it must not make the face vanish.
  const face = faceOpsFor(facePack(), figurePack(), {
    family: "taunt", label: "taunt", at: 0, held: { mouth: "no-such-expression" }
  });
  assert.equal(face.mouth.expression, DEFAULT_EXPRESSION);
  assert.equal(face.mouth.fallback, DEFAULT_EXPRESSION);
});

test("an animation that never touches the mouth is SILENT, not normal by accident", () => {
  // Ten of the 83 bound animations move the eyes and leave the mouth alone —
  // `stepback`, `block`, `attack3`, `runforward` … The build keeps the previous
  // mouth; this says out loud that it could not.
  const pack = facePack({
    bindings: {
      standing: {
        animation: "Standing",
        eyes: [{ frame: 1, asked: "Normal", resolved: "Normal", status: "exact", expression: "normal" }],
        mouth: []
      }
    }
  });
  const face = faceOpsFor(pack, figurePack(), { family: "standing", label: "standing", at: 0 });
  assert.equal(face.eyes.status, "exact");
  assert.equal(face.mouth.status, "silent");
  assert.equal(face.mouth.expression, DEFAULT_EXPRESSION);
  assert.equal(face.approximations["label-silent"], 1);
  assert.equal(face.approximations["label-case"], undefined, "and nothing else is invented into the tally");
  assertCountsAreRecomputable(face);
});

test("an animation with no binding at all is UNBOUND, and that is not the same as silent", () => {
  // 18 of the fighter's 101 animations make no expression call whatsoever.
  // "this animation sets no mouth" and "nothing in the script mentions this
  // animation" are different findings and they are counted differently.
  // ► **AND THE FACE FOLLOWS THE BODY'S RESOLUTION, NOT THE CALLER'S WORD.**
  //   `roll` is not one of the `standing` family's labels, so `animationFor`
  //   draws `standing` instead — and the face must therefore be `standing`'s,
  //   not an unbound fallback for a label nothing is drawing.
  const face = faceOpsFor(facePack(), figurePack(), { family: "standing", label: "roll", at: 0 });
  assert.equal(face.label, "standing");
  assert.equal(face.eyes.status, "exact", "the face answers for the animation that is actually playing");
  const direct = expressionFor(facePack(), { part: "eyes", label: "roll" });
  assert.equal(direct.status, "unbound");
  assert.equal(direct.animation, null);
  assert.equal(direct.expression, DEFAULT_EXPRESSION);
});

test("an expression set part-way through an animation is PENDING before its frame", () => {
  // `celebrate1` and `flame_repeat` set their faces five and six frames in. The
  // frames before that are still wearing the previous animation's expression,
  // which is a fact about the build rather than a gap in the data.
  const pack = facePack();
  const early = faceOpsFor(pack, figurePack(), { family: "taunt", label: "taunt", at: 0 });
  assert.equal(early.frame, 10, "frame 10 is the animation's first");
  assert.equal(early.eyes.status, "case", "the frame-10 call has fired");
  const later = faceOpsFor(pack, figurePack(), { family: "taunt", label: "taunt", at: 1 });
  assert.equal(later.frame, 14);
  assert.equal(later.eyes.expression, "up", "and by frame 13 the second call has replaced it");

  const late = facePack({
    bindings: {
      taunt: {
        animation: "Taunt",
        eyes: [{ frame: 13, asked: "Up", resolved: "Up", status: "exact", expression: "up" }],
        mouth: []
      }
    }
  });
  const pending = faceOpsFor(late, figurePack(), { family: "taunt", label: "taunt", at: 0 });
  assert.equal(pending.eyes.status, "pending");
  assert.equal(pending.eyes.expression, DEFAULT_EXPRESSION);
  assert.equal(pending.approximations["label-pending"], 1);
  assertCountsAreRecomputable(pending);
});

test("the call in force is the LAST one at or before the frame, not the first", () => {
  // `gotoAndPlay` is an event: it fires on its frame and the pose it selects
  // holds until the next call. Taking the first call would freeze a whole
  // animation on its opening expression — `wincrowd4` alone would lose seven of
  // its eight eye changes.
  const pack = facePack();
  const frames = [10, 11, 12, 13, 14].map((frame) => expressionFor(pack, { part: "eyes", label: "taunt", frame }).expression);
  assert.deepEqual(frames, ["angry", "angry", "angry", "up", "up"]);
});

test("with no frame at all, the answer is the expression the animation OPENS with", () => {
  // 152 of the build's 156 call lists set their expression on the animation's
  // own first frame, so this is the answer for all but four of them — and it is
  // a stated rule rather than an accident of iteration order.
  assert.equal(expressionFor(facePack(), { part: "eyes", label: "taunt", frame: null }).expression, "angry");
});

/* ------------------------------------------------------------------ */
/* THE GEOMETRY, and the seam that has cost this repository three bugs  */
/* ------------------------------------------------------------------ */

test("the eyes' offset is in ACTIONSCRIPT PIXELS while every matrix is in TWIPS", () => {
  // ► **A FACTOR OF TWENTY, AND IT IS VISIBLE IN THESE EXACT NUMBERS.**
  //   `head.eyes._x = -3` / `_y = -14` are MovieClip properties, in pixels;
  //   `[1,0,0,1,-42,0]` is a SWF matrix, in twips. The figure pack here is built
  //   so the arena transform is an identity on pixels (one arena unit per clip
  //   pixel, centreX 0, groundY 0), so the translation below is the clip's own:
  //
  //     head limb    ty -2000 twips  = -100 px
  //     eye placement tx  -42 twips  =   -2.1 px
  //     attach offset    (-3, -14) PIXELS
  //     so x = -2.1 + -3 = -5.1, and y flips to -(-100 + -14) = 114
  //
  //   Read as twips the offset would give x = -2.25 and y = 100.7 — a face on
  //   the chin, and a difference no count could ever notice.
  const face = faceOpsFor(facePack(), figurePack(), { family: "standing", label: "standing", at: 0, height: 1 });
  const [eyes] = opsFor(face, "eyes");
  assert.equal(eyes.matrix[4], -5.1);
  assert.equal(eyes.matrix[5], 114);
});

test("the mouth carries NO offset, and must not be given one", () => {
  // Measured on the oracle: `updatecharacter` sets `_x`/`_y` on `head.eyes` and
  // on nothing else. The mouth sits at the head clip's own origin, so its
  // translation is the head's translation, y-flipped and nothing more.
  const face = faceOpsFor(facePack(), figurePack(), { family: "standing", label: "standing", at: 0, height: 1 });
  const [mouth] = opsFor(face, "mouth");
  assert.equal(mouth.matrix[4], 0);
  assert.equal(mouth.matrix[5], 100);
});

test("the face rides the HEAD's matrix, so it rotates and mirrors with the head", () => {
  // Both clips attach to the head limb, which is why there is no facing logic
  // here at all: a mirrored head mirrors its face for free. A face composed
  // against the figure's root instead would stay put while the head turned.
  const mirrored = figurePackFrom(
    { 1: { bounds: {}, paths: [{ d: "M0 0L10 0", fill: "#442200" }] } },
    {
      standing: {
        label: "Standing", firstFrame: 1, lastFrame: 1,
        poses: [[{ shape: 1, limb: "head", depth: [25, 1, 1], matrix: [-1, 0, 0, 1, 0, -2000] }]],
        limbs: [{ head: [-1, 0, 0, 1, 0, -2000] }],
        bounds: { xMin: -50, xMax: 50, yMin: -150, yMax: 0 }
      }
    }
  );
  const face = faceOpsFor(facePack(), mirrored, { family: "standing", label: "standing", at: 0, height: 1 });
  const [eyes] = opsFor(face, "eyes");
  assert.equal(eyes.matrix[0], -1, "the head's mirror reaches the eye");
  // x = -1 * (-42/20 + -3) = 5.1 — the offset is mirrored WITH the head, which
  // is what `attachMovie` into the limb does and what adding the offset after
  // the limb transform would not.
  assert.equal(eyes.matrix[4], 5.1);
});

test("height scales the face by exactly the factor it scales the body", () => {
  // The face must not float above a short gladiator's head. `clipToArenaScale`
  // is the same function `paintExtractedFigure` composes into every limb, so
  // this is one factor rather than two that can drift.
  const half = faceOpsFor(facePack(), figurePack(), { family: "standing", label: "standing", at: 0, height: 0.5 });
  const [eyes] = opsFor(half, "eyes");
  assert.equal(eyes.matrix[4], -2.55);
  assert.equal(eyes.matrix[5], 57);
});

test("fade reaches the face, so a dying gladiator's eyes fade with him", () => {
  const face = faceOpsFor(facePack(), figurePack(), { family: "standing", label: "standing", at: 0, fade: 0.25 });
  for (const op of face.ops) assert.equal(op.alpha, 0.75);
});

test("path data is carried through UNSCALED, stroke width included", () => {
  // The matrix already carries the scale and the shell sets `lineWidth` after
  // applying it, so pre-scaling here would apply the factor twice — the defect
  // `extracted-figure.js` records at this same line, where a test had inherited
  // the code's wrong model.
  const face = faceOpsFor(facePack(), figurePack(), { family: "standing", label: "standing", at: 0, height: 2 });
  const [mouth] = opsFor(face, "mouth");
  assert.equal(mouth.strokeWidth, 2, "the shape's own pixels, whatever the figure's height");
  assert.equal(mouth.d, "M0 0Q1 1 2 0");
  assert.equal(mouth.stroke, "#000000");
  assert.equal(mouth.fill, "none");
});

test("the face resolves through the SAME animation the body draws", () => {
  // ► **A face resolved from `attack` while the body draws `attack7` would be
  //   wrong in a way no count could catch.** The resolver has already chosen
  //   WHICH of twelve attack clips this swing is, so the face asks
  //   `animationFor` the same question with the same arguments rather than
  //   taking the caller's word for the label.
  const figure = figurePack();
  const face = faceOpsFor(facePack(), figure, { family: "taunt", label: "TAUNT", at: 0 });
  const body = paintExtractedFigure(figure, { family: "taunt", label: "TAUNT", at: 0 });
  assert.equal(face.label, "taunt");
  assert.equal(face.poseIndex, 0);
  assert.ok(body.length > 0, "and the body drew the same animation");
});

test("the frame is the animation's own, because the pose index IS the frame offset", () => {
  // Both extractions cut the SAME clip 1241, and every animation's pose list is
  // exactly `lastFrame - firstFrame + 1` long — measured across all 101 — which
  // is what lets an expression call's absolute frame be compared with a pose
  // index at all. All 228 calls land inside their own animation's span.
  const pack = facePack();
  const figure = figurePack();
  const frames = [0, 0.25, 0.5, 0.75, 1].map((at) => faceOpsFor(pack, figure, { family: "taunt", label: "taunt", at }).frame);
  assert.deepEqual(frames, [10, 11, 12, 13, 14]);
});

/* ------------------------------------------------------------------ */
/* WHAT CANNOT BE DRAWN, and the rule that it must be counted           */
/* ------------------------------------------------------------------ */

test("a pose with no head limb draws NO face and says which limb it wanted", () => {
  // The oracle has one: `little_fat_kid` has poses with no head at all. Two eyes
  // at the origin would land on the floor between his feet, which is the kind of
  // plausible wrong answer this project keeps finding.
  const headless = figurePackFrom(
    { 2: { bounds: {}, paths: [{ d: "M0 0L4 4", fill: "#ff0000" }] } },
    {
      standing: {
        label: "Standing", firstFrame: 1, lastFrame: 1,
        poses: [[{ shape: 2, limb: "torso", depth: [23, 1, 1], matrix: [1, 0, 0, 1, 0, -1000] }]],
        limbs: [{ torso: [1, 0, 0, 1, 0, -1000] }],
        bounds: { xMin: -50, xMax: 50, yMin: -150, yMax: 0 }
      }
    }
  );
  const face = faceOpsFor(facePack(), headless, { family: "standing", label: "standing", at: 0 });
  assert.equal(face.ops.length, 0);
  assert.equal(face.approximations["no-limb-matrix"], 2);
  assert.deepEqual(face.skipped.map((entry) => entry.limb), ["head", "head"]);
  assertCountsAreRecomputable(face);
});

test("a placement that is not a SHAPE is counted by its own kind", () => {
  // The icon extractor emits `mask`, `clip`, `missing` and `text` placements
  // too. None is a path this module can draw, and each is a different finding.
  const pack = facePack({
    eyes: {
      expressions: {
        normal: expressionOf("Normal", 1, 9, [
          { kind: "shape", character: 889, matrix: [1, 0, 0, 1, 0, 0] },
          { kind: "mask", character: 891, matrix: [1, 0, 0, 1, 0, 0] },
          { kind: "missing", character: 1234, matrix: [1, 0, 0, 1, 0, 0] }
        ])
      }
    }
  });
  const face = faceOpsFor(pack, figurePack(), { family: "standing", label: "standing", at: 0 });
  assert.equal(opsFor(face, "eyes").length, 1, "the readable placement still draws");
  assert.equal(face.approximations["placement-mask"], 1);
  assert.equal(face.approximations["placement-missing"], 1);
  assert.deepEqual(face.skipped.map((entry) => entry.reason).sort(), ["placement-mask", "placement-missing"]);
  assertCountsAreRecomputable(face);
});

test("a placement whose shape the pack does not hold is counted, not skipped in silence", () => {
  const pack = facePack({
    eyes: {
      expressions: { normal: expressionOf("Normal", 1, 9, [{ kind: "shape", character: 4242, matrix: [1, 0, 0, 1, 0, 0] }]) }
    }
  });
  const face = faceOpsFor(pack, figurePack(), { family: "standing", label: "standing", at: 0 });
  assert.equal(opsFor(face, "eyes").length, 0);
  assert.equal(face.approximations["no-shape"], 1);
  assert.equal(face.skipped[0].character, 4242);
  assertCountsAreRecomputable(face);
});

test("a malformed placement matrix is counted rather than thrown", () => {
  // ► **A THROW HERE STOPS THE ARENA PERMANENTLY.** This is called from inside
  //   the animation loop, which schedules the next frame only after the draw
  //   returns — the scar `cursor.js` exists because of. A broken pack must
  //   degrade to a missing eye, never to a frozen bout.
  const pack = facePack({
    eyes: {
      expressions: { normal: expressionOf("Normal", 1, 9, [{ kind: "shape", character: 889, matrix: ["x", 0, 0, 1, 0] }]) }
    }
  });
  const face = faceOpsFor(pack, figurePack(), { family: "standing", label: "standing", at: 0 });
  assert.equal(opsFor(face, "eyes").length, 0);
  assert.equal(face.approximations["no-matrix"], 1);
  assert.equal(opsFor(face, "mouth").length, 1, "and the other part is unaffected");
  assertCountsAreRecomputable(face);
});

test("a path with no data is COUNTED, never emitted as a silently-empty operation", () => {
  // An empty path draws nothing and looks exactly like a face that rendered
  // correctly. That is the defect class this whole programme exists to stop.
  const pack = facePack({ shapes: { 889: { bounds: {}, paths: [{ d: "", fill: "#ffffff" }] } } });
  const face = faceOpsFor(pack, figurePack(), { family: "standing", label: "standing", at: 0 });
  assert.equal(opsFor(face, "eyes").length, 0);
  assert.equal(face.approximations["empty-path"], 1);
  assertCountsAreRecomputable(face);
});

test("an expression holding more than one distinct pose is reported as an approximation", () => {
  // Measured 1 for all 22 expressions on the oracle, so this is dead against
  // this build — and it is the difference between a still and an animation, so
  // a pack where it is false must say so rather than quietly showing frame 1.
  const pack = facePack({
    eyes: {
      expressions: {
        normal: {
          ...expressionOf("Normal", 1, 2, [{ kind: "shape", character: 889, matrix: [1, 0, 0, 1, 0, 0] }]),
          distinctPoses: 2
        }
      }
    }
  });
  const face = faceOpsFor(pack, figurePack(), { family: "standing", label: "standing", at: 0 });
  assert.equal(face.approximations["expression-multi-pose"], 1);
  assert.equal(opsFor(face, "eyes").length, 1, "and it still draws the pose it holds");
  assertCountsAreRecomputable(face);
});

test("the attach limb and depth are READ from the pack, and a default for either is counted", () => {
  // The packs carry `attachedTo: "head"` and `depth: 1`/`2` because
  // `updatecharacter` does. A pack that does not is drawable — a face at a
  // guessed depth beats no face — but the guess is on the record.
  const pack = facePack({ mouth: { attachedTo: undefined, depth: undefined } });
  const face = faceOpsFor(pack, figurePack(), { family: "standing", label: "standing", at: 0 });
  assert.equal(face.approximations["attach-limb-defaulted"], 1);
  assert.equal(face.approximations["attach-depth-defaulted"], 1);
  const [mouth] = opsFor(face, "mouth");
  assert.deepEqual(mouth.sortKey, [25, 2], "the fallback depth keeps the mouth above the eyes");
  assertCountsAreRecomputable(face);
});

test("a truncated pack falls back to its OWN first expression rather than to nothing", () => {
  // A pack holding `Angry` and nothing else is still a face, and drawing it
  // beats drawing a hole. The fallback is still named in the result.
  const pack = facePack({
    mouth: {
      expressions: { smirk: expressionOf("Smirk", 1, 9, [{ kind: "shape", character: 900, matrix: [1, 0, 0, 1, 0, 0] }]) }
    }
  });
  const face = faceOpsFor(pack, figurePack(), { family: "standing", label: "standing", at: 0 });
  assert.equal(face.mouth.status, "missing", "the binding asked for `normal`, which this pack has not got");
  assert.equal(face.mouth.expression, "smirk");
  assert.equal(face.mouth.fallback, "smirk");
  assert.equal(opsFor(face, "mouth").length, 1);
});

/* ------------------------------------------------------------------ */
/* PAINT ORDER: over the head's own art, under the hair                 */
/* ------------------------------------------------------------------ */

test("the face merges ABOVE the head's own art and BELOW the hair", () => {
  // ► **THE BUILD'S OWN DEPTH LADDER, and it is not a choice made here.**
  //   `updatecharacter` attaches eyes at 1, mouth at 2, facehair at 3, features
  //   at 4 and hair/helmet at 5 — all into the same head clip. In AVM1 a
  //   timeline-placed child sits in the negative depth band, so the head's own
  //   drawing is under all five. Painting the face last instead would put the
  //   eyes over the helmet.
  const body = [
    { kind: "path", limb: "torso", rigDepth: 23, d: "M0 0" },
    { kind: "path", limb: "head", rigDepth: 25, d: "M1 1" },
    { kind: "path", limb: "head", slot: "facehair", sortKey: [25, 3], d: "M2 2" },
    { kind: "path", limb: "head", slot: "hair", sortKey: [25, 5], d: "M3 3" },
    { kind: "path", limb: "Rlowerarm", rigDepth: 33, d: "M4 4" }
  ];
  const face = faceOpsFor(facePack(), figurePack(), { family: "standing", label: "standing", at: 0 });
  const merged = mergeFaceOps(body, face.ops);
  const order = merged.map((op) => op.slot ?? op.limb);
  assert.deepEqual(order, [
    "torso", "head", "eyes", "mouth", "facehair", "hair", "Rlowerarm"
  ]);
});

test("merging keeps every operation and invents none", () => {
  const body = [{ kind: "path", limb: "head", rigDepth: 25, d: "M1 1" }];
  const face = faceOpsFor(facePack(), figurePack(), { family: "standing", label: "standing", at: 0 });
  const merged = mergeFaceOps(body, face.ops);
  assert.equal(merged.length, body.length + face.ops.length);
  for (const op of body) assert.ok(merged.includes(op), "every body operation survives, by identity");
  for (const op of face.ops) assert.ok(merged.includes(op), "and so does every face operation");
});

test("merging is total: no face, no body, or neither, and nothing throws", () => {
  const body = [{ kind: "path", limb: "head", rigDepth: 25, d: "M1 1" }];
  assert.deepEqual(mergeFaceOps(body, []), body);
  assert.deepEqual(mergeFaceOps(body, null), body);
  assert.deepEqual(mergeFaceOps(null, []), []);
  assert.deepEqual(mergeFaceOps(undefined, undefined), []);
});

test("a body operation with no rig depth sorts last rather than dragging the face with it", () => {
  // `paintExtractedFigure` emits `rigDepth: null` for a placement whose depth it
  // could not read. Treating that as depth 0 would paint the face over it.
  const body = [{ kind: "path", limb: "cape", rigDepth: null, d: "M9 9" }];
  const face = faceOpsFor(facePack(), figurePack(), { family: "standing", label: "standing", at: 0 });
  const merged = mergeFaceOps(body, face.ops);
  assert.equal(merged[merged.length - 1], body[0]);
});

/* ------------------------------------------------------------------ */
/* The report a human reads                                             */
/* ------------------------------------------------------------------ */

test("coverage counts every label once per part, and totals the build's own calls", () => {
  // The per-frame tally is one eyes and one mouth; this is the report that says
  // what the face can and cannot do across a whole rig. On the oracle's own
  // packs it answers for 101 animations and 228 calls.
  const coverage = faceCoverageFor(facePack(), ["standing", "taunt", "roll"]);
  assert.equal(coverage.animations, 3);
  assert.equal(coverage.parts.eyes.exact, 1, "standing");
  assert.equal(coverage.parts.eyes.case, 1, "taunt");
  assert.equal(coverage.parts.eyes.unbound, 1, "roll");
  assert.equal(coverage.parts.mouth.missing, 1, "taunt asks for a mouth that does not exist");
  assert.equal(coverage.calls, 5, "standing makes one call per part; taunt makes two eyes calls and one mouth");
});

test("coverage of no labels is an empty report rather than a throw", () => {
  const coverage = faceCoverageFor(facePack(), null);
  assert.equal(coverage.animations, 0);
  assert.equal(coverage.calls, 0);
  for (const part of FACE_PARTS) assert.equal(coverage.parts[part].exact, 0);
});

test("every operation the face emits is in the shape the shell already draws", () => {
  // The shell is a `switch` over operation kinds. A face that invented a kind,
  // or dropped `fillRule`, would be a new branch in the one file the suite
  // cannot reach.
  const face = faceOpsFor(facePack(), figurePack(), { family: "standing", label: "standing", at: 0 });
  assert.ok(face.ops.length >= 2, "there is something to check");
  for (const op of face.ops) {
    assert.equal(op.kind, "path");
    assert.equal(typeof op.d, "string");
    assert.equal(op.matrix.length, 6);
    assert.ok(op.matrix.every(Number.isFinite), "every matrix entry is a number");
    assert.equal(op.limb, "head");
    assert.ok(FACE_PARTS.includes(op.slot), "and it names which part it is");
    assert.ok(["evenodd", "nonzero"].includes(op.fillRule));
    assert.equal(Number.isFinite(op.strokeWidth), true);
  }
});

test("the call in force is found by SCANNING, so a pack written out of frame order still works", () => {
  // "the extractor writes them in frame order" is true of all 83 bindings on
  // this oracle and is still an assumption. A reader that stopped at the first
  // later frame would show the wrong expression for a pack written any other
  // way, and would show it silently.
  const pack = facePack({
    bindings: {
      taunt: {
        animation: "Taunt",
        eyes: [
          { frame: 13, asked: "Up", resolved: "Up", status: "exact", expression: "up" },
          { frame: 10, asked: "Angry", resolved: "Angry", status: "exact", expression: "angry" }
        ],
        mouth: []
      }
    }
  });
  const frames = [10, 12, 13, 14].map((frame) => expressionFor(pack, { part: "eyes", label: "taunt", frame }).expression);
  assert.deepEqual(frames, ["angry", "angry", "up", "up"]);
  assert.equal(
    expressionFor(pack, { part: "eyes", label: "taunt", frame: null }).expression, "angry",
    "and `the expression it opens with` is the EARLIEST call, not the first one listed"
  );
});

test("a figure pack with no usable arena transform draws no face and says so", () => {
  // ► **A NaN MATRIX DRAWS NOTHING AND REPORTS NOTHING**, which is the exact
  //   shape of every defect this programme has found. `figurePackFrom`
  //   guarantees these fields; a hand-assembled pack does not.
  const broken = { ...figurePack(), centreX: Number.NaN };
  const face = faceOpsFor(facePack(), broken, { family: "standing", label: "standing", at: 0 });
  assert.equal(face.ops.length, 0);
  assert.equal(face.approximations["no-arena-transform"], 2, "both parts, counted");
  assertCountsAreRecomputable(face);
});

test("a colour transform or a mask on a face placement is COUNTED, never dropped in silence", () => {
  // ► **THIS IS THE ARENA-WALL DEFECT, AND IT IS DEAD AGAINST THIS ORACLE.**
  //   All 421 face placements in the build carry exactly `{kind, character,
  //   matrix}`. A reader that only works on the data it was written against is
  //   not a reader — and the wall went missing precisely because a reader copied
  //   the fields it knew and never mentioned the one it did not.
  const pack = facePack({
    eyes: {
      expressions: {
        normal: expressionOf("Normal", 1, 9, [{
          kind: "shape", character: 889, matrix: [1, 0, 0, 1, 0, 0],
          colour: [1, 1, 1, 1, 40, 0, 0, 0], mask: { shape: 890, matrix: [1, 0, 0, 1, 0, 0] }
        }])
      }
    }
  });
  const face = faceOpsFor(pack, figurePack(), { family: "standing", label: "standing", at: 0 });
  assert.equal(face.approximations["colour-transform-dropped"], 1);
  assert.equal(face.approximations["mask-dropped"], 1);
  const [eyes] = opsFor(face, "eyes");
  assert.equal(eyes.fill, "#ffffff", "the colour is carried UNTINTED rather than tinted by a second copy of `tint`");
  assertCountsAreRecomputable(face);
});

/**
 * ► **THE HEAD'S ANIMATION COLOUR REACHES THE FACE (2026-09-24).** The eyes and
 *   mouth are attached INSIDE the head clip, so a frozen or poisoned head tints
 *   them as the build tints everything else attached there — found with the
 *   same Codex finding that caught the hair and armour staying untinted.
 */
test("a condition transform on the head tints the eyes and the mouth, and nothing without one", () => {
  const blue = [0.5, 0.5, 0.5, 1, 0, 0, 100, 0];
  const tinted = figurePackFrom(
    { 1: { bounds: {}, paths: [{ d: "M0 0L10 0", fill: "#442200" }] } },
    {
      standing: {
        label: "Standing", firstFrame: 1, lastFrame: 1,
        poses: [[{ shape: 1, limb: "head", depth: [25, 1, 1], matrix: [1, 0, 0, 1, 0, -2000], colour: blue }]],
        limbs: [{ head: [1, 0, 0, 1, 0, -2000] }],
        bounds: { xMin: -50, xMax: 50, yMin: -150, yMax: 0 }
      }
    }
  );
  const face = faceOpsFor(facePack(), tinted, { family: "standing", label: "Standing", at: 0 });
  const eyes = opsFor(face, "eyes");
  const mouth = opsFor(face, "mouth");
  assert.ok(eyes.length > 0 && mouth.length > 0);
  for (const op of eyes) assert.equal(op.fill, applyColourTransform("#ffffff", blue));
  for (const op of mouth) assert.equal(op.stroke, applyColourTransform("#000000", blue));
  const plain = faceOpsFor(facePack(), figurePack(), { family: "standing", label: "Standing", at: 0 });
  for (const op of opsFor(plain, "eyes")) assert.equal(op.fill, "#ffffff");
});
