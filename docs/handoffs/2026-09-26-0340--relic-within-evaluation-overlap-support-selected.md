---
handoff:      2026-09-26-0340--relic-within-evaluation-overlap-support-selected
written:      2026-09-26 03:40 +0000
sessionStart: 2026-09-05 23:04 -0400
sessionId:    01a074ac-c9e7-7303-8538-c8e392199ac2
agentRuns:    two bounded read-only named-claim audits established the C2 trichotomy and recommendation C; a final corrected-diff review returned PASS
branch:       design/endless-progression-owner-packet
commits:      22c23d3..HEAD
suite:        proportional serial checks 10/10 passed; register reparses 65/65 with Phi_SR 29; decision-record hash unchanged
supersedes:   2026-09-26-0318--relic-authored-compound-topology-selected
---

# Handoff — within-evaluation Relic overlap support selected

Start with this handoff, `HANDOFF.md` above its archive line, and
`$ss2-progression-design`. The sole active Relic frontier is
`RCS-03C3C2`; present that one card only.

## Where things stand

The owner selected `RCS-03C3C1-B`. `O^{intra-overlap}_v` is nonempty: the
completed catalog must include at least one reachable fixed evaluation where
two distinct canonical receipt tags are individually ledger-satisfied before
fan-out treatment and their valid typed final-child ledgers overlap.

Overlap means either one exact final B4B child occurrence appears in both
ledgers or two distinct cross-ledger child occurrences have intersecting
complete lineages/share one nonmultiplying authorization or accounting parent.
This is pre-treatment structural support, explicitly not C133/C134 provisional
completion. It creates no candidate, joint survival, or commitment.

C1 is now `DIR-SELECTED`; C2 is `OWNER-OPEN`. The sixty-five-slot register has
28 `SCREEN`, 1 `OWNER-OPEN`, 8 `PRUNED`, 24 `DIR-SELECTED`, 2 `DERIVED`, 1
`SPEC`, and 1 `EVALUATE`; `Phi_SR = 29`. The authoritative decision record is
unchanged because the bare label does not complete acceptance.

## C2 audit and next card

Two bounded read-only audits found no additional split. Define:

- `E^{intra-exact}_v`: C1-positive tuples where the same final child occurrence
  appears in both ledgers;
- `R^{intra-related}_v`: C1-positive tuples where two **distinct** final child
  occurrences, one from each ledger, have intersecting complete lineage or a
  shared nonmultiplying authorization/accounting parent.

C1-B makes their union nonempty. The exhaustive support states are therefore:

- A — exact only: E is nonempty and R is empty;
- B — distinct-related only: E is empty and R is nonempty; or
- C — both: E and R are nonempty, possibly in one opportunity or separate
  fixed evaluations.

Recommend C. It preserves two locally coherent play grammars without deciding
C3 treatment. Exact overlap makes a readable hub: one `Heat h` helps both
`P = Guard g + h` and `Q = Return t + h`. Distinct-related overlap makes
choreography: different final singleton manifestations of one operation help
different tags while retaining one causal/payment family. Each local witness
may directly express unity with difference; catalog coexistence is aggregate,
not a stronger local Achintya rating.

C has the broadest fun/buildcraft possibility and avoids globally banning one
natural form before treatment is chosen. Its costs are cumulative: exact hubs
can dominate recipes, distinct-related proofs can compress one payment into
multiple relational readings, and players must be taught why “the same proof”
and “different proofs with one ancestry” are both overlap.

## Hard rules

- C2 is support-form existence only. It creates no provisional candidate,
  commitment, fan-out permission, or proof-selection priority.
- “Related” requires two distinct final child occurrences. A child cannot use
  self-lineage to prove both E and R.
- Empty-set branches quantify every reachable valid ledger assignment, not
  whichever assignment a resolver later favors.
- A B4B compound is one final child. Reusing it is exact overlap; its hidden
  member sites cannot prove distinct-related support.
- Distinct related children do not become aliases. Shared lineage/accounting
  marks non-independence across receipts while identities remain distinct.
- Every receipt ledger remains internally independent. Same-result duplication
  is forbidden under every option.
- Alternate contexts, cuts, Souls, Relic realizations, Charms, dormant
  definitions, labels, fields, packets, callbacks, or resolver microsteps
  cannot construct support.
- C3 retains within-evaluation treatment. C4-C7 retain distinct same-cut
  opportunity behavior; C3D-C3F retain claims/reuse; RCS-08 retains cross-
  root/team authority.
- Do not edit the authoritative decision record without an explicit
  `accepted`, `rejected`, or complete accepted-replacement disposition.
- Do not touch the installed oracle, captures, fixtures, observations,
  manifests, goldens, saves, or snapshots.

## Verification and Git

The proportional serial checks passed 10/10: all seven handoff-navigation
checks and all three no-shipped-assets checks. The frozen register reparses to
the exact 65-row distribution above and `Phi_SR = 29`; the final independent
read-only diff review returned `PASS`. The authoritative decision record retains SHA-256
`e7e5c0fb047e42e5852648972f7f57f5539708bf990d97fe597d000ad5ed5358`.
Run `git diff --check` and the post-commit handoff-navigation test. Commit this
round atomically, push the feature branch, verify it is clean and synchronized with
`github/design/endless-progression-owner-packet`, and do not merge PR #3.
