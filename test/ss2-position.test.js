/**
 * POSITION IN THE RESOLVER — the half the presentation stream was waiting for.
 *
 * WHY THIS FILE IS SEPARATE. Every other SS2 test in this repository now stages
 * its gladiators in contact, because almost none of them are about geometry and
 * a 500-unit approach in front of an armour-split assertion is noise. That
 * makes this file the only place the approach is actually exercised, so it
 * states its positions explicitly and never borrows a staged helper.
 *
 * WHAT IS MEASURED HERE AND WHAT IS AUTHORED. The controller gate, the walk's
 * stamina cost, the construction geometry and `fightdistance` are the build's,
 * each cited at its assertion. **THE DISPLACEMENT IS NOW THE BUILD'S TOO**
 * (2026-09-11): `ss2WalkDisplacement` derives it from `movement_speed` out of
 * the walk branches of overlay frame 52, so the one authored number in this
 * file is gone and `SS2_ARENA.walkDistanceAtSpeedFloor` is a pin on the
 * derivation's floor case rather than a figure. What is still AUTHORED here is
 * `allyStride` and the multi-foe reading of the overlap clamp, both because
 * vanilla has no second ally to settle them.
 *
 * THE ASSERTIONS PROVE, THEY DO NOT STATE: every sweep asserts it FOUND the
 * case it was sweeping for.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction,
  combatantById,
  combatStateHash,
  createTeamBattle,
  currentCombatant,
  suggestAction,
  legalActions,
  toTeamWireState
} from "../src/team/index.js";
import { EffectKind, TeamRuleSetError } from "../src/team/rule-set.js";
import {
  createSs2TeamRules,
  ss2BattleValues,
  ss2Combatant,
  ss2FightDistance,
  ss2MovementSpeed,
  ss2PhysicalSize,
  ss2Reach,
  ss2WalkDisplacement,
  ss2WalkDestination,
  ss2TeamRules,
  SS2_ARENA,
  Ss2ActionType,
  VANILLA_PHASE_LABEL
} from "../src/team/ss2-rules.js";
import { SS2_WEAPON_IDS, ss2WeaponEntry } from "../src/team/ss2-weapon-table.js";
import {
  buildArenaLayout,
  CommandKind,
  LabelProvenance,
  presentResolvedEvents,
  SS2_STATIC_MAP_BINDINGS
} from "../src/adapter/index.js";
import { applyCommands, emptyScene, timelineFor } from "../src/render/index.js";

const gladiator = (overrides = {}) => ({
  strength: 9, speed: 5, attack: 9, defence: 5, vitality: 5, stamina: 4,
  magicka: 0, charisma: 3, herolevel: 3, character_level: 3,
  weapon_min_damage: 3, weapon_max_damage: 9,
  ...overrides
});

/** Left where the RULE SET puts them — no staged `x` anywhere in this file. */
function bout(perSide = 1, seed = 1, overrides = {}) {
  const side = (prefix, dir) => ({
    id: prefix,
    name: prefix,
    combatants: Array.from({ length: perSide }, (unused, index) =>
      ss2Combatant(gladiator({ speed: 5 + index, gladiator_dir: dir, ...overrides }), {
        id: `${prefix}-${index + 1}`,
        name: `${prefix} ${index + 1}`,
        controller: "local"
      })
    )
  });
  return createTeamBattle({ seed, rules: ss2TeamRules, teams: [side("red", "right"), side("blue", "left")] });
}

const typesOf = (battle, actorId) => legalActions(battle, actorId).map((option) => option.type);

/**
 * Whose turn it is. Used instead of a hard-coded `red-1` throughout, because
 * initiative is an agility order and SIDES ALTERNATE (D3, 2026-09-11) — with
 * both slot-0 gladiators on the same speed the tie-break decides who opens,
 * and it is not always red.
 */
const actorId = (battle) => currentCombatant(battle).id;

/** The walk that shortens the distance to the nearest living foe. */
function towardWalk(battle, actorId) {
  const actor = combatantById(battle, actorId);
  const foe = battle.teams.flatMap((team) => team.combatants)
    .find((combatant) => combatant.teamId !== actor.teamId && combatant.alive);
  return foe.x > actor.x ? Ss2ActionType.WALK_RIGHT : Ss2ActionType.WALK_LEFT;
}

/* ------------------------------------------------------------------ */
/* The build's own distance metric                                     */
/* ------------------------------------------------------------------ */

/**
 * `getfightdistance` is EUCLIDEAN, and this repository recorded it as the
 * x-separation in four places until 2026-09-12. The offsets it cited were
 * always right; `ydist` sits between them. See `ss2FightDistance`.
 *
 * These two tests pin the two halves that matter: the second term is really
 * there, and turning it on moved nothing, because a level pair reduces to the
 * previous body EXACTLY rather than approximately.
 */
test("fightdistance is the build's hypotenuse, not the x-separation", () => {
  // `+0x0427`: fightdistance = round(sqrt(xdist*xdist + ydist*ydist)).
  // 3-4-5, so no rounding can hide a wrong operator.
  assert.equal(ss2FightDistance({ x: 0, y: 0 }, { x: 30, y: 40 }), 50);
  assert.equal(ss2FightDistance({ x: 0, y: 0 }, { x: 0, y: 40 }), 40, "a pure y separation is a real distance");

  // The worked case from `figureScaleFor`'s docstring: a second rank parked on
  // the front rank's clamp line at strength 9 (physical_size 86, reach 130)
  // stays in reach until dy reaches 97. This is the arithmetic that makes a
  // perpendicular axis viable where an x-stagger is not.
  assert.equal(ss2FightDistance({ x: 0, y: 0 }, { x: 86, y: 60 }), 105);
  assert.equal(ss2FightDistance({ x: 0, y: 0 }, { x: 86, y: 97 }), 130);
});

test("a level pair reduces EXACTLY to the rounded x-separation, so no pinned distance moved", () => {
  // The reduction is exact, not approximate: with ydist 0, round(sqrt(xdist^2))
  // is xdist, and xdist is already round(|dx|).
  //
  // The negative-half-integer case is the one that breaks the naive rewrite —
  // `Math.round(-2.5)` is -2, so rounding the SIGNED difference before squaring
  // loses a unit. The build branches on which clip is left, always subtracting
  // the smaller from the larger, so the absolute value comes FIRST.
  for (let dx = -400; dx <= 400; dx += 1) {
    for (const frac of [0, 0.25, 0.5, 0.75, -0.5]) {
      const a = { x: dx + frac };
      const b = { x: 0 };
      assert.equal(
        ss2FightDistance(a, b),
        Math.round(Math.abs(a.x - b.x)),
        `a level pair at dx ${dx + frac} must reduce to the rounded x-separation`
      );
    }
  }

  // An absent `y` reads as 0 rather than throwing or returning null: every
  // combatant in the tree today has no second coordinate, and the 1-D answer
  // is the correct one for them.
  assert.equal(ss2FightDistance({ x: -250 }, { x: 250 }), 500);
});

/* ------------------------------------------------------------------ */
/* The second axis                                                     */
/* ------------------------------------------------------------------ */

/**
 * `rankStride` is the owner's dial and `0` is the off switch. What these pin
 * is that OFF is off STRUCTURALLY rather than by tuning: with a stride of 0
 * every gladiator carries `y: null`, `ss2FightDistance` reads that as 0, and
 * there is no second code path that could drift from the first.
 */
test("the second axis is OFF by default, and off means the key is null rather than absent", () => {
  const battle = bout(3);
  for (const id of ["red-1", "red-2", "red-3"]) {
    const combatant = combatantById(battle, id);
    assert.equal(combatant.y, null, `${id} models no depth by default`);
    assert.ok("y" in combatant, "the key is present either way, so two peers commit to one shape");
  }
  assert.equal(ss2TeamRules.id, "ss2-map-derived-tournament", "and the default id is untouched");
});

test("a non-zero rankStride ranks the slots, and slot 0 keeps the vanilla depth", () => {
  const rules = createSs2TeamRules({ rankStride: 97 });
  // Arena y is 200 at the front and DECREASES going back — the convention
  // `slot-layout.js` already ships and `withDrawOrder` already relies on.
  assert.equal(rules.startingY({ slotIndex: 0 }), 200, "slot 0 is the vanilla _y");
  assert.equal(rules.startingY({ slotIndex: 1 }), 103);
  assert.equal(rules.startingY({ slotIndex: 2 }), 6);

  // BOTH SIDES USE THE SAME RANKS. Mirroring them would put every red in a
  // rank with no blue in it, which is a wall and not a second interface.
  assert.equal(
    rules.startingY({ teamIndex: 0, slotIndex: 1 }),
    rules.startingY({ teamIndex: 1, slotIndex: 1 }),
    "red slot 1 and blue slot 1 stand in the same rank, so they can meet"
  );
});

test("the stride joins the rule-set id, because the hash carries only the id", () => {
  // Two peers running different strides would otherwise agree on every hash
  // and then diverge the first time depth mattered. Same rule as crowdPatience.
  assert.equal(createSs2TeamRules({ rankStride: 0 }).id, "ss2-map-derived-tournament");
  assert.equal(createSs2TeamRules({ rankStride: 97 }).id, "ss2-map-derived-tournament-rank-97");
  assert.throws(
    () => createSs2TeamRules({ rankStride: -1 }),
    (error) => error instanceof TeamRuleSetError && /rankStride/.test(error.message)
  );
});

test("fixtureReplay models no depth even with the stride on, which is what keeps 23 goldens still", () => {
  // The same firewall as `startingPosition`, and it must hold independently:
  // giving a golden a rank this engine invented would replay a measured action
  // through a geometry no capture observed.
  const replay = createSs2TeamRules({ fixtureReplay: true, rankStride: 150 });
  assert.equal(replay.startingY({ slotIndex: 2 }), null);
  assert.equal(replay.startingPosition({ teamIndex: 0, slotIndex: 2 }), null);
});

/**
 * ► **THE DEADLOCK THE SECOND AXIS CREATED, AND THE PREDICATE THAT CLOSES IT.**
 *
 * The overlap clamp parks a walker at `foe.x -/+ physical_size(foe)`, reasoning
 * only about x. Once a foe stands at a different depth the GATE is the
 * hypotenuse, so at `rankStride` 97 a walker parked at `dx = 85` sat at
 * `round(sqrt(85^2 + 97^2)) = 129` against a reach of 129 and a strict `<` —
 * one unit out of reach, permanently. Measured before the fix: 16 of 24 bouts
 * never settled, every survivor at full health, one side walking 354 times.
 *
 * `ss2BodyBlocks` closes it by asking what "overlap" already meant: a body
 * further away in depth than its own `physical_size` is not touching you.
 */
test("a foe standing in another rank does not block a walk, which is what makes a crossing possible", () => {
  const near = { id: "a", x: 0, y: 200, alive: true, stats: { strength: 9, agility: 10 } };

  // The baseline: what this walk does with nothing in its way at all.
  const unobstructed = ss2WalkDestination(near, [], 1);

  // A foe 150 ahead, LEVEL: the walk clamps against its body and stops short.
  const level = [{ id: "b", x: 150, y: 200, alive: true, stats: { strength: 9 } }];
  assert.equal(ss2WalkDestination(near, level, 1), 150 - 86, "a level foe clamps the walk at its physical_size");
  assert.ok(unobstructed > 150 - 86, "and that is genuinely shorter than the free walk");

  // The SAME foe, a rank away: 200 - 6 = 194 apart in depth, far more than its
  // 86-unit body, so it is scenery and the walk runs exactly as if it were not
  // there. This is the rule that makes a crossing possible.
  const ranked = [{ id: "b", x: 150, y: 6, alive: true, stats: { strength: 9 } }];
  assert.equal(
    ss2WalkDestination(near, ranked, 1),
    unobstructed,
    "a foe in another rank must not clamp the walk at all"
  );

  // And the walk really does carry the actor PAST it, which is the crossing.
  assert.ok(unobstructed > 150, `the walk must pass the ranked foe's x, got ${unobstructed}`);
});

test("with every gladiator level the depth predicate is constantly true, so 1v1 is untouched", () => {
  // Vanilla has one gladiator a side and both stand at _y = 200, so `|dy|` is 0
  // for every pair the build can make. This is the parity case on the new axis.
  const actor = { id: "a", x: 0, y: 200, alive: true, stats: { strength: 9, agility: 10 } };
  const foe = [{ id: "b", x: 300, y: 200, alive: true, stats: { strength: 9 } }];
  const withDepth = ss2WalkDestination(actor, foe, 1);
  // The same pair with no y at all: a null depth reads as 0 on both sides.
  const bare = { id: "a", x: 0, alive: true, stats: { strength: 9, agility: 10 } };
  const bareFoe = [{ id: "b", x: 300, alive: true, stats: { strength: 9 } }];
  assert.equal(ss2WalkDestination(bare, bareFoe, 1), withDepth, "a null depth and a level pair are the same walk");
});

/**
 * The rank verbs, and the AI rule that stops them rebuilding the one interface.
 */
function rankedBout(perSide, rankStride, seed = 1) {
  const side = (prefix, dir) => ({
    id: prefix,
    name: prefix,
    combatants: Array.from({ length: perSide }, (unused, index) =>
      ss2Combatant(gladiator({ speed: 5 + index, gladiator_dir: dir }), {
        id: `${prefix}-${index + 1}`,
        name: `${prefix} ${index + 1}`,
        controller: "local"
      })
    )
  });
  return createTeamBattle({
    seed,
    rules: createSs2TeamRules({ rankStride }),
    teams: [side("red", "right"), side("blue", "left")]
  });
}

test("the rank verbs are offered only when the rule set models depth and a rank exists that way", () => {
  // Axis OFF: the verbs never appear, whatever else is true.
  const flatOptions = legalActions(bout(3)).map((option) => option.type);
  assert.ok(!flatOptions.includes("rank-back"), "no depth, no rank verbs");
  assert.ok(!flatOptions.includes("rank-front"));

  // Axis ON: slot 0 stands at the FRONT rank, so there is no rank in front of
  // it and only `rank-back` is legal. The band is bounded, not infinite.
  const ranked = rankedBout(3, 97);
  const front = legalActions(ranked, "red-1").map((option) => option.type);
  assert.ok(front.includes("rank-back"), "the front rank can fall back");
  assert.ok(!front.includes("rank-front"), "and has nowhere further forward to go");

  const rear = legalActions(ranked, "red-3").map((option) => option.type);
  assert.ok(rear.includes("rank-front"));
  assert.ok(!rear.includes("rank-back"), "the rear rank has nowhere further back to go");
});

test("a rank change moves exactly one rank and costs a walk's stamina", () => {
  const battle = rankedBout(3, 97);
  // Whoever the initiative gives the first turn to; the rule is per-actor and
  // not per-side, and hard-coding a mover made this test depend on the order.
  const mover = actorId(battle);
  const before = combatantById(battle, mover);
  const startX = before.x;
  const startY = before.y;
  const startStamina = before.resources.staminaleft.value;

  // Whichever rank verb this actor's rank allows — the rearmost slot has no
  // `rank-back` and the frontmost no `rank-front`, so neither is universal.
  const verb = legalActions(battle, mover)
    .map((option) => option.type)
    .find((type) => type === "rank-back" || type === "rank-front");
  assert.ok(verb, "a 3-rank arena offers the mover at least one rank verb");

  applyAction(battle, { actorId: mover, type: verb, targetId: mover });

  const after = combatantById(battle, mover);
  assert.equal(
    Math.abs(after.y - startY), 97,
    "exactly one rank, not a distance"
  );
  assert.equal(
    after.y - startY,
    verb === "rank-back" ? -97 : 97,
    "and arena y DECREASES going back, which is the renderer's convention too"
  );
  assert.equal(after.x, startX, "and the other axis is untouched");
  assert.ok(
    after.resources.staminaleft.value < startStamina,
    "a rank change is a completed phase that pays, not a free step"
  );
});

/**
 * ► **THE AI RULE THAT IS THE WHOLE FEATURE, and the first version of it was a
 *   PILE-UP MACHINE.** Moving toward the NEAREST foe's rank is the obvious rule
 *   and it collapses all six gladiators into one rank at the opening, which
 *   rebuilds in two dimensions the single interface the axis exists to break.
 *   The tell was unmistakable: `rankStride` 97 and 150 produced IDENTICAL
 *   censuses — 1,839 actions, 32.8% mutual reach, 1 fight — because once
 *   everybody shares a rank the stride cannot matter.
 *
 * This asserts the OUTCOME rather than the decision, because the outcome is
 * what the owner sees and what the census measures.
 */
test("the AI keeps the ranks apart instead of collapsing them into one", () => {
  const battle = rankedBout(3, 150);
  const startingRanks = new Set([1, 2, 3].map((slot) => combatantById(battle, `red-${slot}`).y));
  assert.equal(startingRanks.size, 3, "the three slots open in three distinct ranks");

  // Drive the bout the way the AI would, and watch how many ranks stay
  // occupied. A pile-up shows up as this collapsing to 1.
  let leastRanksSeen = 3;
  for (let step = 0; step < 200 && !battle.result; step += 1) {
    const id = actorId(battle);
    const options = legalActions(battle, id);
    if (options.length === 0) break;
    const chosen = suggestAction(battle, id);
    applyAction(battle, { actorId: id, ...chosen });

    const living = ["red", "blue"].flatMap((team) =>
      [1, 2, 3].map((slot) => combatantById(battle, `${team}-${slot}`)).filter((c) => c.alive)
    );
    if (living.length >= 4) {
      leastRanksSeen = Math.min(leastRanksSeen, new Set(living.map((c) => c.y)).size);
    }
  }
  assert.ok(
    leastRanksSeen >= 2,
    `the ranks must not collapse to one while four or more are alive; saw ${leastRanksSeen}`
  );
});

/* ------------------------------------------------------------------ */
/* Construction geometry                                               */
/* ------------------------------------------------------------------ */

test("the vanilla pair is constructed where the build constructs it, and allies stand further out", () => {
  // Map, "Battle entry" step 5: the runtime clips are placed at (-250, 200) and
  // (250, 200). `docs/integration/ss2-champion-dna.md:710-712` states the
  // consequence independently, from `getfightdistance`: fightdistance is 500 at
  // construction.
  const solo = bout(1);
  assert.equal(combatantById(solo, "red-1").x, -250);
  assert.equal(combatantById(solo, "blue-1").x, 250);
  assert.equal(
    ss2FightDistance(combatantById(solo, "red-1"), combatantById(solo, "blue-1")),
    500,
    "the map and the champion-dna document agree on 500, from two directions"
  );

  // The ally band is AUTHORED — vanilla has no second ally, so nothing can
  // settle it (`MAP_SILENCE.multi-slot-arena-geometry`). Slot 0 keeps the
  // vanilla pair EXACTLY, which is what makes 1v1 the parity case.
  const three = bout(3);
  assert.deepEqual(
    [0, 1, 2].map((slot) => combatantById(three, `red-${slot + 1}`).x),
    [-250, -380, -510]
  );
  assert.deepEqual(
    [0, 1, 2].map((slot) => combatantById(three, `blue-${slot + 1}`).x),
    [250, 380, 510]
  );
  assert.equal(SS2_ARENA.frontX, 250);
  assert.equal(SS2_ARENA.allyStride, 130);
});

test("a stated position beats the rule set's, exactly as a stated maxHealth does", () => {
  const battle = createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator(), { id: "hero", x: -12 })] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "villain", x: 12 })] }
    ]
  });
  assert.equal(combatantById(battle, "hero").x, -12);
  assert.equal(combatantById(battle, "villain").x, 12);
});

test("a rule set that declares no startingPosition models no position, and its combatants say so", () => {
  // `fixtureReplay` returns null, which is the seam that keeps all 23 promoted
  // goldens replaying through the vocabulary they were measured against. The
  // KEY is still present — `x: null`, never absent — so two peers commit to one
  // projection shape whatever rule set they run.
  const replay = createSs2TeamRules({ fixtureReplay: true });
  const battle = createTeamBattle({
    seed: 1,
    rules: replay,
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator(), { id: "hero" })] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "villain" })] }
    ]
  });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.x, null);
  assert.equal(Object.hasOwn(hero, "x"), true, "null, not absent: an absent key lets two peers disagree it exists");

  // And it keeps the position-blind vocabulary exactly: three melee verbs
  // against the foe and a rest, with no walk anywhere.
  assert.deepEqual(typesOf(battle), ["quick-attack", "normal-attack", "power-attack", "rest"]);

  const projected = toTeamWireState(battle).teams[0].combatants[0];
  assert.equal(projected.x, null, "and the projection carries it, so the hash covers the difference");
});

/* ------------------------------------------------------------------ */
/* The controller gate                                                 */
/* ------------------------------------------------------------------ */

test("the melee verbs appear exactly when the build's own selector says closerange_warrior", () => {
  // Frame 4 `DoAction@0x238bbf` `+0x00f6`:
  //   fightdistance < hero.weapon_range ? closerange_warrior : longrange_warrior
  // STRICT `<`, re-read off the installed build 2026-09-11.
  //
  // ► **THIS ASSERTED 86 AND CITED `ss2-item-tables.md:58` FOR
  //   "`weapon_range` for an unarmed gladiator is `physical_size`". THE CITE
  //   WAS HALF OF A WRAPPED LINE.** Line 59 of that file continues
  //   `+ _root["weapon" + c.weapon][5] * 44`. There is no unarmed branch in
  //   `battlevalues`: every gladiator has a `weapon` id, and the smallest `[5]`
  //   in all ninety rows is 1, so `physical_size` on its own is the reach of
  //   nothing. **The archive agrees from the other side** — 3,102
  //   `{"t":"state"}` records, and its own hero is weapon 0 at `physical_size`
  //   87 with a `weapon_range` of 131. `ss2Reach` now reads the declared
  //   resource and falls back to the build's bare-hands row.
  const reach = ss2Reach({ stats: { strength: 9 } });
  assert.equal(reach, 130, "80 + round(9 / 1.5), then + 44 for weapon 0's multiplier of 1");
  assert.equal(ss2PhysicalSize({ stats: { strength: 9 } }), 86, "and the two are different quantities");
  assert.equal(
    ss2Reach({ stats: { strength: 9 }, resources: { weapon_range: { value: 218 } } }),
    218,
    "a declared weapon_range wins: that is the whole point of projecting it"
  );

  // The boundary, asserted on BOTH sides of the strict comparison rather than
  // near it: at exactly `reach` the build is on the long-range controller.
  const at = (separation) => {
    const battle = createTeamBattle({
      seed: 1,
      rules: ss2TeamRules,
      teams: [
        { id: "red", combatants: [ss2Combatant(gladiator(), { id: "hero", x: -separation / 2 })] },
        {
          id: "blue",
          combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "villain", x: separation / 2 })]
        }
      ]
    });
    return typesOf(battle);
  };
  assert.equal(at(reach - 2).includes("quick-attack"), true, `${reach - 2} < ${reach} is close range`);
  assert.equal(at(reach).includes("quick-attack"), false, `${reach} is NOT < ${reach}, so it is long range`);
  assert.equal(at(reach + 2).includes("quick-attack"), false);
});

test("in range the build offers the retreat and NEVER the advance, and out of range it offers both", () => {
  // The map's own table (battle map, "Buttons wired per controller frame",
  // :223-230). `closerange_warrior` facing right wires `jumpleft`/`walkleft`,
  // facing left `jumpright`/`walkright` — both of them AWAY. Once you are in
  // range the build lets you back out and never further in. `longrange_warrior`
  // wires both directions in both facings.
  const engaged = createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator(), { id: "hero", x: -30 })] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "villain", x: 30 })] }
    ]
  });
  // The hero stands left of its foe, so `walk-left` is the retreat.
  assert.deepEqual(typesOf(engaged), ["quick-attack", "normal-attack", "power-attack", "walk-left", "rest"]);

  const apart = bout(1);
  assert.deepEqual(typesOf(apart), ["walk-left", "walk-right", "rest"], "long range wires both walks and no verb");
});

test("the two walks are ordered LEFT then RIGHT, which is the build's slot order and not away-then-toward", () => {
  // ► **THE FIRST VERSION OF THIS ORDERED BY AWAY-THEN-TOWARD, and that was an
  //   invented rule.** Checked across all eight rows of the map's table: every
  //   controller that wires both puts `walkleft` at `optionB` and `walkright`
  //   at `optionE`, in BOTH facings. The build cannot order by toward/away —
  //   the slots are wired once per controller frame and the opponent moves.
  //
  // The two sides face opposite ways and stand on opposite sides of the middle,
  // so if the order were relative to the opponent these two lists would differ.
  const battle = bout(1);
  const first = actorId(battle);
  const firstTeam = combatantById(battle, first).teamId;
  const firstList = typesOf(battle);
  applyAction(battle, { actorId: first, type: Ss2ActionType.WALK_RIGHT, targetId: first });
  const second = actorId(battle);
  const secondList = typesOf(battle);
  assert.notEqual(
    combatantById(battle, second).teamId,
    firstTeam,
    "sides alternate, so the second list must be the OTHER side's"
  );
  assert.deepEqual(firstList.slice(0, 2), ["walk-left", "walk-right"]);
  assert.deepEqual(secondList.slice(0, 2), ["walk-left", "walk-right"], "same order for the side facing the other way");
});

/* ------------------------------------------------------------------ */
/* What a walk costs and what it does                                  */
/* ------------------------------------------------------------------ */

test("a walk costs round(movement_speed / 2) and is a COMPLETED PHASE, so it regenerates and heals", () => {
  // `walkleft` `+0x3b37` / `walkright` `+0x3d16`: staminacost = round(movement_speed / 2),
  // and `movement_speed = clamp(round(speed * 1.5), 4, 60)` (`+0x37d2`). It is
  // spent by `nextphase`'s subtraction like every other phase, so the
  // transition's `1 + round(stamina / 3)` regeneration and its heal both run.
  const battle = bout(1, 1, { speed: 8, stamina: 6 });
  const id = actorId(battle);
  const hero = combatantById(battle, id);
  assert.equal(ss2MovementSpeed(hero), 12, "clamp(round(8 * 1.5), 4, 60)");

  hero.resources.staminaleft.value = 60;
  hero.health = hero.maxHealth - 20;
  const before = { stamina: 60, health: hero.health };

  applyAction(battle, { actorId: id, type: towardWalk(battle, id), targetId: id });

  const after = combatantById(battle, id);
  // cost 6, regeneration 1 + round(6/3) = 3, so the walk is net -3 stamina.
  assert.equal(after.resources.staminaleft.value, before.stamina - 6 + 3);
  // heal = 1 + ceil(stamina / 2) = 1 + 3 = 4.
  assert.equal(after.health, before.health + 4, "a walk is a completed phase, not a free step");
});

test("a walk moves by ss2WalkDisplacement, which is the BUILD's and scales with movement_speed", () => {
  const battle = bout(1);
  const id = actorId(battle);
  const actor = combatantById(battle, id);
  const before = actor.x;
  // `gladiator()` is speed 5, so `movement_speed` is `clamp(round(7.5), 4, 60)`
  // = 8 and the step is 108 — NOT the 44 this assertion carried until the
  // displacement was derived. A walk is per-actor now.
  assert.equal(ss2MovementSpeed(actor), 8);
  assert.equal(ss2WalkDisplacement(8), 108);
  applyAction(battle, { actorId: id, type: Ss2ActionType.WALK_RIGHT, targetId: id });
  assert.equal(combatantById(battle, id).x, before + 108);
});

test("the derivation reproduces the 44 the project held for nine days, and only at the speed FLOOR", () => {
  // THE PIN THAT MAKES THE DERIVATION ACCOUNTABLE TO ITS OWN HISTORY. 44 was
  // authored from one uncited line in a frozen handoff; an adversarial reader
  // proposed it was a conflation with `weapon_range`'s 44. Neither: it is
  // `4 * 16 = 64` eased to a stop with 20 left to run. The uncited line was
  // right and it was right by luck, which is why it took bytes to close.
  assert.equal(ss2WalkDisplacement(4), 44);
  assert.equal(ss2WalkDisplacement(4), SS2_ARENA.walkDistanceAtSpeedFloor);

  // The easing, frame by frame, because `64 - 20` is the whole argument and a
  // reader should be able to check it without the SWF: `gap -= ceil(gap / 8)`
  // until the gap is 20 or less.
  const frames = [];
  for (let gap = 64; gap > 20; gap -= Math.ceil(gap / 8)) frames.push(gap);
  assert.deepEqual(frames, [64, 56, 49, 42, 36, 31, 27, 23]);

  // And it is NOT a constant. The floor is the slowest walk the build can
  // produce; every faster gladiator walks further, which is what made treating
  // 44 as universal a four-fold understatement at `movement_speed` 12.
  assert.deepEqual(
    [4, 5, 6, 8, 12, 20, 30, 60].map((speed) => ss2WalkDisplacement(speed)),
    [44, 61, 76, 108, 172, 301, 461, 940]
  );
  // The boot term is `100 + 2 * boot` percent, so boots make a walk LONGER.
  // Read off the `DefineFunction2` headers rather than the bodies: the two
  // helpers take their parameters in registers 2 and 1, and reading the bodies
  // alone inverts both.
  assert.equal(ss2WalkDisplacement(4, { boot: 0 }), 44);
  assert.equal(ss2WalkDisplacement(4, { boot: 5 }), 52);
  assert.ok(ss2WalkDisplacement(4, { boot: 9 }) > ss2WalkDisplacement(4, { boot: 0 }));

  // ► **THIS ASSERTION WAS `=== 0` AND IT WAS WRONG ABOUT THE BUILD (corrected
  //   2026-09-11 by a write-nothing verifier).** The build's per-frame `_x`
  //   update is unconditional and runs BEFORE the stop test — the init block
  //   falls through into it with no `Jump` — so a step inside the tolerance
  //   still moves the gladiator once: step 16 becomes `16 - ceil(16/8) = 2`. The
  //   old comment called zero "the build's behaviour and not a guard invented
  //   here", which is exactly the shape of claim this repository distrusts, made
  //   about a case no caller can reach. Unreachable still (the `movement_speed`
  //   floor of 4 makes the smallest real step 64); asserted because the helper is
  //   exported and takes any non-negative number.
  assert.equal(ss2WalkDisplacement(1), 2);

  // THE BUILD'S OPERATION ORDER, which is not the same function as its algebra.
  // `get_percentage` round-trips `(100 + 2*boot)/100*100` (lossy in doubles) and
  // `add_percentage` divides before multiplying. The collapsed
  // `ceil(ms*16*(100+2*boot)/100)` this module shipped for one commit differs by
  // +1 at six reachable pairs; these three are the ones a `speed` stat can reach
  // (`movement_speed` 45 and 50 from `speed` 30 and 33).
  assert.equal(ss2WalkDisplacement(45, { boot: 5 }), 775, "not 774");
  assert.equal(ss2WalkDisplacement(50, { boot: 5 }), 863, "not 862");
  assert.equal(ss2WalkDisplacement(50, { boot: 6 }), 879, "not 878");
  assert.throws(() => ss2WalkDisplacement(-1), TeamRuleSetError);
  assert.throws(() => ss2WalkDisplacement(4, { boot: Number.NaN }), TeamRuleSetError);
});

/* ------------------------------------------------------------------ */
/* The two quantities: reach and personal space                        */
/* ------------------------------------------------------------------ */

test("weapon_range is the build's own lookup, and the range multiplier reaches the fight", () => {
  // `battlevalues` `+0x3190`, re-read off the installed build 2026-09-11:
  //   weapon_range = physical_size + _root["weapon" + c.weapon][5] * 44
  // `[5]` runs 1, 2, 3, 4 across the melee rows and 100 on the eighteen type-4
  // (ranged) ones, so the SPREAD is the thing to pin: a reach that ignores the
  // column would give every one of these the same answer, which is precisely
  // what shipped until this commit.
  //
  // Weapon ids paired with a speed the shop's own gate admits
  // (`ss2-item-tables.md:530-552`), because `ss2Combatant` enforces it.
  const reachOf = (weapon, speed, strength = 9) => {
    const battle = createTeamBattle({
      seed: 1,
      rules: ss2TeamRules,
      teams: [
        {
          id: "red",
          combatants: [ss2Combatant(
            gladiator({ weapon, speed, strength, weapon_min_damage: undefined, weapon_max_damage: undefined }),
            { id: "hero" }
          )]
        },
        { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "villain" })] }
      ]
    });
    return ss2Reach(combatantById(battle, "hero"));
  };
  // strength 9 -> physical_size 86, and then one step of 44 per multiplier.
  assert.equal(ss2PhysicalSize({ stats: { strength: 9 } }), 86);
  assert.equal(reachOf(1, 5), 86 + 44, "weapon 1, [5] = 1");
  assert.equal(reachOf(21, 5), 86 + 44, "weapon 21, [5] = 1 — a different band, same column");
  assert.equal(reachOf(5, 15), 86 + 88, "weapon 5, [5] = 2");
  assert.equal(reachOf(17, 51), 86 + 132, "weapon 17, [5] = 3");
  assert.equal(
    new Set([reachOf(1, 5), reachOf(5, 15), reachOf(17, 51)]).size,
    3,
    "three multipliers must give three reaches, or the column is being ignored again"
  );

  // And a gladiator that resolves no weapon id falls back to the build's OWN
  // bare-hands row (id 0, `[5]` = 1) rather than to `physical_size`, which is
  // the reach of nothing: the smallest `[5]` in all ninety rows is 1.
  assert.equal(ss2Reach({ stats: { strength: 9 } }), 86 + 44);
  assert.equal(
    Math.min(...SS2_WEAPON_IDS.map((id) => ss2WeaponEntry(id).rangeMultiplier)),
    1,
    "if a zero-multiplier row ever appears, the fallback above stops being the minimum"
  );
});

test("the bow override carries weapon_range too, which battlevalues does and this module used to drop", () => {
  // `+0x3416`..`+0x344a`: one `if (using_bow)` block assigns `min_damage`,
  // `max_damage` AND `weapon_range` from their secondary counterparts. The
  // living head listed "no bow `weapon_range` override" as a surviving
  // `ss2BattleValues` omission; this is it arriving.
  //
  // `secondary_weapon_range = physical_size + weapon[secondary_weapon][5] * 44`
  // (`+0x32aa`) — the same lookup through the other slot.
  const armed = ss2BattleValues({
    strength: 9, speed: 5, vitality: 5, stamina: 4, herolevel: 3,
    weapon: 1, secondary_weapon: 61, using_bow: false
  });
  assert.equal(armed.physical_size, 86);
  assert.equal(armed.weapon_range, 86 + 44, "weapon 1's [5] is 1");
  assert.equal(armed.secondary_weapon_range, 86 + 4400, "weapon 61 is ranged: [5] is 100");

  const drawn = ss2BattleValues({
    strength: 9, speed: 5, vitality: 5, stamina: 4, herolevel: 3,
    weapon: 1, secondary_weapon: 61, using_bow: true
  });
  assert.equal(drawn.weapon_range, drawn.secondary_weapon_range, "the bow's range replaces the blade's");
  assert.equal(drawn.weapon_range, 86 + 4400);
  // The build is unguarded here and would write `undefined`; a resource bag
  // carries finite numbers only, so an archer with no secondary weapon keeps
  // its primary range rather than losing the field.
  const unarmedBow = ss2BattleValues({
    strength: 9, speed: 5, vitality: 5, stamina: 4, herolevel: 3, weapon: 1, using_bow: true
  });
  assert.equal(unarmedBow.weapon_range, 86 + 44);
  assert.equal(unarmedBow.secondary_weapon_range, undefined);
});

test("a clamped walk lands inside the attacker's own reach — for every strength gap under 65", () => {
  // ► **THE REGRESSION GUARD FOR THE DEADLOCK THIS COMMIT REMOVED, and it is a
  //   sweep rather than one case because the first version of it — asserting
  //   the invariant HOLDS everywhere — failed, and the failure is a real
  //   finding kept below.** While `ss2Reach` answered for both sides, a walk
  //   clamped at the foe's limit parked the walker exactly ON its own gate
  //   threshold and the build's STRICT `<` never opened: measured here on the
  //   `bout()` fixture, 0 turns with an attack on offer across 24 bouts and 0
  //   of 8 3v3s settling. Two quantities is what fixes it.
  for (const attacker of [1, 5, 9, 20, 40, 70, 100]) {
    for (const defender of [1, 5, 9, 20, 40, 70, 100]) {
      if (defender - attacker >= 65) continue;                 // see the block below
      const clampDistance = ss2PhysicalSize({ stats: { strength: defender } });
      const gate = ss2Reach({ stats: { strength: attacker } });
      assert.ok(
        clampDistance < gate,
        `strength ${attacker} closing on strength ${defender}: a clamped walk lands at ` +
        `${clampDistance} against a reach of ${gate}, and ${clampDistance} < ${gate} must hold`
      );
    }
  }
});

test("and OUTSIDE 65 the build's own gate shuts, which is a fidelity gap and not a deadlock", () => {
  // ► **FOUND BY THE SWEEP ABOVE FAILING, and recorded rather than asserted
  //   away.** `physical_size` spans 80 (strength 0) to 147 (strength 100) — a
  //   range of 67, WIDER than the 44 a bare-handed reach adds — so a big enough
  //   strength gap puts the defender's personal space outside the attacker's
  //   `weapon_range`, and a BARE-HANDED walker parks where its own gate is
  //   shut. The boundary is a strength gap of 65/66, flat across the range
  //   because `physical_size` is on both sides of the comparison.
  assert.equal(ss2PhysicalSize({ stats: { strength: 0 } }), 80);
  assert.equal(ss2PhysicalSize({ stats: { strength: 100 } }), 147);
  const blockedFrom = (attacker) => {
    for (let defender = attacker; defender <= 200; defender += 1) {
      if (ss2PhysicalSize({ stats: { strength: defender } }) >= ss2Reach({ stats: { strength: attacker } })) {
        return defender - attacker;
      }
    }
    return null;
  };
  assert.deepEqual([0, 1, 5, 9, 20, 40].map(blockedFrom), [66, 66, 65, 66, 65, 66]);

  // **THIS IS THE BUILD'S BEHAVIOUR, not this module's.** `battlevalues` gives
  // the same two numbers, and the selector is the same strict `<`.
  //
  // ► ~~"What the build has and this module does NOT is the escape:
  //   `onEnterFrame`'s sub-100 nudge, which drives the pair together a pixel a
  //   frame and takes the distance under 100."~~ **WITHDRAWN 2026-09-12,
  //   BROKEN TWICE.** (1) The nudge SEPARATES — `gladiator_dir` is FACING, not
  //   side-of-arena (`+0x28f3` sets hero "right" exactly when
  //   `hero._x < villain._x`), so both arms of `+0x36c1`..`+0x37c8` move the
  //   pair APART, 2 px a frame, up to a gap of 100. (2) Even under the wrong
  //   reading it would not follow: the guard is `fightdistance < 100` and the
  //   blocked case needs a separation of at least
  //   `min(weapon_range) = 80 + 44 = 124`, so the nudge cannot fire there at
  //   all. **The build has no escape from this case; it simply has the case.**
  //
  // **A WEAPON CLOSES IT WITHOUT ANY OF THAT**: `[5]` = 2 adds another 44 and
  // pushes the boundary past anything two reachable builds can differ by.
  const weak = { stats: { strength: 1 }, resources: { weapon_range: { value: 81 + 2 * 44 } } };
  assert.ok(ss2PhysicalSize({ stats: { strength: 70 } }) < ss2Reach(weak), "a mult-2 weapon reaches");

  // And it is NOT a hung bout: the bigger gladiator's reach covers the smaller
  // one's personal space, so it closes, swings, and the bout settles. Measured
  // here rather than argued.
  const WALKS = new Set([Ss2ActionType.WALK_LEFT, Ss2ActionType.WALK_RIGHT]);
  let settled = 0;
  let weakAttackTurns = 0;
  let strongAttackTurns = 0;
  for (let seed = 1; seed <= 8; seed += 1) {
    const battle = createTeamBattle({
      seed,
      rules: ss2TeamRules,
      teams: [
        { id: "red", combatants: [ss2Combatant(gladiator({ strength: 1 }), { id: "weak" })] },
        {
          id: "blue",
          combatants: [ss2Combatant(gladiator({ strength: 70, gladiator_dir: "left" }), { id: "strong" })]
        }
      ]
    });
    let guard = 0;
    while (!battle.result && guard < 1200) {
      guard += 1;
      const actor = currentCombatant(battle);
      if (!actor) break;
      const options = legalActions(battle);
      if (options.length === 0) break;
      if (options.some((option) => /attack$/.test(option.type))) {
        if (actor.id === "weak") weakAttackTurns += 1; else strongAttackTurns += 1;
      }
      const view = {
        turnNumber: battle.turnNumber,
        actor: { ...actor },
        allies: [],
        foes: battle.teams.flatMap((team) => team.combatants)
          .filter((combatant) => combatant.teamId !== actor.teamId && combatant.alive)
          .map((combatant) => ({ ...combatant }))
      };
      applyAction(battle, { ...battle.rules.chooseAiAction(view, actor.id, options), actorId: actor.id });
    }
    if (battle.result) settled += 1;
  }
  assert.equal(settled, 8, "every bout must still settle — a shut gate on one side is not a hung bout");
  assert.equal(weakAttackTurns, 0, "the smaller gladiator is never offered a swing, which is the gap named above");
  assert.ok(strongAttackTurns > 0, "and the bigger one is, or this proves nothing about the cause");
  assert.ok(WALKS.size === 2);
});

test("a walk may never carry a gladiator PAST a foe, which is the build's own clamp", () => {
  // `walkright` `+0x3de6`, re-read off the installed build 2026-09-11:
  //   if (destination > defender._x - game_defender.physical_size
  //       && attacker.gladiator_dir == "right")
  //     destination = defender._x - game_defender.physical_size
  //
  // ► **THIS ASSERTED `x === 250` — the FOE'S OWN POSITION — because the module
  //   clipped to `defender._x`, a narrowing it shipped for one commit.** The
  //   build's limit is the defender's PERSONAL SPACE, and the reason the
  //   faithful limit deadlocked was never the clamp: `ss2Reach` was
  //   `physical_size` on BOTH sides of a comparison the build makes between two
  //   different fields, so a walker parked exactly ON its own gate threshold
  //   and the build's STRICT `<` never opened. With `weapon_range` projected
  //   the two are different numbers again and the build's own clamp is back.
  const fast = gladiator({ speed: 40 });          // movement_speed 60, step 940
  const battle = createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [ss2Combatant(fast, { id: "hero", x: -250 })] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "villain", x: 250 })] }
    ]
  });
  assert.equal(ss2WalkDisplacement(ss2MovementSpeed(combatantById(battle, "hero"))), 940, "uncut, it crosses the arena");
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.WALK_RIGHT, targetId: "hero" });
  const villainSize = ss2PhysicalSize(combatantById(battle, "villain"));
  assert.equal(villainSize, 86, "80 + round(9 / 1.5) — the DEFENDER's size, not the attacker's reach");
  assert.equal(
    combatantById(battle, "hero").x,
    250 - villainSize,
    "the clamp stopped it at the foe's personal space, not at the foe and not 440 beyond it"
  );
  // And that lands it strictly INSIDE its own reach, which is what makes the
  // faithful clamp settle where the one-quantity version deadlocked: the gate
  // is `fightdistance < weapon_range`, and `weapon_range` is at least
  // `physical_size + 44` for every one of the ninety weapon rows.
  assert.equal(
    ss2FightDistance(combatantById(battle, "hero"), combatantById(battle, "villain")),
    villainSize
  );
  assert.ok(
    villainSize < ss2Reach(combatantById(battle, "hero")),
    "the walk ends inside the strict `<`, which is the whole of the fix"
  );

  // And it does not bind backwards: a foe behind the walker is not a wall.
  const away = createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator(), { id: "hero", x: -250 })] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "villain", x: 250 })] }
    ]
  });
  applyAction(away, { actorId: "hero", type: Ss2ActionType.WALK_LEFT, targetId: "hero" });
  assert.equal(combatantById(away, "hero").x, -250 - 108, "walking away is unclamped by the foe");
});

test("with two foes ahead the walk stops at the nearest CLAMP LINE, not the nearest foe", () => {
  // AUTHORED — vanilla has exactly one defender, so nothing can settle the
  // multi-foe rule (`MAP_SILENCE.multi-slot-arena-geometry`). What IS settled
  // is that the 1v1 case must stay identical to the build's, and that is what
  // picks this reading over "nearest by position": with unequal
  // `physical_size` the two orders differ, and a bigger foe standing slightly
  // FURTHER off is the one that stops you first.
  const battle = createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      // movement_speed 60, so an uncut step of 940 overshoots BOTH clamp lines
      // from here — which is what makes this a test of the minimum and not of
      // the displacement.
      { id: "red", combatants: [ss2Combatant(gladiator({ speed: 40 }), { id: "hero", x: -100 })] },
      {
        id: "blue",
        combatants: [
          // Nearer by position (500), smaller: its clamp line is 500 - 81 = 419.
          ss2Combatant(gladiator({ strength: 1, gladiator_dir: "left" }), { id: "small", x: 500 }),
          // Further by position (520), much bigger: its line is 520 - 127 = 393.
          ss2Combatant(gladiator({ strength: 70, gladiator_dir: "left" }), { id: "big", x: 520 })
        ]
      }
    ]
  });
  assert.equal(ss2PhysicalSize(combatantById(battle, "small")), 81);
  assert.equal(ss2PhysicalSize(combatantById(battle, "big")), 127);
  assert.ok(
    combatantById(battle, "small").x < combatantById(battle, "big").x,
    "the smaller foe must be the NEARER one, or this test is not about the two orders"
  );
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.WALK_RIGHT, targetId: "hero" });
  assert.equal(combatantById(battle, "hero").x, 520 - 127, "the further, bigger foe stops it first: 393, not 419");
});

test("a walk INTO a foe you already overlap snaps back to the clamp line, which is the build unguarded", () => {
  // `+0x3de6` is unconditional on where the walker currently stands: if the
  // destination is past `defender._x - physical_size`, it becomes that value,
  // even when that is BEHIND the walker.
  //
  // ► **THIS TEST'S STATED REACHABILITY RATIONALE WAS BACKWARDS (corrected
  //   2026-09-12).** It read "reachable in the build because `onEnterFrame`'s
  //   sub-100 nudge drives the pair together a pixel a frame". The nudge
  //   SEPARATES (`+0x28f3` fixes `gladiator_dir` as FACING), so it is precisely
  //   what FORBIDS the overlapping state in the build. What makes the case
  //   worth testing is not that vanilla reaches it — it is that this repository
  //   stages gladiators in contact in almost every other SS2 test, so a CALLER
  //   reaches it, and `resolveAction` must answer something defensible. The
  //   answer below is `+0x3de6` applied as written.
  const battle = createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator(), { id: "hero", x: -20 })] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "villain", x: 20 })] }
    ]
  });
  // Staged well inside the villain's personal space: 40 apart, size 86.
  assert.equal(ss2FightDistance(combatantById(battle, "hero"), combatantById(battle, "villain")), 40);
  // In range, so the rule set offers only the RETREAT — this walk is forced
  // straight at `resolveAction`, past `legalActions`, which is the only way to
  // reach the case at all.
  const resolved = ss2TeamRules.resolveAction({
    type: Ss2ActionType.WALK_RIGHT,
    actorId: "hero",
    targetId: "hero",
    actor: combatantById(battle, "hero"),
    target: combatantById(battle, "hero"),
    foes: [combatantById(battle, "villain")],
    turnNumber: 1
  }, { randomBetween: () => 0, randomNumber: () => 0 });
  const move = resolved.effects.find((effect) => effect.kind === EffectKind.POSITION);
  assert.equal(move.to, 20 - 86, "a forward walk from inside the clamp line moves BACKWARD to it");
  assert.ok(move.to < -20, "which is behind where the walker started, and that is the build as written");
});

test("a walk may never carry a gladiator past a foe — including when the CLAMP is what reverses it", () => {
  // ► **THE REGRESSION TEST FOR A BUG THIS MODULE SHIPPED FOR ONE COMMIT,
  //   found by `/codex:adversarial-review` on `gpt-6-astra` and NOT by the
  //   12-agent wave that audited the same diff an hour earlier.** The build's
  //   clamp (`+0x3de6`) sets the destination to
  //   `defender._x - physical_size(defender)` unconditionally, so it can land
  //   BEHIND the walker. Vanilla has one defender, so that can cross nobody;
  //   with a second foe it can, and it did.
  //
  //   Exactly the reported reproduction: the actor is offered `walk-right` as
  //   its retreat from the nearer foe, the FAR foe's clamp line is at
  //   `20 - 86 = -66`, and the actor travelled left THROUGH the foe at -10 —
  //   past a foe, which is the one thing `ss2WalkDestination` is load-bearing
  //   for.
  const battle = createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator(), { id: "actor", x: 0 })] },
      {
        id: "blue",
        combatants: [
          ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "left-foe", x: -10 }),
          ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "right-foe", x: 20 })
        ]
      }
    ]
  });
  // The case only exists because the retreat is offered while a foe stands the
  // other way — assert that, or the test proves nothing about the clamp.
  const offered = typesOf(battle, "actor");
  assert.equal(offered.includes(Ss2ActionType.WALK_RIGHT), true, "the retreat must be on offer");
  assert.equal(ss2PhysicalSize(combatantById(battle, "right-foe")), 86);

  applyAction(battle, { actorId: "actor", type: Ss2ActionType.WALK_RIGHT, targetId: "actor" });
  const landed = combatantById(battle, "actor").x;
  assert.ok(landed >= -10, `a walk must never end past the foe at -10; it ended at ${landed}`);
  assert.equal(landed, 0, "and the reversal that would cross it goes NOWHERE, not part-way");

  // The 1v1 reversal is UNTOUCHED, because it crosses nobody — that is the
  // build's own behaviour and the guard must not eat it.
  const solo = createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator(), { id: "hero", x: -20 })] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "villain", x: 20 })] }
    ]
  });
  const resolved = ss2TeamRules.resolveAction({
    type: Ss2ActionType.WALK_RIGHT,
    actorId: "hero",
    targetId: "hero",
    actor: combatantById(solo, "hero"),
    target: combatantById(solo, "hero"),
    foes: [combatantById(solo, "villain")],
    turnNumber: 1
  }, { randomBetween: () => 0, randomNumber: () => 0 });
  assert.equal(
    resolved.effects.find((effect) => effect.kind === EffectKind.POSITION).to,
    20 - 86,
    "one foe means the reversal crosses nobody, so it still happens"
  );
});

test("a reach wider than the arena is a bow, and this rule set refuses it rather than fighting it", () => {
  // ► **THE REGRESSION TEST FOR A DEFECT THIS SESSION INTRODUCED AND
  //   `/codex:adversarial-review` found.** Until `weapon_range` became a
  //   projected resource, `ss2Reach` returned `physical_size` for everyone and
  //   a bow could not open the melee gate at all. With the bow override
  //   (`+0x343e`) carried, `weapon_range` becomes `secondary_weapon_range`
  //   through a type-4 row whose `[5]` is 100 — and the controller gate
  //   `fightdistance < weapon_range` can then never be shut.
  const archer = ss2Combatant(
    gladiator({
      using_bow: true, secondary_weapon: 63, equipped_weapon: 2,
      weapon_min_damage: undefined, weapon_max_damage: undefined,
      secondary_weapon_min_damage: 6, secondary_weapon_max_damage: 36
    }),
    { id: "archer" }
  );
  // The projection is built — the refusal is the RULE SET's, at construction,
  // so it catches the adapter's combatants as well as `ss2Combatant`'s.
  assert.equal(archer.resources.weapon_range, 4486, "80 + round(9/1.5) + 100 * 44");
  assert.ok(
    archer.resources.weapon_range > SS2_ARENA.clamp.max - SS2_ARENA.clamp.min,
    "and it exceeds the whole arena, which is what makes the gate a constant"
  );

  assert.throws(
    () => createTeamBattle({
      seed: 1,
      rules: ss2TeamRules,
      teams: [
        { id: "red", combatants: [archer] },
        { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "foe" })] }
      ]
    }),
    (error) => error instanceof TeamRuleSetError && /wider than the arena/.test(error.message),
    "a gladiator this rule set cannot model must be refused, not silently given melee at any range"
  );

  // A MELEE weapon of the widest multiplier the table has is NOT refused: the
  // criterion has to separate the two, or it is just a ban on big numbers.
  const heavy = ss2Combatant(
    gladiator({ weapon: 20, speed: 60, weapon_min_damage: undefined, weapon_max_damage: undefined }),
    { id: "heavy" }
  );
  assert.equal(ss2WeaponEntry(20).rangeMultiplier, 3);
  assert.doesNotThrow(() => createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [heavy] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "foe" })] }
    ]
  }));
});

test("a stated weapon with no reach is REFUSED, not silently disarmed", () => {
  // ► **Also `/codex:adversarial-review`'s, and `tools/arena/roster.js` was the
  //   live instance.** `derive: false` means `ss2BattleValues` never runs, and
  //   the weapon id is equipment identity that does not survive into the
  //   resolver — so the gladiator reaches the fight bare-handed with nothing
  //   reporting the substitution.
  assert.throws(
    () => ss2Combatant(
      gladiator({ weapon: 5, speed: 20, hitpointsmax: 40, staminamax: 140 }),
      { id: "armed", derive: false }
    ),
    (error) => error instanceof TeamRuleSetError && /states weapon 5 with derive: false/.test(error.message),
    "weapon 5 is [5] = 2, so bare hands is 44 short and the record is contradictory"
  );

  // It fires even when the two reaches COINCIDE, which is the case that hid in
  // the demo roster for a day: weapon 1's multiplier is 1, so the fallback
  // happens to be right — by luck, not by contract.
  assert.equal(ss2WeaponEntry(1).rangeMultiplier, ss2WeaponEntry(0).rangeMultiplier);
  assert.throws(
    () => ss2Combatant(
      gladiator({ weapon: 1, hitpointsmax: 40, staminamax: 140 }),
      { id: "coincident", derive: false }
    ),
    (error) => error instanceof TeamRuleSetError && /luck and not a contract/.test(error.message)
  );

  // Three ways out, and all three are accepted.
  assert.doesNotThrow(() => ss2Combatant(
    gladiator({ weapon: 5, speed: 20, weapon_range: 171, hitpointsmax: 40, staminamax: 140 }),
    { id: "stated", derive: false }
  ), "state the reach");
  assert.doesNotThrow(() => ss2Combatant(
    gladiator({ hitpointsmax: 40, staminamax: 140 }),
    { id: "bare", derive: false }
  ), "or drop the id and be honestly bare-handed");
  assert.doesNotThrow(() => ss2Combatant(
    gladiator({ weapon: 5, speed: 20, weapon_min_damage: undefined, weapon_max_damage: undefined }),
    { id: "derived" }
  ), "or derive it");

  // And NO promoted golden can reach this branch: none states a weapon id.
  // (Asserted in `test/ss2-golden-resolver-replay.test.js`'s own fixtures; the
  // point here is that the refusal is scoped to a contradiction, not to
  // `derive: false` itself.)
});

test("the arena clamp bounds a walk, and a step it swallows is still a resolved action", () => {
  const battle = createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator(), { id: "hero", x: SS2_ARENA.clamp.min })] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "villain", x: 250 })] }
    ]
  });
  applyAction(battle, { actorId: "hero", type: Ss2ActionType.WALK_LEFT, targetId: "hero" });
  const hero = combatantById(battle, "hero");
  assert.equal(hero.x, SS2_ARENA.clamp.min, "`nextphase` step 1 clamps the active x before anything else");

  const walked = battle.events.at(-1);
  assert.equal(walked.from, SS2_ARENA.clamp.min);
  assert.equal(walked.to, SS2_ARENA.clamp.min, "walking into the wall is a real turn that goes nowhere");
  assert.ok(walked.staminaGained !== undefined, "and it still paid and regenerated like any phase");
});

test("a POSITION effect is absolute, and a rule set that models no position cannot emit one", () => {
  const battle = bout(1);
  const id = actorId(battle);
  const from = combatantById(battle, id).x;
  applyAction(battle, { actorId: id, type: Ss2ActionType.WALK_RIGHT, targetId: id });
  const move = battle.lastResolution.effects.find((effect) => effect.kind === EffectKind.POSITION);
  assert.ok(move, "the walk must have emitted one, or the rest of this proves nothing");
  assert.equal(move.to, from + 108, "absolute, never a delta: a coordinate, not a distance");
  // Not a literal 206: whichever SIDE opens, it started on the vanilla mark and
  // moved one authored step in the +x direction. Asserting 206 assumed the hero
  // always goes first, and with both slot-0 gladiators on the same speed the
  // tie-break decides — so the first version of this line failed on blue's 294.
  assert.equal(Math.abs(from), SS2_ARENA.frontX, "the actor started on the vanilla mark");
  assert.equal(Object.hasOwn(move, "by"), false, "for the same reason RESOURCE writes `to` and not `by`");

  // A fixture models no geometry, so it is never offered a walk — and asking
  // for one anyway is refused by name rather than silently moving a null.
  const replay = createSs2TeamRules({ fixtureReplay: true });
  const fixture = createTeamBattle({
    seed: 1,
    rules: replay,
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator(), { id: "hero" })] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "villain" })] }
    ]
  });
  assert.equal(typesOf(fixture).includes("walk-left"), false);
  assert.throws(
    () => applyAction(fixture, { actorId: "hero", type: Ss2ActionType.WALK_LEFT, targetId: "hero" }),
    (error) => error instanceof Error && /Illegal action|needs a position/.test(error.message)
  );
});

/* ------------------------------------------------------------------ */
/* The approach, end to end                                            */
/* ------------------------------------------------------------------ */

test("the AI closes the distance and every bout still settles, at 1v1, 2v2 and 3v3", () => {
  // THE COST OF THE APPROACH, MEASURED RATHER THAN ARGUED — and the measurement
  // MOVED when the displacement stopped being authored, which is the reason
  // this comment carries both columns.
  //
  //                                  flat 44   derived
  //   1v1 walks / actions            37.0%      19.0%
  //   2v2                            45.8%      24.6%
  //   3v3                            52.2%      26.8%
  //   3v3 actions before first blow     35         17
  //
  // Swept over these same 8 seeds a side on 2026-09-11, before and after.
  // **"53% of a 3v3 is walking" was ranked as a PACING DECISION for the owner,
  // with `SS2_ARENA.frontX` and the walk distance named as the two levers. Half
  // of it was a wrong number**: `movement_speed` 8 walks 108, not 44, so the
  // flat constant had gladiators crossing the arena at a quarter of the build's
  // own pace. What is left after the derivation is a real design question and a
  // much smaller one.
  const WALKS = new Set([Ss2ActionType.WALK_LEFT, Ss2ActionType.WALK_RIGHT]);
  for (const perSide of [1, 2, 3]) {
    let settled = 0;
    let sweptWalks = 0;
    let sweptActions = 0;
    for (let seed = 1; seed <= 8; seed += 1) {
      const battle = bout(perSide, seed);
      let guard = 0;
      while (!battle.result && guard < 1200) {
        guard += 1;
        const actor = currentCombatant(battle);
        if (!actor) break;
        const options = legalActions(battle);
        if (options.length === 0) break;
        const view = {
          turnNumber: battle.turnNumber,
          actor: { ...actor },
          allies: [],
          foes: battle.teams.flatMap((team) => team.combatants)
            .filter((combatant) => combatant.teamId !== actor.teamId && combatant.alive)
            .map((combatant) => ({ ...combatant }))
        };
        const chosen = battle.rules.chooseAiAction(view, actor.id, options);
        const before = battle.events.length;
        applyAction(battle, { ...chosen, actorId: actor.id });
        if (WALKS.has(battle.events[before]?.type)) sweptWalks += 1;
        sweptActions += 1;
      }
      if (battle.result) settled += 1;
    }
    assert.equal(settled, 8, `${perSide}v${perSide}: every bout must settle, approach and all`);
    assert.ok(sweptWalks > 0, `${perSide}v${perSide}: the sweep must have found walks, or it proves nothing`);
    assert.ok(
      sweptWalks < sweptActions,
      `${perSide}v${perSide}: and it must have found fighting too — ${sweptWalks} walks of ${sweptActions}`
    );
  }
});

test("the AI takes a step without declaring a damage pair, because crossing the arena needs none", () => {
  // The forced-rest gate and the melee ranking both build the ATTACKER record,
  // which demands `min_damage`/`max_damage`. A gladiator still walking toward
  // the fight must not have to state what it hits for — so the close is chosen
  // BEFORE that record is built.
  const source = ss2Combatant(gladiator(), { id: "hero", name: "Hero" });
  delete source.resources.min_damage;
  delete source.resources.max_damage;
  const battle = createTeamBattle({
    seed: 1,
    rules: ss2TeamRules,
    teams: [
      { id: "red", combatants: [source] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "villain" })] }
    ]
  });
  const options = legalActions(battle);
  assert.equal(options.some((option) => /attack$/.test(option.type)), false, "out of range: no verb to rank");
  const view = {
    turnNumber: battle.turnNumber,
    actor: { ...combatantById(battle, "hero") },
    allies: [],
    foes: [{ ...combatantById(battle, "villain") }]
  };
  const chosen = battle.rules.chooseAiAction(view, "hero", options);
  assert.match(chosen.type, /^walk-/, "it closes rather than throwing over a pair it does not need");
});

/* ------------------------------------------------------------------ */
/* The seam to the presentation half                                   */
/* ------------------------------------------------------------------ */

test("a resolved walk carries the build's own phase name, which is the field presentation cannot derive", () => {
  // ► **THIS IS THE JOIN BETWEEN THE TWO HALVES.** `from` and `to` give the
  //   direction and never the GAIT, so `SS2_STATIC_MAP_BINDINGS` reports a
  //   movement event that does not name its phase instead of guessing one. The
  //   rule set supplies the name, in the build's own spelling — `walkleft`
  //   `+0x3b37`, `walkright` `+0x3d16`, one word, no underscore.
  for (const [type, label] of [
    [Ss2ActionType.WALK_LEFT, "walkleft"],
    [Ss2ActionType.WALK_RIGHT, "walkright"]
  ]) {
    const battle = bout(1);
    const id = actorId(battle);
    applyAction(battle, { actorId: id, type, targetId: id });
    const event = battle.events.at(-1);
    assert.equal(event.type, type);
    assert.equal(event.vanillaLabel, label);
    assert.equal(VANILLA_PHASE_LABEL[type], label, "and the table is where it comes from");
  }
});

test("a walk reaches the arena as a move-clip and its own gait, never as the idle clip", () => {
  // The whole point of the ordering: presentation first, resolver second.
  // Before the bindings had a movement case this emitted `clip-goto Standing`
  // — the idle clip — plus a spurious `unmapped`.
  const battle = bout(1);
  const id = actorId(battle);
  const from = combatantById(battle, id).x;
  applyAction(battle, { actorId: id, type: Ss2ActionType.WALK_RIGHT, targetId: id });

  const wire = toTeamWireState(battle);
  const layout = buildArenaLayout(wire);
  const { commands } = presentResolvedEvents(wire, { layout, bindings: SS2_STATIC_MAP_BINDINGS });

  const clips = commands.filter((command) => command.kind === CommandKind.CLIP_GOTO);
  assert.deepEqual(
    clips.map((command) => [command.role, command.label, command.labelProvenance]),
    [["actor", "walkright", LabelProvenance.ASSUMED]]
  );
  assert.deepEqual(commands.filter((command) => command.kind === CommandKind.UNMAPPED), []);

  const moves = commands.filter((command) => command.kind === CommandKind.MOVE_CLIP);
  assert.equal(moves.length, 1);
  assert.deepEqual([moves[0].from, moves[0].to], [from, from + 108]);

  // And it reaches a scene as a step, with a gait that travels.
  const scene = applyCommands(emptyScene(), commands);
  assert.equal(scene.actors[id].x, from + 108);
  assert.deepEqual({ ...scene.actors[id].motion }, { from, to: from + 108, sequence: 1, actionToken: null });
  assert.equal(timelineFor("walkright", { role: "actor" }).travel, true);
});

test("the projection carries x, so two peers that disagree about where a gladiator stands disagree on the hash", () => {
  // The soundness invariant `combatantView` states: every field a rule set can
  // read is in the projection, and therefore inside `combatStateHash`. Position
  // gates which actions are legal, so a hash blind to it would let two peers
  // agree and then offer different vocabularies on the next turn.
  const left = bout(1);
  const right = bout(1);
  assert.equal(combatStateHash(left), combatStateHash(right), "identical battles agree");

  combatantById(right, "red-1").x -= SS2_ARENA.walkDistanceAtSpeedFloor;
  assert.notEqual(combatStateHash(left), combatStateHash(right), "and one step apart is a visible disagreement");
});

test("a walk is refused for a combatant whose rule set gave it no position, by name", () => {
  const replay = createSs2TeamRules({ fixtureReplay: true });
  const battle = createTeamBattle({
    seed: 1,
    rules: replay,
    teams: [
      { id: "red", combatants: [ss2Combatant(gladiator(), { id: "hero" })] },
      { id: "blue", combatants: [ss2Combatant(gladiator({ gladiator_dir: "left" }), { id: "villain" })] }
    ]
  });
  // Straight at the rule set, past `legalActions`, so the refusal is the rule
  // set's own and not the resolver's legality check.
  assert.throws(
    () => replay.resolveAction({
      type: Ss2ActionType.WALK_LEFT,
      actorId: "hero",
      targetId: "hero",
      actor: combatantById(battle, "hero"),
      target: combatantById(battle, "hero"),
      turnNumber: 1
    }, { randomBetween: () => 0, randomNumber: () => 0 }),
    (error) => error instanceof TeamRuleSetError && /models no geometry/.test(error.message)
  );
});
