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

test("H1: the name plate is stroked in the model's outline, filled in his side's colour, underlined and given its initial", () => {
  const stage = functionBody("renderStage");
  const plate = stage.slice(stage.indexOf("const plate = namePlateFor(combatant);"));
  assert.ok(plate.length < stage.length, "the plate is coloured by namePlateFor");
  assert.match(plate, /const plateShape = namePlateLayout\(\{ x: nameX, baseline: nameY, px: namePx, nameWidth: context\.measureText\(combatant\.name\)\.width \}\);/);
  // The outline under the name, then the name in the side's colour — in that order.
  const stroke = plate.indexOf("context.strokeText(combatant.name, nameX, nameY);");
  const fill = plate.indexOf("context.fillText(combatant.name, view.toX(origin.x), nameY);");
  assert.ok(stroke >= 0 && fill > stroke, "the outline is stroked under the name");
  assert.ok(plate.indexOf("context.strokeStyle = plate.outline;") < stroke);
  assert.ok(plate.indexOf("context.fillStyle = plate.fill;") < fill && plate.indexOf("context.fillStyle = plate.fill;") > stroke);
  assert.match(plate, /context\.globalAlpha = plate\.alpha;/, "the dead are faint, as they were");
  // The underline over its outline, and the initial on its disc.
  assert.match(plate, /context\.fillStyle = plate\.outline;\s*context\.fillRect\(lineOutline\.x, lineOutline\.y, lineOutline\.width, lineOutline\.height\);\s*context\.fillStyle = plate\.underline;\s*context\.fillRect\(line\.x, line\.y, line\.width, line\.height\);/);
  assert.match(plate, /context\.arc\(disc\.x, disc\.y, disc\.r, 0, Math\.PI \* 2\);/);
  assert.match(plate, /context\.fillText\(plate\.initial, disc\.x, disc\.y\);/);
  // Its state does not leak into the next fighter or the ring.
  const saved = plate.indexOf("context.save();");
  assert.ok(saved >= 0 && saved < plate.indexOf("context.globalAlpha = plate.alpha;"), "saved before the plate's own font, alpha and baseline");
  assert.ok(plate.indexOf("context.restore();") > plate.indexOf("context.fillText(plate.initial"), "and restored after it");
});

const page = fs.readFileSync(new URL("../tools/arena/index.html", import.meta.url), "utf8");

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
  const reading = rawBody("readingNode");
  assert.match(reading, /reading\.shown \? `\$\{reading\.value\} \/ \$\{reading\.max\}` : "—"/);
  assert.match(reading, /fill\.style\.width = `\$\{reading\.shown \? reading\.percent : 0\}%`;/);
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
  assert.match(strip, /item\.append\(teamInitialNode\(entry\), hudNode\("span", "turn-name", entry\.name\)\);/);
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
  const rule = (selector) => {
    const found = new RegExp(`\\n\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`).exec(page);
    assert.ok(found, `index.html has a ${selector} rule`);
    return found[1];
  };
  const strip = rule(".turn-strip");
  assert.doesNotMatch(strip, /overflow(-x)?: (auto|scroll)/, "no scrollbar inside the fixed height");
  assert.match(strip, /overflow: hidden;/);
  assert.match(rule(".turn-chip"), /flex: 0 1 auto;[^]*min-width: 0;/, "a chip may shrink below its name's width");
  assert.match(rule(".turn-chip .turn-name"), /overflow: hidden;[^]*text-overflow: ellipsis;[^]*white-space: nowrap;/, "and its name ends in an ellipsis");
  // The whole name is still there to read, and nothing scrolls.
  const strip2 = rawBody("renderTurnStrip");
  assert.match(strip2, /item\.title = entry\.name;/);
  assert.doesNotMatch(strip2, /scroll/);
});
