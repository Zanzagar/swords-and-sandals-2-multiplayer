---
handoff:      2026-09-13-1600--everything-but-ranged-is-closed
written:      2026-09-13 16:00 -0400
sessionId:    cc273a6b-2487-427e-99ee-afcb84b34564 (https://claude.ai/code/session_015UxWyxsPP49dNY3V3Jhe7b)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      615a852..0d49945 (24 before this handoff), all pushed.
suite:        1101 / 1100 / 0 / 1 (fresh-clone profile), measured after
              `0d49945`. **Re-measure; never copy.**
agentRuns:    wf_5d6fa8dd-892 — question-fanout wave, 6+6, 12/12, 0 dead.
              wf_e1c5ac94-f5c — mutation audit, 20 agents, 17 applied, 2 SURVIVED.
supersedes:   2026-09-13-1145--the-gladiator-is-dressed-and-the-shell-has-a-seam.
              **Every ranked item in it is now done or handed off.**
next:         **RANGED, AND ONLY RANGED.** Read
              `docs/handoffs/RANGED-BRIEF.md`. The owner has asked for a FULL
              SWEEP of it and has already answered the question that gated the
              design. Nothing else on the board is blocking.
---
# Handoff — everything but ranged is closed

## The one-sentence version

The presentation work is finished — the arena draws the build's own dressed
gladiator with blood, sound and a pincering AI — the last open decision is
decided, and ranged is the only thing left.

## READ THIS SECOND: `docs/handoffs/RANGED-BRIEF.md`

The owner wants a **full sweep** of ranged and has answered the question that
gated it:

> **"Range will interact with the second axis."** — owner, 2026-09-13

**And it is cheaper than it sounds**, because the metric already does half:
`getfightdistance` returns `round(sqrt(xdist^2 + ydist^2))` and
`ss2FightDistance` already implements it, **so a foe two ranks back is ALREADY
further away** and `fightdistance < N` is already a 2-D gate.

What that does NOT settle: whether a rank between you and your target BLOCKS the
shot. The build cannot answer — vanilla has one gladiator a side, so there is
never a body in the way — which puts line of sight inside
`MAP_SILENCE.multi-slot-arena-geometry` and makes it AUTHORED. `ss2BodyBlocks`
is the precedent for that shape of rule.

**Three questions remain the owner's** and are listed in the brief: whether
swapping to a bow costs a turn, what happens when an archer is closed on, and
whether ammunition is finite.

## THE DECISION THAT CLOSED, after four sessions of deferral

**`BATTLE_STATE_VERSION` is DERIVED from the wire shape.** Owner's call,
2026-09-13: derive rather than bump — bumping fixes the instance, deriving
removes the failure mode. It is `fnv1a` over the sorted
`COMBATANT_PROJECTION_FIELDS`, **1 -> 573176825**, order-independent, an
IDENTITY and not an ordering, and a test asserts the declared field list is
exactly what `combatantProjection` returns.

► **Two things that cost more than the change.** `src/engine.js` projected
  `battle.version`, so the derived number leaked into the historical
  compatibility façade and moved all six legacy hashes — caught by the test
  whose own name is "the pinned hashes do not move". The façade carries
  `LEGACY_WIRE_VERSION = 1` now. And **90 tests failed on ONE schema line**:
  `fnv1a` returns hex while `provenance.battle.stateVersion` is contracted to be
  a positive integer.

**Eleven pinned hashes moved and every one is accounted for by name in
`a8a9e62`. NO GOLDEN MOVED** — the 23 replay against hashes computed within a
run, and all 13 golden tests stayed green throughout.

## What is DONE, so nobody reopens it

- **The rig**: 101 animations, 61 shapes, 290 baked morph frames (the blood).
- **The wardrobe**: 387 pieces, 12 slots, attached by the build's own table.
- **Sound**: bound by frame label, one voice per play, autoplay surfaced.
- **Flanking**: a 2v1 pincers — 0% -> 17.8%, and the pile-up tell is absent.
- **The shell seam**: eight decisions moved out of `tools/arena/main.js`.
- **The version**: derived.

## Highest-value work, ranked

1. **RANGED. Full sweep. `RANGED-BRIEF.md`.**
2. **Nobody has watched the rig MOVE or heard the sound.** Stills capture here;
   animation does not. **This is the owner's and it is five minutes**, and every
   defect he has found this week came from doing exactly it.
3. **The weapon ENCHANTMENT selector has not been found.** `weapon0` is
   character 703 with 13 frames — `flame` 2, `frost` 5, `poison` 8, `wraith` 11
   — and the resources exist, but **`updatecharacter` contains no `gotoAndStop`
   at all**, so the selector is elsewhere. Frame 1 (unenchanted) is taken, which
   is correct until it is found. Start from the other readers of
   `weapon_enchantment_type`, not from that routine.
4. **`tools/arena/main.js` still has partial test reach** — the draw dispatch,
   the autoplay handling and the rAF loop remain unreachable. **This file has
   given up SIX live defects in two days.**
5. **The mutation audit should be re-run after any substantial render change.**
   It found two survivors in code no test had executed.

## What is NOT verified

- **31 of the wave's 37 claims were never verified** (budget 6); two of six
  verifiers came back PARTIALLY-BROKEN.
- **The attach offsets come from ONE routine.** Only the shield and the weapon
  carry one; fifteen pieces attach at the limb origin. If a piece looks
  misplaced, re-check that first.
- **`death:slain`, `death:yield`, `death:arrow`, `death:grievous` map to no
  clip** and fall back to `death1`. Only `death:taunt` is derived.
- **Every asset number came from ONE install.**

## Hard rules

- **A GREEN SUITE IS NOT COVERAGE.** Two mutants survived in code no test
  executed, and the test that looked like coverage asserted the DATA TABLE the
  rule is derived from rather than the rule.
- **`grep` IS NOT A GATE.** I committed on `fail 2` because grep succeeds when
  it MATCHES. Use the exit code.
- **Do not reach for `git add -A` while agents are running.** It staged
  seventeen worktree gitlinks and I pushed them.
- **`ids 1..24` is a MIN AND A MAX, not a range.** Five absent `features` ids
  became a ranked open question that way; the build only ever had nineteen.
- **An empty slot may mean you are looking at the wrong slot.**
- **Every backtick inside `previewHtml` is live** — it has broken that file
  twice.
- **Prefer "I looked here and it is not here" to a mapping that fits.** The
  enchantment has four labels and four plausible numbers, and the honest answer
  is still that the selector has not been found.
- **LOOK AT IT**, and **`--host 0.0.0.0`, never `127.0.0.1`**: WSL localhost
  forwarding here is INTERMITTENT.
- **Ship no SS2 asset.** `assets/` is gitignored AND
  `test/asset-attestation.test.js` fails if anything under it is tracked.
- **Push a feature branch without asking**; `main`/`master` and every force flag
  stay DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
