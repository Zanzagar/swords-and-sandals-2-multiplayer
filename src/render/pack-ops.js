/**
 * THREE SMALL HELPERS EVERY ICON-PACK READER SHARES — the matrix compose, the
 * matrix guard and the glow group — in one place.
 *
 * `src/render/popups.js` and `src/render/action-buttons.js` each carried an
 * identical private copy of all three, and `src/render/combat-panel.js` needed
 * them a third time. A third copy is a third thing to drift, so they live here
 * and all three readers import them. The bodies are the two copies' own,
 * unchanged.
 *
 * Pure: no canvas, no DOM.
 */

import { canvasFilterFor, glowAmplificationFor } from "./filters.js";

/** The identity, `[a, b, c, d, tx, ty]` with tx/ty in TWIPS. */
export const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);

/** `outer` then `inner`, both `[a, b, c, d, tx, ty]` with tx/ty in TWIPS. */
export function compose(outer, inner) {
  const [a, b, c, d, tx, ty] = outer;
  const [e, f, g, h, ux, uy] = inner;
  return [
    a * e + c * f, b * e + d * f,
    a * g + c * h, b * g + d * h,
    a * ux + c * uy + tx, b * ux + d * uy + ty
  ];
}

/** The first six entries of a finite matrix array, or null for anything else. */
export function matrixOf(value) {
  return Array.isArray(value) && value.length >= 6 && value.slice(0, 6).every(Number.isFinite)
    ? value.slice(0, 6)
    : null;
}

/**
 * The group one glowing text placement's ops share, built at the draw scale
 * (device pixels per unit of the ops' own space), or null when the placement
 * carries no filter a canvas can draw. The record's shape is the one
 * `paintGroupRuns` in `tools/arena/main.js` composites.
 */
export function glowGroupFor(filters, scale) {
  if (!Array.isArray(filters) || filters.length === 0) return null;
  const built = canvasFilterFor(filters, { scale });
  const amplify = glowAmplificationFor(filters, { scale });
  if (!built.filter && !amplify) return null;
  return Object.freeze({
    id: null, path: Object.freeze([]), character: null, enclosedBy: null,
    filter: built.filter, amplify, composite: null, blendModeRefused: null,
    colourMatricesFolded: 0, ops: 0, placements: 0, counts: built.counts
  });
}
