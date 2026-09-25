---
handoff:      2026-09-07-1140--the-sweep-reached-the-untouched-six
written:      2026-09-07 11:40 -0400
sessionId:    b60442bf-d6ee-43e0-a059-841a760662c1 (https://claude.ai/code/session_01D7hyZxjwjETzcpMMGo1nPh)
branch:       arena/champion-capture. ONE new commit, `5c22c76`, and it is
              **UNPUSHED**. So is `5112cac` from the previous session — that
              session's handoff claimed everything was pushed and it was wrong.
              **Verify, do not believe:**
              `git log --oneline github/arena/champion-capture..HEAD`
suite:        816 / 815 / 0 / 1 (fresh-clone profile: `captures/` holds only
              ARCHIVE-MANIFEST.sha256 and README.md). Measured twice, unchanged
              across the session — this was a documentation-only session.
              **Re-measure; never copy this line.**
supersedes:   2026-09-07-0955--the-last-adapter-gap-and-the-sweep, whose ranked
              item 1 is now HALF DONE (see below — the half that remains is
              bigger than that handoff knew). Its items 2-5 are untouched and
              all five are still the owner's.
---
# Handoff — the six documents nobody had swept, and the block that was mislabelled

## The one-sentence version

The six documents the last session left untouched are done — **79 rows, 73
applied and 6 rejected**, every one re-derived by hand — and the remaining
worklist turns out to be **78 rows in `HANDOFF.md`'s LIVING HEAD**, not in the
archive, because the sweep chunked this file as though the archive line were at
800 when it is at **3133**.

## THE HEADLINE: 78 stale rows are sitting in the living head, not the archive

`docs/doc-integrity-sweep-2026-09-07.md` splits `HANDOFF.md` into four
surveyed chunks and titles them `(lines 1–800, living head)`, `(lines 801-1600)`,
`lines 1601–2350` and `(lines 2351–3064)`. Only the first was treated as living
head and applied. **All four are the living head.** `grep -n 'THE ARCHIVE LINE'
HANDOFF.md` returns **3133**.

That matters more than a mislabel, because of what is in the unapplied range:

| line | section |
| ---: | --- |
| 852 | **What is running, and how to run it** |
| 1245 | **Non-negotiable rules (each learned the hard way)** |
| 1346 | **Next steps, in order** |
| 1631 | **Open items** |

Those are precisely the sections that MISDIRECT a session when stale, and
`AGENTS.md` says the living head is the ONLY place a wrong instruction may be
corrected. Some of the known-stale rows in there are load-bearing: the suite
figure at :1282 (708, actually 816), "CAPTURE AN ARMOURED FIXTURE — still first"
at :1290 (it was captured and promoted on 2026-09-02), and a claim at :972 that
there is NO Claude/Codex integration on this box when the plugin is installed
and `/codex:adversarial-review` is registered.

**This is the next session's top item and the owner has already chosen it.**

## What was done: the six untouched documents

`ss2-arena-route.md` (18/18), `ss2-staging-runbook.md` (18/18),
`ss2-battle-map.md` (13/13), `ss2-capture-staging.md` (16/17),
`ss2-item-tables.md` (5/6), `ss2-probe-replication.md` (6/7).

**The six rejections are the point, and four of them are numbers that simply do
not reproduce:**

- **`capture-staging` group A's "22 promoted goldens" is CORRECT.** A blanket
  22→23 would have broken it. Group A is 12 `golden-prisoner-*` + 10
  `golden-probe-*`; the 23rd golden belongs to Group H. Annotated in place so
  the next sweep does not "fix" it.
- **`probe-replication`'s direction-4 narrowing does not hold.**
  `golden-prisoner-quick-kill-dir4` is a committed golden at direction 4, backed
  by `obs-qk1`/`obs-qk9`. Recorded at the sentence as CHALLENGED AND UPHELD.
- **`item-tables` §9's heading** is a provenance statement, not a running count.
  The three items under it that ARE done are struck individually instead.
- **`probe-replication:241`** — the document says "two of the six", the survey
  said "all six" or "five of six". **Measured: three.** Only three of the six
  pre-existing reports name a committed record at all, and all three differ.
- **`probe-replication:200`** — document says 64, survey says 68. Neither
  reproduces, and this page's own rule twenty lines above forbids pinning a
  total against a live directory. **Replaced with the command.**
- **`battle-map:1843`** — the survey's archive-wide "79 entries across 23
  rufflelogs" is **91 across 32**. The document's SCOPED figures (67 entries,
  33/19/14/1, across 14 rufflelogs) reproduce EXACTLY and were left alone.

## Two verifiers, two survivals, and both found more than was asked

Write-nothing, one named claim each, aimed at different questions. `started ==
returned`: 2/2, zero errors.

**1. The build-identity table needed a DISTINCTION, not a substitution.** The
surveyor said "write 25046632"; an earlier refuter said "no, it is a
compatibility key". **Both were half right and the answer is a third thing:**

- **Steam build is BOTH.** `24807725` is `SS2_STEAM_BUILD_ID`, enforced by
  **four throwing equality gates** and carried by **262** tracked files under
  `src/`+`test/`. Changing it in code invalidates the corpus. `25046632` is what
  is installed. The table now states both and says which is which.
- **The other two rows have no such cover.** Nothing in the codebase reads a
  depot manifest, and the collection-shell hash the map carried (`6A58E08…`) is
  a value **this repository's own install verifier ACTIVELY REJECTS** —
  `verifyInstallAgainstFingerprint` (`tools/capture-session.mjs:69-96`) hashes
  against the fingerprint's current `7E1545…`. A reader checking their licensed
  install against the battle map would have been told their copy was wrong.

**2. The CONTROLLERS gate does not do what the map said, and the map used it to
underwrite a safety argument it does not provide.** The gate
(`ss2-capture-wrapper.as:1664-1665`) refuses only labels present in SOME
`CONTROLLERS` row but not the resting one. A label in NO row short-circuits the
`&&`, is logged `autopilot-unknown:`, and reaches `getphase` regardless. **So
the section's own hazard list — `swap_weapons`, `runleft`, `runright`, `frozen`,
`burning`, `poisoned`, `life_stolen` — is exactly the set the gate lets
through.** Not stale, either: `git log -S knownAutopilotAction` gives one commit
whose first version already had the pass-through, five hours BEFORE the
paragraph landed. It was never true of any committed revision.

## MY OWN ERRORS, flagged rather than quietly fixed

- **The sweep document's own "re-derived" table was wrong twice, in the row it
  holds up as its best result.** "2 files carry `25046632`" is **3** — and the
  sweep file is one of the three, so it was already 3 when written. "Enforced at
  eleven sites under `src/`" is a `grep -n` LINE count; there are **4** throwing
  gates. Corrected in place under a new heading that says so. *A number is only
  as good as the command beside it, and "re-derived" is a claim like any other.*
- **I nearly applied a mechanism claim an earlier refuter had broken.** Applying
  the count half of `capture-staging:811` (group H 5→4), I dropped the
  `staminaleft` clause instead of leaving it — which would have silently
  enacted the half that was refuted. Restored, with the refutation recorded at
  the row.

## The shape every count correction now takes

Where a number counts a live growing archive, the correction writes the
**COMMAND**, not a new number. That is the shape the last handoff asked for
after its "stale by N" correction was found wrong at both of its values. It is
applied at `probe-replication:200`, `capture-staging:1059`,
`staging-runbook:855` and `:868`, and at every golden count.

## Highest-value work, ranked

1. **The 78 living-head rows, `HANDOFF.md` lines 801–3132** — chosen by the
   owner 2026-09-07. They cluster into **six distinct questions**, which is the
   fan-out shape `AGENTS.md` wants and exactly the committed cap: (a) what this
   box's toolchain actually is (:852, :866, :886, :972); (b) what the capture
   archive actually holds (:826, :1128, :1130, :1274, :1743, :1747, :1842,
   :2232, :2272); (c) what the corpus actually holds (:1282, :1290, :1486,
   :1591, :1642, :1784, :1891, :2050, :2177); (d) whether the code anchors still
   point where they claim (:1632, :1678, :1699, :1706, :1716, :1792, :1798,
   :1928, :1610); (e) whether the byte-level readings hold (:1223, :1379, :1851,
   :1865, :1874, :1959, :2312); (f) whether items marked open are actually
   closed (:1625, :1869, :2012, :2088). **Fan out on those six, not on replicas.**
2. **Decide whether the WRITE allowlist grows to the armour piece ids.** Owner's,
   unchanged, and nothing needs it today.
3. **The `ss2-champion-dna.md` §7 ranged-primary capture question.** Owner's lane.
4. **A capture hook that can arm on a status phase.** Owner's, needs Windows.
5. The villain stamina 105-vs-110 schema question. Owner's.

## Hard rules (unchanged)

- **Derive candidates from the map, never from a capture.**
- **An agent FINDS; the main session RE-DERIVES.** Six rejections out of 79 this
  session, four of them numbers that did not reproduce at all.
- **A wave's brief is a snapshot.** `5c22c76` is the snapshot to brief against.
- **Ask before every push.** `main` stays denied outright.
