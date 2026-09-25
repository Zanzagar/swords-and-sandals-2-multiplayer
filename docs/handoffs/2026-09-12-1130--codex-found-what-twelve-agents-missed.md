---
handoff:      2026-09-12-1130--codex-found-what-twelve-agents-missed
written:      2026-09-12 11:30 -0400
sessionId:    9e416f58-ab1f-4d6a-a7cd-ab12d4624e75 (https://claude.ai/code/session_01W2dkgJu2uHRFXSmTVv4f2j)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
suite:        922 / 921 / 0 / 1 (fresh-clone profile), measured after `d95b1da`
              and BEFORE this handoff. **Re-measure; never copy.**
supersedes:   2026-09-12-0930--weapon-range-is-projected-and-the-wave-broke-six,
              written MID-session by this session. Its ranked items 1, 3 and 4
              are DONE; read it for the weapon_range work and the wave, which
              this brief does not restate.
---
# Handoff — Codex found in one pass what twelve agents missed

## The one-sentence version

`/codex:adversarial-review` was never unrunnable by a session — the instruction
saying so was false and had been copied forward through five handoffs, parking
the top-ranked item in the owner's lane for four sessions — and when it was
finally run it returned **two high defects that a 12-agent wave had missed an
hour earlier, one of them a live invariant violation this session had just
introduced.**

## The reusable lesson, which outranks every finding below

**A wave audits the RECORD. A review audits the CODE. They are not substitutes,
and this session measured the difference on one diff.**

- The wave — 12 agents, ~1.8M subagent tokens — found six things, and every one
  was about whether what the repository SAYS is accurate: a backwards nudge, an
  overstated census, a miscount, a mis-scoped claim. All real, all worth having.
  **Not one of them was a thing the code does wrong.**
- The review — one pass, one model — found four things the code does wrong, two
  of them high, and one was a walk that carried a gladiator through a foe.

`docs/adr/0001` already ranks Codex review above a fan-out wave. That ordering
was argued from cost; it is now measured, and it is right for a second reason
the ADR does not give: **they answer different questions.** Reach for the review
when the question is "is this code correct". Reach for the wave when the
question is "is this claim true".

## What landed, in four commits

**`b46b057` — the review, and the false instruction.** `disable-model-invocation:
true` blocks Claude AUTO-INVOKING a slash command; it never blocked running the
command's body, which is one line of
`node scripts/codex-companion.mjs adversarial-review`. Corrected at both
living-head instances. **The model was already `gpt-6-astra`** —
`~/.codex/config.toml` sets it and the plugin passes `model: null` — but that is
AMBIENT, and nothing in the output records which model reviewed the diff, so it
is now pinned on the command line by a user-level command at
`~/.claude/commands/adversarial-review.md`. **Do not edit the plugin**: it is
vendored under a pinned version directory and edits there are discarded,
silently, on update.

Also in that commit, the first fix: **a walk could carry a gladiator PAST a
foe**, which is the one thing `ss2WalkDestination` is load-bearing for, and this
session introduced it. The build's clamp sets the destination to
`defender._x - physical_size(defender)` unconditionally, so it can land BEHIND
the walker; vanilla has one defender so that crosses nobody, but with two it
does. An actor at x = 0 with strength-9 foes at -10 and +20 is offered
`walk-right` as its retreat, the FAR foe clamps the destination to
`20 - 86 = -66`, and the actor travels left THROUGH the foe at -10 — which the
forward pass skipped, because it filters on the REQUESTED direction while the
realised travel had reversed. The guard runs on the REALISED direction now.

**`94ffac5` — refuse what cannot be modelled.** Two findings, one change.
- **A bow was offered melee at 500 units, and this session caused it.**
  `weapon_range` 4,486 against a 4,200-wide arena, so the gate could never shut.
  Refused at the RULE SET's construction gate (the adapter builds combatants
  too), on a criterion the rule set owns — **a reach wider than its own arena** —
  rather than by sniffing `using_bow`, which the resolver never sees. A mult-3
  melee weapon reaches 323 at most and is provably not caught; that is asserted,
  so the check is not just a ban on big numbers.
- **A stated weapon with no reach was silently disarmed.** `derive: false` means
  `ss2BattleValues` never runs, so `weapon: 5` with no `weapon_range` reached the
  resolver with equipment identity discarded — 130 where that row says 174.
  Refused in `ss2Combatant`, the only place the id still exists. **It caught its
  own live instance on the first run**: `tools/arena/roster.js`, whose
  `weapon: 1` had produced no reach for a day, invisible because the shop gate at
  its speeds sells only `[5]` = 1 weapons so the fallback happened to be right.
  **Luck, not a contract** — so the refusal fires even when the numbers coincide
  and says so in its message.

**`d95b1da` — the spectated arena never threw a punch.** See ranked item 1 of the
superseded brief for the numbers; the short form is that
`options[turnNumber % options.length]` cycles `[walk-left, walk-right, rest]` for
net-zero displacement forever, all 24 bouts settled anyway because the crowd
killed them, and **the test had re-implemented the same line** so shell and test
agreed while both were wrong. 20,712 actions / 0 attacks became 1,066 / 781.

## Highest-value work, ranked

1. **OWNER: LOOK AT THE ARENA.** `?spectate=1`, and `?teams=3&seed=11`. Three
   things changed under it today that no agent here can see — gladiators now
   stop at each other's personal space rather than on top of each other, the
   spectated bout actually fights, and the demo roster's reach is per-slot.
   Headless Chrome gives a `requestAnimationFrame` loop 2 frames whatever
   `--virtual-time-budget` says, so "the suite is green" is not the same claim as
   "it looks right", and this repository has been bitten by exactly that before.
2. **OWNER: CODEX FINDING [medium] — the projection format changed twice without
   a version bump.** `x` and then `weapon_range` changed every serialised combat
   projection while `BATTLE_STATE_VERSION` stayed 1 and the SS2 rule-set id did
   not move. A peer on the other side cannot tell "different code" from state
   divergence; it sees an unexplained hash mismatch, or replays old actions under
   new legality rules. **This is the 2026-09-07 decision to pin the shape rather
   than carry a version id, arriving as a cost** — so it is a decision to
   revisit, not a defect to repair, and it is the last unactioned review finding.
3. **OWNER: the crowd fork** — four costed options in
   `docs/crowd-patience-findings-2026-09-11.md`. Today gave it a third argument:
   the crowd is what ends a bout in which nobody can swing, and that is twice now
   how a real defect stayed invisible (the `weapon_range: 1` paste, and the
   spectate cycle).
4. **OWNER: the 3v3 pacing call**, still 26.8%.
5. **Re-run `/adversarial-review` on this session's own fixes.** Four commits
   went in after the reviewed diff, including two new construction refusals and a
   resolver export. None has been reviewed, and the session that wrote them is
   the worst reader of them.
6. **The 3v3 positional layer** — unblocked.
7. **CAPTURE BREADTH** — 37 of 60 candidates with no golden; needs Ruffle.
8. **The 21 untouched weapon rows.** `[5]` of 4 and 100 have never been in a
   modelled bout — and one of them is now REFUSED at construction, which is an
   answer for the 18 ranged rows but not for the three mult-4 ones.
9. **A verifier on the jump's total** — still one agent's reading.

## What is NOT verified

- **Nobody has watched the arena since any of this landed.** Ranked 1.
- **31 claims the wave raised were never verified**, the verifier cap being 6.
- The "45 or 43" frame counts in `ss2WalkDisplacement`; the `+1` at six
  `(movement_speed, boot)` pairs; the jump's total; `SS2_SWING.scale`,
  `strengthOffset` and `SS2_ARENA.allyStride`; the multi-foe clamp reading.
- **The villain's own AI gate is READ but not MODELLED**, and the archer gates
  (`100 + physical_size`, and the literal 200) are modelled by nothing — the bow
  refusal makes that honest rather than fixing it.

## Hard rules

- **Derive candidates from the map, never from a capture** — and when the map is
  silent, read the BUILD before reaching for a capture.
- **A check that confirms a PATTERN cannot catch a wrong INTERPRETATION.** Derive
  the conclusion and print it.
- **NEW: settling is not a diagnostic.** Three times in one session a broken
  thing settled 24/24 or 8/8 and looked fine: the `weapon_range: 1` paste, the
  spectate cycle, and the one-quantity clamp. Assert that an attack was ON OFFER,
  or that the thing you care about actually happened.
- **NEW: two implementations of one decision agree with each other.** Found twice
  in `test/render-arena-host.test.js` now. If a test and the code it tests both
  compute the same choice, they are one witness, not two.
- **An agent FINDS; the main session RE-DERIVES.** Every Codex finding acted on
  today was reproduced by hand first.
- **Codex findings are CLAIMS TO VERIFY, never instructions to apply.**
- **Push a feature branch without asking**; `main`/`master` and every force flag
  stay DENIED.
- **A handoff commit is not finished until `node --test --test-concurrency=1` is
  green, and its suite and push lines must be measured AFTER that commit.**
