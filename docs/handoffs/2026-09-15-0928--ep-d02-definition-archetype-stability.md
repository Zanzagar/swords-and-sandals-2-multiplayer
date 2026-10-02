# Handoff — single-core affinities selected; definition archetype stability next

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-15 09:28:00
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.69: whether a stable Relic definition that has
multi-anchor exact realizations must remain prism- or affinity-pure, whether
some such definitions may span both, or whether all must span both. The owner
selected C3c.68-A. Preserve the accepted EP-D02 wording until a complete
replacement is replayed and explicitly accepted. Do not implement.

## Standalone-game north star

The intended standalone name remains **Souls and Simulacra**. Use it as a
thematic-coherence lens while completing the current full-assurance pass over
the SS2-derived skeleton; do not let it silently decide mechanics. Expansion,
audit, and engine adaptation begin only after the complete design-framework
pass. Vanilla evidence and the byte-identical measurement oracle remain in
their existing SS2 lane.

## Selected direction

Every affinity-preserving multi-anchor exact Relic key has exactly one all-Soul
singleton core anchor. It still rotates at least one other singleton label, so
`1=g<k<d<=6`; compact two-singleton, three-cell affinities remain legal.
Pair-complete prisms remain coreless under C3c.67-A. The resulting contrast is
therefore a relational prism with no universal label versus an affinity with
one enduring motif. The supported-Soul range remains `3<=|S_v|<=15`.

C3c.68-A does not select the core label, definition-level stability, archetype
prevalence, disclosure, power, or implementation. The authoritative record
and normative system design remain unchanged.

## Frontier-order result

For each multi-anchor exact key `b`, let `def_v(b)` be its stable Relic
definition ID. Let `D_multi` contain definitions with at least one multi-anchor
exact realization, and let `D_dual` contain those whose same-definition exact
keys include both a coreless pair-complete prism `(P,N)` and a single-core
affinity `(A,C)`.

This definition-level atom precedes instance/state/boundary ownership. A dual
definition only proves that two legal same-definition exact keys exist; it does
not say why they differ, authorize transformation or live switching, or say
that both coexist at once. Definitions whose realizations are exclusively
one-anchor are outside C69.

## Ternary frontier

```text
A  Dreamglass definition  -> PRISM only
   Ashen definition       -> AFFINITY only

B  Dreamglass definition  -> PRISM only
   Eclipse definition     -> PRISM + AFFINITY

C  every multi definition -> PRISM + AFFINITY
```

- **A, recommended — every multi-support definition is archetype-pure:**
  `D_dual` is empty. Because both archetypes exist globally, at least one
  definition is prism-pure and a different definition is affinity-pure. A
  definition's name, art, and collection identity teach one stable
  multi-anchor Soul relationship, while its exact labels, predicates,
  packages, and power may still vary. The cost is no named metamorphic Relic
  crossing from prism to affinity. Whether the same definition may also have
  one-anchor exact keys remains separate.
- **B — mix pure and dual multi-support definitions:** `D_dual` is nonempty and
  proper. Stable identities coexist with rare metamorphic definitions. That is
  potentially exciting, but adds a second definition taxonomy and lets an
  obscure snapshot tokenize the dual promise. B requires at least two
  multi-support definitions and three multi-anchor exact keys.
- **C — every multi-support definition is dual-archetype:**
  `D_dual=D_multi`. Every definition with any multi-anchor realization has at
  least one prism key and at least one affinity key. This maximizes
  transformational possibility, but a Relic's name and art can no longer teach
  its multi-anchor archetype; a future instance/state/boundary matrix becomes
  mandatory rather than exceptional. Each multi-support definition needs at
  least two fully classified multi-anchor keys.

Concrete prism key `E1` for Souls `F/S/V` uses singleton maps `{a,b}`, `{b,c}`,
and `{a,c}`: every Soul pair differs, every pair overlaps, and no label belongs
to all three. Concrete affinity key `E2` uses `F=V={d,e}` and `S={d,f}`: `d` is
the sole all-Soul core and one Soul pair shares a map. Under B, Eclipse may own
both `E1` and `E2` while Dreamglass stays prism-pure. Under C, every definition
in `D_multi` must own an `E1`-like key and an `E2`-like key. Calling those keys
dormant and awakened would require a later state rule.

A/B/C are exhaustive because `D_dual` is empty, a nonempty proper subset of
nonempty `D_multi`, or all of it. More generally,
`|R_multi|>=|D_multi|+|D_dual|`. With the inherited nonempty one-anchor exact
class, A requires at least three total operative exact keys, B at least four,
and C at least three. Every choice retains `3<=|S_v|<=15`.

Proving purity requires exhaustive classification of every permitted
same-definition multi-anchor realization across instance, input-affecting
state, and evaluation boundary; failure to find a counterexample is not proof.
Proving duality requires two fully classified same-definition witnesses, one
`(P,N)` and one single-core `(A,C)`. Neither result proves ease, frequency,
visibility, utility, or power.

This card selects only empty/proper/full prevalence of definitions spanning
both selected multi-anchor archetypes. It does not classify one-anchor-only
definitions, decide whether a definition may mix one- and multi-anchor keys,
select the cause of same-definition variation, authorize transformation,
choose labels or common Soul partitions, set catalog prevalence, or select
predicates, packages, contexts, routes, disclosure, ease, frequency, power,
live rebinding, acquisition, persistence, release, or implementation.

## Preserved state

The owner packet, living head, rigor audit, SVG, and this handoff record C3c.68-
A and identify C3c.69 as the sole active owner choice. EP-D01, EP-D02, and EP-
D07 remain accepted; EP-D04 directions remain unaccepted, R9.4 remains
reopened, R10.1-A and R10.2-A remain selected, and R10.3-R10.8 remain pending.

No code tests were run because this was documentation and vector work only. No
runtime, capture, evidence, installation, save, snapshot, or implementation was
touched. Preserve the user's existing change to
`.agents/skills/ss2-progression-design/SKILL.md`.

A narrow read-only verifier confirmed C69's prerequisite readiness,
exhaustiveness, feasibility, examples, and structural lower bounds after
catching and correcting one scope ambiguity: the pure/dual classification
applies only to definitions in `D_multi`, not definitions supported exclusively
by one-anchor exact realizations. `git diff --check` passed. No-index whitespace
checks for the untracked rigor audit, SVG, and this handoff returned the expected
different-from-`/dev/null` status with no diagnostic output. The SVG parsed as
XML, executable assertions passed for the prism and affinity examples, the
newest-handoff lookup resolved to this file, and a current-record scan found
C68-A selected and only C69 active.
