---
handoff:      2026-09-16-0130--psyche-up-was-never-the-owners
written:      2026-09-16 01:30 -0400
sessionId:    79ae298f-54e8-4964-9c3b-65d33f2bb1b0
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      `0ed660d..HEAD` — `0e1ff27` (the two live defects), `083f54c` (the
              brief and the living head), plus this line's own.
              **Re-measure; never copy.**
suite:        **Re-measure BY EXIT CODE after your own commit.** 1912 / fail 0 /
              skipped 1 here. `fail == 0` and the exit code are the gate.
agentRuns:    ONE wave — 5 questions, 5 write-nothing verifiers. **10 started,
              10 returned, 0 dead.** Verdicts: 5 PARTIALLY-BROKEN, 0 CONFIRMED,
              0 BROKEN. **Six premises broke, four of them mine**, and every
              verifier found something its investigator had overstated.
next:         **`docs/handoffs/PSYCHE-UP-BRIEF.md`. It is ranked first and it is
              NOT the owner's.** Items 1 and 2 of the 21:30 ranked list remain
              the owner's and are untouched.
---
# Handoff — `psyche_up` was never the owner's

## The one-sentence version

Three handoffs carried `psyche_up` as an owner decision about "what those spells
ARE"; **it is a vanilla SS2 action with 31 map mentions and a decoded discharge
chain**, and the wave that established that also found two live defects and
broke four of my own claims on the way.

## WHAT IS DONE

► **THE DERIVATION IS WRITTEN AND CHECKED: `docs/handoffs/PSYCHE-UP-BRIEF.md`.**
  Specification, six named holes in the map, the cadence candidate, the blast
  radius of a new resource, the state of the art, and one structural warning
  that the ranged analogy fails. **Read it before writing a line, and treat
  every fact in it as a hypothesis anyway.**

► **`attackLabel` NO LONGER INVENTS `attack30`.** Every grievous blow bound its
  actor to a clip that has never existed; the fighter carries
  `attack1`..`attack12`, and `animationFor` answers a missing label by falling
  back rather than complaining. **Same defect as the `direction === 23` branch
  directly above it, one number later** — it survived that fix because the suite
  pinned 23 and not the CLASS, so the guard is the RANGE now. Two tests,
  mutation-checked, with the twelve real directions pinned so the guard cannot
  eat the ordinary case.

► **`ss2-rules.js`'s DEFERRAL PARAGRAPH WAS WRONG ABOUT THREE OF ITS FOUR
  ENTRIES FOR TWO DAYS.** It deferred the ranged trio, which shipped on
  2026-09-13. Corrected at the paragraph, including the half of `psyche_up`'s
  reason that is stale (the position model landed 2026-09-11; only the counter
  is missing).

## WHAT I GOT WRONG, IN THE ORDER I SAID IT

► **I told the owner the battle map "specifies `psyche_up` completely" and
  quoted `round(strength)` as its DAMAGE. It is the STAMINA COST.** The row sits
  in the staminacost-by-phase table beside `power_attack -> round(strength*3)`
  and `rest -> 0 - round(stamina * 15)`; **a table whose `rest` row is negative
  can only be a cost table.** Damage is `ceil(max_damage * 1.5)` in the
  attack-roll dispatcher. Three agents broke it independently.

► **AND THE AGENT THAT CORRECTED ME OVERSHOT, AND ITS VERIFIER CAUGHT THAT
  TOO.** It concluded "the map does not specify psyche_up well enough to
  implement"; the verifier found the damage fallback IS expanded in the
  byte-derived module the goldens replay against. **Two grep hits measuring
  whether a phrase appears once cannot separate "underspecified in a way that
  blocks implementation" from "underspecified in a way nothing can observe".**

► **FIVE VERDICTS, ALL PARTIALLY-BROKEN, NONE CONFIRMED.** That is the highest
  break rate this project has recorded, and it happened on a brief whose facts I
  had just read out of the map myself.

## Known, measured, unsettled

► **THE CADENCE CANDIDATE CANNOT BE SETTLED BY THE COMMITTED WRAPPER, AND A
  COMMITTED DOCUMENT SAYS IT CAN.** `ss2-capture-staging.md` says "two
  consecutive presses recorded live decide it". The wrapper's recording window is
  exactly `checkattackroll`'s duration — `beginAction()` on entry,
  `finishTrace()` on return — and **both counter writes happen after that
  return**. A wrapper change comes before any capture, and that is save-mutating
  and the owner's. *(Left in that document rather than edited: it is capture
  infrastructure, and a wrong fix there is worse than a flagged one.)*

## Highest-value work, ranked

1. **BUILD `psyche_up` FROM ITS BRIEF.** Not the owner's, fully derived, a
   session's work (the ranged precedent was 2,252 insertions over 10 files).
2. **RE-SHOOT THE PROBES UNDER ADOBE'S PLAYER — the owner's, untouched.**
3. **DECIDE WHICH RASTERISER THIS PROJECT MEASURES IN** (21:30's item 3): every
   committed number is `cpu`, a player runs neither, and the gap is 15.9%.
4. **`tools/shot.sh` LEAKS A CHROME PROCESS PER INVOCATION** — the two-line
   `finally` is obvious, but retiring the tool may be the better answer.
5. **THE `psyche_up` CAPTURE WRAPPER WINDOW**, above — only after 1 lands.

## Hard rules

- **A COST TABLE AND A DAMAGE TABLE LOOK IDENTICAL AT A GLANCE.** Read the
  section heading, and read the neighbouring rows: one of them will be negative,
  or scaled by 3, and that tells you which table you are in.
- **PINNING THE INSTANCE IS NOT PINNING THE CLASS.** `attack30` survived the fix
  for `attack23` because the test named 23.
- **A DOCUMENT CAN PRESCRIBE A CAPTURE THE WRAPPER CANNOT TAKE.** Check the
  recording window against the offsets before believing "a capture settles it".
- **AN AGENT THAT CORRECTS YOU CAN OVERSHOOT.** Run the verifier anyway; here it
  caught the correction, not the error.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES CHROME OR RUFFLE, OR REGENERATES `assets/`.**
- **Ship no SS2 asset.**
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
