---
handoff:      2026-09-03-0756--ep-d07-accepted-mode-neutral-human-allies
written:      2026-09-03 07:56 -0400
sessionId:    01a0656b-002f-7323-81d6-92c48b2ce56f
agentRuns:    3 read-only fact/impact reviewers; no subagent wrote files
branch:       design/endless-progression-owner-packet
baseCommit:   fb86426
commits:      975ac6d (EP-D07 reconciliation), plus this handoff commit
suite:        584 tests; 583 pass, 0 fail, 1 expected raw-trace-archive skip
supersedes:   2026-09-02-2355--ep-d01-accepted-next-ep-d02
---
# Handoff — EP-D07 accepted: mode-neutral gladiators, human-only allied MVP

## Resume in one sentence

Read accepted EP-D07 in the
[authoritative decision record](../design/endless-progression-decisions.md#ep-d07--mode-neutral-gladiators-and-human-only-allied-mvp),
preserve its human-session blockers and no-allied-AI boundary, then use
`$ss2-progression-design` to resume EP-D02 or another owner-selected pending
frontier; do not implement anything without separate authorization.

## Accepted owner rule

The owner reviewed the complete four-clause replay and explicitly replied
`Accepted`:

1. A persistent gladiator is mode-neutral and may enter 1v1, 2v2, or 3v3.
   Format/roster size and participating roster are chosen per Circuit and stay
   locked until it ends. Moving formats never resets Bound Soul, levels, stats,
   equipment, Legendary Lineages, or the personal Tactic library.
2. Every allied seat in the first playable version requires a distinct
   connected human. Opponents may be AI; allied AI fill, one-human multi-seat
   control, and automatic AI takeover are excluded.
3. A disconnect lets an already-committed action finish exactly once, then
   pauses at the next action boundary. Reconnect restores the same gladiator and
   state; otherwise only the established team-abandonment protocol may end the
   suspended attempt. AI never assumes control.
4. Hot-seat parties, solo multi-gladiator control, AI companions, and opt-in AI
   takeover are possible future designs, not promised features.

The record labels this EP-D07 rather than closing EP-D06. The accepted replay
did not include D06's separate proposed choice—deterministic 2v2 under a
separate designed rule set—so D06 remains pending. This avoids turning context
into an approval the owner was never asked to give.

## Repository boundary re-derived

- `[V]` The shared headless resolver accepts one-to-three seats per side,
  separates combatant/controller identity, supports AI on either side, and has
  tests for mixed and all-AI battles. No permanent character-format field
  exists.
- `[U]` Persistent cross-format campaign progression, a genuine multi-human
  playable session, disconnect recognition, durable pause/reconnect, live
  multi-slot rendering, and a real SS2/Endless AI policy are not implemented.
  The shipped non-test policy is explicitly placeholder.
- Generic AI fill and controller reassignment remain engine capabilities for
  opponent AI and possible future variants. The first-playable admission layer
  must reject those mappings on allied seats rather than deleting the generic
  APIs.

Targeted read-only verification by the three reviewers re-derived these facts
from `src/team/`, `src/adapter/`, campaign persistence, tests, and maintained
design documents. No reviewer launched Ruffle, touched the installation/save,
or wrote files.

## Important readiness consequence

The old proposal deferred network transport while using rewardless allied AI
fill or AI finish as continuity. EP-D07 removes that shortcut. A first playable
team proof now needs:

- a genuine two-human topology if pending D06's 2v2 proposal is later accepted;
- sealed member/controller-to-seat admission with no duplicate authority;
- per-action animation acknowledgement;
- a durable nonterminal pause after the last committed action;
- authenticated restoration of the same authority, seat, and exact state; and
- a liveness-safe use of the established unanimous abandonment receipt.

That last item remains unresolved. The current shared-decision protocol records
disconnect/timeout as “no,” while ordinary Concede was previously legal only
between attempts. The system now identifies a suspended-attempt exception but
does not invent how the absent authority can participate. AI, host fiat, and
silent controller substitution are not permitted repairs.

If the already-committed action is terminal, no next action boundary exists;
its ordinary terminal presentation acknowledgement and exactly-once settlement
finish rather than creating a suspended nonterminal attempt.

## Reconciled files

- `docs/design/endless-progression-decisions.md`: authoritative EP-D07 wording,
  evidence boundary, alternatives, failure modes, gates, disposition, and
  seven-decision summary/checklist.
- `docs/design/endless-progression-owner-packet.md`: closed D07 summary and
  Cluster 3/durable-replay consequences.
- `docs/design/endless-progression-system.md`: accepted overlay, mode-neutral
  identity rule, Circuit admission/lock/pause semantics, removal of MVP AI
  fill/finish and multi-seat assumptions, and revised MVP/dependency sequence.
- `docs/design/endless-mvp-readiness.md`: `2 of 7 closed`, cross-format and
  human-authority rejection gates, plus S-08 for admission/suspension/reconnect.
- `README.md`, `docs/roadmap.md`, and `docs/ss2-adapter-contract.md`: capability
  versus product-policy distinction and minimum human-session sequencing. The
  adapter contract also corrects its stale claim that core roster fill was
  limited to one template per team; the remaining workaround is host-side.
- `HANDOFF.md`: living-head status and next-session pointer.

No source, test, fixture, observation, manifest, golden, candidate, save,
launcher, or installed-game file changed. No implementation is authorized.

## Verification and Git state

At the final reconciled docs state, including this handoff:

```text
git diff --check: PASS
local Markdown paths: PASS (36 files)
node --test --test-concurrency=1:
  584 tests; 583 passed; 0 failed; 1 expected raw-trace-archive skip
```

Run both again after any further edit. The EP-D07 reconciliation is committed
as `975ac6d`; this dated handoff is its second local commit. No push was
attempted or authorized. Repository policy requires asking before every push.

## Remaining owner/readiness frontier

- EP-D02–EP-D06 remain pending. EP-D07 is closed and should not be reopened
  without a complete replacement replay.
- EP-A01–EP-A03 remain pending.
- Human-session topology and abandonment liveness are newly explicit `[U]`
  blockers; they do not prevent owner discussion, but they prevent calling a
  build playable.
- All pre-existing rule-contract, RNG, pacing, post-completion, combat-budget,
  Pressure, integer-encoding, persistence, settlement, and animation gates
  remain open.
- Implementation remains blocked pending complete owner dispositions,
  specifications, review, and separate authorization.
