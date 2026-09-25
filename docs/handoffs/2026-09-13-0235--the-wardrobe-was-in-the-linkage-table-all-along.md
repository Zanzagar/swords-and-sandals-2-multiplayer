---
handoff:      2026-09-13-0235--the-wardrobe-was-in-the-linkage-table-all-along
written:      2026-09-13 02:35 -0400
sessionId:    cc273a6b-2487-427e-99ee-afcb84b34564 (https://claude.ai/code/session_015UxWyxsPP49dNY3V3Jhe7b)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      615a852..60654f9 (10 before this handoff), all pushed.
suite:        1066 / 1065 / 0 / 1 (fresh-clone profile), measured after
              `60654f9`. **Re-measure; never copy.**
agentRuns:    wf_5d6fa8dd-892 — ONE question-fanout wave, 6 questions + 6
              verifiers, 12 started, 12 returned, 0 dead. 4 HOLDS, 2
              PARTIALLY-BROKEN. **31 of 37 emitted claims were NOT verified**
              (budget 6) — that is the honest limit of what it settles.
supersedes:   2026-09-13-0040--the-fighter-is-a-rig-and-codex-broke-four-things.
              **Its ranked items 1 and 2 are DONE, and its ranked item 2 was
              built on a MISREADING that this session's wave overturned.**
---
# Handoff — the wardrobe was in the linkage table all along

## The one-sentence version

The arena draws the build's own gladiator; the wave found that the fighter clip
does not dress itself and the entire wardrobe — **387 pieces across 12 slots** —
is exported by linkage name with the item row's ID as the suffix; and the owner
found four defects by playing it that no test could reach.

## THE FINDING, and it retires a ranked item by proving it was the wrong question

**"How is the shield attached?" was ranked item 2 of the 00:40 brief, and it was
built on a misreading of mine.** Sprite 704 sits at depth 35 named `shield` and
holds nothing. I read that as a placeholder nobody had filled and called it "the
first unknown in stage 3".

**It is not the shield's home.** The shield attaches to the RIGHT FOREARM clip
at depth 3. An empty sprite is what a slot looks like **when you are looking at
the wrong slot** — and I built a ranked item, a handoff paragraph and a second
"independent witness" (the head's invisible parts) on top of it.

**The mechanism is at the ROOT, not in clip 1241.** The `DoAction` at
`0x40bf76` — tag code 12, 11,225 bytes, body `0x40bf7c` — carries ONE
`ActionConstantPool` of 149 entries holding the whole vocabulary:

```text
  skincolor  haircolor  features  hairstyle  facehairstyle
  shoulderguard  gauntlet  breastplate  helmet  greaves  shinguard  boot  shield
  head  torso  Lupperarm  Rupperarm  Llowerarm  Rlowerarm
                Lupperleg  Rupperleg  Llowerleg  Rlowerleg
  head.bareskin  torso.bareskin  Lupperarm.bareskin  ...  one per limb
  attachMovie  head.hair  head.facehair  Color  charColorTransform  colorhero
```

**`attachMovie` onto a NAMED LIMB, `Color` onto that limb's `bareskin` child.**
The grey-canvas guess was right for a better reason than I had: the build has a
named tint target under every limb.

**And clip 1241's 236 `DoAction` tags do NOT dress anything** — a blood/sparks
emitter, facial expressions on `head.eyes`/`head.mouth`, and
`stop()`/`struck`/`fired`. The substring `shield` occurs ZERO times in its
14,907 action bytes.

## THE WARDROBE — do not re-derive this

Every attachable piece is exported as `<slot><id>`. Over all 502 exported
symbols:

```text
  weapon         89  ids 0..220        shield         25  ids 0..25
  helmet         40  ids 1..120        facehair       24  ids 1..24
  hair           40  ids 1..40         features       19  ids 1..24
  boot / shinguard / breastplate / shoulderguard / greaves / gauntlet
                 25 each, ids 2..26
```

**89 weapon symbols against the item tables' ~90 weapon rows.** The tables were
never missing an art column — **the row's ID WAS the art column**.

And where each goes, disassembled from the same function (AS2 pushes arguments
in REVERSE, which is what makes the call sites readable):

```text
  head        features       4    head        facehair       3
  head        hair           5    head        helmet         5
  torso       breastplate    1    Rlowerarm   shield         3
  L/Rupperarm shoulderguard  1    Llowerarm   gauntlet       1
  L/Rupperleg greaves        1    Rlowerarm   gauntlet       2
  L/Rlowerleg shinguard      1    L/Rfoot     boot           1
  head        eyes           1    head        mouth          2
```

► **`helmet` AND `hair` SHARE DEPTH 5, so a helmet REPLACES the hair.** A game
  rule falling straight out of the byte layout — and exactly the kind of thing a
  renderer inventing its own paint order would get wrong while looking fine.
► **`eyes` and `mouth` are ATTACHED too**, which is what the 118
  `head.eyes.gotoAndPlay` and 106 `head.mouth.gotoAndPlay` calls in clip 1241
  drive. The face is not painted into the head shape; the fighter clip animates
  the EXPRESSION of two attached clips.

## THE INSTRUMENTS — run these first

```
node tools/extract-figure.mjs --report      # the rig: 101 anims, 61 shapes
node tools/extract-wardrobe.mjs --report    # 387 pieces, 401 shapes, 0 failures
node tools/arena-server.mjs --host 0.0.0.0  # SEE THE NOTE BELOW
node tools/engagement-census.mjs            # now defaults to the SHIPPED stride
```

► **`--host 0.0.0.0` IS NOT OPTIONAL ON THIS MACHINE.** **Windows cannot reach
  WSL's loopback here.** Measured both ways: `Invoke-WebRequest
  http://127.0.0.1:8123/` from Windows TIMES OUT while `curl` inside WSL gets
  200. WSL2's localhost forwarding is not working, so the owner's browser could
  never open the arena — **and three sessions reported this server healthy on
  the strength of `curl` from the one place it was always going to work.** The
  working URL is printed in the banner (here `http://172.27.81.183:8123/`).
  `assets/figure/preview.html` is unaffected: it is self-contained.

## What the OWNER found by playing it, which is four defects no test reached

1. **"Sounds get cut off and dont play out."** One `Audio` element per file,
   restarted with `currentTime = 0`. Measured why it bites so hard: **the build
   SHARES sound files across labels — `706.mp3` is bound to FIVE** (`stepback`,
   `stepforward`, `runback`, `runforward`, `attack12`). Now one clone per play,
   16 voices, finished ones retired.
2. **"Some sounds seem to not kick in."** Autoplay is blocked until the page is
   interacted with and **spectate mode never interacts**; the rejection was
   caught and discarded under a comment calling it not worth a log line.
   Swallowing it was the mistake. Said once now, and any interaction unblocks.
3. **The preview was blank** — it `fetch`ed its data and a `file://` page may
   not. Self-contained now.
4. **"An AI moving lane chooses to stand behind his teammate rather than flank."**
   **Not a programming error, and he is right that it is the weaker play.** Two
   faithful constraints plus a missing objective: a walk may never cross a foe
   (the build's clamp at `+0x3de6`), and `chooseAiAction` has no flanking
   concept — it takes the weakest foe and closes, changing rank ONLY when its
   own rank is empty. That rule was chosen deliberately because the obvious
   alternative is a measured pile-up machine. **0 crossings in 3,424 turns.**

## Highest-value work, ranked

1. **DRESS THE GLADIATOR.** Everything needed is derived and extracted:
   `assets/figure/wardrobe.json` holds 387 pieces as paths, and the table above
   says which limb and depth each goes to. `src/render/extracted-figure.js`
   already walks the rig by named limb, so the attachment point exists. **The
   one thing still underived is the per-piece `_x`/`_y` offsets in the
   `attachMovie` init objects** — the call sites carry them (`head.eyes._x = -3`
   is visible in the disassembly) and they were not extracted.
2. **FLANKING, and it is the owner's own observation.** Give the AI a pincer
   objective, measured on `crossings` and back attacks in the census with a 2v1
   case added. **The trap is documented and must be respected**: anything
   resembling "move toward the nearest foe's rank" rebuilds the pile-up, and the
   tell is that strides 97 and 150 return identical censuses.
3. **WIRE THE MORPHS IN.** `tools/swf-morph-shapes.mjs` parses all 44 (0
   failures, 8,720 edges) and nothing consumes it. That is the blood, the charge
   guard, the potions and the heart.
4. **`tools/arena/main.js` HAS NO TEST REACH AND GAVE UP FOUR LIVE DEFECTS IN
   ONE DAY.** It needs a seam, not a fifth fix.
5. **RANGED — and the owner has said he wants to design it awake.** Unchanged:
   the villain's bow gate is `fightdistance < 200`
   (`sprite:862/frame:52/DoAction@0x23f835` `+0x03ca`), and the module REFUSES a
   bow at construction (`weapon_range > 4200` throws) until a ranged verb
   exists.
6. **OWNER: the projection version bump.** Still the only decision open, still
   free, now the fourth format change under a constant version.

## What is NOT verified

- **31 of the wave's 37 claims were never verified.** Four verdicts HOLD, two
  PARTIALLY-BROKEN. Read `wf_5d6fa8dd-892`'s journal before trusting any
  number in it that this handoff does not repeat — **everything in THIS file
  was re-derived by the main session.**
- **Nobody has watched the rig MOVE, or heard the sound since the voice fix.**
  Stills capture here; animation does not (`--virtual-time-budget` deadlocks on
  the rAF loop, CDP does not cross the WSL/Windows boundary).
- **The per-piece attachment offsets are underived** — see ranked item 1.
- **`features` has 19 symbols with ids 1..24**, so five ids in that range have
  no art. Nothing explains the gap yet.
- **21 wardrobe pieces have more than one frame and frame 1 was taken.** What
  the other frames are is unknown; the weapon's 13 frames are enchantments, so
  these may be too.
- **`death:slain`, `death:yield`, `death:arrow`, `death:grievous` map to no
  clip** and fall back to `death1`. Only `death:taunt` is derived.

## Hard rules

- **An empty slot may mean you are looking at the wrong slot.** The shield cost
  a ranked item, a handoff paragraph and a false corroboration.
- **Re-derive before relaying.** The wave pointed; every number here is the main
  session's own. Two of six verifiers came back PARTIALLY-BROKEN.
- **THE SHARED SCRATCHPAD IS A WAVE HAZARD.** Two verifiers independently
  reported agents overwriting each other's scripts mid-run; one discarded a
  whole first pass. **Give each agent its own directory before the next wave.**
- **A test written by whoever wrote the code cannot check the code's model.**
  Three times in one session: the replace rule, the stroke width, the open
  subpaths.
- **LOOK AT IT, and a check with a prerequisite is not a check.**
- **Ship no SS2 asset.** `assets/` is gitignored AND
  `test/asset-attestation.test.js` fails if anything under it is tracked.
- **The oracle stays byte-identical.** Every asset tool re-reads its sha256
  after writing and fails loudly on a change.
- **Push a feature branch without asking**; `main`/`master` and every force flag
  stay DENIED.
- **A handoff commit is not finished until `node --test --test-concurrency=1` is
  green, and its suite and push lines must be measured AFTER that commit.**
