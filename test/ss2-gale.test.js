/**
 * `cast_gale` — the third spell verb, and the first that deals no damage.
 *
 * ## WHAT THE BUILD DOES, AND WHERE
 *
 * Derived from the oracle whose sha256 is `77CB545C…`, re-read 2026-09-22 from
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f`, block base `0x240c85`,
 * `+0x7aaa`-`+0x7be5`:
 *
 * ```text
 *   phase_decision == "cast_gale"                                   +0x7aaa
 *     game_attacker.staminacost = Math.round(game_attacker.magicka) +0x7ad0
 *     if (attacker.shove != true) {                                 +0x7af1
 *       cast_spell_icon(attacker, 38)                               +0x7b0a
 *       attacker.shove = true                                       +0x7b22
 *       attacker.gotoAndPlay("Cast1")                               +0x7b30
 *       if (attacker.gladiator_dir == "right") force = 1000         +0x7b5d
 *       else                                   force = -1000        +0x7b6d
 *       defender.gotoAndPlay("knockback")                           +0x7b78
 *       knockback(defender, force)                                  +0x7b8c
 *     }
 *     if (attacker.struck == true) { ...; nextphase() }             +0x7ba4
 * ```
 *
 * `knockback(whichcharacter, force)` (`+0x1dd3`) is one `mx.transitions.Tween`
 * of `_x` from `_x` to `_x + force` over one second, with no comparison in it
 * at all — the only bound is the clip clamp in `attacker.onEnterFrame`, which
 * this engine carries as `SS2_ARENA.clamp`.
 *
 * ## THE PREMISE THIS VERB WAS BLOCKED ON, AND WHY IT DID NOT HOLD
 *
 * The handoff of 2026-09-20 said `cast_gale` was *"blocked on `fightdistance`,
 * an arena field this engine has no combatant-level home for"*. **That
 * conflated the villain's DECISION with the verb's OFFER.** The five-condition
 * gate — a 90% roll, 23 preceding ladder arms, `check_inventory(38)`,
 * `fightdistance < 400` and `armourclass < armourclass_max / 2` — lives in
 * `villain_cast_spells` (`DoAction@0x23e7cf`), which the map says
 * `villainChooseAction` calls LAST to replace its own decision. The HERO's
 * offer is the inventory button, whose click handler
 * (`sprite:862[overlay]/frame:1`, `+0x05ca`-`+0x0638` for slot 1) tests only
 * `inv_struck != true`. **The phase itself reads no `fightdistance` either.**
 * So `legalActions` needs possession and nothing else, and the AI half reads
 * the build's own distance per pair through `ss2FightDistance`, which already
 * implements `getfightdistance`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, suggestAction,
  toTeamWireState
} from "../src/team/index.js";
import {
  SS2_ARENA, SS2_FACING_LEFT, SS2_GALE, SS2_INVENTORY_EMPTY, Ss2ActionType, VANILLA_PHASE_LABEL,
  createSs2TeamRules, ss2Combatant, ss2InventorySlotHolding, ss2TeamRules
} from "../src/team/ss2-rules.js";
import {
  buildArenaLayout, CommandKind, LabelProvenance, presentResolvedEvents, SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import { timelineFor } from "../src/render/timeline.js";
import { allUnmappedLabels, clipLabelsFor } from "../src/render/clip-labels.js";

const GALE = Ss2ActionType.CAST_GALE;

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

/**
 * A 1v1 with the caster on RED, opening, facing right.
 *
 * Facing is derived from position at construction (red stands left of blue,
 * so it faces right whatever `gladiator_dir` says), and moving `x` afterwards
 * does not re-derive it — so the two positions below keep red facing right and
 * blue facing left, which is what every test using this helper relies on.
 */
function staged({ hero = {}, foe = {}, heroX = -60, foeX = 60, controller = "local", rules = ss2TeamRules } = {}) {
  const battle = createTeamBattle({
    seed: 3,
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
  Object.assign(combatantById(battle, "hero"), { x: heroX, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: foeX, y: 200 });
  assert.equal(currentCombatant(battle).id, "hero", "the caster must open for these tests to mean anything");
  return battle;
}

const galeTargets = (battle, id = "hero") =>
  legalActions(battle, id).filter((option) => option.type === GALE).map((option) => option.targetId);

/** Cast, and hand back the gale's own event off the battle log. */
function cast(battle, actorId = "hero", targetId = "foe") {
  applyAction(battle, { actorId, type: GALE, targetId });
  const event = battle.events.at(-1);
  assert.equal(event.type, GALE, "the gale's own event is the last one logged");
  return event;
}

/* ------------------------------------------------------------------ *
 * The vocabulary                                                      *
 * ------------------------------------------------------------------ */

test("the token is `cast-gale` and it round-trips to the build's own `cast_gale`", () => {
  assert.equal(GALE, "cast-gale");
  assert.equal(VANILLA_PHASE_LABEL[GALE], "cast_gale");
  assert.ok(createSs2TeamRules().actionTypes.includes(GALE));
});

test("the gale's constants are the build's literals", () => {
  // `cast_spell_icon(attacker, 38)` at `+0x7b0a`, the item row `inventory38`
  // at `root/frame:35` `+0x4f42`, and `check_inventory(38)` at ladder arm 24
  // (`+0x0e2e`) all name 38.
  assert.equal(SS2_GALE.itemId, 38);
  // `Push "force", 1000` at `+0x7b5d` and `Push "force", -1000` at `+0x7b6d`.
  assert.equal(SS2_GALE.force, 1000);
  // `attacker.gotoAndPlay("Cast1")` at `+0x7b30`; `defender.gotoAndPlay("knockback")`
  // at `+0x7b78`.
  assert.equal(SS2_GALE.casterClip, "Cast1");
  assert.equal(SS2_GALE.victimClip, "knockback");
});

/* ------------------------------------------------------------------ *
 * The offer                                                           *
 * ------------------------------------------------------------------ */

test("a gladiator carrying no inventory is offered no gale", () => {
  assert.deepEqual(galeTargets(staged()), []);
});

test("carrying id 38 offers a gale per foe, from any declared slot", () => {
  assert.deepEqual(galeTargets(staged({ hero: { inventory1: 38 } })), ["foe"]);
  assert.deepEqual(galeTargets(staged({ hero: { inventory6: 38 } })), ["foe"]);
});

test("a slot holding the EMPTY marker 1, or 0, offers no gale", () => {
  assert.deepEqual(galeTargets(staged({ hero: { inventory1: SS2_INVENTORY_EMPTY } })), []);
  // 0 is a real row in the authored item table, not the code's empty marker —
  // and it is not 38 either.
  assert.deepEqual(galeTargets(staged({ hero: { inventory1: 0 } })), []);
});

test("an UNDECLARED slot is not searched, so a combatant that never states one is offered nothing", () => {
  const battle = staged({ hero: { inventory2: 38 } });
  const hero = combatantById(battle, "hero");
  assert.equal(Object.hasOwn(hero.resources, "inventory1"), false);
  assert.equal(ss2InventorySlotHolding(hero, SS2_GALE.itemId), "inventory2");
  assert.deepEqual(galeTargets(battle), ["foe"]);
});

test("the gale is offered at ANY distance, because neither the button nor the phase reads one", () => {
  // The five-condition gate is the villain's DECISION; the hero's click
  // handler tests only `inv_struck`, and `+0x7aaa`-`+0x7be5` contains no
  // `fightdistance` read. So the offer is possession alone.
  assert.deepEqual(galeTargets(staged({ hero: { inventory1: 38 }, foeX: 1900 })), ["foe"]);
  assert.deepEqual(galeTargets(staged({ hero: { inventory1: 38 }, foeX: 0 })), ["foe"]);
});

test("the offer does NOT read the caster's armour, which is the villain's gate and not the button's", () => {
  // An unarmoured caster (0 < 0 / 2 is false) would never pass the villain's
  // fifth condition; the hero's button does not ask.
  const battle = staged({ hero: { inventory1: 38 } });
  assert.equal(combatantById(battle, "hero").resources.armourclass.value, 0);
  assert.deepEqual(galeTargets(battle), ["foe"]);
});

test("a forced rest still outranks the gale", () => {
  const battle = staged({ hero: { inventory1: 38 } });
  combatantById(battle, "hero").resources.staminaleft.value = 0;
  assert.deepEqual(legalActions(battle, "hero").map((option) => option.type), [Ss2ActionType.REST]);
});

/* ------------------------------------------------------------------ *
 * The phase                                                           *
 * ------------------------------------------------------------------ */

test("a gale takes ZERO samples: the rng cursor does not move", () => {
  // Zero `randomBetween`, zero `RandomNumber`, zero `checkattackroll` over
  // `+0x7aaa`-`+0x7be5`, and `knockback`'s 155 bytes contain no comparison at
  // all. A sample here would put every peer replaying the tape out of step.
  const battle = staged({ hero: { inventory1: 38 } });
  const before = battle.rng.cursor;
  cast(battle);
  assert.equal(battle.rng.cursor, before);
});

test("the cost is round(magicka), the STAT, with regeneration on top", () => {
  const battle = staged({ hero: { inventory1: 38, magicka: 12 } });
  const before = combatantById(battle, "hero").resources.staminaleft.value;
  const event = cast(battle);
  assert.equal(event.staminaSpent, 12);
  assert.equal(combatantById(battle, "hero").resources.staminaleft.value - before, event.staminaGained);
});

test("there is NO affordability check: a caster at 1 stamina still casts and floors at 0", () => {
  const battle = staged({ hero: { inventory1: 38, magicka: 30 } });
  combatantById(battle, "hero").resources.staminaleft.value = 11;
  assert.deepEqual(galeTargets(battle), ["foe"]);
  cast(battle);
  assert.ok(combatantById(battle, "hero").resources.staminaleft.value >= 0);
});

test("casting CONSUMES the slot by setting it to 1, and the offer goes with it", () => {
  const battle = staged({ hero: { inventory3: 38 } });
  const event = cast(battle);
  assert.equal(event.consumedSlot, "inventory3");
  assert.equal(combatantById(battle, "hero").resources.inventory3.value, SS2_INVENTORY_EMPTY);
  assert.deepEqual(galeTargets(battle), []);
});

test("a caster facing RIGHT pushes the target +1000, and deals no damage", () => {
  const battle = staged({ hero: { inventory1: 38 } });
  const foeBefore = combatantById(battle, "foe");
  const healthBefore = foeBefore.health;
  const armourBefore = foeBefore.resources.armourclass.value;
  assert.equal((combatantById(battle, "hero").status ?? []).includes(SS2_FACING_LEFT), false);

  const event = cast(battle);
  assert.equal(event.force, 1000);
  assert.equal(event.targetFrom, 60);
  assert.equal(event.targetTo, 1060);
  const foe = combatantById(battle, "foe");
  assert.equal(foe.x, 1060);
  assert.equal(foe.health, healthBefore, "a gale deals no damage");
  assert.equal(foe.resources.armourclass.value, armourBefore);
  // The caster does not move.
  assert.equal(combatantById(battle, "hero").x, -60);
});

test("a caster facing LEFT pushes the target -1000 — the sign is the CASTER's facing", () => {
  // `gladiator_dir == "right"` -> +1000, anything else -> -1000 (`+0x7b45`-`+0x7b6d`).
  // Staged with the caster on BLUE, which stands right of red and so faces
  // left from construction, and made fastest so it opens.
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields(), { id: "victim", name: "victim", controller: "local" })] },
      {
        id: "blue",
        name: "blue",
        combatants: [ss2Combatant(fields({ speed: 21, inventory1: 38 }), { id: "caster", name: "caster", controller: "local" })]
      }
    ]
  });
  assert.equal(currentCombatant(battle).id, "caster");
  assert.ok((combatantById(battle, "caster").status ?? []).includes(SS2_FACING_LEFT));
  const from = combatantById(battle, "victim").x;
  const event = cast(battle, "caster", "victim");
  assert.equal(event.force, -1000);
  assert.equal(combatantById(battle, "victim").x, from - 1000);
});

test("the push is CLAMPED at the arena wall, and a target already there does not move", () => {
  const pushed = staged({ hero: { inventory1: 38 }, foeX: 1500 });
  const event = cast(pushed);
  assert.equal(event.targetTo, SS2_ARENA.clamp.max);
  assert.equal(combatantById(pushed, "foe").x, SS2_ARENA.clamp.max);

  const pinned = staged({ hero: { inventory1: 38 }, foeX: SS2_ARENA.clamp.max });
  const still = cast(pinned);
  assert.equal(still.force, 1000, "the force is reported whatever the wall swallows");
  assert.equal(still.targetTo, SS2_ARENA.clamp.max);
  assert.equal(combatantById(pinned, "foe").x, SS2_ARENA.clamp.max);
  // And the clip still plays: the knockback animation is unconditional.
  assert.equal(still.victimClip, "knockback");
});

test("facing is recomputed AFTER the target moves", () => {
  // Blown past a second red gladiator, the foe's nearest enemy is now on its
  // RIGHT, so it must lose `facing-left`. Without the recomputation it keeps a
  // facing its new position stopped justifying.
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [
          ss2Combatant(fields({ speed: 21, inventory1: 38 }), { id: "hero", name: "hero", controller: "local" }),
          ss2Combatant(fields(), { id: "ally", name: "ally", controller: "local" })
        ]
      },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields(), { id: "foe", name: "foe", controller: "local" })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
  Object.assign(combatantById(battle, "ally"), { x: 1500, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: 60, y: 200 });
  assert.equal(currentCombatant(battle).id, "hero");
  assert.ok(combatantById(battle, "foe").status.includes(SS2_FACING_LEFT), "staged facing left");

  cast(battle);
  assert.equal(combatantById(battle, "foe").x, 1060);
  assert.equal(combatantById(battle, "foe").status.includes(SS2_FACING_LEFT), false,
    "the foe now faces the ally at 1500, on its right");
});

test("the event names both clips — Cast1 on the caster, knockback on the victim", () => {
  const event = cast(staged({ hero: { inventory1: 38 } }));
  assert.equal(event.casterClip, "Cast1");
  assert.equal(event.victimClip, "knockback");
  assert.equal(event.vanillaLabel, "cast_gale");
  assert.equal(event.spellId, 38);
});

test("a gale the caster does not carry is refused TWICE, and the second refusal names it", () => {
  const battle = staged();
  assert.throws(() => applyAction(battle, { actorId: "hero", type: GALE, targetId: "foe" }), /Illegal action/);
  const hero = combatantById(battle, "hero");
  const foe = combatantById(battle, "foe");
  assert.throws(
    () => ss2TeamRules.resolveAction({
      type: GALE, turnNumber: battle.turnNumber, actor: hero, target: foe, targetId: foe.id,
      allies: [hero], foes: [foe]
    }, { randomBetween: () => 1, randomNumber: () => 0 }),
    /no declared inventory slot holds item 38/
  );
});

/* ------------------------------------------------------------------ *
 * The presentation                                                    *
 * ------------------------------------------------------------------ */

test("a presented gale plays Cast1 on the caster and knockback on the victim, both MAP_NAMED", () => {
  const battle = staged({ hero: { inventory1: 38 } });
  cast(battle);
  const wire = toTeamWireState(battle);
  const { commands } = presentResolvedEvents(wire, {
    layout: buildArenaLayout(wire),
    bindings: SS2_STATIC_MAP_BINDINGS
  });
  const clips = commands.filter((command) => command.kind === CommandKind.CLIP_GOTO);
  assert.deepEqual(
    clips.map(({ combatantId, role, label, labelProvenance }) => ({ combatantId, role, label, labelProvenance })),
    [
      { combatantId: "hero", role: "actor", label: "Cast1", labelProvenance: LabelProvenance.MAP_NAMED },
      { combatantId: "foe", role: "target", label: "knockback", labelProvenance: LabelProvenance.MAP_NAMED }
    ]
  );
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), []);
  // ► **AND THE CASTER IS NOT MOVED.** `movementFor` reads an event's `from` /
  //   `to` as the ACTOR's own move. The shove and the taunt put their TARGET's
  //   displacement there, and a presented shove sends the SHOVER to the
  //   victim's coordinates (measured 2026-09-22). The gale names its fields
  //   `targetFrom` / `targetTo` so it cannot inherit that.
  assert.deepEqual(
    commands.filter((command) => command.kind === CommandKind.MOVE_CLIP && command.combatantId === "hero"),
    []
  );
});

test("Cast1 resolves to a family that can DRAW it, and plays for the rounded build length", () => {
  const caster = timelineFor("Cast1", { role: "actor" });
  assert.equal(caster.recognised, true, "Cast1 must not fall to the `unknown` schedule");
  assert.equal(caster.family, "cast");
  assert.ok(clipLabelsFor(caster.family).includes("cast1"));
  // Measured with the clip-sequence census on the oracle: `Cast1` is frames
  // 2103-2125 and ends in a `stop` inside its own span, so it runs on into
  // nothing. 23 frames at 30 fps = 766.7 ms = 6.39 beats of 120 ms; the
  // nearest beat is 6 = 720 ms — the same six the shared `cast` schedule
  // already runs for `Cast2`'s 21 frames. No per-label override is needed.
  assert.equal(caster.durationMs, 720);

  const victim = timelineFor("knockback", { role: "target" });
  assert.equal(victim.recognised, true);
  assert.ok(clipLabelsFor(victim.family).includes("knockback"));
});

test("cast1 is PLAYED now, so it leaves the declared-unplayed list", () => {
  assert.equal(new Set(allUnmappedLabels()).has("cast1"), false);
  // `Cast2` keeps first place in the family, so a caller with no label of its
  // own still gets the bolts' clip, exactly as before `cast1` joined.
  assert.equal(clipLabelsFor("cast")[0], "cast2");
});

/* ------------------------------------------------------------------ *
 * The AI                                                              *
 *                                                                     *
 * The build's rule, as far as this engine can hold it: arm 24 of      *
 * `villain_cast_spells` casts when id 38 is carried, the pair's       *
 * `fightdistance < 400`, and the caster's own                         *
 * `armourclass < armourclass_max / 2` — after 23 arms that did not    *
 * fire, and after one 90% roll this AI does not take.                 *
 * ------------------------------------------------------------------ */

/** Armour 136 of 136 at construction; `armour` rewrites the current value. */
function galeCaster({ armour = 60, foeX = 120, extra = {}, foe = {} } = {}) {
  const battle = staged({
    controller: "ai",
    hero: { inventory1: 38, helmet: 4, breastplate: 6, ...extra },
    foe,
    heroX: 0,
    foeX
  });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.resources.armourclass_max.value, 136, "staged with 136 armour at most");
  hero.resources.armourclass.value = armour;
  return battle;
}

/** The same gladiator with no id 38 — the control every gate test compares against. */
function withoutGale(battle) {
  const hero = combatantById(battle, "hero");
  hero.resources.inventory1.value = SS2_INVENTORY_EMPTY;
  return suggestAction(battle, "hero").type;
}

test("an AI caster with its armour below half and a foe inside 400 casts the gale", () => {
  assert.equal(suggestAction(galeCaster(), "hero").type, GALE);
});

test("the gale OVERRIDES a swing in reach, as `villain_cast_spells` overrides the decision", () => {
  // `villainChooseAction` ends by calling `villain_cast_spells()`, which
  // replaces `villaindecisionA` (map `:2606`, `:2735`). At 120 a swing is on
  // offer, and the control without 38 takes it.
  const battle = galeCaster({ foeX: 120 });
  assert.equal(suggestAction(battle, "hero").type, GALE);
  assert.equal(withoutGale(battle), Ss2ActionType.QUICK_ATTACK);
});

test("the gale is cast from BEYOND melee reach, anywhere inside 400", () => {
  const battle = galeCaster({ foeX: 399 });
  assert.equal(suggestAction(battle, "hero").type, GALE);
  assert.equal(withoutGale(battle), Ss2ActionType.WALK_RIGHT);
});

test("at fightdistance 400 the gate is SHUT (strict `<`), and the AI does what it would without 38", () => {
  const battle = galeCaster({ foeX: 400 });
  const shut = suggestAction(battle, "hero").type;
  assert.notEqual(shut, GALE);
  assert.equal(shut, withoutGale(battle));
});

test("with armour at EXACTLY half the gate is shut (strict `<`)", () => {
  const battle = galeCaster({ armour: 68 });
  const shut = suggestAction(battle, "hero").type;
  assert.notEqual(shut, GALE);
  assert.equal(shut, withoutGale(battle));
  assert.equal(suggestAction(galeCaster({ armour: 67 }), "hero").type, GALE);
});

test("an UNARMOURED caster never casts the gale, because 0 < 0 / 2 is false", () => {
  const battle = staged({ controller: "ai", hero: { inventory1: 38 }, heroX: 0, foeX: 120 });
  assert.equal(combatantById(battle, "hero").resources.armourclass_max.value, 0);
  assert.notEqual(suggestAction(battle, "hero").type, GALE);
});

test("a caster offered a BOLT prefers the bolt, because arms 15 and 17 precede arm 24", () => {
  // Both bolts fire on possession alone, so a villain carrying one never
  // reaches the gale arm.
  const battle = galeCaster({ extra: { inventory2: 34 } });
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_LIGHTNING_BOLT);
});

test("carrying a bolt shuts the gale even when the bolt itself loses the pricing", () => {
  // This engine PRICES its bolts where the build casts them on possession, so
  // a heavy hitter keeps its bolt and swings. The gale must still not be
  // reachable: in the build the bolt arm would have fired first.
  const battle = galeCaster({ extra: { inventory2: 34, strength: 60, attack: 60, weapon: 24 } });
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.POWER_ATTACK);
});

test("the AI gales the NEAREST foe, which is the one the distance gate is about", () => {
  // Above 1v1 the build has no answer (one `defender`); this is the choice
  // made here, and it is named as invented at the site.
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(
          fields({ speed: 21, inventory1: 38, helmet: 4, breastplate: 6 }),
          { id: "hero", name: "hero", controller: "ai" }
        )]
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
  Object.assign(combatantById(battle, "far"), { x: 350, y: 200 });
  Object.assign(combatantById(battle, "near"), { x: 200, y: 200 });
  combatantById(battle, "hero").resources.armourclass.value = 10;
  assert.equal(currentCombatant(battle).id, "hero");
  const chosen = suggestAction(battle, "hero");
  assert.equal(chosen.type, GALE);
  assert.equal(chosen.targetId, "near");
});

test("the AI takes no sample to decide, so the build's 90% roll is not reproduced", () => {
  // The build rolls `randomBetween(1, 100) > 10` once at the top of
  // `villain_cast_spells` (`+0x056f`); this AI draws nothing, so it casts on
  // every turn the three conditions hold rather than on nine in ten.
  const battle = galeCaster();
  const before = battle.rng.cursor;
  suggestAction(battle, "hero");
  assert.equal(battle.rng.cursor, before);
});
