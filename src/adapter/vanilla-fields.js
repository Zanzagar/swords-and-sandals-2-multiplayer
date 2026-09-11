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
  conditions: group(
    "battle-map: Combatant state objects / Conditions",
    ["psyche_up", "taunted1", "taunted2", "burning", "frozen", "poison", "life_stolen"],
    "Timed `spell_*` fields belong to this group; the map names none of them individually."
  ),
  inventory: group("battle-map: Combatant state objects / Inventory", [
    "inventory1",
    "inventory2",
    "inventory3",
    "inventory4",
    "inventory5",
    "inventory6"
  ])
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
 * Runtime-observed 2026-08-30 (battle map, "Combatant state objects"): the
 * persistent combat objects "do not carry `gladiator_dir` at action time — the
 * facing lives on the fighter clips". It is therefore read from, and written
 * to, `_root.arena.gladiators.<instance>` and never to `_root.game.<side>`.
 */
export const CLIP_RESIDENT_FIELDS = Object.freeze(["gladiator_dir"]);

/** Map, "Battle entry": the clips are placed facing right (hero) and left (villain). */
export const FACING_VALUES = Object.freeze(["right", "left"]);
export const DEFAULT_FACING = "right";

const TIMED_SPELL_PREFIX = "spell_";

const KNOWN_FIELDS = Object.freeze(
  new Set(Object.values(VANILLA_FIELD_GROUPS).flatMap((entry) => entry.fields))
);

const STATUS_FLAG_SET = Object.freeze(new Set(STATUS_FLAG_FIELDS));
const CLIP_RESIDENT_SET = Object.freeze(new Set(CLIP_RESIDENT_FIELDS));

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
 *   `docs/integration/ss2-battle-map.md:1471-1472` — `"hurt" + attack_direction`
 *   (`+0x2086`), rewritten to `"hurt" + (attack_direction - 20)` for
 *   directions 21–23 (`+0x2093`–`+0x20d6`). The entry had quoted the summary
 *   sentence and stopped reading, `hurtLabel` emitted `hurt21`/`hurt22`/`hurt23`
 *   on the strength of it, and `test/ss2-adapter.test.js` asserted that wrong
 *   value — so three artefacts agreed with each other and none agreed with the
 *   map. **Declaring the map silent is the cheapest way in this repository to
 *   turn a measurement into a guess: check the surrounding paragraph, not the
 *   sentence you are quoting.** Found by a write-nothing reader, re-derived
 *   here before it was believed.
 */
export const MAP_SILENCE = Object.freeze([
  Object.freeze({
    id: "psyche-up-initialisation",
    subject: "`psyche_up` initial value",
    silence:
      "The map lists `psyche_up` under Conditions and records that the spell ingress writes " +
      "`game_defender.psyche_up = 1` unconditionally, but never says whether it is initialised " +
      "before that write, so it may be undefined-until-set like the six status flags.",
    adapterBehaviour: "Treated as a numeric field defaulting to 0; NOT normalised as a status flag.",
    settledBy: "A capture that dumps the persistent object before any action and reports whether `psyche_up` is undefined."
  }),
  Object.freeze({
    id: "timed-spell-field-names",
    subject: "the timed `spell_*` field names",
    silence: "The map says \"timed `spell_*` fields\" and names none of them.",
    adapterBehaviour:
      "Any own key matching /^spell_/ is classified as a timed spell field and passed through unchanged.",
    settledBy: "A capture that enumerates the persistent object's own keys after casting each of the six buffs."
  }),
  Object.freeze({
    id: "secondary-weapon-field-names",
    subject: "the secondary weapon field names",
    silence: "The map spells out `secondary_weapon` and the two enchantment fields only.",
    adapterBehaviour: "The remaining names are reconstructed by prefixing `secondary_` and are marked as assumed.",
    settledBy: "The same own-key enumeration capture, on a gladiator carrying a secondary weapon."
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
    id: "movement-displacement",
    subject: "how far a movement phase moves a gladiator's `_x`",
    silence:
      "The battle map gives every movement phase's stamina COST with a byte offset and no phase's " +
      "DISTANCE: `walkleft` `+0x3b37`, `walkright` `+0x3d16`, `runleft` `+0x3ef5`, `runright` `+0x407e` all " +
      "cost `round(movement_speed / 2)`; `chargeright` `+0x4214` and `chargeleft` `+0x4480` cost " +
      "`round(movement_speed * 2)`; `jumpright` `+0x46ec` and `jumpleft` `+0x49c4` cost " +
      "`round(movement_speed)`. The only `_x` writes it records anywhere are the four clamps opening " +
      "`nextphase` (`If` at `+0x31cc`, `+0x31f8`, `+0x3224`, `+0x3250`, closed by `+0x3266`), and a clamp is " +
      "a bound, not a step. **The repository is not wholly silent, and saying so loosely would repeat the " +
      "error this list exists to prevent**: `docs/handoffs/2026-09-02-1659--three-waves-cut-at-the-usage-limit.md:194` " +
      "states \"one walk is 44 px\" — one occurrence repo-wide, uncited, in a FROZEN handoff, and suspect " +
      "because 44 is also the range multiplier in `weapon_range = physical_size + weapon[5] * 44` " +
      "(`+0x3190`). It survives one check from the other direction: the same line reports that only 26.6% of " +
      "real rounds reached range in fewer than five walks, and at 44px with both gladiators closing, four " +
      "walks each leaves the champion staging at `fightdistance` 148 against its `weapon_range` 144 (out) " +
      "and five leaves 60 (in). That is a CONSISTENCY CHECK against a different scenario, not a " +
      "measurement, and it may never be cited as evidence about the game. Nothing states a displacement " +
      "for the other six phases at all. What is NOT silent, and was wrongly recorded as such until " +
      "2026-09-10: the controller selector (frame 4 `DoAction@0x238bbf` `+0x00f6`, `+0x015f`) and " +
      "`getfightdistance` (`docs/integration/ss2-champion-dna.md:710-712`).",
    adapterBehaviour:
      "Nothing moves. No combatant projection carries a position, `combatStateHash` therefore commits to " +
      "none, and `place-clip` is constructed at exactly one site — arena construction in " +
      "`presentation.js` — and never again. The renderer's `advance` pose (`src/render/timeline.js`) is an " +
      "authored within-slot lunge that returns the figure to where it started, so it invents no position " +
      "the resolver would own. Measured 2026-09-10 while proving this entry out: a resolver-level position " +
      "model works and reproduces the build's own five-walk approach, but movement with no presentation " +
      "binding makes a walking gladiator emit `clip-goto Standing` — THE IDLE CLIP — plus a spurious " +
      "`unmapped`, which is the identical defect the owner found by watching the arena on 2026-09-10. " +
      "Movement needs a command kind of its own; reusing `place-clip` is not a style question but a " +
      "defect, because `scene.js` overwrites all seven geometry fields and a partial command makes " +
      "`toY(undefined)` NaN and the figure vanish.",
    settledBy:
      "NO NEW CAPTURE. The arena route's autopilot presses `walkright`/`walkleft` until the close-range " +
      "controller offers `normal_attack` (`docs/integration/ss2-arena-route.md`, \"The fight policy\"), and " +
      "traces record `phase_action` values by name — the same evidence shape already surveyed " +
      "archive-wide for the status phases. Counting the walk phases before the first attack in a staged " +
      "session bounds the per-phase displacement, because both ends of the interval are computable: the " +
      "champion staging's `strength:30`/`weapon:24` give `physical_size` 100 and `weapon_range` 144 " +
      "against a construction `fightdistance` of 500, so the approach closes at least 356 units over N " +
      "walks (the SUM over both sides — the villain AI closes too). Repeating it across stagings with " +
      "different `speed` settles the second question, whether the displacement scales with " +
      "`movement_speed` at all, because that staging pins `movement_speed` at its clamp floor of 4. The " +
      "archive is not on a fresh-clone tree; this needs the capture machine, not the capture rig. " +
      "**NO GOLDEN CAN SETTLE IT, and that is structural rather than an accident of which 23 we have.** " +
      "Measured 2026-09-10: a golden's scenario carries exactly attack, defence, strength, charisma, " +
      "magicka, min_damage, max_damage, hitpoints, hitpointsmax, staminaleft, staminamax, armourclass, " +
      "armourclass_max and gladiator_dir — and `speed` is not among them, in any of the 23. Since the " +
      "resolver renames `speed` to `agility` and `ss2Combatant` reads `agility: derived.speed ?? 0`, every " +
      "golden has agility 0 and therefore `movement_speed` pinned at the clamp FLOOR of 4. They all sit at " +
      "one point of the curve, so no comparison between them can show a slope. A fixture that could settle " +
      "this would have to declare `speed`, which no promoted golden does.",
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
      "spans 3-36 — and if that is backwards, every swing cost is backwards.",
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
      "derived from `herolevel` with a `RandomNumber(899)` draw, and it never touches a fight; " +
      "`crowd_action` is a per-damage presentation cue (`+0x52af`); `wincrowd` is a player action costing 3 " +
      "stamina (`+0x5014`), wired on every controller and hidden below `herolevel` 3, whose mechanical " +
      "effect the map does not record at all; and the `taunttimer` watchdog (`+0x67e4`, 60 ticks) abandons " +
      "a stuck ANIMATION, not a stalled bout. `nextphase` step 6 says \"update and clamp crowd state\" and " +
      "names the variable only in that summary, so a decode MAY yet find a real pressure term — but none is " +
      "recorded today. **This entry exists because the main session put a fork to the owner describing the " +
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

export function isTimedSpellField(name) {
  return typeof name === "string" && name.startsWith(TIMED_SPELL_PREFIX);
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
  if (isClipResidentField(name)) return "battle-map: Combatant state objects / clip-resident facing";
  if (isTimedSpellField(name)) return "battle-map: Combatant state objects / Conditions (timed spell_* fields, unnamed)";
  return null;
}

export { isPlainObject as isPlainVanillaObject };
