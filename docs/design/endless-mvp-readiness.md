# Endless MVP implementation-readiness record

> **Design-track quarantine:** do not use this document while authoring vanilla
> candidates, fixtures, or capture hypotheses. Designed mechanics may not select
> or shape what parity capture tries to prove.

**Status:** specification and review plan only. **Not implementation-ready.**
EP-D01, EP-D02, and EP-D07 have accepted dispositions; four product decisions,
EP-A01–EP-A03, three P0 model contradictions, three P0 specification blockers,
and several cross-layer contracts remain open. Nothing here
authorizes `endless-v0`, launcher work, runtime capture, installed-game access,
or changes to classic rules/evidence.

This is a volatile index over the stable proposal in
[Endless progression system](endless-progression-system.md). It answers one
question: *what must be true before a headless or playable implementation can
honestly start?* It is not a second feature design.

## 1. Readiness verdict

| Gate | Current state | Required disposition |
| --- | --- | --- |
| Product constraints EP-D01–EP-D07 | `3 of 7 closed` | EP-D01, EP-D02, and EP-D07 have accepted dispositions. EP-D03–EP-D06 still require fully normative, explicitly accepted dispositions in the [decision record](endless-progression-decisions.md); rejection/open revision remains blocking. |
| Pacing scale | **P0 contradiction** | Choose one coherent mapping among career level, frontier tier, Circuit count, vertical tier, and milestone cadence. |
| Retry/combat RNG | **P0 exploit** | Remove semantic-label/seed shopping without losing reload determinism or classic ordered-tape parity. |
| Post-completion economy | **P0 deadlock/hoard incentive** | Preserve bounded access to already known sidegrades after catalog completion. |
| Designed combat kernel | **P0 missing specification** | Author integer tier/chassis/action/opponent budgets before balance implementation. |
| Pressure termination | **P0 incomplete proof** | Close turn-denial and rounding gaps before claiming action/session bounds. |
| Authoritative integer encoding | **P0 incompatible specification** | Select safe integers, canonical strings, or a binary u64 format before persistence schema authoring. |
| Rule contract/provenance | Contract v1 only | Specify v2, `designVersion`, explicit classic migration, and RNG-model identity. |
| Canonical battle state | Numeric resources exist; structured Endless mechanics do not | Specify and hash frozen item, condition, marker, charge, cycle, and Pressure state. |
| Durable continuation | Final settled records only | Specify exact active-battle restore and one atomic progression transaction boundary. |
| Durable reward settlement | Strong in-memory latch; no crash-repair transaction | Specify `ack-prepared` recovery and one pure idempotent settlement reducer. |
| Numeric content | Tuning hypotheses only | Author tier budgets, chassis/opponents, action costs, `C_t`, and all finite catalogs. |
| Headless proof | Reusable resolver exists | Build only after every preceding headless gate passes. |
| Playable proof | No per-action animation acknowledgement or genuine multi-human session lifecycle | Requires an evidenced completion signal, fail-closed action gate, distinct-human allied-seat admission, durable action-boundary pause, authenticated same-seat reconnect, visible accepted grace timing, and a race-safe implementation of the accepted connected-team abandonment transition after headless acceptance. |

There is no useful “percentage complete” here. The current design is
feature-complete at proposal level and not implementation-ready at contract
level. Those statements are compatible.

## 2. Evidence vocabulary

- **[V] Repository-verified:** current source, tests, or maintained repository
  documentation demonstrates the capability.
- **[D] Derived:** checkable arithmetic or logical consequence of stated inputs.
- **[A] Designed/assumed:** intentional product or architecture proposal.
- **[U] Unverified:** evidence or a selected mechanism is still missing.

Classic promoted evidence retains its narrower fixture scope. A mapped or
designed statement never becomes runtime-verified through this document.

## 3. P0 contradictions and specification blockers

These are not tuning details. R-01–R-03 block model-dependent work; R-04–R-06
block only their owning code slices and do not by themselves forbid unrelated
contract/provenance specification.

### R-01 — career pace, challenge pace, and milestone cadence disagree

The pre-EP-D01 proposal advances frontier challenge tier exactly once per cleared Circuit
but also queues milestones every 20 career levels and targets those milestones
at roughly every fifth Circuit. Let `g` be average career levels gained per
complete progression Circuit. The pacing target implies:

```text
20 career levels / 5 Circuits = g = 4 levels per Circuit
```

At that rate, a level-1 combatant reaches career level 50 after about
`49 / 4 = 12.25` Circuits, while its frontier is only around challenge tier 13.
It reaches level 100 after about `99 / 4 = 24.75` Circuits, around challenge
tier 25–26. Yet the current reward rule changes from
`min(selectedChallengeTier, careerTier)` to 50 after the career cap. That
creates either a tier-13-to-50 reward-budget jump or a post-100 period in which
vertical chassis power has not actually reached its advertised endpoint. [D]

Conversely, reaching challenge tier 50 no later than career level 50 requires
roughly `g <= 1`. Then 20-level milestones are about 20 Circuits apart, not
five. No single fixed `g` satisfies both claims. [D]

The accepted EP-D01 replacement removes tier 50 as a permanent product promise,
but does not select the versioned campaign-ceiling integer or map career,
frontier, campaign, and Circuit pace. The contradiction therefore remains an
EP-A01/readiness blocker rather than an open EP-D01 decision.

**Small coherent repairs retained as inputs to EP-A01:**

1. **One career level per cleared Circuit:** preserve one frontier tier per
   Circuit and align vertical career/challenge tiers; revise the “every fifth
   Circuit” target and the 1–100 timeline's real-world length.
2. **Separate display career from vertical tier:** let career/records rise
   faster while vertical budget follows
   `min(highestClear, campaignVerticalCeiling)`; rewrite every level-gated
   unlock and admit that display level may precede the selected vertical ceiling.
3. **Advance several challenge tiers per Circuit:** preserves fast career pace
   but rewrites frontier keys, opponent selection, clear credit, mixed-party
   gates, and the meaning of a four-fight Circuit. This is the largest repair.

**Provisional recommendation:** option 1, made exact by this clean-boundary
invariant, is the smallest internally consistent model:

```text
careerLevel <= highestClear + 1
one four-key frontier set awards at most one total career level
```

Fights 1–3 may accrue XP, but a level cannot activate early enough to violate
the invariant; the final may commit the set's one crossing with its clear.
Record-kind sets use the same aggregate limit. Treat the five-Circuit phrase as
a failed target, not as a reason to distort challenge or reward tiers. EP-D01
is already closed; this pace and the consequence for EP-D03 must still be
owner-reviewed under EP-A01 rather than silently patched.

**Gate:** a normative table maps each Circuit outcome to XP, career level,
career tier, frontier tier, reward-budget tier, milestone queue, Emperor
completion, the versioned campaign vertical ceiling, and postcampaign Pursuit
activation. It must include every authored system boundary plus levels/tiers 1,
20, 40, 60, 80, 100, 101, 125, and 200. No transition may increase a reward
budget by more tiers than its declared clear. At the first ceiling receipt, the
next selectable frontier must be consistent with that ceiling; from then on,
later clear catch-up alone cannot increase a raw stat or item-chassis
projection.

### R-02 — deterministic semantic labels turn Rematch into an oracle

The originally merged proposal restored the same combat seed and per-label
counters on Rematch,
while alternative action/target labels draw independently. After scouting a
seed, a player can choose whichever independent label is known to succeed. If
`m` alternatives each hit with probability `p`, the probability at least one
label succeeds is:

```text
P(best known label succeeds) = 1 - (1 - p)^m
```

At `p = 0.5`, four labels expose `93.75%` success and eight expose `99.609375%`,
not 50%. Counting scouting actions measures the exploit but does not remove it.
Unlimited same-seed Recovery restarts make the same problem repeatable. A
seed-aware local player can also accept Overtime only when inspection predicts
a favourable branch if its future combat seed exists before the irreversible
choice. [D/A]

Classic ordered RNG cannot be replaced: its global labelled tape is a parity
contract. Endless therefore needs a separate, versioned RNG model. But the
originally proposed per-action-label model is not sufficient.

**Mandatory outcome/information foundation plus a separate retry choice:**

1. **Branch-oracle-safe public outcome/information contract:** either expose the
   complete legal-action payoff forecast as intentional gameplay, or derive
   coupled quantiles across every counterfactual payoff axis—not only primary
   hit, but damage, critical, status, proc, target-count, and effect domains—and
   require a white-box solver to keep zero-cost seed-aware advantage within an
   owner-approved tolerance. Local seed visibility is part of the threat model;
   “relevant forecast” without an exact UI schema is not a contract.
2. **Retry state after that foundation:** select exact attempt-state restoration
   or a persisted finite sequence in which an acknowledged defeat atomically
   commits a loss ordinal and derives the next deterministic attempt seed. The
   latter prevents restoring an old seed and bounds retry count, but it does
   **not** close the current-attempt branch oracle or make a predictable future
   sequence secret. It is a retry-policy choice, not an alternative to item 1.

Commit-reveal can hide entropy in a networked mode but cannot be the offline
MVP's safety premise. Under any selected foundation/retry combination, the
precommitted Recovery **recipe**
is distinct from its attempt seed: either derive that seed atomically from the
Concede receipt, or deliberately expose the complete Recovery forecast and test
the resulting Concede policy. Apply the same rule before Overtime risk becomes
irreversible. Overtime remains deferred until the white-box policy is
non-dominant.

This is an architecture/product correction, not a classic formula change.

**Gate:** compare honest play, UI-informed play, zero-cost direct seed
inspection, every alternative action/target/payoff domain, intentional loss,
padding, Concede, Recovery restart, and Overtime accept/decline. Report win
rate, action distribution, route/risk choice, and progression per action
separately. If forecasts are intentional, UI/log and save inspection expose
byte-identical information. Otherwise seed-aware advantage must remain within
an approved tolerance; counting scouting actions cannot detect zero-cost seed
inspection.

### R-03 — catalog completion can permanently strand known builds

Current completion means every potentially unlockable authored mechanic is
resolved, not that the combatant owns every useful copy or retains enough
currency to rebuild it. The proposal then stops all gold and Forge Marks. A
completed combatant with fewer than 16/28/48 Marks can therefore lose access to
a desired known Tempered/Inscribed/Legendary identity forever. Terminal zero
income creates a marginal near-completion hoarding incentive and can strand an
identity that was discovered but not retained; spending may still improve
present win rate, so universal dominance is not claimed. [D]

**Small coherent repairs to decide between:**

1. Progressively earned permanent personal identity licences remain usable
   after completion through a fixed number of conserved refundable
   reconstruction entitlements. Known builds can be reconfigured one at a time
   without increasing simultaneous power.
2. Full identity-specific recycling returns exactly the entitlement required
   to instantiate one other known projection, with no tradeability or copy
   growth.
3. Require sufficient owned copies/currency for completion; this merely delays
   the hoard checkpoint and can still strand the player after later spending.

**No option is selected.** EP-A03 must define the progressive event that creates
an identity licence, reconstruction-slot count, whether viewed-but-declined
offers count, retired-ID behavior, host chassis/slot requirements, and the exact
conservation equation. Completion cannot itself grant a free library power
spike.

**Gate:** use a test fixture with zero available currency—production completion
does **not** delete balances. Compare immediate completion, delayed completion,
all-salvage discovery, and keep-everything policies over explicitly earned
licences and reconstruction slots. Require equal intended reachable active
build sets without increasing simultaneous equipped copies or transferable
value; unknown/source-uncleared/retired IDs remain inaccessible according to
the selected EP-A03 rules.

### R-04 — the designed combat budget does not exist yet

The proposal does not yet define the full-elimination health curve, per-tier
stat allocation, chassis budget functions, action/resource costs, designed
critical/deflection/status rules, opponent raw-budget function, or scalar value
of a modifier/liability. A doctrine's AI-policy value also sits outside the
stated positive-module budget. [U]

Without that kernel, win-rate, build-frontier, same-chassis, action-duration,
Concord, item-contained Form concepts, opponent-budget, and
Contract-normalization gates cannot run.
This is P0 even though it is not a contradiction: implementing effects first
would fit balance to missing foundations.

**Gate:** one versioned integer headless-balance specification selects the
campaign vertical ceiling and covers every tier through it for
stats/chassis/health/armour/resources, every baseline action, all opponent
budget dimensions, and explicit rounding. EP-D01 and EP-D02 are accepted, but
the vertical combat budget, complete sixteen-host compatibility catalog, and
mixed-rarity dominance evidence remain unimplemented.

### R-05 — Pressure's termination proof omits skipped turns and rounding

The proposed `40n - 1` actor-action bound is otherwise plausible, but stack-8
legality is not guaranteed through frozen/stunned/lost-turn state. A skipped
scheduled turn does not reduce its monotone measure, and new ordinary attacks
may reapply denial. Recovery reductions of 12.5 percentage points also lack an
integer formula. [D/U]

**Provisional repair:** at stack 8, suspend all turn-denial state, forbid new
hard/soft denial, schedule one Pressure action for every living snapshotted
seat, apply the mandatory floor exactly once to one living target, and suppress
all proc/status/control side effects from that floor. Define recovery with one
integer rule, for example:

```text
effectiveRecovery = roundHalfUp(baseRecovery * max(0, 8 - stack) / 8)
```

**Gate:** exhaustively start with every fighter frozen, taunted, silenced,
disarmed, empty, out of range, and carrying pending reactions; prove each
scheduled opportunity becomes a forced Pressure action and strictly decreases
`sum(hitsRemaining) + remainingApproachDebts`. Track scheduled opportunities
(including ordinarily skipped turns) separately from resolved actor-actions and
bound both. Define whether a control-skip presentation consumes interactive
time. The 316/476 four-fight actor-action sums are headless safety ceilings, not
acceptable human-session targets; after the repair, the corresponding
scheduled-opportunity counters require their own equal ceilings.

### R-06 — JSON cannot carry the proposed unsigned 64-bit contract as written

Canonical unsigned 64-bit integers, rejection of numeric strings, and ordinary
JavaScript JSON numbers cannot all coexist above `2^53 - 1`. [V/D] Select one
before schema authoring: cap authoritative counters at
`Number.MAX_SAFE_INTEGER`, validate a canonical fixed-width string encoding, or
use a binary format with u64 support. This blocks the persistence fields that
claim u64, not unrelated documentation.

## 4. Current reusable baseline

| Capability | What exists [V] | What Endless still needs [A/U] |
| --- | --- | --- |
| Rule seam | `src/team/rule-set.js` validates descriptor v1, action vocabulary, legality/outcomes, verification, and provenance. | Contract v2, required `designVersion`, explicit classic v0 migration, RNG policy identity. |
| Deterministic combat | `src/team/resolver.js` runs the same headless 1v1/2v2/3v3 loop and hashes its projection. | Versioned snapshot import/export and Endless lifecycle fields. |
| RNG | `src/team/rng.js` provides one ordered labelled channel and tape replay. | Keep it unchanged for classic; specify a non-shopping Endless model and its projected counters. |
| Numeric resources | `src/team/resources.js` validates/projects generic finite-number resource bags and absolute writes; the adapter emits a fixed twenty-entry SS2 set whose numeric bounds are null. | Reuse it for missing charges where appropriate; do not create resolver fields named after SS2 globals. |
| Status/items | Combatants have a simple loadout and deduplicated string statuses. | Frozen item-instance IDs/hashes, carried items, structured markers/conditions, expiry coordinates, charges. |
| Turn/team lifecycle | Resolver owns seats, controllers, stable initiative, effects, elimination, result, and settlement arm. | Explicit cycle wrap/Pressure and timed expiry, without alternate result paths or extra boss turns. |
| Controller/admission | The generic registry can assign or reassign local, hot-seat, remote, or AI controllers per seat, and the resolver accepts one-to-three seats per side. | EP-D07's first-playable admission layer must require one distinct connected human authority per allied seat, reject allied AI/duplicate authority/takeover, and persist action-boundary pause plus authenticated same-seat reconnect. Generic capability is not product permission. |
| Terminal acknowledgement | `CampaignSettlement` and adapter result bridge gate the callback exactly once in memory. | Durable `ack-prepared` state, restore, and atomic progression apply/repair. |
| Campaign persistence | Schema-v2 immutable settled records, namespaced storage, corruption quarantine, and a versioned 1→2 migration whose timestamp is injectable but defaults to the wall clock. | Separate active progression envelope/transaction; current backend has no multi-entity atomic commit and defaults to 64 KiB. Future migrations need explicit timestamp/receipt inputs before they may be called pure. |
| Adapter | Canonical resource/status mapping, presentation commands, terminal result acknowledgement. | Per-action completion gate; no verified vanilla timeline-complete signal exists. |
| Evidence | 22 promoted goldens, including twelve normal-band melee directions, plus mapped/candidate surfaces. | No designed claim may broaden those fixtures; candidate quirks remain quarantined from authoring. |

The important correction is that stamina, ammunition, armour, base magicka,
generic numeric resources, ordered RNG, an in-memory terminal gate, and an
immutable final-record path are not blank infrastructure. Endless needs
structured identity/lifecycle and durable coordination around them.

## 4.1 Adversarial rejection envelope

These findings do not all require product decisions, but each needs a normative
counter or an executable rejection test before its owning slice is ready.

| Priority | Finding | Quantitative/adversarial consequence | Required counter or gate |
| --- | --- | --- | --- |
| P1 | Circuit duration | Multiplying the per-fight target ranges gives planning envelopes of 48–96 actor-actions for four 2v2 fights and 72–144 for four 3v3 fights; these are not statistical Circuit medians. After R-05 is repaired, the proposed headless safety bounds are at most 79 resolved actor-actions **and** 79 scheduled opportunities per 2v2 fight, hence 316 of each per Circuit. | Keep headless safety separate from the owner-approved interactive product gate. Time complete 2v2 sessions including routes, Armory, rewards, animation, control skips, and social choice; provisionally test median <=25 minutes and P90 <=40 minutes. Do not turn an action cap into a time cap without bounding decision and presentation time, and do not extrapolate D03 to 3v3. |
| P1 | Exact Legendary target tail | Because target pity does not raise rarity, six host-eligible Legendary caches plus the next can take 63 Circuits/252 wins in the deterministic rarity tail; the stationary model implies roughly 24 Circuits to the seventh eligible Legendary cache, before earlier natural identity hits. | Declare an acceptable identity-specific tail; add a category-complete fallback or shorten the bound without making Forge the general fastest rarity source. |
| P1 | Gold can become dead | Exact ordinary non-milestone baseline income is `3*roundHalfUp(20*C_t/100) + roundHalfUp(35*C_t/100)` gold/Circuit before Contract bonuses; `0.95*C_t` is only its large-`C_t` approximation. A milestone final uses the separately authored 50% row. After campaign-ceiling chassis/services, no renewable sink is specified. On an ordinary non-milestone Circuit, Elite Foil adds approximately `0.19*C_t` and Tight Clock `0.1425*C_t` plus one Mark before integer effects. | Define bounded useful gold sinks and calculate every per-fight integer bonus; reject any Contract whose expected marginal reward is effectively the same one Mark or whose early fights dominate Concede. |
| P1 | Precommit fold is underspecified | Pity 7→8, a later natural reset, target forcing, and duplicate history must deterministically change later outcomes in the same four-fight plan. Player claims cannot retroactively affect already immutable candidates. | Every prepared outcome carries its predecessor-state hash; specify the pure fold order and whether duplicate history observes generated, offered, claimed, or salvaged fingerprints. |
| P1 | Assistance can become a second item roll | Three intentional losses may expose an independently preferable base-rank sibling outcome. | Assistance is a value-reducing transform of the same reward identity, or is honestly treated and priced as another choice; white-box loss policy must not dominate. |
| P1 | Rule Capacity is not a utility bound | Capacity grows from 0 to 48 across sixteen hosts; inactive sources and both weapons reserve Load, one Legendary's owner may retain or select its Branch at the accepted encounter boundary, and Team Tactic sits outside personal Capacity. This greatly enlarges the interaction surface even though the cap is finite. | Test every milestone/route band, all sixteen positions, both-weapon states, Ascendancy Branch boundary, separate Tactic allowance, and compatible payload set under uniform-mechanics and generator weights. Whole-state invalid equip must preserve prior bytes; one legal all-Legendary set must coexist with useful mixed-rarity configurations. |
| P1 | Trophy/effect gates can pass by cherry-pick | Concord currently needs one favourable and one losing cell; that does not establish robust non-dominance. Relay/Chain prerequisites may be scripted-opponent-specific; Quiver dies near cap; Stabilizer's floor makes low shields lose 100/50/33%; Breakwater can be burned by a tiny crossing. | Publish semantic-cell distribution and robust aggregate thresholds; sweep exact integer boundaries and every trigger sequence. No single showcase cell is acceptance. |
| P1 | Veteran catch-up is punitive | In the obsolete tier-50 example, a ceiling-tier incomplete veteran accompanying a 49-tier-gap ally forgoes about `46.6*C50` gold, 108 offers, 544 all-salvage Marks, and 196 grant/XP opportunities. The magnitude must be recomputed for the selected versioned ceiling. | At gaps 1/10/25/full-span and with same-custodian mule cases, compare current Practice-only veteran, nonmechanical mentor records, deferred mentor credit redeemable only after a later veteran-frontier victory, and split-tier authored encounters. No option may grant high-tier outcomes for low-tier wins, mint a second frontier set, or improve veteran reward/action by cycling fresh allies. The owner must select an acceptable veteran opportunity-cost ceiling. |
| P1 | Deferred allied-AI/multi-seat funnel | If a later variant lets one human custodize multiple persistent or AI-driven fighters, it can collect several personal streams and funnel tradeable natural Legendaries to a carry. Per actor-action normalization hides per-human-command advantage. EP-D07 excludes this from the first playable version. | First-playable admission rejects allied AI and duplicate human authority. Any future variant needs a new accepted reward/custody rule plus concentration gates per actor-action, human command, and wall-clock minute; generic resolver support is insufficient. |
| P1 | Governance can deadlock or impose debt | Ranked sums can put an absent Standard-preferring member onto a debt route. EP-D07 selects suspension rather than AI/controller substitution and now accepts a narrow dropout exception: each expired absent member contributes only their Circuit-entry conditional consent to abandonment, while every connected member must approve. False disconnect attribution or a reconnect/receipt race could still destroy unearned outcomes. One `memberId` is not proof of one human. | Nonzero debt requires explicit unanimous acceptability; persist suspension and the visible versioned grace policy; seal member/session authority; let expiry mutate no combat/reward state; require every connected member's yes; invalidate a pending proposal on reconnect; and serialize reconnect against the atomic abandonment receipt. Test absence, ordinary timeout, dropout expiry, Sybil, false presence, crash, indefinite wait, and reconnect races. |
| P1 | Cross-format identity and farming | One mode-neutral gladiator can carry team-earned power into 1v1, or a team-dependent build can become nonfunctional when entering solo. A faulty transition can also copy/reset Bound Soul, item, Tactic, or Lineage state. | Use one persistent `combatantId`; freeze format/roster per Circuit; require a functional solo action loop; round-trip the same gladiator through 1v1→2v2→3v3→1v1; and compare risk-normalized cross-format progression so one format is not a dominant power farm. |
| P1 | Focus warning may not create agency | “One enemy action ahead” can still land before the targeted seat's next action, and per-enemy limits can coordinate focus. | Guarantee at least one scheduled action for the target before the threatened payoff and apply focus frequency at team scope. |
| P1 | Post-cap tier may not mean harder | After raw/module caps and finite doctrines/Charters, an unbounded tier becomes an ordinal record, not monotonically increasing difficulty. Cosmetic recipe IDs can also evade no-repeat rules. | Either promise bounded bands then rotation/records, or publish a finite monotone schedule. Compare semantic mechanics fingerprints, not display IDs. |
| P1 | Rival spoofing/free AI value | Two wins with a disposable tag can bait a rival counter, then a non-tag build exploits its liability. Doctrine policy adds value outside its modifier budget. | Adversarial two-of-three tag spoof test over the complete horizon; budget policy value; define “within 15%” as a vector norm that never raises raw chassis over the cap. |
| P1 | Mastery offer steering | One offer follows the semantic tags on the currently equipped build, so a player can equip an offer-fishing loadout immediately before a level threshold. | Compare honest locked builds with threshold-targeted tag spoofing. Either accept the sacrificed combat value as intentional steering, or key compatibility to a persisted preference/history rather than one equipped snapshot. |
| P1 | Recovery can counterfeit paid rank | A clear-only Recovery may raise bare `highestClear`, allowing accessibility progress to leak into prestige, Trophy, leaderboard, or Contract-rank meanings that imply paid difficulty. Its championship capacity receipt is now one intentional exception, not evidence that other paid-rank gates should leak. | Use typed paid-clear facts for every paid-rank consumer. Independently test the accepted one-per-lineage personal capacity receipt on qualifying Recovery victory and prove it grants no other reward/rank channel. |
| P1 | Four-Charter rotation is forced | Four cards plus “no repeat within four” leaves only the oldest legal card after the first rotation. `standard-catchup` can reward race-one-character then advance another under easier bands. | Label initial behavior deterministic rotation, shorten the window, or ship more cards. Compare simultaneous versus race/catch-up; Standard catch-up cannot grant the same boundary mechanical-choice rate without paying equivalent challenge. |
| P0 spec | JSON u64 conflict | See R-06: canonical unsigned 64-bit integers, rejection of numeric strings, and ordinary JavaScript JSON numbers cannot all coexist above `2^53-1`. | Cap authoritative counters at `Number.MAX_SAFE_INTEGER`, validate canonical fixed-width strings, or select a binary u64 format. Pick one before schema authoring. |
| P1 | Metrics are not operational | “Within 5%,” “15% of cells,” “two consequential actions,” “same budget,” and “optimal policy” lack metric, cell distribution, solver, confidence, and tie rules. | Define cells as version × team size × mechanics-distinct budget band × Charter × semantic recipe fingerprint × persisted seed; report both uniform-mechanics and actual-generator weighting. |

The reward arithmetic itself is sound: 2.2 expected caches per four-win
Circuit, natural Legendary around one per 29.4 wins, and an independent
200,000-Circuit check of the stated model yielded one Legendary per 13.79 wins
with pity, 59.29% forced. The problem is not a calculation error; it is the
unselected tail, sink, fold, and policy contract around those rates.

## 5. EP-D02-respecified MVP mechanic inventory

The prior fixed-four MVP is no longer selectable. The replacement is still not
an “eight-effect rule set”: it must include EP-D02's accepted Capacity, host,
receipt, Ascendancy, Team Tactic, and migration contracts. The eight behaviors
below remain candidate item-contained content, not an approved slice by
themselves.

| Surface | MVP content | Owner/seam |
| --- | --- | --- |
| Baseline combat | Selected Endless action vocabulary, exact probability convention, action/resource costs, ordinary targeting and elimination | `endless-v0` rule set; resolver retains team lifecycle |
| Global battle law | Arena Pressure, cycle counting, monotone stack-8 termination actions; decide whether Control Fatigue is omitted or fully specified | Rule legality/outcomes plus resolver lifecycle state |
| Comparator action | Known 1-Load Approach Kit with one battle-local charge | Designed rule action + carried-item/loadout state |
| Random loot effects | Measured Quiver, Critical Relay Grip, Blooded Reserve Pommel, Guarded Overdraw, Second Wind Guard, Breakwater Ward, Stabilizer Shield, Pursuit Step | Designed effects; eight total |
| Prior Trophy package | Concord's item-contained sequence concept requires respecification against the item's actual rarity; Trophy naming alone determines neither Load nor Ascendancy eligibility | Historical designed-effect input; not a live gate |
| Capacity cadence | Personal 0→48 Capacity through eighteen stable championship milestone lineages, including qualifying Assistance/Recovery victories and every negative case | Personal bounded ledger + atomic settlement |
| Loadout grammar | All sixteen mapped positions, categorical 0/1/2/3 Load, both weapons reserved, exact active-source linkage, nullable applicable lower-route Capacity ceiling (personal Capacity otherwise), whole-state atomic validation, family/team caps, no proc chains | Rule validator + canonical frozen loadout/configuration |
| Ascendancy | At most one equipped Legendary may Ascend; its item/Core lock for the Circuit and one learned exact-lineage Branch follows the accepted encounter/Assistance/Recovery boundary | Item/configuration state + encounter envelope |
| Team Tactic | One visible nonfungible team allowance outside personal Capacity; no conversion into item Load | Separate team-rule state; lifecycle/vote/1v1 details remain open |
| Opponents | Four previewed doctrines; deterministic Scout/Foil/Mixed/Final recipes; capped stat budgets | Pure campaign generator + rule AI/actions |
| Allied roster/session | Under the pending 2v2 proof proposal, two persistent allied gladiators controlled by two distinct connected humans; no allied AI, empty allied seat, duplicate human authority, multi-seat control, or takeover | Admission/session authority + active Circuit envelope; accepted EP-D07 |
| Routes | Standard plus alternating Elite Foil/Tight Clock; four fights; no combined debts | Campaign plan and disclosed UI |
| Rewards | Personal precommitted four-key outcomes, cache offers, Forge/Salvage, fixed Concord source, custody/claim | Progression reducer/transaction + UI |
| Continuation | Concede, Rematch, one Recovery branch, receipts, exact resume; qualifying Recovery championship victory writes only the accepted capacity exception; committed action completes once before disconnect pause, then same-seat authenticated reconnect or established abandonment only | Active battle/progression transaction + session/transport protocol |

Before implementation, one normative appendix must list every MVP action,
effect, state field, trigger, timing point, RNG need, resource read/write,
expiry, event, failure mode, and projection/hash location. “Eight effects” is
only the random loot row.

## 6. Required architecture specifications

### S-01 — rule contract v2 and provenance

Current change surface:

- `src/team/rule-set.js`: bump the contract; require a nonnegative safe-integer
  `designVersion`; add it to `describeTeamRuleSet`.
- `src/team/placeholder-rules.js` and every shipped descriptor: explicitly
  declare classic `designVersion: 0`; never default a missing value at runtime.
- `src/team/resolver.js`: bump battle-state version; project/hash the full rule
  identity and the chosen validated RNG model.
- `src/campaign/from-battle.js`, `record.js`, and `migrations.js`: bump the exact
  record schema and carry/migrate the identity honestly.
- All recipes, items, reward outcomes, receipts, saves, and peers: reject an
  `(id, contractVersion, designVersion)` mismatch before mutation.

Adding the projected field changes combat hashes, terminal discriminators,
completion tokens, and derived record IDs. The migration must not regenerate or
reinterpret old identifiers. Schema-1 records whose rule identity is genuinely
unknown remain unknown.

Contract v2 keeps today's legal verification enum. `endless-v0` remains
`placeholder`, `runtimeVerified: false`; a prose provenance note can record
designed intent. If v2 retains an explicit `designIntent` field, it must
validate, project, hash, persist, and migrate it. A future `designed` enum is a
separate migration.

**Pass gate:** invalid/missing design versions reject; classic explicitly uses
0; Endless uses its reviewed positive version; identity mismatches reject; pure
migrations are idempotent; classic deterministic compatibility tests pass.

### S-02 — RNG model identity and state

`OrderedRngChannel` remains the classic/tape implementation. A separate Endless
channel must have an explicit validated model identity; contract version alone
cannot select it because classic descriptors also migrate to v2.

The selected specification must define:

- structural draw coordinates and occurrence rules;
- common quantiles and every coupled secondary domain if coupling is selected,
  or the complete payoff/visibility schema and byte-equality rule across UI,
  log, and save inspection if public forecast is selected;
- projected model/seed/counters/forecast/hash and exact active-attempt restore;
- when a future attempt seed comes into existence;
- which irreversible receipt derives it;
- which inputs never influence it; and
- compatibility/rejection behavior for peers and saved battles.

Do not select semantic behavior by checking `rules.id`, accept free-form labels
as authority, or replace ordered classic tapes.

**Pass gate:** R-02 is closed; any difference in next-draw- or forecast-relevant
state hashes differently; unused/presentation/logging calls consume nothing;
classic roll order remains unchanged.

### S-03 — structured canonical mechanics

Add a versioned closed schema, separate from the existing compatibility
`status: string[]`, for:

- all sixteen frozen equipment-position entries with nullable occupancy,
  item-instance IDs where occupied, definition/loadout hash, each payload's
  Load, and both equipped weapons' reserved Load even while one is inactive;
- personal earned Capacity derived from one bounded receipt per stable
  milestone lineage, plus the nullable applicable lower-route Capacity ceiling
  and validated effective Capacity projection; no-next-milestone/post-Emperor
  routes use personal Capacity directly;
- each participating combatant's nullable at-most-one Ascended Legendary
  item/Core selection and at most one bounded current
  `{ combatantId, encounterInstanceId, branchId }` selection,
  with exact Circuit/encounter/Assistance/Recovery lock coordinates;
- the separate nonfungible Team Tactic allowance, never folded into personal
  Load;
- battle-local charges and once-per-battle markers;
- counted/timed conditions with owner, source, arming event, and deterministic
  expiry coordinate;
- explicit cycle/Pressure state; and
- only those new effect kinds that cannot be represented safely by existing
  absolute resources/status activation.

Persistent combatant IDs use one canonical ASCII grammar with explicit length
and normalization rules. Initiative and every other identifier tie-break use a
specified ordinal byte/code-unit comparator, never locale-sensitive
`localeCompare()`.

One persistent combatant record has no permanent 1v1/2v2/3v3 mode field.
Format, roster size, participating combatant IDs, and seat bindings belong to
the immutable Circuit/attempt projection. Moving the same combatant among
formats preserves its Bound Soul, levels, stats, inventory, equipped item IDs,
Legendary Lineages, and personal Tactic library exactly.

Every rule-readable field must be present in the authoritative projection and
hash. Campaign inventory writes cannot change an active fight. Cycle wrap and
expiry must behave identically across dead-seat skipping in 1v1/2v2/3v3.

The existing final campaign-record schema rejects vanilla field names and is
not an active snapshot. Design a separate canonical serializer instead of
dumping live adapter resource keys into final history records.

**Pass gate:** snapshot→restore→snapshot is byte-identical; any rule-readable
difference changes the hash; malformed/unknown fields fail closed; classic
resource/status behavior remains unchanged; ID grammar rejects aliases and
cross-locale fixtures produce the same initiative order. One persistent
combatant round-trips through 1v1→2v2→3v3→1v1 without a copied, reset, or
format-bound progression field. Every illegal proposed equip/configuration is
rejected as a whole and preserves the prior equipment/configuration bytes.
A mixed-Capacity roster projects each `combatantId` independently: no campaign,
teammate, guest, or Team Tactic access pools, loans, averages, copies, or
projects Capacity.

### S-04 — one atomic progression/active-battle boundary

Keep immutable battle history separate. Add a progression subsystem with
logical sidecar and active-battle schemas but one durable commit unit, unless a
reviewed write-ahead protocol proves cross-store atomicity. The current
`CampaignStore` provides independent key reads/writes/removes, not a
transaction.

The durable envelope must include:

- campaign, member, item, plan, escrow, key, and version identities;
- the bounded personal Capacity milestone ledger; Capacity schedule/host/cost
  versions; full sixteen-position saved configuration; and explicit migration
  mapping identity;
- frozen event format, roster size, combatant-to-seat and human-authority
  bindings, connection/suspension state, and the last acknowledged action
  boundary;
- accepted grace-policy identity/version/duration, per-member presence and
  independent dropout-timer state, plus any abandonment proposal's frozen
  presence revision and stale/committed status;
- active attempt sequence and immutable attempt-start/pre-ack snapshots;
- operation/mutation sequences and event/presentation high-water marks;
- RNG model/state, frozen rule/generator/definition identities, personal/route
  Capacity projection, both weapons' reserved Load, each participating
  combatant's Ascended item/Core/current Branch, and the separate Team Tactic
  allowance;
- pending settlement intent and bounded recent receipts; and
- collision-resistant canonical digests, schema/entity versions, migration
  state, and explicit repair/error. Use the existing SHA-256 campaign-record
  pattern for snapshots, receipts, and durable identities; reserve the current
  eight-hex FNV-1a combat hash for non-authoritative fast desync diagnostics.

Active plans/snapshots never migrate mid-attempt. Old implementations remain
pinned until a clean boundary. A now-illegal saved configuration and every item
remain preserved; new play is refused until the owner explicitly selects a
legal replacement. No migration auto-unequips, disables, salvages, or retires
an item. Future schemas remain untouched.

**Pass gate:** crash after every durable boundary resumes the same attempt and
never allocates another sequence; invalid identity/hash enters repair without a
grant; migrations are clean-boundary, pure, idempotent, and backed up; a
100-Circuit soak stays within declared bounds; measured MVP worst-live bytes,
including both snapshots and explicit serialization/backend overhead, remain
below the configured atomic backend limit. If the current 64 KiB limit cannot
hold that envelope with margin, raising and versioning the limit is part of
S-04; a separate 100 KiB design target cannot waive the backend gate. A crash
while suspended reloads the same seat authorities, state hash, and next action
boundary without advancing AI, command, RNG, or settlement.

### S-05 — durable reward settlement coordinator

Keep the in-memory terminal gate, but wrap it in this durable sequence:

1. atomically write immutable `ack-prepared` plus embedded pre-ack bytes;
2. submit the exact terminal acknowledgement through the existing resolver;
3. run one pure reducer against the frozen plan/keys;
4. atomically commit attempt receipt, every personal classification/grant,
   any qualifying championship capacity receipt/delta, key/set/clear/pot
   transition, sequence high-water, and pre-ack removal;
5. on load, rehydrate an orphaned `ack-prepared` state and replay the same gate.

The optional immutable `CampaignRecorder` is history, not reward authority. Its
current failure-collection behavior cannot be the transaction.

**Pass gate:** fault injection before/after reservation, action checkpoint,
elimination, pre-ack, latch, callback, commit, and cleanup yields exactly one
attempt receipt and zero/one correct reward/record grant per participant.
Independently, a qualifying full-rank, Training Assistance, or precommitted
Recovery championship victory yields exactly one capacity receipt for every
participating persistent gladiator in the frozen victorious roster, including
one knocked out before team victory; every negative/replay path yields none.
Decided without pre-ack grants nothing;
committed reload cannot apply twice; mixed personal mutations are
all-or-nothing; conservation holds. A newly committed Capacity receipt updates
the durable personal ledger but leaves the in-progress battle/Circuit's frozen
projection byte-identical; it becomes usable only at the next legal loadout
boundary.

### S-06 — headless simulator

Add the designed rules under `src/rules/`, pure generators/reducers under a new
progression layer, and a thin simulator that calls the **same** resolver,
transaction API, and settlement coordinator. Its in-memory backend implements
the same atomic contract. A synthetic headless terminal acknowledgement must be
explicit and must never become the playable adapter default.

**Pass gate:** byte-identical 12-fight seeded fixture; at least 100 completed
Circuits with no finite endpoint, deadlock, ID collision, or unbounded state;
1v1/2v2/3v3 properties; one persistent gladiator retains byte-identical
progression through 1v1→2v2→3v3→1v1; first-playable admission rejects allied
AI, an empty allied seat, duplicate human authority, multi-seat control, and
takeover; reload/fault tests use the real continuation path; all acceptance
metrics are machine assertions.

### S-07 — playable per-action acknowledgement

The terminal result bridge is not an action gate. Playable integration needs a
resolver-owned monotonic action operation ID, token-bearing presentation
commands, and an action acknowledgement bridge. `VanillaBattleHost.submit`
must refuse action N+1 while N is awaiting completion; AI advancement pauses
after one submitted action. Restore re-presents the same operation without
re-resolving or redrawing.

A disconnect recognized while action N is committed does not cancel, roll
back, or resolve N twice. N completes and acknowledges exactly once, its
checkpoint commits, and suspension begins before N+1. A disconnect recognized
at an idle action boundary suspends immediately. While suspended, human and AI
submission, clocks that affect combat, and automatic settlement are all
blocked; presentation may show only persisted pause/reconnect, grace countdown,
and eligible abandonment state. The grace clock can change session authority
only and never combat, RNG, reward, or settlement state. If N
creates the terminal result, no N+1 boundary exists: ordinary terminal
presentation acknowledgement and exactly-once settlement finish instead of
creating a suspended nonterminal attempt.

Per-action and terminal tokens remain distinct. Self-target, zero-event,
unmapped/no-animation, knockout, AI continuation, and terminal actions need
explicit policies.

Most importantly, no byte-verified vanilla timeline-complete signal exists.
Mock protocol tests can proceed later, but playable binding cannot be declared
ready by inventing a callback. Under the current no-capture assignment, this
gate remains [U] and fails closed.

**Pass gate:** correct token opens once; duplicate is harmless; mismatch
refuses; N+1 cannot rebind before N; restore is exact; a separately evidenced
surface signal exists before playable integration is called verified. Inject
disconnect before submission, after submit/before animation acknowledgement,
after acknowledgement/before checkpoint, and after checkpoint; every repair
path finishes at the same exactly-once action boundary and none advances N+1.

### S-08 — distinct-human admission, suspension, and reconnect

The first playable session needs a product-layer authority protocol in addition
to the generic controller registry. It must:

- admit exactly one distinct connected human member/controller for every allied
  seat and bind that authority to the frozen `combatantId` and `seatId`;
- reject allied AI, empty allied seats, duplicate human/member authority,
  one-human multi-seat control, and controller reassignment/takeover;
- authenticate reconnect as the same member, restore the same seat and exact
  state, and reject a different member or stale session token;
- persist connection and suspension transitions without letting wall-clock,
  retry, combat RNG, or presentation order affect combat;
- record every member's acceptance of one visible versioned grace policy before
  Circuit mutation; begin the countdown only after a recognized nonterminal
  disconnect reaches its durable action-boundary pause, with one independent
  timer for each absent member;
- let expiry activate only that absent member's conditional entry-time consent
  to abandonment—never an automatic result, death, combat/RNG/reward advance,
  controller substitution, or AI finish;
- require explicit approval from every connected roster member and expired
  grace for every absent member before the established atomic
  team-abandonment receipt may commit; no connected member means no automatic
  receipt;
- make authenticated reconnect before that commit restore the exact seat/state
  for only that member and invalidate the pending dropout-abandonment proposal;
  resume combat only when every required ally is connected;
- invalidate an open proposal on any new disconnect as well as reconnect, and
  serialize presence and abandonment so exactly one transition commits; and
- preserve the original Recovery roster, custody, and distinct-human admission
  after dropout Concede; no reduced-party entry, proxy choice, or AI fill is
  created.

These accepted semantics preserve the frozen electorate: each member supplies
either an explicit connected approval or only their own preaccepted conditional
approval after expiry. In 2v2, one remaining member may approve after the other
expires. In 3v3, both remaining members approve after one expiry; after two
expiries, the sole remaining member may approve. The team may always keep
waiting. Ordinary proposal timeout/absence remains “no.” Only authenticated
session liveness may recognize a dropout; no teammate may declare it.

The accepted rule does not select local multi-input versus remote transport,
presence/heartbeat mechanics, reconnect-token schema, exact grace duration,
durable timer representation, or reconnect-versus-receipt serialization. Those
are [U] implementation blockers, not permission to change the accepted
authority or invent a fallback.

**Pass gate:** start succeeds with the required distinct humans and fails
without mutation for every forbidden allied mapping; spoofed/duplicate/stale
authority fails closed; disconnect at every S-07 boundary persists one paused
state; reload remains paused; correct reconnect restores byte-identical combat
and progression state to the same seat; wrong reconnect cannot observe or
control it; a terminal committed action settles without pause/timer; a partial
3v3 reconnect restores only that member and remains paused; expiry alone
creates no action, reward, loss, RNG advance, AI takeover, or receipt; exact
2v2 and 3v3 one/two/all-disconnected cases obey the accepted approval table;
no-player-online remains suspended; new-disconnect/reconnect and abandonment
races expose exactly one state; false/manual dropout fails; Recovery retains
its original roster/admission/custody; and the reviewed abandonment path is
atomic, unanimous under its accepted authority rule, idempotent, and live.

## 7. Missing normative authoring inputs

The design's remaining unaccepted rates and fractions are hypotheses. EP-D02's
accepted grant cadence and 48 ceiling are not. Before the headless build,
version and review these exact finite inputs:

1. XP per paid fight/final and the complete pace table that closes R-01.
2. Stat budgets and allocation rules for every tier through the selected
   versioned campaign ceiling, including all dead-cap axes.
3. Standard chassis catalog, slot/family budgets, prices `C_t`, and integer
   interpolation/rounding for every tier.
4. Baseline Endless action vocabulary, legality, probability convention,
   damage, stamina/ammunition/magicka costs, range, target, and opponent-AI
   value. First-playable allied AI is not an authoring target.
5. Four doctrine base templates, liability/module deltas, budget caps, and
   Scout/Foil/Mixed/Final assembly order.
6. Stable milestone-ID definitions mapped to the accepted eighteen names/order,
   Capacity schedule version, receipt-lineage migration, and route-ceiling
   mapping. The accepted `+2,+3,+3` cadence and 48 cap are not open tuning.
7. The complete sixteen-host item/compatibility matrix, including both-weapon
   reservation, exact active-source behavior, categorical 0/1/2/3 payloads, and
   at least one otherwise-legal all-Legendary loadout with useful mixed-rarity
   configurations.
8. Legendary Ascendancy lineage/Core/Branch definitions and the exact durable
   fields implementing its Circuit, encounter, Assistance, and Recovery timing.
9. Team Tactic acquisition, vote, 1v1 availability, and source-member lifecycle.
10. Exact candidate item-behavior definitions, exclusions, rarity cells,
    stacking groups, and total generation matrix; the old fixed-four Concord
    fixture is not a normative shortcut.
11. Pressure/expiry coordinates and whether Control Fatigue is in or out of MVP.
12. Cache/pity/target/Forge/gold tables and an EP-A03 maintenance replacement
    after R-03 is closed.
13. Stable definition, generator, rule-design, item/Capacity schedule, and
    migration version IDs, including preserve-and-reconfigure handling for an
    old saved configuration made illegal by new costs/slots.
14. Minimum genuine two-human session topology, sealed member/controller
    authority, presence and reconnect state, suspended-attempt persistence,
    exact visible grace duration/storage, and race-safe implementation of the
    accepted dropout-abandonment rule.

No simulator can validate “meaningful choices” against missing chassis,
opponent, and action numbers.

## 8. Ordered delivery sequence

Steps 1–2 are specification work. No implementation slice beginning at step 3
may start until every §10 gate is reviewed and the owner then gives the separate
implementation authorization. Each authorized slice lands separately and must
leave classic tests green.

1. **Owner record:** retain accepted EP-D01, EP-D02, and EP-D07; decide
   EP-D03–EP-D06,
   and select repairs for R-01–R-03. R-04–R-06 specifications remain mandatory
   before their owning code.
2. **Normative specifications:** MVP surface appendix, pace/economy tables, RNG
   contract, canonical mechanics schema, transaction/repair protocol, and
   human admission/pause/reconnect/abandonment protocol.
3. **Rule contract v2:** explicit classic migration and provenance/hash tests;
   no Endless battle yet.
4. **Battle snapshot/RNG state:** versioned export/import and selected Endless
   RNG model, preserving ordered classic tapes.
5. **Atomic progression envelope:** reducers, transactions, migrations,
   active-attempt restore, receipt/conservation tests.
6. **Settlement coordinator:** `ack-prepared` repair and fault matrix.
7. **Structured mechanics:** items, conditions, charges, cycles, Pressure.
8. **`endless-v0` plus generators:** exact MVP surface only.
9. **Headless simulator:** 12-fight fixture, 100-Circuit soak, adversarial search,
   1v1/2v2/3v3 properties.
10. **Playable action protocol:** only after headless acceptance; mock action
    gate first, evidenced vanilla signal before binding.
11. **Human session protocol:** distinct-human allied admission, authority,
    durable suspension, authenticated same-seat reconnect, and live established
    abandonment path; no allied AI fallback.
12. **2v2 UI:** routes, preview, Armories, presence/pause/reconnect,
    reward/custody, provenance, repair.
13. **Expansion:** content, rivals, locker/trade, then 3v3 presentation.
14. **Launcher/deployment:** separate approval after playable acceptance; never a
    hidden step in design implementation.

## 9. Review and test ownership

Future work should keep file ownership narrow:

- parity/candidate authors do not read this design while selecting hypotheses;
- rule-contract/state/persistence reviewers own cross-cutting schemas before an
  Endless feature writer consumes them;
- one simulator exercises production reducers/resolver rather than copying
  logic;
- adversarial tests are authored independently from the mechanic where
  practical; and
- no design branch writes golden, observation, manifest, divergence, candidate,
  `src/golden`, classic-rule, runtime-capture, launcher, or installed-game data.

Every future mechanic retains two required annotations: classic parity versus
separate rule-set seam, and invited degeneration plus counter/rejection test.

## 10. Exit criteria for “implementation-ready”

All of these must be true in a reviewed commit:

- EP-D01–EP-D07 are accepted or superseded by fully normative, explicitly
  accepted replacements; rejection or an open revision remains blocking.
- EP-A01–EP-A03 are accepted or superseded by separate fully normative,
  explicitly accepted owner/date-stamped replacements, and
  R-01–R-03 have one selected normative repair each, not merely options;
  R-04–R-06 have complete executable specifications.
- S-01–S-08 have closed schemas/protocols and objective test plans; S-07 and
  S-08 may remain later playable blockers while headless work proceeds.
- Every numeric input in §7 is authored, versioned, and total over the MVP.
- Headless scope and playable scope are explicitly separate.
- First-playable admission proves one distinct connected human per allied seat;
  disconnect pauses durably at the accepted action boundary and only same-seat
  reconnect or the reviewed established abandonment path can continue/end it.
- Classic ordered RNG, rules, fixtures, and evidence remain untouched.
- No document calls a designed rule runtime-verified or a custom campaign
  vanilla campaign parity.
- A reviewer can trace every persisted or rule-readable field to validation,
  projection, hashing, migration, and fault behavior.
- After every gate above is reviewed, the owner gives a separate explicit
  implementation authorization; design approval alone does not imply it.

Only then may an implementation PR be proposed, beginning with the
contract/schema slices rather than the full game mode.

## Repository references

- [Owner decision record](endless-progression-decisions.md)
- [Stable progression proposal](endless-progression-system.md)
- [Quantitative diagnosis and external patterns](progression-diagnosis.md)
- [Swords & Sandals mod-scene survey](swords-and-sandals-mod-scene-survey.md)
- [Rule-set seam](../../src/team/rule-set.js)
- [Team resolver](../../src/team/resolver.js)
- [Generic resources](../../src/team/resources.js)
- [Ordered RNG](../../src/team/rng.js)
- [Campaign persistence contract](../campaign-persistence.md)
- [SS2 adapter contract](../ss2-adapter-contract.md)
- [Roadmap](../roadmap.md)
