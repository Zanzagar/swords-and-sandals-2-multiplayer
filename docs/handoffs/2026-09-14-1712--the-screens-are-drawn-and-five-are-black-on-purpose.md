---
handoff:      2026-09-14-1712--the-screens-are-drawn-and-five-are-black-on-purpose
written:      2026-09-14 17:12 -0400
sessionId:    628dbabf-c340-4d00-b1af-5bad70a42d00 (https://claude.ai/code/session_015ZjAGpPyk9ufCPdoAx8npP)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      9a7cb7c..HEAD. **Re-measure; never copy.**
suite:        1651 / 1650 / 0 / 1 before this commit, EXIT 0.
              **Re-measure BY EXIT CODE.** It moved 1573 -> 1628 -> 1651 across
              two waves and a verifier saw the tree RED mid-flight while another
              track was editing. `fail == 0` and the exit code are the gate; the
              total is not.
agentRuns:    TWO build waves. Wave 1: 4 writers + 4 verifiers, 8/8 returned, 0
              dead, 0 ownership violations. Wave 2: 6 writers + 6 verifiers,
              12/12 returned, 0 dead, 0 ownership violations. **All ten verdicts
              PARTIALLY-BROKEN, which is 16 of 16 on this project.**
supersedes:   2026-09-14-1400--five-modules-exist-and-two-are-not-drawn-yet,
              whose ranked items 1 and 4 are closed and whose item 2 is BLOCKED
              upstream (see ranked item 2 below).
next:         **CARRY THE COLOUR TRANSFORM IN `src/render/props.js`.** One
              change fixes the arena's layers, the arrow trail and the scenery
              together, and DELETES a decision now sitting in the browser shell.
              See ranked item 1.
---
# Handoff — the screens are drawn, and five of them are black on purpose

## The one-sentence version

All 26 root screens now draw and the arena's UI bar reads its own words in the
build's own letterforms — and the interesting half of the session is what the
twelve adversarial verifiers found in the code that did it.

## WHAT YOU CAN SEE TODAY

`node tools/arena-server.mjs --host 0.0.0.0`, then from Windows
`http://<hostname -I>:8123/tools/screens/index.html`. **Verified reachable from
Windows; curling from inside WSL proves nothing and four sessions got that
wrong.**

```text
  tools/screens/index.html   ALL 26 SCREENS. ?screen=<name>, arrows to walk.
                             `help` renders WHOLE — parchment, shield, mace,
                             helm, the return button, and 656 glyph operations
                             of readable English in Goudy Handtooled.
    ?probe=1                 THE PAGE READS ITS OWN CANVAS BACK. Distinct
                             colours, opaque pixel count, the fit, the
                             placement. This is what settled "1698 operations
                             painted" against "the canvas looks black".
    ?clip=0 ?holes=1 ?edge=1 stage clip off; undrawn text boxes outlined;
                             the 640x420 edge drawn.
  tools/arena/index.html     the bar now reads TOOLTIPS:OFF   SOUND:ON
```

► **`tools/shot.sh` TAKES A PAGE PATH AS ITS FIFTH ARGUMENT NOW.** It hardcoded
  `/tools/arena/index.html`, so a second page could not be shot at all. The
  first four arguments are unchanged and every existing caller still works.

## THE TWO PICTURES, PINNED BY PIXELS

Neither of these was verified by looking. **Looking is how this project produced
two confident wrong conclusions in one evening.**

The UI bar, `tools/shot.sh` at 1600x1200, `arena=1&sky=60`, same rows before and
after:

```text
  row 1030   #000000 x1270  ->  #30160c x1268   the plate, now translucent
  row 1037   #000000 x1270  ->  #ffffff x51     GLYPHS
  row 1042   #000000 x1270  ->  #e5e1e0 x69     GLYPHS
```

`townsquare`, through `?probe=1`, which is the reading that matters:

```text
  canvas 818x2785, 142 distinct colours, 439266 opaque px
  #000000 x435374  #ffffff x2580  #bfbfbf x817  #808080 x71 ...
  ops=1704 painted=1698
```

**It is drawing. 99.1% of what it draws is black**, and the page says why in its
own invoice.

## Highest-value work, ranked

1. **CARRY THE COLOUR TRANSFORM IN `src/render/props.js`, and delete the copy
   now sitting in the browser shell.** `propOpsFor` drops each placement's
   colour transform. The arena's UI bar was a blank WHITE strip for the same
   reason it was wordless — its plate is `rgb x0, alpha x0.5` and its two fields
   are `#ffffff`, so **the missing tint and the missing words were ONE defect,
   not two.** `tools/arena/main.js` composes it at its own injection seam today
   and says so in its own log panel: *"colour transform: composed here — belongs
   in src/render/props.js"*. That is a decision living where no test can reach
   it, which is the arrangement this project has taken five live defects out of.
   ► `propOpsFor` should carry `placement.colour` onto each operation the way
     `screen.js` and `extracted-figure.js` already do through `filters.js`. One
     change fixes the arena layers, the arrow trail and the scenery together,
     and `probeColourTransform` in the shell turns itself off the moment it
     lands, so the two can never both apply it.
   ► **AND IT UNBLOCKS 28 TINTED OPS THAT ARE INVOICED AS OUT OF REACH.**
     `bullet_trail`'s 7-frame alpha fade is 0.70, 0.58, 0.46, 0.35, 0.23, 0.12,
     0.00 — every puff currently draws at FULL opacity and the seventh, which
     should be invisible, draws solid. `arrowTrailOpsFor`, `arrowOpsFor` and
     `arenaSceneryFor` call `propOpsFor` inside `props.js` and take no injected
     reader, which is why this was counted rather than worked around.

2. **THE FILTERS CANNOT BE APPLIED AND THAT IS AN EXTRACTOR PROBLEM, NOT A
   RENDERER ONE.** The 14:00 handoff ranked "apply the filters" second. **The
   data never leaves the extractors**, and the arena page now reports it:
   `props: NO filter data in the pack — see extract-props.mjs`. Nothing was
   fabricated to make the picture prettier, which was the right call.
   ► `tools/extract-props.mjs` (~line 453) must write `drawable.filters` and
     `drawable.blendMode`, **which `flattenFrame` already returns and it
     discards.**
   ► `tools/extract-screens.mjs` (~line 944) writes `filters: true` where it
     must write the filter LIST.
   ► The prize is large and is already counted: **1525 of `townsquare`'s
     operations sit under a FILTERLIST nothing applies — 93% of that screen**,
     and 9423 of 13638 across all 26. Drop shadows and glows are missing
     everywhere and the picture is otherwise right, which is exactly the kind of
     wrongness that reads as finished.

3. **`flattenFrame` FREEZES A NESTED SPRITE AT ITS FRAME 1, AND ON FIVE SCREENS
   FRAME 1 IS A CLOSED BLACK CURTAIN.** `townsquare` 9, `daybreak` 8,
   `special_event` 8, `special_event_result` 8, `magicshop` 8, `arena_intro` 8 —
   against 0 on `credits`, `help`, `showfig`, `gameover`, `bugs` and
   `gameover_demo`, which all draw. **This is the SAME root cause the living
   head already records for the sky's 8 unreachable gradients**, surfacing in a
   second place, and it is now counted per screen as `nestedSpriteFrame1`.
   ► The viewer track's own suggestion is worth taking: a `blanketsTheStage`
     count in `screen.js` would make this self-announcing rather than something
     you find by squinting at a black rectangle.

4. **ALIGNMENT IS A NO-OP FOR 108 OF THE BUILD'S 256 TEXT FIELDS.**
   `fieldLayoutOptionsFor` in `src/render/text.js` passes `maxWidth: Infinity`
   for any field that is not `wordWrap && multiline`, and a centred or
   right-aligned field with infinite width is left-aligned. Measured: 101
   centre, 30 right. Found by the viewer track, in a file it did not own.

5. **RE-RUN THE MUTATION AUDIT. It was ranked fifth by the last handoff and is
   still not done**, and roughly 3,000 more lines of render code landed since.
   The last one found 37 of 48 one-line breakages surviving the suite. **Two
   waves of adversarial verifiers are not a substitute** — they check what a
   writer just wrote, not what was already there.

6. **SMALLER, ALL NAMED BY A VERIFIER OR A WRITER, NONE FIXED:**
   ► `src/render/text.js:713` stamps `op.approximated ?? field.approximated`, so
     an operation can carry only ONE approximation mark. `screen-text.js` fixed
     the symptom at its own seam and documented the cause at it.
   ► `tools/extract-props.mjs` and `tools/extract-wardrobe.mjs` give NO per-entry
     invoice (0 of 56, 0 of 401). `extract-figure.mjs` now gives all 351. The
     honesty test reports the vacuity rather than hiding it, but the gap is real.
   ► **`paint time 0.0 ms` for 1698 operations is not a credible number** and it
     is on screen in the invoice. Either fix it or remove it; a measurement that
     cannot be right is worse than no measurement. Related: `screen-text.js`'s
     header claims 336 ms for all 26 screens and a verifier measured 94-106 ms
     warm — the header number was taken during a six-agent wave and was not
     corrected, deliberately, because a number measured under that load would be
     a worse claim than the one already there.
   ► `arena_intro` renders as a blue field with one enormous face element and
     reports 8/8 bitmaps and 4/4 gradients drawn. **Nobody has checked that
     against the game.** It may be correct.

## WHAT THE VERIFIERS FOUND, because it is the most transferable thing here

► **A DIGEST OVER DATA THAT CANNOT VARY IS NOT EVIDENCE.** Wave 1's strongest
  claim was that folding `screen.js`'s duplicate colour transform changed no
  rendered value — the complete operation list for all 26 screens digested
  byte-identically before and after. Its verifier then **deleted the colour
  transform from gradient stops entirely and the digest stayed byte-identical**,
  because all 107 transformed gradient stops on those screens sit under
  ALPHA-ONLY transforms. The pack structurally cannot exercise stop-fill
  tinting. **Ask what values your evidence could possibly take.**

► **`assert.equal(X, X)`.** `tally.unplacedInBuild` was asserted against
  `SS2_UI_BAR_UNPLACED.length` while the module computed it as
  `SS2_UI_BAR_UNPLACED.length`. It was the only number reporting the two
  readouts the build writes into objects it never places.

► **A FIX CAN HAVE NO COVERAGE AT ALL.** Wave 1's headline extractor fix could
  be deleted with the suite staying green: **no test in this repository called
  `extractFigure`.** Its only guard read the gitignored on-disk pack, which
  reflects the code only after a manual re-run — and on a fresh clone executed
  `assert.equal(null, null)` and returned.

► **TRACK E CHANGED NO SOURCE FILE AT ALL.** All eight defects it was sent to
  fix were in the test. It found ELEVEN survived mutations where the brief named
  seven, ran 23 and killed 22, and argued its one deliberate omission instead of
  hiding it: a `note` is prose, and the only assertion that pins prose exactly is
  the `assert.equal(X, X)` it was there to remove. So it pinned what the note
  CLAIMS, against the oracle, instead.

## WHAT WENT WRONG, so it does not go wrong again

► **A VERIFIER BUILT SHADOW TREES WITH `cp -al` AND SAID SO.** Hardlinks left
  repo files sharing inodes with its scratch copies — `stat -c %h` read 3 on a
  live repo file — so any in-place write inside its own tree would have
  corrupted the repository. It unlinked the three files it mutated before
  mutating them, tore both trees down, and proved link count 1 and unchanged
  hashes afterwards. **Use `cp -r`, not `cp -al`.** The disclosure is why this
  is a note and not a disaster.
► **CHROME DIED AT THE OS LEVEL UNDER SIX CONCURRENT AGENTS** — *"The paging
  file is too small for this operation to complete. (0x5AF)"*. The track
  affected never reported a render conclusion from a failed shot; it measured
  the transform chain offline and said so. **A failed shot is not a failed
  render**, and the reverse matters more: do not let a load failure become a
  finding.
► **I BRIEFED FOUR WRONG PREMISES ACROSS THE TWO WAVES AND AGENTS BROKE ALL
  FOUR** — that `staticTextOpsFor` composes an outer matrix (it REPLACES, and
  the obvious join draws 22 of 70 static runs up to 94.42 px out of place), that
  the UI bar's two fields hold the sound toggle and the tooltip LINE (the second
  is the toggle's LABEL; the tooltip line is `tooltip_box.tooltip`), that a morph
  baked at one ratio is an approximation (it is exact for its placement ratio),
  and that seven mutations survived in `arena-backdrop.js` (eleven did).
  **Every one was caught because the brief numbered them and invited their
  destruction.** Keep doing that.

## Known, measured, unexplained

► **THE GREEN BAND IS NOT WHAT THE LIVING HEAD SAYS, AND I HAVE NOT FINISHED
  IT.** That entry calls it *"char 642, the backdrop's `#66ff99` placeholder,
  3.4 stage pixels tall at the top of the stage"*. Measured this session at
  `arena=1&sky=60`: graded olive greens (`#465b41`, `#4a5e43`, `#4e6145`) in a
  radial burst at **stage y about -75..-45 — ABOVE the stage, painted into the
  letterbox**, with pure black between it and the stage top. At `sky=1` the same
  column is page background: nothing is painted there at all.
  ► So it is **the sky clip drawing unclipped outside the 640x420 stage, and it
    varies with the sky frame.** What I have NOT established: whether the
    original observation was at a frame where char 642 is what shows (both can
    be true at different frames), and whether clipping to the stage is correct —
    the build's own behaviour is the arbiter and I did not read it.
  ► **THE ORIGINAL ENTRY DOES NOT STATE ITS PARAMETERS, which is why this cannot
    be settled by re-reading it.** State the query string beside any pixel
    measurement of a surface that has six arenas and 200 sky frames.
  ► Shots at `sky=120` and `sky=180` FAILED (chrome, under wave load) and were
    not retried. Re-measure the night frames before concluding.

## Hard rules

- **ASK WHAT YOUR EVIDENCE COULD POSSIBLY VARY OVER.** A count, a digest or a
  sweep over data that cannot change is not a check. This is the sharpest thing
  either wave produced.
- **AN APPROXIMATION THAT IS NOT COUNTED IS INDISTINGUISHABLE FROM A CORRECT
  READ**, and an uncounted SWALLOW (`catch { continue; }`) is the same defect.
- **LOOK AT IT, AT A SIZE WHERE THE THING WOULD BE VISIBLE, THEN READ THE
  PIXELS.** `tools/shot.sh` (fifth argument is the page), then
  `tools/sample-png.mjs`. And when a tally and a picture disagree, `?probe=1`
  asks the canvas itself.
- **DO NOT `git add -A` WHILE AGENTS ARE RUNNING.** Name the files. Both waves
  were committed by name.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **STATE A BRIEF'S PREMISES AS NUMBERED HYPOTHESES AND INVITE THEIR
  DESTRUCTION.** Four of mine were wrong and all four were broken.
- **Ship no SS2 asset.** `assets/` is gitignored AND
  `test/asset-attestation.test.js` fails if anything under it is tracked.
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
