---
handoff:      2026-09-16-2228--the-build-plays-seven-runs
written:      2026-09-16 22:28 -0400
sessionId:    cbee9926-159f-4edb-abcb-8d75f213b5de
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      `4d2ee1b..HEAD` — `67dfc01` (the seven runs), `8bc27c0` (the two
              Codex findings and this handoff), `db46bf2`-ish (the index row),
              plus this line's own. **Re-measure with `git log --oneline`.**
suite:        **Re-measure BY EXIT CODE after your own commit.** `fail == 0` and
              the exit code are the gate. Measured AFTER the last commit of this
              session: 1960 / fail 0 / skipped 1, exit 0, against 1936 at the
              start. (This line first said 1958, which was measured one commit
              too early — the index row and its test had not landed. The
              instruction above is the one that catches that, and it caught it.)
agentRuns:    `wf_a8359d3e-dbc` — 6 write-nothing verifiers, one named claim
              each. 6 briefs, 6 returned, 0 dead. Two of the six REFUTED.
              Plus one pinned Codex adversarial review (`gpt-6-astra`) on
              `67dfc01`: needs-attention, 2 findings, both confirmed and fixed.
supersedes:   2026-09-16-0500--psyche-up-is-built.md
next:         **RANKED BELOW. The stance at item 1 is what this session found
              and did not build.**
---
# Handoff — the build plays seven runs

## The one-sentence version

The 05:00 handoff ranked "animation sequences" third, as art completeness —
**it was a correctness gap in five dispatched animations**, because the premise
underneath it (*"this engine dispatches one animation per action and never a
sequence"*, in three handoffs and four source files) was true of the ENGINE and
had never once been checked against the BUILD.

## WHAT IS DONE

► **SEVEN OF EXPORT 1241's 101 LABELS RUN PAST THEIR OWN SPAN, and this engine
  was cutting five of them in half.** In AVM1 a `gotoAndPlay("x")` runs FORWARD
  until an action stops it; these carry no terminating action inside their own
  span:

```text
    initialize   1..1        -> 32    GotoLabel Standing      Standing
    Hurt8        1250..1265  -> 1283  Stop                    Hurt9
    celebrate1   1400..1408  -> 1426  GotoLabel celebrate1a   celebrate1a
    knockback    1428..1433  -> 1446  Stop                    knockback_mov
    psyche_up    1609..1617  -> 1626  Stop, struck = true     psyche_charging
    psyche_up2   1627..1635  -> 1643  Stop, struck = true     psyche_charging2
    burning      1947..1948  -> 1963  gotoAndPlay Standing    flame_repeat x2
```

  Direction 8 plays 34 frames where direction 9 plays 18; a knockback 19 and not
  13; a first charge 18 and a second 17; and **`burning` plays 32 where this
  engine played 2** — 6% of the build, invisible to every test because the
  pack's `burning` entry really is two poses long.

► **`src/render/clip-sequences.js` IS THE TABLE, `tools/clip-sequences.mjs`
  RE-DERIVES IT** from the oracle, read-only, and 21 new tests hold it.
  `animationFor` concatenates a run's poses with the effect-group indices
  REBASED; six authored beat counts lengthen the schedules. Mutation-checked
  four ways: drop the rebase -> 3 fail, never sequence -> 6, drop the beats ->
  2, count a child-clip `gotoAndPlay` as a terminator -> 1.

► **THE DISCRIMINATOR THIS PROJECT HAD BEEN USING WAS WRONG.** "No `StartSound`
  binding" is true of 21 of the 101 labels and of only four continuations, while
  `hurt8`, `knockback` and `celebrate1` are silent ENTRY points whose sound
  fires on the continuation. **That also answers a puzzle the living head
  recorded twice: `hurt8` is not "the one silent hurt", it is half a
  performance.** Contiguity was no better — 1609-1656 is one unbroken run of
  five labels and the stops are what divide it into three.

► **`supersededBySibling: ["knockback"]` WAS BACKWARDS.** `damagecharacter`
  dispatches `"knockback"` (`+0x1b4f`, `+0x1bc0`); the 13-frame `knockback_mov`
  is its continuation. This engine had been drawing the second half of a
  knockback and never the first.

► **AND SOUND NOW FOLLOWS THE RUN.** A Codex review caught the knockback
  correction turning knockbacks SILENT — the new entry carries no binding, so
  `chooseSound`'s exact-label branch answered null. Re-deriving it found **the
  same hole already open on `hurt8`** and nobody had heard it. An unbound entry
  now looks along its own run and stops there; it still may not borrow from a
  family sibling, which is the rule that assertion separates.

## What broke, and who broke it

**Two of six verifiers refuted, and one Codex review returned needs-attention
with two findings. Every one was re-derived here before anything was touched.**

► **"CLIP LABELS ARE STRICTLY DOWNSTREAM OF `toTeamWireState`" IS FALSE, and it
  was my safety argument.** The resolver puts `vanillaLabel` and `clip` ON
  events, `toTeamWireState` clones `battle.events` wholesale, and **19 of 23
  goldens and 61 of 69 observations state `combatwon`/`combat_won` as expected
  values**. A verifier moved 3 of 5 literal hash pins by renaming one. The
  conclusion survives for a different reason — this diff is `src/render/`, and
  `src/golden/*` imports neither `src/render` nor `src/adapter` — but **the
  wrong reason would have licensed a resolver-side rename.**

► **MY BRIEF SAID EIGHT RUN-ONS AND THERE ARE SEVEN.** `flame_repeat`'s frame
  1963 is a TOTAL if/else and both arms jump, so nothing falls through to
  `lifesteal`. The committed tool already said seven; only the brief was wrong.

► **"NOTHING DISPATCHES `knockback_mov`" WAS TOO STRONG** — one site, `+0x7c5e`,
  behind `cast_spell_icon(attacker, 39, 2)`. Said while correcting a claim that
  was also too strong, which is the pattern to watch.

► **A PUSHED DOUBLE HAS ITS TWO 32-BIT WORDS SWAPPED** and the new decoder read
  them straight. An argc of 1 became a denormal and a plain
  `this.gotoAndPlay("Standing")` came back as `goto:computed`. The fighter clip
  pushes argcs as int32, so the table was right anyway — **which is exactly how
  a decoder bug survives a result that reproduces.** `tools/inspect-swf.mjs` has
  always reordered them.

► **`burning`'s `frames: 32` IS THE ONE NUMBER THE TOOL DOES NOT PROVE.** The
  repeat count of 2 is read by hand from `burncycle = 1` against `>= 2`. It
  carries `derivedBy: "hand"` at the field now and the tool prints `[REPEATS]`
  on any run whose counter it cannot evaluate.

## Highest-value work, ranked

1. **THE CHARGED STANCE — found this session, deliberately not built, and the
   best thing on this list.** `changeCombatants` poses BOTH fighters from the
   counter at the top of every turn: `+0x281e`
   `if (game_attacker.psyche_up == 2) attacker.gotoAndStop("psyche_charging")`,
   `+0x284d` the same at 3 for `psyche_charging2`, and `+0x287c` / `+0x28ab` for
   the defender. **A gladiator holding a charge STANDS in the charged pose
   instead of `Standing`** — the visible form of the resource, and the counter
   values line up exactly (2 after one press, 3 after two). A stance is a
   persistent pose BETWEEN actions and a run is one performance WITHIN one, so
   it is a different mechanism and its own piece of work: the presentation
   stream has no way to say "hold this pose until further notice".

2. **RE-SHOOT THE PROBES UNDER ADOBE'S PLAYER IF YOU EVER HAVE ONE — the
   owner's, untouched.**

3. **THE PSYCHE CAPTURE, still blocked on the ROUTE and not the window.** See
   `4d2ee1b`: the prisoner route needs a level-1 hero this save no longer has,
   and the arena route fits the gladiator but drives its fights from
   `-ArenaPolicy` with no `-Autopilot`. **Making it psyche is capture-
   infrastructure design**, on the one script that mutates the save.
   ► **AND THIS SESSION ADDS A SECOND THING THAT CAPTURE WOULD SETTLE**: the
     build's report-back (`this.struck = true`) fires at 1626 and 1643 — the END
     of the run — so a charge reports 18 frames in and not 9. That is the timing
     the `+0x6761` counter increment waits on.

4. **MID-RUN SOUND TIMING.** The build starts `hurt9`'s sound 17 frames into a
   34-frame hurt and `knockback_mov`'s 7 into a 19-frame knockback. This engine
   returns ONE file per action and the shell plays it at the start. The
   vocabulary has nowhere to put an offset; giving it one is a change to the
   command stream, not to the sound policy.

5. **`taunt` IS THE LAST DEFERRED VANILLA ACTION**, and its stated reason has
   not gone stale: the candidate implements only the post-`checkattackroll` arm,
   so it would consume the wrong number of samples.

6. **DECIDE WHICH RASTERISER THIS PROJECT MEASURES IN.** Every committed number
   is `cpu`; a player runs neither configuration; the gap is 15.9% of the frame.

## Hard rules

- **ASK THE BYTES WHERE PLAYBACK STOPS, NOT THE LABEL LIST.** A `FrameLabel`
  says where a clip begins and nothing about where it ends. Seven of 101 end
  somewhere else, and the pack cannot tell you which.
- **RESOLVING THE RECEIVER IS THE LOAD-BEARING STEP IN ANY AVM1 SWEEP.** Almost
  every animation frame opens with `head.eyes.gotoAndPlay(...)`. Count those and
  every label's run ends at its own first frame.
- **A PREMISE ABOUT THE ENGINE IS NOT A PREMISE ABOUT THE BUILD**, and this one
  sat in four source files for two days wearing the second sentence's clothes.
- **A RIGHT ANSWER FROM A WRONG REASON IS A LIABILITY**, because the reason is
  what the next person generalises. The blast-radius argument is the example.
- **A TOOL THAT REPRODUCES THE EXPECTED ANSWER CAN STILL BE WRONG** — the double
  decoder was, and the fighter clip's own encoding hid it.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES CHROME OR RUFFLE, TOUCHES THE INSTALLATION, OR REGENERATES
  `assets/`.** Verifiers this session read a scratchpad COPY of the oracle whose
  sha256 was checked against the corpus first; that is the pattern to reuse.
- **Ship no SS2 asset.**
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
