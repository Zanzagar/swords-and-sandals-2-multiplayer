---
handoff:      2026-09-14-0200--i-read-the-corpse-and-the-arena-is-drawn
written:      2026-09-14 00:30 -0400. **THE STAMP IN THE FILENAME IS 0200 AND
              THAT IS DELIBERATE — see "the stamp" below.** The brief it
              supersedes named itself `0130` while its own commit landed at
              2026-09-13 23:23, so an honest `0045` would have sorted BEFORE the
              stale one and `ls docs/handoffs/ | tail -1` — which is the first
              instruction in AGENTS.md — would hand the next session the wrong
              file.
sessionId:    d9f27b67-4656-49c5-9d8a-8b7794fc2f4f (https://claude.ai/code/session_011sZEQveL3XVkEZu2znXy6p)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      6a2a28d..HEAD. **Re-measure; never copy.**
suite:        1234 / 1233 / 0 / 1 (fresh-clone profile), measured BY EXIT CODE.
              **Re-measure; never copy.**
agentRuns:    ONE capped wave — 5 questions + 6 write-nothing verifiers, 0 dead,
              status VERIFIED, 5 HOLDS and 1 BROKEN. It overturned this
              session's own central conclusion. Worth every token.
supersedes:   2026-09-14-0130--the-arena-is-1to1-and-three-readings-were-mine,
              whose ranked item 1 is DONE and **whose size table is WRONG in
              three of five rows.**
next:         **LOOK AT IT.** `?arena=1..6`, `?sky=1..23`, `?rain=10..17`.
              Nothing has been seen. See "Ranked" below.
---
# Handoff — I read the corpse, and the arena is drawn

## The one-sentence version

The arena screen draws — backdrop, sky, sand, crowd, rain, UI bar and border,
with the build's own pan-and-zoom camera moving the fight inside it — and
getting there cost a full retraction of a conclusion I had already written into
two files.

## THE RETRACTION, AND IT IS THE MOST USEFUL THING IN THIS FILE

I concluded, from a careful read, that **the shipped SS2 arena has a FIXED
camera**: that `combatCamera` was the live one, that `combatscale` was dead code
whose only call site could not resolve, and that this repository should retire
its standing claim that the arena pans. I wrote that into
`src/render/arena-backdrop.js` and began correcting the battle map to match.

**It was backwards in every part.**

```text
  combatCamera   DefineFunction2 at +0x048a, CodeSize 476,
                 body starts file 0x6e46c2 (+0x04a1)
                 first five bytes:  96 01 00 03 3e
                                    Push undefined
                                    Return
```

The 470 bytes after that are unreachable. It is the **only** function body in
the build that begins that way — a deliberate disable, not a compiler artefact.
It is still CALLED every tick, from `nextphase` (`+0x31af`), and does nothing.

`combatscale` is called from `gladiators.onEnterFrame` (`+0x0e68`) at `+0x0e98`,
guarded on `_global.phasecomplete != false`, **in sprite 2249's own scope where
it is defined.** THE ARENA PANS AND ZOOMS. The committed record was right and I
was about to delete it.

### The two failures that produced it, both cheap to have caught

► **My own disassembly printed the answer as its first two lines and I wrote a
  reason for it not to count.** `+0x04a1 Push undefined / +0x04a5 Return` was on
  screen; I called it "the end of a previous function" and started reading at
  line three. The docstring I then wrote cites the body as `+0x04a6..+0x067c` —
  **one instruction after the Return** — so the error is legible in the artefact
  it produced.
► **`--references combatscale` told me there were five hits. I read two.** A
  count that does not match the number of things you looked at is the cheapest
  tell available, and it was printed on the line above the output.

**Eighth instance of this project's signature failure, and the first where the
refuted claim was mine and hours old rather than inherited.** The lesson that
generalises: *explaining away evidence is more dangerous than missing it*,
because it leaves a written reason behind that the next reader will believe.

### How it was caught, which is the argument for the wave

ONE wave, inside ADR 0001's caps: **5 question agents + 6 write-nothing
verifiers, 0 dead, VERIFIED.** The brief stated my conclusion as a numbered
hypothesis and invited its destruction. **Two independent investigators broke it
by different routes within twenty minutes** — one walking the call graph, one
enumerating every positional write in the build and never reading the camera
functions at all. Both led with it as a premise break. Every byte they quoted
was then re-derived in the main session before anything was written.

**The agent aimed at a different question is the one that overturns the
result.** That rule has now paid twice.

## WHAT ELSE THE WAVE OVERTURNED, all in the committed record

► **THREE OF THE SIX ROWS OF THE ARENA SIZE TABLE WERE OUT BY A FACTOR OF
  TWENTY**, in `ss2-battle-map.md` and in the handoff this supersedes. A matrix
  from `swf-display-list.mjs` carries `tx`/`ty` in **TWIPS** — its own docstring
  says so — while `shapeToPaths` emits **PIXELS**. Compose the two and the
  OFFSET inflates twentyfold while the SIZE does not.

```text
                     committed          measured       placed at
      char  643    640 x  420 px     640 x 420 px      (0, 0)        RIGHT
      char 1729   8417 x 1032 px     640 x 211 px      offset        WRONG
      char 2249  24177 x 2489 px    1363 x 422 px      offset        WRONG
      char 1531   1919 x  210 px     641 x  27 px      offset        WRONG
      char  646    732 x  505 px     732 x 505 px      ~origin       RIGHT
```

  **The two rows that were right are exactly the two whose contents sit at the
  origin** — the two the bug could not reach. A table that is correct wherever
  it cannot be wrong reads as a table that was checked.

► **CHARACTER 1729 IS `sky`, NOT THE CROWD**, and the build says so three ways:
  the `PlaceObject2` instance name, `_root.sky.gotoAndStop(time_of_day)`, and
  its own child sprite `cloud_patterns`. **The crowd is 2112**, inside the arena
  clip. That misnaming had reached `extract-props.mjs`, where the sky shipped
  under the key `crowd` — and the renderer looks layers up BY KEY, so it would
  have painted a 640x211 sky where the stands belong and drawn no stands at all.
  **No error, no gap, just the wrong picture.**
► **`maxscale` and `zoomscale` are on `_global`, not on the arena.** Flags
  `0x016a` preload `_root` into register 1 and `_global` into register 2.
► **`_global.zoomscale = 5`** (`+0x0c7c`). I had asserted the build never
  initialised it and "repaired" a defect it does not have.
► **"every transform on frame 221 is 1.00" is false** — `sky` is scaled 1.04.
  What is 1.00 is the ARENA's placement, which is what the 1:1 claim rests on.
► **The crowd's HORIZONTAL parallax is authored and inert.**
  `crowd.onEnterFrame` reads `gladiators.camPoint`, and **`camPoint` is never
  assigned anywhere in the build** — one constant-pool entry in 7,586,504 bytes,
  read four times, written never.

## WHAT IS BUILT

`src/render/arena-backdrop.js` — the arena ITSELF rather than a thing standing
in it. Seven layers in the build's own nesting order, and **the fighters paint
between the crowd and the rain** rather than over everything:

```text
  1 backdrop 643   stage   640 x 420, the stage to the pixel
  2 sky      1729  stage   scale 1.04, indexed by time_of_day
  3 sand      673  arena   indexed by current_arena
  4 crowd    2112  arena   indexed by current_arena; the camera moves its _y
  5 ---- the rocks, the fighters, the arrows, the blood ----
  6 rain     1816  stage   frames 1-9 EMPTY; 10-17 carry the weather
  7 panel    1531  stage   the UI bar
  8 border    646  stage   732 x 505, over everything including the arrows
```

**THE CAMERA IS `combatscale`, REPRODUCED.** Pan to keep the fight's midpoint
inside stage x 300..340 easing by a sixteenth; band a zoom target on the
separation; ease `zoomscale` toward it by a fifth, snapping inside ±4; apply
`ceil(zoomscale)`.

► **A BOUT OPENS AT A ZOOM OF FIVE AND RUSHES IN**, ~16 frames at 30fps. That is
  the build's establishing shot, and my first version deleted it.
► **SEVEN DECLARED BANDS RESOLVE TO FIVE.** Sequential `if`s, last match wins,
  and the fourth (`> 200 && !(> 400)`) swallows the 70 and 60 arms whole and
  bites into the 80 arm. Effective: `mp<=200 -> 80`, `<=400 -> 50`, `<=700 ->
  30`, `<=1500 -> 20`, else 15. All seven are kept and a test asserts the dead
  ones are dead — **collapsing them into an else-if chain would hide a finding
  in a lookup table.**
► **THE PAN LAGS THE ZOOM BY ONE FRAME** because the build pans against the
  focus's stage position at the OLD zoom. Pinned, so "correcting" it fails.

► **THE DEPTH FACTOR IS NOW 1 AND WAS 1.7, AND THE ART DECIDED IT.** The shell's
  `toY` carries an unnamed `* 1.7`, chosen against the authored bowl where the
  ground is a rectangle and any factor lands on it. **The build's sand is not a
  rectangle** — arena-local y −56.75..256.2. Three ranks at stride 97 sit at
  200/103/6 at factor 1, all on the sand; at 1.7 they sit at 200/35.1/**−129.8**,
  and the back rank stands in the crowd. 1.7 stays in the authored-bowl path.

► **SIX ARENAS AND TWENTY-THREE HOURS**, where this repository had one of each.
  `sand` and `crowd` share ONE `current_arena` index over six frames, so a
  ground and its stands cannot disagree; the sky is `time_of_day = 1 +
  random(23)` over 200 declared frames holding **six** distinct drawings.
  **The count of SLOTS is not the count of MEANINGS** — the same lesson
  `bullet`'s fifty frames and five arrows taught, in a second place.

► **THE TWIPS SEAM BITES FOR THE FIRST TIME.** Every extracted matrix here is
  twips-over-pixels; `extracted-figure.js` always handled it and
  `extract-props.mjs`'s docstring claimed the opposite. Latent because every
  prop drawn until now had an identity matrix with a zero translation. The
  arena's layers are the first with real offsets.

## Highest-value work, ranked

1. **LOOK AT IT, and it is the owner's.** `--host 0.0.0.0`, then
   `?arena=1` through `?arena=6`, `?sky=1..23`, `?rain=10..17`. **Nothing on
   this screen has been seen by anybody.** A camera that frames the fight and
   one that frames the sand pass the suite identically. Every defect the owner
   found this week came from exactly this gap. In particular: does the
   zoom-from-5 rush-in read as an establishing shot or as a bug, and do the
   fighters' feet actually meet the sand at every zoom?
2. **The masks.** The extractor now reports **180 failures**, nearly all
   `mask`/`masked` on the sky — `flattenFrame` composes no clip path, so a
   masked shape is reported rather than drawn. That is the honest behaviour, but
   parts of some skies will be missing. Compose clip paths, or pick the hours
   that do not need them.
3. **Re-run the mutation audit.** A great deal of render code landed and the
   new paint helper is the sort of thing a green suite does not cover.
4. **A capture with a known enchantment** — still the only thing that settles
   the `itemglow` type-versus-potency tension. Unchanged from the last handoff.
5. **The thirteen `defend*` animations** nothing plays, still unbuilt.

## THE STAMP, and it is a live trap rather than pedantry

`docs/handoffs/README.md` rests the whole convention on one property: *"the
names sort chronologically, so `ls docs/handoffs/` puts the newest last and 'the
latest handoff' is unambiguous without an index to consult."* AGENTS.md's first
instruction depends on it.

**The brief this supersedes broke that property.** It is named
`2026-09-14-0130` and its frontmatter says `written: 2026-09-14 01:30 -0400`,
but its handoff commit `6a2a28d` landed at **2026-09-13 23:23:43 -0400** — about
two hours earlier than it claims. This session's work finished at 00:30, so an
honest stamp would have sorted *before* it and the next reader following the
rule would have opened the superseded file.

**So this one is stamped 0200 to keep the invariant true, and says so rather
than quietly drifting.** The alternatives were worse: renaming the predecessor
would break the links in `HANDOFF.md`, this file and the index, and stamping
honestly would leave a trap that the convention cannot detect.

► **WHAT TO ACTUALLY FIX, and it is small:** have the handoff-writing step take
  its stamp from the clock rather than from the model's sense of the time, and
  have `test/handoff-navigation.test.js` assert that each handoff's filename
  stamp is not later than its own commit date. **A convention whose only
  enforcement is a person remembering it has already failed once here**, and the
  failure mode is silent: a stale brief that looks authoritative is exactly what
  the README says the `H-NNN` scheme was dropped to avoid.

## Hard rules

- **EXPLAINING AWAY EVIDENCE IS WORSE THAN MISSING IT.** It leaves a written
  reason behind. When a dump's first lines contradict your expectation, that is
  the finding, not the noise.
- **A REFERENCE COUNT IS A CHECKLIST.** If the tool says five and you read two,
  you have not finished.
- **CHECK WHICH OBJECT AN `attachMovie` OR A PLACEMENT IS ON** before assuming a
  coordinate space — and now also **which register a property is on**: flags
  `0x016a` means `register:2` is `_global`, not the enclosing clip.
- **A GREEN SUITE IS NOT COVERAGE**, and `grep` IS NOT A GATE. Use the exit code.
- **LOOK AT IT**, and **`--host 0.0.0.0`, never `127.0.0.1`**.
- **Ship no SS2 asset.** `assets/` is gitignored AND
  `test/asset-attestation.test.js` fails if anything under it is tracked.
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
- **STAMP THE HANDOFF FROM THE CLOCK, NOT FROM MEMORY**, and check that it sorts
  after the one it supersedes. `ls docs/handoffs/ | tail -1` is load-bearing.
