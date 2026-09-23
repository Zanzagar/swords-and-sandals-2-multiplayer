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
 * 2. **The AI policy is invented, apart from ~~one gate~~ the spell ladder and
 *    one gate.** ~~Only `villainChooseAction`'s unconditional `staminaleft > 10`
 *    is byte-decoded.~~ **Corrected 2026-09-22: that gate is NOT unconditional**
 *    — it sits inside the villain's in-range test (`+0x03d5`), and the
 *    `villain_cast_spells()` ladder runs after it and can replace its rest
 *    (see `chooseAiAction`). The ladder arms this engine holds are byte-derived
 *    too, and have been since they were built.
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

import {
  calculateSs2AttackChances, removeSs2ArmourCandidate, resolveSs2PhysicalAttackCandidate
} from "../golden/ss2-attack-candidate.js";
import { applySs2MagicDamageCandidate } from "../golden/ss2-spell-candidate.js";
import { SS2_BUILD_SHA256 } from "../golden/run-1v1-fixture.js";
import { byCodeUnit } from "../common/stable-order.js";
import { fnv1a } from "../common/fnv1a.js";
import { resourceValue } from "./resources.js";
import {
  SS2_PSYCHE_DISCHARGE_CROWD,
  ss2CrowdActionOf,
  ss2CrowdOpening,
  ss2CrowdStepEffects,
  ss2StrikeCrowdAction,
  ss2WincrowdCrowdAction
} from "./ss2-crowd.js";
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
  //   plays `psyche_up`, `psyche_up2` or `psyche_up3` for values 1, 2 and
  //   ~~>= 3~~ exactly 3 (`Equals2` each time — see `SS2_PSYCHE_UP.clips`)
  //   (`+0x658a`, `+0x65b9`, `+0x65ef`); only the third arm reaches
  //   `checkattackroll`. Presses one and two cost stamina, advance the counter
  //   and roll NOTHING — so a band entry, which means "always attacks", would
  //   put two samples on the ordered channel that the build never takes, and
  //   every peer replaying the same tape would fall out of step from the first
  //   charge onward. It resolves through its own branch; see `PSYCHE_UP_MODEL`.
  PSYCHE_UP: "psyche-up",
  // ► **THE TWO SPELLS THAT ARE ATTACKS — AND THEY SIT HERE, BESIDE THE
  //   DISCHARGE, BECAUSE THEY RESOLVE THROUGH THE SAME DISPATCHER IT DOES.**
  //   Derived 2026-09-22 from `DoAction@0x240c7f` `+0x78da`-`+0x7aa9` and
  //   `+0x7db7`-`+0x7fd9`; see `SS2_WHIRLWIND` and `SS2_GHOST_STRIKE`.
  //
  //   `cast_whirlwind` is the psyche discharge with an item for a charge: the
  //   same facing-relative range gate, instruction for instruction, and the
  //   same `attack_direction = 30; checkattackroll()`. `cast_ghost_strike` is
  //   `power_attack`'s `randomBetween(9, 12)` and `checkattackroll()` with NO
  //   range test. **Neither is in `ATTACK_BANDS`**: a band means "priced by
  //   strength, offered on reach, always attacks", and these are priced in
  //   magicka, offered on possession, and — for the whirlwind — attack only in
  //   range. They reach the dispatcher through `SS2_ITEM_STRIKES`.
  CAST_WHIRLWIND: "cast-whirlwind",
  CAST_GHOST_STRIKE: "cast-ghost-strike",
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
  SHOVE: "shove",
  // ► **`wincrowd` — THE CONTROLLER VERB THAT PLAYS TO THE CROWD, and the
  //   crowd is its whole effect.** `+0x4fc9`-`+0x513d` of `DoAction@0x240c7f`;
  //   see `SS2_WINCROWD`. Wired on all four controller frames behind a
  //   `herolevel >= 3` button gate, self-targeted, ZERO samples on the combat
  //   channel: its one `RandomNumber(6)` picks which of six clips plays, and
  //   that is presentation. Not in `ATTACK_BANDS`, for the reason `shove` is
  //   not. The token IS the build's label — it has no underscore to lose.
  WINCROWD: "wincrowd",
  // ► **THE TWO BOLTS — THE FIRST SPELL VERBS IN THIS ENGINE, AND THE ONLY TWO
  //   OF THE BUILD'S TWENTY THAT A DISCRETE TURN CAN EXPRESS.** Derived
  //   2026-09-20 from `sprite:862[overlay]/frame:52/DoAction@0x240c7f`
  //   `+0x83fb`-`+0x862e`; see `SS2_BOLT_SPELLS` for the phase statement by
  //   statement.
  //
  //   **TWO TYPES RATHER THAN ONE, for the reason the four status phases are
  //   four types**: the build's decision IS the label, and
  //   `getphase("cast_lightning_bolt")` is a different decision from
  //   `getphase("cast_frightning_bolt")`. They share one arm and one
  //   `magic_damage_character` call site, but they select different inventory
  //   ids (34 and 35), different damage ranges and different bolt frames, and
  //   `VANILLA_PHASE_LABEL` cannot hold both under one token.
  //
  //   **NOT IN `ATTACK_BANDS`, and for a sharper reason than `psyche_up`'s.**
  //   A band entry means "draw a direction, then call `checkattackroll`". The
  //   bolt arm contains **no `checkattackroll`, no direction draw and no hit
  //   roll at all** — its single `randomBetween` is the DAMAGE, handed straight
  //   to `magic_damage_character`, which the map states has no direction chain.
  //   A bolt cannot miss. Routing it through the dispatcher would take samples
  //   the build never takes and put every peer replaying the same tape out of
  //   step from the first cast.
  CAST_LIGHTNING_BOLT: "cast-lightning-bolt",
  CAST_FRIGHTNING_BOLT: "cast-frightning-bolt",
  // ► **THE FIREBALL FAMILY — THREE TYPES FOR ONE ARM, for the bolts' reason.**
  //   `+0x8f59`-`+0x94ff` of the same block; see `SS2_FIREBALL_SPELLS`. One
  //   sample, no hit roll, so NOT in `ATTACK_BANDS` for the bolts' reason too.
  //   What differs is TIMING — the damage lands when a flat `bullet` passes
  //   the victim's x, frames after the cast — and a discrete turn resolves it
  //   at once and leaves the flight to the presentation.
  CAST_FIREBALL: "cast-fireball",
  CAST_HELL_FIREBALL: "cast-hell-fireball",
  CAST_DIRE_FIREBALL: "cast-dire-fireball",
  // ► **MOLTEN DEATH — THE FIRST SPELL VERB THAT HITS MORE THAN ONCE.**
  //   `+0x862f`-`+0x895c` of the same block; see `SS2_DEATH_FROM_ABOVE`.
  //   `1 + 4N` samples for N = 10..20 boulders, and not one is an attack roll:
  //   the count, then four placement draws per boulder, then N identical
  //   ingress calls with a literal 40. So it is not in `ATTACK_BANDS`, for the
  //   bolts' reason. Every boulder lands (its closure has no x test), so a
  //   discrete turn resolves the whole shower at once and leaves the fall to
  //   the presentation, as it does the fireball's flight.
  CAST_DEATH_FROM_ABOVE: "cast-death-from-above",
  // ► **THE GALE — THE THIRD SPELL VERB AND THE FIRST THAT DEALS NO DAMAGE.**
  //   `+0x7aaa`-`+0x7be5` of the same block; see `SS2_GALE`. A pure
  //   displacement like `shove`, taking ZERO samples, so it is not in
  //   `ATTACK_BANDS` for the reason `shove` is not.
  CAST_GALE: "cast-gale",
  // ► **THE COMMAND — THE GALE'S OPPOSITE: IT PULLS.** `+0x7be6`-`+0x7db6` of
  //   the same block; see `SS2_COMMAND`. ZERO samples and zero damage, so it
  //   is not in `ATTACK_BANDS`, for the reason `shove` and `cast_gale` are not.
  CAST_COMMAND: "cast-command",
  // ► **THE TELEPORT — THE FOURTH SPELL VERB AND THE FIRST THAT MOVES ITS
  //   CASTER.** `+0x7541`-`+0x76ad` of the same block; see `SS2_TELEPORT`. ONE
  //   sample, and it is the DESTINATION, not an attack roll — so it is not in
  //   `ATTACK_BANDS`, for the bolts' reason. SELF-TARGETED like `rest`: the arm
  //   never reads `defender` or `game_defender`.
  CAST_TELEPORT: "cast-teleport",
  // ► **WEAKEN ARMOUR — THE FIRST SPELL VERB THAT DESTROYS EQUIPMENT.**
  //   `+0x777c`-`+0x78d9` of the same block; see `SS2_WEAKEN_ARMOUR`. SIX
  //   samples plus the debris, and not one of them is an attack roll: the arm
  //   draws `attack_direction` three times and hands each straight to
  //   `remove_armour`, with no `checkattackroll` anywhere. So it is not in
  //   `ATTACK_BANDS`, for the bolts' reason.
  CAST_WEAKEN_ARMOUR: "cast-weaken-armour",
  // ► **THE POTIONS — ONE TOKEN FOR EIGHT ITEMS, AND THAT IS THE BUILD'S
  //   SHAPE, NOT A SHORTCUT.** Unlike the two bolts, which are two
  //   `getphase` labels, the build has ONE label, `drink_potion`, for
  //   inventory ids 2-9: `villain_cast_spells` writes the same
  //   `villaindecisionA = "drink_potion"` at eight arms, and the phase
  //   (`+0x576d`-`+0x5dad`) selects the potion from
  //   `game_attacker.inventory_action`. So the action carries the id as
  //   `itemId`, which the resolver compares and passes through for exactly
  //   this reason; see `SS2_POTIONS`. Zero samples, so not in
  //   `ATTACK_BANDS`, for the reason `shove` and `cast_gale` are not.
  DRINK_POTION: "drink-potion",
  // ► **THE TWO TIMED SELF-BUFFS — AND THE FIRST SPELLS WHOSE EFFECT IS NOT IN
  //   THEIR OWN ARM.** `+0x8bab`-`+0x8c89` (`cast_regenerate`, id 46) and
  //   `+0x8c8a`-`+0x8d68` (`cast_boundless_energy`, id 45) of the same block;
  //   see `SS2_TIMED_BUFFS`. Each arm only writes `attacker.spell_X = 20`; the
  //   gain is applied by `nextphase` on every later phase the bearer acts in,
  //   which is why `phaseTransitionEffects` is where they are really built.
  //   ZERO samples, so not in `ATTACK_BANDS`, for the reason `shove` is not.
  //   Two types for two `getphase` labels, the bolts' reason.
  CAST_REGENERATE: "cast-regenerate",
  CAST_BOUNDLESS_ENERGY: "cast-boundless-energy",
  // ► **THE FOUR STAT SPELLS — THE FIRST VERBS THAT CHANGE A STAT.**
  //   `+0x7fda`-`+0x81f7` (`cast_colossus`, id 42), `+0x81f8`-`+0x83f4`
  //   (`cast_little_fat_kid`, id 33, which lands on the DEFENDER),
  //   `+0x895d`-`+0x8a5f` (`cast_swiftsandals`, id 40) and `+0x8a60`-`+0x8baa`
  //   (`cast_bloodlust`, id 41) of the same block; see `SS2_STAT_SPELLS`. Each
  //   writes stats from the fight-start `backup_*` once and a counter every
  //   tick, and `check_spells` restores the stats when the counter runs out.
  //   ZERO samples, so not in `ATTACK_BANDS`, for the reason `shove` is not.
  //   Four types for four `getphase` labels, the bolts' reason.
  CAST_COLOSSUS: "cast-colossus",
  CAST_LITTLE_FAT_KID: "cast-little-fat-kid",
  CAST_SWIFTSANDALS: "cast-swiftsandals",
  CAST_BLOODLUST: "cast-bloodlust",
  // ► **REJUVENATE — THE FULL REFILL, AND THE ONLY VERB THAT GIVES ARMOUR
  //   BACK.** `+0x8d69`-`+0x8f58` of the same block; see `SS2_REJUVENATE`.
  //   ZERO samples, so not in `ATTACK_BANDS`, for the reason `shove` is not.
  //   The build's spelling, `rejuvinate`, for the reason `frightning` is kept.
  CAST_REJUVINATE: "cast-rejuvinate",
  // ► **ADULATION — THE ONE VERB WHOSE WHOLE EFFECT IS ON THE CROWD.**
  //   `+0x76ae`-`+0x777b` of the same block; see `SS2_ADULATION`. ZERO samples,
  //   no `defender`: it writes `crowd_action = 50` and nothing else, so it
  //   waited on the crowd being modelled (owner's decision (f), 2026-09-22).
  CAST_ADULATION: "cast-adulation",
  /**
   * The phase a TAUNTED gladiator is forced into: it runs away.
   *
   * A type of its own rather than a flag the caller interprets, for the reason
   * the four condition phases are four types — the build's decision IS the
   * label, and `getphase("runleft")` is a different decision from
   * `getphase("runright")`. Which of the two it becomes is the FACING, and
   * `VANILLA_PHASE_LABEL` cannot hold both, so the resolved event carries the
   * one this actor took.
   */
  TAUNTED_PHASE: "taunted-phase",
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
 * (`2249/frame:88` `+0x078c`), ~~`crowd_action` is a per-damage presentation
 * cue~~ **`crowd_action` is a per-PHASE delta that `nextphase` adds into it
 * (`+0x3541`-`+0x35b4`) — corrected 2026-09-22, and now MODELLED in
 * `src/team/ss2-crowd.js`**, and the `taunttimer` watchdog (`+0x67e4`, 60
 * ticks) abandons a stuck ANIMATION, not a stalled bout. **Vanilla records no
 * bout-level pressure mechanic.** This is a designed answer to a measured
 * defect, wearing the build's vocabulary because the build has a crowd and it
 * is the natural face for it.
 *
 * ► **THIS IS NOT THE BUILD'S CROWD, AND THE TWO NOW LIVE SIDE BY SIDE.** The
 *   build's crowd is `crowd_interest` — one battle-wide pool, opened at the
 *   sum of the fighters' levels, moved by every completed phase, read only by
 *   the victory purse; it harms nobody and ends nothing. This is a toll: it
 *   DAMAGES every actor past `patience` turns so that a bout ends. It reads no
 *   `crowd_interest`, writes none, and no number in it is the build's. The
 *   shared word is the only thing they share.
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
 * `turnNumber`, `actor`, `allies`, `foes` ~~and nothing else~~ **and, since
 * 2026-09-22, the battle's own declared pools, `battleResources`**), so "reset
 * the crowd when somebody bleeds" would have cost new hashed state. That is a
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
  // `phase_decision == "cast_whirlwind"` at `+0x78e0` and `== "cast_ghost_strike"`
  // at `+0x7dbd`, the decisions ladder arms 20 and 21 write (`+0x0cfa`,
  // `+0x0d7a`). The whirlwind's caster plays `psyche_up3` (`+0x7950`) — the
  // discharge's clip, carried on the event; the ghost strike's plays the
  // `Attack9`-`Attack12` its direction names (`+0x7ee8`-`+0x7f63`), which the
  // presentation derives from the direction exactly as for `power_attack`.
  [Ss2ActionType.CAST_WHIRLWIND]: "cast_whirlwind",
  [Ss2ActionType.CAST_GHOST_STRIKE]: "cast_ghost_strike",
  // ► **THE PHASE LABEL IS `taunt` AND THE TARGET'S CLIP IS `taunted`**, which
  //   are two different names for one decision — the build plays both from the
  //   same branch and BEFORE the roll (`+0x6905` the actor, `+0x690c` the
  //   target), so a FAILED taunt still animates. The target's label is the
  //   presentation layer's, not a phase.
  [Ss2ActionType.TAUNT]: "taunt",
  [Ss2ActionType.SHOVE]: "shove",
  // `phase_decision == "wincrowd"` at `+0x4fcf`, the label all eight
  // controller-frame branches pass to `getphase` (`+0x0dca`/`+0x12a0` on frame
  // 5, `+0x0b69`/`+0x0fb7` on 13, `+0x0dd5`/`+0x12ec` on 20, `+0x0cf2`/`+0x10fd`
  // on 28) and the villain's `choices > 95` bands write (`+0x0bd3`, `+0x0ec2`).
  // The CLIP is a different string again, `"wincrowd" + wincrowd_move`
  // (`+0x50de`), carried on the event; see `SS2_WINCROWD`.
  [Ss2ActionType.WINCROWD]: "wincrowd",
  // ► **THE PHASE LABELS ARE THE DECISION'S AND THE CASTER'S CLIP IS `Cast2`**,
  //   which is a third name again — `attacker.gotoAndPlay("Cast2")` at
  //   `+0x8515`, shared by both bolts, and NOT derivable from either label.
  //   The VICTIM's clip is a fourth: `magic_damage_character`'s `damage_method`
  //   argument, which for both bolts is `"lightning"` (`+0x858f`), reaching
  //   `defenderClip.gotoAndPlay(damage_method)` at the ingress's step 1. So one
  //   decision names four clips' worth of nothing, and the resolved event
  //   carries the caster clip and the victim clip separately for the same
  //   reason `psyche_up` carries its clip separately.
  [Ss2ActionType.CAST_LIGHTNING_BOLT]: "cast_lightning_bolt",
  // The build's own spelling, missing the `f` of "frightening" — `frightning`,
  // in the phase label, in the decision the AI writes (`+0x0b6f`) and in the
  // item row. It is kept verbatim here for the reason `rejuvinate` is kept
  // everywhere else in this repository: a corrected spelling is a name that
  // matches nothing in the build.
  [Ss2ActionType.CAST_FRIGHTNING_BOLT]: "cast_frightning_bolt",
  // The three constants the fireball gate compares (`+0x8f5f`, `+0x8f73`,
  // `+0x8f87`) and the three decisions ladder arms 18, 16 and 14 write
  // (`+0x0c20`, `+0x0baa`, `+0x0b34`). The CASTER's clip is `Cast1`
  // (`+0x90f4`), the gale's and not the bolts' `Cast2`, and the victim's is
  // the ingress's `damage_method`, `"burning"` (`+0x91a2`).
  [Ss2ActionType.CAST_FIREBALL]: "cast_fireball",
  [Ss2ActionType.CAST_HELL_FIREBALL]: "cast_hell_fireball",
  [Ss2ActionType.CAST_DIRE_FIREBALL]: "cast_dire_fireball",
  // `phase_decision == "cast_death_from_above"` at `+0x8635`, and the decision
  // ladder arm 7 writes at `+0x0871`. The CASTER's clip is `Cast2` (`+0x86d8`),
  // the bolts' and not the fireballs' `Cast1`; the victim's is the ingress's
  // `damage_method`, `"burning"` (`+0x88c1`), restarted by every boulder.
  [Ss2ActionType.CAST_DEATH_FROM_ABOVE]: "cast_death_from_above",
  // `phase_decision == "cast_gale"` at `+0x7ab0`, and the decision the villain
  // ladder writes at arm 24 (`+0x0ea3`). The CASTER's clip is `Cast1`
  // (`+0x7b30`), not `Cast2`, and the victim's is `knockback` (`+0x7b78`) —
  // carried on the event for the reason the bolts carry theirs.
  [Ss2ActionType.CAST_GALE]: "cast_gale",
  // `phase_decision == "cast_command"` at `+0x7bec`, and the decision ladder
  // arm 25 writes at `+0x0efd`. The CASTER's clip is `Cast2` (`+0x7c81`), the
  // bolts' and not the gale's, and the victim's is `knockback_mov` (`+0x7c5e`)
  // — the one site in the build that dispatches that label directly.
  [Ss2ActionType.CAST_COMMAND]: "cast_command",
  // `phase_decision == "cast_teleport"` at `+0x7547`, and the decision ladder
  // arm 26 writes at `+0x0f91`. The caster's clip is `Cast2` (`+0x7620`), the
  // bolts' — carried on the event; there is no victim clip at all.
  [Ss2ActionType.CAST_TELEPORT]: "cast_teleport",
  // `phase_decision == "cast_weaken_armour"` at `+0x7782`, and the decision
  // ladder arm 19 writes at `+0x0c7a`. The caster's clip is `Cast1`
  // (`+0x7800`), the gale's; there is no victim clip at all.
  [Ss2ActionType.CAST_WEAKEN_ARMOUR]: "cast_weaken_armour",
  // `phase_decision == "drink_potion"` at `+0x5773`, the decision all eight
  // potion arms of the villain ladder write (`+0x0662`, `+0x074c`, `+0x07c1`,
  // `+0x0836`, `+0x099a`, `+0x0a0f`, `+0x0a84`, `+0x0af9`), and — unusually —
  // ALSO the drinker's clip: `attacker.gotoAndPlay("drink_potion")` at
  // `+0x57c6`. One name for the phase and the animation, which no spell has.
  [Ss2ActionType.DRINK_POTION]: "drink_potion",
  // `phase_decision == "cast_regenerate"` at `+0x8bb1` and
  // `== "cast_boundless_energy"` at `+0x8c90`, the decisions ladder arms 3 and
  // 23 write (`+0x06d7`, `+0x0e0f`). Both casters play `Cast2` (`+0x8c40`,
  // `+0x8d1f`) — carried on the event; there is no victim clip at all.
  [Ss2ActionType.CAST_REGENERATE]: "cast_regenerate",
  [Ss2ActionType.CAST_BOUNDLESS_ENERGY]: "cast_boundless_energy",
  // `phase_decision == "cast_colossus"` at `+0x7fe0`, `"cast_little_fat_kid"`
  // at `+0x81fe`, `"cast_swiftsandals"` at `+0x8963` and `"cast_bloodlust"` at
  // `+0x8a66`: the decisions ladder arms 8, 9, 27 and 22 write (`+0x08cb`,
  // `+0x0925`, `+0x0feb`, `+0x0dd4`). The clips are on each event.
  [Ss2ActionType.CAST_COLOSSUS]: "cast_colossus",
  [Ss2ActionType.CAST_LITTLE_FAT_KID]: "cast_little_fat_kid",
  [Ss2ActionType.CAST_SWIFTSANDALS]: "cast_swiftsandals",
  [Ss2ActionType.CAST_BLOODLUST]: "cast_bloodlust",
  // `phase_decision == "cast_rejuvinate"` at `+0x8d6f`, the decision ladder
  // arm 1 writes (`+0x05ed`). The caster plays `Rejuvinate` (`+0x8ded`, capital
  // R as the build passes it) — carried on the event; there is no victim clip.
  [Ss2ActionType.CAST_REJUVINATE]: "cast_rejuvinate",
  // `phase_decision == "cast_adulation"` at `+0x76b4`, the decision ladder arm
  // 28 writes (`+0x1045`). The caster plays `wincrowd1` (`+0x7732`) — the
  // first of the six crowd-pleasing clips `wincrowd` cycles through — carried
  // on the event; there is no victim clip.
  [Ss2ActionType.CAST_ADULATION]: "cast_adulation",
  // ► **THE LABEL IS THE FACING'S AND THIS ENTRY IS ONLY THE FALLBACK.** Row 3
  //   of the decision table is `taunted1 == true` -> facing right
  //   `getphase("runleft")`, facing left `getphase("runright")`
  //   (`+0x0d68`-`+0x0e35`) — a gladiator runs AWAY from the way it faces. The
  //   resolved event carries the one actually taken; this is what a consumer
  //   with no facing to read gets, and it is the right-facing case because that
  //   is the build's own default (`facing-left` is the token that must be
  //   present).
  [Ss2ActionType.TAUNTED_PHASE]: "runleft",
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
  life_stolen: Ss2ActionType.LIFE_STOLEN_PHASE,
  // ► **`taunted1` JOINED 2026-09-17 AND IT IS NOT A CONDITION.** The other
  //   four are damage-over-time flags whose phase hurts their bearer; this one
  //   makes him RUN, and it is row 3 of the build's own decision table rather
  //   than a status arm. It is here because the mechanism is identical — a flag
  //   the actor carries takes his turn away — and duplicating that machinery
  //   for one flag would be the second copy this file keeps warning about.
  //
  //   **`taunted2` is deliberately absent.** The build tests it in the
  //   decision table but **assigns it `true` NOWHERE**, so a phase for it would
  //   be a promise nothing can redeem; `SS2_TAUNT_FLAGS` keeps both because the
  //   CLEARING is real for both.
  taunted1: Ss2ActionType.TAUNTED_PHASE
});

/**
 * The inverse, and it is DELIBERATELY NARROWER than the forward map.
 *
 * ► **`taunted-phase` IS NOT IN IT, BECAUSE IT IS NOT A CONDITION TICK.** This
 *   map is what `resolveAction` dispatches to `resolveStatusPhase` — a handler
 *   that applies damage-over-time to its bearer. The flee is a MOVEMENT phase
 *   that happens to be forced by a flag, and routing it through the condition
 *   handler gave a gladiator who ran nowhere and kept the flag.
 *
 *   The forward map keeps it, because `forcedStatusFlag` and `legalActions`
 *   genuinely do treat it as "a flag that takes your turn away" — which is the
 *   half the two share. What they do NOT share is how it resolves.
 */
const SS2_FLAG_FOR_STATUS_PHASE = Object.freeze(
  Object.fromEntries(
    Object.entries(SS2_STATUS_PHASE_FOR_FLAG)
      .filter(([, type]) => type !== Ss2ActionType.TAUNTED_PHASE)
      .map(([flag, type]) => [type, flag])
  )
);

/**
 * Every phase a flag can force, INCLUDING the flee — which is what
 * `suggestAction` means by "a forced phase is not a choice".
 */
const SS2_FORCED_PHASES = Object.freeze(new Set(Object.values(SS2_STATUS_PHASE_FOR_FLAG)));

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
/**
 * Which forced phase the build's own chain hands this gladiator, or null.
 *
 * ► **THE ORDER IS THE TABLE'S AND `taunted1` OUTRANKS ALL FOUR CONDITIONS.**
 *   Frame 1 runs rows 1-7 as SEQUENTIAL STATEMENTS (map §"Turn gating, forced
 *   phases"): swap_weapons, rest, **the taunted flee at row 3**, then frozen,
 *   burning, poison, life_stolen. Rows 1 and 2 are handled ahead of this
 *   function by `legalActions`; this is rows 3-7, and a taunted-and-burning
 *   gladiator RUNS.
 */
function forcedStatusFlag(actor) {
  // The SAME list, in the SAME order, that `SS2_CHAIN_CLEAR_FLAGS` clears —
  // because in the build they are the same statements. Reading the rank off one
  // list and the consumption off another is how the rest branch and the swap
  // branch drifted apart in the first place.
  for (const flag of SS2_CHAIN_CLEAR_FLAGS) {
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
   * Map, `nextphase` step 1. **BYTE-VERIFIED 2026-09-17, and the caveat that
   * used to stand here is retracted.** It read: "the map states the bound in
   * PROSE with no byte offset anywhere in the repository, while the only line
   * carrying offsets for the clamp — the four `_x` `If`s at `+0x31cc`,
   * `+0x31f8`, `+0x3224`, `+0x3250` — states no literals at all. It is the
   * build's number as far as this repository knows and no further."
   *
   * The literals were always there; the decoder that produced those four
   * offsets printed opcodes without their operands, so the absence was the
   * TOOL's. Sprite 862 frame 52 carries all eight pushes, four per fighter:
   *
   * ```text
   *   +0x31c2 Push -2100   Less2     +0x31d7 game_attacker._x = -2100
   *   +0x31ee Push  2100   Greater   +0x3203 game_attacker._x =  2100
   *   +0x321a Push -2100   Less2     +0x322f game_defender._x = -2100
   *   +0x3246 Push  2100   Greater   +0x325b game_defender._x =  2100
   * ```
   *
   * ► **AND THE SENTENCE THAT USED TO END THIS BLOCK WAS WRONG — RETRACTED
   *   2026-09-17, THE SAME DAY IT WAS WRITTEN.** It read: *"It runs in
   *   `nextphase`, so it bounds EVERY gait — and it is the only thing that
   *   bounds the taunted flee, whose own arm clamps nothing."*
   *
   *   **`nextphase` clamps `game_attacker._x` and `game_defender._x`, and
   *   those are `_root.game.hero` / `_root.game.villain` — plain `new
   *   Object()`s.** The gladiators that move are the CLIPS, `attacker` and
   *   `defender` (`_root.arena.gladiators.*`), bound four lines apart from the
   *   data objects at `+0x2b64`/`+0x2b7b` against `+0x2b92`/`+0x2ba3`. Across
   *   the whole SWF those four comparisons are the ONLY reads of
   *   `game_*._x` and those four writes the only writes, against 50 reads of
   *   `attacker._x` and 32 of `defender._x`. **The block is dead code.**
   *
   * ► **THE NUMBER SURVIVES, IN A DIFFERENT FUNCTION.** A near-identical clamp
   *   sits in `attacker.onEnterFrame` (the anonymous function at `+0x36ae`),
   *   acting on the clips: `attacker._x` at `+0x38fd` / `+0x3988`,
   *   `defender._x` at `+0x3a13` / `+0x3a3f`. THAT is what bounds a walk, a
   *   run, a flee and a knockback, and hitting it also nulls `destination` and
   *   calls `nextphase()` — so touching the wall ENDS the phase. Every use of
   *   this constant in this engine is therefore still right; only the citation
   *   was.
   *
   * ► **WHAT THE WALL DOES, CORRECTED 2026-09-22 (derived from the bytes and
   *   checked by a write-nothing refuter, `derive:arena-wall`).** "Touching
   *   the wall ENDS the phase" is true of the ATTACKER side only: past ±2100
   *   (strict, `+0x38f1`/`+0x397c`) it sets `_x` and, unless airborne, calls
   *   `nextphase()` (`+0x396c`/`+0x39f7`) BEFORE the arm dispatch
   *   (`+0x3a84`) — so a fighter that STARTS its phase past the wall loses the
   *   phase — and it nulls no `struck` on either fighter. The DEFENDER side
   *   (`+0x3a07`-`+0x3a5e`) is a plain clamp. Both sit behind `knock_defender
   *   == null` (`+0x38ce`-`+0x38ec`), which never closes, because
   *   `knockback()` binds it with `DefineLocal` (`+0x1e75`). Three routes put a
   *   fighter past the wall at its phase start: a knockback tween (one second,
   *   wall-clock) still running when a hitter phase shorter than 30 frames
   *   ends — gale, whirlwind, the psyche discharge, most attacks; the sub-100
   *   nudge (`+0x36b9`), which pushes a fighter already AT the wall into it, so
   *   a cornered fighter with a foe inside 100 loses every phase; and a command
   *   that pulls its target through.
   *
   *   **OWNER'S DECISION 2026-09-22: NOT REPRODUCED.** This engine clamps to
   *   ±2100 and lets the fighter act. The knockback route depends on
   *   Ruffle's frame pacing, so the build is not even consistent with itself
   *   there; the nudge route is a stunlock. Named divergences, all three.
   *
   * ► **HOW THE ERROR WAS MADE, because it is a repeatable one.** The previous
   *   caveat here said the bound existed in the map's prose with no byte
   *   offset, and it was retracted for a good reason — the old decoder printed
   *   opcodes without operands, so the literals looked absent. Finding them
   *   proved THE LITERALS. It did not prove the EFFECT, and the receiver was
   *   never checked. A read-only wave of twelve agents checked it, 2026-09-17.
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
 * ► **HOW FAR THE LIVE STRENGTH HAS MOVED THE `battlevalues` OUTPUTS THE BAG
 *   CARRIES — 0 for every gladiator whose strength no stat spell has touched.**
 *
 * `min_damage`, `max_damage`, `weapon_range` and `secondary_weapon_range` are
 * declared ONCE, from the strength the gladiator was built with. The build
 * recomputes all four from the LIVE `strength` in every `nextphase`
 * (`battlevalues(game_attacker)`/`(game_defender)`, `+0x35eb`/`+0x35ff`, after
 * `check_spells`): `min/max_damage = round(strength * 2) + weapon[…]`
 * (`+0x3356`, `+0x3386`), `weapon_range = physical_size + weapon[5] * 44`
 * (`+0x3190`, `+0x32aa`), `physical_size = 80 + round(strength / 1.5)`
 * (`+0x30f1`). The weapon columns never change in battle, so the live value is
 * the stored one plus the strength term's movement — which is what these two
 * return. Reading them at USE time is the build's own timing: a stat spell
 * writes strength inside its phase, and the recompute lands in the same
 * phase's `nextphase`, before anything else can read it.
 *
 * `backup_strength` is the strength the bag's numbers were computed from; a
 * gladiator declaring none has had no stat written, so both shifts are 0 and
 * every golden reads exactly what it always did.
 */
function ss2MeleeStrengthShift(actor) {
  const live = actor?.stats?.strength ?? 0;
  return Math.round(live * 2) - Math.round(ss2BackupStat(actor, "strength") * 2);
}

/** The reach half of the shift above: the live `physical_size` less the built one. */
function ss2ReachStrengthShift(actor) {
  return ss2PhysicalSize(actor) - (80 + Math.round(ss2BackupStat(actor, "strength") / 1.5));
}

/**
 * The AI's crude proxy for ONE TURN of a gladiator: its declared melee
 * `max_damage`, carried to the live strength by `ss2MeleeStrengthShift` — and
 * 0 for a gladiator that declares none, which is the fallback both readers
 * were written around (it cannot throw, and an undeclared pair scores 0).
 *
 * ► **IT READ THE FIGHT-START NUMBER UNTIL THE STAT SPELLS, AND CODEX FOUND IT
 *   (2026-09-22), reproduced before it was fixed.** A foe whose colossus took
 *   strength 20 to 60 swings for 129 at most, and the wind-up's survival check
 *   still priced three of its turns at 3 x 49 = 147 against a 190-hitpoint
 *   gladiator — so it wound up under a foe whose three turns are 387. The
 *   taunt's flee arm read the same stale number. Both read this now.
 */
function ss2MaxDamageProxy(combatant) {
  const declared = resourceValue(combatant, "max_damage", null);
  return declared === null ? 0 : declared + ss2MeleeStrengthShift(combatant);
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
  //   Both declared reaches were computed from the strength the gladiator was
  //   built with; `ss2ReachStrengthShift` carries them to the live one (0
  //   unless a stat spell has moved it). The fallback below already reads the
  //   live `physical_size`.
  if (ss2InBowMode(actor)) {
    const bow = resourceValue(actor, "secondary_weapon_range", 0);
    if (Number.isFinite(bow) && bow > 0) return bow + ss2ReachStrengthShift(actor);
  }
  const declared = resourceValue(actor, "weapon_range", null);
  if (Number.isFinite(declared) && declared > 0) return declared + ss2ReachStrengthShift(actor);
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
    // The bag's pair is the fight-start `battlevalues`; the build's is the
    // live strength's. See `ss2MeleeStrengthShift` — 0 unless a stat spell
    // moved strength. The bow pair below already reads the live stat.
    const shift = ss2MeleeStrengthShift(actor);
    return {
      min_damage: resourceValue(actor, "min_damage", 0) + shift,
      max_damage: resourceValue(actor, "max_damage", 0) + shift
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
 * ~~`equipped_weapon == 2 && fightdistance < 200` (`+0x0356`-`+0x03d5`), a
 * hand-written 200 with no minimum at all~~
 * **`equipped_weapon == 2 && !(fightdistance < 200)`** (`+0x0397`-`+0x03d3`) —
 * **corrected 2026-09-22 from the bytes: the POLARITY was wrong here, and in
 * every handoff that quoted it.** `+0x03d2 Less2; +0x03d3 Not` precedes the
 * join at `+0x03d4`, so the villain's bow arm is in range at 200 OR MORE: the
 * same shape as this gate, a FLOOR with no maximum, with a hand-written 200 in
 * place of `100 + physical_size`. The same function's swap test confirms it
 * from the other side: `(equipped_weapon == 2 && fightdistance < 200) ||
 * (equipped_weapon == 1 && !(fightdistance < 200))` swaps (`+0x0f57`-`+0x0fdd`),
 * so a bow too close is put away. This engine applies the HERO's gate
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
  return step - easedRemainder(step, SS2_WALK_STOP_GAP);
}

/**
 * THE EASING TWEEN BOTH GAITS RUN, and the gap it gives up on at.
 *
 * `attacker.onEnterFrame` closes the distance to `attacker.destination` by
 * `ceil(gap / 8)` a frame and stops when the gap is small enough — the walk at
 * 20 (`+0x3e97`), the run at **10** (`+0x4038` runleft, `+0x41c1` runright).
 * The divisor is 8 in both (`+0x3e7b` walk, `+0x3fa1` run).
 *
 * ► **IT IS A do/while BECAUSE THE BUILD MOVES BEFORE IT CHECKS**, which
 *   `ss2WalkDisplacement`'s own comment records: a step at or under the stop gap
 *   still moves the gladiator once, where a `while` would return 0.
 *
 * @returns the gap REMAINING when the tween gives up, which is at most
 *   `stopGap` and is frequently less — see `ss2RunDisplacement` for why that
 *   "frequently" is not a rounding detail.
 */
function easedRemainder(step, stopGap) {
  let gap = step;
  do {
    gap -= Math.ceil(gap / SS2_WALK_EASING_DIVISOR);
  } while (gap > stopGap);
  return gap;
}

/** The run's own destination tolerance: `+0x4038` runleft, `+0x41c1` runright. */
const SS2_RUN_STOP_GAP = 10;

/**
 * WHAT A RUN ACTUALLY COVERS — the flee's displacement, and it is NOT the walk's
 * with a bigger number.
 *
 * ```text
 *   destination = _x -/+ movement_speed * 40     +0x3f69 runleft, +0x40f2 runright
 * ```
 *
 * ► **THREE THINGS DIFFER FROM THE WALK AND EACH ONE IS A WAY TO GET THIS
 *   WRONG.** The table below `ss2WalkDisplacement` names the first two and this
 *   function exists because of the third:
 *
 *   1. **No boot bonus.** The run's destination is a RAW product — there is no
 *      `get_percentage`/`add_percentage` round trip at `+0x3f69` or `+0x40f2`.
 *      Only the walk takes a boot bonus and only the jump a shinguard one.
 *   2. **The stop gap is 10, not 20.** Reading `SS2_WALK_STOP_GAP` as universal
 *      puts every run 10 out.
 *   3. **AND THE CLOSED FORM IS WRONG AT 23 OF THE 57 REACHABLE SPEEDS.** That
 *      table concludes "a run's realised step is therefore
 *      `40 * movement_speed - 10`". **Measured over `movement_speed` 4..60: it
 *      is +1 low at 23 of them** — 5, 10, 13, 15, 17, 20, 22, 25, 26, 29, 30,
 *      33, 34, 38, 39, 43, 44, 49, 50, 51, 56, 57, 58 — because the tween exits
 *      when the gap is at or under 10 and lands on **9** at those inputs, not
 *      on 10.
 *
 *      **This is the same mistake the walk's own docstring records**, one
 *      function along: collapsing the build's loop into algebra gives a
 *      different function that differs by one at reachable inputs. The loop is
 *      the build; the closed form is a description of it.
 */
export function ss2RunDisplacement(movementSpeed) {
  if (!Number.isFinite(movementSpeed) || movementSpeed < 0) {
    throw new TeamRuleSetError(
      `ss2RunDisplacement: movementSpeed must be a finite non-negative number, got ${movementSpeed}.`
    );
  }
  const step = movementSpeed * SS2_MOVEMENT_STEP_FACTOR.run;
  return step - easedRemainder(step, SS2_RUN_STOP_GAP);
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
 *   runright), and a charge has no destination tolerance at all. ~~A run's
 *   realised step is therefore `40 * movement_speed - 10`~~ — **WRONG AT 23 OF
 *   THE 57 REACHABLE SPEEDS, corrected 2026-09-17 when the flee needed the
 *   number.** The tween exits when the gap is AT OR UNDER 10 and lands on 9 at
 *   `movement_speed` 5, 10, 13, 15, 17, 20, 22, 25, 26, 29, 30, 33, 34, 38, 39,
 *   43, 44, 49, 50, 51, 56, 57 and 58, so the closed form is +1 low at every one
 *   of them. **`ss2RunDisplacement` runs the loop instead** — which is the same
 *   correction `ss2WalkDisplacement` records one function above, made by the
 *   same move: collapsing the build's loop into algebra gives a different
 *   function. The "reading `SS2_WALK_STOP_GAP` as universal puts it 10 out"
 *   warning was right and did not go far enough.
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
/**
 * ► **WHETHER TWO GLADIATORS STAND IN THE SAME LANE, and therefore whether one
 *   may SWING at the other.** Owner's rule, 2026-09-18, reported off a live 3v3
 *   in the browser arena: *"AI are able to attack each other in different lanes:
 *   this shouldn't be allowed. You can attack from front or behind but not at
 *   different y even if you are 'close'."*
 *
 * ► **AUTHORED, AND IT HAS TO BE — `MAP_SILENCE.multi-slot-arena-geometry`.**
 *   Vanilla has ONE rank, so no byte in the build has an opinion about reaching
 *   across two. What the build does settle is that `getfightdistance` is
 *   Euclidean over `(_x, _y)`, and this engine borrowed that for depth — which
 *   is correct for a DISTANCE and turned out to be wrong for a REACH. Measured
 *   before the rule landed: over 25 seeded 3v3 bouts, **4,440 of 7,845 melee
 *   attacks — 57% — were swung across ranks**, because a foe one rank back at
 *   the same x is 97 units away and every melee reach is longer than that.
 *
 * ► **IT IS A NO-OP WHENEVER THE SECOND AXIS IS OFF, structurally rather than
 *   by a flag.** `startingY` returns `null` unless `rankStride` is non-zero, so
 *   in a one-dimensional arena — every 1v1, every golden, every pinned hash —
 *   neither `y` is finite and this returns `true` for every pair. The rule can
 *   only bite in a battle that has ranks to be in.
 *
 * ► **AND IT IS DELIBERATELY NOT APPLIED TO THE TWO SHOTS.** A bow exists to
 *   reach somebody you cannot walk to, and the flat shot already has its own
 *   lane rule in `ss2ShotBlocked` — derived from the BUILD's ballistic, not
 *   authored — while a bombard is lobbed and clears everything. Extending this
 *   to ranged would be a second authored rule on top of a derived one.
 */
export function ss2SameLane(actor, target) {
  if (!Number.isFinite(actor?.y) || !Number.isFinite(target?.y)) return true;
  return actor.y === target.y;
}

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
  return [...facingEffectsAgainst(sideA, sideB), ...facingEffectsAgainst(sideB, sideA)];
}

/**
 * ONE side's facings, derived against one opposition — the half of
 * `ss2FacingEffects` that used to be an inner closure called twice.
 *
 * Split out 2026-09-17 because the OPENING derivation needs it: with more than
 * two teams the pairwise form would face a combatant against one opposing team
 * rather than against every foe it has, and the bug that forced this split was
 * exactly a facing derived against the wrong set. `ss2FacingEffects` is
 * unchanged — it is these two calls — so a mutation check on the pair still
 * covers every caller that had one before.
 */
function facingEffectsAgainst(crowd, opposition) {
  const positioned = (combatant) => combatant && combatant.alive !== false && Number.isFinite(combatant.x);
  const effects = [];
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

/**
 * Expected damage, in hitpoints, for each attacking verb `actor` could aim at
 * `target` — the table `chooseAiAction` ranks on, lifted out of it so that the
 * APPROACH arm can read the same numbers the swing arm does.
 *
 * ► **IT IS LIFTED OUT BECAUSE THE AI HAD TWO ANSWERS TO ONE QUESTION AND ONLY
 *   REACHED ONE OF THEM.** Until 2026-09-18 the table was a local inside
 *   `chooseAiAction`, built AFTER the `!attackOnOffer` branch had already
 *   returned a walk — so on every turn where nothing was in reach the AI had no
 *   valuation of anything at all, and the only idea it had was "step toward the
 *   enemy". Measured on the demo roster over 25 seeded 3v3 bouts: **`taunt` was
 *   legal on 914 of 2,064 decisions and on 664 of those (72.6%) NO attack was
 *   legal**, so the branch that returns a walk decided nearly three quarters of
 *   the taunt's own offers before any ranking existed. `taunt` was not ranked
 *   last; it was never ranked.
 *
 * ► **NOTHING HERE DRAWS A SAMPLE, which is what makes calling it twice free.**
 *   `chooseAiAction` is handed a view and an option list and no `rolls`;
 *   `calculateSs2AttackChances` is pure arithmetic over the two records. A
 *   second call cannot move the ordered channel, so the approach arm may price
 *   a swing it will not take without putting a peer out of step.
 *
 * The rows are the dispatcher's own damage terms, unchanged from where they
 * stood: 21 rolls `randomBetween(min, max)` so its expected damage is the mean,
 * 22 is flat `min_damage`, 23 is `ceil(min_damage / 2)`.
 *
 * **`attacker.min_damage` is already the ACTIVE pair** — a drawn bow put the
 * secondary numbers on the record in `vanillaRecordOf` — so this weighs a shot
 * with the bow's damage and never the sword's.
 */
function ss2SwingValues(actor, target) {
  const attacker = vanillaRecordOf(actor, "attacker");
  const defender = vanillaRecordOf(target, "defender");
  const chances = calculateSs2AttackChances(attacker, defender);
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
  return { attacker, defender, chances, expected };
}

/**
 * Whether `actor` may be priced as an attacker at all.
 *
 * ► **THE GUARD EXISTS BECAUSE `vanillaRecordOf(..., "attacker")` THROWS, AND
 *   THE WALK ARM IS REACHED BY GLADIATORS THAT HAVE NOT DECLARED A DAMAGE
 *   PAIR.** `chooseAiAction`'s forced-phase and forced-swap arms both say so in
 *   their own comments: a gladiator still walking toward the fight should not
 *   have to declare a damage pair to take a step. Pricing a taunt needs the
 *   attacker record, so the taunt arm is SKIPPED for such a gladiator rather
 *   than being allowed to throw — it falls through to the walk it would have
 *   taken before this existed.
 *
 * ► **IT TESTS THE SAME THING THE ASSERTION TESTS, AND THE FIRST VERSION DID
 *   NOT.** That one asked `declaredResourceNames(actor).has(name)` — key
 *   PRESENCE — while `assertDeclaredResources` asks
 *   `Number.isFinite(declaredResourceValue(...))`. A blueprint carrying
 *   `resources: { min_damage: null }` passes a presence test and throws at the
 *   record, so the guard has to ask the question the thrower asks. **A guard
 *   that is weaker than the check it stands in front of is not a guard**, and
 *   this one is one line from the function it guards.
 */
function ss2CanBePriced(actor) {
  return SS2_ATTACKER_REQUIRED_RESOURCES
    .every((name) => Number.isFinite(declaredResourceValue(actor, name)));
}

/**
 * What a taunt is worth to `actor` against `target`, IN HITPOINTS.
 *
 * ► **THIS IS THE DESIGN DECISION THE 2026-09-18 HANDOFF NAMED AND DID NOT
 *   TAKE, AND IT IS ONE SENTENCE: price every action as a HITPOINT SWING
 *   rather than as damage dealt.** A hitpoint the actor keeps is worth a
 *   hitpoint it takes off the other side, and a turn it takes AWAY from the
 *   other side is worth what that side would have done with it. The three
 *   terms below are exactly that sentence, and the attack rows in
 *   `ss2SwingValues` are unchanged by it because for a swing the other two
 *   terms are zero. **The band ranking is not touched, which is the point:** a
 *   560-combination sweep on 2026-09-18 established that the ranking picks all
 *   three melee verbs whenever the stats make one of them best, and nothing
 *   here may move that.
 *
 * The terms, and which of them is measured and which is invented:
 *
 * 1. **THE RECOVERY, CERTAIN, AND IT IS THE LARGEST TERM ON THE DEMO ROSTER.**
 *    A taunt heals `3 + ceil(stamina)` and gains `stamina` stamina BEFORE the
 *    roll (`+0x684c`, `+0x6894`, clamped at `+0x68d3`), so it is paid whether
 *    the taunt lands or not. Read from `SS2_TAUNT.branchHealBase` and capped at
 *    the missing health, which is `tauntRecovery`'s own formula — the same
 *    arithmetic, not a second copy of the number.
 * 2. **THE STRIKE ARM**, `taunt_effect == 1`, one outcome in two of a landed
 *    taunt: `directionProfile`'s direction-20 term,
 *    `round(charisma * 4) - defender.charisma`, floored at a 1-3 roll whose
 *    mean is 2. Raw damage, exactly as every row in `ss2SwingValues` is raw —
 *    the comparison is between terms of the same kind, not between mitigated
 *    outcomes.
 * 3. **THE DENIAL ARM**, `taunt_effect == 2`, the other outcome in two, and
 *    **this is the only invented number here.** A bow-mode target is made to
 *    FLEE and loses its next turn outright; a melee target is SHOVED
 *    `max(20, charisma * 25)` units and has to walk back. The proxy for "one
 *    turn of the target" is the target's own declared `max_damage` — crude,
 *    deliberately, and it is the SAME proxy `chooseAiAction`'s wind-up arm
 *    already uses for incoming damage, for the same reason: it cannot throw,
 *    and a combatant that declares none scores 0.
 *
 *    ► **AND THE SHOVE IS ONLY WORTH SOMETHING TO A TAUNTER THAT DOES NOT NEED
 *      TO CLOSE.** Pushing a melee opponent 150 units out of reach costs the
 *      pusher its own reach too, so both sides spend the same walk getting back
 *      — net zero. An archer loses nothing by it, because its reach is the
 *      bow's. So the shove scores the proxy in bow mode and **0** in melee,
 *      which is the conservative arm rather than the flattering one.
 *
 * ► **MEASURED, so the terms can be checked against a bout rather than argued
 *   about.** 3,069 taunts over 80 seeded 3v3 bouts on the demo roster: mean
 *   chance 40.0%, landed 39.2%, effect 1 on 599 and effect 2 on 604 of them —
 *   **50/50 as `randomBetween(1, 2)` says** — mean heal 2.43 hp, mean shove
 *   |force| 150, and **flees: 1**, because effect 2 only makes a target flee
 *   when the TARGET is in bow mode and the demo roster's archers rarely are
 *   when taunted. The denial term is therefore nearly all shove on this roster.
 */
export function ss2TauntValue(actor, target, chances) {
  if (!actor || !target) return 0;
  // (1) The recovery, certain. `tauntRecovery`'s own two lines.
  const healed = Math.min(
    SS2_TAUNT.branchHealBase + Math.ceil(actor.stats.stamina),
    Math.max(0, actor.maxHealth - actor.health)
  );

  const landing = (chances?.taunt ?? 0) / 100;
  // Each landed taunt splits evenly over `randomBetween(1, effectMax)`.
  const perEffect = landing / SS2_TAUNT.effectMax;

  // (2) The strike arm — `directionProfile`, `direction === 20`.
  //
  // ► **IT ROLLS `chances.taunt` A SECOND TIME AND THE FIRST VERSION OF THIS
  //   FUNCTION FORGOT IT.** `taunt_effect == 1` does not deal damage; it sets
  //   `direction = 20` and calls `checkattackroll()`, and `directionProfile`'s
  //   direction-20 arm hands that dispatcher `chance: chances.taunt` — the SAME
  //   chance the taunt already passed. So a strike is `landing` twice over, not
  //   once, and the omission overstated the arm by 2.5x at the demo roster's
  //   40%. **Caught by checking the model against a bout rather than against
  //   itself**: 3,069 taunts produced 599 effect-1 events (19.5%, which is
  //   `landing / 2` exactly) whose mean delivered damage was 3.76 against a raw
  //   term of 18 — a ratio no single 40% roll can explain.
  const charisma = resourceValue(actor, "charisma", 0);
  const targetCharisma = resourceValue(target, "charisma", 0);
  const raw = Math.round(charisma * 4) - targetCharisma;
  // Below 1 the build rolls `randomBetween(1, 3)`; its mean is 2.
  const strike = (raw < 1 ? SS2_TAUNT_FLOOR_DAMAGE_MEAN : raw) * landing;

  // (3) The denial arm, and **only the FLEE scores in it.**
  //
  // ► **A SHOVE DENIES A TURN OF WALKING; A FLEE DENIES A TURN OF FIGHTING,
  //   AND THE FIRST VERSION PRICED THEM THE SAME.** It scored the full
  //   turn-proxy whenever EITHER side was in bow mode, on the argument that an
  //   archer loses nothing by pushing a melee opponent away. The argument is
  //   true and the conclusion does not follow: a melee opponent 500 units from
  //   an archer was not going to hit it this turn either way, so the 150-unit
  //   shove costs that opponent one step of an approach, not one attack.
  //   Pricing a step at a whole swing is what made the archer taunt a foe it
  //   could shoot — caught by `test/ss2-ranged.test.js`'s snipe/bombard
  //   crossover pin, which is a test written about something else entirely and
  //   is the second time today a pin aimed elsewhere has broken a claim here.
  //
  //   The flee is different in kind and not in degree: `taunted1` forces row 3
  //   of the chain, so the target's NEXT TURN is spent running and is not
  //   available for anything. That is a whole turn and is scored as one.
  //
  // The proxy for "one turn of the target" is the target's own declared
  // `max_damage` — crude, deliberately, and the SAME proxy the wind-up arm in
  // `chooseAiAction` already uses for incoming damage, for the same reason: it
  // cannot throw, and a combatant that declares none scores 0.
  //
  // ► **AND THE FLEE ARM NEEDS THE TARGET IN BOW MODE, which is rare and is
  //   the measurement to keep**: 1 flee in 3,069 taunts over 80 seeded 3v3
  //   bouts on the demo roster, because effect 2 splits on the DEFENDER'S
  //   weapon mode (`+0x69a7`) and a demo archer is usually holding its sword
  //   when anybody is close enough to taunt it. So on the shipped roster this
  //   term is very nearly always zero, and the taunt is carried by the
  //   recovery.
  //
  // ► **LIVE SINCE 2026-09-22** — `ss2MaxDamageProxy`: the declared number
  //   carried to the target's live strength, so a buffed target's turn is
  //   priced at what it would actually swing for. Still 0 for a target that
  //   declares none.
  const denial = ss2InBowMode(target) ? ss2MaxDamageProxy(target) : 0;

  return healed + perEffect * strike + perEffect * denial;
}

/**
 * What CLOSING THE DISTANCE is worth, in hitpoints — the thing a taunt at range
 * is actually competing with.
 *
 * ► **IT IS THE SWING ITSELF, UNDISCOUNTED, AND THE FIRST VERSION DISCOUNTED IT
 *   BY THE WALKS IT TAKES TO ARRIVE. That version is recorded here because the
 *   way it failed is the useful part.** It returned `best / (walks + 1)` — a
 *   walk pays nothing on the turn it is taken, so amortise the swing over the
 *   walks that buy it. Measured on the demo roster, 25 seeded 3v3 bouts through
 *   the arena's own host: **the taunt went to 1,332 of 1,633 offers (81.6%) and
 *   bouts ran 84% longer** (2,064 decisions to 3,801). One monoculture replaced
 *   with another.
 *
 *   **The error was not the size of the discount, it was the shape.** Amortising
 *   is right for something you do once and then stop. A gladiator one step from
 *   reach scores the approach at `best / 2`, and a taunt that beats half a swing
 *   beats it again next turn and every turn after — **so it never takes the
 *   step, and the swing it was amortising against never arrives.** The discount
 *   assumed the arrival it was preventing.
 *
 *   Fixing it by choosing a horizon — `best * (H - walks) / H` — works and was
 *   rejected: `H` is an invented number, the outcome is extremely sensitive to
 *   it (the repository's own honest bout-length sweep gives a median of 50 turns
 *   across a whole bout, which is about 8 per gladiator in a 3v3, and 50 against
 *   8 is the difference between the walks mattering and not), and nothing in the
 *   build offers one. **A dial that decides the answer and cannot be derived is
 *   worse than no dial.**
 *
 * ► **SO THE RULE IS THE PLAIN ONE: a gladiator walks toward a fight unless a
 *   taunt is worth more than the swing it is walking toward.** That has no
 *   constant in it at all, and it gives the behaviour the game wants for a
 *   reason rather than by tuning: a healthy gladiator closes, because its heal
 *   term is zero and a swing beats a taunt; a WOUNDED one at range backs off and
 *   taunts, because the recovery is the largest term in `ss2TauntValue` and the
 *   shove keeps the fight where it can pay for it. An archer taunts more than a
 *   warrior, because its denial term is real and a warrior's is zero.
 *
 * The `walks` count is gone with the discount, and with it the one thing here
 * that was an approximation: it ignored the body clamp and the target moving.
 */
export function ss2ApproachValue(actor, target, best) {
  if (!(best > 0)) return 0;
  if (ss2FightDistance(actor, target) === null) return 0;
  return best;
}

/**
 * Which rank this gladiator should leave its own to JOIN, or `null`.
 *
 * ► **THIS IS THE DIAL THE 2026-09-18 HANDOFF'S RANKED ITEM 2 SHOULD HAVE
 *   ASKED FOR, and the layout question it DID ask was posed on a premise that
 *   is backwards.** That item called the team layout blocking because "with
 *   lanes enforced nobody can gang up", and offered one lane as the remedy.
 *   Measured 2026-09-19, counting turns on which a gladiator is inside 2+
 *   enemies' melee reach **with `ss2SameLane` applied exactly as the offer
 *   applies it**, over 24 seeded 3v3 bouts:
 *
 *   ```text
 *     rankStride 97 (shipped)    59 of 1,983 turns   3.0%   in 14 of 24 bouts
 *     rankStride 0  (one lane)    0 of 2,851 turns   0.0%   in  0 of 24 bouts
 *   ```
 *
 *   **One lane is the arrangement in which ganging up is IMPOSSIBLE** — a walk
 *   may never cross a foe, so two allies approaching one target queue on the
 *   same side of it. The lanes are the only thing that makes a 2-on-1 reachable
 *   at all. So the layout is settled and what is actually open is how WILLING a
 *   gladiator should be to leave its own fight and join somebody else's.
 *
 * ► **`rankJoinSurplus` IS THAT WILLINGNESS, AND THE GATE THIS REPLACED IS A
 *   POINT ON IT RATHER THAN A SEPARATE CASE.** What stood here was
 *   `!ownRankHasFoe` — leave only when your own rank is empty of foes. Written
 *   as a surplus over the rank you would be leaving behind:
 *
 *   ```text
 *     surplusAfterLeaving = alliesInMyRank (NOT counting me) - foesInMyRank
 *   ```
 *
 *   a gladiator may leave when `surplusAfterLeaving >= rankJoinSurplus`. In a
 *   3v3 each rank holds one gladiator a side, so `alliesInMyRank` is 0 and the
 *   surplus is `-foesInMyRank`. **At 0 that is exactly the old gate** (leave
 *   only with no foe in your rank); at `-1` a gladiator will break off a duel
 *   to make a 2-on-1 somewhere else; at `-2` it will leave two.
 *
 * ► **AND IT CANNOT CAUSE THE 2026-09-12 PILE-UP, which is the property that
 *   has to survive.** That collapse came from "move toward the NEAREST foe's
 *   rank", which fires at the OPENING when nothing is engaged and folds all six
 *   into one rank — the tell being that strides 97 and 150 then returned
 *   identical censuses. **This arm requires an ally to be ALREADY ENGAGED in
 *   the target rank**, which is false for every gladiator on turn one, so the
 *   opening is untouched however permissive the dial is. It is the same
 *   protection `ss2FlankingWalk` relies on, for the same reason.
 *
 * Joining is offered only to an ADJACENT rank, because a rank change is one
 * occupancy step (`ss2RankDestination`); a gladiator two ranks away arrives by
 * taking this arm twice, and re-asks the question at each step.
 */
export function ss2RankToJoin(view, rankJoinSurplus, rankStride) {
  const actor = view.actor;
  if (!Number.isFinite(actor.y)) return null;
  // ► **`Infinity` IS THE OFF SWITCH. IT IS NO LONGER THE DEFAULT, AND THE
  //   HISTORY IS WORTH THE THREE LINES.** This shipped OFF on 2026-09-19
  //   because a sweep is not a decision; the owner took the decision the same
  //   day and the default is 0. **What the off switch is still for** is
  //   reproducing a measurement taken before that — every census and
  //   engagement number in this repository dated 2026-09-18 or earlier was
  //   taken with this arm inert, and `rankJoinSurplus: Infinity` is how you get
  //   that engine back.
  //
  //   The value ALSO records a real error: the first cut defaulted to 0 while
  //   claiming in its own docstring that nothing moved. Measured, 25 seeded 3v3
  //   bouts went 2,234 decisions to 2,307 and rank changes 43 to 79. The claim
  //   was wrong, the number was real, and **a default that has to be argued to
  //   be a no-op is not one** — which is why the change of default below is
  //   stated as a behaviour change rather than slipped in as a tuning.
  //   ► **AND IT CANNOT BE `!Number.isFinite`, WHICH IS WHAT IT WAS UNTIL A
  //     MUTATION SURVIVED.** That test sent `-Infinity` down the OFF path while
  //     the rule-set id spelled it `-join-always`: **an id that said the
  //     opposite of the behaviour.** `< Infinity` gets all three cases right in
  //     one comparison — `NaN` is false so it is off, `+Infinity` is false so it
  //     is off, and `-Infinity` is true so it joins whenever an ally is engaged,
  //     which is what its own id claims.
  if (!(rankJoinSurplus < Infinity)) return null;
  // ► **THE STRIDE IS THE RULE SET'S AND NOT `SS2_ARENA.rankStride`.** A rule
  //   set built with a different stride puts its ranks somewhere else, and an
  //   adjacency test against the module constant would silently find no
  //   neighbour and disable this arm — the exact shape of the 2026-09-12 defect
  //   where `tools/engagement-census.mjs` compared against 0 instead of the
  //   shipped value and reported the default engine under the wrong heading.
  if (!(rankStride > 0)) return null;

  const living = (list) => list.filter((one) => one.alive !== false && Number.isFinite(one.y));
  const foes = living(view.foes);
  const allies = living(view.allies).filter((one) => one.id !== actor.id);

  // May I leave? The rank I would leave behind, counted without me.
  const foesHere = foes.filter((foe) => foe.y === actor.y).length;
  const alliesHere = allies.filter((ally) => ally.y === actor.y).length;
  if (alliesHere - foesHere < rankJoinSurplus) return null;

  // Where would I go? A rank ONE step away holding an ally who is already in a
  // fight — "already engaged" is what keeps the opening untouched.
  let best = null;
  for (const ally of allies) {
    // An ally in MY rank is not a rank to join; the adjacency test below would
    // reject it anyway (distance 0), and skipping it plainly is clearer than
    // relying on that.
    if (ally.y === actor.y) continue;
    if (Math.abs(ally.y - actor.y) !== rankStride) continue;
    const engaged = foes.some((foe) =>
      foe.y === ally.y && ss2FightDistance(ally, foe) < Math.max(ss2Reach(ally), ss2Reach(foe)));
    if (!engaged) continue;
    // Nearest such ally, ties broken by id so two peers agree.
    if (best === null || ally.y > best.y || (ally.y === best.y && ally.id < best.id)) best = ally;
  }
  if (!best) return null;
  return best.y > actor.y ? Ss2ActionType.RANK_FRONT : Ss2ActionType.RANK_BACK;
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
 * The verbs whose OFFER means "in range" by the villain's own test — the verbs
 * its in-range bands write (`DoAction@0x23f835` `+0x03fd`-`+0x08b1`):
 * `quick_attack`, `normal_attack`, `power_attack` at `equipped_weapon == 1`,
 * and the snipes and bombards at `equipped_weapon == 2`.
 *
 * ► **`bash_attack` IS DELIBERATELY NOT HERE, and that is the one place this
 *   set departs from `ATTACK_BANDS`.** A drawn bow is offered the bash only on
 *   `closerange_archer`, the frame for a foe inside the floor — which is the
 *   build's `equipped_weapon == 2 && fightdistance < 200`, the OUT-of-range
 *   arm (`+0x03d5` -> `+0x08c3`). Read by `chooseAiAction`'s tired rest and by
 *   nothing else; see the approximations named there.
 */
const SS2_AI_IN_RANGE_VERBS = Object.freeze(new Set([
  Ss2ActionType.QUICK_ATTACK,
  Ss2ActionType.NORMAL_ATTACK,
  Ss2ActionType.POWER_ATTACK,
  Ss2ActionType.BOMBARD,
  Ss2ActionType.SNIPE
]));

/**
 * `psyche_up`, WHICH IS NOT A BAND AND MUST NOT BECOME ONE.
 *
 * ► **MEMBERSHIP OF `ATTACK_BANDS` MEANS "ALWAYS ATTACKS", AND TWO OF THIS
 *   ACTION'S THREE PRESSES ROLL NOTHING.** The phase reads the counter and
 *   plays `psyche_up`, `psyche_up2` or `psyche_up3` for 1, 2 and ~~>= 3~~
 *   exactly 3 (`Equals2` each time — see `SS2_PSYCHE_UP.clips`)
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
    fromHealth: recovered ? recovered.health : null,
    // `crowd_action = -2` (`+0x67a8`) on EVERY tick, after whatever the first
    // tick's outcome wrote — `defender_blocked`'s -2 on a failed roll
    // (`+0x6b0e`), `knockback`'s 1 on the shove, `damagecharacter`'s 2 on the
    // strike — so every taunt that does not kill adds -2, whatever it rolled.
    crowdAction: ss2CrowdActionOf(VANILLA_PHASE_LABEL[Ss2ActionType.TAUNT])
  })
});

/**
 * How the counter behaves, all in one place because three of these four
 * numbers are easy to get one out.
 */
export const SS2_PSYCHE_UP = Object.freeze({
  /**
   * `psyche_up`, `psyche_up2`, `psyche_up3` for 1, 2 and ~~>= 3~~ **exactly 3.**
   *
   * ► **CORRECTED 2026-09-22: the third test is `Equals2`, not a `>=`**
   *   (`Push 3` at `+0x65f5`, `Equals2` at `+0x65fd`, and again at
   *   `+0x6631`/`+0x6639` for the discharge). So in the build a counter of 4 or
   *   more matches NO arm: nothing plays, nothing is rolled, and — with no clip
   *   to report `struck == true` — the phase cannot complete. **No path in the
   *   build or here produces such a counter** (every write is 1, or 1 + 1), so
   *   this engine's `Math.min(counter, dischargeAt)` treating it as 3 is a
   *   reading of an unreachable state, named rather than modelled.
   */
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
   *   *(Stale since each was built: the taunt's and the bolts' writes are
   *   live, and `+0x7a6a` went live with `cast_whirlwind` on 2026-09-22 —
   *   see `SS2_WHIRLWIND`. And a NINTH exit reaches `+0x6738`: a discharge
   *   press gated out of range, which the same day stopped keeping its
   *   charge.)*
   *
   *   So a gladiator who has taken
   *   any other turn is at 1, which is what "fresh" means here. What the build
   *   holds before the FIRST write is a map silence
   *   (`psyche-up-initialisation`), and this models the reset rather than
   *   inventing an initial value.
   */
  floor: 1,
  /**
   * ~~`defender._x -/+ round(weapon_range + 50)`~~ **`round(defender._x -/+
   * (weapon_range + 50))`**, `+0x6658`-`+0x6699` right and `+0x66d1`-`+0x6712`
   * left: `Add2` the 50, `Subtract`/`Add2` from `defender._x`, THEN
   * `Math.round`. Corrected 2026-09-22; see `ss2PsycheDischargeInRange`.
   */
  rangeBonus: 50
});

/* ------------------------------------------------------------------ */
/* The two spells that are attacks: the whirlwind and the ghost strike */
/* ------------------------------------------------------------------ */

/**
 * `cast_whirlwind`, byte-derived 2026-09-22 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f` (block base `0x240c85`),
 * `+0x78da`-`+0x7aa9`:
 *
 * ```text
 *   phase_decision == "cast_whirlwind"                              +0x78da
 *     register:3.crowd_action = 3                                   +0x78ed
 *     game_attacker.staminacost = Math.round(game_attacker.magicka) +0x78fa-+0x7920
 *     if (attacker.struck == null) {                                +0x7921-+0x7933
 *       cast_spell_icon(attacker, 37)                               +0x7938
 *       attacker.gotoAndPlay("psyche_up3")                          +0x7950
 *       attacker.struck = false                                     +0x7964
 *       if (attacker.gladiator_dir == "right")                      +0x7972-+0x7985
 *         if (attacker._x > round(defender._x - (game_attacker.weapon_range + 50)))
 *           { attack_direction = 30; checkattackroll() }            +0x798a-+0x79ea
 *       if (attacker.gladiator_dir == "left")                       +0x79eb-+0x79fe
 *         if (attacker._x < round(defender._x + (game_attacker.weapon_range + 50)))
 *           { attack_direction = 30; checkattackroll() }            +0x7a03-+0x7a63
 *       game_attacker.psyche_up = 1                                 +0x7a64-+0x7a74
 *     }
 *     if (attacker.struck == true) { attacker.struck = null; nextphase() } +0x7a75-+0x7aa9
 * ```
 *
 * ► **IT IS THE PSYCHE DISCHARGE'S RESOLUTION, NOT A COPY OF IT.** The gate
 *   is the discharge's to the instruction (`+0x6658`-`+0x6717`), the direction
 *   is the same constant 30 with no draw, and the call is the same
 *   `checkattackroll()` — so everything direction 30 does there it does here:
 *   `ceil(max_damage * 1.5)` with the `character_level * 10` floor, the fixed
 *   critical 20, a deflection drawn that cannot cancel it, a `grievous` that
 *   always knocks back (the `randosmash` still drawn), and armour-removal
 *   requests that match no group. **This engine therefore hands it to the same
 *   attack path with the discharge's band shape**, and writes none of that
 *   here; `test/ss2-whirlwind-ghost-strike.test.js` pins the two tapes equal.
 *
 * ► **OUT OF RANGE IT IS A LEGAL, WASTED CAST**: both facing tests fail, no
 *   sample is taken, nobody is struck — and the cost is still `round(magicka)`
 *   (set before the gate, every tick), the item is still spent (by the chooser,
 *   before the phase runs) and the charge is still reset (`+0x7a64` is after
 *   both tests, inside the entry block, on every exit).
 *
 * ► **THE WRITE-BACK HAS NO INCREMENT**, unlike the discharge's (`+0x6761`),
 *   so a whirlwind leaves its caster at 1 where a discharge leaves 2. It runs
 *   in the cast's own tick, so it survives a kill that `death()` would
 *   otherwise stop — this engine emits it itself rather than leaving it to
 *   `nextphase`'s reset, which a kill skips.
 *
 * ► **NOT MODELLED, AND NAMED:** ~~`crowd_action = 3`,~~ `cast_spell_icon`, and
 *   the arm's lack of a `Jump` (it falls through into the `cast_gale` test at
 *   `+0x7aaa`), as for every spell before it. **`crowd_action = 3` IS
 *   MODELLED since 2026-09-22**: the top write re-runs every tick after the
 *   first tick's `checkattackroll`, so a whirlwind adds 3 to `crowd_interest`
 *   whether it hits, misses or is out of range (`src/team/ss2-crowd.js`).
 *
 * ► **THE OFFER IS POSSESSION.** `fightdistance < 200` and
 *   `equipped_weapon != 2` are ladder arm 20 of `villain_cast_spells`
 *   (`DoAction@0x23e7cf` `+0x0c99`-`+0x0cf5`), the villain AI's DECISION; the
 *   hero's inventory button tests only `inv_struck` (the gale's reading of
 *   `sprite:862[overlay]/frame:1`, which this derivation did not re-read). See
 *   `legalActions` and `chooseAiAction`.
 */
export const SS2_WHIRLWIND = Object.freeze({
  /** `cast_spell_icon(attacker, 37)` `+0x7938`, `check_inventory(37)` `+0x0c99`. */
  itemId: 37,
  /** `attack_direction = 30`, `+0x79d0` / `+0x7a49` — a constant, no draw. */
  direction: 30,
  /** `attacker.gotoAndPlay("psyche_up3")`, `+0x7950`. */
  casterClip: "psyche_up3",
  /**
   * The victim's clip on a hit and on a miss — NOT played by this arm, but by
   * `checkattackroll`'s two dispatchers for direction 30: `defender_hurt`
   * sends it to `knockback` (`+0x20dd`-`+0x20ec`), `defender_blocked` to
   * `defend12` (`+0x21c6`). The discharge's pair, carried on the event
   * because the direction alone cannot name the caster's clip.
   */
  victimClipOnHit: "knockback",
  victimClipOnMiss: "defend12",
  /**
   * `register:3.crowd_action = 3`, `+0x78ed` — ~~Presentation cue; not
   * modelled.~~ **MODELLED 2026-09-22**: `register:3` is `_global`, and `nextphase`
   * adds this to the battle's one `crowd_interest` (`src/team/ss2-crowd.js`).
   */
  crowdAction: 3,
  /** The VILLAIN's gate, `fightdistance < 200` (`+0x0cc5`, `Less2`). Strict. */
  aiFightDistanceBelow: 200
});

/**
 * `cast_ghost_strike`, byte-derived 2026-09-22 from the same block,
 * `+0x7db7`-`+0x7fd9`:
 *
 * ```text
 *   phase_decision == "cast_ghost_strike"                           +0x7db7
 *     register:3.crowd_action = 5                                   +0x7dca
 *     game_attacker.staminacost = Math.round(game_attacker.magicka) +0x7dd7-+0x7dfd
 *     if (attacker.struck == null) {                                +0x7dfe-+0x7e10
 *       cast_spell_icon(attacker, 36)                               +0x7e15
 *       attacker.blendMode = "add"                                  +0x7e2d
 *       attacker_old_x = attacker._x                                +0x7e3c
 *       if (attacker.gladiator_dir == "left")                       +0x7e4c-+0x7e5f
 *         attacker._x = defender._x + game_attacker.physical_size   +0x7e64-+0x7e85
 *       else
 *         attacker._x = defender._x - game_attacker.physical_size   +0x7e8b-+0x7eac
 *       attacker.struck = false                                     +0x7ead
 *       attack_direction = randomBetween(9, 12)                     +0x7ebb
 *       Attack9 | Attack10 | Attack11 | Attack12 by the direction   +0x7ed3-+0x7f76
 *       checkattackroll()                                           +0x7f77
 *     }
 *     if (attacker.struck == true) {                                +0x7f87
 *       attacker._x = attacker_old_x; attacker.blendMode = "normal"
 *       attacker.struck = null; nextphase()                         +0x7f9f-+0x7fd9
 *     }
 * ```
 *
 * ► **FROM `struck = false` TO `checkattackroll()` IT IS `power_attack`,
 *   INSTRUCTION FOR INSTRUCTION** (`+0x607c`-`+0x6146`): the same
 *   `randomBetween(9, 12)`, the same four clips, the same call — so this
 *   engine resolves it through the same attack path with the same band draw,
 *   and the tape is the power attack's (pinned). **What differs is the
 *   price** — `round(magicka)` for `round(strength * 3)` — **and that there is
 *   no range test at all**, so it reaches from anywhere on the sands. The
 *   caster is put beside the victim first, which is why the melee reach the
 *   power attack is OFFERED on is irrelevant to it.
 *
 * ► **THE TELEPORT AND THE RETURN ARE PRESENTATION — EXCEPT AFTER A KILL.**
 *   The restore is gated on `struck == true`, which fires on a later tick;
 *   `damagecharacter` calls `death()` inside `checkattackroll`, and `death()`
 *   deletes `attacker.onEnterFrame` (`+0x2035` — the offset the attack path's
 *   "killing blow costs nothing" rule already cites, which this derivation did
 *   not re-read), so after a kill that tick never comes and the caster STAYS
 *   beside the body. This engine models that position (see the resolver); on
 *   a strike that does not kill, the caster ends where it began and no
 *   position is written.
 *
 * ► **AND THE AUTHORED BACK-ATTACK BONUS IS JUDGED FROM THE TELEPORT**, since
 *   `checkattackroll()` runs after it (`+0x7f77`): the blow comes from the
 *   side that keeps the caster facing its victim, not the side it stood on.
 *   Above 1v1 those can differ, and until 2026-09-22 this engine judged from
 *   the wrong one (audit WG-1). In 1v1 they cannot. See the resolver's
 *   `ghostLanding`.
 *
 * ► **NOT MODELLED, AND NAMED:** the on-screen blink beside the target and
 *   back (the presentation vocabulary has no "held away, then restored"
 *   motion; only the kill's one-way move is presented), `blendMode = "add"`,
 *   ~~`crowd_action = 5`,~~ `cast_spell_icon`, and the build's per-tick 1-pixel
 *   separation nudge while the caster stands beside its victim — this engine
 *   has no form of that nudge anywhere. **`crowd_action = 5` IS MODELLED since
 *   2026-09-22**: a ghost strike that does not kill adds 5 to `crowd_interest`.
 *
 * ► **THE OFFER IS POSSESSION.** `fightdistance > 500` and
 *   `equipped_weapon != 2` are ladder arm 21 (`+0x0d19`-`+0x0d75`), the
 *   villain AI's DECISION.
 */
export const SS2_GHOST_STRIKE = Object.freeze({
  /** `cast_spell_icon(attacker, 36)` `+0x7e15`, `check_inventory(36)` `+0x0d19`. */
  itemId: 36,
  /** `attack_direction = randomBetween(9, 12)`, `+0x7ebb` — `power_attack`'s band. */
  directionLow: 9,
  directionHigh: 12,
  /**
   * `register:3.crowd_action = 5`, `+0x7dca` — ~~Presentation cue; not
   * modelled.~~ **MODELLED 2026-09-22**: `register:3` is `_global`, and `nextphase`
   * adds this to the battle's one `crowd_interest` (`src/team/ss2-crowd.js`).
   */
  crowdAction: 5,
  /** The VILLAIN's gate, `fightdistance > 500` (`+0x0d45`, `Greater`). Strict. */
  aiFightDistanceAbove: 500
});

/**
 * The band shape each item strike hands the attack path — the same shape
 * `PSYCHE_UP_DISCHARGE` and `ATTACK_BANDS` use, so the dispatcher cannot tell
 * them apart, plus the two things that make them spells: the item they spend
 * and a cost in `magicka` rather than strength.
 *
 * ► **`magickaCost` REPLACES THE SWING'S PRICE ON BOTH PATHS**, play and
 *   `fixtureReplay` alike: the build's `staminacost = round(magicka)` is the
 *   bolts' and every other spell's, and the owner's swing repricing
 *   (`SS2_SWING`) is a decision about SWINGS. No golden casts either.
 */
const SS2_ITEM_STRIKES = Object.freeze({
  [Ss2ActionType.CAST_WHIRLWIND]: Object.freeze({
    direction: SS2_WHIRLWIND.direction, itemId: SS2_WHIRLWIND.itemId, magickaCost: true
  }),
  [Ss2ActionType.CAST_GHOST_STRIKE]: Object.freeze({
    low: SS2_GHOST_STRIKE.directionLow, high: SS2_GHOST_STRIKE.directionHigh,
    itemId: SS2_GHOST_STRIKE.itemId, magickaCost: true
  })
});

/**
 * What a blow through the attack path leaves in `crowd_action` for
 * `nextphase` — see `src/team/ss2-crowd.js`.
 *
 * - **An arm with a top write adds its constant**, whatever the blow did: it
 *   is rewritten on every tick after the first tick's `checkattackroll`.
 *   `quick_attack` -1 (`+0x6304`), `power_attack` 2 (`+0x6029`), the archery
 *   arm -1 (`+0x6ba2`), `taunt` -2 (`+0x67a8`), the whirlwind 3 (`+0x78ed`),
 *   the ghost strike 5 (`+0x7dca`).
 * - **`normal_attack`, `bash_attack` and the level-3 discharge have none**
 *   (the discharge's one write, `+0x6604`, precedes `checkattackroll` on the
 *   same tick), so the damage path's last write stands: `ss2StrikeCrowdAction`.
 *
 * Only reached for a blow that did NOT kill — a kill skips the transition.
 */
function ss2AttackPathCrowdAction(type, outcome) {
  if (type === Ss2ActionType.NORMAL_ATTACK || type === Ss2ActionType.BASH_ATTACK
    || type === Ss2ActionType.PSYCHE_UP) {
    return ss2StrikeCrowdAction(outcome);
  }
  if (type === Ss2ActionType.CAST_WHIRLWIND) return SS2_WHIRLWIND.crowdAction;
  if (type === Ss2ActionType.CAST_GHOST_STRIKE) return SS2_GHOST_STRIKE.crowdAction;
  return ss2CrowdActionOf(VANILLA_PHASE_LABEL[type]);
}

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
/**
 * The mean of `randomBetween(1, 3)`, the floor a direction-20 strike rolls when
 * `round(charisma * 4) - defender.charisma` comes out below 1
 * (`directionProfile`, `direction === 20`).
 *
 * ► **IT IS HERE AS A NAMED CONSTANT RATHER THAN A `2` IN `ss2TauntValue`
 *   BECAUSE IT IS A MEAN AND NOT A DRAW.** The AI prices an outcome it has not
 *   rolled; the resolver rolls it. Writing the mean inline in the valuation
 *   would read as the build's own number and it is not one — the build has no
 *   mean, it has a uniform draw over 1, 2, 3.
 */
/**
 * How willing an AI gladiator is, by default, to leave its own fight and join an
 * ally's. **AUTHORED, TUNED AGAINST A SWEEP, AND THE OWNER'S CALL.**
 *
 * ► **0 MEANS "JOIN, BUT NEVER DESERT ANYBODY".** `ss2RankToJoin` may leave a
 *   rank when `alliesInMyRank (not counting me) - foesInMyRank >= this`, so at 0
 *   a gladiator with a foe in its own rank stays and fights it. What it gains is
 *   a reason to walk INTO an ally's fight rather than toward whichever enemy
 *   happens to be nearest.
 *
 * ► **THE SWEEP THAT SET IT, 300 seeded 3v3 bouts an arm on the demo roster,
 *   through the arena's own host.** Head-to-head numbers are given for BOTH
 *   arms, because a one-armed A/B is an A — the failure that broke the
 *   2026-09-18 taunt claim:
 *
 *   ```text
 *     vs shipped        as team 0        as team 1        alternating
 *       surplus  0      155-145 51.7%    136-164 45.3%    130-170 43.3%  -2.3σ
 *       surplus -1      166-133 55.5%    148-150 49.7%    150-149 50.2%  +0.1σ
 *
 *     a bout looks like   turns  settled   2-on-1 turns   rank changes
 *       off                  97  300/300    804 (2.7%)             500
 *       surplus  0           92  300/300   1465 (5.3%)             847
 *       surplus -1          137  297/300    754 (1.8%)            1113
 *   ```
 *
 * ► **IT IS NOT THE SETTING THAT WINS, AND THAT IS DELIBERATE.** 0 costs about
 *   2.3σ of win rate against the old policy while DOUBLING the share of turns
 *   somebody is fighting two enemies (2.7% → 5.3%) and making bouts SHORTER
 *   (97 → 92 turns), with all 300 still settling. **Same trade as `aiCharges`:
 *   an opponent more interesting to fight and slightly worse at fighting**, and
 *   the win rate is the wrong number for PvP anyway, where both sides have it.
 *   Owner's decision, 2026-09-19, taken on the sweep above.
 *
 * ► **AND -1 IS WORSE THAN DOING NOTHING AT THE THING IT IS FOR**, which is why
 *   the dial stops here rather than going further: it HALVES the 2-on-1 rate
 *   against `off` while tripling rank changes, runs bouts 41% longer and stops
 *   3 of 300 settling. Everybody breaks off constantly and nobody stands still
 *   long enough for a second attacker to arrive — **churn, not focus.**
 *
 * ► **THE DIAL HAS THREE SETTINGS ON THIS ROSTER, NOT A CURVE.** -1, -2 and -99
 *   are byte-identical in both tables above: with one gladiator a side in a rank
 *   the surplus only ever reaches -1, so nothing below it can bind. **Re-run the
 *   sweep if the roster ever puts two gladiators in one rank**, because that is
 *   the condition under which the lower settings start to mean anything.
 */
export const SS2_RANK_JOIN_SURPLUS = 0;

const SS2_TAUNT_FLOOR_DAMAGE_MEAN = 2;

/**
 * `shove` — A REAL SS2 PLAYER VERB THAT THIS ENGINE HAD NO REPRESENTATION OF,
 * built 2026-09-19 and derived here rather than in the map, which carried only
 * the force row and the stamina row.
 *
 * ## THE WHOLE PHASE, read out of the oracle (sha256 `77CB545C…`, the block at
 * ## `sprite:862[overlay]/frame:52`, 38,146 bytes)
 *
 * ```text
 *   game_attacker.staminacost = round(strength * 1.5)             +0x5dd3
 *   if (attacker.shove != true) {                                 +0x5e00
 *     attacker.shove = true                                       +0x5e19
 *     attacker.gotoAndPlay("shove")                               +0x5e27
 *     if (attacker.gladiator_dir == "right") {                    +0x5e3b
 *       force = game_attacker.strength * 12                       +0x5e53
 *       force_bonus = get_percentage(100 + gauntlet * 2, 100)     +0x5e6b
 *       force = add_percentage(force, force_bonus)                +0x5e99
 *       if (force < 20) force = 20                                +0x5eb3
 *       if (force > 100) defender.gotoAndPlay("knockback")        +0x5ed3
 *     } else {                                                    +0x5f01
 *       ... the same, then force = 0 - force                      +0x5f61
 *       if (force > -20) force = -20                              +0x5f74
 *       if (force < -100) defender.gotoAndPlay("knockback")       +0x5f94
 *     }
 *     knockback(defender, force)                                  +0x5fc9
 *   }
 *   if (attacker.struck == true) {                                +0x5fd5
 *     attacker.struck = null; attacker.shove = null; nextphase()  +0x5fed
 *   }
 * ```
 *
 * ► **IT TAKES NO SAMPLE AND DEALS NO DAMAGE, AND THAT IS THE HEADLINE.**
 *   Counted over the whole phase `+0x5dcd`…`+0x6007`: **zero `randomBetween`,
 *   zero `Math.random`, zero `checkattackroll`, zero `hitpoints`.** So unlike
 *   `taunt` — which stayed deferred for a month precisely because a candidate
 *   would have taken the dispatcher's samples on every press where the build
 *   takes them on one outcome in four — **a shove has no tape hazard at all.**
 *   It is a pure displacement that costs stamina.
 *
 * ► **THE GAUNTLET BOOSTS IT, AND THE ARGUMENT ORDER IS WHAT DECIDES THAT.**
 *   `get_percentage(a, b) = (a / b) * 100` and `add_percentage(a, b) =
 *   ceil(a * b / 100)`, with `a` in register 2 and `b` in register 1 — read
 *   from the `DefineFunction2` headers at `+0x106a` and `+0x109b`, because
 *   reading the bodies alone inverses both. **Which of the two pushed values is
 *   `a` was settled against a site this repository had already derived and had
 *   checked with six verifiers**: the walk's `walk_bonus` at `+0x3ba3` is
 *   byte-for-byte this same shape (`Push name, 100, 100, <stat> * 2, Add2`)
 *   and resolves to `get_percentage(100 + 2 * boot, 100)` = `100 + 2 * boot`.
 *   So the LAST-pushed value is `a`, and here that gives
 *   `force_bonus = 100 + 2 * gauntlet` — a gauntlet makes the shove stronger,
 *   which is also what the map's force table says in words.
 *   **Had it been the other way the gauntlet would have WEAKENED it**, which is
 *   why this is derived against a known site rather than reasoned about.
 *
 * ► **THE FLOOR IS APPLIED AFTER THE BOOST**, not before — `+0x5eb3` follows
 *   `+0x5e99` — so a feeble gladiator with a good gauntlet still floors at 20.
 *
 * ► **AND THERE IS NO RANGE GATE IN THE PHASE.** The gate is the CONTROLLER:
 *   the map's button table (`:225`-`:230`) wires `shove` on
 *   `closerange_warrior` and `closerange_archer`, both facings, and on neither
 *   long-range frame. Same shape as the three melee attacks.
 */
export const SS2_SHOVE = Object.freeze({
  /** `force = strength * 12` (`+0x5e53`, `+0x5f01`). */
  strengthFactor: 12,
  /** `staminacost = round(strength * 1.5)` (`+0x5dd3`). */
  staminaCostFactor: 1.5,
  /** `force_bonus = 100 + gauntlet * 2` (`+0x5e6b`, `+0x5f19`). */
  gauntletFactor: 2,
  /** `if (|force| < 20) force = ±20` (`+0x5eb3`, `+0x5f74`). */
  minimumForce: 20,
  /** `defender.gotoAndPlay("knockback")` only above this (`+0x5ed3`, `+0x5f94`). */
  knockbackAnimationForce: 100
});

/**
 * The signed displacement a shove applies to its target, in arena units.
 *
 * Sign is the ATTACKER's facing (`+0x5e3b`), which is the taunt's rule and the
 * OPPOSITE of `damagecharacter`'s — that one signs on the DEFENDER (`+0x1ae9`).
 * Three of the four `knockback` call sites disagree about this, so it is read
 * per site rather than generalised.
 */
export function ss2ShoveForce(actor) {
  const strength = actor?.stats?.strength ?? 0;
  const gauntlet = resourceValue(actor, "gauntlet", 0);
  const raw = strength * SS2_SHOVE.strengthFactor;
  // `add_percentage(force, 100 + 2 * gauntlet)` = `ceil(force * bonus / 100)`.
  const boosted = Math.ceil((raw * (100 + gauntlet * SS2_SHOVE.gauntletFactor)) / 100);
  const magnitude = Math.max(SS2_SHOVE.minimumForce, boosted);
  const facingLeft = (actor?.status ?? []).includes(SS2_FACING_LEFT);
  return facingLeft ? 0 - magnitude : magnitude;
}

/* ------------------------------------------------------------------ */
/* The inventory: six slots, and `1` is the EMPTY one                   */
/* ------------------------------------------------------------------ */

/**
 * The six slot field names, in the build's own 1-based order.
 *
 * A frozen list rather than a loop bound, because two different things in the
 * build iterate these and they iterate them differently: `use_item` (`+0x0390`)
 * and `check_inventory` (`+0x02f8`) both hard-loop `i = 1..6` and consult
 * nothing else, while the HERO's panel (`sprite:492[inventory_overlay]/frame:1`
 * `+0x0216`-`+0x027e`) walks the same six and hides the buttons above
 * `inventory_maxslots`. The count 6 is the build's in both, and the gate is not.
 */
export const SS2_INVENTORY_SLOTS = Object.freeze([
  "inventory1", "inventory2", "inventory3", "inventory4", "inventory5", "inventory6"
]);

/**
 * The value a slot holds when it holds NOTHING, and it is **1, not 0**.
 *
 * Measured across the whole 7.5 MB oracle on 2026-09-19 and unchanged here:
 * fourteen emptiness tests, every one `Equals2` against `1`; every literal
 * write to a slot is 1 (`randomise_gladiator` `+0x330a`-`+0x334b`, `use_item`
 * `+0x0409`, the hero's six consume handlers at `sprite:862[overlay]/frame:1`
 * `+0x0626`-`+0x0851`); zero writes of `0` anywhere. `use_item` additionally
 * REFUSES `which_item == 1` (`+0x03cc`) and `check_inventory` carries the same
 * `!= 1` conjunct (`+0x0334`) — an id that cannot be used is not an item.
 *
 * `0` is a real "nothing" row in the authored item table and seventeen of the
 * nineteen champion DNA literals use it, which is why a reader who assumes 0
 * gets this backwards. **The table agrees and the code does not**, and this
 * engine spells empty the way the CODE does.
 */
export const SS2_INVENTORY_EMPTY = 1;

/**
 * The first slot holding `itemId`, as a slot field name — or `null`.
 *
 * `check_inventory`'s own search order: ascending from slot 1, first match
 * wins, and the loop does not stop at `inventory_maxslots` (`+0x02f8`). A slot
 * the combatant never DECLARED is not searched, which is the difference
 * between "carries nothing" and "never mentioned an inventory": the six names
 * have no `SS2_RESOURCE_DEFAULTS` entry, so an undeclared slot has no value to
 * compare rather than a defaulted one.
 *
 * ► ~~the loop does not stop at `inventory_maxslots`~~ — **still true of
 *   `check_inventory`, and since 2026-09-22 NO LONGER TRUE OF THIS FUNCTION BY
 *   DEFAULT.** It now also applies the HERO panel's window
 *   (`sprite:492[inventory_overlay]/frame:1` `+0x0216`-`+0x027e`): the slot at
 *   1-based position `i` is searched only if the combatant does not declare
 *   `inventory_maxslots`, or `!(i > inventory_maxslots)` — the build's own
 *   `Greater; Not` (`+0x0255`), so `0` searches nothing and `2.5` searches
 *   slots 1 and 2. Undeclared fails OPEN, as the build's `i > undefined` does.
 *
 *   **Default-on because it is ONE rule for every spell.** The panel hides a
 *   BUTTON, whatever the slot holds, so the window belongs to the slot search
 *   and not to any one verb; every offer and every consumption that finds its
 *   slot here gets the same answer, and a verb cannot be offered from a slot
 *   another verb's offer would refuse. `{ ignoreMaxslots: true }` is
 *   `check_inventory`'s unbounded search — the VILLAIN's, which never reads
 *   the field — and exists so a refusal can name the slot it refused.
 *
 * **`itemId` 1 never matches**, whatever a slot holds, because both of the
 * build's searches exclude it by name. Passing 1 here is asking to use the
 * empty marker as an item.
 */
export function ss2InventorySlotHolding(actor, itemId, { ignoreMaxslots = false } = {}) {
  if (itemId === SS2_INVENTORY_EMPTY) return null;
  const declared = declaredResourceNames(actor);
  const windowed = !ignoreMaxslots && declared.has("inventory_maxslots");
  // Not `window`: this module also runs in the browser arena, where that name
  // is the global object.
  const slotWindow = windowed ? resourceValue(actor, "inventory_maxslots") : null;
  for (const [index, slot] of SS2_INVENTORY_SLOTS.entries()) {
    if (!declared.has(slot)) continue;
    if (windowed && index + 1 > slotWindow) continue;
    if (resourceValue(actor, slot, SS2_INVENTORY_EMPTY) === itemId) return slot;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* The bolt phase: the one spell shape a discrete turn can express      */
/* ------------------------------------------------------------------ */

/**
 * `cast_lightning_bolt` / `cast_frightning_bolt`, byte-derived 2026-09-20 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f` `+0x83f5`-`+0x862e`.
 *
 * ```text
 *   phase_decision == "cast_lightning_bolt"                        +0x83fb
 *     || phase_decision == "cast_frightning_bolt"                  +0x840f
 *     register:3.crowd_action = 5                                  +0x841c
 *     game_attacker.staminacost = Math.round(game_attacker.magicka) +0x842f
 *     if (attacker.struck == null) {                               +0x8456
 *       if (phase_decision == "cast_lightning_bolt") {             +0x846d
 *         cast_spell_icon(attacker, 34)                            +0x8485
 *         lightning_damage = randomBetween(100, 200)               +0x8492
 *         lightning_frame  = 1                                     +0x84ab
 *       }
 *       if (phase_decision == "cast_frightning_bolt") {            +0x84bd
 *         cast_spell_icon(attacker, 35)                            +0x84d5
 *         lightning_damage = randomBetween(200, 400)               +0x84e2
 *         lightning_frame  = 2                                     +0x84fb
 *       }
 *       attacker.struck = false                                    +0x850d
 *       attacker.gotoAndPlay("Cast2")                              +0x8515
 *       bolt = arena.gladiators.attachMovie("lightning_bolt_combat",
 *                ..., { _x: defender._x, _y: 50 })                 +0x852a
 *       magic_damage_character(defender, attacker, game_defender,
 *                game_attacker, "lightning", 8, lightning_damage)  +0x85af
 *       bolt.gotoAndStop(lightning_frame)                          +0x85c2
 *     }
 *     if (defender.struck == true) {                               +0x85db
 *       bolt.removeMovieClip(); attacker.struck = null;
 *       defender.struck = null; nextphase()                        +0x861f
 *     }
 * ```
 *
 * ► **ONE SAMPLE PER CAST, AND IT IS THE DAMAGE.** The arm has TWO
 *   `randomBetween` sites (`+0x8492`, `+0x84e2`) in mutually exclusive arms, so
 *   exactly one fires. Zero `checkattackroll`, zero `RandomNumber`, zero
 *   direction draws across all 138 instructions of `+0x83f5`-`+0x862e`. **A
 *   bolt cannot miss**, cannot crit, and reads no `attack_chances` entry —
 *   which is why it is not in `ATTACK_BANDS` and why
 *   `SS2_ATTACKER_REQUIRED_RESOURCES` does not apply to it:
 *   `magic_damage_character` binds `attacker`/`game_attacker` to register 0 and
 *   reads neither, so **no caster stat can influence the number** except
 *   through the roll's own fixed range.
 *
 *   *(The ingress's own zero-RNG is the MAP's byte-verification, not this
 *   arm's — §"Spell ingress `magic_damage_character`", whose call inventory is
 *   the UI attaches, `Math.ceil`, `check_flipping`, `get_percentage`,
 *   `add_percentage`, `check_stats` and the two `death` sites. An adversarial
 *   verifier was right to refuse to take "the PHASE takes one sample" from a
 *   dump that does not cover `+0x1313`-`+0x157c`. The arm takes one; the
 *   ingress takes none, on the map's authority.)*
 *
 * ► **SAMPLE COUNT IS NOT WHAT SEPARATES A BOLT FROM A FIREBALL.** The
 *   fireball family takes one sample per cast too. What separates them is
 *   TIMING: a bolt's damage is applied in the same straight-line run as
 *   `gotoAndPlay("Cast2")`, and a fireball's waits for a `bullet` with
 *   `Xvelocity` 50/70/90~~, `gravity` 2~~ and an `onEnterFrame`. **`gravity` 2
 *   is WRITTEN (`+0x9360`) and never read — the fireball's `onEnterFrame`
 *   reads only `flying`, `gladiator_dir`, `_x` and `Xvelocity`, so the flight
 *   is FLAT** (corrected 2026-09-22 when the fireballs were built; see
 *   `SS2_FIREBALL_SPELLS`). See
 *   `test/ss2-bolt.test.js` for the three-arm comparison, including the
 *   doubled-`Not` gate that makes the fireball's frame test an idempotence
 *   guard rather than an impact trigger.
 *
 * ► **THE COST IS `round(magicka)`, THE STAT, AND THERE IS NO AFFORDABILITY
 *   CHECK ANYWHERE.** Same as `cast_gale`'s. The cost is assigned here and
 *   spent unconditionally by `nextphase` at `+0x32a7`; a caster at zero stamina
 *   still casts and `check_stats` clamps the floor to 0 afterwards. **Do not
 *   invent a gate the build does not have** — `legalActions` therefore offers a
 *   bolt at any stamina above the forced-rest floor, exactly as the build's
 *   button is live at any stamina above it.
 *
 * ► **THE TWO INNER TESTS ARE SEQUENTIAL `if`s, NOT AN ELSE-IF**, and the
 *   second re-reads `phase_decision` (`+0x84bd`) rather than falling through.
 *   With `phase_decision` a single value only one can fire, so this is fidelity
 *   rather than a reachable branch — but it is the same shape the four status
 *   arms have, and this file has already been wrong once about what sequential
 *   `if`s mean.
 *
 * ► **THE `nextphase` GATE READS `defender.struck`, NOT `attacker.struck`** —
 *   `+0x85db`, against `cast_gale`'s `attacker.struck` at `+0x7ba4` and the
 *   melee phases' the same. ~~The phase advances when the VICTIM's hurt
 *   animation reports back~~ **The phase advances when the victim's `lightning`
 *   clip reaches frame 2003** (`hero_battle/frame:2003/DoAction@0x3a55b9`,
 *   `this.struck = true; Stop`) — not a hurt clip: **no Hurt, Defend, Death,
 *   Yield or knockback run writes `struck` at all**, and the fighter clip
 *   writes it at 38 frames, every one an ACTING clip's last. Corrected
 *   2026-09-22 by a derivation over all 177 `"struck"` references, checked by
 *   two write-nothing verifiers. **Nothing in the arm writes `defender.struck =
 *   true`** — its only writes to it are `= null` at `+0x8618`; the other half
 *   of the handshake is that frame. This engine has no animation report-back
 *   channel, so every phase here completes within the action; the difference is
 *   recorded because `src/adapter/action-gate.js` is the thing that would
 *   consume it. ~~and a gate built on the caster's clip would hold a bolt open
 *   for ever~~ **A gate on the caster's clip would close too — `Cast2` ends at
 *   frame 2146 with the same write, 20 frame advances against `lightning`'s 14,
 *   so 6 frames (0.2 s) after the victim's.** The first draft of this
 *   paragraph said "for ever", and a verifier refuted it from the same bytes.
 *
 *   ► **AND ON A DEFEAT THE BOLT IS NEVER REMOVED.** `death()` deletes both
 *     fighters' `onEnterFrame` handlers and `nextphase`, and this arm lives in
 *     the attacker's, so the gate runs exactly once — in the cast's own first
 *     tick, while `defender.struck` is still null — and never again; the arm's
 *     only `bolt.removeMovieClip()` (`+0x85fd`) never runs. A defeat is
 *     `hitpoints <= 0`, or, outside a tournament, ANY hitpoint damage (the
 *     `yield` path). The winner is released instead by overlay frames 64/76,
 *     which wait on the WINNER's `struck` — `Cast2`'s frame 2146 when the caster
 *     wins.
 *
 *   **It is not unique to the bolts, which the first draft of this paragraph
 *   implied.** `cast_death_from_above` carries the identical gate at
 *   `+0x8903`-`+0x8916`. The contrast that survives is with `cast_gale` and the
 *   melee phases, not with "every other phase".
 *
 * ► **THREE OF THE ARM'S FOUR VARIABLES ARE TIMELINE-SCOPE, NOT LOCALS.**
 *   `bolt` (`+0x8587`), `lightning_damage` (`+0x84aa`/`+0x84fa`) and
 *   `lightning_frame` (`+0x84b6`/`+0x8506`) are all `SetVariable`, and they have
 *   to be: `bolt.removeMovieClip()` at `+0x85fd` runs on a LATER frame than the
 *   one that created the clip. A port that scopes them to the phase body breaks
 *   the teardown silently.
 *
 * ► **THE ARM CONTAINS ZERO `Jump`s, so after `nextphase()` execution FALLS
 *   THROUGH into the `cast_death_from_above` test and every later arm in the
 *   same frame**, each re-reading `phase_decision` with `GetVariable`. If
 *   `nextphase()` reassigns `phase_decision` to a label tested later in the
 *   chain, a second phase body runs on the same frame. This engine resolves one
 *   action per call and so cannot express it; it is recorded because a
 *   frame-accurate port must decide what it does about it.
 */
export const SS2_BOLT_SPELLS = Object.freeze({
  [Ss2ActionType.CAST_LIGHTNING_BOLT]: Object.freeze({
    /** The inventory id `cast_spell_icon(attacker, 34)` names, `+0x8485`. */
    itemId: 34,
    /** `randomBetween(100, 200)`, `+0x8492`. Inclusive, per the map's RNG surface. */
    damageLow: 100,
    damageHigh: 200,
    /** `bolt.gotoAndStop(1)` — presentation only. */
    boltFrame: 1,
    /** The tape label; `src/golden/ss2-spell-candidate.js` owns the canonical one. */
    rollLabel: "lightning-bolt-damage-roll"
  }),
  [Ss2ActionType.CAST_FRIGHTNING_BOLT]: Object.freeze({
    itemId: 35,
    damageLow: 200,
    damageHigh: 400,
    boltFrame: 2,
    rollLabel: "frightning-bolt-damage-roll"
  })
});

/**
 * What both bolts share, because they share one arm and one call site.
 *
 * `damageMethod` and `bonusFrame` are the ingress's fifth and sixth arguments,
 * pushed once at `+0x858f` for BOTH labels — so a frightning bolt plays the
 * `lightning` hurt clip and the frame-8 splat exactly as a lightning bolt does.
 * Neither moves a number: `damage_method` is `defenderClip.gotoAndPlay`'s
 * argument and `bonus_frame` selects the floating splat.
 */
export const SS2_BOLT_INGRESS = Object.freeze({
  damageMethod: "lightning",
  bonusFrame: 8,
  /** `attacker.gotoAndPlay("Cast2")`, `+0x8515` — the CASTER's clip, shared. */
  casterClip: "Cast2",
  /**
   * `register:3.crowd_action = 5`, `+0x841c` — ~~Presentation cue; not
   * modelled.~~ **MODELLED 2026-09-22: the bolt phase adds 5 to the battle's
   * `crowd_interest`** (see `src/team/ss2-crowd.js`). The ingress's own 2
   * (`magic_damage_character` `+0x13cb`) lands on the first tick and this top
   * write overwrites it on every later one, so 5 is what `nextphase` adds.
   *
   * ~~**`register:3` is glossed as the attacker clip and that gloss is NOT
   * byte-verified here** — no `StoreRegister {"register":3}` appears in any
   * dump this derivation used.~~ **`register:3` IS `_global`, byte-verified
   * 2026-09-22**: `attacker.onEnterFrame` is a `DefineFunction2` with flags
   * `0x169` preloading `r1 = this`, `r2 = _root`, `r3 = _global`
   * (`all-function-headers.json`, `+0x36ae`), and `sprite:2224/frame:1` writes
   * `_global.crowd_action` by name. It is one per-battle crowd, not a cue on a
   * clip.
   */
  crowdAction: 5
});

/* ------------------------------------------------------------------ */
/* The fireball phase: the bolt's arithmetic, delivered by a bullet     */
/* ------------------------------------------------------------------ */

/**
 * `cast_fireball` / `cast_hell_fireball` / `cast_dire_fireball`, read
 * 2026-09-22 from `sprite:862[overlay]/frame:52/DoAction@0x240c7f` (block base
 * `0x240c85`), `+0x8f59`-`+0x94ff`:
 *
 * ```text
 *   phase_decision == "cast_fireball" || == "cast_hell_fireball"
 *     || == "cast_dire_fireball"                                   +0x8f59-+0x8f8f
 *     register:3.crowd_action = 5                                  +0x8f94
 *     game_attacker.staminacost = Math.round(game_attacker.magicka) +0x8fa1-+0x8fc7
 *     if (attacker.struck == null) {                               +0x8fc8-+0x8fda
 *       bullet_in_air = true                                       +0x8fdf
 *       if (label == "cast_fireball")      { cast_spell_icon(attacker, 30)
 *         fireball_damage = randomBetween(80, 160);  fireball_frame = 1 }  +0x8ffa-+0x9036
 *       if (label == "cast_hell_fireball") { cast_spell_icon(attacker, 31)
 *         fireball_damage = randomBetween(150, 450); fireball_frame = 2 }  +0x904a-+0x9086
 *       if (label == "cast_dire_fireball") { cast_spell_icon(attacker, 32)
 *         fireball_damage = randomBetween(300, 600); fireball_frame = 3 }  +0x909a-+0x90d6
 *       attacker.struck = false; attacker.fired = true             +0x90d7-+0x90f3
 *       attacker.gotoAndPlay("Cast1")                              +0x90f4
 *     }
 *     if (((bullet._x > defender._x && attacker.gladiator_dir == "right")
 *          || (bullet._x < defender._x && attacker.gladiator_dir == "left"))
 *         && bullet._currentframe != 4) {                          +0x9109-+0x9196
 *       magic_damage_character(defender, attacker, game_defender,
 *           game_attacker, "burning", 4, fireball_damage)          +0x91c1
 *       bullet.gotoAndStop(4); bullet.flying = false;
 *       bullet_in_air = false                                      +0x91cd-+0x91fc
 *     }
 *     if (attacker.fired == true) {                                +0x91fd-+0x9211
 *       attacker.fired = false; bulletdepth = 45000                +0x9216-+0x9230
 *       bullet = arena.gladiators.attachMovie("fireball_combat", ...) +0x9231-+0x9262
 *       bullet.gotondStop(fireball_frame)                          +0x9263-+0x927d
 *       bullet._x = attacker._x + 30 (right) | - 30 and _xscale = -_xscale (left)
 *                                                                  +0x927e-+0x92f9
 *       bullet._y = attacker._y - (attacker._yscale * 1.5 + 5)     +0x92fa-+0x9332
 *       bulletlife = 1; bulletcounter = 1; gravity = 2; distance_to_enemy = |dx|
 *                                                                  +0x9333-+0x93f4
 *       bullet.Xvelocity = 50 | 70 | 90                            +0x940f/+0x9435/+0x945b
 *       bullet.onEnterFrame = function () {
 *         if (bullet.flying != false)
 *           bullet._x += Xvelocity (right) | -= Xvelocity (else)   +0x947b-+0x94fe
 *       }
 *     }
 * ```
 *
 * ► **ONE SAMPLE PER CAST, AND IT IS THE DAMAGE — the bolts' shape.** Three
 *   `randomBetween` sites in mutually exclusive arms; no `checkattackroll`, no
 *   `RandomNumber`, no direction draw anywhere in `+0x8f59`-`+0x94ff`. It
 *   **cannot miss**: the impact test has no ground clause (the arrow's
 *   `bullet._y > 160` has no twin here), no lifetime and no off-screen exit.
 *
 * ► **THE TWO FRAME TESTS ARE AN IDEMPOTENCE GUARD, as the map records**:
 *   `+0x9194 Not; +0x9195 Not` reads `_currentframe != 4`, so the damage lands
 *   once and `gotoAndStop(4)` parks the clip on its explosion.
 *
 * ► **`gotondStop` IS A TYPO IN THE BUILD** (the constant at `+0x9276`), a call
 *   to a MovieClip method that does not exist. So `fireball_frame` is assigned
 *   and never applied, and **all three spells fly on `fireball_combat` frame
 *   1**; frames 2 and 3, the hell and dire art, are never shown. The table
 *   carries `fireballFrame` as the build ASSIGNS it, for the record; the
 *   presentation draws frame 1 and says why.
 *
 * ► **THE FLIGHT IS FLAT.** The `onEnterFrame` reads `flying`, `gladiator_dir`,
 *   `_x` and `Xvelocity` and NOTHING else. `gravity`, `bulletlife`,
 *   `bulletcounter` and `distance_to_enemy` are written and never read — they
 *   are the arrow arm's setup copied across (compare `+0x6ed7`-`+0x6f98`). The
 *   `flying != false` test passes while `flying` is undefined, which it is for
 *   the whole flight: the only write to it is `= false`, at impact (`+0x91ec`;
 *   the one read is `+0x9482`, and those are the only two `"flying"`
 *   references in the dumps this was read from — a whole-SWF sweep is the main
 *   session's, not re-run here). The two `gravity` READS those dumps show
 *   (`+0x7297`, `+0x7455`) are both inside the ARROW's `onEnterFrame`
 *   (`DefineFunction2` at `+0x7177`), which a fireball never has.
 *
 * ► **THE DIRECTION IS THE CASTER'S FACING, NOT THE TARGET'S SIDE.** Launch,
 *   flight and impact all read `attacker.gladiator_dir`. A target behind the
 *   caster is "past" at launch and burns on the first frame after it.
 *
 * ► **THE PHASE HAS NO `nextphase` OF ITS OWN.** Nothing in the arm ends it;
 *   the stall watchdog does (`+0x37ef`-`+0x38a0`: `demand_move >= 60 &&
 *   attacker._y >= attacker.grounded && bullet_in_air != true`, or
 *   `demand_move >= 200`). This engine completes every phase within the
 *   action, so the difference is the presentation's: the flight holds the
 *   animation gate, as the arrow's does.
 *
 * ► **ON A DEFEAT THE COST IS NEVER SPENT, the bolts' rule by the same
 *   mechanism**: the ingress's `death()` deletes both fighters' `onEnterFrame`
 *   and `nextphase`, so the watchdog that would have spent `staminacost` never
 *   runs.
 *
 * ► **ONE `bullet` IS SHARED WITH THE ARROW ARM**, timeline-scope like the
 *   bolt's `bolt`. On the cast's own first frame the impact test runs BEFORE
 *   the launch, against whatever `bullet` last held; that is a removed clip
 *   (the arrow removes itself at `+0x6d41`, the explosion's last frame removes
 *   the fireball) or one parked on frame 4, and both fail the test. Recorded
 *   because a frame-accurate port must keep that order.
 */
export const SS2_FIREBALL_SPELLS = Object.freeze({
  [Ss2ActionType.CAST_FIREBALL]: Object.freeze({
    /** `cast_spell_icon(attacker, 30)`, `+0x8ffa`; ladder arm 18, `check_inventory(30)` `+0x0c04`. */
    itemId: 30,
    /** `randomBetween(80, 160)`, `+0x9012`. Inclusive, per the map's RNG surface. */
    damageLow: 80,
    damageHigh: 160,
    /** `bullet.Xvelocity = 50`, `+0x940f` — arena units per 30 fps frame. */
    xVelocity: 50,
    /** `fireball_frame = 1`, `+0x902b` — ASSIGNED, and never applied (`gotondStop`). */
    fireballFrame: 1,
    /** The tape label; `src/golden/ss2-spell-candidate.js` owns the canonical one. */
    rollLabel: "fireball-damage-roll"
  }),
  [Ss2ActionType.CAST_HELL_FIREBALL]: Object.freeze({
    /** `+0x904a`; ladder arm 16, `+0x0b8e`. */
    itemId: 31,
    /** `randomBetween(150, 450)`, `+0x9062`. */
    damageLow: 150,
    damageHigh: 450,
    /** `+0x9435`. */
    xVelocity: 70,
    fireballFrame: 2,
    rollLabel: "hell-fireball-damage-roll"
  }),
  [Ss2ActionType.CAST_DIRE_FIREBALL]: Object.freeze({
    /** `+0x909a`; ladder arm 14, `+0x0b18`. */
    itemId: 32,
    /** `randomBetween(300, 600)`, `+0x90b2`. */
    damageLow: 300,
    damageHigh: 600,
    /** `+0x945b`. */
    xVelocity: 90,
    fireballFrame: 3,
    rollLabel: "dire-fireball-damage-roll"
  })
});

/**
 * What all three fireballs share, because they share one arm and one call.
 *
 * `"burning"` and `4` are pushed ONCE at `+0x91a2`, after the per-spell arms
 * converge — the grouping the map's table was re-cut to record on 2026-09-20.
 *
 * ► **"burning" HERE IS A CLIP, NOT THE CONDITION.** In
 *   `magic_damage_character` (`+0x1313`-`+0x157c`, map §"Spell ingress") the
 *   `damage_method` argument is read at step 1 and nowhere else:
 *   `defenderClip.gotoAndPlay(damage_method)`, with `bonus_frame` picking the
 *   floating splat. Steps 2-6 — armour first, the hitpoints gate, `psyche_up =
 *   1`, the breastplate stamina join, `check_stats` and the defeat gate — are
 *   identical for `"burning"`/4 and the bolts' `"lightning"`/8, and **no step
 *   sets the `burning` STATUS FLAG** (`applySs2MagicDamageCandidate` writes no
 *   status field except `death()`'s clears). A fireball sets nobody alight.
 */
export const SS2_FIREBALL_INGRESS = Object.freeze({
  damageMethod: "burning",
  bonusFrame: 4,
  /** `attacker.gotoAndPlay("Cast1")`, `+0x90f4` — the gale's clip, not the bolts'. */
  casterClip: "Cast1",
  /**
   * `register:3.crowd_action = 5`, `+0x8f94` (`register:3` is `_global`) —
   * ~~Presentation cue; not modelled.~~ **MODELLED 2026-09-22: a fireball
   * phase adds 5 to `crowd_interest`.** Named, not reproduced: the arm never
   * calls `nextphase` itself, so an impact on the tick just before the stall
   * watchdog fires leaves the ingress's 2 (`+0x13cb`) instead — see
   * `SS2_CROWD_ACTION` in `src/team/ss2-crowd.js`.
   */
  crowdAction: 5
});

/**
 * THE FIVE DIRECT-DAMAGE VERBS IN THE BUILD'S OWN LADDER ORDER — arms 14-18
 * of `villain_cast_spells` (`DoAction@0x23e7cf`, base `0x23e7d5`):
 *
 * ```text
 *   14  check_inventory(32)  cast_dire_fireball    +0x0b18
 *   15  check_inventory(35)  cast_frightning_bolt  +0x0b53
 *   16  check_inventory(31)  cast_hell_fireball    +0x0b8e
 *   17  check_inventory(34)  cast_lightning_bolt   +0x0bc9
 *   18  check_inventory(30)  cast_fireball         +0x0c04
 * ```
 *
 * Each is the arm's ONLY test, and each failing `If` lands on the next arm's
 * first instruction (`+0x0b2f` -> `+0x0b53`, and so on), so on simultaneous
 * possession the earliest wins and the rest are unreachable.
 *
 * ► **THE AI RANKS WHERE THE BUILD SEQUENCES, and this order is what it breaks
 *   ties with.** Priced at their means the five are 450, 300, 300, 150 and
 *   120 — monotone along the ladder, with ONE tie (the frightning bolt and the
 *   hell fireball, both 300) which the ladder settles for 35. So among the
 *   spells alone the pricing reproduces the ladder exactly; where it departs
 *   from the build is against a SWING, which the build never compares.
 */
export const SS2_DAMAGE_SPELL_LADDER = Object.freeze([
  Ss2ActionType.CAST_DIRE_FIREBALL,
  Ss2ActionType.CAST_FRIGHTNING_BOLT,
  Ss2ActionType.CAST_HELL_FIREBALL,
  Ss2ActionType.CAST_LIGHTNING_BOLT,
  Ss2ActionType.CAST_FIREBALL
]);

/** The bolt or fireball row for an action type, or undefined. The AI prices both alike. */
function ss2DamageSpell(type) {
  return SS2_BOLT_SPELLS[type] ?? SS2_FIREBALL_SPELLS[type];
}

/* ------------------------------------------------------------------ */
/* Molten death: N boulders, N ingress calls, and every one lands       */
/* ------------------------------------------------------------------ */

/**
 * `cast_death_from_above` ("Molten Death", inventory id 49), read 2026-09-22
 * from `sprite:862[overlay]/frame:52/DoAction@0x240c7f` (block base
 * `0x240c85`), `+0x862f`-`+0x895c`:
 *
 * ```text
 *   phase_decision == "cast_death_from_above"                       +0x8635
 *     register:3.crowd_action = 20                                  +0x8642
 *     game_attacker.staminacost = Math.round(game_attacker.magicka) +0x864f-+0x8675
 *     if (attacker.struck == null) {                                +0x8676-+0x8688
 *       cast_spell_icon(attacker, 49)                               +0x868d
 *       boulder_stones = randomBetween(10, 20)                      +0x86a5
 *       lightning_frame = 1                                         +0x86be
 *       attacker.struck = false; attacker.gotoAndPlay("Cast2")      +0x86ca-+0x86ec
 *       for (i = 1; !(i > boulder_stones); i++) {                   +0x86ed-+0x88fe
 *         boulder = arena.gladiators.attachMovie("boulder_combat",
 *             "boulder_combat" + i, depth, {_x: defender._x, _y: -600})  +0x870f-+0x8774
 *         boulder._x = boulder._x + randomBetween(-300, 300)        +0x878b
 *         boulder._y = randomBetween(-600, -800)                    +0x87a9
 *         boulder.yspeed = randomBetween(50, 150)                   +0x87c8
 *         boulder._xscale = boulder._yscale = randomBetween(50, 100) +0x87f1
 *         boulder.cacheAsBitmap = true                              +0x8813
 *         boulder.onEnterFrame = function () {                      +0x882f
 *           if (!(this._y > 150)) this._y += this.yspeed            +0x883a-+0x8868
 *           if (this._y > 150 && this.bounced != true) {            +0x8869-+0x8893
 *             bounced = true; cacheAsBitmap = false; gotoAndStop(4) +0x8898-+0x88c0
 *             magic_damage_character(defender, attacker, game_defender,
 *                 game_attacker, "burning", 4, 40)                  +0x88c1-+0x88ef
 *           }
 *         }
 *       }
 *     }
 *     if (defender.struck == true) {                                +0x8903-+0x8916
 *       bolt.removeMovieClip(); attacker.struck = null;
 *       defender.struck = null; nextphase()                         +0x891b-+0x895c
 *     }
 * ```
 *
 * ► **`1 + 4N` SAMPLES, ALL AT THE CAST, and not one is an attack roll.** The
 *   count, then for each boulder in `i` order its x offset, start height,
 *   speed and scale. No `checkattackroll`, no `RandomNumber`, no direction.
 *   The four per-boulder draws decide only where and when it lands — the
 *   presentation's — but they are real draws on this engine's ordered channel,
 *   in the build's order, or a peer replaying the tape falls out of step.
 *
 * ► **EVERY BOULDER LANDS, AND EVERY LANDING IS THE SAME CALL.** The closure
 *   reads its own `_y`, `yspeed` and `bounced` and nothing else — no `_x`, no
 *   `hitTest`, no removal — so each boulder falls until `_y` passes 150 and
 *   then calls the ingress ONCE with the literal 40 (`bounced` is the
 *   idempotence guard, the fireball's frame-4 test in another spelling). The
 *   outcome is therefore N sequential ingress calls of 40 on the same two
 *   records, whatever the placement draws said, and a discrete turn can hold
 *   it: this resolves the whole shower at once and carries each boulder's
 *   numbers on the event for a renderer.
 *
 * ► **THE START-HEIGHT DRAW HAS ITS BOUNDS REVERSED, AND THE RANGE BELOW IS
 *   WHAT IT REACHES, NOT WHAT IT SAYS.** `+0x87a9` is `Push "_y", -800, -600,
 *   2, "randomBetween"`; `CallFunction` pops the first argument off the top,
 *   so this is `randomBetween(-600, -800)` — every other call in the arm pushes
 *   its high bound first (`20, 10` `+0x86a5`; `300, -300`; `150, 50`;
 *   `100, 50`), and the map and the brief this was built from both read it as
 *   `(-800, -600)`. The build's formula, `floor(Math.random() * (b - a + 1)) +
 *   a` (map §"RNG surface"), gives `-600 + floor(r * -199)`: -601..-799
 *   uniformly, and -600 only when `Math.random()` returns exactly 0. This
 *   channel refuses `max < min`, so the draw is stated low-first as
 *   `[-799, -601]` — the same 199 values with the same weights. **A tape
 *   transcribed from a capture that records the call's own `(a, b)` must map
 *   `(-600, -800)` to this.** It moves only the landing frame, which is
 *   therefore 6..19, not 6..20.
 *
 * ► **"burning" IS THE VICTIM'S CLIP, as for the fireballs.** Every landing
 *   calls `defenderClip.gotoAndPlay("burning")`, restarting the burn cycle
 *   (2 + 15 + 15 frame slots, `hero_battle` 1947-1963) and setting no status
 *   flag. Without a kill the teardown waits on the victim's `struck == true`,
 *   which the END of that cycle writes (frame 1963, `burncycle >= 2`), and
 *   every landing restarts it — so the burn cannot release the phase before
 *   the last boulder lands, all of which land inside frames 6..19.
 *
 *   ► ~~**UNRESOLVED, AND NOT BUILT: `defender.struck` MAY ALREADY BE `true`.**~~
 *     **RESOLVED 2026-09-22, and the paragraph below is kept as the question
 *     it was.** The route it names cannot happen: the bolt's teardown
 *     `nextphase` runs `changeCombatants`, which sends BOTH fighters to
 *     `Standing` in the same straight-line run, before `Cast2` reaches frame
 *     2146 (`derive:dfa-struck`, refuter CONFIRMED). A stale `struck`
 *     survives only a WALL-CLAMP cut, which nulls no `struck`
 *     (`derive:arena-wall`) — and the owner chose not to reproduce the wall
 *     cuts (`SS2_ARENA.clamp`). So for everything this engine models, every
 *     boulder lands on the chosen target.
 *     The gate reads the VICTIM's flag, and nothing between phases resets it —
 *     every `struck = null` in the overlay block is a phase teardown or the
 *     watchdog (`+0x3871`). The victim's OWN last clip can write it after its
 *     own phase tore down: a bolt's caster's `Cast2` reports 6 frames after
 *     the bolt's teardown (see `SS2_BOLT_SPELLS`). A molten death cast at that
 *     gladiator next would then tear down on its first tick, or mid-fall,
 *     before the boulders land — and they land on whoever `defender` is
 *     after `nextphase`. Whether that happens is a question of cross-phase
 *     timing no dump read here settles; this engine resolves every boulder
 *     on the chosen target.
 *
 * ► **ON A KILL THE REST OF THE SHOWER STILL LANDS, ON THE DEAD.** The killing
 *   call runs `death()`, which deletes BOTH FIGHTERS' `onEnterFrame` — the
 *   caster's holds this arm, so the teardown never runs — and `nextphase`
 *   (`+0x202f`-`+0x204f`), so the cost is never spent: this engine's existing
 *   kill rule. It does not touch the boulders' own handlers, so every boulder
 *   still to land calls the ingress on the same defender and re-enters
 *   `death()`. On a body at 0 hitpoints and 0 armour that is: no armour, the
 *   hitpoints to -40 and `check_stats` back to 0, `psyche_up = 1` again, and
 *   the breastplate stamina join — which does move the dead body's
 *   `staminaleft`, clamped. Reproduced, and recorded per hit (`afterDeath`);
 *   none of it can reach a living combatant.
 *
 * ► **ONE `defender` FOR THE WHOLE SHOWER.** The closure reads the timeline's
 *   `defender` when it LANDS, not when it was dropped; this engine holds the
 *   one chosen target throughout, which is what the build does whenever the
 *   phase has not advanced — and the burn cannot advance it before the last
 *   landing (a kill never advances it at all; the unresolved case above is
 *   the one way it might).
 *
 * ► **TWO COPY-PASTE LEFTOVERS, KEPT OUT.** `lightning_frame = 1` (`+0x86be`)
 *   is the bolt arm's variable, written and never read here; the teardown's
 *   `bolt.removeMovieClip()` (`+0x892b`) removes whatever lightning bolt the
 *   last bolt cast left behind. Neither moves a number.
 */
export const SS2_DEATH_FROM_ABOVE = Object.freeze({
  /** `cast_spell_icon(attacker, 49)` `+0x868d`; ladder arm 7, `check_inventory(49)` `+0x0855`. */
  itemId: 49,
  /** Arm 7 of `villain_cast_spells`, whose ONLY test is possession. */
  ladderArm: 7,
  /**
   * `boulder_stones = randomBetween(10, 20)`, `+0x86a5`. The tape label is
   * INVENTED, in the shape of the weaken-armour and debris labels.
   */
  boulderCount: Object.freeze({ low: 10, high: 20, rollLabel: "death-from-above-boulder-count" }),
  /**
   * The four draws each boulder takes, IN THE BUILD'S ORDER. Boulder `i`'s
   * tape label is `${boulderRollPrefix}-${i}-${labelSuffix}` (INVENTED), `i`
   * running 1..N as the build's loop variable does.
   */
  boulderRolls: Object.freeze([
    /** `_x = defender._x + randomBetween(-300, 300)`, `+0x878b`. */
    Object.freeze({ field: "xOffset", labelSuffix: "x", low: -300, high: 300 }),
    /** `_y = randomBetween(-600, -800)`, `+0x87a9` — REVERSED in the build; this is what it reaches. */
    Object.freeze({ field: "y0", labelSuffix: "y", low: -799, high: -601 }),
    /** `yspeed = randomBetween(50, 150)`, `+0x87c8`. */
    Object.freeze({ field: "ySpeed", labelSuffix: "yspeed", low: 50, high: 150 }),
    /** `_xscale = _yscale = randomBetween(50, 100)`, `+0x87f1` — one draw, two writes. */
    Object.freeze({ field: "scale", labelSuffix: "scale", low: 50, high: 100 })
  ]),
  boulderRollPrefix: "death-from-above-boulder",
  /** The closure's `_y > 150` (`+0x8871`), strict. */
  groundY: 150,
  /** `Push 40, 4, "burning"` at `+0x88c1`: a LITERAL, the same for every boulder. */
  damagePerBoulder: 40,
  damageMethod: "burning",
  bonusFrame: 4,
  /** `attacker.gotoAndPlay("Cast2")`, `+0x86d8` — the bolts' clip, not the fireballs' `Cast1`. */
  casterClip: "Cast2",
  /**
   * `register:3.crowd_action = 20`, `+0x8642` — ~~Presentation cue; not
   * modelled.~~ **MODELLED 2026-09-22**: `register:3` is `_global`, and `nextphase`
   * adds this to the battle's one `crowd_interest` (`src/team/ss2-crowd.js`).
   */
  crowdAction: 20
});

/** Boulder `index`'s tape label for one of `SS2_DEATH_FROM_ABOVE.boulderRolls`. */
export function ss2DeathFromAboveRollLabel(index, roll) {
  return `${SS2_DEATH_FROM_ABOVE.boulderRollPrefix}-${index}-${roll.labelSuffix}`;
}

/**
 * The invocation of a boulder's own `onEnterFrame` on which it lands: the
 * first `k` with `y0 + k * ySpeed > 150`, strict — so a fall that reaches
 * EXACTLY 150 lands one frame later. Counted from the boulder's first
 * `onEnterFrame`, which is presentation's business to place relative to the
 * cast; nothing a peer hashes reads it. A boulder already below the line
 * lands on its first invocation (unreachable: `y0` is at most -601).
 */
export function ss2BoulderLandingFrame(y0, ySpeed) {
  return Math.max(1, Math.floor((SS2_DEATH_FROM_ABOVE.groundY - y0) / ySpeed) + 1);
}

/**
 * The molten-death option `chooseAiAction` takes, or null when none is on
 * offer: the one aimed at the most wounded foe, by the `byHealthThenId` order
 * the AI's own `target` uses. INVENTED above 1v1 — the build has one
 * `defender` — and exactly the build's at 1v1, where there is one option.
 */
function ss2DeathFromAboveChoice(view, options) {
  const offered = options.filter((option) => option.type === Ss2ActionType.CAST_DEATH_FROM_ABOVE);
  if (offered.length === 0) return null;
  for (const foe of [...view.foes].sort(byHealthThenId)) {
    const option = offered.find((entry) => entry.targetId === foe.id);
    if (option) return option;
  }
  return offered[0];
}

/* ------------------------------------------------------------------ */
/* The gale phase: a spell that moves a body and hurts nobody           */
/* ------------------------------------------------------------------ */

/**
 * `cast_gale`, byte-derived 2026-09-19 and re-read 2026-09-22 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f` (block base `0x240c85`),
 * `+0x7aaa`-`+0x7be5`:
 *
 * ```text
 *   phase_decision == "cast_gale"                                  +0x7aaa
 *     register:3.crowd_action = 2                                  +0x7abd
 *     game_attacker.staminacost = Math.round(game_attacker.magicka) +0x7ad0
 *     if (attacker.shove != true) {                                +0x7af1
 *       cast_spell_icon(attacker, 38)                              +0x7b0a
 *       attacker.shove = true                                      +0x7b22
 *       attacker.gotoAndPlay("Cast1")                              +0x7b30
 *       if (attacker.gladiator_dir == "right") force = 1000        +0x7b45, +0x7b5d
 *       else                                   force = -1000       +0x7b6d
 *       defender.gotoAndPlay("knockback")                          +0x7b78
 *       knockback(defender, force)                                 +0x7b8c-+0x7ba2
 *     }
 *     if (attacker.struck == true) {                               +0x7ba4
 *       attacker.struck = null; attacker.shove = null; nextphase() +0x7bd6
 *     }
 * ```
 *
 * ► **ZERO SAMPLES AND ZERO DAMAGE.** No `randomBetween`, `RandomNumber`,
 *   `checkattackroll` or `hitpoints` anywhere in the arm, and
 *   `knockback(whichcharacter, force)` (`+0x1dd3`, 155 bytes) is one
 *   `mx.transitions.Tween` of `_x` from `_x` to `_x + force` over one second
 *   with no comparison in it. So it returns before `ATTACK_BANDS`, as `shove`
 *   does, and for the same tape reason.
 *
 * ► **THE SIGN IS THE CASTER'S FACING**, the shove's and the taunt's rule and
 *   the opposite of `damagecharacter`'s. `Equals2; Not; If` at `+0x7b56`-`+0x7b58`
 *   jumps to the `-1000` store at `+0x7b6d` whenever the facing is NOT
 *   `"right"`; this engine's facing is two-valued (`SS2_FACING_LEFT` or its
 *   absence), so the build's "anything else" arm and its left arm coincide.
 *
 * ► **FLAT ±1000 WITH NO FLOOR AND NO ANIMATION GATE** — the only one of the
 *   four `knockback` sites with either property (map §"`knockback(whichcharacter,
 *   force)`, decoded"). The `knockback` clip at `+0x7b78` sits after the
 *   if/else join (`+0x7b68` jumps to it) and inside no force test, so it plays
 *   on every cast, including one the wall swallows whole.
 *
 * ► **THE BOUND IS THE CLIP CLAMP, NOT `knockback`**, exactly as for `shove`;
 *   see `SS2_ARENA.clamp`.
 *
 * ► **IT REUSES `attacker.shove` AS ITS LATCH** (`+0x7af1`, `+0x7b22`,
 *   `+0x7bcf`) and completes on the CASTER's `struck` (`+0x7ba4`), unlike the
 *   bolts' `defender.struck`. Neither is modelled: this engine completes every
 *   phase within the action, and `src/adapter/action-gate.js` would be the
 *   consumer of the difference.
 *
 * ► **THE COST IS `round(magicka)`, THE STAT, WITH NO AFFORDABILITY CHECK**,
 *   the bolts' shape exactly. The item row prices gale at 4
 *   (`root/frame:35` `+0x4f42`); the phase does not read that number.
 *
 * ► **THE OFFER IS POSSESSION, AND `fightdistance` IS NOT PART OF IT.** The
 *   five-condition gate — a 90% roll (`+0x056f`), 23 preceding ladder arms,
 *   `check_inventory(38)` (`+0x0e2e`), `_root.arena.fightdistance < 400`
 *   (`+0x0e4c`-`+0x0e62`) and `villain.armourclass < villain.armourclass_max / 2`
 *   (`+0x0e6b`-`+0x0e9c`) — is `villain_cast_spells`, the villain AI's
 *   DECISION, which `villainChooseAction` calls last to replace its own. The
 *   hero's inventory button (`sprite:862[overlay]/frame:1`, `+0x05ca`-`+0x0638`
 *   for slot 1 and five more) tests only `inv_struck != true`. So
 *   `legalActions` offers on possession and `chooseAiAction` reads the
 *   villain's conditions; see both.
 */
export const SS2_GALE = Object.freeze({
  /** `cast_spell_icon(attacker, 38)` `+0x7b0a`, `check_inventory(38)` `+0x0e2e`, row `inventory38`. */
  itemId: 38,
  /** `Push "force", 1000` `+0x7b5d` / `Push "force", -1000` `+0x7b6d`. The magnitude. */
  force: 1000,
  /** `attacker.gotoAndPlay("Cast1")`, `+0x7b30`. */
  casterClip: "Cast1",
  /** `defender.gotoAndPlay("knockback")`, `+0x7b78` — unconditional. */
  victimClip: "knockback",
  /**
   * The VILLAIN's distance gate, `fightdistance < 400` (`+0x0e5a`, `Less2`),
   * read by `chooseAiAction` and by nothing else. Strict.
   */
  aiFightDistanceBelow: 400
});

/* ------------------------------------------------------------------ */
/* The command phase: a spell that pulls a body, forty units a frame   */
/* ------------------------------------------------------------------ */

/** `demand_move = 1`, `nextphase` step 2 (`+0x3266`). */
const SS2_DEMAND_MOVE_RESET = 1;
/** `demand_move >= 60` (`+0x37f5`, `Less2; Not`), the stall watchdog's grounded clause. */
const SS2_DEMAND_MOVE_TRIP = 60;

/**
 * `cast_command`, byte-derived 2026-09-22 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f` (block base `0x240c85`),
 * `+0x7be6`-`+0x7db6` — inside `attacker.onEnterFrame` (the function defined
 * at `+0x36ae`), so the WHOLE arm runs once per frame:
 *
 * ```text
 *   phase_decision == "cast_command"                                +0x7be6
 *     register:3.crowd_action = 2                                   +0x7bf9
 *     game_attacker.staminacost = Math.round(game_attacker.magicka) +0x7c06
 *     if (attacker.shove != true) {                                 +0x7c2d
 *       cast_spell_icon(attacker, 39)                               +0x7c46
 *       defender.gotoAndPlay("knockback_mov")                       +0x7c5e
 *       attacker.shove = true                                       +0x7c73
 *       attacker.gotoAndPlay("Cast2")                               +0x7c81
 *     }                                                  // no Jump: falls through
 *     if (attacker.gladiator_dir == "right") {                      +0x7c96
 *       defender._x -= 40                                           +0x7cae
 *       if (!(defender._x > attacker._x + game_defender.physical_size)) +0x7cf1
 *         { attacker.struck = null; attacker.shove = false; nextphase() }
 *     } else if (attacker.gladiator_dir == "left") {                +0x7d29
 *       defender._x += 40                                           +0x7d41
 *       if (!(defender._x < attacker._x - game_defender.physical_size)) +0x7d84
 *         { attacker.struck = null; attacker.shove = false; nextphase() }
 *     }                                                             ..+0x7db6
 * ```
 *
 * ► **ZERO SAMPLES, ZERO DAMAGE, NO `knockback()` CALL, AND NOTHING WRITTEN ON
 *   `game_defender`.** The only reads of the victim's stat object are its
 *   `physical_size`. So it returns before `ATTACK_BANDS`, as the gale does.
 *
 * ► **THE CLOSED FORM.** With `S` the TARGET's `physical_size` and the caster
 *   facing right, the target moves `-40` a frame and the phase completes on
 *   the first frame it is no longer beyond `caster.x + S`:
 *   `k = max(1, ceil((target.x - caster.x - S) / 40))` frames, landing at
 *   `target.x - 40k`. Facing left is the mirror. The `max(1, …)` is the
 *   missing `Jump`: the entry frame moves the body before it tests anything.
 *
 * ► **THE TARGET MOVES OPPOSITE TO THE CASTER'S FACING, NOT "TOWARD THE
 *   CASTER".** The branch reads only `gladiator_dir`. In front, that is a pull;
 *   BEHIND the caster the first frame's test already passes, so a target
 *   behind is pushed 40 further AWAY and the phase ends.
 *
 * ► **A TARGET INSIDE THE STAND-OFF STAYS IN FRONT.** `S >= 80`
 *   (`ss2PhysicalSize`), so a target that starts `g <= S` in front moves once,
 *   to `g - 40` — behind the caster only when `g < 40`. *(The brief this was
 *   built from said "inside 40 px of the stand-off ends up BEHIND the caster";
 *   that is false, and a write-nothing verifier broke it independently.)*
 *
 * ► **THE STALL WATCHDOG CUTS A LONG PULL, and the cap is derived, not
 *   chosen.** `nextphase` sets `demand_move = 1` (`+0x3266`); every
 *   `onEnterFrame` increments it (`+0x37e5`) and tests
 *   `(demand_move >= 60 && attacker._y >= attacker.grounded && bullet_in_air
 *   != true) || demand_move >= 200` (`+0x37ef`-`+0x384e`) BEFORE it reaches
 *   the arm. Frame `f` of the phase sees `1 + f`, so frame 59 calls
 *   `nextphase()` (`+0x38a0`) before its pull runs: **58 pulls, 2,320 units.**
 *   Inside the ±2100 clamp a pull can need 103, so the cap binds. The cut
 *   still runs `nextphase`, so the cost is spent the same.
 *   - **ASSUMED, NAMED: the 60 clause, not the 200.** A standing caster passes
 *     `_y >= grounded` (and `grounded` is null outside a jump, which passes
 *     too); `bullet_in_air` is written true by the shot arms and false at
 *     impact. A bullet a previous phase never cleared would lift the cap to
 *     198. This engine has no such state.
 *   - **NOT MODELLED, NAMED: ONE FRAME MORE after a phase the watchdog
 *     ended.** The watchdog's `nextphase` runs BEFORE the per-frame
 *     `phase_decision` refresh (`+0x3a84`), so the NEXT phase's first pull
 *     runs in the same frame at `demand_move == 1` and gets 59. This engine
 *     does not carry which way the previous phase ended.
 *   - **NOT MODELLED, NAMED: THE LATCH LEAK.** The watchdog nulls both
 *     fighters' `struck` and `grounded` (`+0x385e`-`+0x3891`) but never
 *     `attacker.shove`, so a cut command leaves the caster's latch set: its
 *     next shove, gale or command skips its entry block (a gale then never
 *     calls `knockback` and waits on a `struck` nothing will set).
 *
 * ► **NOT MODELLED, NAMED: THE SUB-100 NUDGE.** `attacker.onEnterFrame`'s
 *   first act (`+0x36b9`-`+0x37c8`) separates hero and villain by 1 each per
 *   frame while `fightdistance < 100` — see `ss2WalkDisplacement`'s note on
 *   the same precondition. A pull's last frame or two can fall inside 100,
 *   which can move the landing by a unit or two and, at an exact multiple,
 *   the frame count by one. The resolver has no frames; the closed form is
 *   the arm's own.
 *
 * ► **THE BOUND IS THE CLIP CLAMP.** The arm clamps nothing; ~~`defender._x` is
 *   clamped to ±2100 at the top of the next `onEnterFrame` (`+0x3a07`-
 *   `+0x3a5e`, no `nextphase` on that side)~~ **— WRONG SIDE, corrected
 *   2026-09-22 (`derive:arena-wall`, refuter CONFIRMED): the command's
 *   completion `nextphase` swaps the roles, so on the next frame the target is
 *   `attacker`, and the ATTACKER-side clamp calls `nextphase()` before its arm:
 *   at `battle_action` 1 the target loses its phase; at 2 nothing clamps until
 *   the next round's first frame, where the same clamp cuts its chosen action.
 *   This engine clamps the target and lets it act — the owner's decision
 *   2026-09-22, see `SS2_ARENA.clamp`.** Only the push-behind case can reach a
 *   wall.
 *
 * ► **THE COST IS `round(magicka)`, THE STAT, WITH NO AFFORDABILITY CHECK**,
 *   the gale's and the bolts' shape exactly.
 *
 * ► **THE OFFER IS POSSESSION.** `fightdistance > 300` is ladder arm 25 of
 *   `villain_cast_spells` (`+0x0ec2`-`+0x0f17`), the villain AI's DECISION;
 *   the arm reads no distance and the hero's inventory button tests only
 *   `inv_struck`. See `legalActions` and `chooseAiAction`.
 */
export const SS2_COMMAND = Object.freeze({
  /** `cast_spell_icon(attacker, 39)` `+0x7c46`, `check_inventory(39)` `+0x0ec2`. */
  itemId: 39,
  /** `Push 40; Subtract` `+0x7cc2` / `Push 40; Add2` `+0x7d55` — units per frame. */
  pullStep: 40,
  demandMoveReset: SS2_DEMAND_MOVE_RESET,
  watchdogTrip: SS2_DEMAND_MOVE_TRIP,
  /**
   * The most frames a pull runs before the watchdog ends the phase — DERIVED:
   * frame `f` sees `demandMoveReset + f` after the increment, the trip lands on
   * frame `watchdogTrip - demandMoveReset`, and that frame's pull never runs.
   */
  pullTickCap: SS2_DEMAND_MOVE_TRIP - SS2_DEMAND_MOVE_RESET - 1,
  /** `attacker.gotoAndPlay("Cast2")`, `+0x7c81`. */
  casterClip: "Cast2",
  /** `defender.gotoAndPlay("knockback_mov")`, `+0x7c5e` — inside the latch, so once. */
  victimClip: "knockback_mov",
  /**
   * `register:3.crowd_action = 2`, `+0x7bf9` — ~~Presentation cue; not
   * modelled.~~ **MODELLED 2026-09-22**: `register:3` is `_global`, and `nextphase`
   * adds this to the battle's one `crowd_interest` (`src/team/ss2-crowd.js`).
   */
  crowdAction: 2,
  /**
   * The VILLAIN's distance gate, `fightdistance > 300` (`+0x0eee`, `Greater`),
   * read by `chooseAiAction` and by nothing else. Strict.
   */
  aiFightDistanceAbove: 300
});

/**
 * The pull, frame by frame exactly as the arm runs it: move, then test, up to
 * the watchdog's cap. A loop rather than the closed form so that the
 * arithmetic is the build's own (repeated `±40` against one comparison) and not
 * an algebraic rearrangement of it; the closed form is pinned in the tests.
 *
 * `facingLeft` is this engine's two-valued facing, so the build's "neither
 * right nor left" arm — which moves nothing and never completes — cannot occur.
 */
function ss2CommandPull({ casterX, targetX, facingLeft, standOff }) {
  let x = targetX;
  for (let tick = 1; tick <= SS2_COMMAND.pullTickCap; tick += 1) {
    if (facingLeft) {
      x += SS2_COMMAND.pullStep;
      if (!(x < casterX - standOff)) return { to: x, ticks: tick, cut: false };
    } else {
      x -= SS2_COMMAND.pullStep;
      if (!(x > casterX + standOff)) return { to: x, ticks: tick, cut: false };
    }
  }
  return { to: x, ticks: SS2_COMMAND.pullTickCap, cut: true };
}

/* ------------------------------------------------------------------ */
/* The teleport phase: a spell that moves its caster and nobody else   */
/* ------------------------------------------------------------------ */

/**
 * `cast_teleport`, byte-derived 2026-09-22 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f` (block base `0x240c85`),
 * `+0x7541`-`+0x76ad`:
 *
 * ```text
 *   phase_decision == "cast_teleport"                              +0x7541
 *     register:3.crowd_action = 3                                  +0x7554
 *     game_attacker.staminacost = Math.round(game_attacker.magicka) +0x7561
 *     if (attacker.struck == null) {                               +0x7588
 *       cast_spell_icon(attacker, 48)                              +0x759f
 *       arena.gladiators.attachMovie("circlets", "circlets",
 *         getNextHighestDepth(), { _x: attacker._x, _y: 200 })     +0x75b7-+0x7610
 *       attacker.struck = false                                    +0x7612
 *       attacker.gotoAndPlay("Cast2")                              +0x7620
 *     }
 *     combatscale()                                                +0x7635
 *     if (attacker.struck == true) {                               +0x7646
 *       attacker._x = randomBetween(-2000, 2000)                   +0x765e-+0x767b
 *       attacker.gotoAndPlay("Cast2")                              +0x767c
 *       attacker.struck = null                                     +0x7691
 *       nextphase()                                                +0x769e
 *     }
 * ```
 *
 * ► **ONE SAMPLE, AND IT IS WHERE THE CASTER LANDS.** The only
 *   `randomBetween` in the arm is at `+0x7664`, inside the completion gate —
 *   the `struck == true` test runs in the same tick as the entry block, after
 *   `struck = false`, so it can never fire on the entry tick, and the build
 *   takes exactly one draw per completed cast. Push order `"_x", 2000, -2000,
 *   2`: the argument pushed last before the count is the first, so the call is
 *   `randomBetween(-2000, 2000)`, inclusive at both ends (the map's RNG
 *   surface). **The result is STORED by `SetMember`, not added** — the
 *   destination is absolute, whatever `_x` was.
 *
 * ► **NO `_y` WRITE, NO FACING WRITE, NO CLAMP, AND NO `defender`.** The arm
 *   references `attacker` and `game_attacker` only. Facing is re-derived by
 *   `changeCombatants` at the phase advance, as for every move; the bound that
 *   applies is the clip clamp in `attacker.onEnterFrame` (`SS2_ARENA.clamp`,
 *   ±2100), which is WIDER than the draw on both sides and so cannot bind.
 *   *(Mechanism corrected 2026-09-22, `derive:arena-wall`: after the completion
 *   `nextphase` the caster is `defender`, or no handler runs at all, so only
 *   the DEFENDER side could act on the landing — and neither binds.)*
 *
 * ► **THE COST IS `round(magicka)`, THE STAT, WITH NO AFFORDABILITY CHECK**,
 *   the bolts' and the gale's shape exactly.
 *
 * ► **TWO PRESENTATION CUES, NEITHER MODELLED, BOTH NAMED.** `circlets` is
 *   attached at the caster's STARTING `_x` and `_y = 200`; this repository has
 *   not extracted that prop, and the arena painter draws every
 *   `attach-effect` as a lightning bolt, so no command is emitted for it.
 *   `combatscale()` — the build's live camera — is called EVERY tick of this
 *   arm (`+0x7635`, outside both gates); `gladiators.onEnterFrame` calls it
 *   too, but only while `_global.phasecomplete != false` (map `+0x0e98`). So
 *   the build's camera keeps following the fight through a teleport whatever
 *   that flag says. *(Whether any OTHER phase arm calls it was not checked:
 *   the dumps this derivation read are reference windows, not the whole
 *   block.)* This engine's viewport is its own.
 *
 * ► **THE SECOND `Cast2` IS NEVER SEEN.** It runs in the completion tick and
 *   `nextphase()` follows it in the same straight-line run; `nextphase`'s
 *   `battle_action < 3` arm calls `changeCombatants` (`+0x3638`, and the
 *   `battle_action == 3` turn end has its own call at `+0x365f`), which
 *   `gotoAndPlay("Standing")`s both fighters (`+0x27db`, `+0x27ef`) before the
 *   frame is drawn. *(Those offsets are the battle map's, and this derivation
 *   did not re-read them — nor whether `Cast2`'s first frame carries a script
 *   that the replaced `gotoAndPlay` would still queue.)* So on screen the
 *   caster plays ONE `Cast2` where it stood and reappears at the destination
 *   when that clip reports — which is the rule `figureXAt` draws.
 *
 * ► **THE ARM HAS NO `Jump`**, like the bolts': after `nextphase()` execution
 *   falls through into the `cast_adulation` test at `+0x76ae` and every later
 *   arm. Not expressible here, recorded for a frame-accurate port.
 *
 * ► **THE OFFER IS POSSESSION.** `fightdistance < 250` and
 *   `hitpoints < hitpointsmax / 2` are ladder arm 26 of `villain_cast_spells`
 *   (`+0x0f1c`-`+0x0fab`), the villain AI's DECISION; the hero's inventory
 *   button tests only `inv_struck`. See `legalActions` and `chooseAiAction`.
 */
export const SS2_TELEPORT = Object.freeze({
  /** `cast_spell_icon(attacker, 48)` `+0x759f`, `check_inventory(48)` `+0x0f1c`. */
  itemId: 48,
  /** `randomBetween(-2000, 2000)`, `+0x7664`. Inclusive, per the map's RNG surface. */
  destinationLow: -2000,
  destinationHigh: 2000,
  /** The tape label. INVENTED, in the shape of every other label here. */
  rollLabel: "teleport-destination-roll",
  /** `attacker.gotoAndPlay("Cast2")`, `+0x7620` (and `+0x767c`, never drawn). */
  casterClip: "Cast2",
  /**
   * `register:3.crowd_action = 3`, `+0x7554` — ~~Presentation cue; not
   * modelled.~~ **MODELLED 2026-09-22**: `register:3` is `_global`, and `nextphase`
   * adds this to the battle's one `crowd_interest` (`src/team/ss2-crowd.js`).
   */
  crowdAction: 3,
  /**
   * The VILLAIN's distance gate, `fightdistance < 250` (`+0x0f48`, `Less2`),
   * read by `chooseAiAction` and by nothing else. Strict.
   */
  aiFightDistanceBelow: 250
});

/* ------------------------------------------------------------------ */
/* The adulation phase: the crowd, and nothing else                    */
/* ------------------------------------------------------------------ */

/**
 * `cast_adulation` (item 47, "Magically charm the crowd"), byte-derived
 * 2026-09-22 from `sprite:862[overlay]/frame:52/DoAction@0x240c7f` (block base
 * `0x240c85`), `+0x76ae`-`+0x777b`, re-read by the implementer off the dump:
 *
 * ```text
 *   phase_decision == "cast_adulation"                               +0x76ae
 *     register:3.crowd_action = 50            (EVERY tick)            +0x76c1
 *     game_attacker.staminacost = Math.round(game_attacker.magicka)   +0x76ce
 *     if (attacker.struck == null) {                                  +0x76f5
 *       cast_spell_icon(attacker, 47)                                 +0x770c
 *       attacker.struck = false                                       +0x7724
 *       attacker.gotoAndPlay("wincrowd1")                             +0x7732
 *     }
 *     if (attacker.struck == true) {                                  +0x7747
 *       attacker.struck = null                                        +0x775f
 *       nextphase()                                                   +0x776c
 *     }
 * ```
 *
 * ► **ITS WHOLE EFFECT IS `crowd_action = 50`**, which `nextphase` adds into
 *   the battle's one `crowd_interest` (`register:3` is `_global`), clamped at
 *   100 — so from any crowd at or above 50 one cast maxes the purse's
 *   multiplier. It draws nothing (no `randomBetween`, no `RandomNumber`),
 *   references neither `defender` nor `game_defender`, and writes no stat,
 *   pool or position. See `src/team/ss2-crowd.js`.
 *
 * ► **THE COST IS `round(magicka)`, THE STAT, WITH NO AFFORDABILITY CHECK**,
 *   the bolts' and the teleport's shape exactly, and `nextphase` regenerates
 *   as for any completed phase. The completion test runs in the entry tick
 *   after `struck = false`, so it cannot fire on the entry tick.
 *
 * ► **NOT MODELLED, AND NAMED:** `cast_spell_icon`, and the arm's lack of a
 *   `Jump` (it falls through into the `cast_weaken_armour` test at `+0x777c`,
 *   which compares a different label).
 *
 * ► **THE OFFER IS POSSESSION.** `fightdistance > 300` is ladder arm 28 of
 *   `villain_cast_spells` (`DoAction@0x23e7cf`, base `0x23e7d5`,
 *   `+0x100a`-`+0x1040`), the LAST arm and the villain's DECISION, read by
 *   `chooseAiAction`:
 *
 *   ```text
 *     check_inventory(47) == true                                   +0x100a-+0x101f
 *     && _root.arena.fightdistance > 300                            +0x1028-+0x103e
 *     villaindecisionA = "cast_adulation"; use_item(item_used)      +0x1045-+0x105e
 *   ```
 */
export const SS2_ADULATION = Object.freeze({
  /** `cast_spell_icon(attacker, 47)` `+0x770c`; `check_inventory(47)` `+0x100a`. */
  itemId: 47,
  /** `attacker.gotoAndPlay("wincrowd1")`, `+0x7732`. No victim clip. */
  casterClip: "wincrowd1",
  /** `register:3.crowd_action = 50`, `+0x76c1` — `register:3` is `_global`. The verb's whole effect. */
  crowdAction: 50,
  /** `villain_cast_spells` arm 28, the last: `check_inventory(47) && fightdistance > 300`. */
  ladderArm: 28,
  /** `Push 300; Greater` at `+0x1036`-`+0x103e`. Strict. */
  aiFightDistanceAbove: 300
});

/* ------------------------------------------------------------------ */
/* The wincrowd phase: playing to the crowd                            */
/* ------------------------------------------------------------------ */

/**
 * `wincrowd`, byte-derived 2026-09-23 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f` (block base `0x240c85`),
 * `+0x4fc9`-`+0x513d`, re-read by the implementer off the dump against an
 * earlier derivation and its write-nothing verifier:
 *
 * ```text
 *   phase_decision == "wincrowd"                                     +0x4fc9-+0x4fd6
 *     register:3.crowd_action =
 *       Math.round(register:2.game.hero.charisma / 2)   (EVERY tick)  +0x4fdb-+0x500d
 *     game_attacker.staminacost = 3                                  +0x500e-+0x501e
 *     if (attacker.struck == null) {                                 +0x501f-+0x5031
 *       attacker.struck = false                                      +0x5036-+0x5043
 *       if (!(attacker.wincrowd_move > 0)
 *           || attacker.wincrowd_move == undefined)                  +0x5044-+0x5077
 *         attacker.wincrowd_move = 1 + RandomNumber(6)               +0x507c-+0x5093
 *       attacker.wincrowd_move = attacker.wincrowd_move + 1          +0x5094-+0x50b1
 *       if (attacker.wincrowd_move > 6) attacker.wincrowd_move = 1   +0x50b2-+0x50dd
 *       animstate = "wincrowd" + attacker.wincrowd_move              +0x50de-+0x50f0
 *       attacker.gotoAndPlay(animstate)                              +0x50f1-+0x5108
 *     }
 *     if (attacker.struck == true) {                                 +0x5109-+0x511c
 *       attacker.struck = null; nextphase()                          +0x5121-+0x513d
 *     }
 * ```
 *
 * ► **ITS WHOLE GAME EFFECT IS THE CROWD AND THE STAMINA.** No helper call,
 *   no `defender`, no `game_defender`, no `randomBetween`, no damage: the top
 *   write is the crowd delta (`ss2WincrowdCrowdAction`, where the owner's
 *   divergence below is recorded), `staminacost = 3` is spent by `nextphase`
 *   (`+0x32a1`, read at `+0x32bb`) with the ordinary regeneration, and the
 *   psyche counter is reset as for every phase that is not `psyche_up`
 *   (`+0x35c7`). **It cannot kill**, so `nextphase` always runs.
 *
 * ► **THE ONE DRAW IS THE `RandomNumber` OPCODE, AND IT PICKS A CLIP.** It is
 *   taken only on a fighter clip's FIRST wincrowd (`wincrowd_move` lives on the
 *   gladiator's clip instance, one counter per fighter), and every later one
 *   steps the counter by one, 1..6 and round again. So the first clip shown is
 *   `((r + 1) mod 6) + 1` for the draw `r` in 0..5, and then the six in order.
 *   This engine takes NO sample for it — see `ss2WincrowdClip` for the rule and
 *   what it gives up.
 *
 * ► **THE OFFER IS THE HERO'S BUTTON, ON ALL FOUR CONTROLLER FRAMES.** Every
 *   one of the eight menu branches (`sprite:862[overlay]` frames 5, 13, 20 and
 *   28, one branch per facing) wires `getphase("wincrowd")` on `optionG` or
 *   `optionH` and hides it with `if (_root.game.hero.herolevel < 3)
 *   option._visible = false` — `+0x095e`/`+0x0e12`, `+0x0785`/`+0x0bb1`,
 *   `+0x0928`/`+0x0e1d`, `+0x0951`/`+0x0d3a`. `Less2`, so the button shows AT
 *   3. **No stamina test and no range test**, on any frame. The villain has no
 *   level gate — it reaches the phase through its `choices` bands — and this
 *   engine applies the hero's gate to every seat, the owner's rule of
 *   2026-09-22 ("the hero's rule is the player's rule").
 *
 * ► **NOT MODELLED, NAMED:** the `animstate` `SetVariable` (a display
 *   variable nothing in the phase machine reads); and the `demand_move`
 *   watchdog, which fires at 60 ticks and so can end the 58-frame `wincrowd4`
 *   instead of its own `struck` — the accounting is identical either way, and
 *   that is not runtime-checked.
 */
export const SS2_WINCROWD = Object.freeze({
  /** Hidden when `herolevel < 3` (`Push 3; Less2`), so offered at 3 and above. */
  herolevelAtLeast: 3,
  /** `game_attacker.staminacost = 3`, `+0x5014`. A literal: no stat, no affordability test. */
  staminaCost: 3,
  /**
   * The six clips, IN THE BUILD'S CYCLE ORDER: `"wincrowd" + wincrowd_move`
   * (`+0x50de`) for `wincrowd_move` 1..6 — six because of `1 + RandomNumber(6)`
   * (`+0x5082`-`+0x5093`) and the wrap `> 6` -> 1 (`+0x50be`-`+0x50dd`). Listed
   * rather than assembled so the render coverage walk reaches all six.
   */
  clips: Object.freeze(["wincrowd1", "wincrowd2", "wincrowd3", "wincrowd4", "wincrowd5", "wincrowd6"])
});

/**
 * WHICH OF THE SIX CLIPS A `wincrowd` PLAYS — chosen WITHOUT A RANDOM NUMBER,
 * and the choice is AUTHORED presentation. No rule reads it; it travels on the
 * event, which the battle hash covers, so it must be a pure function of state.
 *
 * ► **THE BUILD:** one counter per fighter clip, `wincrowd_move`, drawn ONCE
 *   by the `RandomNumber(6)` opcode on that clip's first wincrowd
 *   (`+0x507c`-`+0x5093`) and then stepped by one on every wincrowd, 1..6 and
 *   round again (`+0x5094`-`+0x50dd`). So each fighter shows the six in order
 *   from a start of its own, and never the same clip twice running.
 *
 * ► **WHY NO SAMPLE:** the only RNG this engine has is the resolver's ordered
 *   channel, and that channel IS the wire format — a sample taken to pick an
 *   animation would move every peer's `rngCursor` for a choice no rule reads.
 *   It is `src/render/clip-effects.js`'s rule for `RandomNumber(n)` WITHOUT a
 *   random number, applied here: **the SPREAD is the build's (six clips, one
 *   start per fighter, a step of one), and the SOURCE is state every peer
 *   already hashes** — the fighter's id and the round number
 *   (`request.turnNumber`, which advances once per round). (The debris opcode
 *   draws inside `remove_armour` ARE taken on the channel — that is the golden
 *   attack path's shared arithmetic, left as it is; a clip pick has no such
 *   tie.)
 *
 * ► **THE RULE:** a start per fighter from `fnv1a(id)`, stepped one clip per
 *   ROUND. So wincrowds in consecutive rounds step one along the cycle exactly
 *   as the build's do, and each fighter keeps its own phase.
 *
 * ► **WHAT IT GIVES UP, NAMED:** the build steps once per WINCROWD, this once
 *   per ROUND — so two wincrowds rounds apart step by the gap rather than by
 *   one, and a wincrowd N rounds after another where N is a multiple of 6
 *   repeats its clip, which the build never does. And the start is a hash, not
 *   a uniform draw per battle: a fighter with the same id starts at the same
 *   clip in every bout.
 */
export function ss2WincrowdClip(actorId, turnNumber) {
  const { clips } = SS2_WINCROWD;
  const start = Number.parseInt(fnv1a(String(actorId)), 16) % clips.length;
  return clips[(((start + turnNumber) % clips.length) + clips.length) % clips.length];
}

/* ------------------------------------------------------------------ */
/* The weaken-armour phase: three removals, no roll to hit, no damage  */
/* ------------------------------------------------------------------ */

/**
 * `cast_weaken_armour`, byte-derived 2026-09-22 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f` (block base `0x240c85`),
 * `+0x777c`-`+0x78d9`:
 *
 * ```text
 *   phase_decision == "cast_weaken_armour"                         +0x7782
 *     register:3.crowd_action = 4                                  +0x778f
 *     game_attacker.staminacost = Math.round(game_attacker.magicka) +0x779c-+0x77c2
 *     if (attacker.struck == null) {                               +0x77c3-+0x77d5
 *       cast_spell_icon(attacker, 44)                              +0x77da
 *       attacker.struck = false                                    +0x77f2
 *       attacker.gotoAndPlay("Cast1")                              +0x7800
 *       attack_direction = 1 + RandomNumber(9)                     +0x7815-+0x7826
 *       remove_armour(game_defender, defender, attack_direction)   +0x7827-+0x7844
 *       attack_direction = 1 + RandomNumber(9)                     +0x7845-+0x7856
 *       remove_armour(game_defender, defender, attack_direction)   +0x7857-+0x7874
 *       attack_direction = 1 + RandomNumber(9)                     +0x7875-+0x7886
 *       remove_armour(game_defender, defender, attack_direction)   +0x7887-+0x78a4
 *     }
 *     if (attacker.struck == true) {                               +0x78a5
 *       attacker.struck = null; nextphase()                        +0x78bd-+0x78d9
 *     }
 * ```
 *
 * ► **THE DIRECTION IS THE ONE-BYTE `RandomNumber` OPCODE, NOT
 *   `randomBetween`.** `Push "attack_direction", 1, 9; RandomNumber; Add2`:
 *   the opcode pops 9 and yields 0..8, and `Add2` adds the 1 pushed beneath
 *   it, so directions 1-9 only (10-12, and the groups they carry, are
 *   unreachable from here). **On this engine's tape it is a `randomNumber`
 *   sample, `min 0, max 8`, and the direction is `1 + value`** — the same
 *   representation the attack path gives the debris opcode draws in
 *   `drawDebrisClip`. The capture wrapper replaces only `randomBetween`, so a
 *   live capture can neither record nor inject these three (battle map
 *   §"Spell-path reuse of `attack_direction`"); they are still part of this
 *   engine's own deterministic stream, and a peer replaying a tape must take
 *   them in order.
 *
 * ► **THE REMOVAL IS `remove_armour`, UNCHANGED, AND IT IS THE ATTACK PATH'S
 *   OWN CODE** — `removeSs2ArmourCandidate` in
 *   `src/golden/ss2-attack-candidate.js`, which calls the same
 *   `removeArmourCandidate` `damagecharacter` reaches. Per call: the group by
 *   direction ({1,5,8,9} helmet/shoulderguard, {2,4,6}
 *   breastplate/gauntlet/greaves, {3,7} shinguard/boot/shield), the selector
 *   `randomBetween(1, 2 | 3)` drawn BEFORE the piece test — so an unarmoured
 *   victim still costs it — then, only if the piece is worn, its `_defence`
 *   out of `armourclass` and `armourclass_max` once, its debris clips (two for
 *   a paired piece, one otherwise, three draws each), the id zeroed; and the
 *   trailing zero-clamp every time. **`<piece>_defence` is never written**, so
 *   a second pick of a destroyed piece finds the id 0 and does nothing but
 *   draw its selector.
 *
 * ► **NO HIT ROLL, NO DAMAGE, NO CLIP ON THE VICTIM, NO DEATH.** Nothing in
 *   the arm or in `remove_armour` reads or writes `hitpoints`, calls
 *   `checkattackroll`, or plays anything on `defender` (`remove_armour`
 *   attaches debris and re-attaches hair on the avatar's limbs, which is
 *   presentation). So `nextphase` always runs, and the cost is always spent.
 *
 * ► **THE COST IS `round(magicka)`, THE STAT, WITH NO AFFORDABILITY CHECK**,
 *   the bolts', the gale's and the teleport's shape exactly.
 *
 * ► **THE ARM HAS NO `Jump`**, like the teleport's: after `nextphase()` it
 *   falls through into the `cast_whirlwind` test at `+0x78da`. Not
 *   expressible here, recorded for a frame-accurate port.
 *
 * ► **THE OFFER IS POSSESSION.** `fightdistance < 300` is ladder arm 19 of
 *   `villain_cast_spells` (`DoAction@0x23e7cf` `+0x0c3f`-`+0x0c94`), the
 *   villain AI's DECISION, and it tests no armour on either side; the hero's
 *   inventory button tests only `inv_struck` (the gale's reading of
 *   `sprite:862[overlay]/frame:1`, which this derivation did not re-read).
 *   See `legalActions` and `chooseAiAction`.
 */
export const SS2_WEAKEN_ARMOUR = Object.freeze({
  /** `cast_spell_icon(attacker, 44)` `+0x77da`, `check_inventory(44)` `+0x0c3f`. */
  itemId: 44,
  /** THREE `attack_direction` / `remove_armour` pairs, `+0x7815`, `+0x7845`, `+0x7875`. */
  rounds: 3,
  /** `attack_direction = 1 + RandomNumber(9)`: the `1` pushed under the opcode's argument. */
  directionBase: 1,
  /** ...and the `9` the opcode pops, so the draw is 0..8 and the direction 1..9. */
  directionSpan: 9,
  /**
   * The tape label of round N's direction draw is `${directionRollPrefix}-${N}`.
   * INVENTED, in the shape of `armour-selection-N`, which the same round's
   * `remove_armour` draws next — and deliberately NOT the attack path's
   * `attack-direction-roll`, because this draw is a different source over a
   * different range and never reaches `checkattackroll`.
   */
  directionRollPrefix: "weaken-armour-direction",
  /** `attacker.gotoAndPlay("Cast1")`, `+0x7800`. */
  casterClip: "Cast1",
  /**
   * `register:3.crowd_action = 4`, `+0x778f` — ~~Presentation cue; not
   * modelled.~~ **MODELLED 2026-09-22**: `register:3` is `_global`, and `nextphase`
   * adds this to the battle's one `crowd_interest` (`src/team/ss2-crowd.js`).
   */
  crowdAction: 4,
  /**
   * The VILLAIN's distance gate, `fightdistance < 300` (`+0x0c6b`-`+0x0c73`,
   * `Less2`), read by `chooseAiAction` and by nothing else. Strict.
   */
  aiFightDistanceBelow: 300
});

/* ------------------------------------------------------------------ */
/* The potion phase: eight items, one label, and no roll at all         */
/* ------------------------------------------------------------------ */

/**
 * `drink_potion`, byte-derived 2026-09-22 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f` (block base `0x240c85`),
 * `+0x576d`-`+0x5dad`:
 *
 * ```text
 *   phase_decision == "drink_potion"                                   +0x5773
 *     register:3.crowd_action = -3                                     +0x577f
 *     game_attacker.staminacost = 0                                    +0x578c
 *     if (attacker.struck == null) {                                   +0x57a1
 *       attacker.struck = false                                        +0x57b8
 *       attacker.gotoAndPlay("drink_potion")                           +0x57c6
 *       attacker.potions.gotoAndPlay(game_attacker.inventory_action - 1) +0x57da
 *       if (inventory_action == 2) bonus = round(hitpointsmax * 0.25)  +0x5807
 *       if (inventory_action == 3) bonus = round(hitpointsmax * 0.5)   +0x58b7
 *       if (inventory_action == 4) bonus = round(hitpointsmax * 0.75)  +0x5967
 *       if (inventory_action == 5) bonus = hitpointsmax                +0x5a17
 *       if (inventory_action == 6) bonus = round(staminamax * 0.5)     +0x5aa9
 *       if (inventory_action == 7) bonus = round(staminamax)           +0x5b59
 *       if (inventory_action == 8) bonus = round(armourclass * 0.5)    +0x5bfc
 *       if (inventory_action == 9) bonus = round(armourclass_max)      +0x5cac
 *         ...each followed by `pool += bonus`, then
 *         bonus_icon = attacker.attachMovie("bonus_icon", "bonus_icon", 25001)
 *         bonus_icon.damage_splat.gotoAndStop(1 | 2 | 3)
 *         bonus_icon.bonus = "+ " + bonus
 *       check_flipping(bonus_icon, attacker)                           +0x5d4f
 *       check_stats(game_attacker)                                     +0x5d67
 *     }
 *     if (attacker.struck == true) { attacker.struck = null; nextphase() } +0x5d79
 * ```
 *
 * ► **ZERO SAMPLES.** No `randomBetween`, `RandomNumber` or `checkattackroll`
 *   anywhere in the arm — counted over its instructions `+0x576d`-`+0x5dad`,
 *   whose only calls are `Math.round` (seven times: every arm but id 5),
 *   `attachMovie`/`gotoAndStop`/`gotoAndPlay`, `check_flipping`, `check_stats`
 *   and `nextphase` — so it returns before `ATTACK_BANDS` as `shove` and
 *   `cast_gale` do. `check_stats` is a pure clamp (read in full);
 *   **`check_flipping`'s own body was not in the dumps this was derived
 *   from**, and rests on the map's call inventory for the spell ingress,
 *   which lists it among calls it states are RNG-free.
 *
 * ► **EIGHT INDEPENDENT `if`s, NOT AN ELSE-CHAIN**, each re-reading
 *   `inventory_action` with `GetMember`. The value does not change inside the
 *   arm, so exactly one fires; it is the bolt arm's shape again.
 *
 * ► **ID 8 READS THE CURRENT ARMOUR AND ID 5 IS NOT ROUNDED.** `+0x5c1f`
 *   pushes `armourclass`, not `armourclass_max`, so half of nothing is
 *   nothing and an unarmoured gladiator's oil does nothing; `+0x5a32` pushes
 *   `hitpointsmax` straight into `bonus` with no `Multiply` and no
 *   `Math.round`. Ids 7 and 9 ARE rounded but not multiplied. `multiplier:
 *   null` and `rounded` below say exactly which of the two operations each
 *   arm has.
 *
 * ► **THE BONUS IS WRITTEN UNCLAMPED AND THEN `check_stats` CLAMPS ALL THREE
 *   POOLS** (`+0x110a`-`+0x11ff`: `staminaleft` to `[0, staminamax]`,
 *   `hitpoints` to `[0, hitpointsmax]`, `armourclass` to
 *   `[0, armourclass_max]`), all before `nextphase` — so an overflowing drink
 *   is capped before the transition regenerates, and `bonus_icon` shows the
 *   UNCLAMPED number. See `ss2PotionOutcome`.
 *
 * ► **THE COST IS 0, AND THE TRANSITION IS AN ORDINARY ONE.** `staminacost =
 *   0` at `+0x578c`, then `nextphase`, so the drinker gets the normal
 *   regeneration and heal on top — computed from the POST-drink pools.
 *
 * ► **THE DRINKER'S OWN CLIP ENDS THE PHASE.** The gate is `attacker.struck`
 *   (`+0x5d79`), and the fighter clip's `drink_potion` label is frames
 *   1887-1910, whose last frame writes `this.struck = true; Stop`
 *   (`hero_battle/frame:1910/DoAction@0x3a0711`) — the gale's shape, not the
 *   bolt's. This engine completes every phase within the action;
 *   `src/adapter/action-gate.js` is what would consume the difference.
 *
 * ► **THE POTION IS SPENT BEFORE IT IS DRUNK, BY WHOEVER CHOSE IT.** The
 *   hero's click handler writes `inventory_action = inventoryN; inventoryN = 1`
 *   (`sprite:862[overlay]/frame:1` `+0x0601`/`+0x0626` for slot 1, five more
 *   the same); the villain's `use_item` writes `inventory_action` and empties
 *   the FIRST slot holding the id (`DoAction@0x23e7cf` `+0x03ec`/`+0x0409`).
 *
 * ► **NOT MODELLED, AND NAMED:** ~~`crowd_action = -3` (a crowd cue; the
 *   `register:3` gloss is the same unverified one `SS2_BOLT_INGRESS` names),~~
 *   **`crowd_action = -3` (`+0x577f`) IS MODELLED since 2026-09-22 — `register:3`
 *   is `_global`, and a drink costs the battle's crowd 3** (`src/team/ss2-crowd.js`);
 *   **the `potions` sub-clip frame** and **the `bonus_icon` splat** — both
 *   carried on the event (`potionFrame`, `bonusFrame`) and drawn by nothing
 *   yet, because the presentation vocabulary has no command for a sub-clip or
 *   a floating number. `check_flipping` is the splat's mirror and goes with it.
 */
export const SS2_POTIONS = Object.freeze({
  // `damage_splat.gotoAndStop(1)` for the four health arms (`+0x5888` …).
  2: Object.freeze({ stat: "hitpoints", of: "hitpointsmax", multiplier: 0.25, rounded: true, bonusFrame: 1 }),
  3: Object.freeze({ stat: "hitpoints", of: "hitpointsmax", multiplier: 0.5, rounded: true, bonusFrame: 1 }),
  4: Object.freeze({ stat: "hitpoints", of: "hitpointsmax", multiplier: 0.75, rounded: true, bonusFrame: 1 }),
  5: Object.freeze({ stat: "hitpoints", of: "hitpointsmax", multiplier: null, rounded: false, bonusFrame: 1 }),
  // `gotoAndStop(2)` for the two stamina arms (`+0x5b2a`, `+0x5bcd`).
  6: Object.freeze({ stat: "staminaleft", of: "staminamax", multiplier: 0.5, rounded: true, bonusFrame: 2 }),
  7: Object.freeze({ stat: "staminaleft", of: "staminamax", multiplier: null, rounded: true, bonusFrame: 2 }),
  // `gotoAndStop(3)` for the two armour arms (`+0x5c7d`, `+0x5d20`).
  8: Object.freeze({ stat: "armourclass", of: "armourclass", multiplier: 0.5, rounded: true, bonusFrame: 3 }),
  9: Object.freeze({ stat: "armourclass", of: "armourclass_max", multiplier: null, rounded: true, bonusFrame: 3 })
});

/**
 * Which ceiling `check_stats` clamps each pool to — the pairing in
 * `+0x110a`-`+0x11ff`, and the same pairing the villain ladder's `< max / 2`
 * tests use.
 */
const SS2_POOL_CEILING = Object.freeze({
  hitpoints: "hitpointsmax",
  staminaleft: "staminamax",
  armourclass: "armourclass_max"
});

/**
 * The villain ladder's POTION arms, in the build's own order, which is the
 * order the AI tries them.
 *
 * `villain_cast_spells` (`sprite:862[overlay]/frame:52/DoAction@0x23e7cf`,
 * block base `0x23e7d5`) tests each as `check_inventory(id) &&
 * villain.<pool> < villain.<ceiling> / 2` — `Push 2; Divide; Less2`, STRICT:
 *
 * ```text
 *   arm  2  id 5  hitpoints   < hitpointsmax    / 2   +0x060c-+0x065b
 *   arm  4  id 4  hitpoints   < hitpointsmax    / 2   +0x06f6-+0x0745
 *   arm  5  id 3  hitpoints   < hitpointsmax    / 2   +0x076b-+0x07ba
 *   arm  6  id 2  hitpoints   < hitpointsmax    / 2   +0x07e0-+0x082f
 *   arm 10  id 9  armourclass < armourclass_max / 2   +0x0944-+0x0993
 *   arm 11  id 8  armourclass < armourclass_max / 2   +0x09b9-+0x0a08
 *   arm 12  id 7  staminaleft < staminamax      / 2   +0x0a2e-+0x0a7d
 *   arm 13  id 6  staminaleft < staminamax      / 2   +0x0aa3-+0x0af2
 * ```
 *
 * Biggest first within each pool, and health before armour before stamina.
 * **Every one precedes the bolts (arms 15, 17) and the gale (24)**, so a
 * villain that qualifies for a potion drinks rather than casting.
 *
 * ► **THE ARMS BETWEEN THEM HAVE NO VERB HERE AND SO PRE-EMPT NOTHING** —
 *   the stance `chooseAiAction` already takes for the gale. Arm 1 (id 43
 *   `cast_rejuvinate`, `hitpoints < hitpointsmax / 1.5`), arm 3 (46
 *   `cast_regenerate`, `< / 2`), arm 7 (49 `cast_death_from_above`, NO extra
 *   condition — an absorbing sink that makes arms 8-28 unreachable), arms 8
 *   and 9 (42 `cast_colossus` at `fightdistance < 300`, 33
 *   `cast_little_fat_kid` at `< 500`). **A villain holding 49 never drinks an
 *   armour or stamina potion in the build**, and does here; when any of those
 *   verbs is built, this list must learn them.
 *   **Arm 3 HAS A VERB SINCE 2026-09-22 (`cast_regenerate`)** and is struck
 *   from that list: `chooseAiAction` tests it just above the drink block, after
 *   the arm-2 potion read off this table and before arms 4-6. This table is
 *   still potions only.
 *   **Arm 7 HAS A VERB SINCE 2026-09-22 (`cast_death_from_above`)** and is
 *   struck too: `chooseAiAction` casts it inside its walk of this table, at
 *   the first entry past arm 7, so a villain holding 49 drinks a HEALTH potion
 *   below half (arms 2, 4-6) and never an armour or stamina one (10-13) — the
 *   build's order (`test/ss2-death-from-above.test.js`).
 *   **Arm 1 HAS A VERB SINCE 2026-09-22 (`cast_rejuvinate`)** and is struck
 *   too: `chooseAiAction` tests it FIRST, above arm 3 and this table, so a
 *   villain below `hitpointsmax / 1.5` holding 43 never reaches a health
 *   potion — below half implies below the line (`test/ss2-rejuvenate.test.js`).
 *   **Arms 8 and 9 HAVE VERBS SINCE 2026-09-22 (`cast_colossus`,
 *   `cast_little_fat_kid`)** and are struck as well: `chooseAiAction` tests them
 *   in their own block above its walk of this table, reading the health arms
 *   (2, 4-6) and molten death (7) that precede them first — so a villain whose
 *   gate is open drinks no armour or stamina potion either
 *   (`test/ss2-stat-spells.test.js`).
 */
export const SS2_POTION_LADDER = Object.freeze([
  Object.freeze({ arm: 2, itemId: 5 }),
  Object.freeze({ arm: 4, itemId: 4 }),
  Object.freeze({ arm: 5, itemId: 3 }),
  Object.freeze({ arm: 6, itemId: 2 }),
  Object.freeze({ arm: 10, itemId: 9 }),
  Object.freeze({ arm: 11, itemId: 8 }),
  Object.freeze({ arm: 12, itemId: 7 }),
  Object.freeze({ arm: 13, itemId: 6 })
]);

/**
 * The six numbers the potion arm and `check_stats` read, off a view.
 *
 * `hitpoints`/`hitpointsmax` are the resolver's own `health`/`maxHealth` — the
 * vanilla pair `CANONICAL_HEALTH_SOURCES` maps them to. `armourclass_max`
 * falls back to `armourclass` exactly as `vanillaRecordOf` does, so the
 * ingress and the potion cannot disagree about an armour ceiling.
 */
function ss2PoolsOf(view) {
  const armourclass = resourceValue(view, "armourclass", 0);
  return {
    hitpoints: view.health,
    hitpointsmax: view.maxHealth,
    staminaleft: resourceValue(view, "staminaleft", 0),
    staminamax: resourceValue(view, "staminamax", 0),
    armourclass,
    armourclass_max: resourceValue(view, "armourclass_max", armourclass)
  };
}

/**
 * One drink, as the arm computes it and `check_stats` settles it — before
 * `nextphase`, which the caller runs from what this returns.
 *
 * Returns the UNCLAMPED `bonus` (what `bonus_icon` shows), the pools before,
 * and the pools after the write and the clamp. **All three are clamped**, not
 * only the one the potion names, because `check_stats` is one function with
 * three clamps and no argument that selects between them.
 */
export function ss2PotionOutcome(itemId, pools) {
  const potion = SS2_POTIONS[itemId];
  if (!potion) {
    throw new TeamRuleSetError(`${String(itemId)} is not a potion; the drink_potion arm reads ids 2-9.`);
  }
  const base = pools[potion.of];
  const raw = potion.multiplier === null ? base : base * potion.multiplier;
  const bonus = potion.rounded ? Math.round(raw) : raw;
  const written = { ...pools, [potion.stat]: pools[potion.stat] + bonus };
  const after = { ...written };
  for (const [pool, ceiling] of Object.entries(SS2_POOL_CEILING)) {
    after[pool] = clamp(written[pool], 0, written[ceiling]);
  }
  return { potion, bonus, before: pools, after };
}

/* ------------------------------------------------------------------ */
/* The timed self-buffs: an arm that sets a counter, and `nextphase`    */
/* ------------------------------------------------------------------ */

/**
 * `cast_regenerate` (id 46) and `cast_boundless_energy` (id 45), byte-derived
 * 2026-09-22 from `sprite:862[overlay]/frame:52/DoAction@0x240c7f` (block base
 * `0x240c85`) and re-derived by two write-nothing verifiers:
 *
 * ```text
 *   phase_decision == "cast_regenerate"                              +0x8bab
 *     attacker.spell_regenerate = 20                                 +0x8bbe
 *     register:3.crowd_action = 3                                    +0x8bcf
 *     game_attacker.staminacost = Math.round(game_attacker.magicka)  +0x8bdc
 *     if (attacker.struck == null) {                                 +0x8c03
 *       cast_spell_icon(attacker, 46)                                +0x8c1a
 *       attacker.struck = false; attacker.gotoAndPlay("Cast2")       +0x8c32-+0x8c54
 *     }
 *     if (attacker.struck == true) { attacker.struck = null; nextphase() }  +0x8c55
 *   (cast_boundless_energy: +0x8c8a-+0x8d68, id 45, spell_boundless_energy)
 * ```
 *
 * ► **THE COUNTER WRITE IS OUTSIDE THE `struck` GATE, ON EVERY TICK, AND ON
 *   THE FIGHTER CLIP** (`attacker`, not `game_attacker`). So the completion
 *   pass that calls `nextphase()` leaves it at 20, and `nextphase` decrements
 *   it to 19 BEFORE its effect test: **the cast phase itself applies**, and in
 *   strict alternation the bearer gains at 19, 17, …, 1 — ten times. A recast
 *   writes 20 again: it resets, never stacks.
 *
 * ► **NO DRAW, NO STAT WRITE, NO `defender`.** The arm's only calls are
 *   `Math.round`, `cast_spell_icon`, `gotoAndPlay` and `nextphase`.
 *
 * ► **WHAT `nextphase` DOES WITH THE COUNTER** (`+0x319e`-`+0x36a1`; see
 *   `phaseTransitionEffects`, which IS `nextphase` here):
 *   - `check_spells(game_attacker, attacker)` then `check_spells(game_defender,
 *     defender)` (`+0x3271`, `+0x3289`) — for BOTH fighters, every phase. For
 *     these two counters it only decrements while `> 0` (`+0x272e`-`+0x278f`);
 *     there is NO expiry block, unlike colossus, little fat kid, swiftsandals
 *     and bloodlust above them.
 *   - after `check_stats` (`+0x3347`): `if (attacker.spell_regenerate > 0)`
 *     `hitpoints += round(hitpointsmax / 4)`, `check_stats` (`+0x33bd`-
 *     `+0x3475`); then `if (attacker.spell_boundless_energy > 0)`
 *     `staminaleft += round(staminamax / 4)`, `check_stats` ×2 (`+0x3476`-
 *     `+0x3540`). The ATTACKER's clip only: a buffed defender ticks and gains
 *     nothing.
 *
 * ► **THE COUNTER IS `undefined` UNTIL THE FIRST CAST.** The whole oracle holds
 *   exactly four references to each name — the two `check_spells` sites, the
 *   `nextphase` test and the arm's write — and no initialiser, so a fresh clip
 *   reads `undefined`, which `> 0` never passes. Absent here and 0 here are
 *   therefore both the build's "no buff".
 *
 * ► **NOT MODELLED, AND NAMED:** ~~`crowd_action = 3` (the crowd cue, as for the
 *   bolts),~~ `cast_spell_icon`, and the `add_stats_icon` splat — which is a
 *   `DefineFunction` with an EMPTY body (the map's `+0x23bf`, codeSize 0; the
 *   function dump this was built from shows a header and no instructions), so
 *   the build draws nothing either. The boundless splat's number would be
 *   `round(stamina / 4)` (`+0x34d1`), not the `round(staminamax / 4)` it adds.
 *   **`crowd_action = 3` IS MODELLED since 2026-09-22**: each cast adds 3 to
 *   the battle's `crowd_interest` (`src/team/ss2-crowd.js`).
 */
export const SS2_TIMED_BUFFS = Object.freeze({
  [Ss2ActionType.CAST_REGENERATE]: Object.freeze({
    /** `cast_spell_icon(attacker, 46)` `+0x8c1a`; `check_inventory(46)` `+0x0681`. */
    itemId: 46,
    /** The clip field `attacker.spell_regenerate` (`+0x8bc4`), read by `nextphase` at `+0x33c3`. */
    counter: "spell_regenerate",
    /** `Push "spell_regenerate", 20; SetMember` `+0x8bc4`. */
    duration: 20,
    /** `attacker.gotoAndPlay("Cast2")`, `+0x8c40`. */
    casterClip: "Cast2",
    /**
     * `register:3.crowd_action = 3`, `+0x8bcf` — ~~Presentation cue; not
     * modelled.~~ **MODELLED 2026-09-22**: `register:3` is `_global`, and `nextphase`
     * adds this to the battle's one `crowd_interest` (`src/team/ss2-crowd.js`).
     */
    crowdAction: 3,
    /** `hitpoints += round(hitpointsmax / 4)`, `+0x33dc`-`+0x3417`. */
    divisor: 4,
    /** `villain_cast_spells` arm 3, `check_inventory(46) && hitpoints < hitpointsmax / 2` (`+0x0681`-`+0x06f1`). */
    ladderArm: 3
  }),
  [Ss2ActionType.CAST_BOUNDLESS_ENERGY]: Object.freeze({
    /** `cast_spell_icon(attacker, 45)` `+0x8cf9`; `check_inventory(45)` `+0x0df3`. */
    itemId: 45,
    /** The clip field `attacker.spell_boundless_energy` (`+0x8ca3`), read at `+0x347c`. */
    counter: "spell_boundless_energy",
    /** `Push "spell_boundless_energy", 20; SetMember` `+0x8ca3`. */
    duration: 20,
    /** `attacker.gotoAndPlay("Cast2")`, `+0x8d1f`. */
    casterClip: "Cast2",
    /**
     * `register:3.crowd_action = 3`, `+0x8cae` — ~~Presentation cue; not
     * modelled.~~ **MODELLED 2026-09-22**: `register:3` is `_global`, and `nextphase`
     * adds this to the battle's one `crowd_interest` (`src/team/ss2-crowd.js`).
     */
    crowdAction: 3,
    /** `staminaleft += round(staminamax / 4)`, `+0x3495`-`+0x34d0`. */
    divisor: 4,
    /** `villain_cast_spells` arm 23, `check_inventory(45)` ALONE (`+0x0df3`-`+0x0e29`). */
    ladderArm: 23
  })
});

/**
 * ► **THE FOUR STAT SPELLS**, derived 2026-09-22 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f` (base `0x240c85`) and each
 * re-derived by a write-nothing verifier; every clause below was then re-read
 * off the dumps by the implementer. All four arms have the regenerate shape —
 * a counter, `crowd_action` and `staminacost = round(magicka)` written on
 * EVERY tick outside the `struck` gate, a once-block inside it — and write
 * their stats FROM `backup_*`, never from the current value:
 *
 * ```text
 *   cast_colossus (42)      +0x7fda  attacker.spell_colossus = 16           +0x7ff3
 *                                    crowd_action = 15                      +0x7ffe
 *     once, attacker.struck == null  (+0x8044):
 *                                    cast_spell_icon(attacker, 42); "Colossus"
 *                                    oldscale = _yscale; newscale = 450     +0x8084-+0x80aa
 *                                    strength = backup_strength * 3         +0x80ab-+0x80c8
 *                                    attack   = backup_attack * 2           +0x80c9-+0x80e6
 *     every tick:                    _yscale = ceil((newscale - _yscale) / 2)  +0x80e7 (ASSIGNS)
 *                                    _xscale = _yscale; _x -/+= 2 by gladiator_dir  +0x8124-+0x8191
 *                                    finish only when !(_yscale < newscale) +0x8192-+0x81ae
 *   cast_little_fat_kid (33) +0x81f8 DEFENDER.spell_little_fat_kid = 16     +0x8211
 *                                    crowd_action = 10                      +0x821c
 *     once, DEFENDER.struck == null (+0x8262):
 *                                    attacker "Cast2"; icon 33; defender "little_fat_kid"
 *                                    game_defender.strength = round(backup_strength / 2)  +0x82df
 *                                    game_defender.attack   = round(backup_attack / 2)    +0x830e
 *     then:                          the victim's scale SNAPS to 50 and the arm completes
 *                                    in the same tick (+0x833d-+0x83f4)
 *   cast_swiftsandals (40)   +0x895d attacker.spell_swiftsandals = 20       +0x8976
 *                                    crowd_action = 3                       +0x8981
 *     once:                          "Cast2"; speed = 10 + backup_speed * 2 +0x8a07-+0x8a2a
 *   cast_bloodlust (41)      +0x8a60 attacker.spell_bloodlust = 20          +0x8a79
 *                                    crowd_action = 3                       +0x8a84
 *     once:                          "Cast2"; strength = 10 + round(backup_strength * 1.5)  +0x8b0a
 *                                    defence = round(backup_defence * 0.5)  +0x8b43
 * ```
 *
 * **`check_spells` restores exactly what each one wrote**, from the same
 * `backup_*`, when its counter reaches 0 — colossus and little fat kid
 * strength and attack (`+0x24a0`, `+0x252e`), swift sandals speed ONLY
 * (`+0x25e1`), bloodlust strength and defence (`+0x26c7`) — and writes -1.
 * See `SS2_TIMED_SPELL_COUNTERS` for why -1 matters.
 *
 * ► **ONE SLOT PER STAT, LAST WRITER WINS, AND ANY EXPIRY RESETS IT.** The
 *   writes are absolute from the backup, so a recast resets and never stacks —
 *   and a colossus that runs out while bloodlust is still running puts
 *   strength back to the backup, cancelling bloodlust's strength while its
 *   halved defence carries on. Reproduced: the expiry's writes land after the
 *   cast's, as the build's `nextphase` orders them.
 *
 * ► **THE HERO'S PER-ROUND RE-SKIN IS NOT REPRODUCED — the owner's decision,
 *   2026-09-22.** In the build, overlay frame 1 re-runs
 *   `skincharacter(_root.game.hero, …)` every round (`DoAction@0x236941`
 *   `+0x0a57`), which rewrites the hero's `strength`, `speed`, `attack` and
 *   `defence` from `charDNA` (`initcharacter` `+0x0766`-`+0x07ab`) before the
 *   hero's next decision. **So in the build a HERO gains nothing from
 *   colossus, swift sandals or bloodlust, and a villain's little fat kid on the
 *   hero is gone before the hero acts; the villain, never re-skinned, keeps
 *   every buff for its counter's whole run.** This engine gives every
 *   combatant the villain's rule. The counter and the tint still run their
 *   course on the hero in the build; only the stats revert.
 *
 * ► ~~**`crowd_action` IS RECORDED, NOT MODELLED — the owner's decision,
 *   2026-09-22 (item 1f).**~~ **`crowd_action` IS MODELLED — the owner's
 *   decision (f), taken later the same day.** It is not a presentation cue:
 *   `nextphase` adds it into `crowd_interest` (`+0x3541`-`+0x35a3`), which
 *   scales the victory purse. `crowdAction` below is each arm's literal, and
 *   each branch hands it to `phaseTransitionEffects` (`src/team/ss2-crowd.js`).
 *
 * ► **PRESENTATION, NOT ENGINE STATE, AND NOT MODELLED:** the clip scale
 *   (`oldscale`/`newscale`, one shared slot on the clip; colossus's growth
 *   converges to 150 from ANY start — a fighter above 150, `strength > 105`,
 *   SHRINKS — and little fat kid snaps to 50), the positive `_xscale` that
 *   loses the facing sign, and the `blendMode` tints `check_spells` applies
 *   while a counter runs (`invert` on the legs, `difference` on three arm
 *   parts). None of them feeds a number here.
 *
 * ► **COLOSSUS'S DRIFT IS POSITION, AND IT IS DEFERRED — named, not missed.**
 *   Because the growth ASSIGNS (a build bug: no `Add2` at `+0x8123`), the
 *   finish test never passes and the phase ends only through the `demand_move`
 *   watchdog (`+0x37c9`-`+0x38a1`): 58 arm ticks from a fresh tick, 59 when the
 *   previous phase ended earlier in the same tick, 198/199 if only its `>= 200`
 *   clause can fire — and the arm moves the caster 2 px toward
 *   `gladiator_dir` on every one (`+0x8139`-`+0x8191`). What stops this being a
 *   one-line `POSITION` is what the drift meets: the close-range pushback at
 *   the top of the same handler (`+0x36b9`-`+0x37c8`) moves BOTH clips 1 px
 *   apart per tick while `arena.fightdistance < 100`, which cancels the drift
 *   and translates the pair; when `fightdistance` is refreshed within the frame
 *   is not in the dumps; and which of 58/59 applies depends on how the
 *   PREVIOUS phase ended, which this engine does not record. A straight
 *   116 px would walk a caster through a foe standing inside it. So the caster
 *   does not move here. `driftPerTick` and `watchdogTicks` are carried for
 *   whoever models it.
 */
export const SS2_STAT_SPELLS = Object.freeze({
  [Ss2ActionType.CAST_COLOSSUS]: Object.freeze({
    /** `cast_spell_icon(attacker, 42)` `+0x8049`; `check_inventory(42)` `+0x0890`. */
    itemId: 42,
    /** `attacker.spell_colossus = 16` `+0x7ff3` — the CASTER's clip. */
    counter: "spell_colossus",
    duration: 16,
    /** Whose stats and counter the arm writes: `game_attacker` / `attacker`. */
    bearer: "caster",
    /** `attacker.gotoAndPlay("Colossus")` `+0x806f`, frames 2147-2168. No victim clip. */
    casterClip: "Colossus",
    victimClip: null,
    /**
     * `register:3.crowd_action = 15`, `+0x7ffe` — ~~Recorded, not
     * modelled.~~ **MODELLED 2026-09-22**: `register:3` is `_global`, and `nextphase`
     * adds this to the battle's one `crowd_interest` (`src/team/ss2-crowd.js`).
     */
    crowdAction: 15,
    /** Engine stat names the arm writes and the expiry restores (`+0x24a0`, `+0x24ad`). */
    stats: Object.freeze(["strength", "attack"]),
    /** `strength = backup_strength * 3` `+0x80ab`; `attack = backup_attack * 2` `+0x80c9`. Unrounded. */
    write: (backup) => ({ strength: backup.strength * 3, attack: backup.attack * 2 }),
    /** `villain_cast_spells` arm 8: `check_inventory(42) && fightdistance < 300` (`+0x0890`-`+0x08c4`). */
    ladderArm: 8,
    aiFightDistanceBelow: 300,
    /** DEFERRED, see above: `_x -= 2` / `_x += 2` per tick (`+0x8165`, `+0x8188`). */
    driftPerTick: 2,
    /** DEFERRED, see above: the watchdog's `demand_move >= 60` from a fresh tick. */
    watchdogTicks: 58
  }),
  [Ss2ActionType.CAST_LITTLE_FAT_KID]: Object.freeze({
    /** `cast_spell_icon(attacker, 33)` `+0x827c`; `check_inventory(33)` `+0x08ea`. */
    itemId: 33,
    /** `defender.spell_little_fat_kid = 16` `+0x8211` — the VICTIM's clip. */
    counter: "spell_little_fat_kid",
    duration: 16,
    /**
     * `game_defender` / `defender`: a DEBUFF on the foe, read from the foe's
     * own backups. Its once-gate is `defender.struck == null` (`+0x8250`-
     * `+0x8262`) — the one once-gate in frame 52 on the defender's flag.
     */
    bearer: "victim",
    /** `attacker.gotoAndPlay("Cast2")` `+0x8267`; `defender.gotoAndPlay("little_fat_kid")` `+0x82a2`. */
    casterClip: "Cast2",
    victimClip: "little_fat_kid",
    /**
     * `register:3.crowd_action = 10`, `+0x821c` — ~~Recorded, not
     * modelled.~~ **MODELLED 2026-09-22**: `register:3` is `_global`, and `nextphase`
     * adds this to the battle's one `crowd_interest` (`src/team/ss2-crowd.js`).
     */
    crowdAction: 10,
    /** Restored at `+0x252e`, `+0x253b`. */
    stats: Object.freeze(["strength", "attack"]),
    /**
     * `round(backup_strength / 2)` `+0x82df`-`+0x830d`, `round(backup_attack / 2)`
     * `+0x830e`-`+0x833c`. `Math.round` sends a half UP (7 -> 4), the build's
     * and JavaScript's alike — never a floor.
     */
    write: (backup) => ({ strength: Math.round(backup.strength / 2), attack: Math.round(backup.attack / 2) }),
    /** `villain_cast_spells` arm 9: `check_inventory(33) && fightdistance < 500` (`+0x08ea`-`+0x091e`). */
    ladderArm: 9,
    aiFightDistanceBelow: 500
  }),
  [Ss2ActionType.CAST_SWIFTSANDALS]: Object.freeze({
    /** `cast_spell_icon(attacker, 40)` `+0x89cc`; `check_inventory(40)` `+0x0fb0`. */
    itemId: 40,
    /** `attacker.spell_swiftsandals = 20` `+0x8976`. */
    counter: "spell_swiftsandals",
    duration: 20,
    bearer: "caster",
    /** `attacker.gotoAndPlay("Cast2")` `+0x89f2`. */
    casterClip: "Cast2",
    victimClip: null,
    /**
     * `register:3.crowd_action = 3`, `+0x8981` — ~~Recorded, not
     * modelled.~~ **MODELLED 2026-09-22**: `register:3` is `_global`, and `nextphase`
     * adds this to the battle's one `crowd_interest` (`src/team/ss2-crowd.js`).
     */
    crowdAction: 3,
    /** SPEED only (`agility` here) — its expiry, `+0x25e1`, touches no strength. */
    stats: Object.freeze(["agility"]),
    /**
     * `speed = 10 + backup_speed * 2` `+0x8a07`-`+0x8a2a`, unrounded — NOT a
     * doubling, whatever the item's text says. `battlevalues` then makes
     * `movement_speed = min(60, 15 + 3 * backup_speed)`, so a gladiator whose
     * base movement is already at the cap (`speed >= 40`) gains nothing.
     */
    write: (backup) => ({ agility: 10 + backup.agility * 2 }),
    /** `villain_cast_spells` arm 27: `check_inventory(40) && fightdistance > 300` (`+0x0fb0`-`+0x0fe4`). */
    ladderArm: 27,
    aiFightDistanceAbove: 300
  }),
  [Ss2ActionType.CAST_BLOODLUST]: Object.freeze({
    /** `cast_spell_icon(attacker, 41)` `+0x8acf`; `check_inventory(41)` `+0x0d99`. */
    itemId: 41,
    /** `attacker.spell_bloodlust = 20` `+0x8a79`. */
    counter: "spell_bloodlust",
    duration: 20,
    bearer: "caster",
    /** `attacker.gotoAndPlay("Cast2")` `+0x8af5`. */
    casterClip: "Cast2",
    victimClip: null,
    /**
     * `register:3.crowd_action = 3`, `+0x8a84` — ~~Recorded, not
     * modelled.~~ **MODELLED 2026-09-22**: `register:3` is `_global`, and `nextphase`
     * adds this to the battle's one `crowd_interest` (`src/team/ss2-crowd.js`).
     */
    crowdAction: 3,
    /** Restored at `+0x26c7`, `+0x26d4`. The item text's "reduces your agility" names a field no code writes. */
    stats: Object.freeze(["strength", "defense"]),
    /**
     * `strength = 10 + round(backup_strength * 1.5)` `+0x8b0a`-`+0x8b42` (the
     * round wraps only the product) and `defence = round(backup_defence * 0.5)`
     * `+0x8b43`-`+0x8b75`: it HALVES the caster's defence.
     */
    write: (backup) => ({ strength: 10 + Math.round(backup.strength * 1.5), defense: Math.round(backup.defense * 0.5) }),
    /** `villain_cast_spells` arm 22: `check_inventory(41) && fightdistance < 400` (`+0x0d99`-`+0x0dcd`). */
    ladderArm: 22,
    aiFightDistanceBelow: 400
  })
});

/**
 * The build's name for each engine stat's fight-start copy: `backup_char`
 * (`+0x2d80`-`+0x2da7`) sets `backup_strength = strength`, `backup_speed =
 * speed`, `backup_attack = attack`, `backup_defence = defence`.
 *
 * ► **WHERE `backup_*` COMES FROM IN THIS ENGINE: the stats the combatant was
 *   BUILT with**, declared as a resource at the opening for exactly the
 *   combatants a stat spell can land on (`ss2StatSpellDeclarations`). That is
 *   the build's timing: `backup_char` runs for the hero and the villain before
 *   the bout (`sprite:2249/frame:1` `+0x010a`, `+0x012e`) and at no point
 *   during it — its other two callers are post-battle (`frame:231`) and the
 *   stat-point button.
 */
const SS2_STAT_BACKUP = Object.freeze({
  strength: "backup_strength",
  agility: "backup_speed",
  attack: "backup_attack",
  defense: "backup_defence"
});

/**
 * **-1 IS THE BUILD'S OWN "NO BUFF" FOR THE FOUR STAT COUNTERS, AND 0 IS NOT.**
 * Their `== 0` expiry sits OUTSIDE the `> 0` decrement (`+0x246a`, `+0x24f8`,
 * `+0x25c6`, `+0x26ac`), so a counter ENTERING a tick at 0 restores its stats
 * — and every expiry writes -1 (`+0x24ba`, `+0x2548`, `+0x262e`, `+0x2721`).
 * The build holds `undefined` before the first cast, which both tests pass by;
 * a resource cannot hold `undefined`, and -1 is the inert value the build
 * itself writes. Declared with `min: -1` so the bag can hold it.
 */
const SS2_STAT_SPELL_INERT = -1;

/** A stat's fight-start value: its declared `backup_*`, or the stat itself when none is declared. */
function ss2BackupStat(carrier, stat) {
  return resourceValue(carrier, SS2_STAT_BACKUP[stat], carrier?.stats?.[stat] ?? 0);
}

/**
 * Every resource a stat spell will write, declared at the opening on whoever
 * it can land on — `rules.openingResources`.
 *
 * ► **WHY HERE AND NOT IN `ss2Combatant`, where the regenerate counter is
 *   declared by possession.** Little fat kid writes its counter and its
 *   halved stats on the VICTIM, who does not carry id 33 — and a blueprint is
 *   built one gladiator at a time, so nothing there knows what a foe carries.
 *   The resolver asks the rule set once, seeing the whole roster; all four
 *   spells are declared here so the rule lives in one place:
 *
 *   - **the caster** of colossus (42), swift sandals (40) and bloodlust (41),
 *     when any declared slot holds the item (the window included — declaring
 *     is inert, as for regenerate);
 *   - **every foe** of a gladiator carrying little fat kid (33).
 *
 * Each gets the counter at -1 and the `backup_*` of the stats that spell
 * writes, at the stats it was built with. **A battle where nobody carries one
 * of the four declares nothing**, so no golden and no existing battle moves.
 * `ss2Combatant` never declares any of the eight from a record (see
 * `SS2_RESOURCE_NAMES` for why); a RAW blueprint that declares one keeps its
 * own declaration, as `withDeclaredResources` keeps every blueprint's.
 *
 * ► **AND THE TICK CLOCK WITH THEM (merged 2026-09-22 with the owner's
 *   bearer's-turn tick rule, built in parallel).** A combatant given a counter
 *   here is a timed-spell BEARER, so it needs `SS2_TIMED_SPELL_CLOCK` beside
 *   the counter, at 1 as `ss2Combatant` declares it; `ss2Combatant` cannot see
 *   these counters, so it is declared HERE. A clock the blueprint already
 *   declared (a regenerate or boundless bearer) is kept, as
 *   `withDeclaredResources` keeps every blueprint's. Without it the bearer
 *   would tick on its own phases only: the 1v1 expiry sequences and little fat
 *   kid's `counterAfter` in `test/ss2-stat-spells.test.js` are the guard.
 */
function ss2StatSpellDeclarations(combatants) {
  const carries = (combatant, itemId) =>
    ss2InventorySlotHolding(combatant, itemId, { ignoreMaxslots: true }) !== null;
  const declarations = [];
  for (const combatant of combatants) {
    const needed = new Map();
    for (const spell of Object.values(SS2_STAT_SPELLS)) {
      const bears = spell.bearer === "caster"
        ? carries(combatant, spell.itemId)
        : combatants.some((other) => other.teamId !== combatant.teamId && carries(other, spell.itemId));
      if (!bears) continue;
      needed.set(spell.counter, { value: SS2_STAT_SPELL_INERT, min: SS2_STAT_SPELL_INERT });
      for (const stat of spell.stats) needed.set(SS2_STAT_BACKUP[stat], { value: combatant.stats[stat] });
      needed.set(SS2_TIMED_SPELL_CLOCK, { value: 1 });
    }
    for (const [resource, declaration] of needed) {
      declarations.push({ targetId: combatant.id, resource, ...declaration });
    }
  }
  return declarations;
}

/** The resources a stat spell needs on its bearer before its first write: the counter and the backups. */
function ss2StatSpellResources(spell) {
  return [spell.counter, ...spell.stats.map((stat) => SS2_STAT_BACKUP[stat])];
}

/**
 * The offered option a stat spell's LADDER ARM would take, or null — the
 * villain's decision, `check_inventory(id) && fightdistance <op> N`, and
 * nothing else (see `SS2_STAT_SPELLS` for each arm's offsets).
 *
 * Possession is the option list's (it already applied the slot window and the
 * bearer's declarations). `fightdistance` is measured to the NEAREST foe —
 * INVENTED above 1v1, where the build has one `defender`; it is the weaken's,
 * the gale's and the teleport's choice — and little fat kid is aimed at that
 * same foe. Both tests are strict (`Less2`, `Greater`), and a foe with no
 * position gives no distance and so no cast, as the gale's guard reads it.
 */
function ss2StatSpellChoice(view, options, type) {
  const spell = SS2_STAT_SPELLS[type];
  const foe = nearestFoe(view);
  const range = foe ? ss2FightDistance(view.actor, foe) : null;
  if (range === null) return null;
  const open = spell.aiFightDistanceBelow !== undefined
    ? range < spell.aiFightDistanceBelow
    : range > spell.aiFightDistanceAbove;
  if (!open) return null;
  const targetId = spell.bearer === "victim" ? foe.id : view.actor.id;
  return options.find((option) => option.type === type && option.targetId === targetId) ?? null;
}

/**
 * The timed counters `nextphase` ticks, in `check_spells`' own order:
 * `spell_colossus` `+0x2439`, `spell_little_fat_kid` `+0x24c7`,
 * `spell_swiftsandals` `+0x2555`, `spell_bloodlust` `+0x263b`,
 * `spell_regenerate` `+0x272e`, `spell_boundless_energy` `+0x275f`.
 *
 * **All six have a verb since 2026-09-22.** The first four also EXPIRE — see
 * `SS2_TIMED_SPELL_EXPIRY`; the last two only decrement. **Every counter here
 * inherits the team-play tick schedule and the tick clock** (see
 * `ss2TimedSpellBystanders`): the clock is declared beside the counter — by
 * `ss2Combatant` for regenerate and boundless energy, by the opening
 * (`ss2StatSpellDeclarations`) for the four stat spells — and construction
 * refuses a blueprint counter that arrives without it.
 */
const SS2_TIMED_SPELL_COUNTERS = Object.freeze([
  ...Object.values(SS2_STAT_SPELLS).map((spell) => spell.counter),
  SS2_TIMED_BUFFS[Ss2ActionType.CAST_REGENERATE].counter,
  SS2_TIMED_BUFFS[Ss2ActionType.CAST_BOUNDLESS_ENERGY].counter
]);

/**
 * The TICK CLOCK: 1 while a gladiator "owes" one bystander tick, 0 once it is
 * paid. **AUTHORED — the build has no such field**, because in 1v1 it never
 * needs one; see `ss2TimedSpellBystanders` for the rule it serves.
 *
 * Declared beside any timed counter and nowhere else — by `ss2Combatant` for
 * regenerate's and boundless energy's, by the opening
 * (`ss2StatSpellDeclarations`) for the four stat spells', whose bearer may not
 * be the carrier — at 1 (before any phase completes, everybody counts as
 * owed), and with NO
 * `SS2_RESOURCE_DEFAULTS` entry — so a gladiator that bears no timed spell
 * carries no new hashed state, and no golden moves.
 */
const SS2_TIMED_SPELL_CLOCK = "timed_spell_tick_owed";

/**
 * Every value this rule set writes to each timed resource, as `[low, high]` —
 * which its declared bounds must admit, or the resolver's clamp silently turns
 * the rule into a different one. Checked at construction by
 * `assertConstructionResources`.
 *
 * ► **FOUND BY CODEX 2026-09-22, REPRODUCED BEFORE IT WAS REFUSED.** A raw
 *   blueprint declaring `spell_bloodlust: 0` gets the shorthand's floor of 0
 *   (`normaliseResourceBag`), so the expiry's -1 clamped back to 0 and the
 *   `== 0` restore fired on EVERY tick: a colossus cast wrote strength 27 and
 *   the same phase put it back to 9, colossus's own counter still at 15. The
 *   same clamp hid two more, measured: regenerate declared `min: 1` stuck at 1
 *   and regenerated for ever, and `max: 10` cut the arm's 20 to 10.
 *
 * - the four stat counters: -1 (`SS2_STAT_SPELL_INERT`, what every expiry
 *   writes) up to the arm's 16 or 20;
 * - regenerate and boundless energy: 0 (their inert value; they only
 *   decrement while `> 0`) up to the arm's 20;
 * - the tick clock: 0 (paid) and 1 (owed).
 *
 * The opening (`ss2StatSpellDeclarations`) and `ss2Combatant` only ever
 * declare bounds inside these, so this can refuse only a blueprint built past
 * them.
 */
const SS2_TIMED_RESOURCE_RANGE = Object.freeze({
  ...Object.fromEntries(Object.values(SS2_STAT_SPELLS).map((spell) => [spell.counter, [SS2_STAT_SPELL_INERT, spell.duration]])),
  ...Object.fromEntries(Object.values(SS2_TIMED_BUFFS).map((buff) => [buff.counter, [0, buff.duration]])),
  [SS2_TIMED_SPELL_CLOCK]: [0, 1]
});

/* ------------------------------------------------------------------ */
/* Rejuvenate: three pools refilled, nine fields restored from backup   */
/* ------------------------------------------------------------------ */

/**
 * `cast_rejuvinate` (id 43), byte-derived 2026-09-22 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f` (block base `0x240c85`),
 * `+0x8d69`-`+0x8f58`:
 *
 * ```text
 *   phase_decision == "cast_rejuvinate"                              +0x8d69
 *     register:3.crowd_action = 3                                    +0x8d7c
 *     game_attacker.staminacost = Math.round(game_attacker.magicka)  +0x8d89
 *     if (attacker.struck == null) {                                 +0x8db0
 *       cast_spell_icon(attacker, 43)                                +0x8dc7
 *       attacker.struck = false                                      +0x8ddf
 *       attacker.gotoAndPlay("Rejuvinate")                           +0x8ded
 *       game_attacker.hitpoints   = game_attacker.hitpointsmax       +0x8e02
 *       game_attacker.staminaleft = game_attacker.staminamax         +0x8e17
 *       game_attacker.armourclass = game_attacker.armourclass_max    +0x8e2c
 *       game_attacker.<piece> = <owner>.backup_<piece>, nine times   +0x8e41-+0x8f08
 *       updatecharacter(game_attacker, attacker)                     +0x8f09
 *     }
 *     if (attacker.struck == true) { attacker.struck = null; nextphase() }  +0x8f24-+0x8f58
 * ```
 *
 * ► **NO DRAW, NO TIMED COUNTER, NO `defender`.** The arm's only calls are
 *   `Math.round`, `cast_spell_icon`, `gotoAndPlay`, `updatecharacter` (which
 *   attaches art and nothing else) and `nextphase`. So the whole effect is the
 *   twelve writes, and `nextphase` then charges `round(magicka)` against the
 *   REFILLED stamina.
 *
 * ► **`armourclass_max` IS READ, NEVER WRITTEN.** `remove_armour` takes each
 *   destroyed piece's `_defence` out of BOTH pools, so a caster who lost pieces
 *   refills only to the LOWERED maximum — and `battlevalues`, which rebuilds
 *   the maximum from the eight `_defence` fields, does that only while
 *   `battle_started != true` (`root/frame:35` `+0x3a90`-`+0x3aa0`), never
 *   mid-battle. The pieces come back; the armour class they were worth does not.
 *
 * ► **THE ARM WRITES NO `_defence` FIELD; ITS `nextphase` DOES.**
 *   `battlevalues` at the end of every `nextphase` (`+0x35f1`, `+0x3605`)
 *   recomputes each `<piece>_defence` from the piece id UNGATED
 *   (`+0x3480`-`+0x3633`), so in the build a restored piece is worth its id
 *   again and a second removal takes it AGAIN. The resolve branch reprices each
 *   restored piece through `ss2PieceDefence`, the function `ss2BattleValues`
 *   itself uses. ~~This engine never writes a `_defence` field at all, so a
 *   restored piece's is still the construction value, which is what
 *   `battlevalues` recomputes from the same id.~~ **WRONG, and mine: that holds
 *   only for a gladiator built BEFORE it lost the piece. One rebuilt after
 *   (`battleStarted`, or a `derive: false` capture) carries the 0 the build's
 *   own `nextphase` had priced the empty slot at, and the restored piece was
 *   worth nothing — reproduced by a Codex review, 2026-09-22.** The shield is
 *   priced at its SHEATHED value whatever the bow, which is the bag's
 *   representation: `vanillaRecordOf` zeroes it while the bow is drawn, as
 *   `battlevalues` does (`+0x3623`). See the note at the repricing.
 *
 * ► **`backup_*` IS THE FIGHT-START SNAPSHOT.** Written only by `backup_char`
 *   (`root/frame:35` `+0x2d80`-`+0x2e69`), whose four call sites are all
 *   outside battle: `sprite:2249/frame:1` for the hero and the villain before
 *   the fight (`+0x010a`, `+0x012e`), `sprite:2249/frame:231` after a win,
 *   `root/button:2283`. This engine declares the nine at construction — see
 *   `ss2Combatant` — which is the same moment.
 *
 * ► **THE SHOULDERGUARD'S BACKUP IS READ THROUGH A FREE VARIABLE IN THE BUILD**
 *   (`GetVariable "whichcharacter"`, `+0x8e50`), which nothing in the build
 *   assigns, so the rejuvenated shoulderguard there is `undefined`. **This
 *   engine restores it from its own backup like the other eight — the owner's
 *   decision, 2026-09-22.** See the resolve branch.
 *
 * ► **NOT MODELLED, AND NAMED:** ~~`crowd_action = 3` (the crowd cue, as for the
 *   bolts),~~ `cast_spell_icon`, and `updatecharacter`'s art. The arm has no
 *   `Jump` after `nextphase()` and falls through into the fireball test at
 *   `+0x8f59`, which compares against a different label and so does nothing.
 *   **`crowd_action = 3` IS MODELLED since 2026-09-22** (`src/team/ss2-crowd.js`).
 *
 * ► **THE OFFER IS POSSESSION.** `hitpoints < hitpointsmax / 1.5` is ladder
 *   arm 1 of `villain_cast_spells`, the villain's DECISION, read by
 *   `chooseAiAction` and by nothing else.
 */
export const SS2_REJUVENATE = Object.freeze({
  /** `cast_spell_icon(attacker, 43)` `+0x8dc7`; `check_inventory(43)` `+0x0593`. */
  itemId: 43,
  /** `attacker.gotoAndPlay("Rejuvinate")`, `+0x8ded` — capital R, as the build passes it. */
  casterClip: "Rejuvinate",
  /**
   * `register:3.crowd_action = 3`, `+0x8d7c` — ~~Presentation cue; not
   * modelled.~~ **MODELLED 2026-09-22**: `register:3` is `_global`, and `nextphase`
   * adds this to the battle's one `crowd_interest` (`src/team/ss2-crowd.js`).
   */
  crowdAction: 3,
  /**
   * The nine restores, IN THE ARM'S ORDER — which is not `SS2_ARMOUR_PIECES`'
   * order, and includes `weapon` (`+0x8edd`), which no verb in this engine
   * writes, so its restore can never move anything here; it is kept so the list
   * is the build's rather than a subset of it. `secondary_weapon` is NOT
   * restored, and is not here.
   */
  restores: Object.freeze([
    Object.freeze({ piece: "shoulderguard", backup: "backup_shoulderguard", offset: "+0x8e41" }),
    Object.freeze({ piece: "gauntlet", backup: "backup_gauntlet", offset: "+0x8e59" }),
    Object.freeze({ piece: "breastplate", backup: "backup_breastplate", offset: "+0x8e6f" }),
    Object.freeze({ piece: "helmet", backup: "backup_helmet", offset: "+0x8e85" }),
    Object.freeze({ piece: "greaves", backup: "backup_greaves", offset: "+0x8e9b" }),
    Object.freeze({ piece: "shinguard", backup: "backup_shinguard", offset: "+0x8eb1" }),
    Object.freeze({ piece: "boot", backup: "backup_boot", offset: "+0x8ec7" }),
    Object.freeze({ piece: "weapon", backup: "backup_weapon", offset: "+0x8edd" }),
    Object.freeze({ piece: "shield", backup: "backup_shield", offset: "+0x8ef3" })
  ]),
  /** `villain_cast_spells` arm 1, the FIRST arm (`+0x0593`-`+0x0607`). */
  ladderArm: 1,
  /**
   * `villain.hitpoints < villain.hitpointsmax / 1.5` — `Push 1.5` at `+0x05d9`,
   * `Divide`, `Less2` at `+0x05e6`: STRICT and UNROUNDED.
   */
  aiHealthDivisor: 1.5
});

/**
 * The restores a caster CANNOT perform: a field it declares whose backup it
 * does not. Empty for anything `ss2Combatant` built with id 43 in a slot. A
 * field the caster does not declare at all is not missing — there is nothing
 * of it to restore, and the resolver could not write it anyway.
 */
function ss2RejuvenateMissingBackups(view) {
  const declared = declaredResourceNames(view);
  return SS2_REJUVENATE.restores.filter(({ piece, backup }) => declared.has(piece) && !declared.has(backup));
}

/** Counter -> the stats its `== 0` block restores from `backup_*`. Regenerate and boundless have none. */
const SS2_TIMED_SPELL_EXPIRY = Object.freeze(Object.fromEntries(
  Object.values(SS2_STAT_SPELLS).map((spell) => [spell.counter, spell.stats])
));

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
   * unconditional within this arm (`+0x6a21`/`+0x6a91` against the
   * unconditional `knockback(defender, force)` at `+0x6ab1`).
   *
   * ► **"SAME SHAPE AS `damagecharacter`, WHERE THE FIGHTER ALWAYS MOVES" WAS
   *   WRONG — CORRECTED 2026-09-17.** `damagecharacter`'s displacement is
   *   gated TWICE before it can be reached: by the direction band
   *   (`>= 5 && <= 12 || == 30`, `+0x1a72`-`+0x1aa5`, everything else jumping
   *   to `+0x1be4`) and then by `randosmash > 3 || direction == 30`
   *   (`+0x1ac8`-`+0x1ae4`). About one eligible blow in four displaces.
   *   "Unconditional" is true only WITH RESPECT TO THE ANIMATION GATE, which
   *   is a different sentence, and `ss2-attack-candidate.js:568-580` had it
   *   right all along — it was this prose that was wrong.
   *
   * ► **THE TWO THRESHOLDS ARE GENUINELY DIFFERENT, which is worth saying
   *   because it looks like a typo.** This arm's is 100 (`+0x6a12`/`+0x6a82`);
   *   `damagecharacter`'s is 80 (`+0x1b40`/`+0x1bb1`); `shove`'s is 100
   *   (`+0x5ed9`/`+0x5f9a`); and `cast_gale` plays it unconditionally
   *   (`+0x7b78`) on a flat force of ±1000 with no floor. Four call sites,
   *   four shapes.
   *
   * ► ~~**AND THIS ENGINE DISPLACES NOBODY, ON EITHER PATH.** ... **Reported
   *   rather than fixed on purpose**: emitting positions for knockbacks moves
   *   gladiators, and position is in `combatStateHash`, so it would re-datum
   *   every pinned hash and every golden that carries one.~~ **BOTH HALVES ARE
   *   CLOSED, AND THE SECOND WAS FALSE — 2026-09-17.**
   *
   *   `damagecharacter`'s knockback emits a `POSITION` effect now, so the gap
   *   is gone. The stated COST was never real: **no golden carries a position
   *   or a hash and none structurally can** — `startingPosition` returns `null`
   *   under `fixtureReplay`, so the finite-`x` guard suppresses it for every
   *   promoted fixture — and the displacement moved **zero** of the pinned
   *   hashes, measured by removing it and re-running. Every seeded pin's driver
   *   swings directions 1-4, which the band gate excludes.
   *
   *   **That sentence was written in three places and deferred an afternoon's
   *   work across two sessions.** It is the reason to be suspicious of a cost
   *   nobody has measured: "every golden that carries one" quantified over an
   *   empty set, and a handoff then dropped the hedge and called it a DECISION.
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
 *
 * ► **THREE CALLERS SINCE 2026-09-22: `cast_whirlwind`'s arm carries the same
 *   gate instruction for instruction** (`+0x798a`-`+0x7a44` against the
 *   discharge's `+0x6658`-`+0x6717`), so it calls this rather than a copy.
 *
 * ► **CORRECTED 2026-09-22: THE GATE IS STRICT, AND THE ROUND IS ON THE WHOLE
 *   EXPRESSION.** This was ~~`separation <= Math.round(ss2Reach(actor) + 50)`~~,
 *   which let a gap of EXACTLY `K = weapon_range + 50` through. The build's two
 *   tests, one per facing, are
 *
 *   ```text
 *     facing right:  attacker._x > Math.round(defender._x - (weapon_range + 50))   +0x6658-+0x6699
 *     facing left:   attacker._x < Math.round(defender._x + (weapon_range + 50))   +0x66d1-+0x6712
 *   ```
 *
 *   `Greater` and `Less2`, both strict, so the bound itself is OUT. Found by a
 *   write-nothing verifier; re-read here from the dump before it was changed.
 *   It moved no pre-existing test and none of the 23 goldens' census hashes.
 *
 *   **Where the round sits only matters off the integers.** A derived
 *   `weapon_range` is `physical_size + multiplier * 44` with integer
 *   multipliers, so K is an integer, and the positions this engine produces
 *   are integers for integer stats (a caller may still state a fractional `x`
 *   or `weapon_range`). For integers `round(dx - K)` is `dx - K`; for a
 *   half-integer K it is `dx - K + 0.5`, because `Math.round` rounds a half
 *   toward +infinity on BOTH sides — so the build's right-facing bound is one
 *   unit tighter than its left-facing one. Reproduced, and pinned.
 *
 * ► **INVENTED ABOVE 1v1: THE TEST IS TWO-SIDED, NOT FACING-RELATIVE.** The
 *   build evaluates only the expression for the way the caster FACES, so a
 *   defender BEHIND the caster passes at any distance (`attacker._x >
 *   round(defender._x - K)` is true for every defender to the left of a
 *   right-facing caster). A 1v1 pair always faces each other, so the build
 *   never shows it; team play can. **This requires BOTH expressions**, which in
 *   1v1 is exactly the build — the far side's is always true for a target in
 *   front — and above it is the symmetric test this function has always been,
 *   rather than a discharge that reaches across the arena behind you.
 *
 * ► **AND A TARGET IN ANOTHER RANK KEEPS THE DEPTH TERM THIS GATE ALWAYS HAD**
 *   (INVENTED — the build has no ranks, and its gate reads `_x` alone): the
 *   Euclidean `ss2FightDistance` must also be under the bound, now strictly.
 *   On one rank the fight distance is `round(|dx|)`, so this term adds
 *   nothing there and 1v1 is untouched by it.
 */
function ss2PsycheDischargeInRange(actor, target) {
  if (!Number.isFinite(actor?.x) || !Number.isFinite(target?.x)) return false;
  const bound = ss2Reach(actor) + SS2_PSYCHE_UP.rangeBonus;
  // The build's right-facing expression and its left-facing one, both.
  if (!(actor.x > Math.round(target.x - bound))) return false;
  if (!(actor.x < Math.round(target.x + bound))) return false;
  const ay = Number.isFinite(actor.y) ? actor.y : 0;
  const by = Number.isFinite(target.y) ? target.y : 0;
  if (ay === by) return true;
  const separation = ss2FightDistance(actor, target);
  return Number.isFinite(separation) && separation < Math.round(bound);
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
 * WHAT FRAME 1'S FORCED CHAIN CLEARS ON ITS WAY PAST — one flag more than
 * `SS2_DEATH_CLEAR_FLAGS`, and the extra one is `taunted1`.
 *
 * ► **ROW 3 IS A STATEMENT, NOT A BRANCH, SO IT CLEARS WHETHER OR NOT IT
 *   PLAYS.** Re-read off overlay frame 1 (sprite 862) on 2026-09-17, in full:
 *
 *   ```text
 *     if (hero.taunted1 == true || hero.taunted2 == true) {
 *       if (gladiators.hero.gladiator_dir == "right") { hero.taunted1 = false; getphase("runleft")  }
 *       if (gladiators.hero.gladiator_dir == "left")  { hero.taunted1 = false; getphase("runright") }
 *     }
 *   ```
 *
 *   The write is INSIDE the facing arm and BEFORE the call, exactly as rows
 *   4-7 clear theirs before theirs. So when row 1 (`swap_weapons`) or row 2
 *   (`rest`) has already taken the turn, row 3 still spends the flag on a
 *   `getphase` that the `turnphase` gate has already turned into a no-op — and
 *   the gladiator is charged a forced flee he never runs.
 *
 * ► **THAT MAKES THIS LIST THE ONE THE FORCED PATHS TAKE, and the reason the
 *   rest branch alone used to take `SS2_DEATH_CLEAR_FLAGS`.** The swap branch
 *   took nothing at all, so a forced swap left ALL FIVE pending. Both found by
 *   a Codex review of `cbaf406`, 2026-09-17, which is also where the
 *   multiple-source token bug below came from.
 *
 * `taunted2` is deliberately absent: the entry condition tests it and neither
 * arm clears it. That asymmetry is the build's, it is latent here because
 * nothing in this build ever sets `taunted2` true, and copying it is cheaper
 * than explaining every time why the engine is tidier than the game.
 */
export const SS2_CHAIN_CLEAR_FLAGS = Object.freeze([SS2_TAUNT.flag, ...SS2_DEATH_CLEAR_FLAGS]);

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
  // ► **THE TWO TIMED-BUFF COUNTERS, DECLARED 2026-09-22 WITH THEIR VERBS,
  //   AND THEY ARE THE `psyche_up` SHAPE: NO `SS2_RESOURCE_DEFAULTS` ENTRY.** A
  //   default would be filled into every golden's combatant and move all 23
  //   replay hashes. See `SS2_TIMED_BUFFS`.
  //
  //   **They live on the fighter CLIP in the build, not on the stat object**:
  //   the arm writes `attacker.spell_X` and `check_spells` decrements its
  //   `which_avatar` argument (r1; the stat object is r2 and unused for these
  //   two). The resource bag does not know the difference; the adapter does,
  //   and it is the adapter's to write them back to the clip.
  //
  //   Declared when a record STATES one, and also when a declared inventory
  //   slot HOLDS the item that writes it — see `ss2Combatant`, where that
  //   second rule is named as this engine's own.
  "spell_boundless_energy",
  "spell_regenerate",
  // ► **THE NINE BACKUPS `cast_rejuvinate` RESTORES FROM, DECLARED 2026-09-22
  //   WITH ITS VERB, AND THE `psyche_up` SHAPE AGAIN: NO DEFAULT.** A default
  //   would be filled into every golden's combatant and move all 23 replay
  //   hashes. `backup_char` writes them before the fight (`root/frame:35`
  //   `+0x2d80`-`+0x2e69`) and nothing writes them in battle, so here they are
  //   declared at construction — when a record STATES one, and when a declared
  //   slot HOLDS id 43; see `ss2Combatant` and `SS2_REJUVENATE`. Read, never
  //   written, by this rule set.
  ...SS2_REJUVENATE.restores.map(({ backup }) => backup),
  // ► **NOT HERE, DELIBERATELY: THE FOUR STAT-SPELL COUNTERS
  //   (`spell_colossus`, `spell_little_fat_kid`, `spell_swiftsandals`,
  //   `spell_bloodlust`) AND THE FOUR `backup_*` THEY RESTORE FROM (2026-09-22).**
  //   This list is also what `ss2Combatant` reads OUT OF A RECORD, and neither
  //   group may come from one:
  //   - the counters live on the fighter CLIP in the build, never on the
  //     persistent object a record describes — and `tools/arena/roster.js`
  //     still states `spell_colossus: 0, spell_bloodlust: 0` there, which,
  //     declared, would RESTORE on the first tick (`check_spells`' `== 0`);
  //   - a `backup_*` must equal the stat the bag's `battlevalues` numbers were
  //     computed from, or `ss2MeleeStrengthShift` counts a buff twice — and a
  //     record captured mid-buff carries the build's backup beside an already
  //     buffed strength.
  //   So all eight are declared in ONE place, `ss2StatSpellDeclarations`, at the
  //   opening, from the stats the combatant was built with, on whoever a stat
  //   spell can land on — and on nobody else, so no golden moves.
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
  //   alternative — battle-level state — ~~is not something a rule set has:
  //   `actorView` hands over `turnNumber`, `actor`, `allies` and `foes` and
  //   nothing else, so a shared transient would be a resolver-contract change
  //   carrying its own decision.~~ **IS something a rule set has since
  //   2026-09-22: `rules.openingBattleResources` declares a battle-wide pool
  //   and `EffectKind.BATTLE_RESOURCE` writes it (the crowd's seam). So a
  //   shared `criticalhit` transient is now a RULE-SET decision rather than a
  //   resolver-contract change — still not taken here.** **At 1v1 against a fighter that never bashes
  //   the two readings coincide**, and no promoted golden resolves direction 23
  //   at all, so no measurement distinguishes them today.
  //
  //   It matters because a critical BYPASSES ARMOUR: `effectiveMethod` of
  //   `critical` skips the armour branch entirely in the candidate ingress, so
  //   a bash that follows your own critical lands in full on hitpoints.
  "criticalhit",
  "equipped_weapon",
  "herolevel",
  // ► **THE SIX INVENTORY SLOTS, DECLARED 2026-09-19, AND THEY ARE THE
  //   `psyche_up` SHAPE: NO `SS2_RESOURCE_DEFAULTS` ENTRY.** A name WITH a
  //   default is filled into every combatant that does not state it — INCLUDING
  //   every golden's, because `ss2Combatant`'s bag loop runs unconditionally and
  //   `derive: false` does not stop it — and that moves all 23 golden replay
  //   hashes. Measured here before and after: 23 goldens, 23 unchanged hashes.
  //
  //   **NOTHING READS THEM YET, AND THAT IS THE WHOLE POINT OF DECLARING THEM
  //   FIRST.** Spells are inventory items: `villain_cast_spells` scans the six
  //   slots and calls `use_item`, so every remaining spell verb — `cast_gale`,
  //   `magic_damage_character` — is gated on a number that could not reach the
  //   resolver at all while these names were outside this list. The vocabulary
  //   is the half that can be landed and reviewed on its own, exactly as
  //   `psyche_up`'s was at `a89601c` before the verb arrived at `b201486`.
  //
  //   ► **ABSENT MEANS "THIS RECORD NEVER MENTIONED AN INVENTORY", NOT "EMPTY",
  //     AND THE DIFFERENCE IS LOAD-BEARING.** The build's empty marker is **1**,
  //     and a reader who assumes 0 gets it backwards. Measured across the whole
  //     7.5 MB oracle 2026-09-19 (wave `wf_1ee83aec-a10`, verified):
  //     **fourteen emptiness tests, every one `== 1`, and not one `== 0`**
  //     (`sprite:492[inventory_overlay]/frame:1` `+0x02af`… for slots 1-6, and
  //     the two charsheets for slots 3-6); **every literal write to a slot is 1**
  //     (`randomise_gladiator` `+0x330a`-`+0x334b`, `use_item` `+0x0409`, the
  //     hero's own six consume handlers at `sprite:862[overlay]/frame:1`
  //     `+0x0626`…); **zero writes of 0 anywhere**. So a gladiator carrying
  //     nothing declares six ones, not six zeroes, and a gladiator whose record
  //     is silent declares no key at all.
  //
  //   ► **0 IS STILL A "NOTHING" ROW, WHICH IS WHY THE CHAMPION DNA IS NOT A
  //     CONTRADICTION.** `_root.inventory0` and `_root.inventory1` are the same
  //     five-element row, BYTE-IDENTICAL after the name operand (file offsets
  //     `0x3FF6C8` and `0x3FF6E9` share a 25-byte tail). Seventeen of the
  //     nineteen authored champion literals spell an empty slot `0`; the code
  //     never does. **The table agrees; the code does not**, and three display
  //     sites really do behave differently for 0 than for 1 — so this engine
  //     spells empty the way the CODE does.
  //
  //   Deliberately NOT added to `CANONICAL_RESOURCE_SOURCES`: nothing writes a
  //   slot yet, and `emitResource` is silent about a resource that never moves,
  //   so mirroring would be an allowlist entry with no driver. It goes in with
  //   the verb, which is where `psyche_up`'s went.
  "inventory1",
  "inventory2",
  "inventory3",
  "inventory4",
  "inventory5",
  "inventory6",
  // ► **THE HERO PANEL'S SLOT WINDOW, DECLARED 2026-09-22, AND IT IS THE
  //   `psyche_up` SHAPE AGAIN: NO `SS2_RESOURCE_DEFAULTS` ENTRY.** Measured
  //   before and after: 23 goldens, 23 unchanged hashes.
  //
  //   `ss2InventorySlotHolding` reads it — the one place in the build that
  //   gates a slot on it in battle is `sprite:492[inventory_overlay]/frame:1`
  //   `+0x0216`-`+0x027e`, which hides `inventory_buttonI` when
  //   `i > _root.game.hero.inventory_maxslots` (`+0x024f`, `Greater`).
  //
  //   ► **NOT DERIVED FROM `herolevel`, AND THAT IS DELIBERATE.** The build
  //     computes it OUTSIDE battle — `initcharacter` from `characterDNA[40]`
  //     (`+0x098e`) and then a band chain 2/3/4/5/6 at `herolevel >=
  //     6/15/20/30/40` (`+0x0aa5`-`+0x0b39`); `randomise_gladiator` with its
  //     own `< 6 -> 1` arm (`+0x336f`-`+0x34a5`). Reproducing either chain in
  //     `ss2BattleValues` or `ss2Combatant` would put a value on EVERY
  //     combatant, which is a default by another name and moves every hash.
  //     **Declared only when a record states it.** Absent reads as the build's
  //     own `undefined`, which fails OPEN (`i > NaN` is false), so an
  //     undeclared gladiator keeps all six slots in both.
  //
  //   Deliberately NOT in `CANONICAL_RESOURCE_SOURCES`: nothing in battle
  //   writes it, so there is nothing to mirror.
  "inventory_maxslots",
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
  // ► **THE TICK CLOCK, DECLARED 2026-09-22 WITH THE OWNER'S TEAM-PLAY TICK
  //   RULE, AND IT IS THE `psyche_up` SHAPE: NO `SS2_RESOURCE_DEFAULTS`
  //   ENTRY.** AUTHORED, not a build field: whether a gladiator still owes the
  //   one bystander tick its own phase earned. `ss2Combatant` declares it
  //   beside a timed counter and nowhere else, so only a gladiator bearing a
  //   timed spell carries it. See `ss2TimedSpellBystanders`.
  SS2_TIMED_SPELL_CLOCK,
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
  // The two timed-buff counters: the cast arm's 20 and `nextphase`'s tick,
  // guarded on declaration like every other write here.
  "spell_boundless_energy",
  "spell_regenerate",
  // The four stat-spell counters: the arm's 16/20, the tick, and the expiry's
  // -1. (The stats they buy are written through `EffectKind.STAT`, not here.)
  "spell_bloodlust",
  "spell_colossus",
  "spell_little_fat_kid",
  "spell_swiftsandals",
  "staminaleft",
  // The tick clock: set by its bearer's own completed phase, cleared by the
  // next one anybody completes. See `ss2TimedSpellBystanders`.
  SS2_TIMED_SPELL_CLOCK,
  ...SS2_ARMOUR_PIECES
].sort());

/* ------------------------------------------------------------------ */
/* `battlevalues`: the build's own derivation, so a blueprint need not   */
/* hand-type a derived number                                          */
/* ------------------------------------------------------------------ */

/**
 * ONE piece's `<piece>_defence`, by `battlevalues`' own rule
 * (`root/frame:35` `+0x3480`-`+0x3633`) — the UNGATED block, which runs at the
 * end of every `nextphase` for both fighters (`+0x35f1`, `+0x3605`):
 *
 * ```text
 *   breastplate_defence = round(breastplate * breastplate_dval)            +0x3480
 *   helmet_defence = helmet > 25 ? round(herolevel * 0.5 * helmet_dval)    +0x34eb
 *                                : round(helmet * helmet_dval)             +0x34bf
 *   shinguard / greaves / shoulderguard / gauntlet / boot: round(id * dval) +0x351f-+0x35e1
 *   shield_defence = using_bow ? 0 : round(shield * shield_dval)          +0x3623 / +0x35f7
 * ```
 *
 * Lifted out of `ss2BattleValues` (2026-09-22) so that `cast_rejuvinate`, the
 * one verb that gives a piece its id back, prices it by the SAME function
 * rather than a second copy of the rule.
 */
function ss2PieceDefence(piece, id, { herolevel = 1, usingBow = false } = {}) {
  const dval = SS2_ARMOUR_DVAL[piece];
  // `+0x34eb` above id 25, `+0x34bf` at or below it. Both arms assign.
  if (piece === "helmet") return id > 25 ? Math.round(herolevel * 0.5 * dval) : Math.round(id * dval);
  // `+0x35f7`, or the flat 0 at `+0x3623` while `using_bow` is true.
  if (piece === "shield") return usingBow ? 0 : Math.round(id * dval);
  return Math.round(id * dval);
}

/**
 * The order `battlevalues` assigns the eight `_defence` fields in
 * (`+0x3480` breastplate, `+0x34bf`/`+0x34eb` helmet, `+0x351f` shinguard,
 * `+0x3546` greaves, `+0x356d` shoulderguard, `+0x3594` gauntlet, `+0x35bb`
 * boot, `+0x35f7`/`+0x3623` shield) — which is NOT `SS2_ARMOUR_PIECES`' order.
 */
const SS2_BATTLEVALUES_DEFENCE_ORDER = Object.freeze([
  "breastplate", "helmet", "shinguard", "greaves", "shoulderguard", "gauntlet", "boot", "shield"
]);

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
    derived[`${piece}_defence`] = ss2PieceDefence(piece, number(piece), { herolevel, usingBow });
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
  //   secondary pair are computed outside the block), and everything else
  //   keeps the mode the record actually states.
  //
  //   ► **~~including `shield_defence`, which the build really does zero while
  //     a bow is drawn (`+0x3623`)~~ — AND `shield_defence` IS A FOURTH, found
  //     2026-09-22 with the bow-drawn shield removal.** It is the same shape
  //     of defect: the build zeroes it in place and rebuilds it on the
  //     sheathing swap (`+0x4fab`), and a bag that took the 0 kept it after the
  //     swap back, so the shield came off a swordsman for nothing. The bag
  //     now holds the SHEATHED rating and `vanillaRecordOf` zeroes it while
  //     `equipped_weapon` is 2, so the drawn bow still costs the shield its
  //     value, at the moment `remove_armour` reads it. Only the rating moves:
  //     the pools are derived from the stated mode exactly as before. A
  //     `derive: false` record that STATES `shield_defence: 0` beside
  //     `equipped_weapon: 2` still keeps its 0 after sheathing — named, not
  //     solved; no golden states `equipped_weapon` at all.
  if (derive && vanilla?.using_bow === true) {
    const sheathed = ss2BattleValues({ ...vanilla, using_bow: false }, { battleStarted });
    for (const field of ["min_damage", "max_damage", "weapon_range", "shield_defence"]) {
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
  // ► **A TIMED-BUFF COUNTER IS DECLARED BY POSSESSION, AT 0 — INVENTED, AND
  //   FORCED BY THE RESOLVER RATHER THAN BY TASTE.** The build's clip creates
  //   `attacker.spell_regenerate` on the arm's first write; this resolver
  //   REFUSES to create a resource mid-battle (`writeResource`, constraint 2 of
  //   `src/team/resources.js`). So a gladiator carrying id 46 whose record said
  //   nothing about the counter could never hold what its own cast writes, and
  //   the button would have to be hidden. Declaring it here, at construction,
  //   for exactly the gladiators who carry the item, is the one way to keep the
  //   build's gate — possession — as the offer.
  //
  //   **0 is the build's "no buff" and cannot move anything**: the build holds
  //   `undefined` until the first cast (no initialiser anywhere in the oracle),
  //   `undefined > 0` and `0 > 0` are both false, and `check_spells` decrements
  //   only while `> 0`. No golden and no roster gladiator carries 45 or 46, so
  //   no pinned hash moves; a record that STATES the counter keeps its value.
  //   Every declared slot counts, the window included — declaring is inert, and
  //   the villain's `use_item` ignores the window anyway.
  for (const buff of Object.values(SS2_TIMED_BUFFS)) {
    if (Object.hasOwn(resources, buff.counter)) continue;
    if (SS2_INVENTORY_SLOTS.some((slot) => resources[slot] === buff.itemId)) resources[buff.counter] = 0;
  }
  // ► **THE REJUVENATE BACKUPS ARE DECLARED BY POSSESSION TOO, AT THE VALUE OF
  //   THE FIELD EACH ONE BACKS — for the counters' reason, and at the build's
  //   own moment.** `backup_char` copies the nine fields onto `backup_*` before
  //   the fight (`sprite:2249/frame:1` `+0x010a` hero, `+0x012e` villain) and
  //   nothing writes them in battle, so construction IS the snapshot. Without
  //   them a caster of id 43 could refill its pools but never get a piece back,
  //   and the resolver will not create them mid-battle.
  //
  //   Only a field the combatant DECLARES gets a backup: the eight armour pieces
  //   always are (`SS2_RESOURCE_DEFAULTS`), `weapon` only when a record states
  //   it — absent is not zero, and zero is a real weapon row. A STATED backup
  //   wins (a capture's `game_*` object carries all nine), and a record rebuilt
  //   mid-battle with `battleStarted` that states none snapshots what it holds
  //   NOW, which is later than the build's snapshot — named, not solved: no
  //   such record carries id 43 today. No golden, no roster gladiator and no
  //   seeded pin carries 43, so no pinned hash moves.
  if (SS2_INVENTORY_SLOTS.some((slot) => resources[slot] === SS2_REJUVENATE.itemId)) {
    for (const { piece, backup } of SS2_REJUVENATE.restores) {
      if (Object.hasOwn(resources, backup) || !Object.hasOwn(resources, piece)) continue;
      resources[backup] = resources[piece];
    }
  }
  // ► **AND THE TICK CLOCK GOES WITH THEM — AFTER every counter is declared,
  //   so a counter declared by any rule above brings it.** At 1: before any
  //   phase has completed, every bearer counts as owed, which is what makes the
  //   bout's first phase tick the defender in 1v1 exactly as the build's first
  //   `nextphase` does. A stated clock (a restored bout) is kept. See
  //   `ss2TimedSpellBystanders`; `assertConstructionResources` refuses a
  //   counter that arrives without one.
  if (!Object.hasOwn(resources, SS2_TIMED_SPELL_CLOCK)
    && SS2_TIMED_SPELL_COUNTERS.some((counter) => Object.hasOwn(resources, counter))) {
    resources[SS2_TIMED_SPELL_CLOCK] = 1;
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
 * The bounds a resource is (or will be) declared with, off either shape — or
 * `null` when it is not declared. `null` for a bound means unbounded. Mirrors
 * `normaliseResourceBag`: a shorthand number, and an object with no `min`,
 * both get a floor of 0; an absent `max` is none.
 */
function declaredResourceBoundsOf(carrier, name) {
  const entry = carrier?.resources?.[name];
  if (entry === undefined || entry === null) return null;
  if (Number.isFinite(entry)) return { min: 0, max: null };
  return { min: entry.min === undefined ? 0 : entry.min, max: entry.max ?? null };
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
  // ► **A TIMED COUNTER MUST ARRIVE WITH ITS TICK CLOCK (2026-09-22).** Without
  //   one a gladiator is never owed, so its counter ticks on its own phases only
  //   and a 1v1 silently stops being the build. `ss2Combatant` always declares
  //   the pair; this catches a blueprint built past it, before any draw.
  if (!Number.isFinite(declaredResourceValue(carrier, SS2_TIMED_SPELL_CLOCK))) {
    const bare = SS2_TIMED_SPELL_COUNTERS.filter((name) => Number.isFinite(declaredResourceValue(carrier, name)));
    if (bare.length > 0) {
      throw new TeamRuleSetError(
        `${where} declares ${bare.join(", ")} but not ${SS2_TIMED_SPELL_CLOCK}, the tick clock that says whether ` +
        "it is owed a bystander tick. Without it the counter would tick on its own phases only. Build the " +
        `combatant with ss2Combatant(), or declare resources: { ${SS2_TIMED_SPELL_CLOCK}: 1 } beside the counter.`
      );
    }
  }
  // ► **AND EVERY TIMED RESOURCE MUST BE ABLE TO HOLD WHAT THE RULE SET WRITES
  //   TO IT (2026-09-22, found by Codex).** The resolver clamps a write to the
  //   declared bounds without a word, so a counter whose floor sits above the
  //   expiry's -1 restores on every tick, and one whose ceiling sits below the
  //   arm's duration runs short. See `SS2_TIMED_RESOURCE_RANGE`.
  for (const [name, [low, high]] of Object.entries(SS2_TIMED_RESOURCE_RANGE)) {
    const bounds = declaredResourceBoundsOf(carrier, name);
    if (bounds === null) continue;
    if ((bounds.min === null || bounds.min <= low) && (bounds.max === null || bounds.max >= high)) continue;
    const why = low < 0
      ? `-1 is what the expiry writes after restoring the stats; clamped to ${bounds.min} the counter sits at ` +
        "or above check_spells' `== 0`, which restores them again on every tick"
      : "a floor above the inert value holds the counter live for ever, and a ceiling below the arm's " +
        "duration cuts the buff short";
    throw new TeamRuleSetError(
      `${where} declares ${name} with bounds [${bounds.min ?? "none"}, ${bounds.max ?? "none"}], and this rule ` +
      `set writes it anywhere from ${low} to ${high}: ${why}. A shorthand number has a floor of 0. Declare ` +
      `resources: { ${name}: { value: ${low}, min: ${low} } }, or let ss2Combatant() and the opening declare it.`
    );
  }
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
  // ► **THE LIVE STRENGTH'S PAIR, which `battlevalues` recomputes every phase
  //   (`+0x3356`, `+0x3386`).** 0 for every gladiator no stat spell has
  //   touched — every golden among them — so the fallback chain below is
  //   byte-for-byte what it was. See `ss2MeleeStrengthShift`.
  const meleeShift = bowPair ? 0 : ss2MeleeStrengthShift(view);
  // `attack`, `defence` and `strength` below are the LIVE stats, which is what
  // the build reads: `attack_chances(game_attacker, game_defender)` reads
  // `attack` and `defence` straight off the combat objects (overlay frame 1
  // `+0x03ef`, `+0x0404`), the very fields the stat spells write.
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
    min_damage: bowPair ? bowPair.min_damage : read("min_damage", 1) + meleeShift,
    max_damage: bowPair ? bowPair.max_damage : read("max_damage", read("min_damage", 1)) + meleeShift,
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
  // ► **THE OTHER FIELD THAT DEPENDS ON WHICH WEAPON IS IN HAND: THE SHIELD'S
  //   RATING, WHICH A DRAWN BOW ZEROES.** `battlevalues` gives `shield_defence`
  //   a flat 0 while `using_bow == true` (`+0x35e2`-`+0x35f2`, `+0x3623`) and
  //   `round(shield * 12)` otherwise (`+0x35f7`), and the build runs it in the
  //   swap arm itself (`+0x4ea1` drawing, `+0x4fab` sheathing) and again at
  //   every `nextphase` (`+0x35f1`, `+0x3605`). `remove_armour` subtracts that
  //   field from both pools (`+0x0ca2`-`+0x0ccd`), while the pools themselves
  //   are rebuilt only before the fight (`+0x3a90`-`+0x3aa0`). **So a shield
  //   knocked off a gladiator holding its bow costs NOTHING**, and until
  //   2026-09-22 it cost this engine its melee value: 44/44 -> 32/32 where the
  //   build stays at 44/44 (reproduced by the rejuvenate implementer, then
  //   pinned in `test/ss2-weaken-armour.test.js`).
  //
  //   Selected HERE, at read time, for the damage pair's reason: the swap
  //   writes one resource, `equipped_weapon`, and the bag keeps the SHEATHED
  //   value — so swapping back finds the shield's rating intact, which is what
  //   the build's sheathing `battlevalues` recomputes. This record is the only
  //   road from the bag to `remove_armour`, the attack path's and the spell's
  //   alike, and no effect writes a `_defence` back out of it.
  if (ss2InBowMode(view)) {
    record.shield_defence = ss2PieceDefence("shield", record.shield, { usingBow: true });
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

function defenderEffects(before, after, target, { psycheReset = "on-damage" } = {}) {
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
  //
  // ► **BUT THE TWO INGRESSES DISAGREE, AND THIS FUNCTION SPOKE FOR ONLY ONE OF
  //   THEM UNTIL 2026-09-20.** `damagecharacter`'s reset at `+0x1be4` sits
  //   inside the hit branch, so the physical path resets on a LANDED blow —
  //   that is `"on-damage"` and it is this function's default because the
  //   attack path is what it was written for. `magic_damage_character`'s reset
  //   at `+0x148e` is **step 4, an unconditional join**: the write sits after
  //   the hitpoint subtraction but outside every branch, so a spell or
  //   enchantment tick that armour absorbs ENTIRELY still clears the victim's
  //   charge.
  //
  //   `resolveStatusPhase`'s own docstring has named that write "the
  //   unconditional `psyche_up = 1`" since it was written, and the code it
  //   documents did not deliver it: a fully-absorbed enchantment tick left the
  //   victim's charge standing. Found while deriving the bolt phase, which goes
  //   through the same ingress. **`"always"` is the magic ingress's rule and
  //   `"on-damage"` is the physical one; neither is a default the other can
  //   borrow.**
  const psycheChanged = psycheReset === "always" || after.hitpoints < before.hitpoints;
  if (declared.has("psyche_up") && psycheChanged
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
 * The request each `resolveAction` is resolving, keyed by its own frozen actor
 * view — so `phaseTransitionEffects`, which every completed phase already calls
 * with `request.actor` and nothing else, can reach the rest of the field
 * without a parameter threaded through every one of its call sites.
 *
 * ► **WHY A LOOKUP AND NOT A PARAMETER.** `check_spells` runs for the defender
 *   as well as the attacker at every `nextphase`, so the transition needs the
 *   bystanders (to find the one owed a tick, `ss2TimedSpellBystanders`); the
 *   alternative is editing every branch that transitions, and the branch that
 *   forgot would silently skip the tick. Here a branch added tomorrow ticks the
 *   field by calling the transition it already has to call. **A view the
 *   registry does not know is REFUSED, not skipped** (see
 *   `ss2TimedSpellTick`): a branch that hands the transition a COPY of the
 *   actor is told so, rather than quietly ticking nobody.
 *
 * A `WeakMap` over a view `combatantView` builds fresh for every action: no
 * state survives the action, nothing is shared between two resolutions, and a
 * re-entrant resolve registers its own key.
 */
const SS2_PHASE_REQUESTS = new WeakMap();

/**
 * ► **THE TEAM-PLAY TICK RULE: WHO BESIDES THE ACTOR A COMPLETED PHASE TICKS.
 *   THE OWNER'S DECISION, 2026-09-22: "bearer's turns, 1v1-exact".** A timed
 *   buff applies ten times whatever the team size, AND in 1v1 every counter
 *   value at every phase is the build's.
 *
 *   **A bearer's counters tick on the bearer's OWN completed phase and on the
 *   FIRST phase anybody else completes after it — and on no other.**
 *   Equivalently: a completed phase ticks its actor and the actor of the most
 *   recent earlier completed phase, if that is somebody else and still alive.
 *   The buffs still apply to the ACTOR alone.
 *
 *   - **Why it is the build in 1v1.** `nextphase` calls `check_spells` for the
 *     attacker and then the defender (`+0x3271`, `+0x3289`), so both fighters
 *     tick on every phase. In a duel the fighters strictly alternate and a kill
 *     ends the bout, so the phase after mine is always the foe's: every phase
 *     ticks both, exactly. Pinned phase by phase against `check_spells` on both
 *     fighters, casts, recasts and defender-borne counters included, in
 *     `test/ss2-timed-buffs.test.js` ("1v1 IS THE BUILD").
 *   - **Why it is ten above 1v1.** A bearer's cycle between two of its own
 *     phases now costs two ticks whoever else acts, so 20 applies at 19, 17,
 *     …, 1 in 2v2 and 3v3 as in 1v1.
 *
 *   **HISTORY — THE RULE THIS REPLACED, the main session's of the same day:**
 *   every completed phase ticked every LIVING combatant. Build-exact in 1v1
 *   too, but a buff was worth less the more gladiators shared the field: in a
 *   strict rotation with nobody dying a cast applied ten times in 1v1 (19, 17,
 *   …, 1), FIVE in 2v2 (19, 15, 11, 7, 3) and FOUR in 3v3 (19, 13, 7, 1). The
 *   old function was the filter below without its clock test, and there was
 *   no clock.
 *
 *   ► **WHERE "OWES ONE BYSTANDER TICK" LIVES: `SS2_TIMED_SPELL_CLOCK`, a
 *     resource on the bearer, and ONLY on a bearer.** The resolver must stay a
 *     pure function of replayable state, and "who completed the previous
 *     phase" is not in the request: `actorView` hands over `turnNumber`,
 *     `actor`, `allies` and `foes` (and, since 2026-09-22, the battle's own
 *     declared pools, `battleResources`) and nothing else — no initiative, no turn
 *     cursor, no event log, and no dead (so the rule set cannot even rebuild
 *     `ss2InitiativeOrder`'s interleave, which needs the dead). The resolver
 *     HAS all of that, hashed; exposing it would be a resolver-contract change,
 *     the same fork the `criticalhit` note in `SS2_RESOURCE_NAMES` records —
 *     and "the previous ACTOR" is not quite the rule anyway, because a phase
 *     that kills must not count (below), and which phases completed is the
 *     rule set's knowledge, not the resolver's. So the
 *     fact is carried per bearer: `ss2Combatant` declares it at 1 beside any
 *     timed counter (before any phase completes everybody counts as owed, which
 *     is what makes the bout's first phase tick the defender as the build's
 *     first `nextphase` does), with no default, so **a gladiator bearing no
 *     timed spell carries no new hashed state and no golden moves** (census
 *     23/23 unchanged). `ss2TimedSpellTick` clears it on every bystander it
 *     pays and sets it on the actor. At most one living bearer holds a 1 after
 *     the first completed phase.
 *
 *   **THE DEATH RULE: A PHASE THAT KILLS DOES NOT EXIST FOR THE CLOCK.** This
 *   engine skips the whole transition on a kill (`death()` deletes `nextphase`
 *   in the build, so `check_spells` never runs), and the tick and the clock
 *   both live in that transition, so:
 *   - **the killer's OWN phase** ticks nothing — not its own counters, nobody
 *     else's — and earns it no owed tick; the gladiator owed before it stays
 *     owed. Its buff neither ticks nor applies on the phase it killed in.
 *   - **an owed tick survives a killing phase** — including one whose victim
 *     was the next actor — and is paid by the next phase anybody COMPLETES.
 *   - **an owed bearer that dies** takes the tick with it: the dead are never
 *     ticked (`request.foes`/`request.allies` are the living), and nobody
 *     inherits the debt.
 *   Pinned in `test/ss2-timed-buffs.test.js`, one test each.
 *
 *   **A BEARER WHO IS NOT THE CASTER** — `cast_little_fat_kid` writes its
 *   counter on the DEFENDER's clip (`+0x820b`) during the caster's phase —
 *   **is the bearer here**: the clock is per gladiator, not per counter, so
 *   its counter ticks on its own phases and on the one after each. In 1v1 the
 *   defender is always owed at the caster's phase, so the write is ticked in
 *   the phase that made it, as the build ticks it; pinned with a counter
 *   staged on the defender just before the attacker's phase. **What that pin
 *   cannot reach**: the tick reads a bystander's counter off the frozen view,
 *   so an arm that writes a bystander's counter in the same phase must hand
 *   that value to `ss2TimedSpellTick` the way `armCounters` does for the
 *   actor, or the tick decrements the stale one.
 *
 *   - **Order**: foes, then allies, so that in 1v1 the list is the defender and
 *     the order is the build's `attacker, defender`. Above 1v1 the order is
 *     unobservable — each write names its own combatant.
 *   - **Generic over `SS2_TIMED_SPELL_COUNTERS`**: a counter added there is
 *     ticked on exactly this schedule, bystander ticks included, with no change
 *     here; an expiry step belongs inside the per-counter tick, which runs for
 *     the actor and for each bystander this returns.
 */
function ss2TimedSpellBystanders(request) {
  return [...(request.foes ?? []), ...(request.allies ?? [])].filter((combatant) =>
    combatant.id !== request.actor.id && resourceValue(combatant, SS2_TIMED_SPELL_CLOCK, 0) > 0);
}

/**
 * `check_spells(which_character, which_avatar)` for ONE combatant
 * (`+0x2439`-`+0x278f`), counter by counter in the build's order:
 *
 * ```text
 *   if (c > 0) c -= 1
 *   if (c == 0) { stats = backup_*; c = -1 }     the four stat counters only
 * ```
 *
 * ► **THE EXPIRY IS OUTSIDE THE DECREMENT, AND THAT IS THE WHOLE REASON THE
 *   INERT VALUE IS -1.** A counter decremented 1 -> 0 restores in the SAME
 *   call, and one that ENTERS at 0 restores too; -1 and the build's
 *   `undefined` pass by both tests. See `SS2_STAT_SPELL_INERT`.
 *
 * ► **IT RUNS WHEREVER THE TICK RUNS**, for the actor and for every bystander
 *   the tick policy names, so an expiry follows whatever policy
 *   `ss2TimedSpellBystanders` sets. The restores are `EffectKind.STAT` writes
 *   from the carrier's own `backup_*`, emitted before the counter's -1 — the
 *   build's last write — and after anything the phase's arm wrote, so an arm's
 *   stat write in the same phase is overridden, as `nextphase` overrides it.
 *
 * An UNDECLARED counter is the build's `undefined` and is skipped:
 * `undefined > 0` and `undefined == 0` are both false.
 *
 * @param {object} carrier  a frozen view
 * @param {object|null} armed  counters the phase ARM wrote on this carrier's
 *   clip before `nextphase` ran, read in place of the stored value
 * @param {{ tick?: boolean }} [options] `tick: false` lands the arm's writes
 *   without running `check_spells` — for a carrier the policy does not tick
 */
function ss2CheckSpells(carrier, armed, { tick = true } = {}) {
  const effects = [];
  const after = {};
  const declared = declaredResourceNames(carrier);
  for (const counter of SS2_TIMED_SPELL_COUNTERS) {
    const written = armed?.[counter];
    if (!declared.has(counter)) {
      if (written !== undefined) {
        throw new TeamRuleSetError(
          `${carrier.id} would set ${counter}, which it does not declare; the resolver creates no resource ` +
          "mid-battle. ss2Combatant declares the timed buffs' for any gladiator carrying the item, and the " +
          "opening declares the stat spells' on whoever they can land on."
        );
      }
      continue;
    }
    const stored = resourceValue(carrier, counter);
    let value = written ?? stored;
    const restores = SS2_TIMED_SPELL_EXPIRY[counter];
    let expired = false;
    if (tick) {
      if (value > 0) value -= 1;
      expired = restores !== undefined && value === 0;
      if (expired) value = SS2_STAT_SPELL_INERT;
    }
    if (written === undefined && !tick) continue;
    after[counter] = value;
    if (expired) {
      for (const stat of restores) {
        effects.push({ kind: EffectKind.STAT, targetId: carrier.id, stat, to: ss2BackupStat(carrier, stat) });
      }
    }
    if (value !== stored) {
      effects.push({ kind: EffectKind.RESOURCE, targetId: carrier.id, resource: counter, to: value });
    }
  }
  return { effects, after };
}

/**
 * `nextphase` step 3: `check_spells` for the actor, then for the owed bystander
 * `ss2TimedSpellBystanders` names — see `ss2CheckSpells` for what one call
 * does — and then the tick clock's bookkeeping.
 *
 * The clock (`SS2_TIMED_SPELL_CLOCK`) is written after every tick, and only
 * when it changes: each bystander just paid goes to 0, and the actor, whose
 * phase this is, goes to 1. A gladiator declaring no clock is never written.
 *
 * @param {object} actor        the frozen view `resolveAction` registered
 * @param {object|null} armCounters  what the phase ARM left on the actor's clip
 *   before `nextphase` ran — `{ spell_regenerate: 20 }` for a cast. Read in
 *   place of the stored value, and ticked like it.
 * @param {object|null} armCountersOn  what the arm left on SOMEBODY ELSE's
 *   clip, by combatant id — little fat kid's `defender.spell_little_fat_kid =
 *   16` (`+0x820b`). Ticked if the policy ticks that combatant; written as the
 *   arm left it if it does not.
 * @returns {{ effects: object[], after: object, afterOn: object }} `after` is
 *   the actor's own post-tick counters, which is what the effect tests read;
 *   `afterOn` the same for every id in `armCountersOn`.
 */
function ss2TimedSpellTick(actor, armCounters, armCountersOn = null) {
  const request = SS2_PHASE_REQUESTS.get(actor);
  if (request === undefined) {
    throw new TeamRuleSetError(
      `phaseTransitionEffects was handed an actor view for ${String(actor?.id)} that resolveAction did not ` +
      "register. Pass request.actor itself, not a copy: the transition ticks the owed bystander's timed spell " +
      "counters and reads the field from the request that view belongs to."
    );
  }
  const own = ss2CheckSpells(actor, armCounters);
  const effects = [...own.effects];
  const afterOn = {};
  // Whoever the policy ticks, each through the same `check_spells` — so the
  // four stat counters' expiry runs for a bystander exactly as for the actor.
  const paid = ss2TimedSpellBystanders(request);
  for (const bystander of paid) {
    // A counter an arm wrote on this bystander in THIS phase (little fat
    // kid's victim) is read in place of the frozen view's stale value, the way
    // `armCounters` is for the actor — or the tick would decrement the old one.
    const theirs = ss2CheckSpells(bystander, armCountersOn?.[bystander.id] ?? null);
    effects.push(...theirs.effects);
    if (armCountersOn?.[bystander.id]) afterOn[bystander.id] = theirs.after;
  }
  // An arm's write on somebody the policy does NOT tick this phase still lands,
  // unticked: the arm's `SetMember` happens whatever `nextphase` then does.
  for (const [id, armed] of Object.entries(armCountersOn ?? {})) {
    if (paid.some((bystander) => bystander.id === id)) continue;
    const carrier = [...(request.foes ?? []), ...(request.allies ?? [])].find((combatant) => combatant.id === id);
    if (!carrier) throw new TeamRuleSetError(`An arm wrote a timed counter on ${id}, who is not on the field.`);
    const landed = ss2CheckSpells(carrier, armed, { tick: false });
    effects.push(...landed.effects);
    afterOn[id] = landed.after;
  }
  // The clock, after every tick: each owed bystander has just been paid, and
  // the actor — whose phase this is — now owes one to whoever completes the
  // next phase. Written only when it changes, so a gladiator bearing no timed
  // spell (and so declaring no clock) is never touched.
  for (const bystander of paid) {
    effects.push({ kind: EffectKind.RESOURCE, targetId: bystander.id, resource: SS2_TIMED_SPELL_CLOCK, to: 0 });
  }
  if (declaredResourceNames(actor).has(SS2_TIMED_SPELL_CLOCK) && resourceValue(actor, SS2_TIMED_SPELL_CLOCK) !== 1) {
    effects.push({ kind: EffectKind.RESOURCE, targetId: actor.id, resource: SS2_TIMED_SPELL_CLOCK, to: 1 });
  }
  return { effects, after: own.after, afterOn };
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
 * @param {object|null} armCounters  timed-spell counters the phase ARM wrote on
 *   the actor's clip before `nextphase` ran (`{ spell_regenerate: 20 }` for
 *   `cast_regenerate`); see `ss2TimedSpellTick`.
 * @param {object|null} armCountersOn  the same for counters the arm wrote on
 *   somebody else's clip, by id — `cast_little_fat_kid`'s victim.
 * @param {number} crowdAction  what the phase left in `_global.crowd_action`
 *   when `nextphase` read it — the arm's top write where it has one
 *   (`SS2_CROWD_ACTION`), the damage path's last write where it has none
 *   (`ss2StrikeCrowdAction`), 0 for an arm that writes nothing. **REQUIRED,
 *   with no default**: a branch that forgot it would add 0 in silence, and 0
 *   is a real answer for six arms and the wrong one for thirty.
 *
 * ► **ONE THING HERE IS NOT ATTACKER-ONLY, AND IT IS THE FIRST THING `nextphase`
 *   DOES: the timed-spell tick** (step 3, `+0x3271`/`+0x3289`), which reaches
 *   the bystander owed a tick through `ss2TimedSpellBystanders` — in 1v1,
 *   always the defender, as in the build — and with it the four stat spells'
 *   expiry. The two EFFECTS regenerate and boundless buy (steps 8 and 9) are
 *   attacker-only, like everything else.
 *
 * ► **AND A SECOND THING BELONGS TO NOBODY: STEP 10, THE CROWD**
 *   (`+0x3541`-`+0x35b4`, modelled 2026-09-22). `crowd_interest +=
 *   crowd_action`, clamped 1..100, on the battle's one pool — see
 *   `src/team/ss2-crowd.js`. It runs wherever this runs, so a phase that KILLS,
 *   which skips this whole function because `death()` deletes `nextphase`,
 *   adds nothing, exactly as in the build.
 */
function phaseTransitionEffects(
  actor,
  { staminaCost, branchGain = 0, branchHeal = 0, fromStaminaleft = null, fromHealth = null,
    resetsPsyche = true, armCounters = null, armCountersOn = null, crowdAction }
) {
  if (!Number.isFinite(crowdAction)) {
    throw new TeamRuleSetError(
      `phaseTransitionEffects was called for ${String(actor?.id)} without the phase's crowdAction. Every ` +
      "completed phase adds what its arm left in crowd_action (nextphase +0x3541); see src/team/ss2-crowd.js."
    );
  }
  const declared = declaredResourceNames(actor);
  const stamina = actor.stats.stamina;
  const effects = [];
  let staminaGained = 0;

  // Step 3, `check_spells` — BEFORE the stamina arithmetic, as the build has
  // it, so the effect tests at steps 8 and 9 read the post-tick counter and the
  // cast phase itself (20 -> 19) applies.
  const timed = ss2TimedSpellTick(actor, armCounters, armCountersOn);
  effects.push(...timed.effects);
  // Kept for step 9, which adds AFTER the floor rather than inside it.
  let staminaFloored = null;
  let staminaBefore = null;
  let staminaMaximum = null;

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
    staminaFloored = after;
    staminaBefore = before;
    staminaMaximum = maximum;
  }

  const healed = Math.min(
    branchHeal + 1 + Math.ceil(stamina / 2),
    Math.max(0, actor.maxHealth - health)
  );
  if (healed > 0) {
    effects.push({ kind: EffectKind.HEAL, targetId: actor.id, amount: healed });
  }

  // ► **STEPS 8 AND 9: THE TWO TIMED BUFFS, ON THE ACTOR ONLY, EACH AFTER A
  //   `check_stats` AND EACH FOLLOWED BY ONE** (`+0x33bd`-`+0x3475`,
  //   `+0x3476`-`+0x3540`). Emitted as their OWN effects, after the ones above,
  //   so the log carries the build's order and a gladiator with no active buff
  //   gets exactly the effect list it always did.
  //
  //   **Regeneration** is `round(hitpointsmax / 4)` on top of a hitpoint pool
  //   already capped at step 7. Every term is non-negative, so a single clamp
  //   would agree — it is kept separate anyway, as the build orders it.
  //
  //   **Boundless energy CANNOT be folded into the clamp above, and that is the
  //   one number here a shortcut would get wrong.** Step 7 floors the stamina
  //   first, and the `round(staminamax / 4)` lands on the FLOORED value: 5 left,
  //   cost 30, stamina 6, max 160 is -22, floored to 0, then 40 — where one
  //   clamp over the sum gives 18.
  let regenerated = 0;
  if (timed.after[SS2_TIMED_BUFFS[Ss2ActionType.CAST_REGENERATE].counter] > 0) {
    const gain = Math.round(actor.maxHealth / SS2_TIMED_BUFFS[Ss2ActionType.CAST_REGENERATE].divisor);
    regenerated = Math.min(gain, Math.max(0, actor.maxHealth - (health + healed)));
    if (regenerated > 0) {
      effects.push({ kind: EffectKind.HEAL, targetId: actor.id, amount: regenerated });
    }
  }
  let boundlessGained = 0;
  if (timed.after[SS2_TIMED_BUFFS[Ss2ActionType.CAST_BOUNDLESS_ENERGY].counter] > 0 && staminaFloored !== null) {
    const gain = Math.round(staminaMaximum / SS2_TIMED_BUFFS[Ss2ActionType.CAST_BOUNDLESS_ENERGY].divisor);
    const boosted = clamp(staminaFloored + gain, 0, staminaMaximum);
    boundlessGained = boosted - staminaFloored;
    if (boosted !== staminaFloored) {
      effects.push({ kind: EffectKind.RESOURCE, targetId: actor.id, resource: "staminaleft", to: boosted });
    }
    staminaGained = boosted - staminaBefore;
  }
  // ► **STEP 10, THE CROWD: `crowd_interest += crowd_action`, CLAMPED 1..100,
  //   THEN `crowd_action = 0`** (`+0x3541`-`+0x35b4`) — after the two buffs
  //   and before the psyche reset (`+0x35c7`), the build's order. On the
  //   battle's own pool, read off this phase's request. A battle that declares
  //   no crowd (`ss2CrowdOpening`) and a step that moves nothing emit nothing.
  effects.push(...ss2CrowdStepEffects(SS2_PHASE_REQUESTS.get(actor)?.battleResources, crowdAction));
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

  // `healed` and `staminaGained` are everything `nextphase` did, buffs
  // included; `regenerated`/`boundlessGained` say how much of it was the buffs,
  // and `timedSpells` is the actor's own post-tick counters (`timedSpellsOn`
  // the same for whoever `armCountersOn` named).
  return {
    effects,
    staminaGained,
    healed: healed + regenerated,
    regenerated,
    boundlessGained,
    timedSpells: timed.after,
    timedSpellsOn: timed.afterOn
  };
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
      fromHealth: victimAfter.hitpoints,
      // The status arm writes `crowd_action = 0` on EVERY tick (`+0x52af`,
      // `+0x53e3`, `+0x5517`, `+0x564b`), overwriting the tick's own
      // `magic_damage_character` 2 (`+0x13cb`): a status turn adds nothing.
      crowdAction: ss2CrowdActionOf(label)
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
    // `"always"`: this tick goes through `magic_damage_character`, whose
    // `psyche_up = 1` is an unconditional join (map step 4, `+0x148e`). A tick
    // that armour absorbs entirely still clears the victim's charge, and this
    // call passed the physical path's `"on-damage"` rule until 2026-09-20.
    ...defenderEffects(victimBefore, victimAfter, actor, { psycheReset: "always" }),
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
  "sprite:862/frame:52/DoAction@0x23f835/villainChooseAction@+0x03e8",
  // The bolt phase and the gate that offers it, added 2026-09-20 with the two
  // `cast_*_bolt` verbs. Three refs rather than one, because the phase, the
  // villain's offer ladder and the hero's button panel are three different
  // functions in three different blocks and each is load-bearing on its own.
  "overlay:862/frame:52/DoAction@0x240c7f/cast_lightning_bolt@+0x83f5",
  "overlay:862/frame:52/DoAction@0x23e7cf/villain_cast_spells@+0x04e4",
  "sprite:492/frame:1/DoAction@0x50e4f/inventory_overlay@+0x0216"
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
   * ► ~~**WHAT IT ACTUALLY DOES, measured over 40 seeded 3v3 bouts on the demo
   *   roster**~~ **THE TABLE BELOW DOES NOT REPRODUCE, AND THE FLAG IS INERT
   *   WHERE ANYBODY CAN SEE IT — corrected 2026-09-18 by an audit and
   *   re-measured here.**
   *
   *   Driven through `createVanillaBattleHost` exactly as `tools/arena/main.js`
   *   builds it, 20 seeded 3v3 bouts on the demo roster: **1,653 actions and
   *   `psyche-up` chosen ZERO times with the flag ON, byte-identical to the
   *   flag OFF**, 20/20 bouts resolved either way. The same holds at `1775a4c`,
   *   the commit that shipped the flag.
   *
   *   ~~**The cause is the gate two paragraphs down, not the wind-up policy.**
   *   `legalActions` offers `psyche_up` only at `herolevel >= 7` in melee mode
   *   and `>= 3` in bow mode, and every demo gladiator is level 4.~~
   *   **THAT IS ONE GATE OF TWO, AND IT IS NOT THE BINDING ONE — measured
   *   2026-09-19.** The level gate is real and sits at exactly 7: over 60
   *   seeded 3v3 bouts, `psyche_up` is offered 600 times at level 4 or 6 (the
   *   two archers only, 0 to a warrior) and 4,753 times at level 7, of which
   *   **2,654 go to warriors**. **And the charging AI still takes it ZERO
   *   times**, at levels 7, 9 and 12 alike, with `aiCharges` on:
   *
   *   ```text
   *     herolevel   offers   charges taken   (aiCharges: true)
   *         4          600         0
   *         6          600         0
   *         7        4,753         0
   *         9        5,145         0
   *        12        5,145         0
   *   ```
   *
   *   **THE BINDING GATE IS `survivesTheWindUp` IN THIS FILE**, not
   *   `legalActions`. It asks `actor.health > engaged.max_damage * presses`,
   *   and the demo roster is 46 max health against a foe whose `max_damage` is
   *   17: `46 > 51` is false, on every turn, forever. Raising the roster's
   *   stated `hitpointsmax` is what lights the verb, and it is a cliff:
   *
   *   ```text
   *     hitpointsmax   offers   charges   turns/bout
   *         46          3,076        0         79
   *         60          6,071    2,914        153
   *        120         10,711    4,251        270
   *   ```
   *
   *   **So raising `herolevel` alone is a change that does nothing**, and the
   *   change that works nearly doubles bout length — which is consistent, since
   *   the table above already says charging LOSES on damage per turn. Recorded
   *   rather than done.
   *
   *   **How the wrong table was made, because it is the repeatable part:** it
   *   was taken by feeding `demoSide(...).members` straight to
   *   `createTeamBattle` rather than through the arena's host —
   *   a harness `tools/engagement-census.mjs` explicitly names as a past
   *   mistake — which gives a different roster, 182 actions a bout against the
   *   arena path's 83, and 38.4% charges against 0.0%. **A measurement taken
   *   off the path nobody plays is not a measurement of the feature.**
   *
   *   The superseded table, kept because the retraction is the useful part:
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
  /**
   * Whether an AI opponent will TAUNT at range instead of walking.
   *
   * ► **ON BY DEFAULT, AND THAT IS THE OPPOSITE CALL FROM `aiCharges` ABOVE
   *   FOR A STATED REASON.** `aiCharges` is off because the arithmetic says
   *   charging LOSES — it buys a character trait at a cost in damage per turn,
   *   so it has to be asked for. This one is on because the arithmetic says
   *   taunting at range WINS: it replaces a walk, and a walk is worth zero
   *   hitpoints on the turn it is taken. An AI that maximises its own stated
   *   criterion takes it, so leaving it off would be the dressed-up preference,
   *   not the other way round.
   *
   * ► **IT IS IN THE RULE-SET ID WHEN OFF**, which is the same rule
   *   `crowdPatience`, `rankStride` and `backAttackBonus` follow and the
   *   OPPOSITE spelling from `aiCharges`: the suffix names what differs from
   *   the SHIPPED DEFAULT, and the shipped default here is on. So an ordinary
   *   battle keeps the id every pinned hash was taken against, and a rule set
   *   with the taunt policy switched off says so.
   *
   * ► **NO PINNED HASH MOVES EITHER WAY, and that was measured before it was
   *   relied on.** `grep -n 'suggestAction\|chooseAiAction' test/seeded-play-pins.test.js`
   *   returns nothing: the seeded pins drive explicit actions, and every golden
   *   replays a fixture whose actions are stated. **The AI policy is not hashed
   *   anywhere in this repository** — which is why four previous AI changes
   *   (targeting 2026-09-12, the bow 2026-09-13, charges 2026-09-16, the flank
   *   2026-09-17) all shipped without an id change. The id names CONFIGURATION,
   *   not code version.
   *
   * ► **WHAT IT DOES, measured on the demo roster through the arena's own host
   *   path — `createVanillaBattleHost` + `demoSide`, which is the path
   *   `tools/arena/main.js` builds and therefore the path somebody plays.**
   *   See the handoff of 2026-09-18 for the numbers and for the two published
   *   claims this work broke.
   */
  /**
   * How willing an AI gladiator is to LEAVE ITS OWN FIGHT and join an ally's.
   *
   * ► **THE OWNER'S DIAL, and it is the question ranked item 2 of the
   *   2026-09-18 handoff should have asked.** That item asked about the LAYOUT
   *   — one lane against ranks — on the ground that "with lanes enforced nobody
   *   can gang up". Measured 2026-09-19 with the lane gate applied exactly as
   *   the attack offer applies it, a 2-on-1 happens on 3.0% of turns with the
   *   shipped ranks and on **0 of 2,851 turns in one lane**. The layout is
   *   settled; the willingness is not.
   *
   * ► **IT DEFAULTS TO `SS2_RANK_JOIN_SURPLUS`, WHICH IS 0 — OWNER'S DECISION,
   *   2026-09-19, TAKEN ON THE SWEEP PRINTED AT THAT CONSTANT.** The full
   *   table lives there rather than here, because the number is the constant's
   *   and this parameter is only the way to override it.
   *
   *   `ss2RankToJoin` may leave a rank when
   *   `alliesInMyRank (not counting me) - foesInMyRank >= rankJoinSurplus`, so
   *   **0 joins but never deserts**: a gladiator with a foe in its own rank
   *   stays and fights it. `-1` will leave one foe behind to make a 2-on-1
   *   elsewhere and is measurably WORSE at causing 2-on-1s than doing nothing;
   *   `Infinity` switches the arm off, which is how a measurement taken before
   *   2026-09-19 is reproduced.
   *
   * ► **THIS IS A BEHAVIOUR CHANGE AT THE DEFAULT AND IS STATED AS ONE.** It
   *   shipped OFF for one commit and was turned on by the owner in the next;
   *   the id is unchanged either way, because a suffix names what differs from
   *   the SHIPPED DEFAULT and the shipped default moved with it. **So the id is
   *   NOT the thing that tells two peers apart here — the code version is.**
   *   That is true of every AI change this project has made (targeting
   *   2026-09-12, the bow 2026-09-13, charges 2026-09-16, the flank 2026-09-17,
   *   the taunt 2026-09-19) and it is worth saying once, at the change that
   *   moved a default rather than adding a flag.
   *
   * ► **IT IS IN THE RULE-SET ID WHENEVER IT DIFFERS FROM THE DEFAULT**, the
   *   same rule `crowdPatience`, `rankStride` and `backAttackBonus` follow: the
   *   hash carries only the id, so two peers on different willingnesses would
   *   agree on every hash and then diverge the first time one of them broke
   *   off.
   *
   * ► **NO PINNED HASH OR GOLDEN MOVES, AND THAT WAS MEASURED RATHER THAN
   *   ARGUED.** The AI policy is not hashed anywhere here —
   *   `test/seeded-play-pins.test.js` drives explicit actions and every golden
   *   replays stated ones — so a policy change cannot move a pin. The suite is
   *   the evidence: it stayed at fail 0 across this change.
   */
  rankJoinSurplus = SS2_RANK_JOIN_SURPLUS,
  aiTaunts = true,
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
   * ► **`0` IS THE OFF SWITCH AND IS **NOT** THE DEFAULT — corrected
   *   2026-09-18 by an audit, which found this sentence and its twin at
   *   `startingY` both saying so while the parameter below defaults to
   *   `SS2_ARENA.rankStride`, which is 97.** `HANDOFF.md` carried both readings
   *   59 lines apart. **The second axis is ON by default**, and everything the
   *   paragraph says about 0 is true OF 0 and has to be asked for.
   *
   * At 0 it is off STRUCTURALLY rather than by tuning: at 0 every gladiator gets the same `y`, so `ydist`
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
  // Same rule once more, spelled from the other side: this one's shipped
  // default is ON, so the suffix appears when it is OFF. An AI that will not
  // taunt makes different decisions from one that will, and two peers running
  // different settings would agree on every hash and then diverge the first
  // time one of them taunted instead of walking.
  const tauntSuffix = aiTaunts ? "" : "-no-taunt";
  // Same rule again. `-join-none` rather than `-join-Infinity` because an id is
  // read by people and `Infinity` in a hash input reads like a bug.
  // Same rule as every suffix above: it names what differs from the SHIPPED
  // DEFAULT, and that default moved to 0 on 2026-09-19. So an ordinary battle
  // carries no suffix, a rule set with the arm switched OFF says `-join-none`,
  // and a more willing one says how willing.
  const joinSuffix = rankJoinSurplus === SS2_RANK_JOIN_SURPLUS
    ? ""
    : !Number.isFinite(rankJoinSurplus)
      ? (rankJoinSurplus > 0 ? "-join-none" : "-join-always")
      : `-join-${rankJoinSurplus < 0 ? `down-${-rankJoinSurplus}` : `hold-${rankJoinSurplus}`}`;
  const ruleSetId =
    `ss2-map-derived-${fightMode}${patienceSuffix}${strideSuffix}${backSuffix}${chargeSuffix}${tauntSuffix}${joinSuffix}`;

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
      // ► **512 CHARACTERS, AND THIS NOTE NOW RUNS TO ABOUT 470 OF THEM.**
      //   `src/campaign/record.js`'s `MAX_NOTE_LENGTH` rejects a longer one at
      //   `assertRuleSetProvenance`, and the refusal says only "must be a
      //   human-readable note" — it names neither the cap nor the length. A
      //   2026-09-19 edit adding one clause took it to 536 and turned 24
      //   campaign tests red with that message; the suite caught it, and the
      //   message did not explain it. **Count before you add a clause**:
      //   `node -e "import('./src/team/ss2-rules.js').then(m =>
      //   console.log(m.ss2TeamRules.provenance.note.length))"`.
      note:
        "SS2's own attack arithmetic, read out of the licensed build's bytecode and replayed against " +
        "23 promoted goldens for attack directions 1-12. NOT runtime-verified: no capture has observed " +
        "this module driving a fight, and the stamina economy, action legality and AI policy it adds " +
        "around the ingress have no runtime backing at all. The AI's melee choice is invented, as is " +
        "the valuation that decides when it taunts rather than closing (ss2TauntValue); only its " +
        "stamina gates are byte-decoded."
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
    /**
     * ► **THE FACINGS EVERY GLADIATOR STARTS WITH, AND THIS ENGINE HAD NONE.
     *   Measured 2026-09-17: 40 of 40 opening ranged attacks were scored as
     *   BACK ATTACKS and paid a 50% damage bonus they had not earned.**
     *
     * `ss2FacingEffects` existed and was correct; it was reached from exactly
     * one place, the movement branches, so a gladiator who had not yet MOVED
     * carried no facing at all. A missing `facing-left` is not neutral —
     * `ss2IsBackAttack` reads its absence as "faces right", so the villain,
     * who starts at positive x with the whole hero side to his left, was
     * modelled as looking away from the fight for as long as he stood still.
     * At 500 apart melee is out of reach and the first thing anybody can do is
     * shoot, which is why this never showed up in a melee bout.
     *
     * **The build derives it here too, and that is what makes this a fix
     * rather than an addition.** `changeCombatants` sets BOTH facings from
     * `hero._x` vs `villain._x` at every phase advance (`+0x28f3`-`+0x2ae3`),
     * and it runs once before the first turn — `initbattle` leaves the pair
     * placed and the first pass poses them. An engine that derives facing only
     * when somebody walks is reproducing one of its call sites and not the
     * rule.
     *
     * ► **IT IS PER TEAM AGAINST EVERY FOE, not pairwise.** With three ranks a
     *   side, facing each team against one opposing team would answer the
     *   wrong question; `facingEffectsAgainst` is the one-directional half
     *   that lets this ask it properly.
     *
     * ► **AND IT CANNOT TOUCH A GOLDEN, structurally.** `startingPosition`
     *   returns `null` under `fixtureReplay`, so a promoted fixture has no
     *   `x`, and `facingEffectsAgainst` skips every combatant that has none.
     *   The same structural gate the facing derivation already relied on — see
     *   `ss2FacingEffects`.
     */
    openingEffects(combatants) {
      const teamIds = [...new Set(combatants.map((combatant) => combatant.teamId))];
      return teamIds.flatMap((teamId) => facingEffectsAgainst(
        combatants.filter((combatant) => combatant.teamId === teamId),
        combatants.filter((combatant) => combatant.teamId !== teamId)
      ));
    },

    /**
     * The stat spells' counters and `backup_*`, on whoever a stat spell can
     * land on — `backup_char` before the bout, as far as this engine needs it.
     * See `ss2StatSpellDeclarations`; empty for every battle in which nobody
     * carries id 33, 40, 41 or 42.
     */
    openingResources(combatants) {
      return ss2StatSpellDeclarations(combatants);
    },

    /**
     * ► **THE CROWD, ONE PER BATTLE, AT THE SUM OF EVERY FIGHTER'S LEVEL** —
     *   the build's `hero.herolevel + villain.herolevel` (`crowd_bar`
     *   clip-action:0, `+0x011f`-`+0x0158`) in 1v1, and the owner's rule above
     *   it (2026-09-22). Every completed phase then adds its delta in
     *   `phaseTransitionEffects`. See `src/team/ss2-crowd.js`.
     *
     * ► **`fixtureReplay` DECLARES IT TOO**, unlike the authored toll: the
     *   crowd is the build's, so a golden's bout had one. It moves every golden
     *   replay HASH (the key is new) and no golden VALUE — no fixture asserts
     *   the crowd, and nothing the crowd feeds reaches the attack arithmetic.
     */
    openingBattleResources(combatants) {
      return ss2CrowdOpening(combatants);
    },

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
     * one-dimensional engine. **Off is NOT the default — corrected 2026-09-18**;
     * `rankStride` defaults to `SS2_ARENA.rankStride` (97) and a caller opts
     * OUT with `createSs2TeamRules({ rankStride: 0 })`. What is true is that
     * off is STRUCTURAL: there is no second code path to keep in step.
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
      //      || (villain.equipped_weapon == 2 && ~~fightdistance < 200~~ !(fightdistance < 200))
      //     Two short-circuit `&&`s joined by an `||`, with a HAND-WRITTEN 200
      //     for the drawn-bow case. So in vanilla the two sides do not share a
      //     gate, and the villain's depends on `equipped_weapon`.
      //     **The bow arm's polarity is corrected 2026-09-22** (`+0x03d3 Not`
      //     precedes the `+0x03d4` join): it is a FLOOR of 200, the same shape
      //     as the hero's `100 + physical_size`, not a ceiling. See
      //     `ss2ArcherMinimumRange`.
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
      /** Foes actually inside melee reach AND in this lane; see the shove. */
      const shovable = [];
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
            // Bash is a MELEE verb wearing an archer's controller frame, so it
            // takes the lane rule with the other three. See `ss2SameLane`.
            if (distance < ss2ArcherMinimumRange(view.actor) && ss2SameLane(view.actor, foe)) {
              anyInReach = true;
              // `closerange_archer` wires a shove beside the bash (map `:229`-
              // `:230`), so this foe is one it may name. Recorded HERE rather
              // than re-derived below, for the reason the shove block gives.
              shovable.push(foe.id);
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
        // ► **AND HE HAS TO BE IN THE SAME LANE.** Reach is Euclidean because
        //   `getfightdistance` is, and that made a foe one rank back at the
        //   same x reachable by every melee weapon in the game. See
        //   `ss2SameLane` for the measurement and for why this is authored.
        //   **`anyInReach` is deliberately NOT set here**: a gladiator whose
        //   only foes are in other lanes is not "in reach", and saying he is
        //   would hide the approach verbs he needs to fix it.
        if (!ss2SameLane(view.actor, foe)) continue;
        anyInReach = true;
        // ► **THE SET A SHOVE MAY NAME, RECORDED WHERE IT IS ESTABLISHED.** See
        //   the shove's own block below for what offering it per-FRAME instead
        //   of per-FOE cost.
        shovable.push(foe.id);
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

      // ► **THE TWO ITEM STRIKES, OFFERED ON POSSESSION ALONE, PER FOE, on the
      //   inventory button and under its two gates** (the empty marker and the
      //   `inventory_maxslots` window, both inside `ss2InventorySlotHolding` —
      //   see the bolts' offer below for the button's derivation). Beside the
      //   psyche offer because they resolve beside the discharge.
      //
      //   **NO RANGE TEST ON EITHER, and for two different reasons.** The ghost
      //   strike's arm has none at all — it moves the caster beside the victim
      //   first. The whirlwind's arm HAS one, and it is the ARM's, exactly like
      //   the discharge's: the hero's button reads only `inv_struck` (the
      //   gale's reading of `sprite:862[overlay]/frame:1`, not re-read for
      //   these two), so a whirlwind cast out of range is legal and wasted, and the resolver
      //   says so (`outOfRange`). `fightdistance < 200` / `> 500` and
      //   `equipped_weapon != 2` are ladder arms 20 and 21, the villain's
      //   DECISION, read by `chooseAiAction` — so a drawn bow is offered both
      //   here, as the hero's button offers them.
      if (ss2InventorySlotHolding(view.actor, SS2_WHIRLWIND.itemId) !== null) {
        for (const foe of view.foes) actions.push({ type: Ss2ActionType.CAST_WHIRLWIND, targetId: foe.id });
      }
      if (ss2InventorySlotHolding(view.actor, SS2_GHOST_STRIKE.itemId) !== null) {
        for (const foe of view.foes) actions.push({ type: Ss2ActionType.CAST_GHOST_STRIKE, targetId: foe.id });
      }

      // ► **THE BOLTS ARE OFFERED OUTSIDE THE CONTROLLER-FRAME SPLIT ENTIRELY,
      //   AND THAT IS STRONGER THAN `psyche_up`'S CASE ABOVE.** `psyche_up` is
      //   on every controller frame; a spell is on NO controller frame. The
      //   eight `optionA`-`optionH` slots the map's button table enumerates
      //   contain no inventory entry at all — the spell buttons live on a
      //   separate overlay, `sprite:492[inventory_overlay]`, attached by the
      //   battle overlay itself (`sprite:862[overlay]/frame:1` `+0x02fe`),
      //   which is why no facing, no weapon mode and no `herolevel` reaches
      //   this offer.
      //
      // ► **THE BUILD'S OWN OFFER GATE, and it is TWO conditions per slot, not
      //   one** (`sprite:492[inventory_overlay]/frame:1/DoAction@0x50e4f`,
      //   derived 2026-09-20 and confirmed by an adversarial verifier that read
      //   the block end to end, 270 instructions, `+0x0000`-`+0x045d`):
      //
      //   ```text
      //     for (i = 1; !(i > 6); i++)                                 +0x0216
      //       if (i > _root.game.hero.inventory_maxslots)              +0x024f
      //         inventory_buttonI._visible = false                     +0x026c
      //     // then, separately, six times over:
      //     if (_global.battle_started == true                         +0x0289
      //         && _root.game.hero.inventoryI == 1)                    +0x02af
      //       inventory_buttonI._visible = false                       +0x02ca
      //   ```
      //
      //   The first branch instruction in the whole block is at `+0x0232`,
      //   AFTER the loop's init, so nothing encloses the loop: it is top-level
      //   and unguarded. There is no `_visible = true` anywhere in the block.
      //
      //   ~~**ONLY THE SECOND IS REPRODUCED HERE, and the omission is named
      //   rather than hidden.** `inventory_maxslots` is not a declared resource
      //   in this engine — it is absent from `SS2_RESOURCE_NAMES` and from
      //   `VANILLA_FIELD_GROUPS` — so declaring it is a schema change with its
      //   own decision, and the handoff ranks it.~~ **BOTH ARE REPRODUCED SINCE
      //   2026-09-22**, and both live in `ss2InventorySlotHolding`, which this
      //   loop calls:
      //
      //   - **Gate 2, as before: a slot holding the empty marker offers
      //     nothing**, and a slot the combatant never declared is not a slot.
      //   - **Gate 1, new: a slot above the window offers nothing.**
      //     `inventory_maxslots` is now a declared resource with NO default
      //     (the `psyche_up` shape, so no golden moved), and the slot at 1-based
      //     position `i` is searched only if the combatant does not declare it
      //     or `!(i > inventory_maxslots)` — the build's own `Greater; Not`.
      //     A bolt carried in slot 3 at `maxslots` 2 is no longer offered.
      //
      //   ► ~~**THE NARROWING IS ONE-WAY — this engine offers a bolt the build
      //     would have hidden, never the reverse — AND IT IS THE COMMON CASE,
      //     NOT A CORNER ONE.**~~ **CLOSED for every record that STATES the
      //     field, and still open for every record that does not** — which is
      //     every record in the repository today, because nothing here derives
      //     it. ~~At the default `inventory_maxslots` of 6 the
      //     two coincide.~~ **THERE IS NO DEFAULT OF 6, and that sentence was
      //     false the hour it was written — caught by an adversarial verifier
      //     the same session, 2026-09-20.** `initcharacter` writes the value
      //     from `characterDNA[40]` (`+0x098e`) and then walks a band chain:
      //     **2 / 3 / 4 / 5 / 6 at `herolevel >= 6 / 15 / 20 / 30 / 40**
      //     (`+0x0aa5`, `+0x0aca`, `+0x0aef`, `+0x0b14`, `+0x0b39`);
      //     `randomise_gladiator` writes the same chain with a **`< 6` -> 1**
      //     arm at the bottom (`+0x336f`-`+0x34a5`). **Six needs level 40**,
      //     and the repository's own decoded rank-1 champion carries 1 at
      //     `herolevel` 5. Across levels 6-14 the hero's `maxslots` is 2 and
      //     the build hides buttons 3, 4, 5 and 6 in battle. **The chain is
      //     deliberately NOT reproduced in `ss2BattleValues`/`ss2Combatant`**:
      //     it runs outside battle, and deriving it would put a value on every
      //     combatant — a default by another name, moving every hash. So a
      //     level-10 gladiator whose record is SILENT about the field is still
      //     offered a bolt from slot 3 here and not there; one whose record
      //     says `inventory_maxslots: 2` is refused in both.
      //
      //   ► **AND THE BUILD'S GATE FAILS OPEN WHEN THE FIELD IS ABSENT**, which
      //     is what makes "declared only when stated" faithful rather than
      //     merely convenient. `Greater` is ECMA abstract relational comparison,
      //     and the movie is `FWS v11` — from SWF 7 on `undefined` converts to
      //     `NaN`, not 0 — so `i > undefined` is false for every `i` and nothing
      //     is hidden. A record that never states `inventory_maxslots` gets all
      //     six slots in the BUILD too, and here.
      //
      //   ► **TWO THINGS THIS GATE IS NOT, SAID AT THE GATE.**
      //     - **It is the HERO's, and this offer is side-blind.** The panel
      //       reads `_root.game.hero` hard-coded; the villain's `use_item`
      //       (`DoAction@0x23e7cf` `+0x0390`) loops a hard `!(i > 6)` and never
      //       reads the field. So a VILLAIN that declares `maxslots` 2 and
      //       carries a bolt in slot 3 casts it in the build and is refused
      //       here — narrower than the build, and the price of one offer for
      //       every seat. No record in the repository states the field, so no
      //       current battle can reach the difference.
      //     - **It rests on one unmeasured link.** The build's gate is
      //       `_visible = false`; the `onRelease` dispatcher at
      //       `sprite:862[overlay]/frame:1` has no gate of its own. That an
      //       invisible AVM1 clip cannot be clicked is Flash/Ruffle runtime
      //       semantics, not something these bytes state, and no capture here
      //       has measured it.
      //
      // ► **PER FOE, LIKE EVERY OTHER TARGETED VERB.** The build is 1v1 and its
      //   phase reads a single bound `defender`; above 1v1 the caster picks,
      //   and the alternative — offering one bolt at "the" enemy — is the
      //   cross-lane defect this file has now recorded three times. There is NO
      //   range test, deliberately: the arm contains no `fightdistance` read
      //   and `lightning_bolt_combat` is attached at the defender's own `_x`
      //   (`+0x852a`), so a bolt reaches across the arena. The item table's own
      //   description calls it close-ranged; **the bytes do not**, and the bytes
      //   are the oracle.
      // Both gates are inside `ss2InventorySlotHolding`, default-on.
      for (const [type, spell] of Object.entries(SS2_BOLT_SPELLS)) {
        if (ss2InventorySlotHolding(view.actor, spell.itemId) === null) continue;
        for (const foe of view.foes) actions.push({ type, targetId: foe.id });
      }
      // ► **THE FIREBALLS, ON THE SAME BUTTON UNDER THE SAME TWO GATES**, and
      //   per foe for the same reason. **NO RANGE AND NO LANE TEST, and the
      //   impact test is why**: it compares the bullet's `_x` with the TARGET's
      //   `_x` along the caster's facing and reads nothing else, so every foe is
      //   reachable from anywhere and a body standing in the line of flight is
      //   never consulted — the faithful N-body reading is that a fireball
      //   passes through bystanders. See `SS2_FIREBALL_SPELLS`.
      for (const [type, spell] of Object.entries(SS2_FIREBALL_SPELLS)) {
        if (ss2InventorySlotHolding(view.actor, spell.itemId) === null) continue;
        for (const foe of view.foes) actions.push({ type, targetId: foe.id });
      }
      // ► **MOLTEN DEATH, ON THE SAME BUTTON UNDER THE SAME TWO GATES, PER FOE.**
      //   No range and no lane test: the arm reads `defender._x` only to place
      //   the boulders, and each boulder's closure has no x test at all, so
      //   every foe is reachable from anywhere. See `SS2_DEATH_FROM_ABOVE`.
      if (ss2InventorySlotHolding(view.actor, SS2_DEATH_FROM_ABOVE.itemId) !== null) {
        for (const foe of view.foes) actions.push({ type: Ss2ActionType.CAST_DEATH_FROM_ABOVE, targetId: foe.id });
      }

      // ► **THE GALE IS OFFERED ON POSSESSION ALONE, ON THE SAME BUTTON AND
      //   UNDER THE SAME TWO-GATE OVERLAY AS THE BOLTS ABOVE** — so everything
      //   that block says about `inventory_maxslots` applies here unchanged,
      //   ~~including that this engine does not yet reproduce it~~ **including
      //   that this engine reproduces it since 2026-09-22, inside
      //   `ss2InventorySlotHolding`** (corrected by the `drink_potion`
      //   implementer, who found the clause stale beside its own offer).
      //
      //   **`fightdistance` IS NOT AN OFFER GATE, and treating it as one is what
      //   kept this verb unbuilt.** Its `< 400` test is ladder arm 24 of
      //   `villain_cast_spells`, the villain AI's decision; the hero's click
      //   handler reads only `inv_struck`, and the phase itself
      //   (`+0x7aaa`-`+0x7be5`) reads no distance at all. `chooseAiAction` reads
      //   the villain's conditions; this is the button.
      if (ss2InventorySlotHolding(view.actor, SS2_GALE.itemId) !== null) {
        for (const foe of view.foes) actions.push({ type: Ss2ActionType.CAST_GALE, targetId: foe.id });
      }

      // ► **THE COMMAND IS OFFERED ON POSSESSION ALONE, PER FOE, on the gale's
      //   button and under the same two gates** (the empty marker and the
      //   `inventory_maxslots` window, both inside `ss2InventorySlotHolding`).
      //   `fightdistance > 300` is ladder arm 25, the villain's DECISION, read
      //   by `chooseAiAction`; the arm (`+0x7be6`-`+0x7db6`) reads no distance.
      //
      //   **Per foe, and at a foe BEHIND the caster too**: the arm reads one
      //   bound `defender` and moves it against the caster's facing whichever
      //   side it stands, so above 1v1 the caster picks and the build's answer
      //   for a target behind — pushed 40 away — is what it gets.
      if (ss2InventorySlotHolding(view.actor, SS2_COMMAND.itemId) !== null) {
        for (const foe of view.foes) actions.push({ type: Ss2ActionType.CAST_COMMAND, targetId: foe.id });
      }

      // ► **THE TELEPORT IS OFFERED ON POSSESSION ALONE, on the bolts' and the
      //   gale's button and under the same two gates** (the empty marker and the
      //   `inventory_maxslots` window, both inside `ss2InventorySlotHolding`).
      //   `fightdistance < 250` and `hitpoints < hitpointsmax / 2` are ladder
      //   arm 26, the villain's DECISION, read by `chooseAiAction`; the phase
      //   itself (`+0x7541`-`+0x76ad`) reads neither.
      //
      //   **ONCE, AIMED AT THE CASTER, and not per foe** — the `rest` shape.
      //   The arm never reads `defender` or `game_defender`, so a per-foe offer
      //   would be N spellings of one action, and the resolver's legality check
      //   matches on `targetId`.
      if (ss2InventorySlotHolding(view.actor, SS2_TELEPORT.itemId) !== null) {
        actions.push({ type: Ss2ActionType.CAST_TELEPORT, targetId: actorId });
      }

      // ► **ADULATION IS OFFERED ON POSSESSION ALONE, ONCE, AIMED AT THE
      //   CASTER** — the teleport's shape and its reason: the arm
      //   (`+0x76ae`-`+0x777b`) never reads `defender`, and `fightdistance > 300`
      //   is ladder arm 28, the villain's DECISION, read by `chooseAiAction`.
      //   The same two gates (the empty marker and the `inventory_maxslots`
      //   window) inside `ss2InventorySlotHolding`.
      if (ss2InventorySlotHolding(view.actor, SS2_ADULATION.itemId) !== null) {
        actions.push({ type: Ss2ActionType.CAST_ADULATION, targetId: actorId });
      }

      // ► **WEAKEN ARMOUR IS OFFERED ON POSSESSION ALONE, PER FOE, on the same
      //   button and under the same two gates** (the empty marker and the
      //   `inventory_maxslots` window, both inside `ss2InventorySlotHolding`).
      //   `fightdistance < 300` is ladder arm 19, the villain's DECISION, read
      //   by `chooseAiAction`; the phase (`+0x777c`-`+0x78d9`) reads no distance.
      //
      //   **Offered at an UNARMOURED foe too**, because neither the button,
      //   the phase nor the ladder reads anybody's armour: the build lets a
      //   caster spend the item on a victim with nothing to lose, and so does
      //   this. Per foe for the bolts' reason: the arm reads one bound
      //   `defender`, and above 1v1 the caster picks.
      if (ss2InventorySlotHolding(view.actor, SS2_WEAKEN_ARMOUR.itemId) !== null) {
        for (const foe of view.foes) actions.push({ type: Ss2ActionType.CAST_WEAKEN_ARMOUR, targetId: foe.id });
      }

      // ► **THE POTIONS: ONE OFFER PER DISTINCT ID HELD, SELF-TARGETED, ON THE
      //   SAME BUTTON AND UNDER THE SAME TWO GATES AS THE SPELLS ABOVE.** The
      //   hero's six inventory buttons carry no verb of their own — the click
      //   handler writes `inventory_action = inventoryN` and the item row names
      //   the phase — so a potion is found through `ss2InventorySlotHolding`
      //   exactly as a bolt is, `inventory_maxslots` window included.
      //
      //   **One option per ID, not per slot.** Two slots holding id 3 are the
      //   same drink; which one empties is the resolver's (`use_item`'s first
      //   match), and offering two identical options would make the choice
      //   look like it meant something.
      //
      //   **`targetId` is the drinker**, the convention `rest`, the walks, the
      //   swap and the status phases already use, so the resolver's legality
      //   check refuses a drink aimed at anybody else. **`itemId` is the
      //   potion**, because `drink_potion` is one label for eight items; the
      //   resolver compares it and hands it to `resolveAction`.
      //
      //   **OFFERED WHATEVER THE POOL HOLDS, INCLUDING FULL.** The hero's
      //   button tests only `inv_struck != true` and the phase tests nothing
      //   before it writes, so a potion drunk at full health is legal in the
      //   build and is wasted by `check_stats`. The `< max / 2` tests are the
      //   villain's DECISION, which `chooseAiAction` reads.
      for (const itemId of Object.keys(SS2_POTIONS).map(Number)) {
        if (ss2InventorySlotHolding(view.actor, itemId) === null) continue;
        actions.push({ type: Ss2ActionType.DRINK_POTION, targetId: actorId, itemId });
      }

      // ► **THE TWO TIMED BUFFS: ONCE EACH, SELF-TARGETED, ON POSSESSION, on the
      //   same button and under the same two gates as every spell above.** The
      //   arms never read `defender`, so a per-foe offer would be N spellings of
      //   one action — the teleport's shape. `hitpoints < hitpointsmax / 2` is
      //   ladder arm 3, the villain's DECISION, read by `chooseAiAction`; the
      //   hero's button tests nothing, so a buff is castable at full health and
      //   while one is already running (a recast resets it).
      //
      //   **AND THE COUNTER MUST BE DECLARED**, for the reason `psyche_up`'s
      //   offer gives: the resolver will not create a resource mid-battle, so a
      //   cast whose counter the combatant cannot hold would be a button that
      //   throws. `ss2Combatant` declares it for every gladiator carrying the
      //   item, so for anything built there this is possession exactly.
      for (const [type, buff] of Object.entries(SS2_TIMED_BUFFS)) {
        if (ss2InventorySlotHolding(view.actor, buff.itemId) === null) continue;
        if (!declaredResourceNames(view.actor).has(buff.counter)) continue;
        actions.push({ type, targetId: actorId });
      }

      // ► **THE FOUR STAT SPELLS, ON THE SAME BUTTON UNDER THE SAME TWO GATES.**
      //   Colossus, swift sandals and bloodlust write only the caster, so each
      //   is offered ONCE, aimed at the caster — the teleport's shape. Little
      //   fat kid writes the DEFENDER (`game_defender.strength`, `+0x82df`), so
      //   it is offered PER FOE, the bolts' shape: the arm reads one bound
      //   `defender` and above 1v1 the caster picks. No range and no health
      //   test: every distance in these four is ladder arms 8, 9, 22 and 27,
      //   the villain's DECISION, read by `chooseAiAction`.
      //
      //   **AND THE BEARER MUST HOLD WHAT THE CAST WRITES** — the counter and
      //   the `backup_*` it writes from — for the reason the timed buffs give:
      //   the resolver creates no resource mid-battle, so a cast whose counter
      //   the bearer cannot hold would be a button that throws.
      //   `ss2StatSpellDeclarations` declares them at the opening for every
      //   carrier and every foe of a carrier of 33, so for any battle built
      //   through `createTeamBattle` this is possession exactly.
      for (const [type, spell] of Object.entries(SS2_STAT_SPELLS)) {
        if (ss2InventorySlotHolding(view.actor, spell.itemId) === null) continue;
        const holds = (bearer) => ss2StatSpellResources(spell).every((name) => declaredResourceNames(bearer).has(name));
        if (spell.bearer === "caster") {
          if (holds(view.actor)) actions.push({ type, targetId: actorId });
        } else {
          for (const foe of view.foes) if (holds(foe)) actions.push({ type, targetId: foe.id });
        }
      }

      // ► **REJUVENATE: ONCE, SELF-TARGETED, ON POSSESSION, on the same button
      //   and under the same two gates** — the timed buffs' shape, for their
      //   reason: the arm never reads `defender`. `hitpoints < hitpointsmax /
      //   1.5` is ladder arm 1, the villain's DECISION, read by
      //   `chooseAiAction`; the hero's button tests nothing, so it is castable
      //   at full health with nothing lost, and simply wasted.
      //
      //   **AND EVERY DECLARED PIECE'S BACKUP MUST BE DECLARED**, for the
      //   counters' reason: a restore with nothing to read is a button that
      //   throws. `ss2Combatant` declares them for every gladiator carrying 43.
      if (ss2InventorySlotHolding(view.actor, SS2_REJUVENATE.itemId) !== null
        && ss2RejuvenateMissingBackups(view.actor).length === 0) {
        actions.push({ type: Ss2ActionType.CAST_REJUVINATE, targetId: actorId });
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

      // ► **THE SHOVE, AND ITS GATE IS THE MIRROR IMAGE OF THE TAUNT'S.**
      //   The map's button table (`:225`-`:230`) wires `shove` on BOTH
      //   close-range frames — `closerange_warrior` and `closerange_archer`, in
      //   both facings — and on NEITHER long-range frame. The taunt is wired on
      //   the two long-range frames and not on `closerange_warrior`. So one is
      //   what you do when you cannot reach him and the other is what you do
      //   when you can, and they are never both a warrior's only option.
      //
      //   **Recognised through `onCloseFrame`**, which this function already
      //   computed for the walks and the taunt, rather than by a second
      //   distance test — the argument every arm here makes.
      //
      // ► **NO STAMINA GATE, unlike the taunt.** Neither close frame tests
      //   stamina before wiring the button, and the phase itself has no gate
      //   either: `staminacost` is assigned at `+0x5dd3` and `nextphase`
      //   subtracts it afterwards, floored at zero by `check_stats`. Inventing
      //   an affordability test here would be a playability affordance wearing
      //   measured clothes — the rule `legalActions` states for the melee
      //   verbs, applied to this one.
      //
      // ► **AND IT NEEDS A POSITION, WHICH THE MELEE VERBS DO NOT — caught by
      //   `test/ss2-position.test.js` refusing it.** A rule set that models no
      //   position offers the three melee verbs anyway, because an attack
      //   RESOLVES from any distance and the build has no distance test in the
      //   phase. **A shove's entire outcome is the displacement**, so offering
      //   one to an unpositioned combatant is offering a button that spends
      //   stamina and does nothing. That is precisely the finding an
      //   adversarial review made against the taunt's first cut — *"a
      //   convention that makes a NEW outcome inert is not a defence"* — and it
      //   applies here before anybody can ship it.
      // ► **PER FOE, NOT PER FRAME — AND THE FIRST CUT WAS PER FRAME, WHICH IS
      //   THE CROSS-LANE DEFECT THE OWNER FOUND BY WATCHING ON 2026-09-18,
      //   REINTRODUCED.** `onCloseFrame` means "SOMEBODY is in reach", so
      //   looping `view.foes` under it offered a shove against every enemy on
      //   the field the moment one of them was close. Reproduced by an
      //   adversarial review and re-derived here: an actor at (0, 200) with a
      //   foe at (50, 200) and another at (500, 6) was offered a shove against
      //   BOTH, and shoving the far one displaced it to x 438 — while
      //   `quick-attack` correctly offered only the near one.
      //
      //   `shovable` is the set the melee verbs themselves were offered
      //   against, so the two cannot disagree about who is in reach or which
      //   lane they are in. **A second distance test here would be a second
      //   chance to be wrong** — the argument every arm in this function makes,
      //   and the one this block failed to make.
      if (onCloseFrame && positioned) {
        for (const targetId of shovable) actions.push({ type: Ss2ActionType.SHOVE, targetId });
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

      // ► **`wincrowd` IS ON EVERY CONTROLLER FRAME, BEHIND ONE GATE: `herolevel
      //   >= 3`.** All eight menu branches wire it and hide it below 3 (see
      //   `SS2_WINCROWD` for the eight offsets) — the `psyche_up` shape, read
      //   the way that offer reads it, off the ACTOR, so the hero's button is
      //   every seat's. No stamina, range or facing test anywhere: it is
      //   offered at any stamina the zero-stamina rest above has not already
      //   pre-empted, near or far.
      //
      //   **ONCE, AIMED AT THE ACTOR** — the arm never reads `defender`, so a
      //   per-foe offer would be N spellings of one action (the teleport's
      //   reason).
      //
      //   **APPENDED HERE, AFTER EVERY VERB THAT EXISTED BEFORE IT, and the
      //   position is deliberate rather than tidy.** `legalActions(...)[0]` is
      //   what several drivers and tests take (`test/seeded-play-pins.test.js`
      //   `driveFirst`), so a new verb at the head of the list would change
      //   which action they drive; here it can never be the first option of a
      //   combatant that has any other. `options[turnNumber % length]` still
      //   sees a longer list at level 3+, which is true of every verb added.
      if (resourceValue(view.actor, "herolevel", 0) >= SS2_WINCROWD.herolevelAtLeast) {
        actions.push({ type: Ss2ActionType.WINCROWD, targetId: actorId });
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
      // So every completed phase's transition can tick the whole field's timed
      // spell counters; see `SS2_PHASE_REQUESTS`.
      if (actor !== null && typeof actor === "object") SS2_PHASE_REQUESTS.set(actor, request);

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
      // ► **ONLY THE MOVEMENT BRANCHES CARRY IT, and that is equivalence rather
      //   than economy.** Facing is a function of `x` alone
      //   (`ss2FacingEffects`), so an attack and a rest cannot change one and
      //   recomputing on them emits an effect that is always a no-op.
      //
      //   **CORRECTED 2026-09-17: this said "exactly two verbs move anybody: a
      //   walk and a rank change", and it was true when written and false by
      //   the time the taunted flee shipped.** There are THREE — the flee moves
      //   a gladiator further than either — and the sentence read as a licence
      //   to leave the new branch out rather than as the census it was. A count
      //   in a comment goes stale silently; the rule does not. The rule is that
      //   **every branch that writes an `x` recomputes the facing from the `x`
      //   it wrote**, and `git grep "EffectKind.POSITION"` is how you check it.
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

      /**
       * ► **THE MIRROR, FOR A MOVE THIS ACTOR INFLICTED ON SOMEBODY ELSE — and
       *   the rule above had no way to express one.** `facingAfter` substitutes
       *   the ACTOR into its own side, which is right for a walk and useless
       *   for a shove: a knockback writes the TARGET's `x`, and the gladiator
       *   whose facing that can change is the target and whoever is nearest to
       *   where he landed.
       *
       *   The shove shipped in `d5dabeb` without this and so BROKE the rule
       *   stated three screens up — "every branch that writes an `x` recomputes
       *   the facing from the `x` it wrote" — in the same commit that wrote the
       *   rule down. An independent review found it, 2026-09-17. A stated rule
       *   with an exception nobody noticed is worse than no rule, because the
       *   `git grep` it prescribes reports the violation as a pass.
       */
      const facingAfterTargetMove = (movedTarget) => {
        const mine = request.allies ?? [];
        const theirs = (request.foes ?? []).map((foe) => (foe.id === movedTarget.id ? movedTarget : foe));
        return ss2FacingEffects(
          mine.some((ally) => ally.id === actor.id) ? mine : [actor, ...mine],
          theirs.some((foe) => foe.id === movedTarget.id) ? theirs : [movedTarget, ...theirs]
        );
      };


      const statusFlag = SS2_FLAG_FOR_STATUS_PHASE[request.type];
      if (statusFlag) {
        const phase = resolveStatusPhase(request, statusFlag, fightMode, observer);
        return crowd.length ? { ...phase, effects: [...phase.effects, ...crowd] } : phase;
      }

      // ► **THE FLEE, WHICH IS ROW 3 OF THE BUILD'S DECISION TABLE AND THE ONE
      //   FORCED PHASE THAT IS NOT A CONDITION.** `taunted1 == true` sends a
      //   gladiator to `getphase("runleft")` facing right and
      //   `getphase("runright")` facing left (`+0x0d68`-`+0x0e35`): he runs AWAY
      //   from the way he is facing, and the flag is cleared on the way through
      //   (`+0x0ddb`, `+0x0e2d`).
      //
      // ► **IT COVERS `ss2RunDisplacement`, NOT A WALK'S.** The run sets
      //   `destination = _x -/+ movement_speed * 40` with NO boot bonus and a
      //   destination tolerance of 10 rather than the walk's 20 — three
      //   differences, and the third is that the closed form in the movement
      //   table is +1 low at 23 of the 57 reachable speeds.
      //
      // ► **AND IT TAKES NO SAMPLE.** A forced phase is not a choice and the
      //   build draws nothing here, so a tape replays across it unchanged.
      //
      // ► **IT DOES NOT STOP FOR A BODY, AND THAT IS DERIVED RATHER THAN
      //   OMITTED.** A Codex review of `cbaf406` called this a missing
      //   collision check. It is not: the run's body rule EXISTS and is
      //   unreachable from here. Read off sprite 862 frame 52, 2026-09-17, with
      //   the walk beside it so the four differences are visible at once:
      //
      //   ```text
      //     walkleft  +0x3b1f  destination = _x - add_percentage(boot, ms * 16)
      //                        if (destination < defender._x + game_defender.physical_size
      //                            && attacker.gladiator_dir == "left")
      //                          destination = defender._x + game_defender.physical_size
      //                        arrive when !(_x > destination + 20)
      //
      //     runleft   +0x3ee3  destination = _x - ms * 40          (no boot bonus)
      //                        if (attacker.gladiator_dir == "left"
      //                            && attacker._x < defender._x + attacker.physical_size)
      //                          { destination = null; nextphase() }
      //                        arrive when !(_x > destination + 10)
      //   ```
      //
      //   So the walk CLAMPS its destination before it sets off, against the
      //   DEFENDER's `physical_size`; the run ABORTS the tween mid-flight,
      //   against the ATTACKER's own. `runright` mirrors it exactly
      //   (`+0x406c`, guard `== "right"`, `+0x417e`).
      //
      //   **Both are guarded on the facing, and the flee inverts the facing.**
      //   Frame 1 row 3 sends `gladiator_dir == "right"` to `runleft` and
      //   `== "left"` to `runright`, so the arm that runs is always the arm
      //   whose guard is false. The abort cannot fire on a taunted flee in this
      //   build. A fleeing gladiator runs THROUGH the man who taunted him, and
      //   only the arena bound stops him — **which lives in
      //   `attacker.onEnterFrame` (`+0x38fd`, `+0x3988`) and NOT in
      //   `nextphase`, as this line said until 2026-09-17.** The bound is real;
      //   the function named for it was not. See `SS2_ARENA.clamp`.
      if (request.type === Ss2ActionType.TAUNTED_PHASE) {
        const facingLeft = (actor.status ?? []).includes(SS2_FACING_LEFT);
        // Away from the facing: looking right means running left.
        const direction = facingLeft ? 1 : -1;
        const travelled = ss2RunDisplacement(ss2MovementSpeed(actor));
        const transition = phaseTransitionEffects(actor, {
          // The run branch's own cost, from the staminacost table:
          // `round(movement_speed / 2)`, the same as a walk's — the build
          // charges the gait and not the distance.
          staminaCost: Math.round(ss2MovementSpeed(actor) / 2),
          // `runleft` (`+0x3edd`) and `runright` (`+0x4066`) write no
          // `crowd_action`: a flee adds nothing.
          crowdAction: 0
        });
        const effects = [...transition.effects];
        let to = null;
        if (Number.isFinite(actor.x)) {
          to = clamp(actor.x + direction * travelled, SS2_ARENA.clamp.min, SS2_ARENA.clamp.max);
          if (to !== actor.x) effects.push({ kind: EffectKind.POSITION, targetId: actor.id, to });
        }
        // The flag is spent by being obeyed. `+0x0ddb`/`+0x0e2d` clear it in
        // both arms of the hero path — and clear ONLY `taunted1`, which is the
        // build's own asymmetry and is why `taunted2` has no phase here.
        //
        // ► **EVERY `taunted1` TOKEN, not the first.** This read
        //   `statusTokenFor(...) ?? SS2_TAUNT.flag` and cleared exactly one.
        //   Tokens are source-qualified (`taunted1:from=c`), so two opponents
        //   taunting the same gladiator leave two of them, and the survivor
        //   forced a SECOND flee for what the build stores as one boolean.
        //   `statusConsumptionEffects` learned this same lesson on the burning
        //   flags and carries the comment; this call site did not reuse it.
        //   Found by a Codex review of `cbaf406`, 2026-09-17.
        effects.push(...statusConsumptionEffects(actor, [SS2_TAUNT.flag]));
        // ► **AND EVERY CONDITION THE CHAIN WALKED PAST IS CLEARED TOO, which is
        //   the surprising half of the build's behaviour.** Rows 4-7 are
        //   SEQUENTIAL STATEMENTS, not an else-chain: each clears its own flag
        //   BEFORE calling `getphase`, and those calls are silent no-ops once
        //   row 3 has taken the turn. So a taunted, burning gladiator runs AND
        //   loses the burn — the same rule a forced rest already applies here.
        effects.push(...statusConsumptionEffects(actor));
        return {
          effects: [
            ...effects,
            ...crowd,
            // ► **THE FLEE IS THE THIRD MOVER, and the block above `facingAfter`
            //   used to say there were two.** `changeCombatants` recomputes
            //   BOTH facings from `hero._x` vs `villain._x` every phase advance
            //   (`+0x28bf`-`+0x2ae3`, writing `gladiator_dir` and flipping
            //   `_xscale` to match), and a flee is a phase advance like any
            //   other. Running past the man who taunted you turns you round to
            //   face him again — which matters, because a back attack is worth
            //   50% more and the NEXT flee reads the same field to pick its
            //   direction. Omitted until a Codex review of `cbaf406` reproduced
            //   the stale facing, 2026-09-17.
            ...(to === null ? [] : facingAfter({ ...actor, x: to }))
          ],
          events: [{
            type: Ss2ActionType.TAUNTED_PHASE,
            actorId: actor.id,
            targetId: actor.id,
            from: Number.isFinite(actor.x) ? actor.x : null,
            to,
            // The facing's own label, which `VANILLA_PHASE_LABEL` cannot hold
            // for both arms.
            vanillaLabel: facingLeft ? SS2_TAUNT.fleePhase.left : SS2_TAUNT.fleePhase.right,
            staminaGained: transition.staminaGained,
            healed: transition.healed
          }]
        };
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
          branchHeal: 3 + Math.ceil(stamina),
          // `crowd_action = -2`, `+0x5150`: the crowd boos a rest.
          crowdAction: ss2CrowdActionOf(VANILLA_PHASE_LABEL[Ss2ActionType.REST])
        });
        // A forced rest still walked the whole chain, so it CONSUMED any
        // pending condition without playing it. Emitted here rather than only
        // on the zero-stamina path because the chain does not know why rest
        // was chosen — and a voluntary rest reaches frame 1 the same way.
        //
        // ► **AND `taunted1` IS ONE OF THEM.** This took
        //   `SS2_DEATH_CLEAR_FLAGS` and so left a pending flee alive: the build
        //   charges the gladiator the forced rest AND then clears the flag at
        //   row 3, where this engine went on to make him run a turn later. See
        //   `SS2_CHAIN_CLEAR_FLAGS`.
        return {
          effects: [
            ...transition.effects,
            ...statusConsumptionEffects(actor, SS2_CHAIN_CLEAR_FLAGS),
            ...crowd
          ],
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
        // `swap_weapons` (`+0x4d1d`) writes no `crowd_action`: it adds nothing.
        const transition = phaseTransitionEffects(actor, { staminaCost: 1, crowdAction: 0 });
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
          effects: [
            ...effects,
            // ► **ROW 1 WALKS THE CHAIN TOO, and this branch used to consume
            //   NOTHING.** `swap_weapons` is the first forced row, so an archer
            //   out of arrows takes the turn and rows 3-7 then spend `taunted1`
            //   and all four conditions on `getphase` calls the `turnphase`
            //   gate has already silenced. The rest branch below has modelled
            //   that since 2026-09-02; the swap branch never did, so a forced
            //   swap left all five pending and every one of them fired a turn
            //   late. Found by a Codex review of `cbaf406`, 2026-09-17.
            ...statusConsumptionEffects(actor, SS2_CHAIN_CLEAR_FLAGS),
            ...crowd
          ],
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
          staminaCost: Math.round(ss2MovementSpeed(actor) / 2),
          // AUTHORED like the verb: the build has no sidestep arm, so nothing
          // writes `crowd_action`, and a walk's 0 is the one on offer.
          crowdAction: 0
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
          staminaCost: Math.round(ss2MovementSpeed(actor) / 2),
          // `walkleft` (`+0x3b1f`) and `walkright` (`+0x3cfe`) write no
          // `crowd_action`: a walk adds nothing.
          crowdAction: 0
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
            resetsPsyche: false,
            // A CHARGING press writes no `crowd_action`: the arm's one write
            // (`+0x6604`) is behind the `== 3` test (`+0x65ff`). It adds nothing.
            crowdAction: 0
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

      // ► **THE SHOVE RETURNS BEFORE THE BAND TABLE, BECAUSE IT IS NOT AN
      //   ATTACK AT ALL.** The phase `+0x5dcd`…`+0x6007` contains zero
      //   `randomBetween`, zero `checkattackroll` and zero `hitpoints`: it
      //   costs stamina, plays two clips and moves a body. Routing it through
      //   the dispatcher would take samples the build never takes and put every
      //   peer replaying the same tape out of step from the first press — the
      //   exact hazard that kept `taunt` deferred for a month, avoided here by
      //   not entering the path rather than by unwinding it afterwards.
      if (request.type === Ss2ActionType.SHOVE) {
        const pushed = request.target;
        if (!pushed) {
          throw new TeamRuleSetError(
            `${request.type} needs a target; ${String(request.targetId)} is not a combatant.`
          );
        }
        const force = ss2ShoveForce(actor);
        const staminaCost = Math.round(actor.stats.strength * SS2_SHOVE.staminaCostFactor);
        // `crowd_action = 2` (`+0x5dc0`) on every tick, after `knockback`'s 1
        // (`+0x1dfe`) on the first: the shove adds 2.
        const transition = phaseTransitionEffects(actor, {
          staminaCost,
          crowdAction: ss2CrowdActionOf(VANILLA_PHASE_LABEL[Ss2ActionType.SHOVE])
        });
        const effects = [...transition.effects];
        // `knockback(defender, force)` is `_x + force` with no clamp, no arena
        // edge and no body check in its own 155 bytes (`+0x1e75`); the bound
        // that really applies is the clip clamp inside `attacker.onEnterFrame`.
        // See `SS2_ARENA.clamp`.
        const to = Number.isFinite(pushed.x)
          ? clamp(pushed.x + force, SS2_ARENA.clamp.min, SS2_ARENA.clamp.max)
          : null;
        if (to !== null && to !== pushed.x) {
          effects.push({ kind: EffectKind.POSITION, targetId: pushed.id, to });
          effects.push(...facingAfterTargetMove({ ...pushed, x: to }));
        }
        return {
          effects: [...effects, ...crowd],
          events: [{
            type: Ss2ActionType.SHOVE,
            actorId: actor.id,
            targetId: pushed.id,
            vanillaLabel: VANILLA_PHASE_LABEL[Ss2ActionType.SHOVE],
            force,
            from: Number.isFinite(pushed.x) ? pushed.x : null,
            to,
            // The presentation layer cannot re-derive the threshold, and the
            // build gates only the CLIP on it — the displacement above is
            // unconditional.
            knockbackAnimation: Math.abs(force) > SS2_SHOVE.knockbackAnimationForce,
            // `nextphase`'s two halves, reported the way every other phase
            // reports them. The COST is the `staminacost` assigned at `+0x5dd3`
            // and spent afterwards; the GAIN is `nextphase`'s own regeneration,
            // which runs for a shove exactly as it runs for a walk.
            staminaSpent: staminaCost,
            staminaGained: transition.staminaGained
          }]
        };
      }

      // ► **THE BOLT. One sample, no roll, no direction, and it cannot miss.**
      //
      //   It returns before `ATTACK_BANDS` for the reason `shove` and the
      //   taunt's three non-dispatching outcomes do: the arm takes exactly one
      //   `randomBetween` and it is the DAMAGE, handed straight to
      //   `magic_damage_character`. Entering the dispatcher would draw an
      //   attack direction the build never draws and put every peer replaying
      //   the same tape out of step from the first cast. See `SS2_BOLT_SPELLS`
      //   for the phase, statement by statement.
      if (SS2_BOLT_SPELLS[request.type]) {
        const spell = SS2_BOLT_SPELLS[request.type];
        const victim = request.target;
        if (!victim) {
          throw new TeamRuleSetError(
            `${request.type} needs a target; ${String(request.targetId)} is not a combatant.`
          );
        }

        // ► **THE SLOT IS RE-FOUND AT RESOLVE, NOT CARRIED FROM THE OFFER.**
        //   `legalActions` and `resolveAction` are separate calls and a caller
        //   may reach the second without the first — the resolver's own
        //   legality gate covers `applyAction`, but `resolveAction` is a public
        //   rule-set method. Consuming a slot that does not hold the spell
        //   would be worse than any error message.
        //
        // ► **AND THE RE-FIND APPLIES THE SAME `inventory_maxslots` WINDOW AS
        //   THE OFFER (decided 2026-09-22), because otherwise a direct call
        //   consumes a slot the offer refused.** The build splits this by side
        //   — the hero consumes through a button the window hides, the villain
        //   through `use_item`, which never reads the field — and this engine
        //   is side-blind, so offer and resolve must be ONE rule or the public
        //   method is a hole in the other one.
        //
        //   **It moves no legal cast, and that is provable, not hoped.** The
        //   search is ascending first-match, so if ANY slot inside the window
        //   holds the item, the FIRST slot holding it is inside the window too:
        //   for every action the offer accepts, the windowed and unbounded
        //   searches return the same slot. The window changes the resolve only
        //   where the offer already said no. Pinned exhaustively in
        //   `test/ss2-inventory-maxslots.test.js`.
        const slot = ss2InventorySlotHolding(actor, spell.itemId);
        if (slot === null) {
          const beyond = ss2InventorySlotHolding(actor, spell.itemId, { ignoreMaxslots: true });
          if (beyond !== null) {
            throw new TeamRuleSetError(
              `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: item ${spell.itemId} is in ${beyond}, ` +
              `outside inventory_maxslots ${resourceValue(actor, "inventory_maxslots")}. The build's hero panel ` +
              "hides that button (sprite:492[inventory_overlay] +0x024f), and this engine offers and consumes " +
              "through the same window."
            );
          }
          throw new TeamRuleSetError(
            `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: no declared inventory slot holds ` +
            `item ${spell.itemId}. The build's own gate is possession — check_inventory(${spell.itemId}) for ` +
            "the villain, a visible inventory button for the hero — and this engine reproduces it."
          );
        }

        // THE ONE SAMPLE. Taken here rather than inside the ingress because
        // `magic_damage_character` contains no RNG call at all: the map is
        // explicit that spell damage is rolled in the CALLERS, and the roll
        // label is the candidate module's so a fixture and a live battle put
        // the same name on the same draw.
        const damage = rolls.randomBetween(spell.rollLabel, spell.damageLow, spell.damageHigh);

        // The ingress's roles are NOT crossed here, unlike a status phase. The
        // three spell call sites match the byte-verified signature exactly
        // (`+0x85af` pushes defender last, so it is argument one); only the
        // EIGHT enchantment sites invert. The victim therefore sits on the
        // scenario's DEFENDER side, which `attackerSide: "villain"` makes
        // `hero`.
        const victimRecord = vanillaRecordOf(victim, "defender");
        const victimBefore = { ...victimRecord };
        // The caster's record is present because the ingress clears death
        // state across BOTH sides. Nothing else reads it: the callee binds
        // `attacker`/`game_attacker` to register 0 and touches neither, so no
        // caster stat can influence any number this produces.
        //
        // **SNAPSHOT IT BEFORE THE CALL.** `clearDeathState` mutates both sides
        // in place, so a `{...record}` taken afterwards is the AFTER state and
        // the diff against it is empty — which would silently drop the caster's
        // own condition clears on a lethal cast.
        const casterRecord = vanillaRecordOf(actor, "defender");
        const casterBefore = { ...casterRecord };
        const scenario = {
          attackerSide: "villain",
          hero: victimRecord,
          villain: casterRecord,
          fightMode,
          result: null
        };
        const outcome = applySs2MagicDamageCandidate(scenario, damage, {
          spellId: spell.itemId,
          spell: VANILLA_PHASE_LABEL[request.type],
          damageMethod: SS2_BOLT_INGRESS.damageMethod,
          rolledDamage: damage
        });

        // The same refusal the status phase and the attack path carry, for the
        // same reason: a first-blood result ends the bout in the arithmetic and
        // not in the battle, because `battleStanding` decides on `alive` alone.
        if (outcome.resultEvent && outcome.resultEvent.reason === "first-blood") {
          throw new TeamRuleSetError(
            `Rule set ${ruleSetId} produced a first-blood result from ${VANILLA_PHASE_LABEL[request.type]}, ` +
            "which the team resolver cannot represent: it decides elimination on health > 0 and knows nothing " +
            "of hitpoints < hitpointsmax. Use fightMode \"tournament\" for play."
          );
        }

        const victimAfter = scenario.hero;
        const victimEliminated = victimAfter.hitpoints <= 0;

        // **CONSUMPTION IS: SET THE SLOT TO 1.** `use_item` `+0x0409` writes
        // `game.villain["inventory" + i] = 1`, and the hero's own six handlers
        // write the same (`+0x0626`-`+0x0851`). Emitted unconditionally, on a
        // lethal cast too: the build consumes the item when the phase BEGINS,
        // long before `death()` could delete `nextphase`.
        const consumption = [{
          kind: EffectKind.RESOURCE,
          targetId: actor.id,
          resource: slot,
          to: SS2_INVENTORY_EMPTY
        }];

        // `death()` deletes `nextphase` before the transition fires, so a
        // lethal cast costs the caster nothing and regenerates nothing — the
        // rule nineteen goldens measure on the attack path. The COST is still
        // `round(magicka)` and is still unaffordable-proof: `nextphase` spends
        // it unconditionally and `phaseTransitionEffects` clamps the floor at
        // 0 exactly as `check_stats` does.
        const staminaCost = Math.round(actor.stats.magicka);
        const transition = victimEliminated
          ? { effects: [], staminaGained: 0, healed: 0 }
          : phaseTransitionEffects(actor, { staminaCost, crowdAction: SS2_BOLT_INGRESS.crowdAction });

        const effects = [
          ...consumption,
          // `"always"` for the reason the status phase uses it: the same
          // ingress, the same unconditional join. An armour-absorbed bolt still
          // interrupts the victim's charge.
          ...defenderEffects(victimBefore, victimAfter, victim, { psycheReset: "always" }),
          // A lethal cast runs `death()`, which clears all six flags on BOTH
          // gladiators in its own measured order. Emitted from the ingress's
          // own before/after rather than assumed.
          ...statusEffects(casterBefore, scenario.villain, victimBefore, victimAfter, actor, victim),
          ...transition.effects,
          ...crowd
        ];

        return {
          effects,
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: victim.id,
            vanillaLabel: VANILLA_PHASE_LABEL[request.type],
            // Four names for one decision, and none of them is derivable from
            // another. See `VANILLA_PHASE_LABEL`'s entry.
            casterClip: SS2_BOLT_INGRESS.casterClip,
            victimClip: SS2_BOLT_INGRESS.damageMethod,
            bonusFrame: SS2_BOLT_INGRESS.bonusFrame,
            boltFrame: spell.boltFrame,
            spellId: spell.itemId,
            consumedSlot: slot,
            rolledDamage: damage,
            damage: outcome.mutation.appliedDamage,
            armourDamage: outcome.mutation.armourDamage,
            hitpointDamage: outcome.mutation.hitpointDamage,
            staminaBonus: outcome.mutation.staminaBonus,
            staminaSpent: victimEliminated ? 0 : staminaCost,
            staminaGained: transition.staminaGained
          }]
        };
      }

      // ► **THE FIREBALL. The bolt's arithmetic, one sample and no roll, and it
      //   cannot miss** — so it returns before `ATTACK_BANDS` for the bolt's
      //   reason. **What differs is WHEN the damage lands**: at the first frame
      //   the flat `bullet` is past the victim's x, not in the cast's own
      //   straight-line run. A discrete turn resolves it now; the flight, and
      //   the victim's reaction waiting for it, are the presentation's (see
      //   `fireballImpact` in `src/render/projectile.js`). Nothing a peer
      //   hashes depends on the flight, because the build's own flight cannot
      //   change the outcome: no ground, no lifetime, no exit but the impact.
      //
      //   A branch of its own beside the bolt's rather than a widened one, so
      //   the bolt's event stays byte-for-byte what it was. See
      //   `SS2_FIREBALL_SPELLS` for the phase, statement by statement.
      if (SS2_FIREBALL_SPELLS[request.type]) {
        const spell = SS2_FIREBALL_SPELLS[request.type];
        const victim = request.target;
        if (!victim) {
          throw new TeamRuleSetError(
            `${request.type} needs a target; ${String(request.targetId)} is not a combatant.`
          );
        }

        // Re-found at resolve under the offer's own window, for the reason the
        // bolt branch gives at length.
        const slot = ss2InventorySlotHolding(actor, spell.itemId);
        if (slot === null) {
          const beyond = ss2InventorySlotHolding(actor, spell.itemId, { ignoreMaxslots: true });
          if (beyond !== null) {
            throw new TeamRuleSetError(
              `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: item ${spell.itemId} is in ${beyond}, ` +
              `outside inventory_maxslots ${resourceValue(actor, "inventory_maxslots")}. The build's hero panel ` +
              "hides that button (sprite:492[inventory_overlay] +0x024f), and this engine offers and consumes " +
              "through the same window."
            );
          }
          throw new TeamRuleSetError(
            `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: no declared inventory slot holds ` +
            `item ${spell.itemId}. The build's own gate is possession — check_inventory(${spell.itemId}) for ` +
            "the villain, a visible inventory button for the hero — and this engine reproduces it."
          );
        }

        // THE ONE SAMPLE, taken in the caller exactly as the bolt's is: the
        // ingress holds no RNG, and the label is the candidate module's.
        const damage = rolls.randomBetween(spell.rollLabel, spell.damageLow, spell.damageHigh);

        // Roles uncrossed, as for the bolt: `+0x91c1` pushes `defender` last,
        // so it is argument one — the byte-verified signature exactly.
        const victimRecord = vanillaRecordOf(victim, "defender");
        const victimBefore = { ...victimRecord };
        // Snapshot BEFORE the call; `clearDeathState` mutates both sides.
        const casterRecord = vanillaRecordOf(actor, "defender");
        const casterBefore = { ...casterRecord };
        const scenario = {
          attackerSide: "villain",
          hero: victimRecord,
          villain: casterRecord,
          fightMode,
          result: null
        };
        const outcome = applySs2MagicDamageCandidate(scenario, damage, {
          spellId: spell.itemId,
          spell: VANILLA_PHASE_LABEL[request.type],
          damageMethod: SS2_FIREBALL_INGRESS.damageMethod,
          rolledDamage: damage
        });

        if (outcome.resultEvent && outcome.resultEvent.reason === "first-blood") {
          throw new TeamRuleSetError(
            `Rule set ${ruleSetId} produced a first-blood result from ${VANILLA_PHASE_LABEL[request.type]}, ` +
            "which the team resolver cannot represent: it decides elimination on health > 0 and knows nothing " +
            "of hitpoints < hitpointsmax. Use fightMode \"tournament\" for play."
          );
        }

        const victimAfter = scenario.hero;
        const victimEliminated = victimAfter.hitpoints <= 0;

        // Consumed when the phase BEGINS — the villain's `use_item` and the
        // hero's button handler both run before `getphase` — so on a lethal
        // cast too.
        const consumption = [{
          kind: EffectKind.RESOURCE,
          targetId: actor.id,
          resource: slot,
          to: SS2_INVENTORY_EMPTY
        }];

        // `round(magicka)` at `+0x8fa1`-`+0x8fc7`, spent by the watchdog's
        // `nextphase` — which a lethal impact's `death()` deletes first.
        const staminaCost = Math.round(actor.stats.magicka);
        const transition = victimEliminated
          ? { effects: [], staminaGained: 0, healed: 0 }
          : phaseTransitionEffects(actor, { staminaCost, crowdAction: SS2_FIREBALL_INGRESS.crowdAction });

        // `gladiator_dir` at the cast. The launch side, the flight and the
        // impact test all read it (`+0x9284`, `+0x949c`, `+0x9131`/`+0x916c`),
        // and nothing in this action can change it.
        const gladiatorDir = (actor.status ?? []).includes(SS2_FACING_LEFT) ? "left" : "right";

        return {
          effects: [
            ...consumption,
            // `"always"`: the ingress's `psyche_up = 1` is an unconditional join.
            ...defenderEffects(victimBefore, victimAfter, victim, { psycheReset: "always" }),
            ...statusEffects(casterBefore, scenario.villain, victimBefore, victimAfter, actor, victim),
            ...transition.effects,
            ...crowd
          ],
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: victim.id,
            vanillaLabel: VANILLA_PHASE_LABEL[request.type],
            casterClip: SS2_FIREBALL_INGRESS.casterClip,
            victimClip: SS2_FIREBALL_INGRESS.damageMethod,
            bonusFrame: SS2_FIREBALL_INGRESS.bonusFrame,
            spellId: spell.itemId,
            consumedSlot: slot,
            // ► **THE FLIGHT'S TWO INPUTS, AND DELIBERATELY NOT ITS ENDPOINTS.**
            //   `from`/`to` are read as the ACTOR's own walk by
            //   `src/adapter/presentation.js` (`displacementOf`), and
            //   `boltFrame` would attach a lightning bolt, so neither is here.
            //   The positions are the projection's, read where the arrow's are.
            xVelocity: spell.xVelocity,
            gladiatorDir,
            rolledDamage: damage,
            damage: outcome.mutation.appliedDamage,
            armourDamage: outcome.mutation.armourDamage,
            hitpointDamage: outcome.mutation.hitpointDamage,
            staminaBonus: outcome.mutation.staminaBonus,
            staminaSpent: victimEliminated ? 0 : staminaCost,
            staminaGained: transition.staminaGained
          }]
        };
      }

      // ► **MOLTEN DEATH. `1 + 4N` draws, then N ingress calls of a literal 40,
      //   and every boulder lands** — so it returns before `ATTACK_BANDS` for
      //   the bolt's reason, and resolves the whole shower now: the fall decides
      //   only when and where each boulder lands, which is the presentation's.
      //   A branch of its own beside the fireball's, so neither event moves.
      //   See `SS2_DEATH_FROM_ABOVE` for the phase, statement by statement.
      if (request.type === Ss2ActionType.CAST_DEATH_FROM_ABOVE) {
        const spell = SS2_DEATH_FROM_ABOVE;
        const victim = request.target;
        if (!victim) {
          throw new TeamRuleSetError(
            `${request.type} needs a target; ${String(request.targetId)} is not a combatant.`
          );
        }

        // Re-found at resolve under the offer's own window, for the reason the
        // bolt branch gives at length — and BEFORE the first draw, so a refused
        // cast takes nothing off the channel.
        const slot = ss2InventorySlotHolding(actor, spell.itemId);
        if (slot === null) {
          const beyond = ss2InventorySlotHolding(actor, spell.itemId, { ignoreMaxslots: true });
          if (beyond !== null) {
            throw new TeamRuleSetError(
              `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: item ${spell.itemId} is in ${beyond}, ` +
              `outside inventory_maxslots ${resourceValue(actor, "inventory_maxslots")}. The build's hero panel ` +
              "hides that button (sprite:492[inventory_overlay] +0x024f), and this engine offers and consumes " +
              "through the same window."
            );
          }
          throw new TeamRuleSetError(
            `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: no declared inventory slot holds ` +
            `item ${spell.itemId}. The build's own gate is possession — check_inventory(${spell.itemId}) for ` +
            "the villain, a visible inventory button for the hero — and this engine reproduces it."
          );
        }

        // THE DRAWS, ALL AT THE CAST, IN THE BUILD'S ORDER: the count
        // (`+0x86a5`), then boulder by boulder its x offset, start height,
        // speed and scale (`+0x878b`, `+0x87a9`, `+0x87c8`, `+0x87f1`).
        const count = rolls.randomBetween(spell.boulderCount.rollLabel, spell.boulderCount.low, spell.boulderCount.high);
        const boulders = [];
        for (let index = 1; index <= count; index += 1) {
          const boulder = { index };
          for (const roll of spell.boulderRolls) {
            boulder[roll.field] = rolls.randomBetween(ss2DeathFromAboveRollLabel(index, roll), roll.low, roll.high);
          }
          boulder.landingFrame = ss2BoulderLandingFrame(boulder.y0, boulder.ySpeed);
          boulders.push(boulder);
        }
        // The ingress runs in LANDING order. Ties go by boulder index —
        // INVENTED, and no number depends on it: every call is the same 40
        // through the same ingress, so only which boulder the presentation
        // shows as the killing one could change.
        const landing = [...boulders].sort((a, b) => a.landingFrame - b.landingFrame || a.index - b.index);

        // Roles uncrossed, as for the bolt: `+0x88e5` pushes `defender` last,
        // so it is argument one. Snapshot BEFORE the calls; `clearDeathState`
        // mutates both sides.
        const victimRecord = vanillaRecordOf(victim, "defender");
        const victimBefore = { ...victimRecord };
        const casterRecord = vanillaRecordOf(actor, "defender");
        const casterBefore = { ...casterRecord };
        const scenario = {
          attackerSide: "villain",
          hero: victimRecord,
          villain: casterRecord,
          fightMode,
          result: null
        };

        // ► **N CALLS OF THE ONE INGRESS ON THE SAME TWO RECORDS**, so armour
        //   goes first and the overflow rewrite and the exact-equality quirk
        //   each fire on the hit that meets them, with nothing re-implemented.
        //
        // ► **AFTER A KILL THE REST STILL LAND, AND RE-ENTER.** `death()` does
        //   not delete the boulders' handlers, so each later boulder calls the
        //   ingress on the same dead defender and re-enters `death()`. The
        //   ingress refuses a scenario whose result is already set — a guard
        //   for a fixture, not a rule of the build — so the settled result is
        //   lifted for each re-entry and put back: the FIRST result stands, and
        //   a re-entry's duplicate is discarded. On a body at 0 hitpoints and 0
        //   armour a re-entry moves only `psyche_up` (already 1) and the
        //   breastplate stamina join, clamped.
        const hits = [];
        let killingHit = null;
        for (const boulder of landing) {
          const settled = scenario.result;
          scenario.result = null;
          const outcome = applySs2MagicDamageCandidate(scenario, spell.damagePerBoulder, {
            spellId: spell.itemId,
            spell: VANILLA_PHASE_LABEL[request.type],
            damageMethod: spell.damageMethod,
            rolledDamage: spell.damagePerBoulder
          });
          // The same refusal the bolt and the fireball carry, for the same
          // reason — checked on EVERY call, since any one of them can be the
          // first to reach the hitpoints.
          if (outcome.resultEvent && outcome.resultEvent.reason === "first-blood") {
            throw new TeamRuleSetError(
              `Rule set ${ruleSetId} produced a first-blood result from ${VANILLA_PHASE_LABEL[request.type]}, ` +
              "which the team resolver cannot represent: it decides elimination on health > 0 and knows nothing " +
              "of hitpoints < hitpointsmax. Use fightMode \"tournament\" for play."
            );
          }
          if (settled !== null) scenario.result = settled;
          else if (outcome.resultEvent) killingHit = hits.length + 1;
          hits.push({
            boulder: boulder.index,
            armourDamage: outcome.mutation.armourDamage,
            hitpointDamage: outcome.mutation.hitpointDamage,
            staminaBonus: outcome.mutation.staminaBonus,
            afterDeath: settled !== null
          });
        }

        const victimAfter = scenario.hero;
        const victimEliminated = victimAfter.hitpoints <= 0;

        // Consumed when the phase BEGINS, so on a lethal cast too.
        const consumption = [{
          kind: EffectKind.RESOURCE,
          targetId: actor.id,
          resource: slot,
          to: SS2_INVENTORY_EMPTY
        }];

        // `round(magicka)` at `+0x8655`, assigned every tick and spent ONCE by
        // the teardown's `nextphase` (`+0x894d`) — which a kill's `death()`
        // deletes first, so a lethal shower costs nothing and regenerates
        // nothing.
        const staminaCost = Math.round(actor.stats.magicka);
        const transition = victimEliminated
          ? { effects: [], staminaGained: 0, healed: 0 }
          : phaseTransitionEffects(actor, { staminaCost, crowdAction: spell.crowdAction });

        return {
          effects: [
            ...consumption,
            // The NET change over all N calls — resource effects are absolute,
            // so one write per field carrying the settled value is exact.
            // `"always"`: every call's `psyche_up = 1` is an unconditional join.
            ...defenderEffects(victimBefore, victimAfter, victim, { psycheReset: "always" }),
            ...statusEffects(casterBefore, scenario.villain, victimBefore, victimAfter, actor, victim),
            ...transition.effects,
            ...crowd
          ],
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: victim.id,
            vanillaLabel: VANILLA_PHASE_LABEL[request.type],
            casterClip: spell.casterClip,
            victimClip: spell.damageMethod,
            bonusFrame: spell.bonusFrame,
            spellId: spell.itemId,
            consumedSlot: slot,
            boulderCount: count,
            damagePerBoulder: spell.damagePerBoulder,
            // ► **FOR A RENDERER, IN DRAW ORDER**: each boulder's x offset from
            //   the victim, start height, speed, scale and the invocation of its
            //   own `onEnterFrame` it lands on. Deliberately NOT `from`/`to`
            //   (read as the caster's walk) or `xVelocity`/`boltFrame` (a
            //   fireball, a bolt). The boulder art is not extracted.
            boulders,
            // In LANDING order, the order the ingress ran them.
            hits,
            killingHit,
            armourDamage: victimBefore.armourclass - victimAfter.armourclass,
            hitpointDamage: victimBefore.hitpoints - victimAfter.hitpoints,
            // The ingress's own per-call numbers, summed, unclamped.
            staminaBonus: hits.reduce((total, hit) => total + hit.staminaBonus, 0),
            staminaSpent: victimEliminated ? 0 : staminaCost,
            staminaGained: transition.staminaGained
          }]
        };
      }

      // ► **THE GALE. Zero samples, zero damage, one body moved.** It returns
      //   before `ATTACK_BANDS` for the shove's reason: the arm draws nothing,
      //   so entering the dispatcher would take samples the build never takes.
      //   See `SS2_GALE` for the phase, statement by statement.
      if (request.type === Ss2ActionType.CAST_GALE) {
        const victim = request.target;
        if (!victim) {
          throw new TeamRuleSetError(
            `${request.type} needs a target; ${String(request.targetId)} is not a combatant.`
          );
        }
        // Re-found at resolve rather than carried from the offer, for the
        // reason the bolt branch gives.
        const slot = ss2InventorySlotHolding(actor, SS2_GALE.itemId);
        if (slot === null) {
          throw new TeamRuleSetError(
            `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: no declared inventory slot holds ` +
            `item ${SS2_GALE.itemId}. The build's own gate is possession — check_inventory(${SS2_GALE.itemId}) ` +
            "for the villain, a visible inventory button for the hero — and this engine reproduces it."
          );
        }

        // `gladiator_dir == "right"` -> +1000, else -1000 (`+0x7b45`-`+0x7b6d`).
        const facingLeft = (actor.status ?? []).includes(SS2_FACING_LEFT);
        const force = facingLeft ? 0 - SS2_GALE.force : SS2_GALE.force;
        // `knockback(defender, force)` bounds nothing; the clip clamp does. See
        // `SS2_ARENA.clamp` and the shove branch above.
        const to = Number.isFinite(victim.x)
          ? clamp(victim.x + force, SS2_ARENA.clamp.min, SS2_ARENA.clamp.max)
          : null;

        // No damage, so no death: `nextphase` always runs, and the cost is spent
        // unconditionally exactly as the bolt's is.
        const staminaCost = Math.round(actor.stats.magicka);
        // `crowd_action = 2` (`+0x7abd`) on every tick, after `knockback`'s 1
        // (`+0x1dfe`) on the first: the gale adds 2.
        const transition = phaseTransitionEffects(actor, {
          staminaCost,
          crowdAction: ss2CrowdActionOf(VANILLA_PHASE_LABEL[Ss2ActionType.CAST_GALE])
        });

        // In the build's own order: the slot is consumed before the phase runs
        // (the hero's click handler, or `use_item` for the villain), the body
        // moves mid-phase, and `nextphase` settles the stamina at the end.
        const effects = [{
          kind: EffectKind.RESOURCE,
          targetId: actor.id,
          resource: slot,
          to: SS2_INVENTORY_EMPTY
        }];
        if (to !== null && to !== victim.x) {
          effects.push({ kind: EffectKind.POSITION, targetId: victim.id, to });
          effects.push(...facingAfterTargetMove({ ...victim, x: to }));
        }
        effects.push(...transition.effects, ...crowd);

        return {
          effects,
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: victim.id,
            vanillaLabel: VANILLA_PHASE_LABEL[request.type],
            // Both clips are the build's strings and neither is derivable from
            // the label; `SS2_STATIC_MAP_BINDINGS` binds any event carrying the
            // pair, so no presentation case is needed.
            casterClip: SS2_GALE.casterClip,
            victimClip: SS2_GALE.victimClip,
            spellId: SS2_GALE.itemId,
            consumedSlot: slot,
            force,
            // ► **`targetFrom`/`targetTo`, NOT `from`/`to`, AND THE NAME IS THE
            //   FIX.** `src/adapter/presentation.js` reads an event's `from`/`to`
            //   as the ACTOR's own move — a movement binding for the actor and a
            //   `move-clip` for the actor — and that check runs BEFORE the
            //   `casterClip`/`victimClip` case. The shove and the taunt put
            //   their TARGET's displacement in `from`/`to`, and a presented
            //   shove sends the SHOVER to the victim's coordinates with an
            //   assumed `shove` clip and no `knockback` (measured 2026-09-22).
            //   The victim's own on-screen move is a presentation gap for every
            //   displacement verb and is not closed here.
            targetFrom: Number.isFinite(victim.x) ? victim.x : null,
            targetTo: to,
            staminaSpent: staminaCost,
            staminaGained: transition.staminaGained
          }]
        };
      }

      // ► **THE COMMAND. Zero samples, zero damage, one body pulled forty units
      //   a frame.** It returns before `ATTACK_BANDS` for the gale's reason. See
      //   `SS2_COMMAND` for the phase, statement by statement.
      if (request.type === Ss2ActionType.CAST_COMMAND) {
        const victim = request.target;
        if (!victim) {
          throw new TeamRuleSetError(
            `${request.type} needs a target; ${String(request.targetId)} is not a combatant.`
          );
        }
        // Re-found at resolve, through the same window as the offer, for the
        // reason the bolt branch gives.
        const slot = ss2InventorySlotHolding(actor, SS2_COMMAND.itemId);
        if (slot === null) {
          const beyond = ss2InventorySlotHolding(actor, SS2_COMMAND.itemId, { ignoreMaxslots: true });
          if (beyond !== null) {
            throw new TeamRuleSetError(
              `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: item ${SS2_COMMAND.itemId} is in ` +
              `${beyond}, outside inventory_maxslots ${resourceValue(actor, "inventory_maxslots")}. The build's ` +
              "hero panel hides that button (sprite:492[inventory_overlay] +0x024f), and this engine offers and " +
              "consumes through the same window."
            );
          }
          throw new TeamRuleSetError(
            `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: no declared inventory slot holds ` +
            `item ${SS2_COMMAND.itemId}. The build's own gate is possession — ` +
            `check_inventory(${SS2_COMMAND.itemId}) for the villain, a visible inventory button for the hero — ` +
            "and this engine reproduces it."
          );
        }

        // `game_defender.physical_size` — the TARGET's (`+0x7cea`, `+0x7d7d`).
        const standOff = ss2PhysicalSize(victim);
        // `gladiator_dir == "right"` -> `-= 40`, `== "left"` -> `+= 40`
        // (`+0x7c96`, `+0x7d29`). See `ss2CommandPull`.
        const facingLeft = (actor.status ?? []).includes(SS2_FACING_LEFT);
        const positioned = Number.isFinite(victim.x) && Number.isFinite(actor.x);
        const pull = positioned
          ? ss2CommandPull({ casterX: actor.x, targetX: victim.x, facingLeft, standOff })
          : null;
        // ► **CLAMPED ONCE, AT THE END, and that is the build's composition.**
        //   The arm clamps nothing; the clip clamp at the top of the NEXT
        //   `onEnterFrame` bounds ~~`defender._x`~~ the target — as `attacker`,
        //   whose clamp in the build also ends the target's phase; NOT
        //   reproduced, by the owner's decision (`SS2_ARENA.clamp`,
        //   2026-09-22). Toward the caster the pull
        //   never leaves the arena, and the one case that can — a target
        //   behind, pushed away — runs a single frame. See `SS2_ARENA.clamp`.
        //
        // ► **INVENTED FOR THE N-BODY ARENA, NAMED HERE — faithful readings of
        //   an arm that names two bodies:**
        //   - **the pull passes THROUGH bystanders.** The completion test reads
        //     only `defender._x` and `attacker._x`, so a body standing in the
        //     line is never consulted — the fireball's reading, for the
        //     fireball's reason.
        //   - **the rank (`y`) is left alone.** The arm writes only `_x`, and
        //     this engine's `y` is depth, which vanilla does not have; the
        //     stand-off is measured on `x` alone, as the arm measures it.
        const to = pull ? clamp(pull.to, SS2_ARENA.clamp.min, SS2_ARENA.clamp.max) : null;

        // No damage, so no death: `nextphase` always runs — from the arm on
        // completion, or from the stall watchdog on a cut — and both spend the
        // cost, exactly as the gale's is spent.
        const staminaCost = Math.round(actor.stats.magicka);
        // Both ends add the arm's 2 (`+0x7bf9`): the arm writes it every tick
        // and calls no crowd-writing helper, and a watchdog cut reads the value
        // the previous tick's arm left.
        const transition = phaseTransitionEffects(actor, { staminaCost, crowdAction: SS2_COMMAND.crowdAction });

        // The build's order, as for the gale: the slot is consumed when the
        // phase begins, the body moves frame by frame, and `nextphase` settles
        // the stamina at the end.
        const effects = [{
          kind: EffectKind.RESOURCE,
          targetId: actor.id,
          resource: slot,
          to: SS2_INVENTORY_EMPTY
        }];
        if (to !== null && to !== victim.x) {
          effects.push({ kind: EffectKind.POSITION, targetId: victim.id, to });
          // The TARGET moved, so the gale's `facingAfterTargetMove`: a pull
          // that carries the target past the caster turns them both, at the
          // phase advance, as `changeCombatants` would.
          effects.push(...facingAfterTargetMove({ ...victim, x: to }));
        }
        effects.push(...transition.effects, ...crowd);

        return {
          effects,
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: victim.id,
            vanillaLabel: VANILLA_PHASE_LABEL[request.type],
            // Both clips are the build's strings; `SS2_STATIC_MAP_BINDINGS`
            // binds any event carrying the pair.
            casterClip: SS2_COMMAND.casterClip,
            victimClip: SS2_COMMAND.victimClip,
            spellId: SS2_COMMAND.itemId,
            consumedSlot: slot,
            // `targetFrom`/`targetTo`, NOT `from`/`to`, for the gale's reason:
            // `from`/`to` are read as the ACTOR's own move by the presentation.
            targetFrom: positioned ? victim.x : null,
            targetTo: to,
            standOff,
            // How many frames the build pulls, and whether the stall watchdog
            // ended the phase rather than the arm. Presentation data; the
            // resolver has no frames.
            pullTicks: pull ? pull.ticks : null,
            cutByWatchdog: pull ? pull.cut : null,
            staminaSpent: staminaCost,
            staminaGained: transition.staminaGained
          }]
        };
      }

      // ► **THE TELEPORT. One sample, zero damage, and the body it moves is the
      //   CASTER's.** It returns before `ATTACK_BANDS` for the bolts' reason:
      //   the arm's one `randomBetween` is the destination, and entering the
      //   dispatcher would draw a direction the build never draws. See
      //   `SS2_TELEPORT` for the phase, statement by statement.
      if (request.type === Ss2ActionType.CAST_TELEPORT) {
        // Re-found at resolve, through the same window as the offer, for the
        // reason the bolt branch gives.
        const slot = ss2InventorySlotHolding(actor, SS2_TELEPORT.itemId);
        if (slot === null) {
          const beyond = ss2InventorySlotHolding(actor, SS2_TELEPORT.itemId, { ignoreMaxslots: true });
          if (beyond !== null) {
            throw new TeamRuleSetError(
              `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: item ${SS2_TELEPORT.itemId} is in ` +
              `${beyond}, outside inventory_maxslots ${resourceValue(actor, "inventory_maxslots")}. The build's ` +
              "hero panel hides that button (sprite:492[inventory_overlay] +0x024f), and this engine offers and " +
              "consumes through the same window."
            );
          }
          throw new TeamRuleSetError(
            `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: no declared inventory slot holds ` +
            `item ${SS2_TELEPORT.itemId}. The build's own gate is possession — ` +
            `check_inventory(${SS2_TELEPORT.itemId}) for the villain, a visible inventory button for the hero — ` +
            "and this engine reproduces it."
          );
        }

        // THE ONE SAMPLE, taken whether or not this rule set models a position:
        // the build draws on every completed cast, so a peer replaying the tape
        // must consume it either way.
        const drawn = rolls.randomBetween(
          SS2_TELEPORT.rollLabel, SS2_TELEPORT.destinationLow, SS2_TELEPORT.destinationHigh
        );

        // ► **ABSOLUTE, and the arena clamp is applied although it cannot
        //   bind.** The arm stores the draw with no clamp of its own; the clip
        //   clamp in `attacker.onEnterFrame` then ~~acts on `attacker._x` every
        //   frame~~ acts on the caster as `defender` (the completion `nextphase`
        //   has swapped the roles; corrected 2026-09-22), so the build's composed
        //   rule IS `clamp(draw)` — and ±2100
        //   contains ±2000, so it is the draw for every value it can return.
        //   Applied rather than skipped so that every branch here that writes
        //   an `x` writes a bounded one, which is the rule the shove, the gale
        //   and the flee already keep. No mutation of it can go red.
        //
        // ► **INVENTED FOR THE N-BODY ARENA, NAMED HERE — three decisions the
        //   1v1 build never had to make:**
        //   - **the caster may land ON or INSIDE any gladiator, friend or foe,
        //     and is never re-rolled.** The arm checks nothing; a re-roll would
        //     be a second sample the build never takes. Two bodies on one `x`
        //     are handled downstream: `test/ss2-teleport.test.js` pins that
        //     both fighters' offers, walks and a swing resolve.
        //   - **the rank (`y`) is left alone.** The arm writes no `_y`, and this
        //     engine's `y` is depth, which vanilla does not have.
        //   - **no body-blocking check**, because this is not a walk: the walk
        //     clamp against `physical_size` is a property of travelling through
        //     space, and a teleport does not.
        const positioned = Number.isFinite(actor.x);
        const to = positioned ? clamp(drawn, SS2_ARENA.clamp.min, SS2_ARENA.clamp.max) : null;

        // No damage, so no death: `nextphase` always runs, and the cost is spent
        // unconditionally, exactly as the gale's is.
        const staminaCost = Math.round(actor.stats.magicka);
        const transition = phaseTransitionEffects(actor, { staminaCost, crowdAction: SS2_TELEPORT.crowdAction });

        // The build's order, as for the gale: the slot is consumed when the
        // phase begins, the body moves at the completion gate, and `nextphase`
        // settles the stamina last.
        const effects = [{
          kind: EffectKind.RESOURCE,
          targetId: actor.id,
          resource: slot,
          to: SS2_INVENTORY_EMPTY
        }];
        if (to !== null && to !== actor.x) {
          effects.push({ kind: EffectKind.POSITION, targetId: actor.id, to });
          // EVERYBODY's facing, from the ACTOR's new x — `facingAfter`, not the
          // gale's `facingAfterTargetMove`, because the body that moved is the
          // actor's own. `changeCombatants` runs at the phase advance, after
          // the write.
          effects.push(...facingAfter({ ...actor, x: to }));
        }
        effects.push(...transition.effects, ...crowd);

        return {
          effects,
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: actor.id,
            vanillaLabel: VANILLA_PHASE_LABEL[request.type],
            // The CASTER's clip only. There is no `victimClip`, and that absence
            // is the data: the arm plays nothing on anybody else, and
            // `SS2_STATIC_MAP_BINDINGS` binds a lone `casterClip` as a
            // self-cast.
            casterClip: SS2_TELEPORT.casterClip,
            spellId: SS2_TELEPORT.itemId,
            consumedSlot: slot,
            rolledX: drawn,
            // `from`/`to` ARE the actor's own move here, which is what
            // `src/adapter/presentation.js` reads them as — the convention the
            // gale had to step around with `targetFrom`/`targetTo`. What makes
            // it a teleport rather than a walk on screen is `displacementOf`.
            from: positioned ? actor.x : null,
            to,
            staminaSpent: staminaCost,
            staminaGained: transition.staminaGained
          }]
        };
      }

      // ► **ADULATION. Zero samples, zero damage, nobody moves: the crowd takes
      //   50 and that is the whole of it.** It returns before `ATTACK_BANDS`
      //   for the teleport's reason — it is not an attack — and it needs no
      //   target at all. See `SS2_ADULATION` for the phase, statement by
      //   statement. The +50 itself is `nextphase`'s, so it lives in the
      //   transition below and a crowdless battle simply adds nothing.
      if (request.type === Ss2ActionType.CAST_ADULATION) {
        // Re-found at resolve, through the same window as the offer, for the
        // reason the bolt branch gives.
        const slot = ss2InventorySlotHolding(actor, SS2_ADULATION.itemId);
        if (slot === null) {
          throw new TeamRuleSetError(
            `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: no inventory slot inside ` +
            `inventory_maxslots holds item ${SS2_ADULATION.itemId}. The build's own gate is possession — ` +
            `check_inventory(${SS2_ADULATION.itemId}) for the villain, a visible inventory button for the hero — ` +
            "and this engine reproduces it."
          );
        }
        // No damage, so no death: `nextphase` always runs, and spends the cost
        // unconditionally, as for the teleport.
        const staminaCost = Math.round(actor.stats.magicka);
        const transition = phaseTransitionEffects(actor, { staminaCost, crowdAction: SS2_ADULATION.crowdAction });
        return {
          effects: [
            // The slot first — both of the build's choosers empty it before the
            // phase runs — then `nextphase`.
            { kind: EffectKind.RESOURCE, targetId: actor.id, resource: slot, to: SS2_INVENTORY_EMPTY },
            ...transition.effects,
            ...crowd
          ],
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: actor.id,
            vanillaLabel: VANILLA_PHASE_LABEL[request.type],
            // The caster's clip alone, so `SS2_STATIC_MAP_BINDINGS` binds it as
            // a self-cast: the arm plays nothing on anybody else.
            casterClip: SS2_ADULATION.casterClip,
            spellId: SS2_ADULATION.itemId,
            consumedSlot: slot,
            staminaSpent: staminaCost,
            staminaGained: transition.staminaGained,
            healed: transition.healed
          }]
        };
      }

      // ► **WINCROWD. Zero samples on this channel, zero damage, nobody moves:
      //   the crowd takes the actor's `round(charisma / 2)` and the actor pays 3
      //   stamina.** It returns before `ATTACK_BANDS` for adulation's reason —
      //   it is not an attack and has no target but the actor. See
      //   `SS2_WINCROWD` for the arm, statement by statement.
      //
      // ► **NO KILLING PATH EXISTS, and that is the arm's, not an omission.**
      //   Nothing in `+0x4fc9`-`+0x513d` reads or writes `hitpoints` or calls a
      //   damage helper, so `death()` cannot run and `nextphase` always does:
      //   the cost, the regeneration, the crowd step and the psyche reset are
      //   unconditional. (The authored toll below is `SS2_CROWD`'s, appended on
      //   every path, and is not the arm's.)
      if (request.type === Ss2ActionType.WINCROWD) {
        const staminaCost = SS2_WINCROWD.staminaCost;
        // The ACTOR's charisma — the owner's decision, recorded at
        // `ss2WincrowdCrowdAction`, where the build's hero-only read is named.
        const transition = phaseTransitionEffects(actor, { staminaCost, crowdAction: ss2WincrowdCrowdAction(actor) });
        return {
          effects: [...transition.effects, ...crowd],
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: actor.id,
            vanillaLabel: VANILLA_PHASE_LABEL[request.type],
            // The caster's clip alone, so `SS2_STATIC_MAP_BINDINGS` binds it as
            // a self-cast. The build's opcode draw is NOT taken; the clip comes
            // from the fighter and the round — see `ss2WincrowdClip`.
            casterClip: ss2WincrowdClip(actor.id, request.turnNumber),
            staminaSpent: staminaCost,
            staminaGained: transition.staminaGained,
            healed: transition.healed
          }]
        };
      }

      // ► **WEAKEN ARMOUR. Six samples plus the debris, zero damage, and three
      //   calls to the attack path's own `remove_armour`.** It returns before
      //   `ATTACK_BANDS` for the bolts' reason: its direction draws are handed
      //   straight to `remove_armour`, and entering the dispatcher would take a
      //   hit roll the build never takes. See `SS2_WEAKEN_ARMOUR` for the phase,
      //   statement by statement.
      if (request.type === Ss2ActionType.CAST_WEAKEN_ARMOUR) {
        const victim = request.target;
        if (!victim) {
          throw new TeamRuleSetError(
            `${request.type} needs a target; ${String(request.targetId)} is not a combatant.`
          );
        }
        // Re-found at resolve, through the same window as the offer, for the
        // reason the bolt branch gives — and before any draw, so a refused
        // cast leaves the tape where it was.
        const slot = ss2InventorySlotHolding(actor, SS2_WEAKEN_ARMOUR.itemId);
        if (slot === null) {
          const beyond = ss2InventorySlotHolding(actor, SS2_WEAKEN_ARMOUR.itemId, { ignoreMaxslots: true });
          if (beyond !== null) {
            throw new TeamRuleSetError(
              `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: item ${SS2_WEAKEN_ARMOUR.itemId} is ` +
              `in ${beyond}, outside inventory_maxslots ${resourceValue(actor, "inventory_maxslots")}. The ` +
              "build's hero panel hides that button (sprite:492[inventory_overlay] +0x024f), and this engine " +
              "offers and consumes through the same window."
            );
          }
          throw new TeamRuleSetError(
            `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: no declared inventory slot holds ` +
            `item ${SS2_WEAKEN_ARMOUR.itemId}. The build's own gate is possession — ` +
            `check_inventory(${SS2_WEAKEN_ARMOUR.itemId}) for the villain, a visible inventory button for the ` +
            "hero — and this engine reproduces it."
          );
        }

        // The victim's flat vanilla record, mutated in place by all three
        // removals — the build's `game_defender`, which is what each
        // `remove_armour` call subtracts from. Its `gladiator_dir` is the
        // VICTIM's facing, which is what `destroy_armour` reads
        // (`whichavatar.gladiator_dir`, `+0x0dd6`) to shape each debris draw.
        const victimRecord = vanillaRecordOf(victim, "defender");
        const victimBefore = { ...victimRecord };
        const removals = [];
        // ► **THE DEBRIS CLIPS ARE NUMBERED ACROSS THE WHOLE CAST**, so
        //   `armour-debris-N` is the N-th clip this action launches, as it is
        //   on the attack path — where only one removal can ever reach a group
        //   and the question never arose. INVENTED as a labelling rule; the
        //   draws and their order are the build's either way.
        let nextClip = 1;
        for (let round = 1; round <= SS2_WEAKEN_ARMOUR.rounds; round += 1) {
          // `attack_direction = 1 + RandomNumber(9)` — a `randomNumber` sample
          // on this tape, `min 0, max 8`. See `SS2_WEAKEN_ARMOUR`.
          const attackDirection = SS2_WEAKEN_ARMOUR.directionBase + rolls.randomNumber(
            `${SS2_WEAKEN_ARMOUR.directionRollPrefix}-${round}`, SS2_WEAKEN_ARMOUR.directionSpan
          );
          const removal = removeSs2ArmourCandidate(victimRecord, attackDirection, rolls, {
            request: round,
            firstDebrisClip: nextClip,
            side: "victim"
          });
          nextClip += removal.debrisRolls?.length ?? 0;
          removals.push({
            attackDirection,
            selected: removal.selected,
            removed: removal.removed,
            defenceRemoved: removal.defenceRemoved ?? 0,
            // Presentation data: the three raw draws per clip, in launch order,
            // or null when nothing fell. Nothing in this engine reads them.
            debris: removal.debrisRolls ?? null
          });
        }

        // No damage, so no death: `nextphase` always runs, and the cost is spent
        // unconditionally, exactly as the gale's is.
        const staminaCost = Math.round(actor.stats.magicka);
        // `remove_armour` writes no `crowd_action`: the arm's 4 (`+0x778f`) stands.
        const transition = phaseTransitionEffects(actor, { staminaCost, crowdAction: SS2_WEAKEN_ARMOUR.crowdAction });

        // ► **THE VICTIM'S WRITES, AND NOT `defenderEffects`.** That function
        //   always emits a DAMAGE effect — "a miss is a zero-damage effect" —
        //   and nothing here was swung, so a zero there would narrate a miss
        //   the build never rolled. Resource effects are absolute, so one write
        //   per field carrying the settled value is exact, in first-touch
        //   order: `armourclass`, `armourclass_max`, then each destroyed piece
        //   in the order it fell. An undeclared resource is skipped, as
        //   `defenderEffects` skips one, rather than refused mid-list.
        const declared = declaredResourceNames(victim);
        const destroyed = removals.filter((removal) => removal.removed).map((removal) => removal.selected);
        const victimWrites = [];
        for (const name of ["armourclass", "armourclass_max", ...destroyed]) {
          if (!declared.has(name) || victimBefore[name] === victimRecord[name]) continue;
          victimWrites.push({ kind: EffectKind.RESOURCE, targetId: victim.id, resource: name, to: victimRecord[name] });
        }

        // The build's order: the slot is consumed when the phase begins, the
        // three removals run inside the entry block, and `nextphase` settles
        // the stamina on the caster's own `struck`.
        const effects = [
          { kind: EffectKind.RESOURCE, targetId: actor.id, resource: slot, to: SS2_INVENTORY_EMPTY },
          ...victimWrites,
          ...transition.effects,
          ...crowd
        ];

        return {
          effects,
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: victim.id,
            vanillaLabel: VANILLA_PHASE_LABEL[request.type],
            // The CASTER's clip only, and the absence of `victimClip` is the
            // data: the arm plays nothing on the victim, and
            // `SS2_STATIC_MAP_BINDINGS` binds a lone `casterClip` to the caster
            // and nothing else, whoever `targetId` names.
            casterClip: SS2_WEAKEN_ARMOUR.casterClip,
            spellId: SS2_WEAKEN_ARMOUR.itemId,
            consumedSlot: slot,
            removals,
            // The attack event's two names for the same facts, so a narrator
            // reads both verbs alike.
            armourDestroyed: destroyed,
            armourLost: victimBefore.armourclass - victimRecord.armourclass,
            staminaSpent: staminaCost,
            staminaGained: transition.staminaGained
          }]
        };
      }

      // ► **THE DRINK. Zero samples, one pool, and the order is the whole
      //   difficulty.** See `SS2_POTIONS` for the phase statement by statement.
      if (request.type === Ss2ActionType.DRINK_POTION) {
        // `itemId` is the build's `inventory_action`. Validated here as well as
        // by the resolver's legality check, because `resolveAction` is a
        // public rule-set method a caller can reach without an offer — the
        // reason the bolt branch re-finds its slot.
        if (!Number.isInteger(request.itemId) || !Object.hasOwn(SS2_POTIONS, request.itemId)) {
          throw new TeamRuleSetError(
            `${request.type} needs an itemId; ${String(request.itemId)} is not a potion. ` +
            "The drink_potion arm reads inventory_action 2-9 (+0x5807-+0x5cc2)."
          );
        }
        // Self-targeted, as it is offered. A drink aimed at somebody else would
        // still be drunk by the ACTOR — the arm writes only `game_attacker` —
        // so a mismatched target is a malformed request rather than a choice.
        if (request.targetId != null && request.targetId !== actor.id) {
          throw new TeamRuleSetError(
            `${request.type} is drunk by the drinker; ${String(request.targetId)} is not ${actor.id}.`
          );
        }
        const itemId = request.itemId;
        const slot = ss2InventorySlotHolding(actor, itemId);
        if (slot === null) {
          const beyond = ss2InventorySlotHolding(actor, itemId, { ignoreMaxslots: true });
          throw new TeamRuleSetError(
            beyond !== null
              ? `${actor.id} cannot drink item ${itemId}: it is in ${beyond}, outside inventory_maxslots ` +
                `${resourceValue(actor, "inventory_maxslots")}, and this engine offers and consumes through ` +
                "the same window."
              : `${actor.id} cannot drink item ${itemId}: no declared inventory slot holds item ${itemId}. ` +
                "The build's own gate is possession — check_inventory for the villain, a visible inventory " +
                "button for the hero — and this engine reproduces it."
          );
        }

        // THE WRITE AND `check_stats`, before anything else — see
        // `ss2PotionOutcome`.
        const { potion, bonus, before, after } = ss2PotionOutcome(itemId, ss2PoolsOf(actor));

        // ► **CONSUMPTION FIRST, IN THE BUILD'S ORDER.** Both of the build's
        //   choosers empty the slot BEFORE the phase runs: the hero's click
        //   handler, and `use_item` for the villain. The slot is the FIRST
        //   holding the id (`ss2InventorySlotHolding`), which is `use_item`'s
        //   rule exactly; the hero's click empties whichever button was
        //   pressed, and with two identical potions the two differ only in
        //   WHICH slot reads 1 afterwards.
        const effects = [{
          kind: EffectKind.RESOURCE,
          targetId: actor.id,
          resource: slot,
          to: SS2_INVENTORY_EMPTY
        }];

        // The pools `check_stats` settled, one write per pool that moved.
        // Health is the resolver's own field and moves by HEAL/DAMAGE; the
        // other two are declared resources and move by absolute writes,
        // guarded on declaration like every write in this file (the resolver
        // refuses an undeclared name mid-list, with no rollback).
        const healthDelta = after.hitpoints - before.hitpoints;
        if (healthDelta > 0) effects.push({ kind: EffectKind.HEAL, targetId: actor.id, amount: healthDelta });
        if (healthDelta < 0) effects.push({ kind: EffectKind.DAMAGE, targetId: actor.id, amount: 0 - healthDelta });
        const declared = declaredResourceNames(actor);
        for (const pool of ["staminaleft", "armourclass"]) {
          if (declared.has(pool) && after[pool] !== before[pool]) {
            effects.push({ kind: EffectKind.RESOURCE, targetId: actor.id, resource: pool, to: after[pool] });
          }
        }

        // ► **`nextphase` RUNS FROM THE POST-DRINK POOLS, AND THAT IS THE
        //   ORDER THIS BRANCH EXISTS TO GET RIGHT.** The build writes the bonus,
        //   clamps it (`check_stats` `+0x5d67`) and only then transitions, so
        //   the regeneration and heal start from the drunk values. Handing
        //   `phaseTransitionEffects` the frozen view instead would do two wrong
        //   things: the stamina write — ABSOLUTE — would be computed from the
        //   pre-drink value and land AFTER the vial's, erasing it; and the heal
        //   would be priced against headroom the potion had already filled.
        //   `fromStaminaleft`/`fromHealth` are the status phase's hooks for
        //   exactly this, and a separate clamp here rather than `branchGain`
        //   keeps the drink's own number and `nextphase`'s apart in the event.
        //
        //   `staminacost = 0` (`+0x578c`), so the drink is free and the
        //   drinker still regenerates — and, as for every decision that is not
        //   `psyche_up`, `nextphase` resets the charge.
        const transition = phaseTransitionEffects(actor, {
          staminaCost: 0,
          fromStaminaleft: after.staminaleft,
          fromHealth: after.hitpoints,
          // `crowd_action = -3` (`+0x577f`) on every tick: the crowd has no use
          // for a drink.
          crowdAction: ss2CrowdActionOf(VANILLA_PHASE_LABEL[Ss2ActionType.DRINK_POTION])
        });
        effects.push(...transition.effects, ...crowd);

        return {
          effects,
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: actor.id,
            vanillaLabel: VANILLA_PHASE_LABEL[request.type],
            // `attacker.gotoAndPlay("drink_potion")` at `+0x57c6`, on the
            // drinker, and NOTHING on anybody else — so `victimClip` is null
            // rather than absent, and `SS2_STATIC_MAP_BINDINGS` binds the actor
            // alone. The field names are the spells', because that is the pair
            // the binding reads.
            casterClip: VANILLA_PHASE_LABEL[request.type],
            victimClip: null,
            itemId,
            consumedSlot: slot,
            stat: potion.stat,
            // UNCLAMPED, as `bonus_icon.bonus = "+ " + bonus` shows it.
            bonus,
            // Around the write and `check_stats`, before `nextphase`.
            statBefore: before[potion.stat],
            statAfter: after[potion.stat],
            // Presentation extras nothing draws yet: `damage_splat`'s frame and
            // `attacker.potions.gotoAndPlay(inventory_action - 1)` (`+0x57da`).
            bonusFrame: potion.bonusFrame,
            potionFrame: itemId - 1,
            staminaSpent: 0,
            staminaGained: transition.staminaGained,
            healed: transition.healed
          }]
        };
      }

      // ► **THE TIMED BUFFS. Zero samples, no stat of their own, and the whole
      //   effect is a counter `nextphase` reads.** See `SS2_TIMED_BUFFS` for the
      //   arm and `phaseTransitionEffects` for what the counter buys; returned
      //   before `ATTACK_BANDS` for `shove`'s reason.
      const timedBuff = SS2_TIMED_BUFFS[request.type];
      if (timedBuff) {
        // Self-targeted, as offered: the arm writes only the caster's clip.
        if (request.targetId != null && request.targetId !== actor.id) {
          throw new TeamRuleSetError(
            `${request.type} is cast on the caster; ${String(request.targetId)} is not ${actor.id}.`
          );
        }
        // Re-found at resolve, through the same window as the offer, for the
        // reason the bolt branch gives.
        const slot = ss2InventorySlotHolding(actor, timedBuff.itemId);
        if (slot === null) {
          const beyond = ss2InventorySlotHolding(actor, timedBuff.itemId, { ignoreMaxslots: true });
          throw new TeamRuleSetError(
            beyond !== null
              ? `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: item ${timedBuff.itemId} is in ` +
                `${beyond}, outside inventory_maxslots ${resourceValue(actor, "inventory_maxslots")}, and this ` +
                "engine offers and consumes through the same window."
              : `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: no declared inventory slot holds ` +
                `item ${timedBuff.itemId}. The build's own gate is possession — check_inventory for the ` +
                "villain, a visible inventory button for the hero — and this engine reproduces it."
          );
        }
        // Refused BEFORE any effect exists, because the resolver applies a list
        // with no rollback and would refuse the counter write half-way through.
        if (!declaredResourceNames(actor).has(timedBuff.counter)) {
          throw new TeamRuleSetError(
            `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: it does not declare ` +
            `${timedBuff.counter}, and the resolver creates no resource mid-battle. ss2Combatant declares it ` +
            `for any gladiator carrying item ${timedBuff.itemId}.`
          );
        }

        // `staminacost = Math.round(game_attacker.magicka)` — the stat, with no
        // affordability check, the bolts' and the teleport's shape exactly.
        const staminaCost = Math.round(actor.stats.magicka);
        // The arm's `attacker.spell_X = 20` is handed to the transition rather
        // than emitted here: `nextphase` ticks it to 19 before anything reads
        // it, and one absolute write of the result is the same state as two.
        const transition = phaseTransitionEffects(actor, {
          staminaCost,
          armCounters: { [timedBuff.counter]: timedBuff.duration },
          crowdAction: timedBuff.crowdAction
        });

        // The slot first — both of the build's choosers empty it before the
        // phase runs — then `nextphase`.
        const effects = [{
          kind: EffectKind.RESOURCE,
          targetId: actor.id,
          resource: slot,
          to: SS2_INVENTORY_EMPTY
        }, ...transition.effects, ...crowd];

        return {
          effects,
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: actor.id,
            vanillaLabel: VANILLA_PHASE_LABEL[request.type],
            // The CASTER's clip only; no `victimClip`, the teleport's shape, so
            // `SS2_STATIC_MAP_BINDINGS` binds a lone `casterClip` as a self-cast.
            casterClip: timedBuff.casterClip,
            spellId: timedBuff.itemId,
            consumedSlot: slot,
            counter: timedBuff.counter,
            // What the arm wrote, and what `nextphase` left.
            counterSet: timedBuff.duration,
            counterAfter: transition.timedSpells[timedBuff.counter],
            staminaSpent: staminaCost,
            staminaGained: transition.staminaGained,
            healed: transition.healed,
            // How much of the two above the buffs themselves were, on this phase.
            regenerated: transition.regenerated,
            boundlessGained: transition.boundlessGained
          }]
        };
      }

      // ► **REJUVENATE. Zero samples, three pools refilled and nine fields
      //   restored, all on the caster.** See `SS2_REJUVENATE` for the arm
      //   statement by statement; returned before `ATTACK_BANDS` for `shove`'s
      //   reason.
      if (request.type === Ss2ActionType.CAST_REJUVINATE) {
        // Self-targeted, as offered: the arm writes only `game_attacker`.
        if (request.targetId != null && request.targetId !== actor.id) {
          throw new TeamRuleSetError(
            `${request.type} is cast on the caster; ${String(request.targetId)} is not ${actor.id}.`
          );
        }
        // Re-found at resolve, through the same window as the offer, for the
        // reason the bolt branch gives.
        const slot = ss2InventorySlotHolding(actor, SS2_REJUVENATE.itemId);
        if (slot === null) {
          const beyond = ss2InventorySlotHolding(actor, SS2_REJUVENATE.itemId, { ignoreMaxslots: true });
          throw new TeamRuleSetError(
            beyond !== null
              ? `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: item ${SS2_REJUVENATE.itemId} is ` +
                `in ${beyond}, outside inventory_maxslots ${resourceValue(actor, "inventory_maxslots")}, and ` +
                "this engine offers and consumes through the same window."
              : `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: no declared inventory slot holds ` +
                `item ${SS2_REJUVENATE.itemId}. The build's own gate is possession — check_inventory for the ` +
                "villain, a visible inventory button for the hero — and this engine reproduces it."
          );
        }
        // Refused BEFORE any effect exists, as the timed buffs refuse an
        // undeclared counter: the resolver applies a list with no rollback.
        const missing = ss2RejuvenateMissingBackups(actor);
        if (missing.length > 0) {
          throw new TeamRuleSetError(
            `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: it declares ` +
            `${missing.map(({ piece }) => piece).join(", ")} but not ` +
            `${missing.map(({ backup }) => backup).join(", ")}, so the restore has nothing to read. ` +
            `ss2Combatant declares the backups for any gladiator carrying item ${SS2_REJUVENATE.itemId}.`
          );
        }

        const declared = declaredResourceNames(actor);
        const pools = ss2PoolsOf(actor);
        // `staminacost = Math.round(game_attacker.magicka)` (`+0x8d89`), the
        // stat, with no affordability check — the timed buffs' shape.
        const staminaCost = Math.round(actor.stats.magicka);

        // The slot first — both of the build's choosers empty it before the
        // phase runs.
        const effects = [{
          kind: EffectKind.RESOURCE,
          targetId: actor.id,
          resource: slot,
          to: SS2_INVENTORY_EMPTY
        }];

        // ► **THE THREE POOLS, IN THE ARM'S ORDER** (`+0x8e02`, `+0x8e17`,
        //   `+0x8e2c`). Health is the resolver's own field and moves by
        //   HEAL/DAMAGE, as the drink's does; the other two are declared
        //   resources and move by absolute writes, guarded on declaration.
        //   `armourclass_max` is only READ: a caster who lost pieces refills to
        //   the lowered maximum, because `remove_armour` lowered both pools and
        //   `battlevalues` rebuilds the maximum only before the fight.
        const healthRestored = actor.maxHealth - actor.health;
        if (healthRestored > 0) effects.push({ kind: EffectKind.HEAL, targetId: actor.id, amount: healthRestored });
        if (healthRestored < 0) effects.push({ kind: EffectKind.DAMAGE, targetId: actor.id, amount: 0 - healthRestored });
        const staminaRestored = pools.staminamax - pools.staminaleft;
        if (declared.has("staminaleft") && staminaRestored !== 0) {
          effects.push({ kind: EffectKind.RESOURCE, targetId: actor.id, resource: "staminaleft", to: pools.staminamax });
        }
        const armourRestored = pools.armourclass_max - pools.armourclass;
        if (declared.has("armourclass") && armourRestored !== 0) {
          effects.push({
            kind: EffectKind.RESOURCE, targetId: actor.id, resource: "armourclass", to: pools.armourclass_max
          });
        }

        // ► **THE NINE RESTORES, IN THE ARM'S ORDER** (`+0x8e41`-`+0x8f08`),
        //   each `<field> = backup_<field>`: the fight-start snapshot, so a
        //   piece `remove_armour` zeroed comes back and a piece never owned
        //   stays 0. One write per field that MOVES; a field the caster does not
        //   declare has nothing to restore (the offer and the check above
        //   guarantee every declared one has its backup). The arm writes no
        //   `_defence`; `nextphase`'s `battlevalues` reprices the restored
        //   pieces, below, after the transition.
        //
        // ► **A NAMED, DELIBERATE DIVERGENCE — THE OWNER'S DECISION 2026-09-22.**
        //   The build's first restore is NOT `game_attacker.backup_shoulderguard`
        //   but `whichcharacter.backup_shoulderguard`, read through `GetVariable
        //   "whichcharacter"` at `+0x8e50` — a free variable nothing in the build
        //   assigns (every push of the string is a `GetVariable` read), so in the
        //   build the rejuvenated shoulderguard is `undefined`, which
        //   `remove_armour`'s `piece == 0` test (`+0x045b`-`+0x0472`, `Equals2`)
        //   then treats as WORN. **This engine restores it from its own backup
        //   like the other eight — the owner chose that over reproducing the
        //   build (handoff decision 1d, 2026-09-22).** Reproducing it was not
        //   free either: `undefined` is a value the resource bag cannot hold
        //   (it carries finite numbers only), so it would have needed a
        //   stand-in. No golden carries 43, so no golden can observe it.
        //   `test/ss2-rejuvenate.test.js` pins the decision by name.
        const piecesRestored = [];
        for (const { piece, backup } of SS2_REJUVENATE.restores) {
          if (!declared.has(piece)) continue;
          const from = resourceValue(actor, piece);
          const to = resourceValue(actor, backup);
          if (from === to) continue;
          effects.push({ kind: EffectKind.RESOURCE, targetId: actor.id, resource: piece, to });
          piecesRestored.push({ piece, from, to });
        }

        // ► **`nextphase` RUNS FROM THE REFILLED POOLS**, the drink's order and
        //   for the drink's reason: the arm writes inside the `struck == null`
        //   block and `nextphase` runs on the later `struck == true` pass
        //   (`+0x8f24`-`+0x8f58`), so the cost comes off a FULL stamina bar and
        //   the heal finds no headroom.
        const transition = phaseTransitionEffects(actor, {
          staminaCost,
          fromStaminaleft: pools.staminamax,
          fromHealth: actor.maxHealth,
          crowdAction: SS2_REJUVENATE.crowdAction
        });
        effects.push(...transition.effects);

        // ► **AND THEN `battlevalues(game_attacker)` (`+0x35f1`), WHICH GIVES
        //   EACH RESTORED PIECE THE DEFENCE ITS ID IS WORTH.** The ungated block
        //   recomputes every `<piece>_defence` from the id (`+0x3480`-`+0x3633`)
        //   after the psyche reset (`+0x35c7`-`+0x35ea`), so this lands after
        //   every effect `nextphase` emitted above, in `battlevalues`' own order,
        //   through the same `ss2PieceDefence` construction uses. The gated
        //   block that would rebuild `armourclass_max` from them does NOT run
        //   mid-battle (`+0x3a90`-`+0x3aa0`), so neither pool moves here.
        //
        //   ~~**NOT NEEDED**: "this engine's are still the values `battlevalues`
        //   recomputes from the restored ids".~~ **WRONG, and it was mine —
        //   reproduced by a Codex review, 2026-09-22.** It holds only when the
        //   gladiator was BUILT before it lost the piece. One rebuilt afterwards
        //   — `battleStarted`, or a `derive: false` capture of a build whose own
        //   `nextphase` had already priced the empty slot at 0 — carries
        //   `helmet_defence: 0` beside `helmet: 0`, so the restored helmet was
        //   worth nothing and its next removal took nothing from either pool.
        //
        //   Only the RESTORED pieces are repriced: the build reprices all eight
        //   every phase, but no other id changed on this one, and the only
        //   reader of a `_defence` (`removeArmourCandidate`) reads it only while
        //   the piece is worn — so a stale value beside an id of 0 can never be
        //   read until a restore, which is this line.
        //
        // ► **`usingBow: false` IS THE BAG'S REPRESENTATION, NO LONGER A
        //   DIVERGENCE (2026-09-22).** ~~NAMED CHOICE: the shield's melee value,
        //   leaving the bow zeroing as `swap_weapons`' divergence, in one
        //   place.~~ The build zeroes `shield_defence` while `using_bow`
        //   (`+0x35e2`-`+0x3633`), at this `nextphase` and in the swap arm, and
        //   that divergence is closed where it lived: `vanillaRecordOf` hands
        //   `remove_armour` a 0 while `equipped_weapon` is 2, and the bag keeps
        //   the SHEATHED rating, for the damage pair's reason. So the restore
        //   writes the sheathed rating whatever is in hand, and what the build's
        //   `remove_armour` takes follows: 0 while an archer's bow stays drawn,
        //   12 once the sheathing swap has repriced it (`+0x4fab`). Pinned in
        //   `test/ss2-rejuvenate.test.js` under each mode.
        //
        //   What remains is the FIELD, not the behaviour: with a bow drawn this
        //   bag's `shield_defence` (and this event's `defenceRepriced`) reads
        //   the sheathed 12 where the build's field reads 0, visible on the
        //   wire. No removal reads the field except through `vanillaRecordOf`.
        const herolevel = resourceValue(actor, "herolevel", SS2_RESOURCE_DEFAULTS.herolevel);
        const restoredTo = new Map(piecesRestored.map(({ piece, to }) => [piece, to]));
        const defenceRepriced = [];
        for (const piece of SS2_BATTLEVALUES_DEFENCE_ORDER) {
          const field = `${piece}_defence`;
          if (!restoredTo.has(piece) || !declared.has(field)) continue;
          const from = resourceValue(actor, field);
          const to = ss2PieceDefence(piece, restoredTo.get(piece), { herolevel, usingBow: false });
          if (from === to) continue;
          effects.push({ kind: EffectKind.RESOURCE, targetId: actor.id, resource: field, to });
          defenceRepriced.push({ piece, from, to });
        }
        effects.push(...crowd);

        return {
          effects,
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: actor.id,
            vanillaLabel: VANILLA_PHASE_LABEL[request.type],
            // The CASTER's clip only; no `victimClip`, the teleport's shape, so
            // `SS2_STATIC_MAP_BINDINGS` binds a lone `casterClip` as a self-cast.
            casterClip: SS2_REJUVENATE.casterClip,
            spellId: SS2_REJUVENATE.itemId,
            consumedSlot: slot,
            // What the arm's three writes gave back, before `nextphase`.
            healthRestored,
            staminaRestored,
            armourRestored,
            // `{ piece, from, to }` per field that moved, in the arm's order.
            piecesRestored,
            // `{ piece, from, to }` per `_defence` `battlevalues` repriced, in its order.
            defenceRepriced,
            staminaSpent: staminaCost,
            staminaGained: transition.staminaGained,
            healed: transition.healed
          }]
        };
      }

      // ► **THE FOUR STAT SPELLS. Zero samples; the arm writes stats from the
      //   bearer's `backup_*`, and `check_spells` takes them back when the
      //   counter runs out.** See `SS2_STAT_SPELLS` for each arm; returned
      //   before `ATTACK_BANDS` for `shove`'s reason.
      const statSpell = SS2_STAT_SPELLS[request.type];
      if (statSpell) {
        const onVictim = statSpell.bearer === "victim";
        const bearer = onVictim ? request.target : actor;
        const label = VANILLA_PHASE_LABEL[request.type];
        if (onVictim && (!bearer || bearer.teamId === actor.teamId)) {
          throw new TeamRuleSetError(`${request.type} is cast on a foe; ${String(request.targetId)} is not one.`);
        }
        if (!onVictim && request.targetId != null && request.targetId !== actor.id) {
          throw new TeamRuleSetError(
            `${request.type} is cast on the caster; ${String(request.targetId)} is not ${actor.id}.`
          );
        }
        // Re-found at resolve, through the same window as the offer, for the
        // reason the bolt branch gives.
        const slot = ss2InventorySlotHolding(actor, statSpell.itemId);
        if (slot === null) {
          throw new TeamRuleSetError(
            `${actor.id} cannot cast ${label}: no declared inventory slot inside its window holds item ` +
            `${statSpell.itemId}. The build's own gate is possession, and this engine reproduces it.`
          );
        }
        // Refused BEFORE any effect exists: the resolver applies a list with no
        // rollback and would refuse the counter write half-way through.
        const missing = ss2StatSpellResources(statSpell).filter((name) => !declaredResourceNames(bearer).has(name));
        if (missing.length > 0) {
          throw new TeamRuleSetError(
            `${actor.id} cannot cast ${label} on ${bearer.id}: it does not declare ${missing.join(", ")}, and the ` +
            "resolver creates no resource mid-battle. The opening declares them on whoever the spell can land on."
          );
        }

        // The once-block, from the BEARER's fight-start backups. Emitted
        // before the transition, whose tick may expire another of the
        // bearer's counters and put a stat back — the build's order.
        const backup = Object.fromEntries(statSpell.stats.map((stat) => [stat, ss2BackupStat(bearer, stat)]));
        const statsSet = statSpell.write(backup);
        const statEffects = Object.entries(statsSet).map(([stat, to]) => ({
          kind: EffectKind.STAT, targetId: bearer.id, stat, to
        }));

        // `staminacost = Math.round(game_attacker.magicka)`, the CASTER's
        // stat in all four (little fat kid's `+0x8229` included), with no
        // affordability check. The arm's counter write is handed to the
        // transition rather than emitted, as regenerate's is.
        const staminaCost = Math.round(actor.stats.magicka);
        const armed = { [statSpell.counter]: statSpell.duration };
        const transition = phaseTransitionEffects(actor, {
          staminaCost,
          armCounters: onVictim ? null : armed,
          armCountersOn: onVictim ? { [bearer.id]: armed } : null,
          // Each arm writes its own constant every tick and calls no
          // crowd-writing helper, so it stands — colossus's 15 too, although
          // its phase ends through the stall watchdog: that `nextphase` reads
          // what the previous tick's arm left.
          crowdAction: statSpell.crowdAction
        });
        const counterAfter = onVictim
          ? transition.timedSpellsOn[bearer.id]?.[statSpell.counter]
          : transition.timedSpells[statSpell.counter];

        const effects = [{
          kind: EffectKind.RESOURCE,
          targetId: actor.id,
          resource: slot,
          to: SS2_INVENTORY_EMPTY
        }, ...statEffects, ...transition.effects, ...crowd];

        return {
          effects,
          events: [{
            type: request.type,
            actorId: actor.id,
            targetId: bearer.id,
            vanillaLabel: label,
            casterClip: statSpell.casterClip,
            // Only little fat kid plays anything on anybody else.
            ...(statSpell.victimClip ? { victimClip: statSpell.victimClip } : {}),
            spellId: statSpell.itemId,
            consumedSlot: slot,
            counter: statSpell.counter,
            counterSet: statSpell.duration,
            counterAfter,
            // What the arm wrote, in this engine's stat names, before
            // `nextphase` could put any of it back.
            statsSet,
            staminaSpent: staminaCost,
            staminaGained: transition.staminaGained,
            healed: transition.healed
          }]
        };
      }

      const band = ATTACK_BANDS[request.type]
        // The discharging press, and ONLY that press, is band-shaped. See
        // `PSYCHE_UP_DISCHARGE` for why the action is not in `ATTACK_BANDS`.
        ?? (request.type === Ss2ActionType.PSYCHE_UP ? PSYCHE_UP_DISCHARGE : undefined)
        // The whirlwind and the ghost strike, which are spells that ARE attacks.
        // See `SS2_ITEM_STRIKES`.
        ?? SS2_ITEM_STRIKES[request.type]
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
            //   **Clamped to the arena, and the CITATION for that was wrong
            //   until 2026-09-17.** This said "`nextphase` step 1 bounds every
            //   `_x`". It does not: `nextphase` clamps `game_attacker._x` and
            //   `game_defender._x`, which live on `_root.game.hero`/`.villain`
            //   — plain `new Object()`s that nothing else in the SWF reads or
            //   writes `._x` on. That block is DEAD. The clamp that really
            //   bounds a gladiator is a near-identical copy inside
            //   `attacker.onEnterFrame` (`+0x38fd`, `+0x3988`, `+0x3a13`,
            //   `+0x3a3f`), acting on the CLIPS — and `knockback()` itself
            //   bounds nothing at all, so the clip clamp is the whole of it.
            //   **The value survives and the reasoning did not**; see
            //   `SS2_ARENA.clamp`.
            const shoved = Number.isFinite(target.x)
              ? clamp(target.x + force, SS2_ARENA.clamp.min, SS2_ARENA.clamp.max)
              : null;
            if (shoved !== null && shoved !== target.x) {
              effects.push({ kind: EffectKind.POSITION, targetId: target.id, to: shoved });
              effects.push(...facingAfterTargetMove({ ...target, x: shoved }));
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
      //   ~~`defender._x -/+ round(weapon_range + 50)`~~
      //   `round(defender._x -/+ (weapon_range + 50))`, strictly, by facing
      //   (`+0x6658`-`+0x6699` right, `+0x66d1`-`+0x6712` left). See
      //   `ss2PsycheDischargeInRange`, corrected 2026-09-22.
      //
      //   **It must therefore run BEFORE the first draw**, for the reason the
      //   block below spells out about the record builders: a refusal after a
      //   draw leaves the battle hashed differently from a peer that never
      //   attempted it.
      //
      // ► ~~**AND THE COUNTER IS LEFT ALONE, WHICH IS UNOBSERVABLE EITHER
      //   WAY.** The map does not say whether a gated-out press still advances
      //   it. It does not matter: the counter is already at or past
      //   `dischargeAt` and every value there selects the same arm, so
      //   advancing and not advancing produce the same clip and the same next
      //   press.~~
      //
      //   **CORRECTED 2026-09-22: A GATED PRESS SPENDS THE CHARGE AND LANDS ON
      //   2, and "the same clip and the same next press" was false.** The
      //   bytes settle what the map did not (a write-nothing verifier, then
      //   re-read here from the dump of this block): the `== 3` arm
      //   (`+0x65ef`-`+0x6742`) routes ALL FOUR exits of its gate — pass or
      //   fail, facing right or left — to `+0x6732`-`+0x6742`,
      //   `game_attacker.psyche_up = 1`, in the same tick; the completion tick
      //   adds one at `+0x6761`; and `nextphase`'s reset (`+0x35c7`) is
      //   skipped because the decision is still `psyche_up`. So a gated press
      //   leaves **2** — exactly what a non-lethal discharge leaves, and the
      //   build cannot tell the two apart — and the next press plays
      //   `psyche_up2` and CHARGES. The old reading kept 3 and let it
      //   discharge; the counter was never "at or past `dischargeAt`" after
      //   the press, only before it.
      if (request.type === Ss2ActionType.PSYCHE_UP) {
        const separation = ss2FightDistance(actor, target);
        const gate = Math.round(ss2Reach(actor) + SS2_PSYCHE_UP.rangeBonus);
        if (!ss2PsycheDischargeInRange(actor, target)) {
          const transition = phaseTransitionEffects(actor, {
            staminaCost: Math.round(actor.stats.strength * PSYCHE_UP_DISCHARGE.strengthFactor),
            // Still a `psyche_up` decision even though it decided nothing, so
            // `nextphase` does not reset. ~~a gladiator gated out by range
            // keeps his charge and can spend it once he has closed.~~ **He
            // does not keep it** — the arm's own write-back does the resetting,
            // below, and that is what this skipped reset would have duplicated.
            resetsPsyche: false,
            // The level-3 press's one write, `crowd_action = 3` (`+0x6604`),
            // with no `checkattackroll` after it to overwrite it: a discharge
            // gated out of range still pleases the crowd by 3.
            crowdAction: SS2_PSYCHE_DISCHARGE_CROWD.outOfRange
          });
          // The arm's write-back (`+0x6738`) and the completion's increment
          // (`+0x6761`), as ONE absolute write of their result — the shape the
          // discharge's own write-back takes below. Guarded on declaration for
          // the reason every resource write here is.
          const landed = SS2_PSYCHE_UP.floor + 1;
          const psycheWrite = declaredResourceNames(actor).has("psyche_up")
            ? [{ kind: EffectKind.RESOURCE, targetId: actor.id, resource: "psyche_up", to: landed }]
            : [];
          return {
            effects: [...transition.effects, ...psycheWrite, ...crowd],
            events: [{
              type: Ss2ActionType.PSYCHE_UP,
              actorId: actor.id,
              targetId: target.id,
              clip: SS2_PSYCHE_UP.clips[SS2_PSYCHE_UP.clips.length - 1],
              counter: psycheCounter,
              // ~~`counterAfter: psycheCounter`~~ — the gated press spends it.
              counterAfter: landed,
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

      // ► **THE ITEM STRIKES' OWN PRE-DRAW WORK: FIND THE ITEM, AND — FOR THE
      //   WHIRLWIND — ASK THE DISCHARGE'S GATE. Both before the first draw**, for
      //   the reason the block above gives: a refusal after a draw is a
      //   desynchronised peer.
      //
      //   The slot is re-found at resolve, through the offer's own window, for
      //   the reason the bolt branch gives. It is consumed whether or not the
      //   strike lands or even reaches: the build's choosers empty it before the
      //   phase runs (the hero's click handler, the villain's `use_item`).
      let itemStrike = null;
      if (SS2_ITEM_STRIKES[request.type]) {
        const slot = ss2InventorySlotHolding(actor, band.itemId);
        if (slot === null) {
          const beyond = ss2InventorySlotHolding(actor, band.itemId, { ignoreMaxslots: true });
          throw new TeamRuleSetError(
            beyond !== null
              ? `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: item ${band.itemId} is in ` +
                `${beyond}, outside inventory_maxslots ${resourceValue(actor, "inventory_maxslots")}, and this ` +
                "engine offers and consumes through the same window."
              : `${actor.id} cannot cast ${VANILLA_PHASE_LABEL[request.type]}: no declared inventory slot holds ` +
                `item ${band.itemId}. The build's own gate is possession — check_inventory(${band.itemId}) for ` +
                "the villain, a visible inventory button for the hero — and this engine reproduces it."
          );
        }
        itemStrike = {
          slot,
          consumption: [{ kind: EffectKind.RESOURCE, targetId: actor.id, resource: slot, to: SS2_INVENTORY_EMPTY }],
          // `staminacost = Math.round(game_attacker.magicka)`, set before the
          // gate on every tick (`+0x78fa`, `+0x7dd7`), with no affordability
          // check — the bolts' shape.
          staminaCost: Math.round(actor.stats.magicka)
        };

        // ► **OUT OF RANGE THE WHIRLWIND IS A LEGAL, WASTED CAST.** Both facing
        //   tests fail (`+0x798a`-`+0x7a44`), so neither `checkattackroll()`
        //   runs: no sample, no damage. Everything else in the entry block
        //   still does — the item is gone, `psyche_up3` plays, the write-back to
        //   1 (`+0x7a64`) is after both tests — and `nextphase` spends the cost.
        if (request.type === Ss2ActionType.CAST_WHIRLWIND && !ss2PsycheDischargeInRange(actor, target)) {
          // ► **`resetsPsyche: false` AND THE ARM'S OWN WRITE, rather than the
          //   reset**, so the write is one and in the arm's place; the two
          //   write the same 1. See the in-range write below for why the arm's
          //   write, not `nextphase`'s, is the one to model.
          const transition = phaseTransitionEffects(actor, {
            staminaCost: itemStrike.staminaCost, resetsPsyche: false,
            // The arm's own 3 (`+0x78ed`), written every tick: in range or not.
            crowdAction: SS2_WHIRLWIND.crowdAction
          });
          const psycheWrite = declaredResourceNames(actor).has("psyche_up")
            && resourceValue(actor, "psyche_up", SS2_PSYCHE_UP.floor) !== SS2_PSYCHE_UP.floor
            ? [{ kind: EffectKind.RESOURCE, targetId: actor.id, resource: "psyche_up", to: SS2_PSYCHE_UP.floor }]
            : [];
          return {
            effects: [...itemStrike.consumption, ...psycheWrite, ...transition.effects, ...crowd],
            events: [{
              type: request.type,
              actorId: actor.id,
              targetId: target.id,
              vanillaLabel: VANILLA_PHASE_LABEL[request.type],
              // The caster's clip alone, so `SS2_STATIC_MAP_BINDINGS` binds it
              // as a self-cast: nothing plays on a victim who was never struck.
              casterClip: SS2_WHIRLWIND.casterClip,
              spellId: SS2_WHIRLWIND.itemId,
              consumedSlot: itemStrike.slot,
              // The discharge's own field for "no roll at all", which a miss
              // is not, and the two numbers that decided it.
              outOfRange: true,
              separation: ss2FightDistance(actor, target),
              gate: Math.round(ss2Reach(actor) + SS2_PSYCHE_UP.rangeBonus),
              staminaSpent: itemStrike.staminaCost,
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
      // ► **THE AUTHORED BACK-ATTACK BONUS, computed HERE so that "did this
      //   action kill?" can include it** (see the block below the transition
      //   for what the bonus is). `eliminated` reads the vanilla blow alone,
      //   which is what the build decides on; `killedAfterBonus` is the answer
      //   once the authored damage has landed too, and every KILL-DEPENDENT
      //   rule in this branch — the skipped transition, the stamina reported,
      //   the discharge's counter, the ghost-striker left beside the body —
      //   reads it. Found by two Codex adversarial reviews on 2026-09-22: a
      //   blow finished by the bonus still paid its stamina, healed, ticked its
      //   buffs and reset its psyche, as if its target had survived. With no
      //   bonus (every fixture replay, which has no positions) the two agree.
      const struck = Math.max(0, defenderBefore.hitpoints - scenario.villain.hitpoints);
      // ► **A GHOST STRIKE IS JUDGED FROM WHERE IT STRIKES, NOT FROM WHERE ITS
      //   CASTER STOOD.** The arm moves the caster to `defender._x +
      //   game_attacker.physical_size` when `gladiator_dir == "left"` and to
      //   `defender._x - physical_size` otherwise (`+0x7e4c`-`+0x7eac`), and
      //   only then calls `checkattackroll()` (`+0x7f77`); the arm writes no
      //   `_x` or `gladiator_dir` between the two. So the blow comes from the
      //   side that keeps the caster FACING its victim — the right of it when
      //   facing left, the left when facing right — whatever side it stood on.
      //   Judging the authored bonus from the pre-teleport `x` granted +50%, and
      //   a kill, from a side the caster never strikes from, and the kill move
      //   below then left the killer on the other side of the body (audit WG-1,
      //   2026-09-22, confirmed by an independent refuter).
      //
      //   1v1 cannot move: a separated pair always faces each other, so the
      //   landing is on the side the caster already stood on, and a co-located
      //   pair keeps the facings it had when apart. Pinned in the test file.
      //
      //   **UNCLAMPED, deliberately.** The build's clip clamp is at the top of
      //   `attacker.onEnterFrame` (`+0x38fd`-`+0x3a3f`), before the phase arms,
      //   so the roll sees the raw landing. Only the kill's RECORDED position
      //   is clamped (below), and at the arena edge the two can differ.
      const ghostLanding = request.type === Ss2ActionType.CAST_GHOST_STRIKE
        && Number.isFinite(actor.x) && Number.isFinite(target.x)
        ? ((actor.status ?? []).includes(SS2_FACING_LEFT)
          ? target.x + ss2PhysicalSize(actor)
          : target.x - ss2PhysicalSize(actor))
        : null;
      const backAttack = backAttackBonus > 0
        && struck > 0
        && ss2IsBackAttack(ghostLanding === null ? actor : { ...actor, x: ghostLanding }, target);
      const backAttackDamage = backAttack ? Math.round(struck * backAttackBonus) : 0;
      const killedAfterBonus = eliminated
        || (backAttackDamage > 0 && scenario.villain.hitpoints - backAttackDamage <= 0);
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
      // An item strike is a SPELL's price, `round(magicka)`, on both paths —
      // see `SS2_ITEM_STRIKES`.
      const staminaCost = itemStrike !== null
        ? itemStrike.staminaCost
        : fixtureReplay
        ? Math.round(actor.stats.strength * band.strengthFactor)
        : ss2SwingCost({
          bandFactor: band.strengthFactor,
          attackSpeed: resourceValue(actor, "attack_speed", SS2_RESOURCE_DEFAULTS.attack_speed),
          strength: actor.stats.strength
        });
      const transition = killedAfterBonus
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
          // The whirlwind writes the counter back itself (`+0x7a64`), below,
          // for the discharge's reason: one write, in the arm's place.
          resetsPsyche: request.type !== Ss2ActionType.PSYCHE_UP && request.type !== Ss2ActionType.CAST_WHIRLWIND,
          // The arm's top write where it has one; where it has none (normal,
          // bash, the level-3 discharge), what this blow's damage path left.
          crowdAction: ss2AttackPathCrowdAction(request.type, outcome)
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
      // (`struck`, `backAttack`, `backAttackDamage` and `killedAfterBonus` are
      // computed above, beside `eliminated`, because the phase transition
      // must know whether the action KILLED once the bonus has landed.)

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

      // ► **AND `damagecharacter`'s KNOCKBACK MOVES HIM, which is the last
      //   displacement gap on a verb this engine models.** The force has been
      //   computed correctly since the candidate was written
      //   (`ss2-attack-candidate.js:568-580`, every clause byte-matched) and
      //   travelled as an EVENT FIELD that nothing read, so a knocked-back
      //   gladiator played the clip and stood exactly where he was.
      //
      // ► **IT WAS DEFERRED FOR A COST THAT DOES NOT EXIST, and saying so is
      //   the point.** Three places in this repository — the docblock at
      //   `SS2_TAUNT.knockbackAnimationForce`, a comment in
      //   `test/ss2-taunt.test.js`, and a handoff's `next:` field calling it
      //   "a DECISION and not an afternoon" — said closing it would "re-datum
      //   every pinned hash and every golden that carries one". **Measured
      //   2026-09-17: no golden carries a position or a hash, and structurally
      //   cannot** — `startingPosition` returns `null` under `fixtureReplay`,
      //   so the `Number.isFinite(target.x)` guard below suppresses this for
      //   every promoted fixture. The set the sentence quantified over was
      //   empty, and an afternoon's work was deferred across two sessions on
      //   the strength of it.
      //
      // ► **THE PINS THAT SURVIVE THIS SURVIVE BY LUCK, NOT BY COVERAGE.**
      //   Every seeded pin's driver picks attack directions 1-4, and the
      //   build's knockback gate needs 5-12 or 30 (`+0x1a72`-`+0x1aa5`), so
      //   they cannot reach this branch. Re-stage one on power attacks and it
      //   moves. "No pin moved" is not "the pins cover it".
      //
      // ► **NOT EVERY BLOW, and the prose here used to say otherwise.** The
      //   displacement is gated TWICE — by the band, and by
      //   `randosmash > 3 || direction == 30` (`+0x1ac8`-`+0x1ae4`) — so about
      //   one eligible blow in four displaces. It is unconditional only with
      //   respect to the `|force| > 80` ANIMATION gate, which is a different
      //   sentence. `mutation.knockback.force` is `null` on the arm that drew
      //   and lost, which is why the finite test below is the gate.
      //
      //   The sign is the DEFENDER's facing (`+0x1ae9`), not the actor's — the
      //   opposite of the taunt's shove, which signs on the attacker's — and
      //   it arrives already signed on `mutation.knockback.force`.
      if (Number.isFinite(mutation.knockback?.force) && Number.isFinite(target.x)) {
        const struckTo = clamp(
          target.x + mutation.knockback.force,
          SS2_ARENA.clamp.min,
          SS2_ARENA.clamp.max
        );
        if (struckTo !== target.x) {
          effects.push({ kind: EffectKind.POSITION, targetId: target.id, to: struckTo });
          effects.push(...facingAfterTargetMove({ ...target, x: struckTo }));
        }
      }

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
        staminaSpent: killedAfterBonus ? 0 : staminaCost,
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
      //     NEVER RUNS.** The `+0x6738` write-back is SYNCHRONOUS, ~~inside
      //     `checkattackroll`~~ **in the phase arm itself, in the same tick,
      //     after `checkattackroll()` has returned** (the left-facing call is the
      //     `CallFunction` at `+0x6730` and its `Pop` at `+0x6731`; the write
      //     starts at `+0x6732` — corrected 2026-09-22; the conclusion is
      //     unchanged, the location was wrong); the `+0x6761` increment is gated on
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
        const landed = SS2_PSYCHE_UP.floor + (killedAfterBonus ? 0 : 1);
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
      // ► **THE ITEM STRIKES' OWN HALF, merged onto the dispatcher's result the
      //   way the discharge's is directly above.**
      if (itemStrike !== null) {
        // The slot FIRST: the chooser empties it before the phase runs.
        effects.unshift(...itemStrike.consumption);
        // ► **THE WHIRLWIND'S WRITE-BACK, `game_attacker.psyche_up = 1` at
        //   `+0x7a64`, AND IT SURVIVES A KILL.** It is in the entry block after
        //   both gate tests, in the cast's own tick — so unlike the discharge's
        //   `+0x6761` increment it does not wait for a callback that `death()`
        //   deletes, and it has no increment at all: a whirlwind leaves 1 where
        //   a discharge leaves 2. Emitted here rather than left to `nextphase`'s
        //   reset because a kill skips the reset and not this.
        if (request.type === Ss2ActionType.CAST_WHIRLWIND
          && declaredResourceNames(actor).has("psyche_up")
          && resourceValue(actor, "psyche_up", SS2_PSYCHE_UP.floor) !== SS2_PSYCHE_UP.floor) {
          effects.push({ kind: EffectKind.RESOURCE, targetId: actor.id, resource: "psyche_up", to: SS2_PSYCHE_UP.floor });
        }
        // ► **THE GHOST STRIKE'S CASTER STAYS BESIDE A BODY IT KILLED.** The
        //   arm puts it at `defender._x -/+ game_attacker.physical_size` by its
        //   facing (`+0x7e4c`-`+0x7eac`) and restores `attacker_old_x` only in
        //   the completion tick (`+0x7f9f`), which `death()` deletes. On a strike
        //   that does not kill, the blink out and back is presentation and no
        //   position is written.
        //
        //   **INVENTED AT THE EDGES, NAMED:** the arena clamp is applied (the
        //   rule every `x` this file writes keeps, although after `death()` no
        //   clip clamp runs in the build), and facing is recomputed from the new
        //   `x` (the teleport's rule; in the build no phase advance follows a
        //   kill, and in 1v1 the bout is over).
        //
        //   The landing is `ghostLanding`, the SAME number the back-attack bonus
        //   was judged from, so the side the killer is recorded on is the side
        //   the bonus was granted from.
        let casterMove = null;
        if (killedAfterBonus && ghostLanding !== null) {
          const to = clamp(ghostLanding, SS2_ARENA.clamp.min, SS2_ARENA.clamp.max);
          casterMove = { from: actor.x, to };
          if (to !== actor.x) {
            effects.push({ kind: EffectKind.POSITION, targetId: actor.id, to });
            effects.push(...facingAfter({ ...actor, x: to }));
          }
        }
        for (const event of events) {
          if (event.type !== request.type) continue;
          event.vanillaLabel = VANILLA_PHASE_LABEL[request.type];
          event.spellId = band.itemId;
          event.consumedSlot = itemStrike.slot;
          if (request.type === Ss2ActionType.CAST_WHIRLWIND) {
            // ► **BOTH CLIPS ON THE EVENT, because the direction cannot name
            //   the caster's.** Direction 30 is the discharge's and the
            //   whirlwind's alike, so `attackLabel(30)` refuses to name a clip;
            //   the caster plays `psyche_up3` (`+0x7950`) and the victim what
            //   direction 30's dispatcher sends it to. The discharge carries
            //   the same pair through its own `clip` field.
            event.casterClip = SS2_WHIRLWIND.casterClip;
            event.victimClip = event.hit ? SS2_WHIRLWIND.victimClipOnHit : SS2_WHIRLWIND.victimClipOnMiss;
            event.outOfRange = false;
          }
          // ► **NO `casterClip` ON THE GHOST STRIKE, deliberately**: its caster
          //   plays the `Attack9`-`Attack12` its direction names, which
          //   `SS2_STATIC_MAP_BINDINGS` already derives for `power_attack`, and
          //   the victim the ordinary hurt / defend clip. The kill's move is
          //   `casterFrom`/`casterTo` — NOT `from`/`to`, which the presentation
          //   reads as a walk.
          if (casterMove !== null) {
            event.casterFrom = casterMove.from;
            event.casterTo = casterMove.to;
          }
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
     * Deterministic AI. ~~ONE of its decisions is the build's; the rest is not.~~
     *
     * ~~MAP-DERIVED, and it is the only part that is: `villainChooseAction`
     * `+0x03e8` gates the entire action-choice block on `staminaleft > 10`,
     * unconditionally. Below that, this AI rests.~~
     *
     * **CORRECTED 2026-09-22, and both halves of that sentence were wrong.**
     * The gate is NOT unconditional and does NOT gate the entire block: it sits
     * INSIDE the in-range test (`+0x03d5`, whose failure jumps to the
     * out-of-range bands at `+0x08c3`), so only a villain IN RANGE at 10 or
     * less is sent to `rest` (`+0x08b6`). And the rest is not the villain's
     * last word: the function's unconditional last statement is
     * `villain_cast_spells()` (`+0x1432`; 122 branches, none backward, none
     * past it), which never reads the decision and can replace it. So the
     * MAP-DERIVED part is now: the ladder arms this engine holds (potions,
     * regenerate, the five damage spells, weaken, boundless energy, the gale,
     * the teleport), consulted BEFORE the tired rest, and the tired rest
     * applied only in range. Map §"The spell ladder runs LAST, and overrides
     * the rest and the status phases" and the `villainChooseAction` `+0x03e8`
     * row of the `staminacost` table. Everything below the ladder is still
     * this module's own.
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
      //
      // ► **STILL FIRST, AND THAT IS A LEGALITY QUESTION RATHER THAN AN AI ONE
      //   (2026-09-22).** In the build the ladder runs AFTER the four status
      //   blocks (`+0x133a`-`+0x1431`) and can replace a status too: a frozen,
      //   burning, poisoned or life-stolen villain holding a qualifying item
      //   CASTS, and the status phase is lost, its flag already cleared (map
      //   §"The spell ladder runs LAST, and overrides the rest and the status
      //   phases"). Here `legalActions` forces the status phase for every
      //   combatant, so it is the only option this AI is handed; reproducing the
      //   villain's override means changing that offer, which is the owner's
      //   decision and is recorded in the handoff, not taken here. The tired
      //   rest below WAS reordered — that one is an AI fix.
      const forced = options.find((option) => SS2_FORCED_PHASES.has(option.type));
      if (forced) return forced;

      // ► **A FORCED SWAP IS NOT A CHOICE EITHER, and it is returned beside the
      //   forced phase for the same reason.** An archer out of arrows is handed
      //   exactly one option by `legalActions`; weighing it would build the
      //   attacker record and demand a damage pair the gladiator may not have
      //   declared, throwing instead of taking the only move it has.
      if (options.length === 1 && options[0].type === Ss2ActionType.SWAP_WEAPONS) return options[0];

      // ► **AND NEITHER IS A FORCED REST.** At `staminaleft <= 0` `legalActions`
      //   hands over exactly one option, `rest` (overlay frame 1 `+0x0d2e`).
      //   ~~The tired gate below caught this case on its way past~~ — it did
      //   until 2026-09-22, when the tired rest moved below the ladder and
      //   learned to read the range; an out-of-range gladiator at zero would
      //   otherwise fall through to the swing table and throw for want of a
      //   damage pair, for the reason the two arms above give.
      if (options.length === 1 && options[0].type === Ss2ActionType.REST) return options[0];

      const restOption = options.find((option) => option.type === Ss2ActionType.REST);
      const actor = view.actor;
      // ~~`if (restOption && resourceValue(actor, "staminaleft", 0) <= 10) return restOption;`~~
      // **MOVED 2026-09-22, and narrowed.** This line returned the rest before
      // any ladder arm was read, for every gladiator in or out of range. The
      // build does neither: the `staminaleft > 10` gate (`+0x03e8`) is inside
      // the in-range test, and `villain_cast_spells()` runs after it and can
      // replace the rest. The tired rest is now the last arm before the swing
      // table, below every ladder block — see "THE TIRED REST" there.

      // ► **LADDER ARM 1, `cast_rejuvinate`, AND IT IS FIRST OF ALL TWENTY-EIGHT.**
      //   `check_inventory(43) && villain.hitpoints < villain.hitpointsmax / 1.5`
      //   (`+0x0593`-`+0x0607`: `Push 1.5; Divide; Less2` at `+0x05d9`-`+0x05e6`
      //   — strict, unrounded). Only the 90% roll (`+0x056f`) stands before it,
      //   so it PRE-EMPTS EVERY BLOCK BELOW: `hitpoints < hitpointsmax / 2` (arms
      //   2-6, 26) implies it, and the possession-only arms (7, 14-18, 23) and
      //   every distance arm come after it. So a caster below the line that
      //   holds 43 casts it before any health vial, regenerate or molten death,
      //   in the build and here. Every later block's "what pre-empts it" list
      //   gains arm 1 by this block's position.
      //
      // ► **IT ASKS ONLY ABOUT HEALTH**: no armour, stamina or piece test — a
      //   caster below the line with every piece still on spends it. Kept.
      //
      // ► **OMITTED, NAMED:** the 90% roll at `+0x056f`, as everywhere here.
      const rejuvenateOption = options.find((option) => option.type === Ss2ActionType.CAST_REJUVINATE);
      if (rejuvenateOption && actor.health < actor.maxHealth / SS2_REJUVENATE.aiHealthDivisor) {
        return rejuvenateOption;
      }

      // ► **LADDER ARM 3, `cast_regenerate`, AND IT SITS AMONG THE POTIONS.**
      //   `check_inventory(46) && villain.hitpoints < villain.hitpointsmax / 2`
      //   (`+0x0681`-`+0x06f1`, `Push 2; Divide; Less2` — strict, unrounded):
      //   after arm 2 (the id-5 potion, the SAME test) and before arms 4-6 (the
      //   4, 3 and 2 potions, the same test again). So a villain below half who
      //   carries 5 drinks it, and one who carries only 4, 3 or 2 regenerates
      //   first. The potion arms that precede arm 3 are taken from
      //   `SS2_POTION_LADDER` rather than restated; ~~arm 1 (`cast_rejuvinate`)
      //   has no verb here and pre-empts nothing~~ arm 1 (`cast_rejuvinate`) has
      //   had a verb since 2026-09-22 and returns in the block above this one.
      //
      // ► **IT NEVER ASKS WHETHER THE BUFF IS ALREADY RUNNING — nor does the
      //   build**, so a villain holding two 46s recasts on the next turn it is
      //   still below half, and resets the counter to 20. Reproduced.
      //
      // ► **OMITTED, AND NAMED, AS FOR THE POTIONS:** the single
      //   `randomBetween(1, 100) > 10` at `+0x056f` (this AI takes no samples,
      //   so it casts on every turn the gate is open rather than nine in ten)~~,
      //   and the forced rest above, which sits in front of the ladder here —
      //   the open question the potion block records~~. **The question is
      //   settled and the rest no longer sits in front (2026-09-22)**: the
      //   ladder replaces a tired villain's rest, so this block now runs at any
      //   stamina above the zero-stamina floor.
      const regenerateOption = options.find((option) => option.type === Ss2ActionType.CAST_REGENERATE);
      if (regenerateOption && actor.health < actor.maxHealth / 2) {
        const pools = ss2PoolsOf(actor);
        for (const { arm, itemId } of SS2_POTION_LADDER) {
          if (arm > SS2_TIMED_BUFFS[Ss2ActionType.CAST_REGENERATE].ladderArm) break;
          const drink = options.find((option) => option.type === Ss2ActionType.DRINK_POTION && option.itemId === itemId);
          const { stat } = SS2_POTIONS[itemId];
          if (drink && pools[stat] < pools[SS2_POOL_CEILING[stat]] / 2) return drink;
        }
        return regenerateOption;
      }

      // ► **LADDER ARMS 8 AND 9, COLOSSUS AND LITTLE FAT KID — the build's own
      //   rules, `check_inventory(42) && fightdistance < 300` (`+0x0890`-
      //   `+0x08c4`) and `check_inventory(33) && fightdistance < 500`
      //   (`+0x08ea`-`+0x091e`), strict.** See `ss2StatSpellChoice`.
      //
      // ► **THEIR OWN BLOCK, SHAPED LIKE ARM 3's ABOVE**: they precede the
      //   armour and stamina potions (arms 10-13) and are preceded by the health
      //   potions (arms 2, 4-6) and molten death (arm 7, possession alone). So
      //   the health arms that precede are taken from `SS2_POTION_LADDER` here,
      //   molten death next, and only then the stat spell — and returning here,
      //   ABOVE the drink walk below, is what puts both ahead of arms 10-13.
      //   Arm 8 before arm 9: below 300 a villain holding both grows.
      //
      // ► **AND THEY SHUT EVERYTHING BELOW THEM THAT THEIR GATES COVER**: arm 9's
      //   `< 500` covers bloodlust's `< 400` (arm 22) and the teleport's `< 250`
      //   (arm 26), so a villain holding 33 never reaches either while a foe
      //   stands inside 500; arm 8's `< 300` does the same to the teleport.
      //
      // ► **OMITTED, NAMED:** the 90% roll at `+0x056f`, as everywhere here.
      {
        const statSpell = ss2StatSpellChoice(view, options, Ss2ActionType.CAST_COLOSSUS)
          ?? ss2StatSpellChoice(view, options, Ss2ActionType.CAST_LITTLE_FAT_KID);
        if (statSpell) {
          const arm = SS2_STAT_SPELLS[statSpell.type].ladderArm;
          const pools = ss2PoolsOf(actor);
          for (const { arm: potionArm, itemId } of SS2_POTION_LADDER) {
            if (potionArm > arm) break;
            const drink = options.find((option) => option.type === Ss2ActionType.DRINK_POTION && option.itemId === itemId);
            const { stat } = SS2_POTIONS[itemId];
            if (drink && pools[stat] < pools[SS2_POOL_CEILING[stat]] / 2) return drink;
          }
          return ss2DeathFromAboveChoice(view, options) ?? statSpell;
        }
      }

      // ► **THE POTIONS ARE THE BUILD'S OWN RULE, AND THEY COME FIRST OF
      //   EVERYTHING `villain_cast_spells` DECIDES.** Ladder arms 2, 4-6 and
      //   10-13 each drink when the id is carried AND the pool it restores is
      //   strictly below half its ceiling — see `SS2_POTION_LADDER` for the
      //   offsets and the order (health 5>4>3>2, armour 9>8, stamina 7>6).
      //   Every one precedes the bolt arms (15, 17) and the gale (24), so this
      //   returns BEFORE the gale block and before the bolts are priced: a
      //   villain that qualifies for a potion drinks rather than casting.
      //
      // ► **RETURNED BEFORE THE WALK AND THE SWING TOO**, for the gale's reason:
      //   `villainChooseAction` ends by calling `villain_cast_spells()`, which
      //   REPLACES the decision it had already made. **`attackOnOffer` is
      //   deliberately NOT widened** — a drink is not a verb offered on
      //   `ss2Reach`, and the psyche range gate below depends on that
      //   predicate meaning exactly that. The bolts broke it once.
      //
      // ► **RECOGNISED BY THE VOCABULARY**, like every other arm here: the
      //   option list already applied possession and the slot window, so this
      //   reads only the pools.
      //
      // ► **WHAT IS OMITTED, NAMED:**
      //   - the build's single `randomBetween(1, 100) > 10` at `+0x056f`. This
      //     AI takes no samples, so it drinks on every turn a condition holds
      //     rather than on nine in ten, and a failed roll's fall-through to the
      //     melee decision is not reproduced;
      //   - the arms with no verb here (~~1 `cast_rejuvinate`,~~ ~~3
      //     `cast_regenerate`,~~ ~~7 `cast_death_from_above`,~~ ~~8 `cast_colossus`, 9
      //     `cast_little_fat_kid`~~; arm 3 has had a verb since 2026-09-22 and is
      //     tested in the block just above, and arm 7 since the same day and is
      //     tested inside this walk, below; arm 1 too, tested above arm 3;
      //     **arms 8 and 9 too, the same day, in their own block above this
      //     walk, which is where they pre-empt arms 10-13**), which pre-empt some potions in the build and
      //     nothing here — the stance the gale block takes for arms 1-23;
      //   - ~~**AND IT SITS BEHIND THE FORCED REST ABOVE, WHICH IS AN OPEN
      //     QUESTION, NOT A DERIVATION.** `staminaleft > 10` (`+0x03e8`) gates
      //     `villainChooseAction`'s action-choice block, and the map records
      //     that the function "ends by calling `villain_cast_spells()`" without
      //     saying whether that call is inside the gated block. If it is not, a
      //     villain at 10 stamina or less drinks a stamina vial (always below
      //     half, since the build derives `staminamax = 100 + stamina * 10`)
      //     where this AI rests. The gale and the bolts sit behind the same
      //     gate and carry the same question.~~
      //     **SETTLED 2026-09-22: IT IS NOT INSIDE, AND THE REST NOW SITS
      //     BEHIND THIS BLOCK.** The call is the decision function's
      //     unconditional last statement (`+0x1432`), and the `> 10` gate is
      //     itself inside the in-range test (`+0x03d5`). So a tired villain in
      //     range drinks the vial, exactly as the paragraph above predicted
      //     for that case; the gale, the bolts and every other ladder arm
      //     below replace the rest the same way (map §"The spell ladder runs
      //     LAST"; `test/ss2-ai-tired-rest.test.js`).
      //
      // ► **INVENTED: THE RULE IS APPLIED TO EVERY AI SEAT.** The ladder reads
      //   `_root.game.villain` hard-coded; this engine has one AI for everyone,
      //   as it does for the gale.
      //
      // ► **LADDER ARM 7, `cast_death_from_above`, SITS INSIDE THIS WALK, and
      //   it is the first damage spell of the six.** `check_inventory(49)` and
      //   NOTHING else (`+0x0855`-`+0x088b`: `Equals2; Not; If`, no second
      //   conjunct). So it comes after the health arms (2, 4-6; arm 3 returned
      //   above) and PRE-EMPTS the armour and stamina arms (10-13), which is
      //   why it is tested at the first ladder entry past arm 7 rather than in
      //   a block of its own — and it returns before every block below:
      //   the damage spells (14-18, which this AI otherwise PRICES), weaken
      //   (19), boundless energy (23), the gale (24), the teleport (26), the
      //   walk, the swing and the tired rest. A villain holding 49 casts
      //   nothing else from `villain_cast_spells` until it is spent.
      //
      //   **NOT PRICED, unlike arms 14-18.** The bolts and fireballs are
      //   ranked against the swings (an invented comparison the build never
      //   makes, recorded below); arm 7 is cast on possession, as the build
      //   casts it, because pricing it would let a swing into the gap the
      //   ladder closes — and it could not reach the potions it must pre-empt.
      //
      // ► **INVENTED: WHICH FOE.** The build has one `defender`. Above 1v1 this
      //   drops the shower on the most wounded foe (`byHealthThenId`, the
      //   order `target` below is chosen by); it cannot miss and has no range.
      const moltenDeath = ss2DeathFromAboveChoice(view, options);
      const drinkOptions = options.filter((option) => option.type === Ss2ActionType.DRINK_POTION);
      if (drinkOptions.length > 0 || moltenDeath) {
        const pools = ss2PoolsOf(actor);
        for (const { arm, itemId } of SS2_POTION_LADDER) {
          if (moltenDeath && arm > SS2_DEATH_FROM_ABOVE.ladderArm) return moltenDeath;
          const option = drinkOptions.find((entry) => entry.itemId === itemId);
          if (!option) continue;
          const { stat } = SS2_POTIONS[itemId];
          if (pools[stat] < pools[SS2_POOL_CEILING[stat]] / 2) return option;
        }
        // UNREACHABLE while the table holds an arm past 7 (arms 10-13 return
        // above), so no mutation of it can go red; kept so that a table
        // without one still casts rather than falling through to a swing.
        if (moltenDeath) return moltenDeath;
      }

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
      // ► **A BOLT COUNTS AS AN ATTACK HERE, AND LEAVING IT OUT WAS A REAL
      //   DEFECT — found by a Codex adversarial review of this diff, 2026-09-20,
      //   and reproduced before it was believed.** `ATTACK_BANDS` deliberately
      //   does not hold the bolts (a band entry means "draw a direction, then
      //   roll"), so an AI caster read as having nothing on offer: **seed 3,
      //   `inventory1: 35`, a 170-HP unarmoured foe whose death a 200-400 bolt
      //   guarantees — `suggestAction` chose `quick-attack` at distance 120 and
      //   `walk-right` at distance 1960.** The capability was legal and
      //   unreachable.
      //
      //   **It is not a neutral omission the way `shove`'s is.** The build's
      //   villain genuinely casts: `villain_cast_spells` IS the villain AI, and
      //   for these two arms it casts on possession alone — a single 90% roll
      //   at the top of the function and then a fixed-order ladder in which
      //   both bolts are unconditional. An SS2-derived AI that never casts
      //   departs from the build rather than merely declining to model it.
      //
      //   Recognised by the VOCABULARY, like every other arm here: a bolt on
      //   offer means the caster has something to do from where it stands, so
      //   it must not walk. The bolt arm has NO distance test in the build
      //   either, so this needs no geometry.
      //
      // ► **AND THE FIREBALLS COUNT, through this same door (2026-09-22).**
      //   Ladder arms 14, 16 and 18 are as unconditional as the bolts' 15 and
      //   17, and the fireball arm has no distance test either, so a fireball
      //   on offer means exactly what a bolt on offer means. The name is kept
      //   so the psyche and gale comments below that cite it still read true;
      //   what it now means is "a DAMAGE SPELL is on offer".
      const boltOnOffer = options.some((option) => ss2DamageSpell(option.type));
      const attackOnOffer = options.some((option) => ATTACK_BANDS[option.type]) || boltOnOffer;

      // ► **WEAKEN ARMOUR IS THE BUILD'S OWN RULE, for the gale's reason: it
      //   deals no damage, so it has no row in the pricing table below.** Ladder
      //   arm 19 of `villain_cast_spells` (`+0x0c3f`-`+0x0c94`):
      //
      //     check_inventory(44)                                     +0x0c3f
      //     && _root.arena.fightdistance < 300                      +0x0c5d-+0x0c75
      //
      //   Strict, and NOTHING ELSE — no armour test on the caster or the
      //   victim, so this AI spends the item on an unarmoured foe exactly as
      //   the build's villain does. Returned before the walk and the swing,
      //   because `villain_cast_spells` replaces the decision; **`attackOnOffer`
      //   is NOT widened**, for the reason the gale gives.
      //
      // ► **THE LADDER'S PRE-EMPTION, AS FAR AS IT REACHES THIS ENGINE.** Arms
      //   1-18 must all fail first. The potion arms (2, 4-6, 10-13) returned
      //   above. The five damage spells (arms 14-18) fire on possession alone,
      //   so a caster offered any of them never reaches arm 19 — even on a turn
      //   this engine's pricing then spends on a swing — which is what
      //   `!boltOnOffer` says. `regenerate` (arm 3) got its verb the same day
      //   and returns above (merged from a parallel worktree). **So does molten
      //   death (arm 7, possession alone), inside the drink walk.** The rest of
      //   1-18 (~~`rejuvinate`,~~ ~~death from above,~~ ~~colossus, little fat kid~~)
      //   have no verb here and so pre-empt nothing (rejuvenate, arm 1, returns
      //   first of all since 2026-09-22); when they are built, this
      //   block must grow. **Colossus and little fat kid (arms 8, 9) got theirs
      //   2026-09-22 and return in their own block above the drink walk — and
      //   both gates cover this one's `< 300`, so a caster holding 42 or 33
      //   never weakens while a foe stands inside 300.** And it
      //   sits ABOVE the gale (arm 24) and the teleport (arm 26), so a caster
      //   qualifying for either weakens first.
      //
      // ► **WHAT IS OMITTED, NAMED:** the build's single `randomBetween(1, 100)
      //   > 10` at `+0x056f`. This AI takes no samples, so it casts on every
      //   turn the gate is open rather than on nine in ten.
      //
      // ► **INVENTED: WHICH FOE.** The build has one `defender`. Above 1v1 this
      //   weakens the NEAREST foe, the one the distance gate is about — the
      //   gale's and the teleport's choice. At 1v1 it is the build's defender.
      if (!boltOnOffer) {
        const weakened = nearestFoe(view);
        const weakenOption = weakened
          ? options.find((option) => option.type === Ss2ActionType.CAST_WEAKEN_ARMOUR && option.targetId === weakened.id)
          : undefined;
        if (weakenOption) {
          const range = ss2FightDistance(actor, weakened);
          // `range` cannot be null — `nearestFoe` skips a foe whose distance
          // is null — and is guarded for the reason the gale's is.
          if (range !== null && range < SS2_WEAKEN_ARMOUR.aiFightDistanceBelow) return weakenOption;
        }
      }

      // ► **LADDER ARMS 20 AND 21, THE WHIRLWIND AND THE GHOST STRIKE — the
      //   build's own rules, returned before the pricing table for the gale's
      //   reason: `villain_cast_spells` replaces the decision.**
      //
      //     arm 20  check_inventory(37) && fightdistance < 200
      //             && villain.equipped_weapon != 2                 +0x0c99-+0x0cf5
      //     arm 21  check_inventory(36) && fightdistance > 500
      //             && villain.equipped_weapon != 2                 +0x0d19-+0x0d75
      //
      //   Both distance tests strict (`Less2`, `Greater`). `equipped_weapon`
      //   is `ss2InBowMode`. **The whirlwind arm does NOT ask whether the
      //   discharge gate will pass** — under 200 with bare hands the gate is
      //   `reach + 50`, which can be less — so this AI, like the build's
      //   villain, can spend 37 on a whirlwind that reaches nobody. Kept.
      //
      // ► **WHAT PRE-EMPTS THEM, AS FAR AS THIS ENGINE HOLDS IT:** arm 3 and
      //   the potion arms returned above; the five damage spells (14-18) fire
      //   on possession, which `!boltOnOffer` says; arm 19, weaken armour, is
      //   the block directly above. ~~Arms 1 and 7-9 have no verb here and so
      //   pre-empt nothing.~~ **Arm 1 (rejuvenate) returns first of all since
      //   2026-09-22; arm 7 (molten death) returns inside the drink walk, and
      //   arms 8 and 9 (colossus `< 300`, little fat kid `< 500`, 2026-09-22) in
      //   their own block above it — both gates cover the whirlwind's `< 200`,
      //   and little fat kid's is disjoint from the ghost strike's `> 500`.**
      //   And these two pre-empt arms 22-26 — bloodlust (22), boundless energy
      //   (23), the gale (24) and the teleport (26) are all below.
      //
      // ► **OMITTED, NAMED:** the 90% roll at `+0x056f`, as everywhere here.
      //
      // ► **INVENTED: WHICH FOE.** The NEAREST, the one the distance gate is
      //   about — the weaken's, the gale's and the teleport's choice. For the
      //   ghost strike that means every foe is beyond 500 when it fires.
      if (!boltOnOffer && !ss2InBowMode(actor)) {
        const strikeFoe = nearestFoe(view);
        const range = strikeFoe ? ss2FightDistance(actor, strikeFoe) : null;
        if (range !== null) {
          const whirlwindOption = options.find((option) =>
            option.type === Ss2ActionType.CAST_WHIRLWIND && option.targetId === strikeFoe.id);
          if (whirlwindOption && range < SS2_WHIRLWIND.aiFightDistanceBelow) return whirlwindOption;
          const ghostOption = options.find((option) =>
            option.type === Ss2ActionType.CAST_GHOST_STRIKE && option.targetId === strikeFoe.id);
          if (ghostOption && range > SS2_GHOST_STRIKE.aiFightDistanceAbove) return ghostOption;
        }
      }

      // ► **LADDER ARM 22, BLOODLUST — `check_inventory(41) && fightdistance <
      //   400` (`+0x0d99`-`+0x0dcd`), strict, and nothing else.** Returned before
      //   the walk and the swing, because `villain_cast_spells` replaces the
      //   decision; see `ss2StatSpellChoice`.
      //
      // ► **WHAT PRE-EMPTS IT, AS FAR AS THIS ENGINE HOLDS IT — all of arms
      //   1-21 that have a verb, and they have all returned above:** regenerate
      //   (3), the potions (2, 4-6, 10-13), molten death (7), colossus and
      //   little fat kid (8, 9 — and 9's `< 500` covers this whole gate, so a
      //   villain holding 33 never casts bloodlust), the five damage spells
      //   (14-18, possession alone: `!boltOnOffer`), weaken (19), whirlwind (20)
      //   and ghost strike (21, `> 500`, disjoint). Arm 1 (`rejuvinate`) has no
      //   verb here. **And it pre-empts boundless energy (23)**, which is
      //   possession alone, so it sits directly above that block.
      //
      // ► **OMITTED, NAMED:** the 90% roll at `+0x056f`, as everywhere here.
      if (!boltOnOffer) {
        const bloodlust = ss2StatSpellChoice(view, options, Ss2ActionType.CAST_BLOODLUST);
        if (bloodlust) return bloodlust;
      }

      // ► **LADDER ARM 23, `cast_boundless_energy`, ON POSSESSION ALONE** —
      //   `check_inventory(45)` and nothing else (`+0x0df3`-`+0x0e29`; the only
      //   test before its `If` is the `Equals2` against `true`). So it fires
      //   whatever the stamina, and REPLACES a swing in reach or a step out of
      //   it, for the gale's reason: `villain_cast_spells` replaces the decision.
      //
      // ► **WHAT PRE-EMPTS IT, AS FAR AS THIS ENGINE HOLDS IT.** Arms 1-22 must
      //   fail first. Of those with a verb here: arm 3 (regenerate) and the
      //   potion arms 2, 4-6 and 10-13 have already returned above; the damage
      //   spells, arms 14-18, fire on possession alone, so a caster offered one
      //   never reaches arm 23 — `boltOnOffer`, the gale's own test. **Arm 19,
      //   `cast_weaken_armour` (`check_inventory(44) && fightdistance < 300`),
      //   precedes it too, and is tested in the block directly ABOVE this one**
      //   (the two verbs were built in parallel worktrees and merged in ladder
      //   order on 2026-09-22). **Arm 7, molten death, returned above too**
      //   (possession alone, inside the drink walk). **Arms 20 and 21,
      //   whirlwind and ghost strike, got verbs the same day and are tested
      //   above this block** (merged from a parallel worktree). ~~Arms 8-9 and
      //   22 (colossus, little fat kid, bloodlust) have none and pre-empt
      //   nothing here, where the build would.~~ **Arms 8, 9 and 22 got verbs
      //   2026-09-22 and return above: 8 and 9 above the drink walk, 22 in the
      //   block directly above this one.**
      //
      // ► **AND IT PRE-EMPTS THE GALE (24) AND THE TELEPORT (26)**, which is
      //   why it sits here, above both.
      //
      // ► **IT NEVER ASKS WHETHER THE BUFF IS RUNNING**, as for arm 3: a villain
      //   holding two 45s casts them on consecutive turns and the second resets
      //   the counter. The 90% roll at `+0x056f` is omitted, as everywhere here.
      if (!boltOnOffer) {
        const boundlessOption = options.find((option) => option.type === Ss2ActionType.CAST_BOUNDLESS_ENERGY);
        if (boundlessOption) return boundlessOption;
      }

      // ► **THE GALE IS THE BUILD'S OWN RULE, NOT A PRICE, because it deals no
      //   damage and so has no row in the table below.** Ladder arm 24 of
      //   `villain_cast_spells` (`+0x0e2e`-`+0x0ebd`) casts when three things
      //   hold, and they are the three read here:
      //
      //     check_inventory(38)                                     +0x0e2e
      //     && _root.arena.fightdistance < 400                      +0x0e4c-+0x0e62
      //     && villain.armourclass < villain.armourclass_max / 2    +0x0e6b-+0x0e9c
      //
      //   `fightdistance` is the build's pair distance, which `ss2FightDistance`
      //   already is. An unarmoured gladiator never passes the third (`0 < 0`),
      //   which is the build's answer and is kept.
      //
      // ► **RETURNED BEFORE THE WALK AND THE SWING, because the build does
      //   that too.** `villainChooseAction` ENDS by calling
      //   `villain_cast_spells()`, which REPLACES the decision it had already
      //   made (map `:2606`, `:2735`). So a gale whose gate is open beats a swing
      //   in reach and a step out of it alike. **`attackOnOffer` is deliberately
      //   NOT widened**: the psyche range gate below depends on it meaning "a
      //   verb offered on `ss2Reach`", and the bolts already broke that once.
      //
      // ► **THE LADDER'S PRE-EMPTION, AS FAR AS IT REACHES THIS ENGINE.** Arms
      //   1-23 must all fail first. Of those, only the two bolts have verbs here
      //   (arms 15 and 17), and both fire on possession alone — so a caster
      //   offered a bolt never reaches the gale, even on a turn this engine's
      //   pricing then spends on a swing instead. ~~The other 21 arms (potions,
      //   `rejuvinate`, the fireballs, boundless energy, ...) have no verb and so
      //   cannot pre-empt anything; when they are built, this test must grow.~~
      //   **THE EIGHT POTION ARMS (2, 4-6, 10-13) HAVE A VERB SINCE 2026-09-22
      //   AND PRE-EMPT THIS BLOCK FROM ABOVE IT** — the drink rule returns
      //   before this line, so a caster that qualifies for a potion never gets
      //   here (`test/ss2-drink-potion.test.js`, "armour oil PRE-EMPTS the
      //   gale"). The other 13 (~~`rejuvinate`,~~ ~~the fireballs,~~ boundless
      //   energy, ...) still have no verb and so cannot pre-empt anything; when
      //   they are built, this test must grow. **It grew for the fireballs the
      //   same day (arms 14, 16, 18)**, which `boltOnOffer` now covers, so a
      //   caster offered any of the five damage spells never reaches the gale
      //   (merged from a parallel worktree; the three verbs were built at once).
      //   **And for boundless energy (arm 23, possession alone) and regenerate
      //   (arm 3) on 2026-09-22**: both return in blocks ABOVE this one, so a
      //   caster carrying 45 never reaches the gale, and neither does one below
      //   half health carrying 46 (`test/ss2-timed-buffs.test.js`). **And for
      //   colossus, little fat kid and bloodlust (arms 8, 9, 22) the same day**:
      //   all three return above, and little fat kid's `< 500` and bloodlust's
      //   `< 400` cover the gale's whole `< 400`, so a caster holding 33 or 41
      //   never gales (`test/ss2-stat-spells.test.js`).
      //
      // ► **WHAT IS OMITTED, NAMED:** the build's single `randomBetween(1, 100)
      //   > 10` at `+0x056f`. This AI takes no samples, so it casts on every
      //   turn the gate is open rather than on nine in ten, and a failed roll's
      //   fall-through to the melee decision is not reproduced.
      //
      // ► **INVENTED: WHICH FOE.** The build has one `defender`. Above 1v1 this
      //   gales the NEAREST foe, which is the one the distance gate is about and
      //   the one facing already points at — so the push carries it away from
      //   the caster. At 1v1 it is the build's defender exactly.
      if (!boltOnOffer) {
        const galed = nearestFoe(view);
        const galeOption = galed
          ? options.find((option) => option.type === Ss2ActionType.CAST_GALE && option.targetId === galed.id)
          : undefined;
        if (galeOption) {
          const range = ss2FightDistance(actor, galed);
          const armourBelowHalf = resourceValue(actor, "armourclass", 0)
            < resourceValue(actor, "armourclass_max", 0) / 2;
          // `range` is null when either side models no position, and
          // `null < 400` is TRUE in JS. **Unreachable today** — `nearestFoe`
          // already skips a foe whose distance is null — and kept because that
          // is a construction in another function, and the psyche gate below
          // is what a guard justified by someone else's construction costs
          // when the construction changes. No mutation of it can go red.
          if (range !== null && range < SS2_GALE.aiFightDistanceBelow && armourBelowHalf) return galeOption;
        }
      }

      // ► **THE COMMAND IS THE BUILD'S OWN RULE, for the gale's reason: it
      //   deals no damage, so it has no row in the pricing table below.** Ladder
      //   arm 25 of `villain_cast_spells` (`+0x0ec2`-`+0x0f17`):
      //
      //     check_inventory(39)                                     +0x0ec2
      //     && _root.arena.fightdistance > 300                      +0x0ee0-+0x0ef6
      //
      //   Strict (`Greater`), and nothing else. Returned before the walk and the
      //   swing, because `villain_cast_spells` replaces the decision — so a
      //   villain holding 39 PULLS a distant foe rather than walking to it.
      //   **`attackOnOffer` is NOT widened**, for the reason the gale gives.
      //
      // ► **THE LADDER'S PRE-EMPTION, AS FAR AS IT REACHES THIS ENGINE.** Arms
      //   1-24 must all fail first. Those with a verb here and a gate that can
      //   be open beyond 300 return in the blocks above: the potions (2, 4-6,
      //   10-13), regenerate (3), the five damage spells (14-18, possession
      //   alone — `!boltOnOffer`), boundless energy (23, possession alone) and
      //   the gale (24, `< 400`, so the two overlap on 301-399 and the gale
      //   wins there when its armour test passes). Weaken (19, `< 300`) is
      //   DISJOINT from this gate on the same distance and never meets it. ~~Arms
      //   7-9 and 20-22 have no verb here and pre-empt nothing, where the build
      //   would (22, bloodlust, `fightdistance < 400`, would own 301-399).~~
      //   **Corrected 2026-09-22 (the stat spells): arms 7, 20 and 21 already
      //   had verbs when that was written, and 8, 9 and 22 have them now — all
      //   return in blocks above.** Of those, the ones whose gate can be open
      //   beyond 300 pre-empt this one: little fat kid (9, `< 500`, owns
      //   301-499), bloodlust (22, `< 400`, owns 301-399), ghost strike (21,
      //   `> 500`) and molten death (7, possession alone). Colossus (8, `< 300`)
      //   and the whirlwind (20, `< 200`) are disjoint from `> 300`. Arm 1
      //   (`rejuvinate`, any distance) has no verb here.
      //
      // ► **AND IT SITS ABOVE THE TELEPORT (26)**, in ladder order — though the
      //   teleport's `< 250` is disjoint from `> 300` on the same distance, so
      //   the order between the two is unobservable.
      //
      // ► **WHAT IS OMITTED, NAMED:** the build's single `randomBetween(1, 100)
      //   > 10` at `+0x056f`. This AI takes no samples, so it commands on every
      //   turn the gate is open rather than on nine in ten.
      //
      // ► **INVENTED: WHICH FOE.** The build has one `defender`. Above 1v1 this
      //   commands the NEAREST foe, the one the distance gate is measured to —
      //   the gale's, weaken's and the teleport's choice — so the gate is shut
      //   while any foe stands inside 300. At 1v1 it is the build's defender.
      if (!boltOnOffer) {
        const commanded = nearestFoe(view);
        const commandOption = commanded
          ? options.find((option) => option.type === Ss2ActionType.CAST_COMMAND && option.targetId === commanded.id)
          : undefined;
        if (commandOption) {
          const range = ss2FightDistance(actor, commanded);
          // `range` cannot be null — `nearestFoe` skips a foe whose distance
          // is null — and is guarded for the reason the gale's is (`null > 300`
          // is false in JS, so the guard is belt to that brace).
          if (range !== null && range > SS2_COMMAND.aiFightDistanceAbove) return commandOption;
        }
      }

      // ► **THE TELEPORT IS THE BUILD'S OWN RULE TOO, for the gale's reason: it
      //   deals no damage, so it has no row in the pricing table below.** Ladder
      //   arm 26 of `villain_cast_spells` (`+0x0f1c`-`+0x0fab`):
      //
      //     check_inventory(48)                                     +0x0f1c
      //     && _root.arena.fightdistance < 250                      +0x0f3a-+0x0f50
      //     && villain.hitpoints < villain.hitpointsmax / 2         +0x0f59-+0x0f8a
      //
      //   Both comparisons strict, and the half UNROUNDED (`Push 2; Divide;
      //   Less2`). `hitpoints`/`hitpointsmax` are `health`/`maxHealth` here, the
      //   mapping `vanillaRecordOf` makes. Returned before the walk and the
      //   swing, because `villain_cast_spells` replaces the decision.
      //   **`attackOnOffer` is NOT widened**, for the reason the gale gives.
      //
      // ► **THE LADDER'S PRE-EMPTION, AS FAR AS IT REACHES THIS ENGINE.** Arms
      //   1-25 must all fail first. Of those, the ones with verbs here are the
      //   two bolts (arms 15, 17 — possession alone, so a caster offered one
      //   never reaches arm 26) and the gale (arm 24 — whose open gate has
      //   already returned above; a caster whose gale gate is SHUT falls through
      //   to here, as the ladder does). **Arm 25, the command, has a verb since
      //   2026-09-22 and returns in the block above; its `> 300` is disjoint
      //   from this block's `< 250`, so it can never pre-empt a teleport whose
      //   gate is open.** **SEVEN arms before 26 fire on
      //   possession alone** (ids 49, 32, 35, 31, 34, 30, 45 — map §"The whole
      //   ladder"); ~~five have no verb here~~ ~~**ONE has no verb here (49)~~
      //   **NONE, since death from above (49) got its verb later the same day
      //   (merged from a parallel worktree), as of
      //   2026-09-22 — the fireballs (32, 31, 30) and boundless energy (45)
      //   gained theirs the same day, and all four shut or pre-empt this block
      //   from above it. So does ARM 3, `cast_regenerate`, whose test is this
      //   block's own `hitpoints < hitpointsmax / 2`: a caster carrying 46 below
      //   half regenerates and never reaches the teleport** (corrected by the
      //   timed-buff implementer). ~~**The potion arms (2, 4-6, 10-13)
      //   also precede this one and are NOT wired here** — arm 2 (id 5) tests
      //   the SAME `hitpoints < hitpointsmax / 2`, so once `drink_potion` has a
      //   verb this test must grow to let it pre-empt.~~ **The potion arms
      //   (2, 4-6, 10-13) PRE-EMPT IT FROM ABOVE since the same day**: the
      //   drink rule returns before the gale block, so a caster that qualifies
      //   for a potion never reaches this line (merged 2026-09-22; the two verbs
      //   were built in parallel). This test must still grow for ~~`rejuvinate`
      //   (arm 1, `hitpoints < hitpointsmax / 1.5`, implied by this gate) and
      //   bloodlust (arm 22, `fightdistance < 400`, implied too)~~. **Rejuvenate
      //   (arm 1, implied by this gate) has a verb since 2026-09-22 and returns
      //   first of all, so a caster holding 43 never reaches this line. Bloodlust
      //   has its verb since the same day and returns above, and so do the two
      //   this sentence also missed — colossus (arm 8, `< 300`) and little fat
      //   kid (arm 9, `< 500`), whose gates this one's `< 250` implies too: a
      //   caster holding 42, 33 or 41 never teleports while it holds them.**
      //
      // ► **WHAT IS OMITTED, NAMED:** the build's single `randomBetween(1, 100)
      //   > 10` at `+0x056f`. This AI takes no samples, so it teleports on every
      //   turn the gate is open rather than on nine in ten.
      //
      // ► **INVENTED: WHICH FOE THE DISTANCE IS MEASURED TO.** The build has one
      //   `defender`. Above 1v1 this reads the NEAREST foe — the one a
      //   teleport escapes, and the one the gale's gate reads. At 1v1 it is the
      //   build's `fightdistance` exactly.
      if (!boltOnOffer) {
        const teleportOption = options.find((option) => option.type === Ss2ActionType.CAST_TELEPORT);
        const threat = teleportOption ? nearestFoe(view) : null;
        if (threat) {
          const range = ss2FightDistance(actor, threat);
          const belowHalfHealth = actor.health < actor.maxHealth / 2;
          // `range` cannot be null here — `nearestFoe` skips a foe whose
          // distance is null — and is guarded for the reason the gale's is.
          if (range !== null && range < SS2_TELEPORT.aiFightDistanceBelow && belowHalfHealth) return teleportOption;
        }
      }

      // ► **LADDER ARM 27, SWIFT SANDALS — `check_inventory(40) &&
      //   fightdistance > 300` (`+0x0fb0`-`+0x0fe4`), strict (`Greater`), and
      //   nothing else.** Returned before the walk, because `villain_cast_spells`
      //   replaces the decision: a villain holding 40 with its foe beyond 300
      //   puts the sandals on rather than walking. See `ss2StatSpellChoice`.
      //
      // ► **WHAT PRE-EMPTS IT, AS FAR AS THIS ENGINE HOLDS IT — every arm above
      //   with a verb and a gate that can be open beyond 300, and they have all
      //   returned above:** the potions and regenerate, molten death (7), little
      //   fat kid (9, 301-499), the damage spells (14-18: `!boltOnOffer`),
      //   ghost strike (21, `> 500`), bloodlust (22, 301-399), boundless energy
      //   (23, possession alone — so a villain holding 45 never gets here), the
      //   gale (24, 301-399 with its armour test), the command (25, the SAME
      //   `> 300`: a villain holding 39 always commands first). Colossus (8),
      //   weaken (19), whirlwind (20) and the teleport (26) are all `< 300` or
      //   less and never meet it. Arm 28, adulation, sits below ~~and has no
      //   verb~~ — it has one since 2026-09-22, in the block just below.
      //
      // ► **OMITTED, NAMED:** the 90% roll at `+0x056f`, as everywhere here.
      if (!boltOnOffer) {
        const swift = ss2StatSpellChoice(view, options, Ss2ActionType.CAST_SWIFTSANDALS);
        if (swift) return swift;
      }

      // ► **LADDER ARM 28, ADULATION — THE LAST ARM: `check_inventory(47) &&
      //   _root.arena.fightdistance > 300` (`DoAction@0x23e7cf` `+0x100a`-
      //   `+0x1040`), strict (`Greater`), and nothing else.** Returned before
      //   the walk, because `villain_cast_spells` replaces the decision: a
      //   villain holding 47 with its foe beyond 300 charms the crowd rather
      //   than closing. See `SS2_ADULATION`.
      //
      // ► **WHAT PRE-EMPTS IT is everything that pre-empts arm 27 above (the
      //   same `> 300`), and arm 27 itself** — a villain holding 40 puts the
      //   sandals on first.
      //
      // ► **INVENTED: WHICH FOE THE DISTANCE IS MEASURED TO** — the nearest,
      //   the teleport's and swift sandals' choice. At 1v1 it is the build's
      //   `fightdistance` exactly.
      //
      // ► **OMITTED, NAMED:** the 90% roll at `+0x056f`, as everywhere here.
      if (!boltOnOffer) {
        const adulationOption = options.find((option) => option.type === Ss2ActionType.CAST_ADULATION);
        const foe = adulationOption ? nearestFoe(view) : null;
        const range = foe ? ss2FightDistance(actor, foe) : null;
        if (range !== null && range > SS2_ADULATION.aiFightDistanceAbove) return adulationOption;
      }

      // ► **`wincrowd` IS NEVER CHOSEN HERE, AND NO LINE OF THIS FUNCTION
      //   RETURNS IT — deliberately, and it is the one controller verb this AI
      //   is offered and does not take (2026-09-23).** Every `return` here, above
      //   and below, finds its own type, and the fallbacks are `rest` or the
      //   first option, which `legalActions` never makes `wincrowd` (it is
      //   appended last but for the swap and the rest).
      //
      //   **The build's villain takes it from a `choices` band** — in the
      //   branch its own range test fails into (`DoAction@0x23f835` `+0x08c3`,
      //   split on `villain._x < hero._x`, one draw per side at `+0x08fe` and
      //   `+0x0bed`): `choices > 95` -> `wincrowd` (`+0x0bd3`, `+0x0ec2`), or
      //   `rest` below 30% stamina (`+0x0bc3`, `+0x0eb2`), beside the taunt
      //   band `85 <= choices <= 95` (`+0x0afd`/`+0x0b15` on the first side).
      //   **"Out of range" is the VILLAIN's test**: for a drawn bow that branch
      //   is `fightdistance < 200`, the CLOSED-ON case, not the far one. Twelve
      //   overrides then run over it before `villain_cast_spells()`
      //   (`+0x0ed7`-`+0x1432`: the random swap, the psyche roll and its
      //   continuation, the level-1 walk, the zero-stamina rest, the
      //   empty-quiver swap, the two taunted runs, the four status flags).
      //
      //   **This AI models none of the `choices` bands.** It takes no sample —
      //   the tired rest above says so of the out-of-range rests, the ladder
      //   blocks of the 90% roll — and the taunt it DOES take is not the
      //   85-95 band either: it is priced in hitpoints against the approach
      //   (`ss2TauntValue`, `aiTaunts`). **Priced the same way, a wincrowd is
      //   worth zero**: it deals no damage, moves nobody and closes nothing,
      //   so it never beats a step, a swing or a rest — and rest dominates it
      //   on the AI's own ledger (a rest gains stamina and heals; a wincrowd
      //   spends 3). Its only value is `crowd_interest`, which scales a purse
      //   this AI does not weigh. So the fit that takes no invented sample is
      //   the one built: offered to every seat, chosen by none, and the 5% band
      //   is NOT reproduced. Pinned by `test/ss2-wincrowd.test.js`.

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
        // ► **TAUNT INSTEAD OF TRUDGING, WHICH IS THE ONLY THING THE BUILD'S
        //   OWN CONTROLLER FRAMES LET A GLADIATOR DO AT RANGE AND THE ONE
        //   THING THIS AI NEVER DID.** `taunt` is wired on `longrange_warrior`
        //   and `longrange_archer` and on NEITHER close-range frame for a
        //   warrior — it is a LONG-RANGE verb, the build's answer to "I cannot
        //   reach him yet". Reaching this point means nothing is in reach, so
        //   this is exactly where the build offers it.
        //
        //   ► **AND IT IS WHY THE VERB WAS AT ZERO, which is NOT the reason
        //     this repository published on 2026-09-18.** That reading was
        //     *"`taunt` is absent from the preference table entirely"*, which
        //     is true and is the smaller half. Measured here over 25 seeded 3v3
        //     bouts on the demo roster: **taunt was legal on 914 of 2,064
        //     decisions, and on 664 of them (72.6%) no attack was legal at
        //     all** — so on nearly three quarters of its own offers the block
        //     this arm sits in had already returned a walk before any table was
        //     built. **The taunt was not ranked last. It was never ranked.**
        //     Adding a row to the preference table alone would have reached
        //     27.4% of the opportunity and reported the verb as fixed.
        //
        //   ► **THE COMPARISON IS AGAINST CLOSING, NOT AGAINST SWINGING**, and
        //     that is what stops it from being a taunt-bot. `ss2ApproachValue`
        //     amortises the best swing over the walks it takes to arrive, so
        //     one step out the approach is worth half a swing and wins, and far
        //     out it is worth a fraction of one and loses. A head-to-head of
        //     "taunt whenever legal" against this AI is NOT evidence for
        //     taunting always — see the handoff of 2026-09-18 and the
        //     measurement that broke it.
        //
        //   **Skipped rather than thrown for a gladiator with no damage pair**,
        //   the same courtesy the forced-phase and forced-swap arms above
        //   extend: pricing needs the attacker record, and a gladiator still
        //   walking toward the fight should not have to declare one to step.
        if (aiTaunts && nearest && ss2CanBePriced(actor)) {
          const tauntHere = options.find((option) =>
            option.type === Ss2ActionType.TAUNT && option.targetId === nearest.id);
          if (tauntHere) {
            const ranged = ss2SwingValues(actor, nearest);
            const bestSwing = Math.max(...Object.values(ranged.expected));
            const worth = ss2TauntValue(actor, nearest, ranged.chances);
            if (worth > ss2ApproachValue(actor, nearest, bestSwing)) return tauntHere;
          }
        }

        const flank = positionedInDepth && nearest && Number.isFinite(nearest.y)
          ? ss2FlankingWalk(view, nearest, options)
          : null;
        if (flank) return flank;

        // ► **JOIN A FIGHT AN ALLY IS ALREADY IN, when the dial says this
        //   gladiator may leave what it is doing.** Ahead of the empty-rank arm
        //   below because it is the more specific question: that one asks
        //   "where IS the fight", this one asks "should I leave mine for
        //   somebody else's". At the shipped `rankJoinSurplus` of 0 it can
        //   never fire while a foe stands in the actor's own rank, so a
        //   gladiator still finishes the fight it is in; what it gains is a
        //   reason to walk INTO one rather than toward the nearest enemy. See
        //   `ss2RankToJoin` for the sweep that set the value and
        //   `SS2_RANK_JOIN_SURPLUS` for what it costs.
        if (positionedInDepth) {
          const join = ss2RankToJoin(view, rankJoinSurplus, rankStride);
          if (join) {
            const step = options.find((option) => option.type === join);
            if (step) return step;
          }
        }

        if (positionedInDepth && !ownRankHasFoe && nearest && Number.isFinite(nearest.y)) {
          const towardRank = nearest.y > view.actor.y ? Ss2ActionType.RANK_FRONT : Ss2ActionType.RANK_BACK;
          const step = options.find((option) => option.type === towardRank);
          if (step) return step;
        }
        if (nearest) {
          const towardType = nearest.x > actor.x ? Ss2ActionType.WALK_RIGHT : Ss2ActionType.WALK_LEFT;
          const stride = options.find((option) => option.type === towardType);
          // ~~Stamina still outranks it: the forced-rest gate above already
          // returned at <= 10, so reaching here means the walk is affordable
          // in the only sense the build has — it does not refuse to spend.~~
          // **CORRECTED 2026-09-22: a gladiator at 10 or less DOES reach here
          // now, and walks, because the build's out-of-range villain does.**
          // The `staminaleft > 10` gate sits inside the in-range test
          // (`+0x03d5`), so it never sends an out-of-range villain to rest;
          // the out-of-range bands' own rests are `choices`-drawn and
          // percentage-gated, which this AI does not reproduce. The one floor
          // left is the zero-stamina rest `legalActions` forces, which the
          // build's villain has too (`staminaleft > 0` at `+0x1173`, reached on
          // every path) — and a walk is still never refused for its cost.
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

      // ► **A PURE CASTER NEVER REACHES THE SWING TABLE, and it must not: the
      //   table builds the ATTACKER record, which demands `min_damage` and
      //   `max_damage`.** A bolt reads neither — `magic_damage_character` binds
      //   `attacker`/`game_attacker` to register 0 — so a gladiator that
      //   carries a spell and declares no damage pair is entitled to cast, and
      //   pricing it would throw instead. Same guard the forced-phase, forced-
      //   swap and walk arms above carry, for the same reason.
      //
      //   It is above `ss2SwingValues` rather than inside the ranking because
      //   the ranking cannot run at all for such a gladiator.
      // In LADDER order — `SS2_DAMAGE_SPELL_LADDER`, arms 14-18 — so the first
      // entry is the one the build would cast.
      const boltOptions = SS2_DAMAGE_SPELL_LADDER
        .map((type) => options.find((option) => option.type === type && option.targetId === engaged.id))
        .filter(Boolean);

      // ► **THE TIRED REST, WHERE THE BUILD HAS IT: IN RANGE ONLY, AND BELOW
      //   THE LADDER (2026-09-22).** The villain's decision function
      //   (`DoAction@0x23f835`, base `0x23f83b`):
      //
      //     if ((equipped_weapon == 1 && fightdistance < weapon_range)      +0x034f-+0x038f
      //      || (equipped_weapon == 2 && !(fightdistance < 200))) {       +0x0397-+0x03d3
      //       if (staminaleft > 10) { ...in-range bands... }               +0x03e8
      //       else villaindecisionA = "rest"                               +0x08b6
      //     } else { ...out-of-range bands... }                            +0x08c3
      //     ...
      //     villain_cast_spells()                                          +0x1432
      //
      //   So IN RANGE at 10 or less the villain rests and the ladder may then
      //   replace the rest; OUT of range this gate never rests it, and the AI
      //   does what it does untired. Every ladder block this engine holds has
      //   already had its turn above — regenerate (arm 3), the potions (2,
      //   4-6, 10-13) and molten death (7) at the top, weaken (19), boundless energy (23), the gale
      //   (24) and the teleport (26) behind `!boltOnOffer` — so what is left of
      //   the ladder here is arms 14-18: a damage spell on possession, the
      //   LADDER's first, which is what `boltOptions[0]` is. A tired villain
      //   does not SWING in the build, so the spell is not priced against the
      //   swings the way it is below: the ladder casts it, or the villain rests.
      //
      // ► **WHY HERE, BELOW THE WALK BLOCK, AND WHICH HALF OF THE TEST THAT
      //   LEAVES LOAD-BEARING.** Every in-range verb is an attack verb, so an
      //   in-range gladiator has `attackOnOffer` and never enters the walk
      //   block; an out-of-range one with no attack on offer leaves it by a
      //   step and never gets here. So the range test below decides only the
      //   cases where an attack IS on offer out of range — the bash frame, or a
      //   damage spell from across the sands — and a mutation that drops it is
      //   caught by the bash case alone (`test/ss2-ai-tired-rest.test.js`).
      //
      // ► **"IN RANGE" IS READ FROM THE VOCABULARY, and it is an
      //   APPROXIMATION of the build's test, named:**
      //   - in range means `legalActions` offered a melee swing or a shot
      //     (`SS2_AI_IN_RANGE_VERBS`), i.e. this turn is `closerange_warrior`
      //     or `longrange_archer`. A drawn bow closed on is offered only
      //     `bash_attack` (`closerange_archer`), which is the build's
      //     `equipped_weapon == 2 && fightdistance < 200` — out of range;
      //   - the melee half is the build's own number (`ss2Reach` is
      //     `weapon_range`, strict `<`), but measured per foe and gated on the
      //     LANE (`ss2SameLane`), where the build has one opponent and one
      //     axis. A foe in reach but in another rank is out of range here;
      //   - the bow half is the HERO's floor, `100 + physical_size`
      //     (`ss2ArcherMinimumRange`), not the villain's hand-written 200 —
      //     the gate `legalActions` applies to everybody. Both are FLOORS and
      //     they agree at `physical_size` 100; below it this engine calls an
      //     archer in range up to `100 - physical_size` units closer than the
      //     build would, above it out of range up to `physical_size - 100`
      //     units farther (strength 9 on the demo roster: 186 against 200);
      //   - a gladiator with no position is offered every verb, so it is IN
      //     range, exactly as before this change.
      //
      // ► **WHAT IS OMITTED, NAMED:** the ladder's 90% roll (`+0x056f`), as
      //   everywhere here; and the build's other writes between the rest and
      //   the ladder, which can also replace it — the 20% `random_swap`
      //   (`+0x0ed7`), the 10% `psyche_up_chance` rest-or-charge (`+0x0fe5`),
      //   the 90% continuation of a charge already begun (`psyche_up > 1`,
      //   `+0x1070`), and the taunted runs (`+0x11ea`-`+0x1339`). The first
      //   three are drawn; the last is `legalActions`'s to force.
      if (restOption && resourceValue(actor, "staminaleft", 0) <= 10
        && options.some((option) => SS2_AI_IN_RANGE_VERBS.has(option.type))) {
        return boltOptions[0] ?? restOption;
      }

      if (boltOptions.length > 0 && !ss2CanBePriced(actor)) {
        // ~~Heaviest first, which is also the build's own ladder order~~ —
        // **true for the two bolts and false the day the fireballs arrived**:
        // by `damageHigh` the hell fireball (450) beats the frightning bolt
        // (400), and the ladder casts 35 first (arm 15 before arm 16). So the
        // unpriced caster takes the LADDER's first, which is the build's
        // answer rather than an argument about ranges.
        return boltOptions[0];
      }

      // The table this AI ranks on, now in `ss2SwingValues` so the approach arm
      // above reads the same numbers this one does rather than a second copy.
      const { attacker, chances, expected } = ss2SwingValues(actor, engaged);

      // ► **A BOLT IS PRICED AT ITS MEAN WITH NO CHANCE MULTIPLIER, BECAUSE IT
      //   CANNOT MISS.** Every other row here is `(chance / 100) * damage`; the
      //   bolt arm contains no `checkattackroll`, no direction draw and no hit
      //   roll at all, so its expected damage IS the mean of its range. That is
      //   the same arithmetic the other rows do, with the certainty term equal
      //   to 1 — not a thumb on the scale.
      //
      //   **It is not automatically the best move, and that is deliberate.** A
      //   lightning bolt means 150 and a frightning bolt 300; a gladiator whose
      //   `power_attack` prices above that keeps its bolt. The build does not
      //   make that comparison — its ladder casts on possession alone — but the
      //   build also has no valuation at all, so there is nothing here to
      //   contradict: this engine ranks where the build sequences, exactly as
      //   it already does for every other verb.
      //   **A fireball is priced the same way** — one sample, no hit roll, and
      //   the impact test cannot fail — so 120, 300 and 450 for ids 30-32.
      for (const option of boltOptions) {
        const spell = ss2DamageSpell(option.type);
        expected[option.type] = (spell.damageLow + spell.damageHigh) / 2;
      }

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
      //   gladiator: an out-of-range press decides nothing ~~and keeps the
      //   charge, so it can repeat forever~~ **and — corrected 2026-09-22 —
      //   burns the charge down to 2 (`+0x6732` runs on every exit of the
      //   gate), so it cycles: one charging press (2 -> 3), one wasted discharge,
      //   again.** Still starvation; the fix below is unchanged by it.
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
      //
      // ► ~~**THE CONSTRUCTION HOLDS.**~~ **IT DID, AND THE BOLTS ENDED IT ON
      //   2026-09-20 — IN THIS SAME DIFF, and found by the SECOND Codex
      //   adversarial review of it.** The whole argument above rests on one
      //   thing: reaching this line meant `attackOnOffer`, and `attackOnOffer`
      //   meant a verb from `ATTACK_BANDS` was offered, and every one of those
      //   is offered on `ss2Reach` — which the discharge gate then beats by 50.
      //   **The bolt arm has no range test at all**, so adding `boltOnOffer` to
      //   `attackOnOffer` let a caster reach this ranking from anywhere on the
      //   sands, and `engaged` falls back to the WEAKEST foe rather than a
      //   reachable one.
      //
      //   Reproduced before anything was touched: `aiCharges`, seed 3,
      //   `inventory1: 34`, counter 3, strength/attack 60, weapon 24,
      //   `herolevel` 10, separation **1960**. The AI chose `psyche_up`; it
      //   resolved `outOfRange: true`, `discharged: false`, **spent 57 stamina
      //   and kept the counter at 3** — so it can repeat for ever, which is the
      //   exact starvation the paragraph above describes for a DIFFERENT cause.
      //   *(That measurement was of this engine's old reading. Since
      //   2026-09-22 the gated press lands on 2, as the build's does, so the
      //   same gladiator would cycle one charge (2 -> 3) and a wasted discharge rather
      //   than repeat one press; the guard below prevents both.)*
      //   Without the bolt the same gladiator walks.
      //
      //   **So the explicit test is back, and this time it is load-bearing
      //   rather than a safety net.** The measurement that retired it (60
      //   decisions, 0 attackable foes outside the gate) was true of a
      //   vocabulary that no longer exists: it surveyed `ATTACK_BANDS`, and a
      //   bolt is not in `ATTACK_BANDS` for reasons that have nothing to do
      //   with range. **A guard justified by a construction has to be revisited
      //   the day the construction changes**, and the note that retires one
      //   should name what it depends on — this one did, which is the only
      //   reason the dependency was findable.
      const psycheOption = aiCharges && ss2PsycheDischargeInRange(actor, engaged)
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
          //   combatant that declares none, in which case the test passes —
          //   **carried to the foe's LIVE strength since 2026-09-22**
          //   (`ss2MaxDamageProxy`), or a colossus-buffed foe is priced at its
          //   fight-start swing and the wind-up walks into three of its turns.
          const incoming = ss2MaxDamageProxy(engaged) * presses;
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
      // ► **AND THE TAUNT JOINS THE TABLE, for the 27.4% of its offers where an
      //   attack is on offer too.** On the demo roster those turns are the
      //   archer's: `legalActions` wires the taunt on `closerange_archer` with
      //   no stamina test at all, so a bow-mode gladiator in reach is offered
      //   both. Priced in the same hitpoints as every other row rather than in
      //   damage alone — see `ss2TauntValue` for why that is the whole design
      //   decision — and it loses to a real swing whenever the swing is worth
      //   more, which on this roster is most of the time.
      // Matched to `engaged` for the same reason `psycheOption` is, and it was
      // the same live defect there: `legalActions` emits one taunt per foe, so
      // `find` by type alone takes whichever foe happens to be first in the
      // list and would price a taunt at one gladiator while aiming it at
      // another.
      const tauntOption = options.find((option) =>
        option.type === Ss2ActionType.TAUNT && option.targetId === engaged.id);
      if (aiTaunts && tauntOption) {
        expected[Ss2ActionType.TAUNT] = ss2TauntValue(actor, engaged, chances);
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
        // ► **THE BOLTS SIT BELOW THE CHARGE AND ABOVE EVERY SWING, and both
        //   halves of that are a tie-break argument rather than a preference.**
        //   Below the discharge: a charge that ties a bolt should be spent,
        //   because it leaves a partial charge behind while the bolt is gone
        //   for good. Above the swings: a bolt that ties a swing is CERTAIN
        //   where the swing is a roll, so the same expected value is worth
        //   more.
        //
        //   Frightning ahead of lightning for the reason power is ahead of
        //   quick — it is the heavier — **and that happens to be the build's
        //   own order too**: id 35 is ladder arm 15 and id 34 is arm 17, so a
        //   villain holding both can never cast the lightning bolt.
        //
        //   **The fireballs interleave in the ladder's order, arms 14-18**
        //   (`SS2_DAMAGE_SPELL_LADDER`). It matters at exactly one tie: the
        //   frightning bolt and the hell fireball both price at 300, and the
        //   build casts 35 first. Everywhere else the means already agree with
        //   the ladder, so this order changes nothing but that tie.
        Ss2ActionType.CAST_DIRE_FIREBALL,
        Ss2ActionType.CAST_FRIGHTNING_BOLT,
        Ss2ActionType.CAST_HELL_FIREBALL,
        Ss2ActionType.CAST_LIGHTNING_BOLT,
        Ss2ActionType.CAST_FIREBALL,
        Ss2ActionType.POWER_ATTACK,
        Ss2ActionType.NORMAL_ATTACK,
        Ss2ActionType.QUICK_ATTACK,
        Ss2ActionType.BOMBARD,
        Ss2ActionType.SNIPE,
        Ss2ActionType.BASH_ATTACK,
        // LAST, so a tie goes to a swing. A taunt that happens to price equal
        // to a bash should lose to it: the bash is certain to be an attack,
        // while three taunts in four do nothing but the recovery.
        Ss2ActionType.TAUNT
      ];
      let best = null;
      for (const type of preference) {
        // ► **`psyche_up` IS SELF-TARGETED AND THE OTHERS ARE NOT**, so the
        //   `targetId === engaged.id` filter would drop it every time. It is
        //   matched on type alone, and only when the arm above priced it —
        //   `expected` has no entry otherwise, and an unpriced verb must not be
        //   reachable by a `undefined > undefined` comparison.
        // An unpriced verb must not be reachable by an `undefined > undefined`
        // comparison, which is the trap the `psyche_up` arm below names. The
        // taunt is priced only when `aiTaunts` is on and an option named
        // `engaged`, so it is dropped the same way.
        if (type === Ss2ActionType.TAUNT && expected[type] === undefined) continue;
        // Same trap, same guard: a bolt is priced only when one was offered
        // against `engaged`, so an unoffered bolt must not be reachable by an
        // `undefined > undefined` comparison.
        if (ss2DamageSpell(type) && expected[type] === undefined) continue;
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
