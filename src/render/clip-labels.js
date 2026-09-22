/**
 * WHICH OF THE BUILD'S OWN CLIP LABELS a timeline family corresponds to.
 *
 * This is the single join between this engine's vocabulary and the licensed
 * build's, and everything that reads an extracted asset goes through it:
 * `sound.js` to pick a sound, `extracted-figure.js` to pick an animation. Both
 * extractors key their output on these same names — `tools/extract-sounds.mjs`
 * binds a `StartSound` to the `FrameLabel` it fires under, and
 * `tools/extract-figure.mjs` cuts the fighter's timeline at the same labels —
 * so the join is the BUILD'S OWN and not a convention this project invented.
 *
 * ## Why this is its own module, and it is the whole lesson of 2026-09-12
 *
 * ► **The table used to live in `sound.js`, and before that it was not a table
 *   at all — it was arithmetic on the battle map's PROSE ranges.** The map
 *   summarises the fighter clip as "movement and charge (33-104)" and "Block
 *   (118/179)". Those are ranges over SEVERAL animations, so "movement" held
 *   `StepBack`, `StepForward`, `Charge` AND `Chargeattack` — a leaping attack —
 *   and "block" swallowed `Jump` and `Superjump`. The owner heard it
 *   immediately: *"I am hearing a block sound and jump sound for walking."*
 *
 *   **Nothing in the suite could catch it, because BOTH SIDES of the lookup
 *   bucketed the same coarse way and agreed with each other perfectly.** Two
 *   coarse mappings agreeing is not the same as either being right.
 *
 * So the vocabulary lives in ONE place now. A second consumer arriving is
 * exactly when a duplicated table starts to drift, and the figure is that
 * second consumer.
 *
 * ## Every name here is the build's, lower-cased, and none is inferred
 *
 * The clip carries 101 `FrameLabel` tags. A family maps to the labels it may
 * play, in the order a caller should prefer them. **A family with no entry
 * returns an empty list, and an empty list is an answer rather than a gap** —
 * the build genuinely has no clip for some of what this engine can express.
 */

export class ClipLabelError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Family -> the build's own labels.
 *
 * ► **`block` IS HERE, and it is silent.** `Block` and `BlockForward` carry no
 *   `StartSound` at all, so a block makes no noise — but the clip exists and
 *   the figure must draw it. **Those are two different facts and the old table
 *   conflated them** by omitting `block` entirely, which made "the build has no
 *   block animation" and "the build's block is silent" the same entry. Silence
 *   is a property of the BINDINGS, and `chooseSound` derives it from them.
 */
const FAMILY_LABELS = Object.freeze({
  standing: Object.freeze(["standing"]),
  rest: Object.freeze(["rest"]),
  block: Object.freeze(["block", "blockforward"]),

  // The build's own four gaits, each with its own pair of clips. The pair is
  // FORWARD FIRST, then back; `directionalLabel` picks between them.
  "movement:walk": Object.freeze(["stepforward", "stepback"]),
  "movement:run": Object.freeze(["runforward", "runback"]),
  "movement:charge": Object.freeze(["charge", "chargeattack"]),
  "movement:jump": Object.freeze(["jump", "superjump"]),
  // AUTHORED, and the only entry here that is: `sidestep` names no vanilla
  // phase, because the build has no lane to change. A lane change borrows the
  // walk, which is the nearest thing the build actually has.
  "movement:sidestep": Object.freeze(["stepforward", "stepback"]),

  attack: Object.freeze(["attack1", "attack2", "attack3", "attack4", "attack5", "attack6",
    "attack7", "attack8", "attack9", "attack10", "attack11", "attack12"]),
  // ► **THE PSYCHE FAMILY, BUILT 2026-09-16 — three clips for one phase, chosen
  //   by a COUNTER rather than by a direction or a facing.** That is unlike
  //   every other family here: `attack` is picked by a drawn direction and the
  //   gaits by a facing, but `psyche_up`, `psyche_up2` and `psyche_up3` are
  //   picked by how many times in a row the gladiator has pressed the button
  //   (`+0x658a`, `+0x65b9`, `+0x65ef` for 1, 2 and >= 3).
  //
  //   So the resolver names the clip on the event and the presentation layer
  //   passes it through; nothing here indexes into the list. It is a family so
  //   that all three are DECLARED PLAYABLE, which is what this table is for.
  //
  // ► **`psyche_charging` AND `psyche_charging2` ARE STILL NOT HERE, AND THE
  //   REASON CHANGED ON 2026-09-16.** It used to be "this engine dispatches ONE
  //   animation per action, never a sequence", which was true of the engine and
  //   false of the build: `psyche_up` runs 1609-1617 straight on to the `Stop`
  //   at 1626, so the build plays `psyche_charging` as the second half of the
  //   same performance. `src/render/clip-sequences.js` carries that now and
  //   this engine plays both.
  //
  //   They stay out of the family because a family lists labels an ATTACK
  //   SELECTOR may choose, and nothing in the phase machine chooses these.
  //
  //   ► **THEY ARE DISPATCHED, THOUGH — WITH `gotoAndStop`, AS A HELD STANCE,
  //     AND THAT IS A FEATURE THIS ENGINE HAS NOT BUILT.** `changeCombatants`
  //     poses BOTH fighters at the top of every turn from the counter:
  //     `if (game_attacker.psyche_up == 2) attacker.gotoAndStop("psyche_charging")`
  //     at `+0x281e`, the same at 3 for `psyche_charging2` (`+0x284d`), and
  //     both again for the defender (`+0x287c`, `+0x28ab`). So a gladiator
  //     holding a charge STANDS in the charged pose rather than in `Standing`,
  //     for as long as the charge lasts. **A stance is a persistent pose
  //     BETWEEN actions and a run is one performance WITHIN one**, so it does
  //     not belong in a family or in `clip-sequences.js`; it is its own piece
  //     of work and the handoff ranks it.
  psyche: Object.freeze(["psyche_up", "psyche_up2", "psyche_up3"]),
  /**
   * ► **THE DISCHARGE'S OWN FAMILY, AND IT HAD NO ENTRY HERE FOR TWO DAYS —
   *   found by an audit, 2026-09-18.**
   *
   * `timeline.js`'s `familyOf` splits `psyche_up3` into `psyche:discharge`
   * because that clip is thirteen frames against the other two's nine and is
   * the one that SWINGS. The split landed; this table was never told. So the
   * third press — the only psych-up press that does anything — asked for a
   * family with an EMPTY clip vocabulary, drew nothing from the extracted rig,
   * lost its face, made no sound, **and reported `recognised: true`**, so
   * nothing logged a notice. A fully dressed gladiator reverted to authored
   * stick-figure art at the exact moment of his biggest blow.
   *
   * Its art (13 poses, up to 17 placements) and its sound (`1197.mp3`) both
   * existed the whole time and were reachable through `psyche` above.
   *
   * **`stance.js` already had the guard that would have caught this** —
   * `stanceFamiliesCover`, whose comment says a family that does not list its
   * own label "silently falls back to authored art on a machine that has the
   * pack — a wrong picture with no error". That is exactly what happened, to a
   * family it did not cover. The symmetric check is now in `timeline.js`.
   */
  "psyche:discharge": Object.freeze(["psyche_up3"]),

  /**
   * THE CHARGED STANCE — the only families here that are an IDLE rather than an
   * action, and the only ones nothing dispatches by name.
   *
   * ► **A GLADIATOR HOLDING A CHARGE DOES NOT STAND IN `Standing`.**
   *   `changeCombatants` resets both fighters with `gotoAndPlay("Standing")`
   *   and then overrides whichever of them holds a charge:
   *
   *   ```text
   *     attacker.gotoAndPlay("Standing")                             +0x27db
   *     defender.gotoAndPlay("Standing")                             +0x27ef
   *     if (game_attacker.psyche_up == 2)
   *         attacker.gotoAndStop("psyche_charging")                  +0x281e
   *     if (game_attacker.psyche_up == 3)
   *         attacker.gotoAndStop("psyche_charging2")                 +0x284d
   *     if (game_defender.psyche_up == 2)
   *         defender.gotoAndStop("psyche_charging")                  +0x287c
   *     if (game_defender.psyche_up == 3)
   *         defender.gotoAndStop("psyche_charging2")                 +0x28ab
   *   ```
   *
   *   `gotoAndStop`, so it is ONE HELD FRAME and not a performance — which is
   *   why these are separate families from `psyche` above and why
   *   `src/render/stance.js` holds them at `at` 0 rather than running a clock.
   *
   * ► **TWO FAMILIES AND NOT ONE, for the reason `psyche:discharge` is its own
   *   family**: the two poses are different frames and should not read alike.
   *   A pack-less clone gets an authored pose per level, and a deeper charge
   *   reads deeper.
   *
   * ► **AND THIS IS WHERE THE TWO CONTINUATIONS STOPPED BEING UNDISPATCHED.**
   *   They were in `UNMAPPED_CLIP_LABELS.continuations` on the grounds that
   *   nothing named them; `changeCombatants` names both, four times, and had
   *   done since the build shipped.
   */
  "stance:psyche": Object.freeze(["psyche_charging"]),
  "stance:psyche2": Object.freeze(["psyche_charging2"]),

  /**
   * THE VICTORY CELEBRATION — the second idle this engine has, and the second
   * one that is not `Standing`.
   *
   * ► **A SURVIVING WINNER DOES NOT GO BACK TO BREATHING.** Overlay frame 65,
   *   inside the `combatwon` span (62-73), runs
   *   `_root.arena.gladiators.hero.gotoAndPlay("celebrate1")`; frame 77, inside
   *   `combatlost` (74-84), runs the same on `villain`. `celebrate1` carries no
   *   `Stop`, runs on into `celebrate1a`, and frame 1426 is
   *   `GoToLabel("celebrate1a"); Play` — **so the winner celebrates until
   *   something else moves him, and in a finished bout nothing does.**
   *
   * ► **ONLY `celebrate1` IS DISPATCHED**, so only `celebrate1` is here.
   *   `celebrate1a` is reached by running on, exactly as `psyche_charging` was
   *   before the stance gave it a dispatcher — `clip-sequences.js` carries the
   *   run and `animationFor` concatenates it. It stays in `continuations`
   *   because nothing in the build names it.
   */
  celebrate: Object.freeze(["celebrate1"]),
  // ► **`hurt8` WAS MISSING, AND IT WAS MISSING FOR THE `block` REASON.** The
  //   clip carries `hurt1`-`hurt12` and `hurt20`, thirteen animations, and this
  //   list held twelve. The one it dropped is the one the build binds NO SOUND
  //   to — so "the build plays no sound here" had been written down as "the
  //   animation does not exist", exactly the conflation corrected for `block`
  //   earlier the same day. Fixing one instance of a habit does not fix the
  //   habit. **Deaths are 13 of 13 and attacks 12 of 12; `hurt8` was the only
  //   hole left.** It draws now, and it is still silent — because silence is
  //   derived from the bindings, which is the whole point of the correction.
  hurt: Object.freeze(["hurt1", "hurt2", "hurt3", "hurt4", "hurt5", "hurt6", "hurt7",
    "hurt8", "hurt9", "hurt10", "hurt11", "hurt12", "hurt20"]),

  // ► **THE THIRTEEN DEFENCES, AND THEY ARE THE EXACT MIRROR OF `hurt`.** A
  //   blow that lands calls `defender_hurt` and plays `hurt<direction>`; a blow
  //   that MISSES calls `defender_blocked` and plays `defend<direction>`
  //   (`sprite:862[overlay]/frame:52/DoAction@0x240c7f` `+0x2160`), with the
  //   same 21-23 rewrite and `defend12` at direction 30. This is NOT the
  //   `block` family: `Block` and `BlockForward` are the static guard a
  //   gladiator holds while it swaps weapons, which is a different thing that
  //   happens at a different time.
  defend: Object.freeze(["defend1", "defend2", "defend3", "defend4", "defend5", "defend6",
    "defend7", "defend8", "defend9", "defend10", "defend11", "defend12", "defend20"]),
  // ► **`knockback` IS THE ENTRY AND IT WAS MISSING FROM ITS OWN FAMILY, so
  //   this engine played the second half of a knockback and never the first.**
  //   `damagecharacter` calls `gotoAndPlay("knockback")` at two sites, both
  //   gated on the force magnitude exceeding 80 (`+0x1b4f` positive, `+0x1bc0`
  //   negative) — and the string is `"knockback"` at both. It runs off its own
  //   end into `knockback_mov` (1428-1433 into 1434-1446, one `Stop` at the end
  //   of the pair), which `clip-sequences.js` now carries.
  //
  //   ► ~~**Nothing anywhere in the build dispatches `knockback_mov`.**~~
  //     **REFUTED BY A VERIFIER AND RE-DERIVED HERE: there is exactly one
  //     site**, `defender.gotoAndPlay("knockback_mov")` at `+0x7c5e`, inside
  //     `attacker.onEnterFrame` and immediately after
  //     ~~`cast_spell_icon(attacker, 39, 2)`~~ `cast_spell_icon(attacker, 39)`
  //     *(corrected 2026-09-22 by a write-nothing verifier re-reading
  //     `+0x7c46`-`+0x7c5c`: the 2 is the argument COUNT pushed for
  //     `CallFunction`)* — the `cast_command` arm, a SPELL this engine has no
  //     verb for. One site is not none, and "nothing dispatches it" was a stronger
  //     claim than the evidence, made while correcting a claim that was
  //     stronger than ITS evidence. It stays second in the list either way:
  //     the ordinary blow dispatches the entry.
  //
  //   The old entry listed `knockback_mov` first and this file declared
  //   `knockback` "superseded by a sibling". That had it exactly backwards: the
  //   sibling is the continuation. `knockback_mov` and `shove` stay in the
  //   list, behind the entry, as the fallback an incomplete pack gets.
  knockback: Object.freeze(["knockback", "knockback_mov", "shove"]),
  taunt: Object.freeze(["taunt"]),
  taunted: Object.freeze(["taunted"]),
  // The SHOVER's clip (frames 1447-1481, `+0x5e27`). It also sits at the end of
  // `knockback` above as a fallback an incomplete pack gets — which is a victim
  // borrowing the pusher's art, and is left as it was rather than silently
  // changed under a bout that already draws it.
  shove: Object.freeze(["shove"]),
  // ► **THE DRINKER'S CLIP, LEFT `unbuiltSpells` ON 2026-09-22 WITH ITS VERB**
  //   — family here, `familyOf` in `timeline.js` and the actor-only binding in
  //   `SS2_STATIC_MAP_BINDINGS`, in one change, the order `unbuiltSpells`
  //   prescribes. `attacker.gotoAndPlay("drink_potion")` at `+0x57c6`, frames
  //   1887-1910. It is not a spell and never was: it is the potion phase, and
  //   the build names the phase and the clip alike.
  drink: Object.freeze(["drink_potion"]),
  // ► **THE BOLTS' TWO CLIPS, LEFT `unbuiltSpells` ON 2026-09-22 — two days
  //   AFTER the verbs shipped, and on purpose.** The verbs carried the right
  //   labels on their event from the first commit; what they lacked was a
  //   family, and promoting a label without one is the `psyche:discharge`
  //   defect exactly. They moved together: family here, `familyOf` in
  //   `timeline.js`, and the binding in `SS2_STATIC_MAP_BINDINGS`.
  //
  // ► **`cast1` JOINED THE SAME FAMILY WHEN `cast_gale` WAS BUILT (2026-09-22)**
  //   — `attacker.gotoAndPlay("Cast1")` at `+0x7b30`. One family for both
  //   because both are a caster's gesture and share one schedule: `Cast1` is
  //   frames 2103-2125 (23) and `Cast2` 2126-2146 (21), both ending in their
  //   own `stop`, and both round to the same six 120 ms beats at 30 fps.
  //   **`cast2` stays FIRST**, so a caller with no label of its own gets the
  //   bolts' clip exactly as before; the engine's own label wins by membership
  //   in `animationFor` and `chooseSound`, so `Cast1` draws and sounds as
  //   itself.
  cast: Object.freeze(["cast2", "cast1"]),
  "magic:lightning": Object.freeze(["lightning"]),
  ranged: Object.freeze(["bombard", "snipe"]),

  // Per-flag in the build, so per-flag here: a burning gladiator and a frozen
  // one neither sound nor look alike.
  "condition:burning": Object.freeze(["burning"]),
  "condition:frozen": Object.freeze(["frozen"]),
  "condition:poisoned": Object.freeze(["poisoned"]),
  "condition:life_stolen": Object.freeze(["lifesteal"])
});

/**
 * Death is per-variant, and the variant IS the family suffix: `familyOf`
 * returns `death:<label>` using the build's own name, so no table is needed.
 * An unknown variant falls back to the whole set, because a death with a
 * neighbouring clip beats a death with none.
 */
const DEATH_LABELS = Object.freeze([
  "death1", "death2", "death3", "death4", "death5", "death6", "death7",
  "death21", "death22", "death23", "deathspike", "deathtaunt", "death_poisoned"
]);

/**
 * This engine's death VARIANTS are not the build's death CLIPS, and exactly one
 * of the five can be matched to one.
 *
 * `timeline.js` emits `death:slain`, `death:yield`, `death:taunt`,
 * `death:arrow` and `death:grievous`. The build's clips are `death1`-`death7`,
 * `death21`-`death23`, `deathspike`, `deathtaunt` and `death_poisoned`. Only
 * `taunt` has a counterpart, and it is DERIVED rather than guessed from the
 * name: **`deathtaunt` sits at frames 1083-1116, inside the contiguous death
 * block that runs 585-1116, while the attacking `taunt` is away at 1482-1511.**
 * The build files it with the deaths, so that is what it is.
 *
 * ► **THE OTHER FOUR ARE DELIBERATELY UNMAPPED.** `slain`, `yield`, `arrow` and
 *   `grievous` name no clip and nothing in the build says which they would be —
 *   `deathspike` is not an arrow, and inventing the rest is precisely the move
 *   this project forbids. They fall back to the whole death set, which is a
 *   death animation for a death, and the loss is that it is always the same
 *   one. **A capture that recorded which clip the build plays for each would
 *   settle it; none has.**
 */
const DEATH_VARIANT_CLIPS = Object.freeze({ taunt: "deathtaunt" });

/** The build's own clip labels this family may play, or an empty list. */
export function clipLabelsFor(family) {
  if (typeof family !== "string" || family.length === 0) return [];
  if (family === "unknown") return [];
  if (family.startsWith("death:")) {
    const variant = family.slice("death:".length).toLowerCase();
    if (DEATH_LABELS.includes(variant)) return [variant];
    const mapped = DEATH_VARIANT_CLIPS[variant];
    // The mapped clip FIRST, then the rest, so a pack missing it still dies.
    if (mapped) return [mapped, ...DEATH_LABELS.filter((name) => name !== mapped)];
    return DEATH_LABELS;
  }
  return FAMILY_LABELS[family] ?? [];
}

/**
 * THE BUILD'S LABELS THIS ENGINE DELIBERATELY DOES NOT PLAY — declared, so that
 * a label can never again go missing by accident.
 *
 * ► **WHY THIS EXISTS: `hurt8`.** The clip carries `hurt1`-`hurt12` and
 *   `hurt20`; this file held twelve of the thirteen, and the one it dropped was
 *   the one the build binds no sound to. "The build plays no sound here" had
 *   become "the animation does not exist" — the same conflation corrected for
 *   `block` hours earlier. **Fixing one instance of a habit does not fix the
 *   habit**, so the habit is closed here instead: every one of the fighter's
 *   101 labels is either in a family above or named below, and a test asserts
 *   that the two sets together cover the clip exactly.
 *
 * Grouped by WHY, because "unmapped" covers three different situations and only
 * one of them is a gap:
 */
export const UNMAPPED_CLIP_LABELS = Object.freeze({
  /**
   * NOT ANIMATIONS. Structural frames with nothing to play.
   */
  structural: Object.freeze(["initialize", "portrait"]),

  /**
   * CONTINUATIONS — reached only by running INTO them, never dispatched.
   *
   * ► **"UNPLAYED" WAS THE WRONG WORD AND IT COST THE ENGINE FIVE
   *   PERFORMANCES.** These four are played, by the build and now by this
   *   engine: `src/render/clip-sequences.js` reads the fighter clip's own frame
   *   actions and finds that `psyche_up` runs to the `Stop` at 1626 and
   *   `psyche_up2` to the one at 1643, so both charging clips play as the
   *   second half of their entry's run. What is true of all four is that
   *   NOTHING DISPATCHES THEM: no `gotoAndPlay` in the build names them, so no
   *   family may offer one as a label. That is why they are still here.
   *
   * ► **AND THE DISCRIMINATOR THIS LIST WAS BUILT ON WAS WRONG.** It was "no
   *   `StartSound` binding". Measured against the extracted manifest: 21 of the
   *   101 labels carry no binding and only these four are continuations — while
   *   `hurt8`, `knockback` and `celebrate1`, which ARE entry points, are silent
   *   too, because their sound fires on the continuation. Silence says nothing
   *   about where the playhead stops. The frame actions say it outright.
   *
   * ► **`psyche_charging` AND `psyche_charging2` LEFT THIS LIST, because the
   *   claim that put them here turned out to be false in BOTH directions.**
   *   They are run members, which this list was right about; they are also
   *   DISPATCHED, by `changeCombatants`'s four `gotoAndStop` calls, which it
   *   was not. They are the `stance:psyche*` families above now. **Two labels
   *   remain, and they are the only two of the six run members that nothing
   *   anywhere names** — which is what this bucket was always trying to say.
   */
  continuations: Object.freeze(["celebrate1a", "flame_repeat"]),

  /**
   * ► ~~**THE BUILD HAS A DEFENCE SYSTEM THIS ENGINE HAS NOT BUILT.**~~
   *   **BUILT 2026-09-14, AND THE SELECTOR WAS NEVER UNDERIVED.** This entry
   *   said: *"Which defend answers which attack is not derived, and guessing an
   *   index mapping across two thirteen-member sets is precisely the move this
   *   project keeps retracting. A capture, or the build's own selector, would
   *   settle it."* **The build's own selector settles it, and it is twelve
   *   instructions long.** `defender_blocked()` at
   *   `sprite:862[overlay]/frame:52/DoAction@0x240c7f` `+0x2138`:
   *
   *   ```text
   *     animstate = "defend" + attack_direction                     +0x2160
   *     if (attack_direction >= 21 && attack_direction <= 23)
   *         animstate = "defend" + (attack_direction - 20)          +0x219b
   *     if (attack_direction == 30) animstate = "defend12"          +0x21c6
   *     defender.gotoAndPlay(animstate)                             +0x224a
   *   ```
   *
   *   **The caution was right and the conclusion was wrong.** Refusing to guess
   *   an index mapping is correct; recording it as underived without asking the
   *   bytes is the same failure as a `MAP_SILENCE` entry that never read the
   *   next paragraph, which this repository has now logged four times. The
   *   entry cost about ten minutes to close and had stood for two sessions.
   *
   *   They are a FAMILY now; `roll` and `fumble1` stay here because nothing
   *   dispatches them and nothing in the build says what would.
   */
  unbuiltDefence: Object.freeze(["roll", "fumble1"]),

  /**
   * SPELLS AND PSYCHE. ~~**The engine already carries the RESOURCES —
   * `psyche_up`, `spell_colossus`, `spell_bloodlust` are combatant fields — and
   * has no verb, no family and no animation binding for any of them.**~~ The art
   * has been sitting in the clip the whole time.
   *
   * ► **THE THREE `psyche_up*` CLIPS LEFT THIS LIST ON 2026-09-16, BECAUSE THE
   *   VERB WAS BUILT.** `Ss2ActionType.PSYCHE_UP` resolves, `legalActions`
   *   offers it on every controller frame, and the `psyche` family above
   *   declares all three playable. **They had been sitting here since this
   *   table existed, and three handoffs recorded them as blocked on an owner
   *   decision about "what those spells ARE" — `psyche_up` is not a spell, it
   *   is a vanilla ACTION the battle map specifies in 31 places.**
   *
   *   ~~The spells are genuinely still unbuilt: `cast1`, `cast2`, `colossus`,
   *   `lightning`, `rejuvinate` and `drink_potion` have no verb and no
   *   dispatcher, and unlike the psyche counter the build's own selector for
   *   them has not been read.~~
   *
   * ► ~~**TWO OF THE SIX NOW HAVE A VERB AND STILL HAVE NO DISPATCHER, AND THEY
   *   STAY ON THIS LIST FOR EXACTLY THAT REASON (2026-09-20).**~~ **THEY LEFT
   *   ON 2026-09-22, when the family arrived** — `cast` and `magic:lightning`
   *   above, `familyOf` in `timeline.js`, and the binding in
   *   `SS2_STATIC_MAP_BINDINGS`, all in one commit. The paragraph below is the
   *   reasoning that kept them here until then, and it is kept because the
   *   reasoning was right: a verb is not a family. The bolt verbs
   *   `Ss2ActionType.CAST_LIGHTNING_BOLT` / `CAST_FRIGHTNING_BOLT` resolve, and
   *   their event carries `casterClip: "Cast2"` and `victimClip: "lightning"` —
   *   read out of the build at `+0x8515` and `+0x858f`. **So the selector HAS
   *   been read; what is missing is the family.**
   *
   *   Moving them out of this bucket without one is the `psyche:discharge`
   *   mistake exactly: that split landed, this table was never told, and the
   *   third psych-up press asked for a family with an EMPTY clip vocabulary,
   *   drew nothing, lost its face, made no sound **and reported
   *   `recognised: true`**. A label listed as unbuilt draws authored art and
   *   says so; a label promoted to a family that does not exist draws nothing
   *   and lies about it. **They leave this list when `FAMILY_LABELS` gains an
   *   entry, not when the verb ships.** *(This line and the 2026-09-20 handoff
   *   called the table `CLIP_FAMILIES`. No such name exists in this repository;
   *   it is `FAMILY_LABELS`, the constant at the head of this file.)*
   *
   *   ~~`cast1` is a different case again and is NOT what the bolts play: it is
   *   `cast_gale`'s and the fireball family's clip (`+0x7b30`, `+0x90f4`), and
   *   neither has a verb.~~ **`cast1` LEFT TOO, LATER ON 2026-09-22, when
   *   `cast_gale` got its verb** — family, `familyOf` and the event's
   *   `casterClip` in one change, the order this paragraph prescribes. ~~The
   *   fireballs still have no verb; they play the same clip and will need
   *   nothing here when they get one.~~ The fireballs got theirs the same day
   *   and, as predicted, needed nothing here: they play the same `Cast1`.
   */
  unbuiltSpells: Object.freeze([
    // `cast2` and `lightning` left on 2026-09-22; see the `cast` and
    // `magic:lightning` families above. `cast1` left the same day with the gale,
    // and `drink_potion` later still with its own verb — see the `drink` family.
    "colossus", "rejuvinate"
  ]),

  /**
   * VICTORY AND SURRENDER. Six crowd-facing celebrations and two yields, none
   * of which this engine can express: a bout ends and nobody gloats.
   */
  unbuiltOutcome: Object.freeze([
    "wincrowd1", "wincrowd2", "wincrowd3", "wincrowd4", "wincrowd5", "wincrowd6",
    "yield1", "yield2"
  ]),

  /**
   * ► ~~**NAMED BY A FAMILY THROUGH A SIBLING.** `knockback` the LABEL is a
   *   separate 6-frame clip from `knockback_mov` and `shove`, which are what
   *   the `knockback` family actually plays.~~ **WRONG, AND BACKWARDS —
   *   RETRACTED 2026-09-16 FROM THE BUILD'S OWN BYTES.** `damagecharacter`
   *   dispatches `"knockback"` and nothing dispatches `knockback_mov`; the
   *   6-frame clip is the ENTRY and the 13-frame one is its continuation. The
   *   entry is in the `knockback` family above now, so this bucket is empty.
   *
   *   **It is kept, empty, rather than deleted**, because the reconciliation
   *   this table exists for should show that the category was considered and
   *   came to nothing — and because "a label a family reaches through a
   *   sibling" is a real situation that a later label may land in.
   */
  supersededBySibling: Object.freeze([]),

  /** Unclassified, and honestly so. */
  unknown: Object.freeze(["little_fat_kid"])
});

/** Every label named above, flattened. */
export function allUnmappedLabels() {
  return Object.values(UNMAPPED_CLIP_LABELS).flat();
}

/** Every label this module can name, for a consumer that wants to check coverage. */
export function allClipLabels() {
  const names = new Set(DEATH_LABELS);
  for (const labels of Object.values(FAMILY_LABELS)) for (const label of labels) names.add(label);
  return [...names].sort();
}

/**
 * The one label a DIRECTIONAL family should play, given where the figure is
 * going and which way it is facing.
 *
 * ► **The build has no `walkleft`/`walkright` CLIPS — it has `StepForward` and
 *   `StepBack`, and which one plays depends on facing.** This engine's labels
 *   are absolute (`walkleft`) while the build's are relative to the gladiator,
 *   so a renderer that took the first label of the pair would walk a retreating
 *   gladiator forwards. Vanilla has one gladiator a side and always closes, so
 *   this distinction never arose until a team could retreat.
 *
 * Non-directional families are unaffected and return their first label.
 */
export function directionalLabel(family, label, facing) {
  const labels = clipLabelsFor(family);
  if (labels.length === 0) return null;
  if (!family.startsWith("movement:") || labels.length < 2) return labels[0];
  const goingLeft = typeof label === "string" && label.endsWith("left");
  const goingRight = typeof label === "string" && label.endsWith("right");
  if (!goingLeft && !goingRight) return labels[0];
  const facingLeft = facing === "left";
  // Travelling the way you face is FORWARD; the other way is BACK, and the
  // build animates a backward step as its own clip rather than a mirrored one.
  const forward = goingLeft === facingLeft;
  return forward ? labels[0] : labels[1];
}
