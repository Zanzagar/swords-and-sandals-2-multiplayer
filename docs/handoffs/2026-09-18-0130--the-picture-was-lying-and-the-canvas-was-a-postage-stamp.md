---
handoff:      2026-09-18-0130--the-picture-was-lying-and-the-canvas-was-a-postage-stamp
written:      2026-09-18 01:30 -0400
sessionId:    cbee9926-159f-4edb-abcb-8d75f213b5de
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      `d836413..HEAD` — `2b6ae4e` (the facing nobody had), `ca90b94`
              (sound, lanes, the victory loop), `553084d` (the arrow, the
              discharge, the canvas, four retractions), plus this line's own.
              **Re-measure with `git log --oneline`.**
suite:        **Re-measure BY EXIT CODE after your own commit.** `fail == 0` and
              the exit code are the gate. **2035 / fail 0 / skipped 1, exit 0.**
              Against 2014 at the start of this stretch.
agentRuns:    Two waves, both 12 agents, both 12/12 returned and 0 dead.
              `wf_721cdd3a-f17` — 6 questions + 6 adversarial refuters on the
              knockback and the arena clamp; 2 of 6 headline claims refuted.
              `wf_62a282d7-818` — **the functionality audit**: 6 subsystem
              inventories + 6 adversarial checks, ~2.3M subagent tokens, 1,096
              tool calls, 46 minutes, **32 defects, all six headlines
              corrected**. Its full output is at
              `/tmp/claude-1000/.../tasks/wng37hx5l.output` (230 KB) and is the
              single most valuable artefact this session produced.
supersedes:   2026-09-16-2356--the-stance-the-glow-and-an-ai-that-winds-up.md
next:         **RANKED BELOW, and the ranking changed this session.** The audit's
              verdict, reached independently by four of six auditors: **the
              bottleneck is the AI, not the rules.** Nineteen verbs resolve; the
              opponent plays one attack, two walks and a swap.
---

# Handoff — the picture was lying, and the canvas was a postage stamp

## The one-sentence version

Three bugs the owner found by *watching* a bout — none of which any test could
have caught — turned out to sit in the two places this project does not test:
the dev server's MIME table and the 4,110-line browser shell; and a twelve-agent
audit then found 32 more, corrected four numbers this repository publishes, and
concluded that the engine can do far more than the shipped game ever shows.

## WHAT IS DONE

► **THE OWNER'S THREE REPORTS, ALL REAL, ALL FIXED (`ca90b94`, `553084d`).**
  ► **"All effects aren't working."** Every layer under test was correct — the
    sound module returned the right file for the right label, all 80 bindings
    built, every mp3 served 200. `tools/arena-server.mjs` had no `.mp3` entry in
    `CONTENT_TYPES`, so the whole soundtrack arrived as
    `application/octet-stream`, which a browser will sniff for an image and will
    not decode for an `<audio>` element.
  ► **"AI are able to attack each other in different lanes."** Reach was
    Euclidean because `getfightdistance` is. **4,440 of 7,845 melee swings
    across 25 seeded 3v3 bouts — 57% — were cross-rank.** After `ss2SameLane`:
    **0 cross-lane offers in 35,523.**
  ► **"The guy keeps victory emoting."** Frame 1426 loops `celebrate1a`, not the
    run, so vanilla plays the 9-frame flourish once. We looped all 27 and a
    previous session had written that down as an acceptable approximation.

► **AND THE FOURTH REPORT WAS THE BEST ONE: "is AI attacking its own teammate
  with ranged?"** The AI was innocent — 0 ally-targeted in 250 shots — **and 85
  of 120 arrows ended inside a living teammate's body.** Two correct rules
  landing on one number: the walk clamp parks a front-liner at
  `target.x ∓ physical_size` and the arrow's stop-short ends the flight at
  `target.x ∓ physical_size`. **An owner watching the screen outperformed the
  entire suite, twice in one session.**

► **A GLADIATOR WHO HAD NOT MOVED WAS FACING NOBODY (`2b6ae4e`).** The facing
  rule had ONE call site — the movement branches — so an unmoved gladiator
  carried no `facing-left`, and `ss2IsBackAttack` reads a MISSING token as
  "faces right". **40 of 40 opening ranged attacks scored as back attacks at
  +50% damage.** Melee could never show it: at 500 apart nothing melee is in
  reach until somebody walks, and walking fixed the facing on the way past.

► **`damagecharacter`'s KNOCKBACK DISPLACES, after being deferred twice for a
  cost that did not exist.** "It re-datums every pinned hash and every golden
  that carries one" was written in three places and lost its hedge in a `next:`
  field. No golden carries a position and none structurally can; the
  displacement moves zero pins.

► **AND THE CANVAS HAD NEVER BEEN SIZED.** `<canvas id="arena">` with no width
  or height is **300×150**. The shell only ever READ those fields; no resize
  handler, no `devicePixelRatio`, in 4,000 lines. **Every pixel number this
  project has published was taken through an unrecorded bilinear upscale.**

## What the audit found that nobody was looking for

**Read `/tmp/claude-1000/.../tasks/wng37hx5l.output` before doing anything in
these areas.** It is 230 KB and it is worth it. The four that matter most:

1. **THE AI IS THE BOTTLENECK, and this is the audit's headline.** `quick-attack`
   on **100% of 3,498 turns a melee verb was legal**; six legal verbs —
   normal, power, rest, snipe, psyche-up, taunt — chosen **0 times in 6,160
   decisions**. It is also why the arena looks thin: the rig can reach ~62 of
   the fighter clip's 101 animations and **the shipped game draws 19**.
2. **A VERB THE AI NEVER PLAYS BEATS THE AI.** "Taunt whenever legal, otherwise
   play the shipped AI" wins **257 of 400 3v3 bouts** against it, ~4σ.
3. **THE CAMPAIGN LAYER HAS NO HOST.** 3,174 lines, 70 passing tests, **one
   non-test consumer** importing 3 of 60 exports. Nothing a person can run
   persists a campaign anywhere.
4. **THE EVIDENCE PIPELINE IS GENUINELY REAL** — all 23 goldens re-promote
   byte-identically from the 69 committed observations — **and measures exactly
   three mutation paths**, with no new observation since 2 September.

## Things I got wrong, recorded because the next reader will not

► **I TOLD THE OWNER HE MIGHT HAVE MISREAD THE RANGED PICTURE.** I had measured
  the RULES (0 friendly fire, correct) and inferred the report was mistaken. The
  picture really was wrong, every time. **Measuring the layer you can reach is
  not the same as answering the question you were asked.**
► **I PUBLISHED "17 of 42 verbs" AND IT IS THE WRONG DENOMINATOR.** 42 counts
  `staminacost` ASSIGNMENT SITES; those rows carry **48 distinct phase labels**.
  Three auditors flagged it independently.
► **I HAD `rankStride`'s DEFAULT BACKWARDS** while writing a lane rule that only
  bites when it is non-zero. It defaults to 97.
► **AND I RELAYED A FEATURE MEASUREMENT I HAD NOT TAKEN.** The `aiCharges`
  table — "2,433 charges, 30.6%" — came from a harness the repo names as a past
  mistake and is 0 on the path anybody plays.

## Highest-value work, ranked

1. **TEACH THE AI TO PLAY THE GAME IT IS IN — BUT THE MELEE HALF IS A ROSTER
   PROBLEM AND THE OTHER HALF IS NOT. Re-measured 2026-09-18 01:50, after the
   ranked list above was first written, and the distinction is the whole item.**

   ► **DO NOT REWRITE THE BAND RANKING. IT WORKS.** Swept 560 stat combinations
     (strength 1-20 × attack 1-20 × defence 1-19, staged in melee reach): the AI
     chose **quick 400, normal 139, power 21**. It picks all three whenever the
     stats make one of them best. The "100% quick-attack" census is true of the
     SHIPPED ROSTER only — `tools/arena/roster.js`'s demo gladiator has a damage
     pair and to-hit chances that make quick strictly best on every turn. **The
     monoculture is a property of the demo roster, not of the policy**, and an
     agent that starts here will spend a day rewriting a ranking that is right.
     Tune the roster, or accept it and say so.

   ► **WHAT IS GENUINELY MISSING IS THE NON-DAMAGE VERBS, and each has its own
     cause.** `taunt` is absent from the preference table ENTIRELY, and cannot
     simply be added to it: the table ranks expected damage, and a taunt's value
     is the knockback (mean 150 units, landing 18.3% of the time) plus the flee
     it can cause. **Ranking it needs the AI to value something other than
     damage, which is a design decision and not a tuning one** — and it is worth
     making, because "taunt whenever legal, otherwise the shipped AI" wins 257 of
     400 3v3 bouts against the shipped AI, about 4σ. `psyche-up` is gated out by
     `herolevel` (demo is 4, the melee gate is 7), `snipe` loses to `bombard` on
     every offer, and `rest` fires only below 10 stamina.

   **It is still ranked first**, because it is the cheapest lever on the art —
   the rig can reach ~62 of the clip's 101 animations and the shipped game draws
   19 — but the first hour belongs to the roster and the design question, not to
   the ranking.
2. **DECIDE THE TEAM LAYOUT — owner's call, and it is now blocking.** With lanes
   enforced and `startingY` opening ally slot 1 one rank back, a 2v2 is two
   parallel duels and a 3v3 is three. Nobody can gang up. Either allies start in
   one lane and ranks become a tactical move, or the AI learns to change rank to
   join a fight. `tools/hotseat.mjs --flat` gives the one-lane arena to compare.
3. **THE SHELL IS 4,110 LINES AND NOT ONE IS EXECUTED BY A TEST.** Every test
   that mentions it reads it as TEXT and greps it. Three of this session's four
   defects lived there. It cannot be imported (absolute specifiers, `document`,
   `Audio` at module scope) — **that is the thing to fix**, not the tests.
4. **RE-DERIVE THE PIXEL NUMBERS.** Everything published was measured through a
   300×150 backing store. The clip-residual and rasteriser findings may survive
   and may not; nobody knows yet.
5. **RUN THE NONCE RECOVERY.** `tools/recover-launch-nonces.mjs` reports that 40
   of 58 blanket-waived observations have a distinct launch nonce in the archive
   on this machine. Running it cuts the waiver to 18 and re-promotes 20 of 23
   goldens on strictly better evidence. It needs no Ruffle and writes nothing.
6. **`captures/ARCHIVE-MANIFEST.sha256` ATTESTS 19% OF THE ARCHIVE** — 1,588 of
   8,325 files. A copy could drop 81% and verify clean.
7. **BUILD `shove`.** A real SS2 player verb with no representation at all,
   fully derived in the bytes, wired to `optionC` on two controller frames.

## Hard rules

- **THE OWNER WATCHING THE SCREEN IS AN INSTRUMENT, AND THIS SESSION IT BEAT THE
  SUITE FOUR TIMES.** Sound, lanes, the celebration loop and the arrow were all
  found by looking. When a report disagrees with a measurement, **the
  measurement is probably of the wrong layer.**
- **MEASURE THE FEATURE ON THE PATH SOMEBODY PLAYS.** A number taken through a
  harness nobody uses is not a measurement of the feature.
- **A STATED APPROXIMATION IS STILL A WRONG PICTURE.** "We wrote it down" is not
  "it is acceptable" — the celebration loop was documented for two days and was
  reported as a bug the first time anyone watched a bout end.
- **`recognised: true` DOES NOT MEAN ANYTHING CAN DRAW IT.** A family with no
  clip vocabulary falls back to authored art with no error.
- **A RETRACTION IS A NEW CLAIM AND NEEDS ITS OWN EVIDENCE.** Finding the
  literal proves the literal. Check the receiver.
- **DO NOT DEFER WORK FOR A COST YOU HAVE NOT MEASURED.**
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES RUFFLE OR A BROWSER, OR TOUCHES THE INSTALLATION.** An
  auditor this session ran every tool with no arguments and created three files
  under `captures/`; it self-reported and they are cleared. **Tools that treat
  "no arguments" as "do the full job" make a probe destructive.**
- **Ship no SS2 asset.**
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
