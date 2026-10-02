# Handoff — EP-D02 Soul Relic access scope refined

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 04:42:12
**Branch:** `design/endless-progression-owner-packet`

Resume with only revised EP-D02-C3c.5, Soul Relic access scope. The owner has
not selected an option. Do not infer personal access from the owner's first
question or global-profile access from the follow-up proposal. Present the
revised A/B/C once, then record only the chosen direction. Preserve accepted
EP-D02 until a complete replacement is later replayed and explicitly accepted.
Do not implement.

## Why the card changed

The owner observed first that Soul Relics are items and therefore suggested
per-gladiator treatment, then proposed that they could instead be account-wide
while earned individually. That exposes two compatible but independent rules:
access scope and earning attribution. **Codex correction:** an intermediate
draft incorrectly made individual earning provenance a premise of the access
card. It was removed before owner selection. The prior C3c.5 typed-scope
alternative and its recommendation were also withdrawn.

## Sole active choice

Each revised option uses exactly one access key with no fallback or union:

- **A — combatant collection:** only the `combatantId` collection makes the
  Relic a candidate;
- **B — campaign collection:** the `campaignId` collection makes it a candidate
  for every otherwise-eligible campaign gladiator;
- **C, recommended — global player-profile collection:** one new stable
  `playerProfileId` collection makes it a candidate for linked gladiators across
  campaigns, but not for another player's teammate.

Example: Ashen is present in the selected collection. A exposes it only to
Aster; B exposes it to Aster and Cassia in Campaign One but not Campaign Two; C
exposes it to the linked player's gladiators in either campaign but not teammate
Cassia on another profile. How Ashen entered that collection remains open.

C best avoids repeat collection grind without gifting access to teammates. Its
cost is real: the repository defines no global player identity, so C selects
semantic cross-campaign access and creates a required stable profile link plus
later storage, synchronization, and migration work. It also needs individual
eligibility gates against fresh-gladiator power leakage.

This choice still does not decide who earns or receives a Relic, Charm access,
entitlement versus item-instance semantics, duplicates/concurrent use,
custody/transfer, exact acquisition, loss/consumption, counts, attachment,
budget, compatibility, configuration horizon, implementation, or release.

## State preserved

C3c.4-C remains selected. C3c.5 is pending under its revised alternatives.
EP-D01, EP-D02, and EP-D07 remain accepted; no authoritative rule changed.
EP-D04 directions remain unaccepted, R9.4 remains reopened, R10.1-A and
R10.2-A remain selected, and R10.3-R10.8 remain pending. Implementation remains
blocked, and no runtime, capture, evidence, installation, save, or snapshot was
touched.
