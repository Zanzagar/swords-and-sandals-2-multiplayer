/**
 * `inventory_maxslots` — THE HERO PANEL'S SLOT WINDOW, declared 2026-09-22.
 *
 * `sprite:492[inventory_overlay]/frame:1/DoAction@0x50e4f`, re-read from the
 * main session's dump of the licensed build (`77cb545c…`):
 *
 * ```text
 *   +0x0216 Push "i", 1; SetVariable                     i = 1
 *   +0x0221 i; Push 6; Greater; Not; Not; If -> exit     while !(i > 6)
 *   +0x0237 i; _root.game.hero
 *   +0x024f Push "inventory_maxslots"; GetMember
 *   +0x0255 Greater; Not; If -> skip                     if (i > maxslots)
 *   +0x025c this["inventory_button" + i]
 *   +0x026c Push "_visible", false; SetMember              button._visible = false
 *   +0x0274 i++ ; +0x027e Jump -> +0x0221
 * ```
 *
 * So a slot at 1-based position `i` survives exactly when `!(i > maxslots)`.
 * Three consequences, each pinned below:
 *
 * - **UNDEFINED FAILS OPEN.** The header says `FWS v11`, and from SWF 7 on
 *   AVM1 converts `undefined` to `NaN` in a comparison, so `i > undefined` is
 *   false for every `i` and nothing is hidden. A combatant that never declares
 *   the field keeps all six slots here too.
 * - **THE COMPARISON IS `Greater`, NOT AN INTEGER TEST.** `0` hides all six;
 *   `2.5` keeps 1 and 2 and hides 3.
 * - **THERE IS NO DEFAULT, AND THIS ENGINE DOES NOT DERIVE ONE.**
 *   `initcharacter` reads it from `characterDNA[40]` (`+0x098e`) and then
 *   overwrites it by `herolevel` (2/3/4/5/6 at >= 6/15/20/30/40, `+0x0aa5`-
 *   `+0x0b39`); `randomise_gladiator` has its own chain with a `< 6 -> 1` arm
 *   (`+0x336f`-`+0x34a5`). Neither runs in battle, so the value is a property
 *   of the RECORD, and a record that does not state it is not given one.
 *
 * **What the build does NOT gate on it: the villain.** `use_item`
 * (`sprite:862[overlay]/frame:52/DoAction@0x23e7cf` `+0x0390`-`+0x03ac`) loops
 * a hard `!(i > 6)` and never reads the field; a sweep of the whole build finds
 * 21 references to the name and none in `use_item`. This engine's offer is
 * side-blind, so it gates EVERY combatant that declares the field — narrower
 * than the build's villain, and said so at the site.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, suggestAction
} from "../src/team/index.js";
import {
  SS2_INVENTORY_EMPTY, SS2_INVENTORY_SLOTS, SS2_RESOURCE_DEFAULTS, SS2_RESOURCE_NAMES,
  Ss2ActionType, ss2Combatant, ss2InventorySlotHolding, ss2TeamRules
} from "../src/team/ss2-rules.js";
import { VANILLA_FIELD_GROUPS, citationFor } from "../src/adapter/vanilla-fields.js";

const MAXSLOTS = "inventory_maxslots";
const LIGHTNING = Ss2ActionType.CAST_LIGHTNING_BOLT;
const FRIGHTNING = Ss2ActionType.CAST_FRIGHTNING_BOLT;

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});

// Same staging as `test/ss2-bolt.test.js`: one point of speed hands the hero
// the opening turn, and the bolt reads no agility anywhere.
function staged({ hero = {}, foe = {}, controller = "local" } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller })]
      },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller })
        ]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: -60, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: 60, y: 200 });
  assert.equal(currentCombatant(battle).id, "hero", "the caster must open for these tests to mean anything");
  return battle;
}

const offered = (battle, type = LIGHTNING) =>
  legalActions(battle, "hero").some((option) => option.type === type);

/** A lightning bolt in exactly one slot, at 1-based `position`. */
const boltIn = (position, extra = {}) => ({ [SS2_INVENTORY_SLOTS[position - 1]]: 34, ...extra });

const POSITIONS = [1, 2, 3, 4, 5, 6];

/* ------------------------------------------------------------------ *
 * The declaration                                                     *
 * ------------------------------------------------------------------ */

test("inventory_maxslots is a declared resource with NO default, and the catalogue cites it", () => {
  assert.ok(SS2_RESOURCE_NAMES.includes(MAXSLOTS), "it must be declarable, or no record can carry it");
  // The `psyche_up` shape: a default would be filled into every golden and
  // move all 23 replay hashes.
  assert.equal(Object.hasOwn(SS2_RESOURCE_DEFAULTS, MAXSLOTS), false);

  assert.ok(VANILLA_FIELD_GROUPS.inventory.fields.includes(MAXSLOTS));
  assert.equal(citationFor(MAXSLOTS), VANILLA_FIELD_GROUPS.inventory.citation);
  // The map's observed-fields row lists only `inventory1`-`inventory6`, so the
  // group has to say where this one's evidence actually is.
  assert.match(VANILLA_FIELD_GROUPS.inventory.notes ?? "", /inventory_maxslots/);
  assert.match(VANILLA_FIELD_GROUPS.inventory.notes ?? "", /0x024f/);
});

test("a combatant whose record never states it does not declare it — even where the build's chain would", () => {
  // `herolevel` 10 is where `initcharacter` would write 2 and 40 where it
  // would write 6. Deriving it here would put a value on every combatant in
  // the corpus and move every hash; it is declared only when a record says so.
  for (const herolevel of [1, 5, 10, 40]) {
    const built = ss2Combatant(fields({ herolevel }), { id: "hero" });
    assert.equal(Object.hasOwn(built.resources, MAXSLOTS), false, `herolevel ${herolevel}: not derived`);
  }
  const battle = staged();
  assert.equal(Object.hasOwn(combatantById(battle, "hero").resources, MAXSLOTS), false);

  // Stated, it is carried — on both builder paths.
  const derived = staged({ hero: { inventory_maxslots: 2 } });
  assert.equal(combatantById(derived, "hero").resources[MAXSLOTS].value, 2);
  const kept = ss2Combatant(
    { staminaleft: 160, staminamax: 160, hitpoints: 170, hitpointsmax: 170, magicka: 7, inventory_maxslots: 3 },
    { id: "hero", derive: false }
  );
  assert.equal(kept.resources[MAXSLOTS], 3);
});

/* ------------------------------------------------------------------ *
 * The window                                                          *
 * ------------------------------------------------------------------ */

test("UNDECLARED, all six slots are offered: the build's gate fails open on undefined", () => {
  for (const position of POSITIONS) {
    const battle = staged({ hero: boltIn(position) });
    assert.equal(offered(battle), true, `slot ${position}`);
    assert.equal(ss2InventorySlotHolding(combatantById(battle, "hero"), 34), SS2_INVENTORY_SLOTS[position - 1]);
  }
});

test("maxslots 2 keeps slots 1 and 2 and hides 3, 4, 5 and 6", () => {
  for (const position of POSITIONS) {
    const battle = staged({ hero: boltIn(position, { inventory_maxslots: 2 }) });
    const inside = position <= 2;
    assert.equal(offered(battle), inside, `slot ${position} at maxslots 2`);
    assert.equal(
      ss2InventorySlotHolding(combatantById(battle, "hero"), 34),
      inside ? SS2_INVENTORY_SLOTS[position - 1] : null,
      `slot ${position} at maxslots 2`
    );
  }
});

test("maxslots 0 offers nothing, and a non-integer is compared the way Greater compares it", () => {
  for (const position of POSITIONS) {
    assert.equal(offered(staged({ hero: boltIn(position, { inventory_maxslots: 0 }) })), false,
      `slot ${position} at maxslots 0: 1 > 0 already hides the first button`);
    // `!(i > 2.5)` keeps 1 and 2 and hides 3. Rounding would keep 3 or drop 2.
    assert.equal(offered(staged({ hero: boltIn(position, { inventory_maxslots: 2.5 }) })), position <= 2,
      `slot ${position} at maxslots 2.5`);
    // At and above 6 the window is the whole panel; the loop never goes past 6.
    assert.equal(offered(staged({ hero: boltIn(position, { inventory_maxslots: 6 }) })), true);
    assert.equal(offered(staged({ hero: boltIn(position, { inventory_maxslots: 9 }) })), true);
  }
});

test("a bolt in slot 3 at maxslots 2 is not offered — to the player or to the AI", () => {
  const battle = staged({ hero: { inventory3: 34, inventory_maxslots: 2 } });
  assert.equal(offered(battle, LIGHTNING), false);
  assert.equal(offered(battle, FRIGHTNING), false);

  // The AI chooses among the offer, so it must not cast what it was not
  // offered. The control at maxslots 3 proves this staging CAN see a cast.
  const hidden = staged({ hero: { inventory3: 35, inventory_maxslots: 2 }, controller: "ai" });
  assert.notEqual(suggestAction(hidden, "hero").type, FRIGHTNING);
  const shown = staged({ hero: { inventory3: 35, inventory_maxslots: 3 }, controller: "ai" });
  assert.equal(suggestAction(shown, "hero").type, FRIGHTNING);
});

test("the window is per SLOT, not per spell: the same gladiator keeps the bolt inside it", () => {
  const battle = staged({ hero: { inventory1: 34, inventory3: 35, inventory_maxslots: 2 } });
  assert.equal(offered(battle, LIGHTNING), true);
  assert.equal(offered(battle, FRIGHTNING), false);
});

/* ------------------------------------------------------------------ *
 * The resolve                                                         *
 * ------------------------------------------------------------------ */

const directCast = (battle, type = LIGHTNING) => {
  const hero = combatantById(battle, "hero");
  const foe = combatantById(battle, "foe");
  return ss2TeamRules.resolveAction({
    type,
    turnNumber: battle.turnNumber,
    actor: hero,
    target: foe,
    targetId: foe.id,
    allies: [hero],
    foes: [foe]
  }, { randomBetween: () => 150, randomNumber: () => 0 });
};

test("resolveAction applies the same window: a direct call cannot consume a slot the offer refused", () => {
  const battle = staged({ hero: { inventory3: 34, inventory_maxslots: 2 } });
  assert.throws(
    () => applyAction(battle, { actorId: "hero", type: LIGHTNING, targetId: "foe" }),
    /Illegal action/
  );
  // Behind the resolver's gate, the rule set's own — and it says WHY, because
  // "no slot holds item 34" would be false: slot 3 does.
  assert.throws(() => directCast(battle), /inventory3.*inventory_maxslots 2/);
  assert.equal(combatantById(battle, "hero").resources.inventory3.value, 34, "nothing consumed");
});

test("a cast inside the window consumes the first matching slot, and the one left outside stays unreachable", () => {
  const battle = staged({
    hero: { inventory1: 34, inventory3: 34, inventory_maxslots: 2 },
    foe: { vitality: 40, herolevel: 40 }
  });
  applyAction(battle, { actorId: "hero", type: LIGHTNING, targetId: "foe" });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.resources.inventory1.value, SS2_INVENTORY_EMPTY, "the first slot is the one consumed");
  assert.equal(hero.resources.inventory3.value, 34, "the other bolt is still carried");
  // …and cannot be used: it is outside the window, as the build's button is.
  assert.equal(ss2InventorySlotHolding(hero, 34), null);
  assert.equal(ss2InventorySlotHolding(hero, 34, { ignoreMaxslots: true }), "inventory3");
});

test("inside the window the gated and ungated searches always agree, so gating the resolve moves no legal cast", () => {
  // Exhaustive over every placement of id 34 across the six slots and every
  // window the tests above use. `check_inventory`'s order is ascending first
  // match, so if ANY slot inside the window holds the item, the FIRST slot
  // holding it is inside the window too. The gate therefore changes the
  // resolve only where the offer already refused.
  const windows = [undefined, 0, 1, 2, 2.5, 3, 4, 5, 6];
  let compared = 0;
  for (let mask = 1; mask < 64; mask += 1) {
    const hero = {};
    POSITIONS.forEach((position, index) => {
      hero[SS2_INVENTORY_SLOTS[index]] = (mask >> index) & 1 ? 34 : SS2_INVENTORY_EMPTY;
    });
    for (const window of windows) {
      const battle = staged({ hero: window === undefined ? hero : { ...hero, inventory_maxslots: window } });
      const actor = combatantById(battle, "hero");
      const gated = ss2InventorySlotHolding(actor, 34);
      const ungated = ss2InventorySlotHolding(actor, 34, { ignoreMaxslots: true });
      const first = POSITIONS.find((position) => (mask >> (position - 1)) & 1
        && (window === undefined || !(position > window)));
      assert.equal(gated, first === undefined ? null : SS2_INVENTORY_SLOTS[first - 1], `mask ${mask} window ${window}`);
      assert.equal(offered(battle), gated !== null, `mask ${mask} window ${window}: offer and search agree`);
      if (gated !== null) {
        assert.equal(gated, ungated, `mask ${mask} window ${window}: a legal cast consumes the same slot`);
        compared += 1;
      }
    }
  }
  assert.ok(compared > 300, `the property must actually be exercised; compared ${compared}`);
});

test("ignoreMaxslots is check_inventory's own search, and the empty marker still never matches", () => {
  const battle = staged({ hero: { inventory3: 34, inventory4: SS2_INVENTORY_EMPTY, inventory_maxslots: 2 } });
  const hero = combatantById(battle, "hero");
  assert.equal(ss2InventorySlotHolding(hero, 34, { ignoreMaxslots: true }), "inventory3");
  assert.equal(ss2InventorySlotHolding(hero, SS2_INVENTORY_EMPTY, { ignoreMaxslots: true }), null);
  assert.equal(ss2InventorySlotHolding(hero, SS2_INVENTORY_EMPTY), null);
});

test("the window gates GALE too, because both spells find their slot through the same search", () => {
  // `cast_gale` and this window were built in parallel, in two worktrees, and
  // merged on 2026-09-22. Neither implementer could test the other's change,
  // and the property that makes the merge safe is structural: gale's offer and
  // resolve both call `ss2InventorySlotHolding`, where the window lives. This
  // pins it, so a later refactor that gives gale its own slot search cannot
  // quietly drop the window for one spell and keep it for the other.
  const galeIn = (position, extra = {}) => ({ [SS2_INVENTORY_SLOTS[position - 1]]: 38, ...extra });
  assert.equal(offered(staged({ hero: galeIn(3) }), Ss2ActionType.CAST_GALE), true, "undeclared: slot 3 is reachable");
  assert.equal(offered(staged({ hero: galeIn(3, { [MAXSLOTS]: 2 }) }), Ss2ActionType.CAST_GALE), false,
    "maxslots 2: the button for slot 3 is hidden, so gale is not offered");
  assert.equal(offered(staged({ hero: galeIn(2, { [MAXSLOTS]: 2 }) }), Ss2ActionType.CAST_GALE), true,
    "and slot 2 is inside the window");
});
