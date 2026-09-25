/**
 * `createFileBackend` — the campaign layer's first storage that survives a
 * reboot.
 *
 * ## WHY THIS EXISTS
 *
 * ► **THE LAYER HAS BEEN BUILT FOR PERSISTENCE SINCE IT WAS WRITTEN AND HAS
 *   NEVER HAD ANY.** Measured 2026-09-19: 3,174 lines, 69 exports, 70 passing
 *   tests, **one non-test consumer** and **zero `writeFile` calls anywhere in
 *   it**. The September audit's words: *"Nothing a person can run persists a
 *   campaign anywhere."*
 *
 *   The design was never the gap. `CampaignStore` takes an injected backend —
 *   `read`, `write`, `remove`, `keys`, optional `flush` — and shipped two
 *   implementations, a `Map` and fields on a live vanilla save object.
 *   **Neither survives a process.** This is the third, and the point of this
 *   file is that it is tested against the REAL `CampaignStore` rather than
 *   against the contract as I understood it.
 *
 * ## WHAT IS THE BUILD'S AND WHAT IS THIS ENGINE'S
 *
 * **None of it is the build's.** Vanilla SS2 persists one gladiator into a
 * Flash shared object and has no notion of a campaign of team battles. The key
 * grammar, the record schema and this backend are all this repository's, and
 * `vanilla-boundary.js` exists precisely to keep them from colliding with the
 * save fields that ARE the build's.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CampaignStorageError } from "../src/campaign/errors.js";
import {
  BATTLE_RESULT_ACK_TYPE, acknowledgeResultAnimation, applyAction, createTeamBattle,
  currentCombatant, legalActions, pendingResultEvent
} from "../src/team/index.js";
import {
  ReadStatus, WriteStatus, buildCampaignRecord, createCampaignStore
} from "../src/campaign/index.js";
import { createFileBackend, fileNameForKey, keyForFileName } from "../src/campaign/file-backend.js";
import { ss2BattleValues, ss2Combatant } from "../src/team/ss2-rules.js";
import { demoSide } from "../tools/arena/roster.js";

/** A fresh directory per test, removed afterwards. */
function scratch(t) {
  const directory = mkdtempSync(join(tmpdir(), "ss2-campaign-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

const KEY = "ss2TeamArena:battle:camp-1:1";
const RECORDED_AT = "2026-09-19T12:00:00.000Z";

/** The same shapes `test/campaign-persistence.test.js` uses, kept minimal. */
const brute = (id, agility) => ({
  id, name: id, controller: "ai",
  stats: { strength: 10, agility, attack: 40, defense: 0, vitality: 0, stamina: 5, magicka: 0 },
  loadout: { meleeDamage: 40, rangedDamage: 1, canUseRanged: false },
  maxHealth: 50, health: 50
});

function settledBattle() {
  const battle = createTeamBattle({
    seed: 7,
    teams: [
      { id: "alpha", name: "Alpha", slots: 2, combatants: [brute("a1", 9), brute("a2", 8)] },
      { id: "beta", name: "Beta", slots: 2, combatants: [brute("b1", 3), null] }
    ]
  });
  for (let guard = 0; !battle.result; guard += 1) {
    if (guard > 200) throw new Error("The battle did not end.");
    const actor = currentCombatant(battle);
    const options = legalActions(battle, actor.id);
    const attack = options.find((option) => option.type === "melee") ?? options[0];
    applyAction(battle, { actorId: actor.id, ...attack });
  }
  const pending = pendingResultEvent(battle);
  acknowledgeResultAnimation(battle, {
    type: BATTLE_RESULT_ACK_TYPE,
    completionToken: pending.completionToken
  });
  return battle;
}

/* ------------------------------------------------------------------ *
 * THE NAME MAPPING
 * ------------------------------------------------------------------ */

test("A KEY IS NOT A FILENAME, because Windows forbids the separator", () => {
  // ► **THE CONSTRAINT IS REAL ON THIS PROJECT, not hypothetical.** The capture
  //   vehicle runs on Windows and `docs/handoffs/README.md` records the same
  //   rule about its own stamps: no colons in filenames.
  assert.equal(fileNameForKey(KEY), "ss2TeamArena~battle~camp-1~1.json");
  assert.ok(!fileNameForKey(KEY).includes(":"), "a colon would be unopenable on Windows");
});

test("THE MAPPING IS INJECTIVE, because `~` is not in the key-segment alphabet", () => {
  // ► **THE ASSERTION THAT COULD HAVE VARIED.** Segments match
  //   `/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/` — dots, underscores and hyphens
  //   are legal INSIDE a segment, so any of those three as the separator would
  //   make two different keys collide on one filename and one would silently
  //   overwrite the other. `~` is the character the grammar cannot produce.
  for (const key of [
    KEY,
    "ss2TeamArena:battle:a.b:1",
    "ss2TeamArena:battle:a_b:1",
    "ss2TeamArena:battle:a-b:1",
    "ss2TeamArena:quarantine:x:9"
  ]) {
    assert.equal(keyForFileName(fileNameForKey(key)), key, `${key} must round-trip exactly`);
  }

  // And two keys that differ only where a weaker separator would have merged
  // them stay distinct.
  assert.notEqual(fileNameForKey("ss2TeamArena:battle:a-b:1"), fileNameForKey("ss2TeamArena:battle:a:b-1"));
});

test("A FILE THIS BACKEND DID NOT WRITE IS NOT A KEY", () => {
  assert.equal(keyForFileName("notes.txt"), null);
  assert.equal(keyForFileName("ss2TeamArena~battle~a~1.json.writing"), null, "its own temp file is not a key");
  assert.equal(keyForFileName("somethingElse~battle~a~1.json"), null, "another namespace is not ours");
});

/* ------------------------------------------------------------------ *
 * THE BACKEND CONTRACT
 * ------------------------------------------------------------------ */

test("IT ROUND-TRIPS THROUGH A REAL DIRECTORY, and a missing key is null", (t) => {
  const backend = createFileBackend({ directory: scratch(t) });
  assert.deepEqual(backend.keys(), [], "a fresh directory holds no records");
  assert.equal(backend.read(KEY), null);

  backend.write(KEY, '{"schema":1}');
  assert.equal(backend.read(KEY), '{"schema":1}');
  assert.deepEqual(backend.keys(), [KEY]);

  backend.remove(KEY);
  assert.equal(backend.read(KEY), null);
  assert.deepEqual(backend.keys(), []);
  assert.doesNotThrow(() => backend.remove(KEY), "removing twice is not an error");
});

test("A WRITE IS ATOMIC, because a half-written record reads as CORRUPT", (t) => {
  // ► **THE STORE ALREADY DISTINGUISHES MISSING FROM CORRUPT FROM
  //   UNSUPPORTED**, so a process killed mid-write would manufacture the middle
  //   one — a campaign reporting its own evidence as damaged when nothing is.
  //   Asserted structurally: nothing is ever written directly to the target, so
  //   a reader either sees the whole previous value or the whole new one.
  const directory = scratch(t);
  const wrote = [];
  const backend = createFileBackend({
    directory,
    fs: {
      mkdirSync() {},
      writeFileSync(path) { wrote.push(["write", path]); },
      renameSync(from, to) { wrote.push(["rename", from, to]); },
      readFileSync() { return ""; },
      readdirSync() { return []; },
      rmSync() {}
    }
  });
  backend.write(KEY, "{}");
  assert.equal(wrote.length, 2);
  assert.match(wrote[0][1], /\.writing$/, "the bytes land on a temp file first");
  assert.equal(wrote[1][0], "rename");
  assert.equal(wrote[1][2], join(directory, fileNameForKey(KEY)).split("\\").join("/"));
  assert.ok(
    wrote[1][1].startsWith(wrote[1][2]),
    "the temp file is in the SAME directory, or the rename crosses a device and stops being atomic"
  );
});

test("A LEFTOVER TEMP FILE IS INVISIBLE, so a crash cannot manufacture a corrupt record", (t) => {
  const directory = scratch(t);
  const backend = createFileBackend({ directory });
  backend.write(KEY, '{"schema":1}');
  // Exactly what a kill -9 between the two syscalls leaves behind.
  writeFileSync(join(directory, `${fileNameForKey("ss2TeamArena:battle:camp-1:2")}.writing`), '{"half');

  assert.deepEqual(backend.keys(), [KEY], "the torn file is not listed");
  assert.ok(readdirSync(directory).length > 1, "and it is still on disk, for a human to find");
});

test("ONLY 'NOT THERE' IS NULL — a real fault is raised", (t) => {
  // ► **SWALLOWING A PERMISSION ERROR WOULD PRESENT AN UNREADABLE CAMPAIGN AS
  //   AN ABSENT ONE**, and the store would then report MISSING and a caller
  //   would start a new campaign over the top of one it could not read.
  const backend = createFileBackend({
    directory: scratch(t),
    fs: {
      mkdirSync() {}, writeFileSync() {}, renameSync() {}, readdirSync() { return []; }, rmSync() {},
      readFileSync() { const error = new Error("denied"); error.code = "EACCES"; throw error; }
    }
  });
  assert.throws(() => backend.read(KEY), /denied/);
});

test("IT REFUSES A NON-STRING VALUE AND A MISSING DIRECTORY, by name", (t) => {
  assert.throws(() => createFileBackend({}), CampaignStorageError);
  const backend = createFileBackend({ directory: scratch(t) });
  assert.throws(() => backend.write(KEY, { schema: 1 }), CampaignStorageError);
});

/* ------------------------------------------------------------------ *
 * AGAINST THE REAL STORE
 * ------------------------------------------------------------------ */

test("A REAL RECORD SURVIVES THE PROCESS — written by one store, read by another", (t) => {
  // ► **THE WHOLE POINT, AND IT GOES THROUGH `CampaignStore` RATHER THAN
  //   AGAINST MY READING OF ITS CONTRACT.** A backend that satisfies the four
  //   method signatures and still breaks the store would pass every test above
  //   this one. So this builds a REAL record the way
  //   `test/campaign-persistence.test.js` does, writes it through the store,
  //   throws the store away, and opens a new one over the same directory.
  const directory = scratch(t);
  const record = buildCampaignRecord(settledBattle(), { battleId: "camp-1", recordedAt: RECORDED_AT });

  const first = createCampaignStore({ backend: createFileBackend({ directory }) });
  const write = first.write(record);
  assert.equal(write.status, WriteStatus.WRITTEN, `the write must succeed; got ${JSON.stringify(write)}`);
  // ► **THE RECORD ID IS THE RECORD'S, NOT THE `battleId` I PASSED IN.** It
  //   comes back as `tbr-<digest>` — a content-addressed id the record layer
  //   mints. Asserting "camp-1" here would have been asserting my own argument
  //   back at me, which is the shape of test that passes while proving nothing.
  const recordId = write.recordId;
  assert.match(recordId, /^tbr-[0-9a-f]+$/, "the id is minted by the record layer, not by the caller");

  // A new store, a new backend, the same directory. This is the assertion a
  // `Map` can never satisfy and the reason this file exists.
  const reopened = createCampaignStore({ backend: createFileBackend({ directory }) });
  assert.deepEqual(reopened.recordIds(), [recordId]);
  assert.equal(reopened.has(recordId), true);

  const read = reopened.readRecord(recordId);
  assert.equal(read.status, ReadStatus.OK, `the record must read back OK; got ${JSON.stringify(read.status)}`);
  assert.deepEqual(read.record, record, "and byte-for-byte the record that was written");
});

/* ------------------------------------------------------------------ *
 * THE HOST — the first thing anybody can run that persists a campaign
 * ------------------------------------------------------------------ */

test("A CAMPAIGN RESUMES ACROSS PROCESSES, carrying its survivors", (t) => {
  // ► **THE ASSERTION THE WHOLE ITEM EXISTS FOR, and it is run as a SUBPROCESS
  //   on purpose.** Everything above proves the store round-trips inside one
  //   process. What the September audit said was missing is that *"nothing a
  //   person can run persists a campaign anywhere"* — so this runs the tool the
  //   way a person does, three times, and checks the third one starts from what
  //   the second one left.
  //
  //   **Three defects in the tool were found exactly this way**, none of them
  //   reachable by unit test: the resume printed its message without rebuilding
  //   the roster; the challengers reused the dead gladiators' ids; and the
  //   blueprints were read off `teams[].combatants`, which a record does not
  //   have — the ids live on `outcomes`.
  const directory = scratch(t);
  const run = () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../tools/arena-campaign.mjs", import.meta.url)),
        "fight", "--dir", directory, "--seed", "11"],
      { encoding: "utf8" }
    );
    assert.equal(result.status, 0, `the tool must exit 0; stderr was ${result.stderr}`);
    return result.stdout;
  };

  const first = run();
  assert.match(first, /bout 1: (red|blue|nobody) wins/, "the first run fights a bout");
  assert.ok(!first.includes("resuming"), "and has nothing to resume from");

  const second = run();
  assert.match(second, /1 bout\(s\) on disk/, "the second run SEES the first one's work");
  assert.match(second, /resuming after tbr-[0-9a-f]+/, "and resumes from it");
  assert.match(
    second,
    /\d+ gladiator\(s\) carried/,
    "carrying survivors rather than starting six fresh gladiators"
  );

  const third = run();
  assert.match(third, /2 bout\(s\) on disk/, "and the circuit keeps going");

  // The directory is the save: one file per bout, and nothing else.
  const files = readdirSync(directory).filter((name) => name.endsWith(".json"));
  assert.equal(files.length, 3, `three bouts, three records; found ${files.join(", ")}`);
  for (const name of files) {
    assert.ok(keyForFileName(name), `${name} must be a key this backend minted`);
  }
});

test("THE HOST REFUSES TO WRITE SOMEWHERE NOBODY ASKED FOR", () => {
  // The rule `recover-launch-nonces.mjs` already sets about its `--archive`: a
  // tool that picks its own directory writes somebody's save where they cannot
  // find it, and a tool that treats "no arguments" as "do the full job" makes a
  // probe destructive.
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../tools/arena-campaign.mjs", import.meta.url)), "fight"],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--dir <directory> is required/);
});

/* ------------------------------------------------------------------ *
 * WHAT AN ADVERSARIAL REVIEW FOUND, 2026-09-19
 * ------------------------------------------------------------------ */

test("THE CLI FIGHTS THE ROSTER IT ADVERTISES, not createTeamBattle's defaults", (t) => {
  // ► **THE WORST OF THE FOUR, AND IT IS A MISTAKE THIS REPOSITORY ALREADY
  //   NAMES AS A PAST ERROR.** `demoSide().members` is the BROWSER host's shape
  //   and carries no canonical `stats`, `loadout` or `maxHealth`; passing it
  //   straight to `createTeamBattle` makes it substitute defaults, silently.
  //   Reproduced before the fix: red-1 entered as strength 5 / agility 5 /
  //   attack 5 with **140** max health against the roster's 9 / 7 / 8 and 46.
  //   **Every bout this tool ran fought gladiators that were not the demo
  //   roster's, and persisted records describing them.**
  //
  //   Asserted against the ROSTER rather than a literal, so tuning the demo
  //   moves both together and this test keeps meaning the same thing.
  const directory = scratch(t);
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../tools/arena-campaign.mjs", import.meta.url)), "fight", "--dir", directory],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);

  const file = readdirSync(directory).find((name) => name.endsWith(".json"));
  const record = JSON.parse(readFileSync(join(directory, file), "utf8"));
  const red1 = record.outcomes.find((outcome) => outcome.combatantId === "red-1");
  assert.ok(red1, "the record must name the roster's own first slot");
  assert.equal(
    red1.maxHealth,
    demoSide("red", 3, { ss2Combatant, ss2BattleValues }).members[0].vanilla.hitpointsmax,
    "the persisted gladiator must be the one the roster states, not a 140-health default"
  );
});

test("A CORRUPT RECORD REFUSES THE RUN, rather than rolling the campaign back", (t) => {
  // ► **THE SILENT ROLLBACK.** An unreadable record was given an empty
  //   `recordedAt`, which sorts BEFORE every real timestamp — so it landed at
  //   the front, `history.at(-1)` picked a valid but OLDER bout, and the guard
  //   that should have refused only ever read the last entry. The campaign
  //   would quietly continue from an earlier roster. And `readRecord`
  //   quarantines by default, so the run after that would see an empty
  //   directory and start over from the opening roster.
  const directory = scratch(t);
  const run = () => spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../tools/arena-campaign.mjs", import.meta.url)), "fight", "--dir", directory],
    { encoding: "utf8" }
  );
  assert.equal(run().status, 0);
  assert.equal(run().status, 0, "two clean bouts first");

  // Damage the OLDER of the two, which is the case the tail-only check missed.
  const files = readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
  writeFileSync(join(directory, files[0]), "{ this is not json");

  const refused = run();
  assert.equal(refused.status, 1, "a campaign with a hole in it must not be continued");
  assert.match(refused.stderr, /do not read/);
  assert.match(refused.stderr, /hole in it/);
});

test("TWO WRITERS DO NOT SHARE ONE TEMPORARY FILE", (t) => {
  // ► **A CONTRACT NOTHING CHECKS IS A COMMENT.** The first cut used a fixed
  //   `.writing` suffix "because this backend is single-process by contract" —
  //   but nothing enforced that, so two runs against one directory could
  //   truncate or rename each other's temp file. The name carries the pid now.
  //
  //   **This is protection, not mutual exclusion**: two processes advancing the
  //   same campaign still produce competing histories, because that conflict is
  //   in the circuit rather than in the bytes.
  const directory = scratch(t);
  const paths = [];
  const backend = createFileBackend({
    directory,
    fs: {
      mkdirSync() {}, renameSync() {}, readFileSync() { return ""; },
      readdirSync() { return []; }, rmSync() {},
      writeFileSync(path) { paths.push(path); }
    }
  });
  backend.write(KEY, "{}");
  assert.match(paths[0], /\.writing$/);
  assert.ok(
    paths[0].includes(String(process.pid)),
    `the temp name must be unique per process; got ${paths[0]}`
  );
});
