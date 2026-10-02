---
handoff:      2026-09-02-2355--ep-d01-accepted-next-ep-d02
written:      2026-09-02 23:55 -0400
sessionId:    01a063fa-2180-7500-b6ff-4e417d9f5f7d
agentRuns:    0 in the EP-D01 owner-decision phase; earlier research/audit runs are recorded in the superseded handoff
branch:       design/endless-progression-owner-packet
baseCommit:   c67c838
commits:      57d3961, plus this handoff commit
suite:        584 tests; 583 pass, 0 fail, 1 expected raw-trace-archive skip
supersedes:   2026-09-02-1745--codex-progression-workflow-adapted
---
# Handoff — EP-D01 accepted; begin EP-D02 with the full owner context

## Resume in one sentence

Read the accepted EP-D01 replacement in the
[authoritative decision record](../design/endless-progression-decisions.md#ep-d01--finite-campaign-vertical-power-and-continuing-pursuits),
then use `$ss2-progression-design` to expand **EP-D02 — the active Rule Load
budget and its interaction with Ascendancy** one decision at a time; do not
reopen EP-D01 or implement anything unless the owner explicitly asks.

## Durable state

The owner explicitly replied:

```text
EP-D01: accepted as replayed
```

The complete nine-clause wording was recorded as
`revise — accepted replacement`, owner `Zanzagar`, UTC date `2026-09-03`.
Commit `57d3961` updates the authoritative record, its derived summary, the
owner packet, readiness index, system-proposal precedence warning, historical
option matrix, and `HANDOFF.md` living state. Implementation remains blocked.

The accepted rule, in compact form, is:

- ordinary stat/item-chassis growth continues through the main campaign and
  ends at one finite, versioned campaign vertical ceiling aligned with the
  expected Emperor encounter; tier 50 is not a promise;
- defeating the Emperor unlocks postcampaign Arena Circuits and Arena Pursuits,
  while their underlying combat vocabulary should appear during campaign play
  wherever practical;
- post-ceiling career levels cannot create unbounded stats, chassis, active
  capacity, multipliers, or disguised scalar growth;
- Ascendancy may provide a small veteran combat edge, but simultaneously active
  Ascendancy power is finite and behaviour-led; EP-D02 owns its exact active
  budget;
- Arena Pursuits are the umbrella with three parallel lanes: Ascendancy,
  Frontier, and Legacy;
- one eligible Legendary, Trophy, Signature, or Keystone may be Ascended for a
  Circuit with one Core Evolution and one learned Branch Evolution; learned
  additional branches broaden permanent ownership without increasing active
  capacity;
- active configuration is Circuit-committed, with at most one narrow Pivot and
  full reattunement only between Circuits; exact timing belongs to EP-D03;
- standard late opponents use the same bounded raw-power grammar and never read
  the equipped player snapshot; rare disclosed exceptions require exploitable
  liabilities and proportionally better rewards; and
- one milestone may not complete every progression lane. At least one
  meaningful strategic, encounter, cosmetic, or system-access objective must
  remain visible; a bare level or Chronicle record is not enough.

Read the exact record rather than treating this summary as normative.

## Owner taste learned during EP-D01

The owner ranked late-career satisfactions in this order:

1. strategic expression;
2. conquering new kinds of encounters;
3. becoming numerically stronger;
4. prestige/history only when it unlocks cosmetics or interesting systems;
5. collecting more builds.

The owner likes a real campaign gear climb and rejects both an endless ordinary
stat treadmill and a Guild-Wars-2-like feeling that gear progression has simply
ended. A much older gladiator should have a small edge through interesting
systems, not merely a sword with a much larger damage number. The inspiration
was a late authored layer such as WoW Legion's Netherlight Crucible, but without
its item-local compound lottery, opaque binding, or infinite stacking.

Permanent character building matters. It should not create a reroll-regret
trap, but free opponent-by-opponent respec is also undesirable. Circuit
commitment, permanent learned breadth, one narrow Pivot, and between-Circuit
reattunement were accepted as the working middle. The owner explicitly noted
that this may need revision if it feels boring or constraining in play.

Late encounters should change dynamics rather than become chess-like perfect
information or pure stat checks. Rare higher-level/wild-Legendary combinations,
Deep-Rock-Galactic-like risk selection, and unusually strong rewards are
desired, provided exceptions are bounded and legible.

The cap should be tuned to the expected point where the Emperor dies, possibly
near 50 or 100 but not worshipping either number. Arena Circuits and the
postcampaign Pursuit layer are additions unlocked after the campaign; most
underlying combat mechanics should already have appeared during the vertical
campaign.

## Vocabulary now frozen for discussion

```text
Arena Pursuits (umbrella; choose one reward lane per combatant per Circuit)
├─ Ascendancy Pursuit — earn permanent Lineage Evolutions
├─ Frontier Pursuit — unlock unusual encounters and risk/reward routes
└─ Legacy Pursuit — unlock expression, history-dependent rewards, and systems

Combat preparation (related, but separate from reward-lane selection)
└─ Ascend one eligible power using learned Lineage Evolutions
```

Choosing Frontier or Legacy does not turn off an Ascended power. It changes
where the Circuit's progression reward goes. Stop using `Ascendancy` as the
name of the whole postcampaign umbrella; that naming collision caused owner
confusion. Use `Ascendancy` for the first Pursuit, `Ascend` as the loadout verb,
`Ascended` as the configured-power adjective, `Lineage` for the permanent path,
and `Evolution` for a learned Core or Branch.

## EP-D02 is the sole next owner frontier

The current pre-decision proposal caps the sum of active Rule Load at four per
combatant. Minor effects tentatively cost one, identities two, and a burdened
Trophy package may cost three. None of those numbers or costs is accepted.

EP-D02 must now determine, with a wide option/tradeoff matrix before exact
replay:

1. whether one global Rule Load budget remains the correct expression cap;
2. whether the proposed capacity of four creates enough expression without a
   universal best-stuff package;
3. how an Ascended Core plus Branch is charged against that budget—integrated,
   reserved, substitutive, or another bounded topology;
4. whether a separate Ascendancy allowance would become free vertical capacity
   and violate EP-D01;
5. which commitment, stacking, inactive-item, proc-chain, and team-combination
   constraints are part of the product decision versus later tuning; and
6. what a level-137-versus-newly-postcampaign small veteran edge actually means
   once both legal active builds are projected through the cap.

Probe at least these counterexamples: four one-point effects becoming the
universal answer; a three-point Trophy plus free Ascendancy eclipsing every
other package; inactive or carried items supplying unpriced stat sticks; one
effect triggering another recursively; multi-tag actions underpaying their
value; team-wide effects bypassing personal opportunity cost; and a mature
Lineage turning one nominal Ascended slot into several simultaneously active
branches.

Do not force the owner to select the whole list at once. Preserve the requested
cadence: expand one recommendation and its alternatives, tradeoffs,
progression implications, and philosophical/game-breaking consequences; discuss
until satisfied; then advance to the next dependent choice. Replay one complete
normative EP-D02 rule only when its full design-tree frontier is empty.

## Still open outside EP-D02

- EP-D03–EP-D06 remain pending.
- EP-A01 must be rewritten because its old formula hard-codes 50 and does not
  yet map Emperor completion, campaign ceiling, career pace, Frontier pace, and
  postcampaign Pursuit activation.
- EP-A02 and EP-A03 remain pending with the counterexamples in the prior
  handoff/readiness record.
- Exact ceiling, Ascendancy magnitude, Circuit length, Pivot timing, reward
  cadence, catalogs, economy, migrations, and balance remain `[U]`.
- No Endless implementation is authorized.

## Verification and Git state

After the EP-D01 reconciliation:

```text
local Markdown links: PASS
git diff --check: PASS
node --test --test-concurrency=1:
  584 tests; 583 passed; 0 failed; 1 expected raw-trace-archive skip
```

The branch was one commit ahead of
`github/design/endless-progression-owner-packet` after `57d3961` and will be two
commits ahead after this handoff commit. These changes have **not** been pushed.
Repository policy requires asking before any push; do not infer push authority
from the earlier matrix publication.

No subagent was used during the owner-decision/recording phase. Keep progression
design as the single owner-guided lane; independent review is for one named
claim or a later material diff, not for delegating owner choices.
