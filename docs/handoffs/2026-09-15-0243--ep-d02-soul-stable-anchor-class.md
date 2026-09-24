# Handoff — anchor class is Soul-stable; singleton count next

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-15 02:43:48
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.59, singleton-anchor-count stability under Bound-
Soul substitution. The owner selected C3c.58-A. Preserve the accepted EP-D02
wording until a complete replacement is replayed and explicitly accepted. Do
not implement.

## Selected direction

Reuse

`Q_v={p in P_v : |I_v(p)|>=2}`

and

`V^Q_{S,v}={b in R_v* : Q_v(b) is nonempty and Q_v(b) != S_v}`.

C3c.58-A makes `V^Q_{S,v}` empty. Every exact operative Relic realization `b`
is uniformly multi-anchor or uniformly one-anchor across every supported Soul.
C3c.56-B makes both classes nonempty. Write them as `R_multi` and `R_one`.
Then `Q_v=R_multi x S_v`, its complement in `P_v` is `R_one x S_v`, and every
pair over a one-anchor `b` has exactly `d_v(b)-1` coupled-only total edges.

C3c.57-A separately keeps each exact `b`'s total cell palette and total degree
stable across Souls. C3c.58-A does not fix exact singleton labels or, inside the
multi-anchor class, exact singleton count. An individual cell can still change
between singleton-backed and coupled-only without crossing the coarse class.
The inherited exact-total-degree-two fiber is uniformly multi-anchor or
uniformly one-anchor. C3c.43-A's separate per-realization Soul-response witness
remains required. This is a direction, not a complete accepted EP-D02
replacement, and authoritative wording remains unchanged.

## Frontier correction

The first candidate frontier jumped from coarse `Q_v` stability directly to
exact `I_v`-set stability. Read-only formal review caught that exact set equality
also forces count equality, whereas equal counts can conceal label swaps. Under
the owner's no-gloss standard, singleton count is a meaningful coarser product
choice and must come first.

For fixed version `v`, define

`R_{multi,v}={b in R_v* : Q_v(b)=S_v}`

and

`R_{one,v}={b in R_v* : Q_v(b) is empty}`.

Both are nonempty and partition `R_v*`. Write

`I_v(b,s)=I_v((b,s))`

and

`k_v(b,s)=|I_v(b,s)|`.

The one-anchor class is already count-stable at one. On the nonempty multi-
anchor class define

`V^k_{S,v}={b in R_{multi,v} : some s_1,s_2 in S_v have k_v(b,s_1) != k_v(b,s_2)}`.

Restricting the domain to `R_{multi,v}` keeps the full-variable option feasible
instead of letting the forced count-one class make it impossible. Count is the
number of distinct cell labels with existential singleton-package witnesses,
not routes, tools, simultaneous choices, reliable triggers, ease, or power.

## Sole active choice

- **A, recommended — every multi-anchor exact realization keeps one count
  across Souls:** `V^k_{S,v}` is empty. Each fixed multi-anchor `b` has one
  singleton-anchor count for every supported Soul. Different exact `b` keys
  may have different counts, and exact labels may rotate through equal-count
  swaps. This gives a stable structural amount of singleton-backed breadth
  without eliminating qualitative Soul behavior. Soul cannot expand or
  contract that amount at fixed `b`.
- **B — mix count-stable and count-variable multi-anchor realizations:**
  `V^k_{S,v}` is a nonempty proper subset of `R_{multi,v}`. At least one
  multi-anchor exact key changes count for some Soul pair and another remains
  count-stable. This permits selected quantitative Soul-sensitive structure,
  but creates an exact-instance/state/boundary taxonomy and requires at least
  two multi-anchor keys plus the already-required one-anchor key.
- **C — every multi-anchor exact realization changes count across Souls:**
  `V^k_{S,v}=R_{multi,v}`. Every multi-anchor exact key has some Soul pair with
  unequal counts; the witnessing Souls and counts may differ by key. One-
  anchor keys remain count one. This maximizes quantitative Soul sensitivity
  but creates a universal authoring/validation burden and pressure toward a
  hidden highest-count-Soul list without proving ease or power.

For A, exact Ashen `R17` can keep total
`{H/action,H/build,S/build,X/action,X/build}`. Firebound can singleton-back
`{H/action,X/build}` and Stonebound `{H/build,S/build}`: both counts are two
although the labels differ. Exact Dreamglass `R44` can keep total
`{S/action,X/action}` while Firebound's sole singleton is `S/action` and
Stonebound's is `X/action`. Together the illustrative sets cover all six
singleton labels while providing both coarse classes, an exact-two total
fiber, and coupled-only edges.

For B, exact Ashen `R17` can keep total `{H/action,H/build,X/build}` while
Firebound singleton-backs `{H/action,X/build}` and Stonebound
`{H/build,X/build}`, both at count two. Dreamglass can keep total
`{S/action,S/build,X/action,X/build}` but move from Firebound
`{S/action,X/build}` at count two to Stonebound
`{S/build,X/action,X/build}` at count three. Exact Iron `R63` can remain one-
anchor on total `{H/action,S/build}` and supply the exact-two fiber. These
illustrative sets cover all six singleton labels.

For C, exact Ashen can keep total
`{H/action,H/build,S/build,X/action,X/build}`, with Firebound singleton-backing
`{H/action,X/build}` at count two and Stonebound
`{H/build,S/build,X/action}` at count three. Exact Dreamglass remains one-
anchor on total `{S/action,X/action}` and may swap its sole singleton label.
With only those exact keys, every multi-anchor realization is count-variable
and every earlier topology/floor rule remains satisfiable.

Any count-variable multi-anchor `b` has `d_v(b)>=3`. C3c.55-B and C3c.57-A
separately supply an entire Soul fiber at total degree two. B and C therefore
force total-degree nonregularity and maximum at least three. Under C every
exact-total-degree-two realization lies in `R_{one,v}`; under B it may instead
be a count-stable multi-anchor realization. A leaves total-degree regularity
and maximum open.

Under C, C3c.55-B's inherited exact-two witness is therefore a one-anchor Soul
fiber. C3c.57-A gives at least `|S_v|` exact pair rows there, each with one
singleton-backed and one coupled-only edge. Every valid package supporting
that coupled-only edge has width two and equals the row's total footprint. This
is local to those rows and creates no global package-width cap.

Count variation forces exact `I_v` variation. Since C3c.57-A keeps total
`C_v(b)` fixed, at least one shared total cell is singleton-backed for one Soul
and coupled-only for another. Equal-count label swaps prove the converse false.
Thus `V^k_{S,v}` is a subset of the later exact-set-variable domain. An A, B,
or C answer here will determine which exact-set options remain feasible. One-anchor
label swaps stay open under every option because their count is forced to one.

Exact-count proof needs the positive singleton witnesses plus complete fixed-
boundary exclusion of singleton packages in every other cell label. Matching
only the witnesses found under two Souls does not prove equality, and failed
search remains unresolved. A applies that burden to every multi-anchor key; B
needs a proven stable and variable key; C needs unequal proven counts for every
multi-anchor key.

The strongest token A catalog makes every multi-anchor total footprint degree
two so count two is automatic, or preserves larger counts only with unrelated
obscure witnesses. B adds one rare third singleton to one showcase key. C
repeats the same obscure third-singleton trick across every multi-anchor key.
Later exact-label mapping, distribution, context/trigger quality, disclosure,
and content-value choices must reject those failures.

An owner-written replacement may define another explicit count-stability
topology on `R_{multi,v}`. It must state its stable and variable witnesses and
retain exact-count proof. This card selects no exact singleton labels or
individual cell status, common count across different Relics, definition/
instance/state/boundary ownership, package identity, map, count, or width
beyond C's forced local exact-two-fiber consequence, predicates, contexts, receipts,
routes, disclosure, ease, power, live Soul rebinding, acquisition, persistence,
release, or implementation.

## Preserved state

The owner packet, living head, rigor audit, SVG, and this handoff record
C3c.58-A and identify C3c.59 as the sole active one-at-a-time owner card, with A
recommended. The authoritative decision record and normative system design
remain unchanged. EP-D01, EP-D02, and EP-D07 remain accepted; EP-D04 directions
remain unaccepted, R9.4 remains reopened, R10.1-A and R10.2-A remain selected,
and R10.3-R10.8 remain pending. Continue exactly one A/B/C choice per turn.

No code tests were run because this was documentation and vector work only. No
runtime, capture, evidence, installation, save, or snapshot was touched.
Preserve the user's existing change to
`.agents/skills/ss2-progression-design/SKILL.md`.

Three independent read-only analyses checked formal topology, frontier order,
and gameplay value. The formal check caught the skipped count atom. The
frontier reviewer initially treated count as a ready sibling, then reversed
that judgment under the owner's explicit no-gloss standard: exact-set A would
silently choose count stability. All three ultimately recommend C59-A, followed
by conditional exact-set stability.

Post-edit mirror review passed. Gameplay review found that B's first example
initially omitted Ashen's exact total and singleton sets, making its claimed
six-label coverage unverifiable; both mirrors now give the complete sets and
the recheck passed. Formal countermodel review found C's forced local width-two
package consequence on the inherited exact-two Soul fiber; that consequence
was added, an overbroad package deferral was narrowed, and the final recheck
passed.

Post-edit validation passed. `git diff --check` reported no tracked whitespace
errors. No-index whitespace checks for this untracked handoff, the untracked
rigor audit, and the untracked SVG each returned the expected difference status
with no diagnostics. The SVG parsed as XML. Both staged and unstaged checks
left the authoritative decision record and normative system design clean. The
active-heading scan found only C3c.59; stale-C3c.58-active and premature-
C3c.59-selection scans found nothing; and filename ordering resolved this as
the newest handoff.
