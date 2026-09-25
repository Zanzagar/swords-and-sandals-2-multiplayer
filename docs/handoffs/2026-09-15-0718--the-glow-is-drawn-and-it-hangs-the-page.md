---
handoff:      2026-09-15-0718--the-glow-is-drawn-and-it-hangs-the-page
written:      2026-09-15 07:18 -0400
sessionId:    3b712373-df6e-4272-9ec6-783b4ba57b27
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      378e702..HEAD — `076b0fa` then `86eaede`, both pushed. **This
              handoff's own commit is a third. Re-measure; never copy.**
suite:        1879 / 1878 / 0 fail / 1 skipped, EXIT 0 — measured on a QUIET
              tree before the handoff commit. **Re-measure BY EXIT CODE after
              yours.** It moved 1803 -> 1843 -> 1845 -> 1879. `fail == 0` and
              the exit code are the gate; the total is not.
agentRuns:    TWO waves, 16 agents, 16 returned, 0 dead, 0 ownership violations.
              **Ten verifier verdicts: 3 CONFIRMED, 5 PARTIALLY-BROKEN,
              2 BROKEN. SIX of my own briefed premises broke**, and every one of
              the six was worth more than the task it interrupted.
supersedes:   2026-09-15-0400--the-filters-land-and-the-sky-has-a-clock, whose
              ranked item 1 is DONE, item 4 is HALF done (the icons pack's two
              bevels are denominated; the build-wide 54 is now decomposed but
              still 50 unreachable), and whose items 2, 3, 5 and 6 are open.
next:         ~~**THE WEAPON GLOW HANGS A HEADLESS RENDER AND I DID NOT FIND
              WHY.**~~ **CORRECTED BEFORE THIS HANDOFF WAS SUPERSEDED — IT DOES
              NOT HANG.** The stall is `--virtual-time-budget`, which
              `tools/shot.sh` drives Chrome with. **And the frame cost is not
              3.9x either — that was `--disable-gpu`. With GPU rasterisation it
              is ~1ms per enchanted fighter, free at two.** So ranked item 1 is
              RETIRED; the live work is items 2 and 3. `tools/shot-live.sh`
              shoots the page, and the glow is on screen in all four colours.
              See "THE CORRECTION", the first section of this file.
---
# Handoff — the glow is drawn, and it hangs the page

## THE CORRECTION, FIRST, BECAUSE THE TITLE AND THE RANKING BELOW ARE WRONG

**The page does not hang, and I published that it did.** Corrected in the same
session, after this file was written and pushed; the original text is left
standing below so the mistake is legible rather than tidied away.

- **A CPU profile over CDP puts 95.8% of samples in `(program)`** — native
  rasterisation, not script — with `drawImage`, `fill` and the page's own
  `frame`/`render` ticking.
- **AND THE COST IS NOT 3.9x EITHER; I CORRECTED THIS TWICE.** The first
  correction measured a browser started with `--disable-gpu`, which is software
  rasterisation and the worst case. Varying only that flag:

```text
                        no glow   with glow          2 fighters    6 fighters
    --disable-gpu       16.6 ms     64.5 ms  3.9x
    GPU rasterisation    6.1 ms      6.1 ms  free    6.1 -> 6.1    6.1 -> 11.8
```

  **About a millisecond a frame per enchanted fighter — free at two, 85 fps at
  six.** Ranked item 1 below is therefore RETIRED, not deferred. First I
  measured the screenshot MODE and called it a property of the page; then I
  measured the RASTERISER and called it a property of the feature. Both numbers
  were real and both subjects were wrong.
- **What stalls is `--virtual-time-budget`**, which is what `tools/shot.sh`
  drives Chrome with and which does not advance while a filtered composite is
  outstanding. **A `FAILED` from `tools/shot.sh` is evidence about the
  screenshot mode, not about the page.**
- **My stated evidence was that the wall time did not move with the budget.**
  That observation was real; the inference was not. And it was taken through a
  leaking instrument — 73 Chrome processes were alive, so URLs that had worked
  minutes earlier failed too, which is what made the times look identical.
- **The glow is on screen, in all four colours.** Two shots frozen at the same
  frame, differenced against `?groups=0`, canvas only:

```text
  type 2  Flame   #ffcc00/#ff0000   R +64.6   G  +5.0   B -15.9    1586 movers
  type 3  Frost   #00ccff/#000099   R -17.1   G  +5.6   B +45.4    1456
  type 4  Poison  #00ff00/#006600   R -19.7   G +37.9   B -20.0    1188
  type 5  Wraith  #cccccc/#000000   R +11.2   G  +7.7   B  +9.0    1042
```

  Each dominant channel is that enchantment's own colour. The ladder that chose
  the frame came from the bytes; the colour came from the render. **Null
  control: 0 pixels differing, two byte-identical files.**
- **`tools/shot-live.mjs` / `tools/shot-live.sh` are the instrument**, and the
  part that mattered was not CDP — it was pinning `performance.now` and
  `Date.now` to the FRAME NUMBER. **A frame count alone is not determinism on a
  page that animates on elapsed time**: without the clock the same pair
  differenced to 9,900 pixels at B +5.1, with it 2,822 at B +45.4, and the
  difference was the weapon having moved.

**What still stands from the original ranking:** ~~the 3.9x frame cost~~ is
retired, see above; the twelve figure-pack groups still reach no gladiator
(ranked item 2); the strength half of every glow is still carried and not drawn
(ranked item 3). **Those two are the live work.**

---

*(Everything below is the handoff as first written and pushed.)*

## The one-sentence version

The figure and icon extractors carry the filters they were dropping, a new tool
derives the weapon-enchantment ladder from the AVM1 bytes, the renderer
composites it — **and the one group that reaches a gladiator hangs a headless
render for a reason I could not find.**

## Highest-value work, ranked

1. **THE HANG, AND EVERYTHING I RULED OUT IS IN THE COMMIT MESSAGE SO YOU DO NOT
   REPEAT IT.**
   ```text
     seed=7&perSide=1&seam=1                 shoots in   3s
     seed=7&perSide=1&seam=1&enchant=3.2     killed at 100s, 140s, 280s
     …&enchant=3.2&groups=0                  shoots normally
   ```
   **The wall time is IDENTICAL at `--virtual-time-budget` 1200, 2500 and 6000.**
   A per-frame cost would scale with the budget; this does not, so it is a hang.
   ► **THE GEOMETRY IS MEASURED SANE AND IS NOT THE CAUSE.** `groupRunsOf`,
     `runBoxOf`, `filterBleedOf` and `bufferRegionOf`, lifted into node and run
     over the real ops at the real CTM, give ONE buffered run of 19 ops, box
     538.2..725.2 x 391.5..475.4, bleed 28.2103, region **244x141 UNCLAMPED**,
     filter `drop-shadow(0px 0px 2.6625px rgba(0, 204, 255, 1)) drop-shadow(0px
     0px 5.4076px rgba(0, 0, 153, 1))`. Everything node can see is fine, so
     whatever hangs is a canvas call node cannot reach. The scratch harness is
     at `scratchpad/lift.mjs` — rebuild it, it is twenty lines.
   ► **I ALSO RULED OUT**: `paintGroupRuns`'s `save`/`restore` balance (matched),
     `groupBufferAt` (bounded, one canvas per depth), `opSpaceRunsOf` (no
     index that fails to advance), `drawFigureOperation` (no recursion),
     `path2dFor` (cached by `d`).
   ► **IT IS CONFINED TO THE `?enchant=` DEMO FLAG.** `tools/arena/roster.js`
     and `src/team/ss2-rules.js` both default `weapon_enchantment_type: 0`, so
     no gladiator the engine produces is enchanted. That is why it ships with a
     warning printed AT the flag rather than reverted. **I have no screenshot of
     the glow and I am not claiming one.**

2. **THE TWELVE GROUPS IN THE FIGURE PACK REACH NO GLADIATOR AT ALL**, found
   independently by three verifiers. Every one of the 12 group entries and 30
   grouped placements sits on `psyche_up`, `psyche_up2`, `psyche_charging` or
   `psyche_charging2`, and all four are declared unplayed in
   `src/render/clip-labels.js`. Swept 44,880 and 73,440 family x label x facing
   combinations: reached **0 times**. So the body half of the effect work is
   dead until a family dispatches a psyche clip. Pinned by a test, so BUILDING
   that family turns the suite red rather than quietly outliving the paragraph.
   **Building it is the cheapest way to make this feature visible** — and it is
   a deliberate, testable edit, because `clip-labels.js` already asserts that
   `FAMILY_LABELS` and `UNMAPPED_CLIP_LABELS` partition the 101 labels exactly.

3. **THE STRENGTH HALF OF EVERY GLOW IS CARRIED AND NOT DRAWN.** `rgbaOf` clamps
   alpha to [0,1] and alpha is `colour.alpha/255 * strength`, so every strength
   at or above the clamp emits `1` and **two different strengths draw
   byte-identically**. A verifier flattened all nine of `psyche_up2`'s outer
   strengths and the ten filter strings stayed ten — the BLUR alone was carrying
   the distinctness — so 17 of 18 strength values could be set to anything with
   the suite green. `canvasFilterFor` now names `shadowStrengthSaturated` apart
   from `shadowStrengthAsAlpha`: the figure pack reads **23 saturated / 1
   scaled** (the 1 is the only value below the clamp, 0.9765625) and **all 24
   enchantment filters saturate.** Closing it needs an offscreen alpha pass or
   an SVG filter; counting it was the honest first move.

4. **RE-RUN THE MUTATION AUDIT. Ranked fifth three times and now fourth**, still
   not done, and ~6,600 more lines of render and extractor code landed tonight.
   `docs/mutation-audit-2026-09-07.md` has the method and two traps. Everything
   I mutation-checked this session was checked BY HAND, one mutant at a time.

5. **THE GREEN BAND IS STILL OPEN.** Unchanged from the 04:00 brief; measure at
   the frame it was reported at.

## WHAT I GOT WRONG, IN FULL

► **I TOLD AN AGENT THE GLOW "ENCLOSES THE ATTACHED BLADE AND NOT THE `weapon`
  LIMB'S OWN RIG ART EITHER". THAT IS FALSE AND IT WAS IMPLEMENTED FAITHFULLY.**
  Char 701 sits at depth `[39, 1, 1]` on all 2,216 such placements — INSIDE the
  `realweapon` placement that wears the filter — so the build's glow encloses it
  too. The faithful scope is the union, `op.limb === "weapon"`: **19 ops, not
  8.** A verifier broke it from the bytes.
  ► **AND THE TEST THAT SHOULD HAVE CAUGHT MY CORRECTION COULD NOT.** Its
    fixture's only body placement was on `torso`, so the wrong scope and the
    right one both passed it. **A fixture that lacks the discriminating input
    turns an assertion into decoration.** Corrected and mutation-checked.
► **I SAID "else frame 1" ABOUT `itemglow` AND IT DOES NOT.** The only frame-1
  arm is `enchant_type < 2`; the body ends with no trailing default, so for a
  type >= 6, a potency outside 1..3 (**including the 0 `randomise_gladiator`
  zeroes to**) and a NaN type, `gotoAndStop` is never called and the clip keeps
  its current frame.
► **I SAID "inner"/"outer" GLOW MEANING BLUR SIZE, WHICH IS NOT THE SWF FLAG.**
  All 48 glows in both packs are `inner: false`. A verifier noted that
  `canvasFilterFor` REFUSES `filter.inner`, so had the extractor flagged them
  inner, all twelve groups would have drawn nothing at all.
► **I CALLED THE ENCHANTMENT SELECTOR "NOT FOUND" ON THE LIVING HEAD'S WORD.**
  `docs/integration/ss2-battle-map.md` found it 2026-09-13. The living head was
  stale and is corrected at the instruction.
► **MY OWN CENSUS GUARD COULD NOT FIRE.** `frozen.sprites.length` where
  `frozen.sprites` is a count: `undefined > 0` is false, so the sprite line
  silently never fired while the filter line beside it did — the same defect the
  census exists to count, committed inside the fix for it.
► **H6's "176 filters" MIXED UNITS** — it counts a group's filters once per
  leaf, which `effectSummaryFor` forbids by name.

## THE BATTLE MAP HAD THE ENCHANTMENT ARGUMENTS INVERTED SINCE 2026-09-13

Which is the most dangerous place in this repository for an error, because
AGENTS.md says candidates are derived from it. It read `itemglow`'s outer
register as POTENCY, found the contradiction with `damagecharacter` that
follows, and **wrote it down as an open question that "only a capture of a
gladiator with a known enchantment settles"** — a capture session spent on
something the bytes answer. Corrected, with seven witnesses; the first is the
build's own `weaponenchantments = ["","","Flame","Frost","Poison","Wraith"]` at
`0x3fe79c`.

**The lesson is worth more than the correction: an inconsistency between two
readings of one build is evidence that a reading is wrong before it is evidence
about the build.**

Three things fell out of it, none recorded before: the no-op default above;
**opponents CAN be enchanted** (`enchanted_possibility > 450`, `0x404897`), so
the glow is reachable in ordinary play once the engine writes those fields; and
**the primary's level-banded potency ladder is DEAD CODE** — all three arms fall
into an unconditional `randomBetween(1, 3)` at `0x404999`, which also costs a
second RNG draw any replay must make. The secondary's ladder is live.

## Hard rules

- **`tools/shot.sh` LEAKS A CHROME PROCESS PER INVOCATION — 73 WERE ALIVE.**
  They accumulate until new ones cannot start, and the symptom is screenshots
  failing for URLs that worked minutes earlier, which reads as a page defect and
  is not. **Kill them before trusting a FAILED shot**:
  `powershell.exe -NoProfile -Command "Stop-Process -Name chrome -Force"`. This
  masked the real hang for half an hour by making working URLs fail too.
- **A COUNTER THAT ONLY EVER SEES ZERO IS NOT A COUNTER.** Four mutants survived
  in `figureEffectCensusOf` because every input to it had no own filters.
  Deleting either increment outright left the suite green.
- **A HAND-COPIED KEY LIST IS A SECOND THING TO GET WRONG.** The shell test's
  duplicate of `figureGroupPaint` drifted on a rename and the tally came back
  `NaN` — a silent wrong number, not a failure. The keys are read from the
  shell's own literal now.
- **AN APPROXIMATION THAT IS NAMED BUT NOT SPLIT IS STILL HALF-COUNTED.**
  "shadowStrengthAsAlpha" covered both "the strength scaled the alpha" and "the
  strength was discarded at the clamp". Only one of those is an approximation.
- **COUNT WHAT THE INSTRUMENT NEVER LOOKED AT, not only what it dropped.** Every
  drop counter in `extract-figure.mjs` was honest while 24 glows sat unread
  behind `flattenFrame`'s frame-1 freeze.
- **STATE A BRIEF'S PREMISES AS NUMBERED HYPOTHESES AND INVITE THEIR
  DESTRUCTION.** Six broke across two waves. Every one was worth more than the
  task it interrupted.
- **AGREEMENT BETWEEN AGENTS GIVEN ONE BRIEF IS WEAK EVIDENCE.** I gave a
  verifier only my reading of `itemglow` and the battle map's contradicting one
  never reached it; I had to settle that myself afterwards.
- **DO NOT `git add -A` WHILE AGENTS ARE RUNNING.** Both waves committed after.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES CHROME OR REGENERATES `assets/`.**
- **Ship no SS2 asset.**
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
