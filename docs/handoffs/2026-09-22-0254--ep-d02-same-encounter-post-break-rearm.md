# Handoff — Break-to-rearm selected; same-encounter reuse next

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-22 06:54:12
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.136: whether every fixed context/receipt tag has a
same-encounter post-break recommit witness, no tag does, or both tag classes
occur. The owner selected C3c.135-A. Preserve accepted EP-D02 wording until a
complete replacement is replayed and explicitly accepted. Do not implement.

## Standing north star and workflow

The standalone game is **Souls and Simulacra**. Use *Achintya Bheda Abheda*
(*acintya-bhedabheda*) as the enduring design ideal: prefer meaningful
continuity or participation and real, mechanically legible distinction at the
same operative relationship. This is an inspirational game-design analogy,
not theological equivalence, a silent invariant, or an automatic selector.

For every recommendation, name the operative relationship and boundary, rate
the fit as direct, partial, neutral, or aggregate, and expose the gameplay
tradeoff. Present exactly one prerequisite-ready A/B/C choice at a time with a
recommendation, strongest countercase, and concrete example. Finish the current
full-assurance pass before the separate standalone expansion, audit, and
adaptation pass. Vanilla evidence and the byte-identical oracle remain in their
own lane.

## Selected direction — EP-D02-C3c.135-A

`R^{hold}_v` is empty. Every fixed context/receipt tag may commit at most once
during one continuous-sufficiency interval. A later same-tag result requires an
authoritative semantic state in which the relationship is insufficient,
followed by renewed sufficiency and a newly authorized occurrence. Context/tag
termination counts as insufficiency. Frames, polls, callbacks, duplicate
settlement, replay, and repeated observation do not.

This is a necessary break rule, not a guarantee that any tag can recommit. A
persistent or channeled payoff from the first receipt remains possible; only a
fresh input receipt requires a break. The branch retains `9/23/138`, four
represented IDs, eight lived edges, four one-history-complete IDs, no incomplete
represented ID, Souls `{6,9,10,12,14,15}`, and degree six. At the same Soul/
same Relic/same relationship across the post-commit interval, the marginal
break requirement is **neutral/protective**; the inherited first-commit relation
may remain **direct**, and universal prevalence is **aggregate**. The
authoritative decision record remains unchanged.

## Why reset quality is not next

C135-A does not prove that even one tag can commit twice after a break. A reset-
quality choice over the current domain would therefore classify permanently
one-shot tags vacuously. “Partial support retained” is also not yet
representation-invariant because exact source atoms, Boolean support, source
reuse, `H` retention, and relationship operators remain open. First establish
the nonempty/full/proper repeatable domain; then classify meaningful reset
quality inside it.

## Active owner choice — EP-D02-C3c.136

Reuse the nonempty tagged domain

`K^{candidate}_v = disjoint-union_{h in H+} {(h,j):j in J_h}`.

A tag `(h,j)` has a **same-encounter post-break recommit witness** only when one
fully specified, nonforked, fixed-version legal encounter history, with every
participant choice and exogenous/random input fixed, contains before terminal
encounter resolution:

1. an initial authoritative commit `c1` of receipt `j`;
2. strictly after `c1`, an authoritative semantic state where the relationship
   is insufficient;
3. after that insufficient state, renewed relationship sufficiency plus
   recurrence authorization make a new occurrence candidate provisionally
   complete; and
4. a distinct authoritative commit `c2` of the same tag.

Queued or duplicate settlement, rollback, reload, replay, redelivery, logs,
polls, evaluator microsteps, and random divergence do not create `c2`.
Temporary context unavailability can provide the insufficient state only if
the same tag returns and commits. Terminal teardown cannot provide the witness
because `c2` must occur first.

Let `K^{enc-rearm}_v` contain exactly the tags with such a witness. This card
selects capability breadth, not whether every break works, when reauthorization
occurs, or whether an automatic/same-semantic-moment clear and reapply is a
meaningful reset.

A tag lies outside `K^{enc-rearm}_v` only after complete reachable-domain
analysis of every legal fixed-tag encounter history proves that no witness
exists. Incomplete analysis leaves the tag unresolved and cannot establish B
or C's negative class.

### A — every tag is same-encounter rearmable — recommended

`K^{enc-rearm}_v=K^{candidate}_v`. Every tag has some encounter in which a real
break and rebuild leads to a fresh second commit. This makes C135-A's break
language an event-driven gameplay loop rather than hidden exhaustion. It does
not require a second result in every encounter or after every break.

Cost: every tag needs a nonterminal two-commit witness and creates reset-loop
pressure. The next reset-quality choice must prevent free flicker if desired.
At the same Soul/same persistent Relic/same tag across first commit, loss,
renewal, and second commit, continuity and distinct manifestation are
**partial** because the relation spans a temporal trajectory. Reset quality can
strengthen its legibility but cannot make that interval-spanning relation
direct at one operative cut; universal prevalence is **aggregate**.

### B — no tag is same-encounter rearmable — strongest anti-farm countercase

`K^{enc-rearm}_v` is empty. Each fixed tag commits at most once per encounter,
even if its relationship breaks and reforms. Other tags remain independent and
cross-encounter reuse stays open. This creates encounter-scale Vows with no
cooldown or reset exploit.

Cost: rebuilding a difficult relationship during a long battle earns no second
input result, and early accidental activation can strand that tag. The first
source–Relic–result relation may remain **direct**; recurrence exclusion is
**neutral/protective**, and universal prevalence is **aggregate**.

### C — rearmable Echoes and encounter-once Vows coexist

`K^{enc-rearm}_v` is a nonempty proper subset of `K^{candidate}_v`. This gives
the richest cadence vocabulary but creates two recurrence languages, disclosure
and testing burden, token witnesses, and likely premium status for rearmable
tags. Positive tags retain A's **partial** fit, negative tags B's **neutral/
protective** fit, and catalog coexistence is only **aggregate**.

## Concrete separator

Guard + Heat produces P and P commits as `c1`. Later in the same live encounter,
Heat becomes authoritatively false and Guard + Heat is rebuilt.

- Under A, every tag has some legal encounter in which a newly authorized P-
  like result commits as `c2`; this does not say that the shortest Heat toggle
  is sufficient.
- Under B, that fixed P tag cannot commit again before the encounter ends.
- Under C, selected P-like tags can recommit, while Q-like tags remain encounter-
  once.

## Compatibility, floors, and deferrals

When renewed sufficiency plus recurrence authorization make the occurrence
provisionally complete, a new C134 episode opens, C134-A seals it, and the C133
no-response interval begins. C46-A remains a same-boundary maximum of two
because `c1` and `c2` occur at different times. Co-result tags require separate
repeat witnesses under A but need not recommit together. C47/C48 and C113-A
remain intact.

C45-C supplies at least three tags: two in one co-result context and one in a
distinct positive no-co-result context. C is therefore feasible without raising
the inherited floor. Every branch retains `9/23/138`, four represented IDs,
eight lived edges, four complete IDs, no incomplete represented ID, Souls
`{6,9,10,12,14,15}`, and degree six.

The rule is tag-local. It does not cap a related receipt under context `h'`,
aggregate all receipts on one Relic, or choose the later recurrence-accounting
key. Cross-encounter/Circuit recurrence, reset quality, false duration, failed-
evaluation requirements, recurrence phase, cadence, cooldown, broader caps,
trigger authority, D/R/O phase, `H` retention, source identity/reuse,
consumption, payoff, access, power, persistence, migration, release, and
implementation remain open.

## Process-doc warning

`docs/overnight-agent-plan.md` still lacks the `## THE ARCHIVE LINE` named by
`AGENTS.md` and contains superseded fan-out/Ruffle guidance. The correction in
`HANDOFF.md`'s living head remains controlling: follow direct `AGENTS.md` rules
and do not treat the overnight plan as current guidance.

## Required next-turn behavior

Treat the owner's next bare `A`, `B`, or `C` as the answer to C136 only. Record
the selected branch and its derived consequences, recompute the frontier, and
present exactly one next prerequisite-ready choice. Do not infer acceptance of
the whole EP-D02 replacement or start implementation.
