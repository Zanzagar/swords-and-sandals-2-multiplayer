---
handoff:      2026-09-15-2130--the-rasteriser-moves-a-sixth-of-the-arena
written:      2026-09-15 21:30 -0400
sessionId:    79ae298f-54e8-4964-9c3b-65d33f2bb1b0
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      `07ad7a8..HEAD` — `1706188` (the rasteriser argument, the stage-fit
              report) plus this line's own commit. **Re-measure; never copy.**
suite:        **Re-measure BY EXIT CODE after your own commit.** 1909 / fail 0 /
              skipped 1 here — 9 tests added, none removed. `fail == 0` and the
              exit code are the gate; the total is not.
agentRuns:    NONE this stretch. The 19:00 wave's findings are already in the
              living head; everything here is a render taken serially by the
              main session, which is the only thing allowed to take one.
next:         **RANKED BELOW.** Items 1 and 2 remain the owner's and are
              untouched. The GPU dither band is new and is mine to have left
              open.
---
# Handoff — the rasteriser moves a sixth of the arena

## The one-sentence version

Every pixel count this project has ever published was measured with
`--disable-gpu` and nothing recorded it; **varying that one flag moves 15.9% of
the arena frame** — and the fractional-clip finding closed at 19:00 survives the
check, which is what the check was for.

## WHAT IS DONE, WITH ITS EVIDENCE

► **THE RASTERISER IS AN ARGUMENT, NOT A CONSTANT.** `tools/shot-live.mjs` takes
  `cpu` (the default and the old behaviour) or `gpu` as its eighth argument and
  **refuses anything else BY NAME** — a typo silently selecting software
  rasterisation is exactly how the weapon glow's "3.9x frame cost" came to be
  published as a property of the feature. `chromeFlagsFor` is a pure exported
  function, so the suite reaches the one decision on this route that has ever
  changed a measurement, and it asserts the two flag lists **differ by
  `--disable-gpu` and nothing else** — two shots are a measurement only if that
  holds. The rasteriser is printed on the output line because it cannot be
  recovered from the PNG.

► **AND IT IS WORTH 15.9% OF THE FRAME.** Same URL, same frame, same window,
  varying only that flag:

```text
    arena, whole page      152,530 px differ (15.9%)   max delta 105
      inside the canvas    133,568 (20.3% of it), bbox = exactly the stage
      the sidebar alone     16,607
    each rasteriser against itself     0 px, byte-identical
```

  **So two shots taken under different rasterisers are not comparable at all**,
  and until now nothing said which one a shot used. Both are internally
  deterministic, which is what makes the comparison legitimate.

► **IT IS A DIFFERENT PHENOMENON FROM THE CLIP RESIDUAL, AND THE SIGNATURE SAYS
  SO.** 15.5% of the movers sit on a strong local gradient against **99.8%** for
  the clip residual, and they cover a third of the stage rather than 644 scattered
  pixels. That is bitmap resampling and gradient dither, not antialiasing.
  ► **WHICH IS ALSO THE ANSWER TO THE 19:00 VERIFIER'S OBJECTION.** It said the
    edge statistic was corroborating rather than diagnostic — true — and here is
    a second phenomenon in the same frame that the same statistic separates
    cleanly. The statistic does not identify a cause; it does distinguish these
    two.

► **THE FRACTIONAL-CLIP FINDING SURVIVES THE CHECK, WHICH IS WHAT RANKED ITEM 3
  ACTUALLY ASKED.** `tools/clip-probe/index.html` shot under both rasterisers
  gives **every number identical** — 2,548 centre pixels for every fractional
  rectangle and 0 for every whole one — and the probe's own canvas differences to
  **0 pixels** between the two. So the residual `stageClipRectFor`'s snap removed
  was never an artefact of the measuring configuration. (The probe gained a
  one-line `requestAnimationFrame` tick so `shot-live` can shoot it at all: that
  tool freezes at a frame number and refuses a page that never reaches one.)

► **THE ARENA REPORTS ITS OWN RECTANGLE NOW, AND IT IS A VALUE RATHER THAN A LOG
  LINE.** `stageFitReportFor` returns the canvas, the CSS rect, the ratio, the
  stage in DEVICE and PAGE pixels and all four letterbox bars, **calling
  `stageFitFor` and `stageClipRectFor` rather than re-typing them** — which is
  what its test asserts, because a report that re-typed the arithmetic would
  agree on the day it was written and drift afterwards. `render` hangs it on
  `window.__stageFit` every frame; `tools/shot-live.mjs` reads it back with one
  `Runtime.evaluate` and prints it beside every shot.

► **IT CORRECTED ME ON ITS FIRST RUN, WHICH IS THE BEST ARGUMENT FOR IT.** I had
  derived the canvas as 870x688 from the letterbox bars and its top as page y 98.
  It is **870x800** and starts at **y 43**. **Two errors that nearly cancelled** —
  my derived stage top came out 156.5 against a true 158 — so the 19:00 numbers
  stand (the interior filter is 20px and the error was 1.5) and **the rectangle
  they were measured over was wrong**. Every "inside the stage" figure this
  project has published was computed over a rectangle nobody had asked the page
  for.

## Known, measured, unexplained

► **UNDER `gpu` THE SNAPPED CLIP STILL MOVES 654 PIXELS, EVERY ONE AT DELTA 1.**
  Clipped against `?clip=0`, 20px or more inside every clip edge, rows 177..434 —
  **the sky and crowd band, not the fighters** — 417 columns, 74 rows, and the
  delta histogram is a single entry: `1:654`. Under `cpu` the same pair is 0.
  **All-delta-1 over a gradient is a dither difference, not the antialiasing
  mechanism closed at 19:00**, and the GPU null control is 0, so it is
  clip-related rather than noise. I have not identified it and I am not rounding
  it to zero.
  The cheapest next step is the one this session just built the tool for: put a
  gradient into `tools/clip-probe/index.html` and shoot it under `gpu`. The page
  already varies the rectangle and reports its own pixels; a gradient band is one
  more `drawContent` call and would say in one render whether this is the same
  question with a different rasteriser or a new one.

## Highest-value work, ranked

1. **RE-SHOOT THE PROBES UNDER ADOBE'S PLAYER IF YOU EVER HAVE ONE — unchanged
   and still the owner's.** Every "what a faithful Flash player draws" number
   rests on Ruffle being one.

2. **THE TWELVE GROUPS IN THE FIGURE PACK REACH NO GLADIATOR — still the
   owner's, untouched.** Making them reachable means deciding what those four
   unplayed spells ARE.

3. **THE GPU DITHER BAND ABOVE.** One `drawContent` call in a page that already
   exists.

4. **`tools/shot.sh` STILL HARDCODES `--disable-gpu` AND NOW DISAGREES WITH ITS
   SIBLING.** `shot-live` takes the flag as an argument and `shot.sh` does not,
   so the two tools no longer shoot the same browser and neither says so in its
   output. It is the older tool and the one whose `--virtual-time-budget` cannot
   shoot a filtered page at all; the choice is to give it the same eighth
   argument or to retire it. **Do not leave them silently different** — that is
   the shape of every measuring-configuration defect this file records.

## Hard rules

- **HOLD THE RASTERISER FIXED, AND SAY WHICH ONE.** Two shots that differ in it
  differ by 15.9% of the frame before anything you changed. `tools/shot-live.sh`
  prints it; put it in the sentence that quotes the number.
- **A CONSTANT IN AN INSTRUMENT IS AN UNMEASURED VARIABLE.** `--disable-gpu` sat
  in a spawn call for a week, under numbers that were all reported as properties
  of the page.
- **ASK THE PAGE FOR ITS RECTANGLE; DO NOT DERIVE IT.** Two derivation errors
  nearly cancelled here and the answer looked right.
- **A REPORT THAT RE-TYPES ARITHMETIC IS A SECOND COPY OF IT.** `stageFitReportFor`
  calls the two functions that own the letterbox, and its test asserts that
  rather than the numbers.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES CHROME OR RUFFLE, OR REGENERATES `assets/`.**
- **Ship no SS2 asset.** `tools/clip-probe/index.html` contains none.
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
