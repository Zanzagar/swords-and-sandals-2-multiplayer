/**
 * "AM I THE SCRIPT NODE WAS ASKED TO RUN?" — ASKED OF TWO READ-ONLY TOOLS FROM
 * A PATH THAT HOLDS A SPACE.
 *
 * ► **THE DEFECT.** `tools/clip-sequences.mjs` and `tools/swf-probe.mjs` used
 *   to decide it by comparing `import.meta.url` with the string
 *   `"file://" + process.argv[1]`. A URL percent-encodes a space (`%20`) and a
 *   Windows path is not a URL path at all, so from `C:\...` or from any
 *   directory with a space in its name the two strings never matched, the tool
 *   ran NOTHING, and exited 0: success, to anything that ran it. Found by the
 *   extract-all implementer, whose change replaces the same form in
 *   `tools/extract-figure.mjs` and `tools/extract-wardrobe.mjs` — both still
 *   carried it when this file was written (2026-09-24, on `ef48e17`).
 *
 * ► **WHY A COPY IN A SCRATCH DIRECTORY, not the file where it lives.** The
 *   checkout's own path decides whether the old form fails, so a test that ran
 *   the tool in place would pass or fail by where somebody cloned the repo.
 *   Each tool is copied into a directory whose name holds a space and run from
 *   there. Both import only `node:` built-ins on the path exercised here, so
 *   the copy runs alone.
 *
 * ► **AND THE NAME ALSO HOLDS `#` AND A LITERAL `%20`**, added 2026-09-24 after
 *   a Codex review found this file making the very mistake it pins: it built
 *   the import URL below by pasting a path after `file://`, which a `#` cuts
 *   short and a `%` misdecodes. Reproduced by adding the two characters here —
 *   all four import tests failed — and fixed with `pathToFileURL`. The tools
 *   themselves read both correctly; the test did not.
 *
 * ► **WHAT RUNS: THE USAGE PATH, AND NOTHING ELSE.** With no arguments each
 *   tool prints its usage line and exits 2. Nothing reads a SWF, the installed
 *   build or the save; nothing is written but the copies, which are removed.
 *   "Exit 2 and the usage line" is the observable proof that `main` ran; the old
 *   guard's miss is "exit 0 and no output at all".
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Each tool, where its usage line goes, and the words that prove `main` ran. */
const TOOLS = [
  { script: "clip-sequences.mjs", stream: "stdout", usage: /^usage: node tools\/clip-sequences\.mjs <file\.swf>/m },
  { script: "swf-probe.mjs", stream: "stderr", usage: /^usage: node tools\/swf-probe\.mjs <clip\|glow\|both> --out <dir>/m }
];

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "ss2-main-guard-"));
after(() => fs.rmSync(workspace, { recursive: true, force: true }));

const SPACED = path.join(workspace, "with space, #hash and %20");
fs.mkdirSync(SPACED);
for (const { script } of TOOLS) {
  fs.copyFileSync(path.join(REPO_ROOT, "tools", script), path.join(SPACED, script));
}

/** Runs node on `args`, from the workspace, and returns what came back. */
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: workspace, encoding: "utf8", timeout: 60_000 });
  if (result.error) throw result.error;
  return result;
}

for (const { script, stream, usage } of TOOLS) {
  test(`${script} run from a directory whose name holds a space prints its usage and exits 2`, () => {
    const copy = path.join(SPACED, script);
    assert.ok(copy.includes(" "), `the copy's path must hold a space, or this measures nothing: ${copy}`);
    const result = run([copy]);
    assert.match(result[stream], usage, `${script} ran nothing: stdout ${JSON.stringify(result.stdout)}, ` +
      `stderr ${JSON.stringify(result.stderr)}`);
    assert.equal(result.status, 2, `${script} exited ${result.status}; a tool that ran nothing exits 0`);
  });
}

/**
 * ► **AND THROUGH A LINK, WHICH THE RESOLVED-PATH FORM STILL MISSES.** node
 *   runs the TARGET of a symlink: `import.meta.url` names the file the link
 *   points at, while `process.argv[1]` keeps the link's own path. So
 *   `fileURLToPath(import.meta.url) === path.resolve(process.argv[1])` — the
 *   form the other extractors use — is false through a symlinked directory, and
 *   the tool again runs nothing and exits 0. Measured 2026-09-24 on node 26.3.1
 *   before this test was written: `self` was the target, `path.resolve(argv[1])`
 *   the link. A `"junction"` is asked for because Windows makes one without
 *   privileges; everywhere else the type argument is ignored.
 */
const LINKED = path.join(workspace, "linked tools");
fs.symlinkSync(SPACED, LINKED, "junction");

for (const { script, stream, usage } of TOOLS) {
  test(`${script} run through a symlinked directory prints its usage and exits 2`, () => {
    const viaLink = path.join(LINKED, script);
    assert.notEqual(fs.realpathSync(viaLink), viaLink, "the path must go through the link, or this measures nothing");
    const result = run([viaLink]);
    assert.match(result[stream], usage, `${script} ran nothing through the link: stdout ` +
      `${JSON.stringify(result.stdout)}, stderr ${JSON.stringify(result.stderr)}`);
    assert.equal(result.status, 2, `${script} exited ${result.status} through the link`);
  });
}

/**
 * ► **AND IMPORTED, IT IS NOT THE SCRIPT — WHATEVER `argv[1]` HOLDS.** Tests
 *   import these tools' exports, so the guard runs in processes that are not
 *   the tool. Under `node -e`, `process.argv[1]` is the first extra argument
 *   (measured: `["not-a-file","extra"]`), or absent with none. A real-path
 *   comparison that let `realpathSync` throw on a path that does not exist, or
 *   that resolved an absent one, would turn an import into a crash.
 */
for (const { script } of TOOLS) {
  const own = path.join(SPACED, script);
  for (const [label, extra] of [
    ["no argument", []],
    ["an argument that is not a file", ["not-a-file"]],
    // ► **AND AN ARGUMENT THAT NAMES THIS VERY FILE**, added 2026-09-24 after a
    //   Codex review reproduced it: `node -e 'await import("./tools/swf-probe.mjs")'
    //   ./tools/swf-probe.mjs` printed the usage on IMPORT, because any path
    //   comparison is a comparison with whatever `argv[1]` happens to hold.
    //   Relative, absolute and through the link, so no path form is spared.
    ["its own path, relative, as the argument", [`./${path.relative(workspace, own)}`]],
    ["its own path, absolute, as the argument", [own]],
    ["its own path through the link as the argument", [path.join(LINKED, script)]]
  ]) {
    test(`${script} imported under node -e with ${label} runs nothing and throws nothing`, () => {
      const url = pathToFileURL(path.join(SPACED, script));
      const result = run(["--input-type=module", "-e",
        `await import(${JSON.stringify(url.href)}); console.log("imported");`, ...extra]);
      assert.equal(result.stderr, "", `${script} wrote to stderr on import`);
      assert.equal(result.stdout, "imported\n", `${script} printed something of its own on import`);
      assert.equal(result.status, 0);
    });
  }
}
