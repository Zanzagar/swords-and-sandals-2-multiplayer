/**
 * GOING ROUND a foe an ally is already fighting.
 *
 * ► **The owner watched a 2v1 and said the survivors "chose to stand behind
 *   the teammate rather than go on the other side of the opponent".** Measured
 *   over 24 bouts before this rule existed: **208 turns where one side was
 *   outnumbered two-to-one, and 100% of them had both attackers on the SAME
 *   SIDE.** A numbers advantage bought a queue, not a pincer.
 *
 * ► **AND IT WAS NEVER A GEOMETRY PROBLEM.** `ss2BodyBlocks` gates the walk
 *   clamp on `|dy| < physical_size(foe)`, so at the shipped stride of 97 a foe
 *   one rank away does not block. The far side was always legal to walk to;
 *   nothing wanted it.
 *
 * The rule these tests pin is deliberately narrow, because the WIDE version of
 * it is a known trap: "move toward the nearest foe's rank" collapses all six
 * gladiators into one rank at the opening, and the tell is that strides 97 and
 * 150 then return identical censuses. This arm cannot do that — it requires an
 * ally to be ALREADY in reach, which is false for everybody on turn one.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { ss2FlankingWalk, Ss2ActionType } from "../src/team/ss2-rules.js";

const WALKS = Object.freeze([
  { type: Ss2ActionType.WALK_LEFT },
  { type: Ss2ActionType.WALK_RIGHT }
]);

/** A combatant view with the handful of fields the rule reads. */
function who(id, x, y, extra = {}) {
  return {
    id, x, y, alive: true,
    resources: {
      physical_size: { value: 80, min: 0, max: null },
      weapon: { value: 0, min: 0, max: null },
      equipped_weapon: { value: 1, min: 0, max: null }
    },
    ...extra
  };
}

function viewOf(actor, allies, foes) {
  return { actor, allies: [actor, ...allies], foes };
}

test("with an ally already engaging from the near side, the actor walks PAST the target", () => {
  // Actor is a rank back and to the RIGHT of the target; the ally holds the
  // right too. So the far side is the left, and getting there means walking
  // toward and through.
  const target = who("blue-1", 0, 200);
  const ally = who("red-2", 90, 200);
  const actor = who("red-1", 300, 103);
  const walk = ss2FlankingWalk(viewOf(actor, [ally], [target]), target, WALKS);
  assert.equal(walk?.type, Ss2ActionType.WALK_LEFT, "toward the target, which is the way round");
});

test("in the target's OWN rank it returns nothing, because the clamp forbids passing", () => {
  // Same y: the build's walk clamp stops the actor at the target's body, so
  // there is no far side to reach and insisting would park it on the near one.
  const target = who("blue-1", 0, 200);
  const ally = who("red-2", 90, 200);
  const actor = who("red-1", 300, 200);
  assert.equal(ss2FlankingWalk(viewOf(actor, [ally], [target]), target, WALKS), null);
});

test("AT THE OPENING it returns nothing, which is what keeps the pile-up away", () => {
  // ► This is the condition that matters most. The rule that collapsed every
  //   gladiator into one rank fired when nothing was engaged; this one cannot,
  //   because no ally is in reach of anybody on turn one.
  const target = who("blue-1", 0, 200);
  const ally = who("red-2", 800, 200);
  const actor = who("red-1", 900, 103);
  assert.equal(ss2FlankingWalk(viewOf(actor, [ally], [target]), target, WALKS), null);
  // And with no ally at all.
  assert.equal(ss2FlankingWalk(viewOf(actor, [], [target]), target, WALKS), null);
});

test("if an ally ALREADY holds the far side, the pincer exists and a third body is a queue", () => {
  const target = who("blue-1", 0, 200);
  const near = who("red-2", 90, 200);
  const far = who("red-3", -90, 200);
  const actor = who("red-1", 300, 103);
  assert.equal(ss2FlankingWalk(viewOf(actor, [near, far], [target]), target, WALKS), null);
});

test("once PAST the target it returns nothing, so the rank arm can bring it in behind", () => {
  const target = who("blue-1", 0, 200);
  const ally = who("red-2", 90, 200);
  // Actor is already well to the left — the far side — and a rank back.
  const actor = who("red-1", -300, 103);
  assert.equal(ss2FlankingWalk(viewOf(actor, [ally], [target]), target, WALKS), null);
});

test("a co-located actor returns nothing rather than picking a side by rounding", () => {
  const target = who("blue-1", 0, 200);
  const ally = who("red-2", 90, 200);
  const actor = who("red-1", 0, 103);
  assert.equal(ss2FlankingWalk(viewOf(actor, [ally], [target]), target, WALKS), null);
});

test("with the second axis OFF every y is null, so the rule is INERT and no golden moves", () => {
  // `null === null` is true, so the same-rank guard returns first. This is why
  // the whole suite — 23 promoted goldens included — is untouched by this arm.
  const target = who("blue-1", 0, null);
  const ally = who("red-2", 90, null);
  const actor = who("red-1", 300, null);
  assert.equal(ss2FlankingWalk(viewOf(actor, [ally], [target]), target, WALKS), null);
});

test("a walk it cannot take is not invented", () => {
  const target = who("blue-1", 0, 200);
  const ally = who("red-2", 90, 200);
  const actor = who("red-1", 300, 103);
  // Only a right-walk on offer, but the way round is left.
  assert.equal(ss2FlankingWalk(viewOf(actor, [ally], [target]), target, [{ type: Ss2ActionType.WALK_RIGHT }]), null);
});
