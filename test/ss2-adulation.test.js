/**
 * `cast_adulation` (item 47) — the one verb whose WHOLE effect is on the crowd.
 *
 * Re-derived 2026-09-22 from `sprite:862[overlay]/frame:52/DoAction@0x240c7f`
 * (base `0x240c85`), `+0x76ae`-`+0x777b`, and the villain ladder in
 * `DoAction@0x23e7cf` (base `0x23e7d5`):
 *
 * ```text
 *   phase_decision == "cast_adulation"                               +0x76ae
 *     _global.crowd_action = 50                  (EVERY tick)         +0x76c1
 *     game_attacker.staminacost = Math.round(game_attacker.magicka)   +0x76ce
 *     if (attacker.struck == null) {                                  +0x76f5
 *       cast_spell_icon(attacker, 47)                                 +0x770c
 *       attacker.struck = false                                       +0x7724
 *       attacker.gotoAndPlay("wincrowd1")                             +0x7732
 *     }
 *     if (attacker.struck == true) { attacker.struck = null; nextphase() }  +0x7747-+0x777b
 *   (no Jump: falls through into the cast_weaken_armour test at +0x777c)
 *
 *   villain_cast_spells, arm 28 — the LAST arm:
 *     check_inventory(47) == true && _root.arena.fightdistance > 300  +0x100a-+0x1040
 *     villaindecisionA = "cast_adulation"; use_item(item_used)        +0x1045-+0x105e
 * ```
 *
 * No `randomBetween`, no `RandomNumber`, no `defender`, no `game_defender`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, lastResolvedAction, legalActions,
  rngJournal, suggestAction, toTeamWireState
} from "../src/team/index.js";
import {
  SS2_ADULATION, SS2_FACING_LEFT, SS2_INVENTORY_EMPTY, Ss2ActionType, VANILLA_PHASE_LABEL, ss2Combatant, ss2TeamRules
} from "../src/team/ss2-rules.js";
import { ss2CrowdInterestOf } from "../src/team/ss2-crowd.js";
import {
  buildArenaLayout, CommandKind, LabelProvenance, presentResolvedEvents, SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";

const ADULATION = Ss2ActionType.CAST_ADULATION;

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

function face(battle, id, left) {
  const combatant = combatantById(battle, id);
  combatant.status = combatant.status.filter((token) => token !== SS2_FACING_LEFT);
  if (left) combatant.status.push(SS2_FACING_LEFT);
}

/** Hero at 0 facing right, foe `gap` away facing left; `controller` for both. */
function staged({ hero = {}, foe = {}, gap = 100, controller = "local", heroFirst = true } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [ss2Combatant(fields({ speed: heroFirst ? 21 : 19, ...hero }), { id: "hero", name: "hero", controller })] },
      { id: "blue", combatants: [ss2Combatant(fields({ vitality: 30, ...foe }), { id: "foe", name: "foe", controller })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: 0, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: gap, y: 200 });
  face(battle, "hero", false);
  face(battle, "foe", true);
  return battle;
}

const crowd = (battle) => ss2CrowdInterestOf(toTeamWireState(battle));
const offered = (battle, id = "hero") =>
  legalActions(battle, id).filter((option) => option.type === ADULATION).map((option) => option.targetId);
const value = (battle, id, name) => combatantById(battle, id).resources[name]?.value;

/* ------------------------------------------------------------------ *
 * The vocabulary and the constants                                    *
 * ------------------------------------------------------------------ */

test("the token round-trips to the build's own label, cast_adulation", () => {
  assert.equal(ADULATION, "cast-adulation");
  assert.equal(VANILLA_PHASE_LABEL[ADULATION], "cast_adulation"); // `+0x76b4`
  assert.ok(ss2TeamRules.actionTypes.includes(ADULATION));
});

test("the constants are the build's literals", () => {
  assert.deepEqual({ ...SS2_ADULATION }, {
    itemId: 47,            // cast_spell_icon(attacker, 47) +0x770c; check_inventory(47) +0x100a
    casterClip: "wincrowd1", // +0x7732
    crowdAction: 50,       // +0x76c1
    ladderArm: 28,
    aiFightDistanceAbove: 300 // +0x1036, Greater
  });
});

/* ------------------------------------------------------------------ *
 * The offer                                                           *
 * ------------------------------------------------------------------ */

test("offered ONCE, aimed at the caster, on possession alone — at any distance", () => {
  assert.deepEqual(offered(staged({ hero: { inventory3: 47 } })), ["hero"]);
  assert.deepEqual(offered(staged({ hero: { inventory3: 47 }, gap: 1200 })), ["hero"]);
  assert.deepEqual(offered(staged()), [], "nothing held, nothing offered");
  assert.deepEqual(offered(staged({ hero: { inventory1: 48 } })), [], "a different item is not the verb");
});

test("the slot window applies: a 47 beyond inventory_maxslots is not offered", () => {
  assert.deepEqual(offered(staged({ hero: { inventory6: 47, inventory_maxslots: 3 } })), []);
  assert.deepEqual(offered(staged({ hero: { inventory3: 47, inventory_maxslots: 3 } })), ["hero"]);
});

/* ------------------------------------------------------------------ *
 * The phase                                                           *
 * ------------------------------------------------------------------ */

test("the whole effect is +50 on the crowd, the slot spent, round(magicka) paid, and not one draw", () => {
  const battle = staged({ hero: { inventory2: 47, magicka: 7.6 } });
  assert.equal(currentCombatant(battle).id, "hero");
  assert.equal(crowd(battle), 10);
  const draws = rngJournal(battle).length;
  const foeBefore = JSON.stringify(combatantById(battle, "foe"));
  applyAction(battle, { actorId: "hero", type: ADULATION, targetId: "hero" });
  assert.equal(crowd(battle), 60, "10 + 50 (+0x76c1)");
  assert.equal(value(battle, "hero", "inventory2"), SS2_INVENTORY_EMPTY, "the item is used");
  assert.equal(rngJournal(battle).length, draws, "no randomBetween and no RandomNumber in the arm");
  assert.equal(JSON.stringify(combatantById(battle, "foe")), foeBefore, "the arm never reads or writes the defender");
  const event = lastResolvedAction(battle).events.find((entry) => entry.type === ADULATION);
  assert.deepEqual(
    { ...event, staminaGained: undefined, healed: undefined },
    {
      type: ADULATION,
      actorId: "hero",
      targetId: "hero",
      vanillaLabel: "cast_adulation",
      casterClip: "wincrowd1",
      spellId: 47,
      consumedSlot: "inventory2",
      staminaSpent: 8,
      staminaGained: undefined,
      healed: undefined
    }
  );
});

test("it is an ordinary completed phase: nextphase pays round(magicka), regenerates, and clamps the crowd at 100", () => {
  const battle = staged({ hero: { inventory1: 47, herolevel: 40 }, foe: { herolevel: 30 } });
  assert.equal(crowd(battle), 70);
  const staminaBefore = value(battle, "hero", "staminaleft");
  applyAction(battle, { actorId: "hero", type: ADULATION, targetId: "hero" });
  assert.equal(crowd(battle), 100, "70 + 50 = 120, and `> 100` sets 100");
  const event = lastResolvedAction(battle).events[0];
  // staminacost 7, then `+ 1 + round(stamina / 3)` = 3, floored and capped by check_stats.
  assert.equal(value(battle, "hero", "staminaleft") - staminaBefore, event.staminaGained);
  assert.equal(event.staminaGained, Math.min(-7 + 3, value(battle, "hero", "staminamax") - staminaBefore));
});

test("a presented adulation plays wincrowd1 on the caster, MAP_NAMED, and nothing on anybody else", () => {
  const battle = staged({ hero: { inventory1: 47 } });
  applyAction(battle, { actorId: "hero", type: ADULATION, targetId: "hero" });
  const wire = toTeamWireState(battle);
  const { commands } = presentResolvedEvents(wire, { layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS });
  const clips = commands.filter((command) => command.kind === CommandKind.CLIP_GOTO);
  assert.deepEqual(
    clips.map(({ combatantId, role, label, labelProvenance }) => ({ combatantId, role, label, labelProvenance })),
    [{ combatantId: "hero", role: "actor", label: "wincrowd1", labelProvenance: LabelProvenance.MAP_NAMED }]
  );
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), []);
});

/* ------------------------------------------------------------------ *
 * The villain's ladder arm 28                                          *
 * ------------------------------------------------------------------ */

test("arm 28: an AI holding 47 casts it when its foe stands beyond 300, strictly, and not at 300", () => {
  const ai = (gap, hero = {}) => staged({ controller: "ai", gap, hero: { inventory1: 47, ...hero } });
  assert.equal(suggestAction(ai(301), "hero").type, ADULATION);
  assert.notEqual(suggestAction(ai(300), "hero").type, ADULATION, "Greater, not >=");
  assert.notEqual(suggestAction(ai(150), "hero").type, ADULATION);
});

test("arm 28 is the LAST arm: swift sandals (arm 27, the same > 300) pre-empts it", () => {
  const battle = staged({ controller: "ai", gap: 500, hero: { inventory1: 47, inventory2: 40 } });
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_SWIFTSANDALS);
});
