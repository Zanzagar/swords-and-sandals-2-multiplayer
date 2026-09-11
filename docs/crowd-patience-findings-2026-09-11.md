# The crowd's patience no longer clears the tail, and one reason is new

**Measured 2026-09-11, after movement landed in `567eb41`.** Reproduce with
`node tools/crowd-patience-sweep.mjs --seeds 30 --cap 3000`, which exits 1 on
the finding below.

## The instruction that came due, and why it could not be followed

`SS2_CROWD.patience` carries **"re-run it whenever the combat economy moves"**.
The economy has moved twice since the value was set — the swing cost in
`849831f`, and movement in `567eb41`, which adds an approach to every bout.

**The instruction was unrunnable.** The sweep behind the 2026-09-10 baseline —
*"min 21, median 50, p95 102, max 135"* — recorded its RESULTS in two source
comments and its PARAMETERS nowhere: no stat block, no seed count, no team
sizes. "Re-run it" therefore meant "invent a new sweep and hope it measures the
same thing", which is not a re-run and cannot be compared against the old
numbers. `tools/crowd-patience-sweep.mjs` now exists so the next one is a
re-run; **the 2026-09-10 figures are not comparable to anything below**, and
nothing here should be read as "the tail moved from 135 to N".

A second thing had to be built before the measurement was possible at all:
`createSs2TeamRules({ crowdPatience })`. The only previous way to disable the
toll was `fixtureReplay: true`, which also turns off position and the swing
cost — so it measures a different engine and reports it as this one. The
methodology error that cost the first two values (40, then 120) was tuning
against a distribution the toll itself had shaped, and that trap is still open
as long as turning the toll off means changing three things.

## FINDING 1 — `patience: 200` does not clear the self-terminating tail

The longest bout that ENDS ON ITS OWN, with the toll out of reach, is **684
turns** (`tank` 1v1, 30/30 seeds settled). Against `patience: 200` that build
is killed by the crowd in every bout it would otherwise have won or lost by
itself.

| archetype | 1v1 max | 2v2 max | 3v3 max | class |
| --- | ---: | ---: | ---: | --- |
| baseline | 16 | 20 | 25 | self-terminating |
| glass | 7 | 9 | 11 | self-terminating |
| tank | **684** | 530 | 602 | self-terminating |
| stamina-hoarder | — | 434 | 478 | 1v1 crowd-dependent |
| attrition | — | — | — | crowd-dependent |

The crowd was specified as a backstop that is **invisible in honest play**. At
200 it is not: it is the routine cause of death for defensive builds.

## FINDING 2 — a D1-class fixpoint reached by FIGHTING, not by resting

**This one is new and is the more interesting half.** D1 (2026-09-10) was about
two combatants who DECLINE to fight: 4,000 mutual `rest` actions leaving
`result === null`, because rest is stamina-positive and heals.

Two `attrition` gladiators — defence 16 against attack 2 — do the opposite and
reach the same place. Probed to **30,000 actions and 15,001 turns** with the
toll out of reach: 28,932 `normal-attack`s, 1,058 rests, and both fighters
finishing at **349/350 and 350/350 health**.

The mechanism is the build's own arithmetic, at `src/team/ss2-rules.js:2530`:
every completed phase heals its ACTOR `1 + ceil(stamina / 2)` (`nextphase`
`+0x3305`), and the attack branch is a completed phase like any other. **So
attacking heals the attacker.** At stamina 10 that is 6 health per swing, and
behind defence 16 the damage getting through is smaller than that. Two such
fighters climb rather than converge.

It is the same SHAPE as D1 and D2, and the same explanation applies: vanilla
never hands a player a free stat allocation, so the corner is approached from
far away if at all, while this engine lets a blueprint declare anything —
correct for a multiplayer foundation, and exactly what exposes it.

**Four of fifteen cells are crowd-dependent**: `attrition` at every size, and
`stamina-hoarder` at 1v1. For those the crowd is not a backstop, it is the
termination mechanism, and `patience` is choosing their bout length rather than
catching their tail.

## Why no single `patience` does both jobs

- To stay invisible to honest defensive builds it must clear **684** turns, so
  roughly 800 with headroom.
- At 800 a crowd-dependent bout runs 800 turns of grace plus ~26 more to kill
  through 350 health — **well over 1,600 actions before anybody dies.**

Those are the same dial. Raising it to protect the tank makes the attrition
bout unplayable; lowering it to end the attrition bout kills the tank. **A
turn-count ramp cannot separate "a long fight" from "a fight going nowhere",
because it cannot see whether anything is happening.**

## The options, costed

1. **Raise `patience` to ~800.** One constant. Honest builds never meet the
   crowd; crowd-dependent bouts become 1,600-action marathons. Cheapest, and it
   optimises for fidelity over playability.
2. **Leave it at 200 and accept the crowd as a combat mechanic.** Also one
   constant — the change is to the DOCUMENTATION, which currently promises
   invisibility it does not deliver. Bouts stay short; defensive builds are
   systematically punished by something that is not an opponent.
3. **Make the toll respond to PROGRESS rather than to turn count** — start the
   ramp when no health has changed hands for N turns. This is the one that
   matches the intent, and `SS2_CROWD`'s own docstring records why it was not
   done: the rule set cannot see the event log (`actorView` hands it
   `turnNumber`, `actor`, `allies`, `foes` and nothing else), so it needs new
   state, and new state on the combatant is new hashed projection. Costs a
   protocol change and a field every peer must agree on.
4. **Treat the per-phase heal as the defect and price it**, rather than capping
   its consequences. It is the build's own number, so this is a deliberate
   divergence of the same kind the swing cost already is — and it would close
   D1 and this finding together rather than backstopping both. Biggest blast
   radius: it touches every action's arithmetic and moves every seeded pin.

**Recommendation: 3 or 4, and 4 is the one that fixes a cause rather than a
symptom.** 1 and 2 both amount to choosing which group of players the mechanic
is unfair to. But all four are design decisions with real trade-offs, and none
of them is a measurement — this document deliberately stops at the fork.

## What is NOT claimed here

- **Nothing above is SS2 behaviour.** `SS2_CROWD` is authored in full; the
  build has no bout-level pressure mechanic at all
  (`MAP_SILENCE.crowd-impatience`).
- **The archetypes are invented.** They span what changes bout length; they are
  not measured characters and no capture endorses them.
- **A capped bout is evidence of non-termination, not proof.** `--cap` bounds
  the search; the 30,000-action probe pushes one cell much further and finds
  the same thing.
- **The 2026-09-10 baseline is not comparable**, for the reason in the first
  section. Nothing here says the tail grew.
