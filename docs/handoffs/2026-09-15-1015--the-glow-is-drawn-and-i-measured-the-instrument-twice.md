---
handoff:      2026-09-15-1015--the-glow-is-drawn-and-i-measured-the-instrument-twice
written:      2026-09-15 10:15 -0400
sessionId:    3b712373-df6e-4272-9ec6-783b4ba57b27
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      378e702..HEAD — `076b0fa`, `86eaede`, `9aae536`, `09d5285`,
              `40a06f2`, all pushed. **Re-measure; never copy.**
suite:        1889 / 1888 / 0 fail / 1 skipped, EXIT 0, measured on a quiet tree
              before this handoff commit. **Re-measure BY EXIT CODE after
              yours.** It moved 1803 -> 1843 -> 1845 -> 1879 -> 1889.
              `fail == 0` and the exit code are the gate; the total is not.
agentRuns:    TWO waves, 16 agents, 16 returned, 0 dead, 0 ownership violations.
              **Ten verdicts: 3 CONFIRMED, 5 PARTIALLY-BROKEN, 2 BROKEN. Six of
              my briefed premises broke** — and two more of my own published
              findings broke AFTER the wave, both by my own re-measurement.
supersedes:   2026-09-15-0718--the-glow-is-drawn-and-it-hangs-the-page, **whose
              TITLE IS WRONG AND WHOSE RANKED ITEM 1 IS RETIRED.** Read this
              instead; that file carries a correction section at the top and is
              kept only as the record of how the mistake was made.
next:         **THE FEATURE IS DONE AND MEASURED. The two open items are ranked
              below and NEITHER IS MINE TO DECIDE** — item 1 is a game-design
              call about unbuilt spells, item 2 needs an oracle render this
              session did not set up.
---
# Handoff — the glow is drawn, and I measured the instrument twice

## The one-sentence version

The weapon enchantment is on screen in all four colours, derived from the AVM1
bytes and verified against the render — **and the two things I published as
defects were both measurements of my own instrument rather than of the game.**

## WHAT IS DONE, WITH ITS EVIDENCE

► **THE ENCHANTMENT RENDERS, AND THE COLOURS AGREE WITH THE BYTES.** Two shots
  frozen at the same frame, differenced against `?groups=0`, canvas only:

```text
  type 2  Flame   #ffcc00/#ff0000   R +64.6   G  +5.0   B -15.9   1586 movers
  type 3  Frost   #00ccff/#000099   R -17.1   G  +5.6   B +45.4   1456
  type 4  Poison  #00ff00/#006600   R -19.7   G +37.9   B -20.0   1188
  type 5  Wraith  #cccccc/#000000   R +11.2   G  +7.7   B  +9.0   1042
```

  Each dominant channel is that enchantment's own colour. The ladder that picks
  the frame was read out of `itemglow`'s AVM1 bytes; the colour came out of the
  render; the two never met until this table. **Null control: 0 pixels
  differing, two byte-identical files.** Wraith is the one that would read as
  noise on hue alone, which is why the control matters.

► **THE COST IS ABOUT A MILLISECOND A FRAME PER ENCHANTED FIGHTER.** Free at two
  fighters (6.1ms either way), 11.8ms against 6.1ms at six — 85 fps. See the
  retraction below for the number I published before this one.

► `tools/shot-live.mjs` / `tools/shot-live.sh` — real-time screenshots over CDP,
  frozen at a frame number, browser killed in a `finally`. **Reach for this, not
  `tools/shot.sh`, for anything that composites a filter.**

## TWO RETRACTIONS, BOTH MINE, BOTH THE SAME SHAPE

► **"IT HANGS A HEADLESS RENDER, CAUSE NOT FOUND."** It does not hang. What
  stalls is `--virtual-time-budget`, which is what `tools/shot.sh` drives Chrome
  with and which does not advance while a filtered composite is outstanding. My
  evidence was that the wall time did not move with the budget — a real
  observation, and the inference from it was a fact about the SCREENSHOT MODE.
  **A `FAILED` from `tools/shot.sh` is evidence about the instrument.**

► **"SO IT IS A 3.9x FRAME COST, REAL AND WORTH REDUCING."** That was measured
  under `--disable-gpu`. Varying only that flag:

```text
                        no glow   with glow          2 fighters    6 fighters
    --disable-gpu       16.6 ms     64.5 ms  3.9x
    GPU rasterisation    6.1 ms      6.1 ms  free    6.1 -> 6.1    6.1 -> 11.8
```

► **THE LESSON, WHICH ARRIVED TWICE IN AN HOUR.** First I measured the
  screenshot mode and reported it as a property of the page; then I measured the
  rasteriser and reported it as a property of the feature. **Both numbers were
  real and both subjects were wrong.** This file's standing rule — ask what your
  evidence could vary over — applies to the CONFIGURATION a measurement was
  taken in, not only to the data it ranged over. **When something looks like a
  defect in the thing you just built, measure the instrument before you measure
  the world.**

► **AND A THIRD, FROM THE WAVE: I BRIEFED A WRONG SCOPE AND AN AGENT BUILT IT
  FAITHFULLY.** I wrote that the glow "encloses the attached blade and not the
  `weapon` limb's own rig art either". Char 701 sits at depth `[39, 1, 1]` on
  all 2,216 such placements — INSIDE the `realweapon` placement that wears the
  filter. The faithful scope is the union, 19 ops not 8. **And the test that
  should have caught my correction could not: its fixture's only body placement
  was on `torso`, so both scopes passed it.**

## Highest-value work, ranked — and neither is mine to decide

1. **THE TWELVE GROUPS IN THE FIGURE PACK REACH NO GLADIATOR, AND MAKING THEM
   REACHABLE IS A GAME-DESIGN CALL.** All 12 group entries and 30 grouped
   placements sit on `psyche_up`, `psyche_up2`, `psyche_charging` and
   `psyche_charging2`; all four are declared unplayed in
   `src/render/clip-labels.js` under `unbuiltSpells` and `continuations`. Swept
   44,880 and 73,440 family x label x facing combinations: reached 0 times.
   **These are SPELL animations for spells this engine has not built**, so
   dispatching them means deciding what the spell IS — a scope question for the
   owner, not a rendering one. Pinned by a test, so building the family turns
   the suite red and forces the paragraph to be rewritten rather than outlived.

2. **THE STRENGTH HALF OF EVERY GLOW IS CARRIED AND NOT DRAWN, AND CLOSING IT
   NEEDS AN ORACLE THIS SESSION DID NOT SET UP.** `rgbaOf` clamps alpha to
   [0,1] and alpha is `colour.alpha/255 * strength`, so every strength at or
   above the clamp emits `1` — the figure pack reads **23 saturated / 1 scaled**
   and all 24 enchantment filters saturate. Counted now as
   `shadowStrengthSaturated`, apart from `shadowStrengthAsAlpha`.
   ► **DO NOT JUST REPEAT THE `drop-shadow` UNTIL IT LOOKS RIGHT.** Flash's
     strength re-multiplies the blurred alpha and clamps, so the visible
     difference is the glow's FALLOFF, not its peak — and "looks right" against
     no reference is authoring an approximation and calling it a measurement.
     **Render `weapon0` frame 5 under Ruffle and compare.** That is the only
     honest close, and it is a session's work to set up.

3. **RE-RUN THE MUTATION AUDIT.** Ranked fifth three times and fourth once;
   ~6,600 lines of render and extractor code landed across the two waves.
   Everything mutation-checked this session was checked BY HAND, one at a time.

4. **THE GREEN BAND IS STILL OPEN.** Unchanged; measure at the frame it was
   reported at.

## Hard rules

- **MEASURE THE INSTRUMENT BEFORE THE WORLD** when the defect is in something
  you just built. Two of this session's three retractions were instrument
  measurements published as findings.
- **A FRAME COUNT IS NOT DETERMINISM ON A PAGE THAT ANIMATES ON ELAPSED TIME.**
  `tools/shot-live.mjs` pins `performance.now`/`Date.now` to the frame number;
  without it the same pair differenced to 9,900 pixels at B +5.1, with it 2,822
  at B +45.4, and the rest was the weapon having moved. **"The difference
  between two shots is the measurement" assumes the two shots are otherwise
  identical.**
- **ALWAYS TAKE A NULL CONTROL.** Two shots of one URL must difference to zero,
  or nothing else you difference means anything.
- **`tools/shot.sh` LEAKS A CHROME PROCESS PER INVOCATION — 73 were alive**, and
  past some point new ones cannot start, so URLs that worked minutes earlier
  fail. It masked a real finding for half an hour.
  `powershell.exe -NoProfile -Command "Stop-Process -Name chrome -Force"`.
  `tools/shot-live.sh` kills its own.
- **A FIXTURE THAT LACKS THE DISCRIMINATING INPUT TURNS AN ASSERTION INTO
  DECORATION.**
- **A COUNTER THAT ONLY EVER SEES ZERO IS NOT A COUNTER** — four mutants
  survived in `figureEffectCensusOf` for exactly that reason.
- **COUNT WHAT THE INSTRUMENT NEVER LOOKED AT, not only what it dropped.**
- **STATE A BRIEF'S PREMISES AS NUMBERED HYPOTHESES AND INVITE THEIR
  DESTRUCTION.** Six broke across two waves; every one outranked its task.
- **AGREEMENT BETWEEN AGENTS GIVEN ONE BRIEF IS WEAK EVIDENCE.**
- **GIVE EACH WAVE AGENT A PRIVATE SCRATCH SUBDIRECTORY** — they share one
  directory and clobber each other by filename, silently.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES CHROME OR RUFFLE, OR REGENERATES `assets/`.**
- **Ship no SS2 asset.**
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
