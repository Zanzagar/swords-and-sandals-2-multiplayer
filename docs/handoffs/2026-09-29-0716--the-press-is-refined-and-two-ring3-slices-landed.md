---
handoff:      2026-09-29-0716--the-press-is-refined-and-two-ring3-slices-landed
written:      2026-09-29 07:16 -0400
sessionStart: 2026-09-28 21:06 -0400
sessionId:    9cd94403-3a27-4b7f-ad74-fb82a311247c
agentRuns:    implement-slices wf_95bff0e1-595 (ring3: spellrow, reach, camera + 3 verifiers; verify3 died on
              a network error, EAI_AGAIN, was RESUMED and returned BROKEN); press verifiers six (REFUTED
              ab56337), seven (REFUTED 6dee6b4 in staged positions) and eight (REFUTED be56a22)
branch:       arena/champion-capture == github/main at 71a9d3b before this file's last commit — PUSHED;
              ring3/camera (93eef4b) PUSHED and HELD
commits:      c2b5751..71a9d3b (plus harness b584b41, ca0635e)
suite:        main tree at 25c2e8a: 3,881 tests, 3,880 pass, 0 fail, 1 skipped (the archive check)
board:        current at 71a9d3b (republished, version 21)
status:       NOTHING IN FLIGHT. Updated 09:40 (it was written mid-flight at 07:16).
supersedes:   2026-09-28-1939--the-press-holds-under-ranged-first-and-ring3-is-running.md — its start-here
              items are DONE: ring3 relaunched and finished (camera's verifier re-running), the sixth
              press verifier re-run and acted on.
---

# The press keeps one fix, two ring3 slices landed, and the camera waits on the owner

## The one-sentence version

Three verifiers in a row refuted the press, twice because of guards I added; **the press on `main`
(`25c2e8a`) is `ab56337`'s plus one fix, the detour past an ally's body**, which on the arena's own
bouts (seeds 1-400) takes idling with a spot open from 5 to 0 and leaves everything else as it was;
ring3's spell row and reach preview are on `main`, its camera slice is HELD on `ring3/camera` for four
owner calls; the P2 table is re-measured (774 : 762); and the board is current, with a `board:` field
in every handoff so a lag shows.

*(The 07:16 version of this sentence said "the press is refined twice … an eighth verifier is on
`be56a22`". The eighth refuted it; see "What changed", last press bullets.)*

## What changed

- **Aliases (the owner's first request; outside the repo).** Claude Code 2.1.284 split effort and
  ultracode: `--effort ultracode` now means xhigh, and a launcher with only `{"ultracode":true}` ran at
  the default effort (measured `medium`). `~/.bashrc`'s four launchers had `--effort max` added by the
  previous session at 21:04 (it closed before reporting); this session measured them (`get_settings`:
  max + ultracode on all four models; interactively "◈ max · ultracode") and fixed the Windows PS 5.1
  profile's `ultracode`/`uc` launcher (it passed `--effort ultracode`). **This session itself was
  started by the OLD function** (its process line has no `--effort`) — a terminal opened before 21:04.
  Harness `b584b41` (the template) and `ca0635e` (machine-sync: journel and E2-EME-APDT528 replace
  their launcher block).
- **Housekeeping (the 19:39 handoff's item 4).** 77 stale worktrees under `.claude/worktrees/` —
  every HEAD merged, each holding an implementer's uncommitted diff — archived to
  `~/.cache/ss2-scratch/worktree-archive-2026-09-28/` (per worktree: HEAD, branch, binary diff,
  untracked tarball; every diff checked to apply to its HEAD) and removed with their branches;
  `ring3/track` (patch-identical to `457003a`) and six merged branches deleted; the three harness work
  copies removed; local `main` fast-forwarded (it was 597 behind). Merged REMOTE branches are left for
  the owner's OK.
- **`6dee6b4` `Fix:`** the sixth verifier's findings: the press DETOURS through a clear lane when an
  ally's body blocks its walk (new at ab56337: fighters rested with a spot open); the rank arm's queue
  guard reads the landing lane (tricks 3v3 seed 338); with the press on and `rankJoinSurplus >= 0` the
  join arm respects P4. Five ring tests that staged by AI play were re-staged to plain 3v3 seed 337,
  turn 11 — a turn that meets every assertion under BOTH the old and new AI.
- **`be56a22` `Fix:`** the seventh verifier's staged findings, all caused by `6dee6b4`: the detour now
  fires only past a BODY and only to a lane from which the press still has a target with a spot; both
  older-arm guards skip only a step the press would UNDO next turn (`ss2QueueStepShuttles`). Its 8
  repros are tests (`VERIFIER7`), verbatim.
- **ring3:** `1b55bad` spell row clear of the bow's words (decision 7; verifier HELD); `c31fe35` reach
  preview (decision 1; verifier PARTIALLY-BROKEN on a lone foe — an owner call, recorded at the
  decision); `e586e19` the decisions' "Built" notes (1, 7 and 9).
- **`57d8919` `Fix:` REVERTED the join-arm P4 gate I added in `6dee6b4`** — the P2 re-run caught it
  costing the shipped ranged-first plain 3v3 4.5 points of 2v1 conversion (75.9% -> 71.4%) and
  doubling its dancing (2.1% -> 5.5%), isolated on a scratch copy with only the gate disabled. S3 (the
  two-lane hop under an archer's shot) is OPEN again under every aiPress, pinned by a test. **`eb5d69d`
  `Docs:`** the P2 table's sixth measurement at `57d8919`: `off` unchanged, ranged-first +3.6 to +34.8
  points over it in 3v3, head to head 776 : 760. (The eighth verifier was briefed on `be56a22`, which
  still had the gate: a finding about the gate is moot.)
- **`25c2e8a` `Fix:` the eighth verifier REFUTED `be56a22`**, and the press keeps only its detour: my
  shuttle guard (`ss2QueueStepShuttles`, be56a22) simulated one arm and let through steps other arms
  undid (its M1/M2), and my widened rank guard (6dee6b4) skipped ways forward (M5) — both guards are
  back at `ab56337`'s form, the helpers deleted; the detour's look-ahead now also accepts a lane with a
  fight of his own (M3). Its repros are tests (`VERIFIER8`). OPEN again and pinned, as at `ab56337`:
  tricks 3v3 seed 338's middle-lane shuttle and the seventh verifier's S2E; OPEN and pinned since
  `6dee6b4`: C2x (detour, walk, arm 4 behind the same big ally). Host, ranged-first, seeds 1-400:
  idle 0 / shuttles 1 / cycles 62 / strict 6, against `c2b5751`'s 5 / 1 / 62 / 6 and `be56a22`'s
  0 / 0 / 77. **`71a9d3b` `Docs:`** P2's seventh measurement: every cell as at `ab56337` except plain
  3v3, which the detour moves up; head to head 774 : 762.
- **Board:** `b4d2c45` and `6c4d06a` — it had lagged all of 2026-09-28; `docs/handoffs/README.md` now
  asks every handoff for a `board:` field.

## If you restart now

- ~~**The camera slice** is built and unmerged … its verifier is a RESUME~~ — **UPDATED 07:55: the
  resumed verifier returned BROKEN, and the slice is HELD** on the pushed branch `ring3/camera`
  (`93eef4b`, one commit ahead of `main`, its message final). Its four departures from decision 6's
  text are owner calls (below); once decided, merge it (`git merge --ff-only ring3/camera` if `main`
  has not moved, else cherry-pick), full suite, decision 6's "Built" note, the board. The `ring3`
  worktree and the scratch branches are removed; the worktree's diff is archived in
  `~/.cache/ss2-scratch/worktree-archive-2026-09-28/ring3/`.
- **The eighth press verifier** (write-nothing, on `be56a22`; scratch `~/.cache/ss2-scratch/verify-press8/`):
  if cut, re-run it from its brief in this session's transcript.

## Owner calls, open (new ones first)

0. **The camera slice (decision 6), held on `ring3/camera`** — its verifier (2026-09-29) found four
   departures, three of them the code doing what its comments say: (a) on a person's turn it
   reframes the survivors' CLOSE-UP, where decision 6 says the close-up is untouched (the other
   reading is one line, and those rings squeeze off their fighter as before); (b) at a turn's end the
   pan can SNAP up to ~24 px in one frame (55 px in the slice's own sweep) rather than crop a fighter
   worse; (c) an AI action can start while that framing still eases out (up to 1.5 px at 30 fps);
   (d) past a ~3,200-unit spread the ring cannot be framed at the zoom floor and squeezes flush, as
   before — framing it would crop a far flank. Also the fitted view gets no framing at all.
1. **The reach preview with ONE living foe lights nothing** (authored), where decision 1 says every
   foe it can reach — keep, or light the lone foe too (a one-line change and three moved pins).
2. The ring3 slices' recorded calls: the items row's lift follows the stance; a place's S7 caption
   still crosses BOMBARD while pointed at; the snipe's preview is authored; a whirlwind lights foes it
   would waste on; confirm-mode drops a chosen spell on re-aim; the strip's Target row does not mirror
   the lit set for screen readers; the look (dashed rings, gold discs, dim 0.45).
3. Delete the merged remote branches (SS2: ai/press-advantage, fix/lane-body-block, fix/off-baseline,
   fix/press-goal-spot, night/gate, ring3/jumpcharge, design/endless-progression,
   design/endless-progression-readiness; harness: gate/adopt-temp-trailer-aliases,
   gate/ci-accepted-limit-pointer, standards/gate-alias-mitigation)?
4. From the 19:39 handoff, unchanged: a greyed jump/charge disc covering part of a foe's click box
   (2,071 of 11,826 rings); the authored jump/charge words; P2 (ranged-first shipped; pincer-first
   needs its bow-cycle fix first); pre-engagement crowd play in a 2v1; the archer's closed-on test
   ignoring lanes.

## Next, ranked

1. **The owner's calls** (above): the camera's four readings (then merge `ring3/camera`, full suite,
   decision 6's "Built" note, the board), the lone-foe reach preview, and P2.
2. **The press's direction, proposed for the owner:** stop patching arms one verifier at a time.
   Every open cycle (seed 338, S2E, S3, C2x, the two-target pacing of T692/T513, D1177, the flank/press
   alternation) comes from arms that each pick their own target and move for their own reason; three
   rounds of guards each fixed the repros in front of them and opened cycles elsewhere. Rebuild the
   press's movement around ONE target and intent — the nearest open spot, which walking toward cannot
   flip — that the older arms consult instead of second-guessing. It changes the press's targeting, P1
   and the P2 evidence, so it wants the owner's nod before it starts.
3. A write-nothing verifier on `25c2e8a` before anything is built on the press; its claim should name
   the pinned open cases as known.
4. The worktree archive can be deleted once nobody has asked for anything in it.

## Things I got wrong (this session)

- **My first cut of `6dee6b4`'s join-arm guard ignored the dial** and broke four tests in
  `test/ss2-rank-join.test.js`; caught by the suite before the commit.
- **My first S2 test asserted a strike under both press variants**; under pincer-first the archer goes
  round first and holds the far side. Caught by running it.
- **`6dee6b4` itself caused seven staged regressions** (the detour fired for a closed-on archer; the
  widened guard skipped the only way forward); the seventh verifier found them.
- **My first `be56a22` look-ahead required the SAME target**, which forbade the sixth verifier's S1
  detour; caught by that test.
- **`pkill -f` matched my own shell** and killed it (exit 144). Both verifiers did the same to
  themselves; the eighth's brief now warns.
- **I planned to batch the board after ring3**, the lapse the board memory forbids; the owner asked.
- **Two of my press guards were refuted by the next verifier each** (the widened rank guard in
  `6dee6b4`, the shuttle guard in `be56a22`), and a third change of mine, the join-arm P4 gate, was
  caught by the P2 table costing plain 3v3 4.5 points — added to fix a staged case without measuring
  it on the host. All three are reverted; the lesson is item 2 of "Next".
