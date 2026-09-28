/**
 * THE AI PRESSES A NUMBERS ADVANTAGE — the owner's decisions P1, P2 and P4
 * (`docs/design/battle-ui.md#decided-ai-press-2026-09-27`).
 *
 * ► **What he saw (2026-09-26):** *"the ai on the team of 2 never makes a
 *   concerted effort to corner the single gladiator oftentimes it just dances
 *   or waits for the 1v1 to finish"*. Measured on the arena's own host
 *   (`demoSide` plain 2v2, seeds 1-96, every turn of a 2v1 phase): the free
 *   member's turns were 18% crowd-pleasers, both pair members were in reach of
 *   the lone foe on 0% of turns, and the pair finished him before losing
 *   somebody in 8 of 96 phases.
 *
 * - **P1, help first:** no crowd-pleaser while an ally fights a foe this
 *   gladiator could go and help against.
 * - **P2, going round:** out of a lane blocked by an ally, past the foe in the
 *   next lane, back in on the far side. WHEN it outranks a ranged option is
 *   the evidence question: `aiPress: "ranged-first"` keeps today's order (arm
 *   the bow, shoot, cast, taunt, then go round), `"pincer-first"` goes round
 *   ahead of all of them whenever no melee verb is on offer.
 * - **P4, finish your own fight:** a gladiator with a foe in its own lane that
 *   no ally is fighting is in a fight already, and does not leave it.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, suggestAction } from "../src/team/index.js";
import {
  createSs2TeamRules,
  ss2Combatant,
  ss2PressTarget,
  ss2TeamRules,
  SS2_ARENA,
  Ss2ActionType
} from "../src/team/ss2-rules.js";

const FRONT = SS2_ARENA.frontY;
const SECOND = SS2_ARENA.frontY - SS2_ARENA.rankStride;

const gladiator = (overrides = {}) => ({
  strength: 9, speed: 5, attack: 9, defence: 5, vitality: 5, stamina: 4,
  magicka: 0, charisma: 3, herolevel: 5, character_level: 5,
  weapon: 1,
  ...overrides
});

/**
 * A 2v1 with stated positions: red-1 fighting blue-1, red-2 the free member.
 * `free` states red-2's place and fields; blue-1 stands at x 100 in the front
 * rank unless told otherwise, red-1 at x 0 beside him, in reach.
 */
function twoOnOne({ free, lone = {}, rules = ss2TeamRules, seed = 1 }) {
  const place = (fields, id, where) => ss2Combatant(gladiator(fields), { id, name: id, controller: "local", ...where });
  return createTeamBattle({
    seed,
    rules,
    teams: [
      {
        id: "red",
        combatants: [
          place({ gladiator_dir: "right" }, "red-1", { x: 0, y: FRONT }),
          place({ gladiator_dir: "right", ...(free.fields ?? {}) }, "red-2", { x: free.x, y: free.y })
        ]
      },
      {
        id: "blue",
        combatants: [place({ gladiator_dir: "left", ...(lone.fields ?? {}) }, "blue-1", { x: lone.x ?? 100, y: lone.y ?? FRONT })]
      }
    ]
  });
}

const offered = (battle, id) => legalActions(battle, id).map((option) => option.type);
const viewFor = (battle, id) => {
  const actor = combatantById(battle, id);
  const all = battle.teams.flatMap((team) => team.combatants).filter((one) => one.alive);
  return {
    actor,
    allies: all.filter((one) => one.teamId === actor.teamId),
    foes: all.filter((one) => one.teamId !== actor.teamId)
  };
};

test("the press target is the foe an ally is fighting, and only in a battle with lanes", () => {
  const battle = twoOnOne({ free: { x: -400, y: SECOND } });
  assert.equal(ss2PressTarget(viewFor(battle, "red-2"))?.id, "blue-1", "red-1 fights blue-1, so red-2 presses him");

  // Nobody fighting him: nothing to press.
  const apart = twoOnOne({ free: { x: -400, y: SECOND }, lone: { x: 900 } });
  assert.equal(ss2PressTarget(viewFor(apart, "red-2")), null, "a foe nobody is fighting is not a press target");

  // One lane (rankStride 0): pressing is a lane tactic, so there is none.
  const flat = twoOnOne({ free: { x: -400, y: null }, rules: createSs2TeamRules({ rankStride: 0 }) });
  for (const one of flat.teams.flatMap((team) => team.combatants)) one.y = null;
  assert.equal(ss2PressTarget(viewFor(flat, "red-2")), null, "no lanes, no press");
});

test("P4: a gladiator with its own unfought foe in its lane does not leave to press", () => {
  const place = (fields, id, where) => ss2Combatant(gladiator(fields), { id, name: id, controller: "local", ...where });
  const battle = createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [place({}, "red-1", { x: 0, y: FRONT }), place({}, "red-2", { x: -400, y: SECOND })] },
      {
        id: "blue",
        combatants: [
          place({ gladiator_dir: "left" }, "blue-1", { x: 100, y: FRONT }),
          place({ gladiator_dir: "left" }, "blue-2", { x: 900, y: SECOND })
        ]
      }
    ]
  });
  assert.equal(ss2PressTarget(viewFor(battle, "red-2")), null, "blue-2 is red-2's own fight");
});

test("queued behind the ally in the foe's lane, the free member steps OUT of the lane", () => {
  // red-2 on red-1's clamp line in the front rank: the walk toward is blocked
  // (P3 withholds it), and the only way to the foe is round.
  const battle = twoOnOne({ free: { x: -86, y: FRONT } });
  assert.ok(!offered(battle, "red-2").includes(Ss2ActionType.WALK_RIGHT), "the rig's walk toward is blocked");
  assert.equal(suggestAction(battle, "red-2").type, Ss2ActionType.RANK_BACK, "out of the queue, into the next lane");
});

test("in the next lane and not yet past the foe, the free member walks toward and past him", () => {
  const battle = twoOnOne({ free: { x: -400, y: SECOND } });
  assert.equal(suggestAction(battle, "red-2").type, Ss2ActionType.WALK_RIGHT);
});

test("past the foe in the next lane, the free member steps back into his lane on the far side", () => {
  const battle = twoOnOne({ free: { x: 400, y: SECOND } });
  assert.equal(suggestAction(battle, "red-2").type, Ss2ActionType.RANK_FRONT);
});

test("P1: help first — a free member that would play to the crowd presses instead", () => {
  // Charisma high enough that the crowd arm fires for an idle gladiator safely
  // out of range and ahead; the old AI (aiPress "off") takes the crowd-pleaser
  // here, which is the rig's proof that the gate is what moved it.
  const free = { x: -400, y: SECOND, fields: { charisma: 12 } };
  const old = twoOnOne({ free, rules: createSs2TeamRules({ aiPress: "off" }) });
  assert.equal(suggestAction(old, "red-2").type, Ss2ActionType.WINCROWD, "the old AI dances here");
  const now = twoOnOne({ free });
  const chosen = suggestAction(now, "red-2").type;
  assert.notEqual(chosen, Ss2ActionType.WINCROWD, "help first: no crowd-pleaser while an ally is fighting");
  assert.equal(chosen, Ss2ActionType.WALK_RIGHT, "it presses");
});

test("the two P2 variants differ where a ranged choice or the taunt competes with going round", () => {
  // A bowman holding his sword, far out in the next lane with arrows: today's
  // order arms the bow (a foe beyond the archer's floor); pincer-first goes
  // round instead. (Pincer-first also goes round ahead of a shot or bolt on
  // offer and of the priced taunt, whenever no melee verb is on offer.)
  const free = { x: -900, y: SECOND, fields: { secondary_weapon: 61 } };
  const ranged = twoOnOne({ free, rules: createSs2TeamRules({ aiPress: "ranged-first" }) });
  assert.ok(offered(ranged, "red-2").includes(Ss2ActionType.SWAP_WEAPONS), "the rig's bowman can arm the bow");
  assert.equal(suggestAction(ranged, "red-2").type, Ss2ActionType.SWAP_WEAPONS, "ranged first arms the bow");
  const pincer = twoOnOne({ free, rules: createSs2TeamRules({ aiPress: "pincer-first" }) });
  assert.equal(suggestAction(pincer, "red-2").type, Ss2ActionType.WALK_RIGHT, "pincer first goes round");
});

test("aiPress names itself in the rule-set id when it is not the shipped default", () => {
  const shipped = createSs2TeamRules().id;
  assert.equal(createSs2TeamRules({ aiPress: "off" }).id, `${shipped}-press-off`);
  const other = ["ranged-first", "pincer-first"].map((aiPress) => createSs2TeamRules({ aiPress }).id);
  assert.ok(other.includes(shipped), "one of the two variants is the shipped default and carries no suffix");
  assert.throws(() => createSs2TeamRules({ aiPress: "sideways" }), /aiPress/);
});

test("over the arena's own bouts: no AI walk goes nowhere against a body, and no free member dances while an ally fights", async () => {
  // The owner's two playtest reports as one sweep, on the path the browser
  // arena uses (`createVanillaBattleHost` + `demoSide`). Before the fixes, on
  // these rosters: 71 walks that went nowhere on `buffs` 3v3 (seeds 1-48),
  // and 18% of the free member's 2v1 turns crowd-pleasers on plain 2v2.
  const { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } = await import("../src/adapter/index.js");
  const { ss2BattleValues, ss2WalkDestination } = await import("../src/team/ss2-rules.js");
  const { demoItemsFrom, demoSide } = await import("../tools/arena/roster.js");
  let walks = 0;
  let pressTurns = 0;
  for (const [kit, perSide] of [["", 2], ["", 3], ["buffs", 3]]) {
    for (let seed = 1; seed <= 8; seed += 1) {
      const items = demoItemsFrom(kit);
      const host = createVanillaBattleHost({
        teams: ["red", "blue"].map((side) => demoSide(side, perSide, { ss2Combatant, ss2BattleValues, items, seed })),
        rules: ss2TeamRules,
        bindings: SS2_STATIC_MAP_BINDINGS,
        seed,
        awaitAnimations: true
      });
      host.constructArena();
      for (let taken = 0; taken < 600 && !host.battle.result; taken += 1) {
        const actorId = host.currentCombatantId();
        const chosen = host.suggestAction(actorId);
        const actor = combatantById(host.battle, actorId);
        const living = host.combatantIds().map((id) => combatantById(host.battle, id)).filter((one) => one.alive);
        const view = {
          actor,
          allies: living.filter((one) => one.teamId === actor.teamId),
          foes: living.filter((one) => one.teamId !== actor.teamId)
        };
        if (ss2PressTarget(view)) {
          pressTurns += 1;
          assert.notEqual(chosen.type, Ss2ActionType.WINCROWD, `${kit || "plain"} ${perSide}v${perSide} seed ${seed}: ${actorId} danced while an ally fought`);
        }
        const from = actor.x;
        const step = host.submit({ actorId, ...chosen });
        for (const token of step.actionTokens) host.reportActionAnimation(token);
        if (/^walk-/.test(chosen.type)) {
          walks += 1;
          const direction = chosen.type === Ss2ActionType.WALK_RIGHT ? 1 : -1;
          const atWall = ss2WalkDestination({ ...actor, x: from }, [], direction) === from;
          assert.ok(combatantById(host.battle, actorId).x !== from || atWall,
            `${kit || "plain"} ${perSide}v${perSide} seed ${seed}: ${actorId} walked in place at ${from}`);
        }
      }
    }
  }
  assert.ok(walks > 100, `the sweep must walk, or it proves nothing (${walks})`);
  assert.ok(pressTurns > 20, `and must reach turns with a fight to press (${pressTurns})`);
});

/**
 * ► **THE PRESS MUST NOT PING-PONG A FIGHTER BETWEEN LANES — found by a
 *   write-nothing verifier, 2026-09-27, against the claim that it could not.**
 *   When the target's far side is already taken — both flanks held in a 3v1,
 *   or the lone foe pinned against the arena wall — going round lands the free
 *   member BEHIND an ally, which is the queue; the press then stepped him out
 *   again, and back in, forever: 99 rank steps and 0 attacks in 100 of his
 *   turns in the verifier's 3v1, and the same on the arena's own host (buffs
 *   3v3 seed 34, champions 3v3 seed 23). The old AI (`aiPress: "off"`) did not.
 */
function stagedPress(spec, aiPress) {
  const tank = { vitality: 40, herolevel: 40, character_level: 40, defence: 30 };
  const teams = ["red", "blue"].map((team) => ({
    id: team,
    combatants: spec.filter((entry) => entry[1] === team).map(([id, , x, y, sturdy]) =>
      ss2Combatant(gladiator({ gladiator_dir: team === "red" ? "right" : "left", ...(sturdy ? tank : {}),
        ...(sturdy === "boss" ? { vitality: 99, herolevel: 99, character_level: 99 } : {}) }),
      { id, name: id, controller: "local", x, y }))
  }));
  return createTeamBattle({ seed: 1, rules: createSs2TeamRules({ aiPress }), teams });
}

function rankStepsOf(battle, id, actions) {
  let steps = 0;
  let turns = 0;
  for (let taken = 0; taken < actions && !battle.result; taken += 1) {
    const actorId = currentCombatant(battle).id;
    const chosen = suggestAction(battle, actorId);
    if (actorId === id) {
      turns += 1;
      if (/^rank-/.test(chosen.type)) steps += 1;
    }
    applyAction(battle, { actorId, ...chosen });
  }
  return { steps, turns };
}

for (const aiPress of ["ranged-first", "pincer-first"]) {
  test(`${aiPress}: with both flanks held in a 3v1, the free member does not shuttle between lanes`, () => {
    const battle = stagedPress([
      ["red-1", "red", -120, FRONT, true], ["red-2", "red", 120, FRONT, true],
      ["red-3", "red", -400, SECOND, false], ["blue-1", "blue", 0, FRONT, "boss"]
    ], aiPress);
    const { steps, turns } = rankStepsOf(battle, "red-3", 200);
    assert.ok(turns >= 20, `the rig must give red-3 turns (${turns})`);
    assert.ok(steps <= 2, `red-3 took ${steps} rank steps in ${turns} turns`);
  });

  test(`${aiPress}: with the lone foe at the wall, the queued member does not circle through the next lane`, () => {
    const wall = SS2_ARENA.clamp.max;
    const battle = stagedPress([
      ["red-1", "red", wall - 120, FRONT, true], ["red-2", "red", wall - 206, FRONT, false],
      ["blue-1", "blue", wall, FRONT, "boss"]
    ], aiPress);
    const { steps, turns } = rankStepsOf(battle, "red-2", 200);
    assert.ok(turns >= 20, `the rig must give red-2 turns (${turns})`);
    assert.ok(steps <= 2, `red-2 took ${steps} rank steps in ${turns} turns`);
  });
}

/**
 * The arena's own bouts where the press ALONE drove a four-turn shuttle before
 * the far-side guard (5cb6977; every one of the four alternating steps was the
 * press's move). Measured over demo 3v3 buffs/tricks/crowd/plain, seeds 1-48:
 * bouts with a fighter alternating rank steps on four of his own turns running
 * went, ranged-first 12 -> 3 and pincer-first 11 -> 1, against the old AI's 4
 * (`aiPress: "off"`) — the remainder are chases where the allies themselves
 * hop lanes and the older rank arm answers between the press's turns, a class
 * the old AI shows too. This pins the ones that were purely the press's.
 */
const PRESS_SHUTTLES = Object.freeze([
  ["ranged-first", "buffs", 9], ["ranged-first", "buffs", 34], ["ranged-first", "tricks", 5], ["ranged-first", "tricks", 29],
  ["pincer-first", "buffs", 35], ["pincer-first", "tricks", 15], ["pincer-first", "tricks", 30], ["pincer-first", "tricks", 34],
  ["pincer-first", "tricks", 43]
]);

test("the arena's own bouts where the press alone shuttled a fighter between lanes no longer do", async () => {
  const { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } = await import("../src/adapter/index.js");
  const { ss2BattleValues } = await import("../src/team/ss2-rules.js");
  const { demoItemsFrom, demoSide } = await import("../tools/arena/roster.js");
  const shuttles = [];
  for (const [aiPress, kit, seed] of PRESS_SHUTTLES) {
    const items = demoItemsFrom(kit);
    const host = createVanillaBattleHost({
      teams: ["red", "blue"].map((side) => demoSide(side, 3, { ss2Combatant, ss2BattleValues, items, seed })),
      rules: createSs2TeamRules({ aiPress }), bindings: SS2_STATIC_MAP_BINDINGS, seed, awaitAnimations: true
    });
    host.constructArena();
    const run = new Map();
    for (let taken = 0; taken < 900 && !host.battle.result; taken += 1) {
      const actorId = host.currentCombatantId();
      const chosen = host.suggestAction(actorId);
      const last = run.get(actorId) ?? { type: null, length: 0 };
      const rank = /^rank-/.test(chosen.type);
      const next = rank
        ? { type: chosen.type, length: last.type && last.type !== chosen.type ? last.length + 1 : 1 }
        : { type: null, length: 0 };
      run.set(actorId, next);
      if (next.length === 4) shuttles.push(`${aiPress} ${kit} seed ${seed} ${actorId} at action ${taken}`);
      const step = host.submit({ actorId, ...chosen });
      for (const token of step.actionTokens) host.reportActionAnimation(token);
    }
    assert.ok(host.battle.result, `${aiPress} ${kit} seed ${seed} must still settle`);
  }
  assert.deepEqual(shuttles, [], "a fighter alternated rank steps on four of his own turns running");
});
