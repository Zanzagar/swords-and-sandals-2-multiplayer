# Handoff — mixed common cores selected; joint-class breadth next

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-15 06:01:35
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.66, whether exactly two, three, or all four joint
classes of pair-completeness and all-Soul common-core status must occur among
multi-anchor exact Relic keys. The owner selected C3c.65-B. Preserve the
accepted EP-D02 wording until a complete replacement is replayed and
explicitly accepted. Do not implement.

## Standalone-game north star

The intended standalone name remains **Souls and Simulacra**. Use it as a
thematic-coherence lens while completing the current full-assurance pass over
the SS2-derived skeleton; do not let it silently decide mechanics. Expansion,
audit, and engine adaptation begin only after the complete design-framework
pass. Vanilla evidence and the byte-identical measurement oracle remain in
their existing SS2 lane.

## Selected direction

Retain `∅ ⊂ R_{core,v} ⊂ R_{multi,v}`. At least one multi-anchor exact key has
an all-Soul singleton core and at least one other has pairwise-overlapping maps
whose total intersection is empty. Every key remains Soul-variable under C62-B,
some but not all keys are pair-complete under C63-B, and every actual rotation
retains an anchor under C64-A.

C65-B creates both identity-spine and relational-cycle Relics without aligning
them to the pair-complete and affinity classes. It adds no global roster bound
beyond C63-B's `3<=|S_v|<=20`: the required pair-complete key may be coreless.
Core size, exact labels, class alignment, disclosure, power, and live rebinding
remain open.

## Ternary frontier

Write the two selected binary classifications as:

- `P` pair-complete versus `A` affinity-preserving;
- `C` core-bearing versus `N` coreless.

Let `J_v` be the occupied cells of `{P,A} x {C,N}`. Both row and column
projections are full under C63-B and C65-B, so the only possible support sizes
are two, three, and four:

```text
                         CORE-BEARING   CORELESS
PAIR-COMPLETE                 P,C          P,N
AFFINITY-PRESERVING           A,C          A,N

A: exactly one diagonal        2 occupied cells
B: any one cell absent         3 occupied cells
C: full matrix                 4 occupied cells
```

- **A, recommended — exactly two joint classes:** full marginal coverage
  forces one diagonal, either `{(P,C),(A,N)}` or `{(P,N),(A,C)}`. Core status
  and pair-completeness become one two-archetype taxonomy. The diagonal's
  orientation is the next decision.
- **B — exactly three joint classes:** one joint cell is absent. One marginal
  class supports both core structures while the other supports only one. The
  missing cell is the next decision.
- **C — all four joint classes:** every combination exists. The axes remain
  independently represented at catalog-support level; this says nothing about
  equal frequency.

A compresses two abstract binary axes into two teachable Relic archetypes and
requires only the two multi-anchor keys already forced by the parents. Its cost
is hard correlation: the excluded off-diagonal combinations cannot later be
authored without reopening the rule. B provides controlled crossing, but its
three-class asymmetry may be harder to explain than either extreme and needs at
least three keys. C provides maximum variety but needs at least four keys and
four combinations to author, validate, and teach.

The A diagonals have different constraints. `{(P,N),(A,C)}` works with three
Souls and retains the existing at-most-twenty bound. `{(P,C),(A,N)}` requires
at least four Souls because of `(A,N)` and caps the roster at ten because of
`(P,C)`. B's bounds depend on its later missing-cell choice. C contains both
constraining cells and therefore derives `4<=|S_v|<=10`, plus at least four
multi-anchor exact keys.

One A example is a coreless pair-complete Dreamglass plus a core-bearing
affinity Ashen. The inverse diagonal—a core-bearing pair-complete Prism plus a
coreless affinity Veil—is also valid and deliberately unselected. A B example
adds affinity/coreless Veil to the first pair while omitting pair-complete/core-
bearing. C requires all four examples.

A/B/C are exhaustive: both nonempty marginals exclude support sizes below two,
and the Cartesian product has four cells. Two occupied cells must form a
diagonal; three leave exactly one cell absent; four fill the matrix. Proof of an
occupied cell needs one exact key completely classified across every supported
Soul on both axes. Failed search is not proof that a cell is absent.

This card selects only joint support breadth. It does not select diagonal
orientation, a missing cell, per-cell prevalence, core size or labels, common
Soul behavior across Relics, definition/instance/state/boundary ownership,
predicates, packages, contexts, routes, disclosure, ease, frequency, power,
live rebinding, acquisition, persistence, release, or implementation.

## Preserved state

The owner packet, living head, rigor audit, SVG, and this handoff record C3c.65-
B and identify C3c.66 as the sole active owner choice. The authoritative
decision record and normative system design remain unchanged. EP-D01, EP-D02,
and EP-D07 remain accepted; EP-D04 directions remain unaccepted, R9.4 remains
reopened, R10.1-A and R10.2-A remain selected, and R10.3-R10.8 remain pending.

No code tests were run because this was documentation and vector work only. No
runtime, capture, evidence, installation, save, snapshot, or implementation was
touched. Preserve the user's existing change to
`.agents/skills/ss2-progression-design/SKILL.md`.

`git diff --check` passed. No-index whitespace checks for the untracked rigor
audit, SVG, and this handoff returned the expected different-from-`/dev/null`
status with no diagnostic output. The SVG parsed through Python's standard XML
library, the newest-handoff lookup resolved to this file, and no stale C3c.65
active pointer remained in the living records. Direct enumeration of the 2x2
joint-support lattice confirmed that full row and column projections permit
only support sizes two, three, and four, with exactly two possible two-cell
supports and both diagonal.
