# SS2 Team Arena roadmap

The destination remains cooperative SS2 campaign play with 2v2 and 3v3
battles. The 1v1 work is a parity gate for one shared resolver, not a reduction
of team scope or a separate game mode architecture.

## Delivery sequence

| Stage | Deliverable | Status |
| --- | --- | --- |
| 0. Deterministic foundation | Asset-free 1–3 combatants per team, AI, hot-seat/remote controller identities, replay, wire state, and state hashes | complete |
| 0b. Team-resolver seam | One shared resolver in `src/team/` for 1v1/2v2/3v3, injected rule set, ordered authoritative RNG channel, seat/controller split, AI fill, team elimination, once-only settlement | complete, running placeholder rules. Widened since: `src/team/resources.js` gives a combatant a declared, clamped, **projected and hashed** numeric bag, and `EffectKind.RESOURCE` an absolute write to it, so the measured armour-first split has somewhere to live that the state hash covers |
| 1. Licensed-build map | Battle entry, state objects, RNG, formulas, spells, results, clips, and Collection mod route | complete for the fingerprinted build |
| 2. 1v1 parity harness | Fingerprint-keyed static candidates, strict ordered RNG/mutation traces, isolated rule candidate, acknowledgement-token result bridge | complete. **60 candidates** authored in `test/fixtures/ss2-1v1/`, across two ingresses asserted disjoint: the physical attack (`src/golden/ss2-attack-candidate.js`) and the spell (`src/golden/ss2-spell-candidate.js`). The five newest are the `candidate-champion-*` family, authored by decoding the tournament rank-1 boss's hard-coded DNA out of the battle map rather than from any capture — the same derive-from-the-map rule every other candidate follows |
| 3. Runtime golden capture | Repeat controlled attacks in the licensed build and promote matching candidates to runtime-observed goldens | **22 goldens promoted** — twelve prisoner kills covering all twelve melee attack directions, plus five probe pairs that *measure* (`rollneeded` per band, the critical-deflection threshold, the armour-selection draw). Each cleared the same gate: ≥2 matching observations from ≥2 independent sessions; 47 of the 67 records in `test/observations/ss2-1v1/` are cited by a golden. Capture runs are unattended; parallel capture works (`run-campaign.ps1 -Concurrency`, since `e4d02a3`); and the leveled-gladiator arena route runs end to end against the real build (`run-arena.ps1 -Navigate arena`, [the arena route](integration/ss2-arena-route.md), now an *executed* map rather than a static one), which is the route the armoured, tournament and champion families need and the prologue/prisoner pair could never reach. So the remaining work is breadth: **38** authored candidates still have no golden. **37** of those have no matching observation at all; the exception is `candidate-duel-firstblood-normal-kill`, which has exactly one, so it is one independent session short of the gate. The spell family has never had a capture session at all |
| 4. SS2 adapter and UI seam | Convert vanilla combatants to canonical state; bind events to fighter clips, panels, and final result acknowledgement | landed asset-free in `src/adapter/`: state bridge, slot layout, presentation commands, acknowledgement bridge, and `battle-host.js`, the reference loop that drives both seams together. Nothing has been run against the licensed build — no capture has ever observed a clip label, and everything past slot 0 of each side is an authored mod surface vanilla cannot settle. The two holes previously named here are closed: `toCanonicalCombatantSource` emits a twenty-entry canonical `resources` bag on **both** sides of the vanilla binding and `vanillaWritesForResolvedAction` has a `RESOURCE` branch, so a rule set's armour-first split reaches `armourclass` as two ordered writes; and a drawn battle now settles on its last death animation, since vanilla dispatches no draw transition to wait for. Since then "the adapter decides no combat" stopped being a description and became a check: `WriteSource`, `ALLOWED_WRITE_FIELDS` and `assertWriteProvenance` require every vanilla write to name a closed-set source and to carry a value `===` what the post-action projection holds there, so `to: before - amount` cannot be expressed — the five combat-deciding edits an adversarial audit landed while the suite stayed green are all caught. `host.acknowledgeResultAnimations()` now defaults nothing, so the adapter can no longer satisfy both settlement gates by talking to itself, and `hitpointsmax` is refused rather than silently rewritten for a supplied gladiator. Two gaps are left, both named in [the adapter contract](ss2-adapter-contract.md): core `roster.js` now accepts per-slot `aiFill`, but `battle-host.js` still carries the obsolete one-template-per-team projection workaround and can report `diagnostics.aiFillResourceGaps` for differing templates; and there is **no per-action animation acknowledgement**, so nothing sequences action N+1's rebind of the four binding globals against action N's running timeline |
| 4b. Human session lifecycle | Distinct-human allied-seat admission, command authority, durable action-boundary pause, authenticated same-seat reconnect, visible accepted grace timer, and connected-team abandonment flow | required by accepted Endless EP-D07 before a playable team proof; not started. The dropout authority rule is accepted, while local multi-input versus remote transport, presence/authentication, exact duration/storage, and reconnect-versus-abandon serialization remain open. Generic controller reassignment is not a substitute, timeout is not automatic loss, and allied AI may not finish the MVP battle |
| 5. 2v2 campaign co-op | Two distinct human-controlled persistent allies, opponent AI, two-team elimination, campaign roster/save/reward integration, and a four-slot arena | generic mechanics landed asset-free, but EP-D07's admission/session policy has not. The **campaign save** landed too: `src/campaign/` is the separate, additive, versioned team-battle record (schema v2, migration chain, content-addressed keys, corruption quarantine) — see [campaign persistence](campaign-persistence.md). Persistent roster read-back, rewards, human session transport, pause/reconnect, and any *rendered* arena are not started; the four-slot geometry is derived but nothing draws it |
| 6. 3v3 campaign co-op | Up to three distinct human-controlled allied gladiators, six-slot arena, team targeting, persistence, and balance passes | the six-slot resolver path runs and replays deterministically, and `src/adapter/slot-layout.js` derives six slots' clip instances, depths, positions and panel bindings (tested at 1v1, 2v2, 3v3 and 1v3). Persistence is the same Stage 5 record. Rendering and balance are not started. Allied AI companions/fill or one-human multi-seat control are possible future designs, not promised Stage 6 features |
| 7. Broader online synchronization | Host-authoritative public lobby/matchmaking transport, authentication, desync recovery, and observed-result diagnostics beyond the minimum Stage 4b session | planned; the controller-independent combat hash and the ordered RNG journal it needs exist |

Stage 0b is a structural stage, not a parity stage, and neither it nor the
resource widening changes what is verified. The runtime-verified behaviour in
this repository is the 22 promoted goldens and nothing else, and **none of it
has been injected into the resolver**: `defineTeamRuleSet` is called exactly
once outside the tests, from `src/team/placeholder-rules.js`, and what it
builds declares `verification: "placeholder"`. Every formula the resolver runs
today is labelled as a placeholder in code, in the wire state, in a campaign
record's `provenance.ruleSet` block, and in the docs.

What a golden proves is narrower than "the build behaves this way", and the
distinction matters before any of it is injected. A capture observes the
ordered mutation trace, the semantic events, the final state,
`attack_direction`, `fight_mode`, and the *number* of RNG draws. Every roll
line's label, bounds, value and call site is **echoed from the candidate**, not
observed — the wrapper serves its tape from a tap on `Math.random`, which takes
no arguments. `expected.calculation` and `expected.mutation` are never
compared. The full account is in
[the runtime capture doc](integration/ss2-runtime-capture.md).

## Campaign co-op constraints

- Every 1v1, 2v2, and 3v3 action must converge on the same resolver and ordered
  authoritative RNG channel once runtime parity is established.
- An individual knockout emits a combatant-defeated event. Campaign settlement
  and rewards occur once, only after an entire team is eliminated and the final
  animation is acknowledged.
- Controller identity is independent of combatant identity. The generic engine
  can mix local, hot-seat, remote, and AI controllers without a second combat
  implementation, but accepted Endless EP-D07 forbids allied AI, multi-seat
  human control, and takeover in the first playable version; each allied seat
  requires a distinct connected human.
- Campaign saves add a separate team-battle record and migration version; they
  do not overwrite vanilla save fields while the adapter is experimental.
- A minimum genuine multi-human session, action-boundary pause, and reconnect
  protocol is now a prerequisite to playable 2v2 rather than a post-local
  stage. Its accepted dropout flow lets every connected roster member approve
  abandonment only after each absent member's visible grace expires; expiry
  alone changes nothing, a partial reconnect does not resume a multiple-dropout
  battle, and any presence change makes the old proposal stale. Recovery keeps
  the original roster and human-seat admission.
  Broader online lobby/matchmaking remains later and is not a different ruleset.

## How the constraints are met today

| Constraint | Where it lives | State |
| --- | --- | --- |
| one shared resolver and ordered RNG channel | `src/team/resolver.js`, `src/team/rng.js` | done; `src/engine.js` is a façade over it and 1v1 has no separate path |
| knockout ≠ settlement | `src/team/elimination.js`, `src/team/settlement.js` | done; a knockout emits `defeated` only |
| settle once, after elimination *and* acknowledgement | `src/team/settlement.js` | done; two gates, private latch, repeats return `false`. The token those gates match on now names **one battle**, not one result: it is `<outcome prefix>:<battle discriminator>`, the discriminator being the battle's arm-time `combatStateHash`, and `arm()` requires it. A campaign of consecutive bouts between the same two teams used to hand every bout the same token, so bout 1's acknowledgement settled bout 2 with bout 1's winner |
| controller identity independent of combatants | `src/team/controllers.js` | done; seat → controller registry, excluded from the combat hash |
| AI fill for empty slots, no second path | `src/team/roster.js` | done; filled fighters use the same constructor and protocol |
| verified rules replace placeholders by injection | `src/team/rule-set.js`, `src/team/resources.js`, `src/adapter/state-bridge.js` | seam done, wide enough to carry the measured operands, and now actually fed: a rule set reads `armourclass`/`staminaleft`/`charisma` as declared resources and writes them with an absolute `resource` effect, and the adapter emits the twenty-entry bag from vanilla and mirrors the resolved value back. **No verified rule set exists yet**, and nothing measured has been dropped into the seam |
| campaign save: separate, additive, versioned | `src/campaign/` | done. Schema v2 with a migration chain, content-addressed immutable keys, digest-checked reads, corruption quarantine. The "does not overwrite vanilla save fields" half is structural, not aspirational: the layer has **no read or write path for the vanilla save at all**, every key is minted under `ss2TeamArena:`, and every payload is screened against the vanilla field-name catalogue |
| campaign roster read-back and rewards | — | not started; a record is written and never read back into a battle, and nothing pays a reward |
| six-slot arena layout, clips, panels | `src/adapter/slot-layout.js`, `src/adapter/presentation.js` | derived asset-free and tested for 1v1/2v2/3v3/1v3, and emitted as inert JSON presentation commands. Nothing renders them, and everything past slot 0 of each side is an authored mod surface no capture can settle |
| distinct-human admission and pause/reconnect transport | — | not started; required by accepted EP-D07 before playable 2v2 (Stage 4b) |
| broader host-authoritative online transport | — | not started (Stage 7) |

The rule-set interface, the event and acknowledgement protocol, the settlement
guarantee, the resource bag, and the controller/combatant split are specified
in [the adapter contract](ss2-adapter-contract.md). The campaign record's
schema, migration chain, and vanilla boundary are specified in
[campaign persistence](campaign-persistence.md).

## What this roadmap cannot verify from the repository alone

Two of the claims above rest on evidence the repo can only carry, not check,
and a reader should know which:

- **That a golden's observations came from the licensed build at all.** Ingest
  and promotion enforce a great deal — exact-key validation, digest integrity,
  install-hash attestation before and after each session, unconditional
  rejection of the `synthetic-simulator` capture method, a mandatory
  `capture.overdraw` on every injected-tape trace, and a refusal to promote two
  observations that share a `capture.launchNonce`. The nonce is the one
  identity field on a record the operator did not choose: it is minted inside
  the player before the `Math` tap is installed. **The core claim survives
  anyway.** The nonce narrows the gap rather than closing it — it distinguishes
  *player launches*, not processes; absence is never read as a shared value, so
  it binds only records that carry one; and it is still a line in a trace file,
  which is one more line for a forger to edit and no kind of barrier. The
  capture method and the session id remain operator strings in the meta line
  and the manifest, so nothing in the repository can distinguish an honestly
  captured session from a well-formed forgery; that assurance comes from the
  operating procedure, not from a test. For the **22 goldens already promoted**
  the claim holds in its original literal form as well: not one of them cites a
  nonce-bearing observation, so their independence is exactly the two operator
  strings (9 of the 67 committed records carry a nonce, and none is cited by a
  golden).
- **That anything the adapter dispatches matches the build.** No capture has
  ever observed a clip label, a depth, a position, or a panel instance. Those
  are static-map readings at best; the multi-slot half of them is authored mod
  surface that vanilla has no counterpart for, so no capture could settle it
  even in principle.

Original game binaries and assets remain outside the repository. Distributable
work is limited to independently authored source, metadata, fixtures, and
patches.
