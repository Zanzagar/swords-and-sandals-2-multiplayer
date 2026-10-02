# Handoff — anchor count is Soul-stable; label-class participation next

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-15 03:46:10
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.60, which asks whether zero, exactly one, or both
of the already-nonempty one-anchor and multi-anchor classes admit equal-count
singleton-label rotation under Bound-Soul substitution. The owner selected
C3c.59-A. Preserve the accepted EP-D02 wording until a complete replacement is
replayed and explicitly accepted. Do not implement.

## Selected direction

Reuse the nonempty C3c.58-A classes

`R_{multi,v}={b in R_v* : Q_v(b)=S_v}`

and

`R_{one,v}={b in R_v* : Q_v(b) is empty}`.

For `I_v(b,s)=I_v((b,s))`, C3c.59-A makes

`V^k_{S,v}={b in R_{multi,v} : some s_1,s_2 have |I_v(b,s_1)| != |I_v(b,s_2)|}`

empty. Every fixed multi-anchor exact realization therefore has one count
`k_v(b)>=2` under all supported Souls; every one-anchor key is fixed at count
one. Different exact keys may have different counts.

Together with C3c.57-A and C3c.58-A, each fixed exact realization now has a
Soul-stable total cell palette `C_v(b)`, total degree `d_v(b)`, one-/multi-
anchor class, singleton count `k_v(b)`, and coupled-only count
`d_v(b)-k_v(b)`. Exact singleton labels may still rotate through equal-count
exchanges. C3c.43-A independently continues to require a material Soul-
responsive predicate witness for every operative realization. No route, tool,
ease, power, visibility, live rebinding, or implementation follows.

## Frontier audit

The naive next card classified one global exact-`I_v` variable set as empty,
proper, or full. Read-only review found that its proper branch would conflate
materially different catalogs: one-anchor-only rotation, multi-anchor-only
rotation, and rotation in both classes without universal per-key variation.

Two immediately separate per-class empty/proper/full cards were also considered.
That ordering would decide within-class prevalence before the higher product
question of which causal classes participate. The selected frontier therefore
uses a class projection first and leaves both class identity and prevalence as
later explicit owner decisions. One verifier preferred taking the one-anchor
distribution directly; the class-projection order was retained because it
avoids both conflation and a premature three-by-three prevalence grid.

For `t` in `{one,multi}`, define

`V^I_{t,S,v}={b in R_{t,v} : some s_1,s_2 have I_v(b,s_1) != I_v(b,s_2)}`

and

`K^I_{S,v}={t in {one,multi} : V^I_{t,S,v} is nonempty}`.

C3c.59-A makes every set change an equal-count exchange. Unequal finite sets of
equal cardinality have an even symmetric difference of at least two, so a
variable key moves at least one cell from singleton-backed to coupled-only and
another in the reverse direction. C3c.57-A keeps both cells in the total
footprint. This is not added breadth or capability count.

## Sole active choice

- **A — neither class rotates:** `K^I_{S,v}` is empty. Every exact key keeps the
  same singleton-label set across Souls. This is the clearest structural
  identity, but Bound Soul cannot change which cells are independently
  attributable at fixed `b`; Soul identity must live below this projection.
- **B, recommended — exactly one class rotates:** `|K^I_{S,v}|=1`. One class
  contains at least one variable key and the other is wholly stable. The next
  choice decides one-anchor versus multi-anchor; my likely recommendation is
  multi-anchor-only so the sole reference label of one-anchor keys remains
  stable. B does not select that identity. It balances one stable structural
  reference for later teaching with qualitative Soul texture, but adds a class-
  level rule and can be met by one obscure showcase swap unless later
  safeguards reject it.
- **C — both classes rotate:** `K^I_{S,v}={one,multi}`. Each class contains at
  least one variable key, but not necessarily every key. This gives the richest
  Soul-sensitive cell identity, at the cost of teaching both sole-label
  replacement and larger-set exchange with no wholly stable class.

A complete B multi-only example can use multi-anchor Ashen with common
`C={H/action,H/build,S/build,X/action,X/build}`, Firebound
`I={H/action,S/build,X/build}`, and Stonebound
`I={H/build,X/action,X/build}`. Both counts are three. One-anchor Dreamglass can
keep common `C={S/action,X/action}` and common `I={S/action}`. The catalog covers
all six singleton labels, contains both classes and an exact-two fiber, and has
coupled-only edges while preserving every C57–C59 stability rule. These names
and mappings are illustrative only.

Under B, the participating class identity is the immediate next card. Under B
or C, nonempty-proper versus full variable coverage is asked separately for
each participating class, one choice at a time. Under A those descendants
prune. No answer delegates them to implementation.

Proof requires complete exact-set classification at the fixed boundary. A
stable key needs all six membership results to match across every supported
Soul. B requires that stability for every key in its nonparticipating class,
not merely one example, plus a variable witness in its participating class. C
needs a variable witness in each class. Such a witness needs a positive
singleton package for a cell under one Soul and complete exclusion of such a
package under another; failed search is unresolved.

Multi-anchor rotation requires `d_v(b)>=k_v(b)+1>=3` and leaves at least one
coupled-only cell in every row of that variable key's Soul fiber. C therefore
forces total-degree nonregularity and a maximum of at least three beside the
inherited exact-two fiber. B does so only if its next class-identity choice
selects multi-anchor rotation. No option yet places the exact-two fiber in one
class, decides within-class prevalence, or creates a global package-width cap.

## Preserved state

The owner packet, living head, rigor audit, SVG, and this handoff record
C3c.59-A and identify C3c.60 as the sole active one-at-a-time owner card, with B
recommended. The authoritative decision record and normative system design
remain unchanged. EP-D01, EP-D02, and EP-D07 remain accepted; EP-D04 directions
remain unaccepted, R9.4 remains reopened, R10.1-A and R10.2-A remain selected,
and R10.3–R10.8 remain pending. Continue exactly one A/B/C choice per turn.

No code tests were run because this was documentation and vector work only. No
runtime, capture, evidence, installation, save, or snapshot was touched.
Preserve the user's existing change to
`.agents/skills/ss2-progression-design/SKILL.md`.
