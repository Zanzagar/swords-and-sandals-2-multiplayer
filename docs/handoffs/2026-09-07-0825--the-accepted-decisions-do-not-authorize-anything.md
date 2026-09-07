---
handoff:      2026-09-07-0825--the-accepted-decisions-do-not-authorize-anything
written:      2026-09-07 08:25 -0400
sessionId:    8c4c0cbf-9f42-4e2a-bedd-92955513ac37 (https://claude.ai/code/session_01STjHkv778aFGiWPfBzJWNx)
branch:       arena/champion-capture. PUSHED with the owner's explicit approval
              at 08:33 — `219cf99..6cb872b`, SIX commits, not the four an
              earlier draft of this line said. Push state is the LAST thing
              this session did; check
              `git log --oneline github/arena/champion-capture..HEAD` rather
              than believing this line.
suite:        787 / 786 / 0 / 1 (fresh-clone profile: `captures/` holds only
              ARCHIVE-MANIFEST.sha256 and README.md), measured 08:25. From 771
              at session start. Re-measure; never copy this line.
supersedes:   2026-09-07-0724--the-ranked-list-ran-out, whose ranked item 2 is
              answered below and whose items 1, 3 and 4 are untouched because
              all three are the owner's supervised lanes.
---
# Handoff — the accepted decisions do not authorize anything, and the roadmap paid again

## The one-sentence version

Ranked item 2 is answered — three EP decisions are accepted, forty normative
clauses, and **every one of them ends "This decision does not authorize
implementation"** — so the session spent itself where the last one said to look,
in `docs/roadmap.md`, and the campaign read-back finally got a consumer a person
can play.

## THE HEADLINE, and it is a question for the owner rather than a finding

**Nothing on the Endless track is mine to start.** All three accepted decisions
(EP-D01 replacement, EP-D02 Rule Capacity, EP-D07 + dropout supplement) close
with the same sentence, the decision record's header says *"Implementation
remains blocked"*, and `docs/design/endless-mvp-readiness.md` requires a
**separate explicit implementation authorization** from the owner after every
§10 gate. The design track's own newest brief says to address EP-D04 next.

So the deliverable for ranked item 2 is a report and a fork, not a branch.
**See § "The fork" below — it is the one thing on this page that needs you.**

## PREMISE CORRECTION, and it would have wasted a session

**The accepted decisions are NOT on this branch.** They are on the unmerged
`design/endless-progression-owner-packet`. The copy in this working tree is the
449-line version where all six read `pending`, and its EP-D01/EP-D02 are
**different designs** the accepted versions explicitly repudiate — "tier 50 is
not a permanent promise", "the old maximum-one 3-Load identity rule is removed",
ceiling 48 not 4. A reader comparing only STATUS would conclude the design is
unchanged. It is not.

Read them with `git show design/endless-progression-owner-packet:<path>` and
never by checking that branch out: its `AGENTS.md` and `HANDOFF.md` are 156
commits stale, so an agent that checks it out reads obsolete rules.

**Also: the two branches have DIVERGED, not fallen behind.** Merge-base
`4409ec7` (2026-08-31); arena is 156 ahead, design is 15 ahead, and those 15 are
where the acceptances live. The design branch has never contained
`src/team/ss2-rules.js`, `src/campaign/to-battle.js` or `tools/hotseat.mjs`.

**One consequence is a live trap:** EP-D07's `[V]` repository-boundary sentence
*"The only concrete non-test AI policy is explicitly placeholder"* was TRUE of
its own tree when accepted and becomes FALSE the moment the packet merges,
because `ss2-rules.js` carries an expected-value AI policy. It is a merge-time
note, not a wrong acceptance — do not "correct" the accepted packet in place.

## What is implementable, decision by decision

| Accepted | State |
| --- | --- |
| **EP-D02** Rule Capacity | The ONLY numerically self-contained one. 0→48, costs 0/1/2/3, 16 hosts, 18 milestones in six `+2,+3,+3` chapters, Emperor entered at 45. Arithmetic checks: 16×3 = 48, 6×8 = 48. **But** the engine has exactly ONE behaviour-bearing payload (the weapon enchantment) with no assigned Load grade, and 6 of the 16 hosts are spell/Technique positions the playable rule set does not have. A budget over a set of size one is the filing cabinet again. |
| **EP-D07 clause 2** | The admission gate (no allied AI fill, no one-human multi-seat) is buildable today, additive, moves no hash. **But it bans `tools/hotseat.mjs`**, which is the only playable thing here and is exactly the excluded topology. |
| **EP-D07 supplement** | The vote logic is fully specified. Its TRIGGER is not: grace duration, presence mechanism, session topology, durable timer representation and reconnect-versus-abandon serialization are all explicitly `[U]`. Not buildable as stated. |
| **EP-D01** | Seven of nine clauses name no implementable quantity; the closing paragraph defers the ceiling tier, Ascendancy magnitude, Circuit length, catalogs and balance. Only clauses 6–7 are concrete, and they borrow their numbers from EP-D02. |

**Three collisions that need a decision, not code. I verified each myself:**

1. **EP-D02 clause 9 reverses a deliberate, documented choice.** It requires
   settlement to write result + receipt + capacity atomically or write none.
   `src/team/settlement.js:246-248` latches BEFORE the persistence callback, and
   `src/campaign/recorder.js:15-24` says in its own words that a storage failure
   is swallowed so *"the disk is full"* does not become *"the arena crashed"*.
   Not additive: reversing it touches settlement, recorder, store and a v2→v3
   record migration.
2. **EP-D07 supplement clause 7** cites *"the existing atomic Concede receipt"*.
   No Concede receipt exists here — `concede` appears once in `src/` and `test/`
   combined, as an English word in an unrelated comment.
3. **EP-D01 c2 versus EP-D02 c11.** Circuits are strictly postcampaign; a
   route's ceiling is *"the capacity available immediately before that route's
   next championship milestone"*. After the Emperor there is no next milestone,
   so the clamp is either always inert or always undefined.

**The smallest unblocking set is {EP-D05, EP-D04}.** EP-A02 — the one the
previous brief flagged — unblocks NO accepted clause; it blocks pending EP-D06.
Across all forty accepted clauses exactly ONE pending id is named: EP-D04, in
EP-D02 clause 18. Every other cross-reference lives in commentary the record's
own "How to record a decision" section does not put in approved scope.

**And three deferrals inside accepted clauses are owned by NO EP id at all** —
Charms/Soul Relics, Team Tactic lifecycle, grace duration — so answering all
seven pending decisions still would not fully unblock the accepted text.

## THE FORK — this is what needs you

- **(a) Authorize an Endless slice.** Say which, and say it in the decision
  record. EP-D02's capacity core is the only one whose numbers are all present;
  be aware it would validate a budget over one payload until a spell system and
  a Load grade exist.
- **(b) Answer EP-D04 and EP-D05 first**, on the design track, which is what
  that track's own brief recommends and what unblocks the most.
- **(c) Neither — keep building ordinary game code**, which is what this session
  did and what `AGENTS.md`'s "BUILD THE BEST VERSION OF THE GAME" block invites.

Also still yours from the last brief, all unchanged: the status-phase capture
hook (Windows/Ruffle), the villain stamina 105-vs-110 schema question, and
`.claude/settings.local.json`'s `Bash(rm -rf *)` allow.

## What the game can do now that it could not this morning

**`node tools/hotseat.mjs --circuit 3`** — consecutive bouts, survivors carried
between them through `buildCampaignRecord` → `rosterFromCampaignRecord`.
`rosterFromCampaignRecord` landed last session explicitly so the campaign layer
would stop being a filing cabinet, and one week later its only caller was still
its own test file. **A door nobody walks through is a wall.**

The carry goes THROUGH the record rather than copying live combatants, which is
the point: a defect in the round-trip now shows up in a fight.

**It reports two things it must not decide:**

- **`restoredResources`** — a record carries no resources, so a survivor is
  rebuilt from his blueprint and **his armour and stamina come back**. With
  `--armour 30`: `armourclass 0 -> 495, breastplate 0 -> 30, helmet 0 -> 30,
  staminaleft 116 -> 140`. Free repair between fights is a balance decision and
  EP-A03 owns it, so the circuit prints it rather than choosing.
- **`facingCorrections`** — `facing-left` is a carried status token and
  `gladiator_dir` shapes knockback and the armour-debris draw, so a fighter
  moved across the arena would otherwise keep the facing of the side he left.

**No default length**, deliberately: four fights is EP-D03 and EP-D03 is
pending, so `circuitLength()` refuses an absent value and names the decision.

## `playable` was wrong, and then it was worse than wrong

`rosterFromCampaignRecord` reported `playable: true` for the roster produced by
**every ordinary settled bout**, which `createTeamBattle` refuses outright. The
test that covered it asserted the flag and never built a battle.

Fixing the value exposed the real defect: **`playable` cannot be true at all.**
A record needs a settled battle, settlement requires at most one team standing,
so read-back always yields a side with nobody alive. Measured over 240 rosters —
1v1/2v2/3v3, both `includeFallen` settings — never once true. It is now
documented as the structural invariant it is and pinned by a test that says what
to correct if it ever becomes reachable. **Read `unplayableTeamIds` instead**;
it names the side needing a fresh opponent, and the circuit refills it.

That is the **third** wrong claim this seam has made about `playable`, and all
three were mine.

## AND ONE OF THIS REPO'S OWN COMMENTS IS WRONG

`to-battle.js` describes an unplayable roster as STALLING — *"initiative
includes the dead, zero legal actions, no result, permanently"*. **I could not
reproduce it.** `includeFallen` at 1v1 does not yield a roster of corpses: it
yields the LIVE WINNER (88 of 88 at seed 11) beside the loser's body, so it
constructs, the survivor has an action, and it settles at once. A genuine
all-corpses roster needs a DRAW. Left labelled UNVERIFIED rather than repeated
as though checked — do not quote it.

## Codex earned its place for the third session running

Four confirmed defects, **every one something the tests I had just written did
not reach**, and two of them were in those very tests:

- the restoration report LIED for a bounded declaration
  (`{value: 999, max: 100}` enters at 100, was reported `100 -> 999`);
- a DRAW handed back a one-team roster, turning mutual destruction into a crash;
- `--seed` accepted an unsafe integer, so `--seed 1e20 --circuit 3` ran three
  bouts on the identical tape while printing "replays exactly";
- my `playable` contract test had a dead branch — I guarded the vacuous shape in
  one direction and walked into its mirror;
- my circuit test asserted on the INPUT after settling bout two, so it checked
  that the value I passed in was the value I passed in.

Every one was re-derived here before being acted on. **Two of my fixes initially
SURVIVED mutation testing** and now have tests that kill them.

## What to be careful of, in the order it will bite

1. **The CLI's draw guard is UNREACHABLE from that tool.** 450 settled bouts —
   1v1/2v2/3v3, 150 seeds each, enchantments armed — produced zero draws, and
   the mechanism says why rather than the count: one action damages at most one
   target. Said so in place. The library path IS covered, with an injected
   mutual-destruction rule set.
2. **Six doc numbers were stale and are now re-derived**: 23 goldens, 69
   observation records, 62 cited, 60 candidates, 37 without a golden, 36 without
   an observation, and 11 nonce-bearing records across 5 of 23. The roadmap read
   22/67/47/38/37 and 9-across-4-of-22. **Re-derive rather than copying these.**
3. **Two roadmap gaps were already CLOSED while still being advertised**: the
   aiFill per-slot resource bag (closed 2026-08-30) and roster read-back (closed
   2026-09-07, while the constraint table in the same file already said so).
   The contract's "Still open" item 1 is STRUCK rather than deleted, because the
   roadmap cited it by number.
4. **Everything here IS pushed** (`219cf99..6cb872b`, six commits, owner
   approved). An earlier draft of this file said four commits were local; both
   halves of that were wrong by the time the session ended.

## PARALLELIZE — the owner's instruction, 2026-09-07, and where it applies

**Owner, this session: use the remaining budget, and parallelize whatever can be
parallelized with subagents WITHOUT sacrificing the integrity of the workflow.**
About 60% of a five-hour window was left when he said it. That is an instruction
to spend, not to hurry — and the second half of the sentence is the load-bearing
half.

**FIRST, A DISTINCTION THIS REPOSITORY'S RULES DEPEND ON and which is easy to
miss.** `AGENTS.md` and `docs/adr/0001` put a *fan-out wave* LAST in the
precedence, capped at 6 questions and 6 verifiers, one at a time, never
concurrent — because three concurrent 12-verifier waves once spent ~30% of a
week's usage in twenty minutes. **That rule is about the `question-fanout-audit`
wave aimed at the game's BYTES or the CAPTURE ARCHIVE**, which is expensive,
adversarial, and the last resort for a claim no test pins.

It is NOT a ban on ordinary parallel investigation of CODE AND DOCS. This
session ran a six-surveyor / six-verifier `Workflow` over the design record and
`src/`, and it was the right tool: it cost one wave's worth of agents, returned
`started == returned` on both phases, and its verifiers broke 5 of 6 claims as
OVERSTATED and refuted 1. **Keep the caps and the discipline; do not read the
precedence as "work alone".**

### What genuinely parallelizes here, in descending confidence

1. **A DOCUMENT-INTEGRITY SWEEP — one agent per document, and this is the
   highest-value parallel work available.** This session re-derived two files
   and found **six stale numbers and two gaps that were closed while still being
   advertised as open**. Nothing else has been swept. Untouched and load-bearing:
   `docs/ss2-adapter-contract.md` (~1,030 lines), `docs/campaign-persistence.md`,
   `docs/integration/*`, `README.md`, and **`HANDOFF.md`'s own living head
   (~810 lines)**, which is the document every session is told to trust.
   Give each agent ONE file and one instruction: *re-derive every factual claim
   in it against `src/` and `test/`, and report each as HOLDS / STALE / WRONG
   with the command that settles it.* Perfectly parallel, write-nothing, and the
   measured hit rate on the two files done so far was high.
2. **Investigation ahead of a single code change.** For ranked item 2 below
   (the per-action animation acknowledgement), fan out on QUESTIONS — what does
   the contract specify at `ss2-adapter-contract.md:961-988`; what do the
   presentation commands actually carry; what does the battle map say the real
   timeline does; what would a test pin — then **implement serially**. Four
   agents editing one seam is not parallelism, it is a merge conflict.
3. **Adversarial verification, one named claim per write-nothing verifier.**
   Cheap, and the base rate of load-bearing claims being wrong here is high
   enough that it keeps paying.

### What must stay SERIAL, and none of it is negotiable

- **Anything touching Ruffle, the installed SWF, the save, the snapshots or
  `captures/`.** Main session only, supervised, and most of it is the owner's
  Windows lane regardless.
- **Every state-mutating git command.** No subagent commits, pushes, checks out
  or stashes.
- **Edits to one file, and the promotion pipeline end to end.**
- **The final number.** A parallel agent FINDS; the main session RE-DERIVES
  before anything lands. Every count in this handoff was re-measured by hand
  after an agent reported it, and that is why they can be quoted.

### The failure mode to design against

**Fan out on QUESTIONS, not replicas.** Two agents given one brief agree with
each other and are wrong together, because the brief is the correlated failure
mode. Ask "what were they all told?" And **assert `started == briefs`**: a wave
that silently spawns nothing returns fast, which reads exactly like success.

## Highest-value work, ranked

1. **The owner's fork above.** Everything Endless waits on one sentence. Do not
   burn the budget waiting for it — items 2 and the document sweep are unblocked
   and need no answer.

   ► **AND RUN THE DOCUMENT-INTEGRITY SWEEP EARLY**, because it is the one piece
     of work that is both fully parallel and fully unblocked, and because every
     session after this one reads those documents as though they were true.
2. **The per-action animation acknowledgement** — now the ONLY remaining gap in
   the adapter contract, unblocked, headless-testable, moves no hash
   (`combatStateHash` covers no presentation data). EP-D06 names it as a
   requirement for any *playable* proof. Be honest that nothing renders yet, so
   it is a seam ahead of its consumer. **Parallelize the investigation, then
   implement serially** — see the section above.
3. **A capture hook that can arm on a status phase** — still the only way the
   status phase gets runtime backing. Owner's supervised lane; needs Windows.
4. The schema question (villain stamina 105 vs 110), still the only capture
   lever, still the owner's.

## Hard rules (unchanged)

- **Derive candidates from the map, never from a capture.**
- **Design must never flow into CANDIDATE AUTHORING.** Implementing a design in
  ordinary game code under `src/` is NOT that — this session read the design to
  choose what NOT to build, which is the permitted direction.
- **Ask before every push.** `main` stays denied outright.
