---
handoff:      2026-09-22-1934--every-spell-but-rejuvenate-and-the-build-plays-favourites
written:      2026-09-22 19:34 -0400
sessionId:    f1f6ade5-3cb2-4317-960f-06f265d6423d (resumed from the 2026-09-20
              session; its task and scratch directory ran under
              ae6a81b0-a3d1-40a3-aeb6-34d4dd32bd42 until a mid-session
              compaction, and under f1f6ade5 after it)
branch:       arena/champion-capture. **NOTHING FROM THIS SESSION IS PUSHED.**
              github.com was unreachable from this machine all session (git
              push, `git ls-remote` and plain `curl` all hang, sandboxed or
              not). **Measure the push count yourself, AFTER your own handoff
              commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
              — it was 28 at this handoff's commit, the remote still at `efa9e15`.
commits:      `efa9e15..HEAD`. **Re-measure with `git log --oneline`.**
suite:        **Re-measure BY EXIT CODE after your own commit.** **2578 / fail 0 / skipped 1, exit 0** before this commit,
              against a start-of-session baseline of 2126 / fail 0 / skipped 1.
agentRuns:    **About 60 agents, no fan-out wave, 0 dead.** Before the
              compaction: ~20 (derivers, verifiers, four implementers). After
              it: 10 write-nothing verifiers (7 HOLDS, 3 PARTIALLY-BROKEN —
              every partial break was in a BRIEF's framing, not in the bytes),
              8 derivers, 16 worktree implementers, and after the checkpoint 5
              more verifiers. **About twenty-five Codex adversarial reviews**
              (`gpt-6-astra`): two changes needed three passes each (morph
              support: mask recursion twice; whirlwind/ghost strike: a
              bonus-lethal blow twice), every finding real.
supersedes:   2026-09-22-1821--nine-verbs-built-and-the-build-plays-favourites.md (this
              session's own mid-session checkpoint; the session carried on), which
              superseded 2026-09-20-2130--the-bolts-are-built-and-a-null-was-a-scheduled-divergence.md
next:         **RANKED BELOW. Item 1 needs the owner: five decisions, all the
              same question — reproduce the build's asymmetries, or not.**
---

# Handoff — every spell but rejuvenate is resolved or mapped, and the build plays favourites

## The one-sentence version

Thirteen more verbs resolve — gale, teleport, the eight potions under one
verb, the three fireballs, weaken armour, regenerate, boundless energy,
command, death from above, whirlwind and ghost strike — and the remaining
spells are mapped; but the thing to carry forward is that **the build treats
its hero and its villain differently in three places this engine treats them
alike**, and each one is now a verified fact waiting on an owner's decision
rather than a bug to fix.

## WHAT IS DONE

► **THE PREVIOUS HANDOFF'S RANKED LIST, ITEMS 2-5: ALL CLOSED.** Item 2 (the
  bolts' clip family) `b15716e`; item 3 (`inventory_maxslots`) `811afac`; item
  4 (`cast_gale`) `ea6dd7a` — its "blocked on fightdistance" premise was wrong,
  the five-condition gate is the VILLAIN's decision and the hero's offer is
  possession; item 5 (`randomise_gladiator`'s guard) SETTLED: a second hero
  test at `+0x361f` guards the spell fill, so the hero never gets random
  spells. Items 1 and 6 are unchanged (browser; owner).
► **VERBS, each derived from byte dumps, re-derived by a separate write-nothing
  verifier, built test-first in a worktree, merged, censused and Codex-reviewed:**
  `cast_gale` (ea6dd7a), `cast_teleport` (feacdcb), `drink_potion` for ids 2-9
  (0e1f421 — and the resolver now carries an `itemId`), the three fireballs
  (63931da — flat flight, no hit roll, the victim burns at IMPACT),
  `cast_weaken_armour` (a8ae19e), `cast_regenerate` and `cast_boundless_energy`
  (99e2427 — the per-phase tick lives in `phaseTransitionEffects`),
  `cast_command` (3ab0536 — a 40 px-a-frame pull, no roll), death from above
  (68ce424 — every boulder lands, so it IS a turn; its y draw has REVERSED
  bounds in the build), whirlwind and ghost strike (237541b).
► **MAPPED BUT NOT BUILT (8ef1e48):** colossus (a BUILD BUG: its growth
  assigns instead of adding, converges to 150% and never finishes), little fat
  kid (a debuff on the defender), swift sandals, bloodlust (it HALVES defence),
  adulation. The four stat spells need mutable stats and wait on decision 1a;
  adulation's whole effect is on `crowd_interest`, which this engine does not
  model (decision 1f).
► **SHIPPED CODE THAT WAS WRONG, FIXED:** a pushed victim that did not move on
  screen since 2026-09-19 (ea6dd7a); the attack path three debris draws short
  for every paired armour piece (8180b67); on-screen facing that never changed
  after construction — 108 wrong-way actor-steps in six bouts, now 0 (0ec8102);
  the adapter looking for the timed spell counters on the combat object when
  the build keeps them on the CLIP (7cf7275); a tired AI resting where the
  build's villain drinks or casts (d5f93be); the psyche discharge's range gate
  one pixel too generous, and an out-of-range discharge press keeping a
  charge the build spends (237541b); and **a blow finished by the authored
  back-attack bonus not counting as a kill** — it paid stamina, healed and
  reset psyche as if its target had lived, since the bonus shipped (237541b).
► **PROPS:** the bolt (cf66e1b, 899b758) and the fireball (2c53945) are
  extracted; extract-props bakes MORPH shapes (3ba74bc), so the explosion's
  first 18 frames draw.
► **THE MAP:** twenty-four verified corrections (d92a834); the fireball is a
  turn after all (a99eb92); five phases and the timed buffs in full (7485484);
  the per-round re-skin (4d2341c); the ladder runs last (5d2c8b7).

## The finding that outranks the verbs: the build plays favourites

Three verified facts, each asymmetric between hero and villain, each a
divergence this engine does not reproduce, none moving any golden:

1. **The hero is RE-SKINNED every round; the villain never is** (4d2341c).
   Overlay frame 1 runs `skincharacter(hero)` once per round, rewriting every
   DNA field from `charDNA`. So a helmet knocked off the HERO comes back next
   round, its defence with it, while the armour class stays lost — and a
   second removal takes the defence again. The same re-skin reverts any
   mid-battle stat change on the hero (colossus, bloodlust, swift sandals).
   The villain's removed pieces stay removed.
2. **The villain's spell ladder runs LAST and overrides even a status phase**
   (5d2c8b7). A frozen, burning, poisoned or life-stolen villain holding a
   qualifying item casts, and the status phase is LOST (its flag already
   cleared). The hero's status phases are forced through `getphase`.
3. **A villain at zero stamina can still drink**: frame 1's forced rest reads
   `_root.game.hero.staminaleft` only (found by the AI-reorder implementer).

The engine gives every combatant the same rules. The AI-order half of (2) is
done (d5f93be); the legality halves are not.

## Things I got wrong, recorded because the next reader will not

- **I let the main context fill while six agents were running.** Their
  completion notices arrived at a full context and were not ingested — the
  owner saw "Context limit reached" under each and reasonably read the agents
  as failed. **They had all finished.** Their final reports were recovered
  from the transcripts at `…/tasks/<id>.output` (JSONL; the last assistant text
  block is the report). No work was lost, but only because nothing was
  consumed from memory.
- **My own brief carried two wrong premises that implementers broke:** that
  the teleport arm-26 guard is "when the villain teleports" (it is behind the
  90% roll and 25 arms), and that two possession-only arms pre-empt it (seven
  do). A third — that the arrow has a "react on arrival" mechanism to reuse —
  was false; the fireball implementer built one.
- **Two more of my brief sentences were wrong after the checkpoint:** that a
  commanded target "inside 40 px of the stand-off ends up behind the caster"
  (only one starting under 40 px in front does — a verifier broke it and the
  implementer had already caught it), and the boulder y range `(-800, -600)`,
  relayed from the map without re-reading the push order (the build calls
  `randomBetween(-600, -800)`; the implementer broke it).
- **My first fix for the bonus-lethal ghost strike was too narrow**: it fixed
  the caster's position and left the transition reading the pre-bonus kill.
  Codex's second pass caught it; the general fix is in 237541b.
- **I wrote one test comment that overclaimed** (the mid-morph bounds pin
  "sees geometry growing past its bounds"; it does not) and corrected it
  before committing.
- **Before the compaction, a `git checkout -- src/team/ss2-rules.js` during a
  mutation undo destroyed ~500 lines**, rebuilt from context. The rule was
  already written; I broke it.

## Highest-value work, ranked

1. **FIVE OWNER DECISIONS, and they are one question: reproduce the build's
   asymmetries and quirks, or not?** Each is costed at its site.
   a. The hero's per-round re-skin (restore the hero's removed armour each
      round, not the armour class; revert the hero's mid-battle stat buffs).
   b. The villain's ladder overriding its status phases (a legality change).
   c. The team-play tick for timed buffs: every phase ticks every combatant
      (the 1v1 rule exactly; a buff is worth 10 applications in 1v1, 5 in 2v2,
      4 in 3v3) or only the bearer's own phases — one line,
      `ss2TimedSpellBystanders`.
   d. `cast_rejuvinate`'s shoulderguard: the build restores it from a FREE
      VARIABLE nothing assigns, so it becomes `undefined` (which
      `remove_armour` then treats as equipped). Reproduce, or restore it like
      the other eight? Rejuvenate is otherwise fully derived and verified and
      is the next verb once this is decided.
   e. The weaken-armour AI spends its item on an unarmoured foe, as the build
      does. Keep, or skip?
   f. **`crowd_interest`.** `crowd_action` is NOT a presentation cue, as this
      repository's comments said: `nextphase` adds it into `crowd_interest`,
      which scales the victory purse. Modelling it is hashed state (every
      verb's delta, the per-phase clamp, a settlement) and makes adulation mean
      something; this engine's `SS2_CROWD` toll is authored and unrelated.
2. **THE BROWSER, which no agent may open.** Re-derive the pixel numbers (the
   oldest open item), and look at what today built but nobody has seen: a
   fireball's flight, explosion and the victim burning at impact; a teleport
   that does not slide; figures turning after a teleport, shove or walk past;
   the drink; the bolt at its victim.
3. **THE REMAINING SPELLS** — every one is now mapped (8ef1e48). Colossus,
   little fat kid, swift sandals and bloodlust need a mutable-stat effect kind
   (there is none: `EffectKind` has no stat write), an expiry step that runs
   on bystander ticks, and -1 (not 0) as the inert counter value — the
   build's `== 0` test restores on its own. They wait on 1a. Adulation waits
   on 1f. Rejuvenate waits on 1d. Also open from death from above: whether
   `defender.struck` can already be true when a shower starts.
4. **SHAPES UNDER AN ANCESTOR MASK** are still returned drawable by
   `flattenFrame` (3ba74bc fixed it for morphs only). Measure which extracted
   packs contain one before changing it.
5. **THE CAPTURE WRAPPER** still stages and dumps `spell_*` on
   `_root.game.<side>` (a wrapper edit; needs `validate-vehicle.ps1`, Windows).
6. **PUSH** — see the header. The nonce recovery apply and the `D:` mirror
   re-take remain the owner's.

## Hard rules

- **WHEN AGENTS REPORT INTO A FULL CONTEXT, READ THEIR TRANSCRIPTS, DON'T
  RE-RUN THEM.** Check `stop_reason` on the last line of each
  `tasks/<id>.output` and take the last text block.
- **PARALLEL IMPLEMENTERS ON ONE FILE ARE A MERGE THE MAIN SESSION OWES.** Git's
  3-way interleaves two new branches at their shared lines; resolve by taking
  each branch WHOLE, never by stitching fragments. And each merge creates an
  interaction neither worktree could see: pin it with a test (done three
  times here — potion over teleport, weaken over boundless, the AI order).
- **A PIN THAT MOVES BECAUSE THE EXTRACTION GREW MUST SAY BY HOW MUCH AND WHY**,
  and a pin whose ORACLE stops fitting (interpolated morph bounds) is split,
  measured and explained — never set to whatever came out.
- **CODEX EARNED ITS KEEP ONCE, AND IT WAS ON TOOLING, NOT GAME LOGIC.** Every
  verb review approved; the morph change took three passes, each finding
  real. Keep running it on everything.
- Unchanged: the undo for a mutation is the inverse patch; test the AI, not
  just the verb; measure the hashes (`tools/golden-hash-census.mjs`), do not
  argue them — 23/23 identical after every commit this session.

## Archive errata (below THE ARCHIVE LINE, frozen, so recorded here)

- `HANDOFF.md` ~line 7195 says the taunt restoration is guarded by
  `attacker.struck != null`; the bytes at `+0x6835`-`+0x6841` are `== null`
  (the same inversion corrected in the map's status-arm pseudocode).
- `docs/handoffs/RANGED-BRIEF.md:72-74` and five frozen handoffs of
  2026-09-12/13 describe the villain's bow range as a MAXIMUM; it is a MINIMUM,
  `!(fightdistance < 200)` (`+0x03d3`), corrected in `src/team/ss2-rules.js`.
