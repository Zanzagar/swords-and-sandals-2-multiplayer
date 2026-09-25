---
handoff:      2026-09-19-0400--the-taunt-was-never-ranked
written:      2026-09-19 04:00 -0400
sessionId:    164a0c3b-cf56-4192-b312-5791620299e0
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      `4a444fe..HEAD` — `139b9f8` (the taunt policy, the roster duellist,
              two broken claims), plus this line's own.
              **Re-measure with `git log --oneline`.**
suite:        **Re-measure BY EXIT CODE after your own commit.** `fail == 0` and
              the exit code are the gate. **2048 / fail 0 / skipped 1, exit 0.**
              Against 2035 at the start of this stretch; the 13 are
              `test/ss2-ai-taunt.test.js`.
agentRuns:    **NONE.** No fan-out wave, no subagents. One Codex adversarial
              review (`gpt-6-astra`, model pinned on the command line):
              **approve, no material findings**, and it independently confirmed
              the three properties the diff most needed confirmed — default ids
              stable, valuation consumes no RNG, crowd toll still bounds
              repeated taunting.
supersedes:   2026-09-18-0130--the-picture-was-lying-and-the-canvas-was-a-postage-stamp.md
next:         **RANKED BELOW. Its item 1 is DONE, its item 2 is CLOSED RATHER
              THAN ANSWERED — the premise it was posed on is refuted — and two
              of its published numbers do not survive their own controls.**
---

# Handoff — the taunt was never ranked, and the 4σ claim was one arm

## The one-sentence version

The AI taunts at range now and beats the old policy 288-112 on both sides of the
arena; getting there broke two of the previous handoff's published claims, and
both broke the same way — **a measurement with one arm, or taken at the wrong
layer.**

## WHAT IS DONE

► **THE AI PRICES A TAUNT IN HITPOINTS AND TAKES IT AT RANGE (`139b9f8`).**
  `ss2TauntValue` is three terms: the recovery (certain, capped at missing
  health, the largest of them), the direction-20 strike, and one turn of the
  target's `max_damage` when the taunt can force a FLEE. `ss2SwingValues` lifts
  the AI's expected-damage table out of `chooseAiAction` so the approach arm
  reads the same numbers the swing arm does. **The attack rows are untouched**,
  because for a swing the other two terms are zero — so the 560-combination band
  sweep still holds and a wounded warrior in melee reach still swings.
  ► **`aiTaunts` SHIPS ON, AND NAMES ITSELF IN THE ID ONLY WHEN OFF**
    (`-no-taunt`). That is the opposite spelling from `aiCharges` and the reason
    is stated at the parameter: charging LOSES on the arithmetic and has to be
    asked for; taunting at range replaces a walk that is worth nothing.
  ► **NO PINNED HASH MOVES, AND THAT WAS CHECKED RATHER THAN HOPED.**
    `grep -n 'suggestAction\|chooseAiAction' test/seeded-play-pins.test.js`
    returns nothing — the seeded pins drive explicit actions and every golden
    replays stated ones. **The AI policy is not hashed anywhere here**, which is
    why four previous AI changes shipped without an id change.
  ► **NEW POLICY AGAINST OLD: 288-112, 72.0%, 8.8σ, sides alternating — and it
    wins on BOTH arms** (73.5% as red, 68.5% as blue).

► **AND THE VERB WAS FAILING IN TWO PLACES, NOT ONE.** The published diagnosis —
  *"`taunt` is absent from the preference table ENTIRELY"* — is true and is
  about a quarter of it. 25 seeded 3v3 bouts on the arena's own path: taunt
  legal on **914 of 2,064 decisions, and on 664 of them (72.6%) no attack was
  legal at all**, so `chooseAiAction`'s `!attackOnOffer` branch returned a walk
  before any table was built. **The taunt is a LONG-RANGE verb** — the build
  wires it on `longrange_warrior` and `longrange_archer` and on neither
  close-range warrior frame — and the only other answer this AI had at range was
  "take a step". **It was not ranked last; it was never ranked.**

► **THE DEMO ROSTER GAINS A DUELLIST**, because a correct policy with nobody to
  express it is the `aiCharges` failure again. Before: taunt offered 926 times
  over 25 bouts, **taken 5**. Slot 3 carries `charisma: 16` now, chosen against
  a sweep printed at the line; charisma is grepped to drive the taunt and
  nothing else, so no reach, scale or clamp moves. About five taunts a bout, 61
  of 69 that slot's, 7% longer bouts, 25/25 still settling.

## TWO PUBLISHED CLAIMS THAT DO NOT SURVIVE THEIR OWN CONTROLS

► **"TAUNT WHENEVER LEGAL BEATS THE SHIPPED AI, 257 OF 400, ~4σ" IS THE BLUE
  ARM OF A TWO-ARM EXPERIMENT.** Re-derived over the same 400 seeds:

```text
    taunting policy on   wins    share     control: AI vs AI is 200-200
      blue                257    64.3%      <- the published number, exactly
      red                 189    47.6%         the same policy, LOSING
      alternating         226    56.6%      2.65σ, not 4
```

  **The gap between the two arms is four times the effect.** The effect is real
  and is worth about 2.6σ alternating. **An A/B with one arm is an A**, and this
  session's own head-to-head is reported on both arms for that reason.

► **"WITH LANES ENFORCED NOBODY CAN GANG UP" IS BACKWARDS.** Ranked item 2
  called the team layout blocking on that ground and offered one lane as the
  remedy. Turns where a gladiator is inside 2+ enemies' MELEE reach, **with
  `ss2SameLane` applied exactly as the offer applies it**, 24 seeded 3v3 bouts:

```text
    rankStride 97 (shipped)    59 of 1,983 turns   3.0%   in 14 of 24 bouts
    rankStride 0  (one lane)    0 of 2,851 turns   0.0%   in  0 of 24 bouts
```

  **One lane is the arrangement in which ganging up is impossible**, for a
  reason the census already recorded: a walk may never cross a foe, so two
  allies approaching one target queue on the same side. **The remedy proposed is
  the disease described**, so the fork is CLOSED rather than answered: keep the
  lanes.
  ► **AND MY FIRST VERSION OF THIS MEASUREMENT SAID 69.4%**, because it used
    Euclidean reach without the lane gate — the layer below the one the question
    is about. That is the error the same handoff's own hard rules name twice,
    committed while reading them.

## Things I got wrong, recorded because the next reader will not

► **I AMORTISED THE APPROACH OVER THE WALKS IT TAKES** — `best / (walks + 1)` —
  and built a taunt-bot: 81.6% of offers taken, bouts 84% longer. A gladiator
  one step from reach scores the approach at half a swing, takes a taunt that
  beats half a swing, and takes it again forever. **The discount assumed the
  arrival it was preventing.** Fixing it with a horizon works and was rejected:
  the horizon is an invented number the outcome is extremely sensitive to.
► **I FORGOT THAT EFFECT 1 ROLLS THE CHANCE A SECOND TIME.** It sets
  `direction = 20` and calls `checkattackroll()`, which `directionProfile` hands
  `chance: chances.taunt` again — so the strike arm is QUADRATIC in the chance
  and a single discount overstated it 2.5x at 40%. **Caught by checking the
  model against a bout rather than against itself**: 3,069 taunts gave 599
  effect-1 events whose mean damage no single 40% roll explains.
► **I PRICED A SHOVE LIKE A FLEE** and made an archer taunt a foe it could
  shoot. Caught by `test/ss2-ranged.test.js`'s snipe/bombard crossover — a pin
  written about something else. **A shove denies a turn of WALKING; a flee
  denies a turn of FIGHTING.**
► **AND I BLEW A LENGTH CAP NOBODY NAMES.** Adding one clause to
  `provenance.note` took it to 536 against `MAX_NOTE_LENGTH` 512 and turned
  **24 campaign tests red** with a message naming neither the cap nor the
  length. Documented at the note now, with the one-liner that counts it.

## Highest-value work, ranked

1. **HOW WILLING SHOULD A GLADIATOR BE TO LEAVE ITS OWN DUEL AND JOIN ANOTHER?
   This is the owner's dial and it is what ranked item 2 SHOULD have asked.**
   The layout is settled — keep the lanes, they are the only thing that makes a
   2-on-1 possible — but a 2-on-1 happens on 3.0% of turns and the AI changes
   rank on about 1% of its offers (`rank-front` 15 of 1,695, `rank-back` 13 of
   1,182). The rank arm fires only when its OWN rank is empty of foes, which was
   a measured fix for a pile-up and is now the binding constraint. Loosening it
   needs a rule for when joining beats holding, and that is game feel: one
   number with a stated default, exactly as `rankStride` is.
2. **THE SHELL IS 4,110 LINES AND NOT ONE IS EXECUTED BY A TEST.** Unchanged
   from the previous handoff and still ranked here: it cannot be imported
   (absolute specifiers, `document`, `Audio` at module scope) — **that is the
   thing to fix**, not the tests. Three of the 2026-09-18 session's four defects
   lived there.
3. **RE-DERIVE THE PIXEL NUMBERS.** Everything published was measured through a
   300×150 backing store. Unchanged, untouched this session.
4. **RUN THE NONCE RECOVERY.** `tools/recover-launch-nonces.mjs` cuts the
   blanket waiver from 58 to 18 and re-promotes 20 of 23 goldens on strictly
   better evidence. Needs no Ruffle and writes nothing. **Cheapest item on this
   list and it has now been ranked and skipped twice.**
5. **`captures/ARCHIVE-MANIFEST.sha256` ATTESTS 19% OF THE ARCHIVE.**
6. **BUILD `shove`.** A real SS2 player verb, fully derived in the bytes, wired
   to `optionC` on two controller frames, with no representation at all.
7. **THE OTHER THREE NON-DAMAGE VERBS, and each still has its own cause**, all
   re-confirmed this session and none of them the ranking's fault: `psyche-up`
   is offered only to the two BOW slots (warriors gate at `herolevel >= 7`,
   archers at `>= 3`, demo is level 4) and is never chosen because `aiCharges`
   is off; `snipe` loses to `bombard` on every offer against defence 5, which
   `test/ss2-ranged.test.js` proves is the policy working; `rest` fires only
   below 10 stamina. **A roster whose gladiators reach level 7 would light the
   first of those with no code change at all.**

## Hard rules

- **AN A/B WITH ONE ARM IS AN A.** The 257-of-400 claim was measured once, on
  one side, with no control, and read as 4σ. Run both arms and the control, and
  report all three. This session's own headline is reported on both arms.
- **MEASURE AT THE LAYER THE QUESTION IS ABOUT.** "Nobody can gang up" came out
  69.4% with Euclidean reach and 3.0% with the lane gate the offer actually
  applies. Same bout, same code, twenty-three times apart.
- **CHECK A MODEL AGAINST A BOUT, NOT AGAINST ITSELF.** The missing second roll
  was invisible in the arithmetic and obvious the moment 599 measured events
  were held against it.
- **A GUARD WEAKER THAN THE CHECK IT STANDS IN FRONT OF IS NOT A GUARD** — and
  when the case it closes turns out to be unreachable, say so at the guard
  rather than letting the next reader call it load-bearing.
- **THE OWNER WATCHING THE SCREEN IS AN INSTRUMENT.** Carried forward; nothing
  this session tested it, because nothing this session was watched.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES RUFFLE OR A BROWSER, OR TOUCHES THE INSTALLATION.**
- **Ship no SS2 asset.**
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
