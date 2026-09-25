---
handoff:      2026-09-12-0140--the-last-authored-number-is-derived
written:      2026-09-12 01:40 -0400
sessionId:    7acfa329-ce8d-4dcb-b7ff-f5924d1652cb (https://claude.ai/code/session_0125H1Z6A2FamLtZqiiw1AZE)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
suite:        913 / 912 / 0 / 1 (fresh-clone profile), measured after `6bb790e`
              and BEFORE this handoff. **Re-measure; never copy.**
supersedes:   2026-09-11-2340--two-owner-items-were-a-session-away. Its ranked
              item 5 is DONE — by a route it did not name — and HALF of its
              ranked item 3 turns out to have been a wrong number rather than a
              decision. Items 1, 2, 4 and 6 are still open and still the
              owner's.
---
# Handoff — the last authored number that set bout pace is derived

## The one-sentence version

The walk displacement was in the build the whole time — `movement_speed * 16`
eased to a stop — so the nine-day-old `MAP_SILENCE.movement-displacement` is
removed, the authored 44 turns out to be **exactly right at the `movement_speed`
clamp floor and wrong by a factor of four above it**, and a six-verifier wave
then broke four things in the first version of that derivation.

## The reusable lesson, which outranks every finding below

**`MAP_SILENCE` is a catalogue of gaps in a TRANSCRIPTION. A gap in it says
nothing whatever about the build, and three sessions in a row read one as if it
did.**

The entry was accurate: `ss2-battle-map.md` gives all eight movement phases'
stamina COST with byte offsets and no phase's DISTANCE. Its `settledBy` then sent
the next reader to the capture archive — *"NO NEW CAPTURE … this needs the
capture machine"* — and every framing after that pointed the same way: first a
capture, then an archive census, then "the real gap is the hero's
`weapon_range`". **The answer was two instructions below the cost the entry was
quoting.**

So the rule that replaces it, now in the catalogue's own header: **an entry whose
`settledBy` reaches for a capture must say why the BYTES cannot answer it first.**
Three of the nine entries have now been wrong in three different ways —
`ranged-hurt-label-adjustment` because the map spoke one sentence later,
`swing-cost` because the answer was two lines under the offset it cited, and this
one because the map's silence was mistaken for the build's.

## What landed

**`bdc157b` — the derivation.** `ss2WalkDisplacement(movementSpeed, {boot})` and
`ss2WalkDestination`. `SS2_ARENA.walkDistance` is renamed
`walkDistanceAtSpeedFloor` so every reader of the old name fails loudly instead
of quietly reading one case of a law. The build, at block
`sprite:862/frame:52/DoAction@0x240c7f` (data base `0x240c85`):

```text
attacker_x_walk = movement_speed * 16                          +0x3d78
walk_bonus      = get_percentage(100 + boot * 2, 100)          +0x3d82
attacker_x_walk = add_percentage(attacker_x_walk, walk_bonus)  +0x3db0
destination     = _x + attacker_x_walk                         +0x3dd0
_x += ceil((destination - _x) / 8)      every frame             +0x3e54
phase ends when the remaining gap is 20 or less                +0x3e97
```

At the clamp floor of 4 with no boots: `64 → 56 → 49 → 42 → 36 → 31 → 27 → 23 →
20`, realising **44**. The uncited *"one walk is 44 px"* was right; the
adversarial reader who called it a conflation with `weapon_range`'s 44 was wrong.
**It is the floor case.** `movement_speed` 12 walks 172; 60 walks 940.

**Two tools, and both of them caught something.**
`tools/walk-displacement-derivation.mjs` re-reads all eight phases from the
installed SWF by shape — and on its first run reported charge as
`movement_speed * 2`, which is the charge's COST, not its destination. A hand
transcription would have read past it. `tools/approach-length-census.mjs` is
rewritten as the runtime side, and **the version committed yesterday had a real
defect**: it never segmented by bout, so its published *"n = 1512, median 5, mode
5, min 2, max 17"* counted autopilot presses from before the battle was armed.

**`6bb790e` — what six write-nothing verifiers broke.** 12 agents, 6 questions +
6 verifiers, 0 dead, 4 HOLDS and 2 PARTIALLY-BROKEN. Details below; the commit
message carries all of it at the sentences that were wrong.

## THE FINDING THAT IS NOT MINE: `440dae9` IS RETRACTED IN FULL

**`phase_action` records the HERO ONLY.** The previous session concluded that it
"fires for BOTH sides" and that 66 unpaired `rest` records in `arena-champ-1` were
"the villain's, provably, because the autopilot never rests". Both counts
reproduce. The inference is a false dichotomy that leaves out the game's own
forced phase: overlay frame 1 calls `getphase("rest")` under
`if (!(hero.staminaleft > 0))` (`+0x0d2e`), **and the wrapper's own comment at
`ss2-capture-wrapper.as:1582-1586` already said so.**

Measured in that file: all 39 resolvable rests sit at hero `staminaleft == 0`,
all 67 resolvable non-rests at `>= 9`, and label shuffles reproduce that
separation in 0 of 20,000 trials. Archive-wide the unpaired labels are precisely
frame 1's forced vocabulary (rest +1387, poisoned +33, frozen +21, burning +19,
life_stolen +6) while the autopilot's own labels run NEGATIVE.

**And this repository already said so, 2,600 lines down the living head, since
`d39fb8b` on 2026-09-01.** So `440dae9` did not fill a gap — it CONTRADICTED the
living head, and the contradiction stood for a day with both halves above
`## THE ARCHIVE LINE`. **A living head long enough to disagree with itself needs
a second reader, not more care from the first.**

## What the wave broke in MY work, and one of them was behaviour

1. **The arithmetic was the right algebra and the wrong function.** The build's
   `get_percentage` round-trips `(100 + 2*boot)/100*100` — lossy in IEEE-754 —
   and `add_percentage` DIVIDES BEFORE MULTIPLYING (`+0x10c5`). Collapsing both
   differs by +1 at six `(movement_speed, boot)` pairs, three of them reachable
   from a `speed` stat. Fixed to the build's order; the tool now reads the
   helpers' operation order off the opcodes and sweeps all 1,539 pairs.
2. **The tween is a DO/WHILE.** The per-frame update is unconditional and runs
   BEFORE the stop test, so a step inside the tolerance still moves the gladiator
   once. My `while` returned 0 while its own comment called zero *"the build's
   behaviour and not a guard invented here"*. It was the opposite.
3. **The clamp docstring cited a measurement from a different fixture.** The
   "19,764 of 20,000" figure cannot come from the sweep it was attributed to
   (1200-guard × 8 seeds caps a 1v1 at 9,600). Re-taken, and the mechanism was
   wrong too — all six gladiators in that fixture are `strength` 9, so the
   deadlock is EQUALITY, not a stronger foe.
4. **Four smaller ones:** the stop tolerance is PER PHASE (run is 10, not 20);
   a charge GATES its advance rather than clipping its destination; a jump's total
   may be determined after all (recorded as a lead, not a derivation); and the
   census's "drop == walks + 1 in 90.8%" was an artefact of my own segmentation.

**One overstatement withdrawn:** the archive does not corroborate the 44. It
carries no positional field at all, and the one-sided bound gives the same answer
for 44 and 45. It corroborates the FLOOR, via a stamina ledger that never
mentions a displacement.

**One precondition the 44 carries:** `attacker.onEnterFrame` first does
`if (arena.fightdistance < 100) { hero._x ±= 1; villain._x ∓= 1 }`
(`+0x36c1`..`+0x37c8`), so inside 100 units a phase realises 45 or 43. 44 is the
displacement while the gladiators are more than 100 apart — every walk of an
approach from 500, and not every walk in a bout.

## Two owner items moved, and neither is closed

**Ranked item 3 — the 3v3 pacing call — was half a wrong number.** Swept over the
same 8 seeds a side, before and after:

| | flat 44 | derived |
| --- | ---: | ---: |
| 1v1 walks / actions | 37.0% | 19.0% |
| 2v2 | 45.8% | 24.6% |
| 3v3 | 52.2% | 26.8% |
| 3v3 actions before first blow | 35 | 17 |

"53% of a 3v3 is walking" was put to the owner as a pacing decision with
`frontX` and the walk distance as its two levers. **The walk distance was simply
wrong** — `movement_speed` 8 walks 108, not 44 — so gladiators were crossing the
arena at a quarter of the build's own pace. What remains is a real design
question and a much smaller one.

**Ranked item 1 — the crowd fork — now has a second measurement arguing for it.**
`test/ss2-team-rules.test.js` asserted "no honest bout ever reaches patience".
That is no longer true:

```text
flat 44:  36 of 36 settle by ELIMINATION, longest 73 turns, crowd silent.
derived:  36 of 36 still settle, longest 223, and THREE 3v3 bouts (217-223)
          run past patience 200, so the toll is what ends them.
```

**And the old assertion's own remedy is unfollowable.** It said to re-measure with
the toll disabled and raise patience past the tail. Measured with the toll off and
position KEPT (`crowdPatience: 1e9`; `fixtureReplay: true` models no position,
which is how the earlier "all 120 settle without any crowd" baseline was taken),
**2 of those 36 do not terminate at all in 20,000 actions.** There is no tail to
clear. The test now asserts what is true — every bout settles, and the crowd stays
a minority cause — and the per-phase heal is still the thing to price, in its own
session, exactly as the 23:40 brief recommended.

## Highest-value work, ranked

1. **Declare `weapon_range` a projected resource, then restore the build's own
   overlap clamp and delete the narrowing.** Fully specified and MEASURED this
   session: the build clamps on the DEFENDER's `physical_size` and gates on the
   ATTACKER's `weapon_range` (always ≥ 44 larger); this module uses `ss2Reach` for
   both, so the clamp parks a walker exactly ON the gate threshold and a strict
   `<` never opens. Clamping on raw `physical_size` and gating on
   `physical_size + 44` settles 8/8 at every size with identical walk ratios —
   faithful, and it deletes a placeholder. `ss2Reach`'s docstring already named
   this as the opt-in.
2. **OWNER: `/codex:adversarial-review` on `3a8638b`, `567eb41`, `bdc157b`,
   `6bb790e`.** Still unspent, still unrunnable by a session
   (`disable-model-invocation: true`), and the case is stronger than it was: item
   1 above is a second projection change that should not be stacked on an `x`
   nobody has reviewed.
3. **OWNER: the crowd fork**, with this session's measurement attached. Four
   costed options in `docs/crowd-patience-findings-2026-09-11.md`; the
   recommendation is unchanged and better supported.
4. **OWNER: the 3v3 pacing call**, now a smaller question — 26.8%, not 53%.
5. **The 3v3 positional layer** — unblocked, and its economy has changed again.
6. **CAPTURE BREADTH** — 37 of 60 candidates with no golden. Genuinely the
   owner's: it needs Ruffle.
7. **A verifier on the jump's total.** `(2L + 1)` applications with `L` the
   clamped `|leap|` in `[8, 36]` is ONE agent's reading with nothing aimed at it.

## What is NOT verified

- **The `+1` at six `(movement_speed, boot)` pairs is derived from the bytecode
  plus IEEE-754 semantics and was never measured in Ruffle.** It is the build's
  arithmetic as far as a reader of the bytecode can tell, and one step short of a
  measurement.
- **The jump's total displacement** — a lead, see ranked item 7.
- **`SS2_MOVEMENT_STEP_FACTOR.run` and `.charge` are read nowhere in `src/`**, so
  `node --test` does not guard them. The guard is a tool a human runs on the
  capture box, the same standing the weapon table has.
- **`SS2_SWING.scale`, `strengthOffset` and `SS2_ARENA.allyStride` are still
  authored.** So is the multi-foe reading of the overlap clamp.
- **The census's `movement_speed` 4 is a property of ONE save.** All 1,484
  sessions share one stat vector, and `session-20260830-b`'s hero has
  `staminamax` 130.
- **Everything the 23:40 handoff lists as unverified still is**, except its
  displacement item.

## Hard rules (unchanged, and one sharpened)

- **Derive candidates from the map, never from a capture** — and **when the map is
  silent, read the BUILD before reaching for a capture.** That is the sharpening.
- **An agent FINDS; the main session RE-DERIVES.**
- **A wave's brief is a snapshot** — and a brief states where the data is, never
  how to read it. Mine taught six agents a parse that drops 69% of the archive's
  lines. See `docs/overnight-agent-plan.md`, which also now records that the
  scratchpad is SHARED and three agents had files silently clobbered.
- ~~**Ask before every push.**~~ **DROPPED BY THE OWNER at the end of this
  session, 2026-09-12: `Bash(git push *)` is in `permissions.allow` and rule 7
  applies as written — push a feature branch without asking.** `main` and
  `master` stay DENIED outright, as do `--force`, `-f` and `--force-with-lease`;
  deny beats everything. See `.claude/settings.json`'s `_ss2_tightening`, which
  also names the one thing to watch (the two `--delete` forms are still in
  `ask`, and this project has not measured whether a broad allow beats a narrow
  ask in this build).
- **A handoff commit is not finished until `node --test --test-concurrency=1` is
  green, and its suite and push lines must be measured AFTER that commit.**
