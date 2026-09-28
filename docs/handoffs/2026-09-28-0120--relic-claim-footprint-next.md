---
handoff:      2026-09-28-0120--relic-claim-footprint-next
written:      2026-09-28 01:20 +0000
sessionStart: 2026-09-05 23:04 -0400
sessionId:    01a074ac-c9e7-7303-8538-c8e392199ac2
agentRuns:    two D3 named-claim audits plus final diff verification; all read-only
branch:       design/endless-progression-owner-packet
commits:      94bd5cb..HEAD
suite:        proportional serial checks 10/10 passed; register reparses 109/109 with Phi_SR 24; decision-record hash unchanged
supersedes:   2026-09-27-1748--relic-empty-evidence-claim-next
---

# Handoff — positive-result claim footprint is next

Start with `HANDOFF.md` above its archive line and
`$ss2-progression-design`. Present D3 only. Do not collapse claim footprint
into already-selected claim support, D4 failure recurrence, later reuse, or
payoff.

## Selected direction

Zanzagar selected `RCS-03C3D2-A`. `K^{claim0}_v` is empty: a completed
ledger-bearing evaluation that settles `{}` makes none of its selected causal
occurrences unavailable as evidence to the active Relic. Its committed Oracle
realization cannot redraw, and D4 still owns whether continuous relationship
sufficiency may support another distinct evaluation.

Together with D1-B, the selected grammar is: a positive manifestation may cash
proof; no manifestation preserves it. Exact positive claim prevalence and
footprint remain unresolved. D2 moves to `DIR-SELECTED`; D3 becomes the sole
`OWNER-OPEN` row.

The 109-row register now contains 23 `SCREEN`, 1 `OWNER-OPEN`, 26 `PRUNED`,
53 `DIR-SELECTED`, 4 `DERIVED`, 1 `SPEC`, and 1 `EVALUATE`; `Phi_SR = 24`.
The authoritative decision record remains unchanged.

## D3 topology

Under D1-B/D2-A, `K^{claim}_v=K^{claim+}_v` is nonempty and
`K^{claim0}_v` is empty. For each claiming positive settlement `z`, let `C(z)`
be its nonempty Relic-local claim footprint. Let `U(z)` be the deduplicated
union of final child occurrences in its selected authoritative causal ledgers.
Existing boundaries require `C(z)` to be a nonempty subset of `U(z)`.

An exact shared occurrence counts once; distinct related occurrences remain
distinct. For `{S}` or `{S1,S2}`, `U(z)` still comes from both original
selected ledgers. Unselected alternate ledgers, ancestors, siblings, hidden
compound members, other roots, Relics, combatants, and owners stay outside the
footprint. A compound final child cannot be peeled into hidden member sites.

Two read-only named-claim audits upheld one exhaustive binary card. Every
claim is either the complete `U(z)`, or at least one supported claim is a
proper nonempty subset. Mixed full/partial and universal proper-only catalogs
both belong to the latter branch. An empty `C(z)` is no claim, not a third
topology. Exact prevalence and masks remain AUTHOR/SPEC.

## Present exactly this next

- **A — every claim takes the complete selected-ledger union:** for every
  claiming settlement, `C(z)=U(z)`. This means full footprint whenever a claim
  occurs, not that every positive settlement claims. **Recommended.** The
  selected tuple is already the authoritative causal account, so A makes the
  chosen proof route's entire cost honest without adding a second hidden
  optimizer. It blocks cheap-leaf and valuable-hub laundering and has the
  clearest presentation: highlight the whole causal weave, commit the result,
  then grey those inputs once. A is direct local ideal fit because the complete
  weave acquires one Relic-local claim relation while each occurrence retains
  identity, source ownership, and history. Cost: elaborate setups are fully
  cashed and may chain less often.
- **B — require proper-subset claim support:** at least one claiming settlement
  has a prospectively fixed proper nonempty `C(z)`. B's strongest case is a
  named **fuel-versus-witness** grammar: shared Heat is the consumed catalyst,
  while Guard and Return remain historical witnesses. This may sustain longer
  combinations and become potentially direct ideal fit when the role is
  intrinsic and legible. Unguarded B creates hidden footprint routing, cheap-
  proof burning, hub preservation, or teammate grief. Admit it only with a tiny
  closed role vocabulary, no post-result chooser, and proof that partial
  treatment is more readable and fun than reducing positive claim prevalence.

Example: `P={Guard g, Heat h}` and `Q={Return t, the same Heat h}` have
`U(z)={g,h,t}`. For a claiming `{P,Q}`, `{S}`, or `{S1,S2}` settlement, A
claims `g,h,t` after the whole result commits, counting shared `h` once. B
might prospectively claim only `{h}`, or only `{g,t}`. Cancellation `{}` claims
nothing under D2-A and lies outside D3.

A/B are mutually exclusive and exhaustive. Every claim writes only after the
whole receipt set commits, atomically, idempotently, and permutation-
invariantly. It changes only eligibility for this active Relic, never canonical
truth, source state, future occurrences, custody, or another root. A B-law must
be total under fixed inputs, disclosed before commitment, and unable to inspect
payoff or select the cheapest, freshest, or most valuable proof afterward.

If full-union claims suppress satisfying chains, first reduce which positive
contracts claim under D1-B. Use guarded B only if a genuine fuel/witness
archetype still requires partial treatment. If that role cannot be forecast,
animated, and kept free of hub/cheap-proof exploits, fall back to A.

Either answer moves D3 to `DIR-SELECTED` and D4 to `OWNER-OPEN`, producing 22
`SCREEN`, 1 `OWNER-OPEN`, 26 `PRUNED`, 54 `DIR-SELECTED`, 4 `DERIVED`, 1
`SPEC`, and 1 `EVALUATE`; `Phi_SR = 23`. D4 remains an independent failed-
result recurrence choice. C3E/C3F follow only after D4 and receive a fresh
dependency audit.

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
