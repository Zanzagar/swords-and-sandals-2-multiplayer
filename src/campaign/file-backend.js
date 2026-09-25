/**
 * A campaign storage backend that writes to a DIRECTORY.
 *
 * ## Why this exists
 *
 * ► **THE CAMPAIGN LAYER HAS BEEN BUILT FOR PERSISTENCE SINCE IT WAS WRITTEN
 *   AND HAS NEVER HAD ANY.** Measured 2026-09-19: 3,174 lines, 69 exports, 70
 *   passing tests, **one non-test consumer** (`tools/hotseat.mjs`, importing
 *   three names) and **zero `writeFile` calls anywhere in it**. The September
 *   audit put it like this: *"Nothing a person can run persists a campaign
 *   anywhere."*
 *
 *   The gap was never the design. `CampaignStore` takes an INJECTED backend
 *   with a four-method contract — `read`, `write`, `remove`, `keys`, plus an
 *   optional `flush` — and the module shipped two implementations of it:
 *   `createMemoryBackend` (a `Map`, which dies with the process) and
 *   `createNamespacedBackend` (fields on a live vanilla save object, which is
 *   the browser's). **Neither survives a reboot.** This is the third.
 *
 * ## WHY IT IS NOT RE-EXPORTED FROM `src/campaign/index.js`
 *
 * ► **BECAUSE THE REST OF THE LAYER RUNS IN A BROWSER AND THIS CANNOT.** Every
 *   other module under `src/campaign/` is environment-agnostic — that is what
 *   lets `createNamespacedBackend` sit on the vanilla save object inside the
 *   page. This file imports `node:fs`, so re-exporting it from the barrel would
 *   put a node builtin on the import graph of anything that reaches for the
 *   campaign layer, and the failure would arrive as a bundler error in whatever
 *   imported it next. **Import it by path, deliberately, from a tool that knows
 *   it is on node.** `tools/arena-campaign.mjs` is the one that does.
 *
 * ## The two decisions that are not obvious
 *
 * ► **A KEY IS NOT A FILENAME, BECAUSE WINDOWS FORBIDS THE SEPARATOR.** Keys
 *   are `ss2TeamArena:battle:<id>:<n>` and a colon cannot appear in a Windows
 *   filename — the same constraint `docs/handoffs/README.md` records about its
 *   own stamps ("No colons — Windows forbids them in filenames"), and this
 *   project runs its capture vehicle on Windows. The separator is written as
 *   `~`, which is **injective because `~` is not in the key-segment alphabet**
 *   (`/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/`), so the mapping round-trips
 *   exactly rather than approximately.
 *
 * ► **A WRITE IS ATOMIC, BECAUSE A HALF-WRITTEN RECORD READS AS CORRUPT.** The
 *   store already distinguishes `MISSING` from `CORRUPT` from `UNSUPPORTED`,
 *   and a process killed mid-write would manufacture the middle one — a
 *   campaign that reports its own evidence as damaged when nothing is damaged.
 *   Written to a temp file in the same directory and renamed, because `rename`
 *   within a filesystem is atomic and a cross-device rename is not.
 */
import { CampaignStorageError } from "./errors.js";
import { CAMPAIGN_NAMESPACE } from "./vanilla-boundary.js";

/**
 * The on-disk separator. **Not in the key-segment alphabet**, which is what
 * makes `key -> filename` injective; see the header.
 */
const FILE_SEPARATOR = "~";

/** Every record this backend writes carries it, so a directory can hold others. */
const FILE_SUFFIX = ".json";

const PREFIX = `${CAMPAIGN_NAMESPACE}${FILE_SEPARATOR}`;

/** `ss2TeamArena:battle:abc:1` -> `ss2TeamArena~battle~abc~1.json`. */
export function fileNameForKey(key) {
  if (typeof key !== "string" || key.length === 0) {
    throw new CampaignStorageError("A campaign key must be a non-empty string.");
  }
  if (key.includes(FILE_SEPARATOR)) {
    // Unreachable through `campaignKey`, and checked anyway: if the segment
    // alphabet ever gained `~` the mapping would stop round-tripping and every
    // key would collide with a different one, silently.
    throw new CampaignStorageError(
      `Campaign key ${JSON.stringify(key)} contains ${FILE_SEPARATOR}, which this backend uses as its ` +
      "separator. The key grammar and this file have drifted apart."
    );
  }
  return `${key.split(":").join(FILE_SEPARATOR)}${FILE_SUFFIX}`;
}

/** The inverse. Returns `null` for a file this backend did not write. */
export function keyForFileName(name) {
  if (typeof name !== "string" || !name.endsWith(FILE_SUFFIX) || !name.startsWith(PREFIX)) return null;
  return name.slice(0, -FILE_SUFFIX.length).split(FILE_SEPARATOR).join(":");
}

/**
 * @param {object} options
 * @param {string} options.directory  Where records live. Created if absent.
 * @param {object} options.fs         The `node:fs` surface, injected so the
 *   tests can drive failure paths that a real filesystem will not produce on
 *   demand. Defaults to `node:fs` when omitted.
 */
export function createFileBackend({ directory, fs } = {}) {
  if (typeof directory !== "string" || directory.length === 0) {
    throw new CampaignStorageError("A file backend needs a directory.");
  }
  const io = fs ?? defaultFs();
  io.mkdirSync(directory, { recursive: true });

  const pathFor = (key) => `${directory}/${fileNameForKey(key)}`;

  return {
    read(key) {
      try {
        return io.readFileSync(pathFor(key), "utf8");
      } catch (error) {
        // ► **ONLY "NOT THERE" IS `null`.** A permission error or a directory
        //   where a file should be is a real fault, and swallowing it would
        //   present an unreadable campaign as an absent one — the store would
        //   then report MISSING and a caller would cheerfully start a new
        //   campaign over the top of one it could not read.
        if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) return null;
        throw error;
      }
    },

    write(key, text) {
      if (typeof text !== "string") {
        throw new CampaignStorageError("A campaign backend stores text; serialise before writing.");
      }
      const target = pathFor(key);
      // Same directory, so the rename cannot cross a device boundary and stays
      // atomic.
      //
      // ► **THE SUFFIX CARRIES THE PROCESS ID, AND THE FIRST CUT USED A FIXED
      //   NAME "because this backend is single-process by contract".** An
      //   adversarial review pointed out that nothing ENFORCES that contract:
      //   two runs against the same directory shared one `.writing` path, so
      //   they could truncate or rename each other's temporary file, and a
      //   writer still holding the inode could go on modifying a file another
      //   writer had already renamed into place. **A contract nothing checks is
      //   a comment.** Unique per process, and still `.writing` so `keys()`
      //   ignores it and a human can still find it after a crash.
      //
      //   **This is protection, not mutual exclusion.** Two processes advancing
      //   the SAME campaign still produce competing histories, because the
      //   conflict is in the circuit rather than in the bytes;
      //   `tools/arena-campaign.mjs` says so where it resumes.
      const temporary = `${target}.${processId()}.writing`;
      io.writeFileSync(temporary, text, "utf8");
      io.renameSync(temporary, target);
    },

    remove(key) {
      try {
        io.rmSync(pathFor(key));
      } catch (error) {
        if (error && error.code === "ENOENT") return;
        throw error;
      }
    },

    keys() {
      let names;
      try {
        names = io.readdirSync(directory);
      } catch (error) {
        if (error && error.code === "ENOENT") return [];
        throw error;
      }
      // ► **FILES THIS BACKEND DID NOT WRITE ARE INVISIBLE, INCLUDING ITS OWN
      //   TEMPORARIES.** A `.writing` file left by a crash does not end in
      //   `.json`, so it is not a key, is not read, and does not turn into a
      //   corrupt record the next time anything lists the directory.
      return names.map(keyForFileName).filter((key) => key !== null).sort();
    }
  };
}

const processId = () => globalThis.process?.pid ?? "0";

let cachedFs = null;
function defaultFs() {
  if (!cachedFs) {
    // Required lazily so importing this module does not pull `node:fs` into a
    // graph that only wanted the key helpers above.
    cachedFs = globalThis.process?.getBuiltinModule?.("node:fs");
    if (!cachedFs) {
      throw new CampaignStorageError(
        "No node:fs available; pass { fs } explicitly, or use createMemoryBackend outside node."
      );
    }
  }
  return cachedFs;
}
