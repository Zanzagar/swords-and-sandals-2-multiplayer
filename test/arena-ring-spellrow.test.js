/**
 * THE SPELL ROW NEVER COVERS THE BOW BUTTONS' WORDS — decision 7 of
 * `docs/design/battle-ui.md#decided-hud-2026-09-24` ("Bombard", "Snipe", the
 * arrow count), built 2026-09-28 (ring3, slice "spellrow"). The owner's report,
 * 2026-09-24: the spell row covered the bow's "Bombard" text.
 *
 * ► **WHERE IT HAPPENED, MEASURED BEFORE ANYTHING WAS CHANGED** (a scratch
 *   sweep against c2b5751, both of the page's views, 1v1-3v3, the `tricks`,
 *   `buffs`, `crowd`, `blasts` and plain rosters, seeds 1-2, every foe
 *   selected: 9,470 rings). The build's own row (`inventory_overlay`, 492, at
 *   (0, -80) of the overlay at 60%) stands 1.8 overlay px into the BOMBARD
 *   word, which the long bow frame draws in optionD facing right and optionA
 *   facing left — ABOVE its disc (static 852, ink 20.2..27.6 button px over
 *   the disc's centre). 564 place-word crossings, every one a BOMBARD; the row
 *   touched no other word (POWER, the only other word in optionA/optionD, stands
 *   3.75 overlay px under it), and no arrow count (drawn at its disc's centre).
 *   The row is painted after the eight, so it covered the word's top third.
 *
 * Seams: `ringItemButtonsAt`'s `words` (`tools/arena/ring-layout.js`), the words
 * the eight carry (`ringWordBoxesOf`, `tools/arena/ring-art.js`), and — read as
 * text — `paintRing` in `tools/arena/main.js`. The bouts come off a REAL host;
 * the words are measured here, independently, off the ops the page paints.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { SS2_ARENA, ss2BattleValues, ss2Combatant, ss2PhysicalSize, ss2TeamRules } from "../src/team/ss2-rules.js";
import { resourceValue } from "../src/team/resources.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { ringModelFor } from "../tools/arena/ring.js";
import {
  fighterBoxFor,
  ringButtonsAt,
  ringButtonsInside,
  ringItemButtonsAt,
  ringLabelAt,
  ringLabelBoxOf,
  ringLabelSizeFor,
  ringMoveButtonsAt,
  ringPaintOrder,
  ringPlacementFor,
  ringSwapButtonAt
} from "../tools/arena/ring-layout.js";
import { ringButtonArt, ringWordBoxesOf } from "../tools/arena/ring-art.js";
import { actorSpanFor, stageFitFor, stageProjectorFor, stepFramedCamera } from "../src/render/arena-backdrop.js";
import { rankOfDepth } from "../src/render/arena-shell.js";
import { figureScaleFor } from "../src/render/figure.js";
import { ss2ColossusYscaleAfter } from "../src/common/ss2-figure.js";
import { actionButtonPackFrom } from "../src/render/action-buttons.js";
import { textPackFrom } from "../src/render/text.js";
import { combatPanelLayoutFor } from "../src/render/combat-panel.js";
import { combatHudArtFor, fittedViewFor, ringBoundsFor } from "../tools/arena/combat-hud.js";

const deps = { ss2Combatant, ss2BattleValues };
/** The arena's demo bout, headless: the same roster and rule set `tools/arena/main.js` builds. */
function demoHost({ perSide = 1, seed = 7, kit = "" } = {}) {
  const items = demoItemsFrom(kit);
  return createVanillaBattleHost({
    teams: [demoSide("red", perSide, { ...deps, items, seed }), demoSide("blue", perSide, { ...deps, items, seed })],
    rules: ss2TeamRules,
    bindings: SS2_STATIC_MAP_BINDINGS,
    seed
  });
}
/** Plays the rule set's own AI for `turns` submissions. */
function played(host, turns) {
  for (let taken = 0; taken < turns; taken += 1) {
    const due = host.currentCombatantId();
    host.submit({ ...host.suggestAction(due), actorId: due });
  }
  return host;
}
/** The ring for whoever is due, read off the host exactly as the shell reads it. */
function modelOf(host, previous = null) {
  const actorId = host.currentCombatantId();
  return ringModelFor({
    actorId,
    combatants: host.wire().teams.flatMap((team) => team.combatants),
    legal: host.legalActions(),
    previous,
    menuFor: (targetId) => host.unavailableActions(actorId, targetId)
  });
}

/* ------------------------------------------------------------------ */
/* The player's own packs                                              */
/* ------------------------------------------------------------------ */

const ICONS_AT = new URL("../assets/icons/icons.json", import.meta.url);
const TEXT_AT = new URL("../assets/text/text.json", import.meta.url);
let packs;
/** The icons and text packs the page draws the build's words with, or null (a fresh clone: nothing to cover). */
function realPacks(t) {
  if (packs === undefined) {
    packs = fs.existsSync(ICONS_AT) && fs.existsSync(TEXT_AT)
      ? (() => {
        const icons = JSON.parse(fs.readFileSync(ICONS_AT, "utf8"));
        return { icons, pack: actionButtonPackFrom(icons), textPack: textPackFrom(JSON.parse(fs.readFileSync(TEXT_AT, "utf8"))) };
      })()
      : null;
  }
  if (!packs || !packs.pack?.layout) {
    t.skip("no extracted icons pack with its buttons section, or no text pack, in this tree (a fresh clone draws no build word to cover): run node tools/extract-icons.mjs and node tools/extract-text.mjs");
    return null;
  }
  return packs;
}

/* ------------------------------------------------------------------ */
/* The words, measured here (not by the code under test)               */
/* ------------------------------------------------------------------ */

/**
 * THE EXACT INK BOX OF A GLYPH PATH (`M`, `L`, `Q`, `Z`, absolute — every
 * glyph the text pack holds, and the `.notdef` box), under its op's matrix
 * (translation in twips), quadratic extrema included: the extremum of each
 * transformed curve is taken where its derivative is zero, as
 * `tools/extract-text.mjs`'s `inkBoundsOf` does.
 */
function pathInk(d, m) {
  const tokens = String(d).match(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const at = ([x, y]) => [m[0] * x + m[2] * y + m[4] / 20, m[1] * x + m[3] * y + m[5] / 20];
  const box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  const note = ([x, y]) => {
    box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x);
    box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y);
  };
  const extremum = (p0, c, p1) => {
    const denominator = p0 - 2 * c + p1;
    const s = denominator === 0 ? -1 : (p0 - c) / denominator;
    return s > 0 && s < 1 ? (1 - s) * (1 - s) * p0 + 2 * s * (1 - s) * c + s * s * p1 : null;
  };
  let index = 0;
  let command = null;
  let pen = null;
  const point = () => {
    const pair = [Number(tokens[index++]), Number(tokens[index++])];
    assert.ok(pair.every(Number.isFinite), `a coordinate with no partner in ${d}`);
    return pair;
  };
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    else assert.ok(command !== null && command !== "Z", `a number no command takes in ${d}`);
    if (command === "Z") continue;
    if (command === "M" || command === "L") {
      pen = at(point());
      note(pen);
    } else if (command === "Q") {
      const control = at(point());
      const end = at(point());
      const ex = extremum(pen[0], control[0], end[0]);
      const ey = extremum(pen[1], control[1], end[1]);
      if (ex !== null) note([ex, pen[1]]);
      if (ey !== null) note([pen[0], ey]);
      note(end);
      pen = end;
    } else {
      throw new Error(`a path command this measurement does not read: ${command}`);
    }
  }
  return box;
}
/** Each ops array's ink in the button's own px, per roles: measured once, whatever the frame puts the button at. */
const localInk = new WeakMap();
/** A drawn button's ink over its ops of these roles (`label`, the build's word; `ammo`, the arrow count; null, every op), in canvas px. */
function inkOf(button, roles = null) {
  const ops = button.ops ?? [];
  let byRoles = localInk.get(ops);
  if (!byRoles) localInk.set(ops, (byRoles = new Map()));
  const key = roles ? roles.join(" ") : "*";
  if (!byRoles.has(key)) {
    let box = null;
    for (const op of ops) {
      if (roles && !roles.includes(op.button)) continue;
      assert.equal(op.kind, "path", `${button.slot}: an op this measurement does not read`);
      const path = pathInk(op.d, op.matrix);
      // A stroked op (the painter strokes after its matrix, `paintLayerOperation`) reaches half its width further:
      // 246 of the 1,842 ops the row's items paint are, up to 1 px of 116's own a side.
      const half = op.stroke && op.strokeWidth > 0 ? (op.strokeWidth / 2) * Math.max(Math.hypot(op.matrix[0], op.matrix[1]), Math.hypot(op.matrix[2], op.matrix[3])) : 0;
      const ink = { x0: path.x0 - half, x1: path.x1 + half, y0: path.y0 - half, y1: path.y1 + half };
      box = box ? { x0: Math.min(box.x0, ink.x0), x1: Math.max(box.x1, ink.x1), y0: Math.min(box.y0, ink.y0), y1: Math.max(box.y1, ink.y1) } : ink;
    }
    byRoles.set(key, box);
  }
  const box = byRoles.get(key);
  if (!box) return null;
  // The button's own px to the canvas: its disc's centre on its x/y, at its scale (positive, so the corners stay put).
  return {
    x0: button.x + (box.x0 - button.centre.x) * button.scale,
    x1: button.x + (box.x1 - button.centre.x) * button.scale,
    y0: button.y + (box.y0 - button.centre.y) * button.scale,
    y1: button.y + (box.y1 - button.centre.y) * button.scale
  };
}
/**
 * HOW FAR A WORD'S GLOW REACHES PAST ITS INK, in the button's own px: the
 * build's filter on 860's text placements (a glow, `blurX` 2, `blurY` 2, one
 * pass, strength 10 on every one), whose box blur spreads `passes x blur / 2`
 * each way. Read off the pack, not typed.
 */
function glowReachOf(icons) {
  let reach = 0;
  for (const frame of icons.buttons.clips[icons.buttons.button].frames) {
    for (const placement of frame) {
      if (placement.kind !== "text") continue;
      for (const filter of placement.filters ?? []) {
        const passes = Number.isFinite(filter.passes) ? filter.passes : 1;
        reach = Math.max(reach, (passes * filter.blurX) / 2, (passes * filter.blurY) / 2);
      }
    }
  }
  return reach;
}
const grown = (box, by) => ({ x0: box.x0 - by, x1: box.x1 + by, y0: box.y0 - by, y1: box.y1 + by });
const boxesMeet = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const discMeets = (disc, box) => Math.hypot(disc.x - Math.min(Math.max(disc.x, box.x0), box.x1),
  disc.y - Math.min(Math.max(disc.y, box.y0), box.y1)) < disc.r;

/* ------------------------------------------------------------------ */
/* The arena's own geometry                                            */
/* ------------------------------------------------------------------ */

/** The `_yscale` a fighter is drawn at, his colossus or little-fat-kid spell applied (S5's reading). */
function yscaleOf(host, id) {
  const record = host.combatant(id);
  const built = ss2PhysicalSize(record);
  return resourceValue(record, "spell_colossus", 0) > 0 ? ss2ColossusYscaleAfter(built, 100)
    : resourceValue(record, "spell_little_fat_kid", 0) > 0 ? 50 : built;
}
/**
 * THE ARENA'S CAMERA as `stepCamera` feeds it: every placed fighter as
 * `placedActors()` hands him over, nobody mid-clip, and — in a team bout — the
 * in-frame HUD's top (`combatHudFrameFor`'s `cameraHudTop`, laid out with the
 * gauges the pack draws), run until it settles.
 */
function arenaCamera(host, icons) {
  const layout = combatPanelLayoutFor({
    sides: host.wire().teams.map((team) => ({ teamId: team.id, ids: [...team.combatants].sort((a, b) => a.slotIndex - b.slotIndex).map((c) => c.id) })),
    pack: combatHudArtFor(icons).pack
  });
  const hudTop = layout.mode === "team" && Number.isFinite(layout.hudTop) ? layout.hudTop : null;
  const roster = host.wire().teams.flatMap((team) => team.combatants).filter((c) => Number.isFinite(c.x)).map((c) => {
    const placement = host.layout.placementFor(c.id);
    return {
      id: c.id, x: c.x, y: c.y, yscale: yscaleOf(host, c.id), ...actorSpanFor({ x: c.x, y: c.y }, null),
      side: placement?.side ?? null, teamId: placement?.teamId ?? null, alive: c.alive !== false, drawing: false
    };
  });
  let frame = null;
  for (let step = 0; step < 300; step += 1) frame = stepFramedCamera(frame, roster, { result: host.battle.result ?? null, hudTop });
  return frame.camera;
}
/** Where `paintRing` stands the ring and what it reads off the drawn fighter, in the arena's view on a 640 x 420 canvas. */
function arenaRingPlace(host, model, icons) {
  const everyone = host.wire().teams.flatMap((team) => team.combatants);
  const camera = arenaCamera(host, icons);
  const fit = stageFitFor({ width: 640, height: 420 });
  const view = stageProjectorFor(camera, fit);
  const stage = ringBoundsFor(fit, { barred: true });
  const actor = everyone.find((c) => c.id === model.actorId);
  const placement = ringPlacementFor({ actor, foe: everyone.find((c) => c.id === model.selectedId), camera, view, fit });
  const size = figureScaleFor({
    yscale: yscaleOf(host, actor.id),
    rank: rankOfDepth(actor.y, actor.slotIndex, { frontY: 200, rankStride: SS2_ARENA.rankStride }),
    slotIndex: actor.slotIndex
  });
  const box = fighterBoxFor({ footX: view.toX(actor.x), footY: view.toY(actor.y, 0), pxPerUnit: view.scale, size });
  const below = view.toY(actor.y, -22) + Math.max(10, view.scale * 15) * 0.5;
  return { placement, stage, head: box.y0, below };
}

/* ------------------------------------------------------------------ */
/* 1. The owner's report, on a real arena turn                         */
/* ------------------------------------------------------------------ */

test("THE OWNER'S REPORT, ON A REAL ARENA TURN: the spell row covered the bow's BOMBARD — handed the words the eight carry, the whole row stands the ring's own gap above them, and no place, drawn or clicked, touches the word or its glow", (t) => {
  const real = realPacks(t);
  if (!real) return;
  const { icons, pack, textPack } = real;
  // `?play=red&teams=2&items=tricks`, seed 1, ten AI submissions in: red-2, the demo roster's archer (slot 2),
  // on the long bow frame facing right with blue-1 selected — bombard in optionD, snipe in optionF — and the
  // tricks kit's spells on the row, Q-T (slot 6's weaken armour is spent).
  const host = played(demoHost({ perSide: 2, seed: 1, kit: "tricks" }), 10);
  const model = modelOf(host, "blue-1");
  assert.deepEqual([model.actorId, model.stance.frame, model.stance.facing], ["red-2", "longrange_archer", "right"]);
  assert.deepEqual(model.slots.filter((slot) => slot.action).map((slot) => `${slot.slot} ${slot.verb}`),
    ["optionB walkleft", "optionG wincrowd", "optionD bombardright", "optionE walkright", "optionF sniperight"]);
  assert.deepEqual(model.items.filter((item) => item.action).map((item) => `${item.key} ${item.itemId}`), ["Q 36", "W 37", "E 38", "R 48", "T 39"]);

  const { placement, stage, head, below } = arenaRingPlace(host, model, icons);
  const at = { centerX: placement.x, centerY: placement.y, unit: placement.unit, layout: pack.layout };
  const bounds = { top: stage.y, bottom: stage.y + stage.height };
  const art = { pack, facing: "right", psyche: resourceValue(host.combatant("red-2"), "psyche_up", 1), ammo: resourceValue(host.combatant("red-2"), "ammo_left", 0), textPack };
  assert.equal(art.ammo, 5, "five arrows left");
  // The eight, drawn where the build puts them (the ring on red-2 at (58.40, 233.16), 0.96 canvas px an overlay
  // px), before the ring is kept on the stage.
  assert.deepEqual([placement.x, placement.y, placement.unit].map((value) => Math.round(value * 100) / 100), [58.4, 233.16, 0.96]);
  const eight = ringButtonArt(ringButtonsAt(model, at), art);
  const bombard = eight.find((button) => button.slot === "optionD");
  assert.equal(bombard.verb, "bombardright");
  // THE WORD, measured off the ops the page paints: BOMBARD (static 852 at (-71.65, -30.4) px of 860 frame 25) in
  // the build's glyphs, optionD standing at (58.4 + 55.05 x 0.96, 233.16 - 37.95 x 0.96) = (111.248, 196.728) at
  // 0.768 canvas px a button px — its ink from x 91.15 to 131.51 and y 175.51 to 181.21, over the disc's top
  // (196.728 - 18 x 0.768 = 182.90).
  const word = inkOf(bombard, ["label"]);
  assert.deepEqual([word.x0, word.x1, word.y0, word.y1].map((value) => Math.round(value * 100) / 100), [91.15, 131.51, 175.51, 181.21]);
  const count = inkOf(bombard, ["ammo"]);
  assert.ok(count && count.y0 > word.y1, "the arrow count, at the disc's centre, under the word");

  // THE REPORT, REPRODUCED: at the build's own place (no words handed in), T — the fifth place, slot 3's
  // command (39) — stands at (58.4 + 38.55 x 0.96, 233.16 - 69.05 x 0.96) = (95.408, 166.872), r 18 x 0.6 x 0.96
  // = 10.368: its disc's foot at 177.24 is 1.73 px into the word's top, and the row is painted after the eight.
  const build = ringItemButtonsAt(model, { ...at, rowLayout: pack.inventory.layout, head, bounds });
  const buildT = build.find((place) => place.key === "T");
  assert.deepEqual([buildT.x, buildT.y, buildT.r].map((value) => Math.round(value * 1000) / 1000), [95.408, 166.872, 10.368]);
  assert.ok(discMeets(buildT, word), "the build's own row covers the word");

  // HANDED THE WORDS THE EIGHT CARRY, the whole row rises the least that stands every place the ring's own gap
  // (the tightest pitch, B-C 31.45 overlay px in this pack, less two radii of 18 x 0.79999: 2.650 overlay px,
  // 2.544 canvas px) above every word under it. T's foot must be at 175.508 - 2.544 = 172.963: up 4.277, every
  // place to y 162.595. (The count, from x 108.98, is under no place: T's column and gap end at 108.32.)
  const words = eight.flatMap((button) => [inkOf(button, ["label"]), inkOf(button, ["ammo"])]).filter(Boolean);
  const row = ringItemButtonsAt(model, { ...at, rowLayout: pack.inventory.layout, head, bounds, words });
  assert.deepEqual(row.map((place) => place.key), ["Q", "W", "E", "R", "T"]);
  assert.deepEqual(row.map((place) => Math.round(place.y * 1000) / 1000), [162.595, 162.595, 162.595, 162.595, 162.595]);
  assert.deepEqual(row.map((place) => place.x), build.map((place) => place.x), "the row rises; nothing moves sideways");

  // AS THE PAGE DRAWS IT: the row, the swap and the moves drawn, the whole ring kept on the visible stage.
  const drawn = ringButtonsInside([
    ...eight,
    ...ringButtonArt([
      ...row,
      ...ringSwapButtonAt(model, at),
      ...ringMoveButtonsAt(model, { ...at, head, feet: below, bounds })
    ], art)
  ], stage, { fighterX: placement.x });
  const shown = drawn.find((button) => button.slot === "optionD");
  const glow = glowReachOf(icons) * shown.scale;
  assert.equal(glowReachOf(icons), 1, "the build's glow: blurX 2, one pass");
  const visible = grown(inkOf(shown, ["label"]), glow);
  for (const place of drawn.filter((button) => button.verb === "item")) {
    assert.ok(!discMeets(place, visible), `${place.key}'s disc (${place.x.toFixed(2)}, ${place.y.toFixed(2)}) r ${place.r.toFixed(2)} touches the word`);
    assert.ok(!boxesMeet(inkOf(place), visible), `${place.key}'s drawn item touches the word`);
  }
});

/* ------------------------------------------------------------------ */
/* 2. The rule, worked by hand (no pack)                               */
/* ------------------------------------------------------------------ */

/** A model with every place of the row filled (S5's test row), on the close warrior frame. */
function fullRow() {
  const ids = { inventory_button1: 38, inventory_button2: 48, inventory_button3: 39, inventory_button4: 37, inventory_button5: 36, inventory_button6: 44 };
  const order = ["inventory_button5", "inventory_button4", "inventory_button1", "inventory_button2", "inventory_button3", "inventory_button6"];
  return {
    stance: { frame: "closerange_warrior", range: "close", weapon: "warrior", facing: "right" },
    slots: [],
    moves: [],
    swap: null,
    items: order.map((slot, index) => ({
      key: "QWERTY"[index], slot, inventory: slot.replace("_button", ""), itemId: ids[slot], verb: "item", words: "", action: { type: "cast-gale" }
    }))
  };
}
/** The row's one height (it rises as one) at centre (300, 200), 2 canvas px an overlay px, from the relayed tables. */
function rowY(words, { head = 200, bounds = null } = {}) {
  const ys = [...new Set(ringItemButtonsAt(fullRow(), { centerX: 300, centerY: 200, unit: 2, head, bounds, words })
    .map((place) => Math.round(place.y * 1e9) / 1e9))];
  assert.equal(ys.length, 1, "one row, one height");
  return ys[0];
}

test("THE RULE: a word under a place lifts the WHOLE ROW the least that stands that place the ring's own gap above it; a word beside the row, or wholly above it, lifts nothing", () => {
  // Worked by hand (S5's numbers): at (300, 200) and unit 2 the six discs stand at x 175.5, 225.9, 276.3, 326.7,
  // 377.1, 427.5, all at y 61.9, r 21.6 — their feet at 83.5. The ring's gap: the tightest pitch (B-C, 31.5
  // overlay px) less two radii of 18 x 0.8, times 2: 5.4. The head at 200 puts the step-back arrow's top at 137,
  // which the row clears: no lift for it.
  assert.equal(rowY([]), 61.9, "no word, the build's place");
  assert.equal(rowY(undefined), 61.9);
  // Under E (x 276.3, its column 254.7..297.9): E's foot must be at 80 - 5.4 = 74.6, so the row rises 8.9.
  assert.equal(rowY([{ x0: 270, x1: 290, y0: 80, y1: 90 }]), 53);
  // Several: the one that needs the most. A word under Q (175.5) whose top is at 70 needs 18.9.
  assert.equal(rowY([{ x0: 270, x1: 290, y0: 80, y1: 90 }, { x0: 160, x1: 170, y0: 70, y1: 75 }]), 43);
  // Beside the row: Y's column ends at 427.5 + 21.6 = 449.1, and the gap takes it to 454.5; a word from 455 is
  // under nothing, however high it reaches.
  assert.equal(rowY([{ x0: 455, x1: 470, y0: 40, y1: 80 }]), 61.9);
  // ...but one within that gap of Y's column is under it: Y's foot to 70 - 5.4, a rise of 18.9.
  assert.equal(rowY([{ x0: 452, x1: 470, y0: 70, y1: 80 }]), 43);
  // Wholly above a place, by the gap (E's top 40.3, less 5.4: 34.9), a word is not under it: the row does not rise past it.
  assert.equal(rowY([{ x0: 270, x1: 290, y0: 20, y1: 34.9 }]), 61.9);
  // A box that is not four numbers is no word.
  assert.equal(rowY([{ x0: 270, x1: 290, y0: Number.NaN, y1: 90 }, null, { x0: 270 }]), 61.9);
});

test("THE RULE AND THE OWNER'S LAYOUT (S5): above the step-back arrow AND above every word — the larger of the two lifts, never their sum", () => {
  // Head 120 (S5's worked case): the arrow at 85.8, its top 57, so the row's foot at most 51.6 — the row at 30.
  assert.equal(rowY([], { head: 120 }), 30);
  // A word needing less (the row to 53) changes nothing; one needing more (its top at 40: E's foot to 34.6, the
  // row to 13) wins.
  assert.equal(rowY([{ x0: 270, x1: 290, y0: 80, y1: 90 }], { head: 120 }), 30);
  assert.equal(rowY([{ x0: 270, x1: 290, y0: 40, y1: 50 }], { head: 120 }), 13);
  // Only the row moves: the arrow stands where S4 puts it, whatever the words.
  const model = { ...fullRow(), moves: [{ move: "rank-back", key: "ArrowUp", verb: "rank_back", place: "above-head", slot: null, action: { type: "rank-back" } }] };
  const at = { centerX: 300, centerY: 200, unit: 2, head: 120, feet: 400 };
  assert.deepEqual(ringMoveButtonsAt(model, at).map((arrow) => arrow.y), [85.8]);
});

/* ------------------------------------------------------------------ */
/* 3. The words the eight carry, read off what the page paints         */
/* ------------------------------------------------------------------ */

const square = (size) => `M0 ${-size}L${size} ${-size}L${size} 0L0 0Z`;

test("THE WORDS A BUTTON PAINTS, WHERE IT PAINTS THEM: one box per button for the build's word and one for the arrow count — the exact ink of their glyphs, in canvas px — and nothing for the art", () => {
  // Worked by hand. A button at (100, 200), 2 canvas px a button px, its disc centred on its origin. Its word:
  // two 10 px glyphs at (10, -20) and (20, -20) px (translations in twips: 200 and 400, -400) — ink x 10..30,
  // y -30..-20 — so x 100 + 2 x 10 = 120 to 160 and y 200 - 60 = 140 to 160. Its count: one 4 px glyph at
  // (-2, 2) px, ink x -2..2, y -2..2 — so 96 to 104 and 196 to 204. The background and the icon are not words.
  const button = {
    slot: "optionD", verb: "bombardright", x: 100, y: 200, scale: 2, centre: { x: 0, y: 0 },
    ops: [
      { kind: "path", d: "M-18 -18L18 -18L18 18L-18 18Z", matrix: [1, 0, 0, 1, 0, 0] },
      { kind: "path", d: square(10), matrix: [1, 0, 0, 1, 200, -400], button: "label" },
      { kind: "path", d: square(10), matrix: [1, 0, 0, 1, 400, -400], button: "label" },
      { kind: "path", d: square(4), matrix: [1, 0, 0, 1, -40, 40], button: "ammo" }
    ]
  };
  const bare = { slot: "optionB", verb: "walkleft", x: 50, y: 200, scale: 2, centre: { x: 0, y: 0 }, ops: [{ kind: "path", d: square(18), matrix: [1, 0, 0, 1, 0, 0] }] };
  assert.deepEqual(ringWordBoxesOf([bare, button]).map((box) => ({ ...box })), [
    { slot: "optionD", verb: "bombardright", word: "label", x0: 120, x1: 160, y0: 140, y1: 160 },
    { slot: "optionD", verb: "bombardright", word: "ammo", x0: 96, x1: 104, y0: 196, y1: 204 }
  ]);
  assert.deepEqual(ringWordBoxesOf([bare]), [], "a walk carries no word");
  assert.deepEqual(ringWordBoxesOf([]), []);
  assert.deepEqual(ringWordBoxesOf(null), []);
});

test("A ROUND LETTER'S INK IS ITS CURVE, NOT ITS CONTROL POINTS; the glyph's own matrix and the disc's centre (116's (18.25, 18.25)) are applied", () => {
  // Worked by hand. `M0 0 Q10 -20 20 0 Z` is an arch whose control point is at -20 but whose top is at t = 1/2:
  // 2 x 0.5 x 0.5 x -20 = -10. Under the glyph's matrix [0.5, 0, 0, 0.5] at (100, 60) twips = (5, 3) px it runs
  // x 5..15 and y -2..3; the button centres its disc at (18.25, 18.25) of its own px and stands at (0, 0),
  // 4 canvas px a button px: x 4 x (5 - 18.25) = -53 to 4 x (15 - 18.25) = -13, y 4 x (-2 - 18.25) = -81 to
  // 4 x (3 - 18.25) = -61.
  const arch = {
    slot: "optionA", verb: "power_attack", x: 0, y: 0, scale: 4, centre: { x: 18.25, y: 18.25 },
    ops: [{ kind: "path", d: "M0 0Q10 -20 20 0Z", matrix: [0.5, 0, 0, 0.5, 100, 60], button: "label" }]
  };
  assert.deepEqual(ringWordBoxesOf([arch]).map(({ x0, x1, y0, y1 }) => [x0, x1, y0, y1]), [[-53, -13, -81, -61]]);
  // A glyph the font lacks is drawn as a stroked `.notdef` box (`src/render/text.js`): its ink is the box and half
  // its stroke. `M1 -8 L9 -8 L9 0 L1 0 Z`, stroked 1 px wide, at scale 1 on a button at (0, 0): x 0.5..9.5, y -8.5..0.5.
  const notdef = {
    slot: "optionD", verb: "bombardright", x: 0, y: 0, scale: 1, centre: { x: 0, y: 0 },
    ops: [{ kind: "path", d: "M1 -8L9 -8L9 0L1 0Z", matrix: [1, 0, 0, 1, 0, 0], fill: null, stroke: "#ffffff", strokeWidth: 1, button: "label", notdef: true }]
  };
  assert.deepEqual(ringWordBoxesOf([notdef]).map(({ x0, x1, y0, y1 }) => [x0, x1, y0, y1]), [[0.5, 9.5, -8.5, 0.5]]);
  // A SWF font's edges are straight or quadratic: a path this does not read is said, not guessed at — a cubic, a
  // number no command takes (after a close, or first), a coordinate with no partner.
  const path = (d) => ({ ...notdef, ops: [{ kind: "path", d, matrix: [1, 0, 0, 1, 0, 0], button: "label" }] });
  for (const d of ["M0 0C1 1 2 2 3 3", "M0 0L4 0L4 4Z 5 5", "5 5L1 1", "M0 0L4"]) {
    assert.throws(() => ringWordBoxesOf([path(d)]), /does not read/, d);
  }
});

test("THE ARROW COUNT IN THE PAGE'S OWN FONT (a text pack with no glyphs for the field): its box is a whole em a figure and the em's height, centred where it is drawn, plus its outline — larger than the ink, never smaller", () => {
  // Worked by hand. "12" at (5, 3) of the button's px, 10 px, outlined max(1, 10 / 7) = 1.4286 wide (the page's
  // `paintRingButton`): 2 em by 1 em round (5, 3) — x -5..15, y -2..8 — and half the outline, 0.7143, all round;
  // at scale 1 on a button at (0, 0): the same numbers.
  const count = {
    slot: "optionF", verb: "sniperight", x: 0, y: 0, scale: 1, centre: { x: 0, y: 0 },
    ops: [{ kind: "text", text: "12", x: 5, y: 3, size: 10, fill: "#ffffff", outline: "#000000", alpha: 1, role: "ammo", button: "ammo" }]
  };
  const [box] = ringWordBoxesOf([count]);
  assert.equal(box.word, "ammo");
  assert.deepEqual([box.x0, box.x1, box.y0, box.y1].map((value) => Math.round(value * 1e4) / 1e4), [-5.7143, 15.7143, -2.7143, 8.7143]);
});

test("ON THE PLAYER'S PACK: every word and count the build's buttons paint — POWER, NORMAL, QUICK, SNIPE, BASH, BOMBARD, and the arrows — is boxed exactly where this file measures it, in both facings and every state; with no text pack, the count alone, in the page's font", (t) => {
  const real = realPacks(t);
  if (!real) return;
  const { pack, textPack } = real;
  const verbs = ["power_attack", "normal_attack", "quick_attack", "bash_attack", "bombardleft", "bombardright", "snipeleft", "sniperight"];
  let boxes = 0;
  for (const verb of verbs) {
    for (const facing of ["right", "left"]) {
      for (const ammo of [0, 7, 12, 150]) {
        for (const reason of [null, { code: "other-rank", words: "…" }]) {
          for (const hoverSlot of [null, "optionD"]) {
            const button = { slot: "optionD", verb, x: 311.5, y: 207.25, r: 13.8, scale: 0.9 * 1.2, side: "right", ...(reason ? { reason } : {}) };
            const [drawn] = ringButtonArt([button], { pack, textPack, facing, ammo, hoverSlot });
            assert.equal(drawn.source, "build");
            const expected = [["label", inkOf(drawn, ["label"])], ["ammo", inkOf(drawn, ["ammo"])]].filter(([, box]) => box);
            const said = `${verb} facing ${facing}, ${ammo} arrows, ${drawn.state}`;
            assert.equal(expected.length, verb.startsWith("bombard") || verb.startsWith("snipe") ? 2 : 1, said);
            const got = ringWordBoxesOf([drawn]);
            assert.deepEqual(got.map((box) => box.word), expected.map(([word]) => word), said);
            got.forEach((box, index) => {
              const want = expected[index][1];
              for (const edge of ["x0", "x1", "y0", "y1"]) assert.ok(Math.abs(box[edge] - want[edge]) < 1e-9, `${said}: ${box.word} ${edge} ${box[edge]} against ${want[edge]}`);
            });
            boxes += got.length;
          }
        }
      }
    }
  }
  assert.equal(boxes, 8 * 2 * 4 * 2 * 2 + 4 * 2 * 4 * 2 * 2);
  // Without the text pack the build's WORD is counted, never drawn (S3) — but the count is, in the page's own
  // font at the centre of its field (`ammo_left`, 855 on frame 25: x 66.9..92.6, y -2..16.4 of its own px, placed
  // at (-79.75, -7.2) px — its centre on the disc's), 12 px: "7", one figure, is boxed 12 by 12 and half an
  // outline of max(1, 12 / 7) all round, 6.857 each way of (0, 0). Without the icons pack every button is the
  // authored one, whose label stands beside it on the stage, not on it.
  const bombard = { slot: "optionD", verb: "bombardright", x: 0, y: 0, r: 14, scale: 1, side: "right" };
  const plain = ringWordBoxesOf(ringButtonArt([bombard], { pack, textPack: null, ammo: 7 }));
  assert.deepEqual(plain.map(({ word, x0, x1, y0, y1 }) => [word, ...[x0, x1, y0, y1].map((value) => Math.round(value * 1000) / 1000)]),
    [["ammo", -6.857, 6.857, -6.857, 6.857]]);
  assert.deepEqual(ringWordBoxesOf(ringButtonArt([bombard], { pack: null, textPack, ammo: 7 })), []);
});

/* ------------------------------------------------------------------ */
/* 4. The shell hands the row the words (read as text)                 */
/* ------------------------------------------------------------------ */

/**
 * `tools/arena/main.js` cannot be imported by node, so — as the other ring tests do — `paintRing` is pinned as
 * text, comments and strings blanked first.
 */
const rawShell = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
const shell = rawShell
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
function functionBody(name) {
  const start = shell.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is not defined in tools/arena/main.js`);
  let depth = 0;
  for (let index = shell.indexOf("{", start); index < shell.length; index += 1) {
    if (shell[index] === "{") depth += 1;
    else if (shell[index] === "}") { depth -= 1; if (depth === 0) return shell.slice(start, index + 1); }
  }
  throw new Error(`${name}'s braces do not balance`);
}

test("THE SHELL: the eight are drawn first and the row is handed the words they paint — read off that very art, which is what is painted — then the row, the swap and the moves are drawn, and the whole ring kept on the stage; each button's art is built once", () => {
  const paint = functionBody("paintRing");
  assert.match(rawShell, /import \{ ringButtonArt, ringWordBoxesOf \} from "\/tools\/arena\/ring-art\.js";/);
  // One set of art options for every button, the acting fighter's own counters.
  assert.match(paint, /const actor = host\.combatant\(ringView\.actorId\);\s*const art = \{\s*pack: ringButtonPack,\s*facing: ringView\.model\.stance\?\.facing \?\? "",\s*hoverSlot: ringHover,\s*psyche: resourceValue\(actor, "", 1\),\s*ammo: resourceValue\(actor, "", 0\),\s*textPack\s*\};/);
  assert.match(paint, /const eight = ringButtonArt\(ringButtonsAt\(ringView\.model, \{[^}]*centerX: placement\.x,[^}]*centerY: placement\.y,[^}]*unit: placement\.unit,[^}]*layout: ringButtonPack\?\.layout \?\? null[^}]*\}\), art\);/);
  assert.match(paint, /const buttons = ringButtonsInside\(\[\s*\.\.\.eight,\s*\.\.\.ringButtonArt\(\[\s*\.\.\.ringItemButtonsAt\(ringView\.model, \{[^}]*head: ringOrigins\.actor\.head,[^}]*bounds: \{ top: stage\.y, bottom: stage\.y \+ stage\.height \},\s*words: ringWordBoxesOf\(eight\)\s*\}\),\s*\.\.\.ringSwapButtonAt\([\s\S]*?\.\.\.ringMoveButtonsAt\([\s\S]*?\}\)\s*\], art\)\s*\], stage, \{ fighterX: placement\.x \}\);/);
  assert.match(paint, /ringButtons = buttons;\s*const drawn = buttons;/, "the click is tested, and the labels placed, where the art is painted");
  assert.equal((paint.match(/ringButtonArt\(/g) ?? []).length, 2, "the eight's art, then the rest's: none built twice");
  assert.equal((paint.match(/ringWordBoxesOf\(/g) ?? []).length, 1);
});

/* ------------------------------------------------------------------ */
/* 5. Acceptance: whole seeded bouts, both views, every zoom           */
/* ------------------------------------------------------------------ */

/** The in-frame HUD's layout for a bout, laid out with the gauges the pack draws (`combatHudFrameFor`'s). */
function hudLayoutOf(host, icons) {
  return combatPanelLayoutFor({
    sides: host.wire().teams.map((team) => ({ teamId: team.id, ids: [...team.combatants].sort((a, b) => a.slotIndex - b.slotIndex).map((c) => c.id) })),
    pack: combatHudArtFor(icons).pack
  });
}
/** What a turn's rings read off the host, read once: the wire's fighters, the offer, each one's drawn size, the actor's record. */
function turnOf(host) {
  const everyone = host.wire().teams.flatMap((team) => team.combatants);
  const actorId = host.currentCombatantId();
  return {
    actorId,
    everyone,
    legal: host.legalActions(),
    yscale: new Map(everyone.map((c) => [c.id, yscaleOf(host, c.id)])),
    record: host.combatant(actorId)
  };
}
/** The ring for the actor with `previous` selected, as the shell reads it — off the turn's one reading of the host. */
function modelFor(host, turn, previous = null) {
  return ringModelFor({
    actorId: turn.actorId,
    combatants: turn.everyone,
    legal: turn.legal,
    previous,
    menuFor: (targetId) => host.unavailableActions(turn.actorId, targetId)
  });
}
/** Every placed fighter as `placedActors()` hands him to the camera, nobody mid-clip. */
function cameraRoster(host, turn) {
  return turn.everyone.filter((c) => Number.isFinite(c.x)).map((c) => {
    const placement = host.layout.placementFor(c.id);
    return {
      id: c.id, x: c.x, y: c.y, yscale: turn.yscale.get(c.id), ...actorSpanFor({ x: c.x, y: c.y }, null),
      side: placement?.side ?? null, teamId: placement?.teamId ?? null, alive: c.alive !== false, drawing: false
    };
  });
}
/**
 * THE RING AS `paintRing` DRAWS IT (this slice's composition) in a view — the arena's (`camera` given) or the
 * fitted one — with the row also laid out handed no words (the build's place, S5) and handed only the BOMBARD
 * words, for the comparisons. `kept` holds each button's art for the selection being swept: a button's ops are in
 * its own px whatever the zoom (only its glow's blur is built at the zoom, and no box here reads it), so the art
 * is drawn once a selection and put where each frame's layout puts it; the sweep checks it against art drawn afresh.
 */
function drawnRing(model, { turn, view, fit, camera, stage, pack, textPack, kept = null }) {
  const actor = turn.everyone.find((c) => c.id === model.actorId);
  const placement = ringPlacementFor({ actor, foe: turn.everyone.find((c) => c.id === model.selectedId), camera, view, fit });
  const size = figureScaleFor({
    yscale: turn.yscale.get(actor.id),
    rank: rankOfDepth(actor.y, actor.slotIndex, { frontY: 200, rankStride: SS2_ARENA.rankStride }),
    slotIndex: actor.slotIndex
  });
  const head = fighterBoxFor({ footX: view.toX(actor.x), footY: view.toY(actor.y, 0), pxPerUnit: view.scale, size }).y0;
  const below = view.toY(actor.y, -22) + Math.max(10, view.scale * 15) * 0.5;
  const at = { centerX: placement.x, centerY: placement.y, unit: placement.unit, layout: pack.layout };
  const bounds = { top: stage.y, bottom: stage.y + stage.height };
  const art = { pack, facing: model.stance?.facing ?? "right", psyche: resourceValue(turn.record, "psyche_up", 1), ammo: resourceValue(turn.record, "ammo_left", 0), textPack };
  const draw = (buttons) => (kept
    ? buttons.map((button) => {
      const key = `${button.slot} ${button.verb} ${button.reason?.code ?? ""} ${button.usingBow ?? ""} ${button.itemId ?? ""}`;
      if (!kept.has(key)) kept.set(key, ringButtonArt([button], art)[0]);
      const { state, ops, source, centre } = kept.get(key);
      return Object.freeze({ ...button, state, ops, source, centre });
    })
    : ringButtonArt(buttons, art));
  const eight = draw(ringButtonsAt(model, at));
  const words = ringWordBoxesOf(eight);
  const rowAt = (handed) => ringItemButtonsAt(model, { ...at, rowLayout: pack.inventory.layout, head, bounds, words: handed });
  const row = rowAt(words);
  const buttons = ringButtonsInside([
    ...eight,
    ...draw([...row, ...ringSwapButtonAt(model, at), ...ringMoveButtonsAt(model, { ...at, head, feet: below, bounds })])
  ], stage, { fighterX: placement.x });
  // A place under the pointer is drawn on its over frame (the row's own rollover), which may reach further.
  const hovered = kept ?? new Map();
  const hoveredOf = (place) => {
    const key = `pointed ${place.slot} ${place.itemId} ${place.reason?.code ?? ""}`;
    if (!hovered.has(key)) hovered.set(key, ringButtonArt([place], { ...art, hoverSlot: place.slot })[0]);
    const { state, ops, source, centre } = hovered.get(key);
    return Object.freeze({ ...place, state, ops, source, centre });
  };
  return {
    buttons, row, unit: placement.unit, hoveredOf,
    build: rowAt([]),
    bombardOnly: rowAt(words.filter((word) => /^bombard/.test(word.verb)))
  };
}
/** The key labels as `paintRing` places them, in paint order (a letter 0.6 em wide, a slot's label 0.55 em a character over 7: node has no canvas). */
function labelBoxesOf(buttons, stage) {
  const taken = [];
  const out = new Map();
  for (const button of ringPaintOrder(buttons)) {
    if (button.move || button.reason) continue;
    const { px, gap } = ringLabelSizeFor(button.r);
    const size = { width: button.verb === "item" ? px * 0.6 : px * 0.55 * 7, height: px, gap };
    const at = ringLabelAt(button, buttons, size, { stage, taken });
    const box = ringLabelBoxOf(at, size);
    taken.push(box);
    out.set(button, { box, below: at.y > button.y });
  }
  return out;
}

test("ACCEPTANCE, over whole seeded bouts with every foe selected in turn, in the arena's camera at every zoom it eases through and in the fitted view: no place of the items row — its disc, its drawn item or its letter — touches a word or arrow count the eight paint, glow included; the row rises only where a BOMBARD is under it, and a ring it moves stays on the stage with no button on another; the bouts' actions and hashes are those of the same bouts never read", (t) => {
  const real = realPacks(t);
  if (!real) return;
  const { icons, pack, textPack } = real;
  const glow = glowReachOf(icons);
  const EPS = 1e-9;
  const tally = {
    bouts: 0, turns: 0, selections: 0, bowRowSelections: 0, rings: 0, easedRings: 0, zoomsSeen: 0, rowRings: 0, bowRowRings: 0, bombardUnderRow: 0,
    liftedRings: 0, liftedArena: 0, liftedFitted: 0, facings: {}, stances: {}, minClearance: Infinity, minHoverClearance: Infinity, maxLift: 0,
    lettersBelow: 0, wordsChecked: 0, countsChecked: 0, offStageUnmoved: 0
  };
  const fit = stageFitFor({ width: 640, height: 420 });
  const check = (ring, where, stage) => {
    const { buttons, row, build, bombardOnly } = ring;
    tally.rings += 1;
    // THE ROW RISES ONLY FOR A BOMBARD, and only as far as the BOMBARDs alone take it.
    assert.deepEqual(row.map((place) => [place.x, place.y]), bombardOnly.map((place) => [place.x, place.y]), `${where}: a word other than BOMBARD moved the row`);
    const lift = row.length > 0 ? build[0].y - row[0].y : 0;
    const places = buttons.filter((button) => button.verb === "item");
    if (places.length === 0) return;
    tally.rowRings += 1;
    const bows = buttons.filter((button) => /^(bombard|snipe)(left|right)$/.test(button.verb));
    if (bows.length > 0) tally.bowRowRings += 1;
    if (lift > EPS) {
      const bombard = bows.find((button) => /^bombard/.test(button.verb));
      assert.ok(bombard, `${where}: the row rose with no bombard drawn`);
      tally.liftedRings += 1;
      tally.facings[bombard.verb] = (tally.facings[bombard.verb] ?? 0) + 1;
      tally.maxLift = Math.max(tally.maxLift, lift / ring.unit);
    }
    // No place of the row touches a word or a count, measured here off the ops the page paints, grown by its glow.
    const labels = labelBoxesOf(buttons, stage);
    const items = new Map(places.map((place) => [place, inkOf(place)]));
    const pointedAt = new Map(places.map((place) => [place, inkOf(ring.hoveredOf(place))]));
    for (const button of buttons) {
      for (const word of ["label", "ammo"]) {
        const ink = inkOf(button, [word]);
        if (!ink) continue;
        const visible = grown(ink, glow * button.scale);
        if (word === "label") tally.wordsChecked += 1; else tally.countsChecked += 1;
        for (const place of places) {
          const said = `${where}: ${place.key} (${place.x.toFixed(2)}, ${place.y.toFixed(2)}) against ${button.slot} ${button.verb}'s ${word}`;
          assert.ok(!discMeets(place, visible), `${said}: the disc`);
          const drawnItem = items.get(place);
          assert.ok(!boxesMeet(drawnItem, visible), `${said}: the drawn item`);
          assert.ok(!boxesMeet(pointedAt.get(place), visible), `${said}: the drawn item under the pointer`);
          assert.ok(!boxesMeet(labels.get(place).box, visible), `${said}: the letter`);
          if (/^bombard/.test(button.verb) && word === "label" && drawnItem.x0 < visible.x1 && visible.x0 < drawnItem.x1) {
            tally.bombardUnderRow += 1;
            tally.minClearance = Math.min(tally.minClearance, (visible.y0 - drawnItem.y1) / ring.unit);
            tally.minHoverClearance = Math.min(tally.minHoverClearance, (visible.y0 - pointedAt.get(place).y1) / ring.unit);
          }
        }
      }
    }
    for (const place of places) if (labels.get(place).below) tally.lettersBelow += 1;
    // AND A RING THIS MOVES STAYS WHOLE: every button on the stage — a place with its letter's room — and none on
    // another. (A ring whose row does not rise is the one drawn before this slice, button for button — the
    // BOMBARD comparison above — and is held to S4-S9's rules by their own tests. It is not always whole: a
    // colossus's ring in a 1v1 at zoom 80 is taller than the stage left above the build's bar (D4), and its
    // rank-front arrow stands under the bar — counted here, `offStageUnmoved`, and reported, not this slice's.)
    const onStage = (button) => button.x - button.r >= stage.x - EPS && button.x + button.r <= stage.x + stage.width + EPS
      && button.y - button.r - (button.labelRoom ?? 0) >= stage.y - EPS && button.y + button.r <= stage.y + stage.height + EPS;
    if (lift <= EPS) {
      if (!buttons.every(onStage)) tally.offStageUnmoved += 1;
      return;
    }
    for (const button of buttons) {
      assert.ok(onStage(button), `${where}: ${button.slot} at (${button.x.toFixed(1)}, ${button.y.toFixed(1)}) leaves the stage`);
      for (const other of buttons) {
        if (other !== button) assert.ok(Math.hypot(other.x - button.x, other.y - button.y) >= other.r + button.r - EPS, `${where}: ${other.slot} overlaps ${button.slot}`);
      }
    }
  };
  // Kits that carry spells (the row) with the demo roster's archer in slot 2 (the bow): a 1v1 has no archer, and its
  // camera is the build's own; `buffs` casts colossus, whose row rises over the step-back arrow (S5).
  const runs = [
    ...["tricks", "buffs"].map((kit) => ({ perSide: 1, kit, seed: 1 })),
    ...[2, 3].flatMap((perSide) => ["tricks", "buffs", "crowd", "blasts"].flatMap((kit) => [1, 2].map((seed) => ({ perSide, kit, seed }))))
  ];
  for (const { perSide, kit, seed } of runs) {
    const name = `${perSide}v${perSide} ${kit || "plain"} seed ${seed}`;
    const host = demoHost({ perSide, seed, kit });
    const layout = hudLayoutOf(host, icons);
    const hudTop = layout.mode === "team" && Number.isFinite(layout.hudTop) ? layout.hudTop : null;
    let hash = host.hash();
    const sequence = [hash];
    let frame = null;
    for (let taken = 0; !host.battle.result; taken += 1) {
      assert.ok(taken < 1500, `${name} finished`);
      const turn = turnOf(host);
      const models = modelFor(host, turn).foeIds.map((foeId) => modelFor(host, turn, foeId));
      // THE ARENA'S CAMERA, stepped as the page steps it into this turn, from where it stood: every zoom a drawn
      // frame reaches (the fighters are drawn at ceil(zoomscale)%, so it moves in steps), until it has held one
      // zoom for 8 frames — the pan eases on, which carries the row and the words together.
      const roster = cameraRoster(host, turn);
      const zooms = new Map();
      for (let step = 0, held = 0; step < 120 && held < 8; step += 1) {
        frame = stepFramedCamera(frame, roster, { result: host.battle.result ?? null, hudTop });
        const key = `${stageProjectorFor(frame.camera, fit).scale} ${frame.camera.maxscale}`;
        held = zooms.has(key) ? held + 1 : 0;
        if (!zooms.has(key)) zooms.set(key, frame.camera);
      }
      tally.zoomsSeen += zooms.size;
      const arenaStage = ringBoundsFor(fit, { barred: true });
      const fittedStage = ringBoundsFor(fit, { barred: false });
      const fittedView = fittedViewFor({
        width: 640, height: 420, fit, frame: { layout },
        actors: turn.everyone.filter((c) => Number.isFinite(c.x)).map((c) => ({ x: c.x, y: c.y, slotIndex: c.slotIndex, yscale: turn.yscale.get(c.id), placed: true })),
        frontY: 200, rankStride: SS2_ARENA.rankStride, clipped: true
      });
      for (const model of models) {
        const where = `${name} turn ${taken}: ${turn.actorId} vs ${model.selectedId}`;
        const kept = new Map();
        tally.stances[`${model.stance?.frame} ${model.stance?.facing}`] = true;
        const bowRow = model.slots.some((slot) => /^(bombard|snipe)/.test(slot.verb ?? "")) && model.items.some((item) => item.action || item.reason);
        tally.selections += 1;
        if (bowRow) tally.bowRowSelections += 1;
        const settledView = { turn, view: stageProjectorFor(frame.camera, fit), fit, camera: frame.camera, stage: arenaStage, pack, textPack };
        const settled = drawnRing(model, { ...settledView, kept });
        if (bowRow) {
          // The kept art is the art: drawn afresh at the settled frame, every word stands where the kept art put it.
          assert.deepEqual(ringWordBoxesOf(settled.buttons), ringWordBoxesOf(drawnRing(model, settledView).buttons), `${where}: the kept art`);
          for (const camera of zooms.values()) {
            if (camera === frame.camera) continue;
            check(drawnRing(model, { turn, view: stageProjectorFor(camera, fit), fit, camera, stage: arenaStage, pack, textPack, kept }), `${where} (arena, easing)`, arenaStage);
            tally.easedRings += 1;
          }
        }
        const before = tally.liftedRings;
        check(settled, `${where} (arena)`, arenaStage);
        if (tally.liftedRings > before) tally.liftedArena += 1;
        const lifted = tally.liftedRings;
        check(drawnRing(model, { turn, view: fittedView, fit, camera: null, stage: fittedStage, pack, textPack, kept }), `${where} (fitted)`, fittedStage);
        if (tally.liftedRings > lifted) tally.liftedFitted += 1;
      }
      // PRESENTATION ONLY: reading every ring at every zoom moved nothing.
      assert.equal(host.hash(), hash, `${name} turn ${taken}: the state moved`);
      const action = { ...host.suggestAction(turn.actorId), actorId: turn.actorId };
      host.submit(action);
      hash = host.hash();
      sequence.push(`${action.actorId} ${action.type} ${action.targetId ?? "-"} ${hash}`);
      tally.turns += 1;
    }
    // The same bout, never read: the same actions, the same hashes.
    const bare = demoHost({ perSide, seed, kit });
    const replay = [bare.hash()];
    while (!bare.battle.result) {
      const action = { ...bare.suggestAction(bare.currentCombatantId()), actorId: bare.currentCombatantId() };
      bare.submit(action);
      replay.push(`${action.actorId} ${action.type} ${action.targetId ?? "-"} ${bare.hash()}`);
    }
    assert.deepEqual(sequence, replay, `${name}: the engine's sequence`);
    tally.bouts += 1;
  }
  // THE SWEEP FOUND WHAT IT IS ABOUT (a sweep that finds none proves nothing): rings with a bow and the row, a
  // BOMBARD under the row in both facings and in both views, zooms the camera eased through, and the long bow frame
  // in both facings; and no letter of the row ever stood under it.
  assert.equal(tally.bouts, 18);
  assert.ok(tally.bowRowSelections > 0 && tally.bowRowRings > 0 && tally.bombardUnderRow > 0 && tally.liftedArena > 0 && tally.liftedFitted > 0, JSON.stringify(tally));
  assert.ok(tally.facings.bombardright > 0 && tally.facings.bombardleft > 0, JSON.stringify(tally.facings));
  assert.ok(tally.stances["longrange_archer right"] && tally.stances["longrange_archer left"], JSON.stringify(tally.stances));
  assert.ok(tally.easedRings > 0 && tally.zoomsSeen > tally.turns, JSON.stringify(tally));
  assert.ok(tally.minClearance > 0 && tally.minHoverClearance > 0,
    `the nearest a drawn item comes to a BOMBARD's glow: ${tally.minClearance} overlay px, under the pointer ${tally.minHoverClearance}`);
  assert.equal(tally.lettersBelow, 0);
  t.diagnostic(JSON.stringify({ ...tally, stances: Object.keys(tally.stances).length }));
});
