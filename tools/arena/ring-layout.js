/**
 * WHERE THE RING IS DRAWN, AND WHAT A CLICK ON THE CANVAS HITS — slices S2,
 * S3 and S4 (the moves no slot holds, `ringMoveButtonsAt`) of
 * `docs/design/battle-ui.md`. Pure canvas geometry for
 * `tools/arena/main.js`, which only paints what this places and asks this what
 * a point landed on.
 *
 * ► **THE PLACEMENT IS THE BUILD'S (S3).** The ring's centre and size are the
 *   overlay's own, under the camera (`ringPlacementFor`); each button stands at
 *   its slot's position in the player's pack — the matrix measured at the
 *   frame the stance's controller RESTS on (`buttons.layout`) — else at the
 *   relayed `SS2_OVERLAY_SLOTS` (the main session's probe of overlay frame 4,
 *   which the real pack's layout matches within 0.05 px on each axis at every
 *   resting frame; `test/render-action-buttons.test.js` holds it under 0.06).
 *   A button is `unit` canvas pixels per overlay pixel. Only the FITTED view
 *   (no extracted arena) keeps S2's authored `RING_STAGE_SCALE`, and the
 *   close-up is not drawn (see `ringPlacementFor`).
 */

import {
  FALLBACK_BUTTON_RADIUS,
  SS2_BUTTON_WIRING,
  SS2_OPTION_SLOTS,
  SS2_OVERLAY_PLACEMENT,
  overlaySlotPosition,
  ss2FlipOverlayFor,
  ss2OverlayPlacement
} from "../../src/render/action-buttons.js";

/**
 * STAGE PIXELS PER OVERLAY PIXEL, AUTHORED: 1.2. The build's own is
 * `flipoverlay × maxscale / 10000` once the zoom settles, 0.9 to 1.4 across
 * every zoom `combatscale` writes — the test computes that range from
 * `ss2FlipOverlayFor` and holds this inside it.
 *
 * Since S3 this is only the FITTED view's: the authored bowl a tree without
 * the extracted arena draws has no build camera to cancel.
 */
export const RING_STAGE_SCALE = 1.2;

/**
 * ► **WHERE THE OVERLAY STANDS AND HOW BIG IT IS DRAWN — the build's own
 *   placement (slice S3).** `gladiators.onEnterFrame` (sprite 2249 frame 1
 *   body 0x6e4221, re-read from an action dump for this slice) puts the
 *   overlay, a child of `gladiators`, at the hero's `_x` and `_y - 180`
 *   (`+0x0f0d`, `+0x1028`..`+0x1051`) and scales it to `flipoverlay`% on BOTH
 *   facing arms (`+0x11c8`, `+0x1224`) — the ring is never mirrored. So on the
 *   canvas one overlay pixel is `view.scale × flipoverlay / 100`: the zoom the
 *   fighters are drawn at, times the build's table keyed on the TARGET zoom
 *   `maxscale` (`+0x109d`..`+0x1180`).
 *
 * ► **THE CLOSE-UP IS NOT DRAWN, AND `buildClosesUp` SAYS WHEN THE BUILD
 *   WOULD.** At 1,600 or more apart (`gDistance < 1600` fails, `+0x0f08`) the
 *   build moves the overlay to the MIDPOINT, scales it to 600% (`+0x1197`) and
 *   shows the overlay's own large copy of the hero inside it (`overlay.hero`,
 *   sprite 711, `+0x0fd2`). No extracted pack holds that copy, and a ring at
 *   the midpoint around nobody would mark no fighter at all — in a team fight
 *   least of all. So the ring stays on the actor at the table's size, and the
 *   close-up waits on the art (an owner decision, `docs/design/battle-ui.md`).
 *
 * @param {object} at
 * @param {{x: number, y: number}} at.actor  the acting fighter's DRAWN arena position
 * @param {{x: number}|null} at.foe          the selected foe's (the build's villain)
 * @param {object|null} at.camera  the build's camera (`cameraFor`/`cameraStep`), or null
 *   in the FITTED view, where the authored `RING_STAGE_SCALE` applies
 * @param {object} at.view  `toX`/`toY`/`scale`, the projection the fighters were drawn with
 * @param {{scale: number}} at.fit  the stage letterbox (`stageFitFor`)
 * @returns {{x: number, y: number, unit: number, source: string, buildClosesUp: boolean}}
 *   the ring's centre and canvas pixels per overlay pixel; `source` is
 *   `build`, `team` or `authored`
 */
export function ringPlacementFor({ actor, foe = null, camera = null, view, fit }) {
  const x = view.toX(actor.x);
  const y = view.toY(actor.y, SS2_OVERLAY_PLACEMENT.aboveFeet);
  const buildClosesUp = Boolean(foe) && [actor.x, actor.y, foe.x].every(Number.isFinite)
    && ss2OverlayPlacement({ actorX: actor.x, actorY: actor.y, foeX: foe.x, maxscale: camera?.maxscale ?? null }).closeUp;
  const flip = camera ? ringFlipOverlayFor(camera.maxscale) : null;
  if (flip !== null) {
    return Object.freeze({ x, y, unit: (view.scale * flip.percent) / 100, source: flip.source, buildClosesUp });
  }
  return Object.freeze({ x, y, unit: fit.scale * RING_STAGE_SCALE, source: "authored", buildClosesUp });
}

/** The `maxscale` values the build's `flipoverlay` table writes an arm for, from 20 up (below 20 is one arm). */
const FLIP_ARMS = Object.freeze([20, 30, 50, 60, 70, 80]);

/**
 * `flipoverlay` for a target zoom: the build's own arm, or — for a zoom the
 * table has no arm for — the TEAM generalisation (AUTHORED): the on-screen
 * size of the band at or below it, `flipoverlay(arm) × arm / maxscale`.
 *
 * ► **ONLY A TEAM CAMERA REACHES THE SECOND BRANCH.** A pair's target always
 *   has an arm: it is one of `combatscale`'s bands except at separations
 *   2,991-3,000, where the fit (`640 / (spread + 210)`) binds at 19 — inside
 *   the build's own `< 20` arm (swept over every integer separation 0-8,000,
 *   both with and without sides). So a 1v1 draws the build's own numbers. A
 *   team camera targets the fit, any integer from 15 to 80;
 *   the build would keep whatever `flipoverlay` it last wrote, so the ring's
 *   size would depend on the camera's history. Holding the lower band's size
 *   keeps it inside the build's own 0.9-1.4 stage pixels per overlay pixel.
 */
function ringFlipOverlayFor(maxscale) {
  const own = ss2FlipOverlayFor(maxscale);
  if (own !== null) return { percent: own, source: "build" };
  if (!Number.isFinite(maxscale) || maxscale < FLIP_ARMS[0]) return null;
  const arm = FLIP_ARMS.filter((value) => value <= maxscale).at(-1);
  return { percent: (ss2FlipOverlayFor(arm) * arm) / maxscale, source: "team" };
}

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
 * `unit`, with the authored fallback's radius at the slot's own scale (the
 * build's round background, 826, is 18.5 px to the fallback's 18).
 * `side` is the ring column the button stands in, for where its label goes.
 *
 * `layout` is a pack's `buttons.layout`: the slot's measured matrix at the
 * frame `model.stance.frame`'s controller rests on, where the pack has one;
 * the relayed table otherwise.
 */
export function ringButtonsAt(model, { centerX, centerY, unit, layout = null }) {
  const restsAt = layout?.controllers?.[model?.stance?.frame]?.restsAt ?? null;
  const out = [];
  for (const slot of model?.slots ?? []) {
    if (!slot.verb) continue;
    const at = overlaySlotPosition(slot.slot, { layout, frame: restsAt });
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

/**
 * THE SLOT EACH WALK SITS IN, from the build's own wiring: every controller
 * frame that wires `walkleft` wires it at the same slot, and `walkright` too
 * (`SS2_BUTTON_WIRING`, all four frames in both facings). Computed, never
 * typed; a wiring that put one walk in two slots would have no answer here.
 */
const WALK_SLOTS = (() => {
  const found = { walkleft: new Set(), walkright: new Set() };
  for (const record of Object.values(SS2_BUTTON_WIRING)) {
    for (const facing of ["right", "left"]) {
      for (const [slot, wires] of Object.entries(record[facing])) {
        for (const one of wires) if (found[one.verb]) found[one.verb].add(slot);
      }
    }
  }
  return Object.freeze(Object.fromEntries(Object.entries(found).map(([verb, slots]) => [verb, slots.size === 1 ? [...slots][0] : null])));
})();

/**
 * ► **THE MOVES NO SLOT HOLDS (slice S4; the owner's Q5, "movement is
 *   spatial").** Drawn beside the eight, in the model's move order, the same
 *   size as the ring's own buttons:
 *
 * - **A walk the stance does not wire** — the close frames wire only the
 *   retreat, so a walk the engine offers toward a foe in reach (he is in
 *   another rank, or there is a foe on each side) has no slot, and its side's
 *   walk slot holds a swing. It stands BESIDE that walk slot, one pitch in
 *   toward the fighter — on the side it moves toward, as the owner decided,
 *   and never over the swing that keeps its slot. AUTHORED.
 * - **Step back a rank ABOVE THE HEAD, step forward BELOW THE FEET** — the
 *   owner's authored rank arrows, on the fighter's own line, standing off his
 *   head and off whatever is drawn under his feet (his name) by the gap the
 *   ring leaves between two of its buttons. They follow the fighter's drawn
 *   body, not the ring, because the ring keeps one size on screen while the
 *   fighter shrinks as the camera pulls back. Kept inside `bounds` (a giant
 *   close up would put one off the canvas).
 *
 * The pitch is the ring's own: the smallest distance between two of its
 * eight slots at the stance's resting frame (B-C and E-F, 31.5 overlay px, in
 * the relayed table), from the same positions `ringButtonsAt` draws. Nothing
 * here overlaps a slot by construction: a walk beside stands a full pitch in
 * from its slot, and a rank arrow is on the centre line, which the eight
 * leave clear by more than a pitch.
 *
 * `slot` is the move's name (`walk-left`, `rank-back`), so a click and a hover
 * name it as they name a slot; `ringActionFor` takes either.
 *
 * @param {object} model  from `ringModelFor`; only `moves` placed `beside`,
 *   `above-head` or `below-feet` are drawn here — a walk IN its slot is that
 *   slot's button, from `ringButtonsAt`
 * @param {object} at
 * @param {number} at.centerX, at.centerY  the ring's centre, canvas pixels
 * @param {number} at.unit     canvas pixels per overlay pixel
 * @param {object|null} [at.layout]  the pack's `buttons.layout`, as `ringButtonsAt` takes it
 * @param {number} at.head     canvas y of the top of the acting fighter's head
 * @param {number} at.feet     canvas y of the bottom of what is drawn under his feet
 * @param {{top: number, bottom: number}|null} [at.bounds]  canvas y a rank arrow stays inside
 */
export function ringMoveButtonsAt(model, { centerX, centerY, unit, layout = null, head, feet, bounds = null }) {
  const restsAt = layout?.controllers?.[model?.stance?.frame]?.restsAt ?? null;
  const positions = SS2_OPTION_SLOTS.map((slot) => overlaySlotPosition(slot, { layout, frame: restsAt })).filter(Boolean);
  let pitch = Infinity;
  for (const a of positions) for (const b of positions) if (a !== b) pitch = Math.min(pitch, Math.hypot(a.x - b.x, a.y - b.y));
  const out = [];
  for (const move of model?.moves ?? []) {
    if (move.place === "slot") continue;
    let x;
    let y;
    let scale;
    let side;
    if (move.place === "beside") {
      const own = overlaySlotPosition(WALK_SLOTS[move.verb], { layout, frame: restsAt });
      if (!own) continue;
      const inward = own.x < 0 ? 1 : -1;
      x = centerX + (own.x + inward * pitch) * unit;
      y = centerY + own.y * unit;
      scale = own.scale;
      side = own.x < 0 ? "left" : "right";
    } else {
      const walk = overlaySlotPosition(WALK_SLOTS.walkleft, { layout, frame: restsAt });
      scale = walk.scale;
      const r = FALLBACK_BUTTON_RADIUS * scale * unit;
      const gap = (pitch - 2 * FALLBACK_BUTTON_RADIUS * scale) * unit;
      x = centerX;
      y = move.place === "above-head" ? head - gap - r : feet + gap + r;
      if (bounds) y = Math.min(Math.max(y, bounds.top + r), bounds.bottom - r);
      side = "centre";
    }
    out.push(Object.freeze({
      key: move.key,
      slot: move.move,
      move: move.move,
      place: move.place,
      verb: move.verb,
      x,
      y,
      r: FALLBACK_BUTTON_RADIUS * scale * unit,
      scale: scale * unit,
      side
    }));
  }
  return Object.freeze(out);
}

/**
 * ► **THE RING KEPT ON THE STAGE (Codex review of S4, pass 2) — AUTHORED.**
 *   The build puts its overlay on the hero whatever the camera shows, and a
 *   team camera frames the FIGHTERS, not the ring around one of them: under
 *   the arena's own settled camera, over 30 seeded bouts with every foe
 *   selected, 1,708 of 4,740 rings had a button at least partly off the
 *   stage's side — a slotted walk wholly off it among them, so a move the
 *   engine offered could not be clicked. So the whole set is moved back onto
 *   the stage by the least that does it, on each axis, EVERY button by the
 *   same amount: the ring keeps its shape, nothing overlaps that did not, and
 *   the eight stay around the fighter as nearly as the edge allows. A set
 *   wider than the stage keeps its left (top) edge on the stage's.
 *
 * @param {object[]} buttons  from `ringButtonsAt` and `ringMoveButtonsAt`: `{x, y, r, ...}`
 * @param {{x: number, y: number, width: number, height: number}} stage  the visible
 *   stage in canvas pixels (`stageClipRectFor`)
 * @returns {object[]} the same buttons when all are inside, else frozen copies moved
 */
export function ringButtonsInside(buttons, stage) {
  if (!Array.isArray(buttons) || buttons.length === 0 || !stage) return buttons;
  const into = (low, high, from, to) => (high - low > to - from ? from - low : Math.max(from - low, Math.min(0, to - high)));
  const dx = into(Math.min(...buttons.map((b) => b.x - b.r)), Math.max(...buttons.map((b) => b.x + b.r)), stage.x, stage.x + stage.width);
  const dy = into(Math.min(...buttons.map((b) => b.y - b.r)), Math.max(...buttons.map((b) => b.y + b.r)), stage.y, stage.y + stage.height);
  if (dx === 0 && dy === 0) return buttons;
  return Object.freeze(buttons.map((button) => Object.freeze({ ...button, x: button.x + dx, y: button.y + dy })));
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
