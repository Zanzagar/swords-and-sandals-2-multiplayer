/**
 * THE BUILD'S GLADIATOR, MEASURED — the two dimensions every drawn gladiator,
 * and everything aimed at one, is placed by.
 *
 * Named here, once, because two layers need them and neither imports the
 * other: `src/render/` draws the figures and flies the arrows at them, and
 * `src/adapter/presentation.js` decides where an arrow stops. Numbers, not art:
 * nothing here is shipped from the licensed build but two measurements of it.
 *
 * - **The clip.** Root frame 221 (`root/frame:221/DoAction@0x671acd`) attaches
 *   `hero_battle` (character 1241) straight into `arena.gladiators` (`+0x051d`
 *   hero, `+0x0546` villain) and sizes it with `_xscale = _yscale = 80 +
 *   round(strength / 1.5)` alone (`+0x061e`-`+0x06a1`). `arena.gladiators` is
 *   this engine's arena space, so ONE CLIP PIXEL IS ONE ARENA UNIT at
 *   `_yscale` 100, and `physical_size` scales both numbers below.
 * - **Where they were measured.** That clip's `standing` animation bounds, as
 *   `tools/extract-figure.mjs` writes them into the player's own
 *   `assets/figure/animations.json`: x -48.54 to 47.85, y -220.85 to 1.8.
 *   `test/render-extracted-figure.test.js` pins the height against the pack
 *   wherever there is one.
 *
 * Node builtins only; no imports, so anything may depend on it.
 */

/** Sole to crown, arena units at `_yscale` 100: `1.8 - (-220.85)`. */
export const SS2_FIGURE_HEIGHT = 222.65;

/**
 * Half the standing body's width, arena units at `_yscale` 100:
 * `(47.85 - (-48.54)) / 2`. The figure is drawn centred on that clip's own
 * midline (`centreX` in `extracted-figure.js`), so this is how far its drawn
 * body reaches either side of where a gladiator stands — ~41.4 at strength 9.
 */
export const SS2_FIGURE_HALF_WIDTH = (47.85 + 48.54) / 2;
