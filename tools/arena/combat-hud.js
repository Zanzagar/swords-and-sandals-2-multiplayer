/**
 * THE IN-FRAME TEAM HUD, WIRED (wave 3 of the in-frame team HUD, 2026-09-25):
 * every decision `tools/arena/main.js` needs to paint the build's own gauges
 * in the stage, pure, so the shell only paints what it is handed.
 *
 * The owner, 2026-09-24: *"the team health, energy, and aramor should be in
 * the game frame as UI elements, using the same ui elements that are used in
 * 1v1 in the original game. Pull these assets. Make camera adjustments
 * necessary to fit these assets."* The art, its layout and its drive are
 * `src/render/combat-panel.js`'s (D2); the camera's fit is
 * `src/render/arena-backdrop.js`'s (D3). What is decided HERE:
 *
 * - **Which art, and why**: the build's own gauges from the player's icons
 *   pack, or the authored fallback — and the log line and the "What you are
 *   looking at" line that say which, with the renderer's invoice
 *   (`combatHudArtFor`, `combatHudInvoiceFor`, `combatHudProvenanceFor`).
 * - **D2 and D3, the frame**: one cluster per fighter, laid out with the art
 *   it will be drawn with, and the band's top handed to the camera in a TEAM
 *   bout only (`combatHudFrameFor`).
 * - **The ops each cluster is painted with**, the pack's or the fallback's,
 *   kept while nothing they depend on changes (`createCombatHudOps`).
 * - **The camera's size feed**: what `placedActors()` hands the camera as a
 *   fighter's `_yscale` — the larger of the scene's and the drawn one
 *   (`cameraYscaleFor`), so the HUD guarantee covers what is on screen.
 * - **The fitted view's band**: the authored projection drawn when there is
 *   no extracted arena, laid out above the band in a team bout, inside the
 *   stage the frame is clipped to (`fittedViewFor`).
 * - **D4, the ring's room**: the visible stage above the UI bar, in canvas
 *   pixels, where the ring's buttons, labels and arrows are kept
 *   (`ringBoundsFor`).
 * - **D6, the timing**: a fighter's gauges hold their pre-step readings until
 *   the step's first pop-up on him starts, or until the step settles when no
 *   pop-up concerns him (`gaugeHoldFor`, `heldHudFor`).
 *
 * Pure: no canvas, no DOM, no clock of its own, no battle. It reads the HUD
 * model (`teamHudFor`, `tools/arena/team-hud.js`) and never writes anything.
 */

import { SS2_CLOSE_UP, stageClipRectFor } from "../../src/render/arena-backdrop.js";
import { rankOfDepth, viewportFor } from "../../src/render/arena-shell.js";
import { figureScaleFor } from "../../src/render/figure.js";
import { SS2_FIGURE_HEIGHT } from "../../src/render/painter.js";
import {
  combatPanelFallbackOpsFor,
  combatPanelInvoiceFor,
  combatPanelLayoutFor,
  combatPanelOpsFor,
  combatPanelPackFrom
} from "../../src/render/combat-panel.js";

/* ------------------------------------------------------------------ */
/* Which art, and why                                                  */
/* ------------------------------------------------------------------ */

/** The one command that brings a pack up to date: every extractor whose output is stale. */
const EXTRACT_ALL = "`node tools/extract-all.mjs`";

/**
 * Why the fallback is drawn, by case — the log line (`warn` when the player
 * can fix it) and the clause the provenance line ends on.
 */
const FALLBACK_WHY = Object.freeze({
  none: Object.freeze({
    log: `gauges: no icons pack — the authored gauges are drawn, with the build's layout and drive (${EXTRACT_ALL} for the build's own).`,
    warn: false,
    because: `there is no extracted icons pack (${EXTRACT_ALL} for the build's own)`
  }),
  stale: Object.freeze({
    log: `gauges: your icons pack was extracted before its gauges section — the authored gauges are drawn: run ${EXTRACT_ALL} for the build's own.`,
    warn: true,
    because: `your icons pack predates its gauges section: run ${EXTRACT_ALL}`
  }),
  refused: Object.freeze({
    log: "gauges: your icons pack's gauges section is not the build this page draws (the extraction recorded a problem, " +
      `or its art is not whole) — the authored gauges are drawn. Re-extract with ${EXTRACT_ALL}.`,
    warn: true,
    because: `your icons pack's gauges section was refused (a problem its extraction recorded, or art that is not whole): re-extract with ${EXTRACT_ALL}`
  }),
  unused: Object.freeze({
    log: "gauges: the icons pack was not used this bout (late, or its fetch failed — the asset gate's line says which) — the authored gauges are drawn.",
    warn: true,
    because: "the icons pack was not used this bout (late, or its fetch failed; reload to use it)"
  })
});

/**
 * WHICH GAUGES ARE DRAWN, from what the asset gate handed `useIconPack`:
 *
 * - `"build"` — `combatPanelPackFrom` accepted the pack's `gauges` section:
 *   the build's own art, from the player's install;
 * - `"none"` — no icons pack at all (a 404: a clone, the supported case);
 * - `"stale"` — an icons pack extracted before its `gauges` section existed;
 * - `"refused"` — a section the renderer will not draw as the build's (a
 *   problem the extraction recorded, a drive or placement that is not the one
 *   it draws, art that is not whole);
 * - `"unused"` — never handed over (`undefined`): the asset gate skipped a
 *   late or failed icons pack for this bout.
 *
 * Every case but the first draws the authored fallback, and `log` says why.
 *
 * @param {object|null|undefined} icons  `assets/icons/icons.json`, null for a 404, undefined when never applied
 * @returns {{pack: object|null, state: string, log: {message: string, warn: boolean}}}
 */
export function combatHudArtFor(icons) {
  const pack = icons ? combatPanelPackFrom(icons) : null;
  if (pack) {
    return Object.freeze({
      pack,
      state: "build",
      log: Object.freeze({ message: "gauges: the build's own combat_panel from your install — health, energy and armour in the frame.", warn: false })
    });
  }
  const state = icons === undefined ? "unused" : icons === null || typeof icons !== "object" ? "none"
    : icons.gauges === undefined || icons.gauges === null ? "stale" : "refused";
  const why = FALLBACK_WHY[state];
  return Object.freeze({ pack: null, state, log: Object.freeze({ message: why.log, warn: why.warn }) });
}

/**
 * WHAT THE BUILD'S ART COULD NOT CARRY, summed over every cluster the frame
 * draws — `combatPanelInvoiceFor`'s counts, by name. Null for the fallback,
 * which carries no art of the build's to fall short of.
 *
 * @param {object} art  `combatHudArtFor`'s
 * @param {object|null} textPack  the text pack the words are drawn with
 * @param {object} frame  `combatHudFrameFor`'s
 */
export function combatHudInvoiceFor(art, textPack, frame) {
  if (!art?.pack) return null;
  const total = {};
  for (const { cluster, reading } of frame?.clusters ?? []) {
    const counts = combatPanelInvoiceFor(art.pack, textPack, cluster, reading) ?? {};
    for (const [name, count] of Object.entries(counts)) total[name] = (total[name] ?? 0) + count;
  }
  return Object.freeze(total);
}

/** What is authored either way: the layout of a team bout, the colours, the mark, the fade and the wait. */
const AUTHORED_EITHER_WAY =
  "A 1v1 is the build's own panel at its own place; a team bout gives each fighter one cluster — red the build's " +
  "hero cluster from the left, blue its villain cluster from the right, slot 1 at each edge — scaled to fit and " +
  "standing where the build's banners end, and the camera keeps every fighter above them. Authored: each name in " +
  "its side's colour, the acting fighter's gold mark, the fallen's fade, and the wait — a gauge drains when the " +
  "pop-up of the blow that drains it starts (or when the action has been drawn, for a cost with no pop-up), not " +
  "the moment the engine decides it.";

/**
 * THE GAUGES' LINE IN "WHAT YOU ARE LOOKING AT" — `[subject, body]`, derived
 * from what is drawn, as the figures' line is: the build's own art with the
 * invoice's counts named, or the authored fallback and why.
 *
 * @param {{art: object, invoice: object|null, open: boolean}} input  `combatHudArtFor`'s art,
 *   `combatHudInvoiceFor`'s counts, and whether the asset gate has opened
 */
export function combatHudProvenanceFor({ art, invoice = null, open = true }) {
  const subject = "The gauges in the frame";
  if (!open) return [subject, "are not drawn yet: the stage waits for your extracted packs to settle."];
  if (art?.pack) {
    const missing = [];
    const count = (name) => (Number.isFinite(invoice?.[name]) ? invoice[name] : 0);
    if (count("bevelsDrawnPlain") > 0) missing.push(`the banners' inner bevel, drawn plain (${count("bevelsDrawnPlain")})`);
    if (count("wordsInPageFont") > 0) missing.push(`${count("wordsInPageFont")} words in the page font, where the text pack has no glyphs for them`);
    if (count("glowsUnderFade") > 0) missing.push(`${count("glowsUnderFade")} glows of a fallen fighter's words fading less than the words`);
    if (count("drivesAuthored") > 0) missing.push(`${count("drivesAuthored")} gauges with no reading to drive them, drawn empty`);
    const lacks = count("shapesMissing") + count("cuttersMissing") + count("unsupported");
    if (lacks > 0) missing.push(`${lacks} pieces of art the pack does not hold`);
    return [subject,
      "are the build's own combat_panel, from your install's icons: each fighter's name banner, energy and health " +
      "vials and armour gauge, driven as the build drives them — the liquid's height and its \"value / max\" — and " +
      "the armour gauge hidden while he has no armour, as the build hides it. " + AUTHORED_EITHER_WAY +
      (missing.length > 0 ? ` Not the build's, counted when the bout opened: ${missing.join("; ")}.` : "")];
  }
  const because = FALLBACK_WHY[art?.state]?.because ?? FALLBACK_WHY.none.because;
  return [subject,
    "are authored stand-ins — a band for the banner, a flask for each vial and a shield for the armour, the words in " +
    `the page font — with the build's own layout and drive, because ${because}. ` + AUTHORED_EITHER_WAY];
}

/* ------------------------------------------------------------------ */
/* D2, D3: the frame                                                   */
/* ------------------------------------------------------------------ */

/**
 * THE HUD THIS FRAME DRAWS, AND WHAT THE CAMERA STANDS TO.
 *
 * - `layout`: `combatPanelLayoutFor` over the model's sides, red then blue,
 *   each fighter in slot order — laid out with `pack`, the art the clusters
 *   will be drawn with (`combatPanelPackFrom`'s answer, null for the authored
 *   fallback), since the layout's top is measured off that art.
 * - `cameraHudTop`: the band's top in a TEAM bout (either side has two or
 *   more), for `stepFramedCamera`; **null in a 1v1**, which is the build's own
 *   panel at the build's own place under the build's own camera (D3).
 * - `clusters`: `{ cluster, reading }` — each cluster with its fighter's row.
 *
 * @param {object} input
 * @param {object} input.hud   `teamHudFor`'s model — as the gauges show it (`heldHudFor`)
 * @param {object|null} input.pack  `combatPanelPackFrom(...)`, or null
 */
export function combatHudFrameFor({ hud, pack = null }) {
  const teams = hud?.teams ?? [];
  const layout = combatPanelLayoutFor({
    sides: teams.map((team) => ({ teamId: team.teamId, ids: (team.rows ?? []).map((one) => one.id) })),
    pack
  });
  const rows = rowsById(hud);
  return Object.freeze({
    layout,
    cameraHudTop: layout.mode === "team" && Number.isFinite(layout.hudTop) ? layout.hudTop : null,
    clusters: Object.freeze(layout.clusters.map((cluster) => Object.freeze({ cluster, reading: rows.get(cluster.id) ?? null })))
  });
}

/**
 * THE `_yscale` THE CAMERA IS HANDED FOR A FIGHTER: the larger of the scene's
 * and the one he is DRAWN at this frame (`drawnYscaleOf` in `main.js`,
 * `figureYscaleAt`).
 *
 * ► **THE SCENE'S SIZE IS NOT WHAT IS ON SCREEN WHILE A RESCALE IS PENDING**
 *   (the camera slice's verifiers, both rounds): the fold sets a colossus's
 *   post-cast or post-expiry `_yscale` at once, while the figure keeps drawing
 *   the old size until its clip or the phase advance, and a growth OVERSHOOTS
 *   on screen (100 -> 175 -> 138 -> ... -> 150). The camera fits shadows,
 *   plates and crowns from this size, and holds them above the in-frame HUD
 *   from it; the larger of the two covers both what is drawn now and what the
 *   scene is about to draw. With nothing pending the two are equal.
 *   Only the close-up and the HUD's fit read a size: a 1v1's camera is the
 *   build's and never does.
 *
 * @param {number} sceneYscale  the scene actor's `yscale`
 * @param {number|null} drawnYscale  the size he is drawn at this frame, if known
 */
export function cameraYscaleFor(sceneYscale, drawnYscale) {
  return Number.isFinite(drawnYscale) ? Math.max(sceneYscale, drawnYscale) : sceneYscale;
}

/**
 * THE FITTED VIEW — the authored projection drawn when there is no extracted
 * arena — with the in-frame HUD's band reserved at its foot in a TEAM bout
 * (D3: "the authored FITTED view reserves the band's height the same way").
 * `{ scale, horizon, ground, floor, toX, toY }`, in canvas pixels; `toX` and
 * `toY` are the shell's own closures, which it used to write in `viewport()`.
 *
 * - **No band** (a 1v1, whose panel stands over its fighters as the build's
 *   does; or no HUD this frame): the fitted view before the HUD, to the
 *   number — `viewportFor` over the whole canvas.
 * - **A band**: the HUD is painted in the STAGE FIT in this view too, so its
 *   top is `fit.offsetY + fit.scale * hudTop` on the canvas. The view is laid
 *   out in what is DRAWN above it: from the top of the stage the frame is
 *   clipped to (`stageClipRectFor`; the canvas's own top with `?clip=0`) down
 *   to its foot, with `viewportFor`'s `reserveBottom` holding everything under
 *   the band's top, and moved down by that top — and pulled back until every
 *   fighter's crown is on that stage too.
 *
 * ► ~~Laid out over the whole canvas with the band reserved~~ (Codex review of
 *   wave 3, pass 1): the frame is clipped to the letterboxed stage, so on a
 *   canvas taller than 640:420 the reserve pulled the view up past the
 *   clipped top — 640x600, 3v3: the back rank's highest crown at 58.78
 *   against a visible top of 90. Laid out inside the stage, a letterboxed
 *   canvas draws exactly what the stage's own canvas draws, moved down.
 *
 * ► **AND THE BACK RANKS' CROWNS ARE FITTED, WHICH `viewportFor` DOES NOT DO**
 *   (Codex review of wave 3, pass 2). Its vertical bound fits the FRONT rank's
 *   crown; the reserve lowers the floor, and at the stage's own 640x420 a
 *   3v3's back rank stood its crown at -11.32 under the band where it had
 *   stood at 34.26 without one. So with a band the view is pulled back — the
 *   width `viewportFor` fits is narrowed, which lowers only its scale, and
 *   every other term follows from its own arithmetic — as far as it must for
 *   the highest crown (the figure's `SS2_FIGURE_HEIGHT` at each fighter's
 *   drawn size: his `_yscale` and the rank his depth puts him in) to stand on
 *   the drawn stage. Found by bisection: a smaller scale only ever lowers a
 *   crown. **The principled home of this bound is `viewportFor`
 *   (`src/render/arena-shell.js`), which this slice may not change**; with
 *   no band, the fitted view is left exactly as it was, crowns and all.
 *
 * @param {object} input
 * @param {number} input.width   the canvas's width
 * @param {number} input.height  the canvas's height
 * @param {object} input.fit     `stageFitFor({ width, height })`
 * @param {object|null} input.frame  `combatHudFrameFor`'s, or null
 * @param {object[]} input.actors    the scene's actors: `x`, `y`, `yscale`, as `viewportFor` reads them
 * @param {number} input.frontY  the front rank's arena y
 * @param {number} [input.rankStride]  arena units a rank (`SS2_ARENA.rankStride`), for each fighter's drawn size
 * @param {boolean} [input.clipped=true]  whether the frame is clipped to the stage (`?clip=0` says not)
 */
export function fittedViewFor({ width, height, fit, frame, actors, frontY, rankStride = null, clipped = true }) {
  // ► **THE BAND IT DRAWS, A 1v1 INCLUDED** (the wave-3 verifier, 2026-09-25):
  //   `cameraHudTop` is null in a 1v1 because the STAGE camera is the build's
  //   own, but the fitted view has no build camera to defer to, and the 1v1
  //   clusters are painted all the same — keyed on it, the vials covered the
  //   fighters' legs (-73 px at 640x420). So the fitted view reads the layout's.
  const top = Number.isFinite(frame?.layout?.hudTop) ? fit.offsetY + fit.scale * frame.layout.hudTop : null;
  const drawn = top === null ? { y: 0, height } : clipped ? stageClipRectFor(fit) : { y: 0, height };
  const bottom = drawn.y + drawn.height;
  const viewAt = (fitWidth) => {
    const laid = viewportFor({
      width: fitWidth,
      height: drawn.height,
      frontY,
      actors,
      reserveBottom: top === null ? 0 : Math.max(0, bottom - top)
    });
    const ground = drawn.y + laid.ground;
    return Object.freeze({
      scale: laid.scale,
      horizon: drawn.y + laid.horizon,
      ground,
      floor: drawn.y + laid.floor,
      // Centred on the CANVAS, whatever width the scale was fitted to.
      toX: (x) => width / 2 + x * laid.scale,
      // Arena y is `frontY` at the front rank and DECREASES further back, so a
      // bigger y is nearer the viewer and further down the canvas.
      toY: (y, lift = 0) => ground - (frontY - y) * laid.scale * 1.7 - lift * laid.scale
    });
  };
  const view = viewAt(width);
  if (top === null) return view;
  const crowns = (actors ?? [])
    .filter((actor) => actor && actor.placed !== false && Number.isFinite(actor.y))
    .map((actor) => ({
      y: actor.y,
      height: SS2_FIGURE_HEIGHT * figureScaleFor({
        yscale: Number.isFinite(actor.yscale) ? actor.yscale : 100,
        rank: Number.isFinite(rankStride) ? rankOfDepth(actor.y, actor.slotIndex ?? 0, { frontY, rankStride }) : 0,
        slotIndex: actor.slotIndex ?? 0
      })
    }));
  const onStage = (candidate) => crowns.every((crown) => candidate.toY(crown.y, crown.height) >= drawn.y);
  if (onStage(view)) return view;
  let low = 0;
  let high = width;
  for (let step = 0; step < 40; step += 1) {
    const middle = (low + high) / 2;
    if (onStage(viewAt(middle))) low = middle;
    else high = middle;
  }
  return low > 0 ? viewAt(low) : view;
}

/* ------------------------------------------------------------------ */
/* D4: the ring's room                                                 */
/* ------------------------------------------------------------------ */

/**
 * WHERE THE RING MAY STAND, in canvas pixels (`{x, y, width, height}`, the
 * shape `ringButtonsInside`, `ringLabelAt` and `ringCaptionAt` read).
 *
 * ► **THE VISIBLE STAGE, NOT THE WHOLE ONE (D4).** The ring used to be kept
 *   inside `stageClipRectFor` — the 640x420 stage the frame is clipped to — so
 *   at pair zooms of 84 and over the rank-front arrow stood UNDER the build's
 *   UI bar (root depth 438, painted over it), where nobody could see it (wave
 *   1 of the in-frame HUD). With the build's bar and border drawn (`barred`:
 *   the extracted arena screen is), the ring keeps to what they leave visible,
 *   `SS2_CLOSE_UP.visible` (stage x 0..639, y 1..398, measured) — and so over
 *   the in-frame HUD, which it is painted after. Never outside the clip.
 * - **The FITTED view** (no extracted arena) draws no bar and no border, so
 *   its ring keeps the whole clipped stage, as it always did.
 *
 * @param {{scale: number, offsetX: number, offsetY: number}} fit  `stageFitFor`'s
 * @param {{barred: boolean}} options  whether the build's UI bar and border are drawn
 */
export function ringBoundsFor(fit, { barred }) {
  const clip = stageClipRectFor(fit);
  if (!barred) return clip;
  const { left, right, top, bottom } = SS2_CLOSE_UP.visible;
  const x0 = Math.max(clip.x, fit.offsetX + left * fit.scale);
  const y0 = Math.max(clip.y, fit.offsetY + top * fit.scale);
  const x1 = Math.min(clip.x + clip.width, fit.offsetX + right * fit.scale);
  const y1 = Math.min(clip.y + clip.height, fit.offsetY + bottom * fit.scale);
  return Object.freeze({ x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) });
}

/* ------------------------------------------------------------------ */
/* The ops, kept                                                        */
/* ------------------------------------------------------------------ */

/** Everything of a row the ops read, as a key: the name, its colour, the mark, the fade and the three gauges. */
function readingKey(reading) {
  const gauge = (one) => (one ? [one.value, one.max, one.shown] : null);
  return [reading?.name ?? null, reading?.colour ?? null, Boolean(reading?.acting), reading?.alive !== false,
    gauge(reading?.health), gauge(reading?.energy), gauge(reading?.armour)];
}

/**
 * A PAINTER'S SOURCE OF OPS, ONE CLUSTER AT A TIME, KEPT: `combatPanelOpsFor`
 * with the build's pack, `combatPanelFallbackOpsFor` without — each built once
 * and handed back unchanged while the art, the text pack, the cluster's place,
 * the stage scale and every field of the reading the ops read are the same.
 *
 * ► **KEPT, BECAUSE BUILDING THEM IS NOT FREE.** Measured with the real packs
 *   in node (2026-09-25): ~5 ms a frame to build a pair's two clusters, ~9 ms
 *   for 2v2 and ~12 ms for 3v3 — `propOpsFor` per run and a glyph outline per
 *   character — for art that changes only when a reading does.
 *
 * @returns {(input: {art: object, textPack: object|null, cluster: object, reading: object, stageScale: number}) => object[]}
 */
export function createCombatHudOps() {
  const kept = new Map();
  return ({ art, textPack = null, cluster, reading, stageScale = 1 }) => {
    const pack = art?.pack ?? null;
    const key = JSON.stringify([cluster.side, cluster.matrix, cluster.box, stageScale, readingKey(reading)]);
    const hit = kept.get(cluster.id);
    if (hit && hit.key === key && hit.pack === pack && hit.textPack === textPack) return hit.ops;
    const ops = (pack ? combatPanelOpsFor(pack, textPack, cluster, reading, { stageScale }) : null)
      ?? combatPanelFallbackOpsFor(cluster, reading);
    kept.set(cluster.id, { key, pack, textPack, ops });
    return ops;
  };
}

/* ------------------------------------------------------------------ */
/* D6: the gauges wait for the blow                                    */
/* ------------------------------------------------------------------ */

/**
 * WHAT A HOLD KEEPS AT ITS PRE-STEP VALUE: the three readings, and whether he
 * stands — so a fighter's cluster does not fade (D2's fallen alpha) before the
 * killing blow lands on screen, any more than his vial drains. Whose turn it
 * is (`acting`) is NOT held: it is the wire's, as the side panel and the turn
 * strip say it at the same moment.
 */
const HELD = Object.freeze(["health", "energy", "armour", "alive"]);

const rowsById = (hud) => new Map((hud?.teams ?? []).flatMap((team) => team.rows ?? []).map((one) => [one.id, one]));

/** Whether two rows differ in anything a hold keeps. */
function heldChanged(before, after) {
  return HELD.some((field) => JSON.stringify(before?.[field] ?? null) !== JSON.stringify(after?.[field] ?? null));
}

/**
 * THE HOLD ONE STEP PUTS ON THE GAUGES (D6) — made when the step is begun, from
 * the HUD model before it and after it.
 *
 * ► **THE WIRE HOLDS THE BLOW AT SUBMIT; THE SCREEN DOES NOT.** `host.wire()`
 *   carries every post-action reading the moment `host.submit` returns, while
 *   the swing, the arrow and the reaction are still to be drawn. So each
 *   fighter the step CHANGED keeps his pre-step readings until:
 *   - **his first pop-up of the step starts** (`startedAt`, as `spawnPopups`
 *     stamps it: with his reaction clip, at an arrow's or a fireball's impact,
 *     on a rock's landing frame) — the build shows the number and the drain
 *     together; or
 *   - **the step settles** — every token it carried reported (or abandoned) —
 *     when no pop-up concerns him (the attacker's spent energy), and as the
 *     upper bound for everyone: a pop-up is no gate (nothing in the build
 *     waits on one), and a gauge must never lag past the step it belongs to.
 *
 * @param {object} input
 * @param {object} input.before  `teamHudFor` as the step found it
 * @param {object} input.after   `teamHudFor` after `host.submit`
 * @param {{popup: {combatantId: string}, startedAt: number}[]} [input.popups]  this step's pop-ups
 * @param {Array<*>} [input.tokens]  the step's action tokens (`step.actionTokens`)
 * @returns {{tokens: Array<*>, fighters: Object<string, {readings: object, releaseAt: number|null}>}}
 */
export function gaugeHoldFor({ before, after, popups = [], tokens = [] }) {
  const was = rowsById(before);
  const fighters = {};
  for (const [id, now] of rowsById(after)) {
    const then = was.get(id);
    if (!then || !heldChanged(then, now)) continue;
    const starts = (popups ?? [])
      .filter((entry) => entry?.popup?.combatantId === id && Number.isFinite(entry.startedAt))
      .map((entry) => entry.startedAt);
    fighters[id] = Object.freeze({
      readings: Object.freeze(Object.fromEntries(HELD.map((field) => [field, then[field]]))),
      releaseAt: starts.length > 0 ? Math.min(...starts) : null
    });
  }
  return Object.freeze({ tokens: Object.freeze([...(tokens ?? [])]), fighters: Object.freeze(fighters) });
}

/**
 * THE HUD MODEL AS THE GAUGES SHOW IT NOW: `hud` (the wire's) with each fighter
 * the hold still keeps given his pre-step readings back. The same shape as
 * `teamHudFor`'s; `hud` itself when nothing is held.
 *
 * @param {object} hud  `teamHudFor` now
 * @param {object|null} hold  `gaugeHoldFor`'s, for the step being drawn
 * @param {{now: number, pendingTokens: Array<*>}} clock  the arena's clock and the tokens still unreported
 */
export function heldHudFor(hud, hold, { now, pendingTokens = [] } = {}) {
  if (!hold || !hud) return hud;
  const pending = new Set(pendingTokens ?? []);
  const settled = hold.tokens.every((token) => !pending.has(token));
  if (settled) return hud;
  const keeps = (id) => {
    const fighter = hold.fighters[id];
    if (!fighter) return null;
    if (fighter.releaseAt !== null && now >= fighter.releaseAt) return null;
    return fighter.readings;
  };
  if (!(hud.teams ?? []).some((team) => (team.rows ?? []).some((one) => keeps(one.id)))) return hud;
  return Object.freeze({
    ...hud,
    teams: Object.freeze(hud.teams.map((team) => Object.freeze({
      ...team,
      rows: Object.freeze(team.rows.map((one) => {
        const kept = keeps(one.id);
        return kept ? Object.freeze({ ...one, ...kept }) : one;
      }))
    })))
  });
}
