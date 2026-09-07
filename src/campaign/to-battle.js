/**
 * The READ side of the campaign record: one settled bout's outcome carried
 * forward into the roster of the next.
 *
 * ## Why this file exists
 *
 * `src/campaign/` could write a record, validate it, migrate it across schema
 * versions, key it by content and quarantine it when corrupt — and **nothing
 * could read one back into a battle.** `docs/roadmap.md` said so in as many
 * words: *"a record is written and never read back into a battle, and nothing
 * pays a reward"*.
 *
 * That is the same failure this project already found one layer down, when 22
 * runtime-verified goldens fed nothing and the verification machinery had
 * become the project. A persistence layer that only persists is a filing
 * cabinet. This is the door.
 *
 * ## What a record CAN and CANNOT supply, measured rather than assumed
 *
 * A record's `outcomes` carry `survived`, `health`, `maxHealth`, `statuses` and
 * `defeatedAtSequence` per combatant, plus the seat and slot layout.
 *
 * **It carries no `stats`, no `loadout` and no `resources`.** So a record alone
 * cannot rebuild a gladiator: it has no strength, no damage pair, no armour and
 * no stamina, and inventing them would be inventing evidence. That is not an
 * oversight in the record — the record is an audit artefact of an OUTCOME, and
 * the roster owns who the fighters are.
 *
 * Read-back therefore takes BOTH: the record, and the blueprints the bout was
 * built from. It carries the measured outcome onto them and changes nothing
 * else.
 *
 * ## What it deliberately does NOT decide
 *
 * **Nothing here revives, heals, rewards, levels or re-equips anybody.** Every
 * one of those is a progression decision, and the accepted EP decisions are on
 * the design track with EP-D04 still pending. A seam that quietly healed the
 * survivors would be a balance choice wearing the costume of a data structure.
 *
 * The dead are NAMED, not silently dropped and not silently revived
 * (`fallen`). The caller decides what a campaign does about them, because that
 * is a rule about the game and this is a rule about a file.
 */

import { CampaignRecordError } from "./errors.js";
import { validateCampaignRecord } from "./record.js";

/**
 * One settled record + the blueprints it was built from -> the next bout's
 * teams, plus who did not survive to fight in it.
 *
 * @param {object} record      a validated campaign record
 * @param {object} options
 * @param {Array}  options.blueprints  the combatant sources the bout was built
 *                 from, in any order; matched to outcomes by `id`
 * @param {boolean} [options.includeFallen=false]  carry the dead into the
 *                 roster too, at the health the record measured (which is 0).
 *                 Off by default because a battle of corpses is not a battle —
 *                 the resolver would settle it instantly.
 * @returns {{teams: Array, fallen: Array, carried: Array}}
 */
export function rosterFromCampaignRecord(record, { blueprints, includeFallen = false } = {}) {
  validateCampaignRecord(record);
  if (!Array.isArray(blueprints)) {
    throw new CampaignRecordError(
      "rosterFromCampaignRecord needs the blueprints the bout was built from: a record carries outcomes, " +
      "not stats, loadouts or resources, so it cannot rebuild a gladiator on its own."
    );
  }

  const byId = new Map();
  for (const blueprint of blueprints) {
    if (!blueprint || typeof blueprint.id !== "string") {
      throw new CampaignRecordError("Every blueprint must carry a string id to match against the record.");
    }
    if (byId.has(blueprint.id)) {
      throw new CampaignRecordError(`Two blueprints share the id ${JSON.stringify(blueprint.id)}.`);
    }
    byId.set(blueprint.id, blueprint);
  }

  // Both directions. A blueprint with no outcome means the caller handed in a
  // roster from a different bout; an outcome with no blueprint means the
  // gladiator cannot be rebuilt at all. Either is a mismatch worth refusing
  // loudly rather than a roster that is quietly short a fighter.
  const outcomeIds = new Set(record.outcomes.map((outcome) => outcome.combatantId));
  const missingBlueprint = record.outcomes
    .filter((outcome) => !byId.has(outcome.combatantId))
    .map((outcome) => outcome.combatantId);
  if (missingBlueprint.length > 0) {
    throw new CampaignRecordError(
      `The record names combatants no blueprint supplies: ${missingBlueprint.join(", ")}. ` +
      "A record carries outcomes, not stats, so every one of them needs its blueprint to be rebuilt."
    );
  }
  const unusedBlueprint = [...byId.keys()].filter((id) => !outcomeIds.has(id));
  if (unusedBlueprint.length > 0) {
    throw new CampaignRecordError(
      `The blueprints supply combatants the record does not name: ${unusedBlueprint.join(", ")}. ` +
      "These are almost certainly from a different bout."
    );
  }

  const fallen = [];
  const carried = [];
  const nextById = new Map();

  for (const outcome of record.outcomes) {
    const blueprint = byId.get(outcome.combatantId);
    if (!outcome.survived && !includeFallen) {
      fallen.push({ combatantId: outcome.combatantId, name: outcome.name, teamId: outcome.teamId });
      continue;
    }
    // The measured end state, and ONLY the measured end state. `maxHealth` is
    // the blueprint's business: a record that disagreed with its blueprint
    // about a maximum would be describing a different gladiator, and the check
    // below says so rather than picking one.
    if (
      Number.isFinite(blueprint.maxHealth) &&
      Number.isFinite(outcome.maxHealth) &&
      blueprint.maxHealth !== outcome.maxHealth
    ) {
      throw new CampaignRecordError(
        `${outcome.combatantId} has maxHealth ${blueprint.maxHealth} in its blueprint and ` +
        `${outcome.maxHealth} in the record. One of them is not this gladiator.`
      );
    }
    const next = {
      ...blueprint,
      health: outcome.health,
      // Conditions persist across a bout because nothing in the record or the
      // rule set clears them at a boundary — `death()` clears them on a KILL,
      // which is inside a bout. Carrying them is the faithful default; a
      // campaign that wants a clean slate should say so out loud.
      status: [...outcome.statuses]
    };
    nextById.set(outcome.combatantId, next);
    carried.push({
      combatantId: outcome.combatantId,
      health: outcome.health,
      statuses: [...outcome.statuses]
    });
  }

  // Seats and slot order come from the record's own team/slot layout, so the
  // next bout puts everyone back where they stood. A slot whose combatant did
  // not survive is left out rather than backfilled — deciding who replaces a
  // fallen gladiator is a campaign rule, not a file format.
  const teams = record.teams.map((team) => ({
    id: team.teamId,
    name: team.name,
    combatants: [...team.slots]
      .sort((left, right) => left.slotIndex - right.slotIndex)
      .map((slot) => nextById.get(slot.combatantId))
      .filter((combatant) => combatant !== undefined)
  }));

  return { teams, fallen, carried };
}
