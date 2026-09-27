/**
 * A WALK THAT GOES NOWHERE BECAUSE OF A BODY IN YOUR OWN LANE IS NOT OFFERED —
 * the owner's decision P3 (`docs/design/battle-ui.md#decided-ai-press-2026-09-27`).
 *
 * ► **What he saw:** a gladiator queued behind his own ally in one lane,
 *   choosing the walk toward the fight turn after turn and not moving — the
 *   walk animation playing on the spot. Measured on the arena's own host
 *   (`demoSide`, the `buffs` kit, 3v3, seeds 1-48): 66 chosen walks went
 *   nowhere against an ally in the walker's lane, one gladiator 13 turns
 *   running. The walk was legal, cost its stamina, and the build's overlap
 *   clamp (`defender._x -/+ physical_size`, `+0x3de6`) left him where he was.
 *
 * ► **The decision:** the ring shows that walk greyed, "Blocked", the way
 *   "Not built yet" is shown, and since the ring is read against the offer,
 *   the offer withholds it — so the AI can never pick it either. A walk that
 *   moves at all, however little, is still a walk and is still offered. A walk
 *   into the ARENA WALL is not covered by the decision and is still offered,
 *   as the build offers it.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction,
  combatantById,
  createTeamBattle,
  legalActions,
  unavailableActions
} from "../src/team/index.js";
import {
  ss2Combatant,
  ss2PhysicalSize,
  ss2TeamRules,
  ss2WalkDestination,
  SS2_ARENA,
  SS2_UNAVAILABLE_REASONS,
  Ss2ActionType
} from "../src/team/ss2-rules.js";

const gladiator = (overrides = {}) => ({
  strength: 9, speed: 5, attack: 9, defence: 5, vitality: 5, stamina: 4,
  magicka: 0, charisma: 3, herolevel: 3, character_level: 3,
  weapon_min_damage: 3, weapon_max_damage: 9,
  ...overrides
});

/**
 * A 2v1 in one lane: red-1 the walker, red-2 his ally, blue-1 the lone foe
 * well out of reach, so the walker is on the long frame, which wires both
 * walks. Positions are stated, all in the front rank.
 */
function queue({ walkerX, allyX, foeX }) {
  const lane = SS2_ARENA.frontY;
  return createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        combatants: [
          ss2Combatant(gladiator({ speed: 9, gladiator_dir: "right" }), { id: "red-1", x: walkerX, y: lane }),
          ss2Combatant(gladiator({ gladiator_dir: "right" }), { id: "red-2", x: allyX, y: lane })
        ]
      },
      {
        id: "blue",
        combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "blue-1", x: foeX, y: lane })]
      }
    ]
  });
}

const types = (battle, id) => legalActions(battle, id).map((option) => option.type);

test("a walk into an ally in your own lane that would go nowhere is not offered; the other way still is", () => {
  const battle = queue({ walkerX: 0, allyX: 0 + 86, foeX: 900 });
  const walker = combatantById(battle, "red-1");
  const ally = combatantById(battle, "red-2");
  assert.equal(ss2PhysicalSize(ally), 86, "the rig's ally is the demo build's size");
  assert.equal(walker.x, ally.x - ss2PhysicalSize(ally), "the walker stands exactly on the ally's clamp line");
  assert.equal(ss2WalkDestination(walker, [ally], 1), walker.x, "so the walk toward goes nowhere");

  const offered = types(battle, "red-1");
  assert.ok(!offered.includes(Ss2ActionType.WALK_RIGHT), "the walk that goes nowhere must not be offered");
  assert.ok(offered.includes(Ss2ActionType.WALK_LEFT), "the walk away is still a walk");
});

test("a walk that moves at all, however little, is still offered", () => {
  // Ten units short of the clamp line: the walk is cut to ten, and ten is a walk.
  const battle = queue({ walkerX: 0, allyX: 96, foeX: 900 });
  assert.ok(types(battle, "red-1").includes(Ss2ActionType.WALK_RIGHT), "a cut walk is still offered");
  applyAction(battle, { actorId: "red-1", type: Ss2ActionType.WALK_RIGHT, targetId: "red-1" });
  assert.equal(combatantById(battle, "red-1").x, 10, "and it really moves the ten units");
});

test("a walk into the arena wall is not covered by the decision and is still offered", () => {
  const wall = SS2_ARENA.clamp.max;
  const battle = queue({ walkerX: wall, allyX: wall - 600, foeX: wall - 1400 });
  const walker = combatantById(battle, "red-1");
  assert.equal(ss2WalkDestination(walker, [], 1), walker.x, "the rig's walker stands at the wall");
  assert.ok(types(battle, "red-1").includes(Ss2ActionType.WALK_RIGHT), "the wall walk is offered as the build offers it");
});

test("the ring shows the withheld walk greyed with its own reason, \"blocked\"", () => {
  assert.equal(SS2_UNAVAILABLE_REASONS.blocked?.display, "grey", "the reason exists and greys");
  const battle = queue({ walkerX: 0, allyX: 86, foeX: 900 });
  const ring = unavailableActions(battle, "red-1", "blue-1");
  const walkRight = ring.ring.find((entry) => entry.type === Ss2ActionType.WALK_RIGHT);
  assert.ok(walkRight, "the long frame's ring holds walk-right");
  assert.equal(walkRight.available, false);
  assert.equal(walkRight.reason, "blocked");
  assert.equal(walkRight.display, "grey");
  const walkLeft = ring.ring.find((entry) => entry.type === Ss2ActionType.WALK_LEFT);
  assert.equal(walkLeft?.available, true, "and the walk away is shown");
});

test("a body in ANOTHER lane never makes a walk blocked", () => {
  // The same ally, one rank back: scenery (`ss2BodyBlocks`, the lane rule).
  const battle = queue({ walkerX: 0, allyX: 86, foeX: 900 });
  combatantById(battle, "red-2").y = SS2_ARENA.frontY - SS2_ARENA.rankStride;
  assert.ok(types(battle, "red-1").includes(Ss2ActionType.WALK_RIGHT));
});
