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
 * - `sound-timing.js` fires each of a clip's sounds at the DRAWN pose the
 *   build's `StartSound` sits on, with the drawing's own pose arithmetic, so a
 *   sound follows everything that delays or cuts short the figure.
 * - `arena-shell.js` holds the decisions the browser shell was making where no
 *   test could reach them. `tools/arena/main.js` cannot be imported by node at
 *   all, and it has given up five live defects in one day; what was logic
 *   rather than drawing lives here instead.
 * - `extracted-figure.js` draws the BUILD'S OWN rig when the player has
 *   extracted it, and returns nothing when they have not. Same shape as
 *   `sound.js`: the pack is an argument, never a table in the file.
 * - `appearance.js` is a gladiator's LOOK — `begincolouring`'s skin and hair
 *   table in the player's 8.8 arithmetic, the skin-derived features, which
 *   rig placements are `bareskin`, and `randomise_gladiator`'s rule for a new
 *   look. Presentation data only: it never enters the combat state.
 * - `props.js` draws the BUILD'S OWN arrow and trail when the player has
 *   extracted them, and returns null when they have not — the same shape as
 *   `extracted-figure.js` and `sound.js`, pack as an argument.
 * - `filters.js` owns the build's COLOUR arithmetic — the colour transform, the
 *   colour matrix, blend modes and filters — in ONE place, because three copies
 *   of it appeared in a single evening and two of them rounded where the
 *   player's `(channel * multTerm) >> 8` floors.
 * - `face.js` draws the eyes and the mouth, keyed on the ANIMATION the body is
 *   playing: the build issues 228 expression calls across 83 animations, so a
 *   gladiator's face is a function of what he is doing, which is the same join
 *   sound and art already use.
 * - `text.js` turns the build's own embedded glyph outlines into draw
 *   operations, and `screen.js` turns any of the 26 root screens into them.
 * - `screen-text.js` is the JOIN between those two, and it is a file rather
 *   than a caller's for-loop because four things about that seam are silent
 *   when got wrong — the largest being that `staticTextOpsFor`'s `matrix`
 *   option REPLACES a `DefineText`'s own matrix instead of composing with it,
 *   which draws 22 of the 26 screens' 70 static runs up to 94.42 px from where
 *   the build puts them, inside the screen and perfectly legible. It takes
 *   `screen.js`'s `textNotDrawn: 187` down to 28 and invoices every one.
 * - `arena-backdrop.js` is the ARENA ITSELF rather than a thing standing in it:
 *   the six objects root frame 221 places, the 1:1 mapping from arena units to
 *   stage pixels that every other coordinate here is expressed in, and the
 *   camera the build wrote and then never called. It is the datum the rest of
 *   this directory has been implying.
 * - `clip-effects.js` is the build's own `bounceitem` — the blood and sparks a
 *   fighter animation throws, a real bouncing particle system rather than a
 *   puff of art, and the rule that ARMOUR strikes sparks where flesh bleeds.
 * - `projectile.js` owns the ARROW's flight — the build's own ballistic, with
 *   its single screen `_y` split into this engine's DEPTH and HEIGHT, which is
 *   the one axis vanilla cannot have and the one the second axis needs.
 * - `timeline.js` owns TIME, because the presentation stream carries none, and
 *   states this surface's animation-timeout policy — part 4 of the
 *   acknowledgement seam, which `src/adapter/action-gate.js` deliberately left
 *   to whoever actually has an animation surface.
 * - `popups.js` is the build's own FIGHT POP-UPS — the damage number, the
 *   spell/status/potion callout and BLOCK — decided from a resolved action's
 *   events (and the rule set's unhashed observer, for the one number the
 *   events do not carry), replaced per fighter by the build's own depths, and
 *   drawn from the player's icon and text packs.
 */

export * from "./scene.js";
export * from "./figure.js";
export * from "./cursor.js";
export * from "./painter.js";
export * from "./timeline.js";
export * from "./sound.js";
export * from "./sound-timing.js";
export * from "./clip-labels.js";
export * from "./clip-sequences.js";
export * from "./stance.js";
export * from "./extracted-figure.js";
export * from "./appearance.js";
export * from "./projectile.js";
export * from "./spell-effect.js";
export * from "./props.js";
export * from "./arena-backdrop.js";
export * from "./filters.js";
export * from "./face.js";
export * from "./text.js";
export * from "./screen.js";
export * from "./screen-text.js";
export * from "./clip-effects.js";
export * from "./arena-shell.js";
export * from "./popups.js";
