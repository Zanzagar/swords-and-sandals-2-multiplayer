---
handoff:      2026-09-16-0500--psyche-up-is-built
written:      2026-09-16 05:00 -0400
sessionId:    79ae298f-54e8-4964-9c3b-65d33f2bb1b0
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      `80c9b10..HEAD` — `f89113c` (shot.sh retired), `6a80c04` +
              `626afa3` (the capture window), `a89601c` (the vocabulary),
              `b201486` (psyche_up), plus this line's own. **Re-measure.**
suite:        **Re-measure BY EXIT CODE after your own commit.** 1931 / fail 0 /
              skipped 1 here. `fail == 0` and the exit code are the gate.
agentRuns:    NONE this stretch. The derivation wave was the 01:30 handoff's.
next:         **RANKED BELOW. `psyche_up` IS CLOSED; what is left at the top is
              the owner's.**
---
# Handoff — `psyche_up` is built

## The one-sentence version

The last vanilla action that was neither built nor blocked now resolves, and the
twelve figure-pack effect groups that three handoffs recorded as reaching nobody
reach a real gladiator — **and the discharge needed no arithmetic at all,
because it was already in the module the goldens replay against.**

## WHAT IS DONE

► **`psyche_up`, END TO END.** The counter is read at press time and advanced on
  report-back: 1 plays `psyche_up`, 2 plays `psyche_up2`, 3 plays `psyche_up3`
  and fires a range-gated grievous. Vocabulary, resolution, the reset, the range
  gate, `legalActions`, the presentation binding, a `psyche` clip family, two
  timelines, and 15 tests in `test/ss2-psyche-up.test.js`.

► **THE BRIEF'S FIRST NAMED HOLE WAS NOT A HOLE.** It ranked the map's
  unexpanded "level-based fallback" first among six things that could change the
  implementation. It is expanded — `character_level * 10` when
  `ceil(max_damage * 1.5) <= 1`, in `directionProfile`'s `direction === 30` arm.
  **The verifier that said so was right and the investigator that called it a
  blocker was wrong**, which is the second time in two sessions that a verifier
  caught a correction rather than an error.

► **THE STRUCTURAL WARNING WAS THE ONE THAT MATTERED.** A verifier broke the
  "same shape as ranged" framing on exactly one point: `ATTACK_BANDS` membership
  means "always attacks", and two of three presses draw nothing. That is the
  decision the whole build turns on — a band entry would put samples on the
  ordered channel the build never takes and desynchronise every peer replaying
  the same tape from the first charge onward.

► **THE RESET IS IN ONE PLACE BECAUSE THE BUILD PUTS IT IN ONE PLACE.**
  `nextphase` writes `psyche_up = 1` on any decision that is not `psyche_up`,
  and `phaseTransitionEffects` IS this engine's `nextphase` — every completed
  phase pays and regenerates through it. Eight copies of that rule would have
  meant one branch banking a charge for free.

► **SIX PINNED LISTS TURNED RED AND EVERY ONE WAS RIGHT TO.** Two are the good
  kind: the test titled *"THE FOUR CLIPS THAT CARRY EVERY EFFECT GROUP ARE
  UNREACHABLE — say it, do not discover it"* was written to fail when this was
  built, and did; and an adapter test used `psyche_up` as its EXAMPLE of "a
  vanilla field is not a resource by being a field" — the rule stands, the
  example moved to `inventory1`, and the counter is now asserted from the other
  side so a revert fails there too.

► **NOTHING MOVED.** Suite 1931, fail 0, every golden, fixture, replay and
  observation test included. The counter is a resource with **no default**,
  which is what bought that: a defaulted name reaches every golden's combatant
  and moves all 23 replay hashes.

## Known, measured, unsettled

► **WHERE THE COUNTER LANDS AFTER A DISCHARGE.** `+0x6738` writes it back to 1
  and `+0x6761` adds one in a later tick, so the map's static reading is **2**,
  and that is what ships, marked at its own test. **The map's own gloss on it is
  wrong by one press** — at 2 the selector picks `psyche_up2`, so the two
  readings differ as a CADENCE (three presses to the first discharge and two per
  discharge after, against three every time), not as a re-discharge.
  **Settling it: two consecutive discharges captured with `-TraceWindow phase`
  and `-WatchFields psyche_up`.** Both exist now; neither existed yesterday.

► **THE TWO `psyche_charging*` CONTINUATIONS STILL REACH NOBODY**, and that is a
  design rather than a gap: this engine dispatches one animation per action and
  has no concept of a sequence. Two of the twelve effect groups sit there.
  **Giving the engine a sequence is a real feature and would finish the set.**

## Highest-value work, ranked

1. **RE-SHOOT THE PROBES UNDER ADOBE'S PLAYER IF YOU EVER HAVE ONE — the
   owner's, untouched.**

2. **THE PSYCHE CAPTURE.** Two consecutive discharges under `-TraceWindow phase`
   settles the cadence candidate. Save-mutating, so the owner's to authorise —
   but the wrapper and the gate are ready and both windows pass.

3. **ANIMATION SEQUENCES**, which would let `psyche_charging`/`psyche_charging2`
   follow their `psyche_up`/`psyche_up2` and bring the last two effect groups in.
   The frame ranges are contiguous (1609-1617 into 1618-1626), which is the
   evidence they were authored to run together.

4. **`taunt` IS THE LAST DEFERRED VANILLA ACTION**, and its stated reason is the
   only one in that paragraph that has not gone stale: the candidate implements
   only the post-`checkattackroll` arm, so it would consume the wrong number of
   samples.

5. **DECIDE WHICH RASTERISER THIS PROJECT MEASURES IN.** Every committed number
   is `cpu`; a player runs neither configuration; the gap is 15.9% of the frame.

## Hard rules

- **"ALWAYS ATTACKS" IS WHAT A BAND ENTRY MEANS.** An action that rolls on some
  presses and not others does not belong in one, however much it looks like an
  attack.
- **PUT A BUILD-WIDE RULE WHERE THE BUILD PUTS IT.** `nextphase` resets the
  counter, so the reset belongs in this engine's `nextphase` and not in eight
  branches.
- **A RESOURCE WITH NO DEFAULT COSTS NO GOLDEN.** A defaulted one moves all 23.
  The choice is made at the name, and the reason belongs beside it.
- **A TEST WRITTEN TO GO RED WHEN SOMETHING IS BUILT IS NOT A TEST THAT BROKE.**
  Rewrite the paragraph it demanded; do not delete it.
- **AN AGENT THAT CORRECTS YOU CAN OVERSHOOT** — twice now, and both times the
  verifier caught the correction rather than the error.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES CHROME OR RUFFLE, OR REGENERATES `assets/`.**
- **Ship no SS2 asset.**
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
