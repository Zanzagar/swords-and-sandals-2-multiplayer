/**
 * The rendered arena's pure core: presentation commands in, drawable data out.
 *
 * Nothing in `src/render/` touches a canvas, a DOM node, a timer or a battle.
 * It is data-in / data-out so the whole of it is testable under
 * `node --test`, and the untestable shell — painting, input, requestAnimationFrame —
 * lives in `tools/arena/`, which is deliberately thin.
 *
 * The division, and why it is drawn here:
 *
 * - `scene.js` folds presentation commands into an immutable scene. It never
 *   invents geometry, never drops a label's provenance and never swallows an
 *   `unmapped`.
 * - `figure.js` turns a combatant's wire projection into an ORIGINAL vector
 *   figure. No SS2 asset is imported, embedded or referenced.
 * - `painter.js` turns a figure plus a pose into DRAW OPERATIONS — still pure
 *   data, so the drawing logic itself is under the suite and the shell is a
 *   `switch` over operation kinds.
 * - `cursor.js` decides which action animations have finished and which the
 *   surface has given up on — extracted from the shell after the first
 *   spectated bout froze after one action inside a `requestAnimationFrame`
 *   callback the suite could not reach.
 * - `timeline.js` owns TIME, because the presentation stream carries none, and
 *   states this surface's animation-timeout policy — part 4 of the
 *   acknowledgement seam, which `src/adapter/action-gate.js` deliberately left
 *   to whoever actually has an animation surface.
 */

export * from "./scene.js";
export * from "./figure.js";
export * from "./cursor.js";
export * from "./painter.js";
export * from "./timeline.js";
