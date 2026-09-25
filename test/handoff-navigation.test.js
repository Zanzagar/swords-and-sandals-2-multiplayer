/**
 * The living head's reading map must not point at sections that do not exist.
 *
 * `HANDOFF.md` § "What to read, and what you may skip" tells a session which
 * sections it may SKIP. That makes every pointer in it load-bearing in the one
 * direction that hurts: a reader who follows a dead reference concludes the
 * guidance is not there and moves on, and a reader who trusts a "you may skip"
 * row never opens the section at all. A map with a dead link is worse than no
 * map, because it is followed.
 *
 * This is the failure mode the map was written to avoid reproducing. The head
 * already carries "Docs known stale, not yet reconciled" as a standing open
 * item, and the project's own rule is that evidence a reviewer holding the
 * repository cannot check is not evidence. A section reference is exactly that
 * kind of claim, and nothing checked it.
 *
 * What is asserted, and what deliberately is not. Every `§ "..."` reference in
 * the map must resolve to a real heading — in `HANDOFF.md` itself, or in a
 * committed handoff under `docs/handoffs/`, because the map cites one of those
 * too. Whether the section still SAYS what the row claims is not checkable
 * here and is not attempted; that is what a reader is for. The narrow check is
 * the one that can be made honestly.
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const HANDOFF_PATH = path.join(REPO_ROOT, "HANDOFF.md");
const HANDOFFS_DIR = path.join(REPO_ROOT, "docs", "handoffs");

const MAP_HEADING = "## What to read, and what you may skip";
const ARCHIVE_LINE = "## THE ARCHIVE LINE";

/**
 * Read a document with its line endings normalised to LF.
 *
 * THIS TEST FAILED IN EVERY WINDOWS CHECKOUT AND PASSED IN WSL. Windows git has
 * `core.autocrlf=true` at system scope, so these files check out CRLF there;
 * `headingOffset` looked for `\n<heading>\n` and the heading line really ends
 * `...skip\r`, so it reported "## What to read, and what you may skip is
 * missing from HANDOFF.md" while that heading sat at line 31.
 *
 * The repository already documents the two environments disagreeing about line
 * endings as a hazard — and neither the author of this file nor its reviewer
 * thought to apply that to the file itself. A guard that cannot run in one of
 * the project's two working trees is worse than no guard THERE: the Windows
 * tree is where captures run, and a suite that is red for an environmental
 * reason is a suite whose next genuine failure gets ignored.
 *
 * Normalised at READ time rather than by making each parse tolerant, so no
 * future parser added below has to remember. And `\r` belongs on the
 * formatting side of the line this file already draws — collapse what the
 * medium inserted, never normalise away a truncation like an ellipsis.
 */
const readText = async (filePath) => (await readFile(filePath, "utf8")).replace(/\r\n/g, "\n");

const handoffText = await readText(HANDOFF_PATH);

/** Every markdown heading in a document, without its leading hashes. */
function headingsIn(text) {
  return new Set(
    text
      .split("\n")
      .filter((line) => /^#{2,6}\s/.test(line))
      .map((line) => line.replace(/^#{2,6}\s+/, "").trim())
  );
}

/**
 * Section names the map cites, as `§ "Name"`. Returned with duplicates so a
 * count can be asserted: a regex that silently stopped matching would
 * otherwise make every assertion below pass over an empty list.
 */
function citedSections(text) {
  // THIS NORMALISATION IS ASYMMETRIC ON PURPOSE, and it will look like an
  // oversight to whoever tidies it next. Do not make it uniform in either
  // direction; the two cases are different kinds of thing.
  //
  // Wrapped whitespace IS collapsed. Markdown wraps, so a reference near a
  // line end arrives with a newline inside its quotes. That is the FORMATTING
  // differing from the heading, not the map naming a section that does not
  // exist, and failing on it would report a defect that is not there.
  //
  // An ellipsis is NOT normalised away. "§ \"The pairwise gate…\"" names no
  // heading, and a reader who follows it dead-ends exactly as they would on an
  // outright wrong name — a truncated reference IS a dead link, which is the
  // only thing this test is for. Strip the ellipsis to make it resolve and the
  // test starts passing over the failure it exists to catch.
  //
  // Both cases are real: the first run of this test on the map it was written
  // for produced one wrapped reference AND one ellipsis, and only one of them
  // was a defect.
  return [...text.matchAll(/§\s+"([^"]+)"/g)].map((match) => match[1].replace(/\s+/g, " ").trim());
}

/**
 * Where a heading actually starts, as a heading and not as a mention of one.
 * `indexOf("## THE ARCHIVE LINE")` finds the sentence 18 lines from the top
 * that EXPLAINS the archive line, hundreds of lines before the heading itself
 * — which made the ordering assertion below fail on a correct file.
 */
function headingOffset(text, heading) {
  const at = text.indexOf(`\n${heading}\n`);
  return at === -1 ? -1 : at + 1;
}

/**
 * Handoff stamps sort lexicographically. The integrated frozen history has
 * explicit exceptions, so the last name is not treated as authoritative;
 * `HANDOFF.md`'s LATEST pointer is. `README.md` is excluded by the stamp
 * pattern rather than by name, so a second non-handoff file cannot quietly
 * join it.
 */
const HANDOFF_STAMP = /^(\d{4}-\d{2}-\d{2}-\d{4})--[a-z0-9-]+\.md$/;

async function committedHandoffs() {
  return (await readdir(HANDOFFS_DIR)).filter((name) => HANDOFF_STAMP.test(name)).sort();
}

/**
 * The file the head's `**LATEST:` marker points at.
 *
 * The test below used to accept the newest handoff appearing ANYWHERE in the
 * head's links, and the head links five of them — the previous latest, the
 * brief that opened the current items, and two from the night before. So the
 * assertion passed while the LATEST marker named a different file from the one
 * it was checking, which is the precise failure it exists to catch. It is
 * parsed from the marker here so the check is about the pointer a reader
 * actually follows.
 */
function latestPointerTarget(text) {
  const match = text.match(/\*\*LATEST:\s*\n?\s*\[[^\]]*\]\(docs\/handoffs\/([^)]+\.md)\)/);
  return match ? match[1] : null;
}

/**
 * Which handoff each handoff declares it supersedes, keyed by superseded name.
 *
 * `supersedes:` is free text after the name — "(ALL FOUR of its ranked items
 * 2-5)", "(its ranked items 1 and 2)" — so only the leading stamped name is
 * taken, and `none` matches nothing because it is not a stamp.
 */
function supersededName(frontmatterText) {
  const match = frontmatterText.match(/^supersedes:[ \t]*(\d{4}-\d{2}-\d{2}-\d{4}--[a-z0-9-]+)/m);
  return match ? `${match[1]}.md` : null;
}

/**
 * When each handoff FIRST entered git, as an epoch-seconds number.
 *
 * THE FILENAME STAMP IS A CLAIM; THIS IS THE FACT. The frozen engine and
 * progression histories used different timezone conventions, and a delayed
 * progression checkpoint causes 34 ordering inversions. Those boundaries are
 * enumerated exactly below. This derivation keeps future UTC, same-session
 * handoffs honest without rewriting history.
 *
 * `--follow` is load-bearing: `2026-09-01-1550--codex-independence…` was
 * renamed from `…-1950--` for this same bug, so without it that file has no
 * add commit at all and the whole derivation returns null.
 *
 * Returns null — not a throw and not a skip — when the history is not
 * derivable (no git, a tarball export, a shallow clone with the add commit cut
 * off). The callers then fall back to a weaker git-free check and SAY SO in
 * the assertion message, because a guard that silently changes what it proves
 * is the hazard this file was written about.
 */
async function firstCommitInstants() {
  const names = await committedHandoffs();
  const instants = new Map();
  try {
    for (const name of names) {
      const { stdout } = await execFileAsync("git", [
        "-C", REPO_ROOT,
        "log", "--follow", "--diff-filter=A", "--format=%at",
        "--", path.posix.join("docs", "handoffs", name)
      ]);
      const stamps = stdout.trim().split("\n").filter(Boolean);
      if (stamps.length === 0) return null;
      instants.set(name, Number(stamps.at(-1)));
    }
  } catch {
    return null;
  }
  // A shallow clone can answer every query and still answer them all wrongly.
  // Distinct instants are what the ordering assertions consume, so require
  // enough of them that a collapsed history fails here by name.
  if (new Set(instants.values()).size < 4) return null;
  return instants;
}

/**
 * Handoffs whose filename stamp is out of order with the commit that added
 * them, with the reason each is left alone. They are recorded in the living
 * head and may not be renamed, because existing links would break.
 *
 * This list is asserted MINIMAL below — an entry that stops being an inversion
 * fails the test as unnecessary — so it cannot quietly outlive its cause. Add
 * to it only for a handoff that is already committed and already linked;
 * a NEW handoff that lands here is the bug. New briefs use UTC in filename and
 * frontmatter and enter git in the same session; do not widen this list for
 * them.
 */
const DELAYED_PROGRESSION_CHECKPOINT_INVERSIONS = Object.freeze([
  "2026-09-07-0330--the-armoured-golden-reaches-the-resolver.md",
  "2026-09-10-1212--everything-is-pushed-and-the-workflow-gate-is-gone.md",
  "2026-09-10-1730--the-map-was-not-silent-twice.md",
  "2026-09-11-2115--both-halves-of-position-are-built.md",
  "2026-09-11-2340--two-owner-items-were-a-session-away.md",
  "2026-09-12-0140--the-last-authored-number-is-derived.md",
  "2026-09-12-0930--weapon-range-is-projected-and-the-wave-broke-six.md",
  "2026-09-12-2358--the-arena-has-two-axes-and-the-build-has-its-own-voice.md",
  "2026-09-13-0040--the-fighter-is-a-rig-and-codex-broke-four-things.md",
  "2026-09-13-1145--the-gladiator-is-dressed-and-the-shell-has-a-seam.md",
  "2026-09-14-0130--the-arena-is-1to1-and-three-readings-were-mine.md",
  "2026-09-14-0200--i-read-the-corpse-and-the-arena-is-drawn.md",
  "2026-09-14-0255--the-backgrounds-were-jpegs-and-i-drew-none-of-them.md",
  "2026-09-14-1400--five-modules-exist-and-two-are-not-drawn-yet.md",
  "2026-09-15-0046--the-tint-landed-and-the-trail-vanished.md",
  "2026-09-15-0400--the-filters-land-and-the-sky-has-a-clock.md",
  "2026-09-15-0718--the-glow-is-drawn-and-it-hangs-the-page.md",
  "2026-09-15-1015--the-glow-is-drawn-and-i-measured-the-instrument-twice.md",
  "2026-09-15-1535--a-synthetic-swf-is-an-oracle-and-two-glows-were-doubled.md",
  "2026-09-15-1900--the-residual-was-the-rectangle-and-a-warning-was-wrong.md",
  "2026-09-15-2330--two-clip-phenomena-one-per-rasteriser.md",
  "2026-09-16-0130--psyche-up-was-never-the-owners.md",
  "2026-09-16-2228--the-build-plays-seven-runs.md",
  "2026-09-16-2356--the-stance-the-glow-and-an-ai-that-winds-up.md",
  "2026-09-18-0130--the-picture-was-lying-and-the-canvas-was-a-postage-stamp.md",
  "2026-09-19-0400--the-taunt-was-never-ranked.md",
  "2026-09-19-1500--four-ranked-items-and-three-broken-premises.md",
  "2026-09-19-2130--four-defects-a-campaign-and-a-blocker-that-moved.md",
  "2026-09-20-0200--the-slots-are-declared-and-three-sentences-were-wrong.md",
  "2026-09-20-2130--the-bolts-are-built-and-a-null-was-a-scheduled-divergence.md",
  "2026-09-22-1821--nine-verbs-built-and-the-build-plays-favourites.md",
  "2026-09-22-1934--every-spell-but-rejuvenate-and-the-build-plays-favourites.md",
  "2026-09-23-0119--every-quirk-decided-and-the-crowd-is-built.md",
  "2026-09-23-2119--the-arena-draws-what-the-engine-does.md"
]);

const KNOWN_STAMP_INVERSIONS = Object.freeze({
  "2026-09-01-0030--migration-closeout-and-what-is-untested.md":
    "two sessions closed the same night; this one committed at 2026-08-31 23:39 -0400 " +
    "while the 00:21 corpus brief committed at 00:24. The head names both and says which answers what.",
  "2026-09-02-0130--ss2-rules-and-the-wave-that-broke-it.md":
    "stamped with the UTC time under a -0400 label; committed 2026-09-01 22:58 -0400, " +
    "so its true stamp is 2026-09-01-2258. It carries a forward pointer instead of a rename.",
  ...Object.fromEntries(DELAYED_PROGRESSION_CHECKPOINT_INVERSIONS.map((name) => [
    name,
    "follows a progression handoff whose earlier filename was preserved when it first entered git " +
      "in delayed historical checkpoint ede5ad1 on 2026-09-24; both files are already linked"
  ])),
  "2026-09-24-0454--progression-index-overview-pause.md":
    "UTC progression filename follows the 04:53 local engine filename but entered git earlier; " +
    "both conventions are frozen at the integration boundary",
  "2026-09-24-1534--relic-fully-coupled-evidence-excluded.md":
    "UTC progression filename follows the 14:50 local engine filename but entered git earlier; " +
    "both conventions are frozen at the integration boundary"
});

test("the head's LATEST pointer names a handoff nothing else supersedes", async () => {
  // This has gone stale twice, both times the same way: a session lands a
  // handoff and the pointer keeps naming the previous one. Before the
  // integrated pointer rule, AGENTS.md sent the next reader to the newest
  // filename while the head named a different file as latest. It went stale
  // again the moment a concurrent session pushed a newer handoff without
  // touching the head, which
  // is the case no amount of care by one author prevents.
  //
  // This half needs no git, so it is the half that survives a tarball. The
  // handoffs already declare their own order in `supersedes:`, and a pointer
  // aimed at a brief some LATER brief has retired is the exact harm — that is
  // what "ls puts the newest second-to-last" costs a reader.
  const handoffs = await committedHandoffs();
  assert.ok(handoffs.length >= 4, `only ${handoffs.length} handoffs matched the stamp pattern`);

  const latest = latestPointerTarget(handoffText);
  assert.ok(latest !== null, "the head has no `**LATEST:` marker linking a handoff");
  assert.ok(
    handoffs.includes(latest),
    `the head's LATEST pointer names ${latest}, which is not a committed handoff`
  );

  const retired = new Map();
  for (const name of handoffs) {
    const superseded = supersededName(await readText(path.join(HANDOFFS_DIR, name)));
    if (superseded) retired.set(superseded, name);
  }
  // Vacuity guard: if the frontmatter parse stops matching, every assertion
  // below passes for free.
  assert.ok(retired.size >= 3, `only ${retired.size} supersedes: rows parsed; the frontmatter parse is wrong`);
  assert.equal(
    retired.get(latest) ?? null,
    null,
    `the head's LATEST pointer names ${latest}, which ${retired.get(latest)} declares it supersedes`
  );
});

test("the head's LATEST pointer names the handoff that entered git most recently", async () => {
  // The git half. Historical filename order is not authoritative after the
  // lane merge. First-add time is the fact the LATEST pointer must follow, so
  // this assertion prevents that pointer from drifting toward either lane.
  const handoffs = await committedHandoffs();
  const instants = await firstCommitInstants();
  const latest = latestPointerTarget(handoffText);
  assert.ok(latest !== null, "the head has no `**LATEST:` marker linking a handoff");

  if (instants === null) {
    // No derivable history. Say which check ran, rather than reporting a pass
    // that sounds like the stronger one.
    assert.ok(
      handoffs.includes(latest),
      `git history is not derivable here, so only the git-free check ran: ` +
      `the head's LATEST pointer names ${latest}, which is not a committed handoff`
    );
    return;
  }

  const newest = [...instants.entries()].sort((a, b) => a[1] - b[1]).at(-1)[0];
  assert.equal(
    latest,
    newest,
    `the head's LATEST pointer names ${latest}, but ${newest} entered git more recently. ` +
    `Either the pointer is stale, or the newer file did not enter git in its own session — check ` +
    `\`git log -- docs/handoffs/\`; new handoffs use UTC filenames and +0000 frontmatter.`
  );
});

test("handoff filename stamps sort in the order the files entered git", async () => {
  // `AGENTS.md` directs every session through the head's LATEST pointer. New
  // UTC handoffs must still sort in first-add order so the historical exception
  // list cannot silently become the normal authoring path.
  const instants = await firstCommitInstants();
  if (instants === null) {
    // Nothing to assert without history, and inventing a weaker stand-in here
    // would be a guard that looks like this one and is not.
    assert.ok(
      (await committedHandoffs()).length >= 4,
      "git history is not derivable here, so the stamp-order check did not run"
    );
    return;
  }

  const byName = [...instants.keys()].sort();
  const inverted = byName.filter((name, index) => index > 0 && instants.get(name) < instants.get(byName[index - 1]));

  const unexpected = inverted.filter((name) => !(name in KNOWN_STAMP_INVERSIONS));
  assert.deepEqual(
    unexpected,
    [],
    "these handoffs sort after a file that entered git later. New handoffs use UTC filenames, " +
    "+0000 frontmatter, and must enter git in the session that writes them; check with `git log` " +
    "before widening the historical exception list."
  );

  // Self-cleaning: an allowance that has stopped being an inversion is a lie
  // about the corpus, and this file's whole subject is guidance that outlived
  // its cause.
  const stale = Object.keys(KNOWN_STAMP_INVERSIONS).filter((name) => !inverted.includes(name));
  assert.deepEqual(
    stale,
    [],
    "KNOWN_STAMP_INVERSIONS lists handoffs that no longer invert the ordering; delete those entries"
  );
});

test("every committed handoff has a row in the handoffs index", async () => {
  // The index lost a row once already — the 14:43 handoff was never added, so
  // the index's newest row was the second-newest handoff. Derived from a
  // directory listing rather than a count, so a handoff added without a row
  // fails by name.
  const index = await readText(path.join(HANDOFFS_DIR, "README.md"));
  const missing = (await committedHandoffs()).filter((name) => !index.includes(name));
  assert.deepEqual(missing, [], "handoffs with no row in docs/handoffs/README.md");
});

test("the doc parse survives a CRLF checkout, which is what Windows produces", async () => {
  // Reproduces the Windows condition from a LF tree, so this stays covered on
  // the machine that cannot produce it naturally. Without the normalisation in
  // `readText`, `headingOffset` returns -1 here and both assertions below fail
  // with "is missing from HANDOFF.md" while the heading is present.
  const lf = (await readFile(HANDOFF_PATH, "utf8")).replace(/\r\n/g, "\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  assert.ok(crlf.includes("\r\n"), "the CRLF fixture was not actually converted");
  assert.notEqual(crlf, lf, "HANDOFF.md is already CRLF on disk; this test proves nothing");

  const normalised = crlf.replace(/\r\n/g, "\n");
  assert.equal(normalised, lf, "normalising a CRLF copy must reproduce the LF text exactly");
  assert.notEqual(
    headingOffset(normalised, MAP_HEADING),
    -1,
    "the reading map heading is unfindable after a CRLF round trip"
  );
  // And the raw CRLF text is genuinely hostile, so the assertion above is not
  // passing for free.
  assert.equal(headingOffset(crlf, MAP_HEADING), -1, "CRLF text no longer breaks the raw lookup");
});

test("the living head's reading map is present, and above the archive line", () => {
  const mapAt = headingOffset(handoffText, MAP_HEADING);
  const archiveAt = headingOffset(handoffText, ARCHIVE_LINE);
  assert.notEqual(mapAt, -1, `${MAP_HEADING} is missing from HANDOFF.md`);
  assert.notEqual(archiveAt, -1, `${ARCHIVE_LINE} is missing from HANDOFF.md`);
  // Below the archive line it would be frozen history rather than live
  // guidance, and the head's own rule is that a live instruction down there
  // must be hoisted rather than corrected in place.
  assert.ok(mapAt < archiveAt, "the reading map is below the archive line, where it is frozen");
});

test("every section the reading map names resolves to a real heading", async () => {
  const mapAt = headingOffset(handoffText, MAP_HEADING);
  assert.notEqual(mapAt, -1, `${MAP_HEADING} is missing from HANDOFF.md`);
  const nextHeadingAt = handoffText.indexOf("\n## ", mapAt + MAP_HEADING.length);
  assert.notEqual(nextHeadingAt, -1, "the reading map is the last section; expected another after it");
  const map = handoffText.slice(mapAt, nextHeadingAt);

  const cited = citedSections(map);
  assert.ok(
    cited.length >= 8,
    `the map cites only ${cited.length} sections; the extraction regex has probably stopped matching`
  );

  const known = headingsIn(handoffText);
  for (const name of await readdir(HANDOFFS_DIR)) {
    if (!name.endsWith(".md")) continue;
    for (const heading of headingsIn(await readText(path.join(HANDOFFS_DIR, name)))) {
      known.add(heading);
    }
  }
  assert.ok(known.size > 20, `only ${known.size} headings resolved; the heading parse is wrong`);

  const dangling = [...new Set(cited)].filter((name) => !known.has(name));
  assert.deepEqual(
    dangling,
    [],
    "the reading map names sections that do not exist in HANDOFF.md or any committed handoff. " +
    "A map that is followed and dead-ends is worse than no map; rename the reference, or restore " +
    "the section."
  );
});
