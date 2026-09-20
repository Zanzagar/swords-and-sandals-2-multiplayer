/**
 * Run a campaign that SURVIVES THE PROCESS.
 *
 * ## Why this exists
 *
 * ► **THE CAMPAIGN LAYER HAS HAD NO HOST SINCE IT WAS WRITTEN.** Measured
 *   2026-09-19: 3,174 lines under `src/campaign/`, 69 exports, 70 passing
 *   tests, **one non-test consumer** (`tools/hotseat.mjs`, importing three
 *   names) and **zero `writeFile` calls anywhere in it**. The September audit
 *   put it plainly: *"Nothing a person can run persists a campaign anywhere."*
 *   `hotseat.mjs` runs a circuit and then throws it away when the process ends.
 *
 * ► **THE STATE IS THE RECORDS, AND THAT IS THE DESIGN RATHER THAN A
 *   SHORTCUT.** There is no separate save file holding "where the campaign got
 *   to". A campaign IS its sequence of battle records, and the roster that
 *   walks into the next bout is rebuilt from the latest one by
 *   `rosterFromCampaignRecord` — the function the layer already had for exactly
 *   this. So there is one thing on disk, it is the evidence, and it cannot
 *   drift from a summary of itself because there is no summary.
 *
 * ► **NOT `tools/runtime-capture/campaign.mjs`, WHICH IS A DIFFERENT TOOL WITH
 *   A CONFUSINGLY SIMILAR NAME.** That one drives the CAPTURE pipeline —
 *   ingesting observed rounds from the licensed build. This one runs the
 *   PROGRESSION layer. Nothing is shared between them, which is why this file
 *   is `arena-campaign.mjs` rather than `campaign.mjs`.
 *
 * ## Usage
 *
 * ```
 *   node tools/arena-campaign.mjs fight --dir <directory> [--seed <n>] [--bouts <n>]
 *   node tools/arena-campaign.mjs list  --dir <directory>
 *   node tools/arena-campaign.mjs show  --dir <directory> --record <id>
 * ```
 *
 * `--dir` is REQUIRED and never defaulted. A campaign is a thing a person keeps
 * and a tool that picks its own directory writes somebody's save somewhere they
 * did not ask for — the rule `recover-launch-nonces.mjs` already sets about its
 * `--archive`.
 *
 * ## WHAT IS THE BUILD'S AND WHAT IS THIS ENGINE'S
 *
 * **The campaign is entirely this engine's.** Vanilla SS2 persists ONE
 * gladiator into a Flash shared object and has no notion of a circuit of team
 * battles; `src/campaign/vanilla-boundary.js` exists to keep these keys from
 * colliding with the save fields that are the build's. The BOUTS are the
 * map-derived rule set, and nothing here changes them.
 *
 * Node builtins only.
 */
import process from "node:process";

import {
  applyAction,
  createTeamBattle,
  currentCombatant,
  legalActions,
  suggestAction
} from "../src/team/index.js";
import {
  BATTLE_RESULT_ACK_TYPE,
  acknowledgeResultAnimation,
  pendingResultEvent
} from "../src/team/index.js";
import {
  CircuitSide,
  ReadStatus,
  WriteStatus,
  advanceCircuit,
  createCampaignStore,
  rosterFromCampaignRecord
} from "../src/campaign/index.js";
// By path and deliberately: this one touches `node:fs` and is the only part of
// the campaign layer that cannot run in a browser. See its own header.
import { createFileBackend } from "../src/campaign/file-backend.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { demoSide } from "./arena/roster.js";

const GUARD = 900;

function parseArgs(argv) {
  const options = { command: argv[0] ?? null, seed: 7, bouts: 1, perSide: 3 };
  for (let i = 1; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--dir") options.directory = argv[++i];
    else if (flag === "--seed") options.seed = Number(argv[++i]);
    else if (flag === "--bouts") options.bouts = Number(argv[++i]);
    else if (flag === "--per-side") options.perSide = Number(argv[++i]);
    else if (flag === "--record") options.record = argv[++i];
    else throw new Error(`Unknown argument ${flag}`);
  }
  if (!["fight", "list", "show"].includes(options.command)) {
    throw new Error("Usage: arena-campaign.mjs <fight|list|show> --dir <directory> [...]");
  }
  if (!options.directory) {
    throw new Error("--dir <directory> is required; a campaign is not written somewhere nobody asked for.");
  }
  return options;
}

const storeAt = (directory) => createCampaignStore({ backend: createFileBackend({ directory }) });

/**
 * Every record on disk, oldest first.
 *
 * ► **SORTED BY `recordedAt`, NOT BY ID.** A record id is content-addressed
 *   (`tbr-<digest>`), so the ids carry no order at all and listing the
 *   directory would return them in whatever order the filesystem felt like.
 */
function recordsInOrder(store) {
  const records = [];
  for (const id of store.recordIds()) {
    const read = store.readRecord(id);
    if (read.status !== ReadStatus.OK) {
      records.push({ id, status: read.status, record: null });
      continue;
    }
    records.push({ id, status: read.status, record: read.record });
  }
  records.sort((left, right) => {
    const a = left.record?.recordedAt ?? "";
    const b = right.record?.recordedAt ?? "";
    return a < b ? -1 : a > b ? 1 : (left.id < right.id ? -1 : 1);
  });
  return records;
}

/**
 * The opening roster: the arena's own demo sides, so this and the page agree.
 *
 * ► **`demoSide` RETURNS `members`, NOT `combatants`.** The arena host takes
 *   that shape; `createTeamBattle` takes the other. Renaming it here rather
 *   than in the roster keeps the page's own path untouched.
 */
function openingTeams(perSide) {
  const build = { ss2Combatant, ss2BattleValues };
  return ["red", "blue"].map((side) => {
    const built = demoSide(side, perSide, build);
    return { id: built.id, name: built.name, combatants: built.members };
  });
}


/**
 * Every gladiator this tool can ever mint, rebuildable FROM ITS ID ALONE.
 *
 * ► **THIS IS WHAT MAKES "THE STATE IS THE RECORDS" ACTUALLY TRUE ACROSS
 *   PROCESSES, and the first cut did not have it.** A record carries outcomes,
 *   not stats — `rosterFromCampaignRecord` refuses without blueprints and says
 *   so — and it refuses just as loudly if handed blueprints it does NOT name
 *   ("almost certainly from a different bout"). So a fresh process has to
 *   produce exactly the blueprints for the ids in the record, no more.
 *
 *   The first cut passed the whole opening roster and bout 3 failed with
 *   *"The blueprints supply combatants the record does not name: blue-1,
 *   blue-3"* — the dead of bout 1, still being offered. **And it reused the
 *   ORIGINAL ids for challengers**, so a refilled `red-1` was indistinguishable
 *   from the `red-1` that had already died.
 *
 *   Both are fixed by making the id the whole state: an opening slot is
 *   `<side>-<n>` and a challenger is `<side>-c<bout>-<n>`, and either can be
 *   rebuilt by anybody holding the id. **Nothing about a gladiator is
 *   remembered that its id does not say**, which is the only version of this
 *   that survives a reboot.
 */
function blueprintFor(id, perSide) {
  const match = /^(red|blue)-(?:c\d+-)?(\d+)$/.exec(id);
  if (!match) return null;
  const [, side, slot] = match;
  const built = demoSide(side, perSide, { ss2Combatant, ss2BattleValues });
  const template = built.members[Number(slot) - 1];
  if (!template) return null;
  // The id is the identity; everything else is the slot's template.
  return { ...template, id, vanilla: { ...template.vanilla, character_name: id } };
}

/** The blueprints a record names, and only those. */
function blueprintsForRecord(record, perSide) {
  // ► **THE IDS ARE ON `outcomes`, NOT ON `teams[].combatants`.** A record's
  //   `teams` carry SLOTS (`{ seatId, slotIndex, combatantId, aiFilled }`) and
  //   `outcomes` carry the per-combatant result. The first cut read a
  //   `combatants` array that does not exist, produced an empty list, and the
  //   refusal that followed named all six as unsupplied — **which is the store
  //   catching my error rather than absorbing it.**
  const ids = (record.outcomes ?? []).map((outcome) => outcome.combatantId);
  const blueprints = [];
  for (const id of ids) {
    const blueprint = blueprintFor(id, perSide);
    if (!blueprint) throw new Error(`Cannot rebuild a blueprint for ${id}; this campaign was not minted here.`);
    blueprints.push(blueprint);
  }
  return blueprints;
}

/** A fresh challenger side for `bout`, with ids nothing else can collide with. */
function challengerSide(side, perSide, bout) {
  const built = demoSide(side, perSide, { ss2Combatant, ss2BattleValues });
  return built.members.map((member, index) => {
    const id = `${side}-c${bout}-${index + 1}`;
    return { ...member, id, vanilla: { ...member.vanilla, character_name: id } };
  });
}

/** Drives a bout to settlement with the shipped AI on both sides. */
function fightToSettlement(teams, seed) {
  const battle = createTeamBattle({
    seed,
    rules: ss2TeamRules,
    teams: teams.map((team) => ({ id: team.id, name: team.name, combatants: team.combatants }))
  });
  for (let guard = 0; !battle.result; guard += 1) {
    if (guard > GUARD) throw new Error(`The bout did not settle in ${GUARD} actions.`);
    const actor = currentCombatant(battle);
    if (!actor) break;
    if (legalActions(battle, actor.id).length === 0) break;
    applyAction(battle, { actorId: actor.id, ...suggestAction(battle, actor.id) });
  }
  if (!battle.result) throw new Error("The bout did not settle.");
  const pending = pendingResultEvent(battle);
  if (pending) {
    acknowledgeResultAnimation(battle, {
      type: BATTLE_RESULT_ACK_TYPE,
      completionToken: pending.completionToken
    });
  }
  return battle;
}

function fight(options) {
  const store = storeAt(options.directory);
  const history = recordsInOrder(store);
  console.log(`campaign at ${options.directory} — ${history.length} bout(s) on disk`);

  let teams = openingTeams(options.perSide);
  let blueprints = teams.flatMap((team) => team.combatants);
  let boutNumber = history.length + 1;

  // ► **A CAMPAIGN IS RESUMED FROM ITS LAST RECORD, which is the whole point.**
  //   `advanceCircuit` already returns the carried roster, so continuing means
  //   replaying the last advance rather than storing a second copy of its
  //   answer. A corrupt tail is refused loudly rather than started over.
  if (history.length > 0) {
    const last = history.at(-1);
    if (last.status !== ReadStatus.OK) {
      throw new Error(
        `The most recent record (${last.id}) reads as ${last.status}; refusing to continue over it. ` +
        "Move it aside deliberately if that is what you mean."
      );
    }
    // ► **THIS REBUILD IS THE RESUME, AND THE FIRST CUT PRINTED THE MESSAGE
    //   WITHOUT DOING IT.** It logged "resuming after ..." and then fought from
    //   the opening roster, so every bout started with six fresh gladiators and
    //   the campaign was a bout COUNTER rather than a campaign. Caught by
    //   reading the code after watching three bouts each report six fallen.
    //   **A log line is not a behaviour.**
    //
    //   `rosterFromCampaignRecord` needs the blueprints because a record
    //   carries outcomes, not stats — it says so in its own refusal — so the
    //   opening roster is the blueprint set and the record supplies who is
    //   still standing and at what health.
    const carried = rosterFromCampaignRecord(last.record, {
      blueprints: blueprintsForRecord(last.record, options.perSide)
    });
    const survivors = carried.teams.flatMap((team) => team.combatants);
    if (survivors.length === 0) {
      // ► **A CONCLUDED CIRCUIT IS NOT A FAILURE, and the first cut threw.** A
      //   drawn bout eliminates both sides — reachable here, and reached on the
      //   second bout of the first campaign this tool ever ran — so the circuit
      //   simply ends. Exiting 1 on it would make a legitimate outcome
      //   indistinguishable from a broken store to anything scripting this.
      console.log(
        `${last.id} left nobody standing: the circuit is concluded after ${history.length} bout(s). ` +
        "Start a new one in another directory."
      );
      return;
    }
    // ► **A RECORD SAYS WHO SURVIVED, NOT WHO THEY WILL FACE NEXT — so the
    //   empty side is REFILLED here rather than remembered.** A settled bout
    //   always leaves one side eliminated (`advanceCircuit` says so in its own
    //   refusal), and the challengers are a decision taken at advance time. In
    //   a single process they arrive on `advance.teams`; across processes they
    //   do not exist yet, and generating them is right: **persisting them would
    //   be storing a decision that has not been made instead of the evidence
    //   that has.**
    teams = carried.teams.map((team) => (
      team.combatants.length > 0
        ? team
        : {
          ...team,
          combatants: challengerSide(team.id, options.perSide, boutNumber)
        }
    ));
    blueprints = teams.flatMap((team) => team.combatants);
    const refilled = teams.filter((team) => carried.teams
      .find((was) => was.id === team.id)?.combatants.length === 0).map((team) => team.id);
    console.log(
      `resuming after ${last.id} (${last.record.recordedAt}) — ` +
      `${survivors.length} gladiator(s) carried, ${carried.fallen.length} fallen` +
      (refilled.length > 0 ? `, ${refilled.join(" and ")} refilled with challengers` : "")
    );
  }

  for (let i = 0; i < options.bouts; i += 1) {
    const battle = fightToSettlement(teams, options.seed + boutNumber - 1);
    const winner = battle.result.winnerTeamId ?? "nobody";
    const beaten = winner === "red" ? "blue" : "red";
    const challengers = {
      teamId: beaten,
      name: beaten === "red" ? "Red" : "Blue",
      side: beaten === "red" ? CircuitSide.RIGHT : CircuitSide.LEFT,
      combatants: challengerSide(beaten, options.perSide, boutNumber + 1)
    };

    const advance = advanceCircuit(battle, {
      blueprints,
      challengers,
      battleId: `campaign-bout-${boutNumber}`,
      recordedAt: new Date().toISOString(),
      sides: { red: CircuitSide.RIGHT, blue: CircuitSide.LEFT }
    });

    const write = store.write(advance.record);
    if (write.status !== WriteStatus.WRITTEN && write.status !== WriteStatus.DUPLICATE) {
      throw new Error(`The record for bout ${boutNumber} was not stored: ${JSON.stringify(write)}`);
    }
    console.log(
      `  bout ${boutNumber}: ${winner} wins — ${advance.survivors.length} survivor(s), ` +
      `${advance.fallen.length} fallen — stored as ${write.recordId} (${write.status})`
    );

    if (advance.concluded) {
      console.log("  the circuit is concluded; nothing carries forward.");
      break;
    }
    teams = advance.teams;
    blueprints = teams.flatMap((team) => team.combatants);
    boutNumber += 1;
  }
  console.log(`\n${store.recordIds().length} bout(s) now on disk. Run again to continue the circuit.`);
}

function list(options) {
  const store = storeAt(options.directory);
  const history = recordsInOrder(store);
  if (history.length === 0) {
    console.log(`No campaign at ${options.directory}. Run \`fight --dir ${options.directory}\` to start one.`);
    return;
  }
  console.log(`campaign at ${options.directory}\n`);
  console.log("bout  record                              recorded at               winner");
  history.forEach((entry, index) => {
    const at = entry.record?.recordedAt ?? "";
    // `settlement.winnerTeamId`, read off a real record rather than guessed.
    // The first cut guessed `outcome.winnerTeamId`, which does not exist, and
    // the column printed `?` for every bout — a readout that looks like data.
    const winner = entry.record?.settlement?.winnerTeamId ?? "?";
    const status = entry.status === ReadStatus.OK ? "" : `  <-- ${entry.status.toUpperCase()}`;
    console.log(
      `${String(index + 1).padStart(4)}  ${entry.id.padEnd(34)}  ${String(at).padEnd(24)}  ${winner}${status}`
    );
  });
  const quarantined = store.quarantinedKeys();
  if (quarantined.length > 0) console.log(`\n${quarantined.length} quarantined key(s): ${quarantined.join(", ")}`);
}

function show(options) {
  if (!options.record) throw new Error("show needs --record <id>; `list` prints them.");
  const read = storeAt(options.directory).readRecord(options.record);
  if (read.status !== ReadStatus.OK) {
    console.error(`${options.record} reads as ${read.status}.`);
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(read.record, null, 2));
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.command === "fight") fight(options);
  else if (options.command === "list") list(options);
  else show(options);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
