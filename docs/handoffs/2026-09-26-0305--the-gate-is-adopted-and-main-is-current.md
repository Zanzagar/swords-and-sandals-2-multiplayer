---
handoff:      2026-09-26-0305--the-gate-is-adopted-and-main-is-current
written:      2026-09-26 03:05 -0400
sessionStart: 2026-09-24 ~15:00 -0400
sessionId:    5bb96879-cf46-4e39-b2f9-5bc0d47616c0 (the process restarted twice after WSL reboots; same conversation)
branch:       arena/champion-capture == github/main — both PUSHED through this file's commit.
suite:        main-tree profile at 9a2a34b: 3,786 tests, 3,785 pass, 0 fail, 1 skipped. RE-MEASURE BY EXIT CODE.
status:       END OF SESSION (the owner hit the week's usage limit). Nothing in flight.
supersedes:   2026-09-25-2340--the-hud-is-in-the-frame.md — ALL of its "Done" stands; its item 2 (the gate)
              is DONE; its items 1, 3 and 4 carry forward below.
---

# The gate is adopted, and main is current

## The one-sentence version

The in-frame HUD (the build's own gauges and crowd bar, colour-only name plates, a camera that keeps
fighters clear of it) is merged and playable; the grilling gate is ADOPTED here — every commit needs a
`Decided:` or `Fix:`/`Docs:`/`Chore:`/`Test:` trailer, checked by `.githooks/` and CI — and SS2's
main-push block is dropped, so `main` is kept equal to `arena` by the agent.

## What changed since the previous handoff

- **2aa4eab** the crowd bar (D8), pulled from `combat_panel` and drawn at its own place.
- **claude-harness PR #7** (1d9f92f, owner's go): adopt.sh writes nothing through a fixed temp name, a
  link or a non-regular file; check-trailers ignores inherited git config and cuts only at git's exact
  scissors line. Two verifier rounds; the last hole (a crafted clone routing a copy outside the
  project) fixed by the main session, test-first.
- **6a6afe7 + eac0352** SS2 ADOPTS THE GATE: night/gate merged onto arena, baseline regenerated (46
  branch tips), hook/checker/CI upgraded from harness main. `core.hooksPath .githooks` is set in THIS
  clone; CI's grill-gate check is green; GitHub squash merges use the PR title and description.
- **9a2a34b** the owner dropped SS2's 24 main/master push denies (harness floor); `main` fast-forwarded
  a89704c..9a2a34b. Force-pushes and deleting main stay denied (and GitHub protects main).

## How to work here now (read before the first commit)

- **Every commit ends with a trailer**: `Decided: docs/…#anchor` (a recorded decision, e.g.
  `docs/design/battle-ui.md#decided-inframe-hud-2026-09-24`) or `Fix:`/`Docs:`/`Chore:`/`Test:` + why.
  `git commit --no-verify`/`-n` is denied. A new clone runs `git config core.hooksPath .githooks` once.
- **A feature needs a recorded decision first** (grilling round -> doc anchor), and the
  `implement-slices` workflow refuses a feature slice without one.
- **After merging to arena, fast-forward main:** `git push github arena/champion-capture:main`.
- **This box rebooted twice under load** (7.5 GB): durable scratch in `~/.cache/ss2-scratch/`, at most
  2 heavy agents at once, and restart the arena server after a reboot:
  `node tools/arena-server.mjs --host 0.0.0.0` (Windows cannot reach WSL loopback here), then
  `http://<hostname -I>:8123/tools/arena/index.html?teams=3&spectate=1`.

## Next, ranked

1. **Owner playtest feedback** on the in-frame HUD and crowd bar. Open owner call: the crowd bar sits
   where the build puts it (top right) and in team bouts damage pop-ups pass under it ~2-4% of frames,
   a close-up crown <1% (1v1: none) — keep, move it, or paint pop-ups over the HUD?
2. **The ring3 track** (unchanged: R1 spell row clear of the bow's words, R2 the reach preview, C1 the
   camera frames a person's ring); its briefs were in a wiped /tmp — rewrite from
   `docs/design/battle-ui.md#decided-hud-2026-09-24` items 1, 6, 7. Use the `implement-slices` skill.
3. **Open owner calls:** snapping the camera's size on a colossus cast (it eases; a grown fighter's
   shadow sits under the HUD ~24-27 frames); the fallen fighter's name plate could fade with the D6 hold;
   the gate's one narrow false refusal (`git commit --cleanup=strip -F` with a comment line in the
   trailer paragraph — use `git -c commit.cleanup=strip commit -F`).
4. **Housekeeping:** many stale worktrees under `.claude/worktrees/` (hud-*, night-gate, agent-*,
   wf_*) and `~/projects/claude-harness-{gate,alias,gatefix2}` — all merged; remove after a look.
   The project board (`docs/board/board.json`, Artifact Mu7AjEwZXcJfZGPzgXKZxb) was not updated this
   session: move the HUD, crowd and gate cards.

## Things I got wrong (this session, in addition to the previous handoff's list)

- **My handoff commit forgot its row in the handoffs index**; the suite caught it on the next merge.
- **`git apply -3` stages, and my next commit swallowed a whole slice under the wrong message**; split
  before pushing.
- **I scoped a Codex review to skip known risks** (a non-neutral focus); killed and re-ran it.
