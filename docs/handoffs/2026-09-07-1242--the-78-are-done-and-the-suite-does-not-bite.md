---
handoff:      2026-09-07-1242--the-78-are-done-and-the-suite-does-not-bite
written:      2026-09-07 12:42 -0400
sessionId:    ff2653b2-38d3-4789-a13e-a7a8a95247f9 (https://claude.ai/code/session_01VKk2AHosgQ3shDEjhPeUFh)
branch:       arena/champion-capture. FOUR new commits — `4fe5dd8` `6df9fa1`
              `cb021c3` `76cd2c3` — and SEVEN commits total are UNPUSHED,
              because the three from previous sessions never went either.
              **Verify, do not believe:**
              `git log --oneline github/arena/champion-capture..HEAD`
suite:        816 / 815 / 0 / 1 (fresh-clone profile), measured AFTER the last
              commit, three times across the session. **Re-measure; never copy
              this line.** The previous handoff's suite line was measured
              before its own commit and was wrong by three failures.
supersedes:   2026-09-07-1140--the-sweep-reached-the-untouched-six, whose ranked
              item 1 (the 78 living-head rows) is DONE. Its items 2-5 are
              untouched and all four are still the owner's.
---
# Handoff — the 78 are applied, and the suite does not bite

## The one-sentence version

The 78 stale rows are re-derived and corrected AT their sentences; a first
systematic mutation audit found that **37 of 48 deliberate one-line breakages
survive the whole suite**, with the corpus-integrity gates the honourable
exception; and a design panel established that **Stage 7 is not the right next
thing and my own framing of it was false twice**.

## READ THIS FIRST: three defects that were MINE, all caught by agents

1. **The commit that repaired one stale pointer minted six new ones.** `4fe5dd8`
   inserted 24 lines above the paragraph it was writing, so that paragraph's
   "archive line at 3133", its worklist range and its four section anchors were
   all wrong the instant they were committed. `test/handoff-navigation.test.js`
   checks section NAMES, never line numbers, so the suite was green with all six
   wrong. **Two independent agents of the wave that paragraph launched found
   it.** The numbers are now GONE rather than corrected — correcting them would
   only restart the clock. **Cite sections by name. `grep -n '^## ' HANDOFF.md`.**
2. **I launched a wave on a wrong line-number offset.** I mapped the 78 rows by
   adding the file's growth (+65, measured and correct) to the sweep's own row
   numbers. The sweep's numbers were ALREADY ~27 lines low against the blob it
   surveyed, so the true offset is ~92. I killed that wave and relaunched with
   every anchor located by MATCHING THE QUOTED TEXT. **A wrong fact in all six
   briefs is the correlated-brief failure this project measured in August, and I
   walked straight into it.**
3. **My six row-lists carried two proposals the sweep's OWN refuters had already
   broken**, because I built the lists from its per-document tables without
   subtracting the seven findings its header table names as refuted. The agent
   that received them caught it and said so. **If you rebuild a worklist from
   that sweep, subtract its own broken-findings table first.**

## What the 78-row wave found that the sweep did not

`started == returned` 6/6 and 6/6, zero deaths, VERIFIED. **31 of the 37 emitted
claims were NOT verified (budget 6) and are marked as such, not as results.**

- **"209 times across the archive" was never a count of times.** `dbg()` in the
  capture wrapper returns early on a repeated label, so `called:*`, `wrapped:*`
  and `action-armed` appear at most ONCE PER TRACE. 209 is the file count in the
  frozen 2026-08-31 OneDrive replica. Substituting a bigger number would have
  fixed the denominator and left the category error in place. **Contrast
  `capture-refused-unstaged`, emitted by `arenaLog`, which does NOT dedupe — those
  ARE event counts. The two families must never be corrected the same way.**
- **"no non-tournament coverage" is BACKWARDS and always was.** 22 of the 23
  goldens are `fightMode: misc`, which IS non-tournament. What the corpus lacked
  was TOURNAMENT coverage, and that closed 2026-09-02.
- **The file states two numbers for one quantity, twelve lines apart** — the
  champion-refusal count is 1,091; the 931 silently drops a session directory.
- **A row the sweep called UNCHECKABLE is checkable**, and the answer is a
  different number: promoting from `candidate-lethal-result` fails 8 of 816, not
  15 of 715, measured by actually doing it in a disposable copy.
- **Six of the sweep's own replacement anchors are stale and one was already
  wrong when the sweep measured it.**
- **Seven rows where a blanket count substitution would BREAK a correct
  sentence**, each now annotated so the next sweep does not "fix" it — including
  "the other 18 goldens cite none", where numerator and denominator both moved by
  one so 18 survives, and the twelve `isNum` CALL sites where `grep` returns 15
  lines because three are comments.
- **Two proposals REFUSED outright**, both of which would have written an
  unmeasured number into the record. Independently re-measured: the joint
  precondition landed **2 in 1,171, not the proposed 5**; and the
  `attackDirection` value list belongs to the 11 committed divergence reports,
  not the 38 traces — the 9 out-of-band values are VILLAIN swings the battle map
  already documents. Writing the proposal in would have implied the hero's
  `+0x61f1` draw produced 2, 3 and 20, deriving from a capture against a
  byte-verified map row.

## THE HEADLINE: 37 of 48 mutations survive the suite

`docs/mutation-audit-2026-09-07.md`. 48 single-line mutations, each in its own
isolated copy; **11 KILLED, 37 SURVIVED**; eight survivors handed to adversarial
verifiers told to break the report, **all eight CONFIRMED-SURVIVOR** with their
own baselines, two mutated runs each and instrumented reachability proofs.
`started == returned` 6/6, 48/48, 8/8.

**The good news is the half that matters most here: six of the eleven kills are
in `src/golden/`.** The two-observations-from-two-independent-sessions rule, the
self-citation refusal, the digest check, the `SS2_STEAM_BUILD_ID` gate, the
launch-nonce owner check and the vanilla-field screen all refused their mutants.
**Only 2 of the 37 survivors are in `src/golden/`. The code protecting the
corpus is the best-tested code in the repository.**

The bad news is everything around it: settlement/elimination 8 survivors,
adapter boundary 8, SS2 arithmetic 7, campaign persistence 7, RNG/hash 5. Three
verifiers reported the original finding UNDERSTATED the cost.

**Two structural facts worth more than any single survivor:**
- **`src/team/controllers.js` has ZERO negative tests** — `ControllerError`
  appears nowhere under `test/`. Three of its throws are confirmed survivors.
- **Every literal pinned combat-state hash is taken on a battle with NO action
  applied** — cursor 0, result null, events []. They pin field PRESENCE and
  whatever varies at construction, and pin nothing that is 0/null/[] before the
  first action. Every other hash assertion in the suite is RELATIVE, so it moves
  with the mutation on both sides. **That asymmetry is what most of the confirmed
  survivors exploit.**

**Two traps recorded so the next run does not pay for them:** a scratch copy
built WITHOUT `.git` measures 813/811/1/1, because a transcription test reads git
history and fails at file level, swallowing its own four tests — copy WITH
`.git`. And two lines in `capture-ingest.js` are byte-identical to each other
while guarding different things — mutate by line number, never by text replace.

**11/48 is a FLOOR on the suite's quality, not an estimate**: the targeting
agents deliberately excluded mutations they could show were already killed.

## Stage 7: asked, and the answer is no

`docs/stage7-transport-findings-2026-09-07.md`. **The designs are not the
deliverable; what the panel measured about the engine is.**

**EP-D07 was accepted by the owner 2026-09-03, lives on the unmerged
`design/endless-progression-owner-packet` branch, and is therefore INVISIBLE to a
grep of the checked-out tree.** It names session topology, presence, timers and
reconnect-versus-abandon as unresolved, and it forbids in as many words the one
behaviour all five designs made their headline: *"The AI never assumes control."*
Five designs, one excluded behaviour, five times. **Read decision records with
`git show`; a clean grep does not mean no decision exists.**

Re-derived by hand, and the most serious finding: **`battle.settlement.arm(...)`
is ACCEPTED on a freshly constructed battle** — `result: null`, zero events,
everyone alive. Not an exploit today (the only production caller is the resolver,
on a real result), but the seam is not ready for an untrusted caller.

## Highest-value work, ranked

1. **Refuse `arm()` on a battle with no result.** Analysis is done and in the
   Stage 7 document. **Blast radius measured: one production caller
   (`src/team/resolver.js:312`) and two test callers.** It is NOT a one-liner —
   `CampaignSettlement` has no battle reference, so the fix is a small design
   choice (pass the result in, or make `arm()` host-internal). **Settlement sits
   INSIDE `combatStateHash`, so treat this as a protocol change: it is the
   `/codex:adversarial-review` case, and worth the owner's eye.**
2. **Give `src/team/controllers.js` its first negative tests.** Zero exist, three
   confirmed survivors live there, and it is the cheapest survivor to close.
3. **Decide whether the WRITE allowlist grows to the armour piece ids.** Owner's,
   unchanged, and nothing needs it today.
4. **The `ss2-champion-dna.md` §7 ranged-primary capture question.** Owner's lane.
5. **A capture hook that can arm on a status phase.** Owner's, needs Windows.
6. The villain stamina 105-vs-110 schema question. Owner's.

**And note what the completeness critic put ABOVE all of these**: the roadmap's
own not-started column still names the RENDERED ARENA — six-slot geometry is
derived and emitted as inert JSON and nothing draws it — and CAPTURE BREADTH, at
37 of 60 candidates with no golden and the spell family never captured. Neither
is a balance decision, and both are more player-visible than anything above.

## Hard rules (unchanged)

- **Derive candidates from the map, never from a capture.**
- **An agent FINDS; the main session RE-DERIVES.** Done here for every number
  written into a document — including correcting a critic that reported
  `src/adapter/` as 2,192 lines with zero non-test consumers when it is 4,052
  lines with exactly one.
- **A wave's brief is a snapshot.** `76cd2c3` is the snapshot to brief against.
- **Ask before every push.** `main` stays denied outright. **Seven commits are
  waiting.**
- **A handoff commit is not finished until `node --test --test-concurrency=1` is
  green, and its suite line must be measured AFTER that commit.**
