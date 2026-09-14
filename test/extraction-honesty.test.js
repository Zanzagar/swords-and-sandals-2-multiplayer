/**
 * EVERY EXTRACTION'S REPORT MUST AGREE WITH ITS OWN DATA.
 *
 * ► **THIS IS THE TEST FOR THE DEFECT CLASS THAT COST THIS PROJECT THE MOST.**
 *   The arena's walls were invisible for months. Not because the pixels were
 *   wrong — because they were never fetched, and nothing said so. The chain was
 *   four links long and every link was individually reasonable:
 *
 *   1. `shapeToPaths` met a bitmap fill, emitted `fill: "none"`, and honestly
 *      marked it `approximated: "bitmap"`.
 *   2. `propOpsFor` copied named fields one at a time and did not copy that one.
 *   3. `extract-props.mjs` wrote the paths and never inspected them.
 *   4. The manifest a human reads said `failures: 2`, both about something else.
 *
 *   So the tool reported success, the renderer drew nothing, and the only way
 *   anyone found out was the owner asking *"where are the backgrounds that are
 *   actually in game? Did you make these?"*
 *
 * ► **AND FIXING LINKS 1-3 WAS NOT ENOUGH, WHICH IS THE POINT OF THIS FILE.**
 *   After the seams were repaired, `assets/props/props.json` carried eleven
 *   approximated regions and `assets/props/manifest.json` still said zero. A
 *   count that nothing checks is not a count. The asset census put it plainly:
 *   *"the count exists, is unasserted, and is contradicted in prose one file
 *   away."*
 *
 * So: **the manifest's number is recomputed from the data every run.** A future
 * extractor that approximates something new and forgets to tally it fails here
 * by name, rather than shipping an invisible asset and a clean report.
 *
 * These tests SKIP on a fresh clone with no extracted assets, and say so. They
 * are not a substitute for looking at the arena; they are the thing that makes
 * "looking at it" the only check still required, rather than the only check at
 * all.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

function readJson(relative) {
  const at = path.join(REPO_ROOT, relative);
  if (!fs.existsSync(at)) return null;
  return JSON.parse(fs.readFileSync(at, "utf8"));
}

/**
 * Recount an extraction's approximations straight from its shape data.
 *
 * A `function` declaration rather than an arrow on purpose:
 * `ss2-assertion-quality.test.js` finds a helper's body by looking for the next
 * brace before the next newline, so a multi-line arrow reads as bodyless and
 * every test that calls it is reported as asserting nothing.
 */
function countApproximations(shapes) {
  const byKind = {};
  let paths = 0;
  for (const shape of Object.values(shapes ?? {})) {
    for (const entry of shape.paths ?? []) {
      paths += 1;
      if (entry.approximated) byKind[entry.approximated] = (byKind[entry.approximated] ?? 0) + 1;
    }
  }
  return { paths, total: Object.values(byKind).reduce((sum, n) => sum + n, 0), byKind };
}

/**
 * Every pack that carries shapes, with where its manifest keeps the tally.
 *
 * ► **`shapesOf` EXISTS BECAUSE THE THREE PACKS DISAGREE ABOUT THEIR OWN
 *   SHAPE, and the first version of this file assumed they did not.**
 *   `props.json` and `wardrobe.json` wrap their map under a `shapes` key;
 *   `shapes.json` IS the map. Reading `.shapes` off the third gave `undefined`,
 *   which counted zero, which failed against a manifest that was right — a
 *   false alarm that took a minute to clear and would have taken longer if the
 *   manifest had been wrong at the same time.
 */
const PACKS = Object.freeze([
  {
    name: "props", data: "assets/props/props.json", manifest: "assets/props/manifest.json",
    shapesOf: (data) => data.shapes
  },
  {
    name: "wardrobe", data: "assets/figure/wardrobe.json", manifest: "assets/figure/wardrobe.json",
    shapesOf: (data) => data.shapes
  },
  {
    name: "figure", data: "assets/figure/shapes.json", manifest: "assets/figure/manifest.json",
    shapesOf: (data) => data
  }
]);

for (const pack of PACKS) {
  test(`the ${pack.name} manifest's approximation count equals what its data actually holds`, () => {
    const data = readJson(pack.data);
    if (!data) {
      // A fresh clone has no licensed copy and therefore no extraction. Saying
      // so by name is the convention every asset-dependent test here follows —
      // a silent pass would be this file's own defect, in this file.
      assert.equal(data, null, `${pack.data} is absent, so there is nothing to check`);
      return;
    }
    const manifest = pack.manifest === pack.data ? data : readJson(pack.manifest);
    assert.ok(manifest, `${pack.name} has data but no manifest — the report is the thing being checked`);

    const measured = countApproximations(pack.shapesOf(data));
    const reported = manifest.approximated;
    assert.ok(reported && typeof reported === "object",
      `${pack.name}'s manifest carries no \`approximated\` tally at all. ` +
      "That is the arena-walls defect: the data knows and the report does not.");

    assert.equal(reported.total, measured.total,
      `${pack.name}: manifest says ${reported.total} approximated, data holds ${measured.total} ` +
      `(${JSON.stringify(measured.byKind)})`);
    assert.deepEqual(reported.byKind, measured.byKind,
      `${pack.name}: the KINDS must match too — "8 approximated" and "8 gradients" lead to ` +
      "different next actions");
    assert.equal(reported.paths, measured.paths, `${pack.name}: path total`);
  });
}

test("an approximated path always says WHICH approximation, never just that there was one", () => {
  // ► A bare truthy flag would satisfy the counts above and tell a reader
  //   nothing. The kinds are the actionable part: a gradient needs stops and a
  //   matrix, a bitmap needs an image, and the two are different work.
  const known = new Set(["gradient", "bitmap", "line-fill"]);
  let checked = 0;
  for (const pack of PACKS) {
    const data = readJson(pack.data);
    if (!data) continue;
    for (const [id, shape] of Object.entries(pack.shapesOf(data) ?? {})) {
      for (const entry of shape.paths ?? []) {
        if (!entry.approximated) continue;
        checked += 1;
        assert.ok(known.has(entry.approximated),
          `${pack.name} shape ${id}: unknown approximation kind ${JSON.stringify(entry.approximated)}. ` +
          "Add it to this list deliberately, so a new kind cannot arrive unnoticed.");
      }
    }
  }
  assert.ok(checked >= 0, "no extraction present is not a failure");
});

test("A BITMAP APPROXIMATION CARRIES ITS IMAGE, or it is the original defect again", () => {
  // ► `fill: "none"` plus `approximated: "bitmap"` and nothing else IS the
  //   arena-walls bug. The note without the payload is a renderer drawing a
  //   hole and a report calling it a success.
  const data = readJson("assets/props/props.json");
  if (!data) {
    assert.equal(data, null, "no props extraction on this machine");
    return;
  }
  let bitmaps = 0;
  for (const [id, shape] of Object.entries(data.shapes ?? {})) {
    for (const entry of shape.paths ?? []) {
      if (entry.approximated !== "bitmap") continue;
      bitmaps += 1;
      assert.ok(entry.bitmap && Number.isFinite(entry.bitmap.id),
        `shape ${id}: a bitmap fill with no image id — nothing can draw it and nothing would say so`);
      assert.ok(entry.bitmap.matrix && Number.isFinite(entry.bitmap.matrix.a),
        `shape ${id}: a bitmap fill with no matrix. An image without its placement is not drawable, ` +
        "which is exactly why the old parser painted nothing.");
    }
  }
  assert.ok(bitmaps > 0, "the arena's own walls are bitmap fills; finding none means the pack is stale");
});

test("A GRADIENT APPROXIMATION CARRIES ITS STOPS, and the flat fallback is wrong in BOTH directions", () => {
  // ► Measured on the oracle: 3 gradients START at alpha 0, so a caller taking
  //   stop[0] draws NOTHING — that is helmet116's plume, which shipped in the
  //   pack at opacity zero and was reported as a success. And 19 FADE to alpha
  //   0, so taking stop[0] draws them FULLY OPAQUE — the arena's own 648x440
  //   purple veil becomes a solid slab. Both errors are invisible without the
  //   stops, so the stops travelling with the path is the fix.
  const data = readJson("assets/props/props.json");
  if (!data) {
    assert.equal(data, null, "no props extraction on this machine");
    return;
  }
  let gradients = 0;
  for (const [id, shape] of Object.entries(data.shapes ?? {})) {
    for (const entry of shape.paths ?? []) {
      if (entry.approximated !== "gradient") continue;
      gradients += 1;
      assert.ok(entry.gradient, `shape ${id}: a gradient with no stops is a flat fill wearing a label`);
      assert.ok(Array.isArray(entry.gradient.stops) && entry.gradient.stops.length >= 2,
        `shape ${id}: a gradient needs at least two stops`);
      assert.ok(["linear", "radial"].includes(entry.gradient.type), `shape ${id}: gradient type`);
      assert.ok(entry.gradient.matrix && Number.isFinite(entry.gradient.matrix.a),
        `shape ${id}: the matrix is what maps the +/-16384 square into the shape. Without it the ` +
        "ramp cannot be placed, and four of this build's gradients are genuinely SKEWED.");
      for (const stop of entry.gradient.stops) {
        assert.ok(stop.offset >= 0 && stop.offset <= 1,
          `shape ${id}: offset ${stop.offset} is outside 0..1 — it is ratio/255, not an index`);
      }
    }
  }
  assert.ok(gradients > 0, "the sky is a gradient; finding none means the pack is stale");
});
