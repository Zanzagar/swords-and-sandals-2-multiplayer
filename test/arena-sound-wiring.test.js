/**
 * WHERE `tools/arena/main.js` sounds a clip, read as TEXT because node cannot
 * import it (it touches the DOM at load).
 *
 * The decisions are under the suite elsewhere — `sound-timing.js` (when),
 * `sound-player.js` (how). What only the text can show is that the shell asks
 * them at the right places: from the draw loop, by the clock the figure is
 * posed with, and nowhere at a clip's start. The first version of sound here
 * fired at `beginStep` with a `setTimeout` for a delayed victim, and nothing
 * could see that it ignored every frame the build puts a sound on.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../tools/arena/main.js", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../tools/arena/index.html", import.meta.url), "utf8");

/** Comments out, strings blanked, so a word in prose cannot match. */
function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
}

/** The text of one top-level `function name(...) {...}`, by brace matching. */
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

const code = codeOnly(source);

test("a clip's sounds fire from the DRAW LOOP, with the facing the figure is drawn with", () => {
  const stage = functionBody(code, "renderStage");
  assert.match(stage, /if \(entry\) soundEntry\(entry, now, facing\);/);
  // And by `dueSoundCues`, on the entry's own clock.
  const entry = functionBody(code, "soundEntry");
  assert.match(entry, /dueSoundCues\(entry\.soundPlan, \{\s*elapsedMs: now - entry\.startedAt,\s*durationMs: entry\.timeline\.durationMs/);
});

test("NOTHING sounds a clip at its start any more — no playFor, no setTimeout for a victim", () => {
  assert.equal((code.match(/\bplayFor\b/g) ?? []).length, 0, "`playFor` is gone from the code");
  const begin = functionBody(code, "beginStep");
  assert.equal((begin.match(/\bsetTimeout\b/g) ?? []).length, 0);
  assert.equal((begin.match(/soundPlayer\.play\(/g) ?? []).length, 0);
  // The only call that plays a cue is in `soundEntry`.
  assert.equal((code.match(/soundPlayer\.play\(/g) ?? []).length, 1);
});

test("an entry LEAVING `playing` is settled first — replaced, expired or handed on", () => {
  const begin = functionBody(code, "beginStep");
  assert.match(begin, /settleEntrySounds\(combatantId, playing\.get\(combatantId\), performance\.now\(\)\);\s*playing\.set\(combatantId, entry\);/);
  const drain = functionBody(code, "drainFinishedAnimations");
  assert.match(drain, /settleEntrySounds\(combatantId, playing\.get\(combatantId\), now\);\s*playing\.set\(combatantId, prepareEntry\(entry\)\);/);
  assert.match(drain, /settleEntrySounds\(combatantId, playing\.get\(combatantId\), now\);\s*playing\.delete\(combatantId\);/);
  // And a prepared entry starts with no plan and nothing fired.
  const prepare = functionBody(code, "prepareEntry");
  assert.match(prepare, /entry\.soundPlan = null;\s*entry\.soundsFired = 0;/);
});

test("the plan is the DRAWN clip's: the rig's own resolved label goes in", () => {
  const plan = functionBody(code, "soundPlanFor");
  assert.match(plan, /animationFor\(figurePack, \{ family, label, facing \}\)/);
  assert.match(plan, /soundCuesFor\(/);
  assert.match(plan, /drawnLabel/);
});

test("the master volume is a real DOM control, wired to the player", () => {
  assert.match(page, /<input id="volume" type="range" min="0" max="100"/);
  assert.match(page, /<output id="volume-readout"/);
  const apply = functionBody(code, "applyVolume");
  assert.match(apply, /soundPlayer\.setVolume\(masterGainFor\(position\)\)/);
});

test("the gesture resumes the context, and the toggle reaches the player", () => {
  const unblock = functionBody(code, "unblockAudio");
  assert.match(unblock, /soundPlayer\.unlock\(\)/);
  assert.match(code, /soundEnabled = !soundEnabled;\s*soundPlayer\.setEnabled\(soundEnabled\);/);
});
