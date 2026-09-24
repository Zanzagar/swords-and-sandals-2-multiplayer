/**
 * THE TEAM HUD OVER WHOLE BOUTS (H2, H3 of `docs/design/battle-ui.md`,
 * "Team HUD, reach preview and the camera: DECIDED"): real bouts through the
 * arena's own host, seated as `tools/arena/main.js` seats them, with
 * `teamHudFor` read after EVERY action and every row held to the engine's own
 * live state — `host.battle`, not the wire projection the model reads.
 *
 * And the HUD is presentation only: reading it after every action leaves the
 * state-hash sequence of a spectated bout exactly what it is without it.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } from "../src/adapter/index.js";
import { ss2BattleValues, ss2Combatant, ss2TeamRules } from "../src/team/ss2-rules.js";
import { ss2CrowdInterestOf } from "../src/team/ss2-crowd.js";
import { resourceValue } from "../src/team/resources.js";
import { crowdHeardFor } from "../src/render/crowd-sound.js";
import { demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { seatControllersFrom, withSeatControllers } from "../tools/arena/seats.js";
import { teamHudFor } from "../tools/arena/team-hud.js";

const deps = { ss2Combatant, ss2BattleValues };

/**
 * A weapon enchantment on every member of a side, so a bout reaches the conditions: no demo
 * fighter carries one. Types 1-5 are what the build's champions carry; the damage is set on both
 * the mirror and the canonical record, which the host checks agree.
 */
function enchanted(side, type) {
  const fields = { weapon_enchantment_type: type, weapon_enchantment_potency: 3, weapon_enchantment_damage: 9 };
  return { ...side, members: side.members.map((member) => ({ ...member, vanilla: { ...member.vanilla, ...fields }, resources: { ...member.resources, ...fields } })) };
}

/** The arena's host for a query string, seated as `main.js` seats it. */
function seatedHost({ perSide, seed, kit = "", query = "", enchant = null }) {
  const items = demoItemsFrom(kit);
  let teams = [demoSide("red", perSide, { ...deps, items, seed }), demoSide("blue", perSide, { ...deps, items, seed })];
  if (enchant) teams = teams.map((side, index) => enchanted(side, enchant[index]));
  const seats = seatControllersFrom(new URLSearchParams(query), teams);
  const host = createVanillaBattleHost({
    teams: withSeatControllers(teams, seats), rules: ss2TeamRules, bindings: SS2_STATIC_MAP_BINDINGS, seed
  });
  // `main.js`'s `crowdHeard`: the opening levels, read before any experience.
  const crowdShown = crowdHeardFor(host.battle.teams.flatMap((team) => team.combatants.map((c) => resourceValue(c, "herolevel", Number.NaN))));
  return { host, seats, crowdShown };
}

/** The four conditions' words and the taunt's, spelled here from the build's splat words, not the module's table. */
const WORDS = { frozen: "Frozen", burning: "Burning", poison: "Poisoned", life_stolen: "Wraith", taunted1: "Taunted", taunted2: "Taunted" };
const ORDER = ["frozen", "burning", "poison", "life_stolen", "taunted1"];
function expectedChips(status) {
  const flags = new Set(status.map((token) => token.split(":from=")[0]));
  if (flags.has("taunted2")) flags.add("taunted1");
  return ORDER.filter((flag) => flags.has(flag)).map((flag) => WORDS[flag]);
}

/** Holds every row of the model to the engine's live state; returns the chip words seen. */
function holdsToEngine(host, seats, crowdShown, where) {
  const hud = teamHudFor({ wire: host.wire(), seats, crowdShown });
  const battle = host.battle;
  const acting = host.currentCombatantId();
  assert.equal(hud.actingId, acting, `${where}: whose turn`);
  assert.equal(hud.crowd.value, ss2CrowdInterestOf(battle), `${where}: the crowd`);
  assert.equal(hud.crowd.shown, crowdShown);
  assert.deepEqual(hud.teams.map((team) => team.teamId), ["red", "blue"], `${where}: red, then blue`);
  const seen = [];
  const rows = hud.teams.flatMap((team) => team.rows);
  assert.equal(rows.length, battle.teams.flatMap((team) => team.combatants).length, `${where}: one row per fighter`);
  for (const team of battle.teams) {
    const panel = hud.teams.find((candidate) => candidate.teamId === team.id);
    assert.deepEqual(panel.rows.map((row) => row.id), team.combatants.map((c) => c.id), `${where}: ${team.id}'s rows in slot order`);
    assert.equal(panel.standing, team.combatants.filter((c) => c.alive).length);
    for (const combatant of team.combatants) {
      const row = panel.rows.find((candidate) => candidate.id === combatant.id);
      const at = `${where} ${combatant.id}`;
      assert.equal(row.name, combatant.name, at);
      assert.equal(row.alive, combatant.alive, `${at}: alive`);
      assert.equal(row.acting, combatant.id === acting, `${at}: acting`);
      assert.deepEqual([row.health.value, row.health.max], [combatant.health, combatant.maxHealth], `${at}: health`);
      assert.deepEqual([row.energy.value, row.energy.max],
        [combatant.resources.staminaleft.value, combatant.resources.staminamax.value], `${at}: energy`);
      const armour = combatant.resources.armourclass.value;
      assert.deepEqual([row.armour.value, row.armour.max, row.armour.shown],
        [armour, combatant.resources.armourclass_max.value, armour > 0], `${at}: armour`);
      for (const reading of [row.health, row.energy, row.armour]) {
        assert.ok(reading.percent >= 0 && reading.percent <= 100, `${at}: a bar is 0-100`);
      }
      const chips = row.conditions.map((chip) => chip.words);
      assert.deepEqual(chips, expectedChips(combatant.status), `${at}: chips for ${JSON.stringify(combatant.status)}`);
      seen.push(...chips);
      // The "you" marker: a person's seat in a play= bout; nothing when spectating.
      const expectedSeat = seats.mode === "play" ? (seats.humans.includes(combatant.id) ? "you" : "AI") : null;
      assert.equal(row.seat, expectedSeat, `${at}: seat`);
      assert.equal(row.you, expectedSeat === "you");
    }
  }
  return { hud, seen };
}

/** Plays a bout to its end, every seat by the rule set's own choice, holding the HUD to the engine after each action. */
function playHeld(options, onEach = () => {}) {
  const { host, seats, crowdShown } = seatedHost(options);
  const where = `${options.perSide}v${options.perSide} ${options.kit || "plain"} seed ${options.seed} ${options.query || "(no seats)"}`;
  const seen = new Set();
  let actions = 0;
  for (; ; actions += 1) {
    const held = holdsToEngine(host, seats, crowdShown, `${where} after ${actions}`);
    for (const words of held.seen) seen.add(words);
    onEach(held.hud, host);
    if (host.battle.result) break;
    assert.ok(actions < 4000, `${where} never finished`);
    const actorId = host.currentCombatantId();
    host.submit({ ...host.suggestAction(actorId), actorId });
  }
  return { host, actions, seen };
}

test("H2: whole bouts — every row of both panels equals the engine after every action (1v1-3v3, plain and tricks, play= and spectate)", () => {
  let bouts = 0;
  let checks = 0;
  for (const perSide of [1, 2, 3]) {
    for (const kit of ["", "tricks"]) {
      for (const seed of [1, 2, 3]) {
        for (const query of ["play=red", "spectate=1", "play=blue-1"]) {
          if (query === "play=blue-1" && perSide === 1 && seed > 1) continue;
          const { actions, host } = playHeld({ perSide, kit, seed, query });
          assert.ok(host.battle.result, "the bout was decided");
          bouts += 1;
          checks += actions + 1;
        }
      }
    }
  }
  assert.ok(bouts >= 50 && checks > 2000, `the sweep is not empty (${bouts} bouts, ${checks} checks)`);
});

test("H2: the conditions in real bouts — every one the engine gives a fighter is a chip in plain words, and all four damage conditions are reached", () => {
  const seen = new Set();
  for (const enchant of [[1, 2], [3, 4], [5, 2]]) {
    for (const seed of [1, 2, 3]) {
      for (const word of playHeld({ perSide: 3, seed, query: "spectate=1", enchant }).seen) seen.add(word);
    }
  }
  for (const word of ["Burning", "Frozen", "Poisoned", "Wraith"]) assert.ok(seen.has(word), `the sweep reached ${word} (${[...seen]})`);
});

test("H2: the HUD is presentation only — a spectated bout's state-hash sequence is the same read after every action or never", () => {
  for (const [perSide, kit, seed] of [[3, "tricks", 2], [2, "", 5], [1, "tricks", 4]]) {
    const plain = seatedHost({ perSide, kit, seed, query: "spectate=1" }).host;
    const bare = [plain.hash()];
    while (!plain.battle.result) {
      const actorId = plain.currentCombatantId();
      plain.submit({ ...plain.suggestAction(actorId), actorId });
      bare.push(plain.hash());
    }
    const read = [];
    playHeld({ perSide, kit, seed, query: "spectate=1" }, (hud, host) => read.push(host.hash()));
    assert.deepEqual(read, bare, `${perSide}v${perSide} ${kit || "plain"} seed ${seed}`);
  }
});
