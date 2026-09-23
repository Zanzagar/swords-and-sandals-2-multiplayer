/**
 * `cast_teleport` — the fourth spell verb, and the first that moves its CASTER.
 *
 * ## WHAT THE BUILD DOES, AND WHERE
 *
 * Derived from the oracle whose sha256 is `77CB545C…`, read 2026-09-22 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f`, block base `0x240c85`,
 * `+0x7541`-`+0x76ad`:
 *
 * ```text
 *   phase_decision == "cast_teleport"                               +0x7541
 *     register:3.crowd_action = 3                                   +0x7554
 *     game_attacker.staminacost = Math.round(game_attacker.magicka) +0x7561
 *     if (attacker.struck == null) {                                +0x7588
 *       cast_spell_icon(attacker, 48)                               +0x759f
 *       arena.gladiators.attachMovie("circlets", "circlets", depth,
 *                { _x: attacker._x, _y: 200 })                      +0x75b7-+0x7610
 *       attacker.struck = false                                     +0x7612
 *       attacker.gotoAndPlay("Cast2")                               +0x7620
 *     }
 *     combatscale()                                                 +0x7635
 *     if (attacker.struck == true) {                                +0x7646
 *       attacker._x = randomBetween(-2000, 2000)                    +0x765e-+0x767b
 *       attacker.gotoAndPlay("Cast2")                               +0x767c
 *       attacker.struck = null; nextphase()                         +0x7691-+0x76ad
 *     }
 * ```
 *
 * ONE `randomBetween`, absolute (the push order is `"_x", 2000, -2000, 2`, so
 * the call is `randomBetween(-2000, 2000)` and its result is STORED, not
 * added), no `_y` write, no facing write, and no reference to `defender` or
 * `game_defender` anywhere in the arm. `combatscale()` — the build's camera,
 * called every tick of this arm and of no other arm in the block — is a
 * presentation cue this engine does not model.
 *
 * ## WHAT THE 1v1 BUILD NEVER HAD TO DECIDE, AND WHAT IS DECIDED HERE
 *
 * The caster may land ON or INSIDE any gladiator, friend or foe, because the
 * build's arm checks nothing and re-rolls nothing; the rank (`y`) is left
 * alone; and there is no body-blocking check, because this is not a walk.
 * **All three are INVENTED for the N-body arena**, stated at the resolver
 * branch, and pinned below — including that nothing downstream breaks when two
 * bodies share an `x`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, suggestAction,
  toTeamWireState
} from "../src/team/index.js";
import {
  SS2_ARENA, SS2_FACING_LEFT, SS2_INVENTORY_EMPTY, SS2_INVENTORY_SLOTS, SS2_TELEPORT, Ss2ActionType,
  VANILLA_PHASE_LABEL, createSs2TeamRules, ss2Combatant, ss2InventorySlotHolding, ss2TeamRules
} from "../src/team/ss2-rules.js";
import {
  buildArenaLayout, CommandKind, LabelProvenance, presentArenaConstruction, presentResolvedEvents,
  SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import {
  applyCommands, emptyScene, figureXAt, poseAt, timelineFor, timelinesForStep
} from "../src/render/index.js";

const TELEPORT = Ss2ActionType.CAST_TELEPORT;

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

/** One tape sample for the teleport's own draw — the label and bounds are the pin. */
const destinationSample = (value) => ({
  // The literal, not `SS2_TELEPORT.rollLabel`: a tape that read the label off
  // the constant would agree with any label the constant held.
  label: "teleport-destination-roll",
  source: "randomBetween",
  min: -2000,
  max: 2000,
  value
});

/**
 * A 1v1 with the caster on RED, opening, facing right — the gale test's
 * staging. `rngTape` replaces the seeded channel when given, so a test can
 * name the exact destination the one draw returns.
 */
function staged({
  hero = {}, foe = {}, heroX = -60, foeX = 60, heroY = 200, foeY = 200, controller = "local",
  rules = ss2TeamRules, rngTape = null
} = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rngTape,
    rules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller })]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller })]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: heroX, y: heroY });
  Object.assign(combatantById(battle, "foe"), { x: foeX, y: foeY });
  assert.equal(currentCombatant(battle).id, "hero", "the caster must open for these tests to mean anything");
  return battle;
}

const teleportOptions = (battle, id = "hero") =>
  legalActions(battle, id).filter((option) => option.type === TELEPORT);

/** Cast, and hand back the teleport's own event off the battle log. */
function cast(battle, actorId = "hero") {
  applyAction(battle, { actorId, type: TELEPORT, targetId: actorId });
  const event = battle.events.at(-1);
  assert.equal(event.type, TELEPORT, "the teleport's own event is the last one logged");
  return event;
}

const facesLeft = (battle, id) => (combatantById(battle, id).status ?? []).includes(SS2_FACING_LEFT);

/* ------------------------------------------------------------------ *
 * The vocabulary                                                      *
 * ------------------------------------------------------------------ */

test("the token is `cast-teleport` and it round-trips to the build's own `cast_teleport`", () => {
  assert.equal(TELEPORT, "cast-teleport");
  // `phase_decision == "cast_teleport"` at `+0x7547`, and the decision ladder
  // arm 26 writes at `+0x0f91`.
  assert.equal(VANILLA_PHASE_LABEL[TELEPORT], "cast_teleport");
  assert.ok(createSs2TeamRules().actionTypes.includes(TELEPORT));
});

test("the teleport's constants are the build's literals", () => {
  // `cast_spell_icon(attacker, 48)` at `+0x759f`; `check_inventory(48)` at
  // ladder arm 26 (`+0x0f1c`).
  assert.equal(SS2_TELEPORT.itemId, 48);
  // `Push "_x", 2000, -2000, 2, "randomBetween"` at `+0x7664`: arg1 is the
  // last pushed before the count, so the call is randomBetween(-2000, 2000).
  assert.equal(SS2_TELEPORT.destinationLow, -2000);
  assert.equal(SS2_TELEPORT.destinationHigh, 2000);
  // `attacker.gotoAndPlay("Cast2")` at `+0x7620` (and again at `+0x767c`).
  assert.equal(SS2_TELEPORT.casterClip, "Cast2");
  // `register:3.crowd_action = 3` at `+0x7554` — ~~recorded, not modelled~~ MODELLED 2026-09-22 (`test/ss2-crowd.test.js`).
  assert.equal(SS2_TELEPORT.crowdAction, 3);
  // Ladder arm 26: `fightdistance < 250` at `+0x0f48`-`+0x0f50`.
  assert.equal(SS2_TELEPORT.aiFightDistanceBelow, 250);
});

/* ------------------------------------------------------------------ *
 * The offer                                                           *
 * ------------------------------------------------------------------ */

test("a gladiator carrying no inventory is offered no teleport", () => {
  assert.deepEqual(teleportOptions(staged()), []);
});

test("carrying id 48 offers ONE teleport, targeted at the caster itself, from any declared slot", () => {
  // Self-targeted like `rest` and `swap-weapons`: the arm never reads
  // `defender`, so a per-foe offer would be N copies of one action.
  assert.deepEqual(teleportOptions(staged({ hero: { inventory1: 48 } })), [{ type: TELEPORT, targetId: "hero" }]);
  assert.deepEqual(teleportOptions(staged({ hero: { inventory6: 48 } })), [{ type: TELEPORT, targetId: "hero" }]);
});

test("the teleport is refused when aimed at anybody but the caster", () => {
  const battle = staged({ hero: { inventory1: 48 } });
  assert.throws(() => applyAction(battle, { actorId: "hero", type: TELEPORT, targetId: "foe" }), /Illegal action/);
});

test("a slot holding the EMPTY marker 1, or 0, offers no teleport", () => {
  assert.deepEqual(teleportOptions(staged({ hero: { inventory1: SS2_INVENTORY_EMPTY } })), []);
  assert.deepEqual(teleportOptions(staged({ hero: { inventory1: 0 } })), []);
});

test("an UNDECLARED slot is not searched, and a declared later slot still is", () => {
  const battle = staged({ hero: { inventory2: 48 } });
  const hero = combatantById(battle, "hero");
  assert.equal(Object.hasOwn(hero.resources, "inventory1"), false);
  assert.equal(ss2InventorySlotHolding(hero, SS2_TELEPORT.itemId), "inventory2");
  assert.equal(teleportOptions(battle).length, 1);
});

test("the slot window applies: id 48 above `inventory_maxslots` is not offered, inside it is", () => {
  const in3 = (extra = {}) => ({ [SS2_INVENTORY_SLOTS[2]]: 48, ...extra });
  assert.equal(teleportOptions(staged({ hero: in3() })).length, 1, "undeclared window: slot 3 is reachable");
  assert.equal(teleportOptions(staged({ hero: in3({ inventory_maxslots: 2 }) })).length, 0,
    "maxslots 2 hides the button for slot 3");
  assert.equal(teleportOptions(staged({ hero: in3({ inventory_maxslots: 3 }) })).length, 1);
});

test("the offer reads neither distance nor health, which are the villain's gate and not the button's", () => {
  // Full health, a foe across the arena, a foe standing on top of the caster:
  // the button is live in every one.
  assert.equal(teleportOptions(staged({ hero: { inventory1: 48 }, foeX: 1900 })).length, 1);
  assert.equal(teleportOptions(staged({ hero: { inventory1: 48 }, foeX: -60 })).length, 1);
  const battle = staged({ hero: { inventory1: 48 } });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.health, hero.maxHealth);
  assert.equal(teleportOptions(battle).length, 1);
});

test("a forced rest still outranks the teleport", () => {
  const battle = staged({ hero: { inventory1: 48 } });
  combatantById(battle, "hero").resources.staminaleft.value = 0;
  assert.deepEqual(legalActions(battle, "hero").map((option) => option.type), [Ss2ActionType.REST]);
});

/* ------------------------------------------------------------------ *
 * The phase                                                           *
 * ------------------------------------------------------------------ */

test("a teleport takes exactly ONE sample: randomBetween(-2000, 2000), labelled", () => {
  const battle = staged({ hero: { inventory1: 48 } });
  const before = battle.rng.cursor;
  const event = cast(battle);
  assert.equal(battle.rng.cursor - before, 1, "exactly one sample leaves the ordered channel");
  const drawn = battle.rng.journal.at(-1);
  assert.deepEqual(
    { label: drawn.label, source: drawn.source, min: drawn.min, max: drawn.max },
    { label: "teleport-destination-roll", source: "randomBetween", min: -2000, max: 2000 }
  );
  assert.equal(event.rolledX, drawn.value);
});

test("the destination is ABSOLUTE: the draw is the new x, whatever the old one was", () => {
  // `SetMember` of the call's result at `+0x767b` — no `Add2`, no `_x` read.
  for (const heroX of [-60, -1500, 400]) {
    const battle = staged({ hero: { inventory1: 48 }, heroX, foeX: 1900, rngTape: [destinationSample(1234)] });
    const event = cast(battle);
    assert.equal(event.from, heroX);
    assert.equal(event.to, 1234);
    assert.equal(combatantById(battle, "hero").x, 1234, `from ${heroX}`);
  }
});

test("both extremes are reachable and land exactly: the arena clamp cannot bind a teleport", () => {
  // The live clip clamp is ±2100 (`attacker.onEnterFrame` `+0x38fd`/`+0x3988`),
  // wider than the draw on both sides, so the clamp applied here is a no-op for
  // every value the draw can return.
  assert.ok(SS2_ARENA.clamp.min < SS2_TELEPORT.destinationLow);
  assert.ok(SS2_ARENA.clamp.max > SS2_TELEPORT.destinationHigh);
  for (const value of [-2000, 2000]) {
    const battle = staged({ hero: { inventory1: 48 }, rngTape: [destinationSample(value)] });
    cast(battle);
    assert.equal(combatantById(battle, "hero").x, value);
  }
});

test("the rank is left alone: a teleport writes x and never y", () => {
  const backRank = SS2_ARENA.frontY - SS2_ARENA.rankStride;
  const battle = staged({ hero: { inventory1: 48 }, heroY: backRank, rngTape: [destinationSample(700)] });
  cast(battle);
  const hero = combatantById(battle, "hero");
  assert.equal(hero.x, 700);
  assert.equal(hero.y, backRank);
  const resolution = battle.lastResolution;
  assert.equal(resolution.effects.some((effect) => effect.kind === "lateral"), false);
});

test("the cost is round(magicka), the STAT, with regeneration on top", () => {
  const battle = staged({ hero: { inventory1: 48, magicka: 12 } });
  const before = combatantById(battle, "hero").resources.staminaleft.value;
  const event = cast(battle);
  assert.equal(event.staminaSpent, 12);
  // `nextphase`: `-= staminacost`, then `+= 1 + round(stamina / 3)` with stamina 6.
  assert.equal(event.staminaGained, -12 + 1 + Math.round(6 / 3));
  assert.equal(combatantById(battle, "hero").resources.staminaleft.value - before, event.staminaGained);
});

test("there is NO affordability check: a caster at 11 stamina still casts a 30-magicka teleport and floors at 0", () => {
  const battle = staged({ hero: { inventory1: 48, magicka: 30 } });
  combatantById(battle, "hero").resources.staminaleft.value = 11;
  assert.equal(teleportOptions(battle).length, 1);
  cast(battle);
  assert.equal(combatantById(battle, "hero").resources.staminaleft.value, 0);
});

test("casting CONSUMES the slot by setting it to 1, and the offer goes with it", () => {
  const battle = staged({ hero: { inventory3: 48 } });
  const event = cast(battle);
  assert.equal(event.consumedSlot, "inventory3");
  assert.equal(combatantById(battle, "hero").resources.inventory3.value, SS2_INVENTORY_EMPTY);
  // The foe acts next; the caster is offered nothing on its following turn.
  assert.deepEqual(teleportOptions(battle), []);
});

test("the event names Cast2 on the caster, no victim clip, and the draw", () => {
  const battle = staged({ hero: { inventory1: 48 }, rngTape: [destinationSample(-900)] });
  const event = cast(battle);
  assert.equal(event.casterClip, "Cast2");
  assert.equal(Object.hasOwn(event, "victimClip"), false, "the arm plays nothing on anybody else");
  assert.equal(event.vanillaLabel, "cast_teleport");
  assert.equal(event.spellId, 48);
  assert.equal(event.actorId, "hero");
  assert.equal(event.targetId, "hero");
  assert.equal(event.rolledX, -900);
  assert.equal(event.from, -60);
  assert.equal(event.to, -900);
});

test("nobody else is touched: the foe keeps its x, health and armour", () => {
  const battle = staged({ hero: { inventory1: 48 }, rngTape: [destinationSample(1500)] });
  const foe = combatantById(battle, "foe");
  const snapshot = { x: foe.x, health: foe.health, armour: foe.resources.armourclass.value };
  cast(battle);
  const after = combatantById(battle, "foe");
  assert.deepEqual({ x: after.x, health: after.health, armour: after.resources.armourclass.value }, snapshot);
});

test("a teleport the caster does not carry is refused TWICE, and the second refusal names it", () => {
  const battle = staged();
  assert.throws(() => applyAction(battle, { actorId: "hero", type: TELEPORT, targetId: "hero" }), /Illegal action/);
  const hero = combatantById(battle, "hero");
  const foe = combatantById(battle, "foe");
  assert.throws(
    () => ss2TeamRules.resolveAction({
      type: TELEPORT, turnNumber: battle.turnNumber, actor: hero, target: hero, targetId: hero.id,
      allies: [hero], foes: [foe]
    }, { randomBetween: () => 0, randomNumber: () => 0 }),
    /no declared inventory slot holds item 48/
  );
});

test("a direct resolve refuses a teleport held OUTSIDE the slot window, and says so", () => {
  const battle = staged({ hero: { inventory3: 48, inventory_maxslots: 2 } });
  const hero = combatantById(battle, "hero");
  const foe = combatantById(battle, "foe");
  assert.throws(
    () => ss2TeamRules.resolveAction({
      type: TELEPORT, turnNumber: battle.turnNumber, actor: hero, target: hero, targetId: hero.id,
      allies: [hero], foes: [foe]
    }, { randomBetween: () => 0, randomNumber: () => 0 }),
    /outside inventory_maxslots 2/
  );
});

test("a caster that models no position still takes its one draw, and moves nobody", () => {
  // The tape is the contract: the build draws on every completed cast, so a
  // peer replaying it must consume the sample whether or not this rule set
  // models where anybody stands.
  const battle = staged({ hero: { inventory1: 48 } });
  const hero = { ...combatantById(battle, "hero"), x: null };
  const foe = combatantById(battle, "foe");
  const calls = [];
  const outcome = ss2TeamRules.resolveAction({
    type: TELEPORT, turnNumber: battle.turnNumber, actor: hero, target: hero, targetId: hero.id,
    allies: [hero], foes: [foe]
  }, {
    randomBetween: (label, min, max) => { calls.push([label, min, max]); return 321; },
    randomNumber: () => { throw new Error("no randomNumber in this arm"); }
  });
  assert.deepEqual(calls, [["teleport-destination-roll", -2000, 2000]]);
  assert.equal(outcome.effects.some((effect) => effect.kind === "position"), false);
  const [event] = outcome.events;
  assert.equal(event.rolledX, 321);
  assert.equal(event.from, null);
  assert.equal(event.to, null);
});

/* ------------------------------------------------------------------ *
 * Facing, after the move                                              *
 * ------------------------------------------------------------------ */

test("teleporting PAST the foe turns both of them round", () => {
  const battle = staged({ hero: { inventory1: 48 }, rngTape: [destinationSample(500)] });
  assert.equal(facesLeft(battle, "hero"), false);
  assert.equal(facesLeft(battle, "foe"), true);
  cast(battle);
  assert.equal(facesLeft(battle, "hero"), true, "the caster now stands right of its foe");
  assert.equal(facesLeft(battle, "foe"), false, "and the foe turns to face it");
});

test("teleporting AWAY, on the same side, turns nobody", () => {
  const battle = staged({ hero: { inventory1: 48 }, rngTape: [destinationSample(-1800)] });
  cast(battle);
  assert.equal(facesLeft(battle, "hero"), false);
  assert.equal(facesLeft(battle, "foe"), true);
});

test("landing EXACTLY on the foe turns nobody, because the build's two facing tests are strict", () => {
  const battle = staged({ hero: { inventory1: 48 }, rngTape: [destinationSample(60)] });
  cast(battle);
  assert.equal(combatantById(battle, "hero").x, combatantById(battle, "foe").x);
  assert.equal(facesLeft(battle, "hero"), false);
  assert.equal(facesLeft(battle, "foe"), true);
});

test("above 1v1 each fighter re-faces its OWN nearest foe after the caster lands", () => {
  // Two foes: `near` at 60, `far` at 1500. The caster lands at 1400 — right of
  // `near`, just left of `far`. Its own nearest foe is now `far`, on its right,
  // so it keeps facing right; `near` turns right to face it; `far` already
  // faced left and still does.
  const battle = createTeamBattle({
    seed: 3,
    rngTape: [destinationSample(1400)],
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(fields({ speed: 21, inventory1: 48 }), { id: "hero", name: "hero", controller: "local" })]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(fields(), { id: "near", name: "near", controller: "local" }),
          ss2Combatant(fields(), { id: "far", name: "far", controller: "local" })
        ]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
  Object.assign(combatantById(battle, "near"), { x: 60, y: 200 });
  Object.assign(combatantById(battle, "far"), { x: 1500, y: 200 });
  assert.equal(currentCombatant(battle).id, "hero");
  assert.equal(facesLeft(battle, "near"), true);
  assert.equal(facesLeft(battle, "far"), true);
  cast(battle);
  assert.equal(facesLeft(battle, "hero"), false);
  assert.equal(facesLeft(battle, "near"), false);
  assert.equal(facesLeft(battle, "far"), true);
});

/* ------------------------------------------------------------------ *
 * Two bodies on one x — the N-body case the build never met           *
 * ------------------------------------------------------------------ */

test("the caster may land ON its foe: allowed, not re-rolled, and one draw only", () => {
  const battle = staged({ hero: { inventory1: 48 }, rngTape: [destinationSample(60)] });
  const before = battle.rng.cursor;
  const event = cast(battle);
  assert.equal(battle.rng.cursor - before, 1);
  assert.equal(event.to, 60);
  assert.equal(combatantById(battle, "hero").x, 60);
  assert.equal(combatantById(battle, "foe").x, 60);
});

/** A 1v1 with both fighters on one x — the state a teleport onto a foe leaves. */
function overlapping({ actor = "hero" } = {}) {
  const battle = staged();
  Object.assign(combatantById(battle, "hero"), { x: 60 });
  Object.assign(combatantById(battle, "foe"), { x: 60 });
  if (actor === "foe") {
    // Pass the hero's turn with the one action that moves nobody.
    applyAction(battle, { actorId: "hero", type: Ss2ActionType.REST, targetId: "hero" });
    assert.equal(currentCombatant(battle).id, "foe");
  }
  return battle;
}

test("overlapped, BOTH fighters are offered a sane list: a swing, a rest, and the close frame's ONE walk", () => {
  for (const id of ["hero", "foe"]) {
    const battle = overlapping({ actor: id });
    const types = legalActions(battle, id).map((option) => option.type);
    assert.ok(types.includes(Ss2ActionType.REST), `${id} can always rest`);
    // At fightdistance 0 the other body is inside every reach, so the melee
    // verbs are on offer — and the close frame wires the retreat only.
    assert.ok(types.includes(Ss2ActionType.QUICK_ATTACK), `${id} can swing at a body it is standing in`);
    const walks = types.filter((type) => type === Ss2ActionType.WALK_LEFT || type === Ss2ActionType.WALK_RIGHT);
    assert.equal(walks.length, 1, `${id} is on the close frame, which wires one walk`);
  }
});

test("overlapped, the walk either fighter is offered resolves, stays in the arena, and separates the two", () => {
  // Which way it goes at an exact tie is `legalActions`' own tie-break
  // (`nearest.x > actor.x` is false, so "away" is right for both) — reported,
  // not pinned here.
  for (const id of ["hero", "foe"]) {
    const battle = overlapping({ actor: id });
    const walks = legalActions(battle, id)
      .filter((option) => option.type === Ss2ActionType.WALK_LEFT || option.type === Ss2ActionType.WALK_RIGHT);
    for (const walk of walks) {
      const copy = overlapping({ actor: id });
      assert.doesNotThrow(() => applyAction(copy, { actorId: id, ...walk }), `${id} ${walk.type}`);
      const x = combatantById(copy, id).x;
      assert.ok(Number.isFinite(x) && x >= SS2_ARENA.clamp.min && x <= SS2_ARENA.clamp.max, `${id} ${walk.type} -> ${x}`);
      const other = combatantById(copy, id === "hero" ? "foe" : "hero");
      assert.notEqual(x, other.x, `${id} ${walk.type} walked out of the other body`);
    }
  }
});

test("overlapped, a melee swing resolves without throwing and hits a number the resolver can hold", () => {
  const battle = overlapping();
  const hero = combatantById(battle, "hero");
  const foe = combatantById(battle, "foe");
  const foeHealth = foe.health;
  assert.doesNotThrow(() => applyAction(battle, { actorId: "hero", type: Ss2ActionType.QUICK_ATTACK, targetId: "foe" }));
  const after = combatantById(battle, "foe");
  assert.ok(Number.isFinite(after.health) && after.health <= foeHealth && after.health >= 0);
  assert.ok(Number.isFinite(after.x) && Number.isFinite(hero.x));
});

/* ------------------------------------------------------------------ *
 * The presentation                                                    *
 * ------------------------------------------------------------------ */

/** Act, then present; hand back the commands and the scene they build. */
function castAndPresent(battle) {
  const layoutBefore = buildArenaLayout(toTeamWireState(battle));
  const constructed = applyCommands(emptyScene(), presentArenaConstruction(layoutBefore));
  const event = cast(battle);
  const wire = toTeamWireState(battle);
  const { commands } = presentResolvedEvents(wire, { layout: buildArenaLayout(wire), bindings: SS2_STATIC_MAP_BINDINGS });
  return { event, commands, scene: applyCommands(constructed, commands), constructed };
}

test("a presented teleport plays Cast2 on the caster, MAP_NAMED, and nothing on anybody else", () => {
  const { commands } = castAndPresent(staged({ hero: { inventory1: 48 }, rngTape: [destinationSample(900)] }));
  const clips = commands.filter((command) => command.kind === CommandKind.CLIP_GOTO);
  assert.deepEqual(
    clips.map(({ combatantId, role, label, labelProvenance }) => ({ combatantId, role, label, labelProvenance })),
    [{ combatantId: "hero", role: "actor", label: "Cast2", labelProvenance: LabelProvenance.MAP_NAMED }]
  );
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), []);
});

test("a presented teleport moves the CASTER, as a teleport and not as a walk or a push", () => {
  const { event, commands, scene } = castAndPresent(
    staged({ hero: { inventory1: 48 }, rngTape: [destinationSample(900)] })
  );
  const moves = commands.filter((command) => command.kind === CommandKind.MOVE_CLIP);
  assert.deepEqual(
    moves.map(({ combatantId, from, to, pushed, teleported }) => ({ combatantId, from, to, pushed, teleported })),
    [{ combatantId: "hero", from: event.from, to: event.to, pushed: undefined, teleported: true }]
  );
  assert.equal(scene.actors.hero.x, 900, "the scene's resting x is where the resolver put the caster");
  assert.equal(scene.actors.hero.motion.teleported, true);
});

test("the `circlets` prop is NOT attached: the painter would draw any attached effect as a bolt", () => {
  // `arena.gladiators.attachMovie("circlets", ...)` at `+0x75f2` is real, and
  // this repository has not extracted the prop. ~~`drawSpellEffects` in
  // `tools/arena/main.js` hands every attached record to `boltOpsFor`, whose
  // linkage is hard-coded to `lightning_bolt_combat`, and falls back to a
  // jagged bolt stroke — so an unknown effect would not be skipped, it would
  // be drawn as lightning.~~ **Since 2026-09-23 `beginStep` routes attached
  // records by linkage** (the molten-death boulders made a second kind), and
  // an effect it has no painter for is logged and skipped rather than drawn as
  // lightning. Still unbuilt and named: nothing draws `circlets`.
  const { commands } = castAndPresent(staged({ hero: { inventory1: 48 }, rngTape: [destinationSample(900)] }));
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.ATTACH_EFFECT), []);
});

test("THE CASTER DOES NOT SLIDE: it holds its old x for the whole of Cast2 and is at the new x when Cast2 ends", () => {
  const { event, commands } = castAndPresent(staged({ hero: { inventory1: 48 }, rngTape: [destinationSample(900)] }));
  const entry = timelinesForStep(commands).started.get("hero");
  assert.equal(entry.timeline.label, "Cast2");
  assert.equal(entry.timeline.travel, false, "Cast2 is not a travelling schedule");
  assert.ok(entry.motion, "and still carries the teleport");
  assert.equal(entry.motion.teleported, true);
  const at = (fraction) => figureXAt({
    restingX: event.to, facing: "right", pose: poseAt(entry.timeline, fraction),
    timeline: entry.timeline, motion: entry.motion, at: fraction
  });
  for (const fraction of [0, 0.25, 0.5, 0.75, 0.999]) {
    assert.equal(at(fraction), event.from, `at ${fraction} the caster is still where it cast`);
  }
  assert.equal(at(1), event.to, "and it is at the destination when the clip reports");
});

test("figureXAt's teleport rule is a step, never an interpolation, and it keeps the lunge on the held x", () => {
  const cast2 = timelineFor("Cast2", { role: "actor" });
  const motion = { from: -60, to: 900, teleported: true };
  const lunging = { ...poseAt(cast2, 0.5), advance: 0.5 };
  assert.equal(figureXAt({ restingX: 900, facing: "right", pose: lunging, timeline: cast2, motion, at: 0.5 }), -60 + 37);
  assert.equal(figureXAt({ restingX: 900, facing: "left", pose: lunging, timeline: cast2, motion, at: 0.5 }), -60 - 37);
  assert.equal(figureXAt({ restingX: 900, facing: "right", pose: poseAt(cast2, 1), timeline: cast2, motion, at: 1 }), 900);
  // A motion that does not say `teleported` is what it always was: a pushed
  // one slides, and an unflagged one on a non-travelling clip is ignored.
  assert.equal(
    figureXAt({ restingX: 900, facing: "right", pose: poseAt(cast2, 0.5), timeline: cast2, motion: { from: -60, to: 900, pushed: true }, at: 0.5 }),
    420
  );
  assert.equal(
    figureXAt({ restingX: 900, facing: "right", pose: poseAt(cast2, 0.5), timeline: cast2, motion: { from: -60, to: 900 }, at: 0.5 }),
    900
  );
});

test("Cast2 resolves to a family that can draw it", () => {
  const timeline = timelineFor("Cast2", { role: "actor" });
  assert.equal(timeline.recognised, true);
  assert.equal(timeline.family, "cast");
});

/* ------------------------------------------------------------------ *
 * The AI                                                              *
 *                                                                     *
 * The build's rule, as far as this engine can hold it: arm 26 of      *
 * `villain_cast_spells` casts when id 48 is carried, the pair's       *
 * `fightdistance < 250`, and the caster's own                         *
 * `hitpoints < hitpointsmax / 2` — after 25 arms that did not fire,   *
 * and after one 90% roll this AI does not take.                       *
 * ------------------------------------------------------------------ */

/** Health 170 of 170 at construction; `health` rewrites the current value. */
function teleportCaster({ health = 60, foeX = 120, extra = {}, foe = {} } = {}) {
  const battle = staged({ controller: "ai", hero: { inventory1: 48, ...extra }, foe, heroX: 0, foeX });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.maxHealth, 170, "staged with 170 hitpoints at most");
  hero.health = health;
  return battle;
}

/** The same gladiator with no id 48 — the control every gate test compares against. */
function withoutTeleport(battle) {
  combatantById(battle, "hero").resources.inventory1.value = SS2_INVENTORY_EMPTY;
  return suggestAction(battle, "hero").type;
}

test("an AI caster below half health with a foe inside 250 teleports", () => {
  const chosen = suggestAction(teleportCaster(), "hero");
  assert.deepEqual(chosen, { type: TELEPORT, targetId: "hero" });
});

test("the teleport OVERRIDES a swing in reach, as `villain_cast_spells` overrides the decision", () => {
  const battle = teleportCaster({ foeX: 120 });
  assert.equal(suggestAction(battle, "hero").type, TELEPORT);
  assert.equal(withoutTeleport(battle), Ss2ActionType.QUICK_ATTACK);
});

test("the teleport is chosen from BEYOND melee reach too, anywhere inside 250", () => {
  const battle = teleportCaster({ foeX: 249 });
  assert.equal(suggestAction(battle, "hero").type, TELEPORT);
  assert.equal(withoutTeleport(battle), Ss2ActionType.WALK_RIGHT);
});

test("at fightdistance 250 the gate is SHUT (strict `<`), and the AI does what it would without 48", () => {
  const battle = teleportCaster({ foeX: 250 });
  const shut = suggestAction(battle, "hero").type;
  assert.notEqual(shut, TELEPORT);
  assert.equal(shut, withoutTeleport(battle));
});

test("with health at EXACTLY half the gate is shut (strict `<`), and one below it is open", () => {
  const battle = teleportCaster({ health: 85 });
  const shut = suggestAction(battle, "hero").type;
  assert.notEqual(shut, TELEPORT);
  assert.equal(shut, withoutTeleport(battle));
  assert.equal(suggestAction(teleportCaster({ health: 84 }), "hero").type, TELEPORT);
});

test("half of an ODD maximum is not floored: 85 of 171 is below 85.5 and teleports", () => {
  // `Push 2; Divide; Less2` at `+0x0f81`-`+0x0f8a` — no rounding anywhere.
  // A floored half (85) would shut this gate.
  const battle = teleportCaster({ health: 85 });
  combatantById(battle, "hero").maxHealth = 171;
  assert.equal(suggestAction(battle, "hero").type, TELEPORT);
});

test("a caster at full health never teleports", () => {
  const battle = teleportCaster({ health: 170 });
  assert.notEqual(suggestAction(battle, "hero").type, TELEPORT);
});

test("a caster offered a BOLT keeps the bolt, because arms 15 and 17 precede arm 26", () => {
  const battle = teleportCaster({ extra: { inventory2: 34 } });
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_LIGHTNING_BOLT);
});

test("carrying a bolt shuts the teleport even when the bolt itself loses the pricing", () => {
  // The gale test's heavy hitter: this engine prices the bolt below a power
  // swing, and the teleport must still be unreachable, because in the build
  // the bolt arm fires first.
  const battle = teleportCaster({ extra: { inventory2: 34, strength: 60, attack: 60, weapon: 24 } });
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.POWER_ATTACK);
});

test("a caster QUALIFYING for gale keeps the gale, because arm 24 precedes arm 26", () => {
  // Armour 60 of 136 is below half, and 120 is inside both 400 and 250.
  const battle = teleportCaster({ extra: { inventory2: 38, helmet: 4, breastplate: 6 } });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.resources.armourclass_max.value, 136);
  hero.resources.armourclass.value = 60;
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_GALE);
});

test("a caster carrying gale whose gale gate is SHUT falls through to the teleport, as the ladder does", () => {
  // Full armour fails arm 24's third condition, so the ladder moves on to 25
  // (command, which has no verb here) and then to 26.
  const battle = teleportCaster({ extra: { inventory2: 38, helmet: 4, breastplate: 6 } });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.resources.armourclass.value, hero.resources.armourclass_max.value);
  assert.equal(suggestAction(battle, "hero").type, TELEPORT);
});

test("above 1v1 the distance gate reads the NEAREST foe", () => {
  // INVENTED: the build has one `defender`. The nearest foe is the one a
  // teleport is escaping, and the one `nearestFoe` already names for gale.
  const build = (nearX) => {
    const battle = createTeamBattle({
      seed: 3,
      rules: ss2TeamRules,
      teams: [
        {
          id: "red",
          name: "red",
          combatants: [ss2Combatant(fields({ speed: 21, inventory1: 48 }), { id: "hero", name: "hero", controller: "ai" })]
        },
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
    Object.assign(combatantById(battle, "near"), { x: nearX, y: 200 });
    Object.assign(combatantById(battle, "far"), { x: 1200, y: 200 });
    combatantById(battle, "hero").health = 40;
    assert.equal(currentCombatant(battle).id, "hero");
    return battle;
  };
  assert.equal(suggestAction(build(200), "hero").type, TELEPORT);
  assert.notEqual(suggestAction(build(300), "hero").type, TELEPORT);
});

test("the AI takes no sample to decide, so the build's 90% roll is not reproduced", () => {
  const battle = teleportCaster();
  const before = battle.rng.cursor;
  suggestAction(battle, "hero");
  assert.equal(battle.rng.cursor, before);
});
