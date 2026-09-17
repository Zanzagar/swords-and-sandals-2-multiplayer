---
handoff:      2026-09-16-2356--the-stance-the-glow-and-an-ai-that-winds-up
written:      2026-09-16 23:56 -0400, extended 2026-09-17 00:40 (the ranked
              item 1 retraction and the victory celebration) and 01:20 (the
              taunt derivation and the psyche write census), same session
sessionId:    cbee9926-159f-4edb-abcb-8d75f213b5de
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      `080538a..HEAD` — `b1be7b2` (the charged stance), `ce38286` (six
              verifiers' corrections), `1775a4c` (the AI trait), `e0a3400` (the
              Codex finding), `85be7a2` (the ranked-item-1 retraction),
              `d093bff` (the victory celebration), plus this line's own.
              **Re-measure with `git log --oneline`.**
suite:        **Re-measure BY EXIT CODE after your own commit.** `fail == 0` and
              the exit code are the gate. **1991 / fail 0 / skipped 1, exit 0**,
              measured against the tree this commit leaves behind. Against 1960
              at the start of this stretch. (It said 1984, then 1986, each time
              measured a commit too early. That is three handoffs running, so
              the fix is procedural and not a better number: write the line
              LAST, from a run against the tree you are about to leave.)
agentRuns:    `wf_b86d8124-b42` — 6 write-nothing verifiers, one named claim
              each. 6 briefs, 6 returned, 0 dead, **2 REFUTED**. Plus FOUR
              pinned Codex adversarial reviews (`gpt-6-astra`): one
              needs-attention with 2 findings (both fixed), one HIGH finding on
              `1775a4c` — the charging AI aimed at the wrong foe — fixed in
              `e0a3400`, and two approve (the stance, and the celebration in
              `d093bff`).
supersedes:   2026-09-16-2228--the-build-plays-seven-runs.md
next:         **RANKED BELOW. Items 1 and 2 are CLOSED — 1 by RETRACTION after
              re-derivation, 2 by being BUILT. Items 3, 4 and 5 are the
              owner's; **the first thing an agent can pick up unaided is
              `taunt` at 6, and it is now SPECIFIED rather than deferred.**
---
# Handoff — the stance, the glow, and an AI that winds up

## The one-sentence version

The previous handoff ranked the charged stance first and it is built — a
gladiator holding a psych-up charge now stands in the charged pose and **glows
while he waits**, which is the first figure effect group anything in this
repository draws — and the AI will now wind up for one, behind a flag, **on a
trait rather than on the arithmetic, because the arithmetic says charging is a
losing move.**

## WHAT IS DONE

► **THE CHARGED STANCE (`b1be7b2`).** `changeCombatants` resets both fighters to
  `Standing` and then overrides whichever holds a charge with
  `gotoAndStop("psyche_charging")` at counter 2 and `psyche_charging2` at 3,
  four sites (`+0x281e`, `+0x284d`, `+0x287c`, `+0x28ab`). `src/render/stance.js`
  owns the whole idle decision now — the shell had `timelineFor("Standing")` and
  a clock inline, so "which pose does a gladiator rest in" was a decision the
  suite could not reach and nobody had asked.

► **AND THE GLOW CLOSED A CONDITION SOMEBODY ELSE HAD LEFT.**
  `figureRouteFor()` said `filtersScaled: false` with its reason written out:
  *"nothing can observe a figure filter string ... flip it in the commit that
  makes a figure group observable, beside a test that reads two
  `figureEffectGroupsFor` results at two scales."* A resting charged gladiator
  carries the cyan glow, so that test can exist; it does; the flag is `true`.
  Radii 4.2742px at scale 1, 8.5483 at 2, 17.0967 at 4.

► **THE AI WINDS UP, BEHIND `aiCharges` (`1775a4c`).** Off by default, in the
  rule-set id when on, so no pinned hash, golden or census moves. 40 seeded 3v3
  bouts: 0 charges off, 2,433 on (30.6% of actions, 974 discharges), all 40
  resolving either way, bouts 8% longer.

## What broke, and who broke it

**Six verifiers, 2 refuted. Three Codex reviews, one needs-attention. Every
finding re-derived here before anything was touched.**

► **"THE CHARGED POSE IS THE ONLY HELD FIGHTER STANCE IN COMBAT" — REFUTED.**
  The count was exact (26 `gotoAndStop` in the overlay, exactly 4 on a fighter)
  but the inference was not: **86 of the fighter clip's frame scripts end in
  `Stop` and only 7 spans self-loop**, so the figure parks on the terminal frame
  of nearly every action until the next `changeCombatants`. The defensible claim
  is *the only held stance that SURVIVES A TURN BOUNDARY*.

► **"REPRODUCES THE BUILD RATHER THAN APPROXIMATING IT" — REFUTED, but by much
  less than the verifier and I both thought.** The build does not restore the
  stance at the instant a clip ends — it waits one enter-frame for the `struck`
  poll. **Not the ~2 s that reached ranked item 1**; see the retraction there.
  It remains an approximation, of about one frame.

► **`changeCombatants` RUNS ~4x A TURN, NOT ONCE** (`+0x317e`, `+0x3638`,
  `+0x365f`). `battle_action` is a phase selector, not a turn counter.

► **TWO REAL CODE DEFECTS**: `idleFrameFor` had no `alive` guard (a hand-forged
  dead-and-charged combatant came back glowing; only the shell's own death
  branch saved the picture), and a negative finite `now` leaked a negative
  phase while the docstring promised normalisation.

► **AND A CODEX REVIEW CAUGHT THE `knockback` CORRECTION MAKING KNOCKBACKS
  SILENT** — and re-deriving it found the same hole already open on `hurt8`
  since 2026-09-14. Sound follows the RUN now, never the family.

## Things I got wrong, recorded because the next reader will not

- **I committed underneath a running wave.** Launched six verifiers, then
  committed, reasoning it would give them a stable tree. It does the opposite:
  `git status` went empty under two of them mid-run. **Commit BEFORE launching.**
- **I shipped a dead guard.** `ss2PsycheDischargeInRange` in the AI arm changed
  the charge count by zero and removing it broke no test — the `!attackOnOffer`
  arm returns first, so it was unreachable. Deleted.
- **I nearly wrote up a false alarm**: "AI bouts cannot converge", 0 of 25
  resolving, damage exactly cancelled by healing. It was my own stat choice —
  `healed = 1 + ceil(stamina / 2)` and I had picked `stamina: 40`, making regen
  21, the same as quick-attack's damage. The real roster has `stamina: 5` and
  25/25 resolve. **Check your fixture before you report the engine.**
- **A guessed commit hash**, and a suite line measured one commit too early.
- **I decided a self-targeted action's target could not matter.** It sets the
  discharge's range gate and its damage roll, and the AI spent its turns aiming
  at a foe across the arena. A Codex review found it; I had looked straight at
  the per-foe option list and reasoned past it.
- **AND I RELAYED A VERIFIER'S NUMBER INTO A RANKED ITEM WITHOUT RE-DERIVING
  IT.** "The build holds the last frame for ~2 s" was a conflation of the
  `demand_move` stall watchdog with the normal `struck` poll; the real hold is
  one enter-frame. It made item 1 of this handoff a phantom. **The rule I broke
  is the one I put in the verifiers' own briefs.**
- **I deleted the same dead guard twice.** Removed it on a mutation check,
  distrusted the check because my tests were all 1v1 melee, restored it on the
  review's recommendation — and only then measured: 0 of 60 attackable foes are
  outside the discharge gate, archers included. **A review recommendation is a
  claim to verify, not an instruction.**

## Highest-value work, ranked

1. ~~**ACTION-END HOLD, and it is bigger than anything this session built.** The
   build freezes a figure on the LAST frame until the next `changeCombatants`,
   which `nextphase` gates on `demand_move >= 60` enter-frames (~2 s at 30
   fps).~~ **WRONG, AND IT WAS WRONG THE MOMENT I WROTE IT — RE-DERIVED
   2026-09-17 AND THE ITEM IS ESSENTIALLY CLOSED.** I took the ~2 s from a
   verifier and did not re-derive it, which is the one rule I put in their own
   briefs.

   **The build's hold is ONE ENTER-FRAME, about 33 ms.** The chain: a clip's
   last frame runs `this.struck = true; stop()`; the fighter's `onEnterFrame`
   polls `attacker.struck != null` (`+0x5025`), and on the very next frame
   clears it and calls `nextphase()` (`+0x5121`-`+0x513d`), which calls
   `changeCombatants` and re-poses. **`demand_move` is a STALL WATCHDOG, not
   the normal path**: `>= 60` fires only when the attacker has also landed
   (`_y >= grounded`) and no bullet is in flight, and `>= 200` is the harder
   backstop — both exist for animations that never report at all.

   So the engine dropping to the idle at `durationMs` is within a frame of what
   the build does, and there is no meaningful gap. **What survives is
   cosmetic**, and was already recorded: the build RESTARTS the `Standing` loop
   from frame 2 at every `changeCombatants` (`gotoAndPlay`, not `gotoAndStop`),
   while this engine's idle phase free-runs off `performance.now()`.

   **The real lesson is the one about me**: the previous handoff's own hard
   rules already said a mutation check only proves what the tests reach, and
   AGENTS.md says never relay a number you have not re-derived. I relayed one
   into a ranked item and it displaced the genuine next piece of work for a day.

2. ~~**A VICTORY IDLE.**~~ **BUILT 2026-09-17 (`d093bff`).** A surviving winner
   on the winning team draws `celebrate1`, which runs on into `celebrate1a` and
   loops — re-derived from the oracle: overlay frame 65 inside `combatwon`
   (62-73) and frame 77 inside `combatlost` (74-84), with `GoToLabel
   ("celebrate1a"); Play` at 1426. **The celebration outranks the charged
   stance**, because a finished bout has nothing left to spend a charge on, and
   the dead do not celebrate. One stated approximation: the build cycles only
   the 18-frame body and this loops all 27, so the winner re-plays his opening
   flourish once a cycle — closing that needs a loop-start offset, which needs
   the renderer to hold when the bout ended, which is the statelessness that
   makes the idle need nothing invalidated.

3. **RE-SHOOT THE PROBES UNDER ADOBE'S PLAYER IF YOU EVER HAVE ONE — the
   owner's, untouched.**

4. **THE PSYCHE CAPTURE, still blocked on the ROUTE** (see `4d2ee1b`). Two
   things now ride on it: the cadence candidate, and **the stance makes it
   VISIBLE** — a non-lethal discharge leaves the counter at 2, so a gladiator
   who has just fired keeps glowing. If a capture ever says 1, the pose drops to
   `Standing` instead. The report-back timing is a second question the same
   capture answers: `struck = true` fires at 1626 and 1643, the END of the run.

5. **TUNE OR ACCEPT 30.6%.** With `aiCharges` on, the two bow slots wind up on
   most of their turns, because an archer at range is rarely wounded and the
   gate is full health. Stated rather than tuned; the number is the owner's.

6. ~~**`taunt` IS THE LAST DEFERRED VANILLA ACTION**, reason unchanged.~~
   **STILL THE LAST ONE, BUT NO LONGER BLOCKED ON A DERIVATION — IT IS FULLY
   SPECIFIED NOW (`34636ff`, `2a0e3da`), AND IT IS THE FIRST THING TO PICK UP.**
   The deferral reason was exact and is still true: the candidate implements
   only the post-`checkattackroll` arm. **The missing half is written out in the
   battle map under "The taunt phase, in full"**, byte by byte, and four things
   in it were not in the prose:
   - **Both clips fire BEFORE the roll** — `taunt` on the actor, `taunted` on
     the target — so a FAILED taunt still animates both.
   - **The comparison is DIRECT**, `diceroll < taunt_percentage` (`+0x694b`),
     not the dispatcher's `100 - chance` form. Backwards inverts the action.
   - **`taunt_effect == 2` splits on the DEFENDER'S WEAPON MODE** (`+0x69a7`),
     which is the discriminator the map had left open: `equipped_weapon == 1`
     is melee and takes a `charisma * 25` shove, anything else is the bow and is
     made to flee.
   - **The displacement is unconditional; the ANIMATION is gated** on
     `|force| > 100`, the same shape `damagecharacter` has.

   **What is already built and must not be re-derived**: the candidate computes
   `chances.taunt` as `bounded(roundedChance(charismaRatio, 0.4))` — the bytes
   at `+0x052b` exactly — and direction 20's damage profile
   (`round(charisma * 4) - defender.charisma`, floored by a 1-3 roll,
   `critical: 21`). `SS2_TAUNT_FLAGS` and the flag-clearing in `defenderEffects`
   exist too.

   **What is left**: the two pre-samples in order, the two effect arms, and the
   `taunted1` FLEE consumption — `SS2_STATUS_PHASE_FOR_FLAG` carries the four
   conditions and not the taunt flags, so a taunted gladiator does not yet run.
   The map's decision table row 3 has the flee: `taunted1 == true` -> facing
   right `getphase("runleft")`, facing left `getphase("runright")`.

7. **THE `psyche_up` WRITE CENSUS IS COMPLETE AND THREE OF EIGHT SITES WERE
   UNRECORDED** (`34636ff`). Nothing is live — no magic-damage, taunt or
   whirlwind verb exists here — but `+0x7a6a` is worth knowing before anyone
   builds `cast_whirlwind`: it writes the counter back with **no matching
   increment**, so a whirlwind caster is left at 1 where a psych-up discharger
   is left at 2.

8. **DECIDE WHICH RASTERISER THIS PROJECT MEASURES IN.** Every committed number
   is `cpu`; the gap is 15.9% of the frame.

## Hard rules

- **COMMIT BEFORE LAUNCHING A WAVE, NOT DURING ONE.** A commit does not
  stabilise the tree for a reader; it changes what `git status` and `git diff`
  report underneath them.
- **CHECK YOUR FIXTURE BEFORE YOU REPORT THE ENGINE.** One stat choice made the
  whole game look like a stalemate.
- **A GUARD NO TEST CAN REACH, CARRYING A JUSTIFICATION MEASUREMENT
  CONTRADICTS, IS WORSE THAN NO GUARD.** Mutation-check a new guard; if nothing
  fails, ask whether it is reachable at all — and then MEASURE, because **a
  mutation check only proves what the tests reach.**
- **A CODEX FINDING IS A CLAIM TO VERIFY AND SO IS ITS RECOMMENDATION.** The
  finding here was real and high-severity; the recommendation attached to it put
  back a guard that measurement then removed again. AGENTS.md says findings are
  claims; the advice is too.
- **STAGE A POSITION TEST AND THEN STOP EVERYONE WALKING.** My first repro of
  the wrong-target defect failed because the hero walked to the distant foe,
  making the wrong answer the right one.
- **A DECISION AND THE ARITHMETIC BEHIND IT CAN BOTH BE HONOURED WHEN THEY
  DISAGREE** — say which is which. The owner asked for a charging AI; charging
  is worse; the flag buys a character and says so.
- **AN ENGINE PREMISE IS NOT A BUILD PREMISE**, and the second is the one to
  check against the bytes.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES CHROME OR RUFFLE, TOUCHES THE INSTALLATION, OR REGENERATES
  `assets/`.** Verifiers read a scratchpad COPY of the oracle, sha256-checked
  against the corpus first.
- **Ship no SS2 asset.**
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
