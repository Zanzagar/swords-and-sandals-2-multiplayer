---
handoff:      2026-09-11-2340--two-owner-items-were-a-session-away
written:      2026-09-11 23:40 -0400
sessionId:    1a8d94aa-4015-4d92-a894-357a1ad7fdae (https://claude.ai/code/session_01EcvzwQKheXCySdMC3qY8iH)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
suite:        911 / 910 / 0 / 1 (fresh-clone profile), measured after `4acf2c9`
              and BEFORE this handoff. **Re-measure; never copy.**
supersedes:   2026-09-11-2115--both-halves-of-position-are-built, written
              MID-session by this same session. Its ranked items 1 and 5 are
              DONE; its item 2 (codex review) and the pacing question are
              still the owner's.
---
# Handoff — two "owner's lane" items were a session away

## The one-sentence version

Position shipped both halves, then two items ranked as the OWNER's turned out
to be readable from this machine — and doing them found that the repository had
held one answer for twelve days and had built a design fork on gladiators that
cannot exist.

## The reusable lesson, which outranks any of the findings

**A session can read the installed SWF and the capture archive. Both were being
treated as out of reach and neither is.**

- The build is at the path `tools/item-table-transcription.mjs` already
  defaults to. Reading it needs no Ruffle, no staging, no capture window, and
  the install stays byte-identical — `AGENTS.md` reserves only *launching
  Ruffle* and *touching the install/save/snapshots* to the supervised session.
- The populated archive is a SECOND CHECKOUT at `/mnt/c/ss2-capture/captures`,
  1,650 rufflelogs. `MAP_SILENCE.movement-displacement` said its measurement
  needed "the capture machine, not the capture rig" — this IS the capture
  machine.

**Check reachability before ranking something as the owner's.** Two ranked
owner items closed in one stretch on that basis.

## What landed

**`ac8c7f4` — the `weaponweights` direction.** Index 1 IS the heavy end, so
`ss2WeaponMass` is right and the swing cost is NOT backwards. Beside the
answer: `weaponweights` holds STRINGS, so `attack_speed` is a weight-CLASS
index and never a numeric speed; and the index runs 1..5, not the 1..6 the
comment claimed.
**The repository already held the answer.** `ss2-item-tables.md` has said
"Weight index 1 is the heaviest" since 2026-08-30 — two lines under the offset
that `MAP_SILENCE.swing-cost` cites for the array's LOCATION while declaring
its values unheld. **Third instance of one failure: declaring the map silent
without reading the surrounding paragraph.**

**`0dd1811` — the approach, measured.** `tools/approach-length-census.mjs`
counts movement phases before the controller flips to `closerange_warrior`,
which IS `fightdistance < weapon_range` first holding. **n = 1,512: median 5,
mode 5, 82% between 4 and 7.** NOT a displacement — both gladiators close and
these are the hero's steps — so `SS2_ARENA.walkDistance` stays AUTHORED. What
it does is put the five-walk figure on something measured instead of one
uncited line.

**`8dbbd55` then `4acf2c9` — the crowd, measured wrong and then right.**
See the retraction below.

## THE MISTAKE THIS SESSION MADE THAT MATTERS MOST

**I put a four-way design fork to the owner on gladiators that cannot exist.**
The first crowd sweep invented five archetypes and checked them against
nothing: each declared `herolevel: 3` — a budget of 25 — while spending 40 to
53 points, and each set `magicka: 0`, below the floor of 1 that `heroDNA` seeds
and that has no refund path. `tools/stat-vector-reachability.mjs` had
implemented `13 + 4L` for days.

**Withdrawn:** "the longest self-terminating bout is 684 turns, so patience 200
no longer clears the tail." Re-measured over reachable builds, **200 clears
every self-terminating bout with 70% headroom.**

**The owner caught it by asking whether these were decisions or facts.** Two of
the three things I had called design were measurable, and I had measured
neither.

## What survived, and it is larger than what was withdrawn

**`SS2_CROWD` is not a backstop. It is what makes roughly half of all reachable
matchups terminate at all** — 52-63% of CROSS pairings never end without it,
between builds a player can hold, carrying weapons the MEASURED shop gate
permits.

The mechanism is D1's, reached from the opposite direction: every completed
phase heals its ACTOR `1 + ceil(stamina / 2)` and the attack branch is a
completed phase (`ss2-rules.js:2530`), so attacking heals the attacker — while
a build that spent its points anywhere but strength deals single digits.
**Unlike D1 and D2 this corner is reachable by ordinary progression:** a level-1
player who puts their points into vitality has made a legitimate choice and
cannot finish a fight.

The engine caught one error itself: giving every build weapon 24 made
`assertSs2WeaponPurchasable` throw, because the shop gates it at
`strength >= 12`. **The loadout is not a free parameter** — a build that dumps
strength cannot buy the weapon that would let it kill anything.

## Highest-value work, ranked

1. **OWNER: the crowd fork.** Four costed options in
   `docs/crowd-patience-findings-2026-09-11.md`. Recommended: re-document now
   (the mechanic works; only its description is wrong), then **price the
   per-phase heal deliberately in its own session** — that closes D1 and this
   together, and it moves every seeded pin, so it is not a change to make in
   passing.
2. **OWNER: `/codex:adversarial-review` on `3a8638b`, `567eb41`, `ac8c7f4`.**
   Still unspent and still unrunnable by a session (`disable-model-invocation:
   true`). The position work is a protocol change and four mutations survived
   first drafts across this session's commits.
3. **OWNER: the 3v3 pacing call** — 53% of a 3v3 is walking. It interacts with
   item 1; both are bout-length dials. The levers are `SS2_ARENA.frontX` and
   `walkDistance`, and `weapon_range` is NOT one.
4. **The 3v3 positional layer** — unblocked now both halves of position are
   built. Re-run the panel; its four designs were argued against an economy
   that has since changed twice.
5. **Close the second end of the displacement interval.** The archive gives the
   HERO's phase sequence; the VILLAIN's would bound the per-phase distance and
   turn `walkDistance` from authored into derived. Named at
   `MAP_SILENCE.movement-displacement`.
6. **CAPTURE BREADTH** — 37 of 60 candidates with no golden. Genuinely the
   owner's: it needs Ruffle.

## What is NOT verified

- **`SS2_ARENA.walkDistance` is still AUTHORED** and now sets the pace of every
  bout. The census corroborates five walks; it derives no distance.
- **The crowd sweep's builds are CORNERS** plus an even spread — reachable and
  legitimate, but a balanced player lands between them, so the stall rates
  bound the problem rather than predicting a median experience.
- **Gold is not modelled** in "best it can buy"; the shop gate is a stat gate
  and that is what is applied.
- **`SS2_SWING.scale` and `strengthOffset` are still authored.** Only the
  weight DIRECTION became derived.
- **Everything the 21:15 handoff lists as unverified still is.**

## Hard rules (unchanged)

- **Derive candidates from the map, never from a capture.**
- **An agent FINDS; the main session RE-DERIVES** — and re-derive your OWN
  inputs too, which is what this session failed to do.
- **A wave's brief is a snapshot.**
- **Ask before every push.** `main` stays denied outright.
- **A handoff commit is not finished until `node --test --test-concurrency=1`
  is green, and its suite and push lines must be measured AFTER that commit.**
