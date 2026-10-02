---
handoff:      2026-09-03-0840--ep-d07-dropout-supplement-accepted
written:      2026-09-03 08:40 -0400
sessionId:    01a0656b-002f-7323-81d6-92c48b2ce56f
agentRuns:    3 read-only adversarial/surface reviews; no subagent wrote files
branch:       design/endless-progression-owner-packet
baseCommit:   64d7098
commits:      0379c5d (corrected dropout reconciliation), plus this handoff commit
suite:        584 tests; 583 pass, 0 fail, 1 expected raw-trace-archive skip
supersedes:   2026-09-03-0756--ep-d07-accepted-mode-neutral-human-allies
---
# Handoff — EP-D07 corrected dropout supplement accepted

## Resume in one sentence

Preserve the corrected nine-clause EP-D07 dropout supplement in the
[authoritative decision record](../design/endless-progression-decisions.md#ep-d07--mode-neutral-gladiators-and-human-only-allied-mvp),
then use `$ss2-progression-design` to resume EP-D02 or another owner-selected
pending frontier; do not implement anything without separate authorization.

## Accepted owner rule

The owner chose an RTS-style dropout flow and explicitly replied `Accepted` to
the corrected complete replay:

1. Circuit entry freezes one visible versioned grace policy accepted by every
   member; it grants no control or custody.
2. A committed action finishes exactly once. A terminal action settles without
   a pause/timer; otherwise the battle checkpoints, pauses, and starts an
   independent timer for that absent member.
3. Reconnect restores only that member's original gladiator/seat, cancels their
   dropout state, and invalidates the old proposal. Combat resumes only when
   every required ally is connected.
4. Expiry never abandons, kills, advances combat, or invokes AI. It activates
   only that absent member's narrow entry-time consent to abandonment, and the
   team may keep waiting.
5. Every connected member must approve, and every absent member's timer must
   have expired. This leaves one decider in 2v2 after one expiry, two deciders
   in 3v3 after one expiry, and one decider in 3v3 after two expiries. Nobody
   online means no automatic receipt.
6. Any presence change invalidates a vote based on the old state. Reconnect and
   abandonment serialize so exactly one commits.
7. The existing atomic Concede receipt preserves committed progression and
   custody, forfeits only already-defined unearned Circuit outcomes and
   Contract completion, and causes no death.
8. Recovery remains the same precommitted recipe, roster, custody, and
   distinct-human admission. Dropout creates no reduced-party entry, proxy
   choice, or AI fill.
9. Only authenticated session-liveness detection may open a timer; a player
   cannot declare another dropped. Exact duration remains visible, versioned
   tuning.

The exact accepted wording is in the decision record rather than this summary.

## Withdrawn replay and correction

I first replayed eight clauses and the owner accepted them. Before commit, the
read-only adversarial check found that my unconditional “play resumes” was
false when one of two disconnected 3v3 members reconnects, and that “Recovery
remains available” was ambiguous about reduced-roster entry. I stopped,
withdrew that replay, gave the owner the corrected nine-clause wording, and
received a second explicit `Accepted`. The withdrawn replay was never committed
and is not authoritative. The decision record and `HANDOFF.md` state this at
the instruction rather than hiding the correction here.

## Repository and implementation boundary

- `[V]` The generic headless resolver can represent one-to-three seats per side,
  AI controllers, and controller reassignment. It has no session-presence or
  persistent cross-format campaign implementation.
- `[A]` The corrected supplement is accepted product policy for the first
  playable version. It is not vanilla evidence and does not authorize code.
- `[U]` Human transport topology, authenticated presence/heartbeat, reconnect
  tokens, exact grace duration and clock/downtime semantics, durable timer and
  proposal schema, and reconnect-versus-Concede serialization remain unbuilt
  readiness specifications.

EP-D06 remains pending. Nothing in the dropout supplement accepts its separate
proposal that the first playable proof be deterministic 2v2 under designed
rules.

## Reconciled files

- `docs/design/endless-progression-decisions.md`: corrected exact supplement,
  owner/date record, explicit withdrawn-replay correction, summary, failure
  cases, and gates.
- `docs/design/endless-progression-owner-packet.md`: derived closed-D07 summary
  and Cluster 3 consequences.
- `docs/design/endless-progression-system.md`: Circuit, Concede, shared
  authority, Recovery, persistence, test, dependency, and gate wording.
- `docs/design/endless-mvp-readiness.md`: governance risk, durable-envelope
  fields, S-07/S-08 protocol gates, edge-case matrix, and remaining `[U]`
  implementation inputs.
- `README.md`, `docs/roadmap.md`, and `docs/ss2-adapter-contract.md`: concise
  accepted-policy versus generic-capability/implementation boundary.
- `HANDOFF.md`: current living-head rule and explicit correction. It also now
  restores the literal `## THE ARCHIVE LINE` required by `AGENTS.md`, at the
  clear boundary immediately before the frozen 2026-08-30 session history.

The earlier dated handoff remains frozen and is superseded here. No source,
test, fixture, candidate, observation, manifest, golden, save, launcher,
installed-game, or capture file changed. No Ruffle run occurred.

## Verification and Git state

At the final reconciled docs state, including this handoff:

```text
git diff --check: PASS
local Markdown paths: PASS (37 files)
node --test --test-concurrency=1:
  584 tests; 583 passed; 0 failed; 1 expected raw-trace-archive skip
independent named-claim review: PASS
```

The reconciliation is committed as `0379c5d`; this dated handoff is its second
local commit. No push was attempted or authorized; repository policy requires
asking before every push.

## Remaining frontier

- EP-D02–EP-D06 and EP-A01–EP-A03 remain pending.
- The product dropout authority is closed, but its human-session implementation
  and the per-action animation acknowledgement remain playable blockers.
- All prior pacing, RNG/information, post-completion, combat-budget, Pressure,
  integer-encoding, persistence, and settlement gates remain open.
- Implementation remains blocked pending complete owner dispositions,
  specifications, review, and separate authorization.
