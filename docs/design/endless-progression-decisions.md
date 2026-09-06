# Endless progression decision record

> **Design-track quarantine:** do not use this document while authoring vanilla
> candidates, fixtures, or capture hypotheses. Designed mechanics may not select
> or shape what parity capture tries to prove.

**Status:** owner review in progress. EP-D01, EP-D02, and EP-D07 have explicitly
accepted dispositions; EP-D03–EP-D06 and EP-A01–EP-A03 remain pending.
**Implementation remains blocked.**

This record turns the six original gates in the
[Endless progression system](endless-progression-system.md#gate-before-code)
and later owner-raised product questions into durable, independently reviewable
decisions. EP-D07 records the first such added constraint. None changes
measured vanilla behaviour or authorizes an `endless-v0` implementation.

For the shorter pre-read and guided review sequence, use the
[owner decision packet](endless-progression-owner-packet.md). This file remains
authoritative after the selected answers are transcribed here.

## How to record a decision

The detailed **Record** under each decision is authoritative; the summary table
is a derived reading aid and must be updated in the same reviewed commit. For
each ID, replace `pending` only after the owner explicitly chooses
`accepted`, `rejected`, or `revise`. Record the owner, UTC date, and exact
revision when applicable. A chat acknowledgement is not durable until it lands
in this file. Only `accepted`, or `revise` with a fully normative replacement
explicitly marked accepted, closes the readiness gate. `rejected` or an open
revision remains blocking and requires the proposal/MVP scope to be rewritten.

```text
EP-D01: accepted
EP-D02: revise — accepted replacement: <rule>
EP-D03: accepted
EP-D04: accepted
EP-D05: accepted
EP-D06: accepted
EP-D07: accepted
Owner: <name>
UTC date: YYYY-MM-DD
```

An acceptance approves a design constraint, not its current tuning. Numeric
balance still has to pass the gates in the system design and the future
readiness plan.

## Decision summary

| ID | Decision | Recommendation | Status |
| --- | --- | --- | --- |
| EP-D01 | End ordinary vertical power at a versioned campaign ceiling, then permit only a finite behaviour-led veteran edge alongside continuing Arena Pursuits | Accepted replacement; clauses 6–7 amended for Legendary-only Ascendancy and per-encounter Branch selection; exact ceiling, catalogs, and balance remain later gates | `revise — accepted replacement`; clauses 6–7 `revise — accepted amendments` / Zanzagar / 2026-09-03 and 2026-09-04 |
| EP-D02 | Grow personal Rule Capacity through authored championship milestones to a finite 48-Load ceiling | Accepted replacement; exact personal credit, costs, hosts, route clamp, Team Tactic exception, validation, and migration are normative below | `revise — accepted replacement` / Zanzagar / 2026-09-04 |
| EP-D03 | Make one Arena Circuit four fights | Accept only as the 2v2 MVP measurement boundary; human timing may revise it | `pending` |
| EP-D04 | Let rarity change behaviour complexity, not chassis budget | Revise before decision: preserve chassis equality while reconciling the accepted all-Legendary legal loadout and mixed-rarity viability contract | `pending` |
| EP-D05 | Use personal precommitted frontier outcomes and typed post-completion records | Accept only with atomic settlement, ordered plan folding, and maintenance entitlement | `pending` |
| EP-D06 | Make the first playable proof deterministic 2v2 under a separate designed rule set | Accept only after selecting the public deterministic RNG model and separating headless/playable gates | `pending` |
| EP-D07 | Keep persistent gladiators mode-neutral and require human-controlled allied seats in the first playable version | Accepted; disconnect pauses at an action boundary, then an accepted visible grace period may arm the absent member's pre-consent for connected teammates to abandon | `accepted`; corrected dropout supplement `accepted` / Zanzagar / 2026-09-03 |

The decisions are coupled. D01 prevents an infinite scalar gear ladder while
requiring a finite behaviour-led veteran edge and three continuing Pursuits;
D04 must preserve chassis equality without contradicting D02's legal
all-Legendary endpoint or mixed-rarity viability rule. D02 prices and unlocks
personal simultaneously equipped behavioural breadth, including Ascendancy,
while keeping Team Tactic outside that fungible budget. D03 determines
the Circuit commitment window and Pivot timing. D05 makes Pursuit settlement
fair and reload-safe. D06 is the smallest team format that can test the
resulting co-op choices rather than a solo scalar ladder. D07 preserves one
gladiator's identity across event sizes while making the first playable proof a
genuine human team instead of filling or finishing allied seats with AI.
Its accepted corrected dropout supplement keeps per-member reconnect available
while giving the connected team an RTS-style, non-automatic way to end a
suspended Circuit after every absent member's visible grace period expires.
Combat resumes only after every required ally returns.

### Required model/architecture dispositions

These do not expand the seven product decisions. They record how open blockers
are resolved. Accepting an EP-D decision does **not** accept its corresponding
EP-A repair. Each EP-A record needs its own owner/date-stamped disposition.

| ID | Blocker | Recommended disposition | Status / owner / UTC date |
| --- | --- | --- | --- |
| EP-A01 | Career/frontier pacing | Enforce `careerLevel <= highestClear + 1` and at most one total level per four-key set; remove the five-Circuit milestone target | `pending` / — / — |
| EP-A02 | Public deterministic combat RNG/retry | First select a branch-oracle-safe public coupling/forecast contract; then select exact retry state or a finite persisted post-loss seed sequence and specify Recovery/Overtime seed visibility | `pending` / — / — |
| EP-A03 | Post-completion access | Select a zero-growth maintenance/reconstruction model with explicit licence creation, slots, retirement, and conservation; no completion power spike | `pending` / — / — |

Record these separately, for example:

```text
EP-A01: accepted — synchronization invariant
EP-A02: revise — accepted replacement: <full RNG/information contract>
EP-A03: revise — accepted replacement: <maintenance contract>
Owner: <name>
UTC date: YYYY-MM-DD
```

## EP-D01 — finite campaign vertical power and continuing Pursuits

**Disposition:** `revise — accepted replacement`.

**Exact accepted replacement:**

1. `[A]` Ordinary stats and item-chassis power grow during the main campaign,
   then stop at a finite, versioned **campaign vertical ceiling**. Tier 50 is
   not a permanent promise; the exact tier is a tuning parameter aligned with
   the expected Emperor encounter.
2. `[A]` Defeating the Emperor unlocks Arena Circuits and postcampaign Arena
   Pursuits. Wherever practical, their underlying combat vocabulary appears
   during the campaign so postgame expands familiar systems rather than
   introducing an unrelated game.
3. `[A]` Career level may continue indefinitely, but post-ceiling levels cannot
   create unbounded stats, chassis budgets, active-rule capacity, multipliers,
   or equivalent disguised scalar growth.
4. `[A]` A small veteran combat edge may continue through **Ascendancy**, but
   its simultaneously active power is finite and behavior-led. Its exact
   shared active budget belongs to EP-D02.
5. `[A]` **Arena Pursuits** contain three parallel lanes:

   - **Ascendancy Pursuit:** permanently learn Lineage Evolutions.
   - **Frontier Pursuit:** unlock unusual encounters, compositions, challenge
     routes, and greater risk/reward opportunities.
   - **Legacy Pursuit:** unlock cosmetics, presentation, titles,
     history-dependent rewards, and noncombat system access.

   Each combatant selects one primary Pursuit per Circuit. That choice directs
   progression rewards; it does not disable abilities already earned through
   another Pursuit.
6. `[A]` For a Circuit, a combatant may Ascend at most one equipped
   Legendary-rarity item. “Trophy,” “Signature,” or “Keystone” naming does not
   independently qualify an item. The base identity, one Core Evolution, one
   active learned Branch, and any active completion benefit form one
   indivisible three-Load item payload. Additional Branches may be permanently
   learned without increasing simultaneous active capacity.
7. `[A]` The Ascended Legendary and Core lock for the Circuit. After each
   encounter preview and before its first attempt, the gladiator may retain or
   select one learned Branch from that exact lineage. That Branch locks through
   all attempts, Rematches, and reloads of the encounter; Training Assistance
   reopens selection once for its altered recipe, and Recovery uses the same
   per-encounter rule. This bounded one-item adaptation is intentional and does
   not spend the ordinary loadout Pivot; full item/Core reattunement occurs only
   between Circuits.
8. `[A]` Standard late opponents obey the same bounded raw-power grammar as
   players and never scale from the currently equipped player snapshot. Rare,
   clearly disclosed encounters may carry bounded exceptional levels or wild
   powers, accompanied by exploitable liabilities and proportionally better
   rewards.
9. `[A]` Mechanical Ascendancy may eventually reach its active ceiling, but the
   game may not place all progression lanes into a completed state at one
   milestone. At least one meaningful strategic, encounter, cosmetic, or
   system-access objective must remain visible. A bare level counter or
   Chronicle entry does not satisfy this requirement by itself.

`[U]` Exact ceiling tier, Ascendancy magnitude, Circuit length, non-Capacity
reward cadence, catalogs, and balance remain later gates. EP-D02 now owns the accepted Rule
Capacity interaction. This decision does not authorize implementation.

**Parity/seam:** this is Endless campaign, progression, encounter, and loadout
policy. It may use measured classic formulas only when their entire required
path is promoted. Every new action, payoff, cap correction, Ascendancy effect,
or postcampaign state remains behind the separate designed rule set and never
changes a classic descriptor.

**Degenerate strategies invited:** leak a nominally lateral reward into an
uncapped scalar; accumulate Evolutions that secretly stack outside the active
budget; freely reattune the full loadout or Ascended item/Core after seeing an
opponent beyond the accepted one-Branch window; turn rare encounters into
undisclosed stat checks; or satisfy continuing progression with an empty number
or record.

**Required counters and rejection gates:** the future authored specification
must version and exhaustively enforce the campaign ceiling across every stat,
generator, drop, Forge path, Evolution, and migration; enumerate Ascendancy
against the EP-D02 active budget; freeze the Ascended item and Core for the
Circuit, freeze its selected Branch for each encounter under clause 7, and keep
the ordinary Pivot from changing either; prove standard opponents do not read
equipped player power; attach a disclosed liability to every exceptional opponent
package; and demonstrate a meaningful successor objective whenever another
Pursuit target completes. A Chronicle-only successor fails this gate.

**Approval consequence:** EP-D01 is closed as a product decision. The exact
campaign-ceiling integer, EP-A01 pace mapping, EP-D03 Circuit/Pivot timing,
reward catalogs, migrations, and balance tests
remain blockers. Changing a released ceiling later requires a new design
version and explicit migration; it does not alter classic data.

**Record:** `revise — accepted replacement` — owner: Zanzagar; UTC date:
2026-09-03. The owner explicitly replied `EP-D01: accepted as replayed` after
reviewing the complete nine-clause wording above. Clauses 6–7 were subsequently
`revise — accepted amendments as replayed` — owner: Zanzagar; UTC date:
2026-09-04. The other seven accepted clauses are unchanged.

## EP-D02 — personal Rule Capacity grows to a finite 48-Load ceiling

**Disposition:** `revise — accepted replacement`.

**Exact accepted replacement:**

1. `[A/D]` Each persistent gladiator has an integer **Rule Capacity**. Its active
   **Rule Load** is the sum of every equipped behavior payload. Capacity starts
   at `0` and reaches a finite version-one maximum of `48`, derived from sixteen
   simultaneous item positions at a maximum of three Load each.

2. `[A]` Item payload costs are categorical:

   - Standard or unchanged ordinary item/spell: `0`
   - Tempered minor behavior: `1`
   - Inscribed major behavior or two compatible minors: `2`
   - Legendary identity behavior: `3`

   No behavior-changing payload may masquerade as zero Load. The old
   maximum-one 3-Load identity rule is removed.

3. `[A]` The sixteen possible Legendary hosts are primary weapon, secondary
   weapon, breastplate, helmet, shinguard, greaves, shoulderguard, gauntlet,
   boot, shield, and six carried spell/Technique positions. The catalog must
   permit at least one otherwise-legal all-sixteen-Legendary loadout, although
   arbitrary Legendary combinations may still fail compatibility rules.

4. `[A]` Every equipped behavior-bearing item reserves its full Load for the
   frozen loadout, even while unused or temporarily inactive. Both weapons
   reserve Load for the entire Circuit; only the exact active weapon's payload
   operates. Weapon swapping cannot alter capacity or expose an unpaid effect.
   Slot occupancy, item-source activation, family exclusions, strongest-only
   stacking, control/survival limits, and other authored legality remain
   independently enforceable.

5. `[A]` Forms, Signature designations, and Keystones cease to be standalone
   Load sources. Their useful concepts may exist as item-contained behaviors
   but create no additional ability slots. Bound Soul remains one separately
   bounded character-creation identity outside equipment capacity. Charms and
   Soul Relics remain deferred and cannot add active rules until a later
   decision gives them explicit slots and accounting.

6. `[A]` Capacity belongs solely to `combatantId`. It is never campaign-wide,
   transferable, tradeable, copied, averaged, loaned, or projected from another
   gladiator. A guest may contribute access to a Team Tactic choice but never
   capacity.

7. `[A/D]` Version one uses eighteen stable authored championship milestone
   IDs, excluding the Fearful Prisoner tutorial. Each three-boss chapter grants
   `+2, +3, +3`:

   | Authored milestones | Personal grants | Capacity after chapter |
   | --- | --- | ---: |
   | John the Butcher; Evil Ninja; Son of Stylonius | `+2, +3, +3` | 8 |
   | Marksman Dantus; Great Beast; Wizard Sagan | `+2, +3, +3` | 16 |
   | Slave Driver; Spheracles; Maharaja Saeed | `+2, +3, +3` | 24 |
   | Gaiax; Daimyo Katsumodo; HeChaos | `+2, +3, +3` | 32 |
   | Archfiend Zeerzabahl; Sir Belgrave; Bhaargle Yarg | `+2, +3, +3` | 40 |
   | Archangel Sandalphon; Nameless Shadow; Emperor Antares | `+2, +3, +3` | 48 |

   These names and ordering are intentional Endless authoring, not a claim that
   the fingerprinted build's complete ladder has been runtime-verified. Emperor
   is entered at capacity 45; victory grants the final three points for
   postgame saturation.

8. `[A]` A milestone credits every persistent gladiator in its frozen victorious
   roster, including one knocked out before team victory. Benched and
   nonparticipating gladiators receive nothing. An authorized full-rank
   victory, Training Assistance victory, or precommitted Recovery victory
   qualifies. Capacity is a core campaign transition rather than a first-clear
   bonus; it is the sole mechanical exception to Recovery's otherwise
   zero-grant rule. Loss, Concede without victory, Practice, historical or
   low-tier replay, and nonqualifying encounters grant none.

9. `[A]` Each grant is represented by one bounded receipt keyed by the gladiator
   and stable milestone lineage. The winning settlement atomically writes the
   boss result, receipt, and capacity change or writes none of them. Reload,
   duplicate delivery, repeat clear, another team format, or a later
   schedule-version number cannot recreate that entitlement.

10. `[A]` Newly earned capacity becomes usable only at the next legal loadout
    boundary. It never changes a battle or Circuit already in progress.

11. `[A]` Lower-progression Circuits use:

    `effectiveCapacity = min(personalEarnedCapacity, routeCapacityCeiling)`

    The route ceiling is the capacity available immediately before that
    route's next championship milestone. A veteran retains all earned capacity
    persistently but must explicitly choose a legal lower-band Circuit loadout.
    The game never mutates or disables the veteran's ordinary saved equipment
    to enforce the projection.

12. `[A]` Equip and configuration operations validate the complete proposed
    result before mutation. If the resulting Load exceeds personal or
    applicable route capacity—or violates another loadout rule—the entire
    operation is refused and the prior equipment/configuration remains
    byte-for-byte intact. The game never partially equips, automatically
    disables another item, or asks which existing item should become inert
    after the attempted mutation.

13. `[A]` At most one equipped Legendary-rarity item may be Ascended for a
    Circuit. Its base identity, one Core Evolution, one active learned Branch
    Evolution, and any eventual active completion benefit form one bounded,
    indivisible three-Load payload. Ascendancy never adds another Load source.
    Additional learned Branches expand the portfolio only.

14. `[A]` The Ascended Legendary and Core lock for the Circuit. After each
    encounter's authorized preview and before its first attempt, that gladiator
    may retain or select one learned Branch belonging to the exact Legendary
    lineage. The selection persists through defeat, reload, and Rematches.
    Entering Training Assistance permits one new selection before the first
    assisted attempt because it changes the recipe; Recovery follows the same
    per-encounter rule. Branch selection does not consume the ordinary loadout
    Pivot, and that Pivot cannot change the Ascended item or Core.

15. `[A]` Team Tactic uses one visible, nonfungible team-rule allowance outside
    personal Rule Capacity. It cannot be converted into item Load, and its
    selection cannot invalidate a personal loadout. At most one applies to the
    team and it locks for the Circuit. Exact acquisition, voting, 1v1
    availability, and source-member lifecycle remain separate Team Tactic
    specification work.

16. `[A]` Active Circuits finish under their pinned rule, schedule, and
    item-definition versions. A migration occurs only at a clean boundary. If
    new costs or slot grammar make a saved loadout illegal, every item and the
    prior configuration record remain preserved, but that configuration cannot
    enter new play until its owner explicitly selects a legal replacement.
    Migration never auto-unequips, disables, salvages, or retires an item.

17. `[A]` The sixteen-host grammar, three-point maximum, milestone ledger, and
    48-point ceiling are versioned. Adding a simultaneous rule-bearing slot or
    changing costs requires an explicit replacement decision and receipt
    migration; content additions cannot silently raise or lower capacity. No
    post-Emperor boss or career level grants further capacity in this version.

18. `[A/U]` A fully Legendary loadout may be the theoretical optimum, but it
    must not become generically best in every matchup. Legendary burdens,
    compatibility, and authored opponent differences must preserve useful
    mixed-rarity configurations. EP-D04 still owns the exact dominance rule and
    remains pending.

**Parity/seam:** Rule Capacity, milestone receipts, item payloads, route clamps,
and Team Tactic allowance are Endless state. Any payload that changes combat
legality or outcome requires `endless-v0`; classic descriptors do not read this
state. The milestone names and order above are intentional Endless authoring,
not a claim that the fingerprinted build's complete ladder is runtime-verified
and not promoted vanilla observations.

**Degenerate strategies invited:** funnel capacity to a team or campaign;
duplicate boss receipts; hide payloads in inactive slots; bypass a route clamp;
turn Team Tactic into fungible personal Load; perfect-counter Branch swapping;
or make sixteen Legendary items the universal answer.

**Required counters and rejection gates:** stable per-combatant milestone
lineages, atomic/idempotent settlement and crash replay, total proposed-state
validation, exact equipped-source linkage, strongest-only stacking groups, no
effect-triggered effect, route-ceiling fixtures, pinned-version migration
fixtures, and exhaustive or coverage-justified build-frontier tests over every
slot, cost, Branch, Tactic, matchup, and compatibility family. At least one
all-sixteen Legendary loadout must validate, while mixed-rarity builds must
remain viable under the future EP-D04 gate.

**Approval consequence:** EP-D02 and the related EP-D01 clauses 6–7 are closed
as product decisions. Schema, UI, generator, AI loadouts, hashes, settlement,
migration, and tests must use the accepted personal milestone-capacity model.
Exact content balance, Team Tactic lifecycle, EP-D04's dominance metric, and a
replacement EP-A03 maintenance model remain blockers. This decision does not
authorize implementation.

The accepted 48-point replacement also supersedes EP-A03's hard-coded
four-unit Reconstruction Tray as a selectable proposal. This is a dependency
consequence, not a nineteenth EP-D02 clause: do not replace four with
forty-eight mechanically. EP-A03 remains pending and requires redesign.

**Record:** `revise — accepted replacement as replayed` — owner: Zanzagar; UTC
date: 2026-09-04. In the same reply, the owner explicitly recorded
`EP-D01 clauses 6–7: revise — accepted amendments as replayed.`

## EP-D03 — one Arena Circuit contains four fights

**Canonical decision (exact approval scope):** one Circuit contains four
fights.

**Dependent working assumptions, not separately approved by D03:** a Circuit
currently commits one previewed route and locked starting loadouts; the fourth
fight is the final; Rematch/Recovery and reward/clear transitions follow the
system design's separate rules.

**Recommendation:** accept only as the first 2v2 measurement boundary. Four
supplies an opener, two adaptation checks, and a final intended to preserve a
session-sized commitment, subject to the interactive timing gate. It is not
evidence that four is optimal for all formats.

**Alternatives considered:**

- three reduces fatigue but gives only one middle encounter and weakens the
  locked-kit endurance question;
- five or more supports a longer arc but magnifies disconnect, inventory-lock,
  and failed-run recovery costs;
- variable length complicates reward normalization and makes route comparison
  harder before the economy is validated.

**Parity/seam:** Circuit scheduling and content-only opponents can preserve a
future verified classic combat path while changing campaign parity. Contract
laws or effects that alter combat require the designed rule set. Settlement,
locks, and rewards live outside action resolution.

**Degenerate strategy invited:** scout/concede early, farm only the best first
fight, deliberately lose to preserve a favourable plan, or choose the shortest
reward-efficient route.

**Required counter and rejection gate:** precommit the complete route and
reward plan; advance no **noncombat** stream on Concede/Recovery restart while
combat-attempt state follows the selected EP-A02 contract; pay only
`grantEligible` outcomes; include all scouting actions in progression-per-action
metrics; and compare risk-normalized reward rates across routes. Playtest
completion time, abandonment, Pivot use, and per-seat meaningful actions before
extending the same length to 3v3.

Multiplying the present per-fight target ranges gives a 48–96 actor-action
planning envelope for four-fight 2v2 and 72–144 for 3v3; these are not
statistical Circuit medians. If R-05's skipped-turn repair is proved, the
candidate summed safety caps are 316 and 476 for resolved actor-actions and,
separately, for scheduled opportunities. Neither converts to a hard time cap
until presentation and human decision time are bounded. D03 acceptance
explicitly permits revision after end-to-end timing.

**Approval consequence:** four becomes part of plan, escrow, receipt, UI, and
soak fixtures. A later length change is a generator/progression version change,
not a silent balance tweak.

**Record:** `pending` — owner/date: —

## EP-D04 — rarity changes behaviour complexity, not chassis budget

**Canonical decision (exact approval scope):** rarity changes behaviour
complexity, not chassis budget.

**Dependent working interpretation, not separately approved by D04:** within a fixed chassis family/profile/tier, rarity changes
the number, structure, or authored identity of compatible behaviour effects. It
does not increase the item's ordinary damage, armour, health, or stat budget.

**Recommendation:** revise before decision. Preserve same-family/profile/tier
chassis equality, but replace the old absolute dominance wording with an exact
matchup-grid, weighting, tie, and threshold contract compatible with accepted
EP-D02 clause 18. A fully Legendary loadout may be a theoretical optimum and at
least one all-sixteen-Legendary loadout must be legal, while burden,
compatibility, and opponent differences must still leave useful mixed-rarity
configurations. That combination is not yet operationally specified.

**Alternatives considered:**

- small rarity multipliers still become mandatory when optimization is the
  game, and compound across slots;
- random affix counts without budgets create lottery best-in-slot items;
- cosmetic-only rarity cannot carry the proposed build discovery by itself.

**Parity/seam:** rarity, provenance, and offers are progression state. Existing
verified item semantics could remain classic-compatible; every novel behaviour
effect requires the designed rule set. A rarity label alone never promotes or
changes vanilla evidence.

**Degenerate strategy invited:** always equip the highest colour, fish for the
one compound affix set, or use rare identities whose nominal burden does not
pay for their interaction value.

**Required counter and rejection gate:** chassis equality assertions across
rarities; compatible pools and mutual exclusions; accepted Load/host budgets;
duplicate conversion/pity; full combination tests; and observed loadout
turnover driven by matchup, not colour. The replacement must define the
mechanics-distinct opponent grid, uniform and actual-generator weights, tie
handling, “useful mixed-rarity” metric, and permitted Legendary concentration.
It must allow the accepted theoretical optimum without letting one Legendary
package pass merely by losing a showcase liability cell or lead generically
across the real matchup distribution.

**Approval consequence if later accepted:** item generation, UI comparison, AI
equipment, Forge, and migration must preserve chassis equality and the selected
mixed-rarity/dominance metric. Until then EP-D04 remains a blocker, not an
implicit extension of EP-D02.

**Record:** `pending` — owner/date: —

## EP-D05 — personal precommitted outcomes and typed completion records

**Canonical decision (exact approval scope):** every mechanically incomplete
`grantEligible` persistent combatant receives a personal precommitted reward
outcome, while newly prepared completed slots are typed records and only one
already prepared reward set may be grandfathered.

**Dependent working interpretation, not separately approved by D05:** before a
paid attempt, prepare one immutable personal outcome for every persistent,
mechanically incomplete combatant who can become `grantEligible`. Settlement
grants each eligible combatant's own outcome; it never assigns loot by last hit
or a shared random roll. A completed slot receives a typed record whose optional
payload may be cosmetic/title. If completion happens after one reward set was
already prepared, at most that one immutable set may be grandfathered.

**Recommendation:** accept only together with an atomic persistence boundary,
strict predecessor-state folding for all four precommitted outcomes, and a
separately accepted EP-A03 maintenance contract.
The rule protects seat agency, prevents last-hit/shared-roll allocation
funneling, removes last-hit incentives, and makes completion finite. Stable-AI
reward streams and tradeable natural items can still funnel a carry. Without
durable prepare/acknowledge/apply repair, however, it creates duplicate- and
loss-prone value.

**Alternatives considered:**

- shared need/greed imports social pressure, disconnection edge cases, and
  carry funneling into a short local co-op game;
- last-hit or contribution allocation distorts combat choices;
- independent rolls generated after victory permit reload fishing;
- converting every post-completion slot into more mechanical power defeats the
  finite-system goal.

**Parity/seam:** reward planning and custody do not change action resolution and
can accompany a classic-compatible content route, but novel granted effects
still require the designed rule set when equipped. Persistence must store the
rule ID/contract/design triple and generator/definition provenance.

**Degenerate strategy invited:** restart for different offers, duplicate a
grant across an acknowledgement crash, complete a collection between prepare
and settlement to mint extra mechanical items, or route all useful custody to
one carry.

**Required counter and rejection gate:** precommit and hash outcomes; immutable
escrow IDs; stable owner IDs; exact `grantEligible` classification; one durable
transaction applying attempt, grant, key, pot, completion, and receipt state;
idempotent replay after every injected crash boundary; concentration-dominance
tests; and the one-set grandfather limit. No implementation starts until the
relationship among active battle, campaign record, and progression sidecar has
one specified atomic journal/recovery boundary.

Completion must not issue mechanical frontier rewards, but it also must not
strand legitimately earned build access. EP-A03 must state what event creates a
permanent identity licence, how many reconstruction slots exist, whether a
viewed-but-declined offer counts, how retirement behaves, and which host
chassis/slots are required. Any entitlement is earned progressively or
converted one-for-one from existing rights; completion cannot suddenly grant
free equipment, unlock an unknown ID, bypass a source, increase simultaneous
copies, or create transferable value. Record outcomes stay mechanically inert.

**Approval consequence:** this fixes the semantic settlement contract but not a
storage engine. The readiness specification must choose the atomic boundary and
repair protocol before schema code.

**Record:** `pending` — owner/date: —

## EP-D06 — first playable proof is deterministic 2v2 under designed rules

**Canonical decision (exact approval scope):** the first playable proof is 2v2
and uses a separate designed rule set.

**Dependent working assumptions, not separately approved by D06:** the current
proof proposal uses the non-runtime-verified `endless-v0` descriptor,
four-fight Circuits, independent human custody/reward choices, deterministic
generation, and reproducible combat. Accepted EP-D07 now requires two distinct
connected human allied controllers if this 2v2 proof is selected; allied AI,
multi-seat human control, and takeover cannot complete it. It never presents
itself as vanilla parity.

**Recommendation:** accept after the owner separately selects EP-A02's public
deterministic RNG/information contract. A 1v1 proof cannot test seat agency, focus fire,
personal rewards, shared decisions, or mixed build coverage. A first 3v3 proof
multiplies UI/state and balance cost before those questions are answered.

**Alternatives considered:**

- 1v1 is cheaper but validates only a solo progression ladder;
- 3v3 better represents the maximum target format but expands target, UI,
  action-time, and combinatorial surfaces too early;
- a classic descriptor cannot honestly host new actions, exact-probability
  semantics, Pressure, or behaviour affixes.

**Parity/seam:** always a separate designed rule set with
`runtimeVerified: false`. The currently legal verification remains
`placeholder`; today only a provenance note can reliably distinguish designed
intent. If contract v2 retains an explicit `designIntent`, it must validate,
describe, project, hash, and persist it. Contract v2 does **not** silently add a
new verification enum. A future `designed` enum needs its own contract/schema
migration.

**Degenerate strategy invited:** focus-fire deletes one seat before agency,
one carry makes every important decision, a support seat becomes an appliance,
or deterministic seeds turn into solved scripts.

**Required counter and rejection gate:** per-seat meaningful-action and value
metrics; focus-fire response fixtures; distinct-human allied-seat admission,
action-boundary suspension, same-seat reconnect, and abandonment-liveness
tests; loadout locks and bounded Pivot; pre-registered held-out evaluation
seeds that are not a runtime security boundary; and no secret-seed security
claim.
Separate two milestones: a headless deterministic
2v2 proof may run after the state/contracts are ready, but a **playable** proof
also requires per-action animation acknowledgement so action N+1 cannot rebind
vanilla globals while action N's timeline is still running.

Independent action/target labels plus exact same-seed Rematches are rejected:
with `m` equally likely independent alternatives at hit probability `p`, a
seed-aware player finds a successful label with `1 - (1 - p)^m` probability
(50% becomes 93.75% with four labels and 99.61% with eight). The recommended
offline option must couple every counterfactual payoff axis—not only primary
hit—or expose the complete forecast for every legal action as intentional UI.
A finite loss-receipt-derived attempt-seed sequence is an orthogonal retry
choice: it changes exact Rematch semantics and prevents restoring an old seed,
but cannot replace the branch-oracle-safe coupling/forecast contract. Hidden
entropy is not an offline safety premise. EP-A02 separately defines when
Recovery/Overtime seeds become actionable, and Overtime remains deferred until
a white-box policy is non-degenerate.

**Approval consequence:** it makes the specifications eligible for separate
owner implementation authorization after every readiness gate. It does not by
itself authorize an `endless-v0` branch, launcher work, original-game
deployment, runtime capture, or changes to classic rules/evidence.

**Record:** `pending` — owner/date: —

## EP-D07 — mode-neutral gladiators and human-only allied MVP

**Disposition:** `accepted`.

**Canonical decision (exact approval scope):**

1. A persistent gladiator is mode-neutral and may enter 1v1, 2v2, or 3v3
   events. Team size and participating roster are chosen per Circuit and remain
   locked until that Circuit ends. Changing formats never resets the
   gladiator's Bound Soul, levels, stats, equipment, Legendary Lineages, or
   personal Tactic library.
2. For the first playable version, every allied seat must be controlled by a
   distinct connected human player. Opponents may be AI-controlled, but allied
   AI fill, one-human multi-seat control, and automatic AI takeover are
   excluded.
3. If a player disconnects, any already-committed action finishes and the
   battle then pauses at the next action boundary. Reconnecting restores that
   player to the same gladiator and state. Otherwise, only the established
   team-abandonment protocol may end the suspended attempt. The AI never
   assumes control.
4. Hot-seat parties, solo control of multiple gladiators, AI companions, and
   opt-in AI takeover remain possible future designs, not promised features.

**Accepted dropout-abandonment supplement (corrected exact approval scope):**

1. Circuit entry freezes the visible, versioned grace policy accepted by every
   member. It grants no control or custody rights.
2. A disconnect finishes any committed action exactly once. If that action
   ends the battle, normal settlement completes—no pause or timer. Otherwise,
   the battle checkpoints and pauses, and that member's individual timer
   starts.
3. Reconnecting restores only that player's original gladiator and seat. It
   cancels their dropout state and invalidates pending abandonment votes.
   Combat resumes only when every required ally has reconnected; otherwise it
   remains paused.
4. Timer expiry never automatically abandons, kills, advances combat, or
   invokes AI. It only activates that absent member's pre-consent for
   abandonment. The team may keep waiting.
5. Every connected member must approve abandonment, and every disconnected
   member's timer must have expired:

   - 2v2 with one dropout: the remaining player decides.
   - 3v3 with one dropout: both remaining players must approve.
   - 3v3 with two dropouts: the sole remaining player decides after both timers
     expire.
   - Nobody connected: nothing happens automatically.

6. A new disconnect or reconnect invalidates any vote based on the old
   presence state. Reconnect and abandonment are atomic: whichever commits
   first determines the outcome.
7. Abandonment uses the existing atomic Concede receipt. Committed progression
   remains; unearned Circuit outcomes and Contract completion are forfeited.
   Nobody dies or loses custody.
8. The precommitted Recovery route remains preserved, but it retains its
   original roster and human-seat requirements. The reduced team cannot enter
   it without the missing players, control their gladiators, or fill their
   seats with AI.
9. Only authenticated session-liveness detection may open a dropout timer.
   Players cannot manually declare teammates dropped. The exact grace duration
   remains visible, versioned tuning.

**Repository boundary:** the headless resolver already accepts one-to-three
seats per team, separates combatant identity from controller identity, and can
drive AI on either side. It does not encode a permanent character format. [V]
Persistent cross-format campaign progression, a playable multi-human session,
disconnect detection, durable mid-battle pause/reconnect, and live multi-slot
presentation are not implemented. The only concrete non-test AI policy is
explicitly placeholder. [U]

**Alternatives considered:**

- binding a character to 1v1, 2v2, or 3v3 at creation fragments one long-lived
  Bound Soul, gear history, and Legendary Lineage across duplicate careers;
- allowing one human to command several allied gladiators makes team modes
  accessible alone, but changes the multiplayer fantasy and reintroduces
  per-human reward and command-concentration problems;
- allied AI fill keeps a short roster moving, but must understand arbitrary
  player builds, personal Tactics, and custody without sabotaging a mortal
  gladiator; and
- automatic AI takeover avoids a pause, but can make an irreversible combat or
  tournament decision for a disconnected owner and invites intentional
  disconnect as an action-selection policy.

**Parity/seam:** vanilla supplies no evidence for 2v2 or 3v3 and no persistent
cross-format campaign path. This is an Endless product rule behind the separate
designed rule set. Existing headless controller and AI-fill capabilities may
remain tested architecture seams, but they are not first-playable product
features and do not become runtime-verified through this acceptance.

**Degenerate strategies and failure modes invited:** a team-oriented build can
become unusable when its gladiator enters 1v1; one format can become the easiest
farm for power used in another; a duplicate or spoofed connection can pretend
one human is several players; false dropout attribution can activate an absent
member's conditional consent; or reconnect and abandonment can race and either
lose state or apply both transitions.

**Required counter and rejection gate:** every offered build retains a
functional solo action loop; reward and difficulty tests compare the same
gladiator across 1v1/2v2/3v3 without resetting or duplicating persistent state;
first-playable readiness rejects an allied AI controller, an empty allied seat,
or one controller/member authority occupying both allied seats; and durable
continuation tests finish one committed action, pause before the next action,
reject all commands while paused, then restore the same seat, combat projection,
hash, and controller authority on reconnect. Circuit admission must persist the
accepted versioned grace policy; authenticated session liveness alone starts a
visible independent timer for each absent member; expiry changes no combat or
reward state; every connected member must approve abandonment; every
disconnected member must have an expired timer; and any new disconnect or
reconnect invalidates a proposal based on the old presence state. A terminal
committed action settles without suspension. One reconnect during multiple
dropouts restores only that member and leaves combat paused. The exact session
topology, presence mechanism, timer duration, durable timer representation, and
reconnect-versus-abandon serialization remain [U] readiness blockers. None may
be replaced by AI or a player's manual dropout declaration.

**Approval consequence:** team size is an event/Circuit property rather than a
persistent gladiator mode. If pending EP-D06 later selects the proposed 2v2
playable proof, that proof requires two distinct connected human participants
and a real pause/reconnect protocol. A visible versioned grace period now gives
connected teammates a liveness-safe quit path without automatic abandonment:
the full connected remainder approves, while each absent member contributes
only the narrow conditional consent accepted at Circuit entry after their own
timer expires. A resulting Concede preserves the original Recovery roster and
human-seat requirements; it grants no proxy custody or reduced-party entry.
“Network transport” can no longer be blanket-deferred without
first specifying another genuine two-human topology. This decision does not
select that topology or exact duration, promise later companion/hot-seat modes,
authorize implementation, or close EP-D06.

**Record:** `accepted` — owner: Zanzagar; UTC date: 2026-09-03. The owner
explicitly replied `Accepted` after reviewing the complete four-clause wording
above. The owner then replied `Accepted` to an eight-clause dropout replay, but
pre-commit review found my statement that any reconnect “resumes play” false
when another 3v3 member remains disconnected and found “Recovery remains
available” ambiguous about reduced-roster entry. I withdrew that replay rather
than silently reinterpret it; it was never committed. The owner explicitly
replied `Accepted` to the corrected nine-clause supplement above on 2026-09-03.

## Contract consequences that are not an eighth product decision

If the seven decisions are accepted, the current proposal still requires an
explicit rule-contract v2 specification before code:

- require a nonnegative safe-integer `designVersion` in every descriptor;
- project and hash the `(id, contractVersion, designVersion)` triple through
  battles, results, recipes, items, rewards, receipts, saves, and peers;
- migrate every classic v1 descriptor explicitly to `designVersion: 0` rather
  than defaulting a missing field at runtime;
- keep `endless-v0` legally `placeholder`, `runtimeVerified: false`, with a
  provenance note unless v2 explicitly validates/projects/persists designed
  intent, until a later enum migration is separately reviewed; and
- define the selected Endless combat RNG/information contract as a contract
  change, including its
  structural draw coordinates, counters/ordinals, counterfactual information
  policy, state projection, hashing, replay, and compatibility. It is not an
  internal implementation detail of one effect.

Those consequences are architecture gates created by the proposed design. They
do not approve the product constraints above and may still reveal that one must
be revised.

## Approval checklist

The owner should be able to answer yes to all of these before marking all seven
accepted:

- The vertical endpoint is intentionally designed, not claimed as a measured
  vanilla flattening level.
- Behaviour breadth is intentionally budgeted and finite.
- Four fights is accepted as the first measurement boundary, not a universal
  session-length truth.
- Rarity will never silently become a chassis multiplier.
- Personal rewards are blocked on durable atomic prepare/apply/repair semantics.
- Headless 2v2 and playable 2v2 are understood to have different integration
  gates.
- Persistent gladiators keep one identity across 1v1/2v2/3v3, while the first
  playable allied roster contains one distinct connected human per seat and no
  AI takeover or fill.
- A recognized disconnect finishes only an already-committed action, then
  durably pauses before another command until authenticated reconnect or the
  accepted team-abandonment path resolves it.
- Grace expiry never resolves combat or abandons automatically: after all
  absent members' accepted timers expire, every connected roster member must
  approve the existing atomic Concede receipt; a presence change makes the old
  proposal stale, and one reconnect cannot resume while another required ally
  remains absent.
- No accepted decision authorizes classic-rule changes, candidate shaping,
  runtime capture, launcher deployment, or installed-game access.
