---
handoff:      2026-09-24-1148--the-night-merged-and-the-hud-is-decided
written:      2026-09-24 11:48 -0400
sessionStart: 2026-09-24 ~03:10 -0400 (session b64d8f55), continued ~11:30 in e75af16c
sessionId:    e75af16c-630e-48ae-ae68-dbba8f686613 (continues b64d8f55-2fcc-4980-a5e0-0608a07944e7,
              whose chat was accidentally closed at ~11:25)
branch:       arena/champion-capture — PUSHED through f08f283 (this file's commit follows).
commits:      67373a2..HEAD
suite:        main-tree profile at 33ef9ea: 3,574 tests, 3,573 pass, 0 fail, 1 skipped.
agentRuns:    wf_b7145bd6-967 (the overnight run: 20 of 22 briefs started — the ring chain stopped
              at S7, so S9 and S8 never started; 0 dead); wf_4a7d3b65-6c7 (the follow-up: ring2
              edge / S9 / S8 + engine2 — interrupted by the closed chat, RESUMED from the next
              session, still running); fixers and verifiers as Agent calls (listed in the commit
              messages); HUD and gate implementers (running at this checkpoint).
status:       MID-SESSION CHECKPOINT. Supersedes 2026-09-24-0453.
supersedes:   2026-09-24-0453--the-stranded-work-is-merged-and-the-night-is-running.md — its
              "IN FLIGHT" overnight run is ALL MERGED (below).
---

# The night merged, and the HUD is decided

## The one-sentence version

All four overnight tracks are merged (the ring S2-S7, engine fixes, doc/code corrections,
animation timing), each after Codex approval and a write-nothing verifier that broke three
of the four first versions; the owner played the team demo, and a grilling round decided the
team HUD, a reach preview for spells and bombard, a camera that makes room for the ring, and a
commit-trailer gate that enforces grilling in git and CI.

## What is done since 67373a2 (one line each; each commit message carries its evidence)

- docs: 3cd99b0, de5d67e, 8b8ffe2 — 28 doc/code disagreements, two tools that silently
  exited 0 from a spaced path, re-derived props counts. (d9ce813: my missing index row.)
- timing: 1978db0 (build-frame clips: knockback 633 ms, not 1,560), d50b41d (blood follows
  the drawn animation; deaths bleed), 0ac2309 (a goto frame is never drawn).
- engine: 6284bde (taunt-strike stamina order), b809176 (stale comments), 7c9cabb (the
  taunt-heal loop; a closed-on archer backs away or puts the bow away — never bashes;
  verified twice), 39da762 (no swap offer without arrows).
- the ring: 454c67c S2, a1683f3 S3, 6099d69 S4, 3b022e8 S6, 1f4759c S5, 2ba96c3 S7,
  33ef9ea the stage-edge fix. Seen working in a real browser (tools/shot-live.sh).
- f08f283 — the owner's decisions: docs/design/battle-ui.md#decided-hud-2026-09-24.

## IN FLIGHT

1. **wf_4a7d3b65-6c7** (ring2 S9 greyed reasons, S8 AI pacing, then 2 verifiers) in
   `.claude/worktrees/night-ring2`, base 2ba96c3 + the edge slice. The chat closed while S9
   was mid-build: its partial worktree is SAVED at
   `/tmp/.../b64d8f55-.../scratchpad/night2/ring2/s9-partial-at-close.cumulative.diff`, the
   worktree was reset to the edge snapshot (cmp-verified), and the run resumed from the next
   session (a memory note records how). Its engine2 verifier re-ran against a worktree already
   removed after engine2 merged — wasted, harmless (write-nothing).
2. **HUD track** (H1 team colours, H2 team panels + crowd meter, H3 turn strip) in
   `.claude/worktrees/night-hud`, base f08f283. Brief:
   `/tmp/.../b64d8f55-.../scratchpad/night3/briefs/hud.md`.
3. **Gate track** — G1 in the harness worktree `~/projects/claude-harness-gate` (branch
   gate/grilling-trailers), G2 in `.claude/worktrees/night-gate`. Brief: `.../night3/briefs/gate.md`.
   After it merges the main session runs `git config core.hooksPath .githooks` here.
4. **Queued: the ring3 track** — R1 the spell row clear of the bow's words, R2 the reach
   preview, C1 the camera frames a person's ring at a fixed on-screen size. Briefs written
   (`.../night3/briefs/ring3-*.md`); it starts when ring2 lands (same files).

Merging: `.../scratchpad/night/split.sh` (per-slice diffs from cumulative snapshots) and
`merge-slices.sh` (apply -3, applied-lines check, suite, census, commit, push).

## Owner decisions still open

The hover % (the build's rollover number or the true odds); whether the authored animation
families also play at the build's frames; the cornered archer swapping to its sword; the
camera's rare one-frame zoom cuts; S1's long-range rest beside the taunt; the build's
far-apart ring mode (sprite 711); the walk flush with the stage edge versus partly off it.

## Things I got wrong

- The merge splitter wrote into a directory that did not exist; nothing was applied, the
  stray scratch worktree was removed and the merge rerun.
- A coverage test (S3's whole-bout art test) failed on main because the AI merged since
  changed which stances bouts reach; I widened its sample (2v2) at merge — named in a1683f3.
