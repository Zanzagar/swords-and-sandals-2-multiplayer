/**
 * WHERE THE RING IS DRAWN, AND WHAT A CLICK ON THE CANVAS HITS — slice S2 of
 * `docs/design/battle-ui.md`. Pure canvas geometry for `tools/arena/main.js`,
 * which only paints what this places and asks this what a point landed on.
 *
 * ► **THE SLOT POSITIONS ARE THE BUILD'S (as relayed), THE SCALE IS
 *   AUTHORED.** Each button stands at its slot's `SS2_OVERLAY_SLOTS` offset —
 *   the main session's probe of overlay frame 4, unverified until a pack
 *   carries `buttons.layout` (see `src/render/action-buttons.js`) — times one
 *   `unit`, canvas pixels per overlay pixel. The build's own unit follows the
 *   camera (`ss2OverlayPlacement`, and the close-up past 1,600 apart); that is
 *   slice S3's. S2 draws at `RING_STAGE_SCALE` stage pixels per overlay pixel.
 */

import { FALLBACK_BUTTON_RADIUS, SS2_OVERLAY_SLOTS } from "../../src/render/action-buttons.js";

/**
 * STAGE PIXELS PER OVERLAY PIXEL, AUTHORED: 1.2. The build's own is
 * `flipoverlay × maxscale / 10000` once the zoom settles, 0.9 to 1.4 across
 * every zoom `combatscale` writes — the test computes that range from
 * `ss2FlipOverlayFor` and holds this inside it.
 */
export const RING_STAGE_SCALE = 1.2;

/**
 * THE FIGHTER CLIP'S HEIGHT AND HALF-WIDTH, in clip pixels (one arena unit
 * each at `size` 1). The height is the build's: the clip's origin is the soles
 * and its head is at -220 (the blood's spawn band in `main.js` reads the
 * same). The half-width is AUTHORED — a body and a weapon's worth to click.
 */
const FIGHTER_HEIGHT = 220;
const FIGHTER_HALF_WIDTH = 55;

/**
 * THE BUTTONS TO DRAW, in key order: one per FILLED slot (S2 shows only what
 * the engine offers), at `(centerX, centerY)` plus the slot's offset times
 * `unit`, with the authored fallback's radius at the slot's own scale.
 * `side` is the ring column the button stands in, for where its label goes.
 */
export function ringButtonsAt(model, { centerX, centerY, unit }) {
  const out = [];
  for (const slot of model?.slots ?? []) {
    if (!slot.verb) continue;
    const at = SS2_OVERLAY_SLOTS[slot.slot];
    if (!at) continue;
    out.push(Object.freeze({
      key: slot.key,
      slot: slot.slot,
      verb: slot.verb,
      x: centerX + at.x * unit,
      y: centerY + at.y * unit,
      r: FALLBACK_BUTTON_RADIUS * at.scale * unit,
      scale: at.scale * unit,
      side: at.x < 0 ? "left" : "right"
    }));
  }
  return Object.freeze(out);
}

/** The slot of the drawn button a point is on (rim included), or null. */
export function ringSlotAt(buttons, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const button of buttons ?? []) {
    const distance = Math.hypot(x - button.x, y - button.y);
    if (distance <= button.r && distance < bestDistance) {
      best = button.slot;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * A FIGHTER'S CLICKABLE BOX on the canvas: standing on `(footX, footY)`, a
 * clip's height tall at his `size`, `pxPerUnit` canvas pixels per arena unit.
 */
export function fighterBoxFor({ footX, footY, pxPerUnit, size = 1 }) {
  const k = pxPerUnit * size;
  return Object.freeze({
    x0: footX - FIGHTER_HALF_WIDTH * k,
    x1: footX + FIGHTER_HALF_WIDTH * k,
    y0: footY - FIGHTER_HEIGHT * k,
    y1: footY
  });
}

/**
 * THE FOE A CLICK LANDS ON: of the boxes (in paint order) that hold the point
 * and belong to one of `foeIds`, the one drawn LAST — the one in front. A
 * friend standing in front takes nothing: he is not a target.
 */
export function foeAt(boxes, x, y, foeIds) {
  const foes = new Set(foeIds ?? []);
  let hit = null;
  for (const box of boxes ?? []) {
    if (!foes.has(box.id)) continue;
    if (x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1) hit = box.id;
  }
  return hit;
}
