---
handoff:      2026-09-11-2115--both-halves-of-position-are-built
written:      2026-09-11 21:15 -0400
sessionId:    1a8d94aa-4015-4d92-a894-357a1ad7fdae (https://claude.ai/code/session_01EcvzwQKheXCySdMC3qY8iH)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
suite:        911 / 910 / 0 / 1 (fresh-clone profile), measured after `567eb41`
              and BEFORE this handoff. **Re-measure; never copy.**
supersedes:   2026-09-11-1830--a-walking-gladiator-has-a-clip-to-play, written
              MID-session by this same session. Its ranked item 3 — position in
              the resolver — is DONE, and its "the resolver half must add
              `vanillaLabel`" is done too.
---
# Handoff — both halves of position are built

## The one-sentence version

Gladiators now stand somewhere and must walk to reach each other: the
presentation half landed in `3a8638b` and the resolver half in `567eb41`, both
derived from the map rather than from the preserved patch — **and the thing
that needs a decision is not a defect, it is that 53% of a 3v3 is now walking.**

## What is built

**Presentation (`3a8638b`).** `CommandKind.MOVE_CLIP` carrying `from` and `to`
and nothing else; a movement case in `SS2_STATIC_MAP_BINDINGS` at `ASSUMED`
provenance; four gait schedules and `travelAt` in `src/render/timeline.js`. Two
decisions also left the browser shell — `figureXAt` and `timelinesForStep` —
because the shell is the one part of the renderer the suite cannot reach.

**Resolver (`567eb41`).** `x` on the combatant and inside `combatStateHash`;
`EffectKind.POSITION`, absolute; `SS2_ARENA`; a `startingPosition` hook;
`walk-left`/`walk-right`; the build's controller gate; an AI that closes.

**`docs/reference/position-in-the-resolver.patch.md` IS NOW SUPERSEDED.** Read
it as history. Three places the built version deliberately differs from it:

1. **`movement_speed` is NOT a resource.** The map's persistence table lists it
   among the fields "recomputed unconditionally", so it is a `battlevalues`
   output, and `agility` is already projected — it is computed at resolve time.
   One wire-vocabulary change in that commit (`x`), not two.
2. **The walks are ordered LEFT then RIGHT**, not away-then-toward. All eight
   rows of the map's controller table put `walkleft` at `optionB` and
   `walkright` at `optionE`, in BOTH facings. The patch's ordering was invented.
3. **The walk event carries `vanillaLabel`** — the field the presentation half
   cannot derive, because `from`/`to` give the direction and never the gait.

## THE DECISION THIS LEAVES THE OWNER

**Measured at landing, 40 AI-driven seeds a side:**

| | actions before first attack | walks | total actions | settled |
| --- | ---: | ---: | ---: | ---: |
| 1v1 | 11.0 | 10.0 | 27.1 | 40/40 |
| 2v2 | 23.0 | 26.0 | 55.6 | 40/40 |
| 3v3 | 35.0 | 48.0 | 91.0 | 40/40 |

Every bout settles, so this is **pacing, not correctness**. Five walks a side at
1v1 independently reproduces the archive's own figure, so the fidelity is good.
But more than half of a 3v3 is now approach, and in a multiplayer game that is a
lot of dead turns.

**The levers are `SS2_ARENA.frontX` and `SS2_ARENA.walkDistance`.**
**`weapon_range` is NOT a lever** — a real weapon saves about one walk, because
the 500-against-44 ratio dominates. Do not reach for the reach.

## Highest-value work, ranked

1. **OWNER, UNCHANGED AND STILL THE CHEAPEST QUESTION ON THE BOARD: read the six
   `weaponweights` values at `+0x3dd4` off the installed build.** It decides
   whether every swing cost in the engine is backwards. No capture, no staging,
   no Ruffle — only the licensed SWF. `tools/item-table-transcription.mjs`
   already reads the ninety weapon literals out of the same action block BY
   SHAPE.
2. **OWNER: `/codex:adversarial-review` on `3a8638b` and `567eb41` together.**
   The living head named the movement work as the case for it while it was
   still ranked, and the second commit is a PROTOCOL change — `x` is in
   `combatStateHash` and every peer hash moved. The command is
   `disable-model-invocation: true`, so **a session cannot run it; it is yours
   to type.** Three mutations survived the first version of these tests across
   the two commits, which is the argument for it rather than against.
3. **OWNER: the pacing decision above.** A session can implement whatever is
   chosen in minutes; nobody but the owner can decide what the game should feel
   like.
4. **THE 3v3 POSITIONAL LAYER is now unblocked** — it was ranked behind both
   halves and both are built. Re-run the panel rather than reusing the merged
   design in `wf_69080348-f15`'s run journal: all four of its designs were
   argued against the economy that D1/D2 have since changed, and its judge made
   a claim about the shop gate that re-derivation refuted.
5. **Re-run the `SS2_CROWD` and `SS2_SWING` searches.** Both are downstream of
   distributions that movement has just changed: a bout is now roughly three
   times longer in actions, and `patience` is a pure function of `turnNumber`.
   **This one is genuinely urgent** — the crowd toll was tuned against bouts of
   ~27 actions and a 3v3 now runs 91.
6. **CAPTURE BREADTH** — 37 of 60 candidates with no golden. Owner's lane.

## What is NOT verified

- **`SS2_ARENA.walkDistance` is AUTHORED and now load-bearing.** 44 comes from
  one uncited line in a frozen handoff and survives only a consistency check. It
  was a curiosity when nothing moved; it now sets the pace of every bout.
  `MAP_SILENCE.movement-displacement` carries the measurement that would settle
  it **with no new capture**, and it is worth more than it was.
- **`SS2_ARENA.allyStride` is authored** and always was (vanilla has no second
  ally).
- **The four gait schedules are authored**, and the map is more silent about
  movement than about the conditions: one unnamed frame range for all eight
  phases.
- **That the eight phase names are also clip labels is an assumption.**
- **`ss2Reach` narrows the build**: it returns the UNARMED reach for everyone,
  because the weapon id is outside the projected vocabulary. Conservative in
  the direction that matters — nobody swings from outside the build's range —
  but it is a narrowing, not a derivation.
- **Nothing about 3v3 positioning is built.** Allies stand in a line and
  nothing uses that.

## Three mistakes this session made, all caught before shipping

1. **A `travelAt` test pinned only the midpoint, and a smoothstep mutation
   survived the whole suite** — 0.5 is a fixed point of every symmetric ease.
2. **A `figureXAt` test sampled travel only where `advance` is already 0**, so
   "travel also lunges" survived: two tests were jointly forbidding the bug and
   neither pinned the contract.
3. **Removing the read-back position drop survived everything**, because the
   hotseat fix had made the CLI independent of it and took the only coverage
   with it. Now pinned directly.

**The general lesson, and it is the one worth carrying: a mutation that
survives because ANOTHER fix removed the dependency is invisible to reading.**

## Hard rules (unchanged)

- **Derive candidates from the map, never from a capture.**
- **An agent FINDS; the main session RE-DERIVES.**
- **A wave's brief is a snapshot.**
- **Say what a wave will spawn BEFORE launching it.**
- **Ask before every push.** `main` stays denied outright.
- **A handoff commit is not finished until `node --test --test-concurrency=1`
  is green, and its suite and push lines must be measured AFTER that commit.**
