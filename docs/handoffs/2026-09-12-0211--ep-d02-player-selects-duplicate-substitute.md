# Handoff — player selects duplicate Relic substitute

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 06:11:32
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.14, duplicate-substitute offer-breadth topology.
The owner selected corrected C3c.13-B: whenever at least two eligible-unowned
candidates are presented, the receiving combatant's player makes the final
selection. Preserve accepted EP-D02 until a complete replacement is replayed
and explicitly accepted. Do not implement.

## Selected direction

The system cannot override the player's final choice from a committed
multi-candidate substitute offer. A one-candidate offer resolves automatically.
The complete design must contain at least one reachable two-candidate case so
the authority is materially functional. Candidate breadth, construction,
sampling, ordering, and weighting remain open.

## Sole active choice

EP-D02-C3c.14 asks only how broad the presented candidate set is:

- **A:** every eligible-unowned definition in the original declared pool;
- **B, recommended:** one uniform bounded subset, with exact size `>=2` and
  sampling decided later;
- **C:** each reward source statically declares complete-pool or bounded-subset
  breadth, with both kinds reachable and bounded sizes later.

B preserves a meaningful player choice without turning duplicate protection
into a full-pool vending screen. It costs later size and sampling choices plus
committed-offer state. Exact size, sampling/ordering, weights, algorithm/seed,
terminal fallback, timeout/default, acquisition source/cadence, custody,
transfer, loss, migration, Charm duplicates, and release remain open. A narrow
read-only audit passed the card as atomic and prerequisite-correct; it confirmed
that `offerSize >= 2` follows from the selected non-vacuous player authority
rather than selecting the exact number.

## Verification and preserved state

`git diff --check` passed before this handoff. No code tests were run because
the change is documentation-only. The authoritative decision record, system
design, and readiness record remain unchanged. EP-D01, EP-D02, and EP-D07
remain accepted; EP-D04 directions remain unaccepted, R9.4 remains reopened,
R10.1-A and R10.2-A remain selected, and R10.3-R10.8 remain pending. No runtime,
capture, evidence, installation, save, or snapshot was touched.
