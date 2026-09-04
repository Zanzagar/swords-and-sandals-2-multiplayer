# Handoff — EP-D02 accepted personal Rule Capacity

**Session ID:** `01a06757-02d5-79e1-85d6-76b8daef1935`
**UTC:** 2026-09-04 07:51:53
**Branch:** `design/endless-progression-owner-packet`

Start from the authoritative EP-D02 eighteen-clause accepted replacement and
the accepted EP-D01 clauses 6–7 amendments; the next coupled product frontier
is EP-D04's exact rarity/dominance rule.

## Durable outcome

Zanzagar explicitly replied:

```text
EP-D02: revise — accepted replacement as replayed.
EP-D01 clauses 6–7: revise — accepted amendments as replayed.
```

The exact replay is transcribed in
[`docs/design/endless-progression-decisions.md`](../design/endless-progression-decisions.md#ep-d02--personal-rule-capacity-grows-to-a-finite-48-load-ceiling),
with owner and UTC date 2026-09-04. Do not summarize that block back into a
different clause count: it contains exactly eighteen accepted EP-D02 clauses.
The two amended EP-D01 clauses are also verbatim in the same authoritative
record; the other seven EP-D01 clauses remain unchanged.

Personal Capacity now starts at 0 and reaches a finite v1 ceiling of 48 through
eighteen stable authored championship milestone lineages in six `+2,+3,+3`
chapters. It belongs solely to `combatantId`; all sixteen mapped item positions
use categorical 0/1/2/3 payload costs, both weapons reserve Load, and at least
one otherwise-legal all-sixteen-Legendary loadout must exist. Full-rank,
Training Assistance, and precommitted Recovery championship victories qualify
every persistent gladiator in the frozen victorious roster, including a
knocked-out winner. The personal lineage receipt is bounded, atomic, and
idempotent. Recovery Capacity is the sole mechanical exception to that branch's
otherwise zero-grant rule.

Lower-progression routes use the accepted personal/route minimum and require an
explicit legal lower-band loadout without mutating saved equipment. Failed
equip/configuration operations preserve the old bytes. At most one equipped
Legendary may Ascend; its item/Core locks for the Circuit, while its owner may
retain or select one learned exact-lineage Branch after each encounter preview
and before its first attempt. Team Tactic uses a separate nonfungible allowance.
Standalone Forms, Signature designations, and Keystones are removed as sources.
Migration preserves every item and an illegal old configuration until its owner
explicitly replaces it at a clean boundary.

## Reconciled documents

- `README.md`, the owner packet, system specification, readiness record,
  EP-D01 matrix, and `HANDOFF.md` now point at three closed decisions:
  EP-D01, EP-D02, and EP-D07.
- EP-A03's hard-coded four-unit Reconstruction Tray is explicitly superseded
  and nonselectable. It was not mechanically rescaled to 48; EP-A03 requires a
  new maintenance/access design.
- EP-D04 remains pending and its old body recommendation now says revise before
  decision. Its replacement needs an exact grid, weighting, tie, and threshold
  contract that allows the accepted theoretical all-Legendary optimum while
  preserving useful mixed-rarity configurations.
- The old fixed-four MVP is marked non-operative and requires rescope under an
  explicit earned/route Capacity band. A post-Emperor fixture uses 48, not 4.
- No runtime implementation, capture, Ruffle session, installed-game access,
  fixture/golden change, or licensed asset change occurred.

## Verification

`git diff --check` passed. `node --test --test-concurrency=1` completed with the
expected fresh-worktree profile: 584 tests, 583 passed, 1 raw-trace archive
existence check skipped, 0 failed.

Implementation remains blocked. EP-D03–EP-D06 and EP-A01–EP-A03 are open, as
are the readiness contracts. Resume with `$ss2-progression-design`; address
EP-D04 next unless the owner redirects the frontier.
