# Handoff — every artifact has a whole biography; Relic-state lifetime next

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-21 03:28:32
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.131: whether input-affecting Relic-owned state is
lineage-carried, encounter-reinitialized, or supports both semantic lifetimes.
The owner selected C3c.130-C. Preserve accepted EP-D02 wording until a complete
replacement is replayed and explicitly accepted. Do not implement.

## Standing north star and workflow

The standalone game is **Souls and Simulacra**. Use *Achintya Bheda Abheda*
(*acintya-bhedabheda*) as the enduring design ideal: prefer meaningful
continuity or participation and real, mechanically legible distinction at the
same operative relationship. This is an inspirational game-design analogy,
not theological equivalence, a silent invariant, or an automatic selector.

For every recommendation, name the operative relationship and boundary, rate
the fit as direct, partial, neutral, or aggregate, and expose the gameplay
tradeoff. Present exactly one prerequisite-ready A/B/C choice at a time with a
recommendation, strongest countercase, and concrete example. Finish the
current full-assurance pass before the separate standalone expansion, audit,
and adaptation pass. Vanilla evidence and the byte-identical oracle remain in
their own lane.

## Selected direction — EP-D02-C3c.130-C

Every represented persistent artifact is one-history-complete:

`D^{all-Id-1H-allK}_{locked,v}=D^{U=}_{locked,v}`.

For each represented artifact ID, some qualifying canonical nonforked fixed-
version history for that same artifact contains every completed key in its
fiber. Different artifacts may use different histories. The selected branch
retains tight floors `9/23/138`, four represented locked IDs, eight lived
aligned edges, four complete IDs, no incomplete represented ID, Souls
`{6,9,10,12,14,15}`, and degree six. Whole-form biography is **partial** at the
same-owner/same-artifact/across-one-history boundary; universal artifact/name
prevalence is **aggregate**. No guarantee about every player's realized
history, transitions, cause, agency, access, or value was selected. The
authoritative decision record remains unchanged.

## Active owner choice — EP-D02-C3c.131

Let `L^{state}_v` be the nonempty semantic-lifetime support subset of `{P,E}`
for materially input-affecting Relic-owned state in completed locked exact
keys:

- `P`, lineage-carried: the fact belongs to the continuing artifact, crosses
  at least one ordinary encounter boundary, and may affect a later encounter.
  Circuit-local and career-long state both count if they cross that cut.
- `E`, encounter-reinitialized: teardown ends the fact; any corresponding
  state in a later encounter is newly initialized or derived.

This classifies authoritative semantics, not save fields, caches, timestamps,
or implementation shape. Current combatant/battle evidence in the independent
`H`/`S` source grammar is not Relic-owned state.

### A — lineage-carried state only — recommended

`L^{state}_v={P}`. Every material Relic-owned state fact in scope belongs to
the continuing artifact; no encounter-local Relic state changes input grammar.
This makes C130-C's biographies genuine personal-artifact memory and keeps the
Relic state language distinct from current-battle evidence. At the same-owner/
same-artifact/fixed-boundary/across-lineage-state relationship, continuity and
distinction coexist **partially**; universal carried support is **aggregate**.
Costs are durable-state save, migration, recovery, comparison, and hidden
quality risks that later disclosure, agency, and non-dominance rules must tame.

Example: R17 is in `Mercy` at the end of encounter 3. Ordinary teardown
preserves the authoritative state, so encounter 4 can still read `Mercy`
unless an authorized operation changed or cleared it.

### B — encounter-reinitialized state only

`L^{state}_v={E}`. Every material Relic-owned state fact ends with its current
encounter. This is the strongest immediate-gameplay countercase: states gain a
clear tactical scope and reset boundary with less durable-state burden. The
risk is that Soul Relics become another proc or stance layer and their whole-
artifact biography feels formally true but mechanically unremembered.

Example: R17 becomes `Kindled` in encounter 3. Battle close ends that fact;
any `Kindled` state in encounter 4 is a new local occurrence. The card does not
select whether that occurrence is common, controllable, or repeatable.

### C — both lifetimes

`L^{state}_v={P,E}`. The catalog materially supports at least one fact of each
lifetime. This permits a remembered long-form condition and a tactical local
mask, but does not require them to coexist on one artifact. It adds two state
languages, comparison/UI complexity, durable migration plus battle-reset
validation, and a token-witness loophole. Coexistence across the catalog is
**aggregate**, not automatically a direct realization of the ideal.

Example: an `S-O` name may carry `Mercy/Defiance` between encounters while an
`S-R` name manifests encounter-local `Veil/Flame`. A later card could place
both layers on one artifact, but C131-C would not yet require it.

## Invariants and ordering

| Branch | Definitions | Keys | Six-Soul rows | Represented IDs | Lived edges | Complete IDs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 9 | 23 | 138 | 4 | 8 | 4 |
| B | 9 | 23 | 138 | 4 | 8 | 4 |
| C | 9 | 23 | 138 | 4 | 8 | 4 |

Souls remain `{6,9,10,12,14,15}` and tight maximum degree remains six. C124-A
already supplies two state-supporting name classes, so C can assign one
lifetime to each without adding any key, ID, edge, history, or Soul row.

State lifetime precedes exact evaluation-boundary semantics because `state_v`
and `bound_v` are separate tuple projections. A state-only comparison can hold
an abstract boundary fixed; a raw precombat/in-combat card would currently
conflate grammar binding with predicate sampling and conflict with C32-B's
required post-entry contingent evidence. Both axes must be resolved before
causal or agency questions.

C131 selects no exact state labels or value count, horizon beyond the ordinary
encounter cut, mutation or initialization rule, transition, order, cause,
reversal, evolution, reroll, live switching, simultaneous expression, choice,
access, repeatability, disclosure, frequency, whole-form completion horizon,
value, power, non-dominance, exact evaluation-boundary phase, persistence
schema, migration behavior, release, or implementation.

## Process-doc warning

`docs/overnight-agent-plan.md` still lacks the `## THE ARCHIVE LINE` named by
`AGENTS.md` and contains superseded fan-out/Ruffle guidance. The correction in
`HANDOFF.md`'s living head remains controlling: follow direct `AGENTS.md` rules
and do not treat the overnight plan as current guidance.

## Required next-turn behavior

Treat the owner's next bare `A`, `B`, or `C` as the answer to C131 only. Record
the selected branch and its derived consequences, recompute the frontier, and
present exactly one next prerequisite-ready choice. Do not infer acceptance of
the whole EP-D02 replacement or start implementation.
