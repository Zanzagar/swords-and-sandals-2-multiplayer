/**
 * The BUILD'S OWN gladiator, drawn — when the player has extracted it.
 *
 * Stage 3 of asset extraction, and it is deliberately the same shape as
 * `sound.js`: this module holds no art, takes the extracted pack as an
 * ARGUMENT, and returns null for everything when there is none. With no assets
 * the arena falls back to `figure.js`'s authored vector art, exactly as it
 * falls silent with no audio. **A fresh clone still needs its own licensed
 * copy, and nothing here changes that.**
 *
 * ## What the pack is
 *
 * `tools/extract-figure.mjs` writes it into the gitignored `assets/figure/`:
 *
 * - `shapes.json` — each of the fighter's 61 shapes ONCE, as closed SVG path
 *   data with its own bounds.
 * - `animations.json` — 101 labelled animations, each a list of POSES, each
 *   pose a list of limb placements: `{shape, limb, depth, matrix, colour}`.
 *
 * The fighter is a RIG — thirteen named depths, eleven shapes for the body, and
 * 2,222 frames of matrices moving them — so a pose is thirteen matrices and not
 * a picture. That is why this can be a pure function of the pack.
 *
 * ## Coordinates, which are the one genuinely fiddly part
 *
 * Three spaces meet here and two of them disagree about which way is up.
 *
 * - **Shape path data** is in PIXELS, y DOWN, in the shape's own space.
 * - **A placement matrix** is `[a, b, c, d, tx, ty]` with `tx`/`ty` in TWIPS
 *   (20 to the pixel), mapping shape space into the clip's space, y still DOWN.
 * - **Arena operations** are in arena units with the figure's feet at `(0, 0)`
 *   and **y UP**, which is the contract `painter.js` already emits under and
 *   the shell already consumes.
 *
 * So every placement is composed with one fixed transform — scale to the
 * arena's idea of a gladiator's height, flip y, and put the feet on the ground
 * — and the result is handed to the shell as a matrix it can apply directly.
 * Composing once here rather than per path is why a pose costs thirteen matrix
 * multiplies and not thirteen hundred.
 *
 * ► **THE DATUM IS THE `standing` ANIMATION AND IT MUST BE**, not whichever
 *   animation is playing. Scaling each animation to its own bounds would make
 *   the gladiator SHRINK when he crouches and GROW when he leaps, because a
 *   taller drawing would be squeezed into the same arena height. The reference
 *   is measured once per pack and every animation shares it.
 */

import { clipLabelsFor, directionalLabel } from "./clip-labels.js";

export class ExtractedFigureError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Twips to pixels, the SWF's own unit. */
const TWIPS_PER_PIXEL = 20;

/**
 * The arena height of a gladiator at `build.height` 1, matching `painter.js`'s
 * own `UNIT`. Duplicated as a NAMED constant rather than imported because the
 * two files answer to the same authored figure and a silent divergence would
 * show up as the extracted rig standing a different height from the drawn one.
 */
const UNIT = 150;

/** The animation every other one is measured against. */
const REFERENCE_LABEL = "standing";

/**
 * Validate and freeze an extracted pack.
 *
 * Throws rather than returning a broken pack: a renderer that silently drew
 * half a gladiator would be worse than one that fell back to authored art, and
 * the caller's fallback is one `catch` away.
 */
export function figurePackFrom(shapes, animations) {
  if (!shapes || typeof shapes !== "object") {
    throw new ExtractedFigureError("A figure pack needs the `shapes.json` object.");
  }
  if (!animations || typeof animations !== "object") {
    throw new ExtractedFigureError("A figure pack needs the `animations.json` object.");
  }
  const reference = animations[REFERENCE_LABEL];
  if (!reference || !Array.isArray(reference.poses) || reference.poses.length === 0) {
    throw new ExtractedFigureError(
      `A figure pack needs a \`${REFERENCE_LABEL}\` animation with poses — it is the size datum ` +
      "every other animation is measured against."
    );
  }
  const bounds = reference.bounds;
  if (!bounds || !Number.isFinite(bounds.yMin) || !Number.isFinite(bounds.yMax)) {
    throw new ExtractedFigureError(`The \`${REFERENCE_LABEL}\` animation carries no usable bounds.`);
  }
  const clipHeight = bounds.yMax - bounds.yMin;
  if (!(clipHeight > 0)) {
    throw new ExtractedFigureError(`The \`${REFERENCE_LABEL}\` animation has no height, so nothing can be scaled to it.`);
  }
  return Object.freeze({
    shapes,
    animations,
    // The ground is the reference animation's LOWEST point — the soles of the
    // feet — so the figure stands on the arena floor rather than floating by
    // however much the clip's origin happens to be above it.
    groundY: bounds.yMax,
    centreX: (bounds.xMin + bounds.xMax) / 2,
    clipHeight,
    labels: Object.freeze(Object.keys(animations)),
    // Per-animation drawability, computed on first use. A `Map` rather than a
    // field on the animation, because the pack is frozen and the JSON is the
    // player's, not ours to annotate.
    drawable: new Map()
  });
}

/** Whether a pack is usable at all. Cheap, and the shell's fallback test. */
export function hasExtractedArt(pack) {
  return Boolean(pack && pack.animations && pack.shapes && pack.clipHeight > 0);
}

/**
 * Is every placement in this animation drawable — a six-number matrix and a
 * shape the pack actually holds?
 *
 * ► **A PARTIAL PACK USED TO DRAW A PARTIAL GLADIATOR, and a malformed one
 *   FROZE THE ARENA.** `paintExtractedFigure` skipped a placement whose shape
 *   was missing, so a pack short one shape returned 59 operations instead of
 *   65 — non-empty, so the caller never fell back, and the figure was drawn
 *   with a limb missing. And a placement with no `matrix` threw on the
 *   destructure, out of `render()`, which `frame()` calls BEFORE scheduling the
 *   next one: **the whole arena stops, permanently.**
 *
 *   That is the failure this repository already has a scar from — `cursor.js`
 *   exists because "the first spectated bout froze after one action inside a
 *   `requestAnimationFrame` callback the suite could not reach". Validating
 *   here turns both into the fallback that was always meant to happen.
 *
 * Checked ONCE per animation and cached on the pack: a pose is thirteen
 * placements and a bout is thousands of frames, so re-checking per frame would
 * be the one place this module could be accidentally slow.
 */
function isDrawable(pack, animation) {
  if (!animation || !Array.isArray(animation.poses) || animation.poses.length === 0) return false;
  const cached = pack.drawable.get(animation);
  if (cached !== undefined) return cached;
  let ok = true;
  outer: for (const pose of animation.poses) {
    if (!Array.isArray(pose)) { ok = false; break; }
    for (const placement of pose) {
      const matrix = placement?.matrix;
      if (!Array.isArray(matrix) || matrix.length < 6 || !matrix.every((value) => Number.isFinite(value))) {
        ok = false;
        break outer;
      }
      const shape = pack.shapes[placement.shape];
      if (!shape || !Array.isArray(shape.paths)) { ok = false; break outer; }
    }
  }
  pack.drawable.set(animation, ok);
  return ok;
}

/**
 * The animation a family should play, and the label it resolved through.
 *
 * Returns null when the pack holds nothing DRAWABLE for this family — which is
 * a real answer, not a failure: this engine can express phases the build has no
 * clip for, and the caller falls back to authored art for exactly those.
 */
export function animationFor(pack, { family, label = null, facing = "right" } = {}) {
  if (!hasExtractedArt(pack)) return null;
  const labels = clipLabelsFor(family);

  // ► **THE ENGINE'S OWN LABEL WINS WHEN IT IS ONE OF THE FAMILY'S**, and this
  //   is not a nicety. The resolver has already chosen WHICH of twelve attack
  //   clips this swing is — `attack3` is a different animation from `attack1`,
  //   and the build draws it differently. A first version took the family's
  //   first label and drew `attack1` for every attack in the game, throwing the
  //   choice away and making twelve clips look like one.
  //
  //   **Membership is the guard, and it is load-bearing rather than
  //   defensive.** `taunt` is BOTH an attack label and a death variant — the
  //   collision `timeline.js` resolves by ROLE — so a bare "is this label in
  //   the pack?" would draw the attacking taunt for a gladiator dying of one.
  //   Requiring the label to belong to the family this timeline resolved to
  //   makes that impossible instead of merely unlikely.
  const own = typeof label === "string" ? label.toLowerCase() : null;
  const direct = own && labels.includes(own) ? own : null;

  const preferred = directionalLabel(family, label, facing);
  const candidates = [];
  for (const name of [direct, preferred, ...labels]) {
    if (name && !candidates.includes(name)) candidates.push(name);
  }
  for (const name of candidates) {
    const animation = pack.animations[name];
    if (isDrawable(pack, animation)) return { label: name, animation };
  }
  return null;
}

/**
 * Which pose of an animation is showing at progress `at` in `[0, 1]`.
 *
 * ► **The last frame is reachable and the wrap is not.** `at` of exactly 1 is
 *   the END of an action — the moment the shell reports the animation finished
 *   — so it must show the final pose rather than wrapping to the first, which
 *   is what a bare modulo does and which reads as a one-frame twitch at the end
 *   of every swing.
 */
export function poseIndexAt(count, at) {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const clamped = Number.isFinite(at) ? Math.min(1, Math.max(0, at)) : 0;
  return Math.min(count - 1, Math.floor(clamped * count));
}

/** `channel * multiplier + offset`, clamped — the SWF's own colour transform. */
function tint(hex, colour) {
  if (!colour || typeof hex !== "string" || hex === "none" || hex[0] !== "#") return hex;
  const value = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(value)) return hex;
  const channel = (raw, multiplier, offset) =>
    Math.max(0, Math.min(255, Math.round(raw * multiplier + offset)));
  const red = channel((value >> 16) & 255, colour[0], colour[4]);
  const green = channel((value >> 8) & 255, colour[1], colour[5]);
  const blue = channel(value & 255, colour[2], colour[6]);
  return `#${[red, green, blue].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

/** Negative zero normalised away; see `paintExtractedFigure` for why. */
const zero = (value) => (Object.is(value, -0) ? 0 : value);

function tintAlpha(alpha, colour) {
  if (!colour) return alpha;
  return Math.max(0, Math.min(1, alpha * colour[3] + colour[7] / 255));
}

/**
 * One pose of the extracted rig as DRAW OPERATIONS, in arena units.
 *
 * Emits `kind: "path"` — a new operation the authored painter never needed,
 * carrying SVG path data and the matrix that places it. The shell applies the
 * matrix and strokes the path; it still decides nothing.
 *
 * @param {object} pack from `figurePackFrom`
 * @param {object} options `{family, label, facing, at, height, fade}`
 * @returns {ReadonlyArray<object>} operations in paint order, or `[]`
 */
export function paintExtractedFigure(pack, options = {}) {
  const { family, label = null, facing = "right", at = 0, height = 1, fade = 0 } = options;
  const chosen = animationFor(pack, { family, label, facing });
  if (!chosen) return [];

  const pose = chosen.animation.poses[poseIndexAt(chosen.animation.poses.length, at)];
  if (!Array.isArray(pose)) return [];

  // ONE transform for the whole figure: arena units per clip pixel, y flipped,
  // feet on the ground, centred on the reference animation's own midline.
  const scale = (UNIT * height) / pack.clipHeight;
  const alpha = 1 - (Number.isFinite(fade) ? fade : 0);
  const ops = [];

  for (const placement of pose) {
    const shape = pack.shapes[placement.shape];
    // Unreachable for an animation `isDrawable` accepted, and kept anyway: a
    // throw from this function stops the arena's animation loop for good, so it
    // is the last place in the renderer that should trust its input.
    if (!shape || !Array.isArray(shape.paths) || !Array.isArray(placement.matrix)) continue;
    const [a, b, c, d, tx, ty] = placement.matrix;

    // Compose `S * M`, where S scales and flips. Doing it here means the shell
    // applies ONE matrix per limb and the path data is never touched.
    //
    // `zero` normalises NEGATIVE ZERO, which the y-flip produces for anything
    // sitting exactly on the ground datum. `-0` draws identically and compares
    // `=== 0`, but it is NOT `Object.is` 0 and it survives `JSON.stringify` as
    // `-0`, so it leaks into any snapshot or equality check downstream.
    const matrix = Object.freeze([
      zero(scale * a),
      zero(-scale * b),
      zero(scale * c),
      zero(-scale * d),
      zero(scale * (tx / TWIPS_PER_PIXEL - pack.centreX)),
      zero(-scale * (ty / TWIPS_PER_PIXEL - pack.groundY))
    ]);

    const colour = placement.colour ?? null;
    for (const entry of shape.paths) {
      if (!entry.d) continue;
      ops.push(Object.freeze({
        kind: "path",
        d: entry.d,
        matrix,
        limb: placement.limb ?? null,
        fill: tint(entry.fill, colour),
        fillOpacity: tintAlpha(entry.fillOpacity ?? 1, colour),
        fillRule: entry.fillRule ?? "evenodd",
        stroke: entry.stroke ? tint(entry.stroke, colour) : null,
        strokeOpacity: tintAlpha(entry.strokeOpacity ?? 1, colour),
        // ► **IN THE SHAPE'S OWN PIXELS, UNSCALED, and the first version
        //   multiplied by `scale` here.** The matrix above ALREADY carries that
        //   factor, and the shell sets `lineWidth` after applying the matrix —
        //   so pre-scaling applied it twice and drew every outline at 67.4% of
        //   its width, with the error growing quadratically in `height`.
        //   **My own test asserted the pre-scaled value**, which is the third
        //   time this session a test inherited the code's wrong model.
        strokeWidth: entry.strokeWidth ?? 0,
        alpha
      }));
    }
  }
  return Object.freeze(ops);
}
