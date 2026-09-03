---
handoff:      2026-09-03-0850--chat-close-next-ep-d02-variable-rule-load
written:      2026-09-03 08:50 -0400
sessionId:    01a0656b-002f-7323-81d6-92c48b2ce56f
agentRuns:    no new fan-out for this terminal handoff; prior runs are recorded in the superseded handoffs
branch:       design/endless-progression-owner-packet
baseCommit:   2b759f7
commits:      this handoff commit
suite:        584 tests; 583 pass, 0 fail, 1 expected raw-trace-archive skip
supersedes:   2026-09-03-0840--ep-d07-dropout-supplement-accepted
---
# Handoff — close this chat and begin EP-D02 variable Rule Capacity

## Resume in one sentence

Use `$ss2-progression-design` to replace, not rubber-stamp, EP-D02's pending
fixed-four proposal: first visualize every simultaneously legal rule-bearing
source, then guide the owner through a finite-saturation Rule Capacity earned
from qualifying Arena boss clears and replay the complete rule only after its
ownership and accounting are settled.

## Authority and current decision state

Only EP-D01 and EP-D07 are closed. EP-D02–EP-D06 and EP-A01–EP-A03 remain
pending, and implementation remains blocked. The authoritative status is in
[`endless-progression-decisions.md`](../design/endless-progression-decisions.md),
whose EP-D02 record says `pending`. The `accepted` text in the owner packet's
EP-D02 row is under **Prefilled product recommendations** / **Recommended owner
answer**; it is not a recorded owner disposition. Numerous fixed-four tables in
the system and readiness documents are likewise draft dependencies, not
accepted facts.

The completed decisions that constrain this frontier are:

- EP-D01: ordinary stat and chassis power ends at a finite, versioned ceiling
  aligned with the expected Emperor encounter. Ascendancy may provide a finite
  behaviour-led veteran edge under EP-D02's future shared active budget.
- EP-D01 currently permits one eligible Legendary, Trophy, Signature, or
  Keystone to be Ascended for a Circuit, with one Core Evolution and one learned
  Branch Evolution active. The configuration locks for that Circuit, with at
  most one narrow Pivot and full reattunement between Circuits.
- EP-D07: a persistent gladiator is mode-neutral across 1v1/2v2/3v3; the
  first playable version requires a distinct connected human in every allied
  seat and uses the accepted pause/reconnect/team-abandonment policy.

Do not reopen either closed decision casually. Where the discussion below
conflicts with accepted wording, expose the conflict and obtain a complete
explicit revision rather than editing around it.

## Owner-directed EP-D02 replacement, not yet closed

The owner rejected a permanently fixed cap of four and strongly selected this
direction during dialogue, but has not yet reviewed and accepted one complete
normative EP-D02 replay:

1. **Variable capacity.** Active Rule Capacity grows through the campaign. At
   maximum ordinary vertical power it becomes “no cap” in the practical sense
   that one gladiator can wear Legendary rules in every otherwise-legal item
   position and choose one of those Legendary items for Ascendancy.
2. **Finite saturation, not infinity.** This can coexist with EP-D01's ban on
   unbounded active-rule growth if the ceiling is the finite maximum cost of an
   otherwise-legal loadout. Slot occupancy, compatibility, family limits,
   strongest-only stacking, and other authored legality still apply.
3. **Boss-clear cadence.** Capacity should be tied closely to progression via
   Arena boss clears rather than character level, because gladiators may reach
   the Emperor at different levels and a boss-clear reward feels more
   meaningful. The owner mentioned 48 only as exploratory scale intuition; it
   is not an accepted cap or schedule.
4. **Natural equip refusal.** If a proposed item would put the gladiator over
   current capacity, the equip operation fails and the existing equipment stays
   intact. Do not auto-disable an item, ask which equipped item should become
   inert, or allow an illegal loadout and repair it later.
5. **Legendary ideal.** Legendary powers belong to the dropped item itself—no
   Diablo-IV-style extraction and reassignment. A perfect all-Legendary set may
   be the theoretical optimum, while situational matchups must leave mixed
   rarities viable and interesting. Legendaries must remain distinctive to the
   build and gladiator fantasy rather than homogenizing builds.

This direction likely requires replacing EP-D02's exact text and later revising
EP-D04's pending recommendation. EP-D04 currently proposes rejecting rarity
strict dominance, whereas the owner now permits a perfect Legendary set to be
the theoretical optimum while requiring mixed-rarity situational relevance.
It also supersedes the draft's separate **maximum-one 3-Load identity** rule;
an all-Legendary legal loadout is impossible while every Legendary is such an
identity and only one identity may be active. Do not preserve that limit merely
because it appears outside EP-D02's headline sentence.

## What “all slots” does and does not yet mean

The current system draft names this mapped active item surface:

| Surface | Currently named positions | Unresolved EP-D02 question |
| --- | --- | --- |
| Weapons | primary weapon, secondary weapon | Can both coexist and can every legal weapon position carry a Legendary rule? |
| Worn gear | breastplate, helmet, shinguard, greaves, shoulderguard, gauntlet, boot, shield | Which are simultaneous, mutually exclusive, or behaviour-bearing? |
| Carried items | six inventory/spell/Technique positions | Which carried item families may be Legendary? The draft's unchanged ordinary spell is a separate zero-Load case, not a zero-Load Legendary. |
| Draft non-item rules | Forms, one Signature designation, and one Keystone | Do these remain standalone Load sources, become item-contained behaviors, or leave the model? The owner did not approve another generic progression layer. |
| Team rule | one selected Team Tactic | Is its cost charged to every fighter's ordinary capacity, reserved separately, or expressed another way? |
| Ascendancy | one configured equipped Legendary | Does its Core plus Branch add Load, replace the item's base Load, or use a reserved Ascendancy allowance? |

That is ten named equipment references plus six carried references, but it is
**not evidence that all sixteen are simultaneous Legendary-bearing sources**.
Derive the legal slot grammar and maximum-source arithmetic before proposing a
number. “All item slots” also does not automatically answer whether any accepted
non-item ability belongs in the same budget. The current draft costs of 1/2/3,
its one-identity limit, and its one-point-per-fighter Team Tactic are unaccepted
assumptions and must not decide the result by inertia.

A useful first visualization for the owner should use symbolic capacity rather
than invented numbers:

| Campaign state | Earned capacity | Example legal result |
| --- | --- | --- |
| Early bosses | a few boss-granted units | One defining rule-bearing item; an over-cap replacement is refused. |
| Mid campaign | more first-clear units | Several complementary Legendary/lesser-rarity rules, still requiring tradeoffs. |
| Emperor-aligned ceiling | at least the computed maximum otherwise-legal item load, plus whatever accepted accounting Ascendancy and the Team Tactic require | Every legal gear position may be Legendary and one equipped Legendary may be Ascended; no slot or compatibility rule is bypassed. |

## Closely coupled design directions from this chat

These were enthusiastically selected in discussion but were not all replayed as
closed decision-record clauses. Preserve them as owner direction, not as
implementation-ready specifications.

### Legendary Ascendancy

- An Ascended item must be Legendary. The owner does not want a detached
  Legendary-power library applied to arbitrary hosts.
- A Legendary has an artifact-weapon-like tree. Over time the gladiator may
  permanently learn everything in that named item's tree, while mutually
  exclusive branch choices still create encounter/campaign dynamics. A final
  Awakened bonus rewards completion, and branches should be reactive to how the
  item is used rather than generic passive ranks.
- Ascendancy belongs to the gladiator by exact item identity/name: once that
  particular item lineage has been awakened and progressed, it is not rebuilt
  from scratch on every copy.
- Initial awakening should occur over one Circuit. Full development should be a
  much longer pursuit—roughly 15–25 successful Circuits was liked as a starting
  scale—with item-specific deeds rather than bland XP unlocking later nodes.
  Circuit length is itself pending, so this is a duration target, not a fixed
  node-per-Circuit formula.

There are two explicit conflicts to resolve with the owner:

1. Accepted EP-D01 clause 6 says Legendary, Trophy, Signature, **or Keystone**;
   the owner's earlier caveat says Ascended items can **only** be Legendary.
   Determine whether those other terms are Legendary item subtypes or revise
   the accepted clause explicitly.
2. The owner earlier liked changing item branches “per battle,” but accepted
   EP-D01 later locks the active configuration for the Circuit with at most one
   narrow Pivot. The accepted Circuit lock controls until explicitly revised;
   ask whether “per battle” was colloquial, superseded, or still desired.

### Team Tactics

- Use a **loan-only personal union**: the campaign's unlocked Tactics are
  available, and participating members temporarily contribute any additional
  personal Tactics to the team's selection pool. A guest's extra Tactic helps
  the current team but is not copied permanently into the campaign or another
  gladiator's library.
- Tactics should have both deterministic and random acquisition routes, with
  different Tactics sourced from vendors, bosses, rare drops, and other
  authored sources in the spirit of Project Ascension's source-varied Mystic
  Enchants.
- The chosen Team Tactic stays locked for the whole Circuit. Exact proposal,
  vote/tie, source-member departure, and capacity-charge rules remain to be
  specified.

### Bound Souls and adjacent systems

- Legendary behavior remains item-contained. Charms and Soul Relics may exist
  as distinct systems rather than extraction sockets masquerading as loot.
- Do not silently restore Forms, Signature designations, or Keystones as a
  generic gear-independent progression layer. The owner explicitly asked to
  dial that vocabulary back. If any survives, show concretely whether it is an
  item behavior, Charm, Soul Relic, Bound Soul rule, or genuinely separate
  system and obtain approval for that role.
- A Bound Soul is chosen at character creation as a core identity that softly
  guides gear and allocation across the game's eight stats. Souls need not use
  one template: some may redistribute stats, change resource exchanges, alter
  armor fundamentals, or transform another base rule.
- The owner wants a large and expandable Soul catalog. For now, allow one
  lifetime transformation; possible later rebinding is future design, not an
  initial promise.

### Combat and event philosophy to retain for later frontiers

- Prefer organic counters and readable diminishing returns to pervasive hard
  balancing caps. The selected control model was World-of-Warcraft-like
  per-target decay—illustratively 8, 4, 2, 1 seconds, then temporary immunity—
  with exact categories, reset window, PvE/PvP scope, and numbers still open.
- Revisit reward randomness in the loot section rather than prematurely
  settling it in the Circuit discussion.
- Single-fight offerings may present a choice among authored opponents with
  different difficulty, rarity/source identity, and commitment length.
  Tournament offerings may likewise present contender choices; whether each
  contender is one bout or later rounds grow longer remains part of EP-D03.
- The owner envisions an endgame menu that can eventually include single-match
  Circuits, one-bout deathmatch tournaments, and sparring tournaments whose
  bout count rises toward the championship. In a lethal tournament one death
  ends the tournament; normal save/reload semantics return the group to town,
  with the dead gladiator restored from the last save. These directions inform
  pending EP-D03 and do not yet define its normative Circuit unit.
- The installed licensed SWF remains the byte-identical measurement oracle. If
  an extended-arena mod proves useful, inspect it in a separate fingerprint
  lane. Start from the base campaign assumptions for now; a larger authored
  hybrid campaign remains an attractive later option if practical code access
  supports it.

## Recommended opening round for the next agent

Begin with a concrete item-paper-doll view, not another vocabulary layer. State
that variable capacity is compatible with the prior finite-power philosophy
when it saturates at a finite legal-loadout maximum. Then resolve, in order:

1. **Source inventory:** which of the ten named equipment references and six
   carried references can simultaneously hold behaviour-bearing Legendary
   rules; whether Forms, Signatures, or Keystones survive as standalone sources;
   and whether the Team Tactic/Ascendancy are inside the same arithmetic.
2. **Ownership:** recommend that Rule Capacity belongs to the persistent
   gladiator and is earned once from that gladiator's first qualifying boss
   clears. Joining a veteran campaign should not loan capacity, even though a
   teammate may loan a Tactic choice.
3. **Credit:** distinguish first clear from repeat clear, paid/full-rank from
   Recovery or Assistance, personal participation from campaign completion,
   and idempotent receipt from reload/duplicate credit.
4. **Accounting:** decide whether Ascendancy Core/Branch and the selected Team
   Tactic add ordinary Load, replace an already-paid item payload, or consume a
   visible reserved allowance.
5. **Cadence:** only after the maximum legal load is known, assign qualifying
   bosses and increments so the Emperor-aligned ceiling reaches saturation.
   Do not back-solve from the exploratory number 48.
6. **Downstream repair:** replace the pending EP-A03 Reconstruction Tray's
   hard-coded four-unit formula after EP-D02 settles; it currently derives its
   unit count from permanent capacity crossing exactly 1, 2, 3, and 4.

The first bounded owner question should therefore be whether the capacity is a
personal, once-per-qualifying-boss-clear property of the persistent gladiator
(recommended), rather than a campaign-wide unlock or a temporary party
projection. Follow the answer down one branch; do not present every unresolved
subsystem at once.

## Faults the eventual replay must close

- a high-capacity teammate carrying or projecting capacity onto a low-capacity
  gladiator;
- a guest bringing extra Tactics whose selected cost makes another member's
  otherwise legal loadout invalid;
- activation or reconfiguration of Ascendancy pushing a loadout over capacity;
- equipment changes that partially mutate state before over-cap rejection;
- repeat, assisted, Recovery, Concede, reload, or duplicated boss-clear receipts
  granting capacity twice or granting it to a nonparticipant;
- a design-version change in costs or slot grammar stranding a persisted
  loadout over cap without an explicit migration;
- a saturated all-Legendary set becoming generically best in every matchup and
  erasing the promised situational value of mixed rarity;
- the obsolete one-identity rule or EP-A03 four-unit formula surviving in a
  downstream validator after the headline cap changes;
- cross-format or low-tier farming that advances boss-clear capacity outside
  the intended campaign frontier.

## Repository boundary and verification state

This terminal handoff changes only `HANDOFF.md` and this dated document. It
does not change the decision record, owner packet, system proposal, readiness
ledger, code, tests, fixtures, candidates, observations, manifests, goldens,
saves, snapshots, launchers, captures, or either game installation. It does not
authorize implementation or a Ruffle run.

The completed handoff state was verified as:

```text
git diff --check: PASS
local Markdown paths: PASS (38 files)
node --test --test-concurrency=1:
  584 tests; 583 passed; 0 failed; 1 expected raw-trace-archive skip
```

No push is authorized; repository policy requires asking before every push.
