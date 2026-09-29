---
handoff:      2026-09-29-0716--the-press-is-refined-and-two-ring3-slices-landed
written:      2026-09-29 07:16 -0400
sessionStart: 2026-09-28 21:06 -0400
sessionId:    9cd94403-3a27-4b7f-ad74-fb82a311247c
agentRuns:    implement-slices wf_95bff0e1-595 (ring3: spellrow, reach, camera + 3 verifiers; verify3 died on
              a network error, EAI_AGAIN, and was RESUMED — IN FLIGHT at writing); press verifiers six (re-run
              from scratch, REFUTED ab56337), seven (REFUTED 6dee6b4 in staged positions) and eight (on
              be56a22, IN FLIGHT at writing)
branch:       arena/champion-capture == github/main at 6c4d06a — both PUSHED through it
commits:      c2b5751..6c4d06a (plus harness b584b41, ca0635e)
suite:        main tree at e586e19: 3,874 tests, 3,873 pass, 0 fail, 1 skipped (the archive check)
board:        current at e586e19 (republished, version 18)
status:       WORK IN FLIGHT (two write-nothing verifiers). See "If you restart now".
supersedes:   2026-09-28-1939--the-press-holds-under-ranged-first-and-ring3-is-running.md — its start-here
              items are DONE: ring3 relaunched and finished (camera's verifier re-running), the sixth
              press verifier re-run and acted on.
---

# The press is refined twice, two ring3 slices landed, and two verifiers are running

## The one-sentence version

The sixth press verifier refuted ab56337 and the seventh refuted my fix for it in staged positions;
both are answered (`6dee6b4`, then `be56a22`, every repro a test) and an eighth verifier is on
`be56a22`; ring3's spell row and reach preview are on `main` (`1b55bad`, `c31fe35`) and its camera
slice waits on a re-run verifier; and the board is current again, with a `board:` field in every
handoff so a lag shows.

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
- **Board:** `b4d2c45` and `6c4d06a` — it had lagged all of 2026-09-28; `docs/handoffs/README.md` now
  asks every handoff for a `board:` field.

## If you restart now

- **The camera slice** is built and unmerged: commit `562e45f` on the scratch branch `ring3/merge`
  (worktree `.claude/worktrees/ring3-merge`; its message is a WIP placeholder — rewrite it from
  `~/.cache/ss2-scratch/ring3/merge-notes/camera.json` when merging). The slices' working copy is the
  `ring3` worktree (`ring3/rest2`, uncommitted, byte-identical to `c2b5751` + `03-camera.cumulative.diff`,
  checked). Its verifier (`ring3:verify3`) is a RESUME of `wf_95bff0e1-595`; if cut, resume again with
  the same args (in this session's transcript; the run's script is under
  `~/.claude/projects/-home-corey-projects-swords-and-sandals-2-multiplayer/9cd94403-3a27-4b7f-ad74-fb82a311247c/workflows/scripts/`).
- **The eighth press verifier** (write-nothing, on `be56a22`; scratch `~/.cache/ss2-scratch/verify-press8/`):
  if cut, re-run it from its brief in this session's transcript.

## Owner calls, open (new ones first)

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

1. Read the camera verifier; merge `562e45f` (cherry-pick, full suite on the main tree, `Decided:`
   trailer, decision 6's "Built" note, the board) or fix what it breaks.
2. Read the eighth press verifier; fix anything it breaks under ranged-first before building on the
   press.
3. Re-measure P2 (`tools/ai-press-census.mjs`, the decision's table) on the settled press; the `off`
   column must come out unchanged.
4. **Pre-existing, found by the seventh verifier (T692, T513):** a fighter between two fights paces as
   the nearest fought foe flips while he walks toward either one's spot. Proposed: choose the press
   target by NEAREST OPEN SPOT, which walking toward cannot flip — but it changes the press's
   targeting, P1 and the P2 evidence, so it wants the owner's nod.
5. The worktree archive can be deleted once nobody has asked for anything in it.

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
