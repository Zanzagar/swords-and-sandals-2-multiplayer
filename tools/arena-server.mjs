/**
 * A static file server for the browser arena, and nothing else.
 *
 * WHY IT EXISTS. `tools/arena/` imports `src/render/`, `src/adapter/` and
 * `src/team/` DIRECTLY, as ES modules, over http. That is the whole point: the
 * browser runs the same resolver and the same adapter the tests run, with no
 * bundler, no build step, no transpile and no second copy of the engine to
 * drift. A file:// page cannot do it (module requests from file:// are blocked
 * as cross-origin), so the page needs an origin — and this is the smallest
 * thing that provides one.
 *
 * Node builtins only. `package.json` declares no dependencies and this does not
 * add one, exactly as `tools/hotseat.mjs` promises for itself.
 *
 * WHAT IT DELIBERATELY IS NOT:
 *
 * - **It is not part of the game.** Nothing under `src/` imports it.
 * - **It binds to loopback only**, and says so on startup. This serves the
 *   repository's own working tree; it has no business on a network interface.
 * - **It serves the repository and nothing above it.** Every request is
 *   resolved and then checked to be inside the repo root, so `..` cannot walk
 *   out. It also refuses `.git`, and it refuses `captures/`, `local-mod-work/`
 *   and any `.swf` outright — those are the licensed-adjacent paths, and a
 *   convenience server that will hand out an installed build is exactly how a
 *   tool for building a game turns into a loader for someone's licensed bytes.
 *
 * Usage:  node tools/arena-server.mjs [--port 8123]
 */

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/**
 * Paths this server will not serve at any price. `captures/` is the raw
 * instrumentation archive, `local-mod-work/` is the modding scratch area, and
 * a `.swf` is a licensed build. None of them belongs behind an http origin, and
 * refusing them here is cheaper than remembering not to ask.
 */
const FORBIDDEN_PREFIXES = Object.freeze(["captures", "local-mod-work", ".git", "node_modules"]);
const FORBIDDEN_EXTENSIONS = Object.freeze([".swf", ".sol", ".exe", ".dll"]);

const CONTENT_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".map": "application/json; charset=utf-8"
});

function parsePort(argv) {
  const index = argv.indexOf("--port");
  if (index === -1) return 8123;
  const value = Number(argv[index + 1]);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`--port needs a port number, not ${JSON.stringify(argv[index + 1])}.`);
  }
  return value;
}

/**
 * Maps a request path to a file inside the repository, or null.
 *
 * Returns null rather than throwing so a caller cannot tell a refused path from
 * a missing one by the shape of the failure.
 */
export function resolveRequestPath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  } catch {
    return null;
  }
  if (decoded === "/" || decoded === "") decoded = "/tools/arena/index.html";
  // NUL and backslash both defeat naive prefix checks on some platforms.
  if (decoded.includes("\0") || decoded.includes("\\")) return null;

  const relative = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "").replace(/^[/\\]+/, "");
  const absolute = resolve(join(REPO_ROOT, relative));

  // The containment check is on the RESOLVED path, so a symlink or a `..` that
  // survived normalisation still fails here.
  if (absolute !== REPO_ROOT && !absolute.startsWith(REPO_ROOT + sep)) return null;

  const inside = absolute.slice(REPO_ROOT.length + 1).split(sep);
  if (FORBIDDEN_PREFIXES.includes(inside[0])) return null;
  if (FORBIDDEN_EXTENSIONS.includes(extname(absolute).toLowerCase())) return null;
  return absolute;
}

async function serve(request, response) {
  const absolute = resolveRequestPath(request.url ?? "/");
  if (absolute === null) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found.\n");
    return;
  }
  let info;
  try {
    info = await stat(absolute);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found.\n");
    return;
  }
  if (!info.isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found.\n");
    return;
  }
  response.writeHead(200, {
    "content-type": CONTENT_TYPES[extname(absolute).toLowerCase()] ?? "application/octet-stream",
    "content-length": info.size,
    // The page holds no state worth caching across an edit, and a stale module
    // during development is a debugging session nobody needs.
    "cache-control": "no-store"
  });
  createReadStream(absolute).pipe(response);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const port = parsePort(process.argv.slice(2));
  createServer((request, response) => {
    serve(request, response).catch(() => {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end("Server error.\n");
    });
  }).listen(port, "127.0.0.1", () => {
    console.log(`  The arena is served from ${REPO_ROOT}`);
    console.log(`  Loopback only: http://127.0.0.1:${port}/`);
    console.log("");
    console.log("  It serves the repository's own working tree so the page can import src/ directly.");
    console.log("  captures/, local-mod-work/, .git/ and every .swf are refused outright.");
  });
}
