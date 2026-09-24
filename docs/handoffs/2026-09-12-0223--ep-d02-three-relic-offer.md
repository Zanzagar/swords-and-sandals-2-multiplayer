# Handoff — three-candidate duplicate-Relic offer selected

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 06:23:51
**Branch:** `design/endless-progression-owner-packet`

Resume with only corrected EP-D02-C3c.16, the baseline sampling measure for a
three-candidate duplicate-substitute offer. The owner selected C3c.15-B: show
three distinct eligible-unowned definitions whenever at least three remain.
Preserve accepted EP-D02 until a complete replacement is replayed and
explicitly accepted. Do not implement.

## Selected direction

Every duplicate-substitute offer presents exactly three distinct candidates
when at least three remain. With two, both are presented; with one, it resolves
automatically. At least one reachable declared pool must contain four or more
eligible-unowned definitions so the bounded offer remains materially distinct
from complete-pool choice. Sampling, order, weight, and random algorithm remain
open.

## Corrected sole active choice

**Codex correction:** the first C3c.16 draft incorrectly made a personal-
history adjustment a peer to source-weighted and uniform baselines. A read-only
audit caught that the modifier could apply to either baseline and independently
creates state, scope, cap, and reset questions. That draft is withdrawn before
owner selection and chose nothing.

Corrected C3c.16 asks only which baseline measure forms the unordered set:

- **A, recommended:** every source preserves its later positive definition
  weights, with at least one materially nonuniform reachable source;
- **B:** every source gives each eligible three-definition subset equal
  probability;
- **C:** every source statically declares weighted or uniform sampling, with
  reachable witnesses of both.

A preserves source identity and rarity while the three-offer/player-choice
rules supply agency; it may repeatedly surface common or source-favored Relics.
Numeric weights, exact algorithms, PRNG/seed, ordering, any independent history
protection, terminal fallback, timeout/default, acquisition source/cadence,
custody, transfer, loss, migration, Charm duplicates, and release remain open.
A second narrow read-only audit passed the corrected card as atomic,
prerequisite-correct, and mathematically consistent.

## Verification and preserved state

`git diff --check` passed before this handoff. No code tests were run because
the change is documentation-only. The authoritative decision record, system
design, and readiness record remain unchanged. EP-D01, EP-D02, and EP-D07
remain accepted; EP-D04 directions remain unaccepted, R9.4 remains reopened,
R10.1-A and R10.2-A remain selected, and R10.3-R10.8 remain pending. No runtime,
capture, evidence, installation, save, or snapshot was touched.
