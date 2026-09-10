---
handoff:      2026-09-10-1323--the-arena-is-drawn
written:      2026-09-10 13:23 -0400
sessionId:    fc951c81-1664-40c7-87e0-d831f9da52d3 (https://claude.ai/code/session_01DrgzfST4gjHMv6qg7vYokm)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit** — this file cannot state it correctly,
              which is the whole point of the arithmetic fix recorded in the
              living head:
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
suite:        866 / 865 / 0 / 1 (fresh-clone profile) at the end of the session.
              It read 850 / 849 / 0 / 1 when this brief was first written; the
              controllers tests below landed afterwards, in the same session.
              **Re-measure; never copy this line.**
supersedes:   2026-09-10-1212--everything-is-pushed-and-the-workflow-gate-is-gone.
              Its ranked list is UNCHANGED and untouched — nothing on it was
              started here. What WAS done is the thing its completeness critic
              ranked ABOVE the whole list.
---
# Handoff — the arena is drawn

## The one-sentence version

The **RENDERED ARENA** landed — `src/render/` plus `tools/arena/`, a browser
surface that draws the presentation command stream in original vector art — and
building it corrected a clip label the battle map names, broke a `MAP_SILENCE`
entry that was simply false, and closed a distribution gate nothing was
enforcing.

## Why this and not the ranked list

The 12:12 brief's ranked list is all owner-lane or protocol-change work
(`settlement.arm()` is item 1 and is a `combatStateHash` change). Its
completeness critic put two things ABOVE that list: the **rendered arena** and
**capture breadth**. Capture breadth needs Windows and Ruffle, so it is the
owner's serial lane. The arena needed neither, and it was more player-visible
than anything on the list. It also closed a gap with a known shape:

**`presentArenaConstruction`, `presentResolvedEvents` and
`createPresentationBinder` had NO caller outside `test/`.** That is exactly the
state the campaign record was in before 2026-09-07, and reading that record back
is what found the defects in its format. Same again here.

## READ THIS FIRST: a shipped clip label disagreed with the map

`hurtLabel` emitted `hurt21`/`hurt22`/`hurt23` for the ranged band and marked
them `assumed`, because `MAP_SILENCE.ranged-hurt-label-adjustment` said the map
gave the phrase *"adjusted for ranged directions"* **"without giving the
adjustment"**. The map gives it one sentence later, with byte offsets:

```
docs/integration/ss2-battle-map.md:1471-1472
  "hurt" + attack_direction            (+0x2086)
  rewritten to "hurt" + (direction-20) for 21-23  (+0x2093-+0x20d6)
```

So direction 21 plays `hurt1`, and the map NAMES it. **Three artefacts agreed
with each other and none agreed with the map**: the silence entry, the code that
followed it, and `test/ss2-adapter.test.js`, which asserted the wrong value. That
is why the suite was green while the adapter dispatched a label the build has no
frame for. Fixed in `74b376a`; the silence entry is REMOVED and its constant's
header now says why an entry there is a checkable claim about the map.

**The lesson, and it generalises:** declaring the map silent is the cheapest way
in this repository to turn a measurement into a guess. Check the surrounding
paragraph, not the sentence you are quoting.

## And two comments told a host something false

`presentation.js` and `action-gate.js` both said the per-action boundary is
"never derived from the wire". **Not projected and not derivable are different
claims, and only the first is true.** The boundary is identically
`toTeamWireState(battle).events.length + 1` taken BEFORE `applyAction`, because
`addEvent` is the sole appender to `battle.events` and stamps dense sequences.
Measured: 0 mismatches over 193 actions at 1v1/2v2/3v3. The real reason it is not
projected is HASH STABILITY. What genuinely is impossible is recovering
boundaries retrospectively from a finished log. Both directions are now pinned.

Also pinned: **a rule set that legally emits no events** — which
`action-gate.js`'s own header concedes is legal — gives two consecutive actions
the SAME boundary, and the second `binder.drain` throws inside the host's action
loop. `ss2TeamRules` never does it, so nothing here hits it today.

## What the arena is, and what it is the first of

- `src/render/` is **pure and entirely under the suite**: commands → scene,
  combatant → figure, figure + pose → draw operations, label → keyframes, and a
  cursor that decides which animation tokens are finished. `tools/arena/` is the
  thin shell — canvas, DOM, `requestAnimationFrame` — and nothing else.
- The browser imports `src/adapter/` and `src/team/` **directly as ES modules**
  over `node tools/arena-server.mjs`. No bundler, no build step, no second copy
  of the engine to drift. `package.json` still declares no dependencies.
- **It is the first host anywhere here to set `awaitAnimations: true`**, so the
  per-action gate ENFORCES for the first time. Every other caller is headless
  and correctly leaves it advisory, which is why that path had no exercise.
- Consequently it is the first thing to decide **part 4 of the acknowledgement
  seam** — when to stop waiting for an animation. `src/adapter/action-gate.js`
  deliberately refuses to own that, and was right to; it needed a surface.

Run it: `node tools/arena-server.mjs`, then <http://127.0.0.1:8123/>.
`?teams=1|2|3`, `?seed=N`, `?spectate=1` to watch a bout play itself.

## Three things that only building it could find

1. **The authored ally band draws in FRONT of figures standing NEARER it.**
   Allies sit at a smaller `y` (further back) and a higher `depth` (drawn in
   front), which inverts vanilla's own shadow-behind-fighter convention.
   **Pinned, not corrected** — the renderer honours the depth the command
   carries, because that is the contract. Deciding which of the two is wrong is
   a real question and it is open.
2. **A token whose action starts no timeline could never be reported**, hanging
   the gate for ever. Found only by moving the decision out of a
   `requestAnimationFrame` callback the suite could not reach into
   `src/render/cursor.js`, where a fake clock now drives whole bouts.
3. **Nothing enforced "ship no SS2 asset".** No test enumerated tracked files;
   `.gitignore` has no rule for any image, audio, font or SWF extension. It had
   never been live because no directory here would plausibly want a binary next
   to the code — one would now. `test/no-shipped-assets.test.js` closes it, with
   an allowance list that is EMPTY and a test that fails if an allowance goes
   stale.

## What I did NOT verify, and you should not assume

**The canvas is verified only from static screenshots** — 1v1, 2v2 and 3v3, plus
the enforcing gate visibly disabling input mid-animation. I could not watch a
bout animate end to end in a browser: **headless Chrome gives a
`requestAnimationFrame` loop exactly 2 frames whatever `--virtual-time-budget`
says** (measured: 2 frames at both 2s and 20s), and no browser is installed in
WSL. I briefly read that as a stall in the page; **it was not**, and the
correction matters because the page logic is fine. The loop is proven instead on
a fake clock, through the real cursor, for whole bouts at all three team sizes.

If you have a browser, open it and watch one. That is the one check nobody here
has run.

## Highest-value work, ranked

1. **The 12:12 brief's ranked list is untouched and still the work** — read it.
   `settlement.arm()` on a battle with no result is still item 1, still a
   `combatStateHash` protocol change, and still the `/codex:adversarial-review`
   case.
2. **Decide the ally depth-vs-y inversion** (finding 1 above). It is a small,
   self-contained authored-geometry decision, and it is now visible rather than
   theoretical.
3. **CAPTURE BREADTH** — still 37 of 60 candidates with no golden and the spell
   family never captured. Owner's lane; needs Windows.
4. ~~**Give `src/team/controllers.js` its first negative tests.**~~ **DONE, later
   in this same session** — `test/team-controllers.test.js`, 16 tests. The
   audit's finding was exactly right and was re-derived before it was believed:
   with each of the three mutations applied one at a time the whole suite still
   reported 849 pass / 0 fail. All three now fail, **all nine throws in the
   module are covered**, and each refusal asserts the error TYPE *and* matches
   its MESSAGE — the audit's point was that the message text appeared nowhere
   either. Four further mutants invented while checking the work also die.
   `src/team/controllers.js` itself is UNCHANGED: this is a tests-only commit.
5. **Animation polish and sound.** The figures read well and the timings are
   authored; nothing about them is measured and nothing needs to be.

## Hard rules (unchanged)

- **Derive candidates from the map, never from a capture.** This session is a
  worked example: the label was corrected from the map's byte offsets.
- **An agent FINDS; the main session RE-DERIVES.** Every finding above came from
  a 6-question / 6-verifier wave (VERIFIED: 6 briefed, 6 returned, 0 dead) and
  every one was re-measured here before it was believed.
- **A wave's brief is a snapshot.** Commit or stash before launching one.
- **Say what a wave will spawn BEFORE launching it** — the dialog is gone.
- **Ask before every push.** `main` stays denied outright.
- **A handoff commit is not finished until `node --test --test-concurrency=1` is
  green, and its suite and push lines must be measured AFTER that commit.**
