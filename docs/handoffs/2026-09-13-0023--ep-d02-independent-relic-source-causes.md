# Handoff — independently attributable Relic source causes selected

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-13 04:23:27
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.34, independently attributable evidence-form
support. The owner selected C3c.33-A: every counted position in a basis-
sensitive Relic entry needs at least one independently isolatable combat cause.
Preserve the accepted EP-D02 wording until a complete replacement is replayed
and explicitly accepted. Do not implement.

## Selected direction

For every `p` in `P+`, at least one reachable legal pair with identical frozen
configuration and deterministic initialization must change `p`'s satisfaction
while a nonempty set of materially read coordinates inside occurrence history
(`H`) may differ and the read current-state projection/outside inputs stay
fixed, or symmetrically inside current state (`S`) while read history/outside
inputs stay fixed.

No isolation among coordinates inside the varied projection is required; the
selection chooses no fact, field, tuple, or source-atom boundary. A position
whose sole material path is an inseparable `H`+`S` package is invalid. Failure
to find an isolation pair in incomplete analysis is unresolved, not proof of
coupling or invariance. Additional coupled boundaries inside a position that
already has a valid independent path remain open. This is a direction, not a
complete accepted EP-D02 replacement, and changes no authoritative wording.

## Sole active choice

C3c.34 classifies only the catalog's **independently isolatable** evidence-form
support. `I_H(p)` and `I_S(p)` are the projection-level isolation witnesses
above. False requires a complete invariance proof; unresolved analysis passes no
option. C3c.33-A guarantees `I_H(p) or I_S(p)` for every `p`, so the support set
over `{H,S}` is nonempty.

- **A — independent occurrence-history support only:** every `P+` position has
  an independent `H` path and none has an independent `S` path. This produces
  the cleanest combo/history language but makes the basis-sensitive source
  grammar a history tracker and raises ordering, retention, replay, spam, and
  reuse pressure.
- **B — independent current-state support only:** every `P+` position has an
  independent `S` path and none has an independent `H` path. This supports live,
  disruptable battlefield formations but raises sampling/UI burden and risks
  warmed-up passive-state gameplay.
- **C, recommended — both independent forms materially supported:** at least
  one reachable, functional `I_H` witness and one `I_S` witness exist across
  `P+`; every position still has at least one. If one position supplies both,
  it needs two distinct isolation pairs. This supports both executed sequences
  and maintained tactical conditions, at the cost of two evidence languages
  and the largest validation surface.

A single transition emitting an occurrence and changing state proves neither
form without a valid projection-level isolation and never creates two source
atoms or fills two positions. Under A every position is independently history-
only; under B every position is independently state-only. Only C leaves the
per-position/per-entry distribution among history-only, state-only, and dual-
sensitive support open.

The support vector ignores additional coupled boundaries still deferred by
C3c.33-A. Mapping to pure action/build entries, basis-neutral positions, exact
event/state subtypes, fields, phases, evaluation/sampling boundary, windows,
source families, atoms, provenance, dormant visibility, arity, roles,
operators, reuse, Team Tactic/environment admission, payoff, UI,
compatibility, horizons, persistence, validation, and release remain open.

## Verification and preserved state

Two independent read-only audits pass after three exact repairs: isolation now
varies a nonempty coordinate set within one projection rather than silently
choosing a fact atom; A/B's universal composition consequences are explicit;
and every claim is limited to `P+`, leaving basis-neutral admission untouched.
The owner packet, living head, rigor audit, SVG, and this handoff agree that
C3c.33-A is selected and C3c.34 is the sole active choice.

`git diff --check` and SVG XML validation pass. The authoritative decision
record and normative system design remain unchanged. EP-D01, EP-D02, and EP-D07
remain accepted; EP-D04 directions remain unaccepted, R9.4 remains reopened,
R10.1-A and R10.2-A remain selected, and R10.3-R10.8 remain pending. No code
tests were run because this is documentation and vector work only. No runtime,
capture, evidence, installation, save, or snapshot was touched.
