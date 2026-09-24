/**
 * A VERB AIMED AT A FOE TURNS ITS ACTOR TO FACE THAT FOE, BEFORE THE PHASE
 * READS HIS FACING — for every such verb, not only a swing.
 *
 * ## The ask
 *
 * The owner, 2026-09-24: *"If ranged/shouting/spell/etc is it possible to flip
 * the model of the gladiator so they are facing the way of the target they are
 * attacking?"* Swings had turned since 2026-09-23; the shots, the taunt and the
 * spells kept the facing the rule gave them — the nearest foe in the actor's
 * own lane — so above 1v1 a caster could cast with his back to his victim.
 *
 * ## Why in the engine, and not only in the drawing
 *
 * Several of those verbs sign or place on the caster's facing — the gale's
 * ±1000 (`+0x7b45`), the command's pull (`+0x7c96`), the taunt's shove
 * (`+0x69c8`), the fireball's launch side (`+0x9284`), the ghost strike's
 * landing (`+0x7e4c`). In the build's 1v1 the caster always faces his one foe,
 * so each of them means "toward" or "away from the man I aimed at". A picture
 * turned without the engine would lie: a gale drawn facing its victim while it
 * blows him through the caster. So the resolver turns the actor first
 * (`ss2TurnToTarget`), with the one rule `ss2FacingToAct` states, and the
 * presentation draws that same turn at the start of the action.
 *
 * ## What these pin
 *
 * - the list of verbs that turn, and that it is exactly the set `legalActions`
 *   offers at a foe;
 * - that the turn is the phase's FIRST effect, and fires only when the actor
 *   faces away;
 * - what it changes for each verb family whose outcome reads the facing;
 * - that 1v1 cannot see it: the actor already faces the foe he aims at.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions
} from "../src/team/index.js";
import {
  SS2_FACING_LEFT, Ss2ActionType, ss2Combatant, ss2FacingEffects, ss2FacingToAct, ss2PhysicalSize, ss2TeamRules
} from "../src/team/ss2-rules.js";

/**
 * The verbs that turn, written out here rather than imported, so the list in
 * `ss2-rules.js` has something independent to disagree with.
 */
const TURNING = Object.freeze([
  "quick-attack", "normal-attack", "power-attack", "bash-attack", "shove",
  "bombard", "snipe", "taunt", "psyche-up",
  "cast-whirlwind", "cast-ghost-strike",
  "cast-lightning-bolt", "cast-frightning-bolt",
  "cast-fireball", "cast-hell-fireball", "cast-dire-fireball",
  "cast-death-from-above", "cast-gale", "cast-command", "cast-weaken-armour", "cast-little-fat-kid"
]);

/** Level 9 (psyche's gate is 7), a full charge, and pools deep enough that nothing here dies. */
const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 60, stamina: 6,
  magicka: 7, charisma: 20, herolevel: 9, character_level: 9, weapon: 1, psyche_up: 3, ...o
});

const facing = (battle, id) => (combatantById(battle, id).status.includes(SS2_FACING_LEFT) ? "left" : "right");

/**
 * The hero between two foes in his own rank: facing `near` (his nearest), with
 * `behind` at his back. Every facing is re-derived with the resolver's own rule
 * after the positions are written, so nobody faces a way play could not reach.
 */
function trio({ hero = {}, at, rngTape = null, seed = 3 }) {
  const battle = createTeamBattle({
    seed,
    rngTape,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 40, ...hero }), { id: "hero", name: "hero", controller: "local" })] },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(fields(), { id: "near", name: "near", controller: "local" }),
          ss2Combatant(fields(), { id: "behind", name: "behind", controller: "local" })
        ]
      }
    ]
  });
  for (const [id, x] of Object.entries(at)) Object.assign(combatantById(battle, id), { x, y: 200 });
  const [red, blue] = battle.teams.map((team) => team.combatants);
  for (const effect of ss2FacingEffects(red, blue)) {
    const combatant = combatantById(battle, effect.targetId);
    const rest = combatant.status.filter((token) => token !== SS2_FACING_LEFT);
    combatant.status = effect.active ? [...rest, SS2_FACING_LEFT] : rest;
  }
  assert.equal(currentCombatant(battle).id, "hero", "the hero must open for these tests to mean anything");
  return battle;
}

/**
 * Stagings that between them get every turning verb OFFERED: melee in reach,
 * melee out of it (the taunt), a bow close (the bash) and far (the shots), and
 * every spell in some inventory. `near` is always the faced foe and `behind`
 * the one at the hero's back.
 */
const STAGINGS = Object.freeze([
  { name: "melee in reach, tricks", hero: { inventory1: 38, inventory2: 48, inventory3: 39, inventory4: 37, inventory5: 36, inventory6: 44 }, at: { hero: 0, near: 60, behind: -120 } },
  { name: "melee far, the damage spells", hero: { inventory1: 34, inventory2: 35, inventory3: 30, inventory4: 31, inventory5: 32, inventory6: 49 }, at: { hero: 0, near: 600, behind: -700 } },
  { name: "bow close", hero: { secondary_weapon: 61, equipped_weapon: 2, inventory1: 33 }, at: { hero: 0, near: 60, behind: -120 } },
  { name: "bow far", hero: { secondary_weapon: 61, equipped_weapon: 2, inventory1: 33 }, at: { hero: 0, near: 600, behind: -700 } }
]);

/* ------------------------------------------------------------------ *
 * The list                                                            *
 * ------------------------------------------------------------------ */

test("THE LIST: ss2FacingToAct turns exactly the verbs aimed at a foe, and names the side the foe stands on", () => {
  const actor = { id: "a", x: 0, status: [], resources: { psyche_up: { value: 3, min: 0, max: 3 } } };
  for (const type of Object.values(Ss2ActionType)) {
    const turns = TURNING.includes(type);
    assert.equal(ss2FacingToAct(type, actor, { id: "t", x: -100 }), turns ? "left" : null, `${type}, target on the left`);
    assert.equal(ss2FacingToAct(type, actor, { id: "t", x: 100 }), turns ? "right" : null, `${type}, target on the right`);
  }
  // Every token in the list is a real verb, so a rename cannot leave it naming nothing.
  for (const type of TURNING) assert.ok(Object.values(Ss2ActionType).includes(type), `${type} is a verb`);
});

test("NO TURN when there is no side to face: the actor himself, a co-located target, or no position", () => {
  const actor = { id: "a", x: 0, status: [], resources: { psyche_up: { value: 3, min: 0, max: 3 } } };
  assert.equal(ss2FacingToAct("cast-gale", actor, actor), null, "aimed at himself");
  assert.equal(ss2FacingToAct("cast-gale", actor, { id: "t", x: 0 }), null, "co-located: the build's strict tests leave it");
  assert.equal(ss2FacingToAct("cast-gale", actor, { id: "t", x: null }), null, "a fixture has no x");
  assert.equal(ss2FacingToAct("cast-gale", { ...actor, x: null }, { id: "t", x: 5 }), null);
  assert.equal(ss2FacingToAct("cast-gale", actor, null), null);
});

test("ONLY THE PSYCHE-UP PRESS THAT DISCHARGES TURNS: the two charges read no foe and no facing", () => {
  const at = (value) => ({ id: "a", x: 0, status: [], resources: { psyche_up: { value, min: 0, max: 3 } } });
  const target = { id: "t", x: -100 };
  assert.equal(ss2FacingToAct("psyche-up", at(0), target), null, "a stated 0 reads as fresh: a charge");
  assert.equal(ss2FacingToAct("psyche-up", at(1), target), null);
  assert.equal(ss2FacingToAct("psyche-up", at(2), target), null);
  assert.equal(ss2FacingToAct("psyche-up", at(3), target), "left", "the third press strikes, and turns");
});

test("AND THE OFFER AGREES: every option offered at a FOE turns, every option aimed at the actor does not", () => {
  const seen = new Set();
  for (const staging of STAGINGS) {
    const battle = trio(staging);
    for (const option of legalActions(battle, "hero")) {
      const target = combatantById(battle, option.targetId);
      const atFoe = target.teamId !== "red";
      assert.equal(TURNING.includes(option.type), atFoe,
        `${staging.name}: ${option.type} at ${option.targetId} is ${atFoe ? "aimed at a foe" : "aimed at the actor"}`);
      if (atFoe) seen.add(option.type);
    }
  }
  assert.deepEqual([...seen].sort(), [...TURNING].sort(), "the stagings offered every turning verb, so none is unchecked");
});

/* ------------------------------------------------------------------ *
 * The turn, in the resolver                                           *
 * ------------------------------------------------------------------ */

test("A TURN IS THE PHASE'S FIRST EFFECT, for every verb offered at the man behind — and there is none at the man in front", () => {
  let turned = 0;
  let faced = 0;
  for (const staging of STAGINGS) {
    for (const option of legalActions(trio(staging), "hero")) {
      if (!TURNING.includes(option.type)) continue;
      const battle = trio(staging);
      applyAction(battle, { actorId: "hero", ...option });
      const first = battle.lastResolution.effects[0];
      const isTurn = first?.kind === "status" && first.status === SS2_FACING_LEFT && first.targetId === "hero";
      if (option.targetId === "behind") {
        assert.deepEqual(first, { kind: "status", targetId: "hero", status: SS2_FACING_LEFT, active: true },
          `${staging.name}: ${option.type} at the man behind turns the hero LEFT first`);
        turned += 1;
      } else {
        assert.equal(isTurn, false, `${staging.name}: ${option.type} at the man he faces turns nobody first`);
        faced += 1;
      }
    }
  }
  assert.ok(turned >= TURNING.length - 2 && faced > 0, `checked ${turned} turns and ${faced} verbs at the faced foe`);
});

/* ------------------------------------------------------------------ *
 * What it changes: the verbs that read the caster's facing            *
 * ------------------------------------------------------------------ */

const AT = { hero: 0, near: 150, behind: -400 };
const FAR = { hero: 0, near: 600, behind: -700 };

test("A GALE at the man behind blows him AWAY, as every 1v1 gale does — not through the caster", () => {
  // Before 2026-09-24: +1000 on the caster's facing (right, to `near`), so
  // `behind` went -400 -> 600, straight through him.
  const battle = trio({ hero: { inventory1: 38 }, at: AT });
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.CAST_GALE, targetId: "behind" });
  const event = battle.events.find((entry) => entry.type === Ss2ActionType.CAST_GALE);
  assert.deepEqual([event.force, event.targetFrom, event.targetTo], [-1000, -400, -1400]);
  assert.equal(facing(battle, "hero"), "right", "and with `behind` blown away the caster faces `near` again");
});

test("A COMMAND at the man behind PULLS him to the stand-off, as every 1v1 command does — not 40 further away", () => {
  // Before 2026-09-24: -40 on the caster's facing, one frame, -400 -> -440.
  // Now, facing left: need 400 - 86 = 314, eight frames of +40, landing at -80.
  const battle = trio({ hero: { inventory1: 39 }, at: AT });
  assert.equal(ss2PhysicalSize(combatantById(battle, "behind")), 86);
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.CAST_COMMAND, targetId: "behind" });
  const event = battle.events.find((entry) => entry.type === Ss2ActionType.CAST_COMMAND);
  assert.deepEqual([event.targetFrom, event.targetTo, event.pullTicks, event.cutByWatchdog], [-400, -80, 8, false]);
  assert.equal(facing(battle, "hero"), "left", "`behind` is now the nearer foe, and the caster still faces him");
});

test("A TAUNT's shove at the man behind drives him AWAY from the taunter — not back through him", () => {
  // The tape forces effect 2 on a melee defender: the shove. Before 2026-09-24
  // it was +500 on the taunter's facing, -700 -> -200.
  const battle = trio({
    at: FAR,
    rngTape: [
      { label: "taunt-roll", source: "randomBetween", min: 1, max: 100, value: 1 },
      { label: "taunt-effect-roll", source: "randomBetween", min: 1, max: 2, value: 2 }
    ]
  });
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.TAUNT, targetId: "behind" });
  const event = battle.events.find((entry) => entry.type === Ss2ActionType.TAUNT);
  assert.deepEqual([event.effect, event.force, event.from, event.to], [2, -500, -700, -1200]);
});

test("A FIREBALL at the man behind LEAVES toward him: its event carries the facing the caster turned to", () => {
  // The damage lands at once either way; the launch side (`+0x9284`) is the
  // presentation's, and it read "right" — away from its victim — before.
  const battle = trio({
    hero: { inventory1: 30 },
    at: AT,
    rngTape: [{ label: "fireball-damage-roll", source: "randomBetween", min: 80, max: 160, value: 80 }]
  });
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.CAST_FIREBALL, targetId: "behind" });
  const event = battle.events.find((entry) => entry.type === Ss2ActionType.CAST_FIREBALL);
  assert.equal(event.gladiatorDir, "left");
  assert.equal(facing(battle, "hero"), "left", "nothing moved or died, so the caster stays turned");
});

test("A SHOT at the man behind is loosed facing him, and he stays faced until something moves", () => {
  const battle = trio({ hero: { secondary_weapon: 61, equipped_weapon: 2 }, at: FAR });
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.BOMBARD, targetId: "behind" });
  assert.deepEqual(battle.lastResolution.effects[0], { kind: "status", targetId: "hero", status: SS2_FACING_LEFT, active: true });
  assert.equal(facing(battle, "hero"), "left");
});

/* ------------------------------------------------------------------ *
 * 1v1 cannot see it                                                   *
 * ------------------------------------------------------------------ */

test("1v1: before every verb aimed at the foe, the actor ALREADY faces him — so the turn never fires", () => {
  // A separated 1v1 pair faces each other after every write of an `x`, and a
  // co-located one has no side to turn to. Driven by a deterministic pick among
  // ALL legal options (not the AI), so casts, shots and taunts land at every
  // distance. The 1,100-bout before/after measurement is in the commit.
  const kits = [
    { inventory1: 38, inventory2: 39, inventory3: 36, inventory4: 37, inventory5: 44, inventory6: 48 },
    { inventory1: 34, inventory2: 30, inventory3: 31, inventory4: 33 },
    { secondary_weapon: 61 }
  ];
  let aimed = 0;
  for (let seed = 1; seed <= 12; seed += 1) {
    const kit = kits[seed % kits.length];
    const battle = createTeamBattle({
      seed,
      rules: ss2TeamRules,
      teams: [
        { id: "red", name: "red", combatants: [ss2Combatant(fields({ vitality: 20, ...kit }), { id: "r", name: "r", controller: "local" })] },
        { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ vitality: 20, ...kit }), { id: "b", name: "b", controller: "local" })] }
      ]
    });
    let state = seed * 7919;
    for (let step = 0; step < 300 && !battle.result; step += 1) {
      const actor = currentCombatant(battle);
      const options = legalActions(battle, actor.id);
      state = (state * 1103515245 + 12345) % 2147483648;
      const option = options[state % options.length];
      const target = combatantById(battle, option.targetId);
      const wanted = ss2FacingToAct(option.type, actor, target);
      if (wanted !== null) {
        aimed += 1;
        assert.equal(wanted, facing(battle, actor.id), `seed ${seed} step ${step}: ${option.type} — the actor already faces his foe`);
      }
      applyAction(battle, { actorId: actor.id, ...option });
      if (wanted !== null) {
        const first = battle.lastResolution.effects[0];
        assert.ok(!(first?.kind === "status" && first.status === SS2_FACING_LEFT && first.targetId === actor.id),
          `seed ${seed} step ${step}: ${option.type} turned nobody first`);
      }
    }
  }
  assert.ok(aimed > 500, `enough verbs aimed at a foe to mean something (${aimed})`);
});
