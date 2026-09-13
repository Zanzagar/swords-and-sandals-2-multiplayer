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
 * - `cursor.js` decides which action animations BEGIN, which have finished and
 *   which the surface has given up on — extracted from the shell after the
 *   first spectated bout froze after one action inside a
 *   `requestAnimationFrame` callback the suite could not reach. "Which begin"
 *   joined it with movement, because pairing a travelling gait with the
 *   `move-clip` from its own batch is the same kind of decision: invisible on
 *   a screenshot, and wrong-able in silence.
 * - `clip-labels.js` is the SINGLE join between this engine's family names and
 *   the licensed build's own clip labels. Both extracted assets key on those
 *   labels, so sound and art answer to one vocabulary rather than two that can
 *   drift — which is exactly how a walk came to sound like a leaping attack.
 * - `extracted-figure.js` draws the BUILD'S OWN rig when the player has
 *   extracted it, and returns nothing when they have not. Same shape as
 *   `sound.js`: the pack is an argument, never a table in the file.
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
export * from "./sound.js";
export * from "./clip-labels.js";
export * from "./extracted-figure.js";
