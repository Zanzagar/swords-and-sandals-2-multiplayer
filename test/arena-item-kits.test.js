/**
 * The arena's `?items=` kits (`tools/arena/roster.js`, 2026-09-23): the demo
 * roster's slots are EMPTY (the build's marker, 1) unless a kit is asked for,
 * so the roster every existing test and tool builds is unchanged.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_ITEM_KITS, demoItemsFrom, demoSide } from "../tools/arena/roster.js";
import { ss2BattleValues, ss2Combatant } from "../src/team/ss2-rules.js";

const build = (items) => demoSide("red", 2, { ss2Combatant, ss2BattleValues, ...(items ? { items } : {}) });
const slots = (member) => [1, 2, 3, 4, 5, 6].map((n) => member.vanilla[`inventory${n}`]);

test("no kit is the roster as it always was: six empty slots", () => {
  assert.deepEqual(demoItemsFrom(null), []);
  assert.deepEqual(demoItemsFrom(""), []);
  for (const member of build().members) assert.deepEqual(slots(member), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(build([]).members.map(slots), build().members.map(slots));
});

test("a kit fills the six slots in order, for every member", () => {
  const items = demoItemsFrom("tricks");
  assert.deepEqual(items, [...DEMO_ITEM_KITS.tricks]);
  for (const member of build(items).members) assert.deepEqual(slots(member), items);
});

test("kits and ids mix, and only the first six are kept", () => {
  assert.deepEqual(demoItemsFrom("42,blasts"), [42, 34, 35, 30, 31, 32]);
  assert.deepEqual(demoItemsFrom("43"), [43]);
});

test("a typo is refused loudly, and 1 (the EMPTY marker) is not an item", () => {
  assert.throws(() => demoItemsFrom("buff"), /neither a kit/);
  assert.throws(() => demoItemsFrom("1"), /EMPTY marker/);
  assert.throws(() => demoItemsFrom("4.5"), /neither a kit/);
});
