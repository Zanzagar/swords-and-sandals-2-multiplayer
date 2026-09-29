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
  ss2PressGoal,
  ss2PressMove,
  ss2PressTarget,
  ss2TeamRules,
  SS2_ARENA,
  Ss2ActionType
} from "../src/team/ss2-rules.js";

const FRONT = SS2_ARENA.frontY;
const SECOND = SS2_ARENA.frontY - SS2_ARENA.rankStride;
const THIRD = SS2_ARENA.frontY - 2 * SS2_ARENA.rankStride;

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

test("past the foe in the next lane, the free member steps back into his lane on the far side — once within one walk of it", () => {
  // ~~Stepped in from wherever he stood past the foe.~~ Since 2026-09-28 he
  // heads for the far-side SPOT (one body-width past the target, x 186 here)
  // and steps in only within one walk of it (`ss2PressMove`, the goal spot);
  // from further out, stepping in opened the long-range taunt (a verifier).
  const far = twoOnOne({ free: { x: 400, y: SECOND } });
  assert.equal(suggestAction(far, "red-2").type, Ss2ActionType.WALK_LEFT, "from 214 away, walk to the spot first");
  const near = twoOnOne({ free: { x: 250, y: SECOND } });
  assert.equal(suggestAction(near, "red-2").type, Ss2ActionType.RANK_FRONT, "within one walk, step in");
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
  ["pincer-first", "tricks", 43],
  // Added 2026-09-28: the bouts that shuttled only at 92f9701 (a fourth
  // verifier's census; none shuttles at 74c0014). The last field is the side size.
  ["ranged-first", "tricks", 46], ["ranged-first", "buffs", 6, 2], ["pincer-first", "buffs", 6, 2],
  ["ranged-first", "buffs", 11, 2], ["pincer-first", "buffs", 11, 2],
  // Added 2026-09-28: a sixth verifier's census (seeds 97-400), the same at
  // 06beab0 and ab56337. The press stepped red-1 out of the queue in the
  // middle lane; when a knockback took its target out of reach, the rank arm
  // stepped it back toward a foe TWO lanes away, which lands in the middle
  // lane, the queue, and its guard read only the nearest foe's own lane.
  ["ranged-first", "tricks", 338]
]);

test("the arena's own bouts where the press alone shuttled a fighter between lanes no longer do", async () => {
  const { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } = await import("../src/adapter/index.js");
  const { ss2BattleValues } = await import("../src/team/ss2-rules.js");
  const { demoItemsFrom, demoSide } = await import("../tools/arena/roster.js");
  const shuttles = [];
  for (const [aiPress, kit, seed, perSide = 3] of PRESS_SHUTTLES) {
    const items = demoItemsFrom(kit);
    const host = createVanillaBattleHost({
      teams: ["red", "blue"].map((side) => demoSide(side, perSide, { ss2Combatant, ss2BattleValues, items, seed })),
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
      if (next.length === 4) shuttles.push(`${aiPress} ${kit} ${perSide}v${perSide} seed ${seed} ${actorId} at action ${taken}`);
      const step = host.submit({ actorId, ...chosen });
      for (const token of step.actionTokens) host.reportActionAnimation(token);
    }
    assert.ok(host.battle.result, `${aiPress} ${kit} seed ${seed} must still settle`);
  }
  assert.deepEqual(shuttles, [], "a fighter alternated rank steps on four of his own turns running");
});

/**
 * ► **ONLY A MELEE FIGHTER HOLDS A SIDE OF THE TARGET — a write-nothing
 *   verifier's finding, 2026-09-27, against 74c0014.** "Fighting" read
 *   `ss2Reach`, which with a bow drawn is the BOW's reach (4,485 on the demo
 *   archer), so an ally shooting from far down the target's lane counted as
 *   holding the far side: the free member queued behind a melee ally judged
 *   the pincer shut and taunted from the queue for 27 turns running, and one
 *   in the next lane was judged already round and stepped into the queue. The
 *   press target is still the foe any ally fights, the bow included (P1: the
 *   free member helps rather than dances); which SIDE is taken is melee only.
 */
function withShooter(free) {
  const battle = twoOnOne({ free });
  const shooter = ss2Combatant(gladiator({ gladiator_dir: "left", secondary_weapon: 61, equipped_weapon: 2 }),
    { id: "red-3", name: "red-3", controller: "local", x: 1500, y: FRONT });
  return createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [...battle.teams[0].combatants.map((one) => ss2Combatant(gladiator({ gladiator_dir: "right" }),
        { id: one.id, name: one.id, controller: "local", x: one.x, y: one.y })), shooter] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "blue-1", name: "blue-1", controller: "local", x: 100, y: FRONT })] }
    ]
  });
}

test("an ally shooting from the far end of the lane does not hold the far side: the queued member still goes round", () => {
  const battle = withShooter({ x: -86, y: FRONT });
  assert.equal(combatantById(battle, "red-3").resources.equipped_weapon.value, 2, "the rig's shooter has the bow drawn");
  assert.equal(ss2PressTarget(viewFor(battle, "red-2"))?.id, "blue-1");
  const move = ss2PressMove(viewFor(battle, "red-2"), legalActions(battle, "red-2"), combatantById(battle, "blue-1"));
  assert.equal(move?.type, Ss2ActionType.RANK_BACK, "out of the queue, as without the shooter");
});

test("and a member in the next lane is not judged already round because a shooter stands beyond the target", () => {
  const battle = withShooter({ x: -400, y: SECOND });
  const move = ss2PressMove(viewFor(battle, "red-2"), legalActions(battle, "red-2"), combatantById(battle, "blue-1"));
  assert.equal(move?.type, Ss2ActionType.WALK_RIGHT, "walk toward and past, as without the shooter");
});

test("with only a shooter on the target, the free member closes on his near side, rather than going round", () => {
  // No melee fighter at all: no side is taken, so there is nothing to go round.
  const place = (fields, id, where) => ss2Combatant(gladiator(fields), { id, name: id, controller: "local", ...where });
  const battle = createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [
        place({ gladiator_dir: "left", secondary_weapon: 61, equipped_weapon: 2 }, "red-1", { x: 1500, y: FRONT }),
        place({ gladiator_dir: "right" }, "red-2", { x: -400, y: SECOND })
      ] },
      { id: "blue", combatants: [place({ gladiator_dir: "left" }, "blue-1", { x: 100, y: FRONT })] }
    ]
  });
  assert.equal(ss2PressTarget(viewFor(battle, "red-2"))?.id, "blue-1", "a foe an ally is shooting at is one to help against (P1)");
  // ~~Steps into his lane at once.~~ Since 2026-09-28: walks toward his near
  // spot (x 14) in its own lane first, and steps in within one walk of it —
  // stepping in from afar opened the long-range taunt (a verifier's finding).
  const move = ss2PressMove(viewFor(battle, "red-2"), legalActions(battle, "red-2"), combatantById(battle, "blue-1"));
  assert.equal(move?.type, Ss2ActionType.WALK_RIGHT, "from 414 away, walk first");
  combatantById(battle, "red-2").x = -50;
  const close = ss2PressMove(viewFor(battle, "red-2"), legalActions(battle, "red-2"), combatantById(battle, "blue-1"));
  assert.equal(close?.type, Ss2ActionType.RANK_FRONT, "within one walk, step in");
});

/**
 * ► **THE PRESS HEADS FOR AN OPEN SPOT BESIDE THE TARGET, AND ENTERS HIS LANE
 *   ONLY WITHIN ONE WALK OF IT — a fourth write-nothing verifier's findings,
 *   2026-09-28, against 92f9701.** With only a drawn bow on the target (no side
 *   held in melee), the press stepped the free member into the target's lane
 *   from wherever he stood: from ~1,800 away that opened the priced taunt,
 *   which ranged-first ranks above the press, and he taunted 8 turns running
 *   instead of closing (champions 3v3 seed 28); and queued behind the archer
 *   in the target's lane he was stepped out, found his landing still behind
 *   the archer, and the older join arm stepped him back in, turn after turn
 *   (tricks 3v3 seed 46). Neither happened at 74bb257.
 */
function stagedRun(spec, { aiPress = "ranged-first", actions = 120, seed = 1 } = {}) {
  const sturdy = { vitality: 60, herolevel: 60, character_level: 60, defence: 30 };
  const teams = ["red", "blue"].map((team) => ({
    id: team,
    combatants: spec.filter((entry) => entry.team === team).map((entry) =>
      ss2Combatant(gladiator({ gladiator_dir: team === "red" ? "right" : "left",
        ...(entry.sturdy ? sturdy : {}), ...(entry.bow ? { secondary_weapon: 61, equipped_weapon: 2 } : {}),
        ...(entry.fields ?? {}) }),
      { id: entry.id, name: entry.id, controller: "local", x: entry.x, y: entry.y }))
  }));
  const battle = createTeamBattle({ seed, rules: createSs2TeamRules({ aiPress }), teams });
  const log = [];
  for (let taken = 0; taken < actions && !battle.result; taken += 1) {
    const actorId = currentCombatant(battle).id;
    const chosen = suggestAction(battle, actorId);
    // Whether the press had an open spot to go round to on this turn: the
    // claim's "while an open spot exists" (2026-09-28).
    const view = viewFor(battle, actorId);
    const target = ss2PressTarget(view);
    const open = target !== null && ss2PressGoal(view, target) !== null;
    const x0 = combatantById(battle, actorId).x;
    applyAction(battle, { actorId, ...chosen });
    log.push({ actorId, type: chosen.type, targetId: chosen.targetId, open, x0, x1: combatantById(battle, actorId).x });
  }
  const turnsOf = (id) => log.filter((entry) => entry.actorId === id);
  const longestRun = (id, matches) => {
    let best = 0;
    let run = 0;
    for (const entry of turnsOf(id)) { run = matches(entry) ? run + 1 : 0; best = Math.max(best, run); }
    return best;
  };
  const shuttle = (id) => {
    let best = 0;
    let run = 0;
    let last = null;
    for (const entry of turnsOf(id)) {
      const rank = /^rank-/.test(entry.type);
      run = rank && last && last !== entry.type ? run + 1 : rank ? 1 : 0;
      last = rank ? entry.type : null;
      best = Math.max(best, run);
    }
    return best;
  };
  const struck = (id, foe) => turnsOf(id).some((entry) => /attack$/.test(entry.type) && entry.targetId === foe);
  return { battle, log, turnsOf, longestRun, shuttle, struck };
}

for (const aiPress of ["ranged-first", "pincer-first"]) {
  test(`${aiPress}: queued behind a shooting ally in the target's lane, the free member goes round and strikes, never shuttling`, () => {
    const run = stagedRun([
      { id: "red-1", team: "red", x: -600, y: SECOND },
      { id: "red-2", team: "red", x: -886, y: SECOND, bow: true },
      { id: "blue-2", team: "blue", x: -1729, y: SECOND, sturdy: true },
      { id: "blue-3", team: "blue", x: -1100, y: FRONT, sturdy: true }
    ], { aiPress });
    assert.ok(run.shuttle("red-1") < 4, `red-1 alternated rank steps ${run.shuttle("red-1")} turns running`);
    assert.ok(run.struck("red-1", "blue-2") || run.struck("red-1", "blue-3"), "red-1 reaches a foe and strikes");
  });

  test(`${aiPress}: one lane over from a foe only a bow is on, the free member closes in his own lane rather than taunt from afar`, () => {
    const wall = SS2_ARENA.clamp.max;
    const run = stagedRun([
      { id: "red-2", team: "red", x: 300, y: SECOND },
      { id: "red-3", team: "red", x: 900, y: FRONT, bow: true },
      { id: "blue-3", team: "blue", x: wall, y: FRONT, sturdy: true }
    ], { aiPress });
    assert.equal(run.turnsOf("red-2")[0]?.type, Ss2ActionType.WALK_RIGHT, "first, walk toward him in his own lane");
    assert.ok(run.longestRun("red-2", (entry) => entry.type === Ss2ActionType.TAUNT) < 4, "no run of long-range taunts");
    assert.ok(run.struck("red-2", "blue-3"), "and he gets there and strikes");
  });

  test(`${aiPress}: queued behind a shooter with the target at the wall, the free member still goes round to his near side`, () => {
    const wall = SS2_ARENA.clamp.max;
    // red-1 sturdy too: the rig's target is a level-60 archer whose bombard
    // otherwise kills a level-5 red-1 on his way round, which proves nothing.
    const run = stagedRun([
      { id: "red-1", team: "red", x: 614, y: FRONT, sturdy: true },
      { id: "red-2", team: "red", x: 700, y: FRONT, bow: true },
      { id: "blue-1", team: "blue", x: wall, y: FRONT, sturdy: true, bow: true }
    ], { aiPress });
    assert.ok(run.longestRun("red-1", (entry) => entry.type === Ss2ActionType.TAUNT || entry.type === Ss2ActionType.REST) < 4,
      "no run of taunts or rests from the queue");
    assert.ok(run.struck("red-1", "blue-1"), "red-1 reaches him and strikes");
  });

  test(`${aiPress}: queued behind a shooter on the near side while a melee ally holds the far side, the free member takes the near side`, () => {
    const run = stagedRun([
      { id: "red-3", team: "red", x: 120, y: FRONT, sturdy: true },
      { id: "red-2", team: "red", x: -500, y: FRONT, bow: true },
      { id: "red-1", team: "red", x: -586, y: FRONT },
      { id: "blue-1", team: "blue", x: 0, y: FRONT, sturdy: true }
    ], { aiPress });
    assert.ok(run.longestRun("red-1", (entry) => entry.type === Ss2ActionType.TAUNT) < 4, "no run of taunts from the queue");
    assert.ok(run.struck("red-1", "blue-1"), "red-1 comes in on the near side and strikes");
  });
}

test("the build's champions, 3v3 seed 28: no free member taunts from afar four turns running where it could close", async (t) => {
  // The fourth verifier's arena case: at 92f9701 red-2 stepped into the
  // target's lane ~1,800 away (only red-3's bow on him) and taunted 8 turns
  // running; at 74c0014 it walked. Needs the player's own champion pack.
  const fs = await import("node:fs");
  const file = new URL("../assets/champions/champions.json", import.meta.url);
  if (!fs.existsSync(file)) { t.skip("no champion pack (node tools/extract-champions.mjs)"); return; }
  const { createVanillaBattleHost, SS2_STATIC_MAP_BINDINGS } = await import("../src/adapter/index.js");
  const { citationFor } = await import("../src/adapter/vanilla-fields.js");
  const { ss2BattleValues } = await import("../src/team/ss2-rules.js");
  const { championSide } = await import("../tools/arena/roster.js");
  const pack = JSON.parse(fs.readFileSync(file, "utf8"));
  const bosses = pack.champions.filter((c) => c.dnaFrom !== "hero" && c.whichBoss !== 17).map((c) => c.whichBoss);
  const seed = 28;
  const pick = (k) => Array.from({ length: 3 }, (unused, i) => bosses[(seed * 7 + k * 5 + i * 3) % bosses.length]);
  const deps = { ss2Combatant, ss2BattleValues, pack, admitResource: citationFor };
  const host = createVanillaBattleHost({
    teams: [championSide("red", pick(0), deps), championSide("blue", pick(1), deps)],
    rules: ss2TeamRules, bindings: SS2_STATIC_MAP_BINDINGS, seed, awaitAnimations: true
  });
  host.constructArena();
  let run = 0;
  let longest = 0;
  for (let taken = 0; taken < 900 && !host.battle.result; taken += 1) {
    const actorId = host.currentCombatantId();
    const chosen = host.suggestAction(actorId);
    if (actorId === "red-2") { run = chosen.type === Ss2ActionType.TAUNT ? run + 1 : 0; longest = Math.max(longest, run); }
    const step = host.submit({ actorId, ...chosen });
    for (const token of step.actionTokens) host.reportActionAnimation(token);
  }
  assert.ok(longest < 4, `red-2 taunted ${longest} of his turns running`);
});

test("aiPress \"off\" stays the AI before the press: the rank-arm queue guard (06beab0) applies only with the press on", () => {
  // red-2 has no foe in his own lane; the nearest foe, blue-1, is a rank over,
  // and red-1 — not yet in reach of him, so no press target — stands between
  // red-2's landing and blue-1. The press variants skip the step into that
  // queue and close in their own lane; the old AI steps in, as it always did.
  const stage = (aiPress) => {
    const place = (fields, id, where) => ss2Combatant(gladiator(fields), { id, name: id, controller: "local", ...where });
    return createTeamBattle({
      seed: 1,
      // Crowd play off: safe and ahead, the old AI would play to the crowd
      // here first, which is not the arm under test.
      rules: createSs2TeamRules({ aiPress, aiPlaysToCrowd: false }),
      teams: [
        { id: "red", combatants: [place({ gladiator_dir: "right" }, "red-1", { x: 0, y: FRONT }), place({ gladiator_dir: "right" }, "red-2", { x: -200, y: SECOND })] },
        { id: "blue", combatants: [place({ gladiator_dir: "left" }, "blue-1", { x: 400, y: FRONT })] }
      ]
    });
  };
  const old = stage("off");
  assert.equal(ss2PressTarget(viewFor(old, "red-2")), null, "the rig has no press target: red-1 is out of reach");
  assert.equal(suggestAction(old, "red-2").type, Ss2ActionType.RANK_FRONT, "the old AI steps into the rank");
  for (const aiPress of ["ranged-first", "pincer-first"]) {
    assert.notEqual(suggestAction(stage(aiPress), "red-2").type, Ss2ActionType.RANK_FRONT, `${aiPress} skips the step into the queue`);
  }
});

/**
 * ► **THE OLDER ARMS STEP INTO A QUEUE ONLY WHEN THERE IS NO WAY ROUND — a
 *   fifth write-nothing verifier's findings, 2026-09-28, against 06beab0.**
 *   (1) The join arm counts an ally "engaged" when the FOE's reach covers him,
 *   and a drawn bow's reach is ~4,500: it stepped the free member into the
 *   queue behind that ally whenever the press target flickered off, the arm
 *   that reversed the press in every shuttle found. (2) 06beab0's rank-arm
 *   guard skipped a queue even with no way round — both flanks held, or the
 *   target at the wall — and left the fighter pacing under the target or
 *   walking into the wall, 0 attacks in 50 turns, where the older AI queued
 *   and waited.
 */
test("the join arm does not step into a queue behind an ally while the press has a way round; aiPress off still does", () => {
  const stage = (aiPress) => {
    const place = (fields, id, where) => ss2Combatant(gladiator(fields), { id, name: id, controller: "local", ...where });
    return createTeamBattle({
      seed: 1,
      rules: createSs2TeamRules({ aiPress, aiPlaysToCrowd: false }),
      teams: [
        { id: "red", combatants: [place({ gladiator_dir: "right" }, "red-1", { x: 0, y: FRONT }), place({ gladiator_dir: "right" }, "red-2", { x: -300, y: SECOND })] },
        { id: "blue", combatants: [place({ gladiator_dir: "left", secondary_weapon: 61, equipped_weapon: 2 }, "blue-1", { x: 800, y: FRONT })] }
      ]
    });
  };
  const old = stage("off");
  assert.equal(ss2PressTarget(viewFor(old, "red-2")), null, "no press target: red-1 is far out of his own reach of blue-1");
  assert.equal(suggestAction(old, "red-2").type, Ss2ActionType.RANK_FRONT, "the old AI joins, into the queue behind red-1");
  for (const aiPress of ["ranged-first", "pincer-first"]) {
    assert.notEqual(suggestAction(stage(aiPress), "red-2").type, Ss2ActionType.RANK_FRONT, `${aiPress}: no step into the queue`);
  }
});

for (const aiPress of ["ranged-first", "pincer-first"]) {
  test(`${aiPress}: with both flanks held, a free member two lanes back queues in the target's lane rather than pace under him`, () => {
    const run = stagedRun([
      { id: "red-1", team: "red", x: -120, y: FRONT, sturdy: true },
      { id: "red-2", team: "red", x: 120, y: FRONT, sturdy: true },
      { id: "red-3", team: "red", x: -400, y: FRONT - 2 * SS2_ARENA.rankStride },
      { id: "blue-1", team: "blue", x: 0, y: FRONT, sturdy: true }
    ], { aiPress, actions: 90 });
    const first = run.turnsOf("red-3").slice(0, 12);
    assert.ok(first.filter((entry) => /^rank-/.test(entry.type)).length >= 2, "two steps bring him into the target's lane early");
  });

  test(`${aiPress}: with the lone foe pinned at the wall and his near side held, the free member does not walk into the wall`, () => {
    const wall = SS2_ARENA.clamp.min;
    const run = stagedRun([
      { id: "red-1", team: "red", x: wall + 120, y: FRONT, sturdy: true },
      { id: "red-2", team: "red", x: -1200, y: FRONT - 2 * SS2_ARENA.rankStride },
      { id: "blue-1", team: "blue", x: wall, y: FRONT, sturdy: true }
    ], { aiPress, actions: 150 });
    assert.ok(run.longestRun("red-2", (entry) => entry.type === Ss2ActionType.WALK_LEFT) < 12,
      "he stops walking toward the wall once there is nowhere to go round to");
    assert.ok(run.turnsOf("red-2").some((entry) => /^rank-/.test(entry.type)), "and steps into the lanes toward the fight");
  });
}

/**
 * ► **WALLED OFF FROM THE OPEN SPOT BY AN ALLY IN HIS OWN LANE, THE FREE
 *   MEMBER TAKES A CLEAR LANE ROUND — a sixth write-nothing verifier's finding,
 *   2026-09-28, against ab56337.** `ss2PressGoal` found an open spot, so the
 *   join and rank arms' queue guards skipped the step into the target's lane;
 *   but `ss2PressMove`'s only move from another lane was the walk toward that
 *   spot, and an ally's body in the actor's own lane withholds that walk (a
 *   body blocks only in the walker's own lane). Nothing else moved him: he
 *   rested or taunted every turn, 0 attacks (plain 3v3 seeds 29, 79 and 288,
 *   champions 3v3 seeds 196 and 358 on the arena's own host; these two
 *   layouts are the verifier's S1 and S2). One step into a lane whose walk is
 *   clear was enough, forced by hand, for the AI to go round and strike.
 */
for (const aiPress of ["ranged-first", "pincer-first"]) {
  // Idle WHILE THE PRESS HAS AN OPEN SPOT — the claim's own terms. With both
  // flanks held, queueing and waiting (a priced taunt included) is the answer.
  const idle = (entry) => entry.open && ["rest", "taunt", "wincrowd"].includes(entry.type);
  test(`${aiPress}: blocked by an ally in his own lane, the free member steps to a clear lane, goes round and strikes, never idling`, () => {
    const run = stagedRun([
      { id: "red-2", team: "red", x: -84, y: SECOND, sturdy: true, fields: { charisma: 99 } },
      { id: "red-3", team: "red", x: 30, y: THIRD, sturdy: true, fields: { charisma: 99 } },
      { id: "blue-1", team: "blue", x: 2, y: SECOND, sturdy: true },
      { id: "blue-2", team: "blue", x: 88, y: SECOND, sturdy: true, fields: { charisma: 1 } },
      { id: "blue-3", team: "blue", x: 130, y: THIRD, sturdy: true }
    ], { aiPress });
    assert.ok(run.longestRun("blue-2", idle) < 4, `blue-2 idled ${run.longestRun("blue-2", idle)} turns running`);
    assert.ok(run.shuttle("blue-2") < 4, `blue-2 alternated rank steps ${run.shuttle("blue-2")} turns running`);
    assert.ok(run.struck("blue-2", "red-2") || run.struck("blue-2", "red-3"), "blue-2 goes round and strikes");
  });

  test(`${aiPress}: behind an ally archer in his own lane, the free member goes round through a clear lane rather than rest`, () => {
    const run = stagedRun([
      { id: "red-1", team: "red", x: 1745, y: SECOND, sturdy: true, bow: true, fields: { charisma: 1 } },
      { id: "red-2", team: "red", x: 1345, y: FRONT, sturdy: true },
      { id: "red-3", team: "red", x: 1831, y: SECOND, sturdy: true, fields: { charisma: 1 } },
      { id: "blue-1", team: "blue", x: 1252, y: FRONT, sturdy: true, fields: { strength: 20, charisma: 99 } }
    ], { aiPress });
    assert.ok(run.longestRun("red-3", idle) < 4, `red-3 idled ${run.longestRun("red-3", idle)} turns running`);
    assert.ok(run.shuttle("red-3") < 4, `red-3 alternated rank steps ${run.shuttle("red-3")} turns running`);
    // Under pincer-first the archer red-1 puts his bow away and goes round
    // first, so both of blue-1's flanks end up held and red-3 queues in his
    // lane; under ranged-first red-1 keeps shooting and red-3 takes the far side.
    // (So under pincer-first this layout did not idle with a spot open at
    // ab56337 either — measured — and stands here as a guard, not a repro.)
    assert.equal(combatantById(run.battle, "red-3").y, FRONT, "red-3 ends in blue-1's lane");
    if (aiPress === "ranged-first") assert.ok(run.struck("red-3", "blue-1"), "red-3 reaches blue-1 and strikes");
  });
}

/**
 * ► ~~**P4 BINDS THE JOIN ARM TOO, WITH THE PRESS ON**~~ **(reverted 2026-09-29,
 *   below)** — a sixth write-nothing
 *   verifier's staged S3, 2026-09-28 (the same at 06beab0, ab56337 and under
 *   `aiPress: "off"`).** The join arm counts an ally "engaged" by the FOE's
 *   reach as well, and a drawn bow's is ~4,500, so an archer shooting blue-1
 *   made the front lane look covered: blue-3 left it to join blue-2's fight
 *   in the middle lane, where the press had no open spot (the wall), and the
 *   join arm sent him back to the "engaged" front lane — 27 alternating rank
 *   steps, 0 attacks. By P4 the archer is blue-3's own fight: in his lane, and
 *   no ally is fighting him (`ss2PressTarget`'s reading, an ally's own reach).
 *   With the press on the join arm now asks P4 first; `aiPress: "off"` stays
 *   the AI before the press, the measurement baseline, and still hops.
 */
const archerOwnLane = () => [
  { id: "red-1", team: "red", x: 1667, y: FRONT, sturdy: true, bow: true, fields: { strength: 20, charisma: 40 } },
  { id: "red-2", team: "red", x: 2100, y: SECOND, sturdy: true },
  { id: "blue-1", team: "blue", x: 1921, y: FRONT, sturdy: true },
  { id: "blue-2", team: "blue", x: 2014, y: SECOND, sturdy: true, fields: { strength: 20 } },
  { id: "blue-3", team: "blue", x: 1069, y: FRONT, sturdy: true }
];
// ► **REVERTED 2026-09-29, MEASURED — S3 IS OPEN AGAIN, UNDER EVERY aiPress.** The
//   P4 gate on the join arm fixed this layout but cost the shipped ranged-first
//   plain 3v3 4.5 points of 2v1 conversion and more than doubled its dancing
//   (tools/ai-press-census.mjs: 75.9% / 2.1% without it, 71.4% / 5.5% with). The
//   two tests that asserted the fix are replaced by this one, which pins the hop
//   as it stands so that a real fix has to move it on purpose. ~~ranged-first /
//   pincer-first: "the free member closes on him rather than hop between two
//   fights"~~ (they passed from 6dee6b4 to this revert).
test("OPEN: with an archer in his own lane that no ally fights in melee, the free member hops between two lanes' fights, under every aiPress", () => {
  for (const aiPress of ["off", "ranged-first", "pincer-first"]) {
    const run = stagedRun(archerOwnLane(), { aiPress, actions: 150 });
    assert.ok(run.shuttle("blue-3") >= 4, `${aiPress}: the hop is pinned as open (${run.shuttle("blue-3")})`);
  }
});

/**
 * ► **A SEVENTH WRITE-NOTHING VERIFIER REFUTED 6dee6b4 IN STAGED POSITIONS,
 *   2026-09-29 — its repros, verbatim** (`~/.cache/ss2-scratch/verify-press7/out/<name>.json`
 *   on the machine that ran it; `lane` 0 is the front rank, `preset` and `f`
 *   are fields, the last column the battle seed). None of these stalls at
 *   c2b5751, where the focus fighter strikes 20-53 times; at 6dee6b4:
 *
 * - **ArcherShuttle**: the detour fired whenever the walk toward the goal was
 *   not offered — here because a closed-on archer is offered only the walk
 *   away, not because a body blocks — and each lane looked open from the
 *   other: 40 alternating rank steps, 0 strikes.
 * - **T2491, T179**: the detour landed him where the nearest fought foe was
 *   another, with no open spot, and the join arm stepped him straight back.
 * - **Flicker-min**: detour, flank walk twice, join, round and round: 0 strikes.
 * - **S2E-guard-wall / -min / -mirror**: the rank guard widened in 6dee6b4
 *   skipped his only way forward (through the middle lane's queue and out the
 *   far side): he walked into the wall, rested, or paced.
 * - **S2E** (the S2 test moved one lane back) rests at c2b5751 too: the join
 *   guard skipped the same way through.
 */
const VERIFIER7 = {
  ArcherShuttle: [{"id":"red-1","team":"red","x":0,"lane":0,"preset":["sturdy"]},{"id":"blue-1","team":"blue","x":-100,"lane":0,"preset":["sturdy"]},{"id":"blue-2","team":"blue","x":-55,"lane":2,"preset":["sturdy","bow"],"f":{"strength":60,"speed":3}}],
  T2491: [{"id":"red-1","team":"red","x":-1915,"lane":0,"f":{"strength":60,"speed":5,"charisma":12,"vitality":60,"herolevel":60,"character_level":60,"defence":30}},{"id":"red-2","team":"red","x":-2082,"lane":0,"f":{"strength":60,"speed":4,"charisma":6}},{"id":"red-3","team":"red","x":-2095,"lane":2,"f":{"strength":9,"speed":5,"charisma":12,"vitality":60,"herolevel":60,"character_level":60,"defence":30}},{"id":"blue-1","team":"blue","x":-1893,"lane":2,"f":{"strength":9,"speed":6,"charisma":6,"vitality":60,"herolevel":60,"character_level":60,"defence":30}},{"id":"blue-2","team":"blue","x":-2095,"lane":1,"f":{"strength":9,"speed":5,"charisma":1,"vitality":60,"herolevel":60,"character_level":60,"defence":30,"secondary_weapon":61}}],
  T179: [{"id":"red-1","team":"red","x":1928,"lane":1,"f":{"strength":60,"speed":5,"charisma":6,"vitality":60,"herolevel":60,"character_level":60,"defence":30,"secondary_weapon":61,"equipped_weapon":2}},{"id":"red-2","team":"red","x":2100,"lane":2,"f":{"strength":20,"speed":3,"charisma":1,"vitality":60,"herolevel":60,"character_level":60,"defence":30}},{"id":"red-3","team":"red","x":2100,"lane":0,"f":{"strength":9,"speed":4,"charisma":1,"vitality":60,"herolevel":60,"character_level":60,"defence":30}},{"id":"blue-1","team":"blue","x":2052,"lane":1,"f":{"strength":60,"speed":6,"charisma":1,"vitality":60,"herolevel":60,"character_level":60,"defence":30}},{"id":"blue-2","team":"blue","x":1995,"lane":0,"f":{"strength":9,"speed":3,"charisma":6,"vitality":60,"herolevel":60,"character_level":60,"defence":30}}],
  "Flicker-min": [{"id":"red-1","team":"red","x":2050,"lane":1,"preset":["sturdy"]},{"id":"red-2","team":"red","x":1964,"lane":0,"preset":["sturdy"]},{"id":"blue-1","team":"blue","x":1950,"lane":1,"preset":["sturdy"]},{"id":"blue-2","team":"blue","x":1878,"lane":0,"preset":["sturdy"]},{"id":"blue-3","team":"blue","x":1864,"lane":1,"preset":["sturdy"]}],
  "S2E-guard-wall": [{"id":"red-1","team":"red","x":-2014,"lane":2,"preset":["sturdy","bow"],"f":{"charisma":1}},{"id":"red-2","team":"red","x":-1614,"lane":1,"preset":["sturdy"]},{"id":"red-3","team":"red","x":-2100,"lane":2,"preset":["sturdy"],"f":{"charisma":1}},{"id":"blue-1","team":"blue","x":-1521,"lane":1,"preset":["sturdy"],"f":{"strength":20,"charisma":99}},{"id":"blue-2","team":"blue","x":-2100,"lane":0,"preset":["sturdy","bow"]}],
  "S2E-guard-min": [{"id":"red-1","team":"red","x":1745,"lane":2,"preset":["sturdy","bow"],"f":{"charisma":1}},{"id":"red-2","team":"red","x":1345,"lane":1,"preset":["sturdy"]},{"id":"red-3","team":"red","x":1831,"lane":2,"preset":["sturdy"],"f":{"charisma":1}},{"id":"blue-1","team":"blue","x":1252,"lane":1,"preset":["sturdy"],"f":{"strength":20,"charisma":99}},{"id":"blue-2","team":"blue","x":1831,"lane":0,"preset":["sturdy","bow"]}],
  "S2E-guard-mirror": [{"id":"red-1","team":"red","x":-1745,"lane":2,"preset":["sturdy","bow"],"f":{"charisma":1}},{"id":"red-2","team":"red","x":-1345,"lane":1,"preset":["sturdy"]},{"id":"red-3","team":"red","x":-1831,"lane":2,"preset":["sturdy"],"f":{"charisma":1}},{"id":"blue-1","team":"blue","x":-1252,"lane":1,"preset":["sturdy"],"f":{"strength":20,"charisma":99}},{"id":"blue-2","team":"blue","x":-1831,"lane":0,"preset":["sturdy","bow"]}],
  S2E: [{"id":"red-1","team":"red","x":1745,"lane":2,"preset":["sturdy","bow"],"f":{"charisma":1}},{"id":"red-2","team":"red","x":1345,"lane":1,"preset":["sturdy"]},{"id":"red-3","team":"red","x":1831,"lane":2,"preset":["sturdy"],"f":{"charisma":1}},{"id":"blue-1","team":"blue","x":1252,"lane":1,"preset":["sturdy"],"f":{"strength":20,"charisma":99}}]
};
const VERIFIER7_PRESETS = {
  sturdy: { vitality: 60, herolevel: 60, character_level: 60, defence: 30 },
  bow: { secondary_weapon: 61, equipped_weapon: 2 }
};
const fromVerifier = (spec) => spec.map((entry) => ({
  id: entry.id, team: entry.team, x: entry.x, y: [FRONT, SECOND, THIRD][entry.lane],
  fields: Object.assign({}, ...(entry.preset ?? []).map((name) => VERIFIER7_PRESETS[name]), entry.f ?? {})
}));
const VERIFIER7_ROWS = [
  ["ArcherShuttle", "blue-2", 120, 1], ["T2491", "red-2", 200, 2491], ["T179", "red-2", 200, 179],
  ["Flicker-min", "blue-3", 300, 1], ["S2E-guard-wall", "red-3", 200, 1], ["S2E-guard-min", "red-3", 200, 1],
  ["S2E-guard-mirror", "red-3", 200, 1], ["S2E", "red-3", 200, 1]
];
for (const [name, focus, actions, seed] of VERIFIER7_ROWS) {
  test(`ranged-first, the seventh verifier's ${name}: ${focus} makes progress — no shuttle, no stuck walk, no idling with a spot open — and strikes`, () => {
    const run = stagedRun(fromVerifier(VERIFIER7[name]), { actions, seed });
    // Rests and crowd-pleasers, not the taunt: under ranged-first a priced taunt at
    // an own-lane foe ranks above going round BY DESIGN (the P2 variant; the
    // verifier set its champions seed 1058 aside the same way). Flicker-min opens
    // with five such taunts at c2b5751 too, and then goes round and strikes.
    const idle = (entry) => entry.open && ["rest", "wincrowd"].includes(entry.type);
    const stuck = (entry) => /^walk-/.test(entry.type) && entry.x0 === entry.x1;
    const strikes = run.turnsOf(focus).filter((entry) => /attack$|^snipe$|^bombard$/.test(entry.type)).length;
    assert.ok(run.shuttle(focus) < 4, `${focus} alternated rank steps ${run.shuttle(focus)} turns running`);
    assert.ok(run.longestRun(focus, stuck) < 4, `${focus} walked in place ${run.longestRun(focus, stuck)} turns running`);
    assert.ok(run.longestRun(focus, idle) < 4, `${focus} idled with a spot open ${run.longestRun(focus, idle)} turns running`);
    assert.ok(strikes >= 5, `${focus} struck ${strikes} times in ${run.turnsOf(focus).length} turns`);
  });
}
