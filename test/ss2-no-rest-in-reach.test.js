/**
 * No rest while a foe is in reach — the owner's decision, 2026-09-24 (grill
 * Q7), matching the build.
 *
 * ## WHAT THE BUILD WIRES
 *
 * The battle map's button table (§"Buttons wired per controller frame"):
 *
 * - `closerange_warrior` (overlay frame 13) and `closerange_archer` (frame 28)
 *   wire NO `rest` in either facing — "`rest` is never wired by either
 *   close-range controller";
 * - `longrange_warrior` (frame 5) and `longrange_archer` (frame 20) share ONE
 *   slot between `taunt` and `rest`, split on `staminaleft / staminamax * 100
 *   >= 50` (frame 5 `+0x0c0a`/`+0x10a2`, frame 20 `+0x0c15`/`+0x110a`);
 * - and the forced chain on overlay frame 1 rests a gladiator at `staminaleft
 *   <= 0` (`+0x0d2e`) before any button exists, on every frame.
 *
 * ## WHAT THIS ENGINE DOES
 *
 * `legalActions` withholds `rest` on the close frame (`onCloseFrame`, the
 * predicate the walks, the taunt and the shove already read). The forced rest
 * is untouched. **The long-range half of the slot rule is reproduced for the
 * TAUNT only**: at or above half stamina the build shows the taunt alone and
 * this engine still offers `rest` beside it — pinned below as the widening that
 * remains, so that closing it is a decision and not an accident.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, suggestAction } from "../src/team/index.js";
import { Ss2ActionType, createSs2TeamRules, ss2Combatant, ss2Reach, ss2TeamRules } from "../src/team/ss2-rules.js";

// `staminamax = 100 + stamina * 10` = 160; strength 9 with weapon 1 reaches 130.
const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, ...o
});
const BOW = Object.freeze({ secondary_weapon: 61, equipped_weapon: 2 });

/** A 1v1, the hero on RED and opening, at `heroX`; the foe at `foeX`, in `foeY`'s rank. */
function staged({ hero = {}, heroX = 0, foeX = 120, foeY = 200, staminaleft, rules = ss2TeamRules } = {}) {
  const battle = createTeamBattle({
    seed: 3,
    rules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller: "ai" })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: foeX > heroX ? "left" : "right" }), { id: "foe", name: "foe", controller: "ai" })] }
    ]
  });
  if (rules === ss2TeamRules) {
    Object.assign(combatantById(battle, "hero"), { x: heroX, y: 200 });
    Object.assign(combatantById(battle, "foe"), { x: foeX, y: foeY });
  }
  assert.equal(currentCombatant(battle).id, "hero");
  if (staminaleft !== undefined) combatantById(battle, "hero").resources.staminaleft.value = staminaleft;
  return battle;
}
const typesOf = (battle) => legalActions(battle, "hero").map((option) => option.type);
const REST = { type: Ss2ActionType.REST, targetId: "hero" };

test("the staging reaches what it says: 130, so a foe at 120 is in reach and one at 1000 is not", () => {
  assert.equal(ss2Reach(combatantById(staged(), "hero")), 130);
  assert.ok(typesOf(staged()).includes(Ss2ActionType.QUICK_ATTACK));
  assert.ok(!typesOf(staged({ foeX: 1000 })).includes(Ss2ActionType.QUICK_ATTACK));
});

/* ------------------------------------------------------------------ *
 * The close frames offer no rest                                      *
 * ------------------------------------------------------------------ */

test("closerange_warrior offers NO rest, in either facing, at any stamina above zero", () => {
  for (const foeX of [120, -120]) {
    for (const staminaleft of [1, 10, 80, 160]) {
      const types = typesOf(staged({ foeX, staminaleft }));
      assert.ok(types.includes(Ss2ActionType.QUICK_ATTACK), `foe at ${foeX}: the close frame`);
      assert.ok(!types.includes(Ss2ActionType.REST), `foe at ${foeX}, staminaleft ${staminaleft}: no rest in reach`);
    }
  }
});

test("closerange_archer offers NO rest either, in either facing — a drawn bow closed on", () => {
  for (const foeX of [100, -100]) {
    for (const staminaleft of [1, 80, 160]) {
      const types = typesOf(staged({ hero: BOW, foeX, staminaleft }));
      assert.ok(types.includes(Ss2ActionType.BASH_ATTACK), `foe at ${foeX}: the close archer frame`);
      assert.ok(!types.includes(Ss2ActionType.REST), `foe at ${foeX}, staminaleft ${staminaleft}: no rest closed on`);
    }
  }
});

test("a foe at reach distance in ANOTHER rank is not in reach, so the rest stays", () => {
  // The lane rule decides "in reach" (`ss2SameLane`), and the rest reads the
  // same frame the melee verbs were offered on.
  const types = typesOf(staged({ foeX: 20, foeY: 103 }));
  assert.ok(!types.includes(Ss2ActionType.QUICK_ATTACK), "no swing across ranks");
  assert.ok(types.includes(Ss2ActionType.REST), "and so the long frame's rest");
});

/* ------------------------------------------------------------------ *
 * The long frames: the build's shared taunt/rest slot                 *
 * ------------------------------------------------------------------ */

test("longrange_warrior: below half the slot is REST and no taunt; at and above half the TAUNT", () => {
  // 79 of 160 is below 50%; 80 is exactly half, where the build's `>=` shows the taunt.
  const below = typesOf(staged({ foeX: 1000, staminaleft: 79 }));
  assert.ok(below.includes(Ss2ActionType.REST));
  assert.ok(!below.includes(Ss2ActionType.TAUNT));
  for (const staminaleft of [80, 160]) {
    const above = typesOf(staged({ foeX: 1000, staminaleft }));
    assert.ok(above.includes(Ss2ActionType.TAUNT), `staminaleft ${staminaleft}: the taunt`);
    // ► **THE HALF NOT TAKEN, PINNED.** The build's slot shows the taunt ALONE
    //   here; this engine still offers the rest beside it. Undecided — see the
    //   header; this assertion moves the day it is.
    assert.ok(above.includes(Ss2ActionType.REST), `staminaleft ${staminaleft}: the rest is still offered`);
  }
});

test("longrange_archer: the same slot, below half REST and no taunt, at and above half the TAUNT", () => {
  const below = typesOf(staged({ hero: BOW, foeX: 1000, staminaleft: 79 }));
  assert.ok(below.includes(Ss2ActionType.BOMBARD), "the long archer frame");
  assert.ok(below.includes(Ss2ActionType.REST));
  assert.ok(!below.includes(Ss2ActionType.TAUNT));
  const above = typesOf(staged({ hero: BOW, foeX: 1000, staminaleft: 80 }));
  assert.ok(above.includes(Ss2ActionType.TAUNT));
  assert.ok(above.includes(Ss2ActionType.REST), "the half not taken, as on the warrior frame");
});

/* ------------------------------------------------------------------ *
 * The forced rest at zero is everyone's, in reach or out              *
 * ------------------------------------------------------------------ */

test("at ZERO stamina the forced rest is the only action IN REACH, warrior and archer alike", () => {
  for (const [label, battle] of [
    ["closerange_warrior", staged({ staminaleft: 0 })],
    ["closerange_archer", staged({ hero: BOW, foeX: 100, staminaleft: 0 })],
    ["longrange_warrior", staged({ foeX: 1000, staminaleft: 0 })]
  ]) {
    assert.deepEqual(legalActions(battle, "hero"), [REST], label);
    assert.deepEqual(suggestAction(battle, "hero"), REST, `${label}: and the AI takes it`);
  }
});

test("the forced rest RESOLVES in reach, and pays what a rest pays", () => {
  const battle = staged({ staminaleft: 0 });
  const hero = combatantById(battle, "hero");
  hero.health = 50;
  applyAction(battle, { actorId: "hero", ...REST });
  // `0 - round(6 * 15)` spent (a gain) + the branch's `+ 6` + `nextphase`'s
  // `1 + round(6 / 3)`: 90 + 6 + 3 = 99. Healed `3 + ceil(6)` + `1 + ceil(6 / 2)` = 13.
  assert.equal(hero.resources.staminaleft.value, 99);
  assert.equal(hero.health, 63);
  assert.equal(battle.lastResolution.events[0].type, Ss2ActionType.REST);
});

test("a voluntary rest in reach is REFUSED by the resolver, not merely left unchosen", () => {
  const battle = staged({ staminaleft: 10 });
  assert.throws(() => applyAction(battle, { actorId: "hero", ...REST }), /Illegal action/);
});

/* ------------------------------------------------------------------ *
 * What it does not reach                                              *
 * ------------------------------------------------------------------ */

test("a POSITION-BLIND gladiator keeps the rest — the vocabulary `fixtureReplay` and the goldens use", () => {
  const blind = staged({ rules: createSs2TeamRules({ fixtureReplay: true }) });
  assert.equal(combatantById(blind, "hero").x, null, "fixtureReplay places nobody");
  const types = typesOf(blind);
  assert.ok(types.includes(Ss2ActionType.QUICK_ATTACK), "every melee verb, as always");
  assert.deepEqual(legalActions(blind, "hero").at(-1), REST, "and the rest, last, as always");
});
