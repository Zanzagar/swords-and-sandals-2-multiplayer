---
handoff:      2026-09-15-2330--two-clip-phenomena-one-per-rasteriser
written:      2026-09-15 23:30 -0400
sessionId:    79ae298f-54e8-4964-9c3b-65d33f2bb1b0
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      `0dadea0..HEAD` — `26c1449` (the gradient and bitmap trials, and
              my own correction), the `shot.sh` commit, plus this line's own.
              **Re-measure; never copy.**
suite:        **Re-measure BY EXIT CODE after your own commit.** 1910 / fail 0 /
              skipped 1 here. `fail == 0` and the exit code are the gate.
agentRuns:    NONE this stretch. Every number below is a render taken serially
              by the main session, which is the only thing allowed to take one.
next:         **RANKED BELOW. Everything I could close is closed; items 1 and 2
              are the owner's and I have not touched them.** This is a clean
              stopping point.
---
# Handoff — two clip phenomena, one per rasteriser

## The one-sentence version

The 654 all-delta-1 pixels the snapped clip still moved under `gpu` are
`drawImage` resampling, not the clip rectangle — **there are two clip effects and
each exists under exactly one rasteriser** — and the sentence I published eight
hours ago saying the probe gave identical answers under both was true only of a
page that had one canvas.

## WHAT IS DONE, WITH ITS EVIDENCE

► **TWO PHENOMENA, ONE PER RASTERISER.** `tools/clip-probe/index.html` gained a
  GRADIENT backdrop and a RESAMPLED BITMAP — both built from the page's own
  arithmetic, a 64x64 offscreen filled by a formula and drawn at a deliberately
  non-integer scale and origin, so there is still no SS2 asset on it. With every
  control green (three null controls at 0, positive control 18,440), the centre
  box ~200px clear of every rectangle reads:

```text
    trial                                   cpu          gpu
    every whole-pixel clip                    0            0
    FRACTIONAL, cuts nothing              2,548 d6         0
    FRACTIONAL, cuts the overhang         2,548 d6         0
    the arena's own FRACTIONAL rect       2,548 d6         0
    the arena's SNAPPED rect                  0            0
    every fractional variant in the sweep 2,548 d6         0
    GRADIENT + snapped clip                   0            3 d1
    BITMAP + a WHOLE-pixel clip               0           50 d1
    BITMAP + the arena's SNAPPED rect         0           49 d1
```

  ► **THE FRACTIONAL-RECTANGLE EFFECT PERTURBS PATH ANTIALIASING AND IS
    CPU-ONLY.** It is exactly what `stageClipRectFor`'s snap removes.
  ► **A CLIP OVER A RESAMPLED BITMAP PERTURBS THE SAMPLER AT DELTA 1 AND IS
    GPU-ONLY, AND IT DOES NOT CARE WHETHER THE RECTANGLE IS WHOLE.** That is the
    arena's band — rows 177..434 are the sky and the crowd, which are raster.
    **No choice of rectangle fixes it.** It was written up at 21:30 as an open
    residual of the clip; it is not one, and the entry is corrected.
  ► **THE SNAP IS STILL RIGHT AND IS BETTER ARGUED NOW.** It removes 644
    interior movers under `cpu` and costs nothing under `gpu`, where whole and
    fractional rectangles both read 0.

► **I MUST CORRECT MYSELF, AND IT IS THE SECOND TIME THIS SESSION.** The 21:30
  commit and the living head said the probe "shot under both rasterisers gives
  every number identical". **That page had exactly ONE canvas.** Allocate a
  second and `gpu` answers differently — it drops the fractional effect to 0 and
  gains the bitmap one. The discriminator was already in hand and needed no new
  render: the run carrying the gradient trials but no offscreen still read 2,548,
  so it is the ALLOCATION and not the warm-up draw. Corrected AT the sentence in
  the living head, not in a note above it.

► **AND THE PAGE CAUGHT A THIRD DEFECT IN ITSELF — THE FIRST ABOUT ITS OWN
  INSTRUMENT RATHER THAN ITS EXPERIMENT.** Adding the bitmap trials took the
  NULL CONTROL from 0 to **8,196 differing pixels at delta 45** and the gradient
  control to 280,022, because `bitmapOnce()` allocated that second canvas AFTER
  three baselines had been captured — so every trial was being compared against
  a baseline from the other regime. **The page printed "THE CONTROLS FAILED, so
  every row above is noise" instead of a number.** One discarded shot of every
  draw path before the first baseline, and all three nulls are 0 again.

► **`tools/shot.sh` TAKES THE RASTERISER TOO, AS ITS SIXTH ARGUMENT.** It
  hardcoded `--disable-gpu` for a session after its sibling stopped, which meant
  **two shots taken with the two tools differed by 15.9% of the frame before
  anything under test had changed**, with neither output saying which browser it
  used. Same two values, same default, refused by name, and the rasteriser is on
  its output line. Rendered both ways: 59,718 pixels differ, so the flag reaches
  Chrome.
  ► **AND A TEST PINS THE CONTRACT ACROSS THE TWO TOOLS.** A `.sh` cannot be
    imported, so the test READS it and asserts the default, both branches, the
    refusal and the printed line — and that the hardcoded flag is gone, since a
    leftover would put both branches on the same browser. **It pins the contract
    rather than the behaviour and says so.** Mutation-checked: change the
    default to `gpu` and the suite fails by name.
  ► **`shot.sh`'S HEADER NOW SAYS TO PREFER ITS SIBLING**, with the two reasons
    it existed anyway: `--virtual-time-budget` never completes on a page
    compositing a filter, and it leaks a Chrome process per invocation. What it
    still does that `shot-live` cannot is shoot a page that never animates.

## Highest-value work, ranked

1. **RE-SHOOT THE PROBES UNDER ADOBE'S PLAYER IF YOU EVER HAVE ONE — the
   owner's, untouched.** Every "what a faithful Flash player draws" number rests
   on Ruffle being one.

2. **THE TWELVE GROUPS IN THE FIGURE PACK REACH NO GLADIATOR — the owner's,
   untouched.** Making them reachable means deciding what those four unplayed
   spells ARE.

3. **DECIDE WHICH RASTERISER THIS PROJECT MEASURES IN, AND SAY SO ONCE.** Every
   committed number is `cpu` and that is now a choice rather than an accident,
   but nothing states it as policy. **A player runs neither of these**: they run
   a windowed browser with GPU rasterisation, which the 15.9% figure says is a
   materially different picture. The cheap version is one line in `AGENTS.md`;
   the honest version is re-taking the handful of numbers that describe what a
   PLAYER sees, as opposed to what the renderer computes.

4. **`tools/shot.sh` STILL LEAKS A CHROME PROCESS PER INVOCATION.** Documented
   since 2026-09-15, 73 were once alive, and the symptom is working URLs failing
   in a way that reads as a page defect. `shot-live` fixed it in a `finally`; the
   fix is the same two lines. I left it because retiring the tool may be the
   better answer and that is a judgement I did not want to make silently.

## Hard rules

- **A LAZILY-CREATED RESOURCE IS A REGIME CHANGE WITH A TIMESTAMP.** Allocating
  a second canvas mid-run made every measurement taken before it disagree with
  every measurement taken after. Warm every path before the first baseline.
- **AN ANSWER THAT DEPENDS ON THE RASTERISER IS TWO ANSWERS.** Do not write "the
  probe says X" without saying which browser said it.
- **HOLD THE RASTERISER FIXED, AND SAY WHICH ONE.** Both tools print it now.
- **A TEST THAT READS A FILE PINS A CONTRACT, NOT A BEHAVIOUR — SAY WHICH.** The
  cross-tool test asserts `shot.sh`'s text, because a shell script cannot be
  imported and two tools drifting apart in silence is what it exists to stop.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES CHROME OR RUFFLE, OR REGENERATES `assets/`.**
- **Ship no SS2 asset.** The probe's bitmap is 64x64 of this page's own
  arithmetic.
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
