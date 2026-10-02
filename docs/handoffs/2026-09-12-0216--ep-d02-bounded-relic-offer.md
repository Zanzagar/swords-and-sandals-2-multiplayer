# Handoff — bounded duplicate-Relic offer selected

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 06:16:25
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.15, the fixed size of every duplicate-substitute
offer. The owner selected C3c.14-B: the player receives one uniform bounded
subset rather than the complete eligible-unowned pool or source-specific
breadth. Preserve accepted EP-D02 until a complete replacement is replayed and
explicitly accepted. Do not implement.

## Selected direction

One later-selected fixed `offerSize >= 2` applies to every
duplicate-substitute event. If fewer candidates remain, all are presented; if
more remain, exactly `offerSize` distinct definitions are presented under a
later sampling rule. The complete design must contain at least one reachable
pool larger than that size or the bounded rule collapses to complete-pool
choice. The selection fixes no integer, sampling, order, or weight.

## Sole active choice

EP-D02-C3c.15 fixes `offerSize`:

- **A:** two candidates;
- **B, recommended:** three candidates;
- **C:** four candidates.

Three is the recommended middle: a meaningful choice and useful recovery from
an unattractive sampled candidate without making modest pools nearly direct-
target catalogs. Two is leaner and preserves more discovery pressure; four
offers more agency but erodes rarity fastest. Sampling/ordering, weights,
algorithm/seed, terminal fallback, timeout/default, acquisition source/cadence,
custody, transfer, loss, migration, Charm duplicates, and release remain open.
A narrow read-only audit passed the card as atomic and prerequisite-correct.

## Verification and preserved state

`git diff --check` passed before this handoff. No code tests were run because
the change is documentation-only. The authoritative decision record, system
design, and readiness record remain unchanged. EP-D01, EP-D02, and EP-D07
remain accepted; EP-D04 directions remain unaccepted, R9.4 remains reopened,
R10.1-A and R10.2-A remain selected, and R10.3-R10.8 remain pending. No runtime,
capture, evidence, installation, save, or snapshot was touched.
