# Handoff — persistent Relic custodian authority selected

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-12 10:48:50
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.22, the maximum voluntary transfer scope for a
combatant-owned Soul Relic. The owner selected C3c.21-A: only that combatant's
persistent custodian may approve the owner side of later-permitted
discretionary Relic mutations. Preserve accepted EP-D02 until a complete
replacement is replayed and explicitly accepted. Do not implement.

## Selected direction

Only the owning combatant's stable `custodianMemberId` may approve the owner
side of a later-permitted discretionary Soul Relic mutation. Seat, current
controller, campaign host, teammate, and AI status grant no authority. If the
custodian is unavailable, the choice remains pending unless a later explicit
recovery rule applies. Deterministic settlement and invariant enforcement
remain system actions rather than discretionary choices.

## Sole active choice

C3c.22 asks whether title may voluntarily move to another combatant and the
widest permitted domain:

- **A, recommended — no voluntary transfer:** gifting, trading, lending, and
  beneficiary-changing storage are illegal. Recovery/migration may only restore
  the intended owner.
- **B — same-campaign only:** an eligible combatant in the same campaign may
  receive the exact instance under later consent and timing rules.
- **C — cross-campaign permitted:** an eligible combatant outside the campaign
  may receive it; gifting, barter, markets, fees, and discovery remain separate.

A protects character-earned identity and collection pacing and prevents carry
funneling or market pressure. It sacrifices teammate gifting, alt inheritance,
and ordinary buyer's-remorse correction; character retirement/deletion needs a
separate terminal rule. Any admitted move preserves instance ID/provenance and
cannot bypass access, eligibility, or one-per-definition. An owner replacement
may allow only retirement inheritance or same-human transfers. Consent,
horizon/frequency, consideration/channel, lifecycle, acquisition/attribution,
Charm transfer, configuration horizon, persistence/migration, and release
remain later.

## Verification and preserved state

A narrow read-only audit passed C3c.22 as prerequisite-correct, atomic,
mutually exclusive, non-vacuous, and consistent with the selected instance,
access, uniqueness, ownership, and authority rules. `git diff --check` passed
before this handoff. No code tests were run because the changes are
documentation-only.

The authoritative decision record, system design, and readiness record remain
unchanged. EP-D01, EP-D02, and EP-D07 remain accepted; EP-D04 directions remain
unaccepted, R9.4 remains reopened, R10.1-A and R10.2-A remain selected, and
R10.3-R10.8 remain pending. No runtime, capture, evidence, installation, save,
or snapshot was touched.
