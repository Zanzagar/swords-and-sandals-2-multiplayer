# Handoff — one anchor class rotates; choose its identity

**Session ID:** `01a074ac-c9e7-7303-8538-c8e392199ac2`
**UTC:** 2026-09-15 03:57:33
**Branch:** `design/endless-progression-owner-packet`

Resume with only EP-D02-C3c.61, the identity of C3c.60-B's sole anchor class
that admits equal-count singleton-label rotation under Bound-Soul substitution.
The owner selected C3c.60-B. Preserve the accepted EP-D02 wording until a
complete replacement is replayed and explicitly accepted. Do not implement.

## Selected direction

For `t` in `{one,multi}`, retain

`V^I_{t,S,v}={b in R_{t,v} : some s_1,s_2 have I_v(b,s_1) != I_v(b,s_2)}`

and

`K^I_{S,v}={t in {one,multi} : V^I_{t,S,v} is nonempty}`.

C3c.60-B fixes `|K^I_{S,v}|=1`. Exactly one of the already-nonempty one-anchor
and multi-anchor classes has at least one exact realization whose singleton-
label set changes across supported Souls. Every exact key in the other class
keeps its complete set. C3c.59-A makes every change an equal-count exchange;
it is not more anchors, routes, tools, ease, or power.

C60-B did not choose the class identity or within-class prevalence. The latter
is not delegated: after identity, ask whether the selected class's already-
nonempty variable set is proper or full.

## Binary frontier

There are exactly two legitimate C3c.61 directions because the singleton
subsets of `{one,multi}` are `{multi}` and `{one}`. A false third direction
would duplicate one, contradict C60-B by choosing neither or both, defer the
decision, or introduce another axis. An owner-written replacement remains
available; selecting neither or both explicitly reopens C60.

- **A, recommended — multi-anchor only:** `K^I_{S,v}={multi}`. At least one
  multi-anchor exact key exchanges equal-count singleton labels, while every
  one-anchor key retains the same sole singleton label under every Soul. This
  preserves the fragile one-anchor class as a stable structural reference and
  puts qualitative Soul texture where several anchors provide redundancy. Its
  cost is greater mapping/validation complexity and forced total-degree slack;
  an obscure one-label exchange can still satisfy it without being fun.
- **B — one-anchor only:** `K^I_{S,v}={one}`. At least one one-anchor exact key
  swaps its sole singleton label, while every multi-anchor key retains its full
  exact set. This can create a bold focal identity change and need not add any
  degree-above-two key. Its cost is that the more coupled class loses its only
  stable independently attributable reference across Souls, so an undisclosed
  change can feel broken or inconsistent.

For A, multi-anchor Ashen may keep
`C={H/action,H/build,S/build,X/action,X/build}`. Firebound may have
`I={H/action,S/build,X/build}` and Stonebound
`I={H/build,X/action,X/build}`: both count three. One-anchor Dreamglass keeps
`C={S/action,X/action}` and sole `I={S/action}` under both Souls. This two-key
catalog covers all six singleton labels, retains both classes, provides the
exact-two fiber and coupled-only edges, and satisfies C51–C60.

For B, Ashen may instead have common
`C=I={H/action,H/build,S/build,X/action,X/build}`. Dreamglass keeps common
`C={S/action,X/action}` but Firebound has sole `I={S/action}` and Stonebound
sole `I={X/action}`. This also covers all six labels and varies only the one-
anchor class.

Under A, a variable multi-anchor key of common count `k` requires
`d_v(b)>=k+1>=3`; every Soul row in its fiber has at least one coupled-only
cell. Together with the inherited exact-degree-two fiber, A forces total-degree
nonregularity and a maximum of at least three. The degree-two fiber may still
be one-anchor or stable multi-anchor. No global package-width cap follows.

Under B, no new degree result follows. A three-key all-degree-two catalog can
use a variable one-anchor `{H/action,H/build}` key and stable multi-anchor keys
`{S/action,S/build}` and `{X/action,X/build}`, with `C=I` on the latter two.
Thus B does not force degree nonregularity or a maximum above two.

Both directions retain the inherited lower bound of two exact keys and four
pair rows when there are two supported Souls. Proper-subset prevalence later
would require two keys in the variable class plus one in the stable class, but
C61 does not choose prevalence.

Proof for A requires one fully classified variable multi-anchor key and exact
set equality for every one-anchor key. Proof for B requires one variable one-
anchor key with two proven sole labels and exact set equality for every multi-
anchor key. A variable cell requires both a positive singleton witness under
one Soul and complete exclusion under another; failed search is unresolved.

Neither direction selects exact labels, multi-anchor overlap, common Soul-to-
label behavior, definition/instance/state/boundary ownership, predicates,
packages, contexts, receipts, routes, disclosure, player control, ease,
frequency, power, payoff, live rebinding, acquisition, persistence, release,
or implementation.

## Preserved state

The owner packet, living head, rigor audit, SVG, and this handoff record
C3c.60-B and identify C3c.61 as the sole active owner choice, with A recommended.
The authoritative decision record and normative system design remain unchanged.
EP-D01, EP-D02, and EP-D07 remain accepted; EP-D04 directions remain
unaccepted, R9.4 remains reopened, R10.1-A and R10.2-A remain selected, and
R10.3–R10.8 remain pending.

No code tests were run because this was documentation and vector work only. No
runtime, capture, evidence, installation, save, or snapshot was touched.
Preserve the user's existing change to
`.agents/skills/ss2-progression-design/SKILL.md`.
