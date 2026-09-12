/**
 * The instrument's own two metrics.
 *
 * ► **`tools/engagement-census.mjs` HAD NO TEST UNTIL 2026-09-12**, which made
 *   it the one artefact in this repository whose numbers justify a design and
 *   which nothing could catch being wrong. Found by an agent asked what the
 *   census measures; the answer was "four things, and it quotes two more it
 *   does not compute".
 *
 * These are the two it did not compute. They are unit tests over synthetic
 * gladiators rather than a sweep, because a sweep is 90 seconds and the thing
 * worth pinning is the DEFINITION, not the roster: "how many separate fights"
 * and "has anybody got past anybody" are exactly the claims a second axis is
 * supposed to move, so a wrong definition would report success.
 *
 * `ss2Reach` on a gladiator declaring no `weapon_range` is
 * `physical_size + 44` = `80 + round(strength / 1.5) + 44`, so strength 9
 * reaches 130. Every fighter below is strength 9 unless it is making a point
 * about reach.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { simultaneousFights, anyCrossing } from "../tools/engagement-census.mjs";

const fighter = (id, teamId, x, { strength = 9, y } = {}) => ({
  id,
  teamId,
  x,
  ...(y === undefined ? {} : { y }),
  alive: true,
  stats: { strength }
});

test("a gladiator standing alone is not a fight", () => {
  // The whole point of counting components over EDGES rather than over bodies.
  // Counting bodies would call six separated gladiators six fights, which is
  // the opposite of what the metric is for.
  assert.equal(simultaneousFights([]), 0);
  assert.equal(simultaneousFights([fighter("red-1", "red", 0)]), 0);
  assert.equal(
    simultaneousFights([fighter("red-1", "red", 0), fighter("blue-1", "blue", 3000)]),
    0,
    "two gladiators a mile apart are not fighting"
  );
});

test("two gladiators inside reach are one fight, and allies never form one", () => {
  assert.equal(
    simultaneousFights([fighter("red-1", "red", 0), fighter("blue-1", "blue", 100)]),
    1
  );
  // Reach is 130 and the gate is a strict `<`, matching `legalActions`.
  assert.equal(
    simultaneousFights([fighter("red-1", "red", 0), fighter("blue-1", "blue", 130)]),
    0,
    "exactly at reach is out of reach, as the build has it"
  );
  assert.equal(
    simultaneousFights([fighter("red-1", "red", 0), fighter("red-2", "red", 10)]),
    0,
    "two allies standing together are not a fight"
  );
});

test("a brawl is ONE fight however many are in it — the 3v3 case", () => {
  // This is today's measured 3v3: everybody converges on one interface. The
  // metric must report 1, not 3 and not 9, or the before-picture is wrong.
  const pile = [
    fighter("red-1", "red", -40), fighter("red-2", "red", -30), fighter("red-3", "red", -20),
    fighter("blue-1", "blue", 20), fighter("blue-2", "blue", 30), fighter("blue-3", "blue", 40)
  ];
  assert.equal(simultaneousFights(pile), 1);
});

test("two engagements far apart are TWO fights — the number a second axis has to move", () => {
  // Nothing in the one-dimensional model can produce this state, which is the
  // finding. The metric is pinned here anyway, because a metric that cannot
  // report the outcome it exists to detect would report success forever.
  const split = [
    fighter("red-1", "red", -1000), fighter("blue-1", "blue", -950),
    fighter("red-2", "red", 1000), fighter("blue-2", "blue", 1050)
  ];
  assert.equal(simultaneousFights(split), 2);

  // Three separate duels.
  const three = [
    fighter("red-1", "red", -1000), fighter("blue-1", "blue", -950),
    fighter("red-2", "red", 0), fighter("blue-2", "blue", 50),
    fighter("red-3", "red", 1000), fighter("blue-3", "blue", 1050)
  ];
  assert.equal(simultaneousFights(three), 3);
});

test("a chain through a shared opponent is one fight, not two", () => {
  // red-1 and red-2 are both engaged with blue-1 but far from each other. That
  // is one fight with three people in it — the union-find is what makes the
  // difference, and a naive pair count would say 2.
  const chain = [
    fighter("red-1", "red", -100),
    fighter("blue-1", "blue", 0),
    fighter("red-2", "red", 100)
  ];
  assert.equal(simultaneousFights(chain), 1);
});

test("engagement is the UNION of the two reaches, so a longer weapon still makes a fight", () => {
  // `ss2Reach` is per-actor. A fighter who can be struck without striking back
  // is still in a fight, so the gate is max(reachA, reachB), not min.
  const spear = { ...fighter("red-1", "red", 0), resources: { weapon_range: { value: 400 } } };
  const fists = fighter("blue-1", "blue", 300);
  assert.equal(simultaneousFights([spear, fists]), 1, "300 < 400, so the spear engages");
});

test("crossings are counted against the side that starts on the left", () => {
  // Team 0 starts at negative x (`startingPosition`), so a red standing right
  // of a blue can only have got there by crossing.
  const opening = [fighter("red-1", "red", -250), fighter("blue-1", "blue", 250)];
  assert.equal(anyCrossing(opening, "red"), false);

  const crossed = [fighter("red-1", "red", 300), fighter("blue-1", "blue", 250)];
  assert.equal(anyCrossing(crossed, "red"), true);

  // ANY red past ANY blue counts, not all of them.
  const one = [
    fighter("red-1", "red", -250), fighter("red-2", "red", 300),
    fighter("blue-1", "blue", 250)
  ];
  assert.equal(anyCrossing(one, "red"), true);

  // Equal x is not a crossing: the strict `>` matches the walk clamp, which
  // parks a walker AT the line and never past it.
  const level = [fighter("red-1", "red", 250), fighter("blue-1", "blue", 250)];
  assert.equal(anyCrossing(level, "red"), false);
});

test("the second axis is visible to both metrics, which is why they can report it", () => {
  // `ss2FightDistance` is the build's own hypotenuse, so two gladiators level
  // in x but far apart in y are NOT engaged — and that is the mechanism by
  // which a second axis produces a second fight.
  const level = [fighter("red-1", "red", 0, { y: 0 }), fighter("blue-1", "blue", 100, { y: 0 })];
  assert.equal(simultaneousFights(level), 1);

  const apart = [fighter("red-1", "red", 0, { y: 0 }), fighter("blue-1", "blue", 100, { y: 300 })];
  assert.equal(simultaneousFights(apart), 0, "same x, 300 apart in y: out of reach");

  // Two duels separated ONLY by y. In one dimension this state is
  // unreachable; the metric must nonetheless count it as two.
  const lanes = [
    fighter("red-1", "red", 0, { y: 0 }), fighter("blue-1", "blue", 100, { y: 0 }),
    fighter("red-2", "red", 0, { y: 600 }), fighter("blue-2", "blue", 100, { y: 600 })
  ];
  assert.equal(simultaneousFights(lanes), 2);
});
