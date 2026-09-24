# Handoff — EP-D02 unique Soul Relic definitions selected

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 05:59:07
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.12, the primary value destination of an
otherwise-earned same-definition Soul Relic duplicate. The owner selected
C3c.11-A: one combatant collection may hold at most one instance per stable
Relic definition. Preserve accepted EP-D02 until a complete replacement is
replayed and explicitly accepted. Do not implement.

## Selected direction

A legal combatant collection contains at most one Soul Relic instance for each
stable `relicDefinitionId`. An operation that would create a second holding
cannot commit that illegal result. The one permitted holding remains a discrete
instance under C3c.7-A, but this direction selects no duplicate-award outcome,
rolls, evolution, salvage, transfer, loss, or migration.

## Sole active choice

EP-D02-C3c.12 asks where a validly earned duplicate award sends its primary
value:

- **A, recommended:** substitute an otherwise-eligible unowned Relic from the
  declared pool; a later fallback handles a complete pool;
- **B:** commit one idempotent bounded-progression receipt to the incumbent and
  later define the infusion track and capped-state fallback;
- **C:** convert into a new fungible Relic currency with no combat rule by
  itself, then separately design its amounts, bounds, and sinks.

A preserves singular artifacts and catalog discovery without opening a
duplicate-power or currency grind. B opens a bounded infusion subtree. C opens
a currency/economy subtree. Substitute selection, terminal/capped fallbacks,
progression content, currency tuning, acquisition sources/rates, custody,
transfer, loss, migration, Charm duplicates, and release remain open. A narrow
read-only verifier passed the card as prerequisite-correct, mutually exclusive,
and atomic.

## Verification and preserved state

`git diff --check` passed before this handoff. No code tests were run because
the change is documentation-only. The authoritative decision record, system
design, and readiness record remain unchanged. EP-D01, EP-D02, and EP-D07
remain accepted; EP-D04 directions remain unaccepted, R9.4 remains reopened,
R10.1-A and R10.2-A remain selected, and R10.3-R10.8 remain pending. No runtime,
capture, evidence, installation, save, or snapshot was touched.
