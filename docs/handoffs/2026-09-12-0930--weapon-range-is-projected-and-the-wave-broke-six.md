---
handoff:      2026-09-12-0930--weapon-range-is-projected-and-the-wave-broke-six
written:      2026-09-12 09:30 -0400
sessionId:    9e416f58-ab1f-4d6a-a7cd-ab12d4624e75 (https://claude.ai/code/session_01W2dkgJu2uHRFXSmTVv4f2j)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
suite:        919 / 918 / 0 / 1 (fresh-clone profile), measured after `3666c62`
              and BEFORE this handoff. **Re-measure; never copy.**
supersedes:   2026-09-12-0140--the-last-authored-number-is-derived. Its ranked
              item 1 is DONE. Items 2, 3, 4 and 6 are still open and still the
              owner's; item 5 is unblocked; item 7 is untouched.
---
# Handoff — weapon_range is projected, and twelve verifiers broke six things

## The one-sentence version

Ranked item 1 is closed — `weapon_range` is a projected resource and the build's
own overlap clamp is back — because `ss2Reach` had been returning
**`physical_size`, which is the reach of no gladiator the build can make**, on
the strength of a docstring that cited half of a wrapped line; and then a
12-agent wave broke six things in that fix, **the worst of them mine: I wrote
the sub-100 nudge backwards in five places.**

## The reusable lesson, which outranks every finding below

**Some facts are not IN the bytes you are reading; they are in the bytes that
give those bytes their meaning.**

The nudge is `if (fightdistance < 100) { if (hero.gladiator_dir == "left")
{ hero._x += 1; villain._x -= 1 } else { ... } }`. I read it correctly,
transcribed it correctly, cited it correctly — and got the conclusion exactly
backwards, because `hero._x += 1` is toward or away depending entirely on what
`gladiator_dir` MEANS. The rival convention ("the side I stand on") fits the
same opcodes and yields the opposite answer. What settles it is a DIFFERENT
statement 3.5 KB away: `if (hero._x < villain._x) hero.gladiator_dir = "right"`
(`+0x28f3` -> `+0x290e`). Hero on the left is spelt "right", so the word is
FACING, so both arms of the nudge move the pair APART.

This is the fifth failure in this repository of the same family and the first
with a new shape. The other four were *"you stopped reading too early"* — the
neighbouring line, the next sentence, the second line of a wrapped expression.
This one is *"you read the whole statement and it still does not mean anything
on its own."* No amount of careful reading of the nudge would have caught it.

So the rule that goes with it, now in the tool that enforces it: **a check that
confirms a PATTERN cannot catch a wrong INTERPRETATION. Derive the conclusion
and print it.** `tools/walk-displacement-derivation.mjs` no longer compares the
`±1` sites against an expectation; it reads the nudge AND the turnaround and
reports `SEPARATES` or `CLOSES` as a derived conclusion, and pushes a problem if
that conclusion disagrees with what `src/` says. Verified to fail: adopting the
rival convention reports CLOSES, 1 problem, exit 1.

## What landed

**`6926069` — the projection and the clamp.** `ss2Reach` reads a declared
`weapon_range` and falls back to the build's own bare-hands row (id 0, `[5]` =
1); `ss2PhysicalSize` is its own function; `weapon_range` and
`secondary_weapon_range` are derived by `ss2BattleValues` from the weapon id and
the bow override (`+0x343e`) is carried, closing the last of the three
`weapon_range` omissions the living head listed; `ss2WalkDestination` clamps on
the DEFENDER's `physical_size` (`+0x3de6` / `+0x3c07`) and the `foe.x` narrowing
is deleted. `SS2_RESOURCE_NAMES` 32 -> 33, deliberately.

Measured on the suite's own `bout()` fixture, 8 seeds a side, **all three rows
re-taken here rather than carried from the docstring that claimed them**:

```text
                        settled   walks/actions   turns an attack was on offer
  ss2Reach both ways  1v1  8/8    3416/3496 97.7%            0
                      2v2  8/8    6792/7000 97.0%            0
                      3v3  0/8    9264/9600 96.5%            0
  foe.x narrowing     1v1  8/8      32/168  19.0%          136
                      2v2  8/8      80/325  24.6%          245
                      3v3  8/8     128/477  26.8%          349
  build's own pair    1v1  8/8      32/168  19.0%          136
  (shipped)           2v2  8/8      80/325  24.6%          245
                      3v3  8/8     128/477  26.8%          349
```

The third block is byte-identical to the second and is FAITHFUL, which is the
whole argument. Wider: strengths 1/9/40/70, multipliers 1/2/3, speed 40 —
**8/8 settle in all 24 configurations**, and the weapon now MATTERS (a mult-3
weapon walks 8.1% of a 3v3 where bare hands walk 26.8%).

**Two fixtures stated `weapon_range: 1`**, the `[5]` column pasted into the
field it multiplies into. Inert while the field was ignored; the moment it was
read, no attack was ever on offer in the browser arena again.

**`3666c62` — what the wave broke.** 12 agents, 6 questions + 6 write-nothing
verifiers, 0 dead, 5 HOLDS and 1 PARTIALLY-BROKEN. The commit message carries
all six at the sentences that were wrong.

## THE SIX, and five of them are mine

1. **The nudge SEPARATES** — see above. Five sites corrected, and the
   justification it supported **withdrawn twice over**: the second break is that
   the guard is `fightdistance < 100` while the parked-with-gate-shut case needs
   a separation of at least `80 + 44 = 124`, so the nudge cannot fire there
   whichever way it pushes. **The build has no escape from that case; it simply
   has the case.**
2. **`physical_size` is NOT "the reach of nothing"** — it is a live reach gate,
   just not `weapon_range`. The frame-4 selector is TWO gates and the bow arm
   (`+0x0141`/`+0x0158`/`+0x015f`) is `fightdistance < 100 + hero.physical_size`,
   never reading `weapon_range` at all.
3. **A THIRD reach gate exists and this repository did not hold it.**
   `sprite:862/frame:52/DoAction@0x23f835` `+0x0356`..`+0x03d5` is the VILLAIN's
   own AI gate: `(equipped_weapon == 1 && fightdistance < villain.weapon_range)
   || (equipped_weapon == 2 && fightdistance < 200)`. **The two sides do not
   share a gate in vanilla**, and the archer arm is a hand-written 200. Recorded
   at `legalActions` as a stated narrowing.
4. **`[5]` runs 1, 2, 3, 4 and 100** — 16/33/20/3/18 ids. The build's reach scale
   is 44 to 4,400, and my sweeps covered 1/2/3 only: **21 of 90 rows, 23%, have
   never been in a modelled bout.**
5. **The archive claim is mostly withdrawn.** 3,004 resolve, not the 3,091 I
   wrote (an arithmetic slip reading my own tally); 432 are ambiguous and
   **every one spans the range column** (a `[5]`=1 row and a `[5]`=100 row both
   fit), so for 14% the inversion cannot tell `+44` from `+4400`; and **"not one
   implies a `weapon_range` below `physical_size + 44`" is unfalsifiable by
   construction** — min `[5]` over every row is 1, so any resolution to any row
   implies it. My defence ("a different column from the two it inverts") does
   not work, because the proposition quantifies over every row. What survives:
   the hero resolves UNIQUELY to weapon 0 in all 1,500 of its records, so its
   reach is 131 and not 87 — a fact about the DAMAGE columns, the range
   following through the table rather than through the archive.
6. **I made the exact reporting error my own docstring convicts an earlier
   session of.** `tools/arena/roster.js` said the paste meant "no bout in the
   arena ever settled". Re-measured through the real host, driving `options[0]`:

   ```text
     weapon_range: 1   24/24 settle, 20,424 actions,   0 attacks
     absent (now)      24/24 settle,  2,764 actions, 637 attacks
   ```

   Every bout settled either way; the crowd kills them. The diagnostic is **0
   attacks and seven times the actions**. `ss2WalkDestination`'s docstring
   already says "'settle' only because the crowd kills them ... missed by
   reporting only what the assertion checked" — and I quoted it in the same
   commit where I did it again.

   Two smaller ones beside it: "ANY constant here is wrong for two of the three
   slots" — wrong, 129 is wrong for exactly one; and the `weapon: 1` that roster
   states **reaches nothing**, because `demoSide` builds with `derive: false`.
   Which makes `6926069`'s pin bullet false as stated: the new resource reaches
   the `derive: true` path only.

## What held

The central correction and everything load-bearing under it: the `weapon_range`
formula and the absence of an unarmed branch; the clamp on the DEFENDER's
`physical_size`, its `gladiator_dir` `&&`, and its once-only init block; the
strict `<`; the bow override's extent and polarity; the archive counts as
re-taken; and the two riskiest process claims — **no golden moved** (confirmed
independently by hashing all 23 rebuilt projections on both trees, with a
mutation showing the instrument can fail) and **exactly one seeded pin moved**
(six-actions-in `49866259` -> `01621469`, because a gladiator stepping back 44
units no longer drops the other out of range).

## Highest-value work, ranked

1. **The browser arena's SPECTATE mode never reaches a swing, and nobody has
   watched it.** `tools/arena/main.js:572` drives `options[turnNumber %
   options.length]`; out of range that list is `[walk-left, walk-right, rest]`,
   so the cycle is net-zero displacement forever. Measured: 24/24 bouts, 20,712
   actions, **0 attacks**, identical before and after this session's work — so
   it is NOT caused by it and has presumably been true since position landed.
   **This is the cheapest real defect on the board and it is a session's, not
   the owner's.** The fix is a drive policy that closes; the QUESTION for the
   owner is whether spectate should pick for itself at all.
2. **OWNER: `/codex:adversarial-review` on `3a8638b`, `567eb41`, `bdc157b`,
   `6926069`, `3666c62`.** Still unspent, still unrunnable by a session
   (`disable-model-invocation: true`), and the case is now much stronger: a
   projection change landed on top of an `x` nobody has reviewed, and a
   12-agent wave found six things in it that a diff review might have found for
   a fraction of the cost.
3. **OWNER: the crowd fork** — four costed options in
   `docs/crowd-patience-findings-2026-09-11.md`. Unchanged, and ranked item 1
   above is a second reason to care: the crowd is what ends a bout in which
   nobody can swing, which is exactly how a real defect stayed invisible.
4. **OWNER: the 3v3 pacing call**, still 26.8%.
5. **The 3v3 positional layer** — unblocked.
6. **CAPTURE BREADTH** — 37 of 60 candidates with no golden; needs Ruffle.
7. **The 21 untouched weapon rows.** `[5]` of 4 and 100 have never been in a
   modelled bout. A bow's `physical_size + 4400` exceeds the arena's own clamp
   width, so a ranged gladiator is in range everywhere — worth knowing before
   anyone models a bow.
8. **A verifier on the jump's total** — `(2L + 1)` applications is still ONE
   agent's reading with nothing aimed at it.

## What is NOT verified

- **31 claims this wave raised were never verified**, the verifier cap being 6.
  The wave is complete-as-run, not complete-as-asked.
- **The "45 or 43" frame counts** in `ss2WalkDisplacement`'s precondition
  paragraph. The SIGN is now determined (a toward-walk realises the shorter
  figure, because the nudge separates), but the 7-frames/10-frames figures came
  in with the paragraph and are still not re-derived.
- **The `+1` at six `(movement_speed, boot)` pairs** — bytecode plus IEEE-754,
  never measured in Ruffle.
- **The jump's total displacement** — a lead, ranked 8.
- **`SS2_MOVEMENT_STEP_FACTOR.run` and `.charge`** are read nowhere in `src/`.
- **`SS2_SWING.scale`, `strengthOffset` and `SS2_ARENA.allyStride`** are still
  authored, as is the multi-foe reading of the overlap clamp.
- **The villain's own AI gate is READ but not MODELLED**, and the archer gates
  (`100 + physical_size`, and the literal 200) are modelled by nothing at all.

## Hard rules (unchanged, and one added)

- **Derive candidates from the map, never from a capture** — and when the map is
  silent, read the BUILD before reaching for a capture.
- **NEW: a check that confirms a PATTERN cannot catch a wrong INTERPRETATION.**
  Derive the conclusion and print it. See the lesson at the top and
  `tools/walk-displacement-derivation.mjs`'s nudge section.
- **An agent FINDS; the main session RE-DERIVES.** Six findings, six
  re-derivations, and one of the agents' numbers (the roster's "two of three
  slots") was itself wrong in my favour and was still corrected against me.
- **A wave's brief is a snapshot** — commit before launching, and note that this
  wave's first launch spawned ZERO agents because the workflow takes structured
  args, not prose. `started == briefs` caught it immediately.
- **Push a feature branch without asking** (rule 7 as written); `main`/`master`
  and every force flag stay DENIED.
- **A handoff commit is not finished until `node --test --test-concurrency=1` is
  green, and its suite and push lines must be measured AFTER that commit.**
