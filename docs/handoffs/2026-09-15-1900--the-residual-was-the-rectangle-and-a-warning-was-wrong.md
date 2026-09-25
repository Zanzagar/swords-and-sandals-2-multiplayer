---
handoff:      2026-09-15-1900--the-residual-was-the-rectangle-and-a-warning-was-wrong
written:      2026-09-15 19:00 -0400
sessionId:    79ae298f-54e8-4964-9c3b-65d33f2bb1b0
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      `c84f0ce..HEAD` — `3384c76` (the snapped rectangle, the probe, the
              two record corrections) plus this line's own commit.
              **Re-measure; never copy.**
suite:        **Re-measure BY EXIT CODE after your own commit.** 1900 / fail 0 /
              skipped 1 here, unchanged in total across the change: the four
              assertions that moved were CORRECTED, not added. `fail == 0` and
              the exit code are the gate.
agentRuns:    ONE wave, 5 questions + 5 write-nothing verifiers. **10 started,
              10 returned, 0 dead.** Verdicts: 2 BROKEN, 2 PARTIALLY-BROKEN,
              1 the same. **Every one of the five investigators broke at least
              one premise of my brief, and four of them broke the SAME one** —
              the 15:35 handoff's "the call site executes and the logging does
              not". The verifier on the clip question then broke MY headline and
              was right to.
next:         **RANKED BELOW. The residual that was ranked 3rd is CLOSED; items
              1 and 2 are still the owner's and are untouched.**
---
# Handoff — the residual was the rectangle, and a warning was wrong

## The one-sentence version

The 392 pixels that four handoffs carried as "inside the stage, and I do not know
why" are Chrome clipping through an antialiased mask because the clip rectangle's
edges are fractional; **and the warning the last handoff left about writing an
arena probe rests on an inference that four agents and one screenshot all
broke.**

## WHAT IS DONE, WITH ITS EVIDENCE

► **`stageClipRectFor` SNAPS TO WHOLE DEVICE PIXELS, AND THAT IS THE WHOLE
  RESIDUAL.** `stageFitFor` halves and multiplies by a float, so the rectangle
  landed on an integer only by accident — at the arena's 870x688 canvas it was
  `0, 58.531, 870 x 570.938`. Each edge now moves by at most half a pixel.

► **`tools/clip-probe/index.html` IS THE INSTRUMENT, AND IT IS THE REUSABLE
  PART** — the canvas2d counterpart of `tools/swf-probe.mjs`, containing no SS2
  asset and needing no pack. Same content, same canvas, ONLY the rectangle
  varies; it reads its own pixels back and prints the verdict, so nothing
  depends on a screenshot being differenced correctly afterwards. Null control
  0, null-with-overhang 0, positive control 19,911. At 870x688, in a 160x160 box
  ~200px clear of every edge:

```text
    whole-pixel, cutting nothing                      0        centre 0
    whole-pixel inset 20 / 39, CUTTING the overhang  46,393 / 81,393   centre 0
    fractional inset 20.37, cutting nothing          3,359    centre 2,548  d<=6
    the arena's own 0, 58.531, 870 x 570.938        53,720    centre 2,548  d<=6
    the same rectangle SNAPPED (0, 59, 870 x 570)   50,361    centre 0
```

  **It is the FRACTION and not the cutting.** A whole-pixel clip that removes
  81,393 pixels changes nothing in the middle. And the sweep says which edge and
  how much:

```text
    whole                        centre 0
    y fractional by 0.5 only     centre 2,548  d 6
    x fractional by 0.5 only     centre 2,548  d 6
    height fractional by 0.5     centre 2,548  d 6
    y fractional by 0.25         centre 2,548  d 6
    every edge fractional by 0.5 centre 2,548  d 6
    y fractional by 0.001        centre 0        <- below the subpixel grid
```

  **One fractional edge is as bad as four and the count is IDENTICAL in every
  case** — a blitter switching once for the whole surface, not error
  accumulating with the fraction.

► **AND IT HOLDS IN THE ARENA, WHICH IS THE ARM THE VERIFIER SAID WAS MISSING
  AND WAS RIGHT ABOUT.** `seed=7`, frame 120, 1200x800, clipped against
  `?clip=0`, movers 20px or more inside every clip edge: **644 BEFORE, 0 AFTER.**
  What is left inside the stage is 870 pixels — one full canvas-width row AT the
  boundary, which is the clip's own edge and cannot be anything else. Null
  control 0 both times, by md5 and by pixel.

► **THE SCREENS PAGE HAD THE SAME RECTANGLE BY A DIFFERENT ROUTE.** It clipped
  in STAGE space to `0,0,640,420` under the fit transform — the same fractional
  device rect — and clips `stageClipRectFor`'s snapped rectangle in DEVICE space
  now, before the transform. Rendered: the clip still masks (94,660 px against
  `?clip=0`, null control 0) and the page moved 2,467 pixels at delta <= 10,
  which is the sub-pixel class and nothing structural. **Correcting one and
  leaving the other is the pointer-not-the-pointee failure this repository keeps
  recording.**

► **THE TEST IS CORRECTED AT ITS ASSERTIONS AND MUTATION-CHECKED.** Four
  `assert.equal(rect.x, fit.offsetX)` become half-pixel bounds on all four
  EDGES, plus the one the change exists for: every field is an integer. Put the
  fractional rectangle back and the suite goes to 1 fail and it is that test.
  **The half-pixel bounds alone could not have caught it** — the old float
  rectangle satisfies them too.

## WHAT WAS WRONG IN THE RECORD, AND WHAT WAS WRONG IN MY OWN HEAD

► **CONTROL (a) TESTED A CLIP THAT WAS NOT THERE, AND IT IS WHY THIS QUESTION
  POINTED THE WRONG WAY FOR A SESSION.** *"A clip inflated by 10,000px is
  pixel-identical to no clip, so Chrome's clipped-fill path does not perturb
  rasterisation, and the cause is the rectangle actually cutting something."*
  The measurement reproduces exactly. **The inference does not: an inflated
  rectangle intersected with the device bounds is a solid rectangle, and Skia
  collapses that case back to a black-and-white region clip.** The control
  exercises an ELIDED clip, so it can say nothing about one that is present —
  and the probe reproduces both halves, 0 for the inflated rectangle and 2,548
  for the real one.

► **CONTROL (b) WAS REAL AND NEARLY POWERLESS.** `?groups=0` at `seed=7`, frame
  120, 1200x800 is **byte-identical to the default by md5**, while the page's own
  log says 2 groups composited and 1 buffered; at the 15:35 dressing it moved
  13-28 pixels in the whole frame, disjoint from the residual. So *"?groups=0
  gives the identical 392"* is true and could not have been otherwise. **Ask what
  a control could have varied over before ruling anything out with it.**

► **`tools/arena/main.js` HAS NO `?filters=0`, AND THE LIVING HEAD SAID BOTH
  SHELLS DID.** It reads `seed`, `spectate`, `rank`, `arena`, `sky`, `rain`,
  `enchant`, `groups`, `clip`, `amplify`, `seam`, `filterprobe` — and MENTIONS
  `?filters=0` in a comment beside the stage clip, which is how the claim
  survived. A shot taken with it is byte-identical to one without, which reads
  as "the toggle changed nothing". Corrected in the living head. **Only
  `tools/screens/main.js` has one.**

► **MY OWN FIRST TWO EXPLANATIONS DIED ON THIS PROBE, WHICH IS WHAT IT IS FOR.**
  I predicted that an active clip changes antialiasing wherever it is — wrong,
  every whole-pixel clip is 0 — and then that a clip which CUTS something changes
  pixels elsewhere, also wrong.

► **AND "99.8% OF THE MOVERS ARE ON ANTIALIASED EDGES" IS CORROBORATING, NOT
  DIAGNOSTIC. A VERIFIER CAUGHT ME ON IT AND IT IS THE SHARPEST THING IT SAID.**
  The number is real — 99.8% against 5.8% of the unchanged pixels in the same
  region, and 0% in flat areas against 56% — and **at a maximum delta of 8, a
  difference of ANY cause can only surface on antialiased coverage.** It
  separates the finding from uniform noise, which was never a rival hypothesis.
  The arm that decides it is the integer/fractional pair.

► **THE PROBE'S OWN POSITIVE CONTROL FAILED TWICE BEFORE IT WAS RIGHT, AND SAID
  SO EACH TIME.** First the clear and the background fill were inside the clip,
  so the "cuts the content" trial compared stale-but-identical pixels and
  reported 293. Then a fixed `INSET(120)` cut the wheel in half at 300x300 and
  missed it entirely at 870x688, reporting 0. **Both times the page printed "THE
  CONTROLS FAILED, so every row above is noise" instead of a number.** A control
  pinned to a constant is a control only at the size it was written at — and a
  NULL control would have caught neither, because the null control was correct
  throughout.

## THE WARNING ABOUT THE ARENA PROBE IS WITHDRAWN

► **"THE CALL SITE EXECUTES AND THE LOGGING DOES NOT" IS AN INVALID INFERENCE.**
  The 15:35 handoff warned the next reader off writing an arena `?probe=1`
  because `reportStageFit`'s lines never reached the panel "while the clip two
  lines below it demonstrably worked in the same frame". **The stage clip is
  COMMITTED code (`3b851c3`), so a working clip cannot distinguish "my edited
  file was loaded" from "a build without the probe was loaded."** Four agents
  aimed at different questions broke that independently.

► **AND A SHOT SETTLES IT: THE ARENA LOGS FROM INSIDE A FRAME PERFECTLY WELL.**
  A 1200x2600 render shows the panel holding `figure groups: 0 group(s) over
  0/488 op(s) in 4 figure(s) this frame` and `seam: painter ops=100 dressed=...`
  — both emitted by `reportFigureGroups` and `reportedLoadout` inside
  `renderStage`, i.e. inside `render()`. **`reportStageFit` was never committed**:
  `git log --all -S reportStageFit` finds it only in that handoff's own prose.

► **THE PANEL IS OUT OF FRAME AT EVERY SIZE THE CLIP WORK WAS SHOT AT.** At
  1200x800 only the `SURFACE LOG` heading reaches the image. **Shoot 2600 tall to
  read the log at all** — which is what the screens-page log shots already did and
  nothing wrote down.

► **AND THE BETTER PROBE IS NOT A LOG LINE ANYWAY.** Set `window.__stageFit` in
  `render` and read it back with `Runtime.evaluate`: `tools/shot-live.mjs`
  already polls `window.__frames` that way, so the plumbing exists, and the
  answer comes back as a number rather than as a picture of a number.

## Highest-value work, ranked

1. **RE-SHOOT THE PROBES UNDER ADOBE'S PLAYER IF YOU EVER HAVE ONE — unchanged
   and still the owner's.** Every "what a faithful Flash player draws" number
   rests on Ruffle being one.

2. **THE TWELVE GROUPS IN THE FIGURE PACK REACH NO GLADIATOR — still the
   owner's, untouched.** All 12 group entries and 30 grouped placements sit on
   four clips declared unplayed; making them reachable means deciding what those
   spells ARE.

3. **NOTHING ON THIS MACHINE HAS EVER RENDERED THE ARENA WITHOUT
   `--disable-gpu`, AND EVERY PIXEL NUMBER IN THIS REPOSITORY IS A SOFTWARE
   RASTERISER'S.** A verifier raised it and it is the widest open question the
   clip work leaves: both `tools/shot.sh` and `tools/shot-live.mjs` pass the
   flag. **The fractional-clip perturbation may not exist at all under GPU
   rasterisation** — which would not make the snap wrong, but would mean this
   whole residual was a property of the instrument, and that is a sentence this
   repository has had to write twice already. One flag, two shots.

4. **`window.__stageFit` OVER CDP**, per the section above — it is what the
   392-pixel question originally wanted and it is now a small job with a known
   route.

## Hard rules

- **A CONTROL CAN BE ELIDED.** An inflated clip is not "a clip that removes
  nothing"; it is no clip at all, and the renderer says so before your code runs.
  **Ask whether the system under test still contains the thing you think you are
  varying.**
- **A CONTROL PINNED TO A CONSTANT IS A CONTROL ONLY AT THE SIZE IT WAS WRITTEN
  AT.** `INSET(120)` cut the content on one canvas and missed it on another.
  Derive controls from the content.
- **A NULL CONTROL AND A POSITIVE CONTROL CATCH DIFFERENT THINGS, AND THIS PAGE
  NEEDED BOTH.** Both of its defects were invisible to a correct null control.
- **A STATISTIC THAT ANY CAUSE WOULD PRODUCE IS NOT A DIAGNOSIS.** At a delta of
  8, everything lands on antialiased edges.
- **A WORKING FEATURE IS NOT EVIDENCE THAT YOUR EDIT WAS LOADED** if that feature
  was already committed. Vary something only your edit can change.
- **SHOOT 2600 TALL TO READ THE ARENA'S LOG PANEL.** At 1200x800 it is below the
  fold and its absence reads as silence.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES CHROME OR RUFFLE, OR REGENERATES `assets/`.**
- **Ship no SS2 asset.** `tools/clip-probe/index.html` contains none: every shape
  on it is written in the file.
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
