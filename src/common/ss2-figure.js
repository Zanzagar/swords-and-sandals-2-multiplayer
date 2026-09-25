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

/**
 * THE TWO SPELLS THAT RESIZE A GLADIATOR — added 2026-09-24, after the owner
 * watched a little fat kid land and the victim stay his own size.
 *
 * The clip's `_yscale` is written at battle entry (`80 + round(strength /
 * 1.5)`, root frame 221) and then ONLY by these two arms and their expiry —
 * re-read for this edit off the frame-52 action dump
 * (`sprite:862[overlay]/frame:52/DoAction@0x240c7f`, base `0x240c85`):
 *
 * ```text
 *   cast_colossus, once:   attacker.oldscale = attacker._yscale        +0x8084-+0x8098
 *                          attacker.newscale = 450                     +0x8099-+0x80aa
 *     EVERY tick:          attacker._yscale = ceil((newscale - _yscale) / 2)   +0x80e7-+0x8123 (ASSIGNS)
 *                          attacker._xscale = attacker._yscale         +0x8124-+0x8138
 *   cast_little_fat_kid, once (defender.struck == null):
 *                          defender.oldscale = ToNumber(defender._yscale)      +0x82b7-+0x82cc
 *                          defender.newscale = 50                      +0x82cd-+0x82de
 *     then, same tick:     _yscale = ceil((50 - _yscale) / 2), which is never
 *                          `Greater` than 50 from a positive start, so the
 *                          completion writes _xscale = _yscale = 50     +0x83b0-+0x83d7
 *   check_spells, at either counter's == 0:
 *                          _xscale = _yscale = which_avatar.oldscale    +0x2485 (colossus), +0x2513 (fat kid)
 * ```
 *
 * **What this repository restores to at expiry is NOT that `oldscale`** — it
 * is the entry size, as the engine restores the stats from `backup_*`; the
 * decision and its measurement are at `CommandKind.SCALE_CLIP` in
 * `src/adapter/presentation.js`.
 *
 * Both layers need these, and neither imports the other, so they live here
 * beside the figure's own dimensions: `src/adapter/presentation.js` works out
 * each change and where an arrow stops against the resized body, and
 * `src/render/timeline.js` draws the colossus's growth tick by tick.
 */
export const SS2_LITTLE_FAT_KID_YSCALE = 50;

/** `attacker.newscale = 450` (`+0x809f`) — what colossus's growth chases and, by the build's bug, never reaches. */
export const SS2_COLOSSUS_NEWSCALE = 450;

/**
 * A colossus caster's `_yscale` after `ticks` of its arm, from `from`.
 *
 * ► **IT IS THE BUILD'S RECURRENCE, OSCILLATION AND ALL.** The arm ASSIGNS
 *   `ceil((newscale - _yscale) / 2)` where it meant to add it, so the scale
 *   does not grow toward 450: it swings about 150 — the recurrence's only
 *   fixed point — and settles there within nine ticks from any start between 1
 *   and 450. From the demo roster's 86: 182, 134, 158, 146, 152, 149, 151, 150.
 *   A gladiator above 150 SHRINKS (180: 135, 158, 146, 152, 149, 151, 150).
 *   `docs/integration/ss2-battle-map.md`, `cast_colossus`, VERIFIED.
 *
 * Tick 1 is the tick the once-block runs, so the first drawn frame of the
 * `Colossus` clip already shows the first value. A tick count of 0 or less is
 * the scale before the cast.
 *
 * @param {number} from the `_yscale` the cast began at
 * @param {number} ticks how many arm ticks have run
 * @param {number} [newscale] the arm's `newscale`
 * @returns {number} the `_yscale` after them
 */
export function ss2ColossusYscaleAfter(from, ticks, newscale = SS2_COLOSSUS_NEWSCALE) {
  let yscale = from;
  const count = Number.isFinite(ticks) ? Math.max(0, Math.floor(ticks)) : 0;
  for (let tick = 0; tick < count; tick += 1) {
    const next = Math.ceil((newscale - yscale) / 2);
    // The fixed point: every later tick writes this same value.
    if (next === yscale) break;
    yscale = next;
  }
  return yscale;
}
