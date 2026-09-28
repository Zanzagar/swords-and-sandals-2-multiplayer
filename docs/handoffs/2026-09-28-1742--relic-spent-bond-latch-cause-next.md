---
handoff:      2026-09-28-1742--relic-spent-bond-latch-cause-next
written:      2026-09-28 17:42 +0000
sessionStart: 2026-09-05 23:04 -0400
sessionId:    01a074ac-c9e7-7303-8538-c8e392199ac2
agentRuns:    two read-only D1L frontier/atomicity/gameplay audits plus one final diff verifier
branch:       design/endless-progression-owner-packet
commits:      8e4a2f5..HEAD
suite:        proportional serial checks 10/10 passed; register reparses 141/141 with Phi_SR 29; decision-record hash unchanged
supersedes:   2026-09-28-0623--relic-absence-dialect-next
---

# Handoff — persistent spent-bond latch cause is next

Start with `HANDOFF.md` above its archive line and
`$ss2-progression-design`. Present D1L only. L is the first persistent
`LISTENED—SEVERED` write for a canonical pair in its current unbroken bond,
not the earlier `{}` commit or a later read of the already-set latch.

## Where things stand

Zanzagar selected `RCS-03D1Z1-C`. Both the state- and boundary-dialect
intersections of `D_Z` are nonempty while `D_Z ⊊ D_mut` remains mandatory.
Every proposal remains same-dialect. The bare C answer did not select the
recommended D1Z1-A scope fallback; it remains advisory. The separately
selected parent D1Z-A system fallback remains armed and has not fired.

D1Z1 is `DIR-SELECTED`; D1L is the sole `OWNER-OPEN` row. The 141-row register
contains 28 `SCREEN`, 1 `OWNER-OPEN`, 39 `PRUNED`, 66 `DIR-SELECTED`, 5
`DERIVED`, 1 `SPEC`, and 1 `EVALUATE`; `Phi_SR = 29`. Six cause slots remain:
L/L1, X/X1, and M/M1. Closing them returns D2 at 23; D2-D5 then lead to
RCS-03E at 19. The authoritative decision record remains unchanged.

## Present exactly this next

Selected D4-A gives one listen per unbroken canonical pair bond. An actual
ledger-bearing `{}` commits at Z; L then writes that the canonical pair is
`LISTENED—SEVERED`, preventing another evaluation until genuine relationship
insufficiency and later renewal. Evidence remains available.

One qualifying L witness contains the actual first unlatched-to-latched write,
a prospectively versioned direct L edge to a materially distinct same-dialect
assignment, and an edge-deletion intervention that removes only the proposal
while holding `{}`, proof, every Z proposal, the latch, no-reattempt effect,
trace, and current assignment fixed. L cannot inspect later break, renewal,
evaluation, approval, collision, or committed transformation and cannot alter
settlement, proof, latch, key, interval, or recurrence.

One latch transition is one occurrence. Tags, ledgers, proof children,
participants, pair order, UI refreshes, storage, reads of `Already heard`,
polling, duplicate delivery, reload, replay, callbacks, routing churn, and
idempotent rewrites do not multiply it. Genuine break ends the interval;
renewal may permit a later episode but is not this L.

- **A — the latch governs recurrence but never transforms. Recommended.**
  `D_L=emptyset`. L remains meaningful by closing rerolls, marking a continuing
  pair spent, and forcing real break/renewal, but creates no second proposal
  immediately after Z. Teach: **“absence may shape an Absence-bound Relic;
  remembering that this bond was heard governs recurrence.”** The standing
  ideal already appears in the same bond continuing with genuinely changed
  recurrence status; A need not turn every rich boundary into biography.
- **B — every transforming Relic has a latch-write-shaped path.**
  `D_L=D_mut`. Every definition needs a reachable deny/cancel/latch route whose
  first L write can propose change. This functionally restores universal
  cancellation biography after D1Z kept it proper, while maximizing pair
  rotation, reset farming, ally steering, and Z/L collision burden.
- **C — a disclosed Closure-bound proper subset changes on L.** `D_L` is
  nonempty proper and D1L1 opens. A Closure-bound, Vow-bound, or Last Witness
  family may change because the continuing bond became persistently spent, not
  merely because `{}` occurred. This is evocative but currently has no
  independent occurrence-level lever: under D4-A players cannot reach L
  without accepting its Z occurrence or accept that Z occurrence without L.

Concrete separating example: `P/Q` settles `{}`. An Absence-bound Relic may
receive `MOURNING PROPOSED` at Z. L then writes
`LISTENED—SEVERED(P,Q)`. Under A, that write only governs recurrence. Under C,
a Closure-bound Vowscar with no Z edge might instead receive
`RESOLVED CONDITION PROPOSED`; deleting its L edge leaves `{}`, all Z
proposals, the latch, and the no-reattempt consequence unchanged.

C is a guarded replacement path, not a selected fallback. It earns reopening
only if the new persistent pair memory is indispensable to the proposal in a
way Z cannot express, changes post-cancellation policy about preserving,
breaking, or replacing the bond, produces optimized reasons both to seek and
avoid L, and survives self-reset, pair-rotation, replay, ally-coercion, and
double-proposal tests.

Ask only for A, B, or C. Under A/B, D1L1 prunes and D1X opens. Under C, D1L1
opens next.

## Hard rules

- A letter selects worksheet direction only; leave the authoritative record
  unchanged until complete replay and explicit acceptance.
- Keep Z and L separate: actual empty manifestation versus the later durable
  no-relisten memory. Do not launder a delayed Z edge through L.
- Preserve the selected D4-A occurrence. If guarded D4-B ever replaces it,
  replay L against the changed recurrence contract.
- D1L selects cause prevalence only. Exact definitions, `D_L ∩ D_Z`, dialect
  incidence, triggers, targets, rates, power, UI, persistence realization,
  approval, collision, identity, break/renew cadence, and implementation stay
  later.
- The proposed D1Z1-A scope fallback remains unselected; the selected parent
  D1Z-A system fallback remains unfired.
- Do not touch the oracle install, captures, fixtures, observations, manifests,
  goldens, saves, or snapshots.
- Before ending, reparse the register, preserve the decision-record hash, run
  proportional serial tests, commit atomically with the Codex co-author trailer,
  push only the feature branch, verify clean synchronization, and do not merge
  PR #3.
