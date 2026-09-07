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
 *                 Off by default. A settled bout always has a wholly eliminated
 *                 team, so a roster including the fallen is for INSPECTION and
 *                 is never directly playable — `playable` says so.
 * @returns {{teams, fallen, carried, seatChanges, playable, unplayableTeamIds}}
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
    // DEEP-copied, not spread. A shallow `{...blueprint}` hands back the
    // caller's own `stats`, `resources` and `loadout` objects, so a campaign
    // that edited a carried fighter would silently edit the blueprint it
    // intends to reuse next bout. Ordinary construction happens to rebuild
    // those, so a battle does not corrupt its source — but the returned object
    // is meant to be handled, and handing back live references to someone
    // else's state is a trap rather than an optimisation.
    const next = structuredClone(blueprint);
    next.health = outcome.health;
    // Conditions persist across a bout because nothing in the record or the
    // rule set clears them at a boundary — `death()` clears them on a KILL,
    // which is inside a bout. Carrying them is the faithful default; a
    // campaign that wants a clean slate should say so out loud.
    next.status = [...outcome.statuses];
    // The MEASURED maximum, stated rather than left to be re-derived.
    //
    // `maximumHealth` returns a declared `maxHealth` verbatim and otherwise
    // derives one from herolevel and vitality. A blueprint that states no
    // maximum therefore gets a DERIVED one — and if it derives lower than the
    // carried health, construction clamps the survivor down without a word.
    // Measured: a 25/60 outcome against a blueprint deriving 10 arrived as 10.
    // The record measured this gladiator's maximum; state it.
    if (Number.isFinite(outcome.maxHealth)) next.maxHealth = outcome.maxHealth;
    nextById.set(outcome.combatantId, next);
    carried.push({
      combatantId: outcome.combatantId,
      health: outcome.health,
      statuses: [...outcome.statuses]
    });
  }

  // Slot ORDER comes from the record's own layout, so the relative order of a
  // team's fighters is preserved.
  //
  // ► **SEATS ARE NOT PRESERVED WHEN SOMEBODY FALLS, and an earlier version of
  //   this comment claimed they were.** `createTeamBattle` assigns `seatId`
  //   from the ARRAY INDEX, and there is no vacant-seat marker to hold a dead
  //   fighter's place: `"empty"` means AI-FILL, not "leave this gap" (measured
  //   — an SS2 team with an `"empty"` slot is refused, because the fill
  //   template declares none of the required resources). So a survivor behind a
  //   casualty MOVES UP: red slot-2 becomes red slot-1.
  //
  //   That is reported rather than hidden. Seat identity is what a campaign
  //   uses to say "this is the same fighter's chair", and silently renumbering
  //   it is the kind of change that is discovered three features later.
  const teams = [];
  const seatChanges = [];
  for (const team of record.teams) {
    const ordered = [...team.slots].sort((left, right) => left.slotIndex - right.slotIndex);
    const combatants = [];
    for (const slot of ordered) {
      const combatant = nextById.get(slot.combatantId);
      if (combatant === undefined) continue;
      const toIndex = combatants.length;
      if (toIndex !== slot.slotIndex) {
        seatChanges.push({
          combatantId: slot.combatantId,
          fromSeatId: slot.seatId,
          fromSlotIndex: slot.slotIndex,
          toSlotIndex: toIndex
        });
      }
      combatants.push(combatant);
    }
    teams.push({ id: team.teamId, name: team.name, combatants });
  }

  // WHETHER THIS ROSTER CAN ACTUALLY FIGHT, reported rather than assumed.
  //
  // An earlier version of this file said a roster of corpses "would settle
  // instantly". It does not — it STALLS, measured: `createTeamBattle` accepts
  // it, initiative includes the dead, and when a dead fighter holds the turn
  // there are ZERO legal actions and NO result, permanently.
  //
  // The first fix was to REFUSE such a roster, and that was wrong in a way
  // worth recording: a settled bout always has a wholly eliminated team, so
  // `includeFallen` can NEVER produce a playable roster and refusing turned the
  // option into a ban on its own only honest use — looking at who was there.
  // So the hazard is named instead. A caller building a battle checks
  // `playable`; a caller inspecting a bout ignores it.
  // ► **THIS FILTERED OUT THE COMMONEST ROSTER THERE IS, and reported it
  //   PLAYABLE. Found and measured 2026-09-07.** The first clause used to be
  //   `.filter((team) => team.combatants.length > 0)`, which skipped a team
  //   holding NOBODY before asking whether anybody could fight — and a
  //   survivors-only roster of a settled bout always has one, because
  //   settlement requires a wholly eliminated team. So `playable` said true
  //   for the exact roster this seam exists to produce, while
  //   `createTeamBattle` refused it outright: *"Each team must contain one to
  //   three combatants."*
  //
  //   A team cannot fight for two different reasons and BOTH are unplayable:
  //   it has nobody left (the eliminated side), or it has fighters and none of
  //   them is alive (`includeFallen`'s roster of corpses, which stalls). The
  //   old code handled only the second.
  //
  //   This is the THIRD wrong claim this seam has made about `playable` — the
  //   first said a roster of corpses settles instantly, the second refused
  //   such a roster outright — and the test that covered it asserted the flag
  //   without ever building a battle from it. It is now proved against
  //   `createTeamBattle` instead of asserted.
  const unplayable = teams
    .filter((team) => !team.combatants.some((combatant) => (combatant.health ?? 0) > 0))
    .map((team) => team.id);

  return {
    teams,
    fallen,
    carried,
    seatChanges,
    playable: unplayable.length === 0,
    unplayableTeamIds: unplayable
  };
}
