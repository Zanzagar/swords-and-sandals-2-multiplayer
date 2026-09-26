# Handoff — EP-D02 one active Soul Relic selected

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 05:45:13
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.11, same-definition Soul Relic possession. The
owner selected C3c.10-A after reviewing the system-fit visual: once the safe
late enablement selected in C3c.9-C occurs, exactly one personal Soul Relic
instance is active. Preserve accepted EP-D02 until a complete replacement is
replayed and explicitly accepted. Do not implement.

## Selected direction

C3c.10-A retains many owned Relic alternatives while making one active root the
focal build thesis. Any proposed second active Relic fails the family-count
validator, regardless of whether its definition matches the first. Inactive
Relics supply no grammar, Bound-Soul resonance, payoff, or Charm authority.
This result makes simultaneous same-definition duplicate activation
structurally illegal, so the planned dependent activation question collapses
rather than receiving a vacuous card.

The non-normative
[`docs/design/endless-build-system-map.svg`](../design/endless-build-system-map.svg)
now marks A selected and B/C not selected. It still chooses no UI host/screen,
Charm attachment/count/coexistence, source family, or budget.

## Sole active choice

EP-D02-C3c.11 asks only whether one combatant collection may hold multiple
instances with the same stable `relicDefinitionId`:

- **A, recommended:** at most one owned instance per definition;
- **B:** every definition authors a positive finite `maxOwned`, with at least
  one supported value above one;
- **C:** raw same-definition count never rejects possession, though a later
  total-storage or retirement rule may still bound the collection.

Every permitted copy remains a distinct instance under C3c.7-A, and only one
Relic total may be active under C3c.10-A. Duplicate-award resolution,
rolls/evolution, total storage, retirement/salvage, transfer, loss, migration,
Charm duplication, and release remain open. A narrow read-only verifier passed
the card as prerequisite-correct, mutually exclusive, and atomic.

## Verification and preserved state

`git diff --check` passed, and the SVG remains well-formed XML. No code tests
were run because the change is documentation/vector-only. The authoritative
decision record, system design, and readiness record remain unchanged. EP-D01,
EP-D02, and EP-D07 remain accepted; EP-D04 directions remain unaccepted, R9.4
remains reopened, R10.1-A and R10.2-A remain selected, and R10.3-R10.8 remain
pending. No runtime, capture, evidence, installation, save, or snapshot was
touched.
