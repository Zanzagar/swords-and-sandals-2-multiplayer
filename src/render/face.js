/**
 * THE GLADIATOR'S FACE — the build's own eyes and mouth, at the expression the
 * animation that is playing asks for.
 *
 * Stage 4 of asset extraction, and deliberately the same shape as
 * `extracted-figure.js`, `props.js` and `sound.js`: this module holds no art,
 * takes the extracted packs as ARGUMENTS, and returns null for everything when
 * there is none. A fresh clone still needs its own licensed copy; with no
 * assets the gladiator simply has the blank face `figure.js` draws.
 *
 * ## The face is not a wardrobe slot, and that is the whole design
 *
 * ► **THE FACE IS FIXED AND THE EXPRESSION IS NOT.** The build exports 502
 *   symbols and `eyes1` / `mouth1` are the only members of their families —
 *   there is no `eyes2` — so the face does not vary between gladiators. What
 *   varies is which of eyes1's twelve labelled poses and mouth1's ten is
 *   showing, and that is a function of **WHICH ANIMATION IS PLAYING**. That is
 *   why eyes and mouth are deliberately NOT rows in `ATTACHMENTS`: every other
 *   piece is indexed by an item id off the character, and these two are indexed
 *   by a clip label.
 *
 *   The fighter clip 1241 (`hero_battle`) makes 228 `head.eyes.goto*` /
 *   `head.mouth.goto*` calls across 83 of its 101 labelled animations, and
 *   `tools/extract-icons.mjs` binds each call to the label it fires under. So
 *   the join here is the SAME join `clip-labels.js` already gives sound and
 *   art: one vocabulary, the build's own, three consumers.
 *
 * ## Where they hang, measured on the oracle rather than assumed
 *
 * Root frame 35, `updatecharacter` (`DoAction@0x40bf76`), disassembled with
 * `node tools/inspect-swf.mjs <swf> --references eyes1 --around 30`:
 *
 * ```text
 *   +0x0ce3  head.attachMovie("eyes1",  "eyes",  1)
 *   +0x0d00  head.attachMovie("mouth1", "mouth", 2)
 *   +0x0d2b  head.eyes._y = -14
 *   +0x0d44  head.eyes._x = -3
 *   +0x0d4f  head.attachMovie("features" + ..., "features", 4)
 *   +0x0d75  head.attachMovie("hair" + ...,     "hair",     5)
 * ```
 *
 * Three facts fall out of those six lines and every one of them matters:
 *
 * 1. **Both attach to the HEAD limb**, so the face rides the head's matrix and
 *    needs no rotation, no mirroring and no facing logic of its own.
 * 2. **The eyes carry `(-3, -14)` and the mouth carries nothing.** Those are
 *    AS2 `_x`/`_y` properties, so they are PIXELS, while every matrix in the
 *    packs stores its translation in TWIPS (20 to the pixel).
 *    `composeInClipSpace` already converts exactly that, and it is imported
 *    rather than reimplemented — **this seam has caused three defects in this
 *    repository and it is not getting a fourth.**
 * 3. **Depths 1 and 2 put the face UNDER `facehair` (3), `features` (4) and
 *    `hair`/`helmet` (5), and OVER the head's own art.** In AVM1 a
 *    timeline-placed child sits in the negative depth band and `attachMovie`
 *    starts at 0, so an attached piece never replaces the limb's own drawing —
 *    it stacks on top of it. That is the same rule `paintExtractedFigure`'s
 *    dressing merge already implements, and `mergeFaceOps` below reuses it
 *    rather than inventing a second paint order.
 *
 * ## What this module refuses to decide, and what it must
 *
 * A `gotoAndPlay` on a label the clip does not have is a NO-OP in Flash: the
 * playhead stays where it is, so the face keeps whatever it was already
 * showing. A pure function has no "already", so the caller may hand back the
 * expression it last saw as `held` and get the build's behaviour exactly; with
 * no `held` the fallback is the NAMED default `normal`, which is where
 * `attachMovie` leaves a fresh clip anyway (frame 1 of both clips is `Normal`).
 *
 * **Every fallback is counted.** Six of the build's own 228 calls name a label
 * that does not exist (`mouth.Smile` five times, `mouth.pain` once), 29 more
 * differ from the label only in CASE, 18 of the 101 animations bind nothing at
 * all, and ten of the 83 that do never touch the mouth. A renderer that
 * silently drew `normal` for all of those would be indistinguishable from one
 * that read the build correctly — which is the defect class this whole
 * programme exists to stop.
 */

import {
  animationFor,
  clipToArenaScale,
  composeInClipSpace,
  hasExtractedArt,
  poseIndexAt
} from "./extracted-figure.js";

/** The two members `updatecharacter` attaches, in the order it attaches them. */
export const FACE_PARTS = Object.freeze(["eyes", "mouth"]);

/**
 * The expression a face falls back to when the build asks for one that does
 * not exist, or asks for nothing at all.
 *
 * ► **NAMED, because an unnamed fallback is an invisible one.** `normal` is not
 *   a guess: frame 1 of both `eyes1` and `mouth1` is labelled `Normal`, and
 *   `attachMovie` leaves a new clip on frame 1 — so it is what the build itself
 *   shows a gladiator nobody has animated yet.
 */
export const DEFAULT_EXPRESSION = "normal";

/**
 * The limb both clips attach to, used only when a pack does not say.
 *
 * The packs DO say (`faces.eyes.attachedTo`), and that is what is read; this
 * exists so a truncated pack draws a face in the right place rather than none
 * at all, and its use is counted as `attach-limb-defaulted`.
 */
const FALLBACK_LIMB = "head";

/** Twips to pixels, the SWF's own unit. Stated at every seam that crosses it. */
const TWIPS_PER_PIXEL = 20;

/** An offset in AS2 PIXELS, or null. Tolerant, because the pack is the player's. */
function offsetFrom(offset) {
  if (!offset || typeof offset !== "object") return null;
  const x = Number.isFinite(offset.x) ? offset.x : 0;
  const y = Number.isFinite(offset.y) ? offset.y : 0;
  return (x === 0 && y === 0) ? null : Object.freeze({ x, y });
}

/**
 * A face pack from the JSON `tools/extract-icons.mjs` writes (`icons.json`), or
 * null.
 *
 * **Total rather than throwing**, for the reason every reader in this directory
 * is: a missing, truncated or hand-edited pack must leave the arena playable
 * and drawing its authored art. A face is the last thing worth stopping an
 * arena for.
 *
 * Takes the WHOLE `icons.json` — the icon strips and the combat panel travel in
 * the same file and are simply not read here.
 */
export function facePackFrom(data) {
  if (!data || typeof data !== "object") return null;
  const shapes = data.shapes;
  const faces = data.faces;
  if (!shapes || typeof shapes !== "object" || !faces || typeof faces !== "object") return null;

  const parts = {};
  for (const [index, name] of FACE_PARTS.entries()) {
    const face = faces[name];
    if (!face || typeof face !== "object") continue;
    const expressions = face.expressions;
    if (!expressions || typeof expressions !== "object") continue;
    const labels = Object.keys(expressions);
    if (labels.length === 0) continue;
    parts[name] = Object.freeze({
      part: name,
      linkage: typeof face.linkage === "string" ? face.linkage : null,
      character: Number.isFinite(face.character) ? face.character : null,
      // The limb, the depth and the offset are all MEASURED fields of the pack.
      // Each has a named default so a partial pack still draws, and each
      // default is counted where it is used rather than here.
      attachedTo: typeof face.attachedTo === "string" ? face.attachedTo : null,
      depth: Number.isFinite(face.depth) ? face.depth : null,
      // ► **PIXELS, NOT TWIPS.** `head.eyes._x` is a MovieClip property; the
      //   matrices beside it are not. See `composeInClipSpace`.
      offset: offsetFrom(face.offset),
      declaredDepthIndex: index + 1,
      expressions: Object.freeze(expressions),
      labels: Object.freeze(labels)
    });
  }
  if (Object.keys(parts).length === 0) return null;

  const bindings = data.expressionScript?.bindings;
  return Object.freeze({
    shapes: Object.freeze(shapes),
    parts: Object.freeze(parts),
    // A pack with no expression script is READABLE and every animation in it is
    // `unbound` — which is a different, and countable, answer from "no pack".
    bindings: (bindings && typeof bindings === "object") ? Object.freeze(bindings) : null
  });
}

/** Whether a pack holds a drawable face at all. Cheap, and the caller's fallback test. */
export function hasExtractedFace(pack) {
  return Boolean(pack && pack.parts && Object.keys(pack.parts).length > 0);
}

/**
 * The expression to hold when the build asks for one this pack does not have.
 *
 * Order: what the caller says it is already showing, then the named default,
 * then whatever the pack's first expression is. The last step matters for a
 * TRUNCATED pack — one holding `Angry` and nothing else is still a face, and
 * drawing it beats drawing a hole.
 */
function fallbackFor(face, held) {
  if (typeof held === "string" && face.expressions[held]) return { expression: held, fallback: "held" };
  if (face.expressions[DEFAULT_EXPRESSION]) {
    return { expression: DEFAULT_EXPRESSION, fallback: DEFAULT_EXPRESSION };
  }
  const first = face.labels[0] ?? null;
  return { expression: first, fallback: first };
}

/**
 * WHICH EXPRESSION ONE PART WEARS during one animation, at one frame.
 *
 * This is the join, with no geometry in it at all, so it can be read and
 * checked on its own.
 *
 * @param {object} pack from `facePackFrom`
 * @param {object} options
 * @param {string} options.part   `eyes` or `mouth`
 * @param {string} options.label  the build's own animation label (any case)
 * @param {number} [options.frame] the ABSOLUTE frame of clip 1241 the figure is
 *   showing. Null means "the expression this animation opens with", which is
 *   what 152 of the 156 call lists set on their own first frame anyway.
 * @param {string} [options.held] what this part is already showing, if the
 *   caller is tracking it. **This is how a no-op `gotoAndPlay` is reproduced
 *   exactly** rather than approximated by the default.
 * @returns {object} `{part, label, animation, asked, resolved, expression,
 *   status, fallback}` — `expression` is always a key this pack HAS, or null
 *   when the pack has no such part at all.
 */
export function expressionFor(pack, { part, label = null, frame = null, held = null } = {}) {
  const face = pack?.parts?.[part];
  const key = typeof label === "string" ? label.toLowerCase() : null;
  if (!face) {
    return Object.freeze({
      part, label: key, animation: null, asked: null, resolved: null,
      expression: null, status: "absent", fallback: null
    });
  }

  const binding = (key && pack.bindings) ? pack.bindings[key] : null;
  const base = { part, label: key, animation: binding?.animation ?? null };
  if (!binding) {
    // 18 of the fighter's 101 labelled animations make no expression call —
    // `roll`, `frozen`, `cast1`, `little_fat_kid` and the rest. The face they
    // wear is whatever the previous animation left, which is exactly `held`.
    return Object.freeze({ ...base, asked: null, resolved: null, status: "unbound", ...fallbackFor(face, held) });
  }

  const calls = Array.isArray(binding[part]) ? binding[part] : [];
  if (calls.length === 0) {
    // Ten bound animations never touch the MOUTH — `stepback`, `block`,
    // `attack3`, `runforward` … The eyes move and the mouth is left alone.
    return Object.freeze({ ...base, asked: null, resolved: null, status: "silent", ...fallbackFor(face, held) });
  }

  // The call in force is the LAST one at or before this frame, because
  // `gotoAndPlay` is an event: it fires on its frame and the pose it selects
  // holds until the next one fires. Every labelled run on both clips ends in a
  // `stop()` and holds ONE placement for its whole length (measured:
  // `distinctPoses` is 1 for all 22), so there is no sub-animation to time.
  //
  // ► **SCANNED RATHER THAN SHORT-CIRCUITED, because "the extractor writes them
  //   in frame order" is an assumption and this is a reader.** It is TRUE of
  //   every one of the 83 bindings on this oracle, and a reader that breaks out
  //   of the loop on the first later frame would silently show the wrong
  //   expression the day a pack is written in any other order. Eight calls is
  //   the longest list in the build.
  let chosen = null;
  for (const call of calls) {
    if (!Number.isFinite(call?.frame)) continue;
    if (frame === null) {
      if (chosen === null || call.frame < chosen.frame) chosen = call;
      continue;
    }
    if (call.frame > frame) continue;
    if (chosen === null || call.frame >= chosen.frame) chosen = call;
  }
  if (!chosen) {
    // `celebrate1` and `flame_repeat` set their faces five and six frames in.
    // Before that the face is still the previous animation's.
    return Object.freeze({ ...base, asked: null, resolved: null, status: "pending", ...fallbackFor(face, held) });
  }

  const asked = typeof chosen.asked === "string" ? chosen.asked : null;
  const wanted = typeof chosen.expression === "string" ? chosen.expression : null;
  if (wanted && face.expressions[wanted]) {
    // `status` is the EXTRACTOR's, and it is carried rather than flattened: a
    // call that matched only after lower-casing is a judgement this renderer
    // made on the build's behalf, and it is counted as one.
    const status = chosen.status === "case" ? "case" : "exact";
    return Object.freeze({
      ...base, asked, resolved: typeof chosen.resolved === "string" ? chosen.resolved : wanted,
      expression: wanted, status, fallback: null
    });
  }
  // Six of the build's own calls land here — `mouth.gotoAndPlay("Smile")` five
  // times in `wincrowd4` and `mouth.gotoAndPlay("pain")` once in `death21`.
  // `mouth1` has no `Smile` and no `Pain` frame. **In the build these calls do
  // nothing and the mouth keeps its last pose**, which `held` reproduces.
  return Object.freeze({ ...base, asked, resolved: null, status: "missing", ...fallbackFor(face, held) });
}

/** Negative zero normalised away; the same reason `extracted-figure.js` does it. */
const zero = (value) => (Object.is(value, -0) ? 0 : value);

/** The one pose an expression holds, or null. */
function poseOf(expression) {
  if (!expression || !Array.isArray(expression.poses)) return null;
  for (const pose of expression.poses) {
    if (Array.isArray(pose) && pose.length > 0) return pose;
  }
  return null;
}

/** Bump a tally, creating it on first use so only non-zero kinds are reported. */
function count(tally, kind) {
  tally[kind] = (tally[kind] ?? 0) + 1;
}

/**
 * THE FACE AS DRAW OPERATIONS, in the same arena units `paintExtractedFigure`
 * emits — so a surface that can draw a gladiator can draw his face with no new
 * code.
 *
 * Takes BOTH packs because the face is geometry on the body: the icons pack
 * says what to draw, and the figure pack says where the head is this frame.
 * **It resolves the animation through `animationFor` itself, with the caller's
 * own `family`/`label`/`facing`** — not through a label the caller pre-resolved
 * — because the body and the face must agree about which of twelve attack clips
 * is playing. A face resolved from `attack` while the body draws `attack7`
 * would be wrong in a way no count could catch.
 *
 * @param {object} icons  from `facePackFrom`
 * @param {object} figure from `figurePackFrom`
 * @param {object} options the same `{family, label, facing, at, height, fade}`
 *   `paintExtractedFigure` takes, plus `held` — `{eyes, mouth}` expression keys
 *   the caller last saw, which make a no-op `gotoAndPlay` exact.
 * @returns {object|null} `{label, frame, poseIndex, eyes, mouth, ops, drawn,
 *   approximations, skipped, notes}`, or null when either pack is absent or the
 *   figure pack has no drawable animation for this family.
 */
export function faceOpsFor(icons, figure, options = {}) {
  const {
    family, label = null, facing = "right", at = 0, height = 1, fade = 0, held = null
  } = options;
  if (!hasExtractedFace(icons) || !hasExtractedArt(figure)) return null;

  const chosen = animationFor(figure, { family, label, facing });
  if (!chosen) return null;

  const poseIndex = poseIndexAt(chosen.animation.poses.length, at);
  // The packs agree on frame numbering — both extractors cut the SAME clip
  // 1241 — and this is the line that relies on it: every animation's pose list
  // is exactly `lastFrame - firstFrame + 1` long (measured across all 101), so
  // the pose index IS the frame offset. All 228 expression calls fall inside
  // their own animation's span, which is the cross-check that the two
  // extractions are in one coordinate system.
  const frame = Number.isFinite(chosen.animation.firstFrame)
    ? chosen.animation.firstFrame + poseIndex
    : null;

  const approximations = {};
  // TWO enumerable lists rather than one, because there are two outcomes: a
  // `skipped` entry drew NOTHING, a `note` drew something with a judgement in
  // it. Every entry in either is one tick in `approximations`, and the label
  // statuses on `eyes`/`mouth` are the rest — so the whole tally is recomputable
  // from the result's own data. **A count that cannot be derived a second way
  // is a count that agrees with itself forever.**
  const skipped = [];
  const notes = [];
  const resolutions = {};
  for (const part of FACE_PARTS) {
    const resolution = expressionFor(icons, { part, label: chosen.label, frame, held: held?.[part] ?? null });
    resolutions[part] = resolution;
    if (resolution.status === "case") count(approximations, "label-case");
    else if (resolution.status === "missing") count(approximations, "label-missing");
    else if (resolution.status === "silent") count(approximations, "label-silent");
    else if (resolution.status === "pending") count(approximations, "label-pending");
    else if (resolution.status === "unbound") count(approximations, "label-unbound");
    else if (resolution.status === "absent") count(approximations, "part-absent");
  }

  const limbs = chosen.animation.limbs?.[poseIndex];
  const pose = chosen.animation.poses[poseIndex];
  const alpha = 1 - (Number.isFinite(fade) ? fade : 0);
  const scale = clipToArenaScale(figure, height);
  // ► **A NON-FINITE TRANSFORM WOULD EMIT NaN MATRICES, WHICH DRAW NOTHING AND
  //   SAY NOTHING** — the exact shape of every defect this programme has found.
  //   `figurePackFrom` guarantees these on a pack it built, so this catches a
  //   hand-assembled one, and it catches it out loud.
  const transformable = Number.isFinite(scale) && scale !== 0
    && Number.isFinite(figure.centreX) && Number.isFinite(figure.groundY);
  const ops = [];
  const drawn = {};

  for (const part of FACE_PARTS) {
    drawn[part] = 0;
    const face = icons.parts[part];
    const resolution = resolutions[part];
    if (!face || !resolution.expression) continue;
    if (!transformable) {
      count(approximations, "no-arena-transform");
      skipped.push(Object.freeze({ part, expression: resolution.expression, reason: "no-arena-transform" }));
      continue;
    }

    const limbName = face.attachedTo ?? FALLBACK_LIMB;
    const limbMatrix = limbs?.[limbName];
    if (!Array.isArray(limbMatrix) || limbMatrix.length < 6 || !limbMatrix.every(Number.isFinite)) {
      // `little_fat_kid` has poses with no head at all. A face with nowhere to
      // hang is REPORTED, never guessed at the origin — which would put two
      // eyes on the floor between his feet.
      count(approximations, "no-limb-matrix");
      skipped.push(Object.freeze({ part, expression: resolution.expression, limb: limbName, reason: "no-limb-matrix" }));
      continue;
    }

    // Past the limb check, so the defaults below are only recorded for a part
    // that actually reached the drawing.
    if (!face.attachedTo) {
      notes.push(Object.freeze({ part, reason: "attach-limb-defaulted", limb: limbName }));
      count(approximations, "attach-limb-defaulted");
    }

    // The rig depth of the limb, recovered from the pose exactly as the
    // wardrobe merge recovers it, so the face sorts into the body's own paint
    // order rather than being stacked after all of it.
    let limbDepth = null;
    if (Array.isArray(pose)) {
      for (const placement of pose) {
        if (placement?.limb === limbName && Array.isArray(placement.depth)) { limbDepth = placement.depth[0]; break; }
      }
    }
    if (!Number.isFinite(limbDepth)) {
      notes.push(Object.freeze({ part, reason: "no-limb-depth", limb: limbName }));
      count(approximations, "no-limb-depth");
    }
    const attachDepth = Number.isFinite(face.depth) ? face.depth : face.declaredDepthIndex;
    if (!Number.isFinite(face.depth)) {
      notes.push(Object.freeze({ part, reason: "attach-depth-defaulted", depth: attachDepth }));
      count(approximations, "attach-depth-defaulted");
    }

    const expression = face.expressions[resolution.expression];
    if (Array.isArray(expression?.poses) && expression.poses.length > 0 && expression.distinctPoses > 1) {
      // Measured 1 for all 22 expressions on the oracle, so this is dead
      // against this build — and it is the difference between a still and an
      // animation, so it is counted rather than assumed away.
      notes.push(Object.freeze({ part, reason: "expression-multi-pose", expression: resolution.expression }));
      count(approximations, "expression-multi-pose");
    }
    const placements = poseOf(expression);
    if (!placements) {
      count(approximations, "expression-empty");
      skipped.push(Object.freeze({ part, expression: resolution.expression, reason: "expression-empty" }));
      continue;
    }

    for (const placement of placements) {
      if (placement?.kind !== "shape") {
        // The icon extractor emits `mask`, `clip`, `missing` and `text`
        // placements too, and none of them is a path this module can draw.
        count(approximations, `placement-${placement?.kind ?? "unknown"}`);
        skipped.push(Object.freeze({
          part, expression: resolution.expression,
          character: Number.isFinite(placement?.character) ? placement.character : null,
          reason: `placement-${placement?.kind ?? "unknown"}`
        }));
        continue;
      }
      const shape = icons.shapes[placement.character];
      if (!shape || !Array.isArray(shape.paths) || shape.paths.length === 0) {
        count(approximations, "no-shape");
        skipped.push(Object.freeze({
          part, expression: resolution.expression, character: placement.character ?? null, reason: "no-shape"
        }));
        continue;
      }
      if (!Array.isArray(placement.matrix) || placement.matrix.length < 6
        || !placement.matrix.every(Number.isFinite)) {
        // A malformed placement must not throw out of here: this is called from
        // inside the arena's animation loop, and a throw there stops the whole
        // arena permanently — the scar `cursor.js` exists because of.
        count(approximations, "no-matrix");
        skipped.push(Object.freeze({
          part, expression: resolution.expression, character: placement.character ?? null, reason: "no-matrix"
        }));
        continue;
      }

      // ► **WHAT THIS READER WOULD OTHERWISE DROP IN SILENCE.** Measured on
      //   this oracle every one of the face's 421 placements carries exactly
      //   `{kind, character, matrix}` — no colour transform and no mask — so
      //   both branches below are dead against this build. They exist because
      //   the arena walls went missing exactly this way: a reader that copies
      //   the fields it knows about and never mentions the ones it did not is
      //   indistinguishable from a reader that got it right. A colour transform
      //   is NOT applied here rather than applied badly: `extracted-figure.js`
      //   owns the only `tint` in this directory and does not export it, and a
      //   second copy of it would be free to drift from the first.
      if (placement.colour) {
        notes.push(Object.freeze({ part, reason: "colour-transform-dropped", character: placement.character }));
        count(approximations, "colour-transform-dropped");
      }
      if (placement.mask) {
        notes.push(Object.freeze({ part, reason: "mask-dropped", character: placement.character }));
        count(approximations, "mask-dropped");
      }

      // limb (clip space, TWIPS) x the expression's own placement, with the
      // attach offset — which is in AS2 PIXELS — folded in by
      // `composeInClipSpace`. Exactly the shield's arrangement, and the same
      // function, so the two cannot drift.
      const composed = composeInClipSpace(limbMatrix, placement.matrix, face.offset);
      // Then the one clip-to-arena transform: scale, flip y, feet on the
      // ground. **Translation is TWIPS and path data is PIXELS**, which is why
      // only the translation is divided by 20 here.
      const matrix = Object.freeze([
        zero(scale * composed[0]),
        zero(-scale * composed[1]),
        zero(scale * composed[2]),
        zero(-scale * composed[3]),
        zero(scale * (composed[4] / TWIPS_PER_PIXEL - figure.centreX)),
        zero(-scale * (composed[5] / TWIPS_PER_PIXEL - figure.groundY))
      ]);

      for (const entry of shape.paths) {
        if (!entry.d) {
          // **NEVER EMIT A SILENTLY-EMPTY PATH.** A path with no data draws
          // nothing and looks exactly like a face that rendered correctly.
          count(approximations, "empty-path");
          skipped.push(Object.freeze({
            part, expression: resolution.expression, character: placement.character ?? null, reason: "empty-path"
          }));
          continue;
        }
        ops.push(Object.freeze({
          kind: "path",
          d: entry.d,
          matrix,
          limb: limbName,
          slot: part,
          expression: resolution.expression,
          // The same two-level key the wardrobe uses, so `mergeFaceOps` can put
          // the face where the build puts it: above the head's own art, below
          // the hair.
          sortKey: Object.freeze([Number.isFinite(limbDepth) ? limbDepth : Number.MAX_SAFE_INTEGER, attachDepth]),
          fill: entry.fill ?? null,
          fillOpacity: entry.fillOpacity ?? 1,
          fillRule: entry.fillRule ?? "evenodd",
          stroke: entry.stroke ?? null,
          strokeOpacity: entry.strokeOpacity ?? 1,
          // IN THE SHAPE'S OWN PIXELS, UNSCALED: the matrix already carries the
          // scale and the shell sets `lineWidth` after applying it. Pre-scaling
          // here would apply the factor twice — the defect `extracted-figure.js`
          // records at this same line.
          strokeWidth: entry.strokeWidth ?? 0,
          // ► **THE ARENA-WALL DEFECT, NOT REPEATED HERE.** A reader that
          //   copies named fields one at a time and drops `bitmap`, `gradient`
          //   or `approximated` turns a raster fill into `fill: "none"` and
          //   reports nothing. Measured on this oracle the face uses none of
          //   the three — 28 paths, 0 approximated — but a reader that only
          //   works on the data it was written against is not a reader.
          ...(entry.gradient ? { gradient: entry.gradient } : {}),
          ...(entry.bitmap ? { bitmap: entry.bitmap } : {}),
          ...(entry.approximated ? { approximated: entry.approximated } : {}),
          alpha
        }));
        drawn[part] += 1;
      }
    }
  }

  return Object.freeze({
    label: chosen.label,
    frame,
    poseIndex,
    eyes: resolutions.eyes,
    mouth: resolutions.mouth,
    ops: Object.freeze(ops),
    drawn: Object.freeze(drawn),
    // Only non-zero kinds appear, which is the shape every manifest in this
    // project uses — and a test recomputes this map from `eyes`, `mouth`,
    // `skipped` and `notes`, so a count that lies fails by name.
    approximations: Object.freeze(approximations),
    skipped: Object.freeze(skipped),
    notes: Object.freeze(notes)
  });
}

/** The sort key an operation from `paintExtractedFigure` occupies. */
function orderKeyOf(op) {
  if (Array.isArray(op?.sortKey)) return op.sortKey;
  // A BODY operation carries `rigDepth` and no attachment depth. It sorts
  // BELOW every attachment on its own limb, because in AVM1 the limb's own
  // timeline children live in the negative depth band and `attachMovie` starts
  // at 0 — so the body's art can never cover a piece attached to it.
  return [Number.isFinite(op?.rigDepth) ? op.rigDepth : Number.MAX_SAFE_INTEGER, Number.NEGATIVE_INFINITY];
}

/**
 * MERGE THE FACE INTO THE FIGURE'S OWN PAINT ORDER.
 *
 * `paintExtractedFigure` already returns the body and the wardrobe interleaved
 * by `[limb depth, attachment depth]`; the face is two more attachments on the
 * head at depths 1 and 2, so it belongs in that same order rather than painted
 * over the top of everything. Painting it last would put the eyes over the
 * helmet.
 *
 * Kept HERE rather than in `extracted-figure.js` so the face can be added
 * without touching the file the figure's own tests pin — the caller composes
 * the two.
 *
 * @param {ReadonlyArray<object>} figureOps from `paintExtractedFigure`
 * @param {ReadonlyArray<object>} faceOps   `faceOpsFor(...).ops`
 * @returns {ReadonlyArray<object>} one list, in paint order
 */
export function mergeFaceOps(figureOps, faceOps) {
  const body = Array.isArray(figureOps) ? figureOps : [];
  const face = Array.isArray(faceOps) ? faceOps : [];
  if (face.length === 0) return Object.freeze(body.slice());
  if (body.length === 0) return Object.freeze(face.slice());

  // A STABLE insertion rather than a sort of the whole list: the body's order
  // is the build's and must survive untouched, including any two operations
  // that share a key.
  const pending = face.slice().sort((left, right) => {
    const a = orderKeyOf(left);
    const b = orderKeyOf(right);
    return (a[0] - b[0]) || (a[1] - b[1]);
  });
  const merged = [];
  let cursor = 0;
  for (const op of body) {
    const [depth, inner] = orderKeyOf(op);
    while (cursor < pending.length) {
      const [faceDepth, faceInner] = orderKeyOf(pending[cursor]);
      if (faceDepth < depth || (faceDepth === depth && faceInner < inner)) merged.push(pending[cursor++]);
      else break;
    }
    merged.push(op);
  }
  while (cursor < pending.length) merged.push(pending[cursor++]);
  return Object.freeze(merged);
}

/**
 * WHAT THE FACE CAN AND CANNOT SAY, across a whole set of animation labels.
 *
 * The per-frame counts in `faceOpsFor` are one eyes and one mouth; this is the
 * report a human reads — and the one a test can recompute from the pack. Hand
 * it the figure pack's `labels` to get the answer for the rig as it actually
 * is: on this oracle that is 101 animations, of which 83 bind something.
 *
 * @returns {object} `{animations, parts: {eyes: {...}, mouth: {...}}, calls}`
 *   where each part carries a count per resolution status.
 */
export function faceCoverageFor(pack, labels) {
  const names = Array.isArray(labels) ? labels : [];
  const parts = {};
  for (const part of FACE_PARTS) {
    parts[part] = { exact: 0, case: 0, missing: 0, silent: 0, pending: 0, unbound: 0, absent: 0 };
  }
  let calls = 0;
  for (const label of names) {
    for (const part of FACE_PARTS) {
      // At the animation's OPENING frame, which is where 152 of the 156 call
      // lists set their expression. A per-frame sweep would count the same
      // animation many times and say nothing more.
      const resolution = expressionFor(pack, { part, label });
      const bucket = parts[part];
      if (bucket[resolution.status] !== undefined) bucket[resolution.status] += 1;
    }
    const binding = pack?.bindings?.[typeof label === "string" ? label.toLowerCase() : ""];
    for (const part of FACE_PARTS) {
      if (Array.isArray(binding?.[part])) calls += binding[part].length;
    }
  }
  for (const part of FACE_PARTS) parts[part] = Object.freeze(parts[part]);
  return Object.freeze({ animations: names.length, parts: Object.freeze(parts), calls });
}
