---
handoff:      2026-09-15-0400--the-filters-land-and-the-sky-has-a-clock
written:      2026-09-15 04:00 -0400
sessionId:    b0bd5c51-edb6-460a-893e-dfcabc590319
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      2281ef4..HEAD — SIX commits, all pushed, **0 unpushed measured
              AFTER this handoff commit**. **Re-measure; never copy.**
suite:        1803 / 1802 / 0 fail / 1 skipped, EXIT 0, **measured AFTER this
              handoff commit.** **Re-measure BY EXIT CODE.** It moved
              1651 -> 1712 -> 1739 -> 1740 -> 1803 across three waves and two
              serial passes. `fail == 0` and the exit code are the gate; the
              total is not.
agentRuns:    THREE waves this session, 34 agents, 0 dead, 0 ownership
              violations. Wave 3: 2 modules + 3 painters + 5 verifiers, 10/10.
              **Eighteen verifier verdicts across the session: 1 CONFIRMED,
              15 PARTIALLY-BROKEN, 2 BROKEN.**
supersedes:   2026-09-15-0046--the-tint-landed-and-the-trail-vanished, whose
              ranked item 1 is DONE for shapes and text and whose items 2, 3, 4
              and 5 are all still open.
next:         **THE FIGURE AND ICON EXTRACTORS READ NO FILTERS AT ALL, AND ONE
              OF THE THINGS THEY ARE DROPPING IS THE ELEMENTAL WEAPON GLOW** —
              24 glows on sprite 703 `weapon0`, two on every frame 2..13, where
              the enchantments are flame/frost/poison/wraith at frames 2/5/8/11.
              See ranked item 1.
---
# Handoff — the filters land, and the sky turns out to have a clock

## The one-sentence version

The renderer reads the filters the extractors carry — 248 groups composited
offscreen, one `ctx.filter` per group — and folding the sky's enclosing
ColorMatrix gave it a **day/night cycle it has never had in this engine**.

## THE SKY, WHICH IS THE BEST THING HERE

```text
  frame   1   #440037 -> #79689f    dawn, plum
  frame  60   #2d2dfd -> #5fbefe    midday, cornflower
  frame 200   #000030 -> #3f5f75    night, navy
```

**Before the fold, every frame was the midday blue.** The colour transform alone
moves it a few units; the MATRIX moves it blue → maroon → black. `time_of_day`
is a CLOCK that climbs 1..200 while a battle runs and re-seeks the sky every
1500ms — and the sky did not change colour at all. Now it does, and 112..200
being the night band matches the progression.

► **THE LIVING HEAD WAS RIGHT AND THE CODE WAS WRONG, AND MY BRIEF SPREAD THE
  WRONG ONE.** The living head says the sky's colouring IS a ColorMatrix.
  The 2026-09-14 colour-transform commit wrote *"and not a ColorMatrix"* into
  `src/render/props.js`'s header. **I paraphrased the CODE into an agent brief
  instead of the living head**, telling the agent not to assume a matrix; it
  measured and broke the premise. Struck at both ends. The living head's own
  *"208 of them"* was also wrong — **208 is the BLUR count; there are 150
  matrices, 148 non-identity** — and is corrected in place.
  **When the code and the living head disagree, the living head wins until
  something re-measures. Quoting a source file into a brief is not
  re-measuring.**

## Highest-value work, ranked

1. **`extract-figure.mjs` AND `extract-icons.mjs` READ NO FILTER FIELDS AT ALL,
   AND ONE OF THE CASUALTIES IS THE ELEMENTAL WEAPON GLOW.** Both match ZERO of
   `hasFilters|ancestorEffects|\.filters|blendMode`, and all four packs they
   write (`animations`, `shapes`, `wardrobe`, `icons`) contain no filter key.
   Verified from the oracle by the main session:
   ► **Sprite 703 is `weapon0` and carries 24 glows — two on every frame
     2..13.** This repository records *"THE WEAPON ENCHANTMENT SELECTOR HAS NOT
     BEEN FOUND ... `weapon0` is character 703 with flame/frost/poison/wraith at
     frames 2/5/8/11, the resources exist"*. **The glow IS the enchantment
     visual and it is on exactly those frames.** This does not find the
     SELECTOR — what chooses which enchantment is still open — but it finds the
     art, and says where.
   ► Sprite 1241 `hero_battle` carries a pulsing glow TWEEN at frames
     1614..1643 (strength 2.699 → 0.977 → 2.699). A verifier counted 32 by
     `PlaceObject3` tag; the main session counts 60 frame-instances from the
     cumulative list. **Different units, both defensible — say which you mean.**
   ► This is the props extractor's hole, one extractor over, and the props one
     was only found because something went looking.

2. **A COLOUR-MATRIX-ONLY GROUP IS NOT COMPOSITED AT ALL, AND THAT IS 60% OF
   THE SCREENS' OPERATIONS.** `filterLayersFor` skips any group with no canvas
   filter string before opening an offscreen. Measured twice by two routes:
   **31 of 248 groups, 8210 of 13638 operations (60.2%), and 5 of the 31 have a
   DESCENDANT that does composite** — the inner filter lands and the outer grade
   does not, which is the "innermost wins" picture `screen.js`'s header argues
   against. `townsquare` [59,1] is one: a 1523-operation grade dropped while its
   four nested blurs draw.
   ► Canvas has no arbitrary colour-matrix filter — `colourMatrixFilterString`
     refuses all 636 in the build. **Closing this needs per-pixel
     `getImageData` over each group's offscreen, or an inline SVG `filter`
     reached by `url(#id)`.** Counted and named as
     `groupsMatrixOnlyWithFilteredDescendant` rather than guessed at, because
     inventing a rasteriser in a file no test can reach is how that shell
     produced six live defects.

3. **THERE IS NO BUILD-LEVEL FILTER DENOMINATOR AND THE TWO PACK NUMBERS CANNOT
   BE SUMMED.** Re-derived from the oracle by a verifier: **1,894 filter records
   on 1,507 `PlaceObject3` placements** — glow 853, colourMatrix 636, blur 320,
   bevel 54, dropShadow 31 — partitioning 867 applied / 624 deferred / 346 no-op
   / 57 refused. Everything a reader can reach is per-pack: screens 276, props
   `inheritedFilters` 570 + 2 dropped. **That is 848 of 1,894 — 44.8%** — and
   props dedupes ancestor records by `JSON.stringify` across frames, so 570 is
   not even the same UNIT. **Nothing in the suite re-derives the build
   partition**; point the tools at a modded SWF and every assertion stays green.

4. **"BEVEL, REFUSED, 54 OCCURRENCES" IS A DOCSTRING.** The only denominated
   bevel a reader can reach is **2**, and those 2 are ONE placement seen on two
   cumulative screens. The other 50 live on sprite 1521's frames 2 and 81..129
   and are lost to the nested-sprite frame-1 freeze — **and nothing counts
   filters discarded by that freeze.** `nestedSpriteFrame1` counts SPRITES, not
   what the freeze throws away, so the 50 are invisible even as a number.

5. **RE-RUN THE MUTATION AUDIT. Ranked fifth three times now, still not done**,
   and another ~6,300 lines of render code landed tonight. `src/render/` has
   never had one. `docs/mutation-audit-2026-09-07.md` has the method and two
   traps: a scratch copy without `.git` is not a valid baseline, and
   byte-identical lines must be mutated BY LINE NUMBER.

6. **THE GREEN BAND IS STILL OPEN, AND I NARROWED IT BY GETTING IT WRONG.** See
   the retraction below. Layer extents at `sky=1`, with the placement applied:
   `backdrop 0..420, sky -12.0..207.7, sand 110.0..422.9, crowd 1.2..253.2,
   rain -86.9..507.0, panel 398.4..425.0, border -43.4..461.8`. The band was
   reported at **-75..-45 at `sky=60`** — the sky's top is -12, so it is not the
   sky's main body. `rain` and `border` both cover that range. **Measure at the
   frame it was reported at**; this table is frame 1.

## WHAT I GOT WRONG, IN FULL

► **I COMPUTED THE SKY'S POSITION FROM THE OPERATION MATRICES ALONE**, concluded
  it was drawn 244 px above the stage, called that the green band, and named
  `ty = -4879` as the bug. **All three withdrawn within the hour.**
  `arenaScreenLayersFor` returns a `placement` per layer and the painter
  composes it; `layerPlacementFor` gives the sky `{x: 315.7, y: 216.85,
  scale: 1.04}` from root frame 221 — which the battle map already records. With
  it applied the sky spans stage y **-12.0 .. 207.7**, the upper half, exactly
  where a sky belongs; it is invisible in an arena shot because the crowd and the
  arena clip draw over it, which is their job.
  **This is the pixels-versus-placement seam this repository has recorded three
  times, made a fourth time by the person who wrote the warning into the handoff
  four hours earlier. A partial composition is not a position.**
► **MY OWN COMMIT MESSAGE OVERCLAIMED.** `d229f00` says both shells "composite
  each group through ONE offscreen with ONE `ctx.filter`". True of a group with
  a filter string; silent about the 31 without one. Corrected in `af4086a`, at
  the panel row that stated it worse.
► **I BRIEFED A CAMERA-ZOOM BLUR RADIUS AND A VERIFIER SAYS ASKING FOR IT WOULD
  BREAK 362 OF THE 363 PROPS GROUPS.** Recorded, not acted on — see that
  verdict before implementing it.

## Hard rules

- **WHEN THE CODE AND THE LIVING HEAD DISAGREE, THE LIVING HEAD WINS** until
  something re-measures. A brief that quotes a source file has not re-measured.
- **ASK WHAT YOUR EVIDENCE COULD POSSIBLY VARY OVER.** Three waves and this is
  still the sharpest thing anyone produced. A count over data that cannot change
  is not a check.
- **A WRONG DESCRIPTION OF A KNOWN GAP IS WORSE THAN NO DESCRIPTION** — it tells
  the next reader the gap is smaller than it is.
- **COUNT THE GAP RATHER THAN INVENTING A RASTERISER IN AN UNTESTABLE FILE.**
- **CITE SYMBOLS, NOT LINE NUMBERS.**
- **LOOK AT IT, AT A SIZE WHERE THE THING WOULD BE VISIBLE, THEN READ THE
  PIXELS.** Both shells now carry a kill switch — `?filters=0` on the screens
  page, `?groups=0` on the arena — that reproduces exactly what the page drew
  before. **The difference between two shots is the measurement; one shot proves
  nothing.** Measured this way: `help` pure-white glyph pixels, row 278
  111 → 77, row 306 163 → 135, row 430 42 → 31.
- **NO AGENT LAUNCHES CHROME**; every shot is the main session's, serially,
  after. A decision only a screenshot can check is a decision in the wrong file.
- **NO AGENT REGENERATES `assets/`.** Extractors run into scratch.
- **`cp -r`, NEVER `cp -al`.**
- **DO NOT `git add -A` WHILE AGENTS ARE RUNNING.** Committed by name, with a
  background monitor diffing `git status` against the ownership matrix — 34
  agents, 0 violations.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **STATE A BRIEF'S PREMISES AS NUMBERED HYPOTHESES AND INVITE THEIR
  DESTRUCTION.** Every premise break this session came from having done that,
  including all three of mine above.
- **Ship no SS2 asset.**
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
