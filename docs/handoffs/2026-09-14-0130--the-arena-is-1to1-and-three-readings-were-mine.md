---
handoff:      2026-09-14-0130--the-arena-is-1to1-and-three-readings-were-mine
written:      2026-09-14 01:30 -0400
sessionId:    b4ca2b15-791c-4a4f-bc62-ef21baf9e095 (https://claude.ai/code/session_011q5EGZx2wrjBBFpiGHRB6v)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      de54749..HEAD. **Re-measure; never copy.**
suite:        1189 / 1188 / 0 / 1 (fresh-clone profile), measured after
              `36c36e2` BY EXIT CODE. **Re-measure; never copy.**
agentRuns:    none. ADR 0001 caps fan-out and the owner was at 11% of a weekly
              budget; every finding below is a serial read of the oracle.
supersedes:   2026-09-13-2130--ranged-is-built-and-the-guard-had-a-hole, whose
              ranked items 4 (arena scenery), 5 (clip effects) and 6
              (enchantment selector) are all now closed or answered.
next:         **DRAW THE BACKDROP. Everything it needed is derived and nothing
              is drawn.** See "The arena is 1:1" below.
---
# Handoff — the arena is 1:1, and three wrong readings were mine

## The one-sentence version

Blood, sparks, the arena's edges and the enchantment selector are all derived
and mostly built; the arena's backdrop is measured down to its ground line and
is the one thing still undrawn.

## THE ARENA IS 1:1, and this is the whole of what the next session needs

Root frame 221 places SIX objects and then runs 488 instructions that fill one
of them. Every transform on that frame is 1.00.

```text
  stage                   640 x 420
  arena origin            (320, 167)      char 2249, unscaled
  THE GROUND LINE         stage y 367     = 167 + the fighters' _y of 200
  a fighter at _x ±250    stage x 70, 570
  the rocks at _x ±2160   far off stage — the arena PANS

  depth    1  char  643   640 x 420 px    THE BACKDROP, the stage to the pixel
  depth    3  char 1729  8417 x 1032 px   the crowd, 200 frames
  depth   59  char 2249 24177 x 2489 px   `_root.arena`, which the script fills
  depth  438  char 1531  1919 x  210 px   a UI bar
  depth 1193  char  646   732 x  505 px   the frame/border
```

**One arena unit is one stage pixel.** The ground line — the unknown I said
would put gladiators in the sky if guessed — is 200 in the gladiators' own
space, which is `SS2_ARENA.frontY`, which this engine already had.
`extract-props.mjs` takes `backdrop` and `crowd` (frame 1 of each). **Nothing
draws them.** That is ranked item 1 and it is now a rendering job, not a
derivation.

## THREE WRONG READINGS, ALL MINE, ALL CAUGHT

► **"root frame 221's display list is EMPTY".** `resolveTimeline` returns one
  entry per frame OF THE TIMELINE, not per frame requested — so `frames[0]` was
  frame 1 (null, unasked-for) and not frame 221. I committed it to the map and
  the head and built two conclusions on it. **Asking for any two frames and
  noticing both were empty would have caught it.**
► **"the build never assigns `bullet._rotation`".** It assigns it at three
  sites, inside the bullet's own `onEnterFrame`, past where my read stopped. I
  had invented a velocity-vector pitch; the build TUMBLES a bombard ~4 degrees a
  frame (clamped 170) and holds a snipe at ±90, which exists because the art is
  VERTICAL.
► **"snipe is never AI-chosen, and it needs an owner decision".** The policy was
  already right: snipe's chance is clamped at 99, it overtakes bombard at foe
  defence ~20, and the demo roster has defence 5. I measured one roster and
  generalised — three times.

**And a fourth, smaller:** blood counts of 3/6/9/15 are DEPTH OFFSETS, not drop
counts. Every hit sprays five. `hurt8`'s "blood anomaly" was that misreading;
its only real oddity is that it is the one hurt label with no sound.

## WHAT IS BUILT AND PLAYING

- **Blood and sparks**, from `bounceitem`: a real bouncing particle system,
  gravity 2 (the same 2 the arrow falls under), friction 0.1, 25-frame life.
  **ARMOUR STRIKES SPARKS AND FLESH BLEEDS** — the build branches on
  `armourclass > 0`, which this engine already models.
- **The arena's two edges**, `rockMC` at `_x ±2160`, `_y 210` — sixty units
  outside `SS2_ARENA.clamp` of ±2100, **which was derived from `nextphase` weeks
  earlier**. Two independent readings agreeing about where the arena stops.
- **The arrow**, with the build's own ballistic, rotation, five arrows (bows
  61-64 are SLINGS and throw stones), and a phase that waits for it.

► **A TRAP WORTH KEEPING: the rocks need NO coordinate conversion and the blood
  DOES.** The difference is which object `attachMovie` is called on —
  `arena.gladiators` for the rocks, the fighter CLIP for the blood. One register
  apart in the bytecode. The clip's origin is the soles of the feet and its head
  is at -220, so `clipToArenaScale` converts; the rocks are already in arena
  units. **Check which object, do not assume.**

## THE ENCHANTMENT SELECTOR IS FOUND, and it opened a better question

`skincharacter` calls `itemglow(weapon, enchant_type, enchant_potency)`
(`+0x1b16`), defined at `root/frame:35/DoAction@0x3fa76f` `+0x0011`:

```text
  frame = (potency - 2) * 3 + type + 1,  and 1 below potency 2
  flame 2-4    frost 5-7    poison 8-10    wraith 11-13
```

**The standing note read those four labels as four TYPES and they are four
POTENCIES.** But `damagecharacter` keys the CONDITION on *type*, values 2-5, and
those four line up with the same four labels. **Both readings are byte-verified
and this is NOT resolved.** Either the two fields carry the same number on every
reachable gladiator, or art and effect disagree for some loadouts, or one is a
build defect. **Only a capture of a gladiator with a known enchantment settles
it** — both fields are written in the shop and neither has been observed at
runtime.

## Highest-value work, ranked

1. **DRAW THE BACKDROP AND THE CROWD.** Extracted, measured, 1:1, ground line
   known. `viewportFor` is twenty lines with two live defects in its history —
   the owner's decision is that the backdrop sets the scale, and it now can.
2. **LOOK AT IT.** Blood, sparks, arrows and rocks all landed tonight and
   nobody has seen any of them move. Every defect the owner found this week came
   from exactly this.
3. **Re-run the mutation audit.** A great deal of render code landed tonight.
4. **A capture with a known enchantment**, which settles the `itemglow` tension
   above and nothing else does.
5. **The thirteen `defend*` animations** nothing plays, still unbuilt.

## Hard rules

- **A GREEN SUITE IS NOT COVERAGE**, and a silent no-blood looks exactly like a
  correct bout — that one shipped into the shell tonight and a test caught it.
- **`grep` IS NOT A GATE.** Use the exit code.
- **Check which object an `attachMovie` is called on** before assuming a
  coordinate space.
- **One sample is not a measurement**: one frame index, one roster, one read.
  All three of tonight's wrong readings were that.
- **LOOK AT IT**, and **`--host 0.0.0.0`, never `127.0.0.1`**.
- **Ship no SS2 asset.** `assets/` is gitignored AND
  `test/asset-attestation.test.js` fails if anything under it is tracked.
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
