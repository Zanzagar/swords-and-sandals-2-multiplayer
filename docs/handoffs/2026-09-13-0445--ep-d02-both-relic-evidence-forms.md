# Handoff — both independent Relic evidence forms selected

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-13 04:45:19
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.35, per-position independent evidence composition.
The owner selected C3c.34-C: the completed basis-sensitive Soul Relic catalog
must materially support both independently isolatable combat-history and
current-state evidence. Preserve the accepted EP-D02 wording until a complete
replacement is replayed and explicitly accepted. Do not implement.

## Selected direction

The completed catalog must contain at least one reachable, materially
functional, bearer-compliant final entry with a valid `I_H` witness and at least
one with a valid `I_S` witness. `I_H` means the position's satisfaction changes
when a nonempty set of materially read occurrence-history coordinates may vary
while its read current-state facts and all selected outside inputs remain fixed;
`I_S` is symmetric. One position can supply both catalog forms only through two
distinct projection-isolation pairs.

C3c.33-A still requires every position in `P+` to have at least one such
independent path. C3c.34-C does not decide whether any position supports one or
both forms, how types group inside entries or Relics, how they map to the
already-required pure-action and pure-build classes, whether additional coupled
boundaries are permitted, or what the canonical atoms and double-count rules
are. This is a direction, not a complete accepted EP-D02 replacement, and
changes no authoritative wording.

## Sole active choice

C3c.35 classifies each final effective `p` in `P+` as:

- `T_H`: `I_H=true`, `I_S=false`, independently history-only;
- `T_S`: `I_H=false`, `I_S=true`, independently state-only; or
- `T_D`: `I_H=true`, `I_S=true`, independently dual-sensitive.

C3c.33-A excludes a resolved `(false,false)` position. A false component needs
a complete reachable-domain invariance proof; incomplete analysis remains
unresolved and satisfies no option. The classification ignores any additional
coupled boundary still left open.

- **A, recommended — independently single-form positions only:** `T_D` is
  empty. C3c.34-C then forces distinct, materially functional `T_H` and `T_S`
  witness positions somewhere in the catalog. This preserves catalog-wide
  history/state variety while making each counted position in `P+` independently
  explainable in one evidence language. It excludes a position with two
  separately manipulable evidence levers and may require more catalog surface.
- **B — independently dual-sensitive positions only:** `T_D=P+`. Every position
  needs separate `I_H` and `I_S` isolation pairs. This maximizes per-position
  expression but doubles its causal explanation/test surface and raises
  double-count pressure. Because pure-action and pure-build entries are already
  required, both forms necessarily occur in every such entry under B; the
  evidence-form grouping branch collapses.
- **C — mixed dual- and single-form positions:** `T_D` is a nonempty proper
  subset of `P+`. At least one dual and one distinct nondual position must be
  materially realized. C3c.34-C can be satisfied by the dual position alone, so
  the next dependent choice would ask whether the nondual complement contains
  only `T_H`, only `T_S`, or both before entry grouping.

A/B/C exhaust zero, all, or a nonempty proper subset of `P+` being independently
dual-sensitive. Dual sensitivity means two real isolation witnesses; it does
not select AND, OR, precedence, simultaneous satisfaction, a shared baseline,
canonical atoms, or permission for one occurrence to fill two positions.

Exact history/state subtypes, evaluation boundary, arity, relationship
operators, source families/atoms, atom position-distinctness and reuse, entry or
Relic grouping except B's derived collapse, extra coupled-boundary policy,
payoffs, UI, compatibility, configuration horizon, persistence/migration,
validation, and release remain open.

## Verification and preserved state

Two independent read-only exact-card audits pass after repairing three wording
defects: B's forced history/state support in both pure-action and pure-build
classes is now disclosed consistently; all recommendation prose is explicitly
limited to `P+`; and atomization, position-distinctness, and reuse are correctly
named as separate later double-count controls. The owner packet, living head,
rigor audit, SVG, and this handoff agree that C3c.34-C is selected and C3c.35 is
the sole active choice.

`git diff --check` and SVG XML validation pass. The authoritative decision
record and normative system design remain unchanged. EP-D01, EP-D02, and EP-D07
remain accepted; EP-D04 directions remain unaccepted, R9.4 remains reopened,
R10.1-A and R10.2-A remain selected, and R10.3-R10.8 remain pending. No code
tests were run because this is documentation and vector work only. No runtime,
capture, evidence, installation, save, or snapshot was touched.
