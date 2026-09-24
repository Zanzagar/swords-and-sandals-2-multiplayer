# Handoff — cut-atomic Soul Relic evaluation selected

**Session ID:** `d0d7e72b-503c-4588-85fb-90a5eb900a39`
**UTC:** 2026-09-24 06:40:52
**Branch:** `design/endless-progression-owner-packet`

Start with this handoff, `HANDOFF.md` above its archive line, and
`$ss2-progression-design`; present only `RCS-03C1` next.

## Owner answer recorded

The owner selected `RCS-03B1-A`: every Soul Relic evaluation is cut-atomic.
No authoritative evaluation exists before its decisive invocation cut or
persists across a later meaningful cut before provisional completion. Earlier
bounded `H` history may remain necessary evidence, but it is not a dormant
attempt. Whenever later cadence and authority choices permit invocation, one
co-temporal Relic-side tuple and the applicable contingent evidence produce a
provisional candidate or no candidate at that same cut.

`RCS-03B2`–`RCS-03B7` are therefore pruned. Pending initiation, Relic binding,
in-flight context-change disposition, participant cancellation, automatic
expiry/horizon, and concurrency have no pending evaluation on which to operate.
The owner selected none of those descendants in bulk. The authoritative
decision record remains unchanged, and no implementation is authorized.

## Register correction and next card

Re-deriving the next row found that old `RCS-03C` still combined three
independent player-material axes: evaluation-eligibility cadence, evaluator
invocation authority, and contingent `H`/`S` acquisition. The owner-visible
register now replaces that parent with `RCS-03C1`–`RCS-03C3`, growing from 31
to 33 counted slots. Selecting B1, pruning B2–B7, and adding the two net split
rows changes current `Phi_SR` from 28 to 23 (`28 - 7 + 2`).

The sole active row is `RCS-03C1`, cut-atomic evaluation-eligibility cadence.
It asks whether every maximal non-cadence-readiness episode is eligible at its
opening cut, every supported tag may instead have a real later authored gate,
or immediate-only and gate-capable tags coexist. Recommend A, immediate
eligibility, because it preserves B1-A's crisp causality and avoids rebuilding
a pseudo-pending “ready but not listenable” state under another name.

The card classifies each maximal readiness episode independently. An episode
whose opening cut is ineligible is scheduled-gated even if its facts later
disappear; if no later gate exists it is orphaned. Orphaned episodes count on
the gated side and cannot falsely prove an immediate-only tag, while every
valid gated-positive tag still needs a separate qualifying episode that
survives a meaningful decision or transition to a real gate. A read-only
adversarial audit passed this corrected empty/whole/proper-subset partition.
`RCS-03C2` invocation authority and `RCS-03C3` evidence acquisition remain
unselected and must not be bundled into C1.

## Validation

- Full suite: 584 tests, 583 passed, 0 failed, 1 skipped. The skip is the
  expected raw-trace archive check for this worktree profile.
- Structural audit: 20 `SC-*` cards with all seven required fields; 33 Relic
  register rows; `Phi_SR = 23`; exactly one `OWNER-OPEN` Relic row; 75 checked
  relative links and no missing target.
- `git diff --check` passed.
- `docs/design/endless-progression-decisions.md` remained byte-identical at
  SHA-256 `e7e5c0fb047e42e5852648972f7f57f5539708bf990d97fe597d000ad5ed5358`.
- No runtime, Ruffle, capture, installation, save, snapshot, fixture,
  candidate, observation, manifest, or golden work occurred.
