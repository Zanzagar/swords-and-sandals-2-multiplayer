# Handoff — combatant-owned Soul Relics selected

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 07:16:39
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.21, the durable owner-side authority for any
later-permitted discretionary mutation of a combatant-owned Soul Relic. The
owner selected C3c.20-A: every created Relic is legally titled to exactly one
current `ownerCombatantId`. Preserve accepted EP-D02 until a complete
replacement is replayed and explicitly accepted. Do not implement.

## Selected direction

Every created Soul Relic has exactly one stable current `ownerCombatantId`. A
pending personal escrow may sit outside inventory capacity but remains titled
to that combatant. Campaign, member, controller, seat, and profile identities
do not own it. This does not make the title permanent and does not authorize a
transfer; those remain later choices.

## Sole active choice

C3c.21 asks who may approve the owner side of any discretionary Relic mutation
that a later rule actually permits:

- **A, recommended — persistent custodian:** only the combatant's stable
  `custodianMemberId`; temporary controller, seat, host, teammate, and AI gain
  no authority. An unavailable custodian leaves the choice pending.
- **B — authenticated current controller:** the current controller may act even
  when different from the custodian. A real supported divergence is required;
  this is dormant in accepted first-playable play.
- **C — campaign governance:** a later group protocol approves every mutation
  and must be able to reject the owner's preferred action in a real multi-member
  case.

A preserves permanent-item authority across temporary control and hosting. Its
cost is that disconnection or custodian loss needs an explicit recovery rule.
An owner replacement may assign different authorities by operation. Automatic
deterministic settlement remains system work, not a discretionary choice.
Operation set, transfer permission/horizon, recipient consent, timeout/default
and authority recovery, retirement/deletion, inventory capacity, durability,
loss/recovery, acquisition/recipient attribution, Charm custody, configuration
horizon, persistence/migration, and release remain later.

## Verification and preserved state

A narrow read-only audit passed C3c.21 as prerequisite-correct, atomic,
mutually exclusive, non-vacuous, and compatible with D07's current
controller/custodian alignment and future-mode boundary. `git diff --check`
passed before this handoff. No code tests were run because the changes are
documentation-only.

The authoritative decision record, system design, and readiness record remain
unchanged. EP-D01, EP-D02, and EP-D07 remain accepted; EP-D04 directions remain
unaccepted, R9.4 remains reopened, R10.1-A and R10.2-A remain selected, and
R10.3-R10.8 remain pending. No runtime, capture, evidence, installation, save,
or snapshot was touched.
