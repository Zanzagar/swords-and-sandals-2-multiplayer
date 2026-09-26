/**
 * THE CROWD BAR'S WIRING DECISIONS (D8 of the in-frame HUD, 2026-09-25;
 * `tools/arena/combat-hud.js`): which art the bar is drawn with and why, which
 * crowd it shows at a given moment, the ops it is painted with, and the line
 * in "What you are looking at" that says so. The art and its drive are
 * `src/render/crowd-bar.js`'s, under `test/render-crowd-bar.test.js`; the
 * shell's calls are pinned in `test/arena-combat-hud-wiring.test.js`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { crowdBarFallbackOpsFor, crowdBarOpsFor, SS2_CROWD_MOODS } from "../src/render/crowd-bar.js";
import { createCrowdPresenter, queueCrowdInterest } from "../src/render/crowd-sound.js";
import { textPackFrom } from "../src/render/text.js";
import { ARENA_VISUAL_PACKS, assetGateReport } from "../tools/arena/asset-gate.js";
import {
  combatHudFrameFor,
  createCrowdBarOps,
  crowdBarArtFor,
  crowdBarInvoiceOf,
  crowdBarProvenanceFor,
  crowdBarReadingFor
} from "../tools/arena/combat-hud.js";

const rect = (w, h) => `M0 0L${w} 0L${w} ${h}L0 ${h}Z`;
const shapeAt = (character) => ({ kind: "shape", character, matrix: [1, 0, 0, 1, 0, 0] });
const entry = (character, placements) => ({ character, frames: [placements], declaredFrames: 1, effectGroups: [] });
const glow = [{ type: "glow", colour: { red: 0, green: 0, blue: 0, alpha: 255 }, blurX: 2, blurY: 2, strength: 10,
  inner: false, knockout: false, compositeSource: true, passes: 1 }];

/** An icons pack carrying only a `crowd` section, in the extractor's shape (the renderer test's fixture, repeated: tests do not export). */
function crowdIcons() {
  return {
    shapes: {
      722: { bounds: { xMin: 0, xMax: 156.5, yMin: 0, yMax: 11.5 }, paths: [{ d: rect(156.5, 11.5), fill: "#990000", fillOpacity: 1 }] },
      724: { bounds: { xMin: 0, xMax: 155, yMin: 0, yMax: 10 }, paths: [{ d: rect(155, 10), fill: "#009900", fillOpacity: 1 }] }
    },
    texts: {
      750: { id: 750, kind: "edit-text", bounds: { xMin: -2, xMax: 153.45, yMin: -2, yMax: 21.15 }, fontId: 118, fontHeight: 12,
        colour: { red: 255, green: 255, blue: 255, alpha: 255 }, align: "center", variable: "crowd_text" }
    },
    crowd: {
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

test("D8, WHICH ART AND WHY: the build's own crowd bar from a pack the renderer accepts; otherwise the authored one, and the log says which case it is", () => {
  const build = crowdBarArtFor(crowdIcons());
  assert.equal(build.state, "build");
  assert.ok(build.pack);
  assert.equal(build.log.warn, false);
  assert.match(build.log.message, /^crowd bar: the build's own crowd_bar from your install/);
  const cases = [
    [null, "none", false, /no icons pack/],
    [{ shapes: {}, texts: {} }, "stale", true, /extracted before its crowd section[^]*node tools\/extract-all\.mjs/],
    [{ ...crowdIcons(), crowd: { ...crowdIcons().crowd, problems: ["the crowd's label is …"] } }, "refused", true, /is not the build this page draws/],
    [undefined, "unused", true, /not used this bout/]
  ];
  for (const [icons, state, warn, said] of cases) {
    const art = crowdBarArtFor(icons);
    assert.deepEqual([art.pack, art.state, art.log.warn], [null, state, warn], state);
    assert.match(art.log.message, said, state);
    assert.match(art.log.message, /^crowd bar: /, `${state}: said as the crowd bar's own line`);
  }
});

test("D8, WHICH CROWD: the battle's crowd as it is HEARD — each step's value from the moment its drawing ends, as the build's nextphase moves it — and shown only while the crowd is heard", () => {
  // The presenter the arena's sounds already keep (`noteArenaSoundStep`): the opening, then each step's
  // `ss2CrowdInterestOf(host.battle)` queued at `stepEndsAtMs`.
  const presenter = queueCrowdInterest(queueCrowdInterest(createCrowdPresenter(12), 40, 1000), 37, 2500);
  const at = (now, heard = true) => crowdBarReadingFor({ presenter, now, heard });
  assert.deepEqual({ ...at(0) }, { value: 12, shown: true }, "the opening, before any step is drawn");
  assert.deepEqual({ ...at(999) }, { value: 12, shown: true }, "the swing is still being drawn: the build's crowd has not moved");
  assert.deepEqual({ ...at(1000) }, { value: 40, shown: true }, "the action drawn: the phase completes and the crowd moves");
  assert.deepEqual({ ...at(2499) }, { value: 40, shown: true });
  assert.deepEqual({ ...at(2500) }, { value: 37, shown: true });
  assert.deepEqual({ ...at(2500, false) }, { value: 37, shown: false }, "not heard (every fighter level 1): the build hides it");
  assert.deepEqual({ ...crowdBarReadingFor({ presenter: createCrowdPresenter(null), now: 5, heard: true }) }, { value: null, shown: false },
    "a rule set with no crowd: nothing to show");
  assert.deepEqual({ ...crowdBarReadingFor({ presenter: createCrowdPresenter(Number.NaN), now: 5, heard: true }) }, { value: null, shown: false });
});

test("D8, THE FRAME CARRIES THE CROWD: laid out with the gauges and carried beside them — the same reading whatever the bout's size", () => {
  const row = (id) => ({ id, name: id, colour: "#e0584f", acting: false, alive: true,
    health: { value: 5, max: 10, shown: true }, energy: { value: 5, max: 10, shown: true }, armour: { value: 0, max: 0, shown: false } });
  const hud = (n) => ({ teams: [
    { teamId: "red", rows: Array.from({ length: n }, (unused, index) => row(`red-${index + 1}`)) },
    { teamId: "blue", rows: Array.from({ length: n }, (unused, index) => row(`blue-${index + 1}`)) }
  ] });
  const crowd = Object.freeze({ value: 55, shown: true });
  for (const n of [1, 2, 3]) {
    const frame = combatHudFrameFor({ hud: hud(n), pack: null, crowd });
    assert.equal(frame.crowd, crowd, `${n}v${n}: the crowd reading, handed through`);
    assert.equal(frame.clusters.length, 2 * n, `${n}v${n}: the gauges unchanged beside it`);
  }
  assert.equal(combatHudFrameFor({ hud: hud(1), pack: null }).crowd, null, "no crowd handed in: none drawn");
});

test("D8, THE OPS THE BAR IS PAINTED WITH: the pack's when there is one, the fallback's otherwise — built once and kept while nothing they read changes", () => {
  const art = crowdBarArtFor(crowdIcons());
  const opsFor = createCrowdBarOps();
  const reading = Object.freeze({ value: 55, shown: true });
  const first = opsFor({ art, textPack: null, reading, stageScale: 1.5 });
  assert.deepEqual(first, crowdBarOpsFor(art.pack, null, reading, { stageScale: 1.5 }), "the pack's own ops");
  assert.equal(opsFor({ art, textPack: null, reading: { ...reading }, stageScale: 1.5 }), first, "the same crowd again: the same ops, not rebuilt");
  // Each changes ONE thing from the call before it, and each is drawn anew.
  const moved = opsFor({ art, textPack: null, reading: { value: 56, shown: true }, stageScale: 1.5 });
  assert.notEqual(moved, first, "the crowd moved");
  const scaled = opsFor({ art, textPack: null, reading: { value: 56, shown: true }, stageScale: 2 });
  assert.notEqual(scaled, moved, "a new stage scale (the label's glow is built at the width it is drawn)");
  const hidden = opsFor({ art, textPack: null, reading: { value: 56, shown: false }, stageScale: 2 });
  assert.notEqual(hidden, scaled, "hidden");
  assert.deepEqual(hidden, []);
  const letters = [...new Set("abcdefghijklmnopqrstuvwxyzFT:")];
  const textPack = textPackFrom({ fonts: { 118: { id: 118, glyphs: [...letters, " "].map((char) => ({ code: char.codePointAt(0),
    path: char === " " ? null : "M0 0L400 0L400 600L0 600Z", empty: char === " ", advance: 500 })), ascent: 800, descent: 200 } },
  fields: { 750: { id: 750, font: 118, bounds: { xMin: -40, xMax: 3069, yMin: -40, yMax: 423 }, fontHeight: 240 } }, statics: {} });
  const shownAgain = opsFor({ art, textPack: null, reading: { value: 56, shown: true }, stageScale: 2 });
  const lettered = opsFor({ art, textPack, reading: { value: 56, shown: true }, stageScale: 2 });
  assert.notEqual(lettered, shownAgain, "another text pack is other glyphs");
  assert.ok(lettered.some((op) => op.role === "label" && op.kind === "path" && op.group), "the label's glyphs, glowing");
  const other = crowdBarArtFor(crowdIcons());
  assert.notEqual(opsFor({ art: other, textPack, reading: { value: 56, shown: true }, stageScale: 2 }), lettered, "another pack is other art");
  // The fallback.
  const plain = crowdBarArtFor(null);
  assert.deepEqual(opsFor({ art: plain, textPack: null, reading, stageScale: 1.5 }), crowdBarFallbackOpsFor(reading));
  assert.deepEqual(opsFor({ art: plain, textPack: null, reading: null, stageScale: 1.5 }), [], "no crowd reading: nothing");
});

test("D8, \"WHAT YOU ARE LOOKING AT\": the crowd bar's line says whose art it is, what of it is authored, when it moves — and, hidden or authored, why", () => {
  const subjectOf = (line) => line[0];
  const build = crowdBarProvenanceFor({ art: crowdBarArtFor(crowdIcons()), invoice: { hidden: 0, drivesAuthored: 0, wordsInPageFont: 0 },
    open: true, heard: true });
  assert.equal(subjectOf(build), "The crowd bar in the frame");
  assert.match(build[1], /the build's own crowd_bar/);
  assert.match(build[1], /_xscale = round\(crowd\)/);
  assert.match(build[1], /moves when the action has been drawn/);
  assert.match(build[1], /above 100[^]*full[^]*top mood/, "the authored range, named");
  assert.doesNotMatch(build[1], /page font/);
  const paged = crowdBarProvenanceFor({ art: crowdBarArtFor(crowdIcons()), invoice: { hidden: 0, drivesAuthored: 0, wordsInPageFont: 1 }, open: true, heard: true });
  assert.match(paged[1], /its label in the page font/);
  const fallback = crowdBarProvenanceFor({ art: crowdBarArtFor({ shapes: {}, texts: {} }), invoice: null, open: true, heard: true });
  assert.match(fallback[1], /an authored stand-in/);
  assert.match(fallback[1], /predates its crowd section/, "and why");
  const silent = crowdBarProvenanceFor({ art: crowdBarArtFor(crowdIcons()), invoice: null, open: true, heard: false });
  assert.match(silent[1], /hidden this bout[^]*no fighter is above level 1/, "not heard, said as the build's own rule");
  const early = crowdBarProvenanceFor({ art: crowdBarArtFor(undefined), invoice: null, open: false, heard: true });
  assert.match(early[1], /not drawn yet/);
  // The invoice, for the build's art only.
  assert.deepEqual({ ...crowdBarInvoiceOf(crowdBarArtFor(crowdIcons()), null, { value: 50, shown: true }) },
    { hidden: 0, drivesAuthored: 0, wordsInPageFont: 1 });
  assert.equal(crowdBarInvoiceOf(crowdBarArtFor(null), null, { value: 50, shown: true }), null);
});

test("THE ASSET GATE NAMES THE CROWD BAR: a late icons pack is said to cost it, with the gauges and everything else it carries", () => {
  const icons = ARENA_VISUAL_PACKS.find((pack) => pack.name === "icons");
  assert.match(icons.label, /\bthe crowd bar\b/);
  assert.match(icons.label, /\bthe gauges\b/);
  const late = assetGateReport({
    open: true, reason: "timeout", elapsedMs: 8000, settledCount: 7, total: 8, late: ["icons"], errors: {},
    outcomes: Object.fromEntries(ARENA_VISUAL_PACKS.map((pack) => [pack.name, pack.name === "icons" ? "late" : "loaded"]))
  });
  assert.match(late[0].message, /LATE, and not used this bout: icons \([^)]*the crowd bar[^)]*\)/);
});
