/**
 * `cast_lightning_bolt` / `cast_frightning_bolt` — the first SPELL verbs this
 * engine has, and the only two of the build's twenty a discrete turn can hold.
 *
 * ## WHY THESE TWO AND NOT THE OTHER EIGHTEEN
 *
 * Derived 2026-09-20 from the oracle whose sha256 is `77CB545C…`, at
 * `sprite:862[overlay]/frame:52/DoAction@0x240c7f`. Three of the build's
 * twenty spells reach `magic_damage_character`, and they are three DIFFERENT
 * shapes:
 *
 * ```text
 *   arm                          ingress   samples per cast   shape
 *   cast_lightning_bolt /        +0x85af   1                  INSTANT — damage
 *     cast_frightning_bolt                                    lands in the same
 *                                                             straight-line run
 *                                                             as the cast
 *   cast_fireball / _hell_ /     +0x91c1   1                  a `bullet` with
 *     _dire_                                                  Xvelocity 50/70/90,
 *                                                             gravity 2,
 *                                                             bulletlife 1 and an
 *                                                             onEnterFrame; damage
 *                                                             waits for the flight
 *   cast_death_from_above        +0x88e5   1 + 4N, N=10..20   N boulders, each
 *                                          (so 41-81)         with its own
 *                                                             onEnterFrame fall,
 *                                                             a FIXED 40 damage
 * ```
 *
 * ► **THE DISCRIMINATOR IS TIMING, NOT SAMPLE COUNT — and reading it as
 *   sample count was this session's own first mistake, caught by an adversarial
 *   verifier before it reached a document.** The fireball family takes exactly
 *   ONE sample per cast, same as the bolts: its three `randomBetween` sites
 *   (`+0x9012`, `+0x9062`, `+0x90b2`) are mutually exclusive arms of one
 *   three-way `||`, exactly as the bolts' two are. What separates them is that
 *   a fireball's damage is applied from a per-frame handler after a ballistic
 *   flight, and a bolt's is applied in the same run as `gotoAndPlay("Cast2")`.
 *
 * ► **AND THE FIREBALL'S FRAME TEST IS AN IDEMPOTENCE GUARD, NOT AN IMPACT
 *   TRIGGER.** `+0x9194 Not; +0x9195 Not; If` is a DOUBLED `Not`, so the gate
 *   reads `if (bullet._currentframe != 4)` — the block applies damage once and
 *   then `gotoAndStop(4)` parks the clip so every later frame skips it. Anyone
 *   who reads it as "damage fires when the bullet reaches frame 4" has the
 *   mechanism inside out and would build a fireball that damages on every frame
 *   but one.
 *
 * **Only the bolt is a turn.** The other two resolve across frames through
 * machinery this engine does not have — the fireball needs the ballistic model
 * `src/render/projectile.js` reproduces for arrows, and molten death needs a
 * per-boulder physics loop. Building either as an instant would be inventing a
 * mechanic, and the bolt is the one that needs nothing invented.
 *
 * ## THE OFFER GATE IS POSSESSION, AND NOTHING ELSE THIS ENGINE CAN SEE
 *
 * The villain's ladder (`villain_cast_spells`, `DoAction@0x23e7cf`) is 28 arms
 * in a strict else-if chain. **Twenty-one of them carry a second condition and
 * seven do not** — ids 49, 32, 35, 31, 34, 30 and 45 fire on possession alone,
 * verified instruction by instruction 2026-09-20. Both bolts are in that set.
 *
 * **The HERO's gate is a different function and a shorter one** — two
 * conditions on a button, not five on a decision: `i <= inventory_maxslots`,
 * and `inventoryI != 1` once the battle has started
 * (`sprite:492[inventory_overlay]/frame:1`). `legalActions` reproduces the
 * second and names the first as unreproduced, because `inventory_maxslots` is
 * not a declared resource here.
 *
 * ## WHAT IS INVENTED, SAID OUT LOUD
 *
 * **One thing: that the caster picks a target.** The build is 1v1 and its
 * phase reads a single bound `defender`. Above 1v1 somebody has to choose, and
 * offering one bolt at "the" enemy is the cross-lane defect this repository has
 * now recorded three times. Everything else here is the build's.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, suggestAction
} from "../src/team/index.js";
import {
  SS2_BOLT_INGRESS, SS2_BOLT_SPELLS, SS2_INVENTORY_EMPTY, SS2_INVENTORY_SLOTS,
  Ss2ActionType, createSs2TeamRules, ss2Combatant, ss2InventorySlotHolding, ss2TeamRules
} from "../src/team/ss2-rules.js";
import { SS2_DIRECT_DAMAGE_SPELLS } from "../src/golden/ss2-spell-candidate.js";

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

// The caster opens, so every `applyAction` below is on its turn.
// `ss2InitiativeOrder` gives the first action to the side holding the single
// fastest gladiator, ties broken by team id — and "blue" sorts before "red",
// so equal speeds hand the opening to the WRONG side here. One point of speed
// is the smallest thing that settles it and it changes nothing else: the bolt
// reads no agility anywhere.
function staged({ hero = {}, foe = {}, rules = ss2TeamRules, seed = 3 } = {}) {
  const battle = createTeamBattle({
    seed,
    rules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller: "local" })]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller: "local" })
        ]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: 60, y: 200 });
  assert.equal(currentCombatant(battle).id, "hero", "the caster must open for these tests to mean anything");
  return battle;
}

const typesFor = (battle, id) => legalActions(battle, id).map((option) => option.type);

/**
 * A victim that SURVIVES a bolt, which an ordinary gladiator does not.
 *
 * `hitpointsmax = herolevel * 10 + vitality * 20` (`battlevalues` `+0x378e`),
 * so the default fighter here has 170 and a lightning bolt rolls 100-200. Most
 * of these tests are about the phase and not about killing anybody, and a
 * victim that dies mid-test ends the bout and replaces the bolt's own event
 * with `battle-result-pending`. **That is not a workaround — it is the
 * measurement**, and it has its own test below.
 */
const TOUGH = Object.freeze({ vitality: 40, herolevel: 40 });

/** Cast, and hand back the bolt's own event off the battle log. */
function cast(battle, type) {
  applyAction(battle, { actorId: "hero", type, targetId: "foe" });
  const event = battle.events.at(-1);
  assert.equal(event.type, type, "the bolt's own event is the last one logged");
  return event;
}

/* ------------------------------------------------------------------ *
 * The offer                                                           *
 * ------------------------------------------------------------------ */

test("a gladiator carrying no inventory is offered no bolt", () => {
  const battle = staged();
  const types = typesFor(battle, "hero");
  assert.equal(types.includes(Ss2ActionType.CAST_LIGHTNING_BOLT), false);
  assert.equal(types.includes(Ss2ActionType.CAST_FRIGHTNING_BOLT), false);
});

test("a slot holding the EMPTY marker offers nothing, and the marker is 1 rather than 0", () => {
  // The whole reason this verb waited for the column to be read. `1` is what
  // fourteen emptiness tests compare against and what every literal write to a
  // slot writes; `0` is a real "nothing" row in the authored item table and
  // seventeen of the nineteen champion DNA literals use it. A reader who takes
  // the DATA's convention for the CODE's gets this backwards.
  assert.equal(SS2_INVENTORY_EMPTY, 1);
  const battle = staged({ hero: { inventory1: SS2_INVENTORY_EMPTY } });
  assert.equal(typesFor(battle, "hero").includes(Ss2ActionType.CAST_LIGHTNING_BOLT), false);

  // And a slot holding 0 is not empty to this engine either — it is an id the
  // item table has a row for. It offers no BOLT because 0 is not 34 or 35.
  const zeroed = staged({ hero: { inventory1: 0 } });
  assert.equal(typesFor(zeroed, "hero").includes(Ss2ActionType.CAST_LIGHTNING_BOLT), false);
});

test("carrying id 34 offers a lightning bolt, and 35 a frightning bolt, per foe", () => {
  const lightning = staged({ hero: { inventory1: 34 } });
  assert.deepEqual(
    legalActions(lightning, "hero")
      .filter((option) => option.type === Ss2ActionType.CAST_LIGHTNING_BOLT)
      .map((option) => option.targetId),
    ["foe"]
  );
  assert.equal(typesFor(lightning, "hero").includes(Ss2ActionType.CAST_FRIGHTNING_BOLT), false);

  const frightning = staged({ hero: { inventory3: 35 } });
  assert.equal(typesFor(frightning, "hero").includes(Ss2ActionType.CAST_FRIGHTNING_BOLT), true);
  assert.equal(typesFor(frightning, "hero").includes(Ss2ActionType.CAST_LIGHTNING_BOLT), false);
});

test("a bolt is offered from ANY slot, and the first matching slot is the one consumed", () => {
  // `check_inventory` scans ascending from slot 1 and stops at the first match
  // (`+0x02f8`-`+0x034f`); it does NOT stop at `inventory_maxslots`.
  const battle = staged({ hero: { inventory2: 34, inventory5: 34 } });
  assert.equal(typesFor(battle, "hero").includes(Ss2ActionType.CAST_LIGHTNING_BOLT), true);
  assert.equal(ss2InventorySlotHolding(combatantById(battle, "hero"), 34), "inventory2");
});

test("the empty marker is never itself usable as an item id", () => {
  // `use_item` refuses `which_item == 1` outright (`+0x03cc`) and
  // `check_inventory` carries the same conjunct (`+0x0334`). An id that cannot
  // be used is not an item, whatever a slot holds.
  const battle = staged({ hero: { inventory1: SS2_INVENTORY_EMPTY } });
  assert.equal(ss2InventorySlotHolding(combatantById(battle, "hero"), SS2_INVENTORY_EMPTY), null);
});

test("an UNDECLARED slot is not searched, which is not the same as an empty one", () => {
  // The six names have no `SS2_RESOURCE_DEFAULTS` entry — deliberately, because
  // a default would be filled into every golden and move all 23 replay hashes.
  // So "never mentioned an inventory" has no value to compare, and absence is
  // distinguishable from six ones.
  const battle = staged({ hero: { inventory1: 34 } });
  const hero = combatantById(battle, "hero");
  assert.equal(Object.hasOwn(hero.resources, "inventory1"), true);
  assert.equal(Object.hasOwn(hero.resources, "inventory4"), false);
  assert.equal(ss2InventorySlotHolding(hero, 34), "inventory1");
});

test("the bolt is offered out of reach, because the arm has no distance test", () => {
  // Counted over `+0x83fb`-`+0x862e`: no `fightdistance` read of any kind, and
  // `lightning_bolt_combat` is attached at the DEFENDER's own `_x` (`+0x852a`).
  // The item table calls a lightning bolt "close-ranged"; the bytes do not, and
  // the bytes are the oracle.
  const battle = staged({ hero: { inventory1: 34 } });
  Object.assign(combatantById(battle, "foe"), { x: 1900 });
  assert.equal(typesFor(battle, "hero").includes(Ss2ActionType.CAST_LIGHTNING_BOLT), true);
});

test("a forced phase still outranks the bolt, because frame 1 pre-empts the button", () => {
  // The forced chain runs before the player can act and `getphase` sets
  // `turnphase = 2`, so a gladiator at zero stamina rests whatever it carries.
  const battle = staged({ hero: { inventory1: 34, stamina: 6 } });
  // The live bag is `{value, min, max}` after normalisation, not the plain
  // numbers `ss2Combatant` hands in. Writing the number straight over the entry
  // makes `resourceValue` read `undefined` and the gate silently fails open —
  // which is how the first cut of this test passed while proving nothing.
  combatantById(battle, "hero").resources.staminaleft.value = 0;
  assert.deepEqual(typesFor(battle, "hero"), [Ss2ActionType.REST]);
});

/* ------------------------------------------------------------------ *
 * The phase                                                           *
 * ------------------------------------------------------------------ */

test("a bolt takes exactly ONE sample and it is the damage", () => {
  // Zero `checkattackroll`, zero direction draw, zero hit roll over the whole
  // arm. A bolt cannot miss, so no `attack-direction-roll` may appear.
  const battle = staged({ hero: { inventory1: 34 }, foe: TOUGH });
  const before = battle.rng.cursor;
  const event = cast(battle, Ss2ActionType.CAST_LIGHTNING_BOLT);
  assert.equal(battle.rng.cursor - before, 1, "exactly one sample leaves the ordered channel");
  assert.ok(event.rolledDamage >= 100 && event.rolledDamage <= 200,
    `lightning damage is randomBetween(100, 200); got ${event.rolledDamage}`);
});

test("a frightning bolt rolls 200-400 and a lightning bolt 100-200", () => {
  assert.equal(SS2_BOLT_SPELLS[Ss2ActionType.CAST_LIGHTNING_BOLT].damageLow, 100);
  assert.equal(SS2_BOLT_SPELLS[Ss2ActionType.CAST_LIGHTNING_BOLT].damageHigh, 200);
  assert.equal(SS2_BOLT_SPELLS[Ss2ActionType.CAST_FRIGHTNING_BOLT].damageLow, 200);
  assert.equal(SS2_BOLT_SPELLS[Ss2ActionType.CAST_FRIGHTNING_BOLT].damageHigh, 400);

  const battle = staged({ hero: { inventory1: 35 }, foe: TOUGH });
  const event = cast(battle, Ss2ActionType.CAST_FRIGHTNING_BOLT);
  assert.ok(event.rolledDamage >= 200 && event.rolledDamage <= 400);
});

test("both bolts share one damage_method and one bonus_frame, because they share one call site", () => {
  // `+0x858f` pushes `"lightning"` and `8` ONCE, before the arms converge. A
  // frightning bolt therefore plays the `lightning` hurt clip and the frame-8
  // splat exactly as a lightning bolt does — which a table with one row per
  // spell structurally cannot say, and which is why ids 31, 32 and 35 carried
  // `null` for three weeks.
  assert.equal(SS2_BOLT_INGRESS.damageMethod, "lightning");
  assert.equal(SS2_BOLT_INGRESS.bonusFrame, 8);
  assert.equal(SS2_DIRECT_DAMAGE_SPELLS[34].damageMethod, "lightning");
  assert.equal(SS2_DIRECT_DAMAGE_SPELLS[35].damageMethod, "lightning");

  const battle = staged({ hero: { inventory1: 35 }, foe: TOUGH });
  const event = cast(battle, Ss2ActionType.CAST_FRIGHTNING_BOLT);
  assert.equal(event.victimClip, "lightning");
  assert.equal(event.casterClip, "Cast2");
  assert.equal(event.bonusFrame, 8);
});

test("casting CONSUMES the slot, by setting it to 1", () => {
  // `use_item` `+0x0409`: `game.villain["inventory" + i] = 1`. The hero's own
  // six handlers write the same (`+0x0626`-`+0x0851`).
  const battle = staged({ hero: { inventory1: 34 }, foe: TOUGH });
  const event = cast(battle, Ss2ActionType.CAST_LIGHTNING_BOLT);
  assert.equal(event.consumedSlot, "inventory1");
  assert.equal(combatantById(battle, "hero").resources.inventory1.value, SS2_INVENTORY_EMPTY);
  // And the offer is gone, which is the whole point of consuming it.
  assert.equal(typesFor(battle, "hero").includes(Ss2ActionType.CAST_LIGHTNING_BOLT), false);
});

test("the cost is round(magicka), the STAT — not strength, and not a spell price", () => {
  // `game_attacker.staminacost = Math.round(game_attacker.magicka)` at
  // `+0x842f`. The item table prices a lightning bolt at 15; the phase does not
  // read that number.
  const battle = staged({ hero: { inventory1: 34, magicka: 12 }, foe: TOUGH });
  const before = combatantById(battle, "hero").resources.staminaleft.value;
  const event = cast(battle, Ss2ActionType.CAST_LIGHTNING_BOLT);
  assert.equal(event.staminaSpent, 12);
  // `nextphase`'s own regeneration still runs, so the net is cost minus gain.
  const after = combatantById(battle, "hero").resources.staminaleft.value;
  assert.equal(after - before, event.staminaGained);
});

test("there is NO affordability check: a caster at 1 stamina still casts and floors at 0", () => {
  // Measured absence, not an oversight. `staminacost` is assigned in the phase
  // and spent unconditionally by `nextphase` at `+0x32a7`; `check_stats` clamps
  // the floor. The map says an engine must not invent a gate here.
  const battle = staged({ hero: { inventory1: 34, magicka: 30, stamina: 1 }, foe: TOUGH });
  combatantById(battle, "hero").resources.staminaleft.value = 1;
  assert.equal(typesFor(battle, "hero").includes(Ss2ActionType.CAST_LIGHTNING_BOLT), true);
  cast(battle, Ss2ActionType.CAST_LIGHTNING_BOLT);
  assert.equal(combatantById(battle, "hero").resources.staminaleft.value >= 0, true);
});

test("a bolt lands on ARMOUR first, exactly as the physical path does", () => {
  const battle = staged({
    hero: { inventory1: 34 },
    foe: { ...TOUGH, helmet: 4, breastplate: 6 }
  });
  const armourBefore = combatantById(battle, "foe").resources.armourclass.value;
  assert.ok(armourBefore > 0, "the foe is staged with armour");
  const event = cast(battle, Ss2ActionType.CAST_LIGHTNING_BOLT);
  assert.equal(event.armourDamage + event.hitpointDamage > 0, true);
  assert.equal(
    event.armourDamage,
    armourBefore - combatantById(battle, "foe").resources.armourclass.value
  );
});

test("the caster's own stats cannot influence the number", () => {
  // `magic_damage_character` binds `attacker`/`game_attacker` to register 0 and
  // reads neither; its complete string set contains neither name. So the only
  // caster-dependent number in the whole phase is the stamina cost.
  const weak = staged({ hero: { inventory1: 34, strength: 1, attack: 1 }, foe: TOUGH, seed: 11 });
  const strong = staged({ hero: { inventory1: 34, strength: 30, attack: 30 }, foe: TOUGH, seed: 11 });
  const damageOf = (battle, type) => cast(battle, type).damage;
  assert.equal(
    damageOf(weak, Ss2ActionType.CAST_LIGHTNING_BOLT),
    damageOf(strong, Ss2ActionType.CAST_LIGHTNING_BOLT)
  );
});

test("a bolt ONE-SHOTS an ordinary gladiator, and that is the build's arithmetic", () => {
  // `hitpointsmax = herolevel * 10 + vitality * 20`: the default fighter here
  // is 170, and a lightning bolt rolls 100-200 while a frightning bolt rolls
  // 200-400. A frightning bolt therefore cannot fail to kill one. This is why
  // `magicka` and the inventory are as rare as they are in the build, and it is
  // worth pinning rather than staging around.
  const battle = staged({ hero: { inventory1: 35 } });
  assert.equal(combatantById(battle, "foe").maxHealth, 170);
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.CAST_FRIGHTNING_BOLT, targetId: "foe" });
  assert.equal(combatantById(battle, "foe").alive, false);
  assert.equal(battle.events.at(-1).type, "battle-result-pending");
});

test("a bolt the caster does not carry is refused TWICE, and the second refusal names it", () => {
  const battle = staged();
  // The resolver's own legality gate fires first and says only "Illegal
  // action.", which is correct and is not enough to debug from.
  assert.throws(
    () => applyAction(battle, { actorId: "hero", type: Ss2ActionType.CAST_LIGHTNING_BOLT, targetId: "foe" }),
    /Illegal action/
  );

  // So the rule set carries its own guard behind it, as `shove` does for a
  // missing target. `resolveAction` is a public method and a caller may reach
  // it without going through `applyAction`; consuming a slot that does not hold
  // the spell would be worse than any error message.
  const hero = combatantById(battle, "hero");
  const foe = combatantById(battle, "foe");
  assert.throws(
    () => ss2TeamRules.resolveAction({
      type: Ss2ActionType.CAST_LIGHTNING_BOLT,
      turnNumber: battle.turnNumber,
      actor: hero,
      target: foe,
      targetId: foe.id,
      allies: [hero],
      foes: [foe]
    }, { randomBetween: () => 150, randomNumber: () => 0 }),
    /no declared inventory slot holds item 34/
  );
});

test("an armour-absorbed bolt still interrupts the victim's charge", () => {
  // `magic_damage_character`'s `psyche_up = 1` is step 4, an unconditional
  // JOIN (`+0x148e`) — outside every branch, unlike `damagecharacter`'s reset
  // at `+0x1be4`, which sits inside the hit branch. So a bolt that armour eats
  // whole still costs the victim its charge. `defenderEffects` spoke only for
  // the physical path until 2026-09-20.
  const battle = staged({
    hero: { inventory1: 34, magicka: 3 },
    foe: {
      ...TOUGH,
      psyche_up: 3,
      helmet: 9, shoulderguard: 9, breastplate: 9, gauntlet: 9,
      greaves: 9, shinguard: 9, boot: 9, shield: 9
    }
  });
  const foe = combatantById(battle, "foe");
  assert.ok(foe.resources.psyche_up, "the victim must DECLARE the counter; there is no default");
  foe.resources.psyche_up.value = 3;
  const armour = foe.resources.armourclass.value;
  assert.ok(armour > 200, `the foe needs armour deeper than a 200-damage bolt; got ${armour}`);
  const before = foe.health;
  const event = cast(battle, Ss2ActionType.CAST_LIGHTNING_BOLT);
  assert.equal(event.hitpointDamage, 0, "the bolt is absorbed entirely");
  assert.equal(combatantById(battle, "foe").health, before);
  assert.equal(combatantById(battle, "foe").resources.psyche_up.value, 1, "the charge is cleared anyway");
});

/* ------------------------------------------------------------------ *
 * The AI                                                              *
 *                                                                     *
 * ► **EVERY TEST IN THIS BLOCK EXISTS BECAUSE THE VERB SHIPPED WITHOUT *
 *   THEM AND A CODEX ADVERSARIAL REVIEW FOUND IT (2026-09-20).** The   *
 *   bolts were legal and unreachable: `ATTACK_BANDS` deliberately does *
 *   not hold them, and `chooseAiAction`'s `attackOnOffer` predicate was *
 *   keyed on `ATTACK_BANDS` alone, so an AI caster read as having      *
 *   nothing to do. The focused tests above all passed — **none of them *
 *   asked the AI anything**, which is exactly the hole.                *
 * ------------------------------------------------------------------ */

function aiStaged({ hero = {}, foe = {}, heroX = 0, foeX = 120 } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller: "ai" })]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller: "ai" })
        ]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: heroX, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: foeX, y: 200 });
  return battle;
}

test("an AI caster in reach casts rather than swinging", () => {
  // Codex's own repro, kept verbatim: seed 3, `inventory1: 35`, a 170-HP
  // unarmoured foe whose death a 200-400 bolt guarantees. This chose
  // `quick-attack` before the fix.
  const battle = aiStaged({ hero: { inventory1: 35 } });
  assert.equal(combatantById(battle, "foe").maxHealth, 170);
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_FRIGHTNING_BOLT);
});

test("an AI caster BEYOND melee reach casts rather than walking", () => {
  // The second half of the repro, and the more damaging one: the bolt arm has
  // no `fightdistance` read, so a caster that walks is walking for nothing.
  // This chose `walk-right` before the fix.
  const battle = aiStaged({ hero: { inventory1: 35 }, foeX: 1960 });
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_FRIGHTNING_BOLT);
});

test("an AI with no bolt is unchanged, in reach and out of it", () => {
  // The control that makes the two above mean something: the wiring must not
  // move a gladiator that carries nothing. `test/seeded-play-pins.test.js`
  // covers the same invariant across whole bouts.
  assert.equal(suggestAction(aiStaged(), "hero").type, Ss2ActionType.QUICK_ATTACK);
  assert.equal(suggestAction(aiStaged({ foeX: 1960 }), "hero").type, Ss2ActionType.WALK_RIGHT);
});

test("a heavy hitter KEEPS its bolt, because the bolt is priced and not privileged", () => {
  // The bolt's expected damage is the mean of its range with no chance
  // multiplier — it cannot miss — and it joins the same table every swing is
  // ranked in. A gladiator whose `power_attack` prices above 150 should swing.
  // If this test ever fails it means the bolt stopped being ranked and started
  // being preferred.
  const battle = aiStaged({ hero: { inventory1: 34, strength: 60, attack: 60, weapon: 24 } });
  assert.ok(combatantById(battle, "hero").resources.max_damage.value > 150);
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.POWER_ATTACK);
});

test("a caster holding BOTH bolts casts the frightning one, which is the build's own order", () => {
  // Ladder arm 15 (id 35) precedes arm 17 (id 34) and both are unconditional,
  // so a villain holding both can never cast the lightning bolt.
  const battle = aiStaged({ hero: { inventory1: 34, inventory2: 35 } });
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_FRIGHTNING_BOLT);
});

test("a caster that declares NO damage pair can still cast, and is not priced", () => {
  // `magic_damage_character` binds `attacker`/`game_attacker` to register 0 and
  // reads neither, so a bolt needs no `min_damage`/`max_damage`. Ranking one
  // would build the attacker record and throw instead — the same guard the
  // forced-phase, forced-swap and walk arms carry.
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(
          { staminaleft: 160, staminamax: 160, hitpoints: 170, hitpointsmax: 170, magicka: 7, inventory1: 34 },
          { id: "hero", name: "hero", controller: "ai", derive: false }
        )]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [ss2Combatant(fields({ gladiator_dir: "left" }), { id: "foe", name: "foe", controller: "ai" })]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: 0, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: 120, y: 200 });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.resources.min_damage, undefined, "the caster must declare no damage pair");
  assert.equal(suggestAction(battle, "hero").type, Ss2ActionType.CAST_LIGHTNING_BOLT);
});

test("a CHARGED caster out of discharge range casts instead of burning the charge", () => {
  // ► **THIS IS A REGRESSION THE BOLT WIRING ITSELF CAUSED, found by the SECOND
  //   Codex adversarial review of the same diff and reproduced before anything
  //   was touched.** `chooseAiAction` ranked a ready discharge on the argument
  //   that reaching the ranking implied a foe within `ss2Reach` — true while
  //   `attackOnOffer` meant `ATTACK_BANDS` alone, and false the moment a bolt
  //   could reach it from anywhere.
  //
  //   Measured at separation 1960 with a full charge: the AI chose `psyche_up`,
  //   which resolved `outOfRange: true`, `discharged: false`, **spent 57
  //   stamina and left the counter at 3** — repeatable for ever.
  const charged = { inventory1: 34, psyche_up: 3, strength: 60, attack: 60, weapon: 24, herolevel: 10 };
  const rules = createSs2TeamRules({ aiCharges: true });

  const far = createTeamBattle({
    seed: 3,
    rules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, ...charged }), { id: "hero", name: "hero", controller: "ai" })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: "left" }), { id: "foe", name: "foe", controller: "ai" })] }
    ]
  });
  Object.assign(combatantById(far, "hero"), { x: 0, y: 200 });
  Object.assign(combatantById(far, "foe"), { x: 1960, y: 200 });
  assert.equal(suggestAction(far, "hero").type, Ss2ActionType.CAST_LIGHTNING_BOLT);

  // And the charge is still ranked when it CAN be spent, so the fix is a range
  // gate and not a demotion.
  const near = createTeamBattle({
    seed: 3,
    rules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, ...charged }), { id: "hero", name: "hero", controller: "ai" })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: "left" }), { id: "foe", name: "foe", controller: "ai" })] }
    ]
  });
  Object.assign(combatantById(near, "hero"), { x: 0, y: 200 });
  Object.assign(combatantById(near, "foe"), { x: 120, y: 200 });
  assert.equal(suggestAction(near, "hero").type, Ss2ActionType.PSYCHE_UP);
});

/* ------------------------------------------------------------------ *
 * The vocabulary                                                      *
 * ------------------------------------------------------------------ */

test("the six slot names are the build's, in its own 1-based order", () => {
  assert.deepEqual(SS2_INVENTORY_SLOTS, [
    "inventory1", "inventory2", "inventory3", "inventory4", "inventory5", "inventory6"
  ]);
});

test("the vanilla phase labels keep the build's spelling, including `frightning`", () => {
  const rules = createSs2TeamRules({ fightMode: "tournament" });
  assert.ok(rules.actionTypes.includes(Ss2ActionType.CAST_LIGHTNING_BOLT));
  assert.ok(rules.actionTypes.includes(Ss2ActionType.CAST_FRIGHTNING_BOLT));
});
