/**
 * WHAT EACH RING BUTTON DRAWS — slice S3 of `docs/design/battle-ui.md` ("the
 * build's own button art and placement on the ring"). Pure: `ring-layout.js`
 * says where each button stands, this says which operations it paints, and
 * `tools/arena/main.js` only paints them — and, since decision 7 (2026-09-28),
 * where the words it paints stand (`ringWordBoxesOf`), which the items row
 * keeps clear of.
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
 *   `state` (`normal`|`hover`, or `disabled` for a greyed one, S9), `ops` (in the button's own pixels, `matrix`
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
    // S9: a greyed button is drawn DISABLED — the build's own greyscale over
    // its art at reduced alpha, or the authored disabled disc — and never
    // takes the rollover, which says "press me".
    const state = button.reason ? "disabled" : button.slot === hoverSlot ? "hover" : "normal";
    const { ops, source, centre } = actionButtonOps(pack, button.verb, {
      state, facing, psyche, ammo, textPack, scale: button.scale, usingBow: button.usingBow === true,
      itemId: Number.isInteger(button.itemId) ? button.itemId : null
    });
    return Object.freeze({ ...button, state, ops, source, centre });
  }));
}

/**
 * THE WORDS THE RING'S BUTTONS PAINT, WHERE THEY PAINT THEM — for the owner's
 * decision 7 (`docs/design/battle-ui.md#decided-hud-2026-09-24`: "the spell
 * row never covers the bow buttons' words"), which `ringItemButtonsAt` keeps
 * its row clear of (`words`).
 *
 * The build's word on a button (a static run: POWER, NORMAL, QUICK, SNIPE,
 * BASH, BOMBARD) and the bow frames' arrow count are the ops `actionButtonOps`
 * marks `button: "label"` and `button: "ammo"`. Each gets one box per button:
 * the EXACT ink of its glyphs — every glyph path's own bounds, a curve's
 * extremum rather than its control point — under the glyph's matrix and then
 * the button's, its disc's `centre` on its `x`/`y` at its `scale`, as
 * `paintRingButton` paints it. A count drawn in the page's own font (a text
 * pack with no glyphs for the field) cannot be measured without a canvas: its
 * box is a whole em a figure by the em's height, centred where it is drawn,
 * plus half its outline — larger than a figure's ink, never smaller.
 *
 * The words' glow is not in the box: the build's (`blurX` 2, one pass) spreads
 * one button px past the ink, inside the gap the row keeps.
 *
 * Nothing else is a word: the background, the icon, the swap and the items
 * carry none, and an authored button's label stands beside it on the stage
 * (`ringLabelAt`), not on it.
 *
 * @param {object[]} drawn  from `ringButtonArt`: each with `ops`, `centre`, `scale`, `x`, `y`
 * @returns {object[]} frozen, `{slot, verb, word: "label"|"ammo", x0, x1, y0, y1}` in
 *   canvas px, in the buttons' order, the word before the count
 */
export function ringWordBoxesOf(drawn) {
  const out = [];
  for (const button of Array.isArray(drawn) ? drawn : []) {
    for (const word of RING_WORDS) {
      let ink = null;
      for (const op of button?.ops ?? []) {
        if (op?.button !== word) continue;
        const box = op.kind === "text" ? textBoxOf(op) : op.kind === "path" ? pathInkOf(op) : null;
        if (box) ink = ink ? unionOf(ink, box) : box;
      }
      if (!ink) continue;
      const toX = (x) => button.x + (x - button.centre.x) * button.scale;
      const toY = (y) => button.y + (y - button.centre.y) * button.scale;
      out.push(Object.freeze({ slot: button.slot, verb: button.verb, word, x0: toX(ink.x0), x1: toX(ink.x1), y0: toY(ink.y0), y1: toY(ink.y1) }));
    }
  }
  return Object.freeze(out);
}

/** The op roles that are words on a button: the build's word, then the arrow count. */
const RING_WORDS = Object.freeze(["label", "ammo"]);

const unionOf = (a, b) => ({ x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1) });

/**
 * THE EXACT INK OF ONE GLYPH OP, in the button's own px: its path (`M`, `L`,
 * `Q`, `Z`, absolute — what a SWF font's edges are, straight and quadratic,
 * and the `.notdef` box `src/render/text.js` draws) under its matrix, whose
 * translation is in twips; a quadratic's extremum is where its derivative is
 * zero, as `tools/extract-text.mjs`'s `inkBoundsOf` takes it. A stroked op
 * (the `.notdef` box) adds half its stroke. Null for a path with no point.
 */
function pathInkOf({ d, matrix, stroke = null, strokeWidth = 0 }) {
  const m = matrix;
  const tokens = String(d ?? "").match(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const at = (x, y) => [m[0] * x + m[2] * y + m[4] / 20, m[1] * x + m[3] * y + m[5] / 20];
  let box = null;
  const note = ([x, y]) => {
    box = box ? unionOf(box, { x0: x, x1: x, y0: y, y1: y }) : { x0: x, x1: x, y0: y, y1: y };
  };
  const extremum = (p0, c, p1) => {
    const denominator = p0 - 2 * c + p1;
    if (denominator === 0) return null;
    const s = (p0 - c) / denominator;
    return s > 0 && s < 1 ? (1 - s) * (1 - s) * p0 + 2 * s * (1 - s) * c + s * s * p1 : null;
  };
  let index = 0;
  let command = null;
  let pen = null;
  // Every token is taken or refused: a number no command takes (first, or after a close) would otherwise be
  // read forever, and a coordinate with no partner is no point.
  const unread = () => new Error(`ringWordBoxesOf: a glyph path it does not read (${JSON.stringify(command)} at token ${index} of ${String(d).slice(0, 40)})`);
  const point = () => {
    const x = Number(tokens[index++]);
    const y = Number(tokens[index++]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw unread();
    return at(x, y);
  };
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    else if (command === null || command === "Z") throw unread();
    if (command === "Z") continue;
    if (command === "M" || command === "L") {
      pen = point();
      note(pen);
    } else if (command === "Q" && pen) {
      const control = point();
      const end = point();
      const ex = extremum(pen[0], control[0], end[0]);
      const ey = extremum(pen[1], control[1], end[1]);
      if (ex !== null) note([ex, pen[1]]);
      if (ey !== null) note([pen[0], ey]);
      note(end);
      pen = end;
    } else {
      throw unread();
    }
  }
  if (!box || !stroke || !(strokeWidth > 0)) return box;
  // The stroke's half-width, in the op's own units, through the matrix's larger axis.
  const half = (strokeWidth / 2) * Math.max(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]));
  return { x0: box.x0 - half, x1: box.x1 + half, y0: box.y0 - half, y1: box.y1 + half };
}

/**
 * A count drawn in the page's own font (`paintRingButton`: bold, `size` px,
 * centred on `x`, middle baseline, an outline `max(1, size / 7)` wide): a
 * whole em a figure by the em's height, plus half the outline — no canvas to
 * measure it with, so larger than its ink, never smaller.
 */
function textBoxOf({ text, x, y, size, outline = null }) {
  if (![x, y, size].every(Number.isFinite)) return null;
  const half = (String(text ?? "").length * size) / 2;
  const rim = outline ? Math.max(1, size / 7) / 2 : 0;
  return { x0: x - half - rim, x1: x + half + rim, y0: y - size / 2 - rim, y1: y + size / 2 + rim };
}
