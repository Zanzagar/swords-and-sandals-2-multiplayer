/**
 * `renderStage` in `tools/arena/main.js` must not read `step`.
 *
 * The browser shell cannot be imported under `node --test` (it touches the DOM
 * at load), so an undeclared name inside it only fails in a browser — and
 * `tools/arena/main.js` caught that failure once per session and logged it,
 * so nobody saw it. `seed: step.actionBoundary` sat in the blood spawn from
 * f0a3780 (2026-09-13) to 2026-09-23 and threw at the first effect pose of
 * every hurt or death clip: no drop was ever drawn. `step` is `beginStep`'s
 * parameter and exists nowhere else at that level; the draw loop has the
 * timeline entry, which carries the same action token.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");

/** The text of one top-level `function name(...) {...}`, by brace matching on comment-free code. */
function functionBody(code, name) {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is not defined in tools/arena/main.js`);
  let depth = 0;
  for (let index = code.indexOf("{", start); index < code.length; index += 1) {
    if (code[index] === "{") depth += 1;
    else if (code[index] === "}") { depth -= 1; if (depth === 0) return code.slice(start, index + 1); }
  }
  throw new Error(`${name}'s braces do not balance`);
}

/** Comments out, strings and template text blanked, so a word in prose cannot match. */
function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
}

test("renderStage reads no `step`: the draw loop has the timeline entry, not beginStep's parameter", () => {
  const body = functionBody(codeOnly(source), "renderStage");
  const uses = body.match(/(?<![.\w$])step(?![\w$])/g) ?? [];
  assert.equal(uses.length, 0, "`step` is not in scope in renderStage — use the entry's `token`");
});

test("and the blood spawn is seeded from the entry's action token", () => {
  const body = functionBody(codeOnly(source), "renderStage");
  assert.match(body, /seed:\s*entry\.token\s*\?\?\s*scene\.sequence/);
});
