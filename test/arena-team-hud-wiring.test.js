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

test("H1: a roster row takes his side's colour and initial from the same model", () => {
  const roster = functionBody("renderRoster");
  assert.match(roster, /teamStyleFor\(combatant\.teamId\)/);
  assert.match(roster, /node\.style\.setProperty\("", team\.colour\);/);
  assert.match(roster, /initial\.textContent = team\.initial;/);
});
