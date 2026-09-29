/**
 * ONE COMMAND THAT IMPORTS EVERY PACK THE ARENA USES, out of the player's own
 * install and into gitignored `assets/`.
 *
 *     node tools/extract-all.mjs                      # finds your install
 *     node tools/extract-all.mjs "<path to swords_sandals2_download.swf>"
 *
 * ## Why this exists
 *
 * The arena reads ten packs and the screens viewer an eleventh, each written by
 * its own `tools/extract-*.mjs`. A player who owns the game had to learn eleven
 * commands, their order (the figure's preview reads the sound pack's bindings),
 * and where the SWF lives — and `assets/README.md` named three of them. This
 * file is the one command. It holds NO extraction logic: every pack is written
 * by its own extractor, run as a child process exactly as a person would run
 * it, so there is one reader of the build per pack and never two to drift.
 *
 * ## What it guarantees
 *
 * - **READ-ONLY on the SWF.** It hashes the file, hands the path to each
 *   extractor, and hashes it again at the end; a different hash is a loud
 *   failure. The installed build is this project's MEASUREMENT ORACLE: every
 *   promoted golden, observation record and capture manifest cites its sha256.
 * - **Writes only under `assets/`.** Each extractor writes into a fresh
 *   staging folder there, and a pack is installed into `assets/<dir>/` only
 *   once every check has passed (see `extractPacks`); a rejected one leaves
 *   the installed pack untouched. This file writes one ledger,
 *   `assets/extract-all.json`, and one lock. Before anything is written,
 *   `checkDestinations` REFUSES a run whose writes could land anywhere else.
 * - **Idempotent.** A pack is SKIPPED only when every one of these holds:
 *   the ledger says it was extracted from THIS SWF's sha256 by THIS version of
 *   its extractor (the extractor's source and every local module it imports,
 *   hashed); the pack's own manifest names the same sha256, where it records
 *   one, and no failure this command does not expect; every file the arena
 *   reads from it — its manifest's media included — is on disk, untouched
 *   since the ledger saw it (`fileStamps`); and what it reads from other
 *   packs is what it read last time. `--force` redoes everything.
 * - **A different build is REFUSED unless `--allow-other-build`.** See
 *   `checkBuild` for why the default is a refusal and not a warning.
 * - **Exit status**: 0 when every pack is ok or skipped; 1 when any pack failed
 *   or the SWF changed underneath the run; 2 when nothing ran (a usage error,
 *   no SWF found, a build refused, a write destination refused, or another
 *   run holding `assets/extract-all.lock`).
 *
 * ## Where it looks for the SWF, and where it does not
 *
 * `swfCandidates` holds the list. In order: the path you pass (a file, or the
 * collection's folder); `SS2_SWF` from the environment; then Steam's default
 * library for the platform; then any other Steam library that Steam's own
 * `libraryfolders.vdf` lists. **It never searches a disk** — every path it
 * probes is on that list, and a miss prints the whole list.
 *
 * ## What leaves the repository
 *
 * Nothing of the build's. `assets/` is gitignored and
 * `test/asset-attestation.test.js` fails if anything under it is tracked.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The file inside the collection, as `docs/integration/ss2-build-fingerprint.json` records it. */
export const SWF_NAME = "swords_sandals2_download.swf";
export const SWF_IN_COLLECTION = ["swf", SWF_NAME];
export const COLLECTION_DIR = "Swords and Sandals Classic Collection";

export const FINGERPRINT_PATH = path.join("docs", "integration", "ss2-build-fingerprint.json");
export const LEDGER_PATH = path.join("assets", "extract-all.json");
export const LOCK_PATH = path.join("assets", "extract-all.lock");
/** A pack's staging folder is `assets/<this><pid>-<pack>`; see `extractPacks`. */
export const STAGING_PREFIX = ".extract-all-staging-";

export class ExtractAllError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/* ─────────────────────────────────  the packs  ───────────────────────────── */

/**
 * EVERY EXTRACTOR, in the order they run, and what each one unlocks.
 *
 * - `outputs` are the files the pack's reader fetches, repo-relative. The FIRST
 *   is the one `test/extract-all.test.js` finds, as a `/assets/...` URL, in the
 *   `reader`'s own source — so "the arena reads this" is checked, not asserted.
 * - `sha256At` is where the pack records the build it was read from, or null
 *   for the one pack that records none (clip-effects).
 * - `after` names the packs whose output this extractor READS. The only such
 *   edge today: `extract-figure.mjs` reads `assets/sound/manifest.json` for the
 *   preview's sound bindings. The ledger remembers what those outputs held
 *   when the pack was extracted (`dependencyFingerprint`), so a later change to
 *   them redoes it, in this run or any later one. Packs that merely share a directory (figure,
 *   wardrobe and enchantments in `assets/figure/`; props and clip-effects in
 *   `assets/props/`) write disjoint files and do not depend on each other.
 * - `arena: false` is the screens pack: the arena does not read it; the screens
 *   viewer (`tools/screens/`) does. It is extracted all the same.
 * - `failuresAt` is where the pack records what it could not extract: by
 *   default a top-level `failures` LIST in the `sha256At` file; for the sound
 *   pack, the COUNT `skipped` (sounds it cannot repack). Any recorded failure
 *   FAILS the pack (see `classifyFailures`) unless `tolerated` names it.
 * - `media` is a pack whose manifest NAMES more files than `outputs` can list
 *   (the sound pack's MP3s, the bitmaps' JPEGs, PNGs and alpha planes): every
 *   file it names is part of the pack. See `checkMedia`.
 * - `tolerated` names the recorded failures the arena is known to cope with,
 *   ONE BY ONE — never a class. Today, only props' two, measured on the known
 *   build's own extraction.
 */
export const PACKS = Object.freeze([
  {
    name: "sound",
    script: "tools/extract-sounds.mjs",
    outputs: ["assets/sound/manifest.json"],
    sha256At: { file: "assets/sound/manifest.json", key: ["source", "sha256"] },
    failuresAt: { key: ["skipped"], count: "sound(s) in a format extract-sounds.mjs cannot repack (only MP3 is a repack)" },
    media: { manifest: "assets/sound/manifest.json", dir: "assets/sound", names: "sound" },
    after: [],
    reader: "tools/arena",
    arena: true,
    unlocks: "the build's own sound effects and the crowd, timed to their frames",
    without: "silence"
  },
  {
    name: "figure",
    script: "tools/extract-figure.mjs",
    outputs: [
      "assets/figure/shapes.json",
      "assets/figure/animations.json",
      "assets/figure/manifest.json",
      "assets/figure/preview.html"
    ],
    sha256At: { file: "assets/figure/manifest.json", key: ["source", "sha256"] },
    after: ["sound"],
    reader: "tools/arena",
    arena: true,
    unlocks: "the build's own gladiator rig and animations",
    without: "the authored vector figure"
  },
  {
    name: "wardrobe",
    script: "tools/extract-wardrobe.mjs",
    outputs: ["assets/figure/wardrobe.json"],
    sha256At: { file: "assets/figure/wardrobe.json", key: ["source", "sha256"] },
    after: [],
    reader: "tools/arena",
    arena: true,
    unlocks: "armour, weapons, shields and hair on the gladiators",
    without: "an undressed gladiator"
  },
  {
    name: "enchantments",
    script: "tools/extract-enchantments.mjs",
    outputs: ["assets/figure/enchantments.json"],
    sha256At: { file: "assets/figure/enchantments.json", key: ["sha256"] },
    after: [],
    reader: "tools/arena",
    arena: true,
    unlocks: "the weapon-enchantment glows",
    without: "unglowed weapons"
  },
  {
    name: "props",
    script: "tools/extract-props.mjs",
    outputs: ["assets/props/props.json", "assets/props/manifest.json"],
    sha256At: { file: "assets/props/manifest.json", key: ["sha256"] },
    // ► **THE ONLY RECORDED FAILURES THIS COMMAND ACCEPTS, AND WHY.** The known
    //   build's own props extraction records exactly these two (its
    //   `assets/props/manifest.json`, read 2026-09-24: `failures` has 2 entries,
    //   both `panel` 1531). They are the UI bar's two `DefineEditText` fields,
    //   which `extract-props.mjs` cannot turn into paths and says so; the arena
    //   draws that text itself from the TEXT pack (`src/render/text.js`: "This
    //   module is the other half of that report"). Matched by prop, character id
    //   and the message's opening words — a third field, another prop or
    //   another build's ids are NOT tolerated and fail the pack.
    tolerated: [
      { linkage: "panel", id: 1531, message: "frame 1 carries text (character 1527)" },
      { linkage: "panel", id: 1531, message: "frame 1 carries text (character 1528)" }
    ],
    toleratedWhy: "panel's text fields (soundvar, tooltips), which the arena draws from the text pack",
    after: [],
    reader: "tools/arena",
    arena: true,
    unlocks: "the arena screen (backdrop, sky, sand, stands, UI bar, frame) and the arrows, bolts, fireballs and boulders",
    without: "the authored arena and arrow"
  },
  {
    name: "clip-effects",
    script: "tools/extract-clip-effects.mjs",
    outputs: ["assets/props/clip-effects.json"],
    sha256At: null,
    after: [],
    reader: "tools/arena",
    arena: true,
    unlocks: "blood and sparks on the frames the build throws them",
    without: "no blood or sparks"
  },
  {
    name: "bitmaps",
    script: "tools/extract-bitmaps.mjs",
    outputs: ["assets/bitmaps/manifest.json"],
    sha256At: { file: "assets/bitmaps/manifest.json", key: ["sha256"] },
    media: { manifest: "assets/bitmaps/manifest.json", dir: "assets/bitmaps", names: "bitmaps" },
    after: [],
    reader: "tools/arena",
    arena: true,
    unlocks: "the arena walls and crowds, which the build stores as bitmaps",
    without: "the vector layer with no walls or crowds painted on it"
  },
  {
    name: "icons",
    script: "tools/extract-icons.mjs",
    outputs: ["assets/icons/icons.json", "assets/icons/manifest.json"],
    sha256At: { file: "assets/icons/manifest.json", key: ["sha256"] },
    after: [],
    reader: "tools/arena",
    arena: true,
    unlocks: "the faces (eyes and mouth), the damage, spell and BLOCK pop-up art, the action buttons, " +
      "the fight's own health, energy and armour gauges, and its crowd bar",
    without: "a blank face, plain-number pop-ups, and authored action buttons, gauges and crowd bar"
  },
  {
    name: "text",
    script: "tools/extract-text.mjs",
    outputs: ["assets/text/text.json", "assets/text/manifest.json"],
    sha256At: { file: "assets/text/manifest.json", key: ["sha256"] },
    after: [],
    reader: "tools/arena",
    arena: true,
    unlocks: "the UI bar's words, in the build's own fonts",
    without: "a wordless UI bar"
  },
  {
    name: "champions",
    script: "tools/extract-champions.mjs",
    outputs: ["assets/champions/champions.json", "assets/champions/manifest.json"],
    sha256At: { file: "assets/champions/manifest.json", key: ["sha256"] },
    after: [],
    reader: "tools/arena",
    arena: true,
    unlocks: "the tournament champions, for ?red=&blue=",
    without: "?red=/?blue= refuse to start; the demo roster still plays"
  },
  {
    name: "screens",
    script: "tools/extract-screens.mjs",
    outputs: ["assets/screens/screens.json", "assets/screens/manifest.json"],
    sha256At: { file: "assets/screens/manifest.json", key: ["sha256"] },
    after: [],
    reader: "tools/screens",
    arena: false,
    unlocks: "the game's own screens, in the screens viewer (tools/screens/)",
    without: "the screens viewer has nothing to draw"
  }
].map((pack) => Object.freeze({
  ...pack,
  outputs: Object.freeze(pack.outputs),
  after: Object.freeze(pack.after),
  ...(pack.tolerated ? { tolerated: Object.freeze(pack.tolerated.map((rule) => Object.freeze({ ...rule }))) } : {}),
  ...(pack.media ? { media: Object.freeze({ ...pack.media }) } : {})
})));

/**
 * The packs in an order where every pack runs after the packs it reads.
 *
 * Stable: packs with no ordering constraint between them keep their declared
 * order. A dependency outside `packs` (say, `--only figure`) is ignored — the
 * extractor copes with its absence, and `--only` is the person saying so.
 * A cycle, or an `after` naming no pack at all, is a defect in `PACKS` and
 * throws.
 */
export function orderPacks(packs, { all = packs } = {}) {
  const known = new Set(all.map((pack) => pack.name));
  const selected = new Map(packs.map((pack) => [pack.name, pack]));
  for (const pack of packs) {
    for (const dependency of pack.after) {
      if (!known.has(dependency)) {
        throw new ExtractAllError(`pack ${pack.name} runs after "${dependency}", which is not a pack.`);
      }
    }
  }
  const ordered = [];
  const state = new Map(); // name -> "visiting" | "done"
  const visit = (pack, trail) => {
    const seen = state.get(pack.name);
    if (seen === "done") return;
    if (seen === "visiting") {
      throw new ExtractAllError(`the packs' order is a cycle: ${[...trail, pack.name].join(" -> ")}`);
    }
    state.set(pack.name, "visiting");
    for (const dependency of pack.after) {
      const before = selected.get(dependency);
      if (before) visit(before, [...trail, pack.name]);
    }
    state.set(pack.name, "done");
    ordered.push(pack);
  };
  for (const pack of packs) visit(pack, []);
  return ordered;
}

/* ─────────────────────────────  finding the SWF  ─────────────────────────── */

/**
 * Is this Linux actually WSL? The kernel says so in its release string
 * (`6.x-microsoft-standard-WSL2`), and WSL sets `WSL_DISTRO_NAME` for every
 * process it launches. Either is enough; a scrubbed environment (cron, a hook)
 * loses the variable but not the kernel.
 */
export function isWsl({ platform, env = {}, release = "" }) {
  return platform === "linux" && (/microsoft/i.test(release) || Boolean(env.WSL_DISTRO_NAME));
}

/** `D:\SteamLibrary` -> `/mnt/d/SteamLibrary`, WSL's default automount. Null if it is not a drive path. */
export function windowsPathToWsl(windowsPath) {
  const match = /^([A-Za-z]):[\\/]*(.*)$/.exec(windowsPath);
  if (!match) return null;
  const rest = match[2].replace(/\\/g, "/").replace(/\/+$/, "");
  return `/mnt/${match[1].toLowerCase()}${rest ? `/${rest}` : ""}`;
}

/**
 * The library paths in a Steam `libraryfolders.vdf`, in file order.
 *
 * Two formats exist. Since 2021 each library is a block with a `"path"` key;
 * before that, each was a numbered key whose value WAS the path. Both are
 * read. A numbered key whose value is not a path (the new format's `"apps"`
 * block maps app ids to sizes) is ignored. VDF escapes a backslash as `\\`.
 */
export function steamLibraryPaths(vdfText) {
  if (typeof vdfText !== "string") return [];
  const unescape = (value) => value.replace(/\\(.)/g, "$1");
  const looksLikePath = (value) => /[\\/]/.test(value) || /^[A-Za-z]:/.test(value);
  // TOKENISED, then paired: a single key-value pattern loses the old format's
  // first library, because `"TimeNextStatsReport" "1600000000"` then `"1"`
  // lets the pattern pair the timestamp with the library's KEY and skip past
  // the path. A key is a string followed by a string; a string followed by `{`
  // opens a block.
  const tokens = [...vdfText.matchAll(/"((?:[^"\\]|\\.)*)"|([{}])/g)]
    .map((match) => (match[2] ? { brace: match[2] } : { text: unescape(match[1]) }));
  const found = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (key.text === undefined || value?.text === undefined) continue;
    if ((key.text.toLowerCase() === "path" || /^\d+$/.test(key.text)) && looksLikePath(value.text) && !found.includes(value.text)) {
      found.push(value.text);
    }
    index += 1;
  }
  return found;
}

/**
 * The Steam installs this platform's Steam is known to use by default, each
 * with a reason a person can read. Paths are built with the TARGET platform's
 * separator, so the list is the same whichever machine computes it.
 *
 * ► **WSL FIRST, AND WITH THE WINDOWS DRIVE, because that is this project's
 *   own machine.** Every extractor hard-codes the WSL Steam default; it is the
 *   one path here that has been measured. The Windows, macOS and Linux
 *   defaults are Steam's documented install locations, NOT measured here —
 *   nobody on this project has run the collection on macOS or Linux, and on
 *   macOS the collection's layout inside the library is unverified.
 */
export function steamRoots({ platform, env = {}, home = "", release = "" }) {
  const roots = [];
  if (platform === "win32") {
    const x86 = env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const native = env.ProgramFiles || "C:\\Program Files";
    roots.push({ root: path.win32.join(x86, "Steam"), sep: "win32", why: "the Steam default on Windows" });
    roots.push({ root: path.win32.join(native, "Steam"), sep: "win32", why: "Steam under Program Files on Windows" });
    return roots;
  }
  if (isWsl({ platform, env, release })) {
    roots.push({ root: "/mnt/c/Program Files (x86)/Steam", sep: "posix", why: "the Steam default on WSL (Windows' C: drive)", wsl: true });
    roots.push({ root: "/mnt/c/Program Files/Steam", sep: "posix", why: "Steam under Program Files, from WSL", wsl: true });
  }
  if (platform === "darwin") {
    roots.push({ root: path.posix.join(home, "Library", "Application Support", "Steam"), sep: "posix", why: "the Steam default on macOS" });
    return roots;
  }
  if (platform === "linux") {
    roots.push({ root: path.posix.join(home, ".local", "share", "Steam"), sep: "posix", why: "the Steam default on Linux" });
    roots.push({ root: path.posix.join(home, ".steam", "steam"), sep: "posix", why: "Steam's ~/.steam/steam link on Linux" });
    roots.push({ root: path.posix.join(home, ".steam", "debian-installation"), sep: "posix", why: "Debian/Ubuntu's packaged Steam" });
    roots.push({
      root: path.posix.join(home, ".var", "app", "com.valvesoftware.Steam", ".local", "share", "Steam"),
      sep: "posix",
      why: "Flatpak Steam on Linux"
    });
    roots.push({ root: path.posix.join(home, "snap", "steam", "common", ".local", "share", "Steam"), sep: "posix", why: "Snap Steam on Linux" });
  }
  return roots;
}

function joinFor(sep, ...parts) {
  return sep === "win32" ? path.win32.join(...parts) : path.posix.join(...parts);
}

function swfInLibrary(library, sep) {
  return joinFor(sep, library, "steamapps", "common", COLLECTION_DIR, ...SWF_IN_COLLECTION);
}

/**
 * Every path `locateSwf` would probe when none is given, in order, each with
 * why it is on the list. `readText` reads a Steam `libraryfolders.vdf`; it is
 * called only for the `steamapps/libraryfolders.vdf` of a root on this list.
 */
export function swfCandidates({ platform, env = {}, home = "", release = "", readText = () => null }) {
  const candidates = [];
  const add = (candidate) => {
    if (!candidates.some((existing) => existing.path === candidate.path)) candidates.push(candidate);
  };
  const roots = steamRoots({ platform, env, home, release });
  for (const { root, sep, why } of roots) add({ path: swfInLibrary(root, sep), sep, why });
  for (const { root, sep, wsl } of roots) {
    const vdf = joinFor(sep, root, "steamapps", "libraryfolders.vdf");
    for (const library of steamLibraryPaths(readText(vdf))) {
      const local = wsl ? windowsPathToWsl(library) : library;
      if (!local) continue;
      add({ path: swfInLibrary(local, sep), sep, why: `a Steam library listed in ${vdf}` });
    }
  }
  return candidates;
}

/**
 * Where the SWF is, and why that one.
 *
 * - An explicit path wins. A FOLDER is accepted: the collection's own folder
 *   (holding `swf/<name>`) or the `swf` folder itself. **A path that is not
 *   there is an error and NOT a fallback** — quietly reading a different build
 *   from the one asked for is the worst thing this could do.
 * - Then `SS2_SWF`, with the same rule.
 * - Then `swfCandidates`, first hit wins.
 *
 * `probe(path)` returns "file", "dir" or null, and is the only thing that
 * touches the filesystem, so a test can hand it a synthetic one.
 */
export function locateSwf({ given = null, env = {}, platform, home = "", release = "", probe, readText = () => null }) {
  const resolveGiven = (value, why) => {
    const kind = probe(value);
    if (kind === "file") return { path: value, why, tried: [value] };
    if (kind === "dir") {
      const inside = [path.join(value, ...SWF_IN_COLLECTION), path.join(value, SWF_NAME)];
      for (const candidate of inside) if (probe(candidate) === "file") return { path: candidate, why: `${why} (a folder)`, tried: [value, ...inside] };
      throw new ExtractAllError(
        `${value} is a folder with no ${SWF_IN_COLLECTION.join("/")} or ${SWF_NAME} in it.\n` +
        "Point at the collection's folder, its swf/ folder, or the .swf itself."
      );
    }
    throw new ExtractAllError(
      `No SWF at ${value} (${why}).\n` +
      "Nothing else was tried: a path you name is the build you meant, and reading a different one instead " +
      "would be worse than stopping."
    );
  };
  if (given) return resolveGiven(given, "the path you gave");
  if (env.SS2_SWF) return resolveGiven(env.SS2_SWF, "SS2_SWF in the environment");

  const candidates = swfCandidates({ platform, env, home, release, readText });
  for (const candidate of candidates) {
    if (probe(candidate.path) === "file") return { path: candidate.path, why: candidate.why, tried: candidates.map((c) => c.path) };
  }
  const collectionFolders = candidates
    .map((candidate) => {
      const flavour = candidate.sep === "win32" ? path.win32 : path.posix;
      return flavour.dirname(flavour.dirname(candidate.path));
    })
    .filter((folder, index, all) => all.indexOf(folder) === index && probe(folder) === "dir");
  throw new ExtractAllError(
    "Could not find Swords & Sandals II's SWF. Looked in:\n" +
    (candidates.length ? candidates.map((c) => `  ${c.path}    (${c.why})`).join("\n") : "  (no Steam default is known for this platform)") +
    "\n" +
    (collectionFolders.length
      ? `The collection's folder IS at ${collectionFolders.join(", ")}, but ${SWF_IN_COLLECTION.join("/")} is not in it.\n`
      : "") +
    `Pass the path:   node tools/extract-all.mjs "<path to ${SWF_NAME}>"\n` +
    "or set SS2_SWF to it. This repository ships no copy of the game; you need your own."
  );
}

/* ──────────────────────────────  the build check  ────────────────────────── */

export function readFingerprint(repoRoot) {
  const file = path.join(repoRoot, FINGERPRINT_PATH);
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const ss2 = json?.collection?.ss2;
  if (!ss2 || typeof ss2.sha256 !== "string") {
    throw new ExtractAllError(`${FINGERPRINT_PATH} has no collection.ss2.sha256.`);
  }
  const known = new Set([ss2.sha256.toLowerCase()]);
  for (const prior of json.priorBuilds ?? []) if (typeof prior.ss2Sha256 === "string") known.add(prior.ss2Sha256.toLowerCase());
  return { sha256: ss2.sha256.toLowerCase(), known, buildId: json?.steam?.buildId ?? null, relativePath: ss2.relativePath ?? null };
}

/**
 * Is this the build the project knows, and may extraction go ahead?
 *
 * ► **A DIFFERENT BUILD IS REFUSED BY DEFAULT, and `--allow-other-build`
 *   proceeds.** Each extractor on its own ACCEPTS any build and prints a note —
 *   right for a person driving one tool on purpose. This command is the
 *   painless path for a player who wants the arena to work, and for them a
 *   different build is a trap: the arena's readers are keyed to the known
 *   build's character ids, linkage names and bytecode shapes, so a pack from
 *   another build can load and draw something plausible and wrong, with
 *   nothing on screen to say so. A refusal that names the flag costs a modder
 *   one flag (`AGENTS.md` expects a modded copy in a second install with its
 *   own fingerprint lane) and costs nobody the evidence.
 */
export function checkBuild(sha256, fingerprint, { allowOtherBuild = false } = {}) {
  const actual = sha256.toLowerCase();
  if (fingerprint.known.has(actual)) {
    return {
      known: true,
      proceed: true,
      lines: [`sha256 ${actual}`, `       the build this project knows${fingerprint.buildId ? ` (Steam build ${fingerprint.buildId})` : ""}`]
    };
  }
  const lines = [
    `sha256 ${actual}`,
    `       NOT the build this project knows (${fingerprint.sha256}).`,
    "       The arena's readers were written against that build's character ids, names and bytecode; packs from",
    "       another build can load and draw something plausible and wrong, and nothing on screen would say so."
  ];
  if (allowOtherBuild) {
    lines.push("       --allow-other-build: extracting anyway. Every pack records the sha256 it was read from.");
    return { known: false, proceed: true, lines };
  }
  lines.push(
    "       Refused. If this is deliberate (a modded copy, a newer release), run again with --allow-other-build.",
    "       If you pointed at the collection's launcher rather than the SS2 game, the file you want is",
    `       ${SWF_IN_COLLECTION.join("/")} inside the collection's folder.`
  );
  return { known: false, proceed: false, lines };
}

/* ─────────────────────────────  the skip decision  ───────────────────────── */

/**
 * A digest of an extractor AS IT IS NOW: its own source and every local module
 * it imports, transitively (`./x.mjs`, `../src/render/filters.js`). A pack
 * extracted by an older extractor is re-extracted — a pull that changes a pack's
 * shape must not leave the arena reading the old one because the SWF is the
 * same.
 *
 * Imports are found by pattern, not by parsing; a specifier inside a comment
 * that names a real file only adds that file to the digest, and one naming no
 * file is ignored.
 */
export function extractorDigest(scriptPath, { readFile = (file) => fs.readFileSync(file) } = {}) {
  const pattern = /\bfrom\s*["'](\.\.?\/[^"']+)["']|\bimport\s*\(?\s*["'](\.\.?\/[^"']+)["']/g;
  const seen = new Map();
  const visit = (file) => {
    const resolved = path.resolve(file);
    if (seen.has(resolved)) return;
    let bytes;
    try {
      bytes = readFile(resolved);
    } catch {
      if (seen.size === 0) throw new ExtractAllError(`cannot read the extractor ${resolved}`);
      return;
    }
    seen.set(resolved, crypto.createHash("sha256").update(bytes).digest("hex"));
    const text = Buffer.isBuffer(bytes) ? bytes.toString("utf8") : String(bytes);
    // Collected BEFORE recursing: one global regex shared across the recursion
    // would carry this file's `lastIndex` into the next and skip its first imports.
    const specifiers = [...text.matchAll(pattern)].map((match) => match[1] ?? match[2]);
    for (const specifier of specifiers) visit(path.resolve(path.dirname(resolved), specifier));
  };
  visit(scriptPath);
  const root = path.dirname(path.resolve(scriptPath));
  const lines = [...seen].map(([file, digest]) => `${path.relative(root, file).split(path.sep).join("/")} ${digest}`).sort();
  return crypto.createHash("sha256").update(lines.join("\n")).digest("hex");
}

function valueAt(object, key) {
  return key.reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), object);
}

/**
 * The one folder under `assets/` that holds a pack's files — its outputs, the
 * file recording its build, and its media (`test/extract-all.test.js` checks
 * that they share it). The readers below take the FOLDER, so the same check
 * reads an installed pack or a staged one.
 */
export function packFolder(pack) {
  return path.posix.dirname(pack.outputs[0]);
}

function installedFolder(pack, repoRoot) {
  return path.join(repoRoot, ...packFolder(pack).split("/"));
}

/**
 * What a pack's own manifest says about itself: the sha256 it was read from,
 * and the failures it recorded (see `failuresAt` on `PACKS`; a recorded COUNT
 * becomes that many entries). Nulls for absent, unreadable, or not recorded.
 * The enchantments pack records none here: its cross-check failing makes its
 * extractor exit 1, which is already a failure.
 *
 * ► **AN EXTRACTOR CAN EXIT 0 HAVING EXTRACTED ALMOST NOTHING.** Measured
 *   against a 20-byte fake SWF (`--allow-other-build`): seven of the eleven
 *   exited 0, and the props and icons manifests recorded 15 and 11 failures.
 *   Those numbers are the pack's own verdict, so they fail the pack (see
 *   `classifyFailures`) rather than riding along beside an `ok`.
 */
export function packRecord(pack, folder) {
  if (!pack.sha256At) return { sha256: null, failures: null };
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(folder, path.posix.basename(pack.sha256At.file)), "utf8"));
    const value = valueAt(manifest, pack.sha256At.key);
    const at = pack.failuresAt ?? { key: ["failures"] };
    const recorded = valueAt(manifest, at.key);
    let failures = null;
    if (at.count) {
      if (Number.isInteger(recorded) && recorded >= 0) failures = Array.from({ length: recorded }, () => ({ message: at.count }));
    } else if (Array.isArray(recorded)) {
      failures = recorded;
    }
    return { sha256: typeof value === "string" ? value.toLowerCase() : null, failures };
  } catch {
    return { sha256: null, failures: null };
  }
}

/**
 * Which recorded failures the pack's `tolerated` rules name, and which they
 * do not. A rule names a failure when its `linkage` and `id` (where the rule
 * has them) are equal and the failure's message STARTS WITH the rule's.
 *
 * ► **AN UNEXPECTED FAILURE FAILS THE PACK: exit 1, and no ledger entry.** A
 *   pack that recorded something it could not extract is not the pack the
 *   arena was written against, and a ledger that vouched for it would skip it
 *   on every later run. The rules are per failure, measured on the known
 *   build (see `PACKS`), so a failure nobody has looked at is never waved
 *   through.
 */
export function classifyFailures(pack, failures) {
  const tolerated = [];
  const unexpected = [];
  for (const failure of failures ?? []) {
    const named = (pack.tolerated ?? []).some((rule) =>
      (rule.linkage === undefined || failure?.linkage === rule.linkage) &&
      (rule.id === undefined || failure?.id === rule.id) &&
      typeof failure?.message === "string" && failure.message.startsWith(rule.message));
    (named ? tolerated : unexpected).push(failure);
  }
  return { tolerated, unexpected };
}

/** One recorded failure, as a person reads it. */
function describeFailure(failure) {
  if (!failure || typeof failure !== "object") return JSON.stringify(failure);
  const where = failure.linkage ?? failure.id;
  const message = typeof failure.message === "string" ? failure.message : JSON.stringify(failure);
  return where !== undefined ? `${where}: ${message}` : message;
}

/**
 * THE FILES A MANIFEST NAMES, by the reader that fetches them: `{name, bytes}`
 * for each, `bytes` where the manifest records the file's size.
 *
 * - **sound**: `sounds[].file` (with `bytes`), every `bindings` list, and
 *   every `cues.labels[].sounds[].file` — the three places the arena takes a
 *   sound's file name from (`bindingsFrom`, `soundTimingFrom`,
 *   `arenaSoundFilesFrom`).
 * - **bitmaps**: each entry's `file` (with `bytes`) and its `alpha` plane
 *   where it has one — both fetched by `loadBitmaps` in `tools/arena/main.js`.
 */
export const MEDIA_NAMES = Object.freeze({
  sound(manifest) {
    const named = [];
    for (const sound of Array.isArray(manifest?.sounds) ? manifest.sounds : []) named.push({ name: sound?.file, bytes: sound?.bytes });
    for (const files of Object.values(manifest?.bindings ?? {})) for (const name of Array.isArray(files) ? files : [files]) named.push({ name });
    for (const label of Object.values(manifest?.cues?.labels ?? {})) {
      for (const sound of Array.isArray(label?.sounds) ? label.sounds : []) named.push({ name: sound?.file });
    }
    return named;
  },
  bitmaps(manifest) {
    const named = [];
    for (const entry of Object.values(manifest?.bitmaps ?? {})) {
      named.push({ name: entry?.file, bytes: entry?.bytes });
      if (entry?.alpha !== null && entry?.alpha !== undefined) named.push({ name: entry.alpha });
    }
    return named;
  }
});

/**
 * Is every file this pack's manifest names in `folder` (installed or staged),
 * and the size the manifest says? `missing` and `files` hold the paths the
 * files have once installed (`assets/<dir>/<name>`); `unfit` holds a
 * sentence each.
 *
 * ► **A NAME MUST BE A PLAIN FILE NAME.** The extractors write flat folders,
 *   and the arena fetches `/assets/<dir>/<name>`, so a name holding a
 *   separator, `..`, or nothing at all is refused before the disk is asked —
 *   a file that exists OUTSIDE the pack is still not the pack's.
 *
 * An unreadable manifest names nothing here: `outputs` and the recorded
 * sha256 already make that pack run, and fail.
 */
export function checkMedia(pack, folder) {
  const missing = [];
  const unfit = [];
  const files = [];
  if (!pack.media) return { missing, unfit, files };
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(folder, path.posix.basename(pack.media.manifest)), "utf8"));
  } catch {
    return { missing, unfit, files };
  }
  const reader = MEDIA_NAMES[pack.media.names];
  if (!reader) throw new ExtractAllError(`pack ${pack.name} names media reader "${pack.media.names}", which does not exist.`);
  const sizes = new Map();
  for (const { name, bytes } of reader(manifest)) {
    if (typeof name !== "string" || name === "" || name === "." || name === ".." || /[\\/\0]/.test(name)) {
      const sentence = `${pack.media.manifest} names ${JSON.stringify(name ?? null)}, which is not a file name inside ${pack.media.dir}/`;
      if (!unfit.includes(sentence)) unfit.push(sentence);
      continue;
    }
    if (!sizes.has(name) || (sizes.get(name) === undefined && Number.isInteger(bytes))) sizes.set(name, Number.isInteger(bytes) ? bytes : undefined);
  }
  for (const [name, bytes] of sizes) {
    const relative = `${pack.media.dir}/${name}`;
    files.push(relative);
    let stats = null;
    try {
      stats = fs.statSync(path.join(folder, name));
    } catch {
      stats = null;
    }
    if (!stats || !stats.isFile()) missing.push(relative);
    else if (bytes !== undefined && stats.size !== bytes) unfit.push(`${relative} is ${stats.size} bytes, not the ${bytes} ${pack.media.manifest} records`);
  }
  return { missing, unfit, files };
}

/**
 * Each of the pack's installed files — its `outputs` and the media its
 * manifest names — as `[size, mtimeMs]`. The ledger keeps these for the pack
 * it vouches for; a file whose stamp differs has been touched since, and the
 * pack is redone. A size in a manifest covers only some files (an alpha plane
 * has none); the stamp covers all. (A copy that drops mtimes redoes every pack.)
 */
export function fileStamps(pack, repoRoot, media = checkMedia(pack, installedFolder(pack, repoRoot))) {
  const stamps = {};
  for (const relative of [...pack.outputs, ...media.files]) {
    try {
      const stats = fs.statSync(path.join(repoRoot, relative));
      if (stats.isFile()) stamps[relative] = [stats.size, stats.mtimeMs];
    } catch {
      // Missing: `missing` says so, and the pack runs for that reason first.
    }
  }
  return stamps;
}

/**
 * The files whose stamp is not the one the ledger kept (all of them, for an
 * entry that kept none). One that is no longer a file shows up as `missing`.
 */
export function changedSince(entry, stamps) {
  return Object.keys(stamps).filter((file) => {
    const kept = entry?.files?.[file];
    return !Array.isArray(kept) || kept[0] !== stamps[file][0] || kept[1] !== stamps[file][1];
  });
}

/**
 * What a pack's outputs hold right now, as one digest ("absent" for a missing
 * file). A pack that READS this one (`after`) records it in its ledger entry
 * when it is extracted and is redone when it differs — so `--only sound` today
 * redoes figure on the next full run, and sound re-extracted to the same bytes
 * does not.
 */
export function dependencyFingerprint(pack, repoRoot) {
  const hash = crypto.createHash("sha256");
  for (const output of pack.outputs) {
    let digest = "absent";
    try {
      digest = crypto.createHash("sha256").update(fs.readFileSync(path.join(repoRoot, output))).digest("hex");
    } catch {
      digest = "absent";
    }
    hash.update(`${output} ${digest}\n`);
  }
  return hash.digest("hex");
}

/**
 * Run or skip, and the reason a person reads. Pure: everything it needs is
 * handed in, so the rule is under the suite on its own.
 */
export function decide({ pack, entry, sha256, digest, missing = [], unfit = [], changed = [], recorded = null, unexpected = [], staleDependencies = [], force = false }) {
  if (force) return { run: true, reason: "--force" };
  if (!entry) return { run: true, reason: "not extracted yet" };
  if (entry.swfSha256 !== sha256) return { run: true, reason: `last extracted from a different build (${String(entry.swfSha256).slice(0, 12)}…)` };
  if (entry.toolDigest !== digest) return { run: true, reason: `${pack.script} has changed since` };
  if (missing.length > 0) return { run: true, reason: `${missing[0]} is missing${missing.length > 1 ? ` (and ${missing.length - 1} more)` : ""}` };
  if (unfit.length > 0) return { run: true, reason: unfit[0] };
  if (changed.length > 0) return { run: true, reason: `${changed[0]} has changed since it was extracted${changed.length > 1 ? ` (and ${changed.length - 1} more)` : ""}` };
  if (pack.sha256At && recorded !== sha256) {
    return { run: true, reason: `${pack.sha256At.file} ${recorded ? `names a different build (${recorded.slice(0, 12)}…)` : "names no build"}` };
  }
  if (unexpected.length > 0) return { run: true, reason: `${pack.sha256At.file} records ${unexpected.length} failure(s) this command does not expect` };
  if (staleDependencies.length > 0) {
    return { run: true, reason: `it reads ${staleDependencies.join(", ")}, which ${staleDependencies.length > 1 ? "have" : "has"} changed since it was extracted` };
  }
  return { run: false, reason: `already extracted from ${sha256.slice(0, 12)}… by this ${pack.script} (--force to redo)` };
}

/* ─────────────────────────  where the writes will land  ──────────────────── */

/**
 * Every reason this run's writes could land somewhere other than this tree's
 * own `assets/`, as sentences naming the path. Empty means safe to run.
 *
 * - `assets/` and each pack folder must be a real folder resolving (realpath)
 *   to `<this tree>/assets/...`: packs are INSTALLED into it by rename, so a
 *   linked folder — a worktree whose `assets/<pack>` points into the main
 *   checkout — would put them in another tree. Refused.
 * - The SWF must not live inside `assets/`: the ledger's rename, a staging
 *   sweep or an install could take a file at that name with it.
 * - Every entry already in those folders is checked too: a symlink, the SWF
 *   itself (same device and inode) or a hard-linked file is refused. The
 *   extractors write only into fresh staging folders and installing replaces
 *   names rather than writing through them, so this is the second line, kept
 *   from when they wrote in place.
 *
 * Checked once, up front; a link planted while the extractors run is not seen.
 */
export function checkDestinations({ packs, repoRoot, swfPath }) {
  const problems = [];
  const lstat = (target) => {
    try {
      return fs.lstatSync(target, { bigint: true });
    } catch {
      return null;
    }
  };
  const realpath = (target) => {
    try {
      return fs.realpathSync(target);
    } catch {
      return null;
    }
  };
  const linkText = (target) => {
    try {
      return ` (-> ${fs.readlinkSync(target)})`;
    } catch {
      return "";
    }
  };
  let swf = null;
  try {
    swf = fs.statSync(swfPath, { bigint: true });
  } catch {
    swf = null;
  }
  const treeReal = realpath(repoRoot) ?? path.resolve(repoRoot);
  const swfReal = realpath(swfPath);
  const assetsReal = path.join(treeReal, "assets");
  if (swfReal && swfReal.startsWith(`${assetsReal}${path.sep}`)) {
    const inside = path.relative(treeReal, swfReal).split(path.sep).join("/");
    problems.push(`the SWF is inside assets/ (${inside}): this command writes, renames and removes files there. Move it out.`);
  }
  const checkFolder = (relative) => {
    const full = path.join(repoRoot, ...relative.split("/"));
    const stats = lstat(full);
    if (!stats) return false; // Not there yet: the extractor makes it, inside a checked parent.
    if (stats.isSymbolicLink()) {
      problems.push(`${relative} is a symbolic link${linkText(full)}: every write into it would land outside this tree's assets/.`);
      return false;
    }
    if (!stats.isDirectory()) return false; // Not a link: that pack alone is refused, in `extractPacks`.
    const expected = path.join(treeReal, ...relative.split("/"));
    const actual = realpath(full);
    if (actual !== expected) {
      problems.push(`${relative} resolves to ${actual}, not ${expected}: writes into it would land outside this tree's assets/.`);
      return false;
    }
    return true;
  };
  if (!checkFolder("assets") && problems.length > 0) return problems;
  const folders = new Set();
  for (const pack of packs) {
    for (const output of pack.outputs) folders.add(path.posix.dirname(output));
    if (pack.media) folders.add(pack.media.dir);
  }
  for (const folder of [...folders].sort()) {
    if (!checkFolder(folder)) continue;
    const full = path.join(repoRoot, ...folder.split("/"));
    for (const name of fs.readdirSync(full).sort()) {
      const entry = path.join(full, name);
      const relative = `${folder}/${name}`;
      const stats = lstat(entry);
      if (!stats) continue;
      if (stats.isSymbolicLink()) {
        problems.push(`${relative} is a symbolic link${linkText(entry)}: an extractor writing it would write whatever it points at.`);
      } else if (stats.isFile() && swf && stats.dev === swf.dev && stats.ino === swf.ino) {
        problems.push(`${relative} IS the SWF being read (the same file on disk): writing it would destroy the build.`);
      } else if (stats.isFile() && stats.nlink > 1n) {
        problems.push(`${relative} is hard-linked (${stats.nlink} names for one file): writing it would change the other name(s) too.`);
      }
    }
  }
  return problems;
}

/* ─────────────────────────────  one run at a time  ───────────────────────── */

/** Is a process with this pid running here? `EPERM` means it is, and not ours. */
export function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

/**
 * Take `assets/extract-all.lock`, or say who holds it. Two runs at once could
 * mix one run's files into the other's pack with both SWFs unchanged, so a run
 * holds it from before it reads the ledger until its last ledger write.
 *
 * ► **IT NEVER REMOVES A LOCK IT DID NOT TAKE, not even a stale one.** Clearing
 *   stale locks automatically is a race (two runs can each remove the other's
 *   fresh lock), so a run that finds one refuses and says whether its pid is
 *   still running; a lock left by Ctrl-C or a crash is a person's to delete.
 */
export function acquireLock(repoRoot, { pid = process.pid, isAlive = processIsAlive, now = () => Date.now() } = {}) {
  const file = path.join(repoRoot, LOCK_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const token = crypto.randomBytes(12).toString("hex");
  try {
    fs.writeFileSync(file, JSON.stringify({ pid, since: new Date(now()).toISOString(), token }), { flag: "wx" });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let holder = null;
    try {
      holder = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      holder = null;
    }
    const known = holder && Number.isInteger(holder.pid);
    return { held: { pid: known ? holder.pid : null, since: holder?.since ?? null, running: known ? isAlive(holder.pid) : null } };
  }
  const release = () => {
    try {
      if (JSON.parse(fs.readFileSync(file, "utf8"))?.token === token) fs.rmSync(file, { force: true });
    } catch {
      // Gone already, or not ours to remove.
    }
  };
  return { release };
}

/* ─────────────────────────────────  the ledger  ──────────────────────────── */

export function readLedger(repoRoot) {
  const file = path.join(repoRoot, LEDGER_PATH);
  if (!fs.existsSync(file)) return { ledger: { packs: {} }, note: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!parsed || typeof parsed.packs !== "object" || parsed.packs === null) throw new Error("no packs");
    return { ledger: parsed, note: null };
  } catch {
    return { ledger: { packs: {} }, note: `${LEDGER_PATH} is unreadable; treating every pack as not extracted` };
  }
}

function writeLedger(repoRoot, ledger) {
  const file = path.join(repoRoot, LEDGER_PATH);
  const assets = path.join(repoRoot, "assets");
  if (path.dirname(path.resolve(file)) !== path.resolve(assets)) {
    throw new ExtractAllError(`refusing to write the ledger outside assets/: ${file}`);
  }
  fs.mkdirSync(assets, { recursive: true });
  const body = `${JSON.stringify({
    tool: "tools/extract-all.mjs",
    note: "Which build and which extractor wrote each pack, so a re-run can skip it. Local only; never committed.",
    packs: ledger.packs
  }, null, 2)}\n`;
  // A FRESH temporary file (`wx`), then a rename, which replaces a link at
  // `file` rather than writing through it. Anything already at the temporary
  // name, a planted link included, is removed first — the link, not its target.
  const temporary = `${file}.tmp-${process.pid}`;
  fs.rmSync(temporary, { force: true });
  fs.writeFileSync(temporary, body, { flag: "wx" });
  fs.renameSync(temporary, file);
}

/* ──────────────────────────────  running one pack  ───────────────────────── */

/**
 * A path as a LITERAL argument in the shell a person on `platform` pastes
 * into: a file name must never run. bash/zsh get single quotes (an apostrophe
 * is closed, escaped, reopened: `'\''`; a backslash is never left bare).
 * Windows gets double quotes where they are literal in cmd AND PowerShell (no
 * `$`, backtick or `"`), else PowerShell's single quotes with `'` doubled.
 */
export function quoteForShell(value, platform = process.platform) {
  if (platform === "win32") {
    if (/^[A-Za-z0-9_./:\\-]+$/.test(value)) return value;
    return /[$`"]/.test(value) ? `'${value.replace(/'/g, "''")}'` : `"${value}"`;
  }
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function retryCommand(pack, swfPath, platform = process.platform) {
  return `node tools/extract-all.mjs --only ${pack.name} --verbose ${quoteForShell(swfPath, platform)}`;
}

/**
 * The default runner: the extractor as a child process, exactly as a person
 * would run it: the SWF path, then `--out` (the pack's staging folder; see
 * `extractPacks`), every other option at its default.
 *
 * The child's cwd is the repository root, so the path it gets is ABSOLUTE:
 * a relative one is this process's, and would name another file there.
 */
export function spawnExtractor(pack, swfPath, { repoRoot = REPO_ROOT, verbose = false, out = null } = {}) {
  const args = [path.join(repoRoot, pack.script), path.resolve(swfPath), ...(out ? ["--out", out] : [])];
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: verbose ? "inherit" : "pipe"
  });
  return {
    status: result.status,
    signal: result.signal ?? null,
    error: result.error ? String(result.error.message) : null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function lastLine(text) {
  const lines = String(text ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "";
}

/** Is there a regular file here (not nothing, not a folder where a file should be)? */
function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/* ──────────────────────────────────  the CLI  ────────────────────────────── */

export function parseArguments(argv) {
  const options = { file: null, force: false, allowOtherBuild: false, only: null, verbose: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--force") options.force = true;
    else if (value === "--allow-other-build") options.allowOtherBuild = true;
    else if (value === "--verbose") options.verbose = true;
    else if (value === "--help" || value === "-h") options.help = true;
    else if (value === "--only") {
      const next = argv[index + 1];
      if (typeof next !== "string" || next.startsWith("--")) throw new ExtractAllError("--only needs pack names, comma-separated.");
      options.only = next.split(",").map((name) => name.trim()).filter(Boolean);
      index += 1;
    } else if (value.startsWith("--")) {
      // Thrown, not ignored: a silently ignored flag runs a different job and
      // reports it as the one asked for (the rule `tools/engagement-census.mjs`
      // learned first).
      throw new ExtractAllError(`Unknown flag ${JSON.stringify(value)}. Known: --force, --allow-other-build, --only, --verbose, --help.`);
    } else if (options.file === null) options.file = value;
    else throw new ExtractAllError(`Unexpected argument ${JSON.stringify(value)}: one SWF path at most.`);
  }
  return options;
}

export function usageLines(packs = PACKS) {
  return [
    "Usage: node tools/extract-all.mjs [path to swords_sandals2_download.swf, or the collection's folder]",
    "         [--force] [--only pack,pack] [--allow-other-build] [--verbose]",
    "",
    "With no path it looks at SS2_SWF, then Steam's default libraries, then the libraries Steam lists.",
    "",
    "Packs, in the order they run:",
    ...packs.map((pack) => `  ${pack.name.padEnd(13)} ${pack.script.padEnd(32)} ${pack.arena ? "" : "(not the arena) "}${pack.unlocks}`)
  ];
}

function defaultProbe(target) {
  try {
    const stats = fs.statSync(target);
    return stats.isFile() ? "file" : stats.isDirectory() ? "dir" : null;
  } catch {
    return null;
  }
}

function defaultReadText(target) {
  try {
    return fs.readFileSync(target, "utf8");
  } catch {
    return null;
  }
}

export function sha256OfFile(file) {
  // Opened for READING. The installed build is the measurement oracle.
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/**
 * The whole run. Every seam that could reach outside the repository is a
 * parameter, so the suite drives this with a synthetic filesystem and stub
 * extractors and never goes near an install.
 *
 * @returns {number} the exit status
 */
export function main(argv, {
  repoRoot = REPO_ROOT,
  // The directory a RELATIVE path (given, or in SS2_SWF) is relative to: the
  // caller's, not the repository's. See where `located` is found.
  cwd = process.cwd(),
  env = process.env,
  platform = process.platform,
  home = os.homedir(),
  release = os.release(),
  probe = defaultProbe,
  readText = defaultReadText,
  hashFile = sha256OfFile,
  runExtractor = (pack, swfPath, options) => spawnExtractor(pack, swfPath, { ...options, repoRoot }),
  digestOf = (pack) => extractorDigest(path.join(repoRoot, pack.script)),
  packs = PACKS,
  write = (line) => process.stdout.write(`${line}\n`),
  writeError = (line) => process.stderr.write(`${line}\n`),
  // A transient "running <pack>" line while an extractor works, on a terminal
  // only: the result line replaces it, so the record is still one line a pack.
  progress = process.stdout.isTTY ? (text) => process.stdout.write(text === null ? "\r\x1b[K" : `\r\x1b[K${text}`) : null,
  clock = () => Date.now(),
  isAlive = processIsAlive,
  rename = fs.renameSync,
  mkdir = fs.mkdirSync
} = {}) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    writeError(String(error.message));
    return 2;
  }
  if (options.help) {
    for (const line of usageLines(packs)) write(line);
    return 0;
  }

  let selected = packs;
  if (options.only) {
    const unknown = options.only.filter((name) => !packs.some((pack) => pack.name === name));
    if (unknown.length > 0) {
      writeError(`--only: no pack named ${unknown.join(", ")}. Packs: ${packs.map((pack) => pack.name).join(", ")}.`);
      return 2;
    }
    selected = packs.filter((pack) => options.only.includes(pack.name));
  }
  const ordered = orderPacks(selected, { all: packs });

  // ► **RESOLVED ONCE, HERE, AGAINST THE CALLER'S DIRECTORY.** The path is
  //   probed and hashed in this process but handed to children that run with
  //   cwd = the repository root, so a relative path left as typed would be
  //   checked as one file and extracted as another (or as none).
  const absolute = (value) => (value ? path.resolve(cwd, value) : value);
  let located;
  try {
    located = locateSwf({
      given: absolute(options.file),
      env: env.SS2_SWF ? { ...env, SS2_SWF: absolute(env.SS2_SWF) } : env,
      platform, home, release, probe, readText
    });
  } catch (error) {
    writeError(String(error.message));
    return 2;
  }
  const swfPath = located.path;
  write(`SWF    ${swfPath}`);
  write(`       found via ${located.why}`);

  const sha256 = hashFile(swfPath).toLowerCase();
  const fingerprint = readFingerprint(repoRoot);
  const verdict = checkBuild(sha256, fingerprint, { allowOtherBuild: options.allowOtherBuild });
  for (const line of verdict.lines) write(line);
  if (!verdict.proceed) return 2;
  write("");

  const unsafe = checkDestinations({ packs: ordered, repoRoot, swfPath });
  if (unsafe.length > 0) {
    writeError("Refused: the extractors' writes could land outside this tree's assets/, and one could be the SWF.");
    for (const problem of unsafe) writeError(`  ${problem}`);
    writeError("Nothing was written. Replace each of those with a real folder or file (or remove it), and run again.");
    return 2;
  }

  const lock = acquireLock(repoRoot, { isAlive, now: clock });
  if (lock.held) {
    const lockName = LOCK_PATH.split(path.sep).join("/");
    const { pid, since, running } = lock.held;
    writeError(running
      ? `Another extract-all is running (pid ${pid}, since ${since}). Two at once can mix one run's files into the other's packs.`
      : pid === null
        ? `${lockName} is there and cannot be read, so whether another extract-all is running is unknown.`
        : `${lockName} was left by pid ${pid} (since ${since}), which is no longer running: that run ended without finishing.`);
    writeError(`Nothing was written. If no extract-all is running, delete ${lockName} and run again` +
      `${running ? "; otherwise wait for it to finish." : "."}`);
    return 2;
  }
  try {
    return extractPacks({
      ordered, packs, repoRoot, swfPath, sha256, verdict, options, write, clock, progress, runExtractor, digestOf, hashFile, platform, rename, mkdir
    });
  } finally {
    lock.release();
  }
}

/** The packs themselves, under the lock: skip or run each, then check the SWF and summarise. */
function extractPacks({ ordered, packs, repoRoot, swfPath, sha256, verdict, options, write, clock, progress, runExtractor, digestOf, hashFile, platform, rename, mkdir }) {
  const { ledger, note } = readLedger(repoRoot);
  if (note) write(note);

  // Staging left by a run that died (the lock says none is running now).
  const assets = path.join(repoRoot, "assets");
  for (const name of fs.existsSync(assets) ? fs.readdirSync(assets) : []) {
    if (name.startsWith(STAGING_PREFIX)) fs.rmSync(path.join(assets, name), { recursive: true, force: true });
  }

  const results = [];
  // ► **A PACK THIS RUN EXTRACTS IS VOUCHED FOR ONLY AFTER THE CLOSING HASH.**
  //   Its old entry is removed (and written) before it runs; its new one waits
  //   here, and reaches the ledger only once the SWF is shown to be the one
  //   hashed at the start. A run that dies part-way, or whose SWF changed or
  //   vanished, leaves those packs unvouched, and the next run redoes them —
  //   one that records no build of its own (clip-effects) has nothing else to
  //   catch it.
  const pending = {};
  const byName = new Map(packs.map((pack) => [pack.name, pack]));
  let finished = false;
  let verified = true;

  /**
   * Report a pack as rejected, and say what is installed for it now. `state`
   * is how far its install got: nothing, "installed" (complete, then a later
   * step failed), or the list of paths an undo could not put back.
   */
  const reject = (pack, failure, state = null) => {
    const kept = pack.outputs.some((output) => isFile(path.join(repoRoot, output)));
    const mixed = Array.isArray(state) ? state : null;
    const outcome = mixed ? `the undo failed too, so these may be mixed: ${mixed.join(", ")}; the next run redoes it`
      : state === "installed" ? "it was installed but not recorded, and the next run redoes it"
        : kept ? "the previous pack was kept" : "nothing was installed";
    write(`  FAILED   ${pack.name.padEnd(13)} rejected (${failure}); ${outcome}`);
    write(`           retry: ${retryCommand(pack, swfPath, platform)}`);
    results.push({ pack, status: "failed", reason: failure, kept, mixed: Boolean(mixed) });
  };

  /** One pack, start to finish. `step` says how far it got, for `reject`. */
  const processPack = (pack, step) => {
    step.operation = "checking what is installed";
    const entry = ledger.packs[pack.name] ?? null;
    // What this pack reads from other packs, as it is NOW: computed after
    // those packs ran (`ordered`), and what the extractor is about to read.
    const dependencies = Object.fromEntries(pack.after.map((name) => [name, dependencyFingerprint(byName.get(name), repoRoot)]));
    const digest = digestOf(pack);
    const installed = installedFolder(pack, repoRoot);
    const media = checkMedia(pack, installed);
    // A FILE, not merely something at that path: a folder in a file's place is missing.
    const missing = [...pack.outputs.filter((output) => !isFile(path.join(repoRoot, output))), ...media.missing];
    const existing = packRecord(pack, installed);
    const existingFailures = classifyFailures(pack, existing.failures);
    const decision = decide({
      pack,
      entry,
      sha256,
      digest,
      missing,
      unfit: media.unfit,
      changed: changedSince(entry, fileStamps(pack, repoRoot, media)),
      recorded: existing.sha256,
      unexpected: existingFailures.unexpected,
      staleDependencies: pack.after.filter((name) => entry?.dependencies?.[name] !== dependencies[name]),
      force: options.force
    });
    if (!decision.run) {
      write(`  skipped  ${pack.name.padEnd(13)} ${decision.reason}`);
      results.push({ pack, status: "skipped", reason: decision.reason, tolerated: existingFailures.tolerated.length });
      return;
    }

    // The old entry goes BEFORE the run: whatever happens next, the ledger must
    // never vouch for a pack this run touched and did not finish.
    step.operation = "updating the ledger";
    delete ledger.packs[pack.name];
    writeLedger(repoRoot, ledger);
    // Something other than a real folder where the pack goes refuses THIS pack.
    step.operation = `checking ${packFolder(pack)}`;
    const folder = fs.lstatSync(installed, { throwIfNoEntry: false });
    if (folder && (folder.isSymbolicLink() || !folder.isDirectory())) {
      reject(pack, `${packFolder(pack)} is ${folder.isFile() ? "a file" : folder.isSymbolicLink() ? "a symbolic link" : "not a folder"}, not a folder`, false);
      return;
    }
    // ► **BUILT IN STAGING, INSTALLED ONLY WHEN EVERY CHECK HAS PASSED.** The
    //   extractor writes into a fresh, empty folder of its own
    //   (`assets/.extract-all-staging-<pid>-<pack>`: one per PACK, since figure,
    //   wardrobe and enchantments share `assets/figure`). Every check below reads
    //   the staged files. Only a pack that passes them all is moved into
    //   `assets/<dir>/`, file by file, by rename; a rejected one is deleted and
    //   the installed pack — media included — is not touched at all.
    //   The staging folder sits BESIDE the pack folders, at the same depth, so a
    //   path an extractor derives from `--out` (the figure preview's
    //   `../sound`) is the one it would derive from `assets/<dir>`.
    step.operation = "creating the staging folder";
    const staging = path.join(repoRoot, "assets", `${STAGING_PREFIX}${process.pid}-${pack.name}`);
    step.staging = staging;
    mkdir(staging); // fails if anything is there: the sweep above cleared every staging name
    step.operation = "running the extractor";
    const started = clock();
    const transient = progress && !options.verbose ? progress : null;
    if (transient) transient(`  running  ${pack.name.padEnd(13)} ${decision.reason}`);
    const run = runExtractor(pack, swfPath, { verbose: options.verbose, out: staging });
    if (transient) transient(null);
    const seconds = ((clock() - started) / 1000).toFixed(1);

    step.operation = "checking the staged pack";
    const unwritten = pack.outputs.filter((output) => !isFile(path.join(staging, path.posix.basename(output))));
    let failure = null;
    const record = packRecord(pack, staging);
    const recordedFailures = classifyFailures(pack, record.failures);
    const written = checkMedia(pack, staging);
    if (run.error) failure = `could not start: ${run.error}`;
    else if (run.status !== 0) {
      const said = lastLine(run.stderr) || lastLine(run.stdout);
      failure = `exit ${run.status ?? run.signal}${said ? `: ${said}` : options.verbose ? " (its output is above)" : ""}`;
    } else {
      if (unwritten.length > 0) failure = `exited 0 but did not write ${unwritten.join(", ")}`;
      else if (pack.sha256At && record.sha256 !== sha256) {
        failure = `wrote ${pack.sha256At.file} naming ${record.sha256 ?? "no build"}, not ${sha256.slice(0, 12)}…`;
      } else if (written.unfit.length > 0 || written.missing.length > 0) {
        failure = written.unfit[0] ??
          `wrote ${pack.media.manifest}, but ${written.missing.length} file(s) it names are missing: ` +
          `${written.missing.slice(0, 3).join(", ")}${written.missing.length > 3 ? ", …" : ""}`;
      } else if (recordedFailures.unexpected.length > 0) {
        failure = `${pack.sha256At.file} records ${recordedFailures.unexpected.length} failure(s) this command does not expect; ` +
          `the first: ${describeFailure(recordedFailures.unexpected[0])}`;
      }
    }

    // Install: every file the extractor staged, into the pack's own folder —
    // only this pack's files, so packs sharing a folder never touch each
    // other's — and only once no destination is anything but absent or a
    // plain file, so an obstruction fails the pack before a single file moves.
    // ► **A FAILED INSTALL IS UNDONE.** Each installed file is first renamed
    //   into `<staging>/.previous/`, then the staged one into place, and each
    //   step is journalled. On an error the journal is undone in reverse: a
    //   file placed where there was none is removed, every backup goes back.
    //   Only an undo that fails itself (named, path by path) or a process
    //   killed mid-install can leave a pack mixed; its ledger entry is gone.
    let undoFailed = null;
    if (!failure) {
      step.operation = "installing";
      const staged = fs.readdirSync(staging).filter((name) => isFile(path.join(staging, name))).sort();
      for (const name of staged) {
        const stats = fs.lstatSync(path.join(installed, name), { throwIfNoEntry: false });
        if (stats && (stats.isSymbolicLink() || !stats.isFile())) {
          failure = `cannot install: ${packFolder(pack)}/${name} is ${stats.isDirectory() ? "a folder" : stats.isSymbolicLink() ? "a symbolic link" : "not a regular file"}, not a file`;
          break;
        }
      }
      if (!failure) {
        mkdir(installed, { recursive: true });
        const previous = path.join(staging, ".previous");
        mkdir(previous);
        const journal = [];
        for (const name of staged) {
          const target = path.join(installed, name);
          const entry = { name, backup: null, placed: false };
          journal.push(entry);
          try {
            if (isFile(target)) {
              rename(target, path.join(previous, name));
              entry.backup = path.join(previous, name);
            }
            rename(path.join(staging, name), target);
            entry.placed = true;
          } catch (error) {
            failure = `installing ${packFolder(pack)}/${name} failed: ${String(error?.message ?? error)}`;
            break;
          }
        }
        if (failure) undoFailed = undoInstall(journal, installed, pack);
        else step.state = "installed";
      }
    }
    // A failed undo keeps staging: its `.previous/` holds what could not go back.
    if (!undoFailed?.length) fs.rmSync(staging, { recursive: true, force: true });
    step.staging = null;
    if (failure) {
      reject(pack, failure, undoFailed?.length ? undoFailed : null);
      return;
    }

    step.operation = "recording the result";
    pending[pack.name] = {
      swfSha256: sha256,
      known: verdict.known,
      toolDigest: digest,
      dependencies,
      files: fileStamps(pack, repoRoot),
      script: pack.script,
      outputs: pack.outputs,
      extractedAt: new Date(clock()).toISOString()
    };
    // Why it ran, unless it simply had never run: a re-run that redid a pack
    // should say which of the skip conditions failed.
    const why = decision.reason === "not extracted yet" ? "" : `  (${decision.reason})`;
    const tolerated = recordedFailures.tolerated.length;
    const recorded = tolerated ? `  [${tolerated} tolerated failure(s) in ${pack.sha256At.file}: ${pack.toleratedWhy}]` : "";
    write(`  ok       ${pack.name.padEnd(13)} ${seconds} s  -> ${path.posix.dirname(pack.outputs[0])}/${why}${recorded}`);
    results.push({ pack, status: "ok", reason: decision.reason, tolerated });
  };

  /**
   * Undo an install in reverse: remove what was placed where nothing was, and
   * put every backup back. Returns the paths it could NOT restore, each with
   * where its previous copy is — empty when the pack is back as it was.
   */
  function undoInstall(journal, installed, pack) {
    const stuck = [];
    for (const { name, backup, placed } of [...journal].reverse()) {
      const target = path.join(installed, name);
      try {
        if (backup) rename(backup, target);
        else if (placed) fs.rmSync(target, { force: true });
      } catch {
        const where = backup ? ` (its previous copy is in ${path.relative(repoRoot, path.dirname(backup)).split(path.sep).join("/")}/)` : "";
        stuck.push(`${packFolder(pack)}/${name}${where}`);
      }
    }
    return stuck;
  }

  try {
    for (const pack of ordered) {
      // ► **ANY ERROR FAILS ITS OWN PACK, AND THE RUN GOES ON.** An unexpected
      //   state (a file where a folder goes, a permission, a locked file) is
      //   that pack's rejection, naming the step and the error; its staging
      //   is removed, best effort, and it gets no ledger entry.
      const step = { operation: "starting", staging: null, state: null };
      try {
        processPack(pack, step);
      } catch (error) {
        delete pending[pack.name];
        if (step.staging) {
          try {
            fs.rmSync(step.staging, { recursive: true, force: true });
          } catch {
            // Best effort: the next run's sweep removes it.
          }
        }
        const code = String(error?.code ?? error?.name ?? "Error");
        const message = String(error?.message ?? error);
        reject(pack, `${step.operation} failed: ${message.startsWith(code) ? message : `${code}: ${message}`}`, step.state);
      }
    }
    finished = true;
  } finally {
    // ► **THE CLOSING CHECK RUNS HOWEVER THE LOOP ENDS**, a throw included:
    //   a changed SWF is said out loud even when the run is going down anyway.
    if (!finished || results.some((result) => result.status !== "skipped")) verified = closingCheck();
  }
  // Only a run that FINISHED, against the same SWF, vouches for what it did.
  if (verified && Object.keys(pending).length > 0) {
    Object.assign(ledger.packs, pending);
    writeLedger(repoRoot, ledger);
  }
  const exitCode = !verified || results.some((result) => result.status === "failed") ? 1 : 0;

  /** Is the SWF still the one hashed at the start? Says so loudly when not. */
  function closingCheck() {
    // Unreadable now is as bad as changed: nothing says what the packs read.
    let after = null;
    let unreadable = null;
    try {
      after = hashFile(swfPath).toLowerCase();
    } catch (error) {
      unreadable = String(error?.message ?? error);
    }
    if (after === sha256) return true;
    write("");
    if (unreadable) {
      write(`THE SWF COULD NOT BE READ AGAIN AFTER THIS RAN: ${unreadable}`);
      write("Something moved or replaced it while the extractors ran. Every pack above may be from another build.");
    } else {
      write(`THE SWF CHANGED WHILE THIS RAN: ${sha256} -> ${after}`);
      write("Nothing here writes to it, so something else did. Every pack above may be from either build.");
    }
    const extracted = Object.keys(pending);
    if (extracted.length > 0) write(`The ledger vouches for none of ${extracted.join(", ")}: the next run redoes them.`);
    return false;
  }

  write("");
  for (const line of summaryLines(results, { known: verdict.known, sha256 })) write(line);
  return exitCode;
}

/** The closing lines: what the arena can use now, and what it falls back on. */
export function summaryLines(results, { known = true, sha256 = "" } = {}) {
  const usable = results.filter((result) => result.status !== "failed");
  const failed = results.filter((result) => result.status === "failed");
  const arena = usable.filter((result) => result.pack.arena);
  const lines = [];
  const flagged = (result) => (result.tolerated ? `  [${result.tolerated} tolerated failure(s)]` : "");
  if (arena.length > 0) {
    lines.push("the arena can now use:");
    for (const result of arena) lines.push(`  ${result.pack.name.padEnd(13)} ${result.pack.unlocks}${flagged(result)}`);
  } else {
    lines.push("the arena can now use: nothing new from this run.");
  }
  for (const result of usable.filter((r) => !r.pack.arena)) lines.push(`also: ${result.pack.unlocks}${flagged(result)}`);
  if (failed.length > 0) {
    lines.push("not refreshed (each falls back, and nothing else stops working):");
    for (const result of failed) {
      const dir = path.posix.dirname(result.pack.outputs[0]);
      lines.push(`  ${result.pack.name.padEnd(13)} ${result.mixed ? `${dir}/ may mix old and new files; the next run redoes it`
        : result.kept ? `${dir}/ keeps the previous pack` : result.pack.without}`);
    }
  }
  if (!known) lines.push(`every pack above is from ${sha256.slice(0, 12)}…, NOT the build this project knows.`);
  lines.push("", "start it:  node tools/arena-server.mjs   then open http://127.0.0.1:8123/");
  lines.push(failed.length > 0 ? `${failed.length} pack(s) failed; the retry line under each says how to redo just that one.` : "done.");
  return lines;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
