# Handoff — EP-D04 first direction round pending

**Session ID:** `01a0748e-3c47-7030-8500-fd12761b3531`
**UTC:** 2026-09-06 02:33:37
**Branch:** `design/endless-progression-owner-packet`

Resume the three pending EP-D04 direction questions in the owner packet;
preserve accepted EP-D01, EP-D02, and EP-D07.

## Session outcome

Read the preceding EP-D02 handoff, HANDOFF.md living head, repo-local
ss2-progression-design skill, owner packet, decision record, and relevant
system/readiness sections. EP-D04 remains pending. No owner answer or final
disposition has been received at this checkpoint.

The [owner packet](../design/endless-progression-owner-packet.md#ep-d04-active-design-tree--first-round-awaiting-owner-direction)
now contains the current design tree and first numbered round:

1. Identical ordinary chassis values within the same family/profile/tier, or
   equal total budget with rarity-dependent redistribution. Recommend identical
   values.
2. Permit a bounded aggregate all-Legendary advantage with substantial real
   mixed-rarity counterplay, or require aggregate parity. Recommend the bounded
   advantage; its size and coverage are not yet proposed or selected.
3. Require endgame uses for Tempered and Inscribed, all three lower rarities,
   or mixed kits overall without a per-rarity guarantee. Recommend Tempered
   and Inscribed; Standard may remain a progression/restricted-Capacity item.

All three recommendations are [A], unaccepted, and permit owner-written
replacements. Recompute dependent questions after the answers. Do not silently
default them or treat direction selection as final acceptance.

## Findings and boundaries

The current D04 record explicitly lacks its exact matchup grid, weighting,
ties, useful-mixed metric, and Legendary concentration thresholds. The system's
existing percentage targets are proposals, and readiness explicitly calls
their metric/distribution/solver/confidence/tie rules missing. [V/U]

One read-only lookup agent checked those documentation dependencies. It wrote
nothing and made no owner choices. No evidence wave was launched.

Later rounds must distinguish one fixed kit from a legally adaptable portfolio;
exclude nominal mixed kits whose lower-rarity item contributes no combat value;
measure equal-access/full-Capacity endgame separately from scarcity and route
restrictions; and preserve the accepted Branch-selection and Team Tactic rules.
The full normative replacement must be replayed and explicitly accepted before
updating the authoritative decision record and derived readiness indexes.

## Verification and remaining work

`git diff --check` passed. The authoritative decision record has no diff.
No runtime code, tests, vanilla evidence, licensed assets, installation, save,
or capture files changed. Tests were not rerun for this worksheet/handoff work;
the preceding handoff's test counts are historical, not a result of this session.
No commit or push was made.

EP-D03–EP-D06 and EP-A01–EP-A03 remain open, along with the readiness contracts.
Implementation remains blocked and requires separate owner authorization.
