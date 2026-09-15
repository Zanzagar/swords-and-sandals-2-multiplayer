---
handoff:      2026-09-15-0046--the-tint-landed-and-the-trail-vanished
written:      2026-09-15 00:46 -0400
sessionId:    b0bd5c51-edb6-460a-893e-dfcabc590319
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      2281ef4..HEAD — ONE commit, `b9ccdff`, pushed, 0 unpushed at the
              time of writing. **Re-measure; never copy.**
suite:        1740 / 1739 / 0 / 1 before this handoff commit, EXIT 0.
              **Re-measure BY EXIT CODE.** It moved 1651 -> 1712 -> 1739 -> 1740
              across two waves and a serial pass. `fail == 0` and the exit code
              are the gate; the total is not.
agentRuns:    TWO waves, 12 agents each. Wave 1: 5 writers + 1 shell + 6
              verifiers, 12/12 returned, 0 dead, 0 ownership violations. Wave 2
              (close-out): same shape, 12/12, 0 dead, 0 violations. **Twelve
              verifier verdicts: 1 CONFIRMED, 10 PARTIALLY-BROKEN, 1 BROKEN —
              22 of 23 on this project.**
supersedes:   2026-09-14-1712--the-screens-are-drawn-and-five-are-black-on-purpose,
              whose ranked items 1, 3, 4 and 6 are closed and whose item 2 is
              HALF closed — see ranked item 1 below, which is the other half.
next:         **APPLY THE FILTERS IN `src/render/screen.js`.** The extractors
              now carry them and NOTHING READS THEM, so the picture has not
              changed by one pixel. `canvasFilterFor` over the real rosters was
              0 applied before this session and is 214 now — the data is there
              and the renderer walks past it. See ranked item 1.
---
# Handoff — the tint landed, and it made the arrow trail vanish

## The one-sentence version

The colour transform moved into `src/render/props.js` and the arena's UI bar is
the build's own translucent black instead of a white strip — and applying it
revealed that **fourteen of the twenty bows had been drawing no arrow trail at
all**, which nothing could see while the alpha was being thrown away.

## WHAT YOU CAN SEE TODAY

`node tools/arena-server.mjs --host 0.0.0.0`, then from Windows
`http://<hostname -I>:8123/tools/arena/index.html`. **Verified reachable from
Windows; curling from inside WSL proves nothing and four sessions got that
wrong.** `tools/shot.sh <name> "<query>" [w] [h] [page]` — fifth argument is the
page.

Measured this session at 1600x1200, `arena=1&sky=60`, by `tools/sample-png.mjs`:

```text
  row 1030   #ffffff x1268  ->  #30160c x1268    the plate, translucent at last
  row 1037   glyphs present, #ffffff x93
  row 1042   glyphs present, #ffffff x31
```

The arena's log panel now reads `props: tint applied in props.js — 7246/8682
ops`, where it used to say *"colour transform: composed here — belongs in
src/render/props.js"*. **That decision is no longer in the browser shell**, and
`tools/arena/main.js` lost `tintedPropOpsFor`, `probeColourTransform`,
`firstTintedPlacement`, `onePlacementPack` and its own tally with it.

## THE DEFECT THE FIX EXPOSED, because it is the transferable part

`arrowTrailOpsFor` passed the WEAPON's art index (`secondary_weapon - 60`,
1..20) into `bullet_trail`, a clip with SEVEN frames. Frames 7..20 clamped to
frame 7, whose `alphaMultiplier` is 0.

```text
  bow 61  -> 0.699    bow 66 -> 0.117    bow 67 -> 0    bow 80 -> 0
```

**It was wrong before this session and invisible, because `propOpsFor` was
dropping the alpha anyway.** Applying the transform correctly is what turned a
latent error into fourteen bows with no trail.

► **THE BUILD SETTLES IT AND THE EXTRACTOR HAD ALREADY QUOTED THE BYTES.**
  `trail.bullet.gotoAndStop(secondary_weapon - 60)` — the receiver is
  `trail.bullet`, a CHILD named `bullet` inside the attached puff, so the weapon
  picks the ARROW DRAWING carried in the puff. `PROP_EXPORTS` in
  `tools/extract-props.mjs` had that exact line in its docstring and recorded
  `indexedBy: "secondary_weapon - 60"` beside it. **The evidence was right and
  the conclusion next to it was wrong**, which is this project's signature
  failure in a new place.
► **THE DISPLAY LIST SAYS IT WITHOUT AN INTERPRETER, and that is the stronger
  reading.** Sprite 48 has seven frames, every one placing character 47 at depth
  1 under the instance name `bullet`, identity matrix, blend mode 5, with only
  `alphaMultiplier` moving: 0.699, 0.582, 0.465, 0.352, 0.234, 0.117, 0. Frame 7
  then carries `this.removeMovieClip(); _parent.removeMovieClip(); stop();` —
  **the puff deletes itself**, so the seven frames are its whole life, not a
  lookup with fourteen dark entries.
► The parameter is `ageFrames` now, deliberately 0-BASED where `arrowOpsFor`'s
  is 1-based, because an age and a frame index are both small positive integers
  and either produces a plausible-looking puff.

## Highest-value work, ranked

1. **APPLY THE FILTERS IN `src/render/screen.js`. THE DATA IS THERE NOW AND
   NOTHING READS IT.** The last handoff ranked this second and said the blocker
   was the extractors. That was right, and the blocker is gone: `props.json`
   carries 363 effect groups over 3209 placements, `screens.json` carries 276
   typed filters (dropShadow 16, glow 145, bevel 2, blur 56, colourMatrix 57).
   ► **BUT THE PICTURE HAS NOT CHANGED BY ONE PIXEL**, and a verifier proved the
     number I asked it for could not vary: `prefixesOf` in `screen.js` reads only
     `entry.path` off `filteredPlacements` and nothing reads `entry.filters`,
     `screen.filteredButtonRecords` or `objects[].filters`. `screen.js`'s output
     is invariant under those records being correct, garbage or absent.
   ► The varying evidence exists and was measured: **`canvasFilterFor` over the
     real rosters was 0 applied before this session and is 214 now.** The
     renderer can consume them; it simply does not.
   ► `help` still invoices `filtersNotAppliedOps 650`. `townsquare`'s 93% still
     stands.

2. **RE-RUN THE MUTATION AUDIT — ranked fifth twice now and still not done**,
   and ~7,500 more lines of render code landed tonight. `docs/mutation-audit-
   2026-09-07.md` has the method and two traps worth re-reading: a scratch copy
   built without `.git` is not a valid baseline, and byte-identical lines must be
   mutated BY LINE NUMBER. That audit covered `src/engine` and `src/golden`;
   **`src/render/` has never had one**, and it is now the largest unaudited
   surface in the repository. Two waves of verifiers are not a substitute — they
   check what a writer just wrote.

3. **EIGHT TESTS ADDED ACROSS THE TWO WAVES STAY GREEN UNDER A FULL REVERT**, by
   a verifier's count, and I closed only the ones it named individually. It
   listed them with file and test name in its report; the class is what matters —
   a test that cannot fail reports coverage that does not exist. **Read
   `test/render-screen.test.js:1666`'s neighbours** and anything asserting a
   count is ZERO, since zero is also what a stubbed implementation returns.

4. **`filteredButtonRecords` IN `tools/extract-screens.mjs` REACHES ZERO
   OPERATIONS ON THE ORACLE** — 5 filters over TEXT, reaching no drawable — and
   its only test is synthetic. A roster that cannot fire, described as though it
   does, is the same defect as a count that cannot vary. Either find the real
   case or say plainly in the code that it is unreachable on this build.

5. **THE GREEN BAND IS STILL NOT SETTLED** and the 17:12 handoff's entry stands
   unchanged: graded olive greens in a radial burst at stage y about -75..-45,
   ABOVE the stage, painted into the letterbox, at `arena=1&sky=60`. Shots at
   `sky=120` and `sky=180` failed under wave load and were never retried.
   **State the query string beside any pixel measurement of a surface with six
   arenas and 200 sky frames.**

6. **SMALLER, ALL NAMED BY A VERIFIER, NONE FIXED:**
   ► `tools/extract-props.mjs`'s `refuse()` docstring claims every drop in the
     file goes through it; **the mask branch bypasses it**, so `notCarried` is
     not the complete list it says it is.
   ► `effects.inheritedFilters` — the 570 quoted four times in that file — is
     pinned by nothing.
   ► `nestedSprites` never enters a button, so a filtered placement inside a
     button's subtree is in neither roster and in no count.
   ► An empty FILTERLIST on a button record is dropped by a bare `continue` and
     counted nowhere, while the placement path treats the same case as evidence.

## WHAT THE VERIFIERS BROKE, and what I fixed rather than argued

► **A NUMBER THAT COULD NOT VARY.** Wave 1's headline "0 own filters in the
  build" was swept downstream of the discard that drops the only two
  own-filtered placements — `panel`, characters 1527 and 1528, each carrying its
  own glow. **The sweep could not have returned anything else.** They are
  counted by name as refused now: `[+ 2 own filter(s) ... REFUSED on 2 skipped
  drawable(s): 2 glow]`.
► **THIRTEEN REAL-PACK TESTS THAT PASSED WITH A BROKEN PATH.**
  `test/render-screen-text.test.js` guarded all of them on a bare
  `fs.existsSync`. Measured both ways in a scratch copy, same broken path
  derivation: **unanchored 41 pass / 0 fail; anchored, a named failure.** The
  anchor is a TRACKED file, so a fresh clone still reads as a fresh clone.
► **A TEST THAT MEASURED A COUNTERFACTUAL.** It fed the FIXED wrapper the OLD
  argument and reported 15 dark bows. The shipped defect was **14** — bow 66
  mapped to frame 6, alpha 0.117, faint but drawn. The comment claimed to
  "RE-DERIVE rather than quote", which made it worse than a quotation.
► **SEVEN POINTERS TO LINES THAT DO NOT HOLD THAT CODE** (`screen.js:647`,
  `props.js:366`). Cited by SYMBOL now — `emitDrawable`, `emitPropOps` — which
  does not go stale when a file grows 300 lines.
► **CORRECTING THE POINTER IS NOT CORRECTING THE POINTEE.** `text.js` struck its
  own copy of the alignment claim and NAMED `tools/screens/main.js:94-106` as
  stale — and did not change it, so a reader of that file still met a live bug
  report for a fixed bug. **Ninth instance of the signature failure here, and the
  first created by a previous fix's own note.**
► **`paint time 0.0 ms` — THE ARITHMETIC WAS FINE AND THE LABEL WAS THE
  DEFECT.** It times the JS loop that ENQUEUES canvas commands; the browser
  batches rasterisation and `performance.now()` is coarsened, so a sub-tick
  answer is the expected result. Relabelled `ops enqueued in` rather than
  deleted, with the reason at the stopwatch.

► **AND ONE VERIFIER FINDING IS RECORDED AS WRONG RATHER THAN OBEYED.** It
  called two `approximated` shapes in one merged array fatal. Measured: 209
  strings and 65 lists do coexist — **and there is exactly one documented reader
  that takes both** (`approximationMarksOf`), the op-level consumer uses it, and
  the placement-level field is uniformly an array. A tolerant reader at a named
  seam is a design. **Do not rewrite four files to satisfy it.**

## What I got wrong this session, in order

► **I BRIEFED `bullet_trail`'s INDEX FROM THE MAP, NOT THE BYTES**, and told an
  agent to check me. It did, disassembled `+0x7249..+0x7276`, confirmed the
  reading and found the `removeMovieClip` I did not have. The habit is what
  worked, not the reading.
► **MY FIRST TRAIL-ROTATION TEST ASSERTED THE WRONG THING TWICE.** It asked at
  progress 1, where all six kept puffs are past the 170° clamp and share one
  rotation, so it fired against correct code; then its clamp half used a flight
  too short to reach the clamp at all. **Both failures are now pinned as the two
  halves of one test**, because a test that only saw the clamp could not tell a
  carried rotation from a hardcoded one — which is exactly what fooled me.
► **I RAN TWO WAVES WHERE THE ADR SAYS A WAVE IS THE LAST RESORT.** They were
  build waves with disjoint file ownership, not question fan-outs, and both
  returned 12/12 with zero violations — but I stopped at two deliberately and
  closed the rest serially. **Say what a wave will spawn before launching it**,
  which I did, and count `started == briefs`, which I did.

## Hard rules

- **ASK WHAT YOUR EVIDENCE COULD POSSIBLY VARY OVER.** Two waves and the
  sharpest finding is still this one. If no input could change the number, the
  number is not a check — however correct the code under it.
- **A POINTER IS NOT A FIX.** Correct the sentence where the reader will meet
  it, not only where you noticed it.
- **CITE SYMBOLS, NOT LINE NUMBERS.** Seven citations went stale in one day.
- **AN APPROXIMATION THAT IS NOT COUNTED IS INDISTINGUISHABLE FROM A CORRECT
  READ**, and an uncounted `continue` is the same defect.
- **LOOK AT IT, AT A SIZE WHERE THE THING WOULD BE VISIBLE, THEN READ THE
  PIXELS.** `tools/shot.sh` then `tools/sample-png.mjs`; `?probe=1` asks the
  canvas itself.
- **NO AGENT LAUNCHES CHROME.** It died at the OS level under six concurrent
  agents last session; every shot this session was taken serially, after.
- **NO AGENT REGENERATES `assets/`.** It is the shared substrate every track
  measures against. Extractors run into scratch; the main session regenerates
  serially and re-runs the suite — which is how the new pack shape met the
  renderer for the first time, with no regression.
- **`cp -r`, NEVER `cp -al`.** Hardlinks left a verifier's scratch copies
  sharing inodes with live repo files.
- **DO NOT `git add -A` WHILE AGENTS ARE RUNNING.** Committed by name.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **STATE A BRIEF'S PREMISES AS NUMBERED HYPOTHESES AND INVITE THEIR
  DESTRUCTION.** Every premise break this session came from having done that.
- **Ship no SS2 asset.** `assets/` is gitignored AND
  `test/asset-attestation.test.js` fails if anything under it is tracked.
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
