/**
 * The vanilla SS2 field catalogue.
 *
 * This module is *data*: the names, groups, defaults, and citations for every
 * field the read-only battle map records on the persistent combat objects
 * (`_root.game.hero` / `_root.game.villain`) and on the runtime fighter clips
 * (`_root.arena.gladiators.hero` / `.villain`). It contains no formulas, no
 * derivations, and no combat decisions — deriving a value from these fields is
 * rule-set work, not adapter work.
 *
 * Every citation below is a section of `docs/integration/ss2-battle-map.md`.
 * Where the map is silent the constant says so explicitly and the accompanying
 * `MAP_SILENCE` entry names the capture that would settle it. Nothing in this
 * file may be presented as runtime-verified: the only runtime-verified
 * behaviour in the repository is what `test/fixtures/ss2-1v1-golden/` holds.
 */

export const HERO_SIDE = "hero";
export const VILLAIN_SIDE = "villain";

/** The two — and only two — sides the vanilla surface knows about. */
export const VANILLA_SIDES = Object.freeze([HERO_SIDE, VILLAIN_SIDE]);

/** Map: "Combatant state objects". Persistent combat data. */
export const GAME_OBJECT_ROOT = "_root.game";

/** Map: "Battle entry and timeline ownership" step 1-3. Display/animation state. */
export const GLADIATOR_CLIP_ROOT = "_root.arena.gladiators";

/** Map: "Combatant state objects". The four per-action binding registers. */
export const VANILLA_BINDING_GLOBALS = Object.freeze({
  ATTACKER_CLIP: "attacker",
  DEFENDER_CLIP: "defender",
  ATTACKER_OBJECT: "game_attacker",
  DEFENDER_OBJECT: "game_defender"
});

export class VanillaFieldError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/* ------------------------------------------------------------------ */
/* Field groups                                                        */
/* ------------------------------------------------------------------ */

const group = (citation, fields, notes = null) =>
  Object.freeze({ citation, fields: Object.freeze([...fields]), notes });

/**
 * Every field group the map's "Observed data fields" table records, in the
 * table's own order. `citation` names the section a reader should check.
 * **Plus one group the table does not record**, `fightStartBackups` (added
 * 2026-09-23), byte-derived and cited to the section that derives it — see
 * its note, and `inventory_maxslots` for the same shape inside a table row.
 */
export const VANILLA_FIELD_GROUPS = Object.freeze({
  identity: group("battle-map: Combatant state objects / Identity-progression", [
    "character_name",
    "herolevel",
    "character_level",
    "experience",
    "experienceneeded",
    "current_tournament",
    "tournament_ranking"
  ]),
  baseStats: group("battle-map: Combatant state objects / Base stats", [
    "strength",
    "speed",
    "attack",
    "defence",
    "vitality",
    "stamina",
    "charisma",
    "magicka"
  ]),
  liveResources: group("battle-map: Combatant state objects / Live resources", [
    "hitpoints",
    "hitpointsmax",
    "staminaleft",
    "staminamax",
    "armourclass",
    "armourclass_max",
    "ammo_left",
    "maximum_ammo"
  ]),
  primaryWeapon: group("battle-map: Combatant state objects / Primary weapon", [
    "weapon",
    "weapon_type",
    "weapon_weight",
    "weapon_range",
    "weapon_min_damage",
    "weapon_max_damage",
    "weapon_enchantment_type",
    "weapon_enchantment_potency",
    "equipped_weapon",
    "using_bow"
  ]),
  secondaryWeapon: group(
    "battle-map: Combatant state objects / Secondary weapon",
    [
      "secondary_weapon",
      "secondary_weapon_type",
      "secondary_weapon_weight",
      "secondary_weapon_range",
      "secondary_weapon_min_damage",
      "secondary_weapon_max_damage",
      "secondary_weapon_enchantment_type",
      "secondary_weapon_enchantment_potency"
    ],
    // The map names `secondary_weapon` explicitly and then says "plus the
    // corresponding type, weight, range, min/max damage, and enchantment
    // fields". Only the two enchantment names are independently corroborated
    // (they appear in the 1v1 candidate resolver). The rest are reconstructed
    // by prefixing and are marked as such.
    "ASSUMPTION: names reconstructed by prefixing `secondary_`; the map spells out only `secondary_weapon` and the two enchantment fields."
  ),
  armour: group("battle-map: Combatant state objects / Armour", [
    "breastplate",
    "helmet",
    "shinguard",
    "greaves",
    "shoulderguard",
    "gauntlet",
    "boot",
    "shield",
    "breastplate_defence",
    "helmet_defence",
    "shinguard_defence",
    "greaves_defence",
    "shoulderguard_defence",
    "gauntlet_defence",
    "boot_defence",
    "shield_defence"
  ]),
  derivedCombat: group("battle-map: Combatant state objects / Derived combat + battlevalues", [
    "physical_size",
    "min_damage",
    "max_damage",
    "secondary_min_damage",
    "secondary_max_damage",
    "movement_speed",
    "attack_type",
    "attack_speed",
    "weapon_enchantment_damage",
    // Added 2026-09-02. Its absence was an asymmetry rather than a decision:
    // `battlevalues` writes BOTH, four instructions apart (`+0x320c` and
    // `+0x3326`), and the map's own "Derived combat" row names both. Every
    // other field in this group that has a `secondary_` twin carries it.
    "secondary_weapon_enchantment_damage"
  ]),
  /**
   * ► **THE ONE ENTRY IN THIS CATALOGUE THAT IS NOT A COMBATANT FIELD, and it
   *   is here because refusing it would have been the wrong kind of strict.**
   *
   *   Every other group names something the build stores ON a gladiator.
   *   `criticalhit` is a bare `SetVariable` on the overlay timeline inside
   *   `checkattackroll` — `+0x2de1` (the taunt sentinel 21), `+0x2e7e`
   *   (bombard's `randomBetween(-20, 20)`), `+0x2eeb` (snipe's flat 0), and one
   *   per melee band. It belongs to the ACTION, not to either fighter.
   *
   *   It is catalogued anyway because the guard this list feeds asks one
   *   question — *can a reader point at a vanilla quantity behind this name?* —
   *   and the answer is yes twice over: the dispatcher table's whole "Critical
   *   sample" column is this variable, and a live capture emitted it as a raw
   *   21 (`session-adc21`, §"Direction 20 is the taunt path"). What it does NOT
   *   have is a save-schema home, and pretending otherwise by filing it under
   *   "Derived combat" would have been the quiet error.
   *
   *   **The engine carries it PER COMBATANT, which is narrower than the
   *   build.** See `criticalhit` in `SS2_RESOURCE_NAMES` for why, and for what
   *   that costs: vanilla's bash can inherit the OTHER fighter's critical, and
   *   this one inherits only its own.
   */
  actionTransient: group(
    "battle-map: Hit and damage path / Attack roll dispatcher (critical sample)",
    ["criticalhit"],
    "A timeline variable, not a combatant field: it belongs to the action and the build stores it nowhere."
  ),
  chanceCache: group("battle-map: Hit and damage path / Chance calculation", [
    "power_percentage",
    "normal_percentage",
    "quick_percentage",
    "bash_percentage",
    "taunt_percentage",
    "bombard_percentage",
    "snipe_percentage",
    "magicka_percentage"
  ]),
  /**
   * ► **THIS NOTE SAID THE TIMED `spell_*` FIELDS BELONG TO THIS GROUP, AND
   *   NONE OF THEM IS ON THIS OBJECT (corrected 2026-09-22).** The old text:
   *   *"Timed `spell_*` fields belong to this group; the map names none of
   *   them individually."* Both halves were wrong. The build keeps all six on
   *   the fighter CLIP (`TIMED_SPELL_COUNTER_FIELDS`, below), and the map
   *   named two of them from 2026-08-31 — `attacker.spell_boundless_energy`
   *   and the `spell_regenerate` test in `nextphase` — one day after this
   *   note was written. It now names all six.
   */
  conditions: group(
    "battle-map: Combatant state objects / Conditions",
    ["psyche_up", "taunted1", "taunted2", "burning", "frozen", "poison", "life_stolen"],
    "The timed spell counters are NOT in this group: the build keeps them on the fighter clip " +
      "(TIMED_SPELL_COUNTER_FIELDS; battle map §Five more phases, check_spells r1)."
  ),
  inventory: group(
    "battle-map: Combatant state objects / Inventory",
    [
      "inventory1",
      "inventory2",
      "inventory3",
      "inventory4",
      "inventory5",
      "inventory6",
      // ► **ADDED 2026-09-22, AND THE MAP'S TABLE ROW DOES NOT LIST IT.** That
      //   row (`Inventory | inventory1 through inventory6`) is the "Observed
      //   data fields" table, and no capture in this repository has observed
      //   the field. Its evidence is BYTE-derived, at the map's §"Spell and
      //   vanilla AI surface" → "THE HERO'S IN-BATTLE OFFER GATE": it is a
      //   member of the persistent object (`initcharacter` writes it from
      //   `characterDNA[40]` at `+0x098e`; `constructDNA` serialises it at
      //   `+0x206d`) and the hero's inventory panel reads it as
      //   `_root.game.hero.inventory_maxslots` (`sprite:492[inventory_overlay]
      //   /frame:1` `+0x024f`). The group's `notes` say so, so `citationFor`
      //   does not overclaim.
      "inventory_maxslots"
    ],
    "inventory_maxslots is not in the map's observed-fields row: it is byte-derived at §Spell and vanilla AI " +
      "surface (the hero's in-battle offer gate, sprite:492[inventory_overlay]/frame:1 +0x024f; " +
      "initcharacter +0x098e), and no capture has observed it."
  ),
  /**
   * ► **ADDED 2026-09-23, BECAUSE THE ARENA COULD NOT BUILD A REJUVENATE
   *   HOLDER.** `ss2Combatant` has declared the nine piece backups for a holder
   *   of id 43 since `8ff985d`, and `createVanillaBattleHost` checks every name
   *   in a caller-supplied bag against this catalogue — which did not know
   *   them, so the arena's `?items=buffs` and `?items=crowd` kits died at
   *   construction with "no battle-map section cites" `backup_shoulderguard`.
   *   That was false: the map cites all of them. Every test of rejuvenate had
   *   built its battle with `createTeamBattle` directly, so none went through
   *   the check. `test/ss2-host-spell-resources.test.js` now does.
   *
   * **They are fields of the PERSISTENT object**, like the pieces they back:
   * the rejuvenate arm reads eight of the nine as `game_attacker.backup_<piece>`
   * (map §"Five more phases", `cast_rejuvinate`, `+0x8d69`-`+0x8f58`; the
   * shoulderguard's goes through the free variable `whichcharacter`,
   * `+0x8e50`, which the owner's decision replaces), and `check_spells`
   * restores the stat spells' stats from `backup_*` on its `which_character`
   * argument (r2), which `nextphase` binds to `game_attacker`/`game_defender`.
   * `backup_char` (`root/frame:35` `+0x2d80`-) writes them, at four call sites
   * none of which is mid-battle, so in a battle they are READ and never
   * written — and the adapter writes none of them.
   *
   * **All thirteen, not only the nine that reached the bag.** The four stat
   * backups never travel in a supplied bag — the rule set declares them at the
   * opening (`rules.openingResources`), and `ss2Combatant` never reads them out
   * of a record — so they did not trip the check. They are here because the
   * map cites them in the same section from the same writer (`+0x2d80`-`+0x2da7`,
   * the only writes of the four anywhere), and a catalogue that answered
   * "no battle-map section cites" for them would be the false silence this
   * file's `MAP_SILENCE` header records three times.
   */
  fightStartBackups: group(
    "battle-map: Spell and vanilla AI surface / Five more phases (backup_char's fight-start snapshot: " +
      "cast_rejuvinate's nine piece restores and the four stat spells' expiry)",
    [
      "backup_shoulderguard",
      "backup_gauntlet",
      "backup_breastplate",
      "backup_helmet",
      "backup_greaves",
      "backup_shinguard",
      "backup_boot",
      "backup_weapon",
      "backup_shield",
      "backup_strength",
      "backup_speed",
      "backup_attack",
      "backup_defence"
    ],
    "Not in the map's observed-fields row: byte-derived at §Five more phases (cast_rejuvinate +0x8d69-+0x8f58; " +
      "check_spells' expiry restores; backup_char root/frame:35 +0x2d80-), and no capture has observed them. " +
      "Read, never written, in battle."
  )
});

/**
 * Runtime-observed 2026-08-30 (battle map, "Combatant state objects"): the
 * persistent combat objects leave these six flags **undefined** until
 * something sets them. Reading one therefore yields `undefined`, not `false`,
 * on a freshly constructed battle. The capture wrapper normalises undefined to
 * `false` and this adapter does the same, recording every normalisation so the
 * difference between "never set" and "explicitly false" is never lost.
 */
export const STATUS_FLAG_FIELDS = Object.freeze([
  "burning",
  "frozen",
  "poison",
  "life_stolen",
  "taunted1",
  "taunted2"
]);

/**
 * Byte-verified `death()` clear order (battle map, "Battle result and reward
 * callbacks"): frozen, burning, poison, life_stolen — hero's group first, then
 * villain's — followed by taunted1 (hero, villain) and taunted2 (hero,
 * villain). Used only to order *writes*; clearing is the rule set's decision.
 */
export const DEATH_STATUS_CLEAR_ORDER = Object.freeze([
  "frozen",
  "burning",
  "poison",
  "life_stolen",
  "taunted1",
  "taunted2"
]);

/**
 * **The six timed spell counters, in `check_spells`' own order — and they live
 * on the fighter CLIP, not on the persistent combat object.** Byte-derived and
 * verified 2026-09-22 (battle map, §"Five more phases, in full, and the timed
 * buffs `nextphase` applies"; every offset below is in
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f`):
 *
 * - `check_spells(which_character, which_avatar)` (header `+0x2403`, flags
 *   `0x2a`) binds `which_character` to r2 and `which_avatar` to r1, and every
 *   counter read and write in its body is on `register:1` — `+0x2439`
 *   (`spell_colossus`) through `+0x277a` (`spell_boundless_energy`). What it
 *   touches on r2 is the stat restores (`strength = backup_strength`, …).
 * - `nextphase` calls it as `check_spells(game_attacker, attacker)` (`+0x3271`
 *   pushes `attacker`, `+0x3277` `game_attacker`, then the call) and again for
 *   the defender (`+0x3289`), so the clip is the argument that lands in r1.
 * - every cast arm writes its counter on a clip — `attacker.spell_colossus =
 *   16` (`+0x7fed`), `defender.spell_little_fat_kid = 16` (`+0x820b`),
 *   `attacker.spell_swiftsandals = 20` (`+0x8970`), `attacker.spell_bloodlust
 *   = 20` (`+0x8a73`), `attacker.spell_regenerate = 20` (`+0x8bbe`),
 *   `attacker.spell_boundless_energy = 20` (`+0x8c9d`);
 * - `nextphase`'s two effect tests read `attacker.spell_regenerate`
 *   (`+0x33bd`) and `attacker.spell_boundless_energy` (`+0x3476`).
 *
 * `attacker`/`defender` are the clips and `game_attacker`/`game_defender` the
 * persistent objects (map, "Combatant state objects"). Nothing in the evidence
 * writes a counter on `_root.game.<side>`, so a counter found there is one the
 * build never reads.
 *
 * ► **UNTIL 2026-09-22 THIS FILE HAD NO LIST, ONLY A PREFIX, AND PUT THE
 *   PREFIX ON THE WRONG OBJECT.** Any own key of the persistent object matching
 *   `/^spell_/` was a "timed spell field", cited to the map's Conditions row,
 *   and `state-bridge.js` let a declared resource write one there. The prefix
 *   was also too wide on its own terms: `spell_selected` is a build name (a
 *   timeline variable `use_item` sets, `+0x0388` of `DoAction@0x23e7cf`) and is
 *   no counter.
 */
export const TIMED_SPELL_COUNTER_FIELDS = Object.freeze([
  "spell_colossus",
  "spell_little_fat_kid",
  "spell_swiftsandals",
  "spell_bloodlust",
  "spell_regenerate",
  "spell_boundless_energy"
]);

/**
 * Fields the build keeps on the fighter clip (`_root.arena.gladiators.
 * <instance>`) and not on `_root.game.<side>`. Read from the clip, carried on
 * the normalised record's `clip`, and never stored on the combat object.
 *
 * - `gladiator_dir`: runtime-observed 2026-08-30 (battle map, "Combatant state
 *   objects"): the persistent combat objects "do not carry `gladiator_dir` at
 *   action time — the facing lives on the fighter clips". It is the one
 *   clip-resident field the adapter WRITES (`facingWrite`).
 * - the six `TIMED_SPELL_COUNTER_FIELDS` — added 2026-09-22, byte-derived, not
 *   runtime-observed. The adapter reads them and writes none of them.
 */
export const CLIP_RESIDENT_FIELDS = Object.freeze(["gladiator_dir", ...TIMED_SPELL_COUNTER_FIELDS]);

/** Map, "Battle entry": the clips are placed facing right (hero) and left (villain). */
export const FACING_VALUES = Object.freeze(["right", "left"]);
export const DEFAULT_FACING = "right";

const KNOWN_FIELDS = Object.freeze(
  new Set(Object.values(VANILLA_FIELD_GROUPS).flatMap((entry) => entry.fields))
);

const STATUS_FLAG_SET = Object.freeze(new Set(STATUS_FLAG_FIELDS));
const CLIP_RESIDENT_SET = Object.freeze(new Set(CLIP_RESIDENT_FIELDS));
const TIMED_SPELL_COUNTER_SET = Object.freeze(new Set(TIMED_SPELL_COUNTER_FIELDS));

/* ------------------------------------------------------------------ */
/* Where the map is silent                                             */
/* ------------------------------------------------------------------ */

/**
 * Every place this adapter had to act without the map settling the question.
 * Each entry names what would settle it. Nothing here is verified; nothing
 * here may be presented as SS2 behaviour.
 *
 * ► **AN ENTRY HERE IS A CLAIM ABOUT THE MAP, AND ONE OF THEM WAS FALSE
 *   (removed 2026-09-10).** `ranged-hurt-label-adjustment` said the map gave
 *   the phrase "adjusted for ranged directions" *"without giving the
 *   adjustment"*. It gives it one sentence later, with byte offsets:
 *   §"Attack roll dispatcher" in `docs/integration/ss2-battle-map.md` — `"hurt" + attack_direction`
 *   (`+0x2086`), rewritten to `"hurt" + (attack_direction - 20)` for
 *   directions 21–23 (`+0x2093`–`+0x20d6`). The entry had quoted the summary
 *   sentence and stopped reading, `hurtLabel` emitted `hurt21`/`hurt22`/`hurt23`
 *   on the strength of it, and `test/ss2-adapter.test.js` asserted that wrong
 *   value — so three artefacts agreed with each other and none agreed with the
 *   map. **Declaring the map silent is the cheapest way in this repository to
 *   turn a measurement into a guess: check the surrounding paragraph, not the
 *   sentence you are quoting.** Found by a write-nothing reader, re-derived
 *   here before it was believed.
 *
 * ► **AND `movement-displacement` WAS REMOVED 2026-09-11 FOR A THIRD REASON,
 *   which is neither of the two above and is the one worth remembering.** That
 *   entry was right that the battle-map DOCUMENT gives every movement phase's
 *   stamina cost with a byte offset and no phase's distance. It was wrong about
 *   what followed from that. Its `settledBy` sent a reader to the capture
 *   archive — *"NO NEW CAPTURE ... this needs the capture machine"* — and the
 *   answer was in the BUILD all along: the eight movement branches of overlay
 *   frame 52 each compute a destination, `walkright` at `+0x3d78` being
 *   `movement_speed * 16`. Nine days, two tools and one authored constant, and
 *   nobody opened the branch whose stamina cost the entry was quoting from two
 *   instructions away.
 *
 *   **The lesson is NOT "check the surrounding paragraph" again — it is that
 *   this catalogue is about the MAP, and the map is a transcription.** A gap in
 *   it is a gap in what somebody wrote down, never a gap in the build. An entry
 *   whose `settledBy` reaches for a capture should have to say why the bytes
 *   cannot answer it first. See `ss2WalkDisplacement` for the derivation and
 *   `tools/walk-displacement-derivation.mjs` for the census that holds it to the
 *   build.
 *
 * ► **`timed-spell-field-names` WAS REMOVED 2026-09-22. It shares the
 *   second failure above and adds a worse one: the capture it asked for was
 *   aimed at the WRONG OBJECT.** It read, in full:
 *
 *   - silence: *"The map says \"timed `spell_*` fields\" and names none of
 *     them."*
 *   - adapterBehaviour: *"Any own key matching /^spell_/ is classified as a
 *     timed spell field and passed through unchanged."*
 *   - settledBy: *"A capture that enumerates the persistent object's own keys
 *     after casting each of the six buffs."*
 *
 *   The silence went stale ONE DAY after the entry was written (2026-08-30):
 *   from 2026-08-31 the map's stamina-writer table named
 *   `attacker.spell_boundless_energy` and its per-turn section the
 *   `spell_regenerate` test — and `attacker` is a CLIP by the map's own
 *   binding list. Nobody re-read the entry against that. **And the capture it
 *   asked for was aimed at the wrong object**: the build keeps all six
 *   counters on the fighter clip (`check_spells`' r1), so enumerating
 *   `_root.game.<side>` after six casts would have found none of them, and read
 *   as "the build has no timed fields" — a measurement confirming nothing,
 *   presented as evidence. The bytes answered it without a capture, as the
 *   entry above says they usually do. The six are now named in
 *   `TIMED_SPELL_COUNTER_FIELDS` and classified clip-resident.
 */
export const MAP_SILENCE = Object.freeze([
  Object.freeze({
    id: "psyche-up-initialisation",
    subject: "`psyche_up` initial value BETWEEN battles",
    /**
     * ► **NARROWED 2026-09-16, BY THE BYTES, WHICH IS WHAT THIS CATALOGUE'S OWN
     *   HEADER DEMANDS OF AN ENTRY THAT REACHES FOR A CAPTURE.** It used to
     *   read: *"never says whether it is initialised before that write, so it
     *   may be undefined-until-set like the six status flags"*, settled by
     *   *"a capture that dumps the persistent object before any action"*.
     *
     *   **At battle time it is never undefined.** Sprite 2249's frame 1 is
     *   labelled `initbattle`, and `DoAction@0x6e421b` `+0x0bc9`-`+0x0bf1` runs
     *   `_root.game.hero.psyche_up = _root.game.villain.psyche_up = 1` — a
     *   `StoreRegister`/double-`SetMember` chained assignment — in the same
     *   block that places both fighters at `_x -320 / _y 122`. And it is the
     *   only such site: `psyche_up` appears in exactly six action blocks in the
     *   whole SWF (overlay frame 52, the four controller frames, and this one),
     *   so nothing else can initialise it.
     *
     *   What is left is genuinely narrower and much less consequential: what
     *   the PERSISTENT object holds between battles, which no code path in a
     *   battle can observe because `initbattle` overwrites it first.
     */
    silence:
      "What the PERSISTENT object holds for `psyche_up` between battles. At battle time it is " +
      "always 1: `initbattle` (sprite 2249 frame 1, `+0x0bc9`-`+0x0bf1`) writes both fighters' " +
      "counters before any action, and it is the only initialisation site in the build.",
    adapterBehaviour: "Treated as a numeric field defaulting to 0; NOT normalised as a status flag.",
    settledBy:
      "A save inspection between battles. NOT a battle capture — `initbattle` overwrites the value " +
      "before the first frame a capture could read."
  }),
  Object.freeze({
    id: "secondary-weapon-field-names",
    subject: "the secondary weapon field names",
    silence: "The map spells out `secondary_weapon` and the two enchantment fields only.",
    adapterBehaviour: "The remaining names are reconstructed by prefixing `secondary_` and are marked as assumed.",
    // "The same" named the removed `timed-spell-field-names` entry's capture
    // until 2026-09-22; spelled out here so the referent does not dangle.
    settledBy:
      "A capture that enumerates the persistent object's own keys, on a gladiator carrying a secondary weapon."
  }),
  Object.freeze({
    id: "panel-bar-instance-names",
    subject: "the combat panel's health and stamina bar instance names",
    silence:
      "The map's UI table names only `hero_potion`, `villain_potion`, `hero_stamina_potion`, " +
      "`villain_stamina_potion`, `hero_armour`, and `villain_armour` on `combat_panel` (export 751).",
    adapterBehaviour:
      "Panel updates address a widget *role* per slot; the front slots use the six mapped instance names and " +
      "every other role is addressed by role name, not by a guessed instance name.",
    settledBy: "A capture that enumerates `arena.combat_panel`'s child instance names."
  }),
  Object.freeze({
    id: "multi-slot-arena-geometry",
    subject: "positions, depths, and clip names for slots beyond the first",
    silence:
      "Vanilla has no second ally, so the map cannot settle this: it records only `hero` at depth 301 and " +
      "`villain` at depth 300, placed at (-250, 200) and (250, 200), and states that the panel and timeline " +
      "are hard-coded for two sides.",
    adapterBehaviour:
      "Slot 0 reuses the vanilla instance names, depths, and positions exactly; further slots use authored " +
      "names and a reserved depth band that provably avoids every depth the map records.",
    settledBy: "Nothing in vanilla; this is authored mod surface and is labelled as such."
  }),
  Object.freeze({
    id: "swing-cost",
    subject: "what a swing costs its wielder, and which way the `weaponweights` index runs",
    silence:
      "The build states the cost outright and this engine deliberately leaves it, so the SILENCE here is " +
      "narrower and more specific than the divergence. What the build gives with offsets: " +
      "`staminacost = round(strength * 3)` for `power_attack` (`+0x603c`), `* 2` for `normal_attack` " +
      "(`+0x61a3`), `* 1` for `quick_attack` (`+0x6317`). What it does NOT give is any reader for " +
      "`attack_speed` — the weapon table's `[2]` column, read through by `battlevalues` (`+0x3174`, " +
      "`+0x346a`) and catalogued by the map as derived combat with no consumer recorded anywhere. **And the " +
      "genuinely weak link: `[2]` is an INDEX into `weaponweights`, a six-entry array whose location is " +
      "known (`+0x3dd4`, `docs/integration/ss2-item-tables.md:345`) and whose VALUES this repository does " +
      "not hold.** So nothing here says whether index 1 is the heavy end or the light one. It is read as " +
      "HEAVY from the damage correlation across the whole table — index 1 spans 80-676 max damage, index 5 " +
      "spans 3-36 — and if that is backwards, every swing cost is backwards. " +
      "► **EVERY WORD OF THE BOLD SENTENCE ABOVE WAS FALSE WHEN IT WAS WRITTEN, and it is corrected here " +
      "rather than deleted because the mechanism matters more than the fact. THIS REPOSITORY DID HOLD THE " +
      "VALUES**: `ss2-item-tables.md` states them TWO LINES under the offset this entry cites for the " +
      "location — \"Weight index 1 is the heaviest and 5 the lightest\" — and has since `df3a122` on " +
      "2026-08-30, which is before this entry existed. It was then ranked as the cheapest open question on " +
      "the board and sent to the owner as work. **Third instance in this repository of one failure: " +
      "declaring the map silent without reading the surrounding paragraph** — the other two are named in " +
      "this list's own header and in `hurtLabel`. " +
      "**THE DIRECTION IS SETTLED, and the inference was RIGHT**: read off the installed build 2026-09-11, " +
      "`weaponweights` is six STRINGS — so `attack_speed` is a weight-CLASS index and never a numeric " +
      "speed — and reversed out of its push order index 1 is the heavy end and index 5 the light one. " +
      "`tools/item-table-transcription.mjs` checks it on every run, including the push-order convention " +
      "itself against `weapontypes`. **WHAT REMAINS SILENT IS NARROWER AND STILL REAL**: the map records " +
      "no READER for `attack_speed` anywhere, so the build does something with the weight class that this " +
      "repository still cannot name.",
    adapterBehaviour:
      "`SS2_SWING` / `ss2SwingCost` in `src/team/ss2-rules.js` price a swing on the weapon's mass with " +
      "strength in the denominator, so strength BUYS cheaper swings instead of paying for them. The band " +
      "factors 3/2/1 are still the build's, so the three bands keep their relative prices. **It is gated " +
      "behind `fixtureReplay`**: a fixture keeps `round(strength * band_factor)` exactly, so all 23 goldens " +
      "still reproduce their measured `staminaleft` and the corpus stays evidence. It answers a measured " +
      "defect (`docs/combat-economy-findings-2026-09-10.md` D2): strength 7 beat strength 30 over 39 " +
      "actions without losing a point of stamina or health, because the build prices a swing on the wielder " +
      "and pays it out of the weapon.",
    settledBy:
      "► **DONE 2026-09-11: the tool was extended and run, and the direction came back as read. What is " +
      "written below is what was done, kept because it describes the route.** " +
      "THE DIRECTION IS SETTLED BY A TOOL THAT ALREADY EXISTS, and it is the cheapest open question in this " +
      "list: the same `tools/item-table-transcription.mjs` route that re-reads the ninety weapon literals " +
      "out of the installed SWF can read the six `weaponweights` values at `+0x3dd4`. That turns `mass()` " +
      "from an authored reading into a derived one, or reverses it. It needs the licensed build, so it is " +
      "the owner's lane, but it needs no capture, no staging and no Ruffle. **Nothing settles the " +
      "divergence itself** — pricing a swing on the weapon is a decision (owner's, 2026-09-10), not a " +
      "measurement, and no capture can endorse it."
  }),
  Object.freeze({
    id: "crowd-impatience",
    subject: "what ends a bout neither side is trying to win",
    silence:
      "The build has a crowd and NO bout-level pressure mechanic, and the difference matters because the " +
      "vocabulary is so suggestive that it reads like evidence. What the map actually records: " +
      "`crowd_interest` is a GOLD MULTIPLIER read once on the victory frame (`2249/frame:88` `+0x078c`), " +
      "~~derived from `herolevel` with a `RandomNumber(899)` draw~~ **opened at `hero.herolevel + " +
      "villain.herolevel` by the `crowd_bar` clip handler (`sprite:751` clip-action:0 `+0x011f`-`+0x0158`; " +
      "the `RandomNumber(899)` at `sprite:2224/frame:1` `+0x0f48` feeds `_global.crowdlevel`, a string " +
      "nothing reads — corrected 2026-09-22)**, and it never touches a fight's arithmetic; " +
      "~~`crowd_action` is a per-damage presentation cue (`+0x52af`)~~ **`crowd_action` is a per-PHASE " +
      "delta on `_global` that `nextphase` adds into `crowd_interest` and clamps to 1..100 " +
      "(`+0x3541`-`+0x35b4`; `+0x52af` is the frozen arm writing 0) — MODELLED since 2026-09-22 in " +
      "`src/team/ss2-crowd.js`, owner's decision (f)**; `wincrowd` is a player action costing 3 " +
      "stamina (`+0x5014`), wired on every controller and hidden below `herolevel` 3, whose mechanical " +
      "effect ~~the map does not record at all~~ **is `crowd_action = round(_root.game.hero.charisma / 2)` " +
      "(`+0x4fdb`) — the HERO's charisma even when the villain acts; derived, not yet built**; and the " +
      "`taunttimer` watchdog (`+0x67e4`, 60 ticks) abandons " +
      "a stuck ANIMATION, not a stalled bout. `nextphase` step 6 says \"update and clamp crowd state\" and " +
      "names the variable only in that summary, so a decode MAY yet find a real pressure term — but none is " +
      "recorded today. **The crowd economy, now decoded in full, is not one either: it scales the victory " +
      "purse and nothing else reads it.** **This entry exists because the main session put a fork to the owner describing the " +
      "crowd and the taunttimer as vanilla's answer to a stalled fight. They are not, and the owner chose " +
      "on that false premise before it was caught and corrected.**",
    adapterBehaviour:
      "An AUTHORED crowd-impatience toll, `SS2_CROWD` in `src/team/ss2-rules.js`, answering a measured " +
      "defect: 4,000 consecutive mutual `rest` actions leave `battle.result === null`, because rest is " +
      "stamina-positive AND heals and no rule caps a bout. Past `patience` turns every actor takes " +
      "escalating damage on its own turn, computed at the top of `resolveAction` so no path escapes it and " +
      "applied LAST in the effect list so a heal in the same action cannot revive the actor it just killed. " +
      "It is a pure function of `turnNumber`, which `combatStateHash` already covers, so it adds no " +
      "projected field and cannot desync separately from the battle. `fixtureReplay` never pays it.",
    settledBy:
      "A capture that records crowd state across a LONG bout, and specifically across a stalled one: two " +
      "gladiators declining to engage until the build does something about it. That would settle both " +
      "halves — whether `nextphase`'s \"crowd state\" is a pressure term at all, and what the build does " +
      "when nobody attacks. Until then every number here is authored and none may be cited as SS2 " +
      "behaviour. The TUNING route, which is separate from the evidence route and has already been run: " +
      "measure the bout-length distribution with the toll DISABLED (120 seeded bouts across 1v1/2v2/3v3 " +
      "gave min 21, median 50, p95 102, max 135) and put `patience` past the tail — never with the toll " +
      "enabled, which shapes the very distribution being measured."
  }),
  Object.freeze({
    id: "initiative-order",
    subject: "the resolver's strict initiative order",
    silence:
      "Vanilla runs a three-phase `battle_action` cycle advanced by `nextphase` (map, \"Spell and vanilla AI " +
      "surface\"), not a sorted initiative list. The map does not describe a turn order the resolver's " +
      "`initiativeOrder` could be compared against.",
    adapterBehaviour: "The adapter does not translate turn order at all; it presents whatever order the resolver produced.",
    settledBy: "A capture that records the `battle_action` cycle and phase attribution across a multi-action battle."
  })
]);

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */

export function isKnownVanillaField(name) {
  return KNOWN_FIELDS.has(name);
}

/** True for the six flags the persistent objects leave undefined until set. */
export function isStatusFlagField(name) {
  return STATUS_FLAG_SET.has(name);
}

/** True for fields that live on the fighter clip, not the persistent object. */
export function isClipResidentField(name) {
  return CLIP_RESIDENT_SET.has(name);
}

/**
 * True for the six named timed counters, which are clip-resident. **Was a
 * `/^spell_/` prefix test until 2026-09-22**, which called every `spell_`
 * name a timed counter — the build's own `spell_selected` timeline variable
 * and any invented name included — and put them on the persistent object.
 */
export function isTimedSpellField(name) {
  return TIMED_SPELL_COUNTER_SET.has(name);
}

export function knownVanillaFields() {
  return [...KNOWN_FIELDS];
}

/**
 * Reads one of the six undefined-until-set status flags.
 *
 * `undefined` means "nothing has written it yet" and reads as `false`, which
 * is exactly what the capture wrapper does. `absent` in the returned record
 * preserves the distinction the raw object would otherwise lose.
 */
export function readStatusFlag(record, name) {
  if (!isStatusFlagField(name)) {
    throw new VanillaFieldError(`${String(name)} is not one of the undefined-until-set status flags.`);
  }
  if (!isPlainObject(record)) {
    throw new VanillaFieldError("A vanilla combat object must be a plain object.");
  }
  const raw = record[name];
  return Object.freeze({ name, absent: raw === undefined, value: raw === undefined ? false : Boolean(raw) });
}

/** The map section a field's presence in this adapter is justified by. */
export function citationFor(name) {
  for (const entry of Object.values(VANILLA_FIELD_GROUPS)) {
    if (entry.fields.includes(name)) return entry.citation;
  }
  // ► **Was "battle-map: Combatant state objects / Conditions (timed spell_*
  //   fields, unnamed)" for any `spell_` name until 2026-09-22** — a
  //   persistent-object row for fields the build keeps on the clip, and a
  //   citation for invented names too. Checked before the facing, because both
  //   are clip-resident and only one is the facing.
  if (isTimedSpellField(name)) {
    return "battle-map: Spell and vanilla AI surface / Five more phases (timed buffs on the fighter clip, check_spells r1)";
  }
  if (isClipResidentField(name)) return "battle-map: Combatant state objects / clip-resident facing";
  return null;
}

export { isPlainObject as isPlainVanillaObject };
