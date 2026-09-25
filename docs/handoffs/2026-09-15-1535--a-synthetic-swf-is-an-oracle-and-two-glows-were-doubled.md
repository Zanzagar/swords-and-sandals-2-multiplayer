---
handoff:      2026-09-15-1535--a-synthetic-swf-is-an-oracle-and-two-glows-were-doubled
written:      2026-09-15 15:35 -0400
sessionId:    470865d7-a62b-4a17-9461-cd2c38d762a3
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      29be32c..HEAD — `3b851c3` (the probe, the oracle, the stage clip),
              `385576a` (the doubled blur), `355f3e9` (my overclaim corrected),
              `4a0eb33` (the mutation audit), plus this line's own commit.
              **Re-measure; never copy.**
suite:        **Re-measure BY EXIT CODE after your own commit.** It moved
              1889 -> 1900 here (+11 tests, no test removed). `fail == 0` and
              the exit code are the gate; the total is not.
agentRuns:    ONE wave, 6 agents in two batches of 3 (memory, not caution:
              ~5 GB free and a suite run is the heavy thing). **6 started, 6
              returned, 0 dead.** 54 mutations, 47 KILLED, 7 SURVIVED — the
              OPPOSITE of the 2026-09-07 engine audit. Of the 7, exactly ONE
              was a real gap and it is fixed; **re-derive any survivor before
              acting on it, because two of mine dissolved when I did.**
              Verifiers: 7 started, 7 returned, 0 dead — 6 CONFIRMED, 1
              PARTIALLY-BROKEN, 0 BROKEN.
next:         **RANKED BELOW, AND THE ITEM THAT WAS RANKED FIRST IS CLOSED** —
              the glow draws its strength, verified against the oracle and
              against its own `?amplify=0` kill switch. Item 2 is the owner's.
---
# Handoff — a synthetic SWF is an oracle, and two glows were doubled

## The one-sentence version

A 273-byte SWF written by this repository turned Ruffle into a controlled
oracle; the first two questions it was pointed at both came back "your renderer
is wrong", and **the second of them was wrong in a way nobody was looking for —
every glow and every shadow in the build was drawn at twice its blur.**

## WHAT IS DONE, WITH ITS EVIDENCE

► **THE GREEN BAND IS CLOSED. IT WAS NEVER A BAND.** Five handoffs carried it
  as "known, measured, unexplained" and one session withdrew a diagnosis of it
  within the hour. The sky simply leaves the stage, and how far depends on the
  frame:

```text
    sky frame     1      60     112     180     200
    top edge   -12.0  -164.8  -12.0   -50.9  -114.1
    ops above     1      17       1      42      57
```

  **`HANDOFF.md`'s extents table — the one that made this look like a 15-pixel
  disagreement, and which I used to rule the sky out — was computed at FRAME 1,
  the single frame where the sky barely leaves the stage.** `crowd` leaves it on
  every frame of every arena, spanning x -289.5..1073.3 against a 640-wide
  stage. `stageClipRectFor` in `src/render/arena-backdrop.js` is the fix; both
  shells apply it; `?clip=0` restores the old picture. Clipped against
  unclipped: **43,985 differing pixels, 6.98% of the page, across the full
  width — and the same URL twice differences to exactly 0.**

► **THE ARBITER IS A PROBE, NOT AN ARGUMENT — AND IT IS THE REUSABLE PART.**
  `tools/swf-probe.mjs` writes minimal SWFs; `tools/ruffle-shot.ps1` renders one
  under Ruffle and captures the client area. The clip probe is one control
  rectangle inside a 200x200 stage and four outside it, one past each edge.
  Varying ONLY `--letterbox`:

```text
    outside-stage edge   letterbox on   letterbox off
    above  (red)           #000000        #ff0000
    below  (green)         #000000        #00ff00
    left   (blue)          #000000        #0000ff
    right  (yellow)        #000000        #ffff00
    inside control         #ffffff        #ffffff     <- the null control
```

  **A player DOES rasterise content outside its stage rect and then MASKS it.**
  ► **AND THE GAP WAS THE ARENA PAGE ALONE, WHICH I FOUND OUT BY NEARLY
    BREAKING THE OTHER ONE.** `tools/screens/main.js` has clipped by default
    since 2026-09-14, under its own `?clip=0`, with a docstring reading *"THE
    STAGE CLIP IS ON BY DEFAULT BECAUSE THE PLAYER CLIPS"* and four
    measurements beside it. **I wrote "our renderer had neither behaviour"
    before reading the file that contradicted it, and I added a SECOND,
    unconditional clip to that page which made its existing toggle inert.**
    Taken back out; the page keeps its own clip and borrows only the rectangle.
    What is genuinely new is the MEASUREMENT — that page asserts what a player
    does and nothing had rendered one.

► **EVERY GLOW AND SHADOW IN THE BUILD WAS DRAWN AT TWICE ITS BLUR, AND A
  CORRECT READING OF THE CSS SPECIFICATION IS WHY.** `canvasFilterFor` handed
  `drop-shadow` twice the box blur's sigma, on the ground that the third length
  is a box-shadow radius and a box-shadow radius is twice a standard deviation.
  That is what the spec says. It is not what Chrome draws — three cells, one
  render, one source, `S = blurSigma(8) = 2.2913`:

```text
    filter                  lit width   reach beyond the source edge
    blur(S)                    34 px          5 px
    drop-shadow(0 0 S)         34 px          5 px    <- identical
    drop-shadow(0 0 2S)        44 px         10 px    <- exactly double
```

  Against the oracle, same filter record rendered both ways, blue channel
  outward from the source edge at `blurX` 8, strength 1:

```text
    movie px:          0    1    2    3    4    5    6    7    8    9   10
    ORACLE (Ruffle):  63   39   26    2    0    0    0    0    0    0    0
    OURS at 2 sigma:  63   52   41   31   23   16   11    7    4    2    1
    OURS at 1 sigma:  62   38   19    8    2    0    0    0    0    0    0
```

  **The peak was never wrong — 63 against 63. Only the width was.** Seven pinned
  literals across five test files moved, every one corrected at its assertion.

► **AND THE STRENGTH HALF IS DRAWN NOW, WHICH THIS FILE ORIGINALLY RANKED FIRST
  AND HANDED ON.** `glowAmplificationFor` describes the sequence and
  `amplifyGlows` runs it — silhouette white, amplify additively, colourise with
  `source-in`, draw under. `lighter` sums premultiplied channels and clamps at
  1, so the alpha out is exactly `min(1, blurredAlpha * strength)`: **an
  identity, not a fit.** Against the oracle, strengths 1 / 2 / 4 / 16:

```text
    oracle   63 39 26 2  |  126 78 52 4  |  252 156 104 8  |  255 255 255 48
    ours     62 38 19 8  |  124 76 38 16 |  248 152  76 32 |  255 255 255 128
```

  In the arena against `?amplify=0`: **0 differing pixels unenchanted, 3,015
  with an enchantment**, bounded to the weapon, mean shift B +28.6.

► **AND `blur()` IS DELIBERATELY UNCHANGED, WHICH IS THE PART THAT WAS NEARLY
  GOT WRONG.** The obvious move is to apply the same halving to the sibling
  branch. It is wrong, and rendering it is what said so:

```text
    blurX               2      4      8     16     32     48
    oracle reach     0.67   2.00   4.00   7.33  15.33  22.67
    blur(sigma)         0      2      5     10     19     27   <- shipped
    blur(sigma/2)       0      0      2      5     10     14
```

  `blur(sigma)` is closer at every width. **Halving it would have been a
  correction applied BY ANALOGY to a branch that did not have the defect** —
  this repository's signature failure with the nouns changed.

## Highest-value work, ranked

1. **RE-SHOOT THE PROBES UNDER ADOBE'S PLAYER IF YOU EVER HAVE ONE.** Every
   number in this file is "what a faithful Flash player draws" only to the
   extent that Ruffle is one. Ruffle is a reimplementation; nothing here has
   compared it against Adobe's binary. `probe-blur.swf`, `probe-glow.swf` and
   `probe-clip.swf` are three files and five minutes, and the glow work below
   now rests on them.

2. **THE TWELVE GROUPS IN THE FIGURE PACK REACH NO GLADIATOR — STILL THE
   OWNER'S.** All 12 group entries and 30 grouped placements sit on `psyche_up`,
   `psyche_up2`, `psyche_charging` and `psyche_charging2`, all four declared
   unplayed. Making them reachable means deciding what those spells ARE.

3. **THE 392-PIXEL CLIP RESIDUAL, in "Known, measured, unexplained" below.**


## THE MUTATION AUDIT — complete: 54 mutations, 47 KILLED, 7 SURVIVED

Six agents, two batches of three, 6/6 returned, each in a private `cp -a` copy
of frozen HEAD (`.git` included — the 2026-09-07 trap), mutating one
`src/render/` file by LINE NUMBER and running the whole suite after each. Every
agent measured the 1889/1888/0/1 baseline in its own copy first.

```text
    filters.js            9/9 killed      screen.js             8/9
    extracted-figure.js   8/9             arena-backdrop.js     8/9
    props.js              7/9             screen-text.js        7/9
```

► **THAT IS THE OPPOSITE OF WHAT I BRIEFED AND THE OPPOSITE OF THE 2026-09-07
  AUDIT'S HEADLINE (37 of 48 SURVIVED).** The render code is among the
  best-pinned in the repository; the engine was not. **A four-times-deferred
  task came back saying the fear behind it was wrong**, and three agents
  independently warned that carrying that document's ratio forward as the
  expected shape would be a misread.

► **AND OF THE 7 SURVIVORS, ONLY ONE WAS A REAL COVERAGE GAP. IT IS FIXED.**
  `src/render/arena-backdrop.js:992` — `stageProjectorFor`'s `horizon` accepted
  `SS2_GROUND_LINE` in place of `SS2_ARENA_ORIGIN.y`, moving it 200 arena units
  down a 420-unit stage with the suite green. Three tests REACHED the line and
  none discriminated, because the only assertion on it anywhere was
  `assert.ok(Number.isFinite(view.horizon))` — true of both numbers and of most
  wrong ones. **Now asserted as `projector.horizon === projector.toY(0, 0)`**,
  derived through `arenaToStage` rather than by re-typing the field's own
  arithmetic, at three canvas sizes and three zooms. Verified to KILL the exact
  mutation that survived: re-applied, the suite goes to 1 fail and it is that
  test.

► **THE OTHER SIX ARE "THE BUILD CONTAINS NO INPUT THAT DISCRIMINATES", NOT
  GAPS — and the agents' own instrumentation is what established it.**
  `screen-text.js:1043`'s branch never runs (3,395 groups evaluated, 0 with a
  non-finite `opCount`); `:895` needs nested filter stages and the suite builds
  none (0 of 2,807); `extracted-figure.js:1280` is semantically equivalent on
  this build's data. **Both `props.js` survivors I re-derived myself and both
  dissolved** — see below.

► **BOTH `props.js` SURVIVORS DISSOLVED WHEN I RE-DERIVED THEM, AND THE
  AGENT'S HEADLINE WAS THE WRONG ONE.** It reported `:506` as "the strongest
  form of under-asserted" on the strength of instrumentation showing the mutated
  expression returning a different value 5,890 times a run. The instrumentation
  is real; the conclusion is not. **Neither mutation can change behaviour on any
  input the build contains:**
  - `:506` — `.every` to `.some` on `built.colourMatrices`. The two differ ONLY
    on the empty array (`every` true, `some` false), and the only reader,
    `invoice.groupMatrixNotFillExact`, is **gated on `matrices.length > 0`** at
    `props.js:723` — so precisely the divergent cases are the ones the gate
    discards. Measured over the real pack: **745 group instances, 397 with 0
    matrices and 348 with exactly 1, NONE with 2 or more.** A semantic no-op.
  - `:384` — drops BLUE from `touchesRgb`. It can only matter for a transform
    that moves blue while leaving red and green alone. Measured: **2,330
    non-identity placement colour transforms in `props.json`, 340 touch RGB,
    and ZERO are blue-only.**
  ► **SO THE FINDING IS NOT "FIX THESE TWO LINES". IT IS THAT THE BUILD CONTAINS
    NO INPUT THAT DISCRIMINATES THEM** — which is worth writing down, because a
    MODDED build could, and because "reachable" and "discriminating" are
    different questions that this audit's instrumentation conflated. **A
    mutation that is semantically a no-op survives trivially and means
    nothing**; the field rules say to check that and it is the check that
    decided both of these.

► **FOUR OF MY BRIEF'S FACTS WERE WRONG AND THE AGENTS BROKE ALL FOUR.**
  `groupRunsOf` is at `tools/arena/main.js:2237` and `figureEffectCensusOf` at
  `tools/arena/main.js:358` — **I put BOTH arena-shell functions in
  `src/render/` files, the same mistake twice in one brief.** `prefixesOf` was
  DELETED on 2026-09-15 and replaced by `filterGroupDraftsOf`, **and the living
  head was still citing it as current in two places, corrected there now.** And
  the 2026-09-07 baseline of 816 describes a tree 2.3x smaller than today's.

► **AND ONE AGENT FOUND A POINTER TO NOTHING, WHICH IS FIXED.**
  `src/render/extracted-figure.js:1082` and `:1185` both said *"See
  `weaponGlowScope`"* and **no such function has ever existed anywhere in this
  repository** — the prose lives in `weaponGlowEntryFor` at `:653`. Both now
  cite it. That is the ninth-and-tenth instance of the pointer failure this
  file keeps recording, found by an agent that simply went looking for the
  symbol it was told to read.

► **THE VERIFIERS: 7 STARTED, 7 RETURNED, 0 DEAD — 6 CONFIRMED-SURVIVOR, 1
  PARTIALLY-BROKEN, 0 BROKEN.** Each was given ONE named claim and wrote
  nothing. They rate two of the six `cosmetic`, one `dead-code`, and three
  `render-correctness`. **The verifier on `arena-backdrop.js:992` independently
  confirmed my own fix without being told about it**: it exported HEAD with
  `git archive`, applied the mutation at its NEW line (1078, not 992), and
  watched the test I had just written kill it.

► **AND THAT SAME VERIFIER CAUGHT A DEFECT I HAD SHIPPED, WHILE LOOKING AT
  SOMETHING ELSE.** Its HEAD export went red unmutated too, and it reported the
  red as *"an artifact of exporting without gitignored assets, not caused by the
  mutation"*. **It was not the method. It was my test.** The stage-clip check I
  added opened with `assert.fail(...)` when `assets/props/props.json` is absent
  — deliberately, to avoid a silent skip — which turns a FRESH CLONE red for
  anyone without an extraction. Corrected to `render-props.test.js`'s
  convention: assert the absence and return.
  ► **A verifier careful enough to say WHICH of two explanations it was, about
    its own method, is the only reason that survived to be read.**

► **AND MEASURING THAT TURNED UP A WRONG NUMBER IN `AGENTS.md`, NOW CORRECTED
  THERE.** Its test-profile section said a fresh clone shows **1 skipped**.
  Measured in a real `git clone` at this commit: **9.** The extra 8 are gated on
  the extracted TEXT pack, gitignored like every other asset; the documented 1
  describes a tree that HAS `assets/`. A cloner measuring 9 against a documented
  1 has a correct tree and a wrong document — and `AGENTS.md`'s own next
  sentence tells them a skip is "a real finding, not noise".

► **ONE CAVEAT ON EVERY NUMBER IN THIS SECTION, RAISED BY A VERIFIER:** the
  frozen tree the agents measured is `29be32c`, and the repo moved four commits
  past it during the session. **Replaying these mutations BY LINE NUMBER against
  the current tree edits the wrong lines** — at HEAD, `arena-backdrop.js:992` is
  a docstring. Re-locate by symbol, which is what this repository already tells
  you to cite.

## Known, measured, unexplained

► **THE STAGE CLIP CHANGES 392 PIXELS INSIDE THE STAGE, AND I DO NOT KNOW
  WHY.** 0.222% of the 176,211 pixels inside the fitted stage, scattered over
  x 91..518 / y 208..418 — which is where the fighters stand — in their own
  browns and greys, at a maximum per-channel delta of 7/255 (258 of the 392 are
  a delta of 1). **No feature is missing and nothing is visibly wrong**; this is
  a residual, not a defect I am shipping knowingly as one.

  What it is NOT, each ruled out by a render rather than by reasoning:
  - **Not "a clip is active".** A clip inflated by 10,000px — one that cannot
    remove anything — is PIXEL-IDENTICAL to no clip at all: 0 differing pixels,
    max delta 0. So Chrome's clipped-fill path does not perturb rasterisation,
    and the cause is the rectangle actually cutting something.
  - **Not the group compositor.** `?groups=0` gives the identical 392 with the
    identical histogram.
  - **Not the glow-radius change.** The three shots were re-taken together at
    one code state and reproduce exactly.
  - **Not non-determinism.** The same URL twice differences to 0.

  **The obvious next move is the one I did not have: the arena page cannot
  report its own canvas rect.** Every "inside the stage" number above rests on a
  canvas rectangle I derived from the page layout rather than asked the page
  for, and a first attempt at this check reported a false FAILURE for exactly
  that reason. `tools/screens/main.js` has `?probe=1`, which reads the canvas
  back and prints the fit; **the arena has no equivalent, and adding one is the
  cheapest way to finish this.**
  ► **I WROTE THAT PROBE AND THEN TOOK IT BACK OUT, WHICH IS WORTH KNOWING
    BEFORE YOU WRITE IT AGAIN.** `reportStageFit` logged the canvas rect, the
    fit and the stage rectangle in both device and page coordinates, called from
    `render` immediately after `stageClipRectFor`. **Its lines never appeared in
    the log panel**, with or without the `params.has("probe")` gate, while the
    clip two lines below it demonstrably worked in the same frame — so the call
    site executes and the logging does not, and I did not find out why. It is
    removed rather than shipped, because a probe whose output nobody has seen is
    worse than no probe: the next person would trust its silence.
    **Start by checking how `log` behaves during the first `render`** — the
    panel renders `logLines.slice().reverse()` and caps at 40, and the startup
    lines around it survive, which is what makes the absence odd.

## Hard rules

- **A TABLE COMPUTED AT ONE FRAME IS NOT A TABLE.** The sky extents that
  misdirected this question for five handoffs were frame 1 only, on a surface
  with 200 frames. State the parameters beside any measurement of a surface that
  has more than one state — the 17:12 handoff already said this and the table it
  was said about was still believed.
- **WHEN YOUR RENDERER AND A SPECIFICATION DISAGREE, RENDER BOTH.** The doubled
  radius survived for weeks behind a correct citation. A specification says what
  a browser should do.
- **A CORRECTION THAT FITS ONE BRANCH IS NOT A CORRECTION TO ITS SIBLING.**
  `blur()` looked like it had the same defect and did not; only rendering it
  said so.
- **A TEST CAN PASS FOR THE WRONG REASON AND STILL BE GREEN.** My first oracle
  test modelled the reach as `3.33 * radius / 2`, taking the spec's word. The
  model is false in this browser and it landed inside tolerance because its two
  errors ran opposite ways.
- **PUT THE KILL SWITCH IN WITH THE CHANGE.** `?clip=0`, like `?filters=0` and
  `?groups=0`. A change with no off switch cannot be measured, only asserted.
- **A NULL CONTROL IN THE SAME FILE AS THE MEASUREMENT.** The clip probe's
  inside-the-stage rectangle is why "nothing rendered" and "it clipped" are
  distinguishable. It earned its place immediately: the first probe drew nothing
  at all.
- **MY OWN ENCODER BUG, AND ITS SHAPE IS THE USUAL ONE.** I wrote
  `GeneralLineFlag = 0` under a comment reading "both deltas follow", which is
  what 1 means. Ruffle drew a bare background and that reads as "the player
  ignored my file". The self-test now walks each decoded path back to a bounding
  box and compares it against the DECLARED bounds — **the check that was missing
  was the one on the thing that could vary.**
- **Ruffle is the oracle and Ruffle is a reimplementation.** Say which you mean.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES CHROME OR RUFFLE, OR REGENERATES `assets/`.**
- **Ship no SS2 asset.** The probes contain none: they are this repository's own
  bytes, and they render in a player started with `--storage memory` so the
  oracle's save is untouched.
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
