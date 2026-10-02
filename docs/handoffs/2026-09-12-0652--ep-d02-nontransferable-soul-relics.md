# Handoff — nontransferable Soul Relics selected

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 10:52:22
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.23, the maximum persistent Soul Relic loss severity
ordinary gameplay may impose. The owner selected C3c.22-A: a Soul Relic's title
never voluntarily moves to another combatant. Preserve accepted EP-D02 until a
complete replacement is replayed and explicitly accepted. Do not implement.

## Selected direction

A Soul Relic's `ownerCombatantId` never changes through gifting, trade,
lending, campaign storage, inheritance, or another voluntary player action.
Administrative recovery or migration may restore a broken identity link only
to its intended existing owner; it cannot select a new beneficiary. Recipient
consent, exchange-channel, and transfer-horizon branches therefore collapse.
Character retirement/deletion and involuntary loss remain undecided.

## Sole active choice

C3c.23 asks the strongest persistent impairment or loss ordinary gameplay may
impose on an owned Soul Relic instance:

- **A, recommended — no persistent durability or gameplay loss:** no wear,
  charges, repair state, breakage, consumption, confiscation, or gameplay
  salvage. Battle outcomes cannot alter persistent identity, ownership,
  availability, or usability.
- **B — reversible persistent impairment:** a reachable event may damage or
  dormantly disable the same instance, but a reachable recovery must restore
  it and an enabled combatant must always retain a guaranteed legal route to an
  active Relic.
- **C — permanent gameplay destruction permitted:** a reachable event may
  destroy an instance ID, but only in an atomic transition that leaves another
  legal personal Relic or grants a guaranteed legal replacement.

A makes a mandatory singular artifact trustworthy and permanent, avoiding
maintenance chores and save-loss anxiety. It gives up persistent repair rituals
and item-risk drama; encounter and build stakes carry that weight instead. An
owner replacement may use battle-local charges that always reset or a voluntary
ritual sacrifice under a separate value rule. Exact B/C triggers,
probabilities, repair/replacement content, costs, timing, and authority remain
later, as do whole-character lifecycle, Relic host, Charm loss, acquisition,
configuration horizon, persistence/migration, and release.

## Verification and preserved state

A narrow read-only audit passed C3c.23 as prerequisite-ready, atomic, mutually
exclusive, non-vacuous, and consistent with C3c.9-C's mandatory/non-stranding
rule. It confirmed that battle-local suppression, whole-combatant retirement,
repair/replacement mechanics, Charm loss, acquisition, persistence/migration,
and release remain open. `git diff --check` passed before this handoff. No code
tests were run because the changes are documentation-only.

The authoritative decision record, system design, and readiness record remain
unchanged. EP-D01, EP-D02, and EP-D07 remain accepted; EP-D04 directions remain
unaccepted, R9.4 remains reopened, R10.1-A and R10.2-A remain selected, and
R10.3-R10.8 remain pending. No runtime, capture, evidence, installation, save,
or snapshot was touched.
