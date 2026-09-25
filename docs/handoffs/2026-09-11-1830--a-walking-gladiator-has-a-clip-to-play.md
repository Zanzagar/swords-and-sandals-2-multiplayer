---
handoff:      2026-09-11-1830--a-walking-gladiator-has-a-clip-to-play
written:      2026-09-11 18:30 -0400
sessionId:    1a8d94aa-4015-4d92-a894-357a1ad7fdae (https://claude.ai/code/session_01EcvzwQKheXCySdMC3qY8iH)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
suite:        894 / 893 / 0 / 1 (fresh-clone profile), measured after the code
              commit `3a8638b` and BEFORE this handoff. **Re-measure; never
              copy.**
supersedes:   2026-09-10-2244--the-economy-was-the-cheese. Its ranked item 3 —
              presentation before position — is DONE. Item 1 (weaponweights) is
              still the owner's and still the cheapest question on the board.
---
# Handoff — a walking gladiator has a clip to play

## The one-sentence version

Ranked item 3 is closed: the presentation stream has a movement command, the
SS2 bindings have a movement case, and the renderer has four gait schedules —
so the resolver half can now land without a walking gladiator playing the idle
clip. **Nothing emits a `move-clip` yet, and that is the point.**

## What landed (`3a8638b`)

- **`CommandKind.MOVE_CLIP`**, carrying `from` and `to` and nothing else. It is
  **not** a partial `place-clip`: `scene.js` folds that one by overwriting all
  seven geometry fields, so a partial command sets `y` to `undefined` and
  `toY(undefined)` is NaN — the figure vanishes rather than moving. No
  `distance` (two endpoints already say how far the step went, and a third
  field that could disagree is a second source of truth) and no `facing`
  (vanilla walks backwards without turning round).
- **A movement case in `SS2_STATIC_MAP_BINDINGS` at `ASSUMED` provenance**,
  detected by the event's own geometry rather than by parsing the type string.
  The map gives movement as the unnamed frame range "movement and charge
  (33-104)" while naming `Standing`, `Block`, `rest` and `knockback` one by
  one, so the phase-name-is-clip-label step is an assumption and is marked as
  one.
- **Four gait schedules and `travelAt`** in `src/render/timeline.js`.
  `timelineFor()` returned `unknown` for all eight movement labels before this;
  re-derived at the start of the session rather than taken from the brief.
- **Geometry is not a label decision.** An event the bindings cannot name still
  emits its `move-clip`, so the scene never draws a figure standing where the
  resolver says it is not.

Two decisions moved OUT of `tools/arena/main.js` — the one part of the renderer
the suite cannot reach — for the same reason `animationCursor` left it:
`figureXAt` (lunge or travel, and `ADVANCE_UNITS` with it) and
`timelinesForStep` (which timelines a batch starts, and the pairing of a
travelling gait with its OWN `move-clip`). **`test/render-arena-host.test.js`
had re-implemented that second one**, so the test and the shell were two
implementations of one decision that could agree with each other while both
disagreeing with what a person would see. Both now call the same function.

## THE ONE THING THE RESOLVER HALF MUST ADD

**`vanillaLabel` on the movement event.** The preserved patch at
`docs/reference/position-in-the-resolver.patch.md` emits `{type, actorId,
targetId, from, to, distance, staminaGained, healed}` and no label. The GAIT is
not derivable from the geometry — `to < from` gives the direction, nothing
separates a walk from a charge — so an event without it is REPORTED rather than
given a guessed walk. `VANILLA_PHASE_LABEL` in that patch already maps
`walk-left` to `walkleft`; carrying it onto the event is the whole change.

## Three of my own mistakes, all caught before shipping

1. **`travelAt`'s first test pinned only the midpoint, and a mutation replacing
   the linear run with a smoothstep SURVIVED the whole suite.** 0.5 is a fixed
   point of every symmetric ease, so the one sample that reads like the obvious
   one is the one sample that proves nothing. Now asserted off-centre.
2. **`figureXAt`'s travel branch was only sampled where `advance` is already
   0**, so "travel also lunges" survived too. Two tests were jointly forbidding
   the bug — one saying gaits never lunge, the other saying travel ignores
   `restingX` — and neither pinned the contract a future gait author would rely
   on. Now asserted with a lunging pose on a travelling schedule.
3. **Hoisting `layout.placementFor` above the binding check** turned an unbound
   event naming an unknown actor from an `unmapped` record into a thrown
   `SlotLayoutError`. Caught by reading the diff, not by the suite; the lookup
   moved inside `movementFor` and the old behaviour is pinned now.

**12 mutations were applied one at a time and every one is caught by the
intended test.** Two survived the first version, which is points 1 and 2 above.

## Highest-value work, ranked

1. **OWNER, UNCHANGED AND STILL THE CHEAPEST QUESTION ON THE BOARD: read the
   six `weaponweights` values at `+0x3dd4` off the installed build.** It decides
   whether every swing cost in the engine is backwards. No capture, no staging,
   no Ruffle — only the licensed SWF. `tools/item-table-transcription.mjs`
   already reads the ninety weapon literals out of the same action block BY
   SHAPE, so extending it is the route.
2. **OWNER: `/codex:adversarial-review` on `3a8638b`.** The living head named
   this diff as the case for it while the work was still ranked. The command is
   `disable-model-invocation: true`, so **a session cannot run it** — it is the
   owner's to type. The two surviving mutations above are the argument for it,
   not against it.
3. **POSITION IN THE RESOLVER — now unblocked and the top buildable item.**
   `docs/reference/position-in-the-resolver.patch.md`, written against `2c047b9`
   and UNBUILT; read it, do not apply it blind. Add `vanillaLabel` to the
   movement event, and re-derive the `ss2-rules.js` hunks — the crowd toll and
   the swing cost both landed in that file since the patch was written. Its own
   "things it gets wrong that a rebuild should not repeat" list still stands.
4. **THEN the 3v3 positional layer** — and re-run the panel, because the four
   designs it produced were all argued against the broken economy. Treat the
   merged design in `wf_69080348-f15`'s run journal as claims.
5. **Re-run the `SS2_CROWD` and `SS2_SWING` searches whenever the economy
   moves.**
6. **CAPTURE BREADTH** — 37 of 60 candidates with no golden. Owner's lane.

## What is NOT verified

- **No `move-clip` has ever been produced by a real bout**, because the resolver
  models no position. Every movement event in the tests is hand-written; the
  COMMANDS are not, and the assertions should survive the swap.
- **Every gait schedule is authored**, and the map is more silent here than it
  is about the conditions: one unnamed frame range for all eight phases. The
  four gaits are a presentation choice, not a reading of the build.
- **That the eight phase names are also clip labels is an assumption**, the same
  one the death variants and the condition flags already carry.
- **`MAP_SILENCE.movement-displacement` is still open.** Its `adapterBehaviour`
  is corrected at its own sentence: the presentation half exists, nothing moves,
  and the displacement is still unsettled. The presentation half needs no
  displacement at all — a `move-clip` reports two coordinates the resolver
  computed rather than a distance the renderer applies.
- **Everything the 2026-09-10 handoff lists as unverified is still unverified.**

## Hard rules (unchanged)

- **Derive candidates from the map, never from a capture.**
- **An agent FINDS; the main session RE-DERIVES.**
- **A wave's brief is a snapshot.**
- **Say what a wave will spawn BEFORE launching it.**
- **Ask before every push.** `main` stays denied outright.
- **A handoff commit is not finished until `node --test --test-concurrency=1`
  is green, and its suite and push lines must be measured AFTER that commit.**
