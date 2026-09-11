# Half of all build matchups do not end without the crowd

**Measured 2026-09-11.** Reproduce with `node tools/crowd-patience-sweep.mjs`
(under ten minutes; exits 1 on the finding).

> ► **THIS DOCUMENT WAS REWRITTEN THE SAME DAY IT WAS WRITTEN, and the first
> version's error is the more useful half.** It invented five "archetypes" and
> never checked them against the build's own stat budget. Every one declared
> `herolevel: 3` — a budget of 25 — while spending 40 to 53 points, and every
> one set `magicka: 0`, below the floor of 1 that `heroDNA` seeds and that has
> no refund path. **The gladiators it measured cannot exist**, and it put a
> four-way design fork to the owner on their behalf.
> `tools/stat-vector-reachability.mjs` had implemented that budget for days.
> Everything below runs on gladiators the game can actually produce.

## What was asked, and which parts are measurable

The owner asked whether these are decisions to make or facts to infer. They
separate cleanly, and two of the three are inferable:

| question | settled by |
| --- | --- |
| Which gladiators can exist | **The build.** Eight stats, none below 1, summing to `13 + 4L` |
| What a gladiator may be holding | **The build.** The shop gate, `3 * band_position`, byte-verified |
| Whether reachable builds can finish a fight | **Simulation** over that space |
| Whether there should be a crowd toll at all | **Nothing.** Vanilla has no bout-level pressure mechanic |

Only the last is design, and it is the only one this document leaves open.

## The measurement

Mirror and cross pairings between reachable builds, with the crowd toll **out
of reach** (`createSs2TeamRules({ crowdPatience: Infinity })` — the only other
way to disable it is `fixtureReplay: true`, which also turns off position and
the swing cost and would measure a different engine).

| loadout | level | mirror stalls | cross stalls | longest self-terminating |
| --- | ---: | ---: | ---: | ---: |
| weapon 0 (starting) | 1 | 14/18 78% | 34/54 **63%** | 27 turns |
| weapon 0 (starting) | 6 | 14/18 78% | 34/54 **63%** | 45 turns |
| weapon 0 (starting) | 15 | 14/18 78% | 34/54 **63%** | 50 turns |
| best it can buy | 1 | 12/18 67% | 28/54 **52%** | 60 turns |
| best it can buy | 6 | 12/18 67% | 28/54 **52%** | 37 turns |
| best it can buy | 15 | 12/18 67% | 28/54 **52%** | 38 turns |

**Cross pairings are the ones that matter** — two players bring different
gladiators. Mirrors are the worst case by construction and bound the problem
rather than describing play.

**The loadout is not a free parameter, and the engine is what said so.** The
first attempt gave every build weapon 24 and `assertSs2WeaponPurchasable` threw:
the shop gates it at `strength >= 12` and a defence-dumping gladiator has
strength 1. So a build that spends its points away from the gate attribute
**cannot buy the weapon that would let it kill anything**, and "best it can
buy" above is each build's own ceiling, not a choice made here.

## Why they stall: attacking heals the attacker

Every completed phase heals its ACTOR `1 + ceil(stamina / 2)` (`nextphase`
`+0x3305`, the build's own), and `src/team/ss2-rules.js:2530` shows the attack
branch is a completed phase like any other. Damage is
`round(strength * 2) + weapon_min_damage`, so a build that spends its points
anywhere but strength deals single digits — while healing, and while being
missed most of the time by an opponent who did the same.

**It is a D1-class fixpoint reached by FIGHTING.** D1 (2026-09-10) was two
combatants who DECLINE to fight; these never stop. Probed to 30,000 actions:
28,932 `normal_attack`s over 15,001 turns, both fighters finishing at 349/350
and 350/350.

It is the same shape as D1 and D2, with the same explanation — vanilla never
hands a player a free allocation, so the corner is approached from far away if
at all — **but unlike D1 and D2 this one is reachable by ordinary progression.**
A level-1 player who puts their points into vitality has made a legitimate
choice and cannot finish a fight.

## What this means for `patience`

`patience: 200` clears every self-terminating bout measured here with 70%
headroom, so **the earlier claim that it no longer clears the tail was an
artifact of the impossible archetypes and is withdrawn.**

The real finding is different and larger: **the crowd toll is not a backstop.
It is what makes roughly half of all reachable matchups terminate at all.** It
was specified as a rare safety net, and it is load-bearing infrastructure.

## The options, costed

1. **Leave it, and re-document.** `patience: 200` works. The change is to the
   comments, which promise a mechanic that is "invisible in honest play" while
   it is in fact deciding half of all bouts. Cheapest; changes nothing a player
   experiences.
2. **Make the toll respond to PROGRESS rather than turn count** — ramp when no
   health has changed hands for N turns. Matches the stated intent, and
   `SS2_CROWD`'s docstring records why it was not done: the rule set cannot see
   the event log, so it needs new state, and new state on the combatant is new
   hashed projection. Costs a protocol change.
3. **Price the per-phase heal.** The cause rather than the symptom, and it
   would close D1 and this together. Biggest blast radius: it touches every
   action's arithmetic and moves every seeded pin. It is the build's own
   number, so this is a deliberate divergence of the same kind the swing cost
   already is.
4. **Let damage scale off something other than strength alone**, so a
   non-strength build is weak rather than incapable. The largest design change
   and the furthest from the build.

**Recommendation: 1 now, 3 deliberately.** 1 is honest and free — the mechanic
works, and only its description is wrong. 3 is the real fix and deserves its own
session with the goldens re-verified, not a change made in passing.

## What is NOT claimed

- **Nothing here is SS2 behaviour.** `SS2_CROWD` is authored in full; the build
  has no bout-level pressure mechanic (`MAP_SILENCE.crowd-impatience`).
- **The builds are CORNERS** — all surplus points in one stat — plus an even
  spread. They are reachable and legitimate, but a player making balanced
  choices lands between them, so the stall rates bound the problem rather than
  predicting a median player's experience.
- **Gold is not modelled.** The shop gate is a stat gate and that is what is
  applied; "best it can buy" ignores whether the gladiator could afford it.
- **A capped bout is evidence of non-termination, not proof.** `--cap` bounds
  the search; the 30,000-action probe pushes one case much further.
- **The 2026-09-10 baseline is not comparable** — that sweep recorded its
  results and never its parameters, which is why `tools/crowd-patience-sweep.mjs`
  now exists.
