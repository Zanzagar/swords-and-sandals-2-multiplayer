# Handoff — source-weighted duplicate-Relic offers selected

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 06:32:27
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.17, whether a committed but unchosen Relic offer
changes later sampling for that combatant. The owner selected corrected
C3c.16-A: preserve the reward source's positive definition weights when forming
the three-candidate substitute set. Preserve accepted EP-D02 until a complete
replacement is replayed and explicitly accepted. Do not implement.

## Selected direction

Every reward source declares positive versioned Relic-definition weights. Its
duplicate-substitute offer follows those weights after conditioning on current
eligibility and unowned status. At least one reachable source must be materially
nonuniform so this does not collapse to uniform sampling. Numeric weights,
subset algorithm, PRNG/seed, display order, and history adjustment remain open.

The first C3c.16 draft was withdrawn before owner selection because it treated
presentation history as a peer baseline even though history can modify either a
weighted or uniform baseline. The corrected, audited card separated those
questions; the owner's A applies only to the baseline measure.

## Sole active choice

Corrected C3c.17 asks whether prior presented-but-unchosen candidates affect a
later offer for the same combatant:

- **A, recommended — no history adjustment:** previous presentations and
  declines never change later likelihood. This preserves source identity and
  avoids hidden pity state, but a heavily weighted declined Relic may recur.
- **B — soft history adjustment:** history must materially change relative
  likelihood in at least one reachable state, but every otherwise-eligible
  unowned definition always retains positive probability.
- **C — hard history exclusion permitted:** a later-defined rule may
  temporarily reduce a presented-but-unchosen definition to zero sampling
  eligibility in at least one reachable state, but must relax exclusions as
  needed to preserve C3c.15-B's three-candidate offer.

If B or C is selected, later choices must define which offers enter history,
the horizon, formula or exclusion priority, cap, reset, disclosure, and
migration. An owner replacement may instead use a visible blacklist or a
non-historical diversity rule. Numeric weights/algorithm, PRNG/seed, order,
terminal fallback, timeout/default, acquisition source/cadence, custody,
transfer, loss, Charm duplicates, and release remain later.

## Verification and preserved state

A narrow read-only audit first rejected the draft because B overlapped A and C
silently selected disclosure. Those defects were corrected before owner
presentation and recorded at the card. A second read-only audit passed the
corrected card as prerequisite-correct, atomic, mutually exclusive, and
consistent with the three-candidate floor. `git diff --check` passed before
this handoff. No code tests were run because the changes are documentation-only.

The authoritative decision record, system design, and readiness record remain
unchanged. EP-D01, EP-D02, and EP-D07 remain accepted; EP-D04 directions remain
unaccepted, R9.4 remains reopened, R10.1-A and R10.2-A remain selected, and
R10.3-R10.8 remain pending. No runtime, capture, evidence, installation, save,
or snapshot was touched.
