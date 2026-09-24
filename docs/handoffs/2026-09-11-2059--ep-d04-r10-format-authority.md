# Handoff — EP-D04 R10.1 format authority pending

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 00:59:17
**Branch:** `design/endless-progression-owner-packet`

Resume with the single EP-D04 R10.1 combined-format causal-authority choice in
the owner packet. Preserve accepted EP-D01, EP-D02, and EP-D07 and every
selected-but-unaccepted EP-D04 direction through R9. Do not edit the
authoritative record or implement anything.

## Session outcome

The owner asked whether the proposed six-part R10 had received the same rigor
and then agreed to proceed in deciding it. No R10 direction has yet been
selected.

A read-only audit found that the prior R10 had complete A/B/C formatting,
recommendations, tradeoffs, counterexamples, and a feasible numeric envelope,
but not the earlier rounds' decision-tree rigor. R10.1 was a prerequisite for
later causal denominators; R10.2 bundled independently meaningful mixed and
Legendary floors/caps; R10.3 bundled causal coverage with unchosen
concentration thresholds; and R10.6 bundled seven controls while leaving B/C
aggregate authority ambiguous. The owner packet and `HANDOFF.md` living head
correct this at the active instruction. The entire prior numeric envelope is
withdrawn as selectable, and none of its values was selected. The older dated
handoff remains frozen history.

## Current frontier

R3.3-B requires Tempered and Inscribed each to have a separate causal niche
over the combined 1v1/2v2/3v3 endpoint grid while allowing format
specialization. R7 defines structural `U_route` and generated
`G_offer -> E_pi` views within a format. R10.1 now chooses how formats combine
for both causal guarantees without pooling the two views:

- **R10.1-A, recommended:** macro-average the normalized 1v1, 2v2, and 3v3
  measures with equal one-third authority.
- **R10.1-B:** use fixed team-emphasis weights `0.20/0.40/0.40`.
- **R10.1-C:** use no pooled measure; each rarity must meet the later causal
  floor separately in at least two formats.

For an illustrative later 10% floor, a rarity causal on 30% of 1v1 and nowhere
else passes A at 10%, fails B at 6%, and fails C. A rarity causal on 15% of both
team formats scores 10% under A, 12% under B, and passes C in two formats. Live
queue population changes none of the rules because R7 already makes telemetry
diagnostic rather than normative.

The recommendation is A: equal format authority is the least assumption-heavy
continuation of the accepted mode-neutral identity and R3.3's deliberate
specialization allowance. Its cost is that sufficiently broad success in one
format may satisfy a combined guarantee by itself. B privileges multiplayer
utility and underweights a solo-led niche; C forces breadth but risks ornamental
second-format roles and higher catalog cost. An owner-written replacement is
available.

After the owner selects R10.1, recompute the quantitative frontier and expose
each independently meaningful structural floor/range, causal coverage/breadth,
fixed-package concentration, generated-experience coverage, and aggregate
authority as its own bounded choice. Selection remains direction only; final
EP-D04 acceptance requires a complete normative replay.

## Verification

A final write-nothing verifier upheld the corrected single-node frontier and
found no current instruction selecting or offering R10.2–R10.6; their only
current mentions explain the withdrawn draft. `git diff --check` passed after
this handoff. The authoritative decision record has no diff. No runtime code,
tests, vanilla evidence, licensed assets, installation, save, snapshot,
capture, candidate, fixture, observation, manifest, or golden changed. Tests
were not run for this docs-only owner round. No commit or push was made.
Implementation remains blocked.
