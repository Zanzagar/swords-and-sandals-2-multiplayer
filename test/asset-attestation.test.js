/**
 * Nothing extracted from a licensed build is ever committed.
 *
 * ## Why this is a different check from the capture attestation
 *
 * `test/ss2-capture-attestation.test.js` asserts that raw traces do not EXIST
 * under `test/observations/`. This asserts something else: extracted assets
 * SHOULD exist under `assets/` — that is the whole point, a player extracts
 * from the copy they own — and must never be TRACKED.
 *
 * So the question is not "is the directory empty" but "what does git know
 * about". A walk of the filesystem would fail on a working install and pass on
 * a machine that never ran the extractor, which is exactly backwards.
 *
 * ## The rule it enforces
 *
 * `AGENTS.md`:
 *
 * > **Ship no SS2 asset.** The project is intended to be shared, so the repo is
 * > a distribution channel: someone who clones it must still need their own
 * > licensed copy to play. Same model as a Doom source port shipping no WAD.
 *
 * ## Why a test and not just the ignore rule
 *
 * Because the ignore rule alone has already failed once, on this repository.
 * On 2026-09-01 a subagent wrote 67 raw traces to an unexpected path and one
 * `git add -A` committed every one: `.gitignore` covered `captures/` only, and
 * no test looked. An independent review found it; the suite did not.
 *
 * Two lines of defence, and this is the first one.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * The only path under `assets/` that may ever be tracked. It explains the rule
 * to whoever opens the directory expecting content and finds none.
 */
const ALLOWED = Object.freeze(["assets/README.md"]);

function trackedUnderAssets() {
  try {
    const output = execFileSync("git", ["ls-files", "assets"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    return output.split("\n").map((line) => line.trim()).filter(Boolean);
  } catch {
    // No git, or not a work tree. A fresh tarball is a legitimate way to hold
    // this code, and a missing `git` must not fail a suite that is about
    // something else. Reported as "nothing tracked", which is true of a
    // tarball by construction.
    return null;
  }
}

test("no extracted SS2 asset is tracked, whatever is sitting in assets/ locally", () => {
  const tracked = trackedUnderAssets();
  if (tracked === null) return;

  // A SUBSET check, not an equality one, and the difference is not pedantry:
  // the invariant is "nothing forbidden is tracked", never "the README has
  // been committed yet". Equality failed the first time this ran, before the
  // README's own commit, which is a state every future contributor also
  // passes through.
  const strays = tracked.filter((file) => !ALLOWED.includes(file));
  assert.deepEqual(
    strays,
    [],
    "Something under assets/ is tracked by git. Extracted audio, sprites and shapes are " +
    "the licensed build's, and this repository is a distribution channel: a clone must " +
    "still need its own copy to play. Run `git rm --cached` on the offending path and " +
    "find what added it — `.gitignore` is the SECOND line of defence, and you are " +
    "reading the first."
  );
});

test("the ignore rule is the second line of defence, and it is actually in place", () => {
  // Belt and braces, checked rather than assumed: the test above only sees
  // what git already tracks, so it cannot notice that the ignore rule has been
  // deleted until something has already been added.
  let ignored;
  try {
    ignored = execFileSync("git", ["check-ignore", "assets/sound/example.mp3", "assets/sound/manifest.json"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch (error) {
    // `git check-ignore` exits non-zero when NOTHING matches, which is the
    // failure this test exists to catch.
    assert.fail(
      "Nothing under assets/ is gitignored any more. `assets/*` with an exception for " +
      `assets/README.md is what keeps extracted assets local. (${String(error.message).slice(0, 80)})`
    );
    return;
  }
  const matched = ignored.split("\n").map((line) => line.trim()).filter(Boolean);
  assert.equal(matched.length, 2, `both example paths must be ignored, got: ${matched.join(", ")}`);
});

test("README.md is NOT ignored, so the rule explains itself to whoever looks", () => {
  // An empty, unexplained directory is how a rule gets worked around by
  // somebody who assumes it is an oversight.
  let exitCode = 0;
  try {
    execFileSync("git", ["check-ignore", "-q", "assets/README.md"], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "ignore", "ignore"]
    });
  } catch (error) {
    exitCode = error.status ?? 1;
  }
  assert.notEqual(exitCode, 0, "assets/README.md must stay trackable: it is where the rule is written down.");
});
