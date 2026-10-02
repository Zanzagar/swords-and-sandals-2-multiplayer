# Handoff — in-combat Relic source evidence selected

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-13 04:12:10
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.33, combat-evidence attribution topology. The owner
selected C3c.32-B: every counted position in a basis-sensitive Relic entry
requires contingent post-entry combat-produced semantic evidence. Preserve the
accepted EP-D02 wording until a complete replacement is replayed and explicitly
accepted. Do not implement.

## Selected direction

Every position in `P+` requires at least one material semantic fact causally
produced or changed by contingent legal post-entry combat history. Frozen legal
configuration, unavoidable deterministic initialization, and delayed copies,
timestamps, wrappers, sequence numbers, or hashes of either never suffice.
Configuration may remain a legality condition or retained build provenance.

A reachable, materially functional, bearer-compliant witness must contain two
legal histories with identical frozen configuration and initialization but a
different required combat-produced fact and different source-position
satisfaction solely at that evidence gate. This direction does not choose
occurrence versus state evidence, source families, atoms, phase, timing, arity,
operators, reuse, or payoff and changes no authoritative wording.

## Sole active choice

C3c.33 resolves a prerequisite exposed by the event/state distinction. Let `H`
mean bounded within-battle occurrence history—what happened or changed—and `S`
mean current canonical battle state—what is true, available, or legal at the
later evaluation boundary. Meaning and reachable behavior control the class,
not storage: a cached “event happened” bit remains `H`, while an event wrapper
copying present state remains `S`.

A position is independently attributable if at least one reachable pass/fail
pair varies a read `H` fact while its read `S` facts remain fixed, or varies a
read `S` fact while its read `H` facts remain fixed. It is coupled-only when it
passes C3c.32-B but complete analysis proves that every material witness changes
read `H` and `S` facts together. An incomplete search is unresolved, never
proof of coupling. Any valid isolation makes the position independently
attributable even if other witnesses are coupled.

- **A, recommended — independently attributable positions only:** every `P+`
  position has at least one isolatable causal path; none may rest solely on an
  inseparable event/state package. This gives every source a player-facing,
  regression-testable reason, at the cost of excluding some fused-moment
  designs unless a later boundary makes one meaning independently real.
- **B — coupled-only positions only:** every `P+` position reads inseparable
  `H`+`S` evidence. Joint pass/fail behavior is testable, but attribution,
  tooltips, replay diagnosis, and resolver evolution become opaque and fragile.
- **C — mixed portfolio:** at least one independently attributable position and
  at least one coupled-only position are materially functional. This admits
  bespoke fused moments but creates two explanation and validation standards.

B necessarily selects inseparable `H`+`S` use for every position and C for a
nonempty proper subset; those are disclosed meanings, not deferred choices. A
selects neither evidence form. Under A, and for C's independently attributable
subset, later cards decide history-only, state-only, or independently dual-
sensitive support and composition. Additional coupled boundaries inside an
otherwise independently attributable position also remain later; A forbids
coupling only as the position's sole attribution path.

The options exhaust zero, all, or a nonempty proper subset of `P+` being
coupled-only. The bearer-source minimum, real bearer-plus-ally cooperative
witness, pure-action/pure-build catalog support, and no-effect-chain rule remain
unchanged. Basis-neutral positions, exact event/state forms, phases, fields,
evaluation/sampling boundary, windows, families, atoms, provenance, dormant
visibility, arity, roles, operators, reuse, Team Tactic/environment admission,
payoff, UI, compatibility, horizons, persistence, validation, and release
remain open.

## Verification and preserved state

Two read-only audits first rejected a naive event-versus-state card because a
single transition can both emit an occurrence and change state. A second draft
then made coupled-only admission explicit; exact-card review caught and repaired
two hidden claims: failed search is not proof of invariance, and B/C necessarily
select inseparable `H`+`S` use for all/some positions. Both final repair audits
pass. The owner packet, living head, rigor audit, and SVG now agree on C3c.32-B
and C3c.33 as the sole active choice.

`git diff --check` and SVG XML validation pass. The authoritative decision
record and normative system design remain unchanged. EP-D01, EP-D02, and EP-D07
remain accepted; EP-D04 directions remain unaccepted, R9.4 remains reopened,
R10.1-A and R10.2-A remain selected, and R10.3-R10.8 remain pending. No code
tests were run because this is documentation and vector work only. No runtime,
capture, evidence, installation, save, or snapshot was touched.
