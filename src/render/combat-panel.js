/**
 * THE BUILD'S OWN GAUGES, IN THE FRAME — `combat_panel` (sprite 751): each
 * fighter's health vial, energy vial and armour gauge under his name banner,
 * driven exactly as the build drives them, from the player's own extracted
 * art (`assets/icons/icons.json`'s `gauges` section, `tools/extract-icons.mjs`)
 * or, without it, an authored stand-in with the same layout and drive.
 *
 * Decisions D2 of the in-frame team HUD (2026-09-24): a 1v1 is the build's own
 * panel at the build's own place; a team bout gives every fighter ONE cluster
 * (the build's hero cluster on red, its villain cluster on blue) scaled by
 * `s = min(1, 316 / (N * 215))` and bottom-anchored where the build's banners
 * end. The name is the fighter's own, in his team's colour. The acting
 * fighter's cluster is marked (authored, the target ring's gold); a fallen
 * fighter's is drawn at 0.4; the armour gauge hides at `armourclass <= 0`.
 *
 * ## The interface
 *
 * ```text
 *   combatPanelPackFrom(iconsJson)         -> pack | null   (null: draw the fallback)
 *   combatPanelLayoutFor({ sides, pack })  -> { mode, scale, hudTop, clusters }
 *   combatPanelOpsFor(pack, textPack, cluster, reading, { stageScale }) -> ops | null
 *   combatPanelFallbackOpsFor(cluster, reading)                         -> ops
 *   combatPanelInvoiceFor(pack, textPack, cluster, reading)             -> counts | null
 *   gaugeDriveFor(value, max)              -> { pct, y, text, authored }
 * ```
 *
 * `reading` is one row of `teamHudFor(...).teams[].rows` (`tools/arena/team-hud.js`):
 * `name`, `colour`, `acting`, `alive`, and `health`/`energy`/`armour` as
 * `{ value, max, percent, shown }`. This module takes `value`, `max` and
 * `shown` from it and never re-derives a reading.
 *
 * ## The ops, and how to paint them
 *
 * **Every op is in STAGE pixels** (the 640 x 420 stage; the cluster's matrix
 * is already composed in), in the pop-ups' contract:
 *
 * - `kind: "path"`: `d` in the path's own pixels; `matrix` `[a, b, c, d, tx, ty]`
 *   maps them to the stage with `tx`/`ty` in TWIPS (divide by 20 — nothing
 *   else); `clip`, when present, is `{ matrix, d }` in the same convention and
 *   must be in force for the fill (`paintLayerOperation` in
 *   `tools/arena/main.js` applies it — **once D7's fix lands; today it
 *   restores the clip away before the fill, and the liquid would spill**);
 *   `group`, when present, is a glow group for `paintGroupRuns` to composite.
 * - `kind: "text"`: the page font's stand-in for a word with no glyphs —
 *   `text`, `x`, `y` (stage px, the anchor), `size` (stage px), `fill`,
 *   `outline`, `alpha`, and **`align` ("left" | "center" | "right")**, which
 *   the pop-ups' words never needed: a name is anchored at its field's inner
 *   left (hero) or right (villain) edge, not at the box's centre.
 * - Every op carries `panel` ("banner" | "name" | "health" | "energy" |
 *   "armour" | "acting") and, for words, `role` ("name" | "number" | "label");
 *   authored paths carry `authored: true`.
 *
 * **Lay out with the art you draw with.** `hudTop` is the highest ink of the
 * art the clusters will be drawn with — the pack's, or with `pack: null` the
 * fallback's, which reaches 3.6 px lower — MEASURED off that art's own ops,
 * at every reading (a liquid counts at its cutter's top, where it reaches when
 * full). So pass `combatPanelPackFrom`'s answer to BOTH calls; a cluster laid
 * out for one art and drawn with the other throws `CombatPanelError`.
 *
 * The paint call, per frame, inside the stage fit and over the fighters:
 *
 * ```js
 *   const layout = combatPanelLayoutFor({ sides, pack });   // layout.hudTop -> the camera
 *   const ops = combatPanelOpsFor(pack, textPack, cluster, reading, { stageScale: fit.scale })
 *     ?? combatPanelFallbackOpsFor(cluster, reading);
 *   context.save();
 *   context.translate(fit.offsetX, fit.offsetY);
 *   context.scale(fit.scale, fit.scale);
 *   paintGroupRuns(ops.filter((op) => op.kind === "path"),
 *     { translationDivisor: TWIPS_PER_PIXEL, filtersScaled: true }, paintLayerOperation);
 *   for (const word of ops.filter((op) => op.kind === "text")) {
 *     // as `paintPopup` does, but `context.textAlign = word.align ?? "center"`
 *   }
 *   context.restore();
 * ```
 *
 * `stageScale` is device pixels per STAGE pixel, so the glows are built at the
 * width they are drawn (`filtersScaled: true`); this module multiplies in the
 * cluster's own scale.
 *
 * ## What is not the build's, named
 *
 * - The banner's INNER BEVEL (distance -6, blur 0) is drawn plain and counted
 *   (`combatPanelInvoiceFor(...).bevelsDrawnPlain`): `canvasFilterFor` refuses
 *   it, and drawing one by hand would rest on which side the player puts the
 *   highlight at a negative distance, which nothing here has measured.
 * - A max of 0 (or no reading) is drawn EMPTY: the build divides by zero there
 *   and what it then draws was never measured (`gaugeDriveFor`).
 * - The acting mark, the fallen fade and the team layout are D2's, authored.
 *   A fallen cluster's glows are built from faded glyphs, so they fade less
 *   than the fills (`glowsUnderFade`).
 * - The fallback is drawn here by hand — a band, a flask, a shield — and
 *   carries no path from the pack.
 * - `hudTop` counts a word as the PAGE FONT draws it (its em box and
 *   outline, as `paintPopup` paints one). A word in the build's GLYPHS is not
 *   measured by the layout, which has no text pack and no reading: a glyph's
 *   ink depends on the font and the text. In the build's own pack the highest
 *   glyph lies 24.5 px below the vial glass that sets the top (a pair,
 *   measured 2026-09-24; its 1 px glow does not close that), and the
 *   real-pack test measures it rather than assuming it.
 *
 * Pure: no canvas, no clock, no battle. Nothing here touches combat state.
 */

import { applyColourTransformAlpha, colourTransformFrom, concatColourTransforms } from "./filters.js";
import { IDENTITY, compose, glowGroupFor, matrixOf } from "./pack-ops.js";
import { propOpsFor } from "./props.js";
import { FIELD_GUTTER_PX, fieldOpsFor, staticTextOpsFor } from "./text.js";

export class CombatPanelError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * THE DRIVE, hand-cited from the six gauge clip-actions in sprite 751 frame 1
 * (all `onClipEvent(enterFrame)`): hero_potion body 0x2264d1, villain_potion
 * 0x226343, hero_stamina_potion 0x2267e8, villain_stamina_potion 0x226669,
 * hero_armour 0x22695d, villain_armour 0x226b37. In hero_potion:
 *
 * ```text
 *   +0x00a2  this.hitpoints          = v + " / " + max
 *   +0x00f6  this.hitpointpercentage = Math.round(v / max * 100)
 *   +0x013b  this.blood_health._y    = Math.round(-30 + (101 - this.hitpointpercentage) * 0.7)
 * ```
 *
 * `tools/extract-icons.mjs` re-derives every number here from the bytes into
 * the pack's `gauges.drive`, and `combatPanelPackFrom` refuses a pack whose
 * drive is not exactly this one — two independent paths to one answer.
 */
export const SS2_GAUGE_DRIVE = Object.freeze({
  base: -30,
  full: 101,
  step: 0.7,
  percentScale: 100,
  rounding: "round",
  separator: " / "
});

function driveY(pct) {
  // The build's own order of operations, so a half-pixel rounds where the
  // player rounds it: `-30 + (101 - pct) * 0.7`, then `Math.round`.
  return Math.round(SS2_GAUGE_DRIVE.base + (SS2_GAUGE_DRIVE.full - pct) * SS2_GAUGE_DRIVE.step);
}

/** Where the liquid sits for an empty gauge, `Y(0)`: the stand-in for a drive the build's arithmetic cannot give. */
const EMPTY_Y = driveY(0);

/**
 * ONE GAUGE'S DRIVE, exactly as the build computes it: the percent, the
 * liquid's `_y` (an integer, in the gauge sprite's own pixels) and the number
 * the field shows.
 *
 * - NOT CLAMPED. Over max gives a `y` above full (110 / 100 -> -36) and below
 *   zero one below empty (-5 / 100 -> 44); the gauge's mask crops both, as
 *   the build's does.
 * - A MAX OF 0 divides by zero in the build and hands `_y` a non-finite
 *   number; what the player does with that was never measured. It is drawn
 *   EMPTY (`Y(0)`), `pct` is null, the number is still what the build prints,
 *   and `authored` says so.
 * - NO READING (a non-number or non-finite value or max): drawn empty with no
 *   number, and `authored` says so.
 *
 * @param {number} value
 * @param {number} max
 * @returns {{pct: number|null, y: number, text: string|null, authored: string|null}}
 */
export function gaugeDriveFor(value, max) {
  const known = typeof value === "number" && Number.isFinite(value) && typeof max === "number" && Number.isFinite(max);
  if (!known) {
    return Object.freeze({ pct: null, y: EMPTY_Y, text: null, authored: "no reading: drawn empty, with no number" });
  }
  const text = `${value}${SS2_GAUGE_DRIVE.separator}${max}`;
  const pct = Math.round((value / max) * SS2_GAUGE_DRIVE.percentScale);
  const y = driveY(pct);
  if (!Number.isFinite(y)) {
    return Object.freeze({
      pct: null, y: EMPTY_Y, text,
      authored: "a max of 0: the build divides by zero there and what it draws is unmeasured; drawn empty"
    });
  }
  return Object.freeze({ pct, y, text, authored: null });
}

/* ------------------------------------------------------------------ */
/* The panel, where the build puts it                                  */
/* ------------------------------------------------------------------ */

/**
 * THE BUILD'S PANEL, hand-cited, in its own pixels ("panel px") with matrix
 * translations in TWIPS. `tools/extract-icons.mjs` re-derives every placement
 * into the pack's `gauges.placements` and `gauges.attach`, and
 * `combatPanelPackFrom` refuses a pack whose placements or origin are not
 * exactly this table's.
 *
 * - `origin`: panel (0, 0) on the stage. Sprite 2249 frame 1 (DoAction body
 *   0x6e4221, `+0x0bf2`..`+0x0c28`) runs
 *   `_root.arena.attachMovie("combat_panel", "combat_panel", 200000, {_x: -320, _y: 122})`,
 *   and `arena` (2249) stands at root depth 59, (6399, 3335) twips =
 *   (319.95, 166.75), on root frames 221..226. So (-0.05, 288.75).
 * - Each side's CLUSTER is the build's own placements in 751 frame 1, and
 *   paints in their depth order. Neither side is mirrored art: both use
 *   733/742/749 at scale +1, and both banners are sprite 52 at
 *   a = -1.99998, d = +1.99998 (the same way round), with an inner bevel.
 * - `box` is where the cluster STANDS, in panel px: the banner's x range
 *   (shape 51's bounds -143.5..-36 under its matrix) and its bottom (9.55
 *   under d 1.99998 and 96.25) at 115.35 — what the layout anchors and
 *   steps by. It has NO TOP: the top is the highest ink of the art actually
 *   drawn, measured by `combatPanelLayoutFor` from that art (the build's own
 *   vial glass reaches 10.55; the fallback's vial rim 14.15). ~~A typed
 *   `yMin: 10.55` stood here and `hudTop` was read off it, so it followed no
 *   art: 3.6 px above the fallback's ink, and unmoved when the glass moved
 *   (verifier `verify:gauges-r3`, 2026-09-24).~~ The number fields' BOXES
 *   overhang the x range by up to 5.65 px (740's box starts at -5.6); their
 *   centred ink does not.
 */
export const SS2_COMBAT_PANEL = Object.freeze({
  character: 751,
  linkage: "combat_panel",
  origin: Object.freeze({ x: -0.05, y: 288.75 }),
  clusters: Object.freeze({
    hero: Object.freeze({
      side: "hero",
      banner: Object.freeze({ depth: 7, character: 52, matrix: Object.freeze([-1.99998, 0, 0, 1.99998, -1439, 1925]) }),
      name: Object.freeze({ depth: 18, character: 734, variable: "herotext", align: "left", matrix: Object.freeze([1, 0, 0, 1, -1199, 1704]) }),
      gauges: Object.freeze({
        health: Object.freeze({ depth: 19, character: 733, instance: "hero_potion", matrix: Object.freeze([1, 0, 0, 1, 2035, 933]) }),
        energy: Object.freeze({ depth: 38, character: 742, instance: "hero_stamina_potion", matrix: Object.freeze([1, 0, 0, 1, 704, 933]) }),
        armour: Object.freeze({ depth: 47, character: 749, instance: "hero_armour", matrix: Object.freeze([1, 0, 0, 1, 3410, 934]) })
      }),
      box: Object.freeze({ xMin: 0.05, xMax: 215.05, yMax: 115.35 })
    }),
    villain: Object.freeze({
      side: "villain",
      banner: Object.freeze({ depth: 1, character: 52, matrix: Object.freeze([-1.99998, 0, 0, 1.99998, 7019, 1925]) }),
      name: Object.freeze({ depth: 28, character: 735, variable: "villaintext", align: "right", matrix: Object.freeze([1, 0, 0, 1, 5652, 1704]) }),
      gauges: Object.freeze({
        health: Object.freeze({ depth: 9, character: 733, instance: "villain_potion", matrix: Object.freeze([1, 0, 0, 1, 10700, 933]) }),
        energy: Object.freeze({ depth: 29, character: 742, instance: "villain_stamina_potion", matrix: Object.freeze([1, 0, 0, 1, 12054, 933]) }),
        armour: Object.freeze({ depth: 55, character: 749, instance: "villain_armour", matrix: Object.freeze([1, 0, 0, 1, 9478, 923]) })
      }),
      box: Object.freeze({ xMin: 422.95, xMax: 637.95, yMax: 115.35 })
    })
  })
});

/**
 * D2's team layout: each cluster `CLUSTER_WIDTH` panel px wide, and N of them
 * a side in `TEAM_HALF_WIDTH` stage px — `s = min(1, 316 / (N * 215))`, the
 * main session's decision (2026-09-24, D2).
 */
export const SS2_TEAM_CLUSTERS = Object.freeze({ halfWidth: 316, clusterWidth: 215 });

/** Which cluster a side draws: red the build's hero's, blue its villain's (D2). */
const SIDE_OF_TEAM = Object.freeze({ red: "hero", blue: "villain" });

/* ------------------------------------------------------------------ */
/* How high the art reaches: the top the layout reports                */
/* ------------------------------------------------------------------ */

/**
 * The stage y of the top of ONE PATH'S geometry under `matrix` (translations
 * in twips): every point of it, and a quadratic's own extremum rather than its
 * control point. The vocabulary is the pack's and the fallback's — absolute
 * M, L, Q and Z, which is all `shapeToPaths` writes — and anything else is an
 * error by name, never a guess.
 */
function pathTopOf(d, matrix) {
  const tokens = String(d).match(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const yOf = ([x, y]) => matrix[1] * x + matrix[3] * y + matrix[5] / 20;
  let top = Infinity;
  let index = 0;
  let command = null;
  let from = null;
  let start = null;
  const point = () => {
    const pair = [Number(tokens[index]), Number(tokens[index + 1])];
    index += 2;
    if (!pair.every(Number.isFinite)) throw new CombatPanelError(`A path this module cannot measure: "${String(d).slice(0, 40)}".`);
    return pair;
  };
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) {
      command = tokens[index];
      index += 1;
      if (command === "Z") { from = start; continue; }
    }
    if (command === "M" || command === "L") {
      from = point();
      if (command === "M") start = from;
      top = Math.min(top, yOf(from));
    } else if (command === "Q" && from) {
      const control = point();
      const end = point();
      const [y0, y1, y2] = [yOf(from), yOf(control), yOf(end)];
      const bend = y0 - 2 * y1 + y2;
      const t = bend === 0 ? -1 : (y0 - y1) / bend;
      if (t > 0 && t < 1) top = Math.min(top, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t * t * y2);
      top = Math.min(top, y2);
      from = end;
    } else {
      throw new CombatPanelError(`A path command this module cannot measure ("${command}") in "${String(d).slice(0, 40)}".`);
    }
  }
  return top;
}

/**
 * The top of ONE OP'S INK, as `tools/arena/main.js` paints it — the highest
 * it can reach at ANY reading:
 *
 * - a path paints when it has a fill, a gradient, a bitmap or a stroke
 *   (`paintLayerOperation`), and its stroke reaches half its width every way
 *   (`lineJoin = "round"`), under the op's own matrix;
 * - a CUT path (`clip`) reaches no higher than its cutter — and the liquid,
 *   which the drive moves, reaches exactly that at a full reading, so the
 *   cutter is its top whatever the reading is now;
 * - a page-font word is its em box plus half its outline (`paintPopup`:
 *   `textBaseline = "middle"`, `lineWidth = max(1, size / 7)`).
 */
function opInkTopOf(op) {
  if (op.kind === "text") return op.y - op.size / 2 - Math.max(1, op.size / 7) / 2;
  if (op.clip) return pathTopOf(op.clip.d, op.clip.matrix);
  const stroked = Boolean(op.stroke) && op.strokeWidth > 0;
  if (!((op.fill && op.fill !== "none") || op.gradient || op.bitmap || stroked)) return Infinity;
  return pathTopOf(op.d, op.matrix) - (stroked ? (op.strokeWidth / 2) * Math.hypot(op.matrix[1], op.matrix[3]) : 0);
}

/**
 * The reading the art reaches highest at: every gauge shown, a name to write.
 * The top it gives is the cluster's at EVERY reading — its liquids count at
 * their cutters — so the camera's line does not move as the blows land.
 */
const REACH_READING = Object.freeze({
  name: "M", colour: null, acting: false, alive: true,
  health: Object.freeze({ value: 1, max: 1, shown: true }),
  energy: Object.freeze({ value: 1, max: 1, shown: true }),
  armour: Object.freeze({ value: 1, max: 1, shown: true })
});

/** What `combatPanelOpsFor` draws from: a pack, or (anything else) nothing — and then the fallback draws. */
const isPack = (pack) => Boolean(pack && pack.clips && pack.shapes);

/** Measured tops, per art, side and linear part: an art is fixed, so each is measured once. */
const packTops = new WeakMap();
const fallbackTops = new Map();

/**
 * THE TOP OF ONE SIDE'S CLUSTER, measured from the ops the art it will be
 * drawn with draws — the pack's (with no text pack: its words in the page
 * font) or, with no pack, the fallback's: in stage px under `linear` (the
 * cluster matrix's `[a, b, c, d]`), relative to the cluster's own origin —
 * add its `ty`.
 */
function artTopFor(pack, def, linear) {
  const memo = isPack(pack) ? (packTops.get(pack) ?? packTops.set(pack, new Map()).get(pack)) : fallbackTops;
  const key = `${def.side}:${linear.join(",")}`;
  if (!memo.has(key)) {
    const outer = [...linear, 0, 0];
    const ops = isPack(pack) ? drawPackArt(pack, null, def, outer, REACH_READING, {}).ops : fallbackArtOps(def, outer, REACH_READING);
    memo.set(key, Math.min(...ops.map(opInkTopOf)));
  }
  return memo.get(key);
}

/**
 * A cluster is drawn only with the art it was laid out for: its box's top is
 * that art's, and `hudTop` is read off it. The build's glass and the
 * fallback's vial reach different heights, so a layout made for one and
 * drawn with the other hands the camera a top the ink does not have.
 */
function assertLaidOutFor(pack, cluster, def) {
  const matrix = matrixOf(cluster?.matrix);
  if (!matrix) throw new CombatPanelError("A cluster needs its layout matrix (combatPanelLayoutFor).");
  const top = matrix[5] + artTopFor(pack, def, matrix.slice(0, 4));
  if (!(Math.abs(cluster?.box?.yMin - top) <= 1e-9)) {
    throw new CombatPanelError(`Cluster ${cluster?.id ?? "?"} was laid out for other art: its top is ${cluster?.box?.yMin}, ` +
      `and ${isPack(pack) ? "this pack's" : "the fallback's"} is ${top}. Lay out with combatPanelLayoutFor({ sides, pack }) ` +
      "and the pack you draw with (null for the fallback), or hudTop describes ink that is not drawn.");
  }
}

/**
 * WHERE EACH FIGHTER'S CLUSTER STANDS, in stage px.
 *
 * - **A pair (one fighter a side) is the build's own panel**: both clusters
 *   at scale 1, at the build's own place — `matrix` is
 *   `[1, 0, 0, 1, -0.05, 288.75]` for both.
 * - **A team bout (either side has two or more)**: one cluster per fighter,
 *   every one at `s = min(1, 316 / (N * 215))` (N the larger side),
 *   bottom-anchored where the build's banners end (stage y 404.10). Red runs
 *   from the build's left edge in slot order (slot 1 leftmost); blue from the
 *   build's right edge (slot 1 rightmost); neighbours touch banner to banner.
 *
 * Each cluster: `{ id, teamId, side, slot, scale, matrix, box }` — `matrix`
 * maps PANEL px to STAGE px (`[s, 0, 0, s, tx, ty]`, translations in px), `box`
 * is the cluster on the stage: `SS2_COMBAT_PANEL`'s x range and bottom, and
 * as its TOP the highest ink the art it will be drawn with can reach at any
 * reading. `hudTop` is the highest of those (null with no cluster), for the
 * camera.
 *
 * **Lay out with the art you draw with**: `pack` is `combatPanelPackFrom`'s
 * answer — the pack for `combatPanelOpsFor`, or null (the default) for
 * `combatPanelFallbackOpsFor`. The build's glass reaches 3.6 px higher than
 * the fallback's vial, so the two tops differ.
 *
 * @param {object} input
 * @param {{teamId: string, ids: string[]}[]} input.sides  in slot order
 * @param {object|null} [input.pack=null]  `combatPanelPackFrom(...)`, the art the clusters will be drawn with
 */
export function combatPanelLayoutFor({ sides = [], pack = null } = {}) {
  const list = Array.isArray(sides) ? sides : [];
  // Red and blue take their own clusters; any other side takes whichever is
  // free, in the order given. The build has two sides and so does this.
  const bySide = new Map();
  for (const entry of list.filter((one) => Object.hasOwn(SIDE_OF_TEAM, one?.teamId ?? ""))) {
    // Two sides claiming one colour would drop one of them from the HUD without a word.
    if (bySide.has(SIDE_OF_TEAM[entry.teamId])) throw new CombatPanelError(`Two sides are both "${entry.teamId}".`);
    bySide.set(SIDE_OF_TEAM[entry.teamId], entry);
  }
  for (const entry of list.filter((one) => !Object.hasOwn(SIDE_OF_TEAM, one?.teamId ?? ""))) {
    const free = ["hero", "villain"].find((side) => !bySide.has(side));
    if (!free) throw new CombatPanelError(`The build's panel has two sides; a third ("${entry?.teamId}") has nowhere to stand.`);
    bySide.set(free, entry);
  }
  const idsOf = (side) => (Array.isArray(bySide.get(side)?.ids) ? bySide.get(side).ids : []);
  const largest = Math.max(0, ...["hero", "villain"].map((side) => idsOf(side).length));
  const mode = largest >= 2 ? "team" : "pair";
  const { halfWidth, clusterWidth } = SS2_TEAM_CLUSTERS;
  const scale = mode === "team" ? Math.min(1, halfWidth / (largest * clusterWidth)) : 1;
  const { origin } = SS2_COMBAT_PANEL;

  const clusters = [];
  for (const side of ["hero", "villain"]) {
    const def = SS2_COMBAT_PANEL.clusters[side];
    const teamId = bySide.get(side)?.teamId ?? null;
    idsOf(side).forEach((id, index) => {
      // The build's own edge, on the stage, and this slot's step in from it.
      const bottom = def.box.yMax + origin.y;
      const step = index * clusterWidth * scale;
      const tx = side === "hero"
        ? def.box.xMin + origin.x + step - scale * def.box.xMin
        : def.box.xMax + origin.x - step - scale * def.box.xMax;
      const ty = bottom - scale * def.box.yMax;
      const matrix = Object.freeze([scale, 0, 0, scale, tx, ty]);
      const xs = [scale * def.box.xMin + tx, scale * def.box.xMax + tx];
      const box = Object.freeze({
        xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: ty + artTopFor(pack, def, [scale, 0, 0, scale]), yMax: bottom
      });
      clusters.push(Object.freeze({ id, teamId, side, slot: index + 1, scale, matrix, box }));
    });
  }
  const hudTop = clusters.length > 0 ? Math.min(...clusters.map((cluster) => cluster.box.yMin)) : null;
  return Object.freeze({ mode, scale, hudTop, clusters: Object.freeze(clusters) });
}

/* ------------------------------------------------------------------ */
/* The pack                                                            */
/* ------------------------------------------------------------------ */

/** The instance name of the liquid inside each gauge sprite — the one child the drive moves. */
export const SS2_GAUGE_LIQUID = "blood_health";

/** The three gauges, in the order a cluster names them. */
export const SS2_GAUGES = Object.freeze(["health", "energy", "armour"]);

const shapeMember = (character) => Object.freeze({ kind: "shape", character });
const liquidMember = (character, cutter, liquid) => Object.freeze({ kind: "clip", character, cutter, holds: Object.freeze([shapeMember(liquid)]) });
const textMember = (character, record) => Object.freeze({ kind: "text", character, record });

/**
 * THE ART'S COMPOSITION, hand-cited: frame 1 of each sprite the panel draws,
 * in depth order, as `resolveTimeline` reads it from the build (re-derived
 * read-only 2026-09-24, sha256 77cb545c…):
 *
 * ```text
 *   52   d1 shape 51                                  (the banner)
 *   733  d1 shape 726, d2 shape 727 clipDepth 5 cutting d3 729 `blood_health`
 *        (729 = d1 shape 728), d6 shape 730, d7 DefineEditText 731 (`hitpoints`),
 *        d8 DefineText 732
 *   742  the same with 726, 736, 738 (= 737), 739, 740 (`hitpoints`), 741
 *   749  d1 shape 743 clipDepth 4 cutting d2 745 `blood_health` (= 744),
 *        d5 shape 746, d6 DefineEditText 747 (`armourpoints`), d7 DefineText 748
 * ```
 *
 * A pack is the build's only when each sprite is EXACTLY this — every shell,
 * cutter, liquid, number and label, each pointing at its own record, nothing
 * more (Codex review, pass 5: a vial stripped to its liquid was accepted).
 */
export const SS2_GAUGE_SPRITES = Object.freeze({
  52: Object.freeze([shapeMember(51)]),
  733: Object.freeze([shapeMember(726), liquidMember(729, 727, 728), shapeMember(730), textMember(731, "edit-text"), textMember(732, "static-text")]),
  742: Object.freeze([shapeMember(726), liquidMember(738, 736, 737), shapeMember(739), textMember(740, "edit-text"), textMember(741, "static-text")]),
  749: Object.freeze([liquidMember(745, 743, 744), shapeMember(746), textMember(747, "edit-text"), textMember(748, "static-text")])
});

const lookup = (table, id) => (table && typeof table === "object" ? (table[id] ?? table[String(id)] ?? null) : null);
const frameOne = (entry) => (Array.isArray(entry?.frames) && Array.isArray(entry.frames[0]) ? entry.frames[0] : null);

/** Whether a frame is EXACTLY its cited composition: every member, in depth order, each its own record, nothing more. */
function composedAsCited(placements, cited, { texts, nested }) {
  if (!Array.isArray(placements) || placements.length !== cited.length) return false;
  return cited.every((want, index) => {
    const got = placements[index];
    if (got?.kind !== want.kind || got.character !== want.character) return false;
    if (want.kind === "clip") {
      if (got.mask?.shape !== want.cutter) return false;
      return composedAsCited(frameOne(lookup(nested, want.character)), want.holds, { texts, nested });
    }
    if (want.kind === "text") return lookup(texts, want.character)?.kind === want.record;
    return true;
  });
}

/** A text record the pack can place: the kind the build defines, with a finite box. */
function placeableText(record, kind) {
  const bounds = record?.bounds;
  return record?.kind === kind && Boolean(bounds) && [bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax].every(Number.isFinite);
}

/** An extraction's own list of what went wrong, present and empty: a missing list is not a clean one. */
const cleanList = (list) => Array.isArray(list) && list.length === 0;

/** Within a millionth; a missing number (NaN) is never near. */
const near = (value, cited) => Math.abs(value - cited) <= 1e-6;

/** The derived drive is EXACTLY `SS2_GAUGE_DRIVE`, the one this module applies: no other constant, none missing. */
function drivenAsCited(drive) {
  if (!drive || typeof drive !== "object") return false;
  const keys = Object.keys(SS2_GAUGE_DRIVE);
  if (Object.keys(drive).length !== keys.length) return false;
  return keys.every((key) => drive[key] === SS2_GAUGE_DRIVE[key]);
}

/** The derived attach puts the panel where `SS2_COMBAT_PANEL.origin` says. */
function attachedAsCited(attach) {
  if (!near(attach?.origin?.x, SS2_COMBAT_PANEL.origin.x)) return false;
  return near(attach?.origin?.y, SS2_COMBAT_PANEL.origin.y);
}

/** 751's ten placements as `SS2_COMBAT_PANEL` cites them, keyed by kind, side and (for a gauge) reading. */
const CITED_PLACEMENTS = Object.freeze(Object.values(SS2_COMBAT_PANEL.clusters).flatMap((def) => [
  Object.freeze({ kind: "banner", side: def.side, depth: def.banner.depth, character: def.banner.character, matrix: def.banner.matrix }),
  Object.freeze({ kind: "name", side: def.side, depth: def.name.depth, character: def.name.character, matrix: def.name.matrix,
    variable: def.name.variable, align: def.name.align }),
  ...SS2_GAUGES.map((reading) => Object.freeze({ kind: "gauge", side: def.side, reading, depth: def.gauges[reading].depth,
    character: def.gauges[reading].character, matrix: def.gauges[reading].matrix, instance: def.gauges[reading].instance }))
]));

function sameMatrix(got, cited) {
  const matrix = matrixOf(got);
  return Boolean(matrix) && matrix.every((value, index) => near(value, cited[index]));
}

/**
 * The derived placements are EXACTLY the cited ten: this module draws every
 * cluster at `SS2_COMBAT_PANEL`'s matrices, so a build that places them
 * anywhere else is not the one it draws.
 */
function laidOutAsCited(rows) {
  if (!Array.isArray(rows) || rows.length !== CITED_PLACEMENTS.length) return false;
  return CITED_PLACEMENTS.every((want) => {
    const got = rows.find((row) => row?.kind === want.kind && row.side === want.side && row.reading === want.reading);
    if (!got) return false;
    return Object.entries(want).every(([key, value]) => (key === "matrix" ? sameMatrix(got.matrix, value) : got[key] === value));
  });
}

/** A shape the pack holds with at least one path to draw. */
function drawable(shapes, id) {
  const shape = lookup(shapes, id);
  return Array.isArray(shape?.paths) && shape.paths.some((path) => typeof path?.d === "string" && path.d.length > 0);
}

/**
 * Whether one frame-1 placement list is WHOLE: non-empty, every matrix usable,
 * every shape and every cutter a shape the pack can draw, every text a record
 * the pack can place — and, where `liquid` is allowed, the gauge's own
 * `blood_health`, which must carry a cutter and whose own frame is shapes only
 * and whole in turn.
 */
function wholeFrame(placements, { shapes, texts, nested, allowText = false, allowLiquid = false }) {
  if (!Array.isArray(placements) || placements.length === 0) return false;
  for (const placement of placements) {
    if (!matrixOf(placement?.matrix)) return false;
    if (placement.mask && (!matrixOf(placement.mask.matrix) || !drawable(shapes, placement.mask.shape))) return false;
    if (placement.kind === "shape") {
      if (!drawable(shapes, placement.character)) return false;
    } else if (placement.kind === "text" && allowText) {
      const bounds = lookup(texts, placement.character)?.bounds;
      if (!bounds || ![bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax].every(Number.isFinite)) return false;
    } else if (placement.kind === "clip" && allowLiquid && placement.name === SS2_GAUGE_LIQUID) {
      // The liquid is ALWAYS cut: with no cutter it paints outside its vial
      // at every level (Codex review, pass 2: a pack with the mask key gone
      // was still accepted, since only a PRESENT mask was checked).
      if (!placement.mask) return false;
      if (!wholeFrame(frameOne(lookup(nested, placement.character)), { shapes, texts, nested })) return false;
    } else {
      return false;
    }
  }
  return true;
}

/**
 * The `gauges` section of `assets/icons/icons.json` (`tools/extract-icons.mjs`),
 * or null. Total: each of these is no pack, and the caller draws
 * `combatPanelFallbackOpsFor` and can say why —
 *
 * - no section (a clone, or a pack extracted before the section existed);
 * - an extraction that recorded `problems` or `disagreements` (or has no such
 *   list), a `drive` that is not exactly `SS2_GAUGE_DRIVE`, an `attach` whose
 *   origin is not `SS2_COMBAT_PANEL.origin`, or `placements` that are not
 *   exactly `SS2_COMBAT_PANEL`'s ten — this module draws with those tables,
 *   so a build that disagrees with them is not the one it would draw;
 * - art that is not the COMPOSITION `SS2_GAUGE_SPRITES` cites (a shell,
 *   cutter, liquid, number or label missing, extra or pointing elsewhere), a
 *   name record (734, 735) that cannot be placed, or art that is not WHOLE
 *   (`wholeFrame`: a shape or cutter the pack cannot draw, a matrix it cannot
 *   use);
 * - art whose TOP cannot be measured — a path outside the extractor's
 *   absolute M/L/Q/Z — since the layout reads `hudTop` off the drawn art
 *   (`combatPanelLayoutFor`).
 *
 * A pack that drew a liquid with no cutter would spill it over the vial and
 * still be called the build's (Codex review, pass 1); one missing its glass or
 * its name would draw a gauge the build never shows (pass 5).
 */
export function combatPanelPackFrom(data) {
  if (!data || typeof data !== "object") return null;
  const section = data.gauges;
  const shapes = data.shapes;
  if (!section || typeof section !== "object" || !shapes || typeof shapes !== "object") return null;
  const texts = data.texts && typeof data.texts === "object" ? data.texts : {};
  // What the extraction said about itself, and whether it derived what this
  // module applies (Codex review, pass 5: a section recording problems, with
  // no drive, was drawn with the hand-cited drive and coordinates as its own).
  if (!cleanList(section.problems)) return null;
  if (!cleanList(section.disagreements)) return null;
  if (!drivenAsCited(section.drive)) return null;
  if (!attachedAsCited(section.attach)) return null;
  if (!laidOutAsCited(section.placements)) return null;
  for (const [id, cited] of Object.entries(SS2_GAUGE_SPRITES)) {
    if (!composedAsCited(frameOne(lookup(section.clips, id)), cited, { texts, nested: section.nested })) return null;
  }
  const clips = {};
  const nested = {};
  for (const def of Object.values(SS2_COMBAT_PANEL.clusters)) {
    // With no text pack the name is drawn from its record's box; without one the banner would be silently nameless.
    if (!placeableText(lookup(texts, def.name.character), "edit-text")) return null;
    const banner = lookup(section.clips, def.banner.character);
    if (!wholeFrame(frameOne(banner), { shapes, texts, nested: section.nested })) return null;
    clips[def.banner.character] = banner;
    for (const gauge of Object.values(def.gauges)) {
      const entry = lookup(section.clips, gauge.character);
      const placements = frameOne(entry);
      if (!placements) return null;
      const liquids = placements.filter((placement) => placement?.kind === "clip" && placement.name === SS2_GAUGE_LIQUID);
      if (liquids.length !== 1) return null;
      if (!wholeFrame(placements, { shapes, texts, nested: section.nested, allowText: true, allowLiquid: true })) return null;
      clips[gauge.character] = entry;
      nested[liquids[0].character] = lookup(section.nested, liquids[0].character);
    }
  }
  const pack = Object.freeze({
    clips: Object.freeze(clips),
    nested: Object.freeze(nested),
    shapes: Object.freeze(shapes),
    texts: Object.freeze(texts),
    placements: Object.freeze(Array.isArray(section.placements) ? section.placements : []),
    drive: section.drive ?? null
  });
  // The layout's top is MEASURED off this art (`artTopFor`): art whose paths
  // it cannot measure is no pack — never a layout that throws, or a top that
  // is a guess. (A top that is not finite — art that paints nothing — cannot
  // pass the checks above, which require every name, number and label record
  // this draws as a page-font word; it is refused here all the same.)
  for (const def of Object.values(SS2_COMBAT_PANEL.clusters)) {
    try {
      if (!Number.isFinite(artTopFor(pack, def, [1, 0, 0, 1]))) return null;
    } catch (error) {
      if (error instanceof CombatPanelError) return null;
      throw error;
    }
  }
  return pack;
}

/* ------------------------------------------------------------------ */
/* One cluster's ops                                                   */
/* ------------------------------------------------------------------ */

/** D2: a fallen fighter's cluster is drawn at this alpha — the stage name plate's own fade (`namePlateFor`). */
export const FALLEN_ALPHA = 0.4;

/**
 * The acting fighter's mark — AUTHORED (D2): the gold of the target ring
 * (`paintTargetRing` in `tools/arena/main.js` strokes `#f2c14e`) over the name
 * plate's dark outline (`NAME_PLATE_OUTLINE`, `#0b0a0d`), on a faint gold
 * wash, drawn UNDER the cluster and inside its box so `hudTop` holds.
 */
export const ACTING_MARK = Object.freeze({ gold: "#f2c14e", outline: "#0b0a0d", wash: 0.16, inset: 1.5, radius: 6 });

/**
 * The words the build's labels carry and the colours its fields and labels
 * draw in, for the page-font stand-ins only: the extracted text pack's own
 * static runs 732 "HEALTH" (#ffcc00), 741 "ENERGY" (#66ffff), 748 "ARMOUR"
 * (#ffff00), each under its placement's glow (#990000, #000066, #333333);
 * fields 731/740 draw white and 747 yellow, under a black glow.
 */
export const SS2_GAUGE_WORDS = Object.freeze({
  health: Object.freeze({ label: "HEALTH", fill: "#ffcc00", outline: "#990000", number: "#ffffff" }),
  energy: Object.freeze({ label: "ENERGY", fill: "#66ffff", outline: "#000066", number: "#ffffff" }),
  armour: Object.freeze({ label: "ARMOUR", fill: "#ffff00", outline: "#333333", number: "#ffff00" })
});

const BLACK = "#000000";

function hexOf(colour) {
  if (!colour || ![colour.red, colour.green, colour.blue].every(Number.isFinite)) return null;
  return `#${[colour.red, colour.green, colour.blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

/** A glow's colour, as the page-font stand-in's outline. */
function glowColourOf(filters) {
  const found = Array.isArray(filters) ? filters.find((filter) => filter?.type === "glow") : null;
  return found ? hexOf(found.colour) : null;
}

/** A cluster's panel-px-to-stage-px matrix, with its translation in TWIPS. */
function clusterTwips(cluster) {
  const m = matrixOf(cluster?.matrix);
  if (!m) throw new CombatPanelError("A cluster needs its layout matrix (combatPanelLayoutFor).");
  return [m[0], m[1], m[2], m[3], m[4] * 20, m[5] * 20];
}

/** A `text` op in the page's font, in stage px — the popups' fallback shape, plus `align`. */
function wordOp({ text, x, y, size, fill, outline, alpha, align = "center", panel, role }) {
  return Object.freeze({ kind: "text", text: String(text), x, y, size, fill, outline, alpha, align, panel, role });
}

/** A box's anchor point on the stage: its centre, or an inner edge for an aligned field. */
function boxPoint(matrix, bounds, align = "center", gutter = 0) {
  const x = align === "left" ? bounds.xMin + gutter : align === "right" ? bounds.xMax - gutter : (bounds.xMin + bounds.xMax) / 2;
  const y = (bounds.yMin + bounds.yMax) / 2;
  return { x: matrix[0] * x + matrix[2] * y + matrix[4] / 20, y: matrix[1] * x + matrix[3] * y + matrix[5] / 20 };
}

function emptyCounts() {
  return {
    // What the build's art could not carry, by name.
    bevelsDrawnPlain: 0,
    wordsInPageFont: 0,
    glowsUnderFade: 0,
    shapesMissing: 0,
    cuttersMissing: 0,
    unsupported: 0,
    gaugesHidden: 0,
    drivesAuthored: 0
  };
}

/**
 * The one walk behind `combatPanelOpsFor` and `combatPanelInvoiceFor`.
 */
function drawCluster(pack, textPack, cluster, reading, options) {
  const def = SS2_COMBAT_PANEL.clusters[cluster?.side];
  if (!def) throw new CombatPanelError(`No cluster side "${cluster?.side}".`);
  assertLaidOutFor(pack, cluster, def);
  const drawn = drawPackArt(pack, textPack, def, clusterTwips(cluster), reading, options);
  // The acting mark goes UNDER the cluster, so first.
  if (reading?.acting) drawn.ops.unshift(...actingMarkOps(cluster, def));
  return drawn;
}

/** One side's art from the pack, under `outer` (translations in twips): everything but the acting mark. */
function drawPackArt(pack, textPack, def, outer, reading, options) {
  const scale = Math.abs(outer[0]) || 1;
  const stageScale = Number.isFinite(options?.stageScale) && options.stageScale > 0 ? options.stageScale : 1;
  const glowScale = stageScale * scale;
  const alpha = reading?.alive === false ? FALLEN_ALPHA : 1;
  const fade = alpha < 1 ? Object.freeze([1, 1, 1, alpha, 0, 0, 0, 0]) : null;
  const counts = emptyCounts();
  const ops = [];
  let run = [];
  let runPanel = null;

  // Shapes go through the props painter a RUN at a time (as action-buttons.js
  // does), so its clip resolution, gradients and colour transforms are the
  // ones every other layer gets — and a text placement keeps its place in
  // the paint order between runs.
  const flush = () => {
    if (run.length === 0) return;
    const drawn = propOpsFor({ props: { panel: { frames: [run], effectGroups: [] } }, shapes: pack.shapes }, { linkage: "panel", frame: 1 });
    for (const op of drawn ?? []) ops.push(Object.freeze({ ...op, panel: runPanel }));
    run = [];
  };
  const shape = (panel, character, matrix, colour, clip = null) => {
    if (!lookup(pack.shapes, character)) { counts.shapesMissing += 1; return; }
    if (clip && !lookup(pack.shapes, clip.shape)) counts.cuttersMissing += 1;
    if (runPanel !== panel) flush();
    runPanel = panel;
    run.push({ shape: character, matrix, colour: concatColourTransforms(fade, colourTransformFrom(colour ?? null)), ...(clip ? { clip } : {}) });
  };
  const glyphs = (list, panel, role, group, placementAlpha) => {
    flush();
    for (const op of list) {
      ops.push(Object.freeze({
        ...op,
        fillOpacity: (Number.isFinite(op.fillOpacity) ? op.fillOpacity : 1) * placementAlpha,
        strokeOpacity: (Number.isFinite(op.strokeOpacity) ? op.strokeOpacity : 1) * placementAlpha,
        ...(group ? { group } : {}),
        panel, role
      }));
    }
  };
  const word = (fields) => {
    flush();
    counts.wordsInPageFont += 1;
    ops.push(wordOp(fields));
  };

  /** One text placement: the build's glyphs when the text pack has them, else the page font at the build's box. */
  const text = (panel, role, placement, matrix, { value = undefined, colour = undefined, align = "center", words }) => {
    const character = placement.character;
    const placementAlpha = alpha * applyColourTransformAlpha(1, colourTransformFrom(placement.colour ?? null));
    const group = glowGroupFor(placement.filters, glowScale);
    if (group && placementAlpha < 1) counts.glowsUnderFade += 1;
    // Glyphs, when the text pack can draw them — and a run that is nothing
    // but `.notdef` boxes is not a drawing (`fontFor` in `text.js` says why).
    const inked = (drawn) => Array.isArray(drawn) && drawn.some((op) => !op.notdef);
    if (lookup(textPack?.fields, character)) {
      if (value === null || value === undefined || value === "") return;
      const drawn = fieldOpsFor(textPack, character, { text: value, matrix, ...(colour ? { colour } : {}) });
      if (inked(drawn)) { glyphs(drawn, panel, role, group, placementAlpha); return; }
    } else {
      const run = lookup(textPack?.statics, character);
      if (run) {
        const drawn = staticTextOpsFor(textPack, character, { matrix: compose(matrix, matrixOf(run.matrix) ?? IDENTITY) });
        if (inked(drawn)) { glyphs(drawn, panel, role, group, placementAlpha); return; }
      }
    }
    // No glyphs for it — no text pack, or one that cannot draw this word (a
    // font it lacks): the page font, at the build's own box, never nothing.
    const shown = value !== undefined ? value : words?.label;
    if (shown === null || shown === undefined || shown === "") return;
    const record = lookup(pack.texts, character);
    const bounds = record?.bounds && [record.bounds.xMin, record.bounds.xMax, record.bounds.yMin, record.bounds.yMax].every(Number.isFinite)
      ? record.bounds : null;
    if (!bounds) return;
    const at = boxPoint(matrix, bounds, align, align === "center" ? 0 : FIELD_GUTTER_PX);
    const size = (Number.isFinite(record.fontHeight) ? record.fontHeight : 14) * Math.abs(matrix[0]);
    word({
      text: shown, x: at.x, y: at.y, size,
      fill: colour ?? hexOf(record.colour) ?? (role === "label" ? words?.fill : words?.number) ?? "#ffffff",
      outline: glowColourOf(placement.filters) ?? (role === "label" ? words?.outline : BLACK) ?? BLACK,
      alpha: placementAlpha, align, panel, role
    });
  };

  const placementFor = (kind) => pack.placements.find((placement) => placement?.kind === kind && placement.side === def.side) ?? null;

  const parts = [
    { depth: def.banner.depth, draw: () => {
      const matrix = compose(outer, def.banner.matrix);
      const banner = placementFor("banner");
      // THE BANNER'S INNER BEVEL IS DRAWN PLAIN, AND COUNTED: `canvasFilterFor`
      // refuses it, and a hand-drawn hard-edged bevel would rest on which way
      // round the player puts highlight and shadow at distance -6, which
      // nothing here has measured.
      if (Array.isArray(banner?.filters) && banner.filters.some((filter) => filter?.type === "bevel")) counts.bevelsDrawnPlain += 1;
      for (const placement of frameOne(lookup(pack.clips, def.banner.character)) ?? []) {
        const local = matrixOf(placement?.matrix);
        if (!local || placement.kind !== "shape") { counts.unsupported += 1; continue; }
        shape("banner", placement.character, compose(matrix, local), placement.colour);
      }
    } },
    { depth: def.name.depth, draw: () => {
      const named = placementFor("name");
      text("name", "name", { character: def.name.character, filters: named?.filters ?? null }, compose(outer, def.name.matrix), {
        value: typeof reading?.name === "string" ? reading.name : "", colour: reading?.colour ?? undefined, align: def.name.align
      });
    } },
    ...SS2_GAUGES.map((gauge) => ({ depth: def.gauges[gauge].depth, draw: () => drawGauge(gauge) }))
  ].sort((left, right) => left.depth - right.depth);

  function drawGauge(gauge) {
    const at = def.gauges[gauge];
    const readingOf = reading?.[gauge];
    // The build hides the armour gauge unless armourclass > 0; `teamHudFor`
    // says so as `shown: false`, which is also what a reading the wire does
    // not carry says. Either way nothing of the gauge is drawn.
    if (readingOf?.shown === false) { counts.gaugesHidden += 1; return; }
    const drive = gaugeDriveFor(readingOf?.value, readingOf?.max);
    if (drive.authored) counts.drivesAuthored += 1;
    const matrix = compose(outer, at.matrix);
    const words = SS2_GAUGE_WORDS[gauge];
    for (const placement of frameOne(lookup(pack.clips, at.character)) ?? []) {
      const local = matrixOf(placement?.matrix);
      if (!local) { counts.unsupported += 1; continue; }
      const cutter = placement.mask && matrixOf(placement.mask.matrix)
        ? { shape: placement.mask.shape, matrix: compose(matrix, matrixOf(placement.mask.matrix)) }
        : null;
      if (placement.kind === "shape") {
        shape(gauge, placement.character, compose(matrix, local), placement.colour, cutter);
      } else if (placement.kind === "clip" && placement.name === SS2_GAUGE_LIQUID) {
        // THE DRIVE: `blood_health._y` is the build's integer, in the gauge's
        // own pixels; its `_x` is never written, so the rest x stays. The
        // cutter is composed in the GAUGE's space, so it does not move.
        const moved = [local[0], local[1], local[2], local[3], local[4], drive.y * 20];
        const liquid = compose(matrix, moved);
        const colour = colourTransformFrom(placement.colour ?? null);
        for (const child of frameOne(lookup(pack.nested, placement.character)) ?? []) {
          const childMatrix = matrixOf(child?.matrix);
          if (!childMatrix || child.kind !== "shape") { counts.unsupported += 1; continue; }
          shape(gauge, child.character, compose(liquid, childMatrix),
            concatColourTransforms(colour, colourTransformFrom(child.colour ?? null)), cutter);
        }
      } else if (placement.kind === "text") {
        const isLabel = Boolean(lookup(textPack?.statics, placement.character)) ||
          lookup(pack.texts, placement.character)?.kind === "static-text";
        text(gauge, isLabel ? "label" : "number", placement, compose(matrix, local), {
          value: isLabel ? undefined : drive.text, words
        });
      } else {
        counts.unsupported += 1;
      }
    }
  }

  for (const part of parts) part.draw();
  flush();
  return { ops, counts };
}

/** A rounded rectangle as M/L/Q path data, in panel px. */
function roundedRect(xMin, yMin, xMax, yMax, radius) {
  const r = Math.max(0, Math.min(radius, (xMax - xMin) / 2, (yMax - yMin) / 2));
  const n = (value) => Number(value.toFixed(3));
  return `M${n(xMin + r)} ${n(yMin)}L${n(xMax - r)} ${n(yMin)}Q${n(xMax)} ${n(yMin)} ${n(xMax)} ${n(yMin + r)}` +
    `L${n(xMax)} ${n(yMax - r)}Q${n(xMax)} ${n(yMax)} ${n(xMax - r)} ${n(yMax)}` +
    `L${n(xMin + r)} ${n(yMax)}Q${n(xMin)} ${n(yMax)} ${n(xMin)} ${n(yMax - r)}` +
    `L${n(xMin)} ${n(yMin + r)}Q${n(xMin)} ${n(yMin)} ${n(xMin + r)} ${n(yMin)}Z`;
}

/** An authored path op, in panel px under the cluster's matrix (translations in twips). */
function authoredOp(d, matrix, fields) {
  return Object.freeze({
    kind: "path", d, matrix: Object.freeze(matrix.slice()),
    fill: fields.fill ?? "none", fillRule: fields.fillRule ?? "nonzero", fillOpacity: fields.fillOpacity ?? 1,
    stroke: fields.stroke ?? null, strokeWidth: fields.strokeWidth ?? 0, strokeOpacity: fields.strokeOpacity ?? 1,
    ...(fields.clip ? { clip: fields.clip } : {}),
    authored: true, panel: fields.panel, ...(fields.role ? { role: fields.role } : {})
  });
}

/**
 * THE ACTING MARK (authored): a gold-edged wash behind the whole cluster,
 * inside its box — whose top is the highest ink of the art the layout
 * measured, so the mark's 3 px edge, inset by its own half-width, reaches
 * exactly that top and never above it: `hudTop` is the same whoever acts.
 */
function actingMarkOps(cluster, def) {
  const { box } = def;
  const outer = clusterTwips(cluster);
  const inset = ACTING_MARK.inset;
  // The box's top, back in panel px: the layout's stage top under the cluster's own matrix.
  const top = (cluster.box.yMin - cluster.matrix[5]) / cluster.matrix[3];
  const d = roundedRect(box.xMin + inset, top + inset, box.xMax - inset, box.yMax - inset, ACTING_MARK.radius);
  return [
    authoredOp(d, outer, { fill: ACTING_MARK.gold, fillOpacity: ACTING_MARK.wash, stroke: ACTING_MARK.outline, strokeWidth: 3, panel: "acting" }),
    authoredOp(d, outer, { stroke: ACTING_MARK.gold, strokeWidth: 1.5, panel: "acting" })
  ];
}

/**
 * ONE FIGHTER'S CLUSTER, FROM THE PLAYER'S OWN PACK — see the header for the
 * op contract and the paint call. Null when `pack` is not a pack
 * (`combatPanelPackFrom` said null): draw `combatPanelFallbackOpsFor`.
 *
 * @param {object|null} pack      from `combatPanelPackFrom`
 * @param {object|null} textPack  from `textPackFrom`; without it every word is the page font's
 * @param {object} cluster        one of `combatPanelLayoutFor(...).clusters`
 * @param {object} reading        that fighter's `teamHudFor` row
 * @param {object} [options]
 * @param {number} [options.stageScale=1]  device pixels per STAGE pixel (the stage fit's scale), so the glows are built at the width they are drawn
 */
export function combatPanelOpsFor(pack, textPack, cluster, reading, options = {}) {
  if (!isPack(pack)) return null;
  return Object.freeze(drawCluster(pack, textPack, cluster, reading, options).ops);
}

/**
 * WHAT ONE CLUSTER'S DRAWING COULD NOT CARRY, counted by name — the same walk
 * as `combatPanelOpsFor`. Null where it is.
 *
 * - `bevelsDrawnPlain`: the banner's inner bevel, refused by `canvasFilterFor` and drawn without.
 * - `wordsInPageFont`: words and numbers with no text pack to draw them in the build's glyphs.
 * - `glowsUnderFade`: glows built from faded glyphs (a fallen cluster): a strength-10 glow of a
 *   0.4-alpha glyph still saturates, so the glow fades less than the fill.
 * - `shapesMissing`, `cuttersMissing`, `unsupported`: art the pack does not hold, or a placement kind this cannot draw.
 * - `gaugesHidden`: gauges not drawn (`shown: false`). `drivesAuthored`: gauges drawn from an authored drive (a max of 0, no reading).
 */
export function combatPanelInvoiceFor(pack, textPack, cluster, reading, options = {}) {
  if (!isPack(pack)) return null;
  return Object.freeze(drawCluster(pack, textPack, cluster, reading, options).counts);
}

/* ------------------------------------------------------------------ */
/* The authored fallback                                               */
/* ------------------------------------------------------------------ */

/**
 * WHERE THE FALLBACK PUTS ITS WORDS — the build's own boxes, as numbers, so a
 * clone with no pack draws where the build does. Each is a field's or static
 * run's bounds (px, `DefineEditText`/`DefineText`) under its placement inside
 * the gauge sprite (twips): 731 at (-776, -55) in 733, 740 at (-776, -75) in
 * 742, 747 at (-786, -300) in 749, all three boxed -2..79.6 x -2..21.15; the
 * labels 732 at (-781, 510), 741 at (-789, 516), 748 at (-781, 520). The name
 * fields 734/735 are boxed 66.9..347.35 x -2..18.8 at the `name` placements
 * in `SS2_COMBAT_PANEL`. The real-pack test checks every one against the pack.
 *
 * The LIQUID is a plain rectangle over the build's own liquid extents (shapes
 * 728/737: -0.2..48.4 x -9.45..57.25; 744 down to 62.15), with its surface
 * band (-9.45..-1.95) lighter, at the build's rest x (-484 twips in 733/742,
 * -494 in 749). The VIAL and the SHIELD are drawn here, by hand — never a
 * path from the pack: that would ship the build's art in source.
 */
export const SS2_FALLBACK_ART = Object.freeze({
  numberBox: Object.freeze({ xMin: -2, xMax: 79.6, yMin: -2, yMax: 21.15 }),
  nameBox: Object.freeze({ xMin: 66.9, xMax: 347.35, yMin: -2, yMax: 18.8 }),
  numberSize: 14,
  labelSize: 10,
  nameSize: 14,
  gauges: Object.freeze({
    health: Object.freeze({
      number: Object.freeze([1, 0, 0, 1, -776, -55]),
      label: Object.freeze({ matrix: Object.freeze([1, 0, 0, 1, -781, 510]), bounds: Object.freeze({ xMin: 17.7, xMax: 66.4, yMin: 0.45, yMax: 12.4 }) }),
      liquid: Object.freeze({ restX: -484, xMin: -0.2, xMax: 48.4, yMin: -9.45, yMax: 57.25, surface: -1.95, fill: "#b3171b", top: "#e0474c" }),
      vessel: "vial"
    }),
    energy: Object.freeze({
      number: Object.freeze([1, 0, 0, 1, -776, -75]),
      label: Object.freeze({ matrix: Object.freeze([1, 0, 0, 1, -789, 516]), bounds: Object.freeze({ xMin: 18.35, xMax: 65.75, yMin: 0.5, yMax: 12.4 }) }),
      liquid: Object.freeze({ restX: -484, xMin: -0.2, xMax: 48.4, yMin: -9.45, yMax: 57.25, surface: -1.95, fill: "#1f3fbf", top: "#5a78f0" }),
      vessel: "vial"
    }),
    armour: Object.freeze({
      number: Object.freeze([1, 0, 0, 1, -786, -300]),
      label: Object.freeze({ matrix: Object.freeze([1, 0, 0, 1, -781, 520]), bounds: Object.freeze({ xMin: 15.6, xMax: 68.55, yMin: 0.45, yMax: 12.4 }) }),
      liquid: Object.freeze({ restX: -494, xMin: -0.2, xMax: 48.4, yMin: -9.45, yMax: 62.15, surface: -1.95, fill: "#8c8c8c", top: "#c8c8c8" }),
      vessel: "shield"
    })
  })
});

/**
 * The authored vessels, in the gauge sprite's own px. The vial sits inside the
 * build's cutter's extent (727/736: -23.4..23.45 x -32.3..29.6), the shield
 * inside 743's (-23.55..21.75 x -25..19) — drawn by hand, a flask and a
 * heater shield, never traced.
 */
const VESSELS = Object.freeze({
  vial: "M-7 -31L7 -31L7 -19Q21 -14 21 4Q21 27 0 27Q-21 27 -21 4Q-21 -14 -7 -19Z",
  shield: "M-21 -23L20 -23L20 -2Q20 12 -0.5 18.5Q-21 12 -21 -2Z"
});

/** The authored banner's look: the action buttons' bronze (`FALLBACK_LOOK`), on a dark gold band. */
const FALLBACK_BANNER = Object.freeze({ fill: "#5a3c10", rim: "#c08a3e", inset: 2, top: 77, bottom: 111, radius: 8 });

/**
 * THE AUTHORED CLUSTER for a clone, or a pack without the `gauges` section: the
 * same layout, the same drive, the same words, in the page font and in shapes
 * drawn here — a band for the banner, a flask for each vial, a shield for the
 * armour, the liquid a rectangle under a cutter that is the vessel itself. Op
 * shape and space are `combatPanelOpsFor`'s; every path op carries
 * `authored: true`.
 *
 * @param {object} cluster   one of `combatPanelLayoutFor(...).clusters`
 * @param {object} reading   that fighter's `teamHudFor` row
 * @param {object} [options] `combatPanelOpsFor`'s, accepted so the two calls
 *   read alike; the fallback carries no filter, so nothing in it scales
 */
export function combatPanelFallbackOpsFor(cluster, reading, options = {}) {
  const def = SS2_COMBAT_PANEL.clusters[cluster?.side];
  if (!def) throw new CombatPanelError(`No cluster side "${cluster?.side}".`);
  assertLaidOutFor(null, cluster, def);
  const outer = clusterTwips(cluster);
  const ops = reading?.acting ? [...actingMarkOps(cluster, def)] : [];
  ops.push(...fallbackArtOps(def, outer, reading));
  return Object.freeze(ops);
}

/** The authored cluster's own art, under `outer` (translations in twips): everything but the acting mark. */
function fallbackArtOps(def, outer, reading) {
  const scale = Math.abs(outer[0]) || 1;
  const alpha = reading?.alive === false ? FALLEN_ALPHA : 1;
  const art = SS2_FALLBACK_ART;
  const parts = [];

  parts.push({ depth: def.banner.depth, ops: () => {
    const { box } = def;
    const d = roundedRect(box.xMin + FALLBACK_BANNER.inset, FALLBACK_BANNER.top, box.xMax - FALLBACK_BANNER.inset, FALLBACK_BANNER.bottom, FALLBACK_BANNER.radius);
    return [authoredOp(d, outer, {
      fill: FALLBACK_BANNER.fill, fillOpacity: 0.92 * alpha, stroke: FALLBACK_BANNER.rim, strokeWidth: 2, strokeOpacity: alpha, panel: "banner", role: "band"
    })];
  } });

  parts.push({ depth: def.name.depth, ops: () => {
    const matrix = compose(outer, def.name.matrix);
    const at = boxPoint(matrix, art.nameBox, def.name.align, FIELD_GUTTER_PX);
    const name = typeof reading?.name === "string" ? reading.name : "";
    if (name.length === 0) return [];
    return [wordOp({
      text: name, x: at.x, y: at.y, size: art.nameSize * scale, fill: reading?.colour ?? "#ffffff", outline: BLACK,
      alpha, align: def.name.align, panel: "name", role: "name"
    })];
  } });

  for (const gauge of SS2_GAUGES) {
    parts.push({ depth: def.gauges[gauge].depth, ops: () => {
      const readingOf = reading?.[gauge];
      if (readingOf?.shown === false) return [];
      const drive = gaugeDriveFor(readingOf?.value, readingOf?.max);
      const look = art.gauges[gauge];
      const words = SS2_GAUGE_WORDS[gauge];
      const matrix = compose(outer, def.gauges[gauge].matrix);
      const vessel = VESSELS[look.vessel];
      const cutter = Object.freeze({ matrix: Object.freeze(matrix.slice()), d: vessel });
      const liquid = compose(matrix, [1, 0, 0, 1, look.liquid.restX, drive.y * 20]);
      const { xMin, xMax, yMin, yMax, surface } = look.liquid;
      const ops = [
        // The glass behind the liquid, faint.
        authoredOp(vessel, matrix, { fill: "#ffffff", fillOpacity: 0.12 * alpha, strokeOpacity: alpha, panel: gauge, role: "glass" }),
        authoredOp(roundedRect(xMin, yMin, xMax, yMax, 0), liquid, { fill: look.liquid.fill, fillOpacity: alpha, strokeOpacity: alpha, clip: cutter, panel: gauge, role: "liquid" }),
        authoredOp(roundedRect(xMin, yMin, xMax, surface, 0), liquid, { fill: look.liquid.top, fillOpacity: alpha, strokeOpacity: alpha, clip: cutter, panel: gauge, role: "liquid" }),
        // The rim over it: a dark outline under a light one, so it reads on sand and on stands.
        authoredOp(vessel, matrix, { stroke: "#0b0a0d", strokeWidth: 3, fillOpacity: alpha, strokeOpacity: alpha, panel: gauge, role: "rim" }),
        authoredOp(vessel, matrix, {
          stroke: look.vessel === "shield" ? "#c08a3e" : "#f3e6c8", strokeWidth: 1.5, fillOpacity: alpha, strokeOpacity: 0.9 * alpha, panel: gauge, role: "rim"
        })
      ];
      if (drive.text !== null) {
        const at = boxPoint(compose(matrix, look.number), art.numberBox);
        ops.push(wordOp({ text: drive.text, x: at.x, y: at.y, size: art.numberSize * scale, fill: words.number, outline: BLACK, alpha, panel: gauge, role: "number" }));
      }
      const label = boxPoint(compose(matrix, look.label.matrix), look.label.bounds);
      ops.push(wordOp({ text: words.label, x: label.x, y: label.y, size: art.labelSize * scale, fill: words.fill, outline: words.outline, alpha, panel: gauge, role: "label" }));
      return ops;
    } });
  }

  const ops = [];
  for (const part of parts.sort((left, right) => left.depth - right.depth)) ops.push(...part.ops());
  return ops;
}
