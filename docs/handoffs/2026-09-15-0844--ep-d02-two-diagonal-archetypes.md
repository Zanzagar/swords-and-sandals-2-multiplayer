# Handoff — two joint archetypes selected; diagonal orientation next

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-15 08:44:13
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.67, the orientation of C3c.66-A's selected two-
cell diagonal. The owner selected C3c.66-A: exactly two joint classes of pair-
completeness and all-Soul common-core status occur among multi-anchor exact
Relic keys. Preserve the accepted EP-D02 wording until a complete replacement
is replayed and explicitly accepted. Do not implement.

## Standalone-game north star

The intended standalone name remains **Souls and Simulacra**. Use it as a
thematic-coherence lens while completing the current full-assurance pass over
the SS2-derived skeleton; do not let it silently decide mechanics. Expansion,
audit, and engine adaptation begin only after the complete design-framework
pass. Vanilla evidence and the byte-identical measurement oracle remain in
their existing SS2 lane.

## Selected direction

Let `P/A` mean pair-complete versus affinity-preserving and `C/N` mean core-
bearing versus coreless. Both marginals are nonempty under C63-B and C65-B.
C66-A fixes `|J_v|=2`, so full marginal coverage forces exactly one diagonal:

`J_v={(P,N),(A,C)}` or `J_v={(P,C),(A,N)}`.

This creates exactly two correlated multi-anchor structural archetypes. It
does not select which diagonal, per-class prevalence, labels, core size,
visibility, gameplay value, or power. The authoritative decision record and
normative system design remain unchanged.

## Codex bound correction

The earlier living notes and frozen 0601 handoff retained C63-B's loose bound
`|S_v|<=20` after C64-A. That was wrong as a statement of current selected
state. C64-A makes the distinct equal-size maps on the required pair-complete
key pairwise intersecting inside at most six labels. The maximum family sizes
over the permitted `d<=6` and multi-anchor `k>=2` cases are bounded by fifteen;
all fifteen four-of-six subsets attain the maximum and have empty total
intersection. Thus the current parents imply `3<=|S_v|<=15`.

The correction is recorded at C64's live instruction in the owner packet,
living head, and rigor audit. Frozen earlier handoffs remain unchanged as
historical session records and are superseded only on this bound. A narrow
read-only verifier independently re-derived the two diagonals, all four card
examples, and B's bounds, and identified this sole flaw before C67 was
presented.

## Binary frontier

```text
                         CORE-BEARING   CORELESS
A  PAIR-COMPLETE               ·           ●
   AFFINITY-PRESERVING         ●           ·

B  PAIR-COMPLETE               ●           ·
   AFFINITY-PRESERVING         ·           ●
```

- **A, recommended — coreless prisms, rooted affinities:**
  `J_v={(P,N),(A,C)}`. Every pair-complete key is coreless, while every
  affinity-preserving key has a common core. The Relics that distinguish every
  Soul become relational refractions with no permanently correct anchor;
  Relics that let Souls share maps retain an intelligible common spine. This
  fits *Souls and Simulacra*, works with three Souls, and permits as many as
  fifteen. It forbids both rooted pair-complete and coreless affinity Relics,
  and its coreless prisms require strong teaching.
- **B — rooted prisms, coreless affinities:**
  `J_v={(P,C),(A,N)}`. Every pair-complete key has a common core, while every
  affinity-preserving key is coreless. Universal Soul distinction therefore
  keeps a readable signature; affinities are local cycles rather than one
  roster-wide motif. This can be stranger and discovery-heavy, but the
  thematic inversion is harder to explain and it derives
  `4<=|S_v|<=10`.

Concrete A catalog for Souls `F/S/V`:

- `(P,N)` Dreamglass:
  `I_F={S/action,X/action}`, `I_S={S/build,X/action}`,
  `I_V={S/action,S/build}`. All maps differ and overlap pairwise, but the total
  intersection is empty.
- `(A,C)` Ashen:
  `I_F=I_V={H/action,X/action}`, `I_S={H/action,H/build}`. One Soul pair shares
  a map, another differs, and `H/action` belongs to every map.

Concrete B catalog for Souls `F/S/V/W`:

- `(P,C)` Prism uses `{H/action,S/action}`, `{H/action,S/build}`,
  `{H/action,X/action}`, and `{H/action,X/build}`. All four maps differ and
  share `H/action`.
- `(A,N)` Veil uses `I_F=I_V={S/action,X/action}`,
  `I_S={X/action,S/build}`, and `I_W={S/action,S/build}`. It has an equal pair,
  all distinct maps overlap pairwise, and their total intersection is empty.

A/B are exhaustive: a two-cell subset of a two-by-two product with both row
and column projections full must be one of its two diagonals. To prove an
orientation, completely classify every multi-anchor exact key on both axes,
show a witness for each occupied cell, and prove both excluded cells empty.
Failed search cannot prove absence.

This card selects only diagonal orientation. It does not select per-class
prevalence, exact core size or labels, common Soul partitions across Relics,
definition/instance/state/boundary ownership, predicates, packages, contexts,
routes, disclosure, ease, frequency, power, live rebinding, acquisition,
persistence, release, or implementation.

## Preserved state

The owner packet, living head, rigor audit, SVG, and this handoff record C3c.66-
A and identify C3c.67 as the sole active owner choice. EP-D01, EP-D02, and EP-
D07 remain accepted; EP-D04 directions remain unaccepted, R9.4 remains
reopened, R10.1-A and R10.2-A remain selected, and R10.3-R10.8 remain pending.

No code tests were run because this was documentation and vector work only. No
runtime, capture, evidence, installation, save, snapshot, or implementation was
touched. Preserve the user's existing change to
`.agents/skills/ss2-progression-design/SKILL.md`.

`git diff --check` passed. No-index whitespace checks for the untracked rigor
audit, SVG, and this handoff returned the expected different-from-`/dev/null`
status with no diagnostic output. The SVG parsed as XML, the newest-handoff
lookup resolved to this file, and a current-record scan found C66-A selected
and only C67 active. A direct finite enumeration confirmed the maximum fifteen
pairwise-intersecting uniform subsets in the six-label palette and maximum ten
when a nonempty common core is required.
