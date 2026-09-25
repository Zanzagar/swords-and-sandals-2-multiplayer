/**
 * THE TEAM HUD'S WIRING in `tools/arena/main.js` and `tools/arena/index.html`,
 * read as TEXT: the shell cannot be imported by node (it needs a canvas and a
 * DOM), so what it draws is pinned by what it calls. Every decision is
 * `tools/arena/team-hud.js`'s, under `test/arena-team-hud.test.js`; this pins
 * only that the shell draws what the model says.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const raw = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
/** Comments out, strings blanked, so a word in prose cannot match. */
const code = raw
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');

/** A function's body in `code` (comments out, strings blanked), sliced by its braces. */
function functionBody(name) {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is not defined in tools/arena/main.js`);
  let depth = 0;
  for (let index = code.indexOf("{", start); index < code.length; index += 1) {
    if (code[index] === "{") depth += 1;
    else if (code[index] === "}") { depth -= 1; if (depth === 0) return code.slice(start, index + 1); }
  }
  throw new Error(`${name}'s braces do not balance`);
}

/**
 * The same function as WRITTEN, for a pin on a template string, whose text `code` blanks: from its
 * `function` to the closing brace that starts a line (every top-level function in main.js ends so).
 */
function rawBody(name) {
  const start = raw.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is not defined in tools/arena/main.js`);
  const end = raw.indexOf("\n}\n", start);
  assert.ok(end > start, `${name} has no closing brace at the start of a line`);
  return raw.slice(start, end + 2);
}

test("H1: the name plate is the name alone — stroked in the model's outline, filled in his side's colour; no underline, no initial (D1)", () => {
  const stage = functionBody("renderStage");
  const from = stage.indexOf("const plate = namePlateFor(combatant);");
  assert.ok(from >= 0, "the plate is coloured by namePlateFor");
  // The plate: from its colours to the restore that ends it.
  const end = stage.indexOf("context.restore();", from);
  assert.ok(end > from, "the plate's drawing state is restored");
  const plate = stage.slice(from, end + "context.restore();".length);
  assert.match(plate, /const plateShape = namePlateLayout\(\{ px: namePx \}\);/);
  // The outline under the name, then the name in the side's colour — in that order.
  const stroke = plate.indexOf("context.strokeText(combatant.name, nameX, nameY);");
  const fill = plate.indexOf("context.fillText(combatant.name, view.toX(origin.x), nameY);");
  assert.ok(stroke >= 0 && fill > stroke, "the outline is stroked under the name");
  assert.ok(plate.indexOf("context.strokeStyle = plate.outline;") < stroke);
  assert.ok(plate.indexOf("context.lineWidth = plateShape.outlineWidth;") < stroke, "at the model's width");
  assert.ok(plate.indexOf("context.fillStyle = plate.fill;") < fill && plate.indexOf("context.fillStyle = plate.fill;") > stroke);
  assert.match(plate, /context\.globalAlpha = plate\.alpha;/, "the dead are faint, as they were");
  // D1: the name is ALL it draws — ~~the underline over its outline, and the initial on its disc~~.
  assert.deepEqual([...plate.matchAll(/context\.(\w+)\(/g)].map((call) => call[1]), ["save", "strokeText", "fillText", "restore"],
    "the plate draws its name's outline and its name, and nothing else");
  // Its state does not leak into the next fighter or the ring.
  const saved = plate.indexOf("context.save();");
  assert.ok(saved >= 0 && saved < plate.indexOf("context.globalAlpha = plate.alpha;"), "saved before the plate's own font, alpha and baseline");
  assert.ok(plate.lastIndexOf("context.restore();") > fill, "and restored after the name is drawn");
});

const page = fs.readFileSync(new URL("../tools/arena/index.html", import.meta.url), "utf8");

/** The declarations of one of `index.html`'s CSS rules, by its exact selector at the start of a line. */
function cssRule(selector) {
  const found = new RegExp(`\\n\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`).exec(page);
  assert.ok(found, `index.html has a ${selector} rule`);
  return found[1];
}

test("H2: the side panel is the model's — the crowd meter, then a panel per side with a row per fighter", () => {
  const roster = functionBody("renderRoster");
  assert.match(roster, /const hud = teamHudFor\(\{ wire: host\.wire\(\), seats, crowdShown: crowdHeard \}\);\s*renderCrowdMeter\(hud\.crowd\);\s*el\(""\)\.replaceChildren\(\.\.\.hud\.teams\.map\(teamPanelNode\)\);/);
  assert.match(raw, /el\("roster"\)\.replaceChildren\(\.\.\.hud\.teams\.map\(teamPanelNode\)\)/);
  const panel = functionBody("teamPanelNode");
  assert.match(panel, /panel\.style\.setProperty\("", team\.colour\);/);
  assert.match(panel, /rows\.append\(\.\.\.team\.rows\.map\(fighterRowNode\)\);/);
  assert.match(rawBody("teamPanelNode"), /hudNode\("span", "team-standing", `\$\{team\.standing\} of \$\{team\.rows\.length\} standing`\)/);
  const row = rawBody("fighterRowNode");
  assert.match(row, /hudNode\("li", `fighter\$\{row\.acting \? " acting" : ""\}\$\{row\.alive \? "" : " down"\}\$\{row\.you \? " you" : ""\}`\)/);
  assert.match(row, /node\.style\.setProperty\("--team", row\.colour\);/);
  assert.match(row, /if \(row\.acting\) node\.setAttribute\("aria-current", "true"\);/, "the turn is aria-current, not colour alone");
  assert.match(row, /if \(row\.acting\) tags\.append\(hudNode\("span", "tag turn", "turn"\)\);/);
  assert.match(row, /if \(!row\.alive\) tags\.append\(hudNode\("span", "tag down", "down"\)\);/);
  assert.match(row, /if \(row\.seat\) tags\.append\(hudNode\("span", `seat\$\{row\.you \? " you" : ""\}`, row\.seat\)\);/);
  assert.match(row, /for \(const condition of row\.conditions\) \{\s*const chip = hudNode\("span", "chip", condition\.words\);\s*chip\.title = condition\.title;/);
  assert.match(row, /readingNode\("Health", row\.health, "health"\),\s*readingNode\("Energy", row\.energy, "energy"\),\s*readingNode\("Armour", row\.armour, "armour"\)/);
  // ► RE-PINNED FOR D5 of the in-frame team HUD (2026-09-25): ~~`reading.shown ? `${value} / ${max}` :
  //   "—"` and the bar's `fill.style.width`~~ — the readings are the build's own gauges in the frame now,
  //   and each row keeps them only as a visually hidden meter, its value in words
  //   (`test/arena-combat-hud-wiring.test.js` pins the whole of it).
  const reading = rawBody("readingNode");
  assert.match(reading, /meter\.setAttribute\("aria-valuetext", reading\.shown \? `\$\{reading\.value\} of \$\{reading\.max\}` : "none"\);/);
  assert.match(reading, /hudNode\("span", `visually-hidden reading-\$\{kind\}`\)/);
  const crowd = rawBody("renderCrowdMeter");
  assert.match(crowd, /el\("crowd"\)\.hidden = !crowd\.shown;\s*if \(!crowd\.shown\) return;/);
  assert.match(crowd, /\.textContent = crowd\.text;/);
  assert.match(crowd, /\.style\.width = `\$\{crowd\.percent\}%`;/);
  assert.match(crowd, /\.style\.left = `\$\{crowd\.booBelow\}%`;/);
  assert.match(crowd, /\.style\.left = `\$\{crowd\.cheerAbove\}%`;/);
  // No raw status token reaches the page: the list used to print `status.join(", ")`.
  assert.equal((code.match(/status\.join\(/g) ?? []).length, 0);
});

test("H2: the crowd meter is at the top of the side panel, the team panels under it, and the panel's own text under them", () => {
  const at = (needle) => {
    const index = page.indexOf(needle);
    assert.ok(index >= 0, `index.html has ${needle}`);
    return index;
  };
  assert.ok(at("<aside") < at('id="crowd"'));
  assert.ok(at('id="crowd"') < at('id="roster"'));
  assert.ok(at('id="roster"') < at('id="turn-heading"'));
  assert.ok(at('id="roster"') < at("What you are looking at"));
  assert.match(page, /<section class="crowd" id="crowd"[^>]*\bhidden>/, "no meter until the model says there is a crowd");
  assert.match(page, /id="crowd-bar" role="meter"/);
});

test("H3: the turn-order strip is the model's, drawn with the side panel on every turn, as DOM only — no canvas, no camera", () => {
  assert.match(functionBody("renderRoster"), /renderTurnStrip\(hud\.turnOrder\);/, "redrawn with the panels, on every turn");
  const strip = rawBody("renderTurnStrip");
  assert.match(strip, /const strip = el\("turn-strip"\);\s*strip\.replaceChildren\(\.\.\.order\.map\(\(entry\) => \{/);
  assert.match(strip, /hudNode\("li", `turn-chip\$\{entry\.current \? " current" : ""\}\$\{entry\.alive \? "" : " down"\}`\)/);
  assert.match(strip, /item\.style\.setProperty\("--team", entry\.colour\);/);
  assert.match(strip, /if \(entry\.current\) item\.setAttribute\("aria-current", "step"\);/);
  assert.match(strip, /item\.append\(hudNode\("span", "turn-name", entry\.name\)\);/);
  assert.match(strip, /if \(!entry\.alive\) item\.append\(hudNode\("span", "visually-hidden", " \(down\)"\)\);/, "struck through, and said");
  // Nothing of the stage: it never draws on the canvas nor moves the camera.
  assert.doesNotMatch(strip, /\b(context|canvas|camera|cameraFrame|render|scrollIntoView)\b/);
});

test("H3: the strip stands just above the stage, outside it, at a fixed height, so the stage is the same size every turn", () => {
  const column = page.slice(page.indexOf('<div class="stage-column">'), page.indexOf("<aside"));
  const strip = column.indexOf('id="turn-strip"');
  assert.ok(strip >= 0, "in the stage's own column");
  assert.ok(strip < column.indexOf('<div id="stage">'), "above the stage, not inside it");
  assert.match(column, /<ol class="turn-strip" id="turn-strip" aria-label="Turn order"><\/ol>\s*<div id="stage">/);
  assert.match(page, /\.turn-strip \{[^}]*flex: 0 0 auto;[^}]*height: 30px;/, "a fixed height");
  assert.match(page, /\.turn-chip\.down \.turn-name \{[^}]*text-decoration: line-through;/, "the fallen struck through");
});

test("H3 (Codex review of H3, pass 1): the strip never scrolls — a classic scrollbar would eat its fixed 30 px — the names shrink instead", () => {
  const strip = cssRule(".turn-strip");
  assert.doesNotMatch(strip, /overflow(-x)?: (auto|scroll)/, "no scrollbar inside the fixed height");
  assert.match(strip, /overflow: hidden;/);
  assert.match(cssRule(".turn-chip"), /flex: 0 1 auto;[^]*min-width: 0;/, "a chip may shrink below its name's width");
  assert.match(cssRule(".turn-chip .turn-name"), /overflow: hidden;[^]*text-overflow: ellipsis;[^]*white-space: nowrap;/, "and its name ends in an ellipsis");
  // The whole name is still there to read, and nothing scrolls.
  const strip2 = rawBody("renderTurnStrip");
  assert.match(strip2, /item\.title = entry\.name;/);
  assert.doesNotMatch(strip2, /scroll/);
});

test("D1: no initial and no underline anywhere on the page — the heading, the rows and the strip name a side by its colour alone", () => {
  // The owner, 2026-09-24: "the team names dont need the R and B icons next to them and underlined. Colors suffice."
  assert.doesNotMatch(code, /teamInitialNode/, "~~a side's initial on its disc~~ is drawn nowhere");
  for (const name of ["renderStage", "teamPanelNode", "fighterRowNode", "renderTurnStrip"]) {
    assert.doesNotMatch(functionBody(name), /\binitial\b|underline/, `${name} draws no initial and no underline`);
  }
  assert.match(rawBody("teamPanelNode"), /heading\.append\(`\$\{team\.name\} team`, hudNode\("span", "team-standing", /);
  assert.match(rawBody("fighterRowNode"), /const name = hudNode\("span", "name", row\.name\);/);
  assert.doesNotMatch(page, /team-initial/, "and no style for one");
  // The strip chip's coloured bottom border was an underline too; the current chip is ringed instead.
  assert.doesNotMatch(cssRule(".turn-chip"), /border-bottom/, "no coloured underline under a chip");
  assert.doesNotMatch(cssRule(".turn-chip.current"), /border-bottom/);
  assert.match(cssRule(".turn-chip.current"), /border-color: var\(--warn\);[^]*box-shadow: 0 0 0 1px var\(--warn\);/, "the current chip is ringed, not underlined");
  // Every colour cue that remains, where it was: the colour is now the only one.
  assert.match(cssRule(".team-panel"), /border-top: 3px solid var\(--team, var\(--edge\)\);/);
  assert.match(cssRule(".team-heading"), /color: var\(--team, var\(--ink\)\);/);
  assert.match(cssRule(".fighter"), /border-left: 3px solid var\(--team, var\(--edge\)\);/);
  assert.match(cssRule(".fighter .name"), /color: var\(--team, var\(--ink\)\);/);
  assert.match(cssRule(".turn-chip .turn-name"), /color: var\(--team, var\(--ink\)\);/);
});
