# Handoff — mixed pair-completeness selected; rotation overlap next

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-15 05:51:29
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.64, none/some/all prevalence of wholly disjoint
singleton-anchor sets among actual unequal-set multi-anchor Soul-pair
rotations. The owner selected C3c.63-B. Preserve the accepted EP-D02 wording
until a complete replacement is replayed and explicitly accepted. Do not
implement.

## Standalone-game north star

The intended standalone name remains **Souls and Simulacra**. Use it as a
thematic-coherence lens while completing the current full-assurance pass over
the SS2-derived skeleton; do not let it silently decide mechanics. Expansion,
audit, and engine adaptation begin only after the complete design-framework
pass. Vanilla evidence and the byte-identical measurement oracle remain in
their existing SS2 lane.

## Selected direction

Retain

`∅ ⊂ R_{pair,v} ⊂ R_{multi,v}`,

where `R_{pair,v}` contains the multi-anchor exact keys whose map
`s -> I_v(b,s)` is injective across every supported Soul. At least one multi-
anchor exact key gives every supported Soul a distinct equal-count singleton-
label set. At least one other multi-anchor key has both an unequal Soul pair
and a distinct equal-map pair. C3c.62-B still makes every multi-anchor key
variable somewhere. C3c.43-A still requires material predicate response when
two Souls share one exact singleton projection.

C63-B derives `|S_v|>=3` and `|R_{multi,v}|>=2`. Any required pair-complete key
with total degree `d` and singleton count `k` must encode `|S_v|` distinct
size-`k` subsets, so `|S_v|<=binom(d,k)<=20` in the six-cell model. It does not
select the exact Soul equivalence classes, label overlap, common anchors,
predicate semantics, disclosure, power, or live rebinding.

## Ternary frontier

Let

`E^Delta_v={(b,{s_1,s_2}) : b in R_{multi,v}, {s_1,s_2} in D_v(b)}`

be the nonempty domain of actual unequal-set Soul-pair comparisons, and let

`Z_v={(b,{s_1,s_2}) in E^Delta_v : I_v(b,s_1) intersect I_v(b,s_2)=empty}`.

Equal-map pairs on affinity-preserving keys are not rotations and remain
outside the denominator. C3c.64 asks only whether complete anchor-set
replacement occurs nowhere, somewhere, or everywhere:

- **A, recommended — no disjoint rotations:** `Z_v` is empty. Every actual
  unequal-set rotation retains at least one singleton-backed label.
- **B — mixed overlap:** `Z_v` is nonempty and proper. At least one actual
  rotation is disjoint and at least one retains an anchor.
- **C — universal disjointness:** `Z_v=E^Delta_v`. Every actual changed pair
  completely replaces its singleton-anchor set; equal-map affinity pairs
  remain permitted.

A gives universal continuity: the Soul recomposes a Relic without erasing
every independently attributable behavior the player learned from it. It does
not require one anchor common to every Soul. Three size-two sets `{a,b}`,
`{b,c}`, and `{a,c}` overlap pairwise while having empty three-way
intersection. B permits rare total metamorphosis but adds another authored and
communicated distinction. C creates the sharpest Soul authorship but becomes
structurally rigid.

Any disjoint rotation derives `2k<=d<=6`, so its key has `k<=3`. Under C,
C63-B's pair-complete key must hold at least three pairwise-disjoint size-`k`
sets. Therefore `3k<=d<=6`; since `k>=2`, C forces exactly three supported
Souls and makes every pair-complete witness a count-two, degree-six key. This
is a consequence, not a separate roster choice.

A complete example for A is pair-complete Dreamglass with
`I_F={S/action,X/action}`, `I_S={S/build,X/action}`, and
`I_V={S/action,S/build}`. Every pair differs and retains one label, but no
label is common to all three Souls. For B, pair-complete Ashen can use
`I_F={H/action,H/build}`, `I_S={S/build,X/action}`, and
`I_V={H/action,S/build}`: `{F,S}` is disjoint while the other two pairs overlap.
For C, a pair-complete six-cell Prism partitions its anchors into the history,
state, and cross-form pairs for `F`, `S`, and `V`; every pair is disjoint.

Proof of overlap needs one exact label with a valid singleton package on both
sides. Proof of disjointness needs complete exact `I_v` enumeration on both
sides; failed search for a common label is unresolved. None of the choices
selects usefulness, visibility, frequency, or power. A shared obscure anchor
can tokenize A, just as a reskinned total swap can tokenize C.

Common-core topology follows C64 when applicable. Definition/instance/state/
boundary ownership, common Soul behavior across Relics, predicates, packages,
contexts, routes, disclosure, ease, power, live rebinding, acquisition,
persistence, release, and implementation remain open.

## Preserved state

The owner packet, living head, rigor audit, SVG, and this handoff record C3c.63-
B and identify C3c.64 as the sole active owner choice. The authoritative
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
library, the newest-handoff lookup resolved to this file, no stale C3c.63 active
pointer remained in the living records, and a direct enumeration confirmed
that three Souls with two anchors each is the only pairwise-disjoint case under
the six-cell ceiling.
