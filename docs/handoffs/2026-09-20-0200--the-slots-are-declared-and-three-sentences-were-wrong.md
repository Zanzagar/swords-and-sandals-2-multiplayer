---
handoff:      2026-09-20-0200--the-slots-are-declared-and-three-sentences-were-wrong
written:      2026-09-20 02:00 -0400
sessionId:    2fa3286b-d390-46a4-b13f-239eef9ac36f
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      `ee4becb..HEAD`. **Re-measure with `git log --oneline`.**
suite:        **Re-measure BY EXIT CODE after your own commit.** `fail == 0` and
              the exit code are the gate. **2098 / fail 0 / skipped 1, exit 0** —
              the SAME count as the start of the session, which is the point: a
              schema change that moves no test total moved no behaviour.
agentRuns:    **ONE wave, `wf_1ee83aec-a10`, status VERIFIED.** 4 question agents
              + 5 verifiers; **9 started, 9 returned, 0 dead**; 20 claims left
              unverified by the budget cap and reported as such. Verdicts:
              3 HOLDS, 2 PARTIALLY-BROKEN — **and both partial breaks sharpened a
              finding rather than killing one.** ONE Codex adversarial review
              (`gpt-6-astra`, model pinned): **approve, no material findings.**
supersedes:   2026-09-19-2130--four-defects-a-campaign-and-a-blocker-that-moved.md
next:         **RANKED BELOW. Item 1 is a browser measurement and is the owner's
              or a supervised main session's; item 2 is the next code increment.**
---

# Handoff — the six slots are declared, and three of yesterday's sentences were wrong

## The one-sentence version

`inventory1`–`inventory6` are declared resources and **all 23 golden replay
hashes are byte-identical** — but the thing to carry forward is that **a wave
aimed at the bytes broke three sentences I had published the day before**, and
the one about `cast_gale`'s gate was wrong by four conditions.

## WHAT IS DONE

► **THE SIX SLOTS ARE IN `SS2_RESOURCE_NAMES`, WITH NO DEFAULTS.** The
  `psyche_up` shape. Golden hashes taken before and after with a census that
  drives the replay test's own builder: **23 of 23 unchanged.**
  `BATTLE_STATE_VERSION` measured unchanged at `573176825`.
► **THE DEMO ROSTER'S SIX SLOTS GO 0 → 1**, because 1 is the value the CODE
  writes and tests for. Fifth instance of that roster's own lesson.
► **THREE PUBLISHED CLAIMS RETRACTED AT THE SENTENCE** in
  `docs/integration/ss2-battle-map.md`, plus a footnote in
  `ss2-champion-dna.md` so its rank-1 decode stops looking like a contradiction.
► **A FALSE EXPLANATION IN `test/seeded-play-pins.test.js` CORRECTED.**
► **`check_inventory` IS DOCUMENTED FOR THE FIRST TIME**, along with four other
  facts the map never carried (below).

## THE THREE SENTENCES, because the next reader may have quoted them

All three were written 2026-09-19 and broken 2026-09-20. **Published, then
checked, and the check is what found them.**

1. **"The gate on casting a gale is carrying id 38 in one of six slots."** It is
   FIVE conditions: a single top-of-function `randomBetween(1,100) > 10` whose
   failure jumps to the function End (so a failed roll chooses NOTHING); 23
   preceding arms of a strict 28-arm else-if ladder in FIXED source order all
   failing; `check_inventory(38)`; `fightdistance < 400`; and
   `armourclass < armourclass_max / 2`. Gale is arm 24 of 28.
2. **"A character-initialisation block writes 1 to every inventory slot at once,
   beside `shield = 0`."** It is OPPONENT generation — the whole body is inside
   `if (whichcharacter != game.hero)` — and `shield = 0` is the last statement of
   the `if (herolevel == 1)` arm whose branch TARGET is the first inventory
   write. **"A fresh gladiator carries nothing" is false for the player.**
3. **"The empty marker differs by column — 0 for equipment, 1 for inventory, in
   the same initialisation block."** There is no same block, and `0` is
   inventory's OWN second nothing-row: `_root.inventory0` and `_root.inventory1`
   are byte-identical after the name operand (`0x3FF6C8`, `0x3FF6E9`).

**What replaces them is sharper than what it corrects: `1` is the marker the
CODE uses, `0` is the marker the authored DATA mostly uses, and they are the same
table row but not the same value.** Fourteen emptiness tests, every one `== 1`;
every literal slot write is 1; zero writes of 0.

## Five facts the map never carried

- **`check_inventory`** is what the ladder actually calls; it sets the global
  `item_used`, which is why each arm reads `use_item(item_used)`.
- **It and `use_item` are hardcoded to `_root.game.villain`.** The hero's
  inventory is consumed by a separate handler that neither rolls nor tests
  anything. **The offer gate differs by side and only the villain's is a
  decision.**
- **`inventory_maxslots` gates nothing in combat** — both loops are a hard
  `i = 1..6`. **A verb that respected it would model behaviour the build does
  not have.**
- **There is no affordability check on a spell's stamina cost anywhere.** A
  villain at zero stamina casts and goes negative. **Do not invent one.**
- **`is_that_virtuous` holds the build's only `> 0` emptiness test** — a THIRD
  predicate, which reads the engine's own empty marker as occupied — and is
  DEAD: `fizMode` is written `"fizzle"` unconditionally at `root/frame:1`
  `+0x0026`, the only write among sixteen references.

## Things I got wrong, recorded because the next reader will not

► **MY WAVE BRIEF BOTH FORBADE AND GRANTED READING THE INSTALLATION, in the same
  paragraph.** It said *"do NOT go looking for the SWF and do NOT touch the game
  installation"* and then *"you MAY run it against the dumps' source only if you
  have a path"*. Two of five verifiers read the install directly with the
  read-only inspector; one re-hashed afterwards and I re-hashed again at the end
  — `77cb545c…`, byte-identical, no harm done. **The brief was the defect, not
  the agents.** Write ONE boundary sentence, or the agent picks whichever half
  suits the work.
► **I STASHED THE WORKING TREE WHILE THE CODEX REVIEW WAS READING IT**, to
  measure `BATTLE_STATE_VERSION` on the old code. Its log shows it had already
  taken both `git diff`s and it went on to reason about the real change, so the
  review is sound — but I could not prove that at the time, and the same move
  against an unlucky schedule would have produced a review of an empty diff
  reported as "no findings". **`git stash` is a tree edit. The rule that a wave's
  brief is a snapshot applies to a reviewer too.**
► **I NEARLY SPENT THE SESSION'S ONE WAVE ON A QUESTION THE SUITE ANSWERS.** The
  first draft had a fourth question asking which pins would turn red. Running the
  suite answers that in 77 seconds. The wave is for what no test pins.

## Highest-value work, ranked

1. **RE-DERIVE THE PIXEL NUMBERS.** Unchanged from yesterday and now the oldest
   open item. Everything published before 2026-09-18 went through a 300×150
   backing store. `canvasBackingFor` is tested, so the instrument is sound; the
   re-measurement is not done. **Needs a browser — the owner's, or a supervised
   main-session run. No agent launches one.**
2. **`magic_damage_character` (`+0x148e`) IS NOW THE NEXT CODE INCREMENT**, not
   `cast_gale`. It sat behind the same unread column and the column is read. Do
   what this session did: derive it in full FIRST, say what it is gated on, and
   only then decide whether the engine can express the gate.
3. **`cast_gale` IS BLOCKED ON `fightdistance`, WHICH IS AN ARENA FIELD.** Two of
   its five conditions are per-combatant and already declared
   (`armourclass`/`armourclass_max`); one is the six slots, now declared; one is
   the 28-arm ladder; and one is `_root.arena.fightdistance`, for which this
   engine has **no combatant-level home**. That is a shape decision, not a
   derivation, and it is the whole of what remains. **The blocker has moved three
   times now and each move was progress — do not let the fourth be a guess.**
4. **DECIDE `CANONICAL_RESOURCE_SOURCES` WITH THE VERB, NOT BEFORE.** The six
   are deliberately out of it: nothing writes a slot, and `emitResource` is
   silent about a resource that never moves. The moment a verb consumes an item
   it must go in, or the consume is reported as an unmapped write against a
   field that plainly exists. **That is the `psyche_up` sequence exactly**
   (`a89601c` vocabulary, `b201486` verb).
5. **THE NONCE RECOVERY APPLY IS STILL THE OWNER'S**, and **RE-TAKE THE `D:`
   MIRROR** (1,588 files against an archive of 8,325). Both unchanged.

## Hard rules

- **RUN THE CODEX REVIEW PER DIFF THAT MATTERS.** Kept from yesterday, and this
  session ran it BEFORE committing anything rather than after pushing thirteen.
- **A FAN-OUT WAVE IS FOR WHAT NO TEST PINS AND NO DIFF REVIEW REACHES.** One
  wave, 4 questions, 5 verifiers, on the bytes. It broke three published
  sentences. A question the suite can answer is not a wave question.
- **GIVE AGENTS THE DUMPS, NOT THE INSTALL.** Producing the disassembly in the
  main session and handing over files is what keeps the oracle out of reach
  while still letting an agent re-derive from bytes. **Then say so once, in one
  sentence, in one direction.**
- **MUTATION-CHECK EVERY PIN YOU MOVE.** Revert it; it must go red; restore it.
  A green suite after editing both the code and its pin proves nothing.
- **MEASURE THE HASHES, DO NOT ARGUE THEM.** The golden census is 60 lines and
  ran in seconds. Two files in this repo disagreed for four days about the
  mechanism that protects the corpus, and the wrong one was the file whose job
  is explaining it.
- **PICK AN EXAMPLE THAT IS THE THING AND NOTHING ELSE.** `inventory1` was
  chosen on 2026-09-16 to illustrate "a vanilla field is not a resource" and was
  promoted out from under that assertion three days later.
- **`git stash` IS A TREE EDIT.** Do not run one under a review or a wave.
- **DO NOT "FIX" `psyche_up: 0` IN `tools/arena/roster.js`.** It is below the
  build's floor deliberately, reconciled at press time, and pinned by two tests
  that cite that file by name. It is NOT the same case as the inventory zeroes.
- **DO NOT START A SCHEMA CHANGE YOU CANNOT FINISH AND REVIEW.**
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES RUFFLE OR A BROWSER, OR TOUCHES THE INSTALLATION.** The
  oracle is `…/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf`,
  sha256 `77CB545C…`, **re-verified byte-identical at the end of this session**.
  The Steam "Redux" build beside it is a DIFFERENT file and is not the oracle.
- **Ship no SS2 asset.** Item display names and descriptions stayed out of this
  session's commits deliberately, including from the evidence for the identical
  nothing-rows — the byte tails carry the argument without the strings.
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
