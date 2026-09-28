---
handoff:      2026-09-28-1939--the-press-holds-under-ranged-first-and-ring3-is-running
written:      2026-09-28 19:39 -0400
sessionStart: 2026-09-26 23:57 -0400 (same session as the 17:50 handoff; the owner restarts the PC "at an
              appropriate time")
sessionId:    f4d2f69f-ef73-4cfd-b04c-02450290559a
agentRuns:    fifth press verifier on 06beab0 (REFUTED as worded -> 463fe3f, ab56337); implement-slices
              wf_5384c73c-7c5 (ring3 slice 1, jumpcharge -> 457003a); IN FLIGHT at writing: implement-slices
              wf_58a376ee-0f2 (ring3 slices 2-4) and a sixth press verifier on ab56337.
branch:       arena/champion-capture == github/main at 457003a before this file's commit — both PUSHED through it.
suite:        main-tree profile at 457003a: 3,835 tests, 3,834 pass, 0 fail, 1 skipped (the archive check).
              RE-MEASURE BY EXIT CODE.
status:       WORK IN FLIGHT (two background runs). If the PC restarts before they report, see "If you
              restart now".
supersedes:   2026-09-28-1750--the-press-heads-for-a-spot-and-ring3-is-paused.md — its NOT-DONE items 1
              (the census) and 2 (a verifier on 06beab0) are DONE; its ring3 resume steps are superseded
              below. The 14:18 handoff's owner calls still stand.
---

# The press holds under ranged-first, and ring3 is running

## The one-sentence version

The fifth verifier found no lane shuttle under the shipped ranged-first in 4,608 seeded bouts but
caught the older join and rank arms re-queueing a fighter the press had stepped out, and a pacing
regression — both fixed (`463fe3f`, `ab56337`, measured again in `1f9961c`); ring3's first slice (jump
and charge greyed "Not built yet") is on `main` (`457003a`), and its other three slices are building.

## What changed since the 17:50 handoff

- **463fe3f** `Fix:` `aiPress: "off"` is exactly the pre-press AI again (the rank-arm guard is gated).
- **ab56337** `Fix:` `ss2PressGoal` (the press's open spot, shared) and the join/rank-arm guard: a rank
  step that lands behind an ally is skipped only while an open spot exists; with none, the fighter
  queues and waits as before. Measured: lane shuttles, seeds 1-96 of champions 2/3v3, tricks 3v3,
  buffs 2/3v3, both variants — champions 3v3 pincer-first 5 -> 0, every other cell 0. Ring-movement
  tests re-staged at 3v3 plain seed 21, turn 20.
- **1f9961c** `Docs:` the P2 evidence at ab56337: `off` exact again; ranged-first converts 3v3 2v1s
  +22.0 (plain), +34.8 (buffs), +22.6 (crowd), +4.9 (tricks), +3.6 (champions) points; head to head
  774 : 762; the known **pincer-first defect** (bow sheathe/redraw cycles in 8-10 of 96 champion 3v3
  bouts) recorded as a must-fix before choosing pincer-first.
- **457003a** ring3 slice `jumpcharge` (decision 9): jump and charge greyed "Not built yet" on the
  ring, nothing else moving. Two main-session fixes after the run: a verifier found the fitted view's
  whole ring shifted ~10 px by the greyed jumps (730 of 23,652 rings) — fixed in `ringButtonsInside`;
  and `test/arena-ring.test.js` sat outside my track's file glob (MY error) — the implementer's
  prepared re-pin applied.

## If you restart now

Two background runs die with the restart; both leave their state on disk:

- **ring3 slices 2-4** (`wf_58a376ee-0f2`; spellrow -> reach -> camera, chained) in
  `.claude/worktrees/ring3` on branch `ring3/rest` from `457003a`. Scratch and reports under
  `~/.cache/ss2-scratch/ring3/ring3/`; briefs `~/.cache/ss2-scratch/ring3/briefs/`. To resume: save the
  worktree's diff (`git -C .claude/worktrees/ring3 diff` plus untracked files) into the scratch, see how
  far the journal got (`~/.claude/projects/.../subagents/workflows/wf_58a376ee-0f2/journal.jsonl`), then
  either resume (`Workflow({ scriptPath: ".../workflows/scripts/implement-slices-wf_58a376ee-0f2.js",
  resumeFromRunId: "wf_58a376ee-0f2" })`, after resetting the worktree to the last finished slice) or
  relaunch the unfinished slices with a new base. **The file list now covers every test/arena-* and
  test/render-* file** (the jumpcharge run stalled on one outside it).
- **The sixth press verifier** on ab56337: re-run it from scratch (a write-nothing agent; one named
  claim under ranged-first — no 4-turn lane shuttle, no 4-turn wall-walking, no 4-turn taunt/rest/pacing
  while an open spot exists).

## Owner calls, open (new ones first)

1. **A greyed jump/charge disc can cover part of a non-selected foe's click box** (2,071 of 11,826
   camera-view rings), so a click there says "not built" instead of selecting him; Tab and the strip
   still select. Options: let clicks on greyed buttons fall through to a foe beneath, or keep it.
2. **The jump/charge button words are authored** ("Jump left", "Charge right"; the build's own
   option text could not be read), and the strip gains 2-3 always-greyed focusable buttons most turns.
3. From the 14:18 handoff, unchanged: P2 (ranged-first shipped; pincer-first needs its bow-cycle fix
   first); pre-engagement crowd play in a 2v1; P3 in 1v1; the archer's closed-on test ignoring lanes;
   `ss2ShotBlocked`'s extent; knockback through bodies.

## Next, ranked

1. Read the ring3 run's reports and verifiers; merge each finished slice onto arena (cherry-pick, full
   suite on the main tree, then fast-forward `main`), as `457003a` was.
2. Read the sixth verifier; fix anything it breaks under ranged-first before building on the press.
3. The pincer-first bow-cycle fix, if the owner wants pincer-first.
4. Housekeeping: the old harness work copies and merged worktrees.

## Things I got wrong (this stretch)

- **The ring3 file glob `test/arena-ring-*.test.js` missed `test/arena-ring.test.js`**, stalling the
  chained track after its first slice; three verifiers then had nothing to check.
- **Two more `cd`s into the ring3 worktree** moved the session's working directory; everything was
  written by absolute path, and the environment was put back.
- **An unquoted heredoc ate two backtick-quoted names in a code comment**; caught and fixed before the
  commit.
