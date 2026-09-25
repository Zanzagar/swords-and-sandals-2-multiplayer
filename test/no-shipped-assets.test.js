/**
 * The distribution rule, enforced by something other than care.
 *
 * `AGENTS.md` has always said it: **ship no SS2 asset.** The repository is
 * meant to be shared, so someone who clones it must still need their own
 * licensed copy to play — the Doom-source-port model, shipping no WAD.
 *
 * ► **UNTIL 2026-09-10 NOTHING MECHANICAL CHECKED IT.** No test enumerated
 *   tracked files, and `.gitignore` carries no rule for any image, audio, font
 *   or SWF extension. The only committed-content gate that existed is the
 *   stray-`.jsonl` check in `test/ss2-capture-attestation.test.js`, which is
 *   scoped to `test/observations/` alone. That gap was found by a write-nothing
 *   reader briefed on something else, and it reported the gap as OUTRANKING the
 *   question it was asked, which was right.
 *
 *   The gap had never been live, because until the browser arena there was no
 *   directory in this tree that would plausibly want a binary file next to the
 *   code. There is now, so the gate lands with it. `.gitignore`'s own comment
 *   records what happens without one: 67 raw traces went in under `git add -A`
 *   on 2026-09-01, and ignoring them was called "the second line of defence"
 *   precisely because a test is the first.
 *
 * WHAT THIS TEST IS NOT. It cannot tell a licensed asset from an original one —
 * no test can. It asserts the cheaper and checkable thing: this repository
 * ships SOURCE, and every rendered thing in it is drawn from code. A PNG that
 * arrives here is a decision someone has to make deliberately, by editing this
 * list, rather than a file that slipped in behind `git add -A`.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * Extensions that carry rendered or compiled content rather than source. A
 * licensed asset would arrive as one of these; so would an innocent one, which
 * is the point — the check is on the CATEGORY, so the argument happens here
 * rather than in a code review that did not look at the diff's binary half.
 */
const ASSET_EXTENSIONS = Object.freeze([
  // Images
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".ico", ".tga", ".psd", ".ai",
  // Audio and video
  ".mp3", ".wav", ".ogg", ".flac", ".m4a", ".mp4", ".webm", ".mov", ".avi",
  // Flash and its neighbours
  ".swf", ".flv", ".fla", ".spl", ".sol",
  // Fonts
  ".ttf", ".otf", ".woff", ".woff2", ".eot",
  // Archives and binaries, which can carry any of the above
  ".zip", ".rar", ".7z", ".tar", ".gz", ".exe", ".dll", ".jar", ".bin"
]);

/**
 * The only tracked files allowed to carry an asset extension, each with the
 * reason. Empty today, and that is the strongest statement this repository can
 * make about itself: it ships nothing but text.
 */
const ALLOWED = Object.freeze({});

function trackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], { cwd: REPO_ROOT, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  return output.split("\0").filter((path) => path.length > 0);
}

test("this repository ships no asset: every tracked file is source", () => {
  let files;
  try {
    files = trackedFiles();
  } catch (error) {
    // Anchored deliberately: a tree where git is unavailable must FAIL and say
    // so, not skip quietly. A silent skip is how a gate stops being a gate.
    assert.fail(
      `Could not enumerate tracked files, so the distribution rule went unchecked: ${error.message}`
    );
  }

  assert.ok(files.length > 50, `git ls-files returned only ${files.length} paths, which cannot be this repository`);

  const offenders = files.filter((path) => {
    const dot = path.lastIndexOf(".");
    if (dot === -1) return false;
    const extension = path.slice(dot).toLowerCase();
    if (!ASSET_EXTENSIONS.includes(extension)) return false;
    return ALLOWED[path] === undefined;
  });

  assert.deepEqual(
    offenders,
    [],
    "Tracked files carry asset extensions. If one of these is an ORIGINAL asset this project authored, " +
    "add it to ALLOWED above with the reason. If it came from the licensed build, it must not be committed " +
    "at all — see AGENTS.md, 'Ship no SS2 asset'.\n  " + offenders.join("\n  ")
  );
});

test("the allowance list cannot rot: every entry must name a file that exists", () => {
  // The same discipline `test/handoff-navigation.test.js` applies to its known
  // inversions: an allowance that no longer applies is removed by a failing
  // test rather than left to accumulate into a hole nobody remembers opening.
  const tracked = new Set(trackedFiles());
  for (const [path, reason] of Object.entries(ALLOWED)) {
    assert.ok(tracked.has(path), `ALLOWED names ${path}, which is not tracked. Remove the stale allowance.`);
    assert.equal(typeof reason, "string");
    assert.ok(reason.length > 0, `${path} needs a reason, not an empty string`);
  }
});

test("the browser arena in particular ships no asset, and references none", () => {
  // The renderer is the first directory here that would plausibly want one, so
  // it is checked by name as well as by the sweep above.
  const files = trackedFiles().filter((path) => path.startsWith("tools/arena/") || path.startsWith("src/render/"));
  assert.ok(files.length >= 4, `the arena must be tracked for this to prove anything: ${files.length} files`);
  for (const path of files) {
    assert.match(path, /\.(js|html|md)$/, `${path} is not source`);
  }
});
