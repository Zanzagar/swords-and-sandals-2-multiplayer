# Handoff — uniformly shuffled Relic offer order selected

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 07:07:35
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.20, the legal custody identity of an already-created,
already-recipient-assigned Soul Relic instance. The owner selected C3c.19-B:
uniformly shuffle the displayed candidate set once and commit that order with
the offer. Preserve accepted EP-D02 until a complete replacement is replayed
and explicitly accepted. Do not implement.

## Selected direction

After candidate membership is fixed, every permutation of the displayed two or
three definitions has equal probability. The realized order commits atomically
with the offer and survives reload, reconnect, and replay of that same
settlement. It never changes membership, sampling probability, or the stable
definition selected. Exact shuffle algorithm, PRNG, and seed remain open.

## Frontier correction

A narrow dependency audit confirmed that the queued custody decision is not
personal-versus-team reward attribution; acquisition sources and pending EP-D05
must precede that later issue. Custody here means the durable legal title of an
already-created, already-assigned instance. It also remains separate from the
human/system actor authorized to exercise that title and from transfer.

## Sole active choice

C3c.20 asks which identity owns the Relic while C3c.5-A continues to permit
build access only through one combatant collection:

- **A, recommended — combatant title:** exactly one `ownerCombatantId`; even a
  pending personal escrow remains that combatant's property. This does not yet
  forbid a later atomic transfer.
- **B — campaign title with exclusive combatant placement:** the campaign owns
  the instance, which may be unavailable in campaign custody or placed with
  exactly one combatant; campaign ownership alone grants nobody access.
- **C — global player-profile title with exclusive combatant placement:** a
  new stable profile owns the instance across campaigns, but only its one placed
  combatant may access it.

A best matches the personal-item direction and keeps title beside build history.
Its cost is that retirement, deletion, or corruption needs an explicit
non-stranding rule instead of automatically returning the Relic to a party or
account. An owner replacement may split legal title from a neutral custodial
service. Authorized actor, recipient attribution, transfer permission/horizon,
inventory capacity, retirement/deletion, durability, loss/recovery,
acquisition, Charm custody, configuration horizon, persistence/migration, and
release remain later.

## Verification and preserved state

A narrow read-only audit passed C3c.20 as prerequisite-correct, atomic,
mutually exclusive, non-vacuous, compatible with combatant-only access, and
free of implied transfer or reassignment. `git diff --check` passed before this
handoff. No code tests were run because the changes are documentation-only.

The authoritative decision record, system design, and readiness record remain
unchanged. EP-D01, EP-D02, and EP-D07 remain accepted; EP-D04 directions remain
unaccepted, R9.4 remains reopened, R10.1-A and R10.2-A remain selected, and
R10.3-R10.8 remain pending. No runtime, capture, evidence, installation, save,
or snapshot was touched.
