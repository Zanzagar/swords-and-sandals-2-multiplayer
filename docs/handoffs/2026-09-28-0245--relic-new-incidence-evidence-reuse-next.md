---
handoff:      2026-09-28-0245--relic-new-incidence-evidence-reuse-next
written:      2026-09-28 02:45 +0000
sessionStart: 2026-09-05 23:04 -0400
sessionId:    01a074ac-c9e7-7303-8538-c8e392199ac2
agentRuns:    seven read-only C3F audit runs, ending in a HOLDS precision recheck
branch:       design/endless-progression-owner-packet
commits:      94c0927..HEAD
suite:        proportional serial checks 10/10 passed; register reparses 114/114 with Phi_SR 26; decision-record hash unchanged
supersedes:   2026-09-28-0209--relic-same-tag-evidence-reuse-next
---

# Handoff — later new-incidence evidence reuse is next

Start with `HANDOFF.md` above its archive line and
`$ss2-progression-design`. Present C3F only. Do not collapse it into C3E
same-incidence reuse, same-cut fan-out, claim prevalence/footprint, another
Relic/root/combatant, freshness, source clearing, payoff, or implementation.

## Selected direction

Zanzagar selected `RCS-03C3E-A`: rearmed results still need fresh proof.
`R^{same-reuse}_v` is empty. In every otherwise-admissible later post-rearm
commit of the same exact fixed C135 context/receipt tag `k`, a canonical
occurrence previously claimed through `k` remains ineligible for `k`. A new
occurrence remains eligible normally. No claim state clears.

C3E moves to `DIR-SELECTED`; C3F becomes the sole `OWNER-OPEN` row. Two final
pre-commit rechecks found five missed B-only consequence boundaries. The
corrected 114-row register contains 25 `SCREEN`, 1 `OWNER-OPEN`, 26 `PRUNED`,
56 `DIR-SELECTED`, 4 `DERIVED`, 1 `SPEC`, and 1 `EVALUATE`; `Phi_SR = 26`.
The authoritative decision record remains unchanged.

## C3F scope correction

Two read-only audits broke the old “different-tag” shorthand. C3F classifies a
new causal incidence for the claimed occurrence, not simple receipt-label
inequality.

For claimed canonical occurrence `x`, let immutable `z0(x)` be the first
settlement that created its still-operative claim state. Later idempotent claims
do not reset it. For `x in C(z0)=U(z0)`, define

`A_z0(x)={k in K(z0):(k,x) in I(z0)}`.

Let `A^-_e(x)` accumulate every exact fixed tag to which the same active Relic
has causally attributed `x` from `z0` through the cut before later `e`; it
starts at `A_z0(x)`. Pre-`z0` attribution remains in canonical history but
outside this claim episode. Let
`A^{claim,-}_e(x)` contain only those incidences whose settlements actually
claimed `x`. C3E-A governs the claimed subset. C3F governs the first incidence
to later target `ℓ` outside broader `A^-_e(x)`. Thus `ℓ` may have co-committed
at `z0` but lacked `(ℓ,x)` then. A later repeat through a successful nonclaiming
target belongs to F1, not C3E or another C3F first-incidence witness.

A qualifying witness `(z0,x,ℓ,e2)` requires:

1. immutable claim-episode anchor `z0=z0(x)` and `x in C(z0)`;
2. strictly later authoritative positive settlement `e2` in the same ruleset
   version, combatant, and active persistent Relic instance/root;
3. exact committed target tag `ℓ∉A^-_{e2}(x)` immediately before `e2`;
4. identical canonical `x`, root, accounting identity, and complete lineage in
   the fresh target tuple, with prospectively authored `(ℓ,x) in I(e2)`; and
5. every rule except this active Relic's prior claim still passes, including
   freshness, source validity, addressability, treatment, and target recurrence.

Mere later ledger presence is insufficient. Same-cut use remains C3C. Another
active Relic/root/combatant remains RCS-08. Ally origin alone does not move a
same-active-Relic use to RCS-08; the ally retains ownership and payment.

## Present exactly this next

- **A — claimed proof is spent across this active Relic:** the qualifying
  new-incidence witness set is empty. Combined with C3E-A, claimed `x` is
  unavailable to every later result incidence of this Relic. **Recommended.**
  A preserves D3-A's full-union causal cost and gives one readable state:
  `CLAIMED BY THIS RELIC`. It blocks persistent hubs, cheap fresh-leaf chains,
  repeated Oracle probes, ally-paid amplification, and outcome shopping. The
  original complete weave/claim remains direct standing-ideal fit; later
  exclusion is neutral/protective and universal prevalence aggregate. Cost:
  one result fully cashes elaborate history, potentially suppressing satisfying
  sequences and asking players to repeat a still-truthful deed.
- **B — permit at least one later new incidence:** the witness set is
  nonempty. At least one claimed occurrence later supplies one prospectively
  authored incidence to a target outside its prior-attribution set. Claim state
  remains; this is a scoped exception, never global relighting. B's strongest
  form is one visible **Echo Thread**: the identical remembered deed creates a
  genuinely different manifestation. The later relation is locally direct
  ideal fit and continuity across settlements partial. It is the more vivid
  Souls and Simulacra
  countercase, but B alone selects no successful nonclaiming-target recurrence,
  fresh-co-proof, propagation, or unsuccessful-attempt disposition law.

Example: `P={Guard g, Heat h}` and `Q={Return t, the same Heat h}` commit and
claim `g,h,t`. Natural attribution gives `A_z0(g)={P}`, `A_z0(h)={P,Q}`, and
`A_z0(t)={Q}`. Later `(P,g)` is C3E-A. Later `(Q,g)` is C3F even though Q
co-committed, because g did not cause Q at `z0`. Under A, Q needs new Guard
`g2`. Under B, at least one such new incidence may exist; its recurrence,
fresh-co-proof, propagation, and noncommitting-attempt dispositions remain
later choices.

For `{S}`, if `(S,g)` held at `z0`, later P/Q/R use of g is C3F. For
`{S1,S2}`, if g was attributed only to S1, later `(S2,g)` is C3F while
`(S1,g)` remains C3E-A. No `P->S1`, `Q->S2`, or preferred-heir partition is
inferred. Cancellation originates no claim under D2-A.

A/B are exhaustive because qualifying new-incidence support is empty or
nonempty. Universal/mixed support, exact directed edges, and prevalence remain
AUTHOR/SPEC. Claim reset is forbidden rather than a third choice.

**Prominent corrections:** the first final verifier broke the first draft's
claim that every B realization could be made a consumed one-hop authorization.
That
silently chose propagation and cadence. It was also internally inconsistent:
`{}` commits no tag, and a positive substitute may not commit the intended
tag, so neither can add that intended target to `A^-`. An initially
unattributed claimed occurrence also has no predecessor incidence to name. The
second verifier then broke the first repair: C3E-A requires an actual claiming
settlement, so a successful nonclaiming new incidence cannot silently inherit
its exclusion; and removing universal fresh co-proof without a row left a
player-material build rule unresolved. Its follow-up required immutable `z0`,
post-`z0` episode attribution, all-reuse F2 scope, F1 vacuity, and state-based
F3 nodes; those precision fixes require no additional row.

The thirty-fifth prerequisite correction therefore adds five counted B-only
rows:

- F1: latch, claim-only latch, or disclosed coexistence for later recurrence
  through a successful nonclaiming target, pruning if none is reachable;
- F2: require separate independently eligible post-claim fresh co-proof for
  every B-enabled admission, including a permitted repeat, or support at least
  one admission without it;
- F3: terminal single transition versus finite nonbranching successor path
  versus finite branch-capable DAG over monotone per-`z0` attribution states;
  each transition is one settlement's nonempty atomic set of new incidences;
- F4A: preserve-all, consume-all, or disclosed coexistence for applicable
  authorization after an admitted attempt ends in positive substitutes; and
- F4B: the same independent choice after an admitted attempt ends in `{}`.

F4A/F4B also close vacuously if their reachable domains are empty. Only an
actual committed `(k,x)` enters `A^-`, atomically and idempotently; only an actual
claim enters `A^{claim,-}`. Finite catalog, exact identity/lineage,
prospective authoring, and anti-alias/replay/same-cut/cross-root/reset/age/
source rules are derived. One-hop shape, fresh post-claim co-proof,
nonclaiming-incidence recurrence, and noncommitting-attempt consumption are not.

A prospective substitute incidence routes by pre-state: possible F3 commit if
new, C3E-A refusal if already claimed-attributed, or F1 treatment if attributed
but nonclaimed. F4A owns only unused intended authorization.

Under A, C3F becomes `DIR-SELECTED`, all five children prune, and RCS-03D
opens: 19 `SCREEN`, 1 `OWNER-OPEN`, 31 `PRUNED`, 57 `DIR-SELECTED`, 4
`DERIVED`, 1 `SPEC`, and 1 `EVALUATE`; `Phi_SR = 20`. Under B, applicable F1
opens: 24 `SCREEN`, 1 `OWNER-OPEN`, 26 `PRUNED`, 57 `DIR-SELECTED`, 4
`DERIVED`, 1 `SPEC`, and 1 `EVALUATE`; `Phi_SR = 25`. If no C3F success is
nonclaiming, F1 prunes and F2 opens: 23 `SCREEN`, 1 `OWNER-OPEN`, 27 `PRUNED`,
57 `DIR-SELECTED`, 4 `DERIVED`, 1 `SPEC`, and 1 `EVALUATE`; `Phi_SR = 24`.
RCS-03D waits until all applicable B-only children close.

Ask for A or B.

## Verification and Git

Confirm 114 unique rows and the exact current counts above. Confirm the
decision-record SHA-256 remains
`e7e5c0fb047e42e5852648972f7f57f5539708bf990d97fe597d000ad5ed5358`.
Run proportional serial tests, commit atomically with a `Co-Authored-By`
trailer, push only the feature branch, verify it is clean and synchronized with
`github/design/endless-progression-owner-packet`, and do not merge PR #3.

Do not touch the installed oracle, captures, fixtures, observations,
manifests, goldens, saves, or snapshots.
