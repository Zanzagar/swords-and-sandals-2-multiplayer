---
handoff:      2026-09-28-0607--relic-empty-settlement-cause-next
written:      2026-09-28 06:07 +0000
sessionStart: 2026-09-05 23:04 -0400
sessionId:    01a074ac-c9e7-7303-8538-c8e392199ac2
agentRuns:    two read-only D1Z frontier/atomicity/gameplay audits plus one final diff verifier
branch:       design/endless-progression-owner-packet
commits:      56e90a6..HEAD
suite:        proportional serial checks 10/10 passed; register reparses 141/141 with Phi_SR 31; decision-record hash unchanged
supersedes:   2026-09-28-0556--relic-provisional-sealing-cause-next
---

# Handoff — actual ledger-bearing empty-settlement cause is next

Start with `HANDOFF.md` above its archive line and
`$ss2-progression-design`. Present D1Z only. Treat Z as the one actual atomic
ledger-bearing `{}` settlement commit, not the earlier false bit, each absent
receipt, or the later recurrence-latch write.

## Where things stand

Zanzagar selected `RCS-03D1K-A`. A complete positive provisional output still
becomes sealed and unrevocable, but K never itself proposes persistent
transformation. D1K is `DIR-SELECTED`; D1K1 is `PRUNED`; D1Z is the sole
`OWNER-OPEN` row. The authoritative decision record remains unchanged.

The 141-row register contains 30 `SCREEN`, 1 `OWNER-OPEN`, 39 `PRUNED`, 64
`DIR-SELECTED`, 5 `DERIVED`, 1 `SPEC`, and 1 `EVALUATE`; `Phi_SR = 31`. Eight
cause parent/child slots remain from Z through M. Closing them returns D2 at
23; D2-D5 then lead to RCS-03E at 19.

The audit caught one notation error in the prior round. D4 already owns
`kappa(z)` as its canonical cancellation-pair recurrence key. Current live
wording uses `seal_K(z)` for the D1K sealing occurrence. The frozen prior
handoff still contains the superseded notation; do not propagate it. No
semantics or counts changed.

The final verifier caught one living-head wording overreach: an ordinary Relic
under D1Z-C undergoes the same cancellation **without a Z proposal**, not
necessarily “without transforming,” because a later independent cause may
still propose change. That verifier also self-reported creating and immediately
removing one `/tmp` scratch file despite its write-nothing brief; no repository
file or Git state changed.

## Present exactly this next

One D1Z witness has a selected complete two-contender ledger tuple, actual
false/not-both bit, fixed cancellation disposition, and one authoritative `{}`
commit. Its prospectively versioned direct Z edge proposes a materially
distinct same-dialect assignment. Delete only that edge while holding the
tuple/pair, false bit, `{}`, preserved proof, later L latch, any L proposal,
completed trace, and current assignment fixed; only the Z proposal disappears.
Z cannot inspect later latch/break/renewal/approval/collision facts or alter
settlement, claim, or recurrence.

Selected E1-C guarantees cancellation somewhere, not on every transforming
definition. D2-A keeps evidence unclaimed. D4-A later writes one-listen-per-
unbroken-bond state. One empty set is one Z event; vanished tags, ledgers,
proof children, participants, callbacks, replay, and imagined missing receipts
cannot multiply it.

- **A — cancellation settles absence but never transforms.** `D_Z=emptyset`.
  `{}` keeps every no-receipt/no-claim/latch consequence but creates no
  biography proposal. This is the strong production fallback: D1P-B already
  supplies every Relic a positive cause path, and A minimizes failure farming,
  ally coercion, explanation, and Z/L collision. Cost: actual manifested
  absence cannot itself shape a Relic.
- **B — every transforming Relic has a cancellation-shaped path.**
  `D_Z=D_mut`. Every transforming definition must have at least one reachable
  two-contender deny/cancel route whose actual `{}` directly proposes change.
  This is stronger than E1-C and forces both positive and empty biography paths
  across the catalog, pressuring singleton, steadfast-allow, and positive-
  denial identities while universalizing deliberate failure as progression.
- **C — a disclosed proper subset is Absence-bound. Conditionally recommended,
  with A as fallback.** `D_Z` is nonempty proper. A named `ABSENCE-BOUND`,
  Hollow Witness, or Mourning family may be shaped by actual `{}` while
  ordinary Relics are not. Z is final, visible, and costly—no receipt plus a
  latched pair—so knowingly accepting severance can create real policy rather
  than an internal timing trigger. Two truthful distinct relationships can
  fail to co-manifest while their relation-through-absence shapes the
  continuing Relic.

C reopens with A if it becomes failure insurance, a premium extra-evolution
caste, cheap ally-steered progression, dominant break/rebuild farming, or
cannot be taught in one sentence. Matched tests must retain optimized reasons
both to seek and avoid Z after all costs and alternatives are counted.

Concrete witness: proven P/Q receives false under Severed Chorus and commits
`{}`. Under A, proof stays lit and L later writes `LISTENED—SEVERED`, but Z
proposes nothing. Under C, an Absence-bound Relic may create `MOURNING
PROPOSED`; deleting the Z edge leaves `{}`, proof, and L unchanged.

Ask only for A, B, or C. Under A/B, D1Z1 prunes and D1L opens. Under C, D1Z1
opens first.

## Hard rules

- A letter selects worksheet direction only; leave the authoritative record
  unchanged until complete replay and explicit acceptance.
- Do not split Z by vanished tag, proof form, deterministic/Oracle law, stance,
  context, pair, proof child, callback, rendering, or replay.
- Keep VF, Z, and L distinct: refusal bit, actual empty settlement, persistent
  no-reattempt latch.
- C inherits E1-C's last-informed-commitment and anti-cheap-coercion gates; A
  is its explicit fallback if the loss-shaped policy is not genuinely fun.
- Exact trigger/target catalogs, rates, power, UI, persistence, approval,
  collision, and implementation remain later work.
- Do not touch the oracle install, captures, fixtures, observations, manifests,
  goldens, saves, or snapshots.
- Before ending, reparse the register, preserve the decision-record hash, run
  proportional serial tests, commit atomically with the Codex co-author trailer,
  push only the feature branch, verify clean synchronization, and do not merge
  PR #3.
