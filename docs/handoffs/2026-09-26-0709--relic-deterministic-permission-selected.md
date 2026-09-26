---
handoff:      2026-09-26-0709--relic-deterministic-permission-selected
written:      2026-09-26 07:09 +0000
sessionStart: 2026-09-05 23:04 -0400
sessionId:    01a074ac-c9e7-7303-8538-c8e392199ac2
agentRuns:    two distinct bounded read-only prerequisite audits with mutual cross-challenge, plus one strict read-only final diff verifier with two repair rechecks
branch:       design/endless-progression-owner-packet
commits:      eac3347..HEAD
suite:        proportional serial checks 10/10 passed; register reparses 89/89 with Phi_SR 38; decision-record hash unchanged
supersedes:   2026-09-26-0646--relic-intrinsic-permission-selected
---

# Handoff — deterministic intrinsic exact permission selected

Start with `HANDOFF.md` above its archive line and
`$ss2-progression-design`. Present E1 only; D1 is independently ready but
queued by the one-card protocol.

## Where things stand

The owner selected `RCS-03C3C3C2D-A`: every canonical complete intrinsic
exact-permission law returns a certain bit for each reachable fixed
opportunity. Laws may respond deterministically across contexts, but there is
no fresh permission draw. This does not choose permission incidence or
actionability.

Two distinct prerequisite audits and mutual countermodel challenges broke old
C2E's single global incidence row. It is now a non-counting parent for E1
responsive-law prevalence, conditional E2 matched player-causal response, and
conditional E3 constant-law polarity. A strict diff verifier broke the first
E2 definition because its result depended on field layout; the repaired test
uses one legal action's complete authoritative factual delta, including
inseparable consequences, and is invariant to splitting or combining fields.

The register has 89 rows: 37 `SCREEN`, 1 `OWNER-OPEN`, 13 `PRUNED`, 34
`DIR-SELECTED`, 2 `DERIVED`, 1 `SPEC`, and 1 `EVALUATE`; `Phi_SR = 38`. E1 is
the current presented card. The authoritative decision record remains
unchanged.

## Highest-value next work

Record exactly one owner answer to `RCS-03C3C3C2E1`:

- A: every complete law is context-invariant—always-deny or always-allow over
  its reachable exact domain. E2 prunes and E3 opens.
- B: every complete law is responsive, with both a certain-deny and certain-
  allow reachable context. E2 opens and E3 prunes; actionability is not yet
  guaranteed.
- C: responsive and context-invariant law families coexist. Recommend C for
  conditional covenants beside steadfast witness builds. This carries two
  prediction dialects; E2 and E3 must separately settle actionability and the
  admitted constant polarity class or classes.

E1/E3 project to exactly seven nonempty class-support combinations. E2 is
orthogonal where responsive laws exist, giving eleven terminal paths across
the three rows. Global empty/universal/mixed incidence is derived afterward,
not another owner card.

## Hard rules and traps

- C2D-A means certainty per fixed opportunity, not one constant bit for an
  entire law. Earlier committed random state remains a fixed input.
- Different law identities, unreachable branches, aliases, callbacks, and
  replay copies cannot manufacture responsiveness.
- For E2, hold the law, identities, stance, prior committed state, selected
  pair/structure, and inputs outside one action's complete factual delta fixed.
  Field representation cannot change the answer.
- E1-C guarantees a responsive class and a context-invariant class, not both
  always-deny and always-allow. E3 remains open.
- Deterministic response does not activate stochastic-coupling G2. A factual
  action changing an input to the same intrinsic law does not violate C2A-A.
- D1 is ready but queued. Do not make E1, E2, or E3 its prerequisite.
- Do not edit the authoritative decision record without an explicit accepted,
  rejected, or complete accepted-replacement disposition.
- Do not touch the installed oracle, captures, fixtures, observations,
  manifests, goldens, saves, or snapshots.

## Verification and Git

Confirm 89 unique register rows with the exact counts above and
`Phi_SR = 38`. Confirm the decision-record SHA-256 remains
`e7e5c0fb047e42e5852648972f7f57f5539708bf990d97fe597d000ad5ed5358`.
Commit atomically with a `Co-Authored-By` trailer, push only the feature branch,
verify it is clean and synchronized with
`github/design/endless-progression-owner-packet`, and do not merge PR #3.
