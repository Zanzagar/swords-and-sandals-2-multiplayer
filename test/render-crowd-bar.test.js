/**
 * THE BUILD'S OWN CROWD BAR IN THE FRAME — `src/render/crowd-bar.js` (D8 of
 * the in-frame HUD, 2026-09-25; the owner: "use actual in game crowd bar
 * asset?"): the drive, the pack reader, the ops from the player's own pack and
 * the authored fallback.
 *
 * Everything but the last test runs on synthetic data, so a clone with no
 * licensed copy executes it. The last reads the player's own icons and text
 * packs; it skips only in a tree with no icons pack at all, and a pack
 * extracted before the `crowd` section existed takes the FALLBACK there
 * rather than adding a skip.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  SS2_CROWD_BAR,
  SS2_CROWD_BAR_DRIVE,
  SS2_CROWD_FALLBACK_ART,
  SS2_CROWD_MOODS,
  crowdBarDriveFor,
  crowdBarFallbackOpsFor,
  crowdBarInvoiceFor,
  crowdBarOpsFor,
  crowdBarPackFrom
} from "../src/render/crowd-bar.js";
import { textPackFrom } from "../src/render/text.js";

/* ------------------------------------------------------------------ */
/* 1. The drive: crowd_bar's own two handlers' arithmetic               */
/* ------------------------------------------------------------------ */

test("THE DRIVE IS THE BUILD'S: _xscale = round(crowd), and the label \"crowd: \" + moods[ceil(crowd / 10)]", () => {
  // Worked by hand from the bytes (crowd_bar clip-action 1, body 0x226086: the label +0x01fa..+0x0232, the
  // scale +0x0233..+0x0258) and the moods clip-action 0 builds (+0x01c7): index 0 is "".
  const cases = [
    [1, 1, 1, "bored to tears"], [10, 10, 1, "bored to tears"], [11, 11, 2, "bored silly"], [50, 50, 5, "interested"],
    [54.6, 55, 6, "entertained"], [70, 70, 7, "enthusiastic"], [71, 71, 8, "wildly entertained"], [90, 90, 9, "Tranfixed"],
    [99, 99, 10, "Fanatical"], [100, 100, 10, "Fanatical"]
  ];
  for (const [crowd, xscale, index, mood] of cases) {
    assert.deepEqual(crowdBarDriveFor(crowd), { xscale, index, mood, text: `crowd: ${mood}`, authored: null }, `${crowd}`);
  }
  // 0 is the build's own arithmetic too: an empty bar and index 0, the empty mood — "crowd: " and nothing after it.
  assert.deepEqual(crowdBarDriveFor(0), { xscale: 0, index: 0, mood: "", text: "crowd: ", authored: null });
  // round(0.4) = 0, ceil(0.04) = 1: the bar is empty and the crowd already bored.
  assert.deepEqual(crowdBarDriveFor(0.4), { xscale: 0, index: 1, mood: "bored to tears", text: "crowd: bored to tears", authored: null });
});

test("ABOVE 100 THE BAR STAYS FULL AND THE MOOD THE TOP ONE; BELOW 0 THE BAR IS EMPTY — authored, and said so", () => {
  // The build: round(101) = 101 would scale the bar past full, and ceil(10.1) = 11 is past its eleven moods
  // (AVM1 reads undefined there). An opening above 100 is reachable (every fighter's level summed, unclamped
  // until the first phase); the side panel's meter already keeps the top mood and a full bar (`crowdMeterFor`).
  for (const crowd of [101, 124, 250]) {
    const drive = crowdBarDriveFor(crowd);
    assert.deepEqual([drive.xscale, drive.index, drive.mood, drive.text], [100, 10, "Fanatical", "crowd: Fanatical"], `${crowd}`);
    assert.match(drive.authored, /above 100/);
  }
  // Between 100 and 100.5 the scale is still the build's own (round -> 100); only the mood is authored.
  const edge = crowdBarDriveFor(100.3);
  assert.deepEqual([edge.xscale, edge.index], [100, 10]);
  assert.match(edge.authored, /mood/);
  assert.doesNotMatch(edge.authored, /bar/);
  // Below 0 the build's _xscale would be negative — the bar mirrored leftwards about its own left edge — and
  // ceil(-1.5) = -1 is outside the moods. Drawn empty, with index 0's empty mood.
  for (const crowd of [-0.4, -5, -15]) {
    const drive = crowdBarDriveFor(crowd);
    assert.deepEqual([drive.xscale, drive.index, drive.text], [0, 0, "crowd: "], `${crowd}`);
  }
  assert.equal(crowdBarDriveFor(-0.4).authored, null, "round(-0.4) is -0: the build's own empty bar");
  assert.match(crowdBarDriveFor(-5).authored, /below 0/);
  assert.match(crowdBarDriveFor(-15).authored, /below 0/);
});

test("NO CROWD IS NOTHING DRAWN: NaN, null, Infinity or a string is no reading — never a bar at a guessed value", () => {
  for (const crowd of [Number.NaN, null, undefined, Infinity, -Infinity, "50"]) {
    const drive = crowdBarDriveFor(crowd);
    assert.deepEqual([drive.xscale, drive.index, drive.mood, drive.text], [null, null, null, null], String(crowd));
    assert.match(drive.authored, /no crowd/);
  }
});

/* ------------------------------------------------------------------ */
/* 2. The pack: the extractor's `crowd` section, whole or refused       */
/* ------------------------------------------------------------------ */

/** A rectangle as M/L/Z path data, w x h from the origin — the synthetic stand-in for the build's rounded bars. */
const rect = (w, h) => `M0 0L${w} 0L${w} ${h}L0 ${h}Z`;
const glow = [{ type: "glow", colour: { red: 0, green: 0, blue: 0, alpha: 255 }, blurX: 2, blurY: 2, strength: 10,
  inner: false, knockout: false, compositeSource: true, passes: 1 }];
const shapeAt = (character) => ({ kind: "shape", character, matrix: [1, 0, 0, 1, 0, 0] });
const entry = (character, placements) => ({ character, frames: [placements], declaredFrames: 1, effectGroups: [] });

/**
 * An icons pack with a `crowd` section in the extractor's own shape (`extractCrowd`), squares for art: the
 * build's placements (751 frame 1: 723 at depth 3, 725 at 5, field 750 at 63), its sprites (one frame each,
 * one shape at identity), its derived drive and moods, and the panel's origin.
 */
function syntheticIcons() {
  return {
    shapes: {
      722: { bounds: { xMin: 0, xMax: 156.5, yMin: 0, yMax: 11.5 }, paths: [{ d: rect(156.5, 11.5), fill: "#990000", fillOpacity: 1 }] },
      724: { bounds: { xMin: 0, xMax: 155, yMin: 0, yMax: 10 }, paths: [{ d: rect(155, 10), fill: "#009900", fillOpacity: 1 }] }
    },
    texts: {
      750: { id: 750, kind: "edit-text", bounds: { xMin: -2, xMax: 153.45, yMin: -2, yMax: 21.15 }, fontId: 118, fontHeight: 12,
        colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: "center", variable: "crowd_text", initialText: "---" }
    },
    crowd: {
      panel: { character: 751, linkage: "combat_panel" },
      origin: { x: -0.05, y: 288.75 },
      placements: [
        { kind: "background", instance: "crowd_bar_bg", depth: 3, character: 723, matrix: [1, 0, 0, 1, 9661, -5144] },
        { kind: "bar", instance: "crowd_bar", depth: 5, character: 725, matrix: [1, 0, 0, 1, 9657, -5132] },
        { kind: "label", variable: "crowd_text", align: "center", depth: 63, character: 750, matrix: [1, 0, 0, 1, 9669, -5175], filters: glow }
      ],
      drive: {
        source: "_global.crowd_interest",
        opening: "_root.game.hero.herolevel + _root.game.villain.herolevel",
        shownWhile: { side: "hero", field: "herolevel", comparison: ">", than: 1 },
        hides: ["this._visible = false", "_parent.crowd_text = \"\"", "_parent.crowd_bar_bg._visible = false"],
        scale: { target: "this", property: "_xscale", rounding: "round" },
        label: { target: "_parent", variable: "crowd_text", prefix: "crowd: ", array: "crowd_interest_array", rounding: "ceil", divisor: 10 },
        moods: [...SS2_CROWD_MOODS]
      },
      clips: { 723: entry(723, [shapeAt(722)]), 725: entry(725, [shapeAt(724)]) },
      problems: []
    }
  };
}

test("THE PACK READER IS TOTAL: no section, a stale pack or a hollow one is no pack, and the caller draws the fallback", () => {
  const raw = syntheticIcons();
  assert.ok(crowdBarPackFrom(raw), "the extractor's own shape reads");
  for (const rubbish of [null, undefined, 42, "icons", {}, { shapes: {} }]) assert.equal(crowdBarPackFrom(rubbish), null);
  const { crowd, ...stale } = raw;
  assert.equal(crowdBarPackFrom(stale), null, "a pack extracted before the crowd section");
  const without = (label, mutate) => {
    const copy = structuredClone(raw);
    mutate(copy);
    assert.equal(crowdBarPackFrom(copy), null, label);
  };
  without("the bar's sprite missing", (copy) => { delete copy.crowd.clips[725]; });
  without("the background's sprite missing", (copy) => { delete copy.crowd.clips[723]; });
  without("the bar's shape missing", (copy) => { delete copy.shapes[724]; });
  without("a shape with no path", (copy) => { copy.shapes[722].paths = []; });
  without("an empty sprite frame", (copy) => { copy.crowd.clips[725].frames = [[]]; });
  without("a sprite holding more than its shape", (copy) => { copy.crowd.clips[725].frames[0].push(shapeAt(722)); });
  without("a sprite holding another shape", (copy) => { copy.crowd.clips[725].frames[0][0].character = 722; });
  without("a sprite whose shape has no usable matrix", (copy) => { copy.crowd.clips[723].frames[0][0].matrix = [1, 0, 0, 1, "x", 0]; });
  without("the label's record missing", (copy) => { delete copy.texts[750]; });
  without("the label's record with no box", (copy) => { copy.texts[750].bounds = null; });
});

test("A FAILED OR INCOMPATIBLE EXTRACTION IS NO PACK — its problems, another drive, other moods, another place or layout", () => {
  const raw = syntheticIcons();
  const refused = (label, mutate) => {
    const copy = structuredClone(raw);
    mutate(copy.crowd);
    assert.equal(crowdBarPackFrom(copy), null, label);
  };
  refused("a problem the extraction recorded", (crowd) => { crowd.problems = ["the crowd's label is …"]; });
  refused("no problems list at all", (crowd) => { delete crowd.problems; });
  refused("no drive", (crowd) => { crowd.drive = null; });
  refused("another divisor", (crowd) => { crowd.drive.label.divisor = 11; });
  refused("another prefix", (crowd) => { crowd.drive.label.prefix = "Crowd: "; });
  refused("another rounding of the label", (crowd) => { crowd.drive.label.rounding = "floor"; });
  refused("another property scaled", (crowd) => { crowd.drive.scale.property = "_yscale"; });
  refused("another rounding of the scale", (crowd) => { crowd.drive.scale.rounding = "floor"; });
  refused("another source", (crowd) => { crowd.drive.source = "_root.crowd"; });
  refused("another level test", (crowd) => { crowd.drive.shownWhile.than = 2; });
  refused("less hidden", (crowd) => { crowd.drive.hides.pop(); });
  refused("another mood", (crowd) => { crowd.drive.moods[10] = "Fanaticam"; });
  refused("a mood fewer", (crowd) => { crowd.drive.moods.pop(); });
  refused("another origin", (crowd) => { crowd.origin = { x: 0, y: 288.75 }; });
  refused("no origin", (crowd) => { crowd.origin = null; });
  refused("the bar placed elsewhere", (crowd) => { crowd.placements[1].matrix = [1, 0, 0, 1, 9657, -5100]; });
  refused("the bar scaled at rest", (crowd) => { crowd.placements[1].matrix = [0.5, 0, 0, 1, 9657, -5132]; });
  refused("the label placed elsewhere", (crowd) => { crowd.placements[2].matrix = [1, 0, 0, 1, 9669, -5000]; });
  refused("the label bound to another field", (crowd) => { crowd.placements[2].character = 751; });
  refused("a placement missing", (crowd) => { crowd.placements.pop(); });
  refused("a placement twice", (crowd) => { crowd.placements.push({ ...crowd.placements[0] }); });
  // The table this module draws with is the one the pack is checked against.
  assert.deepEqual([SS2_CROWD_BAR.background.depth, SS2_CROWD_BAR.bar.depth, SS2_CROWD_BAR.label.depth], [3, 5, 63]);
});

/* ------------------------------------------------------------------ */
/* 3. The ops: where the build draws it, driven as the build drives it  */
/* ------------------------------------------------------------------ */

/** Every point of a path op's M/L/Q data, on the stage (its matrix, translations in twips). */
function stagePointsOf(op) {
  const numbers = String(op.d).match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g).map(Number);
  const [a, b, c, d, tx, ty] = op.matrix;
  const points = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    const [x, y] = [numbers[index], numbers[index + 1]];
    points.push({ x: a * x + c * y + tx / 20, y: b * x + d * y + ty / 20 });
  }
  return points;
}
function inkOf(ops) {
  const points = ops.flatMap(stagePointsOf);
  return { xMin: Math.min(...points.map((p) => p.x)), xMax: Math.max(...points.map((p) => p.x)),
    yMin: Math.min(...points.map((p) => p.y)), yMax: Math.max(...points.map((p) => p.y)) };
}
const near = (actual, expected, label, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} against ${expected}`);
const heard = (value) => ({ value, shown: true });

test("THE BAR SCALES ABOUT ITS OWN LEFT EDGE, AS _xscale DOES — the left edge stays at stage x 482.80 whatever the crowd", () => {
  const pack = crowdBarPackFrom(syntheticIcons());
  // Worked by hand: 725 at (9657, -5132) twips = panel (482.85, -256.60), plus the panel's origin (-0.05, 288.75)
  // = stage (482.80, 32.15); the synthetic bar is 155 x 10 from its own (0, 0), so its right edge is
  // 482.80 + 155 x xscale / 100.
  for (const [crowd, right] of [[1, 484.35], [50, 560.30], [54.6, 568.05], [99, 636.25], [100, 637.80], [101, 637.80], [250, 637.80]]) {
    const bar = crowdBarOpsFor(pack, null, heard(crowd)).filter((op) => op.role === "bar");
    assert.ok(bar.length > 0, `${crowd}: a bar`);
    const ink = inkOf(bar);
    near(ink.xMin, 482.80, `${crowd}: the left edge stays put`);
    near(ink.xMax, right, `${crowd}: the right edge`);
    near(ink.yMin, 32.15, `${crowd}: the top`);
    near(ink.yMax, 42.15, `${crowd}: the bottom — _xscale scales x alone`);
  }
  // Empty: _xscale 0 draws no bar at all (a zero-width matrix is not a drawing), and the background still stands.
  for (const crowd of [0, -5]) {
    const ops = crowdBarOpsFor(pack, null, heard(crowd));
    assert.equal(ops.filter((op) => op.role === "bar").length, 0, `${crowd}: no bar`);
    assert.ok(ops.some((op) => op.role === "background"), `${crowd}: the background`);
  }
  // The background at the build's own place: 723 at (9661, -5144) twips = (483.05, -257.20) + the origin.
  const background = inkOf(crowdBarOpsFor(pack, null, heard(50)).filter((op) => op.role === "background"));
  near(background.xMin, 483.00, "background left");
  near(background.xMax, 639.50, "background right");
  near(background.yMin, 31.55, "background top");
});

test("THE LABEL IS THE BUILD'S WORDS AT THE BUILD'S FIELD: the page font at its box's centre with no text pack, the build's glyphs under its glow with one", () => {
  const pack = crowdBarPackFrom(syntheticIcons());
  // No text pack: one page-font word, centred in field 750's box — (-2 + 153.45) / 2 = 75.725 from 483.45,
  // (-2 + 21.15) / 2 = 9.575 from -258.75, plus the origin: (559.125, 39.575) — 12 px, white, its black glow as outline.
  const words = crowdBarOpsFor(pack, null, heard(50)).filter((op) => op.kind === "text");
  assert.deepEqual(words.map((op) => [op.text, op.size, op.fill, op.outline, op.align, op.alpha, op.panel, op.role]),
    [["crowd: interested", 12, "#ffffff", "#000000", "center", 1, "crowd", "label"]]);
  near(words[0].x, 559.125, "label x");
  near(words[0].y, 39.575, "label y");
  // A text pack with field 750 and font 118: the build's glyphs, each under the label's glow.
  const letters = [...new Set("abcdefghijklmnopqrstuvwxyzFT:")];
  const glyphs = [...letters, " "].map((char) => ({ code: char.codePointAt(0), path: char === " " ? null : "M0 0L400 0L400 600L0 600Z",
    empty: char === " ", advance: 500, char }));
  const textPack = textPackFrom({ fonts: { 118: { id: 118, glyphs, ascent: 800, descent: 200 } },
    fields: { 750: { id: 750, font: 118, bounds: { xMin: -40, xMax: 3069, yMin: -40, yMax: 423 }, fontHeight: 240, align: "center", colour: "#ffffff" } },
    statics: {} });
  const drawn = crowdBarOpsFor(pack, textPack, heard(50), { stageScale: 2 }).filter((op) => op.role === "label");
  assert.ok(drawn.length > 0 && drawn.every((op) => op.kind === "path" && op.group && op.panel === "crowd"), "glyphs, each in the glow group");
  assert.equal(drawn.filter((op) => op.glyph).map((op) => op.glyph.char).join(""), "crowd:interested", "\"crowd: interested\" (the space inks nothing)");
  assert.equal(crowdBarOpsFor(pack, textPack, heard(50)).filter((op) => op.kind === "text").length, 0, "and no page-font word");
  // A text pack that cannot draw it (no font) is the page font, never a silently missing label.
  const fontless = textPackFrom({ fonts: {}, fields: { 750: { id: 750, font: 118, bounds: { xMin: -40, xMax: 3069, yMin: -40, yMax: 423 }, fontHeight: 240 } },
    statics: {} });
  assert.deepEqual(crowdBarOpsFor(pack, fontless, heard(95)).filter((op) => op.kind === "text").map((op) => op.text), ["crowd: Fanatical"]);
  // …nor one whose font lacks the letters: a run of nothing but `.notdef` boxes is not a drawing.
  const digitsOnly = textPackFrom({ fonts: { 118: { id: 118, glyphs: [{ code: 48, path: "M0 0L400 0L400 600L0 600Z", empty: false, advance: 500 }],
    ascent: 800, descent: 200 } }, fields: { 750: { id: 750, font: 118, bounds: { xMin: -40, xMax: 3069, yMin: -40, yMax: 423 }, fontHeight: 240 } },
  statics: {} });
  assert.deepEqual(crowdBarOpsFor(pack, digitsOnly, heard(95)).filter((op) => op.role === "label").map((op) => [op.kind, op.text]),
    [["text", "crowd: Fanatical"]]);
  // The empty mood is the build's own "crowd: ", drawn.
  assert.deepEqual(crowdBarOpsFor(pack, null, heard(0)).filter((op) => op.kind === "text").map((op) => op.text), ["crowd: "]);
});

test("PAINT ORDER IS THE BUILD'S DEPTH ORDER — background (3), bar (5), label (63) — and a crowd NOT HEARD, or none, is nothing drawn", () => {
  const pack = crowdBarPackFrom(syntheticIcons());
  const roles = crowdBarOpsFor(pack, null, heard(50)).map((op) => op.role);
  assert.deepEqual([...new Set(roles)], ["background", "bar", "label"]);
  assert.ok(crowdBarOpsFor(pack, null, heard(50)).every((op) => op.panel === "crowd"));
  // The build hides the bar and the background and empties the label while hero.herolevel <= 1.
  assert.deepEqual(crowdBarOpsFor(pack, null, { value: 50, shown: false }), []);
  assert.deepEqual(crowdBarOpsFor(pack, null, { value: Number.NaN, shown: true }), [], "no crowd");
  assert.deepEqual(crowdBarOpsFor(pack, null, null), [], "no reading");
  assert.equal(crowdBarOpsFor(null, null, heard(50)), null, "no pack: the caller draws the fallback");
});

/* ------------------------------------------------------------------ */
/* 4. The authored fallback                                            */
/* ------------------------------------------------------------------ */

test("THE FALLBACK IS AUTHORED AND STANDS WHERE THE BUILD'S DOES: the same place, the same drive, the same words — its own shapes", () => {
  const pack = crowdBarPackFrom(syntheticIcons());
  for (const crowd of [1, 50, 99, 100, 101, 250]) {
    const ops = crowdBarFallbackOpsFor(heard(crowd));
    const paths = ops.filter((op) => op.kind === "path");
    assert.ok(paths.length > 0 && paths.every((op) => op.authored === true && op.panel === "crowd"), `${crowd}: every path authored`);
    // The fill grows about the same left edge to the same right edge as the build's bar (155 px at full).
    const fill = inkOf(paths.filter((op) => op.role === "bar"));
    const built = inkOf(crowdBarOpsFor(pack, null, heard(crowd)).filter((op) => op.role === "bar"));
    near(fill.xMin, built.xMin, `${crowd}: the left edge`);
    near(fill.xMax, built.xMax, `${crowd}: the right edge`);
    // The same words at the same place, in the page font.
    const words = (list) => list.filter((op) => op.kind === "text").map((op) => [op.text, op.x, op.y, op.size, op.align]);
    assert.deepEqual(words(ops), words(crowdBarOpsFor(pack, null, heard(crowd))), `${crowd}: the label`);
  }
  // The track stands over the build's background: shape 722's fill, 0..156.5 x 0..11.5 at (483.05, -257.20) + the origin.
  const track = inkOf(crowdBarFallbackOpsFor(heard(50)).filter((op) => op.role === "background"));
  near(track.xMin, 483.00, "track left");
  near(track.xMax, 639.50, "track right");
  near(track.yMin, 31.55, "track top");
  near(track.yMax, 43.05, "track bottom");
  // Empty draws the track and no fill; not heard, or no crowd, draws nothing.
  assert.equal(crowdBarFallbackOpsFor(heard(0)).filter((op) => op.role === "bar").length, 0);
  assert.ok(crowdBarFallbackOpsFor(heard(0)).some((op) => op.role === "background"));
  assert.deepEqual(crowdBarFallbackOpsFor({ value: 50, shown: false }), []);
  assert.deepEqual(crowdBarFallbackOpsFor(heard(Number.NaN)), []);
  // Every path this module's own M/L/Q/Z, none of it the pack's.
  const packPaths = new Set(Object.values(syntheticIcons().shapes).flatMap((shape) => shape.paths.map((path) => path.d)));
  for (const op of crowdBarFallbackOpsFor(heard(50)).filter((one) => one.kind === "path")) {
    assert.match(op.d, /^M[-\d. MLQZ]+$/, "absolute M/L/Q/Z only");
    assert.equal(packPaths.has(op.d), false);
  }
});

/* ------------------------------------------------------------------ */
/* 5. The invoice                                                      */
/* ------------------------------------------------------------------ */

test("WHAT THE DRAWING COULD NOT CARRY IS COUNTED BY NAME: hidden, an authored drive, a label in the page font", () => {
  const pack = crowdBarPackFrom(syntheticIcons());
  assert.deepEqual({ ...crowdBarInvoiceFor(pack, null, heard(50)) }, { hidden: 0, drivesAuthored: 0, wordsInPageFont: 1 });
  assert.deepEqual({ ...crowdBarInvoiceFor(pack, null, heard(250)) }, { hidden: 0, drivesAuthored: 1, wordsInPageFont: 1 });
  assert.deepEqual({ ...crowdBarInvoiceFor(pack, null, { value: 50, shown: false }) }, { hidden: 1, drivesAuthored: 0, wordsInPageFont: 0 });
  assert.equal(crowdBarInvoiceFor(null, null, heard(50)), null, "the fallback carries no art of the build's to fall short of");
});

/* ------------------------------------------------------------------ */
/* 6. The player's own packs                                           */
/* ------------------------------------------------------------------ */

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets");
const ICONS_AT = path.join(ASSETS, "icons", "icons.json");
const TEXT_AT = path.join(ASSETS, "text", "text.json");
const MODULE_AT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "render", "crowd-bar.js");

test("THE REAL PACKS, ANY VINTAGE: the build's own crowd bar where the build draws it — or, on a stale pack, the fallback", (t) => {
  if (!fs.existsSync(ICONS_AT)) {
    t.skip("no extracted icons pack in this tree (a fresh clone): run node tools/extract-icons.mjs");
    return;
  }
  const raw = JSON.parse(fs.readFileSync(ICONS_AT, "utf8"));
  const text = fs.existsSync(TEXT_AT) ? textPackFrom(JSON.parse(fs.readFileSync(TEXT_AT, "utf8"))) : null;
  const pack = crowdBarPackFrom(raw);
  if (!raw.crowd) {
    // A pack extracted before 2026-09-25: no section, so no pack, and the authored bar draws — never a skip.
    assert.equal(pack, null);
    assert.ok(crowdBarFallbackOpsFor(heard(50)).length > 0);
    return;
  }
  assert.ok(pack, "a pack with the crowd section reads");
  const section = raw.crowd;

  // 1. The hand-cited tables are the pack's: the drive, the moods, the origin and every placement.
  for (const key of ["source", "shownWhile", "hides", "scale", "label"]) assert.deepEqual(section.drive[key], JSON.parse(JSON.stringify(SS2_CROWD_BAR_DRIVE[key])), key);
  assert.deepEqual(section.drive.moods, [...SS2_CROWD_MOODS]);
  near(section.origin.x, SS2_CROWD_BAR.origin.x, "origin x");
  near(section.origin.y, SS2_CROWD_BAR.origin.y, "origin y");
  for (const part of [SS2_CROWD_BAR.background, SS2_CROWD_BAR.bar, SS2_CROWD_BAR.label]) {
    const row = section.placements.find((one) => one.kind === part.kind);
    assert.deepEqual([row.depth, row.character, row.instance ?? row.variable, row.matrix],
      [part.depth, part.character, part.instance ?? part.variable, [...part.matrix]], part.kind);
  }
  for (const part of [SS2_CROWD_BAR.background, SS2_CROWD_BAR.bar]) {
    assert.deepEqual(section.clips[part.character].frames[0].map((placement) => placement.character), [part.shape], `${part.character} holds ${part.shape}`);
  }

  // 2. The fallback stands where the pack draws: its numbers are the pack's own.
  const extents = (d) => {
    const numbers = d.match(/[-+]?(?:\d+\.?\d*|\.\d+)/g).map(Number);
    const xs = numbers.filter((unused, index) => index % 2 === 0);
    const ys = numbers.filter((unused, index) => index % 2 === 1);
    return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) };
  };
  const filled = (id) => raw.shapes[id].paths.find((one) => one.fill && one.fill !== "none");
  const { track, fill, labelBox, labelSize } = SS2_CROWD_FALLBACK_ART;
  assert.deepEqual(extents(filled(722).d), { xMin: track.xMin, xMax: track.xMax, yMin: track.yMin, yMax: track.yMax }, "the track is 722's fill");
  assert.deepEqual(extents(filled(724).d), { xMin: fill.xMin, xMax: fill.xMax, yMin: fill.yMin, yMax: fill.yMax }, "the fill is 724's");
  assert.equal(raw.shapes[724].bounds.xMin, 0, "the bar's left edge is its registration point");
  assert.deepEqual({ ...labelBox }, raw.texts[750].bounds);
  assert.equal(labelSize, raw.texts[750].fontHeight);
  assert.equal(SS2_CROWD_BAR.label.align, raw.texts[750].align);

  // 3. THE REAL OPS: the bar about its own left edge, the background at its place, the label in the build's glyphs.
  for (const [crowd, right] of [[1, 484.35], [50, 560.30], [100, 637.80], [124, 637.80]]) {
    const bar = inkOf(crowdBarOpsFor(pack, text, heard(crowd)).filter((op) => op.role === "bar"));
    near(bar.xMin, 482.80, `${crowd}: the left edge`, 1e-9);
    near(bar.xMax, right, `${crowd}: the right edge`, 1e-9);
    near(bar.yMin, 32.15, `${crowd}: the bar's top`, 1e-9);
  }
  const background = inkOf(crowdBarOpsFor(pack, text, heard(50)).filter((op) => op.role === "background"));
  near(background.xMin, 483.00, "background left", 1e-9);
  near(background.yMin, 31.55, "background top", 1e-9);
  if (text) {
    const label = crowdBarOpsFor(pack, text, heard(50), { stageScale: 2 }).filter((op) => op.role === "label");
    assert.equal(label.filter((op) => op.glyph).map((op) => op.glyph.char).join(""), "crowd:interested", "in the build's font 118");
    assert.ok(label.every((op) => op.kind === "path" && op.group), "under the build's black glow");
    assert.equal(crowdBarInvoiceFor(pack, text, heard(50)).wordsInPageFont, 0);
    // Every mood, on one line, inside the field's box: none wraps and none overhangs.
    for (const mood of SS2_CROWD_MOODS) {
      const glyphs = crowdBarOpsFor(pack, text, heard(Math.max(0, SS2_CROWD_MOODS.indexOf(mood) * 10))).filter((op) => op.glyph && !op.glyph.empty);
      if (glyphs.length === 0) continue;
      const ink = inkOf(glyphs);
      assert.ok(ink.xMin >= 481.40 && ink.xMax <= 636.85 && ink.yMax <= 51.15 && ink.yMin >= 28.0, `${mood}: ${JSON.stringify(ink)}`);
    }
  }

  // 4. NO SS2 ART IN SOURCE: neither shape's path string is in this module or its fallback.
  const source = fs.readFileSync(MODULE_AT, "utf8");
  const fallbackPaths = new Set(crowdBarFallbackOpsFor(heard(50)).filter((op) => op.kind === "path").map((op) => op.d));
  for (const id of [722, 724]) {
    for (const drawn of raw.shapes[id].paths) {
      assert.equal(source.includes(drawn.d), false, `shape ${id}'s path is in src/render/crowd-bar.js`);
      assert.equal(fallbackPaths.has(drawn.d), false, `shape ${id}'s path is a fallback op`);
    }
  }
});
