/**
 * Vanilla combat state <-> canonical combatant state.
 *
 * This is a pure, total, two-way mapping and nothing else. It has no formulas,
 * no rolls, no thresholds, and no arithmetic on combat values: **every vanilla
 * field write it produces is an absolute assignment that mirrors a value the
 * resolver already decided and already clamped.** That is the structural
 * reason the adapter cannot become a second place where combat is decided — it
 * can only copy. If a future edit here starts computing an outcome, it belongs
 * in a rule set (`src/team/rule-set.js`), not in this file.
 *
 * **That sentence used to be a description; it is now a check.** Two of them,
 * in fact, and they are what make the claim inspectable rather than a promise:
 *
 * - every write declares a `source` from a closed ~~four-value~~ **six-value**
 *   set (`WriteSource`; stats and the battle's crowd joined 2026-09-23, the
 *   owner's "write both back"), and the source fixes which vanilla fields the
 *   write may target
 *   (`ALLOWED_WRITE_FIELDS`) — a set defined here, not per scenario;
 * - `assertWriteProvenance` then requires each write's `to` to be `===` the
 *   value the post-action projection actually holds at the canonical location
 *   its source names. A computed value has no such location to be identical
 *   to, so `to: before - amount` cannot be expressed at all.
 *
 * The read side has the same discipline: `toCanonicalCombatantSource` refuses
 * a vanilla record missing a base stat rather than defaulting it, and emits
 * only the `loadout` keys a named vanilla field answers, so an assumption the
 * record cannot support does not silently override the roster's own default.
 *
 * Totality: `normaliseVanillaCombatant` preserves every own key of its input,
 * including keys the battle map does not name (anything a future build adds).
 * ~~(the unnamed timed `spell_*` fields, and …)~~ — corrected 2026-09-22: the
 * map names all six timed counters and the build keeps them on the fighter
 * clip, not on this object. Only these things are treated specially, each
 * because the map says so:
 *
 * 1. the six status flags are **undefined until something sets them**, so they
 *    are materialised to `false` and the materialisation is recorded;
 * 2. `gladiator_dir` is **clip-resident**, so it is lifted out of the combat
 *    object into a separate clip record and written back only to the clip;
 * 3. the six timed spell counters are **clip-resident too** (added 2026-09-22),
 *    so they are read from the supplied clip onto the clip record. One found
 *    on the combat object is NOT lifted: it is passed through where it was
 *    found and reported in `misplacedClipFields`, because nothing folds a
 *    counter onto that object and the build never reads one there;
 * 4. everything else round-trips byte-for-byte.
 *
 * Citations are sections of `docs/integration/ss2-battle-map.md`.
 */

import { EffectKind } from "../team/rule-set.js";
import {
  citationFor,
  DEATH_STATUS_CLEAR_ORDER,
  DEFAULT_FACING,
  FACING_VALUES,
  isClipResidentField,
  isKnownVanillaField,
  isPlainVanillaObject,
  isStatusFlagField,
  isTimedSpellField,
  STATUS_FLAG_FIELDS,
  TIMED_SPELL_COUNTER_FIELDS
} from "./vanilla-fields.js";

/**
 * True for a canonical resource name the vanilla build actually has a
 * resource-backed field for: one of the names this module declares in
 * `CANONICAL_RESOURCE_SOURCES`, and nothing else.
 *
 * ► **IT ALSO ADMITTED "the timed `spell_*` pools the map declines to
 *   enumerate" UNTIL 2026-09-22, AND WROTE THEM TO AN OBJECT THE BUILD NEVER
 *   READS THEM FROM.** A declared-resource write lands on `_root.game.<side>`
 *   (`WRITE_SOURCE_TARGETS`), and the build keeps every timed counter on the
 *   fighter clip (`TIMED_SPELL_COUNTER_FIELDS`), so a mirrored
 *   `spell_regenerate` did nothing in the build while the adapter reported it
 *   as mirrored. A timed counter now falls to the unmapped branch, with a
 *   reason that says where the build keeps it (`unmappedResourceReason`).
 *
 * Everything else is reported as unmapped — the same discipline `emitStatus`
 * applies to a status with no vanilla flag. A rule set is free to invent a
 * resource; the adapter will not invent a vanilla field to hold it, and it
 * will not repurpose a vanilla field it has not declared resource-backed.
 * `hitpoints`, `hitpointsmax`, the six status flags and the clip-resident
 * facing are owned by canonical health, canonical status and the clip record
 * respectively, so a resource that names one of them is refused rather than
 * allowed to forge a health or status write through the resource branch.
 */
function mirrorsToVanillaField(name) {
  return CANONICAL_RESOURCE_SOURCES.includes(name);
}

/**
 * Where the build keeps a timed counter, in the words every refusal of one
 * uses — so the message that stops a write is also the pointer to the object
 * a write would have had to reach.
 */
function timedCounterPlacement(name) {
  return (
    `${String(name)} is a timed spell counter the build keeps on the fighter clip ` +
    "(_root.arena.gladiators.<instance>, check_spells' r1 which_avatar; battle map §Five more phases), " +
    "never on the persistent combat object (_root.game.<side>), so a write there would do nothing in the build. " +
    "No write source reaches the clip for it: a bare counter is not a value the build holds alone, because four " +
    "of the six restore state from backups at expiry (colossus: the clip's _xscale/_yscale from the oldscale its " +
    "cast arm sets on entry, and strength/attack from backup_strength/backup_attack)"
  );
}

/**
 * Why a resource cannot reach vanilla, as a fixed reason string. Split from
 * "no vanilla field at all" because a resource colliding with a field another
 * source already owns is a different mistake from inventing one.
 *
 * ► **A THIRD REASON, added 2026-09-07, because the second one was being
 * given for a case it does not describe.** Once a caller could declare a
 * resource bag wider than `CANONICAL_RESOURCE_SOURCES`, a rule set could write
 * a resource whose vanilla field **exists and is cited by the battle map** —
 * `ss2TeamRules` destroying a `gauntlet` is the case that found this — and the
 * adapter answered "no vanilla field carries this resource". That is false and
 * it points the reader at the wrong fix: the field is real, it is simply
 * outside the adapter's write allowlist, and widening that allowlist is a
 * deliberate decision (see `docs/ss2-adapter-contract.md`, "Still open" item 2
 * on equipment identity) rather than an oversight.
 *
 * ► **A FOURTH REASON, added 2026-09-22, for the same failure one level
 * down.** A timed counter is cited by the battle map, so it would otherwise get
 * the third reason — and "widening the allowlist" is the wrong fix for it: the
 * allowlist names fields of the persistent combat object, and the build keeps
 * the counters on the fighter clip. Checked first, so no counter can be
 * pointed at the allowlist.
 */
function unmappedResourceReason(name) {
  if (isTimedSpellField(name)) return timedCounterPlacement(name);
  if (RESOURCE_RESERVED_FIELDS.has(name)) {
    return (
      "this vanilla field is owned by canonical health, canonical status, a canonical stat or the clip record, " +
      "not by a resource"
    );
  }
  if (citationFor(name)) {
    return (
      "the battle map cites this vanilla field, but it is not in the adapter's declared-resource write " +
      "allowlist, so the resolved value is reported rather than written. Widening the allowlist is a decision: " +
      "see docs/ss2-adapter-contract.md, 'Still open' item 2"
    );
  }
  return "no vanilla field carries this resource";
}

export class AdapterStateError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value));

/* ------------------------------------------------------------------ */
/* Stat mapping                                                        */
/* ------------------------------------------------------------------ */

/**
 * canonical stat -> vanilla field. The canonical stat names come from
 * `src/team/roster.js`; the vanilla names come from the map's "Base stats"
 * row. `agility <- speed` and `defense <- defence` are naming reconciliations,
 * not derivations: no value is transformed.
 */
export const CANONICAL_STAT_SOURCES = Object.freeze({
  strength: "strength",
  agility: "speed",
  attack: "attack",
  defense: "defence",
  vitality: "vitality",
  stamina: "stamina",
  magicka: "magicka"
});

/**
 * The inverse, vanilla field -> canonical stat, so a `canonical-stat` write
 * names the one place in the projection its value must be identical to. The
 * mapping above is one-to-one, so inverting it adds nothing and loses nothing.
 */
const STAT_FOR_VANILLA_FIELD = Object.freeze(Object.fromEntries(
  Object.entries(CANONICAL_STAT_SOURCES).map(([canonical, vanilla]) => [vanilla, canonical])
));

/**
 * Vanilla base stats with no canonical `stats` slot. `charisma` drives the
 * whole taunt path (map, "Chance calculation": the taunt chance and the
 * direction-20 damage both read it), so a runtime-verified rule set needs it —
 * and it now reaches one through the canonical **resource** bag below rather
 * than only through the vanilla record. It is still not a canonical *stat*.
 */
export const UNMAPPED_VANILLA_STATS = Object.freeze(["charisma"]);

/**
 * Vanilla fields carried into the canonical **resource** bag
 * (`src/team/resources.js`), sorted, one name each.
 *
 * Why these and not everything: a resource is a per-combatant number a rule
 * set must be able to *read and write* while the resolver refuses to interpret
 * it. Before the bag existed, a rule set needing SS2's armour, stamina,
 * ammunition, charisma, per-piece armour ratings or enchantment values had to
 * close over the adapter's mirror — a side channel outside `combatStateHash`,
 * which turns the desync check into a lie. Declaring them here is what makes
 * the write legal at all: the resolver refuses a write to an undeclared
 * resource *by design* (`resources.js`, constraint 2), so an undeclared pool
 * is a pool no rule set can ever move.
 *
 * The names are the vanilla field names **verbatim**, exactly as the canonical
 * status tokens are the vanilla flag names verbatim: an invented resource
 * vocabulary is one more table that can be mapped wrongly.
 *
 * The three `*_max` / `maximum_*` fields are declared as resources of their
 * own rather than folded into the pools' bounds, because `resources.js` says
 * so in as many words: "a maximum that itself moves during a battle is
 * modelled as its own resource, exactly as vanilla models `armourclass_max`,
 * `staminamax` and `maximum_ammo` as fields alongside the pools they bound".
 * `remove_armour` moves `armourclass_max` mid-battle, so a frozen bound would
 * be wrong within one action of a destroyed piece.
 *
 * Every entry is a name `VANILLA_FIELD_GROUPS` already carries a citation for;
 * a test asserts that, so this list cannot drift away from the catalogue.
 */
export const CANONICAL_RESOURCE_SOURCES = Object.freeze([
  // Live resources: the pools and the three maxima that bound them.
  "ammo_left",
  "armourclass",
  "armourclass_max",
  "maximum_ammo",
  "staminaleft",
  "staminamax",
  // Base stats: the one with no canonical stat slot.
  "charisma",
  // ► **THE PSYCHE COUNTER, WHICH IS A LIVE POOL LIKE `staminaleft` AND UNLIKE
  //   `criticalhit`.** Added 2026-09-16 with the `psyche_up` verb.
  //
  //   The distinction this list turns on is whether there is anything to mirror
  //   TO. `criticalhit` is deliberately absent because the build keeps it as a
  //   bare `SetVariable` on the overlay timeline inside `checkattackroll`
  //   (`+0x2e7e`, `+0x2eeb`) and NOT as a field on either gladiator, so
  //   mirroring it would invent a save-schema field the build does not have.
  //
  //   `psyche_up` is the opposite case: it is a real member of the persistent
  //   combat object, which the map lists under "Combatant state objects /
  //   Conditions" and which the build writes by name in three places —
  //   `nextphase` `+0x35c7`-`+0x35ea`, `damagecharacter` `+0x1be4`, and the
  //   discharge's own write-back at `+0x6738`. Leaving it out would report
  //   every counter advance as an unmapped write against a field that plainly
  //   exists.
  "psyche_up",
  // Armour: the per-piece ratings (the piece *ids* are equipment identity, not
  // a numeric pool, and are deliberately left in the vanilla record).
  "boot_defence",
  "breastplate_defence",
  "gauntlet_defence",
  "greaves_defence",
  "helmet_defence",
  "shield_defence",
  "shinguard_defence",
  "shoulderguard_defence",
  // Enchantments: every catalogued field whose name carries `enchantment`.
  "secondary_weapon_enchantment_potency",
  "secondary_weapon_enchantment_type",
  "weapon_enchantment_damage",
  "weapon_enchantment_potency",
  "weapon_enchantment_type"
]);

/**
 * The battle's OWN declared pools (`battleResources` on the wire — a rule
 * set's `EffectKind.BATTLE_RESOURCE` target) that the build keeps on
 * `_global`, one per bout, verbatim by name. Added 2026-09-23 with the
 * owner's "write both back".
 *
 * `crowd_interest` is the only one: the `crowd_bar` clip-action opens it at
 * `_global.crowd_interest = hero.herolevel + villain.herolevel`
 * (`sprite:751` `+0x011f`-`+0x0158`), `nextphase` adds `crowd_action` and
 * clamps it to 1..100 (`+0x3541`-`+0x35b4`, `r3 = _global`), and the victory
 * frame reads it (`2249/frame:88` `+0x078c`). A pool this list does not name
 * is reported rather than given an invented global — the same discipline
 * `CANONICAL_RESOURCE_SOURCES` applies one scope down.
 */
export const CANONICAL_BATTLE_RESOURCE_SOURCES = Object.freeze(["crowd_interest"]);

/**
 * Canonical health maps to the vanilla hitpoint pair and to nothing else.
 *
 * `armourclass` deliberately does NOT map into canonical health: the map's
 * damage path subtracts normal/grievous damage from `armourclass` first and
 * carries only the overflow into `hitpoints`, and *deciding* that split is a
 * formula. It is rule-set work. The adapter carries `armourclass` in the
 * vanilla record and never folds it into `health`.
 */
export const CANONICAL_HEALTH_SOURCES = Object.freeze({
  health: "hitpoints",
  maxHealth: "hitpointsmax"
});

/**
 * Canonical status tokens are the vanilla flag names verbatim. There is
 * deliberately no translation table: an invented status vocabulary is one more
 * thing that can be mapped wrongly, and the resolver treats a status as an
 * opaque string anyway (`src/team/resolver.js`, `applyEffects`).
 */
export const CANONICAL_STATUS_TOKENS = STATUS_FLAG_FIELDS;

/**
 * The canonical token an SS2 rule set uses for a left-facing gladiator.
 *
 * Spelled here rather than imported, because the adapter may not depend on a
 * rule-set module — and it is NOT in `STATUS_FLAG_FIELDS` on purpose: those
 * are fields of the persistent combat object, and facing is clip-resident
 * (`CLIP_RESIDENT_FIELDS`). Same concept, different write target.
 */
export const CANONICAL_FACING_LEFT = "facing-left";

/**
 * Vanilla fields another canonical source already owns. A declared resource
 * may never name one: allowing it would let the resource branch write
 * `hitpoints` with a number canonical health never produced, which is the one
 * thing the write shape exists to make impossible.
 *
 * ► **The seven base-stat fields joined 2026-09-23**, when the
 *   `canonical-stat` source took them: a resource named `strength` is a
 *   borrower now, not a field outside the allowlist that widening would fix.
 */
export const RESOURCE_RESERVED_FIELDS = Object.freeze(new Set([
  CANONICAL_HEALTH_SOURCES.health,
  CANONICAL_HEALTH_SOURCES.maxHealth,
  ...STATUS_FLAG_FIELDS,
  "gladiator_dir",
  ...Object.values(CANONICAL_STAT_SOURCES)
]));

/* ------------------------------------------------------------------ */
/* The closed set of write sources                                     */
/* ------------------------------------------------------------------ */

/**
 * **Where a vanilla field write is allowed to get its value from.**
 *
 * This is the structural half of "the adapter decides no combat". The prose
 * version — *every vanilla write mirrors the resolver's post-action
 * projection, never `before - effect`* — was a convention: nothing stopped a
 * write carrying a number the adapter had computed, because nothing checked
 * where the number came from.
 *
 * Now every write must name one of exactly ~~four~~ **six** sources, each of
 * which fixes two things: **which vanilla fields the write may target** (see
 * `ALLOWED_WRITE_FIELDS`) and **which canonical value it must carry** (see
 * `assertWriteProvenance`, which requires `write.to` to be `===` the value the
 * post-action projection actually holds there). A computed value has no
 * canonical location to be identical to, so it cannot be expressed.
 *
 * ► **FOUR BECAME SIX 2026-09-23, THE OWNER'S "WRITE BOTH BACK" (decided
 *   2026-09-22).** An in-battle stat change (`EffectKind.STAT`) and the
 *   battle's own crowd (`EffectKind.BATTLE_RESOURCE`) were REPORTED in
 *   `unmapped` because no source carried them. Each got a source of its own
 *   rather than a wider existing one, so each is pinned to its own field set,
 *   its own write target and its own canonical location — the mechanism is
 *   unchanged, only the vocabulary grew.
 */
export const WriteSource = Object.freeze({
  /** `hitpoints`, and only ever the post-action `health` the resolver clamped. */
  CANONICAL_HEALTH: "canonical-health",
  /** One of the six vanilla flags, and only ever `after.status.includes(flag)`. */
  CANONICAL_STATUS: "canonical-status",
  /** One resource-backed field, and only ever `after.resources[field].value`. */
  DECLARED_RESOURCE: "declared-resource",
  /** `gladiator_dir` on the fighter clip, and only ever a `FACING_VALUES` member. */
  CLIP_FACING: "clip-facing",
  /**
   * One vanilla base-stat field (`CANONICAL_STAT_SOURCES`' values), and only
   * ever `after.stats[stat]` for the canonical stat that field maps from.
   * Added 2026-09-23.
   */
  CANONICAL_STAT: "canonical-stat",
  /**
   * One `_global` field a battle's own pool mirrors to
   * (`CANONICAL_BATTLE_RESOURCE_SOURCES`), and only ever
   * `battleResources[field].value` from the post-action wire. The one source
   * that names no combatant. Added 2026-09-23.
   */
  DECLARED_BATTLE_RESOURCE: "declared-battle-resource"
});

const WRITE_SOURCES = Object.freeze(Object.values(WriteSource));

/**
 * The vanilla fields each source may write, independent of any scenario.
 *
 * ~~`DECLARED_RESOURCE` additionally admits the timed `spell_*` pools, which
 * the map declines to enumerate by name — `isResourceBackedVanillaField` is the
 * authoritative predicate and this table is its enumerable core.~~ **Corrected
 * 2026-09-22: this table is now the whole of every source's field set, with no
 * predicate beside it.** The map names all six timed counters and the build
 * keeps them on the fighter clip, which the declared-resource source never
 * writes; `assertWriteShape` refuses one and says where the build keeps it.
 */
export const ALLOWED_WRITE_FIELDS = Object.freeze({
  [WriteSource.CANONICAL_HEALTH]: Object.freeze([CANONICAL_HEALTH_SOURCES.health]),
  [WriteSource.CANONICAL_STATUS]: STATUS_FLAG_FIELDS,
  [WriteSource.DECLARED_RESOURCE]: CANONICAL_RESOURCE_SOURCES,
  [WriteSource.CLIP_FACING]: Object.freeze(["gladiator_dir"]),
  [WriteSource.CANONICAL_STAT]: Object.freeze(Object.values(CANONICAL_STAT_SOURCES)),
  [WriteSource.DECLARED_BATTLE_RESOURCE]: CANONICAL_BATTLE_RESOURCE_SOURCES
});

/**
 * Which vanilla object each source is allowed to aim at.
 *
 * ~~two~~ **Three targets since 2026-09-23**: the persistent combat object,
 * the fighter clip, and `_global` — the one object that belongs to no
 * combatant, which the battle's crowd needed. A stat write stays on the
 * combat object, where the build writes `game_defender.strength` (`+0x82df`).
 */
const WRITE_SOURCE_TARGETS = Object.freeze({
  [WriteSource.CANONICAL_HEALTH]: "combat-object",
  [WriteSource.CANONICAL_STATUS]: "combat-object",
  [WriteSource.DECLARED_RESOURCE]: "combat-object",
  [WriteSource.CLIP_FACING]: "fighter-clip",
  [WriteSource.CANONICAL_STAT]: "combat-object",
  [WriteSource.DECLARED_BATTLE_RESOURCE]: "global"
});

/** True for a vanilla field a declared resource is allowed to reach. */
export function isResourceBackedVanillaField(name) {
  return mirrorsToVanillaField(name);
}

/* ------------------------------------------------------------------ */
/* Vanilla -> normalised vanilla record                                */
/* ------------------------------------------------------------------ */

function assertFacing(value, source) {
  if (!FACING_VALUES.includes(value)) {
    throw new AdapterStateError(
      `A fighter clip facing must be one of ${FACING_VALUES.join(", ")}; ${source} supplied ${JSON.stringify(value)}.`
    );
  }
  return value;
}

/**
 * Normalises one vanilla combatant into `{ fields, clip, materialisedFlags,
 * facingSource, misplacedClipFields, unknownFields }`.
 *
 * ► **`timedSpellFields` WAS REPLACED BY `misplacedClipFields` 2026-09-22.**
 *   It listed the combat object's `/^spell_/` keys as its timed spell fields;
 *   the build keeps no timed counter on that object (`TIMED_SPELL_COUNTER_FIELDS`),
 *   so there is nothing of that name to list. What IS worth reporting is a
 *   clip-resident name found there: passed through untouched, NOT lifted —
 *   the facing is lifted because the 1v1 fixtures and the capture wrapper's
 *   `dumpSide` both fold the clip's facing onto that record, and nothing folds
 *   a counter, so lifting one would hand the build a value it never read. It is
 *   not `unknownFields` either: the name is known, the object is wrong.
 *
 * @param {object} source the persistent combat object (`_root.game.<side>`)
 * @param {object} [options.clip] the runtime fighter clip, which owns the facing
 *   and the six timed counters
 */
export function normaliseVanillaCombatant(source, { clip = null } = {}) {
  if (!isPlainVanillaObject(source)) {
    throw new AdapterStateError("A vanilla combat object must be a plain object.");
  }
  if (clip !== null && !isPlainVanillaObject(clip)) {
    throw new AdapterStateError("A fighter clip record must be a plain object when supplied.");
  }

  const fields = {};
  const misplacedClipFields = [];
  const unknownFields = [];
  for (const [name, value] of Object.entries(source)) {
    if (name === "gladiator_dir") continue; // lifted onto the clip record below
    fields[name] = value === undefined ? undefined : clone(value);
    if (isClipResidentField(name)) misplacedClipFields.push(name);
    else if (!isKnownVanillaField(name)) unknownFields.push(name);
  }

  // Runtime-observed: undefined until something sets them. Materialising to
  // false is exactly what the capture wrapper does; recording which ones were
  // absent keeps "never written" distinguishable from "explicitly false".
  const materialisedFlags = [];
  for (const flag of STATUS_FLAG_FIELDS) {
    if (fields[flag] === undefined) {
      materialisedFlags.push(flag);
      fields[flag] = false;
    } else {
      fields[flag] = Boolean(fields[flag]);
    }
  }

  // Clip-resident facing. The combat object does not carry it at action time;
  // a value found there is a staging artefact (the 1v1 fixtures fold the
  // clip's facing into the scenario) and is accepted with its origin recorded.
  let facing = DEFAULT_FACING;
  let facingSource = "default";
  if (clip && clip.gladiator_dir !== undefined) {
    facing = assertFacing(clip.gladiator_dir, "the fighter clip");
    facingSource = "fighter-clip";
  } else if (source.gladiator_dir !== undefined) {
    facing = assertFacing(source.gladiator_dir, "the combat object");
    facingSource = "combat-object";
  }

  // The timed counters, read from the clip because that is where the build
  // keeps them. Only those the clip actually carries: a fresh clip has none
  // (nothing initialises them; `check_spells` tests `> 0`), and writing a
  // default onto the record would invent clip state.
  const clipRecord = { gladiator_dir: facing };
  if (clip) {
    for (const name of TIMED_SPELL_COUNTER_FIELDS) {
      if (clip[name] !== undefined) clipRecord[name] = clone(clip[name]);
    }
  }

  return Object.freeze({
    fields,
    clip: Object.freeze(clipRecord),
    materialisedFlags: Object.freeze(materialisedFlags),
    facingSource,
    misplacedClipFields: Object.freeze(misplacedClipFields),
    unknownFields: Object.freeze(unknownFields)
  });
}

/**
 * The inverse of `normaliseVanillaCombatant`'s split: recombines a normalised
 * record into the two objects vanilla actually stores them in.
 *
 * `fighterClip` carries every clip-resident field the record holds — the
 * facing, and since 2026-09-22 any timed counter the supplied clip carried.
 * It used to be `{ gladiator_dir }` alone, when the facing was the only one.
 */
export function denormaliseVanillaCombatant(record) {
  assertVanillaRecord(record);
  return Object.freeze({
    combatObject: { ...record.fields },
    fighterClip: { ...record.clip }
  });
}

function assertVanillaRecord(record) {
  if (!record || typeof record !== "object" || !isPlainVanillaObject(record.fields)) {
    throw new AdapterStateError("A normalised vanilla record needs a `fields` object.");
  }
  if (!record.clip || !FACING_VALUES.includes(record.clip.gladiator_dir)) {
    throw new AdapterStateError("A normalised vanilla record needs a clip facing.");
  }
  return record;
}

/* ------------------------------------------------------------------ */
/* Vanilla -> canonical                                                */
/* ------------------------------------------------------------------ */

/** Map, "Spell and vanilla AI surface": observed inventory id -> decision label. */
const DAMAGE_SPELL_IDS = Object.freeze(new Set([30, 31, 32, 34, 35, 49]));
const HEAL_SPELL_IDS = Object.freeze(new Set([43, 46]));
const INVENTORY_SLOTS = Object.freeze(["inventory1", "inventory2", "inventory3", "inventory4", "inventory5", "inventory6"]);

function inventoryIds(fields) {
  return INVENTORY_SLOTS.map((slot) => Number(fields[slot])).filter((id) => Number.isFinite(id));
}

/**
 * PLACEHOLDER-VOCABULARY BRIDGE.
 *
 * `loadout` in `src/team/roster.js` is placeholder shape
 * (`meleeDamage`/`rangedDamage`/`canUseRanged`/`canUseSpell`/`canHeal`) because
 * the placeholder rule set's vocabulary is placeholder. Vanilla has a min/max
 * damage pair, a two-weapon slot system, ammunition, and an inventory of
 * numbered items — none of which reduce to those five values without inventing
 * something. Everything below is therefore an ASSUMPTION serving the
 * placeholder vocabulary only.
 *
 * A runtime-verified rule set will read the vanilla record directly and this
 * function becomes dead. Nothing else in the adapter depends on it.
 */
export function placeholderLoadoutFrom(fields) {
  const ids = inventoryIds(fields);
  return {
    meleeDamage: Number(fields.min_damage ?? 0),
    rangedDamage: Number(fields.secondary_min_damage ?? fields.min_damage ?? 0),
    canUseRanged: fields.using_bow === true || Number(fields.maximum_ammo ?? 0) > 0,
    canUseSpell: ids.some((id) => DAMAGE_SPELL_IDS.has(id)),
    canHeal: ids.some((id) => HEAL_SPELL_IDS.has(id))
  };
}

/**
 * The loadout keys the *vanilla record itself* backs, and nothing else.
 *
 * `placeholderLoadoutFrom` above answers all five keys unconditionally, which
 * meant the adapter's answer always won over `roster.normaliseCombatant`'s own
 * default — including in the two places where the two disagree in opposite
 * directions. `canUseSpell`/`canHeal` default to `stats.magicka > 0` in the
 * roster, so a gladiator with 20 magicka and an empty inventory came out
 * unable to cast, and one with 0 magicka holding a scroll came out able to.
 * That is the adapter deciding combat on the read side, which the write-shape
 * argument never covered.
 *
 * So the conversion emits a key only where a named vanilla field carries the
 * answer, and stays silent otherwise:
 *
 * | key | vanilla evidence | absent ⇒ |
 * | --- | --- | --- |
 * | `meleeDamage` | `min_damage` | omitted; the roster's default stands |
 * | `rangedDamage` | `secondary_min_damage` **only** — falling back to `min_damage` silently equated ranged with melee for every gladiator without a second weapon | omitted |
 * | `canUseRanged` | `using_bow` or `maximum_ammo` | omitted |
 * | `canUseSpell` | none: the inventory id sets are the adapter's own decision labels, not a vanilla field | **always** omitted |
 * | `canHeal` | none, likewise | **always** omitted |
 *
 * The `min_damage`-as-melee-base reading is still an assumption of the
 * placeholder vocabulary; what changes is that an assumption the vanilla
 * record cannot support is no longer stated at all. A caller that wants the
 * whole placeholder bridge passes it explicitly as `options.loadout`.
 */
function vanillaBackedLoadout(fields) {
  const loadout = {};
  const omitted = [];
  if (Number.isFinite(Number(fields.min_damage))) loadout.meleeDamage = Number(fields.min_damage);
  else omitted.push("meleeDamage");
  if (Number.isFinite(Number(fields.secondary_min_damage))) loadout.rangedDamage = Number(fields.secondary_min_damage);
  else omitted.push("rangedDamage");
  if (typeof fields.using_bow === "boolean" || Number.isFinite(Number(fields.maximum_ammo))) {
    loadout.canUseRanged = fields.using_bow === true || Number(fields.maximum_ammo ?? 0) > 0;
  } else {
    omitted.push("canUseRanged");
  }
  omitted.push("canUseSpell", "canHeal");
  return { loadout, omitted: Object.freeze(omitted) };
}

/** Every vanilla status flag currently true, in the byte-verified death order. */
export function canonicalStatusesFrom(fields) {
  return DEATH_STATUS_CLEAR_ORDER.filter((flag) => fields[flag] === true);
}

/** The numeric reading of one resource-backed vanilla field. */
function vanillaResourceValue(fields, name) {
  const raw = fields?.[name];
  if (raw === undefined) return 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

/**
 * The canonical resource bag for one vanilla combat object.
 *
 * **No bound is declared, and that is a boundary decision rather than an
 * oversight.** `min` and `max` are a rail the *blueprint* asserts, and the
 * adapter has no evidence for one: saying `armourclass` has a floor of zero is
 * saying what happens when damage exceeds armour, which is exactly the
 * armour-first split the map records as a formula — rule-set work. So the
 * adapter declares `{ min: null, max: null }`, which also guarantees the value
 * round-trips untouched: `normaliseResourceBag` clamps on the way in, and a
 * clamp here would be the adapter quietly rewriting a vanilla field.
 *
 * Absent fields are materialised to 0, the same normalisation the six
 * undefined-until-set status flags get; `absentResourceSources` records which
 * ones, so "never written" stays distinguishable from "explicitly zero".
 */
export function canonicalResourcesFrom(fields) {
  const resources = {};
  for (const name of CANONICAL_RESOURCE_SOURCES) {
    resources[name] = { value: vanillaResourceValue(fields, name), min: null, max: null };
  }
  return resources;
}

/** Resource-backed fields the combat object carries no finite number for. */
export function absentResourceSources(fields) {
  return CANONICAL_RESOURCE_SOURCES.filter((name) => !Number.isFinite(Number(fields?.[name])));
}

/**
 * Builds the combatant *source* `src/team/roster.js` consumes.
 *
 * Every converted combatant declares the **same** canonical resource names, on
 * whichever side of the vanilla binding it lands. That is not tidiness: the
 * hero/villain surface is a binding rebound per action, not a roster, so any
 * combatant can be `game_attacker` on one action and `game_defender` on the
 * next, and the resolver refuses a write to a resource that combatant did not
 * declare. Declaring the set on one side only would mean a rule set's armour
 * write succeeded or threw depending on whose turn it was.
 *
 * The returned `vanilla` record remains the authoritative carrier for
 * everything neither the canonical shape nor the resource bag has room for
 * (equipment ids, the chance cache, the inventory — and, on its `clip`, the
 * timed spell counters, which the build keeps on the fighter clip; "the timed
 * spell fields" in this list meant the combat object's until 2026-09-22).
 * See `docs/ss2-adapter-contract.md` for the canonical-shape gaps left.
 */
/**
 * Validates a caller-supplied resource bag for `toCanonicalCombatantSource`.
 *
 * Two rules, and both exist to stop the opt-in becoming a hole:
 *
 * 1. **Every name must be a field the battle map already cites.** The bag is
 *    hashed and replayed, so a name nobody can point at a vanilla field for
 *    would put an invented quantity into combat state that no peer, capture or
 *    document could ever check. `citationFor` is the same gate
 *    `CANONICAL_RESOURCE_SOURCES` itself passes in `ss2-adapter.test.js`.
 * 2. **Every value must be a finite number.** The bag is numeric; anything
 *    needing structure is the rule set's own static configuration.
 */
function assertSuppliedResources(resources, id) {
  if (!isPlainVanillaObject(resources)) {
    throw new AdapterStateError(
      `Combatant ${id}: \`resources\` must be a plain object of vanilla field names to finite numbers.`
    );
  }
  for (const [name, value] of Object.entries(resources)) {
    if (!citationFor(name)) {
      throw new AdapterStateError(
        `Combatant ${id} declares resource ${name}, which no battle-map section cites. The resource bag is ` +
        "hashed and replayed, so a name with no vanilla field behind it would put an unverifiable quantity " +
        "into combat state. Name a field the map records, or keep it in the rule set's own configuration."
      );
    }
    if (!Number.isFinite(value)) {
      throw new AdapterStateError(
        `Combatant ${id} declares resource ${name} as ${String(value)}; the bag carries finite numbers only.`
      );
    }
  }
  return resources;
}

export function toCanonicalCombatantSource(source, {
  id,
  name,
  teamId = null,
  controller,
  clip = null,
  loadout = null,
  resources = null
} = {}) {
  const record = normaliseVanillaCombatant(source, { clip });
  const { fields } = record;
  if (typeof id !== "string" || id.length === 0) {
    throw new AdapterStateError("A canonical combatant source needs an explicit combatant id.");
  }
  const stats = {};
  for (const [canonical, vanilla] of Object.entries(CANONICAL_STAT_SOURCES)) {
    const raw = Number(fields[vanilla]);
    if (!Number.isFinite(raw)) {
      // The adapter converts vanilla state; it does not invent it. Reading an
      // absent `defence` as 0 (or as 5, or as anything) is the adapter picking
      // a combat input, and the choice is invisible afterwards — canonical
      // state carries no record that the number was made up. A combat object
      // the map's "Base stats" row describes always carries all seven.
      throw new AdapterStateError(
        `The vanilla combat object for ${id} carries no ${vanilla}, so canonical ${canonical} cannot be read. ` +
        "The adapter converts base stats, it does not default them: supply the field, or build the combatant " +
        "from a blueprint rather than from a vanilla record."
      );
    }
    stats[canonical] = raw;
  }
  const backed = vanillaBackedLoadout(fields);
  const combatant = {
    id,
    name: name ?? (typeof fields.character_name === "string" ? fields.character_name : id),
    stats,
    // Only the keys a named vanilla field answers. See `vanillaBackedLoadout`:
    // everything else is left to `roster.normaliseCombatant`'s own defaults
    // rather than overridden by an assumption the record cannot support. A
    // caller that wants the full placeholder bridge passes it in.
    loadout: loadout === null ? backed.loadout : { ...loadout },
    // The one open, hashed, resolver-clamped numeric bag. Declared on every
    // combatant so either side of the per-action binding can be written.
    //
    // **`resources` is an OPT-IN override, added 2026-09-07, and the default
    // is deliberately unchanged.** `canonicalResourcesFrom` reads the closed
    // `CANONICAL_RESOURCE_SOURCES` list, which is 20 names — and
    // `ss2TeamRules` declares 32, so a SUPPLIED gladiator could not be driven
    // by the map-derived rule set at all: it reached its first swing and was
    // refused for a `min_damage`/`max_damage` it had no way to carry. (An
    // AI-filled slot never had the problem; its bag comes from
    // `team.aiFill.resources` and bypasses this list entirely.)
    //
    // Widening `CANONICAL_RESOURCE_SOURCES` was the obvious fix and is the
    // wrong one: that constant IS this path's projected bag, `combatStateHash`
    // covers the projection, so growing it re-hashes EVERY adapter-built
    // battle for every peer — and the owner's 2026-09-07 decision was to pin
    // the shape rather than carry a version id, so an old peer cannot tell
    // "different code" from state divergence. An override makes the hash move
    // OPT-IN, paid only by a caller that asks for a wider bag. It follows the
    // `loadout` override two lines above, which has worked this way all along.
    //
    // Nothing here decides combat: the bag is copied verbatim, with no
    // formula, no roll and no arithmetic.
    resources: resources === null
      ? canonicalResourcesFrom(fields)
      : { ...assertSuppliedResources(resources, id) },
    maxHealth: Number(fields.hitpointsmax ?? 0),
    health: Number(fields.hitpoints ?? 0),
    // The gladiator's true starting conditions. `roster.normaliseCombatant`
    // used to hard-code `status: []` and drop this; `normaliseStatus` now
    // carries it through, so a fighter who enters already burning still is.
    status: canonicalStatusesFrom(fields)
  };
  if (teamId !== null) combatant.teamId = teamId;
  if (controller !== undefined) combatant.controller = controller;
  return Object.freeze({
    combatant: Object.freeze(combatant),
    vanilla: record,
    /** Resource-backed fields this combat object never carried; read as 0. */
    defaultedResources: Object.freeze(absentResourceSources(fields)),
    /**
     * Loadout keys the vanilla record could not answer, so the roster's own
     * default decides them. Empty only when the caller supplied a `loadout`.
     */
    omittedLoadoutKeys: loadout === null ? backed.omitted : Object.freeze([])
  });
}

/**
 * The vanilla starting statuses as declarative effects, ordered.
 *
 * **Do not apply these to a battle built from these same sources.** They exist
 * from when `roster.normaliseCombatant` hard-coded `status: []` and dropped
 * `source.status`, so a caller had to reapply them by hand. `normaliseStatus`
 * carries them through now, so the roster has already applied them: this is a
 * description of the starting state, useful for diagnostics and for a caller
 * building a battle some other way, and applying it on top of a roster-built
 * battle would set a status the fighter already has.
 */
export function initialStatusEffects(sources) {
  return sources.flatMap(({ combatant }) =>
    combatant.status.map((status) => ({
      kind: EffectKind.STATUS,
      targetId: combatant.id,
      status,
      active: true
    }))
  );
}

/**
 * Diagnostic only. Reports whether the injected rule set's derived maximum
 * health agrees with the vanilla `hitpointsmax` the adapter read. It never
 * corrects either value: `hitpointsmax` comes from `battlevalues` (map,
 * "Combatant state objects"), which is a formula and therefore rule-set work.
 *
 * **`maxHealth` is blanked deliberately**, so the rule set has to DERIVE the
 * number rather than hand back the one the adapter just read. Comparing a
 * value with itself would report agreement always, which is the one answer
 * this diagnostic must never be able to give.
 *
 * ► **AND A DIAGNOSTIC MUST NOT BE ABLE TO REFUSE A BATTLE (fixed 2026-09-07).**
 * Blanking `maxHealth` means a rule set that derives from a resource the
 * canonical bag does not carry cannot answer at all — and it says so by
 * throwing. This function used to let that throw escape, and
 * `battle-host.js` calls it once per combatant in its constructor, so the
 * throw aborted construction. Measured that day: `createVanillaBattleHost`
 * with `ss2TeamRules` and a SUPPLIED gladiator died here, at
 * `ss2-rules.js`'s `maximumHealth` reaching for a `herolevel` resource that
 * `CANONICAL_RESOURCE_SOURCES` does not carry — while the battle underneath
 * was fine, because the roster had already normalised `maxHealth` from
 * `hitpointsmax` and never needed the derivation.
 *
 * So a rule set that cannot derive is now REPORTED, in `underivable`, and
 * `agrees` is false because an underivable formula agrees with nothing. That
 * is a real finding about the seam — it says the canonical bag is too narrow
 * for this rule set — and a finding belongs in `diagnostics`, not in a throw
 * that stops a host being built at all.
 */
export function compareMaximumHealth(rules, canonicalSource, vanillaRecord) {
  const vanilla = Number(vanillaRecord.fields.hitpointsmax ?? 0);
  let derived = null;
  let underivable = null;
  try {
    derived = rules.maximumHealth({ ...canonicalSource, maxHealth: undefined });
  } catch (error) {
    // Only the rule set's refusal to derive is caught. Nothing here decides a
    // number: `ruleSetDerived` stays null rather than falling back to the
    // vanilla value, because reporting vanilla's own figure as the rule set's
    // answer is exactly the self-confirming comparison the blanking prevents.
    underivable = error?.message ?? String(error);
  }
  return Object.freeze({
    combatantId: canonicalSource.id,
    ruleSetDerived: derived,
    vanillaHitpointsMax: vanilla,
    // `underivable === null &&` is a GUARD, and it SURVIVES MUTATION — said
    // here rather than left as an untested branch. It is unreachable today
    // because `derived` stays null on the catch path and `vanilla` is always a
    // number, so `derived === vanilla` is already false. It is kept because it
    // is what stops the one dangerous composite edit: anyone who later makes
    // the catch path fall back to `vanilla` (to "fill in" the null) would
    // otherwise turn every underivable rule set into `agrees: true` — the
    // self-confirming answer the blanking above exists to prevent. Delete this
    // clause only together with that fallback, never on its own.
    agrees: underivable === null && derived === vanilla,
    underivable
  });
}

/* ------------------------------------------------------------------ */
/* Canonical -> vanilla                                                */
/* ------------------------------------------------------------------ */

/**
 * Mirrors resolved canonical state onto a vanilla record. Pure: it returns a
 * new record and copies values, never computing one.
 *
 * It writes **all six** status flags unconditionally, so the returned record
 * reports `materialisedFlags: []` — after this, nothing is absent any more.
 * That is only true of a record whose writes were actually applied to the live
 * combat object, so a caller that syncs canonical state onto a mirror it has
 * not flushed has thrown away the undefined-until-set provenance. Prefer
 * `mirrorDifferences` first and skip the sync when the mirror already agrees.
 */
export function toVanillaCombatant(canonical, record, { maxHealth = false, stats = false } = {}) {
  assertVanillaRecord(record);
  const fields = { ...record.fields };
  fields[CANONICAL_HEALTH_SOURCES.health] = canonical.health;
  // `hitpointsmax` is NOT written by default, and the default is the whole
  // point: `compareMaximumHealth` says it only ever reports, because
  // `hitpointsmax` comes from vanilla's `battlevalues` and deriving it is a
  // formula. Writing canonical `maxHealth` over it would put the *rule set's*
  // formula into a licensed gladiator's record.
  //
  // `maxHealth: true` is for the one record where that reasoning does not
  // apply: an AI-filled slot's mirror, where there is no licensed gladiator to
  // overwrite — the roster invented the fighter and its maximum health, and
  // the mirror's job is to describe *that* fighter. `battle-host.js` passes it
  // there and refuses the disagreement everywhere else.
  if (maxHealth) fields[CANONICAL_HEALTH_SOURCES.maxHealth] = canonical.maxHealth;
  // Base stats, likewise: mirrored only for a combatant the roster invented,
  // where the template's numbers describe a different gladiator from the one
  // that is actually fighting.
  if (stats && canonical.stats) {
    for (const [canonicalName, vanillaName] of Object.entries(CANONICAL_STAT_SOURCES)) {
      if (canonical.stats[canonicalName] === undefined) continue;
      fields[vanillaName] = canonical.stats[canonicalName];
    }
  }
  const active = new Set(canonical.status ?? []);
  for (const flag of STATUS_FLAG_FIELDS) fields[flag] = active.has(flag);
  // Resources, unlike the status flags, are written only where they actually
  // differ. Writing every declared resource unconditionally would *create* a
  // field on a combat object that never carried one — inventing vanilla state
  // rather than mirroring it — for every resource the object left absent.
  for (const [name, entry] of Object.entries(canonical.resources ?? {})) {
    if (!mirrorsToVanillaField(name)) continue;
    if (vanillaResourceValue(fields, name) === entry.value) continue;
    fields[name] = entry.value;
  }
  return Object.freeze({
    fields,
    clip: Object.freeze({ ...record.clip }),
    materialisedFlags: Object.freeze([]),
    facingSource: record.facingSource,
    misplacedClipFields: record.misplacedClipFields,
    unknownFields: record.unknownFields
  });
}

/**
 * Every place a vanilla record disagrees with resolved canonical state, as
 * human-readable strings. Empty means the mirror is in step.
 *
 * The fields compared are the ones the adapter owns: `hitpoints`,
 * `hitpointsmax`, the six status flags, and — since the canonical resource bag
 * exists — every declared resource the vanilla build has a field for. Armour,
 * stamina, ammunition and charisma used to have no canonical counterpart to
 * disagree with, so a mirror that was wrong about 44 points of armour reported
 * itself in perfect step. It no longer can.
 *
 * A resource the build has no field for is skipped rather than reported: a
 * rule set may invent a resource, and the adapter will not invent a vanilla
 * field to hold it (the same rule `emitStatus` applies to statuses). A timed
 * counter is skipped too (2026-09-22): the build's field for it is on the
 * fighter clip, which no write reaches, so a difference here could never be
 * brought into step and would only make `assertMirrorAgrees` refuse a battle.
 */
export function mirrorDifferences(record, canonical, { includeStats = false } = {}) {
  assertVanillaRecord(record);
  const problems = [];
  if (record.fields.hitpoints !== canonical.health) {
    problems.push(`hitpoints ${String(record.fields.hitpoints)} != health ${String(canonical.health)}`);
  }
  if (record.fields.hitpointsmax !== canonical.maxHealth) {
    problems.push(`hitpointsmax ${String(record.fields.hitpointsmax)} != maxHealth ${String(canonical.maxHealth)}`);
  }
  if (includeStats && canonical.stats) {
    for (const [canonicalName, vanillaName] of Object.entries(CANONICAL_STAT_SOURCES)) {
      if (canonical.stats[canonicalName] === undefined) continue;
      if (Number(record.fields[vanillaName]) === Number(canonical.stats[canonicalName])) continue;
      problems.push(
        `${vanillaName} ${String(record.fields[vanillaName])} != ${canonicalName} ${String(canonical.stats[canonicalName])}`
      );
    }
  }
  const active = new Set(canonical.status ?? []);
  for (const flag of STATUS_FLAG_FIELDS) {
    const mirrored = record.fields[flag] === true;
    if (mirrored !== active.has(flag)) problems.push(`${flag} ${String(record.fields[flag])} != canonical ${active.has(flag)}`);
  }
  for (const [name, entry] of Object.entries(canonical.resources ?? {})) {
    if (!mirrorsToVanillaField(name)) continue;
    // An absent field reads as 0, exactly as an unwritten status flag reads as
    // false: a resource nothing has written yet must not look like drift.
    const mirrored = vanillaResourceValue(record.fields, name);
    if (mirrored !== entry.value) {
      problems.push(`${name} ${String(record.fields[name])} != resource ${String(entry.value)}`);
    }
  }
  return problems;
}

/**
 * The vanilla fields the placeholder loadout bridge reads, and where a record
 * disagrees with the canonical loadout the roster actually built.
 *
 * `mirrorDifferences` cannot cover these: a rule set's `meleeDamage` is one
 * number and vanilla's is a `min_damage`/`max_damage` pair, so there is no
 * write that would reconcile them without inventing the other half. They are
 * *reported* instead — which is the whole point for an AI-filled slot, whose
 * mirror is a template describing some other gladiator's weapon.
 */
export const LOADOUT_SOURCE_FIELDS = Object.freeze([
  "min_damage",
  "secondary_min_damage",
  "using_bow",
  "maximum_ammo",
  ...INVENTORY_SLOTS
]);

export function loadoutMirrorDifferences(record, canonical) {
  assertVanillaRecord(record);
  const problems = [];
  const loadout = canonical.loadout ?? {};
  const compare = (field, key) => {
    if (loadout[key] === undefined) return;
    if (record.fields[field] === undefined) return;
    if (Number(record.fields[field]) === Number(loadout[key])) return;
    problems.push(`${field} ${String(record.fields[field])} != loadout.${key} ${String(loadout[key])}`);
  };
  compare("min_damage", "meleeDamage");
  compare("secondary_min_damage", "rangedDamage");
  if (loadout.canUseRanged !== undefined) {
    const mirrored = record.fields.using_bow === true || Number(record.fields.maximum_ammo ?? 0) > 0;
    if (mirrored !== loadout.canUseRanged) {
      problems.push(`using_bow/maximum_ammo imply canUseRanged ${mirrored} != loadout.canUseRanged ${loadout.canUseRanged}`);
    }
  }
  return problems;
}

/**
 * Fails loudly when a vanilla record has drifted away from resolved canonical
 * state. Drift is a bug in whoever applied the writes, and silently correcting
 * it would hide a desync between the mirror and the authoritative resolver.
 */
export function assertMirrorAgrees(record, canonical, options = {}) {
  const problems = mirrorDifferences(record, canonical, options);
  if (problems.length > 0) {
    throw new AdapterStateError(
      `The vanilla mirror for ${canonical.id} has drifted from resolved state: ${problems.join("; ")}.`
    );
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Effects -> vanilla field writes                                     */
/* ------------------------------------------------------------------ */

export const WriteTarget = Object.freeze({
  COMBAT_OBJECT: "combat-object",
  FIGHTER_CLIP: "fighter-clip",
  /** `_global`, the one object no combatant owns. Added 2026-09-23 for the crowd. */
  GLOBAL: "global"
});

/** The path every `WriteTarget.GLOBAL` write carries: the build's own object. */
export const GLOBAL_OBJECT_PATH = "_global";

function indexById(combatants) {
  if (!Array.isArray(combatants)) throw new AdapterStateError("Combatant projections must be an array.");
  return new Map(combatants.map((combatant) => [combatant.id, combatant]));
}

/**
 * The SHAPE half of the write check: the source is one of the ~~four~~ six,
 * the field is in that source's fixed set, and the target is that source's
 * object.
 * `fieldWrite` runs it on every write it builds and `assertWriteProvenance` on
 * every write it is handed, however that write was built.
 *
 * ► **Split out of `fieldWrite` 2026-09-22.** `assertWriteProvenance` checked
 *   only the VALUE, so a hand-built declared-resource write of
 *   `spell_regenerate` on the combat object — a field the build never reads
 *   there — passed it whenever the value matched the projection. And the
 *   refusal `fieldWrite` gave named "a timed spell_* pool" as ALLOWED; it now
 *   names where the build keeps the counter instead.
 */
function assertWriteShape({ source, field, target }) {
  if (!WRITE_SOURCES.includes(source)) {
    throw new AdapterStateError(
      `A vanilla field write must declare one of the ${WRITE_SOURCES.length} write sources ` +
      `(${WRITE_SOURCES.join(", ")}); the write to ${String(field)} declared ${JSON.stringify(source)}. ` +
      "A write with no declared source is a write with no evidence that the resolver produced its value."
    );
  }
  if (!ALLOWED_WRITE_FIELDS[source].includes(field)) {
    throw new AdapterStateError(
      `The write source ${source} may not write the vanilla field ${String(field)}. ` +
      `Allowed: ${ALLOWED_WRITE_FIELDS[source].join(", ")}.` +
      (isTimedSpellField(field) ? ` ${timedCounterPlacement(field)}.` : "")
    );
  }
  if (target !== WRITE_SOURCE_TARGETS[source]) {
    throw new AdapterStateError(
      `The write source ${source} writes the ${WRITE_SOURCE_TARGETS[source]}, not the ${String(target)}.`
    );
  }
}

/**
 * Builds one vanilla field write, refusing any that the closed source
 * vocabulary cannot account for.
 *
 * `source` is mandatory. It is not documentation: it is what
 * `assertWriteProvenance` uses to decide which canonical value this write is
 * required to be identical to, and what pins the field to a set fixed
 * independently of any scenario.
 */
function fieldWrite({ combatantId, placement, field, from, to, reason, source, target = WriteTarget.COMBAT_OBJECT }) {
  assertWriteShape({ source, field, target });
  return Object.freeze({
    target,
    source,
    combatantId,
    side: placement?.side ?? null,
    slotIndex: placement?.slotIndex ?? null,
    path: target === WriteTarget.GLOBAL
      ? GLOBAL_OBJECT_PATH
      : target === WriteTarget.FIGHTER_CLIP
        ? (placement?.instancePath ?? null)
        : (placement?.stateObjectPath ?? null),
    field,
    from,
    to,
    // `from === undefined` means the field did not exist before this write:
    // the six status flags are undefined until something sets them, and a
    // resource-backed field can be absent too, so the first write *creates* it.
    materialises: from === undefined,
    reason
  });
}

/**
 * **The structural check behind "the adapter decides no combat."**
 *
 * For every write, the source names exactly one place in the post-action
 * projection the value has to have come from, and the value has to be `===`
 * what is there. Not "close to", not "derivable from" — identical to a value
 * the resolver produced and clamped.
 *
 * That is what a prose rule could never give. `to: before - effect.amount`
 * reads plausibly and passes review; a value computed anywhere in this module
 * has no canonical location to be identical to, so it fails here by
 * construction. The same check catches a write pushed straight onto the list
 * without going through `fieldWrite`, because it walks the writes rather than
 * trusting how they were built.
 *
 * `clip-facing` is the one source with no canonical counterpart — the facing
 * is presentation, not combat state — so it is checked against the closed
 * `FACING_VALUES` vocabulary instead.
 *
 * `declared-battle-resource` (2026-09-23) is the one source whose canonical
 * location is not a combatant's: it must name no combatant and be `===` the
 * post-action wire's `battleResources[field].value`, so a caller checking one
 * passes those pools as `battleResources`. Without them, such a write is
 * refused — there is nothing it could be identical to.
 *
 * @param {object[]} writes
 * @param {object[]|Map} after the post-action combatant projections
 * @param {object} [options.battleResources] the post-action wire's `battleResources`
 */
export function assertWriteProvenance(writes, after, { battleResources = null } = {}) {
  const afterById = after instanceof Map ? after : indexById(after);
  for (const write of writes) {
    // The shape first, so a write that could never be legal is refused for
    // what it is rather than for a value it happens to match (2026-09-22).
    assertWriteShape(write);
    if (write.source === WriteSource.DECLARED_BATTLE_RESOURCE) {
      const where = `${GLOBAL_OBJECT_PATH}.${String(write.field)}`;
      if (write.combatantId !== null) {
        throw new AdapterStateError(
          `The declared-battle-resource write to ${where} names combatant ${String(write.combatantId)}; ` +
          "a battle's own pool belongs to no combatant."
        );
      }
      const entry = battleResources?.[write.field];
      if (entry === undefined) {
        throw new AdapterStateError(
          `The declared-battle-resource write to ${where} names a pool the resolved battle does not declare.`
        );
      }
      if (write.to !== entry.value) {
        throw new AdapterStateError(
          `The ${write.source} write to ${where} carries ${JSON.stringify(write.to)}, but the resolved battle ` +
          `holds ${JSON.stringify(entry.value)}. A vanilla write must be identical to a value the resolver ` +
          "produced; a computed one is a second place combat is being decided."
        );
      }
      continue;
    }
    const projection = afterById.get(write.combatantId);
    const where = `${String(write.combatantId)}.${String(write.field)}`;
    if (write.source === WriteSource.CLIP_FACING) {
      if (!FACING_VALUES.includes(write.to)) {
        throw new AdapterStateError(
          `The clip-facing write for ${where} carries ${JSON.stringify(write.to)}, which is not a facing.`
        );
      }
      continue;
    }
    if (!projection) {
      throw new AdapterStateError(
        `The write to ${where} names combatant ${String(write.combatantId)}, who has no resolved projection. ` +
        "Every write must mirror a value the resolver produced."
      );
    }
    let expected;
    if (write.source === WriteSource.CANONICAL_HEALTH) {
      expected = projection.health;
    } else if (write.source === WriteSource.CANONICAL_STATUS) {
      expected = (projection.status ?? []).includes(write.field);
    } else if (write.source === WriteSource.DECLARED_RESOURCE) {
      const entry = projection.resources?.[write.field];
      if (entry === undefined) {
        throw new AdapterStateError(
          `The declared-resource write to ${where} names a resource the resolved projection does not declare.`
        );
      }
      expected = entry.value;
    } else if (write.source === WriteSource.CANONICAL_STAT) {
      // The field names its canonical stat through the one-to-one mapping, and
      // the value must be that stat's post-action value — never the backup it
      // was computed from, never the build's formula re-run here.
      const stat = STAT_FOR_VANILLA_FIELD[write.field];
      const value = projection.stats?.[stat];
      if (value === undefined) {
        throw new AdapterStateError(
          `The canonical-stat write to ${where} names stat ${String(stat)}, which the resolved projection does not carry.`
        );
      }
      expected = value;
    } else {
      throw new AdapterStateError(`The write to ${where} declares no known write source.`);
    }
    if (write.to !== expected) {
      throw new AdapterStateError(
        `The ${write.source} write to ${where} carries ${JSON.stringify(write.to)}, but the resolved projection ` +
        `holds ${JSON.stringify(expected)}. A vanilla write must be identical to a value the resolver produced; ` +
        "a computed one is a second place combat is being decided."
      );
    }
  }
  return true;
}

/**
 * Converts one resolved action's effects into ordered vanilla field writes.
 *
 * The write values come from `after` — the canonical state the resolver
 * produced, clamped by the resolver — not from `effect.amount` and not from a
 * resource effect's `effect.to`. The effect list only supplies the *ordering*
 * and the *reason*. This is the whole point: the adapter can misattribute a
 * reason, but it structurally cannot produce a combat value the resolver did
 * not already decide.
 *
 * ~~Three~~ **Five** kinds of field are written: `hitpoints` from canonical
 * health, the six status flags from canonical status, one vanilla field per
 * canonical **resource** — which is how `armourclass`, `staminaleft`,
 * `ammo_left` and the armour piece ratings are written — and, since
 * 2026-09-23, a base-stat field per moved canonical **stat** and a `_global`
 * field per moved **battle pool** (the crowd). An armour-first split arrives
 * as two ordered effects (`resource` then `damage`) and leaves as two ordered
 * writes; the adapter never performs the subtraction that decided them.
 *
 * @param {object[]} params.before combatant projections before `applyAction`
 * @param {object[]} params.after  combatant projections after `applyAction`
 * @param {object[]} [params.effects] the rule set's declarative effects, in order
 * @param {Map|object} [params.placements] combatant id -> slot placement
 * @param {Map|object} [params.mirrors] combatant id -> normalised vanilla record
 * @param {object} [params.battleBefore] the wire's `battleResources` before the action, if any
 * @param {object} [params.battleAfter]  the wire's `battleResources` after it, if any
 * @param {object} [params.globals] the `_global` mirror (`vanillaGlobalsFrom`), for each write's `from`
 */
export function vanillaWritesForResolvedAction({
  before,
  after,
  effects = [],
  placements = new Map(),
  mirrors = new Map(),
  battleBefore = null,
  battleAfter = null,
  globals = null
} = {}) {
  const beforeById = indexById(before);
  const afterById = indexById(after);
  const placementFor = (id) => (placements instanceof Map ? placements.get(id) : placements?.[id]) ?? null;
  const mirrorFor = (id) => (mirrors instanceof Map ? mirrors.get(id) : mirrors?.[id]) ?? null;

  const writes = [];
  const unmapped = [];
  const emitted = new Set();

  const emitHealth = (id, reason) => {
    const key = `${id}:hitpoints`;
    if (emitted.has(key)) return;
    const previous = beforeById.get(id);
    const current = afterById.get(id);
    if (!current) throw new AdapterStateError(`No resolved state for combatant ${String(id)}.`);
    if (previous && previous.health === current.health) return;
    emitted.add(key);
    const mirror = mirrorFor(id);
    writes.push(fieldWrite({
      combatantId: id,
      placement: placementFor(id),
      field: "hitpoints",
      from: mirror ? mirror.fields.hitpoints : previous?.health,
      // The value the resolver produced and clamped. Never `previous.health -
      // effect.amount`: the adapter mirrors, it does not compute, and
      // `assertWriteProvenance` refuses anything that is not `after.health`.
      to: current.health,
      reason,
      source: WriteSource.CANONICAL_HEALTH
    }));
  };

  /**
   * The resource branch. `armourclass`, `staminaleft`, `ammo_left` and the
   * armour piece ratings reach vanilla through here and nowhere else.
   *
   * The value written is `after`'s resource value — the absolute value the
   * rule set asked for, already clamped to the declared bounds by the
   * resolver. It is never `before - effect.amount`, and it is never
   * `effect.to`: reading the post-action projection is what makes it
   * structurally impossible for the adapter to write a number the resolver did
   * not produce, and a rule set's `to` that the resolver clamped must land on
   * the clamped value, not the requested one.
   */
  const emitResource = (id, resource, reason) => {
    const key = `${id}:resource:${resource}`;
    if (emitted.has(key)) return;
    const current = afterById.get(id);
    if (!current) throw new AdapterStateError(`No resolved state for combatant ${String(id)}.`);
    const entry = current.resources?.[resource];
    if (entry === undefined) {
      // The resolver refuses a write to an undeclared resource, so this should
      // be unreachable through `applyAction`. It is reported rather than
      // assumed away, because the same function serves hand-built projections.
      emitted.add(key);
      unmapped.push(Object.freeze({
        combatantId: id,
        resource,
        reason: "the resolved projection declares no such resource"
      }));
      return;
    }
    const previous = beforeById.get(id)?.resources?.[resource];
    // Checked before the vanilla-field test so the totality pass, which walks
    // every declared resource on every combatant, stays silent about the ones
    // nothing moved.
    if (previous !== undefined && previous.value === entry.value) return;
    if (!mirrorsToVanillaField(resource)) {
      // The adapter will not invent a vanilla field for a resource the build
      // does not have, exactly as it will not for an unmapped status — nor
      // will it let a resource borrow a field canonical health, canonical
      // status or the clip record already owns.
      emitted.add(key);
      unmapped.push(Object.freeze({
        combatantId: id,
        resource,
        reason: unmappedResourceReason(resource)
      }));
      return;
    }
    emitted.add(key);
    const mirror = mirrorFor(id);
    writes.push(fieldWrite({
      combatantId: id,
      placement: placementFor(id),
      field: resource,
      // A resource-backed field can be absent on the live combat object just
      // as a status flag can, so the first write to one *materialises* it.
      from: mirror ? mirror.fields[resource] : previous?.value,
      to: entry.value,
      reason,
      source: WriteSource.DECLARED_RESOURCE
    }));
  };

  const emitStatus = (id, status, active, reason) => {
    const key = `${id}:${status}`;
    if (emitted.has(key)) return;
    // ► **FACING IS A STATUS WITH A REAL VANILLA FIELD, and it is the one
    //   status that does NOT live in `STATUS_FLAG_FIELDS`. Wired 2026-09-12.**
    //
    //   The rule set now recomputes facing from position on every move, as the
    //   build's `changeCombatants` does at every phase advance, and carries it
    //   on the canonical status list as `SS2_FACING_LEFT` — which is how this
    //   engine has always spelled `gladiator_dir` (`ss2-rules.js` in at
    //   `:2389`, out at `:2590`).
    //
    //   Without this arm it fell to the branch below and was reported as "no
    //   vanilla flag carries this status", which is FALSE: `gladiator_dir` is
    //   exactly the flag that carries it. It is simply not in
    //   `STATUS_FLAG_FIELDS` because it is CLIP-RESIDENT — the map is explicit
    //   that the persistent combat objects do not hold it and the fighter
    //   clips do (`CLIP_RESIDENT_FIELDS`), so it needs a different WRITE
    //   TARGET rather than a different concept. `facingWrite` already built
    //   that write and nothing was calling it on this path.
    if (status === CANONICAL_FACING_LEFT) {
      emitted.add(key);
      const mirror = mirrorFor(id);
      if (!mirror) return;
      const to = active ? "left" : "right";
      if (mirror.clip?.gladiator_dir === to) return;
      writes.push(facingWrite(id, placementFor(id), mirror, to));
      return;
    }
    if (!isStatusFlagField(status)) {
      // The adapter will not invent a vanilla field for a status the build
      // does not have. It is reported once, not guessed at.
      emitted.add(key);
      unmapped.push(Object.freeze({ combatantId: id, status, reason: "no vanilla flag carries this status" }));
      return;
    }
    emitted.add(key);
    const mirror = mirrorFor(id);
    // The live vanilla object still holds `undefined` for any flag the
    // normalisation had to materialise, so the first write to one *creates*
    // the field. `from: undefined` records that, and `materialises` reports it.
    const from = mirror
      ? (mirror.materialisedFlags.includes(status) ? undefined : mirror.fields[status])
      : (beforeById.get(id)?.status ?? []).includes(status);
    writes.push(fieldWrite({
      combatantId: id,
      placement: placementFor(id),
      field: status,
      from,
      to: active,
      reason,
      source: WriteSource.CANONICAL_STATUS
    }));
  };

  /**
   * ► ~~**A BASE STAT THAT MOVED IN BATTLE IS REPORTED, NEVER WRITTEN**~~ —
   *   **WRITTEN since 2026-09-23, the owner's "write both back" (decided
   *   2026-09-22).** Until 2026-09-22 it was neither written nor reported
   *   (found by Codex, reproduced first): `EffectKind.STAT` arrived with SS2's
   *   four stat spells, and this function had no arm for it and no stat term
   *   in its totality pass, so a colossus moved canonical `strength` 9 -> 27
   *   with no write and no report. It was then REPORTED, because the four
   *   sources of the day carried no stat.
   *
   *   **It is written through `WriteSource.CANONICAL_STAT`**, onto the vanilla
   *   field `CANONICAL_STAT_SOURCES` names, with the post-action `stats[stat]`
   *   and nothing else — `assertWriteProvenance` refuses any other number.
   *   **The licensed base stats are not what moves**: the caller's supplied
   *   combat object is copied at normalisation and never written, and the
   *   fight-start values the build restores from are the rule set's
   *   `backup_*`, declared at the opening and never moved mid-battle. Only the
   *   live mirror changes, exactly as the build's own `game_defender.strength`
   *   does (`+0x82df`).
   *
   *   A stat with no vanilla field — a hand-built projection's invention; the
   *   roster builds only the seven — is still REPORTED rather than guessed at.
   */
  const emitStat = (id, stat, reason) => {
    const key = `${id}:stat:${stat}`;
    if (emitted.has(key)) return;
    const current = afterById.get(id);
    if (!current) throw new AdapterStateError(`No resolved state for combatant ${String(id)}.`);
    const previous = beforeById.get(id);
    if (previous && previous.stats?.[stat] === current.stats?.[stat]) return;
    emitted.add(key);
    const field = Object.hasOwn(CANONICAL_STAT_SOURCES, stat) ? CANONICAL_STAT_SOURCES[stat] : null;
    if (field === null) {
      unmapped.push(Object.freeze({
        combatantId: id,
        stat,
        field: null,
        reason: "a stat moved in battle that no vanilla base-stat field carries (CANONICAL_STAT_SOURCES names seven)"
      }));
      return;
    }
    const mirror = mirrorFor(id);
    writes.push(fieldWrite({
      combatantId: id,
      placement: placementFor(id),
      field,
      from: mirror ? mirror.fields[field] : previous?.stats?.[stat],
      // The value the resolver wrote, and never `backup * 3` recomputed here.
      to: current.stats[stat],
      reason,
      source: WriteSource.CANONICAL_STAT
    }));
  };

  /**
   * ► ~~**A BATTLE'S OWN POOL THAT MOVED IS REPORTED, NEVER WRITTEN — the stat
   *   rule above, one scope up (2026-09-22).**~~ **WRITTEN since 2026-09-23,
   *   the owner's "write both back" (decided 2026-09-22).**
   *   `EffectKind.BATTLE_RESOURCE` arrived with SS2's crowd: `crowd_interest`
   *   lives on `_global` in the build, one per bout, and on the battle here.
   *   It was REPORTED because every source of the day named a combatant.
   *
   *   **It is written through `WriteSource.DECLARED_BATTLE_RESOURCE`**, onto
   *   `_global` (`WriteTarget.GLOBAL`), with the post-action wire's
   *   `battleResources[name].value` and nothing else — never `before +
   *   crowd_action` re-added here, which would skip the resolver's 1..100
   *   clamp. A pool the build keeps no global for
   *   (`CANONICAL_BATTLE_RESOURCE_SOURCES`) is still REPORTED.
   */
  const emitBattleResource = (name, reason) => {
    const key = `battle:${name}`;
    if (emitted.has(key)) return;
    const current = battleAfter?.[name];
    if (current === undefined) return;
    const previous = battleBefore?.[name];
    if (previous !== undefined && previous.value === current.value) return;
    emitted.add(key);
    if (!CANONICAL_BATTLE_RESOURCE_SOURCES.includes(name)) {
      unmapped.push(Object.freeze({
        battleResource: name,
        field: name,
        scope: GLOBAL_OBJECT_PATH,
        from: previous?.value ?? null,
        to: current.value,
        reason:
          "a battle-wide pool moved that no vanilla global carries (CANONICAL_BATTLE_RESOURCE_SOURCES names the " +
          "build's _global pools), so the resolved value is reported rather than given an invented global"
      }));
      return;
    }
    writes.push(fieldWrite({
      combatantId: null,
      placement: null,
      field: name,
      from: globals ? globals[name] : previous?.value,
      to: current.value,
      reason,
      source: WriteSource.DECLARED_BATTLE_RESOURCE,
      target: WriteTarget.GLOBAL
    }));
  };

  // 1. Effect order first, so the write order matches the order the rule set
  //    declared its effects in — the same discipline the 1v1 mutation trace
  //    uses.
  for (const effect of effects) {
    if (effect.kind === EffectKind.DAMAGE || effect.kind === EffectKind.HEAL) {
      emitHealth(effect.targetId, `${effect.kind}-effect`);
    } else if (effect.kind === EffectKind.RESOURCE) {
      // An armour-first split is `{ resource: armourclass, to: 0 }` then
      // `{ damage: overflow }`, and the writes come out in that order because
      // the effects did. The split itself is the rule set's, never ours.
      emitResource(effect.targetId, effect.resource, "resource-effect");
    } else if (effect.kind === EffectKind.STATUS) {
      const current = afterById.get(effect.targetId);
      if (!current) throw new AdapterStateError(`No resolved state for combatant ${String(effect.targetId)}.`);
      emitStatus(effect.targetId, effect.status, current.status.includes(effect.status), "status-effect");
    } else if (effect.kind === EffectKind.STAT) {
      emitStat(effect.targetId, effect.stat, "stat-effect");
    } else if (effect.kind === EffectKind.BATTLE_RESOURCE) {
      emitBattleResource(effect.resource, "battle-resource-effect");
    }
  }

  // 2. Then anything else the resolved state changed. Totality: a write is
  //    produced for every canonical difference, attributed or not.
  for (const [id, current] of afterById) {
    emitHealth(id, "resolved-state-diff");
    // Resource bag key order is normalised by `normaliseResourceBag`, so this
    // is a stable order two peers both produce.
    for (const resource of Object.keys(current.resources ?? {})) {
      emitResource(id, resource, "resolved-state-diff");
    }
    for (const stat of Object.keys(current.stats ?? {})) {
      emitStat(id, stat, "resolved-state-diff");
    }
    const previous = beforeById.get(id);
    const was = new Set(previous?.status ?? []);
    const now = new Set(current.status ?? []);
    for (const flag of DEATH_STATUS_CLEAR_ORDER) {
      if (was.has(flag) === now.has(flag)) continue;
      emitStatus(id, flag, now.has(flag), "resolved-state-diff");
    }
    for (const status of [...was, ...now]) {
      if (isStatusFlagField(status)) continue;
      if (was.has(status) === now.has(status)) continue;
      emitStatus(id, status, now.has(status), "resolved-state-diff");
    }
  }
  // And the battle's own pools, which belong to no combatant above.
  for (const name of Object.keys(battleAfter ?? {})) emitBattleResource(name, "resolved-state-diff");

  // 3. The shape check. Every write must be identical to a value the resolved
  //    projection actually holds, at the canonical location its source names.
  //    This runs on the produced list, not on the code that produced it, so it
  //    catches a write that never went through `fieldWrite` too.
  assertWriteProvenance(writes, afterById, { battleResources: battleAfter });

  return Object.freeze({ writes: Object.freeze(writes), unmapped: Object.freeze(unmapped) });
}

/**
 * Applies field writes to a normalised vanilla record. Pure; returns a new record.
 *
 * `materialisedFlags` is carried forward minus the flags these writes actually
 * touched. A write *creates* the flag it writes, so that flag is no longer
 * absent — but a flag nobody wrote is still absent on the live combat object,
 * and forgetting that would make a later first write report `materialises:
 * false` for a field it really does create. Applying a health-only write must
 * not erase the absence of five untouched status flags.
 */
export function applyVanillaWrites(record, writes) {
  assertVanillaRecord(record);
  const fields = { ...record.fields };
  const clip = { ...record.clip };
  const written = new Set();
  for (const write of writes) {
    if (write.target === WriteTarget.GLOBAL) {
      // Refused rather than folded in: `crowd_interest` on a gladiator's
      // combat object is a field the build never reads there (2026-09-23).
      throw new AdapterStateError(
        `The write to ${GLOBAL_OBJECT_PATH}.${String(write.field)} targets _global, not a combatant's record; ` +
        "apply it with applyGlobalWrites."
      );
    }
    if (write.target === WriteTarget.FIGHTER_CLIP) clip[write.field] = write.to;
    else {
      fields[write.field] = write.to;
      written.add(write.field);
    }
  }
  return Object.freeze({
    fields,
    clip: Object.freeze(clip),
    materialisedFlags: Object.freeze(
      (record.materialisedFlags ?? []).filter((flag) => !written.has(flag))
    ),
    facingSource: record.facingSource,
    misplacedClipFields: record.misplacedClipFields,
    unknownFields: record.unknownFields
  });
}

/* ------------------------------------------------------------------ */
/* The `_global` mirror (2026-09-23)                                   */
/* ------------------------------------------------------------------ */

/**
 * The `_global` fields a battle's pools mirror to, as the resolved battle
 * holds them: every `CANONICAL_BATTLE_RESOURCE_SOURCES` name the wire's
 * `battleResources` declares, at its value, and nothing else. Pure; copies.
 *
 * This is how a host brings `_global` into step at construction. The build
 * opens `crowd_interest` itself from the hero's and villain's `herolevel`
 * (`crowd_bar` `+0x011f`-`+0x0158`); the resolved battle opens it from EVERY
 * combatant's (owner's decision (f)), which is the build's own number in 1v1
 * and is the number every later write continues from.
 */
export function vanillaGlobalsFrom(battleResources) {
  const globals = {};
  for (const name of CANONICAL_BATTLE_RESOURCE_SOURCES) {
    const entry = battleResources?.[name];
    if (entry !== undefined) globals[name] = entry.value;
  }
  return Object.freeze(globals);
}

/** Applies `WriteTarget.GLOBAL` writes to a `_global` mirror. Pure; refuses any other target. */
export function applyGlobalWrites(globals, writes) {
  const next = { ...globals };
  for (const write of writes) {
    if (write.target !== WriteTarget.GLOBAL) {
      throw new AdapterStateError(
        `The write to ${String(write.combatantId)}.${String(write.field)} targets the ${String(write.target)}, not _global.`
      );
    }
    next[write.field] = write.to;
  }
  return Object.freeze(next);
}

/**
 * Where a `_global` mirror disagrees with the resolved battle's pools, as
 * human-readable strings; empty means in step. Compares every pool the build
 * keeps a global for, so an unwritten move is drift, not silence.
 */
export function globalMirrorDifferences(globals, battleResources) {
  const problems = [];
  for (const name of CANONICAL_BATTLE_RESOURCE_SOURCES) {
    const entry = battleResources?.[name];
    if (entry === undefined) continue;
    if (globals?.[name] !== entry.value) {
      problems.push(`${GLOBAL_OBJECT_PATH}.${name} ${String(globals?.[name])} != battle resource ${String(entry.value)}`);
    }
  }
  return problems;
}

/** Fails loudly when the `_global` mirror has drifted from the resolved battle. */
export function assertGlobalMirrorAgrees(globals, battleResources) {
  const problems = globalMirrorDifferences(globals, battleResources);
  if (problems.length > 0) {
    throw new AdapterStateError(`The vanilla _global mirror has drifted from resolved state: ${problems.join("; ")}.`);
  }
  return true;
}

/** The one write that ever targets the fighter clip rather than the combat object. */
export function facingWrite(combatantId, placement, record, facing) {
  assertVanillaRecord(record);
  assertFacing(facing, "the caller");
  return fieldWrite({
    combatantId,
    placement,
    field: "gladiator_dir",
    from: record.clip.gladiator_dir,
    to: facing,
    reason: "clip-resident-facing",
    source: WriteSource.CLIP_FACING,
    target: WriteTarget.FIGHTER_CLIP
  });
}
