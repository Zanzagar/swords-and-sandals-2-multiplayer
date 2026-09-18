/**
 * SS2's own arithmetic, wired into the shared team resolver. MAP-DERIVED.
 *
 * This is the first rule set in the repository that is not invented. Every
 * number it produces is either read out of the licensed build's bytecode (via
 * `docs/integration/ss2-battle-map.md`, which carries the offsets) or computed
 * by `src/golden/ss2-attack-candidate.js`, the module the 22 promoted goldens
 * already replay against. Until this file existed the corpus fed nothing: the
 * resolver ran `placeholder-rules.js`, and 22 runtime-verified fixtures sat in
 * `test/fixtures/` with no consumer.
 *
 * ## What tier this is, and why it is not higher
 *
 * `map-derived`, and it declares `runtimeVerified: false`. No capture session
 * has ever observed THIS MODULE driving a fight. What the goldens back is the
 * attack ingress it delegates to, for directions 1-12 only. Everything else
 * here — the stamina economy, action legality, the AI policy — is derived from
 * the map and has never been observed at all. The provenance note says so, the
 * hot-seat banner prints the tier, and `rule-set.js` refuses the claim of
 * runtime verification outright.
 *
 * ## The vocabulary is three verbs and a rest, and the direction is DRAWN
 *
 * A player does not choose an `attack_direction` in SS2. `power_attack`,
 * `normal_attack` and `quick_attack` each draw one — `randomBetween(9, 12)` at
 * `+0x608a`, `randomBetween(5, 8)` at `+0x61f1`, `randomBetween(1, 4)` at
 * `+0x635c` (map § "Where `attack_direction` is assigned") — before calling
 * `checkattackroll`. The map states it plainly: the direction "is recorded,
 * never dictated".
 *
 * So the direction is a draw on the ordered channel, not a token in the action
 * vocabulary. That is the opposite of the obvious design — encoding twelve
 * directions as twelve action types — and the obvious design would have handed
 * the player a choice the build does not give them, which is a parity claim
 * nothing measured.
 *
 * `rest` is in the vocabulary because without it a fight deadlocks: the
 * attacker pays `staminacost` on every phase transition (`nextphase`
 * `+0x32a7`), and at `staminaleft <= 0` overlay frame 1 forces
 * `getphase("rest")` (`+0x0d2e`).
 *
 * ► **DEFERRED — AND THIS PARAGRAPH WAS STALE FOR THREE OF ITS FOUR ENTRIES
 *   FOR TWO DAYS, WHICH IS WORSE THAN IT SOUNDS.** It named four actions as
 *   blocked, each with a reason, and ended "None of the four has a single
 *   golden". ~~`bash_attack` (needs a `criticalhit` inherited across actions,
 *   which the resolver has no channel for), `bombard`/`snipe` (need
 *   `using_bow`, a `swap_weapons` turn and an `ammo_left` model)~~ — **all
 *   three SHIPPED on 2026-09-13.** `Ss2ActionType` exports `BASH_ATTACK`,
 *   `BOMBARD` and `SNIPE`, `legalActions` pushes them, and each has a fixture.
 *   **An implementer reading only this header would re-derive work that is
 *   already in the file underneath it** — which is exactly what nearly
 *   happened on 2026-09-15, and three agents aimed at different questions each
 *   broke this paragraph independently.
 *
 * ► ~~**WHAT IS GENUINELY DEFERRED IS TWO.**~~ **ONE. AND THIS PARAGRAPH WENT
 *   STALE AGAIN — THE SECOND TIME, IN THE PARAGRAPH WHOSE WHOLE SUBJECT IS
 *   GOING STALE.** It was rewritten on 2026-09-15 to say two were left;
 *   `psyche_up` shipped on 2026-09-16 (`b201486`) and this line was not
 *   touched. **A header that documents its own staleness and then repeats it is
 *   worth less than one that says nothing**, because it teaches a reader to
 *   trust it.
 *   - ~~`psyche_up` — needs a three-turn counter and a position model.~~
 *     **BUILT 2026-09-16.** `Ss2ActionType.PSYCHE_UP` resolves, `legalActions`
 *     offers it on every controller frame, the counter is a resource with no
 *     default (which is what kept all 23 golden replay hashes still), and the
 *     charged stance and its glow reach the screen.
 *   - ~~`taunt` — the candidate implements only the post-`checkattackroll` arm,
 *     so it would consume the wrong number of samples.~~ **BUILT 2026-09-17,
 *     AND THE REASON WAS RIGHT TO THE END** — it is why the build took the two
 *     pre-draws itself rather than letting the dispatcher take them:
 *     one sample on a failed roll, two on effect 2, and the dispatcher's only
 *     on effect 1. See `SS2_TAUNT` and `test/ss2-taunt.test.js`.
 *
 * ► **SO THE LIST IS EMPTY, AND THIS PARAGRAPH HAS OUTLIVED ITS SUBJECT.**
 *   Every vanilla action the controllers wire now resolves. It is kept — with
 *   its history intact — because the history is the useful part: it went stale
 *   for three of its four entries, then for one of its two, and each time the
 *   staleness was found by somebody about to re-derive work already in the file
 *   underneath it. **A reader arriving here should take the warning and not the
 *   list.** The map has taunt's derivation in full: `diceroll =
 *     randomBetween(1, 100)` at `+0x6921`, succeeding on
 *     `diceroll < game_attacker.taunt_percentage` (`+0x694b`, a DIRECT
 *     comparison and not the dispatcher's `100 - chance` form), then
 *     `taunt_effect = randomBetween(1, 2)` at `+0x6952` — of which only
 *     `taunt_effect == 1` sets `attack_direction = 20` and calls
 *     `checkattackroll`, while `2` runs a charisma-scaled knockback or sets
 *     `game_defender.taunted1 = true` (`+0x6ad9`) and never reaches the
 *     dispatcher at all. **The discriminator between those two arms, which the
 *     map left open until 2026-09-17, is the DEFENDER'S WEAPON MODE**:
 *     `equipped_weapon == 1` (`+0x69a7`) is melee and takes a `charisma * 25`
 *     shove; anything else is the bow and is made to flee. **And both clips
 *     fire BEFORE the roll** — `taunt` on the actor, `taunted` on the target —
 *     so a FAILED taunt still animates both. Fully derived in the battle map
 *     under "The taunt phase, in full"; what is left to build is the two
 *     pre-samples, the two effect arms, and a `taunted1` flee consumption that
 *     `SS2_STATUS_PHASE_FOR_FLAG` does not yet carry.
 *
 * ## What reaches the arithmetic, and how
 *
 * `resolveSs2PhysicalAttackCandidate` reads ~40 vanilla fields. The resolver's
 * combatant carries seven stats, five loadout keys, a numeric resource bag and
 * a status list — and `roster.normaliseCombatant` rebuilds `stats` and
 * `loadout` as fixed-key literals, so a blueprint's extra keys are dropped.
 * Everything SS2-specific therefore travels as a **resource** (numbers) or a
 * **status** (strings), which is exactly what those two channels exist for:
 * both are on the view AND on the projection, so `combatStateHash` covers
 * every PER-COMBATANT input this rule set reads.
 *
 * That sentence used to end "covers every input this rule set reads. Nothing
 * reaches it through a side channel", and a verifier broke it. Two things are
 * read that the hash does not cover, and neither is this module's to fix:
 *
 * - **the RNG samples in tape mode.** `toTeamWireState` carries `rngState` and
 *   `rngCursor`, but a tape channel's `state` is a constant 0, so only the
 *   cursor moves. Two peers with different tapes hash identically until they
 *   diverge. Projecting the channel mode and a digest of the samples would
 *   close it; that is a resolver-contract change with its own decision.
 * - **the `observer` option**, which is not in the rule-set id and not in the
 *   projection. It is handed a deep clone precisely so it cannot reach the
 *   objects `battle.events` holds.
 *
 * `gladiator_dir` is the one input that cannot be a resource — resources are
 * finite numbers by construction — so it travels as the status token
 * `facing-left` (absent means "right", matching the candidate's own default).
 * It is load-bearing on the RNG: facing decides the armour-debris draw's
 * source and bounds, so getting it wrong desyncs a tape rather than merely
 * moving a number.
 *
 * ## The adapter path works for AI-filled slots and not for supplied ones
 *
 * **Corrected 2026-09-02. This section previously said "A battle built through
 * `src/adapter/` therefore cannot feed this rule set", and that is FALSE** — a
 * verifier built one and fought a 28-step battle through it. The claim was
 * mine and it was over-general in the direction that discourages someone from
 * trying; it is corrected here rather than deleted because it was cited as a
 * known limitation in `HANDOFF.md`.
 *
 * What is true: `CANONICAL_RESOURCE_SOURCES` (`src/adapter/state-bridge.js`) is
 * a closed list carrying none of the eight armour piece ids, `min_damage`,
 * `max_damage`, `character_level`, `equipped_weapon` or `herolevel`. What that
 * blocks is the **supplied-gladiator** path only, because
 * `toCanonicalCombatantSource` hard-codes the bag and takes no `resources`
 * option.
 *
 * An **AI-filled slot** has no combat object, so its bag comes from the
 * caller's own template, and `declaredFillResources`
 * (`src/adapter/battle-host.js`) reads `resources` straight off `team.aiFill`
 * — bypassing `CANONICAL_RESOURCE_SOURCES` entirely. So
 * `createVanillaBattleHost({ teams: [...aiFill.resources from ss2Combatant()],
 * rules: ss2TeamRules })` constructs, resolves actions, and emits real vanilla
 * writes with `unmapped: []`.
 *
 * Also corrected: the refusal is NOT `maximumHealth`'s. On the supplied path
 * the throw that actually fires names `max_damage, min_damage` — `staminaleft`
 * and `staminamax` ARE in `CANONICAL_RESOURCE_SOURCES`, so only two of the four
 * required names are missing. Anyone debugging this from the old wording went
 * to the wrong throw.
 *
 * ► **AND THE THROW MOVED AGAIN (2026-09-07), so the paragraph above is now
 *   right about the names and wrong about the moment.** The requirement is
 *   ROLE-BASED: `max_damage`/`min_damage` are demanded of whoever ATTACKS,
 *   from `vanillaRecordOf(view, "attacker")` when the swing resolves — NOT at
 *   construction, and never of a pure defender. So a supplied gladiator on
 *   that path now BUILDS, and fails on its own first swing instead. The
 *   function is `assertDeclaredResources`; `assertRequiredResources` no longer
 *   exists.
 *
 *   ► **THAT WAS AN INTENTION, NOT A MEASUREMENT, AND IT WAS FALSE FOR THE
 *     REST OF THE DAY. Measured and fixed later on 2026-09-07.** A supplied
 *     gladiator did NOT build: a THIRD throw fired ahead of the swing and hid
 *     this one. `battle-host.js` runs `compareMaximumHealth` once per combatant
 *     in its constructor; that diagnostic blanks `maxHealth` on purpose so the
 *     rule set has to DERIVE it, `maximumHealth` here reaches for a `herolevel`
 *     resource `CANONICAL_RESOURCE_SOURCES` does not carry, and the refusal
 *     escaped and killed the host. **So this file's own note sent a reader to
 *     the wrong throw for the third time.** The diagnostic now REPORTS an
 *     underivable formula (`diagnostics.maximumHealthReports[].underivable`)
 *     instead of propagating it, and the paragraph above is true as written.
 *     Both walls are pinned by tests in `test/ss2-adapter-integration.test.js`
 *     so the next reader measures rather than reads.
 *
 * Widening the canonical list is still real work with its own evidence
 * requirements; it is not done here.
 *
 * ## Two honest gaps, named because a silent one would be a lie
 *
 * 1. **First blood is not representable.** The candidate ends a `duel` or
 *    `misc` bout at `hitpoints < hitpointsmax`; the resolver decides
 *    elimination on `health > 0` alone and knows nothing else. Rather than
 *    drop the result event, this rule set THROWS when the arithmetic produces
 *    a first-blood outcome — and that throw is NOT free: it fires after the
 *    action's draws have already advanced the authoritative RNG state and
 *    cursor, which `combatStateHash` covers and `applyAction` cannot roll
 *    back. A caller that catches it holds a battle no replay of the accepted
 *    action log reproduces. So `duel` and `misc` are refused AT CONSTRUCTION
 *    unless the caller passes `fixtureReplay: true`, which is what the golden
 *    replay does; the in-action throw is a backstop behind that gate, not a
 *    routine path.
 *
 *    Worth knowing while reading that: `tournament` — the mode play uses —
 *    was, until 2026-09-02, the one mode of the build's three that no capture
 *    in this repository had ever observed. **That is no longer true**:
 *    `golden-armoured-deflection-threshold-cleared` declares
 *    `fightMode: "tournament"`, so 22 of the 23 goldens are `misc` and one is
 *    not. The mode play uses now has exactly one runtime-verified fixture
 *    behind it, which is one, not coverage.
 * 2. **The AI policy is invented, apart from one gate.** Only
 *    `villainChooseAction`'s unconditional `staminaleft > 10` is byte-decoded.
 *    Target choice and the choice among the three verbs are this module's own.
 *
 * 3. **`weapon_min_damage` / `weapon_max_damage` are unmodelled — but NOT
 *    because they are underivable.** `ss2BattleValues` takes them as
 *    caller-supplied inputs.
 *
 *    **Corrected 2026-09-02.** This gap used to end "so it cannot produce a
 *    gladiator's damage pair from a character record alone", which is wrong,
 *    and wrong in a way that made the gap look closed by nature rather than
 *    open by omission. The build's lookup is
 *    `_root["weapon" + whichcharacter.weapon][3]` and `[4]` (`+0x31be`,
 *    `+0x31da`) — keyed on `weapon`, a field ON the character record, into a
 *    STATIC literal table declared in the same root-frame-35 block
 *    (`weapon24 = Array(3, "Hatchet", 4, 8, 32, 1)` at `+0x41c6`, one entry per
 *    weapon id). So the pair IS derivable from a character record plus a
 *    transcription of build-constant data — data no different in status from
 *    the `_global.<piece>_dval` constants this module already transcribes.
 *
 *    What actually blocks it is two omissions, both closable: `weapon` is not
 *    a declarable field in `SS2_RESOURCE_NAMES`, `CANONICAL_RESOURCE_SOURCES`
 *    or `COMBATANT_KEYS`; and the table is not transcribed ~~into this
 *    repository~~ **INTO CODE — corrected 2026-09-02, because the unqualified
 *    sentence sent the ranked next step off to redo finished work.**
 *    `docs/integration/ss2-item-tables.md` has carried the transcription since
 *    2026-08-30: §2.3 for weapon ids 1-80, §2.4 for id 0 and the nine off-shop
 *    ids, EACH ROW WITH THE INSTRUCTION OFFSET OF ITS OWN LITERAL, and §2.1
 *    for what every array index means. Two rows were re-read from the bytes on
 *    2026-09-02 and matched; the other 88 have never been checked, so what
 *    this module needs first is a MECHANICAL diff of that document against the
 *    build, not a fresh transcription. That document also settles the boundary
 *    question this work runs into — display names are game content and are not
 *    reproduced; items are addressed by id.
 *
 *    Note the battle map has the same hole and is what made the error
 *    reachable: it records `min_damage = round(strength*2) + weapon_min_damage`
 *    and never records where `weapon_min_damage` itself comes from, so anyone
 *    following the standing "derive from the map" rule concludes it is an
 *    input. Corrected there too.
 *
 * 4. **Enchantment DAMAGE is computed and never APPLIED, on both weapons.**
 *    `weapon_enchantment_damage` (`+0x320c`) and
 *    `secondary_weapon_enchantment_damage` (`+0x3326`) are each
 *    `ceil(<max_damage> / 3 * <potency>)`. Both ARE derived below (see
 *    `ss2BattleValues`) and both are in the adapter catalogue
 *    (`src/adapter/vanilla-fields.js`) — an earlier version of this line said
 *    "neither is computed here" and "the catalogue carries only the primary",
 *    which was stale the day `52bc570` landed both. What is still missing is
 *    the APPLICATION: in the build the damage arrives as a status phase that
 *    REPLACES the afflicted combatant's next turn (battle map § "The
 *    enchantment effect is a SKIPPED TURN"), and this rule set has no such
 *    phase — so an enchanted weapon applies a status and deals no magic damage.
 *
 *    Do NOT confuse this with the enchantment PROC, which is modelled and is
 *    correct: the proc gate reads the PRIMARY potency for both weapons, and
 *    `src/golden/ss2-attack-candidate.js`'s `activeEnchantment` documents the
 *    bytes. That pairing has been flagged as a bug once already and is not one.
 *
 * Node builtins only.
 */

import { calculateSs2AttackChances, resolveSs2PhysicalAttackCandidate } from "../golden/ss2-attack-candidate.js";
import { applySs2MagicDamageCandidate } from "../golden/ss2-spell-candidate.js";
import { SS2_BUILD_SHA256 } from "../golden/run-1v1-fixture.js";
import { byCodeUnit } from "../common/stable-order.js";
import { resourceValue } from "./resources.js";
import { ss2WeaponDamageRange, ss2WeaponEntry } from "./ss2-weapon-table.js";
import { defineTeamRuleSet, EffectKind, RuleSetVerification, TeamRuleSetError } from "./rule-set.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clone = (value) => JSON.parse(JSON.stringify(value));

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

/**
 * The action vocabulary. Hyphenated because `actionTypes` tokens must match
 * `/^[a-z0-9][a-z0-9-]{0,63}$/` (`rule-set.js`), which rejects vanilla's
 * underscores. `VANILLA_PHASE_LABEL` keeps the round trip.
 */
export const Ss2ActionType = Object.freeze({
  QUICK_ATTACK: "quick-attack",
  NORMAL_ATTACK: "normal-attack",
  POWER_ATTACK: "power-attack",
  REST: "rest",
  // MOVEMENT. **Direction-ABSOLUTE, because the build's buttons are.** Every
  // controller frame wires `walkleft` and/or `walkright` BY NAME and the player
  // picks a direction, not a relationship to an opponent (battle map, "Buttons
  // wired per controller frame"). A `walk-toward` token would be this engine
  // inventing a decision the build does not offer, and it would lose the case
  // the map is explicit about: `closerange_warrior` wires only the AWAY
  // direction, in both facings.
  //
  // Two of the build's eight movement phases, not all eight. `run*` is
  // reachable only through the taunted chain, which nothing here sets;
  // `charge*` and `jump*` are wired but their displacement is unknown
  // separately from the walk's, and one unmeasured distance is enough. See
  // `ss2WalkDisplacement`, which is `movement_speed * 16` eased to a stop.
  WALK_LEFT: "walk-left",
  WALK_RIGHT: "walk-right",
  // ► **THE SECOND AXIS'S OWN VERBS, AND THEY ARE AUTHORED. The build has no
  //   sidestep.** Its eight movement phases all change x; the jump changes
  //   `_y` too, but it is one named phase that does both and is not this.
  //   `MAP_SILENCE.multi-slot-arena-geometry` already covers a gladiator
  //   standing anywhere but the front line, and these are how it gets there.
  //
  //   Named for the RANK rather than for a direction on screen, because the
  //   screen mapping is the renderer's business and arena y runs backwards
  //   (200 at the front, decreasing away). They carry NO `VANILLA_PHASE_LABEL`
  //   — there is no build phase to name, and inventing one would put a guessed
  //   gait on screen, which is the failure the movement label table exists to
  //   prevent.
  RANK_BACK: "rank-back",
  RANK_FRONT: "rank-front",
  // ► **THE ARCHER'S FOUR VERBS. Every one is the build's own phase, and the
  //   whole set arrives together because none of them works alone.**
  //
  //   `bombard` and `snipe` are the two shots. `bash_attack` is what an archer
  //   does when somebody is standing on top of it — the build gives an archer
  //   NO shot at close quarters and this one melee verb instead. `swap_weapons`
  //   is the turn that arms the bow, and it is a turn rather than a mode
  //   because the build spends one: `getphase("swap_weapons")` is a phase with
  //   its own `staminacost` (`+0x4d35`), reachable only from the inventory
  //   overlay, and root frame 221 starts every gladiator in melee mode.
  //
  //   **Which controller frame wires which is the whole design, and it is a
  //   table in the map** (§"Buttons wired per controller frame", `:227-228`):
  //   `longrange_archer` wires `bombardleft/right` and `snipeleft/right` and NO
  //   melee verb; `closerange_archer` wires `bash_attack` and NO shot. The
  //   selector between them is `fightdistance < 100 + physical_size`
  //   (frame 4 `DoAction@0x238bbf` `+0x015f`), so an archer has a MINIMUM
  //   range and loses the bow inside it. See `legalActions`.
  //
  //   `bash_attack` is `attack_direction` 23 and the two shots are 21 and 22 —
  //   **CONSTANTS, assigned with no RNG call at all** (`+0x64c3`, `+0x6c67`,
  //   `+0x6c8c`), unlike the three melee bands which each draw their direction.
  //   `ATTACK_BANDS` therefore carries a fixed `direction` for these three and
  //   `low`/`high` for the melee bands, and the resolver draws only when the
  //   band says to. Getting that wrong would put a sample on the ordered
  //   channel the build never takes.
  BOMBARD: "bombard",
  SNIPE: "snipe",
  BASH_ATTACK: "bash-attack",
  // ► **`psyche_up` IS THE ONE ACTION HERE THAT IS NOT ALWAYS AN ATTACK, AND
  //   THAT IS WHY IT IS NOT IN `ATTACK_BANDS`.** The phase reads a counter and
  //   plays `psyche_up`, `psyche_up2` or `psyche_up3` for values 1, 2 and >= 3
  //   (`+0x658a`, `+0x65b9`, `+0x65ef`); only the third arm reaches
  //   `checkattackroll`. Presses one and two cost stamina, advance the counter
  //   and roll NOTHING — so a band entry, which means "always attacks", would
  //   put two samples on the ordered channel that the build never takes, and
  //   every peer replaying the same tape would fall out of step from the first
  //   charge onward. It resolves through its own branch; see `PSYCHE_UP_MODEL`.
  PSYCHE_UP: "psyche-up",
  // ► **`taunt` IS THE SECOND ACTION HERE THAT IS NOT ALWAYS AN ATTACK, AND IT
  //   IS NOT IN `ATTACK_BANDS` FOR THE SAME REASON `psyche_up` IS NOT.** The
  //   phase draws `diceroll = randomBetween(1, 100)` (`+0x6921`) and reaches
  //   `checkattackroll` only when that beats `taunt_percentage` AND a second
  //   draw, `taunt_effect = randomBetween(1, 2)` (`+0x6952`), comes up 1. So
  //   three of four outcomes take NO dispatcher samples at all, and a band
  //   entry — which means "always attacks" — would put them on the ordered
  //   channel the build never takes.
  //
  //   **This is exactly why it stayed deferred**: the candidate implements the
  //   post-`checkattackroll` arm and nothing before it, so resolving a taunt
  //   through the ordinary attack path would consume the wrong number of
  //   samples on three outcomes in four. It resolves through its own branch;
  //   see `SS2_TAUNT`.
  TAUNT: "taunt",
  SWAP_WEAPONS: "swap-weapons",
  // The four status phases. FOUR types rather than one `status-phase`, because
  // the build's decision IS the specific label — `getphase("frozen")` and
  // `getphase("poisoned")` are different decisions reaching different arms of
  // the phase (map §"The enchantment effect is a SKIPPED TURN"). One type with
  // the condition hidden in a payload would need `VANILLA_PHASE_LABEL` to map
  // one token to four labels, which is the round trip that table exists to
  // keep. The player never chooses among them: `legalActions` offers exactly
  // one, decided by the build's own priority order.
  FROZEN_PHASE: "frozen-phase",
  BURNING_PHASE: "burning-phase",
  POISONED_PHASE: "poisoned-phase",
  LIFE_STOLEN_PHASE: "life-stolen-phase"
});

/**
 * THE CROWD'S PATIENCE — **AUTHORED IN FULL. Not one number here is the
 * build's, and the crowd framing is vocabulary, not evidence.**
 *
 * See `MAP_SILENCE.crowd-impatience` in `src/adapter/vanilla-fields.js` for
 * what the map does and does not record. The short version, because it is the
 * kind of claim this repository has been wrong about twice this week:
 * `crowd_interest` is a GOLD MULTIPLIER read once on the victory frame
 * (`2249/frame:88` `+0x078c`), `crowd_action` is a per-damage presentation
 * cue, and the `taunttimer` watchdog (`+0x67e4`, 60 ticks) abandons a stuck
 * ANIMATION, not a stalled bout. **Vanilla records no bout-level pressure
 * mechanic.** This is a designed answer to a measured defect, wearing the
 * build's vocabulary because the build has a crowd and it is the natural face
 * for it.
 *
 * THE DEFECT IT ANSWERS, measured 2026-09-10 and written up in
 * `docs/combat-economy-findings-2026-09-10.md`: 4,000 consecutive mutual
 * `rest` actions leave `battle.result === null`. `rest` is stamina-positive
 * AND heals, so two combatants who decline to fight are a fixpoint that both
 * sides strictly improve in, for ever.
 *
 * WHY IT IS A PURE FUNCTION OF `turnNumber` and holds no state of its own:
 * `turnNumber` is already inside `combatStateHash`, so the pressure adds no
 * field to the projection, cannot desync separately from the battle, and
 * cannot be gamed by any action — a rising tide has nothing to exploit. The
 * rule set cannot see the event log anyway (`actorView` hands it
 * `turnNumber`, `actor`, `allies`, `foes` and nothing else), so "reset the
 * crowd when somebody bleeds" would have cost new hashed state. That is a
 * deliberate trade and it is the reason this is 12 lines rather than a
 * subsystem.
 *
 * TERMINATION IS GUARANTEED, not hoped for. Damage grows by 1 each turn past
 * the grace period, so a combatant on `maxHealth` H dies within
 * `ceil((sqrt(8H + 1) - 1) / 2)` turns of the crowd starting, whatever either
 * player does. When it takes the last combatants together, `battleStanding`
 * already returns `ResultReason.DRAW` (`src/team/elimination.js`), so the
 * existing result gate fires and the resolver needed no change at all.
 */
export const SS2_CROWD = Object.freeze({
  /**
   * Turns of grace before the crowd turns on the fighters. AUTHORED, and
   * TUNED AGAINST A MEASUREMENT rather than chosen.
   *
   * ► **THE FIRST VALUE WAS 40 AND THE SECOND WAS 120, AND BOTH WERE TUNED
   *   AGAINST A CONTAMINATED MEASUREMENT. The methodology error is worth more
   *   than the number.** At 40, 85 of 120 seeded bouts paid a toll — 71%,
   *   which makes a backstop into a routine combat mechanic. Raising it to 120
   *   dropped that to 4 of 120, and the longest bout then measured 129 turns
   *   when the same sweep had just reported a maximum of 60.
   *
   *   **The distribution had been shaped by the mechanic being tuned against
   *   it.** At patience 40 the crowd was killing people and ENDING BOUTS
   *   EARLY, so the "max 60" was a measurement of the crowd, not of combat.
   *   Any threshold tuned on it was guaranteed to sit too low, and raising it
   *   revealed a longer tail each time — which reads exactly like converging
   *   on the right answer and is not.
   *
   *   The honest baseline is measured with the toll OFF (`fixtureReplay: true`
   *   disables it): over the same 120 bouts, **min 21, median 50, p95 102,
   *   max 135, and all 120 settle without any crowd at all.** 200 sits past
   *   that tail with headroom, so the crowd is invisible in honest play, while
   *   a standoff at `maxHealth` 250 still closes about 22 turns after it
   *   starts.
   *
   *   **Measure the thing you are about to change WITHOUT the change in
   *   place.** Obvious written down; it was not obvious while doing it, and
   *   the first two numbers here are what that cost.
   *
   * **Re-run it whenever the combat economy moves** — and it is about to, see
   * `docs/combat-economy-findings-2026-09-10.md`, because a strength/stamina
   * rebalance changes bout length directly. The distribution is the number
   * that matters; 200 is downstream of it.
   *
   * ► **RE-RUN 2026-09-11, AND 200 NO LONGER CLEARS THE TAIL. IT IS LEFT AT
   *   200 ON PURPOSE, because every way of fixing it is a design decision and
   *   none of them is a measurement.** Full write-up and the costed options in
   *   `docs/crowd-patience-findings-2026-09-11.md`; reproduce with
   *   `node tools/crowd-patience-sweep.mjs --seeds 30 --cap 3000`, which exits
   *   1 on the finding.
   *
   *   ► **THE 684 BELOW IS WITHDRAWN, and the retraction matters more than the
   *     number.** It came from five invented "archetypes" that were never
   *     checked against the build's own budget: every one declared
   *     `herolevel: 3` — 25 points — while spending 40 to 53, and every one set
   *     `magicka: 0`, below the floor of 1 that `heroDNA` seeds and that has no
   *     refund path. **They cannot exist**, and a four-way design fork was put
   *     to the owner on their behalf before anyone checked.
   *     `tools/stat-vector-reachability.mjs` had implemented that budget for
   *     days. Re-measured over REACHABLE builds only:
   *     **`patience: 200` clears every self-terminating bout with 70% headroom.**
   *
   *   The original, wrong text: *The longest bout that ends on its own is 684
   *   turns (`tank` 1v1, toll out of reach, 30/30 settled), so at 200 the crowd
   *   is the routine cause of death for defensive builds rather than the
   *   invisible backstop this comment promises.*
   *
   *   **THE FINDING THAT SURVIVED RE-MEASUREMENT IS LARGER, NOT SMALLER: this
   *   is not a backstop, it is what makes roughly HALF of all reachable
   *   matchups terminate at all.** Between builds a player can hold, carrying
   *   weapons the measured shop gate permits, **52-63% of CROSS pairings never
   *   end without it** — 1v1, toll out of reach, every level tried.
   *
   *   A D1-class fixpoint reached by FIGHTING rather than by resting, which D1
   *   did not anticipate. Every completed phase heals its ACTOR
   *   `1 + ceil(stamina / 2)` and an attack is a completed phase (`:2530`), so
   *   attacking heals the attacker — while a build that spent its points
   *   anywhere but strength deals single digits. Probed: 28,932 attacks over
   *   15,001 turns ending at 349/350 and 350/350.
   *
   *   **Unlike D1 and D2 this corner is reachable by ordinary progression.** A
   *   level-1 player who puts their points into vitality has made a legitimate
   *   choice and cannot finish a fight. So the comment above that promises a
   *   mechanic "invisible in honest play" is the part that is wrong, not the
   *   value beside it.
   *
   *   **THE INSTRUCTION ABOVE WAS UNRUNNABLE WHEN IT WAS WRITTEN**, which is
   *   the part worth keeping: the 2026-09-10 sweep recorded its results here
   *   and its parameters nowhere, so "re-run it" meant "invent a new sweep".
   *   The numbers in the block above are therefore NOT comparable with the
   *   ones in the findings document, and neither is a movement of the other.
   */
  patience: 200,
  /**
   * Damage per turn past `patience`, per turn. AUTHORED. Linear so the ramp is
   * legible to a player — the first hit is a warning, not a surprise.
   */
  ramp: 1
});

/**
 * Crowd damage owed by an actor acting on `turnNumber`. Pure; 0 during grace.
 *
 * `patience` is a parameter so a sweep can measure honest bout length with the
 * toll out of reach — see `createSs2TeamRules`. It defaults to the shipped
 * constant, so every existing caller is unchanged.
 */
export function ss2CrowdDamage(turnNumber, patience = SS2_CROWD.patience) {
  if (!Number.isFinite(turnNumber)) return 0;
  if (!Number.isFinite(patience)) return 0;
  return Math.max(0, (turnNumber - patience) * SS2_CROWD.ramp);
}

/**
 * WHAT A SWING COSTS — **the one place this engine knowingly departs from the
 * build's combat arithmetic, and the reason is a measured defect rather than
 * taste.**
 *
 * THE DEFECT (`docs/combat-economy-findings-2026-09-10.md`, D2). The build
 * prices a swing on the WIELDER — `power_attack` `staminacost = round(strength
 * * 3)` (`+0x603c`) — and pays it out of the WEAPON — `max_damage =
 * round(strength * 2) + weapon_max_damage` (`+0x3386`). Price and payload are
 * decoupled, so the dominant build minimises the wielder and maximises the
 * weapon. Measured: strength 7 beat strength 30 over 39 actions without losing
 * a point of stamina or health, and once a weapon is equipped strength buys
 * 2-15% of the damage and 100% of the cost.
 *
 * It is cheap, too. `round(strength * 3) <= 1 + round(stamina / 3)` — an
 * attack that is free for ever — is satisfied by **strength 1 and stamina 5**,
 * six stat points. Vanilla's own budget (`13 + 4 * herolevel`) only delays the
 * finished build: at herolevel 15 `str 1 / stam 5 / speed 62` buys weapon 20
 * and swings 678 damage for free, and the shop's purchase gate makes it worse
 * rather than better, because slashing weapons gate on SPEED — the very stat
 * the build dumps into.
 *
 * WHY VANILLA DOES NOT SHOW THIS, and why reproducing it faithfully is still
 * wrong here: vanilla never hands anyone a free stat allocation. Stats are
 * earned slowly against that budget and weapons bought with gold as it grows,
 * so the corner is approached from far away if at all. **This engine lets a
 * blueprint declare anything, which is correct for a multiplayer foundation
 * and is exactly what exposes the corner.** Owner's decision, 2026-09-10:
 * price the swing on the weapon and let strength offset it.
 *
 * THE FIELD IS THE BUILD'S; THE USE IS OURS. `attack_speed` is the weapon
 * table's `[2]` column read straight through by `battlevalues` (`+0x3174`,
 * `+0x346a`), catalogued by the map as derived combat and given NO READER
 * anywhere in it. So there is a real per-weapon number to price with, and
 * nothing that says it prices stamina. That step is authored.
 *
 * ► **AND SO IS THE DIRECTION, WHICH IS THE WEAKEST LINK HERE — read this
 *   before trusting the sign.** `[2]` is an INDEX into `weaponweights`, a
 *   six-entry array whose location is known (`+0x3dd4`,
 *   `ss2-item-tables.md:345`) and **whose VALUES this repository does not
 *   hold**, so nothing here says whether index 1 is the heavy end or the
 *   light one. The inference is from the damage correlation across the whole
 *   table: index 1 spans 80-676 max damage and index 5 spans 3-36, so index 1
 *   is read as HEAVY. If that is backwards, every number below is backwards.
 *   **It is settled by a tool that already exists** — the same
 *   `tools/item-table-transcription.mjs` route that re-reads the ninety weapon
 *   literals out of the installed SWF can read the six `weaponweights` values
 *   at `+0x3dd4`. Until it has, `mass()` is an authored reading of a real
 *   field. See `MAP_SILENCE.swing-cost`.
 */
export const SS2_SWING = Object.freeze({
  /**
   * Entries in `weaponweights` — SIX, of which index 0 is an empty pad and
   * 1..5 are the five weight classes. Map, item-tables §2.1 and the array at
   * `+0x3dd4`.
   *
   * ► **THIS COMMENT SAID "`[2]` indexes it 1..6", AND IT IS 1..5.** Measured
   *   2026-09-11 across all ninety rows of `ss2-weapon-table.js`: the index is
   *   1 for 13 weapons, 2 for 13, 3 for 41, 4 for 14 and 5 for 9. Never 0,
   *   never 6. The arithmetic below was right anyway — `6 - index` maps 1 to 5
   *   and 5 to 1 — but the stated range was not.
   */
  weightIndexMax: 6,
  /**
   * How much strength offsets the swing. AUTHORED. Larger softens the curve.
   * Tuned so a strength-1 gladiator cannot swing the heaviest weapon for free
   * and a strength-60 one nearly can — which is the trade the build's own
   * numbers destroyed.
   */
  strengthOffset: 10,
  /**
   * Scales the whole curve against `nextphase`'s regen. AUTHORED, and CHOSEN
   * BY SEARCH rather than by feel — the search is the defensible part.
   *
   * A swing is "free for ever" when its cost is at or below the phase regen
   * `1 + round(stamina / 3)`, so the question is not whether a sustainable
   * build exists — one always will, and one SHOULD — but what it has to pay
   * for. Sweeping scale 10..30 against vanilla's own stat budget
   * (`13 + 4 * herolevel`) and its shop gate, the free-attack build does not
   * disappear at any value; **it RELOCATES**, and that is the whole point:
   *
   *   before (build's formula) : herolevel 15, str  1 / stam  5 / speed 62 -> 678 dmg
   *   scale 20                 : herolevel 15, str 15 / stam 11 / speed 42 -> 430 dmg
   *                              herolevel 25, str 28 / stam 20 / speed 60 -> 732 dmg
   *
   * A strength-1 gladiator can still swing something indefinitely — a LIGHT
   * weapon, for about 36 damage. Hitting hard and often now costs strength,
   * which is exactly the trade the build's own arithmetic destroyed. 20 is the
   * smallest value that puts the heavy-hitting sustainable build firmly into
   * strength while leaving a light-weapon build viable.
   *
   * **Re-run the search whenever the regen or the budget moves.** The number
   * is downstream of both.
   */
  scale: 20
});

/**
 * A weapon's mass, from its `attack_speed` index. Index 1 is the heavy end, so
 * `mass` runs 5 (heaviest) down to 1 (lightest).
 *
 * ► **THE DIRECTION IS DERIVED, NOT AUTHORED — read off the build 2026-09-11,
 *   and this docstring used to say "AUTHORED DIRECTION".** `weaponweights` at
 *   `+0x3dd4` is six STRINGS, so `attack_speed` is a weight-CLASS index and
 *   never a numeric speed; reversed out of its push order the array runs
 *   `["", <very heavy>, <heavy>, <normal>, <light>, <very light>]`. Index 1 is
 *   the heavy end, so the inference this function was built on was correct.
 *   `tools/item-table-transcription.mjs` now checks it against the installed
 *   build on every run — shape, direction, and the push-order convention
 *   itself, the last confirmed against `weapontypes`, which the item-tables
 *   document pins and §2.2 cross-checks from the ninety rows' own `[0]`.
 *
 *   **It was ranked as the cheapest open question on the board for a day, and
 *   the answer was already in the document that `MAP_SILENCE.swing-cost` cites
 *   for the array's LOCATION** — two lines under the offset, since
 *   `df3a122` on 2026-08-30. The silence entry said the values were not held.
 *   Third instance in this repository of one failure: declaring the map silent
 *   without reading the surrounding paragraph.
 *
 * **NOTHING ELSE ABOUT `ss2SwingCost` BECAME MEASURED.** `SS2_SWING.scale` and
 * `strengthOffset` are still authored, and pricing a swing on the weapon at all
 * is still an owner's decision rather than the build's behaviour.
 */
export function ss2WeaponMass(attackSpeedIndex) {
  const index = Number.isFinite(attackSpeedIndex) ? attackSpeedIndex : SS2_RESOURCE_DEFAULTS.attack_speed;
  return clamp(SS2_SWING.weightIndexMax - index, 1, SS2_SWING.weightIndexMax - 1);
}

/**
 * What one swing costs its wielder.
 *
 * `bandFactor` is the build's own per-band multiplier — 3 for `power_attack`
 * (`+0x603c`), 2 for `normal_attack` (`+0x61a3`), 1 for `quick_attack`
 * (`+0x6317`) — so the RELATIVE price of the three bands is still the build's.
 * What changed is what the factor multiplies: the weapon's mass rather than
 * the wielder's strength, with strength in the denominator so it now BUYS
 * cheaper swings instead of paying for them.
 */
export function ss2SwingCost({ bandFactor, attackSpeed, strength }) {
  const mass = ss2WeaponMass(attackSpeed);
  const str = Number.isFinite(strength) ? Math.max(0, strength) : 0;
  return Math.ceil((bandFactor * mass * SS2_SWING.scale) / (str + SS2_SWING.strengthOffset));
}

/**
 * WHAT THE CAMPAIGN WOULD NEVER HAVE SOLD YOU.
 *
 * **Both constraints here are MEASURED — no invented numbers — and they are
 * the half of the 2026-09-10 economy decision that needs no defending.**
 *
 * 1. THE SHOP'S PURCHASE GATE, byte-verified at
 *    `docs/integration/ss2-item-tables.md:530-552` from the `onRelease`
 *    opcodes at `+0x0929`-`+0x0941`:
 *
 *      `3 * band_position <= hero.speed`     for slashing (1-20) and ranged (61-80)
 *      `3 * band_position <= hero.strength`  for hacking (21-40) and bashing (41-60)
 *
 *    where `band_position` is `((id - 1) % 20) + 1`. Weapon slots are
 *    attribute-gated and **not level-gated at all**.
 *
 * 2. RANGED IS NEVER A PRIMARY. `buyweapon` routes a ranged purchase to
 *    `secondary_weapon` (`ss2-item-tables.md:826-828`), so the 18 rows with a
 *    range multiplier of 100 can never reach the primary slot. Without this a
 *    `weapon_range` in the thousands makes any distance check a tautology.
 *
 * WHY ENFORCE IT HERE. Vanilla never hands anyone a free allocation — stats
 * are earned against `13 + 4 * herolevel` and weapons bought with gold as that
 * budget grows — so the degenerate corner is approached from far away if at
 * all. This engine lets a blueprint declare anything, which is correct for a
 * multiplayer foundation and is exactly what exposes the corner.
 *
 * **AND MEASURED HONESTLY: THIS DOES NOT CLOSE D2 ON ITS OWN, which is why the
 * swing was repriced as well.** Searched across the budget at every herolevel:
 * importing the gate kills the pure dump build (strength 1 / speed 0 can buy 4
 * of 80 weapons, best 34 damage) but at herolevel 15 `str 1 / stam 5 /
 * speed 62` still buys weapon 20 and swings 678 damage for free — because
 * slashing gates on SPEED, the very stat that build dumps into. **The gate
 * channels the exploit rather than restraining it.** An independent design
 * panel judged that it "restores the trade"; re-derived here, it does not.
 */
export const SS2_SHOP_GATE = Object.freeze({ stepPerBand: 3, bandSize: 20 });

/** Which stat gates a weapon id, by band. Item-tables:530-533. */
export function ss2WeaponGateAttribute(weaponId) {
  if (!Number.isFinite(weaponId)) return null;
  if (weaponId >= 1 && weaponId <= 20) return "speed";
  if (weaponId >= 21 && weaponId <= 40) return "strength";
  if (weaponId >= 41 && weaponId <= 60) return "strength";
  if (weaponId >= 61 && weaponId <= 80) return "speed";
  return null;
}

/** `3 * band_position`, the `itemlevel` the gate compares against. */
export function ss2WeaponDemand(weaponId) {
  if (!Number.isFinite(weaponId)) return null;
  return SS2_SHOP_GATE.stepPerBand * (((weaponId - 1) % SS2_SHOP_GATE.bandSize) + 1);
}

/** True for the ranged band, which `buyweapon` never puts in the primary slot. */
export function ss2WeaponIsRanged(weaponId) {
  return Number.isFinite(weaponId) && weaponId >= 61 && weaponId <= 80;
}

/**
 * Refuses a primary weapon the shop would not have sold this gladiator.
 *
 * Checked only when a `weapon` id is STATED. A combatant that declares its
 * damage pair directly — every promoted golden — states no weapon id and is
 * untouched, which is what keeps the corpus out of this entirely.
 */
export function assertSs2WeaponPurchasable(source, label = "Combatant") {
  const weaponId = source?.weapon;
  if (!Number.isFinite(weaponId)) return;
  if (ss2WeaponIsRanged(weaponId)) {
    throw new TeamRuleSetError(
      `${label} declares weapon ${weaponId} as its PRIMARY, and ids 61-80 are the ranged band. ` +
      "`buyweapon` routes a ranged purchase to `secondary_weapon` (ss2-item-tables.md:826-828), so no " +
      "gladiator in the build can carry one in the primary slot. Declare it as `secondary_weapon`."
    );
  }
  const attribute = ss2WeaponGateAttribute(weaponId);
  if (attribute === null) return;
  const demand = ss2WeaponDemand(weaponId);
  const have = Number.isFinite(source[attribute]) ? source[attribute] : 0;
  if (demand > have) {
    throw new TeamRuleSetError(
      `${label} declares weapon ${weaponId}, which the shop gates at ${attribute} >= ${demand} ` +
      `(3 * band_position; ss2-item-tables.md:530-552, onRelease +0x0929) and it declares ${attribute} ` +
      `${have}. The campaign would never have sold it this weapon.`
    );
  }
}

/**
 * TURN ORDER — sides ALTERNATE, and this is a fidelity gain rather than a
 * divergence.
 *
 * THE DEFECT (`docs/combat-economy-findings-2026-09-10.md`, D3). The
 * resolver's default `initiativeOrder` is a FLAT agility-descending sort
 * across BOTH teams, so a side whose fighters all out-run the enemy's acts
 * three times before the enemy acts at all — measured:
 * `FAST -> FAST -> FAST -> SLOW -> SLOW -> SLOW`. At 3v3 that is a third of
 * the opposing side removed before the bout is joined.
 *
 * **The flat sort is AUTHORED, not the build's**, and `roster.js`'s own
 * comment has said so all along: *"SS2 does not sort initiative at all —
 * `changeCombatants` alternates. Turn order in a team battle is the
 * resolver's, not the build's."* So alternating is the fix AND a step toward
 * the build.
 *
 * WHAT IS STILL AUTHORED, because vanilla has no second ally and so cannot
 * settle it (`MAP_SILENCE.initiative-order`):
 *
 * - **Who opens.** The side holding the single fastest gladiator, ties broken
 *   by team id so two peers cannot disagree. Agility therefore still buys
 *   something real — the first action of the bout — but it buys a LEAD, never
 *   a free round, which is the whole distinction D3 turns on.
 * - **Order within a side**: agility descending, then id ascending, which is
 *   the resolver's own rule kept verbatim.
 * - **Uneven sides** (1v3): interleave until the short side runs out, then the
 *   remainder in order. A 1v3 therefore does NOT give the lone fighter every
 *   other turn for the whole bout, which would be a much larger invention than
 *   the one being fixed.
 */
function ss2InitiativeOrder(teams) {
  const ordered = teams.map((team) =>
    [...team.combatants]
      .slice()
      .sort((a, b) => b.stats.agility - a.stats.agility || byCodeUnit(a.id, b.id))
  );

  // Who opens: the side holding the single fastest gladiator. `sort` above
  // already put it first in each side, so this is a comparison of two heads.
  const headAgility = (side) => (side.length > 0 ? side[0].stats.agility : -Infinity);
  const headId = (side) => (side.length > 0 ? side[0].id : "");
  let lead = 0;
  if (ordered.length === 2) {
    const byAgility = headAgility(ordered[1]) - headAgility(ordered[0]);
    // Ties break by the head's id rather than by team index, so the answer
    // does not depend on which order the caller listed the teams in.
    if (byAgility > 0 || (byAgility === 0 && byCodeUnit(headId(ordered[1]), headId(ordered[0])) < 0)) lead = 1;
  }

  const sides = lead === 1 ? [ordered[1], ordered[0]] : ordered;
  const interleaved = [];
  const longest = Math.max(0, ...sides.map((side) => side.length));
  for (let rank = 0; rank < longest; rank += 1) {
    for (const side of sides) if (side[rank]) interleaved.push(side[rank].id);
  }
  return interleaved;
}

/** Action token -> the `getphase` label the build knows it by. */
export const VANILLA_PHASE_LABEL = Object.freeze({
  [Ss2ActionType.QUICK_ATTACK]: "quick_attack",
  [Ss2ActionType.NORMAL_ATTACK]: "normal_attack",
  [Ss2ActionType.POWER_ATTACK]: "power_attack",
  [Ss2ActionType.REST]: "rest",
  // The build's own spellings — `walkleft` `+0x3b37`, `walkright` `+0x3d16`,
  // one word, no underscore, unlike the attack phases beside them. **The
  // movement event carries this onto the wire**, because the presentation
  // bindings cannot derive a gait from the geometry: `to < from` gives the
  // direction and nothing separates a walk from a charge. See
  // `src/adapter/presentation.js`, the movement case.
  [Ss2ActionType.WALK_LEFT]: "walkleft",
  [Ss2ActionType.WALK_RIGHT]: "walkright",
  // ► **THE RANGED PHASES ARE HANDED IN THE BUILD AND THE CLIP IS NOT**, and
  //   conflating the two would play the wrong animation.
  //
  //   The build has FOUR phase labels — `bombardleft`, `bombardright`,
  //   `snipeleft`, `sniperight` — which `longrange_archer` wires by facing.
  //   All four fall into ONE branch (`+0x6b53`-`+0x6b9d`), and that branch
  //   calls `attacker.gotoAndPlay("bombard")` (`+0x6c52`) or
  //   `gotoAndPlay("snipe")` (`+0x6c77`): **unhanded**. So the phase name has a
  //   side and the clip does not, and it is the clip the presentation needs.
  //
  //   These entries are therefore the UNHANDED spellings, because this table
  //   feeds `src/render/clip-labels.js` and the fighter clip carries exactly
  //   `bombard` and `snipe` among its 101 `FrameLabel`s — no handed variant of
  //   either exists to play.
  [Ss2ActionType.BOMBARD]: "bombard",
  [Ss2ActionType.SNIPE]: "snipe",
  // `bash_attack` `+0x6463`, one word with an underscore like the melee verbs
  // beside it. **Its CLIP is `Attack2`** (`+0x64ce`,
  // `attacker.gotoAndPlay("Attack2")`) — derived, not guessed, and it is the
  // reason `src/adapter/presentation.js` no longer reports a nonexistent
  // `attack23` for direction 23.
  [Ss2ActionType.BASH_ATTACK]: "bash_attack",
  // ► **THE PHASE IS HANDED NOWHERE AND THE CLIP IS CHOSEN BY THE COUNTER.**
  //   Every controller frame wires the single label `psyche_up` (`+0x0dec` and
  //   `+0x127e` on frame 5, `+0x0b8b` and `+0x0f95` on frame 13), so there is
  //   one phase name. **The animation is NOT derivable from it**: the branch
  //   picks `psyche_up`, `psyche_up2` or `psyche_up3` from the counter, which
  //   is why the resolved event carries the clip separately and why
  //   `attackLabel(30)` in the presentation layer refuses to name one.
  [Ss2ActionType.PSYCHE_UP]: "psyche_up",
  // ► **THE PHASE LABEL IS `taunt` AND THE TARGET'S CLIP IS `taunted`**, which
  //   are two different names for one decision — the build plays both from the
  //   same branch and BEFORE the roll (`+0x6905` the actor, `+0x690c` the
  //   target), so a FAILED taunt still animates. The target's label is the
  //   presentation layer's, not a phase.
  [Ss2ActionType.TAUNT]: "taunt",
  [Ss2ActionType.SWAP_WEAPONS]: "swap_weapons",
  // Three spellings for one effect, and the map is explicit that they are not
  // interchangeable: the FIELD is `poison`, the DECISION label is `poisoned`,
  // and `life_stolen` keeps its spelling as a decision but reaches
  // `magic_damage_character` as `"lifesteal"`.
  [Ss2ActionType.FROZEN_PHASE]: "frozen",
  [Ss2ActionType.BURNING_PHASE]: "burning",
  [Ss2ActionType.POISONED_PHASE]: "poisoned",
  [Ss2ActionType.LIFE_STOLEN_PHASE]: "life_stolen"
});

/**
 * The status phase each condition flag forces, in the build's own priority
 * order — frozen, burning, poison, life_stolen — which is the order the four
 * sequential `if`s appear in.
 *
 * **The FIRST match wins, and that is a correction the map itself carried
 * backwards until 2026-09-07.** The hero writes its decision by CALLING
 * `getphase`, which runs only at `turnphase == 1` and sets `turnphase = 2` on
 * success, so the first matching status takes the turn and every later one is a
 * silent no-op — while still having cleared its flag. (The VILLAIN assigns
 * `villaindecisionA` directly with no such gate, so on that side the last match
 * wins; a symmetric multiplayer engine cannot have both, and the hero's rule is
 * the player's rule.)
 */
/**
 * The `damage_method` each status arm passes to `magic_damage_character` —
 * which is NOT always the decision label.
 *
 * "Three spellings for one effect, and they are not interchangeable": the FIELD
 * is `poison`, the DECISION label is `poisoned`, and `life_stolen` keeps its
 * spelling as a decision but reaches the ingress as **`lifesteal`**. Passing
 * the decision label straight through got that last one wrong — caught by an
 * independent review. The argument is the defender clip's animation label and
 * is read exactly once, so it changes no number; it is the ingress's recorded
 * identity, and a wrong one misdescribes what happened.
 */
export const SS2_STATUS_DAMAGE_METHOD = Object.freeze({
  frozen: "frozen",
  burning: "burning",
  poison: "poisoned",
  life_stolen: "lifesteal"
});

export const SS2_STATUS_PHASE_FOR_FLAG = Object.freeze({
  frozen: Ss2ActionType.FROZEN_PHASE,
  burning: Ss2ActionType.BURNING_PHASE,
  poison: Ss2ActionType.POISONED_PHASE,
  life_stolen: Ss2ActionType.LIFE_STOLEN_PHASE
});

const SS2_FLAG_FOR_STATUS_PHASE = Object.freeze(
  Object.fromEntries(Object.entries(SS2_STATUS_PHASE_FOR_FLAG).map(([flag, type]) => [type, flag]))
);

/**
 * How a status remembers WHO inflicted it: `"burning:from=villain"`.
 *
 * The build never needs this. Its status tick reads the damage off
 * `game_defender` — literally "the other gladiator" — which is unambiguous
 * only because vanilla is 1v1. This engine runs 2v2 and 3v3, where "the other
 * gladiator" names nobody, so the status carries its source and the tick reads
 * THAT combatant's enchantment damage. **At 1v1 the two coincide exactly, so
 * every measured fixture is unaffected** (owner's decision, 2026-09-07).
 *
 * A bare flag with no source is still legal and means "afflicted, inflictor
 * unknown" — a battle that STARTS with a condition, which vanilla cannot
 * produce. Such a tick costs the turn and clears the flag but applies no
 * damage, because no enchantment damage exists to read.
 */
export const SS2_STATUS_SOURCE_SEPARATOR = ":from=";

/** `("burning", "villain")` -> `"burning:from=villain"`; a null source -> `"burning"`. */
export function ss2StatusToken(flag, sourceId = null) {
  return sourceId === null || sourceId === undefined
    ? flag
    : `${flag}${SS2_STATUS_SOURCE_SEPARATOR}${sourceId}`;
}

/** The condition a status token names, ignoring any source. */
export function ss2StatusFlagOf(token) {
  const at = token.indexOf(SS2_STATUS_SOURCE_SEPARATOR);
  return at === -1 ? token : token.slice(0, at);
}

/** The combatant id a status token blames, or null if it names none. */
export function ss2StatusSourceOf(token) {
  const at = token.indexOf(SS2_STATUS_SOURCE_SEPARATOR);
  return at === -1 ? null : token.slice(at + SS2_STATUS_SOURCE_SEPARATOR.length);
}

/** The exact token carrying `flag` on this status list, or null. */
function statusTokenFor(status, flag) {
  for (const token of status ?? []) if (ss2StatusFlagOf(token) === flag) return token;
  return null;
}

/** Whether this status list carries `flag`, whoever inflicted it. */
function hasStatusFlag(status, flag) {
  return statusTokenFor(status, flag) !== null;
}

/**
 * The condition that takes this combatant's turn, or null.
 *
 * FIRST match in the build's own order. The four `if`s are sequential rather
 * than an `else if` chain, so every set flag is CONSUMED — but only the first
 * reaches `getphase` while `turnphase == 1`, and the rest are silent no-ops.
 */
function forcedStatusFlag(actor) {
  for (const flag of SS2_DEATH_CLEAR_FLAGS) {
    if (hasStatusFlag(actor.status ?? [], flag)) return flag;
  }
  return null;
}

/**
 * Clearing EVERY condition the forced chain walked past, not just the one that
 * played.
 *
 * This is the surprising half of the build's behaviour and the reason the
 * chain is worth reproducing statement by statement: each `if` clears its own
 * flag BEFORE calling `getphase`, so a gladiator carrying frozen + burning
 * plays frozen and loses the burning outright — and a gladiator forced to rest
 * at zero stamina loses BOTH without playing either. The map states it
 * plainly: "a forced rest at zero stamina clears and discards a pending
 * `burning` phase in the same pass".
 */
function statusConsumptionEffects(actor, flags = SS2_DEATH_CLEAR_FLAGS) {
  const wanted = new Set(flags);
  const effects = [];
  // EVERY token, not one per flag. Two tokens can name the same condition with
  // different inflictors (`burning:from=hero` and `burning:from=villain`) —
  // `normaliseStatus` dedupes identical STRINGS, not conditions, so both
  // survive construction. Clearing only the first left the survivor to force
  // another turn: "every set flag is cleared" would have been false for the one
  // case where it matters. Found by an independent review.
  for (const token of actor.status ?? []) {
    if (!wanted.has(ss2StatusFlagOf(token))) continue;
    effects.push({ kind: EffectKind.STATUS, targetId: actor.id, status: token, active: false });
  }
  return effects;
}

/**
 * The three melee bands, with the direction draw and the `staminacost` each
 * branch sets. Both columns are byte-verified; the offsets are the map's.
 *
 * | token | direction draw | `staminacost` |
 * | --- | --- | --- |
 * | `quick-attack`  | `randomBetween(1, 4)`  `+0x635c` | `round(strength)`     `+0x6317` |
 * | `normal-attack` | `randomBetween(5, 8)`  `+0x61f1` | `round(strength * 2)` `+0x61a3` |
 * | `power-attack`  | `randomBetween(9, 12)` `+0x608a` | `round(strength * 3)` `+0x603c` |
 */
/* ------------------------------------------------------------------ */
/* Arena geometry                                                      */
/* ------------------------------------------------------------------ */

/**
 * WHERE GLADIATORS STAND.
 *
 * ► **THIS USED TO SAY "AND HOW FAR A STEP CARRIES THEM", and that the fourth
 *   of four numbers here was "the only unmeasured number this rule set's
 *   movement adds". Both clauses are gone (2026-09-11): the step is
 *   `ss2WalkDisplacement`, derived from the build, and it is per-actor rather
 *   than a constant, so it does not belong in a frozen table at all.** What is
 *   left here is geometry — where the build puts a gladiator and what bounds it
 *   — plus one pin on the derivation's floor case.
 *
 * `allyStride` remains AUTHORED, because vanilla has no second ally
 * (`MAP_SILENCE.multi-slot-arena-geometry`), and `clamp` remains the build's
 * number only as far as this repository knows — read its caveat before citing
 * it.
 */
export const SS2_ARENA = Object.freeze({
  /**
   * Map, "Battle entry" step 5: the runtime clips are placed at `(-250, 200)`
   * and `(250, 200)`, hero facing right and villain facing left. So the
   * separation at construction is 500 — which
   * `docs/integration/ss2-champion-dna.md:710-712` states independently, from
   * `getfightdistance`, and which `src/adapter/slot-layout.js`'s
   * `VANILLA_FRONT_X` already ships for the presentation side.
   */
  frontX: 250,
  /**
   * The `_y` both vanilla clips are constructed at — map, "Battle entry" step
   * 5, `(-250, 200)` and `(250, 200)`. **DERIVED, not authored**: it is the
   * same line `frontX` comes from, and `src/adapter/slot-layout.js`'s
   * `ARENA_Y` already ships it for the presentation side.
   *
   * It is the front rank, and the only rank vanilla has. A gladiator standing
   * anywhere else on this axis is authored mod surface
   * (`MAP_SILENCE.multi-slot-arena-geometry`) — but how far apart two unlevel
   * gladiators then ARE is the build's own answer, because `getfightdistance`
   * is Euclidean over `(_x, _y)`. See `ss2FightDistance`.
   *
   * ► **AND THE BORROWING IS NOT FREE: vanilla spends `_y` on the JUMP ARC,
   *   not on depth.** 200 is the ground, and in the build a gladiator leaves it
   *   only by leaping. This engine reuses the same number as a rank datum,
   *   which is coherent exactly as long as nothing jumps. See the
   *   height-versus-depth block in `ss2FightDistance` before wiring one.
   */
  frontY: 200,
  /**
   * How many ranks the arena has. AUTHORED, and it matches the adapter's
   * `MAX_SLOTS_PER_SIDE` on purpose — the presentation can lay out three slots
   * a side and no more, so a fourth rank would be a position nothing can draw.
   *
   * It is a property of the ARENA rather than of the roster, so a 1v1 played
   * with the second axis on can still use all three. With the axis OFF the
   * rank verbs are never offered at all and 1v1 is untouched either way.
   */
  rankCount: 3,
  /**
   * How far apart consecutive ranks stand, and **the owner picked it by
   * playing the arena on 2026-09-12: "97 looks great, 150 is too far."**
   *
   * It is not a tuned number either: 97 is
   * `floor(sqrt(reach^2 - physical_size^2))` at the demo roster's strength 9 —
   * the exact depth at which a second rank leaves the front rank's reach. One
   * rank back is a real position; two is a different fight.
   *
   * Measured at this value, 24 seeds, 3v3: every bout settles, blows through a
   * living body fall from 44.7% to 15.0%, can-hit-every-foe from 41.0% to
   * 13.6%, and there are two simultaneous fights on 463 turns where one was
   * geometrically impossible. At 150 there are three, and 15 of 24 bouts
   * stopped settling before the rank verbs existed — which is what "too far"
   * looks like in the numbers.
   *
   * **`createSs2TeamRules({ rankStride: 0 })` is still the one-dimensional
   * engine**, and it is how the before-picture is reproduced.
   */
  rankStride: 97,
  /**
   * AUTHORED, and it matches the adapter's `ALLY_X_STRIDE` on purpose: vanilla
   * has no second ally, so nothing can settle it (`MAP_SILENCE`,
   * `multi-slot-arena-geometry`). Allies stand FURTHER OUT than slot 0, so
   * slot 0 keeps the vanilla pair exactly and 1v1 stays the parity case.
   */
  allyStride: 130,
  /**
   * Map, `nextphase` step 1. **Read the caveat before citing this.** The map
   * states the bound in PROSE with no byte offset anywhere in the repository,
   * while the only line carrying offsets for the clamp — the four `_x` `If`s
   * at `+0x31cc`, `+0x31f8`, `+0x3224`, `+0x3250` — states no literals at all.
   * It is the build's number as far as this repository knows and no further.
   */
  clamp: Object.freeze({ min: -2100, max: 2100 }),
  /**
   * ► **NO LONGER AUTHORED, AND NO LONGER WHAT A WALK MOVES. DERIVED
   *   2026-09-11; the key was renamed from `walkDistance` so that every reader
   *   of the old name fails loudly instead of quietly reading one case of a
   *   law.**
   *
   * 44 is `ss2WalkDisplacement(4)` — the displacement of one completed walk
   * phase at the `movement_speed` clamp FLOOR with no boots — read out of the
   * walk branches of overlay frame 52. The derivation, the offsets and the
   * easing tween that turns a `movement_speed * 16` destination into a realised
   * 44 are all in `ss2WalkDisplacement`'s docstring. **A walk is per-actor from
   * here on**: `movement_speed` 12 walks 172.
   *
   * This value is kept for exactly two jobs, and neither is "how far a walk
   * goes": it is the slowest walk the build can produce, which makes it the
   * worst case for any pacing bound; and it is the pin that proves the
   * derivation still reproduces the figure the project held for nine days.
   *
   * **THE HISTORY IS KEPT BECAUSE IT IS THE INSTRUCTIVE PART.** 44 entered this
   * repository through one uncited line in a frozen handoff
   * (`docs/handoffs/2026-09-02-1659--three-waves-cut-at-the-usage-limit.md:194`,
   * *"one walk is 44 px"*), and an adversarial reader proposed it was a
   * conflation with the range multiplier in
   * `weapon_range = physical_size + weapon[5] * 44`. **That reader was wrong and
   * the uncited line was right** — the two 44s are unrelated, and the walk's
   * falls out of `64 - 20` where 64 is `4 * 16` and 20 is the tween's stop
   * tolerance. Being right by luck is still not evidence, which is why it sat
   * under `MAP_SILENCE.movement-displacement` for nine days; what closed it was
   * reading the bytes, and the bytes were always readable.
   */
  walkDistanceAtSpeedFloor: 44
});

/**
 * `fightdistance` — the rounded EUCLIDEAN separation of two gladiators.
 *
 * ► **THIS WAS RECORDED AS "THE ROUNDED X-SEPARATION" IN FOUR PLACES, AND THE
 *   BUILD'S OWN FUNCTION IS TWO-DIMENSIONAL. Corrected 2026-09-12 by reading
 *   the oracle.** The two offsets this docstring has always cited are both
 *   REAL — and the `ydist` computation sits BETWEEN them, and was never read.
 *   **Fifth instance of this project's signature failure: a correct offset
 *   whose neighbouring instructions hold the answer.** (The other four:
 *   `ss2Reach`'s half-a-wrapped-line docstring, `MAP_SILENCE.movement-displacement`,
 *   the `fightdistance` "no writer at all" claim, and the `physical_size`
 *   conflation. The pattern is not a stale note — it is a citation that was
 *   never re-opened.)
 *
 * `getfightdistance`, `sprite:2249/frame:1/DoAction@0x6e421b`, re-derived in
 * full with `node tools/inspect-swf.mjs <oracle> --function getfightdistance`:
 *
 * ```text
 *   +0x02c4  branch on hero._x < villain._x        (Less2; Not; If)
 *   +0x02ff  xdist = Math.round(<far>._x - <near>._x)     the two arms, so
 *   +0x0395    "     "                                    xdist is round(|dx|)
 *   +0x0338  ydist = Math.round(<far>._y - <near>._y)     constant[9] = "_y"
 *   +0x03de    "     "
 *   +0x0427  fightdistance = Math.round(Math.sqrt(xdist*xdist + ydist*ydist))
 *   +0x0467  midwaypoint   = Math.round(fightdistance / 2)
 * ```
 *
 * **AND `_y` GENUINELY VARIES, so the second term is not dead code.** The jump
 * stores `attacker.grounded = attacker._y` and then walks `_y` away from it,
 * landing when `_y` is no longer less than `grounded` (`sprite:862[overlay]/
 * frame:52/DoAction@0x240c7f`, `+0x3807`..`+0x3823`). The build's own tooltip
 * says so in words: *"The **height** and distance of your jump is determined by
 * your agility"* (`sprite:862/frame:5/DoAction@0x238de2` `+0x0b9c`). So during a
 * jump the build's `fightdistance` is a true hypotenuse.
 *
 * ## ► THE BUILD'S `_y` IS HEIGHT. THIS ENGINE'S `y` IS DEPTH. THEY ARE NOT
 * ## THE SAME AXIS, AND RIGHT NOW THEY SHARE A FIELD.
 *
 * **Read this before implementing `jump`, `run` or `charge`. It is the one
 * hazard the second axis created that nothing in the suite can catch yet, and
 * it is cheap to fix now and expensive after a jump exists.**
 *
 * Flash has ONE `_y` per clip and vanilla spends it on the leap arc: `leap` is
 * clamped to `[8, 36]` and is NEGATIVE (up the screen), the landing test is
 * `_y < grounded`, and `getfightdistance` counts it — which is the whole
 * reason the formula above is a hypotenuse. **In vanilla, a bigger `ydist`
 * means "one of us is in the air".**
 *
 * `combatant.y` in this engine means something else entirely: which RANK you
 * stand in, depth into the arena, `frontY - rankStride * k`. That is authored
 * mod surface (`MAP_SILENCE.multi-slot-arena-geometry`) and vanilla has no
 * such quantity at all.
 *
 * **Both currently reach this function through the same term.** Nothing is
 * wrong today, because no phase in this engine moves a gladiator vertically —
 * `jump*` is unwired. The moment one does, a fighter one rank back (97) and a
 * fighter mid-leap (36) become indistinguishable to every reach gate, and a
 * jump will read as a lane change.
 *
 * **The fix, when jump lands, is THREE named axes and not two**: `x` along the
 * arena, `y` depth, and a separate height, with the metric combining all
 * three. Vanilla already counts height in fight distance, so keeping it in is
 * the faithful choice; depth is the invented term and is the one that has to
 * justify itself.
 *
 * The projection key-list pin in `ss2-team-rules.test.js` is the tripwire: a
 * `height` field added to the combatant breaks it, which forces whoever adds
 * it to read this paragraph rather than discover the conflation in play.
 *
 * ## What this means, stated narrowly, because the temptation is to overclaim
 *
 * The METRIC is derived and is the build's. **Where a gladiator STANDS is
 * still one-dimensional in vanilla** — both clips are constructed at `_y = 200`
 * ("Battle entry" step 5) and a standing fighter never leaves it, so
 * `MAP_SILENCE.multi-slot-arena-geometry` still governs where a second ALLY
 * stands and that remains authored mod surface. What is no longer authored is
 * how far apart two gladiators are once they are not level.
 *
 * **The reduction is exact, which is why this rewrite moves nothing.** With
 * `ydist === 0`, `round(sqrt(xdist^2))` is `xdist`, and `xdist` is already
 * `round(|dx|)` — the previous body exactly. Verified over 30,005 offsets
 * including the negative-half-integer case (`Math.round(-2.5) === -2`).
 *
 * ► **THE FIRST VERSION OF THIS FUNCTION TOOK `Math.abs` OF BOTH COMPONENTS,
 *   AND THIS PARAGRAPH ASSERTED THAT WAS THE BUILD'S OWN SHAPE. IT IS NOT.
 *   Broken by `/adversarial-review` within the hour, re-derived here against
 *   the oracle before it was believed.** What it said:
 *
 *     ~~"the build branches so that it always subtracts the smaller from the
 *     larger, so the absolute value comes FIRST and the rounding second."~~
 *
 *   **That is true of `xdist` and false of `ydist`.** The `Less2; Not; If` at
 *   `+0x02f8` tests `hero._x < villain._x` and selects the operand order for
 *   BOTH subtractions — so `xdist` is non-negative by construction, while
 *   `ydist` is whatever that same order gives, sign included. `Math.round`
 *   then rounds a possibly-negative value, and JS rounds a negative
 *   half-integer toward +infinity: `round(-129.5)` is -129, while
 *   `round(|-129.5|)` is 130. Squaring hides the sign but not the rounding.
 *
 *   Measured divergence: **479 disagreeing pairs over a half-integer sweep,
 *   and ZERO of them at integer y.** So it moved no number this engine can
 *   produce — every `y` a rule set assigns is `frontY - rankStride * k`, both
 *   integers — and it was still wrong, because the claim was about the BUILD
 *   and not about the reachable inputs.
 *
 *   **This is the same error the rest of this docstring convicts four files
 *   of**: checking one half of a thing and generalising to the half that was
 *   not checked. The branch really does make `xdist` positive. Nothing makes
 *   `ydist` positive, and I wrote a sentence saying the branch did both.
 *
 * `y` is absent on every combatant today and reads as 0, so every caller gets
 * the 1-D answer until a rule set gives gladiators a second coordinate.
 *
 * Null when either side models no position, so a caller can tell "not
 * modelled" from "standing on top of each other".
 */
export function ss2FightDistance(a, b) {
  if (!Number.isFinite(a?.x) || !Number.isFinite(b?.x)) return null;
  const ay = Number.isFinite(a?.y) ? a.y : 0;
  const by = Number.isFinite(b?.y) ? b.y : 0;
  // ► **THE BRANCH IS ON X AND IT SELECTS THE OPERAND ORDER FOR BOTH
  //   COMPONENTS.** `xdist` is therefore never negative; `ydist` IS SIGNED,
  //   because nothing about the branch orders the y pair. Corrected 2026-09-12
  //   after `/adversarial-review` broke the first version of this function —
  //   see the docstring's own correction block for what I wrote and why it was
  //   wrong.
  const forward = a.x < b.x;
  const xdist = Math.round(forward ? b.x - a.x : a.x - b.x);
  const ydist = Math.round(forward ? by - ay : ay - by);
  return Math.round(Math.sqrt(xdist * xdist + ydist * ydist));
}

/**
 * HOW BIG A GLADIATOR IS — `physical_size = 80 + round(strength / 1.5)`,
 * `battlevalues` `+0x30f1`. Re-read off the installed build 2026-09-11:
 * `Push register:3, "physical_size", 80, register:3, "strength"`, then
 * `Push 1.5; Divide; Math.round; Add2; SetMember`.
 *
 * **This is the DEFENDER's quantity in the build's walk clamp** and it is not
 * the same number as `ss2Reach`. Keeping them as one function is what deadlocked
 * the faithful clamp; see `ss2WalkDestination`.
 *
 * It is derived from `stats.strength` rather than carried as a resource for the
 * reason `ss2MovementSpeed` is: the map's persistence table (`:698`) lists
 * `physical_size` among the fields "recomputed unconditionally", so it is a
 * `battlevalues` OUTPUT and never a stored pool.
 */
export function ss2PhysicalSize(actor) {
  return 80 + Math.round((actor?.stats?.strength ?? 0) / 1.5);
}

/**
 * The build's range step: one point of a weapon's `[5]` multiplier is 44 arena
 * units (`battlevalues` `+0x31b3`, `Push 44; Multiply`).
 *
 * **Unrelated to `SS2_ARENA.walkDistanceAtSpeedFloor`, which is also 44.** An
 * adversarial reader once proposed the walk's 44 was a conflation with this one
 * and was wrong; the two are named separately here so that the coincidence can
 * never be read as a shared origin. This one is `weapon[5] * 44`; that one is
 * `4 * 16` eased to a stop with 20 left to run.
 */
export const SS2_WEAPON_RANGE_STEP = 44;

/**
 * HOW MANY SHOTS A BOW HOLDS — `maximum_ammo`, tiered by `herolevel`.
 *
 * **Re-read off the installed build 2026-09-13** (`77cb545c…`, the same oracle
 * every golden cites) with the project's own inspector rather than copied from
 * the map's prose, because this table is the whole of the ammunition economy
 * and a transcription error in it is a balance change nothing would catch:
 *
 * ```
 * node tools/inspect-swf.mjs "$ss2Install/swf/swords_sandals2_download.swf" \
 *   --references 'maximum_ammo' --around 6 --max-actions 400
 * ```
 *
 * ```text
 *   herolevel <  9  ->  5    +0x364b
 *   herolevel < 23  -> 10    +0x368e
 *   herolevel < 28  -> 15    +0x36d1
 *   herolevel < 35  -> 20    +0x3714
 *   herolevel < 45  -> 25    +0x3757
 *   otherwise       -> 30    +0x3781
 * ```
 *
 * The chain runs `+0x3634`-`+0x378d` inside `battlevalues`, six `Less2` tests
 * each jumping past its own assignment. **The last arm re-tests
 * `herolevel < 35` at `+0x3769`-`+0x377c` and it changes nothing**, because the
 * only way to reach it is for `herolevel < 45` to have failed — re-derived here
 * rather than taken on the map's word, since a redundant test is exactly the
 * shape of thing a transcription gets subtly wrong.
 *
 * **The tier assignment is UNCONDITIONAL in the build**, outside the
 * `battle_started` skip, unlike the `ammo_left` refill below it. So it is
 * derived here unconditionally too and a stated `maximum_ammo` does NOT win —
 * which is the opposite of the rule the damage pair follows, deliberately: the
 * damage pair's rule protects MEASURED numbers in promoted goldens, and no
 * golden states an ammunition field at all.
 */
export function ss2MaximumAmmo(herolevel) {
  const level = Number.isFinite(herolevel) ? herolevel : 0;
  if (level < 9) return 5;
  if (level < 23) return 10;
  if (level < 28) return 15;
  if (level < 35) return 20;
  if (level < 45) return 25;
  return 30;
}

/**
 * How far this gladiator's swing reaches, in arena units — the build's
 * `weapon_range`, which is what the controller selector gates on.
 *
 * ```text
 * weapon_range = physical_size + _root["weapon" + c.weapon][5] * 44   +0x3190
 * ```
 *
 * Re-read off the installed build (`77cb545c…`) 2026-09-11, and the gate it
 * feeds is frame 4 `DoAction@0x238bbf` `+0x00f6`,
 * `fightdistance < hero.weapon_range ? closerange_warrior : longrange_warrior`,
 * STRICT `<`.
 *
 * ## THIS FUNCTION RETURNED `physical_size`, AND THAT VALUE IS NOT REACHABLE
 *
 * ► **The previous version returned `80 + round(strength / 1.5)` and called it
 *   "the UNARMED reach", citing `ss2-item-tables.md:58`,
 *   `c.weapon_range = c.physical_size`. THAT CITE IS HALF OF A WRAPPED LINE.**
 *   Line 59 of the same file continues `+ _root["weapon" + c.weapon][5] * 44`.
 *   There is no unarmed branch in `battlevalues` at all: every gladiator has a
 *   `weapon` id, and **the smallest `[5]` in all ninety rows is 1**, so the
 *   smallest `weapon_range` the build can produce is `physical_size + 44` and
 *   `physical_size` is never anybody's `weapon_range`.
 *
 *   ► **AN EARLIER VERSION OF THAT LAST CLAUSE READ "`physical_size` on its own
 *     is the reach of nothing", WHICH IS FALSE — it is a live reach gate in the
 *     build, just not this one.** The selector at frame 4 is TWO gates, and the
 *     bow arm never reads `weapon_range`:
 *     `using_bow ? (fightdistance < 100 + hero.physical_size)
 *                : (fightdistance < hero.weapon_range)`
 *     (`+0x00b9` the test, `+0x00f6` the warrior arm, `+0x0141`/`+0x0158`/
 *     `+0x015f` the archer arm). The build hand-writes `100 + physical_size`
 *     there precisely BECAUSE a bow's `physical_size + 4400` is useless as a
 *     gate.
 *
 *   **AND THE `[5]` COLUMN IS NOT A 1-2-3 MULTIPLIER, which nothing here said.**
 *   Measured over all ninety rows: `[5]` is 1 on 16 ids, 2 on 33, 3 on 20,
 *   **4 on 3** (65, 75, 220) and **100 on 18** (the type-4 ranged rows, 61-64
 *   and 66-80). The build's reach scale runs 44 to 4,400, and the settle sweeps
 *   this module cites exercise only multipliers 1, 2 and 3 — 21 of 90 rows, 23%,
 *   have never been in a modelled bout.
 *
 *   **This is the fourth time in this repository that a quoted offset's own
 *   neighbouring line held the answer** — `ranged-hurt-label-adjustment`,
 *   `swing-cost`, `movement-displacement`, and now this. The other three were
 *   `MAP_SILENCE` entries; this one was a docstring, which is why no catalogue
 *   rule caught it. **Read to the end of the statement, not to the end of the
 *   line.**
 *
 * ## THE ARCHIVE, AND HOW LITTLE OF THIS IT ACTUALLY WITNESSES
 *
 * ► **THE FIRST VERSION OF THIS BLOCK OVERSTATED THE ARCHIVE THREE WAYS, and a
 *   write-nothing verifier broke all three. Re-counted here before believing
 *   it.** `/mnt/c/ss2-capture/captures` holds 1,650 `.rufflelog` files, 1,551 of
 *   which carry a `{"t":"state"}` record; 3,102 records parse with a strength
 *   and a damage pair. Inverting `min_damage - round(strength * 2)` onto the
 *   table's damage pairs:
 *
 *   1. **3,004 resolve and 98 do not** — not the "3,091" this block claimed,
 *      which was an arithmetic slip reading my own tally. The 98 are two
 *      homogeneous groups (pair (2,10) at strength 5, and (1,1) at strength 0).
 *   2. **432 of the 3,004 are AMBIGUOUS, and every single one spans the range
 *      column** — each admits a `[5]` = 1 row and a `[5]` = 100 row, e.g. pair
 *      (4,16) admits ids 2, 21 and 61. So for 14% of the archive the inversion
 *      cannot tell `physical_size + 44` from `physical_size + 4400`.
 *   3. **"Not one implies a `weapon_range` below `physical_size + 44`" IS
 *      UNFALSIFIABLE BY CONSTRUCTION**, and this block defended it with an
 *      argument that does not work. The defence was "not tautological, because
 *      `rangeMultiplier` is a different column from the two it inverts". But the
 *      proposition quantifies over EVERY row, and the minimum `[5]` over all
 *      ninety is 1 — so any resolution to any row implies it. No archive
 *      content could ever have contradicted the claim. **Withdrawn.**
 *
 *   **WHAT SURVIVES, and it is narrower and real:** the archive's own hero
 *   resolves UNIQUELY — pair (1, 3) matches exactly one row in the table, id 0 —
 *   in all 1,500 of its records, at strength 10, so its `physical_size` is 87
 *   and its `weapon_range` is **131, not 87**. That is a fact about the DAMAGE
 *   columns; the range follows through the table, not through the archive.
 *   **The archive records no `weapon`, `weapon_range`, `physical_size`,
 *   `secondary_weapon`, `using_bow` or `equipped_weapon` field at all**, so it
 *   witnesses the quantity in dispute only at this one remove.
 *
 * ## WHERE THE NUMBER COMES FROM NOW
 *
 * `weapon_range` is a DECLARED RESOURCE (`SS2_RESOURCE_NAMES`), derived by
 * `ss2BattleValues` from the `weapon` id exactly as the damage pair is. That is
 * the opt-in this docstring used to name and defer, and it is the same standing
 * `min_damage`/`max_damage` already have: a `battlevalues` output carried as a
 * number, not an equipment id smuggled into the resource bag.
 *
 * **The fallback is DERIVED, not authored.** A combatant that declares no
 * `weapon_range` gets `physical_size + ss2WeaponEntry(0).rangeMultiplier * 44`
 * — weapon id 0, the build's own bare-hands row (`[0, 2, 5, 1, 3, 1]`), which is
 * what the archive's hero actually carries. So the fallback is the build's
 * minimum rather than a number chosen here.
 *
 * **What is still narrowed, and it is narrower than before rather than wider:**
 * a gladiator that states neither a `weapon` nor a `weapon_range` reaches as
 * far as bare hands, which is the shortest reach the build has. A bow is not
 * modelled — `using_bow` is forced false at battle construction (map `:111`,
 * root frame 221) and the resolver has no ranged vocabulary — so the
 * `[5] * 44 = 4400` of the eighteen type-4 rows never reaches this function
 * through a battle. `ss2BattleValues` carries the bow override anyway, because
 * dropping it was a named gap.
 */
export function ss2Reach(actor) {
  // ► **A DRAWN BOW REACHES WITH THE BOW, and this is the read-time half of
  //   `battlevalues`'s `weapon_range = secondary_weapon_range` (`+0x343e`).**
  //   The bag keeps the melee reach in `weapon_range` because the bow's is
  //   recoverable and the melee one would not be; see `SS2_RESOURCE_NAMES`.
  if (ss2InBowMode(actor)) {
    const bow = resourceValue(actor, "secondary_weapon_range", 0);
    if (Number.isFinite(bow) && bow > 0) return bow;
  }
  const declared = resourceValue(actor, "weapon_range", null);
  if (Number.isFinite(declared) && declared > 0) return declared;
  return ss2PhysicalSize(actor) + ss2WeaponEntry(0).rangeMultiplier * SS2_WEAPON_RANGE_STEP;
}

/**
 * Is the bow DRAWN? `equipped_weapon == 2`.
 *
 * ► **ONE FIELD, NOT TWO, AND THE BUILD IS WHY.** Vanilla carries both
 *   `using_bow` (a boolean) and `equipped_weapon` (1 or 2), and the
 *   `swap_weapons` toggle writes them in the same breath — `equipped_weapon = 2`
 *   with `using_bow = true` at `+0x4dbd`/`+0x4dce`, and the mirrored pair at
 *   `+0x4eba`/`+0x4ecb`. **There is no site in the build that sets one without
 *   the other**, so they are one fact with two spellings.
 *
 *   `equipped_weapon` is the spelling this engine can carry, because a
 *   resource bag holds finite numbers by construction and `equipped_weapon` is
 *   already in it. A `using_bow` status token would be a second copy of the
 *   same fact on the other channel, free to disagree — and the build's own
 *   villain AI reads `equipped_weapon`, not `using_bow`, for its attack gate
 *   (`sprite:862/frame:52/DoAction@0x23f835` `+0x0356`), so it is also the
 *   reading at least one of the two sides actually uses.
 */
export function ss2InBowMode(actor) {
  return resourceValue(actor, "equipped_weapon", SS2_RESOURCE_DEFAULTS.equipped_weapon) === 2;
}

/**
 * The pair the swing actually uses, which is NOT the pair in the bag when the
 * bow is drawn.
 *
 * `battlevalues` `+0x3424`-`+0x343d`: bow mode overwrites `min_damage` and
 * `max_damage` with `secondary_min_damage` / `secondary_max_damage`, and those
 * two carry `round(strength * 1)` (`+0x33d3`, `+0x33f7`) where the melee pair
 * carries `round(strength * 2)` (`+0x3356`, `+0x3386`).
 *
 * ► **SO A BOW SCALES WITH STRENGTH AT HALF THE RATE A SWORD DOES, and that is
 *   the build's own answer to "why would anyone stay in melee".** It is worth
 *   naming because it is counter-intuitive: the ranged band's raw table damage
 *   is the highest in the game (id 80 is 23-529 against the best sword's
 *   160-480), and the halved strength term is what pays for it.
 */
export function ss2ActiveDamagePair(actor) {
  const strength = actor?.stats?.strength ?? 0;
  if (!ss2InBowMode(actor)) {
    return {
      min_damage: resourceValue(actor, "min_damage", 0),
      max_damage: resourceValue(actor, "max_damage", 0)
    };
  }
  return {
    min_damage: Math.round(strength) + resourceValue(actor, "secondary_weapon_min_damage", 0),
    max_damage: Math.round(strength) + resourceValue(actor, "secondary_weapon_max_damage", 0)
  };
}

/**
 * THE ARCHER'S MINIMUM RANGE — `100 + physical_size`, so 180 at strength 0 and
 * 186 at the demo roster's strength 9.
 *
 * The controller selector, frame 4 `DoAction@0x238bbf`, in full:
 *
 * ```text
 * if (_root.game.hero.using_bow != true) {              // +0x00b9
 *   fightdistance < hero.weapon_range                   // +0x00f6
 *     ? gotoAndPlay("closerange_warrior") : gotoAndPlay("longrange_warrior");
 * } else {
 *   fightdistance < 100 + hero.physical_size            // +0x015f
 *     ? gotoAndPlay("closerange_archer") : gotoAndPlay("longrange_archer");
 * }
 * ```
 *
 * ► **READ THE POLARITY BEFORE USING IT: THIS IS A FLOOR, NOT A CEILING.** The
 *   warrior arm's `fightdistance < weapon_range` selects the frame that can
 *   ATTACK, so reach is a maximum. The archer arm has the same shape and the
 *   opposite meaning, because `closerange_archer` is the frame that CANNOT
 *   shoot — it wires `bash_attack` and no bombard or snipe at all. So an
 *   archer may only shoot what is at least this far away, and has no maximum
 *   range whatsoever: the gate never reads `weapon_range`, which is precisely
 *   why a bow's 4,480-unit reach never mattered in vanilla.
 *
 * **The two sides of the build do not share this gate**, and neither half is
 * this one: `villainChooseAction` tests
 * `equipped_weapon == 2 && fightdistance < 200` (`+0x0356`-`+0x03d5`), a
 * hand-written 200 with no minimum at all. This engine applies the HERO's gate
 * to everybody, exactly as it already applies the hero's warrior gate to
 * everybody, because the hero's rule is the player's rule.
 */
export function ss2ArcherMinimumRange(actor) {
  return 100 + ss2PhysicalSize(actor);
}

/**
 * `movement_speed = clamp(round(speed * 1.5), 4, 60)` (`battlevalues` `+0x37d2`).
 *
 * **Computed here from the projected stat rather than carried as a resource**,
 * and that is the more faithful of the two: the map's own persistence table
 * (`:698`) lists `movement_speed` among the fields "recomputed
 * unconditionally", so it is a `battlevalues` OUTPUT and never a stored pool.
 * The resolver renames `speed` to `agility`, and `ss2Combatant` sets
 * `agility: derived.speed ?? 0`, so the input is already inside
 * `combatStateHash` and nothing needs adding to the wire vocabulary.
 *
 * The clamp FLOOR of 4 is the build's, not a convenience: however slow a
 * gladiator is, `movement_speed` cannot go below it.
 */
export function ss2MovementSpeed(actor) {
  return clamp(Math.round((actor.stats.agility ?? 0) * 1.5), 4, 60);
}

/**
 * The build's easing divisor and WALK stop tolerance, named because a bare `8`
 * beside a bare `20` reads like a tidy-up rather than a transcription.
 * `ceil(gap / 8)` per frame, walk phase over at 20.
 *
 * ► **"both appear in four movement branches" WAS WRONG ON BOTH COUNTS, and the
 *   second one matters (corrected 2026-09-11 by a verifier).** The easing `Push
 *   8` appears in SIX branches (`+0x3c9c`, `+0x3e7b`, `+0x3fa1`, `+0x412a`,
 *   `+0x42fe`, `+0x456a`); the `20` appears in TWO — **the stop tolerance is
 *   PER PHASE.** A run stops at 10 (`+0x4038` runleft, `+0x41c1` runright) and a
 *   charge has no destination tolerance at all: it terminates on the
 *   `defender._x ∓ game_attacker.weapon_range` test instead. So the name is
 *   `SS2_WALK_STOP_GAP` and a reader must not compute a run's displacement as
 *   `movement_speed * 40 - 20`. It is -10.
 */
const SS2_WALK_EASING_DIVISOR = 8;
const SS2_WALK_STOP_GAP = 20;

/**
 * HOW FAR ONE COMPLETED `walkleft` / `walkright` PHASE CARRIES A GLADIATOR —
 * **DERIVED FROM THE BUILD, 2026-09-11, and no longer authored.**
 *
 * `MAP_SILENCE.movement-displacement` recorded this as the one number in the
 * arena model that no byte supported, and `SS2_ARENA.walkDistance` (now `walkDistanceAtSpeedFloor`) carried 44
 * on the strength of a single uncited line in a frozen handoff. **The battle
 * map is silent; the BUILD is not.** The walk branches of overlay frame 52
 * (`sprite:862/frame:52/DoAction@0x240c7f`, block base `0x240c85`) compute the
 * step, and they were never read because the map's `staminacost` table stops at
 * the cost:
 *
 * ```text
 * walkleft  +0x3b2c   walkright +0x3d0b      (the phase_decision test)
 *   staminacost   = round(movement_speed / 2)        +0x3b37 / +0x3d16
 *   if (attacker.destination == null) {              +0x3b72 / +0x3d51
 *     attacker.gotoAndPlay("StepBack" | "StepForward")
 *     attacker_x_walk = game_attacker.movement_speed * 16    +0x3b99 / +0x3d78
 *     walk_bonus      = get_percentage(100 + game_attacker.boot * 2, 100)
 *                                                    +0x3ba3 / +0x3d82
 *     attacker_x_walk = add_percentage(attacker_x_walk, walk_bonus)
 *                                                    +0x3bd1 / +0x3db0
 *     attacker.destination = attacker._x -/+ attacker_x_walk
 *                                                    +0x3bf1 / +0x3dd0
 *     // and the overlap clamp — see `ss2WalkDestination`
 *   }
 *   attacker._x -/+= Math.ceil((attacker._x - attacker.destination) / 8)
 *                                                    +0x3c75 / +0x3e54
 *   if (!(attacker._x >/< attacker.destination +/- 20)) {
 *     attacker.destination = null; nextphase();       +0x3cb8 / +0x3e97
 *   }
 * ```
 *
 * The two helpers are in the same block and are read rather than guessed —
 * their parameters sit in registers 2 and 1 respectively, which is why reading
 * the body without the `DefineFunction2` header would inverse both:
 *   `get_percentage(a, b) = (a / b) * 100`      (`+0x1089`)
 *   `add_percentage(a, b) = ceil(a * b / 100)`  (`+0x10ba`)
 * so `walk_bonus` is `100 + 2 * boot` and the boot term SPEEDS A WALK UP.
 *
 * **THE PART THAT MAKES 44 AN ANSWER RATHER THAN A COINCIDENCE.** The step is
 * a DESTINATION, not a displacement: `_x` eases toward it by `ceil(delta / 8)`
 * per frame and the phase ENDS the first frame the remaining gap is 20 or
 * less. So a phase realises `attacker_x_walk` MINUS whatever gap was left when
 * it stopped, and at the `movement_speed` floor of 4 with no boots that is
 * exactly 44:
 *
 * ```text
 * 64 -> 56 -> 49 -> 42 -> 36 -> 31 -> 27 -> 23 -> 20   (stop; 64 - 20 = 44)
 * ```
 *
 * The 44 in that frozen handoff was RIGHT, and the adversarial reader who
 * proposed it was a conflation with the `weapon_range` multiplier was wrong —
 * but only for a gladiator at the clamp floor. **It is not a constant.** A
 * gladiator with `agility` 8 (`movement_speed` 12) walks 172 per phase, and
 * treating 44 as universal was understating a fast gladiator's reach across
 * the arena by a factor of four.
 *
 * The archive's own hero corroborates the FLOOR, independently of these bytes:
 * its `movement_speed` is pinned at 4 by a stamina ledger that never mentions a
 * displacement (`tools/approach-length-census.mjs`). **It does not corroborate
 * the 44** — the archive carries no positional field at all, and the census's
 * one-sided bound gives the same answer for 44 and for 45. An earlier version of
 * this line said "corroborated at runtime", which overstated it.
 *
 * ## TWO CORRECTIONS A VERIFIER WAVE FORCED, both in this function's arithmetic
 *
 * Six write-nothing verifiers were run against the first version of this
 * derivation (2026-09-11). Four said HOLDS; two broke something real, and both
 * breaks are here rather than in the reading:
 *
 * 1. **THE OPERATION ORDER IS NOT OPTIONAL.** This function shipped
 *    `ceil(ms * 16 * (100 + 2 * boot) / 100)`, which is the right algebra and
 *    the wrong function. `get_percentage` round-trips `(100 + 2*boot) / 100 *
 *    100`, which is LOSSY in IEEE-754 — `walk_bonus` is `110.00000000000001` at
 *    boot 5 — and `add_percentage` DIVIDES BEFORE MULTIPLYING
 *    (`StoreRegister r1 = b/100` at `+0x10c5`, then `a * r1`), not `a * b /
 *    100`. Over `movement_speed` 4..60 and boot 0..26 the two disagree at six
 *    pairs, always by one pixel: realised **421 vs 420** at (25, 5), **431/430**
 *    at (25, 6), **775/774** at (45, 5), **863/862** at (50, 5), **879/878** at
 *    (50, 6), **949/948** at (55, 5). `movement_speed` 45 and 50 come from
 *    `speed` 30 and 33, so these are reachable, not pathological. Both round
 *    trips are reproduced above on purpose; collapsing them is the bug.
 *    **Derived from the bytecode plus IEEE-754 semantics, NOT measured in
 *    Ruffle** — so it is the build's arithmetic as far as a reader of the
 *    bytecode can tell, and one step short of a measurement.
 * 2. **THE TWEEN IS A DO/WHILE.** The build's per-frame `_x` update at
 *    `+0x3e4e` is UNCONDITIONAL and runs BEFORE the stop test at `+0x3e97` — the
 *    `destination == null` init block falls through into it with no `Jump`. So a
 *    step of 20 moves the gladiator by `ceil(20/8) = 3`, and this function's
 *    `while (gap > 20)` returned 0 while its own comment asserted that zero was
 *    *"the build's behaviour and not a guard invented here"*. It was the
 *    opposite. Unreachable through `ss2MovementSpeed`, asserted as a universal
 *    about the build, and wrong.
 *
 * ## ONE PRECONDITION THE 44 CARRIES, found by the same wave
 *
 * `attacker.onEnterFrame`'s FIRST act (`+0x36c1`..`+0x37c8`) is
 * `if (arena.fightdistance < 100) { hero._x ±= 1; villain._x ∓= 1 }`, and
 * `fightdistance` is recomputed every frame by `getfightdistance`. So inside 100
 * units the attacker's `_x` gains ±1 per frame BEFORE the tween, and the phase
 * realises 45 or 43 rather than 44 (7 frames / 10 frames, final gap 19 either
 * way).
 *
 * ► **"EITHER WAY" IS WRONG: THE SIGN IS DETERMINED, because the nudge always
 *   SEPARATES** (derived 2026-09-12 — `gladiator_dir` is FACING, fixed by
 *   `+0x28f3` setting hero "right" exactly when `hero._x < villain._x`, so both
 *   arms of `+0x36c1`..`+0x37c8` move the pair apart). A walk TOWARD the foe
 *   fights the repulsion and realises the SHORTER figure; a walk away is helped
 *   and realises the LONGER. **The frame counts above are NOT re-derived** —
 *   they came in with the paragraph — so this is a correction to the logic and a
 *   lead on the numbers, not a derivation of them.
 *
 * **44 is the displacement while the gladiators are more than 100 apart**,
 * which is every walk of an approach from 500 and is not every walk in a bout:
 * the overlap clamp parks a walk at `defender._x ∓ physical_size`, and the
 * captured hero's `physical_size` is 87. Not modelled here — the resolver has no
 * frames — and recorded because it bounds what this number means.
 */
export function ss2WalkDisplacement(movementSpeed, { boot = 0 } = {}) {
  if (!Number.isFinite(movementSpeed) || movementSpeed < 0) {
    throw new TeamRuleSetError(`ss2WalkDisplacement: movementSpeed must be a finite non-negative number, got ${movementSpeed}.`);
  }
  if (!Number.isFinite(boot) || boot < 0) {
    throw new TeamRuleSetError(`ss2WalkDisplacement: boot must be a finite non-negative number, got ${boot}.`);
  }
  // `attacker_x_walk`, IN THE BUILD'S OWN OPERATION ORDER. See the docstring's
  // "two corrections a verifier wave forced" block: the collapsed
  // `ceil(ms * 16 * (100 + 2 * boot) / 100)` this function shipped for one
  // commit is a DIFFERENT FUNCTION in IEEE-754 doubles, and differs by +1 at
  // reachable inputs. Both redundant round trips below are deliberate.
  const base = movementSpeed * 16;
  const bonus = ((100 + 2 * boot) / 100) * 100;         // get_percentage(100 + 2*boot, 100)
  const step = Math.ceil(base * (bonus / 100));         // add_percentage: DIVIDES FIRST
  // The easing tween, run to the build's own stop condition — and the build
  // MOVES BEFORE IT CHECKS, so this is a do/while and not a while. A step of 20
  // or less still moves the gladiator once: at `movement_speed` 1 the build
  // realises 2, where a `while` would return 0. Unreachable through
  // `ss2MovementSpeed` (the floor of 4 makes the smallest real step 64) but this
  // function is exported and takes any non-negative number, and the comment here
  // used to assert the opposite AS THE BUILD'S BEHAVIOUR.
  let gap = step;
  do {
    gap -= Math.ceil(gap / SS2_WALK_EASING_DIVISOR);
  } while (gap > SS2_WALK_STOP_GAP);
  return step - gap;
}

/**
 * The other six movement phases, transcribed from the same block so that
 * nobody has to read it twice. **NONE of them is wired into the rule set** —
 * `Ss2ActionType` has two walks and no run, charge or jump — and this table is
 * here because `MAP_SILENCE.movement-displacement` said "nothing states a
 * displacement for the other six phases at all", which was as wrong about the
 * build as the walk entry was.
 *
 * **OFFSET CONVENTION, stated because three of them were in play at once and a
 * cite nobody can locate is not a cite.** Every offset below is the `Push
 * <factor>` literal itself, which is what `tools/walk-displacement-derivation.mjs`
 * reports. The first version of this table cited the `Push "destination",
 * "attacker"` that OPENS each assignment instead (`+0x3f4f`, `+0x40d8`,
 * `+0x44da`, `+0x426e`, `+0x4b69`, `+0x487c`); a verifier checked all eight and
 * both sets are correct and name the same statements. One convention from here on.
 *
 * | phase | `Push <factor>` | destination |
 * | --- | --- | --- |
 * | `runleft`     | `+0x3f69` | `_x - movement_speed * 40` |
 * | `runright`    | `+0x40f2` | `_x + movement_speed * 40` |
 * | `chargeleft`  | `+0x44f4` | `_x - movement_speed * 20` |
 * | `chargeright` | `+0x4288` | `_x + movement_speed * 20` |
 * | `jumpleft`    | `+0x4a3d` | per FRAME: `_x -= ceil(round(movement_speed * 0.6) * (100 + 2 * shinguard) / 100)` |
 * | `jumpright`   | `+0x476e` | per FRAME: `_x += ceil(round(movement_speed * 0.6) * (100 + 2 * shinguard) / 100)` |
 *
 * Four things in that table are worth more than the numbers, and two of them are
 * corrections a verifier wave forced on its first version:
 * - **Only the walk takes a boot bonus**, and only the jump takes a shinguard
 *   one (`+0x47a1` / `+0x4a6f`). Run and charge take neither and have no
 *   intermediate variable at all.
 * - **THE STOP TOLERANCE IS PER PHASE, and this table implied it was not.** A
 *   walk stops within 20, a run within **10** (`+0x4038` runleft, `+0x41c1`
 *   runright), and a charge has no destination tolerance at all. A run's
 *   realised step is therefore `40 * movement_speed - 10`; reading
 *   `SS2_WALK_STOP_GAP` as universal puts it 10 out.
 * - **A charge's threshold is an ADVANCE GATE, not a destination clamp**, and
 *   this table said "clamp". Bytes: `+0x4293`..`+0x42cc` is
 *   `if (!(attacker._x > round(defender._x - game_attacker.weapon_range))) { _x
 *   += ceil((destination - _x) / 8) }`, with the same threshold re-tested at
 *   `+0x431a` to fire `Chargeattack` (`+0x437e`). The charge's destination
 *   (`+0x4288`) is never clipped, so the two readings diverge the moment the
 *   defender moves mid-charge. The quantity and the offset were right; the
 *   structure word was wrong, here and in the battle map.
 * - **A jump's total may BE determined, and this table said it is not.** An
 *   investigating agent reports `(2L + 1)` applications of the per-frame add,
 *   with `L` the clamped `|leap|` in `[8, 36]`, which would make the total
 *   `(2L + 1) * ceil(round(movement_speed * 0.6) * (100 + 2 * shinguard) / 100)`.
 *   **That is ONE agent's reading with no verifier aimed at it**, so it is a lead,
 *   not a derivation. What is certain is the per-frame shape and that `_y` moves
 *   by `attacker.leap` (`+0x4913`).
 *
 * ► **AND BEFORE YOU WIRE `jump*`, READ `ss2FightDistance`'s HEIGHT-VERSUS-DEPTH
 *   BLOCK. `attacker.leap` moves `_y`, and THIS ENGINE HAS ALREADY SPENT `y` ON
 *   SOMETHING ELSE** — the rank a gladiator stands in, added 2026-09-12.
 *   Vanilla's `_y` is the leap arc and `getfightdistance` counts it; ours is
 *   depth into the arena. Writing a jump into `combatant.y` would make a
 *   fighter mid-leap indistinguishable from one standing a rank back, to every
 *   reach gate at once. The answer is a THIRD named axis, not a shared one.
 *
 * **None of these six is wired into the rule set**, and there is a second reason
 * beyond "nothing offers them": `SS2_MOVEMENT_STEP_FACTOR.run` and `.charge` are
 * read nowhere in `src/` — only by the tool — so `node --test` does not guard
 * them. The guard is a tool a human runs on the capture box, the same standing
 * the weapon table has.
 */
export const SS2_MOVEMENT_STEP_FACTOR = Object.freeze({
  walk: 16,
  run: 40,
  charge: 20,
  jump: 0.6
});

/**
 * WHERE A WALK PUTS A GLADIATOR — the displacement, and then the two clamps the
 * build applies to it.
 *
 * The outer clamp is `nextphase` step 1's arena bound, which this module has
 * always applied. The inner one is the build's refusal to let a walk carry a
 * gladiator INTO its opponent, and **it is now the build's own, re-read off the
 * installed SWF (`77cb545c…`) 2026-09-11:**
 *
 * ```text
 * walkright  +0x3de6  if (attacker.destination > defender._x - game_defender.physical_size
 *            +0x3e14      && attacker.gladiator_dir == "right")
 *            +0x3e2c    attacker.destination = defender._x - game_defender.physical_size
 * walkleft   +0x3c07  the mirror: `<`, `+`, and `gladiator_dir == "left"`
 * ```
 *
 * Both are `Duplicate; Not; If; Pop` short-circuits, so the `gladiator_dir` test
 * is the second half of an `&&` and the clamp is FORWARD-only: it binds just
 * when the defender is the way you are walking. Computed ONCE inside the
 * `destination == null` init block and never recomputed while the gladiator
 * eases, so a model that re-clips every step is stricter than the build.
 *
 * ## THE CLAMP IS THE DEFENDER'S `physical_size`, AND THE GATE IS THE
 * ## ATTACKER'S `weapon_range`. THEY ARE TWO QUANTITIES.
 *
 * ► **THE NARROWING THAT STOOD HERE FOR ONE COMMIT — "the limit is the foe's
 *   `x`" — IS GONE, AND SO IS ITS CAUSE.** The cause was never the clamp: this
 *   module used `ss2Reach` for BOTH sides of a comparison the build makes
 *   between two different fields, so the clamp parked a walker exactly ON the
 *   gate threshold and the build's STRICT `<` never opened. The fix named in
 *   that paragraph is the one applied here — `weapon_range` is a projected
 *   resource, `ss2PhysicalSize` is its own function, and the two are no longer
 *   the same number. `weapon_range` is at least `physical_size + 44` for every
 *   one of the ninety weapon rows, so a walk clamped at the defender's
 *   `physical_size` lands strictly INSIDE the attacker's reach.
 *
 * **MEASURED 2026-09-11 on the sweep that is in the suite** (8 seeds a side,
 * `test/ss2-position.test.js`'s own `bout()` fixture, all six gladiators
 * `strength` 9):
 *
 * ```text
 *                        settled   walks/actions   turns an attack was on offer
 *   ss2Reach both ways  1v1  8/8    3416/3496 97.7%            0
 *                       2v2  8/8    6792/7000 97.0%            0
 *                       3v3  0/8    9264/9600 96.5%            0
 *   foe.x narrowing     1v1  8/8      32/168  19.0%          136
 *                       2v2  8/8      80/325  24.6%          245
 *                       3v3  8/8     128/477  26.8%          349
 *   build's own pair    1v1  8/8      32/168  19.0%          136
 *   (shipped here)      2v2  8/8      80/325  24.6%          245
 *                       3v3  8/8     128/477  26.8%          349
 * ```
 *
 * The third block is byte-identical to the second and is FAITHFUL, which is the
 * whole argument: the narrowing bought nothing the build's own pair does not.
 * **The first block's 1v1 and 2v2 rows "settle" only because the crowd kills
 * them — an attack is never once on offer in any of the 24 bouts** — which is a
 * worse failure than the 3v3's and was missed once by reporting only what the
 * assertion checked.
 *
 * ► **ONE CASE THE BUILD HAS AND THIS DOES NOT MODEL, recorded because it
 *   bounds the clamp's meaning.** `+0x3de6` is unconditional on where the
 *   walker currently stands, so a caller that STAGES two gladiators closer than
 *   `physical_size` — every other SS2 test in this repository stages them in
 *   contact — and then forces a forward walk gets the build's answer: the clamp
 *   fires, the destination is behind the walker, and the walk moves it BACKWARD
 *   to the clamp line. The resolver has no frames, so it never reaches that
 *   state on its own.
 *
 *   ► ~~**"Reachable in the build because `onEnterFrame`'s sub-100 nudge drives
 *     the pair together a pixel a frame."**~~ **THE NUDGE SEPARATES. WITHDRAWN
 *     IN FULL 2026-09-12 by a write-nothing verifier, and re-derived here
 *     before it was believed.** The bytes are
 *     `if (arena.fightdistance < 100) { if (hero.gladiator_dir == "left")
 *     { hero._x += 1; villain._x -= 1 } else { hero._x -= 1; villain._x += 1 } }`
 *     (`+0x36c1` guard, `+0x372c`/`+0x375e` and `+0x3795`/`+0x37c7`), and the
 *     hinge is what `gladiator_dir` MEANS. It is FACING, not side-of-arena: the
 *     turnaround in this same block is
 *     `if (hero._x < villain._x) { hero.gladiator_dir = "right";
 *     villain.gladiator_dir = "left" }` (`+0x28f3` -> `+0x290e` / `+0x29cd`),
 *     maintained every pass. So `dir == "left"` means the hero stands to the
 *     RIGHT, and `hero._x += 1` with `villain._x -= 1` moves BOTH away. Both
 *     arms separate, by 2 px a frame, until the gap reaches 100. **It is a
 *     repulsion, and this docstring called it an attraction.**
 *
 * ► **THE INVARIANT "A CLAMPED WALK ALWAYS LANDS INSIDE THE ATTACKER'S REACH"
 *   IS FALSE, found by a sweep written to assert the opposite.**
 *   `physical_size` spans 80 (strength 0) to 147 (strength 100), a range of 67,
 *   wider than the 44 a bare-handed `weapon_range` adds. So at a strength gap of
 *   **65-66** — flat across the range, because `physical_size` sits on both
 *   sides of the comparison — a BARE-HANDED walker parks at
 *   `physical_size(defender)` with its own gate shut and is never offered a
 *   swing. **That is the build's behaviour, not this module's**: the same two
 *   fields, the same strict `<`.
 *
 *   ► ~~**"What the build has and this does not is the nudge, which takes the
 *     distance under 100 and inside every reach in the table."**~~ **BROKEN
 *     TWICE OVER, and the second break survives even under the wrong reading
 *     above.** The nudge's guard is `fightdistance < 100`. The blocked case
 *     requires `physical_size(defender) >= weapon_range(attacker)`, and
 *     `weapon_range >= 80 + 1 * 44 = 124` for every gladiator the build can
 *     make — so the parked separation is ALWAYS at least 124 and the nudge
 *     cannot fire there at all. **The build has no escape from this case; it
 *     simply has the case.** Nothing is owed to the resolver here.
 *
 *   **A weapon closes it** — `[5]` = 2 adds another 44 — and it is not a hung
 *   bout either way: the bigger gladiator's reach covers the smaller one's
 *   personal space, so it closes and kills. Measured over 8 seeds at strength 1
 *   against strength 70: 8/8 settle, the small side offered a swing on 0 turns
 *   and the big side on many. Pinned in `test/ss2-position.test.js`.
 *
 * **THE MULTI-FOE RULE IS AUTHORED, because vanilla cannot settle it**
 * (`MAP_SILENCE.multi-slot-arena-geometry`): vanilla has exactly one defender,
 * so there is no build behaviour to copy. A walk stops at the NEAREST binding
 * foe ahead of it, which is the only reading that keeps the 1v1 case identical
 * to the build's. Nearest by CLAMP LINE rather than by position, because with
 * unequal `physical_size` the two orders differ: a bigger foe standing slightly
 * further off is the one that stops you first.
 */
/**
 * ► **DOES A BODY AT THIS DEPTH BLOCK A WALK? Added 2026-09-12 with the second
 *   axis, and it closes a deadlock that axis CREATED.**
 *
 * The overlap clamp exists so a walk cannot carry a gladiator INTO another
 * gladiator — `defender._x -/+ game_defender.physical_size`, the build's own
 * clamp. `physical_size` is how big the body is. Until there was a second axis
 * that was the whole story, because every body stood on one line.
 *
 * It is no longer, and leaving it alone parks fighters permanently ONE UNIT
 * out of reach. Measured before this guard existed, at `rankStride` 97:
 * 16 of 24 bouts never settled, every survivor at full health, one side
 * walking 354 times and the other 183. The mechanism is the one this module
 * already documents for the 1-D case — *"parks a walker exactly ON its own
 * gate threshold"* — arriving on the new axis: the clamp stopped a walker at
 * `dx = 85` because it reasons only about x, while the gate is
 * `round(sqrt(85^2 + 97^2)) = 129` against a reach of 129 and a STRICT `<`.
 * Neither number is wrong; they were answering different questions.
 *
 * **So a foe blocks only when it is close enough in DEPTH to actually be in
 * the way**, which is what "overlap" already meant: `physical_size` is the
 * body's own extent, so two gladiators separated by more than that in y are
 * not touching and never were. A rank you are not standing in is scenery.
 *
 * AUTHORED, and inside the silence that already covers it
 * (`MAP_SILENCE.multi-slot-arena-geometry`): vanilla has one gladiator a side
 * and both stand at `_y = 200`, so `|dy|` is 0 for every pair the build can
 * make and this predicate is CONSTANTLY TRUE there. **1v1 is therefore
 * byte-identical, and so is every bout with the second axis switched off** —
 * a `null` y reads as 0 on both sides.
 */
function ss2BodyBlocks(actor, foe) {
  const actorY = Number.isFinite(actor?.y) ? actor.y : 0;
  const foeY = Number.isFinite(foe?.y) ? foe.y : 0;
  return Math.abs(actorY - foeY) < ss2PhysicalSize(foe);
}

/**
 * ► **DOES A BODY STAND IN THE WAY OF THE SHOT? AUTHORED — owner's decision,
 *   2026-09-13 — and the build CANNOT answer it.**
 *
 * Vanilla has one gladiator a side, so there is never a third body to stand
 * between them and no bytecode anywhere tests for one. This sits squarely
 * inside `MAP_SILENCE.multi-slot-arena-geometry`, which already covers
 * "positions, depths, and clip names for slots beyond the first".
 *
 * **`ss2BodyBlocks` is the precedent and this is deliberately the same shape.**
 * That predicate asks whether a body is close enough IN DEPTH to be in the way
 * of a walk, and answers with `|dy| < physical_size(body)` — the body's own
 * extent. This asks the same question of a straight line between two points
 * and answers it the same way: the blocker's perpendicular distance from the
 * shot line, against its own `physical_size`.
 *
 * Three properties it was built to have, each of which a simpler rule loses:
 *
 * 1. **A body BEHIND the archer, or BEYOND the target, never blocks.** The
 *    projection is clamped to the segment, so only somebody actually between
 *    the two can interpose. A rule that used raw distance-to-line would let a
 *    gladiator standing behind you block your own shot.
 * 2. **The TARGET never blocks itself**, and neither does the shooter. Both are
 *    excluded by id rather than by geometry, because at the moment of the shot
 *    the target's projection onto the line is the line's own endpoint.
 * 3. **It is OFF when the second axis is off, structurally.** With
 *    `rankStride` 0 every gladiator has `y: null`, every body sits on one line,
 *    and a blocker's perpendicular distance is 0 — which would block every
 *    shot in a 1-D arena. So the whole predicate is skipped unless BOTH ends
 *    model depth, and a bout with the axis off behaves exactly as it would
 *    have with no line-of-sight rule at all. **1v1 is untouched on both axes.**
 *
 * The owner's reason for wanting it, 2026-09-13: range should interact with
 * the second axis, and Euclidean distance alone does not make a rank SCREEN
 * anything — it only makes the back rank further away. A front rank that can
 * body-block for its archers is the thing that makes where you stand a
 * decision rather than a number.
 */
export function ss2ShotBlocked(actor, target, bodies) {
  if (!Number.isFinite(actor?.x) || !Number.isFinite(target?.x)) return false;
  // Structural off-switch: with no depth on either end there is no geometry to
  // be blocked IN, only a line every body is standing on.
  if (!Number.isFinite(actor?.y) || !Number.isFinite(target?.y)) return false;
  const dx = target.x - actor.x;
  const dy = target.y - actor.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return false;
  for (const body of bodies ?? []) {
    if (!body || body.alive === false) continue;
    if (body.id === actor.id || body.id === target.id) continue;
    if (!Number.isFinite(body.x) || !Number.isFinite(body.y)) continue;
    // Where the body falls along the shot, as a fraction of the way there.
    // Clamped OUT rather than in: a `t` outside `(0, 1)` means the body is not
    // between the two at all, and clamping it to an endpoint would make
    // everybody standing behind the archer a blocker.
    const t = ((body.x - actor.x) * dx + (body.y - actor.y) * dy) / lengthSquared;
    if (t <= 0 || t >= 1) continue;
    const offX = actor.x + t * dx - body.x;
    const offY = actor.y + t * dy - body.y;
    // `<` and not `<=`, matching `ss2BodyBlocks`, so a body exactly its own
    // extent away is clear. Squared on both sides to keep it integer-exact and
    // free of a square root whose rounding would decide edge cases.
    const size = ss2PhysicalSize(body);
    if (offX * offX + offY * offY < size * size) return true;
  }
  return false;
}

export function ss2WalkDestination(actor, foes, direction) {
  const step = ss2WalkDisplacement(ss2MovementSpeed(actor));
  let to = actor.x + direction * step;
  for (const foe of foes ?? []) {
    if (!ss2BodyBlocks(actor, foe)) continue;
    if (!foe || foe.alive === false || !Number.isFinite(foe.x)) continue;
    // Ahead of the actor, in the direction of travel. `<= 0` covers a foe
    // behind and a foe exactly co-located: neither can be walked past.
    if ((foe.x - actor.x) * direction <= 0) continue;
    // `defender._x -/+ game_defender.physical_size`, by the direction of travel.
    const limit = foe.x - direction * ss2PhysicalSize(foe);
    if ((to - limit) * direction > 0) to = limit;
  }
  // ► **THE REVERSAL GUARD — AUTHORED, AND IT EXISTS BECAUSE THE BUILD'S OWN
  //   CLAMP BREAKS THIS MODULE'S ONE LOAD-BEARING INVARIANT AS SOON AS THERE IS
  //   A SECOND FOE (found 2026-09-12 by `/codex:adversarial-review`,
  //   reproduced here before it was believed).**
  //
  //   `+0x3de6` sets the destination to `defender._x - physical_size(defender)`
  //   unconditionally, which can land BEHIND the walker. In vanilla that is
  //   harmless: there is exactly one defender, so a destination behind you
  //   cannot carry you past anybody. Here it can. Measured: an actor at x = 0
  //   with strength-9 foes at -10 and +20 is offered `walk-right` as its
  //   retreat, the foe at +20 clamps the destination to `20 - 86 = -66`, and
  //   the actor travels LEFT THROUGH the foe at -10 — which the forward pass
  //   above had skipped, because it filters on the REQUESTED direction while
  //   the realised travel had reversed.
  //
  //   So the guard runs on the REALISED direction, and a reversal that would
  //   cross a foe goes NOWHERE rather than part-way. Stopping short would need
  //   a rule for which side of that foe to stop on, and vanilla cannot settle
  //   one (`MAP_SILENCE.multi-slot-arena-geometry`); a walk that goes nowhere
  //   is already this module's answer for walking into the arena wall, and is
  //   still a completed phase that pays and regenerates.
  //
  //   **It cannot bite the forward case**: the loop above leaves `to` at or
  //   before every foe ahead, so nothing there is ever crossed.
  const realised = Math.sign(to - actor.x);
  if (realised !== 0) {
    for (const foe of foes ?? []) {
      if (!foe || foe.alive === false || !Number.isFinite(foe.x)) continue;
      // The same depth predicate as the forward pass. Without it the guard
      // would refuse a reversal because of a body in another rank that never
      // blocked the walk in the first place.
      if (!ss2BodyBlocks(actor, foe)) continue;
      const behindInTravel = (foe.x - actor.x) * realised > 0;
      const overshot = (to - foe.x) * realised > 0;
      if (behindInTravel && overshot) {
        to = actor.x;
        break;
      }
    }
  }
  return clamp(to, SS2_ARENA.clamp.min, SS2_ARENA.clamp.max);
}

/**
 * WHICH WAY EVERY GLADIATOR IS FACING, recomputed from where they stand.
 *
 * ► **THE BUILD DOES THIS EVERY PHASE ADVANCE AND THIS ENGINE DID IT ONCE, AT
 *   CONSTRUCTION. Closed 2026-09-12 at the owner's prompting** — he asked
 *   whether turning could stop being an action, and the answer is that in the
 *   build it never was one.
 *
 * `changeCombatants` (`sprite:862[overlay]/frame:52/DoAction@0x240c7f`) holds
 * the whole of it, and it is four writes in two mirrored branches:
 *
 * ```text
 *   +0x28f3  Less2      if (hero._x < villain._x)
 *   +0x290e    hero.gladiator_dir    = "right"
 *   +0x29cd    villain.gladiator_dir = "left"
 *   +0x2a09  Greater    the mirror
 *   +0x2a24    hero.gladiator_dir    = "left"
 *   +0x2ae3    villain.gladiator_dir = "right"
 * ```
 *
 * Three things in those bytes decide the shape of this function, and all three
 * were re-derived against the oracle rather than taken from the transcription:
 *
 * 1. **It is not an action.** The whole SWF holds 49 references to
 *    `gladiator_dir` and exactly SIX writes — two at arena setup, these four —
 *    and not one is inside a button handler. There is no turn phase, no turn
 *    button, and nothing to spend a turn on. **So making turning free is not a
 *    design choice; it is restoring what the build does.**
 * 2. **It is derived from X ALONE.** Both tests read `_x` and nothing between
 *    `+0x28bf` and `+0x2aea` reads `_y`. A gladiator does not turn to face a
 *    different RANK — which matters here, because this engine has ranks and
 *    the build does not.
 * 3. **It is STRICT on both arms.** `Less2` and `Greater`, so an exact tie runs
 *    neither branch and the previous facing survives. Reproduced below rather
 *    than smoothed over: a co-located pair keeps whatever it had.
 *
 * ## What this engine cannot reproduce, stated rather than discovered later
 *
 * **The build writes BOTH fighters in one breath, so facing is a PAIR
 * property and vanilla can never have two gladiators facing the same way.**
 * That does not survive teams: with three a side, A may face B while B faces
 * C, and no pair-write can express it. So this derives each fighter's facing
 * INDEPENDENTLY, from its own nearest foe — which reduces to the build's
 * mutual answer at 1v1, where each one's nearest foe is the other, and is
 * authored mod surface above it (`MAP_SILENCE.multi-slot-arena-geometry`).
 *
 * ## Why it is a STATUS and not a new field
 *
 * Because it already is one: `SS2_FACING_LEFT` round-trips through the status
 * list (`:2389` in, `:2590` out) and reaches vanilla as `gladiator_dir`. This
 * adds no vocabulary; it stops the existing one lying.
 *
 * ## Why no `fixtureReplay` gate is needed, which is the part worth checking
 *
 * A gladiator with no `x` has nothing to derive a facing FROM, so this returns
 * no effects for it. `fixtureReplay` returns `null` from `startingPosition`,
 * so every promoted golden is exactly that case and cannot be touched. **That
 * matters more here than anywhere else on this axis**: `gladiator_dir` is
 * load-bearing in the golden pipeline — `ss2-attack-candidate.js:214` picks
 * the debris direction from it and `:576` signs the knockback force with it —
 * so a recomputed facing would silently re-datum measured fixtures. The gate
 * is structural rather than a flag, and `run-1v1-fixture.js:115` listing
 * `gladiator_dir` is why it has to be.
 */
export function ss2FacingEffects(sideA, sideB) {
  const effects = [];
  const positioned = (combatant) => combatant && combatant.alive !== false && Number.isFinite(combatant.x);
  const consider = (crowd, opposition) => {
    for (const combatant of crowd) {
      if (!positioned(combatant)) continue;
      let nearest = null;
      let best = Infinity;
      for (const foe of opposition) {
        if (!positioned(foe)) continue;
        const gap = Math.abs(foe.x - combatant.x);
        // Ties break by id, for the same reason `nearestFoe` does: two foes
        // equidistant must not make the facing depend on array order.
        if (gap < best || (gap === best && nearest && foe.id < nearest.id)) {
          nearest = foe;
          best = gap;
        }
      }
      if (!nearest) continue;
      // The build's two STRICT tests. An exact tie runs neither arm, so the
      // facing it already has survives — reproduced, not smoothed.
      if (nearest.x === combatant.x) continue;
      const facesLeft = nearest.x < combatant.x;
      const carries = (combatant.status ?? []).includes(SS2_FACING_LEFT);
      if (facesLeft === carries) continue;
      effects.push({
        kind: EffectKind.STATUS,
        targetId: combatant.id,
        status: SS2_FACING_LEFT,
        active: facesLeft
      });
    }
  };
  consider(sideA, sideB);
  consider(sideB, sideA);
  return effects;
}

/** The living foe standing closest, or null. Ties break by id, deterministically. */
function nearestFoe(view) {
  let best = null;
  let bestDistance = Infinity;
  for (const foe of view.foes) {
    const distance = ss2FightDistance(view.actor, foe);
    if (distance === null) continue;
    if (distance < bestDistance || (distance === bestDistance && best && foe.id < best.id)) {
      best = foe;
      bestDistance = distance;
    }
  }
  return best;
}

/** Which way a walk carries its actor. Left is negative x, as in the build. */
const SS2_WALK_DIRECTION = Object.freeze({
  [Ss2ActionType.WALK_LEFT]: -1,
  [Ss2ActionType.WALK_RIGHT]: 1
});

/**
 * Where a rank change lands, or `null` when there is no rank that way.
 *
 * A rank is a DISCRETE position — `frontY - rankStride * k` for `k` in
 * `[0, rankCount)` — so this is an occupancy step and not a distance. That is
 * deliberate and it is the one place this design takes the 9-agent panel's
 * advice over the build's: a continuous depth would need a second walk
 * displacement nobody has measured, while a rank index needs none. The METRIC
 * between two ranks is still the build's own hypotenuse; only the set of
 * places you may stand is authored.
 *
 * **Unoccupied is not required.** Two gladiators may share a rank, exactly as
 * they may share an x — the overlap clamp is what keeps bodies apart, and it
 * already runs on the x axis within a rank.
 */
/**
 * Where you END UP in x when you step into a lane somebody is standing in.
 *
 * ► **THIS REPLACED A REFUSAL, and the refusal was the wrong shape. Found by
 *   the owner, 2026-09-12: "two gladiators can never be in the same lane, or
 *   potentially swap lanes? Seems wrong to me."**
 *
 *   He was right about the smell and the measurement was worse than the
 *   guess. Withholding the verb when the landing spot was occupied refused
 *   **1,359 of 2,426 in-band rank changes — 56%** — because fighters converge
 *   in x, so once a fight forms everybody is within a body-width of everybody
 *   in the neighbouring lane and nobody can move at all. **Never once did
 *   three bodies share a lane in 1,871 turns**, so a 2-on-1 was unreachable,
 *   and the rank verb was taken 20 times in 1,871 turns: a dead button.
 *
 *   It was also inconsistent with the engine's own answer to this exact
 *   question. **A WALK that would carry you into a body CLAMPS** — you move,
 *   and stop at `defender._x -/+ physical_size(defender)`. The rank change
 *   FORBADE. Same situation, two different rules, and only one of them is the
 *   build's.
 *
 * So a rank change always happens, and if the spot is taken you arrive BESIDE
 * them, on the clamp line a walk would have used, nearest side first. The x
 * shift is bounded by one `physical_size` — smaller than a single walk at any
 * agility above the floor — so this is not a diagonal move by the back door:
 * it cannot be steered and it cannot cover ground.
 *
 * `null` when there is no free spot at all, which is the only case that still
 * refuses the verb.
 */
function ss2RankArrivalX(actorX, bodies, destinationY) {
  const inLane = bodies.filter(
    (body) => body && body.alive !== false && Number.isFinite(body.x) && body.y === destinationY
  );
  const free = (x) => inLane.every((body) => Math.abs(body.x - x) >= ss2PhysicalSize(body));
  if (free(actorX)) return clamp(actorX, SS2_ARENA.clamp.min, SS2_ARENA.clamp.max);

  // The same landing spots a walk uses: one body-width either side of whoever
  // is in the way. Nearest to where you already stand wins, and ties break
  // toward the arena centre so the choice is deterministic.
  const candidates = [];
  for (const body of inLane) {
    const size = ss2PhysicalSize(body);
    candidates.push(body.x - size, body.x + size);
  }
  const reachable = candidates
    .map((x) => clamp(x, SS2_ARENA.clamp.min, SS2_ARENA.clamp.max))
    .filter(free)
    .sort((left, right) => {
      const byDistance = Math.abs(left - actorX) - Math.abs(right - actorX);
      return byDistance !== 0 ? byDistance : Math.abs(left) - Math.abs(right);
    });
  return reachable.length > 0 ? reachable[0] : null;
}

/**
 * The walk that takes an outflanking gladiator PAST its target, or null.
 *
 * Returns a walk only when every one of these holds, and each one is load
 * bearing:
 *
 * 1. **The actor is in a different rank from the target.** In the target's own
 *    rank the build's clamp forbids walking past it at all, so there is no far
 *    side to reach and insisting would park the actor on the near one.
 * 2. **An ally is ALREADY in reach of the target.** This is what keeps the
 *    opening untouched — on turn one nothing is engaged, so this is false for
 *    everybody and the pile-up rule that was removed in 2026-09-12 cannot come
 *    back through this door.
 * 3. **Every such ally is on the same side of the target as the actor.** If
 *    somebody already holds the far side the pincer exists; adding a third body
 *    to it is the queue this arm is for avoiding.
 * 4. **The actor is not already past the target.** Once past, this returns null
 *    and the rank arm brings it in behind.
 *
 * AUTHORED, and inside `MAP_SILENCE.multi-slot-arena-geometry` like every other
 * multi-gladiator positioning rule: vanilla has one gladiator a side and cannot
 * express a pincer, so there is nothing here to be faithful to.
 */
export function ss2FlankingWalk(view, target, options) {
  const actor = view.actor;
  if (!Number.isFinite(target.x) || !Number.isFinite(actor.x)) return null;
  // (1) A different rank, or there is no way round.
  if (target.y === actor.y) return null;

  // (2) and (3): allies already engaging, and which side they hold.
  const engaging = view.allies.filter((ally) =>
    ally.id !== actor.id
    && ally.alive !== false
    && Number.isFinite(ally.x)
    && ss2FightDistance(ally, target) < ss2Reach(ally));
  if (engaging.length === 0) return null;

  const actorSide = Math.sign(actor.x - target.x);
  if (actorSide === 0) return null;
  if (engaging.some((ally) => Math.sign(ally.x - target.x) !== actorSide)) return null;

  // (4) Past it already? Then the rank arm should take over.
  const beyond = target.x - actorSide * ss2PhysicalSize(target);
  if ((actor.x - beyond) * actorSide <= 0) return null;

  // Walk TOWARD and through: the far side is whichever way the target lies.
  const towardType = target.x > actor.x ? Ss2ActionType.WALK_RIGHT : Ss2ActionType.WALK_LEFT;
  return options.find((option) => option.type === towardType) ?? null;
}

function ss2RankDestination(actorY, direction, rankStride) {
  if (!Number.isFinite(actorY) || rankStride <= 0) return null;
  const to = actorY + direction * rankStride;
  const rearmost = SS2_ARENA.frontY - rankStride * (SS2_ARENA.rankCount - 1);
  if (to > SS2_ARENA.frontY || to < rearmost) return null;
  return to;
}

/** Which way a rank change carries its actor. Arena y DECREASES going back. */
const SS2_RANK_DIRECTION = Object.freeze({
  [Ss2ActionType.RANK_BACK]: -1,
  [Ss2ActionType.RANK_FRONT]: 1
});

/**
 * Each attacking verb's `attack_direction` and its `staminacost` factor.
 *
 * ► **`low`/`high` MEANS "DRAW ONE", `direction` MEANS "DO NOT". The
 *   distinction is a tape-length fact, not a style choice.** The three melee
 *   bands each assign their direction with a `randomBetween` —
 *   `randomBetween(9, 12)` at `+0x608a`, `(5, 8)` at `+0x61f1`, `(1, 4)` at
 *   `+0x635c`. The three verbs added with the bow assign a CONSTANT and call no
 *   RNG at all: `attack_direction = 23` at `+0x64c3`, `= 21` at `+0x6c67`,
 *   `= 22` at `+0x6c8c`. A `randomBetween(21, 21)` here would be harmless
 *   arithmetic and a real defect — it would take a sample off the ordered
 *   channel that the build never takes, so every peer replaying the same tape
 *   would fall one entry out of step from the first shot onward.
 *
 * The factors are the build's own, one shared branch per row:
 *   `power_attack`  `round(strength * 3)`  `+0x603c`
 *   `normal_attack` `round(strength * 2)`  `+0x61a3`
 *   `quick_attack`  `round(strength)`      `+0x6317`
 *   `bash_attack`   `round(strength * 2)`  `+0x6475`
 *   bombard / snipe `round(strength * 3)`  `+0x6bb5`, ONE branch for all four
 *                                          handed labels
 */
const ATTACK_BANDS = Object.freeze({
  [Ss2ActionType.QUICK_ATTACK]: Object.freeze({ low: 1, high: 4, strengthFactor: 1 }),
  [Ss2ActionType.NORMAL_ATTACK]: Object.freeze({ low: 5, high: 8, strengthFactor: 2 }),
  [Ss2ActionType.POWER_ATTACK]: Object.freeze({ low: 9, high: 12, strengthFactor: 3 }),
  [Ss2ActionType.BOMBARD]: Object.freeze({ direction: 21, strengthFactor: 3, ranged: true }),
  [Ss2ActionType.SNIPE]: Object.freeze({ direction: 22, strengthFactor: 3, ranged: true }),
  [Ss2ActionType.BASH_ATTACK]: Object.freeze({ direction: 23, strengthFactor: 2 })
});

/**
 * `psyche_up`, WHICH IS NOT A BAND AND MUST NOT BECOME ONE.
 *
 * ► **MEMBERSHIP OF `ATTACK_BANDS` MEANS "ALWAYS ATTACKS", AND TWO OF THIS
 *   ACTION'S THREE PRESSES ROLL NOTHING.** The phase reads the counter and
 *   plays `psyche_up`, `psyche_up2` or `psyche_up3` for 1, 2 and >= 3
 *   (`+0x658a`, `+0x65b9`, `+0x65ef`); only the third arm reaches
 *   `checkattackroll`. A band entry would put two samples on the ordered
 *   channel that the build never takes, and every peer replaying the same tape
 *   would fall one entry out of step from the first charge onward — the same
 *   defect the ranged block above warns about, from the other direction.
 *
 * ► **THE DISCHARGE IS BAND-SHAPED ALL THE SAME**, because once the counter
 *   says fire it is an ordinary fixed-direction attack: direction 30, no draw.
 *   It is handed to the attack path only on the press that discharges.
 *
 * `strengthFactor` is 1 — `staminacost = round(strength)` at `+0x653f`. **That
 * is the COST and not the damage**, which is the trap this row exists to
 * label: it sits in the map's `staminacost`-by-phase table beside
 * `power_attack round(strength * 3)` and `rest 0 - round(stamina * 15)`, and a
 * table whose `rest` row is negative can only be a cost table. The damage is
 * `ceil(max_damage * 1.5)` with a `character_level * 10` floor, and it already
 * lives in `directionProfile`'s `direction === 30` arm.
 *
 * ► **AND THE CONSEQUENCE NOBODY WOULD NOTICE: THE AI NEVER PSYCHES UP.**
 *   `suggestAction`'s `attackOnOffer` test and its expected-value table are
 *   both keyed on `ATTACK_BANDS[option.type]`, and this action is deliberately
 *   not a band — so no AI opponent selects the verb, in any position, at any
 *   level. A human can psyche; a machine cannot.
 *
 *   **A side effect of a correct decision, not a defect, and written down
 *   because the alternative is discovering it.** A sweep over real bouts would
 *   report the feature working over a population of zero — exactly the failure
 *   this project recorded about the twelve figure-pack effect groups a day
 *   earlier, where the art was fine and nothing reached it.
 *
 *   Teaching the AI to charge is a real design question and is the OWNER'S: it
 *   prices three turns of no damage against one blow of
 *   `ceil(max_damage * 1.5)`, and the answer changes how every bout reads.
 */
/** `attack_direction = 20` (`+0x6981`), the taunt's own dispatcher direction. */
const SS2_TAUNT_DIRECTION = 20;

const PSYCHE_UP_DISCHARGE = Object.freeze({ direction: 30, strengthFactor: 1 });

/**
 * The band profile for a taunt that reaches `checkattackroll` — `taunt_effect
 * == 1`, and only that.
 *
 * ► **IT CARRIES ITS OWN TRANSITION BECAUSE A TAUNT IS PRICED LIKE A REST AND
 *   NOT LIKE A SWING.** Every other band pays `round(strength * factor)` and
 *   gains nothing; the taunt branch spends `round(charisma * 2)` (`+0x67bb`),
 *   gains `+= stamina` (`+0x6894`) and heals `3 + ceil(stamina)` (`+0x684c`),
 *   all three on the same `attacker.struck == null` guard the rest branch uses.
 *   Routing it through the shared strength formula would have repriced the
 *   action and dropped the recovery entirely — which is why `strengthFactor` is
 *   absent here rather than set to something plausible.
 */
/**
 * The taunt branch's OWN recovery, applied and clamped BEFORE anything else —
 * which is the build's order and was not this engine's until a Codex review of
 * `8ede824` reproduced the difference.
 *
 * ► **THE ORDER IS LOAD-BEARING AND THE BYTES SETTLE IT.** `staminacost` is set
 *   at `+0x67bb`, `hitpoints += 3 + ceil(stamina)` at `+0x684c`,
 *   `staminaleft += stamina` at `+0x6894`, and then **`check_stats` clamps at
 *   `+0x68d3` — all of it BEFORE the `diceroll` at `+0x6921` and the
 *   `checkattackroll` at `+0x698c`.** Two consequences the first cut got wrong:
 *
 *   - **the recovery survives a lethal strike**, because it has already
 *     happened by the time the blow is rolled; and
 *   - **the gain clamps before the cost is spent**, so a full-stamina taunter
 *     does not bank the overflow. Measured: 220/220, charisma 30, stamina 12
 *     ends at **165**, not the 177 a single bundled transition gives.
 *
 * ► **AND IT IS THE TAUNT THAT EXPOSED IT, NOT A NEW DEFECT.**
 *   `phaseTransitionEffects` has always bundled a branch's gain with
 *   `nextphase`'s into one clamp, and `rest` — the only other action shaped
 *   this way — cannot show the difference because its cost is NEGATIVE: it
 *   never spends, so there is no second stage to clamp before. A taunt gains 12
 *   and spends 60, which is the first time the two stages are distinguishable.
 */
function tauntRecovery(actor) {
  const stamina = actor.stats.stamina;
  const declared = declaredResourceNames(actor);
  const staminaMax = resourceValue(actor, "staminamax", 0);
  const before = resourceValue(actor, "staminaleft", 0);
  // `check_stats` at `+0x68d3` is the clamp, and it runs here rather than after
  // the cost.
  const staminaleft = clamp(before + stamina, 0, staminaMax);
  const healed = Math.min(
    SS2_TAUNT.branchHealBase + Math.ceil(stamina),
    Math.max(0, actor.maxHealth - actor.health)
  );
  const effects = [];
  if (declared.has("staminaleft") && staminaleft !== before) {
    effects.push({
      kind: EffectKind.RESOURCE, targetId: actor.id, resource: "staminaleft", to: staminaleft
    });
  }
  if (healed > 0) effects.push({ kind: EffectKind.HEAL, targetId: actor.id, amount: healed });
  return { effects, staminaleft, healed, health: Math.min(actor.maxHealth, actor.health + healed) };
}

const TAUNT_STRIKE = Object.freeze({
  direction: SS2_TAUNT_DIRECTION,
  // ► **`charisma` IS A RESOURCE AND NOT A STAT**, which is the whole reason
  //   `actor.stats` is not enough here: `roster.normaliseCombatant` rebuilds
  //   `stats` as seven fixed generic keys — strength, agility, attack, defense,
  //   vitality, stamina, magicka — and every SS2-specific value travels in the
  //   numeric resource bag instead. `stamina` happens to be in both; `charisma`
  //   is only in the bag.
  // ► **THE RECOVERY IS NOT HERE, AND THAT IS THE FIX.** It is applied by
  //   `tauntRecovery` before the roll, as the build does, and this hands
  //   `nextphase` the POST-recovery state to compute its own stage from. A
  //   bundled `branchGain`/`branchHeal` here would clamp once instead of twice
  //   and let a full-stamina taunter bank the overflow.
  transitionFor: (actor, recovered) => ({
    staminaCost: Math.round(resourceValue(actor, "charisma", 0) * 2),
    fromStaminaleft: recovered ? recovered.staminaleft : null,
    fromHealth: recovered ? recovered.health : null
  })
});

/**
 * How the counter behaves, all in one place because three of these four
 * numbers are easy to get one out.
 */
export const SS2_PSYCHE_UP = Object.freeze({
  /** `psyche_up`, `psyche_up2`, `psyche_up3` for 1, 2 and >= 3. */
  clips: Object.freeze(["psyche_up", "psyche_up2", "psyche_up3"]),
  /** The value at which the press fires the range-gated grievous. */
  dischargeAt: 3,
  /**
   * ► **THE FLOOR IS 1 AND NOT 0.** ~~Both resets write `= 1`~~ **ALL EIGHT DO —
   *   the census is complete as of 2026-09-17, and this engine and the battle
   *   map between them had THREE of them.** `nextphase` `+0x35c7`-`+0x35ea` on
   *   any decision that is not `psyche_up`, `damagecharacter` `+0x1be4` to the
   *   defender and `+0x16b5`/`+0x16c2` to both on a grievous, `+0x6738` the
   *   discharge's own write-back — **plus three nothing here recorded**:
   *   `+0x148e` (`magic_damage_character`, the defender), `+0x6ac8` (a landed
   *   `taunt` against a bow-mode defender) and `+0x7a6a` (`cast_whirlwind`'s
   *   write-back, which has NO matching increment, so a whirlwind caster is
   *   left at 1 where a discharger is left at 2). **None of the three is live**
   *   — this engine has no magic-damage, taunt or whirlwind verb — and each
   *   goes live the day one is built. See the battle map's write census.
   *
   *   So a gladiator who has taken
   *   any other turn is at 1, which is what "fresh" means here. What the build
   *   holds before the FIRST write is a map silence
   *   (`psyche-up-initialisation`), and this models the reset rather than
   *   inventing an initial value.
   */
  floor: 1,
  /** `defender._x -/+ round(weapon_range + 50)`, `+0x6658`-`+0x6699`. */
  rangeBonus: 50
});

/**
 * THE TAUNT PHASE, and every number in it is the build's.
 *
 * ► **IT IS SHAPED LIKE `rest`, WHICH IS WHY THEY SHARE A BUTTON.** Both
 *   restore stamina and health on the same `attacker.struck == null` guard:
 *   `rest` spends `0 - round(stamina * 15)` and taunt spends
 *   `round(charisma * 2)` (`+0x67bb`), both gain `+= stamina` (`+0x521d`,
 *   `+0x6894`) and both heal `3 + ceil(stamina)` (`+0x51d5`, `+0x684c`).
 *   **A taunt is the aggressive rest**: you recover, and the opponent pays for
 *   it. The controller makes the same point by wiring them into ONE slot,
 *   split at half stamina — above it you can afford the flourish, below it you
 *   just breathe.
 *
 * ► **AND `+0x684c` IS THE OFFSET THIS DOCUMENT HAS ALREADY BEEN BURNED BY.**
 *   `ss2-rules.js` once asserted it was the SOLE site for `3 + ceil(stamina)`,
 *   overruling the map's prose, and a test was written to pin the wrong number;
 *   two verifiers broke it. It is real and it is the TAUNT branch's own — the
 *   rest branch's is `+0x51d5` — and both were read directly here rather than
 *   taken from the writers table that started the error.
 */
export const SS2_TAUNT = Object.freeze({
  /**
   * `diceroll < game_attacker.taunt_percentage` (`+0x694b`).
   *
   * ► **A DIRECT COMPARISON, AND NOT THE DISPATCHER'S `100 - chance` FORM.**
   *   The map flags this at the site because the two are easy to conflate and
   *   getting it backwards inverts the whole action: a charismatic gladiator
   *   would fail where a dull one succeeded.
   */
  rollMax: 100,
  /** `taunt_effect = randomBetween(1, 2)` (`+0x6952`); only 1 reaches the dispatcher. */
  effectMax: 2,
  /** `taunt_effect == 1` sets `attack_direction = 20` and calls `checkattackroll`. */
  strikeEffect: 1,
  /** The direction the strike arm dispatches, whose profile the candidate already owns. */
  direction: 20,
  /** `staminacost = round(charisma * 2)` (`+0x67bb`). */
  charismaCostFactor: 2,
  /** `hitpoints += 3 + ceil(stamina)` (`+0x684c`), and `staminaleft += stamina` (`+0x6894`). */
  branchHealBase: 3,
  /**
   * `force = +/- game_attacker.charisma * 25`, clamped to at least 20 away from
   * zero (`+0x69d4`-`+0x6a7b`).
   */
  forceFactor: 25,
  minimumForce: 20,
  /**
   * The knockback ANIMATION plays only above this; the DISPLACEMENT is
   * unconditional (`+0x6a21`/`+0x6a91` against the unconditional
   * `knockback(defender, force)` at `+0x6ab1`). Same shape as
   * `damagecharacter`, where the fighter always moves and only the clip is
   * gated.
   *
   * ► **AND THIS ENGINE DISPLACES NOBODY, ON EITHER PATH — a pre-existing gap
   *   this action joins rather than introduces.** `damagecharacter`'s knockback
   *   already travels as an EVENT FIELD (`knockback: {...}` on the resolved
   *   attack) and emits no `EffectKind.POSITION`; nothing in `src/adapter/` or
   *   the shell reads it. So a knocked-back gladiator plays the clip and stays
   *   exactly where he was, and the taunt's shove does the same.
   *
   *   **Reported rather than fixed on purpose**: emitting positions for
   *   knockbacks moves gladiators, and position is in `combatStateHash`, so it
   *   would re-datum every pinned hash and every golden that carries one. That
   *   is its own decision with its own evidence, not a rider on a new verb.
   */
  knockbackAnimationForce: 100,
  /**
   * Half stamina: at or above it the controller wires `taunt`, below it `rest`
   * (`+0x0c0a`/`+0x10a2` on frame 5, `+0x0c15`/`+0x110a` on frame 20).
   * **`closerange_archer` has no stamina test at all and always wires it**, and
   * `closerange_warrior` wires no taunt in either facing.
   */
  staminaPercent: 50,
  /** The flag a losing taunt sets on the target (`+0x6ad9`). */
  flag: "taunted1",
  /**
   * ► **THE CONSEQUENCE THAT IS NOT BUILT, AND SAYING SO IS THE POINT.** A
   *   taunt that rolls effect 2 against a bow-mode defender sets `taunted1`,
   *   and this engine sets it faithfully — the flag is already in
   *   `SS2_TAUNT_FLAGS` and `defenderEffects` already clears it. **Nothing
   *   reads it.** The build's decision table row 3 drives a taunted gladiator
   *   into `getphase("runleft")` facing right and `getphase("runright")` facing
   *   left (`+0x0d68`-`+0x0e35`) — it RUNS AWAY from the way it is facing.
   *
   *   That is a MOVEMENT phase at the run's own step factor
   *   (`SS2_MOVEMENT_STEP_FACTOR.run`, 40 against a walk's 16), which means
   *   `ss2WalkDestination` needs a step parameter it does not have. **A
   *   separate increment on purpose**: widening a function twenty tests cover,
   *   to finish a fourth arm of an action whose other three are complete, is
   *   the kind of scope creep that lands both half-done.
   *
   *   **So a taunted gladiator carries a status that does nothing yet.** The
   *   state is right and the consequence is missing, which is the honest half
   *   to ship — and it is stated here rather than discovered.
   */
  fleePhase: Object.freeze({ right: "runleft", left: "runright" })
});

/**
 * Is a discharge in range of this target?
 *
 * ► **ONE EXPRESSION, TWO CALLERS, BECAUSE A SECOND COPY IS A SECOND CHANCE TO
 *   BE WRONG.** The resolver gates the discharge on it — out of range it
 *   decides nothing, keeps the charge and says `outOfRange` — and
 *   `suggestAction` needs the same answer to avoid building a charge it cannot
 *   spend. `suggestAction`'s own comments make this argument twice about the
 *   walk arms ("a second distance computation here would be a second chance to
 *   be wrong"); this is the same rule applied to the same file.
 *
 * The gate is `round(reach + 50)`, which is 50 units MORE generous than melee
 * reach — so anything a melee verb can hit, a discharge can reach. Measured
 * over 231 in-reach cases: 0 out-of-range presses.
 */
function ss2PsycheDischargeInRange(actor, target) {
  const separation = ss2FightDistance(actor, target);
  if (!Number.isFinite(separation)) return false;
  return separation <= Math.round(ss2Reach(actor) + SS2_PSYCHE_UP.rangeBonus);
}

/** The three melee verbs, which are the ONLY ones `closerange_warrior` wires. */
const MELEE_ATTACKS = Object.freeze([
  Ss2ActionType.QUICK_ATTACK,
  Ss2ActionType.NORMAL_ATTACK,
  Ss2ActionType.POWER_ATTACK
]);

/** The label the direction draw takes on the ordered channel. See the header. */
export const ATTACK_DIRECTION_ROLL_LABEL = "attack-direction-roll";

/* ------------------------------------------------------------------ */
/* The SS2 field set, and the two channels it travels on                */
/* ------------------------------------------------------------------ */

/** The eight armour pieces, in `battlevalues` assignment order. */
export const SS2_ARMOUR_PIECES = Object.freeze([
  "helmet",
  "shoulderguard",
  "breastplate",
  "gauntlet",
  "greaves",
  "shinguard",
  "boot",
  "shield"
]);

/**
 * `_global.<piece>_dval`, read at root frame 35 `+0x3089`-`+0x30e4`.
 * `helmet_defence` is branched (`round(herolevel * 0.5 * dval)` above id 25)
 * and `shield_defence` is flat 0 in bow mode; `ss2BattleValues` carries both.
 */
export const SS2_ARMOUR_DVAL = Object.freeze({
  breastplate: 16,
  helmet: 10,
  shinguard: 6,
  greaves: 3,
  shoulderguard: 8,
  gauntlet: 5,
  boot: 2,
  shield: 12
});

/**
 * The six vanilla condition flags. Statuses, not resources: they are booleans.
 *
 * The first four are in `death()`'s own clear order — frozen, burning, poison,
 * life_stolen — which is also `STATUS_FIELDS` in
 * `src/golden/ss2-attack-candidate.js`. This list read burning-first until an
 * adversarial verifier caught it while the docstring below claimed it was the
 * build's order. Two lists that must agree, only one of which was checked.
 */
export const SS2_DEATH_CLEAR_FLAGS = Object.freeze([
  "frozen",
  "burning",
  "poison",
  "life_stolen"
]);

/** The two taunt flags. `death()` clears these per FIELD across both sides. */
export const SS2_TAUNT_FLAGS = Object.freeze(["taunted1", "taunted2"]);

export const SS2_STATUS_FLAGS = Object.freeze([...SS2_DEATH_CLEAR_FLAGS, ...SS2_TAUNT_FLAGS]);

/**
 * `gladiator_dir` as a status token. Resources are finite numbers, so a string
 * cannot be one; status is the only per-combatant string channel that is both
 * on the view and inside the hash.
 */
export const SS2_FACING_LEFT = "facing-left";

/**
 * What a blow from behind adds, as a fraction of the damage that landed.
 *
 * AUTHORED — vanilla has no directional attack advantage at all
 * (`ss2IsBackAttack`). Chosen by measurement rather than taste: see the commit
 * that introduced it for the flanker's win rate at 0, 0.5 and 1.0.
 */
export const SS2_BACK_ATTACK_BONUS = 0.5;

/**
 * Every resource name this rule set reads. A blueprint that declares all of
 * them can never make the arithmetic fall back on a default.
 *
 * ► **`weapon_range` JOINED THIS LIST 2026-09-11, and it is a projection
 *   change: every `ss2Combatant` built from a record that resolves a `weapon`
 *   id now carries one more hashed number.** It is here for the same reason
 *   `min_damage` and `max_damage` are — a `battlevalues` OUTPUT the rule set
 *   reads and cannot otherwise see — and NOT as a way to carry equipment
 *   identity: the `weapon` id itself is still outside this list, still outside
 *   `CANONICAL_RESOURCE_SOURCES`, and still gated in `ss2Combatant`.
 *   `ss2Reach` reads it; the controller gate reads `ss2Reach`.
 *
 *   ► **IT REACHES ONLY THE `derive: true` PATH, and the commit that added it
 *     said so too broadly** — "every `ss2Combatant` built from a record that
 *     resolves a `weapon` id carries one more hashed number". A `derive: false`
 *     record carries `weapon_range` only if it STATES one, because
 *     `ss2BattleValues` never runs. `tools/arena/roster.js` is the live
 *     counterexample: it states `weapon: 1` and builds with `derive: false`, so
 *     every demo gladiator declares 32 names and takes `ss2Reach`'s fallback.
 *     Found by the entry-point verifier, 2026-09-12.
 *
 *   **It is deliberately absent from `SS2_RESOURCE_DEFAULTS`**, so a combatant
 *   that resolves no weapon id simply does not declare it and `ss2Reach` falls
 *   back to the build's bare-hands row. A flat constant default would be wrong
 *   at every strength, and a declared-but-defaulted key would move the hash of
 *   every fixture that has no weapon — including all 23 promoted goldens.
 */
export const SS2_RESOURCE_NAMES = Object.freeze([
  // ► **THE PSYCHE COUNTER, AND IT IS DELIBERATELY ABSENT FROM
  //   `SS2_RESOURCE_DEFAULTS`** — for the reason `weapon_range` is, plus one of
  //   its own. A name WITH a default is filled into every combatant that does
  //   not state it, including every golden's, and **that moves all 23 golden
  //   replay hashes** (measured; the repository already did this once at
  //   `86ccb68`, where the armoured golden went `70e605e1` -> `4032d673` and
  //   the suite stayed green because nothing pinned the shape).
  //
  //   The build's own floor is **1, not 0**: both resets write `= 1`
  //   (`nextphase` `+0x35c7`-`+0x35ea` on any non-`psyche_up` decision,
  //   `damagecharacter` `+0x1be4` to the defender). So "absent" is read as 1
  //   here — a fresh gladiator, which is what the build leaves everyone in
  //   after their first turn of any kind. **What the build holds BEFORE the
  //   first write is a MAP SILENCE** (`psyche-up-initialisation` in
  //   `src/adapter/vanilla-fields.js`) and this models the reset value rather
  //   than inventing an initial one.
  "psyche_up",
  "ammo_left",
  "armourclass",
  "armourclass_max",
  "character_level",
  "charisma",
  // ► **THE TRANSIENT `bash_attack` INHERITS, AND IT IS THE ONE FIELD HERE
  //   THAT IS NARROWER THAN THE BUILD'S. Say so at the field, not in a
  //   handoff.**
  //
  //   `checkattackroll` assigns `criticalhit` on every attacking branch — even
  //   a miss, because the assignment is ahead of the hit test — and direction
  //   23 assigns NOTHING, so a bash reads whatever the last branch left
  //   (`+0x64c3` sets only the direction; the map states the inheritance at
  //   §"Two transient/boundary behaviors", and records it as a static
  //   candidate that no capture has promoted).
  //
  //   **In the build the variable lives on the OVERLAY TIMELINE, not on a
  //   gladiator** — it is a bare `SetVariable` at `+0x2e7e`/`+0x2eeb`, and a
  //   live trace caught it leaking out as a raw 21 (§"Direction 20 is the taunt
  //   path", session-adc21). So vanilla's bash inherits whatever EITHER fighter
  //   last rolled. Here it is per-combatant: the actor's own last swing.
  //
  //   That is a narrowing and it is deliberate. With six gladiators on the
  //   frame "the previous action" names nobody in particular, and the
  //   alternative — battle-level state — is not something a rule set has:
  //   `actorView` hands over `turnNumber`, `actor`, `allies` and `foes` and
  //   nothing else, so a shared transient would be a resolver-contract change
  //   carrying its own decision. **At 1v1 against a fighter that never bashes
  //   the two readings coincide**, and no promoted golden resolves direction 23
  //   at all, so no measurement distinguishes them today.
  //
  //   It matters because a critical BYPASSES ARMOUR: `effectiveMethod` of
  //   `critical` skips the armour branch entirely in the candidate ingress, so
  //   a bash that follows your own critical lands in full on hitpoints.
  "criticalhit",
  "equipped_weapon",
  "herolevel",
  "max_damage",
  "maximum_ammo",
  "min_damage",
  "weapon_range",
  // ► **THE TWO ITEM IDS, DECLARED 2026-09-14 SO THE GLADIATOR CAN HOLD HIS
  //   WEAPON.** They are APPEARANCE selectors, not arithmetic: no rule here
  //   reads either, and both damage bands, the ranges and the enchantments are
  //   already separate declared resources derived FROM them. What they do is
  //   carry the linkage suffix — `weapon` 1 is the art `weapon1` — which is
  //   what `updatecharacter` attaches and what this engine could not see.
  //
  //   **Until now 89 of the 387 extracted wardrobe pieces — the whole weapon
  //   slot, 23% of the wardrobe — were indexed by nothing**, because the ids
  //   never reached the projection. Adding the rows to `ATTACHMENTS` was
  //   necessary and could not have been sufficient: a renderer cannot draw a
  //   number the wire does not carry.
  //
  //   ► **THIS IS A PROJECTION CHANGE AND IT MOVES HASHED STATE**, exactly as
  //     `weapon_range` did on 2026-09-11. `combatStateHash` covers the resource
  //     bag, so a seeded pin moves; `BATTLE_STATE_VERSION` does NOT, because it
  //     hashes `COMBATANT_PROJECTION_FIELDS` and `resources` was already in it.
  //     **No golden may move**: a fixture declares its own resources and is
  //     never offered these.
  //
  //   Deliberately absent from `SS2_RESOURCE_DEFAULTS`, for the reason
  //   `weapon_range` is: a combatant that never had a weapon id must read as
  //   ABSENT rather than as the build's weapon 0, which is a real bare-handed
  //   row and would be a claim rather than a silence.
  "weapon",
  "secondary_weapon",
  // ► **THE BOW'S OWN THREE NUMBERS, CARRIED BESIDE THE MELEE ONES RATHER THAN
  //   REPLACING THEM — and that is the one shape decision `swap_weapons`
  //   turns on.**
  //
  //   `battlevalues`'s bow block OVERWRITES `min_damage`, `max_damage` and
  //   `weapon_range` in place (`+0x3424`-`+0x344a`). The build can afford that
  //   because it recomputes all three from the weapon ids on every call, and
  //   `nextphase` calls it for both combatants at every phase transition. This
  //   engine cannot: equipment identity is deliberately OUTSIDE the resource
  //   bag, so by the time a combatant reaches the resolver the ids are gone and
  //   an overwritten melee pair could never be rebuilt.
  //
  //   So the bag carries BOTH sets and `equipped_weapon` says which is live.
  //   `ss2ActiveDamagePair` and `ss2Reach` do the selection at READ time, which
  //   is the same function the build computes at write time — and it means a
  //   swap writes exactly ONE resource (`equipped_weapon`) instead of three,
  //   so there is no way for the two halves to fall out of step.
  //
  //   **`weapon_min_damage`/`weapon_max_damage` are deliberately NOT here.**
  //   They are the build's raw table columns, needed only to rebuild a pair
  //   that this engine never destroys.
  "secondary_weapon_max_damage",
  "secondary_weapon_min_damage",
  "secondary_weapon_range",
  "secondary_weapon_enchantment_damage",
  "secondary_weapon_enchantment_potency",
  "secondary_weapon_enchantment_type",
  "staminaleft",
  "staminamax",
  "weapon_enchantment_damage",
  "weapon_enchantment_potency",
  "weapon_enchantment_type",
  ...SS2_ARMOUR_PIECES,
  ...SS2_ARMOUR_PIECES.map((piece) => `${piece}_defence`)
].sort());

/**
 * The resources every combatant must declare, whatever it goes on to do.
 * Checked at roster CONSTRUCTION, because both gate `legalActions` for a
 * gladiator that has not swung yet: the forced-rest gate reads `staminaleft`
 * before any player choice, and `staminamax` at or below zero makes the battle
 * a fixpoint. Neither has a defensible default.
 */
export const SS2_CONSTRUCTION_REQUIRED_RESOURCES = Object.freeze([
  "staminaleft",
  "staminamax"
]);

/**
 * The resources required of whoever ATTACKS, checked when the swing resolves
 * rather than when the battle is built.
 *
 * WHY THE ROLE MATTERS, and it is measured rather than assumed. Every read of
 * this pair in `ss2-attack-candidate.js` is on `attacker.*` — `:109`, `:116`,
 * `:124`, `:136`, `:139`, `:148`, `:154` — and the file contains NO
 * `defender.min_damage` or `defender.max_damage` read at all. A defender's
 * damage pair cannot reach the arithmetic of a blow aimed AT it.
 *
 * That was independently established from the runtime first (2026-09-02):
 * `golden-armoured-deflection-threshold-cleared` replays with `calculation`,
 * `mutation`, `mutationTrace` and `state` all deepEqual whether the villain is
 * given 1/1 or 999/999, and the two capture sessions the golden cites recorded
 * DIFFERENT villains — strength 7 with 18/30 against strength 1 with 7/22 —
 * and produced identical measured outcomes.
 *
 * So requiring the pair of a pure defender refused a fixture the map says is
 * complete. **This is the hole this split fills, and it overwrites nothing: a
 * gladiator that omits the pair and then swings is still refused, by name, at
 * the moment the omission would change a number.**
 *
 * The alternative — a poisoned sentinel pair that throws when READ — was
 * costed and rejected as unachievable: `initialiseCombatant`
 * (`ss2-attack-candidate.js:55-56`) is eager over every field, so a throwing
 * accessor fires for the defender too, before any arithmetic decides whether
 * it wanted the value. `test/ss2-golden-resolver-replay.test.js` pins the
 * invariance directly instead, over the whole corpus.
 */
export const SS2_ATTACKER_REQUIRED_RESOURCES = Object.freeze([
  "max_damage",
  "min_damage"
]);

/**
 * The union: every resource whose absence changes the fight rather than
 * defaulting to the build's own zero.
 *
 * Everything else on `SS2_RESOURCE_NAMES` has a defensible zero: no armour, no
 * enchantment, weapon slot 1. These four do not — `min_damage` absent means a
 * gladiator hitting for 1, which is a fight, just not this one's.
 *
 * DERIVED from the two role sets rather than restated, so a name added to one
 * of them cannot go missing here.
 */
export const SS2_REQUIRED_RESOURCES = Object.freeze(
  [...SS2_ATTACKER_REQUIRED_RESOURCES, ...SS2_CONSTRUCTION_REQUIRED_RESOURCES].sort()
);

/**
 * The value a resource takes when a gladiator does not state one — "no armour,
 * no enchantment, weapon slot 1, level 1".
 *
 * These are DECLARED rather than left absent, deliberately — but not for the
 * reason this comment used to give. It claimed an absent resource is invisible
 * to `combatStateHash`; that is wrong, because an absent resource is a
 * code-level fallback both peers share, and a resource declared on one peer
 * and absent on the other already changes the projection's key set and so the
 * hash. What declaring actually buys is that `defenderEffects` and
 * `phaseTransitionEffects` SKIP writes to undeclared names, so an omitted
 * `armourclass` would run the whole armour arithmetic and then silently
 * discard the result. (Corrected after a verifier broke the old reasoning.)
 *
 * The four names on `SS2_REQUIRED_RESOURCES` are absent from this table on
 * purpose: they have no defensible default, so a gladiator that omits one is
 * refused instead.
 */
export const SS2_RESOURCE_DEFAULTS = Object.freeze({
  armourclass: 0,
  armourclass_max: 0,
  character_level: 1,
  charisma: 0,
  /**
   * No shots and no bow, which is the state root frame 221 puts every
   * gladiator in at battle construction (`equipped_weapon = 1`,
   * `using_bow = false`, map `:111`). A combatant that states neither an
   * `ammo_left` nor a `maximum_ammo` is a melee fighter and these two never
   * move.
   */
  ammo_left: 0,
  maximum_ammo: 0,
  /**
   * **ZERO IS "NO INHERITED CRITICAL", AND IT IS THE SAFE DIRECTION.** The
   * build's transient is whatever the last branch left, and a fresh battle has
   * had no branches — so the first bash of a bout inherits nothing, here and
   * there alike. 0 is also the value `snipe` writes (`+0x2eeb`), so it is the
   * build's own spelling for "not a critical" rather than a sentinel chosen
   * here, and it can never manufacture the armour bypass that 20 does.
   */
  criticalhit: 0,
  equipped_weapon: 1,
  herolevel: 1,
  /**
   * The bow's three numbers default to 0, which is what `battlevalues`
   * computes for a gladiator carrying nothing in that slot: its own
   * `secondary_weapon_min_damage` for an unresolvable id is `undefined`, which
   * `+0x3395`'s `Add2` treats as 0, and `ss2WeaponEntry` returns null so no
   * `secondary_weapon_range` is derived at all.
   *
   * **A zero here is "no bow", and `legalActions` reads it that way**: a
   * gladiator with `secondary_weapon_range` 0 is never offered the swap, so it
   * can never arm a weapon with no reach and no damage and then be stuck
   * holding it.
   */
  secondary_weapon_max_damage: 0,
  secondary_weapon_min_damage: 0,
  secondary_weapon_range: 0,
  /**
   * The MIDDLE of the six-entry `weaponweights` index, so a combatant that
   * states no weapon swings something unremarkable rather than free or
   * crippling. AUTHORED default over a real field; see `SS2_SWING` for the
   * direction problem and what settles it.
   */
  attack_speed: 3,
  // Declared with a defensible zero: no enchantment means no tick damage. The
  // status phase reads these at TICK time off whoever inflicted the condition,
  // matching the build, which reads `game_defender.weapon_enchantment_damage`
  // at the phase rather than caching it when the status landed — so changing
  // weapons between the hit and the tick changes the tick.
  secondary_weapon_enchantment_damage: 0,
  weapon_enchantment_damage: 0,
  secondary_weapon_enchantment_potency: 0,
  secondary_weapon_enchantment_type: 0,
  weapon_enchantment_potency: 0,
  weapon_enchantment_type: 0,
  ...Object.fromEntries(SS2_ARMOUR_PIECES.map((piece) => [piece, 0])),
  ...Object.fromEntries(SS2_ARMOUR_PIECES.map((piece) => [`${piece}_defence`, 0]))
});

/** Resource names this rule set can write. Each write is guarded on declaration. */
export const SS2_WRITTEN_RESOURCES = Object.freeze([
  "ammo_left",
  "armourclass",
  "armourclass_max",
  "criticalhit",
  // **`swap_weapons` writes exactly ONE resource.** The build's toggle sets
  // `equipped_weapon` and `using_bow` together (`+0x4dbd`/`+0x4dce`,
  // `+0x4eba`/`+0x4ecb`) and leaves the three derived numbers to the next
  // `battlevalues`; here the derived numbers are selected at read time, so the
  // mode flag is the whole of the state change.
  "equipped_weapon",
  "staminaleft",
  ...SS2_ARMOUR_PIECES
].sort());

/* ------------------------------------------------------------------ */
/* `battlevalues`: the build's own derivation, so a blueprint need not   */
/* hand-type a derived number                                          */
/* ------------------------------------------------------------------ */

/**
 * The licensed build's `battlevalues(whichcharacter)`, root frame 35
 * `DoAction@0x3fa9dc` `+0x3062`, as a pure function.
 *
 * Two blocks, exactly as the build has them. The unconditional derivations run
 * on every call; the second block is skipped while `_global.battle_started` is
 * true, which is why staged `hitpoints` does not survive a bout and staged
 * armour does.
 *
 * Deliberately NOT reproduced: the two `experience` writes at `+0x3845` and
 * `+0x38d3`. They target `_root.game.hero` unconditionally — `register:1`,
 * never the `whichcharacter` argument — so in the build, computing a villain's
 * battle values rewrites the HERO's progression fields. That is a real hazard
 * worth knowing about (map § "Hazard"), and reproducing it in a pure function
 * would mean writing to a global. Nothing here reads those fields.
 *
 * @param {object} character  base stats and equipment ids
 * @param {object} [options]
 * @param {boolean} [options.battleStarted=false] skip the second block
 * @returns {object} a new object; the input is never mutated
 */
export function ss2BattleValues(character, { battleStarted = false } = {}) {
  const source = { ...character };
  const number = (name, fallback = 0) => {
    const value = source[name] ?? fallback;
    if (!Number.isFinite(value)) {
      throw new TeamRuleSetError(`ss2BattleValues: ${name} must be a finite number.`);
    }
    return value;
  };

  const strength = number("strength");
  const herolevel = number("herolevel", 1);
  const usingBow = source.using_bow === true;
  const derived = { ...source };

  derived.physical_size = 80 + Math.round(strength / 1.5);

  for (const piece of SS2_ARMOUR_PIECES) {
    const id = number(piece);
    const dval = SS2_ARMOUR_DVAL[piece];
    if (piece === "helmet") {
      // `+0x34eb` above id 25, `+0x34bf` at or below it. Both arms assign.
      derived.helmet_defence = id > 25 ? Math.round(herolevel * 0.5 * dval) : Math.round(id * dval);
    } else if (piece === "shield") {
      // `+0x35f7`, or the flat 0 at `+0x3623` while `using_bow` is true.
      derived.shield_defence = usingBow ? 0 : Math.round(id * dval);
    } else {
      derived[`${piece}_defence`] = Math.round(id * dval);
    }
  }

  // `weapon_min_damage` / `weapon_max_damage` are OUTPUTS of `battlevalues`,
  // not inputs: `+0x31be` and `+0x31da` read them out of
  // `_root["weapon" + <char>.weapon]`. This module took them as caller-supplied
  // because the table was not in code, and gap 3 in the header said so. It is
  // in code now (`ss2-weapon-table.js`), so a `weapon` id derives the pair.
  //
  // An EXPLICIT pair still wins, and that ordering is deliberate rather than
  // defensive. Every one of the 23 promoted goldens supplies the pair ON THE
  // HERO and none supplies `weapon`, so deriving first would silently re-datum
  // runtime evidence from a map-derived table — the exact move the standing
  // rule forbids. Derivation fills a hole; it never overwrites a measurement.
  //
  // Re-derived 2026-09-07 rather than re-counted: 23 of 23 heroes state the
  // pair, 22 of 23 villains do, and the exception is the armoured golden's
  // villain — which is exactly why the rule set's requirement is now
  // role-based (`SS2_ATTACKER_REQUIRED_RESOURCES`).
  const weaponPair = ss2WeaponDamageRange(source.weapon);
  if (weaponPair !== null) {
    if (source.weapon_min_damage === undefined) source.weapon_min_damage = weaponPair[0];
    if (source.weapon_max_damage === undefined) source.weapon_max_damage = weaponPair[1];
    derived.weapon = source.weapon;
  }
  const secondaryPair = ss2WeaponDamageRange(source.secondary_weapon);
  if (secondaryPair !== null) {
    if (source.secondary_weapon_min_damage === undefined) source.secondary_weapon_min_damage = secondaryPair[0];
    if (source.secondary_weapon_max_damage === undefined) source.secondary_weapon_max_damage = secondaryPair[1];
    derived.secondary_weapon = source.secondary_weapon;
  }
  // ► **THE FOUR RAW COLUMNS HAVE TO REACH `derived`, and until `swap_weapons`
  //   existed nothing noticed that they did not.** `derived` is spread from
  //   `source` at the top of this function, BEFORE the four assignments above,
  //   so a pair filled in from the weapon table landed on `source` and stopped
  //   there — invisible to `ss2Combatant`, which builds its bag out of
  //   `derived`. That was harmless while `min_damage` was computed once and
  //   never recomputed; it is not harmless now, because a swap back to melee
  //   rebuilds the melee pair FROM these columns and would have rebuilt it
  //   from zero.
  for (const column of [
    "weapon_min_damage", "weapon_max_damage",
    "secondary_weapon_min_damage", "secondary_weapon_max_damage"
  ]) {
    if (Number.isFinite(source[column])) derived[column] = source[column];
  }

  // `weapon_range` and `secondary_weapon_range` — the same lookup one column
  // over, and the LAST of the three `weapon_range` omissions the living head
  // listed under "`ss2BattleValues` reproduces a SUBSET of `battlevalues`".
  //
  //   weapon_range           = physical_size + _root["weapon" + weapon][5] * 44
  //                                                                    +0x3190
  //   secondary_weapon_range = physical_size
  //                          + _root["weapon" + secondary_weapon][5] * 44
  //                                                                    +0x32aa
  //
  // Both re-read off the installed build 2026-09-11. Derived only when the id
  // RESOLVES to a table row, exactly as the damage pair is: `battlevalues`
  // itself would compute `undefined * 44` for an id the build does not declare,
  // so there is no behaviour to imitate and `ss2WeaponEntry` returns null rather
  // than guessing. A combatant with no resolvable weapon declares no
  // `weapon_range` and `ss2Reach` falls back to the bare-hands row.
  //
  // An EXPLICIT `weapon_range` still wins, for the reason the damage pair's
  // does: derivation fills a hole, it never overwrites a measurement.
  const primaryEntry = ss2WeaponEntry(source.weapon);
  if (primaryEntry !== null && source.weapon_range === undefined) {
    derived.weapon_range = derived.physical_size + primaryEntry.rangeMultiplier * SS2_WEAPON_RANGE_STEP;
  }
  const secondaryEntry = ss2WeaponEntry(source.secondary_weapon);
  if (secondaryEntry !== null && source.secondary_weapon_range === undefined) {
    derived.secondary_weapon_range =
      derived.physical_size + secondaryEntry.rangeMultiplier * SS2_WEAPON_RANGE_STEP;
  }

  // `+0x320c` and `+0x3326`, and they run BEFORE the min/max pair below — the
  // build's own order, which matters because both read `weapon_max_damage`
  // rather than the strength-scaled `max_damage`.
  //
  // This is the ARITHMETIC half of enchantment damage. What it does NOT do is
  // apply it: in the build the tick lands on the afflicted combatant's next
  // turn and REPLACES that turn (battle map § "The enchantment effect is a
  // SKIPPED TURN"), which the resolver has no channel for and which is an open
  // decision, not an omission. Computing the field here is free of that: it is
  // a `battlevalues` output the module was silently dropping.
  derived.weapon_enchantment_damage =
    Math.ceil(number("weapon_max_damage") / 3 * number("weapon_enchantment_potency"));
  derived.secondary_weapon_enchantment_damage =
    Math.ceil(number("secondary_weapon_max_damage") / 3 * number("secondary_weapon_enchantment_potency"));

  derived.min_damage = Math.round(strength * 2) + number("weapon_min_damage");
  derived.max_damage = Math.round(strength * 2) + number("weapon_max_damage");
  derived.secondary_min_damage = Math.round(strength * 1) + number("secondary_weapon_min_damage");
  derived.secondary_max_damage = Math.round(strength * 1) + number("secondary_weapon_max_damage");
  if (usingBow) {
    // `+0x3416`: bow mode OVERWRITES the primary pair, carrying the secondary
    // pair's `round(strength * 1)` scaling rather than `round(strength * 2)`.
    derived.min_damage = derived.secondary_min_damage;
    derived.max_damage = derived.secondary_max_damage;
    // ► **AND `weapon_range` WITH THEM (`+0x343e`), which this module dropped
    //   until 2026-09-11** — the living head listed "no bow `weapon_range`
    //   override" as one of three surviving `ss2BattleValues` omissions. All
    //   three assignments sit in one `if (using_bow)` block: `Push "using_bow";
    //   GetMember; Not; If` at `+0x3416`..`+0x341f` jumps PAST the block when
    //   the flag is falsy, so the block runs when it is TRUE.
    //
    //   Guarded on the secondary range EXISTING, because the build's own
    //   unguarded copy would write `undefined` for a gladiator with no
    //   secondary weapon and this module has no way to represent that: a
    //   resource bag carries finite numbers only. A bow-wielding gladiator with
    //   no secondary weapon is not reachable through the shop, and the resolver
    //   has no ranged vocabulary at all.
    if (Number.isFinite(derived.secondary_weapon_range)) {
      derived.weapon_range = derived.secondary_weapon_range;
    }
  }

  // `+0x3634`-`+0x378d`, and it sits OUTSIDE the `battle_started` skip, so it
  // is recomputed on every call exactly like `hitpointsmax` below it.
  derived.maximum_ammo = ss2MaximumAmmo(herolevel);

  derived.hitpointsmax = herolevel * 10 + number("vitality") * 20;
  derived.staminamax = 100 + number("stamina") * 10;
  derived.movement_speed = clamp(Math.round(number("speed") * 1.5), 4, 60);

  // `attack_speed` is the weapon table's `[2]` column, read straight through
  // by `battlevalues` (`+0x3174`, `+0x346a`, `docs/integration/ss2-item-tables.md:328`).
  // The map catalogues it as a derived-combat field and records NO READER for
  // it anywhere; this engine ignored it entirely until 2026-09-10. Derived
  // here only when the caller states a `weapon` id, so a combatant that
  // declares the damage pair directly — every promoted golden — is untouched.
  if (derived.attack_speed === undefined && Number.isFinite(source.weapon)) {
    const entry = ss2WeaponEntry(source.weapon);
    if (entry) derived.attack_speed = entry.weight;
  }

  if (battleStarted) return derived;

  derived.hitpoints = Math.round(derived.hitpointsmax);
  derived.armourclass_max = SS2_ARMOUR_PIECES
    .reduce((total, piece) => total + derived[`${piece}_defence`], 0);
  derived.armourclass = derived.armourclass_max;
  if (!(number("staminaleft") > 0)) derived.staminaleft = derived.staminamax;
  // `+0x3b45`-`+0x3b81`. **From `derived.maximum_ammo`, not `source`'s** — the
  // tier above has already recomputed it this call, and reading the stated
  // value here would refill a level-45 archer to whatever number its record
  // happened to carry.
  if (!(number("ammo_left") > 0)) derived.ammo_left = derived.maximum_ammo;
  return derived;
}

/**
 * A roster-ready combatant source built from a vanilla-shaped gladiator.
 *
 * Runs `ss2BattleValues` first, so a caller supplies base stats and equipment
 * ids and the BUILD's formulas supply everything derived. Then it sorts the
 * result onto the two channels the seam actually has: numbers into
 * `resources`, the facing and the six condition flags into `status`.
 *
 * `stats.agility` is fed from SS2's `speed`. That is a rename with a caveat
 * worth stating: agility is what the RESOLVER sorts initiative by, and SS2
 * does not sort initiative at all — `changeCombatants` alternates. Turn order
 * in a team battle is the resolver's, not the build's.
 *
 * @param {object} [options]
 * @param {boolean} [options.derive=true] run `ss2BattleValues` first. Pass
 *   `false` for a record whose derived fields are ALREADY KNOWN — a promoted
 *   golden's scenario, or a state dump read off a capture — where re-deriving
 *   would overwrite measured numbers with numbers computed from inputs the
 *   record does not carry.
 */
export function ss2Combatant(
  vanilla,
  { id, name, controller, battleStarted = false, derive = true, x, y } = {}
) {
  // `derive` is a GUARD, not a convention. `ss2BattleValues` overwrites
  // `min_damage`, `max_damage`, `hitpointsmax` and `staminamax`
  // unconditionally, so running it over a promoted golden's record replaces
  // runtime-verified numbers with computed ones — a verifier measured
  // 21/23/30/110 becoming 20/20/10/100. A record that already states a derived
  // field must therefore say which it wants; silence is not an answer.
  const STATED = ["min_damage", "max_damage", "hitpointsmax", "staminamax"]
    .filter((name) => Number.isFinite(vanilla?.[name]));
  if (derive === true && STATED.length > 0 && !battleStarted) {
    throw new TeamRuleSetError(
      `ss2Combatant was asked to DERIVE a record that already states ${STATED.join(", ")}. ` +
      "battlevalues overwrites those, so a measured number would be replaced by a computed one. " +
      "Pass derive: false to keep the stated values, or remove them to derive from stats and kit."
    );
  }
  // The shop gate runs on the STATED record, before anything is derived, so a
  // refusal names the id the caller wrote rather than a number computed from
  // it. `ss2Combatant` is the right home: it is the only place the weapon id
  // still exists — equipment identity is deliberately outside
  // `SS2_RESOURCE_NAMES` and `CANONICAL_RESOURCE_SOURCES`, so by the time a
  // combatant reaches the resolver there is nothing left to gate on.
  assertSs2WeaponPurchasable(vanilla, id ? `Combatant ${id}` : "Combatant");

  // ► **A STATED WEAPON WITH NO REACH IS REFUSED, NOT SILENTLY DISARMED (added
  //   2026-09-12, found by `/codex:adversarial-review`).** `derive: false` says
  //   "my derived fields are already known", and `ss2BattleValues` then never
  //   runs — so a record stating `weapon: 5` and its damage pair but no
  //   `weapon_range` reaches the resolver with equipment identity DISCARDED
  //   (the id is not in `SS2_RESOURCE_NAMES`) and `ss2Reach` falls back to the
  //   bare-hands row. Measured at strength 9: a reach of 130 where that
  //   weapon's own row says 174, with no diagnostic anywhere.
  //
  //   **This is the only place the weapon id still exists**, which is why the
  //   check is here rather than at the rule set's construction gate.
  //
  //   Refused rather than derived, because deriving is what `derive: false`
  //   exists to prevent: the flag protects a promoted golden's MEASURED numbers
  //   from being overwritten by computed ones, and quietly making an exception
  //   for one field is how that protection stops meaning anything. **No golden
  //   is affected** — none of the 23 states a `weapon`, a `secondary_weapon` or
  //   a `weapon_range`, so none can reach this branch.
  if (derive === false && !Number.isFinite(vanilla?.weapon_range)) {
    const stated = ss2WeaponEntry(vanilla?.weapon);
    if (stated !== null) {
      const label = id ? `Combatant ${id}` : "Combatant";
      const size = 80 + Math.round((Number(vanilla?.strength) || 0) / 1.5);
      const bare = size + ss2WeaponEntry(0).rangeMultiplier * SS2_WEAPON_RANGE_STEP;
      const armed = size + stated.rangeMultiplier * SS2_WEAPON_RANGE_STEP;
      // The two COINCIDE whenever the stated weapon's multiplier is 1, and the
      // refusal still stands: the record is contradictory in STRUCTURE, and a
      // check that declined to fire wherever the numbers happened to agree
      // would go quiet the moment a caller changed the strength or the id.
      // That is exactly how `tools/arena/roster.js` carried this for a day.
      const coincide = bare === armed;
      throw new TeamRuleSetError(
        `${label} states weapon ${stated.id} with derive: false and no weapon_range. The weapon id is ` +
        "equipment identity and does not survive into the resolver, so nothing downstream can tell this " +
        `gladiator from a bare-handed one: it would reach ${bare}, where its own row says ${armed} ` +
        `(physical_size + ${stated.rangeMultiplier} * ${SS2_WEAPON_RANGE_STEP}, battlevalues +0x3190)` +
        (coincide
          ? " — the same number HERE, only because this weapon's multiplier is 1, which is luck and not a"
            + " contract; change the id or the strength and the two diverge silently."
          : ", and nothing would report the difference.") +
        " State weapon_range, or drop the weapon id and be honestly bare-handed, or pass derive: true and " +
        "let battlevalues compute it."
      );
    }
  }

  const derived = derive ? ss2BattleValues(vanilla, { battleStarted }) : { ...vanilla };

  // ► **THE BOW OVERRIDE MUST NOT REACH THE BAG, AND THE FIRST VERSION OF THIS
  //   FILE LET IT — found by `/codex:adversarial-review` of `7310583`,
  //   reproduced here before it was believed.**
  //
  //   `battlevalues`'s bow block overwrites `min_damage`, `max_damage` and
  //   `weapon_range` IN PLACE (`+0x3424`-`+0x344a`). This engine's whole shape
  //   is that those three hold the MELEE numbers and the bow's live beside them
  //   in `secondary_*`, with `equipped_weapon` selecting at read time. So a
  //   record carrying `using_bow: true` — which is what
  //   `ss2Combatant(..., { battleStarted: true })` exists to rebuild, from a
  //   capture or a resumed campaign — poured the bow's numbers into the melee
  //   slots, and **they never came back**: swapping to melee then fought with
  //   the bow's damage and the bow's reach for the rest of the bout.
  //
  //   Measured, strength 9, weapon 1, `secondary_weapon: 65`,
  //   `equipped_weapon: 2`:
  //
  //   ```text
  //     the sword's own numbers   21-27,  reach 130
  //     after restore + swap      17-73,  reach 262
  //   ```
  //
  //   ► **AND THE GUARD THAT SHOULD HAVE CAUGHT IT WAS KEYED ON THE EXACT
  //     CRITERION I HAD JUST CORRECTED, TWENTY MINUTES EARLIER, IN A COMMENT
  //     TWO HUNDRED LINES ABOVE.** The reach backstop fires on
  //     `weapon_range > arena width`, and bows 65 and 75 carry a range
  //     multiplier of 4 rather than 100, so their 262 sails under it — the same
  //     two rows, the same exception, the third time in one session. **Writing
  //     down why a consequence-keyed guard is wrong does not stop you leaving
  //     one in place.**
  //
  //   The fix is at the ROOT rather than in a third guard: derive a SECOND time
  //   with the bow put away, and take the three melee fields from that run. The
  //   bow's own numbers are unaffected (`secondary_weapon_range` and the
  //   secondary pair are computed outside the block), and everything else —
  //   including `shield_defence`, which the build really does zero while a bow
  //   is drawn (`+0x3623`) — keeps the mode the record actually states.
  if (derive && vanilla?.using_bow === true) {
    const sheathed = ss2BattleValues({ ...vanilla, using_bow: false }, { battleStarted });
    for (const field of ["min_damage", "max_damage", "weapon_range"]) {
      if (Number.isFinite(sheathed[field])) derived[field] = sheathed[field];
    }
  }

  const resources = {};
  for (const key of SS2_RESOURCE_NAMES) {
    const value = Number.isFinite(derived[key]) ? derived[key] : SS2_RESOURCE_DEFAULTS[key];
    if (Number.isFinite(value)) resources[key] = value;
  }
  // `vanillaRecordOf` falls back to `armourclass` for a missing
  // `armourclass_max`, so the default table's flat 0 would have fed the
  // arithmetic a different pool depending on which builder made the
  // combatant. Mirror the fallback here so the two agree.
  if (!Number.isFinite(derived.armourclass_max) && Number.isFinite(derived.armourclass)) {
    resources.armourclass_max = derived.armourclass;
  }
  const status = [];
  if ((derived.gladiator_dir ?? "right") === "left") status.push(SS2_FACING_LEFT);
  for (const flag of SS2_STATUS_FLAGS) if (derived[flag] === true) status.push(flag);

  const source = {
    stats: {
      strength: derived.strength ?? 0,
      agility: derived.speed ?? 0,
      attack: derived.attack ?? 0,
      defense: derived.defence ?? 0,
      vitality: derived.vitality ?? 0,
      stamina: derived.stamina ?? 0,
      magicka: derived.magicka ?? 0
    },
    resources,
    status,
    maxHealth: derived.hitpointsmax,
    health: derived.hitpoints ?? derived.hitpointsmax
  };
  if (id !== undefined) source.id = id;
  if (name !== undefined) source.name = name;
  if (controller !== undefined) source.controller = controller;
  /**
   * WHERE THIS GLADIATOR STANDS, stated outright instead of derived from its
   * slot. It is an OPTION rather than a `vanilla` field because it is not a
   * `battlevalues` output: the build keeps it on the CLIP (`gladiators.hero._x`,
   * which `getfightdistance` reads), not on the character record.
   *
   * A stated position wins over `startingPosition`, exactly as a stated
   * `maxHealth` overrules the derived one — see `normaliseCombatant`. Two
   * callers want it: a host restoring a bout mid-approach, and a test that is
   * about something other than geometry and just needs the two gladiators
   * within reach of each other.
   */
  if (x !== undefined) source.x = x;
  /**
   * And its RANK, on the same footing and for the same two callers.
   *
   * ► **THIS WAS MISSING UNTIL 2026-09-12 AND ITS ABSENCE WAS LOAD-BEARING BY
   *   ACCIDENT.** `ss2Combatant` forwarded `x` and silently dropped `y`, so a
   *   caller staging a ranked bout through this constructor got a gladiator
   *   with a position and no depth and no error — the option simply vanished.
   *   Adding it is what makes the two axes symmetric here, and the coherence
   *   guard in `normaliseCombatant` is what stops the asymmetric state a raw
   *   blueprint could still reach: `y` without `x` is refused outright.
   */
  if (y !== undefined) source.y = y;
  return source;
}

/* ------------------------------------------------------------------ */
/* View -> the flat vanilla record the arithmetic consumes              */
/* ------------------------------------------------------------------ */

/**
 * Reads a resource off either shape a carrier can be in: the resolver's
 * normalised `{ value, min, max }` bag, or the blueprint shorthand where a
 * resource is a bare number. `normaliseResourceBag` accepts both, and
 * `maximumHealth` is reachable with either — the roster hands it a normalised
 * combatant, while `compareMaximumHealth` in the adapter hands it a blueprint
 * source. Reporting "missing" for a resource that is present but unnormalised
 * would send a reader to the wrong problem.
 */
function declaredResourceValue(carrier, name) {
  const entry = carrier?.resources?.[name];
  return Number.isFinite(entry) ? entry : entry?.value;
}

/**
 * One role's resource requirement, named in the refusal.
 *
 * `role` is not decoration: it is the difference between "this gladiator was
 * built wrong" and "this gladiator cannot swing", and a reader of the throw
 * needs to know which.
 */
function assertDeclaredResources(carrier, where, names, role) {
  const missing = names.filter((name) => !Number.isFinite(declaredResourceValue(carrier, name)));
  if (missing.length === 0) return;
  throw new TeamRuleSetError(
    `${where} does not declare the SS2 resources ${missing.join(", ")}, which this rule set requires ` +
    `${role}. The attack arithmetic would silently default them and fight a different gladiator, so ` +
    "this rule set refuses instead. Build the combatant with ss2Combatant(), or declare " +
    `resources: { ${names.join(", ")} } on the blueprint.`
  );
}

function assertConstructionResources(carrier, where) {
  assertDeclaredResources(
    carrier,
    where,
    SS2_CONSTRUCTION_REQUIRED_RESOURCES,
    "of every combatant, at construction"
  );
  if (declaredResourceValue(carrier, "staminamax") <= 0) {
    // A verifier found the fixpoint: at staminamax <= 0 the forced-rest gate
    // makes `rest` the only legal action, and `rest` then writes nothing —
    // zero effects, zero rolls, no result, forever. Refused at construction,
    // because a battle that cannot change state is not a battle.
    throw new TeamRuleSetError(
      `${where} declares staminamax ${declaredResourceValue(carrier, "staminamax")}. At or below zero the ` +
      "forced-rest gate leaves rest as the only legal action and rest can change nothing, so the battle " +
      "is a fixpoint with no result. staminamax = 100 + stamina * 10 in the build, so it is never <= 0 there."
    );
  }
  // ► **EVERY GLADIATOR ENTERS THE ARENA IN MELEE MODE, BECAUSE THE BUILD PUTS
  //   THEM THERE. Root frame 221 sets `equipped_weapon = 1` and
  //   `using_bow = false` at battle construction (map `:111`), and no
  //   controller frame wires `swap_weapons` at all — the only route to a drawn
  //   bow is the inventory overlay, mid-battle, one turn at a time.**
  //
  //   So a combatant that arrives ALREADY in bow mode is a state the build
  //   cannot produce, and it is refused here rather than accommodated.
  //
  //   ► **THIS REPLACES A NARROWER GUARD THAT HAD A HOLE, and the hole is worth
  //     recording because it is the shape of thing that survives a green
  //     suite.** The old refusal fired on `weapon_range > arena width`, on the
  //     reasoning that a bow's `[5]` multiplier is 100 so its reach is at least
  //     4,480 against a 4,200-unit arena. **Two of the twenty ranged rows do
  //     not have `[5]` = 100: ids 65 and 75 carry 4** (item tables `:472`,
  //     `:482`, re-read 2026-09-13), giving `physical_size + 176` — about 262,
  //     comfortably inside the arena. Measured before this change: a strength-9
  //     gladiator with `secondary_weapon: 65` and `equipped_weapon: 2` BUILT a
  //     battle, walked in, and was offered all three melee verbs at 262 units —
  //     a longer reach than any sword in the game, swung with a bow.
  //
  //     The guard was not merely incomplete; it was keyed on a CONSEQUENCE
  //     (the reach) instead of the STATE (the mode), and the consequence had an
  //     exception nobody had counted. This one is keyed on the mode, which has
  //     none.
  //
  //   **Bow mode is now perfectly legal, at construction as well as mid-fight,
  //   and what is refused is a bow that is not there.**
  //
  //   ► **THE FIRST VERSION OF THIS GUARD REFUSED `equipped_weapon == 2`
  //     OUTRIGHT, on the grounds that root frame 221 forces every gladiator to
  //     START in melee mode — and that is true and was still the wrong rule.**
  //     A state the build reaches on turn two is not an impossible state; it is
  //     a state a capture can observe, a campaign can resume into, and
  //     `ss2Combatant(..., { battleStarted: true })` exists specifically to
  //     rebuild. Refusing it keyed the guard on where a fight BEGINS instead of
  //     on what is actually wrong, which is the same mistake the arena-width
  //     version made one revision earlier. **It is worth recording that the
  //     mistake was repeated immediately, with the correction to the previous
  //     one written directly above it.**
  //
  //     Nothing is lost by permitting it, because the melee-verbs-with-a-bow
  //     defect is no longer held shut by a guard at all: `legalActions` wires
  //     the archer frames, and neither of them offers a melee verb whatever the
  //     reach says. The vocabulary closes it structurally.
  //
  //   What remains refused is the genuine contradiction: bow mode with no bow.
  //   A gladiator whose secondary slot is empty has a `secondary_weapon_range`
  //   of 0 and a zero damage pair, so drawing it would arm a weapon that can
  //   neither reach nor hurt anything — and `ss2ActiveDamagePair` would hand
  //   the swing `round(strength)` and nothing else. The build cannot produce
  //   this either: its swap button is `_visible = false` without a secondary
  //   weapon (`+0x0e77`-`+0x0e96`).
  const equipped = declaredResourceValue(carrier, "equipped_weapon");
  const bowReach = declaredResourceValue(carrier, "secondary_weapon_range");
  if (equipped === 2 && !(bowReach > 0)) {
    throw new TeamRuleSetError(
      `${where} declares equipped_weapon 2 — a DRAWN BOW — with secondary_weapon_range ` +
      `${bowReach === undefined ? "undeclared" : bowReach}, so there is no bow in the slot to draw. ` +
      "The build hides its own swap button outright when the hero has no secondary weapon " +
      "(sprite 862 frame 1 +0x0e77-+0x0e96), and this engine offers no swap-weapons turn without one " +
      "either. Declare a secondary_weapon so battlevalues can derive its range, or leave " +
      "equipped_weapon at 1."
    );
  }
  // The reach backstop, kept. It can no longer be the primary guard — ids 65
  // and 75 slip under it, see above — but a `weapon_range` this wide still
  // means somebody ran `ss2BattleValues` with `using_bow: true` and baked the
  // override into the bag, which is a different mistake with the same symptom.
  const reach = declaredResourceValue(carrier, "weapon_range");
  const arenaWidth = SS2_ARENA.clamp.max - SS2_ARENA.clamp.min;
  if (Number.isFinite(reach) && reach > arenaWidth) {
    throw new TeamRuleSetError(
      `${where} declares weapon_range ${reach}, which is wider than the arena itself (${arenaWidth}). ` +
      "That is the build's bow override baked in: `weapon_range = secondary_weapon_range` through a " +
      "type-4 row (battlevalues +0x343e, +0x32aa). This engine keeps the MELEE reach in weapon_range and " +
      "the bow's in secondary_weapon_range, and selects between them on equipped_weapon at read time, so " +
      "a bow never needs to overwrite it. Build the record with using_bow false and give it a " +
      "secondary_weapon; the swap-weapons turn does the rest."
    );
  }
}

/**
 * One frozen combatant view -> one FRESH MUTABLE flat vanilla record.
 *
 * The allocation is not defensive tidiness. `initialiseCombatant` assigns onto
 * its argument (`ss2-attack-candidate.js`), and the resolver hands rule sets
 * frozen views, so passing a view through would throw. Cloning the view
 * instead would be worse than throwing: `numberField` defaults every absent
 * field to 0, and a view shares no field name with the vanilla shape, so a
 * cloned view resolves to attack 0 / defence 0 / hitpointsmax 1 and returns a
 * plausible-looking fabricated kill. This translator is therefore total and
 * explicit: every field is named, and the ones that matter are required.
 *
 * `role` is MANDATORY and has no default, deliberately. It decides whether the
 * damage pair is required of this side (see
 * `SS2_ATTACKER_REQUIRED_RESOURCES`), and a default would let a future call
 * site pick one silently — which is the exact shape of the defect this
 * parameter exists to close.
 */
function vanillaRecordOf(view, role) {
  if (role !== "attacker" && role !== "defender") {
    throw new TeamRuleSetError(
      `vanillaRecordOf needs an explicit role ("attacker" or "defender") for combatant ${view?.id}; ` +
      `it decides whether ${SS2_ATTACKER_REQUIRED_RESOURCES.join("/")} are required of this side.`
    );
  }
  if (role === "attacker") {
    assertDeclaredResources(
      view,
      `Combatant ${view.id}`,
      SS2_ATTACKER_REQUIRED_RESOURCES,
      "of whoever ATTACKS, at the moment the swing resolves"
    );
  }
  const status = new Set(view.status ?? []);
  const read = (name, fallback = 0) => resourceValue(view, name, fallback);
  // ► **THE ONE FIELD THAT DEPENDS ON WHICH WEAPON IS IN HAND.** In melee mode
  //   this is exactly `read("min_damage")` / `read("max_damage")` and the
  //   record is byte-for-byte what it always was — which is what keeps all 23
  //   promoted goldens replaying unchanged, since none of them declares an
  //   `equipped_weapon` of 2 and none can (`assertConstructionResources`
  //   refuses it outright). With the bow drawn it is the secondary pair, which
  //   is `battlevalues` `+0x3424`-`+0x343d`. See `ss2ActiveDamagePair`.
  //
  //   **Applied only in bow mode, never as a rewrite of the melee path.** The
  //   melee reads below keep their own fallback chain verbatim
  //   (`min_damage` defaulting to 1, `max_damage` falling back to
  //   `min_damage`), because a pure DEFENDER need not declare the pair at all
  //   and routing it through a helper that floors at 0 would quietly move a
  //   number for every undeclared defender in the corpus.
  const bowPair = ss2InBowMode(view) ? ss2ActiveDamagePair(view) : null;
  const record = {
    attack: view.stats.attack,
    defence: view.stats.defense,
    strength: view.stats.strength,
    magicka: view.stats.magicka,
    charisma: read("charisma"),
    hitpoints: view.health,
    hitpointsmax: view.maxHealth,
    armourclass: read("armourclass"),
    armourclass_max: read("armourclass_max", read("armourclass")),
    staminaleft: read("staminaleft"),
    staminamax: read("staminamax"),
    min_damage: bowPair ? bowPair.min_damage : read("min_damage", 1),
    max_damage: bowPair ? bowPair.max_damage : read("max_damage", read("min_damage", 1)),
    character_level: read("character_level", 1),
    equipped_weapon: read("equipped_weapon", 1),
    weapon_enchantment_type: read("weapon_enchantment_type"),
    weapon_enchantment_potency: read("weapon_enchantment_potency"),
    secondary_weapon_enchantment_type: read("secondary_weapon_enchantment_type"),
    secondary_weapon_enchantment_potency: read("secondary_weapon_enchantment_potency"),
    weapon_enchantment_damage: read("weapon_enchantment_damage"),
    secondary_weapon_enchantment_damage: read("secondary_weapon_enchantment_damage"),
    gladiator_dir: status.has(SS2_FACING_LEFT) ? "left" : "right"
  };
  for (const piece of SS2_ARMOUR_PIECES) {
    record[piece] = read(piece);
    record[`${piece}_defence`] = read(`${piece}_defence`);
  }
  // Through the token grammar, not `status.has(flag)`: a condition may carry
  // its inflictor (`"burning:from=villain"`), and the vanilla record wants the
  // boolean the build has.
  for (const flag of SS2_STATUS_FLAGS) record[flag] = hasStatusFlag(view.status ?? [], flag);
  return record;
}

/* ------------------------------------------------------------------ */
/* Effects                                                             */
/* ------------------------------------------------------------------ */

const declaredResourceNames = (view) => new Set(Object.keys(view.resources ?? {}));

/**
 * Ordered effects for what the ingress did to the defender.
 *
 * The order is the build's own first-touch order over distinct fields —
 * `armourclass`, `armourclass_max`, the destroyed piece, `hitpoints`,
 * `staminaleft`, then the status writes — which is what `removeArmour`,
 * `damagecharacter` and the enchantment block do in sequence. Resource effects
 * are ABSOLUTE, so one write per field carrying the settled value is exact;
 * only the order between distinct fields is observable, and it is preserved.
 *
 * A resource the blueprint never declared is SKIPPED, not written: the
 * resolver refuses an undeclared name mid-list and leaves the earlier effects
 * applied, which would be a partial action with no rollback.
 */
/**
 * IS THE ATTACKER BEHIND THE DEFENDER?
 *
 * ► **AUTHORED, AND THE THING THAT LOOKS LIKE EVIDENCE FOR IT IS A TRAP.** The
 *   build has a variable and a parameter literally named `attack_direction`,
 *   and it is NOT a bearing: it is a clip-name suffix and an armour-zone
 *   selector. `defender_hurt` builds `animstate = "hurt" + attack_direction`
 *   (`+0x2086`) and `defender_blocked` builds `"defend" + attack_direction`
 *   (`+0x2160`), while `remove_armour(whichcharacter, whichavatar,
 *   attack_direction)` tests `{1,5,8,9}` to pick the helmet group. Re-derived
 *   against the oracle 2026-09-12.
 *
 *   **Vanilla has no backstab, no flank and no surround.** `attack_chances`
 *   contains no positional term of any kind — no `gladiator_dir`, no `_x`, no
 *   `fightdistance`. So this is mod surface and is labelled as such rather
 *   than dressed in that tempting citation.
 *
 * ## Why it exists, and it is a measurement rather than a taste
 *
 * The lane geometry made flanking POSSIBLE and nothing made it WORTH DOING.
 * Measured 2026-09-12: the route — rank out, walk past, rank back — is legal
 * on 59.4% of turns, costs three actions, and **a gladiator scripted to flank
 * once per bout went 7-17 against one that did not.** It bought nothing,
 * because no gate, damage band or AI rule read which side of you an enemy
 * stood on. This is what the far side is for.
 *
 * ## The definition
 *
 * A defender faces its nearest foe (`ss2FacingEffects`). An attacker standing
 * on the OTHER side of it is behind it. Both need a position: a rule set that
 * models none can never produce a back attack, which is the same structural
 * gate that keeps all 23 promoted goldens out of this — and it matters,
 * because a golden replays a measured swing whose damage is the measurement.
 */
export function ss2IsBackAttack(attacker, defender) {
  if (!Number.isFinite(attacker?.x) || !Number.isFinite(defender?.x)) return false;
  // A co-located pair has no sides, exactly as the build's strict tests leave
  // a co-located pair's facing alone.
  if (attacker.x === defender.x) return false;
  const facesLeft = (defender.status ?? []).includes(SS2_FACING_LEFT);
  // Facing left means the nearest foe is to the left, so an attacker to the
  // RIGHT is behind. And the mirror.
  return facesLeft === (attacker.x > defender.x);
}

function defenderEffects(before, after, target) {
  const declared = declaredResourceNames(target);
  const effects = [];
  const writeResourceEffect = (name) => {
    if (!declared.has(name) || before[name] === after[name]) return;
    effects.push({ kind: EffectKind.RESOURCE, targetId: target.id, resource: name, to: after[name] });
  };

  writeResourceEffect("armourclass");
  writeResourceEffect("armourclass_max");
  for (const piece of SS2_ARMOUR_PIECES) writeResourceEffect(piece);

  // Always emitted, zero included: a miss is a zero-damage effect rather than
  // an absent one, so the effect list stays a faithful record of what was
  // attempted and a UI can say "misses" instead of inventing the word.
  effects.push({
    kind: EffectKind.DAMAGE,
    targetId: target.id,
    amount: Math.max(0, before.hitpoints - after.hitpoints)
  });

  writeResourceEffect("staminaleft");

  // ► **TAKING DAMAGE INTERRUPTS A CHARGE, AND LEAVING THIS OUT MADE
  //   `psyche_up` STRICTLY STRONGER THAN THE BUILD'S.** `damagecharacter`
  //   resets the DEFENDER's counter at `+0x1be4`, which is the other half of
  //   the rule `nextphase` carries for the actor — and it is the half that
  //   prices the discharge: three presses of `ceil(max_damage * 1.5)` are only
  //   expensive because three uninterrupted turns are hard to get.
  //
  //   `phaseTransitionEffects` cannot cover this path: it resets the ACTING
  //   combatant, and here the combatant losing its charge is the one being hit.
  //
  //   ► **FOUND TWICE INDEPENDENTLY**, by reading the map's own sentence and by
  //     an adversarial review that reproduced it — seed 2, `attack: 100`, a
  //     villain at counter 3 keeping the charge through a landed blow and
  //     discharging on its next turn.
  //
  //   Emitted only on a LANDED blow (a miss is a zero-damage effect, see above)
  //   and only when the value would actually change, so an ordinary battle
  //   between gladiators who never psyche carries no extra effect at all.
  if (declared.has("psyche_up") && after.hitpoints < before.hitpoints
    && resourceValue(target, "psyche_up", SS2_PSYCHE_UP.floor) !== SS2_PSYCHE_UP.floor) {
    effects.push({
      kind: EffectKind.RESOURCE,
      targetId: target.id,
      resource: "psyche_up",
      to: SS2_PSYCHE_UP.floor
    });
  }
  return effects;
}

/**
 * Status transitions on BOTH sides, in the order `death()` writes them.
 *
 * `clearDeathState` walks side-then-field for the four condition flags — the
 * attacker's four, then the defender's four — and then field-then-SIDE for the
 * two taunts (`taunted1` attacker, `taunted1` defender, `taunted2` attacker,
 * `taunted2` defender). It cannot be two independent per-side passes, which is
 * what this file did until a verifier read the interleave.
 *
 * These are net changes, so a flag the death clear zeroes and the enchantment
 * then sets appears once, in the defender's group. Order is unobservable in
 * state — status writes are set-semantics and at most one is added per action —
 * so this is fidelity, not correctness. It is worth having anyway: this
 * module's whole warrant is that it reproduces measured behaviour.
 */
function statusEffects(attackerBefore, attackerAfter, defenderBefore, defenderAfter, actor, target) {
  const effects = [];
  const emit = (before, after, view, flag, inflictorId = null) => {
    if (before[flag] === after[flag]) return;
    const active = after[flag] === true;
    effects.push({
      kind: EffectKind.STATUS,
      targetId: view.id,
      // SETTING a condition stamps WHO did it, so the status phase can bill the
      // right gladiator above 1v1. CLEARING one must name the exact token
      // already on the combatant — the resolver matches status effects by
      // string equality — so a clear reads the live token back rather than
      // rebuilding it, which would silently fail to remove a sourced condition.
      //
      // Without the set half, every condition inflicted IN PLAY carries no
      // source, so its tick reads no enchantment damage and does nothing.
      // Found by playing a fight, not by a test: the narration said "gains
      // burning" where it should have said "gains burning (from Player 2)".
      status: active
        ? ss2StatusToken(flag, inflictorId)
        : statusTokenFor(view.status ?? [], flag) ?? flag,
      active
    });
  };
  for (const flag of SS2_DEATH_CLEAR_FLAGS) emit(attackerBefore, attackerAfter, actor, flag);
  // The defender is the only side that can GAIN a condition here, and the
  // attacker is who inflicted it — `damagecharacter`'s proc writes the boolean
  // on `game_defender` using `game_attacker`'s enchantment.
  for (const flag of SS2_DEATH_CLEAR_FLAGS) emit(defenderBefore, defenderAfter, target, flag, actor.id);
  for (const flag of SS2_TAUNT_FLAGS) {
    emit(attackerBefore, attackerAfter, actor, flag);
    emit(defenderBefore, defenderAfter, target, flag);
  }
  return effects;
}

/**
 * `nextphase`'s per-transition bookkeeping, attacker-only.
 *
 * `+0x32a1`-`+0x3304` are two consecutive unbranched statements on
 * `game_attacker.staminaleft` — the cost subtraction and the regeneration —
 * with no `game_defender` counterpart anywhere in the function, and the
 * hitpoint regeneration at `+0x3305`-`+0x3346` is attacker-only for the same
 * reason. A simulation that regenerates both sides per turn drifts from the
 * build.
 *
 * The two stamina statements are combined before a single clamp because the
 * build has no clamp between them; clamping in the middle would floor a spend
 * at zero and then add the regeneration on top, which is a different number.
 *
 * @param {number} staminaCost  the phase's `staminacost`. NEGATIVE for `rest`,
 *   where the branch sets `0 - round(stamina * 15)` and the subtraction below
 *   therefore becomes a gain.
 * @param {number} branchGain   stamina the phase branch itself added before
 *   `nextphase` ran; `rest` adds `game_attacker.stamina` at `+0x521d`.
 * @param {number} branchHeal   hitpoints the phase branch itself added before
 *   `nextphase` ran; `rest` adds `3 + ceil(game_attacker.stamina)` at
 *   `+0x51d5`, inside the same `attacker.struck == null` guard as `+0x521d`.
 *   Summed with the `nextphase` term before ONE maxHealth clamp, because the
 *   build's own clamps (`check_stats` at `+0x5266` and `+0x334d`) are both
 *   ceilings and every term here is non-negative.
 */
function phaseTransitionEffects(
  actor,
  { staminaCost, branchGain = 0, branchHeal = 0, fromStaminaleft = null, fromHealth = null,
    resetsPsyche = true }
) {
  const declared = declaredResourceNames(actor);
  const stamina = actor.stats.stamina;
  const effects = [];
  let staminaGained = 0;

  // `fromStaminaleft`/`fromHealth` exist for the STATUS PHASE, where the actor
  // is also the thing that just took damage. Everywhere else the actor is the
  // attacker, whose own state the action did not touch, so the frozen view IS
  // the pre-transition state and both stay null. Transitioning off the view in
  // a status phase would heal from the pre-tick hitpoints and hand back
  // headroom the tick had just consumed.
  const health = fromHealth === null ? actor.health : fromHealth;

  if (declared.has("staminaleft")) {
    const before = fromStaminaleft === null ? resourceValue(actor, "staminaleft", 0) : fromStaminaleft;
    const maximum = resourceValue(actor, "staminamax", before);
    const after = clamp(before - staminaCost + branchGain + 1 + Math.round(stamina / 3), 0, maximum);
    staminaGained = after - before;
    if (after !== before) {
      effects.push({
        kind: EffectKind.RESOURCE,
        targetId: actor.id,
        resource: "staminaleft",
        to: after
      });
    }
  }

  const healed = Math.min(
    branchHeal + 1 + Math.ceil(stamina / 2),
    Math.max(0, actor.maxHealth - health)
  );
  if (healed > 0) {
    effects.push({ kind: EffectKind.HEAL, targetId: actor.id, amount: healed });
  }
  // ► **`nextphase` RESETS THE PSYCHE COUNTER ON EVERY DECISION THAT IS NOT
  //   `psyche_up`, AND THIS IS THE FUNCTION THAT IS `nextphase`.** The build
  //   writes `game_attacker.psyche_up = 1` at `+0x35c7`-`+0x35ea` whenever
  //   `phase_decision != "psyche_up"`, so a charge cannot be banked across an
  //   attack, a walk or a rest: break the chain and you start again.
  //
  //   **It belongs here rather than at each call site** because here IS the
  //   build's own boundary — every completed phase pays its stamina and
  //   regenerates through this function, which is exactly the set of decisions
  //   `nextphase` sees. Writing it into each branch instead would be eight
  //   copies of one rule, and the branch that forgot would bank a charge for
  //   free.
  //
  //   The write is to 1 and not 0: see `SS2_PSYCHE_UP.floor`. It is emitted
  //   ONLY when the value would actually change, so an ordinary battle between
  //   gladiators who never psyche carries no extra effect at all — which is
  //   what keeps this off every existing hash.
  if (resetsPsyche && declared.has("psyche_up")
    && resourceValue(actor, "psyche_up", SS2_PSYCHE_UP.floor) !== SS2_PSYCHE_UP.floor) {
    effects.push({
      kind: EffectKind.RESOURCE,
      targetId: actor.id,
      resource: "psyche_up",
      to: SS2_PSYCHE_UP.floor
    });
  }

  return { effects, staminaGained, healed };
}

/**
 * One status phase: the turn a condition costs its bearer.
 *
 * The build's shape, statement by statement (map §"The enchantment effect is a
 * SKIPPED TURN, not an on-hit bonus"):
 *
 * - `crowd_action = 0`, then `staminacost = 0` — **the phase costs no stamina**;
 * - the damage goes through `magic_damage_character`, which this repository
 *   already models exactly in `applySs2MagicDamageCandidate`: armour first,
 *   hitpoints only once the post-decrement `armourclass <= 0`, NO `Math.ceil`
 *   on the applied damage (the ceil is display-only), the unconditional
 *   `psyche_up = 1`, the breastplate stamina join, `check_stats`, and the
 *   shared defeat gate. **The function contains no RNG call at all**, which is
 *   why this branch takes no `rolls` and draws nothing;
 * - `nextphase()` still runs, so the transition's stamina regeneration and heal
 *   both apply: **a status turn is net positive on stamina and hitpoints except
 *   for the tick itself.**
 *
 * THE ROLES ARE CROSSED IN THE BUILD AND THAT IS CORRECT, not a bug: the eight
 * enchantment call sites invert the operands so the callee damages the phase's
 * ACTOR, because in a status phase the actor is the victim. Half the inversion
 * is inert — `magic_damage_character` binds `attacker`/`game_attacker` to
 * register 0 and reads neither — so **no attacker stat can influence any number
 * this produces**. Here the crossing is expressed by putting the victim on the
 * scenario's DEFENDER side rather than by swapping four arguments.
 *
 * THE ODD SELECTOR IS REPRODUCED, NOT CORRECTED. `+0x530e` reads the VICTIM's
 * `equipped_weapon` to choose between the INFLICTOR's primary and secondary
 * enchantment damage. Which of someone else's two weapons burned you cannot
 * depend on which weapon you are holding — and it does. The map says reproduce
 * it; this does.
 */
function resolveStatusPhase(request, flag, fightMode, observer) {
  const actor = request.actor;
  const label = VANILLA_PHASE_LABEL[SS2_STATUS_PHASE_FOR_FLAG[flag]];

  // The victim is the callee's DEFENDER — see the crossing note above. It is
  // never the attacker of anything here, so it owes no damage pair: a gladiator
  // may burn to death without ever declaring `min_damage`.
  const victim = vanillaRecordOf(actor, "defender");
  const victimBefore = { ...victim };

  // WHO the tick reads its damage off. Vanilla reads `game_defender` — "the
  // other gladiator" — which names nobody above 1v1, so the condition carries
  // its source and this looks that combatant up among the living. At 1v1 the
  // source IS the only foe, so this is vanilla exactly.
  const sourceId = ss2StatusSourceOf(statusTokenFor(actor.status ?? [], flag) ?? flag);
  // Matched on the STRINGIFIED id, because that is what the token stores — and
  // refused outright when two living combatants stringify the same. The roster
  // enforces id uniqueness with a Set over the raw values, so a numeric 7 and a
  // string "7" can both exist; an independent review measured that billing the
  // WRONG fighter's enchantment. Refusing is the only honest answer: the token
  // genuinely does not say which one.
  const candidates = sourceId === null
    ? []
    : [...request.foes, ...request.allies].filter((combatant) => String(combatant.id) === sourceId);
  if (candidates.length > 1) {
    throw new TeamRuleSetError(
      `Combatant ${actor.id} carries ${flag} inflicted by "${sourceId}", but ${candidates.length} living ` +
      "combatants share that id once stringified, so the tick cannot say whose enchantment damage to " +
      "read. Give every combatant a distinct string id."
    );
  }
  const inflictor = candidates[0] ?? null;

  // No source recorded (a battle that STARTED with the condition, which vanilla
  // cannot produce), or the inflictor is gone: there is no enchantment damage
  // to read, so the phase costs the turn and clears the flag and applies
  // nothing. Inventing a number here would be inventing evidence.
  const damage = inflictor === null
    ? 0
    : resourceValue(
      inflictor,
      victim.equipped_weapon === 1 ? "weapon_enchantment_damage" : "secondary_weapon_enchantment_damage",
      0
    );

  const scenario = {
    // The victim sits on the `hero` key and the side is named `villain`, so
    // `defenderSide` resolves to the victim. The other side is a record the
    // callee provably never reads; it is present because the ingress clears
    // death state across both sides.
    attackerSide: "villain",
    hero: victim,
    villain: inflictor === null ? { ...victim } : vanillaRecordOf(inflictor, "defender"),
    fightMode,
    result: null
  };
  const outcome = applySs2MagicDamageCandidate(scenario, damage, {
    damageMethod: SS2_STATUS_DAMAGE_METHOD[flag]
  });

  // The same refusal the attack path carries, and for the same reason: a
  // first-blood result ends the bout in the arithmetic and not in the battle,
  // because `battleStanding` decides on `alive` alone. This branch previously
  // tested only `hitpoints <= 0` and dropped the candidate's first-blood
  // verdict on the floor — it healed the victim and left `battle.result` null
  // where the map requires a defeat. Found by an independent review; only
  // `duel`/`misc` can reach it, and both are gated at construction.
  if (outcome.resultEvent && outcome.resultEvent.reason === "first-blood") {
    throw new TeamRuleSetError(
      `Rule set ss2-map-derived-${fightMode} produced a first-blood result from a ${flag} status phase, ` +
      "which the team resolver cannot represent: it decides elimination on health > 0 and knows nothing " +
      "of hitpoints < hitpointsmax. Use fightMode \"tournament\" for play."
    );
  }

  const victimAfter = scenario.hero;
  const eliminated = victimAfter.hitpoints <= 0;

  // `death()` deletes `nextphase` before the transition can fire, so a lethal
  // tick costs and regenerates nothing — the same rule the attack path already
  // carries, and the one nineteen goldens measure there.
  const transition = eliminated
    ? { effects: [], staminaGained: 0, healed: 0 }
    : phaseTransitionEffects(actor, {
      staminaCost: 0,
      fromStaminaleft: victimAfter.staminaleft,
      fromHealth: victimAfter.hitpoints
    });

  // A LETHAL TICK RUNS `death()`, which clears the condition and taunt flags on
  // BOTH gladiators — so the inflictor's own conditions go too. Emitted from
  // the ingress's own before/after rather than assumed: `clearDeathState`
  // mutates both sides of the scenario, and skipping this would leave the
  // inflictor burning in our state and clean in the build's.
  const inflictorEffects = [];
  if (eliminated && inflictor !== null) {
    // EVERY token, for the same reason `statusConsumptionEffects` takes every
    // token: two can name one condition with different inflictors, and
    // `statusTokenFor` returns only the first. Clearing one left the other
    // standing on a gladiator `death()` had cleared — which an independent
    // review then reproduced as a SURVIVOR still afflicted after a 1v1, a
    // state this file's own boundary claim called impossible.
    const wanted = new Set(SS2_STATUS_FLAGS);
    for (const token of inflictor.status ?? []) {
      if (!wanted.has(ss2StatusFlagOf(token))) continue;
      inflictorEffects.push({
        kind: EffectKind.STATUS,
        targetId: inflictor.id,
        status: token,
        active: false
      });
    }
  }

  const effects = [
    ...defenderEffects(victimBefore, victimAfter, actor),
    // A lethal tick runs `death()`, which clears all SIX flags on the victim,
    // not just the four conditions the forced chain consumes. Clearing only the
    // conditions left a corpse still carrying `taunted1`/`taunted2` — the
    // candidate cleared them in its own state and this seam never emitted the
    // effect. Found by an independent review.
    ...statusConsumptionEffects(actor, eliminated ? SS2_STATUS_FLAGS : SS2_DEATH_CLEAR_FLAGS),
    ...inflictorEffects,
    ...transition.effects
  ];

  const events = [{
    type: SS2_STATUS_PHASE_FOR_FLAG[flag],
    actorId: actor.id,
    targetId: actor.id,
    condition: flag,
    vanillaLabel: label,
    inflictorId: sourceId,
    damage: outcome.mutation.appliedDamage,
    armourDamage: outcome.mutation.armourDamage,
    hitpointDamage: outcome.mutation.hitpointDamage,
    staminaBonus: outcome.mutation.staminaBonus,
    staminaSpent: 0,
    staminaGained: transition.staminaGained,
    healed: transition.healed
  }];

  if (observer) {
    // `scenario.hero` is the VICTIM and `scenario.villain` the INFLICTOR,
    // whatever those combatants are actually called — the keys are the
    // candidate's two role slots, and the crossing is what makes the callee
    // damage the phase's actor. The candidate stamps its `result` labels from
    // those slot names, so an observer reading `loserSide` alone would learn
    // the slot rather than the gladiator. The real ids are carried here so a
    // diagnostic reader never has to guess; the resolver's own winner is
    // decided from `alive` and is unaffected.
    observer(clone({
      actorId: actor.id,
      targetId: actor.id,
      type: SS2_STATUS_PHASE_FOR_FLAG[flag],
      condition: flag,
      damageMethod: SS2_STATUS_DAMAGE_METHOD[flag],
      victimId: actor.id,
      inflictorId: sourceId,
      roleSlots: { victim: "hero", inflictor: "villain" },
      fightMode,
      scenario,
      outcome
    }));
  }
  return { effects, events };
}

/* ------------------------------------------------------------------ */
/* The rule set                                                        */
/* ------------------------------------------------------------------ */

/**
 * The 23 promoted goldens this rule set's attack ingress is checked against.
 *
 * `golden-armoured-deflection-threshold-cleared` joined on 2026-09-07, and it
 * is the first entry here that puts ARMOUR on the defender. It was promoted on
 * 2026-09-02 and could not be replayed until the damage-pair requirement
 * became role-based: its villain declares no `min_damage`/`max_damage`, because
 * the map says the candidate must not pin what the villain never uses.
 *
 * That matters beyond one line in a list. Every other golden stages
 * `armourclass 0` with all eight piece ids 0, so the armour-first split and the
 * deflection threshold had NO runtime backing at all — the header of
 * `test/ss2-golden-resolver-replay.test.js` says so, and still should be read
 * before this list is treated as broad coverage. One armoured golden is one,
 * not a corpus.
 */
export const SS2_GOLDEN_FIXTURE_IDS = Object.freeze([
  "golden-armoured-deflection-threshold-cleared",
  "golden-prisoner-normal-kill",
  "golden-prisoner-normal-kill-dir5",
  "golden-prisoner-normal-kill-dir6",
  "golden-prisoner-normal-kill-dir8",
  "golden-prisoner-power-kill-dir9",
  "golden-prisoner-power-kill-dir10",
  "golden-prisoner-power-kill-dir11",
  "golden-prisoner-power-kill-dir12",
  "golden-prisoner-quick-kill-dir1",
  "golden-prisoner-quick-kill-dir2",
  "golden-prisoner-quick-kill-dir3",
  "golden-prisoner-quick-kill-dir4",
  "golden-probe-armour-removal-gate-above",
  "golden-probe-armour-removal-gate-below",
  "golden-probe-deflection-threshold-cleared",
  "golden-probe-deflection-threshold-critical",
  "golden-probe-normal-rollneeded-hit",
  "golden-probe-normal-rollneeded-miss",
  "golden-probe-power-rollneeded-hit",
  "golden-probe-power-rollneeded-miss",
  "golden-probe-quick-rollneeded-hit",
  "golden-probe-quick-rollneeded-miss"
]);

/** Battle-map sections this rule set's arithmetic was read out of. */
export const SS2_MAP_SOURCE_REFS = Object.freeze([
  "overlay:862/frame:52/DoAction@0x240c7f/checkattackroll",
  "overlay:862/frame:52/DoAction@0x240c7f/damagecharacter",
  "overlay:862/frame:52/DoAction@0x240c7f/nextphase@+0x32a1",
  "overlay:862/frame:52/DoAction@0x240c7f/staminacost@+0x5163",
  "overlay:862/frame:52/DoAction@0x240c7f/power_attack@+0x608a",
  "overlay:862/frame:52/DoAction@0x240c7f/normal_attack@+0x61f1",
  "overlay:862/frame:52/DoAction@0x240c7f/quick_attack@+0x635c",
  "overlay:862/frame:1/turn-gating@+0x0d2e",
  "root:35/DoAction@0x3fa9dc/battlevalues@+0x3062",
  "sprite:862/frame:52/DoAction@0x23f835/villainChooseAction@+0x03e8"
]);

const FIGHT_MODES = Object.freeze(["tournament", "duel", "misc"]);

const healthRatio = (combatant) => (combatant.maxHealth > 0 ? combatant.health / combatant.maxHealth : 0);
/**
 * Locale-INDEPENDENT id comparison. `localeCompare` is ICU-locale-dependent,
 * and since every foe starts at full health the tiebreak is the common path —
 * so two peers in different locales would pick different targets and their
 * `combatStateHash` would diverge with no other cause. Found by a verifier.
 * The same construct still stands in `roster.js` (initiative) and
 * `placeholder-rules.js`; both are recorded as open items rather than changed
 * here, because initiative order is a wider blast radius than this change.
 */
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byHealthThenId = (a, b) => healthRatio(a) - healthRatio(b) || byId(a, b);

/**
 * @param {object} [options]
 * @param {"tournament"|"duel"|"misc"} [options.fightMode="tournament"]
 *   The defeat gate the arithmetic runs. `tournament` is the only mode this
 *   seam can represent; the other two are accepted so the promoted goldens
 *   (all `misc`) can be replayed through the resolver, and this rule set
 *   throws if one of them actually produces a first-blood result.
 * @param {boolean} [options.fixtureReplay=false]
 *   Required to accept a `fightMode` other than `"tournament"`. Those modes
 *   can produce a first-blood result this seam cannot represent, and the
 *   refusal costs the battle's RNG state (see the header's gap 1), so they are
 *   for replaying measured fixtures, not for play.
 * @param {(record: object) => void} [options.observer]
 *   Diagnostic sink, called once per resolved action with the arithmetic's
 *   full return. NOT battle state: it is not projected and not hashed, exactly
 *   as `battle.lastResolution` is not. It must not mutate what it is handed.
 */
export function createSs2TeamRules({
  fightMode = "tournament",
  observer = null,
  fixtureReplay = false,
  /**
   * Whether an AI opponent will spend turns building a psych-up charge.
   *
   * ► **OFF BY DEFAULT, AND THAT IS A MEASUREMENT RATHER THAN A HEDGE.**
   *   Damage dealt per actor turn over 40 seeded bouts, an even level-9 pair:
   *   quick 17.82, normal 15.26, **charge-and-discharge 11.53**, power 11.44.
   *   Swept over five stat-lines the charge won exactly one — a heavy weapon,
   *   at ratio 1.09 — and lost the rest at 0.59 to 0.73 of the best attack.
   *   **Charging is a losing move on damage per turn**, so an AI that maximised
   *   damage would never do it, and an arm that made it do it anyway would be
   *   dressing a preference up as arithmetic.
   *
   *   It is therefore a CHARACTER TRAIT and not an optimisation: an opponent
   *   who winds up for a grievous blow is more interesting to fight and
   *   slightly worse at fighting. Owner's call, 2026-09-16, taken against the
   *   measurement that the verb was chosen **0 times in 6,000 AI actions** and
   *   that `psyche_up`, its two clips, the charged stance and its glow
   *   therefore had a live population of zero outside human play.
   *
   * ► **IT IS IN THE RULE-SET ID WHEN ON**, exactly as `crowdPatience` and
   *   `rankStride` are, because `toTeamWireState` carries only the id into the
   *   hash — two peers running different settings would agree on every hash and
   *   then diverge at the first charge. Off by default means every pinned hash,
   *   every golden and every census keeps the id it was taken against.
   *
   * ► **WHAT IT ACTUALLY DOES, measured over 40 seeded 3v3 bouts on the demo
   *   roster, so it can be tuned against a number rather than an impression:**
   *
   *   ```text
   *     aiCharges   actions/bout   charges   share   discharges   bouts resolved
   *     false             183.9          0    0.0%            0           40/40
   *     true              198.7       2433   30.6%          974           40/40
   *   ```
   *
   *   **Every charge came from the two bow slots and none from the other
   *   four**, which is the build's own level gate showing through: the warrior
   *   controller frames wire `psyche_up` at `herolevel >= 7` and the archer
   *   frames at `>= 3`, and the demo gladiator is level 4. So on the shipped
   *   roster this trait is an ARCHER behaviour whether or not anyone intended
   *   that, and a warrior demo would show nothing at all.
   *
   *   30.6% is high — those two gladiators wind up on most of their turns,
   *   because an archer at range is rarely wounded and the gate below is full
   *   health. Bouts run 8% longer and all 40 still resolve. **Stated rather
   *   than tuned**: the number is the owner's to move, and moving it means
   *   changing the gate below, not this comment.
   */
  aiCharges = false,
  /**
   * Turns of grace before the crowd turns on the fighters. Defaults to
   * `SS2_CROWD.patience`; `Infinity` disables the toll outright.
   *
   * ► **IT IS A PARAMETER BECAUSE THE CONSTANT'S OWN INSTRUCTION WAS
   *   UNRUNNABLE WITHOUT ONE.** `SS2_CROWD.patience` says "re-run it whenever
   *   the combat economy moves", and re-running it means measuring honest bout
   *   length WITH THE TOLL OFF — the methodology error that cost the first two
   *   values was tuning against a distribution the toll itself had shaped. The
   *   only other way to turn the toll off is `fixtureReplay: true`, which also
   *   disables position and the swing cost, so it measures a different engine
   *   and reports it as this one.
   *
   * **It is in the rule-set ID when it differs from the default**, for exactly
   * the reason `fightMode` is: `toTeamWireState` carries only the id into the
   * hash, so two peers running different tolls would otherwise agree on every
   * hash and then diverge the first turn past the shorter grace.
   */
  crowdPatience = SS2_CROWD.patience,
  /**
   * How far apart consecutive RANKS stand on the second axis, in arena units.
   * **`0` is the off switch and is the default**, and it is off STRUCTURALLY
   * rather than by tuning: at 0 every gladiator gets the same `y`, so `ydist`
   * is 0 for every pair, `ss2FightDistance` reduces exactly to the rounded
   * x-separation, and the engine is the one-dimensional engine. There is no
   * second code path to keep in step.
   *
   * ► **THIS IS THE OWNER'S DIAL, and it is the question the geometry cannot
   *   answer: how much should standing in the right place matter?** It is one
   *   number rather than a preset because the honest answer is somewhere in a
   *   range and is game feel. What it buys, against the build's own metric
   *   (`round(sqrt(xdist^2 + ydist^2))`) at strength 9, where a front rank
   *   parks at `physical_size` 86 and reaches 130:
   *
   *   ```text
   *     stride    dist to the next rank's parked foe    what it feels like
   *        0                86  (level)                 today's game, exactly
   *       40                95                          ranks visible, all engaged
   *       60               105                          a rank is a real position
   *       85               122                          the edge of reach
   *       97               130  (out of reach)          ranks fight separately
   *      130+              148+                         ranks are separate battles
   *   ```
   *
   * **It is AUTHORED, and inside an existing declared silence rather than a
   * new one.** `MAP_SILENCE.multi-slot-arena-geometry` already covers
   * "positions, depths, and clip names for slots beyond the first" and already
   * says this is authored mod surface. What is NOT authored is the metric: the
   * build's `getfightdistance` is Euclidean over `(_x, _y)`, so once two
   * gladiators are unlevel, how far apart they are is the build's answer and
   * not ours. See `ss2FightDistance`.
   *
   * **It is in the rule-set ID when it is non-zero**, for exactly the reason
   * `crowdPatience` is: the hash carries only the id, so two peers running
   * different strides would agree on every hash and then diverge.
   */
  rankStride = SS2_ARENA.rankStride,
  /**
   * What a blow struck from BEHIND adds, as a fraction of the damage the
   * measured swing already did. `0` disables it and is not the default.
   *
   * ► **AUTHORED, and layered ON TOP of the build's arithmetic rather than
   *   inside it.** The swing resolves exactly as it always did — same
   *   `attack_chances`, same roll, same damage — and the bonus is a SEPARATE
   *   damage effect that names itself in the effect log. Delete it and the
   *   measured engine is bit-for-bit back. That is deliberate: the to-hit and
   *   damage arithmetic is the golden pipeline, 23 runtime-verified fixtures
   *   replay through it, and an authored term reaching inside it would re-datum
   *   every one of them.
   *
   * **It cannot fire without positions on both fighters**, so a fixture — which
   * models none — can never produce one. Structural gate, not a flag.
   *
   * See `ss2IsBackAttack` for why vanilla's `attack_direction` is NOT evidence
   * for this, and for the measurement that asked for it: flanking was legal on
   * 59.4% of turns, cost three actions, and went 7-17 because it bought
   * nothing.
   */
  backAttackBonus = SS2_BACK_ATTACK_BONUS
} = {}) {
  if (!FIGHT_MODES.includes(fightMode)) {
    throw new TeamRuleSetError(`fightMode must be one of: ${FIGHT_MODES.join(", ")}.`);
  }
  if (!(crowdPatience > 0)) {
    throw new TeamRuleSetError(
      `crowdPatience must be a positive number of turns, or Infinity to disable the toll; got ${String(crowdPatience)}.`
    );
  }
  if (fightMode !== "tournament" && fixtureReplay !== true) {
    throw new TeamRuleSetError(
      `fightMode ${fightMode} can produce a first-blood result the team resolver cannot represent, and the ` +
      "refusal fires mid-action, after the action's RNG draws have already advanced state the resolver " +
      "cannot roll back. Pass fixtureReplay: true if you are replaying a measured fixture whose outcome is " +
      "known not to be first blood; use tournament for play."
    );
  }
  if (observer !== null && typeof observer !== "function") {
    throw new TeamRuleSetError("observer must be a function.");
  }
  if (!Number.isFinite(backAttackBonus) || backAttackBonus < 0) {
    throw new TeamRuleSetError(
      `backAttackBonus must be a finite fraction >= 0 (0 disables it); got ${String(backAttackBonus)}.`
    );
  }
  if (!Number.isFinite(rankStride) || rankStride < 0) {
    throw new TeamRuleSetError(
      `rankStride must be a finite number of arena units >= 0 (0 disables the second axis); got ${String(rankStride)}.`
    );
  }

  // Captured rather than read off `this`: a rule set's methods are only ever
  // called as methods by the resolver today, but an unbound `resolveAction`
  // would then throw a TypeError on the error path instead of the error.
  // The patience joins the id ONLY when it differs from the shipped default, so
  // an ordinary battle keeps the id every pinned hash was taken against and a
  // sweep's rule set can never be mistaken for it.
  const patienceSuffix = crowdPatience === SS2_CROWD.patience
    ? ""
    : `-patience-${crowdPatience === Infinity ? "none" : crowdPatience}`;
  // The stride joins the id ONLY when the second axis is on, so an ordinary
  // battle keeps the id every pinned hash was taken against. Same rule as the
  // patience above, and for the same reason: the hash carries only the id.
  // The suffix names what differs from the SHIPPED DEFAULT, exactly as the
  // patience one does — so it is empty at the default and present otherwise,
  // including at 0. A rule set with the second axis switched off is a
  // different engine from the shipped one and its id has to say so.
  const strideSuffix = rankStride === SS2_ARENA.rankStride ? "" : `-rank-${rankStride}`;
  const backSuffix = backAttackBonus === SS2_BACK_ATTACK_BONUS ? "" : `-back-${backAttackBonus}`;
  // Same rule again, and for the same reason: an AI that charges makes
  // different decisions from one that does not, so two peers running different
  // settings would agree on every hash and then diverge at the first charge.
  const chargeSuffix = aiCharges ? "-charges" : "";
  const ruleSetId =
    `ss2-map-derived-${fightMode}${patienceSuffix}${strideSuffix}${backSuffix}${chargeSuffix}`;

  return defineTeamRuleSet({
    // The mode is in the id because `toTeamWireState` carries only id,
    // contractVersion, verification and runtimeVerified into the hash. Two
    // peers running different defeat gates would otherwise hash identically.
    id: ruleSetId,
    verification: RuleSetVerification.MAP_DERIVED,
    provenance: {
      kind: "map-derived",
      runtimeVerified: false,
      buildSha256: SS2_BUILD_SHA256,
      mapSourceRefs: SS2_MAP_SOURCE_REFS,
      goldenFixtureIds: SS2_GOLDEN_FIXTURE_IDS,
      note:
        "SS2's own attack arithmetic, read out of the licensed build's bytecode and replayed against " +
        "23 promoted goldens for attack directions 1-12. NOT runtime-verified: no capture has observed " +
        "this module driving a fight, and the stamina economy, action legality and AI policy it adds " +
        "around the ingress have no runtime backing at all. The AI's choice among the three melee " +
        "verbs is invented; only its stamina gates are byte-decoded."
    },
    actionTypes: Object.values(Ss2ActionType),
    fightMode,

    /** Sides alternate; see `ss2InitiativeOrder`. Optional hook, no contract bump. */
    initiativeOrder: ss2InitiativeOrder,

    /**
     * `hitpointsmax = herolevel * 10 + vitality * 20`, `battlevalues`
     * `+0x378e` — but ONLY as a fallback.
     *
     * A supplied gladiator's `hitpointsmax` is licensed evidence, and
     * `battle-host.js` throws outright when a rule set derives a different
     * number for a real vanilla record. So a declared `maxHealth` is returned
     * verbatim and the formula never overrules it.
     *
     * This is also the one hook the resolver calls at CONSTRUCTION, so it is
     * where the ROLE-BLIND half of the requirement lives: `staminaleft` and
     * `staminamax` gate `legalActions` for a gladiator that has not swung yet,
     * so a blueprint missing either fails when the battle is built.
     *
     * The damage pair is NOT checked here. It is required of whoever attacks,
     * at the moment the swing resolves — see
     * `SS2_ATTACKER_REQUIRED_RESOURCES` for the measurement that says a
     * defender's pair cannot reach the arithmetic.
     */
    /**
     * Where slot `slotIndex` of team `teamIndex` starts.
     *
     * Team 0 is the hero side and stands at negative x, team 1 the villain
     * side at positive x — map, "Battle entry" step 5, `(-250, 200)` and
     * `(250, 200)`. Allies stand FURTHER OUT, which keeps slot 0 of each side
     * byte-identical to the vanilla pair and 1v1 the parity case.
     *
     * **`fixtureReplay` returns `null` instead, and that is not a shortcut.**
     * A promoted golden is a measurement of ONE resolved action, staged in the
     * running game at whatever separation that capture happened to have.
     * Giving it a construction position this engine invented, and then gating
     * its swing on that invention, would make 23 runtime-verified fixtures
     * replay through a geometry no capture observed. A fixture models no
     * position, so it has none, and `legalActions` falls back to the
     * position-blind vocabulary for exactly the callers that ask for it.
     */
    startingPosition({ teamIndex, slotIndex }) {
      if (fixtureReplay) return null;
      const side = teamIndex === 0 ? -1 : 1;
      const magnitude = SS2_ARENA.frontX + SS2_ARENA.allyStride * slotIndex;
      return clamp(side * magnitude, SS2_ARENA.clamp.min, SS2_ARENA.clamp.max);
    },

    /**
     * Which RANK slot `slotIndex` stands in — the second axis.
     *
     * **`null` unless `rankStride` is non-zero, and that is the off switch.**
     * A rule set that returns `null` here models no depth, `combatant.y` stays
     * `null`, `ss2FightDistance` reads it as 0 and the engine is exactly the
     * one-dimensional engine. Off is the DEFAULT and it is structural: there
     * is no second code path that has to be kept in step with the first.
     *
     * `fixtureReplay` returns `null` for the same reason `startingPosition`
     * does, and the reason is worth repeating rather than cross-referencing,
     * because getting it wrong silently re-datums 23 runtime-verified
     * fixtures: **a promoted golden is a measurement of ONE resolved action,
     * staged in the running game at whatever geometry that capture happened to
     * have.** Giving it a rank this engine invented, and then gating its swing
     * on that invention, would make every golden replay through a geometry no
     * capture observed. A fixture models no position, so it has none.
     *
     * ## The sign, and why slot 0 is 200
     *
     * Arena y is 200 at the front rank and DECREASES going back — the
     * convention `src/adapter/slot-layout.js` already ships (`ARENA_Y` 200,
     * `ALLY_Y_STRIDE` negative), which is in turn the convention
     * `withDrawOrder` relies on to paint back-to-front. Slot 0 therefore sits
     * at exactly the vanilla `_y` of 200 ("Battle entry" step 5), which keeps
     * 1v1 the parity case on this axis exactly as it is on the other: with one
     * slot a side, every gladiator is at 200, `ydist` is 0, and the bout is
     * one-dimensional however large `rankStride` is.
     *
     * **Both sides use the same ranks rather than mirroring**, because a rank
     * is depth into the screen and not a side: red slot 1 and blue slot 1
     * stand in the same rank and therefore meet. Mirroring them would put
     * every red in a rank with no blue in it, which is not a second interface
     * but a wall.
     */
    startingY({ slotIndex }) {
      if (fixtureReplay || rankStride === 0) return null;
      return SS2_ARENA.frontY - rankStride * slotIndex;
    },

    maximumHealth(combatant) {
      assertConstructionResources(combatant, `Combatant ${combatant.id}`);
      if (Number.isFinite(combatant.maxHealth)) return combatant.maxHealth;
      const herolevel = declaredResourceValue(combatant, "herolevel");
      if (!Number.isFinite(herolevel)) {
        throw new TeamRuleSetError(
          `Combatant ${combatant.id} declares neither maxHealth nor a herolevel resource, so ` +
          "hitpointsmax = herolevel * 10 + vitality * 20 cannot be derived."
        );
      }
      return herolevel * 10 + combatant.stats.vitality * 20;
    },

    /**
     * Three melee verbs against every living foe, plus rest.
     *
     * One gate, and it is the build's: overlay frame 1 `+0x0d2e` forces
     * `getphase("rest")` at `staminaleft <= 0`, before any player choice, so
     * at zero stamina rest is the only action there is.
     *
     * There is deliberately NO "you cannot afford this attack" gate. The build
     * has none — `nextphase` subtracts the cost and `check_stats` floors at
     * zero (`+0x114b`) — and inventing one would be a playability affordance
     * wearing measured clothes.
     *
     * Two documented widenings, because v1 models neither position nor the
     * controller frames: the build wires the three melee verbs only on
     * `closerange_warrior`, and wires `rest` only on the two long-range frames
     * and only below 50% stamina. (Both halves re-derived 2026-09-10 against
     * the map's own table at `docs/integration/ss2-battle-map.md:223-246`, and
     * both hold.)
     *
     * ► **THE SENTENCE THAT USED TO END THIS PARAGRAPH WAS THE THING STANDING
     *   IN FRONT OF THE WORK, and it does not survive being checked —
     *   corrected 2026-09-10.** It read: *"Adding the controller-frame gate
     *   needs `_root.arena.fightdistance`, for which the map records no writer
     *   at all."*
     *
     *   It is TRUE of `ss2-battle-map.md` alone — that file mentions
     *   `fightdistance` three times (`:146`, `:150`, `:156`) and all three are
     *   READS inside the frame-4 selector — and FALSE of the corpus, which
     *   names the writer twice with offsets:
     *     `docs/integration/ss2-champion-dna.md:710-712` — `getfightdistance`
     *       (`sprite 2249 frame 1 DoAction@0x6e421b` `+0x02ff`, `+0x0427`)
     *       makes it the rounded x-separation of the two clips, 500 at
     *       construction;
     *     `docs/ss2-adapter-contract.md:1232` — the same function, reading
     *       `gladiators.hero._x` / `.villain._x` by literal name.
     *   The two disagree on base address (`0x6e421b` vs `0x6e4221`, six bytes
     *   apart) and neither identifies the store, so the CITATION is soft even
     *   though the DERIVATION is not.
     *
     *   **The chronology removes the "we did not know yet" reading.**
     *   `git blame` puts this comment at `831bcdc`, 2026-09-01; champion-dna
     *   recorded the writer at `5d3d777` on 2026-08-30. The counter-evidence
     *   was already in a sibling integration doc when the sentence was
     *   written. It is not a stale note — it is a sentence written without
     *   opening the neighbouring document.
     *
     *   **And the justification is a non-sequitur even where the sentence is
     *   true**: a reimplementation never calls the build's writer. It needs
     *   positions, from which `fightdistance = round(|x_a - x_b|)`. Every
     *   other input is derivable too —
     *     `physical_size = 80 + round(strength / 1.5)`  (`battlevalues` `+0x30f1`)
     *     `weapon_range  = physical_size + weapon[5] * 44` (`+0x3190`;
     *        `ss2-weapon-table.js` already ships `rangeMultiplier`)
     *     the selector, frame 4 `DoAction@0x238bbf` `+0x00f6` / `+0x015f`.
     *
     *   ~~**What is actually missing is one number, and it is not this one: how
     *   far a movement phase moves `_x`.**~~ **CLOSED 2026-09-11, AND THE ENTRY
     *   IT POINTED AT IS GONE.** `MAP_SILENCE.movement-displacement` recorded
     *   that gap and told the next reader it needed the capture archive. It did
     *   not: `walkright` `+0x3d78` sets `destination = _x + movement_speed * 16`,
     *   two instructions from the stamina cost the entry was quoting. See
     *   `ss2WalkDisplacement`. **So the paragraph below is now a list of FOUR
     *   derived inputs and no missing one** — which is worth noticing, because
     *   this comment block spent two revisions naming whichever input was
     *   currently believed to be unknowable.
     *
     *   **Declaring the map silent is the cheapest way in this repository to
     *   turn a measurement into a guess** — the second instance found in two
     *   days; that constant's own header carries the first. Check the
     *   surrounding paragraph, and the neighbouring document.
     */
    legalActions(view, actorId) {
      const rest = { type: Ss2ActionType.REST, targetId: actorId };

      // ► **AN EMPTY QUIVER FORCES THE SWAP, AND IT OUTRANKS THE FORCED REST.
      //   That ordering is the build's and it is not the obvious one.**
      //
      //   Frame 1's forced chain (map §"Turn gating, forced phases", the table
      //   at `:299-307`) runs in a fixed order and the FIRST call that lands
      //   takes the turn, because `getphase` sets `turnphase = 2` and every
      //   later call that pass is a silent no-op. Row 1 is
      //   `ammo_left <= 0 && using_bow == true -> getphase("swap_weapons")`
      //   (`+0x0cce`-`+0x0d0e`); row 2 is the zero-stamina rest
      //   (`+0x0d2e`). So **an archer out of arrows at zero stamina puts the
      //   bow away rather than resting** — it spends a stamina it does not have
      //   on a swap, and `phaseTransitionEffects` clamps the floor at 0 exactly
      //   as `check_stats` does (`+0x114b`).
      //
      //   Placed above the zero-stamina return for that reason alone. It is the
      //   kind of ordering that reads like a bug until you follow the
      //   `turnphase` gate, which is why the offsets are here.
      const outOfAmmo = ss2InBowMode(view.actor)
        && resourceValue(view.actor, "ammo_left", 0) <= 0;
      if (outOfAmmo) return [{ type: Ss2ActionType.SWAP_WEAPONS, targetId: actorId }];

      if (resourceValue(view.actor, "staminaleft", 0) <= 0) return [rest];

      // THE FORCED STATUS PHASE, ranked exactly where the build ranks it.
      //
      // Frame 1's forced chain runs at the top of every turn, before the player
      // can act: rows 1-3 are `swap_weapons`, `rest` and the taunted run; the
      // four conditions are rows 4-7. The chain pre-empts the button, because
      // `getphase` sets `turnphase = 2` and every later call that turn is a
      // silent no-op — which is precisely "the status phase is the only legal
      // action", and is why the forced-rest gate above still outranks it. A
      // BURNING GLADIATOR AT ZERO STAMINA RESTS, and the burning is consumed
      // without playing (see `statusConsumptionEffects`).
      //
      // FIRST match, not last. See `SS2_STATUS_PHASE_FOR_FLAG`.
      const forced = forcedStatusFlag(view.actor);
      if (forced) return [{ type: SS2_STATUS_PHASE_FOR_FLAG[forced], targetId: actorId }];

      const actions = [];
      const reach = ss2Reach(view.actor);
      const positioned = Number.isFinite(view.actor.x);
      // Every OTHER living body, which is what can stand in the way of a shot.
      // Allies included, and deliberately: `ss2WalkDestination` learned the
      // same lesson on 2026-09-12 — `physical_size` is how big a body is and
      // does not know whose side it is on. Self is excluded because
      // `view.allies` includes the actor.
      // ► **A BOMBARD GOES OVER EVERYTHING AND A SNIPE DOES NOT, AND THAT IS
      //   THE BUILD'S OWN BALLISTIC RATHER THAN A BALANCE CHOICE. Owner's
      //   decision, 2026-09-13, and it turned out to be derivable.**
      //
      //   The two shots fly differently in vanilla — `_y -= Yvelocity` is
      //   inside a bombard-only test (`+0x72c7`), so a bombard arcs and a snipe
      //   holds one height for its whole flight. Measured off
      //   `src/render/projectile.js`, which reproduces that integration, in
      //   FIGURE HEIGHTS where a gladiator is exactly 1.0:
      //
      //   ```text
      //     snipe      0.674 flat, the whole way          chest height
      //     bombard    >= 1.055 everywhere a body could
      //                stand, across every range from
      //                200 to 4,000 units                 over their heads
      //   ```
      //
      //   The bombard's low point is always at the LAUNCH end, because it
      //   leaves at head height and climbs; the only place it drops back below
      //   is the final approach onto the target, where nobody else can be
      //   standing. **So a lobbed arrow genuinely passes over a body and a flat
      //   one genuinely does not**, and the legality rule is that fact rather
      //   than a rule laid on top of it.
      //
      //   `ss2ShotBlocked` needed NO new geometry for this — it is already a
      //   2-D segment test over `(x, depth)` and handles a cross-lane shot
      //   correctly. What changes is which bodies are handed to it.
      //
      // ► **AND A SNIPE IS BLOCKED BY YOUR OWN SIDE TOO, which is the half that
      //   reverses this morning's correction — deliberately, and only because
      //   bombard now covers the case that correction existed to fix.**
      //   Earlier today the archer had ONE legal target because its own rank-0
      //   ally screened it, so ally-blocking was dropped wholesale. The real
      //   fault was applying a flat shot's rule to a lobbed one: with bombard
      //   unblocked the archer always has every foe available, so the precise
      //   shot can demand a clean lane without crippling anything. A flat arrow
      //   at chest height does not care whose chest is in front of it.
      //
      //   Measured on the demo roster at the opening, 3v3, before this change:
      //   the archer stands at `(-380, 103)` and its own rank-0 ally at
      //   `(-250, 200)`. That ally sits **76.1 units off the lane** to the
      //   enemy's rank 0, against its own `physical_size` of 86, and 22% of the
      //   way along the shot. So `blue-1` was blocked by `red-1` and `blue-3`
      //   by `blue-2`, leaving one legal target out of three — and it is
      //   STRUCTURAL, not a seed: allies stagger diagonally (`allyStride` out
      //   in x, `rankStride` back in y), so the rank-0 ally always lands just
      //   off the rank-1 archer's diagonal.
      //
      //   An archer that stands back to get a better view and ends up with
      //   FEWER targets than a swordsman is the opposite of the feature. The
      //   tactical idea survives intact, and sharpens: **the enemy's front rank
      //   screens the enemy's back rank** — `blue-3` behind `blue-2` is still a
      //   shot you have to move for — while your own line is not the thing
      //   standing in your way.
      //
      //   ► **AND THIS IS THE OPPOSITE OF WHAT `ss2WalkDestination` LEARNED ON
      //     2026-09-12, deliberately, because a walk and a shot are not the
      //     same question.** That clamp iterates EVERY living body and its
      //     comment is emphatic that `physical_size` "does not know whose side
      //     the body is on" — correctly, because a walk is a body moving
      //     through space and cannot pass through anyone, friend or foe. A shot
      //     passes OVER a formation that is cooperating with the shooter: your
      //     own line knows an archer is behind it and leaves the lane, and the
      //     enemy does not. Copying the walk's rule here without asking which
      //     question it answered is what produced the one-target archer.
      //
      //   EVERY other living body, then, and only the SNIPE is handed it. Self
      //   is excluded because `view.allies` includes the actor; the target is
      //   excluded by `ss2ShotBlocked` itself, since at the moment of the shot
      //   its own projection onto the line is the line's endpoint.
      const snipeBodies = [
        ...view.foes,
        ...view.allies.filter((ally) => ally.id !== actorId)
      ];

      // THE CONTROLLER FRAME, reproduced. The build picks one of four frames
      // per turn and each wires a different eight buttons; for a melee hero
      // that is `closerange_warrior` vs `longrange_warrior`, selected by
      // `fightdistance < hero.weapon_range` — frame 4 `DoAction@0x238bbf`
      // `+0x00f6`, re-derived 2026-09-11 from the map's own transcription of
      // the selector. STRICT `<`, as the build has it.
      //
      // ► **THAT IS THE HERO'S HALF OF THE SELECTOR AND THE ONLY HALF MODELLED.
      //   TWO MORE REACH GATES EXIST IN THE BUILD (found 2026-09-12 by a wave,
      //   re-derived here), and NEITHER is `weapon_range`:**
      //
      //   - The same selector's BOW arm, which never reads `weapon_range` at
      //     all: `using_bow ? (fightdistance < 100 + hero.physical_size) : ...`
      //     (`+0x00b9` the test, `+0x0141`/`+0x0158`/`+0x015f` the arm).
      //   - **The VILLAIN's own AI gate, which is a different function from the
      //     hero's controller entirely** — `sprite:862/frame:52/DoAction@0x23f835`
      //     `+0x0356`..`+0x03d5`:
      //         (villain.equipped_weapon == 1 && fightdistance < villain.weapon_range)
      //      || (villain.equipped_weapon == 2 && fightdistance < 200)
      //     Two short-circuit `&&`s joined by an `||`, with a HAND-WRITTEN 200
      //     for the drawn-bow case. So in vanilla the two sides do not share a
      //     gate, and the villain's depends on `equipped_weapon`.
      //
      //   This rule set applies the HERO's gate — BOTH arms of it — to every
      //   combatant. That is a narrowing, stated here rather than discovered
      //   later, and `MAP_SILENCE`'s `multi-slot-arena-geometry` already
      //   records that vanilla's one-hero one-villain shape cannot settle what
      //   a symmetric team battle does. **Until 2026-09-13 only the warrior arm
      //   existed and the sentence here said so; the bow arm is now modelled
      //   and `ss2ArcherMinimumRange` is it.**
      //
      // A gladiator with NO position keeps the old position-blind vocabulary
      // exactly — three melee verbs against every foe — which is what
      // `fixtureReplay` asks for and what every rule set declaring no
      // `startingPosition` gets.

      // ► **WHICH CONTROLLER FRAME THIS TURN IS, CHOSEN ONCE — and "once" is
      //   the load-bearing word.**
      //
      //   The build picks ONE of four frames per turn and each wires a
      //   different eight buttons. With one opponent that is the same thing as
      //   deciding per-foe; with three it is not, and the difference IS the
      //   design the owner chose. An archer whose controller were chosen
      //   per-foe could bash the fighter on top of it AND shoot the one across
      //   the arena in the same turn, which would make closing on an archer
      //   worth nothing — and closing on an archer is the whole counterplay the
      //   minimum range exists to create.
      //
      //   **The NEAREST living foe decides it**, because `fightdistance` in the
      //   build is the distance to "the opponent" and with several the nearest
      //   is the only reading that keeps the 1v1 case identical. So: somebody
      //   is on top of you or nobody is, and that settles your whole vocabulary
      //   for the turn.
      //
      //   The melee arm below is UNCHANGED and still per-foe, because that is
      //   what it has always been and the warrior frames wire the same three
      //   buttons whichever foe is nearest.
      const bowDrawn = ss2InBowMode(view.actor);
      const nearestForFrame = nearestFoe(view);
      const nearestDistance = nearestForFrame
        ? ss2FightDistance(view.actor, nearestForFrame)
        : null;
      // `closerange_archer` when the nearest foe is inside the floor, exactly
      // as the selector has it — STRICT `<`, `+0x015f`. An archer with no
      // position, or with no living foe, is on the long-range frame: there is
      // nobody on top of it.
      const archerClosedOn = bowDrawn
        && nearestDistance !== null
        && nearestDistance < ss2ArcherMinimumRange(view.actor);

      let anyInReach = !positioned;
      for (const foe of view.foes) {
        const distance = ss2FightDistance(view.actor, foe);
        if (bowDrawn) {
          // ► **THE ARCHER FRAMES, and neither wires a single melee verb.**
          //   `closerange_archer` wires `bash_attack` and no shot;
          //   `longrange_archer` wires both shots and no bash. Map table
          //   `:227-228`, `:231`, and it is why a drawn bow can never be
          //   offered `quick`/`normal`/`power` however long its reach is —
          //   which is the defect the old construction refusal existed to
          //   prevent, now closed by the vocabulary instead of by a guard.
          // ► **A POSITION-BLIND ARCHER GETS EVERY ARCHER VERB, which is the
          //   SAME widening the melee path above has always had and needed
          //   saying twice.** `distance === null` means this rule set models no
          //   geometry — `fixtureReplay`, or any rule set declaring no
          //   `startingPosition` — so there is no `fightdistance` to select a
          //   controller frame with, exactly as there is none to test a reach
          //   against. A melee fighter in that position gets all three melee
          //   verbs rather than one frame's subset; an archer gets all three of
          //   its own.
          //
          //   **The first version of this branch fell through the `continue`
          //   below and left such an archer MUTE** — no shot, no bash, only a
          //   swap and a rest, which is a gladiator that can do nothing but put
          //   its bow away. Found by a test measuring the build's own stamina
          //   costs, which needs `fixtureReplay` to get them and therefore
          //   needs a position-blind archer to exist.
          if (distance === null) {
            anyInReach = true;
            if (resourceValue(view.actor, "ammo_left", 0) > 0) {
              actions.push({ type: Ss2ActionType.BOMBARD, targetId: foe.id });
              actions.push({ type: Ss2ActionType.SNIPE, targetId: foe.id });
            }
            actions.push({ type: Ss2ActionType.BASH_ATTACK, targetId: foe.id });
            continue;
          }
          if (archerClosedOn) {
            // Bash has no reach test of its own in the build: the controller
            // IS the gate, and it was chosen on the nearest foe. So bash
            // reaches exactly as far as the frame does.
            if (distance < ss2ArcherMinimumRange(view.actor)) {
              anyInReach = true;
              actions.push({ type: Ss2ActionType.BASH_ATTACK, targetId: foe.id });
            }
            continue;
          }
          // A shot needs the foe at or beyond the floor and an arrow to spend.
          if (distance < ss2ArcherMinimumRange(view.actor)) continue;
          if (resourceValue(view.actor, "ammo_left", 0) <= 0) continue;
          anyInReach = true;
          // **THE LOB IS ALWAYS AVAILABLE.** It clears every body that could be
          // standing between the two — measured off the ballistic, not assumed;
          // see the block above `snipeBodies`.
          actions.push({ type: Ss2ActionType.BOMBARD, targetId: foe.id });
          // **THE FLAT SHOT NEEDS A CLEAN LANE**, and it is blocked by anybody
          // at all. `ss2ShotBlocked` is inert whenever the second axis is off,
          // so a 1-D arena is unaffected.
          if (!ss2ShotBlocked(view.actor, foe, snipeBodies)) {
            actions.push({ type: Ss2ActionType.SNIPE, targetId: foe.id });
          }
          continue;
        }
        const inReach = distance === null || distance < reach;
        if (!inReach) continue;
        anyInReach = true;
        actions.push({ type: Ss2ActionType.QUICK_ATTACK, targetId: foe.id });
        actions.push({ type: Ss2ActionType.NORMAL_ATTACK, targetId: foe.id });
        actions.push({ type: Ss2ActionType.POWER_ATTACK, targetId: foe.id });
      }

      // ► **`psyche_up` IS ON EVERY CONTROLLER FRAME, WHICH IS WHY IT IS
      //   OFFERED OUTSIDE THE MELEE/ARCHER SPLIT ABOVE.** The map's button
      //   table wires it on all eight rows — both facings of
      //   `longrange_warrior`, `closerange_warrior`, `longrange_archer` and
      //   `closerange_archer` (`:223-230`) — unlike every attack verb, each of
      //   which belongs to one kind of frame.
      //
      // ► **AND IT IS OFFERED OUT OF REACH TOO, DELIBERATELY.** The charge
      //   presses have no range test at all — they are an animation and a
      //   counter — and the discharging press resolves its OWN gate and
      //   decides nothing when it fails. Requiring reach here would hide the
      //   verb from a gladiator who is entitled to start charging while he
      //   closes, which is the whole shape of the action.
      //
      // ► **THE GATES ARE THE COUNTER'S DECLARATION AND `herolevel`.** The
      //   build hides the BUTTON below `herolevel` 7 on the warrior frames and
      //   3 on the archer ones (map `:247` and the frame table). The map is
      //   also explicit that the phase machine never consults the controller
      //   frame, so a driver calling `getphase("psyche_up")` reaches the phase
      //   whatever the level — **the level gates the OFFER, not the phase**,
      //   and `legalActions` is the offer.
      //
      //   The declaration gate is not cosmetic: `psyche_up` has no
      //   `SS2_RESOURCE_DEFAULTS` entry, so a combatant that never stated the
      //   counter cannot carry one, and offering a verb whose whole effect is a
      //   number it cannot hold would be a button that does nothing.
      if (declaredResourceNames(view.actor).has("psyche_up")) {
        const psycheGate = ss2InBowMode(view.actor) ? 3 : 7;
        if (resourceValue(view.actor, "herolevel", 0) >= psycheGate) {
          for (const foe of view.foes) {
            actions.push({ type: Ss2ActionType.PSYCHE_UP, targetId: foe.id });
          }
        }
      }

      // ► **WHICH CONTROLLER FRAME THE GLADIATOR IS ON, computed ONCE because
      //   two arms below need it and a second copy is a second chance to be
      //   wrong** — the argument the walk arm makes about `anyInReach` and
      //   `suggestAction` makes twice about distance. For a warrior "in reach"
      //   and "on the close frame" are the same condition; **for an archer they
      //   are opposites**, which is why this is not simply `anyInReach`.
      const onCloseFrame = bowDrawn ? archerClosedOn : anyInReach;

      if (positioned) {
        // Which walk buttons the frame wires, from the map's own table
        // (battle map, "Buttons wired per controller frame", `:223-230`).
        //
        // ► **THAT TABLE CONTRADICTS ITS OWN SUMMARY SENTENCE at `:219`**,
        //   which says the label set is "facing-invariant apart from the
        //   charge/ranged handedness". Compared as SETS, three of the four
        //   controllers differ between facings in MOVEMENT labels too; only
        //   `longrange_warrior` matches the summary. Re-derived by hand
        //   2026-09-10 and again 2026-09-11 — the table wins, because it
        //   carries the offsets and the summary carries none.
        //
        // The consequence is a real rule and not a nit: `closerange_warrior`
        // wires NO toward-movement in either facing — facing right it wires
        // `jumpleft`/`walkleft`, facing left `jumpright`/`walkright`, both of
        // which are RETREAT. **Once you are in range the build lets you back
        // out and never further in.** `longrange_warrior` wires both.
        //
        // ► **THE ARCHER FRAMES SPLIT THE SAME WAY AND THE PREDICATE IS NOT
        //   `anyInReach`.** `closerange_archer` wires one walk and it is the
        //   retreat (`jumpleft`/`walkleft` facing right, mirrored facing left —
        //   map `:229-230`), exactly like `closerange_warrior`;
        //   `longrange_archer` wires both (`:227-228`).
        //
        //   For a warrior "in reach" and "on the close frame" are the same
        //   condition, so `anyInReach` says both. **For an archer they are
        //   opposites**: a shot on offer means you are on the LONG frame, which
        //   wires both walks. Reusing `anyInReach` here would have pinned an
        //   archer to retreating whenever it had a shot and let it advance
        //   freely whenever it was being bashed — the rule inverted, in the one
        //   place it is most punishing.
        const nearest = nearestFoe(view);
        const towardIsRight = nearest ? nearest.x > view.actor.x : true;
        const away = towardIsRight ? Ss2ActionType.WALK_LEFT : Ss2ActionType.WALK_RIGHT;
        const offered = onCloseFrame
          ? [away]
          : [Ss2ActionType.WALK_LEFT, Ss2ActionType.WALK_RIGHT];
        // ► **ORDERED BY DIRECTION, LEFT BEFORE RIGHT — the build's own slot
        //   order, and the first version of this ordered by AWAY-then-TOWARD,
        //   which was an invented rule.** Checked across all eight rows of the
        //   map's table: every controller that wires both puts `walkleft` at
        //   `optionB` and `walkright` at `optionE`, in BOTH facings. So the
        //   build orders the two buttons by direction and never by their
        //   relationship to the opponent — which it cannot do, because the
        //   slots are wired once per frame and the opponent moves.
        for (const type of offered) actions.push({ type, targetId: actorId });
      }

      // ► **THE TAUNT, AND WHICH CONTROLLER WIRES IT IS THE WHOLE GATE.**
      //   Three of the four frames offer it and they do not agree on when
      //   (map §"Buttons wired per controller frame"):
      //
      //   - `longrange_warrior` (frame 5) and `longrange_archer` (frame 20)
      //     share ONE slot between `taunt` and `rest`, split on
      //     `staminaleft / staminamax * 100 >= 50` — `+0x0c0a`/`+0x10a2` and
      //     `+0x0c15`/`+0x110a`, one site per facing. **At or above half the
      //     taunt button exists and the rest button does not.**
      //   - `closerange_archer` (frame 28) has NO stamina test and always
      //     wires it.
      //   - `closerange_warrior` (frame 13) wires no taunt in either facing.
      //
      //   **Recognised through `onCloseFrame`, which this function already
      //   computed for the walks**, rather than by a second distance test — the
      //   argument the walk arm above makes and `suggestAction` makes twice.
      //   A warrior on the close frame is the one case with no taunt at all.
      //
      // ► **AND `rest` IS STILL OFFERED UNCONDITIONALLY BELOW, WHICH IS A
      //   DIVERGENCE THIS ARM DOES NOT INTRODUCE AND DOES NOT FIX.** The build
      //   wires `rest` only on the two longrange frames and only BELOW half
      //   stamina; here it is always legal. So above half on a longrange frame
      //   this engine offers both where the build offers one. Changing that
      //   moves every bout's option list and the AI's forced-rest gate, so it
      //   is its own decision and is recorded rather than taken.
      if (!(onCloseFrame && !bowDrawn)) {
        const staminaMax = resourceValue(view.actor, "staminamax", 0);
        const staminaLeft = resourceValue(view.actor, "staminaleft", 0);
        const rested = staminaMax > 0
          ? (staminaLeft / staminaMax) * 100 >= SS2_TAUNT.staminaPercent
          : false;
        if ((bowDrawn && onCloseFrame) || rested) {
          for (const foe of view.foes) actions.push({ type: Ss2ActionType.TAUNT, targetId: foe.id });
        }
      }

      // ► **THE RANK VERBS, and they are what make the geometry a CHOICE.**
      //
      //   Offered whenever the rule set models depth and there is a rank that
      //   way, INCLUDING when a foe is already in reach — unlike the walks
      //   above, which the build narrows to the retreat direction once you are
      //   engaged (`closerange_warrior` wires no toward-movement).
      //
      //   That is a deliberate departure and it is the whole point: the build
      //   narrows the walks because a vanilla duel has one opponent and the
      //   only question is how far apart you two stand. With ranks there is a
      //   second question the build never had — WHICH fight you are in — and
      //   answering "you may not leave this one" would rebuild the single
      //   interface the second axis exists to break. **Breaking off is the
      //   feature.**
      //
      //   Both directions are always offered when they exist, ordered BACK
      //   before FRONT, for the same reason the walks are ordered left before
      //   right: the build orders buttons by direction and never by their
      //   relationship to the opponent, which it cannot do because the
      //   opponent moves.
      if (Number.isFinite(view.actor.y)) {
        // ► **AND THE RANK MUST BE FREE WHERE YOU WOULD LAND. Found by the
        //   owner looking at the arena, 2026-09-12, in the same report that
        //   found allies walking through each other.**
        //
        //   A rank change keeps your x and changes your depth, so it can drop
        //   you exactly on top of somebody standing at your x in the next
        //   rank. The walk clamp cannot help: it clamps a walk, and this is
        //   not one. Measured before this gate, 24 seeds at stride 97: 11.7%
        //   of turns had two bodies overlapping that a walk would never have
        //   allowed to meet.
        //
        //   This is the occupancy test the design panel said discrete ranks
        //   would buy — "blocking becomes one occupancy test instead of
        //   pathfinding" — and it is the whole benefit of ranks being discrete
        //   rather than a continuous depth. It costs one comparison per body.
        const others = [
          ...view.foes,
          ...view.allies.filter((ally) => ally.id !== actorId)
        ];

        // ► **A DUEL MAY CLOSE THE GAP AND MAY NOT FLEE. Owner's decision,
        //   2026-09-12, after the exploit was measured rather than argued.**
        //
        //   `view.allies` includes the actor and both lists hold only the
        //   living, so a total of two IS the endgame duel — however it was
        //   reached, and including a 1v1 that was a duel from the first turn.
        //
        //   **What it fixes, measured.** A fighter that never attacks and
        //   changes rank every turn cannot WIN — 0 of 144 bouts across three
        //   strides and two sizes, because the crowd's toll kills it — but it
        //   stretches a 1v1 from 59 actions to **425**, a sevenfold tax on
        //   everyone's patience for a fight it cannot affect. Not a fairness
        //   defect; a pacing one.
        //
        //   **Why the obvious rule is WRONG, and it fires backwards.** "No rank
        //   change while you have one foe left" locks the wrong side of a 3v1:
        //   each of the three has exactly one foe and would be frozen, while
        //   the lone survivor has three and could still dance. The count has to
        //   be of EVERYBODY alive, not of your own foes.
        //
        //   **It is CLOSE-ONLY rather than a ban**, because a duel that begins
        //   in different ranks must still be able to meet. Vanilla's duel is
        //   one-dimensional, so the end state this drives toward is the parity
        //   case; the journey there is still the player's.
        const duel = view.allies.length + view.foes.length === 2;
        const lone = duel ? view.foes[0] : null;
        const closing = lone && Number.isFinite(lone.y) && lone.y !== view.actor.y
          ? (lone.y > view.actor.y ? Ss2ActionType.RANK_FRONT : Ss2ActionType.RANK_BACK)
          : null;

        for (const type of [Ss2ActionType.RANK_BACK, Ss2ActionType.RANK_FRONT]) {
          // In a duel the only legal rank change is the one that closes the
          // gap, and when the two already share a rank there is none.
          if (duel && type !== closing) continue;
          const to = ss2RankDestination(view.actor.y, SS2_RANK_DIRECTION[type], rankStride);
          if (to === null) continue;
          // **Occupied is not refused, it is ARRIVED BESIDE** — see
          // `ss2RankArrivalX`. Only a lane with no free spot at all is refused,
          // which needs the whole band full and is why this is `null` rather
          // than a boolean.
          if (ss2RankArrivalX(view.actor.x, others, to) === null) continue;
          actions.push({ type, targetId: actorId });
        }
      }

      // ► **THE SWAP IS NOT A CONTROLLER BUTTON, AND THAT IS WHY IT IS HERE —
      //   after every frame-specific verb, offered on all four frames alike.**
      //
      //   The map is explicit: *"No controller frame wires `swap_weapons`."*
      //   The only manual route is the battle inventory overlay,
      //   `swap_inventory.onRelease` in sprite 862 frame 1
      //   `DoAction@0x2378cc` `+0x1015`, whose whole body is
      //   `getphase("swap_weapons")` at `+0x1067`. An overlay button is
      //   available whatever frame the controller is resting on, so this is
      //   offered whatever the gladiator is otherwise able to do — including
      //   while it is being bashed at point-blank range, which is exactly the
      //   moment an archer wants it.
      //
      //   ► **AND IT IS GATED ON OWNING A BOW, which the build gates the same
      //     way**: the swap button is `_visible = false` when the hero has no
      //     secondary weapon (`+0x0e77`-`+0x0e96`). The test here is a
      //     `secondary_weapon_range` above zero rather than a weapon id,
      //     because equipment identity does not survive into the resolver —
      //     and a zero reach is precisely what `ss2BattleValues` leaves for a
      //     gladiator whose secondary slot holds nothing.
      //
      //   **The build never checks that the secondary weapon IS a bow**
      //   (`+0x4d23`, a plain toggle), and neither does this. A gladiator who
      //   swaps to a sword gets the archer controllers and their minimum range
      //   anyway, which is a vanilla quirk reproduced rather than a rule
      //   invented — it is unreachable through the shop, since `buyweapon`
      //   routes only the ranged band to the secondary slot
      //   (`assertSs2WeaponPurchasable`).
      if (resourceValue(view.actor, "secondary_weapon_range", 0) > 0) {
        actions.push({ type: Ss2ActionType.SWAP_WEAPONS, targetId: actorId });
      }

      actions.push(rest);
      return actions;
    },

    /**
     * Draws the direction, delegates the whole ingress to the candidate
     * arithmetic, then translates what it did into declarative effects.
     *
     * `rolls` is passed through UNWRAPPED: the resolver's per-action channel
     * exposes `randomBetween(label, min, max)` and `randomNumber(label, n)`
     * with the same signatures the arithmetic calls, so an adapter here would
     * be an identity function with a place to introduce a bug.
     */
    resolveAction(request, rolls) {
      const actor = request.actor;

      // THE CROWD'S TOLL, AND IT IS PREPENDED HERE ON PURPOSE.
      //
      // Above the status-phase return and above the REST return below, because
      // the defect it closes is a REST standoff: a toll placed by the attack
      // bands would let the exact fixpoint it exists to break walk straight
      // past it. Every action pays, including the ones that are not choices.
      //
      // `fixtureReplay` never pays. A promoted golden is one measured action
      // and reaches no turn number that could owe anything, but the gate is
      // explicit rather than incidental so a fixture can never be re-datumed
      // by an authored mechanic.
      // **COMPUTED AT THE TOP, APPLIED AT THE END — and those are different
      // things, which cost a wrong first version.** The CODE placement is here
      // so no return path can skip the toll. The EFFECT ORDER is last on every
      // path, because `applyEffects` clamps health to `[0, maxHealth]` after
      // each effect: a toll placed FIRST killed the actor and then `rest`'s own
      // heal brought it straight back inside the same effect list, so the
      // combatant died and revived invisibly and the 4,000-action standoff
      // survived unchanged. `collectKnockouts` compares liveness across the
      // whole list, so it could not see it either. Measured, not reasoned.
      const toll = fixtureReplay ? 0 : ss2CrowdDamage(request.turnNumber, crowdPatience);
      const crowd = toll > 0
        ? [{ kind: EffectKind.DAMAGE, targetId: actor.id, amount: toll }]
        : [];

      // ► **FACING, RECOMPUTED EVERY ACTION AS THE BUILD RECOMPUTES IT EVERY
      //   PHASE ADVANCE.** See `ss2FacingEffects`. Threaded exactly like the
      //   crowd's toll above and for the same reason: every return path has to
      //   carry it, including the ones that are not choices, or a gladiator
      //   keeps a facing its position stopped justifying.
      //
      //   **It takes the actor's position AFTER the move, not before.** The
      //   build's `changeCombatants` runs at phase advance — once the walk has
      //   completed — so deriving from the pre-move x would face everybody the
      //   way they were standing one action ago. The two movement branches
      //   below pass their own destination; everything else cannot move
      //   anybody and passes the actor unchanged.
      // ► **ONLY THE TWO MOVEMENT BRANCHES CARRY IT, and that is equivalence
      //   rather than economy.** Facing is a function of `x` alone
      //   (`ss2FacingEffects`), and in this engine exactly two verbs move
      //   anybody: a walk and a rank change. An attack, a rest and a status
      //   phase cannot change a facing, so recomputing on them emits an effect
      //   that is always a no-op.
      //
      //   It is not merely wasteful. The first version threaded it through
      //   every return the way the crowd's toll is threaded, and it appended a
      //   facing write to the status list of a KILLING BLOW — turning a
      //   gladiator that had just died, inside the effect list that clears its
      //   conditions in `death()`'s own measured order. The order survived,
      //   because the append lands after it; the lesson is that the crowd's
      //   toll has to reach every path and this does not, and copying the
      //   pattern without asking which was which is how a measured sequence
      //   acquires a passenger.
      const facingAfter = (movedActor) => {
        const mine = (request.allies ?? []).map((ally) => (ally.id === actor.id ? movedActor : ally));
        return ss2FacingEffects(
          mine.some((ally) => ally.id === actor.id) ? mine : [movedActor, ...mine],
          request.foes ?? []
        );
      };


      const statusFlag = SS2_FLAG_FOR_STATUS_PHASE[request.type];
      if (statusFlag) {
        const phase = resolveStatusPhase(request, statusFlag, fightMode, observer);
        return crowd.length ? { ...phase, effects: [...phase.effects, ...crowd] } : phase;
      }

      if (request.type === Ss2ActionType.REST) {
        // `staminacost = 0 - round(stamina * 15)` at `+0x5163` — negative, so
        // `nextphase`'s subtraction is a gain — plus the branch's own
        // `staminaleft += game_attacker.stamina` at `+0x521d`.
        //
        // The hitpoint gain is BOTH the branch's own `3 + ceil(stamina)`
        // (`+0x51d5`) and `nextphase`'s `1 + ceil(stamina / 2)` (`+0x3305`).
        //
        // CORRECTED 2026-09-02, and the correction is the instructive part.
        // This block previously applied only the `nextphase` term, on a
        // comment asserting that the sole offset-backed site for
        // `3 + ceil(stamina)` was `+0x684c` in the TAUNT branch. That is
        // false: `+0x51d5` is the rest branch's own, inside the same
        // `attacker.struck == null` guard as the `+0x521d` stamina write this
        // file already copied. `docs/integration/ss2-battle-map.md` said so in
        // prose and was OVERRULED by an asserted byte claim, and a test was
        // then written to pin the resulting wrong number. Two independent
        // verifiers broke it; the bytes above were then read directly. The
        // map's own writers table still lists only `+0x684c`, which is how the
        // error survived a reader who trusted the table over the prose.
        const stamina = actor.stats.stamina;
        const transition = phaseTransitionEffects(actor, {
          staminaCost: 0 - Math.round(stamina * 15),
          branchGain: stamina,
          branchHeal: 3 + Math.ceil(stamina)
        });
        // A forced rest still walked the whole chain, so it CONSUMED any
        // pending condition without playing it. Emitted here rather than only
        // on the zero-stamina path because the chain does not know why rest
        // was chosen — and a voluntary rest reaches frame 1 the same way.
        return {
          effects: [...transition.effects, ...statusConsumptionEffects(actor), ...crowd],
          events: [{
            type: Ss2ActionType.REST,
            actorId: actor.id,
            targetId: actor.id,
            staminaGained: transition.staminaGained,
            healed: transition.healed
          }]
        };
      }

      // ► **A RANK CHANGE, resolved beside the walk and costed like one.**
      //
      //   The stamina is the walk's — `round(movement_speed / 2)`, `walkleft`
      //   `+0x3b37` — and that is a CHOICE this comment owns rather than a
      //   derivation: the build has no sidestep to price. It is the most
      //   defensible price available, because a rank change is a movement
      //   phase and every movement phase the build has costs exactly this. It
      //   goes through `phaseTransitionEffects` like a walk, so it is a
      //   COMPLETED PHASE that pays and regenerates rather than a free step —
      //   which is what lets it compete with attacking instead of dominating.
      //
      //   **It pays the crowd's toll too**, prepended above with every other
      //   action, so breaking off cannot outrun the clock. That matters more
      //   here than anywhere: with free disengage and a second axis, the toll
      //   is the only thing standing between the arena and a kiting stalemate.
      // ► **THE SWAP, AND IT IS A WHOLE TURN FOR ONE STAMINA. Owner's decision,
      //   2026-09-13: keep the build's answer.**
      //
      //   `swap_weapons` is a phase like any other — overlay frame 52
      //   `DoAction@0x240c7f` `+0x4d23` — so it goes through
      //   `phaseTransitionEffects` exactly as a walk does and gets the same
      //   regeneration and heal a completed phase gets. `staminacost = 1`
      //   (`+0x4d35`), which is the cheapest non-negative cost in the whole
      //   table and is almost certainly meant to be nominal: what the swap
      //   really costs is the TURN.
      //
      //   The toggle itself is two lines: `using_bow != true` sets
      //   `equipped_weapon = 2` and `using_bow = true` (`+0x4dbd`, `+0x4dce`);
      //   otherwise `equipped_weapon = 1` and `using_bow = false` (`+0x4eba`,
      //   `+0x4ecb`). One resource moves here because the other three derived
      //   numbers are selected at read time — see `SS2_RESOURCE_NAMES`.
      //
      //   **It is NOT repriced by `ss2SwingCost` and pays no attack-speed
      //   term**, because it is not a swing. The crowd's toll above applies,
      //   like it does to every action including the ones that are not choices:
      //   putting the bow away must not outrun the clock either.
      if (request.type === Ss2ActionType.SWAP_WEAPONS) {
        const drawn = ss2InBowMode(actor);
        const transition = phaseTransitionEffects(actor, { staminaCost: 1 });
        const effects = [...transition.effects];
        // Guarded on declaration like every other resource write in this file:
        // the resolver refuses an undeclared name mid-list and leaves the
        // earlier effects applied, which is a partial action with no rollback.
        if (declaredResourceNames(actor).has("equipped_weapon")) {
          effects.push({
            kind: EffectKind.RESOURCE,
            targetId: actor.id,
            resource: "equipped_weapon",
            to: drawn ? 1 : 2
          });
        }
        return {
          effects: [...effects, ...crowd],
          events: [{
            type: Ss2ActionType.SWAP_WEAPONS,
            actorId: actor.id,
            targetId: actor.id,
            // What the gladiator is holding AFTER the swap, so a UI can say
            // "draws a bow" rather than having to diff two projections.
            equippedWeapon: drawn ? 1 : 2,
            drewBow: !drawn,
            vanillaLabel: VANILLA_PHASE_LABEL[Ss2ActionType.SWAP_WEAPONS],
            staminaGained: transition.staminaGained,
            healed: transition.healed
          }]
        };
      }

      const rankDirection = SS2_RANK_DIRECTION[request.type];
      if (rankDirection) {
        const to = ss2RankDestination(actor.y, rankDirection, rankStride);
        if (to === null) {
          throw new TeamRuleSetError(
            `${request.type} needs a rank to move into, and ${actor.id} has none that way. ` +
            "legalActions offers a rank verb only when ss2RankDestination finds one."
          );
        }
        const rankBodies = [
          ...(request.foes ?? []),
          ...(request.allies ?? []).filter((ally) => ally.id !== actor.id)
        ];
        const arrivalX = ss2RankArrivalX(actor.x, rankBodies, to);
        if (arrivalX === null) {
          throw new TeamRuleSetError(
            `${request.type} found no free ground in the rank at ${to} for ${actor.id}. ` +
            "legalActions offers a rank verb only when ss2RankArrivalX finds a spot."
          );
        }
        const transition = phaseTransitionEffects(actor, {
          staminaCost: Math.round(ss2MovementSpeed(actor) / 2)
        });
        return {
          effects: [
            { kind: EffectKind.LATERAL, targetId: actor.id, to },
            // **The sidestep AROUND a body, and only when there was one.** A
            // rank change into empty ground emits no POSITION effect at all,
            // so the overwhelmingly common case stays a pure one-axis move and
            // the effect log says which kind of step this was.
            ...(arrivalX === actor.x
              ? []
              : [{ kind: EffectKind.POSITION, targetId: actor.id, to: arrivalX }]),
            ...transition.effects,
            ...crowd,
            // A rank change can move x when it sidesteps a body, so facing is
            // derived from where it actually landed.
            ...facingAfter({ ...actor, x: arrivalX })
          ],
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: actor.id,
            // Present only when the sidestep happened, for the same reason:
            // the presentation binds a movement on finite `from`/`to`, and a
            // rank change into empty ground must not look like a walk.
            ...(arrivalX === actor.x ? {} : { from: actor.x, to: arrivalX }),
            // **`fromY`/`toY`, NOT `from`/`to`.** The presentation detects
            // movement by a finite `from` and `to`, which are X endpoints
            // (`src/adapter/presentation.js`, the movement case); reusing them
            // would make a step in depth play a `walkleft` clip and slide the
            // figure sideways. A depth move needs its own fields and its own
            // case, exactly as `src/render/scene.js` spells out about
            // `move-clip` folding only `x`.
            fromY: actor.y,
            toY: to,
            // **NO `vanillaLabel`, and that is the honest answer rather than a
            // gap.** The walk beside this one carries the build's own phase
            // name because there IS one; there is no sidestep phase to name,
            // and putting `walkleft` here would play a guessed gait — exactly
            // what that field exists to prevent. The presentation reports an
            // event it cannot bind rather than inventing a clip for it.
            staminaGained: transition.staminaGained,
            healed: transition.healed
          }]
        };
      }

      const walkDirection = SS2_WALK_DIRECTION[request.type];
      if (walkDirection) {
        if (!Number.isFinite(actor.x)) {
          throw new TeamRuleSetError(
            `${request.type} needs a position, and ${actor.id} has none. A rule set built with ` +
            "fixtureReplay: true models no geometry and never offers a walk."
          );
        }
        // `walkleft` `+0x3b37` / `walkright` `+0x3d16`:
        // `staminacost = round(movement_speed / 2)`. Spent by `nextphase`'s
        // subtraction like every other phase, so the same helper applies it
        // and the transition's heal and regeneration still run — **a walk is a
        // completed phase, not a free step**, which is the whole reason it can
        // be a real choice against resting.
        const transition = phaseTransitionEffects(actor, {
          staminaCost: Math.round(ss2MovementSpeed(actor) / 2)
        });
        // **THE DISPLACEMENT IS THE BUILD'S AND IS PER-ACTOR.** It was a flat
        // authored 44 until 2026-09-11; `ss2WalkDisplacement` derives it from
        // `movement_speed` out of the same branch this cost comes from, and
        // `ss2WalkDestination` applies both of the build's clamps — the arena
        // bound from `nextphase` step 1, and the overlap clamp that stops a
        // walk carrying a gladiator into its opponent.
        // ► **EVERY LIVING BODY, NOT JUST THE FOES. Found by the owner looking
        //   at the arena, 2026-09-12: two ALLIES were drawn inside each other.**
        //
        //   `ss2WalkDestination` iterated `foes` alone, which is not a decision
        //   anybody made — it is an artifact of vanilla having exactly ONE
        //   defender, so "the defender" and "every other body" were the same
        //   list and nothing had to choose. With allies in the arena they are
        //   different lists, and the clamp was reading the wrong one.
        //
        //   Measured before the fix, 24 seeds, 3v3: **83.0% of turns at stride
        //   0 had at least one pair of allies overlapping, and the closest gap
        //   was 0** — two gladiators on the same point. `physical_size` is how
        //   big a body is; it does not know whose side the body is on.
        //
        //   Self is excluded because `view.allies` includes the actor, and a
        //   gladiator that clamped against itself would never move at all.
        // `?? []` on BOTH, matching `ss2WalkDestination`'s own defensive
        // style: `resolveAction` is called directly by tests that hand it a
        // request carrying only the list they care about, and a rule set that
        // threw on the other one would be demanding a shape its own contract
        // does not require.
        const bodies = [
          ...(request.foes ?? []),
          ...(request.allies ?? []).filter((ally) => ally.id !== actor.id)
        ];
        const to = ss2WalkDestination(actor, bodies, walkDirection);
        return {
          effects: [
            { kind: EffectKind.POSITION, targetId: actor.id, to },
            ...transition.effects,
            ...crowd,
            // The whole point of the post-move derivation: a walk that carries
            // you past the midpoint turns you round, and the build turns you
            // round AFTER the walk lands.
            ...facingAfter({ ...actor, x: to })
          ],
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: actor.id,
            from: actor.x,
            to,
            // **THE FIELD THE PRESENTATION HALF CANNOT DO WITHOUT.** `from`
            // and `to` give the direction and never the GAIT — nothing in the
            // geometry separates a walk from a run, a charge or a jump — so
            // `SS2_STATIC_MAP_BINDINGS` reports a movement event that does not
            // name its phase rather than guessing one. This is that name, and
            // it is the build's own spelling.
            vanillaLabel: VANILLA_PHASE_LABEL[request.type],
            staminaGained: transition.staminaGained,
            healed: transition.healed
          }]
        };
      }

      // ► **THE TWO PRESSES THAT ARE NOT AN ATTACK, RESOLVED BEFORE THE BAND
      //   LOOKUP BECAUSE THEY NEVER REACH IT.**
      //
      //   The counter is READ at press time and advanced when the animation
      //   reports back, so a fresh gladiator at 1 plays `psyche_up` and becomes
      //   2, at 2 plays `psyche_up2` and becomes 3, and at 3 plays `psyche_up3`
      //   AND fires. Presses one and two draw nothing at all: no direction, no
      //   chance, no critical. They cost stamina like any completed phase and
      //   they move one number.
      let psycheCounter = null;
      /**
       * What the taunt's two pre-dispatcher draws came to, kept so the strike
       * arm's event can carry them.
       *
       * Three of the four taunt outcomes return from the branch below with
       * their own event; the fourth falls through to the shared dispatcher,
       * which builds an ordinary attack event. Without this it would be the
       * only taunt in the game that does not say what it rolled.
       */
      let tauntRoll = null;
      /** The taunt branch's own pre-roll recovery, so the strike arm can emit it too. */
      let tauntRecovered = null;
      if (request.type === Ss2ActionType.PSYCHE_UP) {
        // ► **CLAMPED TO THE FLOOR, BECAUSE A RECORD MAY STATE 0 AND THE BUILD
        //   CANNOT HOLD 0 AFTER ANY TURN.** Both of the build's resets write 1
        //   (`+0x35c7`-`+0x35ea`, `+0x1be4`), so 1 is "fresh"; but the map is
        //   SILENT on the value before the first write, the adapter therefore
        //   treats the field as "numeric defaulting to 0"
        //   (`psyche-up-initialisation`), and `tools/arena/roster.js` has
        //   authored `psyche_up: 0` since 2026-09-10.
        //
        //   Unclamped, such a gladiator needed FOUR presses to discharge and
        //   played `psyche_up` TWICE — `clips[Math.min(0, 3) - 1]` is
        //   `clips[-1]`, which fell through to `clips[0]`. So the arena's own
        //   roster got a different action from the one the tests exercised,
        //   which is the shape of defect this repository calls an integration
        //   gap rather than a bug in either half.
        //
        //   **Reading below-floor as fresh is the reconciliation**, and it is
        //   the map's own semantics rather than a convenience: anything under 1
        //   is a state the build leaves nobody in.
        psycheCounter = Math.max(
          SS2_PSYCHE_UP.floor,
          resourceValue(actor, "psyche_up", SS2_PSYCHE_UP.floor)
        );
        const clip = SS2_PSYCHE_UP.clips[
          Math.min(psycheCounter, SS2_PSYCHE_UP.dischargeAt) - 1
        ] ?? SS2_PSYCHE_UP.clips[0];
        if (psycheCounter < SS2_PSYCHE_UP.dischargeAt) {
          const transition = phaseTransitionEffects(actor, {
            staminaCost: Math.round(actor.stats.strength * PSYCHE_UP_DISCHARGE.strengthFactor),
            // `nextphase` resets only when `phase_decision != "psyche_up"`, and
            // this IS that decision — so the counter this branch just advanced
            // must survive its own phase transition.
            resetsPsyche: false
          });
          const effects = [...transition.effects];
          // Guarded on declaration like every other resource write here: the
          // resolver refuses an undeclared name mid-list and leaves the earlier
          // effects applied, which is a partial action with no rollback.
          // `legalActions` only offers this verb to a combatant that declares
          // the counter, so the guard is belt to that brace.
          if (declaredResourceNames(actor).has("psyche_up")) {
            effects.push({
              kind: EffectKind.RESOURCE,
              targetId: actor.id,
              resource: "psyche_up",
              to: psycheCounter + 1
            });
          }
          return {
            effects: [...effects, ...crowd],
            events: [{
              type: Ss2ActionType.PSYCHE_UP,
              actorId: actor.id,
              targetId: actor.id,
              // ► **THE CLIP IS ON THE EVENT BECAUSE NOTHING DOWNSTREAM CAN
              //   DERIVE IT.** The phase label is one word for all three
              //   presses and the direction is one number for the discharge and
              //   `cast_whirlwind` alike, so a presentation layer handed either
              //   would have to guess. See `attackLabel`, which refuses to.
              clip,
              counter: psycheCounter,
              counterAfter: psycheCounter + 1,
              discharged: false,
              vanillaLabel: VANILLA_PHASE_LABEL[Ss2ActionType.PSYCHE_UP],
              staminaGained: transition.staminaGained,
              healed: transition.healed
            }]
          };
        }
      }

      const band = ATTACK_BANDS[request.type]
        // The discharging press, and ONLY that press, is band-shaped. See
        // `PSYCHE_UP_DISCHARGE` for why the action is not in `ATTACK_BANDS`.
        ?? (request.type === Ss2ActionType.PSYCHE_UP ? PSYCHE_UP_DISCHARGE : undefined)
        // Only a taunt that ROLLED into the dispatcher reaches here; the branch
        // above returns for the other three outcomes in four.
        ?? (request.type === Ss2ActionType.TAUNT ? TAUNT_STRIKE : undefined);
      if (!band) {
        throw new TeamRuleSetError(`Rule set ${ruleSetId} was asked to resolve unknown action ${request.type}.`);
      }
      const target = request.target;
      if (!target) {
        throw new TeamRuleSetError(`${request.type} needs a target; ${String(request.targetId)} is not a combatant.`);
      }

      // ► **THE TAUNT'S TWO PRE-DISPATCHER DRAWS, AND THEY ARE THE WHOLE REASON
      //   THIS ACTION STAYED DEFERRED.** The candidate implements direction
      //   20's profile and nothing before it, so resolving a taunt through the
      //   ordinary attack path would take the dispatcher's samples on every
      //   press — where the build takes them on ONE OUTCOME IN FOUR. The order
      //   and the count are the contract every peer replaying the same tape
      //   depends on:
      //
      //   ```text
      //     diceroll = randomBetween(1, 100)                      +0x6921
      //     if (diceroll < game_attacker.taunt_percentage) {      +0x694b
      //         taunt_effect = randomBetween(1, 2)                +0x6952
      //         if (taunt_effect == 1) { direction = 20; checkattackroll() }
      //         else if (game_defender.equipped_weapon == 1) { shove }
      //         else { defender.taunted1 = true; defender.psyche_up = 1 }
      //     }
      //   ```
      //
      //   **The comparison is DIRECT** — `diceroll < taunt_percentage` — and
      //   not the dispatcher's `100 - chance` form, which the map flags at the
      //   site because getting it backwards inverts the action: a charismatic
      //   gladiator would fail where a dull one succeeded.
      //
      // ► **AND BOTH CLIPS PLAY BEFORE THE ROLL** (`+0x6905` the actor,
      //   `+0x690c` the target), so a FAILED taunt still animates both. The
      //   event therefore always carries the pair, and `landed` says whether
      //   anything came of it.
      if (request.type === Ss2ActionType.TAUNT) {
        // The branch's own recovery, applied and CLAMPED first — the build's
        // order (`+0x684c`, `+0x6894`, `check_stats` at `+0x68d3`), all before
        // the roll at `+0x6921`.
        tauntRecovered = tauntRecovery(actor);
        const tauntTransition = phaseTransitionEffects(
          actor,
          TAUNT_STRIKE.transitionFor(actor, tauntRecovered)
        );
        const chance = calculateSs2AttackChances(
          vanillaRecordOf(actor, "attacker"),
          vanillaRecordOf(target, "defender")
        ).taunt;
        const roll = rolls.randomBetween("taunt-roll", 1, SS2_TAUNT.rollMax);
        const shared = {
          type: Ss2ActionType.TAUNT,
          actorId: actor.id,
          targetId: target.id,
          vanillaLabel: VANILLA_PHASE_LABEL[Ss2ActionType.TAUNT],
          roll,
          chance,
          // BOTH stages: the branch's own and `nextphase`'s, which is what a
          // reader means by "what did this taunt restore".
          staminaGained: tauntTransition.staminaGained,
          healed: tauntRecovered.healed + tauntTransition.healed
        };
        if (!(roll < chance)) {
          // A failed taunt takes ONE sample and reaches no dispatcher. It still
          // pays, still recovers, and still plays both clips.
          return {
            effects: [...tauntRecovered.effects, ...tauntTransition.effects, ...crowd],
            events: [{ ...shared, landed: false, effect: null }]
          };
        }
        const effect = rolls.randomBetween("taunt-effect-roll", 1, SS2_TAUNT.effectMax);
        tauntRoll = { roll, chance, effect };
        if (effect !== SS2_TAUNT.strikeEffect) {
          // ► **EFFECT 2 SPLITS ON THE DEFENDER'S WEAPON MODE (`+0x69a7`)**,
          //   which is the discriminator the map left open for a year as "a
          //   charisma-scaled knockback OR sets `taunted1`". A melee defender
          //   is shoved; a bow-mode one is made to flee.
          const effects = [...tauntRecovered.effects, ...tauntTransition.effects];
          if (resourceValue(target, "equipped_weapon", 1) === 1) {
            // ► **THE DISPLACEMENT IS UNCONDITIONAL AND THE ANIMATION IS
            //   GATED.** `knockback(defender, force)` is called whenever this
            //   arm is entered (`+0x6ab1`); `defender.gotoAndPlay("knockback")`
            //   only above `|force| > 100`. The same shape `damagecharacter`
            //   has, where the fighter always moves and only the clip is gated.
            const magnitude = Math.max(
              SS2_TAUNT.minimumForce,
              resourceValue(actor, "charisma", 0) * SS2_TAUNT.forceFactor
            );
            // ► **THE SIGN IS THE ACTOR'S FACING**, which this engine carries
            //   as the status token `facing-left` (absent means right) because
            //   a resource bag holds only finite numbers. The build reads
            //   `attacker.gladiator_dir == "right"` at `+0x69c8` and negates
            //   for the other arm.
            const facingLeft = (actor.status ?? []).includes(SS2_FACING_LEFT);
            const force = facingLeft ? 0 - magnitude : magnitude;
            // ► **AND THE SHOVE MOVES HIM, which the first cut did not do.**
            //   `knockback(defender, force)` at `+0x6ab1` tweens the defender's
            //   `_x` by the force, UNCONDITIONALLY — the `|force| > 100` gate
            //   above it is the ANIMATION's, not the displacement's. A Codex
            //   review reproduced a shove reporting force 750 while the
            //   defender stood exactly where he was, which makes a successful
            //   outcome inert: it cannot change distance, and therefore cannot
            //   change what either gladiator may do next.
            //
            //   **Clamped to the arena the same way a walk is**, because
            //   `nextphase` step 1 bounds every `_x` and a shove is not exempt.
            //   `damagecharacter`'s own knockback still displaces nobody here —
            //   it has travelled as an event field since it was built — and
            //   that gap is now the only one left of its kind.
            const shoved = Number.isFinite(target.x)
              ? clamp(target.x + force, SS2_ARENA.clamp.min, SS2_ARENA.clamp.max)
              : null;
            if (shoved !== null && shoved !== target.x) {
              effects.push({ kind: EffectKind.POSITION, targetId: target.id, to: shoved });
            }
            return {
              effects: [...effects, ...crowd],
              events: [{
                ...shared,
                landed: true,
                effect,
                force,
                from: Number.isFinite(target.x) ? target.x : null,
                to: shoved,
                // The presentation layer needs to know whether the build would
                // have played the clip, and it cannot re-derive the threshold.
                knockbackAnimation: Math.abs(force) > SS2_TAUNT.knockbackAnimationForce
              }]
            };
          }
          // The bow-mode arm: the target is made to flee, and its psych-up
          // charge is broken on the way (`+0x6ac8`, one of the eight writes in
          // the census at `SS2_PSYCHE_UP.floor`).
          if (declaredResourceNames(target).has("psyche_up")) {
            effects.push({
              kind: EffectKind.RESOURCE,
              targetId: target.id,
              resource: "psyche_up",
              to: SS2_PSYCHE_UP.floor
            });
          }
          effects.push({
            kind: EffectKind.STATUS,
            targetId: target.id,
            status: ss2StatusToken(SS2_TAUNT.flag, actor.id),
            active: true
          });
          return {
            effects: [...effects, ...crowd],
            events: [{ ...shared, landed: true, effect, flag: SS2_TAUNT.flag }]
          };
        }
        // `taunt_effect == 1` falls through to the dispatcher with direction
        // 20 and `TAUNT_STRIKE`'s own transition. The two samples above are
        // already on the tape, in the build's order.
      }


      // ► **OUT OF RANGE, THE DISCHARGE DECIDES NOTHING AT ALL — NO ROLL, NO
      //   DAMAGE, NO DEATH — AND THAT IS UNLIKE EVERY MELEE ATTACK.**
      //
      //   `power_attack`, `normal_attack` and `quick_attack` draw a direction
      //   and call `checkattackroll()` with no distance test whatever
      //   (`power_attack` runs straight from `+0x607c` to the call at
      //   `+0x6146`), so a melee blow issued from across the arena still
      //   resolves and misses. Only `psyche_up` and `cast_whirlwind` gate on
      //   range, comparing `attacker._x` against
      //   `defender._x -/+ round(weapon_range + 50)` by facing
      //   (`+0x6658`-`+0x6699` right, `+0x66d1`-`+0x6712` left).
      //
      //   **It must therefore run BEFORE the first draw**, for the reason the
      //   block below spells out about the record builders: a refusal after a
      //   draw leaves the battle hashed differently from a peer that never
      //   attempted it.
      //
      // ► **AND THE COUNTER IS LEFT ALONE, WHICH IS UNOBSERVABLE EITHER WAY.**
      //   The map does not say whether a gated-out press still advances it. It
      //   does not matter: the counter is already at or past `dischargeAt` and
      //   every value there selects the same arm, so advancing and not
      //   advancing produce the same clip and the same next press. **Said here
      //   rather than left as a silent choice** — if a capture ever shows the
      //   counter climbing, nothing downstream changes.
      if (request.type === Ss2ActionType.PSYCHE_UP) {
        const separation = ss2FightDistance(actor, target);
        const gate = Math.round(ss2Reach(actor) + SS2_PSYCHE_UP.rangeBonus);
        if (!ss2PsycheDischargeInRange(actor, target)) {
          const transition = phaseTransitionEffects(actor, {
            staminaCost: Math.round(actor.stats.strength * PSYCHE_UP_DISCHARGE.strengthFactor),
            // Still a `psyche_up` decision even though it decided nothing, so
            // `nextphase` does not reset: a gladiator gated out by range keeps
            // his charge and can spend it once he has closed.
            resetsPsyche: false
          });
          return {
            effects: [...transition.effects, ...crowd],
            events: [{
              type: Ss2ActionType.PSYCHE_UP,
              actorId: actor.id,
              targetId: target.id,
              clip: SS2_PSYCHE_UP.clips[SS2_PSYCHE_UP.clips.length - 1],
              counter: psycheCounter,
              counterAfter: psycheCounter,
              discharged: false,
              // The field that makes this distinguishable from a miss. A miss
              // is a resolved roll the defender blocked; this is no roll at all.
              outOfRange: true,
              separation,
              gate,
              vanillaLabel: VANILLA_PHASE_LABEL[Ss2ActionType.PSYCHE_UP],
              staminaGained: transition.staminaGained,
              healed: transition.healed
            }]
          };
        }
      }

      // BOTH RECORDS ARE BUILT BEFORE THE FIRST DRAW, and the order is
      // load-bearing rather than tidy.
      //
      // `vanillaRecordOf(actor, "attacker")` is where the role-based damage-pair
      // requirement throws. Drawing first would make that refusal EXPENSIVE:
      // `randomBetween` advances the channel's generator state and cursor,
      // `applyAction` has no rollback around resolution, and the cursor is
      // inside `toTeamWireState` — so a refused action would leave the battle
      // hashed differently from a peer that never attempted it, and each retry
      // would burn another draw. Measured on 2026-09-07 before the fix: three
      // rejections took the journal from 3 draws to 6 and moved the hash every
      // time.
      //
      // This is the same hazard the `fixtureReplay` gate exists for one level
      // up — the first-blood refusal below IS still post-draw, and is gated at
      // construction for exactly that reason. A guard that can fire on an
      // ordinary play path had to be cheaper than that, so it runs first.
      //
      // Found by an independent Codex adversarial review of `89bc6c0` and
      // confirmed by direct measurement before it was believed.
      //
      // Neither call draws, so the RNG SEQUENCE is unchanged by moving them:
      // the direction is still the first sample of the action, matching the
      // build, where every band assigns the direction before its own
      // `checkattackroll()` call (`+0x608a` before `+0x6146`, `+0x61f1` before
      // `+0x62ad`, `+0x635c` before `+0x6418`).
      const hero = vanillaRecordOf(actor, "attacker");
      const villain = vanillaRecordOf(target, "defender");

      // ► **A CONSTANT DIRECTION TAKES NO SAMPLE.** See `ATTACK_BANDS`: the
      //   three melee bands each draw, and `bash_attack`, `bombard` and `snipe`
      //   each assign a literal with no RNG call anywhere in the branch. A
      //   `randomBetween(21, 21)` would give the same number and the wrong
      //   tape, which desyncs a peer rather than moving a value.
      const attackDirection = Number.isFinite(band.direction)
        ? band.direction
        : rolls.randomBetween(ATTACK_DIRECTION_ROLL_LABEL, band.low, band.high);
      const attackerBefore = { ...hero };
      const defenderBefore = { ...villain };
      const scenario = {
        attackerSide: "hero",
        attackDirection,
        fightMode,
        hero,
        villain,
        result: null,
        // ► **WHAT `bash_attack` INHERITS.** Direction 23 assigns no
        //   `criticalhit` of its own and the candidate REFUSES to guess one —
        //   it throws unless `scenario.transient.criticalhit` is finite. This
        //   is the channel: the actor's own last resolved swing wrote it, and
        //   a gladiator that has not swung yet carries the default 0. Only
        //   direction 23 reads it; the other six arms overwrite it.
        transient: { criticalhit: resourceValue(actor, "criticalhit", 0) }
      };
      const outcome = resolveSs2PhysicalAttackCandidate(scenario, rolls);

      if (outcome.resultEvent && outcome.resultEvent.reason === "first-blood") {
        // Refused rather than dropped. `battleStanding` decides on `alive`
        // alone, so a first-blood result would end the bout in the arithmetic
        // and not in the battle — the two would disagree in silence.
        throw new TeamRuleSetError(
          `Rule set ${ruleSetId} produced a first-blood result, which the team resolver cannot represent: ` +
          "it decides elimination on health > 0 and knows nothing of hitpoints < hitpointsmax. Use " +
          "fightMode \"tournament\" for play."
        );
      }

      // THE KILLING BLOW COSTS THE ATTACKER NOTHING, and this is not a
      // simplification — it is what the build does.
      //
      // `nextphase()` is not called on the tick the attack resolves: every
      // melee branch gates it behind `attacker.struck == true` (`+0x62c3`
      // -> `+0x62e2` for normal, mirrored for quick and power), which is
      // false while the animation is still running. It fires on a LATER tick
      // of the same `onEnterFrame`. But `damagecharacter` calls `death()`
      // synchronously inside `checkattackroll`, and `death()` deletes
      // `attacker.onEnterFrame` (`+0x2035`), `defender.onEnterFrame`
      // (`+0x2042`) and the `nextphase` variable itself (`+0x2049`) — so
      // after a kill that later tick never comes.
      //
      // Found by an adversarial verifier and then re-read from the bytes.
      // Before this, the golden replay test asserted NINETEEN TIMES that the
      // attacker's stamina must DIFFER from the only measured number the
      // fixture carries for it. It now asserts they are equal.
      const eliminated = scenario.villain.hitpoints <= 0;
      // ► **THIS USED TO BE `round(strength * band.strengthFactor)`, THE
      //   BUILD'S OWN FORMULA, AND IT IS THE ONE PLACE THIS ENGINE KNOWINGLY
      //   LEAVES IT — owner's decision 2026-09-10.** The band factor is still
      //   the build's (3 / 2 / 1 at `+0x603c`, `+0x61a3`, `+0x6317`), so the
      //   three bands keep their relative prices; what changed is what it
      //   multiplies. See `SS2_SWING` for the measured defect this answers,
      //   for which half is the build's and which is ours, and for the one
      //   inference in it that is genuinely weak — the DIRECTION of the
      //   `weaponweights` index, which a tool that already exists can settle.
      //
      //   **AND `fixtureReplay` KEEPS THE BUILD'S FORMULA, which is not a
      //   convenience — it is the whole reason the corpus stays evidence.** A
      //   promoted golden carries a `staminaleft` MEASURED in the running
      //   game, and `a non-lethal action DOES transition` in
      //   `ss2-golden-resolver-replay.test.js` checks the replay against it.
      //   Repricing that path would make this engine disagree with an observed
      //   number, which is not a balance change but a corpus break. So the
      //   divergence is gated exactly where `startingPosition` and the crowd
      //   toll are: a fixture reproduces the build, play gets the repriced
      //   economy, and the seam is one flag rather than three conventions.
      const staminaCost = fixtureReplay
        ? Math.round(actor.stats.strength * band.strengthFactor)
        : ss2SwingCost({
          bandFactor: band.strengthFactor,
          attackSpeed: resourceValue(actor, "attack_speed", SS2_RESOURCE_DEFAULTS.attack_speed),
          strength: actor.stats.strength
        });
      const transition = eliminated
        ? { effects: [], staminaGained: 0, healed: 0 }
        // The discharging `psyche_up` press is exempt for the same reason the
        // two charging presses are: it IS a `psyche_up` decision, so
        // `nextphase`'s reset does not fire. Its own write-back is pushed
        // below, once, rather than left to the ordering of two writes to one
        // resource inside a single action.
        : phaseTransitionEffects(actor, {
          // A band that prices itself wins, and exactly one does. See
          // `TAUNT_STRIKE`: a taunt recovers like a rest, so the strength
          // formula above is not merely the wrong number but the wrong shape.
          ...(band.transitionFor ? band.transitionFor(actor) : { staminaCost }),
          resetsPsyche: request.type !== Ss2ActionType.PSYCHE_UP
        });
      // ► **THE BACK ATTACK, AND IT IS A SEPARATE EFFECT ON PURPOSE.** The
      //   swing above has already resolved through the build's own
      //   `attack_chances` and damage bands, untouched — this reads the damage
      //   it did and adds an authored fraction as its own DAMAGE effect, which
      //   names itself in the log and can be deleted to restore the measured
      //   engine bit-for-bit. An authored term reaching INSIDE that arithmetic
      //   would re-datum 23 runtime-verified fixtures.
      //
      //   It needs a landed blow: a miss emits `amount: 0` (see
      //   `defenderEffects`, which always emits one), and half of nothing is
      //   nothing, so a missed back attack is correctly worth no bonus.
      const struck = Math.max(0, defenderBefore.hitpoints - scenario.villain.hitpoints);
      const backAttack = backAttackBonus > 0
        && struck > 0
        && ss2IsBackAttack(actor, target);
      const backAttackDamage = backAttack ? Math.round(struck * backAttackBonus) : 0;

      // ► **THE ATTACKER'S OWN TWO WRITES, AND THEY GO FIRST BECAUSE THE BUILD
      //   MAKES THEM FIRST.**
      //
      //   `ammo_left -= 1` happens in the ranged PHASE branch
      //   (`+0x6bf5`-`+0x6c14`), before the animation plays and long before the
      //   roll — the build resolves a shot when the arrow lands, not when it is
      //   loosed. `criticalhit` is assigned at the top of each
      //   `checkattackroll` arm (`+0x2e7e` bombard, `+0x2eeb` snipe), ahead of
      //   the damage term and therefore ahead of the hit test — **so a MISS
      //   still writes it**, which is the whole reason a bash can inherit one.
      //
      //   Both precede the defender's effects, matching that order. Resource
      //   effects are absolute, so only the order between distinct fields is
      //   observable, and this is it.
      const actorWrites = [];
      const declaredOnActor = declaredResourceNames(actor);
      // ► **THE DECREMENT IS UNGUARDED IN THE BUILD AND FLOORED HERE, and the
      //   difference is a defect vanilla actually has.** `+0x6bf5` subtracts 1
      //   with no test at all; the map records the consequence at
      //   §"The ammunition-visibility defect" — the zero-ammo branch assigns
      //   `visible` instead of `_visible`, so the buttons are never hidden and
      //   a harness driving `getphase` directly can drive the counter NEGATIVE.
      //   It is unreachable in ordinary play because the forced auto-swap fires
      //   first, and `legalActions` reproduces that gate. The floor is here so
      //   that a caller submitting the action directly gets 0 rather than a
      //   negative pool the resolver would have to represent.
      if (band.ranged && declaredOnActor.has("ammo_left")) {
        actorWrites.push({
          kind: EffectKind.RESOURCE,
          targetId: actor.id,
          resource: "ammo_left",
          to: Math.max(0, resourceValue(actor, "ammo_left", 0) - 1)
        });
      }
      // The PRE-DEFLECTION sample, which is what the build's variable holds:
      // `deflect_critical` runs later and writes `criticalhit` nowhere.
      if (declaredOnActor.has("criticalhit") && Number.isFinite(outcome.calculation?.criticalSample)) {
        actorWrites.push({
          kind: EffectKind.RESOURCE,
          targetId: actor.id,
          resource: "criticalhit",
          to: outcome.calculation.criticalSample
        });
      }

      const effects = [
        ...actorWrites,
        ...defenderEffects(defenderBefore, scenario.villain, target),
        ...(backAttackDamage > 0
          ? [{ kind: EffectKind.DAMAGE, targetId: target.id, amount: backAttackDamage }]
          : []),
        ...statusEffects(attackerBefore, scenario.hero, defenderBefore, scenario.villain, actor, target),
        ...transition.effects
      ];

      const { calculation, mutation } = outcome;
      const events = [{
        type: request.type,
        actorId: actor.id,
        targetId: target.id,
        attackDirection,
        hit: calculation.hit,
        chance: calculation.chance,
        rollNeeded: calculation.rollNeeded,
        // Reported so a UI can say "from behind" and a sweep can count them,
        // and so the authored half of the damage is never mistaken for the
        // measured half.
        backAttack,
        backAttackDamage,
        diceroll: calculation.diceroll,
        dispatchedMethod: calculation.dispatchedMethod ?? null,
        howDied: outcome.resultEvent?.howDied ?? null,
        damage: mutation.hitpointDamage,
        // Two different quantities, and reporting one as the other was a
        // measurable defect: `mutation.armourDamage` is the arithmetic's own
        // register, taken AFTER any armour removal, so a destroyed piece's
        // rating is not in it (a verifier measured 49 lost, 9 reported).
        armourAbsorbed: mutation.armourDamage,
        armourLost: defenderBefore.armourclass - scenario.villain.armourclass,
        armourDestroyed: mutation.armourRemovals
          .filter((removal) => removal.removed)
          .map((removal) => removal.selected),
        staminaBonus: mutation.staminaBonus,
        statusApplied: mutation.statusApplied,
        knockback: mutation.knockback === null ? null : { ...mutation.knockback },
        staminaSpent: eliminated ? 0 : staminaCost,
        staminaGained: transition.staminaGained,
        healed: transition.healed
      }];

      if (observer) {
        // Deep-cloned. The observer is diagnostic — not projected, not hashed —
        // but `outcome.mutation.knockback` and `outcome.mutation.statusApplied`
        // reach `battle.events` by reference, and `addEvent` only shallow-
        // spreads, so a mutating observer could change hashed state with no
        // hash-visible cause. Cloning costs one action's worth of JSON and
        // removes the hazard outright.
        observer(clone({
          actorId: actor.id,
          targetId: target.id,
          type: request.type,
          attackDirection,
          fightMode,
          scenario,
          outcome
        }));
      }
      // ► **THE DISCHARGE WRITES THE COUNTER BACK, AND WHERE IT LANDS IS A
      //   STATIC CANDIDATE THE MAP COULD NOT SETTLE.**
      //
      //   `+0x6738` writes `game_attacker.psyche_up = 1` after the range-gated
      //   grievous, and `+0x6761` adds one when the animation reports back
      //   (`attacker.struck == true`). The two are in different ticks of the
      //   same phase, so statically the counter lands on **2, not 1**.
      //
      //   ► **THE MAP'S OWN GLOSS ON THAT IS WRONG BY ONE PRESS AND IS NOT
      //     FOLLOWED HERE.** It says landing on 2 "would let the next
      //     `psyche_up` press discharge again". It would not: at 2 the selector
      //     at `+0x65b9` picks `psyche_up2`. The two readings differ as a
      //     CADENCE — three presses to the first discharge and **two per
      //     discharge after it** (lands on 2), against three every time (lands
      //     on 1). `ss2-capture-staging.md` words it correctly as "shortening
      //     the *next* chain".
      //
      //   **The map's reading is what ships**, because a candidate derives from
      //   the map. Settling it needs a capture of two consecutive discharges
      //   with `-TraceWindow phase` — the ordinary window closes on
      //   `checkattackroll`'s return and BOTH writes happen after it.
      //   ► **AND A LETHAL DISCHARGE LEAVES 1, NOT 2, BECAUSE THE CALLBACK
      //     NEVER RUNS.** The `+0x6738` write-back is SYNCHRONOUS, inside
      //     `checkattackroll`; the `+0x6761` increment is gated on
      //     `attacker.struck == true` and fires on a LATER tick. But
      //     `damagecharacter` calls `death()` synchronously in the same call,
      //     and `death()` deletes `attacker.onEnterFrame` (`+0x2035`),
      //     `defender.onEnterFrame` (`+0x2042`) and the `nextphase` variable
      //     itself (`+0x2049`) — **so after a kill that later tick never
      //     comes.** This is the same rule the stamina transition a few lines
      //     up already applies with `eliminated`, and nineteen goldens measure
      //     it there.
      //
      //     Without this, a gladiator who kills with a discharge kept an extra
      //     charge and, with another enemy still standing, could discharge
      //     again two presses sooner than the build allows. Raised by an
      //     adversarial review and confirmed against the bytes this file
      //     already cites.
      if (request.type === Ss2ActionType.PSYCHE_UP && declaredResourceNames(actor).has("psyche_up")) {
        const landed = SS2_PSYCHE_UP.floor + (eliminated ? 0 : 1);
        effects.push({
          kind: EffectKind.RESOURCE,
          targetId: actor.id,
          resource: "psyche_up",
          to: landed
        });
        for (const event of events) {
          if (event.type !== request.type) continue;
          event.clip = SS2_PSYCHE_UP.clips[SS2_PSYCHE_UP.clips.length - 1];
          event.counter = psycheCounter;
          event.counterAfter = landed;
          event.discharged = true;
        }
      }
      // The strike arm's event is the dispatcher's, so the taunt's own two
      // draws are merged back onto it here — the same shape the psyche
      // discharge uses directly above.
      if (tauntRecovered !== null) {
        // ► **THE RECOVERY SURVIVES A LETHAL STRIKE**, because the build has
        //   already applied it by the time the blow is rolled. The band path
        //   above drops its own transition when `eliminated`; this one is not
        //   its to drop.
        effects.unshift(...tauntRecovered.effects);
        // And the EVENT has to say so too. The band path reports `healed: 0`
        // on an elimination because its own transition never ran — which is
        // right for its half and wrong for this one, so the branch's own
        // recovery is added rather than replacing it.
        for (const event of events) {
          if (event.type !== request.type) continue;
          event.healed = (Number.isFinite(event.healed) ? event.healed : 0) + tauntRecovered.healed;
        }
      }
      if (tauntRoll !== null) {
        for (const event of events) {
          if (event.type !== request.type) continue;
          event.roll = tauntRoll.roll;
          event.chance = tauntRoll.chance;
          event.effect = tauntRoll.effect;
          event.landed = true;
        }
      }
      return { effects: [...effects, ...crowd], events };
    },

    /**
     * Deterministic AI. ONE of its decisions is the build's; the rest is not.
     *
     * MAP-DERIVED, and it is the only part that is: `villainChooseAction`
     * `+0x03e8` gates the entire action-choice block on `staminaleft > 10`,
     * unconditionally. Below that, this AI rests.
     *
     * INVENTED: everything else — which foe, and which of quick / normal /
     * power. The map decodes only three of the hundred `choices` bands and
     * none of them selects a melee verb, so there is nothing to be faithful
     * to. The policy is expected damage — `chance / 100` from the build's own
     * `attack_chances`, times the band's own damage term — against the weakest
     * living foe, ties broken toward the heavier attack. It reads measured
     * numbers; the way it uses them is this module's invention.
     *
     * A `staminaleft / staminamax * 100 < 40` rest gate stood here and has
     * been REMOVED as unsupported. The map places that test on ONE `choices`
     * band arm, not on every decision — and a verifier reading the bytes found
     * the map's own row conflates it with a sibling arm that pushes 30 and
     * selects `wincrowd`, not `taunt`. Generalising a band-conditional gate to
     * every decision, under a comment calling it byte-decoded, is an invented
     * number wearing a citation.
     */
    chooseAiAction(view, actorId, options) {
      // A forced phase is not a choice, and pretending to weigh it is a bug
      // rather than a waste: ranking the melee verbs builds the actor's
      // ATTACKER record, which demands the damage pair — so an AI gladiator
      // that carries a condition and declares no `min_damage` would throw here
      // instead of taking the one option it was handed. Returned before any
      // record is built.
      const forced = options.find((option) => SS2_FLAG_FOR_STATUS_PHASE[option.type]);
      if (forced) return forced;

      // ► **A FORCED SWAP IS NOT A CHOICE EITHER, and it is returned beside the
      //   forced phase for the same reason.** An archer out of arrows is handed
      //   exactly one option by `legalActions`; weighing it would build the
      //   attacker record and demand a damage pair the gladiator may not have
      //   declared, throwing instead of taking the only move it has.
      if (options.length === 1 && options[0].type === Ss2ActionType.SWAP_WEAPONS) return options[0];

      const restOption = options.find((option) => option.type === Ss2ActionType.REST);
      const actor = view.actor;
      if (restOption && resourceValue(actor, "staminaleft", 0) <= 10) return restOption;

      const foes = [...view.foes].sort(byHealthThenId);
      const target = foes[0];
      if (!target) return restOption ?? options[0];

      // OUT OF POSITION: close the distance. The build's own villain has
      // "out-of-position movement chains — the arm taken while the opponent is
      // still closing the distance" (battle map, § "Direction 20 is the taunt
      // path"), so an AI that moves is the right SHAPE; the arm's `choices`
      // bands are not decoded, so WHICH movement verb it picks is invented,
      // like the rest of this policy.
      //
      // **Recognised by the VOCABULARY rather than by re-deriving the
      // geometry.** `legalActions` offered a toward-walk if and only if
      // nothing was in reach, so taking one whenever no melee verb is on offer
      // needs no second opinion about who is standing where — and, more to the
      // point, it cannot DISAGREE with the gate that built the list. A second
      // distance computation here would be a second chance to be wrong.
      //
      // Returned before the attacker record is built, for the same reason the
      // forced phase above is: ranking the melee verbs demands the damage
      // pair, and a gladiator still walking toward the fight should not have
      // to declare one to take a step.
      // ► **RENAMED FROM `meleeOnOffer` WHEN THE BOW ARRIVED, and the rename is
      //   the fix rather than a tidy-up.** `ATTACK_BANDS` now holds six verbs,
      //   so this predicate means "can I attack anybody from here" — which is
      //   exactly what the walk arm below needs, and which the archer would
      //   have broken had the predicate stayed melee-only.
      //
      //   The trap, predicted in the ranged brief before any of this was
      //   written: an archer has a verb on offer while NO melee verb is, so an
      //   arm keyed on melee would have walked it out of its own firing range
      //   and into the fight it is built to avoid. **Closed by the vocabulary,
      //   not by a second geometry check** — which is the same mechanism the
      //   comment below relies on and the reason it holds.
      const attackOnOffer = options.some((option) => ATTACK_BANDS[option.type]);
      if (!attackOnOffer) {
        const nearest = nearestFoe(view);

        // ► **DRAW THE BOW RATHER THAN WALK. The one voluntary swap this AI
        //   makes, and it is deliberately the only one.**
        //
        //   Reaching here means nothing is in reach, so the alternative is a
        //   step; a gladiator that owns a loaded bow and has a foe already
        //   beyond the archer's minimum range is better off arming it than
        //   closing. Ranked above both the rank arm and the walk for that
        //   reason: those exist to close a distance this gladiator does not
        //   need to close.
        //
        //   **It never fires while anything is in reach**, because the whole
        //   block is behind `!attackOnOffer` — so an archer is never caught
        //   mid-swap by somebody it could have hit.
        //
        //   ► **AND THERE IS NO SWAP BACK, which is the build's own answer and
        //     not an omission.** `closerange_archer` wires no swap button; the
        //     only route is the inventory overlay. An archer that gets closed
        //     on therefore bashes and backs away rather than drawing a sword,
        //     which is what gives closing on an archer its value. It is also
        //     what keeps this arm from oscillating: with a swap in only one
        //     direction, a gladiator cannot flip modes as the distance moves.
        //     Running out of arrows still swaps it back — that one is forced,
        //     in `legalActions`.
        if (!ss2InBowMode(actor) && resourceValue(actor, "ammo_left", 0) > 0) {
          const swap = options.find((option) => option.type === Ss2ActionType.SWAP_WEAPONS);
          const range = nearest ? ss2FightDistance(actor, nearest) : null;
          if (swap && range !== null && range >= ss2ArcherMinimumRange(actor)) return swap;
        }
        // ► **CHANGE RANK BEFORE WALKING, when the fight is in another rank.**
        //
        //   Ranked BEFORE the walk for a measured reason: with the second axis
        //   on, a gladiator whose opponents are all in other ranks can walk
        //   the length of the arena without ever closing the distance, because
        //   the distance it needs to close is perpendicular to the way it can
        //   walk. Before this arm existed the rank verbs were legal and never
        //   taken, and the bout ran to the guard.
        //
        //   **Recognised by the VOCABULARY, like the toward-walk below it.**
        //   Reaching here means nothing is in reach; if the nearest foe is in
        //   a different rank then closing the rank is what "approach" means,
        //   and a second distance computation here would be a second chance to
        //   be wrong. The comparison is the RANK and not the y-distance, so it
        //   cannot disagree with `ss2RankDestination` about which way is which.
        //
        //   ► **IT CHANGES RANK ONLY WHEN ITS OWN RANK IS EMPTY OF FOES, AND
        //     THE FIRST VERSION DID NOT. Measured, and the difference is the
        //     whole feature.** The first version moved toward the NEAREST
        //     foe's rank, which is the obvious rule and is a pile-up machine:
        //     at the opening every foe is out of reach, so every gladiator
        //     immediately walks its rank toward whichever enemy happened to be
        //     nearest, all six converge on one rank, and the single interface
        //     is rebuilt in two dimensions. The tell was unmistakable —
        //     `rankStride` 97 and 150 produced IDENTICAL censuses (1,839
        //     actions, 32.8% mutual reach, 0% crossings, 1 fight), because
        //     once everybody shares a rank the stride cannot matter.
        //
        //     That is the failure the handoff of 2026-09-12 predicted in
        //     words — *"the fighters will pile up in two dimensions exactly as
        //     they do in one"* — and it arrived exactly as described.
        //
        //     So: **fight who is in front of you.** A foe in your own rank is
        //     your fight, and the rank verbs exist for the case where there is
        //     nobody left to fight rather than as a way to shop for a better
        //     opponent. The comparison is RANK equality, not distance, so it
        //     cannot disagree with `ss2RankDestination` about which way is
        //     which.
        const positionedInDepth = Number.isFinite(view.actor.y);
        const ownRankHasFoe = positionedInDepth
          && view.foes.some((foe) => foe.y === view.actor.y);

        // ► **GO ROUND A FOE AN ALLY IS ALREADY FIGHTING — the owner's own
        //   observation, and it was measurably never happening.** Measured over
        //   24 bouts before this arm existed: **208 turns where one side was
        //   outnumbered two-to-one, and in 100% of them both attackers stood on
        //   the SAME SIDE of their target.** Not once did anybody take the far
        //   side, so a numbers advantage bought a queue rather than a pincer.
        //
        //   **It was never a geometry problem.** `ss2BodyBlocks` gates the walk
        //   clamp on `|dy| < physical_size`, so at the shipped stride of 97 a
        //   foe one rank away does NOT block: the far side is already legal to
        //   walk to. What was missing is any reason to want it.
        //
        //   ► **AND THIS IS NOT THE RULE THAT CAUSED THE PILE-UP.** That one
        //     was "move toward the nearest foe's rank", which fires at the
        //     OPENING when nothing is engaged and collapses all six into one
        //     rank — the tell being that strides 97 and 150 then return
        //     identical censuses. This arm requires an ally to be ALREADY in
        //     reach of the target, which is false for every gladiator on turn
        //     one, so the opening is untouched. It delays a rank change rather
        //     than adding one.
        //
        //   The move: while I am in a DIFFERENT rank from the target, keep
        //   walking until I am past it, and only then let the rank arm below
        //   bring me in — arriving behind.
        const flank = positionedInDepth && nearest && Number.isFinite(nearest.y)
          ? ss2FlankingWalk(view, nearest, options)
          : null;
        if (flank) return flank;

        if (positionedInDepth && !ownRankHasFoe && nearest && Number.isFinite(nearest.y)) {
          const towardRank = nearest.y > view.actor.y ? Ss2ActionType.RANK_FRONT : Ss2ActionType.RANK_BACK;
          const step = options.find((option) => option.type === towardRank);
          if (step) return step;
        }
        if (nearest) {
          const towardType = nearest.x > actor.x ? Ss2ActionType.WALK_RIGHT : Ss2ActionType.WALK_LEFT;
          const stride = options.find((option) => option.type === towardType);
          // Stamina still outranks it: the forced-rest gate above already
          // returned at <= 10, so reaching here means the walk is affordable
          // in the only sense the build has — it does not refuse to spend.
          if (stride) return stride;
        }
      }

      // ► **WHICH FOE IT ACTUALLY SWINGS AT, and this was a live defect until
      //   2026-09-12.** `target` above is the globally weakest foe by health.
      //   The ranking below then looks for an option whose `targetId` is THAT
      //   foe — and if the weakest one is out of reach no option matches, `best`
      //   stays null, and the fallback rests. **A gladiator stood still at full
      //   stamina with three attacks on offer against a foe standing in front
      //   of it.**
      //
      //   Measured on the demo roster through the arena's own host path, 24
      //   seeds: 1v1 0 of 529 actions, 2v2 0 of 998, **3v3 78 of 1,688 (4.6%)**.
      //   It needs three foes before it can bite, which is why two team sizes
      //   of green sweeps never saw it. Found by a design agent that was asked
      //   about geometry and reported it as a premise break instead, which is
      //   the rule working.
      //
      //   The fix keeps "weakest first" and applies it to the foes it can
      //   actually hit, rather than to all of them. `ATTACK_BANDS` is the same
      //   predicate `meleeOnOffer` above uses, so the two cannot disagree about
      //   what counts as a melee verb.
      const reachable = new Set(
        options.filter((option) => ATTACK_BANDS[option.type]).map((option) => option.targetId)
      );
      const engaged = foes.find((foe) => reachable.has(foe.id)) ?? target;

      const attacker = vanillaRecordOf(actor, "attacker");
      const defender = vanillaRecordOf(engaged, "defender");
      const chances = calculateSs2AttackChances(attacker, defender);
      // Each verb's chance times its own damage term, straight off the
      // dispatcher table (map §"Chance calculation" and the direction table):
      // 21 rolls `randomBetween(min, max)` so its expected damage is the mean,
      // 22 is flat `min_damage`, 23 is `ceil(min_damage / 2)`.
      //
      // **`attacker.min_damage` here is already the ACTIVE pair** — a drawn bow
      // put the secondary numbers on the record in `vanillaRecordOf`, so this
      // weighs a shot with the bow's damage and never the sword's.
      const expected = {
        [Ss2ActionType.QUICK_ATTACK]: (chances.quick / 100) * attacker.min_damage,
        [Ss2ActionType.NORMAL_ATTACK]:
          (chances.normal / 100) * ((attacker.min_damage + attacker.max_damage) / 2),
        [Ss2ActionType.POWER_ATTACK]: (chances.power / 100) * attacker.max_damage,
        [Ss2ActionType.BOMBARD]:
          (chances.bombard / 100) * ((attacker.min_damage + attacker.max_damage) / 2),
        [Ss2ActionType.SNIPE]: (chances.snipe / 100) * attacker.min_damage,
        [Ss2ActionType.BASH_ATTACK]: (chances.bash / 100) * Math.ceil(attacker.min_damage / 2)
      };

      // ► **THE AI CHARGES NOW, AND IT DOES IT IN TWO DIFFERENT SITUATIONS FOR
      //   TWO DIFFERENT REASONS.** Owner's decision, 2026-09-16, taken against
      //   a measurement rather than an argument: over 20 AI-vs-AI bouts and
      //   6,000 actions the verb was chosen **0 times**, so `psyche_up`, its
      //   two clips of art, the charged stance and the glow all had a live
      //   population of zero outside human play — the same failure this file
      //   recorded about the twelve figure-pack effect groups.
      //
      //   **It is NOT an `ATTACK_BANDS` entry and must never become one.**
      //   Membership means "always attacks"; two of three presses draw nothing,
      //   and a band entry would put samples on the ordered channel the build
      //   never takes and desynchronise every peer replaying the same tape.
      //   This arm reaches the same ranking by a different door.
      // ► **THE OPTION MUST NAME `engaged`, AND TAKING THE FIRST ONE WAS A REAL
      //   DEFECT — found by an adversarial Codex review of `1775a4c` and
      //   reproduced here before anything was touched.** `psyche_up` looks
      //   self-targeted, and a first version reasoned from that: "the target
      //   does not matter". **It matters twice.** The resolver reads
      //   `request.target` for the discharge's RANGE GATE and builds the
      //   defender record for its DAMAGE ROLL from it. `legalActions` emits one
      //   option per foe, so `find` by type alone takes whichever foe happens
      //   to be first.
      //
      //   Reproduced: one hero at x 0 with a full charge, `far` at 500 and
      //   `near` at 90 — two consecutive turns chose `psyche_up` against `far`
      //   while `near` stood in melee reach. In a longer bout that STARVES the
      //   gladiator: an out-of-range press decides nothing and keeps the
      //   charge, so it can repeat forever.
      //
      // ► **AND THERE IS NO RANGE CHECK HERE, AFTER I ADDED ONE, DELETED IT,
      //   RESTORED IT ON THE REVIEW'S RECOMMENDATION, AND THEN MEASURED.**
      //   The review's advice was to rank a discharge only when the target
      //   passes `ss2PsycheDischargeInRange`. **Measured over 60 decisions
      //   where both an attack and a psyche were on offer, archers included: 0
      //   attackable foes were outside the discharge gate.** It cannot be
      //   otherwise — the gate is `round(ss2Reach + 50)` and `ss2Reach` is the
      //   same reach the attack verbs are offered on, including the BOW's when
      //   one is drawn, so anything an attack can hit a discharge can reach.
      //
      //   So with the target matched to `engaged`, the gate is unreachable by
      //   construction. **Recognised by the VOCABULARY rather than by
      //   re-deriving the geometry** — the argument the walk arms above make
      //   twice, and the reason a second distance test here is a second chance
      //   to be wrong rather than a safety net. The gate that matters is the
      //   resolver's, and it runs on every press regardless.
      const psycheOption = aiCharges
        // Self-targeted when nothing is in reach, one per foe once something
        // is; both shapes are accepted and only `engaged` is taken.
        ? options.find((option) => option.type === Ss2ActionType.PSYCHE_UP
          && (option.targetId === engaged.id || option.targetId === actor.id))
        : undefined;
      if (psycheOption) {
        const counter = Math.max(SS2_PSYCHE_UP.floor, resourceValue(actor, "psyche_up", SS2_PSYCHE_UP.floor));
        // The discharge's own numbers, from the dispatcher rather than from
        // here: `direction === 30` is `chances.normal` against
        // `ceil(max_damage * 1.5)`, with a `character_level * 10` floor.
        let grievous = Math.ceil(attacker.max_damage * 1.5);
        if (grievous <= 1) grievous = attacker.character_level * 10;

        if (counter >= SS2_PSYCHE_UP.dischargeAt) {
          // ► **A READY CHARGE IS THE BEST SWING ON THE TABLE, and that is
          //   arithmetic rather than a preference.** The discharge rolls at
          //   `chances.normal` for `1.5 * max_damage`, so it beats
          //   `normal_attack` by exactly half again at the same chance, and it
          //   strictly dominates `power_attack`, which rolls `max_damage` at
          //   the WORSE `chances.power`. It joins the table and wins on merit.
          //
          //   **And not firing it forfeits it**: `phaseTransitionEffects`
          //   resets the counter on every decision that is not `psyche_up`, so
          //   a charged gladiator who swings instead loses three turns' work.
          //   Measured here, not assumed — counter 3 -> 1 after any attack,
          //   rest or walk.
          expected[Ss2ActionType.PSYCHE_UP] = (chances.normal / 100) * grievous;
        } else {
          // ► **BUILDING A CHARGE IS PRICED PER PRESS, WHICH IS THE HONEST
          //   COMPARISON AND THE ONE THAT USUALLY SAYS NO.** A charge from
          //   `counter` costs `dischargeAt - counter + 1` turns and buys one
          //   grievous, so its value per turn is the discharge's expected
          //   damage divided by the presses it takes. Against the same table
          //   the ordinary verbs are ranked in, that loses for a light weapon
          //   and wins for a heavy one — which is the measured shape (five
          //   stat-lines, the charge won one) and a good one for a game: the
          //   gladiator with the huge slow blade is the one who winds up.
          //
          //   **The presses are counted from where the counter IS**, so a
          //   gladiator who has already begun is likelier to continue than to
          //   have begun — which is correct, because every other action
          //   forfeits the charge outright (measured: counter 3 -> 1 after any
          //   attack, rest or walk).
          const presses = SS2_PSYCHE_UP.dischargeAt - counter + 1;
          // ► **AND IT MUST BE AFFORDABLE AND SURVIVABLE, or the turns are
          //   thrown away.** Every landed blow resets the DEFENDER's counter
          //   (`damagecharacter`), so charging under a foe who can reach you is
          //   usually wasted. The incoming proxy is deliberately crude and
          //   cannot throw: the foe's own declared `max_damage`, 0 for a
          //   combatant that declares none, in which case the test passes.
          const incoming = resourceValue(engaged, "max_damage", 0) * presses;
          const survivesTheWindUp = actor.health > incoming;
          const affordable = resourceValue(actor, "staminaleft", 0)
            > Math.round(actor.stats.strength * PSYCHE_UP_DISCHARGE.strengthFactor) * presses;
          if (survivesTheWindUp && affordable) {
            expected[Ss2ActionType.PSYCHE_UP] = (chances.normal / 100) * grievous / presses;
          }
          // ► **AND THE TRAIT OVERRIDES THE ARITHMETIC, WHICH IS THE WHOLE
          //   POINT OF THE FLAG AND HAS TO BE SAID PLAINLY.** Measured on the
          //   demo roster: a charge is worth 4.33 damage a turn against 7.92
          //   for the best ordinary swing, so the comparison above declines
          //   every time and an AI ruled by it would never charge — which is
          //   the state this flag exists to leave. **The owner's decision was
          //   to teach the AI to charge; the arithmetic says charging is worse;
          //   both are true.** So `aiCharges` buys a CHARACTER, not an
          //   optimisation: an opponent who winds up is more interesting to
          //   fight and slightly worse at fighting.
          //
          //   **AN UNWOUNDED GLADIATOR WINDS UP; A WOUNDED ONE FIGHTS.** Full
          //   health is the gate rather than an invented fraction, and it is
          //   the right shape rather than a convenient one: taking a blow
          //   RESETS the charge (`damagecharacter`), so the moment a gladiator
          //   is wounded is exactly the moment a wind-up stops being likely to
          //   pay. It also means a charge follows a rest, which is when a
          //   gladiator has the turns to spare.
          if (survivesTheWindUp && affordable && actor.health >= actor.maxHealth) {
            expected[Ss2ActionType.PSYCHE_UP] = Number.MAX_SAFE_INTEGER - 1;
          }
          // ► **AND A FINISHER OVERRIDES THE AVERAGE.** `1.5 * max_damage` can
          //   end a gladiator no ordinary swing can reach, and a kill is worth
          //   more than the damage that delivers it — which is the one thing a
          //   damage-per-turn table cannot express.
          const bestOrdinaryMax = Math.max(attacker.max_damage, attacker.min_damage);
          if (survivesTheWindUp && affordable
            && grievous >= engaged.health && bestOrdinaryMax < engaged.health) {
            expected[Ss2ActionType.PSYCHE_UP] = Number.MAX_SAFE_INTEGER;
          }
        }
      }
      // Ties break toward the heavier attack, deterministically. The archer's
      // verbs join the list rather than forming a second one, because a
      // gladiator is never offered both sets — the controller frame it is on
      // wires one or the other, never a mix (`legalActions`). `bombard` is
      // ahead of `snipe` for the same reason `power` is ahead of `quick`: it is
      // the heavier of the two.
      const preference = [
        // FIRST, so a tie goes to the charge. There is one tie that matters and
        // it is not hypothetical: a discharge whose expected value happens to
        // equal `power_attack`'s should be taken, because it also LEAVES a
        // partial charge behind (the counter lands on 2, one press from the
        // next discharge) while the swing resets it to the floor.
        Ss2ActionType.PSYCHE_UP,
        Ss2ActionType.POWER_ATTACK,
        Ss2ActionType.NORMAL_ATTACK,
        Ss2ActionType.QUICK_ATTACK,
        Ss2ActionType.BOMBARD,
        Ss2ActionType.SNIPE,
        Ss2ActionType.BASH_ATTACK
      ];
      let best = null;
      for (const type of preference) {
        // ► **`psyche_up` IS SELF-TARGETED AND THE OTHERS ARE NOT**, so the
        //   `targetId === engaged.id` filter would drop it every time. It is
        //   matched on type alone, and only when the arm above priced it —
        //   `expected` has no entry otherwise, and an unpriced verb must not be
        //   reachable by a `undefined > undefined` comparison.
        const option = type === Ss2ActionType.PSYCHE_UP
          // `psycheOption` is already matched to `engaged` above, and is
          // undefined when the discharge could not reach it.
          ? (expected[type] === undefined ? null : psycheOption ?? null)
          : options.find((entry) => entry.type === type && entry.targetId === engaged.id);
        if (!option) continue;
        if (best === null || expected[type] > expected[best.type]) best = option;
      }
      return best ?? restOption ?? options[0];
    }
  });
}

/** The default SS2 rule set: tournament mode, the only defeat gate this seam represents. */
export const ss2TeamRules = createSs2TeamRules();
