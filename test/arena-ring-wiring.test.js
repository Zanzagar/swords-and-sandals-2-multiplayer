/**
 * THE RING'S WIRING IN THE SHELL (slice S2), read as TEXT: `tools/arena/main.js`
 * cannot be imported by node, so — as `test/arena-seats.test.js` section 5
 * does — this pins the few lines that hand the ring's decisions to the page:
 *
 * 1. a person's turn builds the ring from the panel's offer (no second read of
 *    the engine's offer), only after an AI seat's turn has returned, and keeps
 *    the raw list only for a rule set with no ring;
 * 2. an AI seat's turn never touches the ring;
 * 3. whatever a click or a key sends goes through ONE function that re-asks
 *    whose turn it is before it submits;
 * 4. every element the shell looks up by id exists in `index.html`, the
 *    strip under the stage included.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const raw = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../tools/arena/index.html", import.meta.url), "utf8");

/** Comments out, strings blanked, so a word in prose cannot match. */
function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
}
const code = codeOnly(raw);

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

test("a person's turn is the ring, built from the panel's offer after the AI's turn has returned; the raw list is the fallback", () => {
  const controls = functionBody("renderControls");
  const note = controls.indexOf("if (panel.note !== null)");
  const ring = controls.indexOf("ringModelFor(");
  const fallback = controls.indexOf("panel.buttons.map(({ action, enabled }) =>");
  assert.ok(note >= 0 && ring > note, "the ring is built only once an AI seat's turn has returned");
  assert.ok(fallback > ring, "the raw buttons come after the ring, as its fallback");
  assert.match(controls.slice(ring), /legal: panel\.buttons\.map\(\(\{ action \}\) => action\)/, "the ring reads the panel's offer");
  assert.match(controls.slice(ring), /menuFor: \(targetId\) => host\.unavailableActions\(actorId, targetId\)/);
  assert.match(controls.slice(ring, fallback), /if \(ring\.stance\) \{[\s\S]*?return;\s*\}/, "a ring with a stance returns before the raw list");
  assert.ok(controls.indexOf("ringView = null;") >= 0 && controls.indexOf("ringView = null;") < note,
    "every branch before a person's ring leaves none on screen");
});

test("an AI seat's turn never touches the ring", () => {
  const step = functionBody("aiTurnStep");
  assert.equal((step.match(/ring/gi) ?? []).length, 0);
});

test("a click, a key and a strip button all act through actFromRing, which re-asks whose turn it is before it submits", () => {
  const act = functionBody("actFromRing");
  const asks = act.indexOf("seatTurnFor(host.battle, seats,");
  const submits = act.indexOf("host.submit(");
  assert.ok(asks >= 0 && submits > asks, "the turn is re-read before the submit");
  assert.match(act, /current\.ai/);
  assert.match(act, /current\.actorId !== view\.actorId/);
  assert.match(act, /if \(!current\.ready\) return;/, "nothing is sent while the arena is still drawing");
  assert.equal((code.match(/host\.submit\(/g) ?? []).length, 3, "the raw buttons, the AI seat, and the ring — no fourth route");
  assert.match(code, /ringSlotAt\(ringButtons, point\.x, point\.y\)/);
  assert.match(code, /actFromRing\(ringActionFor\(ringView\.model, slot\)\)/);
  assert.match(code, /foeAt\(fighterBoxes, point\.x, point\.y, ringView\.model\.foeIds\)/);
  assert.match(code, /const command = ringKeyCommand\(ringView\.model, \{/);
  assert.match(code, /if \(command\.kind === ""\) actFromRing\(command\.action\);/);
});

test("every element the shell looks up by id is in index.html, the strip under the stage included", () => {
  const ids = [...new Set([...raw.matchAll(/\bel\("([^"]+)"\)/g)].map((match) => match[1]))];
  for (const id of ["ring-strip", "ring-target", "ring-slots", "ring-off", "ring-status", "ring-live"]) {
    assert.ok(ids.includes(id), `main.js reads #${id}`);
  }
  for (const id of ids) assert.match(page, new RegExp(`id="${id}"`), `#${id} is declared in index.html`);
  // The strip sits UNDER the stage, in the stage's own column, and the live region is polite.
  assert.ok(page.indexOf('id="stage"') < page.indexOf('id="ring-strip"') && page.indexOf('id="ring-strip"') < page.indexOf("<aside"));
  assert.match(page, /id="ring-live"[^>]*aria-live="polite"|aria-live="polite"[^>]*id="ring-live"/);
  assert.match(page, /<canvas id="arena" tabindex="0"/, "the stage takes the focus, so Tab can switch the target there");
});

test("every name the shell imports is exported by the module it names — the ring's two modules included", async () => {
  const imports = [...raw.matchAll(/import\s*\{([^}]*)\}\s*from\s*"(\/[^"]+)"/g)];
  const sources = imports.map((match) => match[2]);
  assert.ok(sources.includes("/tools/arena/ring.js") && sources.includes("/tools/arena/ring-layout.js"));
  for (const [, names, source] of imports) {
    const module = await import(new URL(`..${source}`, import.meta.url));
    for (const name of names.split(",").map((part) => part.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
      assert.ok(name in module, `${source} exports ${name}`);
    }
  }
});
