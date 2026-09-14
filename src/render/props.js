/**
 * THE BUILD'S OWN COMBAT PROPS, drawn — the arrow, its trail, and whatever else
 * `tools/extract-props.mjs` has pulled out of the player's install.
 *
 * ## Same shape as `extracted-figure.js`, and deliberately so
 *
 * A pack is an ARGUMENT, never a table in the file: this repository ships no SS2
 * asset, so a player who has not run the extractor gets `null` from every
 * function here and the caller falls back to its own authored art. That is the
 * identical arrangement `sound.js` and `extracted-figure.js` already have, and
 * the fallback is not an error path — it is the supported way to run the arena
 * without a licensed copy.
 *
 * ## What a prop's FRAME means, and why this module refuses to decide
 *
 * A prop clip is a lookup, not an animation: the build reaches `bullet`'s
 * frames with `gotoAndStop(secondary_weapon - 60)`. **Which frame a caller
 * wants is the caller's business** — `src/adapter/presentation.js` derives it
 * from the weapon table and stamps it on the command — and this module only
 * reports what is actually on the frame it is handed.
 *
 * ► **AND WHAT IS ON THEM IS NOT WHAT THE `gotoAndStop` IMPLIES.** `bullet`
 *   declares fifty frames and holds **five distinct arrows**: frames 1-5, and
 *   every frame from 6 to 50 repeating the fifth. So bows 61-65 have their own
 *   art and 66-80 share one. A caller asking for frame 17 gets a real answer
 *   and it is the same drawing frame 6 gave.
 */

export class PropsError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * A drawable pack from the JSON `tools/extract-props.mjs` writes, or null.
 *
 * **Total rather than throwing**, for the reason `bindingsFrom` is: a missing,
 * truncated or hand-edited pack must leave the arena playable and drawing its
 * authored art, never broken. The arena is the thing a person looks at, and a
 * stack trace where an arrow should be is a worse outcome than a plain one.
 */
export function propPackFrom(data) {
  if (!data || typeof data !== "object") return null;
  const props = data.props;
  const shapes = data.shapes;
  if (!props || typeof props !== "object" || !shapes || typeof shapes !== "object") return null;
  return Object.freeze({ props: Object.freeze(props), shapes: Object.freeze(shapes) });
}

/** Whether a pack holds anything drawable at all. */
export function hasExtractedProps(pack) {
  return Boolean(pack && pack.props && Object.keys(pack.props).length > 0);
}

/**
 * How many frames a prop has, or 0 — so a caller can clamp its own index
 * rather than discovering the end by getting nothing back.
 */
export function propFrameCount(pack, linkage) {
  const prop = pack?.props?.[linkage];
  return Array.isArray(prop?.frames) ? prop.frames.length : 0;
}

/**
 * The draw operations for one frame of one prop, in the prop's OWN local
 * space, or null when there is nothing to draw.
 *
 * The shape is the one `paintFigure` and `paintExtractedFigure` already emit —
 * `{ kind: "path", d, matrix, fill, ... }` — so a surface that can draw a
 * gladiator can draw an arrow with no new code.
 *
 * @param {object} pack     from `propPackFrom`
 * @param {object} options
 * @param {string} options.linkage  the build's own export name
 * @param {number} options.frame    1-BASED, as `gotoAndStop` indexes it
 */
export function propOpsFor(pack, { linkage, frame = 1 } = {}) {
  if (!hasExtractedProps(pack)) return null;
  const prop = pack.props[linkage];
  if (!prop || !Array.isArray(prop.frames) || prop.frames.length === 0) return null;

  // ► **CLAMPED, AND THE CLAMP IS THE BUILD'S BEHAVIOUR RATHER THAN A GUARD.**
  //   `gotoAndStop` past the end of a clip leaves the playhead where it is; a
  //   renderer with no playhead has to choose, and the last frame is what the
  //   build would already be showing. It matters less than it looks: every
  //   frame of `bullet` from 6 to 50 is the same drawing anyway.
  const index = Number.isFinite(frame) ? Math.min(prop.frames.length, Math.max(1, Math.trunc(frame))) : 1;
  const placements = prop.frames[index - 1];
  if (!Array.isArray(placements) || placements.length === 0) return null;

  const ops = [];
  for (const placement of placements) {
    const shape = pack.shapes[placement.shape];
    if (!shape || !Array.isArray(shape.paths)) continue;
    for (const path of shape.paths) {
      ops.push(Object.freeze({
        kind: "path",
        d: path.d,
        matrix: placement.matrix,
        fill: path.fill ?? null,
        fillRule: path.fillRule ?? "evenodd",
        fillOpacity: path.fillOpacity ?? 1,
        stroke: path.stroke ?? null,
        strokeWidth: path.strokeWidth ?? 0,
        strokeOpacity: path.strokeOpacity ?? 1
      }));
    }
  }
  return ops.length > 0 ? Object.freeze(ops) : null;
}

/**
 * The arrow for a shot, or null.
 *
 * A convenience over `propOpsFor` that names the two facts a caller would
 * otherwise have to know: the linkage is `bullet`, and a null `artFrame` — a
 * secondary slot holding something the shop would never have sold — falls back
 * to the FIRST arrow rather than to nothing. **An arrow that exists and is the
 * wrong one of five is a better answer than no arrow**, and the five differ
 * only in drawing.
 */
export function arrowOpsFor(pack, artFrame) {
  return propOpsFor(pack, { linkage: "bullet", frame: Number.isFinite(artFrame) ? artFrame : 1 });
}

/** The trail puff for a shot, or null. Same fallback rule as `arrowOpsFor`. */
export function arrowTrailOpsFor(pack, artFrame) {
  return propOpsFor(pack, { linkage: "bullet_trail", frame: Number.isFinite(artFrame) ? artFrame : 1 });
}
