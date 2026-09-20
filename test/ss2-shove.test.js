/**
 * `shove` — a real SS2 player verb this engine had no representation of.
 *
 * ## WHAT IS THE BUILD'S AND WHAT IS THIS ENGINE'S
 *
 * **Almost all of it is the build's**, and it was derived from the oracle for
 * this commit rather than read out of the map, which carried only two rows: the
 * stamina cost (`:1345`) and the force (`:2294`). The whole phase, from the
 * block at `sprite:862[overlay]/frame:52` of the build whose sha256 is
 * `77CB545C…`:
 *
 * ```text
 *   game_attacker.staminacost = round(strength * 1.5)             +0x5dd3
 *   if (attacker.shove != true) {                                 +0x5e00
 *     attacker.shove = true; attacker.gotoAndPlay("shove")        +0x5e19
 *     if (attacker.gladiator_dir == "right") {                    +0x5e3b
 *       force = strength * 12                                     +0x5e53
 *       force_bonus = get_percentage(100 + gauntlet * 2, 100)     +0x5e6b
 *       force = add_percentage(force, force_bonus)                +0x5e99
 *       if (force < 20) force = 20                                +0x5eb3
 *       if (force > 100) defender.gotoAndPlay("knockback")        +0x5ed3
 *     } else { … force = 0 - force … }                            +0x5f01
 *     knockback(defender, force)                                  +0x5fc9
 *   }
 *   if (attacker.struck == true) { … nextphase() }                +0x5fd5
 * ```
 *
 * **THIS ENGINE'S, and invented:** that it is refused when the rule set models
 * no position, and that the AI never chooses it. Both are argued at their site.
 *
 * ## THE HEADLINE: IT TAKES NO SAMPLE AND DEALS NO DAMAGE
 *
 * Counted over `+0x5dcd`…`+0x6007`: **zero `randomBetween`, zero
 * `Math.random`, zero `checkattackroll`, zero `hitpoints`.** `taunt` stayed
 * deferred for a month because a candidate implementing only part of its phase
 * would take the dispatcher's samples on every press where the build takes them
 * on one outcome in four. **A shove has no such hazard**, and that is why it
 * returns before the band table rather than being unwound inside it.
 *
 * ## THE ARGUMENT ORDER THAT DECIDED WHETHER A GAUNTLET HELPS
 *
 * `get_percentage(a, b) = (a / b) * 100` and `add_percentage(a, b) =
 * ceil(a * b / 100)`, `a` in register 2 and `b` in register 1 — from the
 * `DefineFunction2` headers, because reading the bodies alone inverses both.
 * Which pushed value is `a` was settled against the WALK's `walk_bonus` at
 * `+0x3ba3`, a byte-for-byte identical call shape this repository had already
 * derived and checked with six verifiers. **Had it gone the other way a
 * gauntlet would have WEAKENED the shove.**
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction, combatantById, createTeamBattle, currentCombatant, legalActions, suggestAction
} from "../src/team/index.js";
import {
  SS2_ARENA, SS2_SHOVE, Ss2ActionType, createSs2TeamRules, ss2Combatant, ss2ShoveForce, ss2TeamRules
} from "../src/team/ss2-rules.js";

const fields = (o = {}) => ({
  strength: 9, speed: 20, attack: 8, defence: 5, vitality: 6, stamina: 6,
  magicka: 0, charisma: 6, herolevel: 5, character_level: 5, weapon: 1, gauntlet: 1, ...o
});

function staged({ hero = {}, foe = {}, heroX = -60, foeX = 60, rules = ss2TeamRules } = {}) {
  const battle = createTeamBattle({
    seed: 3, rules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields(hero), { id: "hero", name: "hero", controller: "local" })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: "left", ...foe }), { id: "foe", name: "foe", controller: "local" })] }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: heroX, y: 200 });
  Object.assign(combatantById(battle, "foe"), { x: foeX, y: 200 });
  return battle;
}

const typesFor = (battle, id) => legalActions(battle, id).map((option) => option.type);

/* ------------------------------------------------------------------ *
 * THE FORCE
 * ------------------------------------------------------------------ */

test("THE FORCE IS `strength * 12` BOOSTED BY THE GAUNTLET, and the gauntlet HELPS", () => {
  // ► **THE ASSERTION THE WHOLE DERIVATION TURNED ON.** `add_percentage` is
  //   `ceil(a * b / 100)` with the bonus as `b`, so a gauntlet multiplies:
  //   9 * 12 = 108, bonus 100 + 2 * 1 = 102, ceil(108 * 102 / 100) = 111.
  const battle = staged();
  assert.equal(ss2ShoveForce(combatantById(battle, "hero")), 111);

  // Every point of gauntlet is worth 2% and it is monotonic, which is what
  // distinguishes this reading from the inverted one.
  const forces = [0, 1, 5, 20].map((gauntlet) =>
    ss2ShoveForce(combatantById(staged({ hero: { gauntlet } }), "hero")));
  assert.deepEqual(forces, [108, 111, 119, 152]);
  for (let i = 1; i < forces.length; i += 1) {
    assert.ok(forces[i] > forces[i - 1], "a better gauntlet must never shove less far");
  }
});

test("THE SIGN IS THE ATTACKER'S FACING, which is the taunt's rule and NOT `damagecharacter`'s", () => {
  // `damagecharacter` signs on the DEFENDER (`+0x1ae9`); this signs on the
  // attacker (`+0x5e3b`). Three of the four `knockback` call sites disagree
  // about this, so it is read per site rather than generalised — the finding
  // that made `knockback` worth decoding at all.
  const battle = staged();
  assert.ok(ss2ShoveForce(combatantById(battle, "hero")) > 0, "facing right shoves right");
  assert.ok(ss2ShoveForce(combatantById(battle, "foe")) < 0, "facing left shoves left");
});

test("THE FLOOR IS 20 AND IT IS APPLIED AFTER THE BOOST, not before", () => {
  // `+0x5eb3` follows `+0x5e99`. A feeble gladiator with a good gauntlet still
  // floors at 20 rather than flooring first and then being multiplied up.
  const feeble = staged({ hero: { strength: 1, gauntlet: 0 } });
  assert.equal(ss2ShoveForce(combatantById(feeble, "hero")), SS2_SHOVE.minimumForce);

  const feebleArmoured = staged({ hero: { strength: 1, gauntlet: 20 } });
  assert.equal(
    ss2ShoveForce(combatantById(feebleArmoured, "hero")),
    SS2_SHOVE.minimumForce,
    "12 * 140% is 17, still under the floor — a boost-then-floor order gives 20, floor-then-boost gives 28"
  );
});

/* ------------------------------------------------------------------ *
 * WHAT IT DOES
 * ------------------------------------------------------------------ */

test("IT MOVES A BODY, COSTS STAMINA AND DEALS NO DAMAGE", () => {
  const battle = staged();
  const who = currentCombatant(battle).id;
  const target = who === "hero" ? "foe" : "hero";
  const before = combatantById(battle, target).x;
  const health = combatantById(battle, target).health;

  applyAction(battle, { actorId: who, type: Ss2ActionType.SHOVE, targetId: target });
  const event = battle.events.at(-1);

  assert.equal(event.type, Ss2ActionType.SHOVE);
  assert.equal(event.vanillaLabel, "shove");
  assert.equal(combatantById(battle, target).x, before + event.force, "the body moved by exactly the force");
  assert.equal(combatantById(battle, target).health, health, "and lost no hitpoints at all");
  assert.equal(event.staminaSpent, Math.round(9 * SS2_SHOVE.staminaCostFactor));
});

test("THE DISPLACEMENT IS UNCONDITIONAL AND ONLY THE CLIP IS GATED", () => {
  // The same shape `damagecharacter` and `taunt` have: `knockback(defender,
  // force)` at `+0x5fc9` runs whenever the arm is entered, while
  // `defender.gotoAndPlay("knockback")` needs `|force| > 100`.
  const strong = staged();
  // ► **BOTH SIDES WEAK, because the actor is whoever initiative gives the
  //   turn to.** The first cut weakened only `hero` and the staging handed the
  //   turn to `foe`, so the "weak" case measured a strength-9 gladiator and
  //   asserted it was under the threshold. A test that does not control who
  //   acts is testing the initiative order.
  const weak = staged({ hero: { strength: 1, gauntlet: 0 }, foe: { strength: 1, gauntlet: 0 } });
  for (const [battle, animated] of [[strong, true], [weak, false]]) {
    const who = currentCombatant(battle).id;
    const target = who === "hero" ? "foe" : "hero";
    const before = combatantById(battle, target).x;
    applyAction(battle, { actorId: who, type: Ss2ActionType.SHOVE, targetId: target });
    const event = battle.events.at(-1);
    assert.notEqual(combatantById(battle, target).x, before, "the body moves either way");
    assert.equal(
      event.knockbackAnimation,
      Math.abs(event.force) > SS2_SHOVE.knockbackAnimationForce,
      "and the CLIP is what the threshold gates"
    );
    assert.equal(event.knockbackAnimation, animated);
  }
});

test("IT IS CLAMPED TO THE ARENA, because `knockback` itself bounds nothing", () => {
  // `knockback(clip, force)` is `_x + force` with no clamp, no arena edge and
  // no body check in its own 155 bytes. The bound that really applies is the
  // near-identical copy inside `attacker.onEnterFrame` acting on the CLIPS.
  //
  // ► **THE TARGET IS PLACED AFTER THE ACTOR IS KNOWN, and the first cut was
  //   not.** It staged both near the right edge and asserted the result was
  //   inside the arena — which passes whether or not anything is clamped,
  //   because the shove never reached the wall. A mutation that deleted the
  //   clamp SURVIVED it. The edge has to be in the direction the actor
  //   actually pushes, and the assertion has to be equality with the wall.
  const battle = staged();
  const who = currentCombatant(battle).id;
  const target = who === "hero" ? "foe" : "hero";
  const force = ss2ShoveForce(combatantById(battle, who));
  const wall = force > 0 ? SS2_ARENA.clamp.max : SS2_ARENA.clamp.min;
  // ► **BOTH MOVE, KEEPING THEM ENGAGED.** Placing only the target at the wall
  //   put it out of melee reach and `applyAction` refused the shove as an
  //   illegal action — a second staging error in the same test, and a useful
  //   one: the shove is offered by the CLOSE frame, so the pair has to stay
  //   inside a reach of about 130 for the verb to exist at all.
  const step = Math.sign(force);
  Object.assign(combatantById(battle, target), { x: wall - step });
  Object.assign(combatantById(battle, who), { x: wall - step * 61 });

  applyAction(battle, { actorId: who, type: Ss2ActionType.SHOVE, targetId: target });
  assert.equal(
    combatantById(battle, target).x,
    wall,
    "a shove into the wall stops AT the wall rather than passing through it"
  );
  assert.equal(battle.events.at(-1).to, wall, "and the event reports the clamped landing, not the raw sum");
});

test("IT TAKES NO RNG SAMPLE, which is what a peer replaying the same tape depends on", () => {
  // ► **THE PROPERTY THAT LET THIS SHIP IN AN AFTERNOON WHERE `taunt` TOOK A
  //   MONTH.** The phase has no `randomBetween` and never reaches
  //   `checkattackroll`, so a shove must move the ordered channel by nothing.
  //   Measured against a control that DOES draw.
  const battle = staged();
  const who = currentCombatant(battle).id;
  const target = who === "hero" ? "foe" : "hero";
  const before = battle.rng.cursor;
  applyAction(battle, { actorId: who, type: Ss2ActionType.SHOVE, targetId: target });
  assert.equal(battle.rng.cursor, before, "a shove draws nothing");

  const control = staged();
  const actor = currentCombatant(control).id;
  const foe = actor === "hero" ? "foe" : "hero";
  const at = control.rng.cursor;
  applyAction(control, { actorId: actor, type: Ss2ActionType.QUICK_ATTACK, targetId: foe });
  assert.ok(control.rng.cursor > at, "the control must draw, or this test proves nothing");
});

/* ------------------------------------------------------------------ *
 * WHO IS OFFERED IT
 * ------------------------------------------------------------------ */

test("BOTH CLOSE-RANGE FRAMES WIRE IT AND NEITHER LONG-RANGE ONE DOES", () => {
  // Map `:225`-`:230`: `closerange_warrior` and `closerange_archer` in both
  // facings; nothing on frames 5 and 20. It is the taunt's gate inverted —
  // one is what you do when you cannot reach him, the other when you can.
  assert.ok(typesFor(staged(), "hero").includes(Ss2ActionType.SHOVE), "in reach, it is offered");
  assert.ok(
    !typesFor(staged({ heroX: -700, foeX: 700 }), "hero").includes(Ss2ActionType.SHOVE),
    "out of reach it is not, and the taunt is offered there instead"
  );
});

test("A RULE SET WITH NO POSITION IS NOT OFFERED IT, and the melee verbs still are", () => {
  // ► **CAUGHT BY `test/ss2-position.test.js` REFUSING THE FIRST CUT, and it
  //   was right.** An attack RESOLVES from any distance — the build has no
  //   distance test in the phase — so a position-blind rule set offers all
  //   three. **A shove's entire outcome is the displacement**, so offering one
  //   with no positions is offering a button that spends stamina and does
  //   nothing. That is the finding an adversarial review made against the
  //   taunt's first cut: a convention that makes a NEW outcome inert is not a
  //   defence.
  const blind = createTeamBattle({
    seed: 3, rules: createSs2TeamRules({ fixtureReplay: true }),
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields(), { id: "hero", name: "hero", controller: "local" })] },
      { id: "blue", name: "blue", combatants: [ss2Combatant(fields({ gladiator_dir: "left" }), { id: "foe", name: "foe", controller: "local" })] }
    ]
  });
  const types = typesFor(blind, "hero");
  assert.equal(combatantById(blind, "hero").x, null, "the staging must model no position");
  assert.ok(types.includes(Ss2ActionType.QUICK_ATTACK), "an attack resolves from any distance");
  assert.ok(!types.includes(Ss2ActionType.SHOVE), "a shove with nowhere to push does not");
});

test("THE AI NEVER CHOOSES IT, and that is a decision rather than an omission", () => {
  // ► **IT HAS NO DAMAGE TERM AT ALL**, so it cannot join the expected-damage
  //   table the melee ranking is built on, and `ss2TauntValue` already scores
  //   the TAUNT's shove arm at ZERO for a melee actor with an argument that
  //   applies here exactly: pushing a melee opponent out of reach costs the
  //   pusher its own reach too, so both sides spend the same walk getting back.
  //   **For a gladiator standing in melee range, shoving is strictly worse than
  //   swinging**, and an AI that did it would be worse at its own criterion.
  //
  //   It is a HUMAN verb: `closerange_warrior` wires it beside the three
  //   attacks, and a person may want the distance for reasons the damage table
  //   cannot express. Recorded here rather than left to be discovered, which is
  //   the lesson `psyche_up` taught when it shipped with a live population of
  //   zero and nobody had said so.
  let shoves = 0;
  let actions = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const battle = staged({ heroX: -60 - seed * 7, foeX: 60 + seed * 7 });
    for (let turn = 0; turn < 40; turn += 1) {
      const who = currentCombatant(battle);
      if (!who || battle.result) break;
      const chosen = suggestAction(battle, who.id);
      if (!chosen) break;
      actions += 1;
      if (chosen.type === Ss2ActionType.SHOVE) shoves += 1;
      applyAction(battle, { actorId: who.id, ...chosen });
    }
  }
  assert.ok(actions > 100, `only ${actions} actions; the sweep must exercise the AI`);
  assert.equal(shoves, 0, "the AI must not choose a verb with no damage term");
});

test("IT IS OFFERED PER FOE, NOT PER FRAME — the cross-lane defect, reintroduced and caught", () => {
  // ► **THE FIRST CUT LOOPED `view.foes` UNDER `onCloseFrame`**, which means
  //   "SOMEBODY is in reach" — so one nearby enemy unlocked a shove against
  //   every enemy on the field, in any lane, at any distance. **That is the
  //   defect the owner found by watching on 2026-09-18** (4,440 of 7,845 melee
  //   swings were cross-rank), reintroduced in a new verb three weeks later and
  //   caught by an adversarial review rather than by me.
  //
  //   The fix shares the melee verbs' own target set, so the two cannot
  //   disagree about who is in reach or which lane they are in.
  const battle = createTeamBattle({
    seed: 3, rules: ss2TeamRules,
    teams: [
      { id: "red", name: "red", combatants: [ss2Combatant(fields(), { id: "hero", name: "hero", controller: "local" })] },
      {
        id: "blue",
        name: "blue",
        combatants: [
          ss2Combatant(fields({ gladiator_dir: "left" }), { id: "near", name: "near", controller: "local" }),
          ss2Combatant(fields({ gladiator_dir: "left" }), { id: "far", name: "far", controller: "local" })
        ]
      }
    ]
  });
  Object.assign(combatantById(battle, "hero"), { x: 0, y: 200 });
  Object.assign(combatantById(battle, "near"), { x: 50, y: 200 });
  // Far AND in another lane: either alone should be disqualifying.
  Object.assign(combatantById(battle, "far"), { x: 500, y: 6 });

  const options = legalActions(battle, "hero");
  const shoved = options.filter((option) => option.type === Ss2ActionType.SHOVE).map((o) => o.targetId);
  const swung = options.filter((option) => option.type === Ss2ActionType.QUICK_ATTACK).map((o) => o.targetId);

  assert.deepEqual(swung, ["near"], "the staging must put exactly one foe in melee reach");
  assert.deepEqual(shoved, ["near"], "and a shove may name exactly the foes a swing may name");
});
