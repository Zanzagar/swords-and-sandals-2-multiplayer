/**
 * WHAT EACH RING BUTTON DRAWS — slice S3 of `docs/design/battle-ui.md` ("the
 * build's own button art and placement on the ring"). Pure: `ring-layout.js`
 * says where each button stands, this says which operations it paints, and
 * `tools/arena/main.js` only paints them.
 *
 * ► **THE BUILD'S OWN BUTTON, FROM THE PLAYER'S ICONS PACK.** A slot draws
 *   character 860 at the frame its controller sends that slot to for that verb
 *   — which depends on the FACING (`power_attack` is 2 facing right and 13
 *   facing left) and, for Psyche Up, on the counter (26/27/28) — over its
 *   `battlebutton` background (826) at frame 1, or frame 2 under the pointer:
 *   the overlay's own `onRollOver`/`onRollOut` (overlay frame 1 body 0x236947,
 *   `+0x0b08`/`+0x0c2e`). The frame choice and the drawing are
 *   `src/render/action-buttons.js`'s (`actionButtonOps`), under its suite.
 *
 * ► **WITHOUT THE PACK — a fresh clone, or a pack extracted before the
 *   buttons section — S2's authored round buttons remain**, per button: a
 *   pack that cannot draw one verb WHOLE — a blank frame, or an icon or
 *   background clip or shape it lacks — draws that one authored and the rest
 *   from the build (`actionButtonOps` decides). `source` says which each
 *   button is.
 *
 * ► **NOT THE BUILD'S, NAMED:** the close-up's stray `optionHG` (at a counter
 *   of 3 the build's `closerange_warrior` facing right leaves the psyche slot
 *   on its old frame; here it shows 28, the frame every other controller
 *   sends), and the disabled look (S9's; the build hides what it will not
 *   offer).
 */

import { actionButtonOps } from "../../src/render/action-buttons.js";

/**
 * THE RING'S BUTTONS WITH WHAT EACH ONE PAINTS.
 *
 * @param {object[]} buttons  from `ringButtonsAt`: `{slot, verb, scale, ...}`
 * @param {object} [options]
 * @param {object|null} [options.pack]  from `actionButtonPackFrom`, or null
 * @param {"right"|"left"} [options.facing="right"]  the stance's facing (the engine's)
 * @param {string|null} [options.hoverSlot]  the slot under the pointer
 * @param {number} [options.psyche=1]  the actor's `psyche_up` counter
 * @param {number|null} [options.ammo]  the actor's `ammo_left`, for the bow frames' count
 * @param {object|null} [options.textPack]  for the build's own glyphs on the buttons
 * @returns {object[]} frozen, one per button, in its order: the button plus
 *   `state` (`normal`|`hover`), `ops` (in the button's own pixels, `matrix`
 *   translations in twips, as `propOpsFor`'s), `source` (`build`|`authored`)
 *   and `centre` — the point of the button's own pixels its disc is centred
 *   on, which the painter puts on the button's `x`/`y`: 860's and the
 *   authored disc's are their origin, the swap's clip (116) centres its disc at
 *   (18.25, 18.25) (S6)
 *
 * The weapon swap (S6) draws 116's frame for the weapon it swaps TO — the
 * button's `usingBow`, the engine's — as `actionButtonOps` picks it. A place
 * of the items row (S5) draws 116 at its ITEM's frame — the build's
 * `inventory_buttonN.gotoAndStop(hero.inventoryN)`, the id is the frame —
 * over the same up/over background (the row's own rollover, overlay frame 1
 * body 0x2378d2 `+0x03bd`/`+0x04e3`), from the button's `itemId`.
 */
export function ringButtonArt(buttons, { pack = null, facing = "right", hoverSlot = null, psyche = 1, ammo = null, textPack = null } = {}) {
  return Object.freeze((buttons ?? []).map((button) => {
    const state = button.slot === hoverSlot ? "hover" : "normal";
    const { ops, source, centre } = actionButtonOps(pack, button.verb, {
      state, facing, psyche, ammo, textPack, scale: button.scale, usingBow: button.usingBow === true,
      itemId: Number.isInteger(button.itemId) ? button.itemId : null
    });
    return Object.freeze({ ...button, state, ops, source, centre });
  }));
}
