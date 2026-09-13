---
handoff:      2026-09-13-0040--the-fighter-is-a-rig-and-codex-broke-four-things
written:      2026-09-13 00:40 -0400
sessionId:    cc273a6b-2487-427e-99ee-afcb84b34564 (https://claude.ai/code/session_015UxWyxsPP49dNY3V3Jhe7b)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      615a852..c9f060a (4), all pushed.
suite:        1033 / 1032 / 0 / 1 (fresh-clone profile), measured after
              `c9f060a`. **Re-measure; never copy.**
agentRuns:    none. No wave was launched and none was warranted — see "How this
              session was run" below.
supersedes:   2026-09-12-2358--the-arena-has-two-axes-and-the-build-has-its-own-voice.
              **Its ranked item 1 is DONE. Its "GIFT TO THE NEXT SESSION" is
              correct as far as it goes and INCOMPLETE in one way that matters:
              it omits the 34 morph shapes.**
---
# Handoff — the fighter is a rig, and Codex broke four things in it

## The one-sentence version

The fighter clip resolves: **101 animations, 2,222 poses, 61 shapes, 0 parse
failures**, extracted from the player's own install into gitignored `assets/` —
and a Codex adversarial review then found four real defects in the resolver,
one of which my own test was asserting.

## The reusable lesson, and it is the SIXTH instance

**TWO THINGS THAT SHARE AN ERROR CONFIRM EACH OTHER, and this time both of them
were mine, written an hour apart.**

I implemented `PlaceObject2`'s replace rule as "a replace inherits NOTHING", and
then wrote a test asserting exactly that. The suite was green and the code was
wrong. Last session the same shape appeared as the sound extractor and the sound
lookup bucketing the same coarse way; this session it appeared as a parser and
its own test. **A test written by whoever wrote the code inherits the code's
model of the format, so it cannot check the model — only the arithmetic under
it.**

► **What broke it was an INDEPENDENT reader with different priors.**
  `/adversarial-review` is worth having for precisely the reason `AGENTS.md`
  gives — it does not share Claude's `code-review` skill — and it earned that
  sentence again here: **five findings, four of them real, one of them the
  thing no test in this repository could ever have caught.**

## What the fighter actually is — DO NOT RE-DERIVE THIS

```text
  depth  name              resolves to
   9/11  L/Rupperleg       677 -> 676 -> shape 675
  13/15  R/Llowerleg       680 -> 679 -> shape 678
  17/19  L/Rfoot           682 -------> shape 681
  21/37  R/Lupperarm       685 -> 684 -> shape 683
     23  torso             688 -> 687 -> shape 686
     25  head              697 -> 690/692/694/696 -> shapes 689,691,693,695
  33/41  R/Llowerarm       700 -> 699 -> shape 698
     39  weapon            703 -> 702 -> shape 701      (13 frames, see below)
     35  shield            704 ------->  (EMPTY: attached at runtime)
```

**The whole body is ELEVEN shapes and thirteen matrices a frame.** 22,783
`PlaceObject2` tags, of which **22,683 are MOVE-ONLY** — a hundred placements
set the rig up once and everything after is tweening.

► **THE RANKED ITEM SAID TO SCOPE BY FRAME AND THAT IS THE WRONG AXIS.** "Scope
  it to the labelled frames that matter rather than all 2,222" was sensible
  before anyone counted. Scope by DEPTH and all 2,222 frames are free; scope by
  frame and you throw the animation away for no saving.

**`weapon` (703) is 13 frames labelled `flame`(2) `frost`(5) `poison`(8)
`wraith`(11), with a frame-1 `stop()` (`DoAction` body `07 00`).** That is the
weapon's ENCHANTMENT and it is an ActionScript choice, so `spriteFrames` makes
it explicit at the call site rather than simulating a playhead.

**`shield` (704) is an EMPTY sprite.** Shields are attached at runtime. Nobody
has worked out how yet, and that is the first unknown in stage 3.

## THE GIFT'S ONE OMISSION, and it would have cost a silent loss

The 23:58 handoff records the closure from 1241 as "70 shapes, 44 sprites and
ZERO bitmaps". Bitmaps and counts are right. **The closure is 148 characters and
the other 34 are MORPH SHAPES** (`DefineMorphShape`/`2`, tags 46/84), which
`tools/swf-shapes.mjs` cannot read.

Every morph sits on an EFFECT depth (1, 2, 43, 45, 47) — blood, the charge
guard, potions, the heart — **and not one is on the rig**, so the body is
unaffected. The rig's own closure is 30 characters, 19 sprites and 11 shapes,
zero morphs. But a flattener that assumed every placed character was a shape
would have lost all 34 in silence, so the module reports by kind instead.

## THE INSTRUMENT — run this first

```
node tools/extract-figure.mjs --report     # measures, writes nothing
node tools/extract-figure.mjs              # writes assets/figure/
# then OPEN THE FILE. No server. It is self-contained.
#   assets/figure/preview.html
```

**LOOK AT THE PREVIEW. It is the only check this extraction has**, and it now
SOUNDS as well — it plays the sound bound to the animation on screen, so it is
the check for BOTH extractions at once.

► **THE FIRST VERSION NEEDED A SERVER AND THE OWNER GOT A BLANK PAGE.** It
  `fetch`ed the JSON beside it, which a `file://` page may not do, and the
  `127.0.0.1:8123` link I printed was dead the moment the server stopped. **A
  page whose whole job is "a person looks at it" must not have a
  prerequisite.** Fixed by inlining the data.

## What Codex found, and what verifying it cost

All five re-derived against the build and a primary source before anything moved.

| finding | verdict | live in this build? |
|---|---|---|
| a replace must KEEP the instance | **REAL** | 144 of 201 replaces carry no matrix |
| FILTERLIST precedes BlendMode | **REAL** | 1,507 of 1,522 PO3 tags; 3 with both |
| `clipDepth` 0 is not a mask | **REAL** | 30 clipDepth placements file-wide |
| masked content exported unclipped | **REAL** | same 30 |
| ClassName on `HasImage && HasCharacter` | spec-correct | **0** — HasImage never set |
| `--out` escapes `assets/`, symlink truncation | **REAL and mine to have thought of** | n/a |

**The replace fix moves 55 placements across 7 sprites, and clip 1241 is NOT one
of them** — measured by resolving every sprite in the file both ways and
diffing, not inferred. So the fighter's extraction is byte-identical before and
after, and the fix is format correctness that will matter for the next clip.

► **I got this one wrong twice in the same session.** I first said the rig had
  no matrix-less replaces; it has 29. Then I measured, and the 29 turn out not
  to change any matrix. **The right answer arrived from measuring, and both
  wrong answers arrived from reasoning about what "should" follow.**

## AND THEN I LOOKED AT IT, WHICH FOUND THE REAL DEFECT

**The gladiator had black-and-white WEDGES across his chest.** `shapeToPaths`
grouped edges by fill and emitted each contiguous RUN as its own subpath, with a
comment claiming that reproduced the filled regions. It does not: **a renderer
closes a FILLED open subpath with a straight chord from its end to its start.**

```text
  torso 686:  127 open subpaths  ->  10 closed regions
  all 61:     ~900 open runs     ->  155 paths
```

**Nothing in the suite could have caught it.** The paths parsed, the counts were
right, 824 of 824 shapes "survived", the `d` strings were well-formed — and the
two tests pinning path data asserted the OPEN strings, because I wrote them from
the same wrong model. **Sixth instance again, one commit after the last one.**

Edges are now stitched into closed loops: a `fillStyle0` edge is reversed so the
boundary runs one way, edges chain on EXACT integer twips (a tolerance would
weld two regions that merely pass near each other), every loop of one fill goes
in ONE element under `fill-rule: evenodd` so holes work, and each closes with
`Z`. **An edge with the same fill on BOTH sides is interior and contributes no
boundary** — style state persists across records, so that is common rather than
exotic, and taking such an edge both ways round derails the stitch.

## WHAT THE RENDER SETTLED, and it was ranked item 1's open question

**The base body art is a GREY CANVAS** — `#cccccc`, `#666666`, `#333333`, with
tan sandals and one skin-toned fill under the head. It is built to be TINTED at
runtime, which is how SS2 offers a skin colour. **So team colours are not a
fight with the build's art; they are what the art is for.**

**Colour transforms are the CONDITION TINTS: 4,544 placements carry one** —
`death_poisoned` 735, `cast1` 732, `frozen` 560, `poisoned` 286, `lifesteal`
272, `lightning` 224, plus motion-blur alpha on the runs and 0.75 on the weapon
during `block`. A frozen gladiator is blue and encased in ice.

**The head's three extra parts are ALL `fillOpacity: 0` placeholder slots**,
exactly like the empty `shield` sprite. Face, hair and armour are attached at
runtime by the mechanism still unfound — which is now TWO independent pieces of
evidence for the same missing answer.

## Highest-value work, ranked

1. **STAGE 3: the renderer prefers extracted art, with `figure.js` as the
   fallback** — exactly as sound already does. The data is in the shape the
   renderer wants: `shapes.json` is closed paths, `animations.json` is per-limb
   matrices plus colour transforms, and `src/render/painter.js` already emits
   draw operations. **The open question this brief opened is now ANSWERED by
   the render: the base art is a grey canvas built to be tinted, so team
   colours are the art's own mechanism rather than a fight with it.** What is
   still open is the eight armour SLOTS, which the base clip does not dress.
2. **How is the shield attached?** 704 is empty and `attachMovie`/`gotoAndStop`
   in the clip's 236 `DoAction` tags is where the answer is. The same mechanism
   almost certainly dresses the armour, which is the whole of item 1's
   unknown.
3. **MORPH SHAPES, if the effects are wanted.** 34 of them: blood, the charge
   guard, potions, the heart. A `DefineMorphShape2` is two shapes and a ratio,
   so it is a real parser, not a tweak. **Not needed for the body.**
4. **RANGED.** Unchanged from the 23:58 brief and still anchored on a derived
   number: the villain's bow gate is `fightdistance < 200`
   (`sprite:862/frame:52/DoAction@0x23f835` `+0x03ca`). **Read this first: the
   module REFUSES a bow at construction today** — `weapon_range > 4200` throws —
   and that refusal is CORRECT until a ranged verb exists.
5. **The staging problem.** Unchanged: front lane duels end first in 22 of 24
   bouts, the foreground lane is deserted on 42% of turns, everybody in one lane
   on 18.9%.
6. **OWNER: the projection version bump. STILL THE ONLY DECISION OPEN.** Fourth
   format change under a constant `BATTLE_STATE_VERSION`, nothing deployed, so
   the migration cost is zero.
7. The 3v3 rank-dancer, the 21 untouched weapon rows, capture breadth —
   unchanged.

## THE HANDOFF BEFORE THIS ONE WAS MIS-STAMPED, AND IT BROKE THE SORT

`docs/handoffs/README.md` says the names sort chronologically, so
`ls docs/handoffs/` puts the newest last and "the latest handoff" needs no
index. That was **false as of this session**, and silently:

```text
  615a852  committed  2026-09-12 23:58:59 -0400
  its handoff stamped 2026-09-13 01:30     -- 92 minutes AFTER its own commit
```

You cannot commit a file before you write it. Under the old name, THIS handoff
(`0040`) sorted BEFORE the one it supersedes (`0130`), so a session following
the documented protocol would have read a superseded brief as current — and that
brief's central claim about the second axis was already marked wrong by the very
file that would have been skipped.

**Renamed to `2026-09-12-2358--…` to match its own commit, and its `written:`
line records the correction.** Content untouched and still frozen. The four
references — `HANDOFF.md`, the README index, its own frontmatter, and this file
— were updated together.

► **The general point: a stamp a human types is a measurement nobody took.**
  Every other number in this repository is measured; this one was typed, and it
  was the one that decided which brief the next session reads.

## How this session was run, because it departs from the ultracode default

The harness had ultracode on, which says to author a Workflow for every
substantive task. **`AGENTS.md` and `docs/adr/0001` win, and they say the
opposite:** skills are the default, Codex adversarial review is the check on any
diff that matters, and a fan-out wave is the LAST resort — only for breaking a
claim about the bytes or the archive that no test pins and no diff review
reaches. This was a diff. **No wave was launched; the review found four things a
wave would not have, because a wave audits the RECORD and a review audits the
CODE.** That is the 09-12 lesson applied rather than restated.

## What is NOT verified

- **THE PREVIEW HAS NOW BEEN SEEN — by me, headless, as a still.** `Standing`
  and `frozen` both render correctly. **Nobody has watched it MOVE**, and
  animation still cannot be captured here (`--virtual-time-budget` deadlocks on
  the rAF loop, and CDP does not cross the WSL/Windows boundary). A tween that
  is wrong only between keyframes would survive every check made so far.
- **NOBODY HAS HEARD IT.** The sound is wired to the animation on screen and the
  bindings are provably post-fix (`unlabelledSounds: 0`), but the owner has
  still not listened. **That is now one action rather than two: open the
  preview, pick `StepForward`, listen.**
- **Paint order within a limb is the SWF's depth order and has never been
  checked against a picture.** It is right for the rig by construction; the
  effect depths are another matter.
- **`fill-rule: evenodd` is a CHOICE.** SWF fills are non-zero by nature, and
  evenodd was picked because the stitched loops of one region are not
  consistently wound. It is correct on everything rendered so far; a shape with
  nested holes could disagree.
- **Gradients are flattened to their first stop** by the shape parser. 61 shapes
  reach the fighter; how many are gradient-approximated is in
  `assets/figure/shapes.json` as `approximated` per shape and has not been
  looked at.
- **`--clip` has only ever been run on 1241.** Another clip may hit a path
  nothing here exercises.
- **Every number is from ONE install**, as always.
- Everything the 23:58 brief lists as unverified that is not named above.

## Hard rules

- **A test written by whoever wrote the code cannot check the code's model of
  the format.** Sixth instance of two things sharing an error and confirming
  each other. Get an independent reader.
- **Codex findings are CLAIMS TO VERIFY.** Four of five were real here; the
  fifth was spec-correct and dead in this build, which is a different thing from
  wrong and was worth fixing anyway.
- **Measure, then guess.** I reasoned twice about whether the replace fix
  touched the fighter and was wrong both times before diffing every sprite.
- **LOOK AT IT.** `preview.html` exists because no suite can check a rig — and
  it earned that on its first use, by showing wedges across the chest that
  every number in the extraction called correct. **And a check with a
  prerequisite is not a check:** it must open with no server.
- **Ship no SS2 asset.** `assets/` is gitignored AND
  `test/asset-attestation.test.js` fails if anything under it is tracked —
  verified to bite on a figure asset this session, not asserted to.
- **The oracle stays byte-identical.** `extract-figure.mjs` now re-reads its
  sha256 AFTER writing and fails loudly on a change, refuses a symlinked target,
  and refuses to write inside the repository anywhere but `assets/`.
- **Push a feature branch without asking**; `main`/`master` and every force flag
  stay DENIED.
- **A handoff commit is not finished until `node --test --test-concurrency=1` is
  green, and its suite and push lines must be measured AFTER that commit.**
