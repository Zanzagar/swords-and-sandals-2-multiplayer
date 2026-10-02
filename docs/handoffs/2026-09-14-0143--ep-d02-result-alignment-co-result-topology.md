# Handoff — result identity aligned; co-result topology next

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-14 01:43:49
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.45, aligned positive-result co-occurrence topology
in `E+`. The owner selected C3c.44-A. Preserve the accepted EP-D02 wording
until a complete replacement is replayed and explicitly accepted. Do not
implement.

## Selected direction

C3c.44-A requires exact alignment of the player-semantic and material
pre-payoff consumer result partitions for every legal operative input context:
`~L=~C`. Two reachable final-input states are separately meaningful to the
player if and only if an authorized pre-payoff consumer can distinguish them
materially.

A player distinction must be truthfully learnable. A consumer distinction must
have a reachable material downstream transition under at least one later-legal
payoff mapping. Raw labels, IDs, dead rows, unused slots, and incomplete
analysis create no distinction. Payoff-only Charms and payoff rules may map
existing input-result classes to consequences but may neither refine nor
coarsen that upstream partition.

C3c.44-A permits one aggregate result or several aligned results and selects no
count, exact payoff, input or payoff arbitration, or live progress UI.
C3c.42/C3c.43 remain predicate-portfolio rules and are not retroactively
strengthened. This is a direction, not a complete accepted EP-D02 replacement,
and changes no authoritative wording.

## Corrected frontier result

A narrow read-only audit found that C3c.44-A's common equivalence partition
still has no canonical Boolean factorization. The aligned states `none`,
`P-only`, `Q-only`, and `P+Q` can be represented by one categorical receipt at
a time or by the atomic receipt sets `{}`, `{P}`, `{Q}`, and `{P,Q}`. These
preserve the same state partition but differ materially in whether two results
survive together.

The first post-C3c.44 channel-count draft would therefore still have been
representation-dependent. C3c.45 repairs this by making the complete authored
semantic receipt family part of the product contract before classifying
co-occurrence. An evaluator cannot satisfy the topology by changing Boolean
basis, exposing a dormant bit, inventing a complement, selecting a favorable
subset, or duplicating one co-occurring receipt under two IDs.

## Sole active choice

For a fixed legal operative context `h`, retain C3c.44's reachable state domain
`Y_h` and common equivalence `~`. The completed design declares a closed,
versioned, complete family `J_h` of aligned positive-input-result receipts and
an occurrence map `a_h: Y_h -> 2^{J_h}` before payoff mapping.

- Receipt-set equality must induce exactly `~`.
- Every receipt is a positive authored relationship-result occurrence with at
  least one reachable occurrence and one reachable non-occurrence in the same
  `Y_h`, plus C3c.44's truthful player meaning and material consumer witness.
- Distinct receipts need a reachable state containing exactly one of the pair;
  extensionally co-occurring aliases collapse. A real nested or aggregate
  receipt can count only as an independently authored semantic feature meeting
  all obligations, not as an evaluator recoding. Its co-occurrence then counts
  even when the identities are nested; this card requires no independent-axis
  four-corner witness.
- One co-result witness holds the combatant, Bound Soul, exact Relic
  realization, input Charm or empty lane, source configuration, evaluation
  boundary, and version fixed. Alternate contexts or times cannot be unioned.

Let nonempty `H+` contain the contexts with at least one such nonconstant
positive receipt. Let `M` contain the contexts with a reachable state in which
`|a_h(y)| >= 2`.

- **A — universal no-co-result:** `M` is empty. Every resolution emits at most
  one positive receipt, but one context may still have several mutually
  exclusive result identities. This is the clearest and safest contract but
  forbids simultaneous relationship-completion builds.
- **B — universal co-result capability:** `M=H+`. Every positive context has at
  least one reachable state emitting two or more distinct receipts. This gives
  every context a coordination ceiling but forces even simple anchors to carry
  multi-result authoring, presentation, payoff-access, and test burden.
- **C, recommended — mixed co-result capability:** `M` is a nonempty proper
  subset of `H+`. At least one focused context never co-emits, and at least one
  advanced context has a real co-result witness. This enables selected
  coordinated mastery windows without making every Relic a result dashboard.
  Its strongest degeneration is co-result jackpot dominance: co-result-capable
  realizations may gain more uptime, burst, choice value, or future payoff
  access and become hidden premium rolls.

Illustratively, an Ashen context can expose only `P`, or several receipts that
are always mutually exclusive. A distinct Dreamglass context can admit one
same-boundary trace in which separate source pairs complete
`P = bearer Guard -> ally Heat` and `Q = bearer Feint -> ally Strike` and emit
`{P,Q}`. This assumes no unresolved source reuse and selects no exact content.

A/B/C are exhaustive over nonempty `H+`. C itself requires at least two
positive contexts. A does not mean one receipt identity, and B does not mean
every evaluation co-emits. The card fixes only the outcome topology: exact
maximum, identities, distribution, cause of exclusivity/overlap, source/event
reuse, input resolution rules outside the derived bounds, progress UI, and all
payoff mapping/arbitration remain later. Transformation/precedence, cross-cell
instance footprints, authoring/lineage and base-grammar ownership, additional
operability, `E0`, content, acquisition, configuration horizon, migration,
validation, release, and implementation also remain open.

## Preserved state

The owner packet, living head, rigor audit, SVG, and this handoff record
C3c.44-A and identify C3c.45 as the sole active choice. The authoritative
decision record and normative system design remain unchanged. EP-D01, EP-D02,
and EP-D07 remain accepted; EP-D04 directions remain unaccepted, R9.4 remains
reopened, R10.1-A and R10.2-A remain selected, and R10.3-R10.8 remain pending.
No code tests were run because this is documentation and vector work only. No
runtime, capture, evidence, installation, save, or snapshot was touched.
Preserve the user's existing change to
`.agents/skills/ss2-progression-design/SKILL.md`.

Three narrow read-only audits separated the factorization prerequisite,
topology proof, and product degeneration. The final contract repaired the
Boolean-recoding loophole, excludes constant and coextensive fake receipts,
preserves mutually exclusive categorical results, and makes A/B/C exhaustive
over nonempty `H+`. `git diff --check` passed. No-index whitespace checks for
the untracked rigor audit, SVG, and this handoff returned the expected
different-from-`/dev/null` status with no diagnostics. The SVG parsed through
Python's standard XML library, the newest handoff resolves to this file, and
the authoritative decision and system documents are clean.
