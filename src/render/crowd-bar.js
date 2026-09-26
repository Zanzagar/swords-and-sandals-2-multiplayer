/**
 * THE BUILD'S OWN CROWD BAR, IN THE FRAME — `combat_panel`'s `crowd_bar`
 * (sprite 725) over its background `crowd_bar_bg` (723) and under its label
 * `crowd_text` (field 750), at the build's own place at the stage's top right,
 * scale 1 in every bout, driven exactly as the build drives it, from the
 * player's own extracted art (`assets/icons/icons.json`'s `crowd` section,
 * `tools/extract-icons.mjs`) or, without it, an authored stand-in with the same
 * place and drive.
 *
 * Decision D8 of the in-frame HUD (the owner, 2026-09-25: "use actual in game
 * crowd bar asset?"; `docs/design/battle-ui.md#decided-inframe-hud-2026-09-24`).
 *
 * ## The interface
 *
 * ```text
 *   crowdBarPackFrom(iconsJson)                                -> pack | null   (null: draw the fallback)
 *   crowdBarOpsFor(pack, textPack, reading, { stageScale })    -> ops | null
 *   crowdBarFallbackOpsFor(reading)                            -> ops
 *   crowdBarInvoiceFor(pack, textPack, reading)                -> counts | null
 *   crowdBarDriveFor(crowd)                                    -> { xscale, index, mood, text, authored }
 * ```
 *
 * `reading` is `{ value, shown }`: the battle's `crowd_interest` and whether
 * the crowd is heard (`crowdHeardFor`) — the shape `crowdMeterFor` returns in
 * `tools/arena/team-hud.js`. This module takes `value` and `shown` and derives
 * everything else itself, from the build's own arithmetic.
 *
 * ## The ops
 *
 * The contract of `src/render/combat-panel.js`, in STAGE pixels: path ops with
 * `d` in the path's own pixels and `matrix` translations in TWIPS; page-font
 * words with `text, x, y, size, fill, outline, alpha, align`; the label's
 * glyphs, when the text pack draws them, under their glow `group`. Every op
 * carries `panel: "crowd"` and a `role` ("background" | "bar" | "label");
 * authored paths carry `authored: true`. Paint them with the gauges, in the
 * same layer and the same way (`paintCombatHud` in `tools/arena/main.js`).
 *
 * ## What is not the build's, named
 *
 * - ABOVE 100 the bar is drawn full and the mood is the top one; BELOW 0 the
 *   bar is drawn empty (`crowdBarDriveFor` says which part is authored).
 * - No crowd at all (a rule set without one) is nothing drawn.
 * - The fallback is drawn here by hand — a track, a fill, the page font —
 *   and carries no path from the pack.
 *
 * Pure: no canvas, no clock, no battle. Nothing here touches combat state.
 */

import { SS2_COMBAT_PANEL } from "./combat-panel.js";
import { colourTransformFrom } from "./filters.js";
import { IDENTITY, compose, glowGroupFor, matrixOf } from "./pack-ops.js";
import { propOpsFor } from "./props.js";
import { fieldOpsFor } from "./text.js";

/**
 * THE BUILD'S MOODS, index 0 the empty string — `crowd_interest_array`, built
 * by `crowd_bar`'s load handler (`sprite:751` clip-action 0, body 0x225e5d,
 * `+0x01c7`..`+0x01ea`: eleven operands and `new Array`, pushed last-first, so
 * the "" pushed last is index 0). "Tranfixed" is the build's spelling.
 * `tools/extract-icons.mjs` re-derives them from the bytes into the pack's
 * `crowd.drive.moods`, and `crowdBarPackFrom` refuses a pack whose moods are
 * not exactly these — two independent paths to one answer.
 */
export const SS2_CROWD_MOODS = Object.freeze([
  "", "bored to tears", "bored silly", "restless", "indifferent", "interested",
  "entertained", "enthusiastic", "wildly entertained", "Tranfixed", "Fanatical"
]);

/**
 * THE DRIVE, hand-cited from `crowd_bar`'s enterFrame handler (clip-action 1,
 * body 0x226086), which runs every frame under `if (hero.herolevel > 1)`
 * (`+0x00f2`):
 *
 * ```text
 *   +0x0232  _parent.crowd_text = "crowd: " + crowd_interest_array[Math.ceil(_global.crowd_interest / 10)]
 *   +0x0258  this._xscale       = Math.round(_global.crowd_interest)
 * ```
 *
 * and from its load handler (clip-action 0, body 0x225e5d), which hides all
 * three parts when that test fails: `this._visible = false` (`+0x01fd`),
 * `_parent.crowd_text = ""` (`+0x020b`), `_parent.crowd_bar_bg._visible =
 * false` (`+0x021f`). `crowdBarPackFrom` refuses a pack whose derived drive is
 * not exactly this.
 */
export const SS2_CROWD_BAR_DRIVE = Object.freeze({
  source: "_global.crowd_interest",
  /** The load handler's test (`+0x017b`) and the enterFrame guard (`+0x00f2`): the arena answers it with `crowdHeardFor`. */
  shownWhile: Object.freeze({ side: "hero", field: "herolevel", comparison: ">", than: 1 }),
  scale: Object.freeze({ target: "this", property: "_xscale", rounding: "round" }),
  label: Object.freeze({ target: "_parent", variable: "crowd_text", prefix: "crowd: ", array: "crowd_interest_array", rounding: "ceil", divisor: 10 }),
  hides: Object.freeze(["this._visible = false", "_parent.crowd_text = \"\"", "_parent.crowd_bar_bg._visible = false"])
});

/** -0 is 0 on the screen and in a comparison: `Math.round(-0.4)` and `Math.ceil(-0.04)` both give it. */
const unsigned = (value) => (Object.is(value, -0) ? 0 : value);

/**
 * THE CROWD BAR'S DRIVE, exactly as the build computes it: the bar's
 * `_xscale` (a percent of its own width, about its own left edge), the mood's
 * index, the mood and the label.
 *
 * - ABOVE 100 (an opening: every fighter's level summed, unclamped until the
 *   first phase) the build's `_xscale` would overrun the bar's background and
 *   its index would run past the eleven moods (AVM1 reads undefined there):
 *   the bar is drawn FULL and the mood is the TOP one, as the side panel's
 *   meter already does (`crowdMeterFor`). Authored, and `authored` says which.
 * - BELOW 0 the build's `_xscale` would be negative — the bar mirrored
 *   leftwards about its left edge — and below -10 the index too: the bar is
 *   drawn EMPTY and the mood is index 0's, the empty one. Authored. (The
 *   engine's phases clamp the crowd to 1..100, so neither is reached after the
 *   first phase.)
 * - NO CROWD (not a finite number): nothing is drawn.
 *
 * @param {number} crowd  the battle's `crowd_interest`
 * @returns {{xscale: number|null, index: number|null, mood: string|null, text: string|null, authored: string|null}}
 */
export function crowdBarDriveFor(crowd) {
  if (typeof crowd !== "number" || !Number.isFinite(crowd)) {
    return Object.freeze({ xscale: null, index: null, mood: null, text: null, authored: "no crowd: nothing is drawn" });
  }
  const top = SS2_CROWD_MOODS.length - 1;
  const { label } = SS2_CROWD_BAR_DRIVE;
  const built = unsigned(Math.round(crowd));
  const at = unsigned(Math.ceil(crowd / label.divisor));
  const authored = [];
  let xscale = built;
  if (built > 100) {
    xscale = 100;
    authored.push("above 100 the bar is drawn full (the build's would overrun its background)");
  } else if (built < 0) {
    xscale = 0;
    authored.push("below 0 the bar is drawn empty (the build's would be mirrored leftwards)");
  }
  let index = at;
  if (at > top) {
    index = top;
    authored.push(`above 100 the mood is the top one (the build's index ${at} is past its ${SS2_CROWD_MOODS.length} moods)`);
  } else if (at < 0) {
    index = 0;
    authored.push(`below 0 the mood is index 0's (the build's index ${at} is outside its moods)`);
  }
  const mood = SS2_CROWD_MOODS[index];
  return Object.freeze({ xscale, index, mood, text: `${label.prefix}${mood}`, authored: authored.length > 0 ? authored.join("; ") : null });
}

/* ------------------------------------------------------------------ */
/* Where the build puts it                                             */
/* ------------------------------------------------------------------ */

/**
 * THE BUILD'S CROWD BAR, hand-cited, in panel px with matrix translations in
 * TWIPS — `resolveTimeline` on 751 frame 1 (re-derived read-only 2026-09-25,
 * sha256 77cb545c…):
 *
 * ```text
 *   d3   723 `crowd_bar_bg` at (9661, -5144)  = (483.05, -257.20)   723 = d1 shape 722 at identity
 *   d5   725 `crowd_bar`    at (9657, -5132)  = (482.85, -256.60)   725 = d1 shape 724 at identity
 *   d63  750 (DefineEditText `crowd_text`, font 118, 12 px, white, centred) at (9669, -5175), under a black glow
 * ```
 *
 * The panel's own place (`origin`, stage (-0.05, 288.75)) is the gauges'
 * (`SS2_COMBAT_PANEL`): one `attachMovie` places the whole of 751. So on the
 * stage the background spans x 482.0..640.5, y 30.55..44.05 (shape 722's
 * bounds -1..157.5 x -1..12.5, its 2 px stroke included), the bar x
 * 482.8..637.8, y 32.15..42.15 at full, and the label's box x 481.4..636.85,
 * y 28.0..51.15. **`_xscale` scales the bar about its own registration point**
 * — its placement's translation — and shape 724 starts at x 0 there, so the
 * bar's LEFT EDGE stays at stage x 482.8 whatever the crowd.
 * `tools/extract-icons.mjs` re-derives every placement into the pack's
 * `crowd.placements`, and `crowdBarPackFrom` refuses a pack whose placements
 * or origin are not exactly these.
 */
export const SS2_CROWD_BAR = Object.freeze({
  character: 751,
  linkage: "combat_panel",
  origin: SS2_COMBAT_PANEL.origin,
  background: Object.freeze({ kind: "background", depth: 3, character: 723, instance: "crowd_bar_bg", shape: 722,
    matrix: Object.freeze([1, 0, 0, 1, 9661, -5144]) }),
  bar: Object.freeze({ kind: "bar", depth: 5, character: 725, instance: "crowd_bar", shape: 724, matrix: Object.freeze([1, 0, 0, 1, 9657, -5132]) }),
  label: Object.freeze({ kind: "label", depth: 63, character: 750, variable: "crowd_text", align: "center",
    matrix: Object.freeze([1, 0, 0, 1, 9669, -5175]) })
});

/* ------------------------------------------------------------------ */
/* The pack                                                            */
/* ------------------------------------------------------------------ */

const lookup = (table, id) => (table && typeof table === "object" ? (table[id] ?? table[String(id)] ?? null) : null);
const frameOne = (entry) => (Array.isArray(entry?.frames) && Array.isArray(entry.frames[0]) ? entry.frames[0] : null);
/** Within a millionth; a missing number (NaN) is never near. */
const near = (value, cited) => Math.abs(value - cited) <= 1e-6;
const sameMatrix = (got, cited) => {
  const matrix = matrixOf(got);
  return Boolean(matrix) && matrix.every((value, index) => near(value, cited[index]));
};
/** Two JSON-shaped values, the same. */
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/** A shape the pack holds with at least one path to draw. */
function drawable(shapes, id) {
  const shape = lookup(shapes, id);
  return Array.isArray(shape?.paths) && shape.paths.some((path) => typeof path?.d === "string" && path.d.length > 0);
}

/** The derived drive is the one this module applies: the source, the level test, what is hidden, the scale, the label, the moods. */
function drivenAsCited(drive) {
  if (!drive || typeof drive !== "object") return false;
  const applied = ["source", "shownWhile", "hides", "scale", "label"];
  return applied.every((key) => same(drive[key], SS2_CROWD_BAR_DRIVE[key])) && same(drive.moods, SS2_CROWD_MOODS);
}

/** The derived placements are EXACTLY the cited three: this module draws at `SS2_CROWD_BAR`'s matrices. */
function laidOutAsCited(rows) {
  const cited = [SS2_CROWD_BAR.background, SS2_CROWD_BAR.bar, SS2_CROWD_BAR.label];
  if (!Array.isArray(rows) || rows.length !== cited.length) return false;
  return cited.every((want) => {
    const got = rows.filter((row) => row?.kind === want.kind);
    if (got.length !== 1) return false;
    const [row] = got;
    return row.depth === want.depth && row.character === want.character && sameMatrix(row.matrix, want.matrix) &&
      (want.kind === "label" ? row.variable === want.variable : row.instance === want.instance);
  });
}

/** One of the crowd bar's sprites is EXACTLY its cited composition: one frame-1 placement, its shape, drawable, at a usable matrix. */
function composedAsCited(entry, part, shapes) {
  const placements = frameOne(entry);
  if (!placements || placements.length !== 1) return false;
  const [only] = placements;
  return only?.kind === "shape" && only.character === part.shape && Boolean(matrixOf(only.matrix)) && drawable(shapes, part.shape);
}

/**
 * The `crowd` section of `assets/icons/icons.json` (`tools/extract-icons.mjs`),
 * or null. Total: each of these is no pack, and the caller draws
 * `crowdBarFallbackOpsFor` and can say why —
 *
 * - no section (a clone, or a pack extracted before the section existed);
 * - an extraction that recorded `problems` (or has no such list), a `drive`
 *   that is not exactly `SS2_CROWD_BAR_DRIVE` with `SS2_CROWD_MOODS`, an
 *   `origin` that is not the panel's, or `placements` that are not exactly
 *   `SS2_CROWD_BAR`'s three — this module draws with those tables, so a build
 *   that disagrees with them is not the one it would draw;
 * - art that is not whole: a sprite that is not exactly its one cited shape at
 *   a usable matrix, a shape with no path, the label's record missing or with
 *   no box.
 */
export function crowdBarPackFrom(data) {
  if (!data || typeof data !== "object") return null;
  const section = data.crowd;
  const shapes = data.shapes;
  if (!section || typeof section !== "object" || !shapes || typeof shapes !== "object") return null;
  const texts = data.texts && typeof data.texts === "object" ? data.texts : {};
  if (!(Array.isArray(section.problems) && section.problems.length === 0)) return null;
  if (!drivenAsCited(section.drive)) return null;
  if (!(near(section.origin?.x, SS2_CROWD_BAR.origin.x) && near(section.origin?.y, SS2_CROWD_BAR.origin.y))) return null;
  if (!laidOutAsCited(section.placements)) return null;
  const clips = {};
  for (const part of [SS2_CROWD_BAR.background, SS2_CROWD_BAR.bar]) {
    const entry = lookup(section.clips, part.character);
    if (!composedAsCited(entry, part, shapes)) return null;
    clips[part.character] = entry;
  }
  const record = lookup(texts, SS2_CROWD_BAR.label.character);
  const bounds = record?.bounds;
  if (record?.kind !== "edit-text" || !bounds || ![bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax].every(Number.isFinite)) return null;
  return Object.freeze({
    clips: Object.freeze(clips),
    shapes: Object.freeze(shapes),
    texts: Object.freeze(texts),
    placements: Object.freeze([...section.placements]),
    drive: section.drive
  });
}

/* ------------------------------------------------------------------ */
/* The ops                                                             */
/* ------------------------------------------------------------------ */

/** What `crowdBarOpsFor` draws from: a pack, or (anything else) nothing — and then the fallback draws. */
const isPack = (pack) => Boolean(pack && pack.clips && pack.shapes);

/** Panel px to stage px, translations in TWIPS: the panel's own origin. */
const PANEL_TO_STAGE = Object.freeze([1, 0, 0, 1, SS2_CROWD_BAR.origin.x * 20, SS2_CROWD_BAR.origin.y * 20]);

/**
 * THE BUILD'S `_xscale`: the placement's x axis scaled to `xscale` percent —
 * its direction kept, its length set, as the property's setter does — and its
 * translation, the bar's registration point, left where it is. So the bar
 * grows and shrinks about its own left edge.
 */
function xscaled(matrix, xscale) {
  const [a, b, c, d, tx, ty] = matrix;
  const length = Math.hypot(a, b) || 1;
  return [(a / length) * (xscale / 100), (b / length) * (xscale / 100), c, d, tx, ty];
}

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

/** The centre of a text box under `matrix` (translations in twips), on the stage. */
function boxCentre(matrix, bounds) {
  const x = (bounds.xMin + bounds.xMax) / 2;
  const y = (bounds.yMin + bounds.yMax) / 2;
  return { x: matrix[0] * x + matrix[2] * y + matrix[4] / 20, y: matrix[1] * x + matrix[3] * y + matrix[5] / 20 };
}

/** The one walk behind `crowdBarOpsFor` and `crowdBarInvoiceFor`. */
function drawCrowdBar(pack, textPack, reading, options) {
  const counts = { hidden: 0, drivesAuthored: 0, wordsInPageFont: 0 };
  const ops = [];
  const drive = crowdBarDriveFor(reading?.value);
  // THE BUILD HIDES ALL THREE while its level test fails (the bar and the
  // background invisible, the label emptied): nothing is drawn — and so for
  // no crowd at all.
  if (reading?.shown !== true || drive.xscale === null) {
    counts.hidden = 1;
    return { ops, counts };
  }
  if (drive.authored) counts.drivesAuthored = 1;
  const stageScale = Number.isFinite(options?.stageScale) && options.stageScale > 0 ? options.stageScale : 1;

  // A sprite's own frame through the props painter, as the gauges' shapes go.
  const sprite = (part, matrix, role) => {
    const run = (frameOne(lookup(pack.clips, part.character)) ?? []).map((placement) => ({
      shape: placement.character,
      matrix: compose(matrix, matrixOf(placement.matrix) ?? IDENTITY),
      colour: colourTransformFrom(placement.colour ?? null)
    }));
    const drawn = propOpsFor({ props: { crowd: { frames: [run], effectGroups: [] } }, shapes: pack.shapes }, { linkage: "crowd", frame: 1 });
    for (const op of drawn ?? []) ops.push(Object.freeze({ ...op, panel: "crowd", role }));
  };

  // Depth 3, the background; depth 5, the bar at the build's `_xscale` (none at 0: a zero-width matrix is not a drawing).
  sprite(SS2_CROWD_BAR.background, compose(PANEL_TO_STAGE, SS2_CROWD_BAR.background.matrix), "background");
  if (drive.xscale > 0) sprite(SS2_CROWD_BAR.bar, compose(PANEL_TO_STAGE, xscaled(SS2_CROWD_BAR.bar.matrix, drive.xscale)), "bar");

  // Depth 63, the label: the build's glyphs when the text pack has them, else the page font at the field's box.
  const placement = pack.placements.find((row) => row?.kind === "label") ?? null;
  const matrix = compose(PANEL_TO_STAGE, SS2_CROWD_BAR.label.matrix);
  const group = glowGroupFor(placement?.filters, stageScale);
  const record = lookup(pack.texts, SS2_CROWD_BAR.label.character);
  const glyphs = lookup(textPack?.fields, SS2_CROWD_BAR.label.character) ? fieldOpsFor(textPack, SS2_CROWD_BAR.label.character, { text: drive.text, matrix }) : null;
  // A run that is nothing but `.notdef` boxes is not a drawing (`fontFor` in `text.js` says why).
  if (Array.isArray(glyphs) && glyphs.some((op) => !op.notdef)) {
    for (const op of glyphs) ops.push(Object.freeze({ ...op, ...(group ? { group } : {}), panel: "crowd", role: "label" }));
  } else {
    counts.wordsInPageFont += 1;
    const at = boxCentre(matrix, record.bounds);
    ops.push(Object.freeze({
      kind: "text", text: drive.text, x: at.x, y: at.y, size: (Number.isFinite(record.fontHeight) ? record.fontHeight : 12) * Math.abs(matrix[0]),
      fill: hexOf(record.colour) ?? "#ffffff", outline: glowColourOf(placement?.filters) ?? BLACK, alpha: 1, align: record.align ?? "center",
      panel: "crowd", role: "label"
    }));
  }
  return { ops, counts };
}

/**
 * THE CROWD BAR, FROM THE PLAYER'S OWN PACK — see the header for the op
 * contract. Null when `pack` is not a pack (`crowdBarPackFrom` said null):
 * draw `crowdBarFallbackOpsFor`. `[]` when the crowd is not heard
 * (`reading.shown` false) or there is none: the build hides it.
 *
 * @param {object|null} pack      from `crowdBarPackFrom`
 * @param {object|null} textPack  from `textPackFrom`; without it the label is the page font's
 * @param {{value: number|null, shown: boolean}} reading  the crowd, and whether it is heard
 * @param {object} [options]
 * @param {number} [options.stageScale=1]  device pixels per STAGE pixel, so the label's glow is built at the width it is drawn
 */
export function crowdBarOpsFor(pack, textPack, reading, options = {}) {
  if (!isPack(pack)) return null;
  return Object.freeze(drawCrowdBar(pack, textPack, reading, options).ops);
}

/**
 * WHAT THE CROWD BAR'S DRAWING COULD NOT CARRY, counted by name — the same
 * walk as `crowdBarOpsFor`. Null where it is.
 *
 * - `hidden`: 1 when nothing is drawn (the crowd not heard, or none).
 * - `drivesAuthored`: 1 when the crowd is past the build's range (`crowdBarDriveFor`'s `authored`).
 * - `wordsInPageFont`: 1 when the label is the page font's, with no text pack to draw it in the build's glyphs.
 */
export function crowdBarInvoiceFor(pack, textPack, reading, options = {}) {
  if (!isPack(pack)) return null;
  return Object.freeze(drawCrowdBar(pack, textPack, reading, options).counts);
}

/* ------------------------------------------------------------------ */
/* The authored fallback                                               */
/* ------------------------------------------------------------------ */

/**
 * WHERE THE FALLBACK DRAWS, as numbers — the build's own extents, so a clone
 * with no pack draws where the build does: shape 722's fill (0..156.5 x
 * 0..11.5, its 2 px black rim outside that) under the background's placement,
 * shape 724 (0..155 x 0..10) under the bar's, and field 750's box (-2..153.45 x
 * -2..21.15, 12 px) under the label's. The real-pack test checks each against
 * the pack. The shapes are drawn HERE — a dark track, a fill in the side
 * panel's own meter colour (`--warn`, `tools/arena/index.html`) — never a path
 * from the pack: that would ship the build's art in source.
 */
export const SS2_CROWD_FALLBACK_ART = Object.freeze({
  track: Object.freeze({ xMin: 0, xMax: 156.5, yMin: 0, yMax: 11.5, radius: 4, fill: "#1a120c", fillOpacity: 0.9, rim: "#c08a3e", rimWidth: 1.5 }),
  fill: Object.freeze({ xMin: 0, xMax: 155, yMin: 0, yMax: 10, radius: 4, fill: "#d8a13a" }),
  labelBox: Object.freeze({ xMin: -2, xMax: 153.45, yMin: -2, yMax: 21.15 }),
  labelSize: 12,
  labelFill: "#ffffff",
  labelOutline: BLACK
});

/** A rounded rectangle as M/L/Q path data. */
function roundedRect({ xMin, yMin, xMax, yMax, radius }) {
  const r = Math.max(0, Math.min(radius, (xMax - xMin) / 2, (yMax - yMin) / 2));
  const n = (value) => Number(value.toFixed(3));
  return `M${n(xMin + r)} ${n(yMin)}L${n(xMax - r)} ${n(yMin)}Q${n(xMax)} ${n(yMin)} ${n(xMax)} ${n(yMin + r)}` +
    `L${n(xMax)} ${n(yMax - r)}Q${n(xMax)} ${n(yMax)} ${n(xMax - r)} ${n(yMax)}` +
    `L${n(xMin + r)} ${n(yMax)}Q${n(xMin)} ${n(yMax)} ${n(xMin)} ${n(yMax - r)}` +
    `L${n(xMin)} ${n(yMin + r)}Q${n(xMin)} ${n(yMin)} ${n(xMin + r)} ${n(yMin)}Z`;
}

/** An authored path op in the pack ops' contract (translations in twips). */
function authoredOp(d, matrix, fields) {
  return Object.freeze({
    kind: "path", d, matrix: Object.freeze([...matrix]),
    fill: fields.fill ?? "none", fillRule: "nonzero", fillOpacity: fields.fillOpacity ?? 1,
    stroke: fields.stroke ?? null, strokeWidth: fields.strokeWidth ?? 0, strokeOpacity: 1,
    authored: true, panel: "crowd", role: fields.role
  });
}

/**
 * THE AUTHORED CROWD BAR for a clone, or a pack without the `crowd` section:
 * the build's place and drive (`crowdBarDriveFor`), a track, a fill grown
 * about the same left edge, and the label in the page font at the build's
 * field. Op shape and space are `crowdBarOpsFor`'s; every path op carries
 * `authored: true`. `[]` when the crowd is not heard or there is none.
 *
 * @param {{value: number|null, shown: boolean}} reading  the crowd, and whether it is heard
 */
export function crowdBarFallbackOpsFor(reading) {
  const drive = crowdBarDriveFor(reading?.value);
  if (reading?.shown !== true || drive.xscale === null) return Object.freeze([]);
  const art = SS2_CROWD_FALLBACK_ART;
  const ops = [];
  const track = compose(PANEL_TO_STAGE, SS2_CROWD_BAR.background.matrix);
  ops.push(authoredOp(roundedRect(art.track), track, {
    fill: art.track.fill, fillOpacity: art.track.fillOpacity, stroke: art.track.rim, strokeWidth: art.track.rimWidth, role: "background"
  }));
  if (drive.xscale > 0) {
    ops.push(authoredOp(roundedRect(art.fill), compose(PANEL_TO_STAGE, xscaled(SS2_CROWD_BAR.bar.matrix, drive.xscale)), { fill: art.fill.fill, role: "bar" }));
  }
  const at = boxCentre(compose(PANEL_TO_STAGE, SS2_CROWD_BAR.label.matrix), art.labelBox);
  ops.push(Object.freeze({
    kind: "text", text: drive.text, x: at.x, y: at.y, size: art.labelSize, fill: art.labelFill, outline: art.labelOutline, alpha: 1,
    align: SS2_CROWD_BAR.label.align, panel: "crowd", role: "label"
  }));
  return Object.freeze(ops);
}
