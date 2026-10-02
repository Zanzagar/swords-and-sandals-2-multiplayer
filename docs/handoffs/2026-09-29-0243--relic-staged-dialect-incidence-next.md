---
handoff:      2026-09-29-0243--relic-staged-dialect-incidence-next
written:      2026-09-29 02:43 +0000
sessionStart: 2026-09-05 23:04 -0400
sessionId:    01a074ac-c9e7-7303-8538-c8e392199ac2
agentRuns:    targeted read-only D2-boundary, gate-recovery, and recovery-narrative audits plus earlier atomicity/final-diff checks
branch:       design/endless-progression-gate-recovery
commits:      eac3347..HEAD (one gate recovery squash plus current-main integration)
suite:        full serial suite 3,817 passed / 18 expected asset-or-archive skips / 0 failed; focused 10/10 passed; register 143/143 with Phi_SR 24; decision-record hash unchanged
supersedes:   2026-09-29-0153--relic-nonclear-topology-next
---

# Handoff — staged-topology dialect incidence is next

Start with `HANDOFF.md` above its archive line and
`$ss2-progression-design`. Present D2A only. Its exact meanings, examples,
tradeoffs, fallback ladder, and branch arithmetic are in the living head and
owner packet.

## Where things stand

Zanzagar selected D2-C with D2-A as the explicit whole-system fallback.
Staged and shortcut-complete definitions coexist; A is armed, unfired, and
replaces C only if required staging fails its gates. The authoritative decision
record is byte-unchanged.

A prerequisite audit caught that D2A's staged-support incidence does not fully
settle which dialects retain shortcut-complete alternatives. D2A1 now owns the
residual legal-build boundary. The 143-row register is at `Phi_SR = 24`, with
D2A as the sole owner frontier and D2A1 screened behind it.

## Highest-value next step

Ask for D2A A, B, or C exactly once:

- A places nonempty required-stage support only in state Relics; every boundary
  Relic is shortcut-complete. It is the recommended child scope fallback.
- B places it only in boundary Relics; every state Relic is shortcut-complete.
- C places it in both dialects while at least one definition remains shortcut-
  complete. It requires at least three transforming definitions and is the
  guarded higher-ceiling recommendation.

Recommend C with D2A-A as an explicitly selected child scope fallback. Require
the answer **“C with D2A-A scope fallback”** to select that ladder; a bare C
does not. The already selected parent D2-A remains the deeper system fallback.
After any D2A answer, present D2A1 rather than D3.

## Hard rules

- D2A classifies whether staged support is nonempty in state, boundary, or
  both. A/B thereby force shortcut-complete support in the opposite dialect,
  but leave its incidence in the staged dialect open; C leaves state/boundary
  complement incidence open. D2A1 resolves the residual case.
- C's three-definition floor is real: one staged state definition, one distinct
  staged boundary definition, and one definition outside proper `D_stage`.
- A staged witness needs one compatible canonical same-artifact history, a
  material intermediate, and no direct P/Z/X/M shortcut between its ordered
  endpoints. Do not stitch histories or count meters, tolls, or aliases.
- If D2A-A or D2-A later fires, rebuild the graph and revalidate/reopen D2A1
  and every dependent topology answer. Never inherit an incidence from moved
  definitions or removed edges.
- D2A chooses no exact graph, reverse edge, clearing, return, cause map,
  agency, approval, collision, actor, cost, lock, power, UI, persistence, or
  implementation.
- A letter selects worksheet direction only. Leave the authoritative decision
  record unchanged until complete replay and explicit acceptance.
- Do not touch the oracle install, captures, fixtures, observations, manifests,
  goldens, saves, snapshots, or assets.
- Before ending, reparse the register, preserve the decision-record hash, run
  proportional serial tests, commit atomically with the Codex co-author and
  reason trailers, push and continue only
  `design/endless-progression-gate-recovery`, and verify clean synchronization.
  Draft PR #4 tracks this replacement and only a human may merge it. Do not
  merge PR #3; that PR tracks only the preserved rejected branch.

## Traps from this session

The first post-D2 draft said D3 followed D2A. That was false: under every D2A
branch, the staged dialect can still be all-staged or mixed, changing whether a
player can retain that dialect while avoiding a required pilgrimage. D2A1 is
one shared complement-incidence row, not three branch-specific duplicates and
not a seven-option joint card. Exact positive counts remain authoring after its
empty/nonempty incidences close.

The default branch's real checker rejects all 38 commits after grandfathered
progression tip `eac3347` through PR #3 head `f9880c1`: the first 37 are
inherited through `f267b73`, and this round's first push is the thirty-eighth.
Their reason lines are not inside Git's final trailer block. The old branch
lacked its configured hook files and therefore did not catch the malformed
messages before push. In `f267b73` and `f9880c1` specifically, a blank paragraph
separates the `Docs:` reason from `Co-Authored-By:`, so `interpret-trailers`
sees only the co-author line. Published history and PR #3 were not amended, rebased,
deleted, force-pushed, or merged. The complete rejected content was recovered
from `eac3347` in one valid squash, then integrated with current main on
`design/endless-progression-gate-recovery`. Continue only from that branch
after re-running the default-branch checker; PR #3 is preserved evidence and
must not merge. Draft PR #4 is the replacement; its trailer checks passed and
GitHub reported it `CLEAN`/`MERGEABLE` when opened.
