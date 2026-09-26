# Handoff — Design-first master-index restoration; no flattened systems

**Session ID:** `98e9a844-42ee-4adb-aecf-b9bd7ac3ee51`
**UTC:** 2026-09-24 05:23:47
**Branch:** `design/endless-progression-owner-packet`

Start with this handoff, the living head, and `$ss2-progression-design`.

## Owner concern and disposition

The owner correctly identified that the new `SC-*` summaries were less
descriptive than the prior design prose. The first master-index draft had made
closure predicates carry too much weight: it named proof obligations but
flattened player fantasy, concrete play, relationships among systems, selected
design philosophy, and the tradeoffs that made the earlier work compelling.

That presentation is superseded. The master index remains the finite scope
controller, but it is now explicitly a navigation/closure layer over the full
design rather than a compressed replacement for it.

## What changed

`docs/design/endless-progression-master-closure-index.md` now contains a
design-first card for every `SC-01`–`SC-20`. Every card has exactly one of each:

- **What we are designing** — player promise plus operative loop;
- **Souls and Simulacra / ideal fit** — direct, partial,
  neutral/protective, or aggregate-sensitive classification at a named
  mechanical boundary, with the cost/tradeoff stated;
- **Selected foundation** — authority-qualified rules and directions;
- **Still unresolved** — real remaining design rather than “tuning” shorthand;
- **Closure proof** — the independent acceptance burden;
- **Source spine** — where the full older design remains operative; and
- **State** — no ambiguity between accepted, partial, and open work.

An anti-flattening contract says an omission cannot delete, weaken, or defer a
linked mechanic, degeneration, negative case, or owner direction. A
source-coverage ledger maps the old system's executive material, §§1.1–1.7,
and every whole section from §2 through §15 into named primary and secondary
closure homes.

The title/ideal lens now explicitly says **Souls and Simulacra is not a later
coat of paint**. It governs choices during this pass. The later standalone
retain/replace/remove/expand/adapt pass remains separate and can revise
SS2-derived assumptions before specifications freeze.

The Soul Relic card received the deepest restoration. It now preserves the
outside-host one-root/two-optional-Charm topology, no second meter or Capacity
charge, independently legal and paid cross-source weaving, mandatory bearer
participation, ally ownership/declaration/payment, excluded opponents,
nonrecursive evidence, non-gating Soul resonance, action/build provenance,
qualitative instance variation, Soul-map/affinity/archetype form, bounded result
receipts, persistent artifact-state lineage, visible insufficiency/break/renew/
rearm, integrated-account continuity, per-combatant custody, definition
uniqueness, bounded duplicate offers and exhausted-pool fallback, and explicit
degenerations. All remain worksheet directions pending complete replay; none
became an authoritative decision through the index.

The rarity and acquisition cards also restore facts lost by the terse form:
Trophy is a source/name rather than a fifth rarity; fun Legendary burdens are
live target/timing/resource/mode/setup commitments rather than stat taxes,
random self-stuns, or inventory chores; evaluation uses legal player policies;
and the current 63-Circuit/252-win deterministic exact-Legendary tail is named
as an unresolved failure rather than an endorsed pace.

## Why “not flattened” is an evidence-backed claim

The index records a mechanical anti-flattening audit:

- 20 ordered `SC-*` headings;
- 20/20 cards with all seven required fields;
- every old major design area assigned a primary home and secondary links;
- authority checked independently from prose richness;
- three disjoint read-only comparisons rederived SC-01–07, SC-08–14, and
  SC-15–20 from the old system, decision, readiness, packet, and living-head
  sources; and
- omissions found by those comparisons were reconciled before validation.

This proves lossless framework indexing and authority/status preservation. It
does not falsely claim the open systems are designed, balanced, or accepted.

## Authority and next frontier

Only EP-D01, EP-D02, and EP-D07 remain `AUTH-CLOSED`. EP-D04's rich rarity
directions and EP-D02 C3c's rich Relic directions remain worksheet selections.
The old four-unit Reconstruction Tray and fixed-four MVP remain superseded.
`docs/design/endless-progression-decisions.md` was not edited.

The next candidate owner boundary remains `RCS-03` under `SR-04`: what may
materially transform a persistent Relic and who or what authorizes that
transformation. When the owner asks to resume, map prerequisites and present
exactly one bounded A/B/C card. Precedence and stable
artifact/definition/lineage identity remain the separate `RCS-04` slot. Do not
present C171 as an owner decision.

## Agent correction

I initially suggested that the unexpectedly large tracked diff might be a
line-ending conversion. That was wrong. Read-only HEAD/worktree comparison
showed that HEAD contains the earlier short documents while this worktree
contains the accumulated design session. No line-ending normalization was
performed and nothing was reverted on that premise.

## Validation

- Structural validator: pass — 20 ordered SC cards and exactly one of all seven
  required semantic fields per card.
- Relative-link validator: pass — all 47 relative file links resolve.
- Trailing-whitespace scan: pass.
- `git diff --check`: pass.
- Authoritative decision-record SHA-256 remains
  `e7e5c0fb047e42e5852648972f7f57f5539708bf990d97fe597d000ad5ed5358`.
- No runtime tests were run because this was documentation/process work only;
  no runtime, schema, wrapper, capture, installation, save, or snapshot changed.
- The pre-existing user-modified
  `.agents/skills/ss2-progression-design/SKILL.md` was not changed.

