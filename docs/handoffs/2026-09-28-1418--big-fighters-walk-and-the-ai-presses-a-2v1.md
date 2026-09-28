---
handoff:      2026-09-28-1418--big-fighters-walk-and-the-ai-presses-a-2v1
written:      2026-09-28 14:18 -0400
sessionStart: 2026-09-26 23:57 -0400 (paused 2026-09-27 at the usage limit, resumed 2026-09-28)
sessionId:    f4d2f69f-ef73-4cfd-b04c-02450290559a
agentRuns:    three write-nothing verifiers (Agent tool, no workflow): the lane fix (could not break it); the
              press ("it cannot oscillate" REFUTED -> 74c0014); the far-side guard (no sustained shuttle; a
              distant drawn bow held a side -> 92f9701). 92f9701 itself has had NO verifier.
branch:       arena/champion-capture == github/main — both PUSHED through this file's commit.
suite:        main-tree profile at 92f9701: 3,810 tests, 3,809 pass, 0 fail, 1 skipped (the archive check).
              Measured on an untouched tree. RE-MEASURE BY EXIT CODE.
status:       END OF SESSION. Nothing in flight.
supersedes:   2026-09-26-0305--the-gate-is-adopted-and-main-is-current.md — its "Owner-reported defects"
              1 and 2 are DONE (below); its ranked items 1 (the crowd-bar call), 2 (ring3) and 4
              (housekeeping) carry forward; its item 4's board update is DONE.
---

# Big fighters walk again, and the AI presses a 2v1

## The one-sentence version

The owner's two playtest defects are fixed and merged: a body now blocks a walk only in the walker's
own lane (strong fighters, strength 27+, used to block the NEXT lane and walk in place), a walk that
would go nowhere is greyed "Blocked" instead of offered, and the AI presses a numbers advantage (no
crowd-pleaser while an ally fights; it steps out of a queue and goes round when the far side is open)
— with **ranged-first shipped** and pincer-first one word away, the owner's call on the evidence.

## What changed (commits, in order)

- **57b2209** `Fix:` `ss2BodyBlocks` is `ss2SameLane`. It read `|dy| < physical_size(body)`, and
  `physical_size = 80 + round(strength / 1.5)` passes the 97 between ranks at strength 27 (a colossus
  on the demo roster, 8 of the 18 decodable champions): a big body stopped every walker in the next
  lane, and at strength 111 a walk forward went BACKWARD. Champion 3v3: walks that went nowhere
  123 -> 16 (77 cross-lane -> 0). The test that pinned the rule stood its body two ranks away.
- **75f2b85** `Docs:` the grilling round, `docs/design/battle-ui.md#decided-ai-press-2026-09-27`:
  **P1 help first, P3 a blocked walk greyed, P4 finish your own fight; P2 by evidence.**
- **875a794** `Fix:` my own record errors in 57b2209, found by the first verifier: "171" is 172,
  "most champions" is 8 of 18, and four places still restated the old rule.
- **8f63c00** P3: `ss2WalkBlocked` — a walk that goes nowhere because of a body in the walker's lane
  is withheld; the ring greys it with the new team code `blocked`. A walk into the arena WALL is not
  covered and is still offered. **It reaches 1v1 in one case**: a fighter whose reach is shorter than
  his foe's body (strength gap 65+) parks out of reach on the clamp line; he used to walk in place
  there every turn and now taunts (the "OUTSIDE 65" test; the bigger one still wins 8/8).
- **5cb6977** P1/P2: `ss2PressTarget`, `ss2PressMove`, `aiPress` (`off` | `ranged-first` shipped |
  `pincer-first`).
- **a1867c8** `Chore:` `tools/ai-press-census.mjs`, the P2 instrument (the decision's table reproduces
  from it: `node tools/ai-press-census.mjs <kit> <perSide> 96 [h2h]`).
- **74c0014** `Fix:` the second verifier REFUTED my claim that the press could not oscillate: with the
  target's far side already taken (3v1, or the foe at the wall) it stepped a fighter into the queue
  and out again forever (99 rank steps, 0 attacks in 100 turns staged; seeded arena bouts too). The
  press now goes round only while the far side is open. Four-turn shuttles, demo 3v3 x4 kits x48
  seeds: ranged-first 12 -> 3, pincer-first 11 -> 1 (the old AI: 4).
- **74bb257** `Docs:` P2 re-measured at 74c0014.
- **92f9701** `Fix:` the third verifier: "fighting" read `ss2Reach`, which with a bow drawn is the
  bow's reach (4,485), so a distant archer ally "held" a side of the target and the free member waited
  (27 turns of taunts from the queue, staged). Only a melee fighter now holds a side; the press TARGET
  still counts the bow (P1). The buffs kit's 2v2 pin moved (attributed: `aiPress: "off"` keeps the
  old pin exactly). The same verifier found no sustained shuttle after 74c0014 (longest run 3,
  against 57 before on the same random rigs); the reversals it traced followed real changes.
- **bb3a691** `Docs:` **P2 measured a third time, at the shipped code**: against the old AI,
  ranged-first converts 3v3 2v1s +10 to +30 points (buffs 3v3 95 -> 68 turns a bout); head to head
  **784 : 752** over 1,536 bouts, pincer-first clearly weaker on buffs 2v2.
- **6a462fa** `Docs:` the project board brought up to date (HUD, crowd bar, plates, gate done; the
  movement, team-AI and crowd cards; three stale cards corrected) and republished
  (https://claude.ai/artifact/Mu7AjEwZXcJfZGPzgXKZxb, version 16).

## Also this session: the harness change log for the other machine

The owner asked for the harness changes to be communicated to the other machine. No session there was
reachable (ListAgents: none local, no Remote Control), so the channel is the repo: **claude-harness
`c85e2f3` on main, `docs/machine-sync.md`** — what changed f8ca5e4..9a37ec7 and what each machine does
after pulling; the README's install section points at it. **This machine's own
`~/projects/claude-harness` checkout is still on `standards/git-hygiene` at f8ca5e4** (its symlinked
skills are three weeks old); left alone, since switching it changes the installed skills here.

## Owner calls, open

1. **P2: keep `ranged-first` or flip to `pincer-first`?** Ranged-first is at least as strong (784 :
   752) with shorter bouts; pincer-first corners more VISIBLY on champions (the pair on both sides of
   the lone foe 32% of 2v1 turns against 14% in 2v2). One word: `aiPress`.
2. **Should a pair dance in a 2v1 before anyone engages?** P1 stops the crowd-pleaser only while an
   ally is FIGHTING; on plain 2v2 the free member still plays to the crowd while the lone foe walks in
   (14% of the pair's 2v1 turns, all 134 before anyone engaged) — the 2026-09-23 crowd rule. It may
   still read as "waiting" to a player.
3. **P3 in 1v1** (the strength-gap-65 case above) — inside the decision as worded, but the one place
   P3 moves a 1v1.
4. **The archer's closed-on test reads no lane** (first verifier, pre-existing): a foe in ANOTHER lane
   inside `100 + physical_size` takes away an archer's shots and its walk toward its own-lane foe.
   Reproduction: `~/.cache/ss2-scratch/verify-lane/archer.mjs`.
5. **`ss2ShotBlocked` keeps the body's extent** (the 2026-09-13 screening rule), so a body wider than
   the 97 between ranks screens a snipe along the NEXT lane. Recorded, not decided.
6. **A knockback can carry its victim through his attacker's body** (third verifier, cause unchecked):
   champions 3v1 seed 42 action 26 (blue-1 250 -> 549 past red-3 at 340); buffs 2v3 seed 84 action 50.
7. Carried: the crowd bar vs team pop-ups (~2-4% of frames); snapping the camera on a colossus cast;
   fading the fallen fighter's plate with the D6 hold; the gate's `--cleanup=strip` false refusal.

## Next, ranked

1. **The owner playtests the fixes**: a big-fighter bout (`?items=buffs`, or champions
   `?red=5,7,10&blue=13,16,18`) and 2v1s in 2v2/3v3 — then answers calls 1 and 2.
2. **A write-nothing verifier on 92f9701** (it has had none): the melee-only sides, and whether a
   target fought only by a distant archer is closed on sensibly.
3. **The ring3 track** (unchanged: R1, R2, C1 from `docs/design/battle-ui.md#decided-hud-2026-09-24`
   items 1, 6, 7; the `implement-slices` skill).
4. **Housekeeping**: 77 directories under `.claude/worktrees/` and the `~/projects/claude-harness-*`
   copies, all believed merged — remove after a look.

## Things I got wrong (flagged here, and in the commits named)

- **I claimed the press could not oscillate, and it could** — the second verifier broke it with two
  staged positions and seeded arena bouts; fixed test-first in 74c0014 (the tests are red on 5cb6977).
  The third found a distant drawn bow "holding" a side (92f9701). Both claims went out as settled.
- **I ran `git stash` while a verifier was reading the tree** — the known rule (a verifier's brief is a
  snapshot). I told it at once and it judged the commit from `git archive` copies only.
- **Two of my full-suite runs straddled my own edits**, and I reported one as "P3 alone moved 9 tests"
  before noticing. The numbers in the commits come from runs on an untouched tree.
- **Two wrong figures in 57b2209's message and docstring** (171, "most champions"); corrected in
  875a794, the message stays as pushed.
- **My first P3 commit was red on its own**: the ring tests' new staging was found under the full
  engine. Caught by checking each intermediate commit before pushing; re-staged, both rebuilt.
- **`ss2PressTarget` assumed `view.allies`** and threw a TypeError on a hand-built view; the suite
  caught it.
- **My docstrings first understated pincer-first** (it goes round ahead of the taunt too).
- **The board's new change lines went at the wrong end** (the list is newest-first).
