---
handoff:      2026-09-12-2358--the-arena-has-two-axes-and-the-build-has-its-own-voice
written:      2026-09-12 23:58 -0400. **RENAMED AND RESTAMPED 2026-09-13 by the
              next session. It was `2026-09-13-0130` and said `01:30`, which is
              92 minutes AFTER its own commit `615a852` landed at 2026-09-12
              23:58:59 — you cannot commit a file before you write it. The
              stamp is not cosmetic: `docs/handoffs/README.md` says the names
              sort chronologically so `ls` puts the newest last, and under the
              old name the NEXT handoff sorted BEFORE this one, so a session
              following the documented protocol would have read a superseded
              brief as current. Content is unchanged and still frozen.**
sessionId:    cea2ec2e-6360-47c6-8941-5ff9ec5fb23a (https://claude.ai/code/session_01JUNedYJ2Pjhof8sHryquDf)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
suite:        992 / 991 / 0 / 1 (fresh-clone profile), measured after `984af09`
              and BEFORE this handoff. **Re-measure; never copy.**
supersedes:   2026-09-12-2030--the-build-had-a-second-axis-all-along. **Its
              central claim is now WRONG and that is the point of superseding
              it: it says the second axis sits behind a flag that is off by
              default. It has been the SHIPPED DEFAULT since `a431a45`.**
---
# Handoff — the arena has two axes, and the build has its own voice

*(Filename and `written:` restamped 2026-09-13 from `2026-09-13-0130` to match
this brief's own commit time. Nothing below this line was touched. See the
frontmatter for why the stamp mattered.)*

## The one-sentence version

The second axis shipped at the owner's chosen stride of 97 with three lanes, a
gladiator turns to face whoever it is fighting, a blow from behind costs extra,
and the build's own sound effects now play in the arena — extracted from the
player's install, never from this repository.

## The reusable lesson, and it is the fifth instance

**A SUMMARY IN A TRANSCRIPTION IS NOT A CATALOGUE, and I read one as a
catalogue twice in one session.**

The owner played the arena, heard a jump sound on a walk, and said so. The
cause: I had bucketed the extracted sounds by the battle map's PROSE ranges —
`"movement and charge (33-104)"`, `"Block (118/179)"`. Those are ranges over
several animations. The clip's own `FrameLabel` tags say what is in them:

```text
  33 StepBack   50 StepForward   68 Charge   104 Chargeattack
 118 BlockForward  136 Jump  148 Superjump  173 Roll  179 Block
```

So "movement" contained a LEAPING ATTACK and "block" contained the two jumps.
**And `Block` carries no sound at all** — the prose bucket hid that by lending
the range a jump. The map never claimed to enumerate these; its own text calls
them UI effects. The SWF enumerates them: **101 frame labels against 17 prose
ranges.**

► **Nothing in the suite could catch it, because BOTH SIDES of the lookup
  bucketed the same coarse way and agreed with each other perfectly.** Two
  coarse mappings agreeing is not the same as either being right. Only an ear
  caught it — the fourth defect this session found by USING the thing rather
  than testing it.

## THE INSTRUMENT — run this first

    node tools/engagement-census.mjs                   # the shipped engine
    node tools/engagement-census.mjs --rank-stride 0   # the 1-D before-picture

                         stride 0    SHIPPED (97)
      settled              24/24        24/24
      can hit EVERY foe    13.3%        20.2%
      blows through body    0.0%        15.6%
      most fights at once      1            2

**Careful with that tool: it lied for one commit.** It chose its rule set with
`rankStride === 0 ? ss2TeamRules : ...`, which was right until 97 became the
default — after which asking for the 1-D engine silently handed you the default
while printing "second axis OFF" above the table. Fixed, and the selection rule
is pinned by a test.

## What landed, twelve commits

**Geometry.** `d1f4d3e` nobody stands inside anybody (the clamp iterated FOES
only — 83% of turns had allies overlapping, closest gap 0). `480b3c2` a duel may
close and may not flee. `a431a45` 97 is the shipped default, three lanes.
`095c6f2` a rank change into an occupied lane ARRIVES BESIDE rather than being
refused — the refusal was blocking 56% of all rank changes.

**Faithfulness.** `b87f933` the build's `_y` is HEIGHT and ours is DEPTH, and
they share a field — recorded before a jump exists, because it is cheap now and
expensive after. `8aad1d1` facing is derived from position, as
`changeCombatants` derives it; turning was never an action in the build.
`63e811b` a blow from behind.

**Presentation.** `73a7b68` a lane change slides and shrinks instead of
teleporting.

**Assets.** `f1cef5d` extract sound from your own install, never into the repo.
`295704f` which sound plays, derived from `StartSound` placement. `942c5c4` the
prose-versus-labels fix above. `984af09` SWF shape records to SVG paths.

## A GIFT TO THE NEXT SESSION: the SWF structure, already derived

**Do not re-derive this. It cost most of a session.**

- **Tag walking**: `tools/inspect-swf.mjs`'s `parseTags` is the pattern; both
  asset tools reimplement it in ~20 lines. Header is 8 bytes, then a RECT whose
  width is a 5-bit field, then 4 bytes. Sprites (tag 39) are `id(2) frames(2)`
  then a nested tag stream.
- **The fighter clip is export 1241**, `hero_battle` in the map's linkage table.
  It has **2,222 frames and 101 FrameLabel tags**, and reaches **70 shapes, 44
  sprites and ZERO bitmaps** — 25 KB of shape payload out of a 7.24 MB file.
- **Audio is all MP3** (82 `DefineSound`, format 2), so extraction is a REPACK:
  9 bytes off the front of the body. 4.79 MB of the file is audio.
- **Shapes**: 824 total, **all 824 parse with `tools/swf-shapes.mjs`, 0
  failures, 61,746 paths.** 185 gradient-approximated, 13 bitmap fills, none
  reachable from the fighter.
- **The oracle's sha256 is `77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca`**,
  and every asset tool records it. Read-only, always — verified unchanged after
  a full extraction.

## Highest-value work, ranked

1. **STAGE 2 OF ASSET EXTRACTION: resolve the display list.** The parser turns
   shapes into paths; nothing yet says WHICH shapes are placed at which frame
   with which transform. That is `PlaceObject2/3` (tags 26/70) carrying a
   character id, a depth, a MATRIX and optionally a colour transform — a small
   Flash renderer over 44 sprites and 70 shapes. **Scope it to the labelled
   frames that matter** (`Standing`, `StepForward`, `Attack1`, a hurt, a death)
   rather than all 2,222. Then stage 3 is the renderer preferring extracted art
   with `figure.js` as the fallback, exactly as sound already does.
2. **RANGED.** Unblocked and anchored on a DERIVED number: the villain's own
   bow gate is `fightdistance < 200` (`sprite:862/frame:52/DoAction@0x23f835`
   `+0x03ca`, re-derived this session). **Read this first: the module REFUSES a
   bow at construction today** — `weapon_range > 4200` throws, and a bow's is
   >= 4480. That refusal is CORRECT until a ranged verb exists; lift it after,
   or the first bow that constructs grants melee at 4,400 units.
3. **The staging problem nobody has acted on.** Measured: the front lane's duel
   ends at the halfway mark (front-first in 22 of 24 bouts), survivors migrate
   backwards, and **the foreground lane is deserted on 42% of turns** with
   everybody piled into one lane on 18.9%. The arena empties from the front
   while the camera's best seat goes quiet.
4. **OWNER: the projection version bump. THE ONLY DECISION STILL OPEN.** Adding
   `y` moved every flag-off hash while `BATTLE_STATE_VERSION` stayed 1 and the
   default rule-set id was unchanged, so two peers on either side of this branch
   both advertise version 1 and disagree about identical battles — and turning
   the feature off cannot restore compatibility. Fourth format change under a
   constant version. **Nothing is deployed** (the campaign store's backend is
   in-memory, its host "undecided"), so the migration cost is zero. Not done
   here only because it reverses the 2026-09-07 decision to pin the shape.
5. **The 3v3 rank-dancer**, left alone deliberately: a dancer stretches a bout
   12x but is griefing its own team while two allies carry the fight, and it
   still resolves. Raise it only if it is seen in play.
6. The 21 untouched weapon rows, the jump's total, capture breadth — unchanged.

## Settled this session, so nobody reopens them

- **Core stat mechanics need no redesign.** The owner said a fast/high-regen
  build is a real SS2 build, and the arithmetic agrees: `staminamax = 100 +
  stamina*10`, regen `1 + round(stamina/3)`. At EQUAL 36-point budgets,
  fast+regen goes 13-11 against balanced and 12-12 against heavy. My earlier
  "2-22" was a sprinter — speed with no stamina to pay for it — which is a bad
  build being a bad build. **My first run of that comparison gave 22-2 and was
  WRONG: unequal point budgets.**
- **Flanking needs no fourth lane.** I measured 0 crossings over 2,971 turns and
  concluded it was geometrically impossible at three lanes. **The owner supplied
  the route I had not tested**: a fast gladiator overruns its own lane, ends up
  deep, and steps sideways already behind the enemy there. At three lanes with
  one agility-40 fighter: **586 crossings and 108 back attacks** where there had
  been none. My roster gave every gladiator the same speed, so it could not
  express the build under discussion.

## What is NOT verified

- **Nobody has seen the extracted sounds judged against the RIGHT actions.** The
  binding was fixed after the owner's report; he has not re-run the extractor
  and listened since. First thing to ask.
- **The lane-change tween has never been seen by a test.** The shell is the one
  part of the renderer the suite cannot reach; the four pieces under it are
  pinned, the tween itself was judged by eye ("looks quite good").
- **`rankCount` 3 and `MAX_SLOTS_PER_SIDE` 3 are equal by hand, in two files**,
  and nothing enforces it.
- **Every asset number here came from ONE install.** A different build may carry
  ADPCM sound or bitmap fills; both tools refuse by name rather than guessing,
  but neither path has been exercised.
- Everything the 20:30 brief lists as unverified that is not named above.

## Hard rules

- **A summary in a transcription is not a catalogue.** Fifth instance. The map
  says what it says; the bytes enumerate.
- **Two coarse mappings agreeing is not the same as either being right**, and a
  suite cannot tell the difference when both sides share the error.
- **Measure, then guess.** The pile-up AI, the deadlocked clamp, the blind
  through-a-body metric and the lying census were all found by measuring.
- **A conclusion is only as good as the roster that produced it.** Twice this
  session: the flanking one and the stat one, both drawn from rosters that could
  not express the thing being concluded about.
- **Ship no SS2 asset.** `assets/` is gitignored AND `test/asset-attestation.test.js`
  fails if anything under it is tracked. Two lines of defence, because the
  ignore rule alone has already failed once here.
- **The oracle stays byte-identical.** Every asset tool is read-only and records
  its sha256.
- **Codex findings are CLAIMS TO VERIFY.** `/adversarial-review` broke this
  session's own `ss2FightDistance` derivation within the hour, and it was right.
- **Push a feature branch without asking**; `main`/`master` and every force flag
  stay DENIED.
- **A handoff commit is not finished until `node --test --test-concurrency=1` is
  green, and its suite and push lines must be measured AFTER that commit.**
