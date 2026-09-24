# Handoff — Relic memory crosses Circuits; response window next

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-21 17:05:25
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.133: whether a provisionally complete successful
aligned input result commits before any new material response decision, waits
through a genuine response opportunity, or supports both timing classes. The
owner selected C3c.132-A. Preserve accepted EP-D02 wording until a complete
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
recommendation, strongest countercase, and concrete example. Finish the current
full-assurance pass before the separate standalone expansion, audit, and
adaptation pass. Vanilla evidence and the byte-identical oracle remain in their
own lane.

## Selected direction — EP-D02-C3c.132-A

`L^{circuit}_v={K}`. Every materially input-affecting Relic-owned state fact
keeps the same authoritative assignment for the same `soulRelicInstanceId`
across a clean Circuit cut unless a separate authorized mutation, clearing,
re-attunement, migration, or version operation changes it. This guarantees
survival across at least one clean cut, not immutability or permanence forever.

The selected branch retains `9/23/138`, four represented locked IDs, eight
lived aligned edges, four one-history-complete IDs, zero incomplete IDs, Souls
`{6,9,10,12,14,15}`, and degree six. At the same-owner/same-artifact/across-
clean-Circuit boundary, the broader biography is **partial**, exact continuity
at the cut is **neutral/protective**, and universal cross-Circuit support is
**aggregate**. The authoritative decision record remains unchanged.

## Active owner choice — EP-D02-C3c.133

A raw count of engine transitions is not a stable design choice: declaration,
resolution, and outcome authority remain open, and an implementation may split
one semantic operation into arbitrary events. C133 instead uses a player-
semantic response window.

For one fixed successful aligned input-result occurrence, the relationship is
**provisionally complete** at a semantic combat cut when evaluating the fixed
final predicate against the then-authoritative `H`/`S` facts would produce the
same positive result. Classify the last uninterrupted sufficient interval that
ends at actual commitment. If the predicate becomes false and later true, only
the final interval counts. This evaluates the complete predicate and does not
choose among alternative minimal source sets.

- **No-response (`N`)**: the result commits before any participant receives a
  new legal decision opportunity capable of changing a read fact or the result.
- **Response-window (`R`)**: at least one such opportunity occurs before
  commitment, and a reachable matched pair shows one legal continuation
  preserving the result while another changes or prevents it.

Animation frames, timestamps, serialization, polling, resolver microsteps,
automatic callbacks, and nominal pauses are not response opportunities.

### A — no post-completion response window — recommended

`T^{response}_v={N}`. Successful results commit before another material
decision. This gives crisp causal feedback and keeps completed coordination
from feeling provisional. Its marginal timing fit is **neutral/protective**:
immediacy alone creates neither continuity nor difference, although the
inherited source/Relic/result relationship may remain **direct** at commitment.
The cost is no post-completion counterplay.

Example: Aster's Guard history exists and Borel's Heat state makes R17's fixed
predicate provisionally complete. R17 commits before another player chooses an
action; a later Heat clear can affect only a later evaluation.

### B — a material response window for every result — strongest countercase

`T^{response}_v={R}`. Every successful result exposes at least one real legal
decision before commitment, with a preserve-versus-disrupt witness. This
creates protect-and-disrupt play. When the evidence persists across the
interval while a distinct decision changes its fate, the relationship is
**partial** across that intervening-time boundary. Costs are delayed feedback,
priority burden, fragile current-state recipes, and a risk that every weave
feels like a channel.

Example: after Guard + Heat becomes provisionally complete, one continuation
preserves Heat and succeeds while another legal response clears Heat and
prevents R17's result.

### C — both timing classes

`T^{response}_v={N,R}`. The completed locked domain contains at least one
successful occurrence of each class. This supports snap weaves beside held
rituals, but creates two timing languages, more UI/replay/priority burden, and a
likely premium reading for no-response forms. Local occurrences retain their
own rating; catalog coexistence is only **aggregate**. C does not put both
classes on R17 or make timing player-selectable.

## Invariants, ordering, and deferrals

All branches retain `9/23/138`, four represented IDs, eight lived edges, four
complete IDs, zero incomplete represented IDs, Souls
`{6,9,10,12,14,15}`, and degree six. Exact `bound_v` is finer than `N/R`, so
C113-A remains feasible under either single-class branch.

C133 selects no declaration/resolution/outcome authority, evidence phase,
automatic resolver order, exact sampling cut, response actor/action taxonomy,
number or length of opportunities, payoff timing, grammar commitment or
rebinding, Relic-state mutation, player-selected timing, access, disclosure,
value, persistence schema, migration, release, or implementation. A later
grammar-rebinding card needs a material semantic commitment invariant or one
fixed conditional grammar can encode it and collapse the distinction.

## Process-doc warning

`docs/overnight-agent-plan.md` still lacks the `## THE ARCHIVE LINE` named by
`AGENTS.md` and contains superseded fan-out/Ruffle guidance. The correction in
`HANDOFF.md`'s living head remains controlling: follow direct `AGENTS.md` rules
and do not treat the overnight plan as current guidance.

## Required next-turn behavior

Treat the owner's next bare `A`, `B`, or `C` as the answer to C133 only. Record
the selected branch and its derived consequences, recompute the frontier, and
present exactly one next prerequisite-ready choice. Do not infer acceptance of
the whole EP-D02 replacement or start implementation.
