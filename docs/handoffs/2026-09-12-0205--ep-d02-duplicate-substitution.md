# Handoff — EP-D02 duplicate Relic substitution selected

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 06:05:48
**Branch:** `design/endless-progression-owner-packet`

Resume with only corrected EP-D02-C3c.13, final authority over a presented
Soul Relic duplicate-substitute candidate set. The owner selected C3c.12-A:
before its declared reward pool is complete, an otherwise-earned duplicate
must substitute an otherwise-eligible unowned Relic from that pool. Preserve
accepted EP-D02 until a complete replacement is replayed and explicitly
accepted. Do not implement.

## Selected direction

When an otherwise-earned reward selects a definition already in the receiving
combatant's collection and the declared pool contains an eligible unowned
definition, the committed Relic must be one of those unowned definitions. The
event creates no infusion receipt or Relic currency. If the pool is complete,
no Relic item commits and a later terminal-collection fallback must preserve
the reward's value. Exact substitute-selection authority remained open.

## Corrected sole active choice

**Codex correction:** the first C3c.13 draft bundled final authority with
full-versus-sampled candidate breadth, a fixed three-offer count, weighted
sampling, and a pool-size requirement. A read-only audit rejected it before
owner selection. It is withdrawn and selected nothing.

Corrected C3c.13 asks only who makes the final choice when at least two
eligible-unowned candidates are presented:

- **A:** the system always selects;
- **B, recommended:** the receiving player always selects;
- **C:** every reward source statically declares system or player authority,
  and the supported catalog contains a reachable source of each kind.

With one candidate, every option resolves automatically. B turns the duplicate
into a small agency moment while a later candidate-set decision can protect
rarity, but it adds persistent offer state and requires a later timeout/default
rule. Candidate breadth/construction, sampling, weights, draft size, automatic
algorithm, terminal fallback, timeout/default, acquisition source/cadence,
custody, transfer, loss, migration, Charm duplicates, and release remain open.
A second narrow read-only audit passed the corrected card as atomic and
prerequisite-correct.

## Verification and preserved state

`git diff --check` passed before this handoff. No code tests were run because
the change is documentation-only. The authoritative decision record, system
design, and readiness record remain unchanged. EP-D01, EP-D02, and EP-D07
remain accepted; EP-D04 directions remain unaccepted, R9.4 remains reopened,
R10.1-A and R10.2-A remain selected, and R10.3-R10.8 remain pending. No runtime,
capture, evidence, installation, save, or snapshot was touched.
