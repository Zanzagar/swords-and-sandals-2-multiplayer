/**
 * THE DEV SERVER'S MIME TABLE, AND THE FEATURE IT SILENTLY TURNED OFF.
 *
 * WHY THIS FILE EXISTS. On 2026-09-18 the owner reported "some bugs with sound.
 * All effects aren't working." Every layer under test was correct:
 * `src/render/sound.js` returned the right file for the right label,
 * `bindingsFrom` built all 80 buckets off the extracted manifest, and every
 * `.mp3` under `assets/sound/` served 200. **The arena was silent because
 * `tools/arena-server.mjs` had no `.mp3` entry in `CONTENT_TYPES`**, so each
 * one arrived as `application/octet-stream` — which a browser will happily
 * sniff for an image and will not decode for an `<audio>` element.
 *
 * The suite could not have caught it. `src/render/` is pure and under test;
 * `tools/` is not; and the join between them is a seven-line lookup table that
 * nothing asserted. What it cost was a whole feature, invisibly, for however
 * long the extractor has existed.
 *
 * SO THIS ASSERTS THE JOIN, NOT THE TABLE. It reads the extensions actually
 * present under `assets/` and requires the server to name every one of them.
 * A new extractor that writes a new file type fails here rather than shipping
 * a dead feature.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SERVER = join(REPO_ROOT, "tools", "arena-server.mjs");

/** Every file extension under `assets/`, lowercased, or `[]` when nothing is extracted. */
async function assetExtensions() {
  const root = join(REPO_ROOT, "assets");
  const found = new Set();
  const walk = async (dir) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else {
        const ext = extname(entry.name).toLowerCase();
        if (ext) found.add(ext);
      }
    }
  };
  await walk(root);
  return [...found].sort();
}

/** The keys of the server's own `CONTENT_TYPES`, read out of the source. */
async function servedExtensions() {
  const source = await readFile(SERVER, "utf8");
  const block = source.match(/const CONTENT_TYPES = Object\.freeze\(\{([\s\S]*?)\}\);/);
  assert.ok(block, "tools/arena-server.mjs must still declare a frozen CONTENT_TYPES map");
  return [...block[1].matchAll(/"(\.[a-z0-9]+)"\s*:/g)].map((match) => match[1]);
}

test("THE SERVER NAMES A TYPE FOR EVERY EXTENSION UNDER `assets/`, or a whole feature ships mute", () => {
  return Promise.all([assetExtensions(), servedExtensions()]).then(([assets, served]) => {
    assert.ok(served.length > 3, "the server must declare a real type table, not an empty one");
    if (assets.length === 0) {
      // A FRESH CLONE HAS NO `assets/`, so the listing is legitimately empty and
      // there is nothing to serve — this is the same structural condition the
      // raw-trace archive check takes, and the narrower `.mp3` test below holds
      // in that tree anyway, which is why this branch is allowed to be quiet.
      // assertion-quality: empty listing is the assertion
      assert.deepEqual(assets, [], "no extracted assets in this tree, so there is nothing to serve");
      return;
    }
    assert.ok(assets.length > 0, "and the sweep below is only meaningful over a non-empty listing");
    const missing = assets.filter((ext) => !served.includes(ext));
    assert.deepEqual(
      missing, [],
      `tools/arena-server.mjs serves ${missing.join(", ")} as application/octet-stream. ` +
      "A browser will not decode audio at that type, so the arena goes silent with every file at 200."
    );
  });
});

test("`.mp3` IS AUDIO, NAMED EXPLICITLY, because that is the one that was missing", () => {
  // Deliberately a second, narrower assertion. The sweep above is structural
  // and would go quiet in a tree with no `assets/`; this one holds everywhere,
  // including in a fresh clone, and it names the defect.
  return readFile(SERVER, "utf8").then((source) => {
    assert.match(source, /"\.mp3":\s*"audio\/mpeg"/,
      "the extracted sounds are mp3 and must be served as audio/mpeg");
  });
});

test("THE FALL-THROUGH IS STILL `application/octet-stream`, which is why an omission is silent", () => {
  // Pinned so the mechanism stays visible: nothing errors when a type is
  // missing, the file just arrives as bytes nobody will decode. If this ever
  // becomes a refusal, the sweep above stops being the only guard.
  return readFile(SERVER, "utf8").then((source) => {
    assert.match(source, /CONTENT_TYPES\[extname\(absolute\)\.toLowerCase\(\)\]\s*\?\?\s*"application\/octet-stream"/,
      "the unknown-type fall-through is what makes a missing entry invisible");
  });
});
