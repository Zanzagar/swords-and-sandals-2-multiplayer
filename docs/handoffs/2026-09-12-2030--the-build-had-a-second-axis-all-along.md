---
handoff:      2026-09-12-2030--the-build-had-a-second-axis-all-along
written:      2026-09-12 20:30 -0400
sessionId:    cea2ec2e-6360-47c6-8941-5ff9ec5fb23a (https://claude.ai/code/session_01JUNedYJ2Pjhof8sHryquDf)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
suite:        951 / 950 / 0 / 1 (fresh-clone profile), measured after `08dfd12`
              and BEFORE this handoff. **Re-measure; never copy.**
supersedes:   2026-09-12-1600--one-interface-and-the-second-axis-is-a-prerequisite.
              Its ranked item 1 (BUILD THE SECOND AXIS) is DONE and playable.
              Its item 2 (the AI that commits) is DONE. Item 3 (ranged) is not.
---
# Handoff — the build had a second axis all along, and four files said it did not

## The one-sentence version

`getfightdistance` computes `ydist` from `_y` and returns
`round(sqrt(xdist^2 + ydist^2))` — **the build's own distance is EUCLIDEAN, and
this repository recorded it as "the rounded x-separation" in four places** — so
the second axis the last brief called a prerequisite turned out to be half
derived rather than wholly invented, and it is now built, measured, playable at
`?rank=N`, and produces the breakoff fight the owner asked for.

## The reusable lesson

**The offsets were right. Nobody opened the instructions between them.**

The docstring cited `+0x02ff` and `+0x0427`. Both are real. `ydist` is computed
at `+0x0338` and `+0x03de`, which is *between* them, and the combine at
`+0x0427` is `Math.sqrt` of the sum of two squares. **Fifth instance of this
project's signature failure** — a correct citation whose neighbouring lines hold
the answer — and the first found by reading the ORACLE rather than a
transcription of it.

The sentence that kept it hidden for eleven days was not the docstring. It was
`figure.js` asserting *"vanilla has one gladiator a side, so there is no second
axis to be faithful to"*, which turned a measurement nobody had made into a
settled fact. **A confident negative is the most expensive kind of wrong thing
to write down**, because it stops the check that would refute it.

## THE INSTRUMENT — run this first

    node tools/engagement-census.mjs                    # the axis OFF
    node tools/engagement-census.mjs --rank-stride 97   # the dial

                         stride 0   stride 97   stride 150
      settled              24/24      24/24       24/24
      can hit EVERY foe    41.0%      22.0%        6.1%
      blows through a body 44.7%      20.3%        3.7%
      most fights at once    1          2            3

**The owner's brief was "no breakoff fight, no choice, nowhere to stand off."
There are now two or three simultaneous fights and every bout still settles.**

It also computes **two metrics it used to only QUOTE** — crossings and
simultaneous fights — which the 16:00 brief cited as "the number to keep" from
a scratch script that had died. Found twice independently that day. And it has
a test now; it had none.

## What landed, six commits

- **`b192955`** — `getfightdistance` is 2D. The correction, in the code and in
  both documents that repeated it. `ss2FightDistance` is now the build's own
  formula, which **reduces EXACTLY** to the previous body when `ydist` is 0
  (pinned over 30,005 offsets, including the negative-half-integer case where
  `Math.round(-2.5) === -2` breaks the naive rewrite). Plus the two census
  metrics and the census's first test.
- **`5dc4042`** — the axis: `combatant.y`, `startingY`, `EffectKind.LATERAL`,
  `rankStride`. Two defects it CREATED, both mine, both found by measuring:
  the overlap clamp parked fighters permanently one unit out of reach
  (`ss2BodyBlocks` closes it), and the census's through-a-body test could not
  see the axis and reported 91.4% where the truth was 0.0%.
- **`1bf07f8`** — the arena draws the ranks it has. The back rank was being
  drawn **standing in the crowd**; fixing that alone drove the horizon off the
  top of the canvas at stride 150.
- **`49e7fa0`** — the rank verbs, and the AI rule that is the whole feature.
- **`1723104`** — `move-clip-depth`, so a rank change is not bound as a walk.
- **`08dfd12`** — **what the Codex review broke.** See below; two real, fixed.

## The thing that will bite the next person

**"Move toward the nearest foe's rank" is the obvious AI rule and it is a
pile-up machine.** It collapses all six gladiators into one rank at the opening
and rebuilds in two dimensions the single interface the axis exists to break.
The census reported it without being asked: **strides 97 and 150 returned
IDENTICAL numbers**, because once everybody shares a rank the stride cannot
matter.

The rule that works is *fight who is in front of you* — change rank only when
your own rank holds no foe. Pinned, and **verified to fail on the naive rule**.

This is exactly what the 16:00 brief predicted in words. It still took building
it wrong first to see it, because the prediction did not say what the wrong
version would LOOK like, and the identical-censuses signature is the only thing
that made it obvious.

## The Codex review broke my own derivation, an hour after I wrote it

`/adversarial-review`, model pinned to `gpt-6-astra`. Three findings, all
re-derived here before anything changed; two real and fixed in `08dfd12`.

**`ydist` IS SIGNED, AND I WROTE A SENTENCE SAYING THE BRANCH MADE IT
POSITIVE.** `+0x02f8` tests `hero._x < villain._x` and selects the operand
order for BOTH subtractions — so `xdist` is non-negative by construction and
`ydist` is not, because nothing about a branch on x orders the y pair. I took
`Math.abs` of both and justified it in the docstring. **True of `xdist`, false
of `ydist`: I checked one half and generalised to the half I had not checked,
which is the exact failure that same docstring convicts four other files of, in
the same commit.** The oracle's answer for hero (0,200) villain (1,70.5) is
129; mine was 130.

**It moved nothing, and that is not a defence.** 479 disagreeing pairs over a
half-integer sweep, **zero at integer y** — every depth a rule set assigns is
`frontY - rankStride * k`, both integers. The claim was about the BUILD and it
was false about the build.

**`y` WITHOUT `x` WAS REACHABLE and is half a geometry.** A raw blueprint
stating `y` under `fixtureReplay: true` built a gladiator with `x: null` and
`y: 200`, offered `rank-back`, whose reach gate said "no geometry" while its
rank verbs said "geometry". Refused by name now. The asymmetry is the rule:
`x` without `y` is the one-dimensional arena; `y` without `x` is depth with
nowhere to be deep. `ss2Combatant` was also forwarding `x` and silently
DROPPING `y`.

**The third finding is the owner's and is item 4 below**, with Codex's framing,
which is sharper than mine was.

## Highest-value work, ranked

1. **OWNER: play it and answer the question only you can.**
   `node tools/arena-server.mjs`, then
   `http://127.0.0.1:8123/tools/arena/index.html?teams=3&seed=1&rank=97`
   and the same with `&rank=150` and `&rank=0`. **How much should standing in
   the right place matter?** 97 keeps everyone loosely engaged; 150 makes three
   genuinely separate duels. Add `&spectate=1` to watch instead of play. The
   answer is game feel and nothing in the measurement can settle it.
2. **RANGED, and it is now unblocked for the first time.** The 16:00 brief
   ranked it third and said it needed the axis; it does, and the axis exists.
   **But read this first: the module REFUSES a bow at construction today** —
   `weapon_range > arena width` throws (`ss2-rules.js`, `assertConstructionResources`),
   and a bow's is `physical_size + 100*44 >= 4480`. That refusal is correct
   while there is no ranged verb: without one, a bow's reach just grants MELEE
   at 4,400 units. The work is a ranged verb first, then lifting the refusal —
   in that order, or the first bow that constructs makes every gladiator a
   god.
3. **A rank change is invisible while it happens.** `move-clip-depth` lands and
   the figure is redrawn at its new rank, but nothing tweens it and no clip
   plays — the build has no sidestep phase, so there is nothing to play. A
   `depthMotion` origin is on the scene actor for whoever writes the tween.
4. **OWNER: the projection version bump. Codex states the consequence more
   sharply than three handoffs have:** adding `y` unconditionally moves every
   flag-off hash while `BATTLE_STATE_VERSION` stays 1 AND the default
   rule-set id is unchanged, so **two peers on either side of this branch both
   advertise version 1 and disagree about identical battles, and turning the
   feature off cannot restore compatibility.** Third time the format has moved
   under a constant version — `x`, `weapon_range`, `y`. Not done here because
   it reverses the 2026-09-07 decision to pin the shape rather than carry a
   version id, which is not a session's to reverse.
5. **OWNER: the crowd fork.** Unchanged, and more load-bearing than before: the
   toll is what stops a ranked arena becoming a kiting stalemate, and a rank
   change pays it like everything else.
6. The 21 untouched weapon rows, the jump's total, capture breadth — unchanged.

## What is NOT verified

- **The Codex review covered `14e2adf..1723104`, NOT `08dfd12`** — the commit
  that answers it. The fixes are re-derived and tested but unreviewed.
- **`rankCount` is 3 and nothing enforces that it matches the adapter's
  `MAX_SLOTS_PER_SIDE`.** They are equal today, in two files, by hand.
- **The rank band is the ARENA's, not the roster's**, so a 1v1 played with the
  axis on can use all three ranks. Deliberate, but it means 1v1 stops being the
  parity case the moment the flag is non-zero. With the flag off — the default
  — nothing changes.
- **Nobody has played a ranked bout as a human.** Every measurement here is the
  AI driving both sides. Whether a rank change FEELS like a choice or like a
  chore is unmeasured and is item 1.
- **`ALLY_Y_STRIDE` -10 and `DEPTH_SCALE_PER_RANK` 0.03 are now doing two jobs**
  — the legibility stagger when the model has no depth, and nothing when it
  does. Whether the depth falloff is right for ranks 97 apart was eyeballed on
  one screenshot, not measured.
- Everything the 16:00 brief lists as unverified that is not named above still
  is.

## Hard rules

- **Measure, then guess.** Held again, three times: the pile-up AI, the
  deadlocked clamp and the blind through-a-body metric were all found by the
  census and none by reading.
- **A confident negative stops the check that would refute it.** The reason four
  files agreed the build was 1-D is that one of them said there was nothing to
  look for.
- **Screenshot comparison is NOT a regression test here.** Two screenshots of
  the same URL differ — the arena has idle animation. I nearly concluded a
  regression from it. Verify geometry arithmetically; use the picture to see
  what a number cannot say.
- **A metric that cannot see a change reports nonsense about it confidently.**
  The through-a-body test said 91.4% where the truth was 0.0%.
- **Settling is not a diagnostic**, and neither is a green suite. The suite was
  green while the back rank was drawn in the crowd.
- **An agent FINDS; the main session RE-DERIVES.** The 2D finding came from a
  verifier and was re-derived here against the installed SWF before a line
  changed.
- **Push a feature branch without asking**; `main`/`master` and every force flag
  stay DENIED.
- **A handoff commit is not finished until `node --test --test-concurrency=1` is
  green, and its suite and push lines must be measured AFTER that commit.**
