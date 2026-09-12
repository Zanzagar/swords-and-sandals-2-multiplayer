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
  legalActions,
  toTeamWireState
} from "../src/team/index.js";
import { EffectKind, TeamRuleSetError } from "../src/team/rule-set.js";
import {
  createSs2TeamRules,
  ss2Combatant,
  ss2FightDistance,
  ss2MovementSpeed,
  ss2Reach,
  ss2WalkDisplacement,
  ss2TeamRules,
  SS2_ARENA,
  Ss2ActionType,
  VANILLA_PHASE_LABEL
} from "../src/team/ss2-rules.js";
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

const typesOf = (battle) => legalActions(battle).map((option) => option.type);

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
  // STRICT `<`, and `weapon_range` for an unarmed gladiator is `physical_size`
  // = 80 + round(strength / 1.5) (`+0x30f1`, `ss2-item-tables.md:58`).
  const reach = ss2Reach({ stats: { strength: 9 } });
  assert.equal(reach, 86, "80 + round(9 / 1.5)");

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

test("a walk may never carry a gladiator PAST a foe, which is the build's own clamp", () => {
  // `walkright` `+0x3de6`: the destination is clipped when it would cross the
  // defender. The build clips to `defender._x - game_defender.physical_size`;
  // this resolver clips to `defender._x`, and `ss2WalkDestination`'s docstring
  // carries the measurement that forced the difference.
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
  assert.equal(combatantById(battle, "hero").x, 250, "the clamp stopped it AT the foe, not 440 beyond it");

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
