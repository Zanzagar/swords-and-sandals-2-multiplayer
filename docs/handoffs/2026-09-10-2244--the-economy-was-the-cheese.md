---
handoff:      2026-09-10-2244--the-economy-was-the-cheese
written:      2026-09-10 22:44 -0400
sessionId:    661a9a6f-f8a7-4caf-a0da-fa969d652c9b (https://claude.ai/code/session_01118J7jHAdhHHtF5h6b1rg1)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
suite:        882 / 881 / 0 / 1 (fresh-clone profile), measured after the last
              code commit and BEFORE this handoff. **Re-measure; never copy.**
supersedes:   2026-09-10-1730--the-map-was-not-silent-twice, written mid-session
              by this same session. Its ranked list is OVERTAKEN: it ranked the
              3v3 positional layer, and the answer turned out to be that 3v3
              was not where the cheese lived.
---
# Handoff — the economy was the cheese

## The one-sentence version

Asked to design 3v3 so it could not be cheesed, a 13-agent panel produced four
designs and **all four were broken** — by two properties of the shipped 1v1
engine that 3v3 merely multiplies. Both are now closed, both by owner decision,
and the 3v3 positional layer is deliberately NOT built on top of them yet.

## The two defects, both measured in shipped code

Written up in `docs/combat-economy-findings-2026-09-10.md`.

**D1 — a bout need not terminate.** 4,000 consecutive mutual `rest` actions
left `battle.result === null`. `rest` is stamina-positive AND heals, so two
combatants who decline to fight are a fixpoint both sides strictly improve in.
Three of the four panel designs built a positional layer on top of this without
noticing.

**D2 — strength was a trap; stamina was the only stat.** Strength 7 beat
strength 30 over 39 actions **without losing a point of stamina or health**.
`power_attack` cost `round(strength * 3)` against a regen of
`1 + round(stamina / 3)`, so an attack was free for ever below a threshold, and
once a weapon was equipped strength bought 2-15% of the damage and 100% of the
cost.

Neither is a fidelity problem. **Vanilla never hands a player a free stat
allocation** — stats are earned against `13 + 4 * herolevel` and weapons bought
as it grows — so the corner is approached from far away if at all. This engine
lets a blueprint declare anything, which is correct for a multiplayer
foundation and is exactly what exposes it.

## What closed them

**D1: the crowd runs out of patience** (`SS2_CROWD`, `f8f7719`). Past
`patience` turns every actor takes escalating damage on its own turn. Standoff
now ends at turn 234; **0 of 120 seeded honest bouts pay anything**. A pure
function of `turnNumber`, which `combatStateHash` already covers, so no
projected field.

**D2: strength now BUYS cheaper swings** (`SS2_SWING`, `849831f`). The shop's
measured purchase gate plus a swing priced on the weapon's `attack_speed` with
strength in the denominator. Band factors 3/2/1 stay the build's.

**Both are gated behind `fixtureReplay`, and that seam is the load-bearing
part**: a fixture keeps the build's own arithmetic, so all 23 goldens still
reproduce their MEASURED `staminaleft`. Repricing that path would not have been
a balance change but a corpus break.

## READ THIS FIRST IF YOU TOUCH THE SWING COST

**`ss2WeaponMass()` rests on an inference that could be exactly backwards.**
`attack_speed` is the weapon table's `[2]` column — an INDEX into
`weaponweights`, a six-entry array whose location is known (`+0x3dd4`,
`ss2-item-tables.md:345`) and **whose values this repository does not hold.**
Nothing says whether index 1 is the heavy end or the light one. It is read as
HEAVY from the damage correlation across the whole table (index 1 spans 80-676
max damage, index 5 spans 3-36). **If that is backwards, every swing cost in
the engine is backwards.** `MAP_SILENCE.swing-cost` carries it.

## Highest-value work, ranked

1. **OWNER, AND IT IS THE CHEAPEST OPEN QUESTION ON THE BOARD: read the six
   `weaponweights` values at `+0x3dd4` off the installed build.** It decides
   whether the swing-cost direction is right or inverted, and it needs **no
   capture, no staging, no Ruffle** — only the licensed SWF, which is why it is
   yours and not a session's.
   `tools/item-table-transcription.mjs` already reads the ninety weapon
   literals out of the same `root/frame:35` action block and finds them BY
   SHAPE rather than by address, so extending it is the natural route.
   **It was deliberately NOT extended blind this session**: a parser nobody has
   run, producing a confident wrong answer, is the exact failure mode this
   session spent the day catching in others.
   *If index 1 is heavy*, `ss2WeaponMass` is right and becomes derived rather
   than authored. *If index 1 is light*, flip it, re-run the scale search in
   `SS2_SWING`, and re-derive the three seeded-play pins.
2. **CLOSE THE AGILITY ALPHA-STRIKE (D3) — it is the largest LIVE cheese
   vector and it is not the owner's lane.** Measured and unchanged:
   `FAST -> FAST -> FAST -> SLOW -> SLOW -> SLOW`, so a team that out-runs the
   enemy acts three times before the enemy acts at all. `initiativeOrder` is a
   flat agility sort across BOTH teams, it is AUTHORED, and `roster.js`'s own
   comment concedes SS2 alternates instead — so alternating sides is both the
   fix and a move toward the build. Protocol change: `initiative` is projected,
   hashed, and persisted into sealed campaign records.
   **It was found on 2026-09-10 and written down nowhere until that session's
   last hour**, which is how it survived a whole session that was explicitly
   hunting cheese vectors.

3. **PRESENTATION BEFORE POSITION, unchanged and still the order.** A walk
   emits `clip-goto Standing` — the idle clip — because
   `SS2_STATIC_MAP_BINDINGS` has no movement case. Movement needs its own
   command kind (reusing `place-clip` is a defect: `scene.js` overwrites all
   seven geometry fields, so a partial command makes `toY(undefined)` NaN and
   the figure vanish), a bindings case at `ASSUMED` provenance, and a timeline
   entry. See the living head.
4. **THEN the 3v3 positional layer** — and re-run the panel, because the four
   designs it produced were all argued against the broken economy. The merged
   design is in the run journal of `wf_69080348-f15`; treat it as claims.
   **Do not carry its recommendation forward**: its judge asserted the shop
   gate "restores the trade", and re-derivation here showed it does not.
5. **Re-run the `SS2_CROWD` and `SS2_SWING` searches whenever the economy
   moves.** Both numbers are downstream of distributions that D2 just changed.
   The `patience` comment carries the method and the trap.
6. **CAPTURE BREADTH** — 37 of 60 candidates with no golden. Owner's lane.

## What is NOT verified

- **31 claims from the first wave and the whole merged 3v3 design are
  unverified.** Capped budgets; complete-as-run, never complete-as-asked.
- **The `weaponweights` direction** — above.
- **`SS2_CROWD.patience` and `SS2_SWING.scale` are authored**, tuned by search
  against measured distributions. Neither may be cited as SS2 behaviour.
- **The 3v3 positional design is specified and unbuilt.** Nothing about it is
  tested, because nothing about it shipped.
- **D3 (the alpha-strike) and the D1 residual are OPEN**, both measured, both
  in `docs/combat-economy-findings-2026-09-10.md`. The D3 rule-set seam claim
  — that an optional `initiativeOrder` hook needs no contract bump — came from
  a design agent and was NOT re-derived; check it before relying on it.

## Two mistakes this session made, both recorded where they happened

1. **I put a fork to the owner on a false premise.** The D1 question described
   `crowd_interest` and the `taunttimer` watchdog as vanilla's answer to a
   stalled fight. `crowd_interest` is a gold multiplier read once on the
   victory frame; the watchdog abandons a stuck ANIMATION. The owner chose on
   that, and it was corrected before anything was built.
   `MAP_SILENCE.crowd-impatience` says so.
2. **I tuned `patience` twice against a distribution the toll itself shaped.**
   At 40, 85 of 120 bouts paid. Raising it revealed a longer tail each time,
   which reads exactly like converging and is not. The honest baseline is
   measured with the toll DISABLED. **Measure the thing you are changing
   without the change in place.**

## Hard rules (unchanged)

- **Derive candidates from the map, never from a capture.**
- **An agent FINDS; the main session RE-DERIVES** — which this session did to
  every panel claim it acted on, and two did not survive it.
- **A wave's brief is a snapshot.**
- **Say what a wave will spawn BEFORE launching it.**
- **Ask before every push.** `main` stays denied outright.
- **A handoff commit is not finished until `node --test --test-concurrency=1`
  is green, and its suite and push lines must be measured AFTER that commit.**
