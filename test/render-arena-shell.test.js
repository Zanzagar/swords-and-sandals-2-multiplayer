/**
 * The decisions the browser shell was making where no test could see them.
 *
 * ► **`tools/arena/main.js` has given up FIVE live defects in one day and the
 *   suite could not reach any of them.** It is a browser module — absolute URL
 *   imports, `document`, `Audio`, `requestAnimationFrame` — so node cannot load
 *   it at all. These are the two decisions that were logic rather than drawing,
 *   moved somewhere a test can hold them, plus the provenance sentence that
 *   lied for a commit.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ArenaShellError,
  figureProvenance,
  rankStrideFrom,
  retireVoices,
  selectRules
} from "../src/render/arena-shell.js";

const params = (query) => new URLSearchParams(query);

test("a MISSING ?rank is the shipped default; ?rank=0 is the flat game", () => {
  // ► The defect: `Number(params.get("rank")) || 0` made both 0, and 0 then
  //   selected the singleton — which IS the shipped 97 rule set. Asking for the
  //   one-dimensional game handed back the second axis.
  assert.equal(rankStrideFrom(params(""), 97), 97, "absent means the shipped default");
  assert.equal(rankStrideFrom(params("rank=0"), 97), 0, "explicit zero means FLAT");
  assert.equal(rankStrideFrom(params("rank=150"), 97), 150);
  assert.equal(rankStrideFrom(params("teams=3"), 97), 97, "another param is still absent");
});

test("a nonsense ?rank is the flat game, not a crash — it is a URL, not a config file", () => {
  assert.equal(rankStrideFrom(params("rank=banana"), 97), 0);
  assert.equal(rankStrideFrom(params("rank=-5"), 97), 0);
  assert.equal(rankStrideFrom(params("rank="), 97), 0);
  assert.equal(rankStrideFrom(null, 97), 97);
});

test("the SINGLETON is selected by the shipped value, never by zero", () => {
  // ► The same line was fixed in `tools/engagement-census.mjs` on 2026-09-12 and
  //   survived here until 2026-09-13, because nothing could test this file.
  //   The singleton is `createSs2TeamRules()` and carries whatever the default
  //   is, so comparing against 0 is correct only while the default IS 0.
  const singleton = { id: "the-shipped-one" };
  const create = ({ rankStride }) => ({ id: `fresh-${rankStride}` });

  assert.equal(selectRules(97, { shippedStride: 97, singleton, create }), singleton);
  assert.equal(selectRules(0, { shippedStride: 97, singleton, create }).id, "fresh-0",
    "zero must NOT resolve to the shipped rule set");
  assert.equal(selectRules(150, { shippedStride: 97, singleton, create }).id, "fresh-150");

  // And the historic case: when the default WAS zero, zero is the singleton.
  assert.equal(selectRules(0, { shippedStride: 0, singleton, create }), singleton);
  assert.throws(() => selectRules(0, { shippedStride: 0, singleton }), ArenaShellError);
});

test("finished voices are reclaimed before a live one is ever stopped", () => {
  // Stopping a playing sound to make room is audible; reclaiming a dead one is
  // not. So the dead go first, always.
  const dead = { ended: true };
  const paused = { paused: true };
  const live = [{}, {}, {}];
  const { keep, evict } = retireVoices([dead, live[0], paused, live[1]], 8);
  assert.deepEqual(keep, [live[0], live[1]]);
  assert.deepEqual(evict, [], "under the cap nothing live is stopped");
});

test("at the cap the OLDEST live voice is evicted, because the caller is about to add one", () => {
  const a = {}; const b = {}; const c = {};
  const { keep, evict } = retireVoices([a, b, c], 3);
  assert.deepEqual(evict, [a], "one slot is freed for the incoming voice");
  assert.deepEqual(keep, [b, c]);
  assert.equal(keep.length, 2, "so that keep.length + 1 === cap");
});

test("a cap of one keeps nothing, which is the OLD behaviour and is why sound was cut off", () => {
  // ► One `Audio` element per file WAS a cap of one, and the owner heard it:
  //   "sounds get cut off and dont play out". The build shares files across
  //   labels — `706.mp3` serves five — so the collisions were constant.
  const a = {}; const b = {};
  const { keep, evict } = retireVoices([a, b], 1);
  assert.deepEqual(keep, []);
  assert.deepEqual(evict, [a, b]);
});

test("retireVoices is total, because a malformed voice list must not stop the arena", () => {
  assert.deepEqual(retireVoices(null, 4), { keep: [], evict: [] });
  assert.deepEqual(retireVoices([], 4), { keep: [], evict: [] });
  assert.deepEqual(retireVoices([null, undefined], 4).keep, [], "a null voice counts as finished");
  const live = {};
  assert.deepEqual(retireVoices([live], 0).evict, [live], "a nonsense cap floors at one");
});

test("the provenance line is DERIVED, because it claimed authored art over the extracted rig", () => {
  const authored = figureProvenance({ hasExtractedArt: false });
  assert.match(authored, /original vector art/);
  assert.match(authored, /No SS2 asset ships/);
  assert.match(authored, /extract-figure/, "and it says how to change that");

  const naked = figureProvenance({ hasExtractedArt: true, wardrobePieces: 0 });
  assert.match(naked, /BUILD'S OWN/);
  assert.match(naked, /undressed/);
  assert.match(naked, /extract-wardrobe/);

  const dressed = figureProvenance({ hasExtractedArt: true, wardrobePieces: 387 });
  assert.match(dressed, /BUILD'S OWN/);
  assert.match(dressed, /387 extracted wardrobe piece/);
  // Whatever it says, it must never stop saying the repo ships nothing.
  for (const line of [authored, naked, dressed]) assert.match(line, /No SS2 asset ships in this repository/);
});
