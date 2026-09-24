/**
 * `aiTaunts` — the AI that taunts at range instead of trudging toward the fight.
 *
 * ## WHY THIS FILE EXISTS, and the reason published on 2026-09-18 was the
 * ## smaller half of it
 *
 * That handoff ranked "teach the AI to play the game it is in" first and
 * diagnosed the taunt like this: *"`taunt` is absent from the preference table
 * ENTIRELY, and cannot simply be added to it: the table ranks expected damage,
 * and a taunt's value is the knockback plus the flee it can cause."* True, and
 * it reaches about a quarter of the problem.
 *
 * **Measured here before anything was built**, 25 seeded 3v3 bouts through
 * `createVanillaBattleHost` + `demoSide` — the arena's own path:
 *
 * ```text
 *   decisions ............................... 2,064
 *   taunt legal on .......................... 914
 *     ... with an attack ALSO legal ......... 250   (27.4%)
 *     ... with NO attack legal .............. 664   (72.6%)
 *   taunts taken ............................ 0
 * ```
 *
 * **On 72.6% of its own offers the taunt was never ranked at all.**
 * `chooseAiAction` returns a walk from the `!attackOnOffer` branch, which sits
 * ABOVE the preference table and returns before any valuation exists. Adding a
 * row to the table — the published fix — would have reached 250 of 914
 * opportunities and reported the verb as fixed.
 *
 * The cause is the build's own: `taunt` is wired on `longrange_warrior` and
 * `longrange_archer` and on NEITHER close-range warrior frame. **It is a
 * LONG-RANGE verb**, the build's answer to "I cannot reach him yet", and the
 * only other answer this AI had was "take a step".
 *
 * ## WHAT IS THE BUILD'S AND WHAT IS THIS ENGINE'S
 *
 * - **The build's**: the taunt's chance (`(attacker.charisma + 9) /
 *   (defender.charisma + 9)`, `+0x052b`); that a landed taunt splits evenly
 *   over `randomBetween(1, 2)`; that effect 1 sets `direction = 20` and calls
 *   `checkattackroll` AGAIN at the same chance; that effect 2 splits on the
 *   DEFENDER'S weapon mode (`+0x69a7`) into a shove or a flee; that the
 *   recovery is paid BEFORE the roll (`+0x684c`, `+0x6894`, clamped `+0x68d3`);
 *   and which controller frames wire the button at all.
 * - **THIS ENGINE'S, and invented**: the whole valuation. That a hitpoint kept
 *   is worth a hitpoint taken, that a forced flee is worth one turn of the
 *   target's `max_damage`, that a shove is worth nothing, and that a gladiator
 *   walks unless a taunt beats the swing it is walking toward.
 *   `chooseAiAction`'s own provenance note already says the AI's choice among
 *   the melee verbs is invented; this is more of the same and is labelled the
 *   same way.
 *
 * ## AND THE HEAD-TO-HEAD THE HANDOFF PUBLISHED DOES NOT SURVIVE ITS OWN
 * ## CONTROL — which is why this file pins the policy and not a win rate
 *
 * The 2026-09-18 handoff reported *"taunt whenever legal, otherwise the shipped
 * AI, wins 257 of 400 3v3 bouts against it, ~4σ"*. Re-derived here: **257 of
 * 400 is exactly the arm in which the taunting policy is given to BLUE.** Give
 * the same policy to RED and it LOSES, 189-208. The AI-vs-AI control the claim
 * never had is 200-200 over the same 400 seeds, and alternating the sides gives
 * 226 of 399 (56.6%, 2.65σ). **The spread between the two arms (47.6% against
 * 64.3%) is four times the effect.**
 *
 * So no test here asserts that taunting wins a bout. What the policy is worth
 * is measured in the handoff and re-measurable from
 * `tools/engagement-census.mjs`; what is PINNED is that the decision responds
 * to the numbers it claims to read.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, suggestAction
} from "../src/team/index.js";
import {
  SS2_ARENA, SS2_TAUNT, Ss2ActionType, createSs2TeamRules, ss2ApproachValue, ss2Combatant,
  ss2TauntValue, ss2TeamRules
} from "../src/team/ss2-rules.js";

/**
 * A gladiator's STAT FIELDS — everything derived from them, because charisma is
 * the only stat a taunt reads and every assertion below is about how the
 * decision moves with it. `ss2BattleValues` computes the damage pair and the
 * pools, exactly as `staged` in `test/ss2-ranged.test.js` lets it.
 */
const gladiator = (overrides = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 0, charisma: 6, herolevel: 5, character_level: 5, weapon: 1,
  ...overrides
});

/**
 * A battle with explicit positions on both sides, so every distance here is one
 * the test wrote rather than one a layout produced. The same shape
 * `test/ss2-ranged.test.js` uses, and for the same reason.
 */
function staged({ red, blue, seed = 3, aiTaunts = true } = {}) {
  const place = (prefix, list) => ({
    id: prefix,
    name: prefix,
    combatants: list.map((entry, index) =>
      ss2Combatant(entry.fields, {
        id: entry.id ?? `${prefix}-${index + 1}`,
        name: entry.id ?? `${prefix}-${index + 1}`,
        controller: "local"
      })
    )
  });
  const battle = createTeamBattle({
    seed,
    rules: createSs2TeamRules({ aiTaunts, rankStride: SS2_ARENA.rankStride }),
    teams: [place("red", red), place("blue", blue)]
  });
  for (const [prefix, list] of [["red", red], ["blue", blue]]) {
    list.forEach((entry, index) => {
      const one = combatantById(battle, entry.id ?? `${prefix}-${index + 1}`);
      if (entry.x !== undefined) one.x = entry.x;
      if (entry.y !== undefined) one.y = entry.y;
      if (entry.health !== undefined) one.health = entry.health;
    });
  }
  return battle;
}

/** The common staging: one gladiator a side, out of reach, same rank. */
function duel({ aiTaunts = true, seed = 3, hero = {}, villain = {}, heroHealth, heroX = -250, villainX = 250 } = {}) {
  return staged({
    seed, aiTaunts,
    red: [{ id: "hero", fields: gladiator(hero), x: heroX, y: 200, health: heroHealth }],
    blue: [{ id: "villain", fields: gladiator({ gladiator_dir: "left", ...villain }), x: villainX, y: 200 }]
  });
}

/** What the AI picks for whoever's turn it is, without applying it. */
const picks = (battle) => suggestAction(battle)?.type ?? null;

const combatant = (battle, id) => combatantById(battle, id);

/* ------------------------------------------------------------------ *
 * THE VALUATION ITSELF
 * ------------------------------------------------------------------ */

test("a taunt is priced in HITPOINTS, and the recovery is the term that is certain", () => {
  const battle = duel();
  const actor = combatant(battle, "hero");
  const target = combatant(battle, "villain");

  // At full health the recovery is worth nothing — it is capped at the missing
  // health, exactly as `tauntRecovery` caps it — so the whole value is the
  // strike arm.
  const healthy = ss2TauntValue(actor, target, { taunt: 40 });
  // A wounded one gets the full `3 + ceil(stamina)`.
  const wounded = ss2TauntValue({ ...actor, health: 10 }, target, { taunt: 40 });

  assert.ok(wounded > healthy, "a wounded gladiator values a taunt more than a healthy one");
  assert.equal(
    wounded - healthy,
    SS2_TAUNT.branchHealBase + Math.ceil(actor.stats.stamina),
    "and the difference is exactly the branch's own heal, not a scaled version of it"
  );
});

test("THE STRIKE ARM IS DISCOUNTED TWICE, because the build rolls the chance twice", () => {
  // ► **THE ASSERTION THAT CAUGHT A REAL DEFECT IN THE FIRST VERSION.** Effect
  //   1 does not deal damage; it sets `direction = 20` and calls
  //   `checkattackroll()`, and `directionProfile`'s direction-20 arm hands that
  //   dispatcher `chance: chances.taunt` — the same chance the taunt has
  //   already passed. A single discount overstated the arm by 2.5x at 40%.
  //
  //   Quadratic in the chance is the signature: doubling the chance must
  //   QUADRUPLE the strike term, not double it.
  const battle = duel();
  // Full health, so the recovery is zero and the strike arm is the whole value.
  const actor = combatant(battle, "hero");
  const target = combatant(battle, "villain");

  const at20 = ss2TauntValue(actor, target, { taunt: 20 });
  const at40 = ss2TauntValue(actor, target, { taunt: 40 });
  assert.ok(at20 > 0, "a healthy gladiator still values the strike arm");
  assert.ok(
    Math.abs(at40 / at20 - 4) < 1e-9,
    `doubling the chance must quadruple the strike term; got ${at40 / at20}x`
  );
});

test("a SHOVE is worth nothing and a FLEE is worth a turn, which is not a matter of degree", () => {
  // ► **THE FIRST VERSION PRICED THEM THE SAME** and made an archer taunt a foe
  //   it could shoot. Caught by `test/ss2-ranged.test.js`'s snipe/bombard
  //   crossover pin — a test written about something else entirely.
  //
  //   `equipped_weapon: 2` is the bow-mode flag `ss2InBowMode` reads, and
  //   `+0x69a7` is what splits effect 2 on it: a melee defender is shoved, a
  //   bow-mode one is made to flee.
  const battle = duel();
  const actor = combatant(battle, "hero");
  const melee = combatant(battle, "villain");
  const archer = { ...melee, resources: { ...melee.resources, equipped_weapon: { value: 2 } } };

  const vsMelee = ss2TauntValue(actor, melee, { taunt: 40 });
  const vsArcher = ss2TauntValue(actor, archer, { taunt: 40 });
  assert.ok(vsArcher > vsMelee, "a taunt at an archer is worth more, because it can force a flee");

  // And the difference is one turn of the target's own damage, halved for the
  // one outcome in two that reaches effect 2 and scaled by the landing chance.
  const expected = (40 / 100 / SS2_TAUNT.effectMax) * melee.resources.max_damage.value;
  assert.ok(
    Math.abs((vsArcher - vsMelee) - expected) < 1e-9,
    `the flee term must be the turn proxy, once; got ${vsArcher - vsMelee} against ${expected}`
  );
});

test("A FOE IN ANOTHER RANK IS WORTH NOTHING TO TAUNT, because he cannot be taunted", () => {
  // ► **THE OWNER'S RULE, 2026-09-23: a taunt may name only a foe in the
  //   taunter's own rank, at any distance.** `legalActions` enforces it, and
  //   every AI arm matches its taunt to an offer by target — but this function
  //   is exported and prices whatever it is handed, so it answers for itself:
  //   an action that cannot be taken is worth nothing, including the recovery
  //   that would otherwise be certain.
  const battle = duel({ heroHealth: 8 });
  const actor = combatant(battle, "hero");
  const sameRank = combatant(battle, "villain");
  const otherRank = { ...sameRank, y: sameRank.y - SS2_ARENA.rankStride };

  assert.ok(ss2TauntValue(actor, sameRank, { taunt: 40 }) > 0, "the rig must price a legal taunt above zero");
  assert.equal(ss2TauntValue(actor, otherRank, { taunt: 40 }), 0);

  // And with no ranks modelled there is one lane, so nothing changes.
  const flatActor = { ...actor, y: null };
  assert.equal(
    ss2TauntValue(flatActor, { ...sameRank, y: null }, { taunt: 40 }),
    ss2TauntValue(actor, sameRank, { taunt: 40 })
  );
});

test("the approach is worth the swing UNDISCOUNTED, and the discounted version is why", () => {
  // ► **A REGRESSION PIN ON A DESIGN DECISION, not on arithmetic.** The first
  //   version returned `best / (walks + 1)`. Measured: the taunt went to 81.6%
  //   of its offers and bouts ran 84% longer, because a gladiator one step from
  //   reach scores the approach at half a swing, takes a taunt that beats half
  //   a swing, and then takes it again forever — never arriving at the swing it
  //   was amortising against.
  //
  //   If anybody reintroduces a distance discount, this goes red.
  const battle = duel();
  const actor = combatant(battle, "hero");
  const target = combatant(battle, "villain");
  assert.equal(ss2ApproachValue(actor, target, 9.6), 9.6, "no discount for distance");

  const far = { ...actor, x: -2000 };
  assert.equal(
    ss2ApproachValue(far, target, 9.6),
    ss2ApproachValue(actor, target, 9.6),
    "and none at four times the separation either"
  );
});

/* ------------------------------------------------------------------ *
 * WHAT THE AI ACTUALLY DOES WITH IT
 * ------------------------------------------------------------------ */

test("A HEALTHY GLADIATOR CLOSES AND A WOUNDED ONE TAUNTS, at the same distance", () => {
  // The whole design in one assertion: the recovery is the largest term, so the
  // decision turns on health and not on a tuned threshold.
  //
  // ► **CHARISMA 16 IS NOT A MAGIC NUMBER, IT IS THE FRONTIER — and the same
  //   one the demo roster's duellist sits on.** Swept over strength 2-9 against
  //   charisma 6-24, the decision moves monotonically in both and the health
  //   flip happens exactly at the boundary:
  //
  //   ```text
  //     strength 9  charisma 12   full walk   wounded walk
  //     strength 9  charisma 16   full walk   wounded TAUNT   <- here
  //     strength 9  charisma 20   full TAUNT  wounded TAUNT
  //   ```
  //
  //   Below the frontier the swing always wins and above it the taunt always
  //   does; this test stands on the line where health is what decides.
  const healthy = duel({ hero: { charisma: 16 } });
  assert.match(picks(healthy), /^walk-/, "at full health the swing it is walking toward wins");

  const hurt = duel({ hero: { charisma: 16 }, heroHealth: 8 });
  assert.equal(picks(hurt), Ss2ActionType.TAUNT, "wounded, the recovery beats it");
});

test("AND A DULL GLADIATOR STILL CLOSES, because charisma is what a taunt reads", () => {
  const dull = duel({ heroHealth: 8, hero: { charisma: 0 }, villain: { charisma: 20 } });
  assert.match(picks(dull), /^walk-/, "no charisma, no taunt worth taking");
});

test("A WOUNDED WARRIOR IN REACH STILL SWINGS, which is the band ranking's guarantee", () => {
  // ► **THE ASSERTION THAT COULD HAVE VARIED, and the one the 2026-09-18 sweep
  //   of 560 stat combinations exists to protect.** The band ranking picks all
  //   three melee verbs whenever the stats make one of them best; nothing in
  //   this work may move that. A taunt in melee reach must lose to the swing.
  const battle = duel({ heroX: -60, villainX: 60, heroHealth: 8 });
  const legal = legalActions(battle).map((option) => option.type);
  assert.ok(legal.includes(Ss2ActionType.QUICK_ATTACK), "the staging must put a swing on offer");
  assert.notEqual(picks(battle), Ss2ActionType.TAUNT, "a wounded gladiator in reach still swings");
});

test("AND THE TABLE ARM IS REACHED TOO — an archer taunts an archer rather than shooting it", () => {
  // ► **THE OTHER 27.4%, AND THE ONLY ARM THE PUBLISHED DIAGNOSIS WOULD HAVE
  //   FIXED.** A taunt and an attack are on offer together only for a gladiator
  //   in BOW MODE: `closerange_archer` (frame 28) wires the taunt with no
  //   stamina test at all, while `closerange_warrior` (frame 13) wires none in
  //   either facing. So this is the archer's decision and nobody else's.
  //
  //   **The pair below differs in exactly one field** — the TARGET's
  //   `equipped_weapon` — which is the discriminator `+0x69a7` splits effect 2
  //   on. A bow-mode target can be made to FLEE and loses a whole turn; a melee
  //   one is only shoved, which `ss2TauntValue` scores at zero. Same actor,
  //   same range, same charisma, opposite decisions: the flee term is doing all
  //   of the work and nothing else is.
  const archerDuel = (targetHoldsBow) => staged({
    red: [{
      id: "hero", x: -150, y: 200, health: 8,
      fields: gladiator({ secondary_weapon: 61, equipped_weapon: 2 })
    }],
    blue: [{
      id: "villain", x: 150, y: 200,
      fields: gladiator({
        gladiator_dir: "left", secondary_weapon: 61,
        ...(targetHoldsBow ? { equipped_weapon: 2 } : {})
      })
    }]
  });

  const legal = legalActions(archerDuel(true), "hero").map((option) => option.type);
  assert.ok(legal.includes(Ss2ActionType.TAUNT), "the staging must offer a taunt");
  assert.ok(
    legal.some((type) => type === Ss2ActionType.BOMBARD || type === Ss2ActionType.SNIPE),
    "and a shot, or this exercises the range arm instead of the table"
  );

  assert.equal(
    suggestAction(archerDuel(true), "hero").type,
    Ss2ActionType.TAUNT,
    "against an archer the forced flee beats the shot"
  );
  assert.equal(
    suggestAction(archerDuel(false), "hero").type,
    Ss2ActionType.BOMBARD,
    "against a swordsman the same taunt is only a shove, and the shot wins"
  );
});

/* ------------------------------------------------------------------ *
 * THE FLAG, AND THE ID THAT CARRIES IT
 * ------------------------------------------------------------------ */

test("`aiTaunts: false` restores the old policy exactly, and SAYS SO IN THE ID", () => {
  const hurt = duel({ aiTaunts: false, heroHealth: 8 });
  assert.match(picks(hurt), /^walk-/, "with the flag off, a wounded gladiator walks as it always did");

  assert.equal(createSs2TeamRules({ aiTaunts: false }).id, "ss2-map-derived-tournament-no-taunt");
  // ► **AND THE SHIPPED ID IS UNCHANGED, which is the property every pinned
  //   hash depends on.** The suffix names what differs from the SHIPPED
  //   DEFAULT — the opposite spelling from `aiCharges`, because this one ships
  //   ON. If that inverts, every literal `combatStateHash` pin in the suite
  //   moves at once and this line is the first to say why.
  assert.equal(ss2TeamRules.id, "ss2-map-derived-tournament");
  assert.equal(createSs2TeamRules().id, "ss2-map-derived-tournament");
});

test("the two policies differ ONLY where a taunt was on offer", () => {
  // A whole bout, decision by decision. Anything else that moved would be this
  // change reaching somewhere it has no business being.
  for (const seed of [1, 2, 3, 4, 5]) {
    const on = duel({ aiTaunts: true, seed, hero: { charisma: 16 }, heroHealth: 20 });
    const off = duel({ aiTaunts: false, seed, hero: { charisma: 16 }, heroHealth: 20 });
    for (let turn = 0; turn < 40; turn += 1) {
      const who = currentCombatant(on);
      if (!who || !currentCombatant(off)) break;
      const legal = legalActions(on).map((option) => option.type);
      const a = suggestAction(on);
      const b = suggestAction(off);
      if (!a || !b) break;
      if (a.type !== b.type) {
        assert.ok(
          legal.includes(Ss2ActionType.TAUNT),
          `seed ${seed} turn ${turn}: the policies diverged to ${a.type}/${b.type} with no taunt on offer`
        );
        break;
      }
      applyAction(on, { actorId: who.id, ...a });
      applyAction(off, { actorId: who.id, ...b });
    }
  }
});

/* ------------------------------------------------------------------ *
 * THE DEFECT CLASS THIS PROJECT HAS ALREADY PAID FOR ONCE
 * ------------------------------------------------------------------ */

test("THE TAUNT IS AIMED AT THE FOE IT WAS PRICED AGAINST, not at whichever is first", () => {
  // ► **`psycheOption` HAD EXACTLY THIS DEFECT** and a Codex review of
  //   `1775a4c` found it: `legalActions` emits one option per foe, so a `find`
  //   by type alone takes whichever foe happens to be first in the list, and
  //   the AI prices a taunt at one gladiator while aiming it at another.
  //
  //   Staged so the two foes are distinguishable and the nearest is NOT first
  //   in the list: `far` is emitted first because `legalActions` walks
  //   `view.foes` in construction order.
  const battle = staged({
    red: [{ id: "hero", fields: gladiator({ charisma: 20 }), x: 0, y: 200, health: 8 }],
    blue: [
      { id: "far", fields: gladiator({ gladiator_dir: "left" }), x: 1400, y: 200 },
      { id: "near", fields: gladiator({ gladiator_dir: "left" }), x: 400, y: 200 }
    ]
  });
  // Asked of the HERO by name: with equal speeds the turn may belong to either
  // side, and a blue gladiator's own walk is not what this test is about.
  const chosen = suggestAction(battle, "hero");
  assert.equal(chosen.type, Ss2ActionType.TAUNT, "the staging must produce a taunt at all");
  assert.equal(chosen.targetId, "near", "and it must name the foe the approach arm was measuring");
});

test("AND IT NEVER TAUNTS INTO ANOTHER RANK, which it did whenever that foe was nearest", () => {
  // ► **THE OWNER'S RULE, 2026-09-23**: a taunt names only a foe in the
  //   taunter's own rank, at any distance. The staging above with ONE change —
  //   `near` a rank back — and before the rule the AI taunted him from there,
  //   because the out-of-range arm prices the taunt against the NEAREST foe by
  //   Euclidean distance and the offer named every foe. `far`, in the hero's
  //   own rank, is still on offer; ~~the arm does not retarget to him, because
  //   it prices a taunt against the swing it is walking toward and that swing
  //   is `near`'s.~~ **Stale the day it was written: the same commit sent the
  //   walk toward `far` (the foe in its own rank), so the swing it walks toward
  //   IS `far`'s, and since 2026-09-23 the arm prices — and here takes — the
  //   taunt at `far`. See the next test.**
  const battle = staged({
    red: [{ id: "hero", fields: gladiator({ charisma: 20 }), x: 0, y: 200, health: 8 }],
    blue: [
      { id: "far", fields: gladiator({ gladiator_dir: "left" }), x: 1400, y: 200 },
      { id: "near", fields: gladiator({ gladiator_dir: "left" }), x: 400, y: 200 - SS2_ARENA.rankStride }
    ]
  });
  const chosen = suggestAction(battle, "hero");
  assert.ok(chosen, "the AI must choose something");
  assert.equal(chosen.type === Ss2ActionType.TAUNT && chosen.targetId === "near", false,
    `a taunt across ranks is not the AI's to take; it chose ${JSON.stringify(chosen)}`);
});

test("THE TAUNT IS PRICED AT THE FOE IN ITS OWN RANK, even when a nearer one stands a rank over", () => {
  // ► **RED BEFORE 2026-09-23's FIX, AND THE DEFECT IS THE OWN-RANK RULE'S
  //   SHADOW.** The out-of-range arm looked for a taunt offer at the NEAREST
  //   foe overall. Once the owner's rule stopped offering a taunt a rank over,
  //   a nearest foe in another rank meant no offer matched, the arm never ran,
  //   and the taunt at the man in the taunter's own rank — on offer the whole
  //   time — was never priced. On the arena's own host (`demoSide` 3v3, seeds
  //   1-25) that was 210 of the duellist's 253 taunt offers.
  //
  //   A 3v3, so the lanes are the only thing deciding who is nearest: the hero
  //   holds the front rank with `rival` far off in it; `neighbour` stands a rank
  //   back and much nearer; the third foe and both allies are in the other
  //   ranks. Wounded and charismatic, so a taunt at `rival` beats the approach —
  //   the same numbers as "THE TAUNT IS AIMED AT THE FOE IT WAS PRICED
  //   AGAINST" above, where the taunt is taken with nobody in the way.
  const FRONT = SS2_ARENA.frontY;
  const battle = staged({
    red: [
      { id: "hero", fields: gladiator({ charisma: 20 }), x: 0, y: FRONT, health: 8 },
      { id: "mate", fields: gladiator(), x: -700, y: FRONT - SS2_ARENA.rankStride },
      { id: "anchor", fields: gladiator(), x: -800, y: FRONT - 2 * SS2_ARENA.rankStride }
    ],
    blue: [
      { id: "rival", fields: gladiator({ gladiator_dir: "left" }), x: 1400, y: FRONT },
      { id: "neighbour", fields: gladiator({ gladiator_dir: "left" }), x: 300, y: FRONT - SS2_ARENA.rankStride },
      { id: "third", fields: gladiator({ gladiator_dir: "left" }), x: 1500, y: FRONT - 2 * SS2_ARENA.rankStride }
    ]
  });

  // The staging, checked rather than trusted: `neighbour` is the nearest foe by
  // the AI's own metric (Euclidean, `ss2FightDistance`), nothing is in reach,
  // and the only taunt on offer names `rival`.
  const hero = combatant(battle, "hero");
  const distance = (id) => Math.hypot(combatant(battle, id).x - hero.x, combatant(battle, id).y - hero.y);
  assert.ok(distance("neighbour") < distance("rival") && distance("neighbour") < distance("third"),
    "`neighbour` must be the nearest foe");
  const offered = legalActions(battle, "hero");
  assert.deepEqual(
    offered.filter((option) => option.type === Ss2ActionType.TAUNT).map((option) => option.targetId),
    ["rival"],
    "a taunt is offered at `rival` alone, the only foe in the hero's rank"
  );
  assert.equal(offered.some((option) => option.targetId === "neighbour" && option.type !== Ss2ActionType.TAUNT), false,
    "and nothing reaches `neighbour`, so this is the out-of-range arm");

  const chosen = suggestAction(battle, "hero");
  assert.deepEqual({ type: chosen.type, targetId: chosen.targetId }, { type: Ss2ActionType.TAUNT, targetId: "rival" },
    "the own-rank taunt is priced, beats the approach, and is taken");

  // ► **AND WITH RANKS OFF THE SAME STAGING IS THE OLD ANSWER EXACTLY** —
  //   one lane, so `neighbour` is offered a taunt, is the nearest, and is the
  //   one priced; the own-rank filter admits every foe and changes nothing.
  const flat = staged({
    red: [{ id: "hero", fields: gladiator({ charisma: 20 }), x: 0, health: 8 }],
    blue: [
      { id: "rival", fields: gladiator({ gladiator_dir: "left" }), x: 1400 },
      { id: "neighbour", fields: gladiator({ gladiator_dir: "left" }), x: 300 }
    ]
  });
  for (const id of ["hero", "rival", "neighbour"]) combatant(flat, id).y = null;
  const flatChoice = suggestAction(flat, "hero");
  assert.deepEqual({ type: flatChoice.type, targetId: flatChoice.targetId },
    { type: Ss2ActionType.TAUNT, targetId: "neighbour" });
});

test("a gladiator that declares no damage pair is SKIPPED, not thrown at", () => {
  // ► **THE SAME COURTESY THE FORCED-PHASE ARM EXTENDS**, and the reason the
  //   taunt arm is guarded by `ss2CanBePriced`: pricing needs the ATTACKER
  //   record, `vanillaRecordOf(..., "attacker")` throws without the pair, and a
  //   gladiator still walking toward the fight should not have to declare one
  //   to take a step.
  //
  //   ► **IT CANNOT BE STAGED THROUGH `ss2Combatant`, WHICH IS ITSELF WORTH
  //     KNOWING.** Every route through it declares a damage pair — a combatant
  //     with no `weapon` at all still derives one from bare hands (min 18 at
  //     strength 9). So the unpriceable gladiator is a PLAIN blueprint with no
  //     SS2 resource bag, which is exactly the combatant the forced-phase arm's
  //     own comment describes.
  //   The two rules are separate on purpose: `staminaleft`/`staminamax` are
  //   required of EVERY combatant at construction, and `min_damage`/`max_damage`
  //   only of whoever ATTACKS, at the moment the swing resolves. So the
  //   unpriceable gladiator declares the first pair and not the second, which is
  //   a combatant this rule set accepts and `vanillaRecordOf` will still refuse.
  const plain = (id, extra = {}) => ({
    id, name: id, controller: "local", maxHealth: 170,
    stats: { strength: 9, agility: 20, attack: 8, defense: 5, vitality: 6, stamina: 6, magicka: 0 },
    resources: { staminaleft: 120, staminamax: 140, charisma: 20, herolevel: 5, character_level: 5 },
    ...extra
  });
  const battle = createTeamBattle({
    seed: 3, rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [plain("hero", { health: 8 })] },
      { id: "blue", name: "blue", combatants: [plain("villain")] }
    ]
  });
  combatantById(battle, "hero").x = -250;
  combatantById(battle, "villain").x = 250;

  assert.doesNotThrow(() => suggestAction(battle, "hero"));

  // ► **AND A DECLARED-BUT-UNUSABLE PAIR CANNOT REACH THIS DOOR, WHICH IS
  //   WORTH RECORDING BECAUSE I CHANGED THE GUARD FOR IT.** `ss2CanBePriced`
  //   asks `Number.isFinite`, matching `assertDeclaredResources`, where the
  //   first version asked only whether the key was present — a guard weaker
  //   than the check it stands in front of. **The case it closes is
  //   unreachable through `createTeamBattle`**: `normaliseResourceBag` refuses
  //   a `null` entry outright ("Resource max_damage must be a finite number or
  //   a { value, min, max } object"), so a battle cannot carry one. Verified
  //   here rather than assumed.
  //
  //   The stronger guard is kept anyway — `chooseAiAction` is a rule-set entry
  //   point and takes whatever view it is handed — but it is defence in depth
  //   and this comment is what stops the next reader calling it load-bearing.
  assert.throws(
    () => createTeamBattle({
      seed: 3, rules: ss2TeamRules,
      teams: [
        {
          id: "red",
          name: "red",
          combatants: [plain("hero", {
            health: 8,
            resources: {
              staminaleft: 120, staminamax: 140, charisma: 20, herolevel: 5, character_level: 5,
              min_damage: null, max_damage: null
            }
          })]
        },
        { id: "blue", name: "blue", combatants: [plain("villain")] }
      ]
    }),
    /must be a finite number/,
    "the roster layer refuses a null resource before any rule set sees it"
  );

  assert.notEqual(
    suggestAction(battle, "hero").type,
    Ss2ActionType.TAUNT,
    "it takes the move it would have taken before"
  );
});

/* ------------------------------------------------------------------ *
 * THE DEMO ROSTER — the path somebody plays
 * ------------------------------------------------------------------ */

test("THE DEMO ROSTER CAN EXPRESS THE VERB NOW, and could not before", async () => {
  // ► **THE `aiCharges` FAILURE, NOT REPEATED.** That flag shipped correct and
  //   INERT: the demo gladiator is level 4 against a melee gate of 7, so the
  //   trait had a live population of zero on the path anybody plays. Measured
  //   the same way here before `tools/arena/roster.js` gained its duellist:
  //   **taunt offered 926 times over 25 seeded 3v3 bouts, taken 5.**
  //
  //   `charisma: 16` on slot 3 is what changed, chosen against a sweep printed
  //   at the line itself. This asserts the CAPABILITY, not the rate — a rate
  //   pinned here would go red the first time the roster is tuned, which is the
  //   owner's to do.
  //
  //   ► **AND IN 3v3 THE RATE IS BACK NEAR ZERO SINCE THE OWN-RANK RULE
  //     (2026-09-23): 3 taunts from slot 3 over 25 seeded bouts at the
  //     shipped 16, and 0-3 at every charisma from 6 to 24.** The two
  //     duellists open in the same rank, so each may taunt
  //     only the other, and at equal charisma that never beats the approach.
  //     Measured and explained at the roster's own note; the fix is the
  //     owner's, and this test still asserts only what it says.
  const { demoSide } = await import("../tools/arena/roster.js");
  const { ss2BattleValues, ss2Combatant: canonical } = await import("../src/team/ss2-rules.js");
  const side = demoSide("red", 3, { ss2Combatant: canonical, ss2BattleValues });

  const charismas = side.members.map((member) => member.vanilla.charisma);
  assert.deepEqual(charismas, [6, 6, 16], "slot 3 is the duellist and the other two are not");

  // And the one thing that must NOT have moved with it: charisma feeds the
  // taunt and nothing else, so every reach is what it was.
  const reaches = side.members.map((member) => member.vanilla.weapon_range);
  assert.deepEqual(reaches, [130, 129, 129], "charisma must not have moved anybody's reach");
});
