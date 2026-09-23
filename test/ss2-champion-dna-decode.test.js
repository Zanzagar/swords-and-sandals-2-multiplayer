/**
 * `initcharacter`'s DNA decode, as the shared module every champion caller
 * uses (`src/team/ss2-champion-dna.js`).
 *
 * It lived inside `test/ss2-champion-dna.test.js` until the browser arena
 * needed it too (2026-09-23). Moving it made the index map a thing a typo can
 * reach from two directions, so the map is checked here against an
 * INDEPENDENT source: the fifty-row table in
 * `docs/integration/ss2-champion-dna.md` §1, which a write-nothing auditor
 * re-parsed mechanically from `initcharacter`'s opcode stream on 2026-08-31.
 * The table is read at test time, never copied into this file.
 *
 * EVERY DNA HERE IS SYNTHETIC. No value is the build's: the repository ships
 * none of its champions' DNA, names or quotes.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  SS2_CHAMPION_DNA_INDEX,
  Ss2ChampionDnaError,
  ss2ChampionFromDna
} from "../src/team/ss2-champion-dna.js";

const DOC = fileURLToPath(new URL("../docs/integration/ss2-champion-dna.md", import.meta.url));

/** Fifty invented fields: index i holds `100 + i`, index 0 and 28 are text. */
function syntheticDna(overrides = {}) {
  const dna = Array.from({ length: 50 }, (unused, index) => String(100 + index));
  dna[0] = "Nobody In Particular";
  dna[28] = "nobody";
  for (const [index, value] of Object.entries(overrides)) dna[Number(index)] = value;
  return dna;
}

test("the index map agrees, row for row, with the doc's mechanically re-parsed table", () => {
  const rows = new Map();
  const text = fs.readFileSync(DOC, "utf8");
  const section = text.slice(text.indexOf("## 1. The DNA index-to-field map"), text.indexOf("## 2. "));
  assert.ok(section.length > 1000, "the doc still has its §1 table");
  for (const line of section.split("\n")) {
    // Index 43 reads "`battlesfought` **(again)**", so nothing after the name is required.
    const single = /^\| (\d+) \| `([a-z_0-9]+)`/.exec(line);
    if (single) rows.set(Number(single[1]), single[2]);
    // `| 34–39 | \`inventory1\`…\`inventory6\` |` is one row for six indices.
    const range = /^\| (\d+)–(\d+) \| `([a-z_]+)(\d+)`…`[a-z_]+(\d+)` \|/.exec(line);
    if (range) {
      const [from, to, stem, first] = [Number(range[1]), Number(range[2]), range[3], Number(range[4])];
      for (let index = from; index <= to; index += 1) rows.set(index, `${stem}${first + index - from}`);
    }
  }
  assert.equal(rows.size, 50, "the doc's §1 table has fifty indices");
  for (const [field, index] of Object.entries(SS2_CHAMPION_DNA_INDEX)) {
    assert.equal(rows.get(index), field, `DNA index ${index}`);
  }
  assert.equal(Object.keys(SS2_CHAMPION_DNA_INDEX).length, 32, "the decode reads the 32 combat fields");
});

test("a literal's fields are ToNumber'd, strings or numbers alike", () => {
  const record = ss2ChampionFromDna(syntheticDna({ 13: "7", 16: "12", 24: "3", 40: "2", 49: "2" }));
  assert.equal(record.weapon, 7);
  assert.equal(record.strength, 12);
  assert.equal(record.equipped_weapon, 2);
  assert.equal(record.secondary_weapon, 145, "index 45 is the secondary weapon");
  assert.equal(typeof record.shield, "number");
  assert.equal("hero_name" in record, false, "the name is not a combat field and is not decoded");

  // An object keyed by index (a sparse transcription) decodes the same way.
  const sparse = Object.fromEntries(Object.values(SS2_CHAMPION_DNA_INDEX).map((index) => [index, index]));
  assert.equal(ss2ChampionFromDna(sparse).helmet, 9);
});

test("initcharacter raises inventory_maxslots by herolevel after the table (+0x0a8d-+0x0b45)", () => {
  // `herolevel < L; Not; Not; If` skips the write while the level is BELOW L,
  // so each write lands at L and above, and the last one to land wins.
  const expected = [
    [1, 9], [5, 9], // below 6 the DNA's own index 40 stands
    [6, 2], [14, 2], [15, 3], [19, 3], [20, 4], [29, 4], [30, 5], [39, 5], [40, 6], [60, 6]
  ];
  for (const [herolevel, maxslots] of expected) {
    const record = ss2ChampionFromDna(syntheticDna({ 24: String(herolevel), 40: "9" }));
    assert.equal(record.inventory_maxslots, maxslots, `herolevel ${herolevel}`);
  }
});

test("a field that is not a number, or is missing, is refused by name and index", () => {
  assert.throws(
    () => ss2ChampionFromDna(syntheticDna({ 16: "strong" })),
    (error) => error instanceof Ss2ChampionDnaError && /strength \[16\]/.test(error.message)
  );
  assert.throws(
    () => ss2ChampionFromDna(syntheticDna({ 17: "" })),
    (error) => error instanceof Ss2ChampionDnaError && /speed \[17\]/.test(error.message)
  );
  // Every missing index is named at once, not the first.
  const short = syntheticDna().slice(0, 40);
  assert.throws(
    () => ss2ChampionFromDna(short),
    (error) => error instanceof Ss2ChampionDnaError &&
      /inventory_maxslots \[40\]/.test(error.message) && /equipped_weapon \[49\]/.test(error.message)
  );
  assert.throws(() => ss2ChampionFromDna(null), Ss2ChampionDnaError);
});
