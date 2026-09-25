---
handoff:      2026-09-20-2130--the-bolts-are-built-and-a-null-was-a-scheduled-divergence
written:      2026-09-20 21:30 -0400
sessionId:    f1f6ade5-3cb2-4317-960f-06f265d6423d
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      `9f5d01e..HEAD`. **Re-measure with `git log --oneline`.**
suite:        **Re-measure BY EXIT CODE after your own commit.** `fail == 0` and
              the exit code are the gate. **2126 / fail 0 / skipped 1, exit 0**,
              against a start-of-session baseline of 2098 / fail 0 / skipped 1.
              The 28 new tests are `test/ss2-bolt.test.js`.
agentRuns:    **FOUR write-nothing verifiers, no fan-out wave. 4 started, 4
              returned, 0 dead.** Verdicts: 2 HOLDS, 2 PARTIALLY-BROKEN — **and
              both partial breaks were breaks in MY claims, not the build's.**
              **THREE Codex adversarial reviews** (`gpt-6-astra`, model pinned):
              `needs-attention`, `needs-attention`, `approve`. **The first two
              findings were both real and both in code I wrote today; the second
              was CAUSED BY THE FIX FOR THE FIRST.**
supersedes:   2026-09-20-0200--the-slots-are-declared-and-three-sentences-were-wrong.md
next:         **RANKED BELOW. Item 1 is a browser measurement and is still the
              owner's or a supervised main session's; item 2 is the next code
              increment.**
---

# Handoff — the bolts are built, and a `null` was a scheduled divergence

## The one-sentence version

`cast_lightning_bolt` and `cast_frightning_bolt` resolve — the first spell verbs
this engine has — but the thing to carry forward is that **the map's table had
the wrong SHAPE, and the shape silently produced three wrong values in code that
a live capture was scheduled to diverge on.**

## WHAT IS DONE

► **THE TWO BOLTS ARE BUILT** (`13e2129`). Offered on possession of inventory id
  34 or 35, one `randomBetween` for the damage, `round(magicka)` stamina, the
  slot consumed by setting it to 1, through the magic ingress this repository
  already models. `Cast2` on the caster and `lightning` on the victim reach the
  event.
► **THE THREE SPELL ARMS ARE DERIVED IN FULL** and written into the battle map
  under "The two bolt phases, in full" and "The fireball family and molten
  death, and why neither is a turn".
► **`damageMethod` CORRECTED FOR IDS 31, 32 AND 35** (`4f208a1`), with the map
  table regrouped BY ARM so the shape cannot reproduce the error.
► **THE 28-ARM LADDER IS TABULATED**, and it has SEVEN unconditional arms, not
  six.
► **TWO PUBLISHED SENTENCES ABOUT `inventory_maxslots` RETRACTED AT THE
  SENTENCE**, in the map and in `ss2-champion-dna.md`.
► **RANKED ITEM 4 OF THE LAST HANDOFF IS ANSWERED NO**, and the answer was
  already in `docs/ss2-adapter-contract.md` before the question was asked.

## The finding that outranks the verb

**`SS2_DIRECT_DAMAGE_SPELLS` carried `damageMethod: null` for hell fireball,
dire fireball and frightning bolt for three weeks.** The bytes push
`damage_method` and `bonus_frame` ONCE PER ARM, before the per-spell branches
converge: all three fireballs share `+0x91c1` and are `"burning"`/4, both bolts
share `+0x85af` and are `"lightning"`/8.

► **THE MAP'S TABLE SHAPE IS WHAT PRODUCED IT.** One row per SPELL, as though
  each had its own ingress call. There are three spell call sites for eleven
  spells. **A row-per-spell table structurally cannot record a per-arm
  argument**, so three rows read as map silences and the module faithfully wrote
  the silence down as `null`.
► **AND THE MEASUREMENT WAS ALREADY IN THE TREE.**
  `tools/runtime-capture/ss2-capture-wrapper.as` has named these exact literals
  at these exact offsets — *"burning" (fireball **group** `+0x91c1`,
  death-from-above boulders `+0x88e5`), "lightning" (bolt **group**
  `+0x85af`)* — since `7601888`, **five hours after `8c3fc0a` wrote the
  nulls**. It even says *group*. **This was an internal contradiction for three
  weeks, not an unread byte.**
► **A NULL HERE WAS A SCHEDULED FALSE DIVERGENCE.** `src/golden/observation.js`
  derives a `magic-damage` event's `method` from the candidate and deep-compares
  `/events`; the wrapper emits the build's real `arguments[4]`. The one fixture
  that carried a null, `candidate-spell-lethal-slain`, is an **ACTIVE staged
  capture target**. That file's own header even says what would happen: *"a
  spell whose label the map does not record carries `null` in its candidate and
  diverges loudly against a live capture."*

**The lesson is about table SHAPE, and it generalises.** Ask what a row is a row
OF. A table whose rows are finer-grained than the code they describe cannot
record anything the code does per-group, and it will read as silence rather than
as an error.

## Five more things the map did not carry

- **SEVEN ARMS FIRE ON POSSESSION ALONE, NOT SIX.** Arm 23 (id 45,
  `cast_boundless_energy`) has the identical single-test shape and **sits
  immediately before gale**, so a villain carrying 45 can never cast gale,
  command, teleport, swift sandals or adulation. That is a sharper blocker than
  the id-41 note that section already gave.
- **`use_item` IS NOT PASSED THE MATCHED ID.** All 28 bodies call
  `use_item(item_used)`; `item_used` is read 28 times in that function and
  **written zero times**. An engine passing the arm's own literal id models a
  data path the build does not have.
- **`inventory_maxslots` GATES THE HERO'S IN-BATTLE BUTTONS** —
  `sprite:492[inventory_overlay]/frame:1` `+0x024f`, a top-level unguarded loop
  on a panel the battle overlay attaches — and **bounds
  `randomise_gladiator`'s spell fill** (`+0x3925`). Two of yesterday's three
  sentences about it are wrong.
- **THERE IS NO DEFAULT OF 6.** The band chain is 2/3/4/5/6 at `herolevel >=`
  6/15/20/30/40. **Six needs level 40**, and across levels 6-14 it is 2, so the
  build hides buttons 3-6 during a battle. *(I shipped "the default is 6" in a
  code comment and a verifier killed it the same session.)*
- **THE FIREBALL'S FRAME TEST IS AN IDEMPOTENCE GUARD, NOT AN IMPACT TRIGGER.**
  `+0x9194 Not; +0x9195 Not; If` is a DOUBLED `Not`, so it reads
  `if (_currentframe != 4)`. **I had it inverted** and a verifier broke it
  before it reached a document.

## Things I got wrong, recorded because the next reader will not

► **I DESTROYED A SESSION'S WORK WITH `git checkout -- <file>`.** I ran it to
  undo the last of three mutation tests and it discarded every change to
  `src/team/ss2-rules.js` — about 500 lines. Rebuilt from context and re-tested
  green, so nothing was lost but time. **The undo for a mutation test is the
  INVERSE PATCH, never a checkout.** `git stash` is already banned here as a
  tree edit; this is the same hazard wearing a different verb.
► **MY FIX FOR CODEX'S FIRST FINDING CAUSED ITS SECOND.** Adding `boltOnOffer`
  to `attackOnOffer` let a distant caster reach the psyche ranking, whose range
  check had been **retired against a measurement** on the grounds that it was
  "unreachable by construction". The construction was `attackOnOffer` meaning
  `ATTACK_BANDS`, every one of which is offered on `ss2Reach`. **A guard
  justified by a construction has to be revisited the day the construction
  changes**, and the only reason this was findable is that the note retiring it
  said what it depended on.
► **MY 21 FOCUSED TESTS ALL PASSED AND NONE OF THEM ASKED THE AI ANYTHING.**
  That is the hole Codex walked through, and it is not a bolt-specific hole: a
  verb can be legal, correct and unreachable, and a test file aimed at the verb
  will never notice.
► **I BRIEFED FOUR VERIFIERS TO DERIVE A BLOCK BASE FROM AN `offset=0x...`
  HEADER THAT ONLY `--function` PRINTS.** Three of them were given
  `--references` dumps, which carry no such line. Two worked the base out from
  branch arithmetic anyway and said so; the brief was the defect. **Check that
  the evidence you hand over actually contains what you told the agent to read.**

## Highest-value work, ranked

1. **RE-DERIVE THE PIXEL NUMBERS.** Unchanged, and now the oldest open item by
   some distance. Everything published before 2026-09-18 went through a 300×150
   backing store. `canvasBackingFor` is tested, so the instrument is sound; the
   re-measurement is not done. **Needs a browser — the owner's, or a supervised
   main-session run. No agent launches one.**
2. **THE BOLTS HAVE NO CLIP FAMILY, AND THAT IS THE NEXT CODE INCREMENT.** The
   event carries `casterClip: "Cast2"` and `victimClip: "lightning"`, both read
   out of the build, and **`CLIP_FAMILIES` has no entry for either** — so
   `cast2` and `lightning` stay in `clip-labels.js`'s `unbuiltSpells` bucket
   deliberately. **Do NOT promote them without a family**: that is the
   `psyche:discharge` defect exactly, where a promoted label asked for an empty
   clip vocabulary, drew nothing, lost its face, made no sound and **reported
   `recognised: true`**. The art exists; the binding does not.
3. **DECIDE `inventory_maxslots`.** It is now DERIVED (the band chain, both
   read-gates, the fail-open behaviour) and NOT DECLARED — absent from
   `SS2_RESOURCE_NAMES` and from `VANILLA_FIELD_GROUPS`. `legalActions` names
   the omission at its own site. Declaring it is the `psyche_up` shape again:
   a name with **no** `SS2_RESOURCE_DEFAULTS` entry, so no golden moves. **The
   narrowing it leaves is the COMMON case, not a corner one** — levels 6-14
   carry `maxslots` 2.
   ► **ONE THING IS UNMEASURED AND IT IS THE LINK THE WHOLE GATE RESTS ON**:
     that an invisible AVM1 MovieClip cannot be clicked. The `onRelease`
     dispatcher has no gate of its own, so `_visible` is the entire offer gate.
     That is Flash/Ruffle runtime semantics, not something the bytes state.
     **Drive a low-`maxslots` hero into a battle, click where button 3 would be,
     watch `inventory_action`.** Needs a browser, like item 1.
4. **`cast_gale` IS STILL BLOCKED ON `fightdistance`, AND ITS BLOCKER GOT
   WORSE.** Unchanged from yesterday except that arm 23 (id 45) now pre-empts it
   too. `_root.arena.fightdistance` is an ARENA field and this engine has no
   combatant-level home for it. **That is a shape decision, not a derivation,
   and it is the whole of what remains.** The blocker has moved four times and
   every move was progress.
5. **`randomise_gladiator`'s SPELL-FILL GUARD IS UNSETTLED.** The map says its
   equipment/inventory body sits inside `if (whichcharacter != game.hero)` at
   `+0x27e8`, delta 3615. If that is right, the `maxslots`-bounded spell fill at
   `+0x3925` is OUTSIDE that guard and may reach the hero. **Dump
   `+0x27e0`-`+0x3980` of `root/frame:35/DoAction@0x40198e` before relying on it
   either way.** A verifier declined to relay this file's own arithmetic as
   re-derived, which was correct.
6. **THE NONCE RECOVERY APPLY IS STILL THE OWNER'S**, and **RE-TAKE THE `D:`
   MIRROR** (1,588 files against an archive of 8,325). Both unchanged.

## Hard rules

- **RUN THE CODEX REVIEW PER DIFF THAT MATTERS, AND RUN IT AGAIN ON YOUR OWN
  FIX.** Three passes here: the first found a real defect, the second found the
  defect my fix for the first had introduced, the third approved. **Stopping at
  one would have shipped a gladiator that burns 57 stamina a turn for ever.**
- **THE UNDO FOR A MUTATION TEST IS THE INVERSE PATCH.** Not `git checkout --`,
  not `git stash`. Both discard more than the mutation.
- **TEST THE AI, NOT JUST THE VERB.** A focused test file aimed at a new action
  will pass while the action is unreachable.
- **ASK WHAT A TABLE'S ROWS ARE ROWS OF.** A table finer-grained than the code
  it describes records per-group facts as silence.
- **A GUARD RETIRED AGAINST A MEASUREMENT MUST SAY WHAT THE MEASUREMENT
  DEPENDED ON**, or the day the dependency changes nobody can find it.
- **CHECK THAT THE DUMPS YOU HAND AN AGENT CONTAIN WHAT YOUR BRIEF TELLS IT TO
  READ.** `--function` prints the block base; `--references` does not.
- **MEASURE THE HASHES, DO NOT ARGUE THEM.** The census is
  `scratchpad/golden-census.mjs` against a `git worktree` of the baseline, and
  it ran three times here: 23/23 byte-identical each time.
- **MUTATION-CHECK EVERY PIN YOU MOVE.** Six were checked here; every one went
  red and was restored.
- **DO NOT "FIX" `psyche_up: 0` IN `tools/arena/roster.js`.** Unchanged.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES RUFFLE OR A BROWSER, OR TOUCHES THE INSTALLATION.** The
  oracle is `…/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf`,
  sha256 `77CB545C…`, **verified byte-identical at the start of this session
  and untouched since** — every dump was produced by the read-only inspector in
  the main session and handed to agents as files.
- **Ship no SS2 asset.** The item table's display names and descriptions were
  read during this derivation and deliberately kept out of every commit; the
  offsets and the arm structure carry the argument without the strings.
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
