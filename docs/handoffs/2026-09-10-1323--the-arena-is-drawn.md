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

## The owner watched it, and it found a bug in under a minute

► **THIS SECTION'S HEADING USED TO BE A WARNING AND IS NOW A RESULT.** It said
  the canvas was verified only from static screenshots and that "nobody has yet
  watched a bout animate end to end". The owner did, the same afternoon, and
  **the one check nobody had run found the biggest defect of the session** —
  which is the argument for running it, not a footnote to it.

He reported three things. All three were real:

1. **"There are amber lines."** Every self-targeted action fell through to the
   attack branch, so `attackLabel(NaN)` handed the actor **`Standing` — THE
   IDLE CLIP** — and `hurtLabel(NaN)` handed it a target label with nowhere to
   play. A resting gladiator stood still; so did a burning one. Swept
   headlessly afterwards: **4,326 unmapped commands over 360 bouts, in exactly
   three causes (`rest` 2,929, `burning-phase` 824, `poisoned-phase` 573) — and
   4,326 `actor:Standing` clip-gotos, the same number.** The amber line named
   the label that could NOT play and hid the one that wrongly DID. Fixed from
   the map in `c6fe43b`; the sweep now reports zero.
2. **"The figures move, but they don't walk."** They cannot, and the reason is
   deeper than the renderer — see ranked item 2 below.
3. **"It says waiting for the arena on the side."** True for almost a whole
   spectated bout, because the spectator takes its turn the instant the gate
   opens, so the only state a person ever saw was the waiting one and it read
   as a stall. It was not. The heading now says what it is doing.

**THE METHOD MATTERS MORE THAN THE BUG.** The fix was not found by watching more
bouts, and would not have been: **the sidebar's content is COMPUTABLE.** Those
amber lines are derived from presentation commands, and presentation commands
run under `node --test` perfectly well. One headless sweep — three team sizes,
forty seeds, three enchantment loadouts — enumerated every cause in about a
minute, deterministically, which no amount of watching could match. That sweep
is now a test, so a log a person had to read is a guard that runs on every
commit. **When a surface tells you something, ask whether what it is telling you
can be computed. Here it always could.**

## What is still NOT verified, and you should not assume

**No agent here can watch the arena animate**, and that has not changed:
**headless Chrome gives a `requestAnimationFrame` loop exactly 2 frames whatever
`--virtual-time-budget` says** (measured: 2 frames at both 2s and 20s), and no
browser is installed in WSL. A session can render static frames and can compute
everything the surface would log, but it cannot watch motion. **The owner can,
and doing so paid immediately** — so ask him to look rather than concluding the
arena is fine because the sweep is green.

Still unproven by anyone: that the ANIMATION READS WELL. Zero unmapped commands
says every action can be drawn; it says nothing about whether a swing looks like
a swing. The timings are authored and nothing measures them.

## Highest-value work, ranked

**Re-ranked at the end of the session, and item 1 is NEW.** The original list
here ranked only the 12:12 brief's items plus the controllers work, which left
the largest non-owner item on the board mentioned nowhere — it surfaced while
closing item 5 below and had no home. That is how a next session picks the wrong
thing, so it is ranked rather than left as an aside.

1. ~~**CLOSE THE MUTATION AUDIT'S FINDING 2.**~~ **DONE, later in this same
   session** (`983fa7d`, `test/seeded-play-pins.test.js`). Re-derived first: the
   suite held **exactly one** literal `combatStateHash` pin and its own comment
   said "Deliberately a battle with no action applied"; the other 57 uses are
   relative. Four literal pins now cover what it structurally cannot reach — a
   battle six actions in, a settled 1v1, a settled 3v3, and the first eight
   seeded draws with labels, bounds and values — plus the determinism claim
   `src/team/rng.js` makes in its docstring and nothing asserted. **Measured
   against the audit's own survivors:** `rngCursor: 0` and `turnCursor: 0` both
   SURVIVE the old pin and now fail; `elimination.js:44` still survives and
   always will, because `teamStanding.down` has no consumer — a pin cannot cover
   dead code, and that one closes by deletion or by giving it a consumer.
   `src/` unchanged; these are REGRESSION pins, never goldens, in their own file
   away from `test/fixtures/`.
   *(The original text of this item, for the next reader:)* **the pinned literal
   hashes were all taken on battles with NO action applied.** `docs/mutation-audit-2026-09-07.md`
   states it: cursor 0, turnCursor 0, result null, events []. So they pin field
   PRESENCE and any value that varies at construction, and pin **nothing** whose
   value is `0`/`null`/`[]` before the first action. **Most of the 29 remaining
   survivors exploit that asymmetry**, and every other hash assertion in the
   suite is RELATIVE (rebuilt vs live, forced vs baseline), so it moves with the
   mutation on both sides and cannot catch a change to a derivation both sides
   share. The audit names the cheap guard: one pinned seeded draw sequence, or a
   hash after N seeded actions, checked against a literal.
   **This is the biggest thing here that is not the owner's lane, and it is
   code-and-test work that needs no capture, no Windows and no Ruffle.**
   *(Re-derive the survivor list before acting on it: the audit's own header
   says 29 of the 37 were never individually verified, because the verifier
   budget was 8 and a capped wave is complete-as-run, never complete-as-asked.)*
2. **THE RESOLVER MODELS NO POSITION, so nothing can walk.** A combatant
   projection carries stats, loadout, health, status and resources and **no
   `x`** — so `place-clip` is emitted only during arena construction and
   nothing ever moves a clip again. Vanilla does move gladiators: the map's
   `nextphase` clamps the active x to `[-2100, 2100]`, and `slot-layout.js`
   ships that clamp as `ARENA_X_CLAMP` while nothing produces a value to clamp.
   The renderer now lunges — a step in and out within a slot, which is
   presentation — but approach, retreat and knockback distance are all
   unmodelled. **Closing it means putting position in the resolver, which puts
   it inside `combatStateHash`, which makes it a PROTOCOL change**: the same
   class as ranked item 3 below, and worth the same `/codex:adversarial-review`
   treatment. It is the largest gap between this engine and the game it is
   derived from that is not a capture question.
3. **The 12:12 brief's ranked list is untouched and still the work** — read it.
   `settlement.arm()` on a battle with no result is still its item 1, still a
   `combatStateHash` protocol change, and still the `/codex:adversarial-review`
   case.
4. **Decide the ally depth-vs-y inversion** (finding 1 above). It is a small,
   self-contained authored-geometry decision, and it is now visible rather than
   theoretical. **Owner's call 2026-09-10: leave it pinned, decide later.**
5. **CAPTURE BREADTH** — still 37 of 60 candidates with no golden and the spell
   family never captured. Owner's lane; needs Windows.
6. ~~**Give `src/team/controllers.js` its first negative tests.**~~ **DONE, later
   in this same session** — `test/team-controllers.test.js`, 16 tests. The
   audit's finding was exactly right and was re-derived before it was believed:
   with each of the three mutations applied one at a time the whole suite still
   reported 849 pass / 0 fail. All three now fail, **all nine throws in the
   module are covered**, and each refusal asserts the error TYPE *and* matches
   its MESSAGE — the audit's point was that the message text appeared nowhere
   either. Four further mutants invented while checking the work also die.
   `src/team/controllers.js` itself is UNCHANGED: this is a tests-only commit.
7. **Animation polish and sound.** The timings are authored; nothing about them
   is measured and nothing needs to be. *(This item used to assert "the figures
   read well", which nobody had checked and which contradicts this brief's own
   unverified section two headings up. Whether a swing looks like a swing is
   still unproven — zero unmapped commands means every action CAN be drawn, not
   that it looks right.)*

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
