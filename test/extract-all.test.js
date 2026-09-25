/**
 * `tools/extract-all.mjs` — the one command that imports every pack.
 *
 * ► **NO TEST HERE TOUCHES AN INSTALL.** Discovery runs against a synthetic
 *   filesystem (`probe`/`readText` are injected, and every probe is recorded
 *   and checked against the candidate list). The runs use a fake SWF of a few
 *   bytes in a temporary directory, a fingerprint written beside it, and stub
 *   extractors that write the files a real one would — `main` never spawns an
 *   extractor here. The one spawn is `spawnExtractor` running a temporary
 *   script. The committed fingerprint and the repository's own source are the
 *   only real files read.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  COLLECTION_DIR,
  ExtractAllError,
  LEDGER_PATH,
  PACKS,
  SWF_IN_COLLECTION,
  SWF_NAME,
  checkBuild,
  decide,
  extractorDigest,
  isWsl,
  locateSwf,
  main,
  orderPacks,
  parseArguments,
  quoteForShell,
  readFingerprint,
  retryCommand,
  spawnExtractor,
  steamLibraryPaths,
  swfCandidates,
  windowsPathToWsl
} from "../tools/extract-all.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const TAIL = [COLLECTION_DIR, ...SWF_IN_COLLECTION];

/* ─────────────────────────────  a synthetic filesystem  ───────────────────── */

/** A probe over a fixed set of files and folders, recording every path it is asked about. */
function syntheticDisk({ files = [], dirs = [], texts = {} } = {}) {
  const asked = [];
  const read = [];
  return {
    asked,
    read,
    probe(target) {
      asked.push(target);
      if (files.includes(target)) return "file";
      if (dirs.includes(target)) return "dir";
      return null;
    },
    readText(target) {
      read.push(target);
      return Object.hasOwn(texts, target) ? texts[target] : null;
    }
  };
}

const WSL = { platform: "linux", release: "6.18.33.2-microsoft-standard-WSL2", env: {}, home: "/home/player" };
const WSL_DEFAULT = `/mnt/c/Program Files (x86)/Steam/steamapps/common/${TAIL.join("/")}`;

/* ───────────────────────────────────  discovery  ──────────────────────────── */

test("on WSL the first place looked is the Steam default every extractor hard-codes", () => {
  const candidates = swfCandidates(WSL);
  assert.equal(candidates[0].path, WSL_DEFAULT);
  assert.match(candidates[0].why, /WSL/);
  // Tied to the extractors' own literal, so the two cannot drift apart.
  const figure = fs.readFileSync(path.join(REPO_ROOT, "tools", "extract-figure.mjs"), "utf8");
  const literal = /const DEFAULT_SWF =\s*"([^"]+)"/.exec(figure)?.[1];
  assert.equal(literal, WSL_DEFAULT, "extract-figure.mjs's DEFAULT_SWF is the WSL candidate");
});

test("WSL is recognised by the kernel's release string OR by WSL_DISTRO_NAME, and only on Linux", () => {
  assert.equal(isWsl({ platform: "linux", release: "6.18.33.2-microsoft-standard-WSL2" }), true);
  assert.equal(isWsl({ platform: "linux", release: "6.8.0-45-generic", env: { WSL_DISTRO_NAME: "Ubuntu" } }), true);
  assert.equal(isWsl({ platform: "linux", release: "6.8.0-45-generic", env: {} }), false);
  assert.equal(isWsl({ platform: "darwin", release: "microsoft", env: { WSL_DISTRO_NAME: "x" } }), false);
});

test("plain Linux looks in Steam's Linux homes and never at /mnt/c", () => {
  const paths = swfCandidates({ platform: "linux", release: "6.8.0-45-generic", env: {}, home: "/home/p" }).map((c) => c.path);
  assert.ok(paths.every((p) => !p.startsWith("/mnt/")), paths.join("\n"));
  for (const root of [
    "/home/p/.local/share/Steam",
    "/home/p/.steam/steam",
    "/home/p/.steam/debian-installation",
    "/home/p/.var/app/com.valvesoftware.Steam/.local/share/Steam",
    "/home/p/snap/steam/common/.local/share/Steam"
  ]) {
    assert.ok(paths.includes(`${root}/steamapps/common/${TAIL.join("/")}`), `missing ${root}`);
  }
});

test("Windows uses %ProgramFiles(x86)% when it is set, with Windows separators", () => {
  const paths = swfCandidates({ platform: "win32", env: { "ProgramFiles(x86)": "E:\\Apps (x86)", ProgramFiles: "E:\\Apps" } })
    .map((c) => c.path);
  assert.deepEqual(paths, [
    `E:\\Apps (x86)\\Steam\\steamapps\\common\\${TAIL.join("\\")}`,
    `E:\\Apps\\Steam\\steamapps\\common\\${TAIL.join("\\")}`
  ]);
  const fallback = swfCandidates({ platform: "win32", env: {} })[0].path;
  assert.equal(fallback, `C:\\Program Files (x86)\\Steam\\steamapps\\common\\${TAIL.join("\\")}`);
});

test("macOS looks in ~/Library/Application Support/Steam", () => {
  const paths = swfCandidates({ platform: "darwin", env: {}, home: "/Users/p" }).map((c) => c.path);
  assert.deepEqual(paths, [`/Users/p/Library/Application Support/Steam/steamapps/common/${TAIL.join("/")}`]);
});

test("Steam's libraryfolders.vdf is read in both of its formats", () => {
  const modern = [
    '"libraryfolders"', "{", '\t"0"', "\t{", '\t\t"path"\t\t"C:\\\\Program Files (x86)\\\\Steam"',
    '\t\t"apps"', "\t\t{", '\t\t\t"1055430"\t\t"1851234"', "\t\t}", "\t}",
    '\t"1"', "\t{", '\t\t"path"\t\t"D:\\\\SteamLibrary"', "\t}", "}"
  ].join("\n");
  assert.deepEqual(steamLibraryPaths(modern), ["C:\\Program Files (x86)\\Steam", "D:\\SteamLibrary"],
    "an app id mapped to a size is not a library");
  const legacy = '"LibraryFolders"\n{\n\t"TimeNextStatsReport"\t\t"1600000000"\n\t"1"\t\t"E:\\\\Games\\\\Steam"\n}';
  assert.deepEqual(steamLibraryPaths(legacy), ["E:\\Games\\Steam"]);
  assert.deepEqual(steamLibraryPaths(null), []);
});

test("a second Steam library is found, and on WSL its drive letter becomes /mnt/<letter>", () => {
  assert.equal(windowsPathToWsl("D:\\SteamLibrary"), "/mnt/d/SteamLibrary");
  assert.equal(windowsPathToWsl("E:\\"), "/mnt/e");
  assert.equal(windowsPathToWsl("/already/posix"), null);

  const vdf = "/mnt/c/Program Files (x86)/Steam/steamapps/libraryfolders.vdf";
  const disk = syntheticDisk({ texts: { [vdf]: '"libraryfolders"\n{\n "1"\n {\n  "path"  "D:\\\\SteamLibrary"\n }\n}' } });
  const candidates = swfCandidates({ ...WSL, readText: disk.readText });
  const second = `/mnt/d/SteamLibrary/steamapps/common/${TAIL.join("/")}`;
  assert.ok(candidates.some((c) => c.path === second && c.why.includes(vdf)), JSON.stringify(candidates, null, 1));
  // Only the Steam roots' own vdf files are read — nothing else.
  assert.ok(disk.read.every((file) => file.endsWith("/steamapps/libraryfolders.vdf")), disk.read.join("\n"));
});

test("a path you give wins, and a missing one is an ERROR, never a fallback", () => {
  const disk = syntheticDisk({ files: [WSL_DEFAULT, "/games/mine.swf", "/env/ss2.swf"] });
  assert.equal(locateSwf({ ...WSL, given: "/games/mine.swf", env: { SS2_SWF: "/env/ss2.swf" }, probe: disk.probe }).path,
    "/games/mine.swf");

  const strict = syntheticDisk({ files: [WSL_DEFAULT] });
  assert.throws(() => locateSwf({ ...WSL, given: "/nowhere.swf", probe: strict.probe }), (error) =>
    error instanceof ExtractAllError && /No SWF at \/nowhere\.swf/.test(error.message) && /Nothing else was tried/.test(error.message));
  assert.deepEqual(strict.asked, ["/nowhere.swf"], "the install that DOES exist was never looked at");
});

test("SS2_SWF comes next, with the same no-fallback rule", () => {
  const disk = syntheticDisk({ files: [WSL_DEFAULT, "/env/ss2.swf"] });
  const found = locateSwf({ ...WSL, env: { SS2_SWF: "/env/ss2.swf" }, probe: disk.probe });
  assert.equal(found.path, "/env/ss2.swf");
  assert.match(found.why, /SS2_SWF/);

  const missing = syntheticDisk({ files: [WSL_DEFAULT] });
  assert.throws(() => locateSwf({ ...WSL, env: { SS2_SWF: "/env/gone.swf" }, probe: missing.probe }), /SS2_SWF/);
  assert.deepEqual(missing.asked, ["/env/gone.swf"]);
});

test("a folder is accepted: the collection's own, or its swf/ folder", () => {
  const collection = "/games/Swords and Sandals Classic Collection";
  const disk = syntheticDisk({ dirs: [collection, `${collection}/swf`], files: [`${collection}/swf/${SWF_NAME}`] });
  assert.equal(locateSwf({ ...WSL, given: collection, probe: disk.probe }).path, `${collection}/swf/${SWF_NAME}`);
  assert.equal(locateSwf({ ...WSL, given: `${collection}/swf`, probe: disk.probe }).path, `${collection}/swf/${SWF_NAME}`);
  const empty = syntheticDisk({ dirs: ["/games/empty"] });
  assert.throws(() => locateSwf({ ...WSL, given: "/games/empty", probe: empty.probe }), /a folder with no swf\//);
});

test("with nothing given, the first candidate that exists is used", () => {
  const disk = syntheticDisk({ files: [WSL_DEFAULT] });
  const found = locateSwf({ ...WSL, probe: disk.probe });
  assert.equal(found.path, WSL_DEFAULT);
  assert.match(found.why, /Steam default on WSL/);
});

test("nothing found: the error lists every path tried, and nothing off the list was probed", () => {
  const collection = `/home/player/.local/share/Steam/steamapps/common/${COLLECTION_DIR}`;
  const disk = syntheticDisk({ dirs: [collection] });
  let message = "";
  try {
    locateSwf({ ...WSL, probe: disk.probe, readText: disk.readText });
  } catch (error) {
    message = error.message;
  }
  const candidates = swfCandidates({ ...WSL, readText: () => null }).map((c) => c.path);
  for (const candidate of candidates) assert.ok(message.includes(candidate), `the message omits ${candidate}`);
  assert.match(message, /The collection's folder IS at .*Swords and Sandals Classic Collection/,
    "a collection folder without the SWF is named, because that is a different fix");
  assert.match(message, /node tools\/extract-all\.mjs "<path to swords_sandals2_download\.swf>"/);
  // NEVER SEARCHES A DISK: every probe is a candidate or a candidate's collection folder.
  const allowed = new Set([...candidates, ...candidates.map((c) => path.posix.dirname(path.posix.dirname(c)))]);
  assert.deepEqual(disk.asked.filter((asked) => !allowed.has(asked)), []);
});

/* ──────────────────────────────────  the build  ───────────────────────────── */

test("the fingerprint's known build is the oracle every extractor names", async () => {
  const fingerprint = readFingerprint(REPO_ROOT);
  const { ORACLE_SHA256 } = await import("../tools/extract-champions.mjs");
  assert.equal(fingerprint.sha256, ORACLE_SHA256);
  assert.equal(fingerprint.relativePath, SWF_IN_COLLECTION.join("/"), "discovery looks where the fingerprint says the file is");
});

test("the known build proceeds whatever the case of its hex; another is refused unless allowed", () => {
  const fingerprint = { sha256: "aa".repeat(32), known: new Set(["aa".repeat(32)]), buildId: 123 };
  const known = checkBuild("AA".repeat(32), fingerprint);
  assert.equal(known.known, true);
  assert.equal(known.proceed, true);
  assert.match(known.lines.join("\n"), /the build this project knows \(Steam build 123\)/);

  const other = checkBuild("bb".repeat(32), fingerprint);
  assert.equal(other.proceed, false);
  assert.match(other.lines.join("\n"), /--allow-other-build/);
  assert.match(other.lines.join("\n"), /swf\/swords_sandals2_download\.swf/, "and it names the file a launcher mix-up would want");

  const allowed = checkBuild("bb".repeat(32), fingerprint, { allowOtherBuild: true });
  assert.equal(allowed.proceed, true);
  assert.equal(allowed.known, false);
});

/* ───────────────────────────────  the pack table  ─────────────────────────── */

test("every tools/extract-*.mjs is in the list, once, and nothing else is", () => {
  const extractors = fs.readdirSync(path.join(REPO_ROOT, "tools"))
    .filter((name) => /^extract-.+\.mjs$/.test(name) && name !== "extract-all.mjs")
    .map((name) => `tools/${name}`)
    .sort();
  assert.deepEqual(PACKS.map((pack) => pack.script).sort(), extractors);
  assert.equal(new Set(PACKS.map((pack) => pack.name)).size, PACKS.length, "pack names are unique");
});

test("every output is under assets/, every recorded sha256 is in an output, and the declared order is a valid one", () => {
  for (const pack of PACKS) {
    for (const output of pack.outputs) assert.match(output, /^assets\/[^/]+\/[^/]+$/, `${pack.name}: ${output}`);
    if (pack.sha256At) assert.ok(pack.outputs.includes(pack.sha256At.file), `${pack.name} records its build in ${pack.sha256At.file}`);
    // One folder per pack: it is staged as one folder and installed into one.
    const folder = path.posix.dirname(pack.outputs[0]);
    for (const output of pack.outputs) assert.equal(path.posix.dirname(output), folder, `${pack.name}: ${output}`);
    if (pack.media) assert.deepEqual([path.posix.dirname(pack.media.manifest), pack.media.dir], [folder, folder], pack.name);
  }
  assert.deepEqual(orderPacks(PACKS).map((pack) => pack.name), PACKS.map((pack) => pack.name));
  const names = PACKS.map((pack) => pack.name);
  assert.ok(names.indexOf("sound") < names.indexOf("figure"), "the figure's preview reads the sound pack");
});

function sourcesUnder(relative) {
  const root = path.join(REPO_ROOT, relative);
  return fs.readdirSync(root).filter((name) => /\.(m?js|html)$/.test(name)).map((name) => fs.readFileSync(path.join(root, name), "utf8")).join("\n");
}

test("each pack's reader really fetches it, and the arena fetches nothing no pack writes", () => {
  for (const pack of PACKS) {
    assert.ok(sourcesUnder(pack.reader).includes(`"/${pack.outputs[0]}"`), `${pack.reader} never fetches /${pack.outputs[0]}`);
  }
  assert.deepEqual(PACKS.filter((pack) => pack.arena).length, 10, "the arena reads ten packs");
  const written = new Set(PACKS.flatMap((pack) => pack.outputs.map((output) => `/${output}`)));
  const fetched = [...sourcesUnder("tools/arena").matchAll(/["'`](\/assets\/[A-Za-z0-9_\-/]+\.[a-z0-9]+)["'`]/g)].map((m) => m[1]);
  assert.ok(fetched.length >= 10, `found only ${fetched.length} asset URLs in tools/arena/`);
  assert.deepEqual([...new Set(fetched)].filter((url) => !written.has(url)), [],
    "the arena fetches a file extract-all does not produce: add its extractor to PACKS");
});

test("assets/README.md names every extractor and the one command", () => {
  const readme = fs.readFileSync(path.join(REPO_ROOT, "assets", "README.md"), "utf8");
  assert.ok(readme.includes("node tools/extract-all.mjs"));
  for (const pack of PACKS) assert.ok(readme.includes(`\`${pack.script}\``), `README omits ${pack.script}`);
});

test("no extractor's main-module guard compares import.meta.url to file://argv[1]", () => {
  // That form never matches a path holding a space or any Windows path, and a
  // miss runs NOTHING and exits 0 — which extract-all would read as success.
  for (const pack of PACKS) {
    const source = fs.readFileSync(path.join(REPO_ROOT, pack.script), "utf8");
    assert.doesNotMatch(source, /import\.meta\.url === `file:\/\/\$\{process\.argv\[1\]\}`/, pack.script);
  }
});

/* ───────────────────────────────  ordering  ───────────────────────────────── */

const stubPack = (name, after = [], extra = {}) => ({
  name,
  script: `tools/extract-${name}.mjs`,
  outputs: [`assets/${name}/${name}.json`],
  sha256At: { file: `assets/${name}/${name}.json`, key: ["sha256"] },
  after,
  reader: "tools/arena",
  arena: true,
  unlocks: `the ${name} feature`,
  without: `no ${name}`,
  ...extra
});

test("a pack runs after what it reads, however the list is written, and otherwise keeps its place", () => {
  const packs = [stubPack("figure", ["sound"]), stubPack("props"), stubPack("sound"), stubPack("icons")];
  assert.deepEqual(orderPacks(packs).map((p) => p.name), ["sound", "figure", "props", "icons"]);
  // --only figure: the absent dependency is not dragged in.
  assert.deepEqual(orderPacks([packs[0]], { all: packs }).map((p) => p.name), ["figure"]);
  assert.throws(() => orderPacks([stubPack("a", ["b"]), stubPack("b", ["a"])]), /cycle: a -> b -> a/);
  assert.throws(() => orderPacks([stubPack("a", ["ghost"])]), /"ghost", which is not a pack/);
});

/* ───────────────────────────────  the skip rule  ──────────────────────────── */

test("decide: skipped only when build, extractor, files, own record and dependencies all agree", () => {
  const pack = stubPack("figure", ["sound"]);
  const sha = "ab".repeat(32);
  const entry = { swfSha256: sha, toolDigest: "d1" };
  const base = { pack, entry, sha256: sha, digest: "d1", missing: [], recorded: sha, staleDependencies: [] };
  assert.equal(decide(base).run, false);
  assert.match(decide(base).reason, /already extracted from abababababab… .*--force/);
  assert.equal(decide({ ...base, force: true }).reason, "--force");
  assert.equal(decide({ ...base, entry: null }).reason, "not extracted yet");
  assert.match(decide({ ...base, entry: { ...entry, swfSha256: "cd".repeat(32) } }).reason, /different build/);
  assert.match(decide({ ...base, digest: "d2" }).reason, /tools\/extract-figure\.mjs has changed/);
  assert.match(decide({ ...base, missing: ["assets/figure/figure.json"] }).reason, /is missing/);
  assert.match(decide({ ...base, recorded: "cd".repeat(32) }).reason, /names a different build/);
  assert.match(decide({ ...base, recorded: null }).reason, /names no build/);
  assert.match(decide({ ...base, changed: ["assets/figure/figure.json"] }).reason, /assets\/figure\/figure\.json has changed since it was extracted/);
  assert.match(decide({ ...base, unexpected: [{ message: "x" }] }).reason,
    /assets\/figure\/figure\.json records 1 failure\(s\) this command does not expect/,
    "a pack re-extracted by hand with failures is not skipped on the ledger's word");
  assert.match(decide({ ...base, staleDependencies: ["sound"] }).reason, /reads sound, which has changed since it was extracted/);
  assert.equal(decide({ ...base, pack: { ...pack, sha256At: null }, recorded: null }).run, false,
    "a pack that records no build is judged on the ledger alone");
});

/* ──────────────────────────────  whole runs  ─────────────────────────────── */

function sandbox(t, { swfBytes = "a fake SWF, not the game", knownSha = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "extract-all-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const swf = path.join(root, "game dir", SWF_NAME);
  fs.mkdirSync(path.dirname(swf), { recursive: true });
  fs.writeFileSync(swf, swfBytes);
  const sha = crypto.createHash("sha256").update(swfBytes).digest("hex");
  fs.mkdirSync(path.join(root, "docs", "integration"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "integration", "ss2-build-fingerprint.json"), JSON.stringify({
    steam: { buildId: 1 },
    collection: { ss2: { relativePath: "swf/swords_sandals2_download.swf", sha256: (knownSha ?? sha).toUpperCase() } }
  }));
  fs.mkdirSync(path.join(root, "assets"));
  return { root, swf, sha };
}

/**
 * A stub extractor that writes each output as a real one would — naming the
 * build it read — and bumps the file's mtime so a rewrite inside one
 * filesystem clock tick is still seen as one. Every run writes a new
 * `generation`, as a changed extractor writes a changed pack; a test that
 * needs a re-extraction to come out byte-identical uses `writingRunner`.
 */
let generation = 0;

/** Where a stub extractor writes `output`: into the folder `--out` names, as a real one does. */
function outFile(options, output) {
  assert.ok(options?.out, "an extractor is always handed --out");
  fs.mkdirSync(options.out, { recursive: true });
  return path.join(options.out, path.posix.basename(output));
}

function stubRunner(root, { behave = {} } = {}) {
  const calls = [];
  let tick = Date.now() / 1000;
  const runner = (pack, swfPath, options) => {
    calls.push(pack.name);
    const how = behave[pack.name] ?? "ok";
    if (how === "fail") return { status: 1, signal: null, error: null, stdout: "working…\n", stderr: "Error: the stub broke\n" };
    if (how === "silent") return { status: 0, signal: null, error: null, stdout: "", stderr: "" };
    const sha = how === "other-build" ? "ee".repeat(32) : crypto.createHash("sha256").update(fs.readFileSync(swfPath)).digest("hex");
    for (const output of pack.outputs) {
      const file = outFile(options, output);
      generation += 1;
      fs.writeFileSync(file, JSON.stringify({ sha256: sha, source: { sha256: sha }, generation }));
      tick += 5;
      fs.utimesSync(file, tick, tick);
    }
    return { status: 0, signal: null, error: null, stdout: "", stderr: "" };
  };
  return { runner, calls };
}

/** Everything `main` needs, fenced to the sandbox: a probe outside it fails the test. */
function run(argv, { root, packs, runner, digests = {}, hashFile, env = {}, cwd = root, isAlive, rename, mkdir, breakWrite = null }) {
  const lines = [];
  const probe = (target) => {
    assert.ok(path.resolve(target).startsWith(root), `probed outside the sandbox: ${target}`);
    try {
      const stats = fs.statSync(target);
      return stats.isFile() ? "file" : stats.isDirectory() ? "dir" : null;
    } catch {
      return null;
    }
  };
  const status = main(argv, {
    repoRoot: root,
    cwd,
    env,
    platform: "linux",
    home: path.join(root, "no-home"),
    release: "6.8.0-generic",
    probe,
    readText: () => null,
    runExtractor: runner,
    digestOf: (pack) => digests[pack.name] ?? "digest-1",
    packs,
    // `breakWrite`: a line matching it throws, as a write to a closed terminal
    // does — the one failure a pack's own error handling cannot absorb.
    write: (line) => {
      if (breakWrite && breakWrite.test(line)) throw new Error("the terminal went away");
      lines.push(line);
    },
    writeError: (line) => lines.push(`ERR ${line}`),
    progress: null,
    ...(hashFile ? { hashFile } : {}),
    ...(isAlive ? { isAlive } : {}),
    ...(rename ? { rename } : {}),
    ...(mkdir ? { mkdir } : {})
  });
  return { status, text: lines.join("\n"), lines };
}

const threePacks = () => [stubPack("sound"), stubPack("figure", ["sound"]), stubPack("screens", [], { arena: false, reader: "tools/screens" })];

test("a first run extracts every pack in order, writes the ledger, and says what the arena can use", (t) => {
  const box = sandbox(t);
  const { runner, calls } = stubRunner(box.root);
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner });
  assert.equal(result.status, 0, result.text);
  assert.deepEqual(calls, ["sound", "figure", "screens"]);
  assert.match(result.text, /found via the path you gave/);
  assert.match(result.text, /the build this project knows/);
  for (const name of ["sound", "figure", "screens"]) assert.match(result.text, new RegExp(`^  ok       ${name}`, "m"));
  assert.match(result.text, /the arena can now use:\n  sound .*\n  figure .*/);
  assert.match(result.text, /also: the screens feature/, "a pack the arena does not read is not listed as the arena's");
  const ledger = JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8"));
  assert.deepEqual(Object.keys(ledger.packs), ["sound", "figure", "screens"]);
  assert.equal(ledger.packs.figure.swfSha256, box.sha);
  assert.equal(ledger.packs.figure.toolDigest, "digest-1");
});

test("a second run with the same SWF skips every pack and runs no extractor; --force runs them all", (t) => {
  const box = sandbox(t);
  const first = stubRunner(box.root);
  run([box.swf], { root: box.root, packs: threePacks(), runner: first.runner });

  const second = stubRunner(box.root);
  const again = run([box.swf], { root: box.root, packs: threePacks(), runner: second.runner });
  assert.equal(again.status, 0, again.text);
  assert.deepEqual(second.calls, []);
  assert.equal(again.lines.filter((line) => /^  skipped  /.test(line)).length, 3, again.text);
  assert.match(again.text, /the arena can now use:\n  sound/, "a skipped pack is still usable");

  const forced = stubRunner(box.root);
  const redo = run([box.swf, "--force"], { root: box.root, packs: threePacks(), runner: forced.runner });
  assert.equal(redo.status, 0, redo.text);
  assert.deepEqual(forced.calls, ["sound", "figure", "screens"]);
});

test("a changed extractor redoes its pack AND the packs that read it, and nothing else", (t) => {
  const box = sandbox(t);
  run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
  const next = stubRunner(box.root);
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner: next.runner, digests: { sound: "digest-2" } });
  assert.deepEqual(next.calls, ["sound", "figure"]);
  assert.match(result.text, /figure .*it reads sound, which has changed since it was extracted/);
  assert.match(result.text, /skipped  screens/);
});

test("a pack's dependency is remembered ACROSS runs: `--only sound` today redoes figure on the next full run", (t) => {
  const box = sandbox(t);
  run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
  const only = stubRunner(box.root);
  assert.equal(run(["--only", "sound", "--force", box.swf], { root: box.root, packs: threePacks(), runner: only.runner }).status, 0);
  assert.deepEqual(only.calls, ["sound"]);

  const full = stubRunner(box.root);
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner: full.runner });
  assert.deepEqual(full.calls, ["figure"], result.text);
  assert.match(result.text, /^  skipped  sound/m);
  assert.match(result.text, /^  ok       figure .*it reads sound, which has changed since it was extracted/m);
  const settled = stubRunner(box.root);
  run([box.swf], { root: box.root, packs: threePacks(), runner: settled.runner });
  assert.deepEqual(settled.calls, [], "and once redone, it is left alone");
});

test("a pack extracted BEFORE what it reads existed is redone once it does", (t) => {
  const box = sandbox(t);
  const figureFirst = stubRunner(box.root);
  run(["--only", "figure", box.swf], { root: box.root, packs: threePacks(), runner: figureFirst.runner });
  assert.deepEqual(figureFirst.calls, ["figure"]);
  run(["--only", "sound", box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
  const full = stubRunner(box.root);
  run([box.swf], { root: box.root, packs: threePacks(), runner: full.runner });
  assert.deepEqual(full.calls, ["figure", "screens"]);
});

test("a dependency re-extracted to the SAME bytes does not redo what reads it: it is judged on what it reads", (t) => {
  const box = sandbox(t);
  const same = () => writingRunner(box.root, (pack, sha) => ({ sha256: sha }));
  run([box.swf], { root: box.root, packs: threePacks(), runner: same().runner });
  const again = same();
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner: again.runner, digests: { sound: "digest-2" } });
  assert.deepEqual(again.calls, ["sound"], result.text);
  assert.match(result.text, /^  skipped  figure/m);
});

test("a deleted output, or a pack re-extracted by hand from another build, is redone", (t) => {
  const box = sandbox(t);
  run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
  fs.rmSync(path.join(box.root, "assets", "screens", "screens.json"));
  fs.writeFileSync(path.join(box.root, "assets", "sound", "sound.json"), JSON.stringify({ sha256: "cd".repeat(32) }));
  const next = stubRunner(box.root);
  run([box.swf], { root: box.root, packs: threePacks(), runner: next.runner });
  assert.deepEqual(next.calls, ["sound", "figure", "screens"]);
});

test("a different SWF redoes every pack", (t) => {
  const box = sandbox(t);
  run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
  const ledgerFile = path.join(box.root, LEDGER_PATH);
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
  for (const entry of Object.values(ledger.packs)) entry.swfSha256 = "cd".repeat(32);
  fs.writeFileSync(ledgerFile, JSON.stringify(ledger));
  const next = stubRunner(box.root);
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner: next.runner });
  assert.deepEqual(next.calls, ["sound", "figure", "screens"]);
  assert.match(result.text, /last extracted from a different build \(cdcdcdcdcdcd…\)/);
});

test("--only runs just those packs and leaves the others' ledger entries alone", (t) => {
  const box = sandbox(t);
  run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
  const next = stubRunner(box.root);
  const result = run(["--only", "figure", "--force", box.swf], { root: box.root, packs: threePacks(), runner: next.runner });
  assert.equal(result.status, 0, result.text);
  assert.deepEqual(next.calls, ["figure"]);
  const ledger = JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8"));
  assert.deepEqual(Object.keys(ledger.packs).sort(), ["figure", "screens", "sound"]);
  assert.equal(run(["--only", "nope", box.swf], { root: box.root, packs: threePacks(), runner: next.runner }).status, 2);
});

test("a failed pack says so with a retry command, the rest still run, the ledger forgets it, and the exit is 1", (t) => {
  const box = sandbox(t);
  const { runner, calls } = stubRunner(box.root, { behave: { sound: "fail" } });
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner });
  assert.equal(result.status, 1, result.text);
  assert.deepEqual(calls, ["sound", "figure", "screens"]);
  assert.match(result.text, /^  FAILED   sound +rejected \(exit 1: Error: the stub broke\); nothing was installed$/m);
  assert.ok(result.text.includes(`retry: node tools/extract-all.mjs --only sound --verbose ${quoteForShell(box.swf)}`), result.text);
  assert.ok(result.text.includes(`--verbose '${box.swf}'`), "a path with a space is quoted");
  assert.match(result.text, /not refreshed .*\n  sound +no sound/);
  const ledger = JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8"));
  assert.equal(ledger.packs.sound, undefined);
});

test("a pack that fails over an earlier good copy says the arena still reads that copy, and the ledger stops vouching for it", (t) => {
  const box = sandbox(t);
  run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
  const { runner } = stubRunner(box.root, { behave: { sound: "fail" } });
  const result = run([box.swf, "--force"], { root: box.root, packs: threePacks(), runner });
  assert.equal(result.status, 1);
  assert.match(result.text, /not refreshed .*\n  sound +assets\/sound\/ keeps the previous pack/);
  const ledger = JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8"));
  assert.equal(ledger.packs.sound, undefined, "so the next plain run redoes it rather than skipping it");
  const next = stubRunner(box.root);
  run([box.swf], { root: box.root, packs: threePacks(), runner: next.runner });
  assert.deepEqual(next.calls, ["sound", "figure"]);
});

/**
 * A runner whose extractors exit 0 and write, for every output, what
 * `content(pack, sha)` returns — so a test controls what a pack says about
 * itself. The mtime is bumped as `stubRunner` does.
 */
function writingRunner(root, content) {
  const calls = [];
  let tick = Date.now() / 1000;
  const runner = (pack, swfPath, options) => {
    calls.push(pack.name);
    const sha = crypto.createHash("sha256").update(fs.readFileSync(swfPath)).digest("hex");
    for (const output of pack.outputs) {
      const file = outFile(options, output);
      fs.writeFileSync(file, JSON.stringify(content(pack, sha, output)));
      tick += 5;
      fs.utimesSync(file, tick, tick);
    }
    return { status: 0, signal: null, error: null, stdout: "", stderr: "" };
  };
  return { runner, calls };
}

test("a pack that exits 0 but RECORDS failures is a failure: exit 1, no ledger entry, redone on the next run", (t) => {
  const box = sandbox(t);
  const packs = threePacks();
  const broken = [{ id: 7, message: "shape 7 would not parse" }, { id: 8, message: "x" }, { id: 9, message: "y" }];
  const { runner } = writingRunner(box.root, (pack, sha) => ({ sha256: sha, failures: pack.name === "figure" ? broken : [] }));
  const result = run([box.swf], { root: box.root, packs, runner });
  assert.equal(result.status, 1, result.text);
  assert.match(result.text,
    /^  FAILED   figure +rejected \(assets\/figure\/figure\.json records 3 failure\(s\) this command does not expect; the first: 7: shape 7 would not parse\); nothing was installed$/m);
  assert.match(result.text, /^  ok       sound /m, "an empty list is no failure");
  assert.match(result.text, /not refreshed .*\n  figure +no figure/);
  assert.equal(fs.existsSync(path.join(box.root, "assets", "figure", "figure.json")), false, "a rejected pack is never installed");
  const ledger = JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8"));
  assert.equal(ledger.packs.figure, undefined, "the ledger never vouches for it");
  assert.ok(ledger.packs.sound);

  const next = writingRunner(box.root, (pack, sha) => ({ sha256: sha, failures: pack.name === "figure" ? broken : [] }));
  const again = run([box.swf], { root: box.root, packs, runner: next.runner });
  assert.deepEqual(next.calls, ["figure"], "and the next plain run tries it again");
  assert.equal(again.status, 1);
});

/** The two failures the known build's props extraction records, verbatim from its manifest. */
const PANEL_TEXT_FAILURES = [
  { linkage: "panel", id: 1531, message: "frame 1 carries text (character 1527), dropping 1 own glow" },
  { linkage: "panel", id: 1531, message: "frame 1 carries text (character 1528), dropping 1 own glow" }
];

test("the props pack's two panel text fields are TOLERATED by name, and nothing else is", (t) => {
  const props = PACKS.find((pack) => pack.name === "props");
  const content = (failures) => (pack, sha) => ({ sha256: sha, failures });

  const box = sandbox(t);
  const known = writingRunner(box.root, content(PANEL_TEXT_FAILURES));
  const result = run([box.swf], { root: box.root, packs: [props], runner: known.runner });
  assert.equal(result.status, 0, result.text);
  assert.match(result.text, /^  ok       props .*\[2 tolerated failure\(s\) in assets\/props\/manifest\.json: panel's text fields/m);
  assert.ok(JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8")).packs.props, "a tolerated pack is ledgered");
  const again = run([box.swf], { root: box.root, packs: [props], runner: known.runner });
  assert.match(again.text, /^  skipped  props/m);
  assert.match(again.text, /  props +.*\[2 tolerated failure\(s\)\]/, "and it is still said when the pack is skipped");

  for (const [what, extra] of [
    ["another text field on panel", { linkage: "panel", id: 1531, message: "frame 2 carries text (character 1600)" }],
    ["the same message on another prop", { linkage: "sky", id: 1531, message: PANEL_TEXT_FAILURES[0].message }],
    ["the same message under another id", { linkage: "panel", id: 1532, message: PANEL_TEXT_FAILURES[0].message }]
  ]) {
    const other = sandbox(t);
    const { runner } = writingRunner(other.root, content([...PANEL_TEXT_FAILURES, extra]));
    const failed = run([other.swf], { root: other.root, packs: [props], runner });
    assert.equal(failed.status, 1, `${what}: ${failed.text}`);
    assert.match(failed.text, /FAILED   props +rejected \(assets\/props\/manifest\.json records 1 failure\(s\) this command does not expect/, what);
  }
});

test("the sound pack's own record of what it skipped counts as a failure", (t) => {
  const sound = PACKS.find((pack) => pack.name === "sound");
  const box = sandbox(t);
  const { runner } = writingRunner(box.root, (pack, sha) => ({ source: { sha256: sha }, skipped: 2, sounds: [], bindings: {} }));
  const result = run([box.swf], { root: box.root, packs: [sound], runner });
  assert.equal(result.status, 1, result.text);
  assert.match(result.text, /FAILED   sound +rejected \(assets\/sound\/manifest\.json records 2 failure\(s\) this command does not expect; the first: .*cannot repack/);

  const clean = sandbox(t);
  const ok = writingRunner(clean.root, (pack, sha) => ({ source: { sha256: sha }, skipped: 0, sounds: [], bindings: {} }));
  assert.equal(run([clean.swf], { root: clean.root, packs: [sound], runner: ok.runner }).status, 0);
});

/* ───────────────────  the files a manifest names  ──────────────────── */

/**
 * A runner for the REAL sound and bitmaps packs: each writes its manifest,
 * shaped as the real extractor's is, and the media files it names — all of
 * them, unless `skip` names one to leave out. `names` overrides what the
 * manifest names, so a test can make it name something odd.
 */
function mediaRunner(root, { skip = [], names = null, bindingOnly = null, cueOnly = null, bytes = null, build = null } = {}) {
  const calls = [];
  let tick = Date.now() / 1000;
  const runner = (pack, swfPath, options) => {
    const put = (relative, data) => {
      const file = outFile(options, relative);
      fs.writeFileSync(file, data);
      tick += 5;
      fs.utimesSync(file, tick, tick);
    };
    calls.push(pack.name);
    // `bytes`: what every media file holds (3 bytes, the size the manifest
    // records); `build`: a different sha256 for the manifest to name.
    const sha = build ?? crypto.createHash("sha256").update(fs.readFileSync(swfPath)).digest("hex");
    if (pack.name === "sound") {
      const files = names ?? ["1.mp3", "2.mp3", "3.mp3"];
      // Only plain names are written: the odd ones a test hands in stay unwritten.
      for (const file of files) if (!skip.includes(file) && /^[^\\/]+$/.test(file) && file !== "..") put(`assets/sound/${file}`, bytes ?? "mp3");
      put("assets/sound/manifest.json", JSON.stringify({
        source: { sha256: sha }, skipped: 0,
        // Every sound the pack wrote, a binding (1.mp3) and a cue (2.mp3):
        // the three places the arena reads a sound's file name from.
        sounds: files.map((file, index) => ({ file, id: index + 1, bytes: 3 })),
        // `bindingOnly`/`cueOnly`: a name ONLY a binding or a cue carries, never written.
        bindings: { Attack: [files[0]], ...(bindingOnly ? { Block: [bindingOnly] } : {}) },
        cues: { labels: { Attack: { firstFrame: 1, frames: 2, sounds: [
          { file: files[1], id: 2, frame: 1 },
          ...(cueOnly ? [{ file: cueOnly, id: 9, frame: 2 }] : [])
        ] } } }
      }));
    } else if (pack.name === "bitmaps") {
      for (const file of ["7.jpg", "7-alpha.png"]) if (!skip.includes(file)) put(`assets/bitmaps/${file}`, bytes ?? "img");
      put("assets/bitmaps/manifest.json", JSON.stringify({
        sha256: sha, failures: [],
        bitmaps: { 7: { file: "7.jpg", alpha: "7-alpha.png", width: 1, height: 1, bytes: 3 } }
      }));
    } else {
      throw new Error(`mediaRunner has no ${pack.name}`);
    }
    return { status: 0, signal: null, error: null, stdout: "", stderr: "" };
  };
  return { runner, calls };
}

const mediaPacks = () => PACKS.filter((pack) => pack.name === "sound" || pack.name === "bitmaps");

test("a media file the sound or bitmaps manifest names is part of the pack: deleted, or cut short, it is redone", (t) => {
  for (const [lost, pack, damage] of [
    ["assets/sound/1.mp3", "sound", "delete"],          // named by `sounds` and a binding
    ["assets/sound/2.mp3", "sound", "delete"],          // named by `sounds` and a cue
    ["assets/bitmaps/7-alpha.png", "bitmaps", "delete"], // an alpha plane
    ["assets/bitmaps/7.jpg", "bitmaps", "truncate"],   // on disk, but not the size the manifest records
    ["assets/sound/3.mp3", "sound", "truncate"]
  ]) {
    const box = sandbox(t);
    const first = run([box.swf], { root: box.root, packs: mediaPacks(), runner: mediaRunner(box.root).runner });
    assert.equal(first.status, 0, first.text);
    if (damage === "delete") fs.rmSync(path.join(box.root, lost));
    else fs.writeFileSync(path.join(box.root, lost), "x");
    const next = mediaRunner(box.root);
    const result = run([box.swf], { root: box.root, packs: mediaPacks(), runner: next.runner });
    assert.deepEqual(next.calls, [pack], `${lost}: ${result.text}`);
    assert.ok(result.text.includes(damage === "delete" ? `${lost} is missing` : `${lost} is 1 bytes, not the 3`), `${lost}: ${result.text}`);
    assert.equal(result.status, 0, result.text);
  }
});

test("a file the pack holds, changed after the ledger vouched for it, is redone — sizes on record or not", (t) => {
  for (const [changedFile, pack, how] of [
    ["assets/bitmaps/7-alpha.png", "bitmaps", "truncate"], // an alpha plane: the manifest records no size for it
    ["assets/bitmaps/7-alpha.png", "bitmaps", "rewrite"],  // same size, new bytes
    ["assets/sound/manifest.json", "sound", "touch"]       // an output rewritten in place, byte for byte
  ]) {
    const box = sandbox(t);
    run([box.swf], { root: box.root, packs: mediaPacks(), runner: mediaRunner(box.root).runner });
    const file = path.join(box.root, changedFile);
    if (how === "truncate") fs.writeFileSync(file, "");
    else if (how === "rewrite") fs.writeFileSync(file, "IMG");
    else {
      const later = fs.statSync(file).mtimeMs / 1000 + 60;
      fs.utimesSync(file, later, later);
    }
    const next = mediaRunner(box.root);
    const result = run([box.swf], { root: box.root, packs: mediaPacks(), runner: next.runner });
    assert.deepEqual(next.calls, [pack], `${changedFile} (${how}): ${result.text}`);
    assert.ok(result.text.includes(`${changedFile} has changed since it was extracted`), `${changedFile} (${how}): ${result.text}`);
  }
});

test("an output that is no longer a FILE (a folder in its place) is redone, not skipped", (t) => {
  // shapes.json is not the file the pack records its build in, so only the
  // file check can see it; an alpha plane is named by the manifest, with no
  // size on record to disagree with a folder's.
  const twoFiles = () => [stubPack("figure", [], { outputs: ["assets/figure/figure.json", "assets/figure/shapes.json"] })];
  for (const [victim, packs, runnerFor] of [
    ["assets/figure/shapes.json", twoFiles, stubRunner],
    ["assets/bitmaps/7-alpha.png", mediaPacks, mediaRunner]
  ]) {
    const box = sandbox(t);
    run([box.swf], { root: box.root, packs: packs(), runner: runnerFor(box.root).runner });
    fs.rmSync(path.join(box.root, victim));
    fs.mkdirSync(path.join(box.root, victim));
    const next = runnerFor(box.root);
    // The stub cannot write over a folder, as a real extractor could not: the
    // point is that the pack is not SKIPPED.
    let text = "";
    try {
      text = run([box.swf], { root: box.root, packs: packs(), runner: next.runner }).text;
    } catch (error) {
      text = String(error);
    }
    assert.ok(next.calls.includes(victim.split("/")[1]), `${victim}: ${text}`);
  }
});

test("an extractor that leaves out a file its own manifest names FAILS, and the ledger does not vouch for it", (t) => {
  for (const [skip, pack] of [["3.mp3", "sound"], ["7-alpha.png", "bitmaps"]]) {
    const box = sandbox(t);
    const result = run([box.swf], { root: box.root, packs: mediaPacks(), runner: mediaRunner(box.root, { skip: [skip] }).runner });
    assert.equal(result.status, 1, result.text);
    assert.match(result.text, new RegExp(`FAILED   ${pack} +rejected \\(wrote assets/${pack}/manifest\\.json, but 1 file\\(s\\) it names are missing: assets/${pack}/${skip.replace(".", "\\.")}`));
    assert.equal(fs.existsSync(path.join(box.root, "assets", pack, "manifest.json")), false, `${pack}: nothing installed`);
    const ledger = JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8"));
    assert.equal(ledger.packs[pack], undefined, pack);
  }
  // A binding or a cue is read by the arena on its own, so a name only it carries counts too.
  for (const [how, options] of [["a binding", { bindingOnly: "8.mp3" }], ["a cue", { cueOnly: "9.mp3" }]]) {
    const box = sandbox(t);
    const result = run([box.swf], { root: box.root, packs: PACKS.filter((pack) => pack.name === "sound"), runner: mediaRunner(box.root, options).runner });
    assert.equal(result.status, 1, `${how}: ${result.text}`);
    assert.match(result.text, /FAILED   sound +rejected \(wrote assets\/sound\/manifest\.json, but 1 file\(s\) it names are missing: assets\/sound\/[89]\.mp3/, how);
  }
});

test("a manifest naming a file OUTSIDE its pack's folder fails the pack, even when that file exists", (t) => {
  for (const odd of ["../escape.mp3", "sub/../../escape.mp3", "/etc/hostname", "..", ""]) {
    const box = sandbox(t);
    // The file the escaping name points at IS there, so existence alone would pass it.
    fs.writeFileSync(path.join(box.root, "assets", "escape.mp3"), "mp3");
    const sound = PACKS.filter((pack) => pack.name === "sound");
    const result = run([box.swf], { root: box.root, packs: sound, runner: mediaRunner(box.root, { names: ["1.mp3", odd] }).runner });
    assert.equal(result.status, 1, `${JSON.stringify(odd)}: ${result.text}`);
    assert.ok(result.text.includes(`assets/sound/manifest.json names ${JSON.stringify(odd)}, which is not a file name inside assets/sound/`),
      `${JSON.stringify(odd)}: ${result.text}`);
  }
});

test("an extractor that exits 0 and writes nothing is a FAILURE, not an ok", (t) => {
  // The shape of the old main-module guard: the process ran, did nothing, and succeeded.
  const box = sandbox(t);
  const { runner } = stubRunner(box.root, { behave: { figure: "silent" } });
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner });
  assert.equal(result.status, 1);
  assert.match(result.text, /FAILED   figure +rejected \(exited 0 but did not write assets\/figure\/figure\.json\); nothing was installed$/m);
});

/** Every INSTALLED file under the sandbox's assets/ (not the ledger, lock or staging), with its bytes. */
function assetsSnapshot(root) {
  const base = path.join(root, "assets");
  const out = {};
  for (const name of fs.readdirSync(base, { recursive: true }).map(String).sort()) {
    const file = path.join(base, name);
    if (fs.statSync(file).isFile() && !name.startsWith("extract-all.") && !name.startsWith(".extract-all-staging")) {
      out[name] = fs.readFileSync(file, "utf8");
    }
  }
  return out;
}

test("a rewrite that leaves the mtime where it was is still a rewrite: judged by fresh files, not by timestamps", (t) => {
  // A filesystem with a coarse clock, or a quick --force, can rewrite a file
  // inside one timestamp tick. The runner here pins every mtime it touches
  // back to what it was before.
  const box = sandbox(t);
  run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
  // Pinned to a moment long past, so no rule about "recent" files can pass it either.
  const past = Date.UTC(2020, 0, 1);
  const pinned = new Map(threePacks().flatMap((pack) => pack.outputs).map((output) => [output, past]));
  for (const output of pinned.keys()) fs.utimesSync(path.join(box.root, output), past / 1000, past / 1000);
  const inner = stubRunner(box.root);
  const sameTick = (pack, swfPath, options) => {
    const result = inner.runner(pack, swfPath, options);
    for (const output of pack.outputs) fs.utimesSync(outFile(options, output), pinned.get(output) / 1000, pinned.get(output) / 1000);
    return result;
  };
  const result = run([box.swf, "--force"], { root: box.root, packs: threePacks(), runner: sameTick });
  assert.equal(result.status, 0, result.text);
  assert.deepEqual(inner.calls, ["sound", "figure", "screens"]);
  for (const [output, mtime] of pinned) assert.equal(fs.statSync(path.join(box.root, output)).mtimeMs, mtime, `${output} kept its mtime`);
});

test("an extractor that fails or writes nothing over a good copy leaves that copy exactly as it was, and no litter", (t) => {
  for (const how of ["silent", "fail", "partial"]) {
    const box = sandbox(t);
    run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
    const before = assetsSnapshot(box.root);
    const inner = stubRunner(box.root, { behave: { figure: how === "partial" ? "ok" : how } });
    // "partial": the extractor writes its output, then exits 1.
    const runner = how === "partial"
      ? (pack, swfPath, options) => {
        const result = inner.runner(pack, swfPath, options);
        return pack.name === "figure" ? { ...result, status: 1, stderr: "died after writing\n" } : result;
      }
      : inner.runner;
    const result = run([box.swf, "--only", "figure", "--force"], { root: box.root, packs: threePacks(), runner });
    assert.equal(result.status, 1, `${how}: ${result.text}`);
    assert.deepEqual(assetsSnapshot(box.root), before, `${how}: the previous figure pack is back, byte for byte`);
    assert.deepEqual(fs.readdirSync(path.join(box.root, "assets", "figure")), ["figure.json"], `${how}: nothing staged is left behind`);
    assert.match(result.text, /\n  figure +assets\/figure\/ keeps the previous pack/, how);
  }
});

test("a pack that exits 0 but FAILS A CHECK over a previous pack leaves every installed file byte-identical, media included", (t) => {
  // The player is never worse off for having run the tool: a replacement is
  // built in staging and installed only once every check has passed. The
  // rejected runs below write DIFFERENT media bytes, so a media file touched
  // in place would show.
  for (const [check, packs, nextRunner, name] of [
    ["another build", threePacks, (root) => stubRunner(root, { behave: { figure: "other-build" } }), "figure"],
    ["recorded failures", threePacks,
      (root) => writingRunner(root, (pack, sha) => ({ sha256: sha, failures: pack.name === "figure" ? [{ id: 1, message: "x" }] : [] })), "figure"],
    ["missing media", mediaPacks, (root) => mediaRunner(root, { bindingOnly: "8.mp3", bytes: "NEW" }), "sound"],
    ["media from another build", mediaPacks, (root) => mediaRunner(root, { build: "ee".repeat(32), bytes: "NEW" }), "sound"],
    ["an alpha plane missing", mediaPacks, (root) => mediaRunner(root, { skip: ["7-alpha.png"], bytes: "NEW" }), "bitmaps"]
  ]) {
    const box = sandbox(t);
    const first = packs === mediaPacks ? mediaRunner(box.root) : stubRunner(box.root);
    assert.equal(run([box.swf], { root: box.root, packs: packs(), runner: first.runner }).status, 0, check);
    const before = assetsSnapshot(box.root);
    const result = run([box.swf, "--only", name, "--force"], { root: box.root, packs: packs(), runner: nextRunner(box.root).runner });
    assert.equal(result.status, 1, `${check}: ${result.text}`);
    assert.match(result.text, new RegExp(`^  FAILED   ${name} +rejected \\(.+\\); the previous pack was kept$`, "m"), `${check}: ${result.text}`);
    assert.deepEqual(assetsSnapshot(box.root), before, `${check}: every installed file, byte for byte`);
    assert.match(result.text, new RegExp(`\\n  ${name} +assets/${name}/ keeps the previous pack`), check);
    assert.equal(JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8")).packs[name], undefined, `${check}: not vouched for`);
  }
});

test("with NO previous pack, a rejected extraction installs nothing", (t) => {
  const box = sandbox(t);
  const { runner } = stubRunner(box.root, { behave: { figure: "other-build" } });
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner });
  assert.equal(result.status, 1, result.text);
  assert.match(result.text, /^  FAILED   figure +rejected \(wrote assets\/figure\/figure\.json naming eeeeeeeeeeee.*\); nothing was installed$/m);
  assert.equal(fs.existsSync(path.join(box.root, "assets", "figure", "figure.json")), false);
  assert.match(result.text, /\n  figure +no figure/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8")).packs.figure, undefined);
});

test("a rejected run installs nothing, not even a file the previous pack lacked", (t) => {
  const box = sandbox(t);
  const twoFiles = () => [stubPack("figure", [], { outputs: ["assets/figure/figure.json", "assets/figure/shapes.json"] })];
  run([box.swf], { root: box.root, packs: twoFiles(), runner: stubRunner(box.root).runner });
  fs.rmSync(path.join(box.root, "assets", "figure", "shapes.json"));
  const before = assetsSnapshot(box.root);
  const result = run([box.swf], { root: box.root, packs: twoFiles(), runner: stubRunner(box.root, { behave: { figure: "other-build" } }).runner });
  assert.equal(result.status, 1, result.text);
  assert.deepEqual(assetsSnapshot(box.root), before);
});

test("packs that SHARE a folder are staged apart: one rejected leaves the other's files, and its own old ones, as they were", (t) => {
  const box = sandbox(t);
  const shared = () => [
    stubPack("figure", [], { outputs: ["assets/figure/figure.json"] }),
    stubPack("wardrobe", [], { outputs: ["assets/figure/wardrobe.json"] })
  ];
  assert.equal(run([box.swf], { root: box.root, packs: shared(), runner: stubRunner(box.root).runner }).status, 0);
  assert.deepEqual(fs.readdirSync(path.join(box.root, "assets", "figure")).sort(), ["figure.json", "wardrobe.json"], "each installed its own");
  const before = assetsSnapshot(box.root);
  const result = run([box.swf, "--force"], { root: box.root, packs: shared(), runner: stubRunner(box.root, { behave: { wardrobe: "other-build" } }).runner });
  assert.equal(result.status, 1, result.text);
  const after = assetsSnapshot(box.root);
  assert.equal(after["figure/wardrobe.json"], before["figure/wardrobe.json"], "the rejected pack's old file stands");
  assert.notEqual(after["figure/figure.json"], before["figure/figure.json"], "the accepted pack beside it was installed");
});

test("a pack that READS another reads the installed one, refreshed earlier in the same run", (t) => {
  const box = sandbox(t);
  run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
  const inner = stubRunner(box.root);
  let soundAsFigureSawIt = null;
  let soundJustWritten = null;
  const runner = (pack, swfPath, options) => {
    const result = inner.runner(pack, swfPath, options);
    if (pack.name === "sound") soundJustWritten = fs.readFileSync(outFile(options, "assets/sound/sound.json"), "utf8");
    if (pack.name === "figure") soundAsFigureSawIt = fs.readFileSync(path.join(box.root, "assets", "sound", "sound.json"), "utf8");
    return result;
  };
  assert.equal(run([box.swf, "--force"], { root: box.root, packs: threePacks(), runner }).status, 0);
  assert.equal(soundAsFigureSawIt, soundJustWritten, "figure ran against the sound pack this run installed");
});

test("staging sits BESIDE the pack folders, so a path an extractor computes from --out is the one it would compute from assets/<dir>", (t) => {
  // extract-figure.mjs writes the preview's sound path as path.relative(--out, assets/sound).
  const box = sandbox(t);
  const inner = stubRunner(box.root);
  const outs = [];
  const runner = (pack, swfPath, options) => {
    outs.push(options.out);
    assert.equal(fs.readdirSync(options.out).length, 0, "a fresh, empty folder");
    return inner.runner(pack, swfPath, options);
  };
  run([box.swf], { root: box.root, packs: threePacks(), runner });
  for (const out of outs) {
    assert.equal(path.dirname(out), path.join(box.root, "assets"), out);
    assert.equal(path.relative(out, path.join(box.root, "assets", "sound")), path.join("..", "sound"), out);
  }
});

test("a link planted where a staging folder goes is removed, never written through", (t) => {
  const box = sandbox(t);
  const elsewhere = path.join(box.root, "elsewhere");
  fs.mkdirSync(elsewhere);
  fs.writeFileSync(path.join(elsewhere, "sentinel"), "SENTINEL");
  for (const name of ["sound", "figure", "screens"]) {
    fs.symlinkSync(elsewhere, path.join(box.root, "assets", `.extract-all-staging-${process.pid}-${name}`));
  }
  fs.symlinkSync(elsewhere, path.join(box.root, "assets", ".extract-all-staging-1-sound"));
  const inner = stubRunner(box.root);
  const runner = (pack, swfPath, options) => {
    assert.equal(fs.lstatSync(options.out).isSymbolicLink(), false, "--out is a real folder");
    return inner.runner(pack, swfPath, options);
  };
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner });
  assert.equal(result.status, 0, result.text);
  assert.deepEqual(fs.readdirSync(elsewhere), ["sentinel"]);
  assert.equal(fs.readFileSync(path.join(elsewhere, "sentinel"), "utf8"), "SENTINEL");
});

test("an exception mid-extraction fails THAT pack: the installed one is untouched, its staging is gone, and the run goes on", (t) => {
  const box = sandbox(t);
  run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
  const before = assetsSnapshot(box.root);
  const inner = stubRunner(box.root);
  const dying = (pack, swfPath, options) => {
    inner.runner(pack, swfPath, options); // writes its files into staging, then:
    if (pack.name === "figure") throw new Error("killed mid-extraction");
    return { status: 0, signal: null, error: null, stdout: "", stderr: "" };
  };
  const result = run([box.swf, "--force"], { root: box.root, packs: threePacks(), runner: dying });
  assert.equal(result.status, 1, result.text);
  assert.match(result.text, /^  FAILED   figure +rejected \(running the extractor failed: Error: killed mid-extraction\); the previous pack was kept$/m);
  assert.equal(assetsSnapshot(box.root)["figure/figure.json"], before["figure/figure.json"], "figure's installed pack is untouched");
  assert.deepEqual(inner.calls, ["sound", "figure", "screens"], "the run went on");
  assert.deepEqual(fs.readdirSync(path.join(box.root, "assets")).filter((name) => name.startsWith(".extract-all-staging")), [], "its staging is gone");
});

test("staging a crashed run left behind is cleared by the next run", (t) => {
  const box = sandbox(t);
  const crashed = path.join(box.root, "assets", ".extract-all-staging-1-sound");
  fs.mkdirSync(crashed);
  fs.writeFileSync(path.join(crashed, "sound.json"), "half-written");
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
  assert.equal(result.status, 0, result.text);
  assert.equal(fs.existsSync(crashed), false);
});

/** A hashFile that counts its calls: the second one is the closing check. */
function countingHash(sha) {
  const counter = { calls: 0 };
  counter.hashFile = () => {
    counter.calls += 1;
    return sha;
  };
  return counter;
}

const figureTwoFiles = () => [
  stubPack("figure", [], { outputs: ["assets/figure/figure.json", "assets/figure/shapes.json"] }),
  stubPack("screens", [], { arena: false, reader: "tools/screens" })
];

test("an install blocked by a FOLDER where a file goes fails that pack before anything moves; the run goes on and the closing check runs", (t) => {
  const box = sandbox(t);
  run([box.swf], { root: box.root, packs: figureTwoFiles(), runner: stubRunner(box.root).runner });
  const shapes = path.join(box.root, "assets", "figure", "shapes.json");
  fs.rmSync(shapes);
  fs.mkdirSync(shapes);
  fs.writeFileSync(path.join(shapes, "inside"), "a folder with something in it");
  const figureFiles = () => Object.fromEntries(Object.entries(assetsSnapshot(box.root)).filter(([name]) => name.startsWith("figure/")));
  const before = figureFiles();
  const hash = countingHash(box.sha);
  const next = stubRunner(box.root);
  const result = run([box.swf, "--force"], { root: box.root, packs: figureTwoFiles(), runner: next.runner, hashFile: hash.hashFile });
  assert.equal(result.status, 1, result.text);
  assert.match(result.text, /^  FAILED   figure +rejected \(cannot install: assets\/figure\/shapes\.json is a folder, not a file\); the previous pack was kept$/m);
  assert.deepEqual(figureFiles(), before, "not one file of the previous pack was replaced");
  assert.deepEqual(next.calls, ["figure", "screens"], "the run went on");
  assert.equal(hash.calls, 2, "the closing check ran");
  assert.equal(JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8")).packs.figure, undefined);
});

/**
 * A rename that throws EBUSY when PLACING a staged file whose name matches
 * `placing`, or when RESTORING a backup whose name matches `restoring`, and
 * otherwise renames. Placing = from a staging folder into assets/<dir>/.
 */
function flakyRename({ placing = null, restoring = null }) {
  return (from, to) => {
    const fromStaging = from.includes(`${path.sep}.extract-all-staging-`);
    const isBackup = from.includes(`${path.sep}.previous${path.sep}`);
    if (fromStaging && !isBackup && placing?.test(path.basename(to))) throw new Error("EBUSY: resource busy or locked");
    if (isBackup && restoring?.test(path.basename(to))) throw new Error("EBUSY: resource busy or locked");
    fs.renameSync(from, to);
  };
}

/** figure (two files) and wardrobe share assets/figure; screens is elsewhere. */
const sharedFolder = () => [
  stubPack("figure", [], { outputs: ["assets/figure/figure.json", "assets/figure/shapes.json"] }),
  stubPack("wardrobe", [], { outputs: ["assets/figure/wardrobe.json"] }),
  stubPack("screens", [], { arena: false, reader: "tools/screens" })
];

test("a RENAME that fails part-way through installing is UNDONE: every installed file is byte-identical, and the run goes on", (t) => {
  const box = sandbox(t);
  run([box.swf], { root: box.root, packs: sharedFolder(), runner: stubRunner(box.root).runner });
  const figureFolder = () => Object.fromEntries(Object.entries(assetsSnapshot(box.root)).filter(([name]) => name.startsWith("figure/")));
  const before = figureFolder();
  const hash = countingHash(box.sha);
  // figure.json is placed first, then placing shapes.json fails.
  const result = run([box.swf, "--force", "--only", "figure,screens"], {
    root: box.root, packs: sharedFolder(), runner: stubRunner(box.root).runner, hashFile: hash.hashFile, rename: flakyRename({ placing: /^shapes\.json$/ })
  });
  assert.equal(result.status, 1, result.text);
  assert.match(result.text, /^  FAILED   figure +rejected \(installing assets\/figure\/shapes\.json failed: EBUSY: resource busy or locked\); the previous pack was kept$/m);
  assert.deepEqual(figureFolder(), before, "figure's files AND wardrobe's beside them, byte for byte");
  assert.equal(hash.calls, 2, "the closing check ran");
  const ledger = JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8"));
  assert.equal(ledger.packs.figure, undefined, "not vouched for");
  assert.ok(ledger.packs.screens, "the run went on");
  assert.deepEqual(fs.readdirSync(path.join(box.root, "assets")).filter((name) => name.startsWith(".extract-all-staging")), []);
});

test("the undo removes a file it placed that had NO previous copy", (t) => {
  const box = sandbox(t);
  run([box.swf], { root: box.root, packs: sharedFolder(), runner: stubRunner(box.root).runner });
  fs.rmSync(path.join(box.root, "assets", "figure", "figure.json")); // placed first, with nothing to back up
  const before = assetsSnapshot(box.root);
  const result = run([box.swf, "--only", "figure"], { root: box.root, packs: sharedFolder(), runner: stubRunner(box.root).runner, rename: flakyRename({ placing: /^shapes\.json$/ }) });
  assert.equal(result.status, 1, result.text);
  assert.deepEqual(assetsSnapshot(box.root), before);
});

test("an undo that itself fails names exactly the paths that may be mixed, and vouches for nothing", (t) => {
  const box = sandbox(t);
  run([box.swf], { root: box.root, packs: sharedFolder(), runner: stubRunner(box.root).runner });
  const previousFigure = fs.readFileSync(path.join(box.root, "assets", "figure", "figure.json"), "utf8");
  const result = run([box.swf, "--force", "--only", "figure"], {
    root: box.root, packs: sharedFolder(), runner: stubRunner(box.root).runner,
    rename: flakyRename({ placing: /^shapes\.json$/, restoring: /^figure\.json$/ })
  });
  const kept = /its previous copy is in (\S+)\/\)/.exec(result.text)?.[1];
  assert.ok(kept, result.text);
  assert.equal(fs.readFileSync(path.join(box.root, kept, "figure.json"), "utf8"), previousFigure, "the previous copy is where the message says");
  assert.equal(result.status, 1, result.text);
  assert.match(result.text, /^  FAILED   figure +rejected \(installing assets\/figure\/shapes\.json failed: EBUSY: resource busy or locked\); the undo failed too, so these may be mixed: assets\/figure\/figure\.json \(its previous copy is in assets\/\.extract-all-staging-\d+-figure\/\.previous\/\); the next run redoes it$/m);
  assert.equal(JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8")).packs.figure, undefined);
});

test("the closing SWF check runs however the run ends, a throw included", (t) => {
  // A pack's own failure no longer throws; a write to a closed terminal does.
  const box = sandbox(t);
  let calls = 0;
  const hashFile = () => (calls++ === 0 ? box.sha : "ff".repeat(32));
  const failing = stubRunner(box.root, { behave: { sound: "fail" } });
  assert.throws(() => run([box.swf], { root: box.root, packs: threePacks(), runner: failing.runner, hashFile, breakWrite: /^  FAILED/ }),
    /terminal went away/);
  assert.equal(calls, 2, "the closing check ran");
});

test("a regular FILE where a pack's folder goes fails that pack alone: later packs complete and are ledgered", (t) => {
  const box = sandbox(t);
  fs.writeFileSync(path.join(box.root, "assets", "sound"), "not a folder");
  const hash = countingHash(box.sha);
  const { runner, calls } = stubRunner(box.root);
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner, hashFile: hash.hashFile });
  assert.equal(result.status, 1, result.text);
  assert.match(result.text, /^  FAILED   sound +rejected \(assets\/sound is a file, not a folder\); nothing was installed$/m);
  assert.deepEqual(calls, ["figure", "screens"], "refused before its extractor ran; the others ran");
  const ledger = JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8"));
  assert.deepEqual(Object.keys(ledger.packs).sort(), ["figure", "screens"]);
  assert.equal(fs.readFileSync(path.join(box.root, "assets", "sound"), "utf8"), "not a folder");
  assert.equal(hash.calls, 2, "the closing check ran");
});

test("ANY unexpected error fails only its own pack, naming the pack, the operation and the code: an mkdir EACCES here", (t) => {
  const box = sandbox(t);
  const mkdir = (target, options) => {
    if (path.basename(target).endsWith("-sound")) {
      throw Object.assign(new Error(`EACCES: permission denied, mkdir '${target}'`), { code: "EACCES" });
    }
    return fs.mkdirSync(target, options);
  };
  const hash = countingHash(box.sha);
  const { runner, calls } = stubRunner(box.root);
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner, hashFile: hash.hashFile, mkdir });
  assert.equal(result.status, 1, result.text);
  assert.match(result.text, /^  FAILED   sound +rejected \(creating the staging folder failed: EACCES: permission denied, mkdir '.*-sound'\); nothing was installed$/m);
  assert.deepEqual(calls, ["figure", "screens"]);
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8")).packs).sort(), ["figure", "screens"]);
  assert.equal(hash.calls, 2, "the closing check ran");
});

test("a pack that fails AFTER it was installed, while being recorded, is not vouched for", (t) => {
  const box = sandbox(t);
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner, breakWrite: /^  ok       figure/ });
  assert.equal(result.status, 1, result.text);
  assert.match(result.text, /^  FAILED   figure +rejected \(recording the result failed: Error: the terminal went away\); it was installed but not recorded, and the next run redoes it$/m);
  const ledger = JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8"));
  assert.deepEqual(Object.keys(ledger.packs).sort(), ["screens", "sound"]);
});

test("a run, successful or not, leaves no staging behind", (t) => {
  const box = sandbox(t);
  run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
  run([box.swf, "--force"], { root: box.root, packs: threePacks(), runner: stubRunner(box.root, { behave: { figure: "other-build" } }).runner });
  assert.deepEqual(fs.readdirSync(path.join(box.root, "assets")).filter((name) => name.startsWith(".extract-all-staging")), []);
  for (const dir of ["sound", "figure", "screens"]) {
    assert.deepEqual(fs.readdirSync(path.join(box.root, "assets", dir)), [`${dir}.json`], dir);
  }
});

test("a pack that names a different build than the SWF handed to it is a failure", (t) => {
  const box = sandbox(t);
  const { runner } = stubRunner(box.root, { behave: { sound: "other-build" } });
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner });
  assert.equal(result.status, 1);
  assert.match(result.text, /FAILED   sound +rejected \(wrote assets\/sound\/sound\.json naming eeeeeeeeeeee/);
});

test("an unknown build is refused before any extractor runs; --allow-other-build proceeds and says so", (t) => {
  const box = sandbox(t, { knownSha: "12".repeat(32) });
  const refused = stubRunner(box.root);
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner: refused.runner });
  assert.equal(result.status, 2);
  assert.deepEqual(refused.calls, []);
  assert.match(result.text, /NOT the build this project knows/);
  assert.equal(fs.existsSync(path.join(box.root, LEDGER_PATH)), false, "a refusal writes nothing at all");

  const allowed = stubRunner(box.root);
  const anyway = run([box.swf, "--allow-other-build"], { root: box.root, packs: threePacks(), runner: allowed.runner });
  assert.equal(anyway.status, 0, anyway.text);
  assert.deepEqual(allowed.calls, ["sound", "figure", "screens"]);
  assert.match(anyway.text, /every pack above is from .*NOT the build this project knows/);
});

test("the SWF changing during the run fails it loudly", (t) => {
  const box = sandbox(t);
  let reads = 0;
  const hashFile = () => (reads++ === 0 ? box.sha : "ff".repeat(32));
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner, hashFile });
  assert.equal(result.status, 1);
  assert.match(result.text, /THE SWF CHANGED WHILE THIS RAN/);
});

test("the SWF changing during the run un-vouches every pack the run extracted, so a retry redoes them", (t) => {
  // clip-effects records no build of its own, so only the ledger stands
  // between a pack read from the CHANGED file and a retry that skips it.
  const box = sandbox(t);
  const noRecord = [stubPack("sound"), stubPack("clip-effects", [], { sha256At: null })];
  run([box.swf], { root: box.root, packs: [noRecord[0]], runner: stubRunner(box.root).runner });
  let reads = 0;
  const hashFile = () => (reads++ === 0 ? box.sha : "ff".repeat(32));
  const changed = run([box.swf], { root: box.root, packs: noRecord, runner: stubRunner(box.root).runner, hashFile });
  assert.equal(changed.status, 1, changed.text);
  assert.match(changed.text, /^  ok       clip-effects/m);
  const ledger = JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8"));
  assert.deepEqual(Object.keys(ledger.packs), ["sound"], "what this run extracted is no longer vouched for; what it skipped still is");
  const retry = stubRunner(box.root);
  run([box.swf], { root: box.root, packs: noRecord, runner: retry.runner });
  assert.deepEqual(retry.calls, ["clip-effects"]);
});

test("a run that dies part-way vouches for NOTHING it extracted: entries are kept only once the closing hash agrees", (t) => {
  // The shape of the hole: clip-effects records no build of its own, the run
  // is cut off before the closing hash, and a retry would skip it on the
  // ledger's word alone.
  const box = sandbox(t);
  const packs = [stubPack("sound"), stubPack("clip-effects", [], { sha256At: null }), stubPack("icons")];
  run([box.swf], { root: box.root, packs: [packs[2]], runner: stubRunner(box.root).runner });
  // icons fails, and reporting it throws: the run dies after sound and clip-effects finished.
  const dies = stubRunner(box.root, { behave: { icons: "fail" } });
  assert.throws(() => run([box.swf, "--force"], { root: box.root, packs, runner: dies.runner, breakWrite: /^  FAILED   icons/ }),
    /terminal went away/);
  const ledger = JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8"));
  assert.deepEqual(Object.keys(ledger.packs), [], "sound and clip-effects ran but were never vouched for; icons's entry went before it ran");
  const retry = stubRunner(box.root);
  run([box.swf], { root: box.root, packs, runner: retry.runner });
  assert.deepEqual(retry.calls, ["sound", "clip-effects", "icons"]);
});

test("an SWF that cannot be read again after the run counts as changed: exit 1, and the same un-vouching", (t) => {
  const box = sandbox(t);
  const noRecord = [stubPack("sound"), stubPack("clip-effects", [], { sha256At: null })];
  let reads = 0;
  const hashFile = () => {
    if (reads++ === 0) return box.sha;
    throw new Error("ENOENT: the SWF is gone");
  };
  const gone = run([box.swf], { root: box.root, packs: noRecord, runner: stubRunner(box.root).runner, hashFile });
  assert.equal(gone.status, 1, gone.text);
  assert.match(gone.text, /THE SWF COULD NOT BE READ AGAIN AFTER THIS RAN: ENOENT: the SWF is gone/);
  const ledger = JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8"));
  assert.deepEqual(Object.keys(ledger.packs), []);
});

/* ─────────────────  where the extractors will write  ─────────────────── */

/**
 * Plants `plant(box)` in a fresh sandbox, runs, and checks the REFUSAL: exit 2,
 * no extractor started, no ledger, the SWF and every sentinel byte-identical,
 * and each `names` path named in the output.
 */
function assertRefused(t, spec) {
  // Destructured in the body, not the parameter list: test/ss2-assertion-quality
  // finds a helper's body at its first brace, and would read the pattern as it.
  const { plant, names, packs = threePacks, argv = [] } = spec;
  const box = sandbox(t);
  const sentinel = path.join(box.root, "outside", "sentinel.bin");
  fs.mkdirSync(path.dirname(sentinel), { recursive: true });
  fs.writeFileSync(sentinel, "SENTINEL: nothing may write here");
  plant(box, sentinel);
  const swfBefore = fs.readFileSync(box.swf);
  const { runner, calls } = stubRunner(box.root);
  let result;
  try {
    result = run([box.swf, ...argv], { root: box.root, packs: packs(), runner });
  } finally {
    // Checked even if `main` threw: these are the point of the refusal.
    assert.deepEqual(fs.readFileSync(box.swf), swfBefore, "the SWF is untouched");
    assert.equal(fs.readFileSync(sentinel, "utf8"), "SENTINEL: nothing may write here", "the sentinel is untouched");
  }
  assert.equal(result.status, 2, result.text);
  assert.deepEqual(calls, [], "no extractor ran");
  assert.equal(fs.existsSync(path.join(box.root, LEDGER_PATH)), false, "no ledger was written");
  assert.match(result.text, /^ERR Refused: /m, result.text);
  assert.match(result.text, /Nothing was written\./);
  for (const name of names) assert.ok(result.text.includes(name), `names ${name}: ${result.text}`);
  return { box, result };
}

test("an output file that is a SYMLINK is refused before any extractor runs: to the SWF, to a sentinel, or dangling", (t) => {
  for (const target of [(box) => box.swf, (box, sentinel) => sentinel, () => "/nonexistent/dangling"]) {
    assertRefused(t, {
      plant(box, sentinel) {
        fs.mkdirSync(path.join(box.root, "assets", "sound"), { recursive: true });
        fs.symlinkSync(target(box, sentinel), path.join(box.root, "assets", "sound", "sound.json"));
      },
      names: ["assets/sound/sound.json is a symbolic link"]
    });
  }
});

test("a symlink the manifest does not name yet (a future MP3) is refused too: every entry of a pack's folder is checked", (t) => {
  assertRefused(t, {
    plant(box) {
      fs.mkdirSync(path.join(box.root, "assets", "sound"), { recursive: true });
      fs.symlinkSync(box.swf, path.join(box.root, "assets", "sound", "1088.mp3"));
    },
    names: ["assets/sound/1088.mp3 is a symbolic link"]
  });
});

test("a pack FOLDER linked into another tree is refused: a worktree must not write through to the main tree's assets/", (t) => {
  assertRefused(t, {
    plant(box, sentinel) {
      // The overnight-worktree shape: assets/<pack> is a link to another checkout's.
      const other = path.join(path.dirname(sentinel), "main-tree", "assets", "figure");
      fs.mkdirSync(other, { recursive: true });
      fs.copyFileSync(sentinel, path.join(other, "figure.json"));
      fs.symlinkSync(other, path.join(box.root, "assets", "figure"));
    },
    names: ["assets/figure is a symbolic link"]
  });
});

test("assets/ itself linked elsewhere is refused", (t) => {
  assertRefused(t, {
    plant(box, sentinel) {
      const elsewhere = path.join(path.dirname(sentinel), "assets-elsewhere");
      fs.mkdirSync(elsewhere);
      fs.rmSync(path.join(box.root, "assets"), { recursive: true });
      fs.symlinkSync(elsewhere, path.join(box.root, "assets"));
    },
    names: ["assets is a symbolic link"]
  });
});

test("a HARD link in a pack's folder is refused: to the SWF itself, or to anything else", (t) => {
  assertRefused(t, {
    plant(box) {
      fs.mkdirSync(path.join(box.root, "assets", "sound"), { recursive: true });
      fs.linkSync(box.swf, path.join(box.root, "assets", "sound", "sound.json"));
    },
    names: ["assets/sound/sound.json IS the SWF being read"]
  });
  assertRefused(t, {
    plant(box, sentinel) {
      fs.mkdirSync(path.join(box.root, "assets", "screens"), { recursive: true });
      fs.linkSync(sentinel, path.join(box.root, "assets", "screens", "screens.json"));
    },
    names: ["assets/screens/screens.json is hard-linked"]
  });
});

test("every offending path is named, and a pack this run will not touch is not checked", (t) => {
  assertRefused(t, {
    plant(box, sentinel) {
      for (const dir of ["sound", "screens"]) fs.mkdirSync(path.join(box.root, "assets", dir), { recursive: true });
      fs.symlinkSync(sentinel, path.join(box.root, "assets", "sound", "sound.json"));
      fs.symlinkSync(sentinel, path.join(box.root, "assets", "screens", "screens.json"));
    },
    names: ["assets/sound/sound.json", "assets/screens/screens.json"]
  });
  const box = sandbox(t);
  fs.mkdirSync(path.join(box.root, "assets", "screens"), { recursive: true });
  fs.symlinkSync(box.swf, path.join(box.root, "assets", "screens", "screens.json"));
  const { runner, calls } = stubRunner(box.root);
  const result = run(["--only", "sound", box.swf], { root: box.root, packs: threePacks(), runner });
  assert.equal(result.status, 0, result.text);
  assert.deepEqual(calls, ["sound"]);
});

test("an SWF that lives inside assets/ is refused: this command writes, renames and removes files there", (t) => {
  for (const where of [LEDGER_PATH, `${LEDGER_PATH}.tmp-${process.pid}`, "assets/elsewhere/game.swf"]) {
    const box = sandbox(t);
    const inside = path.join(box.root, where);
    fs.mkdirSync(path.dirname(inside), { recursive: true });
    fs.renameSync(box.swf, inside);
    const bytes = fs.readFileSync(inside);
    const { runner, calls } = stubRunner(box.root);
    const result = run([inside], { root: box.root, packs: threePacks(), runner });
    assert.deepEqual(fs.readFileSync(inside), bytes, `${where}: the SWF is untouched`);
    assert.equal(result.status, 2, `${where}: ${result.text}`);
    assert.deepEqual(calls, []);
    assert.ok(result.text.includes(`the SWF is inside assets/ (${where})`), `${where}: ${result.text}`);
  }
});

test("a second extract-all while one is running is refused, and the first finishes unharmed", (t) => {
  // Run B starts while run A's first extractor is working: the interleaving
  // that could otherwise mix B's files into A's packs.
  const box = sandbox(t);
  let second = null;
  const inner = stubRunner(box.root);
  const runner = (pack, swfPath, options) => {
    if (second === null) second = run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
    return inner.runner(pack, swfPath, options);
  };
  const first = run([box.swf], { root: box.root, packs: threePacks(), runner });
  assert.equal(second.status, 2, second.text);
  assert.match(second.text, /^ERR Another extract-all is running \(pid \d+/m);
  assert.ok(second.text.includes("assets/extract-all.lock"), second.text);
  assert.equal(first.status, 0, first.text);
  assert.deepEqual(inner.calls, ["sound", "figure", "screens"]);
  assert.equal(fs.existsSync(path.join(box.root, "assets", "extract-all.lock")), false, "the lock is released at the end");
});

test("a lock is never removed by a run that did not take it — stale or unreadable — and a run releases its own even when it throws", (t) => {
  // Clearing a stale lock automatically races: two runs that both judge it
  // stale can each remove the other's fresh lock. So a run only ever refuses.
  for (const [what, content, isAlive, says] of [
    ["stale", JSON.stringify({ pid: 4194311, since: "2026-01-01T00:00:00.000Z", token: "dead" }), () => false,
      /^ERR assets\/extract-all\.lock was left by pid 4194311 \(since 2026-01-01T00:00:00\.000Z\), which is no longer running/m],
    ["empty, as one caught mid-creation reads", "", () => true, /^ERR assets\/extract-all\.lock is there and cannot be read/m],
    ["live", JSON.stringify({ pid: 4194311, since: "x", token: "other" }), () => true, /^ERR Another extract-all is running \(pid 4194311/m]
  ]) {
    const box = sandbox(t);
    const lock = path.join(box.root, "assets", "extract-all.lock");
    fs.writeFileSync(lock, content);
    const { runner, calls } = stubRunner(box.root);
    const result = run([box.swf], { root: box.root, packs: threePacks(), runner, isAlive });
    assert.equal(result.status, 2, `${what}: ${result.text}`);
    assert.deepEqual(calls, [], what);
    assert.match(result.text, says, what);
    assert.match(result.text, /If no extract-all is running, delete assets\/extract-all\.lock and run again/, what);
    assert.equal(fs.readFileSync(lock, "utf8"), content, `${what}: the lock is left exactly as it was`);
    assert.equal(fs.existsSync(path.join(box.root, LEDGER_PATH)), false, `${what}: nothing was written`);
  }

  const box = sandbox(t);
  // A pack's failure is absorbed; one that cannot even be REPORTED escapes.
  assert.throws(() => run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root, { behave: { sound: "fail" } }).runner, breakWrite: /^  FAILED/ }),
    /terminal went away/);
  assert.equal(fs.existsSync(path.join(box.root, "assets", "extract-all.lock")), false, "released on the way out of a throw");
});

test("the ledger's temporary file is created fresh, never written through a link planted in its place", (t) => {
  const box = sandbox(t);
  const sentinel = path.join(box.root, "sentinel.bin");
  fs.writeFileSync(sentinel, "SENTINEL");
  fs.symlinkSync(sentinel, path.join(box.root, `${LEDGER_PATH}.tmp-${process.pid}`));
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
  assert.equal(result.status, 0, result.text);
  assert.equal(fs.readFileSync(sentinel, "utf8"), "SENTINEL");
  assert.ok(JSON.parse(fs.readFileSync(path.join(box.root, LEDGER_PATH), "utf8")).packs.sound);
});

test("the SWF is only read: its bytes and mtime are the same after a run, and nothing is written outside assets/", (t) => {
  const box = sandbox(t);
  const before = { bytes: fs.readFileSync(box.swf), mtime: fs.statSync(box.swf).mtimeMs };
  const listing = () => fs.readdirSync(box.root, { recursive: true }).map(String).filter((p) => !p.startsWith("assets")).sort();
  const outside = listing();
  run([box.swf], { root: box.root, packs: threePacks(), runner: stubRunner(box.root).runner });
  assert.deepEqual(fs.readFileSync(box.swf), before.bytes);
  assert.equal(fs.statSync(box.swf).mtimeMs, before.mtime);
  assert.deepEqual(listing(), outside);
});

test("SS2_SWF is honoured end to end, and a missing SWF exits 2 having run nothing", (t) => {
  const box = sandbox(t);
  const found = stubRunner(box.root);
  assert.equal(run([], { root: box.root, packs: threePacks(), runner: found.runner, env: { SS2_SWF: box.swf } }).status, 0);
  assert.deepEqual(found.calls, ["sound", "figure", "screens"]);

  const none = stubRunner(box.root);
  const missing = run([], { root: box.root, packs: threePacks(), runner: none.runner, env: { SS2_SWF: path.join(box.root, "gone.swf") } });
  assert.equal(missing.status, 2);
  assert.deepEqual(none.calls, []);
  assert.match(missing.text, /^ERR No SWF at .*gone\.swf/m);
});

test("a RELATIVE path, given or in SS2_SWF, is the caller's: resolved once, then hashed and handed to every extractor absolute", (t) => {
  // The extractors run with cwd = the repository root (`spawnExtractor`), so
  // this runner reads the path the way a child would: against the root. A
  // relative path handed through unresolved names a different file there.
  const childRunner = (root) => {
    const inner = stubRunner(root);
    const handed = [];
    const runner = (pack, swfPath, options) => {
      handed.push(swfPath);
      const asTheChildSeesIt = path.resolve(root, swfPath);
      if (!fs.existsSync(asTheChildSeesIt)) return { status: 2, signal: null, error: null, stdout: "", stderr: `No such file: ${swfPath}\n` };
      return inner.runner(pack, asTheChildSeesIt, options);
    };
    return { runner, handed };
  };
  for (const how of ["given", "SS2_SWF"]) {
    const box = sandbox(t);
    const caller = path.dirname(box.swf); // "<root>/game dir": the caller is NOT at the repository root
    const { runner, handed } = childRunner(box.root);
    const result = run(how === "given" ? [SWF_NAME] : [], {
      root: box.root, packs: threePacks(), runner, cwd: caller, env: how === "SS2_SWF" ? { SS2_SWF: SWF_NAME } : {}
    });
    assert.equal(result.status, 0, `${how}: ${result.text}`);
    assert.deepEqual(handed, [box.swf, box.swf, box.swf], `${how}: every extractor got the absolute path`);
    assert.ok(result.lines.includes(`SWF    ${box.swf}`), `${how}: ${result.text}`);
    assert.ok(result.text.includes(`sha256 ${box.sha}`), `${how}: the file hashed is the caller's file`);
  }
});

test("the CLI itself resolves a relative path against the directory it was run from", (t) => {
  // The real entry point, default wiring and all. The SWF is a fake, so the
  // build check refuses it (exit 2) before any ledger is read or any extractor
  // runs: what is checked is which file it found and hashed.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "extract-all-cwd-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = "a fake SWF in the caller's directory";
  fs.writeFileSync(path.join(root, SWF_NAME), bytes);
  const sha = crypto.createHash("sha256").update(bytes).digest("hex");
  const ledgerBefore = fs.existsSync(path.join(REPO_ROOT, LEDGER_PATH));
  const script = path.join(REPO_ROOT, "tools", "extract-all.mjs");
  for (const [argv, env] of [[[SWF_NAME], {}], [[], { SS2_SWF: SWF_NAME }]]) {
    const { SS2_SWF: _unused, ...inherited } = process.env;
    const child = spawnSync(process.execPath, [script, ...argv], { cwd: root, encoding: "utf8", env: { ...inherited, ...env } });
    assert.equal(child.status, 2, child.stdout + child.stderr);
    assert.ok(child.stdout.includes(`SWF    ${path.join(root, SWF_NAME)}\n`), child.stdout + child.stderr);
    assert.ok(child.stdout.includes(`sha256 ${sha}`), child.stdout);
    assert.match(child.stdout, /NOT the build this project knows/);
  }
  assert.equal(fs.existsSync(path.join(REPO_ROOT, LEDGER_PATH)), ledgerBefore, "a refusal writes no ledger");
});

test("an unreadable ledger is said out loud and every pack is redone", (t) => {
  const box = sandbox(t);
  fs.writeFileSync(path.join(box.root, LEDGER_PATH), "{ not json");
  const { runner, calls } = stubRunner(box.root);
  const result = run([box.swf], { root: box.root, packs: threePacks(), runner });
  assert.match(result.text, /extract-all\.json is unreadable/);
  assert.deepEqual(calls, ["sound", "figure", "screens"]);
});

/* ─────────────────────────────  the small parts  ─────────────────────────── */

test("flags: unknown ones throw, one SWF at most, --only takes a list", () => {
  assert.throws(() => parseArguments(["--frce"]), /Unknown flag "--frce"/);
  assert.throws(() => parseArguments(["a.swf", "b.swf"]), /one SWF path at most/);
  assert.throws(() => parseArguments(["--only"]), /--only needs/);
  assert.deepEqual(parseArguments(["--only", "figure, sound", "x.swf", "--force"]),
    { file: "x.swf", force: true, allowOtherBuild: false, only: ["figure", "sound"], verbose: false, help: false });
});

test("the retry command's path is LITERAL in the shell it is printed for: bash gets back exactly the file name, and runs nothing in it", (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "extract-all-quote-"));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const pwned = path.join(scratch, "pwned");
  for (const name of [
    "/plain/path.swf",
    "/mnt/c/Program Files (x86)/x.swf",
    `/tmp/player's $(touch ${pwned})/game.swf`,
    `/tmp/a "quoted" \`touch ${pwned}\` $HOME/it's!/x.swf`,
    "/tmp/''/\\'/x.swf",
    "/tmp/back\\slash.swf"
  ]) {
    const quoted = quoteForShell(name, "linux");
    const echoed = spawnSync("bash", ["-c", `printf %s ${quoted}`], { encoding: "utf8" });
    assert.equal(echoed.stdout, name, `${quoted}`);
  }
  assert.equal(fs.existsSync(pwned), false, "nothing in a file name ran");
  assert.equal(quoteForShell("/plain/path.swf", "linux"), "/plain/path.swf", "a plain path is left alone");
  assert.equal(retryCommand(PACKS[0], "/a b.swf", "linux"), "node tools/extract-all.mjs --only sound --verbose '/a b.swf'");
});

test("on Windows the retry path is double-quoted when that is literal (cmd and PowerShell alike), else PowerShell's literal quotes", () => {
  assert.equal(quoteForShell("C:\\Program Files (x86)\\x.swf", "win32"), '"C:\\Program Files (x86)\\x.swf"');
  assert.equal(quoteForShell("D:\\Games\\x.swf", "win32"), "D:\\Games\\x.swf");
  // `$` and a backtick are live inside PowerShell's double quotes; inside its
  // single quotes nothing is, and a quote is written twice.
  assert.equal(quoteForShell("C:\\it's $(evil)\\x.swf", "win32"), "'C:\\it''s $(evil)\\x.swf'");
  assert.equal(quoteForShell("C:\\tick`x\\x.swf", "win32"), "'C:\\tick`x\\x.swf'");
});

test("the extractor digest follows local imports, multi-line ones included, and ignores what it cannot read", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "extract-all-digest-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "tools"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "tools", "x.mjs"),
    'import fs from "node:fs";\nimport {\n  a,\n  b\n} from "./helper.mjs";\n// see "./ghost.mjs" for nothing\nexport { c } from "../src/lib.js";\n');
  fs.writeFileSync(path.join(root, "tools", "helper.mjs"), "export const a = 1, b = 2;\n");
  fs.writeFileSync(path.join(root, "src", "lib.js"), "export const c = 3;\n");
  fs.writeFileSync(path.join(root, "tools", "unrelated.mjs"), "export const z = 0;\n");
  const script = path.join(root, "tools", "x.mjs");
  const first = extractorDigest(script);
  fs.writeFileSync(path.join(root, "tools", "unrelated.mjs"), "export const z = 1;\n");
  assert.equal(extractorDigest(script), first, "a file nothing imports does not count");
  fs.writeFileSync(path.join(root, "src", "lib.js"), "export const c = 4;\n");
  const second = extractorDigest(script);
  assert.notEqual(second, first, "a change two imports away counts");
  fs.writeFileSync(path.join(root, "tools", "helper.mjs"), "export const a = 9, b = 2;\n");
  assert.notEqual(extractorDigest(script), second, "a multi-line import is followed");
  assert.throws(() => extractorDigest(path.join(root, "tools", "missing.mjs")), /cannot read the extractor/);
});

test("a nested module's FIRST import is followed even when its parent's import sits far down the file", (t) => {
  // The shape a regex shared across the recursion gets wrong: the parent's
  // import is at a large offset, the child's at a small one.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "extract-all-deep-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "top.mjs"), `${"// padding\n".repeat(200)}import { m } from "./middle.mjs";\n`);
  fs.writeFileSync(path.join(root, "middle.mjs"), 'import { d } from "./deep.mjs";\nexport const m = d;\n');
  fs.writeFileSync(path.join(root, "deep.mjs"), "export const d = 1;\n");
  const first = extractorDigest(path.join(root, "top.mjs"));
  fs.writeFileSync(path.join(root, "deep.mjs"), "export const d = 2;\n");
  assert.notEqual(extractorDigest(path.join(root, "top.mjs")), first);
});

test("every real extractor has a digest (this reads repository source only)", () => {
  const digests = PACKS.map((pack) => extractorDigest(path.join(REPO_ROOT, pack.script)));
  for (const digest of digests) assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(new Set(digests).size, PACKS.length);
});

test("spawnExtractor runs the script with the SWF path and reports its status and output", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "extract-all-spawn-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "tools"));
  fs.writeFileSync(path.join(root, "tools", "extract-stub.mjs"),
    'process.stdout.write(`got ${process.argv[2]}\\n`); process.stderr.write("bad\\n"); process.exitCode = 3;\n');
  const result = spawnExtractor({ script: "tools/extract-stub.mjs" }, "/some where/x.swf", { repoRoot: root });
  assert.equal(result.status, 3);
  assert.equal(result.stdout, "got /some where/x.swf\n");
  assert.equal(result.stderr, "bad\n");
  // Its cwd is the root, so a path relative to THIS process is handed over resolved.
  const relative = spawnExtractor({ script: "tools/extract-stub.mjs" }, "rel dir/x.swf", { repoRoot: root });
  assert.equal(relative.stdout, `got ${path.resolve("rel dir/x.swf")}\n`);
  // --out goes through as two arguments after the SWF, as every extractor parses it.
  fs.writeFileSync(path.join(root, "tools", "extract-args.mjs"), "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n");
  const staged = spawnExtractor({ script: "tools/extract-args.mjs" }, "/x.swf", { repoRoot: root, out: "/staging dir/sound" });
  assert.deepEqual(JSON.parse(staged.stdout), ["/x.swf", "--out", "/staging dir/sound"]);
});
