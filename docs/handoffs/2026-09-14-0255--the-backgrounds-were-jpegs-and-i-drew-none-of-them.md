---
handoff:      2026-09-14-0255--the-backgrounds-were-jpegs-and-i-drew-none-of-them
written:      2026-09-14 02:55 -0400
sessionId:    d9f27b67-4656-49c5-9d8a-8b7794fc2f4f (https://claude.ai/code/session_011sZEQveL3XVkEZu2znXy6p)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      6a2a28d..HEAD. **Re-measure; never copy.**
suite:        1396 / 1395 / 0 / 1 (fresh-clone profile) before this commit.
              **Re-measure BY EXIT CODE; never copy.**
agentRuns:    THREE, all completed, 0 dead agents. One capped `question-fanout-audit`
              wave (5 questions + 6 verifiers, VERIFIED) and two NON-wave
              workflows: a 6-agent read-only asset census and a 4-agent
              implementation wave on disjoint files. ADR 0001's cap binds the
              WAVE; the other two are a different shape and are allowed.
supersedes:   2026-09-14-0200--i-read-the-corpse-and-the-arena-is-drawn, whose
              ranked items 1, 2 and 5 are all closed.
next:         **ONE NAMED BUG AND IT IS SMALL.** The weapon is declared, reaches
              the wire and draws 8 ops in node, and does not appear on screen.
              The break is between the wire and the draw call in
              `tools/arena/main.js`. Instrument that seam; do not reason about it.
---
# Handoff — the backgrounds were JPEGs, and I was drawing none of them

## The one-sentence version

The owner asked *"where are the backgrounds that are actually in game? Did you
make these?"*, and the answer was that I had invented nothing and was still not
showing him the game: SS2's arena walls are **raster**, and this pipeline
rendered a bitmap fill as `fill: "none"` while reporting zero failures.

## THE DEFECT CLASS, and it is the whole of this session

> **AN APPROXIMATION THAT IS NOT COUNTED IS INDISTINGUISHABLE FROM A CORRECT
> READ.**

Four links, each individually reasonable:

1. `shapeToPaths` met a bitmap fill, emitted `fill: "none"`, and honestly marked
   it `approximated: "bitmap"`.
2. `propOpsFor` copied named fields one at a time and did not copy that one.
3. `extract-props.mjs` wrote the paths and never inspected them.
4. The manifest a human reads said `failures: 2`, both about something else.

**The same omission was found FOUR more times** once it had a name:
`extracted-figure.js` dropped `approximated` at both its seams; all three
extractors never tallied it; `flattenFrame` never emitted `hasFilters` at all;
and `swf-morph-shapes.mjs` still has the unrepaired version of the line
`swf-shapes.mjs` was repaired from.

`test/extraction-honesty.test.js` now **recomputes every manifest's tally from
that pack's own data**, so an extractor that approximates something new and
forgets to count it fails by name instead of shipping an invisible asset under
a clean report.

## WHAT THE ARENA LOOKS LIKE NOW

```text
  14 bitmaps       0 failures, 6 with alpha — the six arena walls
  97 gradients     the sky is a ramp instead of one flat blue
  6 arenas         ?arena=1..6; sand is a solid colour per arena, wall is a JPEG
  200 skies        ?sky=1..200 — a CLOCK, not a die roll
  weather          ?rain=10..17; frames 1-9 are dry and that is the default
```

► **AND I CAN SEE IT NOW, WHICH CHANGED EVERYTHING.** Chrome lives on the
  WINDOWS side; `tools/shot.sh <name> "<query>"` drives it headless against the
  WSL server and writes a PNG. **Three of this session's defects were invisible
  to the suite and obvious in a screenshot.** Use it before claiming anything
  renders.

## FIVE READING FAILURES, ALL MINE

► **`combatCamera` IS A `return;` AND `combatscale` IS THE LIVE CAMERA.** I
  concluded the opposite and began deleting this repository's correct claim that
  the arena pans. `combatCamera`'s body at file `0x6e46c2` is
  `96 01 00 03 3e` — `Push undefined; Return` — with 470 unreachable bytes after
  it. **My own disassembly printed that as its first two lines and I wrote a
  reason for them not to count.** And `--references combatscale` said five hits;
  I read two. Caught by the wave inside twenty minutes.
► **MY ALPHA MASKS WERE GREYSCALE.** `destination-in` keeps the destination
  where the SOURCE'S ALPHA is non-zero, and a greyscale PNG has no alpha
  channel, so every mask was a no-op. Two symptoms, one bug — and I had already
  written down the plausible wrong diagnosis ("the sky layer is not drawing")
  for the second one.
► **THE 3v3 CAMERA FRAMED THE FORMATION, NOT THE FIGHT.** I generalised
  `midwaypoint` to half the SPREAD of every actor; the build's is half the
  separation of the two gladiators who are FIGHTING. A 3v3 came out smaller than
  a 2v2 and used less of the screen. The owner saw it immediately.
► **"one assignment site is the variable's range" — TWICE.** `time_of_day` is
  `1 + random(23)` at one site and a CLOCK incremented to 200 at another; I read
  the first and nearly wrote off the night sky's masks as unreachable.
► **A TEST THAT CERTIFIED AN INCOMPLETE TABLE.** `ATTACHMENTS.length === 16`
  against a build that makes TWENTY attach calls.

## THE PROGRAMME, and where it stands

```text
  census        6 read-only agents, one per asset family      DONE, 44 items
  foundation    bitmaps, gradients, masks, alpha, filters     DONE
  honesty       every manifest counts; a test recomputes it   DONE
  wave 1        fonts, text, 26 screens, buttons, icons/face  DONE
  wave 2        renderer integration + adversarial verify     NOT STARTED
```

**Every number below I re-derived myself; none is relayed.**

- **Fonts and text.** 9 fonts, 1027 glyphs, 0 failures, 0 open contours; 180
  static + 256 edit = the 436 "text" bucket; 4061 glyph entries, **0
  unresolved**, round-tripping to readable English ("Melee Weapon:", "And so it
  was that your days as a gladiator came to an end."). That round trip is the
  only check that could catch an off-by-one — counts alone cannot.
  ► **THE TYPEFACES ARE COMMERCIALLY LICENSED** (Bitstream, Monotype, named in
    the build's own `DefineFontName`). The tools parse and REPORT; they write no
    font file. **Whether glyph outlines may ever leave a machine is the owner's
    call and is OPEN.**
- **All 26 screens** resolve: 136 characters, 129 shapes, 4915 paths, 0
  failures, with everything unresolved counted by kind per screen.
- **Faces and icons**: eyes1 (12 expressions), mouth1 (10), the icon strips, the
  combat panel. **228 expression calls on the fighter clip drive the face from
  its own animation labels** — the same join sound and art already use.
- **Buttons and filters** in `swf-display-list.mjs`, both OPT-IN. **I proved the
  opt-in claim rather than accepting it**: stashed the change, re-extracted at
  HEAD, compared content hashes — all four packs identical.

## Highest-value work, ranked

1. **THE WEAPON DOES NOT APPEAR AND EVERYTHING UPSTREAM IS VERIFIED.**
   `ss2Combatant` declares `weapon: 1` on the demo roster's exact `derive:false`
   path; `attachmentsFor` returns the row; `paintExtractedFigure` called
   directly produces **8 weapon ops spanning 66% of the figure's width**. Absent
   from four screenshots. The break is between the wire and the draw call in
   `tools/arena/main.js` — the one file the suite cannot reach. **Instrument
   that seam. Do not reason about it; this session lost an hour to reasoning
   about seams.**
2. **Wire the face.** The data and the 228-call join exist; the plumbing does
   not. eyes/mouth take a FIXED linkage from `assets/icons/`, not a wardrobe
   slot keyed by item id — which is why they are deliberately NOT in
   `ATTACHMENTS`.
3. **Draw the 26 screens.** The extractor exists and nothing reads it. Text
   needs the licence decision first; most screens are mostly art.
4. **Apply filters and colour transforms.** `flattenFrame` emits them now and
   no renderer reads them. **208 ColorMatrix instances in the sky alone** — the
   day/night colouring IS a ColorMatrix, so this is not cosmetic.
5. **`swf-morph-shapes.mjs` still has the unrepaired bitmap/gradient line**, and
   sets every morph gradient stop's ratio to 0. Dead against this oracle;
   a wrong-colour bug the moment anyone points the tools at a modded build.

## Hard rules

- **AN APPROXIMATION THAT IS NOT COUNTED IS A SILENT DROP.** Count it, print it,
  and let a test recompute it.
- **LOOK AT IT — you can now.** `tools/shot.sh`. Looking at the ASSET is not
  looking at the RENDER; the alpha masks were perfect and the render was black.
- **ONE ASSIGNMENT SITE IS NOT A VARIABLE'S RANGE**, and a reference COUNT is a
  checklist: if the tool says five and you read two, you have not finished.
- **EXPLAINING AWAY EVIDENCE IS WORSE THAN MISSING IT.** It leaves a written
  reason behind that the next reader believes.
- **A PINNED COUNT IS ONLY AS GOOD AS ITS DERIVATION.** `ATTACHMENTS.length ===
  16` certified a table that was four rows short.
- **A `generated` TIMESTAMP MAKES A BYTE HASH MEANINGLESS.** Three runs of one
  extractor give three sha256s. Strip it before claiming an extraction is
  unchanged.
- **Ship no SS2 asset.** `assets/` is gitignored AND
  `test/asset-attestation.test.js` fails if anything under it is tracked.
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
- **STAMP THE HANDOFF FROM THE CLOCK** and check it sorts after the one it
  supersedes. `ls docs/handoffs/ | tail -1` is load-bearing.
