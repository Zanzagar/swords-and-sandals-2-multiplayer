# Handoff — Relics remember encounters; Circuit horizon next

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-21 03:46:04
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.132: whether C131-A's carried Relic state crosses
a clean Circuit cut, expires there, or materially supports both horizons. The
owner selected C3c.131-A. Preserve accepted EP-D02 wording until a complete
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

## Selected direction — EP-D02-C3c.131-A

Every materially input-affecting Relic-owned state fact is lineage-carried:

`L^{state}_v={P}`.

The same authoritative assignment survives an ordinary encounter cut for the
same `soulRelicInstanceId` unless an independently authorized rule changes or
clears it. Current-battle `H`/`S` evidence remains separate and C32-B still
requires contingent post-entry combat evidence. This is artifact memory, not
a promise that state is immutable or career-long.

The selected branch retains `9/23/138`, four represented locked IDs, eight
lived aligned edges, four one-history-complete IDs, zero incomplete IDs, Souls
`{6,9,10,12,14,15}`, and degree six. The same-owner/same-artifact/across-
lineage-state relation is **partial**; universal carried-state support is
**aggregate**; excluding encounter-local Relic state is **neutral/protective**
only at that omitted projection. The authoritative record remains unchanged.

## Active owner choice — EP-D02-C3c.132

Hold separate state mutation, clearing, re-attunement, migration, and version
operations absent at one abstract clean Circuit cut. Let `L^{circuit}_v` be the
nonempty support subset of `{K,Q}`:

- `K`, cross-Circuit-carried: the same authoritative state assignment for the
  same persistent artifact survives into a distinct Circuit. It must cross at
  least one clean cut; it need not be immutable or permanent forever.
- `Q`, Circuit-scoped: the state survives encounter cuts within its Circuit,
  but clean Circuit finalization ends that assignment. An identically named
  later value is a new assignment.

This uses the accepted abstract Circuit boundary without assuming an exact
fight count, outcome, Pivot, or settlement sequence.

### A — cross-Circuit-carried state only — recommended

`L^{circuit}_v={K}`. A clean Circuit cut is inert to every input-affecting
Relic-owned state absent a separately authorized operation. This most strongly
makes a Soul Relic a remembering personal artifact across long-form play. At
the same-owner/same-persistent-artifact/across-clean-Circuit boundary, identity
and distinct biography states coexist **partially**; continuity at the cut is
**neutral/protective** and universal horizon support is **aggregate**.

Cost: long-lived regret and hidden-copy-quality risk, plus durable save,
recovery, migration, and comparison burden. Later disclosure, reversible
agency where appropriate, and non-dominance must make memory expressive rather
than punitive.

Example: R17 ends Circuit c7 in `Mercy`. With no separate operation at the
cut, that same assignment remains authoritative in c8. A later legal act may
still transform it to `Defiance`.

### B — Circuit-scoped state only — strongest gameplay countercase

`L^{circuit}_v={Q}`. Every state remembers the encounters of its current
Circuit, but clean Circuit finalization ends it. This makes each Circuit a
bounded Relic story and a clean experiment, reducing permanent-state anxiety
and easing replay balance. The risk is that artifact biography becomes run
biography: the Relic forgets at precisely the long-form boundary.

Example: R17 carries `Mercy` through c7, but c7 close ends the assignment. Any
c8 `Mercy` is new; its initialization remains undecided.

### C — both horizons

`L^{circuit}_v={K,Q}`. The completed locked domain materially contains at
least one state of each horizon. This could eventually support an enduring Vow
beside a Circuit Attunement, but it does not require both on one definition or
artifact. Local same-artifact relationships may be **partial**; catalog-wide
coexistence is only **aggregate**. Costs are two lifecycle languages, more UI/
save/test burden, hidden premium combinations, and a token-witness loophole.

Example: `S-O` might carry Vows across Circuits while `S-R` resets Attunements
at every clean close. The card does not select a per-artifact cross-product.

## Exhaustiveness, invariants, and ordering

A/B/C are the three nonempty subsets `{K}`, `{Q}`, and `{K,Q}`. A timer or
outcome-triggered clear is a later mutation rule, not a third horizon: with
that operation held absent, the cut is inert or scope-ending. Recomputing the
same label after expiry remains `Q`.

| Branch | Definitions | Keys | Six-Soul rows | Represented IDs | Lived edges | Complete IDs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 9 | 23 | 138 | 4 | 8 | 4 |
| B | 9 | 23 | 138 | 4 | 8 | 4 |
| C | 9 | 23 | 138 | 4 | 8 | 4 |

Souls remain `{6,9,10,12,14,15}`, maximum degree remains six, and there are no
incomplete represented IDs. Horizon semantics decorate existing material
states, so no branch adds a key, Soul row, artifact, edge, or history.

C132 selects no values, initialization, mutation, clearing, transition,
cause, agency, Concede/Recovery exception, inactive-instance behavior,
configuration/rebinding horizon, exact evaluation-boundary semantics,
persistence schema, migration or season policy, release, or implementation.
After C132, exact boundary work must factor grammar/state commitment separately
from contingent predicate sampling before causal or agency cards.

## Process-doc warning

`docs/overnight-agent-plan.md` still lacks the `## THE ARCHIVE LINE` named by
`AGENTS.md` and contains superseded fan-out/Ruffle guidance. The correction in
`HANDOFF.md`'s living head remains controlling: follow direct `AGENTS.md` rules
and do not treat the overnight plan as current guidance.

## Required next-turn behavior

Treat the owner's next bare `A`, `B`, or `C` as the answer to C132 only. Record
the selected branch and its derived consequences, recompute the frontier, and
present exactly one next prerequisite-ready choice. Do not infer acceptance of
the whole EP-D02 replacement or start implementation.
