/**
 * THE TEXT EXTRACTION, and the two things it is really guarding.
 *
 * ► **ONE: THE TALLY IS A RECOUNT, NOT A MEMORY.** `test/extraction-honesty.test.js`
 *   recomputes the approximation counts of the props, wardrobe and figure packs
 *   straight from their data, because the arena's walls were invisible for
 *   months while every report said zero. Its `PACKS` table does not list this
 *   pack — that file was not this session's to edit — so the same recount lives
 *   here, over `assets/text/`, and the main session should fold it into that
 *   table. Until it does, THIS is the check.
 *
 * ► **TWO: THE BUILD'S OWN TABLES LIE BY OMISSION IN TWO PLACES**, and both are
 *   pinned below: every per-glyph bounds RECT in the file is `{0,0,0,0}`, and
 *   font 1510 has no layout block at all. A reader that trusts either one gets
 *   plausible numbers — zero-width glyphs, or 114 glyphs stacked on the same
 *   pen position — and nothing tells it.
 *
 * Everything that can run against a synthetic buffer does, so a clone with no
 * licensed copy still executes it. The ones that need the real build skip
 * themselves by name.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ExtractTextError,
  extractText,
  htmlToPlainText,
  indexTextPlacements,
  inkBoundsOf,
  parseArguments,
  summarise,
  tallyApproximations,
  toHexColour
} from "../tools/extract-text.mjs";
import { FONT3_UNITS_PER_EM, indexFonts } from "../tools/swf-fonts.mjs";
import { TAG, tagStreamStart, walkTags } from "../tools/swf-display-list.mjs";
import { indexText } from "../tools/swf-text.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/* ---------------------------------------------------------------- */
/* The pieces that need no build                                     */
/* ---------------------------------------------------------------- */

test("parseArguments defaults to the installed build and refuses an --out with no path", () => {
  const defaults = parseArguments([]);
  assert.match(defaults.file, /swords_sandals2_download\.swf$/);
  assert.equal(defaults.out, path.join(REPO_ROOT, "assets", "text"));
  assert.equal(defaults.report, false);

  const chosen = parseArguments(["/tmp/other.swf", "--out", "/tmp/pack", "--report"]);
  assert.equal(chosen.file, "/tmp/other.swf");
  assert.equal(chosen.out, "/tmp/pack");
  assert.equal(chosen.report, true);

  assert.throws(() => parseArguments(["--out"]), /--out needs a directory path/);
  assert.throws(() => parseArguments(["--glyphs"]), /Unknown option/);
  assert.throws(() => parseArguments(["--out", "--report"]), ExtractTextError);
});

test("a colour reaches the pack as the same #rrggbb every other pack's fill uses", () => {
  assert.equal(toHexColour({ red: 255, green: 255, blue: 255, alpha: 255 }), "#ffffff");
  assert.equal(toHexColour({ red: 0, green: 17, blue: 255, alpha: 0 }), "#0011ff");
  // Out-of-range channels are clamped rather than emitting "#1ff" or "#-1",
  // either of which a canvas treats as a parse failure and draws black.
  assert.equal(toHexColour({ red: 300, green: -5, blue: 128.6 }), "#ff0081");
  assert.equal(toHexColour(null), null);
});

test("THE INK BOX FOLLOWS THE CURVE, not the control point that steers it", () => {
  // ► A quadratic lies INSIDE the hull of {start, control, end} and touches it
  //   only at the ends. Taking the hull overstates every round letter by a few
  //   percent, silently, in a number a caller centres text with. Here the
  //   control is at y -200 and the curve's own extremum is exactly -100.
  const arch = [{ start: [0, 0], edges: [{ kind: "quadratic", control: [100, -200], to: [200, 0] }] }];
  const box = inkBoundsOf(arch);
  assert.deepEqual(box, { xMin: 0, xMax: 200, yMin: -100, yMax: 0 });

  // A straight edge has no extremum to find and must not gain one.
  const wedge = [{ start: [0, 0], edges: [{ kind: "line", to: [50, -30] }] }];
  assert.deepEqual(inkBoundsOf(wedge), { xMin: 0, xMax: 50, yMin: -30, yMax: 0 });
});

test("a glyph with no edges has NO ink box, which is a different claim from a zero-sized one", () => {
  // ► A space is empty on purpose. Returning {0,0,0,0} would make it
  //   indistinguishable from a glyph whose outline failed to read, and the
  //   advance derivation below branches on exactly that difference.
  assert.equal(inkBoundsOf([]), null);
  assert.equal(inkBoundsOf(null), null);
  assert.equal(inkBoundsOf([{ start: [10, 10], edges: [] }]), null);
});

test("HTML markup is stripped to plain text and the stripping is reversible enough to read", () => {
  const markup = '<p align="center"><font face="GoudyHandtooled BT" size="14"><b>Do you want to</b></font></p>';
  assert.equal(htmlToPlainText(markup), "Do you want to");
  assert.equal(htmlToPlainText("one<br>two"), "one\rtwo");
  assert.equal(htmlToPlainText("<p>a</p><p>b</p>"), "a\rb");
  assert.equal(htmlToPlainText("5 &lt; 6 &amp; 7 &gt; 6"), "5 < 6 & 7 > 6");
  // `&amp;lt;` is a literal "&lt;", not a second round of decoding into "<".
  assert.equal(htmlToPlainText("&amp;lt;"), "&lt;");
  assert.equal(htmlToPlainText(null), null);
});

test("the tally is computed from the pack it is handed, never from what the extractor meant", () => {
  // ► Handed a pack whose items carry approximation marks, the tally counts
  //   THOSE. This is the shape that makes a lying manifest impossible: the same
  //   function runs over the finished file in the recount test below.
  const pack = {
    fonts: {
      1: { glyphs: [{ approximated: "advance-from-outline" }, { approximated: "advance-from-outline" }, {}] },
      2: { approximated: "font-layout-absent", glyphs: [{}] }
    },
    statics: { 9: {} },
    fields: { 8: { approximated: "html-markup-stripped" }, 7: {} }
  };
  assert.deepEqual(tallyApproximations(pack), {
    glyphs: 4,
    statics: 1,
    fields: 2,
    total: 4,
    byKind: { "advance-from-outline": 2, "font-layout-absent": 1, "html-markup-stripped": 1 }
  });
});

test("an empty pack tallies zero without inventing a population", () => {
  assert.deepEqual(tallyApproximations({}), { glyphs: 0, statics: 0, fields: 0, total: 0, byKind: {} });
});

/* ---------------------------------------------------------------- */
/* Against the installed build                                       */
/* ---------------------------------------------------------------- */

const ORACLE =
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf";
const haveOracle = fs.existsSync(ORACLE);
const skip = haveOracle ? false : "no installed build on this machine";

/** The oracle, read fresh per test. Nothing here writes to it. */
function oracleBuffer() {
  return fs.readFileSync(ORACLE);
}

test("nine fonts, 1027 glyphs, no failures — and every one names its rights holder", { skip }, () => {
  const { pack, failures } = extractText(oracleBuffer());
  const fonts = Object.values(pack.fonts);
  assert.equal(fonts.length, 9);
  assert.equal(fonts.reduce((sum, font) => sum + font.glyphs.length, 0), 1027);
  assert.deepEqual(failures, [], "a failure here is a glyph nothing can draw");

  // ► FOUR rights holders, not the two a brief on this route named. The licence
  //   line travels with the outlines or this pipeline is choosing not to know.
  const holders = new Set();
  for (const font of fonts) {
    assert.ok(typeof font.copyright === "string" && font.copyright.length > 0,
      `font ${font.id} carries no DefineFontName copyright`);
    if (/Bitstream/i.test(font.copyright)) holders.add("Bitstream");
    if (/Monotype/i.test(font.copyright)) holders.add("Monotype");
    if (/SWFTE/i.test(font.copyright)) holders.add("SWFTE");
    if (/Gillespie/i.test(font.copyright)) holders.add("Gillespie");
  }
  assert.deepEqual([...holders].sort(), ["Bitstream", "Gillespie", "Monotype", "SWFTE"]);
});

test("EVERY per-glyph bounds RECT in the build is empty, so the pack measures its own", { skip }, () => {
  // ► 913 of 913. A consumer measuring text from DefineFont3's own bounds table
  //   gets zero width and zero height and is told nothing. The pack therefore
  //   carries an `ink` box computed from the outline, and records that the
  //   build's table was empty so a future build that fills it in is visible.
  const { pack } = extractText(oracleBuffer());
  let declared = 0;
  let empty = 0;
  for (const font of Object.values(pack.fonts)) {
    if (!font.hasLayout) continue;
    declared += font.glyphs.length;
    empty += font.emptyLayoutBounds;
  }
  assert.equal(declared, 913);
  assert.equal(empty, 913, "if this ever drops below `declared`, the build started writing real bounds");

  const arial = pack.fonts[754];
  const letterA = arial.glyphs.find((glyph) => glyph.char === "A");
  // Measured off the outline: y is DOWN and the baseline is 0, so an ascender
  // is NEGATIVE. A renderer that assumes otherwise draws every line upside down.
  assert.ok(letterA.ink.yMin < 0 && letterA.ink.yMax <= 0, `Arial 'A' ink ${JSON.stringify(letterA.ink)}`);
  assert.ok(letterA.ink.xMax > 13000, "and its ink box is a real width, not the zero the build declares");
});

test("font 1510 has no layout block, and every advance it needs is named as derived", { skip }, () => {
  const { pack, approximated } = extractText(oracleBuffer());
  const avalon = pack.fonts[1510];
  assert.equal(avalon.hasLayout, false);
  assert.equal(avalon.ascent, null, "null, never zero: a zero ascent is a measurement and this is an absence");
  assert.equal(avalon.kerning, null);
  assert.equal(avalon.approximated, "font-layout-absent");

  const outline = avalon.glyphs.filter((glyph) => glyph.approximated === "advance-from-outline");
  const sibling = avalon.glyphs.filter((glyph) => glyph.approximated === "advance-from-sibling-font");
  assert.equal(outline.length, 112);
  assert.equal(sibling.length, 2, "the two EMPTY glyphs have no ink to derive an advance from");
  assert.equal(outline.length + sibling.length, avalon.glyphs.length);
  for (const glyph of avalon.glyphs) {
    assert.ok(glyph.advance > 0, `glyph ${glyph.index ?? glyph.code} would stack on the one before it`);
  }

  // ► The heuristic was checked against a SECOND font before being used. 1519
  //   is the other "Avalon Quest", shares 1510's code table, and has advances.
  const bold = pack.fonts[1519];
  assert.deepEqual(avalon.glyphs.map((glyph) => glyph.code), bold.glyphs.map((glyph) => glyph.code));
  let sum = 0;
  for (let index = 0; index < avalon.glyphs.length; index += 1) {
    if (avalon.glyphs[index].approximated !== "advance-from-outline") continue;
    sum += avalon.glyphs[index].advance / bold.glyphs[index].advance;
  }
  const mean = sum / outline.length;
  assert.ok(mean > 0.95 && mean < 1.05,
    `derived advances average ${mean.toFixed(3)} of the sibling font's real ones; outside 0.95..1.05 the ` +
    "derivation has stopped tracking the typeface and the pack should say so louder");

  assert.equal(approximated.byKind["advance-from-outline"], 112);
  assert.equal(approximated.byKind["font-layout-absent"], 1);
});

test("the manifest tally is a recount of the pack, kind by kind", { skip }, () => {
  // ► THE ARENA-WALLS DEFECT, in this pack's shape. The data knew and the report
  //   said zero. Recomputing beats remembering.
  const { pack, approximated } = extractText(oracleBuffer());
  const recount = tallyApproximations(pack);
  assert.deepEqual(approximated, recount);
  assert.deepEqual(recount.byKind, {
    "advance-from-outline": 112,
    "advance-from-sibling-font": 2,
    "font-layout-absent": 1,
    "html-markup-stripped": 5
  });
  assert.equal(recount.total, 120);
  assert.ok(recount.glyphs > 0, "a zero population would make the deepEqual above vacuous");
});

test("an approximated item always says WHICH approximation, from a closed list", { skip }, () => {
  // A bare truthy flag would satisfy every count and tell a reader nothing: a
  // derived advance and stripped markup lead to different next actions.
  const known = new Set([
    "advance-from-outline", "advance-from-sibling-font", "advance-from-em-fraction",
    "font-layout-absent", "html-markup-stripped"
  ]);
  const { pack } = extractText(oracleBuffer());
  let checked = 0;
  const seen = [];
  for (const font of Object.values(pack.fonts)) {
    if (font.approximated) { checked += 1; seen.push(font.approximated); }
    for (const glyph of font.glyphs) if (glyph.approximated) { checked += 1; seen.push(glyph.approximated); }
  }
  for (const field of Object.values(pack.fields)) if (field.approximated) { checked += 1; seen.push(field.approximated); }
  for (const kind of seen) {
    assert.ok(known.has(kind), `unknown approximation kind ${JSON.stringify(kind)} — add it deliberately`);
  }
  assert.equal(checked, 120);
});

test("ALL 436 TEXT CHARACTERS ARE DEFINED AT THE ROOT, which swf-text.mjs's header denies", { skip }, () => {
  // ► That file states the build "defines text inside [sprites]" and that the
  //   436 "is only reachable by descending". Walking the root tag stream WITHOUT
  //   descending finds every one. The recursion is harmless; the sentence is
  //   wrong, and it is the reason a placement index had to be written here —
  //   definition is flat and only PLACEMENT is nested.
  const buffer = oracleBuffer();
  let statics = 0;
  let fields = 0;
  let sprites = 0;
  for (const { code, bodyStart, bodyEnd } of walkTags(buffer, tagStreamStart(buffer), buffer.length)) {
    if (code === TAG.DEFINE_SPRITE) sprites += 1;
    else if (code === 11 || code === 33) statics += 1;
    else if (code === 37) fields += 1;
    void bodyStart;
    void bodyEnd;
  }
  assert.equal(statics, 180);
  assert.equal(fields, 256);
  assert.ok(sprites > 700, "and the sprites the header blames are genuinely there — 740 of them");

  const recursive = indexText(buffer);
  assert.equal(recursive.totals.statics, statics, "descending finds not one more static");
  assert.equal(recursive.totals.fields, fields, "nor one more field");
});

test("the UI bar DEFINES no text and PLACES exactly two fields", { skip }, () => {
  // ► Sprite 1531 is `fiz_info_panel`, the arena's bottom bar.
  //   `extract-props.mjs` reports its two children as unsupported and drops
  //   them, which is why the bar renders blank. They are 1527 and 1528.
  const { pack } = extractText(oracleBuffer());
  const inBar = Object.entries(pack.placements)
    .filter(([, list]) => list.some((placement) => placement.owner === 1531))
    .map(([id]) => Number(id))
    .sort((left, right) => left - right);
  assert.deepEqual(inBar, [1527, 1528]);

  const sound = pack.fields[1527];
  assert.equal(sound.text, "sound:ON\r");
  assert.equal(sound.font, 1526);
  assert.equal(sound.fontHeight, 200, "TWIPS — a 10px em");
  assert.equal(sound.colour, "#ffffff");
  assert.equal(pack.fields[1528].text, "tooltips:off");
  // The instance name is how the build addresses it; the variable is empty.
  assert.equal(pack.placements[1527][0].name, "soundvar");
  assert.equal(pack.placements[1527][0].owner, 1531);
});

test("the placement walk's frame numbering agrees with the repository's own landmark", { skip }, () => {
  // ► `arena-backdrop.js` puts the arena screen at root frame 221 and the rain
  //   at depth 80 there. If this walk counted frames differently, every
  //   placement it reports would be filed under the wrong screen — which is the
  //   kind of off-by-one that reads as a plausible answer.
  const buffer = oracleBuffer();
  const { statics, fields } = indexText(buffer);
  const wanted = new Set([...statics.keys(), ...fields.keys()]);
  const { placements, failures } = indexTextPlacements(buffer, wanted);
  assert.deepEqual(failures, [], "a PlaceObject that cannot be read is a field that never appears");

  let records = 0;
  for (const list of placements.values()) records += list.length;
  assert.equal(placements.size, 409);
  assert.equal(records, 428);
  assert.equal(wanted.size - placements.size, 27, "27 text characters are never placed anywhere");

  // The landmark: the level-up screen is root frame 227, and it is where the
  // build places `fighttext_mov`. Reading it as 221 would put it on the arena.
  const fightText = placements.get(2250);
  assert.ok(Array.isArray(fightText) && fightText.length > 0, "character 2250 is placed somewhere");
  assert.equal(fightText[0].owner, null, "on the root, not inside a sprite");
  assert.equal(fightText[0].frame, 227);
  assert.equal(fightText[0].name, "fighttext_mov");
});

test("A STATIC RUN'S ADVANCES ARE BAKED AND ARE NOT THE FONT'S", { skip }, () => {
  // ► This is why the pack stores them per entry instead of recomputing. The
  //   exporter baked kerning and letter-spacing in; a run redrawn from font
  //   metrics is subtly wrong in a way that passes a glance.
  const buffer = oracleBuffer();
  const { pack } = extractText(buffer);
  const { fonts } = indexFonts(buffer);
  let checked = 0;
  let within = 0;
  let worst = 0;
  for (const item of Object.values(pack.statics)) {
    for (const record of item.records) {
      const font = fonts.get(record.font);
      if (!font || !font.advances) continue;
      for (const [index, advance] of record.glyphs) {
        const derived = font.advances[index] * record.height / FONT3_UNITS_PER_EM;
        checked += 1;
        if (Math.abs(derived - advance) <= 1) within += 1;
        worst = Math.max(worst, Math.abs(derived - advance));
      }
    }
  }
  assert.equal(checked, 4060, "one of the 4061 entries is in the font with no advance table");
  assert.ok(within < checked, "if these ever agreed everywhere, the baked advances would be redundant");
  assert.ok(within / checked > 0.7 && within / checked < 0.85,
    `${within}/${checked} baked advances are reproducible from the font; measured 78%`);
  assert.ok(worst > 100, `the worst disagreement is ${worst.toFixed(1)} twips, which is visible`);
});

test("the summary counts what the pack holds, including the five HTML fields", { skip }, () => {
  const { pack } = extractText(oracleBuffer());
  const totals = summarise(pack);
  assert.equal(totals.fonts, 9);
  assert.equal(totals.glyphs, 1027);
  assert.equal(totals.emptyGlyphs, 18, "two per font — space and nbsp");
  assert.equal(totals.fontsWithoutLayout, 1);
  assert.equal(totals.statics, 180);
  assert.equal(totals.fields, 256);
  assert.equal(totals.records, 206);
  assert.equal(totals.glyphEntries, 4061);
  assert.equal(totals.unresolvedGlyphEntries, 0, "every glyph index resolves to a glyph in its font");
  assert.equal(totals.htmlFields, 5);
  assert.equal(totals.fieldsWithVariable, 180);
  assert.deepEqual(totals.byAlign, { center: 101, left: 125, right: 30 });

  // An HTML field keeps its markup AND its plain reading, so nothing is lost by
  // the approximation that a renderer draws the second one.
  const html = pack.fields[1536];
  assert.equal(html.approximated, "html-markup-stripped");
  assert.match(html.markup, /<font face="GoudyHandtooled BT"/);
  assert.ok(!html.text.includes("<"), "the plain reading carries no markup");
});

/* ---------------------------------------------------------------- */
/* Against the pack this machine has actually written                */
/* ---------------------------------------------------------------- */

test("THE WRITTEN MANIFEST'S TALLY EQUALS WHAT THE WRITTEN PACK HOLDS", () => {
  // ► The recount that `test/extraction-honesty.test.js` performs for the other
  //   three packs, for this one. It belongs in that file's PACKS table; until
  //   the main session moves it, a lying manifest fails HERE by name.
  const at = path.join(REPO_ROOT, "assets", "text");
  const dataPath = path.join(at, "text.json");
  if (!fs.existsSync(dataPath)) {
    // A fresh clone has no licensed copy and therefore no extraction. Saying so
    // by name is the convention every asset-dependent test here follows.
    assert.equal(fs.existsSync(dataPath), false, `${dataPath} is absent, so there is nothing to check`);
    return;
  }
  const pack = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(at, "manifest.json"), "utf8"));
  const recount = tallyApproximations(pack);

  assert.ok(manifest.approximated && typeof manifest.approximated === "object",
    "the manifest carries no `approximated` tally at all — that is the arena-walls defect");
  assert.equal(manifest.approximated.total, recount.total,
    `manifest says ${manifest.approximated.total}, the pack holds ${recount.total}`);
  assert.deepEqual(manifest.approximated.byKind, recount.byKind,
    "the KINDS must match too: \"120 approximated\" and \"112 derived advances\" lead to different actions");
  assert.equal(manifest.approximated.glyphs, recount.glyphs);
  assert.deepEqual(manifest.failures, [], "a failure in the written pack is something nothing can draw");
  assert.match(manifest.licence, /COMMERCIALLY LICENSED TYPE/,
    "the licence line travels with the pack or a reader of the manifest alone does not know");
});
