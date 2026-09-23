/**
 * WHICH WAY A GLADIATOR FACES WHEN THERE IS MORE THAN ONE FOE AND MORE THAN ONE
 * RANK — and the reach of the two spin attacks across ranks.
 *
 * ## The defect, as the owner saw it
 *
 * *"People hitting each other not in melee range"* (2026-09-23, watching a 3v3
 * in the browser arena). The engine never lets a melee swing land out of
 * reach; what the screen showed was a gladiator lunging into empty sand while
 * a foe BEHIND him took the blow. Measured at `bf53d81` on the plain `?teams=3`
 * roster, 48 seeds: 223 of 1,976 melee swings (11%) came from a fighter facing
 * AWAY from his target. Three causes, found by the `out-of-range-hits` and
 * `engine-vs-screen` investigators and split by their refuter:
 *
 * 1. **Facing looked across ranks, the swing may not.** Facing was the nearest
 *    foe by `|dx|` over EVERY rank; a swing may only target the same rank
 *    (`ss2SameLane`, the owner's rule of 2026-09-18). 190 of the 223.
 * 2. **A kill left facings stale.** Facing was re-derived only when somebody
 *    moved, so the killer went on facing the body. 26 of the 223.
 * 3. **The sandwich.** Between two foes in his own lane, the rule picks one and
 *    the chooser swings at the other. 7 of the 223.
 *
 * ## What the build says, and what it cannot
 *
 * `changeCombatants` (`+0x28f3`-`+0x2ae3`) re-derives BOTH facings from
 * `hero._x < villain._x` at every phase advance, strictly, from `_x` alone. So
 * in the build a swing is ALWAYS toward the one foe there is. Everything here
 * is the team extension of that invariant, authored
 * (`MAP_SILENCE.multi-slot-arena-geometry`), and every rule below reduces to
 * the build's at 1v1 — there is one foe, so there is one lane to prefer, no
 * tie on two sides, and nobody else to die.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, suggestAction
} from "../src/team/index.js";
import { EffectKind } from "../src/team/rule-set.js";
import {
  SS2_FACING_LEFT, SS2_PSYCHE_UP, Ss2ActionType,
  ss2Combatant, ss2FacingEffects, ss2FightDistance, ss2Reach, ss2TeamRules
} from "../src/team/ss2-rules.js";

const FRONT = 200;
const SECOND = 103;

/** Level 9, so the psyche offer's `herolevel >= 7` gate is open. */
const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 7, charisma: 6, herolevel: 9, character_level: 9, weapon: 1,
  psyche_up: SS2_PSYCHE_UP.floor, ...o
});

/** Make `id` face left (true) or right (false) — the status token is the whole of facing here. */
function face(battle, id, left) {
  const combatant = combatantById(battle, id);
  combatant.status = combatant.status.filter((token) => token !== SS2_FACING_LEFT);
  if (left) combatant.status.push(SS2_FACING_LEFT);
}

const facesLeft = (battle, id) => combatantById(battle, id).status.includes(SS2_FACING_LEFT);

/**
 * Red `hero` (who opens) and any red `allies`, against blue `foes`, at the given
 * `[x, y]`s, with every facing stated literally and then CHECKED against the
 * engine's own rule — so the staging is a state play can reach, not one the
 * next re-derivation would undo.
 */
function staged({ seed = 3, at, facingLeft, hero = {}, foe = {}, allies = [], foes }) {
  const battle = createTeamBattle({
    seed,
    rules: ss2TeamRules,
    teams: [
      {
        id: "red",
        name: "red",
        combatants: [
          ss2Combatant(fields({ speed: 21, ...hero }), { id: "hero", name: "hero", controller: "local" }),
          ...allies.map((id) => ss2Combatant(fields(), { id, name: id, controller: "local" }))
        ]
      },
      {
        id: "blue",
        name: "blue",
        combatants: foes.map((id) => ss2Combatant(fields(foe[id] ?? {}), { id, name: id, controller: "local" }))
      }
    ]
  });
  for (const [id, [x, y]] of Object.entries(at)) Object.assign(combatantById(battle, id), { x, y });
  for (const id of Object.keys(at)) face(battle, id, facingLeft.includes(id));
  const side = (ids) => ids.map((id) => combatantById(battle, id));
  assert.deepEqual(ss2FacingEffects(side(["hero", ...allies]), side(foes)), [],
    "the staged facings must be exactly what the engine derives from these positions");
  assert.equal(currentCombatant(battle).id, "hero", "the hero must open for these tests to mean anything");
  return battle;
}

/* ------------------------------------------------------------------ *
 * Cause 1: the rule prefers the lane                                   *
 * ------------------------------------------------------------------ */

test("A GLADIATOR FACES THE NEAREST FOE IN HIS OWN LANE, not a nearer one in another rank", () => {
  // r1 in the front rank. b1 is one rank back and nearer by |dx| (50 against
  // 120); b2 shares r1's rank. r1 can only ever SWING at b2, so he faces b2.
  const reds = [{ id: "r1", x: 0, y: FRONT, alive: true, status: [SS2_FACING_LEFT] }];
  const blues = [
    { id: "b1", x: -50, y: SECOND, alive: true, status: [] },
    { id: "b2", x: 120, y: FRONT, alive: true, status: [SS2_FACING_LEFT] }
  ];
  const effects = ss2FacingEffects(reds, blues);
  assert.deepEqual(effects, [{ kind: EffectKind.STATUS, targetId: "r1", status: SS2_FACING_LEFT, active: false }],
    "r1 turns right, to b2 in his own lane; b1 in the second rank shares a lane with nobody and faces r1, as he did");
});

test("A RANK CHANGE RE-FACES FROM THE RANK HE STEPPED INTO, now that the lane decides", () => {
  // hero in the second rank faces b, his lane-mate on the right. He steps into
  // the front rank, where a stands on his left: a is his lane-mate now. Before
  // the lane rule, facing read `x` alone and the rank change could re-derive
  // from the old `y` harmlessly; after it, that turned him from the rank he
  // had just left.
  const battle = staged({
    at: { hero: [0, SECOND], a: [-150, FRONT], b: [160, SECOND] },
    facingLeft: ["b"],
    foes: ["a", "b"]
  });
  assert.ok(legalActions(battle, "hero").some((option) => option.type === Ss2ActionType.RANK_FRONT),
    "rank-front must be on offer");
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.RANK_FRONT, targetId: "hero" });
  const hero = combatantById(battle, "hero");
  assert.deepEqual([hero.x, hero.y], [0, FRONT], "the premise: he stepped straight forward");
  assert.equal(facesLeft(battle, "hero"), true, "he faces a, his new lane-mate");
  assert.equal(facesLeft(battle, "a"), false, "and a faces him");
});

test("WITH NOBODY IN HIS LANE, he faces the nearest foe overall — the |dx| rule it always was", () => {
  const reds = [{ id: "r1", x: 0, y: FRONT, alive: true, status: [] }];
  const blues = [
    { id: "b1", x: -50, y: SECOND, alive: true, status: [SS2_FACING_LEFT] },
    { id: "b2", x: 120, y: 6, alive: true, status: [SS2_FACING_LEFT] }
  ];
  assert.deepEqual(ss2FacingEffects(reds, blues).map((effect) => [effect.targetId, effect.active]),
    [["r1", true], ["b1", false]],
    "r1 falls back to b1, the nearer by |dx|; b1 (lane of nobody) faces r1 on his right");
});

test("ONE AXIS (no y anywhere) is the |dx| rule unchanged, which is every 1v1, golden and pin", () => {
  const reds = [{ id: "r1", x: 0, alive: true, status: [] }];
  const blues = [
    { id: "b1", x: -50, alive: true, status: [SS2_FACING_LEFT] },
    { id: "b2", x: 120, alive: true, status: [SS2_FACING_LEFT] }
  ];
  assert.deepEqual(ss2FacingEffects(reds, blues).map((effect) => [effect.targetId, effect.active]),
    [["r1", true], ["b1", false]], "with no ranks every foe shares the lane, so the nearest by |dx| decides");
});

/* ------------------------------------------------------------------ *
 * Cause 3: the sandwich                                               *
 * ------------------------------------------------------------------ */

test("EQUALLY NEAR FOES ON BOTH SIDES STILL BREAK BY ID — a tie that KEEPS the facing was measured and rejected", () => {
  // It looked like the team form of the build's co-located tie (`Less2` and
  // `Greater` both false, the facing survives), and like the thing that would
  // make a sandwiched swinger's turn stick. Over 200 seeded 3v3 bouts per kit
  // (plain, crowd, buffs) it gave 159 backward swings against 143 with the id
  // break, which agrees with the AI's own weakest-then-id target choice.
  // Pinned so nobody "fixes" it back without re-measuring.
  for (const left of [true, false]) {
    const reds = [{ id: "r1", x: 0, y: FRONT, alive: true, status: left ? [SS2_FACING_LEFT] : [] }];
    const blues = [
      { id: "b1", x: -85, y: FRONT, alive: true, status: [] },
      { id: "b2", x: 85, y: FRONT, alive: true, status: [SS2_FACING_LEFT] }
    ];
    assert.deepEqual(
      ss2FacingEffects(reds, blues).filter((effect) => effect.targetId === "r1").map((effect) => effect.active),
      left ? [] : [true],
      `r1 facing ${left ? "left" : "right"} ends facing b1, the lower id, on his left`
    );
  }
});

const SWINGS = [
  Ss2ActionType.QUICK_ATTACK,
  Ss2ActionType.NORMAL_ATTACK,
  Ss2ActionType.POWER_ATTACK
];

test("A SWING TURNS THE SWINGER TO FACE HIS TARGET FIRST, as a 1v1 swing always faces its only foe", () => {
  // hero between a (85 to his left) and b (100 to his right), all one rank:
  // the rule faces him at a, the nearer, and he swings at b. In the build the
  // swing is always toward the defender because `changeCombatants` has just
  // faced him at the only one there is; here the turn has to be explicit.
  for (const type of SWINGS) {
    const battle = staged({
      at: { hero: [0, FRONT], a: [-85, FRONT], b: [100, FRONT] },
      facingLeft: ["hero", "b"],
      foes: ["a", "b"]
    });
    assert.ok(legalActions(battle, "hero").some((option) => option.type === type && option.targetId === "b"),
      `${type} at b must be on offer`);
    applyAction(battle, { actorId: "hero", type, targetId: "b" });
    const [first] = battle.lastResolution.effects;
    assert.deepEqual(first, { kind: EffectKind.STATUS, targetId: "hero", status: SS2_FACING_LEFT, active: false },
      `${type}: the turn is the FIRST effect, so everything the swing reads sees the hero facing b`);
  }
  // A quick attack moves nobody (directions 1-4 never knock back), so nothing
  // re-derives afterwards and the hero is left facing the man he fought.
  const battle = staged({
    at: { hero: [0, FRONT], a: [-85, FRONT], b: [100, FRONT] },
    facingLeft: ["hero", "b"],
    foes: ["a", "b"]
  });
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.QUICK_ATTACK, targetId: "b" });
  assert.equal(facesLeft(battle, "hero"), false, "he ends the swing facing b");
});

test("A SWINGER ALREADY FACING HIS TARGET DOES NOT TURN, and the effect list is what it was", () => {
  const battle = staged({
    at: { hero: [0, FRONT], a: [-85, FRONT], b: [100, FRONT] },
    facingLeft: ["hero", "b"],
    foes: ["a", "b"]
  });
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.QUICK_ATTACK, targetId: "a" });
  assert.equal(battle.lastResolution.effects.some((effect) => effect.status === SS2_FACING_LEFT), false,
    "no facing write at all");
});

test("A SHOVE AT THE MAN BEHIND YOU PUSHES HIM AWAY, not through you", () => {
  // The shove signs its force on the SHOVER's facing (`+0x5e3b`). Facing a
  // (left) while shoving b (right) drove b LEFT — into and past the shover.
  const battle = staged({
    at: { hero: [0, FRONT], a: [-85, FRONT], b: [100, FRONT] },
    facingLeft: ["hero", "b"],
    foes: ["a", "b"]
  });
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.SHOVE, targetId: "b" });
  const [event] = battle.lastResolution.events.filter((entry) => entry.type === Ss2ActionType.SHOVE);
  assert.ok(event.force > 0, `the force must point away from the shover, right; was ${event.force}`);
  assert.ok(combatantById(battle, "b").x > 100, "and b lands further right than he stood");
});

/* ------------------------------------------------------------------ *
 * Cause 2: a kill                                                     *
 * ------------------------------------------------------------------ */

test("A KILL RE-FACES EVERY SURVIVOR, as the build re-faces at every phase advance", () => {
  // hero kills a on his left; b is the only foe left, on his right. The ally c
  // also faced a. Before, nothing moved, so nothing re-derived, and both went
  // on facing the body.
  let found = false;
  for (let seed = 1; seed <= 60 && !found; seed += 1) {
    const battle = staged({
      seed,
      at: { hero: [0, FRONT], c: [50, FRONT], a: [-85, FRONT], b: [300, FRONT] },
      facingLeft: ["hero", "c", "b"],
      allies: ["c"],
      foes: ["a", "b"]
    });
    combatantById(battle, "a").health = 1;
    applyAction(battle, { actorId: "hero", type: Ss2ActionType.QUICK_ATTACK, targetId: "a" });
    if (combatantById(battle, "a").alive) continue;
    found = true;
    assert.equal(facesLeft(battle, "hero"), false, `seed ${seed}: the killer turns to b, the foe that is left`);
    assert.equal(facesLeft(battle, "c"), false, `seed ${seed}: and so does his ally`);
    assert.equal(facesLeft(battle, "b"), true, `seed ${seed}: b still faces the hero`);
    assert.equal(
      battle.lastResolution.effects.some((effect) => effect.targetId === "a" && effect.status === SS2_FACING_LEFT),
      false,
      `seed ${seed}: and nobody turns the body`
    );
  }
  assert.ok(found, "the sweep must land one killing blow");
});

test("A KILLING BLOW THAT KNOCKS BACK TURNS NO BODY, and faces nobody at one", () => {
  // The knockback's own re-facing (`facingAfterTargetMove`) was handed the
  // target as it stood before the blow — ALIVE — so a lethal knockback that
  // carried the body nearer another foe turned the body to face him (a facing
  // written onto the dead), and faced the living at the corpse until the next
  // re-derivation. Found by the `out-of-range-hits` F2 refuter, read off the
  // code, 2026-09-23. `outer` stands one lane with the pair, 660 out, so a hard
  // enough blow lands the body nearer him.
  let found = false;
  for (let seed = 1; seed <= 400 && !found; seed += 1) {
    const battle = staged({
      seed,
      at: { hero: [0, FRONT], outer: [660, FRONT], victim: [40, FRONT] },
      facingLeft: ["victim", "outer"],
      hero: { strength: 50 },
      allies: ["outer"],
      foes: ["victim"]
    });
    combatantById(battle, "victim").health = 1;
    applyAction(battle, { actorId: "hero", type: Ss2ActionType.POWER_ATTACK, targetId: "victim" });
    const [event] = battle.lastResolution.events.filter((entry) => entry.type === Ss2ActionType.POWER_ATTACK);
    const victim = combatantById(battle, "victim");
    if (!Number.isFinite(event?.knockback?.force) || victim.alive) continue;
    if (Math.abs(victim.x - 660) >= Math.abs(victim.x - 0)) continue;
    found = true;
    assert.equal(
      battle.lastResolution.effects.some((effect) => effect.targetId === "victim" && effect.status === SS2_FACING_LEFT),
      false,
      `seed ${seed}: knocked dead to ${victim.x}, nearer outer — and not turned to face him`
    );
    assert.equal(facesLeft(battle, "victim"), true, `seed ${seed}: the body keeps the facing it died with`);
  }
  assert.ok(found, "the sweep must land one lethal knockback that carries the body nearer the other foe");
});

test("NOR DOES A KILLING GHOST STRIKE turn the body its caster lands beside", () => {
  // The same passenger on the other branch that re-faces after a lethal blow:
  // the ghost strike's kill moves the CASTER beside the body (`+0x7e4c`), and
  // the caster's re-facing (`facingAfter`) counted the body as a living foe —
  // turning it round to face the man who had just landed behind it. The
  // layout is `FRONT_BUT_STRIKES_BEHIND`'s first row in
  // `test/ss2-whirlwind-ghost-strike.test.js`: the hero faces `a` and lands at
  // 0 - 86 = -86, behind `b`, who faces him.
  let found = false;
  for (let seed = 1; seed <= 60 && !found; seed += 1) {
    const battle = staged({
      seed,
      at: { hero: [300, FRONT], c: [-1500, FRONT], a: [400, FRONT], b: [0, FRONT] },
      facingLeft: ["a"],
      hero: { inventory1: 36 },
      allies: ["c"],
      foes: ["a", "b"]
    });
    combatantById(battle, "b").health = 2;
    applyAction(battle, { actorId: "hero", type: Ss2ActionType.CAST_GHOST_STRIKE, targetId: "b" });
    const [event] = battle.lastResolution.events.filter((entry) => entry.type === Ss2ActionType.CAST_GHOST_STRIKE);
    if (combatantById(battle, "b").alive || event.casterTo === undefined) continue;
    found = true;
    assert.equal(event.casterTo, -86, "the premise: the caster landed behind the body");
    assert.equal(
      battle.lastResolution.effects.some((effect) => effect.targetId === "b" && effect.status === SS2_FACING_LEFT),
      false,
      `seed ${seed}: the body is not turned to face its killer`
    );
    assert.equal(facesLeft(battle, "b"), false, `seed ${seed}: it keeps the facing it died with`);
    assert.equal(facesLeft(battle, "hero"), false, `seed ${seed}: and the killer faces a, the foe left alive`);
  }
  assert.ok(found, "the sweep must land one killing ghost strike that moves its caster");
});

test("A PHASE THAT KILLS NOBODY RE-FACES NOBODY, so the swinger's turn survives it", () => {
  const battle = staged({
    at: { hero: [0, FRONT], a: [-85, FRONT], b: [100, FRONT] },
    facingLeft: ["hero", "b"],
    foes: ["a", "b"]
  });
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.QUICK_ATTACK, targetId: "b" });
  assert.ok(combatantById(battle, "b").alive);
  assert.deepEqual(
    battle.lastResolution.effects.filter((effect) => effect.status === SS2_FACING_LEFT),
    [{ kind: EffectKind.STATUS, targetId: "hero", status: SS2_FACING_LEFT, active: false }],
    "the turn toward b is the only facing write"
  );
});

/* ------------------------------------------------------------------ *
 * The whirlwind and the discharge do not reach across ranks            *
 * ------------------------------------------------------------------ */

/** hero at (0, 200) with `target` at (`dx`, `y`), one foe. */
function oneFoe({ dx, y, hero = {} }) {
  return staged({
    at: { hero: [0, FRONT], foe: [dx, y] },
    facingLeft: ["foe"],
    hero,
    foes: ["foe"]
  });
}

test("A WHIRLWIND DOES NOT REACH A FOE IN ANOTHER RANK, however close — the owner's 'not at different y'", () => {
  // 100 across and one rank back is a fight distance of 139, inside the gate's
  // round(reach + 50) = 180 — which is how the old depth term let it through.
  const across = oneFoe({ dx: 100, y: SECOND, hero: { inventory1: 37 } });
  const hero = combatantById(across, "hero");
  assert.ok(ss2FightDistance(hero, combatantById(across, "foe")) < Math.round(ss2Reach(hero) + 50),
    "the premise: the foe is inside the gate's distance");
  applyAction(across, { actorId: "hero", type: Ss2ActionType.CAST_WHIRLWIND, targetId: "foe" });
  const [event] = across.lastResolution.events.filter((entry) => entry.type === Ss2ActionType.CAST_WHIRLWIND);
  assert.equal(event.outOfRange, true, "a different rank is out of range");

  // The control: the same x in the hero's own rank is in range.
  const beside = oneFoe({ dx: 100, y: FRONT, hero: { inventory1: 37 } });
  applyAction(beside, { actorId: "hero", type: Ss2ActionType.CAST_WHIRLWIND, targetId: "foe" });
  const [control] = beside.lastResolution.events.filter((entry) => entry.type === Ss2ActionType.CAST_WHIRLWIND);
  assert.notEqual(control.outOfRange, true, "the same rank at the same x is in range");
});

test("THE AI WHIRLS AT THE NEAREST FOE IN ITS OWN RANK, and not at one no whirlwind can reach", () => {
  // Ladder arm 20 is `check_inventory(37) && fightdistance < 200` against the
  // build's one defender; WHICH foe is this engine's (INVENTED: the nearest).
  // Once the gate stopped reaching across ranks, "nearest by the hypotenuse"
  // named a foe one rank back whom the spin can never touch, and the AI spent
  // its whirlwind on the empty air: measured at 48 seeded 3v3 bouts on the
  // tricks kit, 227 of 281 whirlwinds out of range.
  const both = staged({
    at: { hero: [0, FRONT], near: [100, SECOND], beside: [150, FRONT] },
    facingLeft: ["near", "beside"],
    hero: { inventory1: 37 },
    foes: ["near", "beside"]
  });
  const hero = combatantById(both, "hero");
  assert.ok(ss2FightDistance(hero, combatantById(both, "near")) < ss2FightDistance(hero, combatantById(both, "beside")),
    "the premise: the foe one rank back is the nearer by the hypotenuse");
  const chosen = suggestAction(both, "hero");
  assert.deepEqual([chosen.type, chosen.targetId], [Ss2ActionType.CAST_WHIRLWIND, "beside"],
    "the whirlwind goes to the foe in the hero's own rank");

  const acrossOnly = staged({
    at: { hero: [0, FRONT], near: [100, SECOND], far: [1500, 6] },
    facingLeft: ["near", "far"],
    hero: { inventory1: 37 },
    foes: ["near", "far"]
  });
  assert.notEqual(suggestAction(acrossOnly, "hero").type, Ss2ActionType.CAST_WHIRLWIND,
    "with nobody in his rank inside 200, there is nobody to spin at");
});

test("NOR DOES A PSYCHE DISCHARGE, which shares the whirlwind's gate", () => {
  const charged = { psyche_up: SS2_PSYCHE_UP.dischargeAt };
  const across = oneFoe({ dx: 100, y: SECOND, hero: charged });
  applyAction(across, { actorId: "hero", type: Ss2ActionType.PSYCHE_UP, targetId: "foe" });
  const [event] = across.lastResolution.events.filter((entry) => entry.type === Ss2ActionType.PSYCHE_UP);
  assert.equal(event.outOfRange, true, "a different rank is out of range");
  assert.equal(event.discharged, false);

  const beside = oneFoe({ dx: 100, y: FRONT, hero: charged });
  applyAction(beside, { actorId: "hero", type: Ss2ActionType.PSYCHE_UP, targetId: "foe" });
  const [control] = beside.lastResolution.events.filter((entry) => entry.type === Ss2ActionType.PSYCHE_UP);
  assert.notEqual(control.outOfRange, true, "the same rank at the same x is in range");
});
