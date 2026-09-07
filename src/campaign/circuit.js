/**
 * A CIRCUIT: consecutive bouts, with the survivors carried between them.
 *
 * ## Why this file exists
 *
 * `src/campaign/to-battle.js` landed on 2026-09-07 so that a settled bout's
 * record could be read back into a roster. One week later its only caller was
 * still its own test file — no tool imported `src/campaign/` at all. That is
 * the same shape as the two defects this project has already found and named:
 * 22 runtime-verified goldens that fed nothing, and a persistence layer that
 * only persisted. **A door nobody walks through is a wall.** This is the first
 * consumer.
 *
 * ## What a circuit is, and what it deliberately is not
 *
 * A circuit is N bouts. The survivors of bout K enter bout K+1 at the health
 * and conditions the record measured, and a fresh challenger fills the side
 * that was eliminated. That is the whole mechanic.
 *
 * **Nothing here heals, revives, pays, levels or re-equips anybody.** Each of
 * those is a progression decision belonging to the design track, where EP-D04
 * is pending and EP-A03 (the maintenance/repair model) has not even been
 * drafted. A circuit that quietly restored the survivors would be a balance
 * choice wearing the costume of a data structure — the phrase `to-battle.js`
 * uses about itself, for the same reason.
 *
 * **There is no default circuit length.** Four fights is EP-D03, and EP-D03 is
 * `pending`. A hard-coded four would be an agent quietly adopting an undecided
 * rule, so the length is required from the caller and refused if absent.
 *
 * ## THE ONE THING A CIRCUIT MUST REPORT: what does NOT carry
 *
 * A campaign record's `outcomes` carry `survived`, `health`, `maxHealth` and
 * `statuses`. They carry **no resources**. So read-back rebuilds a survivor
 * from its blueprint and the blueprint's resources come back with it — which
 * means **armour and stamina attrition are silently undone between bouts**.
 *
 * Measured on 2026-09-07, not argued: a fighter who ended a bout at
 * `armourclass 0` and `staminaleft 48` re-entered the next one at `420` and
 * `140`, its blueprint's values, with nothing anywhere saying so.
 *
 * Whether armour should repair free between fights is a balance question and
 * therefore not this file's to answer. What is unquestionably this file's job
 * is to stop the answer being made by accident. Every advance reports
 * `restoredResources`: the exact resources whose measured end value differs
 * from the value the fighter re-enters with, per fighter, by name, with both
 * numbers. A caller that wants attrition to persist has the list to act on; a
 * caller that wants free repair has it in writing rather than by omission.
 */

import { CampaignRecordError } from "./errors.js";
import { buildCampaignRecord } from "./from-battle.js";
import { rosterFromCampaignRecord } from "./to-battle.js";

/**
 * The status token that means "this gladiator faces left".
 *
 * Duplicated as a literal rather than imported from `src/team/ss2-rules.js`,
 * and that is deliberate: `src/campaign/` is rule-set agnostic — it records
 * battles under ANY injected rule set — and importing SS2's vocabulary here
 * would make the campaign layer depend on one rule set's tokens. The cost of
 * the duplication is this comment; the cost of the import would be a layering
 * inversion. A rule set that does not use the token is simply unaffected,
 * because the correction only fires when the token is actually present.
 */
const FACING_LEFT = "facing-left";

/** Which side of the arena a team fights on, by the facing its fighters take. */
export const CircuitSide = Object.freeze({
  /** Faces left: carries the `facing-left` token. */
  LEFT: "left",
  /** Faces right: carries no facing token. */
  RIGHT: "right"
});

function assertPositiveInteger(value, what) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CampaignRecordError(`${what} must be a positive integer, not ${JSON.stringify(value)}.`);
  }
}

/**
 * The value a resource holds, whether it is a live bag entry (`{value, ...}`)
 * or a blueprint's plain number.
 *
 * Blueprints and live combatants do not share a shape: `roster.js` normalises
 * a declared `{ armourclass: 420 }` into `{ armourclass: { value: 420, min,
 * max } }`. Comparing the two without accounting for that reads every resource
 * as changed, which would make `restoredResources` noise instead of a signal.
 */
function scalarOf(entry) {
  if (entry === undefined || entry === null) return null;
  if (typeof entry === "number") return Number.isFinite(entry) ? entry : null;
  if (typeof entry === "object" && Number.isFinite(entry.value)) return entry.value;
  return null;
}

/**
 * What the fighters actually held when the bout ended, by combatant id.
 *
 * Read off the BATTLE, not the record, because the record does not carry it.
 * This is the only reason `advanceCircuit` takes the battle as well as being
 * able to build the record from it.
 */
function measuredEndResources(battle) {
  const byId = new Map();
  for (const team of battle.teams) {
    for (const combatant of team.combatants) {
      const measured = {};
      for (const [name, entry] of Object.entries(combatant.resources ?? {})) {
        const value = scalarOf(entry);
        if (value !== null) measured[name] = value;
      }
      byId.set(combatant.id, measured);
    }
  }
  return byId;
}

/**
 * Corrects a carried fighter's facing to the side it is about to fight on.
 *
 * Facing is per SIDE, not per fighter — red faces right, blue faces left —
 * and it is load-bearing rather than cosmetic: `gladiator_dir` shapes the
 * knockback direction and the armour-debris draw. A survivor moved across the
 * arena therefore has to be re-faced, and a naive carry does not do it,
 * because read-back copies the measured `statuses` verbatim and the facing
 * token is one of them.
 *
 * Reported as well as applied. A silent flip is a rule about the game applied
 * by a file, which is the thing this layer keeps trying not to do.
 */
function faceForSide(combatant, side) {
  const statuses = Array.isArray(combatant.status) ? [...combatant.status] : [];
  const facesLeft = statuses.includes(FACING_LEFT);
  const shouldFaceLeft = side === CircuitSide.LEFT;
  if (facesLeft === shouldFaceLeft) return null;

  const next = shouldFaceLeft
    ? [...statuses, FACING_LEFT]
    : statuses.filter((token) => token !== FACING_LEFT);
  combatant.status = next;
  return { combatantId: combatant.id, from: facesLeft ? CircuitSide.LEFT : CircuitSide.RIGHT, to: side };
}

/**
 * One settled bout -> the next bout's teams, with a fresh challenger.
 *
 * @param {object} battle    the SETTLED bout, with its result acknowledged
 * @param {object} options
 * @param {Array}  options.blueprints   the combatant sources this bout was built from
 * @param {object} options.challengers  `{ teamId, name, combatants, side }` — the
 *                 fresh team filling the side that was eliminated. Its `side`
 *                 decides the facing its fighters take.
 * @param {string} options.battleId
 * @param {string} options.recordedAt
 * @param {object} [options.sides]  `{ [teamId]: CircuitSide }` for the surviving
 *                 teams. Omitted teams keep whatever facing they carried.
 * @returns {{
 *   record, teams, survivors, fallen, seatChanges,
 *   restoredResources, facingCorrections, concluded, winnerTeamId
 * }}
 */
export function advanceCircuit(battle, { blueprints, challengers, battleId, recordedAt, sides = {} } = {}) {
  if (!battle?.result) {
    throw new CampaignRecordError(
      "advanceCircuit needs a SETTLED bout: a circuit advances on elimination, never on a knockout."
    );
  }
  if (!challengers || !Array.isArray(challengers.combatants) || challengers.combatants.length === 0) {
    throw new CampaignRecordError(
      "advanceCircuit needs `challengers`: a circuit refills the eliminated side rather than fighting a phantom. " +
      "A settled bout always leaves one side empty, so there is never a next bout without a fresh opponent."
    );
  }

  const record = buildCampaignRecord(battle, { battleId, recordedAt });
  const roster = rosterFromCampaignRecord(record, { blueprints });
  const measured = measuredEndResources(battle);

  // WHAT DID NOT CARRY. Computed per surviving fighter by comparing what the
  // battle measured against what the rebuilt fighter re-enters with. This is
  // the whole reason `advanceCircuit` takes the battle: the record cannot
  // answer it, and a circuit that does not ask silently repairs armour.
  const restoredResources = [];
  for (const team of roster.teams) {
    for (const combatant of team.combatants) {
      const ended = measured.get(combatant.id) ?? {};
      const changes = [];
      for (const [name, endValue] of Object.entries(ended)) {
        const enters = scalarOf(combatant.resources?.[name]);
        if (enters === null || enters === endValue) continue;
        changes.push({ resource: name, measured: endValue, entersAt: enters });
      }
      if (changes.length > 0) {
        changes.sort((left, right) => (left.resource < right.resource ? -1 : 1));
        restoredResources.push({ combatantId: combatant.id, teamId: team.id, changes });
      }
    }
  }

  // The eliminated side is the one read-back reports it cannot field. Since
  // the `playable` fix of 2026-09-07 that includes a team holding NOBODY,
  // which is exactly what a settled bout produces and what used to be missed.
  const emptyTeamIds = new Set(roster.teams.filter((team) => team.combatants.length === 0).map((team) => team.id));

  const facingCorrections = [];
  const teams = [];
  let replaced = false;
  for (const team of roster.teams) {
    if (emptyTeamIds.has(team.id) && !replaced) {
      replaced = true;
      const fresh = challengers.combatants.map((combatant) => {
        const copy = structuredClone(combatant);
        const correction = challengers.side ? faceForSide(copy, challengers.side) : null;
        if (correction) facingCorrections.push(correction);
        return copy;
      });
      teams.push({ id: challengers.teamId ?? team.id, name: challengers.name ?? team.name, combatants: fresh });
      continue;
    }
    if (emptyTeamIds.has(team.id)) continue;
    const side = sides[team.id];
    if (side) {
      for (const combatant of team.combatants) {
        const correction = faceForSide(combatant, side);
        if (correction) facingCorrections.push(correction);
      }
    }
    teams.push(team);
  }

  // A circuit ENDS when nobody is left to carry. Reported rather than thrown:
  // running out of gladiators is the ordinary way a run finishes, not an error.
  const survivors = teams.flatMap((team) =>
    team.combatants.filter((combatant) => (combatant.health ?? 0) > 0).map((combatant) => combatant.id)
  );
  const concluded = roster.teams.every((team) => team.combatants.length === 0);

  return {
    record,
    teams,
    survivors,
    fallen: roster.fallen,
    seatChanges: roster.seatChanges,
    restoredResources,
    facingCorrections,
    concluded,
    winnerTeamId: battle.result.winnerTeamId ?? null
  };
}

/**
 * How many bouts a circuit runs, validated.
 *
 * A separate export because the number is a DECISION, not a default. EP-D03
 * would make a Circuit four fights and EP-D03 is `pending`, so this refuses an
 * absent length rather than choosing one. When EP-D03 lands, the accepted
 * number belongs here with its decision id beside it — not scattered through
 * callers as a literal `4`.
 */
export function circuitLength(requested) {
  if (requested === undefined || requested === null) {
    throw new CampaignRecordError(
      "A circuit needs an explicit length. There is no default: four fights is EP-D03 and EP-D03 is pending, " +
      "so defaulting to four would adopt an undecided rule."
    );
  }
  assertPositiveInteger(requested, "A circuit length");
  return requested;
}
