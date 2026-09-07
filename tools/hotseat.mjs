/**
 * Hot-seat runner: the first thing in this repository a person can PLAY, and
 * since this change the first that plays SS2's OWN arithmetic.
 *
 * Two humans take turns at one keyboard. It drives `src/team/` directly and
 * touches `src/adapter/` not at all — the adapter's canonical resource bag
 * cannot carry an SS2 rule set's inputs (see `src/team/ss2-rules.js`). Node
 * builtins only; `package.json` has no dependencies and this must not add one.
 *
 * WHY THIS EXISTS. The resolver, the roster, the RNG channel, elimination and
 * settlement had all been tested for months and never once been played, and a
 * corpus of 22 runtime-verified goldens fed nothing. Until a person can watch a
 * fight, no measurement has a consumer and no priority has a source.
 *
 * IT DECIDES NO COMBAT. Every number on screen was decided and clamped by the
 * resolver running the INJECTED RULE SET. There is no formula here — the only
 * arithmetic below is array indexing and column widths. That is the same
 * boundary `src/adapter/` keeps, and for the same reason: a runner that quietly
 * did its own damage would make the rule set unfalsifiable.
 *
 * ON HONESTY. The banner names the rule set's verification tier on every run
 * and refuses to be subtle about it. `map-derived` is NOT `runtime-verified`,
 * and the banner says which parts of the fight have golden backing and which
 * have none. That confusion is the exact failure this whole project is built to
 * prevent, and a playable demo is the easiest place in the world to commit it.
 *
 * Usage:
 *   node tools/hotseat.mjs [--rules ss2|placeholder] [--seed <n>]
 *                          [--hp <n>] [--armour <n>] [--enchant <cond>[:<pot>]]
 *                          [--names A,B]
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  createTeamBattle,
  legalActions,
  applyAction,
  currentCombatant,
  combatantById,
  allCombatants,
  placeholderTeamRules,
  resourceValue,
  rngJournal,
  seatOf,
  pendingResultEvent,
  acknowledgeResultAnimation,
  BATTLE_RESULT_ACK_TYPE
} from "../src/team/index.js";
import { advanceCircuit, circuitLength, CircuitSide } from "../src/campaign/index.js";
import {
  SS2_FACING_LEFT,
  ss2Combatant,
  ss2StatusFlagOf,
  ss2StatusSourceOf,
  ss2TeamRules
} from "../src/team/ss2-rules.js";

/**
 * Input that works both ways round.
 *
 * A terminal gets `readline`. A PIPE gets its lines read up front into a queue,
 * because a piped run is how this is tested and how a demo is recorded, and
 * readline's prompt loop does not reliably drain a pipe that has already
 * closed — measured: it consumed one line of eight and then hung on an
 * unsettled await. Answering EOF with `null` lets the loop exit cleanly instead
 * of dying with a warning.
 */
async function createPrompter() {
  if (input.isTTY) {
    const rl = createInterface({ input, output });
    return {
      ask: async (question) => rl.question(question),
      close: () => rl.close()
    };
  }
  const chunks = [];
  for await (const chunk of input) chunks.push(chunk);
  const queue = chunks.join("").split("\n");
  return {
    ask: async (question) => {
      output.write(question);
      if (queue.length === 0) return null;
      const line = queue.shift();
      output.write(`${line}\n`);
      return line;
    },
    close: () => {}
  };
}

/* ------------------------------------------------------------------ */
/* Argument parsing                                                    */
/* ------------------------------------------------------------------ */

/** The rule sets a player may inject, by name. */
const RULE_SETS = Object.freeze({
  ss2: ss2TeamRules,
  placeholder: placeholderTeamRules
});

function parseArgs(argv) {
  const options = {
    seed: 1, hp: 60, armour: 0, rules: "ss2", enchant: null, teams: null, names: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${flag} needs a value.`);
      index += 1;
      return value;
    };
    if (flag === "--seed") options.seed = Number(next());
    else if (flag === "--hp") options.hp = Number(next());
    else if (flag === "--armour") options.armour = Number(next());
    else if (flag === "--enchant") options.enchant = next();
    else if (flag === "--teams") options.teams = next();
    else if (flag === "--circuit") options.circuit = next();
    else if (flag === "--rules") options.rules = next();
    else if (flag === "--names") options.names = next().split(",").map((part) => part.trim());
    else if (flag === "--help" || flag === "-h") options.help = true;
    else throw new Error(`Unknown flag ${flag}. Try --help.`);
  }
  if (!Number.isInteger(options.seed)) throw new Error("--seed must be an integer.");
  if (!Number.isInteger(options.hp) || options.hp < 1) throw new Error("--hp must be a positive integer.");
  if (!Number.isInteger(options.armour) || options.armour < 0) {
    throw new Error("--armour must be a non-negative integer.");
  }
  if (options.enchant !== null) {
    const [condition, rawPotency] = options.enchant.split(":");
    if (!Object.hasOwn(ENCHANTMENT_TYPE, condition)) {
      throw new Error(
        `--enchant must name one of: ${Object.keys(ENCHANTMENT_TYPE).join(", ")} (e.g. --enchant burning:3).`
      );
    }
    // In-play potency maxes at 3: the magic shop's buttons 2010/2011/2012 push
    // 3, 2 and 1. Higher is reachable in this tool but is not a state the game
    // can produce, so it is refused rather than quietly allowed.
    const potency = rawPotency === undefined ? 3 : Number(rawPotency);
    if (!Number.isInteger(potency) || potency < 1 || potency > 3) {
      throw new Error("--enchant potency must be 1, 2 or 3 — the only grades the magic shop sells.");
    }
    options.enchant = { condition, type: ENCHANTMENT_TYPE[condition], potency };
  }
  if (!Object.hasOwn(RULE_SETS, options.rules)) {
    throw new Error(`--rules must be one of: ${Object.keys(RULE_SETS).join(", ")}.`);
  }
  // `--teams 2v2`. Capped at 3 a side because that is what the arena was
  // measured to support without touching a licensed asset (see the six-slot
  // commit); a larger fight is not blocked by this tool, it is unproven.
  const sizes = options.teams === null ? [1, 1] : options.teams.split("v").map(Number);
  if (sizes.length !== 2 || sizes.some((n) => !Number.isInteger(n) || n < 1 || n > 3)) {
    throw new Error("--teams must look like 2v2, with 1-3 fighters a side.");
  }
  options.sizes = sizes;

  // `--circuit N`: N consecutive bouts, survivors carried between them.
  //
  // THERE IS NO DEFAULT, and that is a decision rather than an omission. One
  // Arena Circuit being four fights is EP-D03, and EP-D03 is `pending` on the
  // design track — so shipping `--circuit` with a default of 4 would adopt an
  // undecided rule by accident. Absent, the tool plays exactly one bout, byte
  // for byte as it did before this flag existed.
  if (options.circuit !== undefined) {
    const bouts = Number(options.circuit);
    if (!Number.isInteger(bouts) || bouts < 1) {
      throw new Error("--circuit must be a positive integer: the number of consecutive bouts to fight.");
    }
    options.circuit = circuitLength(bouts);
  } else {
    options.circuit = null;
  }

  const total = sizes[0] + sizes[1];
  if (options.names === null) {
    options.names = total === 2
      ? ["Player 1", "Player 2"]
      : [
        ...Array.from({ length: sizes[0] }, (_, i) => `Red ${i + 1}`),
        ...Array.from({ length: sizes[1] }, (_, i) => `Blue ${i + 1}`)
      ];
  }
  if (options.names.length !== total || options.names.some((name) => name === "")) {
    throw new Error(`--names needs exactly ${total} non-empty names for ${sizes[0]}v${sizes[1]}, comma separated.`);
  }
  return options;
}

const USAGE = `
Hot-seat: two humans, one keyboard, one fight.

  node tools/hotseat.mjs [options]

  --rules <name> ss2 (default) plays the map-derived SS2 arithmetic;
                 placeholder plays the invented approximation
  --seed <n>     RNG seed; the same seed and the same choices replay exactly
  --hp <n>       starting health for both fighters (default 60). In the build
                 this is DERIVED (herolevel * 10 + vitality * 20) and would be
                 recomputed by battlevalues; here it is staged directly.
  --enchant <condition>[:<potency>]
                 arm BOTH fighters with an enchanted weapon, so hits can
                 inflict a condition: burning, frozen, poison or life_stolen,
                 potency 1-3 (default 3 — the strongest grade the magic shop
                 sells). A condition then TAKES ITS BEARER'S NEXT TURN: that is
                 the build's behaviour, not a penalty this tool invented.
  --armour <n>   give both fighters a breastplate and helmet of this grade
                 (default 0, no armour). SS2 subtracts damage from armour
                 first and carries only the overflow into health.
  --teams NvM    fighters a side, 1-3 each (default 1v1). Every seat is a
                 HUMAN at this keyboard; the resolver's turn order decides who
                 acts, and an attack names its target, so a 2v2 asks you which
                 foe to hit.
  --names A,B    fighter names, one per seat, red first (default
                 "Player 1,Player 2" at 1v1, otherwise "Red 1,...,Blue 1,...")
  --circuit <n>  fight n consecutive bouts, carrying the survivors between
                 them at the health and conditions the campaign record
                 measured. A fresh challenger fills the beaten side each time.
                 NOTHING heals, revives, pays or levels between bouts — but
                 armour and stamina DO come back, because the record carries
                 no resources, and the tool prints exactly what was restored
                 rather than letting it happen quietly. There is no default:
                 four fights is EP-D03 and EP-D03 is still pending.
  --help         this text
`;

/* ------------------------------------------------------------------ */
/* Presentation — no combat decisions live here                        */
/* ------------------------------------------------------------------ */

const BAR_WIDTH = 24;

function healthBar(combatant) {
  const maximum = combatant.maxHealth > 0 ? combatant.maxHealth : 1;
  const ratio = Math.max(0, Math.min(1, combatant.health / maximum));
  const filled = Math.round(ratio * BAR_WIDTH);
  return `[${"#".repeat(filled)}${".".repeat(BAR_WIDTH - filled)}]`;
}

/**
 * One pool, read straight off the projection. Shown only when the rule set's
 * blueprint actually declared it, so the placeholder's scoreboard is unchanged.
 */
function poolColumn(combatant, name, maxName) {
  if (!Object.hasOwn(combatant.resources ?? {}, name)) return "";
  const value = resourceValue(combatant, name, 0);
  const maximum = resourceValue(combatant, maxName, 0);
  return `  ${name} ${String(value).padStart(3)}/${String(maximum).padEnd(3)}`;
}

function renderScoreboard(battle) {
  const lines = [];
  for (const combatant of allCombatants(battle)) {
    const down = combatant.alive ? "" : "  (down)";
    const health = `${String(combatant.health).padStart(4)}/${String(combatant.maxHealth).padEnd(4)}`;
    const armour = poolColumn(combatant, "armourclass", "armourclass_max");
    const stamina = poolColumn(combatant, "staminaleft", "staminamax");
    // Conditions are shown by NAME. The stored token may carry its inflictor
    // (`burning:from=blue-2`), which is wire format and not something to put in
    // front of a player mid-fight.
    // `facing-left` is a status TOKEN but not a condition — it is how a string
    // (`gladiator_dir`) rides in a channel that only carries strings. Showing it
    // beside burning and frozen reads as an affliction, which it is not.
    const conditions = combatant.status
      .map((token) => ss2StatusFlagOf(token))
      .filter((flag) => flag !== SS2_FACING_LEFT);
    const status = conditions.length > 0 ? `  [${conditions.join(" ")}]` : "";
    const side = `${combatant.teamId === "red" ? "R" : "B"} `;
    lines.push(
      `  ${side}${combatant.name.padEnd(12)} ${healthBar(combatant)} ${health}${armour}${stamina}${status}${down}`
    );
  }
  return lines.join("\n");
}

/**
 * Describes what the resolver actually applied, from `battle.lastResolution`.
 * Reads the record; computes nothing.
 */
function renderResolution(battle, before) {
  const resolution = battle.lastResolution;
  if (!resolution) return "  (nothing resolved)";
  // The rule set's own verdict, read — never recomputed. This block used to
  // derive "missed" from `effect.amount === 0`, which is a COMBAT DECISION and
  // was wrong: an armour-absorbed hit deals zero hitpoint damage, so every one
  // of them was announced as a miss while the derivation line printed two
  // lines above said HIT. A verifier measured 68 of them in six seeds at
  // `--armour 4`, and none at `--armour 0` — a defect this change's own new
  // flag made reachable.
  const attack = resolution.events?.find((event) => typeof event.hit === "boolean") ?? null;
  const lines = [];
  for (const effect of resolution.effects ?? []) {
    const target = combatantById(battle, effect.targetId);
    const name = target?.name ?? effect.targetId;
    if (effect.kind === "damage") {
      const was = before.get(effect.targetId);
      const now = target?.health ?? 0;
      if (attack && attack.hit === false) lines.push(`  ${name} is missed`);
      else if (effect.amount === 0) lines.push(`  ${name} is hit, and the blow is stopped by armour`);
      else lines.push(`  ${name} takes ${effect.amount} damage  (${was} -> ${now})`);
    } else if (effect.kind === "heal") {
      lines.push(`  ${name} recovers ${effect.amount}`);
    } else if (effect.kind === "status") {
      // The token may carry its inflictor (`burning:from=p2`). A player wants
      // the condition and who did it, not the wire format.
      const condition = ss2StatusFlagOf(effect.status);
      const source = ss2StatusSourceOf(effect.status);
      const by = source === null ? "" : ` (from ${combatantById(battle, source)?.name ?? source})`;
      lines.push(`  ${name} ${effect.active === false ? "loses" : "gains"} ${condition}${by}`);
    } else if (effect.kind === "resource") {
      lines.push(`  ${name} ${effect.resource} -> ${effect.to}`);
    }
  }
  if (lines.length === 0) lines.push("  no effect");
  // The resolver stamps the knockout onto `battle.events`, not onto the rule
  // set's own event list, and its wire token is `defeated` — the constant is
  // named COMBATANT_DEFEATED but the string is the historical one network
  // clients already key off. This block read `"combatant-defeated"` and
  // `event.combatantId`, so it matched nothing and printed nothing; both are
  // taken from the constant and from `resolution.knockouts` now.
  for (const knockedOut of resolution.knockouts ?? []) {
    lines.push(`  *** ${combatantById(battle, knockedOut)?.name ?? knockedOut} is down ***`);
  }
  return lines.join("\n");
}

/**
 * The one line a player needs to see the rule set's reasoning: what it rolled,
 * what it needed, and which of SS2's twelve directions the build drew. Reads
 * the event; computes nothing. Absent for rule sets that publish no such event.
 */
function renderDerivation(battle) {
  const event = battle.lastResolution?.events?.[0];
  if (!event || event.attackDirection === undefined) return "";
  const outcome = event.hit ? `HIT (${event.dispatchedMethod})` : "miss";
  return `  direction ${event.attackDirection}   chance ${event.chance}%   ` +
    `rolled ${event.diceroll} vs ${event.rollNeeded}   ${outcome}`;
}

const STATUS_PHASE_BLURB = Object.freeze({
  "frozen-phase": "frozen solid — this turn is spent",
  "burning-phase": "burning — this turn is spent",
  "poisoned-phase": "poisoned — this turn is spent",
  "life-stolen-phase": "life stolen — this turn is spent"
});

function describeOption(battle, option) {
  const blurb = STATUS_PHASE_BLURB[option.type];
  if (blurb) return `${option.type}  (${blurb})`;
  const target = combatantById(battle, option.targetId);
  const targetName = target?.name ?? option.targetId;
  const spell = option.spellKind ? ` (${option.spellKind})` : "";
  return `${option.type}${spell} -> ${targetName}`;
}

/* ------------------------------------------------------------------ */
/* The loop                                                            */
/* ------------------------------------------------------------------ */

/** The placeholder's fighter: invented stats for an invented rule set. */
function buildPlaceholderFighter(id, name, hp) {
  return {
    id,
    name,
    controller: "local",
    stats: { strength: 10, agility: 10, attack: 40, defense: 0, vitality: 0, stamina: 5, magicka: 0 },
    loadout: { meleeDamage: 12, rangedDamage: 8, canUseRanged: false, canUseSpell: false, canHeal: false },
    maxHealth: hp,
    health: hp
  };
}

/**
 * The SS2 fighter: base stats and equipment, with every derived number — the
 * damage pair, the eight per-piece defences, the armour and stamina pools —
 * computed by the build's own `battlevalues`, not typed in here.
 *
 * The base stats below are an ARBITRARY, SYMMETRIC starting gladiator chosen so
 * a demo fight lasts a few turns. They are not a measured character; nothing in
 * the corpus says what a hot-seat duellist should be. `--hp` and `--armour`
 * move them.
 */
/**
 * `weapon_enchantment_type` -> the condition it inflicts, from the build's own
 * mapping (`damagecharacter` `+0x1bf1..+0x1dd2`, types 2/3/4/5). Inverted here
 * so a player names the condition rather than a magic number.
 */
const ENCHANTMENT_TYPE = Object.freeze({ burning: 2, frozen: 3, poison: 4, life_stolen: 5 });

function buildSs2Fighter(id, name, hp, armour, enchant) {
  const source = ss2Combatant(
    {
      strength: 5,
      speed: 5,
      attack: 5,
      defence: 5,
      vitality: 3,
      stamina: 4,
      magicka: 0,
      charisma: 3,
      herolevel: 3,
      character_level: 3,
      weapon_min_damage: 3,
      weapon_max_damage: 6,
      breastplate: armour,
      helmet: armour,
      // `weapon_enchantment_damage = ceil(weapon_max_damage / 3 * potency)` is
      // DERIVED from these two by `ss2BattleValues`, exactly as `battlevalues`
      // does at `+0x320c`. Nothing here states the damage directly.
      ...(enchant === null
        ? {}
        : { weapon_enchantment_type: enchant.type, weapon_enchantment_potency: enchant.potency }),
      // Facing is per SIDE, not per fighter: red faces right, blue faces left,
      // which is what the build's two constant start positions produce. It is
      // load-bearing rather than cosmetic — `gladiator_dir` shapes the armour
      // debris draw and the knockback direction.
      gladiator_dir: id === "p1" || id.startsWith("red-") ? "right" : "left"
    },
    { id, name, controller: "local" }
  );
  // `--hp` stages `hitpointsmax` directly. `maximumHealth` returns a declared
  // maxHealth verbatim precisely so a staged one is never quietly overruled.
  source.maxHealth = hp;
  source.health = hp;
  return source;
}

function banner(battle) {
  const descriptor = battle.rulesDescriptor;
  const goldens = descriptor.goldenFixtureIds.length;
  const rule = `rule set: ${descriptor.id}   verification: ${descriptor.verification}`;
  const warning = descriptor.verification === "runtime-verified"
    ? `  Backed by ${goldens} golden fixture(s) from the licensed build.`
    : descriptor.verification === "map-derived"
      ? "  *** MAP-DERIVED, NOT RUNTIME-VERIFIED. The attack arithmetic was read out\n" +
        `  *** of the licensed build's bytecode and replays against ${goldens} promoted\n` +
        "  *** goldens for attack directions 1-12. The stamina economy, the action\n" +
        "  *** legality and the AI around it have NO runtime backing at all, and no\n" +
        "  *** capture has ever observed this module driving a fight."
      : "  *** NOT SS2 BEHAVIOUR. These numbers are an invented approximation and\n" +
        "  *** must never be quoted as Swords & Sandals II parity.";
  return [
    "=".repeat(66),
    "  SWORDS & SANDALS II — multiplayer foundation — HOT SEAT",
    "=".repeat(66),
    `  ${rule}`,
    warning,
    descriptor.note ? `  note: ${descriptor.note}` : "",
    "=".repeat(66)
  ].filter(Boolean).join("\n");
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const rules = RULE_SETS[options.rules];
  const buildFighter = options.rules === "ss2"
    ? (id, name) => buildSs2Fighter(id, name, options.hp, options.armour, options.enchant)
    : (id, name) => buildPlaceholderFighter(id, name, options.hp);
  const solo = options.sizes[0] === 1 && options.sizes[1] === 1;
  const openingTeams = [
    {
      id: "red",
      combatants: Array.from({ length: options.sizes[0] }, (_, i) =>
        buildFighter(solo ? "p1" : `red-${i + 1}`, options.names[i]))
    },
    {
      id: "blue",
      combatants: Array.from({ length: options.sizes[1] }, (_, i) =>
        buildFighter(solo ? "p2" : `blue-${i + 1}`, options.names[options.sizes[0] + i]))
    }
  ];

  const prompter = await createPrompter();
  try {
    await runCircuit({ options, rules, buildFighter, openingTeams, prompter });
  } finally {
    prompter.close();
  }
}

/**
 * One bout, played to a result or to the player quitting.
 *
 * Extracted from `main` unchanged when `--circuit` landed, so a circuit is a
 * loop over the same fight the tool has always played rather than a second
 * implementation of it. Returns "quit" when the player left, "stalled" when no
 * legal action remained, and "settled" when the bout produced a result.
 */
async function playBout(battle, prompter) {
    while (battle.result === null) {
      const actor = currentCombatant(battle);
      if (!actor) break;
      const options_ = legalActions(battle);
      if (options_.length === 0) {
        console.log("\nNo legal action available — the fight cannot continue.");
        break;
      }

      console.log(`\n--- turn ${battle.turnNumber} — ${actor.name} (seat ${seatOf(battle, actor.id)}) ---`);
      console.log(renderScoreboard(battle));
      // A forced phase is not a choice, and presenting a menu of one invites
      // the player to think they chose it. The build takes the turn before the
      // buttons are live; this says so.
      const forcedPhase = options_.length === 1 && STATUS_PHASE_BLURB[options_[0].type];
      if (forcedPhase) {
        console.log(`\n  ${actor.name} is ${forcedPhase}. The condition takes the turn.`);
      } else {
        console.log("\n  actions:");
        options_.forEach((option, index) => {
          console.log(`    ${index + 1}) ${describeOption(battle, option)}`);
        });
      }

      const raw = await prompter.ask(forcedPhase
        ? "\n  press enter to take it (or q to quit): "
        : `\n  ${actor.name}, choose 1-${options_.length} (or q to quit): `);
      if (raw === null) {
        console.log("\n  input ended before the fight did.");
        break;
      }
      const answer = raw.trim();
      if (answer.toLowerCase() === "q") {
        console.log("\nQuit. No result recorded.");
        return "quit";
      }
      const choice = forcedPhase && answer === "" ? 1 : Number(answer);
      if (!Number.isInteger(choice) || choice < 1 || choice > options_.length) {
        console.log(`  "${answer}" is not one of 1-${options_.length}. Try again.`);
        continue;
      }

      const before = new Map(allCombatants(battle).map((c) => [c.id, c.health]));
      applyAction(battle, { actorId: actor.id, ...options_[choice - 1] });
      console.log("");
      const derivation = renderDerivation(battle);
      if (derivation) console.log(derivation);
      console.log(renderResolution(battle, before));
    }

    console.log("\n" + "=".repeat(66));
    console.log(renderScoreboard(battle));
    if (battle.result) {
      const winner = battle.teams.find((team) => team.id === battle.result.winnerTeamId);
      const names = winner ? winner.combatants.map((c) => c.name).join(", ") : battle.result.winnerTeamId;
      console.log(`\n  WINNER: ${names}   (${battle.result.reason})`);
    } else {
      console.log("\n  No result.");
    }
      // Printed from the JOURNAL, not from the cursor. The cursor is a counter the
    // runner could in principle move; the journal is the resolver's own ordered
    // record of every draw, so `journal.length === rngCursor` is a check that
    // the runner invented no roll. A test asserts the two agree.
    console.log(
      `  turns: ${battle.turnNumber}   rolls drawn: ${rngJournal(battle).length}   ` +
      `rng cursor: ${battle.rngCursor}`
    );
    console.log("=".repeat(66));
    return battle.result ? "settled" : "stalled";
}

/**
 * WHAT THE CIRCUIT PRINTS BETWEEN BOUTS, and why it is not optional.
 *
 * A campaign record carries survival, health, maxHealth and statuses, and no
 * resources. So a survivor is rebuilt from his blueprint and his ARMOUR AND
 * STAMINA COME BACK — measured, not supposed: a fighter who ended a bout at
 * armourclass 0 and staminaleft 48 re-entered the next one at 420 and 140.
 *
 * Whether armour should repair free between fights is a balance question, and
 * balance questions belong to the owner and the design track (EP-A03, which
 * has not been drafted). What this tool must not do is let the answer happen
 * by accident, so it prints the restoration every time.
 */
function renderCarry(advance) {
  const lines = [];
  if (advance.fallen.length > 0) {
    lines.push(`  fallen: ${advance.fallen.map((entry) => entry.name ?? entry.combatantId).join(", ")}`);
  }
  for (const entry of advance.restoredResources) {
    const changes = entry.changes
      .map((change) => `${change.resource} ${change.measured} -> ${change.entersAt}`)
      .join(", ");
    lines.push(`  RESTORED for ${entry.combatantId}: ${changes}`);
  }
  for (const entry of advance.facingCorrections) {
    lines.push(`  re-faced ${entry.combatantId}: now fights facing ${entry.to}`);
  }
  if (advance.seatChanges.length > 0) {
    for (const change of advance.seatChanges) {
      lines.push(`  ${change.combatantId} moves up: ${change.fromSeatId} -> slot ${change.toSlotIndex}`);
    }
  }
  return lines;
}

/**
 * The bout loop. One bout when `--circuit` is absent — byte for byte what this
 * tool did before the flag existed — and N bouts when it is present, with the
 * survivors carried between them through the campaign record.
 *
 * The carry goes through `buildCampaignRecord` and `rosterFromCampaignRecord`
 * rather than by copying the live combatants across, and that is the point of
 * the exercise: it is the campaign layer's first consumer outside its own
 * tests, so a defect in the record round-trip shows up in a fight instead of
 * staying theoretical.
 */
async function runCircuit({ options, rules, buildFighter, openingTeams, prompter }) {
  const bouts = options.circuit ?? 1;
  let teams = openingTeams;
  let blueprints = teams.flatMap((team) => team.combatants);

  for (let bout = 1; bout <= bouts; bout += 1) {
    const battle = createTeamBattle({
      // Each bout gets its own seed, derived from the run's seed and the bout
      // number, so a circuit replays exactly while no two bouts share a tape.
      seed: options.seed + bout - 1,
      rules,
      teams: teams.map((team) => ({ id: team.id, name: team.name, combatants: team.combatants }))
    });

    if (bout === 1) {
      console.log(banner(battle));
      console.log(`\n  seed ${battle.seed} — the same seed and the same choices replay exactly.`);
      if (options.circuit !== null) {
        console.log(`  CIRCUIT: ${bouts} bouts. Survivors carry their wounds; nothing heals them.`);
      }
      console.log("");
    } else {
      console.log(`\n${"#".repeat(66)}`);
      console.log(`  BOUT ${bout} of ${bouts}   seed ${battle.seed}`);
      console.log(`${"#".repeat(66)}`);
    }

    const outcome = await playBout(battle, prompter);
    if (outcome !== "settled") return;
    if (options.circuit === null) return;
    if (bout === bouts) {
      console.log(`\n  CIRCUIT COMPLETE: ${bouts} bouts fought.`);
      return;
    }

    // Settle the result so a record can be written. In a rendered build this
    // is the final animation finishing; here there is nothing to wait for, so
    // the tool acknowledges its own pending result — which it may do only
    // because it is the presentation surface, not the resolver.
    const pending = pendingResultEvent(battle);
    acknowledgeResultAnimation(battle, {
      type: BATTLE_RESULT_ACK_TYPE,
      completionToken: pending.completionToken
    });

    const challengerIndex = bout + 1;
    const beatenSide = battle.result.winnerTeamId === "red" ? "blue" : "red";
    const challengers = {
      teamId: beatenSide,
      name: beatenSide === "red" ? "Red" : "Blue",
      side: beatenSide === "red" ? CircuitSide.RIGHT : CircuitSide.LEFT,
      combatants: [buildFighter(`${beatenSide}-challenger-${challengerIndex}`, `Challenger ${challengerIndex}`)]
    };

    let advance;
    try {
      advance = advanceCircuit(battle, {
        blueprints,
        challengers,
        battleId: `hotseat-bout-${bout}`,
        recordedAt: new Date().toISOString(),
        sides: {
          red: CircuitSide.RIGHT,
          blue: CircuitSide.LEFT
        }
      });
    } catch (error) {
      console.log(`\n  The circuit cannot continue: ${error.message}`);
      return;
    }

    const carried = renderCarry(advance);
    if (carried.length > 0) {
      console.log("\n  --- carried into the next bout ---");
      for (const line of carried) console.log(line);
    }

    teams = advance.teams;
    blueprints = teams.flatMap((team) => team.combatants);
  }
}

await main();
