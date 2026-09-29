---
handoff:      2026-09-29-0153--relic-nonclear-topology-next
written:      2026-09-29 01:53 +0000
sessionStart: 2026-09-05 23:04 -0400
sessionId:    01a074ac-c9e7-7303-8538-c8e392199ac2
agentRuns:    two read-only D1M-transition/D2-topology audits plus two final diff rechecks
branch:       design/endless-progression-owner-packet
commits:      e968907..HEAD
suite:        proportional serial checks 10/10 passed; register reparses 142/142 with Phi_SR 24; decision-record hash unchanged
supersedes:   2026-09-28-2226--relic-dedicated-operation-cause-next
---

# Handoff — direct shortcut versus required staged nonclear topology is next

Start with `HANDOFF.md` above its archive line and
`$ss2-progression-design`. Present D2 only; the full graph definitions,
examples, tradeoffs, fallback gates, and branch arithmetic are in the living
head and owner packet.

## Where things stand

The D1M selection and one prerequisite correction are recorded on the feature
branch. D2 is the sole owner frontier in a 142-row register at `Phi_SR = 24`.
The authoritative decision record is byte-unchanged.

## Highest-value next step

Ask for D2 A, B, or C exactly once:

- A makes every transforming definition shortcut-complete over its already-
  reachable distinct nonclear endpoints. It is the practical system fallback.
- B gives every transforming definition at least one genuine required-stage
  gap.
- C makes staged and shortcut-complete definitions coexist and opens D2A for
  state-only, boundary-only, or both-dialect incidence.

Recommend guarded C with D2-A as an explicitly selected whole-system fallback.
Require the answer **“C with D2-A system fallback”** to select that replacement
path; a bare C does not. C survives only if the transition graph is visible,
intermediates materially change optimized play, neither topology class is a
premium or trap, no copy carries a hidden topology-quality roll, and universal
M does not bypass the advertised gap.

## Hard rules

- A genuine gap uses one legal canonical same-artifact history, distinct
  source/endpoints, only nonclear material assignments, and the union of all
  legal P/Z/X/M direct proposal edges. Never stitch incompatible histories.
- Any legal direct shortcut removes that ordered pair from the staged-gap set;
  an optional two-step route is not required staging.
- If a selected Z/X/M parent fallback removes edges, rebuild the topology and
  either reauthor it to satisfy the chosen D2/D2A branch or explicitly reopen
  D2 and every dependent answer. Never inherit a graph class from deleted
  edges.
- D2 selects no reverse edge, clear-to-unassigned route, eventual return,
  agency/approval, exact graph, actor, cost, lock, power, UI, persistence, or
  implementation.
- A letter selects worksheet direction only. Leave the authoritative decision
  record unchanged until complete replay and explicit acceptance.
- Do not touch the oracle install, captures, fixtures, observations, manifests,
  goldens, saves, snapshots, or assets.
- Before ending, reparse the register, preserve the decision-record hash, run
  proportional serial tests, commit atomically with the Codex co-author and
  reason trailers, push only the feature branch, verify clean synchronization,
  and do not merge PR #3.

## Traps from this session

The first D2 repair still omitted dialect incidence for a proper staged subset;
D2A restores it rather than flattening it into authoring. The first formal
`R_d` definition also admitted `a -> ... -> a` cycles as gaps because direct
edges require distinct targets. That would have made D3/D5 cycles satisfy D2
and invalidated the claimed three-assignment floor. `R_d` now quantifies only
distinct endpoints, so reverse edges and eventual return remain genuinely
open.
