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
    // ► **THE CLIP IS RESOLVED ONCE PER PLACEMENT, NOT ONCE PER PATH.** A
    //   shape is many paths and they share one cutter; building it per path
    //   would hand the surface N identical clip regions to set and clear.
    let clip = null;
    if (placement.clip) {
      const cutter = pack.shapes[placement.clip.shape];
      if (cutter && Array.isArray(cutter.paths) && cutter.paths.length > 0) {
        clip = Object.freeze({
          matrix: placement.clip.matrix,
          // Every loop of the cutter, because a mask with a hole is still one
          // region and dropping the extra loops would clip to the outline.
          d: cutter.paths.map((cut) => cut.d).join("")
        });
      }
    }
    for (const path of shape.paths) {
      ops.push(Object.freeze({
        kind: "path",
        d: path.d,
        matrix: placement.matrix,
        ...(clip ? { clip } : {}),
        fill: path.fill ?? null,
        fillRule: path.fillRule ?? "evenodd",
        fillOpacity: path.fillOpacity ?? 1,
        stroke: path.stroke ?? null,
        strokeWidth: path.strokeWidth ?? 0,
        strokeOpacity: path.strokeOpacity ?? 1,
        // ► **THE BITMAP FILL, AND DROPPING IT HERE MADE THE ARENA WALLS
        //   INVISIBLE.** `shapeToPaths` has always reported
        //   `approximated: "bitmap"` on a raster fill, and this reader copied
        //   named fields one at a time and never copied that — so a shape
        //   filled with the arena's stone wall arrived as `fill: "none"` with
        //   no trace of what was lost, and the extractor counted zero failures.
        //   **An approximation that is not carried is indistinguishable from a
        //   correct read.**
        ...(path.bitmap ? { bitmap: path.bitmap } : {}),
        ...(path.gradient ? { gradient: path.gradient } : {}),
        ...(path.approximated ? { approximated: path.approximated } : {})
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

/**
 * THE ARENA'S OWN SCENERY, at the coordinates the build states.
 *
 * ► **ROOT FRAME 221 IS A CONSTRUCTION SCRIPT *AND* A DISPLAY LIST, and this is
 *   what the SCRIPT half builds.** ~~The arena screen's display list is
 *   EMPTY~~ — it is not, and that sentence was a wrong reading of
 *   `resolveTimeline`'s return shape that reached three files. The frame holds
 *   six objects (see `arena-backdrop.js`); the 488 instructions of
 *   `attachMovie` are the other half, and the only scenery among THEM is two
 *   `rockMC` instances:
 *
 *   ```text
 *     _root.arena.gladiators.attachMovie("rockMC", "rockLeft",  200)
 *     _root.arena.gladiators.attachMovie("rockMC", "rockRight", 201)
 *     rockLeft._x  = -2160   rockRight._x = 2160   both _y = 210
 *     arena.gladiators is at (0, 0)
 *   ```
 *
 * ► **AND THE COORDINATES NEED NO CONVERSION, unlike the blood.** These are
 *   attached to `arena.gladiators`, the same object the fighters are attached
 *   to at `_x = ±250` — which is where `SS2_ARENA.frontX` came from. So they
 *   are arena units already. The drops looked like this and were NOT, because
 *   `bounceitem` attaches to the fighter CLIP instead; the difference is which
 *   object the `attachMovie` is called on, and it is worth checking rather than
 *   assuming.
 *
 * ► **THEY MARK THE EDGE OF THE WALKABLE GROUND.** `SS2_ARENA.clamp` is ±2100,
 *   derived from `nextphase` step 1 long before anybody looked at the scenery,
 *   and the rocks stand sixty units outside it. Two independent readings of the
 *   build agreeing about where the arena stops.
 *
 * `_y` 210 against the fighters' 200 puts them ten units nearer the viewer,
 * which is a depth cue and is why they are returned with a `y` rather than
 * assumed level.
 */
export const SS2_ARENA_SCENERY = Object.freeze([
  Object.freeze({ linkage: "rockMC", instance: "rockLeft", x: -2160, y: 210, depth: 200 }),
  Object.freeze({ linkage: "rockMC", instance: "rockRight", x: 2160, y: 210, depth: 201 })
]);

/**
 * The scenery a surface can actually draw, each with its ops resolved, or an
 * empty list when the props have not been extracted.
 *
 * Returns the DECLARED entries filtered to the drawable ones rather than
 * throwing, for the reason every reader here does: a partial extraction must
 * leave a playable arena, and a missing rock is a missing rock.
 */
export function arenaSceneryFor(pack) {
  if (!hasExtractedProps(pack)) return [];
  const out = [];
  for (const piece of SS2_ARENA_SCENERY) {
    const ops = propOpsFor(pack, { linkage: piece.linkage, frame: 1 });
    if (!ops) continue;
    out.push(Object.freeze({ ...piece, ops }));
  }
  return Object.freeze(out);
}
