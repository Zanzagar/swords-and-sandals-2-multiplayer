---
handoff:      2026-09-07-0955--the-last-adapter-gap-and-the-sweep
written:      2026-09-07 09:55 -0400
sessionId:    cb4573bf-667b-4a07-b201-bd507c84f3ff (https://claude.ai/code/session_01RUt3YdrZ6qwhazUARrSoQi)
branch:       arena/champion-capture. SIX commits, `20a8fa0` `c5d45f9`
              `cc4ff6e` `659dfab` `e86643f` + the opt-in bag. The first three were pushed at 10:05 with
              the owner's explicit approval (`470c56a..cc4ff6e`); the fourth
              came after.
              Push state is decided at the very end of this session — check
              `git log --oneline github/arena/champion-capture..HEAD` rather
              than believing any sentence here.
suite:        816 / 815 / 0 / 1 (fresh-clone profile: `captures/` holds only
              ARCHIVE-MANIFEST.sha256 and README.md), measured at the end.
              From 787 at session start. **It read 808 mid-session and a
              verifier caught me quoting the stale figure in a wave brief.**
              Re-measure; never copy this line.
supersedes:   2026-09-07-0825--the-accepted-decisions-do-not-authorize-anything,
              whose ranked item 2 is BUILT and whose document-integrity sweep is
              RUN. Its ranked items 1, 3 and 4 are untouched and all three are
              still the owner's.
---
# Handoff — the adapter's last gap is closed, and every document was swept

## The one-sentence version

Ranked item 2 is built — the per-action animation acknowledgement, whose
proposed mechanism turned out to be **wrong** — and the document-integrity sweep
ran across 17 documents and 3,146 claims, of which **264 were stale or wrong**;
the corrections that were re-derived by hand have landed and the rest are a
labelled worklist.

## THE HEADLINE: my own documentation told me how to build it, and it was wrong

`docs/ss2-adapter-contract.md` and `presentation.js` both said *"the resolver
sequence is already unique per action and would serve"* as the per-action token.
**It is not.** `addEvent` stamps `sequence: battle.events.length + 1`, so it is
unique per EVENT. Measured over 5,708 actions (40 seeds, 1v1 and 3v3,
`ss2TeamRules`): 5,488 actions emitted one event, 140 emitted two, **80 emitted
four** — a killing blow emits the action, the knockout, `team-eliminated` and
`battle-result-pending`. A token read off `event.sequence` splits one action into
four and the host gates on the wrong number.

Deriving the boundary from the event stream instead is ALSO unsound:
`assertActionOutcome` requires only that `events` be an array, so a rule set may
legally emit none or a dozen, and there is a test with an injected two-event rule
set pinning that.

**The identifier that works already existed:**
`lastResolvedAction(battle).firstEventSequence`. And the reason it is not in
`toTeamWireState` turns out to be load-bearing rather than an oversight —
`combatStateHash` hashes the whole projection, so projecting an action boundary
would move every pinned battle hash and desync an old peer from a new one. So
**the boundary is carried IN by the caller and never derived from the wire**,
and a test asserts the projection contains no `firstEventSequence` and that a
battle driven with boundaries hashes identically to one driven without.

## What that seam does and does not do

- `presentResolvedEvents(wire, { actionBoundaries })`,
  `binder.drain(wire, { actionBoundary })`. Every command bound from an event
  carries `actionToken`. **No boundary supplied means `null` — present and null**,
  so a host cannot read a missing field as "no gating needed".
- `src/adapter/action-gate.js`: report accepted once, duplicates answered rather
  than thrown, an unknown token refused, an out-of-order report accepted and
  FLAGGED (a surface finishing a later action first is unmeasured here, not
  contradicted by resolved state).
- `host.readyForNextAction()` / `reportActionAnimation` /
  `abandonActionAnimation`. **Advisory by default**, because every headless
  caller has no surface to report from and a blocking gate would deadlock the
  goldens, the replay harness and the suite. `awaitAnimations: true` makes
  `submit` refuse, and it refuses **before** `applyAction`, because an applied
  action cannot be taken back.
- **NO TIMEOUT ANYWHERE, and that is the design.** Nothing has captured the
  vanilla timeline's own completion signal, so a host that stops waiting says so
  itself and the reason is MANDATORY — a gate opened by giving up has to be
  distinguishable in the record from one opened by a surface reporting.
- **Nothing in the host ever calls `report`.** Same rule
  `acknowledgeResultAnimations` was rewritten to obey after it was caught
  fabricating the evidence it was waiting on.

**Be honest about what it is: a seam ahead of its consumer.** No renderer
exists, the tests drive it with a simulated surface, and no capture has ever
observed a vanilla action timeline reaching a terminal frame. README and the
roadmap say that rather than claiming the signal is solved.

**Seven mutants were killed before I trusted the tests**, including the exact
wrong design (`actionToken = event.sequence`, which fails 8 tests), a host that
reports on the surface's behalf, an `abandon` that needs no reason, and a binder
that sorts boundaries instead of refusing them.

## THE SWEEP, and the number that matters is not 346

17 write-nothing surveyors (one document each), then 34 adversarial refuters at
two per document, one named claim each, aimed at two DIFFERENT failure angles
rather than run as replicas. **`started == returned` on both phases: 17/17 and
34/34, zero errors** — so it is VERIFIED, not merely complete.

`docs/roadmap.md` went in as a **control**, because it had been re-derived by
hand hours earlier. 7 findings from 168 claims, both high ones real and both
about the enumeration behind a number that had itself been corrected. The
surveyors were not over-reporting.

**3,146 claims examined, 264 STALE or WRONG (90 high). The refuters broke 7 of
34, and one break outranks every correction in the sweep:** applying the
`ss2-battle-map.md` Steam-build "fix" would have **broken the corpus**.
`24807725` is `SS2_STEAM_BUILD_ID`, enforced at eleven sites under `src/` and
carried by 262 tracked files against 2 in the whole repository carrying the
newer id. It is a compatibility key, not an install-identity field. **Five of
the seven had survived their own surveyor's evidence check** and would have been
applied by anyone reading findings as results.

`docs/doc-integrity-sweep-2026-09-07.md` carries the method, the seven breaks,
the re-derived number table, and the remaining ~250 findings **labelled as
CLAIMS TO VERIFY rather than results**. Read its header before working it down.

## What the sweep changed, and the pattern to expect

One cause dominates: **the corpus moved on 2026-09-02 and 2026-09-07 and the
documents did not.** 22→23 goldens, 67→69 observation records, 9→11
nonce-bearing, 38→37 uncaptured.

- **`ss2-golden-harness.md` was the stalest file in the repository** — "first
  four goldens", "Four fixtures carry it, and only four", and a next-steps list
  every item of which is done. It was ALREADY wrong at its own last edit.
- **`ss2-champion-dna.md:273` was WRONG, not stale**: "the largest range factor
  anywhere in the table is 3" — it is **100**, on 18 ids. §7 draws a *"no
  staging can start the hero in close range"* invariant from it that does not
  survive. **Left flagged as an UNVERIFIED capture-plan consequence rather than
  replaced with a new universal**, because nobody has staged a ranged primary
  and watched what `initialise` does. Do not quote the new reading as settled.
- **`ss2-runtime-capture.md`**: "not one of the 22 promoted goldens cites an
  observation carrying a nonce" INVERTS — 11 of 69 carry one and all 11 are
  cited, across 5 goldens; "no committed record carries `staged`" is false.
- **The adapter contract, campaign persistence and README** all advertised as
  missing things that had already landed — roster read-back most of all, which
  the contract called missing on the same day it shipped.

## AND ONE CLAIM ABOUT THE EVIDENCE ITSELF WAS WRONG

The living head said the OneDrive tree *"now holds only the git bundle"*.
Measured 2026-09-07: it holds **1,589 files / 19,904,374 bytes including 292 raw
`.rufflelog` traces** — byte-for-byte the figure the same section records for the
2026-08-31 `D:` mirror, so it is a frozen replica. **The archive has THREE
copies, not two**, and two are reachable from WSL on this box right now. The
tree carries `_RETIRED-DO-NOT-WORK-HERE.txt`, which is presumably why a previous
session inferred it was empty and never looked. *State what you measured, not
what you inferred from one file.*

Also worth carrying: **`/mnt/c/ss2-capture/captures` DOES resolve from WSL here**
(1,592 entries), so archive questions are answerable. What is absent is the
fingerprinted build — the `Downloads` copy hashes `27f80ff3…` and the oracle is
`77CB545C…`, a different file — so AVM1-offset claims stay unanswerable *for
that reason*, not because the archive is unreachable.

## A correction that carried a number went stale as fast as the number

The living head's "expected test profiles" block said **"THE COUNTS IN THIS
SECTION ARE STALE BY 8 … read every 622 below as 630"**. When it was found it
was stale by 178, and its substitution instruction was wrong at BOTH values — a
reader following it would have swapped one wrong number for another. Rewritten
to state the COMMAND (`node --test --test-concurrency=1`) rather than a number.
**Apply that shape to every "stale by N" correction you are tempted to write.**

## THE FORK — still the owner's, and unchanged from the last brief

Nothing on the Endless track is mine to start: all three accepted decisions end
*"This decision does not authorize implementation"*. The options are unchanged —
**(a)** authorize a slice (EP-D02's capacity core is the only numerically
self-contained one); **(b)** answer EP-D04 and EP-D05 first, which unblocks the
most; **(c)** keep building ordinary game code. **This session took (c) again,
and (c) has now paid twice.**

Also still the owner's, all unchanged: the status-phase capture hook
(Windows/Ruffle), the villain stamina 105-vs-110 schema question, and
`.claude/settings.local.json`'s `Bash(rm -rf *)` allow.

## AFTER THE SWEEP: two defects found by USING a seam rather than reading it

The owner chose "keep building game code", so I went looking for what the
adapter host could not do. It could not drive `ss2TeamRules`, the only
map-derived rule set — and the diagnosis moved twice before it was right.

**1. A DIAGNOSTIC COULD ABORT CONSTRUCTION.** `compareMaximumHealth`'s own
docstring says *"Diagnostic only … It never corrects either value"*, but it
could throw and `battle-host.js` calls it once per combatant in its
constructor. It blanks `maxHealth` deliberately — so the rule set must DERIVE
rather than echo the number the adapter just read — and SS2's `maximumHealth`
reaches for a `herolevel` resource `CANONICAL_RESOURCE_SOURCES` does not carry.
Stack trace: `ss2-rules.js:1460` ← `state-bridge.js:606` ← `battle-host.js:299`.
**The battle underneath was fine**: the resolver builds the same combatants,
because the roster had already normalised `maxHealth` from `hitpointsmax`.
An underivable formula is now REPORTED in
`diagnostics.maximumHealthReports[].underivable`.

**AND IT HAD BEEN HIDING THE REAL WALL.** `ss2-rules.js`'s header says a
supplied gladiator *"now BUILDS, and fails on its own first swing instead"*.
That was an INTENTION, not a measurement — it did not build. It does now, and
fails on the role-based `max_damage`/`min_damage` requirement at the swing.
**That file has sent a reader to the wrong throw three times**; both walls are
pinned by tests so the next one measures.

**2. MY OWN HEADLINE WAS WRONG, in the exact direction that file warns about.**
I wrote *"the adapter host cannot drive ss2TeamRules at all"*. **It can.** An
AI-FILLED slot takes its bag from `team.aiFill.resources`, bypassing
`CANONICAL_RESOURCE_SOURCES` entirely — measured, a full 27-action battle to
elimination with `unmapped: []`. What the host **cannot** do is drive it with a
gladiator **a person controls**, which is what a playable adapter-driven battle
needs. *(The trap: AI-filling alone is NOT enough. Without a declared
`resources` bag the fill falls back to the same 20-name list and throws the
identical error.)*

**3. NOTHING WAS WATCHING THE ADAPTER'S BAG — the wave's best find.**
`CANONICAL_RESOURCE_SOURCES` IS the supplied path's projected resource bag and
`combatStateHash` covers that projection, so adding one name re-hashes every
adapter-built battle. **Every test assertion about it was RELATIVE and
self-updated silently.** Pinned literally now: adding `herolevel` fails 3 tests.
A comment in `ss2-team-rules.test.js` claiming *"the adapter's resource bags
already had pins like these"* was half wrong, and the wrong half is why a
reader would have believed the suite guarded it.

**4. THE FORK IS TAKEN, AND THE "DECISIVE UNKNOWN" TURNED OUT NOT TO BE
DECIDING ANYTHING.** The wave named one blocker: whether the campaign layer
needs a DESTROYED ARMOUR PIECE to reach the vanilla combat object. Measured
rather than reasoned: **it cannot want one, because a campaign record carries no
resource of any kind.** `grep -c resources src/campaign/from-battle.js` is **0**,
and an outcome projects `combatantId, name, teamId, seatId, slotIndex, aiFilled,
survived, health, maxHealth, statuses`. Second fact, also measured: a
non-canonical resource **cannot read as mirror drift** — `mirrorDifferences`
gates on `CANONICAL_RESOURCE_SOURCES` via `mirrorsToVanillaField`, so it returns
`[]` even with `helmet 6` against a field of 2.

So the opt-in was safe and is **built**:
`toCanonicalCombatantSource(record, { resources })`, with `battle-host.js`
passing `member.resources`. **A gladiator A PERSON CONTROLS now fights a full
battle under `ss2TeamRules` through the adapter host** — settles by elimination,
32 resources projected. A caller that declares nothing is byte-identical to
before; the hash moves only for a caller who asks, and a test pins that it moves
so the cost can never be paid silently. The bag admits only map-cited names
(`citationFor`) and only finite numbers.

**AND THE FIGHT FOUND WHAT THE PROBE HAD NOT.** My first probe showed
`unmapped: []` — because its gladiators wore no armour. The integration fixture
does, so `ss2TeamRules` **destroys an armour piece**, and a piece id is outside
the adapter's declared-resource WRITE allowlist. The value reaches combat state
and the hash and does **not** reach the vanilla mirror. It is reported — and the
reason string was WRONG until now, saying *"no vanilla field carries this
resource"* about a field the map cites by name. It now distinguishes "not in the
write allowlist" from "no such field", because those need different fixes.
**That gap is reported, not a blocker** — see the campaign measurement above —
and it is the contract's "Still open" item 2 arriving in practice at last.
**Widening the WRITE allowlist to the piece ids is the decision that remains.**

Four of five mutants die on the opt-in. The fifth is provably equivalent
(`?? undefined` hits the `= null` default parameter), which is why it is
recorded here rather than chased.

**A METHODOLOGICAL LESSON THAT COST THIS WAVE ACCURACY: I launched it against a
tree I then kept editing.** Two agents correctly reported that my brief's
headline no longer reproduced and that its suite count was stale. A wave's brief
is a SNAPSHOT — do not edit the tree underneath one. Integrity was still clean:
6/6 investigators and 6/6 refuters returned, and the refuters broke 3 of 6
claims, one of them mine.

## Highest-value work, ranked

1. **Work `docs/doc-integrity-sweep-2026-09-07.md` down**, highest severity
   first, re-deriving each before applying. ~250 remain, and the base rate of a
   finding being wrong is **21%** — measured, on the ones that were checked.
   `ss2-arena-route.md`, `ss2-capture-staging.md`, `ss2-staging-runbook.md` and
   `ss2-item-tables.md` got no corrections applied at all this session.
2. **Decide whether the WRITE allowlist grows to the armour piece ids.** It is
   the last thing between an adapter-driven SS2 battle and a vanilla mirror
   that knows a piece was destroyed. Nothing needs it today — the campaign
   record carries no resources — so it is a decision, not a defect, and the
   contract's "Still open" item 2 owns it. **The reported-unmapped behaviour is
   pinned by a test, so it cannot start being silently dropped instead.**
3. **The `ss2-champion-dna.md` §7 ranged-primary question**, which is now a live
   capture-plan hypothesis rather than a settled invariant: stage `weapon:61` on
   the hero and see whether `initialise` really can start him in range. Cheap,
   and it either restores the invariant or changes the champion capture plan.
4. **A capture hook that can arm on a status phase** — still the only way the
   status phase gets runtime backing. Owner's supervised lane; needs Windows.
5. The schema question (villain stamina 105 vs 110), still the owner's.

## Hard rules (unchanged)

- **Derive candidates from the map, never from a capture.**
- **An agent FINDS; the main session RE-DERIVES.** This session's whole sweep is
  the argument for it.
- **Ask before every push.** `main` stays denied outright.
