/**
 * `cast_command` — the spell that PULLS its target, and the first verb whose
 * displacement is a per-frame loop rather than one tween.
 *
 * ## WHAT THE BUILD DOES, AND WHERE
 *
 * Re-derived 2026-09-22 from `sprite:862[overlay]/frame:52/DoAction@0x240c7f`,
 * block base `0x240c85`, `+0x7be6`-`+0x7db6` — inside the `attacker.onEnterFrame`
 * function defined at `+0x36ae`, so every statement below runs once a FRAME:
 *
 * ```text
 *   phase_decision == "cast_command"                                +0x7be6
 *     register:3.crowd_action = 2                                   +0x7bf9
 *     game_attacker.staminacost = Math.round(game_attacker.magicka) +0x7c06
 *     if (attacker.shove != true) {                                 +0x7c2d
 *       cast_spell_icon(attacker, 39)                               +0x7c46
 *       defender.gotoAndPlay("knockback_mov")                       +0x7c5e
 *       attacker.shove = true                                       +0x7c73
 *       attacker.gotoAndPlay("Cast2")                               +0x7c81
 *     }                              // no Jump: the entry frame moves too
 *     if (attacker.gladiator_dir == "right") {                      +0x7c96
 *       defender._x -= 40                                           +0x7cae
 *       if (!(defender._x > attacker._x + game_defender.physical_size))
 *         { attacker.struck = null; attacker.shove = false; nextphase() }
 *     } else if (attacker.gladiator_dir == "left") {                +0x7d29
 *       defender._x += 40                                           +0x7d41
 *       if (!(defender._x < attacker._x - game_defender.physical_size))
 *         { attacker.struck = null; attacker.shove = false; nextphase() }
 *     }                                                             ..+0x7db6
 * ```
 *
 * So with `S` the TARGET's `physical_size` and the caster facing right, the
 * pull takes `k = max(1, ceil((target.x - caster.x - S) / 40))` frames and
 * leaves the target at `target.x - 40k`; facing left is the mirror. The target
 * moves OPPOSITE to the caster's facing — toward the caster when it stands in
 * front, AWAY from it when it stands behind.
 *
 * **Since 2026-09-24 the caster turns to face its target before the arm runs**
 * (`ss2TurnToTarget`), so through `applyAction` the target always stands in
 * front and is always pulled; only a co-located pair, with no side to turn to,
 * is still carried past the caster. See the "target BEHIND" and wall tests.
 *
 * ## TWO SENTENCES OF THE BRIEF THIS FILE WAS WRITTEN AGAINST WERE WRONG
 *
 * - *"A target already inside 40 px of the stand-off ends up BEHIND the
 *   caster."* **False**: `S` is at least 80 (`80 + round(strength / 1.5)`), so
 *   a target inside the stand-off moves exactly 40 and stays IN FRONT. It ends
 *   up behind only when it starts less than 40 px in front of the caster.
 *   Found by this implementer and, independently, by a write-nothing verifier.
 * - *"40 px toward the caster's facing side"* (the verifier's reading of the
 *   brief) is backwards: `-40` per frame when the caster faces right.
 *
 * ## THE CAP, DERIVED
 *
 * `nextphase` sets `demand_move = 1` (`+0x3266`); the same `onEnterFrame`
 * increments it (`+0x37e5`) and tests the stall watchdog (`+0x37ef`-`+0x38a0`:
 * `demand_move >= 60 && attacker._y >= attacker.grounded && bullet_in_air !=
 * true`, or `>= 200`) BEFORE it reaches the arm. So the 59th frame of the phase
 * calls `nextphase()` before its pull runs: **at most 58 pulls, 2,320 px**. The
 * watchdog nulls `struck` and `grounded` but not `attacker.shove`, which leaks
 * the latch; that is not modelled.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, suggestAction,
  toTeamWireState
} from "../src/team/index.js";
import {
  SS2_ARENA, SS2_COMMAND, SS2_FACING_LEFT, SS2_INVENTORY_EMPTY, Ss2ActionType, VANILLA_PHASE_LABEL,
  createSs2TeamRules, ss2Combatant, ss2PhysicalSize, ss2TeamRules
} from "../src/team/ss2-rules.js";
import {
  buildArenaLayout, CommandKind, LabelProvenance, presentArenaConstruction, presentResolvedEvents,
  SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import { applyCommands, emptyScene, figureXAt, poseAt, timelineFor, timelinesForStep } from "../src/render/index.js";
import { allUnmappedLabels, clipLabelsFor } from "../src/render/clip-labels.js";

const COMMAND = Ss2ActionType.CAST_COMMAND;

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

/**
 * A 1v1 with the caster on RED, opening, facing right.
 *
 * Facing is derived from position at construction (red stands left of blue),
 * and moving `x` afterwards does not re-derive it — which is how a target is
 * put BEHIND a right-facing caster below.
 */
function staged({ hero = {}, foe = {}, heroX = -60, foeX = 60, controller = "local" } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: heroX, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: foeX, y: 200 });
  assert.equal(currentCombatant(battle).id, "hero", "the caster must open for these tests to mean anything");
  assert.equal(facesLeft(battle, "hero"), false, "and face right");
  return battle;
}

/** The mirror: the caster on BLUE, facing left from construction, and fastest so it opens. */
function stagedLeft({ casterX = 250, victimX = -250 } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields(), { id: "victim", name: "victim", controller: "local" })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ speed: 21, inventory1: 39 }), { id: "caster", name: "caster", controller: "local" })] }
    ]
  });
  Object.assign(combatantById(battle, "caster"), { x: casterX, y: 200 });
  Object.assign(combatantById(battle, "victim"), { x: victimX, y: 200 });
  assert.equal(currentCombatant(battle).id, "caster");
  assert.equal(facesLeft(battle, "caster"), true);
  return battle;
}

const facesLeft = (battle, id) => (combatantById(battle, id).status ?? []).includes(SS2_FACING_LEFT);

const commandTargets = (battle, id = "hero") =>
  legalActions(battle, id).filter((option) => option.type === COMMAND).map((option) => option.targetId);

/** Cast, and hand back the command's own event off the battle log. */
function cast(battle, actorId = "hero", targetId = "foe") {
  applyAction(battle, { actorId, type: COMMAND, targetId });
  const event = battle.events.at(-1);
  assert.equal(event.type, COMMAND, "the command's own event is the last one logged");
  return event;
}

/**
 * THE CLOSED FORM, written out independently of the resolver so the two can
 * disagree: `k = max(1, ceil(need / 40))` frames, capped at the watchdog's 58,
 * and the target moves opposite to the caster's facing by 40 a frame.
 */
function closedForm({ casterX, targetX, facing, standOff }) {
  const sign = facing === "left" ? -1 : 1;
  const need = sign * (targetX - casterX) - standOff;
  const k = Math.max(1, Math.ceil(need / 40));
  const ticks = Math.min(k, 58);
  return { ticks, to: targetX - sign * 40 * ticks, cut: k > 58 };
}

/* ------------------------------------------------------------------ *
 * The vocabulary                                                      *
 * ------------------------------------------------------------------ */

test("the token is `cast-command` and it round-trips to the build's own `cast_command`", () => {
  assert.equal(COMMAND, "cast-command");
  assert.equal(VANILLA_PHASE_LABEL[COMMAND], "cast_command");
  assert.ok(createSs2TeamRules().actionTypes.includes(COMMAND));
});

test("the command's constants are the build's literals", () => {
  // `cast_spell_icon(attacker, 39)` at `+0x7c46` and `check_inventory(39)` at
  // ladder arm 25 (`+0x0ec2`) both name 39.
  assert.equal(SS2_COMMAND.itemId, 39);
  // `Push 40; Subtract` at `+0x7cc2` and `Push 40; Add2` at `+0x7d55`.
  assert.equal(SS2_COMMAND.pullStep, 40);
  // `attacker.gotoAndPlay("Cast2")` at `+0x7c81`; `defender.gotoAndPlay("knockback_mov")` at `+0x7c5e`.
  assert.equal(SS2_COMMAND.casterClip, "Cast2");
  assert.equal(SS2_COMMAND.victimClip, "knockback_mov");
  // `fightdistance > 300` at `+0x0eee`-`+0x0ef6`, `Greater`: strict.
  assert.equal(SS2_COMMAND.aiFightDistanceAbove, 300);
});

test("the cap is DERIVED from the watchdog's own literals: reset 1, trip at 60, tested before the arm", () => {
  assert.equal(SS2_COMMAND.demandMoveReset, 1, "`demand_move = 1` in `nextphase`, `+0x3266`");
  assert.equal(SS2_COMMAND.watchdogTrip, 60, "`Push 60; Less2; Not` at `+0x37f5`");
  // Frame f of the phase sees demand_move = 1 + f after the increment, and the
  // watchdog trips at 1 + f >= 60 — frame 59 — BEFORE the arm runs.
  assert.equal(SS2_COMMAND.pullTickCap, 58);
  assert.equal(SS2_COMMAND.pullTickCap * SS2_COMMAND.pullStep, 2320, "the furthest a pull can carry anybody");
});

/* ------------------------------------------------------------------ *
 * The offer                                                           *
 * ------------------------------------------------------------------ */

test("a gladiator carrying no inventory is offered no command; carrying 39 offers one per foe, from any slot", () => {
  assert.deepEqual(commandTargets(staged()), []);
  assert.deepEqual(commandTargets(staged({ hero: { inventory1: 39 } })), ["foe"]);
  assert.deepEqual(commandTargets(staged({ hero: { inventory6: 39 } })), ["foe"]);
  assert.deepEqual(commandTargets(staged({ hero: { inventory1: SS2_INVENTORY_EMPTY } })), []);
});

test("the command is offered at ANY distance, because neither the button nor the phase reads one", () => {
  // `fightdistance > 300` is ladder arm 25, the villain's DECISION; the arm
  // `+0x7be6`-`+0x7db6` contains no `fightdistance` read.
  assert.deepEqual(commandTargets(staged({ hero: { inventory1: 39 }, foeX: 1900 })), ["foe"]);
  assert.deepEqual(commandTargets(staged({ hero: { inventory1: 39 }, foeX: 0 })), ["foe"]);
});

test("above 1v1 the command is offered at EVERY foe, including one behind the caster", () => {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, inventory1: 39 }), { id: "hero", name: "hero", controller: "local" })] },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(fields(), { id: "front", name: "front", controller: "local" }),
          ss2Combatant(fields(), { id: "back", name: "back", controller: "local" })
        ]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: 0, y: 200 });
  Object.assign(combatantById(battle, "front"), { x: 600, y: 200 });
  Object.assign(combatantById(battle, "back"), { x: -900, y: 200 });
  assert.deepEqual(commandTargets(battle).sort(), ["back", "front"]);
});

test("the `inventory_maxslots` window gates the command, as it gates every spell's button", () => {
  assert.deepEqual(commandTargets(staged({ hero: { inventory3: 39, inventory_maxslots: 2 } })), []);
  assert.deepEqual(commandTargets(staged({ hero: { inventory2: 39, inventory_maxslots: 2 } })), ["foe"]);
});

test("a forced rest still outranks the command", () => {
  const battle = staged({ hero: { inventory1: 39 } });
  combatantById(battle, "hero").resources.staminaleft.value = 0;
  assert.deepEqual(legalActions(battle, "hero").map((option) => option.type), [Ss2ActionType.REST]);
});

/* ------------------------------------------------------------------ *
 * The phase                                                           *
 * ------------------------------------------------------------------ */

test("a command takes ZERO samples: the rng cursor does not move", () => {
  // No `randomBetween`, `RandomNumber` or `checkattackroll` in `+0x7be6`-`+0x7db6`.
  const battle = staged({ hero: { inventory1: 39 }, foeX: 1000 });
  const before = battle.rng.cursor;
  cast(battle);
  assert.equal(battle.rng.cursor, before);
});

test("the cost is round(magicka), the STAT, with regeneration on top, and there is no affordability check", () => {
  const battle = staged({ hero: { inventory1: 39, magicka: 12 } });
  const before = combatantById(battle, "hero").resources.staminaleft.value;
  const event = cast(battle);
  assert.equal(event.staminaSpent, 12);
  assert.equal(combatantById(battle, "hero").resources.staminaleft.value - before, event.staminaGained);

  const broke = staged({ hero: { inventory1: 39, magicka: 30 } });
  combatantById(broke, "hero").resources.staminaleft.value = 11;
  assert.deepEqual(commandTargets(broke), ["foe"]);
  cast(broke);
  assert.equal(combatantById(broke, "hero").resources.staminaleft.value >= 0, true, "floored, not refused");
});

test("casting CONSUMES the slot by setting it to 1, and the offer goes with it", () => {
  const battle = staged({ hero: { inventory3: 39 } });
  const event = cast(battle);
  assert.equal(event.consumedSlot, "inventory3");
  assert.equal(combatantById(battle, "hero").resources.inventory3.value, SS2_INVENTORY_EMPTY);
  assert.deepEqual(commandTargets(battle), []);
});

test("facing RIGHT, the target is pulled by the closed form — k = max(1, ceil(need / 40)) frames of -40", () => {
  // Caster at -60; the target's strength 9 gives S = 86, so the stand-off line
  // is at 26. Each row is [start, frames, end], worked by hand.
  const rows = [
    [60, 1, 20], //    need 34: one frame, and it lands 6 inside the line
    [106, 2, 26], //   need 80: EXACTLY on the line after two — `<=` completes
    [107, 3, -13], //  need 81: one past a multiple costs a whole third frame
    [1000, 25, 0] //   need 974
  ];
  for (const [start, frames, end] of rows) {
    const battle = staged({ hero: { inventory1: 39 }, foeX: start });
    const standOff = ss2PhysicalSize(combatantById(battle, "foe"));
    assert.equal(standOff, 86);
    const event = cast(battle);
    assert.deepEqual(closedForm({ casterX: -60, targetX: start, facing: "right", standOff }), { ticks: frames, to: end, cut: false });
    assert.equal(event.pullTicks, frames, `start ${start}: frames`);
    assert.equal(event.targetTo, end, `start ${start}: end`);
    assert.equal(combatantById(battle, "foe").x, end);
    assert.equal(event.cutByWatchdog, false);
  }
});

test("a target already INSIDE the stand-off moves exactly 40 and stays IN FRONT of the caster", () => {
  // ► **THE BRIEF SAID IT ENDS UP BEHIND, AND IT DOES NOT.** S >= 80 > 40, so
  //   one frame of -40 from anywhere 40 or more in front leaves it in front.
  const battle = staged({ hero: { inventory1: 39 }, foeX: 0 });
  const event = cast(battle);
  assert.equal(event.pullTicks, 1);
  assert.equal(event.targetTo, -40);
  assert.ok(event.targetTo > -60, "still in front of the caster at -60");
  assert.equal(facesLeft(battle, "foe"), true, "so nobody turns");
});

test("a target LESS THAN 40 in front ends up BEHIND the caster, and both of them turn", () => {
  const battle = staged({ hero: { inventory1: 39 }, foeX: -30 });
  const event = cast(battle);
  assert.equal(event.targetTo, -70, "one frame of -40 carries it 10 past the caster");
  assert.equal(facesLeft(battle, "foe"), false, "the foe now faces the caster on its right");
  assert.equal(facesLeft(battle, "hero"), true, "and the caster faces the foe on its left");
});

test("a target BEHIND the caster is PULLED, because the caster turns to face it first — the arm's push-behind is unreachable", () => {
  // ~~a target BEHIND the caster is pushed 40 further AWAY — the direction is
  // the caster's facing, not the target's side~~ (`pullTicks` 1, -500 -> -540).
  //
  // ► **MOVED 2026-09-24, BY THE TURN TO THE TARGET (`ss2TurnToTarget`), and
  //   by nothing else.** The arm still signs on the caster's facing
  //   (`+0x7c96`), and a target behind a caster facing AWAY from it would
  //   still be pushed 40 further off. But every verb aimed at a foe now turns
  //   its caster to face that foe before the phase reads the facing, so the
  //   arm always runs with the target in FRONT: -500 behind a caster at -60 is
  //   pulled like any 1v1 target, facing left, `k = ceil((440 - 86) / 40)` = 9
  //   frames of +40, landing at -140. The staging below still hands the caster
  //   a target behind it (facing is not re-derived after `x` is moved), which
  //   in 1v1 play cannot happen and in team play is the case the turn exists
  //   for. Reverted by exact inverse, this test's old numbers return.
  const battle = staged({ hero: { inventory1: 39 }, foeX: -500 });
  const event = cast(battle);
  assert.deepEqual(closedForm({ casterX: -60, targetX: -500, facing: "left", standOff: 86 }), { ticks: 9, to: -140, cut: false });
  assert.equal(event.pullTicks, 9);
  assert.equal(event.targetTo, -140);
  assert.equal(combatantById(battle, "foe").x, -140);
  assert.equal(facesLeft(battle, "hero"), true, "the caster turned to face the man it commanded, and still does");
  assert.deepEqual(battle.lastResolution.effects[0], { kind: "status", targetId: "hero", status: SS2_FACING_LEFT, active: true },
    "the turn is the phase's FIRST effect: it happens before the arm reads the facing");
});

test("facing LEFT is the mirror: +40 a frame, completing once the target is no longer left of caster - S", () => {
  // Caster at 250 facing left; S = 86 puts the line at 164. From -250 that is
  // need 414, eleven frames, landing at 190.
  const battle = stagedLeft();
  const event = cast(battle, "caster", "victim");
  assert.deepEqual(closedForm({ casterX: 250, targetX: -250, facing: "left", standOff: 86 }), { ticks: 11, to: 190, cut: false });
  assert.equal(event.pullTicks, 11);
  assert.equal(combatantById(battle, "victim").x, 190);

  // Exactly on the line: `Less2; Not; Not` completes at equality, as `<=` does on the right.
  const exact = stagedLeft({ victimX: 164 - 80 });
  assert.equal(cast(exact, "caster", "victim").targetTo, 164);

  // ~~And behind a left-facing caster is to its RIGHT: pushed 40 further
  // right.~~ (600 -> 640.) **MOVED 2026-09-24 by the turn to the target**: the
  // caster turns RIGHT to face it first, so it is pulled — the mirror of the
  // test above, need 600 - 250 - 86 = 264, seven frames of -40, landing at 320.
  const behind = stagedLeft({ victimX: 600 });
  assert.equal(cast(behind, "caster", "victim").targetTo, 320);
  assert.equal(facesLeft(behind, "caster"), false);
});

test("the stand-off is the TARGET's `physical_size` (`game_defender`), not the caster's", () => {
  // Target strength 60 gives S = 120; the caster's own is 86. From 1000:
  // need 1060 - 120 = 940, 24 frames, landing at 40 — where the caster's S
  // would have taken 25 and landed at 0.
  const battle = staged({ hero: { inventory1: 39 }, foe: { strength: 60 }, foeX: 1000 });
  assert.equal(ss2PhysicalSize(combatantById(battle, "foe")), 120);
  const event = cast(battle);
  assert.equal(event.standOff, 120);
  assert.equal(event.pullTicks, 24);
  assert.equal(event.targetTo, 40);
});

test("the stall watchdog CUTS a long pull at 58 frames, 2,320 units, and the cost is still spent", () => {
  // The whole arena: need 4200 - 86 = 4114 would take 103 frames.
  const battle = staged({ hero: { inventory1: 39, magicka: 5 }, heroX: SS2_ARENA.clamp.min, foeX: SS2_ARENA.clamp.max });
  const event = cast(battle);
  assert.deepEqual(closedForm({ casterX: -2100, targetX: 2100, facing: "right", standOff: 86 }), { ticks: 58, to: -220, cut: true });
  assert.equal(event.pullTicks, 58);
  assert.equal(event.cutByWatchdog, true);
  assert.equal(event.targetTo, 2100 - 2320);
  assert.equal(event.staminaSpent, 5, "the watchdog's `nextphase` spends `staminacost` too");
});

test("the cap's boundary: need 2,320 completes on frame 58, need 2,321 is cut one unit short", () => {
  // Caster at -1000, S = 86, so the line is at -914.
  const completes = staged({ hero: { inventory1: 39 }, heroX: -1000, foeX: -914 + 2320 });
  const whole = cast(completes);
  assert.equal(whole.pullTicks, 58);
  assert.equal(whole.cutByWatchdog, false);
  assert.equal(whole.targetTo, -914);

  const cut = staged({ hero: { inventory1: 39 }, heroX: -1000, foeX: -914 + 2321 });
  const short = cast(cut);
  assert.equal(short.pullTicks, 58);
  assert.equal(short.cutByWatchdog, true);
  assert.equal(short.targetTo, -913, "the watchdog stops it one unit outside the stand-off");
});

test("the push past the caster is CLAMPED at the arena wall, and a target already on it does not move", () => {
  // ~~the push behind the caster is CLAMPED at the arena wall~~ — staged with
  // the target BEHIND the caster (-2000 and -2080, then -2000 and the wall).
  //
  // ► **RESTAGED 2026-09-24, BECAUSE THE TURN TO THE TARGET (`ss2TurnToTarget`)
  //   MADE THE PUSH-BEHIND UNREACHABLE.** A caster now turns to face the man it
  //   commands, so a target behind is pulled toward it and never nears a wall.
  //   The one push left is a CO-LOCATED pair: no side to turn to (the build's
  //   strict tests), so the caster keeps its facing and the entry frame's -40
  //   carries the target past it — at the wall, into the clamp. That is the
  //   only way this `clamp` can still bind.
  const near = staged({ hero: { inventory1: 39 }, heroX: -2080, foeX: -2080 });
  assert.equal(cast(near).targetTo, SS2_ARENA.clamp.min, "-2080 - 40 = -2120, clamped");
  assert.equal(combatantById(near, "foe").x, SS2_ARENA.clamp.min);
  assert.equal(near.lastResolution.effects[0].kind, "resource",
    "a co-located caster is not turned first: the slot's consumption is still the phase's first effect");

  const pinned = staged({ hero: { inventory1: 39 }, heroX: SS2_ARENA.clamp.min, foeX: SS2_ARENA.clamp.min });
  const still = cast(pinned);
  assert.equal(still.targetTo, SS2_ARENA.clamp.min);
  assert.equal(combatantById(pinned, "foe").x, SS2_ARENA.clamp.min);
  assert.equal(still.victimClip, "knockback_mov", "the entry block plays the clip whatever the wall does");
});

test("the pull passes THROUGH a bystander, because the arm tests no body but its own two", () => {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, inventory1: 39 }), { id: "hero", name: "hero", controller: "local" })] },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(fields(), { id: "foe", name: "foe", controller: "local" }),
          ss2Combatant(fields(), { id: "bystander", name: "bystander", controller: "local" })
        ]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
  Object.assign(combatantById(battle, "bystander"), { x: 100, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: 1000, y: 200 });
  const event = cast(battle);
  assert.equal(event.targetTo, 0, "the one-body closed form, straight past the bystander at 100");
  assert.equal(combatantById(battle, "bystander").x, 100, "and the bystander is not moved");
});

test("no damage, no armour, and the caster does not move", () => {
  const battle = staged({ hero: { inventory1: 39 }, foeX: 1000 });
  const foe = combatantById(battle, "foe");
  const snapshot = { health: foe.health, armour: foe.resources.armourclass.value };
  cast(battle);
  const after = combatantById(battle, "foe");
  assert.deepEqual({ health: after.health, armour: after.resources.armourclass.value }, snapshot);
  assert.equal(combatantById(battle, "hero").x, -60);
});

test("the event names both clips and the target's endpoints, and carries NO `from`/`to`", () => {
  const event = cast(staged({ hero: { inventory1: 39 }, foeX: 1000 }));
  assert.equal(event.vanillaLabel, "cast_command");
  assert.equal(event.casterClip, "Cast2");
  assert.equal(event.victimClip, "knockback_mov");
  assert.equal(event.spellId, 39);
  assert.equal(event.targetFrom, 1000);
  assert.equal(event.targetTo, 0);
  // `from`/`to` are read as the ACTOR's own move by the presentation layer.
  assert.equal(Object.hasOwn(event, "from"), false);
  assert.equal(Object.hasOwn(event, "to"), false);
});

test("a command the caster does not carry is refused TWICE, and the second refusal names it", () => {
  const battle = staged();
  assert.throws(() => applyAction(battle, { actorId: "hero", type: COMMAND, targetId: "foe" }), /Illegal action/);
  const hero = combatantById(battle, "hero");
  const foe = combatantById(battle, "foe");
  assert.throws(
    () => ss2TeamRules.resolveAction({
      type: COMMAND, turnNumber: battle.turnNumber, actor: hero, target: foe, targetId: foe.id,
      allies: [hero], foes: [foe]
    }, { randomBetween: () => 1, randomNumber: () => 0 }),
    /no declared inventory slot holds item 39/
  );
});

/* ------------------------------------------------------------------ *
 * The presentation                                                    *
 * ------------------------------------------------------------------ */

/** Act, then present; hand back the commands and the scene they build. */
function actAndPresent(battle, action) {
  const layoutBefore = buildArenaLayout(toTeamWireState(battle));
  const constructed = applyCommands(emptyScene(), presentArenaConstruction(layoutBefore));
  applyAction(battle, { actorId: "hero", ...action });
  const wire = toTeamWireState(battle);
  const { commands } = presentResolvedEvents(wire, { layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS });
  return { commands, scene: applyCommands(constructed, commands), constructed };
}

test("presented end to end: Cast2 on the caster, knockback_mov on the victim, and the VICTIM is carried", () => {
  const battle = staged({ hero: { inventory1: 39 }, heroX: -200, foeX: 900 });
  const { commands, scene, constructed } = actAndPresent(battle, { type: COMMAND, targetId: "foe" });
  const event = battle.events.find((entry) => entry.type === COMMAND);

  assert.deepEqual(
    commands.filter((command) => command.kind === CommandKind.CLIP_GOTO)
      .map(({ combatantId, role, label, labelProvenance }) => ({ combatantId, role, label, labelProvenance })),
    [
      { combatantId: "hero", role: "actor", label: "Cast2", labelProvenance: LabelProvenance.MAP_NAMED },
      { combatantId: "foe", role: "target", label: "knockback_mov", labelProvenance: LabelProvenance.MAP_NAMED }
    ]
  );
  assert.deepEqual(
    commands.filter((command) => command.kind === CommandKind.MOVE_CLIP)
      .map(({ combatantId, from, to, pushed }) => ({ combatantId, from, to, pushed: pushed === true })),
    [{ combatantId: "foe", from: event.targetFrom, to: event.targetTo, pushed: true }],
    "exactly one move, the victim's, as a push"
  );
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), [], "nothing unmapped");
  assert.equal(scene.actors.foe.x, combatantById(battle, "foe").x, "the victim is drawn where the resolver put it");
  assert.equal(scene.actors.hero.x, constructed.actors.hero.x, "and the caster stays put");
});

test("knockback_mov resolves to the knockback family, which can draw it, at the family's own pace", () => {
  const victim = timelineFor("knockback_mov", { role: "target" });
  assert.equal(victim.recognised, true, "not the `unknown` schedule");
  assert.equal(victim.family, "knockback");
  assert.ok(clipLabelsFor(victim.family).includes("knockback_mov"));
  assert.equal(new Set(allUnmappedLabels()).has("knockback_mov"), false);
  // Dispatched on its own it is NOT the 19-frame `knockback` run: 13 frames
  // (1434-1446), which is the length the family's nine beats were authored at.
  assert.equal(victim.durationMs, 9 * 120);
  assert.equal(timelineFor("knockback", { role: "target" }).durationMs, 13 * 120, "the entry's run is unchanged");
});

test("the victim SLIDES across knockback_mov, from where it stood to where the pull left it", () => {
  const battle = staged({ hero: { inventory1: 39 }, heroX: -200, foeX: 900 });
  const { commands } = actAndPresent(battle, { type: COMMAND, targetId: "foe" });
  const entry = timelinesForStep(commands).started.get("foe");
  assert.equal(entry.timeline.label, "knockback_mov");
  assert.equal(entry.timeline.travel, false, "knockback_mov is not a travelling schedule");
  assert.ok(entry.motion, "and still carries the pull, because the move is a push");
  const pose = poseAt(entry.timeline, 0);
  const at = (fraction) => figureXAt({ restingX: entry.motion.to, facing: "left", pose, timeline: entry.timeline, motion: entry.motion, at: fraction });
  assert.equal(at(0), 900);
  assert.equal(at(1), combatantById(battle, "foe").x);
});

/* ------------------------------------------------------------------ *
 * The AI                                                              *
 *                                                                     *
 * Arm 25 of `villain_cast_spells` (`+0x0ec2`-`+0x0f17`) casts when id  *
 * 39 is carried and `fightdistance > 300` — after 24 arms that did    *
 * not fire, and after one 90% roll this AI does not take.             *
 * ------------------------------------------------------------------ */

function commandCaster({ foeX = 500, extra = {}, foe = {} } = {}) {
  return staged({ controller: "ai", hero: { inventory1: 39, ...extra }, foe, heroX: 0, foeX });
}

/** The same gladiator with no id 39 — the control every gate test compares against. */
function withoutCommand(battle) {
  combatantById(battle, "hero").resources.inventory1.value = SS2_INVENTORY_EMPTY;
  return suggestAction(battle, "hero").type;
}

test("an AI caster with a foe beyond 300 commands it, in place of the walk it would take", () => {
  const battle = commandCaster({ foeX: 1000 });
  assert.deepEqual(suggestAction(battle, "hero"), { type: COMMAND, targetId: "foe" });
  assert.equal(withoutCommand(battle), Ss2ActionType.WALK_RIGHT);
});

test("at fightdistance 300 the gate is SHUT (strict `>`), and at 301 it is open", () => {
  assert.equal(suggestAction(commandCaster({ foeX: 301 }), "hero").type, COMMAND);
  const battle = commandCaster({ foeX: 300 });
  const shut = suggestAction(battle, "hero").type;
  assert.notEqual(shut, COMMAND);
  assert.equal(shut, withoutCommand(battle));
});

test("the gale (arm 24) PRECEDES the command (arm 25): between 300 and 400 a qualifying gale wins", () => {
  const armoured = { inventory2: 38, helmet: 4, breastplate: 6 };
  const battle = commandCaster({ foeX: 350, extra: armoured });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.resources.armourclass_max.value, 136);
  hero.resources.armourclass.value = 60;
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_GALE);
  // The gale's armour gate shut: the ladder falls through to arm 25.
  hero.resources.armourclass.value = 136;
  assert.equal(suggestAction(battle, "hero").type, COMMAND);
});

test("boundless energy (arm 23, possession alone) and a damage spell (arms 14-18) both pre-empt the command", () => {
  const boundless = commandCaster({ extra: { inventory2: 45 } });
  assert.equal(suggestAction(boundless, "hero").type, Ss2ActionType.CAST_BOUNDLESS_ENERGY);
  const bolt = commandCaster({ extra: { inventory2: 34 } });
  assert.equal(suggestAction(bolt, "hero").type, Ss2ActionType.CAST_LIGHTNING_BOLT);
});

test("a health potion (arm 2) pre-empts the command", () => {
  const battle = commandCaster({ extra: { inventory2: 5 } });
  combatantById(battle, "hero").health = 1;
  assert.equal(suggestAction(battle, "hero").itemId, 5);
});

test("weaken (19) and teleport (26) cannot meet the command: their gates are < 300 and < 250 on the SAME distance", () => {
  // So the ladder order between them is unobservable; what is observable is
  // that each fires on its own side of 300 and never blocks the other.
  const weaken = commandCaster({ foeX: 500, extra: { inventory2: 44 } });
  assert.equal(suggestAction(weaken, "hero").type, COMMAND);
  assert.equal(suggestAction(commandCaster({ foeX: 200, extra: { inventory2: 44 } }), "hero").type, Ss2ActionType.CAST_WEAKEN_ARMOUR);

  const far = commandCaster({ foeX: 500, extra: { inventory2: 48 } });
  combatantById(far, "hero").health = 1;
  assert.equal(suggestAction(far, "hero").type, COMMAND);
  const near = commandCaster({ foeX: 200, extra: { inventory2: 48 } });
  combatantById(near, "hero").health = 1;
  assert.equal(suggestAction(near, "hero").type, Ss2ActionType.CAST_TELEPORT);
});

test("above 1v1 the AI commands the NEAREST foe, and the gate is measured to it", () => {
  function twoFoes(nearX) {
    const battle = createTeamBattle({
      seed: 3,
      rules: ss2TeamRules,
      teams: [
        { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, inventory1: 39 }), { id: "hero", name: "hero", controller: "ai" })] },
        {
          id: "blue",
          name: "blue",
          combatants: [
            ss2Combatant(fields(), { id: "far", name: "far", controller: "ai" }),
            ss2Combatant(fields(), { id: "near", name: "near", controller: "ai" })
          ]
        }
      ]
    });
    Object.assign(combatantById(battle, "hero"), { x: 0, y: 200 });
    Object.assign(combatantById(battle, "far"), { x: 900, y: 200 });
    Object.assign(combatantById(battle, "near"), { x: nearX, y: 200 });
    assert.equal(currentCombatant(battle).id, "hero");
    return battle;
  }
  assert.deepEqual(suggestAction(twoFoes(400), "hero"), { type: COMMAND, targetId: "near" });
  // The nearest inside 300 shuts the gate, although the far foe is beyond it.
  assert.notEqual(suggestAction(twoFoes(250), "hero").type, COMMAND);
});

test("the AI takes no sample to decide, so the build's 90% roll is not reproduced", () => {
  const battle = commandCaster();
  const before = battle.rng.cursor;
  suggestAction(battle, "hero");
  assert.equal(battle.rng.cursor, before);
});
