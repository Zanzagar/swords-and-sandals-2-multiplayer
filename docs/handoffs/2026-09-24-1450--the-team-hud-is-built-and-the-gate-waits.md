---
handoff:      2026-09-24-1450--the-team-hud-is-built-and-the-gate-waits
written:      2026-09-24 14:50 -0400
sessionStart: 2026-09-24 ~03:10 -0400 (b64d8f55), continued ~11:30 (e75af16c)
sessionId:    e75af16c-630e-48ae-ae68-dbba8f686613 (continues b64d8f55-2fcc-4980-a5e0-0608a07944e7)
branch:       arena/champion-capture — PUSHED through this file's commit.
              Also pushed, NOT merged: night/gate (9c6f6de) here, and gate/grilling-trailers
              (3f49e92) in claude-harness.
commits:      8043430..HEAD
suite:        main-tree profile at 674cf9e: 3,642 tests, 3,641 pass, 0 fail, 1 skipped. RE-MEASURE BY EXIT CODE.
agentRuns:    wf_4a7d3b65-6c7 (ring2 edge/S9/S8 + engine2, resumed across the closed chat; 7 of 7,
              0 dead); HUD implementer; gate implementer (4 rounds); Codex passes 4-6 on the gate
              and the verifiers named in each commit.
status:       END OF SESSION. Supersedes 2026-09-24-1148.
supersedes:   2026-09-24-1148--the-night-merged-and-the-hud-is-decided.md — its IN FLIGHT items
              1-2 are MERGED; item 3 (the gate) is BUILT, NOT ADOPTED; item 4 (ring3) is not started.
---

# The team HUD is built, and the gate waits for review

## The one-sentence version

The team HUD (team colours, two team panels with health / energy / armour, the crowd meter, a
turn-order strip), the ring's greyed reasons (S9) and AI pacing (S8) are merged and seen in a real
browser; the commit-trailer gate that enforces grilling is built in both repos and pushed to its
own branches, but NOT adopted, because Codex has not approved it yet.

## Done since 8043430 (each commit message carries its evidence)

- a1f6500 H1 team colours · 93b2179 H2 team panels + crowd meter · f9a135e H3 turn strip.
- 07fb177 S9 why a button is greyed (merge: 3 conflicts resolved, the reason-table pin re-pinned
  for `no-arrows`) · 4b71a5b S8 AI pacing (Shift 4x; "Skip to my turn" 64x) ·
  674cf9e the stale hit-test race the ring2 verifier found (a click after Tab hit the old ring).
- Owner decisions recorded: 71586f6 (jump/charge SHOWN greyed "Not built yet"; design them for
  lane changes), f24101f + 137171f (SOFT LANES is the direction; free y later, by a data spike).

## Next, ranked

1. **Adopt the grilling gate** — `docs/design/battle-ui.md#decided-hud-2026-09-24` item 8, and the
   owner's three calls (no author-date exemption; `git commit --no-verify`/`-n` denied; a PR
   template + the CI check of the PR description). Built on `gate/grilling-trailers` (harness,
   3f49e92) and `night/gate` (here, 9c6f6de; its worktree `.claude/worktrees/night-gate` and the
   harness's `~/projects/claude-harness-gate` still exist). **Codex pass 6 has three open medium
   findings** (both: a slice key like `a/../b` shares a scratch dir; harness: a file that merely
   mentions the gate is overwritten; SS2: a PR can add its own commit to the baseline) — fix,
   review to approve, then adopt IN THIS ORDER: in the night-gate worktree `rm
   .githooks/grill-gate.baseline && sh ~/projects/claude-harness-gate/adopt.sh <worktree>`; merge
   night/gate; `git config core.hooksPath .githooks`; set the GitHub squash message
   (`gh api -X PATCH repos/Zanzagar/swords-and-sandals-2-multiplayer -f
   squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY`); merge the harness
   branch by PR (a human merges). From adoption on, EVERY commit needs `Decided:` or a class
   trailer — update `.../scratchpad/night/merge-slices.sh`'s messages (they already carry them).
2. **The ring3 track** (briefs ready: `/tmp/.../b64d8f55-.../scratchpad/night3/briefs/ring3-*.md`,
   `Decided: docs/design/battle-ui.md#decided-hud-2026-09-24`): R1 the spell row clear of the
   bow's words (the owner's first report), R2 the reach preview (numbered rings on every foe a
   spell or bombard can reach), C1 the camera frames a person's ring at a fixed on-screen size
   (also the real fix for the edge case the edge slice could not meet: a fighter drawn within a
   button radius of the stage edge). The workflow template: `.../scratchpad/night2/workflow2.js`
   (or the harness's implement-slices.js once the gate lands).
3. **Jump/charge greyed "Not built yet"** (decision 9): S9 still HIDES them (`RING_HIDDEN_VERBS`,
   tools/arena/ring.js) — it was built before the owner reversed Q8. A small follow-up.
4. **Design rounds (grilling)**: soft lanes + jump/charge lane changes + the whirlwind radius
   (board card `lanes-discrete-or-continuous-y`); first get a repro (seed + screenshot) of the
   out-of-lane melee the owner saw.
5. Owner calls collected in the commits: the hover % (rollover vs true odds); authored animation
   families at build frames; the cornered archer's sword swap; the camera's one-frame zoom cuts;
   S1's long-range rest; the far-apart ring mode (sprite 711); "Wraith" vs "Life-drained" and the
   build's "Tranfixed"; S8's key and rates; greying the engine's own grey codes.

## Things I got wrong

- I let the context reach ~650k on the owner's watch before planning the handoff; the owner had
  to ask. Reading a board Artifact (30k) and whole agent summaries were the avoidable costs.
- Two merges failed on stale bases I could have predicted (S9's reason-table pin after engine2;
  index.html conflicts after the HUD): run the 3-way trial in a detached worktree BEFORE the
  suite, as I did for the ring's first merge.
- A test coverage sample and a reason-table pin were re-pinned at merge by me, not by an agent —
  both named in their commits.
