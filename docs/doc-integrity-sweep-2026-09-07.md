# Document-integrity sweep, 2026-09-07

**EVERY ROW IN THE TABLES BELOW IS A CLAIM TO VERIFY, NOT A MEASUREMENT.**
They were produced by write-nothing agents, and this repository's own rule is
that an agent FINDS and the main session RE-DERIVES. Nothing here was written
into any document until it was re-derived by hand; the ones that were are listed
under "Applied" and struck from the worklist by that fact. **Do not quote a
number from this file. Run its command.**

## Why this file exists

The 2026-09-07 08:25 handoff ranked a document-integrity sweep as the highest
value work that was both fully parallel and fully unblocked, because the session
before it had re-derived two documents and found six stale numbers and two gaps
that were **closed while still being advertised as open**. Nothing else had been
swept. This is that sweep.

## Method, and its integrity check

- **17 write-nothing surveyors, one document each** — the nine
  `docs/integration/*`, `docs/ss2-adapter-contract.md`,
  `docs/campaign-persistence.md`, `README.md`, `docs/roadmap.md`, and
  `HANDOFF.md`'s living head in four chunks. `docs/handoffs/*` was excluded
  because those files are frozen by rule, and `docs/design/*` because the design
  track is quarantined and its accepted text lives on another branch.
- **`docs/roadmap.md` was included as a CONTROL.** It had been re-derived by
  hand hours earlier, so a surveyor reporting a pile of findings there would
  have been evidence the surveyors were over-reporting. It returned 7 findings
  from 168 claims, 2 of them high — both real, both about the *enumeration*
  behind a number that had itself been corrected. The calibration held.
- **34 adversarial refuters**, at most two per document, on its
  highest-load-bearing findings, each given ONE named claim, told to default to
  `refuted: true` under uncertainty, and aimed at a distinct failure angle
  (artefact-of-reading vs. wrong-set measurement) rather than run as replicas.
- **`started == returned` on both phases: 17/17 and 34/34, zero errors.** A wave
  with dead verifiers is UNVERIFIED, not complete; this one is verified.

## The result

**3,146 claims examined. 346 reported not-holding — 264 STALE or WRONG (90 of
them high), the rest ambiguous or not checkable from a WSL clone.** The single
dominant cause is that the corpus moved on 2026-09-02 and 2026-09-07 and the
documents did not: 22→23 goldens, 67→69 observation records, 9→11 nonce-bearing,
38→37 uncaptured candidates.

**The refuters broke 7 of 34 (21%), and one of the breaks matters more than any
correction in this file:**

| broken finding | why it was wrong |
| --- | --- |
| `ss2-battle-map.md:26` "Steam build `24807725` is stale, write `25046632`" | **Applying it would have broken the corpus.** `24807725` is `SS2_STEAM_BUILD_ID` in `src/golden/run-1v1-fixture.js`. **262** tracked files under `src/` and `test/` carry it. The row is a compatibility key, not an install-identity field. ► **BUT THIS ROW'S OWN NUMBERS WERE WRONG, and a 2026-09-07 verifier broke two of them — see "Where this file was itself wrong" below.** |
| `ss2-probe-replication.md:104` "the gate is closed for 1–4" is wrong for direction 4 | The surveyor's script filtered the divergence corpus to a subset and then reported a universal negative about the whole of it. A committed counter-example exists. |
| `ss2-item-tables.md:1070` "§9's heading should say two of five remain" | The heading is a provenance statement ("not made *by this track*"), not a repo-status claim, and the living head already carries a sharper derivation of the same fact. |
| `HANDOFF.md:426` "the archive has one reachable copy" | The head already retracts that bullet twice, 26 lines above it, naming it as "the bullet below". The finding read a deliberately-retained historical bullet as live. |
| `HANDOFF.md:2012` "more rounds WAS the remedy" | Half right. The absolute is too strong and should be narrowed at the instruction; the replacement sentence was materially false. |
| `HANDOFF.md:2088` "`staminaleft` CAN be pinned, 5 in 1,171" | A determination claim misread as a frequency claim, and the replacement ratio exists nowhere. Writing it in would have put an unmeasured number into a corpus whose whole value is that its numbers were measured. |
| `ss2-capture-staging.md:811` group H | The count is right (5→4); the mechanism half of the correction is a measurement error and must not be applied. |

**That is the argument for the adversarial layer in one table.** Five of the
seven survived the surveyor's own evidence check and would have been applied by
anyone reading the findings as results.

## Where this file was itself wrong (added 2026-09-07, after working the list down)

**This file's own "re-derived" table carried two wrong numbers, in the row that
this file holds up as its best result.** Both were caught by a write-nothing
verifier aimed at that row:

| this file said | measured | how |
| --- | --- | --- |
| "**2** files in the whole repository carry `25046632`" | **3** | `git grep -l 25046632` — and **this file is one of the three**, so the count was already 3 when it was written |
| "enforced at **eleven sites** under `src/`" | **4 throwing equality gates** | eleven is the `git grep -n SS2_STEAM_BUILD_ID` LINE count: 4 gates (`run-1v1-fixture.js:559`, `observation.js:333`, `promote-1v1-golden.js:120`, `:238`), 4 imports/definition, 2 message interpolations, 1 stamp |

Neither error changes that row's verdict — 3 against 262 makes the same point as
2 against 262 — but this file presented the first figure as *"re-derived here
rather than relayed"*, and it was not. **The lesson is the one the file already
teaches, turned on itself: a number is only as good as the command beside it,
and "re-derived" is a claim like any other.**

**And the refuter's own framing was too strong.** It said the battle map's row
was "a compatibility key, not an install-identity field", which is right for the
**Steam build** row and wrong for the two rows beside it. Nothing in the codebase
reads a depot manifest; and the collection-shell hash the map carried
(`6A58E08…`) is a value the repository's own install verifier
(`verifyInstallAgainstFingerprint`, `tools/capture-session.mjs:69-96`) **actively
rejects**, because it hashes against the fingerprint's current `7E1545…`. So the
applied repair states BOTH builds for the Steam-build row and simply corrects
the other two. **The surveyor was wrong, the refuter was wrong, and the answer
was a third thing** — which is the same shape as the `probe-replication` digest
row further down.

## Applied 2026-09-07, each re-derived by hand first

`README.md`, `docs/roadmap.md`, `docs/ss2-adapter-contract.md`,
`docs/campaign-persistence.md`, `docs/integration/ss2-golden-harness.md`,
`docs/integration/ss2-runtime-capture.md`,
`docs/integration/ss2-champion-dna.md` and `HANDOFF.md`'s living head. The
corrections are AT the sentences, marked with the date, and struck rather than
deleted wherever another document cites the claim by position.

The numbers behind them, all re-derived on 2026-09-07 against this tree:

| quantity | value | how |
| --- | --- | --- |
| promoted goldens | **23** | `ls test/fixtures/ss2-1v1-golden/*.json \| wc -l` |
| authored candidates | **60** | `ls test/fixtures/ss2-1v1/*.json \| wc -l` |
| candidates with no golden | **37** | name-match of the two directories |
| observation records | **69** | `ls test/observations/ss2-1v1/*.json \| wc -l` |
| observation `fightMode` | **66 misc / 1 duel / 2 tournament** | read from each record |
| distinct cited observation ids | **62**, all committed | union of `provenance.observationIds` |
| cited observation PAIRS | **81** | sum of `C(n,2)` per golden |
| records carrying `capture.launchNonce` | **11**, all cited, across **5** goldens | read from each record |
| records carrying `capture.staged` | **2** (`obs-onx1405-a1`, `obs-onx1521-a1`) | read from each record |
| goldens carrying `provenance.staged` | **1** | read from each golden |
| goldens with villain `armourclass 0` | **22 of 23** | read from each golden |
| goldens with a non-zero enchantment field | **0 of 23** | read from each golden |
| golden `fightMode` | **22 misc / 1 tournament** | read from each golden |
| `SS2_WEAPON_IDS` rows | **90**; range factor 100 on **18** ids, 4 on **3** | imported the module |
| `RuleSetVerification` tiers | **3**; `RecordedRuleSetVerification` **4** | imported both modules |
| suite | **808 / 807 / 0 / 1** (fresh-clone profile) | `node --test --test-concurrency=1` |
| archived `.rufflelog` files | **1650**; `capture-refused-wrong-side` in **631**, in 0 `.jsonl` | `find`/`grep` over `/mnt/c/ss2-capture/captures` |
| OneDrive archive replica | **1,589 files / 19,904,374 bytes / 292 `.rufflelog`** | `find` over the retired OneDrive tree |

## Two premise corrections the surveyors returned, both outranking their tasks

1. **`/mnt/c/ss2-capture/captures` DOES resolve from a WSL session on this box**
   (1,592 entries), so archive questions are answerable here. What is NOT
   present is the fingerprinted build: the copy under `Downloads` hashes
   `27f80ff3…`, and the corpus's oracle is `77CB545C…`, so it is a different
   file. AVM1-offset and byte-census claims stay unanswerable *for that reason*,
   not because the archive is unreachable.
2. **The OneDrive tree is not gone and holds a third copy of the evidence
   archive.** The living head said it "now holds only the git bundle". It holds
   1,589 files including 292 raw traces — the 2026-08-31 mirror, frozen.
   Corrected in the head.

## Worked down 2026-09-07 (second pass)

**Six documents got no corrections applied in the first pass and all six are now
done**, every row re-derived by hand before it was applied or rejected:

| document | rows | applied | rejected, and why |
| --- | ---: | ---: | --- |
| `ss2-arena-route.md` | 18 | 18 | — |
| `ss2-capture-staging.md` | 17 | 16 | Group H's `staminaleft` mechanism — the count 5→4 applied, the mechanism half left standing as the earlier refuter required |
| `ss2-staging-runbook.md` | 18 | 18 | — |
| `ss2-battle-map.md` | 13 | 13 | rows 26/27/29 applied as a THREE-WAY distinction, not the proposed substitution |
| `ss2-item-tables.md` | 6 | 5 | the §9 heading — it is a provenance statement, and the earlier refuter was right; the three DONE items under it are struck individually instead |
| `ss2-probe-replication.md` | 7 | 6 | the direction-4 narrowing — **challenged and upheld**: `golden-prisoner-quick-kill-dir4` is a committed golden at direction 4 |

**Findings that did not reproduce, and were NOT applied:**

- `probe-replication:241` — the file said "two of the six", the survey said "all
  six" or "five of six". **Measured: three.** Only three of the six pre-existing
  reports name a committed record at all; all three differ. A third value.
- `probe-replication:200` — the file said 64, the survey said 68. Neither
  reproduces, and this page's own rule twenty lines above forbids pinning a
  total against a live directory. **Replaced with the command, not a number.**
- `battle-map:1843` — the survey's archive-wide "79 entries across 23
  rufflelogs" does not reproduce; it is **91 across 32**. The document's own
  SCOPED figures (67/14) reproduce exactly and were left alone.
- `capture-staging:811` row A — a blanket 22→23 would have broken it. **Group
  A's "22" is CORRECT**: it is 12 `golden-prisoner-*` + 10 `golden-probe-*`, and
  the 23rd golden belongs to Group H. Annotated rather than changed.

**Two documents on this list have now had a proposed correction refuted AND a
different proposed correction confirmed.** Read every row below as a claim.

## The worklist

Ordered by severity within each document. `H·S` = high, stale; `M·W` = medium,
wrong; and so on. **Verify before applying. Seven of the thirty-four checked
this way were broken.**


### `HANDOFF.md (lines 1–800, living head)`
139 claims examined, 105 HOLD, 12 unchecked here, 19 STALE/WRONG, 7 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 400 | H·W | **What is genuinely gone is the OneDrive tree**, which now holds only `ss2-team-arena-foundation.bundle` — a g… | The OneDrive tree is NOT gone and does NOT hold only the bundle. `.../OneDrive/Documents/ChatGPT/SS2 Multiplayer Mod/ss2-team-arena-foundation/captures` holds a frozen 2026-08-31 replica of the evidence archive: 1,589 files / 19,9… |
| 426 | H·W | **AND THE ARCHIVE HAS ONE REACHABLE COPY TODAY, NOT THREE.** … a bounded search of `/mnt/c` to depth 5 finds e… | The archive has at least TWO reachable copies from this WSL session today, and the second is a byte-verified replica: 1,574 of the manifest's 1,588 entries hash OK inside the OneDrive tree. The methodological defect is named in th… |
| 513 | H·S | **Baseline is 622 tests, 0 failed, 0 skipped** | 787 / 786 / 0 / 1 on this (fresh-clone-profile) tree. Same for the paired claim at line 657 ("622 tests, all passing, 0 skipped") and the two bullets at lines ~677–682 that state 622/622/0/0 and 622/621/1/0. |
| 669 | H·S | THE COUNTS IN THIS SECTION ARE STALE BY 8. Corrected 2026-09-01 (evening), measured on this tree: `630 tests, … | On this tree at 470c56a the profile is 787 tests / 786 passed / 0 failed / 1 skipped. The correction bullet is itself now stale by 157, and its instruction "Read every '622' below as 630 and every '621' as 629" is wrong at both su… |
| 17 | M·S | never by checking that branch out (its `AGENTS.md` is 156 commits stale) | 163 commits, not 156. (156 was the figure the 08:25 handoff measured — `docs/handoffs/2026-09-07-0825-…:55` says "arena is 156 ahead" — and the arena branch has advanced 7 commits since.) The instruction itself HOLDS and is if any… |
| 70 | M·S | `kind: "map-derived"`, `runtimeVerified: false` (`src/team/ss2-rules.js:914`) | The declaration is at `src/team/ss2-rules.js:1421-1422` (with the prose header at :14). Line 914 is a field of `combatantProjection`. The substantive claim — the rule set declares itself map-derived and not runtime-verified, so th… |
| 182 | M·S | the ONLY difference between the two files is one `whenToUse` string — in which the HARNESS copy is the better … | There is no difference: the two files are byte-identical (11,493 bytes each, `diff` exits 0), and the repo copy already carries the harness's `docs/adr/0001` wording. The very commit that wrote this paragraph (`cccfc2d`) also appl… |
| 330 | M·S | **The living head is ~810 lines and a session should not have to read all of it to start.** | The living head — everything above `## THE ARCHIVE LINE` at line 3065 — is 3,064 lines, roughly 3.8x the stated figure. This is the reading-budget claim the whole "What to read, and what you may skip" section is built on. |
| 363 | M·S | THE ARCHIVE IS FULLY READABLE FROM WSL, AT `/mnt/c/ss2-capture/captures`** — 240 entries, 1,603 files, 42 of t… | The readability claim HOLDS and "42 session-adc*" HOLDS exactly. The size figures are stale by ~5x: 1,592 top-level entries and 8,325 files / 58,492,555 bytes today. Consequence worth stating: `captures/ARCHIVE-MANIFEST.sha256` (1… |
| 395 | M·W | the one file under `captures/` that is not gitignored | TWO files under `captures/` are un-gitignored: `captures/README.md` and `captures/ARCHIVE-MANIFEST.sha256`. `.gitignore` carries a negation for each. This sentence also directly contradicts line 702–703 of this same file, which as… |
| 526 | M·S | No PR is open for `arena/champion-capture`, which is now 61 commits ahead of `main` | 162 commits ahead, not 61. "No PR is open for arena/champion-capture" HOLDS — the only open PR is #3 on `design/endless-progression-owner-packet`. Also worth pairing: `github/arena/champion-capture` is at 470c56a, i.e. the branch … |
| 575 | M·W | all four are RE-PROMOTED, pipeline only, from every other committed record that matches them** — 3, 5, 9 and 4… | In the order the five transcriptions are listed immediately above (normal-kill, -dir8, -dir6, -dir5) the counts are 3, 4, 9 and 5 — dir8 and dir5 are swapped. The multiset is right, the mapping is not. Never true: at the re-promot… |
| 599 | M·S | The gate HAS TEETH (407 free leaves it alone refuses, all at `/samples/*/callSite`) | 421 free leaves, not 407 — one per committed sample, and the corpus now holds 421 samples across 69 records. The bullet's own instruction to run the tool rather than trust the prose is the right reading; the number in it is stale.… |
| 702 | M·S | `captures/README.md` is the one path `git ls-files captures` returns, so it exists in a fresh clone AND on an … | `git ls-files captures` returns two paths. The test's positive anchor still resolves (README.md is committed), so the anchoring mechanism is sound; only the uniqueness justification is wrong. It was true until the manifest landed. |
| 724 | M·W | and thirteen live draws recorded exactly those | TWELVE, not thirteen, across the four sessions the source document names (arena-tourn-2 5, arena-staged-1 3, arena-staged-2 3, arena-champ-1 1) — `docs/integration/ss2-champion-dna.md` says "twelve" at lines 29, 39, 504, 506, 554,… |
| 742 | M·W | - The thirteen draws ran 2026-08-30 21:31 to 22:06. | The twelve draws' log files span 2026-08-30 21:37:57 to 22:07:26 by mtime. The DNA document's own derivation ("42 to 72 minutes" before 5d3d777 at 22:48:51) gives a 21:36–22:06 window. "21:31" is not derivable from either. The loa… |
| 229 | L·S | the old assertion was `linked.includes(newest)` over EVERY handoff link in the head, and the head links five | The living head now links 12 distinct handoffs. The explanatory point (a five-link `includes` check could pass while LATEST aimed at a superseded brief) is unaffected, and `test/handoff-navigation.test.js` does carry all three ass… |
| 481 | L·S | The local worktree directories and the `origin` bundle keep the old `ss2-team-arena-foundation` name **intenti… | There is no `origin` remote in this clone — `github` is the only one. Neither worktree directory carries the old name; they are `swords-and-sandals-2-multiplayer` and `ss2-progression-design`. Only the OneDrive bundle FILE still c… |
| 483 | L·S | `package.json` still carries the old identity on `main`; the migration is part of PR #1 and lands when that me… | `main` already carries the new identity. PR #1 merged at `e3f14aa` (2026-08-31), which this same file records at line 654. The forward-looking clause is spent. |

### `HANDOFF.md (lines 2351–3064)`
145 claims examined, 112 HOLD, 9 unchecked here, 30 STALE/WRONG, 11 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 2372 | H·S | **82 of 82** fixtures pin the villain's `staminaleft`. | 83 of 83. The denominator moved from 82 to 83 when golden-armoured-deflection-threshold-cleared.json was promoted in 2341789 (2026-09-02 12:43:17). The same stale 82 appears at lines 2369 and 2373; the 0-pin-speed invariant itself… |
| 2374 | H·S | **All 22 promoted goldens share ONE villain profile**: `attack`, `defence`, `strength`, `charisma`, `magicka` … | There are 23 promoted goldens, and 22 of 23 share that profile. golden-armoured-deflection-threshold-cleared breaks it: villain defence 3, armourclass 79, four armour pieces, and attack/strength/charisma/magicka absent entirely (n… |
| 2381 | H·S | **That is why the prisoner and probe families promoted and nothing else ever has** | The armoured family has since promoted. A third family (armoured-deflection-threshold-cleared) has been golden since 2026-09-02, against an opponent with defence 3 and armour - exactly the second archetype this bullet says nothing… |
| 2415 | H·S | \| already nonce-bearing (re-ingest is byte-identical) \| 9 \| | 11, not 9. Two nonce-bearing records (obs-onx1405-a1, obs-onx1521-a1) were added 2026-09-02. 40 + 11 + 18 = 69 records examined, not 67. |
| 2625 | H·S | 751 of 11,121 single-leaf perturbations across the 67 records are free ... **407 of them, every one at `/sampl… | 777 of 11,403 across 69 records are free; 421 of them at /samples/*/callSite. The verdict (HAS TEETH) and the ranges quoted at line 2517 (full-record 101-184, matcher projection 86-157) both still reproduce exactly, under the tool… |
| 2634 | H·S | All **9** nonce-bearing records ARE cited, across **4** goldens | All 11 nonce-bearing records are cited, across 5 goldens. golden-armoured-deflection-threshold-cleared is a fifth, citing two nonce-bearing records - and it is the FIRST golden whose evidence is entirely nonce-bearing, a stronger … |
| 2679 | H·S | all 29 cited observation pairs across the 22 goldens agree under it, so it refuses no promotion that already s… | 81 cited observation pairs across 23 goldens, all agreeing. 29 was the count BEFORE the re-promotion (at 4bda5fc^); the commit that landed the re-promotion (4bda5fc) already made it 80, and that same commit wrote the 'RE-MEASURED … |
| 2850 | H·S | `.claude/workflows/question-fanout-audit.js` is still UNEXERCISED as a file: ... the script was authored inlin… | The committed file HAS been invoked, repeatedly, since 2026-09-01. a9e690e (2026-09-01 12:56) says in its own message that it was run for the first time that session and names the defect that run exposed. c72f247 (2026-09-02) reco… |
| 2911 | H·S | Once `ss2-rules.js` exists and fights are played, which parity actually MATTERS becomes an observation rather … | src/team/ss2-rules.js landed 2026-09-01 22:58, is 1,780 lines, and has been edited as recently as 2026-09-07 (07773db). The deferral's third reason ('Better information is about to arrive') and the recommendation at line 2938 ('Re… |
| 3058 | H·S | **Docs known stale, not yet reconciled**: the staging runbook's `parseStageList` mechanism and its "weapon tab… | All three were reconciled in dc334f2 (2026-08-31 01:50:52), a commit titled 'Reconcile three integration documents with what the bytes say' touching exactly those three files. The runbook carries §5.1 'Retraction: the weapon table… |
| 2392 | M·S | **22 of the 38 unpromoted candidates pin villain `staminaleft` while pinning NONE of `speed`/`strength`/`chari… | 21 of the 37 unpromoted candidates. The 'other 16 (champion 5, spell 8, duel 2, taunt 1)' in the same bullet still reproduces exactly. |
| 2398 | M·S | 22 goldens covering one opponent archetype is one archetype verified many ways | 23 goldens, covering two opponent archetypes. The reframing of 'the remaining work is breadth' as 'one archetype verified many ways' no longer describes the corpus. |
| 2408 | M·S | COSTS RE-PROMOTING 20 OF THE 22 GOLDENS | 20 of 23 (the tool's own wording today). The same stale '20 of 22' is in the table at line 2418. Everything else in that table re-derived exactly: 40 would-recover, 18 ingest-refused, waiver 58 -> 18. |
| 2426 | M·S | zero of 67 records differ in SUBSTANCE | 69 records. The same 67 denominator is used again at line 2625 ('across the 67 records'). The substantive claim - that the union of changed pointers is exactly /capture/launchNonce, /capture/overdraw, /digest - still holds: those … |
| 2430 | M·S | 407 samples, 182 mutation entries, 189 events and 2,412 `finalState` fields reproduce from the traces alone. | 421 samples, 184 mutation entries, 191 events, 2,980 finalState fields, over 69 records. The deltas are exactly the two records added 2026-09-02 (2 x 284 finalState fields = 568; 2412 + 568 = 2980). |
| 2448 | M·W | Only two archive dirs hold more than one `.jsonl` (`vehicle-check`, `simulated`), and they are exactly the dir… | The first half holds - exactly simulated (2) and vehicle-check (46) hold more than one .jsonl across all 1,589 archive directories. The set-equality half is false: NON_SESSION_CAPTURE_DIRS exempts THREE dirs, wrapper included, and… |
| 2536 | M·S | the full retraction is at § "Next steps, in order" item 1. | That section now contains two numbered lists. Its first (current) item 1, at line 1289, is 'CAPTURE AN ARMOURED FIXTURE'. The champion retraction is item 1 of a later list, at line 1490. A reader following this pointer lands on th… |
| 2566 | M·S | The 81 divergence-report digests are unverified | 86. The count was 81 only between 978dc3f and 5a0d565, both on 2026-08-31; it has been 86 since. The same stale 81 is repeated at line 2985 in the 'Still open' list. Note the reports carry the digest under key `observationDigest`,… |
| 2647 | M·S | **This paragraph contradicted line ~715 of this same file**, which has carried the corrected "9 nonce-bearing … | The pointer no longer resolves. Line ~715 is about parallel capture throughput. The text quoted ('9 nonce-bearing records are now cited') is at line 2491, ~1,776 lines below where the pointer sends a reader. |
| 2660 | M·S | All 407 committed samples carry ONE `callSite` literal | 421 committed samples. The load-bearing half - that they all carry ONE literal, so the teeth cannot bite two honest captures - re-derives exactly. |
| 2921 | M·S | The branch is 98 commits / 95 files / +17,190 −2,398 ahead. | 162 commits / 129 files / +29,754 −954. The accompanying claim that the branch is a clean superset of main still holds: the merge-base equals main's tip, so main is an ancestor. |
| 2945 | M·S | The only written rule about `main` is a PROHIBITION — `AGENTS.md`: "Do not push to `main`. Work happens on fea… | That sentence is no longer in AGENTS.md. What AGENTS.md says today is that git and GitHub follow claude-harness/docs/git-hygiene.md - thirteen ENFORCED rules covering 'branches, commits, pushing, PRs and merge eligibility' - that … |
| 2946 | M·S | No document in this repository says when a branch becomes ELIGIBLE to merge: not `AGENTS.md`, not this file, n… | AGENTS.md now names a thirteen-rule document that explicitly covers 'merge eligibility' and says those rules are ENFORCED through .claude/settings.json. The narrow reading - that the rules live in claude-harness, a different repos… |
| 2953 | M·W | the only commit in this repository not authored by `Codex Local <codex-local@invalid>` was one of those web me… | Two commits are web merges (e3f14aa and 4409ec7, both Corey Hoydic <75762315+Zanzagar@...>), not one - so even the 'only ... one' shape is wrong. And by 2026-09-01, when this was written, 24 further commits were already authored r… |
| 2958 | M·S | `arena/champion-capture` is 61 commits ahead of `main` with no PR | 162 commits ahead. This also contradicts the '98 commits' figure 37 lines above it in the same document. 'with no PR' still holds - PR #3 is for design/endless-progression-owner-packet, not this branch. |
| 2560 | L·S | `attack_chances`, the production arming point, is exercised 0 times there and ~209 times live. | 0 in the gate runs still holds exactly. Live it is 1,531 traces carrying wrapped:attack_chances today, not ~209. '7 of 15 hook slots have never wrapped in any gate run' re-derives exactly: hookSlots is 14 registerSlot + 1 register… |
| 2882 | L·S | This is how all 22 committed manifests were made | 23 committed manifests. The mechanism claim holds exactly: createdAt defaults to the wall clock at build-manifest.mjs:157, and campaign.mjs:1279 passes no createdAt. |
| 3007 | L·S | The frozen copy at ~line 2745 is wrong too and stays there as history. | The frozen copy is at line 3291, not ~2745. Line 2745 is the re-promotion evidence paragraph. Everything else in that CLOSED bullet re-derives exactly: declaredFillResources(declared, index) spans battle-host.js:150-156, the pinni… |
| 3023 | L·S | The same wording appears again below the archive line at ~2042 and is wrong there too. | The duplicate is at line 3311, not ~2042. Line 2042 is the randomise_gladiator paragraph. The correction's substance holds: ss2-capture-wrapper.as:1407 reads `if (currentTournament >= 19 && ranking <= 2) {` with no isNum call. |
| 3048 | L·S | The file's own comment block at `:206-225` records the fix | The comment block is :206-226 (one line longer), and the blanket-kill fallback is at :388, not :386-387 (:387 is the WARNING line). The other three citations in the same bullet land exactly: Get-SessionRuffle at :229-241, CloseMai… |

### `HANDOFF.md (lines 801-1600)`
188 claims examined, 146 HOLD, 18 unchecked here, 18 STALE/WRONG, 6 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 826 | H·S | **THE SNAPSHOT STORE IS 75 DIRECTORIES HOLDING ONLY 7 DISTINCT SAVES** … **58** share `2514b1cb…`, 12 share `6… | 1429 directories, not 75, and 1412 share `2514b1cb…`, not 58. The SHAPE of the finding is intact and reproduces exactly: still exactly 7 distinct saves, still 12 sharing `6a06e9e8…`, still five unique. The operational consequence … |
| 866 | H·S | **Every `ultra` run on this box was a trivial probe (17,044 tokens, "reply with EFFORT-OK"). There is no measu… | 116 of the 122 rollouts under `~/.codex/sessions` now ran at `ultra`, including runs of 112.8 M, 48.2 M and 47.5 M total tokens — none of them trivial probes. The 17,044-token probe is still there and the sentence was true when wr… |
| 972 | H·S | On this box there is NO Claude/Codex integration: `mcpServers` is empty, no codex plugin is installed, and `/c… | The plugin IS installed on this box and `/codex:adversarial-review` IS registered. This block is contradicted 51 lines earlier by the document's own :921 ("THE PLUGIN IS NOW INSTALLED ON THIS BOX (2026-09-01): codex@openai-codex v… |
| 1282 | H·S | Suite is 708 / 707 / 0 / 1 (fresh-clone profile), from 693. MEASURE IT, DO NOT COPY THIS LINE | 787 / 786 / 0 / 1. The profile label is still right — this tree carries only `captures/ARCHIVE-MANIFEST.sha256` and `captures/README.md`, so 1 skipped is the correct count per AGENTS.md. The line's own instruction ("MEASURE IT") w… |
| 1290 | H·S | **CAPTURE AN ARMOURED FIXTURE — still first, and the vehicle blocker was never real.** | An armoured fixture HAS been captured and promoted. `candidate-armoured-deflection-threshold-cleared` became `golden-armoured-deflection-threshold-cleared` on 2026-09-02, citing observations `obs-onx1405-a1` and `obs-onx1521-a1` w… |
| 1486 | H·S | it still has no armour, no enchantment and no non-tournament coverage | Two problems. (1) STALE: the corpus HAS armour coverage and tournament coverage since 2026-09-02 (`golden-armoured-deflection-threshold-cleared`, villain armourclass 79, fightMode tournament). Enchantment coverage is still absent.… |
| 1591 | H·S | The 22 goldens still cover ONE archetype in ONE dimension.** All 22: `armourclass 0`, eight zero piece ids, no… | There are 23 promoted goldens, not 22, since commit 2341789 (2026-09-02, "Promote the first armoured golden, and the first tournament evidence"). `golden-armoured-deflection-threshold-cleared` breaks four of the listed archetype p… |
| 852 | M·S | \| `~/.codex/config.toml` (this box, WSL) \| `gpt-5.6-sol` / **`xhigh`** \| ours | The WSL config on this box is now `gpt-6-astra` / `medium` / `service_tier = "fast"`. The Windows row of the same table (`/mnt/c/Users/corey/.codex/config.toml` = `gpt-5.6-sol` / `ultra` / `service_tier = "priority"`) still holds … |
| 1128 | M·S | which is currently 28 commits behind this one | 103 commits behind, not 28. The Windows capture tree at C:\ss2-capture is still parked on `98482b6` (that half of the claim holds exactly), but its working tree now shows 1366 porcelain entries, not the "38 'modified' files" of :1… |
| 1130 | M·S | Its 38 "modified" files are pure CRLF churn … so the tree is clean in substance | 1366 entries, not 38. The CRLF-churn verification was done against a 38-file working tree and cannot be carried forward to a 1366-entry one. Re-derive before relying on "clean in substance". |
| 1137 | M·S | Every prisoner and probe family — all 22 promoted goldens — is therefore uncapturable from the LIVE save | The prisoner+probe subset is still exactly 22, so the substantive claim (those 22 are uncapturable from the live save) holds. What is stale is the apposition equating that subset with the whole corpus: there are 23 promoted golden… |
| 1223 | M·W | if the true-branch ACCEPTS, the comparison must be un-negated so NaN fails it (line 574) | Line 574 is a plain assignment and contains no comparison at all. The wrapper is byte-identical to its state at d39fb8b, the commit that wrote this sentence, so the citation was never right — not drift. Worse, the nearest comparis… |
| 1379 | M·S | **Model enchantment DAMAGE** — `+0x320c` and `+0x3326`, both dropped, so an enchanted weapon applies a status … | Both offsets are now modelled: `ss2BattleValues` computes `weapon_enchantment_damage` and `secondary_weapon_enchantment_damage` from those two sites. The ARITHMETIC half of ranked item 2 is done. What remains open — and the code s… |
| 1419 | M·S | All 22 goldens supply `min_damage`/`max_damage` and none supplies `weapon`, so deriving first would re-datum r… | 23, not 22 — and the universal is now role-scoped: 23 of 23 heroes state the pair, 22 of 23 villains do, the exception being the armoured golden's villain. "None supplies `weapon`" still HOLDS exactly (0 golden files contain a `"w… |
| 1426 | M·S | Mutating the derivation to overwrite instead of fill fails ONE test of 718 … One assertion is all that stands … | The load-bearing half REPRODUCES EXACTLY: the overwrite mutation still fails precisely one test, `an explicit damage pair OUTRANKS a weapon id, so evidence is never re-datumed`, and the golden replay still does not notice. Only th… |
| 829 | L·W | the head's "74" at line ~608 is stale | Line ~608 is about the pairwise gate's dormancy numbers and contains no "74". The only "74 snapshots" in the file is at :996 — 170 lines BELOW the correction, in the same § "Driving the capture pipeline FROM WSL", not in the livin… |
| 886 | L·W | `sandbox: "read-only"` is hardcoded at `companion.mjs:411` | `:414`, not `:411` (411 is the opening `const result = await runAppServerTurn(` of the same call). The `:491` citation for `workspace-write` from `--write` is exact, and the substance — a real sandbox, not a prompt instruction — h… |
| 1274 | L·S | `called:attack_chances` appears **0 times** in vehicle-check rufflelogs and 209 times across the archive. | 1531 occurrences across the archive (in 1531 distinct rufflelogs, one each), not 209 — the archive has grown to 1650 rufflelogs in 1589 session directories. The load-bearing half is untouched: still exactly 0 in vehicle-check ruff… |

### `HANDOFF.md lines 1601–2350`
184 claims examined, 138 HOLD, 13 unchecked here, 30 STALE/WRONG, 2 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 1625 | H·S | Still open, and it is the bigger gap: enchantment DAMAGE is unmodelled on both weapons. … the damage is comput… | CLOSED on 2026-09-07. The status phase exists (SS2_STATUS_PHASE_FOR_FLAG, four phase types), reads the INFLICTOR's weapon_enchantment_damage at ss2-rules.js:1174 and applies it through applySs2MagicDamageCandidate; a test at test/… |
| 1869 | H·W | This is the cheapest unblocking on the list and nothing records it. | It is recorded, and was already recorded when this sentence was written. docs/integration/ss2-staging-runbook.md §1.1 (lines 328-360) quotes the exact refusal message and tables both removal fixtures against `-WatchFields "helmet_… |
| 2012 | H·S | No amount of sampling, throughput or memory fixes this, and the campaign planner's advice — "the remedy is mor… | More rounds WAS the remedy. 1,171 delogged rounds on the same route (captureMode "always", autopilot walkright x5 then normal_attack, same -StageVillain string) produced 5 hits on the exact joint precondition; two of them (session… |
| 2088 | H·S | THE HONEST FINDING IS STRONGER THAN THE FIX I NEARLY MADE: `staminaleft` cannot be pinned by ANY scenario for … | A scenario CAN pin it, and one now does: golden-armoured-deflection-threshold-cleared pins villain staminaleft 105 / staminamax 110 and hero 105/110 at direction 5, promoted from two independent injected-tape-runtime sessions on t… |
| 1642 | M·S | is inside the digest **all 22 promoted goldens cite as `provenance.captureManifestSha256`** | 23 promoted goldens, all 23 citing provenance.captureManifestSha256. Same count drift at line 1650 ("all 22 committed manifests": `ls test/manifests \| wc -l` → 23) and at line 1651 ("0 of 22 reorder"). |
| 1699 | M·S | the 12 pinned hashes in `test/team-resolver.test.js` are the only literal hashes in the repo | There is now a 13th literal pinned hash: combatStateHash == "58240ee3" at test/ss2-team-rules.test.js:951, added 2026-09-07 by 7464ca0. It pins a SEEDED battle, so the tape-only projection that landed (toTeamWireState's `rngMode`/… |
| 1706 | M·S | a gladiator's damage pair cannot be produced from a character record alone; and `weapon_enchantment_damage` (`… | Both halves are now false. ss2BattleValues derives the damage pair from a `weapon` id via ss2WeaponDamageRange (an explicit pair still wins), and it derives both enchantment damages at ss2-rules.js:703-706. This bullet contradicts… |
| 1743 | M·S | occur ZERO times across all 447 `.jsonl` and 57 `.json` records | The 'zero weapon-identifying fields, only ammo_left' finding still HOLDS over the current archive, but the denominator moved: 1,544 .jsonl (not 447) and 57 .json. |
| 1747 | M·S | **Coverage is 10%.** The matching triples collapse to 7 distinct `(min,max)` pairs of the table's 69, compatib… | Over today's archive the same construction gives 63 of 68 triples inverting (not 26 of 28), 10 distinct pairs of 69 (not 7), 14 compatible ids of 90 (not 9), so 76 rows corroborated by nothing (not 81) and coverage ~15.6% (not 10%… |
| 1768 | M·S | Promoting any new golden from `candidate-lethal-result` fails 15 of 715 tests | The suite is 787 tests / 786 pass / 0 fail / 1 skipped (the skip is the expected raw-trace-archive check, per AGENTS.md:188-194). The '715' denominator is stale; the '15 failures' figure requires a promotion mutation and is UNCHEC… |
| 1784 | M·S | All 22 goldens stage villain `hitpoints` and `hitpointsmax` at 10 against hero `min_damage` 21 / `max_damage` … | 22 of the 23 goldens stage villain hitpoints/hitpointsmax 10; golden-armoured-deflection-threshold-cleared stages 80/80. The hero 21/23 damage pair still holds for all 23. The instrumented '141 arrivals / 120 on the floor' figure … |
| 1842 | M·S | is recorded nowhere in any of the 240 archive entries | 1,592 archive entries now (1,565 session dirs; 1,200 session-onx and 151 session-ondc were added on 2026-09-02). The substantive claim survives — villaindecisionA/B still appear in no archived trace and the wrapper still does not … |
| 1851 | M·W | 32 of 38 rounds diverge on `/scenario/attackDirection` (observed 4, 8, 10, 11 against the pinned 5) | The 32-of-38 count HOLDS (5 occurs 6 times). The value list does not: the observed non-5 directions are 2, 3, 4, 6, 7, 8, 10, 11 and 20. That matters for the 'irreducible at P = 1/4' framing, because 9 of the 38 landed OUTSIDE ran… |
| 1865 | M·W | REFUSE every one of the 38 traces with "the staged villain state is missing the required field `helmet_defence… | Both removal fixtures pin BOTH helmet_defence and shoulderguard_defence, and projectFields iterates Object.keys(fixture.scenario.villain) in file order and fails on the FIRST missing key — helmet_defence in both. The -shoulderguar… |
| 1874 | M·W | `equality-quirk` and the three `tournament-*` stage a different villain (`armourclass 22, helmet 2`) that no `… | Three of the four, not four: candidate-armoured-equality-quirk, candidate-tournament-boundary-at-max and -boundary-below-max stage armourclass 22 / helmet 2; candidate-tournament-nonlethal-normal-hit stages armourclass 0 with NO h… |
| 1891 | M·S | because **zero `adc` observation records are committed** (68 observations, none from this family) | 69 observations. Zero adc-session records are still committed (that half holds), but the armoured family now HAS two committed observations — obs-onx1405-a1 and obs-onx1521-a1 — so 'none from this family' is false. |
| 2050 | M·S | \| `armoured-*`/`tournament-*` (0 goldens) \| armour pieces + `defence` ONLY \| | armoured-* now has 1 golden (promoted 2026-09-02 from obs-onx1405-a1 + obs-onx1521-a1). tournament-* still has 0. The same '0 goldens' framing recurs at line 2291. |
| 1610 | L·W | `ss2-battle-map.md:1485` already said so in prose | The prose is at ss2-battle-map.md:1500-1506 (the pseudocode block with the offsets is at :1512-1527), and was at 1506 when this sentence was written too. Line 1485 is and was the armour-removal bullet. The rest of this refutation … |
| 1632 | L·S | `ss2BattleValues` DERIVES both at `ss2-rules.js:472-475` | Now src/team/ss2-rules.js:703-706. The substance (both derived; vanilla-fields.js:150 and :155 carry both) HOLDS — those two line numbers are still exact. |
| 1647 | L·W | en-US and eleven other locales order every pair as the code-unit comparator does | Twelve other locales, not eleven: the census covers 15 locales, 13 of which score 0 (the LOCALES list was already these same 15 at 118a95c, when the sentence was written). The 86 sessionIds, 3,655 pairs, haw-US 1 and az-AZ 682 all… |
| 1678 | L·S | (`rng.js:126` sets `#state = 0` for tape mode, and `toTeamWireState` carries only `rngState`/`rngCursor`) | src/team/rng.js:128 (it was 126 at 118a95c when written). And toTeamWireState no longer carries only rngState/rngCursor: in tape mode it also projects rngMode and rngDrawn — which is the consumed-prefix fix this same bullet announ… |
| 1716 | L·S | verified 2026-09-02 at `AGENTS.md:153-156` | AGENTS.md:188-194. The quoted wording is intact and the item is still correctly marked closed; only the anchor moved. |
| 1792 | L·S | exactly seven** whole-site deletions stay green: `ss2-rules.js:490`, `:707`, `resolver.js:261`, `roster.js:168… | The two ss2-rules.js anchors drifted: :490 → :721 and :707 → :975. resolver.js:261, roster.js:168 and ss2-attack-candidate.js:228/:237/:575 are all still exactly the clamps named. The mutation results themselves (15 of 16, exactly… |
| 1798 | L·S | **`ss2-rules.js:784`'s stamina FLOOR is dead code**: deleting just the floor stays green even though `test/ss2… | ss2-rules.js:784 → :1079; test/ss2-team-rules.test.js:456 → :609 (that test still drives 1 − round(20*2) + 1 = −38). resources.js:252 is still exactly the re-clamp, so that anchor holds. |
| 1928 | L·S | `COMBATANT_KEYS` (`src/golden/run-1v1-fixture.js:91`) is a closed allow-list of **42** keys … `assertAllowedKe… | Now :99 and :224-229. Everything substantive HOLDS and was re-counted: exactly 42 keys, staminaleft and staminamax present, stamina/speed/vitality/herolevel absent, the message template is `${path} has unsupported fields: ${unexpe… |
| 1959 | L·W | round(magicka), 18 cast_* blocks | The battle map's staminacost table records 17 `cast_*` blocks (two of them shared branches covering 5 labels between them: lightning/frightning bolt at +0x842f, fireball/hell/dire at +0x8fa7). Checked for INTERNAL CONSISTENCY agai… |
| 2177 | L·S | 53 of the 82 committed fixtures carry villain `staminaleft == staminamax - 5`, across BOTH staminamax values | 54 of 83 — the new armoured golden (110/105) added exactly one to both. 'Across BOTH staminamax values' is also loose: the corpus carries six distinct villain staminamax values (100, 110, 130, 140, 150, 160); the −5 pattern occurs… |
| 2232 | L·W | Across all four champion rufflelogs the branch was evaluated 931 times and emitted `action-armed` ZERO times. | Six champion-mode rufflelogs exist across three session dirs, not four. 931 = 0+382+89+460, i.e. the arena-champ-1/2 four only; adding session-champ-n1's 160 gives 1091 — which is exactly the figure this same document uses at line… |
| 2272 | L·W | with 5-14 autopilot entries per round | 3 to 14, not 5 to 14 — session-adc37 has 3 autopilot entries and session-adc21 has 4 (and adc21's has no normal_attack step at all). The load-bearing half — every one of the 38 records the autopilot driving, contradicting the laun… |
| 2312 | L·W | Three lines above it: `if (arenaCaptureMode == "always") return true;`. | One line above the champion branch (2025 vs 2026), and ~30 lines above the quoted comment block (2054-2058) that 'it' most naturally refers to. Inherited verbatim from the 15:50 handoff's line 58-60. Every other wrapper anchor in … |

### `README.md`
103 claims examined, 93 HOLD, 4 unchecked here, 5 STALE/WRONG, 5 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 21 | H·S | 22 promoted runtime goldens exist | 23 promoted runtime goldens exist. The number is asserted in three independent places that all agree: 23 files on disk, `assert.equal(replayable.length, 23)` in test/ss2-golden-resolver-replay.test.js:363 (test passes), and SS2_GO… |
| 21 | H·S | the goldens cover attack directions 1-12 with zero armour and zero enchantment | The zero-armour half is false. 22 of the 23 goldens stage `armourclass 0` with all eight piece ids 0; `golden-armoured-deflection-threshold-cleared` stages villain `armourclass 79`, `helmet 6`, `shoulderguard 1`, `gauntlet 1`, `gr… |
| 22 | H·S | Rendering, roster read-back, rewards, and licensed-build integration remain incomplete | Strike `roster read-back` from the incomplete list: it landed on 2026-09-07 (src/campaign/to-battle.js, src/campaign/circuit.js), has two dedicated green test files, and has a playable consumer in tools/hotseat.mjs. `Rendering`, `… |
| 49 | H·S | it does not yet read a persistent roster back into a playable campaign or award progression | The read-back half is false; the reward half still holds. `rosterFromCampaignRecord` (src/campaign/to-battle.js:63) reads a settled record back into a roster, `advanceCircuit` (src/campaign/circuit.js:166) chains bouts with the su… |
| 54 | M·S | partly checked against the 22 goldens | partly checked against the 23 goldens. The rule set's own provenance string at src/team/ss2-rules.js:1428 says "23 promoted goldens for attack directions 1-12", and its `goldenFixtureIds` (src/team/ss2-rules.js:1425) is SS2_GOLDEN… |

### `docs/campaign-persistence.md`
168 claims examined, 152 HOLD, 4 unchecked here, 10 STALE/WRONG, 2 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 187 | H·S | `provenance.ruleSet` is mandatory, and its claim is gated exactly as `src/team/rule-set.js` gates the live one… | The bullet list is missing a tier. `RecordedRuleSetVerification` now has four values, not three, and the gate has a fourth rule: **`map-derived` must declare `runtimeVerified: false`, must pin a 64-hex build SHA-256, and must cite… |
| 197 | H·S | Today every record this layer can produce says `placeholder`, because `classicStyleRules` is an explicit place… | A record built on `ss2TeamRules` (`src/team/ss2-rules.js:1419`, `createSs2TeamRules`) says `map-derived`, pins the build SHA-256 and cites 23 goldens. `test/campaign-circuit.test.js` and `test/campaign-read-back.test.js` build suc… |
| 433 | H·S | The roadmap's Stage 5 line covers "campaign roster/save/reward integration"; only the save half is built here. | Two of the three halves are built here: the save (`store.js`/`record.js`/`recorder.js`) and the roster read-back (`to-battle.js`, plus `circuit.js` as its consumer). Only the reward half is unbuilt. Note the roadmap row is not its… |
| 438 | H·S | **No roster write-back.** Nothing here advances a gladiator, and nothing here reads one. | This layer now reads gladiators. `rosterFromCampaignRecord()` (`src/campaign/to-battle.js`, landed 2026-09-07, commit de18178) takes the bout's blueprints, `structuredClone`s each survivor and writes `health`, `status` and `maxHea… |
| 41 | M·W | a test asserts the two agree | No test reads this document. The test at `test/campaign-persistence.test.js:1349` ("the documented boundary is complete and matches the keys the code actually mints") asserts `describeVanillaBoundary()` against keys `campaignKey()… |
| 150 | M·S | The completion token is a pure function of the outcome, so it is recomputed during validation | Since commit d89b04c ("Give the completion token a battle identity") the token is `<outcome prefix>:<battle discriminator>`. Only its **outcome half** is recomputed during validation (`completionTokenMatchesOutcome`, `src/campaign… |
| 173 | M·W | An AI-filled slot is always AI-driven, but the converse does not hold | An AI-filled slot is AI-driven **at construction** (`src/team/roster.js:329`: `const controller = filled ? ControllerKind.AI : ...`), but nothing enforces it afterwards. `reassignController()` has no guard, and a record with `slot… |
| 453 | M·S | `test/campaign-persistence.test.js`, 68 tests, filesystem-free. | 70 tests, all passing. It was 68 at this document's last edit (3bc176f), so the count has drifted by two. The document also no longer names the layer's other two test files: `test/campaign-read-back.test.js` and `test/campaign-cir… |
| 25 | L·S | Every leveled-gladiator route passes through the town square, both on the way in and after each win | "after each win" was true against §8 as it stood at this doc's last edit; the route map has since been refined. It is now: on the way in always; again after every **duel** win with no level-up, and after every **level-up outside a… |
| 283 | L·S | `ss2_data` already lives in that quota (679 bytes, per `HANDOFF.md`) | The citation no longer resolves: `HANDOFF.md` contains no "679" (it was there once and has since been archived out). The live source is `docs/integration/ss2-capture-staging.md:568`, which records `ss2_data.sol` as byte-identical … |

### `docs/integration/ss2-arena-route.md`
235 claims examined, 118 HOLD, 95 unchecked here, 18 STALE/WRONG, 3 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 39 | H·S | one of the 22 promoted goldens | 23 promoted goldens. Same correction at line 1440 ("all 22 promoted goldens depend on the step list") and line 1961 ("every hitpoint entry in all 22 promoted goldens"). Note the new 23rd is golden-armoured-deflection-threshold-cle… |
| 1706 | H·S | Its sprite-862 paragraph still ends "the project's own tooling still cannot reproduce it; a `--labels` mode on… | Item 7 is CLOSED and should move to the struck "### Done" list. The battle map's sprite-862 paragraph was rewritten by commit 0a3076c on 2026-08-30 23:19 — 27 minutes after cea54a7 (2026-08-30 22:52) added this worklist item — and… |
| 1711 | H·S | It states the derivation as `min_damage = strength + weapons[hero.weapon].weapon_min_damage`. The bytes at `+0… | Item 8 is CLOSED. The wrapper comment was corrected in cea54a7 — the SAME commit that added this worklist item, so the item was born stale and has survived two later revisions of this document. The comment now carries the correct … |
| 42 | M·S | The [staging analysis](ss2-capture-staging.md) found 13 of 17 remaining candidate fixtures unreachable from th… | The cited analysis no longer says this and no longer supports it. `ss2-capture-staging.md` now counts 60 candidates (52 physical + 8 spell) with 38 uncaptured, and explicitly retracts the unreachability premise ("that is now large… |
| 517 | M·S | 54 `versus` lines across `captures/arena-*` name 43 distinct opponents. Twelve of the 54 are the champion, and… | 60 `versus` lines naming 47 distinct opponents; fourteen are the champion; every one of the other 46 is unique. The invariant ("not a single generated opponent repeated") survives and is now stronger, so only the three numbers nee… |
| 706 | M·W | 22 `ABORT:battle-lost` lines across `captures/arena-*`, including eight losses to the rank-1 champion | 23 `ABORT:battle-lost` lines, THIRTEEN of them losses to the rank-1 champion (twelve over the eighteen directories the document counted). "Eight" matches nothing at any point: this document's own §12 line 1830 says "22 `ABORT:batt… |
| 1484 | M·S | the eighteen `captures/arena-*` directories contain zero `end` lines between them | NINETEEN `captures/arena-*` directories (eighteen non-empty). The substantive claim — zero `end` lines — still HOLDS across all nineteen. Same count at line 1859 ("`grep -c '\"t\":\"end\"'` over all eighteen `captures/arena-*` dir… |
| 1512 | M·S | except that `run-arena.ps1` wraps the value in quotes, which `run-capture.ps1` does not | There is no difference. Both scripts forward `-WatchFields` through the identical line, both wrapping the value in embedded quotes. The whole three-sentence caveat that follows ("The difference is inert for a well-formed field lis… |
| 1592 | M·W | This is why `campaign.mjs` refuses to run the armoured family as one family. | The ONE-AT-A-TIME verdict is computed from attack-direction collisions and distinct injectable tape count (campaign.mjs:1088-1096). Watch fields are read only afterwards, at line 1101, and drive nothing but an advisory print. The … |
| 1619 | M·S | **Spending stat points remains the least faithful step on the route** — the button body is two statements with… | Retracted in the implementation. The wrapper records that the stat-point body is a guard, a call to `clicksound.start()` and two assignments, all replicated, making it a verbatim replication rather than the route's least faithful … |
| 1767 | M·S | **0 for 12** — every champion bout in the retained captures was lost | 0 for 14 across 17 tournament launches. Thirteen of the fourteen ended in `ABORT:battle-lost`; the fourteenth (`arena-champ-2/obs-champ-2-a2.rufflelog`) has no terminal line at all — its trace stops mid-bout — so the blanket "ever… |
| 394 | L·S | four `ABORT:duel-button-hidden` lines across `captures/arena-*` | FIVE `ABORT:duel-button-hidden` lines, every one still reading `"level":4,"required":4`. The gate conclusion HOLDS; only the count is wrong. |
| 577 | L·S | 32 log lines across `captures/arena-*` report `"gameMode":"full"` | 36 lines report `"gameMode":"full"`; still not one reports `"demo"`. The conclusion HOLDS. |
| 1000 | L·S | **All 13 level-ups recorded across `captures/arena-*` show the identical pair**, with zero variation in either… | 15 level-ups, all fifteen showing the identical pair and the identical one-tick wait. The invariant HOLDS and is stronger; only the count is stale. The quoted pair at lines 995-996 reproduces verbatim in `arena-dry-4/arena-dry-4-o… |
| 1029 | L·W | The four `levelup-confirm` lines in `captures/arena-*` are: | There are fifteen `levelup-confirm` lines (thirteen at the time of writing — see line 1000, which says thirteen in the same document), carrying FOUR DISTINCT (herolevel, vitality, hitpointsmax) triples. The four-row table is corre… |
| 1671 | L·W | **Done.** The battle map now records "**Settled**: … the sprite carries exactly eight labels, at frames 1, 5, … | The verdict ("Done") HOLDS, but the quoted words are not the battle map's. It says "**Closed 2026-08-30, and reproduced with the project's own tool.**" and reports "`8 across 1 of 24 timelines` … at frames 1, 5, 13, 20, 28, 52, 62… |
| 1782 | L·S | identical across twelve independent launches**, read off `_root.game.villain` at root frame 220. Twelve `versu… | FOURTEEN independent launches, fourteen identical triples, still zero variation. The reproducibility claim HOLDS and is stronger; only the count is stale. Same at line 486 ("in every one of the twelve champion bouts") and line 163… |
| 1804 | L·S | In **10 of the 12** runs that reached it, the hero had levelled 4 → 5 first; in 2 it had not. | 12 of the 14 runs that reached the champion bout entered it at level 5; 2 did not. The two-that-did-not is unchanged, so the RNG conclusion HOLDS. The rest of the paragraph re-derives cleanly: every `reward` line carrying `"nextle… |

### `docs/integration/ss2-battle-map.md`
168 claims examined, 137 HOLD, 16 unchecked here, 13 STALE/WRONG, 5 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 3 | H·S | first recorded 2026-08-29, last revised 2026-08-31 | last revised 2026-09-07. The document itself carries blocks dated 'ADDED 2026-09-02', 'CORRECTED 2026-09-02', 'byte-read 2026-09-02' and 'CORRECTED 2026-09-07', so the header contradicts its own body as well as git. |
| 26 | H·S | \| Steam build \| `24807725` \| | Steam build 25046632 (24807725 is the superseded prior build, recorded as such in the fingerprint the same table links to). The SS2 SWF hash/size rows are unaffected — the fingerprint records ss2Unchanged: true across the transiti… |
| 27 | H·S | \| Depot manifest \| `1055432 / 8233185473219625516` \| | `1055432 / 433190280864947326`. |
| 29 | H·S | \| Collection shell \| `swords_and_sandals_classic.swf`, SHA-256 `6A58E0843967AF5B781133E878A8E8DEB66F0D9EA265D0… | SHA-256 `7E15456500E41E930D5046D1853AC1CCFBB1E69A9EBF08FAD11DF0C0B91B8A4C`. The installed file's size (99,256,433) matches the current fingerprint entry exactly and not the prior build's 99,259,496, so this is settled by metadata … |
| 1616 | H·S | The live `fight_mode` of tournament/campaign battles is still to be observed (every capture records it for fre… | Tournament fight_mode IS observed. It is recorded live in all 21 armed arena rounds of 2026-08-31 (session-adc1…adc22) and in two COMMITTED observation records, obs-onx1405-a1 and obs-onx1521-a1 (2026-09-02), which are the two sou… |
| 348 | M·W | (`ss2-capture-wrapper.as`, `CONTROLLERS` / `stepAutopilot`, which refuses a step the resting controller does n… | The gate refuses only labels that appear in some CONTROLLERS row; any label absent from every row is passed straight to `getphase` regardless of the resting controller. `swap_weapons` is the clean counterexample — this same docume… |
| 900 | M·W | (byte-verified 2026-08-30; nine opcode sites on sprite 862) | The table under the sentence enumerates TEN opcode offsets, not nine (2+2+1+3+2). Excluding the frame-74 `combatlost` presentation pair as 'outside the turn loop' gives eight, not nine either, so no reading of the table produces t… |
| 1103 | M·S | **Eighteen committed observation records carry `scenario.attackDirection` 5** ... and sixteen of them put thei… | Twenty records carry attackDirection 5, and eighteen of them put their first mutation on /villain/…; the remaining two are still the empty-trace misses (obs-pr-normal-rollneeded-miss-9, -30). The two additions are obs-onx1405-a1 a… |
| 2183 | M·W | \| spell family (magicka only) \| 7 \| No `attack`/`defence` pinned; every `staminamax` derives. \| | 8. With 7 the table's Fixtures column sums to 59, one short of the 60 committed candidates the same document states at line 1076; with 8 it sums to 60 exactly (22+8+5+2+15+8). All 60 candidates, including all eight spell fixtures,… |
| 2209 | M·S | The champion family needs a gladiator at herolevel 11 holding weapon 24, which costs 4542 against a `goldpiece… | The capture plan has moved: the committed `run-arena.ps1` reaches the champion vector by staging (herolevel 5, vitality 10, weapon:24 as a table id — 'not a purchase'), and the archive already holds session-champ-n1 from that rout… |
| 2333 | M·S | **Twenty-two goldens are promoted** as of 2026-08-30 | Twenty-three. The 23rd is `golden-armoured-deflection-threshold-cleared`, promoted 2026-09-02 (commit 2341789) from obs-onx1405-a1 / obs-onx1521-a1 with provenance.kind "licensed-observation", repetitions 2. It also breaks the sam… |
| 1102 | L·S | Eleven consecutive hero swings without a 5 is a `0.75^11 = 4.2%` event, which is unremarkable; and the archive… | The scoped measurement (22 rounds, 11 hero swings, none at 5) still reproduces exactly. But the run-arena archive has since grown to 42 adc sessions, and the later block contains FIVE direct hero swings at direction 5 (adc33, adc3… |
| 1843 | L·S | across 14 rufflelogs in five session families (`arena-staged-1/2`, `arena-tourn-2`, `session-champ-n1`, `arena… | Scoped to the five named families the counts still reproduce exactly. Archive-wide it is now 79 entries across 23 rufflelogs, and nine of those (session-ondc222/239, session-onx1454/1700/1784/1873/1926/2130/2155, all 2026-09-02) D… |

### `docs/integration/ss2-capture-staging.md`
168 claims examined, 133 HOLD, 16 unchecked here, 17 STALE/WRONG, 2 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 290 | H·S | **no ingested observation records the mode yet.** All 67 observations under `test/observations/ss2-1v1/` read … | 69 observations: 66 `misc`, 1 `duel`, and **2 `tournament`** (`obs-onx1405-a1`, `obs-onx1521-a1`, both 2026-09-02). The mode IS now recorded in an ingested observation, so the sentence 'The first successful tournament capture reti… |
| 447 | H·S | `test/fixtures/ss2-1v1-golden/` now holds **twenty-two** promoted goldens | TWENTY-THREE promoted goldens. A 23rd, `golden-armoured-deflection-threshold-cleared.json`, was promoted on 2026-09-02 in commit 2341789 from observations `obs-onx1405-a1` and `obs-onx1521-a1`. The same '22' appears at lines 48 an… |
| 800 | H·S | Twenty-two are promoted, so **38 are uncaptured**. | 52 physical + 8 spell = 60 committed candidates HOLDS, but 23 are promoted, so **37 are uncaptured**. The group table's uncaptured column must sum to 37 (H drops from 5 to 4). |
| 811 | H·S | \| **H** \| `candidate-armoured-*` \| 5 \| ... 42 live rounds have produced 0 matches. ... `staminaleft` is the on… | Group H is now **4** uncaptured, not 5. `candidate-armoured-deflection-threshold-cleared` matched twice and was promoted. `staminaleft` was NOT still standing: it was closed by staging it (`villain.staminaleft=105` appears in the … |
| 1244 | H·W | `hitpointsmax 250` \| **300** \| ... 250 falls between reachable values | 250 is exactly reachable: by this document's own formula (`hitpointsmax = herolevel * 10 + vitality * 20`, line ~100), `herolevel 5` + `vitality 10` = 50 + 200 = 250 — precisely the pair the same section prescribes staging 20 line… |
| 1644 | H·W | 1. ~~**The trace carries no `spell_id`.**~~ **Closed.** The wrapper now emits it in `beginAction`, reading `ov… | This is a retraction that is itself wrong. The wrapper emits nothing: it reads `ov.spell_id` and `_global.spell_id`, and the wrapper's own byte-verified comment (added in 7601888, 2026-08-30 — one day BEFORE this document's last r… |
| 1648 | H·S | 2. **The wrapper emits no `magic-damage` event** ... the hook is registered as `registerSlot(…, "magic_damage_… | The hook is registered as `makeHookMaker("magic-damage-character", ...)` and DOES emit `{ t: "event", type: "magic-damage", method: spellDamageMethod(args[4]) }` when armed. Blocker 2 was closed in commit 7601888 (2026-08-30). Blo… |
| 824 | M·S | **Scoreboard.** 8 uncaptured candidates have no *staging* blocker (H and I). | **7**: Group H is 4 uncaptured (one of its five is promoted) plus Group I's 3. The remaining scoreboard figures (5 champion, 2 duel, 8 wrapper, 15 impossible) all still hold. |
| 1030 | M·S | Nineteen `.rufflelog` files carry `attacker-resolved-hero` and **zero** carry `attacker-resolved-villain` | **1343** files carry `attacker-resolved-hero` archive-wide (17 if scoped to `session-adc30`–`adc49`); neither reading is 19. The invariant half is the durable part and it still HOLDS exactly: **zero** files anywhere in the archive… |
| 1059 | M·S | as of the 268-log census; the tree now holds 292 logs and seven of them do carry the refusal | The capture archive at /mnt/c/ss2-capture/captures (which DOES resolve from this WSL environment) now holds **1650** `.rufflelog` files, of which **631** carry `capture-refused-wrong-side`. The archive gained ~1200 `session-onx*` … |
| 1112 | M·S | `grep -rlc '"staminaleft": 105' test/fixtures/` returns **53** files — those 8 plus 23 more candidates and 22 … | **54** files: 31 candidates (the 8 plus 23 more — that half holds) and **23** goldens, not 22. The new armoured golden added the 54th. |
| 1198 | M·S | they would be the first ingested observation of `fight_mode == "tournament"` in the archive | They would not be the first. Two tournament-mode observations were ingested on 2026-09-02 for `candidate-armoured-deflection-threshold-cleared`. Group I's three fixtures are still uncaptured, but a tournament-mode observation is n… |
| 1734 | M·S | \| all 8 `candidate-spell-*` \| a `magic-damage` event on the `magic_damage_character` hook, and an arming site … | The `magic-damage` event half is already built (line 2447-2452). What the eight spell candidates still need is (a) an arming site on the spell ingress and (b) a readable action identity — `spell_id` does not exist in the build, so… |
| 649 | L·S | Observed: 22 `ABORT:battle-lost` lines across `captures/arena-*` | **23** `ABORT:battle-lost` lines across `captures/arena-*` (25 archive-wide). The conclusion the number supports — that the gladiator survived every loss — is unaffected; only the count moved. |
| 762 | L·S | "John the Butcher", `hitpointsmax` 110, `armourclass` 86, identical across twelve independent launches | **Fifteen** independent launches now, all identical at 110/86. The reproducibility claim is strengthened, not weakened; only the count is stale. (Note `Hebrus the Butcher` and `Romulus the Butcher` are unrelated generated opponent… |
| 847 | L·S | The runbook's own scoreboard says "9 more behind one read-only weapon-table sweep". | The quoted sentence no longer appears anywhere in the runbook: `grep -c 'weapon-table sweep'` returns 0, and §11's row for family C now reads 'Not on a weapon sweep; there is nothing to sweep for'. The runbook has already absorbed… |
| 1301 | L·S | observed four times as `ABORT:duel-button-hidden` reading `"level":4,"required":4` | Observed **five** times, one each in `arena-shop-2` through `arena-shop-6`; each line does read `"level":4,"required":4`, so the substance holds. |

### `docs/integration/ss2-champion-dna.md`
214 claims examined, 154 HOLD, 46 unchecked here, 12 STALE/WRONG, 2 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 273 | H·W | The largest `range factor` anywhere in the table is 3. That is load-bearing for the capture plan in §6. | The largest range factor in the weapon table is 100, not 3. Eighteen ids (the ranged band 61-64, 66-74, 76-80) carry [5] = 100; three more (65, 75, 220) carry 4. Only 3 is the maximum among the non-ranged bands. The committed tran… |
| 707 | H·W | the largest `weapon_range` any row in §3 can produce is `physical_size + 3 * 44` — under 250 even at the stat … | The invariant breaks. `-StageHero` writes numbers only, so weapon:61 is stageable, and battlevalues computes weapon_range = physical_size + weapon[5]*44 from the PRIMARY weapon regardless of using_bow (battle map lines 437-476, it… |
| 774 | H·S | `campaign.mjs plan --family champion` carries a standing note on every one of the five members: > `note (unobs… | The unobserved-fight-mode note is GONE from every one of the five rows; it was replaced by a `needs-watch-fields` BLOCKER the document does not mention. The note's emitter still exists (tools/runtime-capture/campaign.mjs:644) but … |
| 793 | H·S | **The planner's note is about observation records, and it is accurate.** No committed record under `test/obser… | Three numbers are wrong. There are 69 committed observation records, not 67; two of them DO carry fightMode "tournament" (obs-onx1405-a1 and obs-onx1521-a1, both landed 2026-09-02 in 2341789 "Promote the first armoured golden, and… |
| 77 | M·S | it makes the twenty-two promoted goldens an independent check on this decode rather than a source for it | There are 23 promoted goldens. The 23rd, golden-armoured-deflection-threshold-cleared, was promoted 2026-09-02 in 2341789 and does NOT carry the prisoner's villain values (hitpointsmax 80, armourclass_max 79, staminamax 110, fight… |
| 415 | M·W | Both reduce to `round(h³ * 60)` for `h = herolevel` and `h - 1` respectively | The pairing is backwards. `experiencelast` (+0x3845) uses h-1 and `experienceneeded` (+0x38d3) uses h — the document lists them in the opposite order. Confirmed by live measurement, not only by the byte listing: experienceneeded r… |
| 503 | M·S | Across four capture sessions — `arena-tourn-2` (5 draws), `arena-staged-1` (3), `arena-staged-2` (3) and `aren… | The raw archive DOES resolve in this environment at /mnt/c/ss2-capture/captures (1592 entries), so this section is checkable rather than uncheckable. There are now FIFTEEN champion versus lines across SIX sessions — arena-champ-2 … |
| 517 | M·S | `5d3d777`, this document's **only** commit, and the commit that authored all five fixtures | The document has TWO commits, not one: 5d3d777 (2026-08-30 22:48:51) and dc334f2 (2026-08-31 01:50:52, +358/-28 lines). Its own line 3 says "revised 2026-08-31", so it contradicts itself. The 42/72-minute gaps are correct relative… |
| 617 | M·W | The wrapper arms on the **first** `checkattackroll` of the bout and closes the trace on its return. | `beginAction` has TWO call sites, not one: the `attack_chances` hook (line 2371) and the `checkattackroll` hook (line 2381). The wrapper's own comment names attack_chances as "the reliable arming point even when the atomic frame-5… |
| 540 | L·S | across the roughly forty distinct `(hitpointsmax, armourclass)` pairs this project has actually met from gener… | 517 distinct (hitpointsmax, armourclass) pairs now appear on `versus` lines in the archive, not "roughly forty". The discriminating claim that depends on it is unharmed and re-derived: `grep ... \| grep '"villainHitpointsmax":110,"… |
| 563 | L·S | in gitignored operator logs under `captures/` (`.gitignore` admits only `captures/README.md`) | .gitignore now admits two paths under captures/: README.md and ARCHIVE-MANIFEST.sha256. The manifest was un-ignored and committed on 2026-09-01 in f7779c8. The point the parenthetical is making (the twelve draws themselves are not… |
| 798 | L·S | on 40 arena `versus` lines overall, against 13 "duel" and 1 "misc" | "tournament" now appears on 1410 arena versus lines, not 40. The "13 duel and 1 misc" halves are still exact. The rest of the bullet HOLDS: the wrapper's versus emitter does print `_global.fight_mode` directly (ss2-capture-wrapper… |

### `docs/integration/ss2-golden-harness.md`
138 claims examined, 116 HOLD, 6 unchecked here, 12 STALE/WRONG, 10 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 5 | H·S | with its **first four runtime-verified goldens promoted 2026-08-30**. Everything else it holds is still a stat… | 23 goldens are promoted, not four: the four normal-kill goldens plus quick-band dir1-4, power-band dir9-12, ten probe arms, and one armoured/tournament golden. Note this was already wrong at the document's last edit (4bda5fc, 2026… |
| 53 | H·W | the golden, observation, and simulator suites are hard-wired to the physical resolver and would reject a spell… | Only the GOLDEN suite (test/ss2-golden.test.js) is physical-only. The observation suite (test/ss2-observation.test.js) and the simulator suite (test/ss2-simulate.test.js) both load and exercise the 8 spell fixtures through the sam… |
| 88 | H·S | Four fixtures carry it, and only four. | 23 fixtures carry runtime-verified provenance. All 23 were verified to have classification 'golden', provenance.kind 'licensed-observation', runtimeVerified true, >=2 unique observation ids and digests, and a captureManifestSha256… |
| 100 | H·S | The promoted set: | The table's four rows are individually correct — directions 7/5/6/8 and the cited observation id lists all match the files exactly, and the re-promotion paragraph at lines 109-116 is fully re-derived (pre-4bda5fc ids were obs-2026… |
| 125 | H·S | `candidateFlags` do not carry over on promotion, so nothing flagged has been confirmed yet. | The first clause HOLDS — no golden carries provenance.candidateFlags. The second is stale: three flagged candidates have since been promoted, so flagged behaviour HAS been confirmed. All three carry 'critical-deflection-threshold-… |
| 267 | H·S | **Nothing measured has been dropped into that seam.** `classicStyleRules` remains the only rule set and is sti… | classicStyleRules is no longer the only rule set. src/team/ss2-rules.js exports ss2TeamRules, a second rule set in the seam, declaring the THIRD verification tier map-derived (added to rule-set.js after this document's last edit),… |
| 269 | H·S | Four promoted goldens cover one direction band of one staged scenario — enough to satisfy the gate's *form*, n… | 23 promoted goldens cover all twelve melee attack directions across three bands, plus ten probe arms, plus one armoured tournament scenario — two fight modes, hit and miss arms, and armour-bearing state. The commit that completed … |
| 275 | H·S | The next implementation stage is ... run the power and quick bands through the campaign, then the scenarios th… | Every named next step has been done. Power band: 5d3edfb (all four directions). Quick band: 779195b. Non-lethal outcomes: the four *-rollneeded-miss probe goldens (expected.calculation.hit == false). Armour and tournament mode: 23… |
| 31 | M·S | `test/ss2-fixture-files.js` \| the two shared fixture lists, plus the on-disk guard that every committed fixtur… | There are no lists to be registered in. The module discovers every .json under test/fixtures/ss2-1v1/ and classifies each by its declared action identity (scenario.attackDirection -> physical, scenario.spellId -> spell). SS2_FIXTU… |
| 48 | M·S | \| `SS2_FIXTURE_FILES` \| `scenario.attackDirection` \| 29 \| | 52 physical fixtures, not 29. The spell count 8 still holds. The 23 physical fixtures added since the row was written and absent from the 'Current candidate coverage' tables are the 5 candidate-armoured-*, 5 candidate-champion-*, … |
| 51 | M·S | asserts the two lists are disjoint and that their union is exactly the directory: a new fixture must be regist… | The disjoint-and-covering assertion still holds, but the second half does not: a new fixture is registered in NOTHING. It is discovered from disk and classified by its own action identity; the module's header says the old on-disk-… |
| 224 | M·S | has been executed end to end: the four `golden-prisoner-normal-kill*` fixtures came through it | All 23 goldens came through the procedure, across seven promotion commits. The six numbered steps and every tool identifier in them re-derive correctly: tools/capture-session.mjs exposes verify-install, ingest, verify and promote … |

### `docs/integration/ss2-item-tables.md`
446 claims examined, 269 HOLD, 168 unchecked here, 6 STALE/WRONG, 3 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 1058 | H·S | `item.onRollOver()` immediately before `item.onRelease()` behaves like a real hover-then-click \| **unverified*… | It HAS been run. capture arena-shop-6 (2026-08-30 22:45, i.e. before this document's first commit df3a122 at 22:51) called the pair and bought successfully: item 39 requested, `hero.weapon` became 39 (not the stuck 20), and `cost`… |
| 1070 | H·S | ## 9. Changes this track would make elsewhere (not made — other tracks own these files) | Three of the five listed changes (items 1, 4 and 5) were already made, all on 2026-08-30, and all three commits are ancestors of this document's own latest commit 1db5787 (2026-09-02). Only items 2 (WEAPON_PAGES order) and 3 (ARMO… |
| 1072 | H·S | **`tools/runtime-capture/ss2-capture-wrapper.as`, `shop-open`.** It must call `shop["item" + shopItem].onRollO… | The call is present today at ss2-capture-wrapper.as:1200 (`chosen.onRollOver();` immediately followed by `chosen.onRelease();` at :1201, behind a both-handlers-bound guard at :1193). It landed in 2df4ba0 at 2026-08-30T22:46:58-04:… |
| 1046 | M·W | Hacking and bashing use `[4] = 4*[3]` up to ids 34 and 56 and then diverge. | Hacking uses `[4] = 4*[3]` for ids 21-34 and diverges from id 35 onward — that half is right. Bashing NEVER uses 4x: it uses `[4] = 3*[3]` for every id in 41-60 EXCEPT id 55 (80/250, ratio 3.125) and id 57 (100/30, the §7.1 anomal… |
| 1088 | M·S | **[`ss2-arena-route.md`](ss2-arena-route.md) §6.** Three corrections: ... | All three corrections are already in ss2-arena-route.md: (a) at :1156 (`attribute_required` is the hero's governing attribute), (b) at :1138-1140 (both demo refusals "dead in this build"), (c) at :1145-1148 (no `item<n>` at entry/… |
| 1095 | M·S | **[`ss2-battle-map.md`](ss2-battle-map.md).** It should record `min_damage = round(strength*2) + weapon_min_da… | ss2-battle-map.md already records all three things this item asks for: the `[3]`/`[4]` lookups at lines 447-448 and the min/max formulas at lines 466-467, landed in 0a3076c on 2026-08-30, two days before this document's own last e… |

### `docs/integration/ss2-probe-replication.md`
182 claims examined, 168 HOLD, 2 unchecked here, 7 STALE/WRONG, 7 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 104 | H·W | The corpus confirms the gate is closed for 1–4 and open for 5–12. | "The corpus confirms the gate is closed for directions 1, 2 and 3 and open for 5–12. Direction 4 appears only on quick-band MISS rounds, which stop before the gate, so the corpus says nothing about direction 4." |
| 200 | M·S | The 64 archived traces that lack `overdraw` | 68 as of 2026-09-07. Note the internal tension: lines 41-43 of this same document say captures/ is a live directory whose file count moves and that "no total is pinned here", yet this line pins one against exactly that moving dire… |
| 202 | M·W | they are the earlier band, navigation and frame-rate captures | No frame-rate capture is among them — every session-fps*/session-fr* trace carries "overdraw":0. Correct composition: 42 are the earlier band, navigation, campaign and lettered probe-precursor sessions; 2 are simulator dry runs; 2… |
| 208 | M·S | the overstatement is now in `HANDOFF.md` | The overstatement was removed from HANDOFF.md by 2d70738 on 2026-08-30, the same day this document was committed. Today the only copy of the sentence "every measurement replicates across all twelve directions with zero exceptions"… |
| 241 | M·W | two of the six pre-existing reports name a committed observation record whose digest differs from the report's | "ALL SIX of the pre-existing reports name a committed observation record whose digest differs from the report's" — or, if the provisional one (item 6) is meant to be excluded, "five of the six". It was six of six on the document's… |
| 37 | L·S | The rest of the tree is skipped: the band captures (`session-pw*`, `session-qk*` and the lettered sessions), t… | The enumeration was complete on 2026-08-30 (~66 skipped traces) but the archive has since grown to 1455 skipped traces. The dominant skipped groups today are session-onx* (1171) and session-ondc* (150), which the sentence does not… |
| 222 | L·S | (`HANDOFF.md`: it confirms something the map asserts flatly, and the extra draw's label and position are echoe… | The cited passage is no longer in HANDOFF.md (removed in the same 2026-08-30 rewrite). The citation should point at `git show 46cbd21:HANDOFF.md` lines 49-53, or the substance should be restated here rather than cited. |

### `docs/integration/ss2-runtime-capture.md`
141 claims examined, 97 HOLD, 5 unchecked here, 35 STALE/WRONG, 0 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 5 | H·S | **22 fixtures are promoted** to runtime-observed goldens | 23 goldens are promoted: the twelve prisoner kills, the ten probe arms, and `golden-armoured-deflection-threshold-cleared` (promoted 2026-09-02 in 2341789). The number 22 is repeated and load-bearing at lines 5, 136, 278, 423, 540… |
| 271 | H·W | **not one of the 22 promoted goldens cites an observation that carries one** (only 9 of the 67 committed recor… | 11 of the 69 committed records carry a nonce and ALL 11 are now cited by promoted goldens. The conclusion inverts: for several goldens independence is no longer just the two operator strings. (The list at line 773 is the same nine… |
| 276 | H·S | Until now the wrapper has never written combatant state ... and all 22 promoted goldens rest on scenarios the … | The future tense is spent. The wrapper has written combatant state, twice, and the resulting golden is committed at helmet 6 / greaves 2 with `provenance.staged` set. Everything the section then says about what a staged capture pr… |
| 480 | H·S | `capture-refused-wrong-side` appears **zero** times across all 268 archived `.rufflelog` files and zero times … | The archive now holds 1650 `.rufflelog` files and `capture-refused-wrong-side` appears in 631 of them (still zero in any `.jsonl`, which is correct — it is a `dbg` line that `delog` strips). The `capture-refused-unstaged` count of… |
| 486 | H·S | consistent with a marker that has never fired anywhere in this archive. So do not read the zero as "the guard … | The guard was fixed four minutes after this paragraph was committed (ad8c9ae 07:32:49 -> 2b483a8 07:36:57 on 2026-08-31) and it demonstrably runs: it now reads `overlayClip().game_attacker`, refuses 631 times across the archive, a… |
| 541 | H·S | each golden-cited session preserves the exact wrapper it ran under `captures/<session-id>/`, and across the 44… | All 62 cited observations have committed records, but only 51 of the 62 cited sessions preserve a wrapper copy at all — the 11 nonce-bearing sessions preserve none, so the wrapper claim cannot be made for them from the archive. An… |
| 547 | H·S | **exactly 9 wrote first to the claimed attacker's own side — the nine arena rounds above, and nothing else.** | Only the denominator is stale: over 1496 classifiable sessions the answer is still exactly 9, and they are still exactly the nine adc rounds. Re-derived independently, the twenty-round table at lines 468-469 also reproduces byte f… |
| 706 | H·S | So a legacy record validates, matches and promotes exactly as before; it simply carries no assurance on those … | A nonce-less record now promotes only if its exact digest is in the closed waiver set `SS2_PRE_NONCE_OBSERVATION_DIGESTS` (src/golden/pre-nonce-observations.js, 58 entries, "may only ever shrink"); anything else is refused. Commit… |
| 748 | H·S | **Outstanding.** `GOLDEN_PROVENANCE_KEYS` in `src/golden/run-1v1-fixture.js` is a closed set that does not yet… | The item is closed. `GOLDEN_PROVENANCE_KEYS` admits `staged` (added 2026-09-02), `run-1v1-fixture.js:663` validates it through `parseStagedDeclaration`, and a staged capture has since been promoted: `golden-armoured-deflection-thr… |
| 778 | H·W | **No committed record carries `staged`**: nothing has been wrapper-staged yet, so every record in the reposito… | Two committed records carry `staged` — `obs-onx1405-a1` and `obs-onx1521-a1`, each declaring a sixteen-field villain staging — and the golden they were promoted into, `golden-armoured-deflection-threshold-cleared`, carries the sam… |
| 10 | M·S | The other 33 committed fixtures are still `classification: "candidate"`. | 60 candidate fixtures are committed and 37 of them have no golden. The five `candidate-champion-*` fixtures were added in 5d3d777 ("Author the champion family by decoding its DNA") after this line was written. The same 33 appears … |
| 375 | M·W | observations carry hook names (`damagecharacter` ×121, `elimination` ×180, `result-bridge` ×61, `first-blood` … | The parenthetical is a raw `"reason":` token census across the directory, not a census of hook attributions. `elimination` (×180) and `first-blood` (×3) occur only as the **result event's** `reason` (e.g. obs-qk2.json:131, obs-202… |
| 391 | M·S | re-running the comparison over the 44 golden-cited observation records that are committed, all 44 still match | 62 golden-cited observation records are committed and all 62 still match under the translating projection. The retrospective check is stronger now, not weaker. |
| 423 | M·S | **May not** read the 22 promoted goldens as having *passed* this check. They were promoted under the stripping… | 22 of the 23 goldens were promoted under the stripping gate. `golden-armoured-deflection-threshold-cleared` was promoted 2026-09-02, after the hook translation landed 2026-08-31, so it DID clear the translating gate rather than me… |
| 479 | M·S | `captureAllowedNow` wraps the side check in `if (attacker != undefined)` (`ss2-capture-wrapper.as:1978`) | `captureAllowedNow` begins at :1966 and its side check is at :2007-2018. There is no longer an `if (attacker != undefined)` wrapper: the rewritten guard computes `isHero`/`isVillain`, refuses `capture-refused-attacker-unresolved` … |
| 504 | M·S | **53 of the 193 armed sessions in the archive made no `damagecharacter` write**, so the discriminator is silen… | 1550 armed sessions, 1496 with a `damagecharacter` write, 54 without — the discriminator is now silent on 3.5% of them, not more than a quarter. Line 547's "of 193 armed sessions, 140 made a `damagecharacter` write" needs the same… |
| 683 | M·S | **Absent means the wrapper staged nothing** — true of every trace and every one of the 22 promoted goldens. | No longer true of every trace: the two `session-onx*` traces carry `end.staged`, as does the golden promoted from them. Line 698 ("every trace behind the 22 promoted goldens does") and line 746 ("what keeps the 22 committed golden… |
| 709 | M·S | For the same reason the nonce gate binds only observations that actually carry a nonce — absence is never read… | Absence is no longer neutral: it is a refusal unless the record's digest is on the frozen pre-nonce list. The sentence is right that absence is never read as a *shared* value, but wrong that the gate "binds only observations that … |
| 781 | M·S | The 22 goldens cite 47 distinct observation ids, and **all 47 have committed records** under `test/observation… | The 23 goldens cite 62 distinct observation ids, all 62 have committed records, and 69 records are committed in total. The substantive claim (a reviewer holding only the repository can resolve every citation) still holds. |
| 786 | M·W | the records are **not** in `test/observations/`, they are one level down in `test/observations/ss2-1v1/`. A ce… | The stated cause cannot produce the reported symptom: a census that resolves nothing would report all 47 ids missing, not exactly three. The real cause is that exactly three committed records have a filename that differs from thei… |
| 945 | M·S | Taking the eighteen first-segment names the 55 committed candidates offer, **six** are refused for that reason | Nineteen first-segment names across 60 committed candidates, and SEVEN are refused. The table at lines 948-955 is missing a row: `champion` \| 5 \| two at direction 5, two at 9, one at 1. The six rows it does list all re-derive exac… |
| 1053 | M·S | Every golden so far comes from one staged pair (the tutorial prisoner against a level-1 gladiator with no armo… | `golden-armoured-deflection-threshold-cleared` is an armoured (armourclass 79, helmet 6, greaves 2), NON-LETHAL (`resultEvent: null`) golden captured on the arena route, not the prisoner pair. Armour and non-lethal outcomes are no… |
| 231 | L·S | all 407 sample entries across all 67 committed records carry the identical pair | 421 sample entries across 69 records (the older 67 records still total exactly 407; the two `obs-onx*` records add 7 each). The substantive claim — one call site, one `injected` value, both compile-time constants — still holds exa… |
| 340 | L·S | ingest copies it onto the observation record's mutation entry as `reason` (`src/golden/capture-ingest.js:372`) | The copy is at `src/golden/capture-ingest.js:393`; line 372 is now part of the `before`/`after` presence check. |
| 362 | L·S | `capture-ingest.js:447` mints `{path: "/result", …, reason: "result-bridge"}` | It is at `capture-ingest.js:468`. The behaviour described — a synthesized `/result` row with evidence-derived `winnerSide`/`loserSide` — re-derives and HOLDS (`loserSide` read from `deathEvent.event.side` at :407). |
| 371 | L·S | `matchSs2ObservationToFixture` — the function `verify` and the promotion gate both call (`src/golden/promote-1… | The promotion gate's call is at `promote-1v1-golden.js:461`; line 373 is now the synthetic-simulator rejection. |
| 384 | L·S | `projectTraceForMatching` (`src/golden/observation.js:863`) ... `hookForFixtureMutation` (`:888`) ... `SS2_HOO… | Every line number in this paragraph has drifted: 863->897, 888->922, 206->209, 229->231, 173->174, 732->715, 896->930. All the described mechanisms are unchanged and re-derive; only the anchors are wrong. |
| 395 | L·S | `projectSs2ObservationForComparison` (`:732`), which keeps `reason` untranslated and is called by no code on t… | It has a second non-test caller, `tools/pairwise-gate-dormancy.mjs` (added 4c5d3e2, 2026-08-31 18:37, about eleven hours after this sentence was written at 07:32 in ad8c9ae). The broader claim — nothing on the capture path calls i… |
| 435 | L·S | `comparableSamples` (`src/golden/observation.js:704-714`) drops both before comparing | `comparableSamples` is at `src/golden/observation.js:687-697`; lines 704-714 are now a doc comment on `projectSs2ObservationForComparison`. The behaviour (dropping `callSite` and `injected`) re-derives and HOLDS. |
| 448 | L·S | ingest checks only that it spells `hero` or `villain` and copies it through (`src/golden/capture-ingest.js:106… | `:106-107` still HOLDS. The copy-through is at `:526` not `:505`, and the side derivation spans `:407-468` not `:437-447`. |
| 513 | L·S | `test/ss2-post-tutorial-fixtures.test.js:252` ... both `assert.equal(scenario.attackerSide, "hero", id)` | The post-tutorial assertion is at :255 and reads `assert.equal(fixture.scenario.attackerSide, "hero", id)`. The probe cite at :184 is exact. The surrounding claim — that nothing in ingest, matching, promotion or the suite compares… |
| 592 | L·W | \| `var` \| any \| named scalar: `fight_mode`, `attack_direction` (physical ingress), `spell_id` (spell ingress .… | The enumeration omits `phase_action`, a fifth `var` name the wrapper has emitted since 2026-08-30 (2654a09/85f5893) and which occurs 9393 times across the archived `.jsonl` traces. The grammar row's current wording was written 202… |
| 663 | L·S | The accepted grammar, defined once in `parseSs2StagedDeclaration` (`src/golden/observation.js`) and applied to… | The single definition now lives in `src/golden/staged-declaration.js` (moved there to break an import cycle); `parseSs2StagedDeclaration` in observation.js is a thin re-export. It is applied at THREE layers, not two: the trace lin… |
| 891 | L·S | \| `tools/runtime-capture/campaign.mjs` \| `plan` (coverage), `seed` (which tape a round injects), `ingest-round… | `campaign.mjs` has five subcommands; `watch-fields` is missing from the table. (`tools/capture-session.mjs`'s eight subcommands at line 68 re-derive exactly and HOLD.) |
| 1023 | L·W | \| 28 `closerange_archer` \| `bash_attack`, `shove`, `taunt`, `jumpleft`, `jumpright`, `walkright`, `psyche_up`,… | `walkleft` is missing. Every other row in this table lists the union across both facings (both charges for frame 5, both bombards and snipes for frame 20, both walks for frames 5/13/20); by the same convention frame 28 has nine la… |

### `docs/integration/ss2-staging-runbook.md`
231 claims examined, 192 HOLD, 16 unchecked here, 18 STALE/WRONG, 7 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 8 | H·S | Scope: the **38** committed candidates ... (60 candidates, 22 promoted.) | Scope: the 37 committed candidates in test/fixtures/ss2-1v1/ that have no counterpart in test/fixtures/ss2-1v1-golden/. (60 candidates, 23 promoted.) golden-armoured-deflection-threshold-cleared.json was promoted in 2341789 twelve… |
| 204 | H·S | the `helmet > 25` arm at `+0x34a7` is new to the record and irrelevant at the levels the fixtures use ... ever… | Five committed fixtures break both halves. All five candidate-champion-* stage villain helmet 102, which is exactly the helmet > 25 arm; their helmet_defence 25 = round(herolevel 5 * 0.5 * 10), not 102 x 10 = 1020. The arm is not … |
| 664 | H·S | **`fight_mode` is `tournament`, which no committed observation has ever recorded** (67 records carry `duel` an… | Two committed observations now record fight_mode == tournament (obs-onx1405-a1, obs-onx1521-a1, landed in 2341789). The parenthetical '67 records carry duel and misc' still holds exactly (1 duel + 66 misc of 69 records), but the h… |
| 906 | H·S | The fix belongs in `ss2-capture-wrapper.as` and so needs the vehicle gate re-run; the wrapper was frozen for t… | This paragraph is a leftover that contradicts line 871 of the same section ('Both are now fixed and the guard is proved to fire in both directions (commit 2b483a8)'). The wrapper now reads ov.game_attacker, and the recommended ref… |
| 979 | H·S | **These three are the first observation of `fight_mode == "tournament"` in the archive.** | Family A got there first: the two tournament-mode observations belong to golden-armoured-deflection-threshold-cleared (§3), not to Family B. The three tournament candidates would be the first tournament observation of the DEFEAT-G… |
| 1389 | H·S | **The real blocker:** the wrapper emits **no `magic-damage` event**. ... `magic_damage_character` hook is regi… | The wrapper DOES emit the magic-damage event, since 7601888. The hook label is now "magic-damage-character", not "damagecharacter", and the quoted two-line registerSlot snippet no longer exists in the file. The surviving spell blo… |
| 1481 | H·S | 4. **`-StageHero weapon:<n>` / `-StageVillain weapon:<n>`.** Never run. | -StageHero weapon:24 HAS been run and applied: it appears in the 'staged' lines of session-champ-n1 attempts 1 and 2. Only the -StageVillain weapon:<n> form remains unrun. The item's conclusion ('It is now the only unverified step… |
| 1512 | H·S | 11. **The champion staging string has never been run.** §2A's `-StageHero` is twenty-two fields derived from t… | It has been run. The exact twenty-two-field §2A.2 string was applied in session-champ-n1 (2026-08-31), which this same document records at §2A.5 lines 673-734 ('Run 2026-08-31, session-champ-n1, three attempts, -ArenaStagedLevel 5… |
| 249 | M·W | the one fixture it could bite is `candidate-snipe-shield-boost`, which stages hero `shield 10` | Three uncaptured fixtures stage attacker-side armour, not one: candidate-duel-absorbed-normal-hit and candidate-duel-firstblood-normal-kill both stage hero greaves 4, boot 4, armourclass 20/20 with attackerSide hero, and the §0.5 … |
| 268 | M·W | `campaign.mjs` derives the same three capability columns the same way | captureVehicles derives TWO booleans — watchFields and staging. The string 'autopilot' does not occur anywhere in campaign.mjs, and there is no snapshot-guard column either. So 'campaign.mjs plan --family <f> is the authority' is … |
| 342 | M·S | **Twenty of the 38 need extra watch fields** | Twenty of the 37. The count 20 and its 8 + 5 + 7 composition are both still exactly right, and every one of the eight per-fixture rows in the table below re-derives correctly; only the denominator moved. |
| 587 | M·S | The `.EXAMPLE` block in `run-arena.ps1` shows `-ArenaStagedLevel 4` with no `-StageHero` for `candidate-champi… | The .EXAMPLE block was corrected in eccc121 — the same commit that added §2A.5 to this page. It now shows -ArenaStagedLevel 5 WITH the full -StageHero string for candidate-champion-normal-armour-absorbed. The remaining -ArenaStage… |
| 731 | M·S | Across the whole archive the drawn range is `ac` 0–195 and `hp` 30–140 | hp now spans 10-190 across the archive (the 10 is the prisoner route's 'Fearful prisoner'; the 190s are ladder draws in session-onx2075 and session-onx2169, both after 2026-08-31). ac 0-195 still holds. The neighbouring invariant … |
| 855 | M·S | Across 268 archived rufflelogs the refusal appears **zero** times | The archive at /mnt/c/ss2-capture/captures (which DOES resolve from this environment) now holds 1650 rufflelogs; 631 carry capture-refused-wrong-side and 1343 carry an attacker-resolved-<side> marker. The sentence is a dated 2026-… |
| 982 | M·S | retires the `fight-mode-tournament-unobserved` flag on eight committed fixtures | Thirteen committed candidates carry the flag, not eight; the five candidate-champion-* fixtures landed after this sentence was written. (The promoted golden does not carry it: grep -c on golden-armoured-deflection-threshold-cleare… |
| 1431 | M·S | \| A `candidate-armoured-*` \| 5 \| **reachable now**, commands in §3, all five on `run-arena.ps1` \| ... **10 rea… | One of Family A is captured and promoted. The row should read 4 still uncaptured; the total is 9 reachable with the tooling as it stands (A 4, B 3, champion 2), and the scoreboard's group counts now sum to 37, not 38. The same sta… |
| 359 | L·W | \| every `candidate-spell-*` that stages a defence name \| see §9 \| | §9 is Family G (the duel candidates); the candidate-spell-* family is §10. The pointer should read 'see §10'. It was §9 in the document's first revision too, so this is not renumbering drift — it appears never to have resolved. Li… |
| 868 | L·S | 21 of 21 armed rounds and all 193 archive captures | 1544 delogged capture traces are archived now, not 193. Same dating problem as line 855; the historical argument is unaffected but the number no longer describes the archive. |

### `docs/roadmap.md`
168 claims examined, 155 HOLD, 6 unchecked here, 3 STALE/WRONG, 4 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 15 | H·S | **23 goldens promoted** — twelve prisoner kills covering all twelve melee attack directions, plus five probe p… | The enumeration accounts for 22 of the 23. 12 prisoner kills + 5 probe pairs (10 files) = 22; the 23rd is `golden-armoured-deflection-threshold-cleared`. The enumeration was authored 2026-08-30 when the count really was 22, and co… |
| 33 | H·S | for directions 1-12, with zero armour and zero enchantment coverage | The paragraph was written 2026-09-01, the day before the first armoured golden was promoted. Armour coverage is no longer zero: one golden stages `armourclass 79` (helmet 6, shoulderguard 1, gauntlet 1, greaves 2 per its `provenan… |
| 15 | M·W | the leveled-gladiator arena route runs end to end against the real build (`run-arena.ps1 -Navigate arena` | `run-arena.ps1` has `[CmdletBinding()]` and no `-Navigate` parameter, so `run-arena.ps1 -Navigate arena` is a PowerShell parameter-binding error, not a runnable command. `-Navigate arena` is hard-coded by run-arena.ps1 when it inv… |

### `docs/ss2-adapter-contract.md`
128 claims examined, 111 HOLD, 3 unchecked here, 11 STALE/WRONG, 6 ambiguous/uncheckable/other.

| line | sev | claim | proposed correction |
| --- | --- | --- | --- |
| 55 | H·S | \| `src/team/placeholder-rules.js` \| the only formulas in the tree — all placeholder \| | The module table (lines 52-62) is missing two modules that have existed since 2026-09-01/09-02: `src/team/ss2-rules.js` (86851 bytes, SS2's own map-derived arithmetic, the largest file in `src/team/`) and `src/team/ss2-weapon-tabl… |
| 64 | H·S | The boundary is asset-free and dependency-free: ESM, Node builtins only, no game data of any kind. | `src/team/` now contains game data: `src/team/ss2-weapon-table.js` holds 90 weapon rows (id, type, weight, min damage, max damage, range multiplier) transcribed out of the licensed build, and its own header calls itself "build DAT… |
| 76 | H·S | \| `verification` \| `"placeholder"` \\| `"runtime-verified"` \| see the provenance gate below \| | There are THREE tiers: `"placeholder"` \| `"map-derived"` \| `"runtime-verified"`. `assertProvenance` (rule-set.js:130) enforces a distinct gate for MAP_DERIVED: `runtimeVerified` must be false, and it must pin a build SHA-256 and c… |
| 198 | H·S | **Everything shipped today is placeholder.** `classicStyleRules` and the `melee/ranged/spell/rest` vocabulary … | Not everything shipped is placeholder. `src/team/ss2-rules.js` ships a `map-derived` rule set (`ss2TeamRules`, id `ss2-map-derived-tournament`) whose arithmetic is read out of the licensed build's bytecode, citing 23 goldens and t… |
| 1036 | H·S | `classicStyleRules` is the only rule set anywhere under `src/`, and it is a declared placeholder; the others i… | Two independent errors in one sentence. (a) `classicStyleRules` is a formulas object; the rule set built from it is `placeholderTeamRules` (placeholder-rules.js:186), which is also `battle-host.js`'s default (`rules = placeholderT… |
| 1039 | H·S | **campaign roster and reward integration** — the record layer stores an outcome, but nothing reads a record ba… | Roster read-back landed 2026-09-07: `rosterFromCampaignRecord` (src/campaign/to-battle.js) reads a settled record plus the bout's blueprints back into the next bout's teams, and `advanceCircuit` (src/campaign/circuit.js) consumes … |
| 193 | M·S | `describeTeamRuleSet(rules)` returns the one-line summary (`id`, `verification`, `runtimeVerified`, `goldenFix… | It returns EIGHT fields, not six: `id`, `contractVersion`, `verification`, `runtimeVerified`, `goldenFixtureIds`, `mapSourceRefs`, `buildSha256`, `note`. `mapSourceRefs` arrived with the map-derived tier (commit cfda417); `contrac… |
| 625 | M·S | A future `remove_armour` rule set — which has to know *which* piece was destroyed, not only that armour fell —… | The "future" rule set is present. `src/team/ss2-rules.js` declares `SS2_RESOURCE_NAMES` with 32 entries, 14 of which `CANONICAL_RESOURCE_SOURCES` never emits — including all eight armour PIECE IDS this judgement call excludes, plu… |
| 956 | M·S | **Facing is read but not carried.** ... It lives in the adapter's clip record, and a rule set that read it wou… | A rule set in this tree already carries facing INSIDE the hash. `src/team/ss2-rules.js` encodes `gladiator_dir` as the status token `facing-left` (line 787) and reads it back (line 924); `status` is on `combatantView` AND `combata… |
| 941 | L·W | Struck rather than deleted, because `docs/roadmap.md` cited this numbered entry by name | No document cites this entry by number. `docs/roadmap.md` (before and after ab050a1) links to `ss2-adapter-contract.md` and restates the gap in prose; it never says "Still open item 1", and today's Stage 4 cell just says "**ONE ga… |
| 1064 | L·W | **The `320…344` band `slot-layout.js` already reserves is empty.** | `slot-layout.js` reserves 322-335, not 320-344. `ALLY_DEPTH_BASE` is 320 but 320 and 321 are never used (slotIndex 0 takes the vanilla depths). With `ALLY_SIDE_DEPTH_STRIDE 10`, `ALLY_SLOT_DEPTH_STRIDE 2` and `MAX_SLOTS_PER_SIDE 3… |
