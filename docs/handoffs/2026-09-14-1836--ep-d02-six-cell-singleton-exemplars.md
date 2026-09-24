# Handoff — every cell has a singleton exemplar; minimum pair breadth next

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-14 18:36:57
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.55, minimum total native-dual cell-footprint
breadth. The owner selected C3c.54-B. Preserve the accepted EP-D02 wording
until a complete replacement is replayed and explicitly accepted. Do not
implement.

## Selected direction

Let

`N_v={(p,c) in L_v : c in I_v(p)}`

contain the exact pair/cell edges backed by a valid singleton package. C3c.54-B
makes `N_v` a proper subset of `L_v` while keeping its cell projection equal to
all of `C6`. Every temporal-by-basis cell therefore has a singleton exemplar
for at least one supported Bound Soul/exact operative-Relic-realization pair,
while at least one other exact pair/cell edge is coupled-only. C3c.53-A still
gives every pair at least one singleton foothold.

The result necessarily creates singleton-status variation for the same cell
across two distinct exact pair keys: a coupled-only `(p,c)` has a different
pair `q` with singleton-backed `(q,c)`. It does not decide whether Soul identity,
exact Relic realization, or both own that variation. Coupled packages remain
legal even for singleton-backed edges.

The selection fixes no exact edge/cell map, number or distribution of
singleton or coupled-only edges, total or singleton degree, package size,
context/receipt lineage, disclosure, control, ease, frequency, power, payoff,
Charm behavior, access, acquisition, or implementation. This is a direction,
not a complete accepted EP-D02 replacement, and changes no authoritative
wording.

## Frontier result

Reuse `C_v(p)` and define

`d_v(p)=|C_v(p)|` and `m_v=min_{p in P_v} d_v(p)`.

C3c.52-B makes every exact-pair row nonempty and leaves at least one exact edge
absent. Therefore `m_v` is exactly one of `1,2,3,4,5`. All five values remain
feasible under C3c.53-A and C3c.54-B. Minimum total degree is the preferred next
outer support choice before the nested singleton-degree floor and Soul/exact-
realization substitution stability.

Cell degree does not count contexts, receipts, routes, independent tools, or
simultaneous capabilities. One coupled package can establish several cell
edges. An exact minimum of `k` requires at least `k` positive edges for every
pair, one exact-`k` row, and complete fixed-boundary absence proofs for that
row's other `6-k` cells. Every valid package for an exact-`k` row has width at
most `k`, but this creates no global package-size cap.

C3c.54-B supplies a coupled-only `(p,c)`, while C3c.53-A supplies a different
singleton-backed `(p,d)` in the same row. Thus some row already has degree at
least two, but the catalog minimum may still be one. Let
`n_v=min_{p in P_v}|I_v(p)|`. Since `I_v(p)` is contained in `C_v(p)` and every
`I_v(p)` is nonempty, `1<=n_v<=m_v`. Selecting `m_v=1` would consequently fix
`n_v=1`, make total degree nonregular, and force the exact maximum to be at
least two. Selecting `m_v=2` would leave `n_v` at one or two.

## Sole active choice

- **A — choose an exact one-cell minimum:** `m_v=1`. At least one exact pair
  supports only one native-dual cell, and that edge is singleton-backed. This
  preserves the sharpest specialization and lowest authoring floor but permits
  a structurally brittle/token one-cell pairing. The mandatory coupled-only
  edge occurs in another, broader row. A also derives `n_v=1` and nonregular
  total degree.
- **B, recommended — require two cells from every pair:** `m_v=2`. Every exact
  pair supports at least two distinct cells, and some pair supports exactly two.
  This is the smallest floor that rules out one-cell pairings while preserving
  strong specialization. Only one of those two edges must be singleton-backed;
  the other may exist solely through a coupled package. The costs are per-pair
  matrix authoring, premium-breadth pressure, and token second edges.
- **C — require at least three cells from every pair:** `3<=m_v<=5`. This gives
  each pair at least half of the six-cell vocabulary but increases authoring
  and homogenization pressure. C is not terminal: the next one-at-a-time card
  must choose the exact minimum of three, four, or five.

For B's illustration, Stonebound/Ashen `R17` can have
`C_v(p)={S/build,X/action}`. `{S/build}` has a singleton witness, while
`X/action` occurs only in a minimal `{S/build,X/action}` package. That is two
supported cell edges but only one singleton-backed edge; it does not establish
two independent routes. Other pairs supply the remaining singleton cell
exemplars required by C3c.54-B.

The cases are exhaustive at this node because they partition the five possible
exact minima into `{1}`, `{2}`, and `{3,4,5}`. C requires the named dependent
split so no exact breadth decision is hidden. An owner-written replacement may
state another explicit floor or bounded branching rule.

B's strongest token implementation could still give most pairs one common easy
singleton anchor plus a contrived coupled extension while one showcase pair
supplies the remaining global singleton exemplars. Exact distribution, mapping
stability, discoverable trigger quality, content quality, power, and player
policy remain later safeguards.

## Preserved state

The owner packet, living head, rigor audit, SVG, and this handoff record
C3c.54-B and identify C3c.55 as the sole active one-at-a-time owner card, with B
recommended. The authoritative decision record and normative system design
remain unchanged. EP-D01, EP-D02, and EP-D07 remain accepted; EP-D04 directions
remain unaccepted, R9.4 remains reopened, R10.1-A and R10.2-A remain selected,
and R10.3-R10.8 remain pending. Continue exactly one A/B/C choice per turn.

No code tests were run because this was documentation and vector work only. No
runtime, capture, evidence, installation, save, or snapshot was touched.
Preserve the user's existing change to
`.agents/skills/ss2-progression-design/SKILL.md`.

Three independent read-only audits checked the formal range and proof burdens,
frontier order, option tree, recommendation, examples, derived singleton-degree
and total-degree consequences, and mirror consistency. Review replaced an
unsupported “independently grounded route” phrase with “singleton-backed edge,”
made C's example leave additional edges unlisted, changed A's label from
“permit” to “choose,” and recorded that A derives `n_v=1` plus nonregular total
degree rather than deferring those consequences. Final mirror review also
replaced plural “selected edges” shorthand with the exact existential rule:
at least one exact pair/cell edge remains coupled-only.

`git diff --check` passed. No-index whitespace checks for the untracked rigor
audit, SVG, and this handoff returned the expected different-from-`/dev/null`
status with no diagnostics. The SVG parsed with Python's standard XML library,
this file resolved as the newest handoff, the stale-C3c.54-active-pointer scan
found none, and the authoritative decision and system documents are clean.
