---
handoff:      2026-09-28-0138--relic-held-cancellation-reattempt-next
written:      2026-09-28 01:38 +0000
sessionStart: 2026-09-05 23:04 -0400
sessionId:    01a074ac-c9e7-7303-8538-c8e392199ac2
agentRuns:    two D4 named-claim audits plus final diff verification; all read-only
branch:       design/endless-progression-owner-packet
commits:      b7dc7a6..HEAD
suite:        proportional serial checks 10/10 passed; register reparses 109/109 with Phi_SR 23; decision-record hash unchanged
supersedes:   2026-09-28-0120--relic-claim-footprint-next
---

# Handoff — held-pair cancellation reattempt support is next

Start with `HANDOFF.md` above its archive line and
`$ss2-progression-design`. Present D4 only. Do not broaden it back to unkeyed
“all failure,” or collapse it into claim, positive-result recurrence, later
evidence reuse, payoff, exact cadence, or implementation.

## Selected direction

Zanzagar selected `RCS-03C3D3-A`. For every claiming positive settlement `z`,
`C(z)=U(z)`: its claim takes the complete deduplicated union of final child
occurrences in the selected authoritative causal ledgers. Exact shared
occurrences count once; distinct related occurrences remain distinct; `{S}`
and `{S1,S2}` retain both original selected ledgers. D1-B still leaves exact
claim prevalence and assignments AUTHOR/SPEC.

D3 moves to `DIR-SELECTED`; D4 becomes the sole `OWNER-OPEN` row. The 109-row
register now contains 22 `SCREEN`, 1 `OWNER-OPEN`, 26 `PRUNED`, 54
`DIR-SELECTED`, 4 `DERIVED`, 1 `SPEC`, and 1 `EVALUATE`; `Phi_SR = 23`. The
authoritative decision record remains unchanged.

## D4 scope correction and topology

Two read-only audits found no need for a row split, but the old “failed-result
recurrence” label was overbroad. A true no-candidate invocation has no selected
complete contender pair, ledger relationship, or canonical failed-proof
identity. Including it would silently create a new readiness-identity system.
D4 therefore concerns only the already-nonempty domain `Z^0_v` of completed
ledger-bearing pair evaluations with final output `{}`.

For cancellation `z`, let `kappa(z)` contain the fixed version, combatant,
active Relic, operative context, treatment contract, and unordered original
contender pair `{P,Q}`. Pair order, aliases, callbacks, internal evaluator
channels, and alternate selected ledgers do not create another key. Exact-
ledger scope would launder retries through route churn; tag-global scope would
wrongly suppress the same `P` in a genuinely different `P/R` relationship.

The canonical pair relationship remains continuously sufficient while the
fixed context and both contender relationships stay operatively supported
after each authoritative semantic transition, ignoring claim/retry/cooldown
bookkeeping. Alternate lawful proof routes may change without ending the
interval. Genuine pair insufficiency or context unavailability ends it;
frames, polls, callbacks, logging, serialization, or repeated observation do
not.

A distinct re-evaluation is a newly authorized product evaluation of the same
key at a strictly later semantic cut with a coherent current-cut evidence read.
It excludes redraw, delayed/duplicate settlement, callback, reload, replay,
pair enumeration, alias/routing churn, and internal channels. Define
`R^{fail-hold}_v` as the keys with one fully specified legal history containing
initial `{}` settlement `e1` and later distinct evaluation `e2` inside the same
continuous-sufficiency interval.

## Present exactly this next

- **A — one listen per unbroken bond:** `R^{fail-hold}_v` is empty. After `{}`
  settles, the same canonical pair cannot evaluate again until its relationship
  genuinely becomes insufficient and later sufficient. This does not guarantee
  a post-break reattempt. **Recommended.** A gives success and cancellation one
  episode grammar under C135-A. D2-A preserves the evidence, but denial does not
  become a heads-win/tails-reroll free option. Leave evidence icons lit, mark
  the pair `LISTENED — SEVERED`, and explain `Already heard` while the bond
  remains held. A is neutral/protective ideal fit; the initial causal relation
  may remain direct. Cost: an expensive maintained formation can become inert,
  and cheap false/true reset play must not become dominant.
- **B — require held-pair reattempt support:** `R^{fail-hold}_v` is nonempty.
  At least one canonical cancellation key has a legal later distinct evaluation
  while its pair relationship stays continuously sufficient. B selects no
  universal coverage, success, periodic pulse, exact trigger, cadence, or cap.
  Its strongest case is a named **Echoing Covenant**: a visible, independently
  meaningful action such as `Temper the Vow` changes a law-relevant fact while
  `P/Q` remains true and authorizes another hearing. That is at most partial
  ideal fit across distinct evaluations of one continuing relation. A timer,
  Rest, poll, no-op, unchanged-context draw, or ledger switch is not. Unguarded
  B turns chance `p` into eventual success `1-(1-p)^n`, creates proc spam,
  weakens Witness refusal, and enables teammate-forced repeats.

Example: `P={Guard g, Heat h}` and `Q={Return t, the same Heat h}` settle `{}`.
D2-A leaves `g,h,t` available. Under A, held `P/Q` creates no later evaluation;
Heat must become authoritatively false and later rebuild before a new
opportunity can exist. Under B, an authored material event may authorize `e2`
while `P/Q` remains true. `e2` may fail or produce a positive result.

A/B are mutually exclusive and exhaustive because `R^{fail-hold}_v` is empty
or nonempty. Universal and mixed support both belong to B; exact assignments
and prevalence remain AUTHOR/SPEC. Retry-until-success, one versus many
reattempts, cooldown, interval length, and attempt caps remain later work.
Incomplete reachable-domain analysis is unresolved, not A.

True no-candidate invocations, positive settlements, different pairs, genuine
post-break renewal, persistent payoff, later evidence reuse, and cross-root/
Relic/combatant effects remain outside D4. Claim state and the pair-recurrence
latch are separate. The latch cannot claim evidence, counterfeit insufficiency,
or erase truth. No replay/callback/duplicate/no-op/timer/route-churn identity
laundering or cheap teammate coercion is permitted.

Use guarded B only if human tests show A produces dominant reset-flicker or
intolerably stranded formations and the material retry event remains
forecastable, attributable, bounded, anti-coercive, and independently fun. If
not, fall back to A. Teach A as **one listen per unbroken bond**; B additionally
needs its exact material trigger and whatever reattempt authorization or budget
later authoring supplies visible before the last reversible commitment.

Either answer moves D4 to `DIR-SELECTED` and C3E to `OWNER-OPEN`; D1-B means
C3E cannot derive away for lack of claims. C3F remains screened behind C3E.
The register then contains 21 `SCREEN`, 1 `OWNER-OPEN`, 26 `PRUNED`, 55
`DIR-SELECTED`, 4 `DERIVED`, 1 `SPEC`, and 1 `EVALUATE`; `Phi_SR = 22`.

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
