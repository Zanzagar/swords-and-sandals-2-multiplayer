# Handoff — EP-D04 ninth direction round pending

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-10 15:44:04
**Branch:** `design/endless-progression-owner-packet`

Resume the linked four-choice EP-D04 R9 evidence-tolerance bundle in the owner
packet. Preserve accepted EP-D01, EP-D02, and EP-D07 and every
selected-but-unaccepted EP-D04 direction. Do not edit the authoritative record
or implement anything.

## Session outcome

The owner's `I agree with recommendation` selected `R8.1-A, R8.2-A`; it did not
accept a final EP-D04 replacement.

The eventual simulator evaluation now uses one frozen legally coupled policy
per claimant, trained/searched through multiple independent RL/search starts,
legal scripts, tractable exact subgames, and adversarial challengers. Privileged
state is training-only. Scored policies/challengers freeze before audit roots or
receive valid fresh/nested evaluation; sound lower/upper bounds apply to the
whole policy domain. Their difference interval classifies a binding comparison
as Legendary strict win, mixed strict win, practical primary tie, or unresolved.
Missing or boundary-overlapping bounds are unresolved, and secondary Pareto
metrics never create a strict clear-rate win.

## Recomputed frontier

R9 is one linked tolerance bundle, not four independent defaults:

1. **R9.1-A, recommended:** use `epsilon_success=0.02`, a closed
   `[-0.02,+0.02]` absolute Circuit-clear equivalence band. Strict Legendary
   requires the interval lower endpoint `>+0.02`; strict mixed requires the
   upper endpoint `<-0.02`; an interval contained in the closed band is a tie;
   every other finite interval is unresolved.
2. **R9.2-A, recommended:** require 99% simultaneous coverage across every
   binding comparison, adaptive look, checkpoint/challenger selection, and
   release attempt for one pinned version. Use one sealed final audit or valid
   confidence-sequence/alpha-spending/fresh-nested machinery. New audit roots do
   not reset the error budget.
3. **R9.3-A, recommended:** a comparison is solver-resolved only if each
   claimant's actual sound residual gap is at most `epsilon_success/2`—one
   point under R9.1-A. A wider/missing gap makes a terminal unit unresolved or
   directly fails a derived aggregate claim; it is never clipped or assumed.
4. **R9.4-A, recommended:** assign unresolved terminal support units
   adversarially. Fail above 5% of the R5/`U_route` or paired-R6/`G_offer` base
   measure in any format, or above 10% conditional unresolved mass inside any
   preregistered binding mechanics, offer, Tempered, or Inscribed stratum.
   Unresolved derived parent/format/causal aggregates directly fail their own
   claim and are not counted as additive mass. Never renormalize denominators.

The weaker alternatives use a 1- or 5-point equivalence radius, 95%
simultaneous or reset pointwise confidence, a full-radius/no-numeric solver gap,
or exclusion/tie treatment for unresolved units.

A write-nothing verifier audited R9 after catching R8's producer/consumer
dependency. It found the first R9 draft ambiguous at exactly two points,
internally inconsistent about a small unresolved leaf, dimensionally vague
about unresolved denominators, and vulnerable to repeated-final-audit shopping.
The owner packet and `HANDOFF.md` correct each issue at the instruction before
the owner saw this round. No evidence wave was launched.

After R9, choose numeric mixed and separate causal-rarity coverage, the permitted
all-Legendary lead/concentration, and generated-experience veto floors. Exact
team communication and canonical finite mechanics/offer support remain [U]
inputs before final replay.

## Verification

`git diff --check` passed after this handoff. The authoritative decision record
has no diff. No runtime code, tests, vanilla evidence, licensed assets,
installation, save, snapshot, capture, candidate, fixture, observation,
manifest, or golden changed. Tests were not run for this docs-only owner round.
No commit or push was made. Implementation remains blocked.
