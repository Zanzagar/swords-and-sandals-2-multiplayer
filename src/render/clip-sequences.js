/**
 * WHAT THE BUILD PLAYS WHEN YOU ENTER AT A LABEL — which is not always the
 * clip that carries the label's name.
 *
 * `clip-labels.js` answers "which of the build's labels may this family play".
 * That is a NAMING question. This module answers a different one: **once the
 * build has entered at a label, where does playback stop?** In AVM1 a
 * `gotoAndPlay("x")` runs FORWARD from `x`'s frame until an action stops it or
 * jumps away, so a label whose span ends with no terminating action simply runs
 * on into the next one. Six of the fighter clip's labels do exactly that, and
 * this engine had been cutting all of them off at the first label boundary.
 *
 * ## The derivation, and how to redo it
 *
 * Read from the measurement oracle itself — export 1241, the fighter clip
 * (`hero_battle`) — sha256
 * `77cb545c2061ab41246251467a4edf5926ab6fd1ddd95dc9527d7ba9c45bb8ca`, by
 * walking that sprite's tags and recording every `FrameLabel` and every
 * `DoAction` against the `ShowFrame` count. `tools/clip-sequences.mjs`
 * reproduces the table; it is read-only and prints the frame numbers below.
 *
 * A label's run ENDS at the first frame at or after it carrying any of:
 *
 * - `Stop` — 86 of the clip's frames have one;
 * - `GotoLabel(<self>) | Play` — a SELF-LOOP, which ends the linear run just as
 *   firmly. **`Standing`, `StepBack`, `StepForward`, `BlockForward`, `RunBack`,
 *   `RunForward` and `celebrate1a` are of this kind** — seven, and a first pass
 *   at this table counted them as running on, which would have concatenated
 *   `Standing` with three gaits and a charge;
 * - a `this.gotoAndPlay(...)` CALLMETHOD, including one inside a conditional.
 *   **`flame_repeat`'s frame 1963 is exactly that**, and missing it is what made
 *   the same first pass believe a burning gladiator plays the lifesteal
 *   animation.
 *
 * ► **RESOLVING THE RECEIVER IS THE LOAD-BEARING STEP, and it is what the first
 *   run of the tool got wrong.** Every animation frame here opens by driving
 *   the face — `head.eyes.gotoAndPlay("blink")` on 1609 and 1627,
 *   `head.eyes.gotoAndPlay("Angry")` and `head.mouth.gotoAndPlay("Scared")` on
 *   1644 — which is the same opcode and the same method name on a child clip.
 *   Count those and every label's run ends at its own first frame: the tool
 *   reported 1 run-on where there are 7.
 *
 * ## The seven, with the build's own frame numbers
 *
 * ```text
 *   entry        span        runs to   ending                  runs on into
 *   initialize   1..1        32        GotoLabel Standing      Standing
 *   Hurt8        1250..1265  1283      Stop                    Hurt9
 *   celebrate1   1400..1408  1426      GotoLabel celebrate1a   celebrate1a
 *   knockback    1428..1433  1446      Stop                    knockback_mov
 *   psyche_up    1609..1617  1626      Stop, struck = true     psyche_charging
 *   psyche_up2   1627..1635  1643      Stop, struck = true     psyche_charging2
 *   burning      1947..1948  1963      gotoAndPlay Standing    flame_repeat x2
 * ```
 *
 * `initialize` is listed for the reconciliation and is NOT in the table below:
 * it is frame 1 of the clip, it is structural, and nothing dispatches it.
 *
 * ► **THE SWF SPELLS THE HURTS WITH A CAPITAL H** — `Hurt8`, `Hurt9` — while
 *   `defender_hurt` assembles a lower-case `"hurt" + attack_direction`. AVM1
 *   frame-label lookup is case-insensitive, so the build reaches `Hurt8` with
 *   `"hurt8"`; the extractor lower-cases, so the pack and this table are
 *   lower-case too. **Grepping the oracle for `hurt8` finds nothing**, which is
 *   worth knowing before concluding the label does not exist.
 *
 * ► **`Hurt8` IS THE ONE ENTRY THAT MAY BE AN AUTHORING SLIP RATHER THAN A
 *   DESIGN.** Every one of the thirteen hurt labels is preceded by a `Stop` on
 *   the immediately preceding frame EXCEPT `Hurt9` — so the missing stop at
 *   1265 is a one-off break in an otherwise perfect pattern, where the other
 *   six run-ons are all label PAIRS with an entry stub and a body. It does not
 *   change what to build: the build plays 34 frames for direction 8 whether the
 *   author meant it or not, and this engine's job is to play what the build
 *   plays. It changes what to say about it.
 *
 * ## `struck` IS SET AT THE END OF THE RUN, NOT AT THE END OF THE NAMED CLIP
 *
 * The stop at 1626 carries `this.struck = true`, and so do 1643, 1656 and
 * 1963 — the exit arm of the burn cycle. (Frame 1608, which ends `snipe`, sets
 * `this.fired = false` instead, so the idiom is per-purpose and not generic.)
 * That is the same `attacker.struck` the battle map cites for the `psyche_up`
 * counter's second write (`+0x6761`, "when the animation reports back"). **So
 * the build's report-back for a charge fires after `psyche_charging` has
 * played, not after `psyche_up` has**, and a burn reports back after its SECOND
 * pass through `flame_repeat`. Both are facts about WHEN, and this engine's
 * action gate is the thing that would consume them.
 *
 * ## What this corrects, out loud
 *
 * ► **"NO `StartSound` MEANS CONTINUATION" WAS THE WRONG DISCRIMINATOR** and it
 *   is how this repository reasoned about the psyche clips for three handoffs.
 *   Measured: 21 of the pack's 101 labels carry no `StartSound` binding, and
 *   only FOUR of those are continuations. The other seventeen — `block`,
 *   `blockforward`, `standing`, `roll`, `defend20`, `taunted`, `cast1`,
 *   `cast2`, `yield1`, `yield2`, `fumble1`, `colossus`, `portrait`,
 *   `initialize`, `celebrate1`, `knockback`, `hurt8` — are silent for their own
 *   reasons, which is the distinction `clip-labels.js` already drew for
 *   `block`. **And the last three of them are silent ENTRY POINTS**: `hurt8`
 *   and `knockback` carry no sound because the sound fires on their
 *   CONTINUATION (`hurt9` -> `1183.mp3` at frame 1266, `knockback_mov` ->
 *   `1104.mp3` at frame 1440). That is a better answer to "why is `hurt8` the
 *   one silent hurt" than the one this repository recorded, and it was
 *   available from the same bytes.
 *
 * ► **CONTIGUITY IS NOT THE DISCRIMINATOR EITHER.** Frames 1609-1656 are one
 *   unbroken run of five labels; the stops are what divide them into three
 *   performances. A tween can cross a boundary the playhead never does.
 *
 * ## A CONTINUATION IS NOT AN UNREACHABLE LABEL, and four of the six are not
 *
 * A first version of this module said continuations are "reached only by
 * running into them". **An adversarial verifier broke it on `psyche_charging`
 * and the break is worth more than the claim was.** Re-derived here afterwards:
 *
 * - **`psyche_charging` and `psyche_charging2` ARE DISPATCHED — with
 *   `gotoAndStop`, as a HELD STANCE.** Four sites in `changeCombatants`, at
 *   `+0x281e`, `+0x284d`, `+0x287c` and `+0x28ab`:
 *   `if (game_attacker.psyche_up == 2) attacker.gotoAndStop("psyche_charging")`,
 *   the same at 3 for `psyche_charging2`, and both again for the defender. So
 *   frames 1618 and 1636 are re-applied to BOTH fighters at the top of every
 *   turn for as long as a charge is banked: **a gladiator who has psyched up
 *   STANDS in the charged pose instead of `Standing`.** The counter values line
 *   up exactly — after one press the counter is 2 and after two it is 3 — so
 *   the stance is the visible form of the resource. **This engine has no such
 *   concept and does not build one here; it is named in the handoff as its own
 *   piece of work**, because a stance is a persistent pose between actions and
 *   a run is one performance within one.
 * - **`knockback_mov` is dispatched exactly once**, at `+0x7c5e` in
 *   `attacker.onEnterFrame`, right after ~~`cast_spell_icon(attacker, 39, 2)`~~
 *   **`cast_spell_icon(attacker, 39)`** *(corrected 2026-09-22 by a
 *   write-nothing verifier re-reading `+0x7c46`-`+0x7c5c`: the 2 is the
 *   argument COUNT pushed for `CallFunction`)* — a SPELL path, the
 *   `cast_command` arm, that this engine has no verb for. `damagecharacter`'s
 *   own two sites (`+0x1b4f`, `+0x1bc0`) name `"knockback"`.
 * - **`hurt9` is dispatched in its own right**, by direction 9.
 *
 * Only `celebrate1a` and `flame_repeat` are reached by running in and nothing
 * else. The word this module needs is RUN MEMBER, not "unreachable".
 */

export class ClipSequenceError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * ENTRY LABEL -> the build's own run, in play order.
 *
 * `plays` is the label sequence a `gotoAndPlay(<entry>)` actually performs, so
 * the entry is always its own first element. A label repeated in `plays` is
 * repeated by the build: `burning` loops `flame_repeat` on a counter, and the
 * counter's two values are unrolled here because this engine has no loop
 * construct and a table that hid the repeat would understate the burn by half.
 *
 * `frames` is the build's frame count for the whole run and `entryFrames` for
 * the entry clip alone. Neither DRAWS anything — the pack's poses do.
 *
 * ## `beats`: an AUTHORED duration, one per entry, and why it is not a formula
 *
 * A continuation doubles the art a schedule has to show. Left at the family's
 * old duration it plays at twice the speed, so the duration has to grow — and
 * the first version of this file grew it by a RATIO, `frames / entryFrames`,
 * applied uniformly. **That was a false generalisation and the table's own
 * numbers refute it**: only the `psyche` family's beats were ever chosen
 * against a clip length (its comment in `timeline.js` says so outright — "the
 * pack's own length for `psyche_up3`"). `hurt`'s 5 beats cover thirteen clips
 * of 16 to 18 frames, and `condition:burning`'s 7 were authored against a
 * gesture and not against the pack at all. Scaling `burning` by its ratio gives
 * 112 beats — thirteen seconds of standing on fire.
 *
 * So each entry carries its own `beats`, and the rule they were authored under
 * is stated once here rather than pretended to be arithmetic:
 *
 * **KEEP THE PACE THE FAMILY WAS AUTHORED AT, RECOMPUTED OVER THE BUILD'S WHOLE
 * RUN. Where the family was authored at no pace, take the build's own 30 fps.**
 *
 * ```text
 *   entry        family pace                 run    beats   = ms
 *   psyche_up    psyche: 1 beat per frame     18     18       2160
 *   psyche_up2   psyche: 1 beat per frame     17     17       2040
 *   hurt8        hurt: 5 beats / ~17 frames   34     10       1200
 *   knockback    knockback: 9 beats / 13      19     13       1560
 *   burning      condition: no pace -> 30 fps 32      9       1080
 *   celebrate1   not dispatched                27    null       --
 * ```
 *
 * Every one of those is AUTHORED, like every other duration in this engine, and
 * `timeline.js` keeps stamping `provenance: "authored-timing"` on the result.
 * The build's frame counts beside them are the measured part.
 */
export const CLIP_SEQUENCES = Object.freeze({
  /**
   * THE ONE SILENT HURT IS HALF A PERFORMANCE. Direction 8 dispatches
   * `hurt8` — `defender_hurt` assembles `"hurt" + attack_direction` — and the
   * build plays 34 frames for it against 18 for every neighbouring direction.
   * The sound lands at frame 1266, seventeen frames in.
   */
  hurt8: Object.freeze({
    plays: Object.freeze(["hurt8", "hurt9"]),
    entryFrames: 16, frames: 34, beats: 10,
    endsAt: 1283, ending: "stop"
  }),

  /**
   * THE KNOCKBACK, and the build never plays the clip this engine was playing.
   * `damagecharacter` calls `gotoAndPlay("knockback")` at two sites, both gated
   * on the force magnitude exceeding 80 (`+0x1b4f` for positive force,
   * `+0x1bc0` for negative). **And a THIRD site is not `damagecharacter`'s**
   * *(added 2026-09-22 by a write-nothing verifier re-reading the `cast_gale`
   * arm)*: `defender.gotoAndPlay("knockback")` at `+0x7b78`, unconditional
   * inside the gale's `shove` latch. ~~`knockback_mov` is dispatched by
   * nothing; it is reached only by running off the end of `knockback`.~~
   * **WRONG, and this file's own header already said so — corrected
   * 2026-09-22:** `defender.gotoAndPlay("knockback_mov")` at `+0x7c5e`, in the
   * `cast_command` arm, dispatches it directly. Running off the end of
   * `knockback` is how the three `"knockback"` sites above reach it.
   */
  knockback: Object.freeze({
    plays: Object.freeze(["knockback", "knockback_mov"]),
    entryFrames: 6, frames: 19, beats: 13,
    endsAt: 1446, ending: "stop"
  }),

  /**
   * THE FIRST CHARGE. Nine frames of `psyche_up` and nine of `psyche_charging`,
   * one stop, one `struck = true`. The glow holds at blur 22 throughout both —
   * there is no pulse in this half of the family.
   */
  psyche_up: Object.freeze({
    plays: Object.freeze(["psyche_up", "psyche_charging"]),
    entryFrames: 9, frames: 18, beats: 18,
    endsAt: 1626, ending: "stop"
  }),

  /**
   * THE SECOND CHARGE, AND THE ONE WHERE TRUNCATION SHOWED. The pack's only
   * tween runs across this boundary: the outer `#00ffff` glow's `strength`
   * falls 2.699 -> 0.977 over `psyche_up2`'s nine frames and climbs back to
   * exactly 2.699 on `psyche_charging2`, while `blurX` steps 22 -> 14.5 -> 13.
   * **Cutting at 1635 stopped the pulse at its return stroke**, mid-climb, and
   * snapped the glow back — the one visible symptom of the whole defect.
   */
  psyche_up2: Object.freeze({
    plays: Object.freeze(["psyche_up2", "psyche_charging2"]),
    entryFrames: 9, frames: 17, beats: 17,
    endsAt: 1643, ending: "stop"
  }),

  /**
   * THE BURN IS A CYCLE, NOT A FLICKER. Frame 1947 sets `this.burncycle = 1`;
   * frame 1963 is the clip's ONLY conditional —
   * `if (burncycle >= 2) { struck = true; gotoAndPlay("Standing") }
   *  else { burncycle++; gotoAndPlay("flame_repeat") }`, compiled as
   * `Less2; Not; Not; If` — so the cycle body plays TWICE and the run is
   * 2 + 15 + 15 frames.
   *
   * **This engine played the two-frame stub**, which is 6% of what the build
   * plays, and no test could see it because the pack's `burning` entry really
   * is two poses long.
   *
   * ► **`frames: 32` IS THE ONE NUMBER IN THIS TABLE THE TOOL DOES NOT PROVE,
   *   and a verifier caught it sitting there looking like the others.**
   *   `tools/clip-sequences.mjs` finds the terminator and reports
   *   `goto:Standing goto:flame_repeat`; it does not EVALUATE the counter, so
   *   the repeat count of 2 is read by hand out of `burncycle = 1` and
   *   `>= 2`. `repeats` says so at the field, and the tool flags the run as
   *   `loops` so the two cannot silently diverge.
   *
   * ► **AND IT IS FRAME-SLOT EXECUTIONS, NOT RENDERED TICKS.** AVM1 runs a
   *   frame's actions before it renders, so frame 1963's own artwork is never
   *   shown — each entry to it renders the goto target instead. The build's
   *   wall-clock is therefore ~30 ticks, not 32. The beat count below is
   *   authored against the slot count, which is the conservative direction: it
   *   errs long by two frames rather than clipping the cycle.
   */
  burning: Object.freeze({
    plays: Object.freeze(["burning", "flame_repeat", "flame_repeat"]),
    entryFrames: 2, frames: 32, beats: 9,
    endsAt: 1963, ending: "goto:Standing",
    // HAND-DERIVED from `burncycle = 1` at 1947 and `>= 2` at 1963. The only
    // hand-derived number here; everything else comes out of the tool.
    repeats: Object.freeze({ label: "flame_repeat", passes: 2, derivedBy: "hand" })
  }),

  /**
   * THE VICTORY CELEBRATION, which this engine cannot yet dispatch — a bout
   * ends and nobody gloats (`UNMAPPED_CLIP_LABELS.unbuiltOutcome`). It is in
   * the table anyway, because the table's job is to say what the build does and
   * the day the celebration is built it must not be half of one.
   *
   * `celebrate1a` SELF-LOOPS at 1426, so the run does not terminate: the
   * gladiator celebrates until something else moves him. `frames` counts one
   * pass.
   */
  celebrate1: Object.freeze({
    plays: Object.freeze(["celebrate1", "celebrate1a"]),
    entryFrames: 9, frames: 27, beats: null,
    endsAt: 1426, ending: "loop:celebrate1a"
  })
});

/**
 * THE LABELS SOME RUN PLAYS AFTER ITS ENTRY, derived from the table above
 * rather than listed a second time.
 *
 * ► **THIS IS A LIST OF RUN MEMBERS, NOT OF UNREACHABLE LABELS**, and the
 *   distinction is one an adversarial verifier had to force. Four of the six
 *   are dispatched somewhere in their own right: `hurt9` by attack direction 9,
 *   `knockback_mov` by one spell path at `+0x7c5e`, and both `psyche_charging*`
 *   by `changeCombatants`'s `gotoAndStop` as a held stance. Only `celebrate1a`
 *   and `flame_repeat` are reached by running in and nothing else.
 *
 *   So this list answers "what does an entry play after itself", and NOT "what
 *   may a family offer as a label" — `clip-labels.js` still owns that, and the
 *   two give different answers for `hurt9` and `knockback_mov` on purpose.
 */
export const CONTINUATION_LABELS = Object.freeze([...new Set(
  Object.values(CLIP_SEQUENCES).flatMap((entry) => entry.plays.slice(1))
)].sort());

/**
 * The build's own play order for a label, in lower case.
 *
 * Returns a single-element list for a label the build plays on its own, so a
 * caller never has to branch: the answer is always "the labels this entry
 * plays", and for 95 of the fighter's 101 labels that is just the label.
 */
export function clipSequenceFor(label) {
  if (typeof label !== "string" || label.length === 0) return [];
  const key = label.toLowerCase();
  const entry = CLIP_SEQUENCES[key];
  return entry ? entry.plays : Object.freeze([key]);
}

/** Whether entering at this label plays more than the clip that carries its name. */
export function isSequencedLabel(label) {
  return typeof label === "string" && Object.hasOwn(CLIP_SEQUENCES, label.toLowerCase());
}

/**
 * The authored beat count a sequenced label's schedule should run for, or null
 * to leave the family's own duration alone.
 *
 * Null means one of two things and the table says which: the label is not
 * sequenced at all (95 of 101), or it is sequenced but nothing dispatches it,
 * so no schedule ever asks (`celebrate1`). Both answers are "do not touch the
 * family's duration", which is why they share a return value.
 *
 * See this module's header for the rule the six numbers were authored under.
 */
export function sequenceBeatsFor(label) {
  if (typeof label !== "string") return null;
  const entry = CLIP_SEQUENCES[label.toLowerCase()];
  if (!entry) return null;
  const { beats } = entry;
  if (beats === null) return null;
  if (!Number.isInteger(beats) || beats <= 0) {
    throw new ClipSequenceError(`\`${label}\` has a \`beats\` of ${beats}, which is not a duration.`);
  }
  return beats;
}
