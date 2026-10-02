---
handoff:      2026-09-26-0415--relic-both-overlap-forms-selected
written:      2026-09-26 04:15 +0000
sessionStart: 2026-09-05 23:04 -0400
sessionId:    01a074ac-c9e7-7303-8538-c8e392199ac2
agentRuns:    five bounded read-only named-claim audits split old C3 losslessly, reversed one invalid hybrid-composition finding, and corrected the next card's domain
branch:       design/endless-progression-owner-packet
commits:      3405599..HEAD
suite:        proportional serial checks 10/10 passed; register reparses 73/73 with Phi_SR 36; decision-record hash unchanged
supersedes:   2026-09-26-0340--relic-within-evaluation-overlap-support-selected
---

# Handoff — both within-evaluation Relic overlap forms selected

Start with `HANDOFF.md` above its archive line and
`$ss2-progression-design`. The sole active Relic frontier is
`RCS-03C3C3A`; present that one card only.

## Where things stand

The owner selected `RCS-03C3C2-C`. Both exact-child and distinct-related
within-evaluation overlap support are required, but neither form yet permits
two tags to survive treatment.

Old C3 failed its prerequisite audit. It is now a non-counting parent for nine
rows covering ledger multiplicity/authority, one permission set's exact and
related restrictions, denied-pair disposition/authority, and three-plus
contender support/cardinality/authority. The register has 73 rows: 35
`SCREEN`, 1 `OWNER-OPEN`, 8 `PRUNED`, 25 `DIR-SELECTED`, 2 `DERIVED`, 1
`SPEC`, and 1 `EVALUATE`; `Phi_SR = 36`. The decision record is unchanged.

## Next owner card

C3C3A asks whether one individually satisfied receipt tag may have several
canonical valid proof ledgers at the same fixed state:

- A — every satisfied tag has exactly one valid position-to-child ledger;
- B — at least one reachable tag/state has two distinct valid ledgers.

Recommend B, conditionally. It preserves richer proof-routing and redundancy
possibilities while the next card can require a prospective, disclosed, total
resolver. B itself gives nobody a live choice and forbids outcome-favored
post-hoc assignment. Example: P can use `{Guard g, Heat h}` or
`{Guard g, Vow v}`, while Q uses `{Return t, Heat h}`. One P ledger overlaps Q
and the other does not.

## Hard rules and traps

- Canonicalize aliases and representations before counting ledgers; only a
  different position-to-final-child assignment counts.
- Do not demote same-signature ledger identity to AUTHOR/SPEC. A selective
  permission map can distinguish two exact-only ledgers by actual proof.
- Exact and related treatment constrain one opportunity-level permission set.
  A hybrid tuple has one permission bit; do not invent form votes or an OR/AND
  composition card.
- C2-C and C3C3A grant no candidate, commitment, live proc prompt, claim, reuse,
  payoff, persistence, release, or implementation.
- Do not edit the authoritative decision record without an explicit accepted,
  rejected, or complete accepted-replacement disposition.
- Do not touch the installed oracle, captures, fixtures, observations,
  manifests, goldens, saves, or snapshots.

## Verification and Git

The proportional serial checks passed 10/10. Confirm the register continues to
reparse to 73 rows and the distribution stated above; confirm the
decision-record SHA-256 remains
`e7e5c0fb047e42e5852648972f7f57f5539708bf990d97fe597d000ad5ed5358`.
Commit this round atomically with a `Co-Authored-By` trailer, push only the
feature branch, verify it is clean and synchronized with
`github/design/endless-progression-owner-packet`, and do not merge PR #3.
