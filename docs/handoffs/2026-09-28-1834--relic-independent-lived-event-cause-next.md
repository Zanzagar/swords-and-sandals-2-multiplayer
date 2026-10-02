---
handoff:      2026-09-28-1834--relic-independent-lived-event-cause-next
written:      2026-09-28 18:34 +0000
sessionStart: 2026-09-05 23:04 -0400
sessionId:    01a074ac-c9e7-7303-8538-c8e392199ac2
agentRuns:    two read-only D1X atomicity/frontier/gameplay audits plus one final diff verifier
branch:       design/endless-progression-owner-packet
commits:      053c3dd..HEAD
suite:        proportional serial checks 10/10 passed; register reparses 141/141 with Phi_SR 27; decision-record hash unchanged
supersedes:   2026-09-28-1742--relic-spent-bond-latch-cause-next
---

# Handoff — independent lived-event transformation cause is next

Start with `HANDOFF.md` above its archive line and
`$ss2-progression-design`. Present D1X only; its full current card and examples
are in the living head and owner packet.

## Where things stand

Zanzagar selected D1L-A. The spent-bond latch remains fully authoritative for
recurrence but is noncausal for transformation; L1 prunes. D1X is the sole
`OWNER-OPEN` row. The 141-row register has `Phi_SR = 27`; X/X1 and M/M1 are
the four remaining cause slots before D2 returns at 23. The authoritative
decision record is byte-unchanged.

## Highest-value next step

Ask for D1X A, B, or C exactly once, after explaining the positive eligibility
test: X is an already meaningful native combat/source/relationship event, not
anything serialized as an event. The recommendation is conditional C, a
disclosed Event-bound proper subset, with A as a practical fallback only if the
owner explicitly includes it.

If A or B is selected, move D1X to `DIR-SELECTED`, prune D1X1, and open D1M.
If C is selected, move D1X to `DIR-SELECTED` and open D1X1. Recompute the
register rather than copying those transitions by intuition.

## Hard rules

- A valid X event retains material native meaning with every transformation
  edge projected out. Its direct-edge deletion witness preserves the event,
  native consequences, evaluator trace, other proposals, M operations, and
  current assignment.
- Keep X separate from I/T/VT/VF/K/P/C/Z/L and from M. A material native
  expiry can be X; a dedicated evolution/reconfiguration operation is M.
- D1X selects definition-level cause prevalence only. It does not select event
  catalogs, actor scope, targets, rates, caps, power, approval, collision,
  persistence, or implementation.
- Do not treat the bearer-owned examples as authority for ally/opponent event
  force; RCS-08 retains cross-combatant and cross-root authority.
- A letter selects worksheet direction only. Leave the authoritative decision
  record unchanged until complete replay and explicit acceptance.
- Do not touch the oracle install, captures, fixtures, observations, manifests,
  goldens, saves, or snapshots.
- Before ending, reparse the register, preserve the decision-record hash, run
  proportional serial tests, commit atomically with the Codex co-author trailer,
  push only the feature branch, verify clean synchronization, and do not merge
  PR #3.

## Trap from this session

The original row label was not enough. Without the positive independence test,
“combat event” admits token timer events, evaluator results under new names,
and occurrences invented solely to carry transformation edges. Preserve the
repair; it is what makes D1X finite rather than a residual cause bucket.
