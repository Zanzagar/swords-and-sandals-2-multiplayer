---
handoff:      2026-09-28-0209--relic-same-tag-evidence-reuse-next
written:      2026-09-28 02:09 +0000
sessionStart: 2026-09-05 23:04 -0400
sessionId:    01a074ac-c9e7-7303-8538-c8e392199ac2
agentRuns:    two C3E named-claim audits plus one scope-correction recheck; all read-only
branch:       design/endless-progression-owner-packet
commits:      cc9490c..HEAD
suite:        proportional serial checks 10/10 passed; register reparses 109/109 with Phi_SR 22; decision-record hash unchanged
supersedes:   2026-09-28-0138--relic-held-cancellation-reattempt-next
---

# Handoff — same-committed-tag claimed-evidence reuse is next

Start with `HANDOFF.md` above its archive line and
`$ss2-progression-design`. Present C3E only. Do not collapse it into D4
cancellation recurrence, C3F different-tag reuse, claim prevalence/footprint,
freshness, source clearing, payoff, cadence, or implementation.

## Selected direction

Zanzagar selected `RCS-03C3D4-A` with B retained only as the guarded reopening
fallback. `R^{fail-hold}_v` is empty: a ledger-bearing cancelled canonical pair
gets one listen per continuous-sufficiency interval. D2-A leaves its causal
evidence available, but continued pair truth does not authorize another
evaluation.

This does not select coexistence or B support. Reopen guarded B only if human
tests show dominant reset-flicker or intolerably stranded maintained formations
and a visible, independently meaningful retry event remains forecastable,
attributable, bounded by later rules, anti-coercive, and independently fun.
Timers, polls, Rest, no-ops, unchanged-context draws, route churn, callbacks,
and replay never qualify.

D4 moves to `DIR-SELECTED`; C3E becomes the sole `OWNER-OPEN` row. The 109-row
register now contains 21 `SCREEN`, 1 `OWNER-OPEN`, 26 `PRUNED`, 55
`DIR-SELECTED`, 4 `DERIVED`, 1 `SPEC`, and 1 `EVALUATE`; `Phi_SR = 22`. The
authoritative decision record remains unchanged.

## C3E scope and topology

Two read-only audits upheld one binary support card but corrected the identity
scope. “Same tag” is the receipt tag that actually committed at the claiming
settlement. Original `P/Q` ledgers remain causal provenance when treatment
instead commits `{S}` or `{S1,S2}`, but vanished originals cannot supply the
initial `c1` required by C135.

For any positive settlement `y`, and specifically claiming settlement `z`:

- `K(y)` is its set of exact committed fixed C135 context/receipt tags
  `k=(h,j)`, whose receipt-label projection is `{P,Q}`, `{S}`, or `{S1,S2}`;
- `C(z)=U(z)` is D3-A's complete deduplicated claim footprint over the original
  selected ledgers; and
- `I(y)` prospectively maps causal incidences `(k,x)` from exact committed tag
  `k` to canonical occurrence `x in U(y)`; at `z`, claimed `x` belongs to
  `C(z)`.

The full claim footprint does not imply that every `x` maps to every `k`.
Original `{P,Q}` naturally gives `(P,g)`, `(P,h)`, `(Q,t)`, and `(Q,h)` for
`P={g,h}`, `Q={t,h}`; shared `h` is one occurrence claimed once. Fusion and
reconstitution contracts must author substitute incidences without assuming
`P->S1`, `Q->S2`, or one substitute per original.

A qualifying witness `(z,k,x,e2)` requires:

1. claiming `z` and authored incidence `(k,x)`;
2. genuine selected C135-C155 insufficiency, renewal, recurrence authorization,
   and rearm for that exact fixed committed `k` after its first commit;
3. a distinct later same-`k` commit whose fresh selected tuple contains the
   identical canonical `x` and whose prospectively authored relation again
   contains `(k,x)` under the same versioned treatment-contract identity; and
4. `x` remains otherwise admissible if only this active Relic's claim state is
   projected out—freshness, source validity, addressability, lineage, and every
   other selected rule still pass.

Let `R^{same-reuse}_v` contain those witnesses. D1-B proves some positive claim
and C136-A proves tag-rearm capability, but their same-occurrence intersection
is not already guaranteed. Expiry, source clearing, substitute identity, or
fresh replacement may keep it empty. Incomplete reachability is unresolved,
not evidence for the empty branch.

## Present exactly this next

- **A — rearmed results still need fresh proof:** `R^{same-reuse}_v` is empty.
  In every otherwise-admissible later post-rearm commit of the same exact fixed
  tag `k`, an occurrence already claimed through `k` remains ineligible for
  `k`. Fresh canonical occurrences remain usable; A decides no different-tag
  rule. **Recommended.** A preserves D3-A's complete causal cost
  rather than making claim a cooldown. Relationship recurrence and evidence
  economy stay distinct: the bond may rearm, but its previous manifestation
  cashed that proof. Teach **“claimed proof stays claimed when its manifested
  result rearms.”** The original weave/claim retains direct ideal fit; A is
  neutral/protective and fresh proof preserves distinction. Cost: persistent
  history can feel disposable, and a player may repeat an action merely to
  restate a still-truthful relation.
- **B — require same-committed-tag reuse support:** `R^{same-reuse}_v` is
  nonempty. At least one claimed occurrence supplies the same authored `(k,x)`
  incidence again to the same exact fixed committed tag after genuine valid
  rearm. B grants a scoped `(k,x)` eligibility exception; it never clears the
  old claim union globally and selects no exact prevalence, family, repeat
  count, or cap. Its strongest case is a named
  history-centered **Remembered Vow**: one enduring witness returns while newly
  paid present-state evidence changes. This is partial ideal fit across time,
  but risks hub laundering, cheap-leaf loops, ally-paid amplification, and a
  tag-by-proof matrix. First reduce claim prevalence or improve fresh-proof
  flow. Use B only if a named persistent-manifestation family remains legible,
  attributable, non-dominant, bounded later, and independently fun.

Example: `{P,Q}` claims `g,h,t`. Heat later breaks; a material Rekindle creates
new `h2` and validly rearms P. Under A, old `(P,g)` stays claimed, so P needs
new Guard `g2`; `h2` is already new. Under guarded B, a named P-family may make
old `g` eligible for P without unlocking Q. Re-claiming `g` later is idempotent.

For `{S}`, C3E concerns S only when `x->S` was authored and S itself rearms;
later P/Q use is C3F. For `{S1,S2}`, each tag needs its own incidence and rearm;
S1 never unlocks S2, and no preferred-heir mapping is inferred. Cancellation
`{}` never enters C3E because D2-A claims nothing.

A/B are exhaustive because `R^{same-reuse}_v` is empty or nonempty. Universal
and mixed incidence support both belong to B; exact assignments and caps remain
AUTHOR/SPEC. No bulk claim reset or extra footprint card is selected. New or
aliased occurrences, siblings/ancestors, expired/source-cleared proof, route
churn, another tag, root, Relic, combatant, persistent payoff, cadence, and
implementation remain outside.

If B needs global relighting, hidden matrices, false original-to-substitute
inheritance, age refresh, source resurrection, or ledger churn, fall back to A.
Under B, the UI must name the manifested tag edge, such as `S1 Echo eligible`;
if that is not readable at Swords & Sandals scale, reject B.

Either answer moves C3E to `DIR-SELECTED` and C3F to `OWNER-OPEN`, producing 20
`SCREEN`, 1 `OWNER-OPEN`, 26 `PRUNED`, 56 `DIR-SELECTED`, 4 `DERIVED`, 1
`SPEC`, and 1 `EVALUATE`; `Phi_SR = 21`.

Ask for A or B.

## Verification and Git

Confirm 109 unique rows and the exact current counts above. Confirm the
decision-record SHA-256 remains
`e7e5c0fb047e42e5852648972f7f57f5539708bf990d97fe597d000ad5ed5358`.
Run proportional serial tests, commit atomically with a `Co-Authored-By`
trailer, push only the feature branch, verify it is clean and synchronized with
`github/design/endless-progression-owner-packet`, and do not merge PR #3.

Do not touch the installed oracle, captures, fixtures, observations,
manifests, goldens, saves, or snapshots.
