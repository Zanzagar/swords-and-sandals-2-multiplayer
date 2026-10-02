# Handoff — EP-D02 Capacity ownership confirmation pending

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 01:50:15
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C1, Capacity ownership, at the top of the owner packet.
Do not present C2 or any R9/R10 choice in the same turn. Preserve the accepted
EP-D02 rule unless the owner later explicitly accepts a complete replacement.
Do not implement anything.

## Owner answer recorded

The owner's `A` selected the full-uniform-assurance remediation path, not any
EP-D02 product option. The path is twelve atomic D02 confirmations, nine atomic
D07 confirmations, the atomic R9.4 repair, and then corrected R10.3. Exactly one
prerequisite-ready A/B/C product choice must be presented per owner turn.

## Sole active choice

EP-D02-C1 distinguishes:

- **A, recommended/current accepted direction:** personal Capacity owned solely
  by persistent `combatantId`, with no pooling, loan, transfer, copying,
  averaging, or projection from another gladiator;
- **B:** one campaign-wide unlock value applies independently to every owned
  gladiator; or
- **C:** entered gladiators contribute their earned values to a frozen Circuit
  team pool that may be reallocated across allied loadouts.

The concrete boundary is a 32-capacity veteran and 8-capacity novice before any
lower-route clamp: A preserves 32/8, B permits 32/32 and grants 32 to new alts,
and C permits reallocating the combined 40, such as 36/4, for that Circuit.
A confirmation does not decide later recipients, qualifying victories, cadence,
or route projection. A selects confirmation of the current ownership direction;
B/C selects a revision direction only. The accepted clause remains authoritative
until a complete replacement is replayed and explicitly accepted.

## State preserved

EP-D01, EP-D02, and EP-D07 remain accepted. EP-D04 directions remain unaccepted;
R9.4 is reopened, R10.1-A and R10.2-A remain selected, and R10.3–R10.8 remain
pending. EP-D03, EP-D05, EP-D06, and EP-A01–EP-A03 remain pending. The
authoritative decision record is unchanged, implementation remains blocked, and
no vanilla evidence or runtime state was touched.
