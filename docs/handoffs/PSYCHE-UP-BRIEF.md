# Brief — `psyche_up`, for the next session

► **CLOSED 2026-09-16. `psyche_up` IS BUILT.** Commit `b201486`. The verb
  resolves, `legalActions` offers it on every controller frame, the three clips
  play, and ten of the twelve figure-pack effect groups reach a real gladiator.

  **This file is now HISTORY. Read it to check a claim about how `psyche_up` got
  here; do not read it to learn what `psyche_up` IS.** That lives in the code:
  `Ss2ActionType.PSYCHE_UP`, `SS2_PSYCHE_UP`, `PSYCHE_UP_DISCHARGE`, the
  `psyche` family in `clip-labels.js`, and `test/ss2-psyche-up.test.js`, which
  executes every branch of it.

  **THE FIRST NAMED HOLE WAS NOT A HOLE.** This brief listed the map's
  unexpanded "level-based fallback" first among six things that could change the
  implementation. It is expanded, in `directionProfile`'s `direction === 30`
  arm — `character_level * 10` when `ceil(max_damage * 1.5) <= 1` — in the
  byte-derived module the goldens replay against. **The whole discharge needed
  no arithmetic at all**; what was missing was the action around it.

  **AND THE STRUCTURAL WARNING WAS THE RIGHT ONE.** The verifier that broke the
  "same shape as ranged" framing on `ATTACK_BANDS` membership was correct, and
  it is the decision the build turns on: two of three presses draw nothing, so a
  band entry would have desynchronised every peer from the first charge.

  **Still open and unchanged**: where the counter lands after a discharge. The
  map's static reading (2) ships and is marked; settling it needs two
  consecutive discharges captured under `-TraceWindow phase`, which exists now.

---

**This is not a handoff.** It is a derivation, checked by ten agents (5 questions,
5 write-nothing verifiers, 10 started / 10 returned / 0 dead) on 2026-09-15, of
the last vanilla ACTION that is neither built nor genuinely blocked. Read it
before writing a line, and **treat every numbered fact in it as a hypothesis
anyway** — six premises broke while it was being written, four of them mine.

► **WHY IT IS NOT "THE OWNER'S", WHICH THREE HANDOFFS SAID IT WAS.** They
  recorded that the figure pack's twelve effect groups sit on `psyche_up`,
  `psyche_up2`, `psyche_charging`, `psyche_charging2`, all declared unplayed, and
  concluded that *"making them reachable means deciding what those spells ARE."*
  **`psyche_up` is not a spell to invent.** It is a vanilla SS2 action with a
  `getphase` label, a button on all four controller frames, 31 mentions in the
  battle map and a fully decoded discharge chain. The twelve groups are its ART.
  `AGENTS.md` says new systems are the agent's to build; this one does not even
  need designing.

► **AND IT IS A SESSION'S WORK, MEASURED.** The closest precedent is the ranged
  trio (`7310583`, 2026-09-13): **2,252 insertions across 10 files**, plus a
  correction commit the next day. Do not start it in the last hour of a session.

---

## What is already done (2026-09-15) — do not redo it

- **`attackLabel` no longer invents `attack30`.** Every grievous blow used to
  bind its actor to a clip that has never existed. Fixed with a RANGE guard
  (anything outside `attack1..attack12` that no branch claims returns absent),
  two mutation-checked tests in `test/action-animation-gate.test.js`.
- **`ss2-rules.js`'s deferral paragraph is corrected.** It deferred four actions
  and three of them had shipped on 2026-09-13. It now defers two, and says which
  half of `psyche_up`'s reason is stale.

## The specification, with what is STATED and what is NOT

Source unless noted: `docs/integration/ss2-battle-map.md`.

| | |
| --- | --- |
| Phase label | `psyche_up`, reachable by `getphase`; pushes at `+0x0dec`, `+0x127e` (frame 5) and `+0x0b8b`, `+0x0f95` (frame 13) |
| Counter animations | `psyche_up` / `psyche_up2` / `psyche_up3` for values 1, 2, `>= 3` — `+0x658a`, `+0x65b9`, `+0x65ef` |
| Discharge | at 3, range-gated, `checkattackroll` at `+0x669e`/`+0x66a9` (right) and `+0x6717`/`+0x6722` (left) |
| `attack_direction` | `30`, no RNG draw |
| Damage | **`ceil(max_damage * 1.5)` with a "level-based fallback"**, critical sample forced `20`, chance field `normal_percentage` |
| Stamina cost | `round(strength)` at `+0x653f` |
| Range gate | `attacker._x` vs `defender._x -/+ round(weapon_range + 50)`, `+0x6658`–`+0x6699` and `+0x66d1`–`+0x6712` |
| Out of range | **decides nothing at all** — no roll, no damage, no death. Unlike every melee attack, which resolves from any distance. |
| Reset | `nextphase` writes `game_attacker.psyche_up = 1` whenever `phase_decision != "psyche_up"` (`+0x35c7`–`+0x35ea`); `damagecharacter` does the same to the defender at `+0x1be4` |
| UI gate | `herolevel >= 7` on the warrior controller frames, `>= 3` on the archer frames |

► **`round(strength)` IS THE STAMINA COST AND NOT THE DAMAGE, AND I PUBLISHED IT
  AS DAMAGE BEFORE THREE AGENTS BROKE IT.** The row sits in the map's
  `staminacost`-by-phase table, beside `power_attack -> round(strength*3)` and
  `rest -> 0 - round(stamina * 15)`. A cost table whose `rest` row is negative
  can only be a cost table. **The damage is in the attack-roll dispatcher table,
  a different section entirely.**

► **THE COUNTER'S FLOOR IS 1, NOT 0, AND THE ADAPTER DISAGREES.** Both resets
  write `= 1`. Meanwhile `src/adapter/vanilla-fields.js`'s MAP_SILENCE entry
  `psyche-up-initialisation` records that the map never states the value before
  the first write and that the adapter treats it as "a numeric field defaulting
  to 0". **Reconcile those two deliberately, and write down which you chose.**

## What is NOT specified — the holes, each one able to change the code

1. **The "level-based fallback" on the damage is never expanded.** The phrase
   appears exactly once in the map and nowhere else in `docs/`. **A verifier
   partially broke the agent that called this a blocker**, finding the fallback
   IS expanded in the byte-derived module the goldens replay against — so
   **start at `src/golden/ss2-attack-candidate.js`'s `directionProfile`, whose
   `direction === 30` arm already resolves a complete grievous blow with no
   edit**, and see what it does about the fallback before concluding anything.
2. **The range gate's comparison OPERATOR and its sign-to-facing binding** are
   not stated; the map writes only `-/+ ... "by facing"`.
3. **Whether `+0x6738` and `+0x6761` sit inside the `>= 3` arm or at the phase
   join** is not byte-cited. If `+0x6738` is at the join the counter never
   advances and the discharge is unreachable.
4. **The `battle_action` -> `phase_decision` mapping** is byte-cited for
   `battle_action == 1` -> `decisionA` only. A pass landing on the `null` site
   at `+0x3b18` would reset the hero's own counter mid-turn.
5. **`changeCombatants` is named once and never decoded**, so who
   `game_attacker` is on each `battle_action` step is unknown.
6. **The counter's initial value** (see the MAP_SILENCE entry above).

## The cadence, and why NO capture can settle it today

The map asserts an answer and marks it a static candidate: the discharge writes
`psyche_up = 1` at `+0x6738` and the animation callback adds one at `+0x6761`,
in different ticks of the same phase, so statically **the counter lands on 2**.

► **THE MAP'S OWN GLOSS ON ITS OWN CANDIDATE IS WRONG BY ONE PRESS.** It says
  landing on 2 "would let the next `psyche_up` press discharge again". It would
  not: at 2 the selector at `+0x65b9` picks `psyche_up2`. The two readings differ
  as a CADENCE — **3 presses to the first discharge and 2 per discharge
  thereafter (lands on 2), against 3 every time (lands on 1)**. The sibling doc
  `ss2-capture-staging.md` words it correctly as "shortening the *next* chain".

► **AND `ss2-capture-staging.md` SAYS "two consecutive presses recorded live
  decide it", WHICH IS NOT TRUE OF THE COMMITTED WRAPPER.** Its recording window
  is exactly the duration of `checkattackroll` — `beginAction()` on entry,
  `finishTrace()` on return — and **both counter writes happen after that
  return**, with `makeWatcher` emitting only `if (armed)` and `finishTrace`
  latching `finalsDumped`. So settling this needs a WRAPPER CHANGE before it
  needs a capture, and a wrapper change is save-mutating and the owner's.

**So: ship the map's static reading, mark it, and do not record it in
`MAP_SILENCE`** — that register is for what the map does not say, and every
existing entry's `silence` field describes an omission. This is a stated map
derivation flagged as unconfirmed, which is a different thing.

## The blast radius — read this before adding the resource

► **A NAME WITH AN `SS2_RESOURCE_DEFAULTS` ENTRY MOVES EVERY GOLDEN REPLAY HASH.
  MEASURED 23/23.** `ss2Combatant`'s bag loop runs unconditionally, and
  `derive: false` does NOT stop the default fill — a golden hero built through
  `combatantFromScenarioSide` carries 38 resource keys, 31 of which its fixture
  never states.

► **THE LIVING HEAD'S REASSURANCE IS THE RIGHT ANSWER FOR THE WRONG REASON AND
  DOES NOT GENERALISE.** It says the vocabulary pin's warning is "broader than
  what happens". The last three additions left goldens alone because
  `weapon_range`, `weapon` and `secondary_weapon` are **deliberately absent from
  `SS2_RESOURCE_DEFAULTS`**, which is stated at the field itself. For a name WITH
  a default the warning is literally accurate.

► **THE REPOSITORY HAS ALREADY CAUGHT THIS ONCE**, at `86ccb68` (2026-09-07),
  and the correction sits twenty lines above the claim it corrects: all 23 hashes
  moved, the armoured golden went `70e605e1` -> `4032d673`, **and the entire
  suite stayed green because nothing pinned the shape.**

**Recommendation, not a decision:** add `psyche_up` WITHOUT a
`SS2_RESOURCE_DEFAULTS` entry, following `weapon_range`. It keeps the corpus
still AND it is the honest reading of a documented silence — both of this
project's values point the same way for once. **Say so at the field.**

## The art — all of it exists, and one structural warning

- **All five clips are in the pack and drawable**, `psyche_up3` included: 13
  poses, frames 1644–1656, the largest of them, carrying its own baked
  discharge-burst art as a 17th placement at depth 43 with a different shape id
  per pose. **The "does the pack carry psyche_up3" gap this brief was expected to
  find does not exist.**
- The sounds are already bound and `emitFigureOps` already composites the glow,
  so **no new drawing code is needed**.
- `psyche_charging`/`psyche_charging2` are classified as CONTINUATIONS in
  `clip-labels.js`. **That classification is an INFERENCE, not a map statement** —
  neither name appears in the battle map at all — supported by frame contiguity
  (`psyche_up` 1609–1617 runs into `psyche_charging` 1618–1626), by neither
  charging clip having a `StartSound` binding while all three `psyche_up*` do,
  and by the `guard_charge` glow object.
- ► **HOW MANY OF THE TWELVE GROUPS A FAMILY REACHES IS DISPUTED, AND THE
  VERIFIER WON.** One agent said a family over the three map-named clips reaches
  10 of 12 entries and 13 of 30 placements, because the other 2/17 sit on the
  continuations and `animationFor` returns one animation, never a sequence. Its
  verifier mounted all five clips under in-family slots, painted them, and got
  **12 of 12 distinct group records and all 30 grouped placements** —
  reachability is decided by `FAMILY_LABELS`, a table the implementation itself
  writes. **Re-derive this yourself before designing around either number.**
- **A test pins these labels as unreachable and will go red ON PURPOSE.** Find it
  before you start, so the red is expected rather than alarming.

## The structural warning — `psyche_up` is not the ranged trio

A verifier broke the "same shape as ranged" framing on one specific point, and it
is the point most likely to produce a wrong implementation:

► **`psyche_up` IS NOT AN ATTACK ON TWO OF ITS THREE PRESSES, AND `ATTACK_BANDS`
  MEMBERSHIP MEANS "ALWAYS ATTACKS".** Presses 1 and 2 play an animation, cost
  stamina and advance a counter; only the third rolls. An action type that
  declares itself an attack will consume samples and draw rolls on presses that
  draw none in the build. **Decide where that lives before writing the candidate.**

## What to read first

1. `src/golden/ss2-attack-candidate.js` — `directionProfile`, the `direction === 30` arm.
2. `src/team/ss2-rules.js` — `Ss2ActionType`, `legalActions`, `SS2_RESOURCE_NAMES`,
   `SS2_RESOURCE_DEFAULTS` and `weapon_range`'s note, `VANILLA_PHASE_LABEL`,
   `ss2Reach`, `ss2FightDistance`.
3. `test/ss2-ranged.test.js` — 1,052 lines, the template for what a new action's
   test file looks like here.
4. `docs/integration/ss2-capture-staging.md`, "Group F — needs the `psyche_up`
   discharge chain": the byte-level re-read, which is more decoded than the map.
