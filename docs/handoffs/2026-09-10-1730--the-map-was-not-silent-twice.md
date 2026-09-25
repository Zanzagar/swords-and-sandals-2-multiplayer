---
handoff:      2026-09-10-1730--the-map-was-not-silent-twice
written:      2026-09-10 17:30 -0400
sessionId:    661a9a6f-f8a7-4caf-a0da-fa969d652c9b (https://claude.ai/code/session_01118J7jHAdhHHtF5h6b1rg1)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit** — this file cannot state it correctly:
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
suite:        876 / 875 / 0 / 1 (fresh-clone profile), measured after the last
              code commit and BEFORE this handoff. **Re-measure; never copy.**
supersedes:   2026-09-10-1323--the-arena-is-drawn. Its ranked item 2 is
              UNBLOCKED, SPECIFIED and NOT LANDED — and one sentence in it is
              false; see the living head, which is where it is corrected.
---
# Handoff — the map was not silent, twice

## The one-sentence version

Ranked item 2 was blocked by a **false claim that the map is silent**, the
second such claim found in two days; it is corrected, the one gap that IS real
is now recorded where a gap belongs, and a complete position implementation was
built and driven in a scratch copy — **which is how we learned it must not land
resolver-first.**

## READ THIS FIRST: the blocker was a sentence, not a missing measurement

`src/team/ss2-rules.js` said the controller-frame gate could not be added
because `_root.arena.fightdistance` has *"no writer at all"* recorded. The
corpus names the writer twice, with offsets:

```
docs/integration/ss2-champion-dna.md:710-712
  getfightdistance (sprite 2249 frame 1 DoAction@0x6e421b +0x02ff, +0x0427)
  makes fightdistance the rounded x-separation of the two clips, 500 at construction
docs/ss2-adapter-contract.md:1232   the same function, by a different citation
```

**`git blame` removes the "we did not know yet" reading.** The claim is
`831bcdc`, 2026-09-01. champion-dna recorded the writer in `5d3d777` on
2026-08-30 — two days earlier. It was not a stale note; it was a sentence
written without opening the neighbouring document.

The claim is true of `ss2-battle-map.md` alone, and **the justification is a
non-sequitur even there**: a reimplementation never calls the build's writer,
it needs positions. Every other input is derivable and is now cited at the
sentence — `physical_size` `+0x30f1`, `weapon_range = physical_size + weapon[5]
* 44` `+0x3190`, the selector `+0x00f6`/`+0x015f`.

**This is the second instance in two days.** The first (`hurtLabel`) had three
artefacts agreeing with each other and none with the map. Declaring the map
silent remains the cheapest way here to turn a measurement into a guess.

## The gap that IS real, and what settles it

`MAP_SILENCE.movement-displacement` — six entries to seven, the day after seven
went to six. **The symmetry is the argument for pinning the id LIST and not the
count:** one entry left because the map turned out to speak, one arrived
because a gap nobody had written down turned out to be real.

The map gives all eight movement phases' stamina cost with offsets and no
phase's DISTANCE. The entry is deliberately careful about a figure the repo
DOES hold — **"one walk is 44 px"**, uncited, one occurrence repo-wide, in a
frozen handoff — because overstating a silence is the same error as declaring
one falsely. A verifier called it a probable conflation with the range
multiplier `44`. It survives a check from the other direction: at 44px with
both gladiators closing, four walks each leaves the champion staging at
`fightdistance` 148 against `weapon_range` 144 (out) and five leaves 60 (in),
reproducing the archive's own five-walk statistic to within four pixels.
**Recorded as a CONSISTENCY CHECK and never a measurement.**

**It needs no new capture to settle** — count `phase_action` walk entries
before the first attack in a staged session, the same evidence shape already
surveyed archive-wide for the status phases. It needs the capture machine,
because a fresh-clone tree has no archive.

## The result that decides the ORDER of the ranked work

A whole position implementation was built and driven **in a scratch copy, never
in this tree**: `x` on the projection, vanilla start geometry, `walk-left`/
`walk-right` with the map's own costs, the controller gate, an AI that closes.

**It works.** ±250 → five walks a side → ±30 → combat. In range it offers three
melee verbs and *only the retreat walk*, which is the map's `closerange_warrior`
row reproduced. **All 23 goldens stay green**, because a `fixtureReplay` rule
set models no position and keeps the position-blind vocabulary.

**And it must not land in that order.** With the gate live the suite goes from
876 to **72 failures and two files that hang** — and the hang is the finding:

> A walk emits `clip-goto` **`Standing`** — the idle clip — plus a spurious
> `unmapped`, because `SS2_STATIC_MAP_BINDINGS` has no movement case and falls
> through to the attack branch.

**That is the identical defect the owner found by watching the arena this
morning**, reappearing the instant a new self-targeted action existed. The
headless sweep guard written that day is what caught it — a defect a person had
to see in the morning was caught by a test in the afternoon, which is the
whole argument for having computed it.

## Highest-value work, ranked

1. **PRESENTATION FIRST: give movement a command kind, a binding and a
   timeline.** This is now the prerequisite, not a follow-up.
   - a NEW command kind. **Reusing `place-clip` is a defect, not a style
     choice**: `src/render/scene.js` overwrites all seven geometry fields, so a
     partial command leaves `y`/`facing`/`xscale` undefined — `toY(undefined)`
     is NaN and the figure vanishes, and the villain un-mirrors.
   - a movement case in `SS2_STATIC_MAP_BINDINGS` at
     `LabelProvenance.ASSUMED` — export 1241 records movement only as the
     unnamed frame range "movement and charge (33-104)", the same evidentiary
     position as the death variants.
   - a timeline entry: `timelineFor()` returns `unknown` for all eight
     movement labels today.
   - watch `tools/arena/main.js`'s `playing` Map — it is keyed by combatantId
     alone, so a move clip alongside the same action's `clip-goto` overwrites
     one entry and can reopen the gate early. *(Agent claim, NOT re-derived
     here.)*
2. **THEN the resolver half.** It is specified; see the living head. Protocol
   change, `/codex:adversarial-review` case. Budget the 10 literal hash pins
   and ~72 test updates, and treat rewriting a test to pass as the hazard.
3. **The 12:12 brief's ranked list is still untouched** — `settlement.arm()` is
   still its item 1 and still a protocol change.
4. **CAPTURE BREADTH** — 37 of 60 candidates with no golden. Owner's lane. It
   now also carries the walk-count measurement above, which is cheap.

## What is NOT verified

- **31 of the wave's claims were never verified** — the budget is 6 and it
  emitted 37. A capped wave is complete-as-run, never complete-as-asked. The
  unverified ones are in the run journal; treat them as claims.
- Two agent claims I did NOT re-derive: the `playing` Map collision above, and
  that the two `getfightdistance` citations disagree because one is the
  `DefineFunction2` header and the other a body offset. **Nobody has re-read
  those bytes.**
- The 44px figure. See above — a consistency check, not a measurement.

## Hard rules (unchanged)

- **Derive candidates from the map, never from a capture.**
- **An agent FINDS; the main session RE-DERIVES.** Every finding here was
  re-measured before it was believed, and doing so corrected two of them.
- **A wave's brief is a snapshot** — and this session's brief carried a false
  sentence inherited from a frozen handoff into six agents. Check the ground
  brief against the code, not against the handoff.
- **Say what a wave will spawn BEFORE launching it.**
- **Ask before every push.** `main` stays denied outright.
- **A handoff commit is not finished until `node --test --test-concurrency=1`
  is green, and its suite and push lines must be measured AFTER that commit.**
