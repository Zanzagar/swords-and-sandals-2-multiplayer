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
| 3. Runtime golden capture | Repeat controlled attacks in the licensed build and promote matching candidates to runtime-observed goldens | **23 goldens promoted** — twelve prisoner kills covering all twelve melee attack directions, plus five probe pairs that *measure* (`rollneeded` per band, the critical-deflection threshold, the armour-selection draw), plus **one armoured tournament golden**, `golden-armoured-deflection-threshold-cleared`. *(The enumeration accounted for only 22 until 2026-09-07: the headline number was corrected to 23 and the list behind the em-dash was not, so 12 + 10 = 22 and the 23rd went unnamed. Re-derived: 23 files, `fightMode` 22 misc / 1 tournament, villain `armourclass` 0 in 22 of 23.)* Each cleared the same gate: ≥2 matching observations from ≥2 independent sessions; 62 of the 69 records in `test/observations/ss2-1v1/` are cited by a golden. Capture runs are unattended; parallel capture works (`run-campaign.ps1 -Concurrency`, since `e4d02a3`); and the leveled-gladiator arena route runs end to end against the real build (`run-arena.ps1 -Navigate arena`, [the arena route](integration/ss2-arena-route.md), now an *executed* map rather than a static one), which is the route the armoured, tournament and champion families need and the prologue/prisoner pair could never reach. So the remaining work is breadth: **37** of the 60 authored candidates still have no golden. **36** of those have no matching observation at all; the exception is `candidate-duel-firstblood-normal-kill`, which has exactly one, so it is one independent session short of the gate. The spell family has never had a capture session at all |
| 4. SS2 adapter and UI seam | Convert vanilla combatants to canonical state; bind events to fighter clips, panels, and final result acknowledgement | landed asset-free in `src/adapter/`: state bridge, slot layout, presentation commands, acknowledgement bridge, and `battle-host.js`, the reference loop that drives both seams together. Nothing has been run against the licensed build — no capture has ever observed a clip label, and everything past slot 0 of each side is an authored mod surface vanilla cannot settle. The two holes previously named here are closed: `toCanonicalCombatantSource` emits a twenty-entry canonical `resources` bag on **both** sides of the vanilla binding and `vanillaWritesForResolvedAction` has a `RESOURCE` branch, so a rule set's armour-first split reaches `armourclass` as two ordered writes; and a drawn battle now settles on its last death animation, since vanilla dispatches no draw transition to wait for. Since then "the adapter decides no combat" stopped being a description and became a check: `WriteSource`, `ALLOWED_WRITE_FIELDS` and `assertWriteProvenance` require every vanilla write to name a closed-set source and to carry a value `===` what the post-action projection holds there, so `to: before - amount` cannot be expressed — the five combat-deciding edits an adversarial audit landed while the suite stayed green are all caught. `host.acknowledgeResultAnimations()` now defaults nothing, so the adapter can no longer satisfy both settlement gates by talking to itself, and `hitpointsmax` is refused rather than silently rewritten for a supplied gladiator. **The last gap named here is CLOSED (2026-09-07)**: the per-action animation acknowledgement is built — every presentation command carries an `actionToken` naming the resolved action it belongs to, `src/adapter/action-gate.js` is the gate a host consults before submitting the next action, and `createVanillaBattleHost({ awaitAnimations: true })` makes `submit` refuse while a token is unreported. **Read [the adapter contract](ss2-adapter-contract.md) item 5 before building on it**: the mechanism this row and that entry both proposed was WRONG — `event.sequence` is stamped per EVENT and one action emits up to four, so the token comes from `lastResolvedAction(battle).firstEventSequence`, which the caller carries in because projecting it would move every pinned battle hash. What is still absent, deliberately: any timeout. Nothing has captured the vanilla timeline's own completion signal, so a host that gives up says so itself with a mandatory reason, and the seam is ahead of its consumer — no renderer exists. *(This cell said TWO gaps until 2026-09-07 and the first was already closed. `team.aiFill` takes a per-slot array and the empty-slot marker carries its own fields, so each filled slot gets its own resource bag; `diagnostics.aiFillResourceGaps` no longer exists on the host — the frozen diagnostics object names `aiFilledSlots`, `aiFillMirrorRewrites`, `aiFillLoadoutGaps`, `canonicalSyncs`, `maximumHealthReports` and `startingStatusEffects`, and the old key survives only in comments describing what it used to do. Re-derived against `src/team/roster.js` and `src/adapter/battle-host.js`, not taken from the cell.)* |
| 5. 2v2 campaign co-op | Player-controlled allies, AI fill, two-team elimination, campaign roster/save/reward integration, and a four-slot arena | mechanics landed asset-free. The **campaign save** landed too: `src/campaign/` is the separate, additive, versioned team-battle record (schema v2, migration chain, content-addressed keys, corruption quarantine) — see [campaign persistence](campaign-persistence.md). **Roster read-back landed 2026-09-07** (`src/campaign/to-battle.js`), and so did the first thing that CONSUMES it: `node tools/hotseat.mjs --circuit <n>` fights consecutive bouts with the survivors carried between them (`src/campaign/circuit.js`; see the constraint table below). Rewards and any *rendered* arena are not started; the four-slot geometry is derived but nothing draws it. *(This cell called read-back "not started" until 2026-09-07, while the constraint table in this same file already recorded it as landed. When two rows of one document disagree, the one nearer the code wins — and both are now correct.)* |
| 6. 3v3 campaign co-op | Up to three allied controllers or AI fills, six-slot arena, team targeting, persistence, and balance passes | the six-slot resolver path runs and replays deterministically, and `src/adapter/slot-layout.js` derives six slots' clip instances, depths, positions and panel bindings (tested at 1v1, 2v2, 3v3 and 1v3). Persistence is the same Stage 5 record. Rendering and balance are not started |
| 7. Online synchronization | Host-authoritative transport, lobby/auth, reconnect, desync recovery, and observed-result diagnostics | planned; the controller-independent combat hash and the ordered RNG journal it needs exist |

Stage 0b is a structural stage, not a parity stage, and neither it nor the
resource widening changes what is verified. The runtime-verified behaviour in
this repository is the 23 promoted goldens and nothing else.

► **UPDATED 2026-09-02. The paragraph that stood here said "none of it has been
  injected into the resolver" and that `defineTeamRuleSet` is called exactly
  once outside the tests. Both are now false.** `src/team/ss2-rules.js` injects
  SS2's own attack arithmetic, all 23 goldens replay through
  `createTeamBattle`/`applyAction`, and `tools/hotseat.mjs` plays it. What has
  NOT changed is the tier: that rule set declares `verification: "map-derived"`
  and `runtimeVerified: false`, because no capture has observed it running.
  What the goldens back is the attack ingress it delegates to, for directions
  1-12. ► **CORRECTED 2026-09-07: "zero armour" is stale and was written the
  day before the first armoured golden was promoted.** One golden stages a
  villain at `armourclass 79` (helmet 6, shoulderguard 1, gauntlet 1, greaves 2)
  in `fightMode: "tournament"` and measures absorption **79 → 57**; the other 22
  carry `armourclass 0` and `fightMode: "misc"`. **Enchantment coverage really
  is zero** — no golden carries a non-zero `weapon_enchantment_potency`. The
  stamina economy, action legality and AI policy around it still have no runtime
  backing at all.

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
- Controller identity is independent of combatant identity. A campaign team can
  mix local, hot-seat, remote, and AI-controlled allies without a second combat
  implementation.
- Campaign saves add a separate team-battle record and migration version; they
  do not overwrite vanilla save fields while the adapter is experimental.
- Online co-op is a transport stage after local deterministic 2v2/3v3 behavior,
  not a different ruleset.

## How the constraints are met today

| Constraint | Where it lives | State |
| --- | --- | --- |
| one shared resolver and ordered RNG channel | `src/team/resolver.js`, `src/team/rng.js` | done; `src/engine.js` is a façade over it and 1v1 has no separate path |
| knockout ≠ settlement | `src/team/elimination.js`, `src/team/settlement.js` | done; a knockout emits `defeated` only |
| settle once, after elimination *and* acknowledgement | `src/team/settlement.js` | done; two gates, private latch, repeats return `false`. The token those gates match on now names **one battle**, not one result: it is `<outcome prefix>:<battle discriminator>`, the discriminator being the battle's arm-time `combatStateHash`, and `arm()` requires it. A campaign of consecutive bouts between the same two teams used to hand every bout the same token, so bout 1's acknowledgement settled bout 2 with bout 1's winner |
| controller identity independent of combatants | `src/team/controllers.js` | done; seat → controller registry, excluded from the combat hash |
| AI fill for empty slots, no second path | `src/team/roster.js` | done; filled fighters use the same constructor and protocol |
| verified rules replace placeholders by injection | `src/team/rule-set.js`, `src/team/ss2-rules.js`, `src/team/resources.js`, `src/adapter/state-bridge.js` | seam done, and now fed with MAP-DERIVED arithmetic — **this cell used to say "MEASURED", which is a defined tier in this project's own vocabulary and the wrong one; corrected 2026-09-07 after a design panel flagged that the cell contradicted itself in its own next sentence**: `src/team/ss2-rules.js` runs the build's own attack path, reads ~40 vanilla fields through the resource and status channels, and replays all 23 goldens through the resolver. **Still no RUNTIME-VERIFIED rule set** — it declares `map-derived` / `runtimeVerified: false`. The adapter path cannot feed it: `CANONICAL_RESOURCE_SOURCES` carries none of the eight armour piece ids, `min_damage`, `max_damage`, `character_level`, `equipped_weapon` or `herolevel`, and `maximumHealth` refuses rather than defaulting |
| campaign save: separate, additive, versioned | `src/campaign/` | done. Schema v2 with a migration chain, content-addressed immutable keys, digest-checked reads, corruption quarantine. The "does not overwrite vanilla save fields" half is structural, not aspirational: the layer has **no read or write path for the vanilla save at all**, every key is minted under `ss2TeamArena:`, and every payload is screened against the vanilla field-name catalogue |
| campaign roster READ-BACK | `src/campaign/to-battle.js` | **landed 2026-09-07.** `rosterFromCampaignRecord(record, { blueprints })` carries a settled bout's survivors into the next one at the health and conditions the record measured, names the fallen rather than dropping or reviving them, and leaves an empty slot rather than backfilling it. It needs the BLUEPRINTS as well as the record, and that is a property of the format rather than a shortcut: `outcomes` carry survival, health, maxHealth and statuses and carry NO stats, loadout or resources, so a record alone cannot rebuild a gladiator |
| campaign CIRCUITS — consecutive bouts, survivors carried | `src/campaign/circuit.js`, `tools/hotseat.mjs --circuit` | **landed 2026-09-07, and it is the read-back's first consumer.** `advanceCircuit(battle, { blueprints, challengers, sides })` takes a settled bout to the next one's teams, refilling the eliminated side with a fresh challenger. Two things it REPORTS rather than decides: `restoredResources`, because a record carries no resources, so a survivor rebuilt from his blueprint gets his **armour and stamina back** — measured, a fighter ending at `armourclass 0` re-enters at `495` — and `facingCorrections`, because `facing-left` is a carried status token and a fighter moved across the arena would otherwise keep the facing of the side he left. Neither is fixed here: free repair between fights is a balance decision and EP-A03 owns it. **There is no default length** — four fights is EP-D03 and EP-D03 is `pending`, so `circuitLength()` refuses an absent value and names the decision |
| campaign rewards | — | still not started, and deliberately: paying a reward is a progression decision, and the accepted EP decisions live on the design track with EP-D04 pending. A seam that healed or paid the survivors would be a balance choice wearing the costume of a data structure |
| six-slot arena layout, clips, panels | `src/adapter/slot-layout.js`, `src/adapter/presentation.js` | derived asset-free and tested for 1v1/2v2/3v3/1v3, and emitted as inert JSON presentation commands. Nothing renders them, and everything past slot 0 of each side is an authored mod surface no capture can settle |
| host-authoritative transport | — | not started (Stage 7) |

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
  operating procedure, not from a test. **This paragraph used to add that the
  claim held in its original literal form for all promoted goldens, because
  not one cited a nonce-bearing observation. That stopped being true when the
  four self-citing normal-band goldens were re-promoted:** all 11 nonce-bearing
  records are now cited, across 5 of the 23 goldens, so those five rest partly
  on an identity the operator did not choose. The other 18 still rest on two
  operator strings and the enumerated pre-nonce waiver. *(Counts re-derived
  2026-09-07: they read 9 records across 4 of 22 and were stale in all three
  numbers. The remainder is still 18 only by coincidence.)*
- **That anything the adapter dispatches matches the build.** No capture has
  ever observed a clip label, a depth, a position, or a panel instance. Those
  are static-map readings at best; the multi-slot half of them is authored mod
  surface that vanilla has no counterpart for, so no capture could settle it
  even in principle.

Original game binaries and assets remain outside the repository. Distributable
work is limited to independently authored source, metadata, fixtures, and
patches.
