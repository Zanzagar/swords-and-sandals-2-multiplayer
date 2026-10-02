# Handoff — no duplicate-Relic offer history selected

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 06:35:30
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.18, the value destination of an otherwise-earned
Relic event when that reward source's eligible pool is complete. The owner
selected C3c.17-A: prior substitute presentations and declines never affect
later candidate likelihood. Preserve accepted EP-D02 until a complete
replacement is replayed and explicitly accepted. Do not implement.

## Selected direction

Every duplicate-substitute offer uses the source-weighted baseline conditioned
only on the receiving combatant's current eligible-unowned pool. A definition's
prior presentations or declines never alter its later likelihood. This creates
no sampling-relevant presentation-history state. Numeric weights, subset
algorithm, PRNG/seed, and display order remain open.

## Sole active choice

C3c.18 applies after C3c.11-A forbids a second same-definition holding and
C3c.12-A finds no eligible-unowned substitute in the source's declared pool:

- **A, recommended — source-local non-Relic reroute:** atomically resolve
  through a versioned, nonempty fallback in that source's existing non-Relic
  reward economy. This opens no Relic mastery or dedicated currency system.
- **B — bounded mastery:** commit one idempotent receipt to the owned instance
  of the originally selected definition. The finite track must contain a real
  authored change and later needs an ultimate capped-state fallback.
- **C — fungible Relic-surplus currency:** commit a versioned amount of a new
  personal currency with no direct combat rule and at least one real later
  sink; amounts, bounds, sinks, and capped-state treatment remain open.

A preserves true collection completion and source identity without beginning a
new power/economy grind, but post-completion Relic hits become less distinctive
and every source needs a satisfying deliverable fallback. An owner replacement
may use cosmetic-only mementos or player choice among disclosed destinations.
Exact fallback contents/equivalence, mastery content/cap, currency amounts and
sinks, acquisition sources/cadence, ordering, timeout/default, custody,
transfer, loss, Charm duplicates, migration, and release remain later.

## Verification and preserved state

A narrow read-only audit passed C3c.18 as prerequisite-correct, atomic,
mutually exclusive, non-vacuous, and consistent with idempotent settlement and
the prohibition on second Relic holdings. `git diff --check` passed before this
handoff. No code tests were run because the changes are documentation-only.

The authoritative decision record, system design, and readiness record remain
unchanged. EP-D01, EP-D02, and EP-D07 remain accepted; EP-D04 directions remain
unaccepted, R9.4 remains reopened, R10.1-A and R10.2-A remain selected, and
R10.3-R10.8 remain pending. No runtime, capture, evidence, installation, save,
or snapshot was touched.
