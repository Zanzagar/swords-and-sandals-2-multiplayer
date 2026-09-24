# Handoff — EP-D02 simultaneous item-host confirmation pending

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 01:59:47
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C2, simultaneous item-host grammar, at the top of the
owner packet. Do not present C3 or any R9/R10 choice in the same turn. Preserve
the accepted EP-D02 rule unless the owner later explicitly accepts a complete
replacement. Do not implement anything.

## Owner answer recorded

The owner's `A` confirmed EP-D02-C1's current personal Capacity direction.
Capacity remains owned solely by each persistent `combatantId`, without pooling,
loan, transfer, copying, averaging, or projection from another gladiator. This
confirmation changes no authoritative wording and does not decide recipients,
victory eligibility, cadence, or route projection.

## Sole active choice

EP-D02-C2 concerns item-position eligibility and concurrency only:

- **A, recommended/current accepted direction:** all sixteen mapped positions
  are simultaneous behavior hosts; both weapons remain counted even though only
  the selected weapon's effect operates, and at least one compatible
  all-sixteen-Legendary composition must exist;
- **B:** the eight worn and six carried positions remain hosts, but the weapon
  pair shares one host and a swap is an atomic validated host transition; or
- **C:** both weapons and the eight worn positions are hosts, while all six
  carried spell/Technique positions cannot carry rarity behavior payloads.

The symbolic boundary equips payload-bearing primary `P`, secondary `S`, and
carried Technique `T` with `P` selected. A counts `P + S + T`; B counts `P + T`
and validates a switch to `S`; C counts `P + S` and prohibits a rarity behavior
on `T`. Payload costs remain C4; standalone/non-item sources remain C3.

An A confirms only the current host direction. B/C selects a revision direction
only; accepted clauses remain authoritative until a complete replacement is
replayed and explicitly accepted.

## State preserved

Full uniform assurance remains selected. EP-D02-C1-A is confirmed; C2 is
pending, and C3–C12 remain unconfirmed. EP-D01, EP-D02, and EP-D07 remain
accepted. EP-D04 directions remain unaccepted; R9.4 is reopened, R10.1-A and
R10.2-A remain selected, and R10.3–R10.8 remain pending. EP-D03, EP-D05, EP-D06,
and EP-A01–EP-A03 remain pending. The authoritative decision record is unchanged,
implementation remains blocked, and no vanilla evidence or runtime state was
touched.
