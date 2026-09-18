---
handoff:      2026-09-16-2356--the-stance-the-glow-and-an-ai-that-winds-up
written:      2026-09-16 23:56 -0400, extended 2026-09-17 00:40 (the ranked
              item 1 retraction and the victory celebration), 01:20 (the taunt
              derivation and the psyche write census), 02:30 (taunt built,
              and a Codex review's three findings), 03:40 (the taunted flee and
              the run's displacement) and 04:40 (a second Codex review: three
              real, one rejected on the bytes) and 08:00 (a twelve-agent wave:
              the facing nobody had, and a cost that was never real), same
              session
sessionId:    cbee9926-159f-4edb-abcb-8d75f213b5de
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      `080538a..HEAD` — `b1be7b2` (the charged stance), `ce38286` (six
              verifiers' corrections), `1775a4c` (the AI trait), `e0a3400` (the
              Codex finding), `85be7a2` (the ranked-item-1 retraction),
              `d093bff` (the victory celebration), `8ede824` + `d5dabeb`
              (`taunt`), `dd49a4e` (the flee ranked), `cbaf406` (the flee built
              and the run derived), `bba6fd0` (the second Codex review: three
              fixed, one rejected), `d836413` (item 6 closed), plus the wave's
              own commit and this line's.
              **Re-measure with `git log --oneline`.**
suite:        **Re-measure BY EXIT CODE after your own commit.** `fail == 0` and
              the exit code are the gate. **2023 / fail 0 / skipped 1, exit 0**,
              measured against the tree the LAST commit of this session leaves
              behind, which is what the instruction above means. Against 1960
              at the start of this stretch. (It said 1984, then 1986, then 2003,
              each time measured a commit too early. That is four handoffs
              running, so the fix is procedural and not a better number: write
              the line LAST, from a run against the tree you are about to
              leave.)
agentRuns:    `wf_b86d8124-b42` — 6 write-nothing verifiers, one named claim
              each. 6 briefs, 6 returned, 0 dead, **2 REFUTED**. Plus FOUR
              pinned Codex adversarial reviews (`gpt-6-astra`): one
              needs-attention with 2 findings (both fixed), one HIGH finding on
              `1775a4c` — the charging AI aimed at the wrong foe — fixed in
              `e0a3400`, and two approve (the stance, and the celebration in
              `d093bff`). Then two more: one needs-attention with THREE HIGH on
              the taunt (all three real, fixed in `d5dabeb`) and one
              needs-attention with FOUR on the flee — **three real, fixed in
              `bba6fd0`, and one REJECTED on the bytes**, whose recommendation
              would have diverged the engine from the oracle. Six pinned Codex
              reviews this session; two of the twelve findings did not survive
              re-derivation. **Plus `wf_721cdd3a-f17`** — 6 questions + 6
              adversarial refuters, **12 started, 12 returned, 0 dead, 2 of 6
              headline claims REFUTED**, ~1.7M subagent tokens over 35 minutes.
              It found the facing defect, the false blocker and three wrong byte
              citations in the map.
supersedes:   2026-09-16-2228--the-build-plays-seven-runs.md
next:         **RANKED BELOW. Items 1, 2, 6 and 7 are all CLOSED — 1 by
              RETRACTION after re-derivation, the rest by being BUILT. Items 3,
              4 and 5 are the owner's. **Every vanilla action the controllers
              wire now resolves and every displacement gap on a modelled verb is
              closed. ~~The first thing to pick up is item 7 ... a DECISION and
              not an afternoon, because it re-datums pinned hashes.~~ **That was
              false and it cost two sessions; see item 7.** The first thing to
              pick up now is `shove` — a real SS2 player verb wired to `optionC`
              on two controller frames, chosen by the villain AI, with a stamina
              cost (`round(strength * 1.5)`, `+0x5dd3`) and a displacement
              (`strength * 12` boosted by `gauntlet`, `+0x5e53`) already in the
              bytes, and NO representation here at all.**
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

6. ~~**`taunt` IS THE LAST DEFERRED VANILLA ACTION.**~~ **BUILT 2026-09-17
   (`8ede824`, `d5dabeb`), AND ITS DEFERRAL REASON WAS RIGHT TO THE END.** The
   candidate implements direction 20's profile and nothing before it, which is
   why the build takes the two pre-draws itself. Measured budget: **1 sample on
   a failed roll, 2 on effect 2, and the dispatcher's only on effect 1.**
   Every vanilla action the controllers wire now resolves, and the deferral
   paragraph in `ss2-rules.js` is empty — kept for its history, which is that it
   went stale twice while readers were about to re-derive work already beneath
   it.

   ~~**WHAT IS LEFT OF IT, and it is the first thing to pick up:**~~ **BUILT —**
   the `taunted1`
   flee. A landed taunt against a bow-mode defender sets the flag faithfully and
   **nothing reads it**, so that one outcome in four is partial — it breaks a
   psych-up charge (`+0x6ac8`) and no more. A Codex review called that out and
   is right. The build drives a taunted gladiator into
   `getphase("runleft")`/`("runright")` by FACING, a movement phase at the run's
   step factor.

   ~~**The blocker is one derivation, named precisely**: `ss2WalkDestination`
   hardcodes `ss2WalkDisplacement`, which is `movement_speed * 16` in the
   build's exact operation order — and its own docstring records that collapsing
   that arithmetic shipped a +1 divergence for a commit. **Generalising it to 40
   would assert the run shares the walk's easing and boot pipeline, which nobody
   has read out of `+0x40d8`/`+0x3f4f`.** Derive that first; the rest is an
   afternoon.~~ **DERIVED AND BUILT 2026-09-17 (`cbaf406`, corrected in
   `bba6fd0`). THE ITEM IS CLOSED.** The run shares the walk's EASING (`/ 8`,
   `ceil`, do/while) and NOT its boot pipeline: `+0x3f4f`/`+0x40d8` set
   `destination = _x -/+ movement_speed * 40` with no `add_percentage` anywhere
   in either arm, and the stop gap is 10 rather than 20. `ss2RunDisplacement`
   runs the loop, because `40 * ms - 10` is **+1 low at 23 of the 57 reachable
   speeds**. **And the question the item did not think to ask was the body
   rule** — the run has one, it is an ABORT rather than the walk's CLIP, and the
   flee's inverted facing makes it unreachable. See the 04:40 extension.

7. ~~**KNOCKBACKS DISPLACE NOBODY, on the one path left.** ... **Closing the
   last one moves positions, which are projected and hashed** — so it re-datums
   pinned hashes and any golden carrying one, and is its own decision with its
   own evidence rather than a rider on a verb.~~ **BUILT 2026-09-17, AND THE
   STATED COST WAS FALSE. ITEM CLOSED.**

   No golden carries a position or a hash and none structurally can —
   `startingPosition` returns `null` under `fixtureReplay` — and the
   displacement moved **zero** pinned hashes, measured. **An afternoon's work
   was deferred across two sessions on a cost nobody had measured**, and this
   line's own `next:` field dropped the word "any" and called it a DECISION.

   Two things it did turn up that this item did not know about:
   - **The count was wrong.** `knockback()` has FOUR call sites, not two:
     `damagecharacter`, `taunt`, **`shove`** and **`cast_gale`**. The last two
     are player verbs this engine does not model at all, so "the one path left"
     was only ever true of verbs already built.
   - **It could not be built correctly until the facing was**, because
     `damagecharacter` signs the force on the DEFENDER's facing — and this
     engine had no facing on anybody who had not yet walked. See the living
     head.

8. **DECIDE WHICH RASTERISER THIS PROJECT MEASURES IN.** Every committed number
   is `cpu`; the gap is 15.9% of the frame.

## EXTENSION, 2026-09-17 04:40 — the flee, and the review that was right three times and wrong once

**The taunted flee is built (`cbaf406`) and then corrected.** Row 3 of frame 1's
forced chain was the last vanilla action left; `ss2RunDisplacement` is
`movement_speed * 40` (no boot bonus) eased down to a stop gap of **10**, run as
the build's do/while rather than as `40 * ms - 10`, which is **+1 low at 23 of
the 57 reachable speeds**.

**A Codex review of `cbaf406` returned four findings. Three were real.**

1. **The flee left the facing stale.** `changeCombatants` recomputes both
   facings at every phase advance (`+0x28bf`-`+0x2ae3`) and a flee is one. It
   emits `facingAfter` now.
2. **One flee spent one `taunted1` token.** Tokens are source-qualified; the
   build's flag is a boolean. Two taunters left a survivor that forced a second
   flee.
3. **A forced swap consumed nothing and a forced rest four of five flags.** Rows
   1-7 are statements, and row 3 writes `taunted1 = false` before its
   `getphase`, so a row-1 swap or a row-2 rest spends a pending flee.
   `SS2_CHAIN_CLEAR_FLAGS` is the list, and `forcedStatusFlag` ranks off the
   same one.

**The fourth is REJECTED, on the bytes.** *"Extract the body-clamping logic and
use it on the flee."* Both run arms DO carry a body test (`+0x3fbd`, `+0x4146`)
and it is not the walk's clip — live `_x` every frame, abort rather than
shorten, the ATTACKER's `physical_size` rather than the defender's — and **it is
guarded on the facing, which the flee inverts**. Row 3 sends
`gladiator_dir == "right"` to `runleft`, whose guard wants `"left"`. The abort
cannot fire on a flee. Two tests pin it: the flee crossing a body, and a walk
stopping short in the same geometry.

**Bonus, retracted at the constant:** `SS2_ARENA.clamp` carried a caveat saying
`[-2100, 2100]` existed in the map's prose with no byte offset. Both literals
are pushed eight times (`+0x31c2` … `+0x325b`). **The absence was the decoder's,
not the build's** — the tool that produced the four `If` offsets printed opcodes
without operands.

### What this cost, and the shape of it

Three of the four defects are the SAME defect: **a rule was already written down
in this file's own code, and the new branch did not call it.**
`statusConsumptionEffects` carries the multiple-token lesson in a comment; the
rest branch had modelled chain consumption since 2026-09-02; `facingAfter` was
three screens up. A fourth thing made it easy — the comment above `facingAfter`
said *"exactly two verbs move anybody: a walk and a rank change"*, **a census
that was true when written and read as a licence once it was false.** It states
the rule now, not the count.

## EXTENSION, 2026-09-17 08:00 — the facing nobody had, and a cost that was never real

**A twelve-agent read-only wave (6 questions + 6 adversarial refuters, 12
started, 12 returned, 0 dead) was aimed at ranked item 7 and broke a commit made
four hours earlier.**

Three things came out of it, in descending order of how much they matter.

1. **A gladiator who had not moved was facing nobody, and 40 of 40 opening
   ranged attacks were scored as back attacks at +50% damage.** `ss2FacingEffects`
   was correct and had ONE call site — the movement branches — so an unmoved
   gladiator carried no `facing-left`, and `ss2IsBackAttack` reads a missing
   token as "faces right". Melee could not show it: at 500 apart nothing melee
   is in reach until somebody walks, and walking fixed the facing. Fixed with an
   `openingEffects` hook, which is where the build derives it too.
2. **`damagecharacter`'s knockback now displaces, and the reason it had not was
   false.** "It re-datums every pinned hash and every golden that carries one"
   was written in three places. No golden carries a position or a hash and none
   can; the displacement moves zero pins. The sentence quantified over an empty
   set and a handoff then dropped the hedge.
3. **The arena clamp is cited to dead code, and I wrote that citation the same
   day.** `nextphase`'s ±2100 block acts on `_root.game.hero`/`.villain`, which
   are `new Object()`s. The live clamp is in `attacker.onEnterFrame`. The value
   survives; every use of `SS2_ARENA.clamp` here is still right.

### What the wave cost and what it was worth

12 agents, ~1.7M subagent tokens, 646 tool calls, 35 minutes wall clock. Two of
the six headline claims were REFUTED by their own refuters and both refutations
were substantive corrections rather than rejections. It found one live
correctness defect, one false blocker that had cost two sessions, three wrong
byte citations in the map, and a fourth in a constant's docstring. **It is the
clearest case yet for the rule that a wave is for breaking a claim about the
bytes that no test pins and no diff review reaches** — every one of these had
been read by a Codex review and by me, and survived both.

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
  claims; the advice is too. **Measured again 2026-09-17 on the flee review: the
  OBSERVATION can be right while the RECOMMENDATION diverges the engine from the
  oracle** — "the flee bypasses body collision" is true, and so does the build.
- **A COUNT IN A COMMENT GOES STALE SILENTLY; A RULE DOES NOT.** *"Exactly two
  verbs move anybody"* was true when written, false the day the flee shipped,
  and in between it read as a licence not to thread the new branch.
- **A RETRACTION IS A NEW CLAIM AND NEEDS ITS OWN EVIDENCE.** The ±2100 caveat
  was retracted for a good reason — the decoder had hidden the operands — and
  the replacement asserted an EFFECT that finding the operands did not prove.
  **Finding the literal proves the literal. Check the receiver.**
- **DO NOT DEFER WORK FOR A COST YOU HAVE NOT MEASURED.** "It re-datums every
  pinned hash and every golden that carries one" was written once with a hedge,
  copied twice without one, and cost two sessions. Measuring it took one scratch
  copy and one suite run.
- **A MUTATION CHECK THAT FAILS ONE TEST WHERE YOU EXPECTED TWO IS A FINDING.**
  Removing the facing hook failed one of the two facing tests — the other was
  asserting a STATED `gladiator_dir` from the file's own helper, not the derived
  one. It was rewritten to state no facing at all.
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
