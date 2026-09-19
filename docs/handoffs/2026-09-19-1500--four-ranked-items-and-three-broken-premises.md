---
handoff:      2026-09-19-1500--four-ranked-items-and-three-broken-premises
written:      2026-09-19 15:00 -0400
sessionId:    164a0c3b-cf56-4192-b312-5791620299e0
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      `4a444fe..HEAD` — the taunt policy and the roster duellist, the
              layout refutation, the rank-join dial, the owner's decision on it,
              the shell claim, the archive manifest, `shove`, the settlement
              gate, plus this line's own. **Re-measure with `git log --oneline`.**
suite:        **Re-measure BY EXIT CODE after your own commit.** `fail == 0` and
              the exit code are the gate. **2079 / fail 0 / skipped 1, exit 0.**
              Against 2035 at the start.
agentRuns:    **NONE.** No fan-out wave, no subagents. One Codex adversarial
              review (`gpt-6-astra`, model pinned): approve, no material
              findings.
supersedes:   2026-09-19-0400--the-taunt-was-never-ranked.md
next:         **RANKED BELOW. Items 1, 5 and 6 of the 04:00 list are CLOSED,
              item 4 is HALF-CLOSED, and item 2's premise was wrong — I wrote
              it.**
---

# Handoff — four ranked items, and three premises that did not survive

## The one-sentence version

Four ranked items closed and two verbs shipped, but the durable result is that
**three claims this repository had published — one of them mine, eight hours
old — broke the moment anybody measured them**, and all three broke the same
way: a measurement with one arm, taken at the wrong layer, or never taken.

## WHAT IS DONE

► **THE AI TAUNTS AT RANGE (`139b9f8`).** Priced in hitpoints: the recovery, the
  direction-20 strike, and one turn of the target's `max_damage` when it can
  force a flee. Attack rows untouched, so the 560-combination band sweep holds.
  New policy vs old, sides alternating: **288-112, 72.0%, 8.8σ, winning on BOTH
  arms.** The demo roster gained a duellist (`charisma: 16` on slot 3) because
  the verb was offered 926 times and taken 5 before it.

► **THE AI JOINS ITS ALLY'S FIGHT (`799dd11`), owner's decision on a sweep.**
  `SS2_RANK_JOIN_SURPLUS = 0`. Crossings 20.0% → 25.9%, turns with 2+
  simultaneous fights 30 → 196, all 24 bouts still settle. It costs ~2.3σ of win
  rate — the `aiCharges` trade, and irrelevant in PvP where both sides have it.

► **`shove` IS BUILT (`1b82b0e`), AND IT TAKES NO SAMPLE.** Phase derived from
  the oracle (`+0x5dcd`…`+0x6007`) because the map carried two rows and not the
  phase. Zero `randomBetween`, zero `checkattackroll`, zero `hitpoints` — so
  unlike `taunt`, which was deferred a month over exactly that hazard, it
  returns before the band table and shipped in an afternoon.

► **THE ARCHIVE MANIFEST ATTESTS ALL 8,325 FILES (`0900b09`)**, after attesting
  1,588 of them for eighteen days — a copy could have dropped 81% and verified
  clean. Old attestation verified first, new one proved a strict superset
  (`comm -23` returns 0), round-trips clean.

► **TWO SHELL DECISIONS LEFT THE DOM SET** (`5ca04b8`, and the settlement gate):
  `canvasBackingFor` — the arithmetic behind the 300×150 defect — and
  `settlementReadiness`, whose failure mode is a page that never acknowledges.

## THE THREE BROKEN PREMISES, which are the point of this handoff

► **"TAUNT-ALWAYS BEATS THE SHIPPED AI, 257 OF 400, ~4σ" IS ONE ARM OF A
  TWO-ARM EXPERIMENT.** 257 of 400 is exactly the arm where the policy is given
  to BLUE. Give it to RED and it LOSES 189-208. The AI-vs-AI control the claim
  never had is 200-200. Alternating: 226 of 399, 2.65σ. **The gap between arms
  is four times the effect. An A/B with one arm is an A.**

► **"WITH LANES ENFORCED NOBODY CAN GANG UP" IS BACKWARDS.** With the lane gate
  applied as the offer applies it: shipped lanes give a 2-on-1 on 3.0% of turns,
  **one lane on 0 of 2,851.** One lane is the arrangement where ganging up is
  impossible. The remedy ranked item 2 proposed was the disease it described.
  **My first version of this measurement said 69.4%** because it used Euclidean
  reach without the lane gate — the wrong layer, in the session that wrote the
  hard rule about measuring the wrong layer.

► **"THE SHELL IS 4,110 LINES AND NOT ONE IS EXECUTED BY A TEST" IS FALSE, AND I
  PUBLISHED IT EIGHT HOURS EARLIER** by repeating it without grepping the test
  file. **13 of its 70 functions are executed** via `liftFromShell`, and
  `src/render/arena-shell.js` has existed since 2026-09-12 holding eight shell
  decisions. The real gap is the ~27 functions touching `document`, `window`, a
  canvas or `Audio`. `viewport` and `stepCamera` needed nothing at all.

## Things I got wrong, recorded because the next reader will not

► **I AMORTISED THE APPROACH OVER THE WALKS** and built a taunt-bot (81.6% of
  offers, bouts 84% longer). The discount assumed the arrival it was preventing.
► **I FORGOT EFFECT 1 ROLLS THE CHANCE A SECOND TIME**, so the strike arm is
  quadratic in it; a single discount overstated it 2.5×.
► **I PRICED A SHOVE LIKE A FLEE** and made an archer taunt a foe it could
  shoot. A shove denies a turn of WALKING; a flee denies a turn of FIGHTING.
► **I DEFAULTED THE RANK DIAL TO 0 AND WROTE THAT NOTHING MOVED.** Measured:
  2,234 decisions → 2,307. **A default that has to be argued to be a no-op is
  not one.**
► **I SHIPPED AN ID THAT LIED** — `-Infinity` spelled `-join-always` and took
  the OFF path. Found by a mutation that survived.
► **AND TWO TEST STAGINGS WERE WRONG IN WAYS THAT PASSED**: one measured a
  strength-9 opponent while claiming to measure a weak gladiator; one asserted
  an arena clamp without ever reaching the wall, and a mutation deleting the
  clamp survived it.

**Five of those six were caught by a measurement or a mutation, not by review.**

## Highest-value work, ranked

1. **RE-DERIVE THE PIXEL NUMBERS.** Everything published before 2026-09-18 was
   measured through a 300×150 backing store. `canvasBackingFor` is now tested,
   so the instrument is sound; what is missing is the re-measurement. **Needs a
   browser, so it is the owner's or a supervised main-session run** — no agent
   launches one.
2. **KEEP TAKING DECISIONS OUT OF THE ~27 DOM-BOUND SHELL FUNCTIONS.** Two are
   done. `drainFinishedAnimations`, `beginStep` and the sound path
   (`primeSoundCache`, `playFor`, `soundOn`) are the next ones that hold
   numbers. **Do NOT attempt to make `main.js` importable** — that was the wrong
   diagnosis and the file does not need it.
3. **THE NONCE RECOVERY APPLY IS THE OWNER'S.** The report runs, reproduces
   byte-identically, and says: waiver 58 → 18, 20 of 23 goldens re-promoted on
   strictly better evidence. The tool has no `--apply` by design and ingest
   refuses to overwrite committed evidence. **It rewrites 40 observation digests
   — a decision, not a fix.**
4. **RE-TAKE THE `D:` MIRROR.** It holds 1,588 files against an archive of
   8,325 — **19%**. The living head said it held "all" of them, which was true
   when written. Check `D:` from Windows, never from `/mnt/d`.
5. **THE OTHER THREE NON-DAMAGE VERBS**, each with its own cause and none of
   them the ranking's fault: `psyche-up` is offered only to the bow slots
   (`herolevel` 4 against a melee gate of 7), `snipe` loses to `bombard` against
   defence 5, `rest` fires below 10 stamina. **A roster reaching level 7 lights
   the first with no code change.**
6. **`cast_gale` AND `magic_damage_character`** are the two remaining
   `knockback` call sites with no verb here — flat ±1000, no floor, animation
   unconditional.

## Hard rules

- **AN A/B WITH ONE ARM IS AN A.** Run both arms and the control, and report all
  three. Twice this session a headline survived only one arm.
- **MEASURE AT THE LAYER THE QUESTION IS ABOUT.** 69.4% with Euclidean reach,
  3.0% with the lane gate the offer actually applies.
- **A RATE NEEDS ITS SAMPLE SIZE STATED.** The 2-on-1 rate reads 3.1% at 24
  bouts, 3.9% at 100 and 5.3% at 300. Two harnesses that looked contradictory
  agreed exactly at matched size.
- **A DEFAULT THAT HAS TO BE ARGUED TO BE A NO-OP IS NOT ONE.**
- **A TEST THAT STAGES PAST THE ARM IT MEANS TO EXERCISE REPORTS THE WRONG
  FUNCTION GREEN.** Two of mine did; a mutation check is what found both.
- **CHECK A MODEL AGAINST A BOUT, NOT AGAINST ITSELF.**
- **AN ID THAT SAYS THE OPPOSITE OF THE BEHAVIOUR IS WORSE THAN NO ID** — it is
  the one string two peers compare before they trust each other.
- **VERIFY A TOOL IS READ-ONLY BEFORE RUNNING IT** — grep for `writeFile`,
  `mkdir`, `rm`; and a tool that treats "no arguments" as "do the full job"
  makes a probe destructive.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES RUFFLE OR A BROWSER, OR TOUCHES THE INSTALLATION.** The
  oracle is at `…/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf`,
  sha256 `77CB545C…`; the Steam "Redux" build beside it is a DIFFERENT file and
  is not the oracle.
- **Ship no SS2 asset.**
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
