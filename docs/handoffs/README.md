# Session handoffs

A handoff is the **brief for one session**: what to do next, in what order, and
what not to do. Starting a session should cost one sentence —

> read the latest handoff in `docs/handoffs/` and proceed

— rather than a pasted wall of context that goes stale the moment it is sent.

## Naming

```
docs/handoffs/YYYY-MM-DD-HHMM--short-slug.md
              2026-08-31-1238--corpus-audit-provenance-repair.md
```

Local date and time **when the handoff was written** (which is the end of its
session), then a slug naming what the session was about. Local rather than UTC
because a human reads it; the offset is recorded in the frontmatter, so nothing
is ambiguous. No colons — Windows forbids them in filenames.

The names sort chronologically, so `ls docs/handoffs/` puts the newest last and
"the latest handoff" is unambiguous without an index to consult.

Sequential `H-NNN` numbering was tried first and dropped: a number tells you
nothing about when it was written or whether it is still current, and a stale
brief that looks authoritative is worse than no brief.

## Frontmatter

Every handoff opens with it. This is the part that makes a handoff traceable
back to the work rather than just readable:

```yaml
---
handoff:      2026-08-31-1238--corpus-audit-provenance-repair
written:      2026-08-31 12:38 -0400
sessionStart: 2026-08-31 09:39 -0400
sessionId:    4a79fa7f-176b-455c-aa91-372038a141af
agentRuns:    wf_bc86037b-0f9 (13 auditors), wf_d2aa6793-7cb (1 writer + 3 verifiers)
branch:       arena/champion-capture
commits:      73f7fba..2585952
suite:        617 passed / 0 failed / 0 skipped
supersedes:   none
---
```

`sessionId` and `agentRuns` are the load-bearing ones. Every subagent's full
transcript, its brief included, is recoverable at:

**Derive this path, do not copy it — it is a function of the working directory,
and the working directory has moved twice.** Claude Code names the project
directory after the absolute path of the tree it was launched in, with the
separators flattened. So:

```
# WSL, measured 2026-09-01 — this is where the runs of the 2026-08-31 sessions are
~/.claude/projects/-home-corey-projects-swords-and-sandals-2-multiplayer/
  <sessionId>/subagents/workflows/<runId>/

# Windows: same rule, derived from whichever tree was used at the time.
%USERPROFILE%\.claude\projects\<flattened absolute path>\<sessionId>\subagents\workflows\<runId>\
```

The literal path this file used to give —
`C--Users-corey-OneDrive-Documents-ChatGPT-SS2-Multiplayer-Mod` — names the
RETIRED OneDrive tree. It was already stale when the Windows tree moved to
`C:\ss2-capture` on 2026-08-31, and it never described WSL at all. A path
written out literally in a document that calls it load-bearing is exactly the
thing that rots; the rule survives a relocation and a literal does not.

So a later session can read exactly what an auditor was asked and what it
answered, instead of trusting a summary of it. `docs/overnight-agent-plan.md`
already depends on that path, and every number in it was derived that way.

`suite` must state the exact count. A session that measures a different number on
its first minute has found something — and that only works if the number was
written down. A **skip** in particular means a path derivation broke.

Record hashes as a `commits:` RANGE, not a tip. The tip is written before the
last commit of the session exists, so a tip hash in the body is wrong by
construction; tell the reader to run `git log --oneline -1` instead.

## The two documents are not the same thing, and must not drift

| | `HANDOFF.md` (repo root) | `docs/handoffs/<stamp>--<slug>.md` |
| --- | --- | --- |
| What it is | the accumulated **state** of the project | the **brief** for one session |
| Answers | "what is true, and what was found" | "what should I do now" |
| Grows | yes, and it is ~800 lines | no — one screen, ideally |
| Lifetime | permanent, corrected in place | frozen when the session ends |

**`HANDOFF.md` is itself split (2026-08-31).** Above its `## THE ARCHIVE LINE`
heading is the LIVING HEAD — state, rules, next steps, open items — which is
appended to and corrected in place; below it is frozen evidence. So the
correction path is: the living head, plus the next handoff. That split exists
because a handoff freezes when its session ends, and a correction with nowhere
live to land never reaches the next reader.

A handoff **points at** `HANDOFF.md` for state. It must not restate it. The
moment a handoff starts explaining findings it has become a second state
document, and the two will disagree — which is worse than having one. If they
ever do disagree, `HANDOFF.md` is right and the handoff was frozen earlier.

If a fact belongs to the project, it goes in `HANDOFF.md`. If it belongs to "what
the next person should do about it", it goes in a handoff.

## Writing one

**Never edit a handoff after its session ends.** It is a record of what was
believed at that moment, and later sessions cite it. Corrections go in the next
handoff (name it in `supersedes:`) and in `HANDOFF.md`.

Keep this shape; it is what worked:

1. **Where things stand** — branch, remote, test count. Two or three lines.
2. **Read first, in order** — usually `HANDOFF.md`'s corrections block, then this.
3. **Highest-value work**, ranked, *with the reason each is ranked there*. The
   ranking is the actual deliverable; a flat list makes the next session
   re-derive the priorities.
4. **Hard rules** — the non-negotiables, verbatim. They are short, and assuming
   them instead of repeating them has cost whole tracks.
5. **Traps from this session** — concrete, specific, ideally the author's own
   mistakes. This section has consistently been the most valuable one.

## Index — newest first

| Handoff | Session | One line |
| --- | --- | --- |
| [2026-09-11 21:15 — both halves of position are built](2026-09-11-2115--both-halves-of-position-are-built.md) | `1a8d94aa` | **Gladiators now stand somewhere and must walk to reach each other.** The resolver half landed on the presentation half from the same session: `x` on the combatant and inside `combatStateHash`, `EffectKind.POSITION` (absolute, like `RESOURCE`), `SS2_ARENA`, a `startingPosition` hook, two walk verbs, the build's own controller gate (`fightdistance < weapon_range`, STRICT `<`, frame 4 `DoAction@0x238bbf` `+0x00f6`) and an AI that closes. **Everything re-derived from the map**; the preserved patch is SUPERSEDED and differs in three deliberate places — `movement_speed` is NOT a resource (a `battlevalues` output, and `agility` is already projected, so ONE vocabulary change not two); the walks order LEFT then RIGHT because all eight rows of the controller table put `walkleft` at `optionB` in BOTH facings, so the patch's away-then-toward was invented; and the walk event carries `vanillaLabel`, the field presentation cannot derive. **THE GOLDENS DID NOT MOVE** — `fixtureReplay` returns null from `startingPosition`, and a mutation giving fixtures a position fails 15 tests including the whole replay suite — while every other hash did, and the asymmetry is the check: six team-projection pins moved, six `engine.js` legacy pins byte-identical. **THE NUMBER THAT NEEDS AN OWNER DECISION: 53% of a 3v3 is now walking** (1v1 11 actions to first contact / 10 walks / 27 total; 3v3 35 / 48 / 91; all 120 seeds settle). Five walks a side at 1v1 independently reproduces the archive's own figure, so the fidelity is good and the PACING is the question; the levers are `SS2_ARENA.frontX` and `walkDistance`, and `weapon_range` is NOT one. Two consequences found by tests rather than reading: read-back now DROPS position (the build re-places everyone at battle entry, and a carried survivor kept its blueprint's `x` while a fresh challenger did not, so bout 2 of a circuit never reached a swing), and `tools/hotseat.mjs` opens ENGAGED with a new `--approach` flag. **9 mutations, one SURVIVED and is now pinned** — removing the read-back drop passed everything, because the hotseat fix had made the CLI independent of it and took the only coverage with it |
| [2026-09-11 18:30 — a walking gladiator has a clip to play](2026-09-11-1830--a-walking-gladiator-has-a-clip-to-play.md) | `1a8d94aa` | **Ranked item 3 is closed: presentation before position.** The stream has `CommandKind.MOVE_CLIP` carrying `from` and `to` and nothing else — **not** a partial `place-clip`, because `scene.js` folds that one by overwriting all seven geometry fields, so a partial command sets `y` to `undefined` and `toY(undefined)` is NaN and the figure VANISHES. `SS2_STATIC_MAP_BINDINGS` has a movement case at `ASSUMED` provenance, detected by the event's own geometry rather than by parsing the type string; `src/render/timeline.js` has four gait schedules and `travelAt`, where `timelineFor()` returned `unknown` for all eight movement labels before. **Nothing emits a `move-clip` yet, and that is the point** — the resolver half is the preserved patch, and the one thing it must ADD is `vanillaLabel` on the movement event: `to < from` gives the direction and nothing separates a walk from a charge, so an event without it is REPORTED rather than given a guessed gait. **Geometry is not a label decision**: an event the bindings cannot name still moves, so the scene never draws a figure standing where the resolver says it is not. Two decisions left the browser shell — `figureXAt` and `timelinesForStep` — for the reason `animationCursor` left it; `render-arena-host.test.js` had RE-IMPLEMENTED the second, so test and shell could agree while both being wrong. **12 mutations applied one at a time; TWO SURVIVED the first version of the tests** — a smoothstep passed because 0.5 is a fixed point of every symmetric ease, and "travel also lunges" passed because the travel branch was only sampled where `advance` is already 0. Both fixed and re-verified. A third error was caught by reading the diff: hoisting `layout.placementFor` turned an unmapped record into a thrown `SlotLayoutError`. **`/codex:adversarial-review` on this diff is UNSPENT and is the owner's to type** — the command is `disable-model-invocation: true` |
| [2026-09-10 22:44 — the economy was the cheese](2026-09-10-2244--the-economy-was-the-cheese.md) | `661a9a6f` | **A 13-agent panel was asked to design 3v3 so it could not be cheesed; all four designs were BROKEN**, by two properties of the shipped 1v1 engine that 3v3 only multiplies. **D1: a bout need not terminate** — 4,000 consecutive mutual `rest` actions left `battle.result` null, because rest is stamina-positive AND heals. **D2: strength was a trap and stamina the only stat** — strength 7 beat strength 30 over 39 actions without losing a point of stamina or health, because a swing was priced on the wielder and paid out of the weapon. Both closed by owner decision: an AUTHORED crowd-impatience toll (standoff now ends at turn 234; 0 of 120 honest bouts pay anything) and a swing priced on the weapon's `attack_speed` with strength in the denominator, plus the shop's own measured purchase gate. **Both gated behind `fixtureReplay`, so all 23 goldens still reproduce their MEASURED `staminaleft`** — repricing that path would have been a corpus break, not a balance change. Three seeded-play pins re-derived with the reason at the pins. **Two self-inflicted errors recorded where they happened**: a fork put to the owner on a false premise (`crowd_interest` is a gold multiplier, the `taunttimer` abandons an ANIMATION), and `patience` tuned twice against a distribution the toll itself shaped. **The owner's next task is small and decides a lot**: read the six `weaponweights` values at `+0x3dd4` — if index 1 is not the heavy end, every swing cost is backwards |
| [2026-09-10 17:30 — the map was not silent, twice](2026-09-10-1730--the-map-was-not-silent-twice.md) | `661a9a6f` | **Ranked item 2 was blocked by a FALSE "the map is silent" claim** — `ss2-rules.js` said `_root.arena.fightdistance` had "no writer at all", and the corpus names it twice with offsets (`getfightdistance`, champion-dna:710-712 and adapter-contract:1232). `git blame` puts the claim at `831bcdc` (2026-09-01), **two days AFTER** `5d3d777` recorded the writer, so it was never a stale note: a sentence written without opening the neighbouring document. Second such claim in two days. The gap that IS real is now `MAP_SILENCE.movement-displacement` (six → seven, the day after seven → six — the symmetry is why the id LIST is pinned and not the count), careful about the one uncited figure the repo holds ("one walk is 44 px") and settleable with **no new capture**. `assertDistinctPlacements` promised a distinct screen position and never checked x or y; closed, with a test that bites. `seeded-play-pins.test.js` claimed it had re-derived "exactly one" literal hash pin — there are **ten**, six predating it by eleven days; the conclusion survived the miscount and the reasoning did not. **A whole position implementation was built and driven in a scratch copy and works** — ±250, five walks a side (matching the archive from an independent direction), ±30, combat; all 23 goldens green via `fixtureReplay`. **Not landed, and the measurement is why**: with the gate live the suite goes to 72 failures and two hanging files, because a walk emits `clip-goto Standing` — the idle clip — the identical defect the owner found watching the arena that morning, caught in the afternoon by the sweep guard written for it. **Presentation first, resolver second.** Wave: VERIFIED, 6 questions / 6 verifiers, 0 dead, **31 claims unverified** |
| [2026-09-10 13:23 — the arena is drawn](2026-09-10-1323--the-arena-is-drawn.md) | `fc951c81` | **The RENDERED ARENA landed** — `src/render/` (pure, under the suite) plus `tools/arena/` (a thin canvas shell) plus a zero-dependency loopback static server, so a browser fights through the same resolver and adapter the tests run, imported directly as ES modules with no build step. It is the presentation stream's first consumer outside `test/`, which is the shape the campaign record was in before 2026-09-07 — and like that one, reading it back found defects. **A shipped clip label contradicted the battle map**: `hurtLabel` emitted `hurt21/22/23` marked `assumed` because a `MAP_SILENCE` entry said the map gave no adjustment, when the map gives it one sentence later with byte offsets (`hurt1/2/3`, map:1471-1472) — the silence entry, the code and the test all agreed with each other and none agreed with the map. **Two comments claimed the action boundary is never derivable from the wire**; it is exactly `wire.events.length + 1` before `applyAction` (0 mismatches over 193 actions), and the real reason it is not projected is hash stability. **Nothing enforced "ship no SS2 asset"** until now. First host anywhere here with `awaitAnimations: true`, so the per-action gate ENFORCES and part 4 of the acknowledgement seam — the animation-timeout policy — exists for the first time. Drawing the authored ally band exposed that it sits further back but draws in front, pinned rather than corrected. **The canvas is verified only from static screenshots**: headless Chrome gives an rAF loop 2 frames whatever the virtual-time budget says |
| [2026-09-10 12:12 — everything is pushed, and the Workflow gate is gone](2026-09-10-1212--everything-is-pushed-and-the-workflow-gate-is-gone.md) | `ff2653b2` | No code changed. Nine commits that three sessions had left unpushed finally went, and the branch is fully up to date for the first time. **The `Workflow` permission gate is GONE** — the owner noticed he was still getting a per-workflow dialog under bypass permissions and dropped the entry, which moves an obligation from the harness onto the session: say what a wave will spawn before launching it, because the 6/6 hard cap in the committed script is now the only deterministic guard. `Bash(git push *)` stays in ask and every deny rule is untouched. **A claim the fan-out cost argument rested on is untested**: the settings file asserted bypass mode skips ASK rules, and the owner's experience contradicts it — flagged in place, measure it rather than cite it. Also: the 12:42 handoff's own push count was wrong the same way the two before it were wrong, so the fix is now arithmetic rather than care — count unpushed commits AFTER committing the handoff, into the living head. Ranked list unchanged; `settlement.arm()` on an unfought battle is still item 1 |
| [2026-09-07 12:42 — the 78 are done, and the suite does not bite](2026-09-07-1242--the-78-are-done-and-the-suite-does-not-bite.md) | `ff2653b2` | The 78 stale living-head rows are re-derived and corrected at their sentences by a 6-question / 6-verifier wave (VERIFIED, 6/6 and 6/6). Three of the session's defects were its OWN and agents found all three: the previous commit minted six new stale line numbers while repairing one; the wave was launched on a wrong offset (+65 when the sweep's own numbers were already ~27 low, so the truth is ~92) and had to be killed and relaunched off text-matched anchors; and the row lists carried two proposals the sweep's own refuters had already broken. **Then the headline: a first systematic mutation audit found 37 of 48 one-line breakages SURVIVE the suite**, eight adversarially CONFIRMED — but six of the eleven kills are the corpus-integrity gates, so the code protecting the corpus is the best-tested code here. `src/team/controllers.js` has zero negative tests; every literal pinned hash is taken before any action is applied. **And Stage 7 is not the next thing**: EP-D07 lives on an unmerged branch, is invisible to a grep, and forbids the AI takeover all five designs were built on; `settlement.arm()` is accepted on a battle nobody fought |
| [2026-09-07 11:40 — the sweep reached the untouched six](2026-09-07-1140--the-sweep-reached-the-untouched-six.md) | `b60442bf` | The six documents the previous sweep left untouched are swept: 79 rows, 73 applied and 6 rejected, every one re-derived by hand. **Four of the six rejections are numbers that do not reproduce at all**, and one — `capture-staging`'s "22 promoted goldens" — was CORRECT, so a blanket 22→23 would have broken it. **The headline is that 78 stale rows sit in `HANDOFF.md`'s LIVING HEAD, lines 801–3132, not in the archive**: the sweep chunked the file as though the archive line were at 800 when `grep -n` puts it at 3133. Two verifiers, two survivals, both finding more than asked: the Steam build id is BOTH a compatibility key (262 files, four throwing gates) and an install identity, and the CONTROLLERS autopilot gate lets through exactly the labels the battle map's hazard list names. Its own commit left three handoff-navigation tests red |
| [2026-09-07 09:55 — the last adapter gap, and the sweep](2026-09-07-0955--the-last-adapter-gap-and-the-sweep.md) | `cb4573bf` | The per-action animation acknowledgement is BUILT, and my own contract told me to build it wrong: `event.sequence` is stamped per EVENT and one action emits up to four (measured over 5,708 actions), so the token comes from `lastResolvedAction().firstEventSequence` — which is deliberately unprojected because `combatStateHash` covers everything that is. Advisory by default; no timeout anywhere, because nothing has captured vanilla's completion signal. Then the document-integrity sweep: 17 surveyors, 34 refuters, 17/17 and 34/34 returned, 3,146 claims, 264 stale or wrong. **The refuters broke 7 of 34, and one would have BROKEN THE CORPUS** — the Steam-build row is a compatibility key carried by 262 files, not an install-identity field. The OneDrive tree is not gone: it is a third copy of the archive, 1,589 files |
| [2026-09-07 08:25 — the accepted decisions do not authorize anything](2026-09-07-0825--the-accepted-decisions-do-not-authorize-anything.md) | `8c4c0cbf` | Ranked item 2 answered: three EP decisions accepted, forty normative clauses, and every one ends "This decision does not authorize implementation" — so the deliverable is a FORK for the owner, not a branch. The accepted text is not on this branch; it is on the unmerged `design/endless-progression-owner-packet`, and this tree's copy is an older design where all six read `pending`. Meanwhile the campaign read-back got its first consumer (`--circuit n`), and `playable` turned out to be a flag that CANNOT be true — measured over 240 rosters. Codex found four more defects, two in the tests I had just written; two of my fixes survived mutation and now have tests that kill them |
| [2026-09-07 07:24 — the ranked list ran out](2026-09-07-0724--the-ranked-list-ran-out.md) | `0251f418` | Every ranked item closed, including two that were not what the brief thought: item 3 was REAL (the map carried both status rules and the hero's is first-match-wins) and item 4 was already done, with the sync running the other way. Owner decided and I built the status phase; team fights are playable (`--teams 2v2`); the campaign record can finally be READ BACK. The lesson: when the ranked list emptied, `docs/roadmap.md`'s "not started" column was the better map. Three Codex reviews found nine defects the new tests missed, three of them universals I had written as facts. Wire format moved — all 23 golden replay hashes — and only a test guards it |
| [2026-09-07 03:30 — the armoured golden reaches the resolver](2026-09-07-0330--the-armoured-golden-reaches-the-resolver.md) | `0251f418` | The 23:13 brief's one task was an email ALREADY SENT five days earlier and nothing in the repo knew — the reusable failure, recorded first. Ranked item 1 landed WITHOUT a wave: REPLAY_UNDRIVABLE is empty, all 23 goldens drive a real battle, the damage pair is required of whoever ATTACKS. A declared defender pair MOVES the battle hash while reaching no arithmetic, so completing a fixture is a protocol change. An independent Codex review found two real defects the tests missed, one a regression this session introduced (a refused attack consumed RNG and moved the hash). AGENTS.md's observation count was wrong the day it was written: 69, not 70. **Owner DECIDED enchantments: option (a), status phase as a forced legal action** — blocked on byte verification, which this WSL tree cannot do |
| [2026-09-02 23:13 — reach for the stars: the email to the developer](2026-09-02-2313--reach-for-the-stars-the-email-to-the-developer.md) | `426439d1` | First task: draft (never send) a reverent, honest email from the owner to the game's developer asking about collaboration or source access — solo, no wave; the owner's research and the recipient must be asked/verified, never invented. Records the enforced verification precedence (harness ADR 0001) and that ultracode stays ON |
| [2026-09-02 16:59 — three waves, cut at the usage limit](2026-09-02-1659--three-waves-cut-at-the-usage-limit.md) | `426439d1` | Three capped fan-out waves on ranked items 1–3 stopped at 92% of the session limit (30% of weekly usage in 20 min); VERIFIED: nothing on the hero's one-action path reads the defender's damage pair; REPLAY_UNDRIVABLE's "both directions" assertion was a self-comparison, now a positive check; ranked item 4 closed, item 3's premise broken; two stale catalogue instructions corrected at their sites |
| [2026-09-02 13:40 — the first armoured golden](2026-09-02-1340--the-first-armoured-golden.md) | `0ffa2c73` | **`golden-armoured-deflection-threshold-cleared` is promoted** — the armoured family's first, from two independent captures 17 minutes apart, and the first runtime evidence here carrying armour (`armourclass 79`) or `fightMode: "tournament"`. 1,353 unattended rounds at ~8s each; the gate refused it first, correctly, until `provenance.staged` existed. Ranked item 3 CLOSED (weapon table in code, verified against the build, `weapon` derives the damage pair). Item 2's arithmetic landed; APPLYING it replaces a turn and is yours. Capture reframed: not a scarce window, 14s a round, and the binding constraint is villain stamina, which staging cannot set. **Two rule defects of our own**: the uncapped verifier fan-out (1,069 verifiers, five-hour limit) and `overnight-agent-plan.md` promoted to doctrine by one line in AGENTS.md. Git hygiene now exists in the harness and is enforced |
| [2026-09-02 00:07 — the wave refuted more than it confirmed](2026-09-02-0007--the-wave-refuted-more-than-it-confirmed.md) | `d8905702` | **Newer than the row below it, which is stamped in UTC under a `-0400` label — `ls` misorders them.** An 8-question wave with 24 write-nothing verifiers, VERIFIED, broke **17 of 24** claims. Ranked item 2 REFUTED from the bytes: `activeEnchantment`'s primary-potency pairing is byte-faithful and must NOT be changed (the proc gate reads `weapon_enchantment_potency` unconditionally at `+0x1c0f`, hoisted ahead of every `equipped_weapon` test); the real defect was its fallback, which applied the primary status for any `equipped_weapon` outside {1,2}. `localeCompare` was FIVE files, not two, and one of them orders the capture manifest whose digest 22 goldens cite — measured free (0 of 3,655 pairs move under en-US; az-AZ moves 682), 22 of 22 digests reproduced. Item 5's premise false: the adapter CAN feed the rule set via `aiFill.resources`. Item 4 answered and inverted — a remainder digest leaks undrawn rolls; the leak-free maximum is the consumed prefix. Left to the owner |
| [2026-09-02 01:30 — the corpus got a consumer, and the wave broke ten of twelve claims](2026-09-02-0130--ss2-rules-and-the-wave-that-broke-it.md) | `16532b60` | **`src/team/ss2-rules.js` exists**: SS2's own attack arithmetic runs inside the shared resolver, all 22 goldens replay through `createTeamBattle`/`applyAction`, and hot-seat plays it by default. Ranked items 1 and 2 of the previous brief, done. A 12-agent write-nothing wave broke **10 of 12** claims: the `rest` branch has its own `hitpoints += 3 + ceil(stamina)` at `+0x51d5` and this session had OVERRULED the map to say otherwise; and `death()` removes the phase transition, so a killing blow costs the attacker nothing — the replay test had been asserting nineteen times that the engine must disagree with the fixtures. Both fixed, both pinned, and two errors corrected in the battle map itself |
| [2026-09-01 21:12 — the project became playable](2026-09-01-2112--the-project-became-playable.md) | `6c06a03b` | **`node tools/hotseat.mjs` plays a fight** — the first playable thing here, after the owner asked whether the approach would let the project survive. Answer: the verification machinery had become the project; 22 goldens fed nothing. Adds the `map-derived` tier whose absence (not effort) blocked wiring SS2's real arithmetic in; retracts 2026-09-01-1550's ranked items 1 and 3 by measurement; makes the raw archive verifiable and mirrored. Three waves VERIFIED, 28 of 48 verdicts BROKEN |
| [2026-09-01 15:50 — Codex independence, and what the corpus actually proves](2026-09-01-1550--codex-independence-and-the-corpus-archetype.md) | `515e2223` | Supersedes 2026-09-01-1250. Both waves VERIFIED (209/209, 230/230); an outside Codex review found 67 wrongly committed traces that 758 agents missed; all 22 goldens fight ONE zero-stat opponent and 0 of 82 fixtures pin `speed`; the armoured fix is an arming-gate change already proven on another route |
| [2026-09-01 12:50 — WSL capture pipeline, and the armoured fixture defect](2026-09-01-1250--wsl-capture-pipeline-and-armoured-fixture-defect.md) | `515e2223` | Capture pipeline driven from WSL for the first time since the relocation; the armoured/tournament families are blocked by their own fixtures, a 110 derivation raised and retracted the same day (neither value is scenario-determined); both agent waves UNVERIFIED-PARTIAL with 109 dead verifiers |
| [2026-08-31 22:44 — the four self-citing goldens are re-promoted](2026-08-31-2244--self-citing-goldens-repromoted.md) | `18794878` | All four re-promoted pipeline-only from independent records; five verifier BROKENs exposed settle writing manifests before the gate, no manifest→golden guard, and a test whose prescribed deletion rewarded a self-citing golden |
| [2026-09-01 00:21 — corpus repair and doc-integrity guards](2026-09-01-0021--corpus-repair-and-doc-integrity-guards.md) | `18794878` | Supersedes 2026-08-31-2244. Four self-citing goldens re-promoted; settle no longer writes attestations before the gate; a test that rewarded the defect it named; three contradicting instructions in the head corrected; doc-pointer guards added |
| [2026-09-01 00:30 — migration close-out, and what is untested](2026-09-01-0030--migration-closeout-and-what-is-untested.md) | `a87c4347` | WSL is primary and Windows is episodic; an honest list of what was configured but never exercised, incl. the capture pipeline since relocation; save+snapshots backed up; the pinned build auto-updates |
| [2026-08-31 18:20 — the pairwise gate, measured](2026-08-31-1820--pairwise-gate-measured.md) | `a87c4347` | The gate HAS teeth (407 leaves at callSite) and on committed evidence refuses nothing, because the nonce check fires forty lines earlier; "162" reproduces exactly; the fresh-nonce hole also unlocks the authored-from gate |
| [2026-08-31 14:43 — nonce gate, stat arithmetic, toolchain](2026-08-31-1443--nonce-gate-stat-arithmetic-toolchain.md) | `e386f047` | A record’s own copy stopped counting as the second session; the stat-vector arithmetic settled the 22 written-off fixtures; one shared AGENTS.md for both agents |
| [2026-08-31 12:38 — corpus audit and provenance repair](2026-08-31-1238--corpus-audit-provenance-repair.md) | `4a79fa7f` | 5 transcriptions found (not 23), provenance made honest, pairwise gate decoupled from the matcher; levelling reopens 22 fixtures |
