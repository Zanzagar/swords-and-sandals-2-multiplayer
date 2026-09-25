---
handoff:      2026-09-24-0453--the-stranded-work-is-merged-and-the-night-is-running
written:      2026-09-24 04:53 -0400
sessionStart: 2026-09-24 ~03:10 -0400
sessionId:    b64d8f55-2fcc-4980-a5e0-0608a07944e7
branch:       arena/champion-capture — PUSHED through e89a7d7 (this file's
              commit follows it). Re-measure:
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD`
commits:      70b79f1..HEAD (`git log --oneline 70b79f1..HEAD`)
suite:        main-tree profile at e89a7d7: 3,352 tests, 3,351 pass, 0 fail,
              1 skipped (the raw-trace archive check). RE-MEASURE BY EXIT CODE.
agentRuns:    wf_b7145bd6-967 — the OVERNIGHT run (16 implementer slices in 4
              tracks + 6 write-nothing verifiers), STILL RUNNING at this
              checkpoint; one camera fixer and one extract-all fixer (this
              session's Agent calls); 17 pinned Codex reviews run by the main
              session or its fixers.
status:       MID-SESSION CHECKPOINT. The session continues, merging the
              overnight tracks as they land. Supersedes 2026-09-23-2119.
supersedes:   2026-09-23-2119--the-arena-draws-what-the-engine-does.md — its
              "Open, ranked" list carries forward except where marked below.
              Session c62c201f ran on after writing it (pop-ups, looks, sound
              timing, crowd sounds, facing, seats, button art, size spells, the
              ring decisions — 787c6b2..70b79f1) and then ran out of context
              with FIVE implementers finished-unmerged and NO handoff; its
              unsaved draft is in its scratchpad
              (/tmp/claude-1000/<project>/c62c201f-.../scratchpad/handoff-0924.md).
---

# The stranded work is merged, and the night is running

## The one-sentence version

The five implementers the last session stranded when its context ran out had
all finished (`stop_reason: end_turn`, reports recovered from their
transcripts, nothing re-run from scratch); each was reviewed by Codex until
it approved (or, for extract-all, stopped deliberately at pass 14), merged
with its applied lines checked against the reviewed worktree, and pushed —
and a four-track overnight run is building the in-battle ring and fixing the
engine, docs and animation timing in worktrees.

## What is done (commit, one line each)

- 28d4b3b — the loading gate (no flash of the authored figures): the last
  session had applied it and passed its suite; committed after re-checking
  the applied diff line for line against the reviewed worktree.
- b1ac294 — S1, no rest while a foe is in reach (Codex approve).
- ef48e17 — E, `previewAction` / `unavailableActions` (Codex approve;
  applied three-way over S1, which touched the line above its hooks).
- 9ed4375 — the survivors' camera close-up. Codex pass 3 (run here) found
  the DRAWN zoom unchecked after easing; a fixer reproduced it exactly and
  fixed it; pass 4 approved. **Owner's call recorded in the commit:** the
  fix trades crops for rare one-frame zoom cuts (30 / 26 per ~2M random
  frames, none in demo bouts).
- 1af9cd4 — the board (version 13).
- e89a7d7 — `node tools/extract-all.mjs`. FOURTEEN Codex passes; 1-13 each
  found something real (one HIGH: a symlinked output could truncate the
  installed SWF — now refused before any write). The design moved from
  in-place set-aside/put-back to `--out` staging. **Pass 14 is NOT fixed, by
  my decision:** after a failed UNDO (a double fault) the next run's staging
  sweep deletes the retained backups. Proven end to end against the real
  install in a clean worktree: 11 ok in 3.9 s, a second run skips all 11,
  the SWF's sha256 unchanged, all 122 files byte-identical to the main
  tree's packs except two `generated` timestamps.

## IN FLIGHT — the overnight run (wf_b7145bd6-967)

Four worktrees, all based on ef48e17, each `assets/<pack>` a symlink into
the main tree's packs (so pack-gated tests run; extract-all refuses such a
tree, correctly):

| track | worktree / branch | slices (in order) |
|---|---|---|
| ring (chain: stops at the first slice not `done`) | `.claude/worktrees/night-ring`, `night/ring` | S2 core, S3 art, S4 movement, S6 swap, S5 items, S7 previews, S9 reasons, S8 pacing |
| engine | `night-engine`, `night/engine` | a taunt-strike stamina, b taunt-heal loop, c closed-on archer, d stale ss2-rules comments |
| docs | `night-docs`, `night/docs` | a the 34 doc/code items (minus engine's), b tools hygiene |
| timing | `night-timing`, `night/timing` | a clip speed vs the build, b blood on continuation runs |

Everything the run needs is in this session's scratchpad `night/`:
`briefs/<track>-<slice>.md` (the task), `<track>/NN-<slice>.report.md` and
`NN-<slice>.cumulative.diff` (after each slice), `verify/` (the verifiers'
scratch). The workflow script and resume command are printed in the
session transcript; its journal is
`~/.claude/projects/<project>/b64d8f55-.../subagents/workflows/wf_b7145bd6-967/journal.jsonl`.

**To merge a track** (the main session's job, nobody else's): read each
slice's report and the verifiers' verdicts; turn the cumulative diffs into
one commit per slice (apply NN-1 and NN cumulative diffs to a scratch
export of ef48e17 and diff them, or commit them in sequence in a scratch
clone and `git format-patch`); `git apply -3` each onto main; check the
applied +/- lines against the slice's diff; full suite + census; commit
naming the slice, its Codex passes and its verifier verdict; push; move its
board card. Then remove the worktree and its branch.

## Open, ranked (carried forward, updated)

1. The overnight tracks, above.
2. Owner calls: the camera's one-frame zoom cuts (9ed4375); S1's open
   long-range half (a rest offered beside the taunt at >= half stamina on a
   long frame, where the build's shared slot shows the taunt alone); the
   demo duellist's 3v3 taunting (roster shape); the permission ask to
   Oliver Joyce when his full reply comes.
3. The ~61 older agent worktrees under `.claude/worktrees/`: a reverse-apply
   check cannot prove them merged once later commits touch the same lines
   (today's own S1/E worktrees read "unproven"), so remove them by
   inspection, not by script. `ss2-progression-design` is separate work.
4. The previous handoff's arena residuals and carried items (its items 3-5)
   are unchanged except where an overnight slice closes one.

## Things I got wrong

- **I proposed the extract-all rollback that cost several Codex rounds.**
  My pass-9 decision ("restore the previous pack on any failed check") was
  right as a goal, but asking for it as in-place set-aside/put-back produced
  passes 10-13; the `--out` staging every extractor already supported was
  the design from the start, and I only checked for it at pass 10.
- An unquoted heredoc executed a backtick span in one overnight brief (the
  closed-on archer's pointer line) — caught before launch and restored.
- Reading the board Artifact to satisfy the publish rule dumped ~30k
  tokens of HTML into the main context. Next time republish from the local
  build and read only if the publish is refused.
- A `grep -v` meant to strip `git status` lines from a patch stream also
  ate diff context lines and corrupted the patch; `git apply --check`
  caught it and the patch was rebuilt.
