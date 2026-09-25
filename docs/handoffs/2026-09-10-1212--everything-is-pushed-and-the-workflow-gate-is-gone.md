---
handoff:      2026-09-10-1212--everything-is-pushed-and-the-workflow-gate-is-gone
written:      2026-09-10 12:12 -0400
sessionId:    ff2653b2-38d3-4789-a13e-a7a8a95247f9 (https://claude.ai/code/session_01TuosBS7QyYYRXsSMMVqB3D)
branch:       arena/champion-capture. **NOTHING IS UNPUSHED — for the first time
              in three sessions.** `github/arena/champion-capture` and `HEAD`
              are both `534fee6`. Two commits landed after the 12:42 handoff:
              `87598a9` and `534fee6`. **Verify, do not believe:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD`
suite:        816 / 815 / 0 / 1 (fresh-clone profile), measured after the last
              commit. **Re-measure; never copy this line.**
supersedes:   2026-09-07-1242--the-78-are-done-and-the-suite-does-not-bite. ITS
              RANKED LIST IS STILL THE WORK — nothing on it was started here.
              Read it after this one; this handoff only carries what changed.
---
# Handoff — everything is pushed, and the Workflow gate is gone

## The one-sentence version

No code changed: this stretch pushed nine backed-up commits, corrected the
previous handoff's own push count, and **removed the `Workflow` permission
gate — which moves an obligation from the harness onto you.**

## READ THIS FIRST: the gate that is gone changes what YOU must do

`.claude/settings.json` no longer lists `Workflow` in `permissions.ask`. The
owner dropped it 2026-09-09 after noticing he was still getting a yes/no dialog
per workflow while bypass permissions was on.

**A fan-out wave now starts with NO confirmation dialog.** What still binds:

- the **6-questions / 6-verifiers hard cap** inside
  `.claude/workflows/question-fanout-audit.js` — untouched, and it is the only
  deterministic guard;
- the **one-wave-at-a-time** rule in `AGENTS.md`.

**So: SAY WHAT A WAVE WILL SPAWN, IN THE TRANSCRIPT, BEFORE LAUNCHING IT.** That
is now the only place the owner sees the number, and it is on the session rather
than the harness. Authoring an inline workflow to get past the committed cap was
already a rule violation and now has no dialog behind it.

**`Bash(git push *)` STAYS in `ask`, and every `deny` rule is untouched** — `main`
and force-pushes stay blocked outright. That gate is about what leaves this
machine, not about cost, and it earns its keep: it is why nine abandoned commits
were noticed at all.

► **AND A CLAIM THIS PROJECT WAS RELYING ON IS UNTESTED.** `.claude/settings.json`
  asserted that *"bypass-permissions mode skips ASK rules by design"*, and the
  fan-out cost argument rested on it. The owner was prompted for these workflows
  **while bypass was active**, which contradicts it. It was never measured here.
  It is flagged in place as untested rather than deleted. **Measure it; do not
  cite it** — and note that if it is wrong, other reasoning in that file may lean
  on it too.

## The same defect, three sessions running, now with an arithmetic fix

The 12:42 handoff's frontmatter claimed FOUR new commits and SEVEN unpushed. The
truth was FIVE and EIGHT: **it was written before the commit that carries it and
did not count itself.**

That is the third instance of one defect. Two sessions before: a LATEST pointer
left unrepointed, three tests red. One session before: six line numbers
invalidated by the very insertion that wrote them. Care has failed three times,
so the fix is arithmetic, and it is recorded in the living head:

```
# AFTER committing a handoff, not before:
git fetch github && git log --oneline github/<branch>..HEAD | wc -l
```

Put THAT number in `HANDOFF.md`'s living head, where it can be corrected — never
only in the frozen handoff, where it cannot. **The frozen 12:42 file is
deliberately NOT edited** (`docs/handoffs/README.md`: never edit a handoff after
its session ends).

## Highest-value work, ranked — UNCHANGED, and it is all in the 12:42 handoff

Nothing below was started here. **Read
`docs/handoffs/2026-09-07-1242--the-78-are-done-and-the-suite-does-not-bite.md`
for the evidence behind each.**

1. **Refuse `settlement.arm()` on a battle with no result.** Re-derived by hand:
   it is currently ACCEPTED on a freshly constructed battle — `result: null`,
   zero events, everyone alive. Blast radius measured: one production caller
   (`src/team/resolver.js:312`) and two test callers. **NOT a one-liner** —
   `CampaignSettlement` holds no battle reference, so the fix is a small design
   choice. **Settlement sits INSIDE `combatStateHash`, so this is a protocol
   change: the `/codex:adversarial-review` case, and worth the owner's eye.**
2. **Give `src/team/controllers.js` its first negative tests.** Zero exist —
   `ControllerError` appears nowhere under `test/` — and three of its throws are
   confirmed mutation survivors. Cheapest survivor to close.
3. **Decide whether the WRITE allowlist grows to the armour piece ids.** Owner's.
4. **The `ss2-champion-dna.md` §7 ranged-primary capture question.** Owner's lane.
5. **A capture hook that can arm on a status phase.** Owner's, needs Windows.
6. The villain stamina 105-vs-110 schema question. Owner's.

**And what the completeness critic put ABOVE all of these**: the roadmap's own
not-started column still names the **RENDERED ARENA** — six-slot geometry is
derived and emitted as inert JSON and nothing draws it — and **CAPTURE BREADTH**,
at 37 of 60 candidates with no golden and the spell family never captured.
Neither is a balance decision, and both are more player-visible than anything
above.

## Hard rules (unchanged)

- **Derive candidates from the map, never from a capture.**
- **An agent FINDS; the main session RE-DERIVES.**
- **A wave's brief is a snapshot.** `534fee6` is the snapshot to brief against.
- **Ask before every push.** `main` stays denied outright. Nothing is waiting.
- **A handoff commit is not finished until `node --test --test-concurrency=1` is
  green, and its suite and push lines must be measured AFTER that commit.**
